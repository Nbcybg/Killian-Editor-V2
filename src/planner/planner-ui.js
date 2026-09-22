// planner-ui.js — DOM UI Layer สำหรับ Planner v4
//
// แก้บั๊ก 7 (ปุ่มหายเมื่อแผงแคบ): แถบเครื่องมือไม่ wrap แล้ว → เลื่อนแนวนอนได้ + มีปุ่ม ◀ ▶
//     และเครื่องมือวาดย้ายไป "รางเครื่องมือ" แนวตั้งแบบ Miro ที่ไม่กินความกว้าง
// แก้บั๊ก 6 (กริด): ป๊อปอัปตั้งค่ากริด — เปิด/ปิด · ขนาด · สแนป · รูปแบบ · ความเข้ม
// แก้บั๊ก 8 (x y): แถบสถานะล่างบอกพิกัดเคอร์เซอร์ · ซูม · จำนวนวัตถุ · สถานะบันทึก
import { tx, txf } from '../i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t, tf } from '../i18n.js';
import { el, dataLabel } from '../core.js';
import { themeColor, PLANNER_NODE_COLORS, PLANNER_EDGE_COLORS, PLANNER_KIND } from '../palette.js';   // [alpha.162 · W6 ข้อ 2]
const escA = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
import { STATUSES, SHAPES, GRID_STYLES, ICONS } from './planner-data.js';
import { plannerBarSequence, layoutPlannerBar } from '../toolbar/toolbar-config.js';
import { initIcons, icon as iconEl, iconHtml, gi } from '../icons.js';
import { ICON_GLYPH } from '../generated/commands-data.js';

/** ชื่อไอคอน → ตัวอักษร (ใช้ที่ที่รับได้แค่ข้อความ เช่น แถบสถานะ) */
const glyph = (n) => ICON_GLYPH[n] || '';

const SHAPE_LABEL = {
  rect: t('ui.planner.rect'), round: t('ui.planner.corner'), ellipse: t('ui.planner.ellipse'), diamond: t('ui.planner.cut'),
  triangle: t('ui.planner.triangle'), star: t('ui.planner.star'), arrow: t('ui.planner.arrow'), cylinder: t('ui.planner.cylinder'),
};

/** [alpha.150] ป้ายของวิธีวางรูป — ที่เดียวทั้งเมนูคลิกขวา กล่องพื้นกระดาน และแผงคุณสมบัติ */
export const FIT_LABELS = {
  full: t('ui.planner.fitFull'), fit: t('ui.planner.fitFit'),
  fill: t('ui.planner.fitFill'), tile: t('ui.planner.fitTile'),
};

/**
 * เครื่องมือบนราง — `icon` เก็บ **ชื่อไอคอนในทะเบียน** (`icons/svg/<ชื่อ>.svg` ·
 * ตัวสำรอง `icons/glyphs.csv`) ไม่ใช่ตัวอีโมจิ · เปลี่ยนหน้าตาไอคอน = วางไฟล์ svg
 * ชื่อเดิมทับแล้ว `node build.js` — ไม่ต้องแตะไฟล์นี้เลย (กฎ alpha.147)
 */
const TOOL_DEFS = [
  { tool: 'select',    icon: 'cursor-arrow', label: t('ui.planner.pickMove'), key: 'V' },
  { tool: 'hand',      icon: 'hand', label: t('ui.planner.scrollBoard'), key: 'H' },
  { sep: true },
  { tool: 'sticky',    icon: ICONS.sticky, label: t('ui.planner.sticky'), key: 'N' },
  { tool: 'text',      icon: ICONS.text, label: t('ui.common.text'), key: 'T' },
  { tool: 'shape',     icon: ICONS.shape, label: t('ui.common.shape'), key: 'S', hasMenu: true },
  { tool: 'frame',     icon: ICONS.frame, label: t('ui.common.frame'), key: 'F' },
  { tool: 'comment',   icon: ICONS.comment, label: t('ui.common.comment'), key: 'C' },
  // [alpha.150 ข้อ 6+9] รูป · รายการสิ่งที่ต้องทำ
  { tool: 'image',     icon: ICONS.image, label: t('ui.planner.toolImage'), key: 'I' },
  { tool: 'todo',      icon: ICONS.todo, label: t('ui.planner.toolTodo'), key: 'K' },
  { tool: 'connector', icon: 'arrow-curve', label: t('ui.planner.lineLink'), key: 'L' },
  { sep: true },
  { tool: 'scene',     icon: ICONS.scene, label: t('ui.planner.cardScene') },
  { tool: 'chapter',   icon: ICONS.chapter, label: t('ui.planner.cardChapter') },
  { tool: 'entity',    icon: ICONS.entity, label: t('ui.planner.cardWiki') },
  { tool: 'note',      icon: ICONS.note, label: t('ui.planner.cardNote') },
];

