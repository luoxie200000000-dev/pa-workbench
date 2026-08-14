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

// 删除学生（同时清理关联数据：成绩、作业记录、修仙数据；studentTasks/chatMessages 为班级级数据不删除）
async function deleteStudent(id) {
  const idx = state.students.findIndex(s => s.id === id);
  if (idx < 0) { showToast('学生不存在', 'error'); return false; }
  const s = state.students[idx];
  saveState({pushUndo:true});
  if (!(await appConfirm(`确定要删除学生「${s.name} (${s.studentNo})」吗？\n关联的成绩、作业记录、修仙数据将一并删除，且不可恢复。`))) {
    return false;
  }
  state.students.splice(idx, 1);
  state.scores = state.scores.filter(sc => sc.studentId !== id);
  state.homeworkRecords = state.homeworkRecords.filter(h => h.studentId !== id);
  if (state.xiuxian && state.xiuxian.students) { delete state.xiuxian.students[id]; }
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
  if (!(await appConfirm(`确定批量删除以下 ${ids.length} 名学生吗？\n${preview}\n关联的成绩、作业记录、修仙数据将一并删除，且不可恢复。`))) {
    return;
  }
  ids.forEach(function(id) {
    state.students = state.students.filter(function(s){ return s.id !== id; });
    state.scores = state.scores.filter(function(sc){ return sc.studentId !== id; });
    state.homeworkRecords = state.homeworkRecords.filter(function(h){ return h.studentId !== id; });
    if (state.xiuxian && state.xiuxian.students) { delete state.xiuxian.students[id]; }
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
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border)">
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
      html += '<div style="font-size:12px;font-weight:600;color:var(--primary);margin:6px 0 2px;padding:0 4px">📚 任教班级</div>';
      html += teachingClasses.map(c => renderItem(c, true)).join('');
    }
    if (nonTeachingClasses.length > 0) {
      html += '<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin:10px 0 2px;padding:0 4px">🏫 非任教班级</div>';
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
      <div id="classManagerList" style="max-height:350px;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px"></div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px">提示：点击"任教/非任教"按钮可切换班级类型；有学生或成绩记录的班级不可删除。</p>
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

// 点击学生总览页分层统计卡，弹出该层学生名单（沿用当前班级筛选）
function showLayerStudentList(layer) {
  const classFilter = state.studentClassFilter || '';
  let list = classFilter ? state.students.filter(s => s.classId === classFilter) : state.students.slice();
  list = list.filter(s => getStudentLayer(s) === layer);
  list.sort((a, b) => (parseInt((a.studentNo||'').replace(/\D/g,''))||0) - (parseInt((b.studentNo||'').replace(/\D/g,''))||0));
  const rows = list.map(s => `<tr data-cell-studentNo="${escapeHtml(s.studentNo)}" data-cell-name="${escapeHtml(s.name)}" data-cell-classId="${escapeHtml(s.classId)}"><td>${escapeHtml(s.studentNo)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.classId)}</td></tr>`).join('');
  openModal(`
    <h3>👥 ${escapeHtml(layer)}层学生（${list.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
        </tr></thead>
        <tbody>${list.length > 0 ? rows : '<tr><td colspan="3" class="empty-state">暂无学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
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
    // 成绩分层：紫青粉系（与班级分层的绿蓝橙红完全不同色系）
    const scLayers = [
      { k:'A+', color:'#4A148C', bg:'#F3E5F5' },
      { k:'A',  color:'#7B1FA2', bg:'#F3E5F5' },
      { k:'B+', color:'#00695C', bg:'#E0F2F1' },
      { k:'B',  color:'#00838F', bg:'#E0F2F1' },
      { k:'C+', color:'#AD1457', bg:'#FCE4EC' },
      { k:'C',  color:'#C2185B', bg:'#FCE4EC' }
    ];
    layerStatsHTML = scLayers.map(l => `<div class="stat-card" style="border-left:3px solid ${l.color};background:${l.bg};cursor:pointer" data-click="showLayerStudentList" data-click-args="[&quot;${l.k}&quot;]" title="点击查看 ${l.k}层 学生名单"><span class="stat-icon" style="color:${l.color}">${l.k}</span><div class="stat-num" style="color:${l.color}">${layerCounts[l.k]}</div><div class="stat-label">${l.k}层</div></div>`).join('');
  } else {
    // 班级分层：绿蓝橙红系
    layerStatsHTML = `
      <div class="stat-card" style="border-left:3px solid var(--success);background:#E8F5E9;cursor:pointer" data-click="showLayerStudentList" data-click-args="[&quot;A&quot;]" title="点击查看 A层 学生名单"><span class="stat-icon" style="color:var(--success)">A</span><div class="stat-num" style="color:var(--success)">${layerCounts.A}</div><div class="stat-label">A层</div></div>
      <div class="stat-card" style="border-left:3px solid var(--info);background:#E3F2FD;cursor:pointer" data-click="showLayerStudentList" data-click-args="[&quot;B&quot;]" title="点击查看 B层 学生名单"><span class="stat-icon" style="color:var(--info)">B</span><div class="stat-num" style="color:var(--info)">${layerCounts.B}</div><div class="stat-label">B层</div></div>
      <div class="stat-card" style="border-left:3px solid var(--warning);background:#FFF3E0;cursor:pointer" data-click="showLayerStudentList" data-click-args="[&quot;C&quot;]" title="点击查看 C层 学生名单"><span class="stat-icon" style="color:var(--warning)">C</span><div class="stat-num" style="color:var(--warning)">${layerCounts.C}</div><div class="stat-label">C层</div></div>
      <div class="stat-card" style="border-left:3px solid var(--danger);background:#FFEBEE;cursor:pointer" data-click="showLayerStudentList" data-click-args="[&quot;D&quot;]" title="点击查看 D层 学生名单"><span class="stat-icon" style="color:var(--danger)">D</span><div class="stat-num" style="color:var(--danger)">${layerCounts.D}</div><div class="stat-label">D层</div></div>`;
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
      <span style="font-size:12px;color:var(--text-muted);font-weight:600">分层模式：</span>
      <div class="layer-toggle ${isScoreMode?'':'active'}" data-click="switchLayerMode" data-click-args="[&quot;class&quot;]">📊 班级分层 <span style="font-size:10px;color:var(--text-muted)">(排名)</span></div>
      <div class="layer-toggle ${isScoreMode?'active':''}" data-click="switchLayerMode" data-click-args="[&quot;score&quot;]">🎯 成绩分层 <span style="font-size:10px;color:var(--text-muted)">(分数)</span></div>
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
  const _isScoreMode = (state.layerMode || 'class') === 'score';
  const _layerColorMap = _isScoreMode ? LAYER_COLORS_SCORE : LAYER_COLORS_CLASS;
  const _studentHtml = students.map(s => {
    const badgeClass = getLayerBadgeClass(s);
    const layer = getStudentLayer(s);
    const initialChar = (s.name || '?').charAt(0);
    const layerBadge = layer === null
      ? '<span style="background:#9E9E9E;color:#fff;padding:1px 8px;border-radius:10px;font-size:12px">未分层</span>'
      : '<span style="background:' + (_layerColorMap[layer] || '#9E9E9E') + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">' + layer + '层</span>';
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
      + '<div style="margin-top:10px;display:flex;gap:10px;font-size:11px;color:var(--text-muted)">'
        + '<span>✅ 优' + s.homeworkStats.excellent + '</span>'
        + '<span>📝 完' + s.homeworkStats.normal + '</span>'
        + '<span style="color:var(--danger)">❌ 未' + s.homeworkStats.incomplete + '</span>'
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
              ? '<span style="background:#9E9E9E;color:#fff;padding:1px 8px;border-radius:10px;font-size:12px">未分层</span>'
              : '<span style="background:' + ({A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'}[classLayer] || '#9E9E9E') + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">' + classLayer + '层</span>'}
            <span style="font-size:11px;color:var(--text-muted)">班级分层${classLayer === null ? '（暂无数据）' : ' · ' + getClassLayerLabel(classLayer)}</span>
            <span style="color:var(--text-muted);margin:0 2px">|</span>
            ${scoreLayer === null
              ? '<span style="background:#9E9E9E;color:#fff;padding:1px 8px;border-radius:10px;font-size:12px">未分层</span>'
              : '<span style="background:' + (LAYER_COLORS_SCORE[scoreLayer] || '#9E9E9E') + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">' + scoreLayer + '层</span>'}
            <span style="font-size:11px;color:var(--text-muted)">成绩分层${scoreLayer === null ? '（暂无数据）' : ' · ' + getScoreLayerLabel(scoreLayer)}</span>
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
            return `<span class="tag ${has?'tag-active':'tag-normal'}" style="cursor:pointer${has?';background:var(--primary);color:#fff':''}" data-click="toggleStudentTag" data-click-args="${escapeAttr(JSON.stringify([s.id, t]))}">${escapeHtml(t)}</span>`;
          }).join('')}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">当前标签：</div>
        <div id="currentTags" style="display:flex;flex-wrap:wrap;gap:6px">
          ${currentTags.map(t => `<span class="tag tag-normal">${escapeHtml(t)} <span style="cursor:pointer;color:var(--danger)" data-click="toggleStudentTag" data-click-args="${escapeAttr(JSON.stringify([s.id, t]))}">✕</span></span>`).join('')}
          ${currentTags.length === 0 ? '<span class="text-muted text-sm">暂无标签</span>' : ''}
        </div>
        <h4 style="margin-top:14px">作业完成统计</h4>
        <div class="hw-stat-row"><span>优秀 (${hw.excellent})</span><div class="hw-stat-bar"><div class="hw-stat-fill" style="width:${exPct}%;background:var(--success)"></div></div><span>${exPct}%</span></div>
        <div class="hw-stat-row"><span>正常完成 (${hw.normal})</span><div class="hw-stat-bar"><div class="hw-stat-fill" style="width:${noPct}%;background:var(--info)"></div></div><span>${noPct}%</span></div>
        <div class="hw-stat-row"><span>未完成或敷衍 (${hw.incomplete})</span><div class="hw-stat-bar"><div class="hw-stat-fill" style="width:${inPct}%;background:var(--danger)"></div></div><span>${inPct}%</span></div>
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
        <button class="btn btn-outline" data-click="${showArchived ? 'toggleShowArchivedTasks' : 'toggleShowArchivedTasks'}" style="${showArchived ? 'border-color:var(--success);color:var(--success)' : ''}">${showArchived ? '↩ 返回活动任务' : `📦 历史作业${archivedCount ? ' (' + archivedCount + ')' : ''}`}</button>
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
        <div class="plan-item-name">${escapeHtml(t.title)} ${hasAnswer?'<span style="font-size:11px;color:var(--danger)">🔑 含答案</span>':'<span style="font-size:11px;color:var(--text-muted)">无答案</span>'}${showArchived?' <span style="font-size:11px;color:var(--text-muted)">· 历史作业</span>':''}${crossClass?' <span class="cc-tag">🌐跨班</span>':''}</div>
        <div class="plan-item-meta">班级：${escapeHtml(getTaskClassIds(t).join('、'))} | 布置日期：${escapeHtml(t.assignedDate)} | 截止日期：${escapeHtml(t.dueDate||'未设')}</div>
        <div class="plan-item-meta">作业内容：${escapeHtml(t.content)}</div>
        <div id="answer-${t.id}" class="text-sm" style="display:none;margin-top:8px;padding:12px;background:var(--bg-app);border-radius:var(--radius-sm);border:1px solid var(--border)">
          ${t.answer ? `<div style="color:var(--danger);font-weight:500;margin-bottom:${images.length>0?'8px':'0'}">🔑 答案：${escapeHtml(t.answer)}</div>` : ''}
          ${images.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${images.map((img,i) => `<img src="${safeImageSrc(img)}" alt="示意图${i+1}" style="max-width:200px;max-height:150px;border-radius:6px;border:1px solid var(--border)" data-click="__noop">`).join('')}</div>` : ''}
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
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:var(--bg-app);border-radius:var(--radius-sm)">
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
        ${images.map((img,i) => `<div style="position:relative"><img src="${safeImageSrc(img)}" style="max-width:120px;max-height:100px;border-radius:6px;border:1px solid var(--border)"><span style="position:absolute;top:-4px;right:-4px;background:var(--danger);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer" data-click="removeTaskImage" data-click-args="${escapeAttr(JSON.stringify([t ? t.id : 'null', i]))}">✕</span></div>`).join('')}
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
        if (prev) prev.innerHTML += `<div><img src="${safeImageSrc(e.target.result)}" style="max-width:120px;max-height:100px;border-radius:6px;border:1px solid var(--border)"></div>`;
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
      <p style="margin:8px 0;color:var(--text-muted);line-height:1.6">该任务下共有 <b style="color:var(--danger)">${count}</b> 条作业登记数据。删除任务时如何处理这些登记数据？</p>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="resolveTaskDelete" data-click-args="[&quot;cancel&quot;]">取消</button>
        <button class="btn" style="background:var(--warning);color:#fff" data-click="resolveTaskDelete" data-click-args="[&quot;keepRecords&quot;]">仅删任务 · 保留登记</button>
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
          <span style="background:${ {A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'}[getClassLayer(s)] || '#9E9E9E' };color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">${getClassLayer(s)}</span>
        </div>
      `).join('')}
      ${list.length === 0 ? '<div class="text-muted text-sm">该分层无学生</div>' : ''}
    </div>
  `;
  el.innerHTML = `
    <div style="margin-bottom:8px;font-size:13px;color:var(--text-muted)">
      ${result.classFilter ? '班级：' + escapeHtml(result.classFilter) : '全部班级'} · 候选池共 <strong>${result.totalCount}</strong> 人（A层${result.aPoolCount} / B层${result.bPoolCount} / C+D层${result.cdPoolCount}）
    </div>
    <div class="random-result-grid">
      ${col('A层', result.a, 'var(--success)')}
      ${col('B层', result.b, 'var(--info)')}
      ${col('C+D层', result.cd, 'var(--warning)')}
    </div>
    ${result.unpicked && result.unpicked.length > 0 ? `
    <div style="margin-top:12px;padding:8px 12px;background:var(--bg-hover);border-radius:var(--radius-sm);font-size:12px;color:var(--text-muted)">
      <span style="font-weight:600">未选中：</span>${result.unpicked.map(s => `<span style="display:inline-block;margin:2px 4px;padding:1px 6px;background:var(--bg);border-radius:4px">${escapeHtml(s.name)}<span style="color:var(--text-muted)"> ${escapeHtml(s.classId)}</span></span>`).join('')}
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
    <div style="margin-bottom:8px;font-size:12px;color:var(--text-muted);display:flex;justify-content:space-between">
      <span id="hwSelectedCount">已选择 0 人</span>
      <span id="hwPendingCount"></span>
    </div>
    <table class="hw-table">
      <thead><tr>
        <th style="width:30px"><input type="checkbox" id="hwSelectAll" data-ev="change" data-ev-key="ev35"></th>
        <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
        <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
        <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
        <th data-click="__sortModalTable" data-sort-key="layer">分层</th>
        <th data-click="__sortModalTable" data-sort-key="taskTitle">任务</th>
        <th data-click="__sortModalTable" data-sort-key="status">状态</th><th data-click="__sortModalTable" data-sort-key="review">批阅</th>
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
    const s = state.students.find(st => st.id === r.studentId);
    const layer = s ? getClassLayer(s) : '';
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
    <tr class="hw-row hw-row-${r.status}" data-cell-studentNo="${escapeHtml(r.studentNo)}" data-cell-name="${escapeHtml(r.name)}" data-cell-classId="${escapeHtml(r.classId)}" data-cell-layer="${layer}" data-cell-taskTitle="${escapeHtml(r.taskTitle)}" data-cell-status="${({'excellent':1,'normal':2,'resubmitted':3,'incomplete':4,'perfunctory':5,'pending':6}[r.status]||0)}" data-cell-review="${escapeHtml((r.review || (r.reviewStatus==='reviewed'?'已处理':''))||'')}">
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
  return layer ? '<span style="background:' + ({A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'}[layer] || '#9E9E9E') + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer" data-click="openStudentProfile" data-click-args="[&quot;' + studentId + '&quot;]" title="点击查看档案">' + layer + '层</span>' : '<span class="text-muted">-</span>';
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
  return layer ? '<span style="background:' + ({A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'}[layer] || '#9E9E9E') + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">' + layer + '层</span>' : '<span class="text-muted">-</span>';
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
      ? `<span style="color:var(--warning)">⏳ ${pending.length} 人未标记（保存时自动填充为「正常完成」）</span>`
      : '<span style="color:var(--success)">✅ 全部已标记</span>';
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
    <p style="font-size:13px;color:var(--text-body);margin-bottom:12px;line-height:1.7">
      以下 <b style="color:var(--warning)">${pending.length} 名学生</b>尚未标记作业状态，保存后将自动填充为<b style="color:var(--success)">「正常完成」</b>。
    </p>
    <div style="background:var(--bg-app);padding:12px;border-radius:var(--radius-sm);max-height:200px;overflow-y:auto;font-size:12px;color:var(--text-body);margin-bottom:12px">
      ${names}
    </div>
    <p style="font-size:12px;color:var(--text-muted)">确认后所有数据将自动保存到云端</p>
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
          <span style="font-size:12px;font-weight:400;color:var(--text-muted);flex:1">课代表→右 / 教师←左</span>
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
          <button class="btn btn-outline btn-sm" data-click="teacherReply" title="教师回复（需密码）" style="border-color:var(--warning);color:var(--warning)">👨‍🏫 教师回复</button>
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
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">输入密码以查看教师回复内容</p>
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
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">请输入密码以发送教师回复消息</p>
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
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">发送模板消息需要密码验证</p>
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
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">发送统计/名单需要密码验证</p>
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

