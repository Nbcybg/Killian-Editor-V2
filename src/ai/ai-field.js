// ai-field.js — [alpha.116 ข้อ 9] **เติมช่องข้อมูล Wiki ด้วย AI คลิกเดียว** (บริสุทธิ์ · มี unit test)
//
// ผู้ใช้: *"ใน wiki ส่วน field ที่เป็น text input ให้มี one click ai ด้วย"*
//
// ═══ สิ่งที่ทำให้ prompt ตัวนี้ยากกว่าที่คิด ═══
// ช่องใน Wiki เป็น **เทมเพลตของผู้ใช้เอง** — ไม่มีทางรู้ล่วงหน้าว่าช่องชื่อ "จุดอ่อน" ต้องการ
// ประโยคเดียว หรือย่อหน้า หรือรายการ · เดาผิดแล้วได้คำตอบยาวเป็นเรียงความยัดลงช่องบรรทัดเดียว
//
// ทางออก: **ให้บริบทเยอะ แต่สั่งรูปแบบให้แคบ** — ส่งช่องอื่นที่กรอกแล้วไปทั้งหมด
// (โมเดลจะได้ไม่ขัดกับของเดิม) แล้วบังคับว่า "ตอบเฉพาะค่าของช่องนี้ ไม่ต้องมีชื่อช่องนำหน้า
// ไม่ต้องอธิบาย" · ตัวอ่านคำตอบยังเผื่อไว้อีกชั้นว่าโมเดลจะแถชื่อช่องหรือเครื่องหมายคำพูดมาด้วย
// (เหมือน `parseSpokenLine` ของห้องซ้อมบท — สั่งห้ามแล้วมันก็ยังใส่มาอยู่ดี)
//
// ไฟล์นี้ไม่แตะ DOM/network — รับข้อมูลดิบ คืนสตริง

import { t, tf } from '../i18n.js';

/** จำนวนช่องอื่นที่ยัดเข้า prompt เป็นบริบท (มากกว่านี้ = จ่ายโทเคนโดยไม่ได้คุณภาพเพิ่ม) */
export const MAX_CONTEXT_FIELDS = 14;

/** แถวบริบท "ช่องอื่นที่กรอกไว้แล้ว" — ตัดช่องที่ว่างและช่องตัวเองออกเสมอ */
export function fieldContextRows(fields = [], skipLabel = '', limit = MAX_CONTEXT_FIELDS) {
  const out = [];
  for (const f of fields || []) {
    if (!f) continue;
    const label = String(f.label || '').trim();
    const value = String(f.value == null ? '' : f.value).trim();
    if (!label || !value) continue;
    if (label === String(skipLabel || '').trim()) continue;
    out.push(label + ': ' + value.replace(/\s+/g, ' ').slice(0, 400));
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * ประกอบคำขอ "เติมช่องนี้ให้หน่อย"
 * @param {object} o
 *   `fieldLabel` ชื่อช่อง (ตามเทมเพลตของผู้ใช้) · `current` ค่าที่มีอยู่ ('' = ยังว่าง)
 *   `entityName` ชื่อเอนทิตี้ · `catLabel` ชื่อหมวด (ตัวละคร/สถานที่/…)
 *   `fields` [{label,value}] ช่องอื่นทั้งหมด · `story` บริบทเรื่อง (ชื่อเรื่อง/เรื่องย่อ)
 * @returns {{system:string, prompt:string}}
 */
export function buildFieldPrompt(o = {}) {
  const fieldLabel = String(o.fieldLabel || '').trim();
  const current = String(o.current || '').trim();
  const rows = [];
  rows.push(tf('ui.aiField.taskLine', String(o.catLabel || '').trim() || t('ui.aiField.thing'),
                String(o.entityName || '').trim() || t('ui.aiField.unnamed')));
  const ctx = fieldContextRows(o.fields, fieldLabel);
  if (ctx.length) { rows.push('', t('ui.aiField.headKnown')); rows.push(...ctx.map((x) => '- ' + x)); }
  if (String(o.story || '').trim()) {
    rows.push('', t('ui.aiField.headStory'), String(o.story).trim().slice(0, 800));
  }
  rows.push('', tf('ui.aiField.askField', fieldLabel));
  // ★ มีค่าเดิมอยู่แล้ว = "เกลา/ต่อยอด" ไม่ใช่ "เขียนใหม่ทับ" — คนละงานกันคนละคำสั่ง
  if (current) rows.push(tf('ui.aiField.hasCurrent', current));
  rows.push('', t('ui.aiField.headRules'));
  rows.push(t('ui.aiField.ruleOnlyValue'));
  rows.push(t('ui.aiField.ruleNoLabel'));
  rows.push(t('ui.aiField.ruleShort'));
  rows.push(t('ui.aiField.ruleSameLang'));
  return { system: t('ui.aiField.system'), prompt: rows.join('\n') };
}

const FENCE = /```[a-z]*\n?/gi;

/**
 * ล้างคำตอบให้เหลือ "ค่าของช่อง" ล้วน ๆ
 * โมเดลชอบแถม `ชื่อช่อง:` นำหน้า · ครอบเครื่องหมายคำพูด · ใส่หัวข้อ/คำนำ
 * @param {string} raw
 * @param {string} [fieldLabel] ชื่อช่อง — ใช้ตัดคำนำหน้า **เฉพาะชื่อที่รู้จัก** เท่านั้น
 */
export function parseFieldAnswer(raw, fieldLabel = '') {
  let txt = String(raw || '').replace(FENCE, '').trim();
  if (!txt) return '';
  // ตัด "ชื่อช่อง:" นำหน้า — ตัดเฉพาะชื่อช่องจริง ไม่ใช่ "อะไรก็ได้ที่ตามด้วย :"
  // (บทเรียนจาก parseSpokenLine: กฎกว้างเกินไปกินเนื้อหาจริง "สรุปคือ: เขาไม่ไป")
  const label = String(fieldLabel || '').trim();
  if (label) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    txt = txt.replace(new RegExp('^\\s*' + esc + '\\s*[:：]\\s*'), '').trim();
  }
  // คำนำหน้าแบบรายการ/หัวข้อที่โมเดลชอบใส่
  txt = txt.replace(/^[-•*]\s+/, '').trim();
  // เครื่องหมายคำพูดครอบทั้งก้อน (ครอบทั้งหมดเท่านั้น — ในเนื้อหามีคำพูดได้)
  const q = txt.match(/^["“”「『«]([\s\S]+)["“”」』»]$/);
  if (q && !/["“”]/.test(q[1])) txt = q[1].trim();
  return txt;
}

/** ค่าที่จะเขียนกลับลงช่อง — ว่าง = ไม่ต้องเขียนอะไรเลย (ห้ามล้างของเดิมทิ้ง) */
export function fieldResult(raw, fieldLabel = '') {
  const v = parseFieldAnswer(raw, fieldLabel);
  return v ? v : '';
}
