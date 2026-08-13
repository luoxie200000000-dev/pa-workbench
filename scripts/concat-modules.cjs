/**
 * concat-modules.cjs — 将 src/modules/ 下的片段按文件名排序拼接为 src/app.js
 *
 * 使用方式：
 *   node scripts/concat-modules.cjs          # 单次拼接
 *   node scripts/concat-modules.cjs --watch  # 监听变化自动拼接
 *
 * 拼接后的 src/app.js 是 Vite 的入口文件，与原始单文件行为完全一致。
 */
const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'src', 'modules');
const outputPath = path.join(__dirname, '..', 'src', 'app.js');

const BANNER = [
  '// ============================================================',
  '//  此文件由 concat-modules.cjs 自动生成，请勿手动编辑',
  '//  源文件位于 src/modules/，编辑后运行 npm run concat 重新生成',
  '// ============================================================',
  '',
  '',
].join('\n');

function concat() {
  const files = fs.readdirSync(modulesDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  if (files.length === 0) {
    console.error('[concat] src/modules/ 下没有 .js 文件');
    process.exit(1);
  }

  const parts = files.map(f => {
    const content = fs.readFileSync(path.join(modulesDir, f), 'utf-8');
    // 去掉末尾的换行，拼接时统一加
    return content.replace(/\n$/, '');
  });

  const output = BANNER + parts.join('\n') + '\n';
  fs.writeFileSync(outputPath, output, 'utf-8');

  const lineCount = output.split('\n').length;
  const sizeKB = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1);
  console.log(`[concat] ${files.length} modules -> src/app.js (${lineCount} lines, ${sizeKB} KB)`);
  return lineCount;
}

// 单次拼接
concat();

// --watch 模式
if (process.argv.includes('--watch')) {
  console.log('[concat] Watching src/modules/ for changes...');
  let debounce = null;
  fs.watch(modulesDir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`[concat] Change detected: ${filename}`);
      concat();
    }, 100);
  });
}
