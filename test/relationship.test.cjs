// test/relationship.test.cjs — ทดสอบประเภทความสัมพันธ์ (relationship-types.js) ด้วย node
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// โมดูลบริสุทธิ์: ไม่มี DOM/kapi → require ตรงได้หลังแปลงเป็น cjs
const path = require('path');
const fs = require('fs');
const out = path.join(require('os').tmpdir(), '_rel.cjs');   // '/tmp' ใช้บน Windows ไม่ได้
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/relationship-types.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const R = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── ตาราง REL_TYPES ──
check('REL_TYPES มี 9 ประเภท', R.REL_TYPES.length === 9, String(R.REL_TYPES.length));
check('ทุกประเภทมี key/label/color/icon ครบ',
      R.REL_TYPES.every((t) => t.key && t.label && /^#[0-9a-f]{6}$/i.test(t.color) && t.icon));
check('key ไม่ซ้ำกัน', new Set(R.REL_TYPES.map((t) => t.key)).size === 9);
check('สีไม่ซ้ำกัน (แยกเส้นในกราฟออกจากกันได้)', new Set(R.REL_TYPES.map((t) => t.color)).size === 9);
check('REL_COLOR/REL_LABEL/REL_ICON ครบทุก key',
      R.REL_TYPES.every((t) => R.REL_COLOR[t.key] === t.color && R.REL_LABEL[t.key] === t.label &&
                               R.REL_ICON[t.key] === t.icon));
check('ครบทั้ง 9 ประเภทตามสเปก',
      ['family', 'romantic', 'ally', 'rival', 'enemy', 'mentor', 'acquaintance', 'neutral', 'custom']
        .every((k) => k in R.REL_COLOR));

// ── ไอคอนต้องมีจริงใน icons.js (ไม่งั้นวาดออกมาเป็น svg ว่าง) ──
{
  const ico = fs.readFileSync(path.join(__dirname, '../src/icons.js'), 'utf8');
  const missing = R.REL_TYPES.filter((t) => !new RegExp(`'${t.icon}':`).test(ico)).map((t) => t.icon);
  check('ไอคอนของทุกประเภทมีอยู่จริงใน icons.js', missing.length === 0, missing.join());
}

// ── categorizeRole: เดาประเภทจากบทบาท (ไทย) ──
check('categorizeRole พ่อ → family', R.categorizeRole('พ่อ') === 'family');
check('categorizeRole แม่/ลูก/พี่ชาย → family',
      ['แม่', 'ลูก', 'พี่ชาย', 'ยาย', 'หลาน'].every((r) => R.categorizeRole(r) === 'family'));
check('categorizeRole ศัตรู → enemy', R.categorizeRole('ศัตรู') === 'enemy');
check('categorizeRole คู่อริ → enemy', R.categorizeRole('คู่อริ') === 'enemy');
check('categorizeRole เพื่อน → ally', R.categorizeRole('เพื่อน') === 'ally');
check('categorizeRole คู่แข่ง → rival', R.categorizeRole('คู่แข่ง') === 'rival');
check('categorizeRole อาจารย์/ลูกศิษย์ → mentor',
      R.categorizeRole('อาจารย์') === 'mentor' && R.categorizeRole('ลูกศิษย์') === 'mentor');
check('categorizeRole แฟน/คนรัก → romantic',
      R.categorizeRole('แฟน') === 'romantic' && R.categorizeRole('คนรัก') === 'romantic');
check('categorizeRole รู้จัก → acquaintance', R.categorizeRole('รู้จัก') === 'acquaintance');
check('categorizeRole เป็นกลาง → neutral', R.categorizeRole('เป็นกลาง') === 'neutral');

// ── categorizeRole: อังกฤษ + ไม่พังกับค่าว่าง ──
check('categorizeRole อังกฤษ (friend/enemy/teacher/rival)',
      R.categorizeRole('friend') === 'ally' && R.categorizeRole('Enemy') === 'enemy' &&
      R.categorizeRole('teacher') === 'mentor' && R.categorizeRole('RIVAL') === 'rival');
check('บทบาทที่ไม่รู้จัก → custom', R.categorizeRole('ลูกหนี้') === 'custom');
check('ค่าว่าง/null/undefined ไม่พัง → custom',
      R.categorizeRole('') === 'custom' && R.categorizeRole(null) === 'custom' &&
      R.categorizeRole(undefined) === 'custom');
check('ทุกผลลัพธ์ของ categorizeRole เป็น key ที่มีสีจริง',
      ['พ่อ', 'เพื่อน', 'ศัตรู', 'อะไรก็ไม่รู้', ''].every((r) => R.REL_COLOR[R.categorizeRole(r)]));

// ── categorizeWith: แผนที่จาก inverse_roles.json ชนะ regex ──
{
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../renderer/inverse_roles.json'), 'utf8')).categories;
  check('inverse_roles.json มี categories', !!map && typeof map === 'object');
  check('categories ทุกค่าเป็นประเภทที่รู้จัก',
        Object.values(map).every((v) => v in R.REL_COLOR),
        Object.values(map).filter((v) => !(v in R.REL_COLOR)).join());
  check('categories ไม่ทำให้ pairs เดิมหาย',
        Array.isArray(JSON.parse(fs.readFileSync(path.join(__dirname, '../renderer/inverse_roles.json'), 'utf8')).pairs));
  check('categorizeWith ใช้ค่าจากไฟล์ (สามี → romantic)', R.categorizeWith(map, 'สามี') === 'romantic');
  check('categorizeWith เว้นวรรคหน้า-หลังก็ยังตรง', R.categorizeWith(map, '  พ่อ  ') === 'family');
  check('categorizeWith ไม่มีในไฟล์ → ตกไปใช้ regex', R.categorizeWith(map, 'พี่สาว') === 'family');
  check('categorizeWith map ว่าง/null ไม่พัง',
        R.categorizeWith(null, 'ศัตรู') === 'enemy' && R.categorizeWith({}, 'เพื่อน') === 'ally');
}

console.log(`relationship: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
