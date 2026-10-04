// maps-ui.js — แผนที่ (UI)
// [alpha.70] ซูม · โอเวอร์เลย์ · ค้นหาหมุด · เลือกหลายหมุด · คัดลอก-วางข้ามแผนที่ · เส้นทาง · หมวด · PNG/พิมพ์
// [alpha.167] ยกเครื่องการจัดวางตามภาพอ้างอิงของผู้ใช้ (ภาพ 3 + 4):
//   · ซ้าย = รายชื่อตัวละคร/สถานที่ (ลากลงแผนที่ = ปักหมุด) · ฉากบนแผนที่นี้ · แผนที่ย่อย · โซน
//   · กลาง = แกลเลอรีแผนที่ (การ์ดรูปจริง + การ์ด "สร้างแผนที่") → เลือกแล้วเข้าไปดูแผนที่นั้น
//   · ควบคุมแบบเกม: ล้อ = ซูม (ยึดเคอร์เซอร์) · ลากที่ว่าง = เลื่อน · ดับเบิลคลิก = ปักหมุด · Ctrl+คลิก = กระโดด
//   · พิกัดจริง: ตั้งมาตราส่วนจากแถบสเกล (หรือวางสเกลเอง) → ปักจุดละติจูด/ลองจิจูด → ระบบรู้ระยะ/พิกัดทุกจุด
//   · โซน (vector) ของเอนทิตี้ วาดชั้นล่างสุดใต้เส้นทางและหมุด · พื้นที่จริงเมื่อตั้งมาตราส่วนแล้ว
//   · แผนที่ซ้อนแผนที่: ประตู (portal) · ลากแผนที่จาก Explorer ลงแผนที่ = ประตูไปแผนที่ย่อย
//   · เส้นทางของเรื่อง: ฉากที่ปักไว้เรียงตามเวลาในเรื่อง → ระยะ/เวลาเดินทางระหว่างฉาก
import { tf } from './i18n.js';
import { failText } from './err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import { addMapFlow, loadMaps, mapImgURL, mapsState_C, pinDialog, saveMaps, updateSceneRow, catLabel, catIconEl } from './app.js';
import { $, el, state, setStatus, setStatusError, log, t } from './core.js';
import { pickImage } from './gallery.js';
import {
  PIN_KIND, PIN_SIZES, pinSizeK, ROUTE_COLORS, breadcrumb, clampW, clampZoom, clonePins, deleteMap, deletePins, deleteRoute,
  findMap, gridCell, groupMaps, mapOverlays, mapRoutes, matchPin, newPin, newRoute,
  pinStats, routeLength, routePath, routePoints, scenePinCounts, scenesForMap, sortMaps, toggleOverlay,
  zoomLadder, WORLD_MIN, WORLD_MAX, mapBounds,
  geoOf, geoReady, metersPerUnit, pathMeters, toLatLon, fromLatLon, niceDistance, formatLatLon,
  niceScaleBar, ZONE_COLORS, ZONE_PATTERNS, zoneOpacity, newZone, mapZones, deleteZone, zoneAt, moveZone, movePinLayer,
  pinsInZone, zonesOfPin,
  zoneAreaM2, polygonCentroid, zonePath, niceArea, childMaps, parentMap, portalPin, entityPin, pinsOfEntity,
  storyJourney, validCatFilter, mapForFilter,
} from './maps.js';
import { saveCanvasPng } from './export-image.js';   // [alpha.168] ส่งออก PNG ผ่านกล่องบันทึก (ทางกลาง)
import { ask, confirmBox, popupMenu, toast } from './ui.js';
import { openEntity } from './wiki-ui.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { collectPlacedScenes } from './scene-list.js';
import { gi } from './icons.js';
import { PRINT } from './palette.js';   // [alpha.162 · W6 ข้อ 2] สีภาพส่งออก (พื้นขาวเสมอ)
import { panelEmpty } from './panels/panel-chrome.js';   // [alpha.162 · W2] สถานะว่างของกลาง
import { bindDropTarget, setDrag } from './drop-kit.js';
import { escCancelDrag } from './drag-cancel.js';   // [alpha.167 · รอบต่อ] Esc ยกเลิกการลาก
import { extractNum } from './timeline.js';
import { distText, areaText, travelText } from './map-text.js';
// [alpha.168] รูปพื้นหลังแก้ได้ — มุมทั้งสี่ของภาพมาจากที่เดียว (จอ = matrix3d · PNG = ตาข่าย)
import { normalizeBg, compactBg, isDefaultBg, bgCssMatrix, bgQuad, bgMeshCells, bgIsProjective, BG_DEFAULTS, BG_LIMITS } from './map-bg.js';   // [alpha.167 · รอบต่อ] ถ้อยคำชุดเดียวกับฝั่ง AI

// ── สถานะการดู (ไม่บันทึกลงไฟล์) — อยู่นอก mapsState_C.s เพราะ s ถูกสร้างใหม่ทุกครั้งที่โหลด maps.json
const view = {
  zoom: 1,
  sel: new Set(),        // id หมุดที่เลือกอยู่
  clip: [],              // หมุดที่คัดลอกไว้ (วางข้ามแผนที่ได้)
  q: '',                 // คำค้นหมุด
  routeEdit: null,       // id เส้นทางที่กำลังต่อจุด
  showRoutes: true,
  focusPin: null,        // หมุดที่ถูกสั่งให้เพ่ง (มาจากปุ่ม "ดูบนแผนที่" ของฉาก)
  catFilter: null,       // หมวดที่กรองอยู่ (null = ทั้งหมด)
  // [alpha.71 ข้อ 3] โหมดเครื่องมือ — open = คลิกเพื่อเปิดลิงก์/ดู · edit = คลิกเพื่อแก้ · move = ลากย้าย
  tool: 'open',
  showLabels: true,      // ปุ่ม "แสดงตัวหนังสือ"
  // [alpha.167]
  gallery: true,         // หน้าแรกของแผง = แกลเลอรีแผนที่ (ภาพ 3) · เลือกแผนที่แล้วค่อยเข้าไปดู
  pick: null,            // { kind, resolve } — กำลังรอให้ผู้ใช้จิ้มจุดบนแผนที่ (ตั้งมาตราส่วน/พิกัด)
  zoneDraw: null,        // { points:[], entityFile, name, color } — กำลังวาดโซน
  measure: null,         // { points:[] } — กำลังวัดระยะ
  selZone: null,         // id โซนที่เลือก
  sideQ: '',             // คำค้นในแถบซ้าย
  journey: false,        // แสดงเส้นทางของเรื่อง
  sideOpen: true,        // แถบซ้ายเปิดอยู่
  wantId: null,          // แผนที่ที่ผู้สั่งต้องการ (focusMapPin) — ตัววาดที่วิ่งซ้อนกันเลือกใบนี้
  // [alpha.168]
  cams: new Map(),       // mapId → กล้อง { zoom, cx, cy } (แผนที่ไม่มีขอบ · จำตำแหน่งดูของแต่ละใบระหว่างเซสชัน)
  geoOpen: false,        // หน้าตั้งพิกัดเปิดอยู่ (การ์ดลอยในกรอบแผนที่ — วาดใหม่พร้อมแผนที่)
  addText: false,        // รอคลิกวางตัวหนังสือบนแผนที่
  bgOpen: false,         // การ์ดแก้รูปพื้นหลังเปิดอยู่
  bgDrag: false,         // โหมดลากย้ายรูป (ลากบนผืน = ย้ายรูป แทนเลื่อนแผนที่)
};
let scenesCache = null;              // ฉากที่ปักหมุดทั้งโปรเจกต์ (โหลดครั้งเดียวต่อรอบเปิดแผง)
let portraitCache = null;            // entityFile → ชื่อไฟล์รูปประจำตัว (ข้อ 2)
let entityCache = null;              // [alpha.167] รายชื่อเอนทิตี้ของแถบซ้าย

// [alpha.167 · รอบต่อ · บั๊ก] ป้าย/คำอธิบายแปลตอนอ่าน (getter) — เดิม t() ตอน import = แช่ภาษาตอนบูต
// ไอคอนก็ตอนอ่าน (ทะเบียนไอคอนอาจยังโหลดไม่เสร็จตอน import)
const toolDef = (id, iconName, labelKey, hintKey) => ({
  id, get icon() { return gi(iconName); }, get label() { return t(labelKey); }, get hint() { return t(hintKey); },
});
export const MAP_TOOLS = [
  // [alpha.168] "เลือก": คลิก = เลือก (แถบเครื่องมือลอยเหนือของที่เลือก) · ลาก = ย้าย · คลิกซ้ำ/ดับเบิลคลิก = เปิดลิงก์
  toolDef('open', 'pointer', 'ui.maps.toolSelect', 'ui.maps.toolSelectHint'),
  toolDef('edit', 'pencil-thin', 'ui.common.edit', 'ui.maps.clickPinOpenDialog'),
  toolDef('move', 'move', 'ui.common.movePos', 'ui.maps.dragPinMoveMode'),
];

export const PIN_SCALE_MIN = 0.6, PIN_SCALE_MAX = 3, PIN_SCALE_STEP = 0.2;
/** ขนาดหมุดของแผนที่ (บันทึกต่อแผนที่ใน maps.json) */
export function pinScaleOf(map) {
  const n = Number(map && map.pinScale);
  return Number.isFinite(n) && n > 0 ? Math.max(PIN_SCALE_MIN, Math.min(PIN_SCALE_MAX, n)) : 1;
}

export function resetMapsView() {
  view.zoom = 1; view.sel.clear(); view.clip = []; view.q = ''; view.routeEdit = null;
  view.focusPin = null; view.catFilter = null; view.showRoutes = true; view.tool = 'open';
  view.showLabels = true; scenesCache = null; portraitCache = null; entityCache = null;
  view.gallery = true; view.pick = null; view.zoneDraw = null; view.measure = null; view.selZone = null;
  view.sideQ = ''; view.journey = false; view.sideOpen = true;
  view.cams.clear(); view.geoOpen = false; view.addText = false; view.bgOpen = false; view.bgDrag = false;
}
/** [alpha.167] สำหรับเทส/ทางอื่น: สถานะการดูปัจจุบัน (อ่านอย่างเดียว) */
export function mapsViewState() { return { gallery: view.gallery, tool: view.tool, zoom: view.zoom,
  zoneDraw: !!view.zoneDraw, measure: view.measure ? view.measure.points.length : 0, pick: view.pick ? view.pick.kind : null,
  selZone: view.selZone, journey: view.journey, sel: [...view.sel], geoOpen: view.geoOpen, addText: view.addText, bgOpen: view.bgOpen, bgDrag: view.bgDrag,
  cam: (() => { const S = mapsState_C.s; const c = S && view.cams.get(S.currentId); return c ? { ...c } : null; })() }; }

/** entityFile → รูปประจำตัว · อ่านครั้งเดียวต่อรอบเปิดแผง (ข้อ 2) */
async function loadPortraits() {
  if (portraitCache) return portraitCache;
  portraitCache = new Map();
  for (const e of await loadEntities()) if (e.file && e.image) portraitCache.set(e.file, e.image);
  return portraitCache;
}
/** [alpha.167] เอนทิตี้ทั้งโปรเจกต์ (เฉพาะหน้า Wiki — ไม่เอาโหนดโครงเรื่อง) */
async function loadEntities() {
  if (entityCache) return entityCache;
  try {
    const { loadAllEntities } = await import('./app.js');
    entityCache = (await loadAllEntities({ entitiesOnly: true })).filter((e) => e.file && /\.json$/i.test(e.file) && e.name);
  } catch (e) { log('warn', t('ui.maps.mapsReadImagePortrait'), e); entityCache = []; }
  return entityCache;
}

// บั๊ก #18: แผนที่เป็นแผง ไม่ใช่แท็บเอกสาร
export async function openMaps() {
  showPanel('maps');                   // hook ใน app.js เริ่มวาดให้ · await ตัวเดียวกันต่อ
  return renderMapsPanel();
}

/** โหลด maps.json + วาดลง #maps-body — ห้ามเรียก showPanel ในนี้ (วนซ้ำกับ hook) */
/**
 * [alpha.168] ลบหมุดแบบย้อนกลับได้ — ทุกทางลบ (Delete · แถบเลือก · เมนู · การ์ดหมุด) ผ่านที่นี่
 * ข้อความแจ้งมีปุ่ม "ย้อนกลับ" คืนหมุด+เส้นทางของแผนที่ใบนั้นก่อนลบ (เฉพาะเมื่อแผนที่ใบนั้นยังเป็นชุดข้อมูลเดิม)
 */
async function removePins(cur, ids, save, redraw) {
  const list = [...ids];
  if (!list.length) return;
  const snap = JSON.stringify({ pins: cur.pins || [], routes: cur.routes || [] });
  deletePins(cur, list);
  for (const id of list) view.sel.delete(id);
  await save();
  redraw();
  const data = mapsState_C.s && mapsState_C.s.data;
  toast(tf('ui.maps.delPinDone', list.length), { action: { label: t('ui.common.undoBtn'), onClick: async () => {
    const S2 = mapsState_C.s;
    if (!S2 || S2.data !== data || !(S2.data.maps || []).includes(cur)) return;   // โหลดใหม่/เปลี่ยนโปรเจกต์ไปแล้ว
    const back = JSON.parse(snap);
    cur.pins = back.pins; cur.routes = back.routes;
    await saveMaps(S2.data);
    redraw();
  } } });
}

export async function renderMapsPanel() {
  // โหลดใหม่ทุกครั้ง (ไฟล์แก้นอกโปรแกรมได้) แต่คงแผนที่ที่ดูค้างไว้ถ้ายังมีอยู่
  // [alpha.167] อ่าน "แผนที่ที่ต้องการ" **หลัง** await — ตัววาดสองรอบซ้อนกัน (hook ของ showPanel + ผู้สั่ง)
  // เดิมจำ currentId ไว้ก่อนอ่านไฟล์ รอบที่เสร็จทีหลังจึงเขียนแผนที่เก่ากลับทับ (ปุ่ม "ดูบนแผนที่" เด้งผิดใบ)
  const data = await loadMaps();
  const keepId = view.wantId || mapsState_C.s?.currentId || null;
  mapsState_C.s = { data, currentId: null };
  const all = mapsState_C.s.data.maps;
  mapsState_C.s.currentId = (keepId && all.some((m) => m.id === keepId)) ? keepId
                          : (all.length ? sortMaps(all)[0].id : null);
  scenesCache = null; portraitCache = null; entityCache = null;
  return renderMaps($('#maps-body'));
}
/** วาดแผงแผนที่ใหม่ถ้าเปิดอยู่ — เรียกหลังบันทึกหน้า Wiki (รูปประจำตัวบนหมุดต้องเปลี่ยนตาม) */
export function refreshMapsIfOpen() {
  if (!isPanelOpen('maps') || !mapsState_C.s || !$('#maps-body')) return;
  portraitCache = null; entityCache = null;
  renderMaps($('#maps-body'));
}

/** [alpha.167] เข้าไปดูแผนที่ใบนี้ (ออกจากแกลเลอรี) */
export async function enterMap(mapId) {
  const S = mapsState_C.s;
  if (!S || !findMap(S.data.maps, mapId)) return false;
  S.currentId = mapId;
  view.gallery = false; view.sel.clear(); view.routeEdit = null; view.focusPin = null;
  view.selZone = null; view.zoneDraw = null; view.measure = null; view.pick = null;
  await renderMaps($('#maps-body'));
  return true;
}
/** [alpha.167] เปิดแผงแล้วเข้าแผนที่ใบนี้ในการวาดรอบเดียว (Explorer · เมนู) — ไม่วาดแกลเลอรีก่อนแล้วค่อยสลับ */
export async function openMapById(mapId) {
  view.wantId = mapId; view.gallery = false;
  view.sel.clear(); view.routeEdit = null; view.focusPin = null; view.selZone = null;
  view.zoneDraw = null; view.measure = null; view.pick = null;
  showPanel('maps');
  await renderMapsPanel();
  view.wantId = null;
  return !!(mapsState_C.s && mapsState_C.s.currentId === mapId);
}
/** [alpha.167] กลับหน้าแกลเลอรีแผนที่ */
export async function showMapGallery() {
  view.gallery = true; view.zoneDraw = null; view.measure = null; view.pick = null;
  await renderMaps($('#maps-body'));
}

/**
 * เปิดแผนที่แล้วเพ่งไปที่หมุด/พิกัดที่กำหนด — ใช้จากปุ่ม "ดูบนแผนที่" ในคุณสมบัติฉาก
 */
export async function focusMapPin(mapId, pinId, at) {
  view.wantId = mapId;                 // ตัววาดทุกรอบที่กำลังวิ่ง (รวม hook ของ showPanel) เลือกใบนี้
  view.gallery = false;
  showPanel('maps');
  const keepZoom = view.zoom;
  await renderMapsPanel();
  view.wantId = null;
  const S = mapsState_C.s;
  if (!S || !findMap(S.data.maps, mapId)) { setStatus(t('ui.maps.notFoundMapScene')); return false; }
  S.currentId = mapId;
  view.gallery = false;
  view.zoom = keepZoom;
  view.sel.clear();
  const pin = pinId ? (findMap(S.data.maps, mapId).pins || []).find((p) => p.id === pinId) : null;
  view.focusPin = pin ? { id: pin.id, x: pin.x, y: pin.y }
                      : (at && at.x != null ? { id: null, x: at.x, y: at.y } : null);
  await renderMaps($('#maps-body'));
  scrollFocusIntoView();
  return true;
}

/**
 * [alpha.70 ข้อ 1] ตำแหน่งของฉากบนแผนที่ — อ่านจาก sc.mapId / sc.pinId (หรือ pinX/pinY ถ้าปักพิกัดเอง)
 */
export async function sceneMapLocation(row) {
  if (!row || !row.mapId) return null;
  let data;
  try { data = await loadMaps(); } catch { return null; }
  const map = findMap(data.maps, row.mapId);
  if (!map) return { missing: true, mapId: row.mapId, text: t('ui.maps.mapBindDelDone') };
  const pin = row.pinId ? (map.pins || []).find((p) => p.id === row.pinId) : null;
  const x = pin ? pin.x : row.pinX, y = pin ? pin.y : row.pinY;
  return { map, pin, x, y,
           text: (map.name || t('ui.common.notNamed'))
                 + (pin ? ' · ' + (pin.label || t('ui.common.pin'))
                        : (row.pinX != null ? t('ui.maps.pin') : '')) };
}

/** แถว "ตำแหน่งบนแผนที่" สำหรับกล่อง/แผงคุณสมบัติฉาก — ใช้ร่วมทั้งสองที่ (บทเรียน 50) */
export async function buildShowOnMapRow(row) {
  const loc = await sceneMapLocation(row);
  const r = el('div', 'wiki-row props-maprow');
  r.append(el('label', null, t('ui.maps.sceneWhere')));
  const box = el('div', 'props-maprow-body');
  if (!loc) {
    box.append(el('span', 'dim', t('ui.maps.notPlaced')));
    const b = el('button', 'cmp-mini', gi('pin') + ' ' + t('ui.maps.placeIt'));
    b.title = t('ui.maps.placeItHint');
    // [alpha.168] ผังพื้นที่เปลี่ยนเป็นผังกองถ่าย (Shot Designer) แล้ว — การปักตำแหน่งฉากอยู่ที่แผงแผนที่ (ลากฉากมาวาง)
    b.onclick = () => { openMaps(); setStatus(t('ui.maps.placeItHint')); };
    box.append(b);
  } else if (loc.missing) {
    box.append(el('span', 'dim', loc.text));
  } else {
    box.append(el('span', 'props-mapwhere', gi('map-pin') + ' ' + loc.text));
    const b = el('button', 'cmp-mini k-ok props-mapbtn', gi('map') + ' ' + t('ui.maps.showOnMap'));
    b.title = t('ui.maps.showOnMapHint');
    b.onclick = () => focusMapPin(loc.map.id, loc.pin ? loc.pin.id : null,
                                  loc.x != null ? { x: loc.x, y: loc.y } : null);
    box.append(b);
  }
  r.append(box);
  return r;
}

/** เลื่อนกล้องให้หมุดที่กำลังเพ่งอยู่กลางจอ (แผนที่ไม่มีขอบ = ย้ายกล้อง ไม่ใช่ตำแหน่งเลื่อน) */
function scrollFocusIntoView() {
  const S = mapsState_C.s;
  if (!S || !view.focusPin) return;
  const cur = findMap(S.data.maps, S.currentId);
  if (!cur) return;
  const c = camOf(cur);
  c.cx = view.focusPin.x; c.cy = view.focusPin.y;
  const main = $('#maps-body .map-main');
  if (main && main._setZoom) main._setZoom(Math.max(c.zoom, 1.5));
}

/** รอให้ผู้ใช้จิ้มจุดบนแผนที่ (ตั้งมาตราส่วน/พิกัด) — คืน {x,y} (%) หรือ null เมื่อกด Esc */
function pickPoint(kind, hint) {
  return new Promise((resolve) => {
    view.pick = { kind, hint, resolve: (p) => { view.pick = null; resolve(p); } };
    setStatus(hint);
    refresh();
  });
}
function refresh() { if ($('#maps-body')) renderMaps($('#maps-body')); }

