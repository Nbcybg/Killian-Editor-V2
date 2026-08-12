// split-ui.js — Split View (ข้อ 40): แบ่งพื้นที่แก้ไขเป็นหลายช่อง ซ้อนได้ (recursive)
//
// บั๊ก #1: ก่อนหน้านี้ไฟล์นี้มี "สองระบบ" อยู่ด้วยกัน
//   A) โหมดเทียบ 2 ช่องแบบ CSS inset (#panes.split + state.compareFile) — ใช้งานอยู่จริง แต่ได้แค่ 2 ช่อง
//   B) ต้นไม้ split ซ้อนได้ (SplitManager + renderSplitTree) — โค้ดครบแต่ไม่มีใครเรียก = dead code
// ตอนนี้เหลือระบบเดียว: ทุกเส้นทาง (ปุ่ม/คีย์ลัด/เมนู/เทียบเอกสาร/เทียบเวอร์ชัน/ผังแตกสาย)
// วิ่งผ่าน SplitManager หมด แล้ววาดลง #panes ผ่าน renderSplit()
//
// โครง DOM:
//   #panes                      ← .pane ของทุกแท็บอยู่ที่นี่ตามปกติ (ไม่ split = เหมือนเดิมทุกอย่าง)
//     └ #split-root             ← มีเฉพาะตอน split · absolute inset:0
//         └ .k-split-container[data-dir=row|col]
//              ├ .k-split-pane  ← "ยืม" .pane ของแท็บนั้นมาใส่ (ย้าย element ไม่สร้างใหม่ → ProseMirror ไม่ถูกทำลาย)
//              ├ .k-split-handle
//              └ .k-split-pane
//
// pane ว่าง (leaf.tabId = null) รองรับด้วย — เปิดแยกจอตอนมีแท็บเดียวจึงทำได้ แล้วค่อยลากแท็บมาวาง
import { t as tt, t } from '../i18n.js';
import { $, el, setStatus, state, t as tr } from '../core.js';   // บทเรียน 25: ในไฟล์นี้ตัวแปร t = แท็บ → i18n ใช้ชื่อ tr
import * as SL from '../layout/split-layout.js';

const ROOT_ID = 'split-root';

// hooks จาก app.js (กัน circular import — app.js เรียก setSplitHooks() ตอน bootstrap)
let hooks = { activate: null, onRender: null, closeTab: null };
export function setSplitHooks(h) { hooks = { ...hooks, ...(h || {}) }; }

let mgr = null;
let _syncing = false;                    // กัน activate() ↔ renderSplit() เรียกวนกัน

export function getSplitManager() {
  if (!mgr) {
    mgr = new SL.SplitManager();
    mgr.onChange(() => renderSplit());
  }
  return mgr;
}

// ───────── สถานะ ─────────
export function isSplit() { return getSplitManager().paneCount() >= 2; }
export function paneCount() { return getSplitManager().paneCount(); }
/** แนวของการแบ่งชั้นบนสุด — 'right' = ซ้าย-ขวา · 'down' = บน-ล่าง */
export function splitDir() {
  const r = getSplitManager().root;
  return r && r.type === 'split' && r.dir === 'col' ? 'down' : 'right';
}
/** tabId ที่กำลังแสดงอยู่ในช่องต่าง ๆ (ตัด pane ว่างออก) */
export function splitTabIds() {
  const r = getSplitManager().root;
  return r ? SL.tabIds(r).filter(Boolean) : [];
}
/** tabId ของช่องที่โฟกัสอยู่ */
export function activeSplitTab() { return getSplitManager().activeTabId(); }

