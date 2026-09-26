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
  PIN_KIND, ROUTE_COLORS, breadcrumb, clamp, clampZoom, clonePins, deleteMap, deletePins, deleteRoute,
  findMap, gridLines, groupMaps, mapOverlays, mapRoutes, matchPin, newPin, newRoute,
  pinStats, routeLength, routePath, routePoints, scenePinCounts, scenesForMap, sortMaps, toggleOverlay,
  zoomStep, zoomScroll, MAP_ZOOM_MAX, MAP_ZOOM_MIN, MAP_ZOOM_STEP,
  geoOf, geoReady, metersPerUnit, distMeters, pathMeters, toLatLon, fromLatLon, niceDistance, formatLatLon,
  niceScaleBar, ZONE_COLORS, newZone, mapZones, deleteZone, zoneAt,
  zoneAreaM2, polygonCentroid, zonePath, niceArea, childMaps, parentMap, portalPin, entityPin, pinsOfEntity,
  storyJourney,
} from './maps.js';
import { ask, confirmBox, popupMenu } from './ui.js';
import { openEntity } from './wiki-ui.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { collectPlacedScenes } from './floorplan-ui.js';
import { gi } from './icons.js';
import { PRINT } from './palette.js';   // [alpha.162 · W6 ข้อ 2] สีภาพส่งออก (พื้นขาวเสมอ)
import { panelEmpty } from './panels/panel-chrome.js';   // [alpha.162 · W2] สถานะว่างของกลาง
import { bindDropTarget, setDrag } from './drop-kit.js';
import { escCancelDrag } from './drag-cancel.js';   // [alpha.167 · รอบต่อ] Esc ยกเลิกการลาก
import { extractNum } from './timeline.js';
import { distText, areaText, travelText } from './map-text.js';   // [alpha.167 · รอบต่อ] ถ้อยคำชุดเดียวกับฝั่ง AI

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
  toolDef('open', 'pointer', 'ui.common.openView', 'ui.maps.clickPinOpenLink'),
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
}
/** [alpha.167] สำหรับเทส/ทางอื่น: สถานะการดูปัจจุบัน (อ่านอย่างเดียว) */
export function mapsViewState() { return { gallery: view.gallery, tool: view.tool, zoom: view.zoom,
  zoneDraw: !!view.zoneDraw, measure: view.measure ? view.measure.points.length : 0, pick: view.pick ? view.pick.kind : null,
  selZone: view.selZone, journey: view.journey }; }

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
    b.onclick = async () => { const { openFloorPlan } = await import('./floorplan-ui.js'); await openFloorPlan(); };
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