// ═══════════════════════ ตัววาดหลัก ═══════════════════════
export async function renderMaps(pane) {
  if (!pane) return;
  const S = mapsState_C.s;
  if (!S) { pane.innerHTML = ''; return; }
  const keepSide = pane.querySelector('.map-side-list');
  const keepSideScroll = keepSide ? keepSide.scrollTop : 0;
  pane.innerHTML = '';
  const maps = S.data.maps;
  const wrap = el('div', 'map-wrap map2' + (view.sideOpen ? '' : ' map-side-closed')); pane.append(wrap);
  const side = el('aside', 'map-side');
  const main = el('div', 'map-main');
  wrap.append(side, main);

  if (!maps.length || !findMap(maps, S.currentId)) view.gallery = true;
  view.catFilter = validCatFilter(maps, view.catFilter);   // [alpha.168 · bug hunt] หมวดที่กรองหายไปแล้ว = เลิกกรอง
  const cur = view.gallery ? null : findMap(maps, S.currentId);
  if (!view.gallery && cur) {
    if (scenesCache === null) {
      try { scenesCache = await collectPlacedScenes(); }
      catch (e) { log('warn', t('ui.maps.mapsReadScenePin'), e); scenesCache = []; }
    }
  }
  await renderSide(side, cur, maps);
  const list = side.querySelector('.map-side-list');
  if (list && keepSideScroll) list.scrollTop = keepSideScroll;

  if (view.gallery) renderGallery(main, maps);
  else await renderMapView(main, pane, cur);
}

// ═══════════════════════ แถบซ้าย: ตัวละคร/สถานที่ · ฉากที่นี่ · แผนที่ย่อย · โซน ═══════════════════════
async function renderSide(side, cur, maps) {
  const head = el('div', 'map-side-head');
  const tog = el('button', 'map-side-tog', gi(view.sideOpen ? 'chevron-left' : 'chevron-right'));
  tog.title = view.sideOpen ? t('ui.maps.sideHide') : t('ui.maps.sideShow');
  tog.onclick = () => { view.sideOpen = !view.sideOpen; refresh(); };
  head.append(tog);
  side.append(head);
  if (!view.sideOpen) return;
  head.append(el('span', 'map-side-title', t('ui.maps.sideEntities')));
  const q = el('input', 'map-side-search');
  q.type = 'search'; q.placeholder = t('ui.maps.sideSearchPh'); q.value = view.sideQ;
  side.append(q);
  const list = el('div', 'map-side-list');
  side.append(list);
  const ents = await loadEntities();
  const portraits = await loadPortraits();
  const placedHere = new Map();
  if (cur) for (const p of cur.pins || []) if (p.kind === 'entity' && p.entityFile) placedHere.set(p.entityFile, p);
  const zonedHere = new Set(cur ? mapZones(cur).map((z) => z.entityFile).filter(Boolean) : []);

  const paint = () => {
    list.replaceChildren();
    const s = view.sideQ.trim().toLowerCase();
    const byCat = new Map();
    for (const e of ents) {
      if (s && !String(e.name).toLowerCase().includes(s)) continue;
      if (!byCat.has(e.cat)) byCat.set(e.cat, []);
      byCat.get(e.cat).push(e);
    }
    if (!ents.length) list.append(el('div', 'map-side-empty', t('ui.maps.sideNoEntities')));
    for (const [cat, arr] of byCat) {
      const g = el('div', 'map-side-group');
      const gh = el('div', 'map-side-cat');
      gh.append(catIconEl(cat, 14), el('span', null, catLabel(cat)), el('span', 'map-side-n', String(arr.length)));
      g.append(gh);
      for (const e of arr) g.append(entityRow(e, cur, maps, placedHere.get(e.file), zonedHere.has(e.file), portraits.get(e.file)));
      list.append(g);
    }
    if (cur) sideMapSections(list, cur, maps);
  };
  q.oninput = () => { view.sideQ = q.value; paint(); };
  paint();
}

function entityRow(e, cur, maps, pin, zoned, portrait) {
  const row = el('div', 'map-ent k-card' + (pin ? ' placed' : ''));
  row.dataset.entity = e.file;
  const av = el('span', 'k-card-av');
  if (portrait) { const im = el('img'); im.src = mapImgURL('Images/' + portrait); im.alt = ''; im.draggable = false; av.append(im); }
  else av.append(catIconEl(e.cat, 16));
  const main = el('div', 'k-card-main');
  main.append(el('div', 'k-card-title', e.name));
  const subBits = [];
  if (pin) subBits.push(gi('map-pin') + ' ' + t('ui.maps.entPlaced'));
  if (zoned) subBits.push(gi('vector-polygon') + ' ' + t('ui.maps.entZoned'));
  if (!subBits.length) subBits.push(catLabel(e.cat));
  main.append(el('div', 'k-card-sub', subBits.join(' · ')));
  row.append(av, main);
  row.title = cur ? t('ui.maps.entRowTip') : t('ui.maps.entRowTipGallery');
  // หยิบใส่: ลากไปวางบนแผนที่ (หรือแผงอื่นที่รับตัวละคร)
  row.draggable = true;
  row.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.effectAllowed = 'copy';
    setDrag(ev.dataTransfer, 'entity', { path: e.file, file: e.file, title: e.name, cat: e.cat });
  });
  row.onclick = (ev) => {
    if (ev.ctrlKey || ev.metaKey) { openEntity(e.file); return; }
    if (cur && pin) { view.focusPin = { id: pin.id, x: pin.x, y: pin.y }; view.sel = new Set([pin.id]); refresh(); setTimeout(scrollFocusIntoView, 0); return; }
    const where = pinsOfEntity(maps, e.file);
    if (where.length) { focusMapPin(where[0].map.id, where[0].pin.id, null); return; }
    setStatus(cur ? t('ui.maps.entDragHint') : t('ui.maps.entNotPlacedAny'));
  };
  row.ondblclick = () => openEntity(e.file);
  row.oncontextmenu = (ev) => {
    ev.preventDefault();
    const where = pinsOfEntity(maps, e.file);
    popupMenu(ev.clientX, ev.clientY, [
      { label: t('ui.maps.entOpenWiki'), click: () => openEntity(e.file) },
      cur ? { label: t('ui.maps.entPlaceCenter'), click: () => placeEntity(cur, e, 50, 50) } : null,
      cur ? { label: t('ui.maps.zoneDraw'), click: () => startZoneDraw(cur, e) } : null,
      where.length ? { label: t('ui.maps.entGoPins'), sub: () => where.map((w) => ({
        text: (w.map.name || '') + ' · ' + (w.pin.label || e.name), click: () => focusMapPin(w.map.id, w.pin.id, null) })) } : null,
    ].filter(Boolean));
  };
  return row;
}

function sideMapSections(list, cur, maps) {
  // ── แผนที่ย่อย / แผนที่แม่ ──
  const par = parentMap(maps, cur.id);
  const kids = childMaps(maps, cur.id);
  if (par || kids.length) {
    const g = el('div', 'map-side-group');
    g.append(el('div', 'map-side-cat', gi('layers') + ' ' + t('ui.maps.sideSubMaps')));
    if (par) {
      const up = el('div', 'map-side-link', gi('arrow-up') + ' ' + par.name);
      up.title = t('ui.maps.sideParentTip');
      up.onclick = () => enterMap(par.id);
      g.append(up);
    }
    for (const k of kids) {
      const r = el('div', 'map-side-link', gi('door') + ' ' + k.name);
      r.title = t('ui.maps.sideChildTip');
      r.onclick = () => enterMap(k.id);
      g.append(r);
    }
    list.append(g);
  }
  // ── โซน ──
  const zones = mapZones(cur);
  if (zones.length) {
    const g = el('div', 'map-side-group');
    g.append(el('div', 'map-side-cat', gi('vector-polygon') + ' ' + t('ui.maps.sideZones')));
    for (const z of zones.slice().reverse()) {
      const area = niceArea(zoneAreaM2(cur, z));
      const inside = pinsInZone(cur, z);
      const r = el('div', 'map-side-link map-side-zone' + (view.selZone === z.id ? ' on' : ''));
      const sw = el('span', 'map-zone-sw'); sw.style.background = z.color;
      const nm = el('span', 'map-side-zname', z.name || t('ui.common.notNamed'));
      r.append(sw, nm);
      // [alpha.168] โซนไม่ใช่แค่ของตกแต่ง: บอกว่าลิงก์กับใคร + ในเขตมีหมุดกี่ตัว
      if (z.entityFile) r.append(el('span', 'map-side-zlink', gi('link')));
      r.append(el('span', 'map-side-n', (inside.length ? gi('map-pin') + inside.length + ' ' : '') + (area ? areaText(area) : '')));
      r.title = [z.name || '', inside.map((p) => p.label).filter(Boolean).join(', ')].filter(Boolean).join('\n');
      r.onclick = () => { view.selZone = view.selZone === z.id ? null : z.id; view.sel.clear(); refresh(); };
      r.oncontextmenu = (ev) => { ev.preventDefault(); zoneMenu(cur, z, ev.clientX, ev.clientY); };
      g.append(r);
    }
    list.append(g);
  }
  // ── เส้นทาง (ย้ายจากใต้แผนที่มาอยู่แถบซ้าย — แผนที่ได้พื้นที่เต็มแผง) ──
  list.append(buildRoutesPanel(cur));
  // ── ฉากบนแผนที่นี้ + เส้นทางของเรื่อง ──
  const here = scenesForMap(scenesCache || [], cur.id);
  if (here.length) {
    const g = el('div', 'map-side-group');
    const h = el('div', 'map-side-cat', gi('file') + ' ' + tf('ui.maps.sideScenes', here.length));
    const jb = el('button', 'cmp-mini map-journey-btn' + (view.journey ? ' on' : ''), gi('route') + ' ' + t('ui.maps.journey'));
    jb.title = t('ui.maps.journeyTip');
    jb.onclick = () => { view.journey = !view.journey; refresh(); };
    h.append(jb);
    g.append(h);
    const jr = storyJourney(cur, scenesCache || [], (s) => extractNum(s.storyDate));
    jr.stops.forEach((st, i) => {
      const r = el('div', 'map-side-link map-side-scene');
      r.append(el('span', 'map-side-num', String(i + 1)), el('span', null, st.scene.title || t('ui.common.notNamed')));
      if (st.scene.storyDate) r.append(el('span', 'map-side-n', st.scene.storyDate));
      const leg = i > 0 ? jr.legs[i - 1] : null;
      if (leg && leg.meters != null) r.title = tf('ui.maps.legFrom', leg.from.title || '', distText(niceDistance(leg.meters)), travelText(leg.meters));
      r.onclick = async () => {
        const { openScene } = await import('./app.js');
        if (st.scene.filePath) openScene(st.scene.filePath, st.scene.title);
      };
      g.append(r);
    });
    if (jr.total != null && jr.stops.length > 1) {
      g.append(el('div', 'map-side-total', tf('ui.maps.journeyTotal', distText(niceDistance(jr.total)), travelText(jr.total))));
    }
    list.append(g);
  }
}

// ═══════════════════════ กลาง: แกลเลอรีแผนที่ (ภาพ 3) ═══════════════════════
function renderGallery(main, maps) {
  const head = el('div', 'map-head');
  head.append(el('div', 'map-title', t('ui.common.map3')));
  const addBtn = el('button', 'k-ok', t('ui.maps.addMap'));
  addBtn.onclick = () => addMapFlow();
  head.append(addBtn);
  main.append(head);
  const hint = el('div', 'map-hint', t('ui.maps.galleryHint'));
  main.append(hint);
  const gal = el('div', 'map-gallery');
  main.append(gal);
  const newCard = el('div', 'map-gcard map-gnew');
  newCard.append(el('div', 'map-gnew-ic', gi('map-plus')), el('div', 'map-gnew-t', t('ui.maps.galleryNew')));
  newCard.title = t('ui.maps.galleryNewTip');
  newCard.onclick = () => addMapFlow();
  // หยิบรูปจากคลังรูปมาวางที่การ์ดนี้ = สร้างแผนที่จากรูปนั้น
  bindDropTarget(newCard, { accept: ['gallery', 'image'], onDrop: (payload) => newMapFromImage(payload) });
  gal.append(newCard);
  if (!maps.length) {
    main.append(panelEmpty(t('ui.maps.notPlannedPressAdd'), { icon: 'map' }));
    return;
  }
  for (const g of groupMaps(maps)) {
    if (groupMaps(maps).length > 1) gal.append(el('div', 'map-gcat', g.cat || t('ui.common.notSpecifyCat')));
    for (const m of g.maps) {
      const c = el('div', 'map-gcard');
      c.dataset.map = m.id;
      const th = el('div', 'map-gthumb');
      if (m.image) th.style.backgroundImage = `url("${mapImgURL(m.image)}")`;
      else th.append(el('span', 'map-gthumb-empty', gi('map')));
      const st = pinStats(m);
      const badges = el('div', 'map-gbadges');
      if ((m.pins || []).length) badges.append(el('span', 'map-gbadge', gi('map-pin') + ' ' + (m.pins || []).length));
      if (st.portal) badges.append(el('span', 'map-gbadge', gi('door') + ' ' + st.portal));
      if (mapZones(m).length) badges.append(el('span', 'map-gbadge', gi('vector-polygon') + ' ' + mapZones(m).length));
      if (geoReady(m).full) badges.append(el('span', 'map-gbadge map-gbadge-geo', gi('earth')));
      th.append(badges);
      const cap = el('div', 'map-gcap');
      cap.append(el('div', 'map-gname', m.name || t('ui.common.notNamed')));
      const par = parentMap(maps, m.id);
      cap.append(el('div', 'map-gsub', par ? gi('arrow-branch') + ' ' + par.name : (m.category || '')));
      c.append(th, cap);
      c.title = t('ui.maps.galleryCardTip');
      c.onclick = () => enterMap(m.id);
      c.oncontextmenu = (ev) => {
        ev.preventDefault();
        popupMenu(ev.clientX, ev.clientY, [
          { label: t('ui.maps.galleryOpen'), click: () => enterMap(m.id) },
          { label: t('ui.common.exportPNG'), click: () => exportMapPng(m) },
        ]);
      };
      // หยิบใส่การ์ด: ตัวละคร/สถานที่ = ปักกลางแผนที่ใบนี้ · แผนที่อื่น = ประตูไปแผนที่นั้น (ไม่ต้องเข้าไปก่อน)
      bindDropTarget(c, { accept: ['entity', 'map', 'scene'],
        onDrop: (payload) => dropOnMap(m, payload, { x: 50, y: 50 }, null) });
      // ลากการ์ดแผนที่ไปวางบนแผนที่อื่น (ในแผงนี้ = ประตู) — ใช้ชนิดเดียวกับแถวใน Explorer
      c.draggable = true;
      c.addEventListener('dragstart', (ev) => { ev.dataTransfer.effectAllowed = 'copy'; setDrag(ev.dataTransfer, 'map', { id: m.id, name: m.name || '' }); });
      gal.append(c);
    }
  }
}

/**
 * [alpha.167 · รอบต่อ · บั๊ก] รูปที่หยิบมา → ทาง 'Images/…' ที่แผนที่เก็บ · null = อยู่นอกคลังรูปของโปรเจกต์
 * คลังรูป = ทางในคลังอยู่แล้ว · รูปจาก Explorer = ทางเต็ม (เดิมไม่รับ แม้ป้ายข้างเคอร์เซอร์บอกว่ารับ)
 */
async function droppedImageRel(payload) {
  const it = payload && payload.items[0];
  if (!it || !it.path) return null;
  if (payload.kind === 'gallery') return 'Images/' + it.path;
  if (payload.kind !== 'image') return null;
  const rel = String(await kapi.relative(await kapi.join(state.root, 'Images'), it.path)).replace(/\\/g, '/');
  return rel && !rel.startsWith('..') && !/^[a-z]:/i.test(rel) && !rel.startsWith('/') ? 'Images/' + rel : null;
}
async function newMapFromImage(payload) {
  const it = payload.items[0];
  if (!it) return;
  const S = mapsState_C.s;
  const rel = await droppedImageRel(payload);
  if (!rel) { setStatus(t('ui.maps.dropImageFromGallery')); return; }
  const { newMap } = await import('./maps.js');
  const name = await ask(t('ui.common.nameMap'), { value: String(it.title || '').replace(/\.[^.]+$/, '') });
  if (!name) return;
  const m = newMap(name, rel);
  m.order = S.data.maps.length;
  S.data.maps.push(m);
  await saveMaps(S.data);
  await enterMap(m.id);
}

// ═══════════════════════ มุมมองแผนที่ ═══════════════════════
// [alpha.168] ยกเครื่องทั้งมุมมอง — ผู้ใช้: "ขนาด map ต้องเป็น infinite ไม่ใช่อิงตามขนาดรูป · รูปเป็นแค่ background
//   และ reference · ถึงไม่ใส่รูป map ก็ต้องใช้งานได้" + วิดีโอตัวอย่าง (คลิกขวา = หมุด/โซน/ตัวหนังสือ ·
//   เลือกของแล้วมีแถบเครื่องมือลอยเหนือของนั้น · โซนตั้งสี/ความจาง/ลาย/ลิงก์ได้ · ระหว่างวาดโซนของอื่นจางลง)
//
//   .map-stage (ช่องมอง · ไม่มีแถบเลื่อน) → .map-canvas (กรอบอ้างอิงกว้าง FRAME_W พิกเซลของโลก · transform = กล้อง)
//   ของทุกชิ้นวางด้วย % ของกรอบเหมือนเดิม (ไฟล์เดิมเปิดได้ทุกไบต์) แต่เกิน 0–100 ได้ = อยู่นอกรูป
//   หมุด/ป้ายคงขนาดบนจอ (scale(1/z)) · เส้นใช้ non-scaling-stroke · กริดจัตุรัสไม่มีขอบ
export const FRAME_W = 1000;
/** ป้ายลายของพื้นโซน — ตารางคีย์เต็ม (ห้ามประกอบคีย์ภาษาจากชิ้นส่วน · ตัวตรวจไฟล์ภาษามองไม่เห็น) */
const PATTERN_KEYS = { none: 'ui.maps.pattern_none', hatch: 'ui.maps.pattern_hatch', cross: 'ui.maps.pattern_cross', dots: 'ui.maps.pattern_dots' };
/** สัดส่วนกรอบอ้างอิง: ตามรูป (จดไว้ใน map.aspect ตอนรูปโหลด) · ไม่มีรูป = 16:10 */
export function frameAspect(cur) {
  const a = Number(cur && cur.aspect);
  return Number.isFinite(a) && a > 0 ? a : 1.6;
}
/**
 * [alpha.168] ทาค่ารูปพื้นหลัง (map.bg) ลง <img> ที่วางมุมซ้ายบนของกรอบกว้าง boxW พิกเซล
 * ภาพตั้งต้นเต็มกรอบพอดี (สัดส่วนกรอบ = สัดส่วนไฟล์ · map.aspect) แล้วแปลงด้วย matrix3d จาก bgQuad
 */
export function applyMapBgStyle(img, map, boxW = FRAME_W) {
  if (!img) return;
  const fa = frameAspect(map);
  const bg = normalizeBg(map && map.bg);
  const elW = boxW, elH = boxW / fa;
  img.style.width = elW + 'px'; img.style.height = elH + 'px';
  img.style.transformOrigin = '0 0';
  img.style.transform = isDefaultBg(bg) ? '' : bgCssMatrix(bg, fa, fa, boxW, elW, elH);
  img.style.opacity = bg.opacity < 1 ? String(bg.opacity) : '';
}
/** กล้องของแผนที่ใบนี้ (ไม่บันทึกลงไฟล์) — zoom 1 = กรอบอ้างอิงพอดีจอ · cx,cy = จุดกลางจอ (% ของกรอบ) */
function camOf(cur) {
  let c = view.cams.get(cur.id);
  if (!c) { c = { zoom: 1, cx: 50, cy: 50, fresh: true }; view.cams.set(cur.id, c); }
  return c;
}
/** กล้อง → การแปลงของผืน (พิกเซล) */
function camXf(stage, cur, cam) {
  const W = FRAME_W, H = FRAME_W / frameAspect(cur);
  const sw = stage.clientWidth || 800, sh = stage.clientHeight || 500;
  const fit = Math.min(sw / W, sh / H) * 0.92;
  const s = fit * cam.zoom;
  return { s, tx: sw / 2 - (cam.cx / 100) * W * s, ty: sh / 2 - (cam.cy / 100) * H * s, W, H, fit, sw, sh };
}