// ───────── ตัวช่วย DOM ─────────
function panesEl() { return $('#panes'); }
function rootEl() { return document.getElementById(ROOT_ID); }
// คืน .pane ที่ถูกยืมไปไว้ในต้นไม้กลับมาเป็นลูกตรงของ #panes ก่อนล้าง/รื้อ
// (ต้องย้าย ไม่ใช่ innerHTML='' ทับ — ไม่งั้น ProseMirror ของทุกแท็บถูกถอดออกจาก DOM ทิ้ง)
function reclaimPanes(panes) {
  if (!panes) return;
  // .k-split-body คือกล่องเนื้อหาใต้แถบแท็บย่อย (บั๊ก #12) — เลือกทั้งสองแบบเผื่อ DOM รุ่นเก่าค้าง
  panes.querySelectorAll('.k-split-body > .pane, .k-split-pane > .pane').forEach((p) => panes.appendChild(p));
}
function tabOf(id) {
  const t = id && state.tabs.get(id);
  return t && !t.floatWin && t.pane ? t : null;     // แท็บที่แยกเป็นหน้าต่างลอยไม่อยู่ใน #panes แล้ว
}

// state.compareFile ยังถูกใช้โดยโค้ด/เทสเดิม — นิยามใหม่ให้ตรงความหมาย:
// "เอกสารอีกฉบับที่แสดงคู่กันอยู่" = tabId ของช่องที่ไม่ใช่แท็บที่ active (เฉพาะตอนมี 2 ช่อง)
function syncCompareFile() {
  const ids = splitTabIds();
  state.compareFile = ids.length === 2 ? (ids.find((f) => f !== state.active?.file) ?? null) : null;
}

// ───────── วาด ─────────
let _ensuring = false;                   // กัน ensureAllTabsInSplit() → update() → renderSplit() วนซ้ำ

export function renderSplit() {
  const panes = panesEl();
  if (!panes) return;
  const sm = getSplitManager();
  // บั๊ก #12: #tabs ถูกซ่อนตอน split → แท็บที่ไม่ได้อยู่ในช่องไหนเลยจะเข้าถึงไม่ได้ ต้องเก็บเข้าช่องก่อน
  if (isSplit() && !_ensuring) {
    _ensuring = true;
    try { if (ensureAllTabsInSplit()) return; }       // โครงเปลี่ยน → onChange วาดรอบใหม่ให้แล้ว
    finally { _ensuring = false; }
  }
  reclaimPanes(panes);
  document.querySelectorAll('.pane').forEach((p) => p.classList.remove('compare-on', 'k-in-split'));

  if (!isSplit()) {                                  // เหลือช่องเดียว/ไม่มีเลย → รื้อต้นไม้ กลับโหมดปกติ
    rootEl()?.remove();
    panes.classList.remove('split', 'split-h');
    document.body.classList.remove('k-split-on');    // คืนแถบแท็บรวมด้านบน
    document.querySelectorAll('.cmp-close').forEach((b) => b.remove());
    syncCompareFile();
    hooks.onRender?.();
    return;
  }

  let host = rootEl();
  if (!host) { host = el('div', 'k-split-root'); host.id = ROOT_ID; panes.appendChild(host); }
  host.replaceChildren();
  const tree = renderSplitNode(sm.root, sm);
  if (tree) host.appendChild(tree);
  panes.classList.add('split');
  panes.classList.toggle('split-h', splitDir() === 'down');
  document.body.classList.add('k-split-on');         // ซ่อน #tabs — ทุกช่องมีแถบแท็บของตัวเองแล้ว
  syncCompareFile();
  markCompare();
  hooks.onRender?.();
}

// เดิมชื่อ syncSplitPanes() — เรียกหลัง activate()/ปิดแท็บ · ตัดช่องที่อ้างแท็บซึ่งถูกปิดไปแล้วด้วย
export function syncSplitPanes() {
  const sm = getSplitManager();
  if (!sm.root) return;
  // แท็บที่แยกเป็นหน้าต่างลอยยังนับว่า "มีอยู่" — ช่องของมันจะแสดงคำแนะนำช่องว่างไว้ก่อน
  // แล้วกลับมาเองเมื่อผนึกแท็บคืน (ต่างจากแท็บที่ถูกปิดจริงซึ่งต้องยุบช่องทิ้ง)
  const valid = [...state.tabs.keys()];
  const stale = SL.tabIds(sm.root).some((id) => id && !valid.includes(id));
  if (stale) sm.syncWithPanels([...valid, null]);    // null = อนุญาต pane ว่าง
  else renderSplit();
}

