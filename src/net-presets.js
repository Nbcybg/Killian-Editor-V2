// net-presets.js — [alpha.80] ชุดสีสำเร็จรูปของ Story Network (บริสุทธิ์ 100% · มี unit test)
//
// เดิมผู้ใช้ต้องไล่ตั้งสีทีละช่อง 25 ช่อง — ไม่มีใครทำจริง
// ตอนนี้เลือกชุดเดียวจบ แล้วค่อยแก้ทีละช่องต่อได้ · บันทึกชุดของตัวเองก็ได้
//
// ═══ ชุดที่มีมาให้ ═══
//   Default  ค่าเดิมของโปรแกรม (ส้มอิฐ/ฟ้า/เขียว — โทนเดียวกับธีม)
//   Cable    สีสายไฟ/สายแลนตามมาตรฐาน (น้ำตาล ส้ม ฟ้า เขียว) — คุมโทนเข้ม อ่านง่ายบนพื้นมืด
//   Flower   สีดอกไม้ — โทนอ่อนหวาน ต่างกันชัดโดยไม่แสบตา
//   Xrite    อิงแผ่นเทียบสี ColorChecker — สีมาตรฐานที่ต่างกันชัดที่สุดเท่าที่ตาแยกออก
//   Rainbow  ไล่สีรุ้งตามลำดับ — หาโหนดตามลำดับหมวดได้เร็ว
//
// ชุดในตัวแก้ไม่ได้ (ต้อง "บันทึกเป็นชุดใหม่") — เหมือนพรีเซ็ตของเวิร์กโฟลว์ส่งออก

import { t as tt } from './i18n.js';

/** คีย์สีตามลำดับที่ชุดสำเร็จรูปกำหนดค่าให้ (ตรงกับ key ใน NET_COLOR_DEFS) */
export const PRESET_KEYS = [
  // โหนด 8 หมวด
  'nc-char', 'nc-loca', 'nc-item', 'nc-lore', 'nc-scen', 'nc-chap', 'nc-book', 'nc-sect',
  // เส้นตามประเภทความสัมพันธ์ 9 แบบ (คีย์จริงคือ `ne-rt-<ชนิด>` — ดู network-theme.js)
  'ne-rt-family', 'ne-rt-romantic', 'ne-rt-ally', 'ne-rt-rival', 'ne-rt-enemy',
  'ne-rt-mentor', 'ne-rt-acquaintance', 'ne-rt-neutral', 'ne-rt-custom',
  // เส้นเชื่อมอื่น ๆ
  'ne-sl', 'ne-co', 'ne-es',
];

/** สร้าง object สีจากลิสต์สี (จับคู่กับ PRESET_KEYS ตามลำดับ) */
function mk(list) {
  const out = {};
  PRESET_KEYS.forEach((k, i) => { if (list[i]) out[k] = list[i]; });
  return out;
}

// ── ชุดในตัว ─────────────────────────────────────────────────────────
// หมายเหตุ: ค่าเหล่านี้เป็น "ข้อมูลสี" ไม่ใช่ข้อความ — ไม่ต้องแปลตามภาษา
const BUILTIN_COLORS = {
  default: [
    '#d97757', '#7aa8d8', '#6fae8a', '#b58fc9', '#e8c95c', '#c08a5e', '#a8d870', '#8ec8c8',
    '#e06c75', '#e06ca0', '#61afef', '#e5c07b', '#be5046', '#98c379', '#abb2bf', '#5c6370', '#c678dd',
    '#5caf8a', '#8a8885', '#d9955f',
  ],
  // สีสายไฟ/สายสัญญาณตามมาตรฐาน (น้ำตาล-ส้ม-ฟ้า-เขียว + คู่ขาวลาย)
  cable: [
    '#a0522d', '#1f6fb4', '#2e8b57', '#e08a1e', '#8b7355', '#4a7ba7', '#5f9e6e', '#b8860b',
    '#c0562d', '#d4699a', '#3b8ed0', '#d99a2b', '#9c3b2e', '#4f9c5a', '#9aa0a6', '#5a6470', '#8e6bb5',
    '#3f8f7a', '#77736e', '#b8763f',
  ],
  // โทนดอกไม้ — อ่อน อิ่ม ไม่แสบตา
  flower: [
    '#e8748c', '#8ab6e8', '#86c98f', '#c39ae0', '#f2d06b', '#e0a06a', '#b8dd7a', '#7fd0c4',
    '#ef7b91', '#f090b8', '#74b6ec', '#f0c274', '#d05f62', '#9ad186', '#c9c2d8', '#8b93a8', '#cf8fe0',
    '#6cc4a3', '#a9a49c', '#eda874',
  ],
  // อิงแผ่นเทียบสี ColorChecker (X-Rite) — สีมาตรฐานที่แยกออกจากกันชัดที่สุด
  xrite: [
    '#c04b3c', '#4b6fa8', '#5a9a52', '#8e5aa0', '#e0b03a', '#b06a3a', '#8db83f', '#4fa6a0',
    '#d0402f', '#c2528f', '#3f7fc0', '#dba33c', '#9b2f26', '#6aa84f', '#b0b0aa', '#666a70', '#9a5bb5',
    '#3f9c86', '#8a8781', '#c47a41',
  ],
  // ไล่ตามลำดับสีรุ้ง — ดูปราดเดียวรู้ลำดับหมวด
  rainbow: [
    '#e24a4a', '#e2894a', '#e2c94a', '#96cc4a', '#4acc72', '#4accc4', '#4a8fe2', '#8a4ae2',
    '#e24a8f', '#e24a4a', '#e2894a', '#e2c94a', '#96cc4a', '#4acc72', '#4accc4', '#4a8fe2', '#8a4ae2',
    '#4accc4', '#9aa0a6', '#e2894a',
  ],
};