async function renderMapView(main, pane, cur) {
  const S = mapsState_C.s;
  const maps = S.data.maps;
  const redraw = () => renderMaps(pane);
  const save = async () => { await saveMaps(S.data); };
  main.classList.add('map-main-view');

  // ── แถบหัว (แถวเดียว): แผนที่ทั้งหมด · ชื่อ/ลำดับชั้น · ค้นหา · พิกัด · ส่งออก · ⋯ ──
  const head = el('div', 'map-head map-head2');
  const home = el('button', 'cmp-mini map-home', gi('grid'));
  home.title = t('ui.maps.allMapsTip');
  home.setAttribute('aria-label', t('ui.maps.allMaps'));
  home.onclick = () => showMapGallery();
  head.append(home);
  const crumb = breadcrumb(maps, cur.id);
  const bc = el('div', 'map-crumb');
  crumb.forEach((c, i) => {
    if (c.id === cur.id) return;
    const a = el('span', 'map-crumb-item', c.name);
    a.title = t('ui.maps.sideParentTip');
    a.onclick = () => enterMap(c.id);
    bc.append(a, el('span', 'map-crumb-sep', gi('chevron-right')));
  });
  const nameInp = el('input', 'map-name-inp'); nameInp.value = cur.name;
  nameInp.title = t('ui.common.nameMap');
  nameInp.onchange = async () => { cur.name = nameInp.value.trim() || cur.name; await save(); redraw(); };
  bc.append(nameInp);
  head.append(bc);
  const search = el('input', 'map-search'); search.type = 'search';
  search.placeholder = t('ui.maps.searchPinName'); search.value = view.q;
  head.append(search);
  const gr = geoReady(cur);
  const geoBtn = el('button', 'cmp-mini map-geo-btn' + (gr.full ? ' on' : ''), gi('earth') + ' ' + t('ui.maps.geoBtn'));
  geoBtn.title = gr.full ? t('ui.maps.geoBtnTipDone') : t('ui.maps.geoBtnTip');
  geoBtn.onclick = () => openGeoPanel(cur);
  // [alpha.168] แก้รูปพื้นหลัง (มีเมื่อแผนที่มีรูป)
  const bgBtn = cur.image ? el('button', 'cmp-mini map-bg-btn' + (view.bgOpen ? ' on' : '') + (isDefaultBg(cur.bg) ? '' : ' map-bg-changed'), gi('image-edit') + ' ' + t('ui.maps.bgBtn')) : null;
  if (bgBtn) { bgBtn.title = t('ui.maps.bgBtnTip'); bgBtn.onclick = () => openBgPanel(cur); }
  const expBtn = el('button', 'cmp-mini map-exp-btn', gi('export') + ' ' + t('ui.common.export'));
  expBtn.title = t('ui.maps.exportMenuTip');
  expBtn.onclick = (e) => {
    const r = expBtn.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 4, [
      { label: t('ui.maps.exportPngAs'), click: () => exportMapPng(cur) },
      { label: t('ui.maps.exportPngLib'), click: () => exportMapPng(cur, { library: true }) },
      { label: t('ui.maps.geojson'), click: () => exportMapGeoJson(cur) },
      '-',
      { label: t('ui.maps.print'), click: () => printMap(cur) },
    ]);
  };
  const more = el('button', 'cmp-mini map-more-btn', gi('more'));
  more.title = t('ui.maps.moreTip');
  more.setAttribute('aria-label', t('ui.maps.moreTip'));
  more.onclick = () => {
    const r = more.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 4, [
      { label: t('ui.maps.changeImage'), click: async () => { const it = await pickImage(state.root); if (!it) return;
        cur.image = 'Images/' + it.file; delete cur.aspect; await save(); redraw(); } },
      cur.image ? { label: t('ui.maps.removeImage'), click: async () => { cur.image = ''; delete cur.aspect; await save(); redraw(); } } : null,
      { label: t('ui.maps.setCategory'), click: async () => {
        const v = await ask(t('ui.maps.catMapSkipEmpty'), { value: cur.category || '', placeholder: t('ui.maps.catEgWorldCurrent') });
        if (v == null) return; cur.category = String(v).trim(); await save(); redraw(); } },
      { label: t('ui.maps.addMap'), click: () => addMapFlow() },
      '-',
      { label: t('ui.maps.delMap'), danger: true, click: async () => {
        if (!(await confirmBox(tf('ui.common.delMap', cur.name), t('ui.common.del')))) return;
        // [alpha.168] ลบแผนที่ทั้งใบย้อนกลับได้ (เดิมหมุดย้อนได้ แต่ทั้งใบหายถาวร — รวมประตูจากใบอื่นที่ชี้มา)
        const snap = JSON.stringify(S.data.maps), data = S.data, name = cur.name || '';
        S.data.maps = deleteMap(maps, cur.id); S.currentId = S.data.maps[0]?.id || null;
        view.sel.clear(); view.gallery = true; await save(); redraw();
        toast(tf('ui.maps.delMapDone', name), { action: { label: t('ui.common.undoBtn'), onClick: async () => {
          const S2 = mapsState_C.s;
          if (!S2 || S2.data !== data) return;                      // โหลดใหม่/เปลี่ยนโปรเจกต์ไปแล้ว
          S2.data.maps = JSON.parse(snap);
          await saveMaps(S2.data);
          refresh();
        } } }); } },
    ].filter(Boolean));
  };
  head.append(...[bgBtn, geoBtn, expBtn, more].filter(Boolean));
  main.append(head);

  // ── แถบสลับแผนที่ (รูปย่อ) + หมวด ──
  const groups = groupMaps(maps);
  const strip = el('div', 'map-strip');
  if (groups.length > 1) {
    const catBar = el('div', 'map-catbar');
    const mkCat = (label, val) => {
      const c = el('div', 'map-cat' + (view.catFilter === val ? ' on' : ''), label);
      c.onclick = () => { view.catFilter = val; redraw(); };
      catBar.append(c);
    };
    mkCat(t('ui.common.all'), null);
    for (const g of groups) mkCat((g.cat || t('ui.common.notSpecifyCat')) + ' · ' + g.maps.length, g.cat);
    strip.append(catBar);
  }
  const bar = el('div', 'map-bar');
  const shown = groups.filter((g) => view.catFilter === null || g.cat === view.catFilter);
  for (const g of shown) {
    if (groups.length > 1) bar.append(el('div', 'map-bar-cat', g.cat || t('ui.common.notSpecifyCat')));
    const row = el('div', 'map-bar-row');
    for (const m of g.maps) {
      const chip = el('div', 'map-chip' + (m.id === S.currentId ? ' on' : ''));
      const th = el('span', 'map-chip-th');
      if (m.image) th.style.backgroundImage = `url("${mapImgURL(m.image)}")`; else th.append(el('span', null, gi('map')));
      chip.append(th, el('span', 'map-chip-name', m.name));
      const st = pinStats(m);
      if (st.portal) chip.append(el('span', 'map-chip-badge', gi('door') + st.portal));
      chip.title = m.name;
      chip.onclick = () => { S.currentId = m.id; view.sel.clear(); view.routeEdit = null; view.focusPin = null; view.selZone = null; redraw(); };
      row.append(chip);
    }
    bar.append(row);
  }
  strip.append(bar);
  if (maps.length > 1 || groups.length > 1) main.append(strip);

  // แผนที่ปัจจุบันต้องอยู่ในหมวดที่กรองไว้
  // [alpha.168 · bug hunt] ตัดสินด้วย mapForFilter (maps.js) — ได้ใบที่ต่างจากใบปัจจุบัน "จริง" เท่านั้นจึงวาดใหม่
  // เดิม: หมวดที่กรองไม่มีแผนที่เหลือ → เลือกใบแรกของทั้งหมด (หมวดไม่ตรงอีก) → วาดใหม่ไม่จบ = แอปค้างทั้งโปรแกรม
  {
    const want = mapForFilter(maps, cur.id, view.catFilter);
    if (want && want.id !== cur.id) { S.currentId = want.id; return redraw(); }
  }
  S.currentId = cur.id;
  const hint = el('div', 'map-hint', t('ui.maps.hint168'));
  main.append(hint);
  search.oninput = () => { view.q = search.value; applyPinFilter(main); };

  const counts = scenePinCounts(scenesCache, cur.id);
  const hereScenes = scenesForMap(scenesCache, cur.id);
  const editingRoute = view.routeEdit ? mapRoutes(cur).find((r) => r.id === view.routeEdit) : null;

  // ═══ พื้นที่แผนที่ ═══
  const frame = el('div', 'map-frame');
  const stage = el('div', 'map-stage');
  const drawing = !!(view.pick || view.zoneDraw || view.measure);
  const canvas = el('div', 'map-canvas' + (drawing ? ' map-picking' : '') + (view.zoneDraw ? ' map-drawing' : '')
    + (view.showLabels ? '' : ' map-nolabels'));
  const cam = camOf(cur);
  view.zoom = cam.zoom;
  if (view.bgOpen) canvas.classList.add('map-bg-editing');
  if (view.bgOpen && view.bgDrag) canvas.classList.add('map-bg-dragmode');
  canvas.style.width = FRAME_W + 'px';
  canvas.style.height = (FRAME_W / frameAspect(cur)) + 'px';
  if (cur.image) {
    const img = el('img', 'map-img');
    img.src = mapImgURL(cur.image); img.draggable = false; img.alt = '';
    applyMapBgStyle(img, cur);
    canvas.append(img);
    // จดสัดส่วนภาพไว้ในแผนที่ (กรอบอ้างอิง + ระยะจริงต้องรู้) — ต่างจากเดิม = ปรับกรอบทันที ไม่วาดใหม่ทั้งแผง
    img.addEventListener('load', () => {
      const a = img.naturalWidth && img.naturalHeight ? +(img.naturalWidth / img.naturalHeight).toFixed(5) : 0;
      // สัดส่วนเปลี่ยน (ครั้งแรกที่เปิดรูปนี้) = กรอบ/กริด/ตำแหน่งแกนตั้งเปลี่ยนตาม → วาดใหม่ครั้งเดียว
      if (a && Math.abs((+cur.aspect || 0) - a) > 1e-4) { cur.aspect = a; save().then(redraw).catch(() => {}); }
    }, { once: true });
  }
  const ov = mapOverlays(cur);
  const NS = 'http://www.w3.org/2000/svg';
  const mkSvg = (cls) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    return svg;
  };

  // ── ชั้นล่างสุด: โซน (ความจาง/ลาย/สีของโซนเอง) ──
  const zones = mapZones(cur);
  const zs = mkSvg('map-zones');
  const defs = document.createElementNS(NS, 'defs');
  zs.append(defs);
  for (const z of zones) {
    const col = z.color || ZONE_COLORS[0];
    const pat = ZONE_PATTERNS.includes(z.pattern) ? z.pattern : 'none';
    let fill = col;
    if (pat !== 'none') {
      const pid = 'mzp-' + z.id;
      const pe = document.createElementNS(NS, 'pattern');
      pe.setAttribute('id', pid); pe.setAttribute('patternUnits', 'userSpaceOnUse');
      pe.setAttribute('width', '2'); pe.setAttribute('height', '2');
      const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); pe.append(n); };
      if (pat === 'hatch' || pat === 'cross') mk('path', { d: 'M-0.5,0.5 L0.5,-0.5 M0,2 L2,0 M1.5,2.5 L2.5,1.5', stroke: col, 'stroke-width': '0.25' });
      if (pat === 'cross') mk('path', { d: 'M-0.5,1.5 L0.5,2.5 M0,0 L2,2 M1.5,-0.5 L2.5,0.5', stroke: col, 'stroke-width': '0.25' });
      if (pat === 'dots') mk('circle', { cx: '1', cy: '1', r: '0.28', fill: col });
      defs.append(pe);
      fill = `url(#${pid})`;
    }
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', zonePath(z.points));
    p.setAttribute('class', 'map-zone' + (view.selZone === z.id ? ' sel' : ''));
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    p.style.setProperty('--zc', col);
    p.style.fill = fill;
    p.style.fillOpacity = String(pat === 'none' ? zoneOpacity(z) : Math.min(1, zoneOpacity(z) * 3));
    p.dataset.zone = z.id;
    zs.append(p);
  }
  if (view.zoneDraw && view.zoneDraw.points.length) {
    const p = document.createElementNS(NS, 'path');
    const pts = view.zoneDraw.points;
    p.setAttribute('d', pts.map((q, i) => (i ? 'L' : 'M') + q.x.toFixed(3) + ',' + q.y.toFixed(3)).join(' ') + (pts.length > 2 ? ' Z' : ''));
    p.setAttribute('class', 'map-zone map-zone-draft');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    p.style.setProperty('--zc', view.zoneDraw.color);
    zs.append(p);
    const rub = document.createElementNS(NS, 'path');
    rub.setAttribute('class', 'map-zone-rubber');
    rub.setAttribute('vector-effect', 'non-scaling-stroke');
    zs.append(rub);
  }
  canvas.append(zs);
  for (const z of zones) {
    const c = polygonCentroid(z.points);
    if (z.name) {
      const lb = el('div', 'map-zone-label' + (view.selZone === z.id ? ' sel' : ''), z.name);
      lb.style.left = c.x + '%'; lb.style.top = c.y + '%';
      lb.style.setProperty('--zc', z.color || ZONE_COLORS[0]);
      lb.dataset.zone = z.id;
      canvas.append(lb);
    }
    // โซนที่เลือก = จุดยอดลากปรับรูปได้เลย (เหมือนในวิดีโอ) + จุดกลางขอบ = แทรกจุดใหม่
    if (view.selZone === z.id && !drawing) {
      z.points.forEach((pt, i) => canvas.append(zoneVertex(cur, z, i, canvas, save, redraw)));
      z.points.forEach((pt, i) => canvas.append(zoneMidHandle(cur, z, i, save, redraw)));
    }
  }
  if (view.zoneDraw) view.zoneDraw.points.forEach((pt, i) => {
    const v = el('div', 'map-zone-vtx map-zone-vtx-draft' + (i === 0 && view.zoneDraw.points.length > 2 ? ' map-zone-vtx-close' : ''));
    v.style.left = pt.x + '%'; v.style.top = pt.y + '%';
    if (i === 0) {
      v.title = t('ui.maps.zoneCloseTip');
      v.onclick = (e) => { e.stopPropagation(); finishZone(cur, save, redraw); };
    }
    canvas.append(v);
  });

  // ── กริด: ช่องจัตุรัสเสมอ (1:1) · ไม่มีขอบ (ปูเลยกรอบรูปออกไปทุกทิศ) ──
  if (ov.grid) {
    const g = el('div', 'map-grid');
    const cell = FRAME_W / gridCell(ov.gridSize, frameAspect(cur)).n;
    // ปูกว้าง 8 เท่าของกรอบทุกทิศ · ระยะเยื้องเป็นจำนวนเต็มช่อง = เส้นตรงกับมุมกรอบพอดี (ช่องจัตุรัสทั้งสองแกน)
    const H = FRAME_W / frameAspect(cur);
    const offX = Math.ceil((8 * FRAME_W) / cell) * cell, offY = Math.ceil((8 * H) / cell) * cell;
    g.style.setProperty('--cell', cell + 'px');
    g.style.left = -offX + 'px'; g.style.top = -offY + 'px';
    g.style.width = (2 * offX + FRAME_W) + 'px'; g.style.height = (2 * offY + H) + 'px';
    canvas.append(g);
  }

  // เส้นทาง + เส้นทางของเรื่อง + เส้นวัดระยะ
  const routes = view.showRoutes ? mapRoutes(cur) : [];
  const journey = view.journey ? storyJourney(cur, scenesCache || [], (s) => extractNum(s.storyDate)) : null;
  const rsvg = mkSvg('map-routes');
  for (const r of routes) {
    const d = routePath(routePoints(cur, r));
    if (!d) continue;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', r.color || ROUTE_COLORS[0]);
    p.setAttribute('stroke-width', r.id === view.routeEdit ? '4' : '2.5');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    if (r.dashed) p.setAttribute('stroke-dasharray', '6 5');
    rsvg.append(p);
  }
  if (journey && journey.stops.length > 1) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', routePath(journey.stops.map((s) => s.pt)));
    p.setAttribute('class', 'map-journey');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    rsvg.append(p);
  }
  if (view.measure && view.measure.points.length) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', routePath(view.measure.points.length > 1 ? view.measure.points : [view.measure.points[0], view.measure.points[0]]));
    p.setAttribute('class', 'map-measure');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    rsvg.append(p);
  }
  if (rsvg.childNodes.length) canvas.append(rsvg);
  if (editingRoute) {
    routePoints(cur, editingRoute).forEach((pt, i) => {
      const n = el('div', 'map-route-num', String(i + 1));
      n.style.left = pt.x + '%'; n.style.top = pt.y + '%';
      n.style.background = editingRoute.color || ROUTE_COLORS[0];
      canvas.append(n);
    });
  }
  if (journey) journey.stops.forEach((st, i) => {
    const n = el('div', 'map-route-num map-journey-num', String(i + 1));
    n.style.left = st.pt.x + '%'; n.style.top = st.pt.y + '%';
    n.title = st.scene.title || '';
    canvas.append(n);
  });
  if (view.measure) view.measure.points.forEach((pt) => {
    const v = el('div', 'map-zone-vtx map-measure-vtx'); v.style.left = pt.x + '%'; v.style.top = pt.y + '%'; canvas.append(v);
  });

  // จุดที่ตั้งมาตราส่วน/พิกัดไว้ (ตอนเปิดหน้าตั้งพิกัด หรือระหว่างจิ้ม)
  const geo = geoOf(cur);
  if (view.pick || view.geoOpen) drawGeoMarks(canvas, geo);

  const ptOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: clampW(((e.clientX - r.left) / (r.width || 1)) * 100), y: clampW(((e.clientY - r.top) / (r.height || 1)) * 100) };
  };
  const isBg = (e) => e.target === canvas || e.target === stage || (e.target.classList && (e.target.classList.contains('map-img')
    || e.target.classList.contains('map-grid') || e.target.classList.contains('map-zone') || e.target.classList.contains('map-zone-label')))
    || (e.target.closest && !!e.target.closest('svg.map-zones, svg.map-routes'));

  // ── คลิกบนผืนแผนที่ ──
  let suppressClick = false;               // กันคลิกที่เกิดหลังลาก
  stage.onclick = async (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (!isBg(e)) return;
    const pt = ptOf(e);
    if (view.pick) { view.pick.resolve(pt); return; }
    if (view.zoneDraw) { view.zoneDraw.points.push(pt); redraw(); return; }
    if (view.measure) { view.measure.points.push(pt); redraw(); return; }
    if (view.addText) { view.addText = false; await addTextAt(pt); return; }
    // โซน: คลิก = เลือก (แถบเครื่องมือของโซนโผล่) · Ctrl+คลิก = เปิดเอนทิตี้ของโซน
    const z = zoneAt(cur, pt);
    if (z && (e.ctrlKey || e.metaKey) && z.entityFile) { openEntity(z.entityFile); return; }
    if (view.sel.size) { view.sel.clear(); if (!z) { redraw(); return; } }
    if (z) { view.selZone = view.selZone === z.id ? null : z.id; redraw(); return; }
    if (view.selZone) { view.selZone = null; redraw(); return; }
    if (view.tool !== 'edit') return;
    await addPinAt(pt);
  };
  stage.ondblclick = async (e) => {
    if (!isBg(e) || view.pick || view.measure) return;
    if (view.zoneDraw) { e.preventDefault(); await finishZone(cur, save, redraw); return; }
    await addPinAt(ptOf(e));
  };
  stage.oncontextmenu = async (e) => {
    if (!isBg(e)) return;
    e.preventDefault();
    if (view.zoneDraw || view.measure) { view.zoneDraw = null; view.measure = null; redraw(); return; }
    const pt = ptOf(e);
    const z = zoneAt(cur, pt);
    if (z) { zoneMenu(cur, z, e.clientX, e.clientY); return; }
    const ll = toLatLon(cur, pt);
    const ents = await loadEntities();
    const byCat = new Map();
    for (const en of ents) { if (!byCat.has(en.cat)) byCat.set(en.cat, []); byCat.get(en.cat).push(en); }
    const others = maps.filter((m) => m.id !== cur.id);
    // เมนูแบบในวิดีโอ: หมุด ▸ · โซน · ตัวหนังสือ
    popupMenu(e.clientX, e.clientY, [
      { label: gi('map-pin') + ' ' + t('ui.maps.ctxPin'), sub: () => [
        { label: t('ui.maps.ctxPinNote'), click: () => addPinAt(pt) },
        others.length ? { label: t('ui.maps.ctxPinPortal'), sub: () => others.map((m) => ({ text: m.name || '', click: () => dropOnMap(cur, { kind: 'map', items: [{ id: m.id, title: m.name }] }, pt, null) })) } : null,
        byCat.size ? '-' : null,
        ...[...byCat].map(([cat, arr]) => ({ text: catLabel(cat), sub: () => arr.map((en) => ({ text: en.name, click: () => placeEntity(cur, en, pt.x, pt.y) })) })),
      ].filter(Boolean) },
      { label: gi('vector-polygon') + ' ' + t('ui.maps.zone'), click: () => { startZoneDraw(cur, null); view.zoneDraw.points.push(pt); refresh(); } },
      { label: gi('font') + ' ' + t('ui.maps.ctxText'), click: () => addTextAt(pt) },
      '-',
      { label: gi('tape-measure') + ' ' + t('ui.maps.measureStart'), click: () => { view.measure = { points: [pt] }; redraw(); } },
      view.clip.length ? { label: tf('ui.maps.pastePin', view.clip.length), click: () => pasteClip(pt) } : null,
      ll ? { label: t('ui.maps.ctxCopyCoords') + ' ' + formatLatLon(ll), click: () => navigator.clipboard.writeText(formatLatLon(ll)).catch(() => {}) } : null,
      cur.image ? { label: gi('image-edit') + ' ' + t('ui.maps.bgCtx'), click: () => openBgPanel(cur) } : null,
      { label: t('ui.maps.fitAll'), click: () => fitAll() },
    ].filter(Boolean));
  };
  async function addPinAt(pt) {
    const pin = newPin(pt.x, pt.y);
    const res = await pinDialog(pin, maps, cur.id);
    if (!res) return;
    cur.pins.push(res); view.sel = new Set([res.id]); await save(); redraw();
  }
  async function addTextAt(pt) {
    const v = await ask(t('ui.maps.textAsk'), { value: '', placeholder: t('ui.maps.textAskPh') });
    if (!v || !String(v).trim()) return;
    const p = newPin(pt.x, pt.y, 'text');
    p.label = String(v).trim();
    cur.pins.push(p); view.sel = new Set([p.id]); await save(); redraw();
  }
  async function pasteClip(pt) {
    const added = clonePins(view.clip, view.clip.map((p) => p.id), 2, cur.id);
    if (pt && added.length) {
      const cx = added.reduce((s, p) => s + p.x, 0) / added.length, cy = added.reduce((s, p) => s + p.y, 0) / added.length;
      for (const p of added) { p.x = clampW(p.x - cx + pt.x); p.y = clampW(p.y - cy + pt.y); }
    }
    cur.pins = [...(cur.pins || []), ...added];
    view.sel = new Set(added.map((p) => p.id));
    await save(); setStatus(tf('ui.maps.pastePinDone', added.length, cur.name)); redraw();
  }

  function dragBgImage(e) {
    const img = canvas.querySelector('.map-img');
    const b0 = normalizeBg(cur.bg);
    const sx = e.clientX, sy = e.clientY;
    const xf0 = camXf(stage, cur, cam);
    let moved = false;
    const put = (bg) => { cur.bg = compactBg(bg) || undefined; if (!cur.bg) delete cur.bg; applyMapBgStyle(img, cur); syncBgPanel(cur); };
    const mv = (ev) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 3) return;
      moved = true; stage.classList.add('panning');
      put({ ...b0, x: b0.x + ((ev.clientX - sx) / xf0.s / xf0.W) * 100, y: b0.y + ((ev.clientY - sy) / xf0.s / xf0.H) * 100 });
    };
    const offEsc = escCancelDrag(() => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      stage.classList.remove('panning'); put(b0);
      if (moved) suppressClick = true;
    });
    const up = async () => {
      offEsc();
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      stage.classList.remove('panning');
      if (moved) { suppressClick = true; await saveMaps(mapsState_C.s.data); }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    e.preventDefault();
  }

  // ── ลากที่ว่าง = เลื่อนแผนที่ (อิสระ ไม่ติดขอบรูป) · Shift+ลาก = เลือกเป็นกรอบ · ลากโซนที่เลือก = ย้ายทั้งโซน ──
  stage.onpointerdown = (e) => {
    if (e.target.closest && e.target.closest('.map-hud, .map-ctx, .map-geo-pop, .map-bg-pop, .map-floatbar')) return;
    // [alpha.168] โหมดลากย้ายรูปพื้นหลัง: ลากบนผืน = ย้ายจุดกลางภาพ (หมุด/โซนไม่ขยับ) · Esc = คืนตำแหน่งเดิม
    if (view.bgOpen && view.bgDrag && cur.image && e.button === 0 && isBg(e)) return dragBgImage(e);
    const zoneHit = view.selZone && !drawing && e.button === 0 && !e.shiftKey && isBg(e) ? zoneAt(cur, ptOf(e)) : null;
    if (zoneHit && zoneHit.id === view.selZone) return dragZone(e, zoneHit);
    if (e.button === 1 || (e.button === 0 && !e.shiftKey && isBg(e))) {
      const sx = e.clientX, sy = e.clientY, c0 = { ...cam };
      let moved = false;
      const xf0 = camXf(stage, cur, cam);
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
        moved = true; stage.classList.add('panning');
        cam.cx = c0.cx - ((ev.clientX - sx) / xf0.s / xf0.W) * 100;
        cam.cy = c0.cy - ((ev.clientY - sy) / xf0.s / xf0.H) * 100;
        applyCam();
      };
      const offEsc = escCancelDrag(() => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        stage.classList.remove('panning'); Object.assign(cam, c0); applyCam();
        if (moved) suppressClick = true;
      });
      const up = () => {
        offEsc();
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        stage.classList.remove('panning');
        if (moved) suppressClick = true;
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      if (e.button === 1) e.preventDefault();
      return;
    }
    if (!e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const fr = frame.getBoundingClientRect();
    const box = el('div', 'map-rubber');
    frame.append(box);
    const x0 = e.clientX, y0 = e.clientY;
    const paint = (ev) => {
      box.style.left = (Math.min(x0, ev.clientX) - fr.left) + 'px'; box.style.top = (Math.min(y0, ev.clientY) - fr.top) + 'px';
      box.style.width = Math.abs(ev.clientX - x0) + 'px'; box.style.height = Math.abs(ev.clientY - y0) + 'px';
    };
    paint(e);
    const offEsc = escCancelDrag(() => {
      window.removeEventListener('pointermove', paint); window.removeEventListener('pointerup', up);
      box.remove(); suppressClick = true;
    });
    const up = (ev) => {
      offEsc();
      window.removeEventListener('pointermove', paint); window.removeEventListener('pointerup', up);
      box.remove();
      if (Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - y0) < 3) return;
      suppressClick = true;
      const a = ptOf({ clientX: Math.min(x0, ev.clientX), clientY: Math.min(y0, ev.clientY) });
      const b = ptOf({ clientX: Math.max(x0, ev.clientX), clientY: Math.max(y0, ev.clientY) });
      for (const p of cur.pins || []) if (p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y) view.sel.add(p.id);
      redraw();
    };
    window.addEventListener('pointermove', paint); window.addEventListener('pointerup', up);
  };
  function dragZone(e, z) {
    e.preventDefault();
    const p0 = ptOf(e), orig = z.points.map((q) => ({ ...q }));
    let moved = false;
    const path = canvas.querySelector(`.map-zone[data-zone="${z.id}"]`);
    const put = () => {
      if (path) path.setAttribute('d', zonePath(z.points));
      const c = polygonCentroid(z.points);
      const lb = canvas.querySelector(`.map-zone-label[data-zone="${z.id}"]`);
      if (lb) { lb.style.left = c.x + '%'; lb.style.top = c.y + '%'; }
      canvas.querySelectorAll('.map-zone-vtx:not(.map-zone-vtx-draft), .map-zone-mid').forEach((n) => { n.style.display = 'none'; });
    };
    const mv = (ev) => {
      const p = ptOf(ev);
      if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) return;
      moved = true;
      z.points = orig.map((q) => ({ x: clampW(q.x + p.x - p0.x), y: clampW(q.y + p.y - p0.y) }));
      put(); positionCtx();
    };
    const offEsc = escCancelDrag(() => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      z.points = orig; put(); redraw();
      if (moved) suppressClick = true;
    });
    const up = async () => {
      offEsc();
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (moved) { suppressClick = true; await save(); redraw(); }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  // ── วาดหมุด (ป้ายรูปย่อกรอบมน + ป้ายชื่อใต้หมุด · คงขนาดบนจอ) ──
  const portraits = await loadPortraits();
  // ป้ายของหมุดเอนทิตี้ = ชื่อปัจจุบันใน Wiki (ชื่อ ณ ตอนปักค้างได้เมื่อเปลี่ยนชื่อ)
  const entNames = new Map((await loadEntities()).map((e) => [e.file, e.name]));
  const pinScale = pinScaleOf(cur);
  for (const pin of cur.pins || []) {
    const shown = (pin.kind === 'entity' && entNames.get(pin.entityFile)) || pin.label || '';
    const selected = view.sel.has(pin.id);
    const el2 = el('div', 'map-pin map-pin-' + (pin.kind || 'note') + (selected ? ' sel' : '') + (pin.hideLabel ? ' map-pin-nolabel' : ''));
    el2.dataset.pin = pin.id;
    el2.style.left = pin.x + '%'; el2.style.top = pin.y + '%';
    const k = pinScale * pinSizeK(pin);
    if (k !== 1 || pinScale !== 1) el2.style.setProperty('--pin-scale', String(+k.toFixed(3)));
    if (pin.color) el2.style.setProperty('--pin-color', pin.color);
    if (pin.kind === 'text') {
      el2.append(el('span', 'map-text-label', pin.label || ''));
    } else {
      const badge = el('span', 'map-pin-badge');
      const thumb = pinThumb(pin, portraits, maps);
      if (thumb) {
        const av = el('span', 'map-pin-portrait' + (thumb.child ? ' map-pin-child' : ''));
        const im = el('img');
        im.src = thumb.url; im.alt = shown; im.draggable = false;
        im.onerror = () => { av.replaceWith(el('span', 'map-pin-icon', (PIN_KIND[pin.kind] || PIN_KIND.note).icon)); };
        av.append(im);
        badge.append(av);
      } else {
        badge.append(el('span', 'map-pin-icon', (PIN_KIND[pin.kind] || PIN_KIND.note).icon));
      }
      el2.append(badge);
      if (shown && view.showLabels && !pin.hideLabel) el2.append(el('span', 'map-pin-label', shown));
      const scHere = hereScenes.filter((s) => s.pinId === pin.id);
      if (scHere.length) el2.append(el('span', 'map-pin-count', String(scHere.length)));
      const child = pin.kind === 'portal' && pin.toMap ? findMap(maps, pin.toMap) : null;
      const ll = toLatLon(cur, pin);
      el2.title = [shown || (PIN_KIND[pin.kind] || {}).label || '', pin.note, ll ? formatLatLon(ll) : '',
                   child ? tf('ui.maps.portalTip', child.name) : '',
                   scHere.length ? scHere.map((s) => gi('file') + ' ' + s.title).join('\n') : '']
        .filter(Boolean).join('\n');
    }
    el2.onclick = async (e) => {
      e.stopPropagation();
      if (suppressClick) { suppressClick = false; return; }
      if (view.pick) { view.pick.resolve({ x: pin.x, y: pin.y }); return; }
      if (view.measure) { view.measure.points.push({ x: pin.x, y: pin.y }); redraw(); return; }
      if (view.zoneDraw) { view.zoneDraw.points.push({ x: pin.x, y: pin.y }); redraw(); return; }
      if (editingRoute) { editingRoute.pinIds = [...(editingRoute.pinIds || [])];
        if (editingRoute.pinIds[editingRoute.pinIds.length - 1] !== pin.id) editingRoute.pinIds.push(pin.id);
        await save(); redraw(); return; }
      // Ctrl+คลิก = กระโดด (ประตู/หน้า Wiki) · หมุดที่ไม่มีลิงก์ = เลือกเพิ่ม/ถอน
      if (e.ctrlKey || e.metaKey) {
        if (openLink(pin)) return;
        if (view.sel.has(pin.id)) view.sel.delete(pin.id); else view.sel.add(pin.id);
        redraw(); return;
      }
      if (e.shiftKey) { view.sel.add(pin.id); redraw(); return; }
      if (e.altKey || view.tool === 'edit') return editPin(pin);
      if (view.tool === 'move') { setStatus(t('ui.maps.modeMovePosDrag')); return; }
      // คลิก = เลือก (แถบเครื่องมือลอยเหนือหมุด) · คลิกซ้ำ/ดับเบิลคลิก = เปิดลิงก์
      if (view.sel.size === 1 && view.sel.has(pin.id) && openLink(pin)) return;
      view.sel = new Set([pin.id]); view.selZone = null; redraw();
    };
    el2.ondblclick = (e) => { e.stopPropagation(); if (!openLink(pin)) editPin(pin); };
    el2.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      popupMenu(e.clientX, e.clientY, [
        { label: t('ui.maps.pinEdit'), click: () => editPin(pin) },
        pin.kind === 'entity' && pin.entityFile ? { label: t('ui.maps.entOpenWiki'), click: () => openEntity(pin.entityFile) } : null,
        pin.kind === 'portal' && pin.toMap ? { label: t('ui.maps.portalEnter'), click: () => enterMap(pin.toMap) } : null,
        pin.kind !== 'text' ? { label: t('ui.maps.zoneDraw'), click: () => startZoneDraw(cur, pin.kind === 'entity' ? { file: pin.entityFile, name: shown } : { file: '', name: pin.label }) } : null,
        { label: t('ui.maps.measureFromPin'), click: () => { view.measure = { points: [{ x: pin.x, y: pin.y }] }; redraw(); } },
        '-',
        { label: t('ui.maps.layerTop'), click: async () => { movePinLayer(cur, pin.id, 'top'); await save(); redraw(); } },
        { label: t('ui.maps.layerBottom'), click: async () => { movePinLayer(cur, pin.id, 'bottom'); await save(); redraw(); } },
        '-',
        { label: t('ui.common.del'), danger: true, click: () => removePins(cur, [pin.id], save, redraw) },
      ].filter(Boolean));
    };
    // ลากหมุด: โหมดเลือก/ย้ายลากได้ตรง ๆ (เหมือนในวิดีโอ) · ลากไม่ถึง 3px = คลิก
    el2.onpointerdown = (e) => {
      if (view.tool === 'edit' || drawing || editingRoute) return;
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      const group = (view.sel.has(pin.id) && view.sel.size > 1) ? [...view.sel] : [pin.id];
      const start = new Map((cur.pins || []).filter((p) => group.includes(p.id)).map((p) => [p.id, { x: p.x, y: p.y }]));
      const ox = e.clientX, oy = e.clientY;
      let moved = false;
      const mv = (ev) => {
        const dx = ((ev.clientX - ox) / r.width) * 100, dy = ((ev.clientY - oy) / r.height) * 100;
        if (!moved && Math.abs(ev.clientX - ox) < 3 && Math.abs(ev.clientY - oy) < 3) return;
        moved = true; el2.classList.add('dragging');
        for (const p of cur.pins || []) {
          const s0 = start.get(p.id); if (!s0) continue;
          p.x = clampW(s0.x + dx); p.y = clampW(s0.y + dy);
          const node = canvas.querySelector(`.map-pin[data-pin="${p.id}"]`);
          if (node) { node.style.left = p.x + '%'; node.style.top = p.y + '%'; }
        }
        positionCtx();
      };
      const offEsc = escCancelDrag(() => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        el2.classList.remove('dragging');
        for (const p of cur.pins || []) {
          const s0 = start.get(p.id); if (!s0) continue;
          p.x = s0.x; p.y = s0.y;
          const node = canvas.querySelector(`.map-pin[data-pin="${p.id}"]`);
          if (node) { node.style.left = p.x + '%'; node.style.top = p.y + '%'; }
        }
        positionCtx();
        if (moved) suppressClick = true;
      });
      const up = async () => {
        offEsc();
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        el2.classList.remove('dragging');
        if (moved) { suppressClick = true; await save(); redraw(); }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    canvas.append(el2);
  }
  function openLink(pin) {
    if (pin.kind === 'portal' && pin.toMap && findMap(maps, pin.toMap)) { enterMap(pin.toMap); return true; }
    if (pin.kind === 'entity' && pin.entityFile) { openEntity(pin.entityFile); return true; }
    return false;
  }
  async function editPin(pin) {
    const res = await pinDialog({ ...pin }, maps, cur.id, true);
    if (res === 'DELETE') { await removePins(cur, [pin.id], save, redraw); return; }
    if (res) { Object.assign(pin, res); await save(); redraw(); }
  }

  // ฉากที่ปักพิกัดลอย (ไม่ผูกหมุด)
  for (const s of hereScenes) {
    if (s.pinId || s.pinX == null) continue;
    const d = el('div', 'map-scene-dot', gi('radio-on'));
    d.style.left = s.pinX + '%'; d.style.top = s.pinY + '%';
    d.title = gi('file') + ' ' + (s.title || '') + t('ui.maps.scenePinCantBind');
    canvas.append(d);
  }
  if (view.focusPin) {
    const f = el('div', 'map-focus');
    f.style.left = view.focusPin.x + '%'; f.style.top = view.focusPin.y + '%';
    canvas.append(f);
  }
  stage.append(canvas);
  frame.append(stage);
  if (ov.compass) {
    const c = el('div', 'map-compass');
    c.innerHTML = '<span class="map-compass-n">N</span><span class="map-compass-needle">' + gi('triangle-up') + '</span>';
    if (geo.north) c.style.transform = `rotate(${-geo.north}deg)`;
    c.title = t('ui.maps.topImage');
    frame.append(c);
  }

  // ── HUD ลอยบนแผนที่ ──
  const zoomHud = buildZoomHud(cur, main, ov, save, redraw);
  frame.append(zoomHud);                                       // ขวาล่าง: ซูม + ชั้นแสดงผล
  frame.append(buildToolRail(cur, redraw, save));              // ซ้าย: เครื่องมือ (ไอคอนตั้ง)
  const readout = el('div', 'map-readout');
  frame.append(readout);
  const scaleHud = buildScaleHud(cur, ov);
  if (scaleHud) frame.append(scaleHud);
  const floatBars = el('div', 'map-floatbar');
  const modeBar = buildModeBar(cur, redraw, save);
  if (modeBar) floatBars.append(modeBar);
  if (editingRoute) {
    const rb = el('div', 'map-routebar');
    rb.append(el('span', null, tf('ui.maps.busyNextRouteClick', editingRoute.name, (editingRoute.pinIds || []).length)));
    const undoB = el('button', 'cmp-mini', t('ui.maps.dotLatest'));
    undoB.title = t('ui.maps.dotLatestTip');
    undoB.onclick = async () => { (editingRoute.pinIds || []).pop(); await save(); redraw(); };
    const doneB = el('button', 'cmp-mini k-ok', t('ui.maps.done'));
    doneB.onclick = () => { view.routeEdit = null; redraw(); };
    rb.append(undoB, doneB);
    floatBars.append(rb);
  }
  floatBars.append(buildSelBar(cur, redraw, save, pasteClip));
  frame.append(floatBars);
  const foot = el('div', 'map-foot');
  { const st = pinStats(cur);
    foot.textContent = tf('ui.maps.portalSceneBindMap', st.entity, st.portal, st.note, hereScenes.length) + (counts[''] ? tf('ui.maps.scenePin', counts['']) : ''); }
  frame.append(foot);
  main.append(frame);
  if (view.geoOpen) frame.append(buildGeoPanel(cur));
  if (view.bgOpen && cur.image) frame.append(buildBgPanel(cur));

  // ── แถบเครื่องมือลอยของสิ่งที่เลือก (หมุดตัวเดียว / โซน) — แบบในวิดีโอ ──
  let ctx = null;
  const selPin = view.sel.size === 1 ? (cur.pins || []).find((p) => view.sel.has(p.id)) : null;
  const selZone = view.selZone ? zones.find((z) => z.id === view.selZone) : null;
  if (!drawing && !editingRoute && (selPin || selZone)) {
    const ents = await loadEntities();
    ctx = selPin ? buildPinCtx(cur, selPin, maps, ents, portraits, save, redraw) : buildZoneCtx(cur, selZone, ents, save, redraw, () => fitTo(selZone.points));
    frame.append(ctx);
  }
  function positionCtx() {
    if (!ctx) return;
    const fr = frame.getBoundingClientRect();
    let r;
    if (selPin) { const n = canvas.querySelector(`.map-pin[data-pin="${selPin.id}"]`); if (!n) return; const b = n.getBoundingClientRect();
      r = { l: b.left - 18, t: b.top - 22 * (+n.style.getPropertyValue('--pin-scale') || 1), rgt: b.left + 18 }; }
    else { const p = canvas.querySelector(`.map-zone[data-zone="${selZone.id}"]`); if (!p) return; const b = p.getBoundingClientRect(); r = { l: b.left, t: b.top, rgt: b.right }; }
    const w = ctx.offsetWidth || 320, h = ctx.offsetHeight || 36;
    let x = (r.l + r.rgt) / 2 - fr.left - w / 2, y = r.t - fr.top - h - 12;
    x = Math.max(52, Math.min(fr.width - w - 6, x));        // 52 = พ้นรางเครื่องมือซ้าย
    if (y < 6) y = Math.min(fr.height - h - 6, r.t - fr.top + 44);
    ctx.style.left = x + 'px'; ctx.style.top = Math.max(6, y) + 'px';
  }

  // พิกัดใต้เคอร์เซอร์ (lat/lon เมื่อตั้งค่าแล้ว · ไม่งั้นเป็น %) + ระยะของเส้นวัด + เส้นยางตอนวาดโซน
  const paintReadout = (pt) => {
    const bits = [];
    const ll = pt ? toLatLon(cur, pt) : null;
    if (ll) bits.push(gi('crosshairs') + ' ' + formatLatLon(ll));
    else if (pt) bits.push(gi('crosshairs') + ' ' + pt.x.toFixed(1) + '%, ' + pt.y.toFixed(1) + '%');
    const z = pt ? zoneAt(cur, pt) : null;
    if (z && z.name) bits.push(gi('vector-polygon') + ' ' + z.name);
    if (view.measure && view.measure.points.length) {
      const pts = pt ? [...view.measure.points, pt] : view.measure.points;
      const m = pathMeters(cur, pts);
      bits.push(gi('tape-measure') + ' ' + (m != null ? distText(niceDistance(m)) + ' · ' + travelText(m) : t('ui.maps.measureNeedScale')));
    }
    readout.textContent = bits.join('   ');
    readout.style.display = bits.length ? '' : 'none';
    const rub = canvas.querySelector('.map-zone-rubber');
    if (rub && view.zoneDraw && view.zoneDraw.points.length && pt) {
      const last = view.zoneDraw.points[view.zoneDraw.points.length - 1], first = view.zoneDraw.points[0];
      rub.setAttribute('d', `M${last.x},${last.y} L${pt.x},${pt.y}` + (view.zoneDraw.points.length > 1 ? ` L${first.x},${first.y}` : ''));
    }
  };
  paintReadout(null);
  stage.addEventListener('pointermove', (e) => paintReadout(ptOf(e)));
  stage.addEventListener('pointerleave', () => paintReadout(null));

  // ── กล้อง ──
  function applyCam() {
    const xf = camXf(stage, cur, cam);
    canvas.style.transform = `translate(${xf.tx}px, ${xf.ty}px) scale(${xf.s})`;
    canvas.style.setProperty('--z', String(xf.s));
    view.zoom = cam.zoom;
    const zl = zoomHud.querySelector('.map-zoom-label');
    if (zl) zl.textContent = Math.round(cam.zoom * 100) + '%';
    if (scaleHud && scaleHud._update) scaleHud._update(xf.s * FRAME_W / 100);
    positionCtx();
  }
  function setZoom(z, anchor) {
    const xf0 = camXf(stage, cur, cam);
    const nz = clampZoom(z);
    const ax = anchor ? anchor.x * xf0.sw : xf0.sw / 2, ay = anchor ? anchor.y * xf0.sh : xf0.sh / 2;
    // จุดใต้จุดยึด (พิกัดโลก) ต้องอยู่ที่เดิมหลังซูม
    const wx = (ax - xf0.tx) / xf0.s, wy = (ay - xf0.ty) / xf0.s;
    cam.zoom = nz;
    const s1 = xf0.fit * nz;
    cam.cx = ((xf0.sw / 2 - (ax - wx * s1)) / s1 / xf0.W) * 100;
    cam.cy = ((xf0.sh / 2 - (ay - wy * s1)) / s1 / xf0.H) * 100;
    applyCam();
  }
  function fitTo(points) {
    if (!points || !points.length) return;
    const xs = points.map((p) => +p.x), ys = points.map((p) => +p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const xf = camXf(stage, cur, cam);
    const bw = Math.max(2, x1 - x0) / 100 * xf.W, bh = Math.max(2, y1 - y0) / 100 * xf.H;
    cam.zoom = clampZoom(Math.min(xf.sw / bw, xf.sh / bh) * 0.8 / xf.fit);
    cam.cx = (x0 + x1) / 2; cam.cy = (y0 + y1) / 2;
    applyCam();
  }
  /** พอดีจอ: ทุกอย่างอยู่ในรูป = เห็นทั้งรูป (100%) · มีของนอกรูป = ครอบทุกอย่าง */
  function fitAll() {
    const b = mapBounds(cur, { frame: !!cur.image || !(cur.pins || []).length });
    if (b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 100 && b.y1 <= 100 && (cur.image || !(cur.pins || []).length)) {
      cam.zoom = 1; cam.cx = 50; cam.cy = 50; applyCam(); return;
    }
    fitTo([{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y1 }]);
  }
  main._setZoom = setZoom;
  main._fitAll = fitAll;
  main._cam = () => ({ ...cam });
  main._panBy = (dx, dy) => { const xf = camXf(stage, cur, cam); cam.cx += (dx / xf.s / xf.W) * 100; cam.cy += (dy / xf.s / xf.H) * 100; applyCam(); };
  requestAnimationFrame(() => {
    const fresh = cam.fresh; delete cam.fresh;
    if (view.focusPin) { cam.cx = view.focusPin.x; cam.cy = view.focusPin.y; if (cam.zoom < 1.5) cam.zoom = 1.5; applyCam(); }
    else if (fresh) fitAll();                    // เปิดแผนที่ใบนี้ครั้งแรก = เห็นทุกอย่าง (รวมหมุดนอกรูป)
    else applyCam();
  });
  // ขนาดช่องมองเปลี่ยน (ลากแผง/หน้าต่าง) = คงจุดกลางเดิม
  const ro = new ResizeObserver(() => { if (stage.isConnected) applyCam(); else ro.disconnect(); });
  ro.observe(stage);

  // ล้อ = ซูมยึดเคอร์เซอร์ (แบบแผนที่ในเกม) · Shift+ล้อ = เลื่อนแนวนอน · ทัชแพดสองนิ้ว (deltaX) = เลื่อน
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) { main._panBy(e.deltaY || e.deltaX, 0); return; }
    const r = stage.getBoundingClientRect();
    setZoom(zoomLadder(cam.zoom, e.deltaY < 0 ? 1 : -1),
      { x: (e.clientX - r.left) / (r.width || 1), y: (e.clientY - r.top) / (r.height || 1) });
  }, { passive: false });
  // คีย์บอร์ดบนแผนที่ (ตัวดักของ stage เอง — กฎข้อ 8)
  stage.tabIndex = 0;
  stage.addEventListener('keydown', async (e) => {
    if (e.target !== stage && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const step = 60;
    if (view.zoneDraw) {
      if (e.key === 'Enter') { e.preventDefault(); await finishZone(cur, save, redraw); return; }
      if (e.key === 'Backspace') { e.preventDefault(); view.zoneDraw.points.pop(); redraw(); return; }
    }
    if (e.key === 'Escape' && (view.zoneDraw || view.measure || view.pick || view.addText)) {
      e.preventDefault(); e.stopPropagation();
      if (view.pick) view.pick.resolve(null);
      view.zoneDraw = null; view.measure = null; view.addText = false; redraw(); return;
    }
    if (e.key === 'Escape' && (view.sel.size || view.selZone)) { e.preventDefault(); e.stopPropagation(); view.sel.clear(); view.selZone = null; redraw(); return; }
    if (e.key === 'Delete' && (view.sel.size || view.selZone)) {
      e.preventDefault();
      if (view.sel.size) await removePins(cur, [...view.sel], save, redraw);
      else if (selZone && await confirmBox(tf('ui.maps.zoneDeleteQ', selZone.name || ''), t('ui.common.del'))) { deleteZone(cur, selZone.id); view.selZone = null; await save(); redraw(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // [alpha.168 · bug hunt] จับ "ปุ่มกายภาพ" (e.code) — เดิมเทียบ e.key ซึ่งบนแป้นไทย W/A/S/D/+/-/0 ให้ตัวอักษรไทย = กดไม่ติด
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') { e.preventDefault(); main._panBy(-step, 0); }
    else if (k === 'ArrowRight' || k === 'KeyD') { e.preventDefault(); main._panBy(step, 0); }
    else if (k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); main._panBy(0, -step); }
    else if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); main._panBy(0, step); }
    else if (k === 'Equal' || k === 'NumpadAdd') { e.preventDefault(); setZoom(zoomLadder(cam.zoom, 1)); }
    else if (k === 'Minus' || k === 'NumpadSubtract') { e.preventDefault(); setZoom(zoomLadder(cam.zoom, -1)); }
    else if (k === 'Digit0' || k === 'Numpad0') { e.preventDefault(); fitAll(); }
  });

  // ── หยิบใส่: ตัวละคร/สถานที่ = หมุด · แผนที่ = ประตูไปแผนที่ย่อย · ฉาก = ผูกตำแหน่งฉาก · รูป = รูปแผนที่ ──
  bindDropTarget(stage, {
    accept: ['entity', 'map', 'scene', 'memo', 'gallery', 'image'],
    onDrop: async (payload, e) => {
      const hitPin = e.target.closest && e.target.closest('.map-pin');
      await dropOnMap(cur, payload, ptOf(e), hitPin ? hitPin.dataset.pin : null);
    },
  });

  applyPinFilter(main);
  if (drawing) requestAnimationFrame(() => stage.focus({ preventScroll: true }));
}

