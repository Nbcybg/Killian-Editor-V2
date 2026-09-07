// num.js — ตัวแปลงตัวเลขที่ปลอดภัยกับค่า 0 (กฎเหล็กข้อ 20)
// บริสุทธิ์ 100% ไม่ import อะไรเลย — โมดูลบริสุทธิ์ (sp-format/prose-format/pdf-generator/…)
// จึงใช้ร่วมกันได้โดยไม่ดึง core.js (ที่แตะ DOM) เข้ามา
//
// **ทำไมต้องมีไฟล์นี้**: `+x || d` คืนค่าเริ่มต้นเมื่อ x เป็น 0 / '' / NaN เหมือนกันหมด
// แต่ค่าที่อ่านจาก config มักมี 0 เป็นค่าที่ "ตั้งใจ" (linesBefore ของบทพูด = 0,
// xOffset ของหัวกระดาษ = 0, มุมลายน้ำ = 0) → กลายเป็นค่าเริ่มต้นเงียบ ๆ (บทเรียน 5 + 65)

/** แปลงเป็นตัวเลข — ไม่ใช่ตัวเลขจริง (NaN/null/undefined/'') จึงคืนค่าเริ่มต้น d */
export function num(v, d = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

/** num() + หนีบช่วง — ใช้กับค่าที่มีขอบเขตชัดเจน (ขนาดฟอนต์ / ความทึบ / มุม) */
export function numClamp(v, d, min, max) {
  const n = num(v, d);
  return Math.min(max, Math.max(min, n));
}

/** num() + ปัดเป็นจำนวนเต็ม */
export function numInt(v, d = 0) {
  return Math.round(num(v, d));
}

/**
 * แฮชสั้น ๆ ของข้อความ (djb2) — "เนื้อหาเปลี่ยนไปจากตอนที่จดไว้หรือยัง"
 * ย้ายมาจาก ai-summary.js ตอน alpha.87 (ที่นั่น import core.js ซึ่งแตะ DOM
 * → โมดูลบริสุทธิ์อย่าง convert.js เรียกไม่ได้) · ai-summary.js re-export ตัวนี้ต่อ
 * **มีที่เดียวในโปรแกรม** — ห้ามเขียนแฮชตัวใหม่ ค่าที่จดไว้ในไฟล์งานต้องตรงกันข้ามเวอร์ชัน
 */
export function hashText(s) {
  const t = String(s ?? '');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
