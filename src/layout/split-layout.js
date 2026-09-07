// split-layout.js — มุมมองแยกจอแบบซ้อนได้ (Split View, ข้อ 40)
// pure logic: recursive split tree + drag handle (resize+snap 50%) + store (localStorage/versioning)
// split-ui.js (opencode) เอาไปวาด · ทำงานร่วมกับ Panel System ผ่าน leaf.tabId (อ้างแท็บเดียวกัน)
//
// โหนด (recursive):
//   { type:'leaf',  id, tabs:[tabId,…], active, tabId }          — pane ที่มี "กลุ่มแท็บ" ของตัวเอง
//   { type:'split', id, dir:'row'|'col', children:[...], sizes:[...] } — แบ่ง row(ซ้าย-ขวา)/col(บน-ล่าง)
// spec: docs/40-split-view.md
//
// บั๊ก #12: เดิม leaf ถือแท็บเดียว (leaf.tabId) → แต่ละช่องเลือกแท็บของตัวเองไม่ได้
// ตอนนี้ leaf ถือ tabs[] + active (แถบแท็บย่อยต่อช่อง) โดย **คง `leaf.tabId` ไว้เป็นกระจกเงา**
// ของ `tabs[active]` เสมอ — โค้ด/เทสเดิมที่อ่าน leaf.tabId จึงยังใช้ได้ ไม่ต้องแก้ทั้งระบบ
// ทุกฟังก์ชันที่แตะ tabs ต้องเรียก syncLeaf() ปิดท้ายเสมอ

let _uid = 0;
const nid = (p = 's') => `${p}${Date.now().toString(36)}${(_uid++).toString(36)}`;

export function leaf(tabId, id = nid('l')) {
  return syncLeaf({ type: 'leaf', id, tabs: tabId == null ? [] : [tabId], active: 0 });
}
export function split(dir, children, sizes, id = nid('sp')) {
  return { type: 'split', id, dir, children, sizes: sizes || even(children.length) };
}
const even = (n) => Array.from({ length: n }, () => +(1 / n).toFixed(4));

/** ทำให้ tabs/active/tabId ของ leaf ตรงกันเสมอ (รับโครงเก่าที่มีแต่ tabId ได้ด้วย) */
function syncLeaf(l) {
  if (!Array.isArray(l.tabs)) l.tabs = (l.tabId == null ? [] : [l.tabId]);
  l.tabs = l.tabs.filter((x) => x != null);
  if (!Number.isInteger(l.active)) l.active = 0;
  l.active = l.tabs.length ? Math.max(0, Math.min(l.active, l.tabs.length - 1)) : 0;
  l.tabId = l.tabs.length ? l.tabs[l.active] : null;
  return l;
}
/** แท็บที่ pane นี้กำลังแสดง */
export function leafTab(l) { return l && l.tabs && l.tabs.length ? (l.tabs[l.active] ?? null) : null; }
/** อัปเกรดโครงเก่า (leaf.tabId เดี่ยว ๆ) ให้เป็นกลุ่มแท็บ — เรียกตอนโหลดจาก storage */
export function normalizeLeaves(root) {
  if (root) walk(root, (n) => { if (n.type === 'leaf') syncLeaf(n); });
  return root;
}

// ───────── ท่อง/ค้น ─────────
export function walk(node, fn, parent = null) { fn(node, parent); if (node.children) for (const c of node.children) walk(c, fn, node); }
export function leafIds(root) { const o = []; walk(root, (n) => { if (n.type === 'leaf') o.push(n.id); }); return o; }
/** แท็บที่ "กำลังแสดง" ในแต่ละ pane (1 ตัวต่อ pane) */
export function tabIds(root) { const o = []; walk(root, (n) => { if (n.type === 'leaf') o.push(leafTab(n)); }); return o; }
/** แท็บทั้งหมดในทุก pane รวมตัวที่ซ่อนอยู่หลังแถบแท็บย่อย */
export function allTabIds(root) {
  const o = []; walk(root, (n) => { if (n.type === 'leaf') o.push(...(n.tabs || [])); }); return o;
}
function locate(root, id) {
  let res = null;
  walk(root, (n) => { if (n.children) { const i = n.children.findIndex((c) => c.id === id); if (i >= 0) res = { parent: n, index: i }; } });
  return res;
}
export function findLeaf(root, leafId) {
  let f = null; walk(root, (n) => { if (n.type === 'leaf' && n.id === leafId) f = n; }); return f;
}
/** หา pane ที่ "มีแท็บนี้อยู่ในกลุ่ม" (ไม่จำเป็นต้องเป็นตัวที่แสดงอยู่) */
export function findLeafByTab(root, tabId) {
  let f = null;
  walk(root, (n) => { if (!f && n.type === 'leaf' && (n.tabs || []).includes(tabId)) f = n; });
  return f;
}
export function paneCount(root) { return root ? leafIds(root).length : 0; }
// ความลึกของการแบ่ง (root leaf = 0) — ไว้ตรวจว่า recursive split ทำงานจริง
export function splitDepth(node, d = 0) {
  if (!node || !node.children) return d;
  return Math.max(...node.children.map((c) => splitDepth(c, d + 1)));
}

// ───────── โซนปล่อยแท็บ (เหมือน snapZone ของ Panel System) ─────────
// คืน 'left'|'right'|'top'|'bottom'|'center'|null · center = ปล่อยกลาง = แทนที่แท็บใน pane นั้น
export function dropZone(px, py, rect, edge = 0.25) {
  const { x, y, w, h } = rect;
  if (px < x || px > x + w || py < y || py > y + h) return null;
  const rx = (px - x) / w, ry = (py - y) / h;
  const dl = rx, dr = 1 - rx, dt = ry, db = 1 - ry;
  const min = Math.min(dl, dr, dt, db);
  if (min > edge) return 'center';
  if (min === dl) return 'left';
  if (min === dr) return 'right';
  if (min === dt) return 'top';
  return 'bottom';
}

// ───────── split: ลากแท็บไปขอบ pane → แบ่ง (recursive) ─────────
// side: 'left'|'right'|'top'|'bottom' · left/right→row, top/bottom→col
// คืน root ใหม่ (ไม่กลายพันธุ์ของเดิม)
export function splitPane(root, targetLeafId, side, newTabId) {
  root = clone(root);
  const wantRow = side === 'left' || side === 'right';
  const before = side === 'left' || side === 'top';
  const nl = leaf(newTabId);
  const loc = locate(root, targetLeafId);
  const mk = (existing) => split(wantRow ? 'row' : 'col', before ? [nl, existing] : [existing, nl]);

  if (!loc) return mk(root);                        // target คือ root leaf
  const parent = loc.parent;
  if (parent.type === 'split' && parent.dir === (wantRow ? 'row' : 'col')) {
    const at = before ? loc.index : loc.index + 1;  // ทิศเดียวกัน → แทรกพี่น้อง (ไม่ซ้อน split เกิน)
    parent.children.splice(at, 0, nl);
    parent.sizes = even(parent.children.length);
  } else {
    parent.children[loc.index] = mk(parent.children[loc.index]);
  }
  return root;
}

// ───────── กลุ่มแท็บในแต่ละ pane (บั๊ก #12) ─────────
/** เอาแท็บมาแสดงใน pane นี้ — ยังไม่มีในกลุ่มก็เพิ่มให้ แล้วตั้งเป็นตัวที่แสดง */
export function setLeafTab(root, leafId, tabId) {
  return addLeafTab(root, leafId, tabId, true);
}
/** เพิ่มแท็บเข้ากลุ่มของ pane (activate=false = เพิ่มไว้เฉย ๆ ไม่สลับไปแสดง) */
export function addLeafTab(root, leafId, tabId, activate = true) {
  root = clone(root);
  const l = findLeaf(root, leafId);
  if (!l || tabId == null) return root;
  let i = l.tabs.indexOf(tabId);
  if (i < 0) { l.tabs.push(tabId); i = l.tabs.length - 1; }
  if (activate) l.active = i;
  return syncLeaf(l), root;
}
/** สลับไปแสดงแท็บอื่นใน pane เดียวกัน — ไม่กระทบ pane อื่นเลย (หัวใจของบั๊ก #12) */
export function activateLeafTab(root, leafId, tabId) {
  root = clone(root);
  const l = findLeaf(root, leafId);
  if (!l) return root;
  const i = l.tabs.indexOf(tabId);
  if (i >= 0) l.active = i;
  return syncLeaf(l), root;
}
/** เอาแท็บออกจากกลุ่มของ pane เดียว (pane ว่างแล้วจะยุบทิ้งถ้ายังมี pane อื่นเหลือ) */
export function removeLeafTab(root, leafId, tabId) {
  root = clone(root);
  const l = findLeaf(root, leafId);
  if (!l) return root;
  const i = l.tabs.indexOf(tabId);
  if (i < 0) return root;
  l.tabs.splice(i, 1);
  if (l.active >= i) l.active = Math.max(0, l.active - 1);
  syncLeaf(l);
  if (!l.tabs.length && leafIds(root).length > 1) return removeLeaf(root, l.id);
  return root;
}
/** แท็บทั้งหมดของ pane หนึ่ง (ตามลำดับในแถบแท็บย่อย) */
export function leafTabs(root, leafId) {
  const l = root && findLeaf(root, leafId);
  return l ? [...l.tabs] : [];
}

