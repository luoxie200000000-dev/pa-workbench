use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};

const SDK_INVOCATION_PREFIX: &str = "workbench-invocation";
const SDK_REQUEST: &str = "attempt=1; max=1";
const USER_AGENT: &str = "rclone/v1.73.2";

type HmacSha256 = Hmac<Sha256>;

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key error");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn build_s3_auth(
    method: &str,
    url: &str,
    access_key: &str,
    secret_key: &str,
    region: &str,
    payload: Option<&str>,
    canonical_querystring: &str,
) -> (String, String, String, String) {
    let parsed = reqwest::Url::parse(url).expect("URL parse error");
    let host = parsed.host_str().expect("Invalid host");
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
    let amz_sdk_invocation_id = format!("{}-{}", SDK_INVOCATION_PREFIX, uuid::Uuid::new_v4().as_simple());
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

    let k_date = hmac_sha256(format!("AWS4{}", secret_key).as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, b"s3");
    let k_signing = hmac_sha256(&k_service, b"aws4_request");
    let signature_bytes = hmac_sha256(&k_signing, string_to_sign.as_bytes());
    let signature = hex::encode(signature_bytes);

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        access_key, credential_scope, signed_headers, signature
    );

    (authorization, amz_date, payload_hash, amz_sdk_invocation_id)
}

#[tokio::main]
async fn main() {
    let endpoint = "https://s3.cstcloud.cn";
    let bucket = "b6720ca87e994c2dbf3c8d2e86f39216";
    // 密钥改为从环境变量读取，避免硬编码泄露（原明文已移除）
    let access_key = match std::env::var("S3_ACCESS_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => {
            eprintln!("[s3_debug] 未设置环境变量 S3_ACCESS_KEY，无法运行调试");
            std::process::exit(2);
        }
    };
    let secret_key = match std::env::var("S3_SECRET_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => {
            eprintln!("[s3_debug] 未设置环境变量 S3_SECRET_KEY，无法运行调试");
            std::process::exit(2);
        }
    };
    let region = std::env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());

    let url = format!("{}/{}?max-keys=1000&prefix=", endpoint, bucket);
    let parsed = reqwest::Url::parse(&url).unwrap();
    let host = parsed.host_str().unwrap();
    let host_with_port = host.to_string();
    let (auth, date, payload_hash, invocation_id) = build_s3_auth(
        "GET", &url, &access_key, &secret_key, &region, None, "max-keys=1000&prefix="
    );

    println!("URL: {}", url);
    println!("Parsed path: {:?}", parsed.path());
    println!("Host: {}", host_with_port);
    println!("Authorization: {}", auth);
    println!("X-Amz-Date: {}", date);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap();

    let resp = client
        .get(&url)
        .header("Authorization", auth)
        .header("X-Amz-Date", date)
        .header("X-Amz-Content-Sha256", payload_hash)
        .header("Host", &host_with_port)
        .header("Accept-Encoding", "identity")
        .header("Amz-Sdk-Invocation-Id", invocation_id)
        .header("Amz-Sdk-Request", SDK_REQUEST)
        .header("User-Agent", USER_AGENT)
        .send()
        .await;

    match resp {
        Ok(r) => {
            let status = r.status();
            let body = r.text().await.unwrap_or_default();
            println!("Status: {}", status);
            println!("Body: {}", &body[..body.len().min(500)]);
        }
        Err(e) => {
            println!("Request failed: {}", e);
        }
    }
}
