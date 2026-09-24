// ai-text.js — ตัวช่วยนับ/ถอดข้อความของตัววิเคราะห์ (แยกจาก ai-analyze.js ใน alpha.164)
//
// แยกออกมาเพื่อให้ ai-doctor.js (ตรวจบท 5 หัวข้อ) ใช้ร่วมได้โดยไม่เกิด import วน
// (ai-analyze → ai-doctor → ai-analyze) · ai-analyze.js ส่งต่อ (re-export) ทุกตัวเหมือนเดิม
// โค้ดเก่าที่ import จาก ai-analyze.js จึงไม่ต้องแก้
//
// บริสุทธิ์ 100% — ไม่แตะ DOM / fs / network
import { tokenize } from '../search-engine.js';

// จุดจบประโยคไทย/อังกฤษ (ภาษาไทยไม่มีจุด → ใช้ช่องว่างยาว/ขึ้นบรรทัดเป็นตัวคั่นด้วย)
const SENT_SPLIT = /[.!?]+[\s"'”)\]]*|\n+|\s{2,}/;

/** ถอดมาร์กดาวน์/คอมเมนต์ออกให้เหลือข้อความที่ผู้อ่านเห็นจริง */
export function plainText(md) {
  return String(md || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')          // คอมเมนต์ align/meta ของ md.js
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // รูป
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // ลิงก์ → เหลือข้อความ
    .replace(/^#{1,6}\s+/gm, '')               // หัวข้อ
    .replace(/[*_`~>]/g, '')
    .replace(/\r/g, '')
    .trim();
}

/** คำจริง (ตัดคำไทยด้วยตัวเดียวกับระบบค้นหา) */
export function wordsOf(text) {
  return tokenize(plainText(text)).map((x) => x.word);
}
export function countWords(text) { return wordsOf(text).length; }

/** สัดส่วนบทสนทนา 0–1 (อักขระในเครื่องหมายคำพูด ÷ อักขระทั้งหมด) */
export function dialogueRatio(text) {
  const s = plainText(text);
  if (!s) return 0;
  let inside = 0;
  for (const m of s.matchAll(/[“"„«](.*?)[”"»]/gs)) inside += m[1].length;
  for (const m of s.matchAll(/^\s*[—–-]\s*(.+)$/gm)) inside += m[1].length;   // บทพูดแบบขีดนำ
  return Math.min(1, inside / s.length);
}

export function splitSentences(text) {
  return plainText(text).split(SENT_SPLIT).map((x) => x.trim()).filter(Boolean);
}

export function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
export function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

/** ชื่อ+ฉายาของตัวละครทุกตัว → ตารางค้นหา */
export function nameForms(c) {
  return [c.name, ...(c.aliases || [])].filter((x) => x && String(x).trim()).map(String);
}
/** นับจำนวนครั้งที่ชื่อ (หรือฉายา) โผล่ในข้อความ */
export function countMentions(text, character) {
  const s = plainText(text);
  let n = 0;
  for (const form of nameForms(character)) {
    if (!form) continue;
    let i = 0;
    while ((i = s.indexOf(form, i)) !== -1) { n++; i += form.length; }
  }
  return n;
}
