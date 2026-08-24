// starter-steps-def.js — **ทะเบียนขั้นของ wizard** (โมดูลบริสุทธิ์)
//
// ไฟล์นี้คือจุดที่ทำให้ Story Starter "ต่อยอดได้" จริง:
//   · อยากเพิ่มขั้นใหม่ (ระบบเวทมนตร์ · ฝ่าย/faction · กติกาโลก) = เพิ่ม object หนึ่งตัวใน STEPS
//     แล้วเขียนตัววาดใน starter-steps.js — **ตัวเดินขั้น (starter-wizard.js) ไม่ต้องแก้เลย**
//   · อยากเพิ่มช่องใน 4W ให้เป็น 5W/6W = เพิ่มแถวใน W_FIELDS ที่เดียว
//
// กฎที่ห้ามพัง: `filled()` ต้องเป็นฟังก์ชันบริสุทธิ์ที่รับ starter แล้วตอบว่า "ขั้นนี้กรอกแล้วไหม"
// ตัวเดินขั้น/แถบความคืบหน้า/ปุ่มเสร็จสิ้น ใช้คำตอบจากตรงนี้ทั้งหมด ไม่มีใครเดาเอง

import { t } from '../i18n.js';
import { charReady, hasIntro } from './starter-model.js';

/**
 * ช่อง 4W — **map เปิด** ค่าเก็บใน `starter.w[key]`
 * `key` ถูกเขียนลงไฟล์ จึงต้องเป็นภาษาอังกฤษคงที่ · `label` เป็นคำแปลเท่านั้น
 */
export const W_FIELDS = [
  { key: 'what',  icon: '❓', label: t('ui.starter.wWhat'),  hint: t('ui.starter.wWhatHint') },
  { key: 'when',  icon: '🕓', label: t('ui.starter.wWhen'),  hint: t('ui.starter.wWhenHint') },
  { key: 'where', icon: '📍', label: t('ui.starter.wWhere'), hint: t('ui.starter.wWhereHint') },
  { key: 'why',   icon: '🎯', label: t('ui.starter.wWhy'),   hint: t('ui.starter.wWhyHint') },
];
export function wFieldByKey(key) { return W_FIELDS.find((f) => f.key === key) || null; }
/** ช่อง 4W ที่กรอกแล้ว → [{key,label,value}] (ใช้ทั้งใน UI และตอนสร้าง prompt) */
export function filledW(s) {
  const w = (s && s.w) || {};
  return W_FIELDS.filter((f) => String(w[f.key] || '').trim())
                 .map((f) => ({ key: f.key, label: f.label, value: String(w[f.key]).trim() }));
}

/**
 * แท็กแนวเรื่องสำเร็จรูป — **ค่าเป็นอังกฤษเสมอ** เพราะถูกเขียนลง starter.json
 * และถูกส่งเข้า prompt (โมเดลเข้าใจศัพท์แนวเรื่องภาษาอังกฤษดีกว่า) · ผู้ใช้พิมพ์เองได้ไม่จำกัด
 */
export const TAG_GROUPS = [
  { id: 'genre', label: t('ui.starter.tagGroupGenre'),
    tags: ['fantasy', 'sci-fi', 'isekai', 'romance', 'harem', 'action', 'mystery',
           'horror', 'slice of life', 'comedy', 'drama', 'thriller', 'historical'] },
  { id: 'tone', label: t('ui.starter.tagGroupTone'),
    tags: ['dark', 'lighthearted', 'bittersweet', 'epic', 'gritty', 'wholesome', 'satirical'] },
  { id: 'setting', label: t('ui.starter.tagGroupSetting'),
    tags: ['modern', 'medieval', 'cyberpunk', 'post-apocalyptic', 'school', 'space',
           'urban fantasy', 'steampunk'] },
  { id: 'rating', label: t('ui.starter.tagGroupRating'),
    tags: ['all ages', 'teen', 'mature'] },
];
/** แท็กสำเร็จรูปทั้งหมดแบนเป็นชุดเดียว (ไว้เช็คว่าอันไหนผู้ใช้พิมพ์เอง) */
export function presetTags() { return TAG_GROUPS.flatMap((g) => g.tags); }
export function isPresetTag(tag) {
  const k = String(tag || '').toLowerCase();
  return presetTags().some((x) => x.toLowerCase() === k);
}

/**
 * ขั้นของ wizard
 * `required:false` = ข้ามได้ ไม่นับในแถบความคืบหน้า และไม่กันปุ่ม "เสร็จสิ้น"
 */
export const STEPS = [
  { id: 'tags', icon: '🏷', required: true,
    title: t('ui.starter.stepTags'), desc: t('ui.starter.stepTagsDesc'),
    filled: (s) => (s.tags || []).length > 0 },

  { id: 'intro', icon: '📖', required: true,
    title: t('ui.starter.stepIntro'), desc: t('ui.starter.stepIntroDesc'),
    // [alpha.96] คำบรรยายเป็น HTML แล้ว — `<p><br></p>` ที่ตัวแก้ไขทิ้งไว้ต้องไม่นับว่ากรอกแล้ว
    filled: (s) => !!String(s.name || '').trim() && hasIntro(s) },

  { id: 'cast', icon: '👥', required: true,
    title: t('ui.starter.stepCast'), desc: t('ui.starter.stepCastDesc'),
    filled: (s) => (s.cast || []).some(charReady) },

  { id: 'w', icon: '🧭', required: false,
    title: t('ui.starter.stepW'), desc: t('ui.starter.stepWDesc'),
    filled: (s) => filledW(s).length > 0 },

  { id: 'cover', icon: '🖼', required: false,
    title: t('ui.starter.stepCover'), desc: t('ui.starter.stepCoverDesc'),
    filled: (s) => !!String(s.cover || '').trim() || !!String(s.banner || '').trim() },
];

export const STEP_COUNT = STEPS.length;
export function stepById(id) { return STEPS.find((x) => x.id === id) || null; }
export function stepIndex(id) { return STEPS.findIndex((x) => x.id === id); }
/** ดัชนีที่อยู่ในช่วงเสมอ — กันไฟล์เก่าที่ `step` ค้างเกินจำนวนขั้นปัจจุบัน */
export function clampStep(i) {
  const n = Number(i);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(STEPS.length - 1, Math.floor(n)));
}
export function stepAt(i) { return STEPS[clampStep(i)]; }
export function isLastStep(i) { return clampStep(i) === STEPS.length - 1; }
export function isFirstStep(i) { return clampStep(i) === 0; }