/** รางเครื่องมือแนวตั้ง (แบบ Miro) — ลอยอยู่ซ้ายมือบนกระดาน */
export function createPlannerRail(cb) {
  const rail = el('div', 'planner-rail');
  const btns = new Map();
  for (const d of TOOL_DEFS) {
    if (d.sep) { rail.appendChild(el('div', 'planner-rail-sep')); continue; }
    const b = el('button', 'planner-rail-btn');
    b.append(iconEl(d.icon, 16));           // svg จริงถ้ามี · ไม่มีก็ตัวสำรองจากทะเบียน
    b.title = d.label + (d.key ? ` (${d.key})` : '');
    b.dataset.tool = d.tool;
    b.onclick = (ev) => {
      if (d.hasMenu && (ev.altKey || b.classList.contains('active'))) { _shapeMenu(b, cb); return; }
      cb.onTool && cb.onTool(d.tool);
    };
    if (d.hasMenu) {
      b.oncontextmenu = (ev) => { ev.preventDefault(); _shapeMenu(b, cb); };
      const caret = el('span', 'planner-rail-caret');
      caret.append(iconEl('chevron-down', 10));
      b.appendChild(caret);
    }
    rail.appendChild(b);
    btns.set(d.tool, b);
  }
  rail.setActive = (tool) => {
    for (const [t, b] of btns) b.classList.toggle('active', t === tool);
  };
  rail.setShape = (s) => {
    const b = btns.get('shape');
    if (b) b.title = t('ui.planner.shapeS') + (SHAPE_LABEL[s] || s);
  };
  return rail;
}

function _shapeMenu(anchor, cb) {
  document.querySelectorAll('.planner-popover').forEach((p) => p.remove());
  const pop = el('div', 'planner-popover planner-shape-menu');
  for (const s of SHAPES) {
    const b = el('button', '', SHAPE_LABEL[s] || s);
    b.onclick = () => { pop.remove(); cb.onTool && cb.onTool('shape', { shape: s }); };
    pop.appendChild(b);
  }
  _placePopover(pop, anchor);
}

function _placePopover(pop, anchor) {
  const host = anchor.closest('.planner-stage') || anchor.closest('#planner-body') || document.body;
  host.appendChild(pop);
  const a = anchor.getBoundingClientRect(), h = host.getBoundingClientRect();
  let left = a.right - h.left + 6, top = a.top - h.top;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  const p = pop.getBoundingClientRect();
  if (p.right > h.right - 4) pop.style.left = Math.max(4, a.left - h.left - p.width - 6) + 'px';
  if (p.bottom > h.bottom - 4) pop.style.top = Math.max(4, h.height - p.height - 6) + 'px';
  const close = (e) => {
    if (pop.contains(e.target) || anchor.contains(e.target)) return;
    pop.remove(); document.removeEventListener('mousedown', close, true);
  };
  setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  return pop;
}

