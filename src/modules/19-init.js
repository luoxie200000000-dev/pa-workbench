/* ===================== Init ===================== */
async function initApp() {
  // Tauri 环境：先初始化 SQLite 数据库（有超时保护，不会卡死）
  if (isTauriApp()) {
    try { await initDB(); } catch(e) { console.error('[DB] initDB 失败，继续以 localStorage 模式运行:', e); }
  }

  // 无论 DB 是否成功，都必须加载状态和渲染页面
  try {
    loadState();
    migrateCloudSyncState();
    migrateScoreStudentIds();
    loadThemeSettings();

  // Register PWA manifest (enhanced for multi-platform install)
  try {
    const iconHref = document.querySelector('link[rel="icon"]')?.href || '';
    const manifest = {
      name: '派大星教学工作台',
      short_name: '教学工作台',
      description: '派大星的初中生物教学工作台 - 任务管理、学生档案、学情分析',
      start_url: window.location.href,
      scope: window.location.href.replace(/[^/]*$/, ''),
      display: 'standalone',
      orientation: 'any',
      background_color: '#F1F8E9',
      theme_color: '#4CAF50',
      lang: 'zh-CN',
      dir: 'ltr',
      categories: ['education', 'productivity'],
      icons: [
        { src: iconHref, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: iconHref, sizes: '256x256', type: 'image/png', purpose: 'any maskable' },
        { src: iconHref, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ],
      shortcuts: [
        { name: '任务清单', url: window.location.href + '#tasks', icons: [{ src: iconHref, sizes: '192x192' }] },
        { name: '学生档案', url: window.location.href + '#students', icons: [{ src: iconHref, sizes: '192x192' }] }
      ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestURL;

    // Add apple-touch-icon for iOS/iPad
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = iconHref;

    // Add apple-mobile-web-app-capable for iOS standalone mode
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleMeta) {
      appleMeta = document.createElement('meta');
      appleMeta.name = 'apple-mobile-web-app-capable';
      appleMeta.content = 'yes';
      document.head.appendChild(appleMeta);
    }
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      appleTitle.content = '教学工作台';
      document.head.appendChild(appleTitle);
    }
    let appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatus) {
      appleStatus = document.createElement('meta');
      appleStatus.name = 'apple-mobile-web-app-status-bar-style';
      appleStatus.content = 'default';
      document.head.appendChild(appleStatus);
    }

    // Register Service Worker for offline support (only on HTTPS)
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      const swCode = `
        const CACHE_NAME = 'pdx-workbench-v2';
        self.addEventListener('install', e => {
          self.skipWaiting();
          e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([self.location.origin])));
        });
        self.addEventListener('activate', e => {
          e.waitUntil(
            caches.keys().then(keys => Promise.all(
              keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
          );
          self.clients.claim();
        });
        self.addEventListener('fetch', e => {
          if (e.request.method !== 'GET') return;
          e.respondWith(
            caches.match(e.request).then(cached => {
              const fetchPromise = fetch(e.request).then(response => {
                if (response && response.status === 200) {
                  const clone = response.clone();
                  caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
              }).catch(() => cached);
              return cached || fetchPromise;
            })
          );
        });
      `;
      const swBlob = new Blob([swCode], { type: 'application/javascript' });
      const swURL = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swURL).catch(err => console.warn('[SW] Registration failed:', err));
    }
  } catch(e) {
    console.error('[App] Service Worker setup non-fatal error:', e);
  }

  // Auto-lock: monitor user activity (先移除旧监听器，防止 initApp 重复调用时累积)
  if (window.__autoLockHandler) {
    ['mousemove','keydown','click','scroll','touchstart'].forEach(evt => {
      document.removeEventListener(evt, window.__autoLockHandler);
    });
  }
  if (state.appPassword && state.passwordUnlocked) {
    resetAutoLockTimer();
  }
  window.__autoLockHandler = resetAutoLockTimer;
  ['mousemove','keydown','click','scroll','touchstart'].forEach(evt => {
    document.addEventListener(evt, window.__autoLockHandler, { passive: true });
  });

  // Cloud sync: sync S3 config from backend, then auto download on start
  updateSyncIndicator('off');
  await syncS3ConfigFromBackend();
  autoCloudPullOnStart();

  // Safe area / notch: manual toggle (default on), stored in localStorage
  // Apply to #app container so entire interface (sidebar + content) shifts down together
  (function applySafeAreaBySetting() {
    let notchOn = true;
    try { const v = localStorage.getItem('notchEnabled'); if (v !== null) notchOn = v === '1'; } catch(e) {}
    if (!notchOn) return; // user turned off notch
    const appEl = document.getElementById('app');
    if (!appEl) return;
    const pt = parseFloat(getComputedStyle(appEl).paddingTop) || 0;
    if (pt < 12) {
      appEl.style.setProperty('padding-top', '28px', 'important');
    }
  })();

  // Display real-time clock (先清除旧定时器，防止重复初始化累积)
  updateRealTimeClock();
  if (window.__clockTimer) clearInterval(window.__clockTimer);
  window.__clockTimer = setInterval(updateRealTimeClock, 1000);

  // Online/offline status (先移除旧监听器，防止重复注册)
  updateOnlineStatus();
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Initialize save button
  updateSaveButton();

  // Crash recovery: auto-save to temp before page closes (先移除旧监听器，防止重复注册)
  if (window.__beforeUnloadHandler) {
    window.removeEventListener('beforeunload', window.__beforeUnloadHandler);
  }
  window.__beforeUnloadHandler = function() {
    if (hasUnsavedChanges) {
      const toSave = getSerializableState({ _tempTimestamp: Date.now() });
      const json = JSON.stringify(toSave);
      localStorage.setItem(TEMP_STORAGE_KEY, json);
      // Tauri 环境：同步写入 SQLite 防止数据丢失
      if (isTauriApp() && window.__db && window.__db.ready) {
        window.__db.saveAppState('temp', json).catch(function(){});
      }
    }
  };
  window.addEventListener('beforeunload', window.__beforeUnloadHandler);

  // Keyboard shortcut: Ctrl+S to save (先移除旧监听器，防止重复注册)
  if (window.__saveShortcutHandler) {
    document.removeEventListener('keydown', window.__saveShortcutHandler);
  }
  window.__saveShortcutHandler = function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      commitSave();
    }
  };
  document.addEventListener('keydown', window.__saveShortcutHandler);

  // Nav keyboard accessibility (click is handled by data-click delegation)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    if (item.dataset.kbAttached) return;
    item.dataset.kbAttached = '1';
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (item.classList.contains('nav-parent')) {
          toggleNavParent(item.dataset.page);
        } else {
          navigateTo(item.dataset.page);
        }
      }
    });
  });
  document.querySelectorAll('.nav-child-item').forEach(item => {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    if (item.dataset.kbAttached) return;
    item.dataset.kbAttached = '1';
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo(item.dataset.page); } });
  });

  // Expand parent if current page is child
  if (PARENT_PAGES[state.currentPage]) {
    expandNavParent(PARENT_PAGES[state.currentPage], true);
  }

  // Navigate to saved or default page
  // If locked, default to student task page (password-exempt)
  let initPage = state.currentPage || 'tasks';
  if (state.appPassword && !state.passwordUnlocked && !PASSWORD_EXEMPT_PAGES.includes(initPage)) {
    initPage = 'st-task-info';
  }
  navigateTo(initPage);

  // ===== Electron specific initialization =====
  if (window.electronAPI) {
    window.electronAPI.onMenuChooseDataPath(() => chooseElectronDataPath());
    window.electronAPI.onMenuExportSource(() => exportElectronSource());
    if (window.electronAPI.onMenuSave) {
      window.electronAPI.onMenuSave(() => commitSave());
    }
    if (window.electronAPI.onMenuAbout) {
      window.electronAPI.onMenuAbout(() => {
        window.electronAPI.getAppInfo().then(info => {
          openModal(`
            <div style="text-align:center;padding:20px">
              <div style="font-size:48px;margin-bottom:12px">🧑‍🏫</div>
              <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">派大星教学工作台</h3>
              <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">版本 ${info.version}</p>
              <div style="text-align:left;font-size:12px;color:var(--text-body);line-height:1.8;background:var(--bg-card);padding:12px;border-radius:var(--radius-sm)">
                <div>📁 数据路径: ${info.dataPath}</div>
                <div>💻 运行环境: Electron Desktop</div>
              </div>
              <button class="btn btn-primary" style="margin-top:16px" data-click="closeModal">关闭</button>
            </div>
          `);
        });
      });
    }
    // Load data from local file (async, after initial render) — Electron only
    if (window.electronAPI && window.electronAPI.readData) {
      window.electronAPI.readData().then(data => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const { _tempTimestamp, ...restTemp } = parsed;
          state = { ...state, ...restTemp, currentMonth: new Date(restTemp.currentMonth || Date.now()) };
          showToast('已从本地文件恢复数据', 'info');
        } catch(e) {
          console.warn('Failed to parse Electron data:', e);
        }
      }
      applyUiMode();
      applySidebarCollapse();
      navigateTo(state.currentPage || 'tasks');
    }).catch(e => {
      console.warn('No local data file yet');
    });
    }
  }

  // Render password status bar
  renderPwdStatusBar();

  // Request notification permission for reminder popups
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Check reminders and tasks every 30 seconds
  checkRemindersAndTasks();
  window.__reminderTimer = setInterval(checkRemindersAndTasks, 30000);

  // Auto collapse sidebar on desktop when window is small (debounced)
  let __sidebarResizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(__sidebarResizeTimer);
    __sidebarResizeTimer = setTimeout(applySidebarCollapse, 150);
  });

  // First-launch mode picker: if uiMode not initialized, show selection dialog
  let uiModeInitialized = false;
  try { uiModeInitialized = localStorage.getItem('uiModeInitialized') === '1'; } catch(e) {}
  if (!uiModeInitialized || state.uiMode === 'auto' || !state.uiMode) {
    // Default to desktop immediately so the app is usable
    if (!state.uiMode || state.uiMode === 'auto') {
      state.uiMode = 'desktop';
      try { localStorage.setItem('uiMode', 'desktop'); } catch(e) {}
      applyUiMode();
    }
    // Show picker after a short delay so the page renders first
    setTimeout(function() { showFirstLaunchModePicker(); }, 300);
  }
  } catch(e) {
    console.error('[initApp] 初始化出错:', e);
    // 兜底：至少渲染默认页面，不能白屏
    try { navigateTo(state.currentPage || 'tasks'); } catch(e2) { console.error('Fallback navigateTo failed:', e2); }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initApp().catch(function(e) {
    console.error('[initApp] unhandled error:', e);
    // 兜底渲染
    try { navigateTo('tasks'); } catch(e2) {}
  });
  // 全局快捷键：Ctrl+Z 撤销 / Ctrl+Y 重做（输入框聚焦时不触发，避免影响文字编辑）
  document.addEventListener('keydown', function(e) {
    const ae = document.activeElement;
    const inEditable = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    if (inEditable) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoState(); }
    else if ((k === 'y') || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoState(); }
  });
  // 初始化撤销栈 + 按钮态
  if (!state._undoStack) state._undoStack = [];
  if (!state._redoStack) state._redoStack = [];
  setTimeout(updateUndoRedoButtons, 50);
  // 顶栏融合拖拽滚动（长按兜底 + 移动即时拖）
  enableTopBarDragScroll();
  // 初始化「07 顶栏滚动」开关高亮（默认开启）
  const navTB = document.getElementById('navTopBarScroll');
  if (navTB) navTB.classList.toggle('ts-on', __topBarScrollEnabled);
  // 点击空白处关闭撤销/重做折叠菜单
  document.addEventListener('click', function(e) {
    const urMenu = document.getElementById('undoRedoMenu');
    if (urMenu && !urMenu.hasAttribute('hidden')) {
      const urBtn = document.getElementById('btnUndoRedoFold');
      if (!(urBtn && (urBtn.contains(e.target) || urMenu.contains(e.target)))) closeUndoRedoMenu();
    }
    // 关闭「更多」折叠：点菜单内项或空白都收起；点折叠按钮本身由 toggleMoreMenu 处理
    const mMenu = document.getElementById('moreMenu');
    if (mMenu && !mMenu.hasAttribute('hidden')) {
      const mBtn = document.getElementById('btnMoreFold');
      if (!(mBtn && mBtn.contains(e.target))) closeMoreMenu();
    }
  });
  // Mobile sidebar toggle
  document.getElementById('mobileMenuBtn').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // 学生档案：批量勾选事件委托（全选 + 计数更新）
  document.addEventListener('change', function(e) {
    const t = e.target;
    if (!t) return;
    if (t.id === 'studentSelectAll') {
      document.querySelectorAll('.student-select-cb').forEach(function(cb){ cb.checked = t.checked; });
      updateStudentSelCount();
    } else if (t.classList && t.classList.contains('student-select-cb')) {
      updateStudentSelCount();
    } else if (t.id === 'taskSelectAll') {
      document.querySelectorAll('.task-del-cb').forEach(function(cb){ cb.checked = t.checked; });
      updateTaskSelCount();
    } else if (t.classList && t.classList.contains('task-del-cb')) {
      updateTaskSelCount();
    } else if (t.id === 'scoreSelectAll') {
      document.querySelectorAll('.score-del-cb').forEach(function(cb){ if (!cb.disabled) cb.checked = t.checked; });
      updateScoreSelCount();
    } else if (t.classList && t.classList.contains('score-del-cb')) {
      updateScoreSelCount();
    }
  });
});


