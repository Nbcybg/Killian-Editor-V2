// kanban-core.js — กระดาน Kanban ของฉาก: อ่าน scenes.json → จัดกลุ่มตาม status (ข้อ 12)
// pure logic ล้วน (ไม่แตะ DOM) · ต่อไฟล์จริงผ่าน io adapter → เทสด้วย mock ได้
// spec: docs/12-kanban.md · UI ทำต่อ: src/kanban/kanban-ui.js
//
// scenes.json (โครงเดิม ไม่เปลี่ยน):
//   { chapters: { <chapterId>: [ { id, title, order, fileName, status?, kbOrder?, … } ] } }
// เลย์เอาต์กระดาน (ลำดับ/ซ่อน/WIP) เก็บ localStorage — ไม่ปนกับข้อมูลงานเขียน

import { T } from '../i18n.js';
export const KANBAN_VERSION = 1;
const KEY = 'k2-kanban-layout';
export const UNSET = '__unset__';                 // คอลัมน์ของฉากที่ยังไม่กำหนดสถานะ
export const UNSET_LABEL = 'ยังไม่กำหนด';

// สถานะมาตรฐาน — สำเนาไว้ที่นี่เพื่อให้โมดูลบริสุทธิ์ (core.js แตะ DOM ไม่ได้ในเทส)
// ผู้เรียกจริงส่ง allStatuses() จาก custom-status.js เข้ามาแทนได้
export const DEFAULT_STATUSES = ['โครงร่าง', 'กำลังเขียน', 'เขียนเสร็จ', 'ตรวจแล้ว', 'เก็บถาวร'];

// ───────── เลย์เอาต์กระดาน ─────────
export function newLayout() {
  return { version: KANBAN_VERSION, order: [], hidden: [], wip: {}, collapsed: [], groupBy: 'status' };
}

// ───────── อ่านการ์ดจาก scenes.json ─────────
// คืนอาร์เรย์แบน พร้อม chapterId + ลำดับที่พบในไฟล์ (ไว้ทำ stable sort)
export function cardsOf(scenes) {
  const out = [];
  const chapters = (scenes && scenes.chapters) || {};
  let seq = 0;
  for (const chapterId of Object.keys(chapters)) {
    const rows = chapters[chapterId] || [];
    for (const r of rows) {
      out.push({
        id: r.id, title: r.title || T`(ไม่มีชื่อ)`, chapterId,
        status: r.status || '', kbOrder: r.kbOrder, order: r.order ?? 0,
        color: r.color || '', tags: r.tags || [], synopsis: r.synopsis || '',
        pov: r.pov || '', fileName: r.fileName || '', locked: !!r.locked, _seq: seq++,
      });
    }
  }
  return out;
}
export function findScene(scenes, sceneId) {
  const chapters = (scenes && scenes.chapters) || {};
  for (const chapterId of Object.keys(chapters)) {
    const i = (chapters[chapterId] || []).findIndex((r) => r.id === sceneId);
    if (i >= 0) return { chapterId, index: i, row: chapters[chapterId][i] };
  }
  return null;
}

// เรียงการ์ดในคอลัมน์: kbOrder → order → ลำดับที่พบในไฟล์ (เสถียร ไม่สลับมั่วเมื่อค่าเท่ากัน)
function byBoardOrder(a, b) {
  const ka = a.kbOrder ?? Infinity, kb = b.kbOrder ?? Infinity;
  if (ka !== kb) return ka - kb;
  if (a.order !== b.order) return a.order - b.order;
  return a._seq - b._seq;
}

// ───────── สร้างข้อมูลกระดาน ─────────
/**
 * Build board data from scenes.json.
 * @param {object} scenes  parsed scenes.json
 * @param {object} opts    { statuses, layout, chapters, filter, includeUnset }
 * @returns {{columns:Array, total:number, byStatus:object}}
 */
export function getKanbanData(scenes, opts = {}) {
  const statuses = opts.statuses || DEFAULT_STATUSES;
  const layout = opts.layout || newLayout();
  const includeUnset = opts.includeUnset !== false;
  const only = opts.chapters ? new Set(opts.chapters) : null;

  let cards = cardsOf(scenes);
  if (only) cards = cards.filter((c) => only.has(c.chapterId));
  if (typeof opts.filter === 'function') cards = cards.filter(opts.filter);

  // คีย์คอลัมน์ = สถานะที่ตั้งไว้ + สถานะแปลกปลอมที่เจอในไฟล์ (ห้ามทำการ์ดหาย)
  const keys = [...statuses];
  for (const c of cards) if (c.status && !keys.includes(c.status)) keys.push(c.status);
  const hasUnset = cards.some((c) => !c.status);
  if (includeUnset && hasUnset) keys.unshift(UNSET);

  const ordered = sortKeys(keys, layout.order);
  const hidden = new Set(layout.hidden || []);
  const collapsed = new Set(layout.collapsed || []);
  const byStatus = {};
  const columns = [];
  for (const key of ordered) {
    if (hidden.has(key)) continue;
    const list = cards.filter((c) => (key === UNSET ? !c.status : c.status === key)).sort(byBoardOrder);
    byStatus[key] = list.length;
    const wip = (layout.wip || {})[key] || 0;
    columns.push({
      key,
      label: key === UNSET ? UNSET_LABEL : key,
      cards: list.map((c) => { const { _seq, ...rest } = c; return rest; }),
      count: list.length,
      wip,
      over: wip > 0 && list.length > wip,                 // เกินโควตา WIP → UI ทำสีเตือน
      custom: key !== UNSET && !statuses.includes(key),
      collapsed: collapsed.has(key),
    });
  }
  return { columns, total: cards.length, byStatus };
}
// เรียงตาม layout.order ก่อน แล้วต่อท้ายด้วยคีย์ที่ยังไม่เคยจัดลำดับ
function sortKeys(keys, order) {
  if (!order || !order.length) return keys;
  const rank = new Map(order.map((k, i) => [k, i]));
  return keys.slice().sort((a, b) => (rank.has(a) ? rank.get(a) : 1e6 + keys.indexOf(a))
                                   - (rank.has(b) ? rank.get(b) : 1e6 + keys.indexOf(b)));
}

