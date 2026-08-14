/* ===================== Sample Data ===================== */
function initSampleStudents() {
  const firstNames = '明华强磊静娜敏丽涛洋勇军杰平雪艳红伟刚芳秀娟超'.split('');
  const lastNames = '张李王赵陈刘杨黄周吴徐孙马朱胡郭高林何罗'.split('');
  const classes = getClasses();
  const layers = ['A','A','A','B','B','C','C','D']; // distribution
  const trends = ['稳步提升','小幅度进步','保持稳定','略有波动','需重点关注'];
  const tagPool = ['积极举手','实验能手','作业认真','需督促','理解力强','粗心','偏科','进步明显','纪律好','乐于助人'];

  state.students = [];
  let id = 1;
  classes.forEach(cls => {
    // 10 students per class as sample
    for (let i = 0; i < 10; i++) {
      const ln = lastNames[(id + i) % lastNames.length];
      const fn = firstNames[(id * 3 + i) % firstNames.length];
      const name = ln + fn;
      const layer = layers[(id * 7 + i) % layers.length];
      const trend = trends[(id * 5 + i) % trends.length];
      const tags = [];
      const tagCount = 2 + (id * 3 + i) % 3;
      for (let t = 0; t < tagCount; t++) tags.push(tagPool[(id * t + i) % tagPool.length]);
      const hwTotal = 8 + (id + i) % 5;
      const excellent = Math.floor(hwTotal * (layer === 'A' ? 0.5 : layer === 'B' ? 0.35 : layer === 'C' ? 0.2 : 0.1));
      const incomplete = Math.floor(hwTotal * (layer === 'D' ? 0.4 : layer === 'C' ? 0.25 : 0.1));
      const normal = hwTotal - excellent - incomplete;
      state.students.push({
        id: 's' + id,
        studentNo: (cls.replace('班','') * 100 + i + 1).toString(),
        name,
        gender: i % 2 === 0 ? '男' : '女',
        classId: cls,
        layer,
        scoreTrend: trend,
        tags: [...new Set(tags)],
        homeworkStats: { excellent, normal, incomplete },
        teacherNote: layer === 'D' ? '需加强课后辅导，关注学习习惯。' : '学习态度端正，继续保持。'
      });
      id++;
    }
  });
}

function generateSampleScores() {
  const scores = [];
  const exams = [
    { name:'第一章单元测', date:'2026-09-20' },
    { name:'期中考试', date:'2026-11-05' }
  ];
  let scId = 1;
  exams.forEach((exam, ei) => {
    state.students.forEach(s => {
      // Base score by layer, with variation
      const base = s.layer === 'A' ? 88 : s.layer === 'B' ? 76 : s.layer === 'C' ? 65 : 52;
      // Second exam: add some progress/regress
      const variation = (parseInt(s.id.replace('s','')) * 7 + ei * 13) % 21 - 10;
      const score = Math.max(20, Math.min(100, base + variation + (ei === 1 ? 3 : 0)));
      scores.push({
        id: 'sc' + scId++,
        studentId: s.id,
        name: s.name,
        classId: s.classId,
        score: score,
        examName: exam.name,
        date: exam.date
      });
    });
  });
  // Calculate ranks
  exams.forEach(exam => {
    const examScores = scores.filter(s => s.examName === exam.name);
    // Grade rank
    const gradeSorted = [...examScores].sort((a,b) => b.score - a.score);
    gradeSorted.forEach((s, i) => { s.gradeRank = i + 1; });
    // Class rank — 计算所有班级（含导入的非任教班级）
    const allCls = [...new Set(examScores.map(s => s.classId).filter(Boolean))];
    allCls.forEach(cls => {
      const classScores = examScores.filter(s => s.classId === cls).sort((a,b) => b.score - a.score);
      classScores.forEach((s, i) => { s.classRank = i + 1; });
    });
  });
  return scores;
}

