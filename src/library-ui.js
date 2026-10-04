// library-ui.js — [alpha.168] ชิ้นส่วนหน้าตาแบบ "ห้องสมุด" ที่จัดการเล่มกับจัดการบทใช้ร่วมกัน
//   ตารางปก (หรือรายการ) ซ้าย · แผงรายละเอียดของสิ่งที่เลือกขวา · แถบเครื่องมือ ค้นหา/เรียง/กรอง/มุมมอง ·
//   ลากเรียงด้วยเมาส์ + เส้นแทรก (ตรรกะอยู่ library-view.js)
import { t } from './i18n.js';
import { el, setStatus } from './core.js';
import { gi } from './icons.js';
import { escCancelDrag } from './drag-cancel.js';
import { insertIndexAt, moveTarget, coverHue } from './library-view.js';

/** ป้ายการเรียง — ตารางคีย์เต็ม (ห้ามประกอบคีย์ภาษาจากชิ้นส่วน) */
export const SORT_KEYS = { order: 'ui.lib.sort_order', title: 'ui.lib.sort_title', words: 'ui.lib.sort_words', status: 'ui.lib.sort_status', updated: 'ui.lib.sort_updated' };

/** โครงสองคอลัมน์ */
export function libShell(cls = '') {
  const root = el('div', 'lib' + (cls ? ' ' + cls : ''));
  const main = el('div', 'lib-main');
  const detail = el('aside', 'lib-detail');
  root.append(main, detail);
  return { root, main, detail };
}

/** ปก: รูป · หรือปกที่สร้างจากชื่อ (ไล่สีตามชื่อ + ตัวอักษร) · หรือข้อความปก */
export function coverArt({ url = '', title = '', text = '', off = false, num = '' } = {}) {
  const c = el('div', 'lib-cover' + (off ? ' lib-cover-off' : ''));
  if (url) {
    const im = el('img'); im.src = url; im.alt = ''; im.draggable = false;
    im.onerror = () => { im.remove(); c.append(genCover(title)); };
    c.append(im);
  } else if (text) {
    c.classList.add('lib-cover-text');
    c.append(el('div', 'lib-cover-txt', text));
  } else c.append(genCover(title));
  if (num !== '') c.append(el('span', 'lib-num', String(num)));
  return c;
}
function genCover(title) {
  const g = el('div', 'lib-gen');
  g.style.setProperty('--h', String(coverHue(title)));
  g.append(el('div', 'lib-gen-title', title || ''));
  return g;
}

/** ปุ่มกลุ่มสลับ (pill) — [{ value, label, count }] */
export function pills(list, cur, onPick, cls = '') {
  const w = el('div', 'lib-pills' + (cls ? ' ' + cls : ''));
  for (const p of list) {
    const b = el('button', 'lib-pill' + (p.value === cur ? ' on' : ''));
    if (p.swatch) { const d = el('span', 'lib-pill-dot'); d.style.background = p.swatch; b.append(d); }
    b.append(document.createTextNode(p.label));
    if (p.count != null) b.append(el('span', 'lib-pill-n', String(p.count)));
    b.onclick = () => onPick(p.value);
    w.append(b);
  }
  return w;
}

/** แถบเครื่องมือ: ค้นหา · เรียง · มุมมอง */
export function libToolbar(st, { sorts, onChange, ph }) {
  const bar = el('div', 'lib-tools');
  const q = el('input', 'lib-search'); q.type = 'search'; q.placeholder = ph || t('ui.lib.searchPh'); q.value = st.q || '';
  let tm = 0;
  q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { st.q = q.value; onChange('q'); }, 180); };
  const sortSel = el('select', 'lib-sort k-dlg-select');
  sortSel.title = t('ui.lib.sortTip');
  for (const k of sorts) { const o = el('option', null, t(SORT_KEYS[k])); o.value = k; if (st.sort === k) o.selected = true; sortSel.append(o); }
  sortSel.onchange = () => { st.sort = sortSel.value; onChange('sort'); };
  const dirB = el('button', 'cmp-mini lib-dir', gi(st.dir === 'desc' ? 'sort-descending' : 'sort-ascending'));
  dirB.title = t('ui.lib.dirTip');
  dirB.onclick = () => { st.dir = st.dir === 'desc' ? 'asc' : 'desc'; onChange('dir'); };
  const vw = el('div', 'lib-view');
  for (const [v, ic, key] of [['grid', 'view-grid', 'ui.lib.viewGrid'], ['list', 'view-list', 'ui.lib.viewList']]) {
    const b = el('button', 'cmp-mini' + (st.view === v ? ' on' : ''), gi(ic));
    b.title = t(key); b.setAttribute('aria-label', t(key)); b.dataset.view = v;
    b.onclick = () => { st.view = v; onChange('view'); };
    vw.append(b);
  }
  bar.append(q, sortSel, dirB, vw);
  return bar;
}

