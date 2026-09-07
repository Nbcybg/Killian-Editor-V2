// planner-ui.js — DOM UI Layer สำหรับ Planner v4
//
// แก้บั๊ก 7 (ปุ่มหายเมื่อแผงแคบ): แถบเครื่องมือไม่ wrap แล้ว → เลื่อนแนวนอนได้ + มีปุ่ม ◀ ▶
//     และเครื่องมือวาดย้ายไป "รางเครื่องมือ" แนวตั้งแบบ Miro ที่ไม่กินความกว้าง
// แก้บั๊ก 6 (กริด): ป๊อปอัปตั้งค่ากริด — เปิด/ปิด · ขนาด · สแนป · รูปแบบ · ความเข้ม
// แก้บั๊ก 8 (x y): แถบสถานะล่างบอกพิกัดเคอร์เซอร์ · ซูม · จำนวนวัตถุ · สถานะบันทึก
import { t, tf } from '../i18n.js';
import { el } from '../core.js';
import { STATUSES, SHAPES, GRID_STYLES } from './planner-data.js';

const SHAPE_LABEL = {
  rect: t('ui.planner.rect'), round: t('ui.planner.corner'), ellipse: t('ui.planner.ellipse'), diamond: t('ui.planner.cut'),
  triangle: t('ui.planner.triangle'), star: t('ui.planner.star'), arrow: t('ui.planner.arrow'), cylinder: t('ui.planner.cylinder'),
};

const TOOL_DEFS = [
  { tool: 'select',    icon: '⬉', label: t('ui.planner.pickMove'), key: 'V' },
  { tool: 'hand',      icon: '✋', label: t('ui.planner.scrollBoard'), key: 'H' },
  { sep: true },
  { tool: 'sticky',    icon: '📌', label: t('ui.planner.sticky'), key: 'N' },
  { tool: 'text',      icon: '🅃', label: t('ui.common.text'), key: 'T' },
  { tool: 'shape',     icon: '⬛', label: t('ui.common.shape'), key: 'S', hasMenu: true },
  { tool: 'frame',     icon: '🖼', label: t('ui.common.frame'), key: 'F' },
  { tool: 'comment',   icon: '💬', label: t('ui.common.comment'), key: 'C' },
  { tool: 'connector', icon: '↝', label: t('ui.planner.lineLink'), key: 'L' },
  { sep: true },
  { tool: 'scene',     icon: '📄', label: t('ui.planner.cardScene') },
  { tool: 'chapter',   icon: '📁', label: t('ui.planner.cardChapter') },
  { tool: 'entity',    icon: '👤', label: t('ui.planner.cardWiki') },
  { tool: 'note',      icon: '📝', label: t('ui.planner.cardNote') },
];