function generateSampleHomeworkRecords() {
  const records = [];
  state.students.forEach((s, idx) => {
    state.studentTasks.slice(0, 3).forEach((task, tidx) => {
      if (!isTaskForClass(task, s.classId)) return;
      let status = 'normal';
      const rnd = Math.random();
      if (s.layer === 'A') status = rnd > 0.3 ? 'excellent' : 'normal';
      else if (s.layer === 'B') status = rnd > 0.5 ? 'normal' : (rnd > 0.2 ? 'excellent' : (rnd > 0.1 ? 'perfunctory' : 'incomplete'));
      else if (s.layer === 'C') status = rnd > 0.5 ? 'normal' : (rnd > 0.3 ? 'incomplete' : (rnd > 0.15 ? 'perfunctory' : 'resubmitted'));
      else status = rnd > 0.4 ? 'incomplete' : (rnd > 0.2 ? 'perfunctory' : 'resubmitted');
      const reviewStatus = isReviewLocked(status) ? 'pending' : isReviewHidden(status) ? 'reviewed' : 'pending';
      records.push({
        id: 'hr' + records.length,
        studentId: s.id,
        studentNo: s.studentNo,
        name: s.name,
        classId: s.classId,
        taskId: task.id,
        taskTitle: task.title,
        status,
        reviewStatus,
        review: status === 'incomplete' ? '' : status === 'perfunctory' ? '' : status === 'excellent' ? '完成质量高' : ''
      });
    });
  });
  return records;
}

