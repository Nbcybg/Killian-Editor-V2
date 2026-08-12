// ระบบแผนที่ (Maps) — ตรรกะบริสุทธิ์ ไม่แตะ DOM/ไฟล์ เพื่อทดสอบตรง ๆ ได้
//
// แนวคิด: ใช้ไฟล์รูปเป็นแผนที่ แล้วปัก "หมุด" (pin) ลงบนรูป
//   - หมุดเก็บพิกัดเป็น % (x,y ระหว่าง 0–100) → คงตำแหน่งถูกต้องทุกขนาด/ซูม
//   - หมุดลิงก์ได้ 2 แบบ: ไปหน้า Wiki (entityFile) หรือ "ประตู" ไปแผนที่อื่น (toMap) = โลก→เมือง→ห้อง
//
// map = { id, name, image (rel ใน Images/), pins:[pin], order, category?, overlays?, routes? }
// pin = { id, x, y, label, kind:'entity'|'portal'|'note', entityFile?, toMap?, color?, note? }
// route = { id, name, color, dashed, pinIds:[pinId] }  — เส้นทางระหว่างหมุด (alpha.70)

import { T } from './i18n.js';
export const MAPS_VERSION = '1.1';

export const PIN_COLORS = ['#d9575e', '#5f9fd9', '#6fae6f', '#d9b757', '#a97fd0', '#d97757', '#7fb8b0'];
export const PIN_KIND = {
  entity: { icon: '📍', label: T`ตำแหน่งเอนทิตี้` },
  portal: { icon: '🚪', label: T`ประตูไปแผนที่อื่น` },
  note:   { icon: '📌', label: T`หมายเหตุ` },
};

export function newMap(name, image) {
  return { id: 'map-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
           name: name || T`แผนที่ใหม่`, image: image || '', pins: [], order: 0,
           category: '', routes: [], overlays: { ...DEFAULT_OVERLAYS } };
}

export function newPin(x, y, kind = 'note') {
  return { id: 'pin-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
           x: clamp(x), y: clamp(y), label: '', kind, entityFile: '', toMap: '', color: '', note: '' };
}

export function clamp(n) { return Math.max(0, Math.min(100, n)); }

// หา map ตาม id
export function findMap(maps, id) { return (maps || []).find((m) => m.id === id) || null; }

// เรียงแผนที่ตาม order แล้วชื่อ
export function sortMaps(maps) {
  return (maps || []).slice().sort((a, b) =>
    (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), 'th'));
}

// สร้าง "เส้นทาง" (breadcrumb) จากแผนที่ราก → แผนที่ปัจจุบัน ตามลิงก์ portal
// คืน [{id,name}] เรียงจากบนสุดลงล่าง — ใช้แสดงลำดับชั้น โลก→เมือง→ห้อง
export function breadcrumb(maps, currentId) {
  const byId = new Map((maps || []).map((m) => [m.id, m]));
  // หา parent: แผนที่ที่มี pin.toMap === currentId
  const parentOf = (id) => {
    for (const m of maps || []) if ((m.pins || []).some((p) => p.kind === 'portal' && p.toMap === id)) return m.id;
    return null;
  };
  const chain = [];
  let cur = currentId, guard = 0;
  while (cur && byId.has(cur) && guard++ < 50) {
    chain.unshift({ id: cur, name: byId.get(cur).name });
    cur = parentOf(cur);
    if (chain.some((c) => c.id === cur)) break;   // กันวน
  }
  return chain;
}

// แผนที่ที่ไม่มีใครชี้มา (ราก) — ใช้แสดงเป็นจุดเริ่มของลำดับชั้น
export function rootMaps(maps) {
  const pointed = new Set();
  for (const m of maps || []) for (const p of m.pins || [])
    if (p.kind === 'portal' && p.toMap) pointed.add(p.toMap);
  return sortMaps((maps || []).filter((m) => !pointed.has(m.id)));
}

