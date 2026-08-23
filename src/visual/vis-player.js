// vis-player.js — มุมมองเต็มจอของ "เล่าด้วยภาพ" (สไลด์แบบ Ren'Py)
//
// **รูปกินเต็มจอจริง ๆ** (ข้อ 7) — ข้อความเป็นแผ่นซ้อนทับด้านล่าง กดซ่อน/โชว์ได้ (ปุ่ม 👁 หรือคีย์ H)
// อ่านอย่างเดียวล้วน ๆ — ไม่มีทางเขียนอะไรกลับไฟล์จากที่นี่
import { el, state, t, tf } from '../core.js';
import { displayText, liveText, resolveRow } from './vis-core.js';

let _cur = null;      // ตัวเล่นที่เปิดอยู่ (เปิดซ้อนกันไม่ได้)

/**
 * @param {object} st สถานะที่ vis-ui สร้างไว้ ({rows, lines, sceneTitle, ...})
 * @param {number} [startAt] เริ่มที่แถวไหน
 */
export function openVisPlayer(st, startAt = 0) {
  if (_cur) closeVisPlayer();
  const rows = (st && st.rows) || [];
  if (!rows.length) return null;
  const lines = (st && st.lines) || [];

  let i = Math.max(0, Math.min(rows.length - 1, startAt | 0));
  let hidden = false;
  const ov = el('div', 'vis-player');
  ov.tabIndex = 0;

  // เวทีกินทั้งจอ · รูปทับเต็มพื้นที่ · ทุกอย่างอื่นลอยอยู่ข้างบน
  const stage = el('div', 'vis-pl-stage');
  const img = el('img', 'vis-pl-img');
  const noimg = el('div', 'vis-pl-noimg', t('ui.vis.noImage'));
  stage.append(img, noimg);

  const boxWrap = el('div', 'vis-pl-box');
  const scene = el('div', 'vis-pl-scene', st.sceneTitle || '');
  const text = el('div', 'vis-pl-text');
  const remark = el('div', 'vis-pl-remark');
  boxWrap.append(scene, text, remark);

  const nav = el('div', 'vis-pl-nav');
  const prev = el('button', 'vis-pl-btn vis-pl-prev', '◀');
  prev.title = t('ui.vis.prev');
  const counter = el('span', 'vis-pl-count');
  const next = el('button', 'vis-pl-btn vis-pl-next', '▶');
  next.title = t('ui.vis.next');
  const eye = el('button', 'vis-pl-btn vis-pl-eye', '👁');
  eye.title = t('ui.vis.toggleText');
  const close = el('button', 'vis-pl-btn vis-pl-close', '✕');
  close.title = t('ui.vis.close');
  nav.append(prev, counter, next, eye, close);

  ov.append(stage, boxWrap, nav);
  document.body.append(ov);

  const draw = async () => {
    const r = rows[i];
    if (r.image) {
      img.src = await kapi.toFileURL(await kapi.join(state.root, 'Images', r.image));
      img.style.display = '';
      noimg.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      noimg.style.display = '';
    }
    // เนื้อสดจากฉาก (บรรทัดที่ผูกทั้งหมด) — ตกไปใช้สำเนาในไฟล์ถ้าหาต้นทางไม่เจอ
    const live = liveText(resolveRow(r, lines));
    text.textContent = displayText(live || r.text);
    remark.textContent = r.remark || '';
    remark.style.display = r.remark ? '' : 'none';
    counter.textContent = tf('ui.vis.ofTotal', i + 1, rows.length);
    prev.disabled = i === 0;
    next.disabled = i === rows.length - 1;
  };
  const go = (d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    i = j;
    draw();
  };
  const toggleText = () => {
    hidden = !hidden;
    ov.classList.toggle('text-off', hidden);
    eye.classList.toggle('on', hidden);
  };
  prev.onclick = (e) => { e.stopPropagation(); go(-1); };
  next.onclick = (e) => { e.stopPropagation(); go(1); };
  eye.onclick = (e) => { e.stopPropagation(); toggleText(); };
  close.onclick = (e) => { e.stopPropagation(); closeVisPlayer(); };
  // คลิกครึ่งซ้าย = ย้อน · ครึ่งขวา = เดินหน้า (เหมือนอ่านสไลด์)
  stage.onclick = (e) => go(e.clientX < window.innerWidth / 2 ? -1 : 1);
  boxWrap.onclick = () => go(1);

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); return closeVisPlayer(); }
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); return go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); return go(-1); }
    if (e.key === 'Home') { e.preventDefault(); i = 0; return draw(); }
    if (e.key === 'End') { e.preventDefault(); i = rows.length - 1; return draw(); }
    // จับด้วย e.code = ปุ่มกายภาพ → ใช้ได้ทุกแป้นพิมพ์ (กฎของโปรเจกต์)
    if (e.code === 'KeyH') { e.preventDefault(); return toggleText(); }
  };
  document.addEventListener('keydown', onKey, true);

  _cur = { ov, onKey, at: () => i, go, draw, toggleText, isHidden: () => hidden };
  ov.focus();
  draw();
  return _cur;
}

export function closeVisPlayer() {
  if (!_cur) return false;
  document.removeEventListener('keydown', _cur.onKey, true);
  _cur.ov.remove();
  _cur = null;
  return true;
}
export function visPlayerOpen() { return !!_cur; }
export function visPlayerAt() { return _cur ? _cur.at() : -1; }
export function visPlayerGo(d) { if (_cur) _cur.go(d); }
export function visPlayerTextHidden() { return !!(_cur && _cur.isHidden()); }
export function visPlayerToggleText() { if (_cur) _cur.toggleText(); }
