const fs = require('fs');
const path = process.argv[2] || 'src/app.js';
const src = fs.readFileSync(path, 'utf8');
const n = src.length;
let i = 0, line = 1;
let mode = 'CODE';        // CODE | TEMPLATE | EXPR
let ret = 'CODE';         // 字符串/注释退出后的 mode
let tplParent = 'CODE';   // TEMPLATE 退出后的 mode
let exprDepth = 0;
let prevToken = null;
const hits = [];
let openCount = 0, closeCount = 0;

function isRegexNext() {
  return !(prevToken === 'IDENT' || prevToken === 'NUM' ||
           prevToken === 'RPAREN' || prevToken === 'RBRACK' || prevToken === 'RBRACE');
}

while (i < n) {
  if (src.startsWith('${escapeAttr', i)) {
    hits.push({ line, inT: (mode === 'TEMPLATE' || mode === 'EXPR') });
  }
  const c = src[i], nx = i + 1 < n ? src[i + 1] : '';

  if (mode === 'LINE') {
    if (c === '\n') { mode = ret; line++; }
    i++; continue;
  }
  if (mode === 'BLOCK') {
    if (c === '\n') line++;
    if (c === '*' && nx === '/') { mode = ret; i += 2; continue; }
    i++; continue;
  }
  if (mode === 'SINGLE') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { mode = ret; i++; continue; }
    i++; continue;
  }
  if (mode === 'DOUBLE') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === '"') { mode = ret; i++; continue; }
    i++; continue;
  }
  if (mode === 'TEMPLATE') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { mode = tplParent; closeCount++; i++; continue; }
    if (c === '$' && nx === '{') { mode = 'EXPR'; exprDepth = 1; i += 2; continue; }
    i++; continue;
  }
  if (mode === 'EXPR') {
    if (c === '\n') line++;
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { mode = 'TEMPLATE'; tplParent = 'EXPR'; openCount++; i++; continue; }
    if (c === "'") { mode = 'SINGLE'; ret = 'EXPR'; i++; continue; }
    if (c === '"') { mode = 'DOUBLE'; ret = 'EXPR'; i++; continue; }
    if (c === '/') {
      if (nx === '/') { mode = 'LINE'; ret = 'EXPR'; i += 2; continue; }
      if (nx === '*') { mode = 'BLOCK'; ret = 'EXPR'; i += 2; continue; }
      i++; continue; // 除号
    }
    if (c === '{' || c === '(' || c === '[') { exprDepth++; i++; continue; }
    if (c === '}' || c === ')' || c === ']') {
      exprDepth--;
      if (exprDepth <= 0) mode = 'TEMPLATE';
      i++; continue;
    }
    if (c === '$' && nx === '{') { exprDepth++; i += 2; continue; }
    i++; continue;
  }
  // CODE
  if (c === '\n') { line++; i++; continue; }
  if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
  if (c === '/') {
    if (nx === '/') { mode = 'LINE'; ret = 'CODE'; i += 2; continue; }
    if (nx === '*') { mode = 'BLOCK'; ret = 'CODE'; i += 2; continue; }
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
  if (c === '`') { mode = 'TEMPLATE'; tplParent = 'CODE'; openCount++; i++; continue; }
  if (c === "'") { mode = 'SINGLE'; ret = 'CODE'; i++; continue; }
  if (c === '"') { mode = 'DOUBLE'; ret = 'CODE'; i++; continue; }
  if (c === '$' && nx === '{') { i += 2; continue; }   // 孤立 ${
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
console.log('末尾状态:', mode, mode === 'CODE' ? 'OK' : '✗应为CODE');
console.log('反引号配对: 开', openCount, '闭', closeCount, openCount === closeCount ? '平衡' : '失衡');
console.log('总 ${escapeAttr} 命中点:', hits.length);
console.log('模板内(原本正确):', inT.length, '|', inT.map(h => 'L' + h.line).join(' '));
console.log('普通串内(疑似损坏):', notT.length, '|', notT.map(h => 'L' + h.line).join(' '));
