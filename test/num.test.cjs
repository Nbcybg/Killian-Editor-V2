// test/num.test.cjs — [alpha.126] `src/num.js` = แหล่งความจริงเดียวของกฎเหล็กข้อ 20
//
// ทั้งโปรเจกต์พึ่งไฟล์นี้ (sp-format · prose-format · pdf-generator · export-*) เพราะ `+x || d`
// กลืนค่า **0 ที่ตั้งใจ** ไปเป็นค่าเริ่มต้นเงียบ ๆ (บทเรียนข้อ 5 + 65: `linesBefore: 0` ของบทพูด
// กลายเป็น 10 → บทพูดหลุดจากชื่อตัวละครทั้งไฟล์) — แต่กลับ **ไม่เคยมีเทสตรงของตัวเอง**
// มีแต่ถูกทดสอบทางอ้อมผ่านโมดูลอื่น ซึ่งไม่ครอบคลุมกรณีขอบที่มันมีไว้แก้โดยเฉพาะ
require('./_lang.cjs');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_num.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/num.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const { num, numClamp, numInt, hashText } = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

// ───────── num(): หัวใจของกฎข้อ 20 ─────────
ck('★ 0 ต้องเป็น 0 ไม่ใช่ค่าเริ่มต้น (นี่คือเหตุผลที่ไฟล์นี้มีอยู่)', num(0, 10) === 0, num(0, 10));
ck('★ "0" (สตริง) ก็ต้องเป็น 0', num('0', 10) === 0, num('0', 10));
ck('★ ค่าติดลบไม่ใช่ค่าว่าง', num(-3, 10) === -3);
ck('★ "0.0" เป็น 0', num('0.0', 10) === 0);
ck('ตัวเลขปกติผ่านตรง ๆ', num(4.5, 1) === 4.5);
ck('สตริงตัวเลขแปลงให้', num('12.25', 1) === 12.25);
ck('สตริงมีหน่วยต่อท้าย (parseFloat กินหัว)', num('12px', 1) === 12);
ck('undefined → ค่าเริ่มต้น', num(undefined, 7) === 7);
ck('null → ค่าเริ่มต้น', num(null, 7) === 7);
ck('สตริงว่าง → ค่าเริ่มต้น', num('', 7) === 7);
ck('ช่องว่างล้วน → ค่าเริ่มต้น', num('   ', 7) === 7);
ck('ข้อความที่ไม่ใช่ตัวเลข → ค่าเริ่มต้น', num('abc', 7) === 7);
ck('NaN → ค่าเริ่มต้น', num(NaN, 7) === 7);
ck('Infinity ไม่ใช่ตัวเลขที่ใช้ได้ → ค่าเริ่มต้น', num(Infinity, 7) === 7, num(Infinity, 7));
ck('-Infinity เช่นกัน', num(-Infinity, 7) === 7);
ck('ไม่ส่งค่าเริ่มต้น = 0', num('abc') === 0);
ck('object → ค่าเริ่มต้น', num({}, 5) === 5);
ck('อาร์เรย์ว่าง → ค่าเริ่มต้น', num([], 5) === 5, num([], 5));
ck('true/false ไม่ใช่ตัวเลข', num(true, 5) === 5 && num(false, 5) === 5);

// ───────── numClamp() ─────────
ck('หนีบขอบล่าง', numClamp(-5, 1, 0, 10) === 0);
ck('หนีบขอบบน', numClamp(99, 1, 0, 10) === 10);
ck('อยู่ในช่วงแล้วไม่ขยับ', numClamp(4, 1, 0, 10) === 4);
ck('★ 0 ที่อยู่ในช่วงต้องรอด (ไม่ตกกลับค่าเริ่มต้น)', numClamp(0, 5, 0, 10) === 0, numClamp(0, 5, 0, 10));
ck('ค่าพังตกกลับค่าเริ่มต้นแล้วค่อยหนีบ', numClamp('abc', 3, 0, 10) === 3);
ck('ค่าเริ่มต้นที่อยู่นอกช่วงก็ยังถูกหนีบ', numClamp('abc', 99, 0, 10) === 10, numClamp('abc', 99, 0, 10));

// ───────── numInt() ─────────
ck('ปัดขึ้น', numInt(2.6, 0) === 3);
ck('ปัดลง', numInt(2.4, 0) === 2);
ck('ปัดครึ่งขึ้น (Math.round)', numInt(2.5, 0) === 3);
ck('★ 0 ยังเป็น 0', numInt(0, 9) === 0);
ck('ค่าพัง → ค่าเริ่มต้น (ปัดแล้ว)', numInt('x', 4.6) === 5, numInt('x', 4.6));

// ───────── hashText(): ต้องเสถียรข้ามเวอร์ชัน ─────────
ck('ข้อความเดียวกันได้แฮชเดียวกันเสมอ', hashText('ทอร่า') === hashText('ทอร่า'));
ck('ข้อความต่างกันได้คนละแฮช', hashText('ก') !== hashText('ข'));
ck('★ ค่าคงที่ข้ามรอบรัน (ค่าที่จดไว้ในไฟล์งานต้องยังตรง)',
   hashText('hello') === hashText('hello') && typeof hashText('hello') === 'string');
ck('null/undefined ไม่พังและได้ค่าเท่ากับสตริงว่าง',
   hashText(null) === hashText('') && hashText(undefined) === hashText(''));
ck('คืนเป็น base36 (สั้น อ่านออก ใช้เป็นชื่อไฟล์ได้)', /^[0-9a-z]+$/.test(hashText('x')));
ck('ข้อความยาวก็ยังเร็วและได้ค่า', hashText('ก'.repeat(20000)).length > 0);
ck('ตัวอักษรสลับที่ให้ค่าต่างกัน (ไม่ใช่แค่บวกกัน)', hashText('ab') !== hashText('ba'));

console.log(`\nnum: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
