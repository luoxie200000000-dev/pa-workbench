// main.rs — 桌面端入口（Windows/macOS/Linux）
// 实际逻辑在 lib.rs::run() 中，Android/iOS 也共用同一套

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run()
}
