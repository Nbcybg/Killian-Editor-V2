// relationship-types.js — ประเภทความสัมพันธ์: ally/enemy/family/rival/romantic/mentor/acquaintance/neutral/custom
// โมดูลบริสุทธิ์ (ไม่แตะ DOM/kapi) → เทสด้วย node ได้ตรง ๆ
import { t } from './i18n.js';

// [alpha.164 · รอบต่อ 2] ชื่อประเภทเป็น "ข้อความบนจอ" ไม่ใช่ข้อมูล — ไฟล์ Wiki เก็บแค่ `key`
// เดิมเขียนไทยตายตัวไว้ใน `label` จึงโผล่เป็นไทยทั้งในกล่องผูกความสัมพันธ์ · ปุ่มกรองของ Story Network ·
// ป้ายบนการ์ด Wiki และหน้าตั้งค่าสีผัง แม้ผู้ใช้เลือกอังกฤษ → `label` เป็น getter อ่านไฟล์ภาษาทุกครั้ง
// คีย์ภาษาเต็มทุกตัว (ห้ามประกอบจากชิ้นส่วน — ตัวตรวจไฟล์ภาษามองไม่เห็น)
const relType = (key, labelKey, color, icon) => ({ key, labelKey, color, icon, get label() { return t(labelKey); } });
export const REL_TYPES = [
  // icon = ชื่อไอคอนใน icons.js (ต้องมีจริง ไม่งั้นวาดออกมาเป็น svg ว่าง)
  relType('family', 'ui.relType.family',       '#e06c75', 'home'),
  relType('romantic', 'ui.relType.romantic',     '#e06ca0', 'star'),
  relType('ally', 'ui.relType.ally',         '#61afef', 'user'),
  relType('rival', 'ui.relType.rival',        '#e5c07b', 'cloud-lightning'),
  relType('enemy', 'ui.relType.enemy',        '#be5046', 'x'),
  relType('mentor', 'ui.relType.mentor',       '#98c379', 'book'),
  relType('acquaintance', 'ui.relType.acquaintance', '#abb2bf', 'chat'),
  relType('neutral', 'ui.relType.neutral',      '#5c6370', 'minus'),
  relType('custom', 'ui.relType.custom',       '#c678dd', 'bookmark'),
];

export const REL_COLOR = Object.fromEntries(REL_TYPES.map((x) => [x.key, x.color]));
export const REL_ICON = Object.fromEntries(REL_TYPES.map((x) => [x.key, x.icon]));
export const REL_LABEL = {};
for (const x of REL_TYPES) Object.defineProperty(REL_LABEL, x.key, { get: () => x.label, enumerable: true });

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
