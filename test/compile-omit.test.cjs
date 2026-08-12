// test/compile-omit.test.cjs — unit test "ไม่รวม element ตามประเภท" (ข้อ 88)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const CP = build('compile.js', 'k2-omit-test.cjs');
const FT = build('fountain.js', 'k2-omit-fnt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const script = [
  '.INT. ห้องครัว - เช้า',
  '',
  'ทอร่ายืนมองเค้ก',
  '',
  '((โน้ต: ยังไม่แน่ใจตอนจบ))',
  '',
  '@ทอร่า',
  'ฉันจะกินคนเดียวนะ',
  '',
  '= สรุป: ทอร่าตัดสินใจ',
  '',
  '# โครงหนึ่ง',
  '## โครงสอง',
].join('\n');

// ── ขั้นตอนถูกลงทะเบียนไว้ ──
const def = CP.stepDef('omit-elements');
check('มีขั้นตอน omit-elements ใน STEP_DEFS', !!def);
check('อยู่ในช่วง model (ทำก่อนประกอบข้อความ)', def.stage === 'model');
check('ค่าเริ่มต้นตัดแค่ ((โน้ต)) — ไม่กินหัวข้อของนิยาย', def.opts.types === 'note');
check('มีสวิตช์วาดกรอบรอบโน้ต', def.opts.drawRectAroundNotes === false);
check('มีช่องกรอกให้ผู้ใช้ตั้งเอง 2 ช่อง', (def.fields || []).length === 2);
check('ช่องสวิตช์เป็นชนิด check (กล่องติ๊ก ไม่ใช่ช่องพิมพ์)',
  def.fields.find((f) => f.k === 'drawRectAroundNotes').type === 'check');
check('OMIT_CHOICES มีโน้ต/สรุป/โครง/รูป',
  ['note', 'summary', 'outline1', 'outline2', 'outline3', 'image']
    .every((k) => CP.OMIT_CHOICES.includes(k)));
check('OMIT_CHOICES ไม่มีเนื้อบทหลัก (กันตัดบทตัวเองทิ้ง)',
  ['scene', 'action', 'character', 'dialogue'].every((k) => !CP.OMIT_CHOICES.includes(k)));

// ── omitElements ──
check('ไม่ระบุประเภท → คืนข้อความเดิมเป๊ะ',
  CP.omitElements(script, '') === script && CP.omitElements(script, []) === script);
check('ข้อความว่าง → ไม่พัง', CP.omitElements('', 'note') === '' && CP.omitElements(null, 'note') === '');

const noNote = CP.omitElements(script, 'note');
check('ตัดโน้ตออกแล้ว', !noNote.includes('ยังไม่แน่ใจตอนจบ'));
check('เนื้อบทที่เหลืออยู่ครบ',
  noNote.includes('ห้องครัว') && noNote.includes('ทอร่ายืนมองเค้ก') &&
  noNote.includes('ฉันจะกินคนเดียวนะ'));
check('สรุป/โครงยังอยู่ (ไม่ได้สั่งตัด)',
  noNote.includes('สรุป: ทอร่าตัดสินใจ') && noNote.includes('โครงหนึ่ง'));
check('ไม่เหลือช่องว่างซ้อน 3 บรรทัด', !/\n{3}/.test(noNote), JSON.stringify(noNote));

const noMulti = CP.omitElements(script, 'note, summary , outline1');
check('รับหลายประเภทคั่นด้วยจุลภาค (ตัดช่องว่างรอบชื่อให้)',
  !noMulti.includes('ยังไม่แน่ใจ') && !noMulti.includes('ทอร่าตัดสินใจ') &&
  !noMulti.includes('โครงหนึ่ง'));
check('outline2 ที่ไม่ได้สั่งตัดยังอยู่', noMulti.includes('โครงสอง'));
check('รับเป็นอาร์เรย์ได้เหมือนกัน',
  CP.omitElements(script, ['note']) === noNote);
