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

// [alpha.167] ชนิดของชิ้นบนกระดาน — รูป (แบบเดิม) หรือ "การ์ด" ของสิ่งอื่นในโปรเจกต์
//   image  : รูปจากคลังรูป (file)
//   entity : หน้า Wiki (path) · scene/memo : เอกสาร (path) · chapter : บท (draftDir+guid)
//   ref    : อ้างอิงอิสระ — ลิงก์เว็บ (url) และ/หรือข้อความ (text)
// ผู้ใช้: "mood board ใส่ได้ทั้ง entities และ รูปภาพ และ referance ... ถ้าเป็น entities หรือ referance ให้ใส่เป็น card"
// [alpha.168] + note (โน้ตข้อความ) · palette (แถบสี) · group (กรอบจัดกลุ่มมีหัวข้อ — ลากกรอบ = ของข้างในตามไป)
//   ผู้ใช้ส่งภาพกระดานอ้างอิง: "ปรับ background ได้ · drag and drop ง่าย · ย้าย card ทับบน ทับล่าง · ของเราโคตรจะ basic"
export const CARD_KINDS = ['entity', 'scene', 'memo', 'chapter', 'ref', 'note', 'palette', 'group'];
export const CARD_W = 240, CARD_H = 96, REF_H = 128;
/** ขนาดตั้งต้นของชิ้นใหม่แต่ละชนิด (ตัวละคร/สถานที่ = การ์ดรูปใหญ่ + ชื่อใต้รูป แบบกระดานอ้างอิง) */
export const KIND_SIZE = { entity: [180, 232], note: [220, 150], palette: [260, 64], group: [560, 380], ref: [CARD_W, REF_H] };
const HEX = /^#[0-9a-f]{6}$/i;

export function newBoardItem(file, opts = {}) {
  const kind = CARD_KINDS.includes(opts.kind) ? opts.kind : 'image';
  const it = {
    id: opts.id || boardItemId(),
    file: String(file || ''),
    x: numOr(opts.x, 0),
    y: numOr(opts.y, 0),
    w: clamp(numOr(opts.w, kind === 'image' ? DEFAULT_SIZE : (KIND_SIZE[kind] || [CARD_W])[0]), MIN_SIZE, MAX_SIZE),
    h: clamp(numOr(opts.h, kind === 'image' ? DEFAULT_SIZE : (KIND_SIZE[kind] || [0, CARD_H])[1]), MIN_SIZE, MAX_SIZE),
    z: numOr(opts.z, 0),
    rot: numOr(opts.rot, 0),
  };
  if (kind !== 'image') {
    // การ์ดเก็บแค่ช่องที่มีค่า (ไฟล์เก่าของกระดานรูปล้วนไม่ต้องบวมขึ้น)
    it.kind = kind;
    for (const k of ['path', 'title', 'url', 'text', 'cat', 'color', 'draftDir', 'guid']) {
      if (opts[k] != null && String(opts[k]) !== '') it[k] = String(opts[k]);
    }
    if (kind === 'palette') it.colors = (Array.isArray(opts.colors) ? opts.colors : []).map(String).filter((c) => HEX.test(c)).slice(0, 16);
  } else if (opts.caption != null && String(opts.caption) !== '') it.caption = String(opts.caption);   // คำบรรยายใต้รูป
  return it;
}

/** การ์ดนี้ใช้ได้ไหม (มีอะไรให้แสดง/ให้เปิด) */
export function isCard(it) { return !!(it && CARD_KINDS.includes(it.kind)); }
function usable(it) {
  if (!it) return false;
  if (it.kind === 'group' || it.kind === 'note') return true;          // โน้ตว่าง = เพิ่งสร้าง (กำลังพิมพ์)
  if (it.kind === 'palette') return Array.isArray(it.colors) && it.colors.some((c) => HEX.test(String(c)));
  if (isCard(it)) return !!(it.path || it.url || it.title || it.text || it.guid);
  return !!it.file;
}

/** รับของเก่า/ของที่ผู้ใช้แก้เอง → รายการที่ใช้วาดได้เสมอ (ทิ้งรายการที่ไม่มีอะไรเลย) */
export function normalizeBoard(list) {
  return (Array.isArray(list) ? list : [])
    .filter(usable)
    .map((it, i) => newBoardItem(it.file, { ...it, z: numOr(it.z, i) }));
}

/** วางการ์ดลงกระดาน (บนสุด) */
export function addCardToBoard(board, kind, opts = {}) {
  const list = normalizeBoard(board);
  const z = list.reduce((m, i) => Math.max(m, i.z), -1) + 1;
  return [...list, newBoardItem('', { ...opts, kind, z })];
}

