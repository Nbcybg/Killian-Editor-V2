// panel-drag.js — ลากหัวแผง/แท็บ → snap zone → dock/tab/float (Photoshop-style)
// ไม่ import panel-renderer.js (กัน circular) — renderer เป็นฝ่าย import ไฟล์นี้
// ตรรกะโซนมาจาก panel-layout.snapZone ล้วน · การเปลี่ยนโครงสร้างสั่งผ่าน PanelManager เท่านั้น
import * as PL from './panel-layout.js';

// px ที่ต้องขยับก่อนถือว่า "ลาก" (ไม่งั้นนับเป็นคลิก)
// บั๊ก #19: 4px น้อยเกินไป — คลิกหัวแผงแล้วมือขยับนิดเดียวก็กลายเป็นลาก → แผงเด้งไป dock/ลอยเอง
const DRAG_MIN = 8;
// บั๊ก #3: "รวมเป็นแท็บ" (โซนกลาง) อนุญาตเฉพาะเมื่อจับที่ชื่อแผง หรือ ~20% ฝั่งขวาของหัวแผง
// จับที่อื่นบนหัวแผง = ลากไปผนึกขอบ (แยกช่อง) ได้อย่างเดียว → เลิกเผลอรวมแท็บโดยไม่ตั้งใจ
export const GROUP_ZONE = 0.2;
// บั๊ก #9: แผงลอยชนขอบแผงลอยอื่น/ขอบหน้าต่าง แล้ว "ดูด" ให้ชิดพอดี
const SNAP_PX = 10;
// 0.56a #5 + #7: แผงลอยต้องอยู่ในจอเสมอ — ต้องเห็นหัวแผงพอที่จะจับลากกลับได้
// (เดิมลากหลุดขอบ/ขยายเกินจอแล้วแผงหายถาวร เรียกกลับไม่ได้)
export const FLOAT_MIN_W = 200, FLOAT_MIN_H = 120;
const KEEP_VISIBLE = 90;                 // px ของแผงที่ต้องโผล่ในจอเสมอ
/** หนีบกล่องแผงลอยให้อยู่ในจอ + ขนาดไม่เล็กเกินจับ */
export function clampFloat(box, vw, vh) {
  const W = vw || window.innerWidth, H = vh || window.innerHeight;
  const w = Math.max(FLOAT_MIN_W, Math.min(Math.round(box.w ?? 320), W));
  const h = Math.max(FLOAT_MIN_H, Math.min(Math.round(box.h ?? 300), H));
  const x = Math.round(Math.min(Math.max(box.x ?? 80, KEEP_VISIBLE - w), W - KEEP_VISIBLE));
  const y = Math.round(Math.min(Math.max(box.y ?? 80, 0), H - 28));   // หัวแผงต้องไม่หลุดขอบล่าง/บน
  return { x, y, w, h };
}

// ───────── overlay บอกโซนที่จะปล่อย ─────────
let _ov = null;
export function createDropOverlay() {
  if (_ov && _ov.el.isConnected) return _ov;
  const box = document.createElement('div');
  box.className = 'k-drop-zone';
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
    destroy() { box.remove(); _ov = null; },
  };
  return _ov;
}

// กรอบที่จะไฮไลต์เมื่อปล่อยโซนนี้ (ครึ่ง/สี่ส่วนของ target)
export function zoneRect(rect, zone) {
  const { x, y, w, h } = rect;
  switch (zone) {
    case 'left':   return { x, y, w: w / 2, h };
    case 'right':  return { x: x + w / 2, y, w: w / 2, h };
    case 'top':    return { x, y, w, h: h / 2 };
    case 'bottom': return { x, y: y + h / 2, w, h: h / 2 };
    default:       return { x, y, w, h };            // center = รวมเป็นแท็บ
  }
}

/**
 * หา panel ที่เมาส์อยู่เหนือ + โซนที่จะผนึก
 * เลือก "ใบที่เล็กที่สุด" ที่ครอบจุดนั้น = ใบในสุด (ลึกสุดของต้นไม้)
 * @returns {{targetId, zone, rect}|null}
 */
export function detectSnapTarget(mx, my, host, excludeId) {
  if (!host) return null;
  let best = null;
  for (const e of host.querySelectorAll('.k-panel[data-panel-id]')) {
    if (e.dataset.panelId === excludeId) continue;
    if (e.closest('.k-float-panel')) continue;       // ไม่ผนึกเข้าแผงลอย
    if (e.offsetParent === null) continue;           // ซ่อนอยู่ (แท็บที่ไม่ active)
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    let zone = PL.snapZone(mx, my, rect);
    if (!zone) continue;
    // ห้ามรวมเป็นแท็บกับ "แผงเอกสาร" — จะบังพื้นที่เขียนทั้งหมด (ปล่อยกลางแผงเอกสาร = ไม่ทำอะไร)
    if (zone === 'center' && e.dataset.panelId === 'docs') continue;
    const area = r.width * r.height;
    if (!best || area < best.area) best = { targetId: e.dataset.panelId, zone, rect, area };
  }
  return best;
}