check('ประเภทที่ไม่มีในบท → ข้อความเดิม',
  CP.omitElements(script, 'transition') === script);

// ── round-trip: ผลลัพธ์ยังพาร์สกลับได้ประเภทเดิม ──
const back = FT.parseScript(noNote).filter((b) => b.el !== 'blank');
check('ผลลัพธ์ไม่มีบล็อกชนิด note เหลือ', back.every((b) => b.el !== 'note'));
check('หัวฉากยังเป็นหัวฉาก', back[0].el === 'scene');
check('บทพูดยังเป็นบทพูด ไม่กลายเป็นบรรยาย (ตัดโน้ตแล้วบริบทไม่เพี้ยน)',
  back.some((b) => b.el === 'dialogue' && b.text.includes('ฉันจะกินคนเดียว')),
  JSON.stringify(back.map((b) => b.el)));
check('ตัดทุกอย่างที่เลือกได้ → ยังคืนสตริง ไม่ throw',
  typeof CP.omitElements(script, CP.OMIT_CHOICES.join(',')) === 'string');

// ── ผ่านไปป์ไลน์จริง ──
const model = { title: 'ทดสอบ', chapters: [{ title: 'บทหนึ่ง', scenes: [
  { title: 'ฉากหนึ่ง', body: script, words: 20 }] }] };
const wfOn = { id: 'x', name: 'x', ext: 'txt',
  steps: [CP.mkStep('omit-elements', true, { types: 'note' })] };
const rOn = CP.runWorkflow(model, wfOn);
check('[ไปป์ไลน์] เปิดขั้นตอน → โน้ตหายจากผลลัพธ์', !rOn.text.includes('ยังไม่แน่ใจตอนจบ'));
check('[ไปป์ไลน์] ไม่มี warning', rOn.warnings.length === 0, rOn.warnings.join('|'));
const rOff = CP.runWorkflow(model, { ...wfOn, steps: [CP.mkStep('omit-elements', false)] });
check('[ไปป์ไลน์] ปิดขั้นตอน → โน้ตยังอยู่', rOff.text.includes('ยังไม่แน่ใจตอนจบ'));
check('[ไปป์ไลน์] ไม่แก้ model เดิมของผู้เรียก',
  model.chapters[0].scenes[0].body === script);
const rDefault = CP.runWorkflow(model,
  { ...wfOn, steps: [{ key: 'omit-elements', on: true, opts: {} }] });
check('[ไปป์ไลน์] ไม่ตั้ง types มาเลย → ใช้ค่าเริ่มต้น note',
  !rDefault.text.includes('ยังไม่แน่ใจตอนจบ'));

// ── พรีเซ็ต ──
const spPreset = CP.PRESETS.find((p) => p.id === 'screenplay');
check('พรีเซ็ตบทภาพยนตร์เปิด omit-elements ให้เลย',
  (spPreset.steps || []).some((s) => s.key === 'omit-elements' && s.on !== false));
check('พรีเซ็ตนิยายไม่เปิด omit-elements (# ## ในนิยาย = หัวข้อ)',
  CP.PRESETS.filter((p) => !p.id.startsWith('screenplay'))
    .every((p) => !(p.steps || []).some((s) => s.key === 'omit-elements' && s.on !== false)));
check('มีพรีเซ็ต PDF ของบทภาพยนตร์', !!CP.PRESETS.find((p) => p.ext === 'pdf'));
check('newWorkflow มีขั้นตอนใหม่อยู่ด้วย (ปิดไว้)', (() => {
  const s = CP.newWorkflow('x').steps.find((x) => x.key === 'omit-elements');
  return s && s.on === false;
})());
check('cloneWorkflow เติมขั้นตอนที่พรีเซ็ตไม่มีให้ครบ', (() => {
  const c = CP.cloneWorkflow(CP.PRESETS.find((p) => p.id === 'manuscript'));
  return c.steps.some((s) => s.key === 'omit-elements' && s.on === false);
})());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