/** การ์ดของสิ่งเดียวกันซ้ำไหม (ลากตัวละครเดิมมาวางซ้ำ = ย้ายการ์ดเดิม ไม่สร้างใหม่) */
export function findCard(board, kind, key) {
  return normalizeBoard(board).find((it) => it.kind === kind && key && (it.path === key || it.url === key || it.guid === key)) || null;
}

/** โฮสต์ของลิงก์ (บรรทัดรองของการ์ดอ้างอิง) */
export function urlHost(u) {
  const m = String(u || '').match(/^[a-z]+:\/\/([^/?#]+)/i);
  return m ? m[1].replace(/^www\./, '') : '';
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

/**
 * [alpha.168] เลื่อนชั้นทีละหนึ่ง (สลับ z กับชิ้นที่ทับกันอยู่ถัดไป) — ผู้ใช้: "ย้าย card ทับบน ทับล่าง"
 * dir: 1 = ขึ้นหนึ่งชั้น · -1 = ลงหนึ่งชั้น · คืนกระดานใหม่ (ไม่ขยับ = กระดานเดิม)
 */
export function stepLayer(board, id, dir) {
  const list = boardOrder(board).map((it, i) => ({ ...it, z: i }));    // z ต่อเนื่อง 0..n-1 ก่อน (ไฟล์เก่ามี z ซ้ำได้)
  const i = list.findIndex((it) => it.id === id);
  const j = i + (dir > 0 ? 1 : -1);
  if (i < 0 || j < 0 || j >= list.length) return list;
  const zi = list[i].z;
  list[i].z = list[j].z; list[j].z = zi;
  return list;
}
/** ชิ้นที่อยู่ในกรอบกลุ่มทั้งชิ้น (ใช้ลากกลุ่ม = ของข้างในตามไป) — ไม่นับตัวกลุ่มเอง */
export function itemsInGroup(board, group) {
  if (!group) return [];
  return normalizeBoard(board).filter((it) => it.id !== group.id &&
    it.x >= group.x && it.y >= group.y && it.x + it.w <= group.x + group.w && it.y + it.h <= group.y + group.h);
}
/** เลื่อนหลายชิ้นพร้อมกัน */
export function moveItems(board, ids, dx, dy) {
  const set = new Set(ids || []);
  return normalizeBoard(board).map((it) => (set.has(it.id) ? { ...it, x: it.x + (+dx || 0), y: it.y + (+dy || 0) } : it));
}
/** ตำแหน่งมุมซ้ายบนที่ทำให้ชิ้นขนาด w×h อยู่กึ่งกลางจุด (x,y) — วางของ "ตรงเคอร์เซอร์" */
export function centeredAt(x, y, w, h) { return { x: snap(x - w / 2), y: snap(y - h / 2) }; }
/** ทำสำเนาชิ้น (id ใหม่ · เยื้อง · อยู่บนสุด) */
export function duplicateItems(board, ids, offset = 24) {
  let out = normalizeBoard(board);
  let top = out.reduce((m, i) => Math.max(m, i.z), 0);
  for (const it of out.filter((x) => (ids || []).includes(x.id))) {
    out = [...out, newBoardItem(it.file, { ...it, id: boardItemId(), x: it.x + offset, y: it.y + offset, z: ++top })];
  }
  return out;
}
/**
 * [alpha.168] ฉากหลังของกระดาน — สีพื้น · รูป (จากคลังรูป) · เบลอ · หรี่
 * เก็บใน album.json → moodBoardBg (ไฟล์เก่าไม่มี = พื้นตามธีม)
 */
export function normalizeBoardBg(bg) {
  const b = bg && typeof bg === 'object' ? bg : {};
  return {
    color: HEX.test(String(b.color || '')) ? String(b.color) : '',
    image: typeof b.image === 'string' && b.image && !/^[a-z]:|^\/|\.\./i.test(b.image) ? b.image.replace(/\\/g, '/') : '',
    blur: clamp(numOr(b.blur, 0), 0, 40),
    dim: clamp(numOr(b.dim, 0.35), 0, 0.9),
  };
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
    // การ์ดคงขนาดของตัวเอง (ยืดเป็นจัตุรัสแล้วอ่านไม่ออก) · รูปเข้าช่องตารางตามเดิม
    w: isCard(it) ? Math.min(it.w, size) : size,
    h: isCard(it) ? Math.min(it.h, size) : size,
  }));
}

export function boardStats(board) {
  const list = normalizeBoard(board);
  const b = boardBounds(list);
  return { count: list.length, files: new Set(list.filter((i) => !isCard(i)).map((i) => i.file)).size,
           cards: list.filter(isCard).length, width: b.w, height: b.h };
}
