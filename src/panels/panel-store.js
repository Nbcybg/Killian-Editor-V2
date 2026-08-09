// panel-store.js — บันทึก/โหลด layout ของ panel + จัดการเวอร์ชัน schema + state (ข้อ 8)
// รับ storage adapter เข้ามา (default = localStorage) → ทดสอบด้วย mock ได้โดยไม่ต้องมี browser
// + PanelManager = API ระดับสูงที่ UI เรียก (registerPanel/showPanel/dockPanel/floatPanel/groupPanels)
// spec: docs/08-panel-system.md
import * as PL from './panel-layout.js';

// [alpha.60r2 ข้อ 8] v2 = เพิ่ม `splitRatios` (id ของแผง → สัดส่วนใน dock แม่)
// เดิมสัดส่วนอยู่ใน `sizes` ของต้นไม้เท่านั้น → แผงที่ถูกปิด/ย้ายแล้วเรียกกลับ ได้สัดส่วนเฉลี่ยใหม่ทุกครั้ง
export const LAYOUT_VERSION = 2;
const KEY = 'k2-panel-layout';

// storage เริ่มต้น: ใช้ localStorage ถ้ามี, ไม่งั้น in-memory (เช่นตอนรัน node test)
function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
}

// ── serialize / deserialize (+ migration) ──
/** สัดส่วนที่ใช้ได้จริง — 0<r<1 เท่านั้น (กันค่าเพี้ยนจากไฟล์ที่ถูกแก้มือ) */
function cleanRatios(o) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const k of Object.keys(o)) {
    const r = Number(o[k]);
    if (Number.isFinite(r) && r > 0.02 && r < 0.98) out[k] = +r.toFixed(4);
  }
  return out;
}
export function serializeLayout(state) {
  return JSON.stringify({
    version: LAYOUT_VERSION,
    root: state.root ?? null,
    floats: state.floats ?? [],
    splitRatios: cleanRatios(state.splitRatios),
  });
}
export function deserializeLayout(str) {
  if (!str) return null;
  let data;
  try { data = JSON.parse(str); } catch { return null; }
  data = migrate(data);
  if (!data || data.version !== LAYOUT_VERSION) return null;
  // [alpha.60r2 ข้อ 8] เลย์เอาต์ที่โครงพังต้อง "ตกกลับไปค่าตั้งต้น" ไม่ใช่พาทั้งโปรแกรมล่ม
  if (!validRoot(data.root)) return null;
  return {
    root: data.root ?? null,
    floats: Array.isArray(data.floats) ? data.floats.filter((f) => f && f.panel && f.panel.id) : [],
    splitRatios: cleanRatios(data.splitRatios),
  };
}
/** โครงต้นไม้ใช้ได้ไหม (null = ยังไม่มีเลย์เอาต์ ก็ถือว่าใช้ได้) */
function validRoot(n) {
  if (n == null) return true;
  if (typeof n !== 'object') return false;
  if (n.type === 'panel') return typeof n.id === 'string' && !!n.id;
  if (n.type === 'dock' || n.type === 'tabs') {
    if (!Array.isArray(n.children) || !n.children.length) return false;
    return n.children.every(validRoot);
  }
  return false;
}
// อัปเกรด schema เก่า → ปัจจุบัน (เพิ่ม case เมื่อ bump LAYOUT_VERSION)
function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.version == null) {           // v0: เก็บ root เปล่า ๆ ไม่มี floats
    data = { version: 1, root: data.root ?? data, floats: [] };
  }
  // v1 → v2: ยังไม่มีตารางสัดส่วน — เริ่มจากว่าง แล้วให้ UI จดใหม่ตอนวาดรอบแรก
  if (data.version === 1) { data = { ...data, version: 2, splitRatios: data.splitRatios || {} }; }
  return data;
}

