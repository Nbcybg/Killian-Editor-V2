// network-theme.js — สี + การควบคุมของ Story Network (alpha.73 · ข้อ 2,3)
// โมดูลบริสุทธิ์ ไม่แตะ DOM/kapi — unit test แยกที่ test/network-theme.test.cjs
//
// ═══ ทำไมต้องมีไฟล์นี้ ═══
// เดิมสีของผังกระจายอยู่ 4 ที่ที่ไม่ตรงกัน:
//   1) `CAT_COLOR` / `REL_COLOR` ในโค้ด        2) ชิปบนแถบเครื่องมือ (ฝังเลข hex ไว้ในโค้ดอีกชุด)
//   3) ช่องสีในกล่องตั้งค่า (เขียน HTML มือ 11 ช่อง)  4) `readColors()` ที่แปลงคีย์ `nc-*`/`ne-*`
// → เพิ่มสีใหม่ทีต้องแก้ 4 ที่ · ตกหล่นเมื่อไหร่ผู้ใช้ก็เจอ "สีในตั้งค่าไม่ตรงกับที่เห็นบนผัง"
//
// ตอนนี้: **นิยามที่เดียวคือไฟล์นี้** — ทั้งกล่องตั้งค่า ชิปบนแถบเครื่องมือ และตัววาด
// อ่านจาก `NET_COLOR_DEFS` ชุดเดียวกันหมด · เพิ่มสีใหม่ = เพิ่มบรรทัดเดียวที่นี่

import { T } from './i18n.js';
import { REL_TYPES } from './relationship-types.js';

/**
 * นิยามสีทุกสีที่ผังใช้จริง
 *   key    คีย์ในไฟล์ตั้งค่า (settings.netColors[key])
 *   group  หมวดสำหรับจัดกลุ่มในกล่องตั้งค่า
 *   target ใช้ที่ไหนบนผัง: 'node' (สีโหนดตามหมวด) · 'edge' (สีเส้นตามประเภท) · 'canvas' (พื้น/กริด/ตัวหนังสือ)
 *   id     คีย์ภายในที่ตัววาดใช้ (เช่น cat 'characters' หรือ edge 'family')
 *   def    ค่าเริ่มต้น · cssVar = ถ้าไม่ได้ตั้งเอง ให้ตามธีมของโปรแกรม
 */
export const NET_COLOR_GROUPS = [
  { group: 'nodes',  label: T`สีโหนด (ตามหมวด)` },
  { group: 'edges',  label: T`สีเส้น (ตามประเภทความสัมพันธ์)` },
  { group: 'links',  label: T`สีเส้นเชื่อมอื่น ๆ` },
  { group: 'canvas', label: T`พื้นผัง / ตัวหนังสือ` },
];

const NODE_DEFS = [
  { key: 'nc-char', id: 'characters', label: T`ตัวละคร`,      def: '#d97757' },
  { key: 'nc-loca', id: 'locations',  label: T`สถานที่`,      def: '#7aa8d8' },
  { key: 'nc-item', id: 'items',      label: T`สิ่งของ`,       def: '#6fae8a' },
  { key: 'nc-lore', id: 'lore',       label: T`ตำนาน`,        def: '#b58fc9' },
  { key: 'nc-scen', id: 'scene',      label: T`ฉาก`,          def: '#e8c95c' },
  { key: 'nc-chap', id: 'chapter',    label: T`บท`,           def: '#c08a5e' },
  // [alpha.73 ข้อ 3] เดิม book กับ section ใช้ช่องเดียวกัน (nc-sect) — แยกให้ตั้งได้จริงทั้งคู่
  { key: 'nc-book', id: 'book',       label: T`เล่ม`,          def: '#a8d870' },
  { key: 'nc-sect', id: 'section',    label: T`ตอน/ส่วน`,      def: '#8ec8c8' },
];

// เส้นเชื่อมพิเศษที่ไม่ได้มาจาก REL_TYPES
const LINK_DEFS = [
  { key: 'ne-sl', id: 'scene-link', label: T`ลิงก์ระหว่างฉาก`,   def: '#5caf8a' },
  { key: 'ne-co', id: 'co-occur',   label: T`ปรากฏร่วมในฉาก`,   def: '#8a8885' },
  { key: 'ne-es', id: 'ent-scene',  label: T`เอนทิตี้ ↔ ฉาก`,    def: '#d9955f' },
];

