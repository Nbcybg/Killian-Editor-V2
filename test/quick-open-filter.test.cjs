// test/quick-open-filter.test.cjs — [alpha.169 · bug hunt] ไฟล์ที่โผล่ในกล่องเปิดไฟล์ด่วน
// ที่มา: กล่องบนแอปจริงโชว์ของภายใน (สำเนาใน .k2history · ไฟล์ทะเบียน · คีย์ AI) ปนกับงานเขียน
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-qo-filter-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'quick-open-filter.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const Q = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

check('โฟลเดอร์จุดนำไม่สแกน (.k2history · .git)', Q.qoSkipDir('.k2history') && Q.qoSkipDir('.git'));
check('โฟลเดอร์สำเนา/ถังขยะไม่สแกน', ['Snapshots', 'Backups', 'Recycle', 'OnSet'].every(Q.qoSkipDir));
check('โฟลเดอร์ที่มีแผงของตัวเองไม่สแกน', ['Planners', 'FloorPlans', 'Branches', 'Plugins'].every(Q.qoSkipDir));
check('เทียบชื่อโฟลเดอร์ไม่สนตัวพิมพ์', Q.qoSkipDir('recycle') && Q.qoSkipDir('SNAPSHOTS'));
check('โฟลเดอร์งานเขียนสแกนตามปกติ', !Q.qoSkipDir('Wiki') && !Q.qoSkipDir('Memos') && !Q.qoSkipDir('เล่มหนึ่ง') && !Q.qoSkipDir('Chapters'));

check('ฉาก .md = scene', Q.qoKind('เล่มหนึ่ง/Draft/default/Chapters/บทหนึ่ง/ฉากแรก.md') === 'scene');
check('โน้ต .md = scene', Q.qoKind('Memos/note-1.md') === 'scene');
check('★ เอนทิตี้ของ Wiki = entity (เปิดเป็นหน้า Wiki)', Q.qoKind('Wiki/characters/โทระ.json') === 'entity' && Q.qoKind('Bible/lore/x.json') === 'entity');
check('.json อื่น ๆ = text', Q.qoKind('notes/data.json') === 'text');
check('.txt = text', Q.qoKind('References/a.txt') === 'text');
check('รูป = other (เปิดในโปรแกรมของเครื่อง)', Q.qoKind('Images/cover.png') === 'other');
check('★ ไฟล์ทะเบียนไม่โชว์', ['project.khn.json', 'templates.json', 'history.json', 'timeline.json', 'maps.json', 'dictionary.json',
  'เล่มหนึ่ง/section.json', 'เล่มหนึ่ง/roster.json', 'เล่มหนึ่ง/Draft/default/draft.json', 'เล่มหนึ่ง/Draft/default/scenes.json']
  .every((r) => Q.qoKind(r) === ''));
check('★★ ไฟล์คีย์ของ AI ไม่โชว์', Q.qoKind('ai-key.json') === '' && Q.qoKind('AI-Key.JSON') === '');
check('★ สำเนาย้อนหลังใน .k2history ไม่โชว์', Q.qoKind('.k2history/blobs/mv1u167a-0.json') === '' && Q.qoKind('.k2history/blobs/x-2.md') === '');
check('ของในถังขยะ/สำเนา ไม่โชว์', Q.qoKind('Recycle/abc-ฉาก.md') === '' && Q.qoKind('Snapshots/x/1.md') === '');
check('ไฟล์จุดนำ/ไฟล์สำรองของทะเบียนที่อ่านไม่ออก ไม่โชว์', Q.qoKind('.k2restore.json') === '' && Q.qoKind('maps.unreadable-2026.json') === '');
check('ค่าว่างไม่พัง', Q.qoKind('') === '' && Q.qoKind(null) === '');

const sorted = Q.qoSort([
  { rel: 'Images/a.png', kind: 'other' }, { rel: 'Wiki/characters/ข.json', kind: 'entity' },
  { rel: 'เล่ม/ฉาก2.md', kind: 'scene' }, { rel: 'x.txt', kind: 'text' }, { rel: 'เล่ม/ฉาก1.md', kind: 'scene' },
]).map((f) => f.rel);
check('★ รายการตั้งต้น: ฉาก → เอนทิตี้ → ข้อความ → อื่น ๆ',
      JSON.stringify(sorted) === JSON.stringify(['เล่ม/ฉาก1.md', 'เล่ม/ฉาก2.md', 'Wiki/characters/ข.json', 'x.txt', 'Images/a.png']), JSON.stringify(sorted));
check('qoSort ไม่แก้อาร์เรย์เดิม', (() => { const a = [{ rel: 'b', kind: 'text' }, { rel: 'a', kind: 'scene' }]; Q.qoSort(a); return a[0].rel === 'b'; })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