// ── state management ──
export class PanelStore {
  constructor(storage = defaultStorage(), key = KEY) {
    this.storage = storage; this.key = key;
    this.root = null; this.floats = [];
    this.splitRatios = {};                       // [ข้อ 8] id ของแผง → สัดส่วนใน dock แม่
    this.listeners = new Set();
  }
  load() {
    const parsed = deserializeLayout(this.storage.getItem(this.key));
    if (parsed) { this.root = parsed.root; this.floats = parsed.floats; this.splitRatios = parsed.splitRatios || {}; }
    return !!parsed;
  }
  save() {
    this.storage.setItem(this.key, serializeLayout(
      { root: this.root, floats: this.floats, splitRatios: this.splitRatios }));
  }
  reset() {
    this.root = null; this.floats = []; this.splitRatios = {};
    this.storage.removeItem(this.key); this._emit();
  }
  /** จำสัดส่วนของแผงหนึ่งตัว — คืน true เมื่อค่าเปลี่ยนจริง (จะได้ไม่ save ซ้ำทุกเฟรม) */
  setSplitRatio(id, ratio) {
    const r = Number(ratio);
    if (!id || !Number.isFinite(r) || r <= 0.02 || r >= 0.98) return false;
    const v = +r.toFixed(4);
    if (this.splitRatios[id] === v) return false;
    this.splitRatios[id] = v;
    return true;
  }
  getSplitRatio(id) { return this.splitRatios[id] || 0; }
  // อัปเดต layout (ผ่านฟังก์ชันจาก panel-layout) แล้วบันทึก + แจ้ง listener อัตโนมัติ
  update(nextRoot) { this.root = nextRoot; this.save(); this._emit(); }
  setFloats(floats) { this.floats = floats; this.save(); this._emit(); }
  /** บันทึกอย่างเดียว ไม่แจ้ง listener → ไม่ re-render
   *  ใช้กับการสลับลำดับ z เท่านั้น: re-render กลาง mousedown จะทำให้ DOM ที่กำลังลากหลุด */
  setFloatsQuiet(floats) { this.floats = floats; this.save(); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this.root, this.floats); }
}

// ────────────────────────────────────────────────────────────────
// PanelManager — API ที่ UI เรียกจริง (ทะเบียนแผง + ทุกคำสั่ง + บันทึกอัตโนมัติ)
//
//   const pm = new PanelManager();
//   pm.registerPanel('outline', { title:'โครงเรื่อง', render: (host)=>{…} });
//   pm.load();                    // กู้เลย์เอาต์ครั้งก่อน (ต้อง register ให้ครบก่อน)
//   pm.showPanel('outline');
//
// ทะเบียน (registry) ไม่ถูกบันทึก — มี render ซึ่ง serialize ไม่ได้
// เลย์เอาต์ที่บันทึกเก็บแค่ id + โครงต้นไม้ แล้วสวมทับทะเบียนตอนเปิดโปรแกรม
// ────────────────────────────────────────────────────────────────
export class PanelManager {
  constructor({ storage, key, store } = {}) {
    this.store = store || new PanelStore(storage, key);
    this.registry = new Map();
  }
  get root() { return this.store.root; }
  get floats() { return this.store.floats; }
  get splitRatios() { return this.store.splitRatios; }
  layout() { return { root: this.store.root, floats: this.store.floats, splitRatios: this.store.splitRatios }; }
  /** [ข้อ 8] จำสัดส่วนที่ผู้ใช้ลากไว้ — บันทึกลง storage เมื่อค่าเปลี่ยนจริงเท่านั้น */
  rememberRatio(id, ratio) {
    if (!this.store.setSplitRatio(id, ratio)) return false;
    this.store.save();
    return true;
  }
  savedRatio(id) { return this.store.getSplitRatio(id); }

  // ---- registry ----
  /** Register a panel definition. Must be called before load() so unknown ids can be pruned. */
  registerPanel(id, opts = {}) {
    const def = {
      id,
      title: opts.title || id,
      icon: opts.icon || '',
      render: opts.render || null,
      closable: opts.closable !== false,
      floatable: opts.floatable !== false,
      defaultSide: opts.defaultSide || 'left',
      defaultSize: opts.defaultSize || null,
    };
    this.registry.set(id, def);
    return def;
  }
  unregisterPanel(id) { this.hidePanel(id); return this.registry.delete(id); }
  getPanel(id) { return this.registry.get(id) || null; }
  registered() { return [...this.registry.keys()]; }

  // ---- สถานะ ----
  isDocked(id) { return !!(this.root && PL.hasPanel(this.root, id)); }
  isFloating(id) { return this.floats.some((f) => f.panel.id === id); }
  // [alpha.62 บั๊ก 21] "เปิดอยู่" = **เห็นอยู่จริง** — แผงที่ถูกปิดยังอยู่ในต้นไม้ (ธง hidden)
  // จึงต้องแยกจาก `isDocked` ที่แปลว่า "มีสล็อตในต้นไม้" เฉย ๆ
  isOpen(id) { return (this.isDocked(id) && !this.isHidden(id)) || this.isFloating(id); }
  openIds() {
    return [...(this.root ? PL.visiblePanelIds(this.root) : []), ...this.floats.map((f) => f.panel.id)];
  }
  _node(id) {
    const d = this.registry.get(id);
    return { type: 'panel', id, title: d ? d.title : id };
  }

