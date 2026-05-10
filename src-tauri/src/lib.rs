use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct DiceRequest {
    pub count: u32,
    pub sides: u32,
    pub modifier: i32,
}

#[derive(Debug, Serialize)]
pub struct DiceResponse {
    pub rolls: Vec<u32>,
    pub subtotal: u32,
    pub total: i32,
}

#[tauri::command]
fn roll_dice(request: DiceRequest) -> Result<DiceResponse, String> {
    if request.count == 0 || request.count > 100 {
        return Err("Count must be between 1 and 100".into());
    }
    if request.sides < 2 || request.sides > 1000 {
        return Err("Sides must be between 2 and 1000".into());
    }
    let mut rng = rand::thread_rng();
    let rolls: Vec<u32> = (0..request.count)
        .map(|_| rng.gen_range(1..=request.sides))
        .collect();
    let subtotal: u32 = rolls.iter().sum();
    let total = subtotal as i32 + request.modifier;
    Ok(DiceResponse { rolls, subtotal, total })
}

#[tauri::command]
fn load_config(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    fs::read_to_string(&p).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn save_config(path: String, data: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&p, data).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            roll_dice,
            load_config,
            save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}