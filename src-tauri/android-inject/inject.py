#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""注入自定义 FileProvider Kotlin 插件到 Tauri 2 Android 工程。

解决问题:
  - Android 7+ 禁止把私有目录 file:// URI 透给外部 Intent.ACTION_VIEW
    （FileUriExposedException，导致 App 杀进程）。
  - 提供微信式 Intent.createChooser "更多打开方式"系统选择器。

执行内容:
  1. 复制 FileProviderPlugin.kt -> gen/.../java/<package>/FileProviderPlugin.kt
  2. 复制 file_paths.xml      -> gen/.../res/xml/file_paths.xml
  3. 合并 provider-snippet.xml -> AndroidManifest.xml（</application> 之前）
  4. (兜底) 在 app/build.gradle.kts 加 androidx.core:core-ktx 依赖

健壮性:
  - 全部 utf-8
  - 多次运行不重复注入（基于 sentinel "FILE_PROVIDER_PATHS" 检测）
  - 任意步骤出错立即 sys.exit(1)，由 CI set -e 捕获为失败
"""

from __future__ import annotations

import pathlib
import re
import sys


HERE = pathlib.Path(__file__).resolve()
WORKBENCH = HERE.parents[2]
ANDROID_MAIN = WORKBENCH / "src-tauri" / "gen" / "android" / "app" / "src" / "main"
INJECT_DIR = WORKBENCH / "src-tauri" / "android-inject"

# Tauri 2 default Android applicationId（来自 src-tauri/tauri.conf.json identifier）。
# provider authorities 必须与此拼接匹配; Kotlin 类里用 activity.packageName 动态取
# package, 启动时也以 manifest declared authorities 校验, 两者必须一致.
APP_ID = "com.pdx.workbuddy"

# Kotlin 文件路径（java/<package-as-path>/）
KOTLIN_PKG_AS_PATH = pathlib.PurePosixPath("com/pdx/workbuddy/fileprovider")


def _log(tag: str, msg: str) -> None:
    print(f"[inject:{tag}] {msg}", flush=True)


def inject_kotlin_and_xml() -> None:
    java_dir = ANDROID_MAIN / "java" / KOTLIN_PKG_AS_PATH
    res_dir = ANDROID_MAIN / "res" / "xml"
    java_dir.mkdir(parents=True, exist_ok=True)
    res_dir.mkdir(parents=True, exist_ok=True)
    (java_dir / "FileProviderPlugin.kt").write_bytes(
        (INJECT_DIR / "FileProviderPlugin.kt").read_bytes()
    )
    (res_dir / "file_paths.xml").write_text(
        (INJECT_DIR / "file_paths.xml").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    _log("kotlin", str(java_dir / "FileProviderPlugin.kt"))
    _log("xml", str(res_dir / "file_paths.xml"))


def inject_manifest_provider() -> None:
    manifest = ANDROID_MAIN / "AndroidManifest.xml"
    text = manifest.read_text(encoding="utf-8")
    if "FILE_PROVIDER_PATHS" in text:
        _log("manifest", "provider already present, skip")
        return
    if "</application>" not in text:
        print(
            "[inject:manifest] ERROR: </application> not found, manifest format unexpected",
            file=sys.stderr,
        )
        sys.exit(1)
    snippet = (INJECT_DIR / "provider-snippet.xml").read_text(encoding="utf-8").strip()
    # snippet 里已固定使用 ${APP_ID}.fileprovider（如有差异可在此 replace）
    new_text = text.replace("</application>", snippet + "\n    </application>", 1)
    manifest.write_text(new_text, encoding="utf-8")
    _log("manifest", "provider injected into AndroidManifest.xml")


def ensure_androidx_core_dep() -> None:
    gradle = WORKBENCH / "src-tauri" / "gen" / "android" / "app" / "build.gradle.kts"
    g = gradle.read_text(encoding="utf-8")
    if "androidx.core:core" in g:
        _log("gradle", "androidx.core already present")
        return
    if "dependencies {" not in g:
        print(
            f"[inject:gradle] ERROR: 'dependencies {{' not found in {gradle}",
            file=sys.stderr,
        )
        sys.exit(1)
    g2 = re.sub(
        r"(dependencies\s*\{)",
        r'\1\n    implementation("androidx.core:core-ktx:1.13.1")',
        g,
        count=1,
    )
    gradle.write_text(g2, encoding="utf-8")
    _log("gradle", "androidx.core:core-ktx:1.13.1 added")


def main() -> int:
    if not ANDROID_MAIN.exists():
        print(
            f"[inject] ERROR: {ANDROID_MAIN} not found. "
            "Run `npx tauri android init` first.",
            file=sys.stderr,
        )
        return 1
    inject_kotlin_and_xml()
    inject_manifest_provider()
    ensure_androidx_core_dep()
    _log("done", "OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
