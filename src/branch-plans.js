// branch-plans.js — "แผน" ของผังแตกสาย: หลายผังต่อหนึ่งโปรเจกต์ (alpha.73 · ข้อ 5)
// โมดูลบริสุทธิ์ ไม่แตะ DOM/kapi — unit test แยกที่ test/branch-plans.test.cjs
//
// ═══ อะไรคือ "แผน" ═══ [alpha.74 — ตามเหตุผลที่ผู้ใช้อธิบาย]
// แผนไม่ได้เก็บแค่ "วิธีมองผัง" อีกต่อไป — **แผนเก็บชุดทางเลือกของตัวเอง** เพราะ:
//   1. ต้องเทียบกันได้ เวลาทำงานหลายคน (ใครเสนอเส้นทางแบบไหน)
//   2. หนึ่งโปรเจกต์มีหลายเล่ม แต่ละเล่มทางเลือกไม่เหมือนกัน (แบบหนังสือ D&D)
//   3. ติดป้ายได้อิสระ — แผนนี้ร่าง · แผนนี้ใช้จริง · แผนนี้สำรอง
// → **คุณสมบัติของแผนจึงเป็นชุดเดียวกับฉาก**: สถานะ · สี · แท็ก · โน้ต
//
// ตัวฉาก (เนื้อเรื่อง) ยังอยู่ที่เดิมใน scenes.json — แผนเก็บ "ทางเลือกของฉากไหนไปฉากไหน" ทับลงไป
// ไม่ได้เลือกแผน = ใช้ทางเลือกใน scenes.json ตามปกติ (พฤติกรรมเดิมทุกอย่าง)
//
// plan = { version, name, note, status, color, tags[], book,
//          choices:{[sceneId]:[{text,nextSceneId,color?}]},
//          positions:{[nodeId]:{x,y}}, colors:{[nodeId]:'#hex'},
//          view:'tree'|'list', zoom, sel, updated }

import { T } from './i18n.js';
export const BRANCH_PLAN_VERSION = 3;
export const BRANCH_PLAN_DIR = 'Branches';
export const BRANCH_PLAN_EXT = '.json';

/** สถานะของแผน — แนวคิดเดียวกับ "สถานะฉาก" (ผู้ใช้ขอให้คุณสมบัติเหมือนฉาก) */
export const PLAN_STATUSES = ['ร่าง', 'กำลังทำ', 'ใช้จริง', 'สำรอง', 'พับไว้'];
export const PLAN_DEFAULT_STATUS = 'ร่าง';

/** แผนเปล่า */
export function newBranchPlan(name) {
  return { version: BRANCH_PLAN_VERSION, name: String(name || T`แผนใหม่`).trim() || T`แผนใหม่`,
           note: '', status: PLAN_DEFAULT_STATUS, color: '', tags: [], book: '',
           choices: {}, positions: {}, colors: {}, view: 'tree', zoom: 1, sel: null, updated: '' };
}

/** ทางเลือกหนึ่งอันในรูปแบบมาตรฐาน (ทิ้งของที่ไม่มีข้อความ) */
export function normalizeChoice(c) {
  if (!c || typeof c !== 'object') return null;
  const text = String(c.text == null ? '' : c.text).trim();
  if (!text) return null;
  const out = { text, nextSceneId: String(c.nextSceneId || '') };
  if (typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color)) out.color = c.color;
  return out;
}

/** ชุดทางเลือกทั้งผัง { sceneId: [choice] } — ทิ้งฉากที่ไม่เหลือทางเลือก */
export function normalizeChoiceMap(raw) {
  const out = {};
  for (const [id, list] of Object.entries((raw && typeof raw === 'object') ? raw : {})) {
    if (!Array.isArray(list)) continue;
    const arr = list.map(normalizeChoice).filter(Boolean);
    if (arr.length) out[String(id)] = arr;
  }
  return out;
}

