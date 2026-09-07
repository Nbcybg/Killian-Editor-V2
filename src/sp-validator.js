// sp-validator.js — ตรวจหาข้อผิดพลาดในบทภาพยนตร์อัตโนมัติ (ข้อ 54)
// บริสุทธิ์ 100% : ไม่แตะ DOM / kapi / state → ทดสอบด้วย node ได้ (test/sp-validator.test.cjs)
//
// รับ blocks = [{ el, text }] (ผลจาก parseScript ของ fountain.js หรือจาก doc ของ ProseMirror)
// คืน [{ type, block, el, msg, severity }] โดย `block` = ดัชนีใน array ที่ส่งเข้ามา (นับ blank ด้วย)
// → ผู้เรียกเอาไปหาตำแหน่งจริงในเอกสารต่อได้

import { t, tf } from './i18n.js';
export const SP_ERRORS = {
  EMPTY_ELEMENT: 'empty-element',
  ORPHAN_CHARACTER: 'orphan-character',
  ORPHAN_DIALOGUE: 'orphan-dialogue',
  ORPHAN_PARENTHETICAL: 'orphan-parenthetical',
  OVERLONG_LINE: 'overlong-line',
  DOUBLE_SCENE: 'double-scene',
  MISSING_SCENE_HEADING: 'missing-scene-heading',
  UNCLOSED_PARENTHETICAL: 'unclosed-parenthetical',
};

// ระดับความรุนแรง — 'error' = ผิดกติกาบทจริง · 'warn' = น่าจะตั้งใจแต่ควรดู
export const SP_SEVERITY = {
  [SP_ERRORS.EMPTY_ELEMENT]: 'warn',
  [SP_ERRORS.ORPHAN_CHARACTER]: 'error',
  [SP_ERRORS.ORPHAN_DIALOGUE]: 'error',
  [SP_ERRORS.ORPHAN_PARENTHETICAL]: 'error',
  [SP_ERRORS.OVERLONG_LINE]: 'warn',
  [SP_ERRORS.DOUBLE_SCENE]: 'warn',
  [SP_ERRORS.MISSING_SCENE_HEADING]: 'warn',
  [SP_ERRORS.UNCLOSED_PARENTHETICAL]: 'error',
};

// ความยาวสูงสุดต่อบรรทัด (ตัวอักษร) — Courier 12pt 10 ตัว/นิ้ว: บทพูดกว้าง 3.5" ≈ 35 ตัว/บรรทัด
// ค่าเริ่มต้นเผื่อไว้ให้ 1 บรรทัดครึ่ง–2 บรรทัด ตามธรรมเนียมที่บรรณาธิการบทใช้เตือน
export const DEFAULT_LIMITS = { dialogue: 60, action: 70, scene: 70, character: 40 };

// element ที่ "ว่างแล้วผิด" (action ว่าง = บรรทัดเว้นวรรค ปกติของบท จึงไม่นับ)
const NEED_TEXT = ['scene', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'act-break'];
const TH_EL = {
  scene: t('ui.spValidator.headScene'), action: t('ui.common.action'), character: t('ui.common.character'), dialogue: t('ui.common.dialogue'),
  parenthetical: t('ui.spValidator.msg2'), transition: t('ui.spValidator.msg'), shot: t('ui.spValidator.shot'), 'act-break': t('ui.spValidator.act'),
  note: t('ui.common.note'), summary: t('ui.common.summary'), outline1: t('ui.spValidator.outline'), outline2: t('ui.spValidator.outline2'), outline3: t('ui.spValidator.outline3'),
  image: t('ui.common.image'), raw: t('ui.common.other'),
};
export const elLabel = (el) => TH_EL[el] || el;

/** บล็อกที่ "มีอยู่จริงในบท" (ตัด blank และบล็อกว่างที่เป็นแค่ที่เว้นวรรคออก) */
function meaningful(b) {
  if (!b) return false;
  if (b.el === 'blank') return false;
  if (b.el === 'action' && !String(b.text ?? '').trim()) return false;   // บรรทัดว่างในเอกสาร
  return true;
}

/**
 * ตรวจบทภาพยนตร์
 * @param {Array<{el:string,text:string}>} blocks
 * @param {{limits?:object, checks?:string[]}} opts  checks = เลือกเฉพาะบางกฎ (ไม่ใส่ = ทุกกฎ)
 */
