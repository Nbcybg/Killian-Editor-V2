// ai-doctor.js — "🩺 ตรวจบท" 5 หัวข้อของแผง AI วิเคราะห์ (alpha.164)
//
// ผู้ใช้ขอ: *"AI วิเคราะห์ ให้เพิ่ม 1. บทสนทนาไม่เป็นธรรมชาติ 2. จังหวะการเล่าเรื่อง (Pacing) อืดหรือเปล่า
//            3. ปมของเรื่องไม่สมเหตุสมผล 4. Out of character ไหม 5. โทนเรื่อง ต้องเพิ่มหรือลดอะไร
//            ตลก หรือ ดราม่า เพื่อไม่ให้หลุดโทนเรื่อง"*
//
// ใช้กติกาสองชั้นเดียวกับการ์ดเดิมทุกใบ (ดูหัวไฟล์ ai-analyze.js):
//   1) ชั้นคำนวณเอง — หา "สัญญาณ" ที่นับได้จริงจากต้นฉบับ (ฟรี · ผลเดิมทุกครั้ง · ไม่ต้องตั้งค่า AI)
//   2) ชั้น AI — เอาสัญญาณ + เนื้อฉาก (+ โปรไฟล์ตัวละคร/โทนที่ตั้งใจ) ไปให้โมเดลตัดสิน "ความหมาย"
// ชั้นแรก **ไม่ใช่คำตัดสิน** — เป็นแค่จุดที่ควรเปิดดู (ป้ายบนจอเขียนว่า "สัญญาณ" เสมอ)
//
// บริสุทธิ์ 100% — ไม่แตะ DOM / fs / network (unit test: test/ai-doctor.test.cjs)
// ai-analyze.js เป็นคน import ไฟล์นี้ (ทางเดียว) · ตัวช่วยนับข้อความมาจาก ai-text.js
import { t as tt, tf as ttf } from '../i18n.js';
import { gi } from '../icons.js';
import { parseScript, splitCharacter } from '../fountain.js';
import { plainText, countWords, dialogueRatio, splitSentences, mean, median, nameForms } from './ai-text.js';

export const DOCTOR_IDS = ['dialog', 'drag', 'logic', 'ooc', 'tone'];
export const isDoctor = (id) => DOCTOR_IDS.includes(id);

// ═══════════════ คลังคำ (ข้อมูลภาษาสำหรับสแกนต้นฉบับ — ไม่ใช่ข้อความบนจอ ห้ามแปล) ═══════════════
/* i18n-skip: คลังคำภาษาไทย/อังกฤษสำหรับสแกนต้นฉบับ (ไม่ใช่ข้อความบนจอ) */
// บทพูดที่ "บอกสิ่งที่ทั้งสองฝ่ายรู้อยู่แล้ว" — ร่องรอยคลาสสิกของบทพูดที่มีไว้อธิบายให้คนอ่านฟัง
export const EXPOSITION_MARKERS = [
  'อย่างที่รู้', 'อย่างที่เธอรู้', 'อย่างที่นายรู้', 'อย่างที่คุณรู้', 'อย่างที่แกรู้', 'อย่างที่เรารู้',
  'ก็รู้อยู่แล้วว่า', 'ก็รู้ ๆ อยู่', 'ก็รู้ๆอยู่', 'ไม่ต้องบอกก็รู้', 'จำได้ไหมว่า', 'อย่างที่บอกไปแล้ว',
  'as you know', 'as you’re aware', "as you're aware", 'as we both know', 'you already know',
];
// ภาษาเขียนที่หลุดเข้าไปในปากตัวละคร (คนไม่พูดแบบนี้ในชีวิตจริง)
export const WRITTEN_MARKERS = [
  'อย่างไรก็ตาม', 'ดังนั้น', 'นอกจากนี้', 'ทั้งนี้', 'กล่าวคือ', 'อนึ่ง', 'เนื่องจาก', 'ในขณะที่',
  'ซึ่งเป็นสิ่งที่', 'อันเป็น', 'ด้วยเหตุนี้', 'furthermore', 'therefore', 'moreover', 'nevertheless',
  'consequently', 'in addition',
];
// ทางลัด/ความบังเอิญ — ร่องรอยของปมที่แก้ด้วยโชคแทนเหตุผล
export const CONVENIENCE_MARKERS = [
  'บังเอิญ', 'โชคดีที่', 'โชคช่วย', 'จู่ ๆ', 'จู่ๆ', 'ทันใดนั้น', 'ปาฏิหาริย์', 'ไม่รู้ทำไม',
  'โดยไม่มีเหตุผล', 'อยู่ ๆ ก็', 'อยู่ๆก็', 'ไม่รู้ว่าทำไม', 'เหมือนฟ้าลิขิต',
  'suddenly', 'by chance', 'coincidence', 'luckily', 'out of nowhere', 'somehow', 'miraculously',
];
export const COMEDY_MARKERS = [
  'หัวเราะ', 'ขำ', 'ฮ่า', '555', 'แซว', 'ล้อเลียน', 'ตลก', 'กวนประสาท', 'หยอก', 'ยิ้มแห้ง',
  'เขกหัว', 'ขบขัน', 'ปล่อยมุก', 'lol', 'haha', 'laugh', 'joke', 'grin', 'giggle', 'chuckle',
];
export const DRAMA_MARKERS = [
  'ร้องไห้', 'น้ำตา', 'เจ็บปวด', 'สะอื้น', 'สูญเสีย', 'เสียใจ', 'โศก', 'ทรมาน', 'ความตาย',
  'เสียชีวิต', 'งานศพ', 'ลาก่อน', 'สิ้นหวัง', 'แตกสลาย', 'ปวดร้าว',
  'cry', 'cried', 'tears', 'grief', 'funeral', 'sob', 'despair', 'mourn',
];
// สรรพนามแทนตัวเอง + คำลงท้าย — น้ำเสียงของตัวละครที่เปลี่ยนกะทันหันคือสัญญาณ OOC ที่นับได้จริง
export const SELF_PRONOUNS = ['ข้าพเจ้า', 'กระผม', 'ดิฉัน', 'ผม', 'ฉัน', 'ชั้น', 'ข้า', 'กู', 'หนู', 'เค้า', 'อั๊ว', 'เดี๊ยน'];
export const END_PARTICLES = ['เจ้าค่ะ', 'ขอรับ', 'ครับ', 'ค่ะ', 'คะ', 'ฮะ', 'จ้ะ', 'จ้า', 'ว่ะ', 'วะ', 'เว้ย', 'โว้ย', 'ย่ะ'];
/* /i18n-skip */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => +(Number(v) || 0).toFixed(1);
const lower = (s) => String(s || '').toLowerCase();

