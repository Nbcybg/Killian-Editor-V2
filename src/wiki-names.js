// wiki-names.js — [trial 2026-10-25 ข้อ 7] ชื่อที่ "ใช้เรียกจริง" ของเอนทิตี้ที่ชื่อเต็มมีหลายคำ
// บริสุทธิ์ 100% (unit `wiki-names`)
//
// ผู้ใช้เจอ: ตัวละครชื่อ "ลลิตา วงศ์ปัญญา" มีชื่อเรียก "ลลิ" → ในเนื้อเรื่องเขียน "ลลิตา" (ชื่อต้นอย่างเดียว)
// แล้วไฮไลต์ติดแค่ "ลลิ" เหลือ "ตา" ไม่ติด — ตัวไฮไลต์เลือกชื่อที่ยาวที่สุดอยู่แล้ว แต่ "ลลิตา" ไม่อยู่ในรายชื่อเลย
// (ชื่อเต็มมีนามสกุลต่อ · ชื่อเรียกสั้นกว่า) · ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงขยายการจับคู่ด้วยตัวตัดคำไม่ได้
//
// กติกาแคบ ๆ ที่ไม่ไปจับคำอื่นมั่ว: คำในชื่อเต็มที่ **มีชื่อเรียกของเอนทิตี้เดียวกันเป็นคำนำหน้า**
// ("ลลิ" นำหน้า "ลลิตา") = ชื่อเรียกโดยนัย · คำอื่นของชื่อเต็ม (นามสกุล "วงศ์ปัญญา") ไม่ถูกเพิ่ม

/**
 * @param {string} name  ชื่อเต็มของเอนทิตี้
 * @param {string[]} aliases  ชื่อเรียกที่ผู้ใช้ตั้ง
 * @returns {string[]} ชื่อเรียกโดยนัยที่ควรนับด้วย (ไม่รวมตัวที่มีอยู่แล้ว)
 */
export function impliedNames(name, aliases) {
  const full = String(name || '').trim();
  const words = full.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const known = new Set([full, ...(Array.isArray(aliases) ? aliases : []).map((a) => String(a || '').trim()).filter(Boolean)]);
  const shorts = [...known].filter((a) => a.length >= 2);
  const out = [];
  for (const w of words) {
    if (w.length < 3 || known.has(w) || out.includes(w)) continue;
    if (shorts.some((a) => a !== w && a.length < w.length && w.startsWith(a))) out.push(w);
  }
  return out;
}
