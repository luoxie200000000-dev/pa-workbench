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

  // 收集各班级分层（A/B/C/D，按最新成绩班级排名算得）各状态的学生名单
  const layerStatusStudents = {};
  const byLayer = { 'A':{excellent:0,normal:0,incomplete:0,pending:0}, 'B':{excellent:0,normal:0,incomplete:0,pending:0}, 'C':{excellent:0,normal:0,incomplete:0,pending:0}, 'D':{excellent:0,normal:0,incomplete:0,pending:0} };
  records.forEach(r => {
    const s = state.students.find(st => st.id === r.studentId);
    if (s) {
      // 班级分层 = 按最新成绩班级排名算得（rankToLayer），与档案总库口径一致
      const layer = getClassLayer(s);
      if (byLayer[layer]) {
        const statKey = r.status === 'perfunctory' ? 'incomplete' : (byLayer[layer][r.status] !== undefined ? r.status : 'pending');
        if (byLayer[layer][statKey] !== undefined) byLayer[layer][statKey]++;
        if (!layerStatusStudents[layer]) layerStatusStudents[layer] = {};
        if (!layerStatusStudents[layer][statKey]) layerStatusStudents[layer][statKey] = [];
        layerStatusStudents[layer][statKey].push({ name: s.name, studentNo: s.studentNo, classId: s.classId, taskTitle: r.taskTitle, status: r.status });
      }
    }
  });
  const colors = { excellent:'var(--success)', normal:'var(--info)', incomplete:'var(--danger)', pending:'#7E57C2' };

  // 班级作业完成概况排序
  const sortKey = state._hwAnalysisSortKey || 'classId';
  const sortDir = state._hwAnalysisSortDir || 'asc';
  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const sortableHeader = (key, label) => `<th style="cursor:pointer;user-select:none" data-click="toggleHwAnalysisSort" data-click-args="[&quot;${key}&quot;]">${label}${sortArrow(key)}</th>`;

  const classStats = getClassHomeworkStats(classFilter, taskFilter);
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
      <h3>各班级分层作业状态分布 <span style="font-size:12px;color:var(--text-muted);font-weight:400">（点击数值查看学生名单）</span></h3>
      ${['A','B','C','D'].map(layer => {
        const d = byLayer[layer];
        const total = d.excellent + d.normal + d.incomplete + d.pending;
        return total ? `
          <div style="margin-bottom:18px">
            <div style="font-weight:600;margin-bottom:8px"><span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:600;color:#fff;background:${({A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'})[layer]}">${layer}层</span> 共 ${total} 条记录</div>
            ${['excellent','normal','incomplete','pending'].map(status => {
              const count = d[status];
              const pct = Math.round(count/total*100);
              const label = status==='excellent'?'优秀':status==='normal'?'正常完成':status==='incomplete'?'未完成或敷衍':'待批改';
              return count ? `
                <div class="bar-chart-row">
                  <div class="bar-chart-label"><span>${label}</span><span style="cursor:pointer;color:${colors[status]}" data-click="showHwAnalysisStudents" data-click-args="[&quot;${layer}&quot;, &quot;${status}&quot;]">${count}人 (${pct}%)</span></div>
                  <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${pct}%;background:${colors[status]}">${pct}%</div></div>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : `<div style="margin-bottom:12px"><span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:600;color:#fff;background:${({A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'})[layer]}">${layer}层</span> 暂无记录</div>`;
      }).join('')}
    </div>
    <div class="analysis-card" style="margin-top:16px">
      <h3>班级作业完成概况 <span style="font-size:12px;color:var(--text-muted);font-weight:400">（点击表头排序）</span></h3>
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
      const stuLayer = getClassLayer(s);  // 班级分层（按最新成绩班级排名）
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
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
          <th data-click="__sortModalTable" data-sort-key="taskTitle">作业</th>
          <th data-click="__sortModalTable" data-sort-key="status">状态</th>
        </tr></thead>
        <tbody>${students.map(st => `
          <tr data-cell-studentNo="${escapeHtml(st.studentNo)}" data-cell-name="${escapeHtml(st.name)}" data-cell-classId="${escapeHtml(st.classId)}" data-cell-taskTitle="${escapeHtml(st.taskTitle)}" data-cell-status="${escapeHtml(st.status)}">
          <td>${escapeHtml(st.studentNo)}</td><td>${escapeHtml(st.name)}</td><td>${escapeHtml(st.classId)}</td><td>${escapeHtml(st.taskTitle)}</td><td>${hwStatusBadge(st.status)}</td></tr>
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
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="taskTitle">作业</th>
          <th data-click="__sortModalTable" data-sort-key="status">状态</th>
        </tr></thead>
        <tbody>${records.map(r => `
          <tr data-cell-studentNo="${escapeHtml(r.studentNo)}" data-cell-name="${escapeHtml(r.name)}" data-cell-taskTitle="${escapeHtml(r.taskTitle)}" data-cell-status="${escapeHtml(r.status)}">
          <td>${escapeHtml(r.studentNo)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.taskTitle)}</td><td>${hwStatusBadge(r.status)}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">关闭</button>
    </div>
  `);
}

function getClassHomeworkStats(classFilter, taskFilter) {
  let classes = [...new Set(state.students.map(s => s.classId))].sort();
  if (classFilter) classes = [classFilter];
  return classes.map(cls => {
    let records = state.homeworkRecords.filter(r => r.classId === cls);
    if (taskFilter) records = records.filter(r => r.taskId === taskFilter);
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
      case 'name':
        va = a.name || ''; vb = b.name || '';
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
    let va, vb;
    if (anomalySortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
    else if (anomalySortKey === 'layer') { va = getStudentLayer(a) || ''; vb = getStudentLayer(b) || ''; }
    else { va = a[anomalySortKey]; vb = b[anomalySortKey]; }
    if (anomalySortKey === 'studentNo' || anomalySortKey === 'classId' || anomalySortKey === 'name' || anomalySortKey === 'layer') { va = va || ''; vb = vb || ''; }
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
        <h3>🎯 各分层人数 <span style="font-size:12px;color:var(--text-muted);font-weight:400">（${isScoreLayer?'按成绩分数':'按考试班排'}）</span></h3>
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
              <div style="font-weight:600;color:var(--text-heading)">📌 成绩变动学生</div>
              <select class="form-select" style="width:120px" data-ev="change" data-ev-key="ev46">
                <option value="">全部班级</option>
                ${getClasses().map(c => `<option value="${c}" ${keyClassFilter===c?'selected':''}>${c}</option>`).join('')}
              </select>
              <div style="font-size:12px;color:var(--text-muted);display:flex;gap:10px;align-items:center">
                ${Object.keys(keyTypeLabels).map(t => `<label style="cursor:pointer"><input type="checkbox" ${keyTypeFilter[t]!==false?'checked':''} data-ev="change" data-ev-key="ev47" data-ev-args="${escapeAttr(JSON.stringify([t]))}"> ${keyTypeLabels[t]}</label>`).join('')}
              </div>
              ${(keyClassFilter || Object.values(keyTypeFilter).some(v => v === false)) ? `<button class="btn btn-sm btn-outline" data-click="resetDashboardKeyFilter">重置筛选</button>` : ''}
            </div>
            ${filteredKeyStudents.length > 0 ? `
              <div class="table-wrap">
                <table class="task-table" style="width:100%;min-width:420px">
                  <thead><tr>
                    ${keySortableHeader('studentNo','学号')}
                    ${keySortableHeader('name','姓名')}
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
                      <td><span style="color:${color};font-weight:600;cursor:pointer" data-click="showKeyStudentDetail" data-click-args="[&quot;${s.studentId}&quot;, &quot;${s.type}&quot;]">${escapeHtml(s.label)}</span></td>
                    </tr>`;
                  }).join('')}</tbody>
                </table>
              </div>
            ` : '<div class="empty-state" style="padding:12px"><span class="emoji">🔍</span>当前筛选条件下暂无成绩变动学生</div>'}
          </div>
        ` : ''}
        ${hwAnomalies.length > 0 ? `
          <div>
            <div style="font-weight:600;margin-bottom:8px;color:var(--text-heading)">⚠️ 作业异常学生（未上交或敷衍完成≥2次） <span style="font-size:12px;color:var(--text-muted);font-weight:400">（点击表头排序，点击次数查看详情）</span></div>
            <div class="table-wrap">
              <table class="task-table" style="width:100%;min-width:560px">
                <thead><tr>
                  ${anomalySortableHeader('studentNo','学号')}
                  ${anomalySortableHeader('name','姓名')}
                  ${anomalySortableHeader('classId','班级')}
                  ${anomalySortableHeader('incompleteCount','未上交次数')}
                  ${anomalySortableHeader('perfunctoryCount','敷衍完成次数')}
                  ${anomalySortableHeader('layer','分层')}
                </tr></thead>
                <tbody>${hwAnomalies.map(s => `
                  <tr>
                    <td>${escapeHtml(s.studentNo||'')}</td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.classId)}</td>
                    <td>${s.incompleteCount > 0 ? `<span style="color:var(--danger);font-weight:600;cursor:pointer" data-click="showHwAnomalyDetail" data-click-args="[&quot;${s.id}&quot;, &quot;incomplete&quot;]">${s.incompleteCount}</span>` : '<span class="text-muted">0</span>'}</td>
                    <td>${s.perfunctoryCount > 0 ? `<span style="color:#E65100;font-weight:600;cursor:pointer" data-click="showHwAnomalyDetail" data-click-args="[&quot;${s.id}&quot;, &quot;perfunctory&quot;]">${s.perfunctoryCount}</span>` : '<span class="text-muted">0</span>'}</td>
                    <td>${(() => { const _l = getStudentLayer(s); const _c = {A:'#2E7D32',B:'#1565C0',C:'#E65100',D:'#C62828'}[_l] || '#9E9E9E'; return _l === null ? '<span style="background:#9E9E9E;color:#fff;padding:1px 8px;border-radius:10px;font-size:12px">未分层</span>' : '<span style="background:' + _c + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">' + _l + '层</span>'; })()}</td>
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
  const colorMap = { incomplete: 'var(--danger)', perfunctory: '#E65100' };
  const title = titleMap[type] || '异常作业';
  openModal(`
    <h3>📋 ${escapeHtml(s.name)}（${escapeHtml(s.studentNo)}）- ${title}详情</h3>
    <div style="margin-bottom:10px;font-size:13px;color:var(--text-muted)">
      班级：${escapeHtml(s.classId)} | 共 ${records.length} 次${title}
    </div>
    <div class="table-wrap" style="max-height:350px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="taskTitle">作业名称</th>
          <th data-click="__sortModalTable" data-sort-key="status">状态</th>
          <th data-click="__sortModalTable" data-sort-key="review">批阅</th>
        </tr></thead>
        <tbody>${records.length > 0 ? records.map(r => `
          <tr data-cell-taskTitle="${escapeHtml(r.taskTitle)}" data-cell-status="${escapeHtml(r.status)}" data-cell-review="${escapeHtml(r.review || '—')}">
          <td>${escapeHtml(r.taskTitle)}</td><td>${hwStatusBadge(r.status)}</td><td>${escapeHtml(r.review || '—')}</td></tr>
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
  const rows = list.map(s => `<tr style="cursor:pointer" data-click="showHwAnomalyDetail" data-click-args="[&quot;${s.id}&quot;, &quot;${s.incompleteCount >= 2 ? 'incomplete' : 'perfunctory'}&quot;]" data-cell-studentNo="${escapeHtml(s.studentNo)}" data-cell-name="${escapeHtml(s.name)}" data-cell-classId="${escapeHtml(s.classId)}" data-cell-incomplete="${s.incompleteCount}" data-cell-perfunctory="${s.perfunctoryCount}">
    <td>${escapeHtml(s.studentNo)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.classId)}</td>
    <td><span style="color:var(--danger);font-weight:600">未上交 ${s.incompleteCount}</span></td>
    <td><span style="color:#E65100;font-weight:600">敷衍 ${s.perfunctoryCount}</span></td>
  </tr>`).join('');
  openModal(`
    <h3>⚠️ 作业异常学生（${list.length}人）</h3>
    <div style="margin-bottom:10px;font-size:13px;color:var(--text-muted)">未上交或敷衍完成累计 ≥2 次，点击某一行可查看具体作业明细</div>
    <div class="table-wrap" style="max-height:380px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
          <th data-click="__sortModalTable" data-sort-key="incomplete">未上交</th>
          <th data-click="__sortModalTable" data-sort-key="perfunctory">敷衍</th>
        </tr></thead>
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
  let colorMain = isUp ? '#2E7D32' : (isDown ? '#C62828' : 'var(--text-muted)');
  const sym = isUp ? '↑' : (isDown ? '↓' : '→');
  const fmtNum = function(n) { return (n == null || n === 999) ? '<span style="color:var(--text-muted)">—</span>' : n; };
  const fmtRank = function(n) { return (n == null || n === 999) ? '<span style="color:var(--text-muted)">—</span>' : '第 ' + n + ' 名'; };
  const fmtDiff = function(n, suffix) {
    if (n == null || n === 0) return '<span style="color:var(--text-muted)">—</span>';
    let sign = n > 0 ? '+' : '';
    let cls = n > 0 ? 'color:#2E7D32' : 'color:#C62828';
    return '<span style="' + cls + ';font-weight:600">' + sign + n + (suffix||'') + '</span>';
  };
  const fmtScoreDiff = function(n) {
    if (n == null) return '<span style="color:var(--text-muted)">—</span>';
    const sign = n > 0 ? '+' : '';
    let cls = n > 0 ? 'color:#2E7D32' : n < 0 ? 'color:#C62828' : 'color:var(--text-muted)';
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
  let layerChangeCell = '<span style="color:var(--text-muted)">—</span>';
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
    '<div style="margin:8px 0 12px;font-size:13px;color:var(--text-muted)">班级：' + escapeHtml(classId) + ' | 变动：<span style="color:' + colorMain + ';font-weight:600">' + escapeHtml(typeNames[type]) + ' ' + sym + '</span></div>' +
    '<div class="table-wrap" style="max-height:380px;overflow:auto;border:1px solid var(--border);border-radius:6px">' +
      '<table class="task-table" style="width:100%">' +
        '<thead><tr>' +
          '<th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px">维度</th>' +
          '<th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px;color:var(--text-muted)">上次 · ' + escapeHtml(p.prevExam || '—') + '</th>' +
          '<th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px">本次 · ' + escapeHtml(exam) + '</th>' +
          '<th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px">变化</th>' +
        '</tr></thead>' +
        '<tbody>' +
          '<tr><td style="padding:8px">分数</td><td style="padding:8px;color:var(--text-muted)">' + fmtNum(prevRec && prevRec.score) + '</td><td style="padding:8px"><strong style="font-size:15px">' + fmtNum(currRec && currRec.score) + '</strong></td><td style="padding:8px">' + fmtScoreDiff(p.scoreDiff) + '</td></tr>' +
          '<tr><td style="padding:8px">班级排名</td><td style="padding:8px;color:var(--text-muted)">' + fmtRank(prevRec && prevRec.classRank) + '</td><td style="padding:8px">' + fmtRank(currRec && currRec.classRank) + '</td><td style="padding:8px">' + fmtDiff(p.classRankDiff, ' 名') + '</td></tr>' +
          '<tr><td style="padding:8px">级部排名</td><td style="padding:8px;color:var(--text-muted)">' + fmtRank(prevRec && prevRec.gradeRank) + '</td><td style="padding:8px">' + fmtRank(currRec && currRec.gradeRank) + '</td><td style="padding:8px">' + fmtDiff(p.gradeRankDiff, ' 名') + '</td></tr>' +
          '<tr><td style="padding:8px">分层</td><td style="padding:8px">' + getScoreLayerLabel(prevScoreLayer) + '</td><td style="padding:8px">' + getScoreLayerLabel(currScoreLayer) + '</td><td style="padding:8px">' + layerChangeCell + '</td></tr>' +
          '<tr><td style="padding:8px;color:var(--text-muted)">班级均分</td><td style="padding:8px;color:var(--text-muted)">' + (prevAvg == null ? '—' : prevAvg.toFixed(2)) + '</td><td style="padding:8px">' + (currAvg == null ? '—' : currAvg.toFixed(2)) + '</td><td style="padding:8px;color:var(--text-muted)">背景参考</td></tr>' +
        '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="margin-top:12px;padding:12px;background:var(--bg-hover);border-radius:6px;font-size:13px;line-height:1.6">' +
      '<div style="font-weight:600;margin-bottom:6px;color:var(--text-heading)">📊 趋势概览</div>' +
      '<div>' + summary + '</div>' +
      '<div style="margin-top:4px;color:var(--text-muted)">该生历次考试成绩记录共 <strong>' + totalExams + '</strong> 条</div>' +
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
  const rows = students.map(st => `<tr data-cell-studentNo="${escapeHtml(st.studentNo)}" data-cell-name="${escapeHtml(st.name)}" data-cell-classId="${escapeHtml(st.classId)}"><td>${escapeHtml(st.studentNo)}</td><td>${escapeHtml(st.name)}</td><td>${escapeHtml(st.classId)}</td></tr>`).join('');
  openModal(`
    <h3>📋 ${statusMap[status] || status}（${students.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
        </tr></thead>
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
  const rows = matched.map(m => `<tr data-cell-studentNo="${escapeHtml(m.studentNo)}" data-cell-name="${escapeHtml(m.name)}" data-cell-classId="${escapeHtml(m.classId)}" data-cell-score="${m.score}" data-cell-classRank="${m.classRank!=null?m.classRank:''}" data-cell-gradeRank="${m.gradeRank!=null?m.gradeRank:''}" data-cell-diff="${m.diff!=null?m.diff:''}"><td>${escapeHtml(m.studentNo)}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.classId)}</td><td><strong>${m.score}</strong></td><td>${m.classRank||'-'}</td><td>${m.gradeRank||'-'}</td><td>${m.diff>=0?'+':''}${m.diff}</td></tr>`).join('');
  openModal(`
    <h3>📈 ${labelMap[cat] || cat}（${matched.length}人）· ${escapeHtml(exam)}</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
          <th data-click="__sortModalTable" data-sort-key="score">成绩</th>
          <th data-click="__sortModalTable" data-sort-key="classRank">班排</th>
          <th data-click="__sortModalTable" data-sort-key="gradeRank">级排</th>
          <th data-click="__sortModalTable" data-sort-key="diff">级排变化</th>
        </tr></thead>
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
    return `<tr data-cell-studentNo="${escapeHtml(stu ? stu.studentNo : (s.studentNo || '-'))}" data-cell-name="${escapeHtml(stu ? stu.name : (s.name || '-'))}" data-cell-classId="${escapeHtml(s.classId || '-')}" data-cell-score="${s.score}" data-cell-classRank="${s.classRank!=null?s.classRank:''}" data-cell-gradeRank="${s.gradeRank!=null?s.gradeRank:''}"><td>${escapeHtml(stu ? stu.studentNo : (s.studentNo || '-'))}</td><td>${escapeHtml(stu ? stu.name : (s.name || '-'))}</td><td>${escapeHtml(s.classId || '-')}</td><td><strong>${s.score}</strong></td><td>${s.classRank || '-'}</td><td>${s.gradeRank || '-'}</td></tr>`;
  }).join('');
  openModal(`
    <h3>🎯 ${escapeHtml(title)} · ${escapeHtml(exam)}（${matched.length}人）</h3>
    <div class="table-wrap" style="max-height:400px;overflow:auto">
      <table class="task-table" style="width:100%">
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
          <th data-click="__sortModalTable" data-sort-key="score">成绩</th>
          <th data-click="__sortModalTable" data-sort-key="classRank">班排</th>
          <th data-click="__sortModalTable" data-sort-key="gradeRank">级排</th>
        </tr></thead>
        <tbody>${matched.length > 0 ? rows : '<tr><td colspan="6" class="empty-state">暂无学生</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

// 弹窗内表格就地排序：点击带 data-sort-key 的 <th> 时，对该表格 <tbody> 的行按 data-cell-* 排序
function __sortModalTable(colKey) {
  const th = this;
  if (!colKey) colKey = th.getAttribute('data-sort-key');
  if (!colKey) return;
  const table = th.closest('table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;
  const dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
  table.querySelectorAll('th[data-sort-key]').forEach(function (h) {
    const label = h.getAttribute('data-sort-label') || h.textContent.replace(/[↑↓]\s*$/, '');
    h.setAttribute('data-sort-label', label);
    h.textContent = (h === th) ? (label + (dir === 'asc' ? ' ↑' : ' ↓')) : label;
  });
  th.setAttribute('data-sort-dir', dir);
  rows.sort(function (a, b) {
    let va = a.getAttribute('data-cell-' + colKey);
    let vb = b.getAttribute('data-cell-' + colKey);
    if (va == null) va = '';
    if (vb == null) vb = '';
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '') { va = na; vb = nb; }
    const cmp = va > vb ? 1 : (va < vb ? -1 : 0);
    return dir === 'asc' ? cmp : -cmp;
  });
  rows.forEach(function (r) { tbody.appendChild(r); });
}

// 趋势类标签（波动明显/稳步上升/稳居前列）弹窗：列出该生历次考试明细
function renderTrendDetail(studentId, type, stu, exam) {
  const trend = getStudentRankTrendUpTo(studentId, 'gradeRank', exam);
  const scores = trend.scores || [];
  if (scores.length === 0) { showToast('该生暂无考试记录', 'warn'); return; }
  const rows = scores.map(s => {
    const layer = scoreToLayer(s.score);
    return `<tr data-cell-exam="${escapeHtml(s.examName)}" data-cell-score="${s.score != null ? s.score : ''}" data-cell-classRank="${s.classRank || ''}" data-cell-gradeRank="${s.gradeRank || ''}" data-cell-layer="${layer}"><td>${escapeHtml(s.examName)}</td><td>${s.score != null ? s.score : '-'}</td><td>${s.classRank || '-'}</td><td>${s.gradeRank || '-'}</td><td><span style="background:${ LAYER_COLORS_SCORE[layer] || '#9E9E9E' };color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">${layer}层</span></td></tr>`;
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
    <div style="margin:8px 0 12px;font-size:13px;color:var(--text-muted)">班级：${escapeHtml(stu.classId || '')} | 截至考试：${escapeHtml(exam)}</div>
    <div class="table-wrap" style="max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:6px">
      <table class="task-table" style="width:100%">
        <thead><tr><th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px;cursor:pointer;user-select:none" data-click="__sortModalTable" data-sort-key="exam">考试</th><th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px;cursor:pointer;user-select:none" data-click="__sortModalTable" data-sort-key="score">成绩</th><th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px;cursor:pointer;user-select:none" data-click="__sortModalTable" data-sort-key="classRank">班排</th><th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px;cursor:pointer;user-select:none" data-click="__sortModalTable" data-sort-key="gradeRank">级排</th><th style="background:var(--bg-hover);text-align:left;font-size:12px;padding:8px;cursor:pointer;user-select:none" data-click="__sortModalTable" data-sort-key="layer">分层</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;padding:12px;background:var(--bg-hover);border-radius:6px;font-size:13px;line-height:1.6">${summary}</div>
    <div class="modal-actions"><button class="btn btn-outline" data-click="closeModal">关闭</button></div>
  `);
}

function renderLayerBars(counts, isScoreMode) {
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const items = isScoreMode
    ? [
        { label:'A+层(83-100分)', count:counts['A+'], color:'#4A148C', layer:'A+' },
        { label:'A层(76-82分)', count:counts['A'], color:'#6A1B9A', layer:'A' },
        { label:'B+层(59-75分)', count:counts['B+'], color:'#00695C', layer:'B+' },
        { label:'B层(45-58分)', count:counts['B'], color:'#00796B', layer:'B' },
        { label:'C+层(30-44分)', count:counts['C+'], color:'#AD1457', layer:'C+' },
        { label:'C层(<30分)', count:counts['C'], color:'#C2185B', layer:'C' }
      ]
    : [
        { label:'A层(1-15名)', count:counts.A, color:'var(--success)' },
        { label:'B层(16-30名)', count:counts.B, color:'var(--info)' },
        { label:'C层(31-45名)', count:counts.C, color:'var(--warning)' },
        { label:'D层(46名+)', count:counts.D, color:'var(--danger)' }
      ];
  return items.map(i => {
    const pct = total ? Math.round(i.count/total*100) : 0;
    const clickable = (isScoreMode && i.layer)
      ? `style="cursor:pointer" data-click="showLayerStudents" data-click-args="[&quot;${i.layer}&quot;]" title="点击查看 ${i.label} 学生名单"`
      : '';
    return `<div class="bar-chart-row" ${clickable}>
      <div class="bar-chart-label"><span>${i.label}</span><span>${i.count}人 (${pct}%)</span></div>
      <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${pct}%;background:${i.color}">${pct}%</div></div>
    </div>`;
  }).join('');
}

function renderProgressBar(label, count, color, cat) {
  const clickable = cat ? `style="cursor:pointer" data-click="showProgressCategoryStudents" data-click-args="[&quot;${cat}&quot;]" title="点击查看 ${label} 学生名单"` : '';
  return `<div style="text-align:center;min-width:100px">
    <div style="font-size:24px;font-weight:700;color:${color}" ${clickable}>${count}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${label}</div>
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
  // Layer change — 按成绩分层（scoreToLayer）比较，与页面上展示的分层口径一致
  const _layerOrder = { 'A+':6, 'A':5, 'B+':4, 'B':3, 'C+':2, 'C':1, '—':0 };
  const prevLayer = scoreToLayer(prev.score);
  const currLayer = scoreToLayer(curr.score);
  const prevOrd = _layerOrder[prevLayer] || 0;
  const currOrd = _layerOrder[currLayer] || 0;
  let layerChange = 'same';
  if (currOrd > prevOrd) layerChange = 'up';
  else if (currOrd < prevOrd) layerChange = 'down';
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
        <span style="color:var(--text-muted);font-size:12px">（排名差: ${summary.diff > 0 ? '+' + summary.diff : summary.diff}）</span>
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
        <span style="color:var(--text-muted);font-size:12px">（排名差: ${summary.diff > 0 ? '+' + summary.diff : summary.diff}）</span>
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
  // 预计算分层变动/进退步，供「分层变动」「进退步」列排序使用
  examined.forEach(s => {
    const prog = getScoreProgress(s.studentId, selectedExam) || {};
    s._layerChange = prog.layerChange || '';
    s._progressLabel = prog.progressLabel || '';
  });
  examined.sort((a, b) => {
    let va, vb;
    switch (sort.col) {
      case 'name': {
        const sa = state.students.find(st => st.id === a.studentId);
        const sb = state.students.find(st => st.id === b.studentId);
        va = sa ? sa.name : ''; vb = sb ? sb.name : '';
      } break;
      case 'classId': va = a.classId || ''; vb = b.classId || ''; break;
      case 'studentNo':
        { const sa = state.students.find(st => st.id === a.studentId); const sb = state.students.find(st => st.id === b.studentId); va = sa ? sa.studentNo : ''; vb = sb ? sb.studentNo : '';
        const na = parseInt(va.replace(/\D/g,'')) || 0;
        const nb = parseInt(vb.replace(/\D/g,'')) || 0;
        va = na; vb = nb; }
        break;
      case 'score': va = a.score; vb = b.score; break;
      case 'classRank': va = a.classRank || 999; vb = b.classRank || 999; break;
      case 'gradeRank': va = a.gradeRank || 999; vb = b.gradeRank || 999; break;
      case 'layer': { const lo = {'A+':6,'A':5,'B+':4,'B':3,'C+':2,'C':1}; va = lo[scoreToLayer(a.score)] || 0; vb = lo[scoreToLayer(b.score)] || 0; } break;
      case 'layerChange': { const lm = {'up':3,'flat':2,'down':1,'':0}; va = lm[a._layerChange] || 0; vb = lm[b._layerChange] || 0; } break;
      case 'progress': { const pm = {'明显进步':5,'小幅进步':4,'持平':3,'小幅退步':2,'明显退步':1,'首次':0,'':0}; va = pm[a._progressLabel] || 0; vb = pm[b._progressLabel] || 0; } break;
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
          <th class="${thClass('name')}" data-click="setScoreSort" data-click-args="[&quot;name&quot;]">姓名</th>
          <th class="${thClass('classId')}" data-click="setScoreSort" data-click-args="[&quot;classId&quot;]">班级</th>
          <th class="${thClass('score')}" data-click="setScoreSort" data-click-args="[&quot;score&quot;]">成绩</th>
          <th class="${thClass('classRank')}" data-click="setScoreSort" data-click-args="[&quot;classRank&quot;]">班排</th>
          <th class="${thClass('gradeRank')}" data-click="setScoreSort" data-click-args="[&quot;gradeRank&quot;]">级排</th>
          <th class="${thClass('layer')}" data-click="setScoreSort" data-click-args="[&quot;layer&quot;]">分层</th><th class="${thClass('layerChange')}" data-click="setScoreSort" data-click-args="[&quot;layerChange&quot;]">分层变动</th><th class="${thClass('progress')}" data-click="setScoreSort" data-click-args="[&quot;progress&quot;]">进退步</th><th>操作</th>
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
              ? `<span style="background:${ LAYER_COLORS_SCORE[prevLayer] || '#9E9E9E' };color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600" title="上次考试：${escapeAttr(prevScores[0].examName)}（${prevScores[0].score}分）">${prevLayer}层</span>`
              : '<span style="color:var(--text-muted);font-style:italic">未分层</span>';
            return `<tr style="opacity:0.6;background:var(--bg-hover)">
              <td><input type="checkbox" class="score-del-cb" disabled style="opacity:0.35;cursor:not-allowed"></td>
              <td>${escapeHtml(studentNo)}</td>
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.classId)}</td>
              <td><span style="color:var(--text-muted);font-style:italic">未考试</span></td>
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
            <td><span style="background:${ LAYER_COLORS_SCORE[layer] || '#9E9E9E' };color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">${layer}层</span></td>
            <td>${layerChangeBadge}</td>
            <td>${progressBadge}${progress.gradeRankDiff !== undefined ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">级排${progress.gradeRankDiff>=0?'+':''}${progress.gradeRankDiff}</div>` : ''}</td>
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
    dir = (col === 'studentNo' || col === 'classRank' || col === 'gradeRank' || col === 'name' || col === 'classId') ? 'asc' : 'desc';
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
    { label:'83-100分 (A+层)', key:'ap', color:'var(--success)' },
    { label:'76-82分 (A层)', key:'a', color:'#4CAF50' },
    { label:'59-75分 (B+层)', key:'bp', color:'var(--info)' },
    { label:'45-58分 (B层)', key:'b', color:'#2196F3' },
    { label:'30-44分 (C+层)', key:'cp', color:'var(--warning)' },
    { label:'30分以下 (C层)', key:'c', color:'var(--danger)' }
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
      return `<tr data-cell-studentNo="${escapeHtml(stu ? stu.studentNo : (s.studentNo || '-'))}" data-cell-name="${escapeHtml(stu ? stu.name : (s.name || '-'))}" data-cell-classId="${escapeHtml(s.classId || '-')}" data-cell-score="${s.score}" data-cell-classRank="${s.classRank!=null?s.classRank:''}" data-cell-gradeRank="${s.gradeRank!=null?s.gradeRank:''}">
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
        <thead><tr>
          <th data-click="__sortModalTable" data-sort-key="studentNo">学号</th>
          <th data-click="__sortModalTable" data-sort-key="name">姓名</th>
          <th data-click="__sortModalTable" data-sort-key="classId">班级</th>
          <th data-click="__sortModalTable" data-sort-key="score">成绩</th>
          <th data-click="__sortModalTable" data-sort-key="classRank">班排</th>
          <th data-click="__sortModalTable" data-sort-key="gradeRank">级排</th>
        </tr></thead>
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
    checkboxesHtml += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">任教班级</div>';
    checkboxesHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">';
    checkboxesHtml += mineEntry.map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;padding:2px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"><input type="checkbox" class="entryClassCb" value="${escapeAttr(c)}" checked> ${escapeHtml(c)}</label>`).join('');
    checkboxesHtml += '</div>';
  }
  if (otherEntry.length > 0) {
    checkboxesHtml += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">其他班级（仅成绩）</div>';
    checkboxesHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">';
    checkboxesHtml += otherEntry.map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;padding:2px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"><input type="checkbox" class="entryClassCb" value="${escapeAttr(c)}"> ${escapeHtml(c)}</label>`).join('');
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
    document.getElementById('entryStudentList').innerHTML = '<div class="empty-state" style="padding:12px"><span class="emoji">⚠️</span><p style="font-size:13px;color:var(--text-muted)">请至少选择一个班级</p></div>';
    return;
  }
  const list = document.getElementById('entryStudentList');
  let html = '';
  let totalStudents = 0;
  classes.forEach(cls => {
    const students = state.students.filter(s => s.classId === cls);
    totalStudents += students.length;
    html += `<div style="font-size:13px;font-weight:600;margin:8px 0 4px;padding:4px 8px;background:var(--bg-hover);border-radius:var(--radius-sm)">📌 ${escapeHtml(cls)}（${students.length}人）</div>`;
    if (students.length === 0) {
      html += `<div class="empty-state" style="padding:8px"><span class="emoji">📋</span><p style="font-size:12px;color:var(--text-muted);margin:2px 0">${isMyClass(cls) ? '该班级暂无注册学生，请先新增学生' : '非任教班级无学生档案'}</p></div>`;
    } else {
      students.forEach((s, i) => {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;padding:2px 4px">
          <span style="width:24px;color:var(--text-muted);font-size:12px">${i+1}.</span>
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

