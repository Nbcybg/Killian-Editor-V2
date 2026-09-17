// logline.js — [alpha.157] Logline 6 ช่องของโปรเจกต์/เล่ม = "เข็มทิศเรื่อง" ให้ AI (บริสุทธิ์ · unit test)
//
// ผู้ใช้: *"ใน project และ เล่ม เพิ่ม field คือ logline … 1. logline แบบไม่แยก 2. ตัวละครหลัก
//          3. เหตุการณ์กระตุ้น 4. เป้าหมาย 5. อุปสรรค/ตัวร้าย 6. เดิมพัน
//          ซึ่งส่วนนี้ AI จะช่วยจับได้ เพื่อช่วยในการเขียนที่ไม่หลุดมากเกินไป"*
//
// ที่เก็บ: project.khn.json → `logline` · section.json → `logline` (object เดียวกันทั้งสองชั้น)
// AI ทุกฟีเจอร์ได้เข็มทิศนี้ผ่าน `registryClient` ของ ai-bridge.js (จุดเดียวที่ทุกคำขอวิ่งผ่าน)
// เล่มที่มี logline ของตัวเอง = ทับเฉพาะช่องที่กรอก · ช่องว่างตกไปใช้ของโปรเจกต์

export const LOGLINE_KEYS = ['logline', 'protagonist', 'inciting', 'goal', 'obstacle', 'stakes'];
/** คีย์ภาษาของป้ายแต่ละช่อง (ป้าย + คำอธิบายสั้นใต้ช่อง) */
export const LOGLINE_LABEL_KEYS = {
  logline: 'ui.logline.logline', protagonist: 'ui.logline.protagonist', inciting: 'ui.logline.inciting',
  goal: 'ui.logline.goal', obstacle: 'ui.logline.obstacle', stakes: 'ui.logline.stakes',
};
export const LOGLINE_HINT_KEYS = {
  logline: 'ui.logline.hLogline', protagonist: 'ui.logline.hProtagonist', inciting: 'ui.logline.hInciting',
  goal: 'ui.logline.hGoal', obstacle: 'ui.logline.hObstacle', stakes: 'ui.logline.hStakes',
};
export const COMPASS_LIMIT = 600;   // อักขระต่อช่องที่ส่งเข้าโมเดล — กันเข็มทิศกินงบโทเคน

/** อะไรก็ได้ → { logline:'', protagonist:'', … } (ตัดช่องว่างหัวท้าย · ค่าไม่ใช่สตริงทิ้ง) */
export function normalizeLogline(v) {
  const src = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const out = {};
  for (const k of LOGLINE_KEYS) out[k] = typeof src[k] === 'string' ? src[k].trim() : '';
  return out;
}
export function isLoglineEmpty(v) {
  const n = normalizeLogline(v);
  return LOGLINE_KEYS.every((k) => !n[k]);
}
/** สำหรับเขียนลงไฟล์ — ช่องว่างไม่เขียน · ว่างทั้งก้อน = undefined (ลบคีย์ทิ้ง) */
export function compactLogline(v) {
  const n = normalizeLogline(v);
  const out = {};
  for (const k of LOGLINE_KEYS) if (n[k]) out[k] = n[k];
  return Object.keys(out).length ? out : undefined;
}
/** เล่มทับโปรเจกต์เฉพาะช่องที่กรอก */
export function mergeLogline(project, book) {
  const p = normalizeLogline(project), b = normalizeLogline(book);
  const out = {};
  for (const k of LOGLINE_KEYS) out[k] = b[k] || p[k];
  return out;
}

/**
 * ข้อความเข็มทิศสำหรับแปะท้าย system prompt
 * @param {object} project logline ของโปรเจกต์
 * @param {object} book    logline ของเล่มที่กำลังเขียน (ไม่มีก็ได้)
 * @param {{head:string, labels:Object<string,string>, rule:string, bookTitle?:string}} text ข้อความตามภาษา
 * @returns {string} '' = ไม่มีอะไรให้ส่ง
 */
export function compassText(project, book, text = {}) {
  const m = mergeLogline(project, book);
  const lines = [];
  for (const k of LOGLINE_KEYS) {
    if (!m[k]) continue;
    const v = m[k].length > COMPASS_LIMIT ? m[k].slice(0, COMPASS_LIMIT) + '…' : m[k];
    lines.push('- ' + ((text.labels && text.labels[k]) || k) + ': ' + v.replace(/\s*\n+\s*/g, ' '));
  }
  if (!lines.length) return '';
  return [(text.head || 'Story compass') + (text.bookTitle ? ' — ' + text.bookTitle : ''), ...lines, text.rule || ''].filter(Boolean).join('\n');
}

/** ต่อเข็มทิศเข้ากับ system prompt เดิม (ไม่ซ้ำถ้าเคยต่อแล้ว) */
export function withCompass(system, compass) {
  const s = String(system || '');
  if (!compass || s.includes(compass)) return s;
  return s ? s + '\n\n' + compass : compass;
}
