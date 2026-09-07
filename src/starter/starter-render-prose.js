// starter-render-prose.js — แปลงบทสนทนาที่เล่นแล้ว → ร้อยแก้วนิยาย (โมดูลบริสุทธิ์)
//
// ปัญหาที่ต้องแก้จริงในไฟล์นี้: **บทที่เล่นไปสองชั่วโมงยาวเกินบริบทของโมเดล**
// ยิงรวดเดียวไม่ได้ ต้องแบ่งก้อน แล้วต่อกลับให้อ่านเป็นเรื่องเดียว
//
// การแบ่งมีกติกาสองข้อที่สำคัญกว่าความเนียน:
//   1. **ห้ามตัดกลางคู่ถาม-ตอบ** — ตัดตรงรอยต่อ "ผู้เล่นตอบจบ → GM เล่ารอบใหม่" เท่านั้น
//      ตัดกลางแล้วก้อนถัดไปจะไม่รู้ว่าใครพูดค้างไว้
//   2. **ก้อนถัดไปต้องเห็นท้ายก้อนก่อน** — ส่ง `tail` ไปด้วยเพื่อให้สำนวนกับสรรพนามต่อกันติด
//
// ไม่แตะ DOM/fs/network → unit test ได้ตรง ๆ

import { t } from '../i18n.js';
import { ROLE_GM, ROLE_PLAYER } from './starter-model.js';
import { starterBlock, clip } from './starter-prompt.js';
import { choiceMarker } from './starter-choices.js';

/** โทเคนต่อก้อน — เผื่อที่ให้ system prompt + คำสั่ง + คำตอบไว้แล้ว */
export const CHUNK_TOKENS = 2200;
/** ท้ายก้อนก่อนหน้าที่ส่งไปเป็นบริบท */
export const TAIL_CHARS = 600;

/** ประมาณโทเคนแบบหยาบ — ไทยกินโทเคนมากกว่าอังกฤษต่ออักขระ จึงคิดเผื่อ */
export function roughTokens(text) {
  const s = String(text || '');
  const thai = (s.match(/[฀-๿]/g) || []).length;
  return Math.ceil((s.length - thai) / 4) + Math.ceil(thai / 1.6);
}

/**
 * แบ่งเทิร์นเป็นก้อน ๆ ที่ยิงได้จริง
 * ตัดได้เฉพาะ "ก่อนเทิร์นของ GM" เพราะนั่นคือรอยต่อของจังหวะเรื่อง
 * @returns {Array<Array<object>>}
 */
export function chunkTurns(turns, maxTokens = CHUNK_TOKENS) {
  const rows = (turns || []).filter((r) => String(r.text || '').trim());
  const out = [];
  let cur = [];
  let size = 0;
  for (const r of rows) {
    const n = roughTokens(r.text);
    // ตัดตรงหัวเทิร์น GM เท่านั้น และก้อนต้องมีอะไรอยู่แล้ว
    const canCut = r.role === ROLE_GM && cur.length > 0;
    if (canCut && size + n > maxTokens) { out.push(cur); cur = []; size = 0; }
    cur.push(r);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out.length ? out : [[]];
}

/** บทสนทนาก้อนหนึ่งเป็นข้อความ พร้อมป้ายว่าใครพูด */
export function chunkText(chunk, nameOf = () => '') {
  return (chunk || []).map((r) => {
    const who = r.role === ROLE_GM ? t('ui.starter.trGm')
      : (nameOf(r.speaker) || t('ui.starter.trPlayer'));
    return who + ': ' + String(r.text || '').trim();
  }).join('\n\n');
}

/**
 * คำสั่งแปลงหนึ่งก้อน
 * @param {object} opts
 *   - part/total  ก้อนที่เท่าไรจากทั้งหมด (โมเดลจะได้รู้ว่าควรเปิด/ปิดเรื่องไหม)
 *   - tail        ท้ายของร้อยแก้วที่แปลงไปแล้ว — ให้เขียนต่อได้เนียน
 */
export function prosePrompt(s, sc, chunk, { part = 1, total = 1, tail = '', nameOf } = {}) {
  const first = part === 1;
  const last = part === total;
  return [
    t('ui.starter.pCvTask'),
    starterBlock(s, { full: false }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    total > 1 ? t('ui.starter.pCvPart').replace('{0}', String(part)).replace('{1}', String(total)) : '',
    tail ? t('ui.starter.pCvTail') + '\n' + clip(tail, TAIL_CHARS) : '',
    t('ui.starter.pCvSource'),
    chunkText(chunk, nameOf),
    t('ui.starter.pCvRuleProse'),
    first ? '' : t('ui.starter.pCvNoReopen'),
    last ? '' : t('ui.starter.pCvNoClose'),
  ].filter(Boolean).join('\n\n');
}

/** ท้ายข้อความสำหรับส่งเป็นบริบทของก้อนถัดไป */
export function tailOf(text, chars = TAIL_CHARS) {
  const s = String(text || '').trim();
  return s.length <= chars ? s : s.slice(-chars);
}

/** ต่อก้อนที่แปลงแล้วเข้าด้วยกัน — เว้นย่อหน้าให้สม่ำเสมอ */
export function stitch(parts) {
  return (parts || []).map((x) => String(x || '').trim()).filter(Boolean)
    .join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * เนื้อไฟล์ .md สุดท้าย
 *
 * ทางเลือกที่ **ยังไม่ได้ตอบ** (เทิร์น GM ตัวสุดท้าย) ถูกต่อท้ายเป็นมาร์กเกอร์ `[ข้อความ]`
 * นั่นคือทางแยกจริงที่พาไปฉากถัดไป — ทางเลือกที่ผู้เล่นตอบไปแล้วไม่ใช่ทางแยก
 * เพราะเรื่องเดินต่อเป็นเส้นเดียวไปแล้ว (จะเห็นในเนื้อร้อยแก้วอยู่แล้ว)
 */
export function proseBody(prose, openChoices = []) {
  const marks = (openChoices || []).map(choiceMarker).filter(Boolean);
  if (!marks.length) return stitch([prose]);
  return stitch([prose]) + '\n\n' + t('ui.starter.cvForkHead') + '\n\n'
    + marks.map((m) => '- ' + m).join('\n') + '\n';
}
