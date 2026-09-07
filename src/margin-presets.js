// margin-presets.js — ชุดระยะขอบสำเร็จรูป (alpha.60r2 · ข้อ 6)
// โมดูลบริสุทธิ์ — ตารางค่าอยู่ใน margin-presets.json (ผู้ใช้แก้ไฟล์เองได้ ไม่ต้องแตะโค้ด)
import PRESETS from './margin-presets.json';

export const MARGIN_PRESETS = PRESETS;
export const MARGIN_PRESET_KEYS = Object.keys(PRESETS);

/** ค่าระยะขอบ 4 ด้านของพรีเซ็ต (คืน null ถ้าไม่รู้จัก) */
export function marginPreset(key) {
  const p = PRESETS[key];
  if (!p) return null;
  return { top: +p.top, bottom: +p.bottom, left: +p.left, right: +p.right };
}

/** ป้ายชื่อพรีเซ็ตสำหรับ <select> */
export function marginPresetLabel(key) {
  const p = PRESETS[key];
  return p ? (p.label || key) : key;
}

/** รายการ [key, label] เรียงตามลำดับในไฟล์ — ใช้สร้าง <option> */
export function marginPresetOptions() {
  return MARGIN_PRESET_KEYS.map((k) => [k, marginPresetLabel(k)]);
}

const near = (a, b) => Math.abs((+a || 0) - (+b || 0)) < 0.005;

/**
 * ระยะขอบชุดนี้ตรงกับพรีเซ็ตไหน — คืน key หรือ '' เมื่อเป็นค่าที่ผู้ใช้ตั้งเอง
 * (ใช้ตั้งค่าเริ่มต้นของ <select> ให้ตรงกับสิ่งที่อยู่ในช่องกรอกจริง)
 */
export function matchMarginPreset(m) {
  if (!m) return '';
  for (const k of MARGIN_PRESET_KEYS) {
    const p = PRESETS[k];
    if (near(p.top, m.top) && near(p.bottom, m.bottom) &&
        near(p.left, m.left) && near(p.right, m.right)) return k;
  }
  return '';
}
