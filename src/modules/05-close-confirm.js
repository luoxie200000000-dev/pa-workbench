/* ========== 关闭确认弹窗 ========== */
function _injectCloseConfirmStyle() {
  if (document.getElementById('close-confirm-style')) return;
  const st = document.createElement('style');
  st.id = 'close-confirm-style';
  st.textContent =
    '@keyframes ccFadeIn{from{opacity:0}to{opacity:1}}' +
    '@keyframes ccPopIn{0%{opacity:0;transform:translateY(16px) scale(.94)}100%{opacity:1;transform:translateY(0) scale(1)}}' +
    '@keyframes ccSpin{to{transform:rotate(360deg)}}' +
    '.cc-overlay{position:fixed;inset:0;background:rgba(15,23,42,.30);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:10000;display:flex;align-items:center;justify-content:center;animation:ccFadeIn .18s ease}' +
    '.cc-dialog{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:26px 24px 22px;width:376px;max-width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(0,0,0,.28);animation:ccPopIn .24s cubic-bezier(.34,1.4,.64,1);font-family:inherit}' +
    '.cc-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px;background:linear-gradient(135deg,var(--primary),var(--primary-dark,var(--primary)));box-shadow:0 6px 18px rgba(0,0,0,.16)}' +
    '.cc-title{font-size:17px;font-weight:600;color:var(--text-heading);text-align:center;margin-bottom:8px}' +
    '.cc-desc{font-size:13px;color:var(--text-muted);text-align:center;line-height:1.65;margin-bottom:18px}' +
    '.cc-tag{display:inline-block;padding:1px 7px;border-radius:6px;background:var(--primary);color:#fff;font-size:12px;font-weight:600;margin:0 2px}' +
    '.cc-warn{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:9px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.28);font-size:12.5px;color:#b45309;margin-bottom:16px;line-height:1.5}' +
    '.cc-btns{display:flex;flex-direction:column;gap:9px}' +
    '.cc-row{display:flex;gap:9px}' +
    '.cc-btn{flex:1;padding:11px 16px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;transition:all .16s ease;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px}' +
    '.cc-btn:disabled{opacity:.55;cursor:not-allowed}' +
    '.cc-btn-primary{border:none;background:var(--primary);color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.14)}' +
    '.cc-btn-primary:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.2)}' +
    '.cc-btn-default{border:1px solid var(--border);background:transparent;color:var(--text-body)}' +
    '.cc-btn-default:hover:not(:disabled){background:var(--bg-hover,rgba(127,127,127,.09));border-color:var(--primary)}' +
    '.cc-btn-ghost{border:1px solid transparent;background:transparent;color:var(--text-muted)}' +
    '.cc-btn-ghost:hover:not(:disabled){background:var(--bg-hover,rgba(127,127,127,.09));color:var(--text-body)}' +
    '.cc-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:ccSpin .7s linear infinite}' +
    '.cc-progress{display:flex;align-items:center;justify-content:center;gap:9px;padding:13px;font-size:13.5px;color:var(--text-body)}' +
    '.cc-progress .cc-spinner{border-color:var(--border);border-top-color:var(--primary)}';
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