/** แถบคำสั่ง (บน) — เลื่อนแนวนอนได้ ไม่มีปุ่มไหนหายเมื่อแผงแคบ (บั๊ก 7) */
export function createPlannerToolbar(cb) {
  const wrap = el('div', 'planner-toolbar');
  const left = el('button', 'planner-scroll-btn');
  left.append(iconEl('chevron-left', 13)); left.title = t('ui.planner.scrollLeft');
  const right = el('button', 'planner-scroll-btn');
  right.append(iconEl('chevron-right', 13)); right.title = t('ui.planner.scrollRight');
  const strip = el('div', 'planner-toolbar-strip');

  strip.innerHTML = `
    <span class="planner-board-name" id="pl-boardname" title="${tx('ui.planner.boardOpen')}">${tx('ui.common.boardMain')}</span>
    <span class="planner-dirty" id="pl-dirty" title="${tx('ui.planner.cantSave')}">${gi('dot')}</span>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="new" data-tip="ui.tip.plNew" title="${tx('ui.planner.boardNew')}">${tx('ui.common.new2')}</button>
    <button class="planner-btn" data-action="open" data-tip="ui.tip.plOpen" title="${tx('ui.planner.openBoardOther')}">${tx('ui.common.open')}</button>
    <button class="planner-btn k-ok" data-action="save" title="${tx('ui.planner.saveScSave')}">${tx('ui.common.save')}</button>
    <button class="planner-btn" data-action="save-as" title="${tx('ui.planner.saveFileNew')}">${tx('ui.menu.save')}</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="undo" title="${tx('ui.planner.undoScEditorUndo')}" data-icon="undo"></button>
    <button class="planner-btn" data-action="redo" title="${tx('ui.planner.repeatScEditorRedo')}" data-icon="redo"></button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="group" title="${tx('ui.planner.groupScGoto')}">${tx('ui.plannerProps.group')}</button>
    <button class="planner-btn" data-action="duplicate" title="${tx('ui.planner.repeatCtrlD')}">${tx('ui.common.repeat')}</button>
    <button class="planner-btn" data-action="reveal" title="${tx('ui.planner.pointPosFileExplorer')}">${tx('ui.planner.doc')}</button>
    <button class="planner-btn" data-action="delete" title="${tx('ui.planner.delDel')}">${tx('ui.common.del')}</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="auto-layout" data-tip="ui.tip.plAuto" title="${tx('ui.galleryMoodboard.arrangeAuto')}">${tx('ui.planner.arrange')}</button>
    <button class="planner-btn" data-action="grid" data-tip="ui.tip.plGrid" title="${tx('ui.planner.settingsGrid')}">${tx('ui.planner.grid')}</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="zoom-out" title="${tx('ui.planner.zoomOutScZoom')}" data-icon="minus"></button>
    <button class="planner-btn planner-zoom-label" data-action="zoom-reset" title="${tx('ui.planner.zoomCtrlD')}" id="pl-zoom">100%</button>
    <button class="planner-btn" data-action="zoom-in" title="${tx('ui.planner.zoomInScZoom')}" data-icon="plus"></button>
    <button class="planner-btn" data-action="zoom-fit" data-tip="ui.tip.plFit" title="${tx('ui.common.fitScreen')}">${tx('ui.planner.fitScreen')}</button>
    <button class="planner-btn" data-action="fullscreen" data-tip="ui.tip.plFull" title="${tx('ui.planner.viewBoardFullScreen')}" data-icon="fullscreen">${tx('ui.menu.fullScreen')}</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="background" data-tip="ui.tip.plBg" title="${tx('ui.planner.bgBoardColorImage')}" data-icon="layout">${tx('ui.planner.bgBoard2')}</button>
    <button class="planner-btn" data-action="export-png" data-tip="ui.tip.plPng" title="${tx('ui.planner.exportImage')}" data-icon="image">${tx('ui.planner.pNG')}</button>
    <button class="planner-btn" data-action="export-json" data-tip="ui.tip.plJson" title="${tx('ui.planner.exportFileJSON')}" data-icon="export">${tx('ui.planner.jSON')}</button>
    <button class="planner-btn" data-action="sample" title="${tx('ui.planner.putSample')}">${tx('ui.planner.sample')}</button>
  `;
  initIcons(strip);   // [alpha.147] ปุ่มซูม +/− เป็น data-icon ในเทมเพลตแล้ว

  const map = {
    'new': 'onNew', 'open': 'onOpen', 'save': 'onSave', 'save-as': 'onSaveAs',
    'undo': 'onUndo', 'redo': 'onRedo',
    'group': 'onGroup', 'duplicate': 'onDuplicate', 'reveal': 'onReveal', 'delete': 'onDelete',
    'auto-layout': 'onAutoLayout',
    'zoom-in': 'onZoomIn', 'zoom-out': 'onZoomOut', 'zoom-reset': 'onZoomReset', 'zoom-fit': 'onZoomFit',
    'export-png': 'onExportPng', 'sample': 'onSample',
    // [alpha.150] เต็มจอ (ข้อ 4) · ส่งออก JSON (ข้อ 10) · พื้นกระดาน (ข้อ 2)
    'fullscreen': 'onFullscreen', 'export-json': 'onExportJson', 'background': 'onBackgroundDialog',
  };

  strip.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const act = b.dataset.action;
    if (act === 'grid') { _gridPopover(b, cb); return; }
    const fn = cb[map[act]];
    if (fn) fn();
  });

  // เลื่อนด้วยล้อเมาส์ในแนวนอน
  strip.addEventListener('wheel', (e) => {
    if (strip.scrollWidth <= strip.clientWidth) return;
    e.preventDefault();
    strip.scrollLeft += (e.deltaY || e.deltaX);
    syncArrows();
  }, { passive: false });

  let holdTimer = null;
  const nudge = (dir) => { strip.scrollLeft += dir * 90; syncArrows(); };
  for (const [btn, dir] of [[left, -1], [right, 1]]) {
    btn.onclick = () => nudge(dir);
    btn.onmousedown = () => { holdTimer = setInterval(() => nudge(dir), 90); };
    const stop = () => { clearInterval(holdTimer); holdTimer = null; };
    btn.onmouseup = stop; btn.onmouseleave = stop;
  }

  function syncArrows() {
    const over = strip.scrollWidth - strip.clientWidth > 2;
    wrap.classList.toggle('has-scroll', over);
    left.disabled = !over || strip.scrollLeft <= 1;
    right.disabled = !over || strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1;
  }
  strip.addEventListener('scroll', syncArrows);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(syncArrows);
    ro.observe(strip);
    wrap._ro = ro;
  }

  wrap.append(left, strip, right);
  wrap.syncArrows = syncArrows;
  wrap.setZoom = (z) => { const n = strip.querySelector('#pl-zoom'); if (n) n.textContent = Math.round(z * 100) + '%'; };
  wrap.setBoardName = (name) => { const n = strip.querySelector('#pl-boardname'); if (n) { n.textContent = name; n.title = t('ui.planner.board') + name; } };
  wrap.setDirty = (d) => { wrap.classList.toggle('is-dirty', !!d); };
  // [alpha.150 ข้อ 4] ปุ่มเต็มจอบอกสถานะตัวเอง (ผู้ใช้ต้องรู้ว่ากดออกได้ที่ปุ่มเดิม)
  wrap.setFullscreen = (on) => {
    const b = strip.querySelector('[data-action="fullscreen"]');
    if (b) { b.classList.toggle('on', !!on); b.title = t(on ? 'ui.planner.fullExit' : 'ui.planner.fullEnter'); }
  };
  setTimeout(syncArrows, 0);
  return wrap;
}

