// file-url.js — [alpha.148] path บนดิสก์ → URL `file://` แบบซิงก์ (บริสุทธิ์ 100%)
//
// ใช้ที่ที่ต้องได้ URL ทันที (ตั้ง `img.src` ตอนสร้าง DOM) และเรียก `kapi.toFileURL` แบบรอไม่ได้
// ของเดิมต่อสตริงเอง `'file://' + path` ซึ่งพังสามทาง:
//   · ชื่อโฟลเดอร์มี `#` `?` `%` (เช่น "นิยาย #2") → เบราว์เซอร์ตัด URL ตรงนั้น รูปไม่ขึ้น
//   · Windows `C:/…` ได้ `file://C:/…` (C: กลายเป็นชื่อเครื่อง) — ต้องเป็น `file:///C:/…`
//   · path แบบ UNC `\\server\share` ต้องเป็น `file://server/share`

export function fileUrlFromPath(p) {
  let s = String(p || '').replace(/\\/g, '/');
  if (!s) return '';
  let prefix = 'file://';
  if (/^\/\/[^/]/.test(s)) s = s.slice(2);                   // UNC → ชื่อเครื่องอยู่ในส่วน host
  else if (!s.startsWith('/')) prefix = 'file:///';          // C:/… (หรือ path สัมพัทธ์ = ดีที่สุดที่ทำได้)
  const parts = s.split('/').map((seg, i) =>
    (i === 0 && /^[A-Za-z]:$/.test(seg)) ? seg : encodeURIComponent(seg));
  return prefix + parts.join('/');
}

/**
 * ══ [alpha.149] src ของรูปในเนื้อฉาก → URL ที่เปิดได้จริง "จากที่ไหนก็ได้" ══
 *
 * เนื้อฉากเก็บรูปเป็น path สัมพัทธ์กับ **ไฟล์ฉาก** (`../../../../../Images/x.png`) ซึ่งมีความหมาย
 * เฉพาะตอนอ่านจากข้างไฟล์ฉาก · ตัวแก้ไขแปลงให้ด้วย `resolveImg(dir, rel)` แต่ HTML ที่ประกอบจาก
 * `mdToHtmlBody()` ถูกเอาไปวางที่อื่นเสมอ:
 *   · โหมดอ่านทั้งเล่ม / ช่องตัวอย่างส่งออก → วางในหน้าโปรแกรม = นับจาก `renderer/index.html`
 *     (log จริง: `file:///C:/Images/sunset.png` — ถอยห้าชั้นจากโฟลเดอร์ renderer)
 *   · PDF ของนิยาย → เขียนเป็นไฟล์ชั่วคราวใน `%TEMP%/killian2-pdf/` แล้วค่อยพิมพ์
 * → รูปหายทั้งสามที่ · รูปของโปรเจกต์อยู่ใต้ `<root>/Images/` เสมอ (รวมอัลบั้มย่อย) จึงยึดส่วนหลัง
 *   `Images/` ตัวสุดท้ายแล้วต่อกับรากโปรเจกต์ — ไม่ต้องรู้ว่าฉากอยู่ลึกกี่ชั้น
 * @param {string} root รากโปรเจกต์
 * @param {string} src  ค่าในวงเล็บของ `![](…)`
 */
export function projectImageUrl(root, src) {
  const s = String(src == null ? '' : src).trim();
  if (!s || /^(data:|https?:|file:|blob:)/i.test(s)) return s;
  const norm = s.replace(/\\/g, '/');
  if (/^([A-Za-z]:\/|\/)/.test(norm)) return fileUrlFromPath(norm);   // path เต็มอยู่แล้ว
  if (!root) return s;
  const k = norm.lastIndexOf('/Images/');
  const rel = k >= 0 ? 'Images/' + norm.slice(k + 8)
    : norm.startsWith('Images/') ? norm
    : norm.replace(/^(\.\.?\/)+/, '');                                // ไม่ได้อยู่ใน Images → นับจากราก
  return fileUrlFromPath(String(root).replace(/[\\/]+$/, '') + '/' + rel);
}
