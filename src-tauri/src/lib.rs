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

// 安卓文件打开：自定义 FileProvider 插件的句柄。
// setup 时注册 Kotlin 插件并存入，file_open 安卓分支取出后调 run_mobile_plugin 触发
// 微信式"选择应用打开"系统选择器。模式与 Tauri 官方 path 插件一致。
#[cfg(target_os = "android")]
struct FileProviderHandle(tauri::plugin::PluginHandle<tauri::Wry>);

// ── Data directory helpers ─────────────────────────────────

fn get_data_dir(app: &impl Manager<tauri::Wry>) -> Option<PathBuf> {
    // 桌面优先：exe 同级 data 目录（保持现有 Windows 用户数据位置不变，避免"搬家"导致旧数据丢失）
    if let Some(exe_dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf())) {
        let data_dir = exe_dir.join(DATA_DIR_NAME);
        if fs::create_dir_all(&data_dir).is_ok() {
            return Some(data_dir);
        }
    }
    // 移动端 / 拿不到 exe 路径时回退：AppData（桌面）或应用私有目录（Android/iOS），均可写
    if let Ok(app_data) = app.path().app_data_dir() {
        let data_dir = app_data.join(DATA_DIR_NAME);
        if fs::create_dir_all(&data_dir).is_ok() {
            return Some(data_dir);
        }
    }
    None
}

