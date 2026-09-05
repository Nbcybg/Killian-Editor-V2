// test/editor-keys.test.cjs — [alpha.134] พฤติกรรมของ Enter / Backspace ในตัวแก้ไขนิยาย
//
// ═══ ทำไมต้องมีเทสนี้ ═══
// สองปุ่มนี้มีสายคำสั่งที่ซับซ้อนที่สุดในโปรแกรม (แยกข้อ · ออกจากรายการ · แยกย่อหน้า ·
// ยุบบล็อก) และเป็นที่มาของบั๊กที่ผู้ใช้เจอซ้ำ ๆ · e2e จับได้ก็จริงแต่รอบละหลายนาที
// ตรงนี้ทดสอบ **คำสั่งตัวเดียวกับที่ผูกกับแป้นจริง** (`ENTER_CMD` / `BACKSPACE_CMD`)
// บน state ของ prosemirror ตรง ๆ — ไม่ต้องมี DOM
//
// สัญญาที่ผูกไว้:
//   · [ข้อ 2] Enter ท้ายบล็อกต้องพา `align` ไปบล็อกใหม่ (`splitBlock` ให้ attrs เปล่า)
//   · [ข้อ 3] ย่อหน้าว่างท้ายรายการ + Backspace = ลบทิ้ง **แล้วเคอร์เซอร์ไปท้ายข้อสุดท้าย**
//     (ถ้าเคอร์เซอร์ไปอยู่ต้นข้อ จะเข้าเงื่อนไข "ถอดออกจากรายการ" อีกรอบ = วงวนเดิม)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