/** ป๊อปอัปตั้งค่ากริด (บั๊ก 6) */
function _gridPopover(anchor, cb) {
  document.querySelectorAll('.planner-popover').forEach((p) => p.remove());
  const g = (cb.getGrid && cb.getGrid()) || { show: true, size: 20, snap: false, style: 'dots', opacity: 0.9, color: '' };
  const pop = el('div', 'planner-popover planner-grid-pop');
  pop.innerHTML = ((a) => `
    <div class="planner-pop-title">${tx('ui.planner.grid')}</div>
    <label class="planner-pop-row"><input type="checkbox" id="plg-show"${a[0]}> ${tx('ui.planner.showGrid')}</label>
    <label class="planner-pop-row"><input type="checkbox" id="plg-snap"${a[1]}> ${tx('ui.planner.viewInLineGrid')}</label>
    <div class="planner-pop-row"><span>${tx('ui.planner.size')}</span>
      <input type="number" id="plg-size" min="4" max="400" step="1" value="${a[2]}"> ${tx('ui.planner.px')}</div>
    <div class="planner-pop-row"><span>${tx('ui.menu.format2')}</span>
      <select id="plg-style">${a[3]}</select></div>
    <div class="planner-pop-row"><span>${tx('ui.planner.text2')}</span>
      <input type="range" id="plg-op" min="0" max="1" step="0.05" value="${a[4]}"></div>
    <div class="planner-pop-row"><span>${tx('ui.planner.colorLine')}</span><input type="color" id="plg-color" value="${a[5]}"></div>
    <div class="planner-pop-row"><span>${tx('ui.planner.colorBg2')}</span><input type="color" id="plg-bg" value="${a[6]}"></div>
    <div class="planner-pop-row planner-pop-presets">
      <button data-size="10">10</button><button data-size="20">20</button>
      <button data-size="25">25</button><button data-size="50">50</button><button data-size="100">100</button>
    </div>
  `)([g.show ? ' checked' : '', g.snap ? ' checked' : '', g.size, GRID_STYLES.map((s) => `<option value="${s}"${g.style === s ? ' selected' : ''}>${s === 'dots' ? t('ui.common.dot') : s === 'lines' ? t('ui.planner.line') : t('ui.planner.cross')}</option>`).join(''), g.opacity, g.color || themeColor('--hover', '#3a3936'), (cb.getBackground && cb.getBackground()) || themeColor('--canvas', '#262624')]);
  const emit = (p) => cb.onGridChange && cb.onGridChange(p);
  pop.querySelector('#plg-show').onchange = (e) => emit({ show: e.target.checked });
  pop.querySelector('#plg-snap').onchange = (e) => emit({ snap: e.target.checked });
  pop.querySelector('#plg-size').oninput = (e) => emit({ size: parseInt(e.target.value, 10) });
  pop.querySelector('#plg-style').onchange = (e) => emit({ style: e.target.value });
  pop.querySelector('#plg-op').oninput = (e) => emit({ opacity: parseFloat(e.target.value) });
  pop.querySelector('#plg-color').oninput = (e) => emit({ color: e.target.value });
  pop.querySelector('#plg-bg').oninput = (e) => cb.onBackgroundChange && cb.onBackgroundChange(e.target.value);
  pop.querySelectorAll('.planner-pop-presets button').forEach((b) => {
    b.onclick = () => { pop.querySelector('#plg-size').value = b.dataset.size; emit({ size: +b.dataset.size }); };
  });
  return _placePopover(pop, anchor);
}

