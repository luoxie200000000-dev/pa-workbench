const fs = require('fs');
const path = process.argv[2] || 'src/app.js';
const src = fs.readFileSync(path, 'utf8');
const n = src.length;
let i = 0, line = 1;
let st = 'CODE';            // CODE | TEMPLATE | EXPR | SINGLE | DOUBLE | LINE | BLOCK
let ret = 'CODE';           // 字符串/注释退出后返回的状态
let exprDepth = 0;
let prevToken = null;       // IDENT|NUM|RPAREN|RBRACK|RBRACE|OTHER
const hits = [];
let openCount = 0, closeCount = 0;

function isRegexNext() {
  // / 为正则的条件是：前一个有效 token 不是 标识符/数字/右括号/右方括号/右花括号
  return !(prevToken === 'IDENT' || prevToken === 'NUM' ||
           prevToken === 'RPAREN' || prevToken === 'RBRACK' || prevToken === 'RBRACE');
}

while (i < n) {
  if (src.startsWith('${escapeAttr', i)) {
    hits.push({ line, inT: (st === 'TEMPLATE' || st === 'EXPR') });
  }
  const c = src[i], nx = i + 1 < n ? src[i + 1] : '';

  if (st === 'LINE') {
    if (c === '\n') { st = ret; line++; }
    i++; continue;
  }
  if (st === 'BLOCK') {
    if (c === '\n') line++;
    if (c === '*' && nx === '/') { st = ret; i += 2; continue; }
    i++; continue;
  }
  if (st === 'SINGLE') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { st = ret; i++; continue; }
    i++; continue;
  }
  if (st === 'DOUBLE') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === '"') { st = ret; i++; continue; }
    i++; continue;
  }
  if (st === 'TEMPLATE') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { st = 'CODE'; closeCount++; i++; continue; }
    if (c === '$' && nx === '{') { st = 'EXPR'; exprDepth = 1; i += 2; continue; }
    i++; continue;
  }
  if (st === 'EXPR') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { st = 'TEMPLATE'; i++; continue; }      // 嵌套模板字面量
    if (c === "'") { st = 'SINGLE'; ret = 'EXPR'; i++; continue; }
    if (c === '"') { st = 'DOUBLE'; ret = 'EXPR'; i++; continue; }
    if (c === '/') {
      if (nx === '/') { st = 'LINE'; ret = 'EXPR'; i += 2; continue; }
      if (nx === '*') { st = 'BLOCK'; ret = 'EXPR'; i += 2; continue; }
      i++; continue;                                          // 除号
    }
    if (c === '{' || c === '(' || c === '[') { exprDepth++; i++; continue; }
    if (c === '}' || c === ')' || c === ']') {
      exprDepth--;
      if (exprDepth <= 0) st = 'TEMPLATE';
      i++; continue;
    }
    if (c === '$' && nx === '{') { exprDepth++; i += 2; continue; }
    i++; continue;
  }
  // ---- CODE ----
  if (c === '\n') { line++; i++; continue; }
  if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
  if (c === '/') {
    if (nx === '/') { st = 'LINE'; ret = 'CODE'; i += 2; continue; }
    if (nx === '*') { st = 'BLOCK'; ret = 'CODE'; i += 2; continue; }
    if (isRegexNext()) {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '\n') { j = i + 1; break; }
        if (src[j] === '/') { j++; while (j < n && /[a-z]/i.test(src[j])) j++; break; }
        j++;
      }
      i = Math.max(j, i + 1); continue;
    }
    i++; continue;
  }
  if (c === '`') { st = 'TEMPLATE'; openCount++; i++; continue; }
  if (c === "'") { st = 'SINGLE'; ret = 'CODE'; i++; continue; }
  if (c === '"') { st = 'DOUBLE'; ret = 'CODE'; i++; continue; }
  if (c === '$' && nx === '{') { i += 2; continue; }          // 孤立 ${
  if (/[A-Za-z_$]/.test(c)) {
    let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
    prevToken = 'IDENT'; i = j; continue;
  }
  if (/[0-9]/.test(c)) {
    let j = i; while (j < n && /[0-9._eExXa-fA-F]/.test(src[j])) j++;
    prevToken = 'NUM'; i = j; continue;
  }
  if (c === ')') { prevToken = 'RPAREN'; i++; continue; }
  if (c === ']') { prevToken = 'RBRACK'; i++; continue; }
  if (c === '}') { prevToken = 'RBRACE'; i++; continue; }
  prevToken = 'OTHER';
  i++; continue;
}

const inT = hits.filter(h => h.inT);
const notT = hits.filter(h => !h.inT);
console.log('文件末尾状态:', st, st === 'CODE' ? '✓' : '✗(应为 CODE)');
console.log('反引号配对: 开', openCount, '闭', closeCount, openCount === closeCount ? '✓平衡' : '✗失衡');
console.log('总 ${escapeAttr} 命中点:', hits.length);
console.log('在模板字面量内(原本正确):', inT.length);
console.log('  ', inT.map(h => 'L' + h.line).join(' '));
console.log('在普通串/代码内(疑似损坏):', notT.length);
console.log('  ', notT.map(h => 'L' + h.line).join(' '));
