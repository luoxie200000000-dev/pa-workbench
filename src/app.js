// ============================================================
//  此文件由 concat-modules.cjs 自动生成，请勿手动编辑
//  源文件位于 src/modules/，编辑后运行 npm run concat 重新生成
// ============================================================

/* ===================== 教学工作台 - 模块化入口 ===================== */
(function() {
'use strict';

// 班级常量（统一引用，避免硬编码分散多处；用户可在学生档案总库动态增删班级）
const CLASSES = ['1班','2班','4班','5班','8班','10班'];

// 获取当前生效的班级列表（优先使用用户自定义，否则使用默认任教班级）
function getClasses() {
  if (state && Array.isArray(state.classes) && state.classes.length > 0) {
    return state.classes;
  }
  return CLASSES;
}

// 获取任教班级列表（优先使用用户自定义，否则使用默认 CLASSES）
function getTeachingClasses() {
  if (state && Array.isArray(state.teachingClasses) && state.teachingClasses.length > 0) {
    return state.teachingClasses;
  }
  return CLASSES;
}

// 判断班级是否为任教班级
function isTeachingClass(cls) { return getTeachingClasses().includes(cls); }

// 判断是否为当前班级列表中的班级（兼容原有「任教班级」语义）
function isMyClass(cls) { return getClasses().includes(cls); }

// 获取所有有数据的班级（当前班级列表 + 导入成绩的班级 + 学生档案中的班级）
function getAllClasses() {
  const classSet = new Set(getClasses());
  // 从成绩数据中收集所有班级
  if (state && state.scores) {
    state.scores.forEach(s => { if (s.classId) classSet.add(s.classId); });
  }
  // 从学生数据中收集所有班级
  if (state && state.students) {
    state.students.forEach(s => { if (s.classId) classSet.add(s.classId); });
  }
  return [...classSet].sort((a, b) => {
    // 当前班级列表排前面
    const classes = getClasses();
    const aIsMine = classes.includes(a);
    const bIsMine = classes.includes(b);
    if (aIsMine && !bIsMine) return -1;
    if (!aIsMine && bIsMine) return 1;
    // 同类按数字排序
    const na = parseInt(a) || 99;
    const nb = parseInt(b) || 99;
    return na - nb;
  });
}

/* ===================== Tauri SQLite DB (inline, no modules) ===================== */
let __db = null;
let __dbReady = false;

// 可靠的 Tauri 环境检测：
// 1) window.__IS_TAURI_APP__ — Rust setup 钩子注入（主检测）
// 2) window.__TAURI_INTERNALS__ — Tauri v2 运行时内置，始终在页面脚本前注入（备用检测）
function isTauriApp() { return !!(window.__IS_TAURI_APP__ || window.__TAURI_INTERNALS__); }

function __invoke(cmd, args) {
  // Tauri v2: 优先使用 __TAURI_INTERNALS__.invoke
  if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
    return window.__TAURI_INTERNALS__.invoke(cmd, args || {});
  }
  // Tauri v2 withGlobalTauri / Tauri v1: 使用 __TAURI__.invoke
  if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
    return window.__TAURI__.invoke(cmd, args || {});
  }
  // Tauri v1 fallback: __TAURI_IPC__
  if (window.__TAURI_IPC__) {
    return window.__TAURI_IPC__(cmd, args || {});
  }
  return Promise.reject('Tauri API not available');
}

const Database = {
  load: function(path) {
    return __invoke('plugin:sql|load', { db: path }).then(function(id) {
      return {
        path: id,
        execute: function(query, values) {
          return __invoke('db_execute', { query: query, values: values || [] })
            .then(function(res) { return { rowsAffected: res[0], lastInsertId: res[1] }; });
        },
        select: function(query, values) {
          return __invoke('plugin:sql|select', { db: this.path, query: query, values: values || [] });
        },
        close: function() {
          return __invoke('plugin:sql|close', { db: this.path });
        }
      };
    });
  }
};

function appDataDir() {
  return __invoke('plugin:path|resolve_directory', { directory: 14 });
}

async function initDB() {
  if (!isTauriApp()) { console.log('[DB] Not in Tauri, skipping DB init'); return; }
  try {
    // 优先使用 Rust 注入的数据库路径
    let dbUrl = window.__TAURI_DB_PATH__ || 'sqlite:workbuddy.db';
    if (dbUrl.indexOf('sqlite:') !== 0) dbUrl = 'sqlite:' + dbUrl.replace(/\\/g, '/');
    // 超时保护：5 秒内数据库未连上则放弃，避免白屏
    const conn = await Promise.race([
      Database.load(dbUrl),
      new Promise(function(_, reject) { setTimeout(function() { reject('DB load timeout (5s)'); }, 5000); })
    ]);
    const cache = {};
    let tables = ['students','homework_records','schedule_config','schedule_periods','schedule_days','schedule_adjustments','settings','news_favorites','progress','scores','app_state'];
    for (let i = 0; i < tables.length; i++) {
      try { cache[tables[i]] = await conn.select('SELECT * FROM ' + tables[i]); } catch(e) { cache[tables[i]] = []; }
    }
    __db = {
      conn: conn, ready: true, cache: cache,
      refreshTable: async function(t) { this.cache[t] = await this.conn.select('SELECT * FROM ' + t); },
      insert: async function(table, row) {
        const cols = Object.keys(row);
        const placeholders = cols.map(function(){ return '?'; }).join(',');
        const values = cols.map(function(k){ return row[k]; });
        await this.conn.execute('INSERT INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + placeholders + ')', values);
        await this.refreshTable(table);
      },
      saveAppState: async function(key, dataJson) {
        let rows = this.cache.app_state || [];
        let exists = false;
        for (let i = 0; i < rows.length; i++) { if (rows[i].state_key === key) { exists = true; break; } }
        if (exists) {
          await this.conn.execute("UPDATE app_state SET state_data = ?, updated_at = datetime('now','localtime') WHERE state_key = ?", [dataJson, key]);
        } else {
          await this.conn.execute("INSERT INTO app_state (state_key, state_data) VALUES (?, ?)", [key, dataJson]);
        }
        await this.refreshTable('app_state');
      },
      getAppState: async function(key) {
        const rows = this.cache.app_state || [];
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].state_key === key) {
            try { return JSON.parse(rows[i].state_data); } catch(e) { return null; }
          }
        }
        return null;
      },
      getDbPath: async function() {
        try { return await __invoke('get_db_path'); } catch(e) { return null; }
      },
      getDbSize: async function() {
        try {
          const pageResult = await this.conn.select('PRAGMA page_count');
          const sizeResult = await this.conn.select('PRAGMA page_size');
          const pages = pageResult[0] ? pageResult[0].page_count : 0;
          const pageSize = sizeResult[0] ? sizeResult[0].page_size : 4096;
          return pages * pageSize;
        } catch(e) { return 0; }
      },
      getTableCounts: async function() {
        const tables = ['students','homework_records','schedule_config','settings','news_favorites','progress','scores','app_state'];
        const counts = {};
        for (let i = 0; i < tables.length; i++) {
          try { let r = await this.conn.select('SELECT COUNT(*) as cnt FROM ' + tables[i]); counts[tables[i]] = r[0] ? r[0].cnt : 0; }
          catch(e) { counts[tables[i]] = 0; }
        }
        return counts;
      }
    };
    window.__db = __db;
    __dbReady = true;
    console.log('[DB] 数据库初始化完成');
    // 通知等待 DB 就绪的代码（_loadFromDB 等可能正在等待此事件）
    window.dispatchEvent(new Event('db-ready'));
  } catch(e) {
    console.error('[DB] 初始化失败:', e);
  }
}

/* ===================== State Management ===================== */
const STORAGE_KEY = 'pdx_workbench_v6';
const TEMP_STORAGE_KEY = 'pdx_workbench_v6_temp';

const AUTO_LOCK_MINUTES = 15; // 15分钟无操作后加密模块自动锁定（学生工作任务免密）
let hasUnsavedChanges = false;
let state = {
  tasks: [],
  plans: [],
  // Schedule
  schedule: [],
  schedulePeriods: [],
  scheduleDays: [],
  adjustments: [],
  progress: [],
  currentPage: 'tasks',
  currentTaskView: 'list',
  currentMonth: new Date(),
  semesterStart: '2026-09-01',
  // Student management
  students: [],
  studentTasks: [],
  homeworkRecords: [],
  chatMessages: [],
  scores: [],
  currentStudentTaskView: 'st-task-info',
  currentAnalysisView: 'hw-analysis',
  studentSearchQuery: '',
  currentChatClass: '1班',
  chatUnread: {},
  // Quick Tools
  reminders: [],
  quizRevealed: false,
  currentScheduleWeek: 0,
  currentScheduleView: 'fixed',
  // Password protection
  appPassword: '',
  passwordUnlocked: false,
  securityQuestion: '',
  securityAnswer: '',
  // Student archive
  studentClassFilter: '',
  // 班级列表（可动态增删，未设置则使用默认任教班级 CLASSES）
  classes: null,
  // 任教班级列表（未设置则使用默认 CLASSES）
  teachingClasses: null,
  // Layer mode: 'class'(班级分层) or 'score'(成绩分层)
  layerMode: 'class',
  // Score system
  scoreHistory: [],
  // Cloud Sync — S3 数据胶囊（栏目可选，上传/下载分离，按班级/年级划分）
  cloudAutoSync: false,
  cloudSyncClass: '',          // 兼容旧版单一班级（迁移后清空）
  cloudUploadSections: [],     // 自动上传栏目 key 列表（与下载可不同）
  cloudDownloadSections: [],   // 自动下载栏目 key 列表
  cloudUploadSectionClasses: {},   // 上传：per-section 班级映射 { secKey: [cls,...] }
  cloudDownloadSectionClasses: {}, // 下载：per-section 班级映射
  cloudSectionsConfigured: false,
  cloudLastPush: 0,
  cloudLastPull: 0,
  cstcloudConfig: { endpoint: '', bucket: '', accessKey: '', secretKey: '', region: 'us-east-1' },
  localFileHandle: null,
  localFileName: "",
  xiuxian: null,
  // 视图模式：'mobile'(手机布局) | 'desktop'(桌面布局)，无自动模式
  uiMode: (function(){ try { const m = localStorage.getItem('uiMode'); return (m === 'mobile' || m === 'desktop') ? m : 'desktop'; } catch(e) { return 'desktop'; } })()
};

// ===== 可序列化状态辅助函数 =====
// 统一剥离不可序列化的字段（如 FileSystemFileHandle），防止 JSON.stringify 产生空对象或抛异常
function getSerializableState(extra) {
  const { localFileHandle, _undoStack, _redoStack, ...rest } = state;
  rest.currentMonth = state.currentMonth.toISOString();
  if (extra) Object.assign(rest, extra);
  return rest;
}

function loadState() {
  // 检查临时存储（未保存的更改）
  const tempData = localStorage.getItem(TEMP_STORAGE_KEY);
  const permData = localStorage.getItem(STORAGE_KEY);

  if (tempData) {
    try {
      const tempParsed = JSON.parse(tempData);
      const tempTs = tempParsed._tempTimestamp || 0;
      let permTs = 0;
      if (permData) {
        try { permTs = JSON.parse(permData)._lastSaved || 0; } catch(e) { console.warn('[State] Failed to parse permission timestamp:', e); }
      }
      // 如果临时数据比永久数据新，恢复临时数据
      if (tempTs > permTs) {
        const { _tempTimestamp, _lastSaved, localFileHandle: _lfh, ...restTemp } = tempParsed;
        const restored = { ...state, ...restTemp, currentMonth: new Date(restTemp.currentMonth || Date.now()) };
        state = restored;
        hasUnsavedChanges = true;
        setTimeout(() => {
          showToast('检测到上次未保存的更改，已自动恢复。点击"💾 储存"保存到本地。', 'warn');
        }, 1500);
        return;
      }
    } catch(e) { console.warn('Temp data parse error:', e); }
  }

  // 从永久存储加载
  if (permData) {
    const parsed = JSON.parse(permData);
    const { _lastSaved, localFileHandle: _lfh, ...restParsed } = parsed;
    const loaded = { ...state, ...restParsed, currentMonth: new Date(parsed.currentMonth || Date.now()) };
    state = loaded;
  } else {
    initSampleData();
  }
  hasUnsavedChanges = false;

  // Tauri 环境：异步从 SQLite 数据库加载（覆盖 localStorage 数据）
  if (isTauriApp()) {
    _loadFromDB();
  }
}

// ===== SQLite 数据库加载 =====
async function _loadFromDB() {
  try {
    // 等待 DB 就绪（initDB 成功后会 dispatch db-ready 事件）
    if (!window.__db || !window.__db.ready) {
      await new Promise(function(resolve) {
        window.addEventListener('db-ready', resolve, { once: true });
        // 超时保护：5 秒后自动放行，避免永久挂起
        setTimeout(resolve, 5000);
      });
    }
    if (!window.__db) return;

    const mainData = await window.__db.getAppState('main');
    const tempData = await window.__db.getAppState('temp');

    if (mainData || tempData) {
      const mainTs = mainData ? (mainData._lastSaved || 0) : 0;
      const tempTs = tempData ? (tempData._tempTimestamp || 0) : 0;

      let data, isTemp;
      if (tempTs > mainTs) {
        data = tempData;
        isTemp = true;
      } else {
        data = mainData;
        isTemp = false;
      }

      // 从 DB 数据恢复 state
      const restData = Object.assign({}, data);
      delete restData._tempTimestamp;
      delete restData._lastSaved;
      const dbLoaded = Object.assign({}, state, restData, { currentMonth: new Date(restData.currentMonth || Date.now()) });
      state = dbLoaded;
      hasUnsavedChanges = isTemp;
      updateSaveButton();

      // 同步到 localStorage（保持兼容）
      const syncData = Object.assign({}, data, { currentMonth: data.currentMonth });
      if (isTemp) {
        localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(syncData));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(syncData));
      }

      // 重新渲染页面
      let page = state.currentPage || 'tasks';
      if (state.appPassword && !state.passwordUnlocked && !PASSWORD_EXEMPT_PAGES.includes(page)) {
        page = 'st-task-info';
      }
      navigateTo(page);

      console.log('[DB] 已从 SQLite 数据库加载数据' + (isTemp ? '（含未保存更改）' : ''));
    } else if (localStorage.getItem(STORAGE_KEY)) {
      // DB 没数据但 localStorage 有 → 自动迁移
      const permJson = localStorage.getItem(STORAGE_KEY);
      await window.__db.saveAppState('main', permJson);
      console.log('[DB] 数据已从 localStorage 迁移到 SQLite 数据库');
    }
  } catch(e) {
    console.warn('[DB] 加载失败，继续使用 localStorage:', e);
  }
}

// 存储容量检测：Tauri 下显示 SQLite 数据库大小，浏览器下显示 localStorage 配额
async function checkStorageQuota() {
  if (isTauriApp() && window.__db && window.__db.ready) {
    try {
      const dbSize = await window.__db.getDbSize();
      const dbMB = (dbSize / (1024 * 1024)).toFixed(2);
      return { used: dbSize, usedMB: dbMB, pct: '0', limitMB: '无限制', nearLimit: false, isDb: true };
    } catch(e) {
      console.warn('[Storage] Failed to get DB size:', e);
    }
  }
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    used += (key.length + (localStorage.getItem(key) || '').length) * 2;
  }
  const limitMB = 5;
  const usedMB = (used / (1024 * 1024)).toFixed(1);
  const pct = ((used / (limitMB * 1024 * 1024)) * 100).toFixed(0);
  return { used: used, usedMB: usedMB, pct: pct, limitMB: limitMB, nearLimit: pct > 80, isDb: false };
}

let __dbWriteErrorShown = false; // 防止 SQLite 写入失败时反复弹 toast

// === 性能优化：saveState 防抖合并 ===
// 原 saveState 被 71 处调用、每次编辑都全量序列化+双写（localStorage+SQLite 大字段 UPDATE）。
// 现改为防抖：300ms 内连续编辑合并为一次写入，避免批量操作时重复全量写库。
let _saveStateTimer = null;       // 防抖定时器
let _saveStatePending = false;    // 是否有待写入
let _saveStateLatest = null;      // 最新待写数据

function saveState(opts) {
  // 可选：先压一份快照到 undo 栈（仅对破坏性操作传 {pushUndo:true}）
  if (opts && opts.pushUndo) {
    if (!state._undoStack) { state._undoStack = []; state._redoStack = []; }
    if (state._undoStack.length >= 5) state._undoStack.shift();
    state._undoStack.push(_cloneStateForUndo(state));
    state._redoStack = [];
    updateUndoRedoButtons();
  }
  // 同步记录最新状态（确保防抖期间用最新数据）
  _saveStateLatest = getSerializableState({ _tempTimestamp: Date.now() });
  _saveStatePending = true;
  hasUnsavedChanges = true;
  updateSaveButton();
  // 防抖：300ms 内合并多次调用为一次写入
  if (_saveStateTimer) clearTimeout(_saveStateTimer);
  _saveStateTimer = setTimeout(_flushSaveState, 300);
}

// 撤销栈深度上限
const UNDO_LIMIT = 5;
// 用于撤销/重做的轻量深拷贝（只拷贝破坏性操作关心的字段，避免大对象全拷）
function _cloneStateForUndo(src) {
  return {
    students: JSON.parse(JSON.stringify(src.students || [])),
    scores: JSON.parse(JSON.stringify(src.scores || [])),
    scoreHistory: JSON.parse(JSON.stringify(src.scoreHistory || [])),
    tasks: JSON.parse(JSON.stringify(src.tasks || [])),
    homeworkRecords: JSON.parse(JSON.stringify(src.homeworkRecords || [])),
    studentTasks: JSON.parse(JSON.stringify(src.studentTasks || [])),
    chatMessages: JSON.parse(JSON.stringify(src.chatMessages || [])),
    plans: JSON.parse(JSON.stringify(src.plans || [])),
    progress: JSON.parse(JSON.stringify(src.progress || [])),
    schedulePeriods: JSON.parse(JSON.stringify(src.schedulePeriods || [])),
    scheduleDays: JSON.parse(JSON.stringify(src.scheduleDays || [])),
    adjustments: JSON.parse(JSON.stringify(src.adjustments || [])),
    reminders: JSON.parse(JSON.stringify(src.reminders || []))
  };
}

function canUndo() { return !!(state._undoStack && state._undoStack.length > 0); }
function canRedo() { return !!(state._redoStack && state._redoStack.length > 0); }

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) {
    btnUndo.disabled = !canUndo();
    btnUndo.title = canUndo() ? '撤销 (Ctrl+Z，共 ' + state._undoStack.length + '/' + UNDO_LIMIT + ' 步)' : '无可撤销操作';
  }
  if (btnRedo) {
    btnRedo.disabled = !canRedo();
    btnRedo.title = canRedo() ? '重做 (Ctrl+Y，共 ' + state._redoStack.length + '/' + UNDO_LIMIT + ' 步)' : '无可重做操作';
  }
  // 同步折叠菜单里的撤销/重做项
  const mUndo = document.getElementById('menuItemUndo');
  const mRedo = document.getElementById('menuItemRedo');
  if (mUndo) { mUndo.disabled = !canUndo(); mUndo.title = btnUndo ? btnUndo.title : ''; }
  if (mRedo) { mRedo.disabled = !canRedo(); mRedo.title = btnRedo ? btnRedo.title : ''; }
}

function undoState() {
  if (!canUndo()) { showToast('没有可撤销的操作', 'info'); return; }
  const prev = state._undoStack.pop();
  // 把当前状态压到 redo 栈
  if (!state._redoStack) state._redoStack = [];
  if (state._redoStack.length >= UNDO_LIMIT) state._redoStack.shift();
  state._redoStack.push(_cloneStateForUndo(state));
  // 还原 prev 到 state
  _restoreStateFromSnapshot(prev);
  saveState();
  updateUndoRedoButtons();
  // 重渲染当前页
  try { if (typeof renderPage === 'function') renderPage(); } catch(e) { console.warn('撤销后渲染失败:', e); }
  closeUndoRedoMenu();
  closeMoreMenu();
  showToast('已撤销 (剩余 ' + state._undoStack.length + ' 步)', 'success');
}

function redoState() {
  if (!canRedo()) { showToast('没有可重做的操作', 'info'); return; }
  const next = state._redoStack.pop();
  if (!state._undoStack) state._undoStack = [];
  if (state._undoStack.length >= UNDO_LIMIT) state._undoStack.shift();
  state._undoStack.push(_cloneStateForUndo(state));
  _restoreStateFromSnapshot(next);
  saveState();
  updateUndoRedoButtons();
  try { if (typeof renderPage === 'function') renderPage(); } catch(e) { console.warn('重做后渲染失败:', e); }
  closeUndoRedoMenu();
  closeMoreMenu();
  showToast('已重做', 'success');
}

function toggleUndoRedoMenu() {
  let menu = document.getElementById('undoRedoMenu');
  let btn = document.getElementById('btnUndoRedoFold');
  if (!menu || !btn) return;
  if (menu.hasAttribute('hidden')) {
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    menu.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
  }
}

function closeUndoRedoMenu() {
  let menu = document.getElementById('undoRedoMenu');
  let btn = document.getElementById('btnUndoRedoFold');
  if (menu && !menu.hasAttribute('hidden')) menu.setAttribute('hidden', '');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// 更多折叠（状态/数据/主题）——与撤销/重做折叠同机制
function toggleMoreMenu() {
  let menu = document.getElementById('moreMenu');
  let btn = document.getElementById('btnMoreFold');
  if (!menu || !btn) return;
  // 打开「更多」时先收起「撤销/重做」，避免两个菜单同时展开
  closeUndoRedoMenu();
  if (menu.hasAttribute('hidden')) {
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    menu.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
  }
}

function closeMoreMenu() {
  const menu = document.getElementById('moreMenu');
  let btn = document.getElementById('btnMoreFold');
  if (menu && !menu.hasAttribute('hidden')) menu.setAttribute('hidden', '');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// 顶栏融合拖拽滚动：长按兜底 + 移动即时拖，点按钮不受影响
// 顶栏滚动开关（默认开启，localStorage 持久化）。注意：state 会被整体恢复逻辑覆盖（state = ...），
// 故不能放在 state 里，必须用独立全局变量
let __topBarScrollEnabled = (localStorage.getItem('pa_topbar_scroll') !== 'off');

function enableTopBarDragScroll() {
  let bar = document.querySelector('.top-bar');
  if (!bar) return;
  // 07 开启时拖动整条 .top-bar（CSS 把 .top-bar 设为 overflow-x:auto，right 不收缩撑到 max-content）
  // 07 关闭时 onDown 直接 return，不响应拖动；其余事件始终监听以便快速响应 07 切换
  if (bar.__topBarDragScrollBound) return; // 幂等：避免重复绑定
  bar.__topBarDragScrollBound = true;
  let isDown = false, startX = 0, startScroll = 0, moved = false, longPressed = false, longPressTimer = null;
  const THRESHOLD = 6;
  function pageX(e) { return e.touches && e.touches.length ? e.touches[0].pageX : e.pageX; }
  function onDown(e) {
    if (!__topBarScrollEnabled) return;
    if (e.button !== undefined && e.button !== 0) return;
    isDown = true; moved = false; longPressed = false;
    startX = pageX(e);
    startScroll = bar.scrollLeft;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(function() {
      longPressed = true;
      bar.classList.add('dragging');
    }, 450);
  }
  function onMove(e) {
    if (!__topBarScrollEnabled) return;
    if (!isDown) return;
    const dx = pageX(e) - startX;
    if (Math.abs(dx) > THRESHOLD) {
      clearTimeout(longPressTimer);
      moved = true;
      bar.classList.add('dragging');
      if (e.cancelable) e.preventDefault();
      bar.scrollLeft = startScroll - dx;
    }
  }
  function onUp() {
    if (!isDown) return;
    isDown = false;
    clearTimeout(longPressTimer);
    bar.classList.remove('dragging');
    if (moved) {
      const capture = function(ev) {
        ev.stopPropagation();
        if (ev.cancelable) ev.preventDefault();
        document.removeEventListener('click', capture, true);
      };
      setTimeout(function() { document.addEventListener('click', capture, true); }, 0);
    }
  }
  bar.addEventListener('mousedown', onDown);
  bar.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  bar.addEventListener('touchstart', onDown, { passive: true });
  bar.addEventListener('touchmove', onMove, { passive: false });
  bar.addEventListener('touchend', onUp);
  updateTopBarDragState();
  window.addEventListener('resize', updateTopBarDragState);
}

// 顶栏滚动开关逻辑：开启时整条顶栏右侧允许收缩并显示滚动条（加 .can-drag + .top-bar-overflow），关闭时还原
// 07 开关即"可滑动模式"的唯一门控：开 → 顶栏可拖；关 → 顶栏不可拖。不再依赖"是否真实溢出"，因为顶级约束会死锁（要求 overflow:visible 的盒子先收缩才能让 scrollWidth>clientWidth 成立）
function updateTopBarDragState() {
  const bar = document.querySelector('.top-bar');
  if (!bar) return;
  if (__topBarScrollEnabled) {
    bar.classList.add('can-drag');
    bar.classList.add('top-bar-overflow');
  } else {
    bar.classList.remove('can-drag');
    bar.classList.remove('top-bar-overflow');
    bar.classList.remove('dragging');
  }
}

// 07 顶栏滚动：点击切换顶栏拖动横移功能
function toggleTopBarScroll() {
  __topBarScrollEnabled = !__topBarScrollEnabled;
  try { localStorage.setItem('pa_topbar_scroll', __topBarScrollEnabled ? 'on' : 'off'); } catch (e) {}
  updateTopBarDragState();
  const nav = document.getElementById('navTopBarScroll');
  if (nav) nav.classList.toggle('ts-on', __topBarScrollEnabled);
  showToast(__topBarScrollEnabled ? '顶栏滚动已开启（可拖动顶栏查看全部按钮）' : '顶栏滚动已关闭', 'info');
}

function _restoreStateFromSnapshot(snap) {
  const keys = Object.keys(snap);
  keys.forEach(function(k) {
    if (k === 'currentMonth') return; // 保持当前月份不变
    state[k] = snap[k];
  });
}

// 实际执行写入（防抖触发）
function _flushSaveState() {
  _saveStateTimer = null;
  if (!_saveStatePending) return;
  _saveStatePending = false;
  let toSave = _saveStateLatest;
  _saveStateLatest = null;
  const json = JSON.stringify(toSave);
  // localStorage 兜底（大 state 可能超 5MB 配额，try/catch 容错不崩）
  try { localStorage.setItem(TEMP_STORAGE_KEY, json); } catch(e) {
    console.warn('[DB] localStorage 写入失败（可能超配额），数据已在 SQLite:', e);
  }
  // Tauri 环境：写入 SQLite 数据库（非阻塞，失败时提示一次）
  if (isTauriApp() && window.__db && window.__db.ready) {
    window.__db.saveAppState('temp', json).catch(function(e) {
      console.warn('[DB] 临时存储写入失败:', e);
      if (!__dbWriteErrorShown) {
        __dbWriteErrorShown = true;
        showToast('数据库写入异常，数据已暂存到浏览器缓存。请尝试点击「💾保存」', 'warn');
        setTimeout(function() { __dbWriteErrorShown = false; }, 30000);
      }
    });
  }
}

async function commitSave() {
  // 取消待执行的防抖写入（接下来直接写 main，覆盖 temp）
  if (_saveStateTimer) { clearTimeout(_saveStateTimer); _saveStatePending = false; _saveStateTimer = null; }
  // 手动保存：将临时数据写入永久存储（覆盖之前的数据）
  const toSave = getSerializableState({ _lastSaved: Date.now() });
  delete toSave._tempTimestamp;
  let saveJson = JSON.stringify(toSave);
  localStorage.setItem(STORAGE_KEY, saveJson);
  localStorage.removeItem(TEMP_STORAGE_KEY);
  // Tauri 环境：写入 SQLite 数据库永久存储（await 确保写入成功）
  if (isTauriApp() && window.__db && window.__db.ready) {
    try {
      await window.__db.saveAppState('main', saveJson);
      // 清除 SQLite 临时存储
      await window.__db.conn.execute("DELETE FROM app_state WHERE state_key = 'temp'");
    } catch(e) {
      console.error('[DB] 永久存储写入失败:', e);
      showToast('⚠️ 数据库保存失败！数据已备份到浏览器缓存，请重启应用后重试。错误：' + (e.message || e), 'error');
      hasUnsavedChanges = true;
      updateSaveButton();
      return;
    }
  }
  hasUnsavedChanges = false;
  updateSaveButton();

  // 本地文件写入（浏览器版File System Access API）
  writeToLocalFile();
  // 桌面版Electron本地文件写入
  writeToElectronFile();

  showToast('数据已保存到本地', 'success');

  updateMobileTabBadges();

  // 存储空间配额检测
  const quota = await checkStorageQuota();
  if (quota.nearLimit) {
    showToast('存储空间已使用 ' + quota.usedMB + 'MB / ' + quota.limitMB + 'MB (' + quota.pct + '%)，建议定期清理历史数据', 'warn');
  }
}

async function persistState() {
  // 取消待执行的防抖写入（接下来直接写 main）
  if (_saveStateTimer) { clearTimeout(_saveStateTimer); _saveStatePending = false; _saveStateTimer = null; }
  // 系统级持久化（云端同步等场景使用，直接写入永久存储）
  const toSave = getSerializableState({ _lastSaved: Date.now() });
  const saveJson = JSON.stringify(toSave);
  localStorage.setItem(STORAGE_KEY, saveJson);
  localStorage.removeItem(TEMP_STORAGE_KEY);
  // Tauri 环境：写入 SQLite 数据库
  if (isTauriApp() && window.__db && window.__db.ready) {
    try {
      await window.__db.saveAppState('main', saveJson);
      await window.__db.conn.execute("DELETE FROM app_state WHERE state_key = 'temp'");
    } catch(e) {
      console.error('[DB] 持久化写入失败:', e);
    }
  }
  hasUnsavedChanges = false;
  updateSaveButton();
}

let _unsavedReminderTimer = null;

function updateSaveButton() {
  const btn = document.getElementById('saveBtn');
  const text = document.getElementById('saveBtnText');
  if (!btn || !text) return;
  if (hasUnsavedChanges) {
    btn.classList.add('unsaved');
    btn.classList.remove('saved');
    text.textContent = '未保存 *';
    // 5分钟后提醒用户保存
    if (_unsavedReminderTimer) clearTimeout(_unsavedReminderTimer);
    _unsavedReminderTimer = setTimeout(() => {
      if (hasUnsavedChanges) {
        showToast('您有未保存的更改，请点击「未保存 *」按钮或按 Ctrl+S 保存', 'warn');
      }
    }, 300000); // 5分钟
  } else {
    btn.classList.remove('unsaved');
    btn.classList.add('saved');
    text.textContent = '已保存';
    if (_unsavedReminderTimer) { clearTimeout(_unsavedReminderTimer); _unsavedReminderTimer = null; }
  }
}

/* ===================== Cloud Sync (S3 按班级) ===================== */


function classToObjectKey(cls) {
  return 'class_' + cls.replace('班', '') + '.json';
}


// ── 云同步栏目树（按派大星工作台真实业务板块划分）──
const CLOUD_SECTIONS = [
  { id: 'center', label: '派大星的统筹中心', icon: '\u{1F5C2}', children: [
    { key: 'tasks', label: '任务清单', scope: 'global' },
    { key: 'plans', label: '教学计划', scope: 'global' },
    { key: 'schedule', label: '智能课程表', scope: 'global', keys: ['schedule', 'schedulePeriods', 'scheduleDays', 'adjustments'] },
    { key: 'progress', label: '教学进度', scope: 'global' },
    { key: 'reminders', label: '提醒事项', scope: 'global' },
    { key: 'folders', label: '文件夹', scope: 'global' }
  ]},
  { id: 'student-mgmt', label: '派大星的学生日常管理', icon: '\u{1F465}', children: [
    { key: 'students', label: '学生档案总库', scope: 'class', classField: 'classId' }
  ]},
  { id: 'student-tasks', label: '学生工作任务', icon: '\u{1F4DD}', children: [
    { key: 'studentTasks', label: '01 任务信息', scope: 'class', classField: 'classIds' },
    { key: 'homeworkRecords', label: '02 作业登记', scope: 'class', classField: 'classId' },
    { key: 'chatMessages', label: '03 聊天框', scope: 'class', classField: 'classId' }
  ]},
  { id: 'learning', label: '学生学情分析', icon: '\u{1F4CA}', children: [
    { key: 'scores', label: '学生成绩分析', scope: 'global' }
  ]},
  { id: 'xiuxian', label: '生物仙途秘境', icon: '\u{1F9EC}', children: [
    { key: 'xiuxian', label: '01 修仙档案总库', scope: 'class', classField: 'classId' },
    { key: 'scoreHistory', label: '灵石积分记录', scope: 'global' }
  ]}
];
const CLOUD_LEAF_MAP = {};
CLOUD_SECTIONS.forEach(function(g) { g.children.forEach(function(c) { CLOUD_LEAF_MAP[c.key] = c; }); });
function cloudLeafByKey(k) { return CLOUD_LEAF_MAP[k]; }
const CLOUD_DEFAULT_SECTIONS = ['homeworkRecords', 'studentTasks', 'chatMessages', 'students', 'scores', 'xiuxian', 'scoreHistory'];
function cloudSectionKeysAll() { return Object.keys(CLOUD_LEAF_MAP); }

function s3Configured(strict) {
  let cfg = state.cstcloudConfig || {};
  if (strict) {
    return cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey;
  }
  return cfg.endpoint && cfg.accessKey;
}

// 从后端同步 S3 配置到前端 state（启动时调用一次）
// 后端 s3_config.json 是权威源，确保前端 state 与后端一致
async function syncS3ConfigFromBackend() {
  if (!isTauriApp()) return;
  try {
    let cfg = await __invoke('get_s3_config_status');
    if (cfg) {
      // 后端有配置：同步非敏感字段到前端 state（不覆盖 state 中已有的 secretKey）
      state.cstcloudConfig = state.cstcloudConfig || {};
      state.cstcloudConfig.endpoint = cfg.endpoint || state.cstcloudConfig.endpoint || '';
      state.cstcloudConfig.bucket = cfg.bucket || state.cstcloudConfig.bucket || '';
      state.cstcloudConfig.accessKey = cfg.accessKey || state.cstcloudConfig.accessKey || '';
      state.cstcloudConfig.region = cfg.region || state.cstcloudConfig.region || 'us-east-1';
      console.log('[Cloud] S3 配置已从后端同步');
    } else if (state.cstcloudConfig && state.cstcloudConfig.endpoint && state.cstcloudConfig.accessKey && state.cstcloudConfig.secretKey) {
      // 后端无配置但前端 state 有（从旧版本升级）：迁移到后端
      await __invoke('save_s3_config', {
        endpoint: state.cstcloudConfig.endpoint,
        bucket: state.cstcloudConfig.bucket || '',
        accessKey: state.cstcloudConfig.accessKey,
        secretKey: state.cstcloudConfig.secretKey,
        region: state.cstcloudConfig.region || 'us-east-1'
      });
      console.log('[Cloud] 前端 S3 配置已迁移到后端');
    }
  } catch(e) {
    console.warn('[Cloud] 从后端同步 S3 配置失败:', e);
  }
}

let _autoCloudPullDone = false;
function autoCloudPullOnStart() {
  if (_autoCloudPullDone) return;
  _autoCloudPullDone = true;
  const dl = state.cloudDownloadSections || [];
  const dlSecCls = state.cloudDownloadSectionClasses || {};
  if (state.cloudAutoSync && s3Configured() && dl.length) {
    const cls2secs = cloudBuildClassToSectionsMap(dl, dlSecCls);
    const allClasses = Object.keys(cls2secs);
    if (allClasses.length === 0) return;
    updateSyncIndicator('syncing');
    const globalLeaves = dl.map(cloudLeafByKey).filter(function(l) { return l && l.scope === 'global'; });
    const tasks = allClasses.map(function(cls) { return cloudPullByClass(cls, cls2secs[cls]); });
    if (globalLeaves.length) tasks.push(cloudPullGlobal(globalLeaves.map(function(l) { return l.key; })));
    Promise.all(tasks).then(function(res) {
      updateSyncIndicator('synced');
      if (res.some(function(x) { return x; })) {
        let p = state.currentPage || 'tasks';
        if (state.appPassword && !state.passwordUnlocked && !PASSWORD_EXEMPT_PAGES.includes(p)) p = 'st-task-info';
        navigateTo(p);
      }
      console.log('[Cloud] 启动自动下载完成');
    }).catch(function(e) {
      console.warn('[Cloud] Auto-download failed:', e);
      updateSyncIndicator('error');
    });
  }
}

async function cloudPushByClass(cls, sectionKeys) {
  if (!cls) { showToast('请先选择班级', 'warn'); return false; }
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  let payload = { classId: cls, ts: Date.now() };
  sectionKeys.forEach(function(k) {
    let leaf = cloudLeafByKey(k);
    if (leaf && leaf.scope === 'class') {
      const v = cloudExtractLeaf(leaf, cls);
      if (v !== null) payload[k] = v;
    }
  });
  let objectKey = classToObjectKey(cls);
  await __invoke('s3_upload', { objectKey: objectKey, data: JSON.stringify(payload) });
  state.cloudLastPush = Date.now();
  saveState();
  return true;
}

async function cloudPushGlobal(sectionKeys) {
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  // 「文件夹」走独立的磁盘→S3 通道（folder_cloud_push），不进 global.json
  let hasFolders = sectionKeys.indexOf('folders') >= 0;
  let nonFolderKeys = sectionKeys.filter(function (k) { return k !== 'folders'; });
  // 全局数据（global.json）通道：失败仅提示，不阻断文件夹上传
  if (nonFolderKeys.length) {
    const payload = { ts: Date.now() };
    nonFolderKeys.forEach(function(k) {
      let leaf = cloudLeafByKey(k);
      if (!leaf || leaf.scope !== 'global') return;
      if (leaf.keys) { leaf.keys.forEach(function(f) { payload[f] = state[f]; }); }
      else { payload[k] = state[k]; }
    });
    try {
      await __invoke('s3_upload', { objectKey: 'global.json', data: JSON.stringify(payload) });
    } catch (e) {
      console.warn('[Cloud] 全局数据上传失败：', e);
      showToast('全局数据上传失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    }
  }
  state.cloudLastPush = Date.now();
  // 文件夹通道：与 global.json 解耦，独立成败
  if (hasFolders) {
    try {
      let r = await __invoke('folder_cloud_push');
      console.log('[Cloud] 文件夹云上传完成，共 ' + ((r && r.uploaded) || 0) + ' 个文件');
    } catch (e) {
      console.warn('[Cloud] 文件夹云上传失败：', e);
      showToast('文件夹上传失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    }
  }
  saveState();
  return true;
}

async function cloudPullByClass(cls, sectionKeys) {
  if (!cls) { showToast('请先选择班级', 'warn'); return false; }
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  const objectKey = classToObjectKey(cls);
  let data;
  try { data = await __invoke('s3_download', { objectKey: objectKey }); }
  catch(e) {
    let errMsg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
    if (errMsg.indexOf('NOT_FOUND') >= 0) { showToast('云端暂无 ' + cls + ' 的数据', 'info'); return false; }
    throw e;
  }
  let cloudData = JSON.parse(data);
  sectionKeys.forEach(function(k) {
    let leaf = cloudLeafByKey(k);
    if (leaf && leaf.scope === 'class' && cloudData[k] !== undefined) cloudMergeLeaf(leaf, cloudData[k], cls);
  });
  state.cloudLastPull = Date.now();
  saveState();
  return true;
}

async function cloudPullGlobal(sectionKeys) {
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  // 「文件夹」走独立的 S3→磁盘 通道（folder_cloud_pull），与 global.json 解耦
  const hasFolders = sectionKeys.indexOf('folders') >= 0;
  const nonFolderKeys = sectionKeys.filter(function (k) { return k !== 'folders'; });
  if (nonFolderKeys.length) {
    let data;
    try { data = await __invoke('s3_download', { objectKey: 'global.json' }); }
    catch (e) {
      const errMsg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
      if (errMsg.indexOf('NOT_FOUND') >= 0) { showToast('云端暂无全局数据', 'info'); }
      else throw e;
    }
    if (data) {
      const cloudData = JSON.parse(data);
      nonFolderKeys.forEach(function(k) {
        const leaf = cloudLeafByKey(k);
        if (!leaf || leaf.scope !== 'global') return;
        if (leaf.keys) { leaf.keys.forEach(function(f) { if (cloudData[f] !== undefined) state[f] = cloudData[f]; }); }
        else if (cloudData[k] !== undefined) { state[k] = cloudData[k]; }
      });
    }
  }
  state.cloudLastPull = Date.now();
  if (hasFolders) {
    try {
      const r = await __invoke('folder_cloud_pull');
      console.log('[Cloud] 文件夹云下载完成，共 ' + ((r && r.downloaded) || 0) + ' 个文件');
    } catch (e) {
      console.warn('[Cloud] 文件夹云下载失败：', e);
      showToast('文件夹下载失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    }
  }
  saveState();
  return true;
}

async function cloudTestConnection() {
  // 测试前先从输入框读取最新值，避免用户忘记点保存或 state 被旧数据覆盖
  let endpoint = (document.getElementById('s3-endpoint').value || '').trim();
  if (endpoint && !endpoint.match(/^https?:\/\//i)) endpoint = 'https://' + endpoint;
  state.cstcloudConfig = state.cstcloudConfig || {};
  state.cstcloudConfig.endpoint = endpoint;
  state.cstcloudConfig.bucket = (document.getElementById('s3-bucket').value || '').trim();
  state.cstcloudConfig.accessKey = (document.getElementById('s3-accesskey').value || '').trim();
  state.cstcloudConfig.secretKey = (document.getElementById('s3-secretkey').value || '').trim();
  state.cstcloudConfig.region = (document.getElementById('s3-region').value || '').trim() || 'us-east-1';
  saveState();

  if (!s3Configured(true)) {
    let cfg = state.cstcloudConfig || {};
    const missing = [];
    if (!cfg.endpoint) missing.push('Endpoint');
    if (!cfg.bucket) missing.push('Bucket');
    if (!cfg.accessKey) missing.push('AccessKey ID');
    if (!cfg.secretKey) missing.push('Secret Access Key');
    showToast('请先完整填写 S3 配置：' + missing.join('、'), 'warn');
    return false;
  }
  // 基础格式校验
  const cfg = state.cstcloudConfig;
  if (!cfg.endpoint.match(/^https?:\/\//i)) {
    cfg.endpoint = 'https://' + cfg.endpoint;
  }
  if (!cfg.region) cfg.region = 'us-east-1';
  saveState();

  // 保存配置到后端文件（凭据不再通过 IPC 在每次同步时反复传递）
  try {
    await __invoke('save_s3_config', {
      endpoint: cfg.endpoint,
      bucket: cfg.bucket,
      accessKey: cfg.accessKey,
      secretKey: cfg.secretKey,
      region: cfg.region
    });
    console.log('[Cloud] S3 配置已保存到后端');
  } catch(e) {
    showToast('保存配置到后端失败: ' + (e.message || String(e)), 'error');
    return false;
  }

  // 测试连接（不传凭据，后端从配置文件读取）
  try {
    updateSyncIndicator('syncing');
    await __invoke('s3_test');
    updateSyncIndicator('synced');
    showToast('数据胶囊连接成功', 'success');
    return true;
  } catch(e) {
    updateSyncIndicator('error');
    const raw = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
    let msg = raw;
    if (typeof raw === 'string' && raw.includes('401')) {
      msg = 'HTTP 401 Unauthorized（凭证错误）。请按顺序检查：1. Bucket 名称是否填成了 AccessKey ID；2. Secret Access Key 是否完整复制（含斜杠前部分）；3. AccessKey ID 与 Secret Key 是否配对且未过期。';
    } else if (typeof raw === 'string' && raw.includes('404')) {
      msg = 'HTTP 404 Not Found。Bucket 名称可能不存在或 endpoint 错误，请到中国科技云数据胶囊控制台核对。';
    } else if (typeof raw === 'string' && raw.includes('403')) {
      msg = 'HTTP 403 Forbidden。AccessKey 权限不足或已过期，请在控制台重新创建密钥。';
    }
    showToast('连接失败: ' + msg, 'error');
    return false;
  }
}

function saveCstcloudConfig() {
  let endpoint = (document.getElementById('s3-endpoint').value || '').trim();
  if (endpoint && !endpoint.match(/^https?:\/\//i)) {
    endpoint = 'https://' + endpoint;
  }
  state.cstcloudConfig.endpoint = endpoint;
  state.cstcloudConfig.bucket = (document.getElementById('s3-bucket').value || '').trim();
  state.cstcloudConfig.accessKey = (document.getElementById('s3-accesskey').value || '').trim();
  state.cstcloudConfig.secretKey = (document.getElementById('s3-secretkey').value || '').trim();
  state.cstcloudConfig.region = (document.getElementById('s3-region').value || '').trim() || 'us-east-1';
  saveState();
  // 同步保存到后端配置文件（凭据不再通过 IPC 在每次同步时传递）
  if (isTauriApp()) {
    __invoke('save_s3_config', {
      endpoint: state.cstcloudConfig.endpoint,
      bucket: state.cstcloudConfig.bucket,
      accessKey: state.cstcloudConfig.accessKey,
      secretKey: state.cstcloudConfig.secretKey,
      region: state.cstcloudConfig.region
    }).then(function() {
      console.log('[Cloud] S3 配置已同步到后端');
    }).catch(function(e) {
      console.error('[Cloud] 保存到后端失败:', e);
      showToast('警告：配置已保存到本地，但同步到后端失败', 'warn');
    });
  }
  showToast('S3 配置已保存', 'success');
  updateSyncModal();
}

/* ========== 关闭确认弹窗 ========== */
function _injectCloseConfirmStyle() {
  if (document.getElementById('close-confirm-style')) return;
  const st = document.createElement('style');
  st.id = 'close-confirm-style';
  st.textContent =
    '@keyframes ccFadeIn{from{opacity:0}to{opacity:1}}' +
    '@keyframes ccPopIn{0%{opacity:0;transform:translateY(16px) scale(.94)}100%{opacity:1;transform:translateY(0) scale(1)}}' +
    '@keyframes ccSpin{to{transform:rotate(360deg)}}' +
    '.cc-overlay{position:fixed;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);z-index:10000;display:flex;align-items:center;justify-content:center;animation:ccFadeIn .18s ease}' +
    '.cc-dialog{background:let(--bg-card);border:1px solid let(--border);border-radius:16px;padding:26px 24px 22px;width:376px;max-width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(0,0,0,.28);animation:ccPopIn .24s cubic-bezier(.34,1.4,.64,1);font-family:inherit}' +
    '.cc-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px;background:linear-gradient(135deg,let(--primary),let(--primary-dark,let(--primary)));box-shadow:0 6px 18px rgba(0,0,0,.16)}' +
    '.cc-title{font-size:17px;font-weight:600;color:let(--text-heading);text-align:center;margin-bottom:8px}' +
    '.cc-desc{font-size:13px;color:let(--text-muted);text-align:center;line-height:1.65;margin-bottom:18px}' +
    '.cc-tag{display:inline-block;padding:1px 7px;border-radius:6px;background:let(--primary);color:#fff;font-size:12px;font-weight:600;margin:0 2px}' +
    '.cc-warn{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:9px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.28);font-size:12.5px;color:#b45309;margin-bottom:16px;line-height:1.5}' +
    '.cc-btns{display:flex;flex-direction:column;gap:9px}' +
    '.cc-row{display:flex;gap:9px}' +
    '.cc-btn{flex:1;padding:11px 16px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;transition:all .16s ease;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px}' +
    '.cc-btn:disabled{opacity:.55;cursor:not-allowed}' +
    '.cc-btn-primary{border:none;background:let(--primary);color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.14)}' +
    '.cc-btn-primary:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.2)}' +
    '.cc-btn-default{border:1px solid let(--border);background:transparent;color:let(--text-body)}' +
    '.cc-btn-default:hover:not(:disabled){background:let(--bg-hover,rgba(127,127,127,.09));border-color:let(--primary)}' +
    '.cc-btn-ghost{border:1px solid transparent;background:transparent;color:let(--text-muted)}' +
    '.cc-btn-ghost:hover:not(:disabled){background:let(--bg-hover,rgba(127,127,127,.09));color:let(--text-body)}' +
    '.cc-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:ccSpin .7s linear infinite}' +
    '.cc-progress{display:flex;align-items:center;justify-content:center;gap:9px;padding:13px;font-size:13.5px;color:let(--text-body)}' +
    '.cc-progress .cc-spinner{border-color:let(--border);border-top-color:let(--primary)}';
  document.head.appendChild(st);
}

function showCloseConfirm() {
  if (document.getElementById('close-confirm-modal')) return;
  _injectCloseConfirmStyle();
  let ul = state.cloudUploadSections || [];
  let ulSecCls = state.cloudUploadSectionClasses || {};
  let cls2secs = cloudBuildClassToSectionsMap(ul, ulSecCls);
  let classes = Object.keys(cls2secs);
  const canUpload = s3Configured() && classes.length > 0;
  const unsaved = (typeof hasUnsavedChanges !== 'undefined') && hasUnsavedChanges;
  const overlay = document.createElement('div');
  overlay.id = 'close-confirm-modal';
  overlay.className = 'cc-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'cc-dialog';
  const icon = document.createElement('div');
  icon.className = 'cc-icon';
  icon.textContent = canUpload ? '☁️' : '👋';
  dialog.appendChild(icon);
  const title = document.createElement('div');
  title.className = 'cc-title';
  title.textContent = '确认关闭工作台';
  dialog.appendChild(title);
  const desc = document.createElement('div');
  desc.className = 'cc-desc';
  if (canUpload) {
    desc.innerHTML = '退出前是否把 <span class="cc-tag">' + escapeHtml(classes.join('、')) + '</span> 的数据上传到云端？<br>建议上传，避免换设备时数据不同步。';
  } else if (s3Configured()) {
    desc.textContent = '尚未选择同步栏目或班级，无法上传云端。可到「云同步」面板选择后再退出。';
  } else {
    desc.textContent = '尚未配置数据胶囊 S3，本次将不会上传云端。';
  }
  dialog.appendChild(desc);
  if (unsaved) {
    const warn = document.createElement('div');
    warn.className = 'cc-warn';
    warn.innerHTML = '<span>⚠️</span><span>有未保存的修改，退出前会自动保存到本地</span>';
    dialog.appendChild(warn);
  }
  const btns = document.createElement('div');
  btns.className = 'cc-btns';
  let btnUpload = null;
  if (canUpload) {
    btnUpload = document.createElement('button');
    btnUpload.className = 'cc-btn cc-btn-primary';
    btnUpload.innerHTML = '<span>☁️</span><span>上传后退出</span>';
    btns.appendChild(btnUpload);
  }
  const row = document.createElement('div');
  row.className = 'cc-row';
  const btnDirect = document.createElement('button');
  btnDirect.className = canUpload ? 'cc-btn cc-btn-default' : 'cc-btn cc-btn-primary';
  btnDirect.textContent = '直接退出';
  row.appendChild(btnDirect);
  const btnCancel = document.createElement('button');
  btnCancel.className = canUpload ? 'cc-btn cc-btn-ghost' : 'cc-btn cc-btn-default';
  btnCancel.textContent = '取消';
  row.appendChild(btnCancel);
  btns.appendChild(row);
  dialog.appendChild(btns);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  function closeModal() {
    document.removeEventListener('keydown', onKey);
    if (overlay.parentNode) overlay.remove();
  }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) closeModal(); });
  btnCancel.onclick = closeModal;
  btnDirect.onclick = function() { closeModal(); doCloseDirect(); };
  if (btnUpload) {
    btnUpload.onclick = function() {
      btnUpload.disabled = true; btnDirect.disabled = true; btnCancel.disabled = true;
      btns.innerHTML = '';
      const prog = document.createElement('div');
      prog.className = 'cc-progress';
      prog.innerHTML = '<div class="cc-spinner"></div><span>正在上传 ' + escapeHtml(classes.join('、')) + ' 数据到云端…</span>';
      btns.appendChild(prog);
      doCloseWithUpload(function(ok, msg) {
        if (!ok) {
          prog.remove();
          const errBox = document.createElement('div');
          errBox.className = 'cc-warn';
          errBox.innerHTML = '<span>❌</span><span>上传失败：' + escapeHtml(msg || '未知错误') + '</span>';
          btns.appendChild(errBox);
          const row2 = document.createElement('div');
          row2.className = 'cc-row';
          const retry = document.createElement('button');
          retry.className = 'cc-btn cc-btn-default';
          retry.textContent = '重试上传';
          retry.onclick = function() { closeModal(); showCloseConfirm(); };
          const force = document.createElement('button');
          force.className = 'cc-btn cc-btn-primary';
          force.textContent = '仍然退出';
          force.onclick = function() { closeModal(); doCloseDirect(); };
          row2.appendChild(retry); row2.appendChild(force);
          btns.appendChild(row2);
        }
      });
    };
  }
}

// 关闭前落盘本地数据，避免丢失
async function _saveBeforeExit() {
  try {
    if (typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges && typeof commitSave === 'function') {
      await commitSave();
    }
  } catch(e) { console.warn('[Exit] save before exit failed:', e); }
}

async function doCloseWithUpload(onResult) {
  const ul = state.cloudUploadSections || [];
  const ulSecCls = state.cloudUploadSectionClasses || {};
  let cls2secs = cloudBuildClassToSectionsMap(ul, ulSecCls);
  let classes = Object.keys(cls2secs);
  await _saveBeforeExit();
  if (classes.length && s3Configured()) {
    updateSyncIndicator('syncing');
    try {
      for (let i = 0; i < classes.length; i++) { await cloudPushByClass(classes[i], cls2secs[classes[i]]); }
      let globalLeaves = ul.map(cloudLeafByKey).filter(function(l) { return l && l.scope === 'global'; });
      if (globalLeaves.length) await cloudPushGlobal(globalLeaves.map(function(l) { return l.key; }));
      updateSyncIndicator('uploaded');
    } catch(e) {
      console.error('[Cloud] Close upload failed:', e);
      updateSyncIndicator('error');
      let msg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
      if (typeof onResult === 'function') { onResult(false, msg); return; }
      showToast('上传失败，直接关闭', 'warn');
    }
  }
  if (typeof onResult === 'function') onResult(true, '');
  try { await __invoke('exit_app'); } catch(e) { console.error('exit failed:', e); }
}

async function doCloseDirect() {
  await _saveBeforeExit();
  try { await __invoke('exit_app'); } catch(e) { console.error('exit failed:', e); }
}

// 供 Rust 后端在窗口关闭事件中回调
window.__onCloseRequested = function() {
  try { showCloseConfirm(); } catch(e) {
    console.error('[Exit] close confirm failed:', e);
    doCloseDirect();
  }
};

async function manualCloudPush() {
  let sections = cloudGetCheckedSections('up');
  if (sections.length === 0) { showToast('请至少选择一种上传栏目', 'warn'); return; }
  let secCls = {};
  sections.forEach(function(k) {
    let leaf = cloudLeafByKey(k);
    if (leaf && leaf.scope === 'class') secCls[k] = cloudGetSectionClassesFromDOM('up', k);
  });
  let cls2secs = cloudBuildClassToSectionsMap(sections, secCls);
  let classes = Object.keys(cls2secs);
  if (classes.length === 0) { showToast('请为所选班级栏目勾选至少一个班级', 'warn'); return; }
  state.cloudUploadSections = sections;
  state.cloudUploadSectionClasses = secCls;
  state.cloudSectionsConfigured = true;
  saveState();
  let btn = document.activeElement;
  if (btn && btn.tagName === 'BUTTON') { btn.disabled = true; btn.dataset.origText = btn.innerHTML; btn.innerHTML = '上传中...'; }
  updateSyncIndicator('syncing');
  try {
    for (let i = 0; i < classes.length; i++) { await cloudPushByClass(classes[i], cls2secs[classes[i]]); }
    let globalLeaves = sections.map(cloudLeafByKey).filter(function(l) { return l && l.scope === 'global'; });
    if (globalLeaves.length) await cloudPushGlobal(globalLeaves.map(function(l) { return l.key; }));
    updateSyncIndicator('uploaded');
    showToast('已上传 ' + classes.join('、') + ' 的数据到云端', 'success');
    updateSyncModal();
  } catch(e) {
    updateSyncIndicator('error');
    let msg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
    showToast('上传失败: ' + msg, 'error');
  } finally {
    if (btn && btn.tagName === 'BUTTON') { btn.disabled = false; btn.innerHTML = btn.dataset.origText || '上传到云端'; }
  }
}

async function manualCloudPull() {
  const sections = cloudGetCheckedSections('dl');
  if (sections.length === 0) { showToast('请至少选择一种下载栏目', 'warn'); return; }
  const secCls = {};
  sections.forEach(function(k) {
    const leaf = cloudLeafByKey(k);
    if (leaf && leaf.scope === 'class') secCls[k] = cloudGetSectionClassesFromDOM('dl', k);
  });
  const cls2secs = cloudBuildClassToSectionsMap(sections, secCls);
  const classes = Object.keys(cls2secs);
  if (classes.length === 0) { showToast('请为所选班级栏目勾选至少一个班级', 'warn'); return; }
  state.cloudDownloadSections = sections;
  state.cloudDownloadSectionClasses = secCls;
  state.cloudSectionsConfigured = true;
  saveState();
  const btn = document.activeElement;
  if (btn && btn.tagName === 'BUTTON') { btn.disabled = true; btn.dataset.origText = btn.innerHTML; btn.innerHTML = '下载中...'; }
  updateSyncIndicator('syncing');
  try {
    const tasks = classes.map(function(cls) { return cloudPullByClass(cls, cls2secs[cls]); });
    const globalLeaves = sections.map(cloudLeafByKey).filter(function(l) { return l && l.scope === 'global'; });
    if (globalLeaves.length) tasks.push(cloudPullGlobal(globalLeaves.map(function(l) { return l.key; })));
    const res = await Promise.all(tasks);
    updateSyncIndicator('synced');
    if (res.some(function(x) { return x; })) {
      showToast(classes.join('、') + ' 数据已从云端下载', 'success');
      navigateTo(state.currentPage || 'tasks');
    }
    updateSyncModal();
  } catch(e) {
    updateSyncIndicator('error');
    const msg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
    showToast('下载失败: ' + msg, 'error');
  } finally {
    if (btn && btn.tagName === 'BUTTON') { btn.disabled = false; btn.innerHTML = btn.dataset.origText || '从云端下载'; }
  }
}

/* ===================== Local File Sync ===================== */
async function chooseLocalFile() {
  if (!window.showSaveFilePicker) {
    showToast('当前浏览器不支持本地文件同步，请使用 Chrome 或 Edge', 'warn');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'pdx_workbench_backup.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    state.localFileHandle = handle;
    state.localFileName = handle.name;
    saveState();
    await writeToLocalFile();
    showToast('本地文件同步已开启: ' + handle.name);
    updateSyncModal();
  } catch (e) {
    if (e.name !== 'AbortError') showToast('选择文件失败: ' + e.message, 'error');
  }
}

async function writeToLocalFile() {
  if (!state.localFileHandle) return;
  try {
    const toSave = getSerializableState();
    const writable = await state.localFileHandle.createWritable();
    await writable.write(JSON.stringify(toSave, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('Local file write failed:', e);
  }
}

async function restoreLocalFile() {
  if (!window.showOpenFilePicker) {
    showToast('当前浏览器不支持本地文件恢复，请使用 Chrome 或 Edge', 'warn');
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    const file = await handle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    const { localFileHandle: _lfh, ...parsedRest } = parsed;
    state = { ...state, ...parsedRest, currentMonth: new Date(parsed.currentMonth || Date.now()) };
    state.localFileHandle = handle;
    state.localFileName = handle.name;
    saveState();
    showToast('已从本地文件恢复数据');
    navigateTo(state.currentPage || 'tasks');
  } catch (e) {
    if (e.name !== 'AbortError') showToast('恢复失败: ' + e.message, 'error');
  }
}

async function disconnectLocalFile() {
  state.localFileHandle = null;
  state.localFileName = '';
  saveState();
  showToast('已断开本地文件同步');
  updateSyncModal();
}

function updateSyncIndicator(status) {
  let el = document.getElementById('syncIndicator');
  if (!el) return;
  let map = {
    'off': { icon: '\u2601\ufe0f', text: '\u672a\u540c\u6b65', color: 'let(--text-muted)' },
    'syncing': { icon: '\ud83d\udd04', text: '\u540c\u6b65\u4e2d', color: 'let(--warning)' },
    'synced': { icon: '\u2705', text: '\u5df2\u540c\u6b65', color: 'let(--primary)' },
    'uploaded': { icon: '\u2601\ufe0f\u2b06\ufe0f', text: '\u5df2\u4e0a\u4f20', color: 'let(--info)' },
    'error': { icon: '\u26a0\ufe0f', text: '\u540c\u6b65\u5931\u8d25', color: 'let(--danger)' }
  };
  const s = map[status] || map['off'];
  el.innerHTML = '<span style="font-size:14px">' + s.icon + '</span><span style="font-size:12px;color:' + s.color + '">' + s.text + '</span>';
  el.title = '\u4e91\u7aef\u540c\u6b65 - ' + s.text;
}

function openSyncModal() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML =
    '<div class="modal-overlay" data-click="closeModal" data-click-self="1">' +
    '<div class="modal-content" style="max-width:560px;max-height:85vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
    '<h3 style="font-size:18px;font-weight:700">\u2601\ufe0f \u6570\u636e\u80f6\u56ca\u4e91\u540c\u6b65</h3>' +
    '<button class="btn-icon" data-click="closeModal">\u2715</button>' +
    '</div>' +
    '<div id="syncModalBody"></div>' +
    '</div></div>';
  updateSyncModal();
  modal.style.display = 'block';
}

const _cloudCollapsed = {}; // groupId -> true 表示该分组已折叠

function cloudExtractLeaf(leaf, cls) {
  let st = state;
  switch (leaf.key) {
    case 'homeworkRecords': return (st.homeworkRecords || []).filter(function(r) { return r.classId === cls; });
    case 'chatMessages': return (st.chatMessages || []).filter(function(m) { return m.classId === cls; });
    case 'studentTasks': return (st.studentTasks || []).filter(function(t) { return t.classIds && t.classIds.indexOf(cls) >= 0; });
    case 'students': return (st.students || []).filter(function(s) { return s.classId === cls; });
    case 'xiuxian': {
      const sub = { students: {}, meta: (st.xiuxian && st.xiuxian.meta) || {} };
      (st.students || []).forEach(function(s) {
        if (s.classId === cls && st.xiuxian && st.xiuxian.students && st.xiuxian.students[s.id]) sub.students[s.id] = st.xiuxian.students[s.id];
      });
      return sub;
    }
    default: return null;
  }
}

function cloudMergeLeaf(leaf, cloudVal, cls) {
  const st = state;
  if (!cloudVal) return;
  switch (leaf.key) {
    case 'homeworkRecords':
      st.homeworkRecords = (st.homeworkRecords || []).filter(function(r) { return r.classId !== cls; }).concat(cloudVal); break;
    case 'chatMessages':
      st.chatMessages = (st.chatMessages || []).filter(function(m) { return m.classId !== cls; }).concat(cloudVal); break;
    case 'studentTasks':
      st.studentTasks = (st.studentTasks || []).filter(function(t) { return !t.classIds || t.classIds.indexOf(cls) < 0; }).concat(cloudVal); break;
    case 'students':
      st.students = (st.students || []).filter(function(s) { return s.classId !== cls; }).concat(cloudVal); break;
    case 'xiuxian':
      if (!st.xiuxian) st.xiuxian = { students: {}, meta: {} };
      if (cloudVal.meta) st.xiuxian.meta = cloudVal.meta;
      if (cloudVal.students) { Object.keys(cloudVal.students).forEach(function(sid) { st.xiuxian.students[sid] = cloudVal.students[sid]; }); }
      break;
  }
}

function cloudBuildClassToSectionsMap(sectionKeys, sectionClassMap) {
  let map = {};
  (sectionKeys || []).forEach(function(k) {
    const leaf = cloudLeafByKey(k);
    if (!leaf || leaf.scope !== 'class') return;
    const classes = (sectionClassMap && sectionClassMap[k]) || [];
    classes.forEach(function(cls) {
      if (!map[cls]) map[cls] = [];
      if (map[cls].indexOf(k) < 0) map[cls].push(k);
    });
  });
  return map;
}

function cloudGetCheckedSections(prefix) {
  let out = [];
  cloudSectionKeysAll().forEach(function(k) {
    let el = document.getElementById('cloud-' + prefix + '-' + k);
    if (el && el.checked) out.push(k);
  });
  // 分组折叠时勾选框不渲染，回退到已持久化的选择，避免误报“未选择”
  if (out.length === 0) {
    const saved = prefix === 'up' ? state.cloudUploadSections : state.cloudDownloadSections;
    if (Array.isArray(saved) && saved.length) out = saved.slice();
  }
  return out;
}

function cloudGetSectionClassesFromDOM(prefix, secKey) {
  let out = [];
  getClasses().forEach(function(cl) {
    const el = document.getElementById('cloud-' + prefix + '-cls-' + secKey + '-' + cl);
    if (el && el.checked) out.push(cl);
  });
  // 班级勾选框在折叠分组中同样不渲染，回退到已保存的班级选择
  if (out.length === 0) {
    const map = prefix === 'up' ? state.cloudUploadSectionClasses : state.cloudDownloadSectionClasses;
    if (map && Array.isArray(map[secKey]) && map[secKey].length) out = map[secKey].slice();
  }
  return out;
}

function cloudToggleGroup(gid) {
  if (!gid) return;
  // 默认折叠：undefined → 点击展开
  if (_cloudCollapsed[gid] === undefined) {
    _cloudCollapsed[gid] = false;
  } else {
    _cloudCollapsed[gid] = !_cloudCollapsed[gid];
  }
  updateSyncModal();
}

function renderCloudSectionTree(prefix, selected, sectionClassMap) {
  let eff = selected;
  if ((!selected || selected.length === 0) && !state.cloudSectionsConfigured) eff = CLOUD_DEFAULT_SECTIONS;
  const selSet = {};
  (eff || []).forEach(function(k) { selSet[k] = true; });
  const scMap = sectionClassMap || {};
  const allClasses = getClasses();
  return CLOUD_SECTIONS.map(function(g) {
    // 默认展开，确保外层「自动上传栏目 / 自动下载栏目」展开后能看到五个子栏目的勾选项；
    // 仅当用户手动点击某分组标题折叠过（记在 _cloudCollapsed）时才收起，不再按「是否勾选」决定。
    const userCollapsed = _cloudCollapsed[g.id];
    const collapsed = userCollapsed !== undefined ? userCollapsed : false;
    const itemsHtml = collapsed ? '' : g.children.map(function(c) {
      const cid = 'cloud-' + prefix + '-' + c.key;
      const checked = selSet[c.key] ? ' checked' : '';
      if (c.scope === 'class') {
        const secClasses = scMap[c.key] || [];
        const clsSet = {};
        secClasses.forEach(function(cl) { clsSet[cl] = true; });
        const clsChecks = allClasses.map(function(cl) {
          const ccid = 'cloud-' + prefix + '-cls-' + c.key + '-' + cl;
          const cc = clsSet[cl] ? ' checked' : '';
          return '<label style="font-size:11px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;margin-right:10px"><input type="checkbox" id="' + ccid + '"' + cc + ' data-ev="change" data-ev-key="ev70"> ' + escapeHtml(cl) + '</label>';
        }).join('');
        return '<div style="margin:3px 0">' +
          '<label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer">' +
          '<input type="checkbox" id="' + cid + '"' + checked + ' data-ev="change" data-ev-key="ev71"> ' +
          '<b>' + escapeHtml(c.label) + '</b></label>' +
          (selSet[c.key] ? '<div style="padding-left:20px;margin-top:2px;display:flex;flex-wrap:wrap;gap:4px">' + clsChecks + '</div>' : '') +
          '</div>';
      } else {
        return '<label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer;margin:3px 0">' +
          '<input type="checkbox" id="' + cid + '"' + checked + ' data-ev="change" data-ev-key="ev71"> ' +
          escapeHtml(c.label) + ' <span style="font-size:11px;color:let(--text-muted)">(全局)</span></label>';
      }
    }).join('');
    let arrow = collapsed ? '\u25b8' : '\u25be';
    return '<div style="margin-bottom:10px;padding:8px;background:let(--bg-primary);border-radius:let(--radius-sm);border-left:3px solid let(--primary)">' +
      '<div data-click="cloudToggleGroup" data-click-args="' + escapeAttr(JSON.stringify([g.id])) + '" style="font-size:13px;font-weight:700;color:let(--primary-darker);margin-bottom:' + (collapsed ? '0' : '4px') + ';cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none">' +
      '<span style="display:inline-block;width:14px;text-align:center">' + arrow + '</span>' + g.icon + ' ' + escapeHtml(g.label) +
      ' <span style="font-size:11px;font-weight:400;color:let(--text-muted)">(' + g.children.length + ')</span></div>' +
      (collapsed ? '' : '<div style="padding-left:4px">' + itemsHtml + '</div>') +
      '</div>';
  }).join('');
}

// 旧数据迁移：成绩记录的 studentId 曾被误存为学号，重新关联回学生内部 id
function migrateScoreStudentIds() {
  if (!Array.isArray(state.scores) || !Array.isArray(state.students)) return;
  const byNo = {};
  state.students.forEach(function(s) { if (s.studentNo) byNo[s.studentNo] = s.id; });
  const validIds = {};
  state.students.forEach(function(s) { validIds[s.id] = true; });
  let fixed = 0, orphan = 0;
  state.scores.forEach(function(sc) {
    if (!sc || !sc.studentId) { orphan++; return; }
    if (validIds[sc.studentId]) return; // 已是有效内部 id
    // studentId 实为学号，尝试匹配
    if (byNo[sc.studentId]) {
      sc.studentId = byNo[sc.studentId];
      fixed++;
      return;
    }
    // 退而求其次：按 姓名+班级 匹配
    const byName = state.students.find(function(s) { return s.name === sc.name && s.classId === sc.classId; });
    if (byName) { sc.studentId = byName.id; fixed++; }
    else orphan++;
  });
  if (fixed > 0) { saveState(); }
  if (fixed > 0 || orphan > 0) {
    console.log('[migrateScoreStudentIds] 修正 ' + fixed + ' 条，残留孤立 ' + orphan + ' 条');
  }
}

function migrateCloudSyncState() {
  if (state.cloudSyncClass) {
    const old = state.cloudSyncClass;
    if ((!state.cloudUploadSections || !state.cloudUploadSections.length) && (!state.cloudSyncClasses || !state.cloudSyncClasses.length)) {
      state.cloudUploadSections = CLOUD_DEFAULT_SECTIONS.slice();
      state.cloudDownloadSections = CLOUD_DEFAULT_SECTIONS.slice();
      const m = {};
      CLOUD_DEFAULT_SECTIONS.forEach(function(k) { let l = cloudLeafByKey(k); if (l && l.scope === 'class') m[k] = [old]; });
      state.cloudUploadSectionClasses = m;
      state.cloudDownloadSectionClasses = m;
      state.cloudSectionsConfigured = true;
    }
  }
  if (state.cloudSyncClasses && state.cloudSyncClasses.length && (!state.cloudUploadSections || !state.cloudUploadSections.length)) {
    const m2 = {};
    CLOUD_DEFAULT_SECTIONS.forEach(function(k) { let l = cloudLeafByKey(k); if (l && l.scope === 'class') m2[k] = state.cloudSyncClasses.slice(); });
    state.cloudUploadSections = CLOUD_DEFAULT_SECTIONS.slice();
    state.cloudDownloadSections = CLOUD_DEFAULT_SECTIONS.slice();
    state.cloudUploadSectionClasses = m2;
    state.cloudDownloadSectionClasses = m2;
    state.cloudSectionsConfigured = true;
  }
  state.cloudSyncClass = '';
  if (typeof state.cloudSyncClasses !== 'undefined') state.cloudSyncClasses = [];
  if (!Array.isArray(state.cloudUploadSections)) state.cloudUploadSections = [];
  if (!Array.isArray(state.cloudDownloadSections)) state.cloudDownloadSections = [];
  if (typeof state.cloudUploadSectionClasses !== 'object' || state.cloudUploadSectionClasses === null) state.cloudUploadSectionClasses = {};
  if (typeof state.cloudDownloadSectionClasses !== 'object' || state.cloudDownloadSectionClasses === null) state.cloudDownloadSectionClasses = {};
  if (typeof state.cloudSectionsConfigured !== 'boolean') state.cloudSectionsConfigured = false;
  if (state.cloudAutoSync && !state.cloudSectionsConfigured && state.cloudUploadSections.length === 0) {
    state.cloudUploadSections = CLOUD_DEFAULT_SECTIONS.slice();
    state.cloudDownloadSections = CLOUD_DEFAULT_SECTIONS.slice();
    state.cloudSectionsConfigured = true;
  }
}

function updateSyncModal() {
  let body = document.getElementById('syncModalBody');
  if (!body) return;
  const cfg = state.cstcloudConfig || {};
  const lastPush = state.cloudLastPush ? new Date(state.cloudLastPush).toLocaleString('zh-CN') : '从未';
  const lastPull = state.cloudLastPull ? new Date(state.cloudLastPull).toLocaleString('zh-CN') : '从未';
  const configured = cfg.endpoint && cfg.accessKey;
  const isMobile = isMobileUI();
  // 手机端默认显示上传 tab
  if (!window._cloudSyncMobileTab) window._cloudSyncMobileTab = 'up';
  const mtab = window._cloudSyncMobileTab || 'up';

  let sectionHtml = '';
  if (isMobile) {
    // 手机端：Tab 切换上传/下载栏目
    const upActive = mtab === 'up' ? ' style="background:let(--primary);color:#fff"' : '';
    const dlActive = mtab === 'dl' ? ' style="background:let(--primary);color:#fff"' : '';
    sectionHtml =
      '<div style="font-size:14px;font-weight:700;margin-bottom:10px">云同步设置（上传 / 下载栏目分开选择）</div>' +
      '<div style="display:flex;gap:0;margin-bottom:10px;border-radius:let(--radius-sm);overflow:hidden;border:1px solid let(--border)">' +
      '<button class="btn" data-click="__dcSwitchSyncTab" data-click-args="[&quot;up&quot;]" style="flex:1;border-radius:0;border:none;padding:8px"' + upActive + '>上传栏目</button>' +
      '<button class="btn" data-click="__dcSwitchSyncTab" data-click-args="[&quot;dl&quot;]" style="flex:1;border-radius:0;border:none;padding:8px"' + dlActive + '>下载栏目</button>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:600;color:let(--primary-darker);margin-bottom:6px">' + (mtab === 'up' ? '自动上传栏目' : '自动下载栏目') + '（勾选后可展开选班级）</div>' +
      renderCloudSectionTree(mtab, mtab === 'up' ? state.cloudUploadSections : state.cloudDownloadSections, mtab === 'up' ? state.cloudUploadSectionClasses : state.cloudDownloadSectionClasses) +
      '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button class="btn btn-primary" data-click="manualCloudPush" style="flex:1"' + (configured ? '' : ' disabled') + '>上传到云端</button>' +
      '<button class="btn btn-outline" data-click="manualCloudPull" style="flex:1"' + (configured ? '' : ' disabled') + '>从云端下载</button>' +
      '</div>';
  } else {
    // 桌面端：两棵树并排，每块可独立折叠，状态记 localStorage，默认展开
    const upCollapsed = localStorage.getItem('cloudSyncUploadCollapsed') === '1';
    const dlCollapsed = localStorage.getItem('cloudSyncDownloadCollapsed') === '1';
    const upArrow = upCollapsed ? '▶' : '▼';
    const dlArrow = dlCollapsed ? '▶' : '▼';
    const upBodyStyle = upCollapsed ? 'display:none' : '';
    const dlBodyStyle = dlCollapsed ? 'display:none' : '';
    sectionHtml =
      '<div style="font-size:14px;font-weight:700;margin-bottom:10px">云同步设置（上传 / 下载栏目分开选择）</div>' +
      '<div class="sync-section" data-sync-section="up" style="margin-bottom:12px">' +
      '<button type="button" class="sync-section-head" data-click="toggleSyncSection" data-click-args="[&quot;up&quot;]" aria-expanded="' + (!upCollapsed) + '">' +
      '<span class="sync-section-arrow" data-sync-arrow="up">' + upArrow + '</span>' +
      '<span class="sync-section-title">自动上传栏目</span>' +
      '<span class="sync-section-hint">（勾选后可展开选班级）</span>' +
      '</button>' +
      '<div class="sync-section-body" data-sync-body="up" style="' + upBodyStyle + '">' +
      renderCloudSectionTree('up', state.cloudUploadSections, state.cloudUploadSectionClasses) +
      '</div>' +
      '</div>' +
      '<div class="sync-section" data-sync-section="dl" style="margin-bottom:12px">' +
      '<button type="button" class="sync-section-head" data-click="toggleSyncSection" data-click-args="[&quot;dl&quot;]" aria-expanded="' + (!dlCollapsed) + '">' +
      '<span class="sync-section-arrow" data-sync-arrow="dl">' + dlArrow + '</span>' +
      '<span class="sync-section-title">自动下载栏目</span>' +
      '<span class="sync-section-hint">（勾选后可展开选班级）</span>' +
      '</button>' +
      '<div class="sync-section-body" data-sync-body="dl" style="' + dlBodyStyle + '">' +
      renderCloudSectionTree('dl', state.cloudDownloadSections, state.cloudDownloadSectionClasses) +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary" data-click="manualCloudPush" style="flex:1"' + (configured ? '' : ' disabled') + '>上传到云端</button>' +
      '<button class="btn btn-outline" data-click="manualCloudPull" style="flex:1"' + (configured ? '' : ' disabled') + '>从云端下载</button>' +
      '</div>';
  }

  body.innerHTML =
    '<div style="background:let(--primary-lightest);border-radius:let(--radius);padding:14px;margin-bottom:16px">' +
    '<div style="font-size:14px;font-weight:700;margin-bottom:10px;color:let(--primary-darker)">S3 配置（数据胶囊）</div>' +
    '<div style="display:grid;gap:8px">' +
    '<input id="s3-endpoint" class="form-input" placeholder="Endpoint" value="' + escapeHtml(cfg.endpoint || '') + '" style="font-size:13px">' +
    '<input id="s3-bucket" class="form-input" placeholder="Bucket" value="' + escapeHtml(cfg.bucket || '') + '" style="font-size:13px">' +
    '<input id="s3-accesskey" class="form-input" placeholder="AccessKey ID" value="' + escapeHtml(cfg.accessKey || '') + '" style="font-size:13px">' +
    '<input id="s3-secretkey" class="form-input" type="password" placeholder="Secret Access Key（整串，含斜杠）" value="' + escapeHtml(cfg.secretKey || '') + '" style="font-size:13px">' +
    '<div style="font-size:11px;color:let(--text-muted);line-height:1.4">数据胶囊 S3 的 SecretKey 是完整的一串（例如 AAAA/BBBB...），请从控制台点击"显示"后整段复制粘贴，不要只填斜杠后面部分。</div>' +
    '<input id="s3-region" class="form-input" placeholder="Region" value="' + escapeHtml(cfg.region || 'us-east-1') + '" style="font-size:13px">' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
    '<button class="btn btn-primary" data-click="saveCstcloudConfig" style="flex:1">保存配置</button>' +
    '<button class="btn btn-outline" data-click="cloudTestConnection" style="flex:1">测试连接</button>' +
    '</div>' +
    '</div>' +
    '<div style="background:let(--bg-secondary);border-radius:let(--radius);padding:14px;margin-bottom:16px">' +
    sectionHtml +
    '</div>' +
    '<div style="background:let(--bg-secondary);border-radius:let(--radius);padding:14px;margin-bottom:16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div><div style="font-size:14px;font-weight:700">自动同步</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-top:2px">打开时自动下载所选栏目+对应班级，退出时自动上传所选栏目+对应班级</div></div>' +
    '<label class="cloud-toggle">' +
    '<input type="checkbox" ' + (state.cloudAutoSync ? 'checked' : '') + ' data-ev="change" data-ev-key="ev1">' +
    '<span class="toggle-track"></span>' +
    '<span class="toggle-thumb"></span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:let(--text-muted);text-align:center;margin-bottom:8px">上次上传: ' + lastPush + ' | 上次下载: ' + lastPull + '</div>' +
    '<div style="padding:10px;background:#E3F2FD;border-radius:let(--radius-sm);font-size:12px;color:#1565C0;line-height:1.6">' +
    '各栏目按业务板块分组（统筹中心/学生日常管理/学生工作任务/学生学情分析/生物仙途秘境），点击分组标题可折叠/展开。按班级划分的栏目（作业登记/任务信息/聊天框/学生档案/修仙档案）勾选后会展开班级勾选，可分别选上传和下载的班级；全局栏目（教学计划/课程表等）整块同步到 global.json。' +
    '</div>';
}

/* ===================== Sample Data ===================== */
function initSampleStudents() {
  const firstNames = '明华强磊静娜敏丽涛洋勇军杰平雪艳红伟刚芳秀娟超'.split('');
  const lastNames = '张李王赵陈刘杨黄周吴徐孙马朱胡郭高林何罗'.split('');
  const classes = getClasses();
  const layers = ['A','A','A','B','B','C','C','D']; // distribution
  const trends = ['稳步提升','小幅度进步','保持稳定','略有波动','需重点关注'];
  const tagPool = ['积极举手','实验能手','作业认真','需督促','理解力强','粗心','偏科','进步明显','纪律好','乐于助人'];

  state.students = [];
  let id = 1;
  classes.forEach(cls => {
    // 10 students per class as sample
    for (let i = 0; i < 10; i++) {
      const ln = lastNames[(id + i) % lastNames.length];
      const fn = firstNames[(id * 3 + i) % firstNames.length];
      const name = ln + fn;
      const layer = layers[(id * 7 + i) % layers.length];
      const trend = trends[(id * 5 + i) % trends.length];
      const tags = [];
      const tagCount = 2 + (id * 3 + i) % 3;
      for (let t = 0; t < tagCount; t++) tags.push(tagPool[(id * t + i) % tagPool.length]);
      const hwTotal = 8 + (id + i) % 5;
      const excellent = Math.floor(hwTotal * (layer === 'A' ? 0.5 : layer === 'B' ? 0.35 : layer === 'C' ? 0.2 : 0.1));
      const incomplete = Math.floor(hwTotal * (layer === 'D' ? 0.4 : layer === 'C' ? 0.25 : 0.1));
      const normal = hwTotal - excellent - incomplete;
      state.students.push({
        id: 's' + id,
        studentNo: (cls.replace('班','') * 100 + i + 1).toString(),
        name,
        gender: i % 2 === 0 ? '男' : '女',
        classId: cls,
        layer,
        scoreTrend: trend,
        tags: [...new Set(tags)],
        homeworkStats: { excellent, normal, incomplete },
        teacherNote: layer === 'D' ? '需加强课后辅导，关注学习习惯。' : '学习态度端正，继续保持。'
      });
      id++;
    }
  });
}

function generateSampleScores() {
  const scores = [];
  const exams = [
    { name:'第一章单元测', date:'2026-09-20' },
    { name:'期中考试', date:'2026-11-05' }
  ];
  let scId = 1;
  exams.forEach((exam, ei) => {
    state.students.forEach(s => {
      // Base score by layer, with variation
      const base = s.layer === 'A' ? 88 : s.layer === 'B' ? 76 : s.layer === 'C' ? 65 : 52;
      // Second exam: add some progress/regress
      const variation = (parseInt(s.id.replace('s','')) * 7 + ei * 13) % 21 - 10;
      const score = Math.max(20, Math.min(100, base + variation + (ei === 1 ? 3 : 0)));
      scores.push({
        id: 'sc' + scId++,
        studentId: s.id,
        name: s.name,
        classId: s.classId,
        score: score,
        examName: exam.name,
        date: exam.date
      });
    });
  });
  // Calculate ranks
  exams.forEach(exam => {
    const examScores = scores.filter(s => s.examName === exam.name);
    // Grade rank
    const gradeSorted = [...examScores].sort((a,b) => b.score - a.score);
    gradeSorted.forEach((s, i) => { s.gradeRank = i + 1; });
    // Class rank — 计算所有班级（含导入的非任教班级）
    const allCls = [...new Set(examScores.map(s => s.classId).filter(Boolean))];
    allCls.forEach(cls => {
      const classScores = examScores.filter(s => s.classId === cls).sort((a,b) => b.score - a.score);
      classScores.forEach((s, i) => { s.classRank = i + 1; });
    });
  });
  return scores;
}

function generateSampleHomeworkRecords() {
  const records = [];
  state.students.forEach((s, idx) => {
    state.studentTasks.slice(0, 3).forEach((task, tidx) => {
      if (!isTaskForClass(task, s.classId)) return;
      let status = 'normal';
      const rnd = Math.random();
      if (s.layer === 'A') status = rnd > 0.3 ? 'excellent' : 'normal';
      else if (s.layer === 'B') status = rnd > 0.5 ? 'normal' : (rnd > 0.2 ? 'excellent' : (rnd > 0.1 ? 'perfunctory' : 'incomplete'));
      else if (s.layer === 'C') status = rnd > 0.5 ? 'normal' : (rnd > 0.3 ? 'incomplete' : (rnd > 0.15 ? 'perfunctory' : 'resubmitted'));
      else status = rnd > 0.4 ? 'incomplete' : (rnd > 0.2 ? 'perfunctory' : 'resubmitted');
      const reviewStatus = isReviewLocked(status) ? 'pending' : isReviewHidden(status) ? 'reviewed' : 'pending';
      records.push({
        id: 'hr' + records.length,
        studentId: s.id,
        studentNo: s.studentNo,
        name: s.name,
        classId: s.classId,
        taskId: task.id,
        taskTitle: task.title,
        status,
        reviewStatus,
        review: status === 'incomplete' ? '' : status === 'perfunctory' ? '' : status === 'excellent' ? '完成质量高' : ''
      });
    });
  });
  return records;
}

function initSampleData() {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0,16);
  state.tasks = [
    { id:'t1', name:'备课：动物的主要类群（八上第一章）', desc:'准备课件、实验设计方案', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate(),8,0)), resp:'海绵宝宝', important:true, urgent:true, completed:false },
    { id:'t2', name:'批改1班单元测试卷', desc:'第一章单元测验，共45份', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate(),14,0)), resp:'派大星', important:true, urgent:true, completed:false },
    { id:'t3', name:'实验室器材检查：显微镜', desc:'检查10台显微镜是否正常', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1,10,0)), resp:'海绵宝宝', important:false, urgent:true, completed:false },
    { id:'t4', name:'整理10班错题集', desc:'第一章常见错题汇总', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+2,16,0)), resp:'派大星', important:true, urgent:false, completed:false },
    { id:'t5', name:'准备8班公开课课件', desc:'校级公开课：动物运动方式', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+3,9,0)), resp:'派大星', important:true, urgent:true, completed:false },
    { id:'t6', name:'教研组周会议纪要', desc:'整理本周教研记录', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()-1,15,0)), resp:'海绵宝宝', important:false, urgent:false, completed:true },
    { id:'t7', name:'编写期末复习计划', desc:'八年级上册复习方案', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+5,14,0)), resp:'派大星', important:true, urgent:false, completed:false }
  ];

  state.schedulePeriods = [
    {n:1, type:'morning', start:'07:30', end:'08:00'},
    {n:2, type:'regular', start:'08:00', end:'08:45'},
    {n:3, type:'regular', start:'08:55', end:'09:40'},
    {n:4, type:'regular', start:'10:00', end:'10:45'},
    {n:5, type:'regular', start:'10:55', end:'11:40'},
    {n:6, type:'regular', start:'14:00', end:'14:45'},
    {n:7, type:'regular', start:'14:55', end:'15:40'},
    {n:8, type:'regular', start:'15:50', end:'16:35'},
    {n:9, type:'regular', start:'16:45', end:'17:30'},
    {n:10, type:'evening', start:'18:30', end:'19:30'},
    {n:11, type:'evening', start:'19:40', end:'20:40'}
  ];
  state.scheduleDays = ['周一','周二','周三','周四','周五'];

  state.schedule = [
    { id:'s1', day:1, period:1, classId:'1班', subject:'早读' },
    { id:'s2', day:1, period:2, classId:'1班', subject:'生物' },
    { id:'s3', day:1, period:4, classId:'2班', subject:'生物' },
    { id:'s4', day:1, period:11, classId:'1班', subject:'晚自习' },
    { id:'s5', day:2, period:1, classId:'4班', subject:'早读' },
    { id:'s6', day:2, period:3, classId:'4班', subject:'生物' },
    { id:'s7', day:2, period:5, classId:'5班', subject:'生物' },
    { id:'s8', day:2, period:8, classId:'10班', subject:'生物' },
    { id:'s9', day:2, period:11, classId:'2班', subject:'晚自习' },
    { id:'s10', day:3, period:2, classId:'8班', subject:'生物' },
    { id:'s11', day:3, period:4, classId:'10班', subject:'生物' },
    { id:'s12', day:3, period:10, classId:'4班', subject:'晚自习' },
    { id:'s13', day:4, period:1, classId:'5班', subject:'早读' },
    { id:'s14', day:4, period:6, classId:'1班', subject:'生物' },
    { id:'s15', day:4, period:8, classId:'2班', subject:'生物' },
    { id:'s16', day:5, period:1, classId:'4班', subject:'早读' },
    { id:'s17', day:5, period:3, classId:'5班', subject:'生物' },
    { id:'s18', day:5, period:5, classId:'8班', subject:'生物' }
  ];

  state.adjustments = [
    { id:'a1', date:'2026-09-08', origDay:'周一', origPeriod:2, classId:'1班', newDay:'周二', newPeriod:3, reason:'教师培训', note:'调整至周二第3节' },
    { id:'a2', date:'2026-09-15', origDay:'周一', origPeriod:4, classId:'2班', newDay:'周三', newPeriod:5, reason:'运动会调课', note:'全校活动' },
    { id:'a3', date:'2026-09-22', origDay:'周二', origPeriod:1, classId:'4班', newDay:'周四', newPeriod:2, reason:'教研活动', note:'区教研统一调课' }
  ];

  state.plans = [
    { id:'p1', seq:1, name:'2026秋季学期教学计划', content:'八年级上册全册教学计划', endDate:'2027-01-10', resp:'派大星', startDate:'2026-09-01', items:12, uploadedAt:'2026-08-20' }
  ];

  initSampleStudents();

  state.studentTasks = [
    { id:'st1', title:'第一章课后练习', content:'完成课本P15-16练习1-5题，预习下一节', answer:'1. B  2. C  3. 腔肠动物  4. 外胚层、内胚层  5. 扁形动物身体背腹扁平', assignedDate:'2026-09-01', dueDate:'2026-09-03', classIds:['1班','2班'], classId:'1班' },
    { id:'st2', title:'显微镜观察实验报告', content:'填写实验报告单，绘制草履虫结构图', answer:'实验报告答案详见教师用书P28', assignedDate:'2026-09-05', dueDate:'2026-09-08', classIds:['4班','5班'], classId:'4班' },
    { id:'st3', title:'单元测试卷（一）', content:'完成第一章单元测试卷', answer:'答案已密封，请完成批阅后查看', assignedDate:'2026-09-10', dueDate:'2026-09-12', classIds:['8班','10班'], classId:'8班' }
  ];

  state.homeworkRecords = generateSampleHomeworkRecords();

  state.chatMessages = [
    { id:'cm1', classId:'1班', sender:'representative', name:'课代表-李明', content:'老师，今天的作业是练习册第5页吗？', time:'2026-09-01 16:30', type:'text', read:true },
    { id:'cm2', classId:'1班', sender:'teacher', name:'派大星', content:'是的，记得提醒同学们按时上交。', time:'2026-09-01 16:35', type:'text', read:true },
    { id:'cm3', classId:'2班', sender:'representative', name:'课代表-王芳', content:'老师，有3位同学请假，作业明天补交。', time:'2026-09-02 17:10', type:'text', read:false },
    { id:'cm4', classId:'4班', sender:'representative', name:'课代表-刘洋', content:'老师，作业收齐了，共48份。', time:'2026-09-03 17:00', type:'text', read:false },
    { id:'cm5', classId:'5班', sender:'representative', name:'课代表-张雨', content:'老师，第3题不太确定，能讲解一下吗？', time:'2026-09-03 18:20', type:'text', read:false }
  ];

  state.scores = generateSampleScores();

  state.progress = [
    { id:'pr1', week:1, date:'2026-09-01', classId:'1班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'completed', reflection:'学生参与度高，建议增加实物标本展示' },
    { id:'pr2', week:1, date:'2026-09-01', classId:'2班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'completed', reflection:'互动环节时间略紧，下次适当缩减导入部分' },
    { id:'pr3', week:1, date:'2026-09-02', classId:'4班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'in-progress', reflection:'' },
    { id:'pr4', week:1, date:'2026-09-02', classId:'5班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'completed', reflection:'' },
    { id:'pr5', week:1, date:'2026-09-03', classId:'8班', content:'腔肠动物和扁形动物', chProgress:'第一章第2节', status:'planned', reflection:'' },
    { id:'pr6', week:1, date:'2026-09-03', classId:'10班', content:'腔肠动物和扁形动物', chProgress:'第一章第2节', status:'planned', reflection:'' }
  ];

  state.reminders = [
    { id:'rm1', name:'每日批改提醒', schedule:'每天 16:00', desc:'提醒批改当日各班作业', active:true },
    { id:'rm2', name:'每周备课检查', schedule:'每周一 08:00', desc:'检查本周备课是否完成', active:true },
    { id:'rm3', name:'每周五教学进度同步', schedule:'每周五 15:00', desc:'同步本周教学进度并写反思', active:true },
    { id:'rm4', name:'月度成绩分析', schedule:'每月最后一天', desc:'生成月度成绩分析报告', active:false }
  ];

  saveState();
}

/* ===================== Utilities ===================== */
function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeHtml(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function escapeAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;'); }
function safeImageSrc(src) { return (src||'').match(/^(data:image\/|blob:|https?:\/\/)/) ? escapeAttr(src) : ''; }
function fmtDate(d) { if(!d) return ''; return new Date(d).toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'}); }
function fmtTime(d) { if(!d) return ''; const dt=new Date(d); return dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0'); }
function fmtDateTime(d) { if(!d) return ''; const dt=new Date(d); return (dt.getMonth()+1)+'/'+dt.getDate()+' '+fmtTime(d); }
function getWeekStart(date) { const d=new Date(date); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); d.setHours(0,0,0,0); return d; }
function getDayName(day) { return ['','周一','周二','周三','周四','周五','周六','周日'][day]||''; }
function getPeriodName(p) { return getPeriodLabel(p); }

// 通用防抖函数（默认 200ms）
function debounce(fn, delay) {
  delay = delay || 200;
  let timer = null;
  return function() {
    const ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type==='error'?' error':type==='warn'?' warn':'');
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(), 300); }, 2500);
}

/* ===================== Modal ===================== */
// 安全警告：openModal 将 html 参数直接插入 innerHTML，调用方必须自行使用 escapeHtml/escapeAttr 转义用户数据
function openModal(html, opts) {
  opts = opts || {};
  const c = document.getElementById('modalContainer');
  const overlayAttr = opts.closable === false ? '' : ' data-click="closeModal" data-click-self="1"';
  const modalStyle = opts.width ? ' style="max-width:' + opts.width + '"' : '';
  const titleHtml = opts.title ? '<div style="font-size:17px;font-weight:700;color:let(--text-heading);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid let(--border-light)">' + escapeHtml(opts.title) + '</div>' : '';
  c.innerHTML = '<div class="modal-overlay" role="dialog" aria-modal="true"' + overlayAttr + '><div class="modal"' + modalStyle + '>' + titleHtml + html + '</div></div>';
  // 焦点管理：将焦点移到模态框
  const modal = c.querySelector('.modal');
  if (modal) { modal.setAttribute('tabindex', '-1'); modal.focus(); }
}
function closeModal() { document.getElementById('modalContainer').innerHTML = ''; }

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

/* ===================== 数据管理：导入 / 导出 / 合并 ===================== */

// 数据类别配置（用于合并对比）
const DATA_CATEGORIES = [
  { key: 'students', label: '学生档案', idField: 'studentId', nameField: 'name' },
  { key: 'tasks', label: '任务清单', idField: 'id', nameField: 'title' },
  { key: 'plans', label: '教学计划', idField: 'id', nameField: 'title' },
  { key: 'schedule', label: '课程表', idField: 'id', nameField: 'className' },
  { key: 'progress', label: '教学进度', idField: 'id', nameField: 'topic' },
  { key: 'scores', label: '成绩记录', idField: 'id', nameField: 'examName' },
  { key: 'homeworkRecords', label: '作业记录', idField: 'id', nameField: 'taskTitle' },
  { key: 'studentTasks', label: '学生任务', idField: 'id', nameField: 'title' },
  { key: 'chatMessages', label: '聊天消息', idField: 'id', nameField: 'content' },
  { key: 'reminders', label: '提醒', idField: 'id', nameField: 'title' },
  { key: 'adjustments', label: '调课记录', idField: 'id', nameField: 'date' },
  { key: 'scoreHistory', label: '成绩历史', idField: 'id', nameField: 'examName' }
];

function openDataManager() {
  let panel = document.getElementById('dataManagerPanel');
  panel.classList.add('open');
  renderDataManager('export');
}

function closeDataManager() {
  let panel = document.getElementById('dataManagerPanel');
  panel.classList.remove('open');
  panel.innerHTML = '';
}

function renderDataManager(tab) {
  const panel = document.getElementById('dataManagerPanel');
  let counts = {};
  DATA_CATEGORIES.forEach(function(cat) {
    let arr = state[cat.key] || [];
    counts[cat.key] = Array.isArray(arr) ? arr.length : 0;
  });
  let totalItems = Object.values(counts).reduce(function(a, b) { return a + b; }, 0);

  const tabBtns = DATA_CATEGORIES.map(function(t) {
    const active = t.key === tab ? 'active' : '';
    return '<button class="dm-tab-btn ' + active + '" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['' + t.key + ''])) + '">' + t.label + '</button>';
  }).join('');

  // Build content based on tab
  let content = '';
  if (tab === 'export') {
    content = renderExportTab(counts, totalItems);
  } else if (tab === 'import') {
    content = renderImportTab();
  } else if (tab === 'merge') {
    content = renderMergeTab();
  } else {
    // Data category detail
    content = renderCategoryDetail(tab, counts[tab] || 0);
  }

  panel.innerHTML =
    '<div class="status-panel" data-click="__noop" style="max-width:680px">' +
    '<div class="status-panel-header">' +
    '<span style="font-size:28px">📦</span>' +
    '<div><h3>数据管理</h3><p>导入、导出、合并教学数据</p></div>' +
    '<button class="btn-icon" data-click="closeDataManager">✕</button></div>' +
    '<div class="status-panel-body">' +
    '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">' +
    '<button class="dm-tab-btn ' + (tab === 'export' ? 'active' : '') + '" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['export'])) + '">📤 导出数据</button>' +
    '<button class="dm-tab-btn ' + (tab === 'import' ? 'active' : '') + '" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['import'])) + '">📥 导入数据</button>' +
    '<button class="dm-tab-btn ' + (tab === 'merge' ? 'active' : '') + '" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['merge'])) + '">🔀 数据合并</button>' +
    '</div>' +
    content +
    '</div></div>';
}

function renderExportTab(counts, totalItems) {
  let detailRows = DATA_CATEGORIES.filter(function(c) { return counts[c.key] > 0; }).map(function(cat) {
    return '<tr><td><code style="background:let(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + cat.label + '</code></td><td class="size-col">' + counts[cat.key] + ' 条</td></tr>';
  }).join('');
  if (!detailRows) detailRows = '<tr><td colspan="2" style="text-align:center;color:let(--text-muted);padding:12px">暂无数据</td></tr>';

  return '<div class="status-section">' +
    '<div class="status-section-title">📤 导出当前数据</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-bottom:10px">将当前工作台的所有数据导出为 JSON 备份文件，可用于迁移、备份或与其他设备合并。</div>' +
    '<table class="status-table"><thead><tr><th>数据类别</th><th class="size-col">数量</th></tr></thead><tbody>' + detailRows + '</tbody></table>' +
    '<div style="margin-top:12px;padding:10px;background:let(--bg-app);border-radius:let(--radius-sm);font-size:12px">' +
    '📊 共 <strong>' + totalItems + '</strong> 条数据 | 导出时间：' + new Date().toLocaleString('zh-CN') + '</div>' +
    '<button class="btn" style="margin-top:12px;width:100%;background:let(--primary);color:#fff;border:none;padding:10px;font-size:14px" data-click="doExportData">📤 导出为 JSON 文件</button>' +
    '</div>';
}

function renderImportTab() {
  return '<div class="status-section">' +
    '<div class="status-section-title">📥 导入数据</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-bottom:10px">从 JSON 备份文件导入数据。<strong style="color:let(--danger)">覆盖模式</strong>会替换当前所有数据；建议先导出当前数据作为备份。</div>' +
    '<div id="importFileArea" style="border:2px dashed let(--border);border-radius:let(--radius);padding:24px;text-align:center;margin-bottom:12px">' +
    '<div style="font-size:32px;margin-bottom:8px">📂</div>' +
    '<div style="font-size:13px;color:let(--text-muted);margin-bottom:12px">点击选择或拖入 JSON 备份文件</div>' +
    '<input type="file" id="importFileInput" accept=".json" style="display:none" data-ev="change" data-ev-key="ev2">' +
    '<button class="btn" data-click="__dcClickEl" data-click-args="' + escapeAttr(JSON.stringify('importFileInput')) + '">选择文件</button>' +
    '</div>' +
    '<div id="importPreview"></div>' +
    '</div>';
}

function renderMergeTab() {
  return '<div class="status-section">' +
    '<div class="status-section-title">🔀 数据合并</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-bottom:10px">导入一份备份数据，与当前数据进行对比合并。系统会列出相同项、差异项和各自独有的数据，你可以选择性地合并。</div>' +
    '<div id="mergeFileArea" style="border:2px dashed let(--border);border-radius:let(--radius);padding:24px;text-align:center;margin-bottom:12px">' +
    '<div style="font-size:32px;margin-bottom:8px">🔀</div>' +
    '<div style="font-size:13px;color:let(--text-muted);margin-bottom:12px">选择要合并的 JSON 备份文件</div>' +
    '<input type="file" id="mergeFileInput" accept=".json" style="display:none" data-ev="change" data-ev-key="ev3">' +
    '<button class="btn" data-click="__dcClickEl" data-click-args="' + escapeAttr(JSON.stringify('mergeFileInput')) + '">选择文件</button>' +
    '</div>' +
    '<div id="mergePreview"></div>' +
    '</div>';
}

function renderCategoryDetail(catKey, count) {
  const cat = DATA_CATEGORIES.find(function(c) { return c.key === catKey; });
  if (!cat) return '<div style="color:let(--text-muted)">未知类别</div>';
  let arr = state[catKey] || [];
  let rows = '';
  if (Array.isArray(arr) && arr.length > 0) {
    rows = arr.slice(0, 50).map(function(item) {
      let name = item[cat.nameField] || item.name || item.title || item.studentId || '(无名称)';
      let id = item[cat.idField] || item.id || '-';
      return '<tr><td style="font-size:12px">' + escapeHtml(String(name)) + '</td><td class="size-col" style="font-size:11px;color:let(--text-muted)">' + escapeHtml(String(id)) + '</td></tr>';
    }).join('');
    if (arr.length > 50) rows += '<tr><td colspan="2" style="text-align:center;color:let(--text-muted);padding:8px">... 还有 ' + (arr.length - 50) + ' 条</td></tr>';
  } else {
    rows = '<tr><td colspan="2" style="text-align:center;color:let(--text-muted);padding:12px">暂无数据</td></tr>';
  }
  return '<div class="status-section">' +
    '<div class="status-section-title">📋 ' + cat.label + '（' + count + ' 条）</div>' +
    '<table class="status-table"><thead><tr><th>名称</th><th class="size-col">ID</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '</div>';
}

// 导出数据
function doExportData() {
  const exportObj = {
    _meta: {
      appName: '派大星',
      appVersion: '2.3.1',
      exportDate: new Date().toISOString(),
      exportTimestamp: Date.now()
    },
    state: {}
  };
  // 深拷贝 state，处理 Date 对象
  const stateCopy = JSON.parse(JSON.stringify(state, function(key, val) {
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
  exportObj.state = stateCopy;

  const json = JSON.stringify(exportObj, null, 2);
  const fileName = '派大星_数据备份_' + new Date().toISOString().slice(0, 10) + '.json';

  if (isTauriApp()) {
    __invoke('plugin:dialog|save', { options: { defaultPath: fileName, title: '保存数据备份', filters: [{ name: 'JSON', extensions: ['json'] }] } }).then(function(filePath) {
      if (!filePath) return;
      return __invoke('write_file', { path: filePath, content: json }).then(function() {
        showToast('数据已导出：' + filePath, 'success');
      });
    }).catch(function(e) {
      console.error('导出失败:', e);
      _downloadBlob(json, fileName, 'application/json');
      showToast('导出失败，已使用浏览器下载', 'warn');
    });
  } else {
    _downloadBlob(json, fileName, 'application/json');
    showToast('数据已导出：' + fileName, 'success');
  }
}

// 导入数据（覆盖模式）
function handleImportFile(input) {
  let file = input.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data = JSON.parse(e.target.result);
      let importState = data.state || data;
      const counts = {};
      DATA_CATEGORIES.forEach(function(cat) {
        const arr = importState[cat.key];
        counts[cat.key] = Array.isArray(arr) ? arr.length : 0;
      });
      const totalItems = Object.values(counts).reduce(function(a, b) { return a + b; }, 0);

      const detailRows = DATA_CATEGORIES.filter(function(c) { return counts[c.key] > 0; }).map(function(cat) {
        return '<tr><td><code style="background:let(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + cat.label + '</code></td><td class="size-col">' + counts[cat.key] + ' 条</td></tr>';
      }).join('');

      const metaInfo = data._meta ? '<div style="font-size:11px;color:let(--text-muted);margin-bottom:8px">导出时间：' + (data._meta.exportDate || '未知') + ' | 版本：' + (data._meta.appVersion || '未知') + '</div>' : '';

      document.getElementById('importPreview').innerHTML =
        '<div style="border:1px solid let(--border);border-radius:let(--radius);padding:12px;margin-top:8px">' +
        '<div style="font-weight:600;margin-bottom:8px">📋 文件预览</div>' +
        metaInfo +
        '<table class="status-table"><thead><tr><th>数据类别</th><th class="size-col">数量</th></tr></thead><tbody>' + detailRows + '</tbody></table>' +
        '<div style="font-size:12px;margin-top:8px">共 ' + totalItems + ' 条数据</div></div>' +
        '<div style="margin-top:12px;padding:10px;background:#fff3cd;border-radius:let(--radius-sm);font-size:12px">' +
        '⚠️ <strong>覆盖导入</strong>将替换当前所有数据。建议先导出当前数据作为备份。</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn" style="flex:1;background:let(--danger);color:#fff;border:none;padding:10px" data-click="confirmImport">⚠️ 确认覆盖导入</button>' +
        '<button class="btn" style="flex:1;padding:10px" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['import'])) + '">取消</button></div>';
      window._pendingImportData = data;
    } catch(err) {
      document.getElementById('importPreview').innerHTML = '<div style="color:let(--danger);padding:12px">❌ 文件解析失败：' + escapeHtml(err.message) + '</div>';
    }
  };
  reader.readAsText(file);
}

async function confirmImport() {
  if (!window._pendingImportData) return;
  let data = window._pendingImportData;
  let importState = data.state || data;
  if (!(await appConfirm('确定要覆盖当前所有数据吗？此操作不可撤销！'))) return;

  // 恢复 state
  Object.keys(state).forEach(function(key) {
    if (importState[key] !== undefined) {
      state[key] = importState[key];
    }
  });
  // 处理 Date 对象
  if (typeof state.currentMonth === 'string') {
    state.currentMonth = new Date(state.currentMonth);
  }
  // 重置 UI 状态
  state.passwordUnlocked = false;

  saveState();
  renderPage();
  closeDataManager();
  showToast('数据导入成功！共导入 ' + Object.keys(importState).length + ' 个字段', 'success');
  window._pendingImportData = null;
}

// 合并数据
function handleMergeFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data = JSON.parse(e.target.result);
      let importState = data.state || data;
      window._pendingMergeData = importState;

      let comparison = compareData(state, importState);
      let totalSame = 0, totalDiff = 0, totalOnlyCurrent = 0, totalOnlyImported = 0;

      const rows = DATA_CATEGORIES.map(function(cat) {
        let r = comparison[cat.key] || { same: 0, different: 0, onlyCurrent: 0, onlyImported: 0 };
        totalSame += r.same;
        totalDiff += r.different;
        totalOnlyCurrent += r.onlyCurrent;
        totalOnlyImported += r.onlyImported;
        const hasData = r.same + r.different + r.onlyCurrent + r.onlyImported > 0;
        if (!hasData) return '';
        return '<tr>' +
          '<td><code style="background:let(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + cat.label + '</code></td>' +
          '<td style="text-align:center;color:let(--success)">' + r.same + '</td>' +
          '<td style="text-align:center;color:let(--warning)">' + r.different + '</td>' +
          '<td style="text-align:center;color:let(--text-muted)">' + r.onlyCurrent + '</td>' +
          '<td style="text-align:center;color:let(--primary)">' + r.onlyImported + '</td>' +
          '</tr>';
      }).join('');

      const summary = '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:let(--success-light, #e8f5e9);border-radius:let(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:let(--success)">' + totalSame + '</div><div style="font-size:11px;color:let(--text-muted)">相同项</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:let(--warning-light, #fff3cd);border-radius:let(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:let(--warning)">' + totalDiff + '</div><div style="font-size:11px;color:let(--text-muted)">差异项</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:let(--bg-app);border-radius:let(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:let(--text-muted)">' + totalOnlyCurrent + '</div><div style="font-size:11px;color:let(--text-muted)">仅当前有</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:let(--primary-lightest, #e3f2fd);border-radius:let(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:let(--primary)">' + totalOnlyImported + '</div><div style="font-size:11px;color:let(--text-muted)">仅导入有</div></div>' +
        '</div>';

      document.getElementById('mergePreview').innerHTML =
        '<div style="border:1px solid let(--border);border-radius:let(--radius);padding:12px;margin-top:8px">' +
        '<div style="font-weight:600;margin-bottom:8px">🔀 数据对比结果</div>' +
        summary +
        '<table class="status-table"><thead><tr><th>数据类别</th><th class="size-col">相同</th><th class="size-col">差异</th><th class="size-col">仅当前</th><th class="size-col">仅导入</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="font-size:11px;color:let(--text-muted);margin-top:8px;line-height:1.5">' +
        '💡 <strong>相同</strong>：两边数据完全一致 | <strong>差异</strong>：同一 ID 但内容不同 | <strong>仅当前</strong>：只在当前数据中存在 | <strong>仅导入</strong>：只在导入文件中存在</div></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn" style="flex:1;background:let(--primary);color:#fff;border:none;padding:10px" data-click="confirmMerge" data-click-args="' + escapeAttr(JSON.stringify(['all'])) + '">合并全部（保留最新）</button>' +
        '<button class="btn" style="flex:1;padding:10px" data-click="confirmMerge" data-click-args="' + escapeAttr(JSON.stringify(['imported'])) + '">仅添加导入独有项</button>' +
        '<button class="btn" style="flex:1;padding:10px;background:let(--bg-app)" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['merge'])) + '">取消</button></div>';
    } catch(err) {
      document.getElementById('mergePreview').innerHTML = '<div style="color:let(--danger);padding:12px">❌ 文件解析失败：' + escapeHtml(err.message) + '</div>';
    }
  };
  reader.readAsText(file);
}

// 对比两组数据
function compareData(currentState, importState) {
  const result = {};
  DATA_CATEGORIES.forEach(function(cat) {
    let current = currentState[cat.key] || [];
    let imported = importState[cat.key] || [];
    if (!Array.isArray(current)) current = [];
    if (!Array.isArray(imported)) imported = [];

    let currentMap = {};
    const importedMap = {};
    const usedIds = {};

    current.forEach(function(item) {
      let id = item[cat.idField] || item.id || _generateItemId(item, cat);
      currentMap[id] = item;
      usedIds[id] = true;
    });
    imported.forEach(function(item) {
      let id = item[cat.idField] || item.id || _generateItemId(item, cat);
      importedMap[id] = item;
    });

    let same = 0, different = 0, onlyCurrent = 0, onlyImported = 0;
    const diffDetails = [];

    Object.keys(currentMap).forEach(function(id) {
      if (importedMap[id]) {
        if (JSON.stringify(currentMap[id]) === JSON.stringify(importedMap[id])) {
          same++;
        } else {
          different++;
          diffDetails.push({ id: id, current: currentMap[id], imported: importedMap[id] });
        }
      } else {
        onlyCurrent++;
      }
    });
    Object.keys(importedMap).forEach(function(id) {
      if (!currentMap[id]) onlyImported++;
    });

    result[cat.key] = {
      same: same, different: different,
      onlyCurrent: onlyCurrent, onlyImported: onlyImported,
      diffDetails: diffDetails
    };
  });
  return result;
}

function _generateItemId(item, cat) {
  let parts = cat.key + '_';
  if (item.studentId) parts += item.studentId + '_';
  if (item.name) parts += item.name + '_';
  if (item.date) parts += item.date + '_';
  if (item.className) parts += item.className + '_';
  if (item.classNum) parts += item.classNum + '_';
  return parts + JSON.stringify(item).length;
}

function confirmMerge(mode) {
  if (!window._pendingMergeData) return;
  const importState = window._pendingMergeData;
  const comparison = compareData(state, importState);
  let mergedCount = 0;

  if (mode === 'all') {
    // 合并全部：相同保留，差异取导入侧（更新），仅导入的添加
    DATA_CATEGORIES.forEach(function(cat) {
      let current = state[cat.key] || [];
      let imported = importState[cat.key] || [];
      if (!Array.isArray(current)) current = [];
      if (!Array.isArray(imported)) imported = [];

      let currentMap = {};
      current.forEach(function(item) {
        let id = item[cat.idField] || item.id || _generateItemId(item, cat);
        currentMap[id] = item;
      });

      imported.forEach(function(item) {
        let id = item[cat.idField] || item.id || _generateItemId(item, cat);
        if (!currentMap[id]) {
          // 仅导入有 → 添加
          current.push(item);
          mergedCount++;
        } else if (JSON.stringify(currentMap[id]) !== JSON.stringify(item)) {
          // 差异 → 更新为导入版本
          const idx = current.indexOf(currentMap[id]);
          if (idx >= 0) {
            current[idx] = item;
            mergedCount++;
          }
        }
      });
      state[cat.key] = current;
    });
  } else if (mode === 'imported') {
    // 仅添加导入独有项
    DATA_CATEGORIES.forEach(function(cat) {
      let current = state[cat.key] || [];
      let imported = importState[cat.key] || [];
      if (!Array.isArray(current)) current = [];
      if (!Array.isArray(imported)) imported = [];

      const currentMap = {};
      current.forEach(function(item) {
        let id = item[cat.idField] || item.id || _generateItemId(item, cat);
        currentMap[id] = true;
      });

      imported.forEach(function(item) {
        let id = item[cat.idField] || item.id || _generateItemId(item, cat);
        if (!currentMap[id]) {
          current.push(item);
          mergedCount++;
        }
      });
      state[cat.key] = current;
    });
  }

  saveState();
  renderPage();
  closeDataManager();
  showToast('合并完成！共合并 ' + mergedCount + ' 条数据', 'success');
  window._pendingMergeData = null;
}

const PAGE_TITLES = {
  tasks:'任务清单', plan:'教学计划', schedule:'智能课程表', progress:'教学进度',
  students:'学生档案总库',
  'st-task-info':'任务信息', 'st-random':'随机抽查', 'st-homework':'作业登记', 'st-chat':'聊天框',
  'hw-analysis':'学生作业分析', 'score-analysis':'学生成绩分析', 'dashboard':'学情看板',
  automation:'自动化提醒', 'skill-links':'Skill链接', 'ima-link':'IMA链接入口',   'daily-quiz':'生物中考每日练习',
  'xiuxian':'04生物仙途秘境',
  'xiuxian-archive':'04生物仙途秘境 · 修仙档案总库',
  'xiuxian-tasks':'04生物仙途秘境 · 修仙任务系统',
  'xiuxian-rank':'04生物仙途秘境 · 修仙排行榜单',
  'xiuxian-pool':'04生物仙途秘境 · 修仙角色体质'
};
const PARENT_PAGES = {
  'st-task-info':'student-tasks', 'st-random':'student-tasks', 'st-homework':'student-tasks', 'st-chat':'student-tasks',
  'hw-analysis':'analysis', 'score-analysis':'analysis', 'dashboard':'analysis',
  'xiuxian-archive':'xiuxian', 'xiuxian-tasks':'xiuxian', 'xiuxian-rank':'xiuxian', 'xiuxian-pool':'xiuxian'
};

// 学生工作任务页面免密，其他栏目需要密码验证
const PASSWORD_EXEMPT_PAGES = ['st-task-info', 'st-random', 'st-homework', 'st-chat', 'folder'];

// ── 手机端底部导航 Tab → 子栏目映射 ──
const MOBILE_SECTIONS = {
  center: {
    title: '\u6d3e\u5927\u661f\u7684\u7edf\u7b79\u4e2d\u5fc3',
    icon: '\ud83d\udccb',
    items: [
      {page:'tasks', icon:'\ud83d\udccb', label:'任务清单'},
      {page:'plan', icon:'\ud83d\udcdd', label:'教学计划'},
      {page:'schedule', icon:'\ud83d\udcc5', label:'智能课程表'},
      {page:'progress', icon:'\ud83d\udcca', label:'教学进度'},
      {page:'folder', icon:'\ud83d\udcc1', label:'05 文件夹'}
    ]
  },
  students: {
    title: '\u5b66\u751f\u65e5\u5e38\u7ba1\u7406',
    icon: '\ud83c\udf93',
    groups: [
      {label:'\u6863\u6848\u603b\u5e93', items:[
        {page:'students', icon:'\ud83c\udf93', label:'学生档案总库'}
      ]},
      {label:'\u5b66\u751f\u5de5\u4f5c\u4efb\u52a1', collapsible:true, defaultOpen:false, items:[
        {page:'st-task-info', icon:'\ud83d\udcdd', label:'01 任务信息'},
        {page:'st-homework', icon:'\ud83d\udccb', label:'02 作业登记'},
        {page:'st-chat', icon:'\ud83d\udcac', label:'03 聊天框'},
        {page:'st-random', icon:'\ud83c\udfb2', label:'04 随机抽查'}
      ]},
      {label:'\u5b66\u60c5\u5206\u6790', collapsible:true, defaultOpen:false, items:[
        {page:'hw-analysis', icon:'\ud83d\udcca', label:'01 作业分析'},
        {page:'score-analysis', icon:'\ud83c\udfaf', label:'02 成绩分析'},
        {page:'dashboard', icon:'\ud83d\udcc8', label:'03 学情看板'}
      ]}
    ]
  },
  xiuxian: {
    title: '\u751f\u7269\u4ed9\u9014\u79d8\u5883',
    icon: '\ud83e\uddec',
    items: [
      {page:'xiuxian-archive', icon:'\ud83d\udcd6', label:'修仙档案总库'},
      {page:'xiuxian-tasks', icon:'\ud83d\udcdc', label:'修仙任务系统'},
      {page:'xiuxian-rank', icon:'\ud83c\udfc6', label:'修仙排行榜单'},
      {page:'xiuxian-pool', icon:'\ud83c\udfb4', label:'修仙角色体质'}
    ]
  },
  tools: {
    title: '\u5feb\u6377\u5de5\u5177',
    icon: '\ud83d\udd27',
    items: [
      {page:'automation', icon:'\u23f0', label:'自动化提醒'},
      {page:'skill-links', icon:'\ud83d\udd17', label:'Skill链接'},
      {page:'ima-link', icon:'\ud83e\udde0', label:'IMA链接入口'},
      {page:'daily-quiz', icon:'\ud83d\udcda', label:'每日练习'},
      {action:'openModeSwitcher', icon:'\ud83d\udd04', label:'05模式切换'},
      {action:'toggleNotch', icon:'\ud83d\udcf1', label:'06屏幕刘海'},
      {action:'showRuntimeStatus', icon:'\ud83d\udcca', label:'运行状态'},
      {action:'openDataManager', icon:'\ud83d\udce6', label:'数据导入合并'},
      {action:'syncQuick', icon:'\u2601\ufe0f', label:'云同步'}
    ]
  }
};
// 折叠状态：groupKey → boolean
const _mobileGroupCollapsed = {};

// ── 05 文件夹（应用数据目录内的真实文件管理器） ──
let _folderRelPath = '';
let _folderAllEntries = null;    // 当前目录已拉取的条目缓存（搜索时复用，避免每次键入都 IPC 拉取整目录）
let _folderAllRelPath = null;    // 缓存对应的 relPath，进入新目录时自动失效
let _folderSearchMode = false;   // 搜索模式标记：true 时 data-name 存储的是 rel_path（含子路径）
const _folderSort = { key: 'name', dir: 'asc' };        // 列表排序：name | mtime
let _folderMenuDocListenerAdded = false;              // 全局「点空白关菜单」监听只挂一次
const _folderSelected = new Set();                      // 多选：当前选中的项目名集合
let _folderAnchor = null;                             // Shift 多选锚点（行名）
let _folderVisibleOrder = [];                         // 当前列表可见项渲染顺序（name 数组）
let _folderEntriesMap = {};                           // name -> is_dir（批量操作取类型用）
let _folderKeyListenerAdded = false;                  // Ctrl+A 全局监听守卫（只挂一次）
let _folderDndListenerAdded = false;                  // 拖拽上传事件监听守卫（只挂一次）
let _folderClipboard = null;                          // 复制/剪切剪贴板：{items:[{name,isDir}],mode:'copy'|'cut',srcRel}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(Number(bytes))) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = Number(bytes);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(1)) + ' ' + u[i];
}

function folderIconFor(ext, isDir) {
  if (isDir) return '📁';
  let map = {
    doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
    pdf: '📄', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
    zip: '🗜️', rar: '🗜️', '7z': '🗜️', txt: '📃', mp3: '🎵', mp4: '🎬'
  };
  return map[String(ext || '').toLowerCase()] || '📄';
}

// 把 Unix 秒戳格式化为「2025/8/23 17:04」风格（贴合 Windows 资源管理器）
function formatDateTime(ts) {
  if (!ts) return '';
  let d = new Date(Number(ts) * 1000);
  const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// 按扩展名返回「Microsoft Word 文档」「PDF 文档」「PNG 图像」等友好类型名
function fileTypeLabel(name, ext, isDir) {
  if (isDir) return '文件夹';
  let e = String(ext || (String(name || '').split('.').pop() || '')).toLowerCase();
  const map = {
    doc: 'Microsoft Word 文档', docx: 'Microsoft Word 文档', docm: 'Microsoft Word 文档',
    dot: 'Microsoft Word 模板', dotx: 'Microsoft Word 模板',
    xls: 'Microsoft Excel 工作表', xlsx: 'Microsoft Excel 工作表', xlsm: 'Microsoft Excel 工作表',
    csv: 'CSV 文件',
    ppt: 'Microsoft PowerPoint 演示文稿', pptx: 'Microsoft PowerPoint 演示文稿',
    pdf: 'PDF 文档',
    png: 'PNG 图像', jpg: 'JPEG 图像', jpeg: 'JPEG 图像', gif: 'GIF 图像',
    bmp: 'BMP 图像', webp: 'WEBP 图像', svg: 'SVG 图像', ico: '图标文件', tif: 'TIFF 图像', tiff: 'TIFF 图像',
    zip: 'ZIP 压缩文件', rar: 'RAR 压缩文件', '7z': '7Z 压缩文件', tar: 'TAR 压缩文件', gz: 'GZ 压缩文件',
    txt: '文本文档', md: 'Markdown 文档', rtf: 'RTF 文档', log: '日志文件',
    json: 'JSON 文件', xml: 'XML 文件', html: 'HTML 文件', htm: 'HTML 文件',
    css: 'CSS 样式表', js: 'JavaScript 文件', ts: 'TypeScript 文件',
    py: 'Python 文件', rs: 'Rust 源文件', java: 'Java 源文件', c: 'C 源文件', cpp: 'C++ 源文件',
    mp3: 'MP3 音频', wav: 'WAV 音频', flac: 'FLAC 音频', aac: 'AAC 音频',
    mp4: 'MP4 视频', mkv: 'MKV 视频', avi: 'AVI 视频', mov: 'MOV 视频',
    exe: '应用程序', msi: 'Windows Installer 包', apk: 'Android 应用包'
  };
  return map[e] || (e ? e.toUpperCase() + ' 文件' : '文件');
}

async function renderFolder(area) {
  if (!area) return;
  area.style.position = 'relative';
  if (!isTauriApp()) {
    area.innerHTML = '<div class="empty-state"><span class="emoji">📁</span><div style="margin-top:10px">「05 文件夹」为桌面端功能。请在《派大星》Windows 桌面应用（安装包）中使用，可真实管理 Word / PPT / Excel / PDF / 图片 / 压缩包等任意文件，并一键云同步到你的云端。</div></div>';
    return;
  }
  area.innerHTML =
    '<style>' +
    '.folder-toolbar{padding:12px 14px;border-bottom:1px solid let(--border);gap:10px;flex-wrap:wrap;}' +
    '.folder-breadcrumb{font-size:14px;color:let(--text-muted);display:flex;align-items:center;flex-wrap:wrap;gap:2px;}' +
    '.folder-breadcrumb .crumb-root{cursor:pointer;color:let(--primary);font-weight:600;}' +
    '.folder-breadcrumb .crumb{color:let(--text);}' +
    '.folder-breadcrumb .crumb-link{cursor:pointer;color:let(--primary);}' +
    '.folder-breadcrumb .crumb-link:hover{text-decoration:underline;color:let(--primary-darker);}' +
    '.folder-breadcrumb .crumb-sep{color:let(--text-muted);margin:0 4px;}' +
    '.folder-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
    '.folder-list{padding:0 4px 8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:let(--primary) #eee;box-shadow:inset -10px 0 8px -10px rgba(0,0,0,0.12);}' +
    '.folder-list::-webkit-scrollbar{height:9px;}' +
    '.folder-list::-webkit-scrollbar-thumb{background:let(--primary);border-radius:5px;}' +
    '.folder-list::-webkit-scrollbar-track{background:#eee;border-radius:5px;}' +
    '.folder-row{display:flex;align-items:center;gap:10px;padding:7px 36px 7px 10px;border-radius:4px;position:relative;min-width:520px;}' +
    '.folder-row:not(.folder-row-header){border-bottom:1px solid #f0f0f0;}' +
    '.folder-row:hover:not(.folder-row-header){background:#f5f7fa;}' +
    '.folder-row.selected{background:#e6f0ff !important;}' +
    '.folder-row-header{font-weight:600;color:#666;font-size:12px;padding:8px 10px;border-bottom:1px solid #e0e0e0;user-select:none;min-width:520px;box-sizing:border-box;}' +
    '.folder-row-header .folder-cell.name{cursor:pointer;}' +
    '.folder-row-header .folder-cell.date{cursor:pointer;}' +
    '.folder-row-header .folder-cell.name:hover,.folder-row-header .folder-cell.date:hover{color:let(--primary);}' +
    '.folder-cell.name{flex:1;min-width:120px;display:flex;align-items:center;gap:8px;overflow:hidden;white-space:nowrap;}' +
    '.folder-cell.date{width:150px;color:let(--text-muted);font-size:13px;flex-shrink:0;font-variant-numeric:tabular-nums;}' +
    '.folder-cell.type{width:200px;color:let(--text-muted);font-size:13px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:4px;}' +
    '.row-icon{flex:0 0 auto;font-size:16px;line-height:1;width:20px;text-align:center;}' +
    '.row-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:let(--text);}' +
    '.row-subpath{display:block;font-size:11px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}' +
    '.row-menu-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:none;border:none;background:rgba(255,255,255,0.92);cursor:pointer;font-size:16px;line-height:1;padding:2px 8px;border-radius:4px;color:#777;box-shadow:0 1px 3px rgba(0,0,0,0.10);}' +
    '.folder-row:hover:not(.folder-row-header) .row-menu-btn{display:block;}' +
    '.row-menu-btn:hover{background:#e8e8e8;color:#111;}' +
    '@media (hover:none){.row-menu-btn{display:block !important;background:transparent;box-shadow:none;color:#999;}}' +
    '.btn-sm{padding:6px 12px;border:1px solid let(--border);border-radius:6px;background:let(--surface);cursor:pointer;font-size:13px;}' +
    '.btn-sm:hover{background:let(--primary-lightest);}' +
    '.btn-sm.paste-active{background:let(--primary);color:#fff;border-color:let(--primary);}' +
    '.btn-sm.paste-active:hover{filter:brightness(1.06);}' +
    '.row-menu-pop{position:fixed;z-index:9999;min-width:150px;background:let(--surface,#fff);border:1px solid let(--border,#d0d0d0);border-radius:6px;box-shadow:0 6px 22px rgba(0,0,0,0.16);padding:4px 0;font-size:13px;}' +
    '.row-menu-pop .menu-item{padding:8px 14px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:8px;}' +
    '.row-menu-pop .menu-item:hover{background:let(--primary-lightest,#eef4ff);}' +
    '.row-menu-pop .menu-item.danger{color:#c0392b;}' +
    '.row-menu-pop .menu-item.danger:hover{background:#fdecea;}' +
    // 多选：行首复选框
    '.row-check{flex:0 0 auto;width:15px;height:15px;margin:0 2px 0 0;cursor:pointer;accent-color:let(--primary,#2f6fed);}' +
    '.folder-row-header .row-check{margin:0;}' +
    // 拖拽上传：拖入高亮 + 遮罩提示
    '.folder-list.drag-over{outline:2px dashed let(--primary,#2f6fed);outline-offset:-4px;background:#f3f8ff;border-radius:6px;}' +
    '.folder-dnd-hint{display:none;position:absolute;left:8px;right:8px;top:64px;bottom:8px;z-index:50;align-items:center;justify-content:center;pointer-events:none;border:2px dashed let(--primary,#2f6fed);border-radius:8px;background:rgba(238,244,255,0.85);color:let(--primary,#2f6fed);font-size:15px;font-weight:600;}' +
    '.folder-dnd-hint.show{display:flex;}' +
    // 批量操作栏
    '.folder-bulkbar{display:none;align-items:center;gap:8px;padding:6px 14px;background:let(--primary-lightest,#eef4ff);border-bottom:1px solid let(--border,#e0e0e0);font-size:13px;color:let(--text,#333);}' +
    '.folder-bulkbar.show{display:flex;}' +
    '.folder-bulkbar .bulk-info{font-weight:600;}' +
    '.folder-bulkbar .btn-sm{padding:4px 10px;}' +
    '</style>' +
    '<div class="folder-toolbar flex-between">' +
      '<div class="folder-breadcrumb" id="folderBreadcrumb"></div>' +
      '<div class="folder-actions">' +
        '<button class="btn-sm" data-fa="up">⬆️ 上级</button>' +
        '<button class="btn-sm" data-fa="create">📁 新建文件夹</button>' +
        '<button class="btn-sm" data-fa="upload">⬆️ 上传文件</button>' +
        '<button class="btn-sm" id="folderPaste" data-fa="paste">📋 粘贴</button>' +
        '<input type="search" id="folderSearch" class="form-input" placeholder="搜索文件名…" style="width:130px">' +
        '<button class="btn-sm" data-fa="push">☁ 备份到云端</button>' +
        '<button class="btn-sm" data-fa="pull">☁ 从云端恢复</button>' +
      '</div>' +
    '</div>' +
    '<div class="folder-bulkbar" id="folderBulkBar">' +
      '<span class="bulk-info" id="folderBulkInfo">已选择 0 项</span>' +
      '<button class="btn-sm" data-fa="copy-sel">📋 复制</button>' +
      '<button class="btn-sm" data-fa="cut-sel">✂ 剪切</button>' +
      '<button class="btn-sm" data-fa="delete-sel">🗑 删除</button>' +
      '<button class="btn-sm" data-fa="bulk-clear">✕ 取消选择</button>' +
    '</div>' +
    '<div class="folder-list" id="folderList"></div>' +
    '<div class="folder-dnd-hint" id="folderDndHint">松开鼠标，上传到「当前文件夹」</div>';

  let listEl = area.querySelector('#folderList');
  const barEl = area.querySelector('.folder-actions');
  let bcEl = area.querySelector('#folderBreadcrumb');
  let searchEl = area.querySelector('#folderSearch');
  if (listEl) {
    // data-fa 动作（菜单 ⋯、面包屑等）
    listEl.addEventListener('click', onFolderClick);
    // 表头点击排序 + 行体点击多选（data-fa 按钮交由 onFolderClick 处理）
    listEl.addEventListener('click', function (e) {
      const sortCell = e.target.closest('.folder-row-header [data-sort]');
      if (sortCell) {
        let key = sortCell.getAttribute('data-sort');
        if (_folderSort.key === key) {
          _folderSort.dir = _folderSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          _folderSort.key = key; _folderSort.dir = 'asc';
        }
        refreshFolderList();
        return;
      }
      let row = e.target.closest('.folder-row');
      if (!row || row.classList.contains('folder-row-header')) return;
      if (e.target.closest('[data-fa]')) return;   // 菜单/按钮交给 onFolderClick
      if (e.target.closest('.row-check')) return;  // 复选框由 change 事件处理
      let name = row.getAttribute('data-name');
      if (e.shiftKey && _folderAnchor != null) {
        selectRange(name);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelect(name);
      } else {
        setSingleSelect(name);
      }
      _folderAnchor = name;
    });
    // 行首复选框：勾选/取消（等价于 Ctrl 点击，不清空其它）
    listEl.addEventListener('change', function (e) {
      let cb = e.target.closest('.row-check');
      if (!cb) return;
      let name = cb.getAttribute('data-name');
      if (cb.checked) { _folderSelected.add(name); } else { _folderSelected.delete(name); }
      _folderAnchor = name;
      applySelectionDom();
      updateBulkBar();
    });
    // 右键菜单：行上→针对该项（保持多选）；空白处→新建/粘贴/刷新
    listEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      let row = e.target.closest('.folder-row');
      const targetRow = (row && !row.classList.contains('folder-row-header')) ? row : null;
      openContextMenu(e.clientX, e.clientY, targetRow);
    });
    // 双击：进入文件夹 / 打开文件
    listEl.addEventListener('dblclick', function (e) {
      const row = e.target.closest('.folder-row');
      if (!row || row.classList.contains('folder-row-header')) return;
      let n = row.getAttribute('data-name');
      const d = row.getAttribute('data-isdir') === '1';
      runFolderAction(d ? 'enter' : 'open', n, d);
    });
  }
  if (barEl) barEl.addEventListener('click', onFolderClick);
  if (bcEl) bcEl.addEventListener('click', onFolderClick);
  const bulkBar = area.querySelector('#folderBulkBar');
  if (bulkBar) bulkBar.addEventListener('click', onFolderClick);   // 复制/剪切/删除/取消选择
  if (searchEl) searchEl.addEventListener('input', debounce(refreshFolderList, 250));
  // 拖拽上传：监听 Tauri 默认 emit 的拖放事件（tauri://drag-*），走 plugin:event|listen，不受 CSP 限制
  if (!_folderDndListenerAdded && isTauriApp()) {
    _folderDndListenerAdded = true;
    Promise.resolve()
      .then(function () { return import('@tauri-apps/api/event'); })
      .then(function (mod) {
        mod.listen('tauri://drag-enter', function () { if (document.getElementById('folderList')) onFolderDragEnter(); });
        mod.listen('tauri://drag-over', function () {});
        mod.listen('tauri://drag-leave', function () { if (document.getElementById('folderList')) onFolderDragLeave(); });
        mod.listen('tauri://drag-drop', function (e) {
          let p = (e && e.payload && e.payload.paths) || [];
          onFolderDrop(p);
        });
      })
      .catch(function () {});
  }
  // Ctrl / Command + A 全选（仅文件夹页面生效，屏蔽浏览器默认全选）
  if (!_folderKeyListenerAdded) {
    _folderKeyListenerAdded = true;
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (!document.getElementById('folderList')) return;
        let t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;  // 让输入框自己处理 Ctrl+A
        e.preventDefault();
        selectAllVisible();
      }
    });
  }
  // 全局：点击菜单弹窗外或非 ⋯ 按钮时关闭弹窗（只挂一次）
  if (!_folderMenuDocListenerAdded) {
    _folderMenuDocListenerAdded = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest('.row-menu-pop')) return;
      if (e.target.closest('[data-fa="menu"]')) return;
      let p = document.querySelector('.row-menu-pop');
      if (p) p.remove();
    });
  }

  await refreshFolderList();
}

// 从相对路径中拆分出父目录和文件名（"A/B/C.pdf" → { parent: "A/B", name: "C.pdf" }）
function _splitRelPath(relPath) {
  const idx = relPath.lastIndexOf('/');
  if (idx < 0) return { parent: '', name: relPath };
  return { parent: relPath.substring(0, idx), name: relPath.substring(idx + 1) };
}

async function refreshFolderList() {
  let listEl = document.getElementById('folderList');
  const bcEl = document.getElementById('folderBreadcrumb');
  const searchEl = document.getElementById('folderSearch');
  if (!listEl) return;
  try {
    const q = ((searchEl && searchEl.value) || '').trim();
    _folderSearchMode = q !== '';
    let entries;
    if (_folderSearchMode) {
      // 搜索模式：递归搜索当前层级及所有子文件夹
      const results = await __invoke('folder_search', { relPath: _folderRelPath, query: q });
      entries = (results || []).slice();
    } else {
      // 正常模式：列出当前目录
      const data = await __invoke('folder_list', { relPath: _folderRelPath });
      _folderAllEntries = ((data && data.entries) || []).slice();
      _folderAllRelPath = _folderRelPath;
      entries = ((data && data.entries) || []).slice();
    }
    if (bcEl) {
      // 面包屑：每段都可点击跳转（根=root，子段=goto+data-rel）
      const crumbs = [{ label: '文件夹', rel: '' }];
      if (_folderRelPath) {
        let acc = '';
        _folderRelPath.split('/').forEach(function (p) {
          acc = acc ? (acc + '/' + p) : p;
          crumbs.push({ label: p, rel: acc });
        });
      }
      bcEl.innerHTML = crumbs.map(function (c, i) {
        if (i === 0) return '<span class="crumb-root" data-fa="root">' + escapeHtml(c.label) + '</span>';
        return '<span class="crumb-sep">/</span><span class="crumb-link" data-fa="goto" data-rel="' + escapeAttr(c.rel) + '" title="进入 ' + escapeAttr(c.label) + '">' + escapeHtml(c.label) + '</span>';
      }).join('');
    }
    // 排序：按当前 _folderSort（文件夹始终排在文件之前，名称排序时）
    const sKey = _folderSort.key;
    const sMul = _folderSort.dir === 'desc' ? -1 : 1;
    entries.sort(function (a, b) {
      if (sKey === 'mtime') {
        return ((Number(a.mtime) || 0) - (Number(b.mtime) || 0)) * sMul;
      }
      // name 排序：文件夹优先，再按中文本地化比较
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'zh-CN') * sMul;
    });
    _folderVisibleOrder = [];
    _folderEntriesMap = {};
    // 表头：全选 | 名称 / 修改日期（可点排序）/ 类型
    const sortArrow = function (k) {
      return _folderSort.key === k ? (_folderSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    };
    let html = '<div class="folder-row folder-row-header">' +
      '<div class="folder-cell check"><input type="checkbox" class="row-check" id="folderCheckAll"></div>' +
      '<div class="folder-cell name" data-sort="name">名称' + sortArrow('name') + '</div>' +
      '<div class="folder-cell date" data-sort="mtime">修改日期' + sortArrow('mtime') + '</div>' +
      '<div class="folder-cell type">类型</div>' +
      '</div>';
    entries.forEach(function (en) {
      // 搜索模式下 data-name 存完整 rel_path（唯一键），正常模式存 name
      const rowKey = _folderSearchMode ? (en.rel_path || en.name) : en.name;
      // 诊断兜底：name 缺失/为空时显示明确占位符，便于排查"名称不见"类问题
      let _nm = en.name;
      let _nmTag = '';
      if (_nm === undefined) { _nm = '⚠undef'; _nmTag = 'name=undefined;keys=' + Object.keys(en).join(','); }
      else if (_nm === null) { _nm = '⚠null'; _nmTag = 'name=null'; }
      else if (_nm === '') { _nm = '⚠empty'; _nmTag = 'name=空字符串'; }
      _folderVisibleOrder.push(rowKey);   // 维持原始 key（用于 selected/map）
      _folderEntriesMap[rowKey] = en.is_dir;
      let checked = _folderSelected.has(rowKey) ? ' checked' : '';
      let icon = folderIconFor(en.ext, en.is_dir);
      const typeLabel = fileTypeLabel(en.name, en.ext, en.is_dir);
      const mtime = formatDateTime(en.mtime);
      // 搜索模式下显示子文件夹路径作为副标题
      let subPathHtml = '';
      if (_folderSearchMode && en.rel_path) {
        const parts = _splitRelPath(en.rel_path);
        if (parts.parent) {
          subPathHtml = '<span class="row-subpath" title="' + escapeAttr(parts.parent) + '">📍 ' + escapeHtml(parts.parent) + '</span>';
        }
      }
      html += '<div class="folder-row" data-name="' + escapeAttr(rowKey) + '" data-isdir="' + (en.is_dir ? '1' : '0') + '">' +
        '<div class="folder-cell check"><input type="checkbox" class="row-check" data-name="' + escapeAttr(rowKey) + '"' + checked + '></div>' +
        '<div class="folder-cell name">' +
          '<span class="row-icon">' + icon + '</span>' +
          '<span class="row-name" title="' + escapeAttr(_nmTag || _nm) + '">' + escapeHtml(_nm) + '</span>' +
          subPathHtml +
        '</div>' +
        '<div class="folder-cell date">' + mtime + '</div>' +
        '<div class="folder-cell type" title="' + escapeAttr(typeLabel) + '">' + escapeHtml(typeLabel) + '</div>' +
        '<button class="row-menu-btn" data-fa="menu" title="更多操作">⋯</button>' +
      '</div>';
    });
    listEl.innerHTML = html || ('<div class="empty-state">' + (_folderSearchMode ? '未找到匹配的文件' : '此文件夹为空') + '</div>');
    applySelectionDom();
    updateBulkBar();
    let ca = listEl.querySelector('#folderCheckAll');
    if (ca) {
      setCheckAllState(ca);
      ca.addEventListener('change', function () {
        if (ca.checked) { _folderVisibleOrder.forEach(function (n) { _folderSelected.add(n); }); }
        else { _folderVisibleOrder.forEach(function (n) { _folderSelected.delete(n); }); }
        applySelectionDom();
        updateBulkBar();
      });
    }
    updateFolderPasteBtn();
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state">加载失败：' + escapeHtml(String(e)) + '</div>';
  }
}

// 跨平台文件选择：移动端/桌面统一走 tauri-plugin-dialog 的 open 命令。
// 注：后端 pick_files 在 Android 上返回 None（残实现），故前端直接调 dialog 插件；
// 桌面端同样走 dialog（原生多选，体验一致），移动端因此可用。
async function pickFiles(opts) {
  opts = opts || {};
  if (!isTauriApp()) return [];
  try {
    let args = { multiple: !!opts.multiple };
    if (opts.filters) args.filters = opts.filters;
    if (opts.title) args.title = opts.title;
    // Tauri v2 dialog plugin：open 必填 options 包裹（包成 { options: { multiple, filters, ... } }）
    let r = await __invoke('plugin:dialog|open', { options: args });
    if (!r) return [];
    return Array.isArray(r) ? r : [r];
  } catch (e) {
    console.warn('[pickFiles] 打开文件选择器失败：', e);
    showToast('无法打开文件选择器：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    return [];
  }
}

// 执行具体的文件夹动作（行内点击与菜单弹窗共用）
async function runFolderAction(action, name, isDir) {
  try {
    // 打开文件防抖：避免连点/连双击重复调起导致异常
    if (action === 'open') {
      if (window._folderOpening) return;
      window._folderOpening = true;
      setTimeout(function () { window._folderOpening = false; }, 800);
    }
    // 搜索模式下 name 实际是完整 rel_path（含子路径），拆分出父目录和真实文件名
    let _rp = _folderRelPath;
    let _nm = name;
    if (_folderSearchMode && name) {
      const parts = _splitRelPath(name);
      _rp = parts.parent;
      _nm = parts.name;
    }
    if (action === 'up') {
      clearSelection();
      if (_folderRelPath) {
        const parts = _folderRelPath.split('/');
        parts.pop();
        _folderRelPath = parts.join('/');
      }
      await refreshFolderList();
    } else if (action === 'root') {
      clearSelection();
      _folderRelPath = '';
      await refreshFolderList();
    } else if (action === 'goto') {
      // 面包屑点击跳转：name 即目标相对路径（来源 data-rel）
      clearSelection();
      _folderRelPath = name || '';
      await refreshFolderList();
    } else if (action === 'enter') {
      clearSelection();
      if (_folderSearchMode) {
        // 搜索模式下点击文件夹：name 是完整 rel_path，直接跳转并退出搜索
        _folderRelPath = name;
        const searchEl = document.getElementById('folderSearch');
        if (searchEl) searchEl.value = '';
        _folderSearchMode = false;
      } else {
        _folderRelPath = (_folderRelPath ? _folderRelPath + '/' : '') + name;
      }
      await refreshFolderList();
    } else if (action === 'open') {
      await __invoke('file_open', { relPath: _rp, name: _nm });
    } else if (action === 'props') {
      showFilePropsModal(_nm, isDir, _rp);
    } else if (action === 'create') {
      let nm = prompt('新建文件夹名称：');
      if (!nm) return;
      await __invoke('folder_create', { relPath: _folderRelPath, name: nm });
      showToast('已新建文件夹：' + nm);
      await refreshFolderList();
    } else if (action === 'upload') {
      const paths = await pickFiles({ multiple: true });
      if (!paths || !paths.length) return;
      // 区分真实路径与 Android content:// URI（移动端 dialog 返回 content URI，std::fs 读不了）
      const real = [], content = [];
      paths.forEach(function (p) {
        if (typeof p === 'string' && p.indexOf('content://') === 0) content.push(p);
        else real.push(p);
      });
      let total = 0;
      if (real.length) {
        let n = await __invoke('import_files', { paths: real, relDst: _folderRelPath });
        total += (n || 0);
      }
      for (let ci = 0; ci < content.length; ci++) {
        try {
          const uri = content[ci];
          let nm = uri.split('/').pop() || ('文件_' + Date.now());
          try { nm = decodeURIComponent(nm); } catch (e) {}
          let r = await __invoke('import_file_from_uri', { uri: uri, name: nm, relDst: _folderRelPath });
          // 后端返回 u32（number），兼容历史可能的 {count} 形态
          total += (typeof r === 'number' ? r : ((r && r.count) || 0));
        } catch (e) {
          showToast('导入失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
        }
      }
      showToast('已导入 ' + total + ' 个文件');
      await refreshFolderList();
    } else if (action === 'rename') {
      const nn = prompt('重命名为：', _nm);
      if (!nn || nn === _nm) return;
      await __invoke('item_rename', { relPath: _rp, oldName: _nm, newName: nn });
      showToast('已重命名');
      await refreshFolderList();
    } else if (action === 'delete') {
      if (!confirm('确定删除「' + _nm + '」' + (isDir ? '（及其下所有内容）' : '') + '？')) return;
      await __invoke('item_delete', { relPath: _rp, name: _nm });
      showToast('已删除');
      await refreshFolderList();
    } else if (action === 'copy') {
      _folderClipboard = { items: [{ name: _nm, isDir: isDir }], mode: 'copy', srcRel: _rp };
      updateFolderPasteBtn();
      showToast('已复制：' + _nm + '（去目标文件夹点「粘贴」）');
    } else if (action === 'cut') {
      _folderClipboard = { items: [{ name: _nm, isDir: isDir }], mode: 'cut', srcRel: _rp };
      updateFolderPasteBtn();
      showToast('已剪切：' + _nm + '（去目标文件夹点「粘贴」）');
    } else if (action === 'copy-sel') {
      bulkSetClipboard('copy');
    } else if (action === 'cut-sel') {
      bulkSetClipboard('cut');
    } else if (action === 'delete-sel') {
      await bulkDeleteSelected();
    } else if (action === 'refresh') {
      await refreshFolderList();
    } else if (action === 'bulk-clear') {
      clearSelection();
    } else if (action === 'paste') {
      await doFolderPaste();
    } else if (action === 'push') {
      showToast('正在备份到云端…');
      let r = await __invoke('folder_cloud_push');
      showToast('已备份 ' + ((r && r.uploaded) || 0) + ' 个文件');
    } else if (action === 'pull') {
      if (!confirm('从云端恢复会覆盖本地同名文件，继续？')) return;
      showToast('正在从云端恢复…');
      const r2 = await __invoke('folder_cloud_pull');
      showToast('已恢复 ' + ((r2 && r2.downloaded) || 0) + ' 个文件');
      await refreshFolderList();
    }
  } catch (err) {
    showToast('操作失败：' + String(err));
  }
}

// 粘贴剪贴板内容到当前目录（复制=保留源；剪切=移动后清空）
async function doFolderPaste() {
  if (!_folderClipboard || !_folderClipboard.items || !_folderClipboard.items.length) {
    showToast('请先「复制」或「剪切」一个项目'); return;
  }
  const cb = _folderClipboard;
  try {
    let n = 0, skipped = 0;
    for (let i = 0; i < cb.items.length; i++) {
      let it = cb.items[i];
      // 剪切且目标与源同目录 → 跳过（已在当前文件夹）
      if (cb.mode === 'cut' && cb.srcRel === _folderRelPath) { skipped++; continue; }
      if (cb.mode === 'cut') {
        await __invoke('item_move', { relSrc: cb.srcRel, name: it.name, relDst: _folderRelPath });
      } else {
        await __invoke('item_copy', { relSrc: cb.srcRel, name: it.name, relDst: _folderRelPath });
      }
      n++;
    }
    if (cb.mode === 'cut') _folderClipboard = null;   // 剪切后清空剪贴板
    updateFolderPasteBtn();
    showToast(cb.mode === 'cut'
      ? ('已移动 ' + n + ' 项' + (skipped ? '（' + skipped + ' 项已在当前文件夹）' : ''))
      : ('已复制 ' + n + ' 项'));
    await refreshFolderList();
  } catch (err) {
    showToast('粘贴失败：' + String(err));
  }
}

// 根据剪贴板状态刷新工具栏「粘贴」按钮（有内容时高亮并显示项目数/名）
function updateFolderPasteBtn() {
  let btn = document.getElementById('folderPaste');
  if (!btn) return;
  if (_folderClipboard && _folderClipboard.items && _folderClipboard.items.length) {
    const cnt = _folderClipboard.items.length;
    let label = cnt === 1 ? _folderClipboard.items[0].name : (cnt + ' 项');
    btn.textContent = '📋 粘贴：' + label;
    btn.classList.add('paste-active');
  } else {
    btn.textContent = '📋 粘贴';
    btn.classList.remove('paste-active');
  }
}

// ── 多选 / 批量操作辅助函数 ──
function applySelectionDom() {
  const listEl = document.getElementById('folderList');
  if (!listEl) return;
  listEl.querySelectorAll('.folder-row').forEach(function (r) {
    if (r.classList.contains('folder-row-header')) return;
    let n = r.getAttribute('data-name');
    if (_folderSelected.has(n)) r.classList.add('selected'); else r.classList.remove('selected');
  });
}

function updateBulkBar() {
  const bar = document.getElementById('folderBulkBar');
  const info = document.getElementById('folderBulkInfo');
  if (bar) { if (_folderSelected.size > 0) bar.classList.add('show'); else bar.classList.remove('show'); }
  if (info) info.textContent = '已选择 ' + _folderSelected.size + ' 项';
  let ca = document.getElementById('folderCheckAll');
  if (ca) setCheckAllState(ca);
}

function setCheckAllState(ca) {
  const total = _folderVisibleOrder.length;
  let sel = 0;
  _folderVisibleOrder.forEach(function (n) { if (_folderSelected.has(n)) sel++; });
  ca.checked = (total > 0 && sel === total);
  try { ca.indeterminate = (sel > 0 && sel < total); } catch (e) {}
}

function setSingleSelect(name) {
  _folderSelected.clear();
  _folderSelected.add(name);
  applySelectionDom(); updateBulkBar();
}

function toggleSelect(name) {
  if (_folderSelected.has(name)) _folderSelected.delete(name); else _folderSelected.add(name);
  applySelectionDom(); updateBulkBar();
}

function selectRange(name) {
  const order = _folderVisibleOrder;
  let a = order.indexOf(_folderAnchor);
  let b = order.indexOf(name);
  if (a < 0) a = 0;
  if (b < 0) b = order.length - 1;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let i = lo; i <= hi; i++) _folderSelected.add(order[i]);
  applySelectionDom(); updateBulkBar();
}

function clearSelection() {
  _folderSelected.clear();
  _folderAnchor = null;
  applySelectionDom(); updateBulkBar();
  const ca = document.getElementById('folderCheckAll');
  if (ca) { ca.checked = false; try { ca.indeterminate = false; } catch (e) {} }
}

function selectAllVisible() {
  _folderVisibleOrder.forEach(function (n) { _folderSelected.add(n); });
  applySelectionDom(); updateBulkBar();
}

function bulkSetClipboard(mode) {
  if (_folderSearchMode) { showToast('请先清空搜索再进行批量操作'); return; }
  if (_folderSelected.size === 0) { showToast('请先选中要' + (mode === 'cut' ? '剪切' : '复制') + '的项目'); return; }
  let items = [];
  _folderSelected.forEach(function (n) { items.push({ name: n, isDir: !!_folderEntriesMap[n] }); });
  _folderClipboard = { items: items, mode: mode, srcRel: _folderRelPath };
  updateFolderPasteBtn();
  showToast((mode === 'cut' ? '已剪切 ' : '已复制 ') + items.length + ' 项（去目标文件夹点「粘贴」）');
}

async function bulkDeleteSelected() {
  if (_folderSearchMode) { showToast('请先清空搜索再进行批量操作'); return; }
  if (_folderSelected.size === 0) return;
  const names = [];
  _folderSelected.forEach(function (n) { names.push(n); });
  if (!confirm('确定删除选中的 ' + names.length + ' 个项目？此操作不可撤销。')) return;
  try {
    const r = await __invoke('item_delete_many', { relPath: _folderRelPath, names: names });
    showToast('已删除 ' + (typeof r === 'number' ? r : ((r && r.count) || 0)) + ' 个文件');
    clearSelection();
    await refreshFolderList();
  } catch (err) {
    showToast('批量删除失败：' + String(err));
  }
}

// 右键菜单：行上→针对该项（保持多选）；空白处→新建/粘贴/刷新
function openContextMenu(x, y, targetRow) {
  let existing = document.querySelector('.row-menu-pop');
  if (existing) existing.remove();
  const hasSel = _folderSelected.size > 0;
  const targetName = targetRow ? targetRow.getAttribute('data-name') : null;
  const targetIsDir = targetRow ? targetRow.getAttribute('data-isdir') === '1' : false;
  if (targetRow) {
    // 右键在已选中的多行之一 → 保持多选；否则改为只选该行
    if (!hasSel || !_folderSelected.has(targetName)) setSingleSelect(targetName);
  }
  let items = [];
  if (targetRow) {
    items.push({ fa: targetIsDir ? 'enter' : 'open', label: '📂 打开' });
    items.push({ fa: 'props', label: 'ℹ️ 属性' });
    items.push({ fa: 'copy-sel', label: '📋 复制' + (hasSel ? '（' + _folderSelected.size + ' 项）' : '') });
    items.push({ fa: 'cut-sel', label: '✂ 剪切' + (hasSel ? '（' + _folderSelected.size + ' 项）' : '') });
    items.push({ fa: 'rename', label: '✏ 重命名' });
    items.push({ fa: 'delete-sel', label: '🗑 删除' + (hasSel ? '（' + _folderSelected.size + ' 项）' : ''), danger: true });
  } else {
    items.push({ fa: 'create', label: '📁 新建文件夹' });
    if (_folderClipboard && _folderClipboard.items && _folderClipboard.items.length) items.push({ fa: 'paste', label: '📋 粘贴' });
    items.push({ fa: 'refresh', label: '↻ 刷新' });
    if (hasSel) {
      items.push({ fa: 'copy-sel', label: '📋 复制选中（' + _folderSelected.size + '）' });
      items.push({ fa: 'cut-sel', label: '✂ 剪切选中（' + _folderSelected.size + '）' });
      items.push({ fa: 'delete-sel', label: '🗑 删除选中（' + _folderSelected.size + '）', danger: true });
    }
  }
  let pop = document.createElement('div');
  pop.className = 'row-menu-pop';
  pop.innerHTML = items.map(function (it) {
    return '<div class="menu-item' + (it.danger ? ' danger' : '') + '" data-fa="' + it.fa + '">' + it.label + '</div>';
  }).join('');
  let popW = 180, popH = items.length * 34 + 8;
  let left = x, top = y;
  if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
  if (top + popH > window.innerHeight) top = window.innerHeight - popH - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  pop.addEventListener('click', function (ev) {
    let it = ev.target.closest('[data-fa]');
    if (!it) return;
    let fa = it.getAttribute('data-fa');
    pop.remove();
    runFolderAction(fa, targetName, targetIsDir);
  });
  document.body.appendChild(pop);
}

// ── 拖拽上传处理（由 Tauri 默认拖放事件 tauri://drag-* 触发） ──
function onFolderDragEnter() {
  let el = document.getElementById('folderList');
  let h = document.getElementById('folderDndHint');
  if (el) el.classList.add('drag-over');
  if (h && el) h.classList.add('show');
}
function onFolderDragLeave() {
  let el = document.getElementById('folderList');
  let h = document.getElementById('folderDndHint');
  if (el) el.classList.remove('drag-over');
  if (h) h.classList.remove('show');
}
function onFolderDrop(paths) {
  let el = document.getElementById('folderList');
  const h = document.getElementById('folderDndHint');
  if (el) el.classList.remove('drag-over');
  if (h) h.classList.remove('show');
  if (!el) return;   // 不在文件夹页面，忽略拖放
  if (!paths || !paths.length) return;
  __invoke('import_files', { paths: paths, relDst: _folderRelPath })
    .then(function (n) { showToast('已拖入上传 ' + (n || 0) + ' 个文件'); refreshFolderList(); })
    .catch(function (err) { showToast('拖入上传失败：' + String(err)); });
}

// 在某行按钮旁弹出操作菜单（行内 hover 显示的 ⋯ 按钮触发）
function openRowMenu(btn, name, isDir) {
  const existing = document.querySelector('.row-menu-pop');
  // 同一行重复点 → 关闭
  if (existing && existing.getAttribute('data-name') === name && existing.getAttribute('data-isdir') === (isDir ? '1' : '0')) {
    existing.remove();
    return;
  }
  if (existing) existing.remove();
  const rect = btn.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'row-menu-pop';
  pop.setAttribute('data-name', name);
  pop.setAttribute('data-isdir', isDir ? '1' : '0');
  pop.innerHTML =
    '<div class="menu-item" data-fa="' + (isDir ? 'enter' : 'open') + '">📂 打开</div>' +
    '<div class="menu-item" data-fa="props">ℹ️ 属性</div>' +
    '<div class="menu-item" data-fa="rename">✏ 重命名</div>' +
    '<div class="menu-item" data-fa="copy">📋 复制</div>' +
    '<div class="menu-item" data-fa="cut">✂ 剪切</div>' +
    '<div class="menu-item danger" data-fa="delete">🗑 删除</div>';
  // 定位：弹窗在按钮下方、右对齐到按钮右侧；空间不够则向上弹出
  const popW = 150;
  let left = rect.right - popW;
  if (left < 8) left = 8;
  let top = rect.bottom + 4;
  if (top + 170 > window.innerHeight) top = rect.top - 170 - 4;
  if (top < 8) top = 8;
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
  // 弹窗内点击直接走 runFolderAction
  pop.addEventListener('click', function (ev) {
    const it = ev.target.closest('[data-fa]');
    if (!it) return;
    const p = pop; p.remove();
    runFolderAction(it.getAttribute('data-fa'), p.getAttribute('data-name'), p.getAttribute('data-isdir') === '1');
  });
  document.body.appendChild(pop);
}

// 文件属性弹窗：显示类型/大小/修改时间 + 完整存储位置，并支持一键在文件管理器中定位
function showFilePropsModal(name, isDir, relPath) {
  const _relPath = relPath || _folderRelPath;
  const old = document.getElementById('filePropsModal');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'filePropsModal';
  overlay.className = 'fp-overlay';
  overlay.innerHTML =
    '<div class="fp-modal">' +
      '<div class="fp-head">' +
        '<div class="fp-icon">' + (isDir ? '📁' : '📄') + '</div>' +
        '<div class="fp-name" id="fpName"></div>' +
        '<button class="fp-close" id="fpClose" title="关闭" aria-label="关闭">✕</button>' +
      '</div>' +
      '<div class="fp-body" id="fpBody">' +
        '<div class="fp-loading">正在读取属性</div>' +
      '</div>' +
      '<div class="fp-foot">' +
        '<button class="fp-btn fp-btn-sec" id="fpCopy">📋 复制路径</button>' +
        '<button class="fp-btn fp-btn-pri" id="fpReveal">' + (/Android/.test(navigator.userAgent) ? '📂 打开文件' : '📂 在文件管理器中打开') + '</button>' +
      '</div>' +
    '</div>';

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  const onKey = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  const closeBtn = document.getElementById('fpClose');
  if (closeBtn) closeBtn.onclick = close;
  const nameEl0 = document.getElementById('fpName');
  if (nameEl0) nameEl0.textContent = name;

  __invoke('file_props', { relPath: _relPath, name: name })
    .then(function (p) {
      const sizeStr = p.is_dir ? '—（文件夹）' : formatBytes(p.size_bytes);
      const dateStr = p.mtime ? new Date(p.mtime * 1000).toLocaleString('zh-CN') : '—';
      const typeStr = p.is_dir ? '文件夹' : (p.ext ? (p.ext.toUpperCase() + ' 文件') : '文件');
      const nameEl = document.getElementById('fpName'); if (nameEl) nameEl.textContent = p.name;
      let bodyEl = document.getElementById('fpBody');
      if (bodyEl) bodyEl.innerHTML =
        '<div class="fp-stats">' +
          '<div class="fp-stat"><span>类型</span><b>' + escapeHtml(typeStr) + '</b></div>' +
          '<div class="fp-stat"><span>大小</span><b>' + escapeHtml(sizeStr) + '</b></div>' +
          '<div class="fp-stat"><span>修改时间</span><b>' + escapeHtml(dateStr) + '</b></div>' +
        '</div>' +
        '<div class="fp-path-box">' +
          '<div class="fp-path-label">存储位置</div>' +
          '<div class="fp-path" id="fpPath">' + escapeHtml(p.full_path) + '</div>' +
        '</div>';
      const copyBtn = document.getElementById('fpCopy');
      if (copyBtn) copyBtn.onclick = function () {
        const txt = p.full_path;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(function () { showToast('路径已复制'); }).catch(function () { fpFallbackCopy(txt); });
        } else { fpFallbackCopy(txt); }
      };
      const revealBtn = document.getElementById('fpReveal');
      if (revealBtn) revealBtn.onclick = function () {
        const _isAndroid = /Android/.test(navigator.userAgent);
        const _revealLabel = _isAndroid ? '📂 打开文件' : '📂 在文件管理器中打开';
        revealBtn.disabled = true; revealBtn.textContent = _isAndroid ? '打开中…' : '定位中…';
        __invoke('file_reveal', { relPath: _relPath, name: name })
          .then(function () { showToast(_isAndroid ? '已打开文件' : '已打开文件管理器'); })
          .catch(function (err) { showToast((_isAndroid ? '打开失败：' : '定位失败：') + String(err), 'warn'); revealBtn.disabled = false; revealBtn.textContent = _revealLabel; });
      };
    })
    .catch(function (err) {
      const bodyEl = document.getElementById('fpBody');
      if (bodyEl) bodyEl.innerHTML = '<div style="color:#9E1B14;padding:20px;font-family:SimSun,serif;font-size:13px">读取属性失败：' + escapeHtml(String(err)) + '</div>';
    });
}

function fpRow(k, v) {
  return '<div style="display:flex;gap:8px;padding:3px 0"><div style="color:let(--text-muted);min-width:84px;flex-shrink:0">' + k + '</div><div style="flex:1;word-break:break-all">' + escapeHtml(String(v)) + '</div></div>';
}
function fpFallbackCopy(text) {
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    showToast('路径已复制');
  } catch (e) { showToast('复制失败，请手动复制'); }
}

// 行内/工具栏/面包屑的 data-fa 统一入口（弹窗类动作 → openRowMenu；其余 → runFolderAction）
async function onFolderClick(e) {
  const el = e.target.closest('[data-fa]');
  if (!el) return;
  const action = el.getAttribute('data-fa');
  // 上下文：从最近带 data-name 的元素取（.folder-row 或 .row-menu-pop）
  const ctx = el.closest('[data-name]');
  const name = ctx ? ctx.getAttribute('data-name') : '';
  const isDir = ctx ? ctx.getAttribute('data-isdir') === '1' : false;
  if (action === 'menu') {
    openRowMenu(el, name, isDir);
    return;
  }
  if (action === 'goto') {
    // 面包屑跳转：data-rel 即目标相对路径
    await runFolderAction('goto', el.getAttribute('data-rel') || '', false);
    return;
  }
  await runFolderAction(action, name, isDir);
}

function navigateTo(page) {
  console.log('[navigateTo] START page=', page, 'current=', (state||{}).currentPage, 'passwordUnlocked=', (state||{}).passwordUnlocked, 'hasPassword=', !!(state||{}).appPassword);
  // Password check: exempt student task pages
  if (!PASSWORD_EXEMPT_PAGES.includes(page) && state.appPassword && !state.passwordUnlocked) {
    console.log('[navigateTo] BLOCKED by password! opening modal for', page);
    openPasswordModal(page);
    return;
  }
  console.log('[navigateTo] PASSED password check, proceeding');
  // 离开作业登记页时清空选中状态，防止跨页面残留
  if (page !== 'st-homework') homeworkSelection.clear();
  state.currentPage = page;
  if (page && page.indexOf('xiuxian-') === 0) {
    const xtab = page.replace('xiuxian-','');
    if (!state.xiuxian) state.xiuxian = {students:{},meta:{}};
    state.xiuxian.view = xtab; state.xiuxian.activeStudent = null; state.xiuxian.activeClass = null;
  }
  saveState();
  // Active main items
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.classList.contains('nav-parent')) {
      n.classList.remove('active');
    } else {
      n.classList.toggle('active', n.dataset.page === page);
    }
  });
  // Active child items
  document.querySelectorAll('.nav-child-item').forEach(n => n.classList.toggle('active', n.dataset.page===page));
  // Expand parents if child selected
  if (PARENT_PAGES[page]) expandNavParent(PARENT_PAGES[page], true);
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || '';
  renderPage();
  closeSidebar();
}

function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
}

/* ===== 桌面 / 手机 App 模式切换 ===== */
function isMobileUI() {
  if (state.uiMode === 'mobile') return true;
  return false;
}
function updateUiModeBtn() {
  let btn = document.getElementById('uiModeBtn');
  if (!btn) return;
  const icon = document.getElementById('uiModeIcon');
  const text = document.getElementById('uiModeText');
  if (state.uiMode === 'mobile') { if (icon) icon.textContent = '📱'; if (text) text.textContent = '手机'; }
  else { if (icon) icon.textContent = '💻'; if (text) text.textContent = '桌面'; }
}
function applyUiMode(opts) {
  opts = opts || {};
  const mobile = isMobileUI();
  const root = document.documentElement;
  const wasMobile = root.classList.contains('ui-mobile');
  if (mobile) root.classList.add('ui-mobile'); else root.classList.remove('ui-mobile');
  updateUiModeBtn();
  updateMobileFab();
  if (opts.rerender && (mobile !== wasMobile)) renderPage();
  updateTopBarDragState();
}
function cycleUiMode() {
  state.uiMode = state.uiMode === 'mobile' ? 'desktop' : 'mobile';
  try { localStorage.setItem('uiMode', state.uiMode); } catch(e) {}
  applyUiMode({ rerender: true });
  showToast('已切换到' + (state.uiMode === 'mobile' ? '手机' : '桌面') + '模式', 'info');
}
function setUiMode(mode) {
  if (mode !== 'mobile' && mode !== 'desktop') return;
  state.uiMode = mode;
  try { localStorage.setItem('uiMode', mode); } catch(e) {}
  try { localStorage.setItem('uiModeInitialized', '1'); } catch(e) {}
  applyUiMode({ rerender: true });
  closeModal();
  showToast('已切换到' + (mode === 'mobile' ? '手机' : '桌面') + '模式', 'success');
}
function openModeSwitcher() {
  const cur = state.uiMode || 'desktop';
  let html = '<div style="text-align:center;padding:8px 0 4px">' +
    '<div style="font-size:32px;margin-bottom:8px">🔄</div>' +
    '<div style="font-size:16px;font-weight:700;color:let(--text-heading);margin-bottom:4px">选择显示模式</div>' +
    '<div style="font-size:13px;color:let(--text-muted);margin-bottom:20px">当前：' + (cur === 'mobile' ? '📱 手机模式' : '💻 桌面模式') + '</div>' +
    '</div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:16px">';
  html += '<div class="mode-pick-card' + (cur==='desktop'?' mode-pick-active':'') + '" data-click="setUiMode" data-click-args="[&quot;desktop&quot;]" style="flex:1;cursor:pointer;border:2px solid ' + (cur==='desktop'?'let(--primary)':'let(--border-light)') + ';border-radius:12px;padding:20px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:36px;margin-bottom:8px">💻</div>' +
    '<div style="font-weight:700;font-size:15px;color:let(--text-heading)">桌面模式</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-top:4px">适合电脑/平板</div>' +
    '</div>';
  html += '<div class="mode-pick-card' + (cur==='mobile'?' mode-pick-active':'') + '" data-click="setUiMode" data-click-args="[&quot;mobile&quot;]" style="flex:1;cursor:pointer;border:2px solid ' + (cur==='mobile'?'let(--primary)':'let(--border-light)') + ';border-radius:12px;padding:20px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:36px;margin-bottom:8px">📱</div>' +
    '<div style="font-weight:700;font-size:15px;color:let(--text-heading)">手机模式</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-top:4px">适合手机/窄屏</div>' +
    '</div>';
  html += '</div>';
  html += '<div style="text-align:center;font-size:12px;color:let(--text-muted)">选择后随时可在「快捷工具 → 05模式切换」中更改</div>';
  openModal(html, { title: '模式切换', width: '420px' });
}
function showFirstLaunchModePicker() {
  let html = '<div style="text-align:center;padding:16px 0 8px">' +
    '<div style="font-size:40px;margin-bottom:12px">🧽</div>' +
    '<div style="font-size:18px;font-weight:700;color:let(--text-heading);margin-bottom:4px">欢迎使用派大星</div>' +
    '<div style="font-size:14px;color:let(--text-muted);margin-bottom:24px">请选择你喜欢的显示模式</div>' +
    '</div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:16px">';
  html += '<div class="mode-pick-card" data-click="setUiMode" data-click-args="[&quot;desktop&quot;]" style="flex:1;cursor:pointer;border:2px solid let(--border-light);border-radius:12px;padding:24px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:40px;margin-bottom:10px">💻</div>' +
    '<div style="font-weight:700;font-size:16px;color:let(--text-heading)">桌面模式</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-top:6px">适合电脑/平板<br>侧栏导航·宽屏布局</div>' +
    '</div>';
  html += '<div class="mode-pick-card" data-click="setUiMode" data-click-args="[&quot;mobile&quot;]" style="flex:1;cursor:pointer;border:2px solid let(--border-light);border-radius:12px;padding:24px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:40px;margin-bottom:10px">📱</div>' +
    '<div style="font-weight:700;font-size:16px;color:let(--text-heading)">手机模式</div>' +
    '<div style="font-size:12px;color:let(--text-muted);margin-top:6px">适合手机/窄屏<br>底部导航·触控优化</div>' +
    '</div>';
  html += '</div>';
  html += '<div style="text-align:center;font-size:12px;color:let(--text-muted)">选择后随时可在「快捷工具 → 05模式切换」中更改</div>';
  openModal(html, { title: '初次使用 · 选择模式', width: '440px', closable: false });
}

/* ===== 手机溢出菜单 / FAB / TabBar角标（Phase 0+1，参考微信/QQ） ===== */
function openMobileOverflow() {
  const items = [
    { key:'save',   icon:'💾', label:'保存数据' },
    { key:'sync',   icon:'☁️', label:'云端同步' },
    { key:'status', icon:'📊', label:'运行状态' },
    { key:'data',   icon:'📦', label:'数据导入合并' },
    { key:'theme',  icon:'🎨', label:'主题设置' },
    { key:'mode',   icon:'🔄', label:'切换桌面/手机' },
    { key:'modeSwitch', icon:'📱', label:'模式切换面板' }
  ];
  // 浏览器预览模式：追加「载入示例数据」便于直接预览列表效果（生产 App 不显示）
  if (!isTauriApp()) {
    items.push({ key:'demo', icon:'🧪', label:'载入示例数据' });
  }
  const html = items.map(function(it){
    let args = escapeAttr(JSON.stringify([it.key]));
    return '<div class="mobile-overflow-item" data-click="__dcOverflow" data-click-args="'+args+'">' +
      '<span class="of-icon">'+it.icon+'</span><span class="of-label">'+it.label+'</span></div>';
  }).join('');
  const list = document.getElementById('mobileOverflowList');
  if (list) list.innerHTML = html;
  let ov = document.getElementById('mobileOverflowOverlay');
  let pn = document.getElementById('mobileOverflowPanel');
  if (ov) { ov.classList.add('open'); ov.setAttribute('aria-hidden','false'); }
  if (pn) { pn.classList.add('open'); pn.setAttribute('aria-hidden','false'); }
}
function closeMobileOverflow() {
  const ov = document.getElementById('mobileOverflowOverlay');
  const pn = document.getElementById('mobileOverflowPanel');
  if (ov) { ov.classList.remove('open'); ov.setAttribute('aria-hidden','true'); }
  if (pn) { pn.classList.remove('open'); pn.setAttribute('aria-hidden','true'); }
}
function __dcOverflow(args) {
  const key = args && args[0];
  closeMobileOverflow();
  if (key==='save') commitSave();
  else if (key==='sync') openSyncModal();
  else if (key==='status') showRuntimeStatus();
  else if (key==='data') openDataManager();
  else if (key==='theme') toggleThemePanel();
  else if (key==='mode') cycleUiMode();
  else if (key==='modeSwitch') { closeMobileOverflow(); openModeSwitcher(); }
  else if (key==='demo') seedDemoData();
}

/* 浏览器预览专用：重新载入示例数据，方便查看各列表的手机行样式 */
function seedDemoData() {
  if (isTauriApp()) return; // 生产 App 不启用
  initSampleData();
  renderPage();
  commitSave();
  showToast('已载入示例数据，可直接预览列表效果', 'success');
}

/* 按页面主操作的 FAB 映射（微信聊天列表「+」式一键新增） */
const MOBILE_FAB = {
  students: openStudentEditor,
  tasks: function(){ openTaskModal(); },
  plan: openNewPlanModal,
  schedule: function(){ if (typeof openScheduleSettings==='function') openScheduleSettings(); },
  progress: openProgressModal,
  'st-task-info': openTaskInfoEditModal,
  'st-homework': function(){ if (typeof openHwReviewModal==='function') openHwReviewModal(); },
  'xiuxian-archive': openStudentEditor,
  'xiuxian-tasks': function(){ if (typeof xiuxianOpenBreakthrough==='function') xiuxianOpenBreakthrough(); },
  'xiuxian-rank': function(){ if (typeof xiuxianOpenRank==='function') xiuxianOpenRank(); },
  'xiuxian-pool': function(){ if (typeof xiuxianOpenWeapon==='function') xiuxianOpenWeapon(); },
  'xiuxian': function(){ if (typeof xiuxianOpenMall==='function') xiuxianOpenMall(); },
  automation: function(){ if (typeof openReminderModal==='function') openReminderModal(); },
  'st-random': function(){ if (typeof doRandomPick==='function') doRandomPick(); }
};
function updateMobileFab() {
  let fab = document.getElementById('mobileFab');
  if (!fab) return;
  const act = MOBILE_FAB[state.currentPage];
  if (act && isMobileUI()) { fab.classList.remove('fab-hidden'); fab._fabFn = act; }
  else { fab.classList.add('fab-hidden'); fab._fabFn = null; }
}
function onMobileFab() {
  const fab = document.getElementById('mobileFab');
  if (fab && fab._fabFn) fab._fabFn();
}

function updateMobileTabBadges() {
  const badge = document.getElementById('mbnBadge-center');
  if (!badge) return;
  const pending = (state.tasks||[]).filter(function(t){ return !t.completed; }).length;
  if (pending > 0) {
    badge.textContent = pending > 99 ? '99+' : String(pending);
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

/* ===== 桌面侧栏收起/展开 ===== */
function toggleTopBarMore() {
  const tr = document.querySelector('.top-bar-right');
  if (!tr) return;
  tr.classList.toggle('expanded');
}
function toggleSidebarCollapse() {
  let sb = document.getElementById('sidebar');
  if (!sb) return;
  let collapsed = sb.classList.toggle('collapsed');
  try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch(e) {}
  updateSidebarCollapseBtn();
}
function updateSidebarCollapseBtn() {
  const btn = document.getElementById('sidebarCollapseBtn');
  if (!btn) return;
  btn.textContent = '☰';
}
function applySidebarCollapse() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const isMobile = document.documentElement.classList.contains('ui-mobile');
  const w = window.innerWidth;
  const autoCollapse = !isMobile && w < 1000;
  let collapsed = false;
  if (autoCollapse) {
    collapsed = true;
  } else {
    try { collapsed = localStorage.getItem('sidebarCollapsed') === '1'; } catch(e) {}
  }
  if (collapsed) sb.classList.add('collapsed'); else sb.classList.remove('collapsed');
  updateSidebarCollapseBtn();
}

/* Password Protection */
// ===== 密码哈希：SHA-256 (Web Crypto API) + 向后兼容旧版 djb2 =====
const PWD_SALT = 'pdx_wb_2025_salt';

// 异步 SHA-256 哈希（推荐，加密级别）
async function hashPasswordAsync(pwd) {
  const str = PWD_SALT + pwd + PWD_SALT;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 's' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 旧版 djb2 同步哈希（仅用于向后兼容验证旧密码）
function hashPasswordLegacy(pwd) {
  const str = PWD_SALT + pwd + PWD_SALT;
  let hash1 = 5381, hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ c;
    hash2 = ((hash2 * 33) ^ c) >>> 0;
  }
  return 'h' + (hash1 >>> 0).toString(36) + (hash2).toString(36);
}

// 同步兼容包装：优先使用异步 SHA-256，但在无法 await 的上下文用旧版降级
// 新密码一律用 SHA-256（异步），验证时自动检测哈希前缀做兼容
function hashPassword(pwd) {
  // 同步降级：仅在 crypto.subtle 不可用时使用
  // 注意：新密码在 setPassword/changePassword 中通过 hashPasswordAsync 设置（前缀 's'）
  // 旧密码仍为 'h' 前缀，验证时自动识别
  return hashPasswordLegacy(pwd);
}

// 密码验证（异步，支持新旧哈希）
async function verifyPasswordHash(pwd, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('s')) {
    // SHA-256 哈希
    const newHash = await hashPasswordAsync(pwd);
    return newHash === storedHash;
  } else {
    // 旧版 djb2 哈希（前缀 'h'），同步验证
    return hashPasswordLegacy(pwd) === storedHash;
  }
}

/* Teacher message encryption (XOR + Base64, prevents casual localStorage inspection) */
const CHAT_ENC_KEY = 'pdx_chat_2025_enc';
function encryptText(text) {
  if (!text) return text;
  try {
    const utf8 = unescape(encodeURIComponent(text));
    let result = '';
    for (let i = 0; i < utf8.length; i++) {
      result += String.fromCharCode(utf8.charCodeAt(i) ^ CHAT_ENC_KEY.charCodeAt(i % CHAT_ENC_KEY.length));
    }
    return 'enc:' + btoa(result);
  } catch(e) { return text; }
}
function decryptText(text) {
  if (!text || typeof text !== 'string' || !text.startsWith('enc:')) return text;
  try {
    const decoded = atob(text.slice(4));
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ CHAT_ENC_KEY.charCodeAt(i % CHAT_ENC_KEY.length));
    }
    return decodeURIComponent(escape(result));
  } catch(e) { return text; }
}

function openPasswordModal(pendingPage) {
  if (!state.appPassword) {
    // First time: set password + security question
    openModal(`
      <h3>🔒 设置访问密码</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">
        首次使用，请设置访问密码和密保问题。「学生工作任务」板块免密使用；其他板块需密码验证，15分钟无操作后加密模块自动锁定，保护学生隐私数据。
      </p>
      <div class="form-group">
        <label class="form-label">设置密码 *</label>
        <input type="password" class="form-input" id="pwdSet1" placeholder="输入密码（至少4位）..." data-ev="keypress" data-ev-key="ev4">
      </div>
      <div class="form-group">
        <label class="form-label">确认密码 *</label>
        <input type="password" class="form-input" id="pwdSet2" placeholder="再次输入密码..." data-ev="keypress" data-ev-key="ev5">
      </div>
      <div style="height:1px;background:let(--border-light);margin:16px 0"></div>
      <div class="form-group">
        <label class="form-label">密保问题 *</label>
        <select class="form-select" id="secQuestion">
          <option value="">请选择密保问题</option>
          <option value="出生城市">您的出生城市是？</option>
          <option value="第一只宠物">您的第一只宠物的名字是？</option>
          <option value="母亲生日">您母亲的生日是几月几号？</option>
          <option value="最喜欢的科目">您最喜欢的科目是？</option>
          <option value="初中班主任">您的初中班主任姓什么？</option>
          <option value="小学名称">您的小学叫什么名字？</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">密保答案 *</label>
        <input type="text" class="form-input" id="secAnswer" placeholder="输入密保答案..." data-ev="keypress" data-ev-key="ev6" data-ev-args="${escapeAttr(JSON.stringify([pendingPage]))}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="confirmSetPassword" data-click-args="[&quot;${pendingPage}&quot;]">确认设置</button>
      </div>
    `);
  } else {
    openModal(`
      <h3>🔒 密码验证</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">
        请输入密码以访问「${PAGE_TITLES[pendingPage] || pendingPage}」
      </p>
      <div class="form-group">
        <input type="password" class="form-input" id="pwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev7" data-ev-args="${escapeAttr(JSON.stringify([pendingPage]))}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyPassword" data-click-args="[&quot;${pendingPage}&quot;]">验证</button>
      </div>
      <div style="text-align:center;margin-top:12px">
        <a href="#" data-click="resetPassword" style="font-size:12px;color:let(--text-muted);text-decoration:underline">忘记密码？点击重置</a>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('pwdInput'); if (el) el.focus(); }, 100);
  }
}

async function confirmSetPassword(pendingPage) {
  const p1 = document.getElementById('pwdSet1').value;
  const p2 = document.getElementById('pwdSet2').value;
  const secQ = document.getElementById('secQuestion').value;
  const secA = document.getElementById('secAnswer').value.trim();
  if (!p1) { showToast('请输入密码', 'warn'); return; }
  if (p1 !== p2) { showToast('两次密码不一致', 'error'); return; }
  if (p1.length < 4) { showToast('密码至少4位', 'warn'); return; }
  if (!secQ) { showToast('请选择密保问题', 'warn'); return; }
  if (!secA) { showToast('请输入密保答案', 'warn'); return; }
  state.appPassword = await hashPasswordAsync(p1);
  state.securityQuestion = secQ;
  state.securityAnswer = await hashPasswordAsync(secA.toLowerCase());
  state.passwordUnlocked = true;
  saveState();
  closeModal();
  showToast('密码和密保设置成功，已解锁');
  renderPwdStatusBar();
  navigateTo(pendingPage);
}

async function verifyPassword(pendingPage) {
  const pwd = document.getElementById('pwdInput').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    saveState();
    closeModal();
    renderPwdStatusBar();
    navigateTo(pendingPage);
  } else {
    showToast('密码错误', 'error');
  }
}

function resetPassword() {
  if (!state.securityQuestion) {
    // 没有密保问题（旧数据兼容），允许直接重置
    openModal(`
      <h3>⚠️ 重置密码</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">
        当前账号未设置密保问题，可直接重置密码。重置后请重新设置密码和密保。
      </p>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" style="background:let(--danger)" data-click="confirmResetPassword">确认重置</button>
      </div>
    `);
    return;
  }
  openModal(`
    <h3>🔑 密保验证</h3>
    <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">
      请回答密保问题以重置密码
    </p>
    <div style="padding:12px;background:let(--primary-lightest);border-radius:let(--radius-sm);margin-bottom:16px">
      <div style="font-size:12px;color:let(--text-muted);margin-bottom:4px">密保问题：</div>
      <div style="font-size:15px;font-weight:600">${escapeHtml(state.securityQuestion)}</div>
    </div>
    <div class="form-group">
      <label class="form-label">密保答案</label>
      <input type="text" class="form-input" id="resetSecAnswer" placeholder="输入密保答案..." data-ev="keypress" data-ev-key="ev8">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="verifySecurityAnswer">验证</button>
    </div>
  `);
  setTimeout(() => { const el = document.getElementById('resetSecAnswer'); if (el) el.focus(); }, 100);
}

async function verifySecurityAnswer() {
  const answer = document.getElementById('resetSecAnswer').value.trim().toLowerCase();
  if (await verifyPasswordHash(answer, state.securityAnswer)) {
    confirmResetPassword();
  } else {
    showToast('密保答案错误', 'error');
  }
}

function confirmResetPassword() {
  state.appPassword = '';
  state.passwordUnlocked = false;
  state.securityQuestion = '';
  state.securityAnswer = '';
  saveState();
  closeModal();
  renderPwdStatusBar();
  showToast('密码已重置，请重新设置密码和密保');
  setTimeout(() => openPasswordModal(state.currentPage || 'tasks'), 500);
}

function lockApp() {
  state.passwordUnlocked = false;
  saveState();
  showToast('已锁定加密模块');
  renderPwdStatusBar();
  // 锁定后回到免密的学生工作任务页，保证学生任务模块始终可用
  if (!PASSWORD_EXEMPT_PAGES.includes(state.currentPage)) {
    navigateTo('st-task-info');
  }
}

/* Auto Lock System: 15分钟无操作后仅锁定加密模块，学生工作任务免密 */
let autoLockTimer = null;
let autoLockWarningTimer = null;

function resetAutoLockTimer() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (autoLockWarningTimer) clearTimeout(autoLockWarningTimer);
  if (!state.appPassword || !state.passwordUnlocked) return;
  // Warning 3 minutes before lock (when >= 5 min; here 15-3=12 min)
  autoLockWarningTimer = setTimeout(() => {
    showToast('3分钟后将自动锁定加密模块，请及时保存', 'warn');
  }, (AUTO_LOCK_MINUTES - 3) * 60 * 1000);
  // Auto lock: only lock encrypted modules, st-task pages stay usable
  autoLockTimer = setTimeout(() => {
    state.passwordUnlocked = false;
    saveState();
    showToast('加密模块已自动锁定', 'warn');
    renderPwdStatusBar();
    if (!PASSWORD_EXEMPT_PAGES.includes(state.currentPage)) {
      navigateTo('st-task-info');
    }
  }, AUTO_LOCK_MINUTES * 60 * 1000);
}

function showLockOverlay() {
  // Kept for backward compatibility / manual lock overlay use.
  state.passwordUnlocked = false;
  saveState();
  const overlay = document.createElement('div');
  overlay.className = 'lock-overlay';
  overlay.id = 'lockOverlay';
  overlay.innerHTML = `
    <div class="lock-icon">🔒</div>
    <div class="lock-title">加密模块已锁定</div>
    <div class="lock-desc">超过 ${AUTO_LOCK_MINUTES} 分钟未操作，加密模块已自动锁定。请输入密码重新访问。</div>
    <input type="password" class="lock-input" id="lockPwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev9">
    <button class="lock-btn" data-click="unlockFromOverlay">🔓 解锁</button>
    <div class="lock-timer" id="lockTimer"></div>
    <div style="margin-top:12px;font-size:12px;color:let(--text-muted)">「学生工作任务」模块无需密码，可继续操作</div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => { const el = document.getElementById('lockPwdInput'); if (el) el.focus(); }, 100);
  renderPwdStatusBar();
}

async function unlockFromOverlay() {
  const pwd = document.getElementById('lockPwdInput')?.value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    saveState();
    const overlay = document.getElementById('lockOverlay');
    if (overlay) overlay.remove();
    resetAutoLockTimer();
    renderPwdStatusBar();
    showToast('已解锁');
  } else {
    showToast('密码错误', 'error');
  }
}

function renderPwdStatusBar() {
  const el = document.getElementById('pwdStatusBar');
  if (!el) return;
  if (!state.appPassword) {
    el.innerHTML = '<button class="btn-icon" title="设置访问密码（启用15分钟自动锁定加密模块）" data-click="openPasswordModal" data-click-args="' + escapeAttr(JSON.stringify([state.currentPage||'tasks'])) + '" style="color:let(--warning);font-weight:600">🔒 设置密码</button>';
    return;
  }
  if (state.passwordUnlocked) {
    el.innerHTML = `
      <button class="btn-icon" title="修改密码" data-click="changeAppPassword">🔑</button>
      <button class="btn-icon" title="锁定" data-click="lockApp">🔒</button>
    `;
  } else {
    el.innerHTML = `<span style="font-size:12px;color:let(--text-muted);font-weight:500">🔒 已锁定</span>`;
  }
}

function changeAppPassword() {
  if (!state.appPassword) { openPasswordModal('tasks'); return; }
  if (!state.passwordUnlocked) {
    // Need to verify password first
    openModal(`
      <h3>🔒 密码验证</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">请输入当前密码以修改密码</p>
      <div class="form-group">
        <input type="password" class="form-input" id="changePwdVerify" placeholder="输入当前密码..." data-ev="keypress" data-ev-key="ev10">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyBeforeChange">验证</button>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('changePwdVerify'); if (el) el.focus(); }, 100);
    return;
  }
  openChangePasswordModal();
}

async function verifyBeforeChange() {
  const pwd = document.getElementById('changePwdVerify').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    closeModal();
    openChangePasswordModal();
  } else {
    showToast('密码错误', 'error');
  }
}

function openChangePasswordModal() {
  openModal(`
    <h3>🔑 修改密码</h3>
    <div class="form-group">
      <label class="form-label">新密码</label>
      <input type="password" class="form-input" id="newPwd1" placeholder="输入新密码">
    </div>
    <div class="form-group">
      <label class="form-label">确认新密码</label>
      <input type="password" class="form-input" id="newPwd2" placeholder="再次输入新密码">
    </div>
    <div style="height:1px;background:let(--border-light);margin:12px 0"></div>
    <div class="form-group">
      <label class="form-label">密保问题（留空则不修改）</label>
      <select class="form-select" id="changeSecQuestion">
        <option value="">不修改密保（当前：${escapeHtml(state.securityQuestion || '未设置')}）</option>
        <option value="出生城市">您的出生城市是？</option>
        <option value="第一只宠物">您的第一只宠物的名字是？</option>
        <option value="母亲生日">您母亲的生日是几月几号？</option>
        <option value="最喜欢的科目">您最喜欢的科目是？</option>
        <option value="初中班主任">您的初中班主任姓什么？</option>
        <option value="小学名称">您的小学叫什么名字？</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">密保答案（留空则不修改）</label>
      <input type="text" class="form-input" id="changeSecAnswer" placeholder="输入新密保答案...">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveNewPassword">确认修改</button>
    </div>
  `);
}

async function saveNewPassword() {
  const n1 = document.getElementById('newPwd1').value;
  const n2 = document.getElementById('newPwd2').value;
  if (n1.length < 4) { showToast('新密码至少4位', 'warn'); return; }
  if (n1 !== n2) { showToast('两次密码不一致', 'error'); return; }
  state.appPassword = await hashPasswordAsync(n1);
  // Update security question if provided
  const newQ = document.getElementById('changeSecQuestion').value;
  const newA = document.getElementById('changeSecAnswer').value.trim();
  if (newQ && newA) {
    state.securityQuestion = newQ;
    state.securityAnswer = await hashPasswordAsync(newA.toLowerCase());
  }
  saveState();
  closeModal();
  showToast('密码已修改');
  renderPwdStatusBar();
}

const NAV_CHILD_ID_MAP = {'student-tasks':'nav-student-tasks','analysis':'nav-analysis','xiuxian':'nav-xiuxian'};
function expandNavParent(parentPage, expanded) {
  const parent = document.querySelector('.nav-item[data-page="' + parentPage + '"]');
  if (!parent) return;
  const children = document.getElementById(NAV_CHILD_ID_MAP[parentPage]);
  parent.classList.toggle('expanded', expanded);
  if (children) children.classList.toggle('show', expanded);
}

function toggleNavParent(parentPage) {
  const parent = document.querySelector('.nav-item[data-page="' + parentPage + '"]');
  if (!parent) return;
  const children = document.getElementById(NAV_CHILD_ID_MAP[parentPage]);
  if (!children) return;
  const willExpand = !children.classList.contains('show');
  expandNavParent(parentPage, willExpand);
}

// 渲染节流：合并短时间内的多次渲染请求，避免连续DOM重建
let _renderRAF = null;
function renderPage() {
  if (_renderRAF) cancelAnimationFrame(_renderRAF);
  _renderRAF = requestAnimationFrame(() => {
    _renderRAF = null;
    _doRenderPage();
  });
}

function _doRenderPage() {
  clearLayerCache(); // 每个渲染周期重置分层缓存
  const area = document.getElementById('contentArea');
  if (!state.xiuxian) state.xiuxian = {students:{},meta:{}};
  console.log('[_doRenderPage] currentPage=', state.currentPage, 'xiuxian.view=', (state.xiuxian||{}).view, 'xiuxian keys=', Object.keys(state.xiuxian||{}));
  switch(state.currentPage) {
    case 'tasks': renderTasks(area); break;
    case 'plan': renderPlan(area); break;
    case 'schedule': renderSchedule(area); break;
    case 'progress': renderProgress(area); break;
    case 'students': renderStudents(area); break;
    case 'st-task-info':
    case 'st-random':
    case 'st-homework':
    case 'st-chat': renderStudentTasks(area); break;
    case 'hw-analysis':
    case 'score-analysis':
    case 'dashboard': renderAnalysis(area); break;
    case 'automation': renderAutomation(area); break;
    case 'skill-links': renderSkillLinks(area); break;
    case 'ima-link': renderImaLink(area); break;
    case 'daily-quiz': renderDailyQuiz(area); break;
    case 'folder': renderFolder(area); break;
    case 'xiuxian':
    case 'xiuxian-archive':
    case 'xiuxian-tasks':
    case 'xiuxian-rank':
    case 'xiuxian-pool': console.log('[_doRenderPage] → renderXiuxian for', state.currentPage); renderXiuxian(area); break;
    default: console.warn('[_doRenderPage] ❌ UNKNOWN page:', state.currentPage, '— showing 页面建设中'); area.innerHTML = '<div class="empty-state"><span class="emoji">🚧</span>页面建设中</div>';
  }
  updateMobileFab();
  updateMobileTabBadges();
}

/* ===================== 01 Task List ===================== */
function renderTasks(container) {
  // 单次遍历统计，替代4次filter
  let active = 0, completed = 0, important = 0, urgent = 0;
  state.tasks.forEach(t => {
    if (t.completed) { completed++; }
    else {
      active++;
      if (t.important) important++;
      if (t.urgent) urgent++;
    }
  });

  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">📋</span><div class="stat-num">${state.tasks.length}</div><div class="stat-label">总任务</div></div>
      <div class="stat-card"><span class="stat-icon">⏳</span><div class="stat-num">${active}</div><div class="stat-label">进行中</div></div>
      <div class="stat-card"><span class="stat-icon">🔴</span><div class="stat-num">${important}</div><div class="stat-label">重要</div></div>
      <div class="stat-card"><span class="stat-icon">🟠</span><div class="stat-num">${urgent}</div><div class="stat-label">紧急</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-num">${completed}</div><div class="stat-label">已完成</div></div>
    </div>
    <div class="toolbar">
      <div class="view-tabs">
        <div class="view-tab ${state.currentTaskView==='list'?'active':''}" data-click="switchTaskView" data-click-args="[&quot;list&quot;]">📋 列表视图</div>
        <div class="view-tab ${state.currentTaskView==='quadrant'?'active':''}" data-click="switchTaskView" data-click-args="[&quot;quadrant&quot;]">🔲 四象限视图</div>
        <div class="view-tab ${state.currentTaskView==='week'?'active':''}" data-click="switchTaskView" data-click-args="[&quot;week&quot;]">📅 周视图</div>
        <div class="view-tab ${state.currentTaskView==='month'?'active':''}" data-click="switchTaskView" data-click-args="[&quot;month&quot;]">🗓️ 月视图</div>
      </div>
      <button class="btn btn-primary" data-click="openTaskModal">+ 新建任务</button>
    </div>
    <div id="taskViewContainer"></div>
  `;

  const vc = document.getElementById('taskViewContainer');
  if (state.currentTaskView==='list') renderTaskList(vc);
  else if (state.currentTaskView==='quadrant') renderTaskQuadrant(vc);
  else if (state.currentTaskView==='week') renderTaskWeek(vc);
  else if (state.currentTaskView==='month') renderTaskMonth(vc);
}

function switchTaskView(view) {
  state.currentTaskView = view;
  saveState();
  document.querySelectorAll('.view-tab').forEach((t,i) => {
    const views=['list','quadrant','week','month'];
    t.classList.toggle('active', views[i]===view);
  });
  const vc = document.getElementById('taskViewContainer');
  if (view==='list') renderTaskList(vc);
  else if (view==='quadrant') renderTaskQuadrant(vc);
  else if (view==='week') renderTaskWeek(vc);
  else if (view==='month') renderTaskMonth(vc);
}

/* ---- 01-1 List View ---- */
function renderTaskList(container) {
  const tasks = state.tasks.sort((a,b)=> (a.completed-b.completed) || (new Date(a.time)-new Date(b.time)));
  if (tasks.length===0) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>暂无任务，点击「新建任务」开始</div>';
    return;
  }
  const IS_M = isMobileUI();
  if (IS_M) {
    const mrows = tasks.map(t => {
      const cls = t.completed ? 'completed' : '';
      return '<div class="m-row ' + cls + '" data-ev="contextmenu" data-ev-key="evRowMenu" data-ev-args="' + escapeAttr(JSON.stringify(['task', t.id])) + '">'
        + '<input type="checkbox" class="checkbox-box" ' + (t.completed?'checked':'') + ' data-ev="change" data-ev-key="ev11" data-ev-args="' + escapeAttr(JSON.stringify([t.id])) + '">'
        + '<div class="m-body" data-click="openTaskModal" data-click-args="[&quot;' + t.id + '&quot;]">'
          + '<div class="m-title">' + escapeHtml(t.name) + (t.important?' <span class="tag tag-important">重要</span>':'') + (t.urgent?' <span class="tag tag-urgent">紧急</span>':'') + '</div>'
          + '<div class="m-sub">' + fmtDateTime(t.time) + (t.resp?' · '+escapeHtml(t.resp):'') + '</div>'
        + '</div>'
        + '<input type="checkbox" class="task-del-cb" data-tid="' + t.id + '" style="margin-left:8px">'
        + '<span class="m-trail">›</span>'
      + '</div>';
    }).join('');
    container.innerHTML = `
      <div class="flex-between gap-8" style="margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;user-select:none">
          <input type="checkbox" id="taskSelectAll"> 全选
        </label>
        <button class="btn btn-danger" id="taskBatchDeleteBtn" data-click="batchDeleteTasks" disabled style="font-size:12px;padding:4px 12px">🗑️ 批量删除 (<span id="taskSelCount">0</span>)</button>
      </div>
      <div class="m-list">${mrows}</div>`;
    return;
  }
  let rows = tasks.map(t => `
    <tr class="${t.completed?'completed':''}">
      <td style="width:30px">
        <input type="checkbox" class="checkbox-box" ${t.completed?'checked':''} data-ev="change" data-ev-key="ev11" data-ev-args="${escapeAttr(JSON.stringify([t.id]))}">
      </td>
      <td><div class="task-name">${escapeHtml(t.name)}</div><div class="task-desc">${escapeHtml(t.desc||'')}</div></td>
      <td style="white-space:nowrap">${fmtDateTime(t.time)}</td>
      <td><span class="qc-resp">${escapeHtml(t.resp||'')}</span></td>
      <td>${t.important?'<span class="tag tag-important">重要</span>':'<span class="tag tag-normal">一般</span>'}</td>
      <td>${t.urgent?'<span class="tag tag-urgent">紧急</span>':'<span class="tag tag-normal">常规</span>'}</td>
      <td style="white-space:nowrap">
        <input type="checkbox" class="task-del-cb" data-tid="${t.id}" style="margin-right:6px;vertical-align:middle" title="批量删除选择">
        <button class="btn-icon" title="编辑" data-click="openTaskModal" data-click-args="[&quot;${t.id}&quot;]">✏️</button>
        <button class="btn-icon" title="删除" data-click="deleteTask" data-click-args="[&quot;${t.id}&quot;]">🗑️</button>
      </td>
    </tr>`).join('');
  container.innerHTML = `
    <div class="flex-between gap-8" style="margin-bottom:8px">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;user-select:none">
        <input type="checkbox" id="taskSelectAll"> 全选
      </label>
      <button class="btn btn-danger" id="taskBatchDeleteBtn" data-click="batchDeleteTasks" disabled style="font-size:12px;padding:4px 12px">🗑️ 批量删除 (<span id="taskSelCount">0</span>)</button>
    </div>
    <table class="task-table">
      <thead><tr>
        <th></th><th>任务名称 / 描述</th><th>时间</th><th>负责人</th><th>重要</th><th>紧急</th><th>操作</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ---- 01-2 Quadrant View ---- */
function renderTaskQuadrant(container) {
  const quadrants = [
    { important:true, urgent:true, title:'重要且紧急', subtitle:'立即做', icon:'🔴' },
    { important:true, urgent:false, title:'重要不紧急', subtitle:'计划做', icon:'🟢' },
    { important:false, urgent:true, title:'不重要但紧急', subtitle:'委托/快速做', icon:'🟡' },
    { important:false, urgent:false, title:'不重要不紧急', subtitle:'可延后', icon:'⚪' }
  ];
  let html = '<div class="quadrant-grid">';
  quadrants.forEach(q => {
    const active = state.tasks.filter(t => t.important===q.important && t.urgent===q.urgent && !t.completed).sort((a,b)=>new Date(a.time)-new Date(b.time));
    const done = state.tasks.filter(t => t.important===q.important && t.urgent===q.urgent && t.completed);
    html += `<div class="quadrant-zone" data-important="${q.important}" data-urgent="${q.urgent}"
      data-ev="dragover|dragleave|drop" data-ev-key="ev12|ev13|ev14">
      <div class="quadrant-header">
        <div><div class="quadrant-title">${q.icon} ${q.title}</div><div class="quadrant-subtitle">${q.subtitle}</div></div>
        <div class="quadrant-count">${active.length}</div>
      </div>
      <div class="quadrant-cards">
        ${active.map(t => quadrantCardHtml(t)).join('')}
        ${done.length>0 ? `
          <div class="quadrant-completed-section">
            <div class="quadrant-completed-header">✅ 已完成 (${done.length})</div>
            ${done.map(t => quadrantCardHtml(t)).join('')}
          </div>` : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function quadrantCardHtml(t) {
  const border = t.important&&t.urgent ? '#EF5350' : t.important ? '#66BB6A' : t.urgent ? '#FFA726' : '#BDBDBD';
  return `<div class="quadrant-card ${t.completed?'completed':''}" draggable="true" data-task-id="${t.id}"
    data-ev="dragstart|dragend" data-ev-key="ev15|ev16"
    data-ev-args="${escapeAttr(JSON.stringify([t.id]))}"
    data-click="openTaskModal" data-click-args="[&quot;${t.id}&quot;]">
    <div class="qc-name">${escapeHtml(t.name)}</div>
    <div class="qc-meta">
      <span class="qc-time">⏰ ${fmtDateTime(t.time)}</span>
      <span class="qc-resp">${escapeHtml(t.resp||'')}</span>
      ${t.completed?'<span style="color:#66BB6A">✓ 已完成</span>':''}
    </div>
  </div>`;
}

function onQuadrantDrop(e, zone) {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const taskId = e.dataTransfer.getData('text/plain');
  const task = state.tasks.find(t=>t.id===taskId);
  if (!task) return;
  const important = zone.dataset.important==='true';
  const urgent = zone.dataset.urgent==='true';
  if (task.important!==important || task.urgent!==urgent) {
    task.important = important;
    task.urgent = urgent;
    saveState();
    showToast('已更新任务标签');
  }
  renderTaskQuadrant(document.getElementById('taskViewContainer'));
}

/* ---- 01-3 Week View ---- */
function renderTaskWeek(container) {
  const weekStart = getWeekStart(new Date());
  const days = [];
  for (let i=0; i<7; i++) {
    const d = new Date(weekStart); d.setDate(d.getDate()+i);
    days.push(d);
  }
  const today = new Date(); today.setHours(0,0,0,0);
  let html = '<div class="week-grid">';
  const dayNames = ['周一','周二','周三','周四','周五','周六','周日'];
  days.forEach((d,i) => {
    const dayTasks = state.tasks.filter(t => {
      const td = new Date(t.time);
      return td.toDateString() === d.toDateString();
    }).sort((a,b)=>new Date(a.time)-new Date(b.time));
    const isToday = d.toDateString()===today.toDateString();
    html += `<div class="week-day ${isToday?'week-today':''}">
      <div class="week-day-header"><span>${dayNames[i]}</span><span class="text-muted text-sm">${d.getMonth()+1}/${d.getDate()}</span></div>
      <div class="week-day-tasks">
        ${dayTasks.length===0 ? '<div class="text-muted text-sm" style="padding:4px 0">无任务</div>' :
          dayTasks.map(t => `<div class="week-task" data-click="openTaskModal" data-click-args="[&quot;${t.id}&quot;]">
            <div class="week-task-time">${fmtTime(t.time)}</div>
            <div class="week-task-name">${escapeHtml(t.name)}</div>
            <div class="text-sm">${escapeHtml(t.resp||'')}</div>
          </div>`).join('')}
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

/* ---- 01-4 Month View ---- */
function renderTaskMonth(container) {
  const m = state.currentMonth;
  const year = m.getFullYear(), month = m.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay()||7) - 1; // Monday-based
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  let html = `
    <div class="month-nav">
      <button class="btn btn-outline btn-sm" data-click="changeMonth" data-click-args="[-1]">◀ 上月</button>
      <h3>${year}年${month+1}月</h3>
      <button class="btn btn-outline btn-sm" data-click="changeMonth" data-click-args="[1]">下月 ▶</button>
      <button class="btn btn-outline btn-sm" data-click="goToday">今天</button>
    </div>
    <div class="month-grid">
      ${['一','二','三','四','五','六','日'].map(d=>`<div class="month-grid-header">周${d}</div>`).join('')}
  `;

  for (let i=0; i<startDay; i++) html += '<div class="month-day empty"></div>';
  for (let d=1; d<=daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = date.toDateString()===today.toDateString();
    const dayTasks = state.tasks.filter(t => new Date(t.time).toDateString()===date.toDateString());
    html += `<div class="month-day ${isToday?'today':''}" data-click="openDayTasks" data-click-args="${escapeAttr(JSON.stringify([month+1, d]))}">
      <div class="month-day-num">${d}</div>
      ${dayTasks.slice(0,3).map(t=>`<div class="month-task-dot" title="${escapeHtml(t.name)}">${t.completed?'✓':''}${escapeHtml(t.name).slice(0,8)}</div>`).join('')}
      ${dayTasks.length>3?`<div class="month-task-dot text-muted">+${dayTasks.length-3}更多</div>`:''}
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function changeMonth(delta) {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth()+delta, 1);
  saveState();
  renderTaskMonth(document.getElementById('taskViewContainer'));
}
function goToday() {
  state.currentMonth = new Date();
  saveState();
  renderTaskMonth(document.getElementById('taskViewContainer'));
}
function openDayTasks(month, day) {
  const year = state.currentMonth.getFullYear();
  const date = new Date(year, month-1, day);
  const dayTasks = state.tasks.filter(t => new Date(t.time).toDateString()===date.toDateString());
  if (dayTasks.length===0) { showToast('当日无任务'); return; }
  openModal(`
    <h3>${month}月${day}日 任务 (${dayTasks.length})</h3>
    <div>${dayTasks.map(t=>`<div class="quadrant-card" style="margin-bottom:8px;cursor:pointer" data-click="__dcOpenTaskFromClose" data-click-args="${escapeAttr(JSON.stringify([t.id]))}">
      <div class="qc-name">${escapeHtml(t.name)}</div>
      <div class="qc-meta"><span class="qc-time">⏰ ${fmtTime(t.time)}</span><span class="qc-resp">${escapeHtml(t.resp||'')}</span>${t.completed?'<span style="color:#66BB6A">✓</span>':''}</div>
    </div>`).join('')}</div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

/* ---- Task Modal ---- */
function openTaskModal(id) {
  const t = id ? state.tasks.find(x=>x.id===id) : {};
  const isEdit = !!id;
  openModal(`
    <h3>${isEdit?'编辑任务':'新建任务'}</h3>
    <div class="form-group">
      <label class="form-label">任务名称 *</label>
      <input class="form-input" id="taskName" value="${escapeHtml(t.name||'')}" placeholder="请输入任务名称">
    </div>
    <div class="form-group">
      <label class="form-label">描述</label>
      <textarea class="form-textarea" id="taskDesc" placeholder="任务描述（可选）">${escapeHtml(t.desc||'')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">时间</label>
        <input type="datetime-local" class="form-input" id="taskTime" value="${(t.time||'').slice(0,16)}">
      </div>
      <div class="form-group">
        <label class="form-label">负责人</label>
        <select class="form-select" id="taskResp">
          <option value="派大星" ${t.resp==='派大星'?'selected':''}>派大星</option>
          <option value="海绵宝宝" ${t.resp==='海绵宝宝'?'selected':''}>海绵宝宝</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">标签</label>
      <div class="checkbox-group">
        <label class="checkbox-label"><input type="checkbox" class="checkbox-box" id="taskImportant" ${t.important?'checked':''}> 🔴 重要</label>
        <label class="checkbox-label"><input type="checkbox" class="checkbox-box" id="taskUrgent" ${t.urgent?'checked':''}> 🟠 紧急</label>
        <label class="checkbox-label"><input type="checkbox" class="checkbox-box" id="taskCompleted" ${t.completed?'checked':''}> ✅ 已完成</label>
      </div>
    </div>
    <div class="modal-actions">
      ${isEdit?`<button class="btn btn-danger btn-sm" data-click="__dcDeleteTaskClose" data-click-args="${escapeAttr(JSON.stringify([id]))}">删除</button>`:''}
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveTask" data-click-args="${escapeAttr(JSON.stringify([isEdit ? id : 'null']))}">${isEdit?'保存':'创建'}</button>
    </div>
  `);
}

function saveTask(id) {
  const name = document.getElementById('taskName').value.trim();
  if (!name) { showToast('请输入任务名称','error'); return; }
  const data = {
    name,
    desc: document.getElementById('taskDesc').value.trim(),
    time: document.getElementById('taskTime').value || new Date().toISOString().slice(0,16),
    resp: document.getElementById('taskResp').value,
    important: document.getElementById('taskImportant').checked,
    urgent: document.getElementById('taskUrgent').checked,
    completed: document.getElementById('taskCompleted').checked
  };
  saveState({pushUndo:true});
  if (id && id !== 'null') {
    const t = state.tasks.find(x=>x.id===id);
    Object.assign(t, data);
    showToast('任务已更新');
  } else {
    state.tasks.push({ id: uid(), ...data });
    showToast('任务已创建');
  }
  saveState();
  closeModal();
  renderTasks(document.getElementById('contentArea'));
}

async function deleteTask(id) {
  saveState({pushUndo:true});
  if (!(await appConfirm('确认删除此任务？', {danger:true}))) return;
  state.tasks = state.tasks.filter(t=>t.id!==id);
  saveState();
  showToast('任务已删除');
  renderTasks(document.getElementById('contentArea'));
}

// 任务清单：批量删除
async function batchDeleteTasks() {
  const cbs = Array.prototype.slice.call(document.querySelectorAll('.task-del-cb:checked'));
  if (cbs.length === 0) { showToast('请先勾选要删除的任务', 'warn'); return; }
  const ids = cbs.map(function(cb){ return cb.getAttribute('data-tid'); });
  saveState({pushUndo:true});
  if (!(await appConfirm(`确定批量删除 ${ids.length} 个任务吗？此操作不可恢复。`))) return;
  state.tasks = state.tasks.filter(function(t){ return ids.indexOf(t.id) < 0; });
  saveState();
  showToast(`已删除 ${ids.length} 个任务`);
  renderTasks(document.getElementById('contentArea'));
}
function updateTaskSelCount() {
  const cbs = document.querySelectorAll('.task-del-cb:checked');
  const cnt = document.getElementById('taskSelCount');
  const btn = document.getElementById('taskBatchDeleteBtn');
  if (cnt) cnt.textContent = cbs.length;
  if (btn) btn.disabled = cbs.length === 0;
}

function toggleTaskComplete(id) {
  const t = state.tasks.find(x=>x.id===id);
  if (t) { t.completed = !t.completed; saveState(); renderTasks(document.getElementById('contentArea')); }
}

/* ===================== 02 Teaching Plan ===================== */
function renderPlan(container) {
  container.innerHTML = `
    <div class="section-title">📝 教学计划管理</div>
    <div class="plan-section">
      <div class="plan-card">
        <h3>📥 模板下载</h3>
        <p class="text-muted text-sm mb-16">下载标准教学计划模板，填写后上传即可自动解析</p>
        <div style="background:let(--primary-lightest);border-radius:let(--radius-sm);padding:14px;margin-bottom:12px">
          <div style="font-weight:600;color:let(--text-heading);margin-bottom:6px">模板字段说明</div>
          <div class="text-sm text-muted" style="line-height:1.8">
            序号 · 计划名称 · 计划内容 · 截止时间 · 负责人
          </div>
        </div>
        <button class="btn btn-primary" data-click="downloadTemplate">⬇️ 下载CSV模板</button>
        <button class="btn btn-outline" data-click="downloadSampleTemplate">⬇️ 下载示例模板</button>
      </div>
      <div class="plan-card">
        <h3>📤 上传计划</h3>
        <div class="upload-area" id="uploadArea" data-click="__dcClickEl" data-click-args="[&quot;planFileInput&quot;]"
          data-ev="dragover|dragleave|drop" data-ev-key="ev17|ev18|ev19">
          <span class="emoji">📎</span>
          <p>点击或拖拽CSV文件到此处上传<br>支持 .csv 格式</p>
          <input type="file" id="planFileInput" accept=".csv,.txt" data-ev="change" data-ev-key="ev20">
        </div>
      </div>
    </div>
    <div class="section-title" style="margin-top:24px;display:flex;align-items:center;justify-content:space-between">
      <span>📋 计划列表 (${state.plans.length})</span>
      <button class="btn btn-primary btn-sm" data-click="openNewPlanModal">➕ 新建计划</button>
    </div>
    <div id="planList"></div>
  `;
  renderPlanList();
}

function renderPlanList() {
  const el = document.getElementById('planList');
  if (!el) return;
  if (state.plans.length===0) {
    el.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>暂无计划，点击「新建计划」或上传模板文件</div>';
    return;
  }
  el.innerHTML = state.plans.map((p, idx) => {
    const seq = p.seq || (idx+1);
    const today = new Date().toISOString().slice(0,10);
    const isOverdue = p.endDate && p.endDate < today;
    const deadlineClass = isOverdue ? 'plan-tag overdue' : 'plan-tag deadline';
    const deadlineText = p.endDate ? (isOverdue ? '⚠️ 已过期 ' : '') + p.endDate : '未设置';
    return `
    <div class="plan-item">
      <div class="plan-seq-badge">${seq}</div>
      <div class="plan-item-info">
        <div class="plan-item-name">${escapeHtml(p.name||'未命名计划')}</div>
        ${p.content ? `<div class="plan-item-content">${escapeHtml(p.content)}</div>` : ''}
        <div class="plan-item-tags">
          <span class="plan-tag resp">👤 ${escapeHtml(p.resp||'-')}</span>
          <span class="${deadlineClass}">📅 ${deadlineText}</span>
        </div>
      </div>
      <div class="plan-item-actions">
        <button class="btn btn-outline btn-sm" data-click="viewPlan" data-click-args="[&quot;${p.id}&quot;]" title="查看详情">👁️</button>
        <button class="btn btn-outline btn-sm" data-click="openEditPlanModal" data-click-args="[&quot;${p.id}&quot;]" title="编辑">✏️</button>
        <button class="btn-icon" data-click="deletePlan" data-click-args="[&quot;${p.id}&quot;]" title="删除">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function downloadTemplate() {
  const csv = '\ufeff序号,计划名称,计划内容,截止时间,负责人\n1,八年级上册第一章教学计划,动物的主要类群,2026-09-15,派大星\n2,,,,\n3,,,,\n';
  downloadFile(csv, '教学计划模板.csv', 'text/csv');
}

function downloadSampleTemplate() {
  const csv = '\ufeff序号,计划名称,计划内容,截止时间,负责人\n1,第一章：动物的主要类群,腔肠动物、扁形动物、线形动物、环节动物等分类教学,2026-09-15,派大星\n2,第二章：动物的运动和行为,先天性行为与学习行为、社会行为特征,2026-09-30,派大星\n3,第三章：动物在生物圈中的作用,促进物质循环、维持生态平衡,2026-10-20,海绵宝宝\n4,期中复习与考试,全册前半学期复习及统考,2026-10-31,派大星\n5,第四章：细菌和真菌,细菌真菌分布、培养实验,2026-11-20,海绵宝宝\n6,第五章：病毒,病毒的种类、结构与繁殖,2026-11-30,派大星\n7,期末复习,全册复习与期末考试,2027-01-10,派大星\n';
  downloadFile(csv, '教学计划示例模板.csv', 'text/csv');
}

function _downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type: (type||'text/plain')+';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 100);
}

function downloadFile(content, filename, type) {
  if (isTauriApp()) {
    const ext = type && type.indexOf('json') >= 0 ? 'json' : type && type.indexOf('csv') >= 0 ? 'csv' : 'txt';
    const filterName = ext === 'csv' ? 'CSV' : ext === 'json' ? 'JSON' : '文本';
    __invoke('plugin:dialog|save', {
      options: {
        defaultPath: filename,
        title: '保存文件',
        filters: [{ name: filterName + ' 文件', extensions: [ext] }]
      }
    }).then(function(filePath) {
      if (!filePath) return;
      return __invoke('write_file', { path: filePath, content: content }).then(function() {
        showToast('文件已保存：' + filePath, 'success');
      });
    }).catch(function(e) {
      console.error('保存失败:', e);
      _downloadBlob(content, filename, type);
      showToast('保存失败，已使用浏览器下载', 'warn');
    });
  } else {
    _downloadBlob(content, filename, type);
    showToast('文件已下载：' + filename, 'success');
  }
}

function handlePlanDrop(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processPlanFile(file);
}

function handlePlanUpload(input) {
  if (input.files[0]) processPlanFile(input.files[0]);
}

function processPlanFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\ufeff/, '');
    const lines = text.split('\n').filter(l=>l.trim());
    if (lines.length < 2) { showToast('文件内容为空或格式不对','error'); return; }
    const headers = lines[0].split(',').map(h=>h.trim());
    const items = [];
    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split(',').map(c=>c.trim());
      if (cols[1]) items.push({ seq: cols[0], name: cols[1], content: cols[2]||'', endDate: cols[3]||'', resp: cols[4]||'' });
    }
    const nextSeq = state.plans.length > 0 ? Math.max(...state.plans.map(p => p.seq || 0)) + 1 : 1;
    items.forEach((it, i) => {
      state.plans.push({
        id: uid(),
        seq: nextSeq + i,
        name: it.name,
        content: it.content,
        endDate: it.endDate,
        resp: it.resp || '派大星',
        startDate: '',
        items: 0,
        uploadedAt: new Date().toISOString().slice(0,10)
      });
    });
    saveState();
    showToast(`已导入 ${items.length} 条教学计划`);
    renderPlanList();
  };
  reader.readAsText(file, 'UTF-8');
}

function viewPlan(id) {
  const p = state.plans.find(x=>x.id===id);
  if (!p) return;
  const today = new Date().toISOString().slice(0,10);
  const isOverdue = p.endDate && p.endDate < today;
  openModal(`
    <h3>📄 ${escapeHtml(p.name||'未命名计划')}</h3>
    <div class="plan-analysis">
      <div class="analysis-row"><span class="analysis-label">序号</span><span class="analysis-value">${p.seq || '-'}</span></div>
      <div class="analysis-row"><span class="analysis-label">负责人</span><span class="analysis-value">${escapeHtml(p.resp||'-')}</span></div>
      <div class="analysis-row"><span class="analysis-label">截止时间</span><span class="analysis-value" style="${isOverdue?'color:let(--danger)':''}">${isOverdue?'⚠️ ':''}${escapeHtml(p.endDate||'未设置')}</span></div>
      <div class="analysis-row"><span class="analysis-label">计划内容</span><span class="analysis-value" style="white-space:pre-wrap">${escapeHtml(p.content||'—')}</span></div>
      <div class="analysis-row"><span class="analysis-label">创建时间</span><span class="analysis-value">${escapeHtml(p.uploadedAt||'-')}</span></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
      <button class="btn btn-primary" data-click="__dcCloseEditPlan" data-click-args="${escapeAttr(JSON.stringify([id]))}">✏️ 编辑</button>
    </div>
  `);
}

async function deletePlan(id) {
  if (!(await appConfirm('确认删除此计划？', {danger:true}))) return;
  state.plans = state.plans.filter(p=>p.id!==id);
  saveState();
  showToast('计划已删除');
  renderPlanList();
}

function openNewPlanModal() {
  const nextSeq = state.plans.length > 0 ? Math.max(...state.plans.map(p => p.seq || 0)) + 1 : 1;
  openModal(`
    <h3>➕ 新建教学计划</h3>
    <div class="form-group">
      <label class="form-label">序号</label>
      <input type="number" class="form-input" id="planSeq" value="${nextSeq}" min="1" style="width:80px">
    </div>
    <div class="form-group">
      <label class="form-label">计划名称 <span style="color:let(--danger)">*</span></label>
      <input type="text" class="form-input" id="planName" placeholder="如：2026秋季学期教学计划">
    </div>
    <div class="form-group">
      <label class="form-label">计划内容</label>
      <textarea class="form-input" id="planContent" rows="3" placeholder="如：八年级上册全册教学计划" style="resize:vertical"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">截止时间</label>
      <input type="date" class="form-input" id="planEndDate" style="width:180px">
    </div>
    <div class="form-group">
      <label class="form-label">负责人</label>
      <input type="text" class="form-input" id="planResp" value="派大星" placeholder="负责人姓名" style="width:180px">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="savePlan">保存计划</button>
    </div>
  `);
  setTimeout(() => document.getElementById('planName')?.focus(), 50);
}

function openEditPlanModal(id) {
  const p = state.plans.find(x=>x.id===id);
  if (!p) return;
  openModal(`
    <h3>✏️ 编辑教学计划</h3>
    <div class="form-group">
      <label class="form-label">序号</label>
      <input type="number" class="form-input" id="planSeq" value="${p.seq || ''}" min="1" style="width:80px">
    </div>
    <div class="form-group">
      <label class="form-label">计划名称 <span style="color:let(--danger)">*</span></label>
      <input type="text" class="form-input" id="planName" value="${escapeHtml(p.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">计划内容</label>
      <textarea class="form-input" id="planContent" rows="3" style="resize:vertical">${escapeHtml(p.content||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">截止时间</label>
      <input type="date" class="form-input" id="planEndDate" value="${p.endDate||''}" style="width:180px">
    </div>
    <div class="form-group">
      <label class="form-label">负责人</label>
      <input type="text" class="form-input" id="planResp" value="${escapeHtml(p.resp||'')}" placeholder="负责人姓名" style="width:180px">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="savePlan" data-click-args="[&quot;${id}&quot;]">保存修改</button>
    </div>
  `);
}

function savePlan(editId) {
  const seq = parseInt(document.getElementById('planSeq').value) || (state.plans.length + 1);
  const name = document.getElementById('planName').value.trim();
  const content = document.getElementById('planContent').value.trim();
  const endDate = document.getElementById('planEndDate').value;
  const resp = document.getElementById('planResp').value.trim() || '派大星';

  if (!name) { showToast('请输入计划名称', 'warn'); return; }

  if (editId) {
    const p = state.plans.find(x=>x.id===editId);
    if (!p) { showToast('计划不存在', 'error'); return; }
    p.seq = seq;
    p.name = name;
    p.content = content;
    p.endDate = endDate;
    p.resp = resp;
    showToast('计划已修改');
  } else {
    state.plans.push({
      id: uid(),
      seq: seq,
      name: name,
      content: content,
      endDate: endDate,
      resp: resp,
      startDate: '',
      items: 0,
      uploadedAt: new Date().toISOString().slice(0,10)
    });
    showToast('计划已创建');
  }
  saveState();
  closeModal();
  renderPlanList();
}

/* ===================== 03 Smart Schedule ===================== */
function getPeriods() {
  const p = state.schedulePeriods;
  if (p && p.length > 0) return p;
  return [
    {n:1, type:'morning', start:'07:30', end:'08:00'},
    {n:2, type:'regular', start:'08:00', end:'08:45'},
    {n:3, type:'regular', start:'08:55', end:'09:40'},
    {n:4, type:'regular', start:'10:00', end:'10:45'},
    {n:5, type:'regular', start:'10:55', end:'11:40'},
    {n:6, type:'regular', start:'14:00', end:'14:45'},
    {n:7, type:'regular', start:'14:55', end:'15:40'},
    {n:8, type:'regular', start:'15:50', end:'16:35'},
    {n:9, type:'regular', start:'16:45', end:'17:30'},
    {n:10, type:'evening', start:'18:30', end:'19:30'},
    {n:11, type:'evening', start:'19:40', end:'20:40'}
  ];
}
function getPeriodType(n) {
  const periods = getPeriods();
  const found = periods.find(x => x.n === n);
  return found ? (found.type || 'regular') : 'regular';
}
function getRegularPeriodIndex(n) {
  const periods = getPeriods();
  let count = 0;
  for (const p of periods) {
    if (p.n <= n && (p.type || 'regular') === 'regular') count++;
  }
  return count || 1;
}
function getRegularPreviewIndex(upToIndex) {
  const list = document.getElementById('periodsList');
  if (!list) return 1;
  let count = 0;
  const rows = list.querySelectorAll('[id^="periodRow_"]');
  for (const row of rows) {
    const ri = row.id.split('_')[1];
    const type = document.getElementById('periodType_' + ri)?.value || 'regular';
    if (type === 'regular') count++;
    if (upToIndex !== undefined && ri === String(upToIndex)) break;
  }
  return count;
}
function getPeriodLabel(n) {
  const type = getPeriodType(n);
  if (type === 'morning') return '早读';
  if (type === 'evening') return '晚自习';
  return '第' + getRegularPeriodIndex(n) + '节';
}
function getPeriodTime(p) {
  const periods = getPeriods();
  const found = periods.find(x => x.n === p);
  return found ? `${found.start}-${found.end}` : '';
}
function getDayNames() {
  const d = state.scheduleDays;
  if (d && d.length > 0) return d;
  return ['周一','周二','周三','周四','周五'];
}

/* --- Week number & date helpers --- */
function getCurrentWeekNum() {
  if (!state.semesterStart) return 1;
  const start = new Date(state.semesterStart);
  const today = new Date();
  start.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  const diff = Math.floor((today - start) / (7*24*60*60*1000)) + 1;
  return diff > 0 ? diff : 1;
}
function getScheduleViewWeek() {
  if (state.currentScheduleWeek > 0) return state.currentScheduleWeek;
  return getCurrentWeekNum();
}
function getWeekDateRange(weekNum) {
  const start = new Date(state.semesterStart);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return { start, end };
}
function getWeekDates(weekNum) {
  const start = new Date(state.semesterStart);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const dates = [];
  const dayCount = getDayNames().length;
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}
function fmtDateShort(d) {
  return (d.getMonth()+1) + '/' + d.getDate();
}
function fmtDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
/* Get adjustments that fall within a given week */
function getWeekAdjustments(weekNum) {
  const dates = getWeekDates(weekNum);
  const dateStrs = dates.map(d => fmtDateISO(d));
  return state.adjustments.filter(a => dateStrs.includes(a.date));
}

function renderSchedule(container) {
  const hasAdjustments = state.adjustments.length > 0;
  // Preserve current schedule view tab; default to 'fixed' instead of jumping to adjustment
  if (!state.currentScheduleView) state.currentScheduleView = 'fixed';
  const today = new Date().toISOString().slice(0,10);
  const futureAdj = state.adjustments.filter(a => a.date > today);
  const pastTodayAdj = state.adjustments.filter(a => a.date <= today);

  let html = `
    <div class="toolbar">
      <div class="view-tabs">
        <div class="view-tab ${!hasAdjustments?'active':''}" data-click="switchScheduleView" data-click-args="[&quot;fixed&quot;]">📅 固定课表</div>
        <div class="view-tab ${hasAdjustments?'active':''}" data-click="switchScheduleView" data-click-args="[&quot;adjustment&quot;]">📝 调课台账 ${hasAdjustments?`(${state.adjustments.length})`:''}</div>
        <div class="view-tab" data-click="switchScheduleView" data-click-args="[&quot;analysis&quot;]">📊 数据分析</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-outline" data-click="downloadScheduleTemplate">📤 下载模板</button>
        <button class="btn btn-outline" data-click="__dcClickEl" data-click-args="[&quot;scheduleUploadInput&quot;]">📥 导入课表</button>
        <button class="btn btn-outline" data-click="openScheduleSettings">⚙️ 课表设置</button>
        <button class="btn btn-primary" data-click="openAdjustmentModal">+ 新增调课</button>
        <input type="file" id="scheduleUploadInput" accept=".csv,.xlsx,.xls" style="display:none" data-ev="change" data-ev-key="ev21">
      </div>
    </div>
    <div id="scheduleViewContainer"></div>
  `;
  container.innerHTML = html;
  switchScheduleView(state.currentScheduleView);
}

function switchScheduleView(view) {
  state.currentScheduleView = view;
  document.querySelectorAll('#contentArea .view-tab').forEach((t,i) => {
    const views = ['fixed','adjustment','analysis'];
    t.classList.toggle('active', views[i]===view);
  });
  const vc = document.getElementById('scheduleViewContainer');
  if (view==='fixed') renderFixedSchedule(vc);
  else if (view==='adjustment') renderAdjustmentLedger(vc);
  else renderScheduleAnalysis(vc);
}

function renderFixedSchedule(container) {
  const periods = getPeriods();
  const days = getDayNames();
  const weekNum = getScheduleViewWeek();
  const currentWeek = getCurrentWeekNum();
  const dateRange = getWeekDateRange(weekNum);
  const weekDates = getWeekDates(weekNum);
  const weekAdj = getWeekAdjustments(weekNum);
  const isCurrentWeek = weekNum === currentWeek;

  // Build adjustment lookup: origSlot -> adj (moved away), newSlot -> adj (moved here)
  const movedAway = {}; // key "day-period" -> adj
  const movedHere = {};  // key "day-period" -> adj
  weekAdj.forEach(a => {
    const origDayIdx = days.indexOf(a.origDay);
    const newDayIdx = days.indexOf(a.newDay);
    if (origDayIdx >= 0) movedAway[(origDayIdx+1) + '-' + a.origPeriod] = a;
    if (newDayIdx >= 0) movedHere[(newDayIdx+1) + '-' + a.newPeriod] = a;
  });

  // Week navigator bar
  let html = `
    <div class="week-nav-bar">
      <button class="btn btn-outline btn-sm" data-click="changeScheduleWeek" data-click-args="[-1]">‹ 上周</button>
      <div class="week-nav-center">
        <div class="week-nav-title">第 ${weekNum} 周 ${isCurrentWeek?'<span class="week-now-badge">本周</span>':''}</div>
        <div class="week-nav-dates">${fmtDateShort(dateRange.start)} ~ ${fmtDateShort(dateRange.end)}</div>
      </div>
      <button class="btn btn-outline btn-sm" data-click="changeScheduleWeek" data-click-args="[1]">下周 ›</button>
      ${!isCurrentWeek ? '<button class="btn btn-primary btn-sm" data-click="goToCurrentWeek" style="margin-left:8px">回到本周</button>' : ''}
      <div style="margin-left:4px;display:flex;align-items:center;gap:4px">
        <span style="font-size:12px;color:let(--text-muted)">跳转</span>
        <input type="number" min="1" max="30" value="${weekNum}" style="width:48px;padding:3px 6px;border:1px solid let(--border);border-radius:4px;font-size:12px;text-align:center" data-ev="change" data-ev-key="ev22">
        <span style="font-size:12px;color:let(--text-muted)">周</span>
      </div>
      <div style="margin-left:auto;font-size:12px;color:let(--text-muted)">
        ${weekAdj.length > 0 ? `📌 本周有 ${weekAdj.length} 条调课` : '本周无调课记录'}
      </div>
    </div>
  `;

  // Schedule table
  html += '<div class="table-wrap"><table class="schedule-table"><thead><tr><th>节次\\星期</th>';
  days.forEach((dn, idx) => {
    const d = idx + 1;
    const dateStr = fmtDateShort(weekDates[idx]);
    const todayISO = new Date().toISOString().slice(0,10);
    const cellDate = fmtDateISO(weekDates[idx]);
    const isToday = cellDate === todayISO;
    html += `<th${isToday ? ' style="background:let(--primary-lightest)"' : ''}>${dn}<div class="schedule-date ${isToday?'schedule-date-today':''}">${dateStr}${isToday?' ·今天':''}</div></th>`;
  });
  html += '</tr></thead><tbody>';
  let lastType = '';
  periods.forEach(p => {
    const ptype = p.type || 'regular';
    // Insert section header when type changes
    if (ptype !== lastType) {
      let sectionLabel = '';
      if (ptype === 'morning') sectionLabel = '🌅 早读';
      else if (ptype === 'evening') sectionLabel = '🌙 晚自习';
      else if (ptype === 'regular' && (lastType === 'morning' || lastType === 'evening')) sectionLabel = '📚 正课';
      if (sectionLabel) {
        html += `<tr class="schedule-section-header"><td colspan="${days.length + 1}">${sectionLabel}</td></tr>`;
      }
      lastType = ptype;
    }
    const timeStr = p.start && p.end ? `${p.start}-${p.end}` : (p.time || '');
    const rowClass = ptype === 'morning' ? 'schedule-row-morning' : ptype === 'evening' ? 'schedule-row-evening' : '';
    const periodLabel = ptype === 'morning' ? '早读' : ptype === 'evening' ? '晚自习' : `第${getRegularPeriodIndex(p.n)}节`;
    html += `<tr class="${rowClass}"><td style="font-weight:600"><div>${periodLabel}</div><div class="text-muted text-sm">${timeStr}</div></td>`;
    days.forEach((dn, idx) => {
      const d = idx + 1;
      const key = d + '-' + p.n;
      const entry = state.schedule.find(s => s.day===d && s.period===p.n);
      const adjAway = movedAway[key];
      const adjHere = movedHere[key];

      if (adjHere) {
        // A class was moved TO this slot
        html += `<td><div class="schedule-cell schedule-cell-moved" data-click="openScheduleCellModal" data-click-args="${escapeAttr(JSON.stringify([d, p.n, ""]))}">
          <div class="class-name">${escapeHtml(adjHere.classId)}</div>
          <div class="class-sub">${escapeHtml(adjHere.subject||'生物')}</div>
          <div class="schedule-cell-tag schedule-cell-tag-moved">调←${escapeHtml(adjHere.origDay)}${getPeriodName(adjHere.origPeriod)}</div>
        </div></td>`;
      } else if (entry) {
        if (adjAway) {
          // Original class but moved away
          html += `<td><div class="schedule-cell schedule-cell-cancelled" data-click="openScheduleCellModal" data-click-args="${escapeAttr(JSON.stringify([d, p.n, entry.id||'']))}">
            <div class="class-name" style="text-decoration:line-through;opacity:0.5">${escapeHtml(entry.classId)}</div>
            <div class="class-sub" style="text-decoration:line-through;opacity:0.5">${escapeHtml(entry.subject||'')}</div>
            <div class="schedule-cell-tag schedule-cell-tag-cancel">已调至${escapeHtml(adjAway.newDay)}${getPeriodName(adjAway.newPeriod)}</div>
          </div></td>`;
        } else {
          html += `<td><div class="schedule-cell schedule-cell-clickable" data-click="openScheduleCellModal" data-click-args="${escapeAttr(JSON.stringify([d, p.n, entry.id||'']))}">
            <div class="class-name">${escapeHtml(entry.classId)}</div>
            <div class="class-sub">${escapeHtml(entry.subject||'')}</div>
          </div></td>`;
        }
      } else {
        html += `<td><div class="schedule-cell-empty" data-click="openScheduleCellModal" data-click-args="${escapeAttr(JSON.stringify([d, p.n, ""]))}">+</div></td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // Week adjustments list
  if (weekAdj.length > 0) {
    html += '<div class="section-title" style="margin-top:16px">📌 本周调课详情</div>';
    html += '<div class="week-adj-list">';
    weekAdj.forEach(a => {
      html += `<div class="week-adj-item">
        <span class="week-adj-date">${a.date}</span>
        <span class="week-adj-desc">${escapeHtml(a.classId)} ${escapeHtml(a.origDay)}${getPeriodName(a.origPeriod)} → ${escapeHtml(a.newDay)}${getPeriodName(a.newPeriod)}</span>
        <span class="week-adj-reason">${escapeHtml(a.reason||'')}</span>
      </div>`;
    });
    html += '</div>';
  }

  const classCount = new Set(state.schedule.map(s=>s.classId)).size;
  const dayCount = new Set(state.schedule.map(s=>s.day)).size;
  html += `<div style="margin-top:14px" class="text-muted text-sm">
    📊 固定课表共 ${state.schedule.length} 节 | 覆盖 ${classCount} 个班级 | 每周 ${dayCount} 天
    &nbsp;|&nbsp; 💡 点击格子可编辑课程，切换周数可提前安排调课
  </div>`;
  container.innerHTML = html;
}

function changeScheduleWeek(delta) {
  const newWeek = getScheduleViewWeek() + delta;
  if (newWeek < 1) { showToast('已是第1周','warn'); return; }
  if (newWeek > 30) { showToast('已超过学期范围','warn'); return; }
  state.currentScheduleWeek = newWeek;
  saveState();
  renderSchedule(document.getElementById('contentArea'));
}
function goToCurrentWeek() {
  state.currentScheduleWeek = 0;
  saveState();
  renderSchedule(document.getElementById('contentArea'));
}
function jumpToWeek(val) {
  const w = parseInt(val);
  if (!w || w < 1 || w > 30) { showToast('请输入1-30之间的周数','warn'); return; }
  state.currentScheduleWeek = w;
  saveState();
  renderSchedule(document.getElementById('contentArea'));
}

function renderAdjustmentLedger(container) {
  const today = new Date().toISOString().slice(0,10);
  const future = state.adjustments.filter(a => a.date > today).sort((a,b)=>a.date.localeCompare(b.date));
  const current = state.adjustments.filter(a => a.date <= today).sort((a,b)=>b.date.localeCompare(a.date));

  function getWeekNumForDate(dateStr) {
    if (!state.semesterStart) return '';
    const start = new Date(state.semesterStart);
    start.setHours(0,0,0,0);
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    const diff = Math.floor((d - start) / (7*24*60*60*1000)) + 1;
    return diff > 0 ? diff : null;
  }

  let html = '';
  if (current.length > 0) {
    html += '<div class="section-title">📌 近期调课记录</div>';
    current.forEach(a => {
      const isToday = a.date === today;
      const wk = getWeekNumForDate(a.date);
      html += renderAdjItem(a, isToday?'today':'past', false, wk);
    });
  }
  if (future.length > 0) {
    html += '<div class="section-title" style="margin-top:18px">📋 待执行调课（已折叠）</div>';
    future.forEach(a => {
      const wk = getWeekNumForDate(a.date);
      html += renderAdjItem(a, 'future', true, wk);
    });
  }
  if (current.length===0 && future.length===0) {
    html = '<div class="empty-state"><span class="emoji">📭</span>暂无调课记录</div>';
  }
  container.innerHTML = html;

  // Setup toggle for collapsed items
  document.querySelectorAll('.adj-item').forEach(item => {
    const header = item.querySelector('.adj-header');
    header.onclick = () => item.classList.toggle('expanded');
  });
}

function renderAdjItem(a, type, collapsed, weekNum) {
  const badge = type==='future' ? '<span class="adj-badge adj-badge-future">待执行</span>'
    : type==='today' ? '<span class="adj-badge adj-badge-today">今日</span>'
    : '<span class="adj-badge adj-badge-past">已执行</span>';
  const wkTag = weekNum ? `<span style="font-size:11px;color:let(--primary);background:let(--primary-lightest);padding:1px 6px;border-radius:8px;margin-left:6px">第${weekNum}周</span>` : '';
  return `<div class="adj-item ${type} ${collapsed?'':'expanded'}">
    <div class="adj-header">
      <div>
        <span class="adj-title">${a.date} ${wkTag} | ${escapeHtml(a.classId)} ${escapeHtml(a.origDay)}${getPeriodName(a.origPeriod)} → ${escapeHtml(a.newDay)}${getPeriodName(a.newPeriod)}</span>
      </div>
      <div class="flex-between gap-8">
        ${badge}
        <button class="btn-icon" data-click="__dcStopOpenAdj" data-click-args="${escapeAttr(JSON.stringify([a.id]))}" title="编辑">✏️</button>
        <button class="btn-icon" data-click="__dcStopDelAdj" data-click-args="${escapeAttr(JSON.stringify([a.id]))}" title="删除">🗑️</button>
        <span class="adj-arrow">▼</span>
      </div>
    </div>
    <div class="adj-body">
      <div style="margin-bottom:6px"><strong>调课原因：</strong>${escapeHtml(a.reason||'')}</div>
      <div><strong>备注：</strong>${escapeHtml(a.note||'-')}</div>
    </div>
  </div>`;
}

function openAdjustmentModal(editId) {
  const days = getDayNames();
  const periods = getPeriods();
  const weekDates = getWeekDates(getScheduleViewWeek());
  const isEdit = !!editId;
  const editAdj = isEdit ? state.adjustments.find(a => a.id === editId) : null;
  // Default date: first day of the viewing week, or today if viewing current week
  const currentWeek = getCurrentWeekNum();
  const viewingWeek = getScheduleViewWeek();
  const defaultDate = isEdit ? editAdj.date
    : viewingWeek === currentWeek
    ? new Date().toISOString().slice(0,10)
    : fmtDateISO(weekDates[0]);
  openModal(`
    <h3>${isEdit ? '✏️ 编辑调课记录' : '新增调课记录'}</h3>
    ${!isEdit ? `
    <div style="background:let(--primary-lightest);border-radius:let(--radius-sm);padding:8px 12px;margin-bottom:14px;font-size:13px;color:let(--text-muted)">
      📅 为第 ${viewingWeek} 周 添加调课记录 (${fmtDateShort(weekDates[0])} ~ ${fmtDateShort(weekDates[weekDates.length-1])})
    </div>` : ''}
    <div class="form-group">
      <label class="form-label">调课日期 *</label>
      <input type="date" class="form-input" id="adjDate" value="${defaultDate}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">班级</label>
        <select class="form-select" id="adjClass">
          ${getClasses().map(c=>`<option value="${c}" ${isEdit&&editAdj.classId===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">原星期</label>
        <select class="form-select" id="adjOrigDay">
          ${days.map(c=>`<option value="${c}" ${isEdit&&editAdj.origDay===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">原节次</label>
        <select class="form-select" id="adjOrigPeriod">
          ${periods.map(p=>`<option value="${p.n}" ${isEdit&&editAdj.origPeriod===p.n?'selected':''}>${getPeriodLabel(p.n)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">调至星期</label>
        <select class="form-select" id="adjNewDay">
          ${days.map(c=>`<option value="${c}" ${isEdit&&editAdj.newDay===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">调至节次</label>
        <select class="form-select" id="adjNewPeriod">
          ${periods.map(p=>`<option value="${p.n}" ${isEdit&&editAdj.newPeriod===p.n?'selected':''}>${getPeriodLabel(p.n)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">调课原因</label>
      <input class="form-input" id="adjReason" placeholder="如：教研活动、运动会等" value="${isEdit ? escapeAttr(editAdj.reason||'') : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">备注</label>
      <input class="form-input" id="adjNote" placeholder="补充说明（可选）" value="${isEdit ? escapeAttr(editAdj.note||'') : ''}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveAdjustment" data-click-args="${escapeAttr(JSON.stringify([isEdit ? editId : '']))}">保存</button>
    </div>
  `);
}

function saveAdjustment(editId) {
  const date = document.getElementById('adjDate').value;
  if (!date) { showToast('请选择调课日期','error'); return; }
  const data = {
    date,
    classId: document.getElementById('adjClass').value,
    origDay: document.getElementById('adjOrigDay').value,
    origPeriod: parseInt(document.getElementById('adjOrigPeriod').value),
    newDay: document.getElementById('adjNewDay').value,
    newPeriod: parseInt(document.getElementById('adjNewPeriod').value),
    reason: document.getElementById('adjReason').value,
    note: document.getElementById('adjNote').value
  };
  if (editId) {
    const idx = state.adjustments.findIndex(a => a.id === editId);
    if (idx < 0) { showToast('记录不存在', 'error'); return; }
    state.adjustments[idx] = { ...state.adjustments[idx], ...data };
    showToast('调课记录已更新');
  } else {
    state.adjustments.push({ id: uid(), ...data });
    showToast('调课记录已添加');
  }
  saveState();
  closeModal();
  renderSchedule(document.getElementById('contentArea'));
}

async function deleteAdjustment(id) {
  if (!(await appConfirm('确认删除此调课记录？', {danger:true}))) return;
  state.adjustments = state.adjustments.filter(a=>a.id!==id);
  saveState();
  showToast('调课记录已删除');
  renderSchedule(document.getElementById('contentArea'));
}

/* --- Schedule Template & Import --- */
function downloadScheduleTemplate() {
  const periods = getPeriods();
  const days = getDayNames();
  let csv = '\uFEFF星期,节次,开始时间,结束时间,班级,科目,类型\n';
  periods.forEach(p => {
    const ptype = p.type || 'regular';
    const typeLabel = ptype === 'morning' ? '早读' : ptype === 'evening' ? '晚自习' : '正课';
    days.forEach((dn, idx) => {
      const d = idx + 1;
      const existing = state.schedule.find(s => s.day===d && s.period===p.n);
      csv += `${dn},第${getRegularPeriodIndex(p.n)}节,${p.start||''},${p.end||''},${existing?existing.classId:''},${existing?existing.subject:ptype==='morning'?'早读':ptype==='evening'?'晚自习':'生物'},${typeLabel}\n`;
    });
  });
  downloadFile(csv, '课程表模板.csv', 'text/csv');
}

function handleScheduleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { showToast('文件内容为空','error'); return; }
    // Skip header
    const dataLines = lines.slice(1);
    const dayMap = {};
    getDayNames().forEach((dn, i) => { dayMap[dn] = i + 1; });
    const parsed = [];
    let skipped = 0;
    dataLines.forEach(line => {
      const cols = line.split(',').map(c => c.trim());
      if (cols.length < 6) { skipped++; return; }
      const dayName = cols[0];
      const dayNum = dayMap[dayName];
      if (!dayNum) { skipped++; return; }
      const periodNum = parseInt(cols[1].replace(/[^\d]/g, ''));
      if (!periodNum) { skipped++; return; }
      const classId = cols[4];
      const subject = cols[5] || '生物';
      if (!classId) { skipped++; return; }
      // Optional type column (col[6]): 早读/晚自习/正课 (used for period type, not stored on entry)
      parsed.push({ id: uid(), day: dayNum, period: periodNum, classId, subject });
    });
    if (parsed.length === 0) {
      showToast('未能解析到有效数据，请检查文件格式','error');
      return;
    }
    // Update period times if provided
    const newPeriods = [];
    const seenPeriods = {};
    dataLines.forEach(line => {
      const cols = line.split(',').map(c => c.trim());
      const pn = parseInt((cols[1]||'').replace(/[^\d]/g, ''));
      if (pn && !seenPeriods[pn] && cols[2] && cols[3]) {
        seenPeriods[pn] = true;
        // Parse type from optional col[6]
        let ptype = 'regular';
        const rawType = (cols[6]||'').trim();
        if (rawType === '早读') ptype = 'morning';
        else if (rawType === '晚自习') ptype = 'evening';
        newPeriods.push({ n: pn, type: ptype, start: cols[2], end: cols[3] });
      }
    });
    if (newPeriods.length > 0) {
      newPeriods.sort((a,b) => a.n - b.n);
      state.schedulePeriods = newPeriods;
    }
    // Show preview
    const classCounts = {};
    parsed.forEach(p => { classCounts[p.classId] = (classCounts[p.classId]||0) + 1; });
    const classSummary = Object.entries(classCounts).map(([cls, cnt]) => `${cls}:${cnt}节`).join('  ');
    openModal(`
      <h3>📋 导入预览</h3>
      <div style="background:let(--primary-lightest);border-radius:let(--radius);padding:14px;margin-bottom:14px">
        <div style="font-size:13px;line-height:1.8">
          <div>✅ 解析成功：<strong>${parsed.length}</strong> 节课</div>
          <div>📦 覆盖班级：${Object.keys(classCounts).length} 个</div>
          <div>⏰ 节次设置：${newPeriods.length > 0 ? newPeriods.length + ' 节' : '未变更'}</div>
          ${skipped > 0 ? `<div style="color:let(--warning)">⚠️ 跳过 ${skipped} 行无效数据</div>` : ''}
          <div style="margin-top:6px;color:let(--text-muted);font-size:12px">${classSummary}</div>
        </div>
      </div>
      <div style="margin-bottom:14px">
        <label class="form-label">导入方式</label>
        <select class="form-select" id="importMode">
          <option value="replace">替换全部（删除原有课表，导入新数据）</option>
          <option value="merge">合并（保留原有课表，追加新数据）</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="__dcConfirmSchedImport" data-click-args="${escapeAttr(JSON.stringify([JSON.stringify(parsed).replace(/"/g,'&quot;')]))}">确认导入</button>
      </div>
    `);
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

function confirmScheduleImport(parsedData) {
  const data = window._pendingScheduleData || parsedData;
  window._pendingScheduleData = null;
  const mode = document.getElementById('importMode').value;
  if (mode === 'replace') {
    state.schedule = data;
  } else {
    state.schedule = [...state.schedule, ...data];
  }
  saveState();
  closeModal();
  showToast(`已导入 ${data.length} 节课`);
  renderSchedule(document.getElementById('contentArea'));
}

/* --- Schedule Cell Editing --- */
function openScheduleCellModal(day, period, entryId) {
  const entry = entryId ? state.schedule.find(s => (s.id||'') === entryId) : null;
  const days = getDayNames();
  const dayName = days[day - 1] || '';
  const timeStr = getPeriodTime(period);
  openModal(`
    <h3>${entry ? '编辑课程' : '新增课程'}</h3>
    <div style="background:let(--primary-lightest);border-radius:let(--radius-sm);padding:8px 12px;margin-bottom:14px;font-size:13px;color:let(--text-muted)">
      ${dayName} · ${getPeriodLabel(period)} ${timeStr ? '(' + timeStr + ')' : ''}
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">班级 *</label>
        <select class="form-select" id="cellClass">
          ${getClasses().map(c=>`<option value="${escapeAttr(c)}" ${entry&&entry.classId===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">科目</label>
        <input class="form-input" id="cellSubject" value="${escapeAttr(entry?entry.subject:'生物')}" placeholder="如：生物">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">星期</label>
        <select class="form-select" id="cellDay">
          ${days.map((dn,i)=>`<option value="${i+1}" ${day===i+1?'selected':''}>${dn}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">节次</label>
        <select class="form-select" id="cellPeriod">
          ${getPeriods().map(p=>`<option value="${p.n}" ${period===p.n?'selected':''}>${getPeriodLabel(p.n)} ${p.start?'('+p.start+'-'+p.end+')':''}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      ${entry ? `<button class="btn btn-danger" data-click="deleteScheduleEntry" data-click-args="[&quot;${entryId}&quot;]" style="margin-right:auto">删除</button>` : ''}
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveScheduleEntry" data-click-args="[&quot;${entryId}&quot;]">${entry?'保存':'添加'}</button>
    </div>
  `);
}

function saveScheduleEntry(entryId) {
  const classId = document.getElementById('cellClass').value;
  const subject = document.getElementById('cellSubject').value || '生物';
  const day = parseInt(document.getElementById('cellDay').value);
  const period = parseInt(document.getElementById('cellPeriod').value);
  if (!classId) { showToast('请选择班级','error'); return; }
  if (entryId) {
    const entry = state.schedule.find(s => (s.id||'') === entryId);
    if (entry) {
      entry.classId = classId;
      entry.subject = subject;
      entry.day = day;
      entry.period = period;
    }
  } else {
    state.schedule.push({ id: uid(), day, period, classId, subject });
  }
  saveState();
  closeModal();
  showToast(entryId ? '课程已更新' : '课程已添加');
  renderSchedule(document.getElementById('contentArea'));
}

async function deleteScheduleEntry(id) {
  if (!(await appConfirm('确认删除这节课？', {danger:true}))) return;
  state.schedule = state.schedule.filter(s => (s.id||'') !== id);
  saveState();
  closeModal();
  showToast('课程已删除');
  renderSchedule(document.getElementById('contentArea'));
}

/* --- Schedule Settings (periods & days editing) --- */
function openScheduleSettings() {
  const periods = getPeriods();
  const days = getDayNames();
  const periodsHtml = periods.map((p, i) => `
    <div class="form-row" style="align-items:center" id="periodRow_${i}">
      <select class="form-select" id="periodType_${i}" style="width:90px" data-ev="change" data-ev-key="ev23" data-ev-args="${escapeAttr(JSON.stringify([i]))}">
        <option value="regular" ${(p.type||'regular')==='regular'?'selected':''}>正课</option>
        <option value="morning" ${(p.type||'regular')==='morning'?'selected':''}>早读</option>
        <option value="evening" ${(p.type||'regular')==='evening'?'selected':''}>晚自习</option>
      </select>
      <div style="width:60px;font-weight:600;font-size:13px" id="periodLabel_${i}">${(p.type||'regular')==='morning'?'早读':(p.type||'regular')==='evening'?'晚自习':'第'+getRegularPeriodIndex(p.n)+'节'}</div>
      <input type="time" class="form-input" value="${p.start||''}" id="periodStart_${i}" style="width:100px">
      <span style="color:let(--text-muted)">~</span>
      <input type="time" class="form-input" value="${p.end||''}" id="periodEnd_${i}" style="width:100px">
      <button class="btn-icon" data-click="removePeriod" data-click-args="${escapeAttr(JSON.stringify([i]))}">🗑️</button>
    </div>
  `).join('');
  const daysHtml = days.map((dn, i) => `
    <div class="form-row" style="align-items:center" id="dayRow_${i}">
      <input class="form-input" value="${dn}" id="dayName_${i}" style="width:100px">
      <button class="btn-icon" data-click="removeDay" data-click-args="${escapeAttr(JSON.stringify([i]))}">🗑️</button>
    </div>
  `).join('');
  openModal(`
    <h3>⚙️ 课表设置</h3>
    <div style="max-height:60vh;overflow-y:auto">
      <div style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">⏰ 节次与时间</div>
        <div id="periodsList">${periodsHtml}</div>
        <button class="btn btn-outline" data-click="addPeriod" style="margin-top:8px">+ 添加节次</button>
      </div>
      <div style="border-top:1px solid let(--border);padding-top:14px">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">📅 上课天数</div>
        <div id="daysList">${daysHtml}</div>
        <button class="btn btn-outline" data-click="addDay" style="margin-top:8px">+ 添加星期</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveScheduleSettings">保存设置</button>
    </div>
  `);
}

function addPeriod() {
  const list = document.getElementById('periodsList');
  const periods = getPeriods();
  const i = periods.length;
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.alignItems = 'center';
  div.id = `periodRow_${i}`;
  div.innerHTML = `
    <select class="form-select" id="periodType_${i}" style="width:90px" data-ev="change" data-ev-key="ev24" data-ev-args="${escapeAttr(JSON.stringify([i]))}">
      <option value="regular" selected>正课</option>
      <option value="morning">早读</option>
      <option value="evening">晚自习</option>
    </select>
    <div style="width:60px;font-weight:600;font-size:13px" id="periodLabel_${i}">第${getRegularPreviewIndex()}节</div>
    <input type="time" class="form-input" value="" id="periodStart_${i}" style="width:100px">
    <span style="color:let(--text-muted)">~</span>
    <input type="time" class="form-input" value="" id="periodEnd_${i}" style="width:100px">
    <button class="btn-icon" data-click="__dcRemoveParent">🗑️</button>
  `;
  list.appendChild(div);
}

function onPeriodTypeChange(i) {
  const sel = document.getElementById(`periodType_${i}`);
  const label = document.getElementById(`periodLabel_${i}`);
  if (!sel || !label) return;
  const val = sel.value;
  if (val === 'morning') {
    label.textContent = '早读';
  } else if (val === 'evening') {
    label.textContent = '晚自习';
  } else {
    label.textContent = '第' + getRegularPreviewIndex(i) + '节';
  }
}

function removePeriod(i) {
  document.getElementById(`periodRow_${i}`).remove();
}

function addDay() {
  const list = document.getElementById('daysList');
  const days = getDayNames();
  const i = days.length;
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.alignItems = 'center';
  div.id = `dayRow_${i}`;
  div.innerHTML = `
    <input class="form-input" value="" id="dayName_${i}" style="width:100px" placeholder="如：周六">
    <button class="btn-icon" data-click="__dcRemoveParent">🗑️</button>
  `;
  list.appendChild(div);
}

function removeDay(i) {
  document.getElementById(`dayRow_${i}`).remove();
}

function saveScheduleSettings() {
  const list = document.getElementById('periodsList');
  const newPeriods = [];
  list.querySelectorAll('[id^="periodRow_"]').forEach((row) => {
    const i = row.id.split('_')[1];
    const start = document.getElementById(`periodStart_${i}`)?.value || '';
    const end = document.getElementById(`periodEnd_${i}`)?.value || '';
    const type = document.getElementById(`periodType_${i}`)?.value || 'regular';
    const n = newPeriods.length + 1;
    if (start || end) newPeriods.push({ n, type, start, end });
  });
  if (newPeriods.length === 0) { showToast('至少需要1个节次','error'); return; }
  const daysList = document.getElementById('daysList');
  const newDays = [];
  daysList.querySelectorAll('[id^="dayRow_"]').forEach((row) => {
    const i = row.id.split('_')[1];
    const name = document.getElementById(`dayName_${i}`)?.value || '';
    if (name) newDays.push(name);
  });
  if (newDays.length === 0) { showToast('至少需要1个上课日','error'); return; }
  state.schedulePeriods = newPeriods;
  state.scheduleDays = newDays;
  // Remove schedule entries for days that no longer exist
  state.schedule = state.schedule.filter(s => s.day <= newDays.length);
  saveState();
  closeModal();
  showToast('课表设置已保存');
  renderSchedule(document.getElementById('contentArea'));
}

/* --- Schedule Data Analysis --- */
function renderScheduleAnalysis(container) {
  const total = state.schedule.length;
  const periods = getPeriods();
  const days = getDayNames();
  // Per-class stats
  const classStats = {};
  state.schedule.forEach(s => {
    if (!classStats[s.classId]) classStats[s.classId] = { total: 0, days: new Set(), periods: new Set() };
    classStats[s.classId].total++;
    classStats[s.classId].days.add(s.day);
    classStats[s.classId].periods.add(s.period);
  });
  const maxClassCount = Math.max(...Object.values(classStats).map(s => s.total), 1);
  // Per-day stats
  const dayStats = {};
  days.forEach((dn, i) => { dayStats[dn] = 0; });
  state.schedule.forEach(s => {
    const dn = days[s.day - 1];
    if (dn) dayStats[dn] = (dayStats[dn] || 0) + 1;
  });
  const maxDayCount = Math.max(...Object.values(dayStats), 1);
  // Per-period stats
  const periodStats = {};
  periods.forEach(p => { periodStats[p.n] = 0; });
  state.schedule.forEach(s => {
    periodStats[s.period] = (periodStats[s.period] || 0) + 1;
  });
  const maxPeriodCount = Math.max(...Object.values(periodStats), 1);

  const html = `
    <div class="stats-row" style="margin-bottom:16px">
      <div class="stat-card"><span class="stat-icon">📊</span><div class="stat-num">${total}</div><div class="stat-label">周总课时</div></div>
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-num">${Object.keys(classStats).length}</div><div class="stat-label">覆盖班级</div></div>
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-num">${Object.keys(dayStats).filter(d=>dayStats[d]>0).length}</div><div class="stat-label">上课天数</div></div>
      <div class="stat-card"><span class="stat-icon">⏰</span><div class="stat-num">${(total/Object.keys(classStats).length).toFixed(1)}</div><div class="stat-label">班均课时</div></div>
    </div>
    <div class="schedule-analysis-card">
      <h4>👥 各班级周课时分布</h4>
      ${Object.entries(classStats).sort((a,b)=>b[1].total-a[1].total).map(([cls, st]) => `
        <div class="schedule-bar-row">
          <div class="schedule-bar-label">${escapeHtml(cls)}</div>
          <div class="schedule-bar" style="width:${(st.total/maxClassCount*180)}px"></div>
          <div class="schedule-bar-val">${st.total}节</div>
          <span style="font-size:11px;color:let(--text-muted)">${st.days.size}天${st.periods.size}个时段</span>
        </div>
      `).join('')}
    </div>
    <div class="schedule-analysis-card">
      <h4>📅 每日课时分布</h4>
      ${Object.entries(dayStats).map(([dn, cnt]) => `
        <div class="schedule-bar-row">
          <div class="schedule-bar-label">${dn}</div>
          <div class="schedule-bar" style="width:${(cnt/maxDayCount*180)}px;background:${cnt>0?'let(--primary)':'let(--border)'}"></div>
          <div class="schedule-bar-val">${cnt}节</div>
        </div>
      `).join('')}
    </div>
    <div class="schedule-analysis-card">
      <h4>⏰ 各节次使用情况</h4>
      ${Object.entries(periodStats).map(([pn, cnt]) => `
        <div class="schedule-bar-row">
          <div class="schedule-bar-label">${getPeriodLabel(parseInt(pn))}</div>
          <div class="schedule-bar" style="width:${(cnt/maxPeriodCount*180)}px;background:${cnt>0?'let(--primary)':'let(--border)'}"></div>
          <div class="schedule-bar-val">${cnt}班</div>
        </div>
      `).join('')}
    </div>
  `;
  container.innerHTML = html;
}

/* ===================== 04 Teaching Progress ===================== */
function renderProgress(container) {
  const total = state.progress.length;
  const completed = state.progress.filter(p=>p.status==='completed').length;
  const inProgress = state.progress.filter(p=>p.status==='in-progress').length;
  const planned = state.progress.filter(p=>p.status==='planned').length;

  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">📊</span><div class="stat-num">${total}</div><div class="stat-label">总课时</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-num">${completed}</div><div class="stat-label">已完成</div></div>
      <div class="stat-card"><span class="stat-icon">⏳</span><div class="stat-num">${inProgress}</div><div class="stat-label">进行中</div></div>
      <div class="stat-card"><span class="stat-icon">📋</span><div class="stat-num">${planned}</div><div class="stat-label">待授课</div></div>
      <div class="stat-card"><span class="stat-icon">📈</span><div class="stat-num">${total>0?Math.round(completed/total*100):0}%</div><div class="stat-label">完成率</div></div>
    </div>
    <div class="toolbar">
      <div class="text-muted text-sm">
        📅 学期起始：${state.semesterStart} | 数据自动同步课程表
      </div>
      <div class="flex-between gap-8">
        <button class="btn btn-outline" data-click="syncProgressFromSchedule">🔄 同步课表</button>
        <button class="btn btn-primary" data-click="openProgressModal">+ 新增进度</button>
      </div>
    </div>
    <table class="progress-table" id="progressTable">
      <thead><tr>
        <th>周次</th><th>日期</th><th>班级</th><th>授课内容</th><th>进度</th><th>状态</th><th>操作</th>
      </tr></thead>
      <tbody id="progressBody"></tbody>
    </table>
  `;
  renderProgressBody();
}

function renderProgressBody() {
  const body = document.getElementById('progressBody');
  if (!body) return;
  const sorted = [...state.progress].sort((a,b)=> (a.week-b.week) || a.date.localeCompare(b.date));
  if (sorted.length===0) {
    body.innerHTML = '<tr><td colspan="7" class="empty-state"><span class="emoji">📭</span>暂无进度记录，点击「同步课表」自动生成</td></tr>';
    return;
  }
  body.innerHTML = sorted.map(p => `
    <tr class="progress-row" id="row-${p.id}">
      <td>第${p.week}周</td>
      <td>${escapeHtml(p.date)}</td>
      <td><span class="qc-resp">${escapeHtml(p.classId)}</span></td>
      <td>${escapeHtml(p.content||'-')}</td>
      <td>${escapeHtml(p.chProgress||'-')}</td>
      <td>${statusBadge(p.status)}</td>
      <td style="white-space:nowrap">
        <button class="btn-icon" data-click="__dcStopOpenProg" data-click-args="${escapeAttr(JSON.stringify([p.id]))}">✏️</button>
        <button class="btn-icon" data-click="__dcStopDelProg" data-click-args="${escapeAttr(JSON.stringify([p.id]))}">🗑️</button>
      </td>
    </tr>
    <tr id="ref-${p.id}" style="display:none">
      <td colspan="7" style="padding:0 12px 12px">
        <div class="reflection-panel show">
          <h4>💭 教学反思</h4>
          <textarea class="reflection-textarea" id="reflection-${p.id}" placeholder="记录课堂反思、学生反馈、改进方向...">${escapeHtml(p.reflection||'')}</textarea>
          <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:8px">
            <button class="btn btn-primary btn-sm" data-click="saveReflection" data-click-args="[&quot;${p.id}&quot;]">保存反思</button>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  // Toggle reflection on row click
  sorted.forEach(p => {
    const row = document.getElementById(`row-${p.id}`);
    if (row) row.onclick = () => {
      const ref = document.getElementById(`ref-${p.id}`);
      ref.style.display = ref.style.display==='none' ? 'table-row' : 'none';
    };
  });
}

function statusBadge(s) {
  const map = { completed:'status-completed', 'in-progress':'status-in-progress', planned:'status-planned' };
  const labels = { completed:'已完成', 'in-progress':'进行中', planned:'待授课' };
  return `<span class="status-badge ${map[s]||'status-planned'}">${labels[s]||escapeHtml(String(s||'未知'))}</span>`;
}

function openProgressModal(id) {
  const p = id ? state.progress.find(x=>x.id===id) : {};
  const isEdit = !!id;
  openModal(`
    <h3>${isEdit?'编辑进度':'新增进度'}</h3>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">周次</label>
        <input type="number" class="form-input" id="progWeek" value="${p.week||1}" min="1" max="20">
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input type="date" class="form-input" id="progDate" value="${p.date||new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label class="form-label">班级</label>
        <select class="form-select" id="progClass">
          ${getClasses().map(c=>`<option value="${c}" ${(p.classId||'')===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">授课内容</label>
      <input class="form-input" id="progContent" value="${escapeHtml(p.content||'')}" placeholder="如：动物的主要类群">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">章节进度</label>
        <input class="form-input" id="progChProgress" value="${escapeHtml(p.chProgress||'')}" placeholder="如：第一章第1节">
      </div>
      <div class="form-group">
        <label class="form-label">课堂状态</label>
        <select class="form-select" id="progStatus">
          <option value="planned" ${p.status==='planned'?'selected':''}>待授课</option>
          <option value="in-progress" ${p.status==='in-progress'?'selected':''}>进行中</option>
          <option value="completed" ${p.status==='completed'?'selected':''}>已完成</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">教学反思（可后续补充）</label>
      <textarea class="form-textarea" id="progReflection" placeholder="课堂反思、学生反馈、改进方向...">${escapeHtml(p.reflection||'')}</textarea>
    </div>
    <div class="modal-actions">
      ${isEdit?`<button class="btn btn-danger btn-sm" data-click="__dcDeleteProgressClose" data-click-args="${escapeAttr(JSON.stringify([id]))}">删除</button>`:''}
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveProgress" data-click-args="${escapeAttr(JSON.stringify([isEdit ? id : 'null']))}">${isEdit?'保存':'创建'}</button>
    </div>
  `);
}

function saveProgress(id) {
  const data = {
    week: parseInt(document.getElementById('progWeek').value) || 1,
    date: document.getElementById('progDate').value,
    classId: document.getElementById('progClass').value,
    content: document.getElementById('progContent').value.trim(),
    chProgress: document.getElementById('progChProgress').value.trim(),
    status: document.getElementById('progStatus').value,
    reflection: document.getElementById('progReflection').value.trim()
  };
  if (id && id !== 'null') {
    const p = state.progress.find(x=>x.id===id);
    Object.assign(p, data);
    showToast('进度已更新');
  } else {
    state.progress.push({ id: uid(), ...data });
    showToast('进度已创建');
  }
  saveState();
  closeModal();
  renderProgress(document.getElementById('contentArea'));
}

async function deleteProgress(id) {
  if (!(await appConfirm('确认删除此进度记录？', {danger:true}))) return;
  state.progress = state.progress.filter(p=>p.id!==id);
  saveState();
  showToast('进度已删除');
  renderProgress(document.getElementById('contentArea'));
}

function saveReflection(id) {
  const p = state.progress.find(x=>x.id===id);
  if (p) {
    p.reflection = document.getElementById(`reflection-${id}`).value.trim();
    saveState();
    showToast('反思已保存');
  }
}

function syncProgressFromSchedule() {
  const semesterStart = new Date(state.semesterStart);
  const today = new Date();
  const weekDiff = Math.floor((today - semesterStart) / (7*24*60*60*1000)) + 1;
  let added = 0;
  state.schedule.forEach(s => {
    const exists = state.progress.some(p =>
      p.week===weekDiff && p.classId===s.classId &&
      p.chProgress && p.content
    );
    if (!exists) {
      // Check if there's already a progress entry for this week+class
      const existing = state.progress.find(p => p.week===weekDiff && p.classId===s.classId);
      if (!existing) {
        state.progress.push({
          id: uid(),
          week: weekDiff,
          date: getDateForSchedule(s, semesterStart),
          classId: s.classId,
          content: '',
          chProgress: '',
          status: 'planned',
          reflection: ''
        });
        added++;
      }
    }
  });
  if (added > 0) {
    saveState();
    showToast(`已同步 ${added} 条课表数据（第${weekDiff}周）`);
    renderProgress(document.getElementById('contentArea'));
  } else {
    showToast('当前周次课表数据已存在，无需同步');
  }
}

function getDateForSchedule(s, semesterStart) {
  const dayDiff = s.day - 1; // Monday = 0 offset
  const d = new Date(semesterStart);
  d.setDate(d.getDate() + dayDiff);
  return d.toISOString().slice(0,10);
}

/* ===================== 05 Student Archive ===================== */
const COMMON_TAGS = ['积极举手','作业认真','需督促','思维活跃','基础薄弱','粗心大意','进步明显','退步明显','需要关注','课堂安静','作业优秀','作业潦草','勤奋刻苦','有潜力','需补课'];

// 新增班级：同步更新 state.classes 并保存
function addClass(className, isTeaching) {
  const name = (className || '').trim();
  if (!name) { showToast('班级名称不能为空', 'error'); return false; }
  if (!state.classes) state.classes = CLASSES.slice();
  if (state.classes.includes(name)) { showToast('班级已存在', 'error'); return false; }
  state.classes.push(name);
  state.classes.sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
  // 如果标记为任教班级，同时添加到 teachingClasses
  if (isTeaching) {
    if (!state.teachingClasses) state.teachingClasses = CLASSES.slice();
    if (!state.teachingClasses.includes(name)) {
      state.teachingClasses.push(name);
      state.teachingClasses.sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
    }
  }
  saveState();
  showToast(`班级 ${name} 已添加${isTeaching ? '（任教班级）' : ''}`);
  return true;
}

// 删除班级：仅允许删除无学生、无成绩的班级
function deleteClass(className) {
  if (!state.classes) state.classes = CLASSES.slice();
  const hasStudent = state.students.some(s => s.classId === className);
  const hasScore = state.scores.some(sc => sc.classId === className);
  const hasRecord = hasStudent || hasScore;
  if (hasRecord) {
    showToast('该班级下仍有学生或成绩记录，请先删除相关数据', 'error');
    return false;
  }
  state.classes = state.classes.filter(c => c !== className);
  if (state.classes.length === 0) state.classes = CLASSES.slice();
  // 同步从任教班级列表中移除
  if (state.teachingClasses) {
    state.teachingClasses = state.teachingClasses.filter(c => c !== className);
    if (state.teachingClasses.length === 0) state.teachingClasses = CLASSES.slice();
  }
  // 清除相关过滤状态
  if (state.studentClassFilter === className) state.studentClassFilter = '';
  if (state.currentChatClass === className) state.currentChatClass = state.classes[0] || CLASSES[0];
  saveState();
  showToast(`班级 ${className} 已删除`);
  return true;
}

// 切换班级的任教/非任教状态
function toggleTeachingClass(className) {
  if (!state.teachingClasses) state.teachingClasses = CLASSES.slice();
  if (state.teachingClasses.includes(className)) {
    if (state.teachingClasses.length <= 1) { showToast('至少需要保留一个任教班级', 'error'); return false; }
    state.teachingClasses = state.teachingClasses.filter(c => c !== className);
    showToast(`${className} 已设为非任教班级`);
  } else {
    state.teachingClasses.push(className);
    state.teachingClasses.sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
    showToast(`${className} 已设为任教班级`);
  }
  saveState();
  return true;
}

// 新增学生
function addStudent(data) {
  const student = {
    id: uid(),
    studentNo: (data.studentNo || '').trim(),
    name: (data.name || '').trim(),
    gender: data.gender || '男',
    classId: data.classId || (getClasses()[0]),
    layer: data.layer || 'B',
    scoreTrend: (data.scoreTrend || '').trim() || '保持稳定',
    tags: Array.isArray(data.tags) ? data.tags : [],
    homeworkStats: {
      excellent: parseInt(data.homeworkStats && data.homeworkStats.excellent) || 0,
      normal: parseInt(data.homeworkStats && data.homeworkStats.normal) || 0,
      incomplete: parseInt(data.homeworkStats && data.homeworkStats.incomplete) || 0
    },
    teacherNote: (data.teacherNote || '').trim()
  };
  if (!student.name) { showToast('学生姓名不能为空', 'error'); return null; }
  if (!student.studentNo) { showToast('学号不能为空', 'error'); return null; }
  if (state.students.some(s => s.studentNo === student.studentNo)) {
    showToast('学号已存在', 'error'); return null;
  }
  state.students.push(student);
  saveState();
  ensureHomeworkRecordsForStudent(student);
  showToast(`学生 ${student.name} 已添加`);
  return student;
}

// 删除学生（同时清理关联数据：成绩、作业记录、学生任务、聊天消息）
async function deleteStudent(id) {
  const idx = state.students.findIndex(s => s.id === id);
  if (idx < 0) { showToast('学生不存在', 'error'); return false; }
  const s = state.students[idx];
  saveState({pushUndo:true});
  if (!(await appConfirm(`确定要删除学生「${s.name} (${s.studentNo})」吗？\n关联的成绩、作业、任务、聊天记录将一并删除，且不可恢复。`))) {
    return false;
  }
  state.students.splice(idx, 1);
  state.scores = state.scores.filter(sc => sc.studentId !== id);
  state.homeworkRecords = state.homeworkRecords.filter(h => h.studentId !== id);
  state.studentTasks = state.studentTasks.filter(t => t.studentId !== id);
  state.chatMessages = state.chatMessages.filter(m => m.studentId !== id);
  saveState();
  showToast(`学生 ${s.name} 已删除`);
  return true;
}

// 学生档案：批量删除（级联清理关联数据）
async function batchDeleteStudents() {
  const cbs = Array.prototype.slice.call(document.querySelectorAll('.student-select-cb:checked'));
  if (cbs.length === 0) { showToast('请先勾选要删除的学生', 'warn'); return; }
  const ids = cbs.map(function(cb){ return cb.getAttribute('data-sid'); });
  const names = ids.map(function(id){ const s = state.students.find(function(x){ return x.id === id; }); return s ? s.name + '(' + s.studentNo + ')' : id; });
  const preview = names.slice(0, 5).join('、') + (names.length > 5 ? (' 等 ' + names.length + ' 人') : '');
  saveState({pushUndo:true});
  if (!(await appConfirm(`确定批量删除以下 ${ids.length} 名学生吗？\n${preview}\n关联的成绩、作业、任务、聊天记录将一并删除，且不可恢复。`))) {
    return;
  }
  ids.forEach(function(id) {
    state.students = state.students.filter(function(s){ return s.id !== id; });
    state.scores = state.scores.filter(function(sc){ return sc.studentId !== id; });
    state.homeworkRecords = state.homeworkRecords.filter(function(h){ return h.studentId !== id; });
    state.studentTasks = state.studentTasks.filter(function(t){ return t.studentId !== id; });
    state.chatMessages = state.chatMessages.filter(function(m){ return m.studentId !== id; });
  });
  saveState();
  showToast(`已批量删除 ${ids.length} 名学生`);
  renderPage();
}

// 学生档案：更新勾选计数与批量删除按钮状态
function updateStudentSelCount() {
  const cbs = document.querySelectorAll('.student-select-cb:checked');
  const cnt = document.getElementById('studentSelCount');
  const btn = document.getElementById('studentBatchDeleteBtn');
  if (cnt) cnt.textContent = cbs.length;
  if (btn) btn.disabled = cbs.length === 0;
}

// 打开班级管理弹窗
function openClassManager() {
  const renderList = () => {
    const listEl = document.getElementById('classManagerList');
    if (!listEl) return;
    const allClasses = getClasses();
    const teachingSet = getTeachingClasses();
    const teachingClasses = allClasses.filter(c => teachingSet.includes(c));
    const nonTeachingClasses = allClasses.filter(c => !teachingSet.includes(c));

    const renderItem = (c, isTeaching) => {
      const hasData = state.students.some(s => s.classId === c) || state.scores.some(sc => sc.classId === c);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid let(--border)">
          <span style="font-weight:500">${escapeHtml(c)}</span>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-sm ${isTeaching ? 'btn-success' : 'btn-outline'}" style="font-size:11px;padding:2px 8px" data-click="__dcToggleTeachRender" data-click-args="${escapeAttr(JSON.stringify([escapeAttr(c)]))}" title="${isTeaching ? '点击取消任教' : '点击设为任教'}">${isTeaching ? '✓ 任教' : '非任教'}</button>
            <button class="btn btn-sm btn-danger" style="font-size:11px;padding:2px 8px" data-click="__dcDelClassRender" data-click-args="${escapeAttr(JSON.stringify([escapeAttr(c)]))}" ${hasData?'disabled title="请先删除该班级下的学生和成绩"':''}>删除</button>
          </div>
        </div>
      `;
    };

    let html = '';
    if (teachingClasses.length > 0) {
      html += '<div style="font-size:12px;font-weight:600;color:let(--primary);margin:6px 0 2px;padding:0 4px">📚 任教班级</div>';
      html += teachingClasses.map(c => renderItem(c, true)).join('');
    }
    if (nonTeachingClasses.length > 0) {
      html += '<div style="font-size:12px;font-weight:600;color:let(--text-muted);margin:10px 0 2px;padding:0 4px">🏫 非任教班级</div>';
      html += nonTeachingClasses.map(c => renderItem(c, false)).join('');
    }
    if (allClasses.length === 0) {
      html = '<div class="empty-state" style="padding:16px"><span class="emoji">📭</span>暂无班级</div>';
    }
    listEl.innerHTML = html;
  };
  window.renderClassManagerList = renderList;
  openModal(`
    <h3>⚙️ 班级管理</h3>
    <div style="margin-bottom:12px">
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <input type="text" class="form-input" id="newClassName" placeholder="输入新班级名称，如：11班" style="flex:1">
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="newClassIsTeaching" checked> 任教班级
        </label>
        <button class="btn btn-primary" data-click="__dcAddClassRender">新增</button>
      </div>
      <div id="classManagerList" style="max-height:350px;overflow:auto;border:1px solid let(--border);border-radius:let(--radius-sm);padding:4px"></div>
      <p style="font-size:12px;color:let(--text-muted);margin-top:8px">提示：点击"任教/非任教"按钮可切换班级类型；有学生或成绩记录的班级不可删除。</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
  renderList();
}

// 打开新增/编辑学生弹窗（id 为空时新增）
function openStudentEditor(id) {
  const isNew = !id;
  const s = isNew ? null : state.students.find(x => x.id === id);
  const classes = getClasses();
  const layerOptions = ['A','B','C','D'].map(l => `<option value="${l}" ${s && s.layer===l?'selected':''}>${l}层</option>`).join('');
  openModal(`
    <h3>${isNew ? '➕ 新增学生' : '✏️ 编辑学生'}</h3>
    <div class="profile-detail">
      <div class="profile-section">
        <div class="profile-row"><span class="label">姓名</span><input class="form-input profile-edit-input" id="editName" value="${s ? escapeHtml(s.name) : ''}" style="flex:1" placeholder="请输入姓名"></div>
        <div class="profile-row"><span class="label">学号</span><input class="form-input profile-edit-input" id="editStudentNo" value="${s ? escapeHtml(s.studentNo) : ''}" style="flex:1" placeholder="请输入学号"></div>
        <div class="profile-row"><span class="label">班级</span>
          <select class="form-select" id="editClass" style="flex:1">
            ${classes.map(c => `<option value="${c}" ${s && s.classId===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="profile-row"><span class="label">性别</span>
          <select class="form-select" id="editGender" style="flex:1">
            <option value="男" ${!s || s.gender==='男'?'selected':''}>男</option>
            <option value="女" ${s && s.gender==='女'?'selected':''}>女</option>
          </select>
        </div>
        <div class="profile-row"><span class="label">班级分层</span>
          <select class="form-select" id="editLayer" style="flex:1">${layerOptions}</select>
        </div>
        <div class="profile-row"><span class="label">成绩趋势</span><input class="form-input profile-edit-input" id="editScoreTrend" value="${s ? escapeHtml(s.scoreTrend||'') : ''}" style="flex:1" placeholder="如：稳步提升"></div>
        <div class="profile-row"><span class="label">教师描述</span><textarea class="form-textarea" id="editTeacherNote" placeholder="输入学生描述...">${s ? escapeHtml(s.teacherNote || '') : ''}</textarea></div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      ${!isNew ? `<button class="btn btn-danger" data-click="__dcDelStudentCloseRender" data-click-args="${escapeAttr(JSON.stringify([s.id]))}">删除</button>` : ''}
      <button class="btn btn-primary" data-click="saveStudentEditor" data-click-args="[&quot;${isNew ? '' : s.id}&quot;]">保存</button>
    </div>
  `);
}

// 保存新增/编辑学生
function saveStudentEditor(id) {
  const data = {
    name: document.getElementById('editName').value.trim(),
    studentNo: document.getElementById('editStudentNo').value.trim(),
    classId: document.getElementById('editClass').value,
    gender: document.getElementById('editGender').value,
    layer: document.getElementById('editLayer').value,
    scoreTrend: document.getElementById('editScoreTrend').value.trim(),
    teacherNote: document.getElementById('editTeacherNote').value.trim()
  };
  if (!data.name) { showToast('姓名不能为空', 'error'); return; }
  if (!data.studentNo) { showToast('学号不能为空', 'error'); return; }
  saveState({pushUndo:true});
  if (!id) {
    addStudent(data);
  } else {
    const s = state.students.find(x => x.id === id);
    if (!s) return;
    const duplicate = state.students.find(x => x.studentNo === data.studentNo && x.id !== id);
    if (duplicate) { showToast('学号已存在', 'error'); return; }
    Object.assign(s, data);
    saveState();
    showToast('档案已保存');
  }
  closeModal();
  renderPage();
}

function renderStudents(container) {
  clearLayerCache();
  const classFilter = state.studentClassFilter || '';
  const showStudents = classFilter ? state.students.filter(s => s.classId === classFilter) : state.students;
  const batchMode = state._studentBatchMode === true;
  const layerMode = state.layerMode || 'class';
  const isScoreMode = layerMode === 'score';
  // 统计各层人数
  let layerCounts;
  if (isScoreMode) {
    layerCounts = { 'A+':0, 'A':0, 'B+':0, 'B':0, 'C+':0, 'C':0 };
  } else {
    layerCounts = { A:0, B:0, C:0, D:0 };
  }
  showStudents.forEach(s => {
    const l = getStudentLayer(s);
    layerCounts[l] = (layerCounts[l] || 0) + 1;
  });
  const filtered = filterStudents(state.studentSearchQuery);

  // 分层统计卡片 HTML
  let layerStatsHTML = '';
  if (isScoreMode) {
    const scLayers = [
      { k:'A+', color:'#1B5E20', bg:'#E8F5E9' },
      { k:'A', color:'#2E7D32', bg:'#E8F5E9' },
      { k:'B+', color:'#1565C0', bg:'#E3F2FD' },
      { k:'B', color:'#E65100', bg:'#FFF3E0' },
      { k:'C+', color:'#C62828', bg:'#FFEBEE' },
      { k:'C', color:'#880E4F', bg:'#FCE4EC' }
    ];
    layerStatsHTML = scLayers.map(l => `<div class="stat-card" style="border-left:3px solid ${l.color}"><span class="stat-icon" style="color:${l.color}">${l.k}</span><div class="stat-num" style="color:${l.color}">${layerCounts[l.k]}</div><div class="stat-label">${l.k}层</div></div>`).join('');
  } else {
    layerStatsHTML = `
      <div class="stat-card" style="border-left:3px solid let(--success)"><span class="stat-icon" style="color:let(--success)">A</span><div class="stat-num" style="color:let(--success)">${layerCounts.A}</div><div class="stat-label">A层</div></div>
      <div class="stat-card" style="border-left:3px solid let(--info)"><span class="stat-icon" style="color:let(--info)">B</span><div class="stat-num" style="color:let(--info)">${layerCounts.B}</div><div class="stat-label">B层</div></div>
      <div class="stat-card" style="border-left:3px solid let(--warning)"><span class="stat-icon" style="color:let(--warning)">C</span><div class="stat-num" style="color:let(--warning)">${layerCounts.C}</div><div class="stat-label">C层</div></div>
      <div class="stat-card" style="border-left:3px solid let(--danger)"><span class="stat-icon" style="color:let(--danger)">D</span><div class="stat-num" style="color:let(--danger)">${layerCounts.D}</div><div class="stat-label">D层</div></div>`;
  }

  // 分层筛选选项
  let layerOptions;
  if (isScoreMode) {
    layerOptions = ['A+','A','B+','B','C+','C'].map(l => `<option value="${l}">${l}层</option>`).join('');
  } else {
    layerOptions = ['A','B','C','D'].map(l => `<option value="${l}">${l}层</option>`).join('');
  }

  const IS_M = isMobileUI();
  const classTabsHTML = IS_M ? (
    '<div class="mbn-class-tabs" id="classTabs">' +
      '<div class="mbn-class-tab ' + (classFilter===''?'active':'') + '" data-click="onClassFilterChange" data-click-args="[&quot;&quot;]">全部</div>' +
      getClasses().map(function(c){ return '<div class="mbn-class-tab ' + (classFilter===c?'active':'') + '" data-click="onClassFilterChange" data-click-args="[&quot;' + c + '&quot;]">' + escapeHtml(c) + '</div>'; }).join('') +
    '</div>'
  ) : '';
  const expandAllHTML = IS_M ? '' : ('<button class="btn btn-outline" id="studentExpandAllBtn" data-click="toggleAllStudentCards">' + studentExpandAllLabel() + '</button>');
  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">🎓</span><div class="stat-num">${showStudents.length}</div><div class="stat-label">学生总数</div></div>
      ${layerStatsHTML}
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:12px;color:let(--text-muted);font-weight:600">分层模式：</span>
      <div class="layer-toggle ${isScoreMode?'':'active'}" data-click="switchLayerMode" data-click-args="[&quot;class&quot;]">📊 班级分层 <span style="font-size:10px;color:let(--text-muted)">(排名)</span></div>
      <div class="layer-toggle ${isScoreMode?'active':''}" data-click="switchLayerMode" data-click-args="[&quot;score&quot;]">🎯 成绩分层 <span style="font-size:10px;color:let(--text-muted)">(分数)</span></div>
    </div>
    ${classTabsHTML}
    <div class="toolbar">
      <div class="search-bar" style="flex:1;margin-bottom:0">
        ${IS_M ? '' : `<select class="form-select" id="classFilter" data-ev="change" data-ev-key="ev25" style="width:120px">
          <option value="">全部班级</option>
          ${getClasses().map(c => `<option value="${c}" ${classFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>`}
        <input type="text" class="search-input" id="studentSearch" value="${escapeHtml(state.studentSearchQuery)}" placeholder="姓名/学号检索..." data-ev="input" data-ev-key="ev26">
        <select class="form-select" id="layerFilter" data-ev="change" data-ev-key="ev27" style="width:100px">
          <option value="">全部分层</option>
          ${layerOptions}
        </select>
      </div>
      <div class="flex-between gap-8">
        ${expandAllHTML}
        <button class="btn btn-outline" data-click="downloadStudentTemplate">⬇️ 模板</button>
        <button class="btn btn-primary" data-click="__dcClickEl" data-click-args="[&quot;studentUpload&quot;]">📤 上传</button>
        <input type="file" id="studentUpload" accept=".csv" style="display:none" data-ev="change" data-ev-key="ev28">
        <button class="btn btn-success" data-click="openStudentEditor">➕ 学生</button>
        <button class="btn btn-outline" data-click="openClassManager">⚙️ 班级</button>
        <button class="btn ${batchMode?'btn-primary':'btn-outline'}" data-click="toggleStudentBatchMode" style="margin-left:auto">${batchMode?'✓ 批量操作中':'☑ 批量操作'}</button>
      </div>
    </div>
    <div class="flex-between gap-8" style="margin:8px 0 4px;display:${batchMode?'flex':'none'}">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;user-select:none">
        <input type="checkbox" id="studentSelectAll"> 全选本页
      </label>
      <button class="btn btn-danger" id="studentBatchDeleteBtn" data-click="batchDeleteStudents" disabled style="font-size:12px;padding:4px 12px">🗑️ 批量删除 (<span id="studentSelCount">0</span>)</button>
    </div>
    <div class="section-title">📇 学生档案 (${filtered.length})</div>
    <div class="student-grid" id="studentGrid"></div>
  `;
  renderStudentGrid(filtered);
}

function switchLayerMode(mode) {
  state.layerMode = mode;
  clearLayerCache();
  saveState();
  renderStudents(document.getElementById('contentArea'));
}

function onClassFilterChange(cls) {
  state.studentClassFilter = cls;
  saveState();
  renderStudents(document.getElementById('contentArea'));
}

function filterStudents(query) {
  const layer = document.getElementById('layerFilter')?.value || '';
  const cls = state.studentClassFilter || '';
  const q = (query || '').toLowerCase().trim();
  return state.students.filter(s => {
    const matchClass = !cls || s.classId === cls;
    const matchQ = !q || s.name.includes(q) || s.studentNo.includes(q) || s.classId.includes(q);
    const matchLayer = !layer || getStudentLayer(s) === layer;
    return matchClass && matchQ && matchLayer;
  });
}

function onStudentSearch(value) {
  state.studentSearchQuery = value;
  saveState();
  // 防抖渲染：200ms 内连续输入只渲染最后一次
  _debouncedRenderStudentGrid(value);
}
// 防抖版学生网格渲染
const _debouncedRenderStudentGrid = debounce(function(value) {
  renderStudentGrid(filterStudents(value));
});

function renderStudentGrid(students) {
  const grid = document.getElementById('studentGrid');
  if (!grid) return;
  if (students.length === 0) {
    grid.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>未找到匹配学生</div>';
    return;
  }
  const IS_M = isMobileUI();
  const _studentHtml = students.map(s => {
    const badgeClass = getLayerBadgeClass(s);
    const layer = getStudentLayer(s);
    const initialChar = (s.name || '?').charAt(0);
    const layerBadge = layer === null
      ? '<span class="layer-badge none" title="暂无排名或成绩">未分层</span>'
      : '<span class="layer-badge ' + badgeClass + '">' + layer + '层</span>';
    return '<div class="student-card-item layer-' + badgeClass + '" data-initial="' + escapeAttr(initialChar) + '" data-click="openStudentProfile" data-click-args="[&quot;' + s.id + '&quot;]"' + (IS_M ? ' data-ev="contextmenu" data-ev-key="evRowMenu" data-ev-args="' + escapeAttr(JSON.stringify(['student', s.id])) + '"' : '') + '>'
      + '<label class="student-card-check" onclick="event.stopPropagation()"><input type="checkbox" class="student-select-cb" data-sid="' + escapeAttr(s.id) + '"></label>'
      + '<div style="display:flex;justify-content:space-between;align-items:start">'
        + '<div>'
          + '<div class="student-card-name">' + escapeHtml(s.name) + ' <span class="text-muted text-sm">' + escapeHtml(s.studentNo) + '</span></div>'
          + '<div class="student-card-info">' + escapeHtml(s.classId) + ' · ' + escapeHtml(s.gender) + ' · ' + escapeHtml(s.scoreTrend) + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px">' + layerBadge + '</div>'
      + '</div>'
      + '<div class="student-card-tags">' + s.tags.map(function(t){ return '<span class="tag tag-normal">' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
      + '<div style="margin-top:10px;display:flex;gap:10px;font-size:11px;color:let(--text-muted)">'
        + '<span>✅ 优' + s.homeworkStats.excellent + '</span>'
        + '<span>📝 完' + s.homeworkStats.normal + '</span>'
        + '<span style="color:let(--danger)">❌ 未' + s.homeworkStats.incomplete + '</span>'
      + '</div>'
    + '</div>';
  }).join('');
  grid.innerHTML = _studentHtml;
  grid.classList.toggle('batch-mode', state._studentBatchMode === true);
  if (IS_M) renderStudentAlphaIndex();
}

// 切换学生档案「批量操作」模式（勾选框按需显示）
function toggleStudentBatchMode() {
  state._studentBatchMode = !(state._studentBatchMode === true);
  saveState();
  renderStudents(document.getElementById('contentArea'));
}

// ── 学生总库：手机端首字索引侧栏（微信/QQ 风格右侧索引）──
function renderStudentAlphaIndex() {
  let rail = document.getElementById('studentAlphaIndex');
  if (!isMobileUI()) { if (rail) rail.style.display = 'none'; return; }
  let grid = document.getElementById('studentGrid');
  if (!grid) { if (rail) rail.style.display = 'none'; return; }
  const rows = grid.querySelectorAll('[data-initial]');
  const seen = {}, order = [];
  for (let i = 0; i < rows.length; i++) {
    const ch = rows[i].getAttribute('data-initial');
    if (!ch) continue;
    if (!seen[ch]) { seen[ch] = true; order.push(ch); }
  }
  if (!rail) {
    rail = document.createElement('div');
    rail.id = 'studentAlphaIndex';
    const host = document.getElementById('contentArea') || document.body;
    host.appendChild(rail);
  }
  if (order.length === 0) { rail.style.display = 'none'; return; }
  rail.style.display = '';
  rail.innerHTML = order.map(function(ch) {
    return '<div class="alpha-item" data-click="scrollToStudentInitial" data-click-args="' + escapeAttr(JSON.stringify([ch])) + '">' + escapeHtml(ch) + '</div>';
  }).join('');
}
function scrollToStudentInitial(letter) {
  if (!letter) return;
  const grid = document.getElementById('studentGrid');
  if (!grid) return;
  const sel = '[data-initial="' + (window.CSS && CSS.escape ? CSS.escape(letter) : letter) + '"]';
  const target = grid.querySelector(sel);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 学生卡片（手机端）展开/收起 + 全部展开/收起
function studentExpandAllLabel() {
  let set = window._studentExpanded || {};
  let list = filterStudents(state.studentSearchQuery);
  let anyExpanded = list.some(function(s){ return set[s.id]; });
  return anyExpanded ? '⊟ 收起全部' : '⊞ 展开全部';
}
function updateStudentExpandAllLabel() {
  const btn = document.getElementById('studentExpandAllBtn');
  if (btn) btn.textContent = studentExpandAllLabel();
}
function toggleStudentCard(id) {
  let el = this;
  let set = window._studentExpanded || (window._studentExpanded = {});
  if (set[id]) { delete set[id]; if (el) { el.classList.remove('m-expanded'); el.classList.add('m-compact'); } }
  else { set[id] = true; if (el) { el.classList.add('m-expanded'); el.classList.remove('m-compact'); } }
  updateStudentExpandAllLabel();
}
function toggleAllStudentCards() {
  const set = window._studentExpanded || (window._studentExpanded = {});
  let list = filterStudents(state.studentSearchQuery);
  const anyExpanded = list.some(function(s){ return set[s.id]; });
  if (anyExpanded) { list.forEach(function(s){ delete set[s.id]; }); }
  else { list.forEach(function(s){ set[s.id] = true; }); }
  renderStudentGrid(list);
}

function openStudentProfile(id) {
  const s = state.students.find(x => x.id === id);
  if (!s) return;
  const hw = s.homeworkStats;
  const total = hw.excellent + hw.normal + hw.incomplete;
  const exPct = total ? Math.round(hw.excellent/total*100) : 0;
  const noPct = total ? Math.round(hw.normal/total*100) : 0;
  const inPct = total ? Math.round(hw.incomplete/total*100) : 0;
  const currentTags = s.tags || [];
  // 计算两种分层（绕过缓存，直接计算）
  const prevMode = state.layerMode;
  state.layerMode = 'class'; clearLayerCache(); const classLayer = getStudentLayer(s);
  state.layerMode = 'score'; clearLayerCache(); const scoreLayer = getStudentLayer(s);
  state.layerMode = prevMode; clearLayerCache();
  // 检查是否有成绩数据
  const hasScores = state.scores.filter(sc => sc.studentId === s.id).length > 0;
  openModal(`
    <h3>🎓 ${escapeHtml(s.name)} 学情档案卡</h3>
    <div class="profile-detail">
      <div class="profile-section">
        <h4>基本信息（可编辑）</h4>
        <div class="profile-row"><span class="label">姓名</span><input class="form-input profile-edit-input" id="editName" value="${escapeHtml(s.name)}" style="flex:1"></div>
        <div class="profile-row"><span class="label">学号</span><input class="form-input profile-edit-input" id="editStudentNo" value="${escapeHtml(s.studentNo)}" style="flex:1"></div>
        <div class="profile-row"><span class="label">班级</span>
          <select class="form-select" id="editClass" style="flex:1">
            ${getClasses().map(c => `<option value="${c}" ${s.classId===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="profile-row"><span class="label">性别</span>
          <select class="form-select" id="editGender" style="flex:1">
            <option value="男" ${s.gender==='男'?'selected':''}>男</option>
            <option value="女" ${s.gender==='女'?'selected':''}>女</option>
          </select>
        </div>
        <div class="profile-row"><span class="label">分层信息</span>
          <div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${classLayer === null
              ? '<span class="layer-badge none">未分层</span>'
              : '<span class="layer-badge ' + classLayer.toLowerCase() + '">' + classLayer + '层</span>'}
            <span style="font-size:11px;color:let(--text-muted)">班级分层${classLayer === null ? '（暂无数据）' : ' · ' + getClassLayerLabel(classLayer)}</span>
            <span style="color:let(--text-muted);margin:0 2px">|</span>
            ${scoreLayer === null
              ? '<span class="layer-badge none">未分层</span>'
              : '<span class="layer-badge ' + scoreToLayerCSS(scoreLayer) + '">' + scoreLayer + '层</span>'}
            <span style="font-size:11px;color:let(--text-muted)">成绩分层${scoreLayer === null ? '（暂无数据）' : ' · ' + getScoreLayerLabel(scoreLayer)}</span>
          </div>
        </div>
        ${hasScores ? `
        <div class="profile-row"><span class="label">成绩趋势</span>
          <div style="flex:1;display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" data-click="openClassRankTrend" data-click-args="[&quot;${s.id}&quot;]" style="font-size:12px;padding:4px 10px">📊 班级排名趋势</button>
            <button class="btn btn-outline btn-sm" data-click="openGradeRankTrend" data-click-args="[&quot;${s.id}&quot;]" style="font-size:12px;padding:4px 10px">📈 年级排名趋势</button>
          </div>
        </div>` : ''}
        <div class="profile-row"><span class="label">趋势备注</span><input class="form-input profile-edit-input" id="editScoreTrend" value="${escapeHtml(s.scoreTrend||'')}" style="flex:1"></div>
      </div>
      <div class="profile-section">
        <h4>标签库</h4>
        <div id="tagLibrary" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${COMMON_TAGS.map(t => {
            const has = currentTags.includes(t);
            return `<span class="tag ${has?'tag-active':'tag-normal'}" style="cursor:pointer${has?';background:let(--primary);color:#fff':''}" data-click="toggleStudentTag" data-click-args="${escapeAttr(JSON.stringify([s.id, t]))}">${escapeHtml(t)}</span>`;
          }).join('')}
        </div>
        <div style="font-size:12px;color:let(--text-muted);margin-bottom:6px">当前标签：</div>
        <div id="currentTags" style="display:flex;flex-wrap:wrap;gap:6px">
          ${currentTags.map(t => `<span class="tag tag-normal">${escapeHtml(t)} <span style="cursor:pointer;color:let(--danger)" data-click="toggleStudentTag" data-click-args="${escapeAttr(JSON.stringify([s.id, t]))}">✕</span></span>`).join('')}
          ${currentTags.length === 0 ? '<span class="text-muted text-sm">暂无标签</span>' : ''}
        </div>
        <h4 style="margin-top:14px">作业完成统计</h4>
        <div class="hw-stat-row"><span>优秀 (${hw.excellent})</span><div class="hw-stat-bar"><div class="hw-stat-fill" style="width:${exPct}%;background:let(--success)"></div></div><span>${exPct}%</span></div>
        <div class="hw-stat-row"><span>正常完成 (${hw.normal})</span><div class="hw-stat-bar"><div class="hw-stat-fill" style="width:${noPct}%;background:let(--info)"></div></div><span>${noPct}%</span></div>
        <div class="hw-stat-row"><span>未完成或敷衍 (${hw.incomplete})</span><div class="hw-stat-bar"><div class="hw-stat-fill" style="width:${inPct}%;background:let(--danger)"></div></div><span>${inPct}%</span></div>
      </div>
    </div>
    <div class="profile-section" style="margin-top:14px">
      <h4>教师描述</h4>
      <textarea class="form-textarea" id="editTeacherNote" placeholder="输入学生描述...">${escapeHtml(s.teacherNote || '')}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" data-click="__dcDelStudentCloseRender" data-click-args="${escapeAttr(JSON.stringify([s.id]))}">🗑️ 删除学生</button>
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveStudentProfile" data-click-args="[&quot;${s.id}&quot;]">保存修改</button>
    </div>
  `);
}

function toggleStudentTag(studentId, tag) {
  const s = state.students.find(x => x.id === studentId);
  if (!s) return;
  if (!s.tags) s.tags = [];
  const idx = s.tags.indexOf(tag);
  if (idx >= 0) s.tags.splice(idx, 1);
  else s.tags.push(tag);
  saveState();
  openStudentProfile(studentId);
}

function saveStudentProfile(id) {
  const s = state.students.find(x => x.id === id);
  if (!s) return;
  saveState({pushUndo:true});
  s.name = document.getElementById('editName').value.trim() || s.name;
  s.studentNo = document.getElementById('editStudentNo').value.trim() || s.studentNo;
  s.classId = document.getElementById('editClass').value;
  s.gender = document.getElementById('editGender').value;
  s.scoreTrend = document.getElementById('editScoreTrend').value.trim();
  s.teacherNote = document.getElementById('editTeacherNote').value.trim();
  saveState();
  closeModal();
  showToast('档案已保存');
  renderStudents(document.getElementById('contentArea'));
}

function downloadStudentTemplate() {
  const csv = '\ufeff学号,姓名,性别,班级,分层(A/B/C/D),成绩趋势,标签(用/分隔),作业优秀次数,作业正常次数,作业未完成次数,教师描述\n1001,张三,男,1班,A,稳步提升,积极举手/作业认真,5,3,0,学习态度端正\n1002,李四,女,1班,B,小幅度进步,需督促,2,5,1,需加强课后复习\n';
  downloadFile(csv, '学生档案模板.csv', 'text/csv');
}

function handleStudentUpload(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\ufeff/, '');
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showToast('文件内容为空或格式不对', 'error'); return; }
    const headers = lines[0].split(',').map(h => h.trim());
    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (!cols[1]) continue;
      const tags = (cols[6] || '').split('/').filter(t => t);
      const existing = state.students.find(s => s.studentNo === cols[0]);
      const data = {
        studentNo: cols[0],
        name: cols[1],
        gender: cols[2] || '男',
        classId: cols[3] || '1班',
        layer: cols[4] || 'B',
        scoreTrend: cols[5] || '保持稳定',
        tags,
        homeworkStats: {
          excellent: parseInt(cols[7] || 0),
          normal: parseInt(cols[8] || 0),
          incomplete: parseInt(cols[9] || 0)
        },
        teacherNote: cols[10] || ''
      };
      if (existing) {
        Object.assign(existing, data);
      } else {
        state.students.push({ id: uid(), ...data });
        added++;
      }
    }
    saveState();
    showToast(`已导入 ${added} 名学生，更新现有档案`);
    renderStudents(document.getElementById('contentArea'));
  };
  reader.readAsText(file, 'UTF-8');
}

/* ===================== 06 Student Tasks ===================== */
function renderStudentTasks(container) {
  const tabs = [
    { key:'st-task-info', label:'📝 任务信息' },
    { key:'st-random', label:'🎲 随机抽查' },
    { key:'st-homework', label:'📋 作业登记' },
    { key:'st-chat', label:'💬 聊天框' }
  ];
  const current = state.currentPage;
  container.innerHTML = `
    <div class="view-tabs">
      ${tabs.map(t => `<div class="view-tab ${current===t.key?'active':''}" data-click="switchStudentTaskView" data-click-args="[&quot;${t.key}&quot;]">${t.label}</div>`).join('')}
    </div>
    <div id="studentTaskContainer"></div>
  `;
  const vc = document.getElementById('studentTaskContainer');
  if (current === 'st-task-info') renderTaskInfo(vc);
  else if (current === 'st-random') renderRandomCheck(vc);
  else if (current === 'st-homework') renderHomeworkRegister(vc);
  else if (current === 'st-chat') renderChat(vc);
}

function switchStudentTaskView(view) {
  state.currentPage = view;
  state.currentStudentTaskView = view;
  // navigateTo 内部已调用 saveState()，无需重复保存
  navigateTo(view);
}

/* ---- 06-1 Task Info ---- */
function renderTaskInfo(container) {
  const showArchived = state._showArchivedTasks === true;
  const archivedCount = state.studentTasks.filter(t => t.archived === true).length;
  container.innerHTML = `
    <div class="toolbar">
      <div class="text-muted text-sm">点击任务展开/折叠答案，支持直接新建和编辑。标记「完成」的任务进入历史作业，作业登记数据完整保留。</div>
      <div class="flex-between gap-8">
        <button class="btn btn-outline" data-click="${showArchived ? 'toggleShowArchivedTasks' : 'toggleShowArchivedTasks'}" style="${showArchived ? 'border-color:let(--success);color:let(--success)' : ''}">${showArchived ? '↩ 返回活动任务' : `📦 历史作业${archivedCount ? ' (' + archivedCount + ')' : ''}`}</button>
        <div class="flex-between gap-8">
          <button class="btn btn-outline" data-click="downloadTaskInfoTemplate">⬇️ 模板</button>
          <button class="btn btn-outline" data-click="__dcClickEl" data-click-args="[&quot;taskInfoUpload&quot;]">📤 上传</button>
          <button class="btn btn-primary" data-click="openTaskInfoEditModal">+ 新建任务</button>
          <input type="file" id="taskInfoUpload" accept=".csv" style="display:none" data-ev="change" data-ev-key="ev29">
        </div>
      </div>
    </div>
    <div class="flex-between gap-8" style="margin:10px 0 12px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="text-sm text-muted">📚 按班级筛选：</span>
        <select class="form-select" id="taskInfoClassFilter" data-ev="change" data-ev-key="ev72" style="width:140px">
          <option value="" ${!state.currentTaskClass ? 'selected' : ''}>全部班级</option>
          ${getClasses().map(c => `<option value="${escapeAttr(c)}" ${state.currentTaskClass===c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <span class="text-sm text-muted" id="taskInfoClassHint">${state.currentTaskClass ? '当前仅显示 ' + escapeHtml(state.currentTaskClass) + '（含跨班任务 🌐）' : '当前显示全部班级'}</span>
    </div>
    <div id="taskInfoList"></div>
  `;
  renderTaskInfoList();
}

// 切换「查看历史作业」/「返回活动任务」
function toggleShowArchivedTasks() {
  state._showArchivedTasks = !(state._showArchivedTasks === true);
  saveState();
  renderPage();
}

// 任务信息按班级筛选切换（与聊天框的 switchChatClass 一致：全部班级 + 各班，跨班任务在各相关班级均出现）
// 接受 value：'' / '__all__' / null → 全部；'1班'/'2班'/... → 具体班级
function switchTaskClass(cls) {
  if (cls === '' || cls === null || cls === undefined || cls === '__all__') {
    state.currentTaskClass = null;
  } else {
    state.currentTaskClass = cls;
  }
  saveState();
  const container = document.getElementById('studentTaskContainer');
  if (container) renderTaskInfo(container);
  else renderPage();
}

// 标记任务完成（归档为历史作业，保留作业登记数据）
function archiveStudentTask(id) {
  const t = state.studentTasks.find(x => x.id === id);
  if (!t) return;
  t.archived = true;
  saveState();
  showToast(`已归档为历史作业：${t.title}`);
  renderTaskInfoList();
}

// 撤销完成（从历史作业恢复到活动任务）
function unarchiveStudentTask(id) {
  const t = state.studentTasks.find(x => x.id === id);
  if (!t) return;
  t.archived = false;
  saveState();
  showToast(`已恢复为活动任务：${t.title}`);
  renderTaskInfoList();
}

function renderTaskInfoList() {
  const el = document.getElementById('taskInfoList');
  if (!el) return;
  if (state.studentTasks.length === 0) {
    el.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>暂无作业任务，点击「新建任务」添加</div>';
    return;
  }
  const showArchived = state._showArchivedTasks === true;
  const curClass = state.currentTaskClass;
  const list = state.studentTasks.filter(t => {
    if (showArchived ? (t.archived !== true) : (t.archived === true)) return false;
    if (curClass && !isTaskForClass(t, curClass)) return false;
    return true;
  });
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">${showArchived ? '📦' : '📭'}</span>${showArchived ? '暂无历史作业' : '暂无活动作业任务，点击「新建任务」添加'}</div>`;
    return;
  }
  el.innerHTML = list.map(t => {
    const images = t.answerImages || [];
    const hasAnswer = (t.answer && t.answer.trim()) || images.length > 0;
    const crossClass = getTaskClassIds(t).length > 1;
    const actionBtns = showArchived
      ? `<button class="btn-icon" data-click="unarchiveStudentTask" data-click-args="${escapeAttr(JSON.stringify([t.id]))}" title="恢复为活动任务">↩️</button>`
      : `<button class="btn-icon" data-click="archiveStudentTask" data-click-args="${escapeAttr(JSON.stringify([t.id]))}" title="标记为完成（归档）">✅</button>`;
    return `
    <div class="plan-item ${showArchived ? 'plan-item-archived' : ''}" style="cursor:pointer" data-click="toggleTaskAnswer" data-click-args="[&quot;${t.id}&quot;]">
      <div class="plan-item-info">
        <div class="plan-item-name">${escapeHtml(t.title)} ${hasAnswer?'<span style="font-size:11px;color:let(--danger)">🔑 含答案</span>':'<span style="font-size:11px;color:let(--text-muted)">无答案</span>'}${showArchived?' <span style="font-size:11px;color:let(--text-muted)">· 历史作业</span>':''}${crossClass?' <span class="cc-tag">🌐跨班</span>':''}</div>
        <div class="plan-item-meta">班级：${escapeHtml(getTaskClassIds(t).join('、'))} | 布置日期：${escapeHtml(t.assignedDate)} | 截止日期：${escapeHtml(t.dueDate||'未设')}</div>
        <div class="plan-item-meta">作业内容：${escapeHtml(t.content)}</div>
        <div id="answer-${t.id}" class="text-sm" style="display:none;margin-top:8px;padding:12px;background:let(--bg-app);border-radius:let(--radius-sm);border:1px solid let(--border)">
          ${t.answer ? `<div style="color:let(--danger);font-weight:500;margin-bottom:${images.length>0?'8px':'0'}">🔑 答案：${escapeHtml(t.answer)}</div>` : ''}
          ${images.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${images.map((img,i) => `<img src="${safeImageSrc(img)}" alt="示意图${i+1}" style="max-width:200px;max-height:150px;border-radius:6px;border:1px solid let(--border)" data-click="__noop">`).join('')}</div>` : ''}
          ${!hasAnswer ? '<span class="text-muted">暂无答案</span>' : ''}
        </div>
      </div>
      <div style="white-space:nowrap;display:flex;gap:4px">
        <button class="btn-icon" data-click="__dcStopOpenTaskInfo" data-click-args="${escapeAttr(JSON.stringify([t.id]))}" title="编辑">✏️</button>
        ${actionBtns}
        ${showArchived ? '' : `<button class="btn-icon" data-click="__dcStopDelStudentTask" data-click-args="${escapeAttr(JSON.stringify([t.id]))}" title="删除">🗑️</button>`}
      </div>
    </div>`;
  }).join('');
}

function toggleTaskAnswer(id) {
  const el = document.getElementById('answer-' + id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function openTaskInfoEditModal(id) {
  const t = id ? state.studentTasks.find(x => x.id === id) : null;
  if (!t) _pendingTaskImages = []; // 新建任务时清空待上传图片，防止上次残留
  const images = t ? (t.answerImages || []) : [];
  const taskClasses = t ? getTaskClassIds(t) : (state.currentTaskClass ? [state.currentTaskClass] : []);
  openModal(`
    <h3>${t?'编辑作业任务':'新建作业任务'}</h3>
    <div class="form-group">
      <label class="form-label">作业名称 *</label>
      <input class="form-input" id="tiTitle" value="${t?escapeHtml(t.title):''}" placeholder="如：第一章课后练习">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">布置日期</label>
        <input type="date" class="form-input" id="tiAssigned" value="${t?t.assignedDate:new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input type="date" class="form-input" id="tiDue" value="${t?(t.dueDate||''):''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">对应班级（可多选）</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:let(--bg-app);border-radius:let(--radius-sm)">
        ${getClasses().map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px">
          <input type="checkbox" class="ti-class-cb" value="${c}" ${taskClasses.includes(c)?'checked':''}>
          <span>${c}</span>
        </label>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">作业内容</label>
      <textarea class="form-textarea" id="tiContent" placeholder="作业内容描述...">${t?escapeHtml(t.content||''):''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">答案（文字）</label>
      <textarea class="form-textarea" id="tiAnswer" placeholder="输入答案文字，如：1.B 2.C 3.A...">${t?escapeHtml(t.answer||''):''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">生物示意图（可多图上传）</label>
      <input type="file" accept="image/*" multiple data-ev="change" data-ev-key="ev30" data-ev-args="${escapeAttr(JSON.stringify([t ? t.id : 'null']))}">
      <div id="taskImagePreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        ${images.map((img,i) => `<div style="position:relative"><img src="${safeImageSrc(img)}" style="max-width:120px;max-height:100px;border-radius:6px;border:1px solid let(--border)"><span style="position:absolute;top:-4px;right:-4px;background:let(--danger);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer" data-click="removeTaskImage" data-click-args="${escapeAttr(JSON.stringify([t ? t.id : 'null', i]))}">✕</span></div>`).join('')}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveTaskInfo" data-click-args="${escapeAttr(JSON.stringify([t ? t.id : 'null']))}">保存</button>
    </div>
  `);
}

let _pendingTaskImages = [];

function handleTaskImageUpload(event, taskId) {
  const files = Array.from(event.target.files);
  if (taskId && taskId !== 'null') {
    const t = state.studentTasks.find(x => x.id === taskId);
    if (!t) return;
    if (!t.answerImages) t.answerImages = [];
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = function(e) {
        t.answerImages.push(e.target.result);
        openTaskInfoEditModal(taskId);
      };
      reader.readAsDataURL(f);
    });
  } else {
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = function(e) {
        _pendingTaskImages.push(e.target.result);
        const prev = document.getElementById('taskImagePreview');
        if (prev) prev.innerHTML += `<div><img src="${safeImageSrc(e.target.result)}" style="max-width:120px;max-height:100px;border-radius:6px;border:1px solid let(--border)"></div>`;
      };
      reader.readAsDataURL(f);
    });
  }
}

function removeTaskImage(taskId, index) {
  if (!taskId || taskId === 'null') { _pendingTaskImages.splice(index, 1); openTaskInfoEditModal(null); return; }
  const t = state.studentTasks.find(x => x.id === taskId);
  if (t && t.answerImages) { t.answerImages.splice(index, 1); openTaskInfoEditModal(taskId); }
}

function saveTaskInfo(id) {
  const title = document.getElementById('tiTitle').value.trim();
  if (!title) { showToast('请输入作业名称', 'warn'); return; }
  const classIds = Array.from(document.querySelectorAll('.ti-class-cb:checked')).map(cb => cb.value);
  if (classIds.length === 0) { showToast('请至少选择一个班级', 'warn'); return; }
  const data = {
    title,
    assignedDate: document.getElementById('tiAssigned').value,
    dueDate: document.getElementById('tiDue').value,
    classIds,
    classId: classIds[0], // backward compat
    content: document.getElementById('tiContent').value.trim(),
    answer: document.getElementById('tiAnswer').value.trim()
  };
  saveState({pushUndo:true});
  if (id && id !== 'null') {
    const t = state.studentTasks.find(x => x.id === id);
    if (t) { Object.assign(t, data); if (!t.answerImages) t.answerImages = []; }
  } else {
    const newTask = { id: uid(), ...data, answerImages: [..._pendingTaskImages] };
    state.studentTasks.push(newTask);
    _pendingTaskImages = [];
  }
  saveState();
  closeModal();
  showToast(id ? '任务已更新' : '任务已创建');
  renderTaskInfoList();
}

async function deleteStudentTask(id) {
  const t = state.studentTasks.find(x => x.id === id);
  if (!t) return;
  const related = state.homeworkRecords.filter(r => r.taskId === id);
  if (related.length > 0) {
    const choice = await showTaskDeleteChoiceModal(t, related.length);
    if (choice === 'cancel') return;
    saveState({pushUndo:true});
    state.studentTasks = state.studentTasks.filter(x => x.id !== id);
    if (choice === 'deleteRecords') {
      state.homeworkRecords = state.homeworkRecords.filter(r => r.taskId !== id);
    }
  } else {
    if (!(await appConfirm(`确认删除作业任务「${t.title}」？该任务下暂无作业登记数据。`, {danger:true}))) return;
    saveState({pushUndo:true});
    state.studentTasks = state.studentTasks.filter(x => x.id !== id);
  }
  saveState();
  showToast('作业任务已删除');
  renderTaskInfoList();
}

// 删除任务时，选择是否一并删除关联作业登记数据
let _taskDeleteResolver = null;
function showTaskDeleteChoiceModal(task, count) {
  return new Promise(resolve => {
    _taskDeleteResolver = resolve;
    openModal(`
      <h3>删除作业任务：「${escapeHtml(task.title)}」</h3>
      <p style="margin:8px 0;color:let(--text-muted);line-height:1.6">该任务下共有 <b style="color:let(--danger)">${count}</b> 条作业登记数据。删除任务时如何处理这些登记数据？</p>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="resolveTaskDelete" data-click-args="[&quot;cancel&quot;]">取消</button>
        <button class="btn" style="background:let(--warning);color:#fff" data-click="resolveTaskDelete" data-click-args="[&quot;keepRecords&quot;]">仅删任务 · 保留登记</button>
        <button class="btn btn-danger" data-click="resolveTaskDelete" data-click-args="[&quot;deleteRecords&quot;]">一并删除登记</button>
      </div>
    `);
  });
}
function resolveTaskDelete(choice) {
  const r = _taskDeleteResolver;
  _taskDeleteResolver = null;
  closeModal();
  if (r) r(choice);
}

// Helper: get task's class list (supports both old classId string and new classIds array)
function getTaskClassIds(task) {
  if (task.classIds && Array.isArray(task.classIds) && task.classIds.length > 0) return task.classIds;
  if (task.classId) return [task.classId];
  return [];
}

function isTaskForClass(task, cls) {
  return getTaskClassIds(task).includes(cls);
}

function downloadTaskInfoTemplate() {
  const csv = '\ufeff任务标题,作业内容,答案,布置日期,截止日期,班级\n'
    + '第一章课后练习,完成课本P15-16练习1-5题,1.B 2.C,2026-09-01,2026-09-03,1班\n'
    + '细胞结构观察,画动物细胞和植物细胞结构图并标注,,2026-09-05,2026-09-08,1班、4班\n'
    + '注意：班级列支持多个班级，用顿号(、)、逗号(,)或空格分隔。如：1班、4班、8班\n';
  downloadFile(csv, '学生作业任务模板.csv', 'text/csv');
}

function parseClassIdsFromClassField(raw) {
  if (!raw) return ['1班'];
  // 按顿号、逗号、空格、分号分割
  const parts = raw.split(/[、,，;；\s]+/).map(s => s.trim()).filter(s => s);
  if (parts.length === 0) return ['1班'];
  // 过滤无效班级名（必须以"班"结尾或匹配班级列表）
  const valid = getClasses();
  const result = parts.filter(p => valid.includes(p));
  return result.length > 0 ? result : parts;
}

function handleTaskInfoUpload(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\ufeff/, '');
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showToast('文件格式不对', 'error'); return; }
    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      // 跳过注释行（以"注意"开头）
      if (lines[i].trim().startsWith('注意')) continue;
      const cols = lines[i].split(',').map(c => c.trim());
      if (!cols[0]) continue;
      const classIds = parseClassIdsFromClassField(cols[5]);
      state.studentTasks.push({
        id: uid(),
        title: cols[0],
        content: cols[1] || '',
        answer: cols[2] || '',
        assignedDate: cols[3] || new Date().toISOString().slice(0,10),
        dueDate: cols[4] || '',
        classId: classIds[0],
        classIds: classIds
      });
      added++;
    }
    saveState();
    showToast(`已导入 ${added} 个作业任务`);
    renderTaskInfoList();
  };
  reader.readAsText(file, 'UTF-8');
}

/* ---- 06-2 Random Check ---- */
function renderRandomCheck(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div class="text-muted text-sm">按学生分层随机抽取：A层5人、B层5人、C+D层5人，共15人</div>
      <div class="flex-between gap-8">
        <select class="form-select" id="randomClassFilter" style="width:120px">
          <option value="">全部班级</option>
          ${getClasses().map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <button class="btn btn-primary" data-click="doRandomPick">🎲 开始随机抽查</button>
      </div>
    </div>
    <div id="randomResult"></div>
  `;
  if (state._lastRandomPick) renderRandomResult(state._lastRandomPick);
}

function doRandomPick() {
  const classFilter = document.getElementById('randomClassFilter').value;
  let pool = state.students;
  if (classFilter) pool = pool.filter(s => s.classId === classFilter);
  const aPool = pool.filter(s => getClassLayer(s) === 'A');
  const bPool = pool.filter(s => getClassLayer(s) === 'B');
  const cdPool = pool.filter(s => getClassLayer(s) === 'C' || getClassLayer(s) === 'D');
  const a = shuffle(aPool).slice(0, 5);
  const b = shuffle(bPool).slice(0, 5);
  const cd = shuffle(cdPool).slice(0, 5);
  // 剩余未被选中的学生（展示全部学生都纳入候选池）
  const pickedIds = new Set([...a, ...b, ...cd].map(s => s.id));
  const unpicked = pool.filter(s => !pickedIds.has(s.id));
  const result = {
    a, b, cd, unpicked, classFilter,
    totalCount: pool.length,
    aPoolCount: aPool.length, bPoolCount: bPool.length, cdPoolCount: cdPool.length
  };
  state._lastRandomPick = result;
  saveState();
  renderRandomResult(result);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderRandomResult(result) {
  const el = document.getElementById('randomResult');
  if (!el) return;
  // 兼容旧版结果格式
  result.totalCount = result.totalCount || result.a.length + result.b.length + result.cd.length;
  result.aPoolCount = result.aPoolCount !== undefined ? result.aPoolCount : result.a.length;
  result.bPoolCount = result.bPoolCount !== undefined ? result.bPoolCount : result.b.length;
  result.cdPoolCount = result.cdPoolCount !== undefined ? result.cdPoolCount : result.cd.length;
  const col = (title, list, color) => `
    <div class="random-column">
      <h4><span style="color:${color}">●</span> ${title} <span class="text-muted text-sm">(${list.length}人)</span></h4>
      ${list.map((s, i) => `
        <div class="random-pick-item">
          <span class="random-pick-index">${i+1}.</span>
          <span class="random-pick-name">${escapeHtml(s.name)}</span>
          <span class="random-pick-no">${escapeHtml(s.studentNo || '-')}</span>
          <span class="random-pick-class">${escapeHtml(s.classId)}</span>
          <span class="layer-badge ${getClassLayer(s).toLowerCase()}">${getClassLayer(s)}</span>
        </div>
      `).join('')}
      ${list.length === 0 ? '<div class="text-muted text-sm">该分层无学生</div>' : ''}
    </div>
  `;
  el.innerHTML = `
    <div style="margin-bottom:8px;font-size:13px;color:let(--text-muted)">
      ${result.classFilter ? '班级：' + escapeHtml(result.classFilter) : '全部班级'} · 候选池共 <strong>${result.totalCount}</strong> 人（A层${result.aPoolCount} / B层${result.bPoolCount} / C+D层${result.cdPoolCount}）
    </div>
    <div class="random-result-grid">
      ${col('A层', result.a, 'let(--success)')}
      ${col('B层', result.b, 'let(--info)')}
      ${col('C+D层', result.cd, 'let(--warning)')}
    </div>
    ${result.unpicked && result.unpicked.length > 0 ? `
    <div style="margin-top:12px;padding:8px 12px;background:let(--bg-hover);border-radius:let(--radius-sm);font-size:12px;color:let(--text-muted)">
      <span style="font-weight:600">未选中：</span>${result.unpicked.map(s => `<span style="display:inline-block;margin:2px 4px;padding:1px 6px;background:let(--bg);border-radius:4px">${escapeHtml(s.name)}<span style="color:let(--text-muted)"> ${escapeHtml(s.classId)}</span></span>`).join('')}
    </div>` : ''}
  `;
}

/* ---- 06-3 Homework Register ---- */
const homeworkSelection = new Set();

// 防抖版作业表渲染
const _debouncedRenderHomeworkTable = debounce(renderHomeworkTable);

function renderHomeworkRegister(container) {
  ensureAllHomeworkRecords();
  const tasks = state.studentTasks;
  const taskOptions = tasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)} (${escapeHtml(getTaskClassIds(t).join('、'))})</option>`).join('');
  container.innerHTML = `
    <div class="toolbar">
      <div class="search-bar" style="flex:1;margin-bottom:0">
        <input type="text" class="search-input" id="hwSearch" placeholder="学号/姓名检索..." style="max-width:220px" data-ev="input" data-ev-key="ev31">
        <select class="form-select" id="hwClassFilter" style="width:120px" data-ev="change" data-ev-key="ev32">
          <option value="">全部班级</option>
          ${getClasses().map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="form-select" id="hwTaskFilter" style="width:240px" data-ev="change" data-ev-key="ev33">
          <option value="">全部任务</option>
          ${taskOptions}
        </select>
        <select class="form-select" id="hwStatusFilter" style="width:120px" data-ev="change" data-ev-key="ev34">
          <option value="">全部状态</option>
          <option value="excellent">优秀完成</option>
          <option value="normal">正常完成</option>
          <option value="resubmitted">已补交</option>
          <option value="pending">待标记</option>
          <option value="incomplete">未上交</option>
          <option value="perfunctory">敷衍完成</option>
        </select>
      </div>
      <div class="flex-between gap-8">
        <button class="btn btn-outline" data-click="selectAllHw" data-click-args="[true]">全选</button>
        <button class="btn btn-outline" data-click="selectAllHw" data-click-args="[false]">反选</button>
        <button class="btn btn-outline" data-click="openBatchHwModal">批量标记</button>
        <button class="btn btn-outline" data-click="clearHwReview">🧹 清空批阅</button>
        <button class="btn btn-primary" data-click="saveAllHomework">💾 保存全部</button>
      </div>
    </div>
    <div style="margin-bottom:8px;font-size:12px;color:let(--text-muted);display:flex;justify-content:space-between">
      <span id="hwSelectedCount">已选择 0 人</span>
      <span id="hwPendingCount"></span>
    </div>
    <table class="hw-table">
      <thead><tr>
        <th style="width:30px"><input type="checkbox" id="hwSelectAll" data-ev="change" data-ev-key="ev35"></th>
        <th>学号</th><th>姓名</th><th>班级</th><th>分层</th><th>任务</th><th>状态</th><th>批阅</th>
      </tr></thead>
      <tbody id="hwBody"></tbody>
    </table>
    <div class="review-area" id="batchReviewArea">
      <h4>📝 批量批阅</h4>
      <textarea class="reflection-textarea" id="batchReviewText" placeholder="输入批阅评语，将应用到所有已选学生..."></textarea>
      <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-outline" data-click="__dcClassRemove" data-click-args="[&quot;batchReviewArea&quot;, &quot;show&quot;]">取消</button>
        <button class="btn btn-primary" data-click="saveBatchReview">保存批阅</button>
      </div>
    </div>
  `;
  renderHomeworkTable();
}

// When task is selected, auto-filter by that task's classes and ensure records exist
function onHwTaskFilterChange() {
  const taskId = document.getElementById('hwTaskFilter')?.value || '';
  if (taskId) {
    const task = state.studentTasks.find(t => t.id === taskId);
    if (task) {
      const taskClasses = getTaskClassIds(task);
      // Auto-set class filter if task has only one class, otherwise show all task classes
      const classFilter = document.getElementById('hwClassFilter');
      if (classFilter && taskClasses.length === 1) {
        classFilter.value = taskClasses[0];
      }
      // Ensure homework records exist for all students in this task's classes
      ensureHomeworkRecords(task);
    }
  }
  renderHomeworkTable();
}

function onHwClassFilterChange() {
  renderHomeworkTable();
}

// Ensure a single student has homework records for all matching tasks
function ensureHomeworkRecordsForStudent(student) {
  let created = false;
  state.studentTasks.forEach(task => {
    const taskClasses = getTaskClassIds(task);
    if (!taskClasses.includes(student.classId)) return;
    const exists = state.homeworkRecords.find(r => r.studentId === student.id && r.taskId === task.id);
    if (!exists) {
      state.homeworkRecords.push({
        id: 'hr' + Date.now() + Math.random().toString(36).slice(2, 6),
        studentId: student.id,
        studentNo: student.studentNo,
        name: student.name,
        classId: student.classId,
        taskId: task.id,
        taskTitle: task.title,
        status: 'pending',
        review: ''
      });
      created = true;
    }
  });
  if (created) saveState();
}

// Ensure all students have homework records for all applicable tasks
function ensureAllHomeworkRecords() {
  // 先清理可能存在的重复记录（同一学生同一任务多条），保留最新一条
  if (cleanupDuplicateHomeworkRecords()) saveState();
  let created = false;
  state.studentTasks.forEach(task => {
    const taskClasses = getTaskClassIds(task);
    taskClasses.forEach(cls => {
      const classStudents = state.students.filter(s => s.classId === cls);
      classStudents.forEach(s => {
        const exists = state.homeworkRecords.find(r => r.studentId === s.id && r.taskId === task.id);
        if (!exists) {
          state.homeworkRecords.push({
            id: 'hr' + Date.now() + Math.random().toString(36).slice(2, 6),
            studentId: s.id,
            studentNo: s.studentNo,
            name: s.name,
            classId: s.classId,
            taskId: task.id,
            taskTitle: task.title,
            status: 'pending',
            review: ''
          });
          created = true;
        }
      });
    });
  });
  if (created) saveState();
}

// Auto-create homework records for students who don't have one for this task
function ensureHomeworkRecords(task) {
  const taskClasses = getTaskClassIds(task);
  let created = false;
  taskClasses.forEach(cls => {
    const classStudents = state.students.filter(s => s.classId === cls);
    classStudents.forEach(s => {
      const exists = state.homeworkRecords.find(r => r.studentId === s.id && r.taskId === task.id);
      if (!exists) {
        state.homeworkRecords.push({
          id: 'hr' + Date.now() + Math.random().toString(36).slice(2,6),
          studentId: s.id,
          studentNo: s.studentNo,
          name: s.name,
          classId: s.classId,
          taskId: task.id,
          taskTitle: task.title,
          status: 'pending',
          review: ''
        });
        created = true;
      }
    });
  });
  // 仅在实际创建了新记录时才触发防抖保存，避免无谓的全量序列化
  if (created) saveState();
}

// 按 studentId + taskId 去重，保留最新一条（数组中靠后的覆盖前面的）
function dedupeHomeworkRecords(arr) {
  const map = new Map();
  arr.forEach(r => {
    const key = r.studentId + '::' + r.taskId;
    map.set(key, r); // 后出现的覆盖前面，保留最新
  });
  return Array.from(map.values());
}

// 清理 state.homeworkRecords 中的重复项（保留最新），返回是否发生了去重
function cleanupDuplicateHomeworkRecords() {
  if (!state.homeworkRecords || state.homeworkRecords.length === 0) return false;
  const before = state.homeworkRecords.length;
  state.homeworkRecords = dedupeHomeworkRecords(state.homeworkRecords);
  return state.homeworkRecords.length !== before;
}

function getFilteredHomeworkRecords() {
  const search = document.getElementById('hwSearch')?.value.toLowerCase() || '';
  const cls = document.getElementById('hwClassFilter')?.value || '';
  const taskId = document.getElementById('hwTaskFilter')?.value || '';
  const layer = document.getElementById('hwLayerFilter')?.value || '';
  const status = document.getElementById('hwStatusFilter')?.value || '';
  const filtered = state.homeworkRecords.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search) || r.studentNo.includes(search);
    const matchClass = !cls || r.classId === cls;
    let matchTask = !taskId || r.taskId === taskId;
    // If task selected but no class filter, also filter by task's classes
    if (taskId && !cls) {
      const task = state.studentTasks.find(t => t.id === taskId);
      if (task) {
        const taskClasses = getTaskClassIds(task);
        matchTask = r.taskId === taskId && taskClasses.includes(r.classId);
      }
    }
    let matchLayer = true;
    if (layer) {
      const s = state.students.find(st => st.id === r.studentId);
      matchLayer = s && getClassLayer(s) === layer;
    }
    const matchStatus = !status || r.status === status;
    return matchSearch && matchClass && matchTask && matchLayer && matchStatus;
  });
  // 防御性去重：同一学生同一任务只显示一条
  return dedupeHomeworkRecords(filtered);
}

function renderHomeworkTable() {
  const tbody = document.getElementById('hwBody');
  if (!tbody) return;
  const records = getFilteredHomeworkRecords();
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><span class="emoji">📭</span>无匹配记录</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r => {
    let reviewCell = '';
    if (isReviewHidden(r.status)) {
      reviewCell = '<span class="text-sm text-muted">—</span>';
    } else if (isReviewLocked(r.status)) {
      reviewCell = '<span style="color:#C62828;font-size:12px;font-weight:600">🔒 未处理</span>';
    } else if (r.reviewStatus === 'reviewed') {
      reviewCell = `<span style="color:#00695C;font-size:12px;font-weight:600">✅ 已处理</span> <button class="btn-icon" data-click="openHwReviewModal" data-click-args="[&quot;${r.id}&quot;]">✏️</button>`;
    } else {
      reviewCell = `<button class="btn-icon" data-click="openHwReviewModal" data-click-args="[&quot;${r.id}&quot;]">✏️</button> <span class="text-sm text-muted">${escapeHtml(r.review || '待批改')}</span>`;
    }
    return `
    <tr class="hw-row hw-row-${r.status}">
      <td><input type="checkbox" class="checkbox-box hw-check" data-id="${r.id}" ${homeworkSelection.has(r.id)?'checked':''} data-ev="change" data-ev-key="ev36" data-ev-args="${escapeAttr(JSON.stringify([r.id]))}"></td>
      <td>${escapeHtml(r.studentNo)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.classId)}</td>
      <td>${getStudentLayerCell(r.studentId)}</td>
      <td>${escapeHtml(r.taskTitle)}</td>
      <td style="cursor:pointer" data-click="openHwStatusPicker" data-click-args="[&quot;${r.id}&quot;]" title="点击重新标记">${hwStatusBadge(r.status)}</td>
      <td>${reviewCell}</td>
    </tr>
  `}).join('');
  // 更新状态统计图例
  const statusCounts = { excellent:0, normal:0, incomplete:0, perfunctory:0, resubmitted:0, pending:0 };
  records.forEach(r => { if (statusCounts[r.status] !== undefined) statusCounts[r.status]++; });
  const legendEl = document.getElementById('hwPendingCount');
  if (legendEl) {
    const parts = [
      statusCounts.excellent ? `<span style="color:#2E7D32">优${statusCounts.excellent}</span>` : '',
      statusCounts.normal ? `<span style="color:#1565C0">完${statusCounts.normal}</span>` : '',
      statusCounts.incomplete ? `<span style="color:#C62828;font-weight:600">未交${statusCounts.incomplete}</span>` : '',
      statusCounts.perfunctory ? `<span style="color:#E65100">敷衍${statusCounts.perfunctory}</span>` : '',
      statusCounts.resubmitted ? `<span style="color:#6A1B9A">补交${statusCounts.resubmitted}</span>` : '',
      statusCounts.pending ? `<span style="color:#546E7A">待标记${statusCounts.pending}</span>` : '',
    ].filter(Boolean).join(' | ');
    legendEl.innerHTML = parts || '暂无记录';
  }
  updateHwSelectionUI();
}

function getStudentLayerCell(studentId) {
  const s = state.students.find(st => st.id === studentId);
  const layer = s ? getClassLayer(s) : '';
  return layer ? '<span class="layer-badge ' + layer.toLowerCase() + '">' + layer + '层</span>' : '<span class="text-muted">-</span>';
}

// 强制按班级排名计算分层（用于随机抽查、作业登记）
function getClassLayer(student) {
  // 根据最新考试班级排名计算 A/B/C/D
  const studentScores = state.scores
    .filter(s => s.studentId === student.id && s.classRank)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return studentScores.length > 0
    ? rankToLayer(studentScores[0].classRank)
    : (student.layer || 'D');
}

function getClassLayerCell(studentId) {
  const s = state.students.find(st => st.id === studentId);
  const layer = s ? getClassLayer(s) : '';
  return layer ? '<span class="layer-badge ' + layer.toLowerCase() + '">' + layer + '层</span>' : '<span class="text-muted">-</span>';
}

function openHwStatusPicker(id) {
  const r = state.homeworkRecords.find(x => x.id === id);
  if (!r) return;
  const map = {
    pending: { cls:'hw-status-pending', label:'待标记' },
    excellent: { cls:'hw-status-excellent', label:'优秀作业' },
    normal: { cls:'hw-status-normal', label:'正常完成' },
    incomplete: { cls:'hw-status-incomplete', label:'未上交' },
    perfunctory: { cls:'hw-status-perfunctory', label:'敷衍完成' },
    resubmitted: { cls:'hw-status-resubmitted', label:'已补交' }
  };
  const buttons = Object.entries(map).map(([key, s]) => {
    const isCurrent = r.status === key;
    return '<button class="btn ' + (isCurrent ? 'btn-primary' : 'btn-outline') + '" style="min-width:90px;margin:4px" data-click="__dcSetHwStatusClose" data-click-args="' + escapeAttr(JSON.stringify(['' + id + '', '' + key + ''])) + '">' + (isCurrent ? '✓ ' : '') + s.label + '</button>';
  }).join('');
  openModal(
    '<h3>重新标记 ' + escapeHtml(r.name) + ' 的作业状态</h3>' +
    '<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:16px 0">' + buttons + '</div>' +
    '<div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">取消</button></div>'
  );
}

function setHwStatus(id, status) {
  const r = state.homeworkRecords.find(x => x.id === id);
  if (!r) return;
  r.status = status;
  if (isReviewLocked(r.status)) {
    r.reviewStatus = 'pending';
  } else if (isReviewHidden(r.status)) {
    r.reviewStatus = 'reviewed';
  }
  saveState();
  renderHomeworkTable();
  showToast(r.name + ' → ' + hwStatusBadge(r.status).replace(/<[^>]+>/g,''));
}

function hwStatusBadge(status) {
  const map = {
    pending: { cls:'hw-status-pending', label:'待标记' },
    excellent: { cls:'hw-status-excellent', label:'优秀作业' },
    normal: { cls:'hw-status-normal', label:'正常完成' },
    incomplete: { cls:'hw-status-incomplete', label:'未上交' },
    perfunctory: { cls:'hw-status-perfunctory', label:'敷衍完成' },
    resubmitted: { cls:'hw-status-resubmitted', label:'已补交' }
  };
  const s = map[status] || map.pending;
  return `<span class="hw-status-badge ${s.cls}">${s.label}</span>`;
}

// Check if review area should be hidden for this status
function isReviewHidden(status) {
  return status === 'normal' || status === 'excellent';
}
// Check if review is locked (can't edit)
function isReviewLocked(status) {
  return status === 'incomplete' || status === 'perfunctory';
}

function toggleHwSelection(id) {
  if (homeworkSelection.has(id)) homeworkSelection.delete(id);
  else homeworkSelection.add(id);
  updateHwSelectionUI();
}

function toggleSelectAllHw(checked) {
  const records = getFilteredHomeworkRecords();
  records.forEach(r => {
    if (checked) homeworkSelection.add(r.id);
    else homeworkSelection.delete(r.id);
  });
  renderHomeworkTable();
}

function selectAllHw(all) {
  const records = getFilteredHomeworkRecords();
  if (all) records.forEach(r => homeworkSelection.add(r.id));
  else records.forEach(r => homeworkSelection.delete(r.id));
  renderHomeworkTable();
}

function updateHwSelectionUI() {
  const countEl = document.getElementById('hwSelectedCount');
  if (countEl) countEl.textContent = `已选择 ${homeworkSelection.size} 人`;
  const area = document.getElementById('batchReviewArea');
  if (area) {
    if (homeworkSelection.size > 0) area.classList.add('show');
    else area.classList.remove('show');
  }
  // Show pending count
  const records = getFilteredHomeworkRecords();
  const pending = records.filter(r => r.status === 'pending');
  const pendingEl = document.getElementById('hwPendingCount');
  if (pendingEl) {
    pendingEl.innerHTML = pending.length > 0
      ? `<span style="color:let(--warning)">⏳ ${pending.length} 人未标记（保存时自动填充为「正常完成」）</span>`
      : '<span style="color:let(--success)">✅ 全部已标记</span>';
  }
}

function saveAllHomework() {
  const records = getFilteredHomeworkRecords();
  const pending = records.filter(r => r.status === 'pending');
  if (pending.length === 0) {
    showToast('全部记录已标记，无需保存');
    return;
  }
  const names = pending.map(r => escapeHtml(r.name)).join('、');
  openModal(`
    <h3>💾 保存确认</h3>
    <p style="font-size:13px;color:let(--text-body);margin-bottom:12px;line-height:1.7">
      以下 <b style="color:let(--warning)">${pending.length} 名学生</b>尚未标记作业状态，保存后将自动填充为<b style="color:let(--success)">「正常完成」</b>。
    </p>
    <div style="background:let(--bg-app);padding:12px;border-radius:let(--radius-sm);max-height:200px;overflow-y:auto;font-size:12px;color:let(--text-body);margin-bottom:12px">
      ${names}
    </div>
    <p style="font-size:12px;color:let(--text-muted)">确认后所有数据将自动保存到云端</p>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="confirmSaveAllHomework">确认保存</button>
    </div>
  `);
}

function confirmSaveAllHomework() {
  const records = getFilteredHomeworkRecords();
  let filled = 0;
  records.forEach(r => {
    if (r.status === 'pending') { r.status = 'normal'; filled++; }
  });
  saveState();
  closeModal();
  showToast(`已保存，自动填充 ${filled} 人为「正常完成」`);
  renderHomeworkTable();
}

function openBatchHwModal() {
  if (homeworkSelection.size === 0) { showToast('请先选择学生', 'warn'); return; }
  openModal(`
    <h3>批量标记作业状态</h3>
    <div class="form-group">
      <label class="form-label">状态</label>
      <select class="form-select" id="batchHwStatus">
        <option value="normal">正常完成</option>
        <option value="excellent">优秀作业</option>
        <option value="incomplete">未上交</option>
        <option value="perfunctory">敷衍完成</option>
        <option value="resubmitted">已补交</option>
        <option value="pending">待标记</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">批阅状态</label>
      <select class="form-select" id="batchHwReviewStatus">
        <option value="keep">不修改</option>
        <option value="pending">待批改</option>
        <option value="reviewed">已处理</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">批阅评语（可选）</label>
      <textarea class="form-textarea" id="batchHwReview" placeholder="批量评语"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveBatchHwStatus">应用 (${homeworkSelection.size}人)</button>
    </div>
  `);
}

function saveBatchHwStatus() {
  const status = document.getElementById('batchHwStatus').value;
  const review = document.getElementById('batchHwReview').value.trim();
  const reviewStatusChoice = document.getElementById('batchHwReviewStatus')?.value || 'keep';
  homeworkSelection.forEach(id => {
    const r = state.homeworkRecords.find(x => x.id === id);
    if (r) {
      r.status = status;
      if (review) r.review = review;
      if (reviewStatusChoice && reviewStatusChoice !== 'keep') {
        // 手动指定批阅状态，优先于自动逻辑
        r.reviewStatus = reviewStatusChoice;
      } else {
        // 与单条编辑一致：锁定→待批改；隐藏→已处理；其余（含待标记/已补交）→待批改
        if (isReviewLocked(status)) {
          r.reviewStatus = 'pending';
        } else if (isReviewHidden(status)) {
          r.reviewStatus = 'reviewed';
        } else {
          r.reviewStatus = 'pending';
        }
      }
    }
  });
  saveState();
  closeModal();
  showToast(`已批量更新 ${homeworkSelection.size} 人`);
  renderHomeworkTable();
}

function saveBatchReview() {
  const review = document.getElementById('batchReviewText').value.trim();
  if (!review) { showToast('请输入批阅内容', 'warn'); return; }
  homeworkSelection.forEach(id => {
    const r = state.homeworkRecords.find(x => x.id === id);
    if (r) r.review = review;
  });
  saveState();
  showToast('批阅已保存');
  renderHomeworkTable();
}

async function clearHwReview() {
  if (homeworkSelection.size === 0) { showToast('请先勾选学生（可点「全选」）', 'warn'); return; }
  const ids = Array.from(homeworkSelection);
  // 仅对需要批阅的状态生效（normal/excellent 自动隐藏批阅列，无需清空）
  const targets = state.homeworkRecords.filter(r => ids.includes(r.id) && !isReviewHidden(r.status));
  if (targets.length === 0) { showToast('所选学生均为正常/优秀完成，无批阅可清空', 'warn'); return; }
  const ok = await appConfirm(`将清空 ${targets.length} 条作业记录的批阅评语，并重置为「待批改」。\n此操作不可恢复，确定继续吗？`, { danger: true });
  if (!ok) return;
  targets.forEach(r => {
    r.review = '';
    r.reviewStatus = 'pending';
  });
  saveState();
  showToast(`已清空 ${targets.length} 条批阅`);
  renderHomeworkTable();
}

function openHwReviewModal(id) {
  const r = state.homeworkRecords.find(x => x.id === id);
  if (!r) return;
  openModal(`
    <h3>${escapeHtml(r.name)} - ${escapeHtml(r.taskTitle)}</h3>
    <div class="form-group">
      <label class="form-label">作业状态</label>
      <select class="form-select" id="singleHwStatus">
        <option value="normal" ${r.status==='normal'?'selected':''}>正常完成</option>
        <option value="excellent" ${r.status==='excellent'?'selected':''}>优秀作业</option>
        <option value="incomplete" ${r.status==='incomplete'?'selected':''}>未上交</option>
        <option value="perfunctory" ${r.status==='perfunctory'?'selected':''}>敷衍完成</option>
        <option value="resubmitted" ${r.status==='resubmitted'?'selected':''}>已补交</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">批阅评语</label>
      <textarea class="form-textarea" id="singleHwReview">${escapeHtml(r.review||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">批阅状态</label>
      <select class="form-select" id="singleHwReviewStatus">
        <option value="pending" ${(!r.reviewStatus||r.reviewStatus==='pending')?'selected':''}>待批改</option>
        <option value="reviewed" ${r.reviewStatus==='reviewed'?'selected':''}>已处理</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveSingleHw" data-click-args="[&quot;${id}&quot;]">保存</button>
    </div>
  `);
}

function saveSingleHw(id) {
  const r = state.homeworkRecords.find(x => x.id === id);
  if (r) {
    r.status = document.getElementById('singleHwStatus').value;
    r.review = document.getElementById('singleHwReview').value.trim();
    r.reviewStatus = document.getElementById('singleHwReviewStatus').value;
    // Auto-set review status based on homework status
    if (isReviewLocked(r.status)) {
      r.reviewStatus = 'pending'; // locked as 未处理
    } else if (isReviewHidden(r.status)) {
      r.reviewStatus = 'reviewed'; // normal/excellent auto-mark as reviewed
    }
    saveState();
    showToast('已保存');
  }
  closeModal();
  renderHomeworkTable();
}

/* ---- 06-4 Chat (Class-Isolated) ---- */
const CHAT_TEMPLATES = [
  { key:'remind', label:'📋 催交作业', text:'请各位同学尽快上交今日作业，截止时间：今天放学前。课代表请统计未交名单。' },
  { key:'collected', label:'✅ 收齐名单', text:'今日作业已收齐，共收 {count} 份，感谢课代表的辛勤工作！' },
  { key:'correct', label:'📝 订正要求', text:'请同学们对昨天的作业进行订正，重点注意错题，订正后交课代表检查。' },
  { key:'tomorrow', label:'📅 次日作业提醒', text:'明日作业预告：请预习下一节内容，并完成课后练习第1-3题。' }
];

function renderChat(container) {
  const cls = state.currentChatClass || getClasses()[0];
  container.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar" id="chatClassList">
        <button class="chat-sidebar-toggle" data-click="toggleChatSidebar" title="展开/收起班级列表">☰</button>
        <div class="chat-class-list-inner" id="chatClassListInner"></div>
      </div>
      <div class="chat-main">
        <div class="chat-header">
          <span>💬 ${escapeHtml(cls)} 课代表沟通</span>
          <span style="font-size:12px;font-weight:400;color:let(--text-muted);flex:1">课代表→右 / 教师←左</span>
          ${state.appPassword ? (state.passwordUnlocked 
            ? '<button class="chat-unlock-btn unlocked" data-click="toggleChatLock" title="点击锁定教师回复">🔓 已解锁</button>'
            : '<button class="chat-unlock-btn" data-click="toggleChatLock" title="点击解锁查看教师回复">🔒 解锁查看</button>'
          ) : ''}
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-templates" id="chatTemplates">
          ${CHAT_TEMPLATES.map(t => `<button class="chat-template-btn" data-click="sendChatTemplate" data-click-args="[&quot;${t.key}&quot;]">${t.label}</button>`).join('')}
        </div>
        <div class="chat-input-area">
          <input type="text" class="chat-input" id="chatInput" placeholder="课代表输入消息..." data-ev="keypress" data-ev-key="ev37">
          <button class="btn btn-outline btn-sm" data-click="sendChatSpecial" data-click-args="[&quot;stats&quot;]" title="发送作业收缴统计表">📊 统计表</button>
          <button class="btn btn-outline btn-sm" data-click="sendChatSpecial" data-click-args="[&quot;unsubmitted&quot;]" title="发送未交学生名单">📋 未交名单</button>
          <button class="btn btn-primary" data-click="sendChat">发送</button>
          <button class="btn btn-outline btn-sm" data-click="teacherReply" title="教师回复（需密码）" style="border-color:let(--warning);color:let(--warning)">👨‍🏫 教师回复</button>
        </div>
      </div>
    </div>
  `;
  renderChatClassList();
  renderChatMessages();
}

function renderChatClassList() {
  const el = document.getElementById('chatClassListInner');
  if (!el) return;
  const current = state.currentChatClass || getClasses()[0];
  el.innerHTML = getClasses().map(c => {
    const unread = (state.chatUnread && state.chatUnread[c]) || 0;
    const isActive = c === current;
    return `<div class="chat-class-item ${isActive?'active':''}" data-click="switchChatClass" data-click-args="[&quot;${c}&quot;]">
      <span class="class-name">${escapeHtml(c)}</span>
      ${unread > 0 ? `<span class="chat-unread-dot">${unread}</span>` : ''}
    </div>`;
  }).join('');
}

function switchChatClass(cls) {
  state.currentChatClass = cls;
  // Mark messages as read for this class
  state.chatMessages.forEach(m => { if (m.classId === cls) m.read = true; });
  if (!state.chatUnread) state.chatUnread = {};
  state.chatUnread[cls] = 0;
  saveState();
  renderChatClassList();
  renderChatMessages();
  // Update header title
  const hdr = document.querySelector('.chat-header > span:first-child');
  if (hdr) hdr.innerHTML = '💬 ' + escapeHtml(cls) + ' 课代表沟通';
}

function toggleChatSidebar() {
  const sb = document.getElementById('chatClassList');
  if (!sb) return;
  sb.classList.toggle('collapsed');
}

function getClassMessages(cls) {
  return state.chatMessages.filter(m => m.classId === cls).sort((a,b) => a.time.localeCompare(b.time));
}

function renderChatMessages() {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const cls = state.currentChatClass || getClasses()[0];
  const msgs = getClassMessages(cls);
  if (msgs.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:40px 0"><span class="emoji">💬</span>暂无消息，发送第一条消息开始对话</div>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const isTeacher = m.sender === 'teacher';
    const isLocked = isTeacher && state.appPassword && !state.passwordUnlocked;
    let contentHtml = '';

    if (isLocked) {
      // Teacher message but password not unlocked → show locked placeholder
      contentHtml = `<div class="chat-bubble-locked" data-click="toggleChatLock" title="点击解锁查看教师回复">🔒 教师回复（点击解锁查看）</div>`;
    } else if (m.type === 'text' || !m.type) {
      const displayContent = m.encrypted ? decryptText(m.content) : m.content;
      contentHtml = `<div class="chat-bubble">${escapeHtml(displayContent)}</div>`;
    } else if (m.type === 'stats') {
      const displayContent = m.encrypted ? decryptText(m.content) : m.content;
      contentHtml = `<div class="chat-special-msg">📊 作业收缴统计表<br>${escapeHtml(displayContent)}</div>`;
    } else if (m.type === 'unsubmitted') {
      const displayContent = m.encrypted ? decryptText(m.content) : m.content;
      contentHtml = `<div class="chat-special-msg">📋 未交学生名单<br>${escapeHtml(displayContent)}</div>`;
    } else if (m.type === 'template') {
      const displayContent = m.encrypted ? decryptText(m.content) : m.content;
      contentHtml = `<div class="chat-bubble">${escapeHtml(displayContent)}</div>`;
    } else {
      const displayContent = m.encrypted ? decryptText(m.content) : m.content;
      contentHtml = `<div class="chat-bubble">${escapeHtml(displayContent)}</div>`;
    }
    return `<div class="chat-msg ${m.sender}">
      ${contentHtml}
      <div class="chat-msg-meta">${escapeHtml(m.name)} · ${escapeHtml(m.time)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

// 聊天框内教师回复加密开关
function toggleChatLock() {
  if (!state.appPassword) { showToast('请先设置访问密码', 'warn'); return; }
  if (state.passwordUnlocked) {
    // 锁定
    state.passwordUnlocked = false;
    saveState();
    renderPwdStatusBar();
    renderChatMessages();
    showToast('教师回复已加密隐藏');
  } else {
    // 解锁 → 弹出密码验证
    openModal(`
      <h3>🔒 解锁教师回复</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">输入密码以查看教师回复内容</p>
      <div class="form-group">
        <input type="password" class="form-input" id="chatUnlockPwd" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev38">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyChatUnlock">解锁</button>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('chatUnlockPwd'); if (el) el.focus(); }, 100);
  }
}

async function verifyChatUnlock() {
  const pwd = document.getElementById('chatUnlockPwd').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    saveState();
    closeModal();
    renderPwdStatusBar();
    renderChatMessages();
    renderChat(document.getElementById('contentArea')); // 刷新头部按钮
    showToast('教师回复已解锁');
  } else {
    showToast('密码错误', 'error');
  }
}

function nowStr() {
  const n = new Date();
  return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')+' '+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const cls = state.currentChatClass || getClasses()[0];
  state.chatMessages.push({ id: uid(), classId: cls, sender:'representative', name:'课代表', content: text, time: nowStr(), type:'text', read:true });
  saveState();
  input.value = '';
  renderChatMessages();
}

function teacherReply() {
  if (state.appPassword && !state.passwordUnlocked) {
    openModal(`
      <h3>🔒 教师回复 - 密码验证</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">请输入密码以发送教师回复消息</p>
      <div class="form-group">
        <input type="password" class="form-input" id="teacherPwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev39">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyTeacherReply">验证</button>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('teacherPwdInput'); if (el) el.focus(); }, 100);
  } else {
    openTeacherReplyModal();
  }
}

async function verifyTeacherReply() {
  const pwd = document.getElementById('teacherPwdInput').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    closeModal();
    openTeacherReplyModal();
  } else {
    showToast('密码错误', 'error');
  }
}

function openTeacherReplyModal() {
  const cls = state.currentChatClass || getClasses()[0];
  openModal(`
    <h3>👨‍🏫 教师回复 - ${escapeHtml(cls)}</h3>
    <div class="form-group">
      <label class="form-label">回复内容</label>
      <textarea class="form-textarea" id="teacherReplyText" placeholder="输入教师回复内容..." style="min-height:100px"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="sendTeacherReply">发送回复</button>
    </div>
  `);
  setTimeout(() => { const el = document.getElementById('teacherReplyText'); if (el) el.focus(); }, 100);
}

function sendTeacherReply() {
  const text = document.getElementById('teacherReplyText').value.trim();
  if (!text) { showToast('请输入回复内容', 'warn'); return; }
  const cls = state.currentChatClass || getClasses()[0];
  state.chatMessages.push({ id: uid(), classId: cls, sender:'teacher', name:'派大星', content: encryptText(text), time: nowStr(), type:'text', read:true, encrypted: true });
  saveState();
  closeModal();
  renderChatMessages();
  showToast('教师回复已发送（加密存储）');
}

function sendChatTemplate(key) {
  // Teacher action - require password
  if (state.appPassword && !state.passwordUnlocked) {
    openModal(`
      <h3>🔒 教师操作 - 密码验证</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">发送模板消息需要密码验证</p>
      <div class="form-group">
        <input type="password" class="form-input" id="tplPwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev40" data-ev-args="${escapeAttr(JSON.stringify([key]))}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyTplPwd" data-click-args="[&quot;${key}&quot;]">验证</button>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('tplPwdInput'); if (el) el.focus(); }, 100);
    return;
  }
  doSendChatTemplate(key);
}

async function verifyTplPwd(key) {
  const pwd = document.getElementById('tplPwdInput').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    closeModal();
    doSendChatTemplate(key);
  } else {
    showToast('密码错误', 'error');
  }
}

function doSendChatTemplate(key) {
  const tpl = CHAT_TEMPLATES.find(t => t.key === key);
  if (!tpl) return;
  const cls = state.currentChatClass || getClasses()[0];
  let text = tpl.text;
  if (key === 'collected') {
    const count = state.students.filter(s => s.classId === cls).length;
    text = text.replace('{count}', count);
  }
  state.chatMessages.push({ id: uid(), classId: cls, sender:'teacher', name:'派大星', content: encryptText(text), time: nowStr(), type:'template', read:true, encrypted: true });
  saveState();
  renderChatMessages();
  showToast('已发送：' + tpl.label);
}

function sendChatSpecial(type) {
  // Teacher action - require password
  if (state.appPassword && !state.passwordUnlocked) {
    openModal(`
      <h3>🔒 教师操作 - 密码验证</h3>
      <p style="font-size:13px;color:let(--text-muted);margin-bottom:16px">发送统计/名单需要密码验证</p>
      <div class="form-group">
        <input type="password" class="form-input" id="specialPwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev41" data-ev-args="${escapeAttr(JSON.stringify([type]))}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifySpecialPwd" data-click-args="[&quot;${type}&quot;]">验证</button>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('specialPwdInput'); if (el) el.focus(); }, 100);
    return;
  }
  doSendChatSpecial(type);
}

async function verifySpecialPwd(type) {
  const pwd = document.getElementById('specialPwdInput').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    closeModal();
    doSendChatSpecial(type);
  } else {
    showToast('密码错误', 'error');
  }
}

function doSendChatSpecial(type) {
  const cls = state.currentChatClass || getClasses()[0];
  let content = '';
  if (type === 'stats') {
    // Get latest homework records for this class
    const records = state.homeworkRecords.filter(r => r.classId === cls);
    const byStatus = { excellent:0, normal:0, incomplete:0, perfunctory:0, resubmitted:0, pending:0 };
    records.forEach(r => { if (byStatus[r.status] !== undefined) byStatus[r.status]++; });
    const total = records.length;
    content = `班级：${cls} | 共 ${total} 人\n优秀：${byStatus.excellent} | 正常：${byStatus.normal} | 未上交：${byStatus.incomplete} | 敷衍：${byStatus.perfunctory} | 已补交：${byStatus.resubmitted} | 待标记：${byStatus.pending}`;
  } else if (type === 'unsubmitted') {
    const records = state.homeworkRecords.filter(r => r.classId === cls && (r.status === 'incomplete' || r.status === 'perfunctory' || r.status === 'pending'));
    if (records.length === 0) {
      content = `${cls} 全部同学已提交作业，无未交名单。`;
    } else {
      const names = records.map(r => r.name).join('、');
      content = `未交/待交学生（共${records.length}人）：\n${names}`;
    }
  }
  state.chatMessages.push({ id: uid(), classId: cls, sender:'teacher', name:'派大星', content: encryptText(content), time: nowStr(), type, read:true, encrypted: true });
  saveState();
  renderChatMessages();
  showToast('已发送');
}

/* ===================== 07 Student Analysis ===================== */
function renderAnalysis(container) {
  const tabs = [
    { key:'hw-analysis', label:'📊 作业分析' },
    { key:'score-analysis', label:'🎯 成绩分析' },
    { key:'dashboard', label:'📈 学情看板' }
  ];
  const current = state.currentPage === 'score-analysis' ? 'score-analysis'
    : state.currentPage === 'hw-analysis' ? 'hw-analysis'
    : state.currentPage === 'dashboard' ? 'dashboard'
    : (state._analysisTab || 'hw-analysis');
  container.innerHTML = `
    <div class="view-tabs">
      ${tabs.map(t => `<div class="view-tab ${current===t.key?'active':''}" data-click="switchAnalysisView" data-click-args="[&quot;${t.key}&quot;]">${t.label}</div>`).join('')}
    </div>
    <div id="analysisContainer"></div>
  `;
  const vc = document.getElementById('analysisContainer');
  if (current === 'score-analysis') renderScoreAnalysis(vc);
  else if (current === 'dashboard') renderDashboard(vc);
  else renderHwAnalysis(vc);
}

function switchAnalysisView(view) {
  state.currentPage = view;
  state._analysisTab = view;
  saveState();
  navigateTo(view);
}

/* ---- 07-1 Homework Analysis ---- */
function renderHwAnalysis(container) {
  const classFilter = state._hwAnalysisClass || '';
  const taskFilter = state._hwAnalysisTask || '';
  let records = state.homeworkRecords;
  if (classFilter) records = records.filter(r => r.classId === classFilter);
  if (taskFilter) records = records.filter(r => r.taskId === taskFilter);

  // 收集各分层各状态的学生名单（用于点击数值时展示）
  const layerStatusStudents = {};
  const byLayer = { 'A+':{excellent:0,normal:0,incomplete:0,pending:0}, 'A':{excellent:0,normal:0,incomplete:0,pending:0}, 'B+':{excellent:0,normal:0,incomplete:0,pending:0}, 'B':{excellent:0,normal:0,incomplete:0,pending:0}, 'C+':{excellent:0,normal:0,incomplete:0,pending:0}, 'C':{excellent:0,normal:0,incomplete:0,pending:0} };
  records.forEach(r => {
    const s = state.students.find(st => st.id === r.studentId);
    if (s) {
      // 固定按成绩分数分层（与学情看板口径统一），避免成绩分层模式下 A+/B+/C+ 学生被静默丢弃
      const ss = state.scores.filter(sc => sc.studentId === s.id && sc.score != null && sc.score !== '').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const layer = ss.length ? scoreToLayer(ss[0].score) : null;
      if (byLayer[layer]) {
        // 统计 incomplete 包含 incomplete + perfunctory
        const statKey = r.status === 'perfunctory' ? 'incomplete' : (byLayer[layer][r.status] !== undefined ? r.status : 'pending');
        if (byLayer[layer][statKey] !== undefined) byLayer[layer][statKey]++;
        // 收集学生名单
        if (!layerStatusStudents[layer]) layerStatusStudents[layer] = {};
        if (!layerStatusStudents[layer][statKey]) layerStatusStudents[layer][statKey] = [];
        layerStatusStudents[layer][statKey].push({ name: s.name, studentNo: s.studentNo, classId: s.classId, taskTitle: r.taskTitle, status: r.status });
      }
    }
  });
  const layerOrder = ['A+','A','B+','B','C+','C'];
  const colors = { excellent:'let(--success)', normal:'let(--info)', incomplete:'let(--danger)', pending:'#BDBDBD' };

  // 班级作业完成概况排序
  const sortKey = state._hwAnalysisSortKey || 'classId';
  const sortDir = state._hwAnalysisSortDir || 'asc';
  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const sortableHeader = (key, label) => `<th style="cursor:pointer;user-select:none" data-click="toggleHwAnalysisSort" data-click-args="[&quot;${key}&quot;]">${label}${sortArrow(key)}</th>`;

  const classStats = getClassHomeworkStats(classFilter);
  classStats.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') { va = va; vb = vb; }
    if (sortDir === 'asc') return va > vb ? 1 : va < vb ? -1 : 0;
    return va < vb ? 1 : va > vb ? -1 : 0;
  });

  container.innerHTML = `
    <div class="toolbar">
      <div class="search-bar" style="margin-bottom:0">
        <select class="form-select" id="hwAnalysisClass" style="width:140px" data-ev="change" data-ev-key="ev42">
          <option value="">全年级</option>
          ${getClasses().map(c => `<option value="${c}" ${classFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select class="form-select" id="hwAnalysisTask" style="width:200px;margin-left:8px" data-ev="change" data-ev-key="ev43">
          <option value="">全部作业</option>
          ${state.studentTasks.map(t => `<option value="${t.id}" ${taskFilter===t.id?'selected':''}>${escapeHtml(t.title)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="analysis-card">
      <h3>各分层作业状态分布 <span style="font-size:12px;color:let(--text-muted);font-weight:400">（点击数值查看学生名单）</span></h3>
      ${layerOrder.map(layer => {
        const d = byLayer[layer];
        const total = d.excellent + d.normal + d.incomplete + d.pending;
        return total ? `
          <div style="margin-bottom:18px">
            <div style="font-weight:600;margin-bottom:8px"><span class="layer-badge ${scoreToLayerCSS(layer)}">${layer}层</span> 共 ${total} 条记录</div>
            ${['excellent','normal','incomplete','pending'].map(status => {
              const count = d[status];
              const pct = Math.round(count/total*100);
              const label = status==='excellent'?'优秀':status==='normal'?'正常完成':status==='incomplete'?'未完成或敷衍':'待批改';
              return count ? `
                <div class="bar-chart-row">
                  <div class="bar-chart-label"><span>${label}</span><span style="cursor:pointer;color:${colors[status]};text-decoration:underline" data-click="showHwAnalysisStudents" data-click-args="[&quot;${layer}&quot;, &quot;${status}&quot;]">${count}人 (${pct}%)</span></div>
                  <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${pct}%;background:${colors[status]}">${pct}%</div></div>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : `<div style="margin-bottom:12px"><span class="layer-badge ${scoreToLayerCSS(layer)}">${layer}层</span> 暂无记录</div>`;
      }).join('')}
    </div>
    <div class="analysis-card" style="margin-top:16px">
      <h3>班级作业完成概况 <span style="font-size:12px;color:let(--text-muted);font-weight:400">（点击表头排序）</span></h3>
      <div class="table-wrap">
        <table class="task-table" style="width:100%;min-width:540px">
          <thead><tr>
            ${sortableHeader('classId','班级')}
            ${sortableHeader('total','总记录')}
            ${sortableHeader('excellent','优秀')}
            ${sortableHeader('normal','正常完成')}
            ${sortableHeader('incomplete','未完成或敷衍')}
            ${sortableHeader('rate','完成率')}
          </tr></thead>
          <tbody>${classStats.map(r => `
            <tr>
              <td>${escapeHtml(r.classId)}</td>
              <td>${r.total}</td>
              <td style="color:#2E7D32;cursor:pointer" data-click="showClassHwStudents" data-click-args="[&quot;${escapeAttr(r.classId)}&quot;, &quot;excellent&quot;]">${r.excellent}</td>
              <td style="color:#1565C0;cursor:pointer" data-click="showClassHwStudents" data-click-args="[&quot;${escapeAttr(r.classId)}&quot;, &quot;normal&quot;]">${r.normal}</td>
              <td style="color:#C62828;cursor:pointer" data-click="showClassHwStudents" data-click-args="[&quot;${escapeAttr(r.classId)}&quot;, &quot;incomplete&quot;]">${r.incomplete}</td>
              <td>${r.rate}%</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

// 切换作业分析排序
function toggleHwAnalysisSort(key) {
  if (state._hwAnalysisSortKey === key) {
    state._hwAnalysisSortDir = state._hwAnalysisSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state._hwAnalysisSortKey = key;
    state._hwAnalysisSortDir = 'asc';
  }
  saveState();
  renderHwAnalysis(document.getElementById('analysisContainer'));
}

// 显示分层+状态对应的学生名单
function showHwAnalysisStudents(layer, status) {
  const classFilter = state._hwAnalysisClass || '';
  const taskFilter = state._hwAnalysisTask || '';
  let records = state.homeworkRecords;
  if (classFilter) records = records.filter(r => r.classId === classFilter);
  if (taskFilter) records = records.filter(r => r.taskId === taskFilter);

  const statusLabels = { excellent:'优秀', normal:'正常完成', incomplete:'未完成或敷衍', pending:'待批改' };
  const students = [];
  records.forEach(r => {
    const s = state.students.find(st => st.id === r.studentId);
    if (s) {
      const ss = state.scores.filter(sc => sc.studentId === s.id && sc.score != null && sc.score !== '').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const stuLayer = ss.length ? scoreToLayer(ss[0].score) : null;
      if (stuLayer === layer) {
      const statKey = r.status === 'perfunctory' ? 'incomplete' : (['excellent','normal','incomplete','pending'].includes(r.status) ? r.status : 'pending');
      if (statKey === status) {
        students.push({ name: s.name, studentNo: s.studentNo, classId: s.classId, taskTitle: r.taskTitle, status: r.status });
      }
      }
    }
  });

  const statusMap = { excellent:'优秀作业', normal:'正常完成', incomplete:'未上交', perfunctory:'敷衍完成', resubmitted:'已补交', pending:'待标记' };
  openModal(`
    <h3>📋 ${layer}层 - ${statusLabels[status] || status}（${students.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>作业</th><th>状态</th></tr></thead>
        <tbody>${students.map(st => `
          <tr><td>${escapeHtml(st.studentNo)}</td><td>${escapeHtml(st.name)}</td><td>${escapeHtml(st.classId)}</td><td>${escapeHtml(st.taskTitle)}</td><td>${hwStatusBadge(st.status)}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
}

// 显示某班级某状态的学生名单
function showClassHwStudents(classId, status) {
  const taskFilter = state._hwAnalysisTask || '';
  let records = state.homeworkRecords.filter(r => r.classId === classId);
  if (taskFilter) records = records.filter(r => r.taskId === taskFilter);
  // incomplete 包含 incomplete + perfunctory
  if (status === 'incomplete') {
    records = records.filter(r => r.status === 'incomplete' || r.status === 'perfunctory');
  } else {
    records = records.filter(r => r.status === status);
  }

  const statusLabels = { excellent:'优秀', normal:'正常完成', incomplete:'未完成或敷衍' };
  openModal(`
    <h3>📋 ${escapeHtml(classId)} - ${statusLabels[status] || status}（${records.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>作业</th><th>状态</th></tr></thead>
        <tbody>${records.map(r => `
          <tr><td>${escapeHtml(r.studentNo)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.taskTitle)}</td><td>${hwStatusBadge(r.status)}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
}

function getClassHomeworkStats(classFilter) {
  let classes = [...new Set(state.students.map(s => s.classId))].sort();
  if (classFilter) classes = [classFilter];
  return classes.map(cls => {
    const records = state.homeworkRecords.filter(r => r.classId === cls);
    const total = records.length;
    const excellent = records.filter(r => r.status === 'excellent').length;
    const normal = records.filter(r => r.status === 'normal').length;
    const incomplete = records.filter(r => r.status === 'incomplete' || r.status === 'perfunctory').length;
    const perfunctory = records.filter(r => r.status === 'perfunctory').length;
    const resubmitted = records.filter(r => r.status === 'resubmitted').length;
    const done = excellent + normal + resubmitted;
    return { classId: cls, total, excellent, normal, incomplete, perfunctory, resubmitted, rate: total ? Math.round(done/total*100) : 0 };
  });
}

/* ---- 07-3 Dashboard: 学情数据分析看板 ---- */
function renderDashboard(container) {
  const classFilter = state._dashboardClass || '';
  const exam = state._selectedExam || getExamList()[0] || '';

  // Layer distribution
  let students = state.students;
  let scores = exam ? state.scores.filter(s => s.examName === exam) : [];
  if (classFilter) {
    students = students.filter(s => s.classId === classFilter);
    scores = scores.filter(s => s.classId === classFilter);
  }
  if (exam) recalculateRanks(exam);

  const isScoreLayer = true; // 学情看板「各分层人数」固定按成绩分数分层（A+/A/B+/B/C+/C）
  const layerCounts = { 'A+':0, 'A':0, 'B+':0, 'B':0, 'C+':0, 'C':0 };
  scores.forEach(s => {
    const l = isScoreLayer ? scoreToLayer(s.score) : rankToLayer(s.classRank || 999);
    if (layerCounts[l] !== undefined) layerCounts[l]++;
  });

  // Progress/regression counts
  const progressCounts = { up:0, slightUp:0, same:0, slightDown:0, down:0 };
  const keyStudents = [];
  scores.forEach(s => {
    const p = getScoreProgress(s.studentId, exam);
    if (!p) return;
    const stu = state.students.find(st => st.id === s.studentId) || {};
    const prevScoreRec = p.prevExam ? state.scores.find(x => x.studentId === s.studentId && x.examName === p.prevExam) : null;
    const base = {
      ...s,
      studentId: s.studentId,
      studentNo: stu.studentNo || '',
      progress: p,
      prevScore: prevScoreRec && prevScoreRec.score,
      prevClassRank: prevScoreRec && prevScoreRec.classRank,
      prevGradeRank: prevScoreRec && prevScoreRec.gradeRank,
      currExam: exam
    };
    if (p.progressLabel === '明显进步') { progressCounts.up++; keyStudents.push({ ...base, type:'progress_up', label:p.progressLabel, sortType:1 }); }
    else if (p.progressLabel === '小幅进步') { progressCounts.slightUp++; }
    else if (p.progressLabel === '持平') { progressCounts.same++; }
    else if (p.progressLabel === '小幅退步') { progressCounts.slightDown++; }
    else if (p.progressLabel === '明显退步') { progressCounts.down++; keyStudents.push({ ...base, type:'progress_down', label:p.progressLabel, sortType:2 }); }
    if (p.layerChange === 'up') keyStudents.push({ ...base, type:'layer_up', label:'分层提升', layerChange:true, sortType:3 });
    if (p.layerChange === 'down') keyStudents.push({ ...base, type:'layer_down', label:'分层下滑', layerChange:true, sortType:4 });
  });

  // 成绩变动学生排序
  const keySortKey = state._dashboardKeySortKey || 'type';
  const keySortDir = state._dashboardKeySortDir || 'desc';
  keyStudents.sort((a, b) => {
    let va, vb;
    switch (keySortKey) {
      case 'studentNo':
        va = parseInt((a.studentNo || '').replace(/\D/g,'')) || 0;
        vb = parseInt((b.studentNo || '').replace(/\D/g,'')) || 0;
        break;
      case 'classId':
        va = a.classId || ''; vb = b.classId || '';
        break;
      case 'score':
        va = a.score == null ? -1 : a.score; vb = b.score == null ? -1 : b.score;
        break;
      case 'type':
      default:
        va = a.sortType || 0; vb = b.sortType || 0;
    }
    if (va < vb) return keySortDir === 'asc' ? -1 : 1;
    if (va > vb) return keySortDir === 'asc' ? 1 : -1;
    return 0;
  });
  const keySortArrow = (key) => keySortKey === key ? (keySortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const keySortableHeader = (key, label) => `<th style="cursor:pointer;user-select:none" data-click="toggleDashboardKeySort" data-click-args="[&quot;${key}&quot;]">${label}${keySortArrow(key)}</th>`;

  // 成绩变动学生筛选：班级 + 类型
  const keyClassFilter = state._dashboardKeyClassFilter || '';
  const keyTypeFilter = state._dashboardKeyTypeFilter || { progress_up:true, progress_down:true, layer_up:true, layer_down:true };
  const keyTypeLabels = { progress_up:'明显进步', progress_down:'明显退步', layer_up:'分层提升', layer_down:'分层下滑' };
  const filteredKeyStudents = keyStudents.filter(s => {
    const matchClass = !keyClassFilter || s.classId === keyClassFilter;
    const matchType = keyTypeFilter[s.type] !== false;
    return matchClass && matchType;
  });

  // Homework anomalies: 基于作业记录实时统计（不再依赖 students.homeworkStats 快照，避免与作业登记表不一致）
  const hwAnomalies = [];
  students.forEach(s => {
    const sRecords = state.homeworkRecords.filter(r => r.studentId === s.id);
    const incompleteRecords = sRecords.filter(r => r.status === 'incomplete');
    const perfunctoryRecords = sRecords.filter(r => r.status === 'perfunctory');
    const incompleteCount = incompleteRecords.length;
    const perfunctoryCount = perfunctoryRecords.length;
    // 未上交≥2 或 敷衍完成≥2 视为异常
    if (incompleteCount >= 2 || perfunctoryCount >= 2) {
      hwAnomalies.push({ ...s, incompleteCount, perfunctoryCount, incompleteRecords, perfunctoryRecords });
    }
  });

  // 排序
  const anomalySortKey = state._dashboardAnomalySortKey || 'incompleteCount';
  const anomalySortDir = state._dashboardAnomalySortDir || 'desc';
  hwAnomalies.sort((a, b) => {
    let va = a[anomalySortKey], vb = b[anomalySortKey];
    if (anomalySortKey === 'studentNo' || anomalySortKey === 'classId') { va = va || ''; vb = vb || ''; }
    if (anomalySortDir === 'asc') return va > vb ? 1 : va < vb ? -1 : 0;
    return va < vb ? 1 : va > vb ? -1 : 0;
  });
  const anomalySortArrow = (key) => anomalySortKey === key ? (anomalySortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const anomalySortableHeader = (key, label) => `<th style="cursor:pointer;user-select:none" data-click="toggleDashboardAnomalySort" data-click-args="[&quot;${key}&quot;]">${label}${anomalySortArrow(key)}</th>`;

  // Homework status distribution
  let hwRecords = state.homeworkRecords;
  if (classFilter) hwRecords = hwRecords.filter(r => r.classId === classFilter);
  const hwStatusCounts = { excellent:0, normal:0, incomplete:0, perfunctory:0, resubmitted:0, pending:0 };
  hwRecords.forEach(r => { if (hwStatusCounts[r.status] !== undefined) hwStatusCounts[r.status]++; });

  container.innerHTML = `
    <div class="toolbar">
      <div class="search-bar" style="margin-bottom:0">
        <select class="form-select" id="dashboardClass" style="width:140px" data-ev="change" data-ev-key="ev44">
          <option value="">全年级汇总</option>
          ${getClasses().map(c => `<option value="${c}" ${classFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select class="form-select" id="dashboardExam" style="width:180px;margin-left:8px" data-ev="change" data-ev-key="ev45">
          ${getExamList().map(e => `<option value="${escapeHtml(e)}" ${exam===e?'selected':''}>${escapeHtml(e)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-num">${students.length}</div><div class="stat-label">学生数</div></div>
      <div class="stat-card" style="cursor:pointer" data-click="showProgressCategoryStudents" data-click-args="[&quot;progress&quot;]" title="点击查看进步学生名单"><span class="stat-icon">📈</span><div class="stat-num">${progressCounts.up + progressCounts.slightUp}</div><div class="stat-label">进步人数</div></div>
      <div class="stat-card" style="cursor:pointer" data-click="showProgressCategoryStudents" data-click-args="[&quot;regress&quot;]" title="点击查看退步学生名单"><span class="stat-icon">📉</span><div class="stat-num">${progressCounts.down + progressCounts.slightDown}</div><div class="stat-label">退步人数</div></div>
      <div class="stat-card" style="cursor:pointer" data-click="showHwAnomalyList" title="点击查看作业异常学生"><span class="stat-icon">⚠️</span><div class="stat-num">${hwAnomalies.length}</div><div class="stat-label">作业异常</div></div>
    </div>

    <div class="dashboard-grid" style="margin-top:16px">
      <div class="analysis-card">
        <h3>📊 作业状态分布</h3>
        ${renderHwStatusBars(hwStatusCounts)}
      </div>
      <div class="analysis-card">
        <h3>🎯 各分层人数 <span style="font-size:12px;color:let(--text-muted);font-weight:400">（${isScoreLayer?'按成绩分数':'按考试班排'}）</span></h3>
        ${renderLayerBars(layerCounts, isScoreLayer)}
      </div>
    </div>

    <div class="analysis-card" style="margin-top:16px">
      <h3>📈 进退步人数统计</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${renderProgressBar('明显进步', progressCounts.up, '#2E7D32', 'up')}
        ${renderProgressBar('小幅进步', progressCounts.slightUp, '#81C784', 'slightUp')}
        ${renderProgressBar('持平', progressCounts.same, '#9E9E9E', 'same')}
        ${renderProgressBar('小幅退步', progressCounts.slightDown, '#FFB74D', 'slightDown')}
        ${renderProgressBar('明显退步', progressCounts.down, '#C62828', 'down')}
      </div>
    </div>

    <div class="analysis-card" style="margin-top:16px">
      <h3>🔍 重点学生关注</h3>
      ${keyStudents.length === 0 && hwAnomalies.length === 0
        ? '<div class="empty-state" style="padding:20px"><span class="emoji">✅</span>暂无重点关注学生</div>'
        : `
        ${keyStudents.length > 0 ? `
          <div style="margin-bottom:16px">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
              <div style="font-weight:600;color:let(--text-heading)">📌 成绩变动学生</div>
              <select class="form-select" style="width:120px" data-ev="change" data-ev-key="ev46">
                <option value="">全部班级</option>
                ${getClasses().map(c => `<option value="${c}" ${keyClassFilter===c?'selected':''}>${c}</option>`).join('')}
              </select>
              <div style="font-size:12px;color:let(--text-muted);display:flex;gap:10px;align-items:center">
                ${Object.keys(keyTypeLabels).map(t => `<label style="cursor:pointer"><input type="checkbox" ${keyTypeFilter[t]!==false?'checked':''} data-ev="change" data-ev-key="ev47" data-ev-args="${escapeAttr(JSON.stringify([t]))}"> ${keyTypeLabels[t]}</label>`).join('')}
              </div>
              ${(keyClassFilter || Object.values(keyTypeFilter).some(v => v === false)) ? `<button class="btn btn-sm btn-outline" data-click="resetDashboardKeyFilter">重置筛选</button>` : ''}
            </div>
            ${filteredKeyStudents.length > 0 ? `
              <div class="table-wrap">
                <table class="task-table" style="width:100%;min-width:420px">
                  <thead><tr>
                    ${keySortableHeader('studentNo','学号')}
                    <th>姓名</th>
                    ${keySortableHeader('classId','班级')}
                    ${keySortableHeader('score','成绩')}
                    ${keySortableHeader('type','类型')}
                  </tr></thead>
                  <tbody>${filteredKeyStudents.map(s => {
                    const color = s.type === 'progress_up' ? '#2E7D32' : s.type === 'progress_down' ? '#C62828' : s.type === 'layer_up' ? '#2E7D32' : '#C62828';
                    return `<tr>
                      <td>${escapeHtml(s.studentNo||'')}</td>
                      <td>${escapeHtml(s.name)}</td>
                      <td>${escapeHtml(s.classId)}</td>
                      <td><strong>${s.score}</strong></td>
                      <td><span style="color:${color};font-weight:600;cursor:pointer;text-decoration:underline" data-click="showKeyStudentDetail" data-click-args="[&quot;${s.studentId}&quot;, &quot;${s.type}&quot;]">${escapeHtml(s.label)}</span></td>
                    </tr>`;
                  }).join('')}</tbody>
                </table>
              </div>
            ` : '<div class="empty-state" style="padding:12px"><span class="emoji">🔍</span>当前筛选条件下暂无成绩变动学生</div>'}
          </div>
        ` : ''}
        ${hwAnomalies.length > 0 ? `
          <div>
            <div style="font-weight:600;margin-bottom:8px;color:let(--text-heading)">⚠️ 作业异常学生（未上交或敷衍完成≥2次） <span style="font-size:12px;color:let(--text-muted);font-weight:400">（点击表头排序，点击次数查看详情）</span></div>
            <div class="table-wrap">
              <table class="task-table" style="width:100%;min-width:560px">
                <thead><tr>
                  ${anomalySortableHeader('studentNo','学号')}
                  <th>姓名</th>
                  ${anomalySortableHeader('classId','班级')}
                  ${anomalySortableHeader('incompleteCount','未上交次数')}
                  ${anomalySortableHeader('perfunctoryCount','敷衍完成次数')}
                  <th>分层</th>
                </tr></thead>
                <tbody>${hwAnomalies.map(s => `
                  <tr>
                    <td>${escapeHtml(s.studentNo||'')}</td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.classId)}</td>
                    <td>${s.incompleteCount > 0 ? `<span style="color:let(--danger);font-weight:600;cursor:pointer;text-decoration:underline" data-click="showHwAnomalyDetail" data-click-args="[&quot;${s.id}&quot;, &quot;incomplete&quot;]">${s.incompleteCount}</span>` : '<span class="text-muted">0</span>'}</td>
                    <td>${s.perfunctoryCount > 0 ? `<span style="color:#E65100;font-weight:600;cursor:pointer;text-decoration:underline" data-click="showHwAnomalyDetail" data-click-args="[&quot;${s.id}&quot;, &quot;perfunctory&quot;]">${s.perfunctoryCount}</span>` : '<span class="text-muted">0</span>'}</td>
                    <td>${(() => { const _l = getStudentLayer(s); return _l === null ? '<span class="layer-badge none">未分层</span>' : '<span class="layer-badge ' + _l.toLowerCase() + '">' + _l + '层</span>'; })()}</td>
                  </tr>
                `).join('')}</tbody>
              </table>
            </div>
          </div>
        ` : ''}
      `}
    </div>
  `;
}

// 切换学情看板成绩变动学生排序
function toggleDashboardKeySort(key) {
  if (state._dashboardKeySortKey === key) {
    state._dashboardKeySortDir = state._dashboardKeySortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state._dashboardKeySortKey = key;
    // 类型/成绩默认降序，学号/班级默认升序
    state._dashboardKeySortDir = (key === 'type' || key === 'score') ? 'desc' : 'asc';
  }
  saveState();
  renderDashboard(document.getElementById('analysisContainer'));
}

// 切换成绩变动学生类型筛选
function toggleKeyTypeFilter(type) {
  const f = state._dashboardKeyTypeFilter || { progress_up:true, progress_down:true, layer_up:true, layer_down:true };
  f[type] = !f[type];
  state._dashboardKeyTypeFilter = f;
  saveState();
  renderDashboard(document.getElementById('analysisContainer'));
}

// 重置成绩变动学生筛选
function resetDashboardKeyFilter() {
  state._dashboardKeyClassFilter = '';
  state._dashboardKeyTypeFilter = { progress_up:true, progress_down:true, layer_up:true, layer_down:true };
  saveState();
  renderDashboard(document.getElementById('analysisContainer'));
}

// 切换学情看板异常学生排序
function toggleDashboardAnomalySort(key) {
  if (state._dashboardAnomalySortKey === key) {
    state._dashboardAnomalySortDir = state._dashboardAnomalySortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state._dashboardAnomalySortKey = key;
    // 次数类字段默认降序，学号/班级默认升序
    state._dashboardAnomalySortDir = (key === 'incompleteCount' || key === 'perfunctoryCount') ? 'desc' : 'asc';
  }
  saveState();
  renderDashboard(document.getElementById('analysisContainer'));
}

// 显示学生异常作业详情（按状态类型：incomplete=未上交 / perfunctory=敷衍完成）
function showHwAnomalyDetail(studentId, type) {
  const s = state.students.find(st => st.id === studentId);
  if (!s) return;
  const records = state.homeworkRecords.filter(r => r.studentId === studentId && r.status === type);
  const titleMap = { incomplete: '未上交作业', perfunctory: '敷衍完成作业' };
  const colorMap = { incomplete: 'let(--danger)', perfunctory: '#E65100' };
  const title = titleMap[type] || '异常作业';
  openModal(`
    <h3>📋 ${escapeHtml(s.name)}（${escapeHtml(s.studentNo)}）- ${title}详情</h3>
    <div style="margin-bottom:10px;font-size:13px;color:let(--text-muted)">
      班级：${escapeHtml(s.classId)} | 共 ${records.length} 次${title}
    </div>
    <div class="table-wrap" style="max-height:350px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>作业名称</th><th>状态</th><th>批阅</th></tr></thead>
        <tbody>${records.length > 0 ? records.map(r => `
          <tr><td>${escapeHtml(r.taskTitle)}</td><td>${hwStatusBadge(r.status)}</td><td>${escapeHtml(r.review || '—')}</td></tr>
        `).join('') : '<tr><td colspan="3" class="empty-state">暂无记录</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
}

// 点击学情看板顶部「作业异常」统计卡，列出所有异常学生（未上交或敷衍完成≥2次）
function showHwAnomalyList() {
  const classFilter = state._dashboardClass || '';
  let students = classFilter ? state.students.filter(s => s.classId === classFilter) : state.students.slice();
  const list = [];
  students.forEach(s => {
    const sRecords = state.homeworkRecords.filter(r => r.studentId === s.id);
    const incompleteCount = sRecords.filter(r => r.status === 'incomplete').length;
    const perfunctoryCount = sRecords.filter(r => r.status === 'perfunctory').length;
    if (incompleteCount >= 2 || perfunctoryCount >= 2) {
      list.push({ id: s.id, studentNo: s.studentNo, name: s.name, classId: s.classId, incompleteCount, perfunctoryCount });
    }
  });
  list.sort((a, b) => (parseInt((a.studentNo||'').replace(/\D/g,''))||0) - (parseInt((b.studentNo||'').replace(/\D/g,''))||0));
  const rows = list.map(s => `<tr style="cursor:pointer" data-click="showHwAnomalyDetail" data-click-args="[&quot;${s.id}&quot;, &quot;${s.incompleteCount >= 2 ? 'incomplete' : 'perfunctory'}&quot;]">
    <td>${escapeHtml(s.studentNo)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.classId)}</td>
    <td><span style="color:let(--danger);font-weight:600">未上交 ${s.incompleteCount}</span></td>
    <td><span style="color:#E65100;font-weight:600">敷衍 ${s.perfunctoryCount}</span></td>
  </tr>`).join('');
  openModal(`
    <h3>⚠️ 作业异常学生（${list.length}人）</h3>
    <div style="margin-bottom:10px;font-size:13px;color:let(--text-muted)">未上交或敷衍完成累计 ≥2 次，点击某一行可查看具体作业明细</div>
    <div class="table-wrap" style="max-height:380px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>未上交</th><th>敷衍</th></tr></thead>
        <tbody>${list.length > 0 ? rows : '<tr><td colspan="5" class="empty-state">暂无异常学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

// 兼容旧调用：默认显示未上交
function showIncompleteDetail(studentId) {
  showHwAnomalyDetail(studentId, 'incomplete');
}

/* ---- 学情看板：成绩变动明细弹窗 ----
   类型：progress_up / progress_down / layer_up / layer_down
   数据源：getScoreProgress 已经算完，直接用 prevExam + score 记录回查 */
function showKeyStudentDetail(studentId, type) {
  let stu = state.students.find(function(st) { return st.id === studentId; });
  const name = stu ? stu.name : '';
  let studentNo = stu ? stu.studentNo : '';
  let classId = stu ? stu.classId : '';
  let exam = state._selectedExam || getExamList()[0] || '';
  let p = getScoreProgress(studentId, exam);
  if (!p) { showToast('找不到本次成绩变动数据', 'warn'); return; }
  const prevRec = state.scores.find(function(x) { return x.studentId === studentId && x.examName === p.prevExam; });
  const currRec = state.scores.find(function(x) { return x.studentId === studentId && x.examName === exam; });
  let prevAvg = null, currAvg = null;
  if (p.prevExam) {
    const prevAll = state.scores.filter(function(x) { return x.examName === p.prevExam; });
    if (prevAll.length) prevAvg = (prevAll.reduce(function(a, b) { return a + (b.score || 0); }, 0) / prevAll.length);
  }
  const currAll = state.scores.filter(function(x) { return x.examName === exam; });
  if (currAll.length) currAvg = (currAll.reduce(function(a, b) { return a + (b.score || 0); }, 0) / currAll.length);

  // 趋势类标签（波动明显/稳步上升/稳居前列）单独展示历次考试明细
  const trendTypes = ['volatile', 'steady', 'top'];
  if (trendTypes.indexOf(type) >= 0) {
    renderTrendDetail(studentId, type, { name: name, studentNo: studentNo, classId: classId }, exam);
    return;
  }

  // 连续趋势：按级排变化方向数"连续进步/退步次数"
  const allScores = state.scores
    .filter(function(s) { return s.studentId === studentId && s.examName; })
    .slice()
    .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
  const isUp = ['progress_up','slight_up','layer_up','steady','top'].indexOf(type) >= 0;
  const isDown = ['progress_down','slight_down','layer_down','regress','volatile'].indexOf(type) >= 0;
  const isNeutral = ['flat','layer_flat'].indexOf(type) >= 0;
  const direction = isUp ? 1 : (isDown ? -1 : 0);
  let streak = 0;
  for (let i = allScores.length - 1; i > 0; i--) {
    let diff = (allScores[i-1].gradeRank || 999) - (allScores[i].gradeRank || 999);
    if (Math.sign(diff) === direction && diff !== 0) streak++; else break;
  }
  const totalExams = allScores.length;

  let typeNames = { progress_up:'明显进步', progress_down:'明显退步', slight_up:'小幅进步', slight_down:'小幅退步', flat:'持平', layer_up:'分层提升', layer_down:'分层下滑', layer_flat:'分层持平', regress:'退步明显', volatile:'波动明显', steady:'稳步上升', top:'稳居前列' };
  let colorMain = isUp ? '#2E7D32' : (isDown ? '#C62828' : 'let(--text-muted)');
  const sym = isUp ? '↑' : (isDown ? '↓' : '→');
  const fmtNum = function(n) { return (n == null || n === 999) ? '<span style="color:let(--text-muted)">—</span>' : n; };
  const fmtRank = function(n) { return (n == null || n === 999) ? '<span style="color:let(--text-muted)">—</span>' : '第 ' + n + ' 名'; };
  const fmtDiff = function(n, suffix) {
    if (n == null || n === 0) return '<span style="color:let(--text-muted)">—</span>';
    let sign = n > 0 ? '+' : '';
    let cls = n > 0 ? 'color:#2E7D32' : 'color:#C62828';
    return '<span style="' + cls + ';font-weight:600">' + sign + n + (suffix||'') + '</span>';
  };
  const fmtScoreDiff = function(n) {
    if (n == null) return '<span style="color:let(--text-muted)">—</span>';
    const sign = n > 0 ? '+' : '';
    let cls = n > 0 ? 'color:#2E7D32' : n < 0 ? 'color:#C62828' : 'color:let(--text-muted)';
    return '<span style="' + cls + ';font-weight:600">' + sign + n + ' 分</span>';
  };

  // 弹窗内的"分层"以成绩分层口径展示（与成绩表一致）
  const scoreLayerOrder = { 'A+':6, 'A':5, 'B+':4, 'B':3, 'C+':2, 'C':1, '—':0 };
  const prevScoreLayer = prevRec ? scoreToLayer(prevRec.score) : null;
  const currScoreLayer = currRec ? scoreToLayer(currRec.score) : null;
  let popupLayerChange = 'same';
  if (prevScoreLayer && currScoreLayer) {
    if (scoreLayerOrder[currScoreLayer] > scoreLayerOrder[prevScoreLayer]) popupLayerChange = 'up';
    else if (scoreLayerOrder[currScoreLayer] < scoreLayerOrder[prevScoreLayer]) popupLayerChange = 'down';
  }
  let layerChangeCell = '<span style="color:let(--text-muted)">—</span>';
  if (popupLayerChange === 'up') layerChangeCell = '<span style="color:#2E7D32;font-weight:600">↑ 升层</span>';
  else if (popupLayerChange === 'down') layerChangeCell = '<span style="color:#C62828;font-weight:600">↓ 降层</span>';

  let summary = '';
  if (isNeutral) {
    summary = '本次成绩基本持平，无显著进退步';
  } else if (streak >= 1) {
    summary = '本轮已连续 <strong style="color:' + colorMain + '">' + (streak + 1) + ' 次</strong>' + (direction > 0 ? '进步/升层' : '退步/降层');
  } else {
    summary = '本轮' + (direction > 0 ? '进步/升层' : '退步/降层') + '是新一轮的开始';
  }

  openModal(
    '<h3>📈 ' + escapeHtml(name) + '（' + escapeHtml(studentNo) + '）' + escapeHtml(typeNames[type] || '成绩变动') + '详情</h3>' +
    '<div style="margin:8px 0 12px;font-size:13px;color:let(--text-muted)">班级：' + escapeHtml(classId) + ' | 变动：<span style="color:' + colorMain + ';font-weight:600">' + escapeHtml(typeNames[type]) + ' ' + sym + '</span></div>' +
    '<div class="table-wrap" style="max-height:380px;overflow:auto;border:1px solid let(--border);border-radius:6px">' +
      '<table class="task-table" style="width:100%">' +
        '<thead><tr>' +
          '<th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">维度</th>' +
          '<th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px;color:let(--text-muted)">上次 · ' + escapeHtml(p.prevExam || '—') + '</th>' +
          '<th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">本次 · ' + escapeHtml(exam) + '</th>' +
          '<th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">变化</th>' +
        '</tr></thead>' +
        '<tbody>' +
          '<tr><td style="padding:8px">分数</td><td style="padding:8px;color:let(--text-muted)">' + fmtNum(prevRec && prevRec.score) + '</td><td style="padding:8px"><strong style="font-size:15px">' + fmtNum(currRec && currRec.score) + '</strong></td><td style="padding:8px">' + fmtScoreDiff(p.scoreDiff) + '</td></tr>' +
          '<tr><td style="padding:8px">班级排名</td><td style="padding:8px;color:let(--text-muted)">' + fmtRank(prevRec && prevRec.classRank) + '</td><td style="padding:8px">' + fmtRank(currRec && currRec.classRank) + '</td><td style="padding:8px">' + fmtDiff(p.classRankDiff, ' 名') + '</td></tr>' +
          '<tr><td style="padding:8px">级部排名</td><td style="padding:8px;color:let(--text-muted)">' + fmtRank(prevRec && prevRec.gradeRank) + '</td><td style="padding:8px">' + fmtRank(currRec && currRec.gradeRank) + '</td><td style="padding:8px">' + fmtDiff(p.gradeRankDiff, ' 名') + '</td></tr>' +
          '<tr><td style="padding:8px">分层</td><td style="padding:8px">' + getScoreLayerLabel(prevScoreLayer) + '</td><td style="padding:8px">' + getScoreLayerLabel(currScoreLayer) + '</td><td style="padding:8px">' + layerChangeCell + '</td></tr>' +
          '<tr><td style="padding:8px;color:let(--text-muted)">班级均分</td><td style="padding:8px;color:let(--text-muted)">' + (prevAvg == null ? '—' : prevAvg.toFixed(2)) + '</td><td style="padding:8px">' + (currAvg == null ? '—' : currAvg.toFixed(2)) + '</td><td style="padding:8px;color:let(--text-muted)">背景参考</td></tr>' +
        '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="margin-top:12px;padding:12px;background:let(--bg-hover);border-radius:6px;font-size:13px;line-height:1.6">' +
      '<div style="font-weight:600;margin-bottom:6px;color:let(--text-heading)">📊 趋势概览</div>' +
      '<div>' + summary + '</div>' +
      '<div style="margin-top:4px;color:let(--text-muted)">该生历次考试成绩记录共 <strong>' + totalExams + '</strong> 条</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" data-click="closeModal">关闭</button>' +
    '</div>'
  );
}

function renderHwStatusBars(counts) {
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const items = [
    { label:'优秀作业', count:counts.excellent, color:'#2E7D32', status:'excellent' },
    { label:'正常完成', count:counts.normal, color:'#1565C0', status:'normal' },
    { label:'未上交', count:counts.incomplete, color:'#C62828', status:'incomplete' },
    { label:'敷衍完成', count:counts.perfunctory, color:'#E65100', status:'perfunctory' },
    { label:'已补交', count:counts.resubmitted, color:'#6A1B9A', status:'resubmitted' },
    { label:'待标记', count:counts.pending, color:'#BDBDBD', status:'pending' }
  ];
  return items.map(i => {
    const pct = total ? Math.round(i.count/total*100) : 0;
    const clickable = i.count > 0
      ? `style="cursor:pointer" data-click="showHwStatusStudents" data-click-args="[&quot;${i.status}&quot;]" title="点击查看 ${i.label} 学生名单"`
      : '';
    return `<div class="bar-chart-row">
      <div class="bar-chart-label"><span>${i.label}</span><span ${clickable}>${i.count}人 (${pct}%)</span></div>
      <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${pct}%;background:${i.color}">${pct}%</div></div>
    </div>`;
  }).join('');
}

// 点击学情看板「作业状态分布」某状态，查看该状态学生名单
function showHwStatusStudents(status) {
  const classFilter = state._dashboardClass || '';
  const statusMap = { excellent:'优秀作业', normal:'正常完成', incomplete:'未上交', perfunctory:'敷衍完成', resubmitted:'已补交', pending:'待标记' };
  let records = state.homeworkRecords;
  if (classFilter) records = records.filter(r => r.classId === classFilter);
  if (status === 'incomplete') {
    records = records.filter(r => r.status === 'incomplete' || r.status === 'perfunctory');
  } else {
    records = records.filter(r => r.status === status);
  }
  const seen = new Set();
  const students = [];
  records.forEach(r => {
    if (seen.has(r.studentId)) return;
    seen.add(r.studentId);
    const s = state.students.find(st => st.id === r.studentId);
    students.push({
      studentNo: s ? s.studentNo : (r.studentNo || '-'),
      name: s ? s.name : (r.name || '-'),
      classId: r.classId || (s ? s.classId : '-')
    });
  });
  students.sort((a, b) => (parseInt((a.studentNo||'').replace(/\D/g,''))||0) - (parseInt((b.studentNo||'').replace(/\D/g,''))||0));
  const rows = students.map(st => `<tr><td>${escapeHtml(st.studentNo)}</td><td>${escapeHtml(st.name)}</td><td>${escapeHtml(st.classId)}</td></tr>`).join('');
  openModal(`
    <h3>📋 ${statusMap[status] || status}（${students.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>班级</th></tr></thead>
        <tbody>${students.length > 0 ? rows : '<tr><td colspan="3" class="empty-state">暂无学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
}

// 点击学情看板「进退步人数统计」某档位，查看该档位学生名单
function showProgressCategoryStudents(cat) {
  const exam = state._selectedExam || getExamList()[0] || '';
  const classFilter = state._dashboardClass || '';
  let scores = exam ? state.scores.filter(s => s.examName === exam) : state.scores.slice();
  if (classFilter) scores = scores.filter(s => s.classId === classFilter);
  const matched = [];
  scores.forEach(s => {
    const p = getScoreProgress(s.studentId, exam);
    if (!p) return;
    let c;
    if (p.gradeRankDiff >= 10) c = 'up';
    else if (p.gradeRankDiff >= 3) c = 'slightUp';
    else if (p.gradeRankDiff <= -10) c = 'down';
    else if (p.gradeRankDiff <= -3) c = 'slightDown';
    else c = 'same';
    const want = cat === 'progress' ? ['up','slightUp'] : cat === 'regress' ? ['down','slightDown'] : [cat];
    if (want.includes(c)) {
      const stu = state.students.find(x => x.id === s.studentId);
      matched.push({
        studentNo: stu ? stu.studentNo : (s.studentNo || '-'),
        name: stu ? stu.name : (s.name || '-'),
        classId: s.classId, score: s.score, classRank: s.classRank, gradeRank: s.gradeRank, diff: p.gradeRankDiff
      });
    }
  });
  matched.sort((a, b) => (parseInt((a.studentNo||'').replace(/\D/g,''))||0) - (parseInt((b.studentNo||'').replace(/\D/g,''))||0));
  const labelMap = { up:'明显进步', slightUp:'小幅进步', same:'持平', slightDown:'小幅退步', down:'明显退步', progress:'进步（含小幅）', regress:'退步（含小幅）' };
  const rows = matched.map(m => `<tr><td>${escapeHtml(m.studentNo)}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.classId)}</td><td><strong>${m.score}</strong></td><td>${m.classRank||'-'}</td><td>${m.gradeRank||'-'}</td><td>${m.diff>=0?'+':''}${m.diff}</td></tr>`).join('');
  openModal(`
    <h3>📈 ${labelMap[cat] || cat}（${matched.length}人）· ${escapeHtml(exam)}</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>成绩</th><th>班排</th><th>级排</th><th>级排变化</th></tr></thead>
        <tbody>${matched.length > 0 ? rows : '<tr><td colspan="7" class="empty-state">暂无学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

// 点击学情看板「各分层人数」某层，查看该层学生名单
function showLayerStudents(layer) {
  const exam = state._selectedExam || getExamList()[0] || '';
  const classFilter = state._dashboardClass || '';
  let scores = exam ? state.scores.filter(s => s.examName === exam) : state.scores.slice();
  if (classFilter) scores = scores.filter(s => s.classId === classFilter);
  const matched = scores.filter(s => scoreToLayer(s.score) === layer);
  const title = getScoreLayerLabel(layer) || layer;
  const rows = matched.sort((a, b) => (b.score || 0) - (a.score || 0)).map(s => {
    const stu = state.students.find(x => x.id === s.studentId);
    return `<tr><td>${escapeHtml(stu ? stu.studentNo : (s.studentNo || '-'))}</td><td>${escapeHtml(stu ? stu.name : (s.name || '-'))}</td><td>${escapeHtml(s.classId || '-')}</td><td><strong>${s.score}</strong></td><td>${s.classRank || '-'}</td><td>${s.gradeRank || '-'}</td></tr>`;
  }).join('');
  openModal(`
    <h3>🎯 ${escapeHtml(title)} · ${escapeHtml(exam)}（${matched.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>成绩</th><th>班排</th><th>级排</th></tr></thead>
        <tbody>${matched.length > 0 ? rows : '<tr><td colspan="6" class="empty-state">暂无学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

// 趋势类标签（波动明显/稳步上升/稳居前列）弹窗：列出该生历次考试明细
function renderTrendDetail(studentId, type, stu, exam) {
  const trend = getStudentRankTrendUpTo(studentId, 'gradeRank', exam);
  const scores = trend.scores || [];
  if (scores.length === 0) { showToast('该生暂无考试记录', 'warn'); return; }
  const rows = scores.map(s => {
    const layer = scoreToLayer(s.score);
    return `<tr><td>${escapeHtml(s.examName)}</td><td>${s.score != null ? s.score : '-'}</td><td>${s.classRank || '-'}</td><td>${s.gradeRank || '-'}</td><td><span class="layer-badge ${scoreToLayerCSS(layer)}">${layer}层</span></td></tr>`;
  }).join('');
  let summary = '';
  const ranks = scores.map(s => s.gradeRank).filter(r => r > 0);
  if (type === 'volatile') {
    if (ranks.length >= 3) {
      const range = Math.max(...ranks) - Math.min(...ranks);
      const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const variance = ranks.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / ranks.length;
      const std = Math.sqrt(variance);
      summary = `级排波动范围 <strong>${range}</strong>，标准差 <strong>${std.toFixed(1)}</strong>（共 ${ranks.length} 次有效记录）`;
    } else {
      summary = '有效记录不足 3 次，无法计算波动';
    }
  } else if (type === 'steady') {
    const firstRank = scores[0].gradeRank, lastRank = scores[scores.length - 1].gradeRank;
    summary = `级排 ${firstRank} → ${lastRank}，累计提升 <strong>${firstRank - lastRank}</strong> 名（共 ${scores.length} 次）`;
  } else if (type === 'top') {
    const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    summary = `平均级排 <strong>${avgRank.toFixed(1)}</strong>（共 ${scores.length} 次，其中 ${ranks.length} 次有效）`;
  }
  const typeNames = { volatile:'波动明显', steady:'稳步上升', top:'稳居前列' };
  openModal(`
    <h3>📊 ${escapeHtml(stu.name || '')}（${escapeHtml(stu.studentNo || '')}）· ${typeNames[type] || '趋势'}详情</h3>
    <div style="margin:8px 0 12px;font-size:13px;color:let(--text-muted)">班级：${escapeHtml(stu.classId || '')} | 截至考试：${escapeHtml(exam)}</div>
    <div class="table-wrap" style="max-height:360px;overflow:auto;border:1px solid let(--border);border-radius:6px">
      <table class="task-table" style="width:100%">
        <thead><tr><th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">考试</th><th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">成绩</th><th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">班排</th><th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">级排</th><th style="background:let(--bg-hover);text-align:left;font-size:12px;padding:8px">分层</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;padding:12px;background:let(--bg-hover);border-radius:6px;font-size:13px;line-height:1.6">${summary}</div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

function renderLayerBars(counts, isScoreMode) {
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const items = isScoreMode
    ? [
        { label:'A+层(83-100分)', count:counts['A+'], color:'#1B5E20', layer:'A+' },
        { label:'A层(76-82分)', count:counts['A'], color:'#2E7D32', layer:'A' },
        { label:'B+层(59-75分)', count:counts['B+'], color:'let(--info)', layer:'B+' },
        { label:'B层(45-58分)', count:counts['B'], color:'#E65100', layer:'B' },
        { label:'C+层(30-44分)', count:counts['C+'], color:'let(--warning)', layer:'C+' },
        { label:'C层(<30分)', count:counts['C'], color:'let(--danger)', layer:'C' }
      ]
    : [
        { label:'A层(1-15名)', count:counts.A, color:'let(--success)' },
        { label:'B层(16-30名)', count:counts.B, color:'let(--info)' },
        { label:'C层(31-45名)', count:counts.C, color:'let(--warning)' },
        { label:'D层(46名+)', count:counts.D, color:'let(--danger)' }
      ];
  return items.map(i => {
    const pct = total ? Math.round(i.count/total*100) : 0;
    const clickable = (isScoreMode && i.layer && i.count > 0)
      ? `style="cursor:pointer" data-click="showLayerStudents" data-click-args="[&quot;${i.layer}&quot;]" title="点击查看 ${i.label} 学生名单"`
      : '';
    return `<div class="bar-chart-row">
      <div class="bar-chart-label"><span>${i.label}</span><span ${clickable}>${i.count}人 (${pct}%)</span></div>
      <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${pct}%;background:${i.color}">${pct}%</div></div>
    </div>`;
  }).join('');
}

function renderProgressBar(label, count, color, cat) {
  const clickable = cat ? `style="cursor:pointer" data-click="showProgressCategoryStudents" data-click-args="[&quot;${cat}&quot;]" title="点击查看 ${label} 学生名单"` : '';
  return `<div style="text-align:center;min-width:100px">
    <div style="font-size:24px;font-weight:700;color:${color}" ${clickable}>${count}</div>
    <div style="font-size:12px;color:let(--text-muted);margin-top:2px">${label}</div>
  </div>`;
}

/* ---- 07-2 Score Analysis ---- */
/* Layer calculation: A 1-15, B 16-30, C 31-45, D 46+ */
function rankToLayer(classRank) {
  if (classRank <= 15) return 'A';
  if (classRank <= 30) return 'B';
  if (classRank <= 45) return 'C';
  return 'D';
}

/* Score-based layer: A+(>=83), A(76-82), B+(59-75), B(45-58), C+(30-44), C(<=29) */
function scoreToLayer(score) {
  if (score == null || isNaN(score) || score === '') return '—';
  if (score >= 83) return 'A+';
  if (score >= 76) return 'A';
  if (score >= 59) return 'B+';
  if (score >= 45) return 'B';
  if (score >= 30) return 'C+';
  return 'C';
}

function scoreToLayerCSS(scoreLayer) {
  return { 'A+':'ap', 'A':'a2', 'B+':'bp', 'B':'b2', 'C+':'cp', 'C':'c2', '—':'c2' }[scoreLayer] || scoreLayer.toLowerCase();
}

// 分层结果缓存：同一渲染周期内避免重复计算（Map<studentId, layer>）
const _layerCache = new Map();
function clearLayerCache() { _layerCache.clear(); }

function getStudentLayer(student) {
  // 先查缓存（同一渲染周期内已算过则直接返回）
  if (_layerCache.has(student.id)) return _layerCache.get(student.id);

  // 计算 examDateMap（一次复用）
  let examDateMap = _layerCache._examDateMap;
  if (!examDateMap) {
    examDateMap = {};
    state.scores.forEach(s => {
      if (s.examName && s.date && !examDateMap[s.examName]) {
        examDateMap[s.examName] = s.date;
      }
    });
    _layerCache._examDateMap = examDateMap;
  }

  let layer = null;
  if (state.layerMode === 'score') {
    // 成绩分层模式：以最新考试分数为准
    const studentScores = state.scores
      .filter(s => s.studentId === student.id && s.score !== undefined && s.score !== null && s.score !== '')
      .sort((a, b) => (examDateMap[b.examName] || '').localeCompare(examDateMap[a.examName] || ''));
    if (studentScores.length > 0) layer = scoreToLayer(studentScores[0].score);
  } else {
    // 班级分层模式（默认）：以最新考试班级排名为准
    const studentScores = state.scores
      .filter(s => s.studentId === student.id && s.classRank)
      .sort((a, b) => (examDateMap[b.examName] || '').localeCompare(examDateMap[a.examName] || ''));
    if (studentScores.length > 0) layer = rankToLayer(studentScores[0].classRank);
  }

  // 若 scoreToLayer 返回 '—'（破折号表示无效分数），也视为未分层
  if (layer === '—' || layer === '') layer = null;

  _layerCache.set(student.id, layer);
  return layer;
}

function getLayerBadgeClass(student) {
  const layer = getStudentLayer(student);
  if (layer === null) return 'none';
  if (state.layerMode === 'score') return scoreToLayerCSS(layer);
  return layer.toLowerCase();
}

function getClassLayerLabel(layer) {
  return { A:'A层(班排1-15名)', B:'B层(班排16-30名)', C:'C层(班排31-45名)', D:'D层(班排46名+)' }[layer] || layer;
}

function getScoreLayerLabel(layer) {
  return { 'A+':'A+层(≥83分)', 'A':'A层(76-82分)', 'B+':'B+层(59-75分)', 'B':'B层(45-58分)', 'C+':'C+层(30-44分)', 'C':'C层(≤29分)' }[layer] || layer;
}

function getLayerLabel(layer) {
  if (state.layerMode === 'score') return getScoreLayerLabel(layer);
  return getClassLayerLabel(layer);
}

function recalculateRanks(examName) {
  const examScores = state.scores.filter(s => s.examName === examName);
  if (examScores.length === 0) return;
  // Grade rank
  const gradeSorted = [...examScores].sort((a,b) => b.score - a.score);
  gradeSorted.forEach((s, i) => { s.gradeRank = i + 1; });
  // Class rank — 计算所有班级（含导入的非任教班级）
  const allClasses = getAllClasses();
  allClasses.forEach(cls => {
    const classScores = examScores.filter(s => s.classId === cls).sort((a,b) => b.score - a.score);
    classScores.forEach((s, i) => { s.classRank = i + 1; });
  });
}

function getExamList() {
  const set = [...new Set(state.scores.map(s => s.examName).filter(Boolean))];
  // 按该考试最早 score.date 升序；无日期的排最后
  const dateOf = {};
  state.scores.forEach(s => {
    if (!s.examName || !s.date) return;
    const k = s.examName;
    if (!dateOf[k] || s.date < dateOf[k]) dateOf[k] = s.date;
  });
  return set.sort((a, b) => {
    const da = dateOf[a] || '\u9999';
    const db = dateOf[b] || '\u9999';
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

function getScoreProgress(studentId, currentExam) {
  const exams = getExamList();
  const idx = exams.indexOf(currentExam);
  if (idx <= 0) return null;
  const prevExam = exams[idx - 1];
  const curr = state.scores.find(s => s.studentId === studentId && s.examName === currentExam);
  const prev = state.scores.find(s => s.studentId === studentId && s.examName === prevExam);
  if (!curr || !prev) return null;
  const scoreDiff = curr.score - prev.score;
  const classRankDiff = (prev.classRank || 999) - (curr.classRank || 999);
  const gradeRankDiff = (prev.gradeRank || 999) - (curr.gradeRank || 999);
  // Layer change
  const prevLayer = rankToLayer(prev.classRank || 999);
  const currLayer = rankToLayer(curr.classRank || 999);
  let layerChange = 'same';
  if (currLayer < prevLayer) layerChange = 'up';
  else if (currLayer > prevLayer) layerChange = 'down';
  // Progress label — 以级排变化为准
  let progressLabel, progressColor;
  if (gradeRankDiff >= 10) { progressLabel = '明显进步'; progressColor = '#2E7D32'; }
  else if (gradeRankDiff >= 3) { progressLabel = '小幅进步'; progressColor = '#81C784'; }
  else if (gradeRankDiff <= -10) { progressLabel = '明显退步'; progressColor = '#C62828'; }
  else if (gradeRankDiff <= -3) { progressLabel = '小幅退步'; progressColor = '#FFB74D'; }
  else { progressLabel = '持平'; progressColor = '#9E9E9E'; }
  return { scoreDiff, classRankDiff, gradeRankDiff, prevLayer, currLayer, layerChange, progressLabel, progressColor, prevExam };
}

/* ---- 成绩排名趋势图表 ---- */
function getStudentRankTrend(studentId, rankField) {
  // 获取该学生所有考试的成绩记录，按日期排序
  const studentScores = state.scores
    .filter(s => s.studentId === studentId && s.examName)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (studentScores.length === 0) return { labels: [], data: [], scores: [] };
  return {
    labels: studentScores.map(s => s.examName),
    data: studentScores.map(s => s[rankField] || 0),
    scores: studentScores
  };
}

function getTrendSummary(studentId, rankField) {
  const studentScores = state.scores
    .filter(s => s.studentId === studentId && s.examName)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (studentScores.length < 2) return null;
  const latest = studentScores[studentScores.length - 1];
  const prev = studentScores[studentScores.length - 2];
  const diff = (prev[rankField] || 999) - (latest[rankField] || 999); // 正数=进步(排名上升)
  let label, color, icon;
  if (diff >= 20) { label = '大幅进步'; color = '#1B5E20'; icon = '🚀'; }
  else if (diff >= 8) { label = '明显进步'; color = '#2E7D32'; icon = '📈'; }
  else if (diff >= 3) { label = '小幅进步'; color = '#66BB6A'; icon = '👍'; }
  else if (diff >= -2) { label = '基本持平'; color = '#9E9E9E'; icon = '➡️'; }
  else if (diff >= -7) { label = '小幅退步'; color = '#FFA726'; icon = '⚠️'; }
  else if (diff >= -19) { label = '明显退步'; color = '#EF5350'; icon = '📉'; }
  else { label = '大幅退步'; color = '#C62828'; icon = '🔻'; }
  const typeName = rankField === 'classRank' ? '班排' : '级排';
  return {
    label, color, icon, diff,
    prevExam: prev.examName, prevRank: prev[rankField], prevScore: prev.score,
    latestExam: latest.examName, latestRank: latest[rankField], latestScore: latest.score,
    typeName
  };
}

// 获取指定考试与前一次考试的排名变化（用于看板）
function getExamVsPrev(studentId, selectedExam, rankField) {
  const studentScores = state.scores
    .filter(s => s.studentId === studentId && s.examName)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (studentScores.length < 2) return null;
  // 找 selectedExam 和它紧前面的考试
  let currIdx = -1;
  for (let i = 0; i < studentScores.length; i++) {
    if (studentScores[i].examName === selectedExam) { currIdx = i; break; }
  }
  if (currIdx <= 0) return null; // 没有前一次考试
  const prev = studentScores[currIdx - 1];
  const curr = studentScores[currIdx];
  const diff = (prev[rankField] || 999) - (curr[rankField] || 999); // 正数=进步
  let label, color;
  if (diff >= 20) { label = '大幅进步'; color = '#1B5E20'; }
  else if (diff >= 8) { label = '明显进步'; color = '#2E7D32'; }
  else if (diff >= 3) { label = '小幅进步'; color = '#66BB6A'; }
  else if (diff >= -2) { label = '基本持平'; color = '#9E9E9E'; }
  else if (diff >= -7) { label = '小幅退步'; color = '#FFA726'; }
  else if (diff >= -19) { label = '明显退步'; color = '#EF5350'; }
  else { label = '大幅退步'; color = '#C62828'; }
  return {
    label, color, diff,
    prevExam: prev.examName, prevRank: prev[rankField],
    currExam: curr.examName, currRank: curr[rankField],
    studentScores // 返回完整序列供波动/稳步分析
  };
}

// 获取截至指定考试的学生排名趋势（只看 ≤ selectedExam 的记录）
function getStudentRankTrendUpTo(studentId, rankField, selectedExam) {
  let studentScores = state.scores
    .filter(s => s.studentId === studentId && s.examName)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (selectedExam) {
    // 只取 selectedExam 及之前的考试
    const idx = studentScores.findIndex(s => s.examName === selectedExam);
    if (idx >= 0) studentScores = studentScores.slice(0, idx + 1);
  }
  if (studentScores.length === 0) return { labels: [], data: [], scores: [] };
  return {
    labels: studentScores.map(s => s.examName),
    data: studentScores.map(s => s[rankField] || 0),
    scores: studentScores
  };
}

let _trendChartInstance = null;
function destroyTrendChart() {
  if (_trendChartInstance) { _trendChartInstance.destroy(); _trendChartInstance = null; }
}

function renderTrendChart(studentId, rankField, containerId) {
  const trend = getStudentRankTrend(studentId, rankField);
  if (trend.labels.length === 0) {
    document.getElementById(containerId).innerHTML = '<div class="empty-state">暂无成绩数据</div>';
    return;
  }
  // Reverse for chart display (oldest to newest, left to right)
  const labels = trend.labels;
  const data = trend.data;
  const ctx = document.getElementById(containerId);
  if (!ctx) return;
  destroyTrendChart();
  const typeName = rankField === 'classRank' ? '班级排名' : '年级排名';
  const colorMain = rankField === 'classRank' ? '#4CAF50' : '#42A5F5';
  _trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: typeName,
        data: data,
        borderColor: colorMain,
        backgroundColor: colorMain + '20',
        borderWidth: 2.5,
        pointBackgroundColor: colorMain,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          reverse: true, // 排名越小越好
          title: { display: true, text: '排名', font: { size: 13 } },
          ticks: { stepSize: 5, font: { size: 11 } },
          min: 1
        },
        x: {
          title: { display: true, text: '考试', font: { size: 13 } },
          ticks: { font: { size: 11 }, maxRotation: 45 }
        }
      }
    }
  });
}

function openClassRankTrend(studentId) {
  const s = state.students.find(x => x.id === studentId);
  if (!s) return;
  const summary = getTrendSummary(studentId, 'classRank');
  closeModal();
  openModal(`
    <h3>📊 ${escapeHtml(s.name)} — 班级排名趋势</h3>
    <div class="trend-canvas-wrapper"><canvas id="trendChartCanvas"></canvas></div>
    ${summary ? `
    <div class="trend-summary">
      <h4>最新两次对比小结</h4>
      <div style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:8px">
        <span style="font-size:24px">${summary.icon}</span>
        <span style="font-weight:700;color:${summary.color}">${summary.label}</span>
        <span style="color:let(--text-muted);font-size:12px">（排名差: ${summary.diff > 0 ? '+' + summary.diff : summary.diff}）</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
        <div>
          <span class="text-muted">上次「${escapeHtml(summary.prevExam)}」</span><br>
          班排 <strong>${summary.prevRank}</strong> · 成绩 <strong>${summary.prevScore}</strong>
        </div>
        <div>
          <span class="text-muted">最新「${escapeHtml(summary.latestExam)}」</span><br>
          班排 <strong>${summary.latestRank}</strong> · 成绩 <strong>${summary.latestScore}</strong>
        </div>
      </div>
    </div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
  // 在modal渲染完成后渲染chart
  setTimeout(function() { renderTrendChart(studentId, 'classRank', 'trendChartCanvas'); }, 100);
}

function openGradeRankTrend(studentId) {
  const s = state.students.find(x => x.id === studentId);
  if (!s) return;
  const summary = getTrendSummary(studentId, 'gradeRank');
  closeModal();
  openModal(`
    <h3>📈 ${escapeHtml(s.name)} — 年级排名趋势</h3>
    <div class="trend-canvas-wrapper"><canvas id="trendChartCanvas"></canvas></div>
    ${summary ? `
    <div class="trend-summary">
      <h4>最新两次对比小结</h4>
      <div style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:8px">
        <span style="font-size:24px">${summary.icon}</span>
        <span style="font-weight:700;color:${summary.color}">${summary.label}</span>
        <span style="color:let(--text-muted);font-size:12px">（排名差: ${summary.diff > 0 ? '+' + summary.diff : summary.diff}）</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
        <div>
          <span class="text-muted">上次「${escapeHtml(summary.prevExam)}」</span><br>
          级排 <strong>${summary.prevRank}</strong> · 成绩 <strong>${summary.prevScore}</strong>
        </div>
        <div>
          <span class="text-muted">最新「${escapeHtml(summary.latestExam)}」</span><br>
          级排 <strong>${summary.latestRank}</strong> · 成绩 <strong>${summary.latestScore}</strong>
        </div>
      </div>
    </div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
    </div>
  `);
  setTimeout(function() { renderTrendChart(studentId, 'gradeRank', 'trendChartCanvas'); }, 100);
}

function renderScoreAnalysis(container) {
  const exams = getExamList();
  const selectedExam = state._selectedExam || exams[0] || '';
  const classFilter = state._scoreClassFilter || '';
  // Recalculate ranks for selected exam
  if (selectedExam) recalculateRanks(selectedExam);

  let scores = state.scores.filter(s => s.examName === selectedExam);
  if (classFilter) scores = scores.filter(s => s.classId === classFilter);

  // 补全未参加考试的学生（显示"未考试"）
  if (selectedExam) {
    const scoreStudentIds = new Set(scores.map(s => s.studentId));
    const scopeClasses = classFilter ? [classFilter] : getAllClasses();
    const unexamined = [];
    scopeClasses.forEach(cls => {
      const classStudents = state.students.filter(s => s.classId === cls);
      classStudents.forEach(s => {
        if (!scoreStudentIds.has(s.id)) {
          unexamined.push({
            id: '__unexam_' + s.id,
            studentId: s.id,
            name: s.name,
            classId: s.classId,
            score: null,
            examName: selectedExam,
            date: '',
            classRank: null,
            gradeRank: null,
            _unexam: true
          });
        }
      });
    });
    scores = scores.concat(unexamined);
  }

  // 排序：学号/成绩/班排/级排（未考试学生排末尾）
  const sort = state._scoreSort || { col: 'score', dir: 'desc' };
  const examined = scores.filter(s => !s._unexam);
  const unexaminedOnly = scores.filter(s => s._unexam);
  examined.sort((a, b) => {
    let va, vb;
    switch (sort.col) {
      case 'studentNo':
        { const sa = state.students.find(st => st.id === a.studentId); const sb = state.students.find(st => st.id === b.studentId); va = sa ? sa.studentNo : ''; vb = sb ? sb.studentNo : '';
        const na = parseInt(va.replace(/\D/g,'')) || 0;
        const nb = parseInt(vb.replace(/\D/g,'')) || 0;
        va = na; vb = nb; }
        break;
      case 'score': va = a.score; vb = b.score; break;
      case 'classRank': va = a.classRank || 999; vb = b.classRank || 999; break;
      case 'gradeRank': va = a.gradeRank || 999; vb = b.gradeRank || 999; break;
      default: va = a.score; vb = b.score;
    }
    if (va < vb) return sort.dir === 'asc' ? -1 : 1;
    if (va > vb) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  scores = examined.concat(unexaminedOnly);

  const stats = getScoreStats(scores);
  const dashboard = getScoreDashboardData(selectedExam, classFilter);
  const showRegress = state._scoreShowRegress !== false;
  const showVolatile = state._scoreShowVolatile !== false;
  const showSteady = state._scoreShowSteady !== false;
  const showTop = state._scoreShowTop !== false;
  const showProgress = state._scoreShowProgress !== false;

  const concernItems = dashboard.concern.filter(item => {
    if (item.label === '退步明显' || item.label.indexOf('退步') >= 0) return showRegress;
    if (item.label === '波动明显' || item.label.indexOf('波动') >= 0) return showVolatile;
    return true;
  });
  const praiseItems = dashboard.praise.filter(item => {
    if (item.label === '稳步上升') return showSteady;
    if (item.label === '稳居前列') return showTop;
    if (item.label.indexOf('进步') >= 0) return showProgress;
    return true;
  });

  // 生成班级筛选下拉框选项（动态获取所有班级，任教班+其他班分组）
  const allCls = getAllClasses();
  const mineCls = allCls.filter(c => isMyClass(c));
  const otherCls = allCls.filter(c => !isMyClass(c));
  let classOptionsHtml = '<option value="">全年级</option>';
  if (mineCls.length > 0) {
    classOptionsHtml += '<optgroup label="── 任教班级 ──">';
    classOptionsHtml += mineCls.map(c => '<option value="' + escapeAttr(c) + '"' + (c===classFilter?' selected':'') + '>' + escapeHtml(c) + '</option>').join('');
    classOptionsHtml += '</optgroup>';
  }
  if (otherCls.length > 0) {
    classOptionsHtml += '<optgroup label="── 其他班级（仅成绩）──">';
    classOptionsHtml += otherCls.map(c => '<option value="' + escapeAttr(c) + '"' + (c===classFilter?' selected':'') + '>' + escapeHtml(c) + '</option>').join('');
    classOptionsHtml += '</optgroup>';
  }

  const thClass = (col) => {
    const active = sort.col === col;
    return `sortable ${active ? (sort.dir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`;
  };

  container.innerHTML = `
    <div class="toolbar">
      <div class="search-bar" style="flex:1;margin-bottom:0">
        <select class="form-select" id="examFilter" style="width:180px" data-ev="change" data-ev-key="ev48">
          ${exams.length ? exams.map(e => `<option value="${escapeHtml(e)}" ${e===selectedExam?'selected':''}>${escapeHtml(e)}</option>`).join('') : '<option value="">暂无考试</option>'}
        </select>
        <select class="form-select" id="scoreClassFilter" style="width:140px" data-ev="change" data-ev-key="ev49">
          ${classOptionsHtml}
        </select>
      </div>
      <div class="flex-between gap-8">
        <button class="btn btn-outline" data-click="downloadScoreTemplate">⬇️ 模板</button>
        <button class="btn btn-outline" data-click="openScoreEntryModal">✏️ 成绩录入</button>
        <button class="btn btn-outline" data-click="__dcClickEl" data-click-args="[&quot;scoreUpload&quot;]">📤 批量导入</button>
        <button class="btn btn-outline" data-click="exportScoresCSV">📊 导出Excel</button>
        <button class="btn btn-primary" data-click="__dcPrint">🖨️ 导出PDF</button>
        <input type="file" id="scoreUpload" accept=".csv" style="display:none" data-ev="change" data-ev-key="ev50">
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-num">${examined.length} / ${examined.length + unexaminedOnly.length}</div><div class="stat-label">参考 / 全班</div></div>
      <div class="stat-card"><span class="stat-icon">📊</span><div class="stat-num">${stats.avg.toFixed(2)}</div><div class="stat-label">平均分</div></div>
      <div class="stat-card"><span class="stat-icon">🏆</span><div class="stat-num">${stats.max}</div><div class="stat-label">最高分</div></div>
      <div class="stat-card"><span class="stat-icon">📉</span><div class="stat-num">${stats.min}</div><div class="stat-label">最低分</div></div>
    </div>

    <!-- 成绩分析看板 -->
    <div class="dashboard-section">
      <div class="dashboard-grid">
        <div class="dashboard-card">
          <h4>
            <span>🔴 重点关注</span>
            <div class="dashboard-toggles">
              <label class="dashboard-toggle"><input type="checkbox" ${showRegress?'checked':''} data-ev="change" data-ev-key="ev51"> 退步明显</label>
              <label class="dashboard-toggle"><input type="checkbox" ${showVolatile?'checked':''} data-ev="change" data-ev-key="ev52"> 波动明显</label>
              <button class="btn-toggle-all" data-click="toggleAllDashboard" data-click-args="[&quot;concern&quot;]">${(showRegress&&showVolatile)?'取消全部':'全部显示'}</button>
            </div>
          </h4>
          <div class="dashboard-list">
            ${concernItems.length === 0 ? '<div class="text-muted text-sm">暂无重点关注学生</div>' : concernItems.map(item => `
              <div class="dashboard-item">
                <div>
                  <span class="dashboard-item-name">${escapeHtml(item.name)}</span>
                  <span class="dashboard-item-info">${escapeHtml(item.classId)} · ${item.info}</span>
                </div>
                <span class="dashboard-badge" style="background:${item.color}20;color:${item.color};cursor:pointer" data-click="showKeyStudentDetail" data-click-args="[&quot;${item.studentId}&quot;, &quot;${item.type}&quot;]" title="点击查看详情">${item.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="dashboard-card">
          <h4>
            <span>🟢 表扬榜单</span>
            <div class="dashboard-toggles">
              <label class="dashboard-toggle"><input type="checkbox" ${showSteady?'checked':''} data-ev="change" data-ev-key="ev53"> 稳步上升</label>
              <label class="dashboard-toggle"><input type="checkbox" ${showTop?'checked':''} data-ev="change" data-ev-key="ev54"> 稳居前列</label>
              <label class="dashboard-toggle"><input type="checkbox" ${showProgress?'checked':''} data-ev="change" data-ev-key="ev55"> 进步明显</label>
              <button class="btn-toggle-all" data-click="toggleAllDashboard" data-click-args="[&quot;praise&quot;]">${(showSteady&&showTop&&showProgress)?'取消全部':'全部显示'}</button>
            </div>
          </h4>
          <div class="dashboard-list">
            ${praiseItems.length === 0 ? '<div class="text-muted text-sm">暂无表扬学生</div>' : praiseItems.map(item => `
              <div class="dashboard-item">
                <div>
                  <span class="dashboard-item-name">${escapeHtml(item.name)}</span>
                  <span class="dashboard-item-info">${escapeHtml(item.classId)} · ${item.info}</span>
                </div>
                <span class="dashboard-badge" style="background:${item.color}20;color:${item.color};cursor:pointer" data-click="showKeyStudentDetail" data-click-args="[&quot;${item.studentId}&quot;, &quot;${item.type}&quot;]" title="点击查看详情">${item.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="analysis-card">
      <h3>分数段分布</h3>
      ${renderScoreDistribution(stats.distribution)}
    </div>
    <div class="analysis-card" style="margin-top:16px">
      <h3>成绩明细与排名</h3>
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="btn btn-danger" id="scoreBatchDeleteBtn" data-click="batchDeleteScores" disabled style="font-size:12px;padding:4px 12px">🗑️ 批量删除 (<span id="scoreSelCount">0</span>)</button>
      </div>
      <div style="overflow-x:auto">
      <table class="score-table" style="width:100%">
        <thead><tr>
          <th style="width:30px"><input type="checkbox" id="scoreSelectAll" title="全选本场"></th>
          <th class="${thClass('studentNo')}" data-click="setScoreSort" data-click-args="[&quot;studentNo&quot;]">学号</th>
          <th>姓名</th>
          <th>班级</th>
          <th class="${thClass('score')}" data-click="setScoreSort" data-click-args="[&quot;score&quot;]">成绩</th>
          <th class="${thClass('classRank')}" data-click="setScoreSort" data-click-args="[&quot;classRank&quot;]">班排</th>
          <th class="${thClass('gradeRank')}" data-click="setScoreSort" data-click-args="[&quot;gradeRank&quot;]">级排</th>
          <th>分层</th><th>分层变动</th><th>进退步</th><th>操作</th>
        </tr></thead>
        <tbody>
        ${scores.length === 0 ? '<tr><td colspan="10" class="empty-state">暂无成绩数据</td></tr>' : scores.map(s => {
          if (s._unexam) {
            const student = state.students.find(st => st.id === s.studentId);
            const studentNo = student ? student.studentNo : '-';
            // 找该学生最近一次其他考试的成绩，取对应分层
            const prevScores = state.scores
              .filter(sc => sc.studentId === s.studentId && sc.examName !== selectedExam)
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            let prevLayer = null, prevLayerCSS = '';
            if (prevScores.length > 0) {
              prevLayer = scoreToLayer(prevScores[0].score);
              prevLayerCSS = scoreToLayerCSS(prevLayer);
            }
            const layerCell = prevLayer
              ? `<span class="layer-badge ${prevLayerCSS}" title="上次考试：${escapeAttr(prevScores[0].examName)}（${prevScores[0].score}分）">${prevLayer}层</span>`
              : '<span style="color:let(--text-muted);font-style:italic">未分层</span>';
            return `<tr style="opacity:0.6;background:let(--bg-hover)">
              <td><input type="checkbox" class="score-del-cb" disabled style="opacity:0.35;cursor:not-allowed"></td>
              <td>${escapeHtml(studentNo)}</td>
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.classId)}</td>
              <td><span style="color:let(--text-muted);font-style:italic">未考试</span></td>
              <td>-</td><td>-</td>
              <td>${layerCell}</td>
              <td>-</td><td>-</td><td></td>
            </tr>`;
          }
          const student = state.students.find(st => st.id === s.studentId);
          const studentNo = student ? student.studentNo : '-';
          const layer = scoreToLayer(s.score);
          const layerCSS = scoreToLayerCSS(layer);
          const progress = getScoreProgress(s.studentId, selectedExam) || {};
          const layerType = progress.layerChange === 'up' ? 'layer_up' : progress.layerChange === 'down' ? 'layer_down' : 'layer_flat';
          const layerDataClick = `data-click="showKeyStudentDetail" data-click-args="[&quot;${s.studentId}&quot;, &quot;${layerType}&quot;]"`;
          const layerChangeBadge = progress.layerChange === 'up'
            ? `<span style="background:#C8E6C9;color:#1B5E20;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer" ${layerDataClick} title="点击查看分层变动详情">↑ 分层提升</span>`
            : progress.layerChange === 'down'
            ? `<span style="background:#FFCDD2;color:#B71C1C;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer" ${layerDataClick} title="点击查看分层变动详情">↓ 分层下滑</span>`
            : `<span style="background:#E0E0E0;color:#616161;padding:2px 8px;border-radius:10px;font-size:11px;cursor:pointer" ${layerDataClick} title="点击查看分层变动详情">→ 持平</span>`;
          let progType = null;
          if (progress.progressLabel === '明显进步') progType = 'progress_up';
          else if (progress.progressLabel === '小幅进步') progType = 'slight_up';
          else if (progress.progressLabel === '持平') progType = 'flat';
          else if (progress.progressLabel === '小幅退步') progType = 'slight_down';
          else if (progress.progressLabel === '明显退步') progType = 'progress_down';
          const progDataClick = progType ? `data-click="showKeyStudentDetail" data-click-args="[&quot;${s.studentId}&quot;, &quot;${progType}&quot;]"` : '';
          const progressBadge = progress.progressLabel
            ? `<span style="background:${progress.progressColor}20;color:${progress.progressColor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer" ${progDataClick} title="点击查看进退步详情">${progress.progressLabel}</span>`
            : '<span class="text-muted text-sm">首次</span>';
          return `<tr>
            <td><input type="checkbox" class="score-del-cb" data-sid="${escapeAttr(s.id)}"></td>
            <td>${escapeHtml(studentNo)}</td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.classId)}</td>
            <td><strong>${s.score}</strong></td>
            <td>${s.classRank || '-'}</td>
            <td>${s.gradeRank || '-'}</td>
            <td><span class="layer-badge ${layerCSS}">${layer}层</span></td>
            <td>${layerChangeBadge}</td>
            <td>${progressBadge}${progress.gradeRankDiff !== undefined ? `<div style="font-size:10px;color:let(--text-muted);margin-top:2px">级排${progress.gradeRankDiff>=0?'+':''}${progress.gradeRankDiff}</div>` : ''}</td>
            <td>
              <button class="btn-icon" data-click="editScore" data-click-args="${escapeAttr(JSON.stringify([s.id]))}" title="编辑成绩">✏️</button>
              <button class="btn-icon" data-click="deleteScore" data-click-args="${escapeAttr(JSON.stringify([s.id]))}" title="删除成绩">🗑️</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function toggleAllDashboard(section) {
  const allOn = section === 'concern'
    ? (state._scoreShowRegress !== false && state._scoreShowVolatile !== false)
    : (state._scoreShowSteady !== false && state._scoreShowTop !== false && state._scoreShowProgress !== false);
  const newVal = !allOn;
  if (section === 'concern') {
    state._scoreShowRegress = newVal;
    state._scoreShowVolatile = newVal;
  } else {
    state._scoreShowSteady = newVal;
    state._scoreShowTop = newVal;
    state._scoreShowProgress = newVal;
  }
  saveState();
  renderScoreAnalysis(document.getElementById('analysisContainer'));
}

function setScoreSort(col) {
  const current = state._scoreSort || { col: 'score', dir: 'desc' };
  let dir;
  if (current.col === col) {
    dir = current.dir === 'asc' ? 'desc' : 'asc';
  } else {
    // 新列默认：学号/班排/级排升序，成绩降序
    dir = (col === 'studentNo' || col === 'classRank' || col === 'gradeRank') ? 'asc' : 'desc';
  }
  state._scoreSort = { col, dir };
  saveState();
  renderScoreAnalysis(document.getElementById('analysisContainer'));
}

function getScoreDashboardData(selectedExam, classFilter) {
  const concern = [];
  const praise = [];
  const processed = new Set();

  let students = [...state.students];
  // 补充仅存在于成绩中（无学生档案）的学生 —— 例如从CSV导入的非任教班级学生
  if (selectedExam) {
    const scoreStudents = state.scores.filter(s => s.examName === selectedExam);
    const existingIds = new Set(students.map(s => s.id));
    scoreStudents.forEach(s => {
      if (!existingIds.has(s.studentId)) {
        students.push({
          id: s.studentId,
          name: s.name,
          classId: s.classId,
          studentNo: ''
        });
        existingIds.add(s.studentId);
      }
    });
  }
  if (classFilter) students = students.filter(s => s.classId === classFilter);
  if (selectedExam) {
    const examStudentIds = new Set(state.scores.filter(s => s.examName === selectedExam).map(s => s.studentId));
    students = students.filter(s => examStudentIds.has(s.id));
  }

  students.forEach(s => {
    const trend = getStudentRankTrendUpTo(s.id, 'gradeRank', selectedExam);
    if (trend.scores.length === 0) return;
    // selectedExam vs 前一次考试对比（核心）
    const cmp = getExamVsPrev(s.id, selectedExam, 'gradeRank');

    // 退步明显：选中考试 vs 前一次，级排下滑 ≥ 8
    if (cmp && cmp.diff <= -8 && !processed.has(s.id + '-regress')) {
      concern.push({
        studentId: s.id, name: s.name, classId: s.classId, type: 'regress',
        label: cmp.label, color: cmp.color,
        info: `级排 ${cmp.prevRank} → ${cmp.currRank}（vs ${cmp.prevExam}）`
      });
      processed.add(s.id + '-regress');
    }

    // 波动幅度明显：截至选中考试，至少3次，级排极差 ≥ 20 或标准差 ≥ 8
    if (trend.scores.length >= 3) {
      const ranks = trend.data.filter(r => r > 0);
      if (ranks.length >= 3) {
        const avg = ranks.reduce((a,b)=>a+b,0) / ranks.length;
        const variance = ranks.reduce((sum,r)=>sum + Math.pow(r-avg,2),0) / ranks.length;
        const std = Math.sqrt(variance);
        const range = Math.max(...ranks) - Math.min(...ranks);
        if ((range >= 20 || std >= 8) && !processed.has(s.id + '-volatile')) {
          concern.push({
            studentId: s.id, name: s.name, classId: s.classId, type: 'volatile',
            label: '波动明显', color: '#EF6C00',
            info: `级排波动范围 ${range}，标准差 ${std.toFixed(1)}`
          });
          processed.add(s.id + '-volatile');
        }
      }
    }

    // 稳步上升：截至选中考试，级排逐次提升（提升占比 ≥ 60% 且首尾差 ≥ 3）
    if (trend.scores.length >= 2) {
      const firstRank = trend.data[0];
      const lastRank = trend.data[trend.data.length - 1];
      let improveCount = 0;
      for (let i = 1; i < trend.data.length; i++) {
        if (trend.data[i] < trend.data[i-1]) improveCount++;
      }
      const improveRatio = improveCount / (trend.data.length - 1);
      if ((improveRatio >= 0.6 && (firstRank - lastRank) >= 3) && !processed.has(s.id + '-steady')) {
        praise.push({
          studentId: s.id, name: s.name, classId: s.classId, type: 'steady',
          label: '稳步上升', color: '#1B5E20',
          info: `级排 ${firstRank} → ${lastRank}`
        });
        processed.add(s.id + '-steady');
      }
    }

    // 稳居前列：截至选中考试，平均级排 ≤ 20
    if (trend.scores.length >= 1) {
      const ranks = trend.data.filter(r => r > 0);
      if (ranks.length > 0) {
        const avgRank = ranks.reduce((a,b)=>a+b,0) / ranks.length;
        if (avgRank <= 20 && !processed.has(s.id + '-top')) {
          praise.push({
            studentId: s.id, name: s.name, classId: s.classId, type: 'top',
            label: '稳居前列', color: '#1565C0',
            info: `平均级排 ${avgRank.toFixed(1)}`
          });
          processed.add(s.id + '-top');
        }
      }
    }

    // 进步明显：选中考试 vs 前一次，级排提升 ≥ 8
    if (cmp && cmp.diff >= 8 && !processed.has(s.id + '-progress')) {
      praise.push({
        studentId: s.id, name: s.name, classId: s.classId, type: 'progress_up',
        label: cmp.label, color: cmp.color,
        info: `级排 ${cmp.prevRank} → ${cmp.currRank}（vs ${cmp.prevExam}）`
      });
      processed.add(s.id + '-progress');
    }
  });

  return { concern, praise };
}

function getScoreStats(scores) {
  const arr = (scores || state.scores).map(s => s.score).filter(v => v != null && !isNaN(v));
  const count = arr.length;
  if (count === 0) return { count:0, avg:0, max:0, min:0, distribution:{ap:0,a:0,bp:0,b:0,cp:0,c:0} };
  const avg = Number((arr.reduce((a,b)=>a+b,0)/count).toFixed(2));
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const dist = { ap:0, a:0, bp:0, b:0, cp:0, c:0 };
  const layerKeyMap = { 'A+':'ap', 'A':'a', 'B+':'bp', 'B':'b', 'C+':'cp', 'C':'c' };
  arr.forEach(s => {
    const layer = scoreToLayer(s);
    const key = layerKeyMap[layer];
    if (key !== undefined) dist[key]++;
  });
  return { count, avg, max, min, distribution: dist };
}

function renderScoreDistribution(dist) {
  const ranges = [
    { label:'83-100分 (A+层)', key:'ap', color:'let(--success)' },
    { label:'76-82分 (A层)', key:'a', color:'#4CAF50' },
    { label:'59-75分 (B+层)', key:'bp', color:'let(--info)' },
    { label:'45-58分 (B层)', key:'b', color:'#2196F3' },
    { label:'30-44分 (C+层)', key:'cp', color:'let(--warning)' },
    { label:'30分以下 (C层)', key:'c', color:'let(--danger)' }
  ];
  const total = Object.values(dist).reduce((a,b)=>a+b,0);
  return ranges.map(r => {
    const count = dist[r.key] || 0;
    const pct = total ? Math.round(count/total*100) : 0;
    const clickable = count > 0
      ? `style="cursor:pointer" data-click="showScoreRangeStudents" data-click-args="[&quot;${r.key}&quot;]" title="点击查看 ${r.label} 学生名单"`
      : '';
    return `
      <div class="bar-chart-row">
        <div class="bar-chart-label"><span>${r.label}</span><span ${clickable}>${count}人 (${pct}%)</span></div>
        <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${pct}%;background:${r.color}">${pct}%</div></div>
      </div>
    `;
  }).join('');
}

// 点击分数段查看该区间学生名单
function showScoreRangeStudents(rangeKey) {
  const layerKeyMap = { 'A+':'ap', 'A':'a', 'B+':'bp', 'B':'b', 'C+':'cp', 'C':'c' };
  const rangeLabelMap = {
    ap:'83-100分 (A+层)', a:'76-82分 (A层)', bp:'59-75分 (B+层)',
    b:'45-58分 (B层)', cp:'30-44分 (C+层)', c:'30分以下 (C层)'
  };
  const exam = state._selectedExam || getExamList()[0] || '';
  const classFilter = state._scoreClassFilter || '';
  let scores = exam ? state.scores.filter(s => s.examName === exam) : state.scores.slice();
  if (classFilter) scores = scores.filter(s => s.classId === classFilter);
  const matched = scores.filter(s => {
    const layer = scoreToLayer(s.score);
    return layerKeyMap[layer] === rangeKey;
  });
  const title = rangeLabelMap[rangeKey] || '分数段';
  const rows = matched
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map(s => {
      const stu = state.students.find(x => x.id === s.studentId);
      return `<tr>
        <td>${escapeHtml(stu ? stu.studentNo : (s.studentNo || '-'))}</td>
        <td>${escapeHtml(stu ? stu.name : (s.name || '-'))}</td>
        <td>${escapeHtml(s.classId || '-')}</td>
        <td><strong>${s.score}</strong></td>
        <td>${s.classRank || '-'}</td>
        <td>${s.gradeRank || '-'}</td>
      </tr>`;
    }).join('');
  openModal(`
    <h3>📊 ${escapeHtml(title)} · ${escapeHtml(exam)} (${matched.length}人)</h3>
    <div class="table-wrap" style="max-height:360px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>成绩</th><th>班排</th><th>级排</th></tr></thead>
        <tbody>${matched.length > 0 ? rows : '<tr><td colspan="6" class="empty-state">暂无学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
}
function downloadScoreTemplate() {
  const csv = '\ufeff学号,姓名,班级,成绩,考试名称,日期\n1001,张三,1班,85,第一章单元测,2026-09-10\n1002,李四,1班,92,第一章单元测,2026-09-10\n2001,王五,2班,78,第一章单元测,2026-09-10\n3001,赵六,3班,88,第一章单元测,2026-09-10\n';
  downloadFile(csv, '学生成绩模板.csv', 'text/csv');
}

function openScoreEntryModal() {
  // 生成多班选择复选框
  const allClsEntry = getAllClasses();
  const mineEntry = allClsEntry.filter(c => isMyClass(c));
  const otherEntry = allClsEntry.filter(c => !isMyClass(c));
  let checkboxesHtml = '';
  if (mineEntry.length > 0) {
    checkboxesHtml += '<div style="font-size:12px;color:let(--text-muted);margin-bottom:4px">任教班级</div>';
    checkboxesHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">';
    checkboxesHtml += mineEntry.map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;padding:2px 8px;border:1px solid let(--border);border-radius:let(--radius-sm)"><input type="checkbox" class="entryClassCb" value="${escapeAttr(c)}" checked> ${escapeHtml(c)}</label>`).join('');
    checkboxesHtml += '</div>';
  }
  if (otherEntry.length > 0) {
    checkboxesHtml += '<div style="font-size:12px;color:let(--text-muted);margin-bottom:4px">其他班级（仅成绩）</div>';
    checkboxesHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">';
    checkboxesHtml += otherEntry.map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;padding:2px 8px;border:1px solid let(--border);border-radius:let(--radius-sm)"><input type="checkbox" class="entryClassCb" value="${escapeAttr(c)}"> ${escapeHtml(c)}</label>`).join('');
    checkboxesHtml += '</div>';
  }
  openModal(`
    <h3>✏️ 成绩录入</h3>
    <div style="margin-bottom:12px">
      <label class="form-label">选择班级（可多选）</label>
      <div id="entryClassCheckboxes">${checkboxesHtml}</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-sm btn-outline" data-click="toggleAllEntryClasses" data-click-args="[true]">全选</button>
        <button class="btn btn-sm btn-outline" data-click="toggleAllEntryClasses" data-click-args="[false]">取消全选</button>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">考试名称 *</label>
        <input class="form-input" id="entryExam" placeholder="如：第二章单元测">
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input type="date" class="form-input" id="entryDate" value="${new Date().toISOString().slice(0,10)}">
      </div>
    </div>
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group" style="flex:1">
        <button class="btn btn-primary" data-click="loadClassStudentsForEntry">🔄 加载学生名单</button>
      </div>
      <div class="form-group">
        <button class="btn btn-success" data-click="openStudentEditor">➕ 新增学生</button>
      </div>
    </div>
    <div id="entryStudentList" style="max-height:50vh;overflow:auto;margin-top:8px"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveScoreEntry">💾 保存成绩</button>
    </div>
  `);
}

function getCheckedEntryClasses() {
  const cbs = document.querySelectorAll('.entryClassCb:checked');
  const classes = [];
  cbs.forEach(cb => classes.push(cb.value));
  return classes;
}

function toggleAllEntryClasses(checked) {
  document.querySelectorAll('.entryClassCb').forEach(cb => { cb.checked = checked; });
}

function loadClassStudentsForEntry() {
  const classes = getCheckedEntryClasses();
  if (classes.length === 0) {
    document.getElementById('entryStudentList').innerHTML = '<div class="empty-state" style="padding:12px"><span class="emoji">⚠️</span><p style="font-size:13px;color:let(--text-muted)">请至少选择一个班级</p></div>';
    return;
  }
  const list = document.getElementById('entryStudentList');
  let html = '';
  let totalStudents = 0;
  classes.forEach(cls => {
    const students = state.students.filter(s => s.classId === cls);
    totalStudents += students.length;
    html += `<div style="font-size:13px;font-weight:600;margin:8px 0 4px;padding:4px 8px;background:let(--bg-hover);border-radius:let(--radius-sm)">📌 ${escapeHtml(cls)}（${students.length}人）</div>`;
    if (students.length === 0) {
      html += `<div class="empty-state" style="padding:8px"><span class="emoji">📋</span><p style="font-size:12px;color:let(--text-muted);margin:2px 0">${isMyClass(cls) ? '该班级暂无注册学生，请先新增学生' : '非任教班级无学生档案'}</p></div>`;
    } else {
      students.forEach((s, i) => {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;padding:2px 4px">
          <span style="width:24px;color:let(--text-muted);font-size:12px">${i+1}.</span>
          <span style="flex:1;font-size:13px">${escapeHtml(s.name)} <span class="text-muted text-sm">${escapeHtml(s.studentNo)}</span></span>
          <input type="number" min="0" max="100" class="form-input" id="score_${s.id}" placeholder="成绩" style="width:70px;font-size:13px">
          <button class="btn-icon" data-click="__dcDelStudentReload" data-click-args="${escapeAttr(JSON.stringify([s.id]))}" title="删除学生">🗑️</button>
        </div>`;
      });
    }
  });
  list.innerHTML = html || '<div class="empty-state"><span class="emoji">📋</span>暂无学生</div>';
  // 更新底部计数
  const countEl = document.getElementById('entryStudentCount');
  if (countEl) countEl.textContent = '共 ' + totalStudents + ' 人';
}

function saveScoreEntry() {
  const exam = document.getElementById('entryExam').value.trim();
  const date = document.getElementById('entryDate').value;
  if (!exam) { showToast('请输入考试名称', 'warn'); return; }
  const classes = getCheckedEntryClasses();
  if (classes.length === 0) { showToast('请至少选择一个班级', 'warn'); return; }
  let added = 0;
  classes.forEach(cls => {
    const students = state.students.filter(s => s.classId === cls);
    students.forEach(s => {
      const val = document.getElementById('score_' + s.id)?.value;
      if (val === undefined || val === '') return;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 100) { return; }
      // Remove existing score for same exam
      state.scores = state.scores.filter(sc => !(sc.studentId === s.id && sc.examName === exam));
      state.scores.push({
        id: uid(), studentId: s.id, name: s.name, classId: s.classId,
        score: num, examName: exam, date: date
      });
      added++;
    });
  });
  recalculateRanks(exam);
  xiuxianRecalcLinggenSilent();
  saveState();
  closeModal();
  showToast('已录入 ' + added + ' 条成绩');
  state._selectedExam = exam;
  renderPage();
}

function handleScoreUpload(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\ufeff/, '');
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showToast('文件格式不对', 'error'); return; }
    saveState({pushUndo:true});
    let added = 0;
    let examName = '';
    const skipped = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (!cols[1] || isNaN(parseFloat(cols[3]))) continue;
      examName = cols[4] || '导入成绩';
      const rawNo = (cols[0] || '').trim();
      const classId = (cols[2] || '1班').trim();
      // 自动将 CSV 中的班级加入班级列表（支持非任教班级导入）
      if (classId && !getClasses().includes(classId)) {
        addClass(classId);
      }
      // 以学号为标准匹配班级已有学生
      const matched = rawNo ? state.students.find(s => s.studentNo === rawNo) : null;
      if (!matched) {
        skipped.push(rawNo || '(空学号)');
        continue;
      }
      // Remove existing score for same student + exam
      state.scores = state.scores.filter(sc => !(sc.studentId === matched.id && sc.examName === examName));
      state.scores.push({
        id: uid(), studentId: matched.id, name: matched.name, classId: matched.classId,
        score: parseFloat(cols[3]), examName, date: cols[5] || new Date().toISOString().slice(0,10)
      });
      added++;
    }
    if (examName) recalculateRanks(examName);
    xiuxianRecalcLinggenSilent();
    state._selectedExam = examName;
    saveState();
    let msg = `已导入 ${added} 条成绩记录`;
    if (skipped.length) msg += `；${skipped.length} 条学号未匹配已跳过：${skipped.join('、')}`;
    showToast(msg, skipped.length ? 'warn' : 'success', 8000);
    renderScoreAnalysis(document.getElementById('analysisContainer'));
  };
  reader.readAsText(file, 'UTF-8');
}

function exportScoresCSV() {
  const exam = state._selectedExam || getExamList()[0] || '';
  if (!exam) { showToast('暂无成绩可导出', 'warn'); return; }
  const scores = state.scores.filter(s => s.examName === exam).sort((a,b) => b.score - a.score);
  let csv = '\ufeff排名,姓名,班级,成绩,班排,级排,分层,分层变动,进退步\n';
  scores.forEach(s => {
    const layer = rankToLayer(s.classRank || 999);
    const progress = getScoreProgress(s.studentId, exam) || {};
    const layerChange = progress.layerChange === 'up' ? '分层提升' : progress.layerChange === 'down' ? '分层下滑' : '持平';
    csv += `${s.gradeRank||''},${s.name},${s.classId},${s.score},${s.classRank||''},${s.gradeRank||''},${layer}层,${layerChange},${progress.progressLabel||'首次'}\n`;
  });
  downloadFile(csv, exam + '_成绩单.csv', 'text/csv');
}

function editScore(id) {
  const sc = state.scores.find(s => s.id === id);
  if (!sc) return;
  openModal(`
    <h3>✏️ 编辑成绩</h3>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">学生</label>
        <input class="form-input" value="${escapeHtml(sc.name)} (${escapeHtml(sc.classId)})" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">考试</label>
        <input class="form-input" value="${escapeHtml(sc.examName)}" disabled>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">成绩 *</label>
      <input type="number" min="0" max="100" class="form-input" id="editScoreValue" value="${sc.score}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveEditedScore" data-click-args="[&quot;${escapeAttr(id)}&quot;]">保存</button>
    </div>
  `);
}

function saveEditedScore(id) {
  const sc = state.scores.find(s => s.id === id);
  if (!sc) return;
  const val = document.getElementById('editScoreValue').value;
  const num = parseFloat(val);
  if (isNaN(num) || num < 0 || num > 100) {
    showToast('请输入 0-100 之间的有效成绩', 'error');
    return;
  }
  sc.score = num;
  recalculateRanks(sc.examName);
  saveState();
  closeModal();
  showToast('成绩已更新');
  renderScoreAnalysis(document.getElementById('analysisContainer'));
}

async function deleteScore(id) {
  if (!(await appConfirm('确认删除此成绩记录？', {danger:true}))) return;
  state.scores = state.scores.filter(s => s.id !== id);
  saveState();
  showToast('成绩已删除');
  renderScoreAnalysis(document.getElementById('analysisContainer'));
}

// 成绩记录：批量删除
async function batchDeleteScores() {
  const cbs = Array.prototype.slice.call(document.querySelectorAll('.score-del-cb:checked'));
  if (cbs.length === 0) { showToast('请先勾选要删除的成绩', 'warn'); return; }
  const ids = cbs.map(function(cb){ return cb.getAttribute('data-sid'); });
  const exam = state._selectedExam || '';
  saveState({pushUndo:true});
  if (!(await appConfirm(`确定批量删除 ${ids.length} 条成绩记录吗？此操作不可恢复。`))) return;
  state.scores = state.scores.filter(function(s){ return ids.indexOf(s.id) < 0; });
  if (exam) recalculateRanks(exam);
  saveState();
  showToast(`已删除 ${ids.length} 条成绩`);
  renderScoreAnalysis(document.getElementById('analysisContainer'));
}
function updateScoreSelCount() {
  const cbs = document.querySelectorAll('.score-del-cb:checked');
  const cnt = document.getElementById('scoreSelCount');
  const btn = document.getElementById('scoreBatchDeleteBtn');
  if (cnt) cnt.textContent = cbs.length;
  if (btn) btn.disabled = cbs.length === 0;
}

/* ===================== Quick Tools: 01 自动化提醒 ===================== */
function renderAutomation(container) {
  const activeCount = state.reminders.filter(r=>r.active).length;
  const totalCount = state.reminders.length;
  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">⏰</span><div class="stat-num">${totalCount}</div><div class="stat-label">提醒总数</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-num">${activeCount}</div><div class="stat-label">已启用</div></div>
      <div class="stat-card"><span class="stat-icon">⏸️</span><div class="stat-num">${totalCount-activeCount}</div><div class="stat-label">已暂停</div></div>
    </div>
    <div class="toolbar">
      <div class="section-title">🔔 自动化提醒列表</div>
      <button class="btn btn-primary" data-click="openReminderModal">+ 新建提醒</button>
    </div>
    <div id="reminderList"></div>
    <div class="tool-card" style="margin-top:20px">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:let(--primary-lightest)">💡</div>
        <div>
          <div class="tool-card-title">如何接入 WorkBuddy 定时提醒？</div>
          <div class="tool-card-desc">在工作台对话中直接告诉海绵宝宝即可创建自动化定时任务</div>
        </div>
      </div>
      <div style="font-size:13px;color:let(--text-body);line-height:1.9;padding-left:8px">
        <p>📌 <b>操作方式：</b>在 WorkBuddy 对话框中输入类似以下指令：</p>
        <ul style="margin:6px 0 6px 20px">
          <li>"每天下午4点提醒我批改作业"</li>
          <li>"每周一早上8点提醒我检查本周备课"</li>
          <li>"每周五下午3点提醒我同步教学进度"</li>
        </ul>
        <p>📌 海绵宝宝会自动创建定时任务，按设定时间准时提醒你。</p>
        <p>📌 可在下方列表中管理（启用/暂停/删除）本地提醒记录。</p>
      </div>
    </div>
  `;
  renderReminderList();
}

function renderReminderList() {
  const list = document.getElementById('reminderList');
  if (!state.reminders.length) {
    list.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>暂无提醒，点击「新建提醒」创建</div>';
    return;
  }
  list.innerHTML = state.reminders.map(r => `
    <div class="reminder-item ${r.active?'':'paused'}">
      <div style="font-size:22px">${r.active?'🔔':'🔇'}</div>
      <div class="reminder-info">
        <div class="reminder-name">${escapeHtml(r.name)}</div>
        <div class="reminder-schedule">📅 ${escapeHtml(r.schedule)} · ${escapeHtml(r.desc||'')}</div>
      </div>
      <span class="reminder-badge ${r.active?'badge-active':'badge-paused'}">${r.active?'已启用':'已暂停'}</span>
      <button class="btn btn-sm btn-outline" data-click="toggleReminder" data-click-args="[&quot;${r.id}&quot;]">${r.active?'暂停':'启用'}</button>
      <button class="btn-icon" title="删除" data-click="deleteReminder" data-click-args="[&quot;${r.id}&quot;]">🗑️</button>
    </div>
  `).join('');
}

function toggleReminder(id) {
  const r = state.reminders.find(x=>x.id===id);
  if (!r) return;
  r.active = !r.active;
  saveState();
  renderReminderList();
  showToast(r.active?'提醒已启用':'提醒已暂停');
}

async function deleteReminder(id) {
  if (!(await appConfirm('确认删除此提醒？', {danger:true}))) return;
  state.reminders = state.reminders.filter(r=>r.id!==id);
  saveState();
  renderReminderList();
  showToast('提醒已删除');
}

function openReminderModal(id) {
  const r = id ? state.reminders.find(x=>x.id===id) : null;
  // Parse existing schedule for structured editing
  let freq = 'daily', weekday = '一', timeStr = '16:00';
  if (r && r.schedule) {
    const s = r.schedule;
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) timeStr = timeMatch[1].padStart(2,'0') + ':' + timeMatch[2];
    if (/^每天/.test(s)) freq = 'daily';
    else if (/^每周/.test(s)) { freq = 'weekly'; const wm = s.match(/每周(日|一|二|三|四|五|六)/); if (wm) weekday = wm[1]; }
    else if (/^每月最后一天/.test(s)) freq = 'monthly';
    else freq = 'custom';
  }
  const weekdayOptions = ['一','二','三','四','五','六','日'];
  openModal(`
    <h3 style="margin-bottom:16px">${r?'编辑提醒':'新建提醒'}</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:let(--text-muted);display:block;margin-bottom:4px">提醒名称</label>
        <input class="search-input" id="rmName" placeholder="如：每日批改提醒" value="${r?escapeHtml(r.name):''}">
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <label style="font-size:12px;color:let(--text-muted);display:block;margin-bottom:4px">重复频率</label>
          <select class="form-select" id="rmFreq" data-ev="change" data-ev-key="ev56" style="width:100%">
            <option value="daily" ${freq==='daily'?'selected':''}>每天</option>
            <option value="weekly" ${freq==='weekly'?'selected':''}>每周</option>
            <option value="monthly" ${freq==='monthly'?'selected':''}>每月最后一天</option>
            <option value="custom" ${freq==='custom'?'selected':''}>自定义</option>
          </select>
        </div>
        <div id="rmWeekdayWrap" style="display:${freq==='weekly'?'block':'none'};min-width:100px">
          <label style="font-size:12px;color:let(--text-muted);display:block;margin-bottom:4px">星期</label>
          <select class="form-select" id="rmWeekday" style="width:100%">
            ${weekdayOptions.map(w => `<option value="${w}" ${weekday===w?'selected':''}>周${w}</option>`).join('')}
          </select>
        </div>
        <div style="min-width:100px">
          <label style="font-size:12px;color:let(--text-muted);display:block;margin-bottom:4px">时间</label>
          <input type="time" class="form-input" id="rmTime" value="${timeStr}" style="width:100%">
        </div>
      </div>
      <div id="rmCustomWrap" style="display:${freq==='custom'?'block':'none'}">
        <label style="font-size:12px;color:let(--text-muted);display:block;margin-bottom:4px">自定义计划（如：每天 16:00 / 每周一 08:00 / 每月最后一天 09:00）</label>
        <input class="search-input" id="rmSchedule" placeholder="如：每天 16:00" value="${r?escapeHtml(r.schedule):''}">
      </div>
      <div>
        <label style="font-size:12px;color:let(--text-muted);display:block;margin-bottom:4px">备注说明</label>
        <input class="search-input" id="rmDesc" placeholder="提醒内容描述" value="${r?escapeHtml(r.desc||''):''}">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveReminder" data-click-args="${escapeAttr(JSON.stringify([r ? r.id : null]))}">保存</button>
    </div>
  `);
}

function onReminderFreqChange() {
  const freq = document.getElementById('rmFreq').value;
  document.getElementById('rmWeekdayWrap').style.display = freq === 'weekly' ? 'block' : 'none';
  document.getElementById('rmCustomWrap').style.display = freq === 'custom' ? 'block' : 'none';
}

function saveReminder(id) {
  const name = document.getElementById('rmName').value.trim();
  const desc = document.getElementById('rmDesc').value.trim();
  const freq = document.getElementById('rmFreq').value;
  const time = document.getElementById('rmTime').value || '09:00';
  let schedule = '';
  if (freq === 'daily') {
    schedule = '每天 ' + time;
  } else if (freq === 'weekly') {
    const wd = document.getElementById('rmWeekday').value;
    schedule = '每周' + wd + ' ' + time;
  } else if (freq === 'monthly') {
    schedule = '每月最后一天 ' + time;
  } else {
    schedule = document.getElementById('rmSchedule').value.trim();
  }
  if (!name || !schedule) { showToast('请填写提醒名称和时间', 'error'); return; }
  if (id) {
    const r = state.reminders.find(x=>x.id===id);
    r.name = name; r.schedule = schedule; r.desc = desc;
  } else {
    state.reminders.push({ id: uid(), name, schedule, desc, active: true });
  }
  saveState();
  closeModal();
  renderReminderList();
  showToast('提醒已保存');
}

/* ===================== Quick Tools: 02 Skill链接 ===================== */
const SKILL_LINKS = [
  { icon:'📄', name:'PDF工具', desc:'PDF读取/编辑/合并/拆分', url:'#' },
  { icon:'📊', name:'Excel工具', desc:'电子表格处理与生成', url:'#' },
  { icon:'📽️', name:'PPT生成', desc:'演示文稿自动制作', url:'#' },
  { icon:'📝', name:'腾讯文档', desc:'在线协作文档', url:'https://docs.qq.com' },
  { icon:'🔍', name:'Web搜索', desc:'联网搜索信息', url:'#' },
  { icon:'🎨', name:'图表生成', desc:'数据可视化图表', url:'#' },
  { icon:'🌐', name:'网页部署', desc:'在线部署静态网站', url:'#' },
  { icon:'📋', name:'文档摘要', desc:'智能内容摘要', url:'#' },
  { icon:'🤖', name:'Agent浏览器', desc:'网页自动化操作', url:'#' },
  { icon:'🖼️', name:'图片生成', desc:'AI文生图', url:'#' },
  { icon:'🎬', name:'视频生成', desc:'AI文生视频', url:'#' },
  { icon:'🧩', name:'3D模型', desc:'AI生成3D模型', url:'#' }
];

function renderSkillLinks(container) {
  container.innerHTML = `
    <div class="tool-card">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:let(--primary-lightest)">🔗</div>
        <div>
          <div class="tool-card-title">Skill 快捷入口</div>
          <div class="tool-card-desc">点击下方卡片快速使用对应 Skill 能力（部分功能需在 WorkBuddy 对话中触发）</div>
        </div>
      </div>
    </div>
    <div class="tool-link-grid" id="skillGrid"></div>
    <div class="tool-card" style="margin-top:20px">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:let(--primary-lightest)">💡</div>
        <div>
          <div class="tool-card-title">如何使用 Skill？</div>
          <div class="tool-card-desc">在对话中直接描述你的需求，海绵宝宝会自动调用对应能力</div>
        </div>
      </div>
      <div style="font-size:13px;color:let(--text-body);line-height:1.9;padding-left:8px">
        <p>📌 <b>文档类：</b>"帮我做一个PPT" / "读取这个Excel" / "把PDF转成Word"</p>
        <p>📌 <b>搜索类：</b>"搜索一下动物细胞结构的相关资料" / "查一下最新的中考生物考点"</p>
        <p>📌 <b>生成类：</b>"生成一张细胞结构图" / "帮我画一个食物链的图表"</p>
        <p>📌 <b>部署类：</b>"把工作台部署到线上" / "帮我发布这个网页"</p>
      </div>
    </div>
  `;
  document.getElementById('skillGrid').innerHTML = SKILL_LINKS.map(s => `
    <a class="tool-link-item" href="${s.url}" target="${s.url.startsWith('http')?'_blank':'_self'}" ${s.url==='#'?'data-click="__dcSkillHint"':''}>
      <div class="link-icon">${s.icon}</div>
      <div class="link-name">${s.name}</div>
      <div class="link-desc">${s.desc}</div>
    </a>
  `).join('');
}

function skillHint() {
  showToast('请在 WorkBuddy 对话中描述需求即可触发对应能力', 'warn');
}

/* ===================== Quick Tools: 03 IMA链接入口 ===================== */
function renderImaLink(container) {
  container.innerHTML = `
    <div class="ima-hero">
      <div class="ima-logo">🧠</div>
      <h2>IMA 知识库</h2>
      <p>腾讯 IMA 是智能知识管理工具，支持文档收藏、知识问答、AI 辅助学习。点击下方按钮直接进入 IMA 知识库，随时随地管理你的教学资料。</p>
      <a class="ima-btn" href="https://ima.qq.com" target="_blank">🚀 进入 IMA 知识库</a>
    </div>
    <div class="tool-link-grid">
      <a class="tool-link-item" href="https://ima.qq.com" target="_blank">
        <div class="link-icon">🏠</div>
        <div class="link-name">IMA 首页</div>
        <div class="link-desc">知识库主页</div>
      </a>
      <a class="tool-link-item" href="https://ima.qq.com/explore" target="_blank">
        <div class="link-icon">🔍</div>
        <div class="link-name">知识探索</div>
        <div class="link-desc">搜索与发现</div>
      </a>
      <a class="tool-link-item" href="https://ima.qq.com/chat" target="_blank">
        <div class="link-icon">💬</div>
        <div class="link-name">AI 问答</div>
        <div class="link-desc">智能问答助手</div>
      </a>
      <a class="tool-link-item" href="https://ima.qq.com/library" target="_blank">
        <div class="link-icon">📚</div>
        <div class="link-name">我的知识库</div>
        <div class="link-desc">个人收藏管理</div>
      </a>
    </div>
    <div class="tool-card" style="margin-top:20px">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:let(--primary-lightest)">💡</div>
        <div>
          <div class="tool-card-title">IMA 使用小贴士</div>
          <div class="tool-card-desc">教学场景下的 IMA 使用建议</div>
        </div>
      </div>
      <div style="font-size:13px;color:let(--text-body);line-height:1.9;padding-left:8px">
        <p>📌 <b>教学资料管理：</b>将课件、教案、试卷上传到 IMA 知识库，随时检索复用</p>
        <p>📌 <b>中考复习：</b>把历年中考生物真题导入 IMA，用 AI 问答快速查考点</p>
        <p>📌 <b>备课辅助：</b>上传教材章节内容，让 IMA 帮你生成知识点提纲和练习题</p>
        <p>📌 <b>跨设备同步：</b>手机/电脑端数据互通，碎片时间也能随时复习</p>
      </div>
    </div>
  `;
}

/* ===================== Quick Tools: 04 生物中考每日练习 ===================== */
const QUIZ_BANK = [
  // ===== Day 1: 细胞结构与功能 =====
  {
    mc: [
      { q:'植物细胞和动物细胞都有的结构是（　　）。', opts:['细胞壁、叶绿体','细胞膜、细胞核','细胞壁、液泡','叶绿体、液泡'], answer:1, explain:'细胞膜、细胞核、细胞质是动植物细胞共有的结构；细胞壁、叶绿体、液泡是植物细胞特有的。' },
      { q:'细胞中控制物质进出的结构是（　　）。', opts:['细胞壁','细胞膜','细胞核','细胞质'], answer:1, explain:'细胞膜具有控制物质进出的功能，让有用物质进入，有害物质挡在门外。' },
      { q:'"种瓜得瓜，种豆得豆"这种现象主要取决于细胞中的（　　）。', opts:['细胞膜','细胞核','细胞质','液泡'], answer:1, explain:'细胞核中含有遗传物质，控制生物的遗传特性。' },
      { q:'植物细胞中能进行光合作用制造有机物的结构是（　　）。', opts:['线粒体','叶绿体','细胞核','液泡'], answer:1, explain:'叶绿体是光合作用的场所，能将无机物转化为有机物并释放氧气。' },
      { q:'下列关于线粒体的叙述，正确的是（　　）。', opts:['只存在于植物细胞中','只存在于动物细胞中','动植物细胞都有','与能量转换无关'], answer:2, explain:'线粒体是呼吸作用的场所，动植物细胞都含有线粒体，能为细胞生命活动提供能量。' },
      { q:'制作洋葱表皮细胞临时装片时，滴加的液体是（　　）。', opts:['清水','生理盐水','碘液','酒精'], answer:0, explain:'制作植物细胞临时装片时滴清水，制作动物细胞临时装片时滴生理盐水（0.9%）。' },
      { q:'用显微镜观察口腔上皮细胞时，视野过暗，应调节（　　）。', opts:['换高倍物镜','调节反光镜和光圈','换低倍物镜','移动装片'], answer:1, explain:'视野过暗时应调节反光镜（换凹面镜）和光圈（调大），增加进光量。' },
      { q:'显微镜下看到的物像是（　　）。', opts:['正立的实像','倒立的实像','正立的虚像','倒立的虚像'], answer:1, explain:'显微镜成倒立的实像，所以物像移动方向与装片移动方向相反。' },
      { q:'细胞分裂过程中，最明显的变化是（　　）的变化。', opts:['细胞膜','细胞质','细胞核','细胞壁'], answer:2, explain:'细胞分裂时，细胞核先一分为二，细胞质再分成两份，最后形成新细胞膜（和细胞壁）。' },
      { q:'细胞分化是指细胞在生长过程中（　　）。', opts:['数量增多','体积增大','形态结构功能发生变化','停止分裂'], answer:2, explain:'细胞分化是细胞在分裂生长后，形态、结构和功能发生差异性变化的过程，形成不同组织。' }
    ],
    major: {
      q:'下图为动物细胞结构模式图，请据图回答：(1)写出各结构名称：①______，②______，③______。(2)控制物质进出的结构是[　]______。(3)含有遗传物质的结构是[　]______。(4)与呼吸作用有关、为细胞生命活动提供能量的结构是______。',
      answer:'(1)①细胞膜　②细胞核　③细胞质　(2)[①]细胞膜　(3)[②]细胞核　(4)线粒体。解析：动物细胞的基本结构包括细胞膜、细胞核和细胞质。细胞膜控制物质进出；细胞核含遗传物质；线粒体是呼吸作用场所，为生命活动提供能量。'
    }
  },
  // ===== Day 2: 生物圈与生态系统 =====
  {
    mc: [
      { q:'一个生态系统包括（　　）。', opts:['全部植物和动物','全部生物及其生活环境','全部生产者和分解者','全部非生物部分'], answer:1, explain:'生态系统由生物部分（生产者、消费者、分解者）和非生物部分（阳光、空气、水等）共同组成。' },
      { q:'在生态系统中，能把动植物遗体分解为无机物的是（　　）。', opts:['生产者','消费者','分解者','非生物部分'], answer:2, explain:'分解者（细菌、真菌）能将动植物遗体分解为无机物，归还给无机环境，供植物再利用。' },
      { q:'"绿色工厂"指的是生态系统中的（　　）。', opts:['生产者','消费者','分解者','非生物部分'], answer:0, explain:'生产者（绿色植物）通过光合作用制造有机物，被称为"绿色工厂"。' },
      { q:'食物链的起点是（　　）。', opts:['消费者','生产者','分解者','非生物部分'], answer:1, explain:'食物链从生产者（植物）开始，经消费者逐级传递，分解者不参与食物链。' },
      { q:'在"草→兔→鹰"这条食物链中，鹰属于（　　）。', opts:['生产者','初级消费者','次级消费者','三级消费者'], answer:2, explain:'兔是初级消费者（第一营养级消费者），鹰以兔为食，是次级消费者。' },
      { q:'生态系统中的能量最终来自（　　）。', opts:['生产者','消费者','分解者','太阳'], answer:3, explain:'生态系统中所有能量最终来源于太阳能，生产者通过光合作用将光能转化为化学能。' },
      { q:'下列属于生态系统的是（　　）。', opts:['一个池塘中所有的鱼','一片森林中所有的树','一个湖泊中的所有生物及其环境','一片草地上的所有昆虫'], answer:2, explain:'生态系统必须包含生物部分和非生物部分，A、B、D只有生物没有环境，不构成完整生态系统。' },
      { q:'在生态系统中，有毒物质在食物链中逐级积累，营养级越高（　　）。', opts:['有毒物质越少','有毒物质越多','有毒物质不变','无法判断'], answer:1, explain:'生物富集现象：有毒物质沿食物链逐级积累，营养级越高，体内有毒物质浓度越高。' },
      { q:'生态系统中各种生物的数量和所占比例是相对稳定的，这说明（　　）。', opts:['生态系统不受外界影响','生态系统有一定的自我调节能力','生态系统不会变化','生态系统中生物数量不变'], answer:1, explain:'生态系统具有一定的自我调节能力，能维持相对稳定状态，但能力是有限的。' },
      { q:'下列措施中，不利于保护生态系统的是（　　）。', opts:['建立自然保护区','禁止乱砍滥伐','大量引进外来物种','退耕还林还草'], answer:2, explain:'引进外来物种可能破坏本地生态平衡，造成生物入侵，危害本地物种生存。' }
    ],
    major: {
      q:'下图是一个简化的食物网，请分析回答：(1)该食物网中有______条食物链。(2)最长的一条食物链是______。(3)若草受到农药污染，体内有毒物质浓度最高的生物是______。(4)该生态系统中，兔和草的关系是______。',
      answer:'(1)3条食物链。(2)草→鼠→蛇→鹰。(3)鹰（有毒物质沿食物链逐级积累，营养级最高的鹰体内浓度最高）。(4)吃与被吃的关系（捕食关系）。解析：食物链从生产者开始，终点是最高级消费者。该食物网含三条链：草→兔→鹰、草→鼠→蛇→鹰、草→鼠→鹰。'
    }
  },
  // ===== Day 3: 人体生理 =====
  {
    mc: [
      { q:'人体消化和吸收的主要场所是（　　）。', opts:['口腔','胃','小肠','大肠'], answer:2, explain:'小肠是消化和吸收的主要场所，有丰富的绒毛和微绒毛增大吸收面积，含有多种消化酶。' },
      { q:'淀粉在口腔中开始消化，最终被分解为（　　）。', opts:['氨基酸','葡萄糖','脂肪酸','麦芽糖'], answer:1, explain:'淀粉在唾液淀粉酶作用下先分解为麦芽糖，最终在小肠中分解为葡萄糖被吸收。' },
      { q:'蛋白质的消化始于（　　），最终被分解为氨基酸。', opts:['口腔','食道','胃','小肠'], answer:2, explain:'蛋白质在胃中胃蛋白酶作用下开始消化，最终在小肠分解为氨基酸被吸收。' },
      { q:'人体呼吸的主要器官是（　　）。', opts:['鼻','咽','喉','肺'], answer:3, explain:'肺是呼吸系统的主要器官，是气体交换的场所。' },
      { q:'人体内氧气与二氧化碳交换的场所是（　　）。', opts:['气管','支气管','肺泡','咽喉'], answer:2, explain:'肺泡是气体交换的基本单位，其壁很薄，外面缠绕着毛细血管，便于气体交换。' },
      { q:'血液与组织细胞之间进行物质交换时，血液流经（　　）。', opts:['动脉','静脉','毛细血管','心脏'], answer:2, explain:'毛细血管管壁薄、管径小、血流慢，是血液与组织细胞进行物质交换的场所。' },
      { q:'心脏的四个腔中，壁最厚的是（　　）。', opts:['左心房','左心室','右心房','右心室'], answer:1, explain:'左心室将血液泵向全身，需要最大的收缩力，因此壁最厚。' },
      { q:'体循环和肺循环的共同规律是（　　）。', opts:['心室→动脉→毛细血管→静脉→心房','心房→动脉→毛细血管→静脉→心室','心室→静脉→毛细血管→动脉→心房','心房→静脉→毛细血管→动脉→心室'], answer:0, explain:'血液循环规律：心室→动脉→毛细血管→静脉→心房。' },
      { q:'人体最大的排泄器官是（　　）。', opts:['肺','皮肤','肾脏','肝脏'], answer:2, explain:'肾脏是人体主要的排泄器官，形成尿液排出代谢废物。皮肤排汗也是排泄途径之一。' },
      { q:'尿液形成过程中，过滤作用的场所是（　　）。', opts:['肾小球','肾小囊','肾小管','收集管'], answer:0, explain:'肾小球起过滤作用，形成原尿；肾小管起重吸收作用，形成终尿。' }
    ],
    major: {
      q:'下图为人体血液循环模式图，请据图回答：(1)体循环的途径是：左心室→______→全身毛细血管网→______→右心房。(2)肺循环的途径是：右心室→______→肺部毛细血管网→______→左心房。(3)在肺部毛细血管处，血液发生的变化是______。(4)动脉血是指______的血液。',
      answer:'(1)主动脉　上下腔静脉　(2)肺动脉　肺静脉　(3)静脉血变为动脉血（血液中的二氧化碳进入肺泡，肺泡中的氧气进入血液）　(4)含氧丰富、颜色鲜红。解析：体循环将动脉血变为静脉血，肺循环将静脉血变为动脉血。'
    }
  },
  // ===== Day 4: 植物生理 =====
  {
    mc: [
      { q:'植物的根吸收水分和无机盐的主要部位是（　　）。', opts:['根冠','分生区','伸长区','成熟区'], answer:3, explain:'成熟区（根毛区）有大量根毛，表面积大，是吸收水分和无机盐的主要部位。' },
      { q:'蒸腾作用的主要器官是（　　）。', opts:['根','茎','叶','花'], answer:2, explain:'叶是蒸腾作用的主要器官，气孔是水蒸气散失的门户，也是气体交换的窗口。' },
      { q:'气孔的开闭由（　　）控制。', opts:['表皮细胞','保卫细胞','叶肉细胞','导管细胞'], answer:1, explain:'保卫细胞控制气孔的开闭，保卫细胞吸水膨胀时气孔张开，失水缩小时气孔关闭。' },
      { q:'光合作用的表达式是（　　）。', opts:['二氧化碳+水→有机物+氧气','有机物+氧气→二氧化碳+水+能量','二氧化碳+水+光能→有机物+氧气','水+光能→氧气+有机物'], answer:2, explain:'光合作用：二氧化碳+水→（光能、叶绿体）→有机物（储存能量）+氧气。' },
      { q:'呼吸作用的表达式是（　　）。', opts:['二氧化碳+水→有机物+氧气','有机物+氧气→二氧化碳+水+能量','二氧化碳+水+光能→有机物+氧气','水+光能→氧气+氢气'], answer:1, explain:'呼吸作用：有机物+氧气→二氧化碳+水+能量。所有活细胞都能进行呼吸作用。' },
      { q:'下列措施中，能促进植物进行光合作用的是（　　）。', opts:['增加二氧化碳浓度','降低温度','减少光照','减少水分'], answer:0, explain:'增加二氧化碳浓度可促进光合作用，合理密植、增加光照也能提高光合作用效率。' },
      { q:'植物进行蒸腾作用的意义不包括（　　）。', opts:['促进根对水分的吸收','降低叶片温度','促进水和无机盐的运输','制造有机物'], answer:3, explain:'制造有机物是光合作用的功能，不是蒸腾作用的意义。' },
      { q:'植物生长需要量最大的无机盐是（　　）。', opts:['含铁、含锌、含硼的无机盐','含氮、含磷、含钾的无机盐','含钙、含镁、含硫的无机盐','含锰、含铜、含钼的无机盐'], answer:1, explain:'植物需要量最大的三种无机盐是含氮、含磷、含钾的无机盐，称为"肥料三要素"。' },
      { q:'植物缺氮时，最可能出现的症状是（　　）。', opts:['叶片发黄','叶片暗绿带紫','植株矮小、叶缘枯焦','根系发育不良'], answer:0, explain:'缺氮时植物生长缓慢，植株矮小瘦弱，叶片发黄（叶绿素合成减少）。' },
      { q:'扦插、嫁接等生殖方式属于（　　）。', opts:['有性生殖','无性生殖','孢子生殖','出芽生殖'], answer:1, explain:'扦插、嫁接、压条等不经过两性生殖细胞结合，直接由母体产生新个体，属于无性生殖。' }
    ],
    major: {
      q:'为了探究"二氧化碳是光合作用的原料"，某同学设计了如下实验：将两套装置（A装置中放氢氧化钠溶液，B装置中放清水）分别放入装有天竺葵的小烧杯中，黑暗处理一昼夜后，移至光下照射几小时，取叶片脱色后滴加碘液。请回答：(1)暗处理的目的是______。(2)A装置中氢氧化钠溶液的作用是______。(3)B装置的作用是______。(4)实验现象：______叶片变蓝，______叶片不变蓝。(5)结论：______。',
      answer:'(1)耗尽叶片中原有的有机物（淀粉），排除原有淀粉对实验的干扰　(2)吸收装置中的二氧化碳　(3)对照作用　(4)B（清水组）变蓝，A（氢氧化钠组）不变蓝　(5)二氧化碳是光合作用的原料。解析：氢氧化钠吸收CO₂，使植物无法进行光合作用制造淀粉；清水组有CO₂可正常进行光合作用，叶片遇碘变蓝，说明二氧化碳是光合作用必需的原料。'
    }
  },
  // ===== Day 5: 遗传与变异 =====
  {
    mc: [
      { q:'决定生物性状的遗传物质是（　　）。', opts:['蛋白质','糖类','DNA','脂质'], answer:2, explain:'DNA（脱氧核糖核酸）是主要的遗传物质，基因是DNA上有遗传效应的片段。' },
      { q:'染色体、DNA、基因三者之间的关系是（　　）。', opts:['基因>DNA>染色体','染色体>DNA>基因','DNA>基因>染色体','三者无关系'], answer:1, explain:'染色体由DNA和蛋白质组成，DNA上有许多基因，所以大小关系为：染色体>DNA>基因。' },
      { q:'在人的体细胞中，染色体的存在情况是（　　）。', opts:['23对，46条','23条','46对','22对'], answer:0, explain:'人体体细胞中有23对（46条）染色体，其中22对常染色体和1对性染色体。' },
      { q:'男性的性染色体组成是（　　）。', opts:['XX','XY','XX或XY','YY'], answer:1, explain:'男性性染色体为XY，女性性染色体为XX。' },
      { q:'基因在亲子代间的传递是通过（　　）。', opts:['体细胞','生殖细胞（精子和卵细胞）','红细胞','肌肉细胞'], answer:1, explain:'亲代通过生殖细胞（精子和卵细胞）将基因传递给子代，受精卵含有来自父母双方的基因。' },
      { q:'如果父母都能卷舌（显性），生了一个不能卷舌的孩子（隐性），则父母的基因型是（　　）。', opts:['AA×AA','Aa×Aa','AA×aa','aa×aa'], answer:1, explain:'不能卷舌为隐性性状（aa），孩子从父母各获得一个a基因，所以父母都为杂合子Aa。' },
      { q:'近亲结婚的危害是（　　）。', opts:['使后代变聪明','增加遗传病发病率','使后代更健康','没有影响'], answer:1, explain:'近亲结婚时，携带相同隐性致病基因的概率大大增加，导致遗传病发病率升高。' },
      { q:'可遗传的变异是（　　）引起的。', opts:['环境变化','营养条件','遗传物质改变','体育锻炼'], answer:2, explain:'只有遗传物质发生改变引起的变异才能遗传给后代，环境引起的变异不可遗传。' },
      { q:'一朵花中最重要的结构是（　　）。', opts:['花萼','花冠','花蕊（雄蕊和雌蕊）','花托'], answer:2, explain:'雄蕊和雌蕊是与生殖直接相关的结构，是花的主要部分。' },
      { q:'受精完成后，发育成果皮的是（　　）。', opts:['子房壁','珠被','受精卵','胚珠'], answer:0, explain:'子房壁发育成果皮，胚珠发育成种子，受精卵发育成胚，珠被发育成种皮。' }
    ],
    major: {
      q:'已知双眼皮（A）对单眼皮（a）为显性。一对双眼皮夫妇生了一个单眼皮孩子。请分析回答：(1)父亲和母亲的基因型分别是______、______。(2)孩子的基因型是______。(3)这对夫妇再生一个单眼皮孩子的概率是______。(4)如果母亲是单眼皮，父亲是双眼皮（杂合），生单眼皮孩子的概率是______。',
      answer:'(1)Aa　Aa　(2)aa　(3)1/4（25%）　(4)1/2（50%）。解析：孩子为单眼皮（aa），从父母各获一个a基因，故父母均为Aa。Aa×Aa后代基因型及比例为：1AA:2Aa:1aa，单眼皮概率为1/4。若母亲为aa、父亲为Aa，则后代为1Aa:1aa，单眼皮概率为1/2。'
    }
  },
  // ===== Day 6: 动物运动与行为 =====
  {
    mc: [
      { q:'人体运动的基础是（　　）。', opts:['骨骼肌','骨骼和关节','骨骼肌和骨骼','关节'], answer:2, explain:'人体的运动由骨、关节和骨骼肌共同完成，骨骼肌提供动力，骨为杠杆，关节为支点。' },
      { q:'在运动中，骨的作用是（　　）。', opts:['动力','杠杆','支点','固定'], answer:1, explain:'骨在运动中起杠杆作用，关节起支点作用，骨骼肌收缩提供动力。' },
      { q:'骨骼肌中间较粗的部分叫（　　）。', opts:['肌腱','肌腹','肌纤维','肌膜'], answer:1, explain:'骨骼肌由肌腱和肌腹组成，中间较粗的为肌腹，两端的为肌腱，肌腱附着在骨上。' },
      { q:'下列动物行为中，属于先天性行为的是（　　）。', opts:['蚯蚓走迷宫','小狗算算术','蜘蛛结网','猴子骑车'], answer:2, explain:'先天性行为是生来就有的，如蜘蛛结网、蜜蜂采蜜；学习行为是后天获得的。' },
      { q:'下列行为中，属于学习行为的是（　　）。', opts:['孔雀开屏','小狗做算术','蜜蜂采蜜','母鸡孵卵'], answer:1, explain:'学习行为是在遗传因素基础上，通过环境因素和经验获得的，如小狗做算术。' },
      { q:'蚂蚁的通讯方式主要是（　　）。', opts:['声音','气味（信息素）','光','肢体动作'], answer:1, explain:'蚂蚁主要通过分泌信息素（气味）进行通讯，蚂蚁沿气味标记的路线行走。' },
      { q:'具有社会行为的动物，其群体内部的重要特征是（　　）。', opts:['数量多','有分工合作','个体大小相同','没有首领'], answer:1, explain:'社会行为的重要特征是群体内部有明显的组织分工，不同个体承担不同职责。' },
      { q:'白蚁群体中负责繁殖的是（　　）。', opts:['工蚁','兵蚁','蚁后','雄蚁'], answer:2, explain:'蚁后（雌蚁）专职产卵繁殖，工蚁负责觅食筑巢，兵蚁负责保卫蚁穴。' },
      { q:'下列不属于动物间信息交流方式的是（　　）。', opts:['蜜蜂的"8"字舞','孔雀开屏','蚂蚁的气味','鸟类的鸣叫'], answer:1, explain:'孔雀开屏是求偶行为，不是个体间信息交流。蜜蜂跳舞、蚂蚁气味、鸟类鸣叫都属于信息交流。' },
      { q:'动物在自然界中的作用不包括（　　）。', opts:['维持生态平衡','促进物质循环','帮助植物传粉','制造有机物'], answer:3, explain:'制造有机物是绿色植物（生产者）的功能，动物是消费者，不能制造有机物。' }
    ],
    major: {
      q:'当你完成屈肘动作时，请分析回答：(1)屈肘时，肱二头肌______，肱三头肌______。（填"收缩"或"舒张"）(2)在屈肘动作中，肱二头肌的肌腱固定在______上。(3)当你伸肘时，肱二头肌______，肱三头肌______。(4)人体的任何一个动作都不是由一块骨骼肌独立完成的，而是由______协调配合完成的。',
      answer:'(1)收缩　舒张　(2)骨　(3)舒张　收缩　(4)多组骨骼肌（至少两组相互拮抗的肌群）。解析：屈肘时肱二头肌收缩、肱三头肌舒张；伸肘时相反。骨骼肌通过肌腱附着在不同骨上，收缩时牵引骨绕关节活动。'
    }
  },
  // ===== Day 7: 健康与疾病 =====
  {
    mc: [
      { q:'人体的第一道防线是（　　）。', opts:['皮肤和黏膜','吞噬细胞','抗体','淋巴结'], answer:0, explain:'皮肤和黏膜构成第一道防线，能阻挡病原体侵入。第二道是体液中的杀菌物质和吞噬细胞。' },
      { q:'引起传染病的病原体中，属于病毒的是（　　）。', opts:['结核杆菌','蛔虫','流感病毒','青霉菌'], answer:2, explain:'流感病毒属于病毒，结核杆菌是细菌，蛔虫是寄生虫，青霉菌是真菌。' },
      { q:'传染病流行的三个基本环节是（　　）。', opts:['传染源、传播途径、易感人群','病原体、传播途径、易感人群','传染源、空气、食物','病原体、传染源、传播途径'], answer:0, explain:'传染病流行需同时具备传染源、传播途径和易感人群三个环节，缺一不可。' },
      { q:'下列措施中属于切断传播途径的是（　　）。', opts:['隔离病人','接种疫苗','消灭苍蝇蚊子','锻炼身体'], answer:2, explain:'消灭苍蝇蚊子属于切断传播途径；隔离病人是控制传染源；接种疫苗是保护易感人群；锻炼身体也是保护易感人群。' },
      { q:'艾滋病的主要传播途径不包括（　　）。', opts:['血液传播','母婴传播','性传播','握手拥抱'], answer:3, explain:'艾滋病通过血液、母婴、性接触传播，不通过空气飞沫、握手拥抱、共同进餐等日常接触传播。' },
      { q:'特异性免疫的特点是（　　）。', opts:['人生来就有的','对多种病原体都有防御作用','针对某种特定病原体','由皮肤构成'], answer:2, explain:'特异性免疫是后天获得的，只对某种特定病原体起作用，如抗体对抗特定抗原。' },
      { q:'接种天花疫苗后只对天花有免疫作用，这属于（　　）。', opts:['非特异性免疫','特异性免疫','先天免疫','自然免疫'], answer:1, explain:'接种疫苗属于特异性免疫，产生的抗体只对特定病原体起作用。' },
      { q:'下列属于处方药的是（　　）。', opts:['感冒灵','阿莫西林胶囊','创可贴','风油精'], answer:1, explain:'阿莫西林是抗生素类药物，属于处方药，必须在医生指导下使用。' },
      { q:'当遇到突发急症需要急救时，首先应该拨打（　　）。', opts:['110','119','120','122'], answer:2, explain:'120是医疗急救电话，遇到需要急救的病人应首先拨打120。' },
      { q:'心肺复苏时，胸外按压与人工呼吸的比例是（　　）。', opts:['15:2','30:2','5:1','10:2'], answer:1, explain:'心肺复苏时胸外按压与人工呼吸比例为30:2，按压频率为100-120次/分钟。' }
    ],
    major: {
      q:'某班发生流行性感冒，全班45名同学中有15人患病。请分析回答：(1)流感病毒从传染病角度分析，属于______。(2)患流感的15名同学从传染病角度分析，属于______。(3)未患病的30名同学中，注射过流感疫苗的同学没被传染，这属于______免疫。(4)学校采取了以下措施：①将患病学生隔离治疗；②教室每天开窗通风、消毒；③建议未患病的同学接种疫苗。上述措施分别属于预防传染病措施中的______、______、______。',
      answer:'(1)病原体　(2)传染源　(3)特异性（人工免疫）　(4)①控制传染源　②切断传播途径　③保护易感人群。解析：流感病毒是病原体；患病学生是传染源；接种疫苗产生特异性免疫，属于保护易感人群的预防措施。'
    }
  }
];

let quizDayOffset = 0;

function getQuizDayIndex() {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const diff = Math.floor((today - start) / (24*60*60*1000));
  return diff % QUIZ_BANK.length;
}

function getActualQuizDay() {
  const base = getQuizDayIndex();
  return (base + quizDayOffset + QUIZ_BANK.length * 100) % QUIZ_BANK.length;
}

function renderDailyQuiz(container) {
  const dayIdx = getActualQuizDay();
  const dayData = QUIZ_BANK[dayIdx];
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const dayNum = Math.floor((today - new Date(today.getFullYear(),0,1)) / (24*60*60*1000)) + 1;
  const topics = ['细胞结构与功能','生物圈与生态系统','人体生理','植物生理','遗传与变异','动物运动与行为','健康与疾病'];
  const offsetLabel = quizDayOffset === 0 ? '今日' : (quizDayOffset < 0 ? `前${-quizDayOffset}天` : `后${quizDayOffset}天`);
  container.innerHTML = `
    <div class="quiz-header">
      <div>
        <div class="section-title">📚 生物中考每日练习题库</div>
        <div style="font-size:12px;color:let(--text-muted);margin-top:4px">每日自动更新 · 共10道单选 + 1道大题 · 当前查看：${offsetLabel}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="quiz-date-badge">📅 ${dateStr} · 第${dayNum}天</span>
        <button class="btn btn-outline btn-sm" data-click="prevQuizDay">◀ 前一天</button>
        <button class="btn btn-outline btn-sm" data-click="nextQuizDay">后一天 ▶</button>
      </div>
    </div>
    <div id="quizContainer"></div>
  `;
  renderQuizContent(dayIdx, dayData, topics[dayIdx] || '综合练习');
}

function renderQuizContent(dayIdx, dayData, topicName) {
  const container = document.getElementById('quizContainer');
  let html = `
    <div class="tool-card" style="background:let(--primary-lightest);padding:12px 18px;margin-bottom:16px">
      <span style="font-size:14px;font-weight:600;color:let(--text-heading)">📋 今日专题：${topicName}</span>
      <span style="font-size:12px;color:let(--text-muted);margin-left:12px">点击选项作答，点击"显示答案"查看解析</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:14px;font-weight:600;color:let(--text-heading)">一、单项选择题（共10题）</span>
      <button class="btn btn-primary btn-sm" data-click="toggleAllAnswers">👁️ 全部显示/隐藏答案</button>
    </div>
  `;
  dayData.mc.forEach((q, i) => {
    html += `
      <div class="quiz-question-card" id="mc-${i}">
        <span class="quiz-q-num">${i+1}</span><span class="quiz-q-text">${escapeHtml(q.q)}</span>
        <div class="quiz-options">
          ${q.opts.map((opt, oi) => `<div class="quiz-option" data-click="selectQuizOption" data-click-args="${escapeAttr(JSON.stringify([i, oi]))}" id="opt-${i}-${oi}">${String.fromCharCode(65+oi)}. ${escapeHtml(opt)}</div>`).join('')}
        </div>
        <div class="quiz-answer-row" id="ans-${i}">
          ✅ 正确答案：<b>${String.fromCharCode(65+q.answer)}</b>　|　${escapeHtml(q.explain)}
        </div>
      </div>
    `;
  });
  html += `
    <div style="margin-top:20px;font-size:14px;font-weight:600;color:let(--text-heading)">二、综合题（共1题）</div>
    <div class="quiz-major-card">
      <span class="major-label">综合大题</span>
      <div style="font-size:14px;color:let(--text-body);line-height:1.8">${escapeHtml(dayData.major.q)}</div>
      <div class="quiz-major-answer" id="majorAnswer">${escapeHtml(dayData.major.answer)}</div>
      <button class="btn btn-outline btn-sm" style="margin-top:10px" data-click="toggleMajorAnswer">👁️ 显示/隐藏答案</button>
    </div>
  `;
  container.innerHTML = html;
}

function selectQuizOption(qIdx, optIdx) {
  const dayIdx = getActualQuizDay();
  const correct = QUIZ_BANK[dayIdx].mc[qIdx].answer;
  document.querySelectorAll(`#mc-${qIdx} .quiz-option`).forEach((el, i) => {
    el.classList.remove('selected');
    if (i === optIdx) el.classList.add('selected');
  });
  const ansEl = document.getElementById(`ans-${qIdx}`);
  if (optIdx === correct) {
    ansEl.classList.add('show');
    ansEl.style.background = '#E8F5E9';
    showToast('✅ 回答正确！');
  } else {
    ansEl.classList.add('show');
    ansEl.style.background = '#FFEBEE';
    showToast('❌ 回答错误，请看解析', 'error');
  }
}

function toggleAllAnswers() {
  const anyHidden = Array.from(document.querySelectorAll('.quiz-answer-row')).some(el => !el.classList.contains('show'));
  document.querySelectorAll('.quiz-answer-row').forEach(el => {
    if (anyHidden) el.classList.add('show');
    else el.classList.remove('show');
  });
  const majorAns = document.getElementById('majorAnswer');
  if (majorAns) {
    if (anyHidden) majorAns.classList.add('show');
    else majorAns.classList.remove('show');
  }
}

function toggleMajorAnswer() {
  const el = document.getElementById('majorAnswer');
  if (el) el.classList.toggle('show');
}

function prevQuizDay() {
  quizDayOffset--;
  const dayIdx = getActualQuizDay();
  const topics = ['细胞结构与功能','生物圈与生态系统','人体生理','植物生理','遗传与变异','动物运动与行为','健康与疾病'];
  renderQuizContent(dayIdx, QUIZ_BANK[dayIdx], topics[dayIdx] || '综合练习');
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const dayNum = Math.floor((today - new Date(today.getFullYear(),0,1)) / (24*60*60*1000)) + 1;
  const offsetLabel = quizDayOffset === 0 ? '今日' : (quizDayOffset < 0 ? `前${-quizDayOffset}天` : `后${quizDayOffset}天`);
  const subEl = document.querySelector('.quiz-header div div:last-child');
  if (subEl) subEl.textContent = `每日自动更新 · 共10道单选 + 1道大题 · 当前查看：${offsetLabel}`;
}

function nextQuizDay() {
  quizDayOffset++;
  const dayIdx = getActualQuizDay();
  const topics = ['细胞结构与功能','生物圈与生态系统','人体生理','植物生理','遗传与变异','动物运动与行为','健康与疾病'];
  renderQuizContent(dayIdx, QUIZ_BANK[dayIdx], topics[dayIdx] || '综合练习');
  const today = new Date();
  const offsetLabel = quizDayOffset === 0 ? '今日' : (quizDayOffset < 0 ? `前${-quizDayOffset}天` : `后${quizDayOffset}天`);
  const subEl = document.querySelector('.quiz-header div div:last-child');
  if (subEl) subEl.textContent = `每日自动更新 · 共10道单选 + 1道大题 · 当前查看：${offsetLabel}`;
}

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
    '<div><h3 style="font-size:18px;font-weight:700;color:let(--text-heading)">浏览器版本</h3>' +
    '<p style="font-size:12px;color:let(--text-muted);margin-top:2px">查看和管理浏览器端数据存储</p></div>' +
    '<button class="btn-icon" data-click="closeModal" style="margin-left:auto">✕</button></div>' +

    '<div style="background:let(--bg-page);border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:let(--text-heading)">📊 存储状态</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">' +
    '<div><span style="color:let(--text-muted)">存储键名：</span><code style="background:let(--bg-card);padding:2px 6px;border-radius:3px">' + escapeHtml(key) + '</code></div>' +
    '<div><span style="color:let(--text-muted)">已用空间：</span><b>' + usedKB + ' KB</b>（' + usedMB + ' MB）</div>' +
    '<div><span style="color:let(--text-muted)">总容量：</span>' + totalMB + ' MB</div>' +
    '<div><span style="color:let(--text-muted)">使用率：</span><b style="color:' + (pct > 80 ? 'let(--danger)' : 'let(--success)') + '">' + pct + '%</b></div>' +
    '<div><span style="color:let(--text-muted)">运行方式：</span>' + (isLocalFile ? '📁 本地文件' : '🌍 网页服务器') + '</div>' +
    '<div><span style="color:let(--text-muted)">数据方式：</span>浏览器 localStorage</div>' +
    '</div>' +

    (folderPath ? '<div style="margin-top:10px;padding:10px;background:let(--bg-card);border-radius:6px;font-size:12px">' +
    '<span style="color:let(--text-muted)">📁 固定存储位置：</span><br>' +
    '<code style="background:let(--bg-page);padding:3px 8px;border-radius:3px;word-break:break-all;font-size:11px">' + escapeHtml(folderPath) + '</code>' +
    '</div>' : '') +

    '</div>' +

    '<div style="background:let(--bg-page);border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:let(--text-heading)">💡 如何使用</h4>' +
    '<div style="font-size:13px;color:let(--text-body);line-height:1.8">' +
    '<p>• 直接双击 <code style="background:let(--bg-card);padding:2px 6px;border-radius:3px">浏览器版/index.html</code> 文件即可打开</p>' +
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
    '<div><h3 style="font-size:18px;font-weight:700;color:let(--text-heading)">桌面版本</h3>' +
    '<p style="font-size:12px;color:let(--text-muted);margin-top:2px">' + (isElectron ? '✅ 当前运行在桌面应用中' : '像原生软件一样，数据独立存储在本地') + '</p></div>' +
    '<button class="btn-icon" data-click="closeModal" style="margin-left:auto">✕</button></div>' +

    '<div style="background:let(--bg-page);border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:let(--text-heading)">📊 运行状态</h4>' +
    '<div style="font-size:13px;color:let(--text-body);line-height:2">' +
    '<p><span style="color:let(--text-muted)">运行环境：</span>' + (isElectron ? 'Electron 桌面应用' : '浏览器（非桌面版）') + '</p>' +
    '<p><span style="color:let(--text-muted)">数据量：</span>' + usedKB + ' KB</p>' +
    '<p><span style="color:let(--text-muted)">存储键名：</span><code style="background:let(--bg-card);padding:2px 6px;border-radius:3px">' + escapeHtml(key) + '</code></p>' +
    '<p><span style="color:let(--text-muted)">📁 固定存储位置：</span><code style="background:let(--bg-card);padding:3px 8px;border-radius:3px;font-size:11px" id="' + storagePathEl + '">' + escapeHtml(fixedStoragePath) + '</code></p>' +
    '</div></div>' +

    (isElectron ? '' :
    '<div style="background:#E3F2FD;border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:#1565C0">💡 还没有桌面版？</h4>' +
    '<p style="font-size:13px;color:#1565C0;line-height:1.8;margin-bottom:12px">桌面版将工作台变成一个独立的桌面应用，双击即可启动，数据本地存储更安全。</p>' +
    '<div style="font-size:12px;color:#1565C0;line-height:1.8">' +
    '<p><b>三步安装，无需额外操作：</b></p>' +
    '<p>1. 打开文件夹：<code style="background:let(--bg-card);padding:2px 6px;border-radius:3px">桌面\\派大星教学工作台-源代码\\桌面应用版</code></p>' +
    '<p>2. 双击运行 <code style="background:let(--bg-card);padding:2px 6px;border-radius:3px">安装此应用.bat</code></p>' +
    '<p>3. 等待安装完成，桌面自动创建快捷方式 🎉</p>' +
    '<p style="margin-top:4px;color:let(--text-muted);font-size:11px">💡 脚本会自动安装所需环境，全程无需手动操作</p>' +
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
  const storageInfo = '<div style="font-size:13px;color:let(--text-body);line-height:2">' +
    '<p><span style="color:let(--text-muted)">存储方式：</span>' + (isMobile ? '浏览器 IndexedDB + localStorage（PWA）' : '浏览器 localStorage') + '</p>' +
    '<p><span style="color:let(--text-muted)">📁 固定存储位置：</span>PWA 应用内部沙盒存储</p>' +
    '<p style="color:let(--text-muted);font-size:11px">💡 PWA 数据由浏览器管理，卸载浏览器或清除数据会丢失，建议定期导出备份</p>' +
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
      '<p style="color:let(--text-muted);margin-top:8px">✅ 安装后支持离线使用、全屏体验、像原生App一样流畅</p>' +
      '</div>';
  } else if (isAndroid) {
    steps = '<div style="line-height:2;font-size:13px">' +
      '<p><b>🤖 Android 安装步骤：</b></p>' +
      '<p>1. 使用 <b>Chrome 浏览器</b>打开工作台</p>' +
      '<p>2. 点击右上角 <b>菜单按钮（⋮）</b></p>' +
      '<p>3. 选择 <b>"添加到主屏幕"</b>或<b>"安装应用"</b></p>' +
      '<p>4. 在弹出窗口中点击 <b>"安装"</b></p>' +
      '<p>5. 桌面出现 <b>"教学工作台"</b>图标，点击即可全屏使用</p>' +
      '<p style="color:let(--text-muted);margin-top:8px">✅ 已支持PWA标准，安装后像原生App一样运行</p>' +
      '</div>';
  } else {
    steps = '<div style="line-height:2;font-size:13px">' +
      '<p><b>🖥️ 在电脑上预览/测试手机版：</b></p>' +
      '<p>1. 按 <b>F12</b> 打开开发者工具</p>' +
      '<p>2. 点击 <b>切换设备工具栏</b>图标（📱）或按 Ctrl+Shift+M</p>' +
      '<p>3. 选择 iPhone / iPad / Android 设备模拟</p>' +
      '<p>4. 即可预览手机/平板上的显示效果</p>' +
      '<p style="color:let(--text-muted);margin-top:8px">💡 真实手机上直接打开此页面，Chrome/Safari 会自动提示"添加到主屏幕"</p>' +
      '</div>';
  }

  let actionButtons = '';
  if (canPWA) {
    actionButtons = '<button class="btn btn-primary" data-click="triggerPWAInstall" style="flex:1">📲 一键安装到主屏幕</button>';
  }

  openModal('<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
    '<span style="font-size:32px">📱</span>' +
    '<div><h3 style="font-size:18px;font-weight:700;color:let(--text-heading)">手机/平板版本</h3>' +
    '<p style="font-size:12px;color:let(--text-muted);margin-top:2px">安装到主屏幕，像原生App一样使用</p></div>' +
    '<button class="btn-icon" data-click="closeModal" style="margin-left:auto">✕</button></div>' +

    '<div style="background:let(--bg-page);border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:6px;color:let(--text-heading)">📋 当前设备</h4>' +
    '<p style="font-size:13px;color:let(--text-body)">' + deviceType + (canPWA ? ' <span style="color:let(--success)">✅ 支持一键安装</span>' : '') + '</p>' +
    '</div>' +

    '<div style="background:let(--bg-page);border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:let(--text-heading)">📁 数据存储</h4>' +
    storageInfo +
    '</div>' +

    '<div style="background:let(--bg-page);border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
    '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:let(--text-heading)">📲 安装到主屏幕</h4>' +
    steps +
    '</div>' +

    '<div style="background:#E8F5E9;border-radius:let(--radius);padding:16px;margin-bottom:12px">' +
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

/* ===================== Task & Reminder Popup Notifications ===================== */
const _firedAlerts = new Set(); // track fired alerts within current minute

function checkRemindersAndTasks() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = hh + ':' + mm;
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayNames = ['日','一','二','三','四','五','六'];
  const isLastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
  const alertKey = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate() + ' ' + currentTime;

  const alerts = [];

  // Check reminders
  if (state.reminders && state.reminders.length > 0) {
    state.reminders.forEach(r => {
      if (!r.active) return;
      const key = 'reminder-' + r.id + '-' + alertKey;
      if (_firedAlerts.has(key)) return;

      const schedule = (r.schedule || '').trim();
      let shouldFire = false;

      // Pattern: 每天 HH:MM
      if (/^每天\s+(\d{1,2}):(\d{2})$/.test(schedule)) {
        const match = schedule.match(/^每天\s+(\d{1,2}):(\d{2})$/);
        shouldFire = (match[1].padStart(2,'0') + ':' + match[2]) === currentTime;
      }
      // Pattern: 每周X HH:MM
      else if (/^每周(日|一|二|三|四|五|六)\s+(\d{1,2}):(\d{2})$/.test(schedule)) {
        const match = schedule.match(/^每周(日|一|二|三|四|五|六)\s+(\d{1,2}):(\d{2})$/);
        const targetDay = dayNames.indexOf(match[1]);
        const targetTime = match[2].padStart(2,'0') + ':' + match[3];
        shouldFire = currentDay === targetDay && targetTime === currentTime;
      }
      // Pattern: 每月最后一天 (optionally with HH:MM)
      else if (/^每月最后一天/.test(schedule)) {
        const timeMatch = schedule.match(/(\d{1,2}):(\d{2})$/);
        const targetTime = timeMatch ? timeMatch[1].padStart(2,'0') + ':' + timeMatch[2] : '09:00';
        shouldFire = isLastDayOfMonth && targetTime === currentTime;
      }
      // Pattern: 每天 HH点MM分 or 每天HH点
      else if (/^每天\s*(\d{1,2})点(\d{1,2})?$/.test(schedule)) {
        const match = schedule.match(/^每天\s*(\d{1,2})点(\d{1,2})?$/);
        const t = match[1].padStart(2,'0') + ':' + (match[2] || '0').padStart(2,'0');
        shouldFire = t === currentTime;
      }

      if (shouldFire) {
        _firedAlerts.add(key);
        alerts.push({ type: 'reminder', title: '🔔 提醒：' + r.name, desc: r.desc || r.schedule, id: r.id });
      }
    });
  }

  // Check tasks (uncompleted tasks whose time matches current time)
  if (state.tasks && state.tasks.length > 0) {
    state.tasks.forEach(t => {
      if (t.completed) return;
      if (!t.time) return;
      const key = 'task-' + t.id + '-' + alertKey;
      if (_firedAlerts.has(key)) return;

      const taskTime = new Date(t.time);
      const taskHH = String(taskTime.getHours()).padStart(2, '0');
      const taskMM = String(taskTime.getMinutes()).padStart(2, '0');
      const taskTimeStr = taskHH + ':' + taskMM;

      // Fire on the exact date and time
      const taskDateStr = taskTime.getFullYear() + '-' + (taskTime.getMonth()+1) + '-' + taskTime.getDate();
      const nowDateStr = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate();
      if (taskDateStr === nowDateStr && taskTimeStr === currentTime) {
        _firedAlerts.add(key);
        const tags = [];
        if (t.important) tags.push('🔴 重要');
        if (t.urgent) tags.push('🟠 紧急');
        alerts.push({ type: 'task', title: '📋 任务提醒：' + t.name, desc: (t.desc || '') + (tags.length ? ' | ' + tags.join(' ') : '') + (t.resp ? ' | 负责人：' + t.resp : ''), id: t.id });
      }
    });
  }

  // Clean up old fired alerts (截断 + 每小时清理过期条目)
  if (_firedAlerts.size > 200) {
    const arr = [..._firedAlerts];
    _firedAlerts.clear();
    arr.slice(-100).forEach(function(k) { _firedAlerts.add(k); });
  }
  // 每小时清理超过 1 小时未触发的条目
  if (!_firedAlerts._lastHourClean || Date.now() - _firedAlerts._lastHourClean > 3600000) {
    _firedAlerts._lastHourClean = Date.now();
    const hourAgo = Date.now() - 3600000;
    _firedAlerts.forEach(function(k) {
      const ts = parseInt(k.split('-').pop());
      if (!isNaN(ts) && ts < hourAgo) _firedAlerts.delete(k);
    });
  }

  // Show popup for first alert (avoid multiple modals)
  if (alerts.length > 0) {
    showReminderPopup(alerts);
  }
}

let _pendingAlerts = null;

function showReminderPopup(alerts) {
  _pendingAlerts = alerts;
  // Also try browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    const first = alerts[0];
    new Notification(first.title, { body: first.desc, icon: document.querySelector('link[rel="icon"]')?.href || '' });
  }

  // Show in-app popup modal
  const alertHtml = alerts.map(a => `
    <div style="padding:14px;background:let(--primary-lightest);border-radius:let(--radius);margin-bottom:10px;border-left:4px solid let(--primary)">
      <div style="font-weight:700;font-size:15px;color:let(--primary-darker)">${escapeHtml(a.title)}</div>
      <div style="font-size:13px;color:let(--text-body);margin-top:4px">${escapeHtml(a.desc)}</div>
    </div>
  `).join('');

  openModal(`
    <div style="text-align:center;margin-bottom:16px">
      <span style="font-size:40px">⏰</span>
      <h3 style="margin-top:8px">定时提醒</h3>
      <p style="font-size:12px;color:let(--text-muted)">${new Date().toLocaleString('zh-CN')}</p>
    </div>
    ${alertHtml}
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="snoozeAlert" data-click-args="[10]">稍后提醒（10分钟）</button>
      <button class="btn btn-primary" data-click="closeModal">知道了</button>
    </div>
  `);

  // Play a sound (beep)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) { /* AudioContext may not be available in all environments */ }
}

function snoozeAlert(minutes) {
  const alerts = _pendingAlerts;
  if (!alerts) return;
  closeModal();
  showToast('已设置' + minutes + '分钟后再次提醒');
  setTimeout(() => {
    showReminderPopup(alerts);
  }, minutes * 60000);
}

/* ===================== Standalone HTML Generation ===================== */
function generateStandaloneHTML() {
  // Page is self-contained (CSS+JS inline), so outerHTML has everything
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}

/* ===================== 屏幕刘海手动切换（模块级，供 _exportMap/__CLICK 引用） ===================== */
function toggleNotch() {
  let notchOn = true;
  try { const v = localStorage.getItem('notchEnabled'); if (v !== null) notchOn = v === '1'; } catch(e) {}
  const newVal = !notchOn;
  try { localStorage.setItem('notchEnabled', newVal ? '1' : '0'); } catch(e) {}
  const tip = newVal ? '已开启屏幕刘海适配（28px 安全区），刷新后生效。' : '已关闭屏幕刘海适配，刷新后生效。';
  openModal(
    '<div style="text-align:center;padding:20px;font-size:16px">'+tip+'</div>'+
    '<div style="text-align:center;margin-top:12px"><button class="btn btn-primary" data-click="closeActiveAndRefresh">立即刷新</button></div>',
    { title: (newVal ? '📱' : '🚫')+' 屏幕刘海', width: '340px' }
  );
}
function closeActiveAndRefresh() { closeModal(); setTimeout(function(){ location.reload(); }, 200); }

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
              <p style="color:let(--text-muted);font-size:13px;margin-bottom:16px">版本 ${info.version}</p>
              <div style="text-align:left;font-size:12px;color:let(--text-body);line-height:1.8;background:let(--bg-card);padding:12px;border-radius:let(--radius-sm)">
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

// 自包含样式（仅注入一次）
if (!document.getElementById('xiuxian-style')) {
  const _xs = document.createElement('style');
  _xs.id = 'xiuxian-style';
  _xs.textContent =
    '/* ===== 04生物仙途秘境 · 国风修仙视觉系统 v2 ===== */\n/* 色板：朱砂#C3272B 金#D4AF37 宣纸#F5F0E6 墨#2C3E3F 檀#C19A6B 秋香#D4B683 玉#7FB5A6 */\n.x-wrap{\n  --x-zhu:#C3272B; --x-zhu-d:#9E1B14; --x-zhu-l:#E85D5D;\n  --x-jin:#D4AF37; --x-jin-l:#E8C766; --x-jin-d:#A8862A;\n  --x-paper:#F5F0E6; --x-paper-d:#E8DFCA;\n  --x-ink:#2C3E3F; --x-ink-l:#5a6c6d; --x-ink-x:#8a9a9b;\n  --x-tan:#C19A6B; --x-qiu:#D4B683; --x-yu:#7FB5A6; --x-yu-d:#5E9486;\n  max-width:1180px;margin:0 auto;padding:20px 18px 36px;\n  color:let(--x-ink);\n  font-family:\'SimSun\',\'NSimSun\',\'Songti SC\',serif;\n  background:\n    radial-gradient(ellipse farthest-corner at 30% 10%, rgba(193,154,107,.12) 0%, transparent 55%),\n    radial-gradient(ellipse farthest-corner at 75% 88%, rgba(44,62,63,.07) 0%, transparent 60%),\n    radial-gradient(circle at 10% 75%, rgba(212,175,55,.06) 0%, transparent 42%),\n    radial-gradient(circle at 88% 25%, rgba(127,181,166,.05) 0%, transparent 45%),\n    linear-gradient(160deg,#F7F2E8 0%,#F5F0E6 45%,#EFE6D2 100%);\n  background-attachment:local;border-radius:18px;position:relative;\n  box-shadow:inset 0 0 80px rgba(193,154,107,.09),inset 0 0 0 1px rgba(193,154,107,.18);\n}\n.x-wrap::before{content:\'\';position:absolute;inset:0;pointer-events:none;border-radius:18px;opacity:.7;\n  background:\n    radial-gradient(ellipse 140px 44px at 92% 6%, rgba(255,255,255,.55), transparent 72%),\n    radial-gradient(ellipse 100px 34px at 4% 38%, rgba(255,255,255,.4), transparent 72%),\n    radial-gradient(ellipse 150px 52px at 68% 96%, rgba(255,255,255,.32), transparent 72%)}\n.x-wrap::after{content:\'\';position:absolute;inset:0;pointer-events:none;border-radius:18px;opacity:.12;\n  background-image:linear-gradient(90deg,rgba(120,90,40,.5) 1px,transparent 1px),\n    linear-gradient(rgba(120,90,40,.5) 1px,transparent 1px);\n  background-size:26px 26px;mix-blend-mode:multiply}\n.x-wrap>*{position:relative;z-index:1}\n\n/* —— 顶部卷轴横幅 —— */\n.x-banner{\n  font-family:\'KaiTi\',\'STKaiti\',\'Ma Shan Zheng\',serif;font-weight:700;\n  font-size:25px;letter-spacing:3px;\n  padding:24px 30px;border-radius:5px;margin-bottom:20px;\n  position:relative;overflow:visible;\n  background:linear-gradient(135deg,rgba(193,39,43,.94) 0%,rgba(158,29,20,.96) 100%);\n  color:#F5E6C8;border:1px solid let(--x-jin);\n  box-shadow:0 0 0 3px rgba(212,175,55,.2),0 8px 24px rgba(158,29,20,.28),inset 0 0 40px rgba(212,175,55,.12);\n  text-shadow:0 1px 0 rgba(0,0,0,.35),0 0 14px rgba(212,175,55,.55)}\n.x-banner::before,.x-banner::after{content:\'\';position:absolute;top:50%;transform:translateY(-50%);\n  width:20px;height:58px;border-radius:6px;z-index:2;\n  background:linear-gradient(to bottom,#8B6914,#5C3D0A 48%,#8B6914);\n  box-shadow:0 0 10px rgba(0,0,0,.35),inset 0 0 5px rgba(212,175,55,.5),0 0 0 1px #3a2503}\n.x-banner::before{left:-10px}.x-banner::after{right:-10px}\n.x-banner-sub{font-size:13px;font-weight:400;color:#E8C766;margin-left:12px;letter-spacing:0;font-family:\'SimSun\',serif}\n\n/* —— 班级卡片网格 —— */\n.x-class-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px;margin-bottom:18px}\n.x-card{\n  background:linear-gradient(165deg,#FCFAF1 0%,#F5F0E6 100%);\n  border:1px solid let(--x-tan);border-radius:8px;padding:18px 16px;cursor:pointer;\n  transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;position:relative;\n  box-shadow:0 2px 6px rgba(120,90,40,.12),0 1px 0 rgba(255,255,255,.6) inset,0 0 0 1px rgba(212,175,55,.08)}\n.x-card::before{content:\'\';position:absolute;inset:4px;border:1px solid rgba(193,154,107,.35);border-radius:5px;pointer-events:none}\n.x-card:hover{transform:translateY(-4px);border-color:let(--x-jin);\n  box-shadow:0 10px 24px rgba(120,90,40,.2),0 0 0 1px let(--x-jin),0 0 22px rgba(212,175,55,.35),0 1px 0 rgba(255,255,255,.6) inset}\n.x-class-name{font-family:\'KaiTi\',\'STKaiti\',serif;font-size:20px;font-weight:700;color:let(--x-zhu-d);letter-spacing:1px}\n.x-class-sub{color:let(--x-ink-l);font-size:13px;margin-top:6px;font-family:\'SimSun\',serif}\n\n/* —— 学生卡片 —— */\n.x-stu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:14px}\n.x-stu-card{padding:14px 10px 12px}\n.x-cell-avatar{width:60px;height:60px;margin:0 auto;filter:drop-shadow(0 2px 4px rgba(0,0,0,.15))}\n.x-stu-name{font-family:\'KaiTi\',\'STKaiti\',serif;text-align:center;font-weight:700;margin-top:8px;color:let(--x-ink);font-size:16px}\n.x-tag{display:block;width:fit-content;margin:5px auto 0;color:#fff;font-size:11px;padding:2px 9px;border-radius:3px;\n  font-family:\'SimSun\',serif;letter-spacing:1px;box-shadow:0 1px 2px rgba(0,0,0,.2)}\n.x-stu-realm{text-align:center;color:let(--x-ink-x);font-size:12px;margin-top:4px;font-family:\'SimSun\',serif}\n\n/* —— 操作/资源条 —— */\n.x-bar{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;\n  padding:10px 14px;border-radius:8px;\n  background:linear-gradient(180deg,rgba(232,223,202,.7),rgba(245,240,230,.5));\n  border:1px solid let(--x-tan);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 6px rgba(120,90,40,.1)}\n.x-bar-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;margin-right:auto;font-size:18px;color:let(--x-zhu-d);letter-spacing:1px}\n\n/* —— 古风按钮（覆盖 .btn） —— */\n.x-wrap .btn,.x-wrap .btn-sm{font-family:\'SimSun\',\'NSimSun\',serif;border-radius:6px;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);border:1px solid let(--x-tan);\n  color:let(--x-ink);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 4px rgba(120,90,40,.15);\n  transition:all .15s ease;padding:6px 12px;font-size:13px}\n.x-wrap .btn:hover,.x-wrap .btn-sm:hover{background:linear-gradient(180deg,#F5E6C8,#D4B683);\n  border-color:let(--x-jin);color:let(--x-zhu-d);box-shadow:0 0 0 1px let(--x-jin),0 3px 8px rgba(212,175,55,.3),0 1px 0 rgba(255,255,255,.5) inset}\n.x-wrap .btn-primary{background:linear-gradient(180deg,let(--x-zhu-l),let(--x-zhu));border-color:let(--x-zhu-d);color:#fff;\n  text-shadow:0 1px 0 rgba(0,0,0,.2);box-shadow:0 0 0 1px rgba(212,175,55,.3),0 3px 8px rgba(158,29,20,.3),0 1px 0 rgba(255,255,255,.2) inset}\n.x-wrap .btn-primary:hover{background:linear-gradient(180deg,let(--x-zhu),let(--x-zhu-d));box-shadow:0 0 0 1px let(--x-jin),0 4px 12px rgba(158,29,20,.4),0 0 16px rgba(212,175,55,.4)}\n\n/* —— 英雄修炼面板（卷轴框） —— */\n.x-hero{display:flex;gap:20px;align-items:center;padding:22px;border:1px solid let(--x-jin);\n  border-radius:8px;margin-bottom:16px;position:relative;\n  background:linear-gradient(165deg,rgba(252,250,241,.95),rgba(245,240,230,.85));\n  box-shadow:0 0 0 3px rgba(193,154,107,.2),0 8px 24px rgba(120,90,40,.16),inset 0 0 50px rgba(212,175,55,.06)}\n.x-hero::before{content:\'\';position:absolute;inset:5px;border:1px solid rgba(212,175,55,.4);border-radius:5px;pointer-events:none}\n.x-hero::after{content:\'\';position:absolute;inset:0;border-radius:8px;pointer-events:none;opacity:.5;\n  background:radial-gradient(ellipse 200px 120px at 18% 50%, rgba(212,175,55,.1), transparent 70%)}\n.x-hero-info{flex:1;min-width:0;position:relative;z-index:1}\n.x-hero-name{font-family:\'KaiTi\',\'STKaiti\',serif;font-size:24px;font-weight:700;color:let(--x-zhu-d);letter-spacing:1px;text-shadow:0 1px 0 rgba(255,255,255,.5)}\n.x-hero-realm{font-family:\'SimSun\',serif;color:let(--x-ink);margin:6px 0;font-size:14px}\n.x-hero-kind{color:let(--x-ink-x);font-size:13px;font-family:\'SimSun\',serif}\n.x-avatar{width:104px;height:104px;flex:0 0 104px;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}\n.x-avatar svg,.x-avatar-svg{width:100%;height:100%}\n\n/* —— 属性四格 —— */\n.x-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}\n.x-stat{background:linear-gradient(165deg,#FCFAF1,#F0E8D4);border:1px solid let(--x-tan);\n  border-radius:6px;padding:11px 8px;text-align:center;position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1)}\n.x-stat::before{content:\'\';position:absolute;inset:3px;border:1px solid rgba(193,154,107,.25);border-radius:4px;pointer-events:none}\n.x-stat span{display:block;color:let(--x-ink-x);font-size:12px;font-family:\'SimSun\',serif}\n.x-stat b{font-size:18px;color:let(--x-zhu-d);font-family:\'KaiTi\',\'STKaiti\',serif}\n\n/* —— 灵气进度条（玉色/金色） —— */\n.x-progress{height:14px;background:linear-gradient(90deg,#E8DFCA,#D4C9A8);border-radius:8px;overflow:hidden;\n  margin-bottom:16px;border:1px solid let(--x-tan);box-shadow:0 1px 0 rgba(255,255,255,.4) inset}\n.x-progress-fill{height:100%;transition:width .6s cubic-bezier(.25,.46,.45,.94);\n  background:linear-gradient(90deg,let(--x-yu-d),let(--x-yu) 40%,let(--x-jin) 90%,let(--x-jin-l));\n  box-shadow:0 0 8px rgba(212,175,55,.5) inset,0 0 6px rgba(127,181,166,.4)}\n\n/* —— 动作按钮区 —— */\n.x-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}\n\n/* —— 限定抽取区 —— */\n.x-limited{border:1px dashed let(--x-jin);border-radius:8px;padding:14px;margin-bottom:16px;\n  background:linear-gradient(165deg,rgba(252,253,245,.9),rgba(245,240,220,.7));position:relative;\n  box-shadow:0 0 0 2px rgba(193,154,107,.12),inset 0 0 30px rgba(212,175,55,.05)}\n.x-limited-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;margin-bottom:10px;color:let(--x-zhu-d);letter-spacing:1px;font-size:16px}\n.x-limited-row{display:flex;gap:8px;flex-wrap:wrap}\n.x-limited-btn{border:1px solid let(--x-tan);background:linear-gradient(180deg,#FCFAF1,#E8DFCA);\n  border-radius:6px;padding:8px 11px;cursor:pointer;font-size:13px;text-align:center;min-width:115px;\n  font-family:\'SimSun\',serif;transition:all .15s ease;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 4px rgba(120,90,40,.12)}\n.x-limited-btn:hover{border-color:let(--x-jin);background:linear-gradient(180deg,#F5E6C8,#D4B683);\n  transform:translateY(-2px);box-shadow:0 0 0 1px let(--x-jin),0 4px 10px rgba(212,175,55,.3)}\n.x-limited-btn small{color:let(--x-zhu);font-weight:700}\n\n/* —— 提示条（卷轴卷起感） —— */\n.x-tip{background:linear-gradient(90deg,rgba(232,223,202,.8),rgba(245,240,230,.6),rgba(232,223,202,.8));\n  border-left:4px solid let(--x-yu-d);padding:11px 14px;border-radius:4px;color:let(--x-ink);font-size:13px;\n  margin-top:14px;font-family:\'SimSun\',serif;box-shadow:0 1px 0 rgba(255,255,255,.4) inset,0 2px 5px rgba(120,90,40,.08)}\n.x-emoji{font-size:46px;text-align:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.15))}\n\n/* —— 动画 —— */\n@keyframes xBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}\n@keyframes xSway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}\n@keyframes xSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}\n@keyframes xFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}\n@keyframes xGoldPulse{0%,100%{box-shadow:0 0 8px rgba(212,175,55,.3) inset,0 2px 6px rgba(120,90,40,.1)}50%{box-shadow:0 0 18px rgba(212,175,55,.55) inset,0 0 12px rgba(212,175,55,.4),0 2px 6px rgba(120,90,40,.1)}}\n@keyframes xCloudDrift{0%{transform:translateX(0)}100%{transform:translateX(-40px)}}\n.x-act-bounce,.x-act-punch,.x-act-slash,.x-act-dash,.x-act-float,.x-act-swim,.x-act-cast,.x-act-beep,.x-act-ult,.x-act-sway,.x-act-spin,.x-act-blink{animation:xBounce 1.6s ease-in-out infinite}\n.x-act-sway{animation:xSway 1.8s ease-in-out infinite;transform-origin:bottom center}\n.x-act-spin{animation:xSpin 4s linear infinite}\n.x-act-float{animation:xFloat 2s ease-in-out infinite}\n.x-act-blink{animation:xBounce 1.2s ease-in-out infinite}\n.x-act-ult{animation:xBounce 1.6s ease-in-out infinite,xGoldPulse 2.4s ease-in-out infinite}\n\n/* —— 模态框（卷轴宣纸） —— */\n.x-modal-overlay{position:fixed;inset:0;background:radial-gradient(circle at center,rgba(30,20,8,.55),rgba(15,10,4,.7));display:flex;align-items:center;justify-content:center;z-index:9999;padding:18px;backdrop-filter:blur(3px)}\n.x-modal{background:linear-gradient(165deg,#FCFAF1 0%,#F5F0E6 100%);border:1px solid let(--x-jin);\n  border-radius:10px;max-width:880px;width:100%;max-height:88vh;overflow:auto;position:relative;\n  box-shadow:0 0 0 3px rgba(193,154,107,.25),0 24px 70px rgba(0,0,0,.4),inset 0 0 60px rgba(212,175,55,.06)}\n.x-modal::before{content:\'\';position:absolute;inset:6px;border:1px solid rgba(212,175,55,.35);border-radius:7px;pointer-events:none}\n.x-modal-head{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid let(--x-tan);position:sticky;top:0;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);z-index:2}\n.x-modal-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;font-size:19px;margin-right:auto;color:let(--x-zhu-d);letter-spacing:1px}\n.x-modal-body{padding:18px 20px;position:relative;z-index:1}\n.x-modal-foot{padding:13px 20px;border-top:1px solid let(--x-tan);display:flex;gap:8px;justify-content:flex-end;\n  background:linear-gradient(0deg,#E8DFCA,#F5F0E6)}\n\n/* —— 商城 —— */\n.x-mall-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}\n.x-mall-cat{padding:6px 15px;border-radius:4px;border:1px solid let(--x-tan);cursor:pointer;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);font-size:14px;font-family:\'SimSun\',serif;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset;transition:all .15s ease}\n.x-mall-cat.on{background:linear-gradient(180deg,let(--x-zhu-l),let(--x-zhu));border-color:let(--x-zhu-d);color:#fff;\n  font-weight:700;text-shadow:0 1px 0 rgba(0,0,0,.2);box-shadow:0 0 0 1px let(--x-jin),0 2px 6px rgba(158,29,20,.3)}\n.x-mall-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}\n.x-mall-item{border:1px solid let(--x-tan);border-radius:7px;padding:13px;\n  background:linear-gradient(165deg,#FCFAF1,#F0E8D4);position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1);transition:all .15s ease}\n.x-mall-item:hover{border-color:let(--x-jin);transform:translateY(-2px);box-shadow:0 0 0 1px let(--x-jin),0 6px 14px rgba(212,175,55,.25)}\n.x-mall-name{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;color:let(--x-zhu-d);font-size:16px}\n.x-mall-desc{color:let(--x-ink-l);font-size:12px;margin:6px 0 9px;min-height:32px;font-family:\'SimSun\',serif}\n.x-mall-cost{font-size:13px;color:let(--x-zhu);font-weight:700;margin-bottom:9px;font-family:\'SimSun\',serif}\n\n/* —— 排行榜 —— */\n.x-rank-tabs{display:flex;gap:8px;margin-bottom:14px}\n.x-rank-row{display:grid;grid-template-columns:48px 1fr 120px 120px;gap:8px;align-items:center;\n  padding:9px 12px;border-bottom:1px solid rgba(193,154,107,.25);\n  background:linear-gradient(90deg,rgba(252,250,241,.6),transparent);font-family:\'SimSun\',serif}\n.x-rank-row.head{font-weight:700;color:let(--x-ink);background:linear-gradient(90deg,#E8DFCA,#F5F0E6);border-radius:6px;\n  font-family:\'KaiTi\',\'STKaiti\',serif;letter-spacing:1px}\n.x-rank-row:nth-child(2){background:linear-gradient(90deg,rgba(212,175,55,.15),transparent)}\n.x-rank-medal{font-size:20px;text-align:center}\n.x-rank-name{font-weight:600;color:let(--x-zhu-d);font-family:\'KaiTi\',\'STKaiti\',serif}\n.x-rank-val{text-align:right;font-variant-numeric:tabular-nums;color:let(--x-ink)}\n\n/* —— 小队 —— */\n.x-squad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}\n.x-squad{border:1px solid let(--x-tan);border-radius:7px;padding:13px;\n  background:linear-gradient(165deg,#FCFAF1,#F0E8D4);position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1)}\n.x-squad-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:9px;color:let(--x-zhu-d);font-size:16px;letter-spacing:1px}\n.x-squad-member{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:5px;font-size:13px;font-family:\'SimSun\',serif}\n.x-squad-member.leader{background:linear-gradient(90deg,rgba(212,175,55,.2),rgba(212,175,55,.05));\n  border:1px solid rgba(212,175,55,.4);font-weight:700}\n\n/* —— 突破 —— */\n.x-bt-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}\n.x-bt-card{border:1px solid let(--x-tan);border-radius:7px;padding:15px;text-align:center;cursor:pointer;\n  background:linear-gradient(165deg,#FCFAF1,#F0E8D4);transition:all .15s ease;position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1)}\n.x-bt-card:hover{border-color:let(--x-jin);background:linear-gradient(165deg,#F5E6C8,#D4B683);\n  transform:translateY(-3px);box-shadow:0 0 0 1px let(--x-jin),0 6px 16px rgba(212,175,55,.35)}\n.x-bt-tier{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;font-size:17px;color:let(--x-zhu-d);letter-spacing:1px}\n.x-bt-cost{color:let(--x-zhu);font-weight:700;margin:6px 0;font-family:\'SimSun\',serif}\n.x-bt-rate{color:let(--x-yu-d);font-weight:600;font-family:\'SimSun\',serif}\n.x-sec-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;font-size:16px;margin:16px 0 9px;color:let(--x-zhu-d);letter-spacing:1px}\n\n/* —— 云雾装饰层 —— */\n.x-mist{position:absolute;left:0;right:0;height:40px;pointer-events:none;z-index:0;opacity:.5;\n  background:radial-gradient(ellipse 100px 20px at 20% 50%,rgba(255,255,255,.6),transparent 70%),\n    radial-gradient(ellipse 80px 16px at 60% 60%,rgba(255,255,255,.5),transparent 70%),\n    radial-gradient(ellipse 90px 18px at 88% 45%,rgba(255,255,255,.55),transparent 70%)}\n.x-mist.top{top:0}.x-mist.bot{bottom:0}\n.x-seal{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:4px;\n  background:linear-gradient(135deg,let(--x-zhu),let(--x-zhu-d));color:#F5E6C8;\n  display:flex;align-items:center;justify-content:center;font-family:\'KaiTi\',\'STKaiti\',serif;\n  font-weight:700;font-size:13px;transform:rotate(-8deg);z-index:3;letter-spacing:0;\n  box-shadow:0 0 0 1px rgba(212,175,55,.4),0 2px 6px rgba(158,29,20,.35);opacity:.85}\n.x-res-bar{display:flex;gap:0;align-items:stretch;border-radius:7px;overflow:hidden;margin-bottom:16px;\n  border:1px solid let(--x-tan);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 6px rgba(120,90,40,.12)}\n.x-res-cell{flex:1;padding:8px 10px;text-align:center;font-family:\'SimSun\',serif;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);border-right:1px solid rgba(193,154,107,.3)}\n.x-res-cell:last-child{border-right:0}\n.x-res-cell span{display:block;color:let(--x-ink-x);font-size:11px}\n.x-res-cell b{font-size:15px;color:let(--x-zhu-d);font-family:\'KaiTi\',\'STKaiti\',serif}';
  document.head.appendChild(_xs);
}

// —— 颜色工具 ——
function xiuxianHslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = s / 100; l = l / 100;
  let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = function (v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); };
  return '#' + to(r) + to(g) + to(b);
}
function xiuxianShade(hex, amt) {
  let h = hex.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  let r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  let f = function (v) { return ('0' + Math.max(0, Math.min(255, v + amt)).toString(16)).slice(-2); };
  return '#' + f(r) + f(g) + f(b);
}

// —— 形象池构建（Stage 9：完整 240 = 动物60 + 植物60 + 人物60 + 限定60） ——
const X_ANIMAL = [
  ['小蓝企鹅','🐧','企鹅','penguin'],['喵小咪','🐱','猫','cat'],['旺财','🐶','狗','dog'],['雪团','🐰','兔','bunny'],
  ['阿狸','🦊','狐','fox'],['棕熊大叔','🐻','熊','bear'],['团子','🐼','熊猫','panda'],['虎妞','🐯','虎','tiger'],
  ['狮王','🦁','狮','lion'],['呱呱','🐸','蛙','frog'],['龟丞相','🐢','龟','turtle'],['独角兽','🦄','幻想兽','unicorn'],
  ['小仓鼠','🐹','仓鼠','round'],['刺刺','🦔','刺猬','round'],['豚豚','🐷','猪','round'],['咩咩','🐑','羊','round'],
  ['牛牛','🐮','牛','round'],['小马','🐴','马','round'],['山羊哥','🐐','山羊','round'],['小鹿','🦌','鹿','round'],
  ['喵喵','🐈','猫','cat'],['汪汪','🐕','狗','dog'],['小狼','🐺','狼','fox'],['浣熊弟','🦝','浣熊','fox'],
  ['企鹅宝','🐧','企鹅','penguin'],['小鸡','🐤','鸡','bird'],['小鸟','🐦','鸟','bird'],['老鹰','🦅','鹰','bird'],
  ['鸭鸭','🦆','鸭','bird'],['天鹅','🦢','天鹅','bird'],['小鱼','🐟','鱼','fish'],['热带鱼','🐠','鱼','fish'],
  ['鲸鱼','🐳','鲸','fish'],['章鱼','🐙','章鱼','fish'],['螃蟹','🦀','蟹','fish'],['虾虾','🦐','虾','fish'],
  ['海星','⭐','海星','fish'],['蝴蝶','🦋','蝶','bug'],['蜜蜂','🐝','蜂','bug'],['瓢虫','🐞','瓢虫','bug'],
  ['蜗牛','🐌','蜗','bug'],['蚂蚁','🐜','蚁','bug'],['熊猫宝','🐼','熊猫','panda'],['考拉','🐨','考拉','bear'],
  ['袋鼠','🦘','袋鼠','round'],['猴子','🐵','猴','round'],['猩猩','🦍','猩猩','round'],['长颈鹿','🦒','鹿','round'],
  ['大象','🐘','象','round'],['犀牛','🦏','犀牛','round'],['河马','🦛','河马','round'],['骆驼','🐫','驼','round'],
  ['猫头鹰','🦉','鸮','bird'],['企鹅妹','🐧','企鹅','penguin'],['松鼠','🐿','松鼠','round'],['刺猬宝','🦔','刺猬','round'],
  ['臭鼬','🦨','鼬','fox'],['野猪','🐗','猪','round'],['斑马','🦓','马','round'],['蛇蛇','🐍','蛇','fish']
];
const X_PLANT = [
  ['豆芽菜','🌱','芽','sprout'],['向日葵','🌻','花','flower'],['红玫瑰','🌹','花','flower'],['苹果君','🍎','果','fruit'],
  ['草莓妹','🍓','果','fruit'],['大树伯','🌳','树','tree'],['樱樱','🌸','花','flower'],['蘑菇精','🍄','菌','mushroom'],
  ['仙人球','🌵','多肉','cactus'],['幸运草','🍀','草','grass'],['麦麦','🌾','禾','grass'],['橘小子','🍊','果','fruit'],
  ['桃桃','🍑','果','fruit'],['葡萄','🍇','果','fruit'],['西瓜','🍉','果','fruit'],['香蕉','🍌','果','fruit'],
  ['菠萝','🍍','果','fruit'],['柠檬','🍋','果','fruit'],['蓝莓','🫐','果','fruit'],['樱桃','🍒','果','fruit'],
  ['梨子','🍐','果','fruit'],['椰子','🥥','果','fruit'],['芒果','🥭','果','fruit'],['番茄','🍅','果','fruit'],
  ['玉米','🌽','禾','grass'],['胡萝卜','🥕','根','sprout'],['土豆','🥔','根','sprout'],['红薯','🍠','根','sprout'],
  ['茄子','🍆','果','fruit'],['辣椒','🌶','椒','sprout'],['南瓜','🎃','果','fruit'],['西兰花','🥦','花','flower'],
  ['芦笋','🌿','草','grass'],['树叶','🍃','叶','grass'],['四叶草','☘','草','grass'],['松树','🌲','树','tree'],
  ['棕榈','🌴','树','tree'],['竹竹','🎍','竹','tree'],['荷荷','🪷','荷','flower'],['郁金香','🌷','花','flower'],
  ['雏菊','🌼','花','flower'],['薰衣草','💐','花','flower'],['松果','🌰','果','fruit'],['芝麻','🌱','芽','sprout'],
  ['香菇','🍄','菌','mushroom'],['水草','🌿','草','grass'],['苔藓妹','🌿','草','grass'],['藤藤','🌿','草','grass'],
  ['兰兰','🌸','花','flower'],['梅梅','🌸','花','flower'],['菊菊','🌼','花','flower'],['荷包','🪷','花','flower'],
  ['枫枫','🍁','叶','grass'],['芭蕉','🌿','草','grass'],['芦苇','🌾','草','grass'],['青草','🌱','芽','sprout'],
  ['蘑菇王','🍄','菌','mushroom'],['神木','🌳','树','tree']
];
const X_CHAR = [
  ['热血少年','🧑','少年','boy'],['魔法少女','🧚','少女','girl'],['骑士','🤴','骑士','knight'],['公主','👸','公主','princess'],
  ['忍者','🥷','忍者','ninja'],['法师','🧙','法师','mage'],['机器人','🤖','机械','robot'],['美人鱼','🧜','人鱼','mermaid'],
  ['精灵','🧝','精灵','girl'],['吸血鬼','🧛','暗夜','boy'],['宇航员','👨\u200d🚀','太空','boy'],['侦探','🕵','侦探','boy'],
  ['小悟空','🐵','猴王','boy'],['路飞','🏴\u200d☠','海贼','boy'],['鸣人','🍜','忍者','ninja'],['柯南','🔍','侦探','boy'],
  ['小樱','🌸','少女','girl'],['御剑少年','⚔','剑客','boy'],['弓箭手','🏹','游侠','boy'],['魔法师','🧙','法师','mage'],
  ['圣骑士','🛡','圣骑','knight'],['小魔女','🧹','魔女','girl'],['机甲兵','🤖','机甲','robot'],['天使','👼','天使','girl'],
  ['恶魔','👿','恶魔','boy'],['武士','🗡','武士','boy'],['医生','🩺','医师','boy'],['厨师','👨\u200d🍳','厨师','boy'],
  ['警察','👮','警官','boy'],['消防员','👨\u200d🚒','消防员','boy'],['科学家','🧑\u200d🔬','科学家','boy'],['老师','👨\u200d🏫','教师','boy'],
  ['歌手','🎤','歌手','girl'],['舞者','💃','舞者','girl'],['画家','🎨','画家','boy'],['运动员','🏃','运动员','boy'],
  ['篮球少年','🏀','球员','boy'],['足球少年','⚽','球员','boy'],['剑姬','⚔','剑姬','girl'],['弓姬','🏹','游侠','girl'],
  ['龙骑士','🐉','龙骑','boy'],['驯兽师','🦁','驯兽','boy'],['占星师','🔮','占星','mage'],['炼金术师','⚗','炼金','mage'],
  ['吟游诗人','🎵','诗人','boy'],['圣女','✨','圣女','girl'],['小王子','👑','王子','boy'],['白雪','👸','公主','princess'],
  ['人鱼公主','🧜','人鱼','mermaid'],['狼少年','🐺','狼人','boy'],['猫娘','🐱','猫娘','girl'],['兔娘','🐰','兔娘','girl'],
  ['狐娘','🦊','狐娘','girl'],['机械姬','🤖','机械','girl'],['幽灵','👻','幽灵','boy'],['僵尸','🧟','僵尸','boy'],
  ['雪女','❄','雪女','girl'],['雷神','⚡','雷神','boy'],['火神','🔥','火神','boy'],['水神','💧','水神','girl']
];
const X_RARE = [
  ['迪迦奥特曼','⚡','光之巨人','hero',5,10,5],['皮卡丘','⚡','电鼠','hero',20,30,3],['孙悟空(龙珠)','🐵','猴王','hero',10,20,4],
  ['葫芦娃','🍐','精灵','legend',7,15,4],['钢铁侠','🤖','装甲','mech',15,25,4],['哆啦A梦','🐱','猫型机器人','mech',30,40,3],
  ['初音未来','🎤','歌姬','legend',12,20,4],['路飞(海贼王)','🏴\u200d☠','海贼','hero',10,20,4],['鸣人(火影)','🍜','忍者','hero',10,20,4],
  ['柯南','🔍','侦探','legend',8,15,3],['喜羊羊','🐑','羊','hero',25,35,3],['熊大','🐻','熊','hero',20,30,3],
  ['黑猫警长','🐱','警长','hero',15,25,3],['赛罗奥特曼','⚡','光之巨人','hero',5,10,5],['圣斗士星矢','♈','圣斗士','hero',10,20,4],
  ['美少女战士','🌙','水手战士','legend',12,20,4],['龙猫','🐾','森林精灵','legend',18,30,3],['千与千寻','🌸','少女','legend',15,25,3],
  ['蜡笔小新','🖍','小孩','hero',20,30,3],['樱桃小丸子','🍒','小孩','legend',20,30,3],['哆啦美','🐱','猫型机器人','mech',20,30,3],
  ['孙悟空(西游记)','🐵','猴王','hero',10,20,4],['猪八戒','🐷','天蓬','hero',15,25,3],['泰罗奥特曼','⚡','光之巨人','hero',5,10,5],
  ['盖亚奥特曼','⚡','光之巨人','hero',5,10,5],['葫芦兄弟','🍐','精灵','legend',7,15,4],['阿童木','🤖','机甲','mech',15,25,3],
  ['一休哥','🧘','小和尚','hero',15,25,3],['花仙子','🌸','花仙','legend',12,20,4],['紫龙(圣斗士)','♓','圣斗士','hero',10,20,4],
  ['玄武神兽','🐢','神兽','legend',6,12,4],['朱雀神鸟','🐦','神鸟','legend',6,12,4],['青龙神龙','🐉','神龙','legend',6,12,5],
  ['白虎神兽','🐯','神兽','legend',6,12,4],['麒麟瑞兽','🦄','瑞兽','legend',8,15,4],['凤凰涅槃','🔥','神鸟','legend',6,12,5],
  ['九尾狐','🦊','妖狐','legend',8,15,4],['二郎神','🐕','神将','hero',8,15,4],['哪吒','🔥','三坛海会大神','hero',8,15,4],
  ['雷震子','⚡','雷将','hero',8,15,4],['托塔天王','👑','神将','hero',8,15,4],['嫦娥','🌙','仙子','legend',10,18,4],
  ['后羿','🏹','神射手','hero',8,15,4],['女娲','🐍','创世神','legend',6,12,5],['盘古','🪓','创世神','legend',6,12,5],
  ['精卫','🐦','神鸟','legend',10,18,4],['夸父','🏃','神人','legend',10,18,4],['共工','💧','水神','legend',10,18,4],
  ['祝融','🔥','火神','legend',10,18,4],['玄女','✨','战神','legend',8,15,4],['太上老君','☯','道祖','legend',6,12,5],
  ['太白金星','⭐','星君','legend',8,15,4],['斗战胜佛','🐵','佛','hero',6,12,5],['金角大王','👑','妖王','hero',10,18,4],
  ['银角大王','👑','妖王','hero',10,18,4],['红孩儿','🔥','圣婴','hero',8,15,4],['白骨精','💀','妖仙','legend',8,15,4],
  ['牛魔王','🐂','妖王','hero',8,15,4],['铁扇公主','🪭','罗刹','legend',8,15,4],['二郎显圣','⚡','真君','hero',6,12,5],
  ['镇元大仙','🌳','地仙','legend',6,12,5]
];
function xiuxianBuildPool() {
  let pool = [], i;
  for (i = 0; i < X_ANIMAL.length; i++) {
    const a = X_ANIMAL[i];
    const hue = Math.round(i * (360 / X_ANIMAL.length));
    pool.push({ id: 'a' + i, pool: 'animal', name: a[0], emoji: a[1], kind: a[2], body: a[3], action: 'bounce', color: xiuxianHslToHex(hue, 65, 68), rarity: 'common' });
  }
  for (i = 0; i < X_PLANT.length; i++) {
    let p = X_PLANT[i];
    const ph = 80 + Math.round((i % 12) * 7);
    pool.push({ id: 'p' + i, pool: 'plant', name: p[0], emoji: p[1], kind: p[2], body: p[3], action: 'sway', color: xiuxianHslToHex(ph, 60, 62), rarity: 'common' });
  }
  for (i = 0; i < X_CHAR.length; i++) {
    const c = X_CHAR[i];
    let ch = 200 + Math.round((i % 16) * 9);
    pool.push({ id: 'c' + i, pool: 'character', name: c[0], emoji: c[1], kind: c[2], body: c[3], action: (c[3] === 'girl' || c[3] === 'princess' || c[3] === 'mermaid') ? 'spin' : 'punch', color: xiuxianHslToHex(ch, 62, 70), rarity: 'common' });
  }
  for (i = 0; i < X_RARE.length; i++) {
    let r = X_RARE[i];
    const rh = (i % 2 === 0) ? 45 : 285;
    pool.push({ id: 'r' + i, pool: 'rare', name: r[0], emoji: r[1], kind: r[2], body: r[3], action: 'ult', rarity: 'limited', quota: r[4], rank_req: r[5], jipin_price: r[6], color: xiuxianHslToHex(rh, 75, 60), source: '班级排名前' + r[5] + ' + ' + r[6] + '极品灵石抽取' });
  }
  return pool;
}
const XIUXIAN_POOL = xiuxianBuildPool();

// —— 经济内核常量（沿用 v2.0 原值，增补商城/排行榜配置） ——
const XIUXIAN_RULES = {
  STONE_TO_SPIRIT_RATE: 3,
  PREMIUM_TO_STONE: 25,
  REALMS: [
    { index: 0, name: '凡人',       baseCombat: 0,    spiritCap: 0,     color: '#9E9E9E' },
    { index: 1, name: '胚芽炼气境', baseCombat: 80,   spiritCap: 80,    color: '#8BC34A' },
    { index: 2, name: '根茎筑基境', baseCombat: 200,  spiritCap: 180,   color: '#4CAF50' },
    { index: 3, name: '花叶金丹境', baseCombat: 500,  spiritCap: 400,   color: '#66BB6A' },
    { index: 4, name: '灵果元婴境', baseCombat: 1200, spiritCap: 800,   color: '#FFA726' },
    { index: 5, name: '生态化神境', baseCombat: 3000, spiritCap: 1600,  color: '#AB47BC' },
    { index: 6, name: '万物道祖境', baseCombat: 8000, spiritCap: 99999, color: '#FFD700' }
  ],
  LINGGEN_LEVELS: [
    { name: '凡品', linggenName: '尘芜根', displayLabel: '凡品(尘芜根)', minScore: 0,  maxScore: 44,  dailySpirit: 8,  color: '#9E9E9E', glowColor: 'rgba(158,158,158,0.3)' },
    { name: '地品', linggenName: '青畴根', displayLabel: '地品(青畴根)', minScore: 45, maxScore: 59,  dailySpirit: 12, color: '#8D6E63', glowColor: 'rgba(141,110,99,0.4)' },
    { name: '天品', linggenName: '丰穗根', displayLabel: '天品(丰穗根)', minScore: 60, maxScore: 74,  dailySpirit: 16, color: '#42A5F5', glowColor: 'rgba(66,165,245,0.5)' },
    { name: '仙品', linggenName: '琼华根', displayLabel: '仙品(琼华根)', minScore: 75, maxScore: 84,  dailySpirit: 20, color: '#AB47BC', glowColor: 'rgba(171,71,188,0.6)' },
    { name: '神品', linggenName: '造化根', displayLabel: '神品(造化根)', minScore: 85, maxScore: 94,  dailySpirit: 25, color: '#FF7043', glowColor: 'rgba(255,112,67,0.7)' },
    { name: '混沌', linggenName: '鸿蒙道根', displayLabel: '混沌(鸿蒙道根)', minScore: 95, maxScore: 100, dailySpirit: 30, color: '#FFD700', glowColor: 'rgba(255,215,0,0.8)' }
  ],
  BREAKTHROUGH_COSTS: { 1: [5, 8, 12, 20], 2: [15, 22, 32, 50], 3: [35, 50, 72, 110], 4: [70, 100, 145, 220], 5: [140, 200, 290, 440], 6: [280, 400, 580, 880] },
  BREAKTHROUGH_BASE_RATES: [0.10, 0.30, 0.60, 0.80],
  BREAKTHROUGH_FAIL_BONUSES: [0.10, 0.15, 0.20, 0.25],
  BREAKTHROUGH_GUARANTEE_TIER: 4,
  PREMIUM_STONE: { dropBaseRate: 0.10, dropRateIncrement: 0.05, pityWindowDays: 3, pityThreshold: 5, exchangeToNormal: 25, initialBalance: 0 },
  SQUAD_RULES: { squadsPerClass: 7, leaderWeeklyStone: 10, appointmentMode: 'manual', autoReplaceMonthly: false },
  SWITCH_COST_STONE: 30,
  AUTO_SPIRIT_TO_STONE_RATIO: 3,
  WEAPONS: [
    { id: 'w1', name: '木剑', tier: 0, tierName: '凡器', kind: 'weapon', bonusPct: 0.03, costType: 'stone', cost: 20, desc: '入门木剑，基础战力+3%' },
    { id: 'w2', name: '青锋剑', tier: 1, tierName: '灵器', kind: 'weapon', bonusPct: 0.06, costType: 'stone', cost: 50, desc: '灵气淬炼之剑，基础战力+6%' },
    { id: 'w3', name: '紫电', tier: 2, tierName: '宝器', kind: 'weapon', bonusPct: 0.10, costType: 'stone', cost: 120, desc: '雷霆之力，基础战力+10%' },
    { id: 'w4', name: '天罡剑', tier: 3, tierName: '仙器', kind: 'weapon', bonusPct: 0.15, costType: 'stone', cost: 300, desc: '仙家法宝，基础战力+15%' },
    { id: 'w5', name: '诛仙剑', tier: 4, tierName: '神器', kind: 'weapon', bonusPct: 0.22, costType: 'premium', cost: 3, desc: '上古神器，基础战力+22%' },
    { id: 'w6', name: '混沌道剑', tier: 5, tierName: '道器', kind: 'weapon', bonusPct: 0.30, costType: 'premium', cost: 8, desc: '道祖遗兵，基础战力+30%' }
  ],
  OUTFITS: [
    { id: 'o1', name: '麻布衫', tier: 0, tierName: '凡衣', kind: 'outfit', bonusPct: 0.01, costType: 'stone', cost: 15, desc: '粗布衣裳，基础战力+1%' },
    { id: 'o2', name: '青竹袍', tier: 1, tierName: '灵衣', kind: 'outfit', bonusPct: 0.02, costType: 'stone', cost: 40, desc: '竹叶纹长袍，基础战力+2%' },
    { id: 'o3', name: '云纹锦', tier: 2, tierName: '宝衣', kind: 'outfit', bonusPct: 0.04, costType: 'stone', cost: 100, desc: '云纹织锦，基础战力+4%' },
    { id: 'o4', name: '霓裳羽衣', tier: 3, tierName: '仙衣', kind: 'outfit', bonusPct: 0.06, costType: 'premium', cost: 2, desc: '流光羽衣，基础战力+6%' },
    { id: 'o5', name: '龙鳞甲', tier: 4, tierName: '神衣', kind: 'outfit', bonusPct: 0.10, costType: 'premium', cost: 4, desc: '龙鳞护甲，基础战力+10%' },
    { id: 'o6', name: '混沌道袍', tier: 5, tierName: '道衣', kind: 'outfit', bonusPct: 0.15, costType: 'premium', cost: 7, desc: '道祖法衣，基础战力+15%' }
  ],
  MALL_CATALOG: [
    // 功法：提升每日灵气
    { id: 'g1', cat: 'gongfa', name: '基础吐纳法', desc: '每日修炼灵气 +2', costType: 'stone', cost: 30, effect: { type: 'gongfa', val: 2 } },
    { id: 'g2', cat: 'gongfa', name: '周天功法', desc: '每日修炼灵气 +5', costType: 'stone', cost: 80, effect: { type: 'gongfa', val: 5 } },
    { id: 'g3', cat: 'gongfa', name: '太上感应篇', desc: '每日修炼灵气 +10', costType: 'stone', cost: 200, effect: { type: 'gongfa', val: 10 } },
    // 丹药：即时/一次性
    { id: 'd1', cat: 'dan', name: '聚气丹', desc: '立即获得 30 灵气', costType: 'stone', cost: 20, effect: { type: 'spirit', val: 30 } },
    { id: 'd2', cat: 'dan', name: '大还丹', desc: '立即获得 100 灵气', costType: 'stone', cost: 60, effect: { type: 'spirit', val: 100 } },
    { id: 'd3', cat: 'dan', name: '洗髓丹', desc: '立即获得 200 灵气', costType: 'premium', cost: 2, effect: { type: 'spirit', val: 200 } },
    { id: 'd4', cat: 'dan', name: '破境丹', desc: '下次突破消耗 -20%', costType: 'premium', cost: 3, effect: { type: 'btDiscount', val: 0.2 } },
    // 修炼道具
    { id: 'pet1', cat: 'xiulian', name: '换形符', desc: '免费切换形象 1 次', costType: 'stone', cost: 15, effect: { type: 'freeSwitch' } },
    { id: 'pet2', cat: 'xiulian', name: '形象锁', desc: '锁定形象，避免误切', costType: 'premium', cost: 1, effect: { type: 'lock' } },
    { id: 'pet3', cat: 'xiulian', name: '双倍修炼卡', desc: '下次修炼灵气翻倍', costType: 'stone', cost: 25, effect: { type: 'doubleCultivate' } },
    { id: 'pet4', cat: 'xiulian', name: '灵兽口粮', desc: '立即获得 50 灵气', costType: 'stone', cost: 35, effect: { type: 'spirit', val: 50 } }
  ]
};

// —— 身体造型标志（决定 SVG 立绘细节） ——
function xiuxianBodyFlags(body) {
  switch (body) {
    case 'cat': return { ears: 'cat', tail: true };
    case 'dog': return { ears: 'round', tongue: true };
    case 'bunny': return { ears: 'long' };
    case 'fox': return { ears: 'point', tail: true };
    case 'bear': return { ears: 'round' };
    case 'panda': return { ears: 'round', eyePatch: true };
    case 'tiger': return { ears: 'round', stripe: true };
    case 'lion': return { mane: true };
    case 'frog': return { eyesTop: true };
    case 'turtle': return { shell: true };
    case 'unicorn': return { horn: true };
    case 'penguin': return { beak: true, belly: true };
    case 'round': return {};
    case 'bird': return { beak: true, wings: true };
    case 'fish': return { fin: true, nolegs: true };
    case 'bug': return { wings: true, tiny: true };
    case 'sprout': return { sprout: true };
    case 'flower': return { flower: true };
    case 'tree': return { tree: true };
    case 'fruit': return { fruit: true };
    case 'mushroom': return { mushroom: true };
    case 'cactus': return { cactus: true };
    case 'grass': return { grass: true };
    case 'boy': return { hair: 'short' };
    case 'girl': return { hair: 'long', bow: true };
    case 'knight': return { hat: 'helmet' };
    case 'mage': return { hat: 'wizard' };
    case 'princess': return { hat: 'crown', hair: 'long' };
    case 'ninja': return { mask: true };
    case 'robot': return { antenna: true, mech: true };
    case 'mermaid': return { tail: true, nolegs: true };
    case 'hero': return { hero: true, aura: true };
    case 'monster': return { horn: true, aura: true };
    case 'mech': return { antenna: true, mech: true, aura: true };
    case 'legend': return { legend: true, aura: true, crown: true };
    default: return {};
  }
}

// —— SVG Q 版立绘生成（Stage 2） ——
function xiuxianAvatarSVG(char, p) {
  let lg = xiuxianLinggenObj(p.linggen);
  let realm = xiuxianRealmObj(p.realm);
  let stage = xiuxianEvoStage(p);
  let body = char.body || 'round';
  const f = xiuxianBodyFlags(body);
  const col = char.color || '#7EC8E3';
  const dark = xiuxianShade(col, -45);
  let tierColors = ['#9E9E9E','#4CAF50','#2196F3','#AB47BC','#FF7043','#FFD700'];
  const humanBodies = ['boy','girl','knight','mage','princess','ninja','hero','legend'];
  const animalBodies = ['cat','dog','bunny','fox','bear','panda','tiger','lion','frog','turtle','penguin','bird','fish','bug','unicorn'];
  const plantBodies = ['sprout','flower','tree','fruit','mushroom','cactus','grass'];
  let s = '<svg class="x-avatar-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">';
  // 境界光环（突破大境界明显变化）
  if (p.realm >= 1) {
    const rr = 74 + p.realm * 3;
    s += '<circle cx="100" cy="104" r="' + rr + '" fill="none" stroke="' + realm.color + '" stroke-width="3" opacity="0.4"/>';
  }
  // 进化光环（中期/后期）
  if (stage === '中期') s += '<circle cx="100" cy="104" r="84" fill="none" stroke="' + lg.color + '" stroke-width="7" opacity="0.18"/>';
  if (stage === '后期') {
    s += '<circle cx="100" cy="104" r="84" fill="none" stroke="' + lg.color + '" stroke-width="7" opacity="0.24"/>';
    s += '<circle cx="100" cy="104" r="92" fill="none" stroke="' + lg.color + '" stroke-width="3" opacity="0.32"/>';
    s += '<text x="34" y="46" font-size="18" fill="' + lg.color + '">✦</text><text x="162" y="58" font-size="14" fill="' + lg.color + '">✦</text><text x="150" y="156" font-size="18" fill="' + lg.color + '">✦</text>';
  }
  // 羽翼（限定/高境/拥有外观）
  if (f.wings || f.aura || (p.cosmetics && p.cosmetics.wings)) {
    s += '<path d="M38 108 q-24 -12 -32 8 q16 8 32 2z" fill="' + col + '" opacity="0.6"/><path d="M162 108 q24 -12 32 8 q-16 8 -32 2z" fill="' + col + '" opacity="0.6"/>';
  }
  // 祥云底座
  if (p.cosmetics && p.cosmetics.cloud) s += '<ellipse cx="100" cy="170" rx="46" ry="10" fill="#cfe8ff" opacity="0.7"/>';
  // 身体
  if (f.nolegs) {
    s += '<ellipse cx="100" cy="128" rx="40" ry="44" fill="' + col + '" stroke="' + dark + '" stroke-width="3"/>';
  } else {
    s += '<ellipse cx="100" cy="120" rx="44" ry="48" fill="' + col + '" stroke="' + dark + '" stroke-width="3"/>';
  }
  if (f.belly) s += '<ellipse cx="100" cy="128" rx="26" ry="30" fill="#fff" opacity="0.85"/>';
  if (f.shell) s += '<path d="M60 118 a40 40 0 0 0 80 0z" fill="' + dark + '" opacity="0.5"/>';
  // 顶部装饰
  if (f.horn) s += '<path d="M86 74 l-8 -22 14 14z" fill="#FFD700"/><path d="M114 74 l8 -22 -14 14z" fill="#FFD700"/>';
  if (f.ears === 'cat') s += '<path d="M64 78 l-6 -30 26 16z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><path d="M136 78 l6 -30 -26 16z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.ears === 'round') s += '<circle cx="70" cy="72" r="13" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><circle cx="130" cy="72" r="13" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.ears === 'long') s += '<ellipse cx="72" cy="54" rx="9" ry="26" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><ellipse cx="128" cy="54" rx="9" ry="26" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.ears === 'point') s += '<path d="M66 80 l-2 -28 22 18z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><path d="M134 80 l2 -28 -22 18z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.mane) s += '<circle cx="100" cy="92" r="58" fill="' + dark + '" opacity="0.35"/>';
  if (f.sprout) s += '<path d="M100 78 q-2 -22 0 -30" stroke="#4CAF50" stroke-width="4" fill="none"/><path d="M100 60 q-14 -6 -16 -18 q14 -2 16 12z" fill="#66BB6A"/><path d="M100 60 q14 -6 16 -18 q-14 -2 -16 12z" fill="#66BB6A"/>';
  if (f.flower) s += '<g fill="#FF80AB"><circle cx="100" cy="56" r="6"/><circle cx="86" cy="62" r="6"/><circle cx="114" cy="62" r="6"/><circle cx="92" cy="48" r="6"/><circle cx="108" cy="48" r="6"/></g><circle cx="100" cy="56" r="5" fill="#FFD54F"/>';
  if (f.tree) s += '<rect x="94" y="50" width="12" height="30" fill="#8D6E63"/><circle cx="100" cy="48" r="20" fill="#66BB6A"/>';
  if (f.mushroom) s += '<path d="M76 66 q24 -34 48 0z" fill="#E53935"/><circle cx="90" cy="54" r="4" fill="#fff"/><circle cx="110" cy="58" r="4" fill="#fff"/>';
  if (f.cactus) s += '<rect x="92" y="50" width="16" height="30" rx="8" fill="#66BB6A"/>';
  if (f.hat === 'helmet') s += '<path d="M72 76 a28 28 0 0 1 56 0z" fill="#90A4AE" stroke="#607D8B" stroke-width="2"/>';
  if (f.hat === 'wizard') s += '<path d="M70 78 L100 36 L130 78z" fill="#5E35B1"/><circle cx="100" cy="40" r="4" fill="#FFD54F"/>';
  if (f.crown || f.hat === 'crown' || (p.realm >= 5) || f.crown) s += '<path d="M78 60 l8 -16 14 12 14 -12 8 16z" fill="#FFD700" stroke="#caa" stroke-width="1"/>';
  if (f.antenna) s += '<line x1="100" y1="74" x2="100" y2="52" stroke="' + dark + '" stroke-width="3"/><circle cx="100" cy="48" r="5" fill="#FF5252"/>';
  if (f.hair === 'long') s += '<path d="M64 86 q-6 30 8 44 l8 -10 q-8 -20 -2 -34z" fill="' + dark + '"/><path d="M136 86 q6 30 -8 44 l-8 -10 q8 -20 2 -34z" fill="' + dark + '"/>';
  if (f.bow) s += '<path d="M132 70 l16 -8 -4 14z" fill="#FF80AB"/><path d="M132 70 l-16 -8 4 14z" fill="#FF80AB"/>';
  if (f.mask) s += '<rect x="76" y="96" width="48" height="12" rx="6" fill="#37474F" opacity="0.7"/>';
  if (p.cosmetics && p.cosmetics.robe) s += '<path d="M60 168 q40 -20 80 0z" fill="' + lg.color + '" opacity="0.5"/>';
  if (p.cosmetics && p.cosmetics.halo) s += '<circle cx="100" cy="104" r="80" fill="none" stroke="' + lg.color + '" stroke-width="4" opacity="0.5"/>';
  // 眼睛
  if (f.eyesTop) {
    s += '<circle cx="84" cy="92" r="11" fill="#fff"/><circle cx="116" cy="92" r="11" fill="#fff"/>';
    s += '<circle cx="86" cy="94" r="5" fill="#222"/><circle cx="114" cy="94" r="5" fill="#222"/>';
  } else {
    s += '<circle cx="84" cy="110" r="11" fill="#fff"/><circle cx="116" cy="110" r="11" fill="#fff"/>';
    s += '<circle cx="86" cy="112" r="5" fill="#222"/><circle cx="114" cy="112" r="5" fill="#222"/>';
    s += '<circle cx="84" cy="107" r="2" fill="#fff"/><circle cx="112" cy="107" r="2" fill="#fff"/>';
  }
  // 腮红 + 嘴
  s += '<ellipse cx="70" cy="124" rx="7" ry="4" fill="#ff9aa2" opacity="0.7"/><ellipse cx="130" cy="124" rx="7" ry="4" fill="#ff9aa2" opacity="0.7"/>';
  if (f.beak) s += '<path d="M94 126 l12 0 -6 8z" fill="#FF9800"/>';
  else s += '<path d="M92 128 q8 8 16 0" stroke="#a0525a" stroke-width="2" fill="none"/>';
  // 服装层（覆盖身体，后渲染在上）
  if (p.equipOutfit) {
    const out = xiuxianOutfitObj(p.equipOutfit);
    const oCol = out ? tierColors[out.tier] : '#999';
    if (humanBodies.indexOf(body) >= 0) {
      s += '<path d="M62 128 q38 30 76 0 l12 54 h-100 z" fill="' + oCol + '" opacity="0.55"/>';
    } else if (animalBodies.indexOf(body) >= 0) {
      s += '<path d="M56 118 q44 18 88 0 l-8 26 q-36 12 -72 0 z" fill="' + oCol + '" opacity="0.5"/>';
    } else {
      s += '<path d="M60 135 q40 22 80 0 l-6 32 q-34 14 -68 0 z" fill="' + oCol + '" opacity="0.5"/>';
    }
  }
  // 兵器层（最上层）
  if (p.equipWeapon) {
    const weap = xiuxianWeaponObj(p.equipWeapon);
    const wCol = weap ? tierColors[weap.tier] : '#999';
    if (humanBodies.indexOf(body) >= 0) {
      s += '<g transform="translate(134,84) scale(0.6)"><rect x="9" y="0" width="6" height="50" fill="' + wCol + '"/><polygon points="12,0 3,-12 21,-12" fill="' + wCol + '"/><circle cx="12" cy="52" r="6" fill="#D4AF37"/></g>';
    } else if (animalBodies.indexOf(body) >= 0) {
      s += '<g transform="translate(138,64) scale(0.5) rotate(30)"><rect x="9" y="0" width="6" height="46" fill="' + wCol + '"/><polygon points="12,0 3,-12 21,-12" fill="' + wCol + '"/><circle cx="12" cy="48" r="6" fill="#D4AF37"/></g>';
    } else {
      s += '<g transform="translate(140,96) scale(0.55) rotate(-20)"><rect x="9" y="0" width="6" height="48" fill="' + wCol + '"/><polygon points="12,0 3,-12 21,-12" fill="' + wCol + '"/><circle cx="12" cy="50" r="6" fill="#D4AF37"/></g>';
    }
  }
  // 限定星标
  if (char.rarity === 'limited') s += '<text x="100" y="26" font-size="20" fill="#FFD700" text-anchor="middle">★</text>';
  s += '</svg>';
  return s;
}

// —— 辅助函数 ——
function xiuxianGetChar(id) { return XIUXIAN_POOL.find(function (c) { return c.id === id; }) || XIUXIAN_POOL[0]; }
function xiuxianRandomCommonChar() {
  const commons = XIUXIAN_POOL.filter(function (c) { return c.rarity !== 'limited'; });
  return commons[Math.floor(Math.random() * commons.length)];
}
function xiuxianCalcLinggen(studentId) {
  let latest = null, latestDate = '';
  (state.scores || []).forEach(function (s) {
    let sid = s.studentId || s.student_id;
    if (sid !== studentId) return;
    let d = s.date || s.exam_date || '';
    if (!latest || d >= latestDate) { latest = s; latestDate = d; }
  });
  const sc = latest ? (latest.score || 0) : 0;
  let lvs = XIUXIAN_RULES.LINGGEN_LEVELS;
  for (let i = 0; i < lvs.length; i++) { if (sc >= lvs[i].minScore && sc <= lvs[i].maxScore) return lvs[i].name; }
  return lvs[lvs.length - 1].name;
}
function xiuxianLinggenObj(name) {
  let lvs = XIUXIAN_RULES.LINGGEN_LEVELS;
  for (let i = 0; i < lvs.length; i++) { if (lvs[i].name === name) return lvs[i]; }
  return lvs[0];
}
function xiuxianRealmObj(idx) { return XIUXIAN_RULES.REALMS[idx] || XIUXIAN_RULES.REALMS[0]; }
function xiuxianEvoStage(p) {
  return ['初期', '中期', '后期'][p.stage || 0];
}
function xiuxianLinggenIdx(name) {
  const lvs = XIUXIAN_RULES.LINGGEN_LEVELS;
  for (let i = 0; i < lvs.length; i++) { if (lvs[i].name === name) return i; }
  return 0;
}
function xiuxianLinggenFrameClass(linggenName) {
  return 'x-lg-frame-' + xiuxianLinggenIdx(linggenName);
}
function xiuxianWeaponObj(weaponId) {
  return XIUXIAN_RULES.WEAPONS.find(function(w){return w.id===weaponId;}) || null;
}
function xiuxianOutfitObj(outfitId) {
  return XIUXIAN_RULES.OUTFITS.find(function(o){return o.id===outfitId;}) || null;
}
function xiuxianWeaponBonusPct(p) {
  if (!p.equipWeapon) return 0;
  let w = xiuxianWeaponObj(p.equipWeapon);
  return w ? w.bonusPct : 0;
}
function xiuxianOutfitBonusPct(p) {
  if (!p.equipOutfit) return 0;
  let o = xiuxianOutfitObj(p.equipOutfit);
  return o ? o.bonusPct : 0;
}
function xiuxianBaseCombat(p) {
  let base = xiuxianRealmObj(p.realm).baseCombat;
  let spirit = Math.round(p.spirit);
  let gong = (p.gongfaBonus || 0) * 5;
  return base + spirit + gong;
}
function xiuxianCombat(p) {
  let base = xiuxianBaseCombat(p);
  let wPct = xiuxianWeaponBonusPct(p);
  let oPct = xiuxianOutfitBonusPct(p);
  return Math.round(base * (1 + wPct + oPct));
}
function xiuxianCombatBreakdown(p) {
  const base = xiuxianBaseCombat(p);
  const realmBase = xiuxianRealmObj(p.realm).baseCombat;
  let spirit = Math.round(p.spirit);
  const gong = (p.gongfaBonus || 0) * 5;
  const wPct = xiuxianWeaponBonusPct(p);
  const oPct = xiuxianOutfitBonusPct(p);
  const wBonus = Math.round(base * wPct);
  const oBonus = Math.round(base * oPct);
  let total = Math.round(base * (1 + wPct + oPct));
  let w = p.equipWeapon ? xiuxianWeaponObj(p.equipWeapon) : null;
  let o = p.equipOutfit ? xiuxianOutfitObj(p.equipOutfit) : null;
  return {
    base: realmBase, baseLabel: xiuxianRealmObj(p.realm).name + '基础',
    spirit: spirit, spiritLabel: '灵气',
    gong: gong, gongLabel: '功法加成',
    weapon: wBonus, weaponLabel: w ? (w.name + ' +' + Math.round(w.bonusPct*100) + '%') : '未装备兵器',
    outfit: oBonus, outfitLabel: o ? (o.name + ' +' + Math.round(o.bonusPct*100) + '%') : '未装备服装',
    total: total
  };
}
function xiuxianShowCombat(id) {
  let p = xiuxianProfile(id); if (!p) return;
  const bd = xiuxianCombatBreakdown(p);
  let rows = '<div class="x-combat-row"><span>境界基础</span><b>' + bd.base + '</b><small>' + bd.baseLabel + '</small></div>' +
    '<div class="x-combat-row"><span>灵气</span><b>' + bd.spirit + '</b><small>' + bd.spiritLabel + '</small></div>' +
    '<div class="x-combat-row"><span>功法加成</span><b>' + bd.gong + '</b><small>' + bd.gongLabel + '</small></div>' +
    '<div class="x-combat-row"><span>兵器加成</span><b>' + bd.weapon + '</b><small>' + bd.weaponLabel + '</small></div>' +
    '<div class="x-combat-row"><span>服装加成</span><b>' + bd.outfit + '</b><small>' + bd.outfitLabel + '</small></div>' +
    '<div class="x-combat-row total"><span>总战力</span><b>' + bd.total + '</b></div>';
  let html = '<div class="x-modal-head"><span class="x-modal-title">⚔ 战力构成 · ' + escapeHtml((state.students.find(function(s){return s.id===id;})||{}).name||'同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-combat-table">' + rows + '</div>' +
    '<div class="x-tip">兵器/服装按「境界基础+灵气+功法」的百分比加成战力，灵石不再影响战力。</div>' +
    '</div>';
  xiuxianModal(html);
}
function xiuxianMyRank(id, scope, mode) {
  let s = (state.students || []).find(function(x){return x.id===id;});
  if (!s) return { rank: 0, total: 0 };
  let list = (state.students || []).filter(function(x){ return scope === 'grade' || x.classId === s.classId; }).map(function(x){
    let p = state.xiuxian.students[x.id]; if (!p) return null;
    return { id: x.id, p: p };
  }).filter(Boolean);
  list.sort(function(a,b){
    if (mode === 'combat') return xiuxianCombat(b.p) - xiuxianCombat(a.p);
    if (mode === 'realm') return (b.p.realm - a.p.realm) || (b.p.spirit - a.p.spirit);
    return (b.p.premium || 0) - (a.p.premium || 0);
  });
  let rank = 0;
  for (let i = 0; i < list.length; i++) { if (list[i].id === id) { rank = i + 1; break; } }
  return { rank: rank, total: list.length };
}
function xiuxianTodayStr() { let d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function xiuxianWeekKey() { const d = new Date(); const one = (d.getDay() + 6) % 7; d.setDate(d.getDate() - one); return d.getFullYear() + 'W' + d.getMonth() + d.getDate(); }

// —— 状态管理 ——
function ensureXiuxian() {
  if (!state.xiuxian) state.xiuxian = { view: 'archive', activeClass: null, activeStudent: null, students: {}, meta: {}, hwClaimed: {}, customTasks: [] };
  if (!state.xiuxian.students) state.xiuxian.students = {};
  if (!state.xiuxian.meta) state.xiuxian.meta = {};
  if (!state.xiuxian.hwClaimed) state.xiuxian.hwClaimed = {};
  if (!state.xiuxian.customTasks) state.xiuxian.customTasks = [];
  const cur = state.xiuxian.students;
  (state.students || []).forEach(function (s, i) {
    if (!cur[s.id]) {
      let ch = xiuxianRandomCommonChar();
      const squad = (i % XIUXIAN_RULES.SQUAD_RULES.squadsPerClass) + 1;
      cur[s.id] = xiuxianNewProfile(ch.id, squad);
    } else {
      // 补齐新字段（向后兼容）
      const def = xiuxianNewProfile(cur[s.id].characterId, cur[s.id].squad);
      for (const k in def) { if (def.hasOwnProperty(k) && cur[s.id][k] === undefined) cur[s.id][k] = def[k]; }
      // 旧版 weapon 字段迁移到新版 equipWeapon
      if (cur[s.id].weapon && !cur[s.id].equipWeapon) cur[s.id].equipWeapon = cur[s.id].weapon;
    }
    // 灵根始终按最新成绩自动刷新（设计：灵根=最新测试成绩）
    cur[s.id].linggen = xiuxianCalcLinggen(s.id);
  });
}
function xiuxianNewProfile(charId, squad) {
  return {
    characterId: charId, realm: 0, spirit: 0, stone: 15, premium: 0,
    linggen: '凡品', switchUsed: false, squad: String(squad || 1), isLeader: false,
    pityCount: 0, lastPremiumTs: 0, lastCultivateDay: '', btFails: 0,
    gongfaBonus: 0, doubleCultivate: false, switchLocked: false, cosmetics: {},
    lastBreakthroughTier: 1, stage: 0, spiritOverflow: 0,
    autoCultivate: true, autoStoneConvert: true,
    weapon: null, weaponInventory: [],
    equipWeapon: null, equipOutfit: null, outfitInventory: []
  };
}
function xiuxianProfile(id) { ensureXiuxian(); return state.xiuxian.students[id]; }

// —— 导航 ——
function xiuxianSelectClass(cls) { ensureXiuxian(); state.xiuxian.view = 'class-home'; state.xiuxian.activeClass = cls; state.xiuxian.activeStudent = null; xiuxianAutoRoutine(); saveState(); renderPage(); }
function xiuxianSelectStudent(id) { console.log('[xiuxianSelectStudent] id=', id, 'currentPage=', state.currentPage); ensureXiuxian(); state.xiuxian.view = 'student-home'; state.xiuxian.activeStudent = id; saveState(); renderPage(); }
function xiuxianBackToClass() { navigateTo('xiuxian-archive'); }
function xiuxianBackToSelect() { navigateTo('xiuxian-archive'); }

function xiuxianRecalcLinggenSilent() {
  ensureXiuxian();
  for (const k in state.xiuxian.students) {
    if (state.xiuxian.students.hasOwnProperty(k)) {
      state.xiuxian.students[k].linggen = xiuxianCalcLinggen(k);
    }
  }
}
function xiuxianRefreshLinggen() {
  xiuxianRecalcLinggenSilent();
  saveState(); renderPage();
  showToast('已按最新成绩刷新 ' + Object.keys(state.xiuxian.students).length + ' 名学生灵根', 'success');
}

// —— 例行（Stage 3）：每日修炼发放 + 每周一队长俸禄 ——
function xiuxianAutoRoutine() {
  let meta = state.xiuxian.meta;
  xiuxianAutoCultivate();
  xiuxianDailyStoneToSpirit();
  const wk = xiuxianWeekKey();
  if (meta.lastWeeklyWeek !== wk) { xiuxianWeeklyRoutineAll(); meta.lastWeeklyWeek = wk; saveState(); }
  // 作业灵石12小时自动同步
  xiuxianAutoSyncHw();
}
function xiuxianAutoSyncHw() {
  ensureXiuxian();
  let meta = state.xiuxian.meta;
  let now = Date.now();
  const lastTs = meta.lastHwSyncTs || 0;
  // 检查是否有未领取的作业灵石
  let claimed = state.xiuxian.hwClaimed || {};
  const hasUnclaimed = (state.homeworkRecords || []).some(function(r){
    if (r.status === 'pending') return false;
    let key = r.studentId + '_' + r.taskId;
    return !claimed[key];
  });
  if (!hasUnclaimed) { meta.lastHwSyncTs = now; return; }
  // 12小时无操作自动同步
  const AUTO_SYNC_MS = 12 * 3600000;
  if (now - lastTs < AUTO_SYNC_MS) return;
  // 执行静默自动同步（不弹toast、不renderPage）
  let fc = '';
  let hw = (state.homeworkRecords || []).filter(function(r){
    if (r.status === 'pending') return false;
    return true;
  });
  let total = 0, cnt = 0, premiumGot = 0;
  let cfg = XIUXIAN_RULES.PREMIUM_STONE;
  hw.forEach(function(r){
    let key = r.studentId + '_' + r.taskId;
    if (claimed[key]) return;
    let stones = HW_STONE_RULES[r.status] || 0;
    if (stones > 0 && state.xiuxian.students[r.studentId]) {
      state.xiuxian.students[r.studentId].stone += stones;
      total += stones; cnt++;
      let p = state.xiuxian.students[r.studentId];
      let inWindow = (now - (p.lastPremiumTs || 0)) < cfg.pityWindowDays * 86400000;
      let pity = inWindow ? (p.pityCount || 0) : 0;
      let guaranteed = pity >= cfg.pityThreshold;
      let rate = guaranteed ? 1 : Math.min(1, cfg.dropBaseRate + pity * cfg.dropRateIncrement);
      if (Math.random() < rate || guaranteed) {
        p.premium += 1; p.pityCount = 0; p.lastPremiumTs = now; premiumGot++;
      } else {
        p.pityCount = pity + 1; p.lastPremiumTs = now;
      }
    }
    claimed[key] = true;
  });
  state.xiuxian.hwClaimed = claimed;
  meta.lastHwSyncTs = now;
  saveState();
}
function xiuxianWeeklyRoutineAll() {
  const perClass = XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone;
  let cnt = 0;
  for (const k in state.xiuxian.students) {
    if (!state.xiuxian.students.hasOwnProperty(k)) continue;
    if (state.xiuxian.students[k].isLeader) { state.xiuxian.students[k].stone += perClass; cnt++; }
  }
  return cnt;
}
function xiuxianWeeklyRoutine(cls) {
  ensureXiuxian();
  let cnt = 0;
  (state.students || []).forEach(function (s) {
    if (s.classId !== cls) return;
    let p = state.xiuxian.students[s.id];
    if (p && p.isLeader) { p.stone += XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone; cnt++; }
  });
  saveState(); renderPage();
  showToast('已发放队长周俸（' + cnt + ' 名队长，各 +' + XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone + ' 灵石）', 'success');
}
function xiuxianAutoCultivate() {
  ensureXiuxian();
  let t = xiuxianTodayStr();
  let meta = state.xiuxian.meta;
  if (meta.lastCultivateDay === t) return;
  let ratio = XIUXIAN_RULES.AUTO_SPIRIT_TO_STONE_RATIO || 5;
  let advanced = 0, converted = 0;
  for (const k in state.xiuxian.students) {
    if (!state.xiuxian.students.hasOwnProperty(k)) continue;
    let p = state.xiuxian.students[k];
    if (p.realm >= 6) continue;
    let lg = xiuxianLinggenObj(p.linggen);
    let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
    let gain = lg.dailySpirit + (p.gongfaBonus || 0);
    if (p.doubleCultivate) { gain *= 2; p.doubleCultivate = false; }
    // 自动修炼开关：关闭后每日灵气直接转灵石
    if (p.autoCultivate === false) {
      const totalOff = (p.spiritOverflow || 0) + gain;
      const stonesOff = Math.floor(totalOff / ratio);
      if (stonesOff > 0) { p.stone += stonesOff; converted += stonesOff; }
      p.spiritOverflow = totalOff % ratio;
      continue;
    }
    p.spirit += gain; advanced++;
    converted += xiuxianTrySmallBreakthrough(p);
  }
  meta.lastCultivateDay = t;
  saveState();
}
function xiuxianTrySmallBreakthrough(p) {
  if (p.realm >= 6) return 0;
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  while (p.spirit >= cap && (p.stage || 0) < 2) {
    p.spirit -= cap; p.stage = (p.stage || 0) + 1;
  }
  let converted = 0;
  if (p.spirit > cap) {
    let total = (p.spiritOverflow || 0) + (p.spirit - cap);
    const ratio = XIUXIAN_RULES.AUTO_SPIRIT_TO_STONE_RATIO || 3;
    let stones = Math.floor(total / ratio);
    if (stones > 0) { p.stone += stones; converted = stones; }
    p.spiritOverflow = total % ratio; p.spirit = cap;
  }
  return converted;
}
function xiuxianDailyStoneToSpirit() {
  ensureXiuxian();
  let t = xiuxianTodayStr();
  const meta = state.xiuxian.meta;
  if (meta.lastStoneConvertDay === t) return;
  let rate = XIUXIAN_RULES.STONE_TO_SPIRIT_RATE || 3;
  for (const k in state.xiuxian.students) {
    if (!state.xiuxian.students.hasOwnProperty(k)) continue;
    let p = state.xiuxian.students[k];
    if (p.autoStoneConvert === false || !p.stone) continue;
    let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
    if (p.spirit >= cap) continue;
    let need = Math.max(0, Math.floor((cap - p.spirit) / rate));
    const use = Math.min(need, p.stone);
    if (use > 0) { p.stone -= use; p.spirit += use * rate; xiuxianTrySmallBreakthrough(p); }
  }
  meta.lastStoneConvertDay = t;
  saveState();
}
function xiuxianToggleAutoCultivate(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.autoCultivate = p.autoCultivate === false;
  saveState(); renderPage();
  showToast(p.autoCultivate ? '已开启自动修炼' : '已关闭自动修炼，灵气将自动转灵石', 'info');
}
function xiuxianToggleAutoStoneConvert(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.autoStoneConvert = p.autoStoneConvert === false;
  saveState(); renderPage();
  showToast(p.autoStoneConvert ? '已开启每日灵石自动兑灵气' : '已关闭每日灵石自动兑灵气', 'info');
}

// —— 核心动作 ——
function xiuxianCultivateInfo(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let lg = xiuxianLinggenObj(p.linggen);
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  let gain = lg.dailySpirit + (p.gongfaBonus || 0);
  let stage = xiuxianEvoStage(p);
  const atMax = (p.stage || 0) >= 2 && p.spirit >= cap;
  let msg = '自动修炼：每日灵气 +' + gain + '（' + lg.displayLabel + '）';
  if (atMax && p.realm < 6) msg += '，灵气已满，可突破大境界！';
  else if ((p.stage || 0) >= 2) msg += '，溢出灵气自动转灵石(3:1)';
  showToast(msg, atMax && p.realm < 6 ? 'warn' : 'info');
}
function xiuxianExchange(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let rate = XIUXIAN_RULES.STONE_TO_SPIRIT_RATE;
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  const maxCan = Math.floor((cap - p.spirit) / rate);
  const maxStones = Math.min(p.stone, Math.max(maxCan, 0));
  let html = '<div class="x-modal-head"><span class="x-modal-title">💱 灵石兑灵气 · ' + escapeHtml((state.students.find(function(s){return s.id===id;})||{}).name||'同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body">' +
    '<div class="x-exchange-info"><div>💰 灵石：<b>' + p.stone + '</b></div><div>🌀 灵气：<b>' + p.spirit + ' / ' + cap + '</b></div><div>📊 兑换比：1灵石 → ' + rate + '灵气</div></div>' +
    '<div class="x-exchange-input"><label>兑换数量</label><input type="number" id="xExAmount" value="1" min="1" max="' + p.stone + '" /><span>灵石</span></div>' +
    '<div class="x-exchange-quick"><button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="[1]">1颗</button>' +
    '<button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="[5]">5颗</button>' +
    '<button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="[10]">10颗</button>' +
    '<button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="' + escapeAttr(JSON.stringify([maxStones])) + '">最大</button></div>' +
    '<div class="x-exchange-preview" id="xExPreview">可获得 <b>' + rate + '</b> 灵气</div>' +
    '<button class="btn btn-primary" style="width:100%;margin-top:8px" data-click="xiuxianExchangeConfirm" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">确认兑换</button>' +
    '</div>';
  xiuxianModal(html);
  setTimeout(function(){
    let inp = document.getElementById('xExAmount');
    if (inp) inp.addEventListener('input', function(){
      let v = parseInt(inp.value) || 0;
      document.getElementById('xExPreview').innerHTML = '可获得 <b>' + (v * rate) + '</b> 灵气';
    });
  }, 50);
}
function xiuxianExchangeConfirm(id) {
  let p = xiuxianProfile(id); if (!p) return;
  const inp = document.getElementById('xExAmount');
  let v = parseInt(inp ? inp.value : '1') || 0;
  if (v <= 0) { showToast('数量必须大于0', 'warn'); return; }
  if (v > p.stone) { showToast('灵石不足（当前' + p.stone + '）', 'warn'); return; }
  p.stone -= v;
  const gain = v * XIUXIAN_RULES.STONE_TO_SPIRIT_RATE;
  p.spirit += gain;
  xiuxianTrySmallBreakthrough(p);
  saveState(); renderPage();
  xiuxianCloseModal();
  showToast('兑换：' + v + '灵石 → ' + gain + '灵气', 'success');
}
let xiuxianGearTab = 'weapon';
function xiuxianOpenWeapon(id) {
  xiuxianGearTab = 'weapon';
  xiuxianRenderGear(id);
}
function xiuxianGearSetTab(id, tab) {
  xiuxianGearTab = tab;
  xiuxianRenderGear(id);
}
function xiuxianRenderGear(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let s = (state.students || []).find(function(x){return x.id===id;})||{};
  const tierColors = ['#9E9E9E','#4CAF50','#2196F3','#AB47BC','#FF7043','#FFD700'];
  const tabBar = '<div class="x-wp-tabs"><span class="x-wp-tab ' + (xiuxianGearTab==='weapon'?'on':'') + '" data-click="xiuxianGearSetTab" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','weapon'])) + '">⚔ 兵器</span>' +
    '<span class="x-wp-tab ' + (xiuxianGearTab==='outfit'?'on':'') + '" data-click="xiuxianGearSetTab" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','outfit'])) + '">👘 服装</span></div>';
  let body = '';
  if (xiuxianGearTab === 'weapon') {
    let owned = p.weaponInventory || [];
    const curWeapon = p.equipWeapon ? xiuxianWeaponObj(p.equipWeapon) : null;
    const ownedList = owned.map(function(wid){
      let w = xiuxianWeaponObj(wid); if(!w) return '';
      let equipped = p.equipWeapon === wid;
      return '<div class="x-wp-card' + (equipped ? ' equipped' : '') + '" style="border-color:' + tierColors[w.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[w.tier] + '">' + escapeHtml(w.name) + '</div>' +
        '<div class="x-wp-tier">' + w.tierName + '</div>' +
        '<div class="x-wp-bonus">⚔ +' + Math.round(w.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(w.desc) + '</div>' +
        (equipped ? '<span class="x-wp-equipped">已装备</span>' :
          '<button class="btn btn-sm btn-primary" data-click="xiuxianEquipWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + wid + ''])) + '">装备</button>') +
        '</div>';
    }).join('');
    const shopList = XIUXIAN_RULES.WEAPONS.filter(function(w){ return owned.indexOf(w.id) < 0; }).map(function(w){
      let costStr = w.costType === 'premium' ? ('💎 ' + w.cost) : ('💰 ' + w.cost);
      let canAfford = w.costType === 'premium' ? p.premium >= w.cost : p.stone >= w.cost;
      return '<div class="x-wp-card" style="border-color:' + tierColors[w.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[w.tier] + '">' + escapeHtml(w.name) + '</div>' +
        '<div class="x-wp-tier">' + w.tierName + '</div>' +
        '<div class="x-wp-bonus">⚔ +' + Math.round(w.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(w.desc) + '</div>' +
        '<div class="x-wp-cost">' + costStr + '</div>' +
        '<button class="btn btn-sm ' + (canAfford ? 'btn-primary' : '') + '" ' + (canAfford ? 'data-click="xiuxianBuyWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + w.id + ''])) + '"' : 'disabled') + '>购买</button>' +
        '</div>';
    }).join('');
    body = '<div class="x-wp-current">' + (curWeapon ?
      '当前兵器：<b style="color:' + tierColors[curWeapon.tier] + '">' + escapeHtml(curWeapon.name) + '</b>（' + curWeapon.tierName + '）战力+' + Math.round(curWeapon.bonusPct*100) + '%' :
      '未装备兵器') +
      '<button class="btn btn-sm" ' + (p.equipWeapon ? 'data-click="xiuxianUnequipWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '"' : 'disabled') + '>卸下</button></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">📦 我的兵器</div><div class="x-wp-grid">' + (ownedList || '<div class="x-tip">暂无兵器</div>') + '</div></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">🛒 兵器商店</div><div class="x-wp-grid">' + (shopList || '<div class="x-tip">已拥有全部兵器</div>') + '</div></div>';
  } else {
    const oOwned = p.outfitInventory || [];
    const curOutfit = p.equipOutfit ? xiuxianOutfitObj(p.equipOutfit) : null;
    const ownedOutfitList = oOwned.map(function(oid){
      let o = xiuxianOutfitObj(oid); if(!o) return '';
      const equipped = p.equipOutfit === oid;
      return '<div class="x-wp-card' + (equipped ? ' equipped' : '') + '" style="border-color:' + tierColors[o.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[o.tier] + '">' + escapeHtml(o.name) + '</div>' +
        '<div class="x-wp-tier">' + o.tierName + '</div>' +
        '<div class="x-wp-bonus">👘 +' + Math.round(o.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(o.desc) + '</div>' +
        (equipped ? '<span class="x-wp-equipped">已装备</span>' :
          '<button class="btn btn-sm btn-primary" data-click="xiuxianEquipOutfit" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + oid + ''])) + '">装备</button>') +
        '</div>';
    }).join('');
    const shopOutfitList = XIUXIAN_RULES.OUTFITS.filter(function(o){ return oOwned.indexOf(o.id) < 0; }).map(function(o){
      let costStr = o.costType === 'premium' ? ('💎 ' + o.cost) : ('💰 ' + o.cost);
      const canAfford = o.costType === 'premium' ? p.premium >= o.cost : p.stone >= o.cost;
      return '<div class="x-wp-card" style="border-color:' + tierColors[o.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[o.tier] + '">' + escapeHtml(o.name) + '</div>' +
        '<div class="x-wp-tier">' + o.tierName + '</div>' +
        '<div class="x-wp-bonus">👘 +' + Math.round(o.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(o.desc) + '</div>' +
        '<div class="x-wp-cost">' + costStr + '</div>' +
        '<button class="btn btn-sm ' + (canAfford ? 'btn-primary' : '') + '" ' + (canAfford ? 'data-click="xiuxianBuyOutfit" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + o.id + ''])) + '"' : 'disabled') + '>购买</button>' +
        '</div>';
    }).join('');
    body = '<div class="x-wp-current">' + (curOutfit ?
      '当前服装：<b style="color:' + tierColors[curOutfit.tier] + '">' + escapeHtml(curOutfit.name) + '</b>（' + curOutfit.tierName + '）战力+' + Math.round(curOutfit.bonusPct*100) + '%' :
      '未装备服装') +
      '<button class="btn btn-sm" ' + (p.equipOutfit ? 'data-click="xiuxianUnequipOutfit" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '"' : 'disabled') + '>卸下</button></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">📦 我的服装</div><div class="x-wp-grid">' + (ownedOutfitList || '<div class="x-tip">暂无服装</div>') + '</div></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">🛒 服装商店</div><div class="x-wp-grid">' + (shopOutfitList || '<div class="x-tip">已拥有全部服装</div>') + '</div></div>';
  }
  let html = '<div class="x-modal-head"><span class="x-modal-title">🎒 装备库 · ' + escapeHtml(s.name||'同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body">' + tabBar + body +
    '<div class="x-tip">💰 灵石 ' + p.stone + ' · 💎 极品灵石 ' + p.premium + ' · ⚔ 当前战力 ' + xiuxianCombat(p) + '</div>' +
    '</div>';
  xiuxianModal(html);
}
function xiuxianEquipWeapon(id, wid) {
  let p = xiuxianProfile(id); if (!p) return;
  if ((p.weaponInventory || []).indexOf(wid) < 0) { showToast('未拥有此兵器', 'warn'); return; }
  p.equipWeapon = wid; saveState(); renderPage();
  xiuxianRenderGear(id);
  showToast('已装备兵器', 'success');
}
function xiuxianUnequipWeapon(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.equipWeapon = null; saveState(); renderPage();
  xiuxianRenderGear(id);
  showToast('已卸下兵器', 'info');
}
function xiuxianBuyWeapon(id, wid) {
  let p = xiuxianProfile(id); if (!p) return;
  const w = xiuxianWeaponObj(wid); if (!w) return;
  if ((p.weaponInventory || []).indexOf(wid) >= 0) { showToast('已拥有此兵器', 'warn'); return; }
  if (w.costType === 'premium') { if (p.premium < w.cost) { showToast('极品灵石不足', 'warn'); return; } p.premium -= w.cost; }
  else { if (p.stone < w.cost) { showToast('灵石不足', 'warn'); return; } p.stone -= w.cost; }
  if (!p.weaponInventory) p.weaponInventory = [];
  p.weaponInventory.push(wid);
  p.equipWeapon = wid;
  saveState(); renderPage();
  xiuxianRenderGear(id);
  showToast('购买并装备兵器：' + w.name + '（战力+' + Math.round(w.bonusPct*100) + '%）', 'success');
}
function xiuxianEquipOutfit(id, oid) {
  let p = xiuxianProfile(id); if (!p) return;
  if ((p.outfitInventory || []).indexOf(oid) < 0) { showToast('未拥有此服装', 'warn'); return; }
  p.equipOutfit = oid; saveState(); renderPage();
  xiuxianRenderGear(id);
  showToast('已装备服装', 'success');
}
function xiuxianUnequipOutfit(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.equipOutfit = null; saveState(); renderPage();
  xiuxianRenderGear(id);
  showToast('已卸下服装', 'info');
}
function xiuxianBuyOutfit(id, oid) {
  let p = xiuxianProfile(id); if (!p) return;
  let o = xiuxianOutfitObj(oid); if (!o) return;
  if ((p.outfitInventory || []).indexOf(oid) >= 0) { showToast('已拥有此服装', 'warn'); return; }
  if (o.costType === 'premium') { if (p.premium < o.cost) { showToast('极品灵石不足', 'warn'); return; } p.premium -= o.cost; }
  else { if (p.stone < o.cost) { showToast('灵石不足', 'warn'); return; } p.stone -= o.cost; }
  if (!p.outfitInventory) p.outfitInventory = [];
  p.outfitInventory.push(oid);
  p.equipOutfit = oid;
  saveState(); renderPage();
  xiuxianRenderGear(id);
  showToast('购买并装备服装：' + o.name + '（战力+' + Math.round(o.bonusPct*100) + '%）', 'success');
}

function xiuxianExchangePremium(id) {
  let p = xiuxianProfile(id); if (!p) return;
  const need = XIUXIAN_RULES.PREMIUM_TO_STONE;
  if (p.stone < need) { showToast('灵石不足（需' + need + '兑换 1 极品灵石）', 'warn'); return; }
  p.stone -= need; p.premium += 1;
  saveState(); renderPage();
  showToast('兑换：' + need + '灵石 → 1 极品灵石 💎', 'success');
}
function xiuxianSwitchChar(id) {
  let p = xiuxianProfile(id); if (!p) return;
  if (p.switchLocked) { showToast('形象已锁定（可在商城解除）', 'warn'); return; }
  if (!p.switchUsed) { p.switchUsed = true; p.characterId = xiuxianRandomCommonChar().id; saveState(); renderPage(); showToast('首次切换免费，新形象已就位！', 'success'); return; }
  if (p.stone < XIUXIAN_RULES.SWITCH_COST_STONE) { showToast('灵石不足（需' + XIUXIAN_RULES.SWITCH_COST_STONE + '）', 'warn'); return; }
  p.stone -= XIUXIAN_RULES.SWITCH_COST_STONE; p.characterId = xiuxianRandomCommonChar().id;
  saveState(); renderPage(); showToast('已花费' + XIUXIAN_RULES.SWITCH_COST_STONE + '灵石切换形象', 'success');
}
function xiuxianDrawLimited(id, charId) {
  let p = xiuxianProfile(id); if (!p) return;
  let ch = xiuxianGetChar(charId);
  if (ch.rarity !== 'limited') { xiuxianSwitchChar(id); return; }
  let cls = ((state.students.find(function (s) { return s.id === id; })) || {}).classId || '';
  let mates = Object.keys(state.xiuxian.students).filter(function (sid) {
    return ((state.students.find(function (s) { return s.id === sid; })) || {}).classId === cls;
  });
  mates.sort(function (a, b) { return xiuxianCombat(state.xiuxian.students[b]) - xiuxianCombat(state.xiuxian.students[a]); });
  const rank = mates.indexOf(id) + 1;
  if (ch.rank_req && rank > ch.rank_req) { showToast('需班级排名前' + ch.rank_req + '（当前第' + rank + '名）', 'warn'); return; }
  let taken = 0; for (const k in state.xiuxian.students) { if (state.xiuxian.students[k].characterId === charId) taken++; }
  if (ch.quota && taken >= ch.quota) { showToast('「' + ch.name + '」限定名额已满（' + ch.quota + '）', 'warn'); return; }
  if (p.premium < ch.jipin_price) { showToast('极品灵石不足（需' + ch.jipin_price + '）', 'warn'); return; }
  p.premium -= ch.jipin_price; p.characterId = charId;
  saveState(); renderPage(); showToast('恭喜获得限定角色：' + ch.name + '！', 'success');
}
// Stage 7：突破四档概率 + 保底
function xiuxianOpenBreakthrough(id) {
  let p = xiuxianProfile(id); if (!p) return;
  if (p.realm >= 6) { showToast('已达最高境界', 'warn'); return; }
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  if ((p.stage || 0) < 2 || p.spirit < cap) { showToast('需修炼至后期且灵气满溢方可突破大境界', 'warn'); return; }
  let costs = XIUXIAN_RULES.BREAKTHROUGH_COSTS[p.realm + 1];
  const baseRates = XIUXIAN_RULES.BREAKTHROUGH_BASE_RATES;
  const bonus = XIUXIAN_RULES.BREAKTHROUGH_FAIL_BONUSES;
  const fails = p.btFails || 0;
  let rows = '';
  for (let t = 1; t <= 4; t++) {
    let rate = Math.min(1, baseRates[t - 1] + fails * bonus[t - 1]);
    const guar = (t === 4) ? '（失败必成）' : '';
    rows += '<div class="x-bt-card" data-click="xiuxianBreakthrough" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '',' + t + '])) + '">' +
      '<div class="x-bt-tier">第 ' + t + ' 档</div>' +
      '<div class="x-bt-cost">消耗 ' + costs[t - 1] + ' 灵石</div>' +
      '<div class="x-bt-rate">成功率 ' + Math.round(rate * 100) + '% ' + guar + '</div></div>';
  }
  let html = '<div class="x-modal-head"><span class="x-modal-title">⚡ 突破 · ' + xiuxianRealmObj(p.realm).name + ' → ' + xiuxianRealmObj(p.realm + 1).name + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><p class="x-tip">累计失败 ' + fails + ' 次，各档成功率已提升。第 4 档失败必定成功（保底）。</p><div class="x-bt-grid">' + rows + '</div></div>';
  xiuxianModal(html);
}
function xiuxianBreakthrough(id, tier) {
  let p = xiuxianProfile(id); if (!p) return;
  if (p.realm >= 6) { showToast('已达最高境界', 'warn'); return; }
  const costs = XIUXIAN_RULES.BREAKTHROUGH_COSTS[p.realm + 1];
  let cost = costs[tier - 1];
  let rate = Math.min(1, XIUXIAN_RULES.BREAKTHROUGH_BASE_RATES[tier - 1] + (p.btFails || 0) * XIUXIAN_RULES.BREAKTHROUGH_FAIL_BONUSES[tier - 1]);
  if (p.stone < cost) { showToast('突破需 ' + cost + ' 灵石（当前 ' + p.stone + '），努力修炼吧', 'warn'); xiuxianCloseModal(); return; }
  p.stone -= cost;
  const success = Math.random() < rate || tier === 4;
  if (success) {
    p.realm += 1; p.spirit = 0; p.btFails = 0; p.lastBreakthroughTier = tier; p.stage = 0; p.spiritOverflow = 0;
    saveState(); xiuxianCloseModal(); renderPage();
    showToast('突破成功！晋升「' + xiuxianRealmObj(p.realm).name + '」🎉', 'success');
  } else {
    p.btFails = (p.btFails || 0) + 1;
    saveState();
    showToast('突破失败…（下次成功率提升）', 'warn');
    xiuxianOpenBreakthrough(id);
  }
}
// Stage 8：完成任务奖励极品灵石（概率 + 保底）
function xiuxianTaskReward(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let cfg = XIUXIAN_RULES.PREMIUM_STONE;
  let now = Date.now();
  let inWindow = (now - (p.lastPremiumTs || 0)) < cfg.pityWindowDays * 86400000;
  let pity = inWindow ? (p.pityCount || 0) : 0;
  let guaranteed = pity >= cfg.pityThreshold;
  let rate = guaranteed ? 1 : Math.min(1, cfg.dropBaseRate + pity * cfg.dropRateIncrement);
  const hit = Math.random() < rate || guaranteed;
  if (hit) {
    p.premium += 1; p.pityCount = 0; p.lastPremiumTs = now;
    showToast('任务完成！获得 1 极品灵石 💎', 'success');
  } else {
    p.pityCount = pity + 1; p.lastPremiumTs = now;
    showToast('本次未掉落极品灵石（累计未得 ' + p.pityCount + '/' + cfg.pityThreshold + '，概率+' + Math.round(cfg.dropRateIncrement * 100) + '%）', 'info');
  }
  saveState(); renderPage();
}

// —— 商城（Stage 4） ——
let xiuxianMallCat = 'gongfa';
function xiuxianOpenMall(id) {
  xiuxianMallCat = 'gongfa';
  xiuxianRenderMall(id);
}
function xiuxianMallSetCat(id, cat) { xiuxianMallCat = cat; xiuxianRenderMall(id); }
function xiuxianRenderMall(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let cats = [['gongfa', '功法'], ['dan', '丹药'], ['xiulian', '修炼道具']];
  const catBar = cats.map(function (c) { return '<span class="x-wp-tab ' + (c[0] === xiuxianMallCat ? 'on' : '') + '" data-click="xiuxianMallSetCat" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + c[0] + ''])) + '">' + c[1] + '</span>'; }).join('');
  const items = XIUXIAN_RULES.MALL_CATALOG.filter(function (it) { return it.cat === xiuxianMallCat; });
  const grid = items.map(function (it) {
    const costStr = it.costType === 'premium' ? ('💎 ' + it.cost) : ('💰 ' + it.cost);
    let e = it.effect;
    let owned = false;
    if (e.type === 'freeSwitch') owned = !!p.switchUsed;
    else if (e.type === 'lock') owned = !!p.switchLocked;
    else if (e.type === 'doubleCultivate') owned = !!p.doubleCultivate;
    else if (e.type === 'btDiscount') owned = !!(p.btDiscount && p.btDiscount >= e.val);
    const label = owned ? '已生效' : '购买';
    return '<div class="x-wp-card"><div class="x-wp-name">' + escapeHtml(it.name) + '</div>' +
      '<div class="x-wp-desc">' + escapeHtml(it.desc) + '</div>' +
      '<div class="x-wp-cost">' + costStr + '</div>' +
      '<button class="btn btn-sm ' + (owned ? '' : 'btn-primary') + '" ' + (owned ? 'disabled' : 'data-click="xiuxianBuyMall" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + it.id + ''])) + '"') + '>' + label + '</button></div>';
  }).join('');
  let html = '<div class="x-modal-head"><span class="x-modal-title">🛒 修炼商城 · ' + escapeHtml((state.students.find(function (s) { return s.id === id; }) || {}).name || '同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-wp-tabs">' + catBar + '</div><div class="x-wp-grid">' + grid + '</div>' +
    '<div class="x-tip">💰 灵石 ' + p.stone + ' · 💎 极品灵石 ' + p.premium + '。功法永久提升每日灵气；丹药即时生效；修炼道具一次性效果。</div></div>';
  xiuxianModal(html);
}
function xiuxianBuyMall(id, itemId) {
  let p = xiuxianProfile(id); if (!p) return;
  const it = XIUXIAN_RULES.MALL_CATALOG.find(function (x) { return x.id === itemId; }); if (!it) return;
  const cost = it.cost;
  if (it.costType === 'premium') { if (p.premium < cost) { showToast('极品灵石不足', 'warn'); return; } p.premium -= cost; }
  else { if (p.stone < cost) { showToast('灵石不足', 'warn'); return; } p.stone -= cost; }
  let e = it.effect;
  if (e.type === 'gongfa') { p.gongfaBonus = (p.gongfaBonus || 0) + e.val; }
  else if (e.type === 'spirit') { p.spirit += e.val; xiuxianTrySmallBreakthrough(p); }
  else if (e.type === 'freeSwitch') { p.switchUsed = true; }
  else if (e.type === 'lock') { p.switchLocked = true; }
  else if (e.type === 'doubleCultivate') { p.doubleCultivate = true; }
  else if (e.type === 'btDiscount') { p.btDiscount = Math.max(p.btDiscount || 0, e.val); }
  saveState(); renderPage();
  showToast('已购买：' + it.name, 'success');
  xiuxianRenderMall(id);
}

// —— 排行榜（Stage 5） ——
let xiuxianRankMode = 'combat', xiuxianRankAnon = false;
function xiuxianOpenRank(cls) {
  if (cls) { state.xiuxian._rankCls = cls; }
  xiuxianRankMode = 'combat'; xiuxianRankAnon = false;
  xiuxianRenderRank();
}
function xiuxianRankSetMode(m) { xiuxianRankMode = m; xiuxianRenderRank(); }
function xiuxianRankToggleAnon() { xiuxianRankAnon = !xiuxianRankAnon; xiuxianRenderRank(); }
function xiuxianRenderRank() {
  let cls = state.xiuxian._rankCls || '';
  let list = (state.students || []).filter(function (s) { return !cls || s.classId === cls; }).map(function (s) {
    let p = state.xiuxian.students[s.id]; if (!p) return null;
    return { id: s.id, name: s.name, p: p };
  }).filter(Boolean);
  list.sort(function (a, b) {
    return xiuxianRankMode === 'combat' ? (xiuxianCombat(b.p) - xiuxianCombat(a.p)) : (b.p.stone - a.p.stone);
  });
  let rows = '<div class="x-rank-row head"><div class="x-rank-medal">#</div><div class="x-rank-avatar">头像</div><div class="x-rank-name">修士</div><div class="x-rank-val">境界</div><div class="x-rank-val">' + (xiuxianRankMode === 'combat' ? '战力' : '灵石') + '</div></div>';
  list.forEach(function (o, i) {
    let rankIdx = i + 1;
    let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : rankIdx;
    let nm = xiuxianRankAnon ? ('匿名' + rankIdx) : escapeHtml(o.name || '同学');
    let val = xiuxianRankMode === 'combat' ? xiuxianCombat(o.p) : o.p.stone;
    let ch = xiuxianGetChar(o.p.characterId);
    let frameCls = rankIdx <= 10 ? ' x-rank-frame-' + rankIdx : '';
    let avatarHtml = '<div class="x-rank-avatar"><div class="x-rank-frame' + frameCls + '">' + xiuxianAvatarSVG(ch, o.p) + '</div></div>';
    rows += '<div class="x-rank-row"><div class="x-rank-medal">' + medal + '</div>' + avatarHtml + '<div class="x-rank-name">' + nm + '</div><div class="x-rank-val">' + xiuxianRealmObj(o.p.realm).name + '</div><div class="x-rank-val">' + val + '</div></div>';
  });
  const limitedNote = '<div class="x-tip">限定角色需榜单名次门槛 + 极品灵石抽取（如迪迦奥特曼限前10名）。匿名模式仅隐藏姓名，名次与数值不变。</div>';
  let html = '<div class="x-modal-head"><span class="x-modal-title">🏆 修仙排行榜' + (cls ? ' · ' + escapeHtml(cls) : ' · 全年级') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-rank-tabs">' +
    '<span class="x-mall-cat ' + (xiuxianRankMode === 'combat' ? 'on' : '') + '" data-click="xiuxianRankSetMode" data-click-args="' + escapeAttr(JSON.stringify(['combat'])) + '">战力榜</span>' +
    '<span class="x-mall-cat ' + (xiuxianRankMode === 'stone' ? 'on' : '') + '" data-click="xiuxianRankSetMode" data-click-args="' + escapeAttr(JSON.stringify(['stone'])) + '">灵石榜</span>' +
    '<span class="x-mall-cat ' + (xiuxianRankAnon ? 'on' : '') + '" data-click="xiuxianRankToggleAnon">' + (xiuxianRankAnon ? '匿名：开' : '匿名：关') + '</span></div>' +
    rows + limitedNote + '</div>';
  xiuxianModal(html);
}

// —— 小队（Stage 6） ——
function xiuxianOpenTeam(cls) {
  let n = XIUXIAN_RULES.SQUAD_RULES.squadsPerClass;
  let grids = '';
  for (let sq = 1; sq <= n; sq++) {
    const members = (state.students || []).filter(function (s) { return s.classId === cls && state.xiuxian.students[s.id] && state.xiuxian.students[s.id].squad === String(sq); });
    const mhtml = members.map(function (s) {
      let p = state.xiuxian.students[s.id];
      const isL = p && p.isLeader;
      return '<div class="x-squad-member ' + (isL ? 'leader' : '') + '">' +
        '<span>' + escapeHtml(s.name || '同学') + (isL ? ' ⭐' : '') + '</span>' +
        '<span style="margin-left:auto;display:flex;gap:4px">' +
        '<button class="btn btn-xs" data-click="xiuxianAppointLeader" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + '','' + escapeHtml(s.id) + ''])) + '">任队长</button>' +
        (isL ? '<button class="btn btn-xs" data-click="xiuxianRemoveLeader" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + '','' + escapeHtml(s.id) + ''])) + '">免</button>' : '') +
        '</span></div>';
    }).join('') || '<div style="color:#aaa;font-size:12px;padding:6px">暂无成员</div>';
    grids += '<div class="x-squad"><div class="x-squad-title">第 ' + sq + ' 小队</div>' + mhtml + '</div>';
  }
  const html = '<div class="x-modal-head"><span class="x-modal-title">👥 ' + escapeHtml(cls) + ' 小队管理（' + n + ' 队）</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-tip">每班 ' + n + ' 队，队长每周一自动获得 ' + XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone + ' 灵石俸禄。任命由教师手动操作。</div><div class="x-squad-grid">' + grids + '</div></div>';
  xiuxianModal(html);
}
function xiuxianAppointLeader(cls, sid) {
  ensureXiuxian();
  // 同班其它队长卸任
  (state.students || []).forEach(function (s) {
    if (s.classId === cls && state.xiuxian.students[s.id]) state.xiuxian.students[s.id].isLeader = false;
  });
  if (state.xiuxian.students[sid]) state.xiuxian.students[sid].isLeader = true;
  saveState(); xiuxianOpenTeam(cls);
  showToast('已任命队长', 'success');
}
function xiuxianRemoveLeader(cls, sid) {
  ensureXiuxian();
  if (state.xiuxian.students[sid]) state.xiuxian.students[sid].isLeader = false;
  saveState(); xiuxianOpenTeam(cls);
  showToast('已罢免队长', 'info');
}

// —— 通用弹窗 ——
function xiuxianModal(html) {
  xiuxianCloseModal();
  const ov = document.createElement('div');
  ov.className = 'x-modal-overlay'; ov.id = 'x-modal-overlay';
  ov.innerHTML = '<div class="x-modal">' + html + '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov) xiuxianCloseModal(); });
}
function xiuxianCloseModal() { let o = document.getElementById('x-modal-overlay'); if (o) o.remove(); }

// —— 渲染 ——
function renderXiuxian(area) {
  ensureXiuxian(); xiuxianAutoRoutine();
  let v = state.xiuxian.view || 'archive';
  console.log('[renderXiuxian] view=', v, 'activeStudent=', state.xiuxian.activeStudent, 'activeClass=', state.xiuxian.activeClass);
  if (v === 'student-home') return renderXiuxianStudentHome(area, state.xiuxian.activeStudent);
  if (v === 'class-home') return renderXiuxianClassHome(area, state.xiuxian.activeClass);
  if (v === 'tasks') return renderXiuxianTasks(area);
  if (v === 'pool') return renderXiuxianPool(area);
  if (v === 'rank') return renderXiuxianRankPage(area);
  return renderXiuxianArchive(area);
}
function xiuxianSetTab(tab) {
  console.log('[xiuxianSetTab] tab=', tab, '→ will navigateTo xiuxian-' + tab);
  navigateTo('xiuxian-' + tab);
}
function xiuxianTabBar(active) {
  const tabs = [{id:'archive',icon:'📖',label:'01修仙档案总库'},{id:'tasks',icon:'📜',label:'02修仙任务系统'},{id:'rank',icon:'🏆',label:'03修仙排行榜单'},{id:'pool',icon:'🎴',label:'04修仙角色体质'}];
  return '<div class="x-tabbar">' + tabs.map(function(t){
    return '<div class="x-tab'+(active===t.id?' active':'')+'" data-click="xiuxianSetTab" data-click-args="' + escapeAttr(JSON.stringify([''+t.id+''])) + '">'+t.icon+' '+t.label+'</div>';
  }).join('') + '</div>';
}
function xiuxianArchiveFilter(type, val) {
  if (type==='class') state.xiuxian._filterClass = val;
  else if (type==='linggen') state.xiuxian._filterLinggen = val;
  else if (type==='search') state.xiuxian._searchKey = val;
  saveState(); renderPage();
}
function renderXiuxianArchive(area) {
  const all = state.students || [];
  let cset = {}; all.forEach(function(s){ if(s.classId) cset[s.classId]=1; });
  let classes = Object.keys(cset).sort();
  let fc = state.xiuxian._filterClass || '', fl = state.xiuxian._filterLinggen || '', sk = state.xiuxian._searchKey || '';
  const filtered = all.filter(function(s){
    if (fc && s.classId !== fc) return false;
    if (fl) { let p = xiuxianProfile(s.id); if (p.linggen !== fl) return false; }
    if (sk) { const n = (s.name||'').toLowerCase(), no = (s.studentNo||'').toLowerCase(); if (n.indexOf(sk.toLowerCase())<0 && no.indexOf(sk.toLowerCase())<0) return false; }
    return true;
  });
  let classOpts = '<option value="">全部班级</option>' + classes.map(function(c){return '<option value="'+escapeHtml(c)+'"'+(fc===c?' selected':'')+'>'+escapeHtml(c)+'</option>';}).join('');
  let lgOpts = '<option value="">全部灵根</option>' + XIUXIAN_RULES.LINGGEN_LEVELS.map(function(l){return '<option value="'+l.name+'"'+(fl===l.name?' selected':'')+'>'+l.displayLabel+'</option>';}).join('');
  let cards = filtered.map(function(s){
    let p = xiuxianProfile(s.id); let ch = xiuxianGetChar(p.characterId); let lg = xiuxianLinggenObj(p.linggen); let realm = xiuxianRealmObj(p.realm);
    let cp = xiuxianCombat(p);
    return '<div class="x-card x-stu-card '+xiuxianLinggenFrameClass(p.linggen)+'" data-click="xiuxianSelectStudent" data-click-args="' + escapeAttr(JSON.stringify([''+escapeHtml(s.id)+''])) + '">' +
      '<div class="x-cell-avatar x-act-'+ch.action+'" style="filter:drop-shadow(0 0 6px '+lg.glowColor+')">'+xiuxianAvatarSVG(ch,p)+'</div>' +
      '<div class="x-stu-name">'+escapeHtml(s.name||'同学')+'</div>' +
      '<div class="x-stu-class">'+escapeHtml(s.classId||'')+'</div>' +
      '<div class="x-tag" style="background:'+lg.color+'">'+lg.displayLabel+'</div>' +
      '<div class="x-stu-realm">'+realm.name+' · '+xiuxianEvoStage(p)+(p.isLeader?' ⭐':'')+'</div>' +
      '<div class="x-stu-stats"><span>灵气 '+p.spirit+'</span><span>战力 '+cp+'</span></div></div>';
  }).join('');
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">修仙档案总库 · 修炼你的灵宠</span></div>' +
    xiuxianTabBar('archive') +
    '<div class="x-filter-bar">' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev57">'+classOpts+'</select>' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev58">'+lgOpts+'</select>' +
      '<input class="x-filter-input" type="text" placeholder="搜索姓名/学号..." value="'+escapeHtml(sk)+'" data-ev="input" data-ev-key="ev59"/>' +
      '<span class="x-filter-count">共 '+filtered.length+' 名修仙学子</span>' +
    '</div>' +
    '<div class="x-stu-grid">'+(cards||'<div class="x-tip">无匹配学生</div>')+'</div>' +
    '<div class="x-tip">灵根按最新成绩自动划分，无需手动刷新。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}
function renderXiuxianClassHome(area, cls) {
  if (!cls) return xiuxianBackToSelect();
  const mates = (state.students || []).filter(function (s) { return s.classId === cls; });
  let cards = mates.map(function (s) {
    let p = xiuxianProfile(s.id); let ch = xiuxianGetChar(p.characterId); let lg = xiuxianLinggenObj(p.linggen);
    let cp = xiuxianCombat(p);
    return '<div class="x-card x-stu-card '+xiuxianLinggenFrameClass(p.linggen)+'" data-click="xiuxianSelectStudent" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(s.id) + ''])) + '">' +
      '<div class="x-cell-avatar x-act-' + ch.action + '" style="filter:drop-shadow(0 0 6px ' + lg.glowColor + ')">' + xiuxianAvatarSVG(ch, p) + '</div>' +
      '<div class="x-stu-name">' + escapeHtml(s.name || '同学') + '</div>' +
      '<div class="x-tag" style="background:' + lg.color + '">' + lg.displayLabel + '</div>' +
      '<div class="x-stu-realm">' + xiuxianRealmObj(p.realm).name + ' · ' + xiuxianEvoStage(p) + (p.isLeader ? ' ⭐' : '') + '</div>' +
      '<div class="x-stu-stats"><span>灵气 ' + p.spirit + '</span><span>战力 ' + cp + '</span></div></div>';
  }).join('');
  const tSpirit = mates.reduce(function(a,s){let p=xiuxianProfile(s.id);return a+(p.spirit||0);},0);
  const tStone = mates.reduce(function(a,s){let p=xiuxianProfile(s.id);return a+(p.stone||0);},0);
  const tCombat = mates.reduce(function(a,s){let p=xiuxianProfile(s.id);return a+xiuxianCombat(p);},0);
  const tLeader = mates.filter(function(s){return xiuxianProfile(s.id).isLeader;}).length;
  const tRealm = mates.reduce(function(a,s){return a+(xiuxianProfile(s.id).realm||0);},0);
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-bar"><button class="btn btn-sm" data-click="xiuxianBackToSelect">← 档案总库</button>' +
    '<span class="x-bar-title">' + escapeHtml(cls) + ' · ' + mates.length + '人</span>' +
    '<button class="btn btn-sm" data-click="xiuxianWeeklyRoutine" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + ''])) + '">👑 发周俸</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenRank" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + ''])) + '">🏆 排行榜</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenTeam" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + ''])) + '">👥 小队</button></div>' +
    '<div class="x-res-bar">' +
      '<div class="x-res-cell"><span>修仙学子</span><b>' + mates.length + '</b></div>' +
      '<div class="x-res-cell"><span>总灵气</span><b>' + tSpirit + '</b></div>' +
      '<div class="x-res-cell"><span>总灵石</span><b>💰 ' + tStone + '</b></div>' +
      '<div class="x-res-cell"><span>总战力</span><b>⚔ ' + tCombat + '</b></div>' +
      '<div class="x-res-cell"><span>境界总和</span><b>' + tRealm + '</b></div>' +
      '<div class="x-res-cell"><span>小队队长</span><b>' + tLeader + '</b></div>' +
    '</div>' +
    '<div class="x-stu-grid">' + cards + '</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}
function renderXiuxianStudentHome(area, id) {
  let s = (state.students || []).find(function (x) { return x.id === id; });
  if (!s) return xiuxianBackToSelect();
  let p = xiuxianProfile(id);
  let ch = xiuxianGetChar(p.characterId);
  let lg = xiuxianLinggenObj(p.linggen);
  let realm = xiuxianRealmObj(p.realm);
  const cap = Math.max(realm.spiritCap, 10);
  const pct = cap > 0 ? Math.min(100, Math.round(p.spirit / cap * 100)) : 100;
  const stage = xiuxianEvoStage(p);
  const switchLabel = p.switchUsed ? ('更换角色(灵石' + XIUXIAN_RULES.SWITCH_COST_STONE + ')') : '更换角色(免费)';
  const wName = p.equipWeapon ? (xiuxianWeaponObj(p.equipWeapon) || {}).name : '无';
  const oName = p.equipOutfit ? (xiuxianOutfitObj(p.equipOutfit) || {}).name : '无';
  const cp = xiuxianCombat(p);
  const atMaxStage = (p.stage || 0) >= 2 && p.spirit >= cap;
  const btReady = atMaxStage && p.realm < 6;
  let stageDots = '';
  for (let si = 0; si < 3; si++) { stageDots += '<span class="x-stage-dot' + (si <= (p.stage || 0) ? ' on' : '') + '"></span>'; }
  const autoCultOn = p.autoCultivate !== false;
  const autoConvertOn = p.autoStoneConvert !== false;
  const rCombatC = xiuxianMyRank(id, 'class', 'combat');
  const rCombatG = xiuxianMyRank(id, 'grade', 'combat');
  const rRealmC = xiuxianMyRank(id, 'class', 'realm');
  const rRealmG = xiuxianMyRank(id, 'grade', 'realm');
  const rPremiumC = xiuxianMyRank(id, 'class', 'premium');
  const rPremiumG = xiuxianMyRank(id, 'grade', 'premium');
  const rankMeHtml = '<div class="x-rank-me">' +
    '<div class="x-rank-me-title">🏆 我的排名</div>' +
    '<div class="x-rank-me-grid">' +
      '<div><span>战力榜</span><b>班 ' + (rCombatC.rank||'-') + '/' + rCombatC.total + '</b><b>年 ' + (rCombatG.rank||'-') + '/' + rCombatG.total + '</b></div>' +
      '<div><span>境界榜</span><b>班 ' + (rRealmC.rank||'-') + '/' + rRealmC.total + '</b><b>年 ' + (rRealmG.rank||'-') + '/' + rRealmG.total + '</b></div>' +
      '<div><span>极品灵石榜</span><b>班 ' + (rPremiumC.rank||'-') + '/' + rPremiumC.total + '</b><b>年 ' + (rPremiumG.rank||'-') + '/' + rPremiumG.total + '</b></div>' +
    '</div></div>';
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-bar"><button class="btn btn-sm" data-click="xiuxianBackToSelect">← 档案总库</button>' +
    '<span class="x-bar-title">' + escapeHtml(s.name || '同学') + ' 的修炼主页</span></div>' +
    '<div class="x-hero ' + xiuxianLinggenFrameClass(p.linggen) + '" style="border-color:' + lg.color + '">' +
    '<div class="x-seal">仙</div>' +
    '<div class="x-avatar x-act-' + ch.action + '" style="filter:drop-shadow(0 0 14px ' + lg.glowColor + ')">' + xiuxianAvatarSVG(ch, p) + '</div>' +
    '<div class="x-hero-info"><div class="x-hero-name">' + ch.name + ' <span class="x-tag" style="background:' + lg.color + '">' + lg.displayLabel + '</span></div>' +
    '<div class="x-hero-realm">' + realm.name + ' · ' + stage + ' ' + stageDots + (p.realm >= 5 ? ' 👑' : '') + '</div>' +
    '<div class="x-hero-kind">' + ch.kind + ' · 动作:' + ch.action + '</div>' +
    '<div class="x-hero-combat" style="cursor:pointer" data-click="xiuxianShowCombat" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">⚔ 战力 ' + cp + '</div></div></div>' +
    '<div class="x-stats">' +
    '<div class="x-stat"><span>灵气</span><b>' + p.spirit + ' / ' + cap + '</b></div>' +
    '<div class="x-stat"><span>灵石</span><b>💰 ' + p.stone + '</b></div>' +
    '<div class="x-stat"><span>极品灵石</span><b>💎 ' + p.premium + '</b></div>' +
    '<div class="x-stat"><span>战力</span><b style="cursor:pointer" data-click="xiuxianShowCombat" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">⚔ ' + cp + '</b></div>' +
    '<div class="x-stat"><span>兵器</span><b>' + escapeHtml(wName) + '</b></div>' +
    '<div class="x-stat"><span>服装</span><b>' + escapeHtml(oName) + '</b></div></div>' +
    '<div class="x-progress"><div class="x-progress-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + lg.color + ',#D4AF37)"></div></div>' +
    (btReady ? '<div class="x-bt-ready">⚠ 灵气已满，可突破大境界！</div>' : '') +
    '<div class="x-auto-cult" style="cursor:pointer" data-click="xiuxianToggleAutoCultivate" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">' +
    (autoCultOn ? '🧘 自动修炼中（点击关闭）' : '🪙 自动修炼已关闭，灵气自动转灵石（点击开启）') + '</div>' +
    '<div class="x-auto-cult" style="cursor:pointer" data-click="xiuxianToggleAutoStoneConvert" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">' +
    (autoConvertOn ? '🔄 每日灵石自动兑灵气中（点击关闭）' : '⏸ 每日灵石自动兑灵气已关闭（点击开启）') + '</div>' +
    rankMeHtml +
    '<div class="x-actions">' +
    '<button class="btn btn-sm" data-click="xiuxianCultivateInfo" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">📊 修炼详情</button>' +
    '<button class="btn btn-sm" data-click="xiuxianExchange" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">💱 灵石兑灵气</button>' +
    '<button class="btn btn-sm" data-click="xiuxianExchangePremium" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">💎 极品兑换</button>' +
    '<button class="btn btn-sm" data-click="xiuxianSwitchChar" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">🔁 ' + switchLabel + '</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">🎒 装备库</button>' +
    '<button class="btn ' + (btReady ? 'btn-primary' : '') + '" ' + (btReady ? 'data-click="xiuxianOpenBreakthrough" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '"' : 'disabled') + '>⚡ 突破大境界</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenMall" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">🛒 商城</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenRank" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(s.classId) + ''])) + '">🏆 班级榜</button></div>' +
    '<div class="x-tip">📌 初期/中期/后期自动突破（角色渐变）；大境界需手动突破（渡劫明显变化）。灵根按最新成绩自动划分。溢出灵气自动转灵石(3:1)。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}


// ===== ② 修仙任务系统 =====
const HW_STONE_RULES = { excellent: 5, normal: 3, resubmitted: 2, perfunctory: 1, incomplete: 0, pending: 0 };
const HW_STATUS_LABELS = { excellent: '优秀', normal: '正常', resubmitted: '补交', perfunctory: '敷衍', incomplete: '未交', pending: '待标记' };

function xiuxianTaskFilterClass(cls) { state.xiuxian._taskClass = cls; saveState(); renderPage(); }

function xiuxianSyncHwStones() {
  ensureXiuxian();
  let fc = state.xiuxian._taskClass || '';
  let hw = (state.homeworkRecords || []).filter(function(r){
    if (fc && r.classId !== fc) return false;
    if (r.status === 'pending') return false;
    return true;
  });
  let claimed = state.xiuxian.hwClaimed || {};
  let total = 0, cnt = 0, premiumGot = 0;
  const cfg = XIUXIAN_RULES.PREMIUM_STONE;
  const now = Date.now();
  hw.forEach(function(r){
    let key = r.studentId + '_' + r.taskId;
    if (claimed[key]) return;
    const stones = HW_STONE_RULES[r.status] || 0;
    if (stones > 0 && state.xiuxian.students[r.studentId]) {
      state.xiuxian.students[r.studentId].stone += stones;
      total += stones; cnt++;
      let p = state.xiuxian.students[r.studentId];
      const inWindow = (now - (p.lastPremiumTs || 0)) < cfg.pityWindowDays * 86400000;
      const pity = inWindow ? (p.pityCount || 0) : 0;
      const guaranteed = pity >= cfg.pityThreshold;
      const rate = guaranteed ? 1 : Math.min(1, cfg.dropBaseRate + pity * cfg.dropRateIncrement);
      if (Math.random() < rate || guaranteed) {
        p.premium += 1; p.pityCount = 0; p.lastPremiumTs = now; premiumGot++;
      } else {
        p.pityCount = pity + 1; p.lastPremiumTs = now;
      }
    }
    claimed[key] = true;
  });
  state.xiuxian.hwClaimed = claimed;
  state.xiuxian.meta.lastHwSyncTs = Date.now();
  saveState(); renderPage();
  if (cnt > 0) {
    let msg = '作业灵石同步：' + cnt + ' 人共 +' + total + ' 灵石';
    if (premiumGot > 0) msg += '，自动掉落 ' + premiumGot + ' 极品灵石 💎';
    showToast(msg, 'success');
  } else showToast('没有未领取的作业灵石', 'info');
}

let _xMultiSelect = {};
function xiuxianToggleMulti(sid) {
  if (_xMultiSelect[sid]) delete _xMultiSelect[sid];
  else _xMultiSelect[sid] = true;
  const cnt = Object.keys(_xMultiSelect).length;
  const bar = document.getElementById('xMultiBar');
  if (bar) bar.textContent = '已选 ' + cnt + ' 人';
}
function xiuxianSelectAllMulti() {
  let fc = state.xiuxian._taskClass || '';
  (state.students || []).forEach(function(s){ if (!fc || s.classId === fc) _xMultiSelect[s.id] = true; });
  renderPage();
}
function xiuxianClearMulti() { _xMultiSelect = {}; renderPage(); }

function xiuxianMultiAward(type) {
  ensureXiuxian();
  let typeEl = document.getElementById('xMultiType');
  let stoneEl = document.getElementById('xMultiStone');
  let descEl = document.getElementById('xMultiDesc');
  let stoneAmt = parseInt(stoneEl ? stoneEl.value : '3') || 0;
  if (stoneAmt <= 0) { showToast('灵石数量必须大于0', 'warn'); return; }
  let desc = descEl ? (descEl.value || '') : '';
  let taskType = type === 'other' ? '其它' : (typeEl ? typeEl.value : '背诵');
  const ids = Object.keys(_xMultiSelect);
  if (ids.length === 0) { showToast('请先勾选学生', 'warn'); return; }
  ids.forEach(function(sid){
    if (state.xiuxian.students[sid]) state.xiuxian.students[sid].stone += stoneAmt;
  });
  let fc = state.xiuxian._taskClass || '';
  let rec = { id: 'ct' + Date.now(), type: taskType, desc: desc || taskType, stone: stoneAmt, classId: fc, date: xiuxianTodayStr(), studentIds: ids, studentCount: ids.length };
  if (!state.xiuxian.customTasks) state.xiuxian.customTasks = [];
  state.xiuxian.customTasks.unshift(rec);
  if (state.xiuxian.customTasks.length > 100) state.xiuxian.customTasks = state.xiuxian.customTasks.slice(0, 100);
  _xMultiSelect = {};
  saveState(); renderPage();
  showToast(taskType + '灵石发放完成：' + ids.length + ' 人各 +' + stoneAmt + ' 灵石', 'success');
}

function xiuxianAwardOne() {
  ensureXiuxian();
  const sidEl = document.getElementById('xIndStudent');
  const stoneEl = document.getElementById('xIndStone');
  const descEl = document.getElementById('xIndDesc');
  const typeEl = document.getElementById('xIndType');
  const sid = sidEl ? sidEl.value : '';
  const stoneAmt = parseInt(stoneEl ? stoneEl.value : '3') || 0;
  if (!sid) { showToast('请选择学生', 'warn'); return; }
  if (stoneAmt <= 0) { showToast('灵石数量必须大于0', 'warn'); return; }
  const desc = descEl ? (descEl.value || '') : '';
  const taskType = typeEl ? typeEl.value : '背诵';
  let s = (state.students || []).find(function(x){ return x.id === sid; });
  if (!s) { showToast('未找到学生', 'warn'); return; }
  if (state.xiuxian.students[sid]) { state.xiuxian.students[sid].stone += stoneAmt; }
  const rec = { id: 'ct' + Date.now(), type: taskType, desc: desc || taskType, stone: stoneAmt, classId: s.classId || '', date: xiuxianTodayStr(), studentIds: [sid], studentCount: 1 };
  if (!state.xiuxian.customTasks) state.xiuxian.customTasks = [];
  state.xiuxian.customTasks.unshift(rec);
  if (state.xiuxian.customTasks.length > 100) state.xiuxian.customTasks = state.xiuxian.customTasks.slice(0, 100);
  saveState(); renderPage();
  showToast(escapeHtml(s.name) + ' 获得 ' + stoneAmt + ' 灵石（' + taskType + '）', 'success');
}

function renderXiuxianTasks(area) {
  ensureXiuxian();
  let cset = {}; (state.students || []).forEach(function(s){ if(s.classId) cset[s.classId]=1; });
  let classes = Object.keys(cset).sort();
  const fc = state.xiuxian._taskClass || '';
  let classOpts = '<option value="">全部班级</option>' + classes.map(function(c){return '<option value="'+escapeHtml(c)+'"'+(fc===c?' selected':'')+'>'+escapeHtml(c)+'</option>';}).join('');

  const hw = (state.homeworkRecords || []).filter(function(r){
    if (fc && r.classId !== fc) return false;
    return r.status !== 'pending';
  });
  const stats = { excellent:0, normal:0, resubmitted:0, perfunctory:0, incomplete:0 };
  let unclaimed = 0, totalStones = 0;
  const claimed = state.xiuxian.hwClaimed || {};
  hw.forEach(function(r){
    if (stats[r.status] !== undefined) stats[r.status]++;
    let key = r.studentId + '_' + r.taskId;
    if (!claimed[key]) { unclaimed++; totalStones += HW_STONE_RULES[r.status] || 0; }
  });

  const customs = state.xiuxian.customTasks || [];
  // 按学生汇总：每个学生不同任务类型所获灵石总数
  const byStudent = {};
  customs.forEach(function(t){
    (t.studentIds || []).forEach(function(sid){
      if (!byStudent[sid]) byStudent[sid] = { name:'', classId:'', types:{} };
      if (!byStudent[sid].types[t.type]) byStudent[sid].types[t.type] = 0;
      byStudent[sid].types[t.type] += t.stone;
    });
  });
  // 补充作业同步的灵石（从 hwClaimed 反推不可行，改为从 customTasks 中 type='作业同步' 汇总）
  const fc2 = fc;
  const students = (state.students || []).filter(function(s){ return !fc2 || s.classId === fc2; });
  const studentGrid = students.map(function(s){
    let p = xiuxianProfile(s.id); let lg = xiuxianLinggenObj(p.linggen); const realm = xiuxianRealmObj(p.realm);
    const checked = _xMultiSelect[s.id] ? ' checked' : '';
    let totalStones = 0;
    const types = byStudent[s.id] ? byStudent[s.id].types : {};
    for (const k in types) totalStones += types[k];
    return '<label class="x-multi-card' + (checked?' selected':'') + '">' +
      '<input type="checkbox" class="x-multi-chk" data-ev="change" data-ev-key="ev60" data-ev-args=' + escapeAttr(JSON.stringify([escapeHtml(s.id)])) + '"' + checked + '/>' +
      '<div class="x-multi-avatar">' + xiuxianAvatarSVG(xiuxianGetChar(p.characterId), p) + '</div>' +
      '<div class="x-multi-name">' + escapeHtml(s.name||'同学') + '</div>' +
      '<div class="x-multi-info">' + escapeHtml(s.classId||'') + ' · ' + lg.displayLabel + '</div>' +
      '<div class="x-multi-info">' + realm.name + ' · 战力' + xiuxianCombat(p) + '</div>' +
      '<div class="x-multi-stone">💰 ' + (p.stone||0) + ' · 累计+' + totalStones + '</div>' +
      '</label>';
  }).join('');

  // 汇总记录：按学生表格
  let summaryRows = '';
  const allTypes = {};
  customs.forEach(function(t){ allTypes[t.type] = 1; });
  const typeList = Object.keys(allTypes).sort();
  // 合并作业同步类型
  Object.keys(byStudent).forEach(function(sid){
    const s = (state.students||[]).find(function(x){ return x.id === sid; });
    if (s) { byStudent[sid].name = s.name||'同学'; byStudent[sid].classId = s.classId||''; }
  });
  const summaryList = Object.keys(byStudent).map(function(sid){ return { sid:sid, ...byStudent[sid] }; });
  summaryList.sort(function(a,b){
    let ta = 0, tb = 0;
    for (const k in a.types) ta += a.types[k];
    for (const k in b.types) tb += b.types[k];
    return tb - ta;
  });
  if (summaryList.length > 0) {
    const header = '<tr class="x-sum-head"><td>学生</td><td>班级</td>' + typeList.map(function(t){ return '<td>' + escapeHtml(t) + '</td>'; }).join('') + '<td>合计</td></tr>';
    let rows = summaryList.map(function(o){
      let total = 0;
      const cells = typeList.map(function(t){ const v = o.types[t]||0; total += v; return '<td>' + (v||'-') + '</td>'; }).join('');
      return '<tr class="x-sum-row"><td>' + escapeHtml(o.name||o.sid) + '</td><td>' + escapeHtml(o.classId||'') + '</td>' + cells + '<td class="x-sum-total">' + total + '</td></tr>';
    }).join('');
    summaryRows = '<table class="x-sum-table">' + header + rows + '</table>';
  }
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">修仙任务系统 · 作业/背诵/默写 → 灵石</span></div>' +
    xiuxianTabBar('tasks') +
    '<div class="x-filter-bar">' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev61">'+classOpts+'</select>' +
    '</div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">📚 作业灵石同步（12小时未操作自动领取）</div>' +
    '<div class="x-hw-stats">' +
      '<div class="x-hw-stat excellent">优秀 ✨<b>'+stats.excellent+'</b><small>5灵石/人</small></div>' +
      '<div class="x-hw-stat normal">正常 ✓<b>'+stats.normal+'</b><small>3灵石/人</small></div>' +
      '<div class="x-hw-stat resubmitted">补交 📝<b>'+stats.resubmitted+'</b><small>2灵石/人</small></div>' +
      '<div class="x-hw-stat perfunctory">敷衍 ⚠<b>'+stats.perfunctory+'</b><small>1灵石/人</small></div>' +
      '<div class="x-hw-stat incomplete">未交 ✗<b>'+stats.incomplete+'</b><small>0灵石</small></div>' +
    '</div>' +
    '<div class="x-hw-action">' +
      '<span class="x-hw-unclaimed">未领取：'+unclaimed+' 条 · 可领取 '+totalStones+' 灵石（同步时自动判定极品灵石掉落 · 12小时无操作自动同步）</span>' +
      '<button class="btn btn-primary" data-click="xiuxianSyncHwStones">💰 手动同步</button>' +
    '</div></div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">📖 多选发放灵石（勾选学生→选择类型→发放）</div>' +
    '<div class="x-multi-toolbar">' +
      '<span id="xMultiBar" class="x-multi-count">已选 0 人</span>' +
      '<button class="btn btn-sm" data-click="xiuxianSelectAllMulti">全选</button>' +
      '<button class="btn btn-sm" data-click="xiuxianClearMulti">清空</button>' +
    '</div>' +
    '<div class="x-multi-grid">' + (studentGrid || '<div class="x-tip">无学生</div>') + '</div>' +
    '<div class="x-quick-award" style="margin-top:8px">' +
      '<select class="x-filter-sel" id="xMultiType"><option value="背诵">背诵</option><option value="默写">默写</option><option value="抄写">抄写</option></select>' +
      '<input type="number" class="x-stone-input" id="xMultiStone" value="3" min="1" max="20" placeholder="灵石"/>' +
      '<input type="text" class="x-desc-input" id="xMultiDesc" placeholder="说明（可选）"/>' +
      '<button class="btn btn-primary" data-click="xiuxianMultiAward">💰 发放选中</button>' +
    '</div>' +
    '<div class="x-tip">勾选学生后选择类型和数量即可批量发放。作业灵石12小时无操作自动同步。</div>' +
    '</div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">✦ 其它任务（勾选学生后发放）</div>' +
    '<div class="x-quick-award">' +
      '<input type="text" class="x-desc-input" id="xOtherDesc" placeholder="任务说明..." style="flex:1"/>' +
      '<input type="number" class="x-stone-input" id="xOtherStone" value="5" min="1" max="100" placeholder="灵石"/>' +
      '<button class="btn btn-primary" data-click="xiuxianMultiAward" data-click-args="' + escapeAttr(JSON.stringify(['other'])) + '">💰 发放选中</button>' +
    '</div></div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">📜 灵石发放记录（按角色汇总）</div>' +
    '<div class="x-task-list">'+(summaryRows||'<div class="x-tip">暂无发放记录</div>')+'</div>' +
    '</div>' +

    '<div class="x-mist bot"></div>' +
    '</div>';
}

// ===== ③ 角色池 =====
let _xPoolCat = 'all', _xPoolDrawStudent = '';
function xiuxianPoolSetCat(cat) { _xPoolCat = cat; renderPage(); }
function xiuxianPoolSetDrawStudent(sid) { _xPoolDrawStudent = sid; renderPage(); }
function renderXiuxianPool(area) {
  ensureXiuxian();
  const cats = [{id:'all',label:'全部'},{id:'animal',label:'动物池'},{id:'plant',label:'植物池'},{id:'character',label:'动漫角色'},{id:'rare',label:'稀有角色'}];
  const pool = XIUXIAN_POOL.filter(function(c){ return _xPoolCat==='all' || c.pool===_xPoolCat; });
  const cards = pool.map(function(c){
    let p = xiuxianNewProfile(c.id, 1);
    const lg = xiuxianLinggenObj(p.linggen);
    const isRare = c.rarity === 'limited';
    return '<div class="x-pool-card'+(isRare?' rare':'')+'" title="'+escapeHtml(c.kind||'')+'">' +
      '<div class="x-pool-avatar">'+xiuxianAvatarSVG(c,p)+'</div>' +
      '<div class="x-pool-name">'+escapeHtml(c.name)+'</div>' +
      '<div class="x-pool-kind">'+escapeHtml(c.kind||c.pool)+'</div>' +
      (isRare ? '<div class="x-pool-quota">限'+c.quota+'·前'+c.rank_req+'名·💎'+c.jipin_price+'</div>' : '') +
      '</div>';
  }).join('');
  const drawStudentOpts = '<option value="">选择学生</option>' + (state.students||[]).map(function(s){return '<option value="'+escapeHtml(s.id)+'"'+(_xPoolDrawStudent===s.id?' selected':'')+'>'+escapeHtml(s.name||'同学')+' · '+escapeHtml(s.classId||'')+'</option>';}).join('');
  let limitedBtns = '';
  if (_xPoolDrawStudent) {
    const dp = xiuxianProfile(_xPoolDrawStudent);
    if (dp) {
      const dch = xiuxianGetChar(dp.characterId);
      limitedBtns = '<div class="x-draw-info">当前角色：'+escapeHtml(dch.name)+' · 💎 '+dp.premium+' 极品灵石</div>';
      limitedBtns += XIUXIAN_POOL.filter(function(c){ return c.rarity === 'limited'; }).map(function(c){
        return '<button class="x-limited-btn" data-click="xiuxianDrawLimited" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(_xPoolDrawStudent) + '','' + c.id + ''])) + '" title="' + escapeHtml(c.source || '') + '">' + c.emoji + ' ' + escapeHtml(c.name) + '<br><small>前' + c.rank_req + '名·💎' + c.jipin_price + '·限' + c.quota + '</small></button>';
      }).join('');
    }
  }
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">角色池 · 240 种灵宠立绘</span></div>' +
    xiuxianTabBar('pool') +
    '<div class="x-section">' +
    '<div class="x-section-title">✦ 限定角色抽取</div>' +
    '<div class="x-quick-award">' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev62" style="min-width:140px">'+drawStudentOpts+'</select>' +
    '</div>' +
    (_xPoolDrawStudent ? '<div class="x-limited-row">' + limitedBtns + '</div>' : '<div class="x-tip">选择学生后可抽取限定角色（需榜单门槛+极品灵石）</div>') +
    '</div>' +
    '<div class="x-pool-cats">' + cats.map(function(ct){
      return '<div class="x-pool-cat'+(_xPoolCat===ct.id?' active':'')+'" data-click="xiuxianPoolSetCat" data-click-args="' + escapeAttr(JSON.stringify([''+ct.id+''])) + '">'+ct.label+'</div>';
    }).join('') + '</div>' +
    '<div class="x-pool-grid">'+cards+'</div>' +
    '<div class="x-tip">共 '+pool.length+' 种角色。普通池(动物60+植物60+动漫60)初始随机分配；稀有池60种需榜单门槛+极品灵石抽取。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}

// ===== ⑤ 排行榜标签页 =====
let _xRankPageMode = 'combat', _xRankPageAnon = false, _xRankPageCls = '', _xRankPageLinggen = '', _xRankPageSelf = '', _xRankPageScope = 'grade';
function xiuxianRankPageSetMode(m) { _xRankPageMode = m; renderPage(); }
function xiuxianRankPageToggleAnon() { _xRankPageAnon = !_xRankPageAnon; renderPage(); }
function xiuxianRankPageSetClass(cls) { _xRankPageCls = cls; renderPage(); }
function xiuxianRankPageSetLinggen(lg) { _xRankPageLinggen = lg; renderPage(); }
function xiuxianRankPageSetSelf(sid) { _xRankPageSelf = sid; renderPage(); }
function xiuxianRankPageSetScope(scope) { _xRankPageScope = scope; if (scope === 'grade') _xRankPageCls = ''; renderPage(); }
function renderXiuxianRankPage(area) {
  ensureXiuxian();
  const cset = {}; (state.students || []).forEach(function(s){ if(s.classId) cset[s.classId]=1; });
  const classes = Object.keys(cset).sort();
  const scope = _xRankPageScope || 'grade';
  const cls = scope === 'class' ? (_xRankPageCls || classes[0] || '') : '';
  const lgf = _xRankPageLinggen || '';
  const selfId = _xRankPageSelf || '';
  const list = (state.students || []).filter(function(s){ return !cls || s.classId === cls; }).map(function(s){
    const p = state.xiuxian.students[s.id]; if (!p) return null;
    if (lgf && p.linggen !== lgf) return null;
    return { id:s.id, name:s.name, classId:s.classId, p:p };
  }).filter(Boolean);
  list.sort(function(a,b){
    if (_xRankPageMode === 'combat') return xiuxianCombat(b.p) - xiuxianCombat(a.p);
    if (_xRankPageMode === 'realm') return (b.p.realm||0) - (a.p.realm||0) || (b.p.spirit - a.p.spirit);
    return (b.p.premium||0) - (a.p.premium||0);
  });
  let selfRank = -1, selfName = '';
  list.forEach(function(o, i) { if (o.id === selfId) { selfRank = i + 1; selfName = o.name; } });
  const modeLabel = _xRankPageMode === 'combat' ? '战力' : _xRankPageMode === 'realm' ? '境界' : '极品灵石';
  const scopeLabel = scope === 'class' ? (cls + '班级榜') : '年级总榜';
  const valOf = function(p) {
    if (_xRankPageMode === 'combat') return xiuxianCombat(p);
    if (_xRankPageMode === 'realm') return xiuxianRealmObj(p.realm).name + ' · ' + (p.spirit||0) + '气';
    return p.premium || 0;
  };
  let rows = '<div class="x-rank-row head"><div class="x-rank-medal">#</div><div class="x-rank-avatar">头像</div><div class="x-rank-name">修士</div>' + (scope === 'grade' ? '<div class="x-rank-class">班级</div>' : '') + '<div class="x-rank-val">境界</div><div class="x-rank-val">'+modeLabel+'</div></div>';
  list.forEach(function(o, i) {
    const isSelf = o.id === selfId;
    const rankIdx = i + 1;
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : rankIdx;
    const nm = _xRankPageAnon ? ('匿名' + rankIdx) : escapeHtml(o.name || '同学');
    const val = valOf(o.p);
    const ch = xiuxianGetChar(o.p.characterId);
    const frameCls = rankIdx <= 10 ? ' x-rank-frame-' + rankIdx : '';
    const avatarHtml = '<div class="x-rank-avatar"><div class="x-rank-frame' + frameCls + '">' + xiuxianAvatarSVG(ch, o.p) + '</div></div>';
    rows += '<div class="x-rank-row' + (isSelf ? ' self' : '') + '" data-click="xiuxianSelectStudent" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(o.id) + ''])) + '" style="cursor:pointer">' +
      '<div class="x-rank-medal">' + medal + '</div>' + avatarHtml + '<div class="x-rank-name">' + nm + (isSelf ? ' (你)' : '') + '</div>' + (scope === 'grade' ? '<div class="x-rank-class">' + escapeHtml(o.classId || '') + '</div>' : '') + '<div class="x-rank-val">' + xiuxianRealmObj(o.p.realm).name + '</div><div class="x-rank-val">' + val + '</div></div>';
  });
  const classOpts = classes.map(function(c){return '<option value="'+escapeHtml(c)+'"'+(cls===c?' selected':'')+'>'+escapeHtml(c)+'</option>';}).join('');
  const lgOpts = '<option value="">全部灵根</option>' + XIUXIAN_RULES.LINGGEN_LEVELS.map(function(l){return '<option value="'+l.name+'"'+(lgf===l.name?' selected':'')+'>'+l.displayLabel+'</option>';}).join('');
  const selfOpts = '<option value="">选择查看自己排名</option>' + (state.students||[]).filter(function(s){return !cls||s.classId===cls;}).map(function(s){return '<option value="'+escapeHtml(s.id)+'"'+(selfId===s.id?' selected':'')+'>'+escapeHtml(s.name||'同学')+'</option>';}).join('');
  const selfBanner = selfRank > 0 ? '<div class="x-self-rank">🏆 ' + escapeHtml(selfName) + ' 在' + scopeLabel + modeLabel + '榜排名第 ' + selfRank + ' 名（共' + list.length + '人）</div>' : '';
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">修仙排行榜 · ' + scopeLabel + '</span></div>' +
    xiuxianTabBar('rank') +
    selfBanner +
    '<div class="x-filter-bar">' +
      '<span class="x-mall-cat ' + (scope === 'grade' ? 'on' : '') + '" data-click="xiuxianRankPageSetScope" data-click-args="' + escapeAttr(JSON.stringify(['grade'])) + '" style="cursor:pointer">年级总榜</span>' +
      '<span class="x-mall-cat ' + (scope === 'class' ? 'on' : '') + '" data-click="xiuxianRankPageSetScope" data-click-args="' + escapeAttr(JSON.stringify(['class'])) + '" style="cursor:pointer">班级榜单</span>' +
      (scope === 'class' ? '<select class="x-filter-sel" data-ev="change" data-ev-key="ev63">' + classOpts + '</select>' : '') +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev64">'+lgOpts+'</select>' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev65" style="min-width:140px">'+selfOpts+'</select>' +
      '<span class="x-mall-cat '+(_xRankPageMode==='combat'?'on':'')+'" data-click="xiuxianRankPageSetMode" data-click-args="' + escapeAttr(JSON.stringify(['combat'])) + '" style="cursor:pointer">战力榜</span>' +
      '<span class="x-mall-cat '+(_xRankPageMode==='realm'?'on':'')+'" data-click="xiuxianRankPageSetMode" data-click-args="' + escapeAttr(JSON.stringify(['realm'])) + '" style="cursor:pointer">境界榜</span>' +
      '<span class="x-mall-cat '+(_xRankPageMode==='premium'?'on':'')+'" data-click="xiuxianRankPageSetMode" data-click-args="' + escapeAttr(JSON.stringify(['premium'])) + '" style="cursor:pointer">极品灵石榜</span>' +
      '<span class="x-mall-cat '+(_xRankPageAnon?'on':'')+'" data-click="xiuxianRankPageToggleAnon" style="cursor:pointer">'+(_xRankPageAnon?'匿名：开':'匿名：关')+'</span>' +
    '</div>' +
    '<div class="x-rank-list">'+rows+'</div>' +
    '<div class="x-tip">切换年级总榜/班级榜单；三种榜单可按灵根筛选对比同级；选择学生可查看自己排名。点击修士可进入修炼主页。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}

// ===== CSS 扩展（标签页 + 任务系统 + 角色池） =====
if (!document.getElementById('xiuxian-style2')) {
  const _xs2 = document.createElement('style');
  _xs2.id = 'xiuxian-style2';
  _xs2.textContent = '\
.x-tabbar{display:flex;gap:0;border-bottom:2px solid #C19A6B;margin-bottom:12px;background:rgba(245,240,230,.5);border-radius:8px 8px 0 0;overflow:hidden}\
.x-tab{flex:1;padding:10px 8px;text-align:center;cursor:pointer;font-size:13px;color:#5D4E37;border-right:1px solid rgba(193,154,107,.3);transition:all .2s;font-family:KaiTi,STKaiti,serif}\
.x-tab:last-child{border-right:none}\
.x-tab:hover{background:rgba(212,175,55,.15)}\
.x-tab.active{background:linear-gradient(180deg,rgba(212,175,55,.25),rgba(212,175,55,.08));color:#9E3D2D;font-weight:bold;border-bottom:2px solid #D4AF37;margin-bottom:-2px}\
.x-filter-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:rgba(245,240,230,.6);border-radius:6px;margin-bottom:12px;border:1px solid rgba(193,154,107,.3)}\
.x-filter-sel{padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;color:#2C3E3F;font-size:13px;cursor:pointer}\
.x-filter-input{padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;color:#2C3E3F;font-size:13px;flex:1;min-width:120px}\
.x-filter-count{color:#8D6E63;font-size:12px;margin-left:auto;white-space:nowrap}\
.x-stu-class{font-size:11px;color:#8D6E63;text-align:center;margin:-2px 0 2px}\
.x-section{background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.35);border-radius:8px;padding:12px;margin-bottom:12px;box-shadow:0 1px 4px rgba(139,69,19,.06)}\
.x-section-title{font-size:15px;font-weight:bold;color:#9E3D2D;font-family:KaiTi,STKaiti,serif;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(193,154,107,.3)}\
.x-hw-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}\
.x-hw-stat{flex:1;min-width:80px;text-align:center;padding:8px 4px;border-radius:6px;background:rgba(255,255,255,.6);border:1px solid rgba(193,154,107,.2);font-size:12px;color:#5D4E37}\
.x-hw-stat b{display:block;font-size:20px;color:#2C3E3F;margin:2px 0}\
.x-hw-stat small{display:block;color:#8D6E63;font-size:10px}\
.x-hw-stat.excellent{border-color:rgba(255,193,7,.4)} .x-hw-stat.excellent b{color:#F57C00}\
.x-hw-stat.normal{border-color:rgba(66,165,245,.3)} .x-hw-stat.normal b{color:#1976D2}\
.x-hw-stat.resubmitted{border-color:rgba(171,71,188,.25)} .x-hw-stat.resubmitted b{color:#7B1FA2}\
.x-hw-stat.perfunctory{border-color:rgba(255,152,0,.3)} .x-hw-stat.perfunctory b{color:#E65100}\
.x-hw-stat.incomplete{border-color:rgba(229,57,53,.25)} .x-hw-stat.incomplete b{color:#C62828}\
.x-hw-action{display:flex;align-items:center;gap:12px;padding:8px 0 0;border-top:1px solid rgba(193,154,107,.2)}\
.x-hw-unclaimed{color:#5D4E37;font-size:13px;flex:1}\
.x-quick-award{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\
.x-stone-input{width:70px;padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;font-size:13px;text-align:center}\
.x-desc-input{flex:1;min-width:150px;padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;font-size:13px}\
.x-task-list{max-height:300px;overflow-y:auto}\
.x-task-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(193,154,107,.15);font-size:13px;color:#5D4E37}\
.x-task-item:hover{background:rgba(212,175,55,.08)}\
.x-task-type{display:inline-block;padding:2px 8px;border-radius:4px;background:#C3272B;color:#F5F0E6;font-size:11px;font-weight:bold;min-width:40px;text-align:center}\
.x-task-desc{flex:1;color:#2C3E3F}\
.x-task-stone{color:#D4AF37;font-weight:bold;white-space:nowrap}\
.x-task-meta{color:#8D6E63;font-size:11px;white-space:nowrap}\
.x-pool-cats{display:flex;gap:6px;margin-bottom:10px}\
.x-pool-cat{padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;color:#5D4E37;background:rgba(245,240,230,.6);border:1px solid rgba(193,154,107,.3);transition:all .2s}\
.x-pool-cat:hover{background:rgba(212,175,55,.15)}\
.x-pool-cat.active{background:linear-gradient(135deg,#C3272B,#9E3D2D);color:#F5F0E6;border-color:#D4AF37;font-weight:bold}\
.x-pool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}\
.x-pool-card{text-align:center;padding:6px;border-radius:6px;background:rgba(255,255,255,.5);border:1px solid rgba(193,154,107,.2);cursor:default;transition:all .2s}\
.x-pool-card:hover{transform:translateY(-2px);box-shadow:0 2px 8px rgba(139,69,19,.12);border-color:#D4AF37}\
.x-pool-card.rare{border-color:rgba(212,175,55,.5);background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(245,240,230,.6))}\
.x-pool-avatar{width:60px;height:60px;margin:0 auto}\
.x-pool-name{font-size:11px;color:#2C3E3F;font-weight:bold;margin-top:2px}\
.x-pool-kind{font-size:9px;color:#8D6E63}\
.x-pool-quota{font-size:9px;color:#C3272B;margin-top:2px;font-weight:bold}\
.x-rank-list{max-height:600px;overflow-y:auto}\
.x-rank-class{font-size:12px;color:#8D6E63;text-align:center;width:50px}\
.x-rank-row.head .x-rank-class{color:#5D4E37;font-weight:bold}\
.x-stu-stats{display:flex;justify-content:space-around;font-size:10px;color:#8D6E63;margin-top:2px;padding-top:2px;border-top:1px solid rgba(193,154,107,.15)}\
.x-stu-stats span{white-space:nowrap}\
.x-stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(193,154,107,.3);margin:0 2px}\
.x-stage-dot.on{background:#D4AF37;box-shadow:0 0 4px rgba(212,175,55,.6)}\
.x-bt-ready{background:linear-gradient(90deg,rgba(255,193,7,.2),rgba(255,87,34,.15));border:1px solid rgba(255,193,7,.4);border-radius:6px;padding:8px 12px;text-align:center;color:#E65100;font-weight:bold;font-size:13px;margin:8px 0;animation:xGoldPulse 2s ease-in-out infinite}\
.x-auto-cult{background:rgba(127,181,166,.12);border:1px solid rgba(127,181,166,.25);border-radius:6px;padding:6px 12px;text-align:center;color:#5D4E37;font-size:12px;margin:8px 0}\
.x-hero-combat{font-size:16px;color:#9E3D2D;font-weight:bold;margin-top:4px;cursor:pointer}\
.x-hero-combat:hover{color:#C3272B}\
/* 战力构成弹窗 */\
.x-combat-table{display:flex;flex-direction:column;gap:4px}\
.x-combat-row{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-radius:4px;background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.2);font-size:13px}\
.x-combat-row b{color:#2C3E3F;font-size:16px}\
.x-combat-row small{color:#8D6E63;font-size:11px;margin-left:4px}\
.x-combat-row.total{background:linear-gradient(90deg,rgba(212,175,55,.2),rgba(193,39,43,.1));border-color:#D4AF37;font-size:15px}\
.x-combat-row.total b{color:#9E3D2D;font-size:20px}\
/* 武器库弹窗 */\
.x-wp-current{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.3);border-radius:6px;margin-bottom:10px;font-size:13px}\
.x-wp-section{margin-bottom:12px}\
.x-wp-section-title{font-size:14px;font-weight:bold;color:#9E3D2D;margin-bottom:6px;font-family:KaiTi,STKaiti,serif}\
.x-wp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}\
.x-wp-card{padding:8px;border-radius:6px;background:rgba(255,255,255,.7);border:2px solid;text-align:center;font-size:12px}\
.x-wp-card.equipped{background:rgba(212,175,55,.12);box-shadow:0 0 6px rgba(212,175,55,.3)}\
.x-wp-name{font-weight:bold;font-size:14px;margin-bottom:2px}\
.x-wp-tier{color:#8D6E63;margin-bottom:2px}\
.x-wp-bonus{color:#9E3D2D;font-weight:bold;margin-bottom:4px}\
.x-wp-desc{color:#5D4E37;font-size:11px;margin-bottom:4px}\
.x-wp-cost{color:#8D6E63;margin-bottom:4px}\
.x-wp-equipped{display:inline-block;padding:2px 6px;background:rgba(212,175,55,.2);border-radius:3px;color:#9E3D2D;font-size:11px}\
/* 灵石兑换弹窗 */\
.x-exchange-info{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:13px}\
.x-exchange-info div{flex:1;text-align:center;padding:6px;background:rgba(245,240,230,.7);border-radius:4px}\
.x-exchange-info b{color:#9E3D2D;font-size:16px}\
.x-exchange-input{display:flex;align-items:center;gap:8px;margin-bottom:8px}\
.x-exchange-input label{font-size:13px;color:#5D4E37}\
.x-exchange-input input{flex:1;padding:6px 8px;border:1px solid #C19A6B;border-radius:4px;font-size:14px;width:60px}\
.x-exchange-input span{font-size:12px;color:#8D6E63}\
.x-exchange-quick{display:flex;gap:4px;margin-bottom:8px}\
.x-exchange-preview{text-align:center;font-size:14px;color:#2C3E3F;padding:6px;background:rgba(212,175,55,.1);border-radius:4px}\
.x-exchange-preview b{color:#9E3D2D;font-size:18px}\
.x-award-block{margin-bottom:8px;padding:8px;border-radius:6px;background:rgba(255,255,255,.4);border:1px solid rgba(193,154,107,.2)}\
.x-award-label{font-size:12px;color:#8D6E63;font-weight:bold;margin-bottom:4px}\
.x-multi-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:8px}\
.x-multi-count{font-size:13px;color:#9E3D2D;font-weight:bold;min-width:80px}\
.x-multi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;max-height:320px;overflow-y:auto;padding:4px}\
.x-multi-card{display:flex;flex-direction:column;align-items:center;padding:6px 4px;border-radius:6px;background:rgba(245,240,230,.6);border:1px solid rgba(193,154,107,.2);cursor:pointer;transition:all .15s;position:relative;text-align:center}\
.x-multi-card:hover{border-color:#D4AF37;background:rgba(212,175,55,.08)}\
.x-multi-card.selected{border-color:#C3272B;background:linear-gradient(135deg,rgba(195,39,43,.12),rgba(245,240,230,.6));box-shadow:0 0 6px rgba(195,39,43,.2)}\
.x-multi-card .x-multi-chk{position:absolute;top:4px;right:4px;width:14px;height:14px;cursor:pointer}\
.x-multi-avatar{width:40px;height:40px}\
.x-multi-name{font-size:11px;color:#2C3E3F;font-weight:bold;margin-top:2px}\
.x-multi-info{font-size:9px;color:#8D6E63;line-height:1.3}\
.x-multi-stone{font-size:10px;color:#D4AF37;font-weight:bold;margin-top:2px}\
.x-sum-table{width:100%;border-collapse:collapse;font-size:12px;color:#5D4E37}\
.x-sum-table td,.x-sum-table th{border:1px solid rgba(193,154,107,.2);padding:4px 6px;text-align:center}\
.x-sum-head{background:rgba(195,39,43,.08);font-weight:bold;color:#2C3E3F}\
.x-sum-row:hover{background:rgba(212,175,55,.08)}\
.x-sum-total{font-weight:bold;color:#D4AF37}\
.x-self-rank{background:linear-gradient(90deg,rgba(212,175,55,.2),rgba(195,39,43,.15));border:1px solid rgba(212,175,55,.4);border-radius:8px;padding:10px 16px;text-align:center;color:#9E3D2D;font-size:15px;font-weight:bold;margin-bottom:12px}\
.x-rank-row.self{background:linear-gradient(90deg,rgba(212,175,55,.18),rgba(255,255,255,.3));border-left:3px solid #D4AF37;font-weight:bold}\
.x-draw-info{padding:6px 12px;color:#5D4E37;font-size:13px;margin-bottom:6px;background:rgba(245,240,230,.6);border-radius:4px}\
.x-lg-frame-0{border:1px solid rgba(158,158,158,.3)!important}\
.x-lg-frame-1{border:1px solid rgba(141,110,99,.4)!important;box-shadow:0 0 4px rgba(141,110,99,.15)}\
.x-lg-frame-2{border:1px solid rgba(66,165,245,.4)!important;box-shadow:0 0 6px rgba(66,165,245,.2)}\
.x-lg-frame-3{border:1px solid rgba(171,71,188,.45)!important;box-shadow:0 0 8px rgba(171,71,188,.25)}\
.x-lg-frame-4{border:1px solid rgba(255,112,67,.5)!important;box-shadow:0 0 10px rgba(255,112,67,.3);position:relative}\
.x-lg-frame-4::before{content:"";position:absolute;inset:-1px;border-radius:inherit;background:linear-gradient(135deg,rgba(255,112,67,.15),transparent);pointer-events:none}\
.x-lg-frame-5{border:2px solid rgba(255,215,0,.55)!important;box-shadow:0 0 14px rgba(255,215,0,.35),inset 0 0 8px rgba(255,215,0,.1);position:relative}\
.x-lg-frame-5::before{content:"";position:absolute;inset:-2px;border-radius:inherit;background:conic-gradient(from 0deg,rgba(255,215,0,.2),rgba(255,112,67,.15),rgba(171,71,188,.12),rgba(255,215,0,.2));pointer-events:none;animation:xGoldPulse 3s ease-in-out infinite}\
/* 装备库标签页 */\
.x-wp-tabs{display:flex;gap:8px;margin-bottom:10px}\
.x-wp-tab{padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;color:#5D4E37;background:rgba(245,240,230,.6);border:1px solid rgba(193,154,107,.3);transition:all .2s}\
.x-wp-tab:hover{background:rgba(212,175,55,.15)}\
.x-wp-tab.on{background:linear-gradient(135deg,#C3272B,#9E3D2D);color:#F5F0E6;border-color:#D4AF37;font-weight:bold}\
/* 我的排名 */\
.x-rank-me{background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.35);border-radius:8px;padding:10px;margin:10px 0}\
.x-rank-me-title{font-size:14px;font-weight:bold;color:#9E3D2D;margin-bottom:6px;font-family:KaiTi,STKaiti,serif}\
.x-rank-me-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}\
.x-rank-me-grid div{display:flex;flex-direction:column;align-items:center;padding:6px;background:rgba(255,255,255,.5);border-radius:6px;font-size:12px}\
.x-rank-me-grid span{color:#8D6E63;margin-bottom:2px}\
.x-rank-me-grid b{color:#9E3D2D;font-size:13px}\
/* 排行榜形象框（前十越靠前越华丽） */\
.x-rank-avatar{width:44px;display:flex;justify-content:center;align-items:center;flex-shrink:0}\
.x-rank-frame{width:36px;height:36px;border-radius:50%;padding:3px;display:flex;align-items:center;justify-content:center;position:relative;background:#F5F0E6;box-sizing:border-box}\
.x-rank-frame svg{width:100%;height:100%;border-radius:50%;display:block}\
.x-rank-frame-1{border:3px solid #FFD700;box-shadow:0 0 16px rgba(255,215,0,.8),inset 0 0 8px rgba(255,215,0,.35)}\
.x-rank-frame-1::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,#FFD700,#FF8C00,#C3272B,#FFD700);z-index:-1;animation:xRankSpin 2.5s linear infinite;box-shadow:0 0 12px rgba(255,215,0,.6)}\
.x-rank-frame-2{border:3px solid #C0C0C0;box-shadow:0 0 14px rgba(192,192,192,.7),inset 0 0 6px rgba(192,192,192,.3)}\
.x-rank-frame-2::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,#C0C0C0,#E8E8E8,#A0A0A0,#C0C0C0);z-index:-1;animation:xRankSpin 3s linear infinite;box-shadow:0 0 10px rgba(192,192,192,.5)}\
.x-rank-frame-3{border:3px solid #CD7F32;box-shadow:0 0 12px rgba(205,127,50,.7),inset 0 0 6px rgba(205,127,50,.3)}\
.x-rank-frame-3::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,#CD7F32,#E6A15C,#8B4513,#CD7F32);z-index:-1;animation:xRankSpin 3.5s linear infinite;box-shadow:0 0 10px rgba(205,127,50,.5)}\
.x-rank-frame-4{border:2px solid #AB47BC;box-shadow:0 0 10px rgba(171,71,188,.55),inset 0 0 4px rgba(171,71,188,.2)}\
.x-rank-frame-5{border:2px solid #42A5F5;box-shadow:0 0 10px rgba(66,165,245,.55),inset 0 0 4px rgba(66,165,245,.2)}\
.x-rank-frame-6{border:2px solid #66BB6A;box-shadow:0 0 8px rgba(102,187,106,.5),inset 0 0 4px rgba(102,187,106,.15)}\
.x-rank-frame-7{border:2px solid #26C6DA;box-shadow:0 0 8px rgba(38,198,218,.5),inset 0 0 4px rgba(38,198,218,.15)}\
.x-rank-frame-8{border:2px solid #EC407A;box-shadow:0 0 8px rgba(236,64,122,.5),inset 0 0 4px rgba(236,64,122,.15)}\
.x-rank-frame-9{border:2px solid #FFA726;box-shadow:0 0 8px rgba(255,167,38,.5),inset 0 0 4px rgba(255,167,38,.15)}\
.x-rank-frame-10{border:2px solid #C19A6B;box-shadow:0 0 8px rgba(193,154,107,.45),inset 0 0 4px rgba(193,154,107,.15)}\
@keyframes xRankSpin{to{transform:rotate(360deg)}}\
/* 排行榜行布局固定（防头像加入后换行） */\
.x-rank-row{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(193,154,107,.15);min-height:54px;flex-wrap:nowrap}\
.x-rank-row.head{font-weight:bold;color:#5D4E37;background:rgba(245,240,230,.7);border-bottom:2px solid rgba(193,154,107,.3);min-height:auto;padding:10px 12px}\
.x-rank-row.head .x-rank-avatar{font-size:11px;color:#5D4E37;text-align:center}\
.x-rank-medal{width:32px;text-align:center;font-size:16px;flex-shrink:0}\
.x-rank-name{flex:1;min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.x-rank-val{width:64px;text-align:center;flex-shrink:0}\
';
  document.head.appendChild(_xs2);
}


// ===== 导出公共 API 到 window（供 HTML onclick 等调用） =====
// 注意：以下函数均通过函数声明定义，在 IIFE 内可直接引用
const _exportMap = {
  // 核心
  navigateTo: navigateTo, closeSidebar: closeSidebar, renderPage: renderPage,
  toggleNavParent: toggleNavParent,
  setUiMode: setUiMode, openModeSwitcher: openModeSwitcher,
  toggleNotch: toggleNotch, closeActiveAndRefresh: closeActiveAndRefresh,
  commitSave: commitSave, saveState: saveState,
  showToast: showToast, closeModal: closeModal, openModal: openModal,
  openPasswordModal: openPasswordModal,
  escapeHtml: escapeHtml, uid: uid, fmtDate: fmtDate, fmtTime: fmtTime,
  fmtDateTime: fmtDateTime,
  // 密码
  lockApp: lockApp, unlockFromOverlay: unlockFromOverlay,
  resetAutoLockTimer: resetAutoLockTimer,
  verifyPassword: verifyPassword, confirmSetPassword: confirmSetPassword,
  resetPassword: resetPassword, verifySecurityAnswer: verifySecurityAnswer,
  confirmResetPassword: confirmResetPassword,
  changeAppPassword: changeAppPassword,
  verifyBeforeChange: verifyBeforeChange,
  saveNewPassword: saveNewPassword,
  verifySpecialPwd: verifySpecialPwd,
  verifyTeacherReply: verifyTeacherReply, verifyTplPwd: verifyTplPwd,
  // 云同步 — S3
  openSyncModal: openSyncModal, updateSyncModal: updateSyncModal,
  manualCloudPush: manualCloudPush, manualCloudPull: manualCloudPull, cloudToggleGroup: cloudToggleGroup,
  cloudTestConnection: cloudTestConnection, saveCstcloudConfig: saveCstcloudConfig,
  showCloseConfirm: showCloseConfirm,
  // 任务
  openTaskModal: openTaskModal, saveTask: saveTask, deleteTask: deleteTask,
  toggleTaskComplete: toggleTaskComplete, switchTaskView: switchTaskView,
  changeMonth: changeMonth, goToday: goToday, openDayTasks: openDayTasks,
  onQuadrantDrop: onQuadrantDrop,
  // 教学计划
  downloadTemplate: downloadTemplate,
  downloadSampleTemplate: downloadSampleTemplate,
  handlePlanDrop: handlePlanDrop, handlePlanUpload: handlePlanUpload,
  viewPlan: viewPlan, deletePlan: deletePlan,
  openNewPlanModal: openNewPlanModal, openEditPlanModal: openEditPlanModal, savePlan: savePlan,
  // 课程表
  switchScheduleView: switchScheduleView,
  changeScheduleWeek: changeScheduleWeek, goToCurrentWeek: goToCurrentWeek,
  jumpToWeek: jumpToWeek, openAdjustmentModal: openAdjustmentModal,
  saveAdjustment: saveAdjustment, deleteAdjustment: deleteAdjustment,
  downloadScheduleTemplate: downloadScheduleTemplate,
  confirmScheduleImport: confirmScheduleImport,
  handleScheduleUpload: handleScheduleUpload,
  openScheduleCellModal: openScheduleCellModal,
  saveScheduleEntry: saveScheduleEntry,
  deleteScheduleEntry: deleteScheduleEntry,
  openScheduleSettings: openScheduleSettings,
  addPeriod: addPeriod, removePeriod: removePeriod,
  addDay: addDay, removeDay: removeDay,
  saveScheduleSettings: saveScheduleSettings,
  onPeriodTypeChange: onPeriodTypeChange,
  loadClassStudentsForEntry: loadClassStudentsForEntry,
  getCheckedEntryClasses: getCheckedEntryClasses,
  toggleAllEntryClasses: toggleAllEntryClasses,
  // 教学进度
  openProgressModal: openProgressModal, saveProgress: saveProgress,
  deleteProgress: deleteProgress, saveReflection: saveReflection,
  syncProgressFromSchedule: syncProgressFromSchedule,
  // 学生
  openStudentProfile: openStudentProfile,
  cycleUiMode: cycleUiMode,
  toggleSidebarCollapse: toggleSidebarCollapse, toggleTopBarMore: toggleTopBarMore,
  toggleNavParent: toggleNavParent,
  openModeSwitcher: openModeSwitcher,
  toggleNotch: toggleNotch, closeActiveAndRefresh: closeActiveAndRefresh,
  setUiMode: setUiMode,
  toggleStudentTag: toggleStudentTag,
  toggleStudentBatchMode: toggleStudentBatchMode,
  toggleShowArchivedTasks: toggleShowArchivedTasks,
  archiveStudentTask: archiveStudentTask,
  unarchiveStudentTask: unarchiveStudentTask,
  resolveTaskDelete: resolveTaskDelete,
  showScoreRangeStudents: showScoreRangeStudents,
  saveStudentProfile: saveStudentProfile,
  downloadStudentTemplate: downloadStudentTemplate,
  handleStudentUpload: handleStudentUpload,
  onClassFilterChange: onClassFilterChange,
  toggleStudentCard: toggleStudentCard, toggleAllStudentCards: toggleAllStudentCards,
  onStudentSearch: onStudentSearch,
  switchLayerMode: switchLayerMode,
  openClassRankTrend: openClassRankTrend,
  openGradeRankTrend: openGradeRankTrend,
  getClasses: getClasses,
  addClass: addClass, deleteClass: deleteClass,
  toggleTeachingClass: toggleTeachingClass,
  addStudent: addStudent, deleteStudent: deleteStudent,
  openStudentEditor: openStudentEditor, saveStudentEditor: saveStudentEditor,
  openClassManager: openClassManager,
  // 学生任务
  switchStudentTaskView: switchStudentTaskView,
  switchTaskClass: switchTaskClass,
  toggleTaskAnswer: toggleTaskAnswer,
  openTaskInfoEditModal: openTaskInfoEditModal,
  handleTaskImageUpload: handleTaskImageUpload,
  removeTaskImage: removeTaskImage, saveTaskInfo: saveTaskInfo,
  deleteStudentTask: deleteStudentTask,
  downloadTaskInfoTemplate: downloadTaskInfoTemplate,
  handleTaskInfoUpload: handleTaskInfoUpload,
  doRandomPick: doRandomPick,
  // 作业登记
  onHwTaskFilterChange: onHwTaskFilterChange,
  onHwClassFilterChange: onHwClassFilterChange,
  openHwStatusPicker: openHwStatusPicker,
  setHwStatus: setHwStatus, openHwReviewModal: openHwReviewModal,
  toggleHwSelection: toggleHwSelection,
  toggleSelectAllHw: toggleSelectAllHw, selectAllHw: selectAllHw,
  saveAllHomework: saveAllHomework,
  confirmSaveAllHomework: confirmSaveAllHomework,
  openBatchHwModal: openBatchHwModal,
  saveBatchHwStatus: saveBatchHwStatus,
  saveBatchReview: saveBatchReview, saveSingleHw: saveSingleHw,
  _debouncedRenderHomeworkTable: _debouncedRenderHomeworkTable,
  // 学情分析
  switchAnalysisView: switchAnalysisView,
  renderHwAnalysis: renderHwAnalysis,
  toggleHwAnalysisSort: toggleHwAnalysisSort,
  showHwAnalysisStudents: showHwAnalysisStudents,
  showClassHwStudents: showClassHwStudents,
  renderScoreAnalysis: renderScoreAnalysis,
  setScoreSort: setScoreSort,
  toggleAllDashboard: toggleAllDashboard,
  renderDashboard: renderDashboard,
  toggleDashboardAnomalySort: toggleDashboardAnomalySort,
  toggleDashboardKeySort: toggleDashboardKeySort,
  toggleKeyTypeFilter: toggleKeyTypeFilter,
  resetDashboardKeyFilter: resetDashboardKeyFilter,
  showIncompleteDetail: showIncompleteDetail,
  showHwAnomalyDetail: showHwAnomalyDetail,
  showKeyStudentDetail: showKeyStudentDetail,
  showHwStatusStudents: showHwStatusStudents,
  showProgressCategoryStudents: showProgressCategoryStudents,
  showLayerStudents: showLayerStudents,
  showHwAnomalyList: showHwAnomalyList,
  downloadScoreTemplate: downloadScoreTemplate,
  handleScoreUpload: handleScoreUpload,
  openScoreEntryModal: openScoreEntryModal,
  saveScoreEntry: saveScoreEntry, deleteScore: deleteScore,
  editScore: editScore, saveEditedScore: saveEditedScore,
  ensureHomeworkRecordsForStudent: ensureHomeworkRecordsForStudent,
  ensureAllHomeworkRecords: ensureAllHomeworkRecords,
  exportScoresCSV: exportScoresCSV,
  // 聊天
  switchChatClass: switchChatClass, sendChat: sendChat,
  sendChatTemplate: sendChatTemplate, sendChatSpecial: sendChatSpecial,
  sendTeacherReply: sendTeacherReply, teacherReply: teacherReply,
  toggleChatLock: toggleChatLock, toggleChatSidebar: toggleChatSidebar,
  // 提醒
  openReminderModal: openReminderModal, saveReminder: saveReminder,
  deleteReminder: deleteReminder, toggleReminder: toggleReminder,
  onReminderFreqChange: onReminderFreqChange,
  snoozeAlert: snoozeAlert,
  // 快速工具
  toggleAllAnswers: toggleAllAnswers,
  toggleMajorAnswer: toggleMajorAnswer,
  prevQuizDay: prevQuizDay, nextQuizDay: nextQuizDay,
  selectQuizOption: selectQuizOption, skillHint: skillHint,
  // 版本管理
  showBrowserVersionSettings: showBrowserVersionSettings,
  showDesktopVersionSettings: showDesktopVersionSettings,
  showMobileVersionSettings: showMobileVersionSettings,
  triggerPWAInstall: triggerPWAInstall,
  openDataFolder: openDataFolder,
  createDesktopShortcut: createDesktopShortcut,
  // 运行状态
  showRuntimeStatus: showRuntimeStatus,
  closeRuntimeStatusPanel: closeRuntimeStatusPanel,
  refreshRuntimeStatus: refreshRuntimeStatus,
  saveStoragePath: saveStoragePath,
  openDbFolder: openDbFolder,
  browseFolder: browseFolder,
  copyDbPath: copyDbPath,
  resetStoragePath: resetStoragePath,
  // 数据管理
  openDataManager: openDataManager,
  closeDataManager: closeDataManager,
  renderDataManager: renderDataManager,
  doExportData: doExportData,
  handleImportFile: handleImportFile,
  confirmImport: confirmImport,
  handleMergeFile: handleMergeFile,
  confirmMerge: confirmMerge,
  // 主题设置
  toggleThemePanel: toggleThemePanel,
  closeThemePanel: closeThemePanel,
  setThemeMode: setThemeMode,
  setAccentColor: setAccentColor,
  // Electron
  writeToElectronFile: writeToElectronFile,
  chooseElectronDataPath: chooseElectronDataPath,
  exportElectronSource: exportElectronSource,
  // 生物仙途模块
  renderXiuxian: renderXiuxian,
  xiuxianSelectClass: xiuxianSelectClass,
  xiuxianSelectStudent: xiuxianSelectStudent,
  xiuxianBackToClass: xiuxianBackToClass,
  xiuxianBackToSelect: xiuxianBackToSelect,
  xiuxianRefreshLinggen: xiuxianRefreshLinggen,
  xiuxianCultivateInfo: xiuxianCultivateInfo,
  xiuxianExchange: xiuxianExchange,
  xiuxianExchangeConfirm: xiuxianExchangeConfirm,
  xiuxianExchangePremium: xiuxianExchangePremium,
  xiuxianSwitchChar: xiuxianSwitchChar,
  xiuxianDrawLimited: xiuxianDrawLimited,
  xiuxianOpenBreakthrough: xiuxianOpenBreakthrough,
  xiuxianBreakthrough: xiuxianBreakthrough,
  xiuxianTaskReward: xiuxianTaskReward,
  xiuxianOpenMall: xiuxianOpenMall,
  xiuxianMallSetCat: xiuxianMallSetCat,
  xiuxianBuyMall: xiuxianBuyMall,
  xiuxianOpenRank: xiuxianOpenRank,
  xiuxianRankSetMode: xiuxianRankSetMode,
  xiuxianRankToggleAnon: xiuxianRankToggleAnon,
  xiuxianOpenTeam: xiuxianOpenTeam,
  xiuxianAppointLeader: xiuxianAppointLeader,
  xiuxianRemoveLeader: xiuxianRemoveLeader,
  xiuxianCloseModal: xiuxianCloseModal,
  // 战力 + 装备
  xiuxianShowCombat: xiuxianShowCombat,
  xiuxianOpenWeapon: xiuxianOpenWeapon,
  xiuxianEquipWeapon: xiuxianEquipWeapon,
  xiuxianUnequipWeapon: xiuxianUnequipWeapon,
  xiuxianBuyWeapon: xiuxianBuyWeapon,
  xiuxianGearSetTab: xiuxianGearSetTab,
  xiuxianEquipOutfit: xiuxianEquipOutfit,
  xiuxianUnequipOutfit: xiuxianUnequipOutfit,
  xiuxianBuyOutfit: xiuxianBuyOutfit,
  xiuxianToggleAutoCultivate: xiuxianToggleAutoCultivate,
  xiuxianToggleAutoStoneConvert: xiuxianToggleAutoStoneConvert,
  // 新标签页
  xiuxianSetTab: xiuxianSetTab,
  xiuxianArchiveFilter: xiuxianArchiveFilter,
  xiuxianTaskFilterClass: xiuxianTaskFilterClass,
  xiuxianSyncHwStones: xiuxianSyncHwStones,
  xiuxianMultiAward: xiuxianMultiAward,
  xiuxianAwardOne: xiuxianAwardOne,
  xiuxianToggleMulti: xiuxianToggleMulti,
  xiuxianSelectAllMulti: xiuxianSelectAllMulti,
  xiuxianClearMulti: xiuxianClearMulti,
  xiuxianPoolSetCat: xiuxianPoolSetCat,
  xiuxianPoolSetDrawStudent: xiuxianPoolSetDrawStudent,
  xiuxianRankPageSetMode: xiuxianRankPageSetMode,
  xiuxianRankPageToggleAnon: xiuxianRankPageToggleAnon,
  xiuxianRankPageSetClass: xiuxianRankPageSetClass,
  xiuxianRankPageSetLinggen: xiuxianRankPageSetLinggen,
  xiuxianRankPageSetSelf: xiuxianRankPageSetSelf,
  xiuxianRankPageSetScope: xiuxianRankPageSetScope,
  // 初始化
  initApp: initApp
};

// 只导出已存在的函数（防止引用未定义函数报错）
Object.keys(_exportMap).forEach(function(name) {
  if (_exportMap[name] !== undefined) window[name] = _exportMap[name];
});

// 暴露 state 供 onclick 使用（getter 模式，避免 state 重新赋值后引用失效）
Object.defineProperty(window, 'state', { get: function() { return state; }, configurable: true });

// IIFE 闭合移至文件末尾：使事件委托基础设施(__CLICK/__EV/__delegateClick 等)纳入 IIFE 作用域，直接共享内部函数，避免运行时 ReferenceError



// ── 事件委托（替代所有内联 onclick，满足严格 CSP script-src 'self'）──
function __noop() {}
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const __CLICK = {
  __dcAddClassRender: __dcAddClassRender,
  __dcClassRemove: __dcClassRemove,
  __dcClickEl: __dcClickEl,
  __dcCloseEditPlan: __dcCloseEditPlan,
  __dcCommitSaveClose: __dcCommitSaveClose,
  __dcConfirmSchedImport: __dcConfirmSchedImport,
  __dcDelClassRender: __dcDelClassRender,
  __dcDelStudentCloseRender: __dcDelStudentCloseRender,
  __dcDelStudentReload: __dcDelStudentReload,
  __dcDeleteProgressClose: __dcDeleteProgressClose,
  __dcDeleteTaskClose: __dcDeleteTaskClose,
  __dcOpenTaskFromClose: __dcOpenTaskFromClose,
  __dcPrint: __dcPrint,
  __dcRemoveParent: __dcRemoveParent,
  __dcSetHwStatusClose: __dcSetHwStatusClose,
  __dcSetXEx: __dcSetXEx,
  __dcSkillHint: __dcSkillHint,
  __dcStopDelAdj: __dcStopDelAdj,
  __dcStopDelProg: __dcStopDelProg,
  __dcStopDelStudentTask: __dcStopDelStudentTask,
  __dcStopOpenAdj: __dcStopOpenAdj,
  __dcStopOpenProg: __dcStopOpenProg,
  __dcStopOpenTaskInfo: __dcStopOpenTaskInfo,
  __dcSheetOk: __dcSheetOk,
  __dcSheetCancel: __dcSheetCancel,
  __dcSheetItem: __dcSheetItem,
  scrollToStudentInitial: scrollToStudentInitial,
  __dcToggleTeachRender: __dcToggleTeachRender,
  __noop: __noop,
  addDay: addDay,
  addPeriod: addPeriod,
  browseFolder: browseFolder,
  changeAppPassword: changeAppPassword,
  changeMonth: changeMonth,
  changeScheduleWeek: changeScheduleWeek,
  closeDataManager: closeDataManager,
  closeModal: closeModal,
  closeRuntimeStatusPanel: closeRuntimeStatusPanel,
  closeThemePanel: closeThemePanel,
  cloudTestConnection: cloudTestConnection,
  commitSave: commitSave,
  undoState: undoState,
  redoState: redoState,
  toggleUndoRedoMenu: toggleUndoRedoMenu,
  toggleMoreMenu: toggleMoreMenu,
  toggleTopBarScroll: toggleTopBarScroll,
  confirmImport: confirmImport,
  confirmMerge: confirmMerge,
  confirmResetPassword: confirmResetPassword,
  confirmSaveAllHomework: confirmSaveAllHomework,
  confirmSetPassword: confirmSetPassword,
  copyDbPath: copyDbPath,
  createDesktopShortcut: createDesktopShortcut,
  deletePlan: deletePlan,
  deleteReminder: deleteReminder,
  deleteScheduleEntry: deleteScheduleEntry,
  deleteScore: deleteScore,
  deleteTask: deleteTask,
  doExportData: doExportData,
  doRandomPick: doRandomPick,
  downloadSampleTemplate: downloadSampleTemplate,
  downloadScheduleTemplate: downloadScheduleTemplate,
  downloadScoreTemplate: downloadScoreTemplate,
  downloadStudentTemplate: downloadStudentTemplate,
  downloadTaskInfoTemplate: downloadTaskInfoTemplate,
  downloadTemplate: downloadTemplate,
  editScore: editScore,
  exportScoresCSV: exportScoresCSV,
  goToCurrentWeek: goToCurrentWeek,
  goToday: goToday,
  loadClassStudentsForEntry: loadClassStudentsForEntry,
  onClassFilterChange: onClassFilterChange,
  lockApp: lockApp,
  manualCloudPull: manualCloudPull, cloudToggleGroup: cloudToggleGroup,
  manualCloudPush: manualCloudPush,
  nextQuizDay: nextQuizDay,
  openAdjustmentModal: openAdjustmentModal,
  openBatchHwModal: openBatchHwModal,
  openClassManager: openClassManager,
  openClassRankTrend: openClassRankTrend,
  openDataFolder: openDataFolder,
  openDataManager: openDataManager,
  openDayTasks: openDayTasks,
  openDbFolder: openDbFolder,
  openEditPlanModal: openEditPlanModal,
  openGradeRankTrend: openGradeRankTrend,
  openHwReviewModal: openHwReviewModal,
  openHwStatusPicker: openHwStatusPicker,
  openNewPlanModal: openNewPlanModal,
  openPasswordModal: openPasswordModal,
  openProgressModal: openProgressModal,
  openReminderModal: openReminderModal,
  openScheduleCellModal: openScheduleCellModal,
  openScheduleSettings: openScheduleSettings,
  openScoreEntryModal: openScoreEntryModal,
  openStudentEditor: openStudentEditor,
  openStudentProfile: openStudentProfile,
  cycleUiMode: cycleUiMode,
  setUiMode: setUiMode,
  toggleSidebarCollapse: toggleSidebarCollapse, toggleTopBarMore: toggleTopBarMore,
  toggleNavParent: toggleNavParent,
  openModeSwitcher: openModeSwitcher,
  toggleNotch: toggleNotch, closeActiveAndRefresh: closeActiveAndRefresh,
  toggleStudentCard: toggleStudentCard, toggleAllStudentCards: toggleAllStudentCards,
  openSyncModal: openSyncModal,
  openMobileOverflow: openMobileOverflow,
  closeMobileOverflow: closeMobileOverflow,
  __dcOverflow: __dcOverflow,
  onMobileFab: onMobileFab,
  openTaskInfoEditModal: openTaskInfoEditModal,
  openTaskModal: openTaskModal,
  prevQuizDay: prevQuizDay,
  refreshRuntimeStatus: refreshRuntimeStatus,
  removeDay: removeDay,
  removePeriod: removePeriod,
  removeTaskImage: removeTaskImage,
  renderDataManager: renderDataManager,
  resetDashboardKeyFilter: resetDashboardKeyFilter,
  resetPassword: resetPassword,
  resetStoragePath: resetStoragePath,
  saveAdjustment: saveAdjustment,
  saveAllHomework: saveAllHomework,
  saveBatchHwStatus: saveBatchHwStatus,
  saveBatchReview: saveBatchReview,
  saveCstcloudConfig: saveCstcloudConfig,
  saveEditedScore: saveEditedScore,
  saveNewPassword: saveNewPassword,
  savePlan: savePlan,
  saveProgress: saveProgress,
  saveReflection: saveReflection,
  saveReminder: saveReminder,
  saveScheduleEntry: saveScheduleEntry,
  saveScheduleSettings: saveScheduleSettings,
  saveScoreEntry: saveScoreEntry,
  saveSingleHw: saveSingleHw,
  saveStoragePath: saveStoragePath,
  saveStudentEditor: saveStudentEditor,
  saveStudentProfile: saveStudentProfile,
  saveTask: saveTask,
  saveTaskInfo: saveTaskInfo,
  selectAllHw: selectAllHw,
  selectQuizOption: selectQuizOption,
  sendChat: sendChat,
  sendChatSpecial: sendChatSpecial,
  sendChatTemplate: sendChatTemplate,
  sendTeacherReply: sendTeacherReply,
  setAccentColor: setAccentColor,
  setScoreSort: setScoreSort,
  setThemeMode: setThemeMode,
  showClassHwStudents: showClassHwStudents,
  showHwAnalysisStudents: showHwAnalysisStudents,
  showHwAnomalyDetail: showHwAnomalyDetail,
  showKeyStudentDetail: showKeyStudentDetail,
  showHwStatusStudents: showHwStatusStudents,
  showProgressCategoryStudents: showProgressCategoryStudents,
  showLayerStudents: showLayerStudents,
  showHwAnomalyList: showHwAnomalyList,
  showRuntimeStatus: showRuntimeStatus,
  snoozeAlert: snoozeAlert,
  switchAnalysisView: switchAnalysisView,
  switchChatClass: switchChatClass, toggleChatSidebar: toggleChatSidebar,
  switchLayerMode: switchLayerMode,
  switchScheduleView: switchScheduleView,
  switchStudentTaskView: switchStudentTaskView,
  switchTaskClass: switchTaskClass,
  switchTaskView: switchTaskView,
  syncProgressFromSchedule: syncProgressFromSchedule,
  teacherReply: teacherReply,
  toggleAllAnswers: toggleAllAnswers,
  toggleAllDashboard: toggleAllDashboard,
  toggleAllEntryClasses: toggleAllEntryClasses,
  toggleChatLock: toggleChatLock,
  toggleDashboardAnomalySort: toggleDashboardAnomalySort,
  toggleDashboardKeySort: toggleDashboardKeySort,
  toggleHwAnalysisSort: toggleHwAnalysisSort,
  toggleMajorAnswer: toggleMajorAnswer,
  toggleReminder: toggleReminder,
  toggleStudentTag: toggleStudentTag,
  toggleStudentBatchMode: toggleStudentBatchMode,
  toggleShowArchivedTasks: toggleShowArchivedTasks,
  archiveStudentTask: archiveStudentTask,
  unarchiveStudentTask: unarchiveStudentTask,
  resolveTaskDelete: resolveTaskDelete,
  showScoreRangeStudents: showScoreRangeStudents,
  toggleTaskAnswer: toggleTaskAnswer,
  toggleThemePanel: toggleThemePanel,
  triggerPWAInstall: triggerPWAInstall,
  unlockFromOverlay: unlockFromOverlay,
  verifyBeforeChange: verifyBeforeChange,
  verifyChatUnlock: verifyChatUnlock,
  verifyPassword: verifyPassword,
  verifySecurityAnswer: verifySecurityAnswer,
  verifySpecialPwd: verifySpecialPwd,
  verifyTeacherReply: verifyTeacherReply,
  verifyTplPwd: verifyTplPwd,
  viewPlan: viewPlan,
  xiuxianAppointLeader: xiuxianAppointLeader,
  xiuxianAwardOne: xiuxianAwardOne,
  xiuxianBackToSelect: xiuxianBackToSelect,
  xiuxianBreakthrough: xiuxianBreakthrough,
  xiuxianBuyMall: xiuxianBuyMall,
  xiuxianBuyOutfit: xiuxianBuyOutfit,
  xiuxianBuyWeapon: xiuxianBuyWeapon,
  xiuxianClearMulti: xiuxianClearMulti,
  xiuxianCloseModal: xiuxianCloseModal,
  xiuxianCultivateInfo: xiuxianCultivateInfo,
  xiuxianDrawLimited: xiuxianDrawLimited,
  xiuxianEquipOutfit: xiuxianEquipOutfit,
  xiuxianEquipWeapon: xiuxianEquipWeapon,
  xiuxianExchange: xiuxianExchange,
  xiuxianExchangeConfirm: xiuxianExchangeConfirm,
  xiuxianExchangePremium: xiuxianExchangePremium,
  xiuxianGearSetTab: xiuxianGearSetTab,
  xiuxianMallSetCat: xiuxianMallSetCat,
  xiuxianMultiAward: xiuxianMultiAward,
  xiuxianOpenBreakthrough: xiuxianOpenBreakthrough,
  xiuxianOpenMall: xiuxianOpenMall,
  xiuxianOpenRank: xiuxianOpenRank,
  xiuxianOpenTeam: xiuxianOpenTeam,
  xiuxianOpenWeapon: xiuxianOpenWeapon,
  xiuxianPoolSetCat: xiuxianPoolSetCat,
  xiuxianRankPageSetMode: xiuxianRankPageSetMode,
  xiuxianRankPageSetScope: xiuxianRankPageSetScope,
  xiuxianRankPageToggleAnon: xiuxianRankPageToggleAnon,
  xiuxianRankSetMode: xiuxianRankSetMode,
  xiuxianRankToggleAnon: xiuxianRankToggleAnon,
  xiuxianRemoveLeader: xiuxianRemoveLeader,
  xiuxianSelectAllMulti: xiuxianSelectAllMulti,
  xiuxianSelectStudent: xiuxianSelectStudent,
  xiuxianSetTab: xiuxianSetTab,
  xiuxianShowCombat: xiuxianShowCombat,
  xiuxianSwitchChar: xiuxianSwitchChar,
  xiuxianSyncHwStones: xiuxianSyncHwStones,
  xiuxianToggleAutoCultivate: xiuxianToggleAutoCultivate,
  xiuxianToggleAutoStoneConvert: xiuxianToggleAutoStoneConvert,
  xiuxianUnequipOutfit: xiuxianUnequipOutfit,
  xiuxianUnequipWeapon: xiuxianUnequipWeapon,
  xiuxianWeeklyRoutine: xiuxianWeeklyRoutine,
  __dcMbnTab: __dcMbnTab,
  closeMobileSubnav: closeMobileSubnav,
  __dcMbnItem: __dcMbnItem,
  __dcMbnToggleGroup: __dcMbnToggleGroup,
  __dcSwitchSyncTab: __dcSwitchSyncTab,
  toggleSyncSection: toggleSyncSection
};
function __dcMbnTab(args, e, el) {
  const gid = args && args[0]; if (!gid) return;
  renderMobileSubnav(gid);
}
function __dcMbnItem(args, e, el) {
  closeMobileSubnav();
  // If it's a page, navigate; if it's an action, handle
  const page = args && args[0], action = args && args[1];
  if (action === 'syncQuick') { openSyncModal(); return; }
  if (action === 'showRuntimeStatus') { showRuntimeStatus(); return; }
  if (action === 'openDataManager') { openDataManager(); return; }
  if (action === 'openModeSwitcher') { openModeSwitcher(); return; }
  if (action === 'toggleNotch') { toggleNotch(); return; }
  if (page) navigateTo(page);
}
function __dcMbnToggleGroup(args, e, el) {
  let gkey = args && args[0]; if (!gkey) return;
  // 统一用 window 上的对象，确保和 renderMobileSubnav 读写一致
  let collapsed = window._mobileGroupCollapsed || (window._mobileGroupCollapsed = {});
  collapsed[gkey] = !collapsed[gkey];
  renderMobileSubnav(window._mobileCurrentTab || 'center');
}
function __dcSwitchSyncTab(args, e, el) {
  const tab = args && args[0]; if (!tab || (tab !== 'up' && tab !== 'dl')) return;
  window._cloudSyncMobileTab = tab;
  updateSyncModal();
}
function toggleSyncSection(key, e, el) {
  // 仅作用于桌面端（手机 tab 模式下没有 .sync-section），由 __delegateClick 经 apply 展开传入单值 'up' | 'dl'
  if (key !== 'up' && key !== 'dl') return;
  const storageKey = key === 'up' ? 'cloudSyncUploadCollapsed' : 'cloudSyncDownloadCollapsed';
  let collapsed = localStorage.getItem(storageKey) === '1';
  collapsed = !collapsed;
  localStorage.setItem(storageKey, collapsed ? '1' : '0');
  let body = document.querySelector('[data-sync-body="' + key + '"]');
  let arrow = document.querySelector('[data-sync-arrow="' + key + '"]');
  if (body) body.style.display = collapsed ? 'none' : '';
  if (arrow) arrow.textContent = collapsed ? '\u25B6' : '\u25BC';
  if (el) el.setAttribute('aria-expanded', String(!collapsed));
  else if (arrow && arrow.parentElement) arrow.parentElement.setAttribute('aria-expanded', String(!collapsed));
  if (window.showToast) showToast(collapsed ? (key === 'up' ? '自动上传栏目已收起' : '自动下载栏目已收起') : (key === 'up' ? '自动上传栏目已展开' : '自动下载栏目已展开'));
}
function closeMobileSubnav() {
  let overlay = document.getElementById('mobileSubnavOverlay');
  let panel = document.getElementById('mobileSubnavPanel');
  if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); }
  if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden','true'); }
  window._mobileCurrentTab = null;
}
function renderMobileSubnav(gid) {
  const sec = MOBILE_SECTIONS[gid]; if (!sec) return;
  window._mobileCurrentTab = gid;
  // Update active tab
  document.querySelectorAll('.mbn-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-mbn') === gid);
  });
  // Set title
  const titleEl = document.getElementById('mobileSubnavTitle');
  if (titleEl) titleEl.textContent = sec.title;
  // Build list
  const listEl = document.getElementById('mobileSubnavList');
  if (!listEl) return;
  let html = '';
  function itemHtml(it) {
    const icon = it.icon || '', label = it.label || '';
    let args = escapeAttr(JSON.stringify([it.page || '', it.action || '']));
    return '<div class="mobile-subnav-item" data-click="__dcMbnItem" data-click-args="' + args + '">' +
      '<span class="nav-icon">' + escapeHtml(icon) + '</span>' +
      '<span class="nav-label">' + escapeHtml(label) + '</span>' +
      '<span class="nav-arrow">⟩</span></div>';
  }
  function groupHtml(g, gidx) {
    const gkey = gid + '-' + gidx;
    const collapsedMap = window._mobileGroupCollapsed || (window._mobileGroupCollapsed = {});
    let collapsed = collapsedMap[gkey];
    // default: if collapsible and defaultOpen=false, collapsed if not explicitly set
    if (collapsed === undefined) collapsed = g.collapsible && !g.defaultOpen;
    const arrow = collapsed ? '▶' : '▼';
    const toggleArgs = escapeAttr(JSON.stringify([gkey]));
    let h = '';
    if (g.label) {
      h += '<div class="mobile-subnav-group-header" data-click="__dcMbnToggleGroup" data-click-args="' + toggleArgs + '">' +
        '<span class="group-label">' + escapeHtml(g.label) + '</span>' +
        '<span class="group-count">(' + g.items.length + ')</span>' +
        '<span class="group-arrow">' + arrow + '</span></div>';
    }
    if (!collapsed) {
      h += '<div class="mobile-subnav-group-items">';
      for (let j = 0; j < g.items.length; j++) { h += itemHtml(g.items[j]); }
      h += '</div>';
    }
    return h;
  }
  if (sec.groups) {
    for (let i = 0; i < sec.groups.length; i++) { html += groupHtml(sec.groups[i], i); }
  } else if (sec.items) {
    for (let k = 0; k < sec.items.length; k++) { html += itemHtml(sec.items[k]); }
  }
  listEl.innerHTML = html;
  // Show panel
  const overlay = document.getElementById('mobileSubnavOverlay');
  const panel = document.getElementById('mobileSubnavPanel');
  if (overlay) { overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); }
  if (panel) { panel.classList.add('open'); panel.setAttribute('aria-hidden','false'); }
}
// ── 长按 tooltip：顶栏按钮在手机上长按显示完整名称 ──
(function() {
  let timer = null, tip = null;
  function showTip(x, y, text) {
    if (!text) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'mobile-tooltip'; document.body.appendChild(tip); }
    tip.textContent = text;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.style.display = 'block';
  }
  function hideTip() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (tip) tip.style.display = 'none';
  }
  document.addEventListener('touchstart', function(e) {
    let el = e.target.closest && e.target.closest('.save-btn,.sync-indicator,.status-btn,.theme-btn');
    if (!el) return;
    const title = el.getAttribute('title') || el.getAttribute('data-title') || '';
    if (!title) return;
    const touch = e.touches[0];
    timer = setTimeout(function() {
      showTip(touch.pageX, touch.pageY - 30, title);
    }, 500);
  }, {passive: true});
  document.addEventListener('touchend', hideTip);
  document.addEventListener('touchcancel', hideTip);
  document.addEventListener('touchmove', function(e) {
    if (timer) { clearTimeout(timer); timer = null; }
  }, {passive: true});
})();
function __dcOpenTaskFromClose(args, e, el) { closeModal(); openTaskModal(args[0]); }
async function __dcDeleteTaskClose(args, e, el) { await deleteTask(args[0]); closeModal(); }
function __dcCloseEditPlan(args, e, el) { closeModal(); openEditPlanModal(args[0]); }
function __dcStopOpenAdj(args, e, el) { if(e&&e.stopPropagation)e.stopPropagation(); openAdjustmentModal(args[0]); }
async function __dcStopDelAdj(args, e, el) { if(e&&e.stopPropagation)e.stopPropagation(); await deleteAdjustment(args[0]); }
function __dcStopOpenProg(args, e, el) { if(e&&e.stopPropagation)e.stopPropagation(); openProgressModal(args[0]); }
async function __dcStopDelProg(args, e, el) { if(e&&e.stopPropagation)e.stopPropagation(); await deleteProgress(args[0]); }
async function __dcDeleteProgressClose(args, e, el) { await deleteProgress(args[0]); closeModal(); }
function __dcToggleTeachRender(args, e, el) { if(toggleTeachingClass(args[0])){ renderClassManagerList(); renderPage(); } }
function __dcDelClassRender(args, e, el) { if(deleteClass(args[0])){ renderClassManagerList(); renderPage(); } }
function __dcAddClassRender(args, e, el) { if(addClass(document.getElementById('newClassName').value, document.getElementById('newClassIsTeaching').checked)){ document.getElementById('newClassName').value=''; renderClassManagerList(); renderPage(); } }
async function __dcDelStudentCloseRender(args, e, el) { if(await deleteStudent(args[0])){ closeModal(); renderPage(); } }
function __dcStopOpenTaskInfo(args, e, el) { if(e&&e.stopPropagation)e.stopPropagation(); openTaskInfoEditModal(args[0]); }
async function __dcStopDelStudentTask(args, e, el) { if(e&&e.stopPropagation)e.stopPropagation(); await deleteStudentTask(args[0]); }
function __dcSetHwStatusClose(args, e, el) { setHwStatus(args[0], args[1]); closeModal(); }
async function __dcDelStudentReload(args, e, el) { if(await deleteStudent(args[0])){ loadClassStudentsForEntry(); } }
function __dcSkillHint(args, e, el) { skillHint(); if(e&&e.preventDefault)e.preventDefault(); }
function __dcCommitSaveClose(args, e, el) { commitSave(); closeModal(); }
function __dcClickEl(args, e, el) { const target=document.getElementById(args[0]); if(target) target.click(); }
function __dcPrint(args, e, el) { window.print(); }
function __dcRemoveParent(args, e, el) { const tgt = el || (e && e.target); if(tgt && tgt.parentElement) tgt.parentElement.remove(); }
function __dcConfirmSchedImport(args, e, el) { window._pendingScheduleData = args[0]; confirmScheduleImport(); }
function __dcClassRemove(args, e, el) { const target=document.getElementById(args[0]); if(target) target.classList.remove(args[1]); }
function __dcSetXEx(args, e, el) { const target=document.getElementById('xExAmount'); if(target) target.value=args[0]; }

/* ===================== 底部动作面板（微信/QQ 风格） =====================
   替代原生 confirm()：移动端用底部动作面板（action sheet），桌面端保持原生 confirm；
   同时解决移动 WebView 中原生 confirm 可能不弹窗/被禁用，导致删除等功能在手机上失效的问题。 */
let __confirmResolver = null;   // appConfirm 的 Promise resolve
let __sheetResolver = null;     // appActionSheet 的 Promise resolve

function __getSheetRoot() {
  let root = document.getElementById('actionSheetRoot');
  if (!root) { root = document.createElement('div'); root.id = 'actionSheetRoot'; document.body.appendChild(root); }
  return root;
}
function __closeSheet() {
  let r = document.getElementById('actionSheetRoot');
  if (r) { r.innerHTML = ''; r.classList.remove('show'); r.__sheetItems = null; r.__sheetResolve = null; }
  __confirmResolver = null; __sheetResolver = null;
}

/* 确认弹窗：message 文本；opts={danger,confirmText,cancelText} */
function appConfirm(message, opts) {
  opts = opts || {};
  // Tauri 桌面环境：dialog plugin 内部统一用 plugin:dialog|message
  // 关键坑：直接调 __invoke 绕过了 JS 包装层，必须用 Rust 端格式
  //   - buttons 用字符串 'OkCancel'（Rust enum unit variant），不用 JS 层的 {ok, cancel}
  //   - 返回值是 MessageDialogResult 枚举字符串 'Ok'/'Cancel'，不是 boolean
  //   - message 命令参数是平铺的（title, message, kind, buttons），不像 save/open 要包在 options 里
  if (isTauriApp()) {
    return __invoke('plugin:dialog|message', {
      message: message,
      title: '请确认',
      kind: opts.danger ? 'warning' : 'info',
      buttons: 'OkCancel'
    }).then(function(clicked) {
      return clicked === 'Ok';
    }).catch(function(e) {
      console.error('confirm dialog failed:', e);
      return false;
    });
  }
  // 移动 UI：用自定义 ActionSheet
  if (isMobileUI()) {
    return new Promise(function(resolve) {
      __confirmResolver = resolve;
      const danger = opts.danger ? ' danger' : '';
      const ok = opts.confirmText || '确定';
      const cancel = opts.cancelText || '取消';
      let root = __getSheetRoot();
      root.innerHTML =
        '<div class="sheet-overlay" data-click="__dcSheetCancel"></div>' +
        '<div class="action-sheet" role="alertdialog" aria-modal="true">' +
          '<div class="action-sheet-msg">' + escapeHtml(message).replace(/\n/g, '<br>') + '</div>' +
          '<button class="action-sheet-btn' + danger + '" data-click="__dcSheetOk">' + escapeHtml(ok) + '</button>' +
          '<button class="action-sheet-btn cancel" data-click="__dcSheetCancel">' + escapeHtml(cancel) + '</button>' +
        '</div>';
      requestAnimationFrame(function(){ root.classList.add('show'); });
    });
  }
  // 浏览器环境：降级到原生 confirm
  return Promise.resolve(window.confirm(message));
}

/* 动作面板：items=[{label,danger,onClick}]；opts={title,cancelText} */
function appActionSheet(items, opts) {
  opts = opts || {};
  if (!isMobileUI()) return Promise.resolve(null);   // 桌面以按钮为主，不弹面板
  return new Promise(function(resolve) {
    let root = __getSheetRoot();
    let html = opts.title ? '<div class="action-sheet-title">' + escapeHtml(opts.title) + '</div>' : '';
    html += '<div class="action-sheet-list">';
    items.forEach(function(it, i) {
      html += '<button class="action-sheet-btn' + (it.danger ? ' danger' : '') + '" data-click="__dcSheetItem" data-click-args="' + escapeAttr(JSON.stringify([i])) + '">' + escapeHtml(it.label) + '</button>';
    });
    html += '</div>';
    html += '<button class="action-sheet-btn cancel" data-click="__dcSheetCancel">' + escapeHtml(opts.cancelText || '取消') + '</button>';
    root.innerHTML = '<div class="sheet-overlay" data-click="__dcSheetCancel"></div><div class="action-sheet" role="dialog" aria-modal="true">' + html + '</div>';
    root.__sheetItems = items; root.__sheetResolve = resolve;
    requestAnimationFrame(function(){ root.classList.add('show'); });
  });
}

/* 长按列表行 → 动作面板（Edit/Delete 等）。type 决定动作集合。 */
function rowMenuActions(type, id) {
  if (type === 'task') return [
    { label: '✏️ 编辑', onClick: function(){ openTaskModal(id); } },
    { label: '🗑️ 删除', danger: true, onClick: function(){ deleteTask(id); } }
  ];
  if (type === 'student') return [
    { label: '👤 查看档案', onClick: function(){ openStudentProfile(id); } },
    { label: '✏️ 编辑', onClick: function(){ openStudentEditor(id); } },
    { label: '🗑️ 删除', danger: true, onClick: function(){ deleteStudent(id); } }
  ];
  if (type === 'score') return [
    { label: '✏️ 编辑成绩', onClick: function(){ editScore(id); } },
    { label: '🗑️ 删除', danger: true, onClick: function(){ deleteScore(id); } }
  ];
  if (type === 'reminder') return [
    { label: '🗑️ 删除', danger: true, onClick: function(){ deleteReminder(id); } }
  ];
  return [];
}
function evRowMenu(el, e) {
  if (!isMobileUI()) return;                 // 桌面保持原生右键菜单
  if (e && e.preventDefault) e.preventDefault();
  const a = __parseEvArgs(el) || [];
  const actions = rowMenuActions(a[0], a[1]);
  if (!actions.length) return;
  appActionSheet(actions);
}
/* 抑制移动端 .m-row 长按原生气泡菜单（已由 evRowMenu 接管为动作面板） */
document.addEventListener('contextmenu', function(e) {
  if (isMobileUI() && e.target && e.target.closest && e.target.closest('.m-row')) e.preventDefault();
});

function __dcSheetOk(args, e, el) { let r = __confirmResolver; __confirmResolver = null; __closeSheet(); if (r) r(true); }
function __dcSheetCancel(args, e, el) {
  const cr = __confirmResolver; __confirmResolver = null;
  let root = document.getElementById('actionSheetRoot');
  const sr = root && root.__sheetResolve; if (root) root.__sheetResolve = null;
  __closeSheet();
  if (cr) cr(false);
  if (sr) sr(null);
}
function __dcSheetItem(args, e, el) {
  const root = document.getElementById('actionSheetRoot');
  const items = root && root.__sheetItems; let idx = args[0];
  __closeSheet();
  if (items && items[idx] && items[idx].onClick) { try { items[idx].onClick(); } catch (err) { console.error(err); } }
}

function __parseClickArgs(el) {
  let raw = el.getAttribute('data-click-args');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { console.error('[delegate] data-click-args 解析失败:', raw, e); return []; }
}
function __delegateClick(e) {
  let t = e.target;
  if (!t || typeof t.closest !== 'function') return;
  let el = t.closest('[data-click]');
  if (!el) return;
  const name = el.getAttribute('data-click');
  if (name === '__noop') return;
  if (el.getAttribute('data-click-self') === '1' && e.target !== el) return;
  let fn, args = __parseClickArgs(el);
  if (name.indexOf('__dc') === 0) {
    fn = __CLICK[name];
    if (typeof fn !== 'function') { console.warn('[delegate] 未找到包装处理器:', name); return; }
    try { fn(args, e, el); } catch(err) { console.error('[delegate] 处理器异常:', name, err); }
    return;
  }
  fn = __CLICK[name] || (typeof window !== 'undefined' ? window[name] : undefined);
  if (typeof fn !== 'function') { console.warn('[delegate] 未找到处理器:', name); return; }
  try { fn.apply(el, args); } catch(err) { console.error('[delegate] 处理器异常:', name, err); }
}
document.addEventListener('click', __delegateClick);


// ── 通用事件委托（onchange/onkeypress/oninput/ondrag* 等，满足严格 CSP script-src 'self'）──
const __EV = {
  ev70: function ev70(el, e) {
    const checked = el.checked;
    let m = el.id.match(/^cloud-(up|dl)-cls-(.+)-(.+)$/);
    if (!m) return;
    const which = m[1], secKey = m[2], cls = m[3];
    const field = which === 'up' ? 'cloudUploadSectionClasses' : 'cloudDownloadSectionClasses';
    const map = state[field] || {};
    let arr = map[secKey] || [];
    if (checked) { if (arr.indexOf(cls) < 0) arr.push(cls); }
    else { arr = arr.filter(function(c) { return c !== cls; }); }
    map[secKey] = arr;
    state[field] = map;
    saveState();
  },
  ev71: function ev71(el, e) {
    const m = el.id.match(/^cloud-(up|dl)-(.+)$/);
    if (!m) return;
    const prefix = m[1];
    const sections = cloudGetCheckedSections(prefix);
    if (prefix === 'up') state.cloudUploadSections = sections; else state.cloudDownloadSections = sections;
    state.cloudSectionsConfigured = true;
    saveState();
    updateSyncModal();
  },
  ev72: function ev72(el, e) { let event = e; switchTaskClass(this.value); },
  evRowMenu: evRowMenu,

  ev1: function ev1(el, e) { let event = e; state.cloudAutoSync=this.checked;saveState() },
  ev10: function ev10(el, e) { let event = e; if(event.key==='Enter')verifyBeforeChange() },
  ev11: function ev11(el, e, a1) { let event = e; toggleTaskComplete(a1); },
  ev12: function ev12(el, e) { let event = e; event.preventDefault();this.classList.add('drag-over') },
  ev13: function ev13(el, e) { let event = e; this.classList.remove('drag-over') },
  ev14: function ev14(el, e) { let event = e; onQuadrantDrop(event, this) },
  ev15: function ev15(el, e, a1) { let event = e; event.dataTransfer.setData('text/plain', a1);this.classList.add('dragging') },
  ev16: function ev16(el, e) { let event = e; this.classList.remove('dragging') },
  ev17: function ev17(el, e) { let event = e; event.preventDefault();this.classList.add('dragover') },
  ev18: function ev18(el, e) { let event = e; this.classList.remove('dragover') },
  ev19: function ev19(el, e) { let event = e; handlePlanDrop(event) },
  ev2: function ev2(el, e) { let event = e; handleImportFile(this) },
  ev20: function ev20(el, e) { let event = e; handlePlanUpload(this) },
  ev21: function ev21(el, e) { let event = e; handleScheduleUpload(event) },
  ev22: function ev22(el, e) { let event = e; jumpToWeek(this.value) },
  ev23: function ev23(el, e, a1) { let event = e; onPeriodTypeChange(a1); },
  ev24: function ev24(el, e, a1) { let event = e; onPeriodTypeChange(a1); },
  ev25: function ev25(el, e) { let event = e; onClassFilterChange(this.value) },
  ev26: function ev26(el, e) { let event = e; onStudentSearch(this.value) },
  ev27: function ev27(el, e) { let event = e; onStudentSearch(document.getElementById('studentSearch').value) },
  ev28: function ev28(el, e) { let event = e; handleStudentUpload(this) },
  ev29: function ev29(el, e) { let event = e; handleTaskInfoUpload(this) },
  ev3: function ev3(el, e) { let event = e; handleMergeFile(this) },
  ev30: function ev30(el, e, a1) { let event = e; handleTaskImageUpload(event, a1); },
  ev31: function ev31(el, e) { let event = e; _debouncedRenderHomeworkTable() },
  ev32: function ev32(el, e) { let event = e; onHwClassFilterChange() },
  ev33: function ev33(el, e) { let event = e; onHwTaskFilterChange() },
  ev34: function ev34(el, e) { let event = e; renderHomeworkTable() },
  ev35: function ev35(el, e) { let event = e; toggleSelectAllHw(this.checked) },
  ev36: function ev36(el, e, a1) { let event = e; toggleHwSelection(a1); },
  ev37: function ev37(el, e) { let event = e; if(event.key==='Enter')sendChat() },
  ev38: function ev38(el, e) { let event = e; if(event.key==='Enter')verifyChatUnlock() },
  ev39: function ev39(el, e) { let event = e; if(event.key==='Enter')verifyTeacherReply() },
  ev4: function ev4(el, e) { let event = e; if(event.key==='Enter')document.getElementById('pwdSet2').focus() },
  ev40: function ev40(el, e, a1) { let event = e; if(event.key==='Enter')verifyTplPwd(a1) },
  ev41: function ev41(el, e, a1) { let event = e; if(event.key==='Enter')verifySpecialPwd(a1) },
  ev42: function ev42(el, e) { let event = e; state._hwAnalysisClass=this.value;saveState();renderHwAnalysis(document.getElementById('analysisContainer')) },
  ev43: function ev43(el, e) { let event = e; state._hwAnalysisTask=this.value;saveState();renderHwAnalysis(document.getElementById('analysisContainer')) },
  ev44: function ev44(el, e) { let event = e; state._dashboardClass=this.value;saveState();renderDashboard(document.getElementById('analysisContainer')) },
  ev45: function ev45(el, e) { let event = e; state._selectedExam=this.value;saveState();renderDashboard(document.getElementById('analysisContainer')) },
  ev46: function ev46(el, e) { let event = e; state._dashboardKeyClassFilter=this.value;saveState();renderDashboard(document.getElementById('analysisContainer')) },
  ev47: function ev47(el, e, a1) { let event = e; toggleKeyTypeFilter(a1); },
  ev48: function ev48(el, e) { let event = e; state._selectedExam=this.value;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev49: function ev49(el, e) { let event = e; state._scoreClassFilter=this.value;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev5: function ev5(el, e) { let event = e; if(event.key==='Enter')document.getElementById('secQuestion').focus() },
  ev50: function ev50(el, e) { let event = e; handleScoreUpload(this) },
  ev51: function ev51(el, e) { let event = e; state._scoreShowRegress=this.checked;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev52: function ev52(el, e) { let event = e; state._scoreShowVolatile=this.checked;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev53: function ev53(el, e) { let event = e; state._scoreShowSteady=this.checked;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev54: function ev54(el, e) { let event = e; state._scoreShowTop=this.checked;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev55: function ev55(el, e) { let event = e; state._scoreShowProgress=this.checked;saveState();renderScoreAnalysis(document.getElementById('analysisContainer')) },
  ev56: function ev56(el, e) { let event = e; onReminderFreqChange() },
  ev57: function ev57(el, e) { let event = e; xiuxianArchiveFilter('class',this.value) },
  ev58: function ev58(el, e) { let event = e; xiuxianArchiveFilter('linggen',this.value) },
  ev59: function ev59(el, e) { let event = e; xiuxianArchiveFilter('search',this.value) },
  ev6: function ev6(el, e, a1) { let event = e; if(event.key==='Enter')confirmSetPassword(a1) },
  ev60: function ev60(el, e, a1) { let event = e; xiuxianToggleMulti(a1); },
  ev61: function ev61(el, e) { let event = e; xiuxianTaskFilterClass(this.value) },
  ev62: function ev62(el, e) { let event = e; xiuxianPoolSetDrawStudent(this.value) },
  ev63: function ev63(el, e) { let event = e; xiuxianRankPageSetClass(this.value) },
  ev64: function ev64(el, e) { let event = e; xiuxianRankPageSetLinggen(this.value) },
  ev65: function ev65(el, e) { let event = e; xiuxianRankPageSetSelf(this.value) },
  ev7: function ev7(el, e, a1) { let event = e; if(event.key==='Enter')verifyPassword(a1) },
  ev8: function ev8(el, e) { let event = e; if(event.key==='Enter')verifySecurityAnswer() },
  ev9: function ev9(el, e) { const event = e; if(event.key==='Enter')unlockFromOverlay() }
};

function __parseEvArgs(el) {
  const raw = el.getAttribute('data-ev-args');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { console.error('[delegate] data-ev-args 解析失败:', raw, e); return []; }
}
const __EV_TYPES = ['change','keypress','input','dragover','dragleave','drop','dragstart','dragend','contextmenu'];
__EV_TYPES.forEach(function(t) {
  document.addEventListener(t, function(e) {
    let el = e.target;
    while (el && el !== document) {
      if (el.hasAttribute && el.hasAttribute('data-ev')) {
        const evTypes = el.getAttribute('data-ev');
        const typeArr = evTypes.split('|');
        const idx = typeArr.indexOf(t);
        if (idx !== -1) {
          const keyStr = el.getAttribute('data-ev-key') || '';
          const key = keyStr.split('|')[idx];
          const fn = __EV[key];
          if (typeof fn !== 'function') { console.warn('[delegate:' + t + '] 未找到处理器', key); return; }
          const args = __parseEvArgs(el);
          try { fn.apply(el, [el, e].concat(args)); } catch(err) { console.error('[delegate:' + t + '] 处理器异常:', key, err); }
          return;
        }
      }
      el = el.parentElement;
    }
  });
});
})();
