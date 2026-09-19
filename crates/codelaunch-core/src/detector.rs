use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DetectedCommand {
    pub label: String,
    pub command: String,
    pub source: String,
    pub default_selected: bool,
}

/// Scans a directory for common project markers (package.json, Cargo.toml,
/// docker-compose, Makefile, Python, Go, etc.) and returns runnable commands.
pub fn detect_commands_in_folder(path: &Path) -> Vec<DetectedCommand> {
    if !path.is_dir() {
        return Vec::new();
    }

    let mut detected = Vec::new();

    detect_node_scripts(path, &mut detected);
    detect_cargo_commands(path, &mut detected);
    detect_docker_compose(path, &mut detected);
    detect_makefile_targets(path, &mut detected);
    detect_python_commands(path, &mut detected);
    detect_go_commands(path, &mut detected);

    detected
}

fn detect_node_scripts(path: &Path, out: &mut Vec<DetectedCommand>) {
    let pkg_path = path.join("package.json");
    if !pkg_path.is_file() {
        return;
    }

    let Ok(content) = fs::read_to_string(&pkg_path) else {
        return;
    };

    let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) else {
        return;
    };

    let Some(scripts) = val.get("scripts").and_then(|s| s.as_object()) else {
        return;
    };

    let pm = if path.join("pnpm-lock.yaml").is_file() {
        "pnpm"
    } else if path.join("yarn.lock").is_file() {
        "yarn"
    } else if path.join("bun.lockb").is_file() || path.join("bun.lock").is_file() {
        "bun"
    } else {
        "npm"
    };

    for (script_name, _) in scripts {
        let command = match pm {
            "npm" => {
                if script_name == "start" || script_name == "test" {
                    format!("npm {script_name}")
                } else {
                    format!("npm run {script_name}")
                }
            }
            "yarn" => format!("yarn {script_name}"),
            "pnpm" => {
                if script_name == "start" || script_name == "test" {
                    format!("pnpm {script_name}")
                } else {
                    format!("pnpm run {script_name}")
                }
            }
            "bun" => format!("bun run {script_name}"),
            _ => format!("npm run {script_name}"),
        };

        let default_selected = matches!(
            script_name.as_str(),
            "dev" | "start" | "serve" | "develop" | "watch"
        );

        out.push(DetectedCommand {
            label: script_name.clone(),
            command,
            source: "package.json".to_string(),
            default_selected,
        });
    }
}

fn detect_cargo_commands(path: &Path, out: &mut Vec<DetectedCommand>) {
    let cargo_path = path.join("Cargo.toml");
    if !cargo_path.is_file() {
        return;
    }

    out.push(DetectedCommand {
        label: "cargo run".to_string(),
        command: "cargo run".to_string(),
        source: "Cargo.toml".to_string(),
        default_selected: true,
    });

    out.push(DetectedCommand {
        label: "cargo test".to_string(),
        command: "cargo test".to_string(),
        source: "Cargo.toml".to_string(),
        default_selected: false,
    });

    out.push(DetectedCommand {
        label: "cargo check".to_string(),
        command: "cargo check".to_string(),
        source: "Cargo.toml".to_string(),
        default_selected: false,
    });
}

fn detect_docker_compose(path: &Path, out: &mut Vec<DetectedCommand>) {
    let candidates = [
        "compose.yaml",
        "compose.yml",
        "docker-compose.yml",
        "docker-compose.yaml",
    ];

    for candidate in candidates {
        if path.join(candidate).is_file() {
            out.push(DetectedCommand {
                label: "docker compose up".to_string(),
                command: "docker compose up".to_string(),
                source: candidate.to_string(),
                default_selected: true,
            });
            out.push(DetectedCommand {
                label: "docker compose up (detached)".to_string(),
                command: "docker compose up -d".to_string(),
                source: candidate.to_string(),
                default_selected: false,
            });
            break;
        }
    }
}

fn detect_makefile_targets(path: &Path, out: &mut Vec<DetectedCommand>) {
    let makefile = if path.join("Makefile").is_file() {
        path.join("Makefile")
    } else if path.join("makefile").is_file() {
        path.join("makefile")
    } else {
        return;
    };

    let Ok(content) = fs::read_to_string(&makefile) else {
        return;
    };

    for line in content.lines() {
        let trimmed = line.trim();
        // Look for basic target definitions: "target:" or "target: deps"
        if trimmed.starts_with('#') || trimmed.starts_with('.') || !trimmed.contains(':') {
            continue;
        }

        if let Some((target, _)) = trimmed.split_once(':') {
            let target = target.trim();
            // Valid target name without spaces or variables
            if !target.is_empty()
                && !target.contains(' ')
                && !target.contains('$')
                && !target.contains('%')
                && !target.starts_with('_')
            {
                let default_selected = matches!(
                    target,
                    "dev" | "run" | "start" | "serve" | "server" | "watch" | "up"
                );
                out.push(DetectedCommand {
                    label: format!("make {target}"),
                    command: format!("make {target}"),
                    source: "Makefile".to_string(),
                    default_selected,
                });
            }
        }
    }
}