/** รูปย่อของหมุด: รูปที่ตั้งให้หมุดเอง → รูปประจำตัวของเอนทิตี้ → รูปของแผนที่ปลายทาง (ประตู) · ไม่มี = null */
function pinThumb(pin, portraits, maps) {
  if (pin.image) return { url: mapImgURL(pin.image) };
  const pf = pin.kind === 'entity' && pin.entityFile ? portraits.get(pin.entityFile) : '';
  if (pf) return { url: mapImgURL('Images/' + pf) };
  const child = pin.kind === 'portal' && pin.toMap ? findMap(maps, pin.toMap) : null;
  if (child && child.image) return { url: mapImgURL(child.image), child: true };
  return null;
}

function drawGeoMarks(canvas, geo) {
  canvas.querySelectorAll('.map-geo-mark').forEach((n) => n.remove());
  if (geo.scale) for (const [k, p] of [['A', geo.scale.a], ['B', geo.scale.b]]) {
    const m = el('div', 'map-geo-mark', k); m.style.left = p.x + '%'; m.style.top = p.y + '%'; canvas.append(m);
  }
  if (geo.ref) { const m = el('div', 'map-geo-mark map-geo-ref', gi('crosshairs')); m.style.left = geo.ref.x + '%'; m.style.top = geo.ref.y + '%'; canvas.append(m); }
}

