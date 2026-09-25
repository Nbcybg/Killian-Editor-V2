// timeline-ui.js — เส้นเวลา (UI)
//
// [alpha.167] ยกเครื่องตามภาพอ้างอิงของผู้ใช้:
//   · มุมมอง "บอร์ด" (ภาพ 1) = แกนเวลาแนวนอน · การ์ดวางตามช่วงเวลาจริง · แถบสีซ้ายการ์ด · รูปตัวละคร ·
//     เส้นลูกศร "นำไปสู่" ระหว่างเหตุการณ์ · เส้นตั้งบอกตำแหน่งของฉากที่เปิดอยู่ · ลากเลื่อน/ยืดเวลาได้บนบอร์ด
//   · มุมมอง "รายการ" (ภาพ 2) = รางแนวตั้ง · ป้ายช่วงเวลา · แถวมีรูป/ชิปเวลา/ชิปเส้นเรื่อง
//   · ส่งออกได้: PNG · CSV · Markdown · HTML (หน้าเดียวเปิดในเบราว์เซอร์)
//   · หยิบใส่: ลากตัวละคร/ฉาก/โน้ตจาก Explorer ลงการ์ด = อ้างอิง · ลงที่ว่าง = เหตุการณ์ใหม่ ณ เวลานั้น
//
// เทสเดิมอ้างคลาส `.tl-event` · `.tl-lane` · `.tl-event-scene` · `.gantt-bar` · `.gantt-tick` · `.tl-ev-ref`
// ทุกตัวยังอยู่ (ความหมายเดิม: การ์ด · เลน · การ์ดฉาก · แท่งตามช่วงเวลา · ขีดแกน · ชิปอ้างอิง)
import { t, tf } from './i18n.js';
import { eventDialog, loadTimeline, openRef, openScene, saveTimeline, sceneEventsFromProject,
         mapImgURL, loadAllEntities, setSceneStoryDate } from './app.js';
import { $, el, state, setStatus, setStatusError, log } from './core.js';
import {
  findClashes, groupByTrack, mergeTimeline, newEvent, sortEvents, trackNames, normalizeRefs,
  eventSpan, replaceNum, timeUnitLabel, packRows, fitPxPerUnit, boardTicks, linkKey, normalizeLinks,
  addLink, removeLink, liveLinks, backwardLinks, elbowPath, timelineCsv, timelineMarkdown, timelineHtml,
} from './timeline.js';
import { renderFutureNotes, notesForScene, getFutureNotes } from './session-notes.js';
import { findScenePath } from './project-scan.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { gi } from './icons.js';
import { panelEmpty } from './panels/panel-chrome.js';
import { popupMenu, confirmBox } from './ui.js';
import { bindDropTarget } from './drop-kit.js';
import { failText } from './err-text.js';
import { PRINT } from './palette.js';

// ── ค่าเรขาคณิตของบอร์ด (พิกเซล) ──
// LANE_TOP = ที่ของป้ายชื่อเลน (ป้ายติดขอบซ้ายตอนเลื่อน) — เดิมป้ายทับขอบบนของการ์ดแถวแรก
const CARD_H = 58, ROW_GAP = 12, LANE_PAD = 14, LANE_TOP = 34, LANE_MIN = CARD_H + LANE_PAD + LANE_TOP;
const CARD_MIN_W = 190, AXIS_H = 40, PAD_X = 60;

/** วาดเส้นเวลาใหม่ถ้าแผงเปิดอยู่ (เรียกหลังเพิ่มโน้ต "ไว้ทำภายหลัง") */
export function refreshOpenTimeline() {
  if (isPanelOpen('timeline') && $('#tl-body')) renderTimeline($('#tl-body'));
}

// บั๊ก #18: เส้นเวลาเป็นแผง ไม่ใช่แท็บเอกสาร
export async function openTimeline() {
  showPanel('timeline');
  return renderTimeline($('#tl-body'));
}

/** มุมมองปัจจุบัน — ค่าเดิม 'cards' (การ์ดเรียงเลน) = รายการ · 'gantt' = บอร์ด */
function viewOf() {
  if (!state._tlView) state._tlView = 'gantt';
  return state._tlView === 'cards' ? 'list' : 'board';
}
const hidden = () => (state._tlHide instanceof Set ? state._tlHide : (state._tlHide = new Set()));

/** เก็บเฉพาะรายการที่ "เลือก" ไว้ระหว่างวาดใหม่ (เลือกการ์ดแล้วลาก/แก้ = วาดใหม่ทั้งบอร์ด) */
const sel = { key: null };

// ═══════════════════════ ตัวประกอบข้อมูล ═══════════════════════
async function loadAll() {
  const data = await loadTimeline();
  data.links = normalizeLinks(data.links);
  const sceneEvs = await sceneEventsFromProject();
  const items = mergeTimeline(data.events, sceneEvs);
  return { data, sceneEvs, items, knownTracks: trackNames(data.events, sceneEvs) };
}

/** รูปตัวละคร (อ้างอิงชนิด entity) → { rel → {name, url} } */
async function entityIndex(items) {
  const need = new Set();
  for (const it of items) for (const r of it.refs || []) if (r.kind === 'entity') need.add(r.path);
  const out = new Map();
  if (!need.size || !state.root) return out;
  try {
    for (const e of await loadAllEntities({ entitiesOnly: true })) {
      const rel = (await kapi.relative(state.root, e.file)).replace(/\\/g, '/');
      if (need.has(rel)) out.set(rel, { name: e.name, url: e.image ? mapImgURL('Images/' + e.image) : '' });
    }
  } catch (e) { log('warn', 'timeline: entity index failed', e); }
  return out;
}

/** เหตุการณ์ของผู้ใช้ (ไม่ใช่ฉาก) ตาม id */
const evOf = (data, id) => (data.events || []).find((e) => e.id === id) || null;

