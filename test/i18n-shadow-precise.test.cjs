// test/i18n-shadow-precise.test.cjs — [alpha.159] "t ถูกบังจริงไหม" ระดับสโคป (ไม่ใช่ระดับไฟล์)
//
// tools/i18n-shadow.cjs เตือนทั้งไฟล์ที่ "มีตัวแปรชื่อ t และมีการเรียก t('ui.…')" — ซึ่งแจ้งเกินจริง
// (app.js · panel-ui · planner-props · starter-model ถูกเตือนมาตลอดทั้งที่ไม่มีจุดพังจริง)
// เทสนี้เดิน AST: ทุกการเรียก t()/tf() ต้องไม่อยู่ในสโคปที่มีพารามิเตอร์/ตัวแปรท้องถิ่นชื่อเดียวกัน
// (อาการจริงของบทเรียน 25/26: build ผ่าน แต่ runtime ได้ `t is not a function`)
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const files = [];
(function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== 'node_modules') w(p); } else if (e.name.endsWith('.js')) files.push(p);
} })(path.join(ROOT, 'src'));

const declares = (a, name) => {
  const isId = (n) => n && n.type === 'Identifier' && n.name === name;
  const varIn = (list) => (list || []).some((st) => st.type === 'VariableDeclaration' && st.declarations.some((d) => isId(d.id)));
  if ((a.params || []).some(isId)) return true;
  if (a.type === 'BlockStatement' || a.type === 'Program') return varIn(a.body);
  if (a.type === 'ForOfStatement' || a.type === 'ForInStatement') return a.left && varIn([a.left]);
  if (a.type === 'ForStatement') return a.init && varIn([a.init]);
  if (a.type === 'CatchClause') return isId(a.param);
  return false;
};
const hits = [];
let parsed = 0, calls = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); } catch { continue; }
  parsed++;
  walk.ancestor(ast, { CallExpression(node, anc) {
    if (node.callee.type !== 'Identifier' || !['t', 'tf'].includes(node.callee.name)) return;
    calls++;
    // ancestors ไล่จากนอกเข้าใน — ตัวประกาศที่ใกล้ที่สุดที่ไม่ใช่ Program (Program = import ของไฟล์)
    for (const a of anc.slice(1)) {
      if (declares(a, node.callee.name)) { hits.push(path.relative(ROOT, f) + ':' + node.loc.start.line); break; }
    }
  } });
}
check('แยกวิเคราะห์ซอร์สได้เกือบทั้งหมด', parsed >= files.length - 2, parsed + '/' + files.length);
check('เจอการเรียก t()/tf() จำนวนมาก (ตัวสแกนทำงานจริง)', calls > 2000, calls);
check('★ ไม่มีการเรียก t()/tf() ในสโคปที่ตัวแปรท้องถิ่นชื่อเดียวกันบังอยู่', hits.length === 0, hits.slice(0, 5).join(' · '));
console.log(`\ni18n-shadow-precise: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
