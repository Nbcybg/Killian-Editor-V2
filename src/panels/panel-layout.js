// panel-layout.js — โครงต้นไม้เลย์เอาต์ของ panel + ตรรกะ dock/snap/tab/floating (ข้อ 8)
// เป็น pure logic ล้วน (ไม่มี DOM) → ทดสอบด้วย node ได้ · panel-ui.js (opencode) เอาไปวาดจริง
//
// รูปแบบโหนด (recursive):
//   { type:'panel', id, title, collapsed? }                  — ใบ: panel เดี่ยว (collapsed = ปุ่ม ▾ ย่อ)
//   { type:'tabs',  id, children:[panel...], active:number } — กลุ่มแท็บ (หลาย panel ซ้อนเป็นแท็บ)
//   { type:'dock',  id, dir:'row'|'col', children:[...], sizes:[...] } — ผนึกแนวนอน(row)/แนวตั้ง(col)
// floating เก็บแยกนอกต้นไม้: { id, panel, x, y, w, h }
// spec: docs/08-panel-system.md

import { t } from '../i18n.js';
let _uid = 0;
const nid = (p = 'n') => `${p}${Date.now().toString(36)}${(_uid++).toString(36)}`;

export function panel(id, title = '') { return { type: 'panel', id, title }; }
export function tabs(children, active = 0, id = nid('t')) { return { type: 'tabs', id, children, active }; }
export function dock(dir, children, sizes, id = nid('d')) {
  return { type: 'dock', id, dir, children, sizes: sizes || evenSizes(children.length) };
}
function evenSizes(n) { return Array.from({ length: n }, () => +(1 / n).toFixed(4)); }

// ───────── สัดส่วนของ dock: ต้องรักษาที่ผู้ใช้ปรับไว้ (บั๊ก #16) ─────────
// เดิมทั้ง dockPanel และ removePanel สั่ง evenSizes() ทุกครั้ง → เปิด/ปิดแผงทีหนึ่ง
// สัดส่วนที่ลากปรับเองก็หายหมด (40/60 → 33/33/33) ตอนนี้คำนวณต่อจากของเดิมแทน
/** ทำผลรวมให้เป็น 1 โดยคงอัตราส่วนสัมพัทธ์ (ผลรวมเป็น 0/ว่าง → แบ่งเท่ากัน) */
export function normalizeSizes(sizes) {
  const s = (sizes || []).map((v) => (isFinite(v) && v > 0 ? v : 0));
  if (!s.length) return [];
  const sum = s.reduce((a, b) => a + b, 0);
  if (sum <= 0) return evenSizes(s.length);
  return s.map((v) => +(v / sum).toFixed(4));
}
/** แทรกลูกใหม่ที่ตำแหน่ง at: ลูกเดิมคงอัตราส่วนกันเอง แล้วหักที่ว่างให้ตัวใหม่ = ส่วนเฉลี่ย 1/(n+1) */
export function insertSize(sizes, at) {
  const prev = (sizes || []).map((v) => (isFinite(v) && v > 0 ? v : 0));
  const n = prev.length;
  if (!n) return [1];
  const sum = prev.reduce((a, b) => a + b, 0);
  const share = 1 / (n + 1);
  const out = sum > 0 ? prev.map((v) => +((v * (1 - share)) / sum).toFixed(4)) : prev.slice();
  out.splice(Math.max(0, Math.min(at | 0, n)), 0, +share.toFixed(4));
  return out;
}
/** เอาลูกที่ดัชนี keep เท่านั้นไว้ แล้ว normalize — ลูกที่เหลือคงอัตราส่วนกันเองเหมือนเดิม */
export function keepSizes(sizes, keep) {
  const prev = sizes || [];
  const fallback = prev.length ? 1 / prev.length : 1;   // ดัชนีที่ไม่มีค่าเดิม → ให้ส่วนเฉลี่ย
  return normalizeSizes(keep.map((i) => (isFinite(prev[i]) ? prev[i] : fallback)));
}

// ───────── snap zone: จากตำแหน่งเมาส์เทียบกรอบ → โซนที่จะผนึก ─────────
// คืน 'left'|'right'|'top'|'bottom'|'center'|null
// edge = สัดส่วนความหนาขอบ (0..0.5) ที่ถือว่า "ชนขอบ"
export function snapZone(px, py, rect, edge = 0.25) {
  const { x, y, w, h } = rect;
  if (px < x || px > x + w || py < y || py > y + h) return null;
  const rx = (px - x) / w, ry = (py - y) / h;
  const dl = rx, dr = 1 - rx, dt = ry, db = 1 - ry;
  const min = Math.min(dl, dr, dt, db);
  if (min > edge) return 'center';                 // อยู่กลาง → รวมเป็นแท็บ
  if (min === dl) return 'left';
  if (min === dr) return 'right';
  if (min === dt) return 'top';
  return 'bottom';
}

/**
 * [alpha.66r3] โซน "ขอบพื้นที่ทำงาน" — ปล่อยตรงนี้ = สร้าง dock ใหม่เต็มด้านนั้น (สเปก Photoshop)
 * คนละเรื่องกับ `snapZone` ที่เทียบกับ **กรอบของแผงแต่ละใบ** · โซนนี้มีสิทธิ์เหนือกว่าเสมอ
 * เพราะผู้ใช้ที่ลากไปชนขอบจอ ตั้งใจ "สร้างคอลัมน์ใหม่" ไม่ใช่ "แทรกข้างแผงที่บังเอิญอยู่ตรงนั้น"
 * @param pad ความหนาของแถบขอบเป็น px (ค่าคงที่ ไม่ใช่สัดส่วน — ขอบจอคือขอบจอ ไม่ว่าจอใหญ่แค่ไหน)
 */
export function edgeZone(px, py, rect, pad = 12) {
  const { x, y, w, h } = rect;
  if (px < x || px > x + w || py < y || py > y + h) return null;
  const dl = px - x, dr = x + w - px, dt = py - y, db = y + h - py;
  const m = Math.min(dl, dr, dt, db);
  if (m > pad) return null;
  if (m === dl) return 'left';
  if (m === dr) return 'right';
  if (m === dt) return 'top';
  return 'bottom';
}