/** รางเครื่องมือแนวตั้ง (แบบ Miro) — ลอยอยู่ซ้ายมือบนกระดาน */
export function createPlannerRail(cb) {
  const rail = el('div', 'planner-rail');
  const btns = new Map();
  for (const d of TOOL_DEFS) {
    if (d.sep) { rail.appendChild(el('div', 'planner-rail-sep')); continue; }
    const b = el('button', 'planner-rail-btn', d.icon);
    b.title = d.label + (d.key ? ` (${d.key})` : '');
    b.dataset.tool = d.tool;
    b.onclick = (ev) => {
      if (d.hasMenu && (ev.altKey || b.classList.contains('active'))) { _shapeMenu(b, cb); return; }
      cb.onTool && cb.onTool(d.tool);
    };
    if (d.hasMenu) {
      b.oncontextmenu = (ev) => { ev.preventDefault(); _shapeMenu(b, cb); };
      const caret = el('span', 'planner-rail-caret', '▾');
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
  const left = el('button', 'planner-scroll-btn', '‹'); left.title = t('ui.planner.scrollLeft');
  const right = el('button', 'planner-scroll-btn', '›'); right.title = t('ui.planner.scrollRight');
  const strip = el('div', 'planner-toolbar-strip');

  strip.innerHTML = t('ui.planner.boardMainNewOpen');

  const map = {
    'new': 'onNew', 'open': 'onOpen', 'save': 'onSave', 'save-as': 'onSaveAs',
    'undo': 'onUndo', 'redo': 'onRedo',
    'group': 'onGroup', 'duplicate': 'onDuplicate', 'reveal': 'onReveal', 'delete': 'onDelete',
    'auto-layout': 'onAutoLayout',
    'zoom-in': 'onZoomIn', 'zoom-out': 'onZoomOut', 'zoom-reset': 'onZoomReset', 'zoom-fit': 'onZoomFit',
    'export-png': 'onExportPng', 'sample': 'onSample',
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
  setTimeout(syncArrows, 0);
  return wrap;
}

/** ป๊อปอัปตั้งค่ากริด (บั๊ก 6) */
function _gridPopover(anchor, cb) {
  document.querySelectorAll('.planner-popover').forEach((p) => p.remove());
  const g = (cb.getGrid && cb.getGrid()) || { show: true, size: 20, snap: false, style: 'dots', opacity: 0.9, color: '#3a3936' };
  const pop = el('div', 'planner-popover planner-grid-pop');
  pop.innerHTML = tf('ui.planner.gridShowGridView', g.show ? ' checked' : '', g.snap ? ' checked' : '', g.size, GRID_STYLES.map((s) => `<option value="${s}"${g.style === s ? ' selected' : ''}>${s === 'dots' ? t('ui.common.dot') : s === 'lines' ? t('ui.planner.line') : t('ui.planner.cross')}</option>`).join(''), g.opacity, g.color || '#3a3936', (cb.getBackground && cb.getBackground()) || '#262624');
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
export function createPlannerFilterBar(callbacks) {
  const bar = el('div', 'planner-filter');
  bar.innerHTML = tf('ui.planner.allTypeSceneChapter', STATUSES.filter(Boolean).map((s) => `<option value="${s}">${s}</option>`).join(''));

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
  bar.innerHTML = t('ui.planner.pickXY');
  bar.setXY = (p) => {
    const n = bar.querySelector('#pl-st-xy');
    if (n) n.textContent = p ? `x ${p.x} · y ${p.y}` : 'x — · y —';
  };
  bar.setTool = (label) => { const n = bar.querySelector('#pl-st-tool'); if (n) n.textContent = label; };
  bar.setGridInfo = (g) => {
    const n = bar.querySelector('#pl-st-grid');
    if (n) n.textContent = g ? `▦ ${g.size}px${g.snap ? ' · snap' : ''}${g.show ? '' : t('ui.planner.hide')}` : '';
  };
  return bar;
}

// ═══════════ แถบคุณสมบัติลอยเหนือสิ่งที่เลือก (บั๊ก 7 — แบบ Miro) ═══════════
export const NODE_COLORS = ['#3f3e3a', '#5f7a9f', '#7a6f9f', '#5f8a6f', '#d97757',
                            '#f2c14e', '#c1666b', '#4a6fa5', '#e8e3d3', '#26241f'];
export const EDGE_COLORS = ['#d97757', '#faf9f5', '#5f7a9f', '#5f8a6f', '#f2c14e', '#c1666b', '#7a6f9f'];

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
  const mkBtn = (label, title, fn, cls) => {
    const b = el('button', 'planner-ctx-btn' + (cls ? ' ' + cls : ''), label);
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
    custom.value = /^#[0-9a-f]{6}$/i.test(n.color || '') ? n.color : '#3f3e3a';
    custom.title = t('ui.planner.colorOther');
    custom.oninput = () => cb.onNodeChange && cb.onNodeChange({ color: custom.value });
    sw.appendChild(custom);
    bar.append(sw, sep());

    const tc = document.createElement('input');
    tc.type = 'color'; tc.className = 'planner-ctx-color planner-ctx-textcolor';
    tc.value = /^#[0-9a-f]{6}$/i.test(n.textColor || '') ? n.textColor : '#faf9f5';
    tc.title = t('ui.planner.colorChar');
    tc.oninput = () => cb.onNodeChange && cb.onNodeChange({ textColor: tc.value });
    bar.append(tc);
    bar.append(
      mkBtn('A－', t('ui.planner.charSmall'), () => cb.onNodeChange && cb.onNodeChange({ fontSize: (current.fontSize || 12) - 1 })),
      mkBtn('A＋', t('ui.planner.charBig'), () => cb.onNodeChange && cb.onNodeChange({ fontSize: (current.fontSize || 12) + 1 })),
      sep(),
      sep(),
      mkBtn('⬆', t('ui.planner.liftTopCtrlShift'), () => cb.onOrder && cb.onOrder('front')),
      mkBtn('⬇', t('ui.planner.sendBottomLastCtrl'), () => cb.onOrder && cb.onOrder('back')),
      sep(),
      mkBtn(n.locked ? '🔒' : '🔓', n.locked ? t('ui.planner.unlock') : t('ui.planner.lockNotMove'),
            () => cb.onNodeChange && cb.onNodeChange({ locked: !current.locked })),
      mkBtn('⧉', t('ui.planner.repeatCtrlD'), () => cb.onDuplicate && cb.onDuplicate()),
      mkBtn('⋯', t('ui.planner.propsAll'), () => cb.onMore && cb.onMore()),
      mkBtn('🗑', t('ui.planner.delDel'), () => cb.onDelete && cb.onDelete(), 'danger'),
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
    custom.value = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#d97757';
    custom.title = t('ui.planner.colorOther');
    custom.oninput = () => cb.onEdgeChange && cb.onEdgeChange({ color: custom.value });
    sw.appendChild(custom);
    bar.append(sw, sep());
    for (const [r, ic, tip] of [['straight', '╱', t('ui.planner.lineAt')], ['orthogonal', '⌐', t('ui.planner.cornerScene')], ['curved', '⌒', t('ui.planner.curve')]]) {
      const b = mkBtn(ic, tip, () => cb.onEdgeChange && cb.onEdgeChange({ routing: r }));
      if ((e.routing || 'straight') === r) b.classList.add('on');
      bar.append(b);
    }
    bar.append(sep());
    for (const [s, ic, tip] of [['solid', '──', t('ui.common.solid')], ['dashed', '╌╌', t('ui.common.msg5')], ['dotted', '···', t('ui.common.dot')]]) {
      const b = mkBtn(ic, tip, () => cb.onEdgeChange && cb.onEdgeChange({ style: s }));
      if ((e.style || 'solid') === s) b.classList.add('on');
      bar.append(b);
    }
    bar.append(
      sep(),
      mkBtn('－', t('ui.planner.line2'), () => cb.onEdgeChange && cb.onEdgeChange({ width: (current.width || 2) - 1 })),
      mkBtn('＋', t('ui.planner.lineBold'), () => cb.onEdgeChange && cb.onEdgeChange({ width: (current.width || 2) + 1 })),
      mkBtn('➤', t('ui.planner.toggleHeadArrowTo'), () => {
        const order = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'];
        const i = order.indexOf(current.arrowEnd || 'arrow');
        cb.onEdgeChange && cb.onEdgeChange({ arrowEnd: order[(i + 1) % order.length] });
      }),
      mkBtn('⇄', t('ui.planner.toggle'), () => cb.onFlip && cb.onFlip()),
      mkBtn('⋯', t('ui.planner.propsAll'), () => cb.onMore && cb.onMore()),
      mkBtn('🗑', t('ui.planner.delLineDel'), () => cb.onDeleteEdge && cb.onDeleteEdge(), 'danger'),
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
    left = Math.max(4, Math.min(hw - bw - 4, left));
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
