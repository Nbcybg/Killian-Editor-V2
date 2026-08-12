// test/scene-meta.test.cjs — unit test แหล่งความจริงเดียวของคุณสมบัติฉาก (alpha.60r2 · ข้อ 13)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// ทดสอบเฉพาะส่วนบริสุทธิ์ (readSceneMeta/writeSceneMeta ต้องมี kapi จริง → อยู่ใน e2e)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-scenemeta-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'scene-meta.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── ตารางฟิลด์ ──
for (const k of ['synopsis', 'pov', 'emotion', 'conflict', 'note', 'futureNote',
                 'tags', 'storyDate', 'isFlashback', 'isFlashforward']) {
  check('คุณสมบัติหนักมี ' + k, S.SCENE_HEAVY_KEYS.includes(k));
}
for (const k of ['id', 'title', 'order', 'fileName', 'chapterGuid', 'status', 'color', 'wordCount']) {
  check('ดัชนีมี ' + k, S.SCENE_INDEX_KEYS.includes(k));
}
check('ดัชนีกับคุณสมบัติหนักไม่ทับกัน',
  !S.SCENE_INDEX_KEYS.some((k) => S.SCENE_HEAVY_KEYS.includes(k)));

// ── asBool: frontmatter ไม่มีชนิดข้อมูล (บทเรียนข้อ 26) ──
check('asBool: "true" (สตริงจาก frontmatter)', S.asBool('true') === true);
check('asBool: "True"/"1"/"yes"', S.asBool('True') && S.asBool('1') && S.asBool('yes'));
check('asBool: "false" ต้องเป็นเท็จ (ไม่ใช่ truthy ของสตริง)', S.asBool('false') === false);
check('asBool: boolean จริงผ่านตรง ๆ', S.asBool(true) === true && S.asBool(false) === false);
check('asBool: null/undefined/ว่าง → false',
  S.asBool(null) === false && S.asBool(undefined) === false && S.asBool('') === false);

// ── asList ──
check('asList: array ผ่านตรง ๆ', S.asList(['a', 'b']).join(',') === 'a,b');
check('asList: สตริงคั่นด้วย , (frontmatter)', S.asList('a, b ,c').join(',') === 'a,b,c');
check('asList: ทิ้งช่องว่าง', S.asList('a, ,b').join(',') === 'a,b');
check('asList: ว่าง/null → []', S.asList('').length === 0 && S.asList(null).length === 0);

// ── coerceSceneMeta ──
{
  const c = S.coerceSceneMeta({ synopsis: 'ย่อ', isFlashback: 'true', tags: 'a,b', order: 5 });
  check('coerce: แปลง boolean จากสตริง', c.isFlashback === true);
  check('coerce: แปลงแท็กจากสตริง', Array.isArray(c.tags) && c.tags.length === 2);
  check('coerce: ไม่เอาคีย์ที่ไม่ใช่คุณสมบัติหนัก', !('order' in c), JSON.stringify(c));
  check('coerce: คีย์ที่ไม่มีก็ไม่ถูกเติม', !('pov' in c));
}

// ── mergeSceneMeta: frontmatter ชนะ scenes.json ──
{
  const row = { synopsis: 'ค่าเก่าใน scenes.json', pov: 'ทอร่า' };
  const fm = { synopsis: 'ค่าใหม่ที่แก้ในไฟล์ .md' };
  const m = S.mergeSceneMeta(row, fm);
  check('merge: frontmatter ชนะ', m.synopsis === 'ค่าใหม่ที่แก้ในไฟล์ .md', m.synopsis);
  check('merge: ค่าที่ frontmatter ไม่มี ตกไปใช้ดัชนี', m.pov === 'ทอร่า');
}
{
  // frontmatter มีคีย์แต่ค่าว่าง = "ยังไม่เคยเขียน" (writeSceneMeta ลบคีย์ว่างทิ้ง) → อย่ากลบค่าดัชนี
  const m = S.mergeSceneMeta({ note: 'มีโน้ต' }, { note: '' });
  check('merge: frontmatter ว่างไม่กลบค่าที่ดัชนีมี', m.note === 'มีโน้ต', m.note);
}
{
  const m = S.mergeSceneMeta(null, null);
  check('merge: ไม่มีทั้งคู่ → คีย์ครบทุกตัว',
    S.SCENE_HEAVY_KEYS.every((k) => k in m), JSON.stringify(m));
  check('merge: ค่าเริ่มต้นเป็นชนิดที่ถูก',
    m.synopsis === '' && m.isFlashback === false && Array.isArray(m.tags) && m.tags.length === 0);
}
{
  const m = S.mergeSceneMeta({ isFlashback: false }, { isFlashback: 'true' });
  check('merge: ป้ายย้อนอดีตจาก frontmatter ชนะ', m.isFlashback === true);
}
check('emptySceneMeta = merge(null,null)',
  JSON.stringify(S.emptySceneMeta()) === JSON.stringify(S.mergeSceneMeta(null, null)));