// ───────── ลากแท็บที่เปิดอยู่แล้วไปอีก pane ─────────
// ต่างจาก splitPane ตรงที่ถอด pane เดิมของแท็บออกก่อน — กัน tabId เดียวโผล่สอง pane
// side='center' → แทนที่แท็บใน pane ปลายทาง
export function moveTabToPane(root, tabId, targetLeafId, side = 'right') {
  const src = findLeafByTab(root, tabId);
  if (src && src.id === targetLeafId && side !== 'center') return clone(root);  // ลากกลับที่เดิม
  let out = clone(root);
  if (src) {
    // เอาออกจากกลุ่มของ pane ต้นทางเท่านั้น — แท็บอื่นใน pane เดียวกันต้องไม่หายไปด้วย (บั๊ก #12)
    out = removeLeafTab(out, src.id, tabId);
    if (!out) return leaf(tabId);                       // ถอดแล้วไม่เหลืออะไร → เป็น pane เดียว
    if (!findLeaf(out, targetLeafId)) return out;       // pane ปลายทางยุบหายไปพร้อมกัน
  }
  return side === 'center' ? setLeafTab(out, targetLeafId, tabId)
                           : splitPane(out, targetLeafId, side, tabId);
}

// ───────── drag handle: ปรับ ratio + snap 50% ─────────
// snapPx/totalPx ใช้คำนวณ threshold snap (ถ้าใกล้กึ่งกลางในระยะ snap → 0.5); ถ้าไม่ส่งใช้ ±0.03
export function resizeSplit(root, splitId, index, ratio, snapTol = 0.03) {
  root = clone(root);
  let sp = null; walk(root, (n) => { if (n.id === splitId && n.type === 'split') sp = n; });
  if (!sp || index < 0 || index >= sp.sizes.length - 1) return root;
  const pair = sp.sizes[index] + sp.sizes[index + 1];
  let r = Math.max(0.05, Math.min(0.95, ratio));
  if (Math.abs(r - 0.5) <= snapTol) r = 0.5;        // snap to 50%
  sp.sizes[index] = +(pair * r).toFixed(4);
  sp.sizes[index + 1] = +(pair * (1 - r)).toFixed(4);
  return root;
}

