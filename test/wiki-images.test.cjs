// test/wiki-images.test.cjs — unit test เมทาดาทาของรูปใน Wiki entity (alpha.60r2 · ข้อ 12)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-wikiimg-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'wiki-images.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── normalizeImage: รับได้ทั้งแบบเก่า (string) และแบบใหม่ (object) ──
{
  const im = S.normalizeImage('tora.png');
  check('string → object ครบทุกฟิลด์',
    im.file === 'tora.png' && im.caption === '' && im.alt === '' && im.title === '' &&
    im.width === 0 && im.height === 0, JSON.stringify(im));
}
{
  const im = S.normalizeImage({ file: 'a.png', caption: 'ทอร่าในครัว', alt: 'ผู้หญิงยืนในครัว',
                                title: 'ฉาก 3', width: '800', height: 600 });
  check('object เก็บครบทุกฟิลด์',
    im.caption === 'ทอร่าในครัว' && im.alt === 'ผู้หญิงยืนในครัว' && im.title === 'ฉาก 3' &&
    im.width === 800 && im.height === 600, JSON.stringify(im));
}
check('คีย์ชื่ออื่นจากโค้ดเก่า (name/url) ยังอ่านได้',
  S.normalizeImage({ name: 'b.png' }).file === 'b.png' &&
  S.normalizeImage({ url: 'c.png' }).file === 'c.png');
check('ไม่มีชื่อไฟล์ → null',
  S.normalizeImage('') === null && S.normalizeImage({}) === null &&
  S.normalizeImage(null) === null && S.normalizeImage(123) === null);
check('ขนาดที่ไม่ใช่ตัวเลขบวก → 0',
  S.normalizeImage({ file: 'a.png', width: -5, height: 'abc' }).width === 0 &&
  S.normalizeImage({ file: 'a.png', height: 'abc' }).height === 0);
check('ตัดช่องว่างหัวท้ายชื่อไฟล์', S.normalizeImage('  a.png  ').file === 'a.png');

// ── migrateImages: แปลงทั้งอาร์เรย์ (เข้ากันได้ย้อนหลัง) ──
{
  const out = S.migrateImages(['a.png', 'b.png']);
  check('อาร์เรย์ string เก่า → object ครบ',
    out.length === 2 && out[0].file === 'a.png' && out[1].caption === '', JSON.stringify(out));
}
{
  const out = S.migrateImages(['a.png', { file: 'b.png', caption: 'x' }, null, '', { }]);
  check('ปนกันได้ + ทิ้งรายการเสีย', out.length === 2 && out[1].caption === 'x', JSON.stringify(out));
}
check('ไม่ใช่อาร์เรย์ → []', S.migrateImages(null).length === 0 && S.migrateImages('x').length === 0);
check('migrate สองครั้งได้ผลเท่าเดิม (idempotent)',
  JSON.stringify(S.migrateImages(S.migrateImages(['a.png']))) ===
  JSON.stringify(S.migrateImages(['a.png'])));

// ── needsImageMigration ──
check('ไฟล์เก่า (string[]) ต้องเขียนกลับ', S.needsImageMigration(['a.png']) === true);
check('ไฟล์ใหม่แล้วไม่ต้องเขียนกลับ',
  S.needsImageMigration(S.migrateImages(['a.png'])) === false);
check('อาร์เรย์ว่าง = ไม่ต้องทำอะไร', S.needsImageMigration([]) === false);
check('ไม่ใช่อาร์เรย์ = ไม่ต้องทำอะไร', S.needsImageMigration(null) === false);

// ── imageFile / imageFiles / imageLabel / imageAlt ──
check('imageFile จาก string', S.imageFile('a.png') === 'a.png');
check('imageFile จาก object', S.imageFile({ file: 'a.png', caption: 'x' }) === 'a.png');
check('imageFile ค่าเสีย → ว่าง', S.imageFile(null) === '');
check('imageFiles คืนรายชื่อไฟล์ล้วน (ให้โค้ดเก่าใช้ได้)',
  S.imageFiles(['a.png', { file: 'b.png' }]).join(',') === 'a.png,b.png');
