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
    return '<tr><td><code style="background:var(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + cat.label + '</code></td><td class="size-col">' + counts[cat.key] + ' 条</td></tr>';
  }).join('');
  if (!detailRows) detailRows = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:12px">暂无数据</td></tr>';

  return '<div class="status-section">' +
    '<div class="status-section-title">📤 导出当前数据</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">将当前工作台的所有数据导出为 JSON 备份文件，可用于迁移、备份或与其他设备合并。</div>' +
    '<table class="status-table"><thead><tr><th>数据类别</th><th class="size-col">数量</th></tr></thead><tbody>' + detailRows + '</tbody></table>' +
    '<div style="margin-top:12px;padding:10px;background:var(--bg-app);border-radius:var(--radius-sm);font-size:12px">' +
    '📊 共 <strong>' + totalItems + '</strong> 条数据 | 导出时间：' + new Date().toLocaleString('zh-CN') + '</div>' +
    '<button class="btn" style="margin-top:12px;width:100%;background:var(--primary);color:#fff;border:none;padding:10px;font-size:14px" data-click="doExportData">📤 导出为 JSON 文件</button>' +
    '</div>';
}

function renderImportTab() {
  return '<div class="status-section">' +
    '<div class="status-section-title">📥 导入数据</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">从 JSON 备份文件导入数据。<strong style="color:var(--danger)">覆盖模式</strong>会替换当前所有数据；建议先导出当前数据作为备份。</div>' +
    '<div id="importFileArea" style="border:2px dashed var(--border);border-radius:var(--radius);padding:24px;text-align:center;margin-bottom:12px">' +
    '<div style="font-size:32px;margin-bottom:8px">📂</div>' +
    '<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">点击选择或拖入 JSON 备份文件</div>' +
    '<input type="file" id="importFileInput" accept=".json" style="display:none" data-ev="change" data-ev-key="ev2">' +
    '<button class="btn" data-click="__dcClickEl" data-click-args="' + escapeAttr(JSON.stringify('importFileInput')) + '">选择文件</button>' +
    '</div>' +
    '<div id="importPreview"></div>' +
    '</div>';
}

function renderMergeTab() {
  return '<div class="status-section">' +
    '<div class="status-section-title">🔀 数据合并</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">导入一份备份数据，与当前数据进行对比合并。系统会列出相同项、差异项和各自独有的数据，你可以选择性地合并。</div>' +
    '<div id="mergeFileArea" style="border:2px dashed var(--border);border-radius:var(--radius);padding:24px;text-align:center;margin-bottom:12px">' +
    '<div style="font-size:32px;margin-bottom:8px">🔀</div>' +
    '<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">选择要合并的 JSON 备份文件</div>' +
    '<input type="file" id="mergeFileInput" accept=".json" style="display:none" data-ev="change" data-ev-key="ev3">' +
    '<button class="btn" data-click="__dcClickEl" data-click-args="' + escapeAttr(JSON.stringify('mergeFileInput')) + '">选择文件</button>' +
    '</div>' +
    '<div id="mergePreview"></div>' +
    '</div>';
}

