// text-case.js — สลับรูปแบบตัวพิมพ์ของข้อความที่เลือก (alpha.60r2 · ข้อ 2)
// โมดูลบริสุทธิ์ 100% — ไม่แตะ DOM/ProseMirror/kapi จึงมี unit test แยก (test/text-case.test.cjs)
//
// ไทยไม่มีตัวพิมพ์ใหญ่/เล็ก → ทุกโหมดปล่อยอักษรไทยไว้เหมือนเดิมโดยอัตโนมัติ
// (toUpperCase/toLowerCase ของ JS คืนตัวเดิมสำหรับอักษรที่ไม่มีคู่ตัวพิมพ์)

import { T } from './i18n.js';
/** รหัสโหมดตามที่ผู้ใช้ระบุ — ใช้เป็น value ของ <select> และอาร์กิวเมนต์ของคำสั่ง `case` */
export const CASE_MODES = ['SC', 'lc', 'UC', 'CC', 'aC', 'TC', 'iC'];

export const CASE_LABELS = {
  SC: T`Sentence case — ขึ้นต้นประโยคตัวใหญ่`,
  lc: T`lower case — ตัวเล็กทั้งหมด`,
  UC: T`UPPER CASE — ตัวใหญ่ทั้งหมด`,
  CC: T`Capitalize Case — ขึ้นต้นทุกคำ`,
  aC: T`aLtErNaTe cAsE — สลับตัวเล็ก/ใหญ่`,
  TC: T`Title Case — แบบชื่อเรื่อง`,
  iC: T`iNVERSE cASE — กลับตัวเล็ก↔ใหญ่`,
};

/** ป้ายสั้นสำหรับปุ่ม/เมนู (ไม่มีคำอธิบายต่อท้าย) */
export const CASE_SHORT = {
  SC: 'Sentence case', lc: 'lower case', UC: 'UPPER CASE', CC: 'Capitalize Case',
  aC: 'aLtErNaTe', TC: 'Title Case', iC: 'iNVERSE cASE',
};

export const isCaseMode = (m) => CASE_MODES.includes(m);

// คำเล็กใน Title Case แบบสากล (ไม่ใส่ตัวใหญ่ ยกเว้นคำแรก/คำสุดท้าย)
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in', 'nor', 'of',
  'on', 'or', 'per', 'the', 'to', 'v', 'v.', 'via', 'vs', 'vs.', 'from', 'into',
  'over', 'with', 'upon', 'onto',
]);

// ตัวอักษรที่ "มีคู่ตัวพิมพ์" จริง — ใช้ตัดสินว่าจะนับเป็นตัวที่ต้องสลับใน aC/iC ไหม
const hasCase = (ch) => ch.toLowerCase() !== ch.toUpperCase();
const isUpper = (ch) => hasCase(ch) && ch === ch.toUpperCase();

/** ตัวอักษรตัวแรกที่มีคู่ตัวพิมพ์ในสตริง → ทำเป็นตัวใหญ่ (ข้ามเครื่องหมาย/ช่องว่าง/อักษรไทย) */
function upperFirstLetter(s) {
  for (let i = 0; i < s.length; i++) {
    if (hasCase(s[i])) return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
    // อักษรไทย/ตัวเลข = ไม่มีตัวใหญ่ ถือว่า "ขึ้นต้นแล้ว" ไม่ต้องไล่หาตัวถัดไป
    if (/[^\s\p{P}\p{S}]/u.test(s[i])) return s;
  }
  return s;
}