// ── stripHeavyFromRow ──
{
  const row = { id: '1', title: 'ฉาก', order: 2, synopsis: 'ย่อ', pov: 'ทอร่า', status: 'เขียนเสร็จ' };
  const out = S.stripHeavyFromRow(row);
  check('strip: เอาคุณสมบัติหนักออก', !('synopsis' in out) && !('pov' in out));
  check('strip: ดัชนียังอยู่ครบ',
    out.id === '1' && out.title === 'ฉาก' && out.order === 2 && out.status === 'เขียนเสร็จ');
  check('strip: ไม่แก้แถวเดิม', row.synopsis === 'ย่อ');
  check('strip: null ไม่พัง', JSON.stringify(S.stripHeavyFromRow(null)) === '{}');
}

// ── applySceneMetaToFrontmatter: ค่าว่าง/เท็จต้องถูกลบ (บทเรียนข้อ 26) ──
{
  const meta = { title: 'ฉาก 1', type: 'scene' };
  S.applySceneMetaToFrontmatter(meta, {
    synopsis: 'ย่อ', pov: '', tags: ['a', 'b'], isFlashback: true, isFlashforward: false });
  check('frontmatter: เขียนค่าที่มีจริง', meta.synopsis === 'ย่อ');
  check('frontmatter: ค่าว่างถูกลบ ไม่เหลือบรรทัดรก', !('pov' in meta));
  check('frontmatter: แท็กเก็บเป็น array', Array.isArray(meta.tags) && meta.tags.length === 2);
  check('frontmatter: ป้ายจริงเขียน true', meta.isFlashback === true);
  check('frontmatter: ป้ายเท็จถูกลบ (ไม่มีบรรทัด false)', !('isFlashforward' in meta));
  check('frontmatter: ไม่แตะคีย์อื่นของไฟล์', meta.title === 'ฉาก 1' && meta.type === 'scene');
}
{
  // เขียนทับของเดิมให้ว่าง = ต้องลบคีย์ทิ้ง ไม่ใช่เหลือ "pov: "
  const meta = { pov: 'ทอร่า', isFlashback: true, tags: ['x'] };
  S.applySceneMetaToFrontmatter(meta, { pov: '', isFlashback: false, tags: [] });
  check('frontmatter: ล้างค่าเดิมได้จริง',
    !('pov' in meta) && !('isFlashback' in meta) && !('tags' in meta), JSON.stringify(meta));
}
{
  const meta = { pov: 'ทอร่า' };
  S.applySceneMetaToFrontmatter(meta, { synopsis: 'ย่อ' });
  check('frontmatter: คีย์ที่ไม่ได้ส่งมาไม่ถูกแตะ', meta.pov === 'ทอร่า');
}
check('frontmatter: meta/props เป็น null ไม่พัง',
  JSON.stringify(S.applySceneMetaToFrontmatter(null, null)) === '{}');

// ── ไปกลับครบวง: row → frontmatter → merge กลับ ──
{
  const props = { synopsis: 'ทอร่าเผาครัว', pov: 'ทอร่า', emotion: 'โกรธ', conflict: 'กับแคสซี่',
                  note: 'ตรวจแล้ว', futureNote: 'อาจตัดออก', tags: ['ครัว', 'ไฟไหม้'],
                  storyDate: 'ปีที่ 1024', isFlashback: true, isFlashforward: false };
  const meta = S.applySceneMetaToFrontmatter({}, props);
  const back = S.mergeSceneMeta(null, meta);
  check('ไปกลับ: ข้อความครบ',
    back.synopsis === props.synopsis && back.emotion === 'โกรธ' && back.storyDate === 'ปีที่ 1024');
  check('ไปกลับ: แท็กครบ', back.tags.join(',') === 'ครัว,ไฟไหม้');
  check('ไปกลับ: ป้ายย้อนอดีตคงค่า true', back.isFlashback === true);
  check('ไปกลับ: ป้ายล่วงหน้ายังเป็น false', back.isFlashforward === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
