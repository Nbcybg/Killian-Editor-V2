// tab-guard.js — [alpha.160 · P0-2/P0-3] ด่านกันข้อมูลหายก่อน "ลบ/ย้าย" ไฟล์ที่เปิดเป็นแท็บอยู่ (บริสุทธิ์ 100%)
//
// ★ ต้นตอ: `saveTab()` คืน `false` เมื่อผู้ใช้กดยกเลิกกล่อง "ไฟล์ถูกแก้นอกโปรแกรม" (หรือบันทึกพัง = throw)
//   แต่ผู้เรียกทุกทาง (`deleteToTrash` · ย้ายฉากข้ามบท · ปิดทุกแท็บ) `await saveTab()` แล้ว **กลืนค่าทิ้ง**
//   → ลบ/ย้ายไฟล์ต่อ + ปิดแท็บแบบ discard = งานที่ยังไม่บันทึกหายถาวร
//   `closeTabsUnderPath()` จงใจไม่ปิดแท็บที่บันทึกไม่ผ่านแล้ว "คืนจำนวน" แต่ผู้เรียกไม่ดูจำนวนนั้นเลย
//
// กติกา: ทุกทางที่จะลบ/ย้ายไฟล์ต้องผ่าน `flushTab()` / `closeResult()` ของไฟล์นี้ แล้ว **ยกเลิก** เมื่อได้ false/skipped>0

/**
 * งานค้างของแท็บต้องลงไฟล์ให้ได้ก่อนลบ/ย้าย
 * @param {object} tab   แท็บ (มี `dirty`)
 * @param {(tab)=>Promise<any>} save  ตัวบันทึก (= saveTab) — คืน false = ไม่ได้บันทึก · throw = บันทึกพัง
 * @returns {Promise<boolean>} true = ไม่เหลืองานค้าง (ไปต่อได้) · false = ห้ามลบ/ย้าย
 */
export async function flushTab(tab, save) {
  if (!tab || !tab.dirty) return true;
  let r;
  try { r = await save(tab); } catch { return false; }
  // บันทึกสำเร็จแต่มีการพิมพ์แทรกระหว่างเขียน (alpha.148) = ยังค้างอยู่ → ถือว่ายังไม่ปลอดภัย
  return r !== false && !tab.dirty;
}

/**
 * ผลของ `closeTabsUnderPath` เป็นรูปเดียวกันทุกที่ (เดิมคืนตัวเลขเปล่า ๆ ที่ไม่มีใครอ่าน)
 * @returns {{closed:number, skipped:number, ok:boolean}}
 */
export function closeResult(closed, skipped) {
  const c = Math.max(0, Number(closed) || 0), s = Math.max(0, Number(skipped) || 0);
  return { closed: c, skipped: s, ok: s === 0 };
}

/**
 * แท็บไหนปิดได้หลังกล่อง "บันทึกทั้งหมด" ของคำสั่งปิดทุกแท็บ
 * - action 'discard' = ผู้ใช้ตั้งใจทิ้งทุกแท็บ → ปิดได้หมด
 * - action 'save' = แท็บที่ติ๊กบันทึกไว้ **ต้องบันทึกผ่านจริง** (ไม่ dirty แล้ว) ถึงปิดได้
 *   แท็บที่ไม่ได้ติ๊ก = ผู้ใช้เลือกทิ้ง → ปิดได้
 * @param {Array<{file:string, dirty:boolean}>} tabs  สภาพแท็บ **หลัง** บันทึกแล้ว
 * @param {Set<string>|null} picked  คีย์ที่ติ๊กบันทึก (null = action discard)
 * @param {Set<string>} failed  คีย์ที่บันทึกไม่ผ่าน
 * @returns {{close:string[], keep:string[]}}
 */
export function tabsSafeToClose(tabs, picked, failed) {
  const close = [], keep = [];
  for (const t of tabs || []) {
    const bad = picked && picked.has(t.file) && (t.dirty || (failed && failed.has(t.file)));
    (bad ? keep : close).push(t.file);
  }
  return { close, keep };
}
