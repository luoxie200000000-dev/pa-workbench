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
    <tr class="${t.completed?'completed':''}" data-cell-time="${escapeHtml(t.time)}" data-cell-important="${t.important?1:0}" data-cell-urgent="${t.urgent?1:0}">
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
        <th></th><th>任务名称 / 描述</th><th data-click="__sortModalTable" data-sort-key="time">时间</th><th>负责人</th><th data-click="__sortModalTable" data-sort-key="important" data-sort-dir="asc">重要</th><th data-click="__sortModalTable" data-sort-key="urgent" data-sort-dir="asc">紧急</th><th>操作</th>
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
        <div style="background:var(--primary-lightest);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
          <div style="font-weight:600;color:var(--text-heading);margin-bottom:6px">模板字段说明</div>
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
      <div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" data-click="togglePlanSort" title="按截止时间排序">⏱ 按截止时间${state._planSortDir ? (state._planSortDir==='asc'?' ↑':' ↓') : ''}</button>
        <button class="btn btn-primary btn-sm" data-click="openNewPlanModal">➕ 新建计划</button>
      </div>
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
  let plans = state.plans.slice();
  if (state._planSortDir) {
    const dir = state._planSortDir === 'asc' ? 1 : -1;
    plans.sort((a, b) => {
      const av = a.endDate || '9999-99-99';
      const bv = b.endDate || '9999-99-99';
      return av < bv ? -dir : (av > bv ? dir : 0);
    });
  }
  el.innerHTML = plans.map((p, idx) => {
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

function togglePlanSort() {
  state._planSortDir = state._planSortDir === 'asc' ? 'desc' : (state._planSortDir === 'desc' ? null : 'asc');
  renderPlanList();
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
      <div class="analysis-row"><span class="analysis-label">截止时间</span><span class="analysis-value" style="${isOverdue?'color:var(--danger)':''}">${isOverdue?'⚠️ ':''}${escapeHtml(p.endDate||'未设置')}</span></div>
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
      <label class="form-label">计划名称 <span style="color:var(--danger)">*</span></label>
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
      <label class="form-label">计划名称 <span style="color:var(--danger)">*</span></label>
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