/**
 * [alpha.66r3] id ของโหนด "พื้นที่ทำงาน" = ก้อนที่ไม่รวมแถบตายตัว (แถบเครื่องมือ/แถบสถานะ)
 *
 * ใช้เป็นเป้าตอนปล่อยที่ขอบจอ — ถ้าเอา root ไปตรง ๆ จะได้ dock ที่กินเหนือแถบเครื่องมือด้วย
 * (แถบเครื่องมือต้องอยู่บนสุดเสมอ · แถบสถานะล่างสุดเสมอ)
 */
export function workspaceNodeId(root, isFixedPanel = () => false) {
  if (!root) return null;
  const allFixed = (n) => {
    if (!n || nodeHidden(n)) return true;
    if (n.type === 'panel') return !!isFixedPanel(n.id);
    return (n.children || []).every(allFixed);
  };
  let node = root;
  for (let guard = 0; guard < 20 && node.type === 'dock'; guard++) {
    const soft = (node.children || []).filter((c) => !nodeHidden(c) && !allFixed(c));
    if (soft.length !== 1) break;                  // มีลูกที่ยืดได้หลายตัวแล้ว = นี่แหละพื้นที่ทำงาน
    node = soft[0];
  }
  return node.id || null;
}

// ───────── ท่องต้นไม้ ─────────
export function walk(node, fn, parent = null) {
  fn(node, parent);
  if (node.children) for (const c of node.children) walk(c, fn, node);
}
export function findPanel(node, id) {
  let found = null;
  walk(node, (n) => { if (n.type === 'panel' && n.id === id) found = n; });
  return found;
}
// หา container (tabs/dock) + ดัชนีที่ panel id อยู่
function locate(root, id) {
  let res = null;
  walk(root, (n) => {
    if (n.children) {
      const i = n.children.findIndex((c) => (c.type === 'panel' ? c.id === id : c.id === id));
      if (i >= 0) res = { parent: n, index: i };
    }
  });
  return res;
}

// ───────── dock: แทรก panel ใหม่ชิดขอบของ target ─────────
// side: 'left'|'right'|'top'|'bottom'|'center'
// คืน root ใหม่ (immutable-ish: คืนโครงใหม่ ไม่กลายพันธุ์ของเดิม)
export function dockPanel(root, targetId, side, newPanel) {
  root = clone(root);
  if (side === 'center') return addAsTab(root, targetId, newPanel);
  const wantRow = side === 'left' || side === 'right';
  const before = side === 'left' || side === 'top';
  const loc = locate(root, targetId);
  const targetNode = loc ? loc.parent.children[loc.index] : root;

  const makeDock = (existing) => {
    const kids = before ? [panelize(newPanel), existing] : [existing, panelize(newPanel)];
    const d = dock(wantRow ? 'row' : 'col', kids);
    // [alpha.66r8] **ช่องใหม่ต้องเคารพขนาดของตัวที่อยู่มาก่อน** — A กว้าง 450 อยู่แล้ว
    // เอา B มาแยกช่องข้าง ๆ ทั้งคู่ต้องอยู่ในพื้นที่ 450 เดิม ไม่ใช่กระโดดเป็น 600
    if (existing && existing.pxW > 0) d.pxW = existing.pxW;
    if (existing && existing.pxH > 0) d.pxH = existing.pxH;
    return d;
  };
  if (!loc) return makeDock(root);                 // target คือ root
  const parent = loc.parent;
  // [alpha.66r8 บั๊กชื่อแผงเพี้ยน] **ห้ามเอา dock ไปยัดเป็น "แท็บ" ในกลุ่มแท็บเด็ดขาด**
  // ของเดิม: ปล่อยแยกช่องทับแผงที่อยู่ในกลุ่ม → `parent.children[i]` (ซึ่งเป็นแท็บ) ถูกแทนด้วย dock
  // → แถบแท็บวาดหัวแท็บจากโหนด dock แล้วได้ชื่อเป็น id ดิบ (`dmso7axbt45`) และแท็บนั้นใช้ไม่ได้เลย
  // ที่ถูกคือ **แยกทั้งกลุ่ม**: เอา dock ใหม่ไปแทนที่ตัวกลุ่มในพ่อของกลุ่มเอง
  if (parent.type === 'tabs') {
    const wrapped = makeDock(parent);
    const gloc = locate(root, parent.id);
    if (!gloc) return wrapped;                     // กลุ่มเป็น root อยู่แล้ว
    gloc.parent.children[gloc.index] = wrapped;
    return root;
  }
  // ถ้า parent เป็น dock ทิศเดียวกัน → แทรกเป็นพี่น้อง (ไม่ซ้อน dock เกินจำเป็น)
  if (parent.type === 'dock' && parent.dir === (wantRow ? 'row' : 'col')) {
    const at = before ? loc.index : loc.index + 1;
    // บั๊ก #16a: เดิม evenSizes() ที่นี่ล้างสัดส่วนที่ผู้ใช้ลากปรับไว้ทุกครั้งที่เปิดแผงเพิ่ม
    const cur = parent.sizes && parent.sizes.length === parent.children.length
      ? parent.sizes : evenSizes(parent.children.length);
    parent.children.splice(at, 0, panelize(newPanel));
    parent.sizes = insertSize(cur, at);
  } else {
    parent.children[loc.index] = makeDock(parent.children[loc.index]);
  }
  return root;
}
function panelize(p) { return p.type ? p : panel(p.id, p.title); }

// ───────── tab group ─────────
// รวม newPanel เป็นแท็บกับ panel เป้าหมาย
export function addAsTab(root, targetId, newPanel) {
  root = clone(root);
  const np = panelize(newPanel);
  const loc = locate(root, targetId);
  if (!loc) {                                       // target คือ root
    if (root.type === 'tabs') { root.children.push(np); root.active = root.children.length - 1; return root; }
    return tabs([root, np], 1);
  }
  if (loc.parent.type === 'tabs') {                 // target อยู่ในกลุ่มแท็บแล้ว → เพิ่มเข้ากลุ่มเดิม
    loc.parent.children.push(np); loc.parent.active = loc.parent.children.length - 1; return root;
  }
  const cur = loc.parent.children[loc.index];       // target เป็น panel ใน dock → ห่อเป็น tabs
  if (cur.type === 'tabs') { cur.children.push(np); cur.active = cur.children.length - 1; }
  else {
    // [alpha.66r7 กฎกลุ่มของผู้ใช้] **กลุ่มยึดขนาดจากแผงฐาน** — A กว้าง 450 อยู่แล้ว
    // เอา B มารวม กลุ่มต้องยังกว้าง 450 ไม่ใช่กระโดดไปเป็นค่าอื่น
    const g = tabs([cur, np], 1);
    if (cur.pxW > 0) g.pxW = cur.pxW;
    if (cur.pxH > 0) g.pxH = cur.pxH;
    loc.parent.children[loc.index] = g;
  }
  return root;
}
/**
 * [alpha.66r3] แทรกแผงเข้ากลุ่มแท็บ **ที่ตำแหน่งที่ระบุ** (ปล่อยลงบนหัวแท็บใบใดใบหนึ่ง)
 * ต่างจาก `addAsTab` ที่ต่อท้ายเสมอ — สเปกข้อ "ปล่อยบนแท็บที่มีอยู่ → แทรกเป็นแท็บตรงนั้นทันที"
 */
