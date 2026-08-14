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
    reminders: JSON.parse(JSON.stringify(src.reminders || [])),
    xiuxian: JSON.parse(JSON.stringify(src.xiuxian || { students: {}, meta: {} }))
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

