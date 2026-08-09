// lib.rs — 库入口（Android/iOS 移动端使用，编译为 cdylib/staticlib）
// 桌面端 main.rs 调用 app_lib::run()

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use rusqlite::{params_from_iter, Connection};

// ── Constants ─────────────────────────────────────────────
const DB_FILENAME: &str = "workbuddy.db";
const DB_CONFIG_FILENAME: &str = "db_config.json";
const DATA_DIR_NAME: &str = "data";
const APP_IDENTIFIER: &str = "com.pdx.workbuddy";
const WRITE_TEST_FILE: &str = ".write_test";
const SDK_INVOCATION_PREFIX: &str = "workbench-invocation";
const SDK_REQUEST: &str = "attempt=1; max=1";
const USER_AGENT: &str = "rclone/v1.73.2";
const HTTP_TIMEOUT_SECS: u64 = 30;
const HTTP_CONNECT_TIMEOUT_SECS: u64 = 10;

/// 是否允许窗口真正关闭（由前端确认后通过 exit_app 置为 true）
static ALLOW_EXIT: AtomicBool = AtomicBool::new(false);

// ── Data directory helpers ─────────────────────────────────

fn get_data_dir() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;
    let data_dir = exe_dir.join(DATA_DIR_NAME);
    fs::create_dir_all(&data_dir).ok()?;
    Some(data_dir)
}

fn read_custom_db_config() -> Option<String> {
    let data_dir = get_data_dir()?;
    let config_file = data_dir.join(DB_CONFIG_FILENAME);
    if !config_file.exists() {
        return None;
    }
    let content = fs::read_to_string(&config_file).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let path = json.get("custom_db_path")?.as_str()?.to_string();
    if path.is_empty() {
        return None;
    }
    let db_path = PathBuf::from(&path);
    if let Some(parent) = db_path.parent() {
        if fs::create_dir_all(parent).is_ok() {
            let test_file = parent.join(WRITE_TEST_FILE);
            if fs::write(&test_file, "test").is_ok() {
                let _ = fs::remove_file(&test_file);
                return Some(path);
            }
        }
    }
    None
}

fn compute_db_url(app: &tauri::App) -> String {
    if let Some(custom_path) = read_custom_db_config() {
        let db_path = PathBuf::from(&custom_path);
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let path_str = custom_path.replace('\\', "/");
        eprintln!("[DB] 使用自定义数据库路径: {}", path_str);
        return format!("sqlite:{}", path_str);
    }

    if let Some(data_dir) = get_data_dir() {
        let db_path = data_dir.join(DB_FILENAME);
        if !db_path.exists() {
            if let Some(old_db) = get_old_db_path() {
                if old_db.exists() {
                    let _ = fs::copy(&old_db, &db_path);
                    eprintln!("[DB] 已从旧位置迁移数据库: {} -> {}", old_db.display(), db_path.display());
                }
            }
        }
        let test_file = data_dir.join(WRITE_TEST_FILE);
        if fs::write(&test_file, "test").is_ok() {
            let _ = fs::remove_file(&test_file);
            let path_str = db_path.to_string_lossy().replace('\\', "/");
            eprintln!("[DB] 数据库路径: {}", path_str);
            return format!("sqlite:{}", path_str);
        }
    }

    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });
    let data_dir = app_data_dir.join(DATA_DIR_NAME);
    let _ = fs::create_dir_all(&data_dir);
    let db_path = data_dir.join(DB_FILENAME);
    let path_str = db_path.to_string_lossy().replace('\\', "/");
    eprintln!("[DB] 回退到 AppData 目录: {}", path_str);
    format!("sqlite:{}", path_str)
}

#[cfg(target_os = "windows")]
fn get_old_db_path() -> Option<PathBuf> {
    let app_data = std::env::var("APPDATA").ok()?;
    Some(PathBuf::from(app_data).join(APP_IDENTIFIER).join(DB_FILENAME))
}

#[cfg(not(target_os = "windows"))]
fn get_old_db_path() -> Option<PathBuf> {
    None
}

// ── Path validation ────────────────────────────────────────