/** แถบกรอง — เลื่อนแนวนอนได้เหมือนกัน */
// [alpha.159 · QoL] ตัวเลือกสถานะของแถบกรอง: ค่า = ไทย (ข้อมูลในไฟล์) · ป้าย = ตามภาษา (dataLabel) · escape ทั้งสองฝั่ง
export function createPlannerFilterBar(callbacks) {
  const bar = el('div', 'planner-filter');
  bar.innerHTML = ((a) => `
    <input class="planner-filter-input" id="pl-f-text" placeholder="${tx('ui.planner.filterNameSummaryTag')}">
    <select class="planner-filter-sel" id="pl-f-type">
      <option value="">${tx('ui.planner.allType')}</option>
      <option value="scene">${tx('ui.common.scene2')}</option>
      <option value="chapter">${tx('ui.common.chapter')}</option>
      <option value="entity">${tx('ui.plannerProps.entityWiki')}</option>
      <option value="note">${tx('ui.common.note')}</option>
      <option value="sticky">${tx('ui.planner.sticky')}</option>
      <option value="text">${tx('ui.common.text')}</option>
      <option value="shape">${tx('ui.common.shape')}</option>
      <option value="frame">${tx('ui.common.frame')}</option>
      <option value="comment">${tx('ui.common.comment')}</option>
    </select>
    <select class="planner-filter-sel" id="pl-f-status">
      <option value="">${tx('ui.planner.allStatus')}</option>
      ${a[0]}
    </select>
    <button class="planner-btn-small" id="pl-f-clear">${tx('ui.common.clear')}</button>
  `)([STATUSES.filter(Boolean).map((s) => `<option value="${escA(s)}">${escA(dataLabel(s))}</option>`).join('')]);

  let filter = { text: '', type: '', status: '' };
  const emit = () => { if (callbacks.onFilterChange) callbacks.onFilterChange({ ...filter }); };
  bar.querySelector('#pl-f-text').oninput = (e) => { filter.text = e.target.value; emit(); };
  bar.querySelector('#pl-f-type').onchange = (e) => { filter.type = e.target.value; emit(); };
  bar.querySelector('#pl-f-status').onchange = (e) => { filter.status = e.target.value; emit(); };
  bar.querySelector('#pl-f-clear').onclick = () => {
    filter = { text: '', type: '', status: '' };
    bar.querySelector('#pl-f-text').value = '';
    bar.querySelector('#pl-f-type').value = '';
    bar.querySelector('#pl-f-status').value = '';
    emit();
  };
  return bar;
}

/** แถบสถานะล่าง — พิกัด x y (บั๊ก 8) · ซูม · จำนวน · เครื่องมือปัจจุบัน */
export function createPlannerStatus() {
  const bar = el('div', 'planner-status');
  bar.innerHTML = `
    <span class="planner-st-tool" id="pl-st-tool">${tx('ui.planner.pick')}</span>
    <span class="planner-st-xy" id="pl-st-xy">${tx('ui.planner.xY')}</span>
    <span class="planner-st-grid" id="pl-st-grid"></span>
    <span class="planner-count" id="pl-count"></span>
  `;
  bar.setXY = (p) => {
    const n = bar.querySelector('#pl-st-xy');
    if (n) n.textContent = p ? `x ${p.x} · y ${p.y}` : 'x — · y —';
  };
  bar.setTool = (label) => { const n = bar.querySelector('#pl-st-tool'); if (n) n.textContent = label; };
  bar.setGridInfo = (g) => {
    const n = bar.querySelector('#pl-st-grid');
    if (n) n.textContent = g ? `${glyph('grid')} ${g.size}px${g.snap ? ' · snap' : ''}${g.show ? '' : t('ui.planner.hide')}` : '';
  };
  return bar;
}

// ═══════════ แถบคุณสมบัติลอยเหนือสิ่งที่เลือก (บั๊ก 7 — แบบ Miro) ═══════════
// [alpha.162 · W6 ข้อ 2] จานสีย้ายไป palette.js ที่เดียว (planner-props เคยมีชุดเดียวกันซ้ำสองชุด)
export const NODE_COLORS = PLANNER_NODE_COLORS;
export const EDGE_COLORS = PLANNER_EDGE_COLORS;

/**
 * แถบเล็ก ๆ ที่โผล่เหนือการ์ด/เส้นที่เลือก — เปลี่ยนสีได้ทันทีโดยไม่ต้องเปิดแผงคุณสมบัติ
 * (ผู้ใช้รายงานว่า "ไม่มี properties สำหรับ node และเปลี่ยนสีไม่ได้" — อันนี้คือทางลัดที่เห็นได้ทันตา)
 */