export function validateScreenplay(blocks, opts = {}) {
  const list = Array.isArray(blocks) ? blocks : [];
  const L = { ...DEFAULT_LIMITS, ...(opts.limits || {}) };
  const only = Array.isArray(opts.checks) && opts.checks.length ? new Set(opts.checks) : null;
  const errors = [];
  const add = (type, i, el, msg) => {
    if (only && !only.has(type)) return;
    errors.push({ type, block: i, el, msg, severity: SP_SEVERITY[type] || 'warn' });
  };

  // ดัชนีของบล็อกที่มีความหมาย (ใช้หา prev/next ข้ามบรรทัดว่าง)
  const idx = [];
  for (let i = 0; i < list.length; i++) if (meaningful(list[i])) idx.push(i);

  let sceneSeen = false;
  let warnedNoScene = false;

  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const b = list[i];
    const el = b.el;
    const text = String(b.text ?? '').trim();
    const prev = k > 0 ? list[idx[k - 1]] : null;
    const next = k < idx.length - 1 ? list[idx[k + 1]] : null;

    // 1. element ที่ต้องมีข้อความแต่ว่างเปล่า
    if (!text && NEED_TEXT.includes(el)) {
      add(SP_ERRORS.EMPTY_ELEMENT, i, el, tf('ui.spValidator.lineEmpty', elLabel(el)));
    }

    // 7. มีเนื้อบทก่อนหัวฉากแรก
    if (el === 'scene') sceneSeen = true;
    else if (!sceneSeen && !warnedNoScene &&
             ['action', 'character', 'dialogue', 'parenthetical'].includes(el)) {
      warnedNoScene = true;
      add(SP_ERRORS.MISSING_SCENE_HEADING, i, el, t('ui.spValidator.hasBodyChapterBefore'));
    }

    // 6. หัวฉากติดกัน 2 อัน
    if (el === 'scene' && next && next.el === 'scene') {
      add(SP_ERRORS.DOUBLE_SCENE, i, el, tf('ui.spValidator.headSceneTwoNot', text || t('ui.common.empty')));
    }

    // 2. ตัวละครไม่มีบทพูด/วงเล็บตามหลัง
    if (el === 'character' && (!next || !['dialogue', 'parenthetical'].includes(next.el))) {
      add(SP_ERRORS.ORPHAN_CHARACTER, i, el, tf('ui.spValidator.characterNotHasDialogue', text));
    }

    // 3. บทพูดกำพร้า — ไม่มีตัวละคร/วงเล็บ/บทพูดนำหน้า
    if (el === 'dialogue' && (!prev || !['character', 'parenthetical', 'dialogue'].includes(prev.el))) {
      add(SP_ERRORS.ORPHAN_DIALOGUE, i, el, t('ui.spValidator.dialogueNotNamedCharacter'));
    }

    // 4. วงเล็บกำพร้า — ต้องอยู่หลังตัวละครหรือบทพูด
    if (el === 'parenthetical' && (!prev || !['character', 'dialogue'].includes(prev.el))) {
      add(SP_ERRORS.ORPHAN_PARENTHETICAL, i, el, t('ui.spValidator.cantCharacterDialogue'));
    }

    // 8. วงเล็บไม่ปิด
    if (el === 'parenthetical' && text) {
      const opens = (text.match(/\(/g) || []).length;
      const closes = (text.match(/\)/g) || []).length;
      if (opens !== closes) {
        add(SP_ERRORS.UNCLOSED_PARENTHETICAL, i, el, tf('ui.spValidator.notCompletePair', text));
      }
    }

    // 5. บรรทัดยาวเกิน
    const lim = L[el];
    if (lim && text.length > lim) {
      add(SP_ERRORS.OVERLONG_LINE, i, el,
          tf('ui.spValidator.longChar', elLabel(el), text.length, lim));
    }
  }

  return errors;
}

/** สรุปจำนวนแยกตามระดับ — ใช้กับแถบสถานะ */
export function errorSummary(errors) {
  const list = errors || [];
  const err = list.filter((e) => e.severity === 'error').length;
  return { total: list.length, errors: err, warnings: list.length - err };
}

/** ข้อความสั้นสำหรับแถบสถานะ */
export function summaryText(errors) {
  const s = errorSummary(errors);
  if (!s.total) return t('ui.spValidator.notFoundError');
  const parts = [];
  if (s.errors) parts.push(tf('ui.spValidator.error', s.errors));
  if (s.warnings) parts.push(tf('ui.spValidator.itemView', s.warnings));
  return '⚠️ ' + parts.join(' · ');
}

/** ข้อผิดพลาดถัดไปหลังบล็อกที่ N (วนกลับต้นเมื่อหมด) — คืน null เมื่อไม่มีเลย */
export function nextError(errors, afterBlock) {
  const list = (errors || []).slice().sort((a, b) => a.block - b.block);
  if (!list.length) return null;
  const n = Number.isFinite(afterBlock) ? afterBlock : -1;
  return list.find((e) => e.block > n) || list[0];
}
