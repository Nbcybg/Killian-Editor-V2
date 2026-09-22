// test/status-choices.test.cjs — [alpha.160 · P1-11] ลบสถานะที่กำหนดเองแล้ว ฉากต้องไม่ถูกเขียนเป็น Outline เงียบ ๆ
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-statuschoices-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'status-choices.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const S = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const all = ['ร่างแรก', 'แก้ไข', 'เสร็จ'];
const a = S.statusChoices(all, 'แก้ไข');
check('ค่าที่อยู่ในรายการ = เลือกค่านั้น ไม่มีตัวเลือกพิเศษ', a.selected === 'แก้ไข' && !a.orphan && a.values.length === 3);
// ★ ต้นตอ: สถานะ "รอ บก." ถูกลบออกจากรายการ แต่ฉากยังใช้อยู่
const b = S.statusChoices(all, 'รอ บก.');
check('★★ ค่าที่ถูกลบจากรายการแล้ว = ยังถูกเลือกอยู่ (ไม่ตกเป็น Outline)', b.selected === 'รอ บก.', JSON.stringify(b));
check('★ ค่าเดิมถูกเติมเป็นตัวเลือกพิเศษ (บันทึกโดยไม่แตะ = ค่าเดิม)', b.values.includes('รอ บก.') && b.orphan === 'รอ บก.');
check('ไม่แก้รายการต้นฉบับ', all.length === 3);
check('ไม่มีค่า/Outline = Outline', S.statusChoices(all, '').selected === 'Outline' && S.statusChoices(all, 'Outline').selected === 'Outline'
      && !S.statusChoices(all, undefined).orphan);
const rows = [{ row: { status: 'รอ บก.' } }, { row: { status: 'แก้ไข' } }, { status: 'รอ บก.' }, { row: {} }, null];
check('นับฉากที่ใช้สถานะ (ทั้งแถวของ listScenes และแถวดิบ)', S.countStatusUse(rows, 'รอ บก.') === 2);
check('ชื่อว่าง = 0', S.countStatusUse(rows, '') === 0);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
