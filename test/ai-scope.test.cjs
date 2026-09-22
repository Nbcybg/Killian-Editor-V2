// test/ai-scope.test.cjs — [alpha.160 · P1-2] ระดับการเข้าถึง "เฉพาะบท/เฉพาะเล่ม" ของแชท AI ต้องไม่รั่วทั้งโปรเจกต์
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-aiscope-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'ai', 'ai-scope.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const A = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const ROOT = 'C:\\proj';
const scene = 'C:\\proj\\เล่ม 1\\Draft\\default\\Chapters\\01 - บท\\scene-1.md';
const files = [
  'C:\\proj\\เล่ม 1\\Draft\\default\\Chapters\\01 - บท\\scene-1.md',
  'C:\\proj\\เล่ม 1\\Draft\\default\\Chapters\\01 - บท\\scene-2.md',
  'C:\\proj\\เล่ม 1\\Draft\\default\\Chapters\\01 - บท1\\scene-1.md',
  'C:\\proj\\เล่ม 1\\Draft\\default\\Chapters\\02 - บทสอง\\scene-1.md',
  'C:\\proj\\เล่ม 10\\Draft\\default\\Chapters\\01 - บท\\scene-1.md',
  'C:\\proj\\Memos\\โน้ต.md',
];
const pick = (scope, active) => {
  const p = A.scopePrefix(scope, active, ROOT);
  return p === null ? [] : files.filter((f) => A.underPrefix(f, p));
};

check('project = ทุกไฟล์', pick('project', '').length === files.length);
check('chapter + เปิดฉาก = เฉพาะบทนั้น (2 ไฟล์ · ไม่จับ "บท1")', pick('chapter', scene).length === 2, JSON.stringify(pick('chapter', scene)));
check('book + เปิดฉาก = เฉพาะเล่มนั้น (4 ไฟล์ · ไม่จับ "เล่ม 10" · ไม่จับ Memos)', pick('book', scene).length === 4, JSON.stringify(pick('book', scene)));
// ★ ต้นตอ: ไม่มีแท็บเปิด → prefix '' → ส่งทุกไฟล์
check('★★ chapter + ไม่มีแท็บเปิด = ไม่ส่งอะไรเลย (เดิมส่งทั้งโปรเจกต์)',
      A.scopePrefix('chapter', '', ROOT) === null && pick('chapter', '').length === 0);
check('★★ book + ไม่มีแท็บเปิด = ไม่ส่งอะไรเลย', pick('book', '').length === 0);
check('★ book + เปิดหน้า Wiki = ไม่ส่งอะไรเลย (เดิม upto(3) ได้โฟลเดอร์แม่ของโปรเจกต์ = ครอบทุกไฟล์)',
      pick('book', 'C:\\proj\\Wiki\\characters\\ทอร่า.json').length === 0);
check('★ chapter + แท็บพิเศษ (::books::) = ไม่ส่ง', pick('chapter', '::books::').length === 0);
check('ไฟล์นอกโปรเจกต์ = ไม่ส่ง', pick('book', 'D:\\other\\เล่ม\\Draft\\d\\Chapters\\c\\x.md').length === 0);
check('ตัวคั่นผสม (สแลชหน้า/หลัง) ยังจับถูก',
      A.scopePrefix('chapter', scene.replace(/\\/g, '/'), ROOT) === 'C:/proj/เล่ม 1/Draft/default/Chapters/01 - บท',
      A.scopePrefix('chapter', scene.replace(/\\/g, '/'), ROOT));
check('ไม่มีโปรเจกต์ = null', A.scopePrefix('project', scene, '') === null);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
