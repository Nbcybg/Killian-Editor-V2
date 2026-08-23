// unit test ของ src/spell.js — เอนจินตรวจคำผิด (บริสุทธิ์ ไม่ต้องเปิด electron)
// [alpha.92] ข้อ 2: ช่วงความยาวที่คุ้มจะตรวจ · ข้อ 1: แคชผลต่อบล็อก · ทางลัดของ DP ตัดคำ
require('./_lang.cjs');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const out = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'spell.js')],
  bundle: true, format: 'cjs', write: false, platform: 'node',
});
const mod = {};
// eslint-disable-next-line no-new-func
new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, (mod.exports = {}), require);
const { loadBase, setExtra, check, ready, cacheSize } = mod.exports;

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + extra)); }
}

const A = path.join(__dirname, '..', 'renderer', 'assets');
loadBase(fs.readFileSync(path.join(A, 'dict_th.txt'), 'utf8'),
         fs.readFileSync(path.join(A, 'dict_en.txt'), 'utf8'));
const words = (t) => check(t).map((b) => b.word).join('|');

ck('คลังคำโหลดได้', ready());

// ---------- ของเดิมต้องไม่เพี้ยน ----------
ck('คำไทยที่สะกดถูก ไม่ถูกจับ', check('สวัสดีครับ').length === 0, words('สวัสดีครับ'));
ck('คำไทยมั่วถูกจับ', check('อากสฎฆจ').length >= 1, words('อากสฎฆจ'));
ck('คำอังกฤษผิดถูกจับทั้งสองคำ',
   words('helllo wrongwordz') === 'helllo|wrongwordz', words('helllo wrongwordz'));
ck('ตำแหน่งที่คืนชี้ตรงคำจริง', (() => {
  const t = 'เขาเดินไปที่ตลาด อากสฎฆจ มาก';
  return check(t).every((b) => t.slice(b.start, b.end) === b.word);
})(), JSON.stringify(check('เขาเดินไปที่ตลาด อากสฎฆจ มาก')));
ck('พหูพจน์/กริยาอังกฤษยังผ่าน (สัณฐานวิทยา)',
   check('walked running houses').length === 0, words('walked running houses'));

// ---------- ข้อ 2: สั้นไม่เกิน 2 ตัว = ไม่ตรวจ ----------
ck('ไทย 2 ตัวไม่ถูกขีด (ฬฒ)', check('ฬฒ').length === 0, words('ฬฒ'));
ck('ไทย 2 ตัวหลายคำติดกันก็ไม่ถูกขีด', check('ฏฑ ฬฒ ฆฏ').length === 0, words('ฏฑ ฬฒ ฆฏ'));
ck('อังกฤษ 2 ตัวไม่ถูกขีด (zq)', check('zq qx bt').length === 0, words('zq qx bt'));
ck('ไทย 3 ตัวยังถูกตรวจอยู่ (ไม่ได้ปิดหมด)', check('ฬฒฏ').length === 1, words('ฬฒฏ'));

// สระ/วรรณยุกต์เป็น combining mark — "ที่" ยาว 3 หน่วยใน JS แต่ตาเห็นตัวเดียว
ck('นับความยาวไทยแบบ "ตัวที่ตาเห็น" ไม่ใช่หน่วย JS',
   'ที่'.length === 3 && check('ที่').length === 0, words('ที่'));
ck('พยางค์เดียวที่มีสระครบไม่ถูกขีด (กั๊บ)', check('กั๊บ').length === 0, words('กั๊บ'));

// ---------- ข้อ 2: ยาวเกิน 65 ตัว = ไม่ตรวจ ----------
ck('ไทยยาว 90 ตัวรัวไม่ถูกขีด', check('ฬ'.repeat(90)).length === 0);
ck('อังกฤษยาว 90 ตัวรัวไม่ถูกขีด', check('x'.repeat(90)).length === 0);
ck('ยาว 65 พอดียังตรวจ · 66 ไม่ตรวจ',
   check('q'.repeat(65)).length === 1 && check('q'.repeat(66)).length === 0,
   check('q'.repeat(65)).length + '/' + check('q'.repeat(66)).length);
ck('URL ยาว ๆ ไม่ถูกขีดเป็นก้อนเดียว',
   check('https://example.com/' + 'a'.repeat(80)).length === 0);
ck('คำยาวเกินเกณฑ์ไม่บังคำปกติที่อยู่ข้าง ๆ',
   words('x'.repeat(90) + ' helllo') === 'helllo', words('x'.repeat(90) + ' helllo'));

// ---------- ข้อ 1: แคชผลต่อบล็อก ----------
{
  setExtra([]);                                   // ล้างแคช (คลังคำเปลี่ยน = แคชต้องหาย)
  ck('เปลี่ยนคลังคำแล้วแคชถูกล้าง', cacheSize() === 0, cacheSize());
  const t = 'เขาเดินไปที่ตลาด อากสฎฆจ มาก';
  const a = check(t), b = check(t);
  ck('เรียกซ้ำข้อความเดิมได้ผลชุดเดิม (ใช้แคช)', a === b);
  ck('แคชมีของหลังตรวจ', cacheSize() >= 1, cacheSize());
  const before = cacheSize();
  for (let i = 0; i < 3000; i++) check('บล็อกทดสอบที่ ' + i + ' อากสฎฆจ');
  ck('แคชไม่โตเกินเพดาน', cacheSize() <= 2000 && cacheSize() > before, cacheSize());
}

// ---------- คำเสริม (พจนานุกรมส่วนตัว) ----------
{
  ck('ก่อนเพิ่ม: อากสฎฆจ ยังถูกจับ', check('อากสฎฆจ').length >= 1);
  setExtra(['อากสฎฆจ', 'wrongwordz']);
  ck('เพิ่มคำไทยเข้าพจนานุกรมแล้วไม่ถูกจับ', check('อากสฎฆจ').length === 0, words('อากสฎฆจ'));
  ck('เพิ่มคำอังกฤษเข้าพจนานุกรมแล้วไม่ถูกจับ', check('wrongwordz').length === 0);
  ck('คำอื่นยังถูกจับตามปกติ', check('helllo').length === 1);
  setExtra([]);
  ck('ถอดคำเสริมออกแล้วกลับมาถูกจับ', check('อากสฎฆจ').length >= 1);
}

// ---------- ทางลัดของ DP: กำแพงตัวอักษรต้องไม่กินเวลาแบบทวีคูณ ----------
{
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) check('ฬฒฏฑฆ'.repeat(200) + i);   // 1,000 ตัว ตัดคำไม่ลงเลย
  const dt = Date.now() - t0;
  ck('กำแพงอักษรไทย 1,000 ตัว × 20 รอบ เร็วกว่า 400ms', dt < 400, dt + 'ms');
}

console.log('\n' + (fail ? 'FAIL ' + fail + ' / ' : '') + 'PASS ' + pass);
process.exit(fail ? 1 : 0);