// ===== Electron Desktop Functions =====
function writeToElectronFile() {
  if (!window.electronAPI) return;
  const toSave = JSON.stringify({ ...state, currentMonth: state.currentMonth.toISOString(), _lastSaved: Date.now() });
  window.electronAPI.writeData(toSave).then(result => {
    if (!result.success) console.warn('Electron file write failed:', result.error);
  }).catch(e => console.warn('Electron file write error:', e));
}

async function chooseElectronDataPath() {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.chooseDataPath();
  if (result.success) {
    showToast('数据存储路径已更改: ' + result.path, 'success');
  }
}

async function exportElectronSource() {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.exportSource();
  if (result.success) {
    showToast('源代码已导出到: ' + result.path, 'success');
  }
}

// ============================================================
// 04生物仙途秘境 —— 修仙游戏模块（4标签页：档案/任务/角色池/排行）
// 经济内核沿用《生物修仙模块开发指令_v2.0》（境界/灵根/突破/灵石/极品灵石/小队）
// ============ 04生物仙途秘境（阶段 1–9 + 4标签页重构 完整实现） ============
// 形象层：4 池（动物/植物/人物/限定）+ 程序化 SVG Q 版立绘 + 进化/突破视觉
// 参考：修仙手游（仙缘问道 / 山海试炼 / 遮天凡尘一叶）水墨留白 + 清新治愈；
//       Q 版 Chibi（大头小身大眼圆润）；教育游戏化（ClassDojo 积分商店 / 每周发放 / 匿名榜）
// ============================================================