/** หาคำในคลังที่โผล่ในข้อความ (ไม่สนตัวพิมพ์เล็กใหญ่ของอังกฤษ) → [{word, count}] */
export function markerHits(text, list) {
  const s = lower(text);
  const out = [];
  for (const w of list) {
    const k = lower(w);
    let n = 0, i = 0;
    while ((i = s.indexOf(k, i)) !== -1) { n++; i += k.length; }
    if (n) out.push({ word: w, count: n });
  }
  return out;
}
const hitCount = (hits) => hits.reduce((a, h) => a + h.count, 0);

/** ตัดข้อความยาวให้พอเป็นตัวอย่างบนจอ/ใน prompt */
export function clip(s, n = 140) {
  const x = String(s || '').replace(/\s+/g, ' ').trim();
  return x.length > n ? x.slice(0, n - 1) + '…' : x;
}

/** ประโยคแรกที่มีคำนั้น (ไว้โชว์เป็นหลักฐาน) */
function sentenceWith(text, word) {
  const k = lower(word);
  return splitSentences(text).find((x) => lower(x).includes(k)) || '';
}

// ═══════════════ ถอดบทพูด ═══════════════
/** ชื่อในบรรทัดตัวละครของบท → ชื่อเปล่า (ตัด V.O./O.S./cont'd) */
function speakerOf(text) {
  try { return String(splitCharacter(String(text || '')).name || '').trim(); }
  catch { return String(text || '').replace(/\(.*\)\s*$/, '').trim(); }
}

/** ตัวละครที่ชื่อ (หรือฉายา) ตรงกับผู้พูด — ไม่สนตัวพิมพ์ */
export function matchCharacter(speaker, characters = []) {
  const k = lower(speaker).trim();
  if (!k) return null;
  return characters.find((c) => nameForms(c).some((f) => lower(f) === k)) || null;
}

/**
 * ตัวละครที่น่าจะเป็นคนพูดในย่อหน้านิยาย — ชื่อที่โผล่ **นอกเครื่องหมายคำพูด** เร็วที่สุด
 * (เดาแบบนี้ผิดได้ จึงใช้เป็นสัญญาณเท่านั้น · บทภาพยนตร์ไม่ต้องเดา)
 */