/** ปุ่มไอคอนของ HUD (tooltip = ชื่อ) */
function hudBtn(icon, tip, cls = '') {
  const b = el('button', 'cmp-mini map-ico' + (cls ? ' ' + cls : ''), icon);
  b.title = tip; b.setAttribute('aria-label', tip);
  return b;
}

/** แถบเลือกหลายหมุด / คลิปบอร์ด (ลอยกลางบน) */
function buildSelBar(cur, redraw, save, pasteClip) {
  const selBar = el('div', 'map-selbar' + (view.sel.size > 1 || view.clip.length ? ' on' : ''));
  const selCount = el('span', 'map-selcount', view.sel.size ? tf('ui.maps.pickPin', view.sel.size) : t('ui.maps.cantPickPin'));
  selBar.append(selCount);
  if (view.sel.size) {
    const bCopy = el('button', 'cmp-mini', t('ui.maps.copy'));
    bCopy.title = t('ui.maps.copyPinPickDone');
    bCopy.onclick = () => { view.clip = clonePins(cur.pins, [...view.sel], 0); setStatus(tf('ui.maps.copyPinDoneOpen', view.clip.length)); redraw(); };
    const bDel = el('button', 'cmp-mini k-danger', t('ui.maps.delPick'));
    bDel.title = t('ui.maps.delPickTip');
    bDel.onclick = async () => {
      const n = view.sel.size;
      if (!(await confirmBox(tf('ui.maps.delPinPickItem', n), t('ui.common.del')))) return;
      await removePins(cur, [...view.sel], save, redraw);
    };
    const bNone = el('button', 'cmp-mini', t('ui.maps.cancelPick'));
    bNone.title = t('ui.maps.cancelPickTip');
    bNone.onclick = () => { view.sel.clear(); redraw(); };
    selBar.append(bCopy, bDel, bNone);
  }
  if (view.clip.length) {
    const bPaste = el('button', 'cmp-mini', tf('ui.maps.pastePin', view.clip.length));
    bPaste.title = t('ui.maps.pastePinCopyMap');
    bPaste.onclick = () => pasteClip(null);
    selBar.append(bPaste);
  }
  return selBar;
}

/** แถบสถานะของโหมดพิเศษ — บอกว่ากำลังทำอะไร + ปุ่มเสร็จ/ยกเลิก */
function buildModeBar(cur, redraw, save) {
  if (!view.pick && !view.zoneDraw && !view.measure && !view.addText) return null;
  const rb = el('div', 'map-routebar map-modebar');
  if (view.pick) {
    rb.append(el('span', null, view.pick.hint || ''));
    const c = el('button', 'cmp-mini k-cancel', t('ui.common.cancel'));
    c.onclick = () => { if (view.pick) view.pick.resolve(null); redraw(); };
    rb.append(c);
  } else if (view.zoneDraw) {
    rb.append(el('span', null, tf('ui.maps.zoneDrawing', view.zoneDraw.name || t('ui.common.notNamed'), view.zoneDraw.points.length)));
    const u = el('button', 'cmp-mini', t('ui.maps.dotLatest'));
    u.title = t('ui.maps.dotLatestTip');
    u.onclick = () => { view.zoneDraw.points.pop(); redraw(); };
    const c = el('button', 'cmp-mini k-cancel', t('ui.common.cancel'));
    c.onclick = () => { view.zoneDraw = null; redraw(); };
    const ok = el('button', 'cmp-mini k-ok', t('ui.maps.done'));
    ok.onclick = () => finishZone(cur, save, redraw);
    rb.append(u, c, ok);
  } else if (view.measure) {
    const m = pathMeters(cur, view.measure.points);
    rb.append(el('span', null, tf('ui.maps.measuring', view.measure.points.length,
      m != null ? distText(niceDistance(m)) : t('ui.maps.measureNeedScale'))));
    if (m != null && m > 0) rb.append(el('span', 'dim', travelText(m, true)));
    const c = el('button', 'cmp-mini k-ok k-cancel', t('ui.maps.done'));
    c.onclick = () => { view.measure = null; redraw(); };
    rb.append(c);
  } else if (view.addText) {
    rb.append(el('span', null, t('ui.maps.textClickHint')));
    const c = el('button', 'cmp-mini k-cancel', t('ui.common.cancel'));
    c.onclick = () => { view.addText = false; redraw(); };
    rb.append(c);
  }
  return rb;
}

/** ซ้าย: เครื่องมือเป็นไอคอนแนวตั้ง (tooltip บอกชื่อ + วิธีใช้) */
function buildToolRail(cur, redraw) {
  const tools3 = el('div', 'map-tools3 map-hud map-hud-rail');
  for (const tdef of MAP_TOOLS) {
    const b = hudBtn(tdef.icon, tdef.label + ' — ' + tdef.hint, 'map-tool-btn' + (view.tool === tdef.id ? ' on' : ''));
    b.dataset.tool = tdef.id;
    b.onclick = () => { view.tool = tdef.id; view.routeEdit = null; redraw(); };
    tools3.append(b);
  }
  tools3.append(el('span', 'map-tool-sep', ''));
  const zb = hudBtn(gi('vector-polygon'), t('ui.maps.zone') + ' — ' + t('ui.maps.zoneTip'), 'map-tool-x' + (view.zoneDraw ? ' on' : ''));
  zb.dataset.x = 'zone';
  zb.onclick = () => { if (view.zoneDraw) { view.zoneDraw = null; redraw(); } else startZoneDraw(cur, null); };
  const tb = hudBtn(gi('font'), t('ui.maps.ctxText') + ' — ' + t('ui.maps.textClickHint'), 'map-tool-x' + (view.addText ? ' on' : ''));
  tb.dataset.x = 'text';
  tb.onclick = () => { view.addText = !view.addText; view.zoneDraw = null; view.measure = null; redraw(); };
  const meas = hudBtn(gi('tape-measure'), t('ui.maps.measure') + ' — ' + t('ui.maps.measureTip'), 'map-tool-x' + (view.measure ? ' on' : ''));
  meas.dataset.x = 'measure';
  meas.onclick = () => { view.measure = view.measure ? null : { points: [] }; view.zoneDraw = null; view.addText = false; redraw(); };
  tools3.append(zb, tb, meas);
  tools3.append(el('span', 'map-tool-sep', ''));
  const lbl = hudBtn(gi('tag'), t('ui.maps.showHideLabelUnder'), 'map-ov-btn' + (view.showLabels ? ' on' : ''));
  lbl.dataset.act = 'labels';
  lbl.onclick = () => { view.showLabels = !view.showLabels; redraw(); };
  const rt = hudBtn(gi('route'), t('ui.maps.showHideRouteBetween'), 'map-ov-btn' + (view.showRoutes ? ' on' : ''));
  rt.dataset.act = 'routes';
  rt.onclick = () => { view.showRoutes = !view.showRoutes; redraw(); };
  tools3.append(lbl, rt);
  return tools3;
}

/** ขวาล่าง: ซูม · พอดีจอ · ชั้นแสดงผล (กริด · เข็มทิศ · มาตราส่วน) · ขนาดหมุด */
function buildZoomHud(cur, main, ov, save, redraw) {
  const tools2 = el('div', 'map-tools2 map-hud map-hud-bottom');
  const zOut = hudBtn(gi('minus-thick'), t('ui.maps.zoomOutCtrlWheel'));
  zOut.dataset.act = 'zoom-out';
  const zLabel = el('span', 'map-zoom-label', Math.round(view.zoom * 100) + '%');
  const zIn = hudBtn(gi('plus-thick'), t('ui.maps.zoomInCtrlWheel'));
  zIn.dataset.act = 'zoom-in';
  zOut.onclick = () => main._setZoom(zoomLadder(view.zoom, -1));
  zIn.onclick = () => main._setZoom(zoomLadder(view.zoom, 1));
  const zFit = hudBtn(gi('fit-screen'), t('ui.maps.fitAllTip'));
  zFit.dataset.act = 'fit';
  zFit.onclick = () => main._fitAll();
  tools2.append(zOut, zLabel, zIn, zFit, el('span', 'map-tool-sep', ''));
  const mkOv = (key, icon, label, tip) => {
    const b = hudBtn(icon, label + ' — ' + tip, 'map-ov-btn' + (ov[key] ? ' on' : ''));
    b.dataset.ov = key;
    b.onclick = async () => { toggleOverlay(cur, key); await save(); redraw(); };
    tools2.append(b);
  };
  mkOv('grid', gi('grid'), t('ui.maps.tableGrid'), t('ui.maps.gridTip'));
  if (ov.grid) {
    const gs = el('input', 'map-grid-size'); gs.type = 'number'; gs.min = '2'; gs.max = '50';
    gs.value = String(ov.gridSize); gs.title = t('ui.maps.countFieldGridNext');
    gs.onchange = async () => { cur.overlays = { ...ov, gridSize: Math.max(2, Math.min(50, parseInt(gs.value, 10) || 10)) }; await save(); redraw(); };
    tools2.append(gs);
  }
  mkOv('compass', gi('compass'), t('ui.maps.compass'), t('ui.maps.compassTip'));
  mkOv('scale', gi('ruler-straight'), t('ui.maps.part'), t('ui.maps.scaleTip'));
  if (ov.scale && !geoReady(cur).scale) {
    const sl = el('input', 'map-scale-lbl'); sl.value = ov.scaleLabel;
    sl.placeholder = t('ui.maps.gapBarEg'); sl.title = t('ui.maps.textUnderBarPart');
    sl.onchange = async () => { cur.overlays = { ...ov, scaleLabel: sl.value.trim() }; await save(); redraw(); };
    tools2.append(sl);
  }
  tools2.append(el('span', 'map-tool-sep', ''));
  const curScale = pinScaleOf(cur);
  const setScale = async (v) => { cur.pinScale = Math.max(PIN_SCALE_MIN, Math.min(PIN_SCALE_MAX, +v.toFixed(2))); await save(); redraw(); };
  const psOut = hudBtn(gi('minus-thick'), t('ui.maps.collapsePin'), 'map-ps');
  psOut.dataset.act = 'pin-smaller';
  const psIn = hudBtn(gi('plus-thick'), t('ui.maps.expandPin'), 'map-ps');
  psIn.dataset.act = 'pin-bigger';
  psOut.onclick = () => setScale(curScale - PIN_SCALE_STEP);
  psIn.onclick = () => setScale(curScale + PIN_SCALE_STEP);
  const psL = el('span', 'map-ps-lbl', gi('map-pin'));
  psL.title = t('ui.maps.sizePin') + ' ' + Math.round(curScale * 100) + '%';
  tools2.append(psOut, psL, psIn);
  return tools2;
}

/** แถบมาตราส่วน (ลอยซ้ายล่าง) — ตั้งมาตราส่วนจริงแล้ว = ยาวเท่าระยะจริงที่สวย (1-2-5) และปรับตามซูม */
function buildScaleHud(cur, ov) {
  if (!ov.scale) return null;
  const sc = el('div', 'map-scalebar map-scalehud');
  const barEl = el('div', 'map-scalebar-bar');
  const lbl = el('div', 'map-scalebar-lbl', ov.scaleLabel || t('ui.maps.setGapField'));
  sc.append(barEl, lbl);
  const mpu = metersPerUnit(cur);
  sc._update = (pxPerU) => {
    if (mpu == null || !pxPerU) return;
    const nb = niceScaleBar(mpu, 120 / pxPerU);
    if (!nb) return;
    barEl.style.width = Math.round(nb.units * pxPerU) + 'px';
    lbl.textContent = distText(niceDistance(nb.meters));
  };
  return sc;
}

/** รายการเส้นทาง (อยู่ในแถบซ้าย) */
function buildRoutesPanel(cur) {
  const S = mapsState_C.s;
  const redraw = () => refresh();
  const save = async () => { await saveMaps(S.data); };
  const rsec = el('div', 'map-side-group map-routes-panel');
  const rhead = el('div', 'map-side-cat map-routes-head');
  rhead.append(el('span', null, gi('route') + ' ' + tf('ui.maps.route3', mapRoutes(cur).length)));
  const addR = el('button', 'cmp-mini map-side-add', gi('plus'));
  addR.title = t('ui.maps.routeNewTip');
  addR.setAttribute('aria-label', t('ui.maps.routeNew2'));
  addR.onclick = async () => {
    const name = await ask(t('ui.maps.nameRoute'), { value: t('ui.maps.route') + (mapRoutes(cur).length + 1) });
    if (!name) return;
    const r = newRoute(name, ROUTE_COLORS[mapRoutes(cur).length % ROUTE_COLORS.length]);
    cur.routes = [...mapRoutes(cur), r];
    view.routeEdit = r.id;
    await save(); redraw();
  };
  rhead.append(addR);
  rsec.append(rhead);
  for (const r of mapRoutes(cur)) {
    const row = el('div', 'map-route-row' + (r.id === view.routeEdit ? ' on' : ''));
    const sw = el('span', 'map-route-sw'); sw.style.background = r.color || ROUTE_COLORS[0];
    const pts = routePoints(cur, r);
    const info = el('div', 'map-route-info');
    info.append(el('span', 'map-route-name', r.name));
    const real = pathMeters(cur, pts);
    info.append(el('span', 'map-route-meta', tf('ui.maps.dotGap', pts.length, routeLength(pts))
      + (real != null && pts.length > 1 ? ' · ' + distText(niceDistance(real)) + ' · ' + travelText(real) : '')));
    row.append(sw, info);
    const acts = el('div', 'map-route-acts');
    const bEdit = el('button', 'cmp-mini', r.id === view.routeEdit ? t('ui.maps.done') : t('ui.maps.nextDot'));
    bEdit.title = t('ui.maps.nextDotTip');
    bEdit.onclick = () => { view.routeEdit = view.routeEdit === r.id ? null : r.id; redraw(); };
    const bColor = el('button', 'cmp-mini', gi('palette'));
    bColor.title = t('ui.maps.recolorLine');
    bColor.onclick = async () => { const i = ROUTE_COLORS.indexOf(r.color); r.color = ROUTE_COLORS[(i + 1) % ROUTE_COLORS.length]; await save(); redraw(); };
    const bDash = el('button', 'cmp-mini' + (r.dashed ? ' on' : ''), gi('line-dash'));
    bDash.title = t('ui.maps.lineLineSolid');
    bDash.onclick = async () => { r.dashed = !r.dashed; await save(); redraw(); };
    const bRen = el('button', 'cmp-mini', gi('pencil'));
    bRen.title = t('ui.maps.changeNameRoute');
    bRen.onclick = async () => { const v = await ask(t('ui.maps.nameRoute'), { value: r.name }); if (!v) return; r.name = v.trim(); await save(); redraw(); };
    const bDel = el('button', 'cmp-mini k-danger', gi('trash'));
    bDel.title = t('ui.maps.delRoutePin');
    bDel.onclick = async () => {
      if (!(await confirmBox(tf('ui.maps.delRoutePinNot', r.name), t('ui.common.del')))) return;
      deleteRoute(cur, r.id); if (view.routeEdit === r.id) view.routeEdit = null; await save(); redraw();
    };
    acts.append(bEdit, bColor, bDash, bRen, bDel);
    row.append(acts);
    rsec.append(row);
  }
  if (!mapRoutes(cur).length) rsec.append(el('div', 'dim map-route-empty', t('ui.maps.routeDragLineLink')));
  return rsec;
}