export function addAsTabAt(root, targetId, newPanel, index) {
  root = addAsTab(root, targetId, newPanel);
  const np = panelize(newPanel);
  let grp = null;
  walk(root, (n) => { if (!grp && n.type === 'tabs' && n.children.some((c) => c.id === np.id)) grp = n; });
  if (!grp) return root;
  const from = grp.children.findIndex((c) => c.id === np.id);
  const to = Math.max(0, Math.min(index | 0, grp.children.length - 1));
  if (from < 0 || from === to) return root;
  const [m] = grp.children.splice(from, 1);
  grp.children.splice(to, 0, m);
  grp.active = to;
  return root;
}

// เลือกแท็บที่แสดงในกลุ่ม (ตาม index)
export function setActiveTab(root, tabsId, index) {
  root = clone(root);
  let grp = null; walk(root, (n) => { if (n.id === tabsId && n.type === 'tabs') grp = n; });
  if (grp) grp.active = Math.max(0, Math.min(index, grp.children.length - 1));
  return root;
}
// เลื่อน panel ให้เป็นแท็บที่แสดงอยู่ (ใช้ตอน showPanel กับ panel ที่ซ่อนอยู่หลังแท็บอื่น)
export function activatePanel(root, panelId) {
  root = clone(root);
  walk(root, (n) => {
    if (n.type !== 'tabs') return;
    const i = n.children.findIndex((c) => c.id === panelId);
    if (i >= 0) n.active = i;
  });
  return root;
}
// สลับลำดับแท็บภายในกลุ่มเดียวกัน
export function moveTab(root, tabsId, from, to) {
  root = clone(root);
  let grp = null; walk(root, (n) => { if (n.id === tabsId && n.type === 'tabs') grp = n; });
  if (!grp) return root;
  const [m] = grp.children.splice(from, 1);
  grp.children.splice(to, 0, m);
  grp.active = to;
  return root;
}
// แยก panel ออกจากกลุ่มแท็บ → dock ไปด้านที่ระบุ (หรือ float ถ้า side=null → คืน {root, detached})
export function splitTab(root, panelId, side = 'right') {
  root = clone(root);
  const p = findPanel(root, panelId);
  if (!p) return { root, detached: null };
  const detached = { ...p };
  root = removePanel(root, panelId);
  // ถ้าเอาออกแล้วต้นไม้ว่าง (มี panel เดียวอยู่ก่อน) → ตัวที่ถอดมากลายเป็น root เอง
  if (side) root = root ? dockPanel(root, rootFirstPanelId(root), side, detached) : panelize(detached);
  return { root, detached };
}

// รวมหลาย panel ให้เป็น Tab Group เดียว — ยึดตำแหน่งของ ids[0] แล้วดูดตัวที่เหลือเข้ามา
// (ตัวที่เหลือถูกถอดจากที่เดิมก่อน → container ที่ว่างจะยุบเองผ่าน removePanel)
export function groupPanels(root, ids) {
  let out = clone(root);
  if (!Array.isArray(ids) || ids.length < 2) return out;
  const [target, ...rest] = ids;
  if (!findPanel(out, target)) return out;
  for (const id of rest) {
    if (id === target) continue;
    const p = findPanel(out, id);
    if (!p) continue;
    const detached = { ...p };
    out = removePanel(out, id);
    if (!findPanel(out, target)) return out;      // กันกรณีต้นไม้ยุบจน target หาย (ไม่ควรเกิด)
    out = addAsTab(out, target, detached);
  }
  return out;
}

// ───────── ย่อ/ขยาย (ปุ่ม ▾) — โหนดยังอยู่ในต้นไม้ แค่ติดธง ─────────
export function collapsePanel(root, id, on) {
  root = clone(root);
  const p = findPanel(root, id);
  if (p) p.collapsed = on === undefined ? !p.collapsed : !!on;
  return root;
}
export function isCollapsed(root, id) {
  const p = findPanel(root, id);
  return !!(p && p.collapsed);
}