function renderCategoryDetail(catKey, count) {
  const cat = DATA_CATEGORIES.find(function(c) { return c.key === catKey; });
  if (!cat) return '<div style="color:var(--text-muted)">未知类别</div>';
  let arr = state[catKey] || [];
  let rows = '';
  if (Array.isArray(arr) && arr.length > 0) {
    rows = arr.slice(0, 50).map(function(item) {
      let name = item[cat.nameField] || item.name || item.title || item.studentId || '(无名称)';
      let id = item[cat.idField] || item.id || '-';
      return '<tr><td style="font-size:12px">' + escapeHtml(String(name)) + '</td><td class="size-col" style="font-size:11px;color:var(--text-muted)">' + escapeHtml(String(id)) + '</td></tr>';
    }).join('');
    if (arr.length > 50) rows += '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:8px">... 还有 ' + (arr.length - 50) + ' 条</td></tr>';
  } else {
    rows = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:12px">暂无数据</td></tr>';
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
        return '<tr><td><code style="background:var(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + cat.label + '</code></td><td class="size-col">' + counts[cat.key] + ' 条</td></tr>';
      }).join('');

      const metaInfo = data._meta ? '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">导出时间：' + (data._meta.exportDate || '未知') + ' | 版本：' + (data._meta.appVersion || '未知') + '</div>' : '';

      document.getElementById('importPreview').innerHTML =
        '<div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-top:8px">' +
        '<div style="font-weight:600;margin-bottom:8px">📋 文件预览</div>' +
        metaInfo +
        '<table class="status-table"><thead><tr><th>数据类别</th><th class="size-col">数量</th></tr></thead><tbody>' + detailRows + '</tbody></table>' +
        '<div style="font-size:12px;margin-top:8px">共 ' + totalItems + ' 条数据</div></div>' +
        '<div style="margin-top:12px;padding:10px;background:#fff3cd;border-radius:var(--radius-sm);font-size:12px">' +
        '⚠️ <strong>覆盖导入</strong>将替换当前所有数据。建议先导出当前数据作为备份。</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn" style="flex:1;background:var(--danger);color:#fff;border:none;padding:10px" data-click="confirmImport">⚠️ 确认覆盖导入</button>' +
        '<button class="btn" style="flex:1;padding:10px" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['import'])) + '">取消</button></div>';
      window._pendingImportData = data;
    } catch(err) {
      document.getElementById('importPreview').innerHTML = '<div style="color:var(--danger);padding:12px">❌ 文件解析失败：' + escapeHtml(err.message) + '</div>';
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
          '<td><code style="background:var(--bg-app);padding:2px 6px;border-radius:3px;font-size:11px">' + cat.label + '</code></td>' +
          '<td style="text-align:center;color:var(--success)">' + r.same + '</td>' +
          '<td style="text-align:center;color:var(--warning)">' + r.different + '</td>' +
          '<td style="text-align:center;color:var(--text-muted)">' + r.onlyCurrent + '</td>' +
          '<td style="text-align:center;color:var(--primary)">' + r.onlyImported + '</td>' +
          '</tr>';
      }).join('');

      const summary = '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:var(--success-light, #e8f5e9);border-radius:var(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:var(--success)">' + totalSame + '</div><div style="font-size:11px;color:var(--text-muted)">相同项</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:var(--warning-light, #fff3cd);border-radius:var(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:var(--warning)">' + totalDiff + '</div><div style="font-size:11px;color:var(--text-muted)">差异项</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:var(--bg-app);border-radius:var(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:var(--text-muted)">' + totalOnlyCurrent + '</div><div style="font-size:11px;color:var(--text-muted)">仅当前有</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:var(--primary-lightest, #e3f2fd);border-radius:var(--radius-sm)">' +
        '<div style="font-size:20px;font-weight:700;color:var(--primary)">' + totalOnlyImported + '</div><div style="font-size:11px;color:var(--text-muted)">仅导入有</div></div>' +
        '</div>';

      document.getElementById('mergePreview').innerHTML =
        '<div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-top:8px">' +
        '<div style="font-weight:600;margin-bottom:8px">🔀 数据对比结果</div>' +
        summary +
        '<table class="status-table"><thead><tr><th>数据类别</th><th class="size-col">相同</th><th class="size-col">差异</th><th class="size-col">仅当前</th><th class="size-col">仅导入</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">' +
        '💡 <strong>相同</strong>：两边数据完全一致 | <strong>差异</strong>：同一 ID 但内容不同 | <strong>仅当前</strong>：只在当前数据中存在 | <strong>仅导入</strong>：只在导入文件中存在</div></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn" style="flex:1;background:var(--primary);color:#fff;border:none;padding:10px" data-click="confirmMerge" data-click-args="' + escapeAttr(JSON.stringify(['all'])) + '">合并全部（保留最新）</button>' +
        '<button class="btn" style="flex:1;padding:10px" data-click="confirmMerge" data-click-args="' + escapeAttr(JSON.stringify(['imported'])) + '">仅添加导入独有项</button>' +
        '<button class="btn" style="flex:1;padding:10px;background:var(--bg-app)" data-click="renderDataManager" data-click-args="' + escapeAttr(JSON.stringify(['merge'])) + '">取消</button></div>';
    } catch(err) {
      document.getElementById('mergePreview').innerHTML = '<div style="color:var(--danger);padding:12px">❌ 文件解析失败：' + escapeHtml(err.message) + '</div>';
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
    '.folder-toolbar{padding:12px 14px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap;}' +
    '.folder-breadcrumb{font-size:14px;color:var(--text-muted);display:flex;align-items:center;flex-wrap:wrap;gap:2px;}' +
    '.folder-breadcrumb .crumb-root{cursor:pointer;color:var(--primary);font-weight:600;}' +
    '.folder-breadcrumb .crumb{color:var(--text);}' +
    '.folder-breadcrumb .crumb-link{cursor:pointer;color:var(--primary);}' +
    '.folder-breadcrumb .crumb-link:hover{text-decoration:underline;color:var(--primary-darker);}' +
    '.folder-breadcrumb .crumb-sep{color:var(--text-muted);margin:0 4px;}' +
    '.folder-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
    '.folder-list{padding:0 4px 8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:var(--primary) #eee;box-shadow:inset -10px 0 8px -10px rgba(0,0,0,0.12);}' +
    '.folder-list::-webkit-scrollbar{height:9px;}' +
    '.folder-list::-webkit-scrollbar-thumb{background:var(--primary);border-radius:5px;}' +
    '.folder-list::-webkit-scrollbar-track{background:#eee;border-radius:5px;}' +
    '.folder-row{display:flex;align-items:center;gap:10px;padding:7px 36px 7px 10px;border-radius:4px;position:relative;min-width:520px;}' +
    '.folder-row:not(.folder-row-header){border-bottom:1px solid #f0f0f0;}' +
    '.folder-row:hover:not(.folder-row-header){background:#f5f7fa;}' +
    '.folder-row.selected{background:#e6f0ff !important;}' +
    '.folder-row-header{font-weight:600;color:#666;font-size:12px;padding:8px 10px;border-bottom:1px solid #e0e0e0;user-select:none;min-width:520px;box-sizing:border-box;}' +
    '.folder-row-header .folder-cell.name{cursor:pointer;}' +
    '.folder-row-header .folder-cell.date{cursor:pointer;}' +
    '.folder-row-header .folder-cell.name:hover,.folder-row-header .folder-cell.date:hover{color:var(--primary);}' +
    '.folder-cell.name{flex:1;min-width:120px;display:flex;align-items:center;gap:8px;overflow:hidden;white-space:nowrap;}' +
    '.folder-cell.date{width:150px;color:var(--text-muted);font-size:13px;flex-shrink:0;font-variant-numeric:tabular-nums;}' +
    '.folder-cell.type{width:200px;color:var(--text-muted);font-size:13px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:4px;}' +
    '.row-icon{flex:0 0 auto;font-size:16px;line-height:1;width:20px;text-align:center;}' +
    '.row-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);}' +
    '.row-subpath{display:block;font-size:11px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}' +
    '.row-menu-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:none;border:none;background:rgba(255,255,255,0.92);cursor:pointer;font-size:16px;line-height:1;padding:2px 8px;border-radius:4px;color:#777;box-shadow:0 1px 3px rgba(0,0,0,0.10);}' +
    '.folder-row:hover:not(.folder-row-header) .row-menu-btn{display:block;}' +
    '.row-menu-btn:hover{background:#e8e8e8;color:#111;}' +
    '@media (hover:none){.row-menu-btn{display:block !important;background:transparent;box-shadow:none;color:#999;}}' +
    '.btn-sm{padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;font-size:13px;}' +
    '.btn-sm:hover{background:var(--primary-lightest);}' +
    '.btn-sm.paste-active{background:var(--primary);color:#fff;border-color:var(--primary);}' +
    '.btn-sm.paste-active:hover{filter:brightness(1.06);}' +
    '.row-menu-pop{position:fixed;z-index:9999;min-width:150px;background:var(--surface,#fff);border:1px solid var(--border,#d0d0d0);border-radius:6px;box-shadow:0 6px 22px rgba(0,0,0,0.16);padding:4px 0;font-size:13px;}' +
    '.row-menu-pop .menu-item{padding:8px 14px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:8px;}' +
    '.row-menu-pop .menu-item:hover{background:var(--primary-lightest,#eef4ff);}' +
    '.row-menu-pop .menu-item.danger{color:#c0392b;}' +
    '.row-menu-pop .menu-item.danger:hover{background:#fdecea;}' +
    // 多选：行首复选框
    '.row-check{flex:0 0 auto;width:15px;height:15px;margin:0 2px 0 0;cursor:pointer;accent-color:var(--primary,#2f6fed);}' +
    '.folder-row-header .row-check{margin:0;}' +
    // 拖拽上传：拖入高亮 + 遮罩提示
    '.folder-list.drag-over{outline:2px dashed var(--primary,#2f6fed);outline-offset:-4px;background:#f3f8ff;border-radius:6px;}' +
    '.folder-dnd-hint{display:none;position:absolute;left:8px;right:8px;top:64px;bottom:8px;z-index:50;align-items:center;justify-content:center;pointer-events:none;border:2px dashed var(--primary,#2f6fed);border-radius:8px;background:rgba(238,244,255,0.85);color:var(--primary,#2f6fed);font-size:15px;font-weight:600;}' +
    '.folder-dnd-hint.show{display:flex;}' +
    // 批量操作栏
    '.folder-bulkbar{display:none;align-items:center;gap:8px;padding:6px 14px;background:var(--primary-lightest,#eef4ff);border-bottom:1px solid var(--border,#e0e0e0);font-size:13px;color:var(--text,#333);}' +
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
  return '<div style="display:flex;gap:8px;padding:3px 0"><div style="color:var(--text-muted);min-width:84px;flex-shrink:0">' + k + '</div><div style="flex:1;word-break:break-all">' + escapeHtml(String(v)) + '</div></div>';
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
    '<div style="font-size:16px;font-weight:700;color:var(--text-heading);margin-bottom:4px">选择显示模式</div>' +
    '<div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">当前：' + (cur === 'mobile' ? '📱 手机模式' : '💻 桌面模式') + '</div>' +
    '</div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:16px">';
  html += '<div class="mode-pick-card' + (cur==='desktop'?' mode-pick-active':'') + '" data-click="setUiMode" data-click-args="[&quot;desktop&quot;]" style="flex:1;cursor:pointer;border:2px solid ' + (cur==='desktop'?'var(--primary)':'var(--border-light)') + ';border-radius:12px;padding:20px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:36px;margin-bottom:8px">💻</div>' +
    '<div style="font-weight:700;font-size:15px;color:var(--text-heading)">桌面模式</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">适合电脑/平板</div>' +
    '</div>';
  html += '<div class="mode-pick-card' + (cur==='mobile'?' mode-pick-active':'') + '" data-click="setUiMode" data-click-args="[&quot;mobile&quot;]" style="flex:1;cursor:pointer;border:2px solid ' + (cur==='mobile'?'var(--primary)':'var(--border-light)') + ';border-radius:12px;padding:20px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:36px;margin-bottom:8px">📱</div>' +
    '<div style="font-weight:700;font-size:15px;color:var(--text-heading)">手机模式</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">适合手机/窄屏</div>' +
    '</div>';
  html += '</div>';
  html += '<div style="text-align:center;font-size:12px;color:var(--text-muted)">选择后随时可在「快捷工具 → 05模式切换」中更改</div>';
  openModal(html, { title: '模式切换', width: '420px' });
}
function showFirstLaunchModePicker() {
  let html = '<div style="text-align:center;padding:16px 0 8px">' +
    '<div style="font-size:40px;margin-bottom:12px">🧽</div>' +
    '<div style="font-size:18px;font-weight:700;color:var(--text-heading);margin-bottom:4px">欢迎使用派大星</div>' +
    '<div style="font-size:14px;color:var(--text-muted);margin-bottom:24px">请选择你喜欢的显示模式</div>' +
    '</div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:16px">';
  html += '<div class="mode-pick-card" data-click="setUiMode" data-click-args="[&quot;desktop&quot;]" style="flex:1;cursor:pointer;border:2px solid var(--border-light);border-radius:12px;padding:24px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:40px;margin-bottom:10px">💻</div>' +
    '<div style="font-weight:700;font-size:16px;color:var(--text-heading)">桌面模式</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:6px">适合电脑/平板<br>侧栏导航·宽屏布局</div>' +
    '</div>';
  html += '<div class="mode-pick-card" data-click="setUiMode" data-click-args="[&quot;mobile&quot;]" style="flex:1;cursor:pointer;border:2px solid var(--border-light);border-radius:12px;padding:24px 12px;text-align:center;transition:all 0.2s">' +
    '<div style="font-size:40px;margin-bottom:10px">📱</div>' +
    '<div style="font-weight:700;font-size:16px;color:var(--text-heading)">手机模式</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:6px">适合手机/窄屏<br>底部导航·触控优化</div>' +
    '</div>';
  html += '</div>';
  html += '<div style="text-align:center;font-size:12px;color:var(--text-muted)">选择后随时可在「快捷工具 → 05模式切换」中更改</div>';
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
