// smart-terms.js — "โปรแกรมควรจำคำไหนไว้เดา" ของ SmartType บทภาพยนตร์
// (alpha.58 บั๊ก 1 — ต่อจาก alpha.57a ข้อ 4 ที่ยังกันคำมั่วไม่อยู่)
//
// ปัญหาเดิม: screenplayTerms() กวาด "ทุกบล็อกตัวละคร/หัวฉาก" มาเป็นคำเดา
//   → พิมพ์ผิดครั้งเดียว (เช่น "พมิมพ์") ก็ติดอยู่ในรายการเดาตลอดไป
//   .57a แก้ไปแล้ว 3 ชั้น (ข้ามบล็อกที่เคอร์เซอร์อยู่ · looksLikeTerm · รายการไม่จำ)
//   แต่ looksLikeTerm ตอนนั้นกรองแค่ "สั้นไป/ตัวเลขล้วน/ตัวซ้ำรัว" — คำที่พิมพ์สลับตัวอักษร
//   ยังหน้าตาเหมือนคำจริงทุกประการ ตัวกรองระดับตัวอักษรจึงจับไม่ได้ (และจับไม่ได้ตลอดไป)
//
// วิธีที่ได้ผลจริงคือ "ต้องเจอซ้ำ" — ชื่อตัวละคร/สถานที่ในบทย่อมถูกพิมพ์หลายครั้ง
// ส่วนคำพิมพ์มั่วมักโผล่ครั้งเดียว → ตั้งเกณฑ์ขั้นต่ำ (ค่าเริ่มต้น 2 บล็อก) แล้วเปิดทางลัดไว้ 3 ทาง:
//   1) ชื่อที่มีใน Wiki อยู่แล้ว = จำทันที ไม่ต้องนับ
//   2) ผู้ใช้กด "จำคำนี้" (pinned) = จำทันที
//   3) ผู้ใช้กด "ไม่จำ" (ignored) = ไม่จำเด็ดขาด แม้เจอซ้ำกี่ครั้ง
//
// บริสุทธิ์ 100% — ทดสอบด้วย node ได้ (test/smart-terms.test.cjs)

/** จำนวนบล็อกขั้นต่ำที่ต้องเจอคำนั้น ก่อนจะเอามาเดาให้ */
export const DEFAULT_LEARN_MIN = 2;
export const LEARN_MIN_RANGE = [1, 5];

/** ทำให้ค่าที่ผู้ใช้ตั้งอยู่ในช่วงที่ใช้ได้เสมอ */
export function learnMin(v) {
  const n = Math.round(parseFloat(v));
  if (!Number.isFinite(n)) return DEFAULT_LEARN_MIN;
  return Math.max(LEARN_MIN_RANGE[0], Math.min(LEARN_MIN_RANGE[1], n));
}

// อักขระไทยที่ "ขึ้นต้นคำไม่ได้" — สระบน/ล่าง วรรณยุกต์ ทัณฑฆาต นิคหิต พินทุ และสระที่ต้องตามหลังพยัญชนะ
const TH_NOT_FIRST = /^[ัำิ-ฺ็-๎ะๅๆ]/;
// วรรณยุกต์/ทัณฑฆาต 2 ตัวติดกัน = พิมพ์ค้าง ไม่ใช่คำจริง
const TH_DOUBLE_TONE = /[่-์]{2,}/;
// สระบน 2 ตัวติดกัน (ิ ี ึ ื ั) — ภาษาไทยไม่มี
const TH_DOUBLE_UPPER = /[ัิ-ื]{2,}/;
// พยัญชนะฝรั่งติดกันยาวเกินคำจริง (เช่น "qwrtpz")
const EN_CONS_RUN = /[bcdfghjklmnpqrstvwxz]{6,}/i;

/**
 * คำนี้ "หน้าตาเหมือนชื่อ" พอจะเก็บไว้เดาไหม — กรองระดับตัวอักษร (ด่านแรก)
 * ตัวกรองนี้จับได้แค่คำที่ผิดรูปชัดเจน · คำพิมพ์สลับตัวที่ยังอ่านออกต้องพึ่งเกณฑ์ "เจอซ้ำ"
 */
