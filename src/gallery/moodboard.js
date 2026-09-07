// moodboard.js — เรขาคณิตของกระดานอารมณ์ (alpha.63 · Phase 4 · บริสุทธิ์ 100%)
//
// 1 อัลบั้ม = 1 กระดาน · เก็บใน `album.json → moodBoard: [{id,file,x,y,w,h,z,rot}]`
// x/y/w/h เป็น **พิกัดของกระดาน** (หน่วยอิสระ ไม่ใช่พิกเซลบนจอ) → ซูม/แพนแล้วตำแหน่งไม่เพี้ยน
// ลบออกจากกระดาน = ลบแค่รายการนี้ **ไม่แตะไฟล์รูป**

export const MIN_SIZE = 40;
export const MAX_SIZE = 4000;
export const DEFAULT_SIZE = 240;
export const ZOOM_MIN = 0.2, ZOOM_MAX = 4;
export const GRID = 10;

let seq = 0;
export function boardItemId() {
  seq = (seq + 1) % 1e6;
  return 'mb' + Date.now().toString(36) + seq.toString(36);
}

const numOr = (v, d) => (Number.isFinite(+v) ? +v : d);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function newBoardItem(file, opts = {}) {
  return {
    id: opts.id || boardItemId(),
    file: String(file || ''),
    x: numOr(opts.x, 0),
    y: numOr(opts.y, 0),
    w: clamp(numOr(opts.w, DEFAULT_SIZE), MIN_SIZE, MAX_SIZE),
    h: clamp(numOr(opts.h, DEFAULT_SIZE), MIN_SIZE, MAX_SIZE),
    z: numOr(opts.z, 0),
    rot: numOr(opts.rot, 0),
  };
}

/** รับของเก่า/ของที่ผู้ใช้แก้เอง → รายการที่ใช้วาดได้เสมอ (ทิ้งรายการที่ไม่มี file) */
export function normalizeBoard(list) {
  return (Array.isArray(list) ? list : [])
    .filter((it) => it && it.file)
    .map((it, i) => newBoardItem(it.file, { ...it, z: numOr(it.z, i) }));
}

export function addToBoard(board, file, opts = {}) {
  const list = normalizeBoard(board);
  const z = list.reduce((m, i) => Math.max(m, i.z), -1) + 1;
  return [...list, newBoardItem(file, { ...opts, z })];
}

/** วางรูปหลายใบเรียงเป็นตาราง (ลากหลายใบมาลงทีเดียว) */
export function addManyToBoard(board, files, { x = 0, y = 0, size = DEFAULT_SIZE, perRow = 4, gap = 16 } = {}) {
  let out = normalizeBoard(board);
  (files || []).forEach((f, i) => {
    out = addToBoard(out, f, {
      x: x + (i % perRow) * (size + gap),
      y: y + Math.floor(i / perRow) * (size + gap),
      w: size, h: size,
    });
  });
  return out;
}

export function removeFromBoard(board, id) {
  return normalizeBoard(board).filter((it) => it.id !== id);
}

/** ถอดรูปใบนี้ออกจากกระดานทุกชิ้น (ใช้ตอนลบไฟล์จริง) */
export function removeFileFromBoard(board, file) {
  return normalizeBoard(board).filter((it) => it.file !== file);
}

export function updateBoardItem(board, id, patch) {
  return normalizeBoard(board).map((it) => {
    if (it.id !== id) return it;
    const next = { ...it, ...patch };
    return newBoardItem(next.file, next);
  });
}

export function moveToFront(board, id) {
  const list = normalizeBoard(board);
  const top = list.reduce((m, i) => Math.max(m, i.z), 0);
  return list.map((it) => (it.id === id ? { ...it, z: top + 1 } : it));
}

export function moveToBack(board, id) {
  const list = normalizeBoard(board);
  const bottom = list.reduce((m, i) => Math.min(m, i.z), 0);
  return list.map((it) => (it.id === id ? { ...it, z: bottom - 1 } : it));
}

/** เรียงตาม z จากล่างขึ้นบน (ลำดับการวาด) */
export function boardOrder(board) {
  return normalizeBoard(board).sort((a, b) => a.z - b.z);
}

/** ชิ้นบนสุดที่จุด (x,y) ตกอยู่ในกรอบ — คืน null เมื่อว่าง */
export function boardItemAt(board, x, y) {
  const list = boardOrder(board);
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) return it;
  }
  return null;
}

