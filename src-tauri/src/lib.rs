use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::{AppHandle, Manager};

const APP_FOLDER: &str = "Diplomaker";
const PROJECTS_FOLDER: &str = "Proyectos";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopProjectSnapshot {
    file_name: String,
    path: String,
    modified: u64,
    contents: String,
}

fn projects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let documents = app.path().document_dir().map_err(|error| error.to_string())?;
    let directory = documents.join(APP_FOLDER).join(PROJECTS_FOLDER);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn safe_fragment(value: &str, fallback: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut previous_separator = false;
    for character in value.chars() {
        let mapped = if character.is_alphanumeric() {
            previous_separator = false;
            Some(character)
        } else if !previous_separator {
            previous_separator = true;
            Some('_')
        } else {
            None
        };
        if let Some(character) = mapped {
            output.push(character);
        }
    }
    let output = output.trim_matches('_').chars().take(90).collect::<String>();
    if output.is_empty() { fallback.to_string() } else { output }
}

fn project_suffix(project_id: &str) -> String {
    format!("--{}.diplomaker", safe_fragment(project_id, "project"))
}

fn is_project_file(path: &Path) -> bool {
    path.extension().and_then(|extension| extension.to_str()) == Some("diplomaker")
}

#[tauri::command]
fn sync_project_file(
    app: AppHandle,
    project_id: String,
    project_name: String,
    contents: String,
) -> Result<String, String> {
    serde_json::from_str::<serde_json::Value>(&contents)
        .map_err(|error| format!("El proyecto no contiene JSON válido: {error}"))?;

    let directory = projects_dir(&app)?;
    let suffix = project_suffix(&project_id);
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.ends_with(&suffix)) {
            let _ = fs::remove_file(path);
        }
    }

    let file_name = format!("{}{}", safe_fragment(&project_name, "Proyecto_Diplomaker"), suffix);
    let target = directory.join(file_name);
    let temporary = target.with_extension("diplomaker.tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    if target.exists() {
        fs::remove_file(&target).map_err(|error| error.to_string())?;
    }
    fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn load_project_snapshots(app: AppHandle) -> Result<Vec<DesktopProjectSnapshot>, String> {
    let directory = projects_dir(&app)?;
    let mut snapshots = Vec::new();
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !is_project_file(&path) {
            continue;
        }
        let contents = match fs::read_to_string(&path) {
            Ok(contents) => contents,
            Err(_) => continue,
        };
        if serde_json::from_str::<serde_json::Value>(&contents).is_err() {
            continue;
        }
        let modified = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or_default();
        snapshots.push(DesktopProjectSnapshot {
            file_name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            modified,
            contents,
        });
    }
    snapshots.sort_by(|left, right| right.modified.cmp(&left.modified));
    Ok(snapshots)
}

#[tauri::command]
fn delete_project_snapshot(app: AppHandle, project_id: String) -> Result<(), String> {
    let directory = projects_dir(&app)?;
    let suffix = project_suffix(&project_id);
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.ends_with(&suffix)) {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn projects_directory(app: AppHandle) -> Result<String, String> {
    Ok(projects_dir(&app)?.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_project_names_without_losing_unicode_letters() {
        assert_eq!(safe_fragment("Jornada de Género 2026", "Proyecto"), "Jornada_de_Género_2026");
        assert_eq!(safe_fragment("  Mesa / Federal : JxJ  ", "Proyecto"), "Mesa_Federal_JxJ");
    }

    #[test]
    fn uses_fallback_for_empty_or_symbol_only_names() {
        assert_eq!(safe_fragment("***", "Proyecto_Diplomaker"), "Proyecto_Diplomaker");
        assert_eq!(safe_fragment("", "project"), "project");
    }

    #[test]
    fn limits_file_name_fragments() {
        let value = "a".repeat(140);
        assert_eq!(safe_fragment(&value, "Proyecto").chars().count(), 90);
    }

    #[test]
    fn creates_stable_project_suffixes() {
        assert_eq!(project_suffix("project-123/456"), "--project_123_456.diplomaker");
    }

    #[test]
    fn recognizes_only_diplomaker_project_files() {
        assert!(is_project_file(Path::new("Proyecto.diplomaker")));
        assert!(!is_project_file(Path::new("Proyecto.json")));
        assert!(!is_project_file(Path::new("Proyecto.diplomaker.tmp")));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            sync_project_file,
            load_project_snapshots,
            delete_project_snapshot,
            projects_directory
        ])
        .setup(|app| {
            let _ = projects_dir(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Diplomaker");
}
