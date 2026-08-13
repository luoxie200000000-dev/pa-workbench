/* ===================== Theme Management ===================== */
let __themeMode = 'light';
let __accentColor = 'green';

function applyTheme() {
  let root = document.documentElement;
  if (__themeMode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
  root.setAttribute('data-accent', __accentColor);
  const btns = document.querySelectorAll('.theme-mode-btn');
  for (let i = 0; i < btns.length; i++) {
    if (btns[i].getAttribute('data-mode') === __themeMode) btns[i].classList.add('active');
    else btns[i].classList.remove('active');
  }
  const sws = document.querySelectorAll('.accent-swatch');
  for (let j = 0; j < sws.length; j++) {
    if (sws[j].getAttribute('data-color') === __accentColor) sws[j].classList.add('active');
    else sws[j].classList.remove('active');
  }
}

function setThemeMode(mode) {
  __themeMode = mode;
  applyTheme();
  saveThemeSettings();
  showToast(mode === 'dark' ? '已切换到深色模式' : '已切换到浅色模式');
}

function setAccentColor(color) {
  __accentColor = color;
  applyTheme();
  saveThemeSettings();
  const names = {green:'绿色',blue:'蓝色',purple:'紫色',orange:'橙色',teal:'青色',rose:'玫红色'};
  showToast('主题色已切换为' + (names[color]||color));
}

function saveThemeSettings() {
  try {
    let settings = { mode: __themeMode, accent: __accentColor };
    localStorage.setItem('__theme_settings', JSON.stringify(settings));
    if (window.__db && window.__db.ready) {
      window.__db.setSetting('theme_mode', __themeMode);
      window.__db.setSetting('accent_color', __accentColor);
    }
  } catch(e) { console.warn('[Theme] save failed:', e); }
}

function loadThemeSettings() {
  try {
    let saved = localStorage.getItem('__theme_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      __themeMode = settings.mode || 'light';
      __accentColor = settings.accent || 'green';
      applyTheme();
    }
    if (window.__db && window.__db.ready) {
      const dbMode = window.__db.getSetting('theme_mode');
      const dbAccent = window.__db.getSetting('accent_color');
      if (dbMode) { __themeMode = dbMode; }
      if (dbAccent) { __accentColor = dbAccent; }
      applyTheme();
    }
  } catch(e) { console.warn('[Theme] load failed:', e); }
}

function toggleThemePanel(e) {
  if (e) e.stopPropagation();
  let panel = document.getElementById('themePanel');
  const overlay = document.getElementById('themePanelOverlay');
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    overlay.classList.add('open');
    applyTheme();
  } else {
    closeThemePanel();
  }
}

function closeThemePanel() {
  document.getElementById('themePanel').style.display = 'none';
  document.getElementById('themePanelOverlay').classList.remove('open');
}

(function initThemeEarly() {
  try {
    const saved = localStorage.getItem('__theme_settings');
    if (saved) {
      const s = JSON.parse(saved);
      __themeMode = s.mode || 'light';
      __accentColor = s.accent || 'green';
    }
  } catch(e) { console.warn('[Theme] Failed to load saved theme:', e); }
  const root = document.documentElement;
  if (__themeMode === 'dark') root.setAttribute('data-theme', 'dark');
  root.setAttribute('data-accent', __accentColor);
})();

/* ===================== Runtime Status Panel ===================== */
function getLocalStorageDetails() {
  const details = [];
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k) || '';
    const bytes = new Blob([v]).size;
    total += bytes;
    details.push({ key: k, size: bytes, sizeKB: (bytes / 1024).toFixed(2) });
  }
  details.sort(function(a, b) { return b.size - a.size; });
  return { total: total, details: details };
}