export function createContextBar(cb) {
  const bar = el('div', 'planner-ctxbar');
  bar.style.display = 'none';
  let mode = null, current = null;

  const mkSwatch = (c, onPick) => {
    const b = el('button', 'planner-ctx-sw');
    b.style.background = c; b.title = c; b.dataset.color = c;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => onPick(c);
    return b;
  };
  /**
   * ปุ่มบนแถบคุณสมบัติลอย — `name` คือ **ชื่อไอคอนในทะเบียน** ไม่ใช่ตัวอักษร
   * (กฎ alpha.147 · เปลี่ยนรูป = วาง svg ชื่อเดิมลง icons/svg/ แล้ว build ใหม่)
   */
  const mkBtn = (name, title, fn, cls) => {
    const b = el('button', 'planner-ctx-btn' + (cls ? ' ' + cls : ''));
    b.append(iconEl(name, 14));
    b.dataset.icon = name;
    b.title = title;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    return b;
  };
  const sep = () => el('span', 'planner-ctx-sep');

  function buildNode(n) {
    bar.innerHTML = '';
    const sw = el('div', 'planner-ctx-sws');
    for (const c of NODE_COLORS) {
      const b = mkSwatch(c, (col) => cb.onNodeChange && cb.onNodeChange({ color: col }));
      if ((n.color || '').toLowerCase() === c.toLowerCase()) b.classList.add('on');
      sw.appendChild(b);
    }
    const custom = document.createElement('input');
    custom.type = 'color'; custom.className = 'planner-ctx-color';
    custom.value = /^#[0-9a-f]{6}$/i.test(n.color || '') ? n.color : PLANNER_NODE_COLORS[0];
    custom.title = t('ui.planner.colorOther');
    custom.oninput = () => cb.onNodeChange && cb.onNodeChange({ color: custom.value });
    sw.appendChild(custom);
    bar.append(sw, sep());

    const tc = document.createElement('input');
    tc.type = 'color'; tc.className = 'planner-ctx-color planner-ctx-textcolor';
    tc.value = /^#[0-9a-f]{6}$/i.test(n.textColor || '') ? n.textColor : PLANNER_KIND.fillDefault;
    tc.title = t('ui.planner.colorChar');
    tc.oninput = () => cb.onNodeChange && cb.onNodeChange({ textColor: tc.value });
    bar.append(tc);
    bar.append(
      mkBtn('font-smaller', t('ui.planner.charSmall'), () => cb.onNodeChange && cb.onNodeChange({ fontSize: (current.fontSize || 12) - 1 })),
      mkBtn('font-bigger', t('ui.planner.charBig'), () => cb.onNodeChange && cb.onNodeChange({ fontSize: (current.fontSize || 12) + 1 })),
      sep(),
      sep(),
      mkBtn('arrow-up', t('ui.planner.liftTopCtrlShift'), () => cb.onOrder && cb.onOrder('front')),
      mkBtn('arrow-down', t('ui.planner.sendBottomLastCtrl'), () => cb.onOrder && cb.onOrder('back')),
      sep(),
      mkBtn(n.locked ? 'lock' : 'lock-open', n.locked ? t('ui.planner.unlock') : t('ui.planner.lockNotMove'),
            () => cb.onNodeChange && cb.onNodeChange({ locked: !current.locked })),
      mkBtn('duplicate', t('ui.planner.repeatCtrlD'), () => cb.onDuplicate && cb.onDuplicate()),
      mkBtn('more', t('ui.planner.propsAll'), () => cb.onMore && cb.onMore()),
      mkBtn('trash', t('ui.planner.delDel'), () => cb.onDelete && cb.onDelete(), 'danger'),
    );
  }

  function buildEdge(e) {
    bar.innerHTML = '';
    const sw = el('div', 'planner-ctx-sws');
    for (const c of EDGE_COLORS) {
      const b = mkSwatch(c, (col) => cb.onEdgeChange && cb.onEdgeChange({ color: col }));
      if ((e.color || '').toLowerCase() === c.toLowerCase()) b.classList.add('on');
      sw.appendChild(b);
    }
    const custom = document.createElement('input');
    custom.type = 'color'; custom.className = 'planner-ctx-color';
    custom.value = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : PLANNER_EDGE_COLORS[0];
    custom.title = t('ui.planner.colorOther');
    custom.oninput = () => cb.onEdgeChange && cb.onEdgeChange({ color: custom.value });
    sw.appendChild(custom);
    bar.append(sw, sep());
    for (const [r, ic, tip] of [['straight', 'line-straight', t('ui.planner.lineAt')], ['orthogonal', 'line-ortho', t('ui.planner.cornerScene')], ['curved', 'line-curved', t('ui.planner.curve')]]) {
      const b = mkBtn(ic, tip, () => cb.onEdgeChange && cb.onEdgeChange({ routing: r }));
      if ((e.routing || 'straight') === r) b.classList.add('on');
      bar.append(b);
    }
    bar.append(sep());
    for (const [s, ic, tip] of [['solid', 'line-solid', t('ui.common.solid')], ['dashed', 'line-dashed', t('ui.common.msg5')], ['dotted', 'line-dotted', t('ui.common.dot')]]) {
      const b = mkBtn(ic, tip, () => cb.onEdgeChange && cb.onEdgeChange({ style: s }));
      if ((e.style || 'solid') === s) b.classList.add('on');
      bar.append(b);
    }
    bar.append(
      sep(),
      mkBtn('minus', t('ui.planner.line2'), () => cb.onEdgeChange && cb.onEdgeChange({ width: (current.width || 2) - 1 })),
      mkBtn('plus', t('ui.planner.lineBold'), () => cb.onEdgeChange && cb.onEdgeChange({ width: (current.width || 2) + 1 })),
      mkBtn('arrowhead', t('ui.planner.toggleHeadArrowTo'), () => {
        const order = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'];
        const i = order.indexOf(current.arrowEnd || 'arrow');
        cb.onEdgeChange && cb.onEdgeChange({ arrowEnd: order[(i + 1) % order.length] });
      }),
      mkBtn('swap', t('ui.planner.toggle'), () => cb.onFlip && cb.onFlip()),
      mkBtn('more', t('ui.planner.propsAll'), () => cb.onMore && cb.onMore()),
      mkBtn('trash', t('ui.planner.delLineDel'), () => cb.onDeleteEdge && cb.onDeleteEdge(), 'danger'),
    );
  }

  /** @param rect กรอบของสิ่งที่เลือกในพิกัดของ .planner-stage */
  bar.showFor = (kind, data, rect) => {
    mode = kind; current = data;
    if (kind === 'node') buildNode(data);
    else if (kind === 'edge') buildEdge(data);
    else { bar.hideBar(); return null; }
    bar.style.display = 'flex';
    bar.style.visibility = 'hidden';
    bar.style.left = '0px'; bar.style.top = '0px';
    const host = bar.parentElement;
    const hw = host ? host.clientWidth : 800, hh = host ? host.clientHeight : 600;
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    let left = rect.x + rect.width / 2 - bw / 2;
    let top = rect.y - bh - 10;
    if (top < 4) top = Math.min(hh - bh - 4, rect.y + rect.height + 10);
    // [alpha.150 ข้อ 11] แผงแคบ ๆ ทำให้แถบถูกหนีบไปชิดซ้ายจนทับ "รางเครื่องมือ" จนกดไม่ได้
    // → กันที่ให้รางเสมอ (รางลอยอยู่ซ้ายมือของเวที จึงวัดความกว้างจริงของมันเอา ไม่ใช่เดา)
    const rail = host ? host.querySelector('.planner-rail') : null;
    const minLeft = rail ? rail.offsetLeft + rail.offsetWidth + 8 : 4;
    left = Math.max(4, Math.min(hw - bw - 4, left));
    if (left < minLeft && bw + minLeft + 4 <= hw) left = minLeft;
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(Math.max(4, top)) + 'px';
    bar.style.visibility = 'visible';
    return bar;
  };
  bar.hideBar = () => { bar.style.display = 'none'; mode = null; current = null; };
  bar.isShown = () => bar.style.display !== 'none';
  bar.currentMode = () => mode;
  return bar;
}

