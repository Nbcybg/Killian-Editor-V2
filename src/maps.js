// ระบบแผนที่ (Maps) — ตรรกะบริสุทธิ์ ไม่แตะ DOM/ไฟล์ เพื่อทดสอบตรง ๆ ได้
//
// แนวคิด: ใช้ไฟล์รูปเป็นแผนที่ แล้วปัก "หมุด" (pin) ลงบนรูป
//   - หมุดเก็บพิกัดเป็น % (x,y ระหว่าง 0–100) → คงตำแหน่งถูกต้องทุกขนาด/ซูม
//   - หมุดลิงก์ได้ 2 แบบ: ไปหน้า Wiki (entityFile) หรือ "ประตู" ไปแผนที่อื่น (toMap) = โลก→เมือง→ห้อง
//
// map = { id, name, image (rel ใน Images/), pins:[pin], order, category?, overlays?, routes? }
// pin = { id, x, y, label, kind:'entity'|'portal'|'note', entityFile?, toMap?, color?, note? }
// route = { id, name, color, dashed, pinIds:[pinId] }  — เส้นทางระหว่างหมุด (alpha.70)

import { t } from './i18n.js';
import { gi } from './icons.js';
import { cmpText } from './locale.js';
export const MAPS_VERSION = '1.1';

export const PIN_COLORS = ['#d9575e', '#5f9fd9', '#6fae6f', '#d9b757', '#a97fd0', '#d97757', '#7fb8b0'];
export const PIN_KIND = {
  entity: { icon: gi('map-pin'), label: t('ui.maps.pos') },
  portal: { icon: gi('door'), label: t('ui.maps.portalMapOther') },
  note:   { icon: gi('pin'), label: t('ui.common.msg6') },
};

export function newMap(name, image) {
  return { id: 'map-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
           name: name || t('ui.common.mapNew'), image: image || '', pins: [], order: 0,
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
    (a.order || 0) - (b.order || 0) || cmpText(String(a.name), String(b.name)));
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
  const named = [...set].filter(Boolean).sort((a, b) => cmpText(a, b));
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
           name: name || t('ui.maps.routeNew'), color: color || ROUTE_COLORS[0], dashed: false, pinIds: [] };
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
    // [alpha.167] โซน/พิกัดเป็นของใหม่ — ไฟล์เก่าไม่มี = อาร์เรย์ว่าง (geo ไม่ต้องเติม: ไม่มี = ยังไม่ตั้งค่า)
    m.zones = Array.isArray(m.zones) ? m.zones : [];
  }
  d.version = MAPS_VERSION;
  return d;
}