function markCompare() {
  for (const id of splitTabIds()) {
    const t = tabOf(id);
    if (!t) continue;
    t.pane.classList.add('k-in-split');
    t.pane.classList.toggle('compare-on', id !== state.active?.file);
  }
}

export function renderSplitNode(node, sm) {
  if (!node) return null;
  if (node.type === 'leaf') return renderLeaf(node, sm);
  if (node.type !== 'split') return null;

  const box = el('div', 'k-split-container');
  box.dataset.splitId = node.id;
  box.dataset.dir = node.dir === 'col' ? 'col' : 'row';
  const kids = node.children || [];
  for (let i = 0; i < kids.length; i++) {
    const childEl = renderSplitNode(kids[i], sm);
    if (!childEl) continue;
    childEl.style.flexGrow = String(node.sizes?.[i] ?? 1);
    childEl.style.flexShrink = '1';
    childEl.style.flexBasis = '0%';
    box.appendChild(childEl);
    if (i < kids.length - 1) box.appendChild(splitHandle(node, i, sm));
  }
  return box;
}

function renderLeaf(node, sm) {
  const pane = el('div', 'k-split-pane' + (sm.focusId === node.id ? ' focus' : ''));
  pane.dataset.leafId = node.id;
  pane.dataset.tabId = node.tabId || '';
  pane.addEventListener('mousedown', () => focusPane(node.id), true);

  // ── บั๊ก #12: แถบแท็บย่อยของช่องนี้ ──────────────────────────────────────
  // เดิมมี #tabs แถบเดียวทั้งหน้าต่าง → คลิกแท็บทีไรก็ไปแทนที่ในช่องที่โฟกัส
  // เลือกแท็บให้ช่องขวาแยกจากช่องซ้ายไม่ได้เลย ตอนนี้ทุกช่องมีแถบของตัวเอง
  pane.appendChild(renderLeafTabs(node, sm));

  const body = el('div', 'k-split-body');
  const t = tabOf(node.tabId);
  if (t) body.appendChild(t.pane);
  else {
    const hint = el('div', 'k-split-empty');
    hint.append(el('div', 'k-split-empty-icon', '⌗'));
    hint.append(el('div', '', tr('split.emptyPane', 'ช่องว่าง — ลากหัวแท็บมาวางที่นี่')));
    hint.append(el('div', 'dim', tr('split.emptyPaneHint', 'หรือคลิกช่องนี้แล้วเลือกแท็บด้านบน')));
    body.appendChild(hint);
  }
  pane.appendChild(body);

  // ปุ่มปิดช่องนี้ (ทุกช่องมีของตัวเอง — ปิดช่องไหนก็ได้ ไม่ใช่แค่ฝั่งขวา)
  const cb = el('div', 'cmp-close', tr('split.closePane', '✕ ปิดช่องนี้'));
  cb.title = tr('split.closePaneHint', 'ปิดช่องนี้ (แท็บยังเปิดอยู่)');
  cb.onmousedown = (e) => e.stopPropagation();
  cb.onclick = (e) => { e.stopPropagation(); closePane(node.id); };
  pane.appendChild(cb);
  return pane;
}