  // ---- แสดง/ซ่อน ----
  /** Show a panel: docks it on first use, otherwise brings it to front (tab + un-collapse). */
  showPanel(id, opts = {}) {
    const def = this.registry.get(id);
    if (!def) return false;                        // ไม่ได้ลงทะเบียน = ไม่รู้จะวาดอะไร
    if (this.isFloating(id)) { this._toFront(id); return true; }
    if (this.isDocked(id)) {
      // [alpha.62 บั๊ก 21] มีสล็อตอยู่แล้ว (เห็นอยู่ หรือถูกปิดไว้) → **ถอดธงแล้วจบ**
      // ไม่ต้องเดาตำแหน่ง ไม่ต้อง dock ใหม่ ไม่ต้องคืนสัดส่วน — ทุกอย่างอยู่ครบในต้นไม้อยู่แล้ว
      let next = PL.setPanelHidden(this.root, id, false);
      next = PL.collapsePanel(PL.activatePanel(next, id), id, false);
      this.store.update(next);
      return true;
    }
    if (!this.root) { this.store.update(this._node(id)); return true; }
    const side = opts.side || def.defaultSide || 'left';
    const target = this._target(opts.targetId);
    this.store.update(PL.dockPanel(this.root, target, side, this._node(id)));
    return true;
  }
  /** Close a panel (✕) — removes it from the tree and from floating windows. */
  /**
   * ปิดแผง
   *
   * [alpha.62 บั๊ก 21] **ติดธง `hidden` — ไม่ตัดโหนดออกจากต้นไม้**
   * ของเดิมเรียก `PL.removePanel()` ทำให้เสียทั้ง "สล็อต" และ "สัดส่วนของพี่น้อง"
   * (ดูคำอธิบายเต็มที่ `setPanelHidden` ใน panel-layout.js)
   * แผงลอยยังถอดออกจากรายการ floats เหมือนเดิม — มันไม่มีสล็อตในต้นไม้อยู่แล้ว
   */
  hidePanel(id) {
    // บั๊ก #19: แผงหลัก (docs) ปิดไม่ได้ — ถ้าหลุดออกจากต้นไม้ root จะกลายเป็น null
    // แล้วรอบเปิดโปรแกรมถัดไปจะรีเซ็ตเป็นเลย์เอาต์ตั้งต้น = "แผงทั้งชุดโผล่มาเอง"
    const def = this.registry.get(id);
    if (def && def.closable === false) return false;
    let changed = false;
    if (this.isFloating(id)) {
      this.store.setFloats(this.floats.filter((f) => f.panel.id !== id));
      changed = true;
    }
    if (this.isDocked(id) && !this.isHidden(id)) {
      this.store.update(PL.setPanelHidden(this.root, id, true));
      changed = true;
    }
    return changed;
  }
  /** ถูกปิดอยู่ไหม (ยังอยู่ในต้นไม้ แต่ไม่แสดง) */
  isHidden(id) { return !!(this.root && PL.isPanelHidden(this.root, id)); }
  togglePanel(id, opts) { return this.isOpen(id) ? this.hidePanel(id) : this.showPanel(id, opts); }

  // ---- ผนึก / ลอย ----
  /** Dock a panel to `side` of `targetId` (moves it if it is floating or docked elsewhere). */
  dockPanel(id, side = 'left', targetId) {
    let node = null;
    const fl = this.floats.find((f) => f.panel.id === id);
    if (fl) { node = fl.panel; this.store.setFloats(this.floats.filter((f) => f !== fl)); }
    if (!node && this.isDocked(id)) {
      const d = PL.detachPanel(this.root, id);     // ย้ายที่: ถอดออกก่อนแล้วค่อยผนึกใหม่
      node = d.detached;
      this.store.update(d.root);
    }
    if (!node) node = this._node(id);
    if (!this.root) { this.store.update({ type: 'panel', id: node.id, title: node.title }); return true; }
    this.store.update(PL.dockPanel(this.root, this._target(targetId), side, node));
    return true;
  }
  /** Pop a panel out into a floating window (⧉). */
  floatPanel(id, box = {}) {
    const def = this.registry.get(id);
    if (def && def.floatable === false) return false;
    if (this.isFloating(id)) { this._toFront(id); return true; }
    let node = this._node(id);
    if (this.isDocked(id)) {
      const d = PL.detachPanel(this.root, id);
      node = d.detached || node;
      this.store.update(d.root);
    }
    const f = PL.makeFloat(node, box.x ?? 80, box.y ?? 80, box.w ?? 360, box.h ?? 260);
    this.store.setFloats([...this.floats, f]);
    return true;
  }
  toggleFloat(id, box) { return this.isFloating(id) ? this.dockPanel(id, box && box.side) : this.floatPanel(id, box); }
  /** Move/resize a floating window (drag + resize handle). */
  moveFloat(id, box = {}) {
    const next = this.floats.map((f) => (f.panel.id === id ? { ...f, ...pick(box, ['x', 'y', 'w', 'h']) } : f));
    this.store.setFloats(next);
    return true;
  }
  _toFront(id) {                                   // ลำดับท้ายอาร์เรย์ = อยู่บนสุด (z-order)
    const list = this.floats;
    const f = list.find((x) => x.panel.id === id);
    if (!f || list[list.length - 1] === f) return;  // อยู่บนสุดแล้ว — อย่าเขียน store ซ้ำ
    // quiet: ตัวเรียก (renderFloatPanel) ย้าย DOM ให้อยู่บนสุดเองแล้ว
    // ถ้า _emit ตรงนี้ = re-render กลาง mousedown → ลากไม่ไป + ตำแหน่ง/ขนาดเพี้ยน
    this.store.setFloatsQuiet([...list.filter((x) => x !== f), f]);
  }

