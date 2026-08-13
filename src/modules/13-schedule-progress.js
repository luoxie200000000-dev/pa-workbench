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
  saveState({pushUndo:true});
  closeModal();
  renderSchedule(document.getElementById('contentArea'));
}

async function deleteAdjustment(id) {
  if (!(await appConfirm('确认删除此调课记录？', {danger:true}))) return;
  state.adjustments = state.adjustments.filter(a=>a.id!==id);
  saveState({pushUndo:true});
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
  saveState({pushUndo:true});
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
  saveState({pushUndo:true});
  closeModal();
  showToast(entryId ? '课程已更新' : '课程已添加');
  renderSchedule(document.getElementById('contentArea'));
}

async function deleteScheduleEntry(id) {
  if (!(await appConfirm('确认删除这节课？', {danger:true}))) return;
  state.schedule = state.schedule.filter(s => (s.id||'') !== id);
  saveState({pushUndo:true});
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
  saveState({pushUndo:true});
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
  saveState({pushUndo:true});
  closeModal();
  renderProgress(document.getElementById('contentArea'));
}

async function deleteProgress(id) {
  if (!(await appConfirm('确认删除此进度记录？', {danger:true}))) return;
  state.progress = state.progress.filter(p=>p.id!==id);
  saveState({pushUndo:true});
  showToast('进度已删除');
  renderProgress(document.getElementById('contentArea'));
}

function saveReflection(id) {
  const p = state.progress.find(x=>x.id===id);
  if (p) {
    p.reflection = document.getElementById(`reflection-${id}`).value.trim();
    saveState({pushUndo:true});
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
    saveState({pushUndo:true});
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

