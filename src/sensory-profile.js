// sensory-profile.js — บรรยากาศรับรู้ของสถานที่ (sight/sound/smell/touch/taste)
// แสดงเป็นหัวข้อเพิ่มในหน้า Wiki หมวด "สถานที่" เท่านั้น · เก็บใน entity.sensoryProfile
import { t } from './i18n.js';
import { el } from './core.js';

const SENSORY_FIELDS = [
  { key: 'sight', label: t('ui.common.thingSee'), icon: 'image', hint: t('ui.sensory.egWindow') },
  { key: 'sound', label: t('ui.sensory.thingHear'), icon: 'chat', hint: t('ui.sensory.egSound') },
  { key: 'smell', label: t('ui.sensory.smell'), icon: 'note', hint: t('ui.sensory.egSmellPaper') },
  { key: 'touch', label: t('ui.sensory.touch'), icon: 'edit', hint: t('ui.sensory.egBg') },
  { key: 'taste', label: t('ui.sensory.taste'), icon: 'star', hint: t('ui.sensory.eg') },
];

// เอนทิตี้นี้ควรมีบรรยากาศรับรู้ไหม (เฉพาะหมวดสถานที่)
export function isSensoryEntity(entity) {
  return !!entity && entity.entityTypeKey === 'locations';
}

// สร้าง sensoryProfile เปล่าให้สถานที่ (เรียกตอนเปิด/สร้างเอนทิตี้)
export function ensureSensory(entity) {
  if (isSensoryEntity(entity) && !entity.sensoryProfile) entity.sensoryProfile = {};
  return entity;
}

// กรอกเฉพาะช่องที่มีข้อความ — ใช้ทั้งใน UI และเทส
export function sensoryFilled(entity) {
  const p = (entity && entity.sensoryProfile) || {};
  return SENSORY_FIELDS.filter((f) => (p[f.key] || '').trim()).map((f) => f.key);
}

// แสดงผลในหน้า wiki entity (wrap = .wiki-wrap) — เรียกซ้ำได้ ไม่สร้างช่องซ้ำ
export function renderSensoryProfile(wrap, entity, onDirty) {
  if (!wrap || !isSensoryEntity(entity)) return null;
  let sec = wrap.querySelector('.wiki-sensory');
  if (!sec) {
    sec = el('div', 'wiki-sensory');
    sec.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid var(--border)';
    sec.append(el('div', 'wiki-sub', t('ui.sensory.ambienceSensory')));
    wrap.append(sec);
  }
  // ลบช่องเก่าแล้ววาดใหม่ (render ถูกเรียกหลายครั้ง)
  sec.querySelectorAll('.wiki-sensory-row').forEach((r) => r.remove());
  const prof = (entity.sensoryProfile = entity.sensoryProfile || {});
  for (const f of SENSORY_FIELDS) {
    const r = el('div', 'wiki-row wiki-sensory-row');
    r.dataset.sense = f.key;
    r.append(el('label', null, f.label));
    const inp = el('input', 'wiki-input');
    inp.value = prof[f.key] || '';
    inp.placeholder = f.hint;
    inp.addEventListener('input', () => { prof[f.key] = inp.value; if (onDirty) onDirty(); });
    r.append(inp);
    sec.append(r);
  }
  return sec;
}

export { SENSORY_FIELDS };