fn read_custom_db_config(app: &impl Manager<tauri::Wry>) -> Option<String> {
    let data_dir = get_data_dir(app)?;
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
    if let Some(custom_path) = read_custom_db_config(app) {
        let db_path = PathBuf::from(&custom_path);
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let path_str = custom_path.replace('\\', "/");
        eprintln!("[DB] 使用自定义数据库路径: {}", path_str);
        return format!("sqlite:{}", path_str);
    }

    if let Some(data_dir) = get_data_dir(app) {
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
fn set_custom_db_path(app: tauri::AppHandle, new_dir: String, state: tauri::State<DbPathState>) -> Result<String, String> {
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
    let data_dir = get_data_dir(&app).ok_or("无法获取 data 目录")?;
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
fn reset_custom_db_path(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = get_data_dir(&app).ok_or("无法获取 data 目录")?;
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

/// S3 配置文件的真实路径。
/// 关键：Android 上 get_data_dir() 因 current_exe() 父目录只读而返回 None，
/// 故改用 app.path().app_config_dir()（所有平台均可写且稳定）。
fn s3_config_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    let base = app.path().app_config_dir().ok()?;
    let dir = base.join(DATA_DIR_NAME);
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join(S3_CONFIG_FILENAME))
}

/// 读取 S3 配置：优先新位置(app_config_dir)，回退旧位置(exe 同级 data 目录)，兼容桌面历史配置。
fn read_s3_config(app: &tauri::AppHandle) -> Option<S3Config> {
    let path = s3_config_file(app)
        .or_else(|| {
            let d = get_data_dir(app)?;
            Some(d.join(S3_CONFIG_FILENAME))
        })?;
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(&path).ok()?;
    let config: S3Config = serde_json::from_str(&content).ok()?;
    if config.endpoint.is_empty() || config.access_key.is_empty() {
        return None;
    }
    Some(config)
}

#[tauri::command]
fn save_s3_config(
    app: tauri::AppHandle,
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
    let config_file = s3_config_file(&app).ok_or("无法获取配置目录")?;
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&config_file, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    eprintln!("[S3] 配置已保存到 {:?}", config_file);
    Ok(())
}

#[tauri::command]
fn get_s3_config_status(app: tauri::AppHandle) -> Option<serde_json::Value> {
    let config = read_s3_config(&app)?;
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
    hmac_sha256(key, data).map(hex::encode)
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
async fn s3_upload(app: tauri::AppHandle, object_key: String, data: String,) -> Result<String, String> {
    let config = read_s3_config(&app).ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
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
async fn s3_download(app: tauri::AppHandle, object_key: String,) -> Result<String, String> {
    let config = read_s3_config(&app).ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
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
async fn s3_test(app: tauri::AppHandle) -> Result<String, String> {
    let config = read_s3_config(&app).ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
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
fn write_file(path: String, content: String) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);
    if let Some(parent) = path_buf.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&path_buf, &content)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    eprintln!("[FS] 文件已保存: {}", path);
    Ok(path)
}

// ── 05 文件夹（应用数据目录内的真实文件树） ────────────────────
// 所有路径严格限定在 <data_dir>/folders 之下，绝不越界到系统其他位置。

fn folders_root_static(app: &impl Manager<tauri::Wry>) -> Result<PathBuf, String> {
    let data_dir = get_data_dir(app).ok_or("无法获取 data 目录")?;
    let root = data_dir.join("folders");
    fs::create_dir_all(&root)
        .map_err(|e| format!("创建文件夹根目录失败: {}", e))?;
    Ok(root)
}

/// 把相对路径解析为 folders 内的绝对路径，并校验未越界。
fn resolve_in_folders(root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let rel_path = rel_path.trim().trim_matches('/').trim_matches('\\');
    let target = if rel_path.is_empty() {
        root.to_path_buf()
    } else {
        root.join(rel_path)
    };
    let canon = target.canonicalize().unwrap_or_else(|_| target.clone());
    let root_canon = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    if canon != root_canon && !canon.starts_with(&root_canon) {
        return Err("路径越界：不允许访问 folders 目录之外".to_string());
    }
    Ok(canon)
}

/// 校验单段名称合法（防穿越），配合 resolve_in_folders 双保险。
fn sanitize_name(name: &str) -> Result<String, String> {
    let n = name.trim();
    if n.is_empty() {
        return Err("名称不能为空".to_string());
    }
    if n == "." || n == ".."
        || n.contains("..") || n.contains('/') || n.contains('\\') {
        return Err("名称包含非法字符".to_string());
    }
    Ok(n.to_string())
}

#[derive(serde::Serialize)]
struct FolderEntry {
    name: String,
    is_dir: bool,
    size: u64,
    mtime: i64,
    ext: String,
}

#[derive(serde::Serialize)]
struct FolderListing {
    rel_path: String,
    entries: Vec<FolderEntry>,
}

#[tauri::command]
fn folder_list(app: tauri::AppHandle, rel_path: String) -> Result<FolderListing, String> {
    let root = folders_root_static(&app)?;
    let dir = resolve_in_folders(&root, &rel_path)?;
    let mut entries: Vec<FolderEntry> = Vec::new();
    let read = fs::read_dir(&dir).map_err(|e| format!("读取目录失败: {}", e))?;
    for entry in read {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let meta = match entry.metadata() { Ok(m) => m, Err(_) => continue };
        let is_dir = meta.is_dir();
        let (size, ext) = if is_dir {
            (0u64, String::new())
        } else {
            let ext = path.extension()
                .map(|e| e.to_string_lossy().to_string().to_lowercase())
                .unwrap_or_default();
            (meta.len(), ext)
        };
        let mtime = meta.modified().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        entries.push(FolderEntry { name, is_dir, size, mtime, ext });
    }
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir { b.is_dir.cmp(&a.is_dir) }
        else { a.name.cmp(&b.name) }
    });
    Ok(FolderListing { rel_path, entries })
}

#[derive(serde::Serialize)]
struct SearchResult {
    name: String,
    is_dir: bool,
    size: u64,
    mtime: i64,
    ext: String,
    rel_path: String,  // 相对于搜索根目录的路径，用 / 分隔（如 "子文件夹/文件.pdf"）
}

/// 递归搜索：在当前层级及所有子文件夹中搜索名称匹配的文件/文件夹。
/// 最大深度 10 层，防止过深目录树导致性能问题。
#[tauri::command]
fn folder_search(app: tauri::AppHandle, rel_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let root = folders_root_static(&app)?;
    let base_dir = resolve_in_folders(&root, &rel_path)?;
    let query_lower = query.to_lowercase();
    if query_lower.is_empty() {
        return Ok(Vec::new());
    }
    let mut results: Vec<SearchResult> = Vec::new();

    fn search_dir(dir: &Path, base: &Path, query: &str, results: &mut Vec<SearchResult>, depth: u32) {
        if depth > 10 { return; }
        let read = match fs::read_dir(dir) { Ok(r) => r, Err(_) => return };
        for entry in read {
            let entry = match entry { Ok(e) => e, Err(_) => continue };
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let meta = match entry.metadata() { Ok(m) => m, Err(_) => continue };
            let is_dir = meta.is_dir();
            if name.to_lowercase().contains(query) {
                let (size, ext) = if is_dir {
                    (0u64, String::new())
                } else {
                    let ext = path.extension()
                        .map(|e| e.to_string_lossy().to_string().to_lowercase())
                        .unwrap_or_default();
                    (meta.len(), ext)
                };
                let mtime = meta.modified().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                let rel = path.strip_prefix(base)
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|_| name.clone());
                results.push(SearchResult { name, is_dir, size, mtime, ext, rel_path: rel });
            }
            if is_dir {
                search_dir(&path, base, query, results, depth + 1);
            }
        }
    }

    search_dir(&base_dir, &base_dir, &query_lower, &mut results, 0);
    results.sort_by(|a, b| {
        if a.is_dir != b.is_dir { b.is_dir.cmp(&a.is_dir) }
        else { a.name.cmp(&b.name) }
    });
    Ok(results)
}