export function looksLikeTerm(txt) {
  const s = String(txt ?? '').trim();
  if (s.length < 2 || s.length > 60) return false;
  if (!/[\p{L}]/u.test(s)) return false;                  // ต้องมีตัวอักษรอย่างน้อยหนึ่งตัว
  if (/^[\d\s\p{P}]+$/u.test(s)) return false;            // ตัวเลข/เครื่องหมายล้วน
  if (/(.)\1{3,}/u.test(s)) return false;                 // "กกกกก" / "aaaaa"
  if (TH_NOT_FIRST.test(s)) return false;                 // ขึ้นต้นด้วยสระ/วรรณยุกต์ = พิมพ์หลุด
  if (TH_DOUBLE_TONE.test(s)) return false;
  if (TH_DOUBLE_UPPER.test(s)) return false;
  if (EN_CONS_RUN.test(s)) return false;
  // คำอังกฤษยาว ๆ ที่ไม่มีสระเลย = เคาะมั่ว
  if (/^[A-Za-z][A-Za-z'’\-]{3,}$/.test(s) && !/[aeiouy]/i.test(s)) return false;
  return true;
}

/** นับว่าแต่ละคำโผล่ในกี่บล็อก — คืน Map<คำ, จำนวนบล็อก> */
export function countTerms(entries) {
  const m = new Map();
  for (const e of entries || []) {
    const w = String(e ?? '').trim();
    if (!w) continue;
    m.set(w, (m.get(w) || 0) + 1);
  }
  return m;
}

const lower = (s) => String(s ?? '').trim().toLowerCase();
const toSet = (v) => new Set((Array.isArray(v) ? v : []).map(lower).filter(Boolean));

/**
 * คัดว่าคำไหน "จำได้" ตามเกณฑ์เจอซ้ำ + ทางลัด 3 ทาง
 * @param {Map<string,number>} counts   ผลจาก countTerms
 * @param {object} opts { min, pinned:[], ignored:[], known:[] }
 *        known = ชื่อที่มีใน Wiki อยู่แล้ว (จำทันทีไม่ต้องนับ)
 * @returns {string[]} คำที่เอาไปเดาได้ เรียงตามจำนวนครั้งมาก→น้อย
 */
export function learnedTerms(counts, opts = {}) {
  const min = learnMin(opts.min);
  const pinned = toSet(opts.pinned);
  const ignored = toSet(opts.ignored);
  const known = toSet(opts.known);
  const out = [];
  for (const [word, n] of counts || []) {
    const key = lower(word);
    if (ignored.has(key)) continue;
    // [alpha.58r บั๊ก 12] "ผู้ใช้กดจำเอง" ต้องชนะตัวกรองระดับตัวอักษร
    // เดิม looksLikeTerm อยู่ก่อน → คำที่ตกด่านแรก (เช่นชื่อเฉพาะแปลก ๆ) pin กลับมาไม่ได้เลย
    if (pinned.has(key)) { out.push([word, n]); continue; }
    if (!looksLikeTerm(word)) continue;
    if (n >= min || known.has(key)) out.push([word, n]);
  }
  out.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'));
  return out.map(([w]) => w);
}

/**
 * คำที่ "ยังไม่ผ่านเกณฑ์" — เอาไปแสดงในกล่องจัดการ SmartType ให้ผู้ใช้กดจำเองได้
 * @returns {Array<{word:string, count:number}>}
 */
export function pendingTerms(counts, opts = {}) {
  const min = learnMin(opts.min);
  const pinned = toSet(opts.pinned);
  const ignored = toSet(opts.ignored);
  const known = toSet(opts.known);
  const out = [];
  for (const [word, n] of counts || []) {
    const key = lower(word);
    if (ignored.has(key) || pinned.has(key) || known.has(key)) continue;
    if (n >= min) continue;
    out.push({ word, count: n, ok: looksLikeTerm(word) });
  }
  out.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'th'));
  return out;
}
