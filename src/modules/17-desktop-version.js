/* ===================== Desktop Shortcut ===================== */
let pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwaInstallPrompt = e;
});

/* ===================== Real-time Clock & Online Status ===================== */
function updateRealTimeClock() {
  const now = new Date();
  const weekdays = ['日','一','二','三','四','五','六'];
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  if (timeEl) timeEl.textContent = `${h}:${m}:${s}`;
  if (dateEl) dateEl.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
}

function updateOnlineStatus() {
  const el = document.getElementById('onlineStatus');
  if (!el) return;
  const isOnline = navigator.onLine;
  el.className = 'online-status ' + (isOnline ? 'online' : 'offline');
  el.innerHTML = `<span class="dot"></span><span>${isOnline ? '在线' : '离线'}</span>`;
}

/* ===================== 版本管理 ===================== */

/* ===== 版本管理 - 通用辅助函数 ===== */

// 获取浏览器版文件所在文件夹路径（仅本地文件模式有效）
function _getBrowserFolderPath() {
  if (window.location.protocol === 'file:') {
    const p = decodeURIComponent(window.location.href.replace('file:///', '').replace(/\//g, '\\'));
    // 去掉文件名，只保留文件夹
    const lastSep = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
    return lastSep > 0 ? p.substring(0, lastSep) : p;
  }
  return null;
}

// 获取桌面版固定数据目录
function _getDesktopDataDir() {
  // 桌面版固定存储位置：用户文档/派大星教学工作台
  const platform = navigator.platform || '';
  if (platform.indexOf('Win') !== -1) {
    // Windows 默认文档路径
    return '文档\\派大星教学工作台';
  }
  return 'Documents/派大星教学工作台';
}

// 打开数据文件夹（Electron版打开文件夹，浏览器版复制路径）
function openDataFolder() {
  if (window.electronAPI && window.electronAPI.openDataFolder) {
    window.electronAPI.openDataFolder().then(function(result) {
      if (result.success) {
        showToast('已打开数据文件夹：' + result.path, 'success');
      } else {
        showToast('无法打开文件夹', 'error');
      }
    });
    return;
  }

  // 浏览器版：尝试打开文件所在文件夹
  let folderPath = _getBrowserFolderPath();
  if (folderPath) {
    // 复制路径到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(folderPath).then(function() {
        showToast('文件夹路径已复制：\n' + folderPath, 'success');
      }).catch(function() {
        showToast('文件夹路径：\n' + folderPath, 'info');
      });
    } else {
      showToast('文件夹路径：\n' + folderPath, 'info');
    }
  } else {
    showToast('浏览器版本使用 localStorage 存储，数据在浏览器内部，无法直接访问文件夹', 'info');
  }
}

// 创建桌面快捷方式
function createDesktopShortcut() {
  if (window.electronAPI && window.electronAPI.createDesktopShortcut) {
    window.electronAPI.createDesktopShortcut().then(function(result) {
      if (result.success) {
        showToast('✅ 桌面快捷方式已创建！', 'success');
      } else {
        showToast('创建快捷方式失败：' + (result.error || '未知错误'), 'error');
      }
    });
    return;
  }

  // 浏览器版：生成快捷方式创建脚本
  let folderPath = _getBrowserFolderPath();
  if (folderPath && folderPath.indexOf('教学工作台') !== -1) {
    const htmlPath = folderPath + '\\index.html';
    showToast('请通过桌面版安装脚本创建快捷方式，或手动将 index.html 发送到桌面', 'info');
  } else {
    showToast('请使用桌面版本（Electron）来创建桌面快捷方式', 'info');
  }
}