function getStoragePath() {
  const customPath = localStorage.getItem('pdx_custom_storage_path') || '';
  if (customPath) return customPath;
  // Tauri environment: 使用 Rust 注入的真实数据库路径
  if (isTauriApp()) {
    if (window.__TAURI_DB_PATH__) return window.__TAURI_DB_PATH__;
    return 'SQLite 数据库（安装目录/data/workbuddy.db）';
  }
  // Browser local file protocol
  if (window.location.protocol === 'file:') {
    let folderPath = '';
    try { folderPath = decodeURIComponent(window.location.pathname).replace(/\\/g, '/').replace(/\/[^\/]*$/, ''); } catch(e) { console.warn('[Path] Failed to decode path:', e); }
    return folderPath || '本地文件目录';
  }
  return '浏览器内部存储（localStorage）';
}
function showRuntimeStatus() {
  let panel = document.getElementById('runtimeStatusPanel');
  panel.classList.add('open');
  refreshRuntimeStatus();
}
function closeRuntimeStatusPanel() {
  let panel = document.getElementById('runtimeStatusPanel');
  panel.classList.remove('open');
  panel.innerHTML = '';
}
async function refreshRuntimeStatus() {
  const panel = document.getElementById('runtimeStatusPanel');
  const info = getLocalStorageDetails();
  const lsTotalKB = (info.total / 1024).toFixed(1);
  const lsTotalMB = (info.total / 1024 / 1024).toFixed(2);
  const isTauri = !!isTauriApp();
  const isLocalFile = window.location.protocol === 'file:';
  const envLabel = isTauri ? 'Tauri 桌面版' : (isLocalFile ? '本地文件' : '浏览器');
  const dbLabel = isTauri ? 'SQLite 数据库' : 'localStorage 键值对';

  // 先渲染基础面板
  panel.innerHTML =
    '<div class="status-panel" data-click="__noop">' +
    '<div class="status-panel-header">' +
    '<span style="font-size:28px">📊</span>' +
    '<div><h3>运行状态查询</h3><p>查看和管理应用存储状态</p></div>' +
    '<button class="btn-icon" data-click="closeRuntimeStatusPanel">✕</button></div>' +
    '<div class="status-panel-body">' +
    '<div class="status-section">' +
    '<div class="status-section-title">📋 环境信息</div>' +
    '<div class="status-grid">' +
    '<div><span class="label">运行环境</span><span class="value">' + envLabel + '</span></div>' +
    '<div><span class="label">数据引擎</span><span class="value">' + dbLabel + '</span></div>' +
    '<div id="dbInfoRow"><span class="label">数据大小</span><span class="value">加载中...</span></div>' +
    '<div><span class="label">缓存条目</span><span class="value">' + info.details.length + ' 个</span></div></div></div>' +
    '<div class="status-section">' +
    '<div class="status-section-title">💾 存储容量</div>' +
    '<div id="storageCapacity" style="font-size:12px;color:let(--text-muted);margin-bottom:4px">加载中...</div>' +
    '<div class="status-bar-wrap"><div id="storageBar" class="status-bar-fill" style="width:0%;background:let(--success)"></div></div></div>' +
    '<div class="status-section">' +
    '<div class="status-section-title">📁 本地储存位置</div>' +
    '<div id="storagePathArea" style="font-size:12px">加载中...</div>' +
    '</div>' +
    '<div class="status-section">' +
    '<div class="status-section-title" style="display:flex;justify-content:space-between">' +
    '<span id="tableDetailTitle">🔑 键值明细</span><button class="btn" style="padding:4px 10px;font-size:11px;background:let(--primary);color:#fff;border-radius:let(--radius-sm);border:none;cursor:pointer" data-click="refreshRuntimeStatus">🔄 刷新</button></div>' +
    '<div id="tableDetailArea"></div></div>' +
    '</div></div>';

  // 异步加载详细数据
  if (isTauri && window.__db && window.__db.ready) {
    try {
      let dbPath = await window.__db.getDbPath();
      const dbSize = await window.__db.getDbSize();
      const tableCounts = await window.__db.getTableCounts();
      const dbSizeKB = (dbSize / 1024).toFixed(1);
      const dbSizeMB = (dbSize / 1024 / 1024).toFixed(2);
      let totalEntries = 0;
      let tableRows = '';
      for (const tbl in tableCounts) {
        totalEntries += tableCounts[tbl];
        const labelMap = {
          students: '学生档案', homework_records: '作业记录', schedule_config: '课表配置',
          settings: '系统设置', news_favorites: '资讯收藏', progress: '教学进度',
          scores: '成绩记录', app_state: '应用状态快照'
        };
        const label = labelMap[tbl] || tbl;
        const cnt = tableCounts[tbl];
        let badge = tbl === 'app_state' ? ' <span class="status-badge ok" style="margin-left:4px">主数据</span>' : '';
        tableRows += '<tr><td><code style="background:let(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + label + '</code>' + badge + '</td><td class="size-col">' + cnt + ' 条</td></tr>';
      }
      if (!tableRows) tableRows = '<tr><td colspan="2" style="text-align:center;color:let(--text-muted);padding:12px">暂无数据</td></tr>';

      // 更新环境信息
      const dbInfoRow = document.getElementById('dbInfoRow');
      if (dbInfoRow) dbInfoRow.innerHTML = '<span class="label">数据大小</span><span class="value">' + dbSizeKB + ' KB</span>';

      // 更新存储容量（SQLite 无固定限额，只显示实际大小）
      const capDiv = document.getElementById('storageCapacity');
      const barDiv = document.getElementById('storageBar');
      if (capDiv) capDiv.innerHTML = 'SQLite 数据库文件大小 <strong>' + dbSizeMB + ' MB</strong>（无容量限制）<br><span style="font-size:11px;color:let(--text-muted)">localStorage 缓存 ' + lsTotalMB + ' MB（用于崩溃恢复）</span>';
      if (barDiv) {
        barDiv.style.width = '0%';
        barDiv.style.background = 'transparent';
      }

      // 更新存储路径
      const pathArea = document.getElementById('storagePathArea');
      if (pathArea) {
        pathArea.innerHTML =
          '<div style="background:let(--bg-app);border-radius:let(--radius-sm);padding:10px 12px;margin-bottom:10px">' +
          '<div style="font-size:11px;color:let(--text-muted);margin-bottom:4px">📁 当前数据库文件路径</div>' +
          '<code style="font-size:12px;color:let(--text-body);word-break:break-all">' + escapeHtml(dbPath || '获取失败') + '</code>' +
          '<span class="status-badge ok" style="margin-left:4px">SQLite</span>' +
          '<button class="btn" style="margin-left:6px;padding:2px 8px;font-size:11px" data-click="copyDbPath">📋 复制</button>' +
          '<button class="btn" style="margin-left:4px;padding:2px 8px;font-size:11px" data-click="openDbFolder">📁 打开</button></div>' +
          '<div class="status-path-row" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">' +
          '<span style="font-size:12px;color:let(--text-muted);white-space:nowrap">迁移到新位置：</span>' +
          '<input type="text" id="runtimeStoragePath" value="" placeholder="选择或输入新文件夹路径" style="flex:1;min-width:200px">' +
          '<button class="btn" style="background:let(--primary);color:#fff;border:none" data-click="saveStoragePath">迁移</button>' +
          '<button class="btn" style="background:let(--primary-lightest);border-color:let(--primary-light);color:let(--primary-dark)" data-click="browseFolder">🔍 浏览</button>' +
          '<button class="btn" style="background:let(--bg-app);border-color:let(--border)" data-click="resetStoragePath">↩ 重置默认</button></div>' +
          '<div style="font-size:11px;color:let(--text-muted);margin-top:6px;line-height:1.5">💡 点击"迁移"会将数据库复制到新位置并重启应用。原数据保留不删除。</div>';
      }

      // 更新表详情
      const detailTitle = document.getElementById('tableDetailTitle');
      const detailArea = document.getElementById('tableDetailArea');
      if (detailTitle) detailTitle.textContent = '🗄️ 数据表明细（' + totalEntries + ' 条记录）';
      if (detailArea) {
        detailArea.innerHTML = '<table class="status-table"><thead><tr><th>数据表</th><th class="size-col">记录数</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
      }
    } catch(e) {
      console.warn('[DB] 运行状态查询失败:', e);
      _renderLSFallback(panel, info, lsTotalKB, lsTotalMB, isTauri);
    }
  } else {
    // 非 Tauri 环境：显示 localStorage 详情
    let limitMB = 5;
    let pct = Math.min(100, ((info.total / (limitMB * 1024 * 1024)) * 100)).toFixed(1);
    let barColor = pct > 80 ? 'let(--danger)' : (pct > 50 ? 'let(--warning)' : 'let(--success)');

    let tableRows = info.details.map(function(item) {
      let badge = item.key === 'pdx_workbench_v6' ? '<span class="status-badge ok" style="margin-left:4px">主数据</span>' : '';
      return '<tr><td><code style="background:let(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + escapeHtml(item.key) + '</code>' + badge + '</td><td class="size-col">' + item.sizeKB + ' KB</td></tr>';
    }).join('');
    if (!tableRows) tableRows = '<tr><td colspan="2" style="text-align:center;color:let(--text-muted);padding:12px">暂无数据</td></tr>';

    let storagePath = getStoragePath();
    let pathInput = '<div class="status-path-row"><span style="font-size:12px;color:let(--text-muted);white-space:nowrap">存储路径：</span><input type="text" id="runtimeStoragePath" value="' + escapeHtml(storagePath) + '" placeholder="自定义存储路径（仅记录用途）"><button class="btn" data-click="browseFolder" title="选择文件夹" style="margin-left:4px">📂 浏览</button><button class="btn" data-click="saveStoragePath">保存</button></div>';

    _renderLSFallback(panel, info, lsTotalKB, lsTotalMB, isTauri, limitMB, pct, barColor, tableRows, pathInput);
  }
}