// ───────── [alpha.62 บั๊ก 21] ปิดแผง = ติดธง `hidden` — **โหนดยังอยู่ที่เดิมในต้นไม้** ─────────
//
// ของเดิม `hidePanel` เรียก `removePanel()` = ตัดโหนดทิ้งจริง ๆ แล้วผลตามมา 2 อย่าง:
//   1) **สล็อตหาย** — เปิดกลับต้องเดาตำแหน่งใหม่จาก `homes` (targetId + side)
//      ตัวเดายึด "เพื่อนบ้านที่มุมซ้ายบนใกล้ที่สุด" ซึ่งเลือกผิดตัวได้ง่ายมาก:
//      แผงที่ผนึกไว้ "ขอบบนของเอกสาร" (dock แนวตั้ง) มีมุมซ้ายบนใกล้แผงโปรเจกต์ฝั่งซ้าย
//      มากกว่าใกล้แผงเอกสารที่มันเกาะอยู่จริง → เปิดกลับแล้วไปโผล่ "ขวาของแผงโปรเจกต์" = ฝั่งซ้ายจอ
//   2) **พี่น้องโดนเกลี่ยขนาดใหม่** — `keepSizes()` แจกส่วนของตัวที่หายให้ตัวที่เหลือ
//      แล้วตอนเปิดกลับ `insertSize()` ก็หักส่วนคืนแบบเฉลี่ย → ratio ของแผงอื่นขยับทุกครั้งที่เปิด/ปิด
//
// ติดธงแทนการตัดทิ้ง = ทั้งตำแหน่ง ทิศ ลำดับพี่น้อง และ `sizes` ของ dock **ไม่ถูกแตะเลย**
// เปิดกลับ = ถอดธง แล้วได้ทุกอย่างคืนเป๊ะโดยไม่ต้องเดาอะไรเลย (และแผงอื่นไม่ขยับ)
export function setPanelHidden(root, id, hidden) {
  root = clone(root);
  const p = findPanel(root, id);
  if (!p) return root;
  if (hidden) p.hidden = true; else delete p.hidden;
  return root;
}
export function isPanelHidden(root, id) {
  const p = findPanel(root, id);
  return !!(p && p.hidden);
}
/** โหนดนี้ถูกซ่อนอยู่ไหม (ใช้ในตัววาด — รับโหนดตรง ๆ ไม่ต้องค้นทั้งต้นไม้) */
export function nodeHidden(node) {
  if (!node) return true;
  if (node.type === 'panel') return !!node.hidden;
  // container ที่ลูกถูกซ่อนหมด = ไม่มีอะไรให้แสดง → ซ่อนตัวเองด้วย (ไม่งั้นกินที่ว่างเปล่า)
  return (node.children || []).every(nodeHidden);
}
/** ลูกที่ยังเห็นอยู่ของ dock/tabs (ข้ามตัวที่ถูกปิดไว้) */
export function shownChildren(node) {
  return ((node && node.children) || []).filter((c) => !nodeHidden(c));
}
/**
 * [alpha.68r] **กลุ่มแท็บที่เหลือแท็บที่เห็นได้ใบเดียว = ไม่ใช่กลุ่มอีกต่อไป**
 *
 * ที่มาของบั๊ก: ตั้งแต่ alpha.62 บั๊ก 21 การปิดแผงที่ผนึกอยู่ = **ติดธง `hidden`** ไม่ใช่ตัดออกจากต้นไม้
 * (เพื่อให้เปิดกลับแล้วได้ตำแหน่ง/ลำดับ/สัดส่วนเดิมเป๊ะ) — แต่ `collapse()` ที่ยุบกลุ่มเหลือใบเดียว
 * นับจาก `children.length` ซึ่ง **ไม่ลดลง** เมื่อปิดแท็บ → กลุ่มยังเป็นกลุ่มอยู่
 * ผลคือได้แถบแท็บที่มีแท็บใบเดียวคาอยู่เหนือหัวแผงของมันเอง (ซ้ำซ้อน และลากจัดกลุ่มใหม่ก็สับสน)
 * กรณีลอย (`_detach`) ยุบให้อยู่แล้ว — เพี้ยนเฉพาะกรณีผนึก · alpha.67/.68 (ปุ่ม 🖥) ทำให้เจอบ่อยขึ้น
 *
 * แก้ที่ **ตัววาด** ไม่ใช่ที่ต้นไม้: ต้นไม้ต้องเก็บแท็บที่ปิดไว้ที่เดิมต่อไป เปิดกลับแล้วกลุ่มต้องคืนมาครบ
 * @returns {object|null} ลูกใบเดียวที่เหลือ (ให้ตัววาดวาดเป็นแผงเดี่ยว) · null = ยังเป็นกลุ่มจริง ๆ
 */
export function soloTab(node) {
  if (!node || node.type !== 'tabs') return null;
  if (node.collapsed) return null;                 // ย่อเป็นแถบไอคอน = ผู้ใช้สั่งเอง ห้ามแปลงร่าง
  const shown = shownChildren(node);
  return shown.length === 1 ? shown[0] : null;
}
/**
 * [alpha.66r2 ข้อ 2] โหนดนี้ "ยืดตามพื้นที่ที่เหลือ" ไม่ได้
 *
 * ต้นตอของบั๊ก "ย่อแผงขวาแล้วเหลือช่องว่างค้าง": ตัววาดแจก `flex-grow` ตามสัดส่วนในต้นไม้
 * โดยหักออกจากตัวหารเฉพาะแผงตายตัว (แถบเครื่องมือ/แถบสถานะ) แต่ **ไม่รู้จักแผงที่พับ
 * และกลุ่มแท็บที่ย่อเป็นแถบไอคอน** ซึ่ง CSS บังคับ `flex:0 0 auto/34px !important` ให้อยู่แล้ว
 * → ส่วนแบ่งของมันหายจากการแจก แต่ยังอยู่ในตัวหาร ทำให้ผลรวม flex-grow ที่ใช้จริง **< 1**
 * ตามสเปก Flexbox §9.7 เบราว์เซอร์จะแจกพื้นที่ว่างแค่เป็นสัดส่วนนั้น ที่เหลือค้างเป็นช่องว่าง
 *
 * `isFixedPanel(id)` = callback ถามว่าแผงนี้เป็นแผงตายตัวไหม (meta อยู่ฝั่ง UI ไม่ใช่ในต้นไม้)
 */
export function nodeRigid(node, isFixedPanel = () => false) {
  if (!node || nodeHidden(node)) return false;          // ซ่อนอยู่ = ไม่ถูกวาด ไม่ต้องคิด
  if (node.type === 'panel') return !!node.collapsed || !!isFixedPanel(node.id);
  if (node.type === 'tabs') {
    // [alpha.68r] เหลือแท็บที่เห็นได้ใบเดียว = ตัววาดวาดเป็น "แผงเดี่ยว" → ความแข็งต้องยึดตามใบนั้น
    // ไม่งั้นเจอบั๊กเดิมของ 66r2 อีกรอบ: แผงพับอยู่ (CSS บังคับ flex:0 0 auto) แต่ต้นไม้บอกว่ายืดได้
    // → ส่วนแบ่งหายจากการแจกแต่ยังอยู่ในตัวหาร = **ช่องว่างค้าง**
    const solo = soloTab(node);
    if (solo) return nodeRigid(solo, isFixedPanel);
    return !!node.collapsed;                            // ย่อเป็นแถบไอคอน
  }
  if (node.type === 'dock') {
    // dock ที่ลูกแข็งหมด = ทั้งก้อนแข็ง (ไม่งั้นมันยืดแล้วเหลือช่องว่างข้างในแทน)
    const kids = (node.children || []).filter((c) => !nodeHidden(c));
    return kids.length > 0 && kids.every((c) => nodeRigid(c, isFixedPanel));
  }
  return false;
}

