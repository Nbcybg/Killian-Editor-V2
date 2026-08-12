// planner-ui.js — DOM UI Layer สำหรับ Planner v4
//
// แก้บั๊ก 7 (ปุ่มหายเมื่อแผงแคบ): แถบเครื่องมือไม่ wrap แล้ว → เลื่อนแนวนอนได้ + มีปุ่ม ◀ ▶
//     และเครื่องมือวาดย้ายไป "รางเครื่องมือ" แนวตั้งแบบ Miro ที่ไม่กินความกว้าง
// แก้บั๊ก 6 (กริด): ป๊อปอัปตั้งค่ากริด — เปิด/ปิด · ขนาด · สแนป · รูปแบบ · ความเข้ม
// แก้บั๊ก 8 (x y): แถบสถานะล่างบอกพิกัดเคอร์เซอร์ · ซูม · จำนวนวัตถุ · สถานะบันทึก
import { T } from '../i18n.js';
import { el } from '../core.js';
import { STATUSES, SHAPES, GRID_STYLES } from './planner-data.js';

const SHAPE_LABEL = {
  rect: T`▭ สี่เหลี่ยม`, round: T`▢ มุมมน`, ellipse: T`⬭ วงรี`, diamond: T`◇ ข้าวหลามตัด`,
  triangle: T`△ สามเหลี่ยม`, star: T`☆ ดาว`, arrow: T`➜ ลูกศร`, cylinder: T`⛁ ทรงกระบอก`,
};

const TOOL_DEFS = [
  { tool: 'select',    icon: '⬉', label: T`เลือก / ย้าย`, key: 'V' },
  { tool: 'hand',      icon: '✋', label: T`มือ (เลื่อนกระดาน)`, key: 'H' },
  { sep: true },
  { tool: 'sticky',    icon: '📌', label: T`โพสต์อิต`, key: 'N' },
  { tool: 'text',      icon: '🅃', label: T`ข้อความ`, key: 'T' },
  { tool: 'shape',     icon: '⬛', label: T`รูปทรง`, key: 'S', hasMenu: true },
  { tool: 'frame',     icon: '🖼', label: T`เฟรม`, key: 'F' },
  { tool: 'comment',   icon: '💬', label: T`คอมเมนต์`, key: 'C' },
  { tool: 'connector', icon: '↝', label: T`เส้นเชื่อม`, key: 'L' },
  { sep: true },
  { tool: 'scene',     icon: '📄', label: T`การ์ดฉาก` },
  { tool: 'chapter',   icon: '📁', label: T`การ์ดบท` },
  { tool: 'entity',    icon: '👤', label: T`การ์ด Wiki` },
  { tool: 'note',      icon: '📝', label: T`การ์ดโน้ต` },
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
    if (b) b.title = T`รูปทรง (S) — ` + (SHAPE_LABEL[s] || s);
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
  const left = el('button', 'planner-scroll-btn', '‹'); left.title = T`เลื่อนซ้าย`;
  const right = el('button', 'planner-scroll-btn', '›'); right.title = T`เลื่อนขวา`;
  const strip = el('div', 'planner-toolbar-strip');

  strip.innerHTML = T`
    <span class="planner-board-name" id="pl-boardname" title="กระดานที่เปิดอยู่">กระดานหลัก</span>
    <span class="planner-dirty" id="pl-dirty" title="ยังไม่ได้บันทึก">●</span>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="new" title="กระดานใหม่">✚ ใหม่</button>
    <button class="planner-btn" data-action="open" title="เปิดกระดานอื่น">📂 เปิด</button>
    <button class="planner-btn k-ok" data-action="save" title="บันทึก (Ctrl+S)">💾 บันทึก</button>
    <button class="planner-btn" data-action="save-as" title="บันทึกเป็นไฟล์ใหม่">💾… บันทึกเป็น</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="undo" title="ย้อนกลับ (Ctrl+Z)">↶</button>
    <button class="planner-btn" data-action="redo" title="ทำซ้ำ (Ctrl+Shift+Z)">↷</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="group" title="จัดกลุ่ม (Ctrl+G)">🗂 จัดกลุ่ม</button>
    <button class="planner-btn" data-action="duplicate" title="ทำซ้ำ (Ctrl+D)">⧉ ทำซ้ำ</button>
    <button class="planner-btn" data-action="reveal" title="ชี้ตำแหน่งไฟล์ใน Explorer">📂 ในเอกสาร</button>
    <button class="planner-btn" data-action="delete" title="ลบ (Del)">🗑 ลบ</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="auto-layout" title="จัดเรียงอัตโนมัติ">📐 จัดเรียง</button>
    <button class="planner-btn" data-action="grid" title="ตั้งค่ากริด">▦ กริด</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="zoom-out" title="ซูมออก (Ctrl+-)">➖</button>
    <button class="planner-btn planner-zoom-label" data-action="zoom-reset" title="ซูม 100% (Ctrl+0)" id="pl-zoom">100%</button>
    <button class="planner-btn" data-action="zoom-in" title="ซูมเข้า (Ctrl+=)">➕</button>
    <button class="planner-btn" data-action="zoom-fit" title="พอดีจอ">⊡ พอดีจอ</button>
    <span class="planner-sep"></span>
    <button class="planner-btn" data-action="export-png" title="ส่งออกเป็นรูป">🖼 PNG</button>
    <button class="planner-btn" data-action="sample" title="ใส่ตัวอย่าง">🧪 ตัวอย่าง</button>
  `;

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
  wrap.setBoardName = (name) => { const n = strip.querySelector('#pl-boardname'); if (n) { n.textContent = name; n.title = T`กระดาน: ` + name; } };
  wrap.setDirty = (d) => { wrap.classList.toggle('is-dirty', !!d); };
  setTimeout(syncArrows, 0);
  return wrap;
}

