/**
 * modernize-var.cjs — 将 src/modules/ 下的 var 声明现代化
 *
 * 阶段 1: var → let（安全：函数作用域内 let 与 var 行为一致）
 * 阶段 2: let → const（当变量在声明后从未被重新赋值时）
 *
 * 使用方式：node scripts/modernize-var.cjs
 * 验证方式：运行后执行 npm run build 确认无错误
 */
const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'src', 'modules');

// --- 阶段 1: var → let ---
function varToLet(code) {
  // \bvar\b 匹配关键字 var，不匹配变量名中的 "var"（如 variable）
  // 排除注释行中的 var（// 后面的 var）
  return code.replace(/(^|[^/])\bvar\b/g, (match, prefix) => {
    return prefix + 'let';
  });
}

// --- 阶段 2: let → const（当变量从未被重新赋值时） ---
function letToConst(code, fileName) {
  const lines = code.split('\n');
  const result = [];

  // 收集所有 let 声明的变量名及其行号
  const letDeclarations = []; // { name, lineIdx, col }

  lines.forEach((line, idx) => {
    // 匹配 let 声明: let name = ..., let name;, let a, b, c
    // 也匹配 for (let name = ...)
    const letRegex = /\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let match;
    while ((match = letRegex.exec(line)) !== null) {
      letDeclarations.push({ name: match[1], lineIdx: idx });
    }
  });

  // 对每个 let 变量，检查是否在后续代码中被重新赋值
  // 重新赋值的模式: name = ..., name++, name--, name += , name -= , etc.
  // 注意：声明行的 = 不算重新赋值
  const reassignedVars = new Set();

  letDeclarations.forEach(({ name, lineIdx }) => {
    // 检查声明行之后的所有行
    for (let i = lineIdx; i < lines.length; i++) {
      const line = lines[i];
      const checkLine = (i === lineIdx) ? line.substring(line.indexOf(name) + name.length) : line;

      // 检查重新赋值模式（排除 ===, ==, !=, !==）
      // name = (不是 == 或 ===)
      // name++
      // name--
      // name +=
      // name -=
      // name *=
      // name /=
      const assignRegex = new RegExp(
        '\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\+\\+|--|(\\+|-|\\*|/|%)=|=(?![=!]))'
      );

      if (assignRegex.test(checkLine)) {
        reassignedVars.add(name + ':' + lineIdx);
        break;
      }
    }
  });

  // 替换：未被重新赋值的 let → const
  lines.forEach((line, idx) => {
    let modified = line;
    letDeclarations.forEach(({ name, lineIdx }) => {
      if (idx !== lineIdx) return;
      if (reassignedVars.has(name + ':' + lineIdx)) return;

      // 替换该行的 let name → const name（只替换第一个匹配）
      const regex = new RegExp('\\blet\\s+(' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b');
      modified = modified.replace(regex, 'const $1');
    });
    result.push(modified);
  });

  return result.join('\n');
}

// --- 执行 ---
const files = fs.readdirSync(modulesDir)
  .filter(f => f.endsWith('.js'))
  .sort();

let totalVarCount = 0;
let totalLetCount = 0;
let totalConstCount = 0;

files.forEach(f => {
  const filePath = path.join(modulesDir, f);
  const original = fs.readFileSync(filePath, 'utf-8');

  // 统计原始 var 数量
  const varCount = (original.match(/\bvar\b/g) || []).length;
  totalVarCount += varCount;

  // 阶段 1: var → let
  const afterLet = varToLet(original);

  // 统计 let 数量
  const letCount = (afterLet.match(/\blet\b/g) || []).length;

  // 阶段 2: let → const（安全转换）
  const afterConst = letToConst(afterLet, f);

  // 统计最终 let 和 const 数量
  const finalLetCount = (afterConst.match(/\blet\b/g) || []).length;
  const finalConstCount = (afterConst.match(/\bconst\b/g) || []).length;
  totalLetCount += finalLetCount;
  totalConstCount += finalConstCount;

  if (afterConst !== original) {
    fs.writeFileSync(filePath, afterConst, 'utf-8');
    const letConverted = letCount - finalLetCount;
    console.log(`  ${f.padEnd(28)} var:${String(varCount).padStart(4)} → let:${String(finalLetCount).padStart(4)} + const:${String(letConverted).padStart(4)}`);
  } else {
    console.log(`  ${f.padEnd(28)} (no changes)`);
  }
});

console.log(`\nDone! Converted ${totalVarCount} var declarations → ${totalLetCount} let + ${totalConstCount} const`);