function showBrowserVersionSettings() {
  let key = STORAGE_KEY;
  let raw = localStorage.getItem(key) || '';
  const usedBytes = new Blob([raw]).size;
  let usedKB = (usedBytes / 1024).toFixed(1);
  const usedMB = (usedBytes / 1024 / 1024).toFixed(2);
  const totalMB = 5;
  const pct = Math.min(100, ((usedBytes / (totalMB * 1024 * 1024)) * 100)).toFixed(1);
  const isLocalFile = window.location.protocol === 'file:';
  const folderPath = _getBrowserFolderPath();

  // 固定存储位置：浏览器版数据在 localStorage 中，文件在工作台目录下
  let fixedStoragePath = (isLocalFile && folderPath) ? folderPath : '浏览器内部存储（localStorage）';

  openModal('<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
    '<span style="font-size:32px">🌐</span>' +
    '<div><h3 style="font-size:18px;font-weight:700;color:var(--text-heading)">浏览器版本</h3>' +
    '<p style="font-size:12px;color:var(--text-muted);margin-top:2px">查看和管理浏览器端数据存储</p></div>' +
    '<button class="btn-icon" data-click="closeModal" style="margin-left:auto">✕</button></div>' +

    '<div style="background:var(--bg-page);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-heading)">📊 存储状态</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">' +
    '<div><span style="color:var(--text-muted)">存储键名：</span><code style="background:var(--bg-card);padding:2px 6px;border-radius:3px">' + escapeHtml(key) + '</code></div>' +
    '<div><span style="color:var(--text-muted)">已用空间：</span><b>' + usedKB + ' KB</b>（' + usedMB + ' MB）</div>' +
    '<div><span style="color:var(--text-muted)">总容量：</span>' + totalMB + ' MB</div>' +
    '<div><span style="color:var(--text-muted)">使用率：</span><b style="color:' + (pct > 80 ? 'var(--danger)' : 'var(--success)') + '">' + pct + '%</b></div>' +
    '<div><span style="color:var(--text-muted)">运行方式：</span>' + (isLocalFile ? '📁 本地文件' : '🌍 网页服务器') + '</div>' +
    '<div><span style="color:var(--text-muted)">数据方式：</span>浏览器 localStorage</div>' +
    '</div>' +

    (folderPath ? '<div style="margin-top:10px;padding:10px;background:var(--bg-card);border-radius:6px;font-size:12px">' +
    '<span style="color:var(--text-muted)">📁 固定存储位置：</span><br>' +
    '<code style="background:var(--bg-page);padding:3px 8px;border-radius:3px;word-break:break-all;font-size:11px">' + escapeHtml(folderPath) + '</code>' +
    '</div>' : '') +

    '</div>' +

    '<div style="background:var(--bg-page);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-heading)">💡 如何使用</h4>' +
    '<div style="font-size:13px;color:var(--text-body);line-height:1.8">' +
    '<p>• 直接双击 <code style="background:var(--bg-card);padding:2px 6px;border-radius:3px">浏览器版/index.html</code> 文件即可打开</p>' +
    '<p>• 数据存储在浏览器的 localStorage 中，不同浏览器数据不共享</p>' +
    '<p>• 🏠 <b>固定存储位置</b>：所有数据保存在工作台文件夹下，换设备只需复制整个文件夹</p>' +
    '<p>• 换电脑或换浏览器后需通过云同步恢复数据</p>' +
    '<p>• 推荐使用 <b>Chrome</b> 或 <b>Edge</b> 浏览器获得最佳体验</p>' +
    '</div></div>' +

    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn btn-primary" data-click="__dcCommitSaveClose" style="flex:1">💾 立即保存</button>' +
    '<button class="btn btn-outline" data-click="openDataFolder" style="flex:1">📂 打开文件位置</button>' +
    '<button class="btn btn-outline" data-click="closeModal" style="flex:1">关闭</button>' +
    '</div>');
}

