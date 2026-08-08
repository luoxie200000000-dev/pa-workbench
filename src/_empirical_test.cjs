// 实证测试：抽出真实函数，在 Node 桩环境执行，看 ${escapeAttr(...)} 是否被插值
const fs = require('fs');
const src = fs.readFileSync('src/app.js', 'utf8');

function extractFunction(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('找不到函数 ' + name);
  // 从函数体第一个 { 开始，做花括号配平
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

// 通用桩
const sandbox = {
  console,
  document: { createElement: () => ({ set textContent(v){}, get innerHTML(){return ''} }) },
  window: {},
  state: { appPassword: null },
  openModal: (h) => { sandbox.__captured = h; },
  closeModal: () => {},
  escapeAttr: (s) => (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;'),
  escapeHtml: (s) => (s == null ? '' : String(s)),
};

function run(fnName, arg) {
  sandbox.__captured = null;
  const code = extractFunction(fnName) + '\n' + fnName + '(' + arg + ');';
  const fn = new Function(...Object.keys(sandbox), code);
  fn(...Object.values(sandbox));
  return sandbox.__captured;
}

const tests = [
  ['openPasswordModal', ''],
  ['renderPlanList', '[]'],
  ['renderTaskInfo', '{}'],
];

for (const [name, arg] of tests) {
  try {
    const html = run(name, arg);
    if (html == null) { console.log(`[${name}] 未捕获 HTML（可能执行未走到 openModal）`); continue; }
    const hasLiteral = html.includes('${escapeAttr');
    console.log(`\n=== ${name} ===`);
    console.log('含字面 ${escapeAttr ?', hasLiteral, hasLiteral ? '=> 损坏(普通串)' : '=> 已插值(模板字面量,正确)');
    // 打印含 ${escapeAttr 或 escapeAttr 的片段
    const idx = html.indexOf('escapeAttr');
    if (idx >= 0) console.log('片段:', html.slice(idx - 30, idx + 60).replace(/\n/g, ' '));
  } catch (e) {
    console.log(`\n=== ${name} === 执行出错:`, e.message.split('\n')[0]);
  }
}
