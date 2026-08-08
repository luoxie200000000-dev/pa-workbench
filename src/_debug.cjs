const fs = require('fs');
const src = fs.readFileSync('src/app.js', 'utf8');
const escapeAttr = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtml = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function extract(name) {
  const idx = src.indexOf('function ' + name + '(');
  let i = src.indexOf('{', idx);
  let depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } }
  return src.slice(idx, j + 1);
}
const full = extract('openPasswordModal');
console.log('full length', full.length);
console.log('---- head ----');
console.log(full.slice(0, 260));

const captured = [];
const handler = {
  has: () => true,
  get: (t, p) => {
    if (p === 'openModal') return (h) => { captured.push(h); console.log('>> openModal called, html len=', String(h).length, 'hasLiteral=', String(h).includes('${escapeAttr')); };
    if (p === Symbol.toPrimitive) return () => '';
    if (p === 'toString') return () => '';
    if (p === 'escapeAttr') return escapeAttr;
    if (p === 'escapeHtml') return escapeHtml;
    if (p === 'console') return console;
    if (p === 'JSON') return JSON; if (p === 'Math') return Math; if (p === 'Date') return Date;
    if (p === 'state') return { scores: [], tasks: [] };
    if (p === 'fmtDateTime') return () => '2026';
    if (p === 'sortableHeader') return () => '';
    if (p === 'pendingPage') return 'login';
    return new Proxy(function () {}, handler);
  },
  apply: () => new Proxy(function () {}, handler),
  construct: () => new Proxy(function () {}, handler),
  set: (t, p, v) => { if (p === 'innerHTML') console.log('>> innerHTML set, len=', String(v).length); return true; }
};
const sandbox = new Proxy(function () {}, handler);
const code = '(function(){\n with(this){\n' + full + '\n return openPasswordModal;\n }\n})';
const fn = (0, eval)(code).call(sandbox);
console.log('fn type', typeof fn);
const r = fn.call(sandbox);
console.log('return type', typeof r, r == null ? 'null' : ('len=' + String(r).length + ' hasLit=' + String(r).includes('${escapeAttr')));
console.log('captured count', captured.length);
