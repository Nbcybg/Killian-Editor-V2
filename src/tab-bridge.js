// tab-bridge.js — [alpha.149] "ไฟล์นี้เปิดอยู่ในแท็บไหม" สำหรับโมดูลที่เขียนไฟล์โปรเจกต์เองนอกตัวแก้ไข
//
// ผู้ใช้เจอ: สั่ง AI เขียนต่อท้ายฉากที่เปิดอยู่ → ไฟล์บนดิสก์ได้ข้อความจริง แต่แท็บยังโชว์ของเก่า
// พอกดบันทึก (หรือบันทึกอัตโนมัติ) เนื้อในแท็บก็เขียนทับ = **ข้อความที่ AI เขียนหายเงียบ ๆ**
// (ตัวไล่แก้ชื่อเอนทิตี้อัตโนมัติก็เป็นแบบเดียวกัน)
//
// app.js เป็นคนติดตั้ง (รู้จักแท็บ/ตัวแก้ไข) · ai-actions.js กับ auto-task ถามผ่านตัวนี้
// โดยไม่ต้อง import app.js (ซึ่งจะวนกลับมาหากัน) · ไม่ติดตั้ง (เช่น unit test) = พฤติกรรมเดิมทุกประการ

let bridge = null;

/** app.js เรียกครั้งเดียวตอนเริ่ม — `b.find(path)` คืน handle ของแท็บ · `b.closeUnder(dir)` ปิดแท็บใต้โฟลเดอร์ */
export function setTabBridge(b) { bridge = b && typeof b.find === 'function' ? b : null; }

/**
 * handle ของแท็บที่เปิดไฟล์นี้อยู่ (null = ไม่ได้เปิด)
 * @returns {null|{kind:'prose'|'sp'|'wiki', dirty:boolean, getText:()=>string,
 *   setText:(body:string, opts?:{keepAlign?:boolean})=>void, reloadFromDisk:()=>Promise<void>,
 *   rename:(title:string)=>void, close:()=>void}}
 */
export function tabHandle(path) {
  try { return bridge && path ? bridge.find(path) : null; } catch { return null; }
}

/** ปิดทุกแท็บที่ไฟล์อยู่ใต้โฟลเดอร์นี้ (ลบเล่ม/บท) — คืนจำนวนที่ปิด */
export function closeTabsUnder(dir) {
  try { return bridge && bridge.closeUnder && dir ? bridge.closeUnder(dir) : 0; } catch { return 0; }
}

/** เทียบ path แบบไม่สนตัวคั่นและตัวพิมพ์ (Windows) — บริสุทธิ์ */
export function pathKey(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