// ───────── แกนกลาง: ลากอะไรก็ได้ที่แทน panel หนึ่งใบ ─────────
// ctx = { host, onReorder?(clientX, clientY) → true ถ้าจัดการเองแล้ว, ghostLabel }
function startPanelDrag(e, panelId, pm, ctx = {}) {
  if (e.button !== 0) return;
  const host = ctx.host || document.getElementById('app-root') || document.body;
  const sx = e.clientX, sy = e.clientY;
  let moved = false, ghost = null;
  const ov = createDropOverlay();
  let hit = null;

  // 0.56a #5: mouseup ที่เกิดนอกหน้าต่าง/บนแถบหัวหน้าต่าง อาจให้ clientX/Y = 0
  // → แผงเด้งไปมุมซ้ายบนทั้งที่ผู้ใช้ปล่อยตรงกลางจอ · จำพิกัดล่าสุดที่ "ขยับจริง" ไว้ใช้แทน
  let lastX = sx, lastY = sy;
  const move = (ev) => {
    if (ev.clientX || ev.clientY) { lastX = ev.clientX; lastY = ev.clientY; }
    if (!moved) {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < DRAG_MIN) return;
      moved = true;
      document.body.classList.add('k-panel-dragging');
      ghost = document.createElement('div');
      ghost.className = 'k-drag-ghost';
      ghost.textContent = ctx.ghostLabel || panelId;
      document.body.appendChild(ghost);
    }
    if (ghost) { ghost.style.left = (ev.clientX + 12) + 'px'; ghost.style.top = (ev.clientY + 14) + 'px'; }
    if (!ctx.floatOnly) {
      hit = detectSnapTarget(ev.clientX, ev.clientY, host, panelId);
      // บั๊ก #3: โซนกลาง (= รวมเป็นแท็บ) ต้องได้รับอนุญาตก่อน
      if (hit && hit.zone === 'center' && !ctx.allowGroup) hit = null;
      if (hit) ov.show(zoneRect(hit.rect, hit.zone), hit.zone);
      else ov.hide();
    }
  };

  const up = (ev) => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    ov.hide();
    if (ghost) ghost.remove();
    document.body.classList.remove('k-panel-dragging');
    if (!moved) return;                              // คลิกเฉย ๆ → ปล่อยให้ onclick ทำงาน
    const ux = (ev.clientX || ev.clientY) ? ev.clientX : lastX;   // กัน mouseup ที่ให้พิกัด 0,0
    const uy = (ev.clientX || ev.clientY) ? ev.clientY : lastY;
    // จัดลำดับแท็บภายในกลุ่มเดิม (ถ้า caller รองรับ) มาก่อน
    if (ctx.onReorder && ctx.onReorder(ux, uy)) return;
    if (!ctx.floatOnly && hit) {
      if (hit.targetId === panelId) return;
      pm.dockPanel(panelId, hit.zone, hit.targetId);
      return;
    }
    // ปล่อยนอกทุกแผง (หรือ floatOnly ที่ไม่มี hit) → ลอยอิสระตรงตำแหน่งเมาส์ (หนีบให้อยู่ในจอ)
    if (!hit) {
      pm.floatPanel(panelId, clampFloat({ x: ux - 60, y: uy - 12,
                                          w: ctx.floatW || 320, h: ctx.floatH || 300 }));
    }
    // floatOnly && hit → no-op (ไม่ group, ไม่ float)
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
  e.preventDefault();
}

/** จุดที่จับอยู่ในเขตที่อนุญาตให้ "รวมเป็นแท็บ" ไหม (ชื่อแผง หรือ ~20% ฝั่งขวาของหัวแผง) */
export function inGroupHandle(header, clientX) {
  const r = header.getBoundingClientRect();
  if (!r.width) return false;
  return clientX >= r.right - r.width * GROUP_ZONE;
}

/** ลากด้วยหัวแผงที่ผนึกอยู่ → ผนึกขอบ (แยกช่อง) / รวมเป็นแท็บ / ลอยออกมา
 *  บั๊ก #3: รวมเป็นแท็บได้ก็ต่อเมื่อจับที่ "ชื่อแผง" หรือ "~20% ฝั่งขวาของหัวแผง" */
export function makePanelDraggable(header, panelId, pm, ctx = {}) {
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.k-panel-btn') || e.target.closest('.k-panel-ctrls')) return;
    const onTitle = !!e.target.closest('.k-panel-head-title');
    const allowGroup = onTitle || inGroupHandle(header, e.clientX);
    startPanelDrag(e, panelId, pm, { ...ctx, allowGroup });
  });
  header.classList.add('k-can-group');
}

