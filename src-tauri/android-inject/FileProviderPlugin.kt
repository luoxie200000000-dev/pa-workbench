package com.pdx.workbuddy.fileprovider

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

/**
 * 自定义 Android 插件：FileProvider 安全打开 + 系统选择器（微信式"更多打开方式"）。
 *
 * 解决的问题：
 * 1. Android 7+ FileUriExposedException：禁止把 /data/data/<pkg>/ 下的 file:// URI
 *    透给外部 App。这里用 androidx.core.content.FileProvider 把私有路径转成
 *    content://com.pdx.workbuddy.fileprovider/... 并加 FLAG_GRANT_READ_URI_PERMISSION。
 * 2. 微信式"更多打开方式"：用 Intent.createChooser 列出所有能处理该 MIME 的应用。
 *
 * 注：Tauri 2.x 命令参数通过 @InvokeArg 类 + invoke.parseArgs(...) 获取，
 * 旧式 invoke.getString(...) 在 2.x 稳定版已移除（见官方 develop-mobile 文档）。
 */

@InvokeArg
internal class OpenWithChooserArgs {
    lateinit var path: String
}

@TauriPlugin
class FileProviderPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun openWithChooser(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(OpenWithChooserArgs::class.java)
            val rawPath = args.path
            val file = File(rawPath)
            if (!file.exists()) {
                invoke.reject("文件不存在: $rawPath")
                return
            }
            val authority = activity.packageName + ".fileprovider"
            val uri = FileProvider.getUriForFile(activity, authority, file)
            val mime = guessMime(file)
            val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            // 微信式系统选择器：列出所有能处理该 MIME 的应用
            val chooser = Intent.createChooser(viewIntent, "选择应用打开").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(chooser)
            invoke.resolve(JSObject())
        } catch (e: Exception) {
            invoke.reject("打开失败: " + (e.message ?: "未知错误"))
        }
    }

    /** 简单按扩展名猜 MIME；不识别时用 octet-stream 兜底 */
    private fun guessMime(file: File): String {
        val name = file.name.lowercase()
        return when {
            name.endsWith(".pdf") -> "application/pdf"
            name.endsWith(".doc") -> "application/msword"
            name.endsWith(".docx") -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            name.endsWith(".xls") -> "application/vnd.ms-excel"
            name.endsWith(".xlsx") -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            name.endsWith(".ppt") -> "application/vnd.ms-powerpoint"
            name.endsWith(".pptx") -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            name.endsWith(".jpg") || name.endsWith(".jpeg") -> "image/jpeg"
            name.endsWith(".png") -> "image/png"
            name.endsWith(".gif") -> "image/gif"
            name.endsWith(".webp") -> "image/webp"
            name.endsWith(".bmp") -> "image/bmp"
            name.endsWith(".svg") -> "image/svg+xml"
            name.endsWith(".txt") -> "text/plain"
            name.endsWith(".html") || name.endsWith(".htm") -> "text/html"
            name.endsWith(".csv") -> "text/csv"
            name.endsWith(".json") -> "application/json"
            name.endsWith(".xml") -> "application/xml"
            name.endsWith(".mp4") -> "video/mp4"
            name.endsWith(".mov") -> "video/quicktime"
            name.endsWith(".mkv") -> "video/x-matroska"
            name.endsWith(".mp3") -> "audio/mpeg"
            name.endsWith(".wav") -> "audio/wav"
            name.endsWith(".zip") -> "application/zip"
            name.endsWith(".rar") -> "application/vnd.rar"
            name.endsWith(".7z") -> "application/x-7z-compressed"
            else -> "application/octet-stream"
        }
    }
}
