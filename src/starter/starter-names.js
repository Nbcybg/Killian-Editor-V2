// starter-names.js — [alpha.116 ข้อ 10] **เดาชื่อตัวละครจากเรื่องย่อ** (บริสุทธิ์ 100% · มี unit test)
//
// ผู้ใช้: *"ใน story starter ในการสร้างเรื่องย่อ มักจะถูกกำหนดชื่อตัวละคร
//         ดังนั้นเมื่อเข้าหน้าตัวละคร ควรมี suggestion"*
//
// ═══ ทำไมถึงไม่ใช่แค่ regex เดียวจบ ═══
// ภาษาไทยไม่มีช่องว่างคั่นคำ — "ชายหนุ่มชื่อโทระเดินเข้ามา" ตัดตรงไหนก็ได้ทั้งนั้น
// ถ้าเดาด้วยความยาวตายตัวจะได้ "โทระเดิน" หรือ "โทร" ซึ่งแย่กว่าไม่แนะนำอะไรเลย
//
// จึงใช้สามด่านที่ **มั่นใจได้จริง** เท่านั้น แล้วยอมพลาดของที่ไม่ชัด:
//   1. อยู่ในเครื่องหมายคำพูด — คนเขียนตั้งใจเน้นว่านี่คือชื่อ
//   2. ตามหลังคำนำหน้า ("ชื่อว่า…" · "นาย…" · "เจ้าหญิง…") — ตัดคำด้วย `Intl.Segmenter('th')`
//      ซึ่งเป็นตัวตัดคำไทยของระบบ (ตัวเดียวกับที่ search-engine.js ใช้)
//   3. คำภาษาอังกฤษที่ขึ้นต้นด้วยตัวพิมพ์ใหญ่
// แล้วจัดอันดับด้วย "ถูกเอ่ยถึงกี่ครั้งในเรื่องย่อ" — ตัวละครหลักถูกเอ่ยซ้ำเสมอ
//
// ของที่เดาไม่ได้ ผู้ใช้ยังกดปุ่มถาม AI ได้อีกทาง (ฝั่ง UI) — ที่นี่คือด่านที่ทำงานแบบออฟไลน์
//
// ไฟล์นี้ไม่แตะ DOM/network

import { t } from '../i18n.js';
// ตัวถอด HTML ของ Story Description อยู่ที่ starter-model.js อยู่แล้ว — ห้ามมีสองตัว
import { introText } from './starter-model.js';

/** ความยาวชื่อที่ยอมรับ (สั้นกว่านี้ = เศษคำ · ยาวกว่านี้ = ทั้งวลี) */
export const NAME_MIN = 2;
export const NAME_MAX = 24;

/**
 * คำนำหน้าชื่อ — **เป็นข้อมูลภาษาไทย ไม่ใช่ข้อความ UI**
 * ใช้สแกนเรื่องย่อที่ผู้ใช้เขียนเป็นภาษาไทย · สลับภาษาหน้าจอเป็นอังกฤษแล้วยังต้องหาชื่อ
 * ในข้อความไทยได้เหมือนเดิม (เหตุผลเดียวกับคลังคำของ ai-analyze.js)
 */
/* i18n-skip: คลังคำไทยสำหรับสแกนต้นฉบับ ไม่ใช่ข้อความบนหน้าจอ */
export const NAME_MARKERS = [
  'ชื่อว่า', 'ที่ชื่อ', 'นามว่า', 'ชื่อ',
  'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'นาย', 'นาง', 'คุณ',
  'เจ้าชาย', 'เจ้าหญิง', 'ท่าน', 'หมอ', 'ครู', 'อาจารย์',
  'กัปตัน', 'จ่า', 'ผู้หมวด', 'ราชา', 'ราชินี',
];
/** คำที่ตามหลังคำนำหน้าแล้วแปลว่า "ไม่ใช่ชื่อคน" */
/* i18n-skip: คลังคำไทยสำหรับสแกนต้นฉบับ ไม่ใช่ข้อความบนหน้าจอ */
export const NAME_STOP = [
  'เรื่อง', 'ของ', 'นี้', 'นั้น', 'ที่', 'และ', 'หรือ', 'กับ', 'ใน', 'เมือง', 'โลก',
  'ตอน', 'บท', 'ฉาก', 'เขา', 'เธอ', 'มัน', 'ฉัน', 'ผม', 'เรา', 'คน', 'หนึ่ง', 'สอง',
];
/** คำอังกฤษที่ขึ้นต้นประโยคบ่อยจนไม่ควรนับเป็นชื่อ */
const EN_STOP = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'It', 'He', 'She', 'They',
  'This', 'That', 'When', 'Where', 'What', 'Who', 'And', 'But', 'For', 'With', 'His',
  'Her', 'Their', 'One', 'Two', 'After', 'Before', 'Then', 'There', 'Here', 'If', 'As']);

