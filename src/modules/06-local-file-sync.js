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
    'off': { icon: '\u2601\ufe0f', text: '\u672a\u540c\u6b65', color: 'var(--text-muted)' },
    'syncing': { icon: '\ud83d\udd04', text: '\u540c\u6b65\u4e2d', color: 'var(--warning)' },
    'synced': { icon: '\u2705', text: '\u5df2\u540c\u6b65', color: 'var(--primary)' },
    'uploaded': { icon: '\u2601\ufe0f\u2b06\ufe0f', text: '\u5df2\u4e0a\u4f20', color: 'var(--info)' },
    'error': { icon: '\u26a0\ufe0f', text: '\u540c\u6b65\u5931\u8d25', color: 'var(--danger)' }
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
          escapeHtml(c.label) + ' <span style="font-size:11px;color:var(--text-muted)">(全局)</span></label>';
      }
    }).join('');
    let arrow = collapsed ? '\u25b8' : '\u25be';
    return '<div style="margin-bottom:10px;padding:8px;background:var(--bg-primary);border-radius:var(--radius-sm);border-left:3px solid var(--primary)">' +
      '<div data-click="cloudToggleGroup" data-click-args="' + escapeAttr(JSON.stringify([g.id])) + '" style="font-size:13px;font-weight:700;color:var(--primary-darker);margin-bottom:' + (collapsed ? '0' : '4px') + ';cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none">' +
      '<span style="display:inline-block;width:14px;text-align:center">' + arrow + '</span>' + g.icon + ' ' + escapeHtml(g.label) +
      ' <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(' + g.children.length + ')</span></div>' +
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
    const upActive = mtab === 'up' ? ' style="background:var(--primary);color:#fff"' : '';
    const dlActive = mtab === 'dl' ? ' style="background:var(--primary);color:#fff"' : '';
    sectionHtml =
      '<div style="font-size:14px;font-weight:700;margin-bottom:10px">云同步设置（上传 / 下载栏目分开选择）</div>' +
      '<div style="display:flex;gap:0;margin-bottom:10px;border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border)">' +
      '<button class="btn" data-click="__dcSwitchSyncTab" data-click-args="[&quot;up&quot;]" style="flex:1;border-radius:0;border:none;padding:8px"' + upActive + '>上传栏目</button>' +
      '<button class="btn" data-click="__dcSwitchSyncTab" data-click-args="[&quot;dl&quot;]" style="flex:1;border-radius:0;border:none;padding:8px"' + dlActive + '>下载栏目</button>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--primary-darker);margin-bottom:6px">' + (mtab === 'up' ? '自动上传栏目' : '自动下载栏目') + '（勾选后可展开选班级）</div>' +
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
    '<div style="background:var(--primary-lightest);border-radius:var(--radius);padding:14px;margin-bottom:16px">' +
    '<div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--primary-darker)">S3 配置（数据胶囊）</div>' +
    '<div style="display:grid;gap:8px">' +
    '<input id="s3-endpoint" class="form-input" placeholder="Endpoint" value="' + escapeHtml(cfg.endpoint || '') + '" style="font-size:13px">' +
    '<input id="s3-bucket" class="form-input" placeholder="Bucket" value="' + escapeHtml(cfg.bucket || '') + '" style="font-size:13px">' +
    '<input id="s3-accesskey" class="form-input" placeholder="AccessKey ID" value="' + escapeHtml(cfg.accessKey || '') + '" style="font-size:13px">' +
    '<input id="s3-secretkey" class="form-input" type="password" placeholder="Secret Access Key（整串，含斜杠）" value="' + escapeHtml(cfg.secretKey || '') + '" style="font-size:13px">' +
    '<div style="font-size:11px;color:var(--text-muted);line-height:1.4">数据胶囊 S3 的 SecretKey 是完整的一串（例如 AAAA/BBBB...），请从控制台点击"显示"后整段复制粘贴，不要只填斜杠后面部分。</div>' +
    '<input id="s3-region" class="form-input" placeholder="Region" value="' + escapeHtml(cfg.region || 'us-east-1') + '" style="font-size:13px">' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
    '<button class="btn btn-primary" data-click="saveCstcloudConfig" style="flex:1">保存配置</button>' +
    '<button class="btn btn-outline" data-click="cloudTestConnection" style="flex:1">测试连接</button>' +
    '</div>' +
    '</div>' +
    '<div style="background:var(--bg-secondary);border-radius:var(--radius);padding:14px;margin-bottom:16px">' +
    sectionHtml +
    '</div>' +
    '<div style="background:var(--bg-secondary);border-radius:var(--radius);padding:14px;margin-bottom:16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div><div style="font-size:14px;font-weight:700">自动同步</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">打开时自动下载所选栏目+对应班级，退出时自动上传所选栏目+对应班级</div></div>' +
    '<label class="cloud-toggle">' +
    '<input type="checkbox" ' + (state.cloudAutoSync ? 'checked' : '') + ' data-ev="change" data-ev-key="ev1">' +
    '<span class="toggle-track"></span>' +
    '<span class="toggle-thumb"></span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:8px">上次上传: ' + lastPush + ' | 上次下载: ' + lastPull + '</div>' +
    '<div style="padding:10px;background:#E3F2FD;border-radius:var(--radius-sm);font-size:12px;color:#1565C0;line-height:1.6">' +
    '各栏目按业务板块分组（统筹中心/学生日常管理/学生工作任务/学生学情分析/生物仙途秘境），点击分组标题可折叠/展开。按班级划分的栏目（作业登记/任务信息/聊天框/学生档案/修仙档案）勾选后会展开班级勾选，可分别选上传和下载的班级；全局栏目（教学计划/课程表等）整块同步到 global.json。' +
    '</div>';
}