check('imageLabel: คำบรรยายมาก่อน',
  S.imageLabel({ file: 'a.png', caption: 'คำบรรยาย', alt: 'alt' }) === 'คำบรรยาย');
check('imageLabel: ไม่มีคำบรรยาย → alt',
  S.imageLabel({ file: 'a.png', alt: 'alt' }) === 'alt');
check('imageLabel: ไม่มีอะไรเลย → ชื่อไฟล์', S.imageLabel('a.png') === 'a.png');
check('imageAlt: alt มาก่อนคำบรรยาย',
  S.imageAlt({ file: 'a.png', caption: 'cap', alt: 'alt' }) === 'alt');
check('imageAlt: ไม่มี alt → คำบรรยาย',
  S.imageAlt({ file: 'a.png', caption: 'cap' }) === 'cap');
check('imageAlt: ไม่มีทั้งคู่ → ชื่อไฟล์', S.imageAlt('a.png') === 'a.png');

// ── setImageMeta ──
{
  const list = ['a.png', 'b.png'];
  const out = S.setImageMeta(list, 1, { caption: 'ใหม่', alt: 'ทดสอบ' });
  check('setImageMeta แก้ใบที่ระบุ', out[1].caption === 'ใหม่' && out[1].alt === 'ทดสอบ');
  check('setImageMeta ไม่แตะใบอื่น', out[0].caption === '');
  check('setImageMeta ไม่แก้อาร์เรย์เดิม', list[0] === 'a.png' && list.length === 2);
  check('setImageMeta index นอกช่วง → ไม่พัง',
    S.setImageMeta(list, 9, { caption: 'x' }).length === 2 &&
    S.setImageMeta(list, -1, { caption: 'x' })[0].caption === '');
  check('setImageMeta ลบคำบรรยายให้ว่างได้',
    S.setImageMeta(out, 1, { caption: '' })[1].caption === '');
  check('setImageMeta ไม่ทำชื่อไฟล์หาย',
    S.setImageMeta(out, 1, { caption: 'y' })[1].file === 'b.png');
}

// ── makePrimary / removeImage / addImage ──
{
  const list = S.migrateImages([{ file: 'a.png', caption: 'A' }, { file: 'b.png', caption: 'B' },
                                { file: 'c.png', caption: 'C' }]);
  const p = S.makePrimary(list, 2);
  check('makePrimary ย้ายมาเป็นใบแรก', p[0].file === 'c.png' && p[0].caption === 'C');
  check('makePrimary คงลำดับที่เหลือ', p[1].file === 'a.png' && p[2].file === 'b.png');
  check('makePrimary index 0 = ไม่เปลี่ยน', S.makePrimary(list, 0)[0].file === 'a.png');
  check('makePrimary index เกิน → ไม่พัง', S.makePrimary(list, 9).length === 3);

  const r = S.removeImage(list, 1);
  check('removeImage เอาใบที่ระบุออก', r.length === 2 && r[1].file === 'c.png');
  check('removeImage ไม่แก้อาร์เรย์เดิม', list.length === 3);
  check('removeImage index เกิน → ไม่พัง', S.removeImage(list, 9).length === 3);

  const a1 = S.addImage(list, 'd.png');
  check('addImage เพิ่มท้ายรายการ', a1.length === 4 && a1[3].file === 'd.png');
  check('addImage ชื่อซ้ำ → ไม่เพิ่ม', S.addImage(list, 'a.png').length === 3);
  check('addImage ค่าเสีย → ไม่เพิ่ม', S.addImage(list, '').length === 3);
  check('addImage รักษาเมทาดาทาของใบเดิม', a1[0].caption === 'A');
  check('addImage ลงรายการว่างได้', S.addImage(null, 'a.png').length === 1);
}

// ── IMAGE_FIELDS ──
check('IMAGE_FIELDS ครบตามที่ผู้ใช้ขอ (file/caption/alt/title/width/height)',
  S.IMAGE_FIELDS.join(',') === 'file,caption,alt,title,width,height', S.IMAGE_FIELDS.join(','));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