function guessSpeaker(para, characters) {
  const outside = para.replace(/[“"„«][^“”"»]*[”"»]/g, ' ');
  let best = null, at = Infinity;
  for (const c of characters) {
    for (const f of nameForms(c)) {
      const i = outside.indexOf(f);
      if (i >= 0 && i < at) { at = i; best = c; }
    }
  }
  return best ? best.name : '';
}

/**
 * บทพูดทั้งหมดของฉาก — บทภาพยนตร์อ่านจากพาร์เซอร์ตัวจริง (ชื่อผู้พูดแม่น) ·
 * นิยายอ่านจากเครื่องหมายคำพูด/ขีดนำ แล้วเดาผู้พูดจากชื่อในย่อหน้าเดียวกัน
 * @returns {Array<{speaker:string, text:string}>}
 */
export function extractDialogue(scene = {}, characters = []) {
  const md = String(scene.text || '');
  const out = [];
  if (scene.format === 'screenplay') {
    let speaker = '';
    for (const b of parseScript(md)) {
      if (b.el === 'character') speaker = speakerOf(b.text);
      else if (b.el === 'dialogue') { if (b.text.trim()) out.push({ speaker, text: b.text.trim() }); }
      else if (b.el === 'parenthetical') continue;
      else speaker = '';
    }
    return out;
  }
  for (const para of plainText(md).split(/\n+/)) {
    const quotes = [...para.matchAll(/[“"„«]([^“”"»]{1,2000}?)[”"»]/g)].map((m) => m[1].trim()).filter(Boolean);
    const dash = /^\s*[—–]\s*(.+)$/.exec(para);
    if (dash && !quotes.length) quotes.push(dash[1].trim());
    if (!quotes.length) continue;
    const speaker = guessSpeaker(para, characters);
    for (const q of quotes) out.push({ speaker, text: q });
  }
  return out;
}

// ═══════════════ 1) บทสนทนาไม่เป็นธรรมชาติ ═══════════════
export const LONG_LINE_WORDS = 45;       // บทพูดต่อเนื่องยาวกว่านี้ = เทศนา/อ่านรายงาน
export const DIALOG_REASONS = ['long', 'exposition', 'written', 'vocative'];
// คีย์ภาษาเต็มของเหตุผล (ห้ามประกอบคีย์จากชิ้นส่วน — ตัวตรวจไฟล์ภาษามองไม่เห็น)
export const REASON_KEYS = {
  long: 'ui.aia.dlgR.long', exposition: 'ui.aia.dlgR.exposition', written: 'ui.aia.dlgR.written',
  vocative: 'ui.aia.dlgR.vocative',
  slow: 'ui.aia.dragR.slow', noConflict: 'ui.aia.dragR.noConflict', drag_long: 'ui.aia.dragR.long',
  narration: 'ui.aia.dragR.narration',
};
/** ข้อความเหตุผล — kind='drag' ใช้ป้ายของจังหวะอืด (คำว่า long ความหมายต่างกัน) */
export function reasonText(list, kind = 'dialog') {
  return (list || []).map((k) => tt(REASON_KEYS[kind === 'drag' && k === 'long' ? 'drag_long' : k] || '')).filter(Boolean).join(', ');
}

export function analyzeDialogue(scenes = [], characters = []) {
  const rows = [], flagged = [];
  let total = 0, long = 0, expo = 0, written = 0, voc = 0;
  for (const s of scenes) {
    const lines = extractDialogue(s, characters);
    let sLong = 0, sExpo = 0, sWritten = 0, sVoc = 0;
    const words = [];
    for (const ln of lines) {
      const w = countWords(ln.text);
      words.push(w);
      const reasons = [];
      if (w >= LONG_LINE_WORDS) { reasons.push('long'); sLong++; }
      if (markerHits(ln.text, EXPOSITION_MARKERS).length) { reasons.push('exposition'); sExpo++; }
      if (markerHits(ln.text, WRITTEN_MARKERS).length) { reasons.push('written'); sWritten++; }
      // เรียกชื่ออีกฝ่ายในบทพูด — ครั้งสองครั้งเป็นธรรมชาติ ทุกประโยคไม่ใช่
      const addressed = characters.some((c) => lower(c.name) !== lower(ln.speaker)
        && nameForms(c).some((f) => ln.text.includes(f)));
      if (addressed) sVoc++;
      if (reasons.length) flagged.push({ sceneId: s.id, title: s.title || s.id, speaker: ln.speaker,
                                         quote: clip(ln.text), reasons });
    }
    // เรียกชื่อบ่อยเกินครึ่งของบทพูดในฉาก (อย่างน้อย 4 ประโยค) = สัญญาณ
    const vocHeavy = lines.length >= 4 && sVoc / lines.length > 0.5;
    if (vocHeavy) flagged.push({ sceneId: s.id, title: s.title || s.id, speaker: '',
                                 quote: ttf('ui.aia.dlgVocNote', sVoc, lines.length), reasons: ['vocative'] });
    total += lines.length; long += sLong; expo += sExpo; written += sWritten; voc += vocHeavy ? 1 : 0;
    rows.push({ id: s.id, title: s.title, lines: lines.length, avgWords: round1(mean(words)),
                long: sLong, exposition: sExpo, written: sWritten, vocative: sVoc,
                score: sLong * 2 + sExpo * 3 + sWritten + (vocHeavy ? 2 : 0) });
  }
  return {
    rows, flagged: flagged.slice(0, 60), total,
    stats: [
      { label: tt('ui.aia.stDlgLines'), value: total },
      { label: tt('ui.aia.stDlgLong'), value: long },
      { label: tt('ui.aia.stDlgExpo'), value: expo },
      { label: tt('ui.aia.stDlgWritten'), value: written },
      { label: tt('ui.aia.stDlgVoc'), value: voc },
    ],
  };
}

// ═══════════════ 2) จังหวะอืด ═══════════════
/** ช่วงบรรยายยาวสุดของฉาก (ย่อหน้าติดกันที่ไม่มีบทพูดเลย) นับเป็นคำ */
export function longestNarration(text) {
  let best = 0, cur = 0;
  for (const p of plainText(text).split(/\n+/)) {
    if (!p.trim()) continue;
    if (dialogueRatio(p) > 0) { cur = 0; continue; }
    cur += countWords(p);
    if (cur > best) best = cur;
  }
  return best;
}
export const DRAG_FLAG = 50;             // คะแนนอืด ≥ นี้ = ฉากเสี่ยงอืด
export const DRAG_REASONS = ['slow', 'noConflict', 'long', 'narration'];

/**
 * คะแนน "อืด" 0–100 รายฉาก — รวมสี่สัญญาณ: จังหวะต่ำกว่าเฉลี่ย · ไม่มีร่องรอยความขัดแย้ง ·
 * ยาวกว่าฉากทั่วไป · มีช่วงบรรยายยาวไม่มีบทพูดคั่น
 * รับผลของ analyzePacing/analyzeConflict มาเลย (คำนวณครั้งเดียว ไม่ import ai-analyze วนกลับ)
 */
export function analyzeDrag(scenes = [], pace = { rows: [], avg: 0, sd: 0 }, conflict = { rows: [] }) {
  const med = median(scenes.map((s) => countWords(s.text))) || 1;
  const sd = Math.max(5, pace.sd || 0);
  const rows = scenes.map((s, i) => {
    const p = pace.rows[i] || { tempo: pace.avg, words: countWords(s.text) };
    const c = conflict.rows[i] || { score: 0, density: 0 };
    const words = p.words ?? countWords(s.text);
    const narr = longestNarration(s.text);
    const slow = clamp((pace.avg - p.tempo) / sd, 0, 2) / 2;
    const noConf = c.score === 0 ? 1 : c.density < 1 ? 0.5 : 0;
    const long = clamp((words - med) / med, 0, 1);
    const narration = clamp((narr - 150) / 350, 0, 1);
    const drag = Math.round(100 * (0.35 * slow + 0.25 * noConf + 0.2 * long + 0.2 * narration));
    const reasons = [];
    if (slow >= 0.25) reasons.push('slow');
    if (noConf === 1) reasons.push('noConflict');
    if (long >= 0.5) reasons.push('long');
    if (narration > 0) reasons.push('narration');
    return { id: s.id, title: s.title, words, tempo: p.tempo, conflict: c.score, narration: narr,
             drag: words > 60 ? drag : 0, reasons };
  });
  const flagged = rows.filter((r) => r.drag >= DRAG_FLAG);
  // ช่วงอืดติดกันตั้งแต่ 2 ฉาก = ผู้อ่านเริ่มวางหนังสือ
  const runs = [];
  let cur = [];
  for (const r of rows) {
    if (r.drag >= DRAG_FLAG) cur.push(r);
    else { if (cur.length >= 2) runs.push(cur); cur = []; }
  }
  if (cur.length >= 2) runs.push(cur);
  return {
    rows, flagged,
    runs: runs.map((g) => ({ from: g[0].title || g[0].id, to: g[g.length - 1].title || g[g.length - 1].id,
                             count: g.length, sceneId: g[0].id })),
    stats: [
      { label: tt('ui.aia.stDragScenes'), value: flagged.length + '/' + rows.length },
      { label: tt('ui.aia.stDragRuns'), value: runs.length },
      { label: tt('ui.aia.stDragNarr'), value: Math.max(0, ...rows.map((r) => r.narration)) },
      { label: tt('ui.aia.stDragAvg'), value: round1(mean(rows.map((r) => r.drag))) },
    ],
  };
}

// ═══════════════ 3) ปมไม่สมเหตุสมผล ═══════════════
export function analyzeLogic(scenes = []) {
  const n = scenes.length;
  const rows = [];
  let total = 0, late = 0;
  scenes.forEach((s, i) => {
    const hits = markerHits(plainText(s.text), CONVENIENCE_MARKERS);
    const c = hitCount(hits);
    if (!c) return;
    total += c;
    // ความบังเอิญในช่วงท้ายเรื่อง (25% สุดท้าย) หนักกว่าช่วงต้น — มักเป็นตอนคลี่คลายปม
    const isLate = n >= 4 && i >= Math.floor(n * 0.75);
    if (isLate) late += c;
    rows.push({ id: s.id, title: s.title, count: c, late: isLate,
                words: hits.map((h) => h.word),
                quote: clip(sentenceWith(plainText(s.text), hits[0].word)) });
  });
  rows.sort((a, b) => (b.late - a.late) || (b.count - a.count));
  return {
    rows, total, late,
    stats: [
      { label: tt('ui.aia.stLogicHits'), value: total },
      { label: tt('ui.aia.stLogicScenes'), value: rows.length + '/' + n },
      { label: tt('ui.aia.stLogicLate'), value: late },
    ],
  };
}

// ═══════════════ 4) Out of character ═══════════════
/** นับสรรพนามแทนตัวเอง/คำลงท้ายในบทพูด (คำลงท้ายต้องอยู่ท้ายวลีจริง ไม่ใช่กลางคำ เช่น "คะแนน") */
export function voiceForms(text) {
  const s = String(text || '');
  const pron = {}, part = {};
  // ยาวก่อนสั้น แล้วลบรูปที่นับแล้วออก — "ผม" ใน "กระผม" / "ข้า" ใน "ข้าพเจ้า" ไม่ถูกนับซ้ำ
  let rest = s;
  for (const p of [...SELF_PRONOUNS].sort((a, b) => b.length - a.length)) {
    const parts = rest.split(p);
    if (parts.length > 1) { pron[p] = parts.length - 1; rest = parts.join(' '); }
  }
  const ends = s.split(/[\n.!?…”"'»)\]]+|\s{2,}/);
  for (const e of ends) {
    const x = e.trim();
    for (const p of END_PARTICLES) {
      if (x.endsWith(p) && !END_PARTICLES.some((q) => q.length > p.length && q.endsWith(p) && x.endsWith(q))) {
        part[p] = (part[p] || 0) + 1; break;
      }
    }
  }
  return { pron, part };
}
const topOf = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0] || null;
const add = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + v; return a; };

/** ข้อความโปรไฟล์ของ entity (ไว้ป้อนโมเดล) — summary · fields · customProperties · tags */
export function profileText(entity = {}, max = 600) {
  const e = entity || {};
  const parts = [];
  if (e.summary) parts.push(String(e.summary));
  for (const src of [e.fields, e.customProperties]) {
    for (const [k, v] of Object.entries(src || {})) {
      if (v != null && String(v).trim()) parts.push(k + ': ' + String(v).trim());
    }
  }
  if (Array.isArray(e.tags) && e.tags.length) parts.push('#' + e.tags.join(' #'));
  for (const sec of (Array.isArray(e.sections) ? e.sections : [])) {
    const body = sec && (sec.body || sec.text || sec.content);
    if (body) parts.push((sec.title ? sec.title + ': ' : '') + plainText(String(body)));
  }
  return clip(parts.join(' · '), max);
}

export const OOC_MIN_SHARE = 0.6;      // รูปที่ใช้ประจำต้องกินส่วนแบ่งอย่างน้อยเท่านี้ถึงนับว่า "เป็นนิสัย"
export const OOC_MIN_LINES = 3;

export function analyzeOoc(scenes = [], characters = []) {
  const per = new Map();       // name → { lines, scenes:Set, pron, part, byScene: Map(id → {pron, part, title, quote}) }
  for (const s of scenes) {
    for (const ln of extractDialogue(s, characters)) {
      const c = matchCharacter(ln.speaker, characters);
      if (!c) continue;
      const v = voiceForms(ln.text);
      if (!per.has(c.name)) per.set(c.name, { c, lines: 0, scenes: new Set(), pron: {}, part: {}, byScene: new Map() });
      const P = per.get(c.name);
      P.lines++; P.scenes.add(s.id); add(P.pron, v.pron); add(P.part, v.part);
      if (!P.byScene.has(s.id)) P.byScene.set(s.id, { title: s.title || s.id, pron: {}, part: {}, quotes: [] });
      const B = P.byScene.get(s.id);
      add(B.pron, v.pron); add(B.part, v.part);
      if (Object.keys(v.pron).length || Object.keys(v.part).length) B.quotes.push(ln.text);
    }
  }
  const rows = [], outliers = [];
  for (const [name, P] of per) {
    const habit = (m) => {
      const tot = Object.values(m).reduce((a, b) => a + b, 0);
      const top = topOf(m);
      return top && tot >= OOC_MIN_LINES && top[1] / tot >= OOC_MIN_SHARE ? top[0] : '';
    };
    const pron = habit(P.pron), part = habit(P.part);
    let odd = 0;
    for (const [sid, B] of P.byScene) {
      for (const [kind, want, map] of [['pron', pron, B.pron], ['part', part, B.part]]) {
        if (!want) continue;
        const other = Object.keys(map).filter((f) => f !== want);
        // ฉากนี้ใช้รูปอื่น **มากกว่า** รูปประจำ = น้ำเสียงเปลี่ยน
        const otherN = other.reduce((a, f) => a + map[f], 0);
        if (otherN && otherN > (map[want] || 0)) {
          odd++;
          const form = other.sort((a, b) => map[b] - map[a])[0];
          outliers.push({ name, sceneId: sid, title: B.title, kind, form, expected: want,
                          quote: clip(B.quotes.find((q) => q.includes(form)) || B.quotes[0] || '') });
        }
      }
    }
    const entity = P.c.entity || null;
    rows.push({ name, lines: P.lines, scenes: P.scenes.size, pronoun: pron, particle: part, outliers: odd,
                profile: !!(P.c.profile || (entity && profileText(entity))) });
  }
  rows.sort((a, b) => b.outliers - a.outliers || b.lines - a.lines);
  return {
    rows, outliers,
    stats: [
      { label: tt('ui.aia.stOocSpeakers'), value: rows.length },
      { label: tt('ui.aia.stOocProfile'), value: rows.filter((r) => r.profile).length + '/' + rows.length },
      { label: tt('ui.aia.stOocOdd'), value: outliers.length },
    ],
  };
}

// ═══════════════ 5) โทนเรื่อง ═══════════════
export const TONE_TARGETS = ['auto', 'comedy', 'drama', 'dramedy', 'serious'];
export const TONE_ADJUST = ['more-comedy', 'less-comedy', 'more-drama', 'less-drama', 'keep'];
export const TONE_LABELS = {
  comedy: tt('ui.aia.toneComedy'), drama: tt('ui.aia.toneDrama'), mixed: tt('ui.aia.toneMixed'),
  neutral: tt('ui.aia.toneNeutral'), dramedy: tt('ui.aia.toneDramedy'), serious: tt('ui.aia.toneSerious'),
  auto: tt('ui.aia.toneAuto'),
};
export const ADJUST_LABELS = {
  'more-comedy': tt('ui.aia.adjMoreComedy'), 'less-comedy': tt('ui.aia.adjLessComedy'),
  'more-drama': tt('ui.aia.adjMoreDrama'), 'less-drama': tt('ui.aia.adjLessDrama'),
  keep: tt('ui.aia.adjKeep'),
};

/** ชนิดโทนจากความหนาแน่น (ต่อ 1,000 คำ) ของสัญญาณตลก/ดราม่า */
export function toneOf(comedy, drama) {
  if (comedy >= 1.5 && comedy > drama * 1.5) return 'comedy';
  if (drama >= 1.5 && drama > comedy * 1.5) return 'drama';
  if (comedy >= 1 && drama >= 1) return 'mixed';
  return 'neutral';
}

/**
 * ทิศที่ควรปรับของฉากหนึ่งเทียบกับโทนที่ตั้งใจ ('' = ไม่ต้องปรับ)
 * @param {string} tone  ชนิดโทนของฉาก · @param {string} target  โทนที่ตั้งใจ (ไม่ใช่ auto)
 */
export function adjustFor(tone, target) {
  if (target === 'comedy') return tone === 'drama' ? 'less-drama' : tone === 'neutral' ? 'more-comedy' : '';
  if (target === 'drama' || target === 'serious') return tone === 'comedy' || tone === 'mixed' ? 'less-comedy' : '';
  if (target === 'dramedy') return '';          // ปนกันได้ — ไปดูที่ "สวิงแรง" แทน
  return '';
}

export function analyzeTone(scenes = [], opts = {}) {
  let C = 0, D = 0, W = 0;
  const rows = scenes.map((s) => {
    const text = plainText(s.text);
    const words = countWords(text) || 1;
    const c = hitCount(markerHits(text, COMEDY_MARKERS));
    const d = hitCount(markerHits(text, DRAMA_MARKERS));
    C += c; D += d; W += words;
    const comedy = round1(1000 * c / words), drama = round1(1000 * d / words);
    return { id: s.id, title: s.title, words, comedy, drama, tone: toneOf(comedy, drama) };
  });
  const overall = toneOf(round1(1000 * C / (W || 1)), round1(1000 * D / (W || 1)));
  const want = TONE_TARGETS.includes(opts.toneTarget) ? opts.toneTarget : 'auto';
  // อัตโนมัติ = ถือเอาโทนรวมของทั้งขอบเขตเป็นเป้า (ผสม = dramedy · กลาง ๆ = ไม่ตัดสิน)
  const target = want !== 'auto' ? want
    : overall === 'mixed' ? 'dramedy' : overall === 'neutral' ? '' : overall;
  let off = 0, whip = 0;
  rows.forEach((r, i) => {
    r.adjust = target ? adjustFor(r.tone, target) : '';
    if (r.adjust) off++;
    const prev = rows[i - 1];
    // สวิงแรง: ฉากติดกันกระโดดจากตลกจัดเป็นดราม่าจัด (หรือกลับกัน) โดยไม่มีฉากพักอารมณ์
    r.whiplash = !!(prev && ((prev.tone === 'comedy' && r.tone === 'drama') || (prev.tone === 'drama' && r.tone === 'comedy')));
    if (r.whiplash) whip++;
  });
  return {
    rows, overall, target: target || 'auto', want,
    stats: [
      { label: tt('ui.aia.stToneOverall'), value: TONE_LABELS[overall] || overall },
      // แผ่นสถิติแคบ — ป้ายยาว "อัตโนมัติ (ดูจากทั้งเรื่อง)" ขึ้นสามบรรทัด · ใช้ป้ายสั้น
      { label: tt('ui.aia.stToneTarget'), value: target ? TONE_LABELS[target] : tt('ui.aia.toneAutoShort') },
      { label: tt('ui.aia.stToneOff'), value: off },
      { label: tt('ui.aia.stToneWhip'), value: whip },
    ],
  };
}

// ═══════════════ ทะเบียน + ต่อกับ ai-analyze ═══════════════
export const DOCTOR_ANALYSES = [
  { id: 'dialog', icon: gi('chat'), ai: 'assist', group: 'doctor', title: tt('ui.aia.tDialog'), desc: tt('ui.aia.dDialog') },
  { id: 'drag',   icon: gi('timer-e'), ai: 'assist', group: 'doctor', title: tt('ui.aia.tDrag'), desc: tt('ui.aia.dDrag') },
  { id: 'logic',  icon: gi('puzzle'), ai: 'core', group: 'doctor', title: tt('ui.aia.tLogic'), desc: tt('ui.aia.dLogic') },
  { id: 'ooc',    icon: gi('user'), ai: 'core', group: 'doctor', title: tt('ui.aia.tOoc'), desc: tt('ui.aia.dOoc'), needsChars: true },
  { id: 'tone',   icon: gi('mask'), ai: 'assist', group: 'doctor', title: tt('ui.aia.tTone'), desc: tt('ui.aia.dTone') },
];

export const DOCTOR_TASK_KEYS = {
  dialog: 'ui.aia.taskDialog', drag: 'ui.aia.taskDrag', logic: 'ui.aia.taskLogic',
  ooc: 'ui.aia.taskOoc', tone: 'ui.aia.taskTone',
};

/** ชั้นคำนวณเองของตรวจบท — `deps` = ผลที่ ai-analyze คำนวณให้ (จังหวะ/ความขัดแย้ง) */
export function runDoctorLocal(id, scenes = [], characters = [], opts = {}, deps = {}) {
  switch (id) {
    case 'dialog': return analyzeDialogue(scenes, characters);
    case 'drag':   return analyzeDrag(scenes, deps.pacing || { rows: [], avg: 0, sd: 0 }, deps.conflict || { rows: [] });
    case 'logic':  return analyzeLogic(scenes);
    case 'ooc':    return analyzeOoc(scenes, characters);
    case 'tone':   return analyzeTone(scenes, opts);
    default:       return { stats: [] };
  }
}


/** ย่อผลชั้นคำนวณเองเป็นบรรทัดป้อนโมเดล */
export function doctorDigest(id, L = {}) {
  const lines = [];
  for (const s of (L.stats || [])) lines.push(`- ${s.label}: ${s.value}`);
  const take = (rows, fmt, n) => (rows || []).slice(0, n).forEach((r) => lines.push('- ' + fmt(r)));
  if (id === 'dialog') take(L.flagged, (r) => ttf('ui.aia.dgDialog', r.title, r.sceneId, r.speaker || '?',
    reasonText(r.reasons), r.quote), 30);
  if (id === 'drag') take((L.rows || []).filter((r) => r.drag >= DRAG_FLAG), (r) => ttf('ui.aia.dgDrag', r.title, r.id,
    r.drag, r.tempo, r.narration, reasonText(r.reasons, 'drag')), 25);
  if (id === 'logic') take(L.rows, (r) => ttf('ui.aia.dgLogic', r.title, r.id, r.words.join(', '), r.quote), 25);
  if (id === 'ooc') {
    take(L.rows, (r) => ttf('ui.aia.dgOocChar', r.name, r.lines, r.pronoun || '—', r.particle || '—'), 15);
    take(L.outliers, (r) => ttf('ui.aia.dgOocOdd', r.name, r.title, r.sceneId, r.form, r.expected, r.quote), 20);
  }
  if (id === 'tone') take(L.rows, (r) => ttf('ui.aia.dgTone', r.title, r.id, TONE_LABELS[r.tone],
    r.comedy, r.drama) + (r.adjust ? ' → ' + ADJUST_LABELS[r.adjust] : '') + (r.whiplash ? ' · ' + tt('ui.aia.toneWhip') : ''), 40);
  return lines.join('\n');
}

/** บรรทัดเสริมของ prompt (โปรไฟล์ตัวละครสำหรับ OOC · โทนที่ตั้งใจสำหรับโทนเรื่อง) */
export function doctorPromptExtras(id, { characters = [], local = {}, opts = {} } = {}) {
  const lines = [];
  if (id === 'ooc') {
    const speaking = new Set((local.rows || []).map((r) => r.name));
    const use = characters.filter((c) => speaking.has(c.name) || !speaking.size).slice(0, 12);
    const prof = use.map((c) => ({ name: c.name, text: c.profile || profileText(c.entity) })).filter((x) => x.text);
    if (prof.length) {
      lines.push(tt('ui.aia.pHeadProfiles'));
      for (const p of prof) lines.push('- ' + p.name + ': ' + p.text);
    } else lines.push(tt('ui.aia.pNoProfiles'));
  }
  if (id === 'tone') {
    const want = TONE_TARGETS.includes(opts.toneTarget) ? opts.toneTarget : 'auto';
    lines.push(tt('ui.aia.pToneTarget') + (want === 'auto' ? tt('ui.aia.pToneAuto') : TONE_LABELS[want]));
  }
  return lines;
}

/** ตาราง CSV ของชั้นคำนวณเอง: [หัวตาราง, ...แถว] */
export function doctorTable(id, L = {}) {
  const H = (...a) => a;
  if (id === 'dialog' && L.flagged) return [H(tt('ui.aia.csScene'), tt('ui.aia.csSpeaker'), tt('ui.aia.csReason'), tt('ui.aia.csQuote')),
    ...L.flagged.map((r) => [r.title, r.speaker, reasonText(r.reasons), r.quote])];
  if (id === 'drag' && L.rows) return [H(tt('ui.aia.csScene'), tt('ui.aia.csWords'), tt('ui.aia.csTempo'), tt('ui.aia.csNarration'), tt('ui.aia.csDrag'), tt('ui.aia.csReason')),
    ...L.rows.map((r) => [r.title, r.words, r.tempo, r.narration, r.drag, reasonText(r.reasons, 'drag')])];
  if (id === 'logic' && L.rows) return [H(tt('ui.aia.csScene'), tt('ui.aia.csCount'), tt('ui.aia.csMarkers'), tt('ui.aia.csQuote')),
    ...L.rows.map((r) => [r.title, r.count, r.words.join(' '), r.quote])];
  if (id === 'ooc' && L.rows) {
    const rows = [H(tt('ui.aia.csCharacter'), tt('ui.aia.csLines'), tt('ui.aia.csPronoun'), tt('ui.aia.csParticle'), tt('ui.aia.csOdd'))];
    for (const r of L.rows) rows.push([r.name, r.lines, r.pronoun, r.particle, r.outliers]);
    rows.push([]);
    rows.push(H(tt('ui.aia.csCharacter'), tt('ui.aia.csScene'), tt('ui.aia.csExpected'), tt('ui.aia.csFound'), tt('ui.aia.csQuote')));
    for (const o of (L.outliers || [])) rows.push([o.name, o.title, o.expected, o.form, o.quote]);
    return rows;
  }
  if (id === 'tone' && L.rows) return [H(tt('ui.aia.csScene'), tt('ui.aia.csComedy'), tt('ui.aia.csDrama'), tt('ui.aia.csTone'), tt('ui.aia.csAdjust')),
    ...L.rows.map((r) => [r.title, r.comedy, r.drama, TONE_LABELS[r.tone] || r.tone, r.adjust ? ADJUST_LABELS[r.adjust] : ''])];
  return null;
}