// ═══════════════════════ แผงหลัก ═══════════════════════
export async function renderTimeline(pane) {
  if (!pane) return;
  const keep = pane.querySelector('.tl-board2');
  const scroll = keep ? { l: keep.scrollLeft, t: keep.scrollTop } : null;
  pane.innerHTML = '';
  const wrap = el('div', 'tl-wrap tl2'); pane.append(wrap);
  const view = viewOf();

  // ── หัว: ชื่อ · เพิ่ม · สลับมุมมอง · ซูม · ส่งออก ──
  const head = el('div', 'tl-head');
  head.append(el('div', 'tl-title', t('ui.timeline.lineTime')));
  const addBtn = el('button', 'k-ok', t('ui.timeline.addEvent'));
  addBtn.title = t('ui.timeline.addEventTip');
  head.append(addBtn);
  const viewTog = el('div', 'tl-viewtog');
  const mkView = (id, label, tip) => {
    const b = el('button', 'tl-viewbtn' + (view === id ? ' on' : ''), label);
    b.title = tip;
    b.onclick = () => { state._tlView = id === 'list' ? 'cards' : 'gantt'; renderTimeline(pane); };
    viewTog.append(b);
  };
  mkView('board', gi('gantt') + ' ' + t('ui.timeline.viewBoard'), t('ui.timeline.viewBoardTip'));
  mkView('list', gi('list-ul') + ' ' + t('ui.timeline.viewList'), t('ui.timeline.viewListTip'));
  head.append(viewTog);
  const zoomBox = el('div', 'tl-zoom');
  if (view === 'board') head.append(zoomBox);
  const expBtn = el('button', 'cmp-mini tl-export-btn', gi('download') + ' ' + t('ui.timeline.export'));
  expBtn.title = t('ui.timeline.exportTip');
  expBtn.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 4, exportMenuItems());
  };
  head.append(expBtn);
  wrap.append(head);

  // ── โน้ต "ไว้ทำภายหลัง" (ข้อ 85) ──
  const fn = el('div', 'tl-future');
  renderFutureNotes(fn, {
    onChanged: () => renderTimeline(pane),
    onOpenScene: async (sceneId, title) => {
      const hit = await findScenePath(state.root, sceneId);
      if (hit && (await kapi.exists(hit.path))) openScene(hit.path, hit.title || title);
    },
  });
  if (getFutureNotes().length) wrap.append(fn);

  const all = await loadAll();
  const { data, knownTracks } = all;
  const tracksAll = groupByTrack(all.items);
  const hide = hidden();
  const items = all.items.filter((it) => !hide.has(it.track || t('ui.common.msg4')));
  const ctx = { pane, wrap, data, items, all: all.items, knownTracks, redraw: () => renderTimeline(pane) };

  addBtn.onclick = () => addEventAt(ctx, null, '');

  // ── ป้ายนับตามเส้นเรื่อง (ภาพ 2) — คลิก = ซ่อน/แสดงเส้นเรื่องนั้น ──
  if (tracksAll.length) {
    const stats = el('div', 'tl-stats');
    for (const tr of tracksAll) {
      const off = hide.has(tr.name);
      const b = el('button', 'tl-stat' + (off ? ' off' : ''));
      b.style.setProperty('--tl-c', tr.color);
      b.append(el('span', 'tl-stat-n', String(tr.items.length)), el('span', 'tl-stat-name', tr.name));
      b.title = off ? tf('ui.timeline.trackShow', tr.name) : tf('ui.timeline.trackHide', tr.name);
      b.onclick = () => { if (off) hide.delete(tr.name); else hide.add(tr.name); renderTimeline(pane); };
      stats.append(b);
    }
    wrap.append(stats);
  }

  if (!all.items.length) {
    wrap.append(panelEmpty(t('ui.timeline.notHasEventPress')));
    bindEmptyDrop(ctx, wrap);
    return;
  }

  ctx.entities = await entityIndex(all.items);
  ctx.clashIds = new Set(findClashes(items).flat().map((x) => x.id));
  ctx.links = liveLinks(data.links, all.items);
  ctx.back = new Set(backwardLinks(ctx.links, all.items).map((l) => l.from + '>' + l.to));

  if (view === 'list') renderList(ctx);
  else renderBoard(ctx, zoomBox, scroll);

  const clashes = findClashes(items);
  if (clashes.length) wrap.append(el('div', 'tl-clash-note', tf('ui.timeline.hasDotEventTime', clashes.length)));
  if (ctx.back.size) wrap.append(el('div', 'tl-clash-note', tf('ui.timeline.backLinks', ctx.back.size)));
}

// ═══════════════════════ การกระทำร่วม ═══════════════════════
async function addEventAt(ctx, when, track, refs = []) {
  const ev = newEvent(when == null ? '' : String(when));
  ev.track = track || '';
  ev.refs = normalizeRefs(refs);
  const res = await eventDialog(ev, ctx.knownTracks);
  if (!res) return;
  const data = await loadTimeline();
  data.events = [...(data.events || []), res];
  await saveTimeline(data);
  sel.key = res.id;
  ctx.redraw();
}

async function editItem(ctx, it) {
  if (it.kind === 'scene') { if (it.file) openScene(it.file, it.title); return; }
  const data = await loadTimeline();
  const idx = (data.events || []).findIndex((e) => e.id === it.id);
  if (idx < 0) return;
  const res = await eventDialog({ ...data.events[idx] }, ctx.knownTracks, true);
  if (res === 'DELETE') {
    data.events.splice(idx, 1);
    data.links = normalizeLinks(data.links).filter((l) => l.from !== it.id && l.to !== it.id);
    await saveTimeline(data); ctx.redraw(); return;
  }
  if (res) { data.events[idx] = res; await saveTimeline(data); ctx.redraw(); }
}

/** เปลี่ยนเวลา (ลากบนบอร์ด / ถาดยังไม่ระบุเวลา) — เหตุการณ์เขียน timeline.json · ฉากเขียน frontmatter + ดัชนี */
async function setItemTime(it, start, end) {
  const when = replaceNum(it.when, start);
  if (it.kind === 'scene') {
    const ok = await setSceneStoryDate(it, when);
    if (!ok) setStatusError(t('ui.timeline.sceneTimeFail'));
    return ok;
  }
  const data = await loadTimeline();
  const ev = evOf(data, it.id);
  if (!ev) return false;
  ev.when = when;
  if (end != null && end > start) ev.whenEnd = replaceNum(ev.whenEnd || it.when, end);
  else if (end != null && ev.whenEnd) ev.whenEnd = replaceNum(ev.whenEnd, Math.max(start, end));
  await saveTimeline(data);
  return true;
}

