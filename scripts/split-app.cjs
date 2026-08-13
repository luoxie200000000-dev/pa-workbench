/**
 * split-app.cjs — 将 src/app.js 按功能段落拆分为 src/modules/ 下的独立片段
 *
 * 使用方式：node scripts/split-app.cjs
 *
 * 拆分策略：基于代码中的 /* ==== 段落标记，在自然边界处切割。
 * 每个片段是 IIFE 体内的一段代码，拼接后与原始 app.js 逐行一致。
 * 仅需运行一次；后续编辑直接在 src/modules/ 下操作，用 concat-modules.cjs 重新拼接。
 */
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'src', 'app.js');
const modulesDir = path.join(__dirname, '..', 'src', 'modules');

// 模块定义：[文件名, 起始行, 结束行]（1-based，闭区间）
const MODULES = [
  ['00-header',              1,     3],   // IIFE 开头
  ['01-constants',           4,    54],   // 班级常量
  ['02-tauri-db',           55,   181],   // Tauri SQLite 基础设施
  ['03-state',             182,   744],   // 状态管理 + undo/redo + SQLite 加载
  ['04-cloud-sync',        745,  1061],   // S3 云同步
  ['05-close-confirm',    1062,  1315],   // 关闭确认弹窗
  ['06-local-file-sync',  1316,  1715],   // 本地文件同步
  ['07-sample-data',      1716,  1926],   // 示例数据
  ['08-utils',            1927,  1972],   // 工具函数
  ['09-theme-runtime',    1973,  2369],   // 主题 + 运行状态面板
  ['10-data-manager',     2370,  3985],   // 数据导入/导出/合并 + UI模式 + 手机适配
  ['11-auth',             3986,  4443],   // 密码哈希 & 认证
  ['12-tasks-plan',       4444,  5109],   // 任务列表 + 教学计划
  ['13-schedule-progress', 5110, 6202],   // 智能课表 + 教学进度
  ['14-students',         6203,  8254],   // 学生档案 + 学生任务
  ['15-analysis',         8255, 10278],   // 学情分析
  ['16-quick-tools',     10279, 10826],   // 快捷工具（提醒/Skill/IMA/每日练习）
  ['17-desktop-version', 10827, 11147],   // 桌面快捷方式 + 时钟 + 版本管理
  ['18-notifications-misc',11148,11329],  // 通知弹窗 + 独立HTML + 刘海切换
  ['19-init',            11330, 11749],   // 应用初始化
  ['20-xiuxian',         11750, 13551],   // 修仙游戏模块
  ['21-export-map',      13552, 13814],   // _exportMap 导出
  ['22-event-delegation',13815, 14509],   // 事件委托 + 动作面板
  ['99-footer',          14510, 14510],   // IIFE 闭合
];

// --- 执行 ---
const content = fs.readFileSync(appJsPath, 'utf-8');
const lines = content.split('\n');

// 边界校验
const totalLines = lines.length;
const lastEnd = MODULES[MODULES.length - 1][2];
if (lastEnd !== totalLines) {
  console.error(`[ERROR] 最后一个模块结束行 ${lastEnd} != 文件总行数 ${totalLines}`);
  process.exit(1);
}

// 检查模块连续性
for (let i = 1; i < MODULES.length; i++) {
  const prevEnd = MODULES[i - 1][2];
  const currStart = MODULES[i][1];
  if (currStart !== prevEnd + 1) {
    console.error(`[ERROR] 模块 ${MODULES[i][0]} 起始行 ${currStart} != 前一模块结束行 ${prevEnd} + 1`);
    process.exit(1);
  }
}

// 创建目录
if (!fs.existsSync(modulesDir)) {
  fs.mkdirSync(modulesDir, { recursive: true });
}

// 写入每个模块
let totalOutputLines = 0;
MODULES.forEach(([name, start, end]) => {
  const slice = lines.slice(start - 1, end); // 0-based slice
  const code = slice.join('\n');
  const filePath = path.join(modulesDir, `${name}.js`);

  // 添加文件头注释（不影响拼接，因为拼接时会去掉）
  const header = `// >>> ${name}.js (L${start}-L${end}, ${end - start + 1} lines)\n`;
  fs.writeFileSync(filePath, code + '\n', 'utf-8');

  const lineCount = end - start + 1;
  totalOutputLines += lineCount;
  console.log(`  ${name.padEnd(24)} L${String(start).padStart(5)}-L${String(end).padStart(5)}  (${lineCount} lines)`);
});

console.log(`\nDone! Split ${totalLines} lines into ${MODULES.length} modules in src/modules/`);
console.log(`Total output lines: ${totalOutputLines}`);