/** แถบแท็บย่อยของ pane เดียว (บั๊ก #12) — คลิกสลับได้เฉพาะในช่องนี้ */
function renderLeafTabs(node, sm) {
  const bar = el('div', 'k-split-tabs');
  bar.dataset.leafId = node.id;
  const cur = SL.leafTab(node);
  for (const id of node.tabs || []) {
    const t = state.tabs.get(id);
    const btn = el('div', 'k-mtab' + (id === cur ? ' on' : '') + (t && t.dirty ? ' dirty' : ''));
    btn.dataset.file = id;
    btn.title = id;
    btn.append(el('span', 'k-mtab-title', (t && t.title) || id.split(/[\\/]/).pop()));
    const x = el('span', 'k-mtab-x', '×');
    x.title = tr('split.removeFromPane', 'เอาออกจากช่องนี้ (แท็บยังเปิดอยู่)');
    x.onmousedown = (e) => e.stopPropagation();
    x.onclick = (e) => {
      e.stopPropagation();
      sm.closeInLeaf(node.id, id);                 // emit → renderSplit
      // แถบแท็บรวมถูกซ่อนตอนแยกจอ → แท็บที่ไม่เหลืออยู่ช่องไหนเลยจะเข้าถึงไม่ได้ ต้องปิดจริง
      // (พฤติกรรมเดียวกับ VS Code: ปิดแท็บในกลุ่มหนึ่ง สำเนาในกลุ่มอื่นยังอยู่)
      if (!sm.has(id)) { hooks.closeTab?.(id); return; }
      const tid = sm.activeTabId();
      if (tid && tid !== state.active?.file && state.tabs.has(tid)) hooks.activate?.(tid);
    };
    btn.append(x);
    btn.onclick = (e) => {
      if (e.target === x) return;
      selectTabInPane(node.id, id);
    };
    bar.append(btn);
  }
  if (!(node.tabs || []).length) bar.append(el('span', 'k-split-tabs-empty', tt('ui.layoutSplit.fieldEmpty')));
  makeTabSplitDraggable(bar);                      // ลากแท็บข้ามช่องได้จากแถบย่อยด้วย
  return bar;
}

/** อัปเดตชื่อ/จุดงานค้างบนแถบแท็บย่อย โดยไม่วาดต้นไม้ใหม่ (เรียกจาก markDirty/saveTab) */
export function refreshSplitTabs() {
  for (const btn of document.querySelectorAll('.k-split-tabs .k-mtab')) {
    const t = state.tabs.get(btn.dataset.file);
    if (!t) continue;
    btn.classList.toggle('dirty', !!t.dirty);
    const ttl = btn.querySelector('.k-mtab-title');
    if (ttl && ttl.textContent !== t.title) ttl.textContent = t.title;
  }
}

/** เลือกแท็บให้ช่องหนึ่งโดยไม่ยุ่งกับช่องอื่น (บั๊ก #12) */
export function selectTabInPane(leafId, tabId) {
  const sm = getSplitManager();
  if (!sm.root) return false;
  if (!sm.activateInLeaf(leafId, tabId)) return false;   // emit → renderSplit
  if (state.tabs.has(tabId) && tabId !== state.active?.file && hooks.activate && !_syncing) {
    _syncing = true;
    try { hooks.activate(tabId); } finally { _syncing = false; }
  }
  markCompare();
  return true;
}