/** เพิ่มอ้างอิงลงเหตุการณ์ (หยิบใส่การ์ด) — ฉากที่อยู่บนเส้นเวลาเองรับอ้างอิงไม่ได้ (เก็บใน frontmatter ไม่มีช่องนี้) */
async function addRefs(ctx, it, payload) {
  if (it.kind !== 'event') { setStatus(t('ui.timeline.dropSceneNoRef')); return false; }
  const refs = await refsFromPayload(payload);
  if (!refs.length) return false;
  const data = await loadTimeline();
  const ev = evOf(data, it.id);
  if (!ev) return false;
  ev.refs = normalizeRefs([...(ev.refs || []), ...refs]);
  await saveTimeline(data);
  setStatus(tf('ui.timeline.refAdded', refs.map((r) => r.title).join(', '), ev.title || ''));
  ctx.redraw();
  return true;
}

async function refsFromPayload(payload) {
  const out = [];
  for (const it of payload.items || []) {
    if (!it.path || !state.root) continue;
    const kind = payload.kind === 'entity' ? 'entity' : payload.kind === 'memo' ? 'memo' : 'scene';
    const rel = (await kapi.relative(state.root, it.path)).replace(/\\/g, '/');
    out.push({ kind, path: rel, title: it.title || rel.split('/').pop() });
  }
  return out;
}

async function linkItems(ctx, fromKey, toKey) {
  const data = await loadTimeline();
  const before = normalizeLinks(data.links).length;
  data.links = addLink(data.links, fromKey, toKey);
  if (data.links.length === before) { setStatus(t('ui.timeline.linkExists')); return; }
  await saveTimeline(data);
  setStatus(t('ui.timeline.linkAdded'));
  ctx.redraw();
}
async function unlinkItems(ctx, from, to) {
  const data = await loadTimeline();
  data.links = removeLink(data.links, from, to);
  await saveTimeline(data);
  ctx.redraw();
}

function cardMenu(ctx, it, x, y) {
  const key = linkKey(it);
  const outs = ctx.links.filter((l) => l.from === key || l.to === key);
  const byKey = new Map(ctx.all.map((i) => [linkKey(i), i]));
  popupMenu(x, y, [
    { label: '<b>' + escHtml(it.title || t('ui.common.notNamed')) + '</b>', disabled: true },
    { label: it.kind === 'scene' ? t('ui.timeline.openScene') : t('ui.timeline.editEvent'), click: () => editItem(ctx, it) },
    { label: t('ui.timeline.linkFromHere'), click: () => startLinkPick(ctx, it) },
    outs.length ? { label: t('ui.timeline.unlink'), sub: outs.map((l) => ({
      label: escHtml((byKey.get(l.from) || {}).title || '?') + ' → ' + escHtml((byKey.get(l.to) || {}).title || '?'),
      click: () => unlinkItems(ctx, l.from, l.to) })) } : null,
    ...(it.refs || []).length ? [{ label: t('ui.timeline.refsMenu'), sub: it.refs.map((r) => ({
      label: escHtml(r.title), click: () => openRef(r) })) }] : [],
    it.kind === 'event' ? '-' : null,
    it.kind === 'event' ? { label: t('ui.common.del'), danger: true, click: async () => {
      if (!(await confirmBox(tf('ui.timeline.delEventQ', it.title || ''), t('ui.common.del')))) return;
      const data = await loadTimeline();
      data.events = (data.events || []).filter((e) => e.id !== it.id);
      data.links = normalizeLinks(data.links).filter((l) => l.from !== it.id && l.to !== it.id);
      await saveTimeline(data); ctx.redraw();
    } } : null,
  ].filter(Boolean));
}
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** โหมด "เชื่อมต่อจากการ์ดนี้" — คลิกการ์ดถัดไปเพื่อเลือกปลายทาง · Esc ยกเลิก */
function startLinkPick(ctx, it) {
  ctx.wrap.classList.add('tl-linking');
  setStatus(tf('ui.timeline.linkPickHint', it.title || ''));
  const done = () => { ctx.wrap.classList.remove('tl-linking'); document.removeEventListener('keydown', onKey, true); ctx.wrap.removeEventListener('click', onClick, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(); setStatus(t('ui.timeline.linkCancel')); } };
  const onClick = (e) => {
    const card = e.target.closest && e.target.closest('.tl-event');
    e.preventDefault(); e.stopPropagation();
    done();
    if (card && card.dataset.key && card.dataset.key !== linkKey(it)) linkItems(ctx, linkKey(it), card.dataset.key);
  };
  document.addEventListener('keydown', onKey, true);
  ctx.wrap.addEventListener('click', onClick, true);
}

/** ไอคอนแถวแทนรูป — ฉาก/เหตุการณ์ */
function avatarsOf(ctx, it, max = 3) {
  const box = el('span', 'tl-avatars');
  const ents = (it.refs || []).filter((r) => r.kind === 'entity');
  for (const r of ents.slice(0, max)) {
    const info = ctx.entities && ctx.entities.get(r.path);
    const a = el('span', 'tl-av');
    a.title = (info && info.name) || r.title;
    if (info && info.url) { const im = el('img'); im.src = info.url; im.alt = ''; im.draggable = false; a.append(im); }
    else a.textContent = String((info && info.name) || r.title || '?').trim().slice(0, 1);
    box.append(a);
  }
  if (ents.length > max) box.append(el('span', 'tl-av tl-av-more', '+' + (ents.length - max)));
  return box;
}

