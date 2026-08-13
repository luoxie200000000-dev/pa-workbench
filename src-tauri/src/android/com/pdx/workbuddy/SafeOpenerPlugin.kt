package com.pdx.workbuddy

import android.app.Activity
import android.content.Intent
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

// 安全打开应用私有目录里的文件（规避裸 file:// 触发 Android 7+ StrictMode 杀进程 → 整 App 闪退）。
//
// 注意：这里【不使用】@TauriPlugin / @Command 注解。原因是 Tauri v2 的 register_android_plugin
// 在运行时直接 new 出本类（而非注解处理器生成的子类），注解生成的命令分发根本不会被挂上，
// 导致 safeOpen 永远“找不到命令”。改为手写 onInvoke 分发后，命令 100% 可用，且不再依赖
// 注解处理器是否对注入的 Kotlin 生效。
class SafeOpenerPlugin(private val activity: Activity) : Plugin(activity) {

    // 命令参数：用标准 parseArgs（基于 Gson 反射，无需 @InvokeArg 注解，也不需要注解处理器）
    class SafeOpenArgs {
        var path: String = ""
    }

    override fun onInvoke(invoke: Invoke) {
        when (invoke.command) {
            "safeOpen" -> safeOpen(invoke)
            else -> invoke.reject("未知命令: ${invoke.command}")
        }
    }

    private fun safeOpen(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SafeOpenArgs::class.java)
            val path = args.path ?: ""
            if (path.isEmpty()) {
                invoke.reject("缺少 path 参数")
                return
            }
            val src = File(path)
            if (!src.exists() || !src.isFile) {
                invoke.reject("文件不存在")
                return
            }

            // workbench 文件存放在应用私有 files 目录（app_data_dir 之下）。
            // 直接以裸 file:// 打开会触发 Android 7+ 的 StrictMode penaltyDeath，
            // 导致整个进程被系统杀死（整 App 闪退）；而 Tauri 默认 FileProvider 只声明了
            // external-path / cache-path，并不包含私有 files 目录。这里先把文件复制到
            // 「内部缓存目录」（落在 cache-path 根内），再经 FileProvider 转成 content://
            // 并带 MIME 调起系统应用，从而既不被杀进程、又能正常共享给 WPS 等 App。
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
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "打开失败")
        }
    }
}