/** ขนาดต่ำสุดของแผงที่วัดเป็น px (กันลากจนหายไปเลย) — CSS บังคับซ้ำอีกชั้น */
export const MIN_PANEL_PX = 90;
/**
 * [alpha.66r5] ขนาดต่ำสุดของ "พื้นที่ทำงาน" ตรงกลาง — ลากเบียดจนแคบกว่านี้ไม่ได้
 * กฎที่ผู้ใช้กำหนด: ลากขอบฝั่งซ้าย ฝั่งขวาต้องไม่หด และกลับกัน · ตัวที่ยอมเสียพื้นที่มีแค่ตรงกลาง
 * และเมื่อตรงกลางถึงขั้นต่ำแล้ว = ลากต่อไม่ได้ (ห้ามไปเบียดแผงอีกฝั่งแทน)
 */
export const MIN_CANVAS_PX = 260;

/**
 * [alpha.66r4] ลูกคนไหนของ dock นี้เป็น "ตัวยืด" = ตัวที่มีแผงเอกสารอยู่ข้างใน
 *
 * หัวใจของโมเดลลูกผสม: **ในหนึ่ง dock มีตัวยืดได้ตัวเดียว** ที่เหลือกว้างเป็น px คงที่
 * ย่อ/ขยายหน้าต่างแล้วพื้นที่เขียนจึงดูดส่วนต่างไปคนเดียว (แผงข้างกว้างเท่าเดิมเป๊ะ)
 * คืน -1 = dock นี้ไม่มีแผงเอกสารอยู่เลย → ใช้ระบบสัดส่วนแบบเดิมทั้งก้อน
 */
export function flexChildIndex(node, docsId = 'docs') {
  const kids = (node && node.children) || [];
  for (let i = 0; i < kids.length; i++) {
    if (nodeHidden(kids[i])) continue;
    if (kids[i].type === 'panel' ? kids[i].id === docsId : hasPanel(kids[i], docsId)) return i;
  }
  return -1;
}
/**
 * [alpha.66r6] ขนาดตั้งต้นตอน "ผนึกเข้า dock ครั้งแรก"
 * กฎที่ผู้ใช้กำหนด: พอ dock ให้ใช้ค่า default ก่อน **แล้วเก็บค่าไว้ทันที**
 * — ห้ามปล่อยให้แผงที่เพิ่งผนึกไปแย่งพื้นที่แบบสัดส่วน (นั่นคือที่มาของทั้ง "แผงถูกบีบสุด ๆ"
 *   และ "ช่องว่างค้าง" เพราะ dock จะอยู่ในสภาพผสม px+สัดส่วนซึ่งคาดเดาไม่ได้)
 */
export const DEFAULT_DOCK_W = 300;
export const DEFAULT_DOCK_H = 220;

/**
 * ทำให้แผงมีขนาด px เสมอเมื่ออยู่ใน dock ที่มี "ตัวยืด" (โหมด px)
 * คืน root ใหม่ · ถ้า dock นั้นเป็นโหมดสัดส่วน (ไม่มีแผงเอกสารอยู่เลย) จะไม่แตะอะไร
 */
export function ensureDockPx(root, id, def = {}, docsId = 'docs') {
  // [alpha.66r9] เดิมหา "โหนดที่ id ตรง" แล้วต้องเป็นลูกของ dock พอดี — แผงที่อยู่ในกลุ่มแท็บ
  // (พ่อเป็น tabs) จึงหลุดทุกครั้ง แล้วกลุ่มก็ไม่มีขนาดของตัวเองตลอดกาล
  // ตอนนี้ไต่ขึ้นไปหา "ลูกของ dock ที่ครอบแผงนี้อยู่" แล้วตรึงขนาดให้ก้อนนั้นแทน
  const loc = dockChildOf(root, id);
  if (!loc || loc.parent.type !== 'dock') return root;
  if (flexChildIndex(loc.parent, docsId) < 0) return root;        // โหมดสัดส่วน — ปล่อยไว้
  if (flexChildIndex(loc.parent, docsId) === loc.index) return root;  // ตัวยืดเองไม่ต้องตรึง
  const row = loc.parent.dir === 'row';
  const node = loc.node;
  id = node.id;                                                    // เขียนลงก้อนที่เป็นลูกของ dock จริง ๆ
  if (nodePxDeep(node, row) > 0) return root;                      // มีขนาดของตัวเอง (หรือของลูก) อยู่แล้ว
  // ขนาดตั้งต้นต่างกันตามชนิดแผง — แผงกระดาน/ผัง (Planner · Story Network · Kanban) ต้องกว้างกว่ามาก
  // ถ้าใช้เลขเดียวกันหมด กระดานจะถูกยัดให้เหลือ 300px ทันทีที่เปิด (เจอจริงตอน e2e ของ .66r6)
  const w = Number(def.w) > 0 ? Math.round(def.w) : DEFAULT_DOCK_W;
  const hh = Number(def.h) > 0 ? Math.round(def.h) : DEFAULT_DOCK_H;
  const next = clone(root);
  walk(next, (n) => {
    if (n.id !== id) return;
    if (row) n.pxW = w; else n.pxH = hh;
  });
  return next;
}

/**
 * ขนาดของแผงตอน "ลอย" — เก็บแยกจากขนาดตอนผนึก (กฎข้อ 1+4 ของผู้ใช้)
 *
 * [alpha.66r12] **แยกแกนกัน** — ของเดิมต้องมีครบทั้งคู่ถึงจะคืนค่า (`w > 0 && h > 0`)
 * มีแค่ด้านเดียวก็ทิ้งทั้งคู่ แล้วตกไปใช้ "ขนาดตอนผนึก" ซึ่งของแผงข้างคือ **สูงเต็มคอลัมน์**
 * → อาการที่ผู้ใช้เจอ: ลากออกมาลอยแล้วความกว้างถูก แต่ความสูงเอามาจาก dock
 */
export function nodeFloatBox(node) {
  if (!node) return null;
  const w = Number(node.fW) > 0 ? Number(node.fW) : 0;
  const h = Number(node.fH) > 0 ? Number(node.fH) : 0;
  return (w > 0 || h > 0) ? { w, h } : null;
}
export function setNodeFloatBox(node, w, h) {
  if (!node) return node;
  if (w > 0) node.fW = Math.round(w);
  if (h > 0) node.fH = Math.round(h);
  return node;
}