/** ชิปอ้างอิงที่ไม่ใช่ตัวละคร (ฉาก/โน้ต) — คลิกเปิด */
function refChips(it) {
  const other = (it.refs || []).filter((r) => r.kind !== 'entity');
  if (!other.length) return null;
  const rw = el('div', 'tl-ev-refs');
  for (const r of other) {
    const chip = el('span', 'tl-ev-ref', (r.kind === 'memo' ? gi('note') : gi('file')) + ' ' + r.title);
    chip.title = t('ui.timeline.open') + r.path;
    chip.onclick = (e) => { e.stopPropagation(); openRef(r); };
    rw.append(chip);
  }
  return rw;
}

function sceneNotes(it) {
  if (it.kind !== 'scene') return null;
  const notes = notesForScene(String(it.id || '').split(':').pop());
  if (!notes.length) return null;
  const b = el('div', 'tl-ev-notes', gi('note') + ' ' + notes.length + t('ui.timeline.note'));
  b.title = notes.map((n) => '• ' + n.text).join('\n');
  return b;
}

/** ฉากที่เปิดอยู่ (เส้นตั้ง "ตอนนี้") */
function activeSceneItem(items) {
  const f = state.active && state.active.file;
  if (!f) return null;
  return items.find((it) => it.kind === 'scene' && it.file === f) || null;
}

function bindEmptyDrop(ctx, host) {
  bindDropTarget(host, {
    accept: ['entity', 'scene', 'memo'],
    onDrop: async (payload) => addEventAt(ctx, null, '', await refsFromPayload(payload)),
  });
}

