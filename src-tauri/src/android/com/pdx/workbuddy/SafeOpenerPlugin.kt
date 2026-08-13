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
class SafeOpenArgs { lateinit var path: String }

@TauriPlugin
class SafeOpenerPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun safeOpen(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SafeOpenArgs::class.java)
            val src = File(args.path)
            if (!src.exists() || !src.isFile) { invoke.reject("文件不存在"); return }

            // workbench 文件存放在应用私有 files 目录（app_data_dir 之下）。
            // 直接以裸 file:// 打开会触发 Android 7+ 的 StrictMode penaltyDeath，
            // 导致整个进程被系统杀死（整 App 闪退）；而 Tauri 默认 FileProvider 只声明了
            // external-path / cache-path，并不包含私有 files 目录，因此也不能直接
            // getUriForFile 原文件。这里先把文件复制到「内部缓存目录」（落在 cache-path 根内），
            // 再经 FileProvider 转成 content:// 并带 MIME 调起系统应用，从而既不被杀进程、
            // 又能正常共享给 WPS 等App。
            val cacheDir = activity.cacheDir
            val tmp = File(cacheDir, "safe_open_" + System.currentTimeMillis() + "_" + src.name)
            // 清理上次遗留的临时副本，避免缓存无限增长
            cacheDir.listFiles()?.forEach { f ->
                if (f.name.startsWith("safe_open_") && f != tmp) f.delete()
            }
            src.copyTo(tmp, overwrite = true)

            val authority = activity.packageName + ".fileprovider"
            val uri = FileProvider.getUriForFile(activity, authority, tmp)
            val ext = if (src.extension.isEmpty()) "" else src.extension.lowercase()
            val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "*/*"
            val intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(uri, mime)
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val pm = activity.packageManager
            if (intent.resolveActivity(pm) == null) {
                invoke.reject("手机上未找到可打开此文件的应用，请先安装对应程序（如 WPS 办公）后再试")
                return
            }
            activity.startActivity(intent)
            invoke.resolve()
        } catch (ex: Exception) { invoke.reject(ex.message ?: "打开失败") }
    }
}