export function updatePlannerCount(node, stats, filtered) {
  if (!node) return;
  node.textContent = filtered
    ? tf('ui.planner.showCard', filtered.shown, filtered.total)
    : tf('ui.planner.objectLineGroup', stats.nodes, stats.edges, stats.groups);
}

export const TOOL_LABELS = TOOL_DEFS.filter((d) => !d.sep)
  .reduce((m, d) => { m[d.tool] = d.label; return m; }, {});

// ═══════════ [alpha.151 ข้อ 3] แถบรูปแบบลอย **ของกระดาน** ═══════════
//
// ผู้ใช้: *"float bar จะต้องไม่มีที่เดียวไง ตอนนี้มีที่เดียว planner เลยใช้ยาก
//          ต้องแยกส่วน คือ editor กับ planner"*
//
// แถบของตัวแก้ไขอยู่ใน `#content` ซึ่งกระดานมองไม่เห็น — เอื้อมไปกดไม่ได้และปุ่มก็คนละชุด
// อันนี้จึงเป็นแถบของกระดานเอง ลอยอยู่ในเวทีกระดาน ลากย้ายได้ จำตำแหน่งไว้
// ปุ่มทุกตัวซ่อน/แสดงได้จากหน้าตั้งค่า (โหมด `planner`) เหมือนแถบอีกอันทุกประการ

/** นิยามปุ่มของแถบกระดาน: id → ไอคอน · ป้าย · ชื่อฟังก์ชันที่จะเรียก */
const PB_DEFS = {
  'pb-undo':        { icon: 'undo', label: 'ui.plannerBar.undo', act: 'onUndo' },
  'pb-redo':        { icon: 'redo', label: 'ui.plannerBar.redo', act: 'onRedo' },
  'pb-align-left':  { icon: 'align-left', label: 'ui.plannerBar.alignLeft', act: 'onAlignH', arg: 'left' },
  'pb-align-center': { icon: 'align-center', label: 'ui.plannerBar.alignCenter', act: 'onAlignH', arg: 'center' },
  'pb-align-right': { icon: 'align-right', label: 'ui.plannerBar.alignRight', act: 'onAlignH', arg: 'right' },
  'pb-valign-top':  { icon: 'align-top', label: 'ui.plannerBar.valignTop', act: 'onAlignV', arg: 'top' },
  'pb-valign-middle': { icon: 'align-middle', label: 'ui.plannerBar.valignMiddle', act: 'onAlignV', arg: 'middle' },
  'pb-valign-bottom': { icon: 'align-bottom', label: 'ui.plannerBar.valignBottom', act: 'onAlignV', arg: 'bottom' },
  'pb-font-smaller': { icon: 'font-smaller', label: 'ui.planner.charSmall', act: 'onFont', arg: -1 },
  'pb-font-bigger': { icon: 'font-bigger', label: 'ui.planner.charBig', act: 'onFont', arg: 1 },
  'pb-fill':        { icon: 'palette', label: 'ui.plannerBar.fill', act: 'onColor', arg: 'fill' },
  'pb-textcolor':   { icon: 'font', label: 'ui.planner.colorChar', act: 'onColor', arg: 'text' },
  'pb-border':      { icon: 'square', label: 'ui.plannerBar.border', act: 'onColor', arg: 'border' },
  'pb-image':       { icon: 'image', label: 'ui.plannerBar.image', act: 'onImage' },
  'pb-sticky':      { icon: 'pin', label: 'ui.planner.sticky', act: 'onNew', arg: 'sticky' },
  'pb-todo':        { icon: 'checklist', label: 'ui.planner.toolTodo', act: 'onNew', arg: 'todo' },
  'pb-frame':       { icon: 'frame', label: 'ui.common.frame', act: 'onNew', arg: 'frame' },
  'pb-connector':   { icon: 'arrow-curve', label: 'ui.planner.lineLink', act: 'onTool', arg: 'connector' },
  'pb-front':       { icon: 'arrow-up', label: 'ui.plannerBar.front', act: 'onOrder', arg: 'front' },
  'pb-back':        { icon: 'arrow-down', label: 'ui.plannerBar.back', act: 'onOrder', arg: 'back' },
  'pb-lock':        { icon: 'lock', label: 'ui.planner.lock', act: 'onLock' },
  'pb-duplicate':   { icon: 'duplicate', label: 'ui.common.repeat', act: 'onDuplicate' },
  'pb-delete':      { icon: 'trash', label: 'ui.common.del2', act: 'onDelete', danger: true },
  'pb-grid':        { icon: 'grid', label: 'ui.plannerBar.grid', act: 'onGrid' },
  'pb-snap':        { icon: 'magnet', label: 'ui.plannerBar.snap', act: 'onSnap' },
  'pb-fit':         { icon: 'maximize', label: 'ui.planner.fitScreen', act: 'onFit' },
  'pb-fullscreen':  { icon: 'fullscreen', label: 'ui.planner.fullScreen', act: 'onFullscreen' },
};

