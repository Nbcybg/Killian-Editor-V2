// test/page-break-plugin.test.cjs — [alpha.159 · H15] สถานะเส้นคั่นหน้าเป็น "ของแต่ละตัวแก้ไข"
//
// ที่มา: `list/sig/shape` เคยเป็นตัวแปรระดับโรงงาน = ทุกแท็บนิยายใช้รายการเส้นคั่นก้อนเดียวกัน
// เปิดสองแท็บ (หรือแยกจอ) แล้วพิมพ์ในแท็บหนึ่ง → ปลั๊กอินของอีกแท็บวาดเส้นคั่นของ "แท็บที่จัดหน้าล่าสุด"
// ตรงนี้สร้าง state สองชุดจากโรงงานเดียว แล้วยืนยันว่ารายการ/การวาด/การเลื่อนตำแหน่งไม่ปนกัน
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-pbplugin.cjs');
esbuild.buildSync({
  stdin: {
    contents: "export * from './src/page-break-plugin.js';"
      + "export { schema } from './src/editor.js';"
      + "export { EditorState, TextSelection } from 'prosemirror-state';",
    resolveDir: path.join(__dirname, '..'), loader: 'js',
  },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const P = require(tmp);
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const F = P.createPageBreakPlugin({ key: 'testpb', cls: 'sp-page-break test-pb', decoKey: 'tpb' });
// ตัวแก้ไขปลอมสองตัว — ต่อ "view hook" ของปลั๊กอินเองแบบเดียวกับที่ EditorView ทำ
function mk(md) {
  const plugin = F.plugin();
  const doc = P.schema.nodeFromJSON(MD.mdToDoc(md));
  let st = P.EditorState.create({ doc, schema: P.schema, plugins: [plugin] });
  const view = { dom: { id: md.slice(0, 4) }, get state() { return st; },
                 dispatch(tr) { st = st.apply(tr); } };
  const pv = plugin.spec.view(view);
  return { view, plugin, pv, get state() { return st; }, decoCount() { return F.key.getState(st).find().length; } };
}
const A = mk('ย่อหน้าหนึ่ง\n\nย่อหน้าสอง\n\nย่อหน้าสาม\n\nย่อหน้าสี่');
const B = mk('บทอีกเรื่อง\n\nบรรทัดสอง');

const la = [{ pos: 14, page: 2 }, { pos: 27, page: 3 }];
const lb = [{ pos: 13, page: 2 }];
check('ตั้งรายการของ A = เปลี่ยนจริง', F.setBreaks(la, A.view) === true);
check('ตั้งรายการของ B = เปลี่ยนจริง (ไม่ใช่ "เท่าเดิม" เพราะไปเทียบกับของ A)', F.setBreaks(lb, B.view) === true);
check('★ รายการของ A ยังเป็นของ A', JSON.stringify(F.breaks(A.view).map((b) => b.pos)) === '[14,27]',
      JSON.stringify(F.breaks(A.view)));
check('★ รายการของ B เป็นของ B', JSON.stringify(F.breaks(B.view).map((b) => b.pos)) === '[13]');
check('ตั้งค่าเดิมซ้ำ = false (ลายเซ็นแยกต่อตัว)', F.setBreaks(la, A.view) === false && F.setBreaks(lb, B.view) === false);
F.refresh(A.view); F.refresh(B.view);
check('★ A วาด 2 เส้น · B วาด 1 เส้น', A.decoCount() === 2 && B.decoCount() === 1, A.decoCount() + '/' + B.decoCount());

// พิมพ์ใน A (docChanged) หลังจาก B เพิ่งจัดหน้า — ของเดิมจะเอารายการของ B มา map ด้วย mapping ของ A
F.setBreaks([{ pos: 5, page: 2 }], B.view);
A.view.dispatch(A.state.tr.insertText('ก', 1));
check('★★ พิมพ์ใน A หลัง B จัดหน้า — A ยังวาดเส้นคั่นของตัวเอง 2 เส้น', A.decoCount() === 2, A.decoCount());
check('★ ตำแหน่งของ A เลื่อนตามการพิมพ์ของ A (+1)', JSON.stringify(F.breaks(A.view).map((b) => b.pos)) === '[15,28]',
      JSON.stringify(F.breaks(A.view).map((b) => b.pos)));
check('★ รายการของ B ไม่ถูก mapping ของ A เลื่อน', JSON.stringify(F.breaks(B.view).map((b) => b.pos)) === '[5]');

// ไม่ระบุ view = ตัวที่ถูกตั้งค่าล่าสุด (พฤติกรรมเดิมของแท็บเดียว — e2e เก่าพึ่งอยู่)
check('ไม่ระบุ view → ได้ของตัวที่ตั้งค่าล่าสุด (B)', F.breaks().length === 1 && F.breaks()[0].pos === 5);
check('hasView รู้จักทั้งสองตัว', F.hasView(A.view) && F.hasView(B.view));

// applyPads อ่านรายการของเจ้าของ dom
const fakeEls = (n) => Array.from({ length: n }, () => ({ style: { setProperty(k, v) { this[k] = v; } } }));
const domA = A.view.dom; const elsA = fakeEls(2);
domA.querySelectorAll = () => elsA;
F.breaks(A.view)[0].pad = 12;
check('★ applyPads ใช้รายการของเจ้าของ dom (A มี 2 เส้น)', F.applyPads(domA) === 2 && elsA[0].style['--k-pb-pad'] === '12px',
      JSON.stringify(elsA[0].style));

// [alpha.159 · QoL] จำนวนเส้นบนจอไม่ตรงรายการ = ทาเฉพาะตัวที่จับคู่ได้ด้วยเลขหน้า (เดิมไม่ทาเลย)
{
  const dom2 = A.view.dom;
  const one = [{ dataset: { page: '3' }, style: { setProperty(k, v) { this[k] = v; } } }];
  dom2.querySelectorAll = () => one;
  F.breaks(A.view).find((b) => b.page === 3).pad = 20;
  check('[159-QoL] ★ วาดไม่ครบ (1 จาก 2 เส้น) = ยังทาเส้นที่จับคู่ได้ด้วยเลขหน้า', F.applyPads(dom2) === 1 && one[0].style['--k-pb-pad'] === '20px',
        JSON.stringify(one[0].style));
  const ghost = [{ dataset: { page: '99' }, style: { setProperty() { throw new Error('ไม่ควรถูกทา'); } } }];
  dom2.querySelectorAll = () => ghost;
  check('[159-QoL] เส้นที่ไม่มีในรายการ = ไม่แตะ', F.applyPads(dom2) === 0);
  dom2.querySelectorAll = () => elsA;
}

// ถอดตัวแก้ไข = ไม่รั่ว · ตัวที่เหลือยังทำงาน
B.pv.destroy();
check('ถอด B แล้ว B ไม่อยู่ในทะเบียน', !F.hasView(B.view));
check('A ยังได้รายการของตัวเอง', F.breaks(A.view).length === 2);
A.pv.destroy();
check('ถอดครบแล้วเรียกแบบไม่ระบุ view ไม่พัง', Array.isArray(F.breaks()) && F.setBreaks([], null) === false);

console.log(`\npage-break-plugin: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