// ───────── remove leaf + ยุบ split ที่เหลือลูกเดียว ─────────
// คืน null ถ้า root เองคือ pane ที่ถูกปิด (ไม่เหลือ pane เลย) — ผู้เรียกต้องรับ null ได้
export function removeLeaf(root, leafId) {
  if (!root) return null;
  if (root.type === 'leaf') return root.id === leafId ? null : clone(root);
  root = clone(root);
  const prune = (n) => {
    if (!n.children) return n;
    n.children = n.children.filter((c) => !(c.type === 'leaf' && c.id === leafId)).map(prune)
      .filter((c) => !(c.children && c.children.length === 0));
    if (n.type === 'split') n.sizes = even(n.children.length);
    return n;
  };
  return collapse(prune(root));
}
// ปิดแท็บ — เอาออกจากกลุ่มของทุก pane · pane ที่ว่างเพราะการนี้จึงยุบทิ้ง
// (แท็บอื่นใน pane เดียวกันยังอยู่ → pane ไม่หาย แค่สลับไปแสดงตัวถัดไป — บั๊ก #12)
export function closeTab(root, tabId) {
  if (!root) return null;
  const out = clone(root);
  const emptied = [];
  walk(out, (n) => {
    if (n.type !== 'leaf') return;
    const i = n.tabs.indexOf(tabId);
    if (i < 0) return;
    n.tabs.splice(i, 1);
    if (n.active >= i) n.active = Math.max(0, n.active - 1);
    syncLeaf(n);
    if (!n.tabs.length) emptied.push(n.id);
  });
  return dropEmpty(out, emptied);
}
// ตัดแท็บที่ถูกปิดไปแล้วออกจากทุก pane (ซิงก์กับ Panel System / แท็บเอกสาร)
export function pruneTabs(root, validTabIds) {
  if (!root) return null;
  const ok = new Set(validTabIds);
  const out = clone(root);
  const emptied = [];
  walk(out, (n) => {
    if (n.type !== 'leaf' || !n.tabs.length) return;
    const keep = n.tabs.filter((tid) => ok.has(tid));
    if (keep.length === n.tabs.length) return;
    const wasActive = leafTab(n);
    n.tabs = keep;
    n.active = Math.max(0, keep.indexOf(wasActive));
    syncLeaf(n);
    if (!n.tabs.length) emptied.push(n.id);
  });
  return dropEmpty(out, emptied, ok.has(null));
}
/** ยุบ pane ที่เพิ่งกลายเป็นว่าง — เหลือ pane เดียวก็ปล่อยว่างไว้ (หรือคืน null ถ้าห้ามว่าง) */
function dropEmpty(out, emptied, allowEmpty = false) {
  let r = out;
  for (const id of emptied) {
    if (leafIds(r).length <= 1) break;
    r = removeLeaf(r, id);
    if (!r) return null;
  }
  if (r.type === 'leaf' && !r.tabs.length && !allowEmpty) return null;
  return r;
}
function leavesOf(root) {
  const o = []; walk(root, (n) => { if (n.type === 'leaf') o.push(n); }); return o;
}
function collapse(n) {
  if (!n.children) return n;
  n.children = n.children.map(collapse);
  if (n.type === 'split' && n.children.length === 1) return n.children[0];
  return n;
}

// ───────── Layout Store (serialize + version + localStorage) ─────────
export const SPLIT_VERSION = 1;
const KEY = 'k2-split-layout';
function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
}
export function serializeSplit(root) { return JSON.stringify({ version: SPLIT_VERSION, root: root ?? null }); }
export function deserializeSplit(str) {
  if (!str) return null;
  let d; try { d = JSON.parse(str); } catch { return null; }
  d = migrate(d);
  if (!d || d.version !== SPLIT_VERSION) return null;
  // เลย์เอาต์ที่บันทึกก่อนบั๊ก #12 มีแต่ leaf.tabId → ยกเป็นกลุ่มแท็บให้ก่อนใช้งาน
  return normalizeLeaves(d.root ?? null);
}
function migrate(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.version == null) d = { version: 1, root: d.root ?? d };
  return d;
}
export class SplitStore {
  constructor(storage = defaultStorage(), key = KEY) { this.storage = storage; this.key = key; this.root = null; this.listeners = new Set(); }
  load() { const r = deserializeSplit(this.storage.getItem(this.key)); if (r) this.root = r; return !!r; }
  save() { this.storage.setItem(this.key, serializeSplit(this.root)); }
  reset() { this.root = null; this.storage.removeItem(this.key); this._emit(); }
  update(next) { this.root = next; this.save(); this._emit(); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this.root); }
}

// ────────────────────────────────────────────────────────────────
// SplitManager — API ที่ UI เรียกจริง (จำ pane ที่โฟกัส + บันทึกอัตโนมัติ)
//   const sm = new SplitManager();
//   sm.open('scene-1');                       // pane แรก
//   sm.splitWith('scene-2', 'right');         // ลากแท็บไปขอบขวา → แบ่งจอ
// ────────────────────────────────────────────────────────────────
export class SplitManager {
  constructor({ storage, key, store } = {}) {
    this.store = store || new SplitStore(storage, key);
    this.focusId = null;                       // leaf id ที่กำลังโฟกัส
  }
  get root() { return this.store.root; }
  tabs() { return this.root ? tabIds(this.root) : []; }
  paneCount() { return paneCount(this.root); }
  has(tabId) { return !!(this.root && findLeafByTab(this.root, tabId)); }