/** ป๊อปอัปตั้งค่ากริด (บั๊ก 6) */
function _gridPopover(anchor, cb) {
  document.querySelectorAll('.planner-popover').forEach((p) => p.remove());
  const g = (cb.getGrid && cb.getGrid()) || { show: true, size: 20, snap: false, style: 'dots', opacity: 0.9, color: '#3a3936' };
  const pop = el('div', 'planner-popover planner-grid-pop');
  pop.innerHTML = T`
    <div class="planner-pop-title">▦ กริด</div>
    <label class="planner-pop-row"><input type="checkbox" id="plg-show"${g.show ? ' checked' : ''}> แสดงกริด</label>
    <label class="planner-pop-row"><input type="checkbox" id="plg-snap"${g.snap ? ' checked' : ''}> ดูดเข้าเส้นกริด (snap)</label>
    <div class="planner-pop-row"><span>ขนาด</span>
      <input type="number" id="plg-size" min="4" max="400" step="1" value="${g.size}"> px</div>
    <div class="planner-pop-row"><span>รูปแบบ</span>
      <select id="plg-style">${GRID_STYLES.map((s) => `<option value="${s}"${g.style === s ? ' selected' : ''}>${s === 'dots' ? T`จุด` : s === 'lines' ? T`เส้น` : T`กากบาท`}</option>`).join('')}</select></div>
    <div class="planner-pop-row"><span>ความเข้ม</span>
      <input type="range" id="plg-op" min="0" max="1" step="0.05" value="${g.opacity}"></div>
    <div class="planner-pop-row"><span>สีเส้น</span><input type="color" id="plg-color" value="${g.color || '#3a3936'}"></div>
    <div class="planner-pop-row"><span>สีพื้น</span><input type="color" id="plg-bg" value="${(cb.getBackground && cb.getBackground()) || '#262624'}"></div>
    <div class="planner-pop-row planner-pop-presets">
      <button data-size="10">10</button><button data-size="20">20</button>
      <button data-size="25">25</button><button data-size="50">50</button><button data-size="100">100</button>
    </div>
  `;
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
  bar.innerHTML = T`
    <input class="planner-filter-input" id="pl-f-text" placeholder="🔍 กรอง — ชื่อ / สรุป / แท็ก">
    <select class="planner-filter-sel" id="pl-f-type">
      <option value="">ทุกประเภท</option>
      <option value="scene">📄 ฉาก</option>
      <option value="chapter">📁 บท</option>
      <option value="entity">👤 Wiki</option>
      <option value="note">📝 โน้ต</option>
      <option value="sticky">📌 โพสต์อิต</option>
      <option value="text">🅃 ข้อความ</option>
      <option value="shape">⬛ รูปทรง</option>
      <option value="frame">🖼 เฟรม</option>
      <option value="comment">💬 คอมเมนต์</option>
    </select>
    <select class="planner-filter-sel" id="pl-f-status">
      <option value="">ทุกสถานะ</option>
      ${STATUSES.filter(Boolean).map((s) => `<option value="${s}">${s}</option>`).join('')}
    </select>
    <button class="planner-btn-small" id="pl-f-clear">ล้าง</button>
  `;

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
  bar.innerHTML = T`
    <span class="planner-st-tool" id="pl-st-tool">เลือก</span>
    <span class="planner-st-xy" id="pl-st-xy">x — · y —</span>
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
    if (n) n.textContent = g ? `▦ ${g.size}px${g.snap ? ' · snap' : ''}${g.show ? '' : T` · ซ่อน`}` : '';
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
    custom.title = T`สีอื่น…`;
    custom.oninput = () => cb.onNodeChange && cb.onNodeChange({ color: custom.value });
    sw.appendChild(custom);
    bar.append(sw, sep());

    const tc = document.createElement('input');
    tc.type = 'color'; tc.className = 'planner-ctx-color planner-ctx-textcolor';
    tc.value = /^#[0-9a-f]{6}$/i.test(n.textColor || '') ? n.textColor : '#faf9f5';
    tc.title = T`สีตัวอักษร`;
    tc.oninput = () => cb.onNodeChange && cb.onNodeChange({ textColor: tc.value });
    bar.append(tc);
    bar.append(
      mkBtn('A－', T`ตัวอักษรเล็กลง`, () => cb.onNodeChange && cb.onNodeChange({ fontSize: (current.fontSize || 12) - 1 })),
      mkBtn('A＋', T`ตัวอักษรใหญ่ขึ้น`, () => cb.onNodeChange && cb.onNodeChange({ fontSize: (current.fontSize || 12) + 1 })),
      sep(),
      sep(),
      mkBtn('⬆', T`ยกไปบนสุด (Ctrl+Shift+])`, () => cb.onOrder && cb.onOrder('front')),
      mkBtn('⬇', T`ส่งไปล่างสุด (Ctrl+Shift+[)`, () => cb.onOrder && cb.onOrder('back')),
      sep(),
      mkBtn(n.locked ? '🔒' : '🔓', n.locked ? T`ปลดล็อก` : T`ล็อกไม่ให้ย้าย`,
            () => cb.onNodeChange && cb.onNodeChange({ locked: !current.locked })),
      mkBtn('⧉', T`ทำซ้ำ (Ctrl+D)`, () => cb.onDuplicate && cb.onDuplicate()),
      mkBtn('⋯', T`คุณสมบัติทั้งหมด`, () => cb.onMore && cb.onMore()),
      mkBtn('🗑', T`ลบ (Del)`, () => cb.onDelete && cb.onDelete(), 'danger'),
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
    custom.title = T`สีอื่น…`;
    custom.oninput = () => cb.onEdgeChange && cb.onEdgeChange({ color: custom.value });
    sw.appendChild(custom);
    bar.append(sw, sep());
    for (const [r, ic, tip] of [['straight', '╱', T`เส้นตรง`], ['orthogonal', '⌐', T`หักมุมฉาก`], ['curved', '⌒', T`โค้ง`]]) {
      const b = mkBtn(ic, tip, () => cb.onEdgeChange && cb.onEdgeChange({ routing: r }));
      if ((e.routing || 'straight') === r) b.classList.add('on');
      bar.append(b);
    }
    bar.append(sep());
    for (const [s, ic, tip] of [['solid', '──', T`ทึบ`], ['dashed', '╌╌', T`ประ`], ['dotted', '···', T`จุด`]]) {
      const b = mkBtn(ic, tip, () => cb.onEdgeChange && cb.onEdgeChange({ style: s }));
      if ((e.style || 'solid') === s) b.classList.add('on');
      bar.append(b);
    }
    bar.append(
      sep(),
      mkBtn('－', T`เส้นบางลง`, () => cb.onEdgeChange && cb.onEdgeChange({ width: (current.width || 2) - 1 })),
      mkBtn('＋', T`เส้นหนาขึ้น`, () => cb.onEdgeChange && cb.onEdgeChange({ width: (current.width || 2) + 1 })),
      mkBtn('➤', T`สลับหัวลูกศรปลายทาง`, () => {
        const order = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'];
        const i = order.indexOf(current.arrowEnd || 'arrow');
        cb.onEdgeChange && cb.onEdgeChange({ arrowEnd: order[(i + 1) % order.length] });
      }),
      mkBtn('⇄', T`สลับทิศ`, () => cb.onFlip && cb.onFlip()),
      mkBtn('⋯', T`คุณสมบัติทั้งหมด`, () => cb.onMore && cb.onMore()),
      mkBtn('🗑', T`ลบเส้น (Del)`, () => cb.onDeleteEdge && cb.onDeleteEdge(), 'danger'),
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
    ? T`แสดง ${filtered.shown}/${filtered.total} การ์ด`
    : T`${stats.nodes} วัตถุ · ${stats.edges} เส้น · ${stats.groups} กลุ่ม`;
}

export const TOOL_LABELS = TOOL_DEFS.filter((d) => !d.sep)
  .reduce((m, d) => { m[d.tool] = d.label; return m; }, {});