/** ช่องสถิติแบบกล่อง (เหมือน Rating · Language · Pages ในภาพอ้างอิง) */
export function statTiles(list) {
  const w = el('div', 'lib-stats');
  for (const s of list) {
    const c = el('div', 'lib-stat');
    c.append(el('div', 'lib-stat-l', s.label), el('div', 'lib-stat-v', s.value));
    w.append(c);
  }
  return w;
}
/** แถวข้อมูล ชื่อ : ค่า */
export function metaRows(rows) {
  const w = el('div', 'lib-meta');
  for (const [label, val] of rows) {
    if (val == null) continue;
    const r = el('div', 'lib-meta-row');
    const v = el('div', 'lib-meta-v');
    if (val instanceof Node) v.append(val); else v.textContent = String(val);
    r.append(el('div', 'lib-meta-l', label), v);
    w.append(r);
  }
  return w;
}

/**
 * ลากเรียงด้วยเมาส์ (ไม่ใช้ HTML5 drag — ไม่มีไฮไลต์กระพริบ · เห็นเส้นแทรก · ลงท้ายสุดได้)
 * @param grid   กล่องที่มีการ์ด (ตาราง/รายการ)
 * @param o.items () → การ์ดตามลำดับที่เห็น · o.idOf(card) → id · o.enabled() → ลากได้ไหมตอนนี้
 * @param o.onMove (fromId, beforeId|null) → ย้ายจริง
 */
export function bindReorder(grid, o) {
  grid.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    const card = e.target.closest('[data-lib-id]');
    if (!card || !grid.contains(card)) return;
    const sx = e.clientX, sy = e.clientY;
    let drag = null;
    const cards = () => o.items();
    const start = () => {
      if (!o.enabled()) { setStatus(t('ui.lib.reorderNeedOrder')); return false; }
      const list = cards();
      const rects = list.map((c) => c.getBoundingClientRect());
      const ghost = card.cloneNode(true);
      ghost.classList.add('lib-ghost');
      const r = card.getBoundingClientRect();
      ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
      document.body.append(ghost);
      const mark = el('div', 'lib-insert');
      document.body.append(mark);
      card.classList.add('lib-dragging');
      document.body.classList.add('lib-reordering');
      drag = { list, rects, ghost, mark, dx: sx - r.left, dy: sy - r.top, idx: -1 };
      return true;
    };
    const mv = (ev) => {
      if (!drag) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
        if (!start()) { cleanup(); return; }
      }
      drag.ghost.style.left = (ev.clientX - drag.dx) + 'px';
      drag.ghost.style.top = (ev.clientY - drag.dy) + 'px';
      const idx = insertIndexAt(drag.rects, ev.clientX, ev.clientY);
      if (idx === drag.idx) return;
      drag.idx = idx;
      const n = drag.rects.length;
      const ref = drag.rects[Math.min(idx, n - 1)];
      const horiz = grid.classList.contains('lib-list');          // รายการ = เส้นแนวนอน
      if (horiz) {
        const y = idx >= n ? ref.top + ref.height + 3 : ref.top - 3;
        Object.assign(drag.mark.style, { left: ref.left + 'px', top: (y - 1) + 'px', width: ref.width + 'px', height: '3px' });
      } else {
        const x = idx >= n ? ref.left + ref.width + 6 : ref.left - 7;
        Object.assign(drag.mark.style, { left: (x - 1) + 'px', top: ref.top + 'px', width: '3px', height: ref.height + 'px' });
      }
      drag.mark.classList.add('on');
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (drag) { drag.ghost.remove(); drag.mark.remove(); card.classList.remove('lib-dragging'); }
      document.body.classList.remove('lib-reordering');
    };
    const offEsc = escCancelDrag(() => { cleanup(); drag = null; });
    const up = async () => {
      offEsc();
      const d = drag;
      cleanup();
      if (!d || d.idx < 0) return;
      grid._suppressClick = true;
      setTimeout(() => { grid._suppressClick = false; }, 0);    // [alpha.168] ปล่อยนอกตาราง = ไม่มี click ตามมา → ธงต้องไม่ค้างกินคลิกถัดไป
      const ids = d.list.map((c) => o.idOf(c));
      const tgt = moveTarget(ids, o.idOf(card), d.idx);
      if (tgt) await o.onMove(o.idOf(card), tgt.beforeId);
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
  // คลิกที่ตามหลังการลาก = ไม่นับเป็นการเลือก
  grid.addEventListener('click', (e) => { if (grid._suppressClick) { grid._suppressClick = false; e.stopPropagation(); } }, true);
}
