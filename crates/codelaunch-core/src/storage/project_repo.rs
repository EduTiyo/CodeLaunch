use std::fs;
use std::path::PathBuf;

use uuid::Uuid;

use crate::model::{Project, ProjectSummary};

use super::migrate_schema;

#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("project {0} not found")]
    NotFound(Uuid),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, RepoError>;

pub trait ProjectRepository {
    fn list(&self) -> Result<Vec<ProjectSummary>>;
    fn load(&self, id: Uuid) -> Result<Project>;
    fn save(&self, project: &Project) -> Result<()>;
    fn delete(&self, id: Uuid) -> Result<()>;
}

/// Stores one JSON file per project under `base_dir`, named `<uuid>.json`.
pub struct FsProjectRepository {
    base_dir: PathBuf,
}

impl FsProjectRepository {
    pub fn new(base_dir: impl Into<PathBuf>) -> Result<Self> {
        let base_dir = base_dir.into();
        fs::create_dir_all(&base_dir)?;
        Ok(Self { base_dir })
    }

    fn path_for(&self, id: Uuid) -> PathBuf {
        self.base_dir.join(format!("{id}.json"))
    }
}

#[derive(serde::Deserialize)]
struct ProjectListEntry {
    id: Uuid,
    name: String,
    #[serde(default)]
    group: Option<String>,
    ide: crate::model::IdeKind,
    #[serde(default)]
    folders: Vec<serde::de::IgnoredAny>,
    #[serde(default)]
    terminal_groups: Vec<serde::de::IgnoredAny>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl ProjectRepository for FsProjectRepository {
    fn list(&self) -> Result<Vec<ProjectSummary>> {
        let mut summaries = Vec::new();
        for entry in fs::read_dir(&self.base_dir)? {
            let Ok(entry) = entry else {
                continue;
            };
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let raw = match fs::read_to_string(&path) {
                Ok(content) => content,
                Err(err) => {
                    eprintln!("Failed to read project file {}: {}", path.display(), err);
                    continue;
                }
            };
            let value: serde_json::Value = match serde_json::from_str(&raw) {
                Ok(val) => val,
                Err(err) => {
                    eprintln!("Failed to parse JSON in {}: {}", path.display(), err);
                    continue;
                }
            };
            let value = migrate_schema(value);
            match serde_json::from_value::<ProjectListEntry>(value) {
                Ok(entry) => {
                    summaries.push(ProjectSummary {
                        id: entry.id,
                        name: entry.name,
                        group: entry.group,
                        ide: entry.ide,
                        folder_count: entry.folders.len(),
                        terminal_group_count: entry.terminal_groups.len(),
                        updated_at: entry.updated_at,
                    });
                }
                Err(err) => {
                    eprintln!(
                        "Failed to deserialize project summary in {}: {}",
                        path.display(),
                        err
                    );
                }
            }
        }
        summaries.sort_by_key(|s| std::cmp::Reverse(s.updated_at));
        Ok(summaries)
    }

    fn load(&self, id: Uuid) -> Result<Project> {
        let path = self.path_for(id);
        if !path.exists() {
            return Err(RepoError::NotFound(id));
        }
        let raw = fs::read_to_string(path)?;
        let value: serde_json::Value = serde_json::from_str(&raw)?;
        let value = migrate_schema(value);
        Ok(serde_json::from_value(value)?)
    }

    fn save(&self, project: &Project) -> Result<()> {
        let path = self.path_for(project.id);
        let tmp_path = self.base_dir.join(format!("{}.json.tmp", project.id));
        let json = serde_json::to_string_pretty(project)?;
        if let Err(err) = fs::write(&tmp_path, json) {
            let _ = fs::remove_file(&tmp_path);
            return Err(err.into());
        }
        if let Err(err) = fs::rename(&tmp_path, &path) {
            let _ = fs::remove_file(&tmp_path);
            return Err(err.into());
        }
        Ok(())
    }

    fn delete(&self, id: Uuid) -> Result<()> {
        let path = self.path_for(id);
        if path.exists() {
            fs::remove_file(path)?;
        }
        let tmp_path = self.base_dir.join(format!("{id}.json.tmp"));
        if tmp_path.exists() {
            let _ = fs::remove_file(tmp_path);
        }
        Ok(())
    }
}

pub fn default_projects_dir() -> Option<PathBuf> {
    super::config_dir().map(|dir| dir.join("projects"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::IdeKind;

    #[test]
    fn save_load_list_delete_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = FsProjectRepository::new(tmp.path()).unwrap();

        let project = Project::new("Test Project", IdeKind::VsCode);
        repo.save(&project).unwrap();

        let loaded = repo.load(project.id).unwrap();
        assert_eq!(loaded.name, "Test Project");

        let summaries = repo.list().unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].id, project.id);
        assert_eq!(summaries[0].folder_count, 0);
        assert_eq!(summaries[0].terminal_group_count, 0);

        repo.delete(project.id).unwrap();
        assert!(repo.load(project.id).is_err());
    }

    #[test]
    fn save_is_atomic_and_cleans_up_tmp_file() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = FsProjectRepository::new(tmp.path()).unwrap();

        let project = Project::new("Atomic Project", IdeKind::VsCode);
        repo.save(&project).unwrap();

        let final_path = tmp.path().join(format!("{}.json", project.id));
        let tmp_path = tmp.path().join(format!("{}.json.tmp", project.id));
        assert!(final_path.is_file());
        assert!(!tmp_path.exists());
    }

    #[test]
    fn list_skips_corrupted_json_files_gracefully() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = FsProjectRepository::new(tmp.path()).unwrap();

        let valid_project = Project::new("Healthy Project", IdeKind::VsCode);
        repo.save(&valid_project).unwrap();

        // Write a corrupt JSON file in the same repository directory
        let corrupt_path = tmp.path().join("corrupt-uuid.json");
        fs::write(corrupt_path, "{ broken json content ...").unwrap();

        // Write a non-json file that should also be ignored
        let text_path = tmp.path().join("notes.txt");
        fs::write(text_path, "some notes").unwrap();

        let summaries = repo.list().unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].id, valid_project.id);
        assert_eq!(summaries[0].name, "Healthy Project");
    }

    #[test]
    fn load_missing_project_errors() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = FsProjectRepository::new(tmp.path()).unwrap();
        let err = repo.load(Uuid::new_v4()).unwrap_err();
        assert!(matches!(err, RepoError::NotFound(_)));
    }
}