// นับหมุดแยกชนิด
export function pinStats(map) {
  const s = { entity: 0, portal: 0, note: 0 };
  for (const p of (map && map.pins) || []) s[p.kind] = (s[p.kind] || 0) + 1;
  return s;
}

// ลบแผนที่ + ล้าง portal ที่ชี้มาหามัน (กัน pin ค้างชี้แผนที่ที่หายไป)
export function deleteMap(maps, id) {
  const out = (maps || []).filter((m) => m.id !== id);
  for (const m of out) m.pins = (m.pins || []).filter((p) => !(p.kind === 'portal' && p.toMap === id));
  return out;
}

// ═══════════════════ alpha.70 — ซูม · โอเวอร์เลย์ · หมวด · ค้นหา · หลายหมุด · เส้นทาง ═══════════════════

// ---------- ซูม ----------
// ซูมเป็น "เท่าของความกว้างที่พอดีกรอบ" (1 = พอดีกรอบ) — หมุดเก็บเป็น % จึงเลื่อนตามเองอัตโนมัติ
export const MAP_ZOOM_MIN = 0.25, MAP_ZOOM_MAX = 5, MAP_ZOOM_STEP = 0.25;
export function clampZoom(z) {
  // ระวัง Number(null)=0 / Number('')=0 → ถ้าเช็คแค่ isFinite ค่าว่างจะกลายเป็นซูมต่ำสุดแทนที่จะเป็น 1
  if (z === null || z === undefined || z === '') return 1;
  const n = Number(z);
  if (!Number.isFinite(n)) return 1;
  return Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, n));
}
/** เลื่อนซูมทีละขั้น — ปัดให้ลงร่องขั้นเสมอ (ซูมด้วยล้อแล้วค่าไม่เพี้ยนเป็น 1.37) */
export function zoomStep(z, dir) {
  const cur = clampZoom(z);
  const steps = Math.round(cur / MAP_ZOOM_STEP) + (dir > 0 ? 1 : -1);
  return clampZoom(steps * MAP_ZOOM_STEP);
}

/**
 * [alpha.71 ข้อ 1] ตำแหน่งเลื่อนใหม่หลังซูม เพื่อให้ "จุดกึ่งกลางจอ" อยู่ที่เดิมบนแผนที่
 *
 * ของเดิมแค่ขยายความกว้างของผืนแผนที่เฉย ๆ — scrollLeft/Top ไม่ขยับตาม
 * ผลคือทุกครั้งที่ซูมเข้า ภาพจะโตออกจาก **มุมซ้ายบน** สิ่งที่ผู้ใช้กำลังดูอยู่ตรงกลางจึงหลุดออกนอกจอ
 *
 * @param scroll       scrollLeft/scrollTop เดิม
 * @param client       ความกว้าง/สูงของกรอบที่มองเห็น
 * @param before       ขนาดเนื้อหาก่อนซูม (scrollWidth/scrollHeight)
 * @param after        ขนาดเนื้อหาหลังซูม
 * @param anchor       จุดยึด 0–1 ของกรอบที่มองเห็น (0.5 = กลางจอ · ใช้ตำแหน่งเมาส์ได้ถ้าต้องการ)
 */
export function zoomScroll(scroll, client, before, after, anchor = 0.5) {
  const c = +client || 0, b = +before || 0, a = +after || 0;
  if (!b || !c) return 0;
  const at = Math.max(0, Math.min(1, +anchor || 0));
  // จุดบนเนื้อหา (สัดส่วน 0–1) ที่อยู่ตรงจุดยึดตอนนี้ → ต้องอยู่ที่เดิมหลังซูม
  const ratio = ((+scroll || 0) + c * at) / b;
  return Math.max(0, Math.min(Math.max(0, a - c), ratio * a - c * at));
}