/** เลื่อนพื้นที่แผนที่ให้เห็นหมุดที่กำลังเพ่ง (ทำหลังวาดเสร็จ ไม่งั้นขนาดยังเป็น 0) */
function scrollFocusIntoView() {
  const mark = $('#maps-body .map-focus');
  const stage = $('#maps-body .map-stage');
  if (!mark || !stage) return;
  const mr = mark.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  if (!sr.width) return;
  stage.scrollLeft += (mr.left + mr.width / 2) - (sr.left + sr.width / 2);
  stage.scrollTop += (mr.top + mr.height / 2) - (sr.top + sr.height / 2);
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
  const keepStage = pane.querySelector('.map-stage');
  const keepScroll = keepStage ? { l: keepStage.scrollLeft, t: keepStage.scrollTop } : null;
  const keepSide = pane.querySelector('.map-side-list');
  const keepSideScroll = keepSide ? keepSide.scrollTop : 0;
  pane.innerHTML = '';
  const maps = S.data.maps;
  const wrap = el('div', 'map-wrap map2' + (view.sideOpen ? '' : ' map-side-closed')); pane.append(wrap);
  const side = el('aside', 'map-side');
  const main = el('div', 'map-main');
  wrap.append(side, main);

  if (!maps.length || !findMap(maps, S.currentId)) view.gallery = true;
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
  else await renderMapView(main, pane, cur, keepScroll);
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
      where.length ? { label: t('ui.maps.entGoPins'), sub: where.map((w) => ({
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
    for (const z of zones) {
      const area = niceArea(zoneAreaM2(cur, z));
      const r = el('div', 'map-side-link map-side-zone' + (view.selZone === z.id ? ' on' : ''));
      const sw = el('span', 'map-zone-sw'); sw.style.background = z.color;
      r.append(sw, el('span', null, z.name || t('ui.common.notNamed')));
      if (area) r.append(el('span', 'map-side-n', areaText(area)));
      r.onclick = () => { view.selZone = view.selZone === z.id ? null : z.id; refresh(); };
      r.oncontextmenu = (ev) => { ev.preventDefault(); zoneMenu(cur, z, ev.clientX, ev.clientY); };
      g.append(r);
    }
    list.append(g);
  }
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
    main.append(panelEmpty(t('ui.maps.notPlannedPressAdd')));
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
async function renderMapView(main, pane, cur, keepScroll) {
  const S = mapsState_C.s;
  const maps = S.data.maps;
  const redraw = () => renderMaps(pane);
  const save = async () => { await saveMaps(S.data); };

  // แถบหัว: กลับแกลเลอรี · ชื่อ · เพิ่มแผนที่ · ค้นหาหมุด
  const head = el('div', 'map-head');
  const home = el('button', 'cmp-mini map-home', gi('grid') + ' ' + t('ui.maps.allMaps'));
  home.title = t('ui.maps.allMapsTip');
  home.onclick = () => showMapGallery();
  head.append(home, el('div', 'map-title', t('ui.common.map3')));
  const addBtn = el('button', 'k-ok', t('ui.maps.addMap'));
  addBtn.onclick = () => addMapFlow();
  head.append(addBtn);
  const search = el('input', 'map-search'); search.type = 'search';
  search.placeholder = t('ui.maps.searchPinName'); search.value = view.q;
  head.append(search);
  main.append(head);

  // ── แถบเลือกแผนที่ (chips) จัดกลุ่มตามหมวด (ข้อ 8) ──
  const groups = groupMaps(maps);
  if (groups.length > 1) {
    const catBar = el('div', 'map-catbar');
    const mkCat = (label, val) => {
      const c = el('div', 'map-cat' + (view.catFilter === val ? ' on' : ''), label);
      c.onclick = () => { view.catFilter = val; redraw(); };
      catBar.append(c);
    };
    mkCat(t('ui.common.all'), null);
    for (const g of groups) mkCat((g.cat || t('ui.common.notSpecifyCat')) + ' · ' + g.maps.length, g.cat);
    main.append(catBar);
  }
  const bar = el('div', 'map-bar');
  const shown = groups.filter((g) => view.catFilter === null || g.cat === view.catFilter);
  for (const g of shown) {
    if (groups.length > 1) bar.append(el('div', 'map-bar-cat', g.cat || t('ui.common.notSpecifyCat')));
    const row = el('div', 'map-bar-row');
    for (const m of g.maps) {
      const chip = el('div', 'map-chip' + (m.id === S.currentId ? ' on' : ''), m.name);
      const st = pinStats(m);
      if (st.portal) chip.append(el('span', 'map-chip-badge', gi('door') + st.portal));
      chip.onclick = () => { S.currentId = m.id; view.sel.clear(); view.routeEdit = null; view.focusPin = null; view.selZone = null; redraw(); };
      row.append(chip);
    }
    bar.append(row);
  }
  main.append(bar);

  // แผนที่ปัจจุบันต้องอยู่ในหมวดที่กรองไว้
  if (view.catFilter !== null && String(cur.category || '').trim() !== view.catFilter) {
    cur = (shown[0] && shown[0].maps[0]) || sortMaps(maps)[0];
  }
  S.currentId = cur.id;

  // breadcrumb โลก→เมือง→ห้อง
  const crumb = breadcrumb(maps, cur.id);
  if (crumb.length > 1) {
    const bc = el('div', 'map-crumb');
    crumb.forEach((c, i) => {
      if (i) bc.append(el('span', 'map-crumb-sep', '›'));
      const a = el('span', 'map-crumb-item' + (c.id === cur.id ? ' on' : ''), c.name);
      a.onclick = () => { S.currentId = c.id; view.sel.clear(); redraw(); };
      bc.append(a);
    });
    main.append(bc);
  }

  // ── แถบเครื่องมือแผนที่ปัจจุบัน ──
  const tools = el('div', 'map-tools');
  const nameInp = el('input', 'map-name-inp'); nameInp.value = cur.name;
  nameInp.title = t('ui.common.nameMap');
  nameInp.onchange = async () => { cur.name = nameInp.value.trim() || cur.name; await save(); redraw(); };
  tools.append(nameInp);
  const catInp = el('input', 'map-cat-inp'); catInp.value = cur.category || '';
  catInp.placeholder = t('ui.maps.catEgWorldCurrent'); catInp.title = t('ui.maps.catMapSkipEmpty');
  catInp.setAttribute('list', 'map-cat-list');
  const dl = el('datalist'); dl.id = 'map-cat-list';
  for (const g of groups) if (g.cat) { const o = el('option'); o.value = g.cat; dl.append(o); }
  catInp.onchange = async () => { cur.category = catInp.value.trim(); await save(); redraw(); };
  tools.append(catInp, dl);
  const chgImg = el('button', 'cmp-mini', t('ui.maps.changeImage'));
  chgImg.title = t('ui.maps.changeImageTip');
  chgImg.onclick = async () => { const it = await pickImage(state.root); if (!it) return;
    cur.image = 'Images/' + it.file; delete cur.aspect; await save(); redraw(); };
  tools.append(chgImg);
  // [alpha.167] พิกัดจริง
  const gr = geoReady(cur);
  const geoBtn = el('button', 'cmp-mini map-geo-btn' + (gr.full ? ' on' : ''), gi('earth') + ' ' + t('ui.maps.geoBtn'));
  geoBtn.title = gr.full ? t('ui.maps.geoBtnTipDone') : t('ui.maps.geoBtnTip');
  geoBtn.onclick = () => openGeoPanel(cur);
  tools.append(geoBtn);
  const expBtn = el('button', 'cmp-mini', t('ui.common.exportPNG'));
  expBtn.title = t('ui.maps.saveMapReadyPin');
  expBtn.onclick = () => exportMapPng(cur, S.data.maps);
  tools.append(expBtn);
  const gjBtn = el('button', 'cmp-mini', t('ui.maps.geojson'));
  gjBtn.title = t('ui.maps.geojsonTip');
  gjBtn.onclick = () => exportMapGeoJson(cur);
  tools.append(gjBtn);
  const prnBtn = el('button', 'cmp-mini', t('ui.maps.print'));
  prnBtn.title = t('ui.maps.printTip');
  prnBtn.onclick = () => printMap(cur, S.data.maps);
  tools.append(prnBtn);
  const delMap = el('button', 'cmp-mini k-danger', t('ui.maps.delMap'));
  delMap.title = t('ui.maps.delMapTip');
  delMap.onclick = async () => {
    if (!(await confirmBox(tf('ui.common.delMap', cur.name), t('ui.common.del')))) return;
    S.data.maps = deleteMap(maps, cur.id); S.currentId = S.data.maps[0]?.id || null;
    view.sel.clear(); view.gallery = true; await save(); redraw();
  };
  tools.append(delMap);
  main.append(tools);

  const toolHint = (MAP_TOOLS.find((x) => x.id === view.tool) || MAP_TOOLS[0]).hint;
  const hint = el('div', 'map-hint', tf('ui.maps.clickEmptyPinPinF', toolHint));
  main.append(hint);
  search.oninput = () => { view.q = search.value; applyPinFilter(main); };

  // ── แถบทำงานกับหมุดหลายตัว (ข้อ 6) ──
  const selBar = el('div', 'map-selbar' + (view.sel.size || view.clip.length ? ' on' : ''));
  const selCount = el('span', 'map-selcount', view.sel.size ? tf('ui.maps.pickPin', view.sel.size) : t('ui.maps.cantPickPin'));
  selBar.append(selCount);
  if (view.sel.size) {
    const bCopy = el('button', 'cmp-mini', t('ui.maps.copy'));
    bCopy.title = t('ui.maps.copyPinPickDone');
    bCopy.onclick = () => {
      view.clip = clonePins(cur.pins, [...view.sel], 0);
      setStatus(tf('ui.maps.copyPinDoneOpen', view.clip.length));
      redraw();
    };
    const bDel = el('button', 'cmp-mini k-danger', t('ui.maps.delPick'));
    bDel.title = t('ui.maps.delPickTip');
    bDel.onclick = async () => {
      const n = view.sel.size;
      if (!(await confirmBox(tf('ui.maps.delPinPickItem', n), t('ui.common.del')))) return;
      deletePins(cur, [...view.sel]);
      view.sel.clear(); await save(); setStatus(tf('ui.maps.delPinDone', n)); redraw();
    };
    const bNone = el('button', 'cmp-mini', t('ui.maps.cancelPick'));
    bNone.title = t('ui.maps.cancelPickTip');
    bNone.onclick = () => { view.sel.clear(); redraw(); };
    selBar.append(bCopy, bDel, bNone);
  }
  if (view.clip.length) {
    const bPaste = el('button', 'cmp-mini', tf('ui.maps.pastePin', view.clip.length));
    bPaste.title = t('ui.maps.pastePinCopyMap');
    bPaste.onclick = async () => {
      const added = clonePins(view.clip, view.clip.map((p) => p.id), 2, cur.id);
      cur.pins = [...(cur.pins || []), ...added];
      view.sel = new Set(added.map((p) => p.id));
      await save(); setStatus(tf('ui.maps.pastePinDone', added.length, cur.name)); redraw();
    };
    selBar.append(bPaste);
  }
  main.append(selBar);

  // ── โหมดต่อเส้นทาง ──
  const editingRoute = view.routeEdit ? mapRoutes(cur).find((r) => r.id === view.routeEdit) : null;
  if (editingRoute) {
    const rb = el('div', 'map-routebar');
    rb.append(el('span', null, tf('ui.maps.busyNextRouteClick', editingRoute.name, (editingRoute.pinIds || []).length)));
    const undoB = el('button', 'cmp-mini', t('ui.maps.dotLatest'));
    undoB.title = t('ui.maps.dotLatestTip');
    undoB.onclick = async () => { (editingRoute.pinIds || []).pop(); await save(); redraw(); };
    const doneB = el('button', 'cmp-mini k-ok', t('ui.maps.done'));
    doneB.onclick = () => { view.routeEdit = null; redraw(); };
    rb.append(undoB, doneB);
    main.append(rb);
  }
  // ── [alpha.167] แถบสถานะของโหมดพิเศษ (จิ้มจุด · วาดโซน · วัดระยะ) ──
  const modeBar = buildModeBar(cur, redraw, save);
  if (modeBar) main.append(modeBar);

  const counts = scenePinCounts(scenesCache, cur.id);
  const hereScenes = scenesForMap(scenesCache, cur.id);

  // ═══ พื้นที่แผนที่: กรอบ (ลอย HUD ทับได้) → stage (เลื่อน) → canvas (กว้างตามซูม) ═══
  const frame = el('div', 'map-frame');
  const stage = el('div', 'map-stage');
  const canvas = el('div', 'map-canvas' + (view.pick || view.zoneDraw || view.measure ? ' map-picking' : ''));
  canvas.style.width = (view.zoom * 100) + '%';
  const img = el('img', 'map-img');
  if (cur.image) {
    img.src = mapImgURL(cur.image); img.draggable = false; canvas.append(img);
    // จดสัดส่วนภาพไว้ในแผนที่ (ระยะจริงต้องรู้ว่าแกนตั้งยาวเท่าไรเทียบแกนนอน) — เขียนเงียบ ไม่วาดใหม่
    img.addEventListener('load', () => {
      const a = img.naturalWidth && img.naturalHeight ? +(img.naturalWidth / img.naturalHeight).toFixed(5) : 0;
      if (a && Math.abs((+cur.aspect || 0) - a) > 1e-4) { cur.aspect = a; save().catch(() => {}); }
    }, { once: true });
  } else canvas.append(el('div', 'map-noimg', t('ui.maps.notHasImagePress')));
  const ov = mapOverlays(cur);
  const NS = 'http://www.w3.org/2000/svg';
  const mkSvg = (cls) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    return svg;
  };

  // ── ชั้นล่างสุด: โซน (ผู้ใช้: "Zone จะต้องอยู่ layer หลังสุด") ──
  const zones = mapZones(cur);
  if (zones.length || view.zoneDraw) {
    const zs = mkSvg('map-zones');
    for (const z of zones) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', zonePath(z.points));
      p.setAttribute('class', 'map-zone' + (view.selZone === z.id ? ' sel' : ''));
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      p.style.setProperty('--zc', z.color || ZONE_COLORS[0]);
      p.dataset.zone = z.id;
      zs.append(p);
    }
    if (view.zoneDraw && view.zoneDraw.points.length) {
      const p = document.createElementNS(NS, 'path');
      const pts = view.zoneDraw.points;
      p.setAttribute('d', pts.map((q, i) => (i ? 'L' : 'M') + q.x.toFixed(2) + ',' + q.y.toFixed(2)).join(' ') + (pts.length > 2 ? ' Z' : ''));
      p.setAttribute('class', 'map-zone map-zone-draft');
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      p.style.setProperty('--zc', view.zoneDraw.color);
      zs.append(p);
    }
    canvas.append(zs);
    for (const z of zones) {
      const c = polygonCentroid(z.points);
      const lb = el('div', 'map-zone-label' + (view.selZone === z.id ? ' sel' : ''), z.name || '');
      lb.style.left = c.x + '%'; lb.style.top = c.y + '%';
      lb.style.setProperty('--zc', z.color || ZONE_COLORS[0]);
      lb.dataset.zone = z.id;
      if (z.name) canvas.append(lb);
      // จุดยอดของโซนที่เลือก (โหมดแก้ไข) — ลากปรับรูปได้
      if (view.selZone === z.id && view.tool === 'edit') {
        z.points.forEach((pt, i) => canvas.append(zoneVertex(cur, z, i, canvas, save, redraw)));
      }
    }
    if (view.zoneDraw) view.zoneDraw.points.forEach((pt) => {
      const v = el('div', 'map-zone-vtx map-zone-vtx-draft'); v.style.left = pt.x + '%'; v.style.top = pt.y + '%'; canvas.append(v);
    });
  }

  // กริด
  if (ov.grid) {
    const g = el('div', 'map-grid');
    const cell = (100 / ov.gridSize) + '%';
    g.style.backgroundSize = cell + ' ' + cell;
    canvas.append(g);
  }

  // เส้นทาง (ข้อ 9) + เส้นทางของเรื่อง + เส้นวัดระยะ — SVG พิกัด 0–100 · vector-effect กันเส้นถูกยืด
  const routes = view.showRoutes ? mapRoutes(cur) : [];
  const journey = view.journey ? storyJourney(cur, scenesCache || [], (s) => extractNum(s.storyDate)) : null;
  if (routes.length || (journey && journey.stops.length > 1) || (view.measure && view.measure.points.length)) {
    const svg = mkSvg('map-routes');
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
      svg.append(p);
    }
    if (journey && journey.stops.length > 1) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', routePath(journey.stops.map((s) => s.pt)));
      p.setAttribute('class', 'map-journey');
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(p);
    }
    if (view.measure && view.measure.points.length) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', routePath(view.measure.points.length > 1 ? view.measure.points : [view.measure.points[0], view.measure.points[0]]));
      p.setAttribute('class', 'map-measure');
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(p);
    }
    canvas.append(svg);
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
  }

  // จุดที่ตั้งมาตราส่วน/พิกัดไว้ (มองเห็นตอนเปิดหน้าตั้งพิกัด หรือระหว่างจิ้ม)
  const geo = geoOf(cur);
  if (view.pick || $('.map-geo-pop')) {
    if (geo.scale) for (const [k, p] of [['A', geo.scale.a], ['B', geo.scale.b]]) {
      const m = el('div', 'map-geo-mark', k); m.style.left = p.x + '%'; m.style.top = p.y + '%'; canvas.append(m);
    }
    if (geo.ref) { const m = el('div', 'map-geo-mark map-geo-ref', gi('crosshairs')); m.style.left = geo.ref.x + '%'; m.style.top = geo.ref.y + '%'; canvas.append(m); }
  }

  const ptOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  };
  const isBg = (e) => e.target === canvas || e.target === img || (e.target.classList && (e.target.classList.contains('map-grid')
    || e.target.classList.contains('map-zone') || e.target.classList.contains('map-zone-label')))
    || (e.target.closest && !!e.target.closest('svg.map-zones'));

  // ── คลิกบนผืนแผนที่ ──
  let suppressClick = false;               // กันคลิกที่เกิดหลังลากกรอบเลือก/เลื่อนภาพ
  canvas.onclick = async (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (!isBg(e)) return;
    const pt = ptOf(e);
    if (view.pick) { view.pick.resolve(pt); return; }
    if (view.zoneDraw) { view.zoneDraw.points.push(pt); redraw(); return; }
    if (view.measure) { view.measure.points.push(pt); redraw(); return; }
    // โซน: คลิก = เลือก · Ctrl+คลิก = เปิดเอนทิตี้ของโซน (กระโดดแบบเดียวกับตัวแก้ไข)
    const z = zoneAt(cur, pt);
    if (z && (e.ctrlKey || e.metaKey) && z.entityFile) { openEntity(z.entityFile); return; }
    if (view.sel.size) { view.sel.clear(); redraw(); return; }   // คลิกที่ว่าง = ยกเลิกการเลือกก่อน
    if (z) { view.selZone = view.selZone === z.id ? null : z.id; redraw(); return; }
    if (view.selZone) { view.selZone = null; redraw(); return; }
    // [alpha.167] ควบคุมแบบเกม: คลิกเดียวในโหมดเปิด/ดู = ไม่ปักหมุด (ปักด้วยดับเบิลคลิก หรือโหมดแก้ไข)
    if (view.tool !== 'edit') return;
    await addPinAt(pt);
  };
  canvas.ondblclick = async (e) => {
    if (!isBg(e) || view.pick || view.measure) return;
    if (view.zoneDraw) { e.preventDefault(); await finishZone(cur, save, redraw); return; }
    await addPinAt(ptOf(e));
  };
  canvas.oncontextmenu = (e) => {
    if (!isBg(e)) return;
    e.preventDefault();
    if (view.zoneDraw || view.measure) { view.zoneDraw = null; view.measure = null; redraw(); return; }
    const pt = ptOf(e);
    const z = zoneAt(cur, pt);
    if (z) { zoneMenu(cur, z, e.clientX, e.clientY); return; }
    const ll = toLatLon(cur, pt);
    popupMenu(e.clientX, e.clientY, [
      { label: t('ui.maps.ctxAddPin'), click: () => addPinAt(pt) },
      { label: t('ui.maps.zoneDrawHere'), click: () => startZoneDraw(cur, null) },
      { label: t('ui.maps.measureStart'), click: () => { view.measure = { points: [pt] }; redraw(); } },
      ll ? { label: t('ui.maps.ctxCopyCoords') + ' ' + formatLatLon(ll), click: () => navigator.clipboard.writeText(formatLatLon(ll)).catch(() => {}) } : null,
    ].filter(Boolean));
  };
  async function addPinAt(pt) {
    const pin = newPin(pt.x, pt.y);
    const res = await pinDialog(pin, maps, cur.id);
    if (!res) return;
    cur.pins.push(res); await save(); redraw();
  }

  // Shift+ลาก = เลือกหมุดเป็นกรอบ · ลากที่ว่างเฉย ๆ = เลื่อนภาพ (แบบเกม)
  canvas.onpointerdown = (e) => {
    if (e.button === 1 || (e.button === 0 && !e.shiftKey && isBg(e) && !view.pick && !view.zoneDraw && !view.measure)) {
      // เลื่อนภาพ — ลากไม่ถึง 4px = ถือเป็นคลิก
      const sx = e.clientX, sy = e.clientY, l0 = stage.scrollLeft, t0 = stage.scrollTop;
      let moved = false;
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
        moved = true; stage.classList.add('panning');
        stage.scrollLeft = l0 - (ev.clientX - sx); stage.scrollTop = t0 - (ev.clientY - sy);
      };
      // [alpha.167 · รอบต่อ] Esc ระหว่างลาก = คืนที่เดิม (กฎถาวร alpha.164 รอบต่อ 6 · ทุกตัวลากในไฟล์นี้)
      const offEsc = escCancelDrag(() => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        stage.classList.remove('panning'); stage.scrollLeft = l0; stage.scrollTop = t0;
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
    const r = canvas.getBoundingClientRect();
    const box = el('div', 'map-rubber');
    canvas.append(box);
    const x0 = e.clientX, y0 = e.clientY;
    const paint = (ev) => {
      const l = Math.min(x0, ev.clientX) - r.left, tp = Math.min(y0, ev.clientY) - r.top;
      box.style.left = l + 'px'; box.style.top = tp + 'px';
      box.style.width = Math.abs(ev.clientX - x0) + 'px';
      box.style.height = Math.abs(ev.clientY - y0) + 'px';
    };
    paint(e);
    const offEsc = escCancelDrag(() => {
      window.removeEventListener('pointermove', paint); window.removeEventListener('pointerup', up);
      box.remove(); suppressClick = true;
    });
    const up = (ev) => {
      offEsc();
      window.removeEventListener('pointermove', paint);
      window.removeEventListener('pointerup', up);
      const x1 = ((Math.min(x0, ev.clientX) - r.left) / r.width) * 100;
      const x2 = ((Math.max(x0, ev.clientX) - r.left) / r.width) * 100;
      const y1 = ((Math.min(y0, ev.clientY) - r.top) / r.height) * 100;
      const y2 = ((Math.max(y0, ev.clientY) - r.top) / r.height) * 100;
      box.remove();
      if (Math.abs(x2 - x1) < 0.5 && Math.abs(y2 - y1) < 0.5) return;
      suppressClick = true;
      for (const p of cur.pins || []) if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) view.sel.add(p.id);
      redraw();
    };
    window.addEventListener('pointermove', paint);
    window.addEventListener('pointerup', up);
  };

  // ── วาดหมุด (แบบภาพ 4: ป้ายไอคอนกรอบมน + ป้ายชื่อพื้นเข้มใต้หมุด) ──
  const portraits = await loadPortraits();
  // [alpha.167 · รอบต่อ · บั๊ก] ป้ายของหมุดเอนทิตี้ = ชื่อ ณ ตอนปัก — เปลี่ยนชื่อใน Wiki แล้วค้างชื่อเก่า → ชื่อปัจจุบันชนะ
  const entNames = new Map((await loadEntities()).map((e) => [e.file, e.name]));
  const pinScale = pinScaleOf(cur);
  for (const pin of cur.pins || []) {
    const shown = (pin.kind === 'entity' && entNames.get(pin.entityFile)) || pin.label || '';
    const selected = view.sel.has(pin.id);
    const el2 = el('div', 'map-pin map-pin-' + pin.kind + (selected ? ' sel' : ''));
    el2.dataset.pin = pin.id;
    el2.style.left = pin.x + '%'; el2.style.top = pin.y + '%';
    if (pinScale !== 1) el2.style.setProperty('--pin-scale', String(pinScale));
    if (pin.color) el2.style.setProperty('--pin-color', pin.color);
    const badge = el('span', 'map-pin-badge');
    const portraitFile = pin.kind === 'entity' && pin.entityFile ? portraits.get(pin.entityFile) : '';
    const child = pin.kind === 'portal' && pin.toMap ? findMap(maps, pin.toMap) : null;
    if (portraitFile) {
      const av = el('span', 'map-pin-portrait');
      const im = el('img');
      im.src = mapImgURL('Images/' + portraitFile);
      im.alt = shown;
      im.draggable = false;
      im.onerror = () => { av.replaceWith(el('span', 'map-pin-icon', PIN_KIND.entity.icon)); };
      av.append(im);
      badge.append(av);
    } else if (child && child.image) {
      // ประตูไปแผนที่ย่อย = โชว์รูปย่อของแผนที่ปลายทาง (เห็นเลยว่าเข้าไปแล้วเจออะไร)
      const av = el('span', 'map-pin-portrait map-pin-child');
      const im = el('img'); im.src = mapImgURL(child.image); im.alt = ''; im.draggable = false;
      im.onerror = () => { av.replaceWith(el('span', 'map-pin-icon', PIN_KIND.portal.icon)); };
      av.append(im); badge.append(av);
    } else {
      badge.append(el('span', 'map-pin-icon', (PIN_KIND[pin.kind] || PIN_KIND.note).icon));
    }
    el2.append(badge);
    if (shown && view.showLabels) el2.append(el('span', 'map-pin-label', shown));
    const scHere = hereScenes.filter((s) => s.pinId === pin.id);
    if (scHere.length) el2.append(el('span', 'map-pin-count', String(scHere.length)));
    const ll = toLatLon(cur, pin);
    el2.title = [shown || (PIN_KIND[pin.kind] || {}).label || '', pin.note,
                 ll ? formatLatLon(ll) : '',
                 child ? tf('ui.maps.portalTip', child.name) : '',
                 scHere.length ? scHere.map((s) => gi('file') + ' ' + s.title).join('\n') : '']
      .filter(Boolean).join('\n');
    el2.onclick = async (e) => {
      e.stopPropagation();
      if (view.pick) { view.pick.resolve({ x: pin.x, y: pin.y }); return; }
      if (view.measure) { view.measure.points.push({ x: pin.x, y: pin.y }); redraw(); return; }
      if (view.zoneDraw) { view.zoneDraw.points.push({ x: pin.x, y: pin.y }); redraw(); return; }
      if (editingRoute) { editingRoute.pinIds = [...(editingRoute.pinIds || [])];
        if (editingRoute.pinIds[editingRoute.pinIds.length - 1] !== pin.id) editingRoute.pinIds.push(pin.id);
        await save(); redraw(); return; }
      // [alpha.167] Ctrl+คลิก = กระโดด (ทางสากลเหมือนตัวแก้ไข) · Ctrl+คลิกหมุดที่ไม่มีลิงก์ = เลือกหลายตัว (แบบเดิม)
      if (e.ctrlKey || e.metaKey) {
        if (pin.kind === 'portal' && pin.toMap && findMap(maps, pin.toMap)) { enterMap(pin.toMap); return; }
        if (pin.kind === 'entity' && pin.entityFile) { openEntity(pin.entityFile); return; }
        if (view.sel.has(pin.id)) view.sel.delete(pin.id); else view.sel.add(pin.id);
        redraw(); return;
      }
      if (e.altKey) return editPin();
      if (view.tool === 'edit') return editPin();
      if (view.tool === 'move') { setStatus(t('ui.maps.modeMovePosDrag')); return; }
      if (pin.kind === 'portal' && pin.toMap) { S.currentId = pin.toMap; view.sel.clear(); view.focusPin = null; redraw(); return; }
      if (pin.kind === 'entity' && pin.entityFile) { openEntity(pin.entityFile); return; }
      setStatus(gi('pin') + ' ' + (pin.label || t('ui.common.notNamed')) + (pin.note ? ' — ' + pin.note : '')
                + t('ui.maps.pressBtnEditTop'));
    };
    el2.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      const items = [
        { label: t('ui.maps.pinEdit'), click: () => editPin() },
        pin.kind === 'entity' && pin.entityFile ? { label: t('ui.maps.entOpenWiki'), click: () => openEntity(pin.entityFile) } : null,
        pin.kind === 'portal' && pin.toMap ? { label: t('ui.maps.portalEnter'), click: () => enterMap(pin.toMap) } : null,
        { label: t('ui.maps.zoneDraw'), click: () => startZoneDraw(cur, pin.kind === 'entity' ? { file: pin.entityFile, name: pin.label } : { file: '', name: pin.label }) },
        { label: t('ui.maps.measureFromPin'), click: () => { view.measure = { points: [{ x: pin.x, y: pin.y }] }; redraw(); } },
      ].filter(Boolean);
      popupMenu(e.clientX, e.clientY, items);
    };
    async function editPin() {
      const res = await pinDialog({ ...pin }, maps, cur.id, true);
      if (res === 'DELETE') { deletePins(cur, [pin.id]); view.sel.delete(pin.id); await save(); redraw(); return; }
      if (res) { Object.assign(pin, res); await save(); redraw(); }
    }
    el2.onpointerdown = (e) => {
      if (view.tool !== 'move') return;
      if (e.button !== 0 || e.shiftKey) return;
      e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      const group = (selected && view.sel.size > 1) ? [...view.sel] : [pin.id];
      const start = new Map((cur.pins || []).filter((p) => group.includes(p.id)).map((p) => [p.id, { x: p.x, y: p.y }]));
      const ox = e.clientX, oy = e.clientY;
      let moved = false;
      const mv = (ev) => {
        const dx = ((ev.clientX - ox) / r.width) * 100, dy = ((ev.clientY - oy) / r.height) * 100;
        if (!moved && Math.abs(ev.clientX - ox) < 3 && Math.abs(ev.clientY - oy) < 3) return;
        moved = true; el2.classList.add('dragging');
        for (const p of cur.pins || []) {
          const s0 = start.get(p.id); if (!s0) continue;
          p.x = clamp(s0.x + dx); p.y = clamp(s0.y + dy);
          const node = canvas.querySelector(`.map-pin[data-pin="${p.id}"]`);
          if (node) { node.style.left = p.x + '%'; node.style.top = p.y + '%'; }
        }
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
        if (moved) suppressClick = true;
      });
      const up = async () => {
        offEsc();
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        el2.classList.remove('dragging');
        if (moved) { await save(); redraw(); }
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    };
    canvas.append(el2);
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
  // เข็มทิศ + มาตราส่วน (ข้อ 4) — ตั้งมาตราส่วนจริงแล้ว = แถบบอกระยะจริงเอง
  if (ov.compass) {
    const c = el('div', 'map-compass');
    c.innerHTML = '<span class="map-compass-n">N</span><span class="map-compass-needle">' + gi('triangle-up') + '</span>';
    if (geo.north) c.style.transform = `rotate(${-geo.north}deg)`;
    c.title = t('ui.maps.topImage');
    canvas.append(c);
  }
  stage.append(canvas);
  frame.append(stage);

  // ── HUD ลอยบนแผนที่ (ไม่เลื่อนตามภาพ) ──
  // ลำดับใน DOM: ซูมก่อน (ป้าย % ตัวแรกของแผง = ระดับซูม — เทส/ผู้อ่านหน้าจอเจอก่อน) · ตำแหน่งบนจอคุมด้วย CSS
  frame.append(buildZoomHud(cur, main, stage, redraw, save, ov)); // ล่าง: ซูม + โอเวอร์เลย์ (.map-tools2)
  frame.append(buildToolRail(cur, redraw, save));             // ซ้ายบน: โหมด + ป้ายชื่อ + ขนาดหมุด (.map-tools3)
  const readout = el('div', 'map-readout');
  frame.append(readout);
  const scaleHud = buildScaleHud(cur, ov, stage);
  if (scaleHud) frame.append(scaleHud);
  main.append(frame);

  // พิกัดใต้เคอร์เซอร์ (lat/lon เมื่อตั้งค่าแล้ว · ไม่งั้นเป็น %) + ระยะของเส้นวัด
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
  };
  paintReadout(null);
  canvas.addEventListener('pointermove', (e) => paintReadout(ptOf(e)));
  canvas.addEventListener('pointerleave', () => paintReadout(null));

  // ล้อ = ซูมยึดเคอร์เซอร์ (แบบเกม · ผู้ใช้ขอให้คุมเหมือนแผนที่ในเกม) · Ctrl+ล้อ ก็ซูมเหมือนเดิม
  stage.addEventListener('wheel', (e) => {
    if (e.shiftKey) return;                              // Shift+ล้อ = เลื่อนแนวนอน (ของเบราว์เซอร์)
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    main._setZoom(zoomStep(view.zoom, e.deltaY < 0 ? 1 : -1),
      { x: (e.clientX - r.left) / (r.width || 1), y: (e.clientY - r.top) / (r.height || 1) });
  }, { passive: false });
  // คีย์บอร์ดบนแผนที่ (ตัวดักของ stage เอง — กฎข้อ 8): ลูกศร/WASD = เลื่อน · +/- = ซูม · Esc/Enter/Backspace ของโหมดวาด
  stage.tabIndex = 0;
  stage.addEventListener('keydown', async (e) => {
    // [alpha.167 · รอบต่อ] กันไว้ก่อน: คีย์ที่พิมพ์ในช่องกรอก/ตัวเลื่อนที่อยู่ในเวที ไม่ใช่ของแผนที่ (พิมพ์ "w" ≠ เลื่อนขึ้น)
    if (e.target !== stage && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const step = 60;
    if (view.zoneDraw) {
      if (e.key === 'Enter') { e.preventDefault(); await finishZone(cur, save, redraw); return; }
      if (e.key === 'Backspace') { e.preventDefault(); view.zoneDraw.points.pop(); redraw(); return; }
    }
    if (e.key === 'Escape' && (view.zoneDraw || view.measure || view.pick)) {
      e.preventDefault(); e.stopPropagation();
      if (view.pick) view.pick.resolve(null);
      view.zoneDraw = null; view.measure = null; redraw(); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { e.preventDefault(); stage.scrollLeft -= step; }
    else if (k === 'arrowright' || k === 'd') { e.preventDefault(); stage.scrollLeft += step; }
    else if (k === 'arrowup' || k === 'w') { e.preventDefault(); stage.scrollTop -= step; }
    else if (k === 'arrowdown' || k === 's') { e.preventDefault(); stage.scrollTop += step; }
    else if (k === '+' || k === '=') { e.preventDefault(); main._setZoom(zoomStep(view.zoom, 1)); }
    else if (k === '-') { e.preventDefault(); main._setZoom(zoomStep(view.zoom, -1)); }
  });

  // ── หยิบใส่: ตัวละคร/สถานที่ = หมุด · แผนที่ = ประตูไปแผนที่ย่อย · ฉาก = ผูกตำแหน่งฉาก · รูป = รูปแผนที่ ──
  bindDropTarget(stage, {
    accept: ['entity', 'map', 'scene', 'memo', 'gallery', 'image'],
    onDrop: async (payload, e) => {
      const r = canvas.getBoundingClientRect();
      const pt = { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
      const hitPin = e.target.closest && e.target.closest('.map-pin');
      await dropOnMap(cur, payload, pt, hitPin ? hitPin.dataset.pin : null);
    },
  });

  applyPinFilter(main);

  // ── รายการเส้นทาง (ข้อ 9) ──
  main.append(buildRoutesPanel(cur, redraw, save));

  // ── สรุป ──
  const st = pinStats(cur);
  main.append(el('div', 'map-foot',
    tf('ui.maps.portalSceneBindMap', st.entity, st.portal, st.note, hereScenes.length)
    + (counts[''] ? tf('ui.maps.scenePin', counts['']) : '')));

  // คืนตำแหน่งเลื่อน (วาดใหม่ทั้งแผงทุกครั้งที่แก้ — ต้องไม่เด้งกลับมุมซ้ายบน)
  if (view.focusPin) setTimeout(scrollFocusIntoView, 0);
  else if (keepScroll) requestAnimationFrame(() => { stage.scrollLeft = keepScroll.l; stage.scrollTop = keepScroll.t; });
  if (view.pick || view.zoneDraw || view.measure) requestAnimationFrame(() => stage.focus({ preventScroll: true }));
}

/** แถบสถานะของโหมดพิเศษ — บอกว่ากำลังทำอะไร + ปุ่มเสร็จ/ยกเลิก */
function buildModeBar(cur, redraw, save) {
  if (!view.pick && !view.zoneDraw && !view.measure) return null;
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
    const ok = el('button', 'cmp-mini k-ok', t('ui.maps.done'));
    ok.onclick = () => finishZone(cur, save, redraw);
    const c = el('button', 'cmp-mini k-cancel', t('ui.common.cancel'));
    c.onclick = () => { view.zoneDraw = null; redraw(); };
    rb.append(u, c, ok);
  } else if (view.measure) {
    const m = pathMeters(cur, view.measure.points);
    rb.append(el('span', null, tf('ui.maps.measuring', view.measure.points.length,
      m != null ? distText(niceDistance(m)) : t('ui.maps.measureNeedScale'))));
    if (m != null && m > 0) rb.append(el('span', 'dim', travelText(m, true)));
    const c = el('button', 'cmp-mini k-ok k-cancel', t('ui.maps.done'));
    c.onclick = () => { view.measure = null; redraw(); };
    rb.append(c);
  }
  return rb;
}

/** ซ้ายบนของแผนที่: ป้ายชื่อ · โหมด 3 แบบ · เครื่องมือใหม่ (วัดระยะ/โซน) · ขนาดหมุด */
function buildToolRail(cur, redraw, save) {
  const tools3 = el('div', 'map-tools3 map-hud map-hud-rail');
  const lblBtn = el('button', 'cmp-mini map-ov-btn' + (view.showLabels ? ' on' : ''), t('ui.maps.showItemFilm'));
  lblBtn.title = t('ui.maps.showHideLabelUnder');
  lblBtn.onclick = () => { view.showLabels = !view.showLabels; redraw(); };
  tools3.append(lblBtn);
  tools3.append(el('span', 'map-tool-sep', ''));
  for (const tdef of MAP_TOOLS) {
    const b = el('button', 'cmp-mini map-tool-btn' + (view.tool === tdef.id ? ' on' : ''), tdef.icon + ' ' + tdef.label);
    b.dataset.tool = tdef.id;
    b.title = tdef.hint;
    b.onclick = () => { view.tool = tdef.id; view.routeEdit = null; redraw(); };
    tools3.append(b);
  }
  tools3.append(el('span', 'map-tool-sep', ''));
  const meas = el('button', 'cmp-mini map-tool-x' + (view.measure ? ' on' : ''), gi('tape-measure') + ' ' + t('ui.maps.measure'));
  meas.dataset.x = 'measure';
  meas.title = t('ui.maps.measureTip');
  meas.onclick = () => { view.measure = view.measure ? null : { points: [] }; view.zoneDraw = null; redraw(); };
  const zb = el('button', 'cmp-mini map-tool-x' + (view.zoneDraw ? ' on' : ''), gi('vector-polygon') + ' ' + t('ui.maps.zone'));
  zb.dataset.x = 'zone';
  zb.title = t('ui.maps.zoneTip');
  zb.onclick = () => { if (view.zoneDraw) { view.zoneDraw = null; redraw(); } else startZoneDraw(cur, null); };
  tools3.append(meas, zb);
  tools3.append(el('span', 'map-tool-sep', ''));
  const curScale = pinScaleOf(cur);
  const psOut = el('button', 'cmp-mini', gi('minus-thick')); psOut.title = t('ui.maps.collapsePin');
  const psIn = el('button', 'cmp-mini', gi('plus-thick')); psIn.title = t('ui.maps.expandPin');
  const psLbl = el('span', 'map-zoom-label', Math.round(curScale * 100) + '%');
  const setScale = async (v) => {
    cur.pinScale = Math.max(PIN_SCALE_MIN, Math.min(PIN_SCALE_MAX, +v.toFixed(2)));
    await save(); redraw();
  };
  psOut.onclick = () => setScale(curScale - PIN_SCALE_STEP);
  psIn.onclick = () => setScale(curScale + PIN_SCALE_STEP);
  tools3.append(el('span', 'map-tool-lbl', t('ui.maps.sizePin')), psOut, psLbl, psIn);
  return tools3;
}

/** ล่างของแผนที่: ซูม · โอเวอร์เลย์ · เส้นทาง — ปุ่มยังเป็นชุดเดิม (เทส/ความเคยชินของผู้ใช้) */
function buildZoomHud(cur, main, stage, redraw, save, ov) {
  const tools2 = el('div', 'map-tools2 map-hud map-hud-bottom');
  const zOut = el('button', 'cmp-mini', gi('minus-thick')); zOut.title = t('ui.maps.zoomOutCtrlWheel');
  const zIn = el('button', 'cmp-mini', gi('plus-thick')); zIn.title = t('ui.maps.zoomInCtrlWheel');
  const zSlider = el('input', 'map-zoom-slider'); zSlider.type = 'range';
  zSlider.min = String(MAP_ZOOM_MIN); zSlider.max = String(MAP_ZOOM_MAX); zSlider.step = String(MAP_ZOOM_STEP);
  zSlider.value = String(view.zoom);
  zSlider.title = t('ui.maps.zoomSliderTip');
  const zLabel = el('span', 'map-zoom-label', Math.round(view.zoom * 100) + '%');
  // [alpha.71 ข้อ 1] ซูมโดยยึดจุด (กลางจอ หรือใต้เคอร์เซอร์) — ไม่ต้องวาดใหม่ทั้งแผง
  const setZoom = (z, anchor) => {
    const cv = stage.querySelector('.map-canvas');
    const before = { w: stage.scrollWidth, h: stage.scrollHeight, l: stage.scrollLeft, t: stage.scrollTop };
    view.zoom = clampZoom(z);
    zSlider.value = String(view.zoom);
    zLabel.textContent = Math.round(view.zoom * 100) + '%';
    if (cv) cv.style.width = (view.zoom * 100) + '%';
    if (before.w) {
      const ax = anchor ? anchor.x : 0.5, ay = anchor ? anchor.y : 0.5;
      stage.scrollLeft = zoomScroll(before.l, stage.clientWidth, before.w, stage.scrollWidth, ax);
      stage.scrollTop = zoomScroll(before.t, stage.clientHeight, before.h, stage.scrollHeight, ay);
    }
    const sh = main.querySelector('.map-scalehud');
    if (sh && sh._update) sh._update();
  };
  main._setZoom = setZoom;
  zOut.onclick = () => setZoom(zoomStep(view.zoom, -1));
  zIn.onclick = () => setZoom(zoomStep(view.zoom, 1));
  zSlider.oninput = () => setZoom(zSlider.value);
  const zFit = el('button', 'cmp-mini', t('ui.common.fitScreen')); zFit.title = t('ui.maps.backSizeFitFrame');
  zFit.onclick = () => setZoom(1);
  tools2.append(el('span', 'map-tool-lbl', gi('search')), zOut, zSlider, zIn, zLabel, zFit);
  tools2.append(el('span', 'map-tool-sep', ''));
  const mkOv = (key, icon, label, tip) => {
    const b = el('button', 'cmp-mini map-ov-btn' + (ov[key] ? ' on' : ''), icon + ' ' + label);
    b.title = tip;
    b.onclick = async () => { toggleOverlay(cur, key); await save(); redraw(); };
    tools2.append(b);
  };
  mkOv('grid', gi('grid'), t('ui.maps.tableGrid'), t('ui.maps.gridTip'));
  mkOv('compass', gi('compass'), t('ui.maps.compass'), t('ui.maps.compassTip'));
  mkOv('scale', gi('ruler-straight'), t('ui.maps.part'), t('ui.maps.scaleTip'));
  if (ov.grid) {
    const gs = el('input', 'map-grid-size'); gs.type = 'number'; gs.min = '2'; gs.max = '50';
    gs.value = String(ov.gridSize); gs.title = t('ui.maps.countFieldGridNext');
    gs.onchange = async () => {
      cur.overlays = { ...ov, gridSize: Math.max(2, Math.min(50, parseInt(gs.value, 10) || 10)) };
      await save(); redraw();
    };
    tools2.append(gs);
  }
  if (ov.scale && !geoReady(cur).scale) {
    const sl = el('input', 'map-scale-lbl'); sl.value = ov.scaleLabel;
    sl.placeholder = t('ui.maps.gapBarEg'); sl.title = t('ui.maps.textUnderBarPart');
    sl.onchange = async () => { cur.overlays = { ...ov, scaleLabel: sl.value.trim() }; await save(); redraw(); };
    tools2.append(sl);
  }
  tools2.append(el('span', 'map-tool-sep', ''));
  const rtBtn = el('button', 'cmp-mini map-ov-btn' + (view.showRoutes ? ' on' : ''), t('ui.maps.route2'));
  rtBtn.title = t('ui.maps.showHideRouteBetween');
  rtBtn.onclick = () => { view.showRoutes = !view.showRoutes; redraw(); };
  tools2.append(rtBtn);
  return tools2;
}

/**
 * แถบมาตราส่วน (ลอยมุมซ้ายล่าง ไม่ย่อ/ขยายตามภาพ) — ตั้งมาตราส่วนจริงแล้ว = ยาวเท่าระยะจริงที่สวย (1-2-5)
 * และปรับตามซูม · ยังไม่ตั้ง = แถบตกแต่งตามข้อความที่ผู้ใช้พิมพ์ (แบบเดิม)
 */
function buildScaleHud(cur, ov, stage) {
  if (!ov.scale) return null;
  const sc = el('div', 'map-scalebar map-scalehud');
  const barEl = el('div', 'map-scalebar-bar');
  const lbl = el('div', 'map-scalebar-lbl', ov.scaleLabel || t('ui.maps.setGapField'));
  sc.append(barEl, lbl);
  const mpu = metersPerUnit(cur);
  sc._update = () => {
    if (mpu == null) return;
    const cv = stage.querySelector('.map-canvas');
    const pxPerU = (cv ? cv.getBoundingClientRect().width : stage.clientWidth * view.zoom) / 100;
    if (!pxPerU) return;
    const nb = niceScaleBar(mpu, 120 / pxPerU);
    if (!nb) return;
    barEl.style.width = Math.round(nb.units * pxPerU) + 'px';
    lbl.textContent = distText(niceDistance(nb.meters));
  };
  requestAnimationFrame(sc._update);
  return sc;
}

function buildRoutesPanel(cur, redraw, save) {
  const rsec = el('div', 'map-routes-panel');
  const rhead = el('div', 'map-routes-head');
  rhead.append(el('span', null, tf('ui.maps.route3', mapRoutes(cur).length)));
  const addR = el('button', 'cmp-mini', t('ui.maps.routeNew2'));
  addR.title = t('ui.maps.routeNewTip');
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
    row.append(sw);
    const pts = routePoints(cur, r);
    row.append(el('span', 'map-route-name', r.name));
    const real = pathMeters(cur, pts);
    row.append(el('span', 'map-route-meta', tf('ui.maps.dotGap', pts.length, routeLength(pts))
      + (real != null && pts.length > 1 ? ' · ' + distText(niceDistance(real)) + ' · ' + travelText(real) : '')));
    const bEdit = el('button', 'cmp-mini', r.id === view.routeEdit ? t('ui.maps.done') : t('ui.maps.nextDot'));
    bEdit.title = t('ui.maps.nextDotTip');
    bEdit.onclick = () => { view.routeEdit = view.routeEdit === r.id ? null : r.id; redraw(); };
    const bColor = el('button', 'cmp-mini', gi('palette'));
    bColor.title = t('ui.maps.recolorLine');
    bColor.onclick = async () => {
      const i = ROUTE_COLORS.indexOf(r.color);
      r.color = ROUTE_COLORS[(i + 1) % ROUTE_COLORS.length];
      await save(); redraw();
    };
    const bDash = el('button', 'cmp-mini' + (r.dashed ? ' on' : ''), gi('line-dash'));
    bDash.title = t('ui.maps.lineLineSolid');
    bDash.onclick = async () => { r.dashed = !r.dashed; await save(); redraw(); };
    const bRen = el('button', 'cmp-mini', gi('pencil'));
    bRen.title = t('ui.maps.changeNameRoute');
    bRen.onclick = async () => { const v = await ask(t('ui.maps.nameRoute'), { value: r.name }); if (!v) return;
      r.name = v.trim(); await save(); redraw(); };
    const bDel = el('button', 'cmp-mini k-danger', gi('trash'));
    bDel.title = t('ui.maps.delRoutePin');
    bDel.onclick = async () => {
      if (!(await confirmBox(tf('ui.maps.delRoutePinNot', r.name), t('ui.common.del')))) return;
      deleteRoute(cur, r.id);
      if (view.routeEdit === r.id) view.routeEdit = null;
      await save(); redraw();
    };
    row.append(bEdit, bColor, bDash, bRen, bDel);
    rsec.append(row);
  }
  if (!mapRoutes(cur).length) rsec.append(el('div', 'dim map-route-empty', t('ui.maps.routeDragLineLink')));
  return rsec;
}

