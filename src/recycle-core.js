// recycle-core.js — [alpha.148] ตรรกะถังขยะที่ไม่แตะดิสก์ (บริสุทธิ์ 100% · unit test ได้)
//
// ── ต้นตอบั๊ก "ล้างถังขยะลบของที่เพิ่งลบวันนี้" ──
// เดิมตัดสินอายุด้วย mtime ของไฟล์ในถัง แต่การย้ายลงถัง = rename ซึ่ง **ไม่เปลี่ยน mtime**
// ฉากที่แก้ครั้งสุดท้ายเมื่อ 40 วันก่อนแล้วลบวันนี้ จึงขึ้นในกล่อง "เก่าเกิน 30 วัน" ทันที
// เวลาที่ลบจริงถูกฝังไว้ในชื่อไฟล์อยู่แล้วตั้งแต่แรก: `<Date.now() ฐาน 36>-<ชื่อเดิม>`

const MIN_TS = Date.UTC(2020, 0, 1);          // ก่อนหน้านี้ไม่มี Killian 2 → ตัวเลขที่ถอดได้ต่ำกว่านี้ = ไม่ใช่เวลาประทับ
const DAY = 86400000;

/**
 * เวลาที่ของชิ้นนี้ถูกย้ายลงถัง
 * @param {string} name ชื่อในโฟลเดอร์ Recycle
 * @param {number} mtime ใช้เมื่อชื่อไม่มีเวลาประทับ (ของที่ผู้ใช้ลากมาวางเอง ฯลฯ)
 */
export function trashedAt(name, mtime, now = Date.now()) {
  const m = /^([0-9a-z]{8,9})-/.exec(String(name || ''));
  if (m) {
    const t = parseInt(m[1], 36);
    if (t >= MIN_TS && t <= now + DAY) return t;
  }
  return Number(mtime) || 0;
}

/** ไฟล์ประกอบที่ติดไปกับของจริง (ใบกู้คืน / ตารางเล่าด้วยภาพ) — ไม่ใช่ "หนึ่งรายการ" ในถัง */
export function isTrashCompanion(name) {
  return /\.k2restore\.json$/i.test(String(name || '')) || /\.vis\.csv$/i.test(String(name || ''));
}

/**
 * รายการที่เกินอายุ
 * @param {{name:string, mtime:number}[]} entries ของในโฟลเดอร์ Recycle (ทั้งไฟล์และโฟลเดอร์)
 * @param {number} days เก็บไว้กี่วัน (≤0 = ไม่ล้าง)
 * @returns {string[]} ชื่อที่ต้องลบ (ไม่รวมไฟล์ประกอบ — ผู้เรียกลบตามไปเอง)
 */
export function purgeCandidates(entries, days, now = Date.now()) {
  if (!(Number(days) > 0)) return [];
  const cutoff = now - Number(days) * DAY;
  return (entries || [])
    .filter((e) => e && e.name && !isTrashCompanion(e.name) && !String(e.name).startsWith('._'))
    .filter((e) => trashedAt(e.name, e.mtime, now) < cutoff)
    .map((e) => e.name);
}

/**
 * ชื่อเดิมก่อนลงถัง — ตัดเวลาประทับข้างหน้าออก **เฉพาะเมื่อมันเป็นเวลาประทับจริง**
 * (ของเดิม `/^[a-z0-9]+-/` ตัด "my-" ออกจาก "my-note.md" ทั้งที่ไม่ใช่เวลาประทับ)
 */
export function originalName(name, now = Date.now()) {
  const s = String(name || '');
  const m = /^([0-9a-z]{8,9})-(.+)$/.exec(s);
  if (m) {
    const t = parseInt(m[1], 36);
    if (t >= MIN_TS && t <= now + DAY) return m[2];
  }
  return s;
}

/**
 * ชื่อทางเลือกลำดับที่ i สำหรับกันชนตอนกู้คืน (i=1 → ชื่อเดิม · 2 → `ชื่อ-2.นามสกุล` …)
 * @param {{dir?: boolean}} opts โฟลเดอร์ = ไม่แยกนามสกุล ("บทที่ 1.5" ต้องไม่กลายเป็น "บทที่ 1-2.5")
 */
export function nameCandidate(name, i, { dir = false } = {}) {
  const s = String(name || '');
  if (!(i > 1)) return s;
  const m = dir ? null : /^(.+?)(\.[^./\\]{1,10})$/.exec(s);
  return m ? m[1] + '-' + i + m[2] : s + '-' + i;
}