// ═══════════════════════ แถบเครื่องมือลอยของสิ่งที่เลือก (แบบในวิดีโอ) ═══════════════════════
function ctxSep() { return el('span', 'map-ctx-sep'); }
/** ตัวเลือกชั้น (ขึ้น/ลง/บนสุด/ล่างสุด) */
function layerMenu(btn, fn) {
  const r = btn.getBoundingClientRect();
  popupMenu(r.left, r.bottom + 4, [
    { label: t('ui.maps.layerTop'), click: () => fn('top') },
    { label: t('ui.maps.layerUp'), click: () => fn(1) },
    { label: t('ui.maps.layerDown'), click: () => fn(-1) },
    { label: t('ui.maps.layerBottom'), click: () => fn('bottom') },
  ]);
}
/** ช่องเลือกเอนทิตี้ (ลิงก์) — ค่าว่าง = ไม่ลิงก์ */
function entitySelect(ents, cur, onPick) {
  const s = el('select', 'map-ctx-sel');
  const none = el('option', null, t('ui.maps.ctxNoLink')); none.value = ''; s.append(none);
  const byCat = new Map();
  for (const e of ents) { if (!byCat.has(e.cat)) byCat.set(e.cat, []); byCat.get(e.cat).push(e); }
  for (const [cat, arr] of byCat) {
    const g = el('optgroup'); g.label = catLabel(cat);
    for (const e of arr) { const o = el('option', null, e.name); o.value = e.file; if (e.file === cur) o.selected = true; g.append(o); }
    s.append(g);
  }
  s.onchange = () => onPick(s.value, (ents.find((e) => e.file === s.value) || {}).name || '');
  return s;
}
function buildPinCtx(cur, pin, maps, ents, portraits, save, redraw) {
  const bar = el('div', 'map-ctx map-ctx-pin');
  bar.dataset.pin = pin.id;
  const stop = (e) => e.stopPropagation();
  bar.addEventListener('pointerdown', stop); bar.addEventListener('click', stop); bar.addEventListener('dblclick', stop);
  bar.append(el('span', 'map-ctx-kind', (PIN_KIND[pin.kind] || PIN_KIND.note).icon));
  const name = el('input', 'map-ctx-name');
  name.value = pin.label || ''; name.placeholder = pin.kind === 'text' ? t('ui.maps.textAskPh') : t('ui.maps.ctxPinNamePh');
  name.title = t('ui.app.label');
  name.onchange = async () => { pin.label = name.value.trim(); await save(); redraw(); };
  name.onkeydown = (e) => { if (e.key === 'Enter') name.blur(); e.stopPropagation(); };
  bar.append(name, ctxSep());
  const col = el('input', 'map-ctx-color'); col.type = 'color';
  col.value = /^#[0-9a-f]{6}$/i.test(pin.color || '') ? pin.color : PRINT.pinDefault;
  col.title = t('ui.maps.ctxColor');
  col.onchange = async () => { pin.color = col.value; await save(); redraw(); };
  bar.append(col);
  const size = el('select', 'map-ctx-sel map-ctx-size');
  size.title = t('ui.maps.ctxSize');
  for (const k of Object.keys(PIN_SIZES)) { const o = el('option', null, k.toUpperCase()); o.value = k; if ((pin.size || 'm') === k) o.selected = true; size.append(o); }
  size.onchange = async () => { pin.size = size.value === 'm' ? undefined : size.value; if (!pin.size) delete pin.size; await save(); redraw(); };
  bar.append(size);
  if (pin.kind !== 'text') {
    const eye = el('button', 'cmp-mini map-ico' + (pin.hideLabel ? '' : ' on'), gi(pin.hideLabel ? 'eye-off' : 'eye'));
    eye.title = t('ui.maps.ctxLabelToggle');
    eye.onclick = async () => { pin.hideLabel = !pin.hideLabel; if (!pin.hideLabel) delete pin.hideLabel; await save(); redraw(); };
    bar.append(eye, ctxSep());
    // ลิงก์: หมุดประตู = แผนที่ปลายทาง · อื่น ๆ = เอนทิตี้ (เลือกแล้วหมุดโน้ตกลายเป็นหมุดเอนทิตี้)
    if (pin.kind === 'portal') {
      const ms = el('select', 'map-ctx-sel');
      for (const m of maps) { if (m.id === cur.id) continue; const o = el('option', null, m.name); o.value = m.id; if (m.id === pin.toMap) o.selected = true; ms.append(o); }
      ms.title = t('ui.maps.ctxLinkMap');
      ms.onchange = async () => { pin.toMap = ms.value; await save(); redraw(); };
      bar.append(el('span', 'map-ctx-ic', gi('door')), ms);
    } else {
      const es = entitySelect(ents, pin.entityFile, async (file, nm) => {
        pin.entityFile = file;
        pin.kind = file ? 'entity' : 'note';
        if (file && !pin.label) pin.label = nm;
        await save(); redraw();
      });
      es.title = t('ui.maps.ctxLinkEntity');
      bar.append(el('span', 'map-ctx-ic', gi('link')), es);
    }
    const imgB = el('button', 'cmp-mini map-ico', gi('image'));
    imgB.title = pin.image ? t('ui.maps.ctxImageChange') : t('ui.maps.ctxImagePick');
    imgB.onclick = async () => { const it = await pickImage(state.root); if (!it) return; pin.image = 'Images/' + it.file; await save(); redraw(); };
    bar.append(imgB);
    const th = pinThumb(pin, portraits, maps);
    if (th) {
      const zoomB = el('button', 'cmp-mini map-ico', gi('arrow-expand'));
      zoomB.title = t('ui.maps.ctxImageView');
      zoomB.onclick = async () => { const { imageLightbox } = await import('./wiki.js'); imageLightbox(th.url, pin.label || ''); };
      bar.append(zoomB);
    }
    if (pin.image) {
      const rm = el('button', 'cmp-mini map-ico', gi('image-remove'));
      rm.title = t('ui.maps.ctxImageRemove');
      rm.onclick = async () => { delete pin.image; await save(); redraw(); };
      bar.append(rm);
    }
  }
  bar.append(ctxSep());
  const lay = el('button', 'cmp-mini map-ico', gi('layers'));
  lay.title = t('ui.maps.ctxLayers');
  lay.onclick = () => layerMenu(lay, async (d) => { if (movePinLayer(cur, pin.id, d)) { await save(); redraw(); } });
  const more = el('button', 'cmp-mini map-ico', gi('pencil'));
  more.title = t('ui.maps.pinEdit');
  more.onclick = async () => {
    const res = await pinDialog({ ...pin }, maps, cur.id, true);
    if (res === 'DELETE') { await removePins(cur, [pin.id], save, redraw); return; }
    if (res) { Object.assign(pin, res); await save(); redraw(); }
  };
  const del = el('button', 'cmp-mini map-ico k-danger', gi('trash'));
  del.title = t('ui.common.del');
  del.onclick = () => removePins(cur, [pin.id], save, redraw);
  bar.append(lay, more, del);
  const zs = zonesOfPin(cur, pin);
  if (zs.length) bar.append(el('span', 'map-ctx-note', gi('vector-polygon') + ' ' + zs.map((z) => z.name || t('ui.common.notNamed')).join(' › ')));
  return bar;
}
function buildZoneCtx(cur, z, ents, save, redraw, fit) {
  const bar = el('div', 'map-ctx map-ctx-zone');
  bar.dataset.zone = z.id;
  const stop = (e) => e.stopPropagation();
  bar.addEventListener('pointerdown', stop); bar.addEventListener('click', stop); bar.addEventListener('dblclick', stop);
  bar.append(el('span', 'map-ctx-kind', gi('vector-polygon')));
  const name = el('input', 'map-ctx-name');
  name.value = z.name || ''; name.placeholder = t('ui.maps.zoneNamePh'); name.title = t('ui.maps.zoneName');
  name.onchange = async () => { z.name = name.value.trim(); await save(); redraw(); };
  name.onkeydown = (e) => { if (e.key === 'Enter') name.blur(); e.stopPropagation(); };
  bar.append(name, ctxSep());
  const es = entitySelect(ents, z.entityFile, async (file, nm) => { z.entityFile = file; if (file && !z.name) z.name = nm; await save(); redraw(); });
  es.title = t('ui.maps.zoneLinkTip');
  bar.append(el('span', 'map-ctx-ic', gi('link')), es);
  const ctr = el('button', 'cmp-mini map-ico', gi('crosshairs'));
  ctr.title = t('ui.maps.zoneCenter');
  ctr.onclick = () => fit();
  // สไตล์: สีพื้น · ความจาง · ลาย (ผู้ใช้: "สี zone กับความจางเปลี่ยนไม่ได้")
  const sty = el('button', 'cmp-mini map-ico', gi('palette'));
  sty.title = t('ui.maps.zoneStyle');
  sty.onclick = () => {
    const pop = bar.querySelector('.map-ctx-pop');
    if (pop) { pop.remove(); return; }
    const p = el('div', 'map-ctx-pop');
    const r1 = el('label', 'map-ctx-row'); r1.append(el('span', null, t('ui.maps.zoneFill')));
    const c = el('input', 'map-zone-color'); c.type = 'color'; c.value = /^#[0-9a-f]{6}$/i.test(z.color || '') ? z.color : ZONE_COLORS[0];
    c.oninput = () => { z.color = c.value; const path = document.querySelector(`#maps-body .map-zone[data-zone="${z.id}"]`); if (path) { path.style.setProperty('--zc', c.value); if (!z.pattern || z.pattern === 'none') path.style.fill = c.value; } };
    c.onchange = async () => { await save(); redraw(); };
    r1.append(c); p.append(r1);
    const r2 = el('label', 'map-ctx-row'); r2.append(el('span', null, t('ui.maps.zoneOpacity')));
    const o = el('input', 'map-zone-opacity'); o.type = 'range'; o.min = '0'; o.max = '100'; o.value = String(Math.round(zoneOpacity(z) * 100));
    const ol = el('span', 'map-ctx-val', o.value + '%');
    o.oninput = () => { z.opacity = +o.value / 100; ol.textContent = o.value + '%';
      const path = document.querySelector(`#maps-body .map-zone[data-zone="${z.id}"]`);
      if (path) path.style.fillOpacity = String(!z.pattern || z.pattern === 'none' ? z.opacity : Math.min(1, z.opacity * 3)); };
    o.onchange = async () => { await save(); };
    r2.append(o, ol); p.append(r2);
    const r3 = el('label', 'map-ctx-row'); r3.append(el('span', null, t('ui.maps.zonePattern')));
    const ps = el('select', 'map-ctx-sel map-zone-pattern');
    for (const k of ZONE_PATTERNS) { const op = el('option', null, t(PATTERN_KEYS[k])); op.value = k; if ((z.pattern || 'none') === k) op.selected = true; ps.append(op); }
    ps.onchange = async () => { z.pattern = ps.value; await save(); redraw(); };
    r3.append(ps); p.append(r3);
    bar.append(p);
  };
  const lay = el('button', 'cmp-mini map-ico', gi('layers'));
  lay.title = t('ui.maps.ctxLayers');
  lay.onclick = () => layerMenu(lay, async (d) => { if (moveZone(cur, z.id, d)) { await save(); redraw(); } });
  const del = el('button', 'cmp-mini map-ico k-danger', gi('trash'));
  del.title = t('ui.maps.zoneDelete');
  del.onclick = async () => {
    if (!(await confirmBox(tf('ui.maps.zoneDeleteQ', z.name || ''), t('ui.common.del')))) return;
    deleteZone(cur, z.id); view.selZone = null; await save(); redraw();
  };
  bar.append(ctr, sty, lay, del);
  const inside = pinsInZone(cur, z);
  const area = niceArea(zoneAreaM2(cur, z));
  const note = el('span', 'map-ctx-note', gi('map-pin') + ' ' + tf('ui.maps.zonePinsIn', inside.length) + (area ? ' · ' + areaText(area) : ''));
  note.title = inside.map((p) => p.label || (PIN_KIND[p.kind] || {}).label || '').filter(Boolean).join('\n');
  bar.append(note);
  return bar;
}

// ═══════════════════════ หยิบใส่แผนที่ ═══════════════════════
async function placeEntity(cur, e, x, y) {
  const S = mapsState_C.s;
  const ex = (cur.pins || []).find((p) => p.kind === 'entity' && p.entityFile === e.file);
  if (ex) { ex.x = clampW(x); ex.y = clampW(y); setStatus(tf('ui.maps.entMoved', e.name)); }
  else { cur.pins.push(entityPin(x, y, e.file, e.name)); setStatus(tf('ui.maps.entPlacedStatus', e.name)); }
  await saveMaps(S.data);
  refresh();
}
/** ของที่ถูกวางลงแผนที่ → ทำอะไร (ส่งออกให้เทสเรียกตรงได้) */
export async function dropOnMap(cur, payload, pt, pinId) {
  const S = mapsState_C.s;
  if (!cur || !payload || !payload.items.length) return false;
  const it = payload.items[0];
  if (payload.kind === 'entity') {
    await placeEntity(cur, { file: it.path, name: it.title }, pt.x, pt.y);
    return true;
  }
  if (payload.kind === 'map') {
    if (it.id === cur.id) { setStatus(t('ui.maps.dropSelfMap')); return false; }
    const child = findMap(S.data.maps, it.id);
    if (!child) return false;
    const ex = (cur.pins || []).find((p) => p.kind === 'portal' && p.toMap === it.id);
    if (ex) { ex.x = pt.x; ex.y = pt.y; }
    else cur.pins.push(portalPin(pt.x, pt.y, it.id, child.name));
    await saveMaps(S.data);
    setStatus(tf('ui.maps.dropPortalDone', child.name));
    refresh();
    return true;
  }
  if (payload.kind === 'scene' && it.draftDir && it.id) {
    // ผูกตำแหน่งฉาก: วางบนหมุด = ผูกกับหมุดนั้น · ที่ว่าง = พิกัดลอย (เหมือนผังพื้นที่)
    await updateSceneRow(it.draftDir, it.id, (r) => {
      r.mapId = cur.id;
      if (pinId) { r.pinId = pinId; delete r.pinX; delete r.pinY; }
      else { delete r.pinId; r.pinX = +pt.x.toFixed(1); r.pinY = +pt.y.toFixed(1); }
    });
    scenesCache = null;
    setStatus(tf('ui.maps.dropSceneDone', it.title || '', cur.name || ''));
    refresh();
    return true;
  }
  if (payload.kind === 'memo' || payload.kind === 'scene') {
    const p = newPin(pt.x, pt.y, 'note');
    p.label = it.title || '';
    cur.pins.push(p);
    await saveMaps(S.data);
    refresh();
    return true;
  }
  if (payload.kind === 'gallery' || payload.kind === 'image') {
    const rel = await droppedImageRel(payload);
    if (!rel) { setStatus(t('ui.maps.dropImageFromGallery')); return false; }
    if (cur.image && !(await confirmBox(t('ui.maps.dropReplaceImage'), t('ui.maps.changeImage')))) return false;
    cur.image = rel; delete cur.aspect;
    await saveMaps(S.data);
    refresh();
    return true;
  }
  return false;
}

// ═══════════════════════ โซน ═══════════════════════
function startZoneDraw(cur, ent) {
  const used = mapZones(cur).length;
  view.zoneDraw = { points: [], entityFile: (ent && ent.file) || '', name: (ent && ent.name) || '',
                    color: ZONE_COLORS[used % ZONE_COLORS.length] };
  view.measure = null; view.addText = false; view.selZone = null; view.sel.clear();
  setStatus(t('ui.maps.zoneDrawHint'));
  if (view.gallery) enterMap(cur.id); else refresh();
}
/** ปิดโซน → เลือกโซนใหม่ทันที (ตั้งชื่อ/สี/ลิงก์บนแถบลอยได้เลย ไม่มีกล่องถามคั่น — แบบในวิดีโอ) */
async function finishZone(cur, save, redraw) {
  const d = view.zoneDraw;
  if (!d) return;
  if (d.points.length < 3) { setStatus(t('ui.maps.zoneNeed3')); return; }
  const z = newZone(d.points, { name: String(d.name || '').trim(), entityFile: d.entityFile, color: d.color });
  cur.zones = [...(cur.zones || []), z];
  view.zoneDraw = null; view.selZone = z.id;
  await save();
  const area = niceArea(zoneAreaM2(cur, z));
  setStatus(tf('ui.maps.zoneDone', z.name || '') + (area ? ' · ' + areaText(area) : ''));
  await redraw();
  if (!z.name) setTimeout(() => { const n = document.querySelector('#maps-body .map-ctx-zone .map-ctx-name'); if (n) n.focus(); }, 30);
}
function zoneMenu(cur, z, x, y) {
  const S = mapsState_C.s;
  const saveR = async () => { await saveMaps(S.data); refresh(); };
  popupMenu(x, y, [
    { text: z.name || t('ui.common.notNamed'), disabled: true },
    { label: t('ui.maps.zoneSelect'), click: () => { view.selZone = z.id; view.sel.clear(); refresh(); } },
    z.entityFile ? { label: t('ui.maps.entOpenWiki'), click: () => openEntity(z.entityFile) } : null,
    { label: t('ui.maps.zoneRename'), click: async () => {
      const v = await ask(t('ui.maps.zoneName'), { value: z.name || '' }); if (v == null) return;
      z.name = String(v).trim(); await saveR(); } },
    { label: t('ui.maps.zoneRecolor'), click: async () => {
      const i = ZONE_COLORS.indexOf(z.color); z.color = ZONE_COLORS[(i + 1) % ZONE_COLORS.length]; await saveR(); } },
    { label: t('ui.maps.layerTop'), click: async () => { moveZone(cur, z.id, 'top'); await saveR(); } },
    { label: t('ui.maps.layerBottom'), click: async () => { moveZone(cur, z.id, 'bottom'); await saveR(); } },
    '-',
    { label: t('ui.maps.zoneDelete'), danger: true, click: async () => {
      if (!(await confirmBox(tf('ui.maps.zoneDeleteQ', z.name || ''), t('ui.common.del')))) return;
      deleteZone(cur, z.id); if (view.selZone === z.id) view.selZone = null; await saveR(); } },
  ].filter(Boolean));
}
function redrawZoneShape(canvas, z) {
  const path = canvas.querySelector(`.map-zone[data-zone="${z.id}"]`);
  if (path) path.setAttribute('d', zonePath(z.points));
  const lb = canvas.querySelector(`.map-zone-label[data-zone="${z.id}"]`);
  if (lb) { const c = polygonCentroid(z.points); lb.style.left = c.x + '%'; lb.style.top = c.y + '%'; }
}
function zoneVertex(cur, z, i, canvas, save, redraw) {
  const v = el('div', 'map-zone-vtx');
  v.style.left = z.points[i].x + '%'; v.style.top = z.points[i].y + '%';
  v.title = t('ui.maps.zoneVertexTip');
  v.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const p0 = { ...z.points[i] };
    let moved = false;
    const put = (pt) => {
      z.points[i] = pt;
      v.style.left = pt.x + '%'; v.style.top = pt.y + '%';
      redrawZoneShape(canvas, z);
      canvas.querySelectorAll('.map-zone-mid').forEach((n) => { n.style.display = 'none'; });
    };
    const mv = (ev) => {
      moved = true;
      const r = canvas.getBoundingClientRect();
      put({ x: clampW(((ev.clientX - r.left) / r.width) * 100), y: clampW(((ev.clientY - r.top) / r.height) * 100) });
    };
    const offEsc = escCancelDrag(() => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      put(p0); redraw();
    });
    const up = async () => {
      offEsc();
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (moved) { await save(); redraw(); }       // คลิกเฉย ๆ ไม่ต้องเขียนไฟล์/วาดใหม่
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  v.onclick = (e) => e.stopPropagation();
  v.oncontextmenu = async (e) => {           // คลิกขวาจุดยอด = ลบจุดนั้น (เหลืออย่างน้อย 3)
    e.preventDefault(); e.stopPropagation();
    if (z.points.length <= 3) { setStatus(t('ui.maps.zoneNeed3')); return; }
    z.points.splice(i, 1); await save(); redraw();
  };
  return v;
}
/** จุดกลางขอบของโซนที่เลือก — ลาก/คลิก = แทรกจุดยอดใหม่ตรงนั้น */
function zoneMidHandle(cur, z, i, save, redraw) {
  const a = z.points[i], b = z.points[(i + 1) % z.points.length];
  const m = el('div', 'map-zone-mid');
  m.style.left = ((a.x + b.x) / 2) + '%'; m.style.top = ((a.y + b.y) / 2) + '%';
  m.title = t('ui.maps.zoneMidTip');
  m.onpointerdown = async (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    z.points.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    await save(); await redraw();
  };
  m.onclick = (e) => e.stopPropagation();
  return m;
}

// ═══════════════════════ พิกัดจริง / มาตราส่วน ═══════════════════════
/**
 * [alpha.168] การ์ดแก้รูปพื้นหลัง — ผู้ใช้: "อยากให้แก้ไขรูปได้ ทั้ง ขนาด ratio ความทึบ จาง หมุน pitch yaw Hflip Vflip skew"
 * ปรับแล้วเห็นผลทันที (ทาสไตล์ลง <img> ตรง ๆ ไม่วาดทั้งแผนที่ใหม่) · ปล่อยตัวเลื่อน = บันทึก · ดับเบิลคลิกตัวเลื่อน = คืนค่าช่องนั้น
 * ตารางช่อง = แหล่งเดียว (ช่วงของช่องตัวเลขมาจาก BG_LIMITS ของ map-bg.js)
 */
