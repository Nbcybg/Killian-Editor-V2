// test/editor-state.test.cjs — [alpha.159] สัญญาของ KEditor ที่ไม่ต้องมี DOM
//   · M13: setMarkdown ต้องลงประวัติ undo (เดิมสร้าง state ใหม่ = ประวัติหายทั้งกอง)
//   · M12: ล้างสีตอนเคอร์เซอร์เปล่า = ถอด "สี" อย่างเดียว · `storedMarks=[]` คือ "พิมพ์แบบไม่มีมาร์ก"
//          (ความหมายของ ProseMirror — ห้ามตกกลับไปอ่าน $from.marks() ไม่งั้นปุ่ม B ติดทั้งที่ผู้ใช้เพิ่งปิด)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-editor-state.cjs');
esbuild.buildSync({
  stdin: { contents: "export * from './src/editor.js';export { EditorState, TextSelection, NodeSelection } from 'prosemirror-state';",
           resolveDir: path.join(__dirname, '..'), loader: 'js' },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const ED = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
/** KEditor ที่ไม่มี DOM — view ปลอมที่มีแค่ state/dispatch/updateState */
function fakeEditor(md) {
  const ed = Object.create(ED.KEditor.prototype);
  ed.alignComments = false; ed.resolveSrc = (x) => x;
  let st = ed._mkState(ed._docFromMd(md));
  let changes = 0;
  ed.view = { get state() { return st; }, updateState(n) { st = n; },
              dispatch(tr) { st = st.apply(tr); if (tr.docChanged) changes++; }, focus() {} };
  ed.onChange = () => changes++;
  return { ed, get changes() { return changes; } };
}

// ── M13 ──
{
  const { ed } = fakeEditor('ย่อหน้าเดิม');
  ed.view.dispatch(ed.view.state.tr.insertText('พิมพ์เอง ', 1));
  check('เงื่อนไข: พิมพ์เข้าไปแล้ว', ed.getMarkdown().includes('พิมพ์เอง'));
  ed.setMarkdown('เนื้อที่ AI เขียนทับ');
  check('setMarkdown เปลี่ยนเนื้อ', ed.getMarkdown().trim() === 'เนื้อที่ AI เขียนทับ', ed.getMarkdown());
  check('เคอร์เซอร์อยู่ต้นเอกสารเหมือนเดิม', ed.view.state.selection.from <= 1, ed.view.state.selection.from);
  ED.KEditor.prototype._cmd.call(ed, 'undo');
  check('★★ Ctrl+Z หลัง setMarkdown ย้อนกลับได้ (ประวัติไม่หาย)', ed.getMarkdown().includes('พิมพ์เอง ย่อหน้าเดิม'), ed.getMarkdown());
  ED.KEditor.prototype._cmd.call(ed, 'undo');
  check('★ undo อีกครั้งย้อนการพิมพ์ของผู้ใช้ (setMarkdown เป็นขั้นแยกของตัวเอง)', ed.getMarkdown().trim() === 'ย่อหน้าเดิม', ed.getMarkdown());
  // พิมพ์ทันทีหลัง setMarkdown (ช่วงติดกัน · ภายใน 500ms) — undo ครั้งเดียวต้องย้อนแค่การพิมพ์
  ed.setMarkdown('ฐานใหม่');
  ed.view.dispatch(ed.view.state.tr.insertText('พิมพ์ต่อ', 1));
  ED.KEditor.prototype._cmd.call(ed, 'undo');
  check('★ พิมพ์ต่อทันทีหลัง setMarkdown แล้ว undo = ย้อนเฉพาะที่พิมพ์ (ไม่รวบกับขั้น setMarkdown)',
        ed.getMarkdown().trim() === 'ฐานใหม่', ed.getMarkdown());
  const before = ed.view.state;
  ed.setMarkdown('ฐานใหม่');
  check('เนื้อเท่าเดิม = ไม่สร้างขั้น undo เปล่า', ed.view.state === before);
}
{
  const f = fakeEditor('ก');
  f.ed.setMarkdown('ข');
  check('setMarkdown ยัง "เงียบ" — ไม่ยิง onChange (ผู้เรียกจัดการธงค้างเอง)', f.changes === 0, f.changes);
}

// ── M12 ──
{
  const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
  const { ed } = fakeEditor('ปกติ **หนา<span style="color:#ff0000">แดง</span>หนา** จบ');
  let pos = -1;
  ed.view.state.doc.descendants((n, p) => { if (n.isText && n.text === 'แดง') pos = p + 1; });
  ed.view.dispatch(ed.view.state.tr.setSelection(ED.TextSelection.create(ed.view.state.doc, pos)));
  check('เงื่อนไข: เคอร์เซอร์อยู่ในข้อความหนา+แดง', ed.activeMarks().strong && ed.activeMarks().color);
  ED.KEditor.prototype._cmd.call(ed, 'color', '');
  check('★ ล้างสี: ปุ่มสีดับ · ปุ่ม B ยังติด (ถอดแค่สี)', ed.activeMarks().strong === true && ed.activeMarks().color === false,
        JSON.stringify(ed.activeMarks()));
  ED.KEditor.prototype._cmd.call(ed, 'bold');
  check('★ ปิด B ต่อ = storedMarks ว่าง → ปุ่ม B ดับ (ไม่ตกกลับไปอ่านมาร์กของข้อความรอบ ๆ)',
        ed.activeMarks().strong === false && Array.isArray(ed.view.state.storedMarks) && ed.view.state.storedMarks.length === 0,
        JSON.stringify(ed.activeMarks()));
  check('rangeColor ตรงกับปุ่ม (ว่าง)', ED.rangeColor(ed.view.state) === '');
  void MD;
}

// ── [alpha.159 · QoL] End หยุดที่ตัวอักษรสุดท้าย ไม่ใช่หลังช่องว่างห้อยท้าย ──
{
  const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
  const doc = ED.schema.nodeFromJSON(MD.mdToDoc('คำหนึ่ง คำสอง   '));
  const end = doc.content.size - 1;                    // ท้ายย่อหน้า (หลังช่องว่าง 3 ตัว)
  const p = ED.endBeforeTrailingSpace(doc, end, 1);
  check('[159-QoL] ★ End ถอยข้ามช่องว่างท้ายบรรทัด', doc.textBetween(1, p) === 'คำหนึ่ง คำสอง', JSON.stringify(doc.textBetween(1, p)));
  check('[159-QoL] ไม่มีช่องว่างท้าย = อยู่ที่เดิม', ED.endBeforeTrailingSpace(doc, p, 1) === p);
  const blank = ED.schema.nodeFromJSON(MD.mdToDoc('   '));
  check('[159-QoL] บรรทัดมีแต่ช่องว่าง = ไม่ถอยเลยต้นบรรทัด', ED.endBeforeTrailingSpace(blank, blank.content.size - 1, 1) >= 1);
}

// ── [alpha.159 · QoL] ขึ้นหน้าใหม่ตอนเลือกรูปอยู่ = แทรกหลังรูป (ห้ามแทนที่รูป) ──
{
  const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
  const doc = ED.schema.nodeFromJSON(MD.mdToDoc('ก่อน\n\n![รูป](a.png)\n\nหลัง'));
  let figPos = -1;
  doc.forEach((n, off) => { if (n.type.name === 'figure') figPos = off; });
  let st = ED.EditorState.create({ doc, schema: ED.schema });
  st = st.apply(st.tr.setSelection(ED.NodeSelection.create(st.doc, figPos)));
  let out = null;
  const okCmd = ED.insertPageBreak(st, (tr) => { out = st.apply(tr); });
  const names = [];
  if (out) out.doc.forEach((n) => names.push(n.type.name));
  check('[159-QoL] ★ เลือกรูปแล้วสั่งขึ้นหน้าใหม่ = รูปยังอยู่ + เส้นตัดหน้าอยู่หลังรูป',
        okCmd && names.indexOf('figure') >= 0 && names.indexOf('page_break') === names.indexOf('figure') + 1, names.join(','));
}

console.log(`\neditor-state: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