  // ---- แท็บ / กลุ่ม ----
  /** Merge panels into a single tab group, anchored at ids[0]. */
  groupPanels(ids) {
    if (!Array.isArray(ids) || ids.length < 2) return false;
    for (const id of ids) if (this.isFloating(id)) this.dockPanel(id, 'center', ids[0]);
    if (!this.root) return false;
    this.store.update(PL.groupPanels(this.root, ids.filter((id) => this.isDocked(id))));
    return true;
  }
  /** Pull a panel out of its tab group and dock it to `side` (null → float it). */
  ungroupPanel(id, side = 'right') {
    if (!this.isDocked(id)) return false;
    if (!side) return this.floatPanel(id);
    this.store.update(PL.splitTab(this.root, id, side).root);
    return true;
  }
  activatePanel(id) {
    if (!this.isDocked(id)) return false;
    this.store.update(PL.activatePanel(this.root, id));
    return true;
  }
  moveTab(tabsId, from, to) {
    if (!this.root) return false;
    this.store.update(PL.moveTab(this.root, tabsId, from, to));
    return true;
  }

  // ---- ย่อ / ปรับขนาด ----
  /** Collapse (▾) — pass `on` to force, omit to toggle. */
  collapsePanel(id, on) {
    if (this.isFloating(id)) {
      const next = this.floats.map((f) => (f.panel.id === id
        ? { ...f, panel: { ...f.panel, collapsed: on === undefined ? !f.panel.collapsed : !!on } } : f));
      this.store.setFloats(next);
      return true;
    }
    if (!this.isDocked(id)) return false;
    this.store.update(PL.collapsePanel(this.root, id, on));
    return true;
  }
  isCollapsed(id) {
    const f = this.floats.find((x) => x.panel.id === id);
    if (f) return !!f.panel.collapsed;
    return !!(this.root && PL.isCollapsed(this.root, id));
  }
  /** @param {number} [nextIndex] ดัชนีของลูกอีกฝั่ง (ตัววาดส่งมาเมื่อมีแผงที่ซ่อนคั่นอยู่) */
  resize(dockId, index, ratio, nextIndex) {
    if (!this.root) return false;
    const j = Number.isInteger(nextIndex) ? nextIndex : index + 1;
    this.store.update(PL.resizeDockPair(this.root, dockId, index, j, ratio));
    return true;
  }

  // ---- persist ----
  save() { this.store.save(); }
  /** Load the saved layout, dropping panels that are no longer registered. */
  load() {
    const ok = this.store.load();
    if (ok && this.registry.size) this._prune();
    return ok;
  }
  reset() { this.store.reset(); }
  onChange(fn) { return this.store.onChange(fn); }

  _prune() {                                       // เลย์เอาต์เก่าอาจอ้างแผงที่ถอดออกจากโปรแกรมแล้ว
    let r = this.store.root;
    if (r) for (const id of PL.panelIds(r)) if (!this.registry.has(id)) r = PL.removePanel(r, id);
    this.store.root = r;
    this.store.floats = this.store.floats.filter((f) => this.registry.has(f.panel.id));
    this.store.save();
    this.store._emit();                            // บั๊ก #19: เดิมเขียน root ตรง ๆ ไม่ผ่าน update()
  }                                                //   → onChange ไม่ยิง UI ค้างกับต้นไม้เก่า
  _target(id) {                                    // เป้าหมายการผนึก: ที่ระบุ → ไม่งั้น panel ตัวแรก
    if (id && PL.hasPanel(this.root, id)) return id;
    return PL.panelIds(this.root)[0];
  }
}

function pick(o, keys) {
  const out = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}
