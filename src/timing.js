// timing.js — [alpha.162 · W6 ข้อ 7] ★ ตัวเลขเวลาที่มีความหมาย อยู่ที่นี่ที่เดียว (บริสุทธิ์ 100% · มี unit test)
//
// ใช้สองฝั่ง: renderer import ตรง ๆ · main.js require `timing.cjs` ที่ build.js แปลงให้ (แบบเดียวกับ update-check)
// เดิมเลขพวกนี้เป็นตัวเลขลอย ๆ ในโค้ด (`setTimeout(…, 30000)`) และสูตรถอยรอการลองใหม่
// `Math.min(8000, 500 * 2^n)` ถูกคัดลอกไว้สามไฟล์ — แก้ที่หนึ่งแล้วอีกสองที่ไม่ตาม

/** หน้าจอเปิดโปรแกรม (splash) ปิดตัวเองถ้าหน้าต่างหลักไม่ส่งสัญญาณมาภายในเวลานี้ */
export const SPLASH_MAX_MS = 30000;
/** เพดานเวลาของการถามรุ่นใหม่จาก GitHub (ช้ากว่านี้ = เลิก ไม่ค้างเปิดโปรแกรม) */
export const UPDATE_FETCH_TIMEOUT_MS = 20000;
/** สมุดโน้ตด่วน: พิมพ์หยุดนานเท่านี้แล้วค่อยบันทึก (รวบการพิมพ์รัวเป็นการเขียนดิสก์ครั้งเดียว) */
export const SCRATCH_SAVE_DELAY_MS = 3000;

/** การลองใหม่แบบถอยรอ: 500 · 1000 · 2000 · 4000 · 8000 · 8000 … มิลลิวินาที */
export const RETRY_BASE_MS = 500;
export const RETRY_MAX_MS = 8000;
/**
 * เวลารอก่อนลองครั้งที่ `n` (เริ่ม 0) — สูตรเดียวของทั้งโปรแกรม
 * @param {number} n ครั้งที่ลองไปแล้ว · ค่าเสีย/ติดลบ = 0
 */
export function retryBackoff(n) {
  const k = Number.isFinite(+n) && +n > 0 ? Math.floor(+n) : 0;
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, k));
}