// ★ ต้องเอา EditorState/TextSelection ออกมาจาก **บันเดิลก้อนเดียวกับ editor.js**
// (require('prosemirror-state') ตรง ๆ = prosemirror-model สองชุดในโปรเซสเดียว →
//  `Can not convert <> to a Fragment (looks like multiple versions…)`)
const tmp = path.join(os.tmpdir(), 'k2-editor-keys.cjs');
esbuild.buildSync({
  stdin: {
    contents: "export * from './src/editor.js';"
      + "export { EditorState, TextSelection } from 'prosemirror-state';",
    resolveDir: path.join(__dirname, '..'), loader: 'js',
  },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const ED = require(tmp);
const { EditorState, TextSelection } = ED;
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
const NL = String.fromCharCode(10);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

/** state จากมาร์กดาวน์ + เคอร์เซอร์ที่ตำแหน่งหนึ่ง */
function stateOf(md, pos) {
  const doc = ED.schema.nodeFromJSON(MD.mdToDoc(md));
  const st = EditorState.create({ doc, schema: ED.schema });
  // ไม่ระบุตำแหน่ง = ท้ายบล็อกข้อความสุดท้าย (ท้ายเอกสารดิบ ๆ ไม่ใช่ตำแหน่งข้อความ)
  const $p = st.doc.resolve(pos === undefined ? st.doc.content.size : pos);
  return st.apply(st.tr.setSelection(TextSelection.near($p, -1)));
}
/** รันคำสั่งหนึ่งครั้ง คืน state ใหม่ (null = คำสั่งไม่รับงาน) */
function run(cmd, st) {
  let out = null;
  cmd(st, (tr) => { out = st.apply(tr); });
  return out;
}
/** ตำแหน่งท้ายข้อความของบล็อกที่ n (นับจากท้ายเอกสารไม่ได้ เพราะมีปีกกาปิดหลายชั้น) */
function endOfText(doc, text) {
  let at = -1;
  doc.descendants((n, pos) => {
    if (n.isTextblock && n.textContent === text && at < 0) at = pos + 1 + n.content.size;
  });
  return at;
}

// ───────── [ข้อ 2] Enter ต้องพาการจัดหน้าไปบรรทัดใหม่ ─────────
{
  const st0 = stateOf('<!--align:center-->บรรทัดกลาง');
  check('★ อ่านการจัดหน้าจากไฟล์เข้ามาเป็น attrs ได้',
        (st0.doc.child(0).attrs || {}).align === 'center',
        JSON.stringify(st0.doc.child(0).attrs));
  const st1 = run(ED.ENTER_CMD, stateOf('<!--align:center-->บรรทัดกลาง',
                                        endOfText(stateOf('<!--align:center-->บรรทัดกลาง').doc,
                                                  'บรรทัดกลาง')));
  check('★★ Enter ท้ายบรรทัด → ย่อหน้าใหม่ยังจัดกึ่งกลาง '
        + '(splitBlock สร้างบล็อกจาก defaultType = attrs เปล่า)',
        !!st1 && st1.doc.childCount === 2
          && (st1.doc.child(1).attrs || {}).align === 'center',
        st1 ? st1.doc.childCount + ' บล็อก · ' + JSON.stringify(st1.doc.child(1).attrs) : 'ไม่รับงาน');
  // หัวข้อ → Enter ได้ย่อหน้า แต่การจัดหน้าต้องตามไปด้วย
  const stH = stateOf('<!--align:right--># หัวข้อชิดขวา');
  const stH2 = run(ED.ENTER_CMD, stateOf('<!--align:right--># หัวข้อชิดขวา',
                                         endOfText(stH.doc, 'หัวข้อชิดขวา')));
  check('★ หัวข้อก็พาการจัดหน้าไปย่อหน้าถัดไป',
        !!stH2 && (stH2.doc.child(1).attrs || {}).align === 'right',
        stH2 ? JSON.stringify(stH2.doc.child(1).attrs) : 'ไม่รับงาน');
  // ไม่มีการจัดหน้า = ต้องไม่มีผลข้างเคียงใด ๆ
  const stP = stateOf('ย่อหน้าธรรมดา');
  const stP2 = run(ED.ENTER_CMD, stateOf('ย่อหน้าธรรมดา', endOfText(stP.doc, 'ย่อหน้าธรรมดา')));
  check('★ เอกสารที่ไม่ได้จัดหน้า → Enter ให้ผลเหมือนเดิมทุกประการ',
        !!stP2 && stP2.doc.childCount === 2
          && !(stP2.doc.child(1).attrs || {}).align,
        stP2 ? JSON.stringify(stP2.doc.child(1).attrs) : 'ไม่รับงาน');
}

// ───────── [ข้อ 3] วงวนของรายการ ─────────
{
  const SRC = ['- ข้อหนึ่ง', '- ข้อสอง'].join(NL);
  const base = stateOf(SRC);
  // 1) Enter ท้ายข้อสุดท้าย → ได้ข้อว่างใบใหม่
  const s1 = run(ED.ENTER_CMD, stateOf(SRC, endOfText(base.doc, 'ข้อสอง')));
  const items = (st) => st.doc.child(0).childCount;
  check('★ Enter ท้ายข้อ = ได้ข้อใหม่ (ยังอยู่ในรายการ)',
        !!s1 && s1.doc.childCount === 1 && items(s1) === 3,
        s1 ? s1.doc.childCount + ' บล็อก · ' + items(s1) + ' ข้อ' : 'ไม่รับงาน');
  // 2) Backspace = ถอดข้อว่างออกจากรายการ
  const s2 = run(ED.BACKSPACE_CMD, s1);
  check('★ Backspace ครั้งแรก = ออกจากรายการ (เหลือ 2 ข้อ + ย่อหน้าว่าง 1 ใบ)',
        !!s2 && s2.doc.childCount === 2 && items(s2) === 2
          && s2.doc.child(1).type.name === 'paragraph' && s2.doc.child(1).content.size === 0,
        s2 ? s2.doc.childCount + ' บล็อก · ' + items(s2) + ' ข้อ' : 'ไม่รับงาน');
  // 3) Backspace อีกที = ลบย่อหน้าว่างทิ้ง **ไม่ใช่ดูดกลับเข้ารายการ**
  const s3 = run(ED.BACKSPACE_CMD, s2);
  check('★★ Backspace ครั้งที่สอง = ย่อหน้าว่างหายไป ไม่ใช่ถูกดูดกลับเข้ารายการ',
        !!s3 && s3.doc.childCount === 1 && items(s3) === 2,
        s3 ? s3.doc.childCount + ' บล็อก · ' + items(s3) + ' ข้อ' : 'ไม่รับงาน');
  check('★★ เคอร์เซอร์ไปอยู่ **ท้าย** ข้อสุดท้าย — ถ้าไปอยู่ต้นข้อจะเข้าเงื่อนไข '
        + '"ถอดออกจากรายการ" อีกรอบ = วงวนเดิมกลับมา',
        !!s3 && s3.selection.$from.parent.textContent === 'ข้อสอง'
          && s3.selection.$from.parentOffset === 'ข้อสอง'.length,
        s3 ? '"' + s3.selection.$from.parent.textContent + '" offset='
             + s3.selection.$from.parentOffset : 'ไม่รับงาน');
  // 4) กดซ้ำ = **ไม่มีคำสั่งไหนรับงาน** → ตกไปให้เบราว์เซอร์ลบตัวอักษรตามปกติ
  //    (prosemirror ไม่มีคำสั่ง "ลบตัวอักษรถอยหลัง" — contenteditable จัดการเอง ·
  //     baseKeymap มีแค่กรณีขอบบล็อก) สิ่งที่ต้องพิสูจน์คือ **ไม่มีใครสร้างย่อหน้าใหม่ขึ้นมาอีก**
  const s4 = run(ED.BACKSPACE_CMD, s3);
  check('★★ กดซ้ำแล้วไม่มีคำสั่งไหนแทรกแซง (เบราว์เซอร์ลบตัวอักษรตามปกติ) — วงวนขาดจริง',
        s4 === null, s4 ? 'มีคำสั่งรับงาน: ' + s4.doc.childCount + ' บล็อก' : 'ไม่รับงาน (ถูกต้อง)');
  // ย่อหน้าที่ **มีข้อความ** ต้องไม่ถูกกฎใหม่เหมารวมไปด้วย — ยังใช้พฤติกรรมมาตรฐานของ
  // prosemirror (`joinBackward` ยกมันขึ้นเป็น "ข้อใหม่" ของรายการ) เหมือนก่อนแก้ทุกประการ
  const withText = stateOf(['- ข้อหนึ่ง', 'ย่อหน้าตามหลัง'].join(NL));
  let at = -1;
  withText.doc.descendants((n, pos) => {
    if (n.isTextblock && n.textContent === 'ย่อหน้าตามหลัง' && at < 0) at = pos + 1;
  });
  const s5 = run(ED.BACKSPACE_CMD, withText.apply(
    withText.tr.setSelection(TextSelection.create(withText.doc, at))));
  check('★ ย่อหน้าที่มีข้อความไม่ถูกกฎใหม่เหมารวม (ยังได้พฤติกรรมมาตรฐานเดิม)',
        !!s5 && s5.doc.childCount === 1 && s5.doc.child(0).childCount === 2
          && s5.doc.child(0).lastChild.textContent === 'ย่อหน้าตามหลัง',
        s5 ? s5.doc.childCount + ' บล็อก · ' + s5.doc.child(0).childCount + ' ข้อ · "'
             + s5.doc.child(0).lastChild.textContent + '"' : 'ไม่รับงาน');
  // ย่อหน้าว่างที่ **ไม่ได้** ต่อท้ายรายการต้องไม่โดนกฎใหม่ (ยุบตามปกติ)
  const plain = stateOf(['ย่อหน้าหนึ่ง', ''].join(NL));
  const s6 = run(ED.BACKSPACE_CMD, plain);
  check('★ ย่อหน้าว่างที่ไม่ได้ต่อท้ายรายการยังยุบตามปกติ',
        !!s6 && s6.doc.childCount === 1, s6 ? s6.doc.childCount + ' บล็อก' : 'ไม่รับงาน');
}

console.log(NL + 'editor-keys: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