// ═══════════════════════ มุมมองบอร์ด (ภาพ 1) ═══════════════════════
function renderBoard(ctx, zoomBox, keepScroll) {
  const { wrap, items } = ctx;
  const dated = [], undated = [];
  for (const it of items) (eventSpan(it) ? dated : undated).push(it);

  const board = el('div', 'tl-board2');
  board.tabIndex = 0;
  board.setAttribute('aria-label', t('ui.timeline.boardLabel'));
  wrap.append(board);

  if (!dated.length) {
    board.append(panelEmpty(t('ui.timeline.viewGanttMustHas')));
  }

  let min = Infinity, max = -Infinity;
  for (const it of dated) { const s = eventSpan(it); if (s.start < min) min = s.start; if (s.end > max) max = s.end; }
  if (!dated.length) { min = 0; max = 10; }
  if (min === max) { min -= 1; max += 1; }
  const viewW = Math.max(400, (ctx.pane.clientWidth || 900) - 20);
  const fit = fitPxPerUnit(min, max, viewW, PAD_X);
  const ppu = state._tlPpu > 0 ? state._tlPpu : fit;
  const X = (v) => PAD_X + (v - min) * ppu;
  const V = (px) => min + (px - PAD_X) / ppu;
  const W = Math.max(viewW, X(max) + PAD_X + CARD_MIN_W);
  const unit = timeUnitLabel(items);
  // ขั้นของการลาก: ราว ๆ 8px ต่อขั้น ปัดเป็น 1-2-5
  const snapUnit = (() => {
    const raw = 8 / ppu, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const s = (raw / mag > 5 ? 10 : raw / mag > 2 ? 5 : raw / mag > 1 ? 2 : 1) * mag;
    return Math.max(s, 1e-3);
  })();
  const snap = (v) => Math.round(v / snapUnit) * snapUnit;

  // ── ซูม ──
  const zOut = el('button', 'cmp-mini', gi('minus-thick')); zOut.title = t('ui.timeline.zoomOut');
  const zIn = el('button', 'cmp-mini', gi('plus-thick')); zIn.title = t('ui.timeline.zoomIn');
  const zFit = el('button', 'cmp-mini', t('ui.common.fitScreen')); zFit.title = t('ui.timeline.zoomFit');
  const zoomTo = (p) => { state._tlPpu = Math.max(fit / 8, Math.min(fit * 40, p)); ctx.redraw(); };
  zOut.onclick = () => zoomTo(ppu / 1.4);
  zIn.onclick = () => zoomTo(ppu * 1.4);
  zFit.onclick = () => { state._tlPpu = 0; ctx.redraw(); };
  zoomBox.append(zOut, zIn, zFit);

  // ── แกนเวลา (ติดขอบบนตอนเลื่อน) ──
  const canvas = el('div', 'tl-canvas'); canvas.style.width = W + 'px';
  const axis = el('div', 'tl-axis gantt-axis');
  axis.style.width = W + 'px';
  if (unit) axis.append(el('span', 'tl-axis-unit', unit));
  const ticks = boardTicks(min, max, W - PAD_X * 2);
  for (const tk of ticks) {
    const n = el('div', 'gantt-tick tl-tick', String(tk.value));
    n.style.left = X(tk.value) + 'px';
    axis.append(n);
  }
  canvas.append(axis);
  const body = el('div', 'tl-body2');
  canvas.append(body);
  board.append(canvas);

  // เส้นกริดแนวตั้งของขีด
  for (const tk of ticks) {
    const g = el('div', 'tl-gridline'); g.style.left = X(tk.value) + 'px'; body.append(g);
  }

  // ── เลน + การ์ด ──
  const pos = new Map();                         // key → {x0,x1,y}
  let y = 0;
  const tracks = groupByTrack(dated);
  for (const tr of tracks) {
    const rows = tr.items.map((it) => {
      const s = eventSpan(it);
      const x = X(s.start);
      return { id: linkKey(it), it, x, w: Math.max(CARD_MIN_W, X(s.end) - x) };
    });
    const pk = packRows(rows, ROW_GAP);
    const nRows = Math.max(1, ...[...pk.values()].map((v) => v + 1));
    const laneH = Math.max(LANE_MIN, LANE_TOP + LANE_PAD + nRows * CARD_H + (nRows - 1) * ROW_GAP);
    // ชื่อเส้นเรื่องจริงของเลน ('' = เลนตั้งต้น) — ห้ามเทียบกับป้ายที่แปลแล้ว (กฎ W6)
    const trackVal = (tr.items[0] && tr.items[0].track) || '';
    const lane = el('div', 'tl-lane gantt-row');
    lane.style.top = y + 'px'; lane.style.height = laneH + 'px';
    lane.dataset.track = tr.name;
    const lbl = el('div', 'tl-lane-label');
    const dot = el('span', 'tl-lane-dot'); dot.style.background = tr.color;
    lbl.append(dot, el('span', 'tl-lane-name', tr.name), el('span', 'tl-lane-count', String(tr.items.length)));
    lane.append(lbl);
    body.append(lane);
    // ลากของมาลงที่ว่างของเลน = เหตุการณ์ใหม่ ณ เวลาตรงนั้น ในเส้นเรื่องนี้
    bindDropTarget(lane, {
      accept: ['entity', 'scene', 'memo'],
      when: (e) => !(e.target.closest && e.target.closest('.tl-event')),
      onDrop: async (payload, e) => {
        const r = body.getBoundingClientRect();
        const at = snap(V(e.clientX - r.left));
        await addEventAt(ctx, (unit ? unit + ' ' : '') + at, trackVal,
                         await refsFromPayload(payload));
      },
    });
    lane.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tl-event')) return;
      const r = body.getBoundingClientRect();
      addEventAt(ctx, (unit ? unit + ' ' : '') + snap(V(e.clientX - r.left)), trackVal);
    });
    for (const r of rows) {
      const top = y + LANE_TOP + pk.get(r.id) * (CARD_H + ROW_GAP);
      const card = buildCard(ctx, r.it, tr.color);
      card.style.left = r.x + 'px'; card.style.top = top + 'px'; card.style.width = r.w + 'px';
      body.append(card);
      pos.set(r.id, { x0: r.x, x1: r.x + r.w, y: top + CARD_H / 2, card, it: r.it });
      bindCardDrag(ctx, card, r.it, { X, V, snap, ppu, min });
    }
    y += laneH;
  }
  body.style.height = Math.max(y, 120) + 'px';

  // ── เส้นเชื่อม (อยู่ใต้การ์ด) ──
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'tl-links');
  svg.setAttribute('width', String(W)); svg.setAttribute('height', String(Math.max(y, 120)));
  const defs = document.createElementNS(NS, 'defs');
  const mk = document.createElementNS(NS, 'marker');
  mk.setAttribute('id', 'tl-arrow'); mk.setAttribute('viewBox', '0 0 8 8'); mk.setAttribute('refX', '7'); mk.setAttribute('refY', '4');
  mk.setAttribute('markerWidth', '7'); mk.setAttribute('markerHeight', '7'); mk.setAttribute('orient', 'auto');
  const tip = document.createElementNS(NS, 'path'); tip.setAttribute('d', 'M0,0 L8,4 L0,8 Z'); tip.setAttribute('class', 'tl-arrow');
  mk.append(tip); defs.append(mk); svg.append(defs);
  for (const l of ctx.links) {
    const a = pos.get(l.from), b = pos.get(l.to);
    if (!a || !b) continue;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', elbowPath({ x: a.x1, y: a.y }, { x: b.x0, y: b.y }));
    p.setAttribute('class', 'tl-link' + (ctx.back.has(l.from + '>' + l.to) ? ' tl-link-back' : ''));
    p.setAttribute('marker-end', 'url(#tl-arrow)');
    p.style.setProperty('--tl-c', a.card.style.getPropertyValue('--tl-c') || '');
    const title = document.createElementNS(NS, 'title');
    title.textContent = (a.it.title || '') + ' → ' + (b.it.title || '');
    p.append(title);
    p.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      popupMenu(e.clientX, e.clientY, [{ label: t('ui.timeline.unlinkThis'), danger: true, click: () => unlinkItems(ctx, l.from, l.to) }]);
    });
    svg.append(p);
  }
  body.prepend(svg);

  // ── เส้นตั้ง "ฉากที่เปิดอยู่" ──
  const cur = activeSceneItem(dated);
  if (cur) {
    const s = eventSpan(cur);
    const now = el('div', 'tl-now'); now.style.left = X(s.start) + 'px';
    now.title = tf('ui.timeline.nowLine', cur.title || '');
    body.append(now);
    const knob = el('div', 'tl-now-knob'); knob.style.left = X(s.start) + 'px';
    knob.title = now.title;
    axis.append(knob);
  }

  // ── ซูมด้วย Ctrl+ล้อ (ยึดจุดใต้เมาส์) ──
  board.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = board.getBoundingClientRect();
    const mx = e.clientX - r.left + board.scrollLeft;
    const vAt = V(mx);
    const next = Math.max(fit / 8, Math.min(fit * 40, ppu * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    state._tlPpu = next;
    state._tlAnchor = { v: vAt, px: e.clientX - r.left, min };
    ctx.redraw();
  }, { passive: false });

  // ── คีย์บอร์ดบนบอร์ด (ตัวดักของบอร์ดเอง — กฎข้อ 8) ──
  board.addEventListener('keydown', async (e) => {
    const card = board.querySelector('.tl-event.sel');
    if (!card) return;
    const it = pos.get(card.dataset.key) && pos.get(card.dataset.key).it;
    if (!it) return;
    if (e.key === 'Enter') { e.preventDefault(); editItem(ctx, it); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey) {
      e.preventDefault();
      const s = eventSpan(it); const d = (e.key === 'ArrowLeft' ? -1 : 1) * snapUnit;
      if (await setItemTime(it, s.start + d, s.end !== s.start ? s.end + d : null)) ctx.redraw();
    } else if (e.key === 'Delete' && it.kind === 'event') {
      e.preventDefault();
      cardMenu(ctx, it, card.getBoundingClientRect().left, card.getBoundingClientRect().bottom);
    }
  });

  // ── ถาด "ยังไม่ระบุเวลา" — ลากชิปขึ้นบอร์ด = ตั้งเวลา ──
  if (undated.length) {
    const tray = el('div', 'tl-tray');
    tray.append(el('span', 'tl-tray-title', tf('ui.timeline.undatedTray', undated.length)));
    for (const it of undated) {
      const chip = el('span', 'tl-tray-chip tl-event' + (it.kind === 'scene' ? ' tl-event-scene' : ''),
        (it.kind === 'scene' ? gi('file') : gi('time')) + ' ' + (it.title || t('ui.common.notNamed')));
      chip.dataset.key = linkKey(it);
      chip.title = t('ui.timeline.undatedChipTip');
      chip.ondblclick = () => editItem(ctx, it);
      chip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const ghost = el('div', 'tl-ghost', chip.textContent); document.body.append(ghost);
        const mv = (ev) => { ghost.style.left = (ev.clientX + 10) + 'px'; ghost.style.top = (ev.clientY + 8) + 'px'; };
        mv(e);
        const up = async (ev) => {
          window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
          ghost.remove();
          const r = body.getBoundingClientRect();
          if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top - AXIS_H || ev.clientY > r.bottom) return;
          if (await setItemTime(it, snap(V(ev.clientX - r.left)), null)) ctx.redraw();
        };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      tray.append(chip);
    }
    wrap.append(tray);
  }
  wrap.append(el('div', 'tl-hint', t('ui.timeline.boardHint')));

  // คืนตำแหน่งเลื่อน (หรือยึดจุดใต้เมาส์หลังซูม)
  requestAnimationFrame(() => {
    const a = state._tlAnchor;
    if (a && a.min === min) { board.scrollLeft = Math.max(0, X(a.v) - a.px); state._tlAnchor = null; if (keepScroll) board.scrollTop = keepScroll.t; }
    else if (keepScroll) { board.scrollLeft = keepScroll.l; board.scrollTop = keepScroll.t; }
    else if (cur) board.scrollLeft = Math.max(0, X(eventSpan(cur).start) - board.clientWidth / 2);
  });
}

