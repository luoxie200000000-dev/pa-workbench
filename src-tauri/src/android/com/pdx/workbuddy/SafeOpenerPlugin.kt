package com.pdx.workbuddy

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class SafeOpenArgs {
    lateinit var path: String
}

/**
 * 安全打开手机私有目录里的文件。
 * 根因：Tauri opener 的 open_path 在 Android 上用裸 file:// 路径 + 不带 MIME 调起
 * Intent.ACTION_VIEW，遇到手机没有对应 App 或私有目录不可读时，Android 的 StrictMode
 * 会以 penaltyDeath 直接杀进程（整 App 闪退），Kotlin try/catch 和前端 catch 都拦不住。
 *
 * 这里改用 FileProvider 把私有文件转成 content://（带临时读权限 + MIME），
 * 并先 resolveActivity 预检手机有没有能打开的 App。任何异常都被 catch 转为 reject，
 * 绝不直接崩进程。
 */
@TauriPlugin
class SafeOpenerPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun safeOpen(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SafeOpenArgs::class.java)
            val file = File(args.path)
            if (!file.exists() || !file.isFile) {
                invoke.reject("文件不存在")
                return
            }
            // Tauri Android 项目通常已声明 ${applicationId}.fileprovider 的 FileProvider。
            val authority = activity.packageName + ".fileprovider"
            val uri = FileProvider.getUriForFile(activity, authority, file)
            val ext = if (file.extension.isEmpty()) "" else file.extension.lowercase()
            val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "*/*"
            val intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(uri, mime)
            // 授权目标 App 临时读取这个 content://（私有目录其他 App 原本读不了）
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val pm = activity.packageManager
            if (intent.resolveActivity(pm) == null) {
                invoke.reject("手机上未找到可打开此文件的应用，请先安装对应程序（如 WPS 办公）后再试")
                return
            }
            activity.startActivity(intent)
            invoke.resolve()
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "打开失败")
        }
    }
}