/** ถ่ายชุดทางเลือกปัจจุบันจากรายการฉาก (ใช้ตอนสร้างแผนใหม่จากของที่มีอยู่) */
export function snapshotChoices(scenes) {
  const out = {};
  for (const s of scenes || []) {
    const arr = (s && Array.isArray(s.choices)) ? s.choices.map(normalizeChoice).filter(Boolean) : [];
    if (arr.length) out[String(s.id)] = arr;
  }
  return out;
}

/**
 * เอาทางเลือกของแผนไปสวมทับรายการฉาก — คืน array ใหม่ (ไม่แก้ของเดิม)
 * ฉากที่แผนไม่ได้พูดถึง = ไม่มีทางเลือกในแผนนี้ (ไม่ใช่ "ตกไปใช้ของ scenes.json")
 * ไม่งั้น "ลบทางเลือกออกจากแผน" จะทำไม่ได้เลย เพราะของเดิมโผล่กลับมาทุกครั้ง
 */
export function applyPlanChoices(scenes, plan) {
  if (!plan || !plan.choices) return (scenes || []).slice();
  const map = normalizeChoiceMap(plan.choices);
  return (scenes || []).map((s) => ({ ...s, choices: (map[String(s.id)] || []).map((c) => ({ ...c })) }));
}

export function planChoicesFor(plan, sceneId) {
  const map = (plan && plan.choices) || {};
  const list = map[String(sceneId)];
  return Array.isArray(list) ? list.map(normalizeChoice).filter(Boolean) : [];
}
export function setPlanChoices(plan, sceneId, list) {
  if (!plan) return null;
  plan.choices = plan.choices || {};
  const arr = (list || []).map(normalizeChoice).filter(Boolean);
  if (arr.length) plan.choices[String(sceneId)] = arr;
  else delete plan.choices[String(sceneId)];
  return plan;
}

/**
 * เทียบสองแผน — เหตุผลข้อ 1 ของผู้ใช้ (ทำงานหลายคนแล้วต้องดูว่าต่างกันตรงไหน)
 * คืน [{sceneId, title, only:'a'|'b'|'both', a:[ข้อความ], b:[ข้อความ], same}]
 */
export function comparePlans(a, b, titleOf) {
  const A = normalizeChoiceMap(a && a.choices), B = normalizeChoiceMap(b && b.choices);
  const ids = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const name = typeof titleOf === 'function' ? titleOf : (id) => id;
  return ids.map((id) => {
    const ta = (A[id] || []).map((c) => c.text + '@' + c.nextSceneId);
    const tb = (B[id] || []).map((c) => c.text + '@' + c.nextSceneId);
    return { sceneId: id, title: name(id),
             a: (A[id] || []).map((c) => c.text), b: (B[id] || []).map((c) => c.text),
             only: !A[id] ? 'b' : !B[id] ? 'a' : 'both',
             same: ta.join('|') === tb.join('|') };
  });
}
/** สรุปผลเทียบสั้น ๆ */
export function compareSummary(rows) {
  const r = rows || [];
  return { total: r.length, same: r.filter((x) => x.same).length,
           diff: r.filter((x) => !x.same && x.only === 'both').length,
           onlyA: r.filter((x) => x.only === 'a').length,
           onlyB: r.filter((x) => x.only === 'b').length };
}

const numOr = (v, d) => (Number.isFinite(+v) ? +v : d);