// ═══════════════════════ หยิบใส่แผนที่ ═══════════════════════
async function placeEntity(cur, e, x, y) {
  const S = mapsState_C.s;
  const ex = (cur.pins || []).find((p) => p.kind === 'entity' && p.entityFile === e.file);
  if (ex) { ex.x = clamp(x); ex.y = clamp(y); setStatus(tf('ui.maps.entMoved', e.name)); }
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
  view.measure = null;
  setStatus(t('ui.maps.zoneDrawHint'));
  if (view.gallery) enterMap(cur.id); else refresh();
}
async function finishZone(cur, save, redraw) {
  const d = view.zoneDraw;
  if (!d) return;
  if (d.points.length < 3) { setStatus(t('ui.maps.zoneNeed3')); return; }
  let name = d.name;
  if (!name) {
    name = await ask(t('ui.maps.zoneName'), { value: '' });
    if (name == null) return;
  }
  const z = newZone(d.points, { name: String(name || '').trim(), entityFile: d.entityFile, color: d.color });
  cur.zones = [...(cur.zones || []), z];
  view.zoneDraw = null; view.selZone = z.id;
  await save();
  const area = niceArea(zoneAreaM2(cur, z));
  setStatus(tf('ui.maps.zoneDone', z.name || '') + (area ? ' · ' + areaText(area) : ''));
  redraw();
}
function zoneMenu(cur, z, x, y) {
  const S = mapsState_C.s;
  const saveR = async () => { await saveMaps(S.data); refresh(); };
  popupMenu(x, y, [
    { label: '<b>' + escHtml(z.name || t('ui.common.notNamed')) + '</b>', disabled: true },
    z.entityFile ? { label: t('ui.maps.entOpenWiki'), click: () => openEntity(z.entityFile) } : null,
    { label: t('ui.maps.zoneRename'), click: async () => {
      const v = await ask(t('ui.maps.zoneName'), { value: z.name || '' }); if (v == null) return;
      z.name = String(v).trim(); await saveR(); } },
    { label: t('ui.maps.zoneRecolor'), click: async () => {
      const i = ZONE_COLORS.indexOf(z.color); z.color = ZONE_COLORS[(i + 1) % ZONE_COLORS.length]; await saveR(); } },
    { label: t('ui.maps.zoneEditPts'), click: () => { view.selZone = z.id; view.tool = 'edit'; refresh(); } },
    '-',
    { label: t('ui.maps.zoneDelete'), danger: true, click: async () => {
      if (!(await confirmBox(tf('ui.maps.zoneDeleteQ', z.name || ''), t('ui.common.del')))) return;
      deleteZone(cur, z.id); if (view.selZone === z.id) view.selZone = null; await saveR(); } },
  ].filter(Boolean));
}
function zoneVertex(cur, z, i, canvas, save, redraw) {
  const v = el('div', 'map-zone-vtx');
  v.style.left = z.points[i].x + '%'; v.style.top = z.points[i].y + '%';
  v.title = t('ui.maps.zoneVertexTip');
  v.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const p0 = { ...z.points[i] };
    let moved = false;
    const put = (pt) => {
      z.points[i] = pt;
      v.style.left = pt.x + '%'; v.style.top = pt.y + '%';
      const path = canvas.querySelector(`.map-zone[data-zone="${z.id}"]`);
      if (path) path.setAttribute('d', zonePath(z.points));
    };
    const mv = (ev) => {
      moved = true;
      put({ x: clamp(((ev.clientX - r.left) / r.width) * 100), y: clamp(((ev.clientY - r.top) / r.height) * 100) });
    };
    const offEsc = escCancelDrag(() => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      put(p0);
    });
    const up = async () => {
      offEsc();
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (moved) { await save(); redraw(); }       // คลิกเฉย ๆ ไม่ต้องเขียนไฟล์/วาดใหม่
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  v.oncontextmenu = async (e) => {           // คลิกขวาจุดยอด = ลบจุดนั้น (เหลืออย่างน้อย 3)
    e.preventDefault(); e.stopPropagation();
    if (z.points.length <= 3) { setStatus(t('ui.maps.zoneNeed3')); return; }
    z.points.splice(i, 1); await save(); redraw();
  };
  return v;
}

