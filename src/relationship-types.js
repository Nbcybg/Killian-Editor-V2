// relationship-types.js — ประเภทความสัมพันธ์: ally/enemy/family/rival/romantic/mentor/acquaintance/neutral/custom
// โมดูลบริสุทธิ์ (ไม่แตะ DOM/kapi) → เทสด้วย node ได้ตรง ๆ
export const REL_TYPES = [
  // icon = ชื่อไอคอนใน icons.js (ต้องมีจริง ไม่งั้นวาดออกมาเป็น svg ว่าง)
  { key: 'family',       label: 'ครอบครัว',       color: '#e06c75', icon: 'home' },
  { key: 'romantic',     label: 'คนรัก',          color: '#e06ca0', icon: 'star' },
  { key: 'ally',         label: 'พันธมิตร',       color: '#61afef', icon: 'user' },
  { key: 'rival',        label: 'คู่แข่ง',         color: '#e5c07b', icon: 'cloud-lightning' },
  { key: 'enemy',        label: 'ศัตรู',           color: '#be5046', icon: 'x' },
  { key: 'mentor',       label: 'ผู้สอน/อาจารย์',  color: '#98c379', icon: 'book' },
  { key: 'acquaintance', label: 'รู้จัก',          color: '#abb2bf', icon: 'chat' },
  { key: 'neutral',      label: 'เป็นกลาง',       color: '#5c6370', icon: 'minus' },
  { key: 'custom',       label: 'อื่น ๆ',          color: '#c678dd', icon: 'bookmark' },
];

export const REL_COLOR = Object.fromEntries(REL_TYPES.map((t) => [t.key, t.color]));
export const REL_ICON = Object.fromEntries(REL_TYPES.map((t) => [t.key, t.icon]));
export const REL_LABEL = Object.fromEntries(REL_TYPES.map((t) => [t.key, t.label]));

// เดาประเภทจากบทบาท (ไทย + อังกฤษ) — ใช้เป็นค่าเริ่มต้นในกล่องผูกความสัมพันธ์ + สีเส้นใน Story Network
export function categorizeRole(role) {
  const r = (role || '').toLowerCase();
  if (!r) return 'custom';
  // เช็ค "ลูกศิษย์/ลูกน้อง/ลูกค้า/ลูกหนี้" ก่อน ไม่งั้นโดน "ลูก" ของ family ดูดไปหมด
  if (/อาจารย์|ครู|ศิษย์|mentor|teacher|student/.test(r)) return 'mentor';
  if (/ลูกน้อง|ลูกจ้าง|ลูกค้า|ลูกหนี้|เจ้าหนี้|เจ้านาย|หัวหน้า|boss|subordinate/.test(r)) return 'custom';
  if (/พ่อ|แม่|ลูก|พี่|น้อง|ปู่|ย่า|ตา|ยาย|หลาน|สามี|ภรรยา|ญาติ|บิดา|มารดา|บุตร/.test(r)) return 'family';
  if (/แฟน|คู่รัก|คนรัก|husband|wife|lover/.test(r)) return 'romantic';
  if (/เพื่อน|สหาย|พันธมิตร|friend|ally/.test(r)) return 'ally';
  if (/ศัตรู|คู่อริ|enemy|foe/.test(r)) return 'enemy';
  if (/คู่แข่ง|rival|competitor/.test(r)) return 'rival';
  if (/รู้จัก|acquaintance/.test(r)) return 'acquaintance';
  if (/เป็นกลาง|neutral/.test(r)) return 'neutral';
  return 'custom';
}

// แผนที่ "บทบาท → ประเภท" ที่ผู้ใช้แก้เองได้ใน renderer/inverse_roles.json → categories
// (ให้ค่าที่ตั้งไว้ในไฟล์ชนะ regex เดา แล้วค่อย fallback เป็น categorizeRole)
export function categorizeWith(map, role) {
  const r = (role || '').trim();
  if (r && map && map[r]) return map[r];
  return categorizeRole(r);
}