/** กรอบรวมของทุกชิ้น (ว่าง = กรอบศูนย์) */
export function boardBounds(board) {
  const list = normalizeBoard(board);
  if (!list.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...list.map((i) => i.x));
  const y1 = Math.min(...list.map((i) => i.y));
  const x2 = Math.max(...list.map((i) => i.x + i.w));
  const y2 = Math.max(...list.map((i) => i.y + i.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** อัตราส่วนที่ทำให้ทุกชิ้นพอดีจอ (ไม่ขยายเกิน 1 เท่า) */
export function fitScale(bounds, viewW, viewH, pad = 40) {
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return 1;
  const s = Math.min((viewW - pad * 2) / bounds.w, (viewH - pad * 2) / bounds.h);
  return clamp(Number.isFinite(s) ? Math.min(s, 1) : 1, ZOOM_MIN, ZOOM_MAX);
}

/** มุมมองที่ทำให้ทุกชิ้นอยู่กลางจอพอดี → {zoom, panX, panY} */
export function fitView(board, viewW, viewH, pad = 40) {
  const b = boardBounds(board);
  const zoom = fitScale(b, viewW, viewH, pad);
  if (!b.w || !b.h) return { zoom: 1, panX: 0, panY: 0 };
  return {
    zoom,
    panX: (viewW - b.w * zoom) / 2 - b.x * zoom,
    panY: (viewH - b.h * zoom) / 2 - b.y * zoom,
  };
}

export const clampZoom = (z) => clamp(numOr(z, 1), ZOOM_MIN, ZOOM_MAX);

/** ซูมโดยยึดจุดใต้เมาส์ให้อยู่กับที่ (บทเรียน 35 — เก็บสัดส่วน ไม่ใช่พิกเซล) */
export function zoomAt(view, factor, px, py) {
  const z0 = clampZoom(view.zoom);
  const z1 = clampZoom(z0 * factor);
  if (z1 === z0) return { ...view, zoom: z0 };
  const wx = (px - view.panX) / z0;
  const wy = (py - view.panY) / z0;
  return { zoom: z1, panX: px - wx * z1, panY: py - wy * z1 };
}

/** จอ → พิกัดกระดาน */
export function toBoard(view, px, py) {
  const z = clampZoom(view.zoom);
  return { x: (px - view.panX) / z, y: (py - view.panY) / z };
}

/** พิกัดกระดาน → จอ */
export function toScreen(view, x, y) {
  const z = clampZoom(view.zoom);
  return { x: x * z + view.panX, y: y * z + view.panY };
}

export function snap(v, grid = GRID) {
  return grid > 0 ? Math.round(v / grid) * grid : v;
}

/**
 * ขนาดที่คงสัดส่วนของไฟล์จริง — ใช้ตอนวางรูปลงกระดานครั้งแรก
 * ยึด "ด้านยาวสุด = box" เพื่อให้รูปแนวนอน/แนวตั้งกินพื้นที่พอ ๆ กัน
 */
export function sizeForAspect(box, natW, natH) {
  const w0 = clamp(numOr(box, DEFAULT_SIZE), MIN_SIZE, MAX_SIZE);
  const nw = numOr(natW, 0), nh = numOr(natH, 0);
  if (nw <= 0 || nh <= 0) return { w: w0, h: w0 };
  const s = w0 / Math.max(nw, nh);
  return {
    w: clamp(Math.round(nw * s), MIN_SIZE, MAX_SIZE),
    h: clamp(Math.round(nh * s), MIN_SIZE, MAX_SIZE),
  };
}

/** ปรับขนาดจากมุมขวาล่าง (คงสัดส่วนได้) */
export function resizeItem(item, w, h, { keepRatio = false } = {}) {
  let nw = clamp(numOr(w, item.w), MIN_SIZE, MAX_SIZE);
  let nh = clamp(numOr(h, item.h), MIN_SIZE, MAX_SIZE);
  if (keepRatio && item.w > 0) nh = clamp(nw * (item.h / item.w), MIN_SIZE, MAX_SIZE);
  return { ...item, w: nw, h: nh };
}

/** จัดทุกชิ้นเป็นตารางอัตโนมัติ (ปุ่ม "จัดเรียง") */
export function tidyBoard(board, { size = DEFAULT_SIZE, perRow = 4, gap = 16, x = 0, y = 0 } = {}) {
  return boardOrder(board).map((it, i) => ({
    ...it,
    x: x + (i % perRow) * (size + gap),
    y: y + Math.floor(i / perRow) * (size + gap),
    w: size,
    h: size,
  }));
}

export function boardStats(board) {
  const list = normalizeBoard(board);
  const b = boardBounds(list);
  return { count: list.length, files: new Set(list.map((i) => i.file)).size, width: b.w, height: b.h };
}