function showDesktopVersionSettings() {
  const isElectron = !!window.electronAPI;
  const key = STORAGE_KEY;
  const raw = localStorage.getItem(key) || '';
  const usedKB = (new Blob([raw]).size / 1024).toFixed(1);

  // 固定存储位置
  const fixedStoragePath = _getDesktopDataDir();
  const storagePathEl = 'desktop-data-path';

  openModal('<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
    '<span style="font-size:32px">💻</span>' +
    '<div><h3 style="font-size:18px;font-weight:700;color:var(--text-heading)">桌面版本</h3>' +
    '<p style="font-size:12px;color:var(--text-muted);margin-top:2px">' + (isElectron ? '✅ 当前运行在桌面应用中' : '像原生软件一样，数据独立存储在本地') + '</p></div>' +
    '<button class="btn-icon" data-click="closeModal" style="margin-left:auto">✕</button></div>' +

    '<div style="background:var(--bg-page);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-heading)">📊 运行状态</h4>' +
    '<div style="font-size:13px;color:var(--text-body);line-height:2">' +
    '<p><span style="color:var(--text-muted)">运行环境：</span>' + (isElectron ? 'Electron 桌面应用' : '浏览器（非桌面版）') + '</p>' +
    '<p><span style="color:var(--text-muted)">数据量：</span>' + usedKB + ' KB</p>' +
    '<p><span style="color:var(--text-muted)">存储键名：</span><code style="background:var(--bg-card);padding:2px 6px;border-radius:3px">' + escapeHtml(key) + '</code></p>' +
    '<p><span style="color:var(--text-muted)">📁 固定存储位置：</span><code style="background:var(--bg-card);padding:3px 8px;border-radius:3px;font-size:11px" id="' + storagePathEl + '">' + escapeHtml(fixedStoragePath) + '</code></p>' +
    '</div></div>' +

    (isElectron ? '' :
    '<div style="background:#E3F2FD;border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:#1565C0">💡 还没有桌面版？</h4>' +
    '<p style="font-size:13px;color:#1565C0;line-height:1.8;margin-bottom:12px">桌面版将工作台变成一个独立的桌面应用，双击即可启动，数据本地存储更安全。</p>' +
    '<div style="font-size:12px;color:#1565C0;line-height:1.8">' +
    '<p><b>三步安装，无需额外操作：</b></p>' +
    '<p>1. 打开文件夹：<code style="background:var(--bg-card);padding:2px 6px;border-radius:3px">桌面\\派大星教学工作台-源代码\\桌面应用版</code></p>' +
    '<p>2. 双击运行 <code style="background:var(--bg-card);padding:2px 6px;border-radius:3px">安装此应用.bat</code></p>' +
    '<p>3. 等待安装完成，桌面自动创建快捷方式 🎉</p>' +
    '<p style="margin-top:4px;color:var(--text-muted);font-size:11px">💡 脚本会自动安装所需环境，全程无需手动操作</p>' +
    '</div></div>') +

    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    (isElectron ? '<button class="btn btn-primary" data-click="createDesktopShortcut" style="flex:1">📌 创建桌面快捷方式</button>' : '') +
    '<button class="btn btn-outline" data-click="openDataFolder" style="flex:1">📂 打开数据文件夹</button>' +
    '<button class="btn btn-outline" data-click="closeModal" style="flex:1">关闭</button>' +
    '</div>');

  // 异步获取实际存储路径（Electron环境）
  if (isElectron && window.electronAPI.getDataPath) {
    window.electronAPI.getDataPath().then(function(p) {
      const el = document.getElementById(storagePathEl);
      if (el) el.textContent = p;
    });
  }
}

