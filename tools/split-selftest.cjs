#!/usr/bin/env node
// tools/split-selftest.cjs — [alpha.160 · P3] ย้าย selftest (`runTest()`) ออกจาก app.js ไปไว้ src/selftest.js
//
// ทำไมต้องใช้เครื่องมือ: runTest ยาว ~29,800 บรรทัด อ้างชื่อระดับบนสุดของ app.js หลายร้อยตัว
// (ทั้งฟังก์ชันภายใน · ตัวแปร · ชื่อที่ app.js import มาจากโมดูลอื่น) — ทำมือพลาดแน่
//
// ขั้นตอน:
//   1. พาร์ส app.js ด้วย acorn · หา `async function runTest` ระดับบนสุด
//   2. เก็บชื่อระดับบนสุดของ app.js (ประกาศเอง + import) · กวาด Identifier ที่ถูกอ้างใน runTest
//   3. ชื่อที่ app.js import มา → selftest.js import จากโมดูลต้นทางเดิม (ชื่อ/alias เดิม)
//      ชื่อที่ app.js ประกาศเอง → เติมเข้า `export { … }` ท้าย app.js แล้ว selftest import จาก './app.js'
//   4. ★ ถ้า runTest **เขียนค่า** ชื่อระดับบนของ app.js (binding ของ import อ่านอย่างเดียว) → หยุด แล้วรายงาน
//   5. app.js: ลบตัวฟังก์ชัน · import { runTest } from './selftest.js'
//
// ใช้: node tools/split-selftest.cjs [--dry]
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'src', 'app.js');
const OUT = path.join(ROOT, 'src', 'selftest.js');
const dry = process.argv.includes('--dry');

const src = fs.readFileSync(APP, 'utf8');
const ast = acorn.parse(src, { sourceType: 'module', ecmaVersion: 'latest', locations: true });

const fn = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id && n.id.name === 'runTest');
if (!fn) { console.error('ไม่เจอ runTest ระดับบนสุด'); process.exit(1); }

// ── ชื่อระดับบนสุด ──
const imported = new Map();      // local → { source, imported ('default' | '*' | name) }
const declared = new Set();
const exported = new Set();      // ชื่อที่ app.js export อยู่แล้ว
const addPattern = (p, set) => {
  if (!p) return;
  if (p.type === 'Identifier') set.add(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach((q) => addPattern(q.type === 'RestElement' ? q.argument : q.value, set));
  else if (p.type === 'ArrayPattern') p.elements.forEach((q) => addPattern(q && q.type === 'RestElement' ? q.argument : q, set));
  else if (p.type === 'AssignmentPattern') addPattern(p.left, set);
  else if (p.type === 'RestElement') addPattern(p.argument, set);
};
for (const n of ast.body) {
  if (n === fn) continue;
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) {
      const kind = s.type === 'ImportDefaultSpecifier' ? 'default'
        : s.type === 'ImportNamespaceSpecifier' ? '*' : (s.imported.name || s.imported.value);
      imported.set(s.local.name, { source: n.source.value, imported: kind });
    }
    continue;
  }
  let d = n;
  if (n.type === 'ExportNamedDeclaration') {
    if (n.declaration) d = n.declaration;
    else { for (const s of n.specifiers) exported.add(s.local.name); continue; }
    const tmp = new Set();
    if (d.type === 'VariableDeclaration') d.declarations.forEach((x) => addPattern(x.id, tmp));
    else if (d.id) tmp.add(d.id.name);
    tmp.forEach((x) => { exported.add(x); declared.add(x); });
    continue;
  }
  if (d.type === 'ExportDefaultDeclaration') continue;
  if (d.type === 'VariableDeclaration') d.declarations.forEach((x) => addPattern(x.id, declared));
  else if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) declared.add(d.id.name);
}

// ── ชื่อที่ runTest อ้าง (ตัดคีย์ของ property/member ที่ไม่ computed) ──
const used = new Set();
const writes = new Set();
walk.fullAncestor(fn.body, (node, ancestors) => {
  if (node.type !== 'Identifier') return;
  const parent = ancestors[ancestors.length - 2];
  if (parent) {
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition')
        && parent.key === node && !parent.computed && !parent.shorthand) return;
    if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return;
  }
  used.add(node.name);
});
// เขียนค่า: `x = …` · `x += …` · `x++` ที่ x เป็นชื่อระดับบนของ app.js และไม่มีการประกาศซ้ำในฟังก์ชัน
const localDecl = new Set();
walk.full(fn.body, (n) => {
  if (n.type === 'VariableDeclarator') addPattern(n.id, localDecl);
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) localDecl.add(n.id.name);
  if (n.params) n.params.forEach((p) => addPattern(p, localDecl));
  if (n.type === 'CatchClause' && n.param) addPattern(n.param, localDecl);
});
walk.full(fn.body, (n) => {
  const tgt = n.type === 'AssignmentExpression' ? n.left : n.type === 'UpdateExpression' ? n.argument : null;
  if (tgt && tgt.type === 'Identifier' && (declared.has(tgt.name) || imported.has(tgt.name)) && !localDecl.has(tgt.name))
    writes.add(tgt.name);
});
if (writes.size) {
  console.error('★ runTest เขียนค่าชื่อระดับบนของ app.js (import อ่านอย่างเดียว) — ต้องแก้ก่อน:', [...writes].join(', '));
  process.exit(2);
}

