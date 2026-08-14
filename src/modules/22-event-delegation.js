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
  showLayerStudentList: showLayerStudentList,
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
  filterProgressByStatus: filterProgressByStatus,
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
  __sortModalTable: __sortModalTable,
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
  xiuxianArchiveSetPage: xiuxianArchiveSetPage,
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
