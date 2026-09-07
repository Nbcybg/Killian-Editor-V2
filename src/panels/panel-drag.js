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
    show(rect, zone, kind) {
      box.dataset.zone = zone || '';
      box.dataset.kind = kind || 'insert';           // [66r3] แทรก / รวมกลุ่ม / แท็บ / ขอบจอ — คนละหน้าตา
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

// ความหนาของแถบ "สร้าง dock ใหม่เต็มด้าน" ที่โชว์ตอนลากไปชนขอบพื้นที่ทำงาน
const EDGE_BAR = 46;

// กรอบที่จะไฮไลต์เมื่อปล่อยโซนนี้
// [alpha.66r3] สเปกแยกสามหน้าตา: **แทรก** = ครึ่งพื้นที่ + เส้นหนาตรงขอบที่จะแทรก (CSS ใส่ให้)
// · **รวมกลุ่ม** = กรอบคลุมทั้งใบ · **ขอบจอ** = แถบยาวเต็มด้าน (จะได้ dock ใหม่ทั้งคอลัมน์/แถว)
export function zoneRect(rect, zone, kind) {
  const { x, y, w, h } = rect;
  if (kind === 'edge') {
    const t = Math.min(EDGE_BAR, (zone === 'left' || zone === 'right' ? w : h) / 2);
    switch (zone) {
      case 'left':   return { x, y, w: t, h };
      case 'right':  return { x: x + w - t, y, w: t, h };
      case 'top':    return { x, y, w, h: t };
      default:       return { x, y: y + h - t, w, h: t };
    }
  }
  switch (zone) {
    case 'left':   return { x, y, w: w / 2, h };
    case 'right':  return { x: x + w / 2, y, w: w / 2, h };
    case 'top':    return { x, y, w, h: h / 2 };
    case 'bottom': return { x, y: y + h / 2, w, h: h / 2 };
    default:       return { x, y, w, h };            // center = รวมเป็นแท็บ
  }
}

const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/**
 * หาเป้าหมายที่จะปล่อย + โซน — ตามตารางในสเปก เรียงตาม **ลำดับความสำคัญ** และคืนแค่ตัวที่ดีที่สุด
 *
 *   1. หัวแท็บใบใดใบหนึ่ง → `kind:'tab'`  แทรกเป็นแท็บตรงตำแหน่งนั้นทันที (กรอบเล็กครอบแท็บ)
 *   2. ขอบพื้นที่ทำงาน  → `kind:'edge'`   สร้าง dock ใหม่เต็มด้านนั้น (แถบยาวเต็มขอบ)
 *   3. ขอบของแผง        → `kind:'insert'` แทรกเป็นช่องใหม่ (ครึ่งพื้นที่ + เส้นบอกด้าน)
 *   4. กลางแผง          → `kind:'merge'`  รวมเป็นแท็บในกลุ่มนั้น (กรอบคลุมทั้งใบ)
 *
 * ทำไมหัวแท็บต้องมาก่อนขอบจอ: dock ฝั่งซ้าย/ขวา **ชิดขอบจออยู่แล้ว** แถบแท็บของมันจึงตกอยู่ใน
 * เขตขอบเสมอ — ถ้าให้ขอบชนะ จะเล็งวางลงแท็บของ dock ข้างไม่ได้เลยสักครั้ง (เจอตอน e2e)
 * ส่วนที่เหลือของขอบ (ใต้แถบแท็บลงไป) ยังให้โซนขอบตามปกติ
 *
 * ในข้อ 3–4 เลือก "ใบที่เล็กที่สุด" ที่ครอบจุดนั้น = ใบในสุดของต้นไม้
 * @returns {{targetId, zone, rect, kind, tabIndex?}|null}
 */
export function detectSnapTarget(mx, my, host, excludeId) {
  if (!host) return null;
  // (0) [alpha.66r7] หัว/แถบแท็บของ "กล่องลอย" — ปล่อยตรงนี้ = รวมเข้ากลุ่มลอยนั้น
  for (const fp of document.querySelectorAll('.k-float-panel[data-float-id]')) {
    if (fp.dataset.panelId === excludeId) continue;
    const head = fp.querySelector(':scope > .k-panel-head, :scope > .k-float-tabbar');
    if (!head) continue;
    const r = head.getBoundingClientRect();
    if (!r.width || mx < r.left || mx > r.right || my < r.top || my > r.bottom) continue;
    return { kind: 'floatgroup', zone: 'center', targetId: fp.dataset.floatId, rect: box(r) };
  }
  // (1) หัวแท็บ — เป็นการเล็งที่เจาะจงที่สุด ("วางเป็นแท็บลำดับนี้") จึงมาก่อนทุกอย่าง
  for (const tab of host.querySelectorAll('.k-tab[data-panel-id]')) {
    const pid = tab.dataset.panelId;
    if (pid === excludeId || pid === 'docs') continue;
    const r = tab.getBoundingClientRect();
    if (!r.width || mx < r.left || mx > r.right || my < r.top || my > r.bottom) continue;
    return { kind: 'tab', zone: 'center', targetId: pid, rect: box(r), tabIndex: +tab.dataset.index || 0 };
  }
  // (2) ขอบของ "พื้นที่ทำงาน" (ไม่รวมแถบเครื่องมือ/แถบสถานะ — สองตัวนั้นต้องอยู่บน/ล่างสุดเสมอ)
  const wsEl = host.querySelector('.k-workspace') || host;
  const wsR = wsEl.getBoundingClientRect();
  if (wsR.width && wsR.height) {
    const ez = PL.edgeZone(mx, my, box(wsR));
    if (ez) return { kind: 'edge', zone: ez, rect: box(wsR), targetId: null };
  }
  // (3)+(4) กรอบของแผง
  let best = null;
  for (const e of host.querySelectorAll('.k-panel[data-panel-id]')) {
    if (e.dataset.panelId === excludeId) continue;
    if (e.closest('.k-float-panel')) continue;       // ไม่ผนึกเข้าแผงลอย
    if (e.offsetParent === null) continue;           // ซ่อนอยู่ (แท็บที่ไม่ active)
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const rect = box(r);
    const zone = PL.snapZone(mx, my, rect);
    if (!zone) continue;
    // ห้ามรวมเป็นแท็บกับ "แผงเอกสาร" — จะบังพื้นที่เขียนทั้งหมด (ปล่อยกลางแผงเอกสาร = ไม่ทำอะไร)
    if (zone === 'center' && e.dataset.panelId === 'docs') continue;
    const area = r.width * r.height;
    if (!best || area < best.area) {
      best = { targetId: e.dataset.panelId, zone, rect, area, kind: zone === 'center' ? 'merge' : 'insert' };
    }
  }
  return best;
}

/** ลงมือย้ายจริงตามเป้าที่ปล่อย (ใช้ร่วมกันทั้งลากหัวแผง ลากแท็บ และลากแผงลอย) */
export function applyDrop(pm, panelId, hit, ctx = {}) {
  if (!hit) return false;
  // ลากทั้ง "กล่องลอย" (กลุ่ม) ไปผนึก — ต้องย้ายทั้งก้อน ไม่ใช่ทีละแผง
  const draggingGroup = !!(ctx.floatId
    && (pm.floats || []).some((f) => f.id === ctx.floatId && f.panel && f.panel.type === 'tabs'));
  if (draggingGroup && hit.kind !== 'floatgroup') {
    if (hit.kind === 'tab' || hit.kind === 'merge') return false;      // กลุ่มซ้อนกลุ่ม — ไม่รองรับ
    // [alpha.66r11] ปล่อยทั้งกลุ่มที่ "ขอบพื้นที่ทำงาน" = ผนึกเต็มด้านนั้น (เหมือนแผงเดี่ยว)
    return pm.dockFloatGroup(ctx.floatId, hit.zone, hit.targetId,
      { edge: hit.kind === 'edge', isFixedPanel: ctx.isFixedPanel });
  }
  if (hit.kind === 'floatgroup') return pm.groupIntoFloat(panelId, hit.targetId);
  if (hit.kind === 'edge') return pm.dockAtEdge(panelId, hit.zone, ctx.isFixedPanel);
  if (hit.kind === 'tab') return pm.addTabAt(panelId, hit.targetId, hit.tabIndex);
  if (hit.targetId === panelId) return false;
  return pm.dockPanel(panelId, hit.zone, hit.targetId);
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
      // บั๊ก #3: "รวมเป็นแท็บ" แบบปล่อยกลางแผง ต้องได้รับอนุญาตก่อน (กันเผลอจับกลุ่ม)
      // แต่การปล่อยลง **หัวแท็บ** หรือ **ขอบจอ** เป็นการเล็งที่ชัดเจนอยู่แล้ว — อนุญาตเสมอ
      if (hit && hit.kind === 'merge' && !ctx.allowGroup) hit = null;
      if (hit) ov.show(zoneRect(hit.rect, hit.zone, hit.kind), hit.zone, hit.kind);
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
    if (!ctx.floatOnly && hit) { applyDrop(pm, panelId, hit, ctx); return; }
    // ปล่อยนอกทุกแผง (หรือ floatOnly ที่ไม่มี hit) → ลอยอิสระตรงตำแหน่งเมาส์ (หนีบให้อยู่ในจอ)
    // [alpha.66r5] ขนาดต้องเป็น **ขนาดที่แผงมีอยู่ตอนยังผนึกอยู่** ไม่ใช่ 320×300 ตายตัว
    // (อาการเดิม: ลากแผงออกมาลอยทีไร ขนาดถูกรีเซ็ตทุกครั้ง)
    if (!hit) {
      const box = ctx.floatBox ? ctx.floatBox() : null;
      // [66r12] `box` = ขนาดที่แผงมีอยู่ตอนยังผนึก → บอก store ให้หนีบความสูงด้วยค่าอ้างอิง
      pm.floatPanel(panelId, clampFloat({ x: ux - 60, y: uy - 12,
                                          w: (box && box.w) || ctx.floatW || 320,
                                          h: (box && box.h) || ctx.floatH || 300 }), { fromDock: !!box });
    }
    // floatOnly && hit → no-op (ไม่ group, ไม่ float)
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
  e.preventDefault();
}

/**
 * จุดที่จับอยู่ในเขตที่อนุญาตให้ "รวมเป็นแท็บ / ผนึกเข้าเวิร์กสเปซ" ไหม
 *
 * [alpha.65r] เดิมนับ "~20% ฝั่งขวาของหัวแผง" ซึ่งเป็นที่อยู่ของปุ่ม ▾ ซ่อน / ✕ ปิด พอดี
 * → ลากพลาดตรงนั้นทีไรกลายเป็นจับกลุ่มแผงทุกที · ตอนนี้เอาเฉพาะ "พื้นที่ชื่อแผง" เท่านั้น
 */
export function inGroupHandle(header, clientX) {
  const t = header.querySelector('.k-panel-head-title');
  if (!t) return false;
  const r = t.getBoundingClientRect();
  if (!r.width) return false;
  const ic = header.querySelector('.k-panel-head-icon');
  const left = ic ? Math.min(ic.getBoundingClientRect().left, r.left) : r.left;
  return clientX >= left && clientX <= r.right;
}

/** ลากด้วยหัวแผงที่ผนึกอยู่ → ผนึกขอบ (แยกช่อง) / รวมเป็นแท็บ / ลอยออกมา
 *  บั๊ก #3 + [alpha.65r]: รวมเป็นแท็บได้ก็ต่อเมื่อจับที่ "ชื่อแผง" เท่านั้น */
/** ขนาดที่แผงมีอยู่จริงบนจอตอนนี้ — ใช้เป็นขนาดตั้งต้นเวลาลากออกมาลอย */
export function panelBoxOf(panelId, host) {
  const root = host || document;
  const e = root.querySelector(`.k-panel[data-panel-id="${panelId}"]`);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return r.width > 40 && r.height > 40 ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
}

export function makePanelDraggable(header, panelId, pm, ctx = {}) {
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.k-panel-btn') || e.target.closest('.k-panel-ctrls')
        || e.target.closest('.k-panel-btns')) return;
    const onTitle = !!e.target.closest('.k-panel-head-title') || !!e.target.closest('.k-panel-head-icon');
    const allowGroup = onTitle && inGroupHandle(header, e.clientX);
    // จับขนาดไว้ตั้งแต่ก่อนเริ่มลาก (ตอนปล่อย แผงอาจถูกถอดออกจาก DOM ไปแล้ว)
    const box = panelBoxOf(panelId, ctx.host);
    startPanelDrag(e, panelId, pm, { ...ctx, allowGroup, floatBox: () => box });
  });
  header.classList.add('k-can-group');
}