// ───────── ลากการ์ดเปลี่ยนสถานะ ─────────
/**
 * Set a scene's status (and optionally its position in the target column).
 * @returns {{scenes:object, changed:boolean, from:string, to:string}} scenes is a NEW object
 */
export function updateSceneStatus(scenes, sceneId, status, opts = {}) {
  const next = clone(scenes);
  const hit = findScene(next, sceneId);
  if (!hit) return { scenes: next, changed: false, from: '', to: status };
  const from = hit.row.status || '';
  const to = status === UNSET ? '' : status;
  if (to) hit.row.status = to; else delete hit.row.status;   // ยังไม่กำหนด = ไม่มีฟิลด์ (ไฟล์สะอาดแบบ v1)
  if (opts.index != null) reindexColumn(next, to, sceneId, opts.index);
  return { scenes: next, changed: from !== to || opts.index != null, from, to };
}
/** Drag a card to another column at a given position. */
export function moveCard(scenes, sceneId, toStatus, toIndex = null) {
  return updateSceneStatus(scenes, sceneId, toStatus, { index: toIndex ?? undefined });
}

// จัดลำดับ kbOrder ใหม่ในคอลัมน์เดียว โดยแทรก sceneId ที่ตำแหน่ง index
function reindexColumn(scenes, status, sceneId, index) {
  const cards = cardsOf(scenes)
    .filter((c) => (status ? c.status === status : !c.status))
    .sort(byBoardOrder);
  const moving = cards.findIndex((c) => c.id === sceneId);
  if (moving >= 0) cards.splice(moving, 1);
  const at = Math.max(0, Math.min(index, cards.length));
  const me = findScene(scenes, sceneId);
  cards.splice(at, 0, { id: sceneId });
  cards.forEach((c, i) => {
    const hit = c.id === sceneId ? me : findScene(scenes, c.id);
    if (hit) hit.row.kbOrder = i;
  });
}
/** Write kbOrder for every card so ordering survives a reload. */
export function normalizeKbOrder(scenes) {
  const next = clone(scenes);
  const statuses = new Set(cardsOf(next).map((c) => c.status));
  for (const st of statuses) {
    const list = cardsOf(next).filter((c) => c.status === st).sort(byBoardOrder);
    list.forEach((c, i) => { const h = findScene(next, c.id); if (h) h.row.kbOrder = i; });
  }
  return next;
}

// ───────── คอลัมน์ ─────────
/** Add a column (= a scene status). Returns a NEW layout. */
export function addColumn(layout, key, opts = {}) {
  const out = cloneLayout(layout);
  const name = String(key || '').trim();
  if (!name) return out;
  if (!out.order.includes(name)) {
    const at = opts.at == null ? out.order.length : Math.max(0, Math.min(opts.at, out.order.length));
    out.order.splice(at, 0, name);
  }
  out.hidden = out.hidden.filter((k) => k !== name);
  return out;
}
/**
 * Remove a column. Cards must be moved first (or pass `moveTo`).
 * @returns {{layout:object, scenes?:object, ok:boolean, reason?:string}}
 */