// ---------- โอเวอร์เลย์: ตารางกริด · เข็มทิศ · มาตราส่วน ----------
export const DEFAULT_OVERLAYS = { grid: false, gridSize: 10, compass: false, scale: false, scaleLabel: '' };
/** อ่านค่าโอเวอร์เลย์ของแผนที่แบบปลอดภัย (แผนที่เก่าไม่มีคีย์นี้) */
export function mapOverlays(map) {
  const o = (map && map.overlays) || {};
  const size = Number(o.gridSize);
  return { grid: !!o.grid,
           gridSize: Number.isFinite(size) && size >= 2 && size <= 50 ? size : DEFAULT_OVERLAYS.gridSize,
           compass: !!o.compass, scale: !!o.scale, scaleLabel: String(o.scaleLabel || '') };
}
/** สลับโอเวอร์เลย์ตัวหนึ่ง แล้วคืนค่าชุดใหม่ (เขียนกลับลง map.overlays เอง) */
export function toggleOverlay(map, key) {
  const o = mapOverlays(map);
  o[key] = !o[key];
  map.overlays = o;
  return o;
}
/** เส้นกริด: คืนตำแหน่งเป็น % — ใช้วาดทั้งบนจอและตอนส่งออก PNG */
export function gridLines(gridSize) {
  const raw = Number(gridSize);
  const n = Number.isFinite(raw) ? Math.max(2, Math.min(50, Math.round(raw))) : DEFAULT_OVERLAYS.gridSize;
  const out = [];
  for (let i = 1; i < n; i++) out.push(+((i * 100) / n).toFixed(4));
  return out;
}

// ---------- หมวดแผนที่ (โฟลเดอร์) ----------
export const MAP_UNCATEGORIZED = '';
/** ชื่อหมวดทั้งหมดที่ใช้จริง เรียงตามชื่อไทย — หมวดว่าง ("ไม่ระบุ") อยู่ท้ายสุดเสมอ */
export function mapCategories(maps) {
  const set = new Set();
  for (const m of maps || []) set.add(String(m.category || '').trim());
  const named = [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th'));
  return set.has(MAP_UNCATEGORIZED) ? [...named, MAP_UNCATEGORIZED] : named;
}
/** จัดกลุ่มแผนที่ตามหมวด (ในกลุ่มเรียงด้วย sortMaps เหมือนเดิม) */
export function groupMaps(maps) {
  return mapCategories(maps).map((cat) => ({
    cat,
    maps: sortMaps((maps || []).filter((m) => String(m.category || '').trim() === cat)),
  }));
}

// ---------- ค้นหา/กรองหมุด ----------
/** หมุดตัวนี้ตรงคำค้นไหม — ดูป้ายชื่อ/หมายเหตุ/ชนิด (ไม่สนตัวพิมพ์เล็กใหญ่) */
export function matchPin(pin, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  const hay = [pin.label, pin.note, pin.kind, (PIN_KIND[pin.kind] || {}).label]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(s);
}
export function filterPins(pins, q) { return (pins || []).filter((p) => matchPin(p, q)); }

// ---------- ทำงานกับหมุดหลายตัว (batch) ----------
/** เลื่อนหมุดที่เลือกทั้งกลุ่ม dx,dy (หน่วย %) — หนีบขอบทีละตัว คืน array ใหม่ */
export function movePins(pins, ids, dx, dy) {
  const set = new Set(ids || []);
  return (pins || []).map((p) => set.has(p.id)
    ? { ...p, x: clamp(p.x + (+dx || 0)), y: clamp(p.y + (+dy || 0)) } : p);
}
/** ลบหมุดหลายตัว + ถอดออกจากทุกเส้นทางด้วย (กัน route ชี้หมุดที่หายไป) */
export function deletePins(map, ids) {
  const set = new Set(ids || []);
  map.pins = (map.pins || []).filter((p) => !set.has(p.id));
  map.routes = (map.routes || []).map((r) => ({ ...r, pinIds: (r.pinIds || []).filter((id) => !set.has(id)) }));
  return map;
}
/** สำเนาหมุด (สำหรับ copy-paste ข้ามแผนที่) — id ใหม่ทุกตัว + เยื้องเล็กน้อยกันซ้อนทับ
 *  portal/entity ยังชี้ปลายทางเดิม แต่ portal ที่ชี้แผนที่ปลายทางเอง = ตัดทิ้ง (กันวนหาตัวเอง) */
export function clonePins(pins, ids, offset = 2, intoMapId = null) {
  const set = new Set(ids || []);
  const seq = () => 'pin-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return (pins || []).filter((p) => set.has(p.id)).map((p) => {
    const c = { ...p, id: seq(), x: clamp(p.x + offset), y: clamp(p.y + offset) };
    if (intoMapId && c.kind === 'portal' && c.toMap === intoMapId) c.toMap = '';
    return c;
  });
}

