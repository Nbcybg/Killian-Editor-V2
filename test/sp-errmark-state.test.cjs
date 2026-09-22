// test/sp-errmark-state.test.cjs — [alpha.160 · P1-1] เครื่องหมายข้อผิดพลาดของบทเป็น "ของแต่ละตัวแก้ไข"
// บั๊กตระกูลเดียวกับ H15/H16 (เส้นคั่นหน้า · CONTINUED): `_errMarks` เคยเป็นตัวแปรระดับโมดูล
// → บทสองแท็บ/แยกจอ วาดเส้นเหลือง/แดงของอีกเรื่องทับกัน
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-sperr-state.cjs');
esbuild.buildSync({
  stdin: { contents: "export { spErrorMarkPlugin, setSpErrorMarks, spErrorMarks, refreshSpErrorMarks } from './src/sp-format-guide.js';"
         + "export { schema } from './src/editor.js'; export { EditorState } from 'prosemirror-state';",
           resolveDir: path.join(__dirname, '..'), loader: 'js' },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const G = require(tmp);
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
function mk(md) {
  const plugin = G.spErrorMarkPlugin();
  let st = G.EditorState.create({ doc: G.schema.nodeFromJSON(MD.mdToDoc(md)), schema: G.schema, plugins: [plugin] });
  const view = { get state() { return st; }, dispatch(tr) { st = st.apply(tr); } };
  const pv = plugin.spec.view(view);
  return { view, pv, get state() { return st; }, count: () => plugin.spec.key.getState(st).find().length };
}
const A = mk('บรรทัดหนึ่ง\n\nบรรทัดสอง\n\nบรรทัดสาม');
const B = mk('อีกเรื่อง\n\nสอง');
// ตำแหน่งต้นบล็อก (ตัวตรวจผูก pos ของบล็อกให้)
const starts = (s) => { const o = []; s.state.doc.forEach((_n, p) => o.push(p)); return o; };
const sa = starts(A), sb = starts(B);
check('ตั้งของ A (2 จุด) = เปลี่ยน', G.setSpErrorMarks([{ pos: sa[0], severity: 'error' }, { pos: sa[2], severity: 'warn' }], A.view) === true);
check('★ ตั้งของ B = เปลี่ยน (ไม่เทียบกับของ A)', G.setSpErrorMarks([{ pos: sb[1], severity: 'warn' }], B.view) === true);
G.refreshSpErrorMarks(A.view); G.refreshSpErrorMarks(B.view);
check('★★ A ขีด 2 จุดของตัวเอง · B ขีด 1 จุดของตัวเอง', A.count() === 2 && B.count() === 1, A.count() + '/' + B.count());
check('★ รายการของ A ไม่ถูกทับด้วยของ B', G.spErrorMarks(A.view).length === 2 && G.spErrorMarks(B.view).length === 1);
// แท็บ B ถูกตรวจใหม่ (ไม่มีข้อผิด) → A ต้องไม่หาย
G.setSpErrorMarks([], B.view); G.refreshSpErrorMarks(B.view); G.refreshSpErrorMarks(A.view);
check('★★ ล้างของ B แล้ว เส้นของ A ยังอยู่ (เดิมก้อนกลางถูกล้างทั้งคู่)', A.count() === 2 && B.count() === 0, A.count() + '/' + B.count());
check('ผลเท่าเดิม = ไม่เปลี่ยน (ไม่ dispatch ฟรี)', G.setSpErrorMarks([{ pos: sa[0], severity: 'error' }, { pos: sa[2], severity: 'warn' }], A.view) === false);
check('ไม่ระบุ view = ตัวที่ตั้งค่าล่าสุด (A)', G.spErrorMarks().length === 2);
B.pv.destroy(); A.pv.destroy();
check('ถอดครบแล้วไม่พัง (ตกไปก้อนสำรอง)', Array.isArray(G.spErrorMarks()) && G.setSpErrorMarks([], null) === false);
console.log(`\nsp-errmark-state: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