export function removeColumn(layout, key, opts = {}) {
  const out = cloneLayout(layout);
  const scenes = opts.scenes;
  if (scenes) {
    const stuck = cardsOf(scenes).filter((c) => c.status === key);
    if (stuck.length && !opts.moveTo) return { layout: out, ok: false, reason: 'not-empty', count: stuck.length };
    if (stuck.length) {
      let next = scenes;
      for (const c of stuck) next = updateSceneStatus(next, c.id, opts.moveTo).scenes;
      finish(out, key);
      return { layout: out, scenes: next, ok: true, moved: stuck.length };
    }
  }
  finish(out, key);
  return { layout: out, ok: true, moved: 0 };
}
function finish(out, key) {
  out.order = out.order.filter((k) => k !== key);
  out.collapsed = out.collapsed.filter((k) => k !== key);
  delete out.wip[key];
  if (!out.hidden.includes(key)) out.hidden.push(key);   // ซ่อนไว้ กันคอลัมน์โผล่กลับจาก DEFAULT_STATUSES
}
export function reorderColumns(layout, from, to) {
  const out = cloneLayout(layout);
  if (from < 0 || from >= out.order.length) return out;
  const [m] = out.order.splice(from, 1);
  out.order.splice(Math.max(0, Math.min(to, out.order.length)), 0, m);
  return out;
}
export function setWip(layout, key, n) {
  const out = cloneLayout(layout);
  if (!n) delete out.wip[key]; else out.wip[key] = n;
  return out;
}
export function toggleHidden(layout, key) {
  const out = cloneLayout(layout);
  out.hidden = out.hidden.includes(key) ? out.hidden.filter((k) => k !== key) : [...out.hidden, key];
  return out;
}
export function toggleCollapsed(layout, key) {
  const out = cloneLayout(layout);
  out.collapsed = out.collapsed.includes(key) ? out.collapsed.filter((k) => k !== key) : [...out.collapsed, key];
  return out;
}

// ───────── บันทึกเลย์เอาต์ (localStorage) ─────────
function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
}
export function serializeKanban(layout) { return JSON.stringify({ ...newLayout(), ...layout, version: KANBAN_VERSION }); }
export function deserializeKanban(str) {
  if (!str) return null;
  let d; try { d = JSON.parse(str); } catch { return null; }
  if (!d || typeof d !== 'object') return null;
  if (d.version == null) d = { ...d, version: KANBAN_VERSION };   // v0 → v1
  if (d.version !== KANBAN_VERSION) return null;
  return { ...newLayout(), ...d };
}
export class KanbanStore {
  constructor(storage = defaultStorage(), key = KEY) {
    this.storage = storage; this.key = key; this.layout = newLayout();
  }
  load() { const l = deserializeKanban(this.storage.getItem(this.key)); if (l) this.layout = l; return !!l; }
  save() { this.storage.setItem(this.key, serializeKanban(this.layout)); }
  set(layout) { this.layout = layout; this.save(); return this.layout; }
  reset() { this.layout = newLayout(); this.storage.removeItem(this.key); }
}

// ────────────────────────────────────────────────────────────────
// KanbanBoard — ผูกกับ scenes.json จริง (อัปเดตไฟล์อัตโนมัติเมื่อลากการ์ด)
//   io = { join, readJson, writeFile, exists }  ← ส่ง kapi เข้าไปได้เลย
//   kapi ไม่มี writeJson → เขียนด้วย writeFile + JSON.stringify เสมอ
// ────────────────────────────────────────────────────────────────
export class KanbanBoard {
  constructor({ io, draftPath, statuses, storage, autoSave = true, onLog } = {}) {
    this.io = io; this.draftPath = draftPath;
    this.statuses = statuses || DEFAULT_STATUSES;
    this.store = new KanbanStore(storage);
    this.scenes = { chapters: {} };
    this.autoSave = autoSave; this.dirty = false;
    this.onLog = onLog || null;
    this.listeners = new Set();
  }
  get file() { return this.io.join(this.draftPath, 'scenes.json'); }

  async load() {
    this.store.load();
    const data = await this.io.readJson(this.file);
    this.scenes = data && data.chapters ? data : { chapters: {} };
    this._emit();
    return this.scenes;
  }
  data(opts = {}) {
    return getKanbanData(this.scenes, { statuses: this.statuses, layout: this.store.layout, ...opts });
  }
  /** Drag-drop entry point: change status (+ position) and write scenes.json. */
  async updateSceneStatus(sceneId, status, index) {
    const res = updateSceneStatus(this.scenes, sceneId, status, index == null ? {} : { index });
    if (!res.changed) return res;
    this.scenes = res.scenes;
    this.dirty = true;
    if (this.autoSave) await this.flush();
    this._emit();
    if (this.onLog) this.onLog({ type: 'scene:status', sceneId, from: res.from, to: res.to });
    return res;
  }
  async moveCard(sceneId, toStatus, toIndex) { return this.updateSceneStatus(sceneId, toStatus, toIndex); }
  async flush() {
    if (!this.dirty) return false;
    await this.io.writeFile(this.file, JSON.stringify(this.scenes, null, 2));
    this.dirty = false;
    return true;
  }
  async addColumn(key, opts = {}) {
    this.store.set(addColumn(this.store.layout, key, opts));
    if (!this.statuses.includes(key)) this.statuses = [...this.statuses, key];
    this._emit();
    return this.store.layout;
  }
  async removeColumn(key, opts = {}) {
    const res = removeColumn(this.store.layout, key, { ...opts, scenes: this.scenes });
    if (!res.ok) return res;
    this.store.set(res.layout);
    if (res.scenes) { this.scenes = res.scenes; this.dirty = true; if (this.autoSave) await this.flush(); }
    this._emit();
    return res;
  }
  setLayout(layout) { this.store.set(layout); this._emit(); return this.store.layout; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this.data()); }
}

function clone(o) { return JSON.parse(JSON.stringify(o ?? { chapters: {} })); }
function cloneLayout(l) { return { ...newLayout(), ...clone(l || {}) }; }