/** หาโหนดจาก id (panel/tabs/dock ก็ได้) */
export function nodeById(root, id) {
  let hit = null;
  if (root && id) walk(root, (n) => { if (!hit && n && n.id === id) hit = n; });
  return hit;
}
/** ความกว้าง/สูงที่จำไว้ของโหนด (เก็บติดตัวโหนด → ย้ายไป dock อื่นก็ไม่หาย) */
export function nodePx(node, row) {
  const v = node && (row ? node.pxW : node.pxH);
  return Number.isFinite(v) && v > 0 ? v : 0;
}
/**
 * [alpha.66r9 บั๊ก "canvas เปล่าหลังรีเซ็ต"] ขนาดที่จำไว้ **แบบมองทะลุคอนเทนเนอร์**
 *
 * ต้นตอของบั๊ก: ขนาดถูกเก็บไว้ที่โหนดชนิด `panel` เป็นหลัก (ทั้ง `stampDefaultSizes` ตอนรีเซ็ต
 * และ `ensureDockPx` ตอนผนึก) แต่ **ลูกของ dock เป็น `tabs`/`dock` ได้ด้วย** — เลย์เอาต์ตั้งต้น
 * ฝั่งซ้ายเป็น *กลุ่มแท็บ* (โปรเจกต์+Navigation) ซึ่งไม่มีใครเคยเขียน pxW ให้
 * → `dockShares` อ่านค่าจากลูกของ dock ได้ 0 → คิดว่า "ยังไม่มีใครถูกตรึง" → ตกกลับไปโหมดสัดส่วน
 * ทั้งแถว → ค่า 300px ที่เพิ่งประทับตอนรีเซ็ตไม่เคยถูกใช้เลย และทุกครั้งที่โครงเปลี่ยน
 * (เปิดแผง · ผนึกที่ขอบจอ) ทั้งแถวก็ถูกเกลี่ยสัดส่วนใหม่ จนพื้นที่เขียนกับแผงข้างเหลือไม่กี่สิบ px
 *
 * ตรงนี้ **ไม่ใช่การเดาจากขนาดที่วัดได้** (ซึ่งเคยพังมาแล้ว — ดูคำอธิบายใน `dockShares`)
 * แต่เป็นการอ่าน "เจตนาที่ผู้ใช้/ค่าอ้างอิงเขียนไว้แล้ว" ที่บังเอิญไปอยู่ลึกกว่าที่ตัววาดมองเห็น
 *   · tabs → กว้างเท่าแท็บที่กว้างที่สุดในกลุ่ม (กลุ่มต้องพอสำหรับทุกใบที่สลับไปมา)
 *   · dock → ทิศเดียวกันบวกกัน · คนละทิศเอาค่ามากสุด
 */
export function nodePxDeep(node, row) {
  const own = nodePx(node, row);
  if (own > 0 || !node) return own;
  const kids = (node.children || []).filter((c) => !nodeHidden(c));
  if (!kids.length) return 0;
  const vals = kids.map((c) => nodePxDeep(c, row));
  if (vals.every((v) => v <= 0)) return 0;
  const sameAxis = node.type === 'dock' && (node.dir === 'row') === !!row;
  return sameAxis ? vals.reduce((a, v) => a + v, 0) : Math.max(...vals);
}

/**
 * [alpha.66r9] โหนดที่เป็น "ลูกโดยตรงของ dock" ซึ่งมี panel id นี้อยู่ข้างใน
 *
 * ขนาดตอนผนึกต้องเขียนลงที่ลูกของ dock เสมอ เพราะนั่นคือโหนดที่ `dockShares` อ่าน
 * แผงที่อยู่ในกลุ่มแท็บ พ่อของมันคือ `tabs` ไม่ใช่ `dock` — ของเดิม `ensureDockPx` จึงเลิกทำงานทันที
 * (นี่คือเหตุผลที่ "ลากแผงเข้าไปรวมเป็นแท็บ แล้วขนาดหายทุกครั้ง")
 * @returns {{parent, index, node}|null}
 */
export function dockChildOf(root, id) {
  if (!root || !id) return null;
  let hit = null;
  // walk เดินจากนอกเข้าใน → ตัวที่เจอทีหลังลึกกว่าเสมอ · เอา **ตัวในสุด** ที่ยังเป็นลูกของ dock
  // (ถ้าเอาตัวนอกสุด จะไปตรึงก้อนที่มีพื้นที่เขียนอยู่ข้างในด้วย ซึ่งต้องเป็นตัวยืด ห้ามตรึง)
  walk(root, (n, parent) => {
    if (!parent || parent.type !== 'dock') return;
    if (n.id === id || (n.type !== 'panel' && hasPanel(n, id))) {
      hit = { parent, index: parent.children.indexOf(n), node: n };
    }
  });
  return hit;
}
/** เขียนขนาด px ให้ลูกของ dock — updates = { <ดัชนีลูก>: px } */
export function setDockPx(root, dockId, updates, row) {
  const next = clone(root);
  walk(next, (n) => {
    if (n.type !== 'dock' || n.id !== dockId) return;
    for (const k of Object.keys(updates || {})) {
      const kid = n.children[+k];
      const v = Math.round(Number(updates[k]));
      if (!kid || !(v >= MIN_PANEL_PX)) continue;
      if (row) kid.pxW = v; else kid.pxH = v;
    }
  });
  return next;
}

/**
 * แจกส่วนแบ่งพื้นที่ให้ลูกของ dock — คืนอาร์เรย์ยาวเท่า children
 *   null                 = ไม่ต้องวาด (ถูกซ่อน)
 *   {kind:'rigid'}       = กินพื้นที่เท่าเนื้อหา (flex:0 0 auto) — แถบเครื่องมือ/แผงที่พับ/แถบไอคอน
 *   {kind:'flex'}        = ตัวยืดตัวเดียวของ dock (flex:1 1 0) — สายที่มีแผงเอกสาร
 *   {kind:'px', px}      = กว้าง/สูงคงที่เป็น px · `px:0` = ยังไม่เคยวัด ให้ใช้ `grow` ไปพลางก่อน
 *   {kind:'grow', grow}  = โหมดสัดส่วนเดิม (dock ที่ไม่มีแผงเอกสารอยู่เลย)
 *
 * **กติกาที่ห้ามพังเด็ดขาด (บทเรียน 28 + 66r2):** ทุกโหมดต้อง "ไม่เหลือช่องว่างค้าง"
 *   · โหมด px   → มีตัวยืด grow:1 ดูดที่เหลือทั้งหมดเสมอ
 *   · โหมดสัดส่วน → ผลรวม grow ของตัวที่ยืดได้ = 1 เป๊ะ
 * ห้ามมี dock ที่ลูกเป็น px ล้วนโดยไม่มีตัวยืด — นั่นคือช่องทางที่บั๊กเก่าจะกลับมา
 */