fn validate_local_dir(path: &Path) -> Result<PathBuf, String> {
    let path_str = path.to_string_lossy();
    if path_str.starts_with("\\\\") {
        return Err("不支持网络路径（UNC 路径）".to_string());
    }
    let canonical = path.canonicalize()
        .map_err(|e| format!("路径无法访问: {}", e))?;
    let canon_str = canonical.to_string_lossy();
    if canon_str.starts_with("\\\\") {
        return Err("不支持网络路径".to_string());
    }
    let windows_dir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
    if canonical.starts_with(&windows_dir) {
        return Err(format!("不允许将数据库放在系统目录 ({}) 中", windows_dir));
    }
    Ok(canonical)
}

// ── Tauri commands ─────────────────────────────────────────

#[tauri::command]
fn get_db_path(state: tauri::State<DbPathState>) -> String {
    state.path.to_string_lossy().to_string()
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let validated = validate_local_dir(&PathBuf::from(&path))
        .map_err(|e| format!("路径验证失败: {}", e))?;
    let path_str = validated.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    let cmd = "explorer";
    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(target_os = "linux")]
    let cmd = "xdg-open";
    std::process::Command::new(cmd)
        .arg(&path_str)
        .spawn()
        .map_err(|e| format!("打开文件夹失败: {}", e))?;
    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn open_folder(_path: String) -> Result<(), String> {
    Err("打开文件夹在 Android 上不支持".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

// Android fallback: rfd not available on mobile; use tauri-plugin-dialog or return None
#[cfg(target_os = "android")]
#[tauri::command]
fn pick_folder() -> Option<String> {
    eprintln!("[WARN] pick_folder is not supported on Android");
    None
}

#[tauri::command]
fn set_custom_db_path(new_dir: String, state: tauri::State<DbPathState>) -> Result<String, String> {
    let new_dir_path = PathBuf::from(&new_dir);
    let validated_dir = validate_local_dir(&new_dir_path)
        .map_err(|e| format!("目标路径无效: {}", e))?;
    fs::create_dir_all(&validated_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    let test_file = validated_dir.join(WRITE_TEST_FILE);
    fs::write(&test_file, "test")
        .map_err(|e| format!("目录无写权限: {}", e))?;
    let _ = fs::remove_file(&test_file);
    let new_db_path = validated_dir.join(DB_FILENAME);
    let current_db = PathBuf::from(state.path.as_path());
    if current_db.exists() {
        fs::copy(&current_db, &new_db_path)
            .map_err(|e| format!("复制数据库失败: {}", e))?;
        eprintln!("[DB] 已复制数据库: {} -> {}", current_db.display(), new_db_path.display());
    }
    let data_dir = get_data_dir().ok_or("无法获取 data 目录")?;
    let config_file = data_dir.join(DB_CONFIG_FILENAME);
    let config_json = serde_json::json!({
        "custom_db_path": new_db_path.to_string_lossy().replace('/', "\\")
    });
    let config_str = serde_json::to_string_pretty(&config_json)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&config_file, config_str)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    let new_path_str = new_db_path.to_string_lossy().replace('/', "\\");
    eprintln!("[DB] 自定义路径已设置: {}", new_path_str);
    Ok(new_path_str)
}

#[tauri::command]
fn reset_custom_db_path() -> Result<(), String> {
    let data_dir = get_data_dir().ok_or("无法获取 data 目录")?;
    let config_file = data_dir.join(DB_CONFIG_FILENAME);
    if config_file.exists() {
        fs::remove_file(&config_file)
            .map_err(|e| format!("删除配置文件失败: {}", e))?;
    }
    eprintln!("[DB] 已重置为默认数据库路径");
    Ok(())
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    eprintln!("[Tauri] 正在重启应用...");
    app.restart();
}

// ── DB write operations ────────────────────────────────────

fn sanitize_table(raw: &str) -> Option<String> {
    let t = raw
        .trim()
        .trim_matches('`')
        .trim_matches('"')
        .trim_matches('\'')
        .trim_matches('[')
        .trim_matches(']')
        .to_string();
    if t.is_empty() {
        return None;
    }
    if t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        Some(t)
    } else {
        None
    }
}

fn extract_table_token(rest: &str) -> String {
    let end = rest
        .find(|c: char| c.is_whitespace() || c == '(' || c == ';')
        .unwrap_or(rest.len());
    rest[..end].to_string()
}

fn json_to_sql(v: &serde_json::Value) -> Box<dyn rusqlite::ToSql> {
    match v {
        serde_json::Value::Null => Box::new(rusqlite::types::Null),
        serde_json::Value::Bool(b) => Box::new(*b as i64),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(u) = n.as_u64() {
                Box::new(i64::try_from(u).unwrap_or(i64::MAX))
            } else {
                Box::new(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(s) => Box::new(s.clone()),
        _ => Box::new(v.to_string()),
    }
}

#[tauri::command]
fn db_execute(
    state: tauri::State<DbPathState>,
    query: String,
    values: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("空 SQL 语句".to_string());
    }
    if q.contains(';') {
        return Err("不允许多条语句".to_string());
    }
    if q.contains("--") || q.contains("/*") || q.contains("*/") {
        return Err("不允许注释或复合语句".to_string());
    }

    let lower = q.to_lowercase();
    let (keyword, table_raw) = if let Some(rest) = lower.strip_prefix("insert into ") {
        ("INSERT", extract_table_token(rest.trim_start()))
    } else if let Some(rest) = lower.strip_prefix("update ") {
        ("UPDATE", extract_table_token(rest.trim_start()))
    } else if let Some(rest) = lower.strip_prefix("delete from ") {
        ("DELETE", extract_table_token(rest.trim_start()))
    } else {
        return Err("只允许 INSERT / UPDATE / DELETE 操作".to_string());
    };

    let table = sanitize_table(&table_raw)
        .ok_or_else(|| format!("非法表名: {}", table_raw))?;
    if table.starts_with("sqlite_") {
        return Err(format!("不允许操作系统表: {}", table));
    }

    let conn = Connection::open(&state.path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    let _ = conn.execute("PRAGMA journal_mode=WAL", ());

    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ? LIMIT 1",
            rusqlite::params![table],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !exists {
        return Err(format!("表不存在，拒绝写入: {}", table));
    }

    let params: Vec<Box<dyn rusqlite::ToSql>> = values.iter().map(json_to_sql).collect();
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| b.as_ref()).collect();

    let rows_affected = conn
        .execute(q, params_from_iter(param_refs))
        .map_err(|e| format!("执行失败: {}", e))?;
    let last_insert_id = conn.last_insert_rowid();

    eprintln!("[DB] {} {} rows_affected={}", keyword, table, rows_affected);
    Ok(serde_json::json!([rows_affected, last_insert_id]))
}

// ── S3 Cloud Sync ──────────────────────────────────────────

use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

const S3_CONFIG_FILENAME: &str = "s3_config.json";

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct S3Config {
    endpoint: String,
    bucket: String,
    access_key: String,
    secret_key: String,
    region: String,
}

fn read_s3_config() -> Option<S3Config> {
    let data_dir = get_data_dir()?;
    let config_file = data_dir.join(S3_CONFIG_FILENAME);
    if !config_file.exists() {
        return None;
    }
    let content = fs::read_to_string(&config_file).ok()?;
    let config: S3Config = serde_json::from_str(&content).ok()?;
    if config.endpoint.is_empty() || config.access_key.is_empty() {
        return None;
    }
    Some(config)
}

#[tauri::command]
fn save_s3_config(
    endpoint: String,
    bucket: String,
    access_key: String,
    secret_key: String,
    region: String,
) -> Result<(), String> {
    let config = S3Config {
        endpoint,
        bucket,
        access_key,
        secret_key,
        region: if region.is_empty() { "us-east-1".to_string() } else { region },
    };
    let data_dir = get_data_dir().ok_or("无法获取 data 目录")?;
    let config_file = data_dir.join(S3_CONFIG_FILENAME);
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&config_file, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    eprintln!("[S3] 配置已保存到后端文件");
    Ok(())
}

#[tauri::command]
fn get_s3_config_status() -> Option<serde_json::Value> {
    let config = read_s3_config()?;
    Some(serde_json::json!({
        "endpoint": config.endpoint,
        "bucket": config.bucket,
        "accessKey": config.access_key,
        "region": config.region,
        "hasSecretKey": !config.secret_key.is_empty(),
    }))
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut mac = HmacSha256::new_from_slice(key)
        .map_err(|e| format!("HMAC key error: {}", e))?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn hmac_sha256_hex(key: &[u8], data: &[u8]) -> Result<String, String> {
    hmac_sha256(key, data).map(|v| hex::encode(v))
}

fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .connect_timeout(std::time::Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client build error: {}", e))
}

fn build_s3_auth(
    method: &str,
    url: &str,
    access_key: &str,
    secret_key: &str,
    region: &str,
    payload: Option<&str>,
    canonical_querystring: &str,
) -> Result<(String, String, String, String), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("URL parse error: {}", e))?;
    if parsed.scheme() != "https" {
        return Err("仅支持 HTTPS 端点".to_string());
    }
    let host = parsed.host_str().ok_or("Invalid host")?;
    let host_with_port = if let Some(port) = parsed.port() {
        format!("{}:{}", host, port)
    } else {
        host.to_string()
    };
    let now = chrono::Utc::now();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = now.format("%Y%m%d").to_string();
    let payload_str = payload.unwrap_or("");
    let payload_hash = sha256_hex(payload_str.as_bytes());
    let canonical_uri = parsed.path().to_string();
    let accept_encoding = "identity";
    let amz_sdk_invocation_id = format!("{}-{}", SDK_INVOCATION_PREFIX, Uuid::new_v4().as_simple());
    let canonical_headers = format!(
        "accept-encoding:{}\namz-sdk-invocation-id:{}\namz-sdk-request:{}\nhost:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n",
        accept_encoding, amz_sdk_invocation_id, SDK_REQUEST, host_with_port, payload_hash, amz_date
    );
    let signed_headers = "accept-encoding;amz-sdk-invocation-id;amz-sdk-request;host;x-amz-content-sha256;x-amz-date";
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        method, canonical_uri, canonical_querystring, canonical_headers, signed_headers, payload_hash
    );
    let credential_scope = format!("{}/{}/s3/aws4_request", date_stamp, region);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        amz_date,
        credential_scope,
        sha256_hex(canonical_request.as_bytes())
    );
    let k_date = hmac_sha256(format!("AWS4{}", secret_key).as_bytes(), date_stamp.as_bytes())?;
    let k_region = hmac_sha256(&k_date, region.as_bytes())?;
    let k_service = hmac_sha256(&k_region, b"s3")?;
    let k_signing = hmac_sha256(&k_service, b"aws4_request")?;
    let signature = hmac_sha256_hex(&k_signing, string_to_sign.as_bytes())?;
    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        access_key, credential_scope, signed_headers, signature
    );
    Ok((authorization, amz_date, payload_hash, amz_sdk_invocation_id))
}