// ---------- เส้นทาง (routes) ----------
export const ROUTE_COLORS = ['#d97757', '#5f9fd9', '#6fae6f', '#a97fd0', '#d9b757'];
export function newRoute(name, color) {
  return { id: 'rt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
           name: name || T`เส้นทางใหม่`, color: color || ROUTE_COLORS[0], dashed: false, pinIds: [] };
}
export function mapRoutes(map) { return (map && Array.isArray(map.routes)) ? map.routes : []; }
/** จุดจริงของเส้นทาง (%) — หมุดที่ถูกลบไปแล้วถูกข้าม ไม่ทำให้เส้นกระโดดไปมุมจอ */
export function routePoints(map, route) {
  const byId = new Map((map.pins || []).map((p) => [p.id, p]));
  return (route.pinIds || []).map((id) => byId.get(id)).filter(Boolean)
    .map((p) => ({ x: p.x, y: p.y, id: p.id, label: p.label }));
}
/** path ของ SVG ในระบบพิกัด 0–100 (viewBox="0 0 100 100" + preserveAspectRatio="none") */
export function routePath(points) {
  if (!points || points.length < 2) return '';
  return points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ');
}
/** ความยาวโดยประมาณในหน่วย % ของภาพ (ใช้โชว์ "ระยะทาง" เทียบกันระหว่างเส้นทาง) */
export function routeLength(points) {
  let sum = 0;
  for (let i = 1; i < (points || []).length; i++) {
    const dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y;
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return +sum.toFixed(2);
}
/** ต่อหมุดเข้าท้ายเส้นทาง — กันซ้ำติดกัน (คลิกหมุดเดิมสองที = ไม่เพิ่ม) */
export function addPinToRoute(route, pinId) {
  const ids = route.pinIds || (route.pinIds = []);
  if (!pinId || ids[ids.length - 1] === pinId) return route;
  ids.push(pinId);
  return route;
}
export function deleteRoute(map, routeId) {
  map.routes = mapRoutes(map).filter((r) => r.id !== routeId);
  return map;
}

// ---------- ฉากที่ผูกกับหมุด (scenes.json → sc.mapId / sc.pinId) ----------
/** ฉากทั้งหมดที่ปักอยู่บนแผนที่นี้ */
export function scenesForMap(scenes, mapId) {
  return (scenes || []).filter((s) => s && s.mapId === mapId);
}
/** จำนวนฉากต่อหมุด — { [pinId]: n } · ฉากที่ปักพิกัดลอย (ไม่มี pinId) นับไว้ที่คีย์ '' */
export function scenePinCounts(scenes, mapId) {
  const out = {};
  for (const s of scenesForMap(scenes, mapId)) {
    const k = s.pinId || '';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** เติมคีย์ที่เพิ่มทีหลังให้แผนที่เก่า (maps.json v1.0) — เรียกตอนโหลดไฟล์ */
export function migrateMaps(data) {
  const d = data && typeof data === 'object' ? data : {};
  d.maps = Array.isArray(d.maps) ? d.maps : [];
  for (const m of d.maps) {
    m.pins = Array.isArray(m.pins) ? m.pins : [];
    m.routes = Array.isArray(m.routes) ? m.routes : [];
    if (typeof m.category !== 'string') m.category = '';
    m.overlays = mapOverlays(m);
  }
  d.version = MAPS_VERSION;
  return d;
}
