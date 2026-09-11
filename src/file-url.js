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
