
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

// 分层标签颜色映射（全局共享，避免 inline 颜色对象导致成绩分层标签 fallback 灰色）
// 班级分层：绿蓝橙红（4 层）
const LAYER_COLORS_CLASS = { A:'#2E7D32', B:'#1565C0', C:'#E65100', D:'#C62828' };
// 成绩分层：紫青粉系（6 层，与班级分层色系完全不同）
const LAYER_COLORS_SCORE = { 'A+':'#4A148C', 'A':'#7B1FA2', 'B+':'#00695C', 'B':'#00838F', 'C+':'#AD1457', 'C':'#C2185B' };

// 通用：渲染分层徽章 HTML（深色背景 + 白字，圆角胶囊）
function renderLayerBadge(layer, isScoreMode) {
  if (!layer) return '<span class="text-muted">-</span>';
  const map = isScoreMode ? LAYER_COLORS_SCORE : LAYER_COLORS_CLASS;
  const bg = map[layer] || '#9E9E9E';
  return '<span style="background:' + bg + ';color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">' + layer + '层</span>';
}