/** อ่านไฟล์แผนแบบปลอดภัย — ไฟล์พัง/รุ่นเก่า ต้องไม่ทำแผงล้ม */
export function normalizeBranchPlan(raw, fallbackName) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = newBranchPlan(r.name || fallbackName);
  out.note = String(r.note || '');
  // คุณสมบัติชุดเดียวกับฉาก
  out.status = PLAN_STATUSES.includes(r.status) ? r.status : PLAN_DEFAULT_STATUS;
  out.color = (typeof r.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(r.color)) ? r.color : '';
  out.tags = Array.isArray(r.tags) ? r.tags.map((x) => String(x).trim()).filter(Boolean) : [];
  out.book = String(r.book || '');
  out.choices = normalizeChoiceMap(r.choices);
  out.view = r.view === 'list' ? 'list' : 'tree';
  out.zoom = Math.max(0.2, Math.min(3, numOr(r.zoom, 1)));
  out.sel = r.sel || null;
  out.updated = String(r.updated || '');
  for (const [k, v] of Object.entries(r.positions || {})) {
    if (!v || typeof v !== 'object') continue;
    const x = numOr(v.x, null), y = numOr(v.y, null);
    if (x === null || y === null) continue;
    out.positions[k] = { x, y };
  }
  for (const [k, v] of Object.entries(r.colors || {})) {
    if (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) out.colors[k] = v;
  }
  return out;
}

/** สภาพปัจจุบันของหน้าจอ → แผน (ใช้ตอนกดบันทึก) */
export function planFromState({ name, note, status, color, tags, book, choices,
                                positions, colors, view, zoom, sel, now }) {
  const p = normalizeBranchPlan({ name, note, status, color, tags, book, choices,
                                  positions, colors, view, zoom, sel }, name);
  p.updated = String(now || '');
  return p;
}

/** ชื่อไฟล์ที่ปลอดภัย (ตัวเดียวกับที่ Planner ใช้ — อักขระต้องห้ามของ Windows) */
export function safePlanName(name) {
  return String(name || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** ชื่อแผนจากชื่อไฟล์ */
export function planNameFromFile(file) {
  const base = String(file || '').split(/[\\/]/).pop() || '';
  return base.replace(/\.json$/i, '');
}

/** ตั้งชื่อไม่ให้ชนของเดิม — "ชื่อ", "ชื่อ 2", "ชื่อ 3", … */
export function uniquePlanName(name, existing) {
  const taken = new Set((existing || []).map((x) => String(x).toLowerCase()));
  const base = safePlanName(name) || T`แผนใหม่`;
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 999; i++) {
    const n = `${base} ${i}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
  return base + ' ' + Date.now().toString(36);
}

/** true = มีอะไรต่างจากที่บันทึกไว้ (ใช้เตือนก่อนสลับแผน/ปิดโปรแกรม) */
export function planDirty(current, saved) {
  if (!saved) return !!(current && (Object.keys(current.positions || {}).length ||
                                    Object.keys(current.colors || {}).length ||
                                    Object.keys(current.choices || {}).length));
  const pick = (p) => JSON.stringify({
    positions: p.positions || {}, colors: p.colors || {},
    view: p.view, zoom: p.zoom, note: p.note || '',
    status: p.status || '', color: p.color || '', tags: p.tags || [], book: p.book || '',
    choices: normalizeChoiceMap(p.choices),
  });
  return pick(current || newBranchPlan('')) !== pick(saved);
}

/** เรียงรายการแผน: ชื่อไทย */
export function sortPlans(list) {
  return (list || []).slice().sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'th'));
}

/** สรุปสั้น ๆ ไว้โชว์ในรายการ/Explorer */
export function planSummary(plan) {
  const p = plan || {};
  const parts = [];
  const ch = normalizeChoiceMap(p.choices);
  const nCh = Object.values(ch).reduce((n, l) => n + l.length, 0);
  if (nCh) parts.push(nCh + T` ทางเลือก / ` + Object.keys(ch).length + T` ฉาก`);
  if (p.status && p.status !== PLAN_DEFAULT_STATUS) parts.push(p.status);
  if ((p.tags || []).length) parts.push('#' + p.tags.join(' #'));
  const n = Object.keys(p.positions || {}).length;
  if (n) parts.push(n + T` การ์ดจัดเอง`);
  if (p.view === 'list') parts.push(T`มุมมองรายการ`);
  return parts.join(' · ') || T`ยังไม่ได้จัดอะไร`;
}
