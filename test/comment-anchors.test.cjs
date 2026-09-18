// test/comment-anchors.test.cjs — [alpha.159 · H16] สมอคอมเมนต์เป็น "ของแต่ละตัวแก้ไข"
//
// เดิมรายการข้อความที่มีคอมเมนต์ (`_cmQuotes`) เป็นตัวแปรระดับโมดูลของ editor.js
// → ตัวแก้ไขที่ไม่ได้โฟกัส (แยกจอ · แท็บที่ถูกโหลดใหม่เบื้องหลัง) สแกนด้วยข้อความของอีกฉาก = ไฮไลต์ข้ามแท็บ
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-cmanchors.cjs');
esbuild.buildSync({
  stdin: {
    contents: "export { schema, commentAnchorPlugin, setCommentAnchors, commentAnchors, refreshCommentAnchors } from './src/editor.js';"
      + "export { EditorState } from 'prosemirror-state';",
    resolveDir: path.join(__dirname, '..'), loader: 'js',
  },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const E = require(tmp);
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
function mk(md) {
  const plugin = E.commentAnchorPlugin();
  const doc = E.schema.nodeFromJSON(MD.mdToDoc(md));
  let st = E.EditorState.create({ doc, schema: E.schema, plugins: [plugin] });
  const view = { get state() { return st; }, dispatch(tr) { st = st.apply(tr); } };
  const pv = plugin.spec.view(view);
  const key = plugin.spec.key;
  return { view, pv, get state() { return st; },
           marks() { return key.getState(st).find().map((d) => st.doc.textBetween(d.from, d.to)); } };
}
const A = mk('ทอร่าเดินเข้าร้าน แล้วสั่งเค้ก');
const B = mk('ลูน่าอ่านหนังสือ ทอร่าเดินเข้าร้าน');

E.setCommentAnchors(['ทอร่าเดินเข้าร้าน'], '', A.view); E.refreshCommentAnchors(A.view);
E.setCommentAnchors(['ลูน่าอ่านหนังสือ'], '', B.view); E.refreshCommentAnchors(B.view);
check('★ A ไฮไลต์เฉพาะสมอของ A', JSON.stringify(A.marks()) === '["ทอร่าเดินเข้าร้าน"]', JSON.stringify(A.marks()));
check('★ B ไฮไลต์เฉพาะสมอของ B (ไม่มีข้อความที่ A ตั้งไว้)', JSON.stringify(B.marks()) === '["ลูน่าอ่านหนังสือ"]',
      JSON.stringify(B.marks()));
check('★ commentAnchors(view) คืนของตัวเอง', E.commentAnchors(A.view)[0] === 'ทอร่าเดินเข้าร้าน'
      && E.commentAnchors(B.view)[0] === 'ลูน่าอ่านหนังสือ');
// แก้เนื้อ A (โหลดใหม่เบื้องหลัง) หลังจากที่ B เพิ่งตั้งสมอ — ของเดิมสแกนด้วยรายการของ B
A.view.dispatch(A.state.tr.insertText(' ลูน่าอ่านหนังสือ', A.state.doc.content.size - 1));
check('★★ แก้เนื้อ A หลัง B ตั้งสมอ — A ไม่ได้ไฮไลต์ข้อความของ B',
      !A.marks().includes('ลูน่าอ่านหนังสือ') && A.marks().includes('ทอร่าเดินเข้าร้าน'), JSON.stringify(A.marks()));
check('ไม่ระบุ view = ตัวที่ตั้งค่าล่าสุด (B)', E.commentAnchors()[0] === 'ลูน่าอ่านหนังสือ');
check('ข้อความสั้นกว่า 2 ตัว/ว่าง ถูกทิ้ง', (E.setCommentAnchors(['', 'ก', 'ทอร่า'], '', A.view), E.commentAnchors(A.view).join()) === 'ทอร่า');
B.pv.destroy(); A.pv.destroy();
check('ถอดครบแล้วเรียกแบบไม่ระบุ view ไม่พัง', Array.isArray(E.commentAnchors()));

console.log(`\ncomment-anchors: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
