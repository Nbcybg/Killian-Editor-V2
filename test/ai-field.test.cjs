// test/ai-field.test.cjs — [alpha.125 ข้อ E] ai-field.js (เติมช่อง Wiki ด้วย AI คลิกเดียว)
//
// หัวไฟล์ของ `ai/ai-field.js` เขียนว่า "บริสุทธิ์ · มี unit test" มาตั้งแต่ alpha.116
// แต่ **ไม่มีไฟล์เทสอยู่จริง** — คำอ้างในคอมเมนต์ที่ไม่มีอะไรค้ำ อันตรายกว่าไม่เขียนเลย
// (คนอ่านโค้ดเชื่อว่ามีตาข่ายรองอยู่ แล้วแก้ตัวแยกคำตอบโดยไม่รันอะไรเลย)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');

const out = path.join(os.tmpdir(), '_aifield.cjs');
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, '../src/ai/ai-field.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent',
});
const F = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ───────── fieldContextRows: ช่องอื่นที่กรอกไว้แล้ว ─────────
{
  const fields = [
    { label: 'ชื่อ', value: 'ทอร่า' },
    { label: 'อาชีพ', value: '  คนทำขนม  ' },
    { label: 'จุดอ่อน', value: '' },              // ว่าง → ต้องถูกตัด
    { label: '', value: 'ไม่มีชื่อช่อง' },          // ไม่มีชื่อ → ต้องถูกตัด
    null,                                          // ขยะ → ต้องไม่พัง
  ];
  const rows = F.fieldContextRows(fields, 'จุดอ่อน');
  ck('ตัดช่องว่าง/ช่องไม่มีชื่อ/ค่า null ออก', rows.length === 2, JSON.stringify(rows));
  ck('ตัดช่องว่าหน้า-หลังของค่า', rows.includes('อาชีพ: คนทำขนม'), JSON.stringify(rows));
  ck('ไม่ใส่ช่องที่กำลังจะเติมเข้าไปเป็นบริบทของตัวเอง',
     !rows.some((r) => r.startsWith('จุดอ่อน')), JSON.stringify(rows));
  ck('ยุบช่องว่างซ้อนในค่าให้เหลือช่องเดียว',
     F.fieldContextRows([{ label: 'a', value: 'x\n\n  y' }])[0] === 'a: x y');
  ck('เคารพเพดานจำนวนช่อง',
     F.fieldContextRows(Array.from({ length: 40 }, (_, i) => ({ label: 'f' + i, value: 'v' })))
       .length === F.MAX_CONTEXT_FIELDS);
  ck('ส่งค่าที่ไม่ใช่อาร์เรย์ก็ไม่พัง', F.fieldContextRows(null).length === 0);
  ck('ตัดค่าที่ยาวเกินเหตุ',
     F.fieldContextRows([{ label: 'a', value: 'ก'.repeat(900) }])[0].length <= 420);
}

// ───────── buildFieldPrompt ─────────
{
  const r = F.buildFieldPrompt({
    fieldLabel: 'จุดอ่อน', entityName: 'ทอร่า', catLabel: 'ตัวละคร',
    fields: [{ label: 'อาชีพ', value: 'คนทำขนม' }], story: 'เรื่องในร้านเบเกอรี่',
  });
  ck('คืน system + prompt', typeof r.system === 'string' && typeof r.prompt === 'string');
  ck('prompt มีชื่อเอนทิตี้', r.prompt.includes('ทอร่า'));
  ck('prompt มีชื่อช่องที่ขอ', r.prompt.includes('จุดอ่อน'));
  ck('prompt มีบริบทช่องอื่น', r.prompt.includes('คนทำขนม'));
  ck('prompt มีบริบทเรื่อง', r.prompt.includes('ร้านเบเกอรี่'));
  const r2 = F.buildFieldPrompt({ fieldLabel: 'จุดอ่อน', current: 'กลัวความมืด' });
  ck('★ มีค่าเดิม = สั่งให้เกลา/ต่อยอด (ค่าเดิมต้องอยู่ใน prompt)', r2.prompt.includes('กลัวความมืด'));
  ck('ไม่มีค่าเดิม = ไม่มีท่อนค่าเดิม',
     !F.buildFieldPrompt({ fieldLabel: 'จุดอ่อน' }).prompt.includes('กลัวความมืด'));
  ck('เรียกโดยไม่ส่งอะไรเลยก็ไม่พัง', typeof F.buildFieldPrompt().prompt === 'string');
}

// ───────── parseFieldAnswer: โมเดลชอบแถมของที่ไม่ได้ขอ ─────────
{
  const P = F.parseFieldAnswer;
  ck('คำตอบสะอาดผ่านตรง ๆ', P('กลัวความมืด') === 'กลัวความมืด');
  ck('ตัด "ชื่อช่อง:" นำหน้า', P('จุดอ่อน: กลัวความมืด', 'จุดอ่อน') === 'กลัวความมืด');
  ck('ตัดชื่อช่องที่ใช้ทวิภาคเต็มความกว้าง', P('จุดอ่อน：กลัวความมืด', 'จุดอ่อน') === 'กลัวความมืด');
  ck('★ ไม่ตัดข้อความจริงที่บังเอิญมี ":" (กฎต้องแคบ)',
     P('สรุปคือ: เขาไม่ไป', 'จุดอ่อน') === 'สรุปคือ: เขาไม่ไป');
  ck('ตัดหัวข้อรายการ', P('- กลัวความมืด') === 'กลัวความมืด');
  ck('ตัดเครื่องหมายคำพูดที่ครอบทั้งก้อน', P('"กลัวความมืด"') === 'กลัวความมืด');
  ck('★ ไม่ตัดเครื่องหมายคำพูดที่เป็นเนื้อหาจริง',
     P('เขาพูดว่า "ไม่" แล้วเดินออกไป') === 'เขาพูดว่า "ไม่" แล้วเดินออกไป');
  ck('ตัด code fence', P('```\nกลัวความมืด\n```') === 'กลัวความมืด');
  ck('ค่าว่าง/undefined คืนสตริงว่าง', P('') === '' && P(undefined) === '' && P(null) === '');
  ck('ช่องว่างล้วนคืนสตริงว่าง', P('   \n  ') === '');
  ck('ชื่อช่องที่มีอักขระ regex ไม่ทำ RegExp พัง',
     P('a+b: ค่า', 'a+b') === 'ค่า');
}

// ───────── fieldResult: ห้ามล้างของเดิมทิ้ง ─────────
{
  ck('★ คำตอบว่าง = คืนค่าว่าง (ผู้เรียกต้องไม่เขียนทับของเดิม)', F.fieldResult('   ') === '');
  ck('คำตอบมีเนื้อ = คืนค่าที่ล้างแล้ว', F.fieldResult('จุดอ่อน: กลัวมืด', 'จุดอ่อน') === 'กลัวมืด');
}

console.log(`\nai-field: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