#[tauri::command]
fn folder_create(app: tauri::AppHandle, rel_path: String, name: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let child = parent.join(sanitize_name(&name)?);
    if child.exists() {
        return Err(if child.is_dir() {
            "同名文件夹已存在".to_string()
        } else {
            "已存在同名文件".to_string()
        });
    }
    fs::create_dir_all(&child)
        .map_err(|e| format!("创建文件夹失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn item_rename(app: tauri::AppHandle, rel_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let src = parent.join(sanitize_name(&old_name)?);
    let dst = parent.join(sanitize_name(&new_name)?);
    if !src.exists() { return Err("源项目不存在".to_string()); }
    if dst.exists() { return Err("目标名称已存在".to_string()); }
    fs::rename(&src, &dst).map_err(|e| format!("重命名失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn item_delete(app: tauri::AppHandle, rel_path: String, name: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let target = parent.join(sanitize_name(&name)?);
    if !target.exists() { return Err("目标不存在".to_string()); }
    if target.is_dir() { fs::remove_dir_all(&target) } else { fs::remove_file(&target) }
        .map_err(|e| format!("删除失败: {}", e))?;
    Ok(())
}

// ── 批量删除：forEach 调与 item_delete 相同的递归删除，返回成功删除数 ──
#[tauri::command]
fn item_delete_many(app: tauri::AppHandle, rel_path: String, names: Vec<String>) -> Result<u32, String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let mut count: u32 = 0;
    let mut failed: Vec<String> = Vec::new();
    for name in names {
        let target = parent.join(sanitize_name(&name)?);
        if !target.exists() { continue; }
        let res = if target.is_dir() { fs::remove_dir_all(&target) } else { fs::remove_file(&target) };
        match res {
            Ok(_) => count += 1,
            Err(e) => failed.push(format!("删除「{}」失败: {}", name, e)),
        }
    }
    if !failed.is_empty() {
        return Err(failed.join("；"));
    }
    Ok(count)
}

#[tauri::command]
fn item_move(app: tauri::AppHandle, rel_src: String, name: String, rel_dst: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let src_parent = resolve_in_folders(&root, &rel_src)?;
    let dst_parent = resolve_in_folders(&root, &rel_dst)?;
    let name = sanitize_name(&name)?;
    let src = src_parent.join(&name);
    let dst = dst_parent.join(&name);
    if !src.exists() { return Err("源项目不存在".to_string()); }
    if dst.exists() { return Err("目标位置已存在同名项目".to_string()); }
    // 防穿越：不能把项目移动到自身或其子目录内部（会造成失败/混乱）。
    let src_canon = fs::canonicalize(&src).map_err(|e| format!("路径解析失败: {}", e))?;
    let dst_parent_canon = fs::canonicalize(&dst_parent).map_err(|e| format!("路径解析失败: {}", e))?;
    if dst_parent_canon.starts_with(&src_canon) {
        return Err("不能移动到自身内部".to_string());
    }
    fs::rename(&src, &dst).map_err(|e| format!("移动失败: {}", e))?;
    Ok(())
}

// ── 复制：递归复制文件/文件夹，目标同名时自动加「 - 副本」后缀 ──
fn copy_tree(src: &Path, dst: &Path) -> Result<(), String> {
    if src.is_dir() {
        fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;
        for entry in fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
            let e = entry.map_err(|e| format!("读取目录失败: {}", e))?;
            let p = e.path();
            copy_tree(&p, &dst.join(e.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dst).map_err(|e| format!("复制失败: {}", e))?;
        Ok(())
    }
}

// 目标已存在同名时生成「name - 副本」「name - 副本 (2)」… 避免覆盖
fn unique_copy_name(dst_parent: &Path, base: &str) -> PathBuf {
    let cand = dst_parent.join(base);
    if !cand.exists() { return cand; }
    let (stem, ext) = match base.rfind('.') {
        Some(i) if i > 0 => (base[..i].to_string(), base[i..].to_string()),
        _ => (base.to_string(), String::new()),
    };
    let mut n: u32 = 1;
    loop {
        let nm = if n == 1 {
            format!("{} - 副本{}", stem, ext)
        } else {
            format!("{} - 副本 ({}){}", stem, n, ext)
        };
        let c = dst_parent.join(nm);
        if !c.exists() { return c; }
        n += 1;
    }
}

#[tauri::command]
fn item_copy(app: tauri::AppHandle, rel_src: String, name: String, rel_dst: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let src_parent = resolve_in_folders(&root, &rel_src)?;
    let dst_parent = resolve_in_folders(&root, &rel_dst)?;
    let name = sanitize_name(&name)?;
    let src = src_parent.join(&name);
    if !src.exists() { return Err("源项目不存在".to_string()); }
    // 防穿越：不能把文件夹复制到自身内部（会造成无限递归）
    let src_canon = fs::canonicalize(&src).map_err(|e| format!("路径解析失败: {}", e))?;
    let dst_canon = fs::canonicalize(&dst_parent).map_err(|e| format!("路径解析失败: {}", e))?;
    if dst_canon.starts_with(&src_canon) {
        return Err("不能复制到自身内部".to_string());
    }
    let dst = unique_copy_name(&dst_parent, &name);
    if src.is_dir() {
        copy_tree(&src, &dst)?;
    } else {
        fs::copy(&src, &dst).map_err(|e| format!("复制失败: {}", e))?;
    }
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn pick_files() -> Option<Vec<String>> {
    rfd::FileDialog::new()
        .pick_files()
        .map(|v| v.iter().map(|p| p.to_string_lossy().to_string()).collect())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn pick_files() -> Option<Vec<String>> { None }

#[tauri::command]
fn import_files(app: tauri::AppHandle, paths: Vec<String>, rel_dst: String) -> Result<u32, String> {
    let root = folders_root_static(&app)?;
    let dst_dir = resolve_in_folders(&root, &rel_dst)?;
    fs::create_dir_all(&dst_dir)
        .map_err(|e| format!("创建目标目录失败: {}", e))?;
    let mut count: u32 = 0;
    for p in paths {
        let src = PathBuf::from(&p);
        if !src.exists() { continue; }
        let name = match src.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };
        // 同名不覆盖：文件/文件夹都自动加「 - 副本」后缀（拖入/上传更安全）
        let dst = unique_copy_name(&dst_dir, &name);
        if src.is_file() {
            fs::copy(&src, &dst)
                .map_err(|e| format!("复制 {} 失败: {}", name, e))?;
        } else if src.is_dir() {
            copy_tree(&src, &dst)
                .map_err(|e| format!("复制文件夹 {} 失败: {}", name, e))?;
        } else {
            continue;
        }
        count += 1;
    }
    Ok(count)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn file_open(app: tauri::AppHandle, rel_path: String, name: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let target = parent.join(sanitize_name(&name)?);
    if !target.is_file() { return Err("文件不存在".to_string()); }
    let path_str = target.to_string_lossy().to_string();
    // 桌面：用 opener 调起系统默认程序打开（跨平台一致，避免 cmd/start 异常闪退）。
    app.opener().open_path(path_str, None::<&str>).map_err(|e| format!("打开失败: {}", e))
}

#[derive(serde::Serialize)]
struct FileProps {
    name: String,
    is_dir: bool,
    size_bytes: u64,
    mtime: i64,
    ext: String,
    full_path: String,
    rel_path: String,
}

/// 查询文件/文件夹属性，含完整存储位置（用于「属性」弹窗）。
#[tauri::command]
fn file_props(app: tauri::AppHandle, rel_path: String, name: String) -> Result<FileProps, String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let target = parent.join(sanitize_name(&name)?);
    let meta = fs::metadata(&target).map_err(|e| format!("读取失败: {}", e))?;
    let is_dir = meta.is_dir();
    let size_bytes = if is_dir { 0u64 } else { meta.len() };
    let mtime = meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let ext = target.extension()
        .map(|e| e.to_string_lossy().to_string().to_lowercase())
        .unwrap_or_default();
    let full_path = target.to_string_lossy().to_string();
    let rel = if rel_path.is_empty() { name.clone() } else { format!("{}/{}", rel_path, name) };
    Ok(FileProps { name, is_dir, size_bytes, mtime, ext, full_path, rel_path: rel })
}

/// 在系统文件管理器中定位文件（桌面：资源管理器/Finder 高亮；
/// 移动端没有可供定位的系统文件管理器，改为用安全方式打开文件，避免裸 file:// 触发 StrictMode 杀进程）。
#[tauri::command]
fn file_reveal(app: tauri::AppHandle, rel_path: String, name: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let target = parent.join(sanitize_name(&name)?);
    if !target.exists() { return Err("文件不存在".to_string()); }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener().reveal_item_in_dir(&target).map_err(|e| format!("定位失败: {}", e))
    }
    #[cfg(target_os = "android")]
    {
        if target.is_dir() {
            return Err("移动端暂不支持在系统文件管理器中定位文件夹".to_string());
        }
        // Android 没有像 Windows 资源管理器那样"高亮定位文件"的系统文件管理器，
        // 改为与 file_open 一致：通过 FileProviderPlugin 用 content:// URI + 系统选择器打开文件。
        let path_str = target.to_string_lossy().to_string();
        let handle = app.state::<FileProviderHandle>().inner().0.clone();
        handle
            .run_mobile_plugin::<()>("openWithChooser", serde_json::json!({ "path": path_str }))
            .map_err(|e| format!("打开失败: {}", e))
    }
}

#[cfg(target_os = "android")]
#[tauri::command]
fn file_open(app: tauri::AppHandle, rel_path: String, name: String) -> Result<(), String> {
    let root = folders_root_static(&app)?;
    let parent = resolve_in_folders(&root, &rel_path)?;
    let target = parent.join(sanitize_name(&name)?);
    if !target.is_file() { return Err("文件不存在".to_string()); }
    let path_str = target.to_string_lossy().to_string();
    // 通过自定义 FileProvider 插件触发系统选择器（微信式"选择应用打开"）。
    // content:// URI + FLAG_GRANT_READ_URI_PERMISSION 规避 Android 7+ FileUriExposedException。
    let handle = app.state::<FileProviderHandle>().inner().0.clone();
    handle
        .run_mobile_plugin::<()>("openWithChooser", serde_json::json!({ "path": path_str }))
        .map_err(|e| format!("打开失败: {}", e))
}

// Android 专用：dialog 选中的文件是 content:// URI，std::fs 读不了；
// 但 dialog 已把它加入 tauri-plugin-fs 的 scope，故用 app.fs().read() 读取后写入应用目录。
#[cfg(target_os = "android")]
#[tauri::command]
fn import_file_from_uri(app: tauri::AppHandle, uri: String, name: String, rel_dst: String) -> Result<u32, String> {
    use tauri_plugin_fs::{FsExt, FilePath};
    use std::str::FromStr;
    let fp = FilePath::from_str(&uri).map_err(|e| format!("无效路径: {}", e))?;
    let bytes = app.fs().read(fp).map_err(|e| format!("读取文件失败: {}", e))?;
    let root = folders_root_static(&app)?;
    let dst_dir = resolve_in_folders(&root, &rel_dst)?;
    std::fs::create_dir_all(&dst_dir).map_err(|e| format!("创建目标目录失败: {}", e))?;
    let dst = unique_copy_name(&dst_dir, &sanitize_name(&name)?);
    std::fs::write(&dst, &bytes).map_err(|e| format!("写入失败: {}", e))?;
    Ok(1)
}

// ── 文件夹云同步（复用 S3 签名逻辑，文件以二进制 PUT，不经过 JS 层） ──

async fn s3_put_bytes(app: &tauri::AppHandle, key: &str, bytes: &[u8]) -> Result<(), String> {
    let config = read_s3_config(app).ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
    let url = format!("{}/{}/{}", config.endpoint.trim_end_matches('/'), config.bucket, key);
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL parse error: {}", e))?;
    if parsed.scheme() != "https" { return Err("仅支持 HTTPS 端点".to_string()); }
    let host = parsed.host_str().ok_or("Invalid host")?;
    let host_with_port = if let Some(port) = parsed.port() {
        format!("{}:{}", host, port)
    } else { host.to_string() };
    let now = chrono::Utc::now();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = now.format("%Y%m%d").to_string();
    let payload_hash = sha256_hex(bytes);
    let canonical_uri = parsed.path().to_string();
    let inv_id = format!("{}-{}", SDK_INVOCATION_PREFIX, Uuid::new_v4().as_simple());
    let canonical_headers = format!(
        "accept-encoding:identity\namz-sdk-invocation-id:{}\namz-sdk-request:{}\nhost:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n",
        inv_id, SDK_REQUEST, host_with_port, payload_hash, amz_date
    );
    let signed_headers = "accept-encoding;amz-sdk-invocation-id;amz-sdk-request;host;x-amz-content-sha256;x-amz-date";
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        "PUT", canonical_uri, "", canonical_headers, signed_headers, payload_hash
    );
    let credential_scope = format!("{}/{}/s3/aws4_request", date_stamp, config.region);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        amz_date, credential_scope, sha256_hex(canonical_request.as_bytes())
    );
    let k_date = hmac_sha256(format!("AWS4{}", config.secret_key).as_bytes(), date_stamp.as_bytes())?;
    let k_region = hmac_sha256(&k_date, config.region.as_bytes())?;
    let k_service = hmac_sha256(&k_region, b"s3")?;
    let k_signing = hmac_sha256(&k_service, b"aws4_request")?;
    let signature = hmac_sha256_hex(&k_signing, string_to_sign.as_bytes())?;
    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        config.access_key, credential_scope, signed_headers, signature
    );
    let client = build_http_client()?;
    let resp = add_s3_headers(client.put(&url), &host_with_port, &authorization, &amz_date, &payload_hash, &inv_id)
        .body(bytes.to_vec())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if resp.status().is_success() { Ok(()) } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("HTTP {}: {}", status, body))
    }
}

