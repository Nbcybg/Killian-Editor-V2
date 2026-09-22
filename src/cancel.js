// cancel.js — [alpha.162 · W5 ข้อ 2] "ยกเลิกงานยาว" แบบเดียวทั้งโปรแกรม (บริสุทธิ์ 100% · มี unit test)
//
// งานยาว (สร้างดัชนีค้นหา · ประกอบ PDF · บีบ ZIP · ตรวจสุขภาพโปรเจกต์) เดิมยกเลิกไม่ได้เลย —
// กดผิดโปรเจกต์ใหญ่ทีต้องนั่งรอจนจบ · ตอนนี้ทุกลูปยาวรับ `signal` (อะไรก็ได้ที่มี `.aborted`
// เช่น AbortSignal) แล้วเรียก `throwIfCancelled(signal)` ระหว่างรอบ → โยน error ชนิดเดียวกันหมด
// คนเรียกแยก "ผู้ใช้ยกเลิก" ออกจาก "พังจริง" ด้วย `isCancelled(e)` (ไม่เทียบข้อความ — กฎ .128)

/** error ของ "ผู้ใช้กดยกเลิก" — ไม่ใช่ความผิดพลาด ไม่ต้อง log เป็น error */
export function cancelledError() {
  const e = new Error('cancelled');
  e.name = 'AbortError';
  e.k2Cancelled = true;
  return e;
}

/** error นี้คือ "ผู้ใช้ยกเลิก" ไหม (รับทั้งของเราและ AbortError มาตรฐาน) */
export function isCancelled(e) {
  return !!e && (e.k2Cancelled === true || e.name === 'AbortError');
}

/** ถูกสั่งยกเลิกแล้ว → โยน `cancelledError()` · ไม่มี signal = ไม่ทำอะไร */
export function throwIfCancelled(signal) {
  if (signal && signal.aborted) throw cancelledError();
}

/**
 * ข้อความความคืบหน้า "ข้อความ (3/10)" · ไม่รู้จำนวนทั้งหมด = "ข้อความ (3)"
 * @param {string} msg ข้อความที่แปลแล้ว · @param {number} done · @param {number} [total]
 */
export function progressText(msg, done, total) {
  const d = Math.max(0, Math.floor(Number(done) || 0));
  const tot = Number(total);
  if (Number.isFinite(tot) && tot > 0) return `${msg} (${Math.min(d, tot)}/${Math.floor(tot)})`;
  return d > 0 ? `${msg} (${d})` : String(msg || '');
}
