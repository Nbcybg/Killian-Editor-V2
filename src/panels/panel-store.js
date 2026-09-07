// panel-store.js — บันทึก/โหลด layout ของ panel + จัดการเวอร์ชัน schema + state (ข้อ 8)
// รับ storage adapter เข้ามา (default = localStorage) → ทดสอบด้วย mock ได้โดยไม่ต้องมี browser
// + PanelManager = API ระดับสูงที่ UI เรียก (registerPanel/showPanel/dockPanel/floatPanel/groupPanels)
// spec: docs/08-panel-system.md
import * as PL from './panel-layout.js';

// [alpha.60r2 ข้อ 8] v2 = เพิ่ม `splitRatios` (id ของแผง → สัดส่วนใน dock แม่)
// เดิมสัดส่วนอยู่ใน `sizes` ของต้นไม้เท่านั้น → แผงที่ถูกปิด/ย้ายแล้วเรียกกลับ ได้สัดส่วนเฉลี่ยใหม่ทุกครั้ง
export const LAYOUT_VERSION = 2;
const KEY = 'k2-panel-layout';
const WS_KEY = 'k2-panel-workspaces';        // [alpha.66r3] พรีเซ็ตเวิร์กสเปซที่ผู้ใช้บันทึกเอง

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
    // [alpha.67] อ่านได้ เขียนไม่ได้ — ใช้ในหน้าต่างแผงที่ฉีกออกมา (tear-off)
    // ทุกหน้าต่างของโปรแกรมใช้ origin `file://` เดียวกัน = localStorage ก้อนเดียวกัน
    // ถ้าลูกเขียนได้ เลย์เอาต์ของหน้าต่างหลักจะถูกทับด้วย "เลย์เอาต์แผงเดียว" ทันทีที่เปิดลูก
    this.readOnly = false;
  }
  load() {
    const parsed = deserializeLayout(this.storage.getItem(this.key));
    if (parsed) { this.root = parsed.root; this.floats = parsed.floats; this.splitRatios = parsed.splitRatios || {}; }
    return !!parsed;
  }
  save() {
    if (this.readOnly) return false;
    this.storage.setItem(this.key, serializeLayout(
      { root: this.root, floats: this.floats, splitRatios: this.splitRatios }));
    return true;
  }
  reset() {
    this.root = null; this.floats = []; this.splitRatios = {};
    if (!this.readOnly) this.storage.removeItem(this.key);
    this._emit();
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

  // ───────── [alpha.66r3] Workspace presets ─────────
  // สเปก: "Workspace ไม่ใช่แค่การเซฟ Layout แต่คือ Snapshot ของสถานะ UI ทั้งหมด"
  // ก้อนที่เก็บครอบคลุมครบตามรายการในสเปก:
  //   ตำแหน่ง+ขนาดของแต่ละแผง (sizes ในต้นไม้ + กล่องของแผงลอย) · dock/undock (root vs floats) ·
  //   ย่อ/ขยาย (collapsed) · แผงไหนอยู่กลุ่มไหน + ลำดับในกลุ่ม (โหนด tabs) · เปิด/ปิด (ธง hidden)
  //   + `homes` = ที่กลับของแผงที่ปิดไว้ (UI ส่งเข้ามา — อยู่นอกต้นไม้)
  workspaces() {
    try { return JSON.parse(this.storage.getItem(WS_KEY) || '{}') || {}; } catch { return {}; }
  }
  listWorkspaces() { return Object.keys(this.workspaces()); }
  getWorkspace(name) { return this.workspaces()[name] || null; }
  putWorkspace(name, extra = {}) {
    if (!name || this.readOnly) return false;
    const all = this.workspaces();
    all[name] = {
      version: LAYOUT_VERSION,
      root: this.root ?? null,
      floats: this.floats ?? [],
      splitRatios: cleanRatios(this.splitRatios),
      homes: extra.homes || null,
    };
    try { this.storage.setItem(WS_KEY, JSON.stringify(all)); } catch { return false; }
    return true;
  }
  removeWorkspace(name) {
    if (this.readOnly) return false;
    const all = this.workspaces();
    if (!(name in all)) return false;
    delete all[name];
    try { this.storage.setItem(WS_KEY, JSON.stringify(all)); } catch { return false; }
    return true;
  }
  /** สวมเลย์เอาต์จาก snapshot (พรีเซ็ตที่เก็บไว้ หรือชุดสำเร็จรูป) — คืน homes ให้ UI เอาไปใช้ต่อ */
  applySnapshot(snap) {
    if (!snap || !validRoot(snap.root)) return null;
    this.floats = Array.isArray(snap.floats) ? snap.floats.filter((f) => f && f.panel && f.panel.id) : [];
    this.splitRatios = cleanRatios(snap.splitRatios);
    this.update(snap.root);                       // update() save + emit ให้เอง
    return snap.homes || null;
  }
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
  /** [alpha.67] ห้ามหน้าต่างนี้เขียนเลย์เอาต์ลง storage (หน้าต่างแผงที่ฉีกออกมา) */
  setReadOnly(on = true) { this.store.readOnly = !!on; return this.store.readOnly; }
  isReadOnly() { return !!this.store.readOnly; }
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
      // [alpha.66r12] ขนาดอ้างอิงตอน "ลอย" — คนละชุดกับตอนผนึก (แผงข้างผนึกแล้วสูงเต็มคอลัมน์
      // แต่ตอนลอยต้องเป็นกล่องขนาดพอดีมือ) · UI ส่งมาจากทะเบียนแผงของตัวเอง
      floatSize: opts.floatSize || null,
    };
    this.registry.set(id, def);
    return def;
  }
  unregisterPanel(id) { this.hidePanel(id); return this.registry.delete(id); }
  getPanel(id) { return this.registry.get(id) || null; }
  registered() { return [...this.registry.keys()]; }

  // ---- สถานะ ----
  isDocked(id) { return !!(this.root && PL.hasPanel(this.root, id)); }
  isFloating(id) {
    return this.floats.some((f) => f.panel.id === id
      || (f.panel.type === 'tabs' && (f.panel.children || []).some((c) => c.id === id)));
  }
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
    // [alpha.66r10] อยู่ในกลุ่มลอย → ต้อง "สลับมาที่แท็บนั้น" ด้วย ไม่งั้นเรียกแผงแล้วยังไม่เห็น
    if (this.isFloating(id)) { this._activateFloatTab(id); this._toFront(id); return true; }
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
    // [alpha.66r6 กฎข้อ 2] ผนึกครั้งแรกก็ต้องมีขนาดของตัวเองทันทีเหมือนกัน
    this.store.update(PL.ensureDockPx(
      PL.dockPanel(this.root, target, side, this._node(id)), id, this._defSize(id)));
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
  /**
   * [alpha.65] ยามก่อนปิดแผง — แผงที่มีงานค้าง (เช่น Planner ที่ยังไม่บันทึก) จะถามผู้ใช้ก่อน
   * guard(proceed) คืน false = ยังไม่ปิด แล้วค่อยเรียก proceed() เองเมื่อผู้ใช้ตัดสินใจ
   */
  setCloseGuard(id, fn) {
    if (!this._guards) this._guards = new Map();
    if (fn) this._guards.set(id, fn); else this._guards.delete(id);
    return true;
  }

  hidePanel(id, force) {
    // บั๊ก #19: แผงหลัก (docs) ปิดไม่ได้ — ถ้าหลุดออกจากต้นไม้ root จะกลายเป็น null
    // แล้วรอบเปิดโปรแกรมถัดไปจะรีเซ็ตเป็นเลย์เอาต์ตั้งต้น = "แผงทั้งชุดโผล่มาเอง"
    const def = this.registry.get(id);
    if (def && def.closable === false) return false;
    const guard = !force && this._guards && this._guards.get(id);
    if (guard) {
      let allow = true;
      try { allow = guard(() => this.hidePanel(id, true)) !== false; } catch { allow = true; }
      if (!allow) return false;
    }
    let changed = false;
    if (this.isFloating(id)) {
      // [alpha.66r10 บั๊ก 2] ตัวกรองเดิมดูแค่ `f.panel.id` — สมาชิกของ "กลุ่มลอย" ไม่มีวันตรง
      // → กด ✕ บนแผงที่อยู่ในกลุ่มลอยแล้วไม่มีอะไรเกิดขึ้น (แต่คืน true เหมือนสำเร็จ)
      if (this._ownFloat(id)) this.store.setFloats(this.floats.filter((f) => f.panel.id !== id));
      else this._detach(id);                     // ถอดออกจากกลุ่ม (เหลือใบเดียวกลุ่มยุบเอง)
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
    // [alpha.66r7] ใช้ `_detach` ตัวเดียวกับทางอื่นทั้งหมด — ตรงนั้นมีกฎ "แยกจากกลุ่ม → ยึดขนาดกลุ่ม" อยู่
    // (ของเดิมถอดเองตรงนี้ ทำให้กฎกลุ่มไม่ทำงานเวลาลากแผงออกจากกลุ่มไปผนึกที่อื่น)
    let node = (this.isFloating(id) || this.isDocked(id)) ? this._detach(id) : null;
    if (!node) node = this._node(id);
    if (!this.root) { this.store.update({ type: 'panel', id: node.id, title: node.title }); return true; }
    // [alpha.66r6 กฎข้อ 2] ผนึกเมื่อไหร่ = ต้องมีขนาดของตัวเองทันที (ของเดิมถ้ามี · ไม่มีก็ใช้ค่า default)
    // ปล่อยให้เป็น "สัดส่วน" ไม่ได้ — dock ที่ผสม px+สัดส่วนคือที่มาของทั้งแผงถูกบีบและช่องว่างค้าง
    this.store.update(PL.ensureDockPx(
      PL.dockPanel(this.root, this._target(targetId), side, node), id, this._defSize(id)));
    return true;
  }
  /** ถอดแผงออกจากที่เดิม (ลอยหรือผนึก) แล้วคืนโหนดของมัน — ใช้ก่อนผนึกใหม่ทุกครั้ง */
  _detach(id) {
    const fl = this.floats.find((f) => f.panel.id === id);
    if (fl) { this.store.setFloats(this.floats.filter((f) => f !== fl)); return fl.panel; }
    // [alpha.66r7] แผงที่อยู่ "ในกลุ่มแท็บของแผงลอย" — ถอดออกจากกลุ่มนั้น
    // (ถ้าไม่รู้จักเคสนี้ จะตกไปสร้างโหนดใหม่จาก id เปล่า ๆ = แผงปลอม)
    const grpF = this.floats.find((f) => f.panel.type === 'tabs'
                                      && (f.panel.children || []).some((c) => c.id === id));
    if (grpF) {
      const kid = grpF.panel.children.find((c) => c.id === id);
      const rest = grpF.panel.children.filter((c) => c.id !== id);
      const nextFloats = this.floats.map((f) => {
        if (f !== grpF) return f;
        if (rest.length === 1) return { ...f, panel: rest[0] };          // เหลือตัวเดียว → ยุบกลุ่ม
        return { ...f, panel: { ...f.panel, children: rest,
                                active: Math.max(0, Math.min(f.panel.active | 0, rest.length - 1)) } };
      // [alpha.66r10] ตัวกรองนี้ตั้งใจทิ้ง "กลุ่มที่ไม่เหลือลูก" — แต่เขียนไว้ว่า
      // "ทิ้งทุกกล่องที่ไม่มี children" ซึ่งรวม **กล่องลอยแผงเดี่ยวทุกใบ** (panel ไม่มี children)
      // → ดึงแผงออกจากกลุ่มทีหนึ่ง แผงลอยเดี่ยวใบอื่น ๆ ที่เปิดอยู่หายเกลี้ยงพร้อมกัน
      //   (รวมถึงเพื่อนในกลุ่มที่เพิ่งยุบเหลือใบเดียวเมื่อบรรทัดบน)
      }).filter((f) => f.panel.type !== 'tabs' || (f.panel.children || []).length > 0);
      this.store.setFloats(nextFloats);
      // แยกจากกลุ่ม → ยึดขนาดของกลุ่มเป็นหลัก (กฎเดียวกับกลุ่มที่ผนึกอยู่)
      const g = grpF.panel;
      if (PL.nodePx(g, true) > 0) kid.pxW = PL.nodePx(g, true);
      if (PL.nodePx(g, false) > 0) kid.pxH = PL.nodePx(g, false);   // [66r12] เดิมลืมแกนสูง
      if (grpF.w > 0) PL.setNodeFloatBox(kid, grpF.w, grpF.h);
      return kid;
    }
    if (this.isDocked(id)) {
      // [alpha.66r7 กฎกลุ่มของผู้ใช้] แยกออกจากกลุ่มแท็บ → **ยึดขนาดของกลุ่ม** เป็นหลัก
      // (กลุ่มกว้าง 250px → แยกออกมาแล้วทั้ง A และ B ต้องได้ 250px ไม่ใช่ค่าเดิมของตัวเองหรือค่า default)
      const grp = PL.tabGroupOf(this.root, id);
      const d = PL.detachPanel(this.root, id);
      const node = d.detached || this._node(id);
      if (grp && node) {
        if (PL.nodePx(grp, true) > 0) node.pxW = PL.nodePx(grp, true);
        if (PL.nodePx(grp, false) > 0) node.pxH = PL.nodePx(grp, false);
      }
      this.store.update(d.root);
      return node;
    }
    return this._node(id);
  }
  /**
   * [alpha.66r3] ผนึกแผงไว้ **เต็มด้าน** ของพื้นที่ทำงาน — ปลายทางของ "ปล่อยที่ขอบจอ"
   * ต่างจาก dockPanel ที่ผนึกเทียบกับแผงใบใดใบหนึ่ง (ได้ dock สูงเท่าแผงนั้นเท่านั้น)
   */
  dockAtEdge(id, side = 'left', isFixedPanel) {
    if (!this.root) return this.dockPanel(id, side);
    const node = this._detach(id);
    if (!this.root) { this.store.update({ type: 'panel', id: node.id, title: node.title }); return true; }
    // ถอดแล้วโครงอาจยุบ → คำนวณโหนดพื้นที่ทำงานใหม่หลังถอดเสมอ
    const wid = PL.workspaceNodeId(this.root, isFixedPanel);
    if (!wid) return this.dockPanel(id, side);
    // [alpha.66r9] **ต้องตรึงขนาดเหมือน dockPanel ทุกประการ** — ของเดิมข้ามขั้นนี้ไป
    // ผลคือแผงที่ปล่อยตรงขอบจอไม่มีขนาดของตัวเอง แล้ว dock ที่เพิ่งสร้าง (sizes = 50/50 เท่ากันเสมอ)
    // ก็แบ่งครึ่งหน้าต่างให้มันดื้อ ๆ · ปล่อยสองใบ พื้นที่เขียนเหลือ 1/4 จอ = อาการ "canvas เปล่า"
    this.store.update(PL.ensureDockPx(
      PL.dockPanel(this.root, wid, side, node), id, this._defSize(id)));
    return true;
  }
  /** [alpha.66r3] แทรกแผงเป็นแท็บ **ที่ตำแหน่งที่ระบุ** ของกลุ่มที่ targetId อยู่ */
  addTabAt(id, targetId, index) {
    if (!this.root || !this.isDocked(targetId)) return false;
    const node = this._detach(id);
    if (!this.root || !PL.hasPanel(this.root, targetId)) return false;
    this.store.update(PL.addAsTabAt(this.root, targetId, node, index));
    return true;
  }

  /** กล่องลอยใบนี้เป็น "กล่องของแผงนี้เอง" ไหม (ไม่ใช่กลุ่มที่มันไปอยู่ร่วม) */
  _ownFloat(id) { return this.floats.some((f) => f.panel.id === id); }
  /** [alpha.66r10] สลับแท็บที่แสดงอยู่ของ "กลุ่มลอย" ให้มาเป็นแผงนี้ */
  _activateFloatTab(id) {
    const f = this.floats.find((x) => x.panel.type === 'tabs'
      && (x.panel.children || []).some((c) => c.id === id));
    if (!f) return false;
    const i = f.panel.children.findIndex((c) => c.id === id);
    if (i < 0 || f.panel.active === i) return false;
    this.store.setFloats(this.floats.map((x) => (x === f ? { ...x, panel: { ...x.panel, active: i } } : x)));
    return true;
  }

  /**
   * Pop a panel out into a floating window (⧉).
   * @param opts.fromDock true = `box` คือ "ขนาดที่แผงมีอยู่ตอนยังผนึกอยู่" (ตัวลาก/ปุ่ม ⧉ ส่งมา)
   *   ซึ่งของแผงข้างคือสูงเต็มคอลัมน์ → ต้องหนีบด้วยค่าอ้างอิง · ถ้าผู้เรียกส่งกล่องลอยจริง ๆ มา
   *   (ผู้ใช้ปรับเอง · กล่องที่จดไว้) ห้ามหนีบ — เป็นเจตนาของผู้ใช้ตรง ๆ
   */
  floatPanel(id, box = {}, opts = {}) {
    const def = this.registry.get(id);
    if (def && def.floatable === false) return false;
    if (this._ownFloat(id)) { this._toFront(id); return true; }
    // [alpha.66r10 บั๊ก 2] **แผงที่อยู่ใน "กลุ่มลอย" ต้องดึงออกมาเป็นกล่องของตัวเองได้**
    // ของเดิมเช็ค `isFloating(id)` ซึ่งเป็นจริงกับสมาชิกในกลุ่มด้วย → เด้งไป `_toFront()`
    // ที่หาแผงจาก `f.panel.id` ไม่เจอ (กลุ่มมี id ของกลุ่ม) แล้วจบเงียบ ๆ พร้อมคืน true
    // ผลคือทั้งลากแท็บออก ทั้งกดปุ่ม ⧉ บนหัวแผงในกลุ่ม **ไม่มีอะไรเกิดขึ้นเลย**
    let node = null;
    if (this.isFloating(id) || this.isDocked(id)) node = this._detach(id);
    if (!node) node = this._node(id);
    // [alpha.66r6 กฎข้อ 1+4] **ขนาดตอนลอยเก็บแยกจากขนาดตอนผนึก**
    // ดึงออกมาลอย → ใช้ขนาด "โหมดลอย" ที่เคยเก็บไว้ก่อนเสมอ ไม่ใช่ขนาดตอนที่มันผนึกอยู่
    // (เพิ่งลอยครั้งแรก → ใช้ขนาดที่ผู้เรียกส่งมา = ขนาดตอนผนึก แล้วเก็บเป็นค่าโหมดลอยตั้งแต่นั้น)
    const saved = PL.nodeFloatBox(node) || {};
    const df = this._defFloat(id);
    const w = saved.w || box.w || df.w || 360;
    // [alpha.66r12] **ความสูงตอนลอย ห้ามยกมาจาก "ช่องที่มันเคยผนึกอยู่" ทั้งดุ้น**
    // แผงข้างที่ผนึกอยู่สูงเต็มคอลัมน์ (พันกว่า px) — ลากออกมาลอยแล้วได้กล่องสูงเต็มจอทุกครั้ง
    // ลำดับ: ความสูงที่แผงนี้เคยตั้งไว้ตอนลอย → ไม่มีก็ใช้ขนาดตอนผนึก **แต่ไม่เกินค่าอ้างอิงของแผง**
    // (แผงที่ผนึกอยู่ล่างสูง 260 ก็ยังได้ 260 เหมือนเดิม — ไม่ไปรีเซ็ตของที่พอดีอยู่แล้ว)
    const defH = df.h || 520;
    const h = saved.h || (box.h ? (opts.fromDock ? Math.min(box.h, defH) : box.h) : defH);
    PL.setNodeFloatBox(node, w, h);
    const f = PL.makeFloat(node, box.x ?? 80, box.y ?? 80, w, h);
    this.store.setFloats([...this.floats, f]);
    return true;
  }
  /** [alpha.66r7] เอาแผงเข้าไปรวมเป็นแท็บใน "กลุ่มลอย" — กล่องลอยคงตำแหน่ง/ขนาดเดิมไว้ */
  groupIntoFloat(srcId, floatId, index) {
    const target = this.floats.find((f) => f.id === floatId);
    if (!target || srcId === target.panel.id) return false;
    const node = this._detach(srcId);
    if (!node) return false;
    const cur = this.floats.find((f) => f.id === floatId);
    if (!cur) { this.store.setFloats([...this.floats, PL.makeFloat(node, 80, 80, 320, 300)]); return true; }
    let panel;
    if (cur.panel.type === 'tabs') {
      const kids = [...cur.panel.children];
      const at = Number.isInteger(index) ? Math.max(0, Math.min(index, kids.length)) : kids.length;
      kids.splice(at, 0, node);
      panel = { ...cur.panel, children: kids, active: at };
    } else {
      panel = PL.tabs([cur.panel, node], 1);
      if (PL.nodePx(cur.panel, true) > 0) panel.pxW = PL.nodePx(cur.panel, true);
      if (PL.nodePx(cur.panel, false) > 0) panel.pxH = PL.nodePx(cur.panel, false);  // [66r12]
      PL.setNodeFloatBox(panel, cur.w, cur.h);
    }
    this.store.setFloats(this.floats.map((f) => (f.id === floatId ? { ...f, panel } : f)));
    return true;
  }
  /**
   * [alpha.66r7] ผนึก "ทั้งกล่องลอย" (เดี่ยวหรือทั้งกลุ่ม) เข้า dock
   * @param opts.edge เป็น true = ปล่อยที่ "ขอบพื้นที่ทำงาน" → ผนึกเต็มด้านนั้น
   *   [alpha.66r11 บั๊ก D] ของเดิมไม่มีเคสนี้ พอ targetId เป็น null (ซึ่งโซนขอบจอส่งมาเสมอ)
   *   `_target()` ก็หยิบ "panel ตัวแรกในต้นไม้" = **แถบเครื่องมือ** → ทั้งกลุ่มไปเกาะข้างแถบเครื่องมือ
   */
  dockFloatGroup(floatId, side = 'left', targetId, opts = {}) {
    const f = this.floats.find((x) => x.id === floatId);
    if (!f) return false;
    this.store.setFloats(this.floats.filter((x) => x.id !== floatId));
    if (!this.root) { this.store.update(f.panel); return true; }
    const wid = opts.edge ? PL.workspaceNodeId(this.root, opts.isFixedPanel) : null;
    const anchor = wid || this._target(targetId);
    let next = PL.dockPanel(this.root, anchor, side, f.panel);
    // [alpha.66r9] กลุ่มลอยก็ต้องมีขนาดตอนผนึกเหมือนแผงเดี่ยว — `ensureDockPx` ไต่จากแผงลูก
    // ขึ้นไปเจอตัวกลุ่มเองแล้วเขียนขนาดลงที่กลุ่ม (ของเดิมข้ามกลุ่มไป = กลุ่มไม่มีขนาดตลอดกาล)
    const seed = f.panel.type === 'panel' ? f.panel.id
      : ((f.panel.children || []).find((c) => !PL.nodeHidden(c)) || {}).id;
    if (seed) next = PL.ensureDockPx(next, seed, this._defSize(seed));
    this.store.update(next);
    return true;
  }
  /** ย้าย/ปรับขนาด "กล่องลอย" ตาม id ของกล่อง (ใช้กับกลุ่มลอยที่ไม่มี panel id เดียว) */
  moveFloatBox(floatId, box = {}) {
    const next = this.floats.map((f) => {
      if (f.id !== floatId) return f;
      const merged = { ...f, ...pick(box, ['x', 'y', 'w', 'h']) };
      merged.panel = PL.setNodeFloatBox({ ...f.panel }, merged.w, merged.h);
      return merged;
    });
    this.store.setFloats(next);
    return true;
  }
  /** id ของกล่องลอยที่แผงนี้อยู่ (เดี่ยวหรืออยู่ในกลุ่ม) */
  floatIdOf(panelId) {
    const f = this.floats.find((x) => x.panel.id === panelId
      || (x.panel.type === 'tabs' && (x.panel.children || []).some((c) => c.id === panelId)));
    return f ? f.id : null;
  }
  toggleFloat(id, box) { return this.isFloating(id) ? this.dockPanel(id, box && box.side) : this.floatPanel(id, box); }
  /** Move/resize a floating window (drag + resize handle). */
  moveFloat(id, box = {}) {
    // [alpha.66r6 กฎข้อ 1] ผู้ใช้ปรับขนาดแผงลอย = อัปเดต "ขนาดโหมดลอย" ที่ติดกับโหนด
    // → ผนึกกลับแล้วดึงออกมาใหม่ ได้ขนาดที่เพิ่งตั้งไว้ ไม่ใช่ขนาดตอนผนึก
    const next = this.floats.map((f) => {
      if (f.panel.id !== id) return f;
      const merged = { ...f, ...pick(box, ['x', 'y', 'w', 'h']) };
      merged.panel = PL.setNodeFloatBox({ ...f.panel }, merged.w, merged.h);
      return merged;
    });
    this.store.setFloats(next);
    return true;
  }
  _toFront(id) {                                   // ลำดับท้ายอาร์เรย์ = อยู่บนสุด (z-order)
    const list = this.floats;
    // [alpha.66r10] รับได้ทั้ง id ของแผง (เดี่ยวหรืออยู่ในกลุ่ม) และ id ของกล่องลอยเอง
    const f = list.find((x) => x.panel.id === id || x.id === id
      || (x.panel.type === 'tabs' && (x.panel.children || []).some((c) => c.id === id)));
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
    // แยกออกจากกลุ่มแท็บมาเป็นช่องของตัวเอง = ผนึกใหม่ → ต้องมีขนาดของตัวเองด้วย (กฎข้อ 2)
    this.store.update(PL.ensureDockPx(PL.splitTab(this.root, id, side).root, id, this._defSize(id)));
    return true;
  }
  activatePanel(id) {
    if (!this.isDocked(id)) return false;
    this.store.update(PL.activatePanel(this.root, id));
    return true;
  }
  moveTab(tabsId, from, to) {
    // [alpha.66r10 บั๊ก 2] กลุ่มแท็บอาจเป็น **กลุ่มลอย** ซึ่งไม่ได้อยู่ในต้นไม้เลย
    // `PL.moveTab` เดินหาในต้นไม้อย่างเดียว → หาไม่เจอ คืนต้นไม้เดิม แล้วเราคืน true ทั้งที่ไม่ได้ทำอะไร
    // (อาการ: สลับลำดับแท็บในกล่องลอยไม่ได้เลย)
    const fl = this.floats.find((f) => f.panel.type === 'tabs' && f.panel.id === tabsId);
    if (fl) {
      const kids = [...(fl.panel.children || [])];
      if (from < 0 || from >= kids.length) return false;
      const at = Math.max(0, Math.min(to, kids.length - 1));
      const [mv] = kids.splice(from, 1);
      kids.splice(at, 0, mv);
      this.store.setFloats(this.floats.map((f) => (f === fl
        ? { ...f, panel: { ...f.panel, children: kids, active: at } } : f)));
      return true;
    }
    if (!this.root) return false;
    this.store.update(PL.moveTab(this.root, tabsId, from, to));
    return true;
  }

  // ---- ย่อ / ปรับขนาด ----
  /** Collapse (▾) — pass `on` to force, omit to toggle. */
  collapsePanel(id, on) {
    if (this.isFloating(id)) {
      const flip = (n) => ({ ...n, collapsed: on === undefined ? !n.collapsed : !!on });
      // [alpha.66r10 บั๊ก 2] ปุ่ม ▾ ของแผงที่อยู่ในกลุ่มลอยต้องพับ "เฉพาะใบนั้น" ไม่ใช่ทั้งกล่อง
      const next = this.floats.map((f) => {
        if (f.panel.id === id) return { ...f, panel: flip(f.panel) };
        if (f.panel.type === 'tabs' && (f.panel.children || []).some((c) => c.id === id)) {
          return { ...f, panel: { ...f.panel, children: f.panel.children.map((c) => (c.id === id ? flip(c) : c)) } };
        }
        return f;
      });
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
    const g = this.floats.find((x) => x.panel.type === 'tabs'
      && (x.panel.children || []).some((c) => c.id === id));          // [66r10] สมาชิกของกลุ่มลอย
    if (g) return !!(g.panel.children.find((c) => c.id === id) || {}).collapsed;
    return !!(this.root && PL.isCollapsed(this.root, id));
  }
  /** [alpha.66r4] ตั้งความกว้าง/สูงเป็น px ให้ลูกของ dock (โหมดลูกผสม) */
  resizePx(dockId, updates, row) {
    if (!this.root || !updates || !Object.keys(updates).length) return false;
    this.store.update(PL.setDockPx(this.root, dockId, updates, row));
    return true;
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
  // ---- [alpha.66r3] workspace presets (ผ่านไปที่ store) ----
  listWorkspaces() { return this.store.listWorkspaces(); }
  getWorkspace(name) { return this.store.getWorkspace(name); }
  saveWorkspace(name, extra) { return this.store.putWorkspace(name, extra); }
  removeWorkspace(name) { return this.store.removeWorkspace(name); }
  applySnapshot(snap) {
    const homes = this.store.applySnapshot(snap);
    if (this.registry.size) this._prune();
    return homes;
  }
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
    // [alpha.66r11 บั๊ก C] **กล่องลอยที่เป็น "กลุ่ม" ถูกลบทิ้งทั้งก้อนทุกครั้งที่โหลดเลย์เอาต์**
    // เพราะเงื่อนไขเดิมเช็ค `registry.has(f.panel.id)` — แต่กลุ่มถือ id ของกลุ่ม (`tmso…`)
    // ซึ่งไม่มีวันอยู่ในทะเบียนแผง → เปิดโปรแกรมใหม่/สลับเวิร์กสเปซทีหนึ่ง กลุ่มลอยหายเกลี้ยง
    // ตอนนี้กรอง "รายใบข้างใน" แทน แล้วทิ้งเฉพาะกล่องที่ไม่เหลือแผงที่รู้จักเลย
    this.store.floats = this.store.floats.map((f) => {
      if (f.panel.type !== 'tabs') return f;
      const kids = (f.panel.children || []).filter((c) => this.registry.has(c.id));
      if (!kids.length) return null;
      if (kids.length === 1) return { ...f, panel: kids[0] };            // เหลือใบเดียว → ยุบกลุ่ม
      return { ...f, panel: { ...f.panel, children: kids,
                              active: Math.max(0, Math.min(f.panel.active | 0, kids.length - 1)) } };
    }).filter((f) => f && (f.panel.type === 'tabs' || this.registry.has(f.panel.id)));
    this.store.save();
    this.store._emit();                            // บั๊ก #19: เดิมเขียน root ตรง ๆ ไม่ผ่าน update()
  }                                                //   → onChange ไม่ยิง UI ค้างกับต้นไม้เก่า
  /** ขนาดตั้งต้นตอนผนึกของแผงนี้ (ทะเบียนกำหนดได้ต่อแผง — กระดานต้องกว้างกว่าแผงข้างทั่วไป) */
  _defSize(id) {
    const d = this.registry.get(id);
    return (d && d.defaultSize) || {};
  }
  /** [alpha.66r12] ขนาดอ้างอิงตอนลอยของแผงนี้ */
  _defFloat(id) {
    const d = this.registry.get(id);
    return (d && d.floatSize) || {};
  }
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
