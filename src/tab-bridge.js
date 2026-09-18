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

/**
 * ปิดทุกแท็บที่ไฟล์อยู่ใต้โฟลเดอร์นี้ (หรือเป็นไฟล์นี้เอง) — **บันทึกงานค้างก่อน** แล้วคืนจำนวนที่ปิด
 * [alpha.159 · H5] เดิมปิดแบบทิ้ง (discard) และไม่ await → ของในถังขยะเป็นฉบับเก่า ส่วนงานที่พิมพ์ค้างหาย
 * (กฎ alpha.156 ถูกแก้แค่ทางคลิก ทาง AI ยังพัง) · ตอนนี้ app.js ส่งต่อให้ `closeTabsUnderPath(dir,{save:true})`
 * @returns {Promise<number>}
 */
export async function closeTabsUnder(dir) {
  try { return bridge && bridge.closeUnder && dir ? await bridge.closeUnder(dir) : 0; } catch { return 0; }
}

/** เทียบ path แบบไม่สนตัวคั่นและตัวพิมพ์ (Windows) — บริสุทธิ์ */
export function pathKey(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * [alpha.159 · H8] path นี้อยู่ใต้ `root` จริงไหม (หลัง join แล้ว) — บริสุทธิ์
 * ชื่อที่มาจากคำตอบของโมเดลต้องผ่านด่านนี้ก่อนเขียนไฟล์ ไม่งั้น `..` พาไฟล์ออกนอกโปรเจกต์
 */
export function isInsideRoot(root, p) {
  const r = pathKey(root), k = pathKey(p);
  if (!r || !k || k === r) return false;
  if (!k.startsWith(r + '/')) return false;
  return !k.slice(r.length + 1).split('/').some((seg) => seg === '..' || seg === '.');
}