const needImport = [...used].filter((x) => imported.has(x)).sort();
const needLocal = [...used].filter((x) => declared.has(x)).sort();
const newExports = needLocal.filter((x) => !exported.has(x));

// ── ประกอบ selftest.js ──
const bySource = new Map();
for (const name of needImport) {
  const { source, imported: imp } = imported.get(name);
  if (!bySource.has(source)) bySource.set(source, { named: [], def: null, ns: null });
  const g = bySource.get(source);
  if (imp === 'default') g.def = name;
  else if (imp === '*') g.ns = name;
  else g.named.push(imp === name ? name : imp + ' as ' + name);
}
const wrapList = (items, indent) => {
  const lines = []; let cur = '';
  for (const it of items) {
    if ((cur + it).length > 96) { lines.push(cur.replace(/, $/, ',')); cur = ''; }
    cur += it + ', ';
  }
  if (cur) lines.push(cur.replace(/, $/, ''));
  return lines.join('\n' + indent);
};
const importLines = [];
for (const [source, g] of bySource) {
  if (g.ns) importLines.push(`import * as ${g.ns} from '${source}';`);
  const parts = [];
  if (g.def) parts.push(g.def);
  if (g.named.length) parts.push('{ ' + wrapList(g.named, '         ') + ' }');
  if (parts.length) importLines.push(`import ${parts.join(', ')} from '${source}';`);
}
if (needLocal.length) importLines.push(`import { ${wrapList(needLocal, '         ')} } from './app.js';`);

const header = `// selftest.js — e2e ในตัวโปรแกรม (\`KILLIAN_TEST=1\`) · [alpha.160] แยกออกจาก app.js ด้วย tools/split-selftest.cjs
//
// เดิม \`runTest()\` อยู่ท้าย app.js (~29,800 จาก ~45,800 บรรทัด) — ไฟล์ใหญ่จนเครื่องมือ/คนอ่านไม่ไหว
// และทำให้ตัวเลข "app.js ~5,300 บรรทัด" ใน AGENTS.md ผิดอยู่นานโดยไม่มีใครรู้
// โครงเดิมทุกบรรทัด ต่างกันแค่ชื่อของ app.js มาทาง import (app.js export ให้) — วงอ้างอิงกลับ app.js ⇄ selftest.js
// ปลอดภัยเพราะไฟล์นี้ไม่รันอะไรตอนโหลด มีแต่ประกาศฟังก์ชัน
// ★ เพิ่มเทสใหม่ที่อ้างฟังก์ชันภายในของ app.js = เติมชื่อนั้นใน import ข้างล่าง + \`export\` ใน app.js
//   (build จะฟ้อง "No matching export" ถ้าลืม — ไม่พังเงียบ)
/* eslint-disable */
`;
const body = src.slice(fn.start, fn.end);
const out = header + importLines.join('\n') + '\n\nexport ' + body + '\n';

// ── app.js ใหม่ ──
let app = src.slice(0, fn.start).replace(/\s+$/, '') + '\n';
const tail = src.slice(fn.end);
if (tail.trim()) { console.error('มีโค้ดต่อท้าย runTest — สคริปต์นี้รองรับเฉพาะกรณี runTest อยู่ท้ายไฟล์'); process.exit(3); }
app += `\n// ── [alpha.160] selftest ย้ายไป src/selftest.js (tools/split-selftest.cjs) ──\n`
     + `// ชื่อภายในที่ selftest ต้องใช้ — export ไว้ให้ไฟล์นั้น import (ไม่มีผลกับการทำงานปกติ)\n`
     + `export {\n  ${wrapList(newExports, '  ')},\n};\n`;
// import runTest ต่อท้าย import ชุดสุดท้าย
const lastImport = [...ast.body].filter((n) => n.type === 'ImportDeclaration').pop();
app = app.slice(0, lastImport.end) + `\nimport { runTest } from './selftest.js';   // [alpha.160] e2e แยกไฟล์แล้ว` + app.slice(lastImport.end);

console.log('runTest:', fn.loc.start.line, '→', fn.loc.end.line, '(' + (fn.loc.end.line - fn.loc.start.line + 1) + ' บรรทัด)');
console.log('import ต่อจากโมดูลอื่น:', needImport.length, '· ชื่อของ app.js:', needLocal.length, '(export ใหม่', newExports.length + ')');
if (dry) process.exit(0);
fs.writeFileSync(OUT, out);
fs.writeFileSync(APP, app);
console.log('เขียนแล้ว:', path.relative(ROOT, OUT), (out.split('\n').length) + ' บรรทัด ·', 'app.js', app.split('\n').length + ' บรรทัด');