  /** Open a tab in the focused pane (creates the first pane when empty). */
  open(tabId) {
    if (!this.root) { this._set(leaf(tabId)); this.focusId = this.root.id; return true; }
    const cur = findLeafByTab(this.root, tabId);
    if (cur) { this.focusId = cur.id; return true; }        // เปิดอยู่แล้ว → แค่ย้ายโฟกัส
    const target = this._focusLeaf();
    this._set(setLeafTab(this.root, target.id, tabId));
    this.focusId = target.id;
    return true;
  }
  /** Drag a tab to a pane edge → split (targetLeafId omitted = focused pane). */
  splitWith(tabId, side = 'right', targetLeafId) {
    if (!this.root) return this.open(tabId);
    const target = (targetLeafId && findLeaf(this.root, targetLeafId)) || this._focusLeaf();
    this._set(this.has(tabId) ? moveTabToPane(this.root, tabId, target.id, side)
                              : splitPane(this.root, target.id, side, tabId));
    const nl = findLeafByTab(this.root, tabId);
    if (nl) this.focusId = nl.id;
    return true;
  }
  /** Move an already-open tab into another pane (side='center' replaces it). */
  moveTab(tabId, targetLeafId, side = 'right') {
    if (!this.root) return false;
    this._set(moveTabToPane(this.root, tabId, targetLeafId, side));
    const nl = this.root && findLeafByTab(this.root, tabId);
    this.focusId = nl ? nl.id : null;
    return true;
  }
  close(tabId) { this._set(closeTab(this.root, tabId)); return true; }
  closePane(leafId) { this._set(removeLeaf(this.root, leafId)); return true; }
  focus(leafId) {
    if (!this.root || !findLeaf(this.root, leafId)) return false;
    this.focusId = leafId; return true;
  }

  // ───── บั๊ก #12: กลุ่มแท็บต่อช่อง — ห่อฟังก์ชันโมดูลไว้ให้ UI เรียกผ่าน manager ─────
  /** id ของช่องที่โฟกัสอยู่ (null ถ้ายังไม่แยกจอ) */
  focusLeafId() { const l = this._focusLeaf(); return l ? l.id : null; }
  /** เพิ่มแท็บเข้าช่อง — ไม่ระบุช่อง = ช่องที่โฟกัสอยู่ */
  addTab(tabId, leafId) {
    const id = leafId || this.focusLeafId();
    if (!id || !this.root) return false;
    this._set(addLeafTab(this.root, id, tabId));
    return true;
  }
  /** สลับแท็บที่แสดงในช่องนั้น โดยไม่ไปยุ่งกับช่องอื่น */
  activateInLeaf(leafId, tabId) {
    if (!this.root || !findLeaf(this.root, leafId)) return false;
    this._set(activateLeafTab(this.root, leafId, tabId));
    this.focusId = leafId;
    return true;
  }
  /** เอาแท็บออกจากช่องนี้ (สำเนาในช่องอื่นยังอยู่) */
  closeInLeaf(leafId, tabId) {
    if (!this.root || !findLeaf(this.root, leafId)) return false;
    this._set(removeLeafTab(this.root, leafId, tabId));
    return true;
  }
  activeTabId() { const l = this._focusLeaf(); return l ? l.tabId : null; }
  resize(splitId, index, ratio, snapTol) {
    if (!this.root) return false;
    this._set(resizeSplit(this.root, splitId, index, ratio, snapTol));
    return true;
  }
  /** Drop panes whose tab no longer exists — pass a PanelManager or a list of ids. */
  syncWithPanels(src) {
    const ids = src && typeof src.openIds === 'function' ? src.openIds() : (src || []);
    this._set(pruneTabs(this.root, ids));
    return true;
  }
  load() { const ok = this.store.load(); this._fixFocus(); return ok; }
  save() { this.store.save(); }
  reset() { this.store.reset(); this.focusId = null; }
  onChange(fn) { return this.store.onChange(fn); }

  _set(next) { this.store.update(next || null); this._fixFocus(); }
  _focusLeaf() {
    if (!this.root) return null;
    return (this.focusId && findLeaf(this.root, this.focusId)) || leavesOf(this.root)[0] || null;
  }
  _fixFocus() {                                 // pane ที่โฟกัสอาจถูกยุบไปพร้อมการแก้โครง
    const l = this._focusLeaf();
    this.focusId = l ? l.id : null;
  }
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }
