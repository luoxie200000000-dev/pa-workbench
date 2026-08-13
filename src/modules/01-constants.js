
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