/** ลากแท็บ → จัดลำดับในกลุ่มเดิม · ลากออก = แยก/ผนึกที่อื่น/ลอย */
export function makeTabDraggable(tab, panelId, tabsId, index, pm, ctx = {}) {
  tab.addEventListener('mousedown', (e) => {
    if (e.target.closest('.k-panel-btn')) return;
    const bar = tab.parentNode;
    const box = panelBoxOf(panelId, ctx.host);          // ขนาดเดิมก่อนถูกลากออก
    startPanelDrag(e, panelId, pm, {
      ...ctx,
      floatBox: () => box,
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
    if (e.target.closest('.k-panel-btn') || e.target.closest('.k-panel-ctrls')
        || e.target.closest('.k-panel-btns')) return;
    const host = ctx.host || document.getElementById('app-root') || document.body;
    // กลุ่มลอย: ลากที่ "แถบแท็บ" (ตรงที่ว่าง ไม่ใช่ตัวแท็บ/ปุ่ม) = ย้าย/ผนึกทั้งกลุ่มได้เลย
    const onFloatBar = !!(ctx.floatId && header.classList.contains('k-float-tabbar'));
    // [alpha.66r11 บั๊ก A] **จับที่ "หัวแท็บ" = งานของ makeTabDraggable ล้วน ๆ ห้ามลากกล่องตาม**
    // เดิม mousedown บนแท็บลอยขึ้นมาถึงแถบแท็บด้วย → ตัวลากกล่องทำงานคู่กัน:
    // กล่องทั้งกลุ่มวิ่งตามเมาส์ระหว่างลากแท็บ แล้วตอนปล่อยก็ commit ตำแหน่งใหม่ลง store
    // (อาการ: เอาแผงไปรวมในกลุ่มเดิม/สลับลำดับแท็บทีไร กล่องกลุ่มย้ายที่ทุกครั้ง)
    if (onFloatBar && e.target.closest('.k-tab')) return;
    const canDock = onFloatBar
      ? !e.target.closest('.k-tab') && !e.target.closest('.k-panel-btn')
      : (!!e.target.closest('.k-panel-head-title') && inGroupHandle(header, e.clientX));
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
      if (hit) ov.show(zoneRect(hit.rect, hit.zone, hit.kind), hit.zone, hit.kind);
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
      // [alpha.66r12 บั๊ก "กลุ่มลอยเด้งกลับที่เดิม"] **ปล่อยแล้วผนึกไม่สำเร็จ = ถือว่าเป็นการย้ายกล่อง**
      // ของเดิม `if (hit) { applyDrop(...); return; }` — return ทิ้งไม่ว่า applyDrop จะทำสำเร็จหรือไม่
      // แต่ applyDrop คืน false ได้หลายทาง (กลุ่มซ้อนกลุ่มไม่รองรับ · ปล่อยทับตัวเอง ฯลฯ)
      // → ตำแหน่งใหม่ **ไม่เคยถูกบันทึกลง store** กล่องค้างอยู่ตรงที่ปล่อยเพราะ DOM ยังไม่ถูกวาดใหม่
      //   พอมีอะไรสั่งวาดใหม่ทีหลัง (เปิด/ปิด/ผนึกแผงอื่น) มันก็กลับไปตำแหน่งเก่าในสโตร์
      //   ซึ่งของกลุ่มคือ "ตำแหน่งของแผงฐานตอนสร้างกลุ่ม" — ตรงกับที่ผู้ใช้เห็นเป๊ะ
      if (hit && applyDrop(pm, panelId, hit, ctx)) return;
      // 0.56a #7: ลากหลุดขอบจอแล้วเรียกกลับไม่ได้ → หนีบตำแหน่งให้ยังเห็นหัวแผงเสมอ
      const c = clampFloat({ x: popup.offsetLeft, y: popup.offsetTop,
                             w: popup.offsetWidth, h: popup.offsetHeight });
      popup.style.left = c.x + 'px'; popup.style.top = c.y + 'px';
      if (ctx.floatId) pm.moveFloatBox(ctx.floatId, { x: c.x, y: c.y });
      else pm.moveFloat(panelId, { x: c.x, y: c.y });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
}
