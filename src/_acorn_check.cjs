const fs = require('fs');
const acorn = require('acorn');
const src = fs.readFileSync('src/app.js', 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });

const broken = [];

function walk(node) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'Literal') {
    const v = node.value;
    if (typeof v === 'string' && v.includes('${escapeAttr')) {
      broken.push({ line: node.loc.start.line, value: v.slice(0, 90) });
    }
  }
  if (node.type === 'TemplateLiteral') {
    node.expressions.forEach(e => walk(e));
    return;
  }
  for (const k in node) {
    if (['loc', 'start', 'end', 'range', 'parent'].includes(k)) continue;
    const val = node[k];
    if (Array.isArray(val)) val.forEach(c => c && c.type && walk(c));
    else if (val && val.type) walk(val);
  }
}
walk(ast);

console.log('普通字符串字面量(Literal)内含字面 ${escapeAttr}（=真损坏）:', broken.length);
broken.forEach(b => console.log('  L' + b.line + ': ' + b.value));
console.log(broken.length === 0
  ? '★ 结论：原始文件无任何此类损坏，所有 escapeAttr 调用均在模板字面量内被正确插值。'
  : '▲ 发现损坏，需修复上述行。');
