// test/drag-cancel.test.cjs — [alpha.165] Esc ยกเลิกการลาก (src/drag-cancel.js)
//
// ผู้ใช้: "ลาก panel แล้วไม่พอใจ กด Esc ยกเลิกไม่ได้" — ตัวลากทุกตัวเรียก escCancelDrag() ตัวนี้
// สิ่งที่ต้องจริงเสมอ:
//   · Esc ระหว่างลาก → เรียก onCancel ครั้งเดียว และ "กลืน" คีย์นั้น (ไม่ไหลไปปิดกล่อง/เมนูข้างหลัง)
//   · ปุ่มอื่นไม่ยกเลิก
//   · ลากจบด้วย mouseup / หน้าต่างเสียโฟกัส (mouseup หาย) → ถอดตัวฟังเอง — Esc ครั้งถัดไปต้องไม่ถูกกลืน
const path = require('path');
const out = path.join(require('os').tmpdir(), '_dragcancel.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/drag-cancel.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });

// window จำลองแบบบางที่สุด — ไม่ใช้ EventTarget ของ node เพราะมัน **ถอดตัวฟังที่ผูกด้วย capture=true ไม่ออก**
// (browser ถอดได้) = เทสจะแดงหลอก · ตัวนี้จับคู่ด้วย ชนิด + ฟังก์ชัน + capture เหมือน DOM
globalThis.window = (() => {
  const L = [];
  const cap = (o) => (typeof o === 'boolean' ? o : !!(o && o.capture));
  return {
    addEventListener(t, f, o) { if (!L.some((x) => x.t === t && x.f === f && x.c === cap(o))) L.push({ t, f, c: cap(o) }); },
    removeEventListener(t, f, o) { const i = L.findIndex((x) => x.t === t && x.f === f && x.c === cap(o)); if (i >= 0) L.splice(i, 1); },
    dispatchEvent(e) { for (const x of L.filter((y) => y.t === e.type)) x.f(e); return !e.defaultPrevented; },
  };
})();
const DC = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  FAIL', n, i); } };
const key = (k) => {
  const e = new Event('keydown', { cancelable: true });
  e.key = k;
  let stopped = false;
  e.stopImmediatePropagation = () => { stopped = true; };
  e.stopPropagation = () => {};
  window.dispatchEvent(e);
  return { prevented: e.defaultPrevented, stopped };
};

{
  let n = 0;
  const off = DC.escCancelDrag(() => { n++; });
  check('ระหว่างลาก dragInProgress = true', DC.dragInProgress() === true);
  const r0 = key('a');
  check('ปุ่มอื่นไม่ยกเลิก', n === 0 && !r0.prevented);
  const r1 = key('Escape');
  check('★ Esc → onCancel ครั้งเดียว', n === 1);
  check('★ Esc ถูกกลืน (preventDefault + stopImmediatePropagation)', r1.prevented && r1.stopped);
  const r2 = key('Escape');
  check('Esc ครั้งที่สองไม่ยิงซ้ำ และไม่ถูกกลืน', n === 1 && !r2.prevented);
  check('จบแล้ว dragInProgress = false', DC.dragInProgress() === false);
  off();
  check('เรียกตัวถอดซ้ำได้ ไม่ติดลบ', DC.dragInProgress() === false);
}
{
  let n = 0;
  DC.escCancelDrag(() => { n++; });
  window.dispatchEvent(new Event('mouseup'));
  const r = key('Escape');
  check('★★ ปล่อยเมาส์แล้ว = ถอดตัวฟังเอง (Esc ถัดไปไม่ถูกกลืน · ไม่ยกเลิกย้อนหลัง)', n === 0 && !r.prevented);
  check('ปล่อยเมาส์แล้ว dragInProgress = false', DC.dragInProgress() === false);
}
{
  let n = 0;
  DC.escCancelDrag(() => { n++; });
  window.dispatchEvent(new Event('blur'));
  const r = key('Escape');
  check('★ หน้าต่างเสียโฟกัสกลางลาก (mouseup หาย) = ถอดตัวฟังเอง', n === 0 && !r.prevented);
}
{
  let err = null;
  const orig = console.error; console.error = () => {};
  try { DC.escCancelDrag(() => { throw new Error('boom'); }); key('Escape'); } catch (e) { err = e; }
  console.error = orig;
  check('onCancel พัง ≠ ตัวดักคีย์พัง (ไม่ throw ออกไปถึงหน้าต่าง)', err === null, err && err.message);
}

console.log(`\ndrag-cancel: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