const BG_FIELDS = [
  { k: 'opacity', key: 'ui.maps.bgOpacity', unit: '%', mul: 100, slider: [0, 100], step: 1 },
  { k: 'scale', key: 'ui.maps.bgScale', unit: '%', mul: 100, slider: [5, 400], step: 1 },
  { k: 'ratio', key: 'ui.maps.bgRatio', unit: '%', mul: 100, slider: [20, 300], step: 1 },
  { k: 'rotate', key: 'ui.maps.bgRotate', unit: '°', mul: 1, slider: [-180, 180], step: 1 },
  { k: 'pitch', key: 'ui.maps.bgPitch', unit: '°', mul: 1, slider: [-75, 75], step: 1 },
  { k: 'yaw', key: 'ui.maps.bgYaw', unit: '°', mul: 1, slider: [-75, 75], step: 1 },
  { k: 'skewX', key: 'ui.maps.bgSkewX', unit: '°', mul: 1, slider: [-60, 60], step: 1 },
  { k: 'skewY', key: 'ui.maps.bgSkewY', unit: '°', mul: 1, slider: [-60, 60], step: 1 },
  { k: 'x', key: 'ui.maps.bgPosX', unit: '%', mul: 1, slider: [-100, 200], step: 0.5 },
  { k: 'y', key: 'ui.maps.bgPosY', unit: '%', mul: 1, slider: [-100, 200], step: 0.5 },
];
export function openBgPanel(cur) {
  view.bgOpen = !view.bgOpen;
  if (!view.bgOpen) view.bgDrag = false;
  view.geoOpen = false;                     // การ์ดลอยทีละใบ (ตำแหน่งเดียวกัน)
  refresh();
}
/** ค่าในการ์ดตามค่าปัจจุบัน (หลังลากย้ายรูปบนผืน) */
function syncBgPanel(cur) {
  const pop = document.querySelector('#maps-body .map-bg-pop');
  if (pop && pop._sync) pop._sync(normalizeBg(cur.bg));
}
function buildBgPanel(cur) {
  const S = mapsState_C.s;
  const pop = el('div', 'map-geo-pop map-bg-pop');
  pop.setAttribute('role', 'dialog');
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
  pop.addEventListener('wheel', (e) => e.stopPropagation());
  const imgEl = () => (pop.closest('.map-frame') || document).querySelector('.map-canvas .map-img');
  let saveJob = 0;
  const saveSoon = (now) => {
    clearTimeout(saveJob);
    if (now) return saveMaps(S.data);
    saveJob = setTimeout(() => saveMaps(S.data).catch(() => {}), 450);
    return null;
  };
  const put = (b, now) => {
    const c = compactBg(b);
    if (c) cur.bg = c; else delete cur.bg;
    applyMapBgStyle(imgEl(), cur);
    return saveSoon(now);
  };
  const head = el('div', 'map-geo-head');
  head.append(el('b', null, gi('image-edit') + ' ' + t('ui.maps.bgTitle')));
  const x = el('button', 'cmp-mini k-cancel', gi('close'));
  x.title = t('ui.common.close');
  const close = async () => { view.bgOpen = false; view.bgDrag = false; await saveSoon(true); refresh(); };
  x.onclick = close;
  head.append(x);
  pop.append(head, el('div', 'map-geo-intro', t('ui.maps.bgIntro')));

  // ── สวิตช์: พลิก · ลากย้าย ──
  const tog = el('div', 'map-bg-toggles');
  const mkTog = (icon, key, on, fn, tipKey) => {
    const b = el('button', 'cmp-mini map-bg-tog' + (on ? ' on' : ''), gi(icon) + ' ' + t(key));
    b.title = t(tipKey || key); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.onclick = () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); fn(v); };
    tog.append(b);
    return b;
  };
  const fH = mkTog('flip-h', 'ui.maps.bgFlipH', normalizeBg(cur.bg).flipH, (v) => put({ ...normalizeBg(cur.bg), flipH: v }, true));
  fH.dataset.bg = 'flipH';
  const fV = mkTog('flip-v', 'ui.maps.bgFlipV', normalizeBg(cur.bg).flipV, (v) => put({ ...normalizeBg(cur.bg), flipV: v }, true));
  fV.dataset.bg = 'flipV';
  const dragB = mkTog('cursor-move', 'ui.maps.bgDrag', view.bgDrag, (v) => {
    view.bgDrag = v;
    const cv = (pop.closest('.map-frame') || document).querySelector('.map-canvas');
    if (cv) cv.classList.toggle('map-bg-dragmode', v);
  }, 'ui.maps.bgDragTip');
  dragB.dataset.bg = 'drag';
  pop.append(tog);

  // ── ตัวเลื่อน + ช่องตัวเลข ──
  const grid = el('div', 'map-bg-grid');
  const rows = [];
  for (const f of BG_FIELDS) {
    const lab = el('label', 'map-bg-lab', t(f.key));
    const rg = el('input', 'map-bg-range'); rg.type = 'range';
    rg.min = String(f.slider[0]); rg.max = String(f.slider[1]); rg.step = String(f.step);
    rg.title = t('ui.maps.bgResetOne');
    const nb = el('input', 'map-bg-num'); nb.type = 'number'; nb.step = String(f.step);
    const lim = BG_LIMITS[f.k];
    if (lim) { nb.min = String(lim[0] * f.mul); nb.max = String(lim[1] * f.mul); }
    nb.setAttribute('aria-label', t(f.key));
    rg.setAttribute('aria-label', t(f.key));
    rg.dataset.bg = f.k; nb.dataset.bg = f.k;
    const unit = el('span', 'map-bg-unit', f.unit);
    const setFrom = (raw, now) => {
      const v = Number(raw);
      if (!Number.isFinite(v)) return null;
      const b = { ...normalizeBg(cur.bg), [f.k]: v / f.mul };
      const nb2 = normalizeBg(b);
      show(nb2);
      return put(nb2, now);
    };
    const show = (b) => {
      const v = +(b[f.k] * f.mul).toFixed(f.step < 1 ? 1 : 0);
      if (document.activeElement !== nb) nb.value = String(v);
      rg.value = String(Math.min(f.slider[1], Math.max(f.slider[0], v)));
    };
    rg.oninput = () => setFrom(rg.value, false);
    rg.onchange = () => setFrom(rg.value, true);
    rg.ondblclick = () => setFrom(BG_DEFAULTS[f.k] * f.mul, true);
    nb.onchange = () => setFrom(nb.value, true);
    nb.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') nb.blur(); };
    grid.append(lab, rg, nb, unit);
    rows.push(show);
  }
  pop.append(grid);
  pop._sync = (b) => { for (const r of rows) r(b); fH.classList.toggle('on', b.flipH); fV.classList.toggle('on', b.flipV); };
  pop._sync(normalizeBg(cur.bg));

  const foot = el('div', 'map-geo-foot');
  const rst = el('button', 'cmp-mini', t('ui.maps.bgReset'));
  rst.onclick = async () => { await put({ ...BG_DEFAULTS }, true); pop._sync(normalizeBg(cur.bg)); };
  const done = el('button', 'k-ok', t('ui.maps.done'));
  done.onclick = close;
  foot.append(rst, done);
  pop.append(foot);
  return pop;
}
/**
 * หน้าตั้งค่าพิกัด: 1) มาตราส่วน 2) จุดอ้างอิงละติจูด/ลองจิจูด 3) ทิศเหนือ
 * [alpha.168] ผู้ใช้: "ตั้งค่าพิกัด มันไปอยู่นอก panel ได้ไง" — เดิมแปะที่ document.body ตำแหน่งตายตัวบนจอ
 *   (แผงอยู่ซ้าย กล่องไปโผล่ขวาสุดของหน้าต่าง · ฉีกแผงออกไปแล้วกล่องยังอยู่หน้าต่างหลัก)
 *   → เป็นการ์ดลอยใน "กรอบแผนที่" ของแผงเอง · วาดใหม่พร้อมแผนที่ (view.geoOpen)
 */
export function openGeoPanel(cur) {
  view.geoOpen = true;
  const frame = $('#maps-body .map-frame');
  document.querySelectorAll('.map-geo-pop').forEach((n) => n.remove());
  const pop = buildGeoPanel(cur);
  if (frame) {
    frame.append(pop);
    const cv = frame.querySelector('.map-canvas');
    if (cv) drawGeoMarks(cv, geoOf(cur));
  } else refresh();
  return pop;
}
function buildGeoPanel(cur) {
  const S = mapsState_C.s;
  const pop = el('div', 'map-geo-pop');
  pop.setAttribute('role', 'dialog');
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
  const save = async () => { await saveMaps(S.data); refresh(); };
  const close = () => { view.geoOpen = false; pop.remove(); refresh(); };
  const g = geoOf(cur);
  const head = el('div', 'map-geo-head');
  head.append(el('b', null, gi('earth') + ' ' + t('ui.maps.geoTitle')));
  const x = el('button', 'cmp-mini k-cancel', gi('close'));
  x.title = t('ui.common.close');
  x.onclick = close;
  head.append(x);
  pop.append(head);
  pop.append(el('div', 'map-geo-intro', t('ui.maps.geoIntro')));
  // ── ขั้น 1: มาตราส่วน ──
  const s1 = el('div', 'map-geo-step' + (g.scale ? ' done' : ''));
  s1.append(el('div', 'map-geo-st', '1 · ' + t('ui.maps.geoStepScale')));
  s1.append(el('div', 'map-geo-desc', g.scale ? tf('ui.maps.geoScaleNow', distText(niceDistance(g.scale.meters))) : t('ui.maps.geoScaleDesc')));
  const b1 = el('button', 'cmp-mini k-ok', gi('ruler-straight') + ' ' + (g.scale ? t('ui.maps.geoRedo') : t('ui.maps.geoPickScale')));
  b1.title = t('ui.maps.geoPickScaleTip');
  b1.onclick = async () => {
    const a = await pickPoint('scaleA', t('ui.maps.geoPickA'));
    if (!a) return refresh();
    const b = await pickPoint('scaleB', t('ui.maps.geoPickB'));
    if (!b) return refresh();
    const v = await ask(t('ui.maps.geoAskMeters'), { value: g.scale ? String(g.scale.meters) : '100', placeholder: t('ui.maps.geoAskMetersPh') });
    const meters = parseDistance(v);
    if (!(meters > 0)) { setStatus(t('ui.maps.geoBadNumber')); return refresh(); }
    cur.geo = { ...(cur.geo || {}), scale: { a, b, meters } };
    await save();
    setStatus(t('ui.maps.geoScaleSaved'));
  };
  s1.append(b1);
  pop.append(s1);
  // ── ขั้น 2: จุดอ้างอิง ──
  const s2 = el('div', 'map-geo-step' + (g.ref ? ' done' : '') + (g.scale ? '' : ' wait'));
  s2.append(el('div', 'map-geo-st', '2 · ' + t('ui.maps.geoStepRef')));
  s2.append(el('div', 'map-geo-desc', g.ref ? formatLatLon(g.ref) : t('ui.maps.geoRefDesc')));
  const b2 = el('button', 'cmp-mini k-ok', gi('crosshairs') + ' ' + (g.ref ? t('ui.maps.geoRedo') : t('ui.maps.geoPickRef')));
  b2.title = t('ui.maps.geoPickRefTip');
  b2.disabled = !g.scale;
  b2.onclick = async () => {
    const p = await pickPoint('ref', t('ui.maps.geoPickRefHint'));
    if (!p) return refresh();
    const v = await ask(t('ui.maps.geoAskLatLon'), { value: g.ref ? g.ref.lat + ', ' + g.ref.lon : '', placeholder: t('ui.maps.geoAskLatLonPh') });
    const ll = parseLatLon(v);
    if (!ll) { setStatus(t('ui.maps.geoBadLatLon')); return refresh(); }
    cur.geo = { ...(cur.geo || {}), ref: { x: p.x, y: p.y, lat: ll.lat, lon: ll.lon } };
    await save();
    setStatus(t('ui.maps.geoRefSaved'));
  };
  s2.append(b2);
  pop.append(s2);
  // ── ขั้น 3: ทิศเหนือ ──
  const s3 = el('div', 'map-geo-step');
  s3.append(el('div', 'map-geo-st', '3 · ' + t('ui.maps.geoStepNorth')));
  const nIn = el('input', 'map-geo-north'); nIn.type = 'number'; nIn.min = '-180'; nIn.max = '180'; nIn.step = '1';
  nIn.value = String(g.north || 0); nIn.title = t('ui.maps.geoNorthTip');
  nIn.onchange = async () => { cur.geo = { ...(cur.geo || {}), north: Math.max(-180, Math.min(180, +nIn.value || 0)) }; await save(); };
  s3.append(el('div', 'map-geo-desc', t('ui.maps.geoNorthDesc')), nIn);
  pop.append(s3);
  // ── ปักหมุดตามพิกัด ──
  if (g.scale && g.ref) {
    const s4 = el('div', 'map-geo-step');
    s4.append(el('div', 'map-geo-st', gi('map-pin') + ' ' + t('ui.maps.geoPinByCoord')));
    const b4 = el('button', 'cmp-mini', t('ui.maps.geoPinByCoordBtn'));
    b4.title = t('ui.maps.geoPinByCoordTip');
    b4.onclick = async () => {
      const v = await ask(t('ui.maps.geoAskLatLon'), { value: '', placeholder: t('ui.maps.geoAskLatLonPh') });
      const ll = parseLatLon(v);
      if (!ll) { setStatus(t('ui.maps.geoBadLatLon')); return; }
      const p = fromLatLon(cur, ll.lat, ll.lon);
      // [alpha.168] แผนที่ไม่มีขอบแล้ว — พิกัดนอกรูปปักได้ (เดิมปฏิเสธ) · เกินเพดานโลกเท่านั้นที่ไม่รับ
      if (!p || p.x < WORLD_MIN || p.x > WORLD_MAX || p.y < WORLD_MIN || p.y > WORLD_MAX) { setStatus(t('ui.maps.geoOutside')); return; }
      const pin = newPin(p.x, p.y);
      const res = await pinDialog(pin, S.data.maps, cur.id);
      if (!res) return;
      cur.pins.push(res);
      view.focusPin = { id: res.id, x: res.x, y: res.y };
      await save();
    };
    s4.append(b4);
    pop.append(s4);
  }
  const foot = el('div', 'map-geo-foot');
  if (g.scale || g.ref) {
    const clr = el('button', 'cmp-mini k-danger', t('ui.maps.geoClear'));
    clr.title = t('ui.maps.geoClearTip');
    clr.onclick = async () => {
      if (!(await confirmBox(t('ui.maps.geoClearQ'), t('ui.common.clear')))) return;
      delete cur.geo; await save();
    };
    foot.append(clr);
  }
  const done = el('button', 'k-ok', t('ui.maps.done'));
  done.onclick = close;
  foot.append(done);
  pop.append(foot);
  return pop;
}

/** "100" · "1.5 km" · "300 ม." → เมตร */
export function parseDistance(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase().replace(/,/g, '');
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*([a-zก-๙.]*)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].replace(/\./g, '');
  if (/^(km|กม|กิโลเมตร|กิโล)$/.test(u)) return n * 1000;
  if (/^(mi|mile|miles|ไมล์)$/.test(u)) return n * 1609.344;
  if (/^(ft|feet|ฟุต)$/.test(u)) return n * 0.3048;
  return n;
}
/** "13.7563, 100.5018" · "13.7563 100.5018" → {lat, lon} */
export function parseLatLon(v) {
  const m = String(v == null ? '' : v).trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

// ═══════════════════════ ข้อความหน่วย ═══════════════════════
// [alpha.167 · รอบต่อ] distText/areaText/hoursText/travelText ย้ายไป map-text.js (ใช้ร่วมกับฝั่ง AI)
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** ไฮไลต์หมุดที่ตรงคำค้น + หรี่ตัวที่ไม่ตรง (ข้อ 7) — ทำกับ DOM ตรง ๆ ไม่ต้องวาดใหม่ทั้งแผง */
function applyPinFilter(wrap) {
  const S = mapsState_C.s;
  const cur = S && findMap(S.data.maps, S.currentId);
  if (!cur) return;
  const q = String(view.q || '').trim();
  let hit = 0;
  for (const node of wrap.querySelectorAll('.map-pin')) {
    const pin = (cur.pins || []).find((p) => p.id === node.dataset.pin);
    const ok = !pin || matchPin(pin, q);
    node.classList.toggle('map-pin-dim', !!q && !ok);
    node.classList.toggle('map-pin-hit', !!q && ok);
    if (q && ok) hit++;
  }
  let note = wrap.querySelector('.map-search-note');
  if (!note) { note = el('div', 'map-search-note'); wrap.querySelector('.map-hint')?.after(note); }
  note.textContent = q ? tf('ui.maps.foundPinTopMap', q, hit) : '';
  note.style.display = q ? '' : 'none';
}

// ═══════════ ส่งออก PNG / พิมพ์ ═══════════

function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im.naturalWidth ? im : null);
    im.onerror = () => res(null);
    im.src = src;
  });
}
/** ลายของพื้นโซน (แผ่นเล็กปูซ้ำ) */
function zonePatternFill(ctx, pat, color, cellPx) {
  if (!pat || pat === 'none') return color;
  const n = Math.max(6, Math.round(cellPx));
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = Math.max(1, n / 8);
  if (pat === 'hatch' || pat === 'cross') { g.beginPath(); g.moveTo(-1, n + 1); g.lineTo(n + 1, -1); g.stroke(); }
  if (pat === 'cross') { g.beginPath(); g.moveTo(-1, -1); g.lineTo(n + 1, n + 1); g.stroke(); }
  if (pat === 'dots') { g.beginPath(); g.arc(n / 2, n / 2, n / 7, 0, Math.PI * 2); g.fill(); }
  return ctx.createPattern(c, 'repeat') || color;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * วาดแผนที่ทั้งผืนลง <canvas> (ใช้ทั้งส่งออกและพิมพ์)
 * [alpha.168] ครอบ "ทุกอย่าง" (กรอบรูป + หมุด/โซนที่อยู่นอกรูป) · หมุดเป็นรูปย่อ + ป้ายชื่อแบบบนจอ ·
 *   โซนตามสี/ความจาง/ลายของตัวเอง · กริดจัตุรัส · ตัวหนังสือบนแผนที่
 */
/**
 * [alpha.168] วาดรูปพื้นหลังตามค่าที่ปรับ (มุมทั้งสี่จาก bgQuad — ชุดเดียวกับจอ)
 * ไม่มีมุมมองระยะ = affine ครั้งเดียว · มี pitch/yaw = ตาข่ายสามเหลี่ยม (วาดลงผืนแยกก่อน แล้วค่อยลงความทึบทีเดียว
 * ไม่งั้นรอยต่อของสามเหลี่ยมที่ซ้อนกันเล็กน้อยจะทึบกว่าส่วนอื่น)
 */
function drawBgImage(ctx, img, bgRaw, aspect, PX, PY, W, H) {
  const bg = normalizeBg(bgRaw);
  const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
  const toPx = (p) => ({ x: PX(p.x), y: PY(p.y) });
  const layer = document.createElement('canvas');
  layer.width = W; layer.height = H;
  const g = layer.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (!bgIsProjective(bg)) {
    const [q0, q1, , q3] = bgQuad(bg, aspect, aspect).map(toPx);
    g.setTransform((q1.x - q0.x) / iw, (q1.y - q0.y) / iw, (q3.x - q0.x) / ih, (q3.y - q0.y) / ih, q0.x, q0.y);
    g.drawImage(img, 0, 0);
  } else {
    for (const tri of bgMeshCells(bg, aspect, aspect, 24)) {
      const [p0, p1, p2] = tri.map((p) => ({ ...toPx(p), u: p.u * iw, v: p.v * ih }));
      const du1 = p1.u - p0.u, dv1 = p1.v - p0.v, du2 = p2.u - p0.u, dv2 = p2.v - p0.v;
      const det = du1 * dv2 - du2 * dv1;
      if (!det) continue;
      const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y, dx2 = p2.x - p0.x, dy2 = p2.y - p0.y;
      const a = (dx1 * dv2 - dx2 * dv1) / det, c = (dx2 * du1 - dx1 * du2) / det;
      const b = (dy1 * dv2 - dy2 * dv1) / det, d = (dy2 * du1 - dy1 * du2) / det;
      const e = p0.x - a * p0.u - c * p0.v, f = p0.y - b * p0.u - d * p0.v;
      // ขยายเส้นตัดออกเล็กน้อย กันเส้นรอยต่อบาง ๆ ระหว่างสามเหลี่ยม
      const cx = (p0.x + p1.x + p2.x) / 3, cy = (p0.y + p1.y + p2.y) / 3;
      const grow = (p) => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return [p.x + (dx / l) * 1.6, p.y + (dy / l) * 1.6]; };
      g.save();
      g.beginPath();
      const [a0, a1, a2] = [grow(p0), grow(p1), grow(p2)];
      g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.closePath();
      g.clip();
      g.setTransform(a, b, c, d, e, f);
      g.drawImage(img, 0, 0);
      g.restore();
    }
  }
  ctx.save();
  ctx.globalAlpha = bg.opacity;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}