function buildCard(ctx, it, laneColor) {
  const key = linkKey(it);
  const color = it.color || laneColor;
  const card = el('div', 'tl-event gantt-bar tl-card' + (it.kind === 'scene' ? ' tl-event-scene gantt-bar-scene' : '')
                  + (ctx.clashIds.has(it.id) ? ' tl-clash' : '') + (sel.key === key ? ' sel' : ''));
  card.dataset.key = key;
  card.style.setProperty('--tl-c', color);
  const stripe = el('span', 'tl-card-stripe');
  const main = el('div', 'tl-card-main');
  main.append(el('div', 'tl-ev-title', (it.kind === 'scene' ? gi('file') + ' ' : '') + (it.title || t('ui.common.notNamed'))));
  const sub = el('div', 'tl-card-sub');
  const when = (it.when || '') + (it.whenEnd ? ' → ' + it.whenEnd : '');
  sub.append(el('span', 'tl-when', when));
  const firstRef = (it.refs || []).find((r) => r.kind !== 'entity');
  if (firstRef) {
    const chip = el('span', 'tl-ev-ref tl-sub-ref', gi('arrow-branch') + ' ' + firstRef.title);
    chip.title = t('ui.timeline.open') + firstRef.path;
    chip.onclick = (e) => { e.stopPropagation(); openRef(firstRef); };
    sub.append(chip);
  } else if (it.track) sub.append(el('span', 'tl-card-track', gi('arrow-branch') + ' ' + it.track));
  main.append(sub);
  const notes = sceneNotes(it);
  if (notes) main.append(notes);
  card.append(stripe, main, avatarsOf(ctx, it));
  const menu = el('button', 'tl-card-menu', gi('dots-vertical'));
  menu.title = t('ui.timeline.cardMenu');
  menu.onclick = (e) => { e.stopPropagation(); const r = menu.getBoundingClientRect(); cardMenu(ctx, it, r.left, r.bottom + 2); };
  card.append(menu);
  // จุดลากเส้นเชื่อม (ขวาการ์ด) + ที่จับยืดเวลา (เหตุการณ์เท่านั้น — ฉากมีเวลาจุดเดียว)
  const dotL = el('span', 'tl-link-dot'); dotL.title = t('ui.timeline.linkDotTip');
  card.append(dotL);
  if (it.kind === 'event') {
    const hL = el('span', 'tl-handle tl-handle-l'); hL.title = t('ui.timeline.handleStart');
    const hR = el('span', 'tl-handle tl-handle-r'); hR.title = t('ui.timeline.handleEnd');
    card.append(hL, hR);
  }
  card.title = [it.title, when, it.desc ? String(it.desc).slice(0, 160) : '',
    (it.refs || []).map((r) => gi('link') + ' ' + r.title).join('\n')].filter(Boolean).join('\n');
  card.oncontextmenu = (e) => { e.preventDefault(); cardMenu(ctx, it, e.clientX, e.clientY); };
  card.ondblclick = (e) => { e.stopPropagation(); editItem(ctx, it); };
  // หยิบใส่: ลากตัวละคร/ฉาก/โน้ตลงการ์ด = อ้างอิง
  bindDropTarget(card, { accept: ['entity', 'scene', 'memo'], onDrop: (payload) => addRefs(ctx, it, payload) });
  return card;
}

/** ลากการ์ด: ตัวการ์ด = เลื่อนเวลา · ที่จับซ้าย/ขวา = ยืด · จุดขวา = ลากเส้นเชื่อม · คลิก = เลือก · Ctrl+คลิก = เปิด */
function bindCardDrag(ctx, card, it, g) {
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.tl-card-menu, .tl-ev-ref')) return;
    const board = card.closest('.tl-board2');
    board && board.focus({ preventScroll: true });
    const s0 = eventSpan(it);
    const mode = e.target.classList.contains('tl-handle-l') ? 'l'
               : e.target.classList.contains('tl-handle-r') ? 'r'
               : e.target.classList.contains('tl-link-dot') ? 'link' : 'move';
    if (mode === 'move' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); editItem(ctx, it); return; }
    // เลือก
    ctx.wrap.querySelectorAll('.tl-event.sel').forEach((n) => n.classList.remove('sel'));
    card.classList.add('sel'); sel.key = card.dataset.key;
    if (mode === 'link') return linkDrag(ctx, card, it, e);
    const ox = e.clientX;
    const left0 = parseFloat(card.style.left), w0 = parseFloat(card.style.width);
    let moved = false, nStart = s0.start, nEnd = s0.end;
    const mv = (ev) => {
      const dx = ev.clientX - ox;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true; card.classList.add('dragging');
      const du = g.snap(dx / g.ppu);
      if (mode === 'move') {
        nStart = s0.start + du; nEnd = s0.end + du;
        card.style.left = (left0 + du * g.ppu) + 'px';
      } else if (mode === 'r') {
        nEnd = Math.max(s0.start, s0.end + du);
        card.style.width = Math.max(40, w0 + (nEnd - s0.end) * g.ppu) + 'px';
      } else {
        nStart = Math.min(s0.end, s0.start + du);
        card.style.left = (left0 + (nStart - s0.start) * g.ppu) + 'px';
        card.style.width = Math.max(40, w0 - (nStart - s0.start) * g.ppu) + 'px';
      }
      card.dataset.drag = (nStart === nEnd ? String(nStart) : nStart + ' → ' + nEnd);
    };
    const up = async () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      card.classList.remove('dragging');
      if (!moved) return;
      const hasEnd = mode !== 'move' ? true : s0.end !== s0.start;
      if (await setItemTime(it, nStart, hasEnd ? nEnd : null)) ctx.redraw();
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}