fn detect_python_commands(path: &Path, out: &mut Vec<DetectedCommand>) {
    if path.join("manage.py").is_file() {
        out.push(DetectedCommand {
            label: "django runserver".to_string(),
            command: "python manage.py runserver".to_string(),
            source: "manage.py".to_string(),
            default_selected: true,
        });
    }

    if path.join("pyproject.toml").is_file() || path.join("requirements.txt").is_file() {
        if path.join("poetry.lock").is_file() {
            out.push(DetectedCommand {
                label: "poetry run".to_string(),
                command: "poetry run python main.py".to_string(),
                source: "poetry.lock".to_string(),
                default_selected: false,
            });
        } else if path.join("uv.lock").is_file() {
            out.push(DetectedCommand {
                label: "uv run".to_string(),
                command: "uv run python main.py".to_string(),
                source: "uv.lock".to_string(),
                default_selected: false,
            });
        } else if path.join("main.py").is_file() {
            out.push(DetectedCommand {
                label: "python main.py".to_string(),
                command: "python main.py".to_string(),
                source: "main.py".to_string(),
                default_selected: true,
            });
        }
    }
}

fn detect_go_commands(path: &Path, out: &mut Vec<DetectedCommand>) {
    if !path.join("go.mod").is_file() {
        return;
    }

    out.push(DetectedCommand {
        label: "go run .".to_string(),
        command: "go run .".to_string(),
        source: "go.mod".to_string(),
        default_selected: true,
    });

    out.push(DetectedCommand {
        label: "go test ./...".to_string(),
        command: "go test ./...".to_string(),
        source: "go.mod".to_string(),
        default_selected: false,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn detects_non_existent_folder_safely() {
        let detected = detect_commands_in_folder(Path::new("/non/existent/path/12345"));
        assert!(detected.is_empty());
    }

    #[test]
    fn detects_node_package_json_with_pnpm() {
        let temp = TempDir::new().unwrap();
        let path = temp.path();

        fs::write(
            path.join("package.json"),
            r#"{"scripts": {"dev": "vite", "build": "vite build", "start": "vite preview"}}"#,
        )
        .unwrap();
        fs::write(path.join("pnpm-lock.yaml"), "").unwrap();

        let detected = detect_commands_in_folder(path);
        assert_eq!(detected.len(), 3);

        let dev = detected.iter().find(|c| c.label == "dev").unwrap();
        assert_eq!(dev.command, "pnpm run dev");
        assert!(dev.default_selected);

        let start = detected.iter().find(|c| c.label == "start").unwrap();
        assert_eq!(start.command, "pnpm start");
        assert!(start.default_selected);

        let build = detected.iter().find(|c| c.label == "build").unwrap();
        assert_eq!(build.command, "pnpm run build");
        assert!(!build.default_selected);
    }

    #[test]
    fn detects_cargo_toml() {
        let temp = TempDir::new().unwrap();
        let path = temp.path();
        fs::write(path.join("Cargo.toml"), "[package]\nname = \"demo\"").unwrap();

        let detected = detect_commands_in_folder(path);
        assert_eq!(detected.len(), 3);
        assert_eq!(detected[0].command, "cargo run");
        assert!(detected[0].default_selected);
    }

    #[test]
    fn detects_docker_compose() {
        let temp = TempDir::new().unwrap();
        let path = temp.path();
        fs::write(
            path.join("docker-compose.yml"),
            "version: '3'\nservices:\n  db:\n    image: postgres",
        )
        .unwrap();

        let detected = detect_commands_in_folder(path);
        assert_eq!(detected.len(), 2);
        assert_eq!(detected[0].command, "docker compose up");
        assert!(detected[0].default_selected);
    }

    #[test]
    fn detects_makefile_targets() {
        let temp = TempDir::new().unwrap();
        let path = temp.path();
        let makefile_content = r#"
.PHONY: all dev test clean

all:
	@echo all

dev:
	npm run dev

test:
	npm test
"#;
        fs::write(path.join("Makefile"), makefile_content).unwrap();

        let detected = detect_commands_in_folder(path);
        let labels: Vec<&str> = detected.iter().map(|c| c.label.as_str()).collect();
        assert!(labels.contains(&"make dev"));
        assert!(labels.contains(&"make test"));
        assert!(labels.contains(&"make all"));
    }
}