export function dockShares(node, isFixedPanel = () => false, docsId = 'docs') {
  const kids = (node && node.children) || [];
  const out = kids.map(() => null);
  const shown = [];
  for (let i = 0; i < kids.length; i++) if (!nodeHidden(kids[i])) shown.push(i);
  if (!shown.length) return out;
  const sizeOf = (i) => {
    const v = node.sizes && node.sizes[i];
    return Number.isFinite(v) && v > 0 ? v : 1;
  };
  const soft = shown.filter((i) => !nodeRigid(kids[i], isFixedPanel));
  const sum = soft.reduce((a, i) => a + sizeOf(i), 0);
  const ratioOf = (i) => (sum > 0 ? sizeOf(i) / sum : 1 / soft.length);
  for (const i of shown) out[i] = { kind: 'rigid' };

  const row = node.dir === 'row';
  const fi = flexChildIndex(node, docsId);
  // ตัวยืดต้องเป็นลูกที่ "ยืดได้" จริง (ถ้ามันพับอยู่ ก็ถือว่า dock นี้ไม่มีตัวยืด)
  const pxMode = fi >= 0 && soft.includes(fi);
  if (!pxMode) {
    for (const i of soft) out[i] = { kind: 'grow', grow: ratioOf(i) };
    return out;
  }
  // **px = เจตนาของผู้ใช้ ไม่ใช่ค่าที่โปรแกรมเดาเอง**
  //
  // เคยลองให้ระบบ "วัดขนาดจริงแล้วแปลงสัดส่วน→px ให้อัตโนมัติ" — พังหนัก: ค่าที่วัดได้มาจาก
  // เฟรมที่เลย์เอาต์ยังไม่นิ่ง แล้ว **ล็อกค่าผิดนั้นถาวร** (กระดาน Planner เหลือกว้าง 119px)
  // ซ้ำร้ายทุกคำสั่งที่ทำงานผ่าน "สัดส่วน" (คืนขนาดตอนเปิดแผง · สลับเวิร์กสเปซ) เงียบไปหมด
  // เพราะ px ทับทุกอย่างอยู่
  //
  // ตอนนี้: **px เกิดขึ้นเมื่อผู้ใช้ลากที่จับเท่านั้น** — แผงที่ผู้ใช้ตั้งใจกำหนดความกว้างเอง
  // จะกว้างเท่านั้นตลอดไป (ย่อ/ขยายหน้าต่างไม่กระทบ) ส่วนแผงที่ยังไม่เคยลาก ใช้สัดส่วนเหมือนเดิม
  // · ไม่มีขั้นตอน migrate · ไม่มีค่าที่เดาผิดแล้วค้าง · "รีเซ็ตการจัดวางแผง" ล้าง px ให้เองในตัว
  // [alpha.66r9] อ่านแบบ "มองทะลุคอนเทนเนอร์" — กลุ่มแท็บ/ช่องแบ่งที่ยังไม่มีขนาดของตัวเอง
  // แต่ข้างในมีแผงที่ถูกตรึงไว้ ต้องนับว่าถูกตรึงด้วย (ดูคำอธิบายเต็มที่ `nodePxDeep`)
  const pxKids = soft.filter((i) => i !== fi);
  const anyPinned = pxKids.some((i) => nodePxDeep(kids[i], row) > 0);
  if (!anyPinned) {                       // ยังไม่มีใครถูกตรึงความกว้าง → สัดส่วนล้วนเหมือนเดิมเป๊ะ
    for (const i of soft) out[i] = { kind: 'grow', grow: ratioOf(i) };
    return out;
  }
  for (const i of soft) {
    if (i === fi) { out[i] = { kind: 'flex' }; continue; }
    const px = nodePxDeep(kids[i], row);
    out[i] = px > 0 ? { kind: 'px', px } : { kind: 'grow', grow: ratioOf(i) };
  }
  return out;
}

/** id ของ panel ที่ "เห็นอยู่จริง" (ไม่รวมที่ถูกซ่อน) */
export function visiblePanelIds(root) {
  const ids = [];
  walk(root, (n) => { if (n.type === 'panel' && !n.hidden) ids.push(n.id); });
  return ids;
}

// ───────── ถอด panel ออกจากต้นไม้ (ไปทำเป็นแผงลอย) ─────────
// คืน { root, detached } — detached = โหนด panel ตัวเดิม (หรือ null ถ้าไม่เจอ)
export function detachPanel(root, id) {
  const p = findPanel(root, id);
  if (!p) return { root: clone(root), detached: null };
  // [alpha.62 บั๊ก 21] ย้ายที่/ทำเป็นแผงลอย = ผู้ใช้ตั้งใจ "เอามาวางตรงนี้" → ต้องเห็นเสมอ
  // (ถ้าพาธง hidden ติดไปด้วย จะได้แผงที่ลากไปวางแล้วมองไม่เห็น)
  const detached = { ...p, collapsed: false };
  delete detached.hidden;
  return { root: removePanel(root, id), detached };
}

