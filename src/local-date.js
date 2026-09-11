// local-date.js — [alpha.148] วันที่/เวลา "ตามนาฬิกาของเครื่อง" (บริสุทธิ์ 100% · ไม่ import อะไรเลย)
//
// ต้นตอ: ทั้งโปรแกรมใช้ `new Date().toISOString().slice(0, 10)` เป็น "วันนี้" ซึ่งเป็นวันที่ **UTC**
// ผู้ใช้อยู่ UTC+7 → ช่วง 00:00–06:59 ถูกนับเป็น "เมื่อวาน" (สถิติคำรายวัน · วันเขียนติดต่อ ·
// โฟลเดอร์สำรอง · วันที่บน PDF) และประวัติเวอร์ชันฉากโชว์เวลาช้าไป 7 ชั่วโมง
// **ที่ไหนต้องการ "วันนี้ของผู้ใช้" ให้เรียกตัวนี้ ห้ามใช้ toISOString**

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD ตามนาฬิกาของเครื่อง */
export function localDay(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
}

/** เลื่อนวัน (บวก/ลบ) จากสตริง YYYY-MM-DD — คิดตามปฏิทิน ไม่ใช่ ±86,400,000 ms (กันวันที่มีเวลาออมแสง) */
export function addDays(day, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return '';
  return localDay(new Date(+m[1], +m[2] - 1, +m[3] + (Number(n) || 0)));
}

/**
 * แสดงเวลาของชื่อไฟล์เวอร์ชัน (`2026-07-20T08-30-00-000` ซึ่งเป็น **UTC** มาตั้งแต่แรก) เป็นเวลาเครื่อง
 * ชื่อไฟล์ยังเป็น UTC ต่อไป (เรียงลำดับได้ถูกต้องเสมอ ไม่ปนกันระหว่างของเก่า/ใหม่) — แก้แค่ตอนแสดง
 * @returns {string} `20/07/2026 15:30` · รูปแบบที่อ่านไม่ออก = คืนค่าเดิม
 */
export function fmtUtcStamp(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/.exec(ts || '');
  if (!m) return ts || '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
         pad(d.getHours()) + ':' + pad(d.getMinutes());
}