function showMobileVersionSettings() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;
  const canPWA = !!pwaInstallPrompt;
  const deviceType = isIOS ? (navigator.userAgent.indexOf('iPad') > -1 ? 'iPad' : 'iPhone') :
                   isAndroid ? 'Android' :
                   '桌面浏览器';

  // PWA 存储信息
  const storageInfo = '<div style="font-size:13px;color:var(--text-body);line-height:2">' +
    '<p><span style="color:var(--text-muted)">存储方式：</span>' + (isMobile ? '浏览器 IndexedDB + localStorage（PWA）' : '浏览器 localStorage') + '</p>' +
    '<p><span style="color:var(--text-muted)">📁 固定存储位置：</span>PWA 应用内部沙盒存储</p>' +
    '<p style="color:var(--text-muted);font-size:11px">💡 PWA 数据由浏览器管理，卸载浏览器或清除数据会丢失，建议定期导出备份</p>' +
    '</div>';

  let steps = '';
  if (isIOS) {
    steps = '<div style="line-height:2;font-size:13px">' +
      '<p><b>📱 iPhone/iPad 安装步骤：</b></p>' +
      '<p>1. 使用 <b>Safari 浏览器</b>打开工作台（⚠️ Chrome/Firefox 不支持）</p>' +
      '<p>2. 点击底部中间的 <b>分享按钮</b>（方框+向上箭头）</p>' +
      '<p>3. 滑动找到并点击 <b>"添加到主屏幕"</b></p>' +
      '<p>4. 点击右上角 <b>"添加"</b></p>' +
      '<p>5. 主屏幕出现 <b>"教学工作台"</b>图标，点击即可全屏使用</p>' +
      '<p style="color:var(--text-muted);margin-top:8px">✅ 安装后支持离线使用、全屏体验、像原生App一样流畅</p>' +
      '</div>';
  } else if (isAndroid) {
    steps = '<div style="line-height:2;font-size:13px">' +
      '<p><b>🤖 Android 安装步骤：</b></p>' +
      '<p>1. 使用 <b>Chrome 浏览器</b>打开工作台</p>' +
      '<p>2. 点击右上角 <b>菜单按钮（⋮）</b></p>' +
      '<p>3. 选择 <b>"添加到主屏幕"</b>或<b>"安装应用"</b></p>' +
      '<p>4. 在弹出窗口中点击 <b>"安装"</b></p>' +
      '<p>5. 桌面出现 <b>"教学工作台"</b>图标，点击即可全屏使用</p>' +
      '<p style="color:var(--text-muted);margin-top:8px">✅ 已支持PWA标准，安装后像原生App一样运行</p>' +
      '</div>';
  } else {
    steps = '<div style="line-height:2;font-size:13px">' +
      '<p><b>🖥️ 在电脑上预览/测试手机版：</b></p>' +
      '<p>1. 按 <b>F12</b> 打开开发者工具</p>' +
      '<p>2. 点击 <b>切换设备工具栏</b>图标（📱）或按 Ctrl+Shift+M</p>' +
      '<p>3. 选择 iPhone / iPad / Android 设备模拟</p>' +
      '<p>4. 即可预览手机/平板上的显示效果</p>' +
      '<p style="color:var(--text-muted);margin-top:8px">💡 真实手机上直接打开此页面，Chrome/Safari 会自动提示"添加到主屏幕"</p>' +
      '</div>';
  }

  let actionButtons = '';
  if (canPWA) {
    actionButtons = '<button class="btn btn-primary" data-click="triggerPWAInstall" style="flex:1">📲 一键安装到主屏幕</button>';
  }

  openModal('<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
    '<span style="font-size:32px">📱</span>' +
    '<div><h3 style="font-size:18px;font-weight:700;color:var(--text-heading)">手机/平板版本</h3>' +
    '<p style="font-size:12px;color:var(--text-muted);margin-top:2px">安装到主屏幕，像原生App一样使用</p></div>' +
    '<button class="btn-icon" data-click="closeModal" style="margin-left:auto">✕</button></div>' +

    '<div style="background:var(--bg-page);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text-heading)">📋 当前设备</h4>' +
    '<p style="font-size:13px;color:var(--text-body)">' + deviceType + (canPWA ? ' <span style="color:var(--success)">✅ 支持一键安装</span>' : '') + '</p>' +
    '</div>' +

    '<div style="background:var(--bg-page);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-heading)">📁 数据存储</h4>' +
    storageInfo +
    '</div>' +

    '<div style="background:var(--bg-page);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-heading)">📲 安装到主屏幕</h4>' +
    steps +
    '</div>' +

    '<div style="background:#E8F5E9;border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:6px;color:#1B5E20">✨ PWA 特性</h4>' +
    '<div style="font-size:13px;color:#1B5E20;line-height:2">' +
    '<p>✅ 全屏运行，无浏览器地址栏</p>' +
    '<p>✅ 支持离线使用（已缓存核心资源）</p>' +
    '<p>✅ 独立应用图标，像原生App</p>' +
    '<p>✅ 自动适配手机/平板屏幕</p>' +
    '</div></div>' +

    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    actionButtons +
    '<button class="btn btn-outline" data-click="closeModal" style="flex:1">关闭</button>' +
    '</div>');
}

function triggerPWAInstall() {
  if (!pwaInstallPrompt) {
    showToast('当前浏览器不支持一键安装，请按照安装步骤手动操作', 'info');
    return;
  }
  pwaInstallPrompt.prompt();
  pwaInstallPrompt.userChoice.then(function(choiceResult) {
    if (choiceResult.outcome === 'accepted') {
      showToast('✅ 已安装到主屏幕！', 'success');
      closeModal();
    } else {
      showToast('已取消安装', 'info');
    }
    pwaInstallPrompt = null;
  });
}

