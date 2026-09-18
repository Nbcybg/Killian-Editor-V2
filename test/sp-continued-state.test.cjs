// test/sp-continued-state.test.cjs — [alpha.159] เครื่องหมาย CONTINUED/(MORE) เป็น "ของแต่ละตัวแก้ไข"
// บั๊กตระกูลเดียวกับเส้นคั่นหน้า (H15): `_conts` เคยเป็นตัวแปรระดับโมดูล → บทสองแท็บ/แยกจอวาดเครื่องหมายของกันและกัน
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-spcont-state.cjs');
esbuild.buildSync({
  stdin: { contents: "export { spContinuedPlugin, setContinueds, continueds, refreshContinueds } from './src/sp-format-guide.js';"
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
  const plugin = G.spContinuedPlugin();
  let st = G.EditorState.create({ doc: G.schema.nodeFromJSON(MD.mdToDoc(md)), schema: G.schema, plugins: [plugin] });
  const view = { get state() { return st; }, dispatch(tr) { st = st.apply(tr); } };
  const pv = plugin.spec.view(view);
  return { view, pv, get state() { return st; }, count: () => plugin.spec.key.getState(st).find().length };
}
const A = mk('บรรทัดหนึ่ง\n\nบรรทัดสอง\n\nบรรทัดสาม');
const B = mk('อีกเรื่อง\n\nสอง');
const la = [{ pos: 5, type: 'more', text: '(MORE)', page: 1 }, { pos: 14, type: 'top', text: 'CONTINUED:', page: 2 }];
const lb = [{ pos: 3, type: 'bottom', text: '(CONTINUED)', page: 1 }];
check('ตั้งของ A = เปลี่ยน', G.setContinueds(la, A.view) === true);
check('★ ตั้งของ B = เปลี่ยน (ไม่เทียบกับของ A)', G.setContinueds(lb, B.view) === true);
G.refreshContinueds(A.view); G.refreshContinueds(B.view);
check('★ A วาด 2 · B วาด 1', A.count() === 2 && B.count() === 1, A.count() + '/' + B.count());
A.view.dispatch(A.state.tr.insertText('ก', 1));
check('★★ แก้เอกสาร A หลัง B ตั้งค่า — A ยังเป็นรายการของตัวเอง (เลื่อนตาม A)',
      G.continueds(A.view).map((m) => m.pos).join() === '6,15' && A.count() === 2, G.continueds(A.view).map((m) => m.pos).join());
check('★ รายการของ B ไม่ถูกเลื่อนด้วย mapping ของ A', G.continueds(B.view).map((m) => m.pos).join() === '3');
check('ไม่ระบุ view = ตัวที่ตั้งค่าล่าสุด (B)', G.continueds().length === 1);
B.pv.destroy(); A.pv.destroy();
check('ถอดครบแล้วไม่พัง', Array.isArray(G.continueds()) && G.setContinueds([], null) === false);
console.log(`\nsp-continued-state: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
