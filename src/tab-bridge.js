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
 * [alpha.160 · P0-3] คืน `{closed, skipped, ok}` — `ok:false` = มีแท็บที่บันทึกไม่ผ่านยังค้างอยู่ → **ห้ามลบ/ย้าย**
 * (bridge พังเอง = ถือว่าไม่ปลอดภัย · ไม่มี bridge/ไม่มี dir = ไม่มีแท็บให้ห่วง)
 * @returns {Promise<{closed:number, skipped:number, ok:boolean}>}
 */
export async function closeTabsUnder(dir) {
  if (!bridge || !bridge.closeUnder || !dir) return { closed: 0, skipped: 0, ok: true };
  try {
    const r = await bridge.closeUnder(dir);
    if (typeof r === 'number') return { closed: r, skipped: 0, ok: true };   // bridge รุ่นเก่า (เทส)
    return r && typeof r === 'object' ? r : { closed: 0, skipped: 0, ok: true };
  } catch { return { closed: 0, skipped: 1, ok: false }; }
}

/**
 * [alpha.160 · P1-3] เนื้อฉาก "ตัวจริง ณ ตอนนี้" — แท็บที่เปิดอยู่ชนะไฟล์บนดิสก์ (มีส่วนที่ยังไม่บันทึกได้)
 * ตัวกลางของทุกทางที่ส่งเนื้อฉากให้ AI (แชท · สรุปเรื่อง · ตัววิเคราะห์ · ดัชนี RAG · คำสั่ง AI)
 * เดิมมีแค่แชท (alpha.149) กับ ai-actions ที่ดูแท็บ — ที่เหลืออ่านดิสก์ตรง ๆ → ผลไม่ตรงกับที่ผู้ใช้เห็นบนจอ
 * @param {string} path  ไฟล์ฉาก
 * @param {string} diskBody  เนื้อจากดิสก์ (frontmatter ถูกถอดแล้ว)
 */
export function liveBody(path, diskBody) {
  const h = tabHandle(path);
  if (!h || h.kind === 'wiki') return diskBody;
  try { return h.getText(); } catch { return diskBody; }
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