/**
 * สร้างแถบรูปแบบของกระดาน
 * @param {object} cb  ตัวจัดการของแต่ละปุ่ม (planner.js เป็นคนส่งมา)
 * @param {() => object} getCfg  อ่าน `settings.fmtbar` (ซ่อน/แสดงปุ่ม)
 */
export function createPlannerFmtBar(cb, getCfg) {
  const bar = el('div', 'k-fmtbar planner-fmtbar');
  const grip = el('div', 'k-fmtbar-grip');
  grip.innerHTML = '<span></span><span></span>';
  grip.title = t('ui.plannerBar.dragHint');
  bar.append(grip);
  const btns = new Map();

  for (const id of plannerBarSequence()) {
    if (id === 'sep') { bar.append(el('span', 'sep')); continue; }
    const d = PB_DEFS[id];
    if (!d) continue;
    const b = el('button', 'tb' + (d.danger ? ' danger' : ''));
    b.id = id;
    b.append(iconEl(d.icon, 15));
    b.title = t(d.label);
    b.dataset.tip = 'ui.tip.' + id;
    b.onmousedown = (e) => e.preventDefault();       // ห้ามแย่งโฟกัส/ยกเลิกการเลือกบนกระดาน
    b.onclick = () => { const fn = cb[d.act]; if (fn) fn(d.arg, b); };
    bar.append(b);
    btns.set(id, b);
  }

  /** ทาค่าที่ตั้งไว้ลงแถบ — ปุ่มที่ถูกซ่อน **ไม่ถูกวาดเลย** (ข้อ 6) */
  bar.applyConfig = () => {
    const { seq, show } = layoutPlannerBar(getCfg ? getCfg() : null);
    const kids = [...bar.children].filter((k) => k !== grip);
    kids.forEach((k, i) => k.classList.toggle('tb-hidden', show[i] === false));
    return seq.length;
  };
  /** ติดไฟปุ่มตามสถานะปัจจุบันของสิ่งที่เลือก/กระดาน */
  bar.syncState = (st) => {
    const on = (id, v) => { const b = btns.get(id); if (b) b.classList.toggle('on', !!v); };
    on('pb-align-left', st.align === 'left');
    on('pb-align-center', st.align === 'center');
    on('pb-align-right', st.align === 'right');
    on('pb-valign-top', st.valign === 'top');
    on('pb-valign-middle', st.valign === 'middle');
    on('pb-valign-bottom', st.valign === 'bottom');
    on('pb-grid', st.grid);
    on('pb-snap', st.snap);
    on('pb-lock', st.locked);
    on('pb-fullscreen', st.fullscreen);
    // ปุ่มที่ต้องมีของถูกเลือกก่อน — ไม่มีก็เป็นสีเทา (ยังเห็นอยู่ว่ามี)
    for (const id of ['pb-align-left', 'pb-align-center', 'pb-align-right',
                      'pb-valign-top', 'pb-valign-middle', 'pb-valign-bottom',
                      'pb-font-smaller', 'pb-font-bigger', 'pb-fill', 'pb-textcolor',
                      'pb-border', 'pb-front', 'pb-back', 'pb-lock', 'pb-duplicate', 'pb-delete']) {
      const b = btns.get(id);
      if (b) b.classList.toggle('tb-na', !st.hasSelection);
    }
  };
  bar.buttons = btns;
  return bar;
}