async function drawMapToCanvas(map) {
  const img = map.image ? await loadImg(mapImgURL(map.image)) : null;
  const aspect = img ? img.naturalWidth / img.naturalHeight : frameAspect(map);
  const b = mapBounds(map, { frame: !!img || !(map.pins || []).length });
  const padX = (b.x1 - b.x0) * 0.04 + 2, padY = (b.y1 - b.y0) * 0.04 + 2 * aspect;
  const x0 = b.x0 - padX, x1 = b.x1 + padX, y0 = b.y0 - padY, y1 = b.y1 + padY;
  let ppx = (img ? Math.max(1400, img.naturalWidth) : 1600) / 100;    // พิกเซลต่อ 1% ของความกว้างกรอบ
  let W = (x1 - x0) * ppx, H = ((y1 - y0) * ppx) / aspect;
  const k = Math.min(1, 4096 / Math.max(W, H));
  ppx *= k; W = Math.max(1, Math.round(W * k)); H = Math.max(1, Math.round(H * k));
  const ppy = ppx / aspect;
  const PX = (x) => (x - x0) * ppx, PY = (y) => (y - y0) * ppy;
  const scale = Math.max(1, Math.min(W, H) / 900);                     // ขนาดหมุด/ตัวหนังสือตามขนาดไฟล์
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = PRINT.paper; ctx.fillRect(0, 0, W, H);
  if (img) drawBgImage(ctx, img, map.bg, aspect, PX, PY, W, H);

  // โซนชั้นล่างสุด (ลำดับในอาร์เรย์ = ลำดับชั้น)
  for (const z of mapZones(map)) {
    const col = z.color || ZONE_COLORS[0];
    ctx.save();
    ctx.beginPath();
    z.points.forEach((p, i) => (i ? ctx.lineTo(PX(p.x), PY(p.y)) : ctx.moveTo(PX(p.x), PY(p.y))));
    ctx.closePath();
    const pat = ZONE_PATTERNS.includes(z.pattern) ? z.pattern : 'none';
    ctx.globalAlpha = pat === 'none' ? zoneOpacity(z) : Math.min(1, zoneOpacity(z) * 3);
    ctx.fillStyle = zonePatternFill(ctx, pat, col, 10 * scale); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 2 * scale; ctx.strokeStyle = col; ctx.stroke();
    ctx.restore();
    if (z.name) {
      const c = polygonCentroid(z.points);
      ctx.save(); ctx.font = `bold ${Math.round(15 * scale)}px "Sarabun", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4 * scale; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(z.name, PX(c.x), PY(c.y));
      ctx.fillStyle = PRINT.labelOnDark; ctx.fillText(z.name, PX(c.x), PY(c.y));
      ctx.restore();
    }
  }

  const ov = mapOverlays(map);
  if (ov.grid) {
    // ช่องจัตุรัส ปูทั้งไฟล์ (ไม่ใช่แค่ในรูป) · เส้นตรงกับบนจอ (จุดเริ่ม = มุมกรอบ)
    const cell = gridCell(ov.gridSize, aspect).x * ppx;
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(1, scale * 0.8);
    const sx = PX(0) - Math.ceil(PX(0) / cell) * cell, sy = PY(0) - Math.ceil(PY(0) / cell) * cell;
    for (let x = sx; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = sy; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }

  for (const r of mapRoutes(map)) {
    const pts = routePoints(map, r);
    if (pts.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = r.color || ROUTE_COLORS[0];
    ctx.lineWidth = 4 * scale; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (r.dashed) ctx.setLineDash([12 * scale, 9 * scale]);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(PX(p.x), PY(p.y)) : ctx.moveTo(PX(p.x), PY(p.y))));
    ctx.stroke(); ctx.restore();
  }

  // หมุด: รูปย่อกรอบมน (หรือไอคอน) + ป้ายชื่อพื้นเข้มใต้หมุด — เหมือนบนจอ
  const portraits = await loadPortraits();
  const names = new Map((await loadEntities()).map((e) => [e.file, e.name]));
  const maps = (mapsState_C.s && mapsState_C.s.data && mapsState_C.s.data.maps) || [map];
  const ps = pinScaleOf(map);
  const thumbs = new Map();
  await Promise.all((map.pins || []).map(async (p) => {
    const th = p.kind === 'text' ? null : pinThumb(p, portraits, maps);
    if (th) thumbs.set(p.id, await loadImg(th.url));
  }));
  const kindColor = { entity: PRINT.pinEntity, portal: PRINT.pinPortal, note: PRINT.pinDefault };
  for (const pin of map.pins || []) {
    const x = PX(pin.x), y = PY(pin.y);
    const kk = scale * ps * pinSizeK(pin);
    const label = (pin.kind === 'entity' && names.get(pin.entityFile)) || pin.label || '';
    ctx.save();
    if (pin.kind === 'text') {
      ctx.font = `bold ${Math.round(22 * kk)}px Georgia, "Sarabun", serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4 * kk; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(label, x, y);
      ctx.fillStyle = pin.color || PRINT.labelOnDark; ctx.fillText(label, x, y);
      ctx.restore();
      continue;
    }
    const sz = 32 * kk, r = 8 * kk;
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 5 * kk; ctx.shadowOffsetY = 2 * kk;
    roundRect(ctx, x - sz / 2, y - sz / 2, sz, sz, r);
    ctx.fillStyle = 'rgba(14,18,26,.9)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    const im = thumbs.get(pin.id);
    if (im) {
      ctx.save(); roundRect(ctx, x - sz / 2, y - sz / 2, sz, sz, r); ctx.clip();
      const s0 = Math.max(sz / im.naturalWidth, sz / im.naturalHeight);
      ctx.drawImage(im, x - (im.naturalWidth * s0) / 2, y - (im.naturalHeight * s0) / 2, im.naturalWidth * s0, im.naturalHeight * s0);
      ctx.restore();
    } else {
      ctx.fillStyle = pin.color || kindColor[pin.kind] || PRINT.pinDefault;
      ctx.font = `${Math.round(18 * kk)}px "K2 Icons", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((PIN_KIND[pin.kind] || PIN_KIND.note).icon, x, y + 1);
    }
    roundRect(ctx, x - sz / 2, y - sz / 2, sz, sz, r);
    ctx.lineWidth = 2 * kk; ctx.strokeStyle = pin.color || kindColor[pin.kind] || PRINT.pinDefault; ctx.stroke();
    if (label && !pin.hideLabel) {
      const fs = Math.round(12.5 * kk);
      ctx.font = `600 ${fs}px "Sarabun", sans-serif`;
      const tw = ctx.measureText(label).width;
      const lx = x - tw / 2 - 8 * kk, ly = y + sz / 2 + 4 * kk, lw = tw + 16 * kk, lh = fs * 1.6;
      roundRect(ctx, lx, ly, lw, lh, 5 * kk);
      ctx.fillStyle = 'rgba(14,18,26,.88)'; ctx.fill();
      ctx.fillStyle = PRINT.labelOnDark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x, ly + lh / 2 + 0.5);
    }
    ctx.restore();
  }

  if (ov.compass) {
    ctx.save();
    const cx = W - 60 * scale, cy = 60 * scale, rr = 34 * scale;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    ctx.lineWidth = 2 * scale; ctx.strokeStyle = PRINT.line; ctx.stroke();
    ctx.translate(cx, cy); ctx.rotate((-(geoOf(map).north || 0) * Math.PI) / 180); ctx.translate(-cx, -cy);
    ctx.beginPath(); ctx.moveTo(cx, cy - rr * 0.72); ctx.lineTo(cx - rr * 0.28, cy + rr * 0.4);
    ctx.lineTo(cx + rr * 0.28, cy + rr * 0.4); ctx.closePath();
    ctx.fillStyle = PRINT.marker; ctx.fill();
    ctx.fillStyle = PRINT.ink; ctx.font = `bold ${Math.round(13 * scale)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - rr * 0.88);
    ctx.restore();
  }
  if (ov.scale) {
    ctx.save();
    // ตั้งมาตราส่วนจริงแล้ว = แถบยาวตามระยะจริงที่สวย · ยังไม่ตั้ง = 18% ของความกว้างกรอบตามข้อความของผู้ใช้
    const mpu = metersPerUnit(map, aspect);
    const nb = mpu ? niceScaleBar(mpu, 18) : null;
    const bw = nb ? nb.units * ppx : 18 * ppx, bx = 40 * scale, by = H - 55 * scale, bh = 9 * scale;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(bx - 6 * scale, by - 6 * scale, bw + 12 * scale, bh + 30 * scale);
    ctx.fillStyle = PRINT.ink; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = PRINT.paper; ctx.fillRect(bx + bw / 4, by + 1, bw / 4, bh - 2);
    ctx.fillStyle = PRINT.ink; ctx.font = `${Math.round(13 * scale)}px "Sarabun", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(nb ? distText(niceDistance(nb.meters)) : (ov.scaleLabel || ''), bx, by + bh + 4 * scale);
    ctx.restore();
  }
  return cv;
}

function safeFileName(s) { return String(s || 'map').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'map'; }

/**
 * ส่งออกแผนที่เป็น PNG
 * [alpha.168] ผู้ใช้: "map ส่งออก png ใช้ไม่ได้" — เดิมเขียนเงียบ ๆ ลงคลังรูป ไม่มีกล่องบันทึก ไม่บอกว่าไปไหน
 *   → ค่าเริ่มต้น = กล่องบันทึก (เลือกที่เก็บเอง) · { library:true } = เก็บในคลังรูปของโปรเจกต์แบบเดิม · outPath = เทส
 * @returns ทางไฟล์ / true (คลังรูป) / null (ยกเลิก) / false (ผิดพลาด)
 */
export async function exportMapPng(map, opts = {}) {
  try {
    const cv = await drawMapToCanvas(map);
    const base = safeFileName(map.name) + '-map.png';
    if (opts.library) {
      const dir = await kapi.join(state.root, 'Images');
      const name = await kapi.writeImageData(dir, base, cv.toDataURL('image/png').split(',')[1]);
      setStatus(t('ui.maps.saveMapLibraryImage') + (typeof name === 'string' ? name : base));
      return true;
    }
    return await saveCanvasPng(cv, base, opts.outPath);
  } catch (e) {
    log('error', t('ui.maps.mapsExportPNGNot'), e);
    setStatusError(failText(t('ui.common.exportPNGNotOk'), e));
    return false;
  }
}

export async function printMap(map) {
  let layer = null;
  try {
    const cv = await drawMapToCanvas(map);
    layer = el('div', null); layer.id = 'map-print-layer';
    const im = el('img'); im.src = cv.toDataURL('image/png');
    const cap = el('div', 'map-print-cap', map.name || '');
    layer.append(im, cap);
    document.body.append(layer);
    document.body.classList.add('map-printing', 'printing');
    await new Promise((r) => setTimeout(r, 60));       // ให้ <img> วาดจริงก่อนสั่งพิมพ์
    await kapi.print();
    return true;
  } catch (e) {
    log('error', t('ui.maps.mapsPrintMapNot'), e);
    setStatusError(failText(t('ui.maps.printMapNotOk'), e));
    return false;
  } finally {
    document.body.classList.remove('map-printing', 'printing');
    if (layer) layer.remove();
  }
}

/** [alpha.167] ส่งออกข้อมูลแผนที่ (หมุด · โซน · พิกัด) เป็น GeoJSON — ใช้ต่อในโปรแกรมแผนที่อื่นได้เมื่อตั้งพิกัดแล้ว */
export function mapGeoJson(map) {
  const feats = [];
  const coord = (p) => { const ll = toLatLon(map, p); return ll ? [+ll.lon.toFixed(7), +ll.lat.toFixed(7)] : [+p.x.toFixed(3), +(-p.y).toFixed(3)]; };
  for (const p of map.pins || []) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coord(p) },
    properties: { name: p.label || '', kind: p.kind, note: p.note || '' } });
  for (const z of mapZones(map)) {
    const ring = z.points.map(coord); ring.push(ring[0]);
    feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { name: z.name || '', kind: 'zone', areaM2: zoneAreaM2(map, z) } });
  }
  for (const r of mapRoutes(map)) {
    const pts = routePoints(map, r);
    if (pts.length > 1) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(coord) },
      properties: { name: r.name || '', kind: 'route', meters: pathMeters(map, pts) } });
  }
  return { type: 'FeatureCollection', properties: { name: map.name || '', georeferenced: geoReady(map).full }, features: feats };
}
export async function exportMapGeoJson(map, outPath) {
  try {
    const dest = outPath || await kapi.saveAsDialog(safeFileName(map.name) + '.geojson', 'json');
    if (!dest) return null;
    await kapi.writeFile(dest, JSON.stringify(mapGeoJson(map), null, 2));
    setStatus(tf('ui.maps.geojsonDone', String(dest).split(/[\\/]/).pop()));
    return dest;
  } catch (e) {
    log('error', 'maps: geojson export failed', e);
    setStatusError(failText(t('ui.maps.geojson'), e));
    return null;
  }
}

// ═══════════════════════ [alpha.168] แผนที่ในหน้า Wiki (ภาพอ้างอิง 4 ของผู้ใช้) ═══════════════════════
// ผู้ใช้: "ใน wiki เราต้องสามารถ อิง map ได้เปล่า แบบรูปที่ 4" → กล่อง "แผนที่" ในหน้าเอนทิตี้:
//   ปักอยู่แล้ว = แผนที่ย่อ (เลื่อน/ซูมได้) กึ่งกลางที่หมุดของเอนทิตี้นี้ + หมุด/โซนอื่นรอบ ๆ · หลายใบ = แท็บเลือกใบ
//   ยังไม่ปัก = เลือกแผนที่แล้ว "ปักลงแผนที่นี้" ได้ทันที (ไม่ต้องไปเปิดแผงแผนที่ก่อน)
// ใช้คลาสหน้าตาเดียวกับแผงแผนที่ (.map2) — หมุดรูปย่อ · โซนตามสี/ความจาง · คงขนาดบนจอ
export async function renderMapEmbed(host, entityFile, entityName) {
  if (!host || !state.root) return false;
  host.replaceChildren();
  let data;
  try { data = await loadMaps(); } catch { return false; }
  const maps = data.maps || [];
  const norm = (p) => String(p || '').replace(/\\/g, '/').toLowerCase();
  const mine = (f) => f && norm(f) === norm(entityFile);
  const hits = maps.filter((m) => (m.pins || []).some((p) => p.kind === 'entity' && mine(p.entityFile)) ||
    mapZones(m).some((z) => mine(z.entityFile)));
  const head = el('div', 'wiki-map-head');
  head.append(el('span', 'wiki-map-title', gi('map') + ' ' + t('ui.maps.wikiBlock')));
  host.append(head);
  if (!hits.length) {
    const box = el('div', 'wiki-map-empty');
    box.append(el('div', 'dim', maps.length ? t('ui.maps.wikiNotPlaced') : t('ui.maps.wikiNoMaps')));
    if (maps.length) {
      const sel = el('select', 'k-dlg-select wiki-map-sel');
      for (const m of sortMaps(maps)) { const o = el('option', null, m.name || ''); o.value = m.id; sel.append(o); }
      const b = el('button', 'cmp-mini k-ok', gi('map-pin') + ' ' + t('ui.maps.wikiPlaceHere'));
      b.onclick = async () => {
        const m = findMap(maps, sel.value);
        if (!m) return;
        m.pins = [...(m.pins || []), entityPin(50, 50, entityFile, entityName)];
        await saveMaps(data);
        setStatus(tf('ui.maps.entPlacedStatus', entityName));
        refreshMapsIfOpen();
        renderMapEmbed(host, entityFile, entityName);
      };
      box.append(sel, b);
    } else {
      const b = el('button', 'cmp-mini', gi('map') + ' ' + t('ui.maps.wikiOpenMaps'));
      b.onclick = () => openMaps();
      box.append(b);
    }
    host.append(box);
    return true;
  }
  const want = host._mapId && hits.some((m) => m.id === host._mapId) ? host._mapId : hits[0].id;
  host._mapId = want;
  const cur = findMap(maps, want);
  if (hits.length > 1) {
    const tabs = el('div', 'wiki-map-tabs');
    for (const m of hits) {
      const b = el('button', 'cmp-mini' + (m.id === want ? ' on' : ''), m.name || '');
      b.onclick = () => { host._mapId = m.id; renderMapEmbed(host, entityFile, entityName); };
      tabs.append(b);
    }
    head.append(tabs);
  }
  const pin = (cur.pins || []).find((p) => p.kind === 'entity' && mine(p.entityFile));
  const zone = mapZones(cur).find((z) => mine(z.entityFile));
  const openB = el('button', 'cmp-mini wiki-map-open', gi('arrow-expand') + ' ' + t('ui.maps.wikiOpenPanel'));
  openB.onclick = () => focusMapPin(cur.id, pin ? pin.id : null, pin ? null : zone ? polygonCentroid(zone.points) : null);
  head.append(el('span', 'wiki-map-sp'), openB);

  // ── ผืนแผนที่ย่อ ──
  const wrap = el('div', 'map2 wiki-map-view');
  const stage = el('div', 'map-stage');
  const canvas = el('div', 'map-canvas');
  const W = FRAME_W, H = FRAME_W / frameAspect(cur);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  if (cur.image) { const im = el('img', 'map-img'); im.src = mapImgURL(cur.image); im.alt = ''; im.draggable = false; applyMapBgStyle(im, cur); canvas.append(im); }
  const NS = 'http://www.w3.org/2000/svg';
  const zs = document.createElementNS(NS, 'svg');
  zs.setAttribute('class', 'map-zones'); zs.setAttribute('viewBox', '0 0 100 100'); zs.setAttribute('preserveAspectRatio', 'none');
  for (const z of mapZones(cur)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', zonePath(z.points));
    p.setAttribute('class', 'map-zone' + (mine(z.entityFile) ? ' sel' : ''));
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    p.style.setProperty('--zc', z.color || ZONE_COLORS[0]);
    p.style.fill = z.color || ZONE_COLORS[0];
    p.style.fillOpacity = String(zoneOpacity(z));
    zs.append(p);
  }
  canvas.append(zs);
  const portraits = await loadPortraits();
  const names = new Map((await loadEntities()).map((e) => [e.file, e.name]));
  for (const p of cur.pins || []) {
    const n = el('div', 'map-pin map-pin-' + (p.kind || 'note') + (p === pin ? ' sel wiki-map-me' : ''));
    n.style.left = p.x + '%'; n.style.top = p.y + '%';
    if (p.color) n.style.setProperty('--pin-color', p.color);
    const k = pinScaleOf(cur) * pinSizeK(p);
    if (k !== 1) n.style.setProperty('--pin-scale', String(k));
    const label = (p.kind === 'entity' && names.get(p.entityFile)) || p.label || '';
    if (p.kind === 'text') n.append(el('span', 'map-text-label', label));
    else {
      const badge = el('span', 'map-pin-badge');
      const th = pinThumb(p, portraits, maps);
      if (th) { const av = el('span', 'map-pin-portrait'); const im = el('img'); im.src = th.url; im.alt = ''; im.draggable = false; av.append(im); badge.append(av); }
      else badge.append(el('span', 'map-pin-icon', (PIN_KIND[p.kind] || PIN_KIND.note).icon));
      n.append(badge);
      if (label && !p.hideLabel) n.append(el('span', 'map-pin-label', label));
    }
    n.title = label;
    if (p.kind === 'entity' && p.entityFile && p !== pin) n.onclick = () => openEntity(p.entityFile);
    if (p.kind === 'portal' && p.toMap) n.onclick = () => openMapById(p.toMap);
    canvas.append(n);
  }
  stage.append(canvas);
  wrap.append(stage);
  host.append(wrap);

  const cam = { zoom: 1.8, cx: pin ? pin.x : zone ? polygonCentroid(zone.points).x : 50, cy: pin ? pin.y : zone ? polygonCentroid(zone.points).y : 50 };
  const apply = () => {
    const sw = stage.clientWidth || 600, sh = stage.clientHeight || 300;
    const fit = Math.min(sw / W, sh / H) * 0.92, s = fit * cam.zoom;
    canvas.style.transform = `translate(${sw / 2 - (cam.cx / 100) * W * s}px, ${sh / 2 - (cam.cy / 100) * H * s}px) scale(${s})`;
    canvas.style.setProperty('--z', String(s));
  };
  requestAnimationFrame(apply);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const sw = stage.clientWidth, sh = stage.clientHeight, fit = Math.min(sw / W, sh / H) * 0.92;
    const s0 = fit * cam.zoom, tx0 = sw / 2 - (cam.cx / 100) * W * s0, ty0 = sh / 2 - (cam.cy / 100) * H * s0;
    const ax = e.clientX - r.left, ay = e.clientY - r.top, wx = (ax - tx0) / s0, wy = (ay - ty0) / s0;
    cam.zoom = clampZoom(zoomLadder(cam.zoom, e.deltaY < 0 ? 1 : -1));
    const s1 = fit * cam.zoom;
    cam.cx = ((sw / 2 - (ax - wx * s1)) / s1 / W) * 100; cam.cy = ((sh / 2 - (ay - wy * s1)) / s1 / H) * 100;
    apply();
  }, { passive: false });
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target.closest && e.target.closest('.map-pin'))) return;
    const sx = e.clientX, sy = e.clientY, c0 = { ...cam };
    const sw = stage.clientWidth, sh = stage.clientHeight, s = Math.min(sw / W, sh / H) * 0.92 * cam.zoom;
    const mv = (ev) => { cam.cx = c0.cx - ((ev.clientX - sx) / s / W) * 100; cam.cy = c0.cy - ((ev.clientY - sy) / s / H) * 100; apply(); stage.classList.add('panning'); };
    const offEsc = escCancelDrag(() => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); Object.assign(cam, c0); apply(); stage.classList.remove('panning'); });
    const up = () => { offEsc(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); stage.classList.remove('panning'); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  const ro = new ResizeObserver(() => { if (stage.isConnected) apply(); else ro.disconnect(); });
  ro.observe(stage);
  // บรรทัดสรุป: อยู่ในโซนไหน · พิกัด
  const where = [];
  if (pin) for (const z of zonesOfPin(cur, pin)) if (z.name) where.push(gi('vector-polygon') + ' ' + z.name);
  const ll = pin ? toLatLon(cur, pin) : null;
  if (ll) where.push(gi('crosshairs') + ' ' + formatLatLon(ll));
  if (where.length) host.append(el('div', 'wiki-map-foot dim', where.join('   ')));
  return true;
}