// ═══════════════════════ พิกัดจริง / มาตราส่วน ═══════════════════════
/** หน้าต่างเล็กตั้งค่าพิกัด: 1) มาตราส่วน 2) จุดอ้างอิงละติจูด/ลองจิจูด 3) ทิศเหนือ */
export function openGeoPanel(cur) {
  document.querySelectorAll('.map-geo-pop').forEach((n) => n.remove());
  const S = mapsState_C.s;
  const pop = el('div', 'map-geo-pop');
  pop.setAttribute('role', 'dialog');
  const save = async () => { await saveMaps(S.data); refresh(); paint(); };
  const close = () => { pop.remove(); refresh(); };
  const paint = () => {
    pop.replaceChildren();
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
    s1.append(el('div', 'map-geo-desc', g.scale
      ? tf('ui.maps.geoScaleNow', distText(niceDistance(g.scale.meters)))
      : t('ui.maps.geoScaleDesc')));
    const b1 = el('button', 'cmp-mini k-ok', gi('ruler-straight') + ' ' + (g.scale ? t('ui.maps.geoRedo') : t('ui.maps.geoPickScale')));
    b1.title = t('ui.maps.geoPickScaleTip');
    b1.onclick = async () => {
      const a = await pickPoint('scaleA', t('ui.maps.geoPickA'));
      if (!a) return paint();
      const b = await pickPoint('scaleB', t('ui.maps.geoPickB'));
      if (!b) return paint();
      const v = await ask(t('ui.maps.geoAskMeters'), { value: g.scale ? String(g.scale.meters) : '100',
        placeholder: t('ui.maps.geoAskMetersPh') });
      const meters = parseDistance(v);
      if (!(meters > 0)) { setStatus(t('ui.maps.geoBadNumber')); return paint(); }
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
      if (!p) return paint();
      const v = await ask(t('ui.maps.geoAskLatLon'), { value: g.ref ? g.ref.lat + ', ' + g.ref.lon : '',
        placeholder: t('ui.maps.geoAskLatLonPh') });
      const ll = parseLatLon(v);
      if (!ll) { setStatus(t('ui.maps.geoBadLatLon')); return paint(); }
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
        if (!p || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) { setStatus(t('ui.maps.geoOutside')); return; }
        const pin = newPin(p.x, p.y);
        const res = await pinDialog(pin, S.data.maps, cur.id);
        if (!res) return;
        cur.pins.push(res); await save();
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
  };
  paint();
  document.body.append(pop);
  refresh();
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

// ═══════════ ส่งออก PNG / พิมพ์ (ข้อ 5) ═══════════

/** วาดแผนที่ + โซน + โอเวอร์เลย์ + เส้นทาง + หมุด ลง <canvas> แล้วคืน canvas (ใช้ทั้งส่งออกและพิมพ์) */
async function drawMapToCanvas(map) {
  const W0 = 1400;
  let img = null;
  if (map.image) {
    img = new Image();
    const src = mapImgURL(map.image);
    await new Promise((res) => { img.onload = res; img.onerror = () => { img = null; res(); }; img.src = src; });
  }
  const iw = (img && img.naturalWidth) || W0;
  const ih = (img && img.naturalHeight) || Math.round(W0 * 0.66);
  const scale = Math.min(2, Math.max(1, W0 / iw));       // ภาพเล็กก็ยังได้ไฟล์คมพอใช้
  const cv = document.createElement('canvas');
  cv.width = Math.round(iw * scale); cv.height = Math.round(ih * scale);
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const PX = (x) => (x / 100) * W, PY = (y) => (y / 100) * H;

  ctx.fillStyle = PRINT.paper; ctx.fillRect(0, 0, W, H);
  if (img) ctx.drawImage(img, 0, 0, W, H);

  // โซนชั้นล่างสุด (เหมือนบนจอ)
  for (const z of mapZones(map)) {
    ctx.save();
    ctx.beginPath();
    z.points.forEach((p, i) => (i ? ctx.lineTo(PX(p.x), PY(p.y)) : ctx.moveTo(PX(p.x), PY(p.y))));
    ctx.closePath();
    ctx.globalAlpha = 0.22; ctx.fillStyle = z.color || ZONE_COLORS[0]; ctx.fill();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 2 * scale; ctx.strokeStyle = z.color || ZONE_COLORS[0]; ctx.stroke();
    ctx.restore();
    if (z.name) {
      const c = polygonCentroid(z.points);
      ctx.save(); ctx.font = `bold ${Math.round(15 * scale)}px "Sarabun", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = PRINT.label; ctx.fillText(z.name, PX(c.x), PY(c.y));
      ctx.restore();
    }
  }

  const ov = mapOverlays(map);
  if (ov.grid) {
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(1, scale);
    for (const p of gridLines(ov.gridSize)) {
      ctx.beginPath(); ctx.moveTo(PX(p), 0); ctx.lineTo(PX(p), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, PY(p)); ctx.lineTo(W, PY(p)); ctx.stroke();
    }
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

  const fs = Math.round(15 * scale);
  ctx.textBaseline = 'middle';
  for (const pin of map.pins || []) {
    const x = PX(pin.x), y = PY(pin.y), rad = 9 * scale;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = pin.color || (pin.kind === 'portal' ? PRINT.pinPortal : pin.kind === 'entity' ? PRINT.pinEntity : PRINT.pinDefault);
    ctx.fill();
    ctx.lineWidth = 2 * scale; ctx.strokeStyle = PRINT.paper; ctx.stroke();
    if (pin.label) {
      ctx.font = `${fs}px "Sarabun", sans-serif`;
      const tw = ctx.measureText(pin.label).width;
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.fillRect(x + rad + 3 * scale, y - fs * 0.75, tw + 8 * scale, fs * 1.5);
      ctx.fillStyle = PRINT.label;
      ctx.fillText(pin.label, x + rad + 7 * scale, y);
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
    // ตั้งมาตราส่วนจริงแล้ว = แถบยาวตามระยะจริงที่สวย · ยังไม่ตั้ง = 18% ของภาพตามข้อความของผู้ใช้
    const mpu = metersPerUnit(map, iw / ih);
    const nb = mpu ? niceScaleBar(mpu, 18) : null;
    const bw = nb ? (nb.units / 100) * W : W * 0.18, bx = 40 * scale, by = H - 55 * scale, bh = 9 * scale;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(bx - 6 * scale, by - 6 * scale, bw + 12 * scale, bh + 30 * scale);
    ctx.fillStyle = PRINT.ink; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = PRINT.paper; ctx.fillRect(bx + bw / 4, by + 1, bw / 4, bh - 2);
    ctx.fillStyle = PRINT.ink; ctx.font = `${Math.round(13 * scale)}px "Sarabun", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(nb ? distText(niceDistance(nb.meters)) : (ov.scaleLabel || ''), bx, by + bh + 12 * scale);
    ctx.restore();
  }
  return cv;
}

function safeFileName(s) { return String(s || 'map').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'map'; }

export async function exportMapPng(map) {
  try {
    const cv = await drawMapToCanvas(map);
    const b64 = cv.toDataURL('image/png').split(',')[1];
    const dir = await kapi.join(state.root, 'Images');
    const name = await kapi.writeImageData(dir, safeFileName(map.name) + '-map.png', b64);
    setStatus(t('ui.maps.saveMapLibraryImage') + (typeof name === 'string' ? name : 'map.png'));
    return true;
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