// ═══════════════════ [alpha.167] พิกัดจริง · มาตราส่วน · โซน · แผนที่ย่อย ═══════════════════
//
// ผู้ใช้: "map ต้องมี ลัติจูด ลองติจูด ... ให้ผู้ใช้จิ้มไปที่ scale เช่น 0 50 100 เมตร ในกรณีที่แผนที่มี scale แล้ว
//          ถ้าไม่มีก็ให้ผู้ใช้ปักเองว่า 0 - 50 เมตร อยู่ตรงไหน แล้วค่อยปัก latitude ลงไป คราวนี้ระบบก็รู้เรื่องแล้ว"
//
// map.geo = { scale: { a:{x,y}, b:{x,y}, meters }, ref: { x, y, lat, lon }, north: 0 }  (x,y เป็น % ของภาพ)
// map.zones = [{ id, name, entityFile, color, points:[{x,y}] }]  — วาดอยู่ชั้นล่างสุด (ใต้เส้นทาง/หมุด)
// map.aspect = กว้าง/สูง ของไฟล์รูป (จดไว้ตอนโหลดรูปครั้งแรก — % แกนตั้งกับแกนนอนยาวไม่เท่ากัน)
//
// หน่วยภายใน "u" = % ของความกว้างภาพ ทั้งสองแกน (แกนตั้ง: y% ÷ aspect) → ระยะ/พื้นที่ถูกต้องทุกสัดส่วนภาพ
const M_PER_DEG = 111320;
const aspOf = (map, aspect) => {
  const a = Number(aspect != null ? aspect : map && map.aspect);
  return Number.isFinite(a) && a > 0 ? a : 1;
};
/** จุด (%) → หน่วย u */
export function toUnits(p, aspect = 1) { return { x: +p.x || 0, y: (+p.y || 0) / (aspect || 1) }; }
export function geoOf(map) {
  const g = (map && map.geo) || {};
  const pt = (v) => (v && Number.isFinite(+v.x) && Number.isFinite(+v.y) ? { x: +v.x, y: +v.y } : null);
  const sc = g.scale || {};
  const a = pt(sc.a), b = pt(sc.b), meters = Number(sc.meters);
  const r = g.ref || {};
  const ref = pt(r) && Number.isFinite(+r.lat) && Number.isFinite(+r.lon) ? { x: +r.x, y: +r.y, lat: +r.lat, lon: +r.lon } : null;
  return {
    scale: a && b && meters > 0 && (a.x !== b.x || a.y !== b.y) ? { a, b, meters } : null,
    ref,
    north: Number.isFinite(+g.north) ? +g.north : 0,
  };
}
/** แผนที่นี้ตั้งค่าไปถึงไหนแล้ว — ใช้บอกขั้นถัดไปในหน้าตั้งค่าพิกัด */
export function geoReady(map) { const g = geoOf(map); return { scale: !!g.scale, ref: !!g.ref, full: !!(g.scale && g.ref) }; }
/** เมตรต่อหน่วย u — null เมื่อยังไม่ได้ตั้งมาตราส่วน */
export function metersPerUnit(map, aspect) {
  const g = geoOf(map);
  if (!g.scale) return null;
  const A = aspOf(map, aspect);
  const a = toUnits(g.scale.a, A), b = toUnits(g.scale.b, A);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d > 0 ? g.scale.meters / d : null;
}
/** ระยะจริง (เมตร) ระหว่างสองจุด (%) · ยังไม่ตั้งมาตราส่วน = null */
export function distMeters(map, p, q, aspect) {
  const mpu = metersPerUnit(map, aspect);
  if (mpu == null || !p || !q) return null;
  const A = aspOf(map, aspect);
  const a = toUnits(p, A), b = toUnits(q, A);
  return Math.hypot(b.x - a.x, b.y - a.y) * mpu;
}
/** ระยะรวมของเส้นหลายจุด (เมตร) */
export function pathMeters(map, pts, aspect) {
  let sum = 0;
  for (let i = 1; i < (pts || []).length; i++) {
    const d = distMeters(map, pts[i - 1], pts[i], aspect);
    if (d == null) return null;
    sum += d;
  }
  return sum;
}
/** จุด (%) → ละติจูด/ลองจิจูด (ประมาณแบบระนาบ — แม่นพอสำหรับแผนที่ระดับเมือง/ภูมิภาค) */
export function toLatLon(map, p, aspect) {
  const g = geoOf(map);
  const mpu = metersPerUnit(map, aspect);
  if (!g.ref || mpu == null || !p) return null;
  const A = aspOf(map, aspect);
  const a = toUnits(p, A), r = toUnits(g.ref, A);
  let east = (a.x - r.x) * mpu, south = (a.y - r.y) * mpu;
  if (g.north) {                       // ภาพไม่ได้หันทิศเหนือขึ้นบน — หมุนกลับเป็นแกนภูมิศาสตร์
    const th = (g.north * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const e2 = east * c - south * s, s2 = east * s + south * c;
    east = e2; south = s2;
  }
  const lat = g.ref.lat - south / M_PER_DEG;
  const lon = g.ref.lon + east / (M_PER_DEG * Math.cos((g.ref.lat * Math.PI) / 180) || 1);
  return { lat, lon };
}
/** ละติจูด/ลองจิจูด → จุด (%) — ใช้ "ปักหมุดตามพิกัด" · กลับด้านของ toLatLon */
export function fromLatLon(map, lat, lon, aspect) {
  const g = geoOf(map);
  const mpu = metersPerUnit(map, aspect);
  if (!g.ref || mpu == null || !Number.isFinite(+lat) || !Number.isFinite(+lon)) return null;
  const A = aspOf(map, aspect);
  let south = (g.ref.lat - lat) * M_PER_DEG;
  let east = (lon - g.ref.lon) * M_PER_DEG * Math.cos((g.ref.lat * Math.PI) / 180);
  if (g.north) {
    const th = (-g.north * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const e2 = east * c - south * s, s2 = east * s + south * c;
    east = e2; south = s2;
  }
  const r = toUnits(g.ref, A);
  return { x: r.x + east / mpu, y: (r.y + south / mpu) * A };
}
/** ระยะที่อ่านง่าย → { value, unit:'m'|'km' } (UI แปลหน่วยเอง) */
export function niceDistance(m) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return { value: Math.round(m), unit: 'm' };
  return { value: m < 10000 ? +(m / 1000).toFixed(2) : +(m / 1000).toFixed(1), unit: 'km' };
}
/** "13.75630° N, 100.50180° E" — ทิศเป็นตัวอักษรสากล (ไม่ต้องแปล เหมือนเลขพิกัดบน GPS) */
export function formatLatLon(ll, digits = 5) {
  if (!ll) return '';
  const f = (v, pos, neg) => Math.abs(v).toFixed(digits) + '° ' + (v >= 0 ? pos : neg);
  return f(ll.lat, 'N', 'S') + ', ' + f(ll.lon, 'E', 'W');
}
/** ความเร็วเดินทางตั้งต้น (กม./ชม.) — ชื่อพาหนะแปลตอนวาด */
export const TRAVEL_MODES = [
  { id: 'walk', kmh: 5 }, { id: 'horse', kmh: 12 }, { id: 'cart', kmh: 6 },
  { id: 'ship', kmh: 15 }, { id: 'car', kmh: 60 },
];
/** ชั่วโมงที่ใช้เดินทาง */
export function travelHours(meters, kmh) {
  if (meters == null || !(kmh > 0)) return null;
  return meters / 1000 / kmh;
}
/** ชั่วโมง → { d, h, m } */
export function splitHours(hours) {
  if (hours == null || !Number.isFinite(hours)) return null;
  const totalMin = Math.round(hours * 60);
  return { d: Math.floor(totalMin / 1440), h: Math.floor((totalMin % 1440) / 60), m: totalMin % 60 };
}
/** ความยาวแถบมาตราส่วนที่สวย (1-2-5 × 10ⁿ เมตร) ให้กว้างราว targetU หน่วย */
export function niceScaleBar(mpu, targetU = 18) {
  if (!(mpu > 0)) return null;
  const raw = mpu * targetU, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const meters = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
  return { meters, units: meters / mpu };
}

// ---------- โซน (พื้นที่ของเอนทิตี้ — polygon) ----------
export const ZONE_COLORS = ['#5f9fd9', '#6fae6f', '#d9b757', '#d97757', '#a97fd0', '#7fb8b0', '#d9575e'];
export function newZone(points, o = {}) {
  return { id: 'zn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
           name: o.name || '', entityFile: o.entityFile || '', color: o.color || ZONE_COLORS[0],
           points: (points || []).map((p) => ({ x: clamp(+p.x), y: clamp(+p.y) })) };
}
export function mapZones(map) {
  return (map && Array.isArray(map.zones) ? map.zones : []).filter((z) => z && Array.isArray(z.points) && z.points.length >= 3);
}
export function deleteZone(map, id) { map.zones = (map.zones || []).filter((z) => z.id !== id); return map; }
/** จุดอยู่ในโซนไหม (ray casting) */
export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / ((b.y - a.y) || 1e-12) + a.x) inside = !inside;
  }
  return inside;
}
/** โซนบนสุดที่จุดนี้ตกอยู่ (โซนเล็กชนะ — วาดทีหลัง = อยู่บน) */
export function zoneAt(map, p) {
  const zs = mapZones(map);
  for (let i = zs.length - 1; i >= 0; i--) if (pointInPolygon(p, zs[i].points)) return zs[i];
  return null;
}
/** พื้นที่ในหน่วย u² (shoelace) */
export function polygonAreaU(pts, aspect = 1) {
  let s = 0;
  const q = (pts || []).map((p) => toUnits(p, aspect));
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) s += (q[j].x + q[i].x) * (q[j].y - q[i].y);
  return Math.abs(s) / 2;
}
/** พื้นที่จริง (ตร.ม.) · ยังไม่ตั้งมาตราส่วน = null */
export function zoneAreaM2(map, zone, aspect) {
  const mpu = metersPerUnit(map, aspect);
  if (mpu == null || !zone) return null;
  return polygonAreaU(zone.points, aspOf(map, aspect)) * mpu * mpu;
}
/** จุดกึ่งกลางสำหรับวางป้ายชื่อ (centroid ของ polygon · พื้นที่ 0 = ค่าเฉลี่ย) */
export function polygonCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    a += f; cx += (pts[j].x + pts[i].x) * f; cy += (pts[j].y + pts[i].y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
/** path ของ SVG แบบปิด (viewBox 0–100) */
export function zonePath(pts) {
  if (!pts || pts.length < 2) return '';
  return pts.map((p, i) => (i ? 'L' : 'M') + (+p.x).toFixed(2) + ',' + (+p.y).toFixed(2)).join(' ') + ' Z';
}
/** m² → { value, unit:'m2'|'km2' } */
export function niceArea(m2) {
  if (m2 == null || !Number.isFinite(m2)) return null;
  if (m2 < 1e6) return { value: Math.round(m2), unit: 'm2' };
  return { value: +(m2 / 1e6).toFixed(m2 < 1e7 ? 2 : 1), unit: 'km2' };
}

// ---------- แผนที่ย่อย (แผนที่ซ้อนแผนที่) ----------
/** แผนที่ที่แผนที่นี้มีประตูชี้ไป (ลูก) */
export function childMaps(maps, id) {
  const m = findMap(maps, id);
  if (!m) return [];
  const ids = new Set((m.pins || []).filter((p) => p.kind === 'portal' && p.toMap).map((p) => p.toMap));
  return sortMaps((maps || []).filter((x) => ids.has(x.id)));
}
/** แผนที่แม่ (ใบแรกที่มีประตูมาหา) */
export function parentMap(maps, id) {
  for (const m of maps || []) if ((m.pins || []).some((p) => p.kind === 'portal' && p.toMap === id)) return m;
  return null;
}
/** หมุดประตูใหม่ไปแผนที่ปลายทาง (หยิบแผนที่ใส่แผนที่) — ไม่ยอมให้ชี้ตัวเอง */
export function portalPin(x, y, toMap, label) {
  const p = newPin(x, y, 'portal');
  p.toMap = toMap || '';
  p.label = label || '';
  return p;
}
/** หมุดเอนทิตี้ใหม่ (หยิบตัวละคร/สถานที่ใส่แผนที่) */
export function entityPin(x, y, entityFile, label) {
  const p = newPin(x, y, 'entity');
  p.entityFile = entityFile || '';
  p.label = label || '';
  return p;
}
/** หมุดของเอนทิตี้นี้บนแผนที่ใบไหนบ้าง — [{map, pin}] */
export function pinsOfEntity(maps, entityFile) {
  const out = [];
  for (const m of maps || []) for (const p of m.pins || []) if (p.kind === 'entity' && p.entityFile === entityFile) out.push({ map: m, pin: p });
  return out;
}

// ---------- เส้นทางของเรื่อง (ฉากเรียงตามเวลาในเรื่อง → ระยะที่ตัวละครต้องเดินทาง) ----------
/** จุดของฉากบนแผนที่นี้ (หมุดที่ผูก หรือพิกัดลอย) · null = ไม่มีตำแหน่ง */
export function scenePoint(map, s) {
  if (!map || !s || s.mapId !== map.id) return null;
  const pin = s.pinId ? (map.pins || []).find((p) => p.id === s.pinId) : null;
  if (pin) return { x: pin.x, y: pin.y };
  if (Number.isFinite(+s.pinX) && Number.isFinite(+s.pinY) && s.pinX !== '' && s.pinX != null) return { x: +s.pinX, y: +s.pinY };
  return null;
}
/**
 * ลำดับการเดินทางของเรื่องบนแผนที่นี้ — ฉากเรียงตาม "เวลาในเรื่อง" (ตัวเลขก่อน) แล้วตามลำดับในเล่ม
 * @param orderKey (s) → ตัวเลขเรียงของฉาก (ผู้เรียกส่งตัวถอดเลขเวลาในเรื่องมา)
 * @returns { stops:[{scene, pt}], legs:[{from, to, meters}], total }
 */
export function storyJourney(map, scenes, orderKey, aspect) {
  const here = (scenes || []).map((s, i) => ({ s, i, pt: scenePoint(map, s) })).filter((x) => x.pt);
  here.sort((a, b) => {
    const ka = orderKey ? orderKey(a.s) : null, kb = orderKey ? orderKey(b.s) : null;
    if (ka != null && kb != null && ka !== kb) return ka - kb;
    if (ka != null && kb == null) return -1;
    if (ka == null && kb != null) return 1;
    return a.i - b.i;
  });
  const stops = here.map((x) => ({ scene: x.s, pt: x.pt }));
  const legs = [];
  let total = 0, known = true;
  for (let i = 1; i < stops.length; i++) {
    const m = distMeters(map, stops[i - 1].pt, stops[i].pt, aspect);
    if (m == null) known = false; else total += m;
    legs.push({ from: stops[i - 1].scene, to: stops[i].scene, meters: m });
  }
  return { stops, legs, total: known ? total : null };
}