/** ชุดในตัว — `id` คงที่ (เก็บลงไฟล์) · ชื่อที่แสดงมาจากไฟล์ภาษา */
export const BUILTIN_PRESETS = Object.keys(BUILTIN_COLORS).map((id) => ({
  id, builtIn: true, colors: mk(BUILTIN_COLORS[id]),
}));

/**
 * ชื่อชุดที่แสดงบนหน้าจอ (ชุดในตัวแปลตามภาษา · ชุดของผู้ใช้ใช้ชื่อที่ตั้งเอง)
 *
 * เขียนคีย์เต็มทีละตัว **ไม่ใช่** `tt('ui.netPreset.' + id)` — ประตูกันพลาดของระบบภาษา
 * (`test/i18n-keys.test.cjs`) กวาดหาคีย์แบบข้อความตรง ๆ เท่านั้น
 * คีย์ที่ต่อสตริงเอาตอนรันจะหลุดการตรวจ แล้วไปโผล่เป็นตัวคีย์บนหน้าจอโดยไม่มีใครรู้
 */
const BUILTIN_LABELS = {
  default: () => tt('ui.netPreset.default'),
  cable: () => tt('ui.netPreset.cable'),
  flower: () => tt('ui.netPreset.flower'),
  xrite: () => tt('ui.netPreset.xrite'),
  rainbow: () => tt('ui.netPreset.rainbow'),
};
export function presetLabel(p) {
  if (!p) return '';
  if (!p.builtIn) return p.name || p.id;
  const f = BUILTIN_LABELS[p.id];
  return f ? f() : (p.name || p.id);
}

/** ชุดในตัวตาม id */
export function builtinPreset(id) {
  return BUILTIN_PRESETS.find((p) => p.id === id) || null;
}

/**
 * รวมชุดในตัว + ชุดที่ผู้ใช้บันทึกไว้
 * @param {Array} saved `settings.netPresets` — [{id, name, colors}]
 */
export function allPresets(saved) {
  const mine = normalizePresets(saved);
  return [...BUILTIN_PRESETS, ...mine];
}

/** ทำรายการชุดของผู้ใช้ให้อยู่ในรูปมาตรฐาน (ไฟล์เสีย/รุ่นเก่า ต้องไม่พัง) */
export function normalizePresets(saved) {
  if (!Array.isArray(saved)) return [];
  const seen = new Set(BUILTIN_PRESETS.map((p) => p.id));
  const out = [];
  for (const raw of saved) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').trim();
    const name = String(raw.name || '').trim();
    if (!id || seen.has(id)) continue;             // ห้ามทับ id ของชุดในตัว
    seen.add(id);
    out.push({ id, name: name || id, builtIn: false, colors: normalizeColors(raw.colors) });
  }
  return out;
}

/** เก็บเฉพาะคีย์ที่รู้จักและค่าที่เป็นสี hex จริง */
export function normalizeColors(colors) {
  const out = {};
  if (!colors || typeof colors !== 'object') return out;
  const known = new Set(PRESET_KEYS);
  for (const k of Object.keys(colors)) {
    const v = String(colors[k] || '').trim();
    if (known.has(k) && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v.toLowerCase();
  }
  return out;
}

/** id ที่ปลอดภัยและไม่ซ้ำ สำหรับชุดที่ผู้ใช้บันทึกใหม่ */
export function newPresetId(name, existing) {
  const base = String(name || '').trim().toLowerCase()
    .replace(/[^\w฀-๿-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'preset';
  const taken = new Set([...BUILTIN_PRESETS.map((p) => p.id),
                         ...normalizePresets(existing).map((p) => p.id)]);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 999; i++) if (!taken.has(base + '-' + i)) return base + '-' + i;
  return base + '-x';
}

/** เพิ่มชุดใหม่ → คืนรายการชุดใหม่ (ไม่แก้ของเดิม) */
export function addPreset(saved, name, colors) {
  const list = normalizePresets(saved);
  const id = newPresetId(name, saved);
  return [...list, { id, name: String(name || id).trim() || id,
                     builtIn: false, colors: normalizeColors(colors) }];
}

/** ลบชุดของผู้ใช้ (ชุดในตัวลบไม่ได้) */
export function removePreset(saved, id) {
  return normalizePresets(saved).filter((p) => p.id !== id);
}

/** ลบได้ไหม */
export function canRemove(id) { return !!id && !builtinPreset(id); }

/**
 * เอาชุดสีไปทับค่าที่ตั้งอยู่
 * **ทับเฉพาะคีย์ที่ชุดนั้นกำหนด** — สีที่ชุดไม่ได้พูดถึง (เช่นสีพื้น/กริด) คงของเดิมไว้
 * @returns {object} ตารางสีชุดใหม่
 */
export function applyPreset(current, preset) {
  const cur = (current && typeof current === 'object') ? { ...current } : {};
  const p = preset && preset.colors ? normalizeColors(preset.colors) : {};
  return { ...cur, ...p };
}

/** ชุดที่ตรงกับสีที่ตั้งอยู่ตอนนี้ ('' = ไม่ตรงชุดไหนเลย = ผู้ใช้แก้เอง) */
export function matchPreset(current, saved) {
  const cur = normalizeColors(current);
  for (const p of allPresets(saved)) {
    const pc = normalizeColors(p.colors);
    const keys = Object.keys(pc);
    if (!keys.length) continue;
    if (keys.every((k) => cur[k] === pc[k])) return p.id;
  }
  return '';
}