function _renderLSFallback(panel, info, lsTotalKB, lsTotalMB, isTauri, limitMB, pct, barColor, tableRows, pathInput) {
  if (limitMB === undefined) limitMB = 5;
  if (pct === undefined) pct = Math.min(100, ((info.total / (limitMB * 1024 * 1024)) * 100)).toFixed(1);
  if (barColor === undefined) barColor = pct > 80 ? 'let(--danger)' : (pct > 50 ? 'let(--warning)' : 'let(--success)');
  if (tableRows === undefined) {
    tableRows = info.details.map(function(item) {
      const badge = item.key === 'pdx_workbench_v6' ? '<span class="status-badge ok" style="margin-left:4px">主数据</span>' : '';
      return '<tr><td><code style="background:let(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + escapeHtml(item.key) + '</code>' + badge + '</td><td class="size-col">' + item.sizeKB + ' KB</td></tr>';
    }).join('');
  }
  if (pathInput === undefined) {
    const storagePath = getStoragePath();
    pathInput = '<div class="status-path-row"><span style="font-size:12px;color:let(--text-muted);white-space:nowrap">存储路径：</span><input type="text" id="runtimeStoragePath" value="' + escapeHtml(storagePath) + '" placeholder="自定义存储路径（仅记录用途）"><button class="btn" data-click="browseFolder" title="选择文件夹" style="margin-left:4px">📂 浏览</button><button class="btn" data-click="saveStoragePath">保存</button></div>';
  }

  panel.innerHTML =
    '<div class="status-panel" data-click="__noop">' +
    '<div class="status-panel-header">' +
    '<span style="font-size:28px">📊</span>' +
    '<div><h3>运行状态查询</h3><p>查看和管理应用存储状态</p></div>' +
    '<button class="btn-icon" data-click="closeRuntimeStatusPanel">✕</button></div>' +
    '<div class="status-panel-body">' +
    '<div class="status-section">' +
    '<div class="status-section-title">📋 环境信息</div>' +
    '<div class="status-grid">' +
    '<div><span class="label">运行环境</span><span class="value">' + (isTauri ? 'Tauri 桌面版' : '浏览器') + '</span></div>' +
    '<div><span class="label">数据引擎</span><span class="value">' + (isTauri ? 'SQLite 数据库' : 'localStorage 键值对') + '</span></div>' +
    '<div><span class="label">键值条目</span><span class="value">' + info.details.length + ' 个</span></div>' +
    '<div><span class="label">总占用</span><span class="value">' + lsTotalKB + ' KB</span></div></div></div>' +
    '<div class="status-section">' +
    '<div class="status-section-title">💾 存储容量</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-bottom:4px">已用 ' + lsTotalMB + ' MB / 限额 ' + limitMB + ' MB（' + pct + '%）</div>' +
    '<div class="status-bar-wrap"><div class="status-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div></div>' +
    '<div class="status-section">' +
    '<div class="status-section-title">📁 本地储存位置</div>' +
    '<div style="font-size:12px">' + pathInput + '</div>' +
    '<div style="font-size:11px;color:let(--text-muted);margin-top:6px;line-height:1.5">💡 ' + (isTauri ? '系统数据库路径由 Tauri 自动管理，卸载/升级不会丢失数据。' : '浏览器版数据存储在 localStorage 中，清除浏览器缓存会导致数据丢失。') + '</div></div>' +
    '<div class="status-section">' +
    '<div class="status-section-title" style="display:flex;justify-content:space-between">' +
    '<span>🔑 键值明细</span><button class="btn" style="padding:4px 10px;font-size:11px;background:let(--primary);color:#fff;border-radius:let(--radius-sm);border:none;cursor:pointer" data-click="refreshRuntimeStatus">🔄 刷新</button></div>' +
    '<table class="status-table"><thead><tr><th>键名</th><th class="size-col">大小</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
    '</div></div>';
}