function initSampleData() {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0,16);
  state.tasks = [
    { id:'t1', name:'备课：动物的主要类群（八上第一章）', desc:'准备课件、实验设计方案', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate(),8,0)), resp:'海绵宝宝', important:true, urgent:true, completed:false },
    { id:'t2', name:'批改1班单元测试卷', desc:'第一章单元测验，共45份', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate(),14,0)), resp:'派大星', important:true, urgent:true, completed:false },
    { id:'t3', name:'实验室器材检查：显微镜', desc:'检查10台显微镜是否正常', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1,10,0)), resp:'海绵宝宝', important:false, urgent:true, completed:false },
    { id:'t4', name:'整理10班错题集', desc:'第一章常见错题汇总', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+2,16,0)), resp:'派大星', important:true, urgent:false, completed:false },
    { id:'t5', name:'准备8班公开课课件', desc:'校级公开课：动物运动方式', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+3,9,0)), resp:'派大星', important:true, urgent:true, completed:false },
    { id:'t6', name:'教研组周会议纪要', desc:'整理本周教研记录', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()-1,15,0)), resp:'海绵宝宝', important:false, urgent:false, completed:true },
    { id:'t7', name:'编写期末复习计划', desc:'八年级上册复习方案', time:fmt(new Date(today.getFullYear(),today.getMonth(),today.getDate()+5,14,0)), resp:'派大星', important:true, urgent:false, completed:false }
  ];

  state.schedulePeriods = [
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
  state.scheduleDays = ['周一','周二','周三','周四','周五'];

  state.schedule = [
    { id:'s1', day:1, period:1, classId:'1班', subject:'早读' },
    { id:'s2', day:1, period:2, classId:'1班', subject:'生物' },
    { id:'s3', day:1, period:4, classId:'2班', subject:'生物' },
    { id:'s4', day:1, period:11, classId:'1班', subject:'晚自习' },
    { id:'s5', day:2, period:1, classId:'4班', subject:'早读' },
    { id:'s6', day:2, period:3, classId:'4班', subject:'生物' },
    { id:'s7', day:2, period:5, classId:'5班', subject:'生物' },
    { id:'s8', day:2, period:8, classId:'10班', subject:'生物' },
    { id:'s9', day:2, period:11, classId:'2班', subject:'晚自习' },
    { id:'s10', day:3, period:2, classId:'8班', subject:'生物' },
    { id:'s11', day:3, period:4, classId:'10班', subject:'生物' },
    { id:'s12', day:3, period:10, classId:'4班', subject:'晚自习' },
    { id:'s13', day:4, period:1, classId:'5班', subject:'早读' },
    { id:'s14', day:4, period:6, classId:'1班', subject:'生物' },
    { id:'s15', day:4, period:8, classId:'2班', subject:'生物' },
    { id:'s16', day:5, period:1, classId:'4班', subject:'早读' },
    { id:'s17', day:5, period:3, classId:'5班', subject:'生物' },
    { id:'s18', day:5, period:5, classId:'8班', subject:'生物' }
  ];

  state.adjustments = [
    { id:'a1', date:'2026-09-08', origDay:'周一', origPeriod:2, classId:'1班', newDay:'周二', newPeriod:3, reason:'教师培训', note:'调整至周二第3节' },
    { id:'a2', date:'2026-09-15', origDay:'周一', origPeriod:4, classId:'2班', newDay:'周三', newPeriod:5, reason:'运动会调课', note:'全校活动' },
    { id:'a3', date:'2026-09-22', origDay:'周二', origPeriod:1, classId:'4班', newDay:'周四', newPeriod:2, reason:'教研活动', note:'区教研统一调课' }
  ];

  state.plans = [
    { id:'p1', seq:1, name:'2026秋季学期教学计划', content:'八年级上册全册教学计划', endDate:'2027-01-10', resp:'派大星', startDate:'2026-09-01', items:12, uploadedAt:'2026-08-20' }
  ];

  initSampleStudents();

  state.studentTasks = [
    { id:'st1', title:'第一章课后练习', content:'完成课本P15-16练习1-5题，预习下一节', answer:'1. B  2. C  3. 腔肠动物  4. 外胚层、内胚层  5. 扁形动物身体背腹扁平', assignedDate:'2026-09-01', dueDate:'2026-09-03', classIds:['1班','2班'], classId:'1班' },
    { id:'st2', title:'显微镜观察实验报告', content:'填写实验报告单，绘制草履虫结构图', answer:'实验报告答案详见教师用书P28', assignedDate:'2026-09-05', dueDate:'2026-09-08', classIds:['4班','5班'], classId:'4班' },
    { id:'st3', title:'单元测试卷（一）', content:'完成第一章单元测试卷', answer:'答案已密封，请完成批阅后查看', assignedDate:'2026-09-10', dueDate:'2026-09-12', classIds:['8班','10班'], classId:'8班' }
  ];

  state.homeworkRecords = generateSampleHomeworkRecords();

  state.chatMessages = [
    { id:'cm1', classId:'1班', sender:'representative', name:'课代表-李明', content:'老师，今天的作业是练习册第5页吗？', time:'2026-09-01 16:30', type:'text', read:true },
    { id:'cm2', classId:'1班', sender:'teacher', name:'派大星', content:'是的，记得提醒同学们按时上交。', time:'2026-09-01 16:35', type:'text', read:true },
    { id:'cm3', classId:'2班', sender:'representative', name:'课代表-王芳', content:'老师，有3位同学请假，作业明天补交。', time:'2026-09-02 17:10', type:'text', read:false },
    { id:'cm4', classId:'4班', sender:'representative', name:'课代表-刘洋', content:'老师，作业收齐了，共48份。', time:'2026-09-03 17:00', type:'text', read:false },
    { id:'cm5', classId:'5班', sender:'representative', name:'课代表-张雨', content:'老师，第3题不太确定，能讲解一下吗？', time:'2026-09-03 18:20', type:'text', read:false }
  ];

  state.scores = generateSampleScores();

  state.progress = [
    { id:'pr1', week:1, date:'2026-09-01', classId:'1班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'completed', reflection:'学生参与度高，建议增加实物标本展示' },
    { id:'pr2', week:1, date:'2026-09-01', classId:'2班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'completed', reflection:'互动环节时间略紧，下次适当缩减导入部分' },
    { id:'pr3', week:1, date:'2026-09-02', classId:'4班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'in-progress', reflection:'' },
    { id:'pr4', week:1, date:'2026-09-02', classId:'5班', content:'动物的主要类群概述', chProgress:'第一章第1节', status:'completed', reflection:'' },
    { id:'pr5', week:1, date:'2026-09-03', classId:'8班', content:'腔肠动物和扁形动物', chProgress:'第一章第2节', status:'planned', reflection:'' },
    { id:'pr6', week:1, date:'2026-09-03', classId:'10班', content:'腔肠动物和扁形动物', chProgress:'第一章第2节', status:'planned', reflection:'' }
  ];

  state.reminders = [
    { id:'rm1', name:'每日批改提醒', schedule:'每天 16:00', desc:'提醒批改当日各班作业', active:true },
    { id:'rm2', name:'每周备课检查', schedule:'每周一 08:00', desc:'检查本周备课是否完成', active:true },
    { id:'rm3', name:'每周五教学进度同步', schedule:'每周五 15:00', desc:'同步本周教学进度并写反思', active:true },
    { id:'rm4', name:'月度成绩分析', schedule:'每月最后一天', desc:'生成月度成绩分析报告', active:false }
  ];

  saveState();
}