fn collect_rel_files(root: &Path, dir: &Path, out: &mut Vec<String>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let path = entry.path();
        if path.is_dir() {
            collect_rel_files(root, &path, out)?;
        } else {
            let rel = path.strip_prefix(root)
                .map_err(|_| "路径处理失败".to_string())?
                .to_string_lossy().replace('\\', "/");
            out.push(rel);
        }
    }
    Ok(())
}

#[tauri::command]
async fn folder_cloud_push(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = folders_root_static(&app)?;
    let mut rels: Vec<String> = Vec::new();
    collect_rel_files(&root, &root, &mut rels)?;
    let mut uploaded: u32 = 0;
    let mut oversize: u32 = 0;
    for rel in rels {
        let path = root.join(&rel);
        // 防御：跳过超大文件（>100MB），避免一次性读入内存导致 OOM
        if let Ok(meta) = fs::metadata(&path) {
            if meta.len() > 100 * 1024 * 1024 {
                eprintln!("[Cloud] 跳过超大文件(>100MB): {}", rel);
                oversize += 1;
                continue;
            }
        }
        let bytes = fs::read(&path).map_err(|e| format!("读取 {} 失败: {}", rel, e))?;
        let key = format!("folders/{}", rel.replace('\\', "/"));
        s3_put_bytes(&app, &key, &bytes).await?;
        uploaded += 1;
    }
    Ok(serde_json::json!({ "uploaded": uploaded, "oversize_skipped": oversize }))
}

