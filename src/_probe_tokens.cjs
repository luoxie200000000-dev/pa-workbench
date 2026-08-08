const esbuild = require('esbuild');
const code = [
  "const a = `head ${x} mid ${y} tail`;",
  "const b = 'literal ${escapeAttr(z)} end';",
  "const c = `tpl ${escapeAttr(w)} done`;"
].join("\n");
const tokens = esbuild.tokenize(code, { legacy: true });
for (const t of tokens) {
  const [text, type, start, end] = t;
  console.log(JSON.stringify({ type, text: text.slice(0, 24), start, end }));
}
