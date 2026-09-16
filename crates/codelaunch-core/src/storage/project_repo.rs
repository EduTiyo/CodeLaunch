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

impl ProjectRepository for FsProjectRepository {
    fn list(&self) -> Result<Vec<ProjectSummary>> {
        let mut summaries = Vec::new();
        for entry in fs::read_dir(&self.base_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let raw = fs::read_to_string(&path)?;
            let value: serde_json::Value = serde_json::from_str(&raw)?;
            let value = migrate_schema(value);
            let project: Project = serde_json::from_value(value)?;
            summaries.push(ProjectSummary::from(&project));
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
        let json = serde_json::to_string_pretty(project)?;
        fs::write(path, json)?;
        Ok(())
    }

    fn delete(&self, id: Uuid) -> Result<()> {
        let path = self.path_for(id);
        if path.exists() {
            fs::remove_file(path)?;
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

        repo.delete(project.id).unwrap();
        assert!(repo.load(project.id).is_err());
    }

    #[test]
    fn load_missing_project_errors() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = FsProjectRepository::new(tmp.path()).unwrap();
        let err = repo.load(Uuid::new_v4()).unwrap_err();
        assert!(matches!(err, RepoError::NotFound(_)));
    }
}