/** Sentence case — ตัวแรกของแต่ละประโยคเป็นตัวใหญ่ ที่เหลือตัวเล็ก */
export function sentenceCase(text) {
  const lower = String(text).toLowerCase();
  // แบ่งเป็น "ประโยค" ด้วย . ! ? … และการขึ้นบรรทัดใหม่ (เก็บตัวคั่นไว้ด้วย)
  return lower.replace(/(^|[.!?…]["')\]]?\s+|\n\s*)([^]*?)(?=$|[.!?…]["')\]]?\s+|\n)/g,
    (m, sep, body) => sep + upperFirstLetter(body));
}

/** Capitalize Case — ขึ้นต้นทุกคำเป็นตัวใหญ่ ที่เหลือตัวเล็ก */
export function capitalizeCase(text) {
  return String(text).toLowerCase().replace(/[^\s]+/g, (w) => upperFirstLetter(w));
}

/** Title Case — เหมือน Capitalize Case แต่คำเชื่อมสั้นเป็นตัวเล็ก (ยกเว้นคำแรก/คำสุดท้าย) */
export function titleCase(text) {
  const src = String(text);
  // ทำทีละบรรทัด — คำสุดท้ายของแต่ละบรรทัดต้องเป็นตัวใหญ่เสมอ
  return src.split('\n').map((line) => {
    const parts = line.split(/(\s+)/);            // เก็บช่องว่างไว้ (index คี่ = ช่องว่าง)
    const wordIdx = [];
    for (let i = 0; i < parts.length; i++) if (i % 2 === 0 && parts[i]) wordIdx.push(i);
    for (let k = 0; k < wordIdx.length; k++) {
      const i = wordIdx[k];
      const w = parts[i].toLowerCase();
      const bare = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const first = k === 0, last = k === wordIdx.length - 1;
      parts[i] = (!first && !last && SMALL_WORDS.has(bare)) ? w : upperFirstLetter(w);
    }
    return parts.join('');
  }).join('\n');
}

/** aLtErNaTe cAsE — เริ่มตัวเล็ก แล้วสลับทุก "ตัวอักษรที่มีคู่ตัวพิมพ์" (เว้นวรรค/ไทยไม่นับรอบ) */
export function alternateCase(text) {
  let up = false;
  let out = '';
  for (const ch of String(text)) {
    if (!hasCase(ch)) { out += ch; continue; }
    out += up ? ch.toUpperCase() : ch.toLowerCase();
    up = !up;
  }
  return out;
}

/** iNVERSE cASE — กลับตัวเล็ก↔ตัวใหญ่ทีละตัว */
export function inverseCase(text) {
  let out = '';
  for (const ch of String(text)) {
    if (!hasCase(ch)) { out += ch; continue; }
    out += isUpper(ch) ? ch.toLowerCase() : ch.toUpperCase();
  }
  return out;
}

/**
 * แปลงข้อความตามโหมด — โหมดที่ไม่รู้จักคืนข้อความเดิม (ไม่ throw)
 * @param {string} text
 * @param {'SC'|'lc'|'UC'|'CC'|'aC'|'TC'|'iC'} mode
 */
export function applyCase(text, mode) {
  const s = text == null ? '' : String(text);
  switch (mode) {
    case 'SC': return sentenceCase(s);
    case 'lc': return s.toLowerCase();
    case 'UC': return s.toUpperCase();
    case 'CC': return capitalizeCase(s);
    case 'aC': return alternateCase(s);
    case 'TC': return titleCase(s);
    case 'iC': return inverseCase(s);
    default: return s;
  }
}

/** โหมดถัดไปในวง (ปุ่มเดียวกดวนได้) */
export function nextCase(mode) {
  const i = CASE_MODES.indexOf(mode);
  return CASE_MODES[(i < 0 ? -1 : i) + 1] || CASE_MODES[0];
}

// ───────── สะพานไป ProseMirror ─────────
// ไม่ import prosemirror เลย — รับ `state` เข้ามาแล้วใช้เฉพาะ API ที่ทุก editor ในโปรเจกต์มีเหมือนกัน
// (state.selection / state.doc.nodesBetween / state.tr / state.schema.text) → unit test ด้วย state ปลอมได้

/** ช่วงข้อความจริงในช่วงที่เลือก (พร้อม marks เดิม) — ใช้ทั้งแปลงและทดสอบ */
export function selectedTextRanges(state) {
  const sel = state && state.selection;
  if (!sel || sel.empty) return [];
  const { from, to } = sel;
  const out = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const s = Math.max(from, pos), e = Math.min(to, pos + node.nodeSize);
    if (e <= s) return;
    out.push({ from: s, to: e, text: node.text.slice(s - pos, e - pos), marks: node.marks || [] });
  });
  return out;
}

/**
 * สร้าง transaction ที่เปลี่ยนรูปตัวพิมพ์ของ "ช่วงที่เลือก" โดย **คงรูปแบบตัวอักษรไว้ครบ**
 * (ตัวหนา/เอียง/ลิงก์/mention ไม่หาย เพราะแทนที่ทีละ text node พร้อม marks เดิม)
 * @returns transaction หรือ null เมื่อไม่มีอะไรต้องเปลี่ยน
 */
export function caseTransform(state, mode) {
  if (!isCaseMode(mode)) return null;
  const ranges = selectedTextRanges(state);
  if (!ranges.length) return null;

  // แปลงจาก "ข้อความรวมทั้งช่วง" เพื่อให้ Sentence/Title case มองเห็นประโยคที่คร่อมตัวหนา/เอียงได้ถูก
  const whole = ranges.map((r) => r.text).join('');
  const out = applyCase(whole, mode);
  // toUpperCase บางตัวอักษรยาวขึ้น (ß → SS) → ตัดกลับตามช่วงเดิมไม่ได้ ให้แปลงทีละช่วงแทน
  const sliceable = out.length === whole.length;

  let tr = state.tr, changed = false, off = 0;
  const pieces = ranges.map((r) => {
    const next = sliceable ? out.slice(off, off + r.text.length) : applyCase(r.text, mode);
    off += r.text.length;
    return next;
  });
  // แทนที่จากท้ายมาหน้า — ตำแหน่งของช่วงก่อนหน้าจึงไม่ขยับ
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i], next = pieces[i];
    if (!next || next === r.text) continue;
    tr = tr.replaceWith(r.from, r.to, state.schema.text(next, r.marks));
    changed = true;
  }
  return changed ? tr : null;
}