// ───────── remove + ยุบโหนดว่าง ─────────
// คืน null ถ้า root เองคือ panel ที่ถูกปิด (= ไม่เหลืออะไรในต้นไม้) — ผู้เรียกต้องรับ null ได้
export function removePanel(root, id) {
  if (!root) return null;
  if (root.type === 'panel') return root.id === id ? null : clone(root);
  root = clone(root);
  const prune = (node) => {
    if (!node.children) return node;
    // บั๊ก #16b: เดิมสั่ง evenSizes() ให้ "ทุก dock" ในต้นไม้ → ปิดแผงในชั้นใน แล้วสัดส่วนของ
    // dock ชั้นนอกที่ไม่เกี่ยวกันก็โดนล้างไปด้วย ตอนนี้แก้เฉพาะ dock ที่จำนวนลูกเปลี่ยนจริง
    const before = node.children;
    const kids = [], keep = [];
    for (let i = 0; i < before.length; i++) {
      const c = before[i];
      if (c.type === 'panel' && c.id === id) continue;
      const pc = prune(c);
      if (pc.children && pc.children.length === 0) continue;   // ยุบ container ที่ว่าง
      kids.push(pc); keep.push(i);
    }
    node.children = kids;
    if (node.type === 'tabs') {
      if (node.active >= node.children.length) node.active = Math.max(0, node.children.length - 1);
    }
    if (node.type === 'dock') {
      node.sizes = kids.length === before.length && node.sizes && node.sizes.length === kids.length
        ? node.sizes                       // ลูกครบเท่าเดิม → สัดส่วนเดิมยังใช้ได้
        : keepSizes(node.sizes, keep);     // มีลูกหาย → แบ่งส่วนของตัวที่หายให้ตัวที่เหลือตามอัตราเดิม
    }
    return node;
  };
  root = prune(root);
  return collapse(root);
}
// ยุบ dock/tabs ที่เหลือลูกเดียว → เอาลูกนั้นขึ้นมาแทน
//
// [alpha.66r10 บั๊ก 1+3] **ตัวที่รอดต้องยึดขนาดของก้อนที่ยุบ**
// ก้อนที่ยุบ (กลุ่มแท็บ/ช่องแบ่ง) คือโหนดที่ถือ pxW/pxH ในสายตาของ dock แม่ — พอมันหายไป
// ขนาดนั้นก็หายไปด้วย แล้วเกิดสองอาการที่ผู้ใช้เจอ:
//   · ตัวที่รอดมี px ของตัวเอง (ค่าเก่าที่ค้างจากตอนยังไม่เข้ากลุ่ม) → ความกว้างเด้งไปค่านั้น
//   · ตัวที่รอด **ไม่มี px เลย** → ทั้งช่องกลายเป็น `grow` = ความกว้างกระโดดตามสัดส่วน
//     และไปแย่งพื้นที่กับแผงอื่นในแถวเดียวกันที่ผู้ใช้ตั้งขนาดไว้แล้ว
// กฎที่ผู้ใช้กำหนด: "แผงที่ไม่โดน undock ขนาดต้องอิงจากกลุ่ม" → คัดลอกลงตัวที่รอดเสมอ
function collapse(node) {
  if (!node.children) return node;
  node.children = node.children.map(collapse);
  if ((node.type === 'dock' || node.type === 'tabs') && node.children.length === 1) {
    const only = node.children[0];
    const w = nodePx(node, true), h = nodePx(node, false);
    if (w > 0) only.pxW = w;
    if (h > 0) only.pxH = h;
    return only;
  }
  return node;
}
function rootFirstPanelId(root) {
  let id = null; walk(root, (n) => { if (id === null && n.type === 'panel') id = n.id; });
  return id;
}

// ───────── ปรับ ratio ของ dock (ลาก handle) ─────────
// ที่จับอยู่ระหว่างลูก index กับ index+1 → แบ่งเฉพาะผลรวมของสองตัวนี้ (pair) ใหม่ตาม ratio
// ลูกตัวอื่นในแถวเดียวกันไม่ถูกแตะ และผลรวมทั้ง dock ยังเท่าเดิม (ถูกแล้ว — อย่าเปลี่ยนเป็น normalize ทั้งแถว)
export function resizeDock(root, dockId, index, ratio) {
  return resizeDockPair(root, dockId, index, index + 1, ratio);
}
/**
 * [alpha.62 บั๊ก 21] เวอร์ชันที่ระบุ "คู่" ได้เอง
 * แผงที่ถูกซ่อนยังอยู่ในต้นไม้ → ลูกที่อยู่ติดกัน**บนจอ**อาจไม่ใช่ index กับ index+1
 * (มีตัวที่ซ่อนคั่นอยู่) · ตัววาดจึงส่งดัชนีจริงของทั้งสองฝั่งมาให้
 */
export function resizeDockPair(root, dockId, i, j, ratio) {
  root = clone(root);
  let d = null; walk(root, (n) => { if (n.id === dockId && n.type === 'dock') d = n; });
  if (!d || !d.sizes) return root;
  const n = d.sizes.length;
  if (i < 0 || j < 0 || i >= n || j >= n || i === j) return root;
  const pair = d.sizes[i] + d.sizes[j];
  ratio = Math.max(0.05, Math.min(0.95, ratio));
  d.sizes[i] = +(pair * ratio).toFixed(4);
  d.sizes[j] = +(pair * (1 - ratio)).toFixed(4);
  return root;
}

// ───────── floating ─────────
export function makeFloat(p, x = 80, y = 80, w = 360, h = 260) {
  return { id: nid('f'), panel: panelize(p), x, y, w, h };
}

// รายชื่อ panel id ทั้งหมดในต้นไม้ (ไว้ตรวจ/เทส)
export function panelIds(root) {
  const ids = []; walk(root, (n) => { if (n.type === 'panel') ids.push(n.id); }); return ids;
}
export function hasPanel(root, id) { return !!(root && findPanel(root, id)); }
// หากลุ่มแท็บที่ panel นี้อยู่ (null ถ้าเป็น panel เดี่ยว) — UI ใช้วาดหัวแท็บ
export function tabGroupOf(root, panelId) {
  let grp = null;
  walk(root, (n) => { if (n.type === 'tabs' && n.children.some((c) => c.id === panelId)) grp = n; });
  return grp;
}

// ปุ่มมาตรฐานบนหัวแผง — UI (panel-ui.js) เอาไปวาด ตรรกะอยู่ที่ PanelManager
export const PANEL_BUTTONS = [
  // [alpha.66r3] เมนูแผง (☰) — Progressive Disclosure: คำสั่งลึก ๆ ของแผงอยู่หลังปุ่มนี้
  // เดิมมีแต่คลิกขวาบนหัวแผง ซึ่งไม่มีอะไรบอกว่ามีอยู่
  { key: 'menu',     icon: '☰', title: t('ui.panelLayout.panel'),   action: 'panelMenu' },
  { key: 'collapse', icon: '▾', title: t('ui.panelLayout.collapseExpand'), action: 'collapsePanel' },
  { key: 'float',    icon: '⧉', title: t('ui.panelLayout.float'), action: 'toggleFloat' },
  { key: 'close',    icon: '✕', title: t('ui.panelLayout.closePanel'),   action: 'hidePanel' },
];

function clone(o) { return JSON.parse(JSON.stringify(o)); }
