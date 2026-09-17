// test/planner-props-focus.test.cjs — [alpha.153 ข้อ 1] อย่าวาดแผงที่ผู้ใช้กำลังใช้มืออยู่ใหม่
//
// ผู้ใช้: *"bug ใน คุณสมบัติ ของ planner มันเกิดอาการเรียกว่า auto refresh เมื่อเราพิมพ์แล้วจะดีดออก
//          เพราะโดน refresh ดังนั้นควรจะให้พิมพ์เสร็จก่อนถึง refresh"*
//
// กฎที่ต้องจริงเสมอ:
//   · โฟกัสอยู่ในแผง      → พักไว้ (ห้ามวาดใหม่) แล้ววาดคำขอล่าสุดตอนปล่อยมือ
//   · โฟกัสไม่ได้อยู่ในแผง → วาดเลยทุกกรณี
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_ppfocus.cjs');
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, '../src/planner/planner-props-focus.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent',
});
const P = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const box = { contains: (el) => !!el && el.inBox === true };
const inside = { inBox: true, tagName: 'INPUT' };
const outside = { inBox: false, tagName: 'INPUT' };

// ═══════════ ป้ายระบุสิ่งที่แผงแสดงอยู่ ═══════════
{
  check('การ์ดคนละใบ = คนละป้าย',
        P.propsKey({ mode: 'node', data: { id: 'a' } }) !== P.propsKey({ mode: 'node', data: { id: 'b' } }));
  check('การ์ดใบเดิม = ป้ายเดิม (แม้ค่าข้างในเปลี่ยน)',
        P.propsKey({ mode: 'node', data: { id: 'a', title: 'ก' } })
        === P.propsKey({ mode: 'node', data: { id: 'a', title: 'กข' } }));
  check('★ การ์ดกับเส้นที่ id เดียวกัน ต้องไม่ถูกนับเป็นของเดียวกัน',
        P.propsKey({ mode: 'node', data: { id: 'x' } }) !== P.propsKey({ mode: 'edge', data: { id: 'x' } }));
  check('เลือกหลายใบ = ป้ายจากรายการไอดี',
        P.propsKey({ mode: 'many', data: ['a', 'b'] }) === 'many:a+b');
  check('ไม่มีอะไรเลือกอยู่', P.propsKey(null) === 'none' && P.propsKey({}) === 'none');
}

// ═══════════ ตัดสินใจว่าจะพักการวาดไหม ═══════════
{
  check('★★ กำลังพิมพ์ในแผง + วัตถุตัวเดิม → พักไว้ ไม่วาดใหม่',
        P.shouldDeferRender(box, inside, 'node:a', 'node:a') === true);
  // ★ เปลี่ยนเป็นวัตถุตัวอื่นก็ยังพัก — เพราะ fabric ยิง "ไม่ได้เลือกอะไร" คั่นทุกครั้งที่วาดการ์ดใหม่
  // ป้ายจึงไม่เคยตรงกันสักรอบ ถ้าเอาป้ายมาเป็นเงื่อนไข ด่านนี้ก็ไม่เคยกั้นอะไรเลย
  // (ไปคลิกการ์ดใบอื่นจริง ๆ ช่องในแผงหลุดโฟกัสก่อนเสมอ คำขอที่พักไว้จึงถูกวาดทันที)
  check('★★ กำลังพิมพ์อยู่ ถึงจะเปลี่ยนวัตถุก็ยังพัก (โฟกัสอยู่ในแผง = มือยังไม่ว่าง)',
        P.shouldDeferRender(box, inside, 'node:b', 'node:a') === true);
  check('★ โฟกัสอยู่นอกแผง → วาดได้เลย',
        P.shouldDeferRender(box, outside, 'node:a', 'node:a') === false);
  check('ไม่มีอะไรถือโฟกัสเลย → วาดได้เลย',
        P.shouldDeferRender(box, null, 'node:a', 'node:a') === false);
  check('ไม่มีกรอบแผง → ไม่พัก (กันพังตอนแผงยังไม่ถูกสร้าง)',
        P.shouldDeferRender(null, inside, 'node:a', 'node:a') === false);
  check('กรอบที่ไม่มี contains() ก็ไม่พัง',
        P.shouldDeferRender({}, inside, 'node:a', 'node:a') === false);
  check('★★ ลากแถบเลื่อน (ไม่ใช่ช่องพิมพ์) ก็ต้องพักเหมือนกัน — ตัวแถบหายไปจากใต้เมาส์ก็ขาดเหมือนกัน',
        P.shouldDeferRender(box, { inBox: true, tagName: 'INPUT', type: 'range' }, 'node:a', 'node:a') === true);
  check('★ ยังไม่มีอะไรถือโฟกัสในแผง → วาดเลย ไม่พัก',
        P.shouldDeferRender(box, outside, 'node:a', '') === false);
}

console.log(`\nplanner-props-focus: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