// สีของผืนผ้าใบ — ยังไม่ได้ตั้งเอง = ตามธีมของโปรแกรม (cssVar) · อ่านธีมไม่ได้ค่อยใช้ def
const CANVAS_DEFS = [
  { key: 'nb-bg',      id: 'bg',      label: T`พื้นหลังผัง`,        def: '#1a1a18', cssVar: '--bg' },
  { key: 'nb-grid',    id: 'grid',    label: T`เส้นกริด`,          def: '#3a3a36', cssVar: '--border' },
  { key: 'nb-label',   id: 'label',   label: T`ตัวหนังสือชื่อโหนด`, def: '#faf9f5', cssVar: '--bright' },
  { key: 'nb-labelbg', id: 'labelBg', label: T`พื้นป้ายชื่อโหนด`,   def: '#1f1e1c', cssVar: '--side' },
  { key: 'nb-border',  id: 'border',  label: T`ขอบโหนด`,          def: '#1f1e1c' },
  { key: 'nb-hover',   id: 'hover',   label: T`ขอบโหนดตอนชี้`,     def: '#faf9f5' },
  { key: 'nb-axis',    id: 'axis',    label: T`แกนบอกทิศ (X/Y/Z)`, def: '#8a8885', cssVar: '--dim' },
];

/** สีเส้นตามประเภทความสัมพันธ์ — สร้างจาก REL_TYPES ไม่ต้องเขียนซ้ำ */
const EDGE_DEFS = REL_TYPES.map((t) => ({
  key: 'ne-rt-' + t.key, id: t.key, label: t.label, def: t.color,
}));

export const NET_COLOR_DEFS = [
  ...NODE_DEFS.map((d) => ({ ...d, group: 'nodes', target: 'node' })),
  ...EDGE_DEFS.map((d) => ({ ...d, group: 'edges', target: 'edge' })),
  ...LINK_DEFS.map((d) => ({ ...d, group: 'links', target: 'edge' })),
  ...CANVAS_DEFS.map((d) => ({ ...d, group: 'canvas', target: 'canvas' })),
];

/** นิยามในกลุ่มหนึ่ง — กล่องตั้งค่าใช้สร้างช่องสีเอง ไม่ต้องเขียน HTML มือ */
export function netColorDefsOf(group) { return NET_COLOR_DEFS.filter((d) => d.group === group); }

/**
 * แปลงค่าที่ผู้ใช้ตั้ง → ตารางสีพร้อมใช้ของตัววาด
 * @param saved    settings.netColors (รูปแบบใหม่: { [key]: '#hex' })
 * @param varOf    ฟังก์ชันอ่านตัวแปร CSS ของธีม (ฝั่ง UI ส่ง cssVar มา · เทสส่ง mock)
 * คืน { node:{cat→สี}, edge:{type→สี}, canvas:{id→สี} }
 */
export function resolveNetColors(saved, varOf) {
  const s = normalizeNetColors(saved);
  const readVar = typeof varOf === 'function' ? varOf : () => '';
  const out = { node: {}, edge: {}, canvas: {} };
  for (const d of NET_COLOR_DEFS) {
    let v = String(s[d.key] || '').trim();
    if (!v) v = d.cssVar ? (String(readVar(d.cssVar) || '').trim() || d.def) : d.def;
    out[d.target][d.id] = v;
  }
  return out;
}

/** ค่าเริ่มต้นทั้งชุด (คีย์ครบทุกตัว) — ใช้เติมช่องในกล่องตั้งค่า */
export function defaultNetColors() {
  const out = {};
  for (const d of NET_COLOR_DEFS) out[d.key] = d.def;
  return out;
}

/**
 * รับได้ทั้งรูปแบบเก่าและใหม่
 * เก่า: { cats:{'nc-char':...}, edges:{'ne-sl':..., 'ne-rel':...} }  ('ne-rel' = สีเดียวคุมทุกประเภท)
 * ใหม่: { 'nc-char': ..., 'ne-rt-family': ... }
 */
export function normalizeNetColors(saved) {
  const src = saved && typeof saved === 'object' ? saved : {};
  if (!src.cats && !src.edges) return { ...src };
  const out = { ...src };
  delete out.cats; delete out.edges;
  for (const [k, v] of Object.entries(src.cats || {})) if (v) out[k] = v;
  for (const [k, v] of Object.entries(src.edges || {})) {
    if (!v) continue;
    if (k === 'ne-rel') { for (const d of EDGE_DEFS) if (!out[d.key]) out[d.key] = v; }
    else out[k] = v;
  }
  return out;
}

/** true = ค่าที่บันทึกไว้ยังเป็นรูปแบบเก่า (ฝั่งเรียกจะได้เขียนทับให้เป็นรูปแบบใหม่) */
export function needsNetColorMigration(saved) {
  return !!(saved && typeof saved === 'object' && (saved.cats || saved.edges));
}

// ═══════════════════ การควบคุมด้วยเมาส์ (ข้อ 2) ═══════════════════
// ห้ามฮาร์ดโค้ดปุ่มเมาส์ — ต้องตั้งได้ในตั้งค่าโปรเจกต์ และคำอธิบายใต้ผังต้องตรงกับที่ตั้งไว้เสมอ