fn parse_s3_keys(xml: &str) -> Vec<String> {
    let mut keys = Vec::new();
    let mut start = 0;
    while let Some(i) = xml[start..].find("<Key>") {
        let abs = start + i + 5;
        if let Some(j) = xml[abs..].find("</Key>") {
            keys.push(xml[abs..abs + j].to_string());
            start = abs + j + 6;
        } else { break; }
    }
    keys
}

#[tauri::command]
async fn folder_cloud_pull(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let config = read_s3_config(&app).ok_or("S3 配置未设置，请先在云同步面板保存配置")?;
    let base = format!("{}/{}", config.endpoint.trim_end_matches('/'), config.bucket);
    let prefix = "folders%2F";
    let list_url = format!("{}?list-type=2&prefix={}", base, prefix);
    let parsed = reqwest::Url::parse(&list_url).map_err(|e| format!("URL parse error: {}", e))?;
    let host = parsed.host_str().ok_or("Invalid host")?;
    let host_with_port = if let Some(p) = parsed.port() {
        format!("{}:{}", host, p)
    } else { host.to_string() };
    let (auth, date, payload_hash, inv_id) = build_s3_auth(
        "GET", &list_url, &config.access_key, &config.secret_key, &config.region, None,
        &format!("list-type=2&prefix={}", prefix),
    )?;
    let client = build_http_client()?;
    let resp = add_s3_headers(client.get(&list_url), &host_with_port, &auth, &date, &payload_hash, &inv_id)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("列举对象失败 HTTP {}: {}", status, body));
    }
    let xml = resp.text().await.map_err(|e| format!("读取列表失败: {}", e))?;
    let keys = parse_s3_keys(&xml);
    let root = folders_root_static(&app)?;
    let mut downloaded: u32 = 0;
    let mut oversize: u32 = 0;
    for key in keys {
        if !key.starts_with("folders/") { continue; }
        let url = format!("{}/{}", base, key);
        let (auth2, date2, ph2, inv2) = build_s3_auth(
            "GET", &url, &config.access_key, &config.secret_key, &config.region, None, "",
        )?;
        let resp2 = add_s3_headers(client.get(&url), &host_with_port, &auth2, &date2, &ph2, &inv2)
            .send()
            .await
            .map_err(|e| format!("下载 {} 失败: {}", key, e))?;
        if !resp2.status().is_success() { continue; }
        // 防御：超大对象(>100MB)跳过，避免整块读入内存 OOM
        if let Some(len) = resp2.content_length() {
            if len > 100 * 1024 * 1024 {
                eprintln!("[Cloud] 跳过超大对象(>100MB): {}", key);
                oversize += 1;
                continue;
            }
        }
        let bytes = resp2.bytes().await.map_err(|e| format!("读取 {} 失败: {}", key, e))?;
        let rel = key.trim_start_matches("folders/");
        if rel.is_empty() { continue; } // 跳过 "folders/" 这类目录标记
        // 防御路径穿越：拒绝含 .. 或绝对路径片段的 key（lexical starts_with 无法识别 ..，必须显式拦截）
        if rel.contains("..") || rel.starts_with('/') || rel.contains('\\') { continue; }
        let dst = root.join(rel);
        // 防御：落点必须仍在 folders 根目录内，避免 key 被构造出路径穿越
        if !dst.starts_with(&root) { continue; }
        if let Some(p) = dst.parent() { let _ = fs::create_dir_all(p); }
        if let Err(e) = fs::write(&dst, &bytes) {
            eprintln!("[Cloud] 写入 {} 失败，已跳过: {}", rel, e);
            continue;
        }
        downloaded += 1;
    }
    Ok(serde_json::json!({ "downloaded": downloaded, "oversize_skipped": oversize }))
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    eprintln!("[Tauri] 正在退出应用...");
    ALLOW_EXIT.store(true, Ordering::SeqCst);
    // 在子线程触发前端保存并最终退出，避免 std::thread::sleep 阻塞命令线程造成界面卡顿
    let app2 = app.clone();
    std::thread::spawn(move || {
        if let Some(wv) = app2.get_webview_window("main") {
            let _ = wv.eval(
                "try { if(window.commitSave) window.commitSave(); } catch(e){}"
            );
        }
        // 给前端留出同步保存时间（原 300ms 阻塞主路径，现已移出命令线程）
        std::thread::sleep(std::time::Duration::from_millis(150));
        app2.exit(0);
    });
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

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // 必须注册 opener 插件：桌面端 file_open / file_reveal 走 app.opener()，
        // 其底层依赖本插件在 setup 时注入的 Opener<R> 状态；不注册会导致
        // self.state::<Opener<R>>() 找不到 state 而直接失败（文件打不开/定位不了）。
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("fileprovider")
                .setup(|app, api| {
                    #[cfg(not(target_os = "android"))]
                    let _ = (&app, &api);
                    #[cfg(target_os = "android")]
                    {
                        let handle = api
                            .register_android_plugin("com.pdx.workbuddy.fileprovider", "FileProviderPlugin")
                            .map_err(|e| format!("注册 fileprovider 安卓插件失败: {}", e))?;
                        app.manage(FileProviderHandle(handle));
                    }
                    Ok(())
                })
                .build(),
        );
    builder
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
            // 关键：前端用 Database.load("sqlite:workbuddy.db") 打开数据库。
            // tauri-plugin-sql 按「URL 字符串精确匹配」决定是否执行迁移，
            // 且 sqlite:<X> 会被解析到 <app_config_dir>/<X>。因此迁移注册 key
            // 必须与前端加载的 URL 完全一致，否则前端实际打开的库永远建不了表
            // （表现：列表为空、保存无效）。
            let migrations_db_url = "sqlite:workbuddy.db";

            let sql_plugin = tauri_plugin_sql::Builder::default()
                .add_migrations(migrations_db_url, migrations)
                .build();
            app.handle().plugin(sql_plugin)?;

            // 计算插件实际会把 sqlite:workbuddy.db 解析成的绝对文件路径，
            // 让 db_execute（所有写操作）与前端读取落在同一个文件上。
            let app_config = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
            let actual_db_path = app_config.join("workbuddy.db");
            let actual_db_path_str = actual_db_path.to_string_lossy().replace('\\', "/");

            // 保留旧版数据库迁移的副作用（桌面端），不影响 Android。
            let _legacy_db_url = compute_db_url(app);

            if let Some(window) = app.get_webview_window("main") {
                // 前端 Database.load 必须使用与迁移注册 key 完全一致的相对 URL，
                // 否则插件解析出的文件路径与迁移 key 不匹配 → 建表脚本永不执行。
                let db_url_json = serde_json::to_string("sqlite:workbuddy.db")
                    .unwrap_or_else(|_| "\"sqlite:workbuddy.db\"".to_string());
                let js = format!(
                    "window.__IS_TAURI_APP__ = true;\nwindow.__TAURI_DB_PATH__ = {};",
                    db_url_json
                );
                let _ = window.eval(&js);
            }

            app.manage(DbPathState {
                path: PathBuf::from(&actual_db_path_str),
            });

            eprintln!("[Tauri] App setup complete, DB file: {}", actual_db_path_str);
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
            db_execute,
            write_file,
            folder_list,
            folder_search,
            folder_create,
            item_rename,
            item_delete,
            item_delete_many,
            item_move,
            item_copy,
            pick_files,
            import_files,
            file_open,
            file_props,
            file_reveal,
            #[cfg(target_os = "android")]
            import_file_from_uri,
            folder_cloud_push,
            folder_cloud_pull
        ])
        .run(tauri::generate_context!())
        .expect("启动失败");
}