/** ลากแท็บ → จัดลำดับในกลุ่มเดิม · ลากออก = แยก/ผนึกที่อื่น/ลอย */
export function makeTabDraggable(tab, panelId, tabsId, index, pm, ctx = {}) {
  tab.addEventListener('mousedown', (e) => {
    if (e.target.closest('.k-panel-btn')) return;
    const bar = tab.parentNode;
    startPanelDrag(e, panelId, pm, {
      ...ctx,
      allowGroup: true,                                 // ลากหัวแท็บ = ตั้งใจจัดกลุ่มอยู่แล้ว
      ghostLabel: ctx.ghostLabel || tab.textContent.trim(),
      onReorder: (mx, my) => {
        if (!bar) return false;
        const r = bar.getBoundingClientRect();
        if (mx < r.left || mx > r.right || my < r.top || my > r.bottom) return false;
        const sibs = [...bar.querySelectorAll('.k-tab')];
        let to = sibs.length - 1;
        for (let i = 0; i < sibs.length; i++) {
          const sr = sibs[i].getBoundingClientRect();
          const mid = bar.classList.contains('k-vertical') ? sr.top + sr.height / 2 : sr.left + sr.width / 2;
          const p = bar.classList.contains('k-vertical') ? my : mx;
          if (p < mid) { to = i; break; }
        }
        if (to !== index) pm.moveTab(tabsId, index, to);
        return true;
      },
    });
  });
}

/** ขอบที่แผงลอยตัวอื่น (และขอบหน้าต่าง) มีอยู่ — ใช้ "ดูด" ให้ชิดพอดี (บั๊ก #9) */
function snapEdges(selfEl) {
  const xs = [0, window.innerWidth], ys = [0, window.innerHeight];
  for (const p of document.querySelectorAll('.k-float-panel')) {
    if (p === selfEl) continue;
    const r = p.getBoundingClientRect();
    xs.push(r.left, r.right); ys.push(r.top, r.bottom);
  }
  return { xs, ys };
}
/** ดูดตำแหน่ง (x,y) ให้ชิดขอบที่ใกล้ที่สุดภายใน SNAP_PX — คืน {x,y,snapped} */
export function snapToEdges(x, y, w, h, edges, tol = SNAP_PX) {
  let sx = x, sy = y, snapped = false;
  for (const e of edges.xs) {
    if (Math.abs(x - e) <= tol) { sx = e; snapped = true; break; }
    if (Math.abs(x + w - e) <= tol) { sx = e - w; snapped = true; break; }
  }
  for (const e of edges.ys) {
    if (Math.abs(y - e) <= tol) { sy = e; snapped = true; break; }
    if (Math.abs(y + h - e) <= tol) { sy = e - h; snapped = true; break; }
  }
  return { x: sx, y: sy, snapped };
}

/** ลากหัวแผงลอย
 *  · จับที่ "ชื่อแผง" = ผนึกกลับได้ทุกโซน (ขอบ = แยกช่อง · กลาง = รวมเป็นแท็บ)
 *  · จับที่อื่นบนหัว = ย้ายตำแหน่งอย่างเดียว + ชนขอบแผงลอยอื่น/ขอบจอแล้ว snap (บั๊ก #9)
 */
export function makeFloatDraggable(header, popup, panelId, pm, ctx = {}) {
  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.k-panel-btn')) return;
    const host = ctx.host || document.getElementById('app-root') || document.body;
    const canDock = !!e.target.closest('.k-panel-head-title') || inGroupHandle(header, e.clientX);
    const sx = e.clientX, sy = e.clientY;
    const x0 = popup.offsetLeft, y0 = popup.offsetTop;
    const ov = createDropOverlay();
    const edges = snapEdges(popup);
    let hit = null, moved = false;
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < DRAG_MIN) return;
      moved = true;
      const w = popup.offsetWidth, h = popup.offsetHeight;
      const s = snapToEdges(x0 + ev.clientX - sx, y0 + ev.clientY - sy, w, h, edges);
      popup.style.left = s.x + 'px';
      popup.style.top = s.y + 'px';
      popup.classList.toggle('k-float-snapped', s.snapped);
      hit = canDock ? detectSnapTarget(ev.clientX, ev.clientY, host, panelId) : null;
      if (hit) ov.show(zoneRect(hit.rect, hit.zone), hit.zone);
      else ov.hide();
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      ov.hide();
      popup.classList.remove('k-float-snapped');
      if (!moved) return;
      // ถ้ามีอะไร re-render แผงระหว่างลาก popup จะหลุดจากหน้า → offset* เป็น 0 หมด
      // เขียนต่อ = แผงเด้งไปมุมซ้ายบน ปล่อยผ่านดีกว่า (บั๊ก: คลิกค้างแล้วแผงรีเซ็ต)
      if (!popup.isConnected) return;
      if (hit) { pm.dockPanel(panelId, hit.zone, hit.targetId); return; }
      // 0.56a #7: ลากหลุดขอบจอแล้วเรียกกลับไม่ได้ → หนีบตำแหน่งให้ยังเห็นหัวแผงเสมอ
      const c = clampFloat({ x: popup.offsetLeft, y: popup.offsetTop,
                             w: popup.offsetWidth, h: popup.offsetHeight });
      popup.style.left = c.x + 'px'; popup.style.top = c.y + 'px';
      pm.moveFloat(panelId, { x: c.x, y: c.y });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
}