fn add_s3_headers(request: reqwest::RequestBuilder, host: &str, auth: &str, date: &str, payload_hash: &str, invocation_id: &str) -> reqwest::RequestBuilder {
    request
        .header("Authorization", auth)
        .header("X-Amz-Date", date)
        .header("X-Amz-Content-Sha256", payload_hash)
        .header("Host", host)
        .header("Accept-Encoding", "identity")
        .header("Amz-Sdk-Invocation-Id", invocation_id)
        .header("Amz-Sdk-Request", SDK_REQUEST)
        .header("User-Agent", USER_AGENT)
}

#[tauri::command]
async fn s3_upload(object_key: String, data: String,) -> Result<String, String> {
    let config = read_s3_config().ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
    let url = format!("{}/{}/{}", config.endpoint.trim_end_matches('/'), config.bucket, object_key);
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL parse error: {}", e))?;
    let host = parsed.host_str().ok_or("Invalid host")?;
    let host_with_port = if let Some(port) = parsed.port() {
        format!("{}:{}", host, port)
    } else {
        host.to_string()
    };
    let (auth, date, payload_hash, invocation_id) = build_s3_auth("PUT", &url, &config.access_key, &config.secret_key, &config.region, Some(&data), "")?;
    let client = build_http_client()?;
    let resp = add_s3_headers(client.put(&url), &host_with_port, &auth, &date, &payload_hash, &invocation_id)
        .body(data)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if resp.status().is_success() {
        Ok("OK".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn s3_download(object_key: String,) -> Result<String, String> {
    let config = read_s3_config().ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
    let url = format!("{}/{}/{}", config.endpoint.trim_end_matches('/'), config.bucket, object_key);
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL parse error: {}", e))?;
    let host = parsed.host_str().ok_or("Invalid host")?;
    let host_with_port = if let Some(port) = parsed.port() {
        format!("{}:{}", host, port)
    } else {
        host.to_string()
    };
    let (auth, date, payload_hash, invocation_id) = build_s3_auth("GET", &url, &config.access_key, &config.secret_key, &config.region, None, "")?;
    let client = build_http_client()?;
    let resp = add_s3_headers(client.get(&url), &host_with_port, &auth, &date, &payload_hash, &invocation_id)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if resp.status().is_success() {
        resp.text().await.map_err(|e| format!("Read body failed: {}", e))
    } else if resp.status().as_u16() == 404 {
        Err("NOT_FOUND".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn s3_test() -> Result<String, String> {
    let config = read_s3_config().ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
    let url = format!("{}/{}?max-keys=1000&prefix=", config.endpoint.trim_end_matches('/'), config.bucket);
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL parse error: {}", e))?;
    let host = parsed.host_str().ok_or("Invalid host")?;
    let host_with_port = if let Some(port) = parsed.port() {
        format!("{}:{}", host, port)
    } else {
        host.to_string()
    };
    let (auth, date, payload_hash, invocation_id) = build_s3_auth("GET", &url, &config.access_key, &config.secret_key, &config.region, None, "max-keys=1000&prefix=")?;
    let client = build_http_client()?;
    let request_builder = add_s3_headers(client.get(&url), &host_with_port, &auth, &date, &payload_hash, &invocation_id);
    let req = request_builder.build().map_err(|e| format!("Build request error: {}", e))?;
    let resp = client
        .execute(req)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if resp.status().is_success() {
        Ok("OK".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        eprintln!("[S3_TEST] status={} body={}", status, body);
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    eprintln!("[Tauri] 正在退出应用...");
    ALLOW_EXIT.store(true, Ordering::SeqCst);
    if let Some(wv) = app.get_webview_window("main") {
        let _ = wv.eval(
            "try { if(window.commitSave) window.commitSave(); } catch(e){} setTimeout(function(){}, 500);"
        );
    }
    std::thread::sleep(std::time::Duration::from_millis(300));
    app.exit(0);
}

// ── State ──────────────────────────────────────────────────

struct DbPathState {
    path: PathBuf,
}

// ── Public entry point (used by both main.rs and Android lib) ─

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create xiuxian module tables",
            sql: include_str!("../migrations/003_xiuxian.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if !ALLOW_EXIT.load(Ordering::SeqCst) {
                    api.prevent_close();
                    if let Some(wv) = window.get_webview_window("main") {
                        let _ = wv.set_focus();
                        let _ = wv.eval(
                            "if (window.__onCloseRequested) { window.__onCloseRequested(); }",
                        );
                    }
                }
            }
        })
        .setup(|app| {
            let db_url = compute_db_url(app);
            let db_path = db_url.strip_prefix("sqlite:").unwrap_or(&db_url).replace('/', "\\");

            let sql_plugin = tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build();
            app.handle().plugin(sql_plugin)?;

            if let Some(window) = app.get_webview_window("main") {
                let db_path_json = serde_json::to_string(&db_path).unwrap_or_else(|_| "\"\"".to_string());
                let js = format!(
                    "window.__IS_TAURI_APP__ = true;\nwindow.__TAURI_DB_PATH__ = {};",
                    db_path_json
                );
                let _ = window.eval(&js);
            }

            app.manage(DbPathState {
                path: PathBuf::from(&db_path),
            });

            eprintln!("[Tauri] App setup complete, DB URL: {}", db_url);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_db_path,
            set_custom_db_path,
            reset_custom_db_path,
            restart_app,
            open_folder,
            pick_folder,
            save_s3_config,
            get_s3_config_status,
            s3_upload,
            s3_download,
            s3_test,
            exit_app,
            db_execute
        ])
        .run(tauri::generate_context!())
        .expect("启动失败");
}