export const MOUSE_BUTTONS = [
  { value: 'middle', btn: 1, label: T`ปุ่มกลาง (ล้อ)` },
  { value: 'right',  btn: 2, label: T`คลิกขวา` },
  { value: 'left',   btn: 0, label: T`คลิกซ้าย` },
];
export function buttonLabel(v) {
  const m = MOUSE_BUTTONS.find((x) => x.value === v);
  return m ? m.label : v;
}
export function buttonIndex(v) {
  const m = MOUSE_BUTTONS.find((x) => x.value === v);
  return m ? m.btn : 1;
}

/** ค่าเริ่มต้นของการควบคุมผัง — ปุ่มกลางหมุน 3D เหมือนรุ่นก่อน ๆ */
export const DEFAULT_NET_CONTROLS = { orbitButton: 'middle', panButton: 'left' };

export function resolveNetControls(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const ok = (v, def) => (MOUSE_BUTTONS.some((x) => x.value === v) ? v : def);
  const orbit = ok(s.orbitButton, DEFAULT_NET_CONTROLS.orbitButton);
  // แพนกับหมุนใช้ปุ่มเดียวกันไม่ได้ — ถ้าชนกันให้แพนถอยไปใช้ซ้าย (หรือขวาเมื่อซ้ายถูกยึด)
  let pan = ok(s.panButton, DEFAULT_NET_CONTROLS.panButton);
  if (pan === orbit) pan = orbit === 'left' ? 'right' : 'left';
  return { orbitButton: orbit, panButton: pan };
}

/** คำอธิบายใต้ผัง — สร้างจากค่าที่ตั้งไว้จริง (เดิมเป็นข้อความตายตัวจึงไม่ตรงกับปุ่มที่ใช้จริง) */
export function controlsHint(controls, mode3D) {
  const c = resolveNetControls(controls);
  const parts = [
    T`ลาก${buttonLabel(c.panButton)}พื้นที่ว่าง = เลื่อนผัง`,
    T`ล้อ = ซูม`,
    T`Shift+คลิกโหนด = ผลักโหนดรอบ ๆ ออก`,
    T`ดับเบิลคลิก = เปิด`,
  ];
  if (mode3D) parts.splice(2, 0, T`ลาก${buttonLabel(c.orbitButton)} = หมุนมุมมอง 3D`);
  else parts.push(T`(เปิดโหมด 3D แล้วลาก${buttonLabel(c.orbitButton)} = หมุนมุมมอง)`);
  return parts.join(' · ');
}

// ═══════════════════ พิกัดกล้อง (ข้อ 4) ═══════════════════

/**
 * พิกัด "โลก" ของจุดกึ่งกลางจอ — ค่านี้ต้องไม่เปลี่ยนตอนซูม (ถ้าซูมยึดกึ่งกลาง)
 * ของเดิมโชว์ `_cx/_cy` ซึ่งเป็นระยะเลื่อนของกล้องเป็นพิกเซล — ซูมทีค่าก็เปลี่ยนทั้งที่ยังมองที่เดิม
 */
export function viewCenter(cam, w, h) {
  const s = (cam && +cam.scale) || 1;
  const cx = (cam && +cam.cx) || 0, cy = (cam && +cam.cy) || 0;
  return { x: (w / 2 - cx) / s, y: (h / 2 - cy) / s };
}

/** ตำแหน่งกล้องใหม่หลังซูม โดยยึดจุดกึ่งกลางจอไว้ที่เดิม */
export function zoomAtCenter(cam, w, h, nextScale) {
  const s = (cam && +cam.scale) || 1;
  const raw = Number(nextScale);
  const ns = Math.max(0.05, Math.min(8, Number.isFinite(raw) ? raw : s));
  const c = viewCenter(cam, w, h);
  return { scale: ns, cx: w / 2 - c.x * ns, cy: h / 2 - c.y * ns };
}

/** ทิศของแกน X/Y/Z บนจอ (หน่วยเวกเตอร์) — ใช้วาดลูกศรบอกแกนที่มุมผัง */
export function axisVectors(rx, ry, mode3D) {
  if (!mode3D) return { x: { x: 1, y: 0 }, y: { x: 0, y: 1 }, z: null };
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  // ตรงกับ project3D ใน network.js — แกนหนึ่งหน่วยผ่านสูตรฉายเดียวกัน
  const proj = (x, y, z) => ({
    x: x * cosY + z * sinY,
    y: y * cosX - (x * -sinY + z * cosY) * sinX,
  });
  return { x: proj(1, 0, 0), y: proj(0, 1, 0), z: proj(0, 0, 1) };
}