/** ถอดแท็ก HTML ออกจากคำบรรยาย (ตั้งแต่ alpha.96 เรื่องย่อเก็บเป็น HTML) */
export function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** ตัวตัดคำไทยของระบบ — ไม่มีก็ตกไปใช้ "ตัดที่ช่องว่าง/เครื่องหมาย" */
function segments(text) {
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('th', { granularity: 'word' });
      return [...seg.segment(text)].filter((s) => s.isWordLike).map((s) => s.segment);
    }
  } catch {}
  return String(text).split(/[\s,.;:!?()"'“”‘’«»「」『』\-–—]+/).filter(Boolean);
}

const clean = (s) => String(s || '').replace(/^[\s"'“”‘’«»「」『』]+|[\s"'“”‘’«»「」『』.,!?;:]+$/g, '').trim();
const okLen = (s) => s.length >= NAME_MIN && s.length <= NAME_MAX;

/** ชื่อที่อยู่ในเครื่องหมายคำพูด (ด่านที่ 1 — มั่นใจที่สุด) */
export function quotedNames(text) {
  const out = [];
  const RE = /[“"«「『‘']([^”"»」』‘']{1,24})[”"»」』’']/g;
  let m;
  while ((m = RE.exec(String(text || '')))) {
    const v = clean(m[1]);
    if (okLen(v) && !/[.!?]$/.test(v)) out.push(v);
  }
  return out;
}

/** ความยาวสูงสุดของ "ชื่อไทย" ที่ยอมรับหลังคำนำหน้า — ยาวกว่านี้แทบไม่ใช่ชื่อคนแล้ว */
export const THAI_NAME_MAX = 12;
/** จำนวนคำสูงสุดที่ยอมให้ชื่อหนึ่งชื่อมี (ตัดด้วย Intl.Segmenter) — มากกว่านี้คือวลี ไม่ใช่ชื่อ */
export const NAME_MAX_WORDS = 3;

/**
 * ชื่อที่ตามหลังคำนำหน้า (ด่านที่ 2)
 *
 * ★ สามกฎที่ทำให้ด่านนี้ "ยอมพลาด แต่ไม่มั่ว" — เพราะชิปที่แนะนำผิดจะสร้างตัวละคร
 * ชื่อผิดขึ้นมาจริงในโปรเจกต์ ซึ่งแย่กว่าไม่แนะนำอะไรเลย:
 *   1. **ต้องมีขอบเขตจริง** — ตัดถึงช่องว่าง/เครื่องหมาย/ท้ายบรรทัดเท่านั้น ไม่เดาความยาวเอง
 *      ("ชื่อว่าโทระ เดินเข้ามา" → "โทระ" · ไม่มีช่องว่างเลยก็ยอมพลาด)
 *   2. **ยาวเกิน 12 ตัวอักษร = ไม่ใช่ชื่อ** ("ชื่อเรื่องนี้ยังไม่ได้ตั้ง" จึงไม่กลายเป็นตัวละคร)
 *   3. **ขึ้นต้นด้วยคำทั่วไป หรือแตกได้เกิน 3 คำ = วลี ไม่ใช่ชื่อ** ("คุณของเขาหายไป")
 *
 * และสแกน **ซ้ายไปขวารอบเดียว โดยลองคำนำหน้ายาวก่อน** — เดิมวนทีละคำนำหน้าแยกกัน
 * ทำให้ "นางสาวแคสซี่" ถูก "นาง" แย่งแมตช์จนได้ชื่อผี "สาว" ติดมาด้วย
 */
export function markedNames(text) {
  const src = String(text || '');
  const out = [];
  const markers = [...NAME_MARKERS].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < src.length) {
    const mk = markers.find((x) => src.startsWith(x, i));
    if (!mk) { i++; continue; }
    i += mk.length;
    const rest = src.slice(i).replace(/^[\s:：]+/, '');
    const cand = clean(boundedChunk(rest));
    if (acceptName(cand)) out.push(cand);
  }
  return out;
}

/** ข้อความจนถึงขอบเขตจริงตัวแรก (ช่องว่าง/เครื่องหมาย/ท้ายข้อความ) */
function boundedChunk(rest) {
  const m = String(rest || '').match(/^[^\s.,!?;:·—–\-()"'“”‘’«»「」『』\n]{1,24}/);
  return m ? m[0] : '';
}

/** ผ่านเกณฑ์ "น่าจะเป็นชื่อคน" ไหม */
function acceptName(cand) {
  if (!okLen(cand)) return false;
  if (NAME_STOP.includes(cand) || NAME_MARKERS.includes(cand)) return false;
  // ฝรั่งมีช่องว่างคั่นอยู่แล้ว ผ่านเกณฑ์ความยาว/จำนวนคำโดยปริยาย
  if (/^[A-Za-z][A-Za-z'\-]*$/.test(cand)) return true;
  if (cand.length > THAI_NAME_MAX) return false;
  if (NAME_STOP.some((w) => cand.startsWith(w))) return false;
  const segs = segments(cand);
  return segs.length <= NAME_MAX_WORDS;
}

/** คำอังกฤษที่ขึ้นต้นด้วยตัวพิมพ์ใหญ่ (ด่านที่ 3) */
export function capitalizedNames(text) {
  const out = [];
  const RE = /\b([A-Z][a-z]{1,20})\b/g;
  let m;
  while ((m = RE.exec(String(text || '')))) {
    if (EN_STOP.has(m[1])) continue;
    out.push(m[1]);
  }
  return out;
}

/** นับว่าชื่อนี้ถูกเอ่ยถึงในข้อความกี่ครั้ง */
export function mentionCount(text, name) {
  const s = String(text || ''), n = String(name || '');
  if (!n) return 0;
  let c = 0, i = 0;
  for (;;) {
    const at = s.indexOf(n, i);
    if (at < 0) break;
    c++; i = at + n.length;
  }
  return c;
}

/**
 * ★ ชื่อตัวละครที่น่าจะมีอยู่ในเรื่องย่อ
 * @param {string} text  เรื่องย่อ (HTML ก็ได้ — ถอดแท็กให้เอง)
 * @param {object} [o] `{exclude:[ชื่อที่มีอยู่แล้ว], limit}`
 * @returns {Array<{name:string, hits:number, source:'quote'|'marker'|'caps'}>} เรียงจากมั่นใจสุด
 */
export function suggestNames(text, o = {}) {
  const src = stripHtml(text);
  if (!src) return [];
  const limit = Number.isFinite(o.limit) ? o.limit : 8;
  // ตัวที่มีในคณะแล้ว (รวมชื่อรอง) — เทียบแบบตัดช่องว่าง/ตัวพิมพ์ เพื่อไม่แนะนำซ้ำ
  const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
  const skip = new Set((o.exclude || []).map(norm).filter(Boolean));

  const found = new Map();                 // ชื่อ → {name, hits, source, rank}
  const add = (name, source, rank) => {
    const key = norm(name);
    if (!key || skip.has(key)) return;
    const old = found.get(key);
    if (old) { if (rank < old.rank) { old.rank = rank; old.source = source; } return; }
    found.set(key, { name, hits: mentionCount(src, name), source, rank });
  };
  for (const n of quotedNames(src)) add(n, 'quote', 0);
  for (const n of markedNames(src)) add(n, 'marker', 1);
  for (const n of capitalizedNames(src)) add(n, 'caps', 2);

  return [...found.values()]
    .sort((a, b) => a.rank - b.rank || b.hits - a.hits || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, hits, source }) => ({ name, hits, source }));
}

/** ข้อความบอกที่มาของชื่อ (tooltip ของชิปแนะนำ) */
export function sourceLabel(source) {
  if (source === 'quote') return t('ui.starter.nameFromQuote');
  if (source === 'marker') return t('ui.starter.nameFromMarker');
  return t('ui.starter.nameFromCaps');
}

/** ข้อความทั้งหมดที่ควรเอามาสแกน — เรื่องย่อ + คำโปรย + ช่อง 4W (ที่นั่นก็มีชื่อคนบ่อย) */
export function starterText(starter) {
  const s = starter || {};
  const rows = [s.blurb || '', introText(s)];
  for (const v of Object.values(s.w || {})) rows.push(String(v || ''));
  return rows.filter(Boolean).join('\n');
}