// ที่จับปรับสัดส่วน — ปรับ flex สดตอนลาก แล้ว commit ตอนปล่อย (ไม่ re-render ระหว่างลาก)
function splitHandle(node, index, sm) {
  const row = node.dir !== 'col';
  const h = el('div', 'k-split-handle ' + (row ? 'k-sh-col' : 'k-sh-row'));
  h.dataset.splitId = node.id;
  h.dataset.index = String(index);
  h.title = tr('split.dragResize', 'ลากเพื่อปรับสัดส่วน (ดับเบิลคลิก = 50%)');
  h.addEventListener('dblclick', () => sm.resize(node.id, index, 0.5));
  h.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const prev = h.previousElementSibling, next = h.nextElementSibling;
    if (!prev || !next) return;
    const pr = prev.getBoundingClientRect(), nr = next.getBoundingClientRect();
    const total = row ? pr.width + nr.width : pr.height + nr.height;
    if (total <= 0) return;
    const start = row ? e.clientX : e.clientY;
    const base = row ? pr.width : pr.height;
    const sum = (parseFloat(prev.style.flexGrow) || 1) + (parseFloat(next.style.flexGrow) || 1);
    let ratio = base / total;
    h.classList.add('k-dragging');
    document.body.classList.add('k-resizing');
    const move = (ev) => {
      const d = (row ? ev.clientX : ev.clientY) - start;
      ratio = Math.max(0.05, Math.min(0.95, (base + d) / total));
      prev.style.flexGrow = String(sum * ratio);
      next.style.flexGrow = String(sum * (1 - ratio));
    };
    const up = () => {
      h.classList.remove('k-dragging');
      document.body.classList.remove('k-resizing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      sm.resize(node.id, index, ratio);            // snap 50% ทำในเอนจิน (resizeSplit)
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  return h;
}

// ───────── โฟกัสช่อง ─────────
export function focusPane(leafId) {
  const sm = getSplitManager();
  if (!sm.root) return false;
  if (sm.focusId === leafId) return true;           // โฟกัสอยู่แล้ว → อย่ายิง activate ซ้ำทุกคลิกในเอดิเตอร์
  if (!sm.focus(leafId)) return false;
  for (const p of document.querySelectorAll('.k-split-pane')) p.classList.toggle('focus', p.dataset.leafId === leafId);
  const tid = sm.activeTabId();
  if (tid && tid !== state.active?.file && state.tabs.has(tid) && hooks.activate && !_syncing) {
    _syncing = true;
    try { hooks.activate(tid); } finally { _syncing = false; }
  }
  return true;
}

/** เรียกจาก activate(): แท็บที่เพิ่งถูกเลือกต้องไปโผล่ในช่องที่ถูกต้อง */
export function syncActiveSplit(file) {
  const sm = getSplitManager();
  if (!isSplit() || !file || _syncing) { if (isSplit()) syncCompareFile(); return; }
  const l = SL.findLeafByTab(sm.root, file);
  if (l) {
    // บั๊ก #12: เดิม "ย้ายแท็บไปช่องที่โฟกัส" — ตอนนี้ไปหาช่องที่มันอยู่แล้วสลับให้เป็นตัวที่แสดงในช่องนั้น
    // ช่องอื่นไม่ขยับเลย (นั่นคือเหตุผลที่เลือกแท็บให้ช่องขวาแยกจากช่องซ้ายได้)
    if (SL.leafTab(l) !== file) {
      _syncing = true;
      try { sm.activateInLeaf(l.id, file); } finally { _syncing = false; }
      return;
    }
    if (sm.focusId !== l.id) {
      sm.focusId = l.id;
      for (const p of document.querySelectorAll('.k-split-pane')) p.classList.toggle('focus', p.dataset.leafId === l.id);
    }
    syncCompareFile();
    markCompare();
    return;
  }
  // ยังไม่มีช่องไหนถือแท็บนี้ → เพิ่มเข้ากลุ่มของช่องที่โฟกัสอยู่ (emit → renderSplit)
  _syncing = true;
  try { sm.addTab(file); } finally { _syncing = false; }
}

/** ทุกแท็บที่เปิดอยู่ต้องมีที่อยู่ในสักช่อง — ไม่งั้นซ่อน #tabs แล้วจะเข้าถึงบางแท็บไม่ได้ (บั๊ก #12) */
function ensureAllTabsInSplit() {
  const sm = getSplitManager();
  if (!sm.root) return false;
  const have = new Set(SL.allTabIds(sm.root));
  const missing = [...state.tabs.keys()].filter((id) => !have.has(id) && tabOf(id));
  if (!missing.length) return false;
  const target = sm.focusLeafId() || SL.leafIds(sm.root)[0];
  if (!target) return false;
  let next = sm.root;
  for (const id of missing) next = SL.addLeafTab(next, target, id, false);
  sm.store.update(next);                           // แจ้งครั้งเดียว → renderSplit วาดใหม่ให้เอง
  return true;
}

// ───────── คำสั่ง ─────────
/** เปิดโหมดแยกหน้าจอ (เพิ่มอีก 1 ช่อง) — dir: 'right' = ซ้าย-ขวา · 'down' = บน-ล่าง */
export function createSplit(tabId, dir) {
  const panes = panesEl();
  if (!panes) return null;
  const sm = getSplitManager();
  const cur = tabId || state.active?.file || [...state.tabs.keys()].find((f) => tabOf(f)) || null;
  const d = dir === 'down' ? 'down' : 'right';
  const side = d === 'down' ? 'bottom' : 'right';

  if (!sm.root) sm.open(cur);
  else if (cur && !sm.has(cur)) sm.open(cur);
  // แท็บอื่นที่ยังไม่มีช่องของตัวเอง → เอามาแสดงช่องใหม่ · ไม่มีเลยก็เปิดช่องว่างไว้ให้ลากแท็บมาวาง
  // (เดิมกรณีมีแท็บเดียวจะขึ้นว่า "ต้องเปิดอย่างน้อย 2 แท็บ" แล้วไม่เกิดอะไรขึ้น = ดูเหมือน split พัง)
  const other = [...state.tabs.keys()].find((f) => f !== cur && tabOf(f) && !sm.has(f)) || null;
  sm.splitWith(other, side);
  setStatus(other ? tr('split.statusPrefix', 'แยกหน้าจอ: ') + (d === 'down' ? tt('ui.layoutSplit.topBottom') : tt('ui.layoutSplit.leftRight'))
                  : tr('split.openedEmpty', 'เปิดช่องว่างแล้ว — ลากหัวแท็บมาวางในช่อง หรือคลิกช่องแล้วเลือกแท็บ'));
  return { dir: d, right: other };
}

/** ปิดโหมดแยกหน้าจอ — เหลือช่องเดียวคือช่องที่โฟกัสอยู่ */
export function closeSplit() {
  const sm = getSplitManager();
  const keep = sm.activeTabId() || state.active?.file || null;
  if (!sm.root) { renderSplit(); return; }
  sm.store.update(keep ? SL.leaf(keep) : null);
  sm.focusId = sm.root ? sm.root.id : null;
  if (keep && keep !== state.active?.file && state.tabs.has(keep)) hooks.activate?.(keep);
  setStatus(tr('split.closed', 'ยกเลิกแยกหน้าจอแล้ว'));
}

/** ปิดเฉพาะช่องหนึ่ง (แท็บยังเปิดอยู่) */
export function closePane(leafId) {
  const sm = getSplitManager();
  if (!sm.root) return false;
  sm.closePane(leafId);
  const tid = sm.activeTabId();
  if (tid && tid !== state.active?.file && state.tabs.has(tid)) hooks.activate?.(tid);
  return true;
}

/** สลับเปิด/ปิด — เรียกซ้ำด้วยทิศเดิม = ปิด · ทิศใหม่ = เปลี่ยนแนว */
export function toggleSplit(tabId, dir) {
  const sm = getSplitManager();
  if (isSplit()) {
    if (dir && dir !== splitDir()) {                // สลับแนวแทนการปิด
      const next = JSON.parse(JSON.stringify(sm.root));
      if (next.type === 'split') next.dir = dir === 'down' ? 'col' : 'row';
      sm.store.update(next);
      setStatus(tr('split.statusPrefix', 'แยกหน้าจอ: ') + (dir === 'down' ? tt('ui.layoutSplit.topBottom') : tt('ui.layoutSplit.leftRight')));
      return true;
    }
    closeSplit();
    return false;
  }
  return !!createSplit(tabId, dir);
}

/** เอาแท็บไปแสดงคู่กันอีกช่อง — ใช้แทน applyCompare()/เทียบเวอร์ชัน/ผังแตกสาย */
export function openInSplit(tabId, side = 'right') {
  const sm = getSplitManager();
  const cur = state.active?.file;
  if (!isSplit()) {
    // ยังไม่ได้แยกจอ → ช่องแรกต้องเป็นเอกสารที่เปิดอยู่ตอนนี้เสมอ
    // (ต้นไม้ที่ค้างจากการแยกจอรอบก่อนอาจยังอ้างแท็บอื่นอยู่ → ได้คู่เทียบผิดคู่)
    if (cur && cur !== tabId && tabOf(cur)) { sm.store.update(SL.leaf(cur)); sm.focusId = sm.root.id; }
    else if (!sm.root) sm.open(tabId);
  }
  if (!sm.root) { sm.open(tabId); renderSplit(); return false; }
  if (sm.has(tabId)) {
    const l = SL.findLeafByTab(sm.root, tabId);
    const curLeaf = cur ? SL.findLeafByTab(sm.root, cur) : null;
    // บั๊ก #12: อยู่ในกลุ่มแท็บของ "ช่องเดียวกัน" กับเอกสารปัจจุบัน = ยังเทียบกันไม่ได้ ต้องแยกออกมาอีกช่อง
    if (l && curLeaf && l.id === curLeaf.id) sm.splitWith(tabId, side === 'down' ? 'bottom' : side, l.id);
    else if (l) { sm.activateInLeaf(l.id, tabId); focusPane(l.id); }
    return true;
  }
  const empty = emptyLeafId();
  if (empty) sm.moveTab(tabId, empty, 'center');    // มีช่องว่างอยู่ → เติมลงช่องนั้นก่อน
  else sm.splitWith(tabId, side === 'down' ? 'bottom' : side);
  syncCompareFile();
  markCompare();
  return true;
}
function emptyLeafId() {
  const r = getSplitManager().root;
  if (!r) return null;
  let id = null;
  SL.walk(r, (n) => { if (id === null && n.type === 'leaf' && !tabOf(n.tabId)) id = n.id; });
  return id;
}

/** ปิดแท็บ → ช่องที่ถืออยู่ต้องหายไปด้วย */
export function closeTabInSplit(tabId) {
  const sm = getSplitManager();
  if (!sm.root || !sm.has(tabId)) return;
  sm.close(tabId);
}

// ───────── ลากหัวแท็บไปวางในช่อง (ขอบ = แบ่งช่องใหม่ · กลาง = แทนที่) ─────────
export function makeTabSplitDraggable(strip) {
  if (!strip || strip._splitDrag) return;
  strip._splitDrag = true;
  strip.addEventListener('mousedown', (e) => {
    // รับได้ทั้งแถบแท็บรวม (#tabs > .tab) และแถบแท็บย่อยของแต่ละช่อง (.k-split-tabs > .k-mtab)
    const btn = e.target.closest('.tab, .k-mtab');
    if (!btn || e.button !== 0 ||
        e.target.classList.contains('tab-x') || e.target.classList.contains('k-mtab-x')) return;
    const file = fileOfTabBtn(btn);
    if (!file) return;
    const fromLeaf = btn.parentElement?.dataset?.leafId || null;
    const sx = e.clientX, sy = e.clientY;
    let moved = false, ghost = null, hit = null;
    const ov = dropOverlay();
    const move = (ev) => {
      if (!moved) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 8) return;
        moved = true;
        document.body.classList.add('k-panel-dragging');
        ghost = el('div', 'k-drag-ghost', btn.textContent.replace(/×$/, '').trim());
        document.body.appendChild(ghost);
      }
      ghost.style.left = (ev.clientX + 12) + 'px';
      ghost.style.top = (ev.clientY + 14) + 'px';
      hit = hitPane(ev.clientX, ev.clientY);
      if (hit) { ov.show(zoneRect(hit.rect, hit.zone), hit.zone); } else ov.hide();
    };
    const up = (ev) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      ov.hide(); ghost?.remove();
      document.body.classList.remove('k-panel-dragging');
      if (!moved) return;                            // คลิกเฉย ๆ → ปล่อยให้ onclick ทำงาน
      const sm = getSplitManager();
      if (hit) {
        if (hit.leafId === fromLeaf && hit.zone === 'center') return;   // ปล่อยที่ช่องเดิม = ไม่ทำอะไร
        if (hit.zone === 'center') sm.moveTab(file, hit.leafId, 'center');
        else sm.splitWith(file, hit.zone === 'left' ? 'left' : hit.zone === 'top' ? 'top'
                              : hit.zone === 'bottom' ? 'bottom' : 'right', hit.leafId);
        hooks.activate?.(file);
        return;
      }
      // ลากไปปล่อยกลางพื้นที่เอกสารตอนยังไม่ split → เปิดช่องใหม่ด้านขวา
      const panes = panesEl();
      if (!panes || isSplit()) return;
      const r = panes.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
      const cur = state.active?.file;
      if (!cur || cur === file) return;
      if (!sm.root) sm.open(cur);
      sm.splitWith(file, ev.clientX > r.left + r.width / 2 ? 'right' : 'left');
      hooks.activate?.(file);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function fileOfTabBtn(btn) {
  if (btn.dataset && btn.dataset.file) return btn.dataset.file;   // แท็บย่อยในช่อง (บั๊ก #12)
  for (const [f, t] of state.tabs) if (t.tabBtn === btn) return f;
  return null;
}

function hitPane(mx, my) {
  let best = null;
  for (const e of document.querySelectorAll('#panes .k-split-pane')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    const zone = SL.dropZone(mx, my, rect);
    if (!zone) continue;
    const area = r.width * r.height;
    if (!best || area < best.area) best = { leafId: e.dataset.leafId, zone, rect, area };
  }
  return best;
}
export function zoneRect(rect, zone) {
  const { x, y, w, h } = rect;
  switch (zone) {
    case 'left':   return { x, y, w: w / 2, h };
    case 'right':  return { x: x + w / 2, y, w: w / 2, h };
    case 'top':    return { x, y, w, h: h / 2 };
    case 'bottom': return { x, y: y + h / 2, w, h: h / 2 };
    default:       return { x, y, w, h };
  }
}
let _ov = null;
function dropOverlay() {
  if (_ov && _ov.el.isConnected) return _ov;
  const box = el('div', 'k-drop-zone');
  box.style.display = 'none';
  document.body.appendChild(box);
  _ov = {
    el: box,
    show(rect, zone) {
      box.dataset.zone = zone || '';
      box.style.left = Math.round(rect.x) + 'px';
      box.style.top = Math.round(rect.y) + 'px';
      box.style.width = Math.round(rect.w) + 'px';
      box.style.height = Math.round(rect.h) + 'px';
      box.style.display = 'block';
    },
    hide() { box.style.display = 'none'; },
  };
  return _ov;
}

// ───────── เริ่มระบบ / ล้าง ─────────
/** ผูกระบบ split เข้ากับ #panes + แถบแท็บ (เรียกครั้งเดียวตอน bootstrap) */
export function initSplitSystem(h) {
  setSplitHooks(h);
  getSplitManager();                                 // สร้าง + ผูก onChange → renderSplit
  makeTabSplitDraggable($('#tabs'));
  return mgr;
}

export function resetSplitSystem() {
  const panes = panesEl();
  reclaimPanes(panes);
  rootEl()?.remove();
  panes?.classList.remove('split', 'split-h');
  document.body.classList.remove('k-split-on');
  document.querySelectorAll('.pane').forEach((p) => p.classList.remove('compare-on', 'k-in-split'));
  document.querySelectorAll('.cmp-close').forEach((b) => b.remove());
  state.compareFile = null;
  if (mgr) { mgr.store.root = null; mgr.focusId = null; try { mgr.store.save(); } catch {} }
}

// ---- helpers เดิมที่โมดูล/เทสอื่นยังอ้าง ----
export function getSplitLayout() { return getSplitManager().root; }
export function getLeaves() {
  const r = getSplitManager().root;
  return r ? SL.leafIds(r).map((id) => SL.findLeaf(r, id)) : [];
}
export function setLeafTab(leafId, tabId) {
  const sm = getSplitManager();
  if (sm.root) sm.store.update(SL.setLeafTab(sm.root, leafId, tabId));
}
export function resetSplit() { resetSplitSystem(); renderSplit(); }