function saveStoragePath() {
  let input = document.getElementById('runtimeStoragePath');
  if (!input) return;
  const path = input.value.trim();
  if (!path) {
    showToast('请输入或选择一个文件夹路径', 'warn');
    return;
  }
  if (!isTauriApp()) {
    localStorage.setItem('pdx_custom_storage_path', path);
    showToast('路径已保存（浏览器模式，仅记录）', 'success');
    return;
  }
  // Tauri 环境：调用 Rust 命令迁移数据库
  __invoke('set_custom_db_path', { newDir: path }).then(function(newPath) {
    showToast('存储路径已迁移到：' + newPath + '\n应用将重启以生效', 'success');
    setTimeout(function() {
      __invoke('restart_app').catch(function(e) {
        showToast('请手动重启应用以生效', 'warn');
      });
    }, 1500);
  }).catch(function(e) {
    showToast('迁移存储路径失败：' + (e.message || e), 'error');
  });
}
async function openDbFolder() {
  if (!isTauriApp()) { showToast('仅在桌面版可用', 'warn'); return; }
  try {
    let dbPath = await window.__db.getDbPath();
    if (!dbPath) { showToast('无法获取数据库路径', 'error'); return; }
    // 获取目录路径（兼容正斜杠和反斜杠）
    const dirPath = dbPath.replace(/[\\\/][^\\\/]*$/, '');
    await __invoke('open_folder', { path: dirPath });
  } catch(e) {
    showToast('打开文件夹失败：' + (e.message || e), 'error');
  }
}
async function browseFolder() {
  if (!isTauriApp()) { showToast('仅在桌面版可用', 'warn'); return; }
  try {
    const selected = await __invoke('pick_folder');
    if (!selected) return; // 用户取消
    const input = document.getElementById('runtimeStoragePath');
    if (input) input.value = selected;
    showToast('已选择文件夹，点击"迁移"按钮完成数据迁移', 'success');
  } catch(e) {
    showToast('选择文件夹失败：' + (e.message || e), 'error');
  }
}
async function copyDbPath() {
  try {
    const dbPath = isTauriApp() ? await window.__db.getDbPath() : getStoragePath();
    if (!dbPath) { showToast('无法获取路径', 'error'); return; }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(dbPath);
      showToast('路径已复制到剪贴板', 'success');
    } else {
      const ta = document.createElement('textarea');
      ta.value = dbPath;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('路径已复制', 'success');
    }
  } catch(e) {
    showToast('复制失败：' + (e.message || e), 'error');
  }
}
async function resetStoragePath() {
  if (!isTauriApp()) { showToast('仅在桌面版可用', 'warn'); return; }
  if (!(await appConfirm('确定要重置为默认存储路径吗？应用将重启。'))) return;
  try {
    await __invoke('reset_custom_db_path');
    showToast('已重置为默认路径，应用将重启...', 'success');
    setTimeout(function() {
      __invoke('restart_app').catch(function() {
        showToast('请手动重启应用', 'warn');
      });
    }, 1000);
  } catch(e) {
    showToast('重置失败：' + (e.message || e), 'error');
  }
}