function linkDrag(ctx, card, it, e) {
  e.preventDefault();
  const body = card.closest('.tl-body2');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = body.querySelector('svg.tl-links');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('class', 'tl-link tl-link-live');
  svg.append(p);
  const br = () => body.getBoundingClientRect();
  const a = { x: parseFloat(card.style.left) + parseFloat(card.style.width), y: parseFloat(card.style.top) + CARD_H / 2 };
  const mv = (ev) => {
    const r = br();
    p.setAttribute('d', `M${a.x},${a.y} L${ev.clientX - r.left},${ev.clientY - r.top}`);
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    p.remove();
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const to = hit && hit.closest && hit.closest('.tl-event');
    if (to && to.dataset.key && to !== card) linkItems(ctx, linkKey(it), to.dataset.key);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

// ═══════════════════════ มุมมองรายการ (ภาพ 2) ═══════════════════════
function renderList(ctx) {
  const { wrap, items } = ctx;
  const list = el('div', 'tl-list');
  wrap.append(list);
  const tracks = groupByTrack(items);
  const colorOf = new Map(tracks.map((tr) => [tr.name, tr.color]));
  // จัดกลุ่มตาม "ช่วง" = ข้อความเวลาเดียวกัน (เรียงตามเวลาแล้ว) — ป้ายช่วงอยู่บนราง
  let lane = null, lastWhen = null;
  for (const it of sortEvents(items)) {
    const w = it.when || t('ui.common.notSpecifyTime');
    if (w !== lastWhen) {
      lastWhen = w;
      lane = el('div', 'tl-lane tl-list-group');
      lane.append(el('div', 'tl-era', w));
      list.append(lane);
    }
    const tname = it.track || t('ui.common.msg4');
    const row = el('div', 'tl-event tl-row' + (it.kind === 'scene' ? ' tl-event-scene' : '') + (ctx.clashIds.has(it.id) ? ' tl-clash' : ''));
    row.dataset.key = linkKey(it);
    row.style.setProperty('--tl-c', it.color || colorOf.get(tname) || '');
    const av = el('div', 'tl-row-av');
    const ents = avatarsOf(ctx, it, 1);
    if (ents.childNodes.length) av.append(ents.firstChild);
    else av.append(el('span', 'tl-row-ic', it.kind === 'scene' ? gi('file') : gi('time')));
    const main = el('div', 'tl-row-main');
    main.append(el('div', 'tl-ev-title', it.title || t('ui.common.notNamed')));
    const meta = el('div', 'tl-row-meta');
    meta.append(el('span', 'tl-chip tl-when', gi('time') + ' ' + (it.when || t('ui.common.notSpecifyTime'))
      + (it.whenEnd ? ' → ' + it.whenEnd : '')));
    const tc = el('span', 'tl-chip tl-chip-track', tname);
    meta.append(tc);
    main.append(meta);
    if (it.desc) main.append(el('div', 'tl-ev-desc', it.desc));
    const chips = refChips(it); if (chips) main.append(chips);
    const notes = sceneNotes(it); if (notes) main.append(notes);
    const more = avatarsOf(ctx, it, 4);
    row.append(av, main, more);
    row.classList.add('tl-clickable');
    row.title = it.kind === 'scene' ? t('ui.timeline.clickOpenScene') : t('ui.timeline.clickEditEvent');
    row.onclick = (e) => { if (e.target.closest('.tl-ev-ref')) return; editItem(ctx, it); };
    row.oncontextmenu = (e) => { e.preventDefault(); cardMenu(ctx, it, e.clientX, e.clientY); };
    bindDropTarget(row, { accept: ['entity', 'scene', 'memo'], onDrop: (payload) => addRefs(ctx, it, payload) });
    lane.append(row);
  }
  bindEmptyDrop(ctx, list);
}

// ═══════════════════════ ส่งออก ═══════════════════════
function exportMenuItems() {
  return [
    { label: t('ui.timeline.exportPng'), click: () => exportTimeline('png') },
    { label: t('ui.timeline.exportHtml'), click: () => exportTimeline('html') },
    { label: t('ui.timeline.exportMd'), click: () => exportTimeline('md') },
    { label: t('ui.timeline.exportCsv'), click: () => exportTimeline('csv') },
  ];
}
export { exportMenuItems as timelineExportItems };

const safeName = (s) => String(s || 'timeline').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'timeline';

/** ส่งออกเส้นเวลา — `outPath` ใช้ในเทส (ไม่เปิดกล่องบันทึก) · คืนทางไฟล์ที่เขียน หรือ null */
export async function exportTimeline(fmt, outPath) {
  try {
    if (!state.root) { setStatus(t('ui.common.openProjectBefore')); return null; }
    const { data, items } = await loadAll();
    if (!items.length) { setStatus(t('ui.timeline.exportEmpty')); return null; }
    const base = safeName((state.meta && state.meta.title) || state.title) + '-timeline.' + fmt;
    const L = { title: t('ui.timeline.lineTime'), undated: t('ui.timeline.undated'), links: t('ui.timeline.linksHead'),
                defaultTrack: t('ui.common.msg4'), lang: (document.documentElement.lang || 'th') };
    const dest = outPath || await kapi.saveAsDialog(base, fmt);
    if (!dest) return null;
    const links = liveLinks(data.links, items);
    if (fmt === 'png') {
      const cv = drawTimelineCanvas(items, links, L);
      const bin = atob(cv.toDataURL('image/png').split(',')[1] || '');
      const bytes = new Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await kapi.writeBytes(dest, bytes);
    } else {
      const text = fmt === 'csv' ? timelineCsv(items, [t('ui.timeline.colTitle'), t('ui.timeline.colWhen'), t('ui.timeline.colWhenEnd'),
                                   t('ui.timeline.colTrack'), t('ui.timeline.colKind'), t('ui.timeline.colDesc'), t('ui.timeline.colRefs')])
                 : fmt === 'md' ? timelineMarkdown(items, links, L)
                 : timelineHtml(items, links, L);
      await kapi.writeFile(dest, text);
    }
    log('info', 'timeline: export done', { fmt, to: dest });
    setStatus(tf('ui.timeline.exportDone', String(dest).split(/[\\/]/).pop()));
    return dest;
  } catch (e) {
    log('error', 'timeline: export failed', e);
    setStatusError(failText(t('ui.timeline.export'), e));
    return null;
  }
}

/** ภาพ PNG ของบอร์ด — พื้นขาวเสมอ (งานส่งออก) · วาดแบบเดียวกับบนจอ */
export function drawTimelineCanvas(items, links, L = {}) {
  const dated = items.filter((it) => eventSpan(it));
  let min = Infinity, max = -Infinity;
  for (const it of dated) { const s = eventSpan(it); min = Math.min(min, s.start); max = Math.max(max, s.end); }
  if (!dated.length) { min = 0; max = 10; }
  if (min === max) { min -= 1; max += 1; }
  const Wd = 1600, ppu = fitPxPerUnit(min, max, Wd, PAD_X);
  const X = (v) => PAD_X + (v - min) * ppu;
  const tracks = groupByTrack(dated, L.defaultTrack);
  const layout = [];
  let y = AXIS_H + 50;
  for (const tr of tracks) {
    const rows = tr.items.map((it) => { const s = eventSpan(it); const x = X(s.start); return { id: linkKey(it), it, x, w: Math.max(CARD_MIN_W, X(s.end) - x) }; });
    const pk = packRows(rows, ROW_GAP);
    const nRows = Math.max(1, ...[...pk.values()].map((v) => v + 1));
    const laneH = Math.max(LANE_MIN, LANE_TOP + LANE_PAD + nRows * CARD_H + (nRows - 1) * ROW_GAP);
    layout.push({ tr, rows, pk, y, laneH });
    y += laneH;
  }
  const W = Math.max(Wd, ...layout.flatMap((l) => l.rows.map((r) => r.x + r.w + 40)));
  const H = y + 30;
  const cv = document.createElement('canvas');
  const dpr = 2;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = PRINT.paper; g.fillRect(0, 0, W, H);
  g.fillStyle = PRINT.inkTitle; g.font = 'bold 20px "Sarabun", sans-serif'; g.textBaseline = 'middle';
  g.fillText(L.title || '', 20, 24);
  const unit = timeUnitLabel(items);
  g.font = '12px "Sarabun", sans-serif';
  for (const tk of boardTicks(min, max, W - PAD_X * 2)) {
    const x = X(tk.value);
    g.strokeStyle = PRINT.rule; g.setLineDash([3, 4]);
    g.beginPath(); g.moveTo(x, 50 + AXIS_H - 8); g.lineTo(x, H - 10); g.stroke();
    g.setLineDash([]);
    g.fillStyle = PRINT.inkMuted; g.fillText((unit ? unit + ' ' : '') + tk.value, x + 3, 50 + 14);
  }
  const pos = new Map();
  for (const l of layout) {
    g.strokeStyle = PRINT.rule; g.beginPath(); g.moveTo(0, l.y); g.lineTo(W, l.y); g.stroke();
    g.fillStyle = l.tr.color; g.beginPath(); g.arc(14, l.y + 14, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = PRINT.inkSoft; g.font = '12px "Sarabun", sans-serif'; g.fillText(l.tr.name, 24, l.y + 14);
    for (const r of l.rows) {
      const top = l.y + LANE_TOP + l.pk.get(r.id) * (CARD_H + ROW_GAP);
      pos.set(r.id, { x0: r.x, x1: r.x + r.w, y: top + CARD_H / 2 });
      g.fillStyle = PRINT.panel; g.strokeStyle = PRINT.rule;
      roundRect(g, r.x, top, r.w, CARD_H, 8); g.fill(); g.stroke();
      g.fillStyle = r.it.color || l.tr.color; roundRect(g, r.x + 6, top + 12, 4, CARD_H - 24, 2); g.fill();
      g.save(); g.beginPath(); g.rect(r.x + 16, top, r.w - 22, CARD_H); g.clip();
      g.fillStyle = PRINT.ink; g.font = 'bold 13px "Sarabun", sans-serif'; g.fillText(r.it.title || '', r.x + 18, top + 20);
      g.fillStyle = PRINT.inkMuted; g.font = '11.5px "Sarabun", sans-serif';
      g.fillText((r.it.when || '') + (r.it.whenEnd ? ' → ' + r.it.whenEnd : ''), r.x + 18, top + 40);
      g.restore();
    }
  }
  g.strokeStyle = PRINT.accent; g.fillStyle = PRINT.accent; g.lineWidth = 1.6;
  for (const lk of links || []) {
    const a = pos.get(lk.from), b = pos.get(lk.to);
    if (!a || !b) continue;
    g.stroke(new Path2D(elbowPath({ x: a.x1, y: a.y }, { x: b.x0, y: b.y })));
    g.beginPath(); g.moveTo(b.x0, b.y); g.lineTo(b.x0 - 7, b.y - 4); g.lineTo(b.x0 - 7, b.y + 4); g.closePath(); g.fill();
  }
  return cv;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
