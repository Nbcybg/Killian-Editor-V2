// maps-ui.js — แผนที่ (UI): เปิด/วาดแผนที่ · หมุด · ลำดับชั้นโลก→เมือง→ห้อง
// [alpha.70] ยกเครื่อง: ซูม · โอเวอร์เลย์ (กริด/เข็มทิศ/มาตราส่วน) · ค้นหาหมุด · เลือกหลายหมุด
//            · คัดลอก-วางข้ามแผนที่ · เส้นทาง · หมวดแผนที่ · ส่งออก PNG/พิมพ์ · ป้ายจำนวนฉากบนหมุด
import { tf } from './i18n.js';
import { addMapFlow, loadMaps, mapImgURL, mapsState_C, pinDialog, saveMaps } from './app.js';
import { $, el, state, setStatus, log, t } from './core.js';
import { pickImage } from './gallery.js';
import {
  PIN_KIND, ROUTE_COLORS, breadcrumb, clamp, clampZoom, clonePins, deleteMap, deletePins, deleteRoute,
  filterPins, findMap, gridLines, groupMaps, mapOverlays, mapRoutes, matchPin, movePins, newPin, newRoute,
  pinStats, routeLength, routePath, routePoints, scenePinCounts, scenesForMap, sortMaps, toggleOverlay,
  zoomStep, zoomScroll, MAP_ZOOM_MAX, MAP_ZOOM_MIN, MAP_ZOOM_STEP,
} from './maps.js';
import { entityPortrait } from './wiki-profile.js';
import { ask, confirmBox } from './ui.js';
import { openEntity } from './wiki-ui.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { collectPlacedScenes } from './floorplan-ui.js';

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
  // [alpha.71 ข้อ 3] โหมดเครื่องมือ — เดิมคลิกหมุดแล้ว "แก้ไขเลย" ทั้งที่ผู้ใช้แค่อยากดู
  //   open = คลิกเพื่อเปิดลิงก์/ดู · edit = คลิกเพื่อแก้ · move = ลากย้าย (โหมดอื่นลากไม่ได้)
  tool: 'open',
  showLabels: true,      // ปุ่ม "แสดงตัวหนังสือ"
};
let scenesCache = null;              // ฉากที่ปักหมุดทั้งโปรเจกต์ (โหลดครั้งเดียวต่อรอบเปิดแผง)
let portraitCache = null;            // entityFile → ชื่อไฟล์รูปประจำตัว (ข้อ 2)

export const MAP_TOOLS = [
  { id: 'open', icon: '👆', label: t('ui.common.openView'), hint: t('ui.maps.clickPinOpenLink') },
  { id: 'edit', icon: '✎', label: t('ui.common.edit'), hint: t('ui.maps.clickPinOpenDialog') },
  { id: 'move', icon: '✥', label: t('ui.common.movePos'), hint: t('ui.maps.dragPinMoveMode') },
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
  view.showLabels = true; scenesCache = null; portraitCache = null;
}

/** entityFile → รูปประจำตัว · อ่านครั้งเดียวต่อรอบเปิดแผง (ข้อ 2) */
async function loadPortraits() {
  if (portraitCache) return portraitCache;
  portraitCache = new Map();
  try {
    const { loadAllEntities } = await import('./app.js');
    for (const e of await loadAllEntities()) if (e.file && e.image) portraitCache.set(e.file, e.image);
  } catch (e) { log('warn', t('ui.maps.mapsReadImagePortrait'), e); }
  return portraitCache;
}

// บั๊ก #18: แผนที่เป็นแผง ไม่ใช่แท็บเอกสาร
export async function openMaps() {
  showPanel('maps');                   // hook ใน app.js เริ่มวาดให้ · await ตัวเดียวกันต่อ
  return renderMapsPanel();
}

/** โหลด maps.json + วาดลง #maps-body — ห้ามเรียก showPanel ในนี้ (วนซ้ำกับ hook) */
export async function renderMapsPanel() {
  // โหลดใหม่ทุกครั้ง (ไฟล์แก้นอกโปรแกรมได้) แต่คงแผนที่ที่ดูค้างไว้ถ้ายังมีอยู่
  const keepId = mapsState_C.s?.currentId || null;
  mapsState_C.s = { data: await loadMaps(), currentId: null };
  const all = mapsState_C.s.data.maps;
  mapsState_C.s.currentId = (keepId && all.some((m) => m.id === keepId)) ? keepId
                          : (all.length ? sortMaps(all)[0].id : null);
  // แคชทั้งสองตัวผูกกับ "ของในโปรเจกต์" ที่แก้นอกแผงได้ (ปักฉาก/ตั้งรูปประจำตัวใน Wiki)
  // → ล้างทุกครั้งที่โหลดแผงใหม่ ไม่งั้นรูปที่เพิ่งตั้งใน Wiki ไม่ขึ้นจนกว่าจะปิดเปิดโปรแกรม
  scenesCache = null; portraitCache = null;
  return renderMaps($('#maps-body'));
}
/** วาดแผงแผนที่ใหม่ถ้าเปิดอยู่ — เรียกหลังบันทึกหน้า Wiki (รูปประจำตัวบนหมุดต้องเปลี่ยนตาม) */
export function refreshMapsIfOpen() {
  if (!isPanelOpen('maps') || !mapsState_C.s || !$('#maps-body')) return;
  portraitCache = null;
  renderMaps($('#maps-body'));
}

/**
 * เปิดแผนที่แล้วเพ่งไปที่หมุด/พิกัดที่กำหนด — ใช้จากปุ่ม "ดูบนแผนที่" ในคุณสมบัติฉาก
 * @param {string} mapId  แผนที่ปลายทาง
 * @param {string|null} pinId  หมุดที่ต้องการเพ่ง (ไม่มีก็ได้ ถ้าฉากปักพิกัดลอย)
 * @param {{x:number,y:number}|null} at  พิกัดสำรองเมื่อไม่มีหมุด
 */
export async function focusMapPin(mapId, pinId, at) {
  showPanel('maps');
  const keepZoom = view.zoom;
  await renderMapsPanel();
  const S = mapsState_C.s;
  if (!S || !findMap(S.data.maps, mapId)) { setStatus(t('ui.maps.notFoundMapScene')); return false; }
  S.currentId = mapId;
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
 * คืน null เมื่อฉากยังไม่ได้ปักตำแหน่ง · คืน {missing:true} เมื่อแผนที่ที่ผูกไว้ถูกลบไปแล้ว
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

/**
 * แถว "ตำแหน่งบนแผนที่" สำหรับกล่อง/แผงคุณสมบัติฉาก — ใช้ร่วมทั้งสองที่ (บทเรียน 50)
 * มีปุ่ม "🗺 ดูบนแผนที่" กระโดดไปแผนที่ + เพ่งหมุดนั้น · ถ้ายังไม่ปักก็ชวนไปปักที่ผังพื้นที่
 */
export async function buildShowOnMapRow(row) {
  const loc = await sceneMapLocation(row);
  const r = el('div', 'wiki-row props-maprow');
  r.append(el('label', null, t('ui.maps.sceneWhere')));
  const box = el('div', 'props-maprow-body');
  if (!loc) {
    box.append(el('span', 'dim', t('ui.maps.notPlaced')));
    const b = el('button', 'cmp-mini', '📌 ' + t('ui.maps.placeIt'));
    b.title = t('ui.maps.placeItHint');
    b.onclick = async () => { const { openFloorPlan } = await import('./floorplan-ui.js'); await openFloorPlan(); };
    box.append(b);
  } else if (loc.missing) {
    box.append(el('span', 'dim', loc.text));
  } else {
    box.append(el('span', 'props-mapwhere', '📍 ' + loc.text));
    const b = el('button', 'cmp-mini k-ok props-mapbtn', '🗺 ' + t('ui.maps.showOnMap'));
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

export async function renderMaps(pane) {
  if (!pane) return;
  pane.innerHTML = '';
  const S = mapsState_C.s;
  if (!S) return;
  const maps = S.data.maps;
  const wrap = el('div', 'map-wrap'); pane.append(wrap);

  // แถบหัว: ชื่อ + ปุ่มเพิ่มแผนที่ + ช่องค้นหาหมุด
  const head = el('div', 'map-head');
  head.append(el('div', 'map-title', t('ui.common.map3')));
  const addBtn = el('button', 'k-ok', t('ui.maps.addMap'));
  addBtn.onclick = () => addMapFlow();
  head.append(addBtn);
  wrap.append(head);

  if (!maps.length) {
    wrap.append(el('div', 'map-empty',
      t('ui.maps.notPlannedPressAdd')));
    return;
  }

  // ค้นหาหมุด (ข้อ 7) — อยู่บนหัวเพราะใช้ข้ามแผนที่
  const search = el('input', 'map-search'); search.type = 'search';
  search.placeholder = t('ui.maps.searchPinName'); search.value = view.q;
  search.oninput = () => { view.q = search.value; applyPinFilter(wrap); };
  head.append(search);

  // ── แถบเลือกแผนที่ (chips) จัดกลุ่มตามหมวด (ข้อ 8) ──
  const groups = groupMaps(maps);
  if (groups.length > 1) {
    const catBar = el('div', 'map-catbar');
    const mkCat = (label, val) => {
      const c = el('div', 'map-cat' + (view.catFilter === val ? ' on' : ''), label);
      c.onclick = () => { view.catFilter = val; renderMaps(pane); };
      catBar.append(c);
    };
    mkCat(t('ui.common.all'), null);
    for (const g of groups) mkCat((g.cat || t('ui.common.notSpecifyCat')) + ' · ' + g.maps.length, g.cat);
    wrap.append(catBar);
  }

  const bar = el('div', 'map-bar');
  const shown = groups.filter((g) => view.catFilter === null || g.cat === view.catFilter);
  for (const g of shown) {
    if (groups.length > 1) bar.append(el('div', 'map-bar-cat', g.cat || t('ui.common.notSpecifyCat')));
    const row = el('div', 'map-bar-row');
    for (const m of g.maps) {
      const chip = el('div', 'map-chip' + (m.id === S.currentId ? ' on' : ''), m.name);
      const st = pinStats(m);
      if (st.portal) chip.append(el('span', 'map-chip-badge', '🚪' + st.portal));
      chip.onclick = () => { S.currentId = m.id; view.sel.clear(); view.routeEdit = null; view.focusPin = null; renderMaps(pane); };
      row.append(chip);
    }
    bar.append(row);
  }
  wrap.append(bar);

  // แผนที่ปัจจุบันต้องอยู่ในหมวดที่กรองไว้ ไม่งั้นผู้ใช้กรองแล้วเห็นแผนที่ที่ไม่ได้อยู่ในรายการ
  let cur = findMap(maps, S.currentId);
  if (!cur || (view.catFilter !== null && String(cur.category || '').trim() !== view.catFilter)) {
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
      a.onclick = () => { S.currentId = c.id; view.sel.clear(); renderMaps(pane); };
      bc.append(a);
    });
    wrap.append(bc);
  }

  const redraw = () => renderMaps(pane);
  const save = async () => { await saveMaps(S.data); };

  // ── แถบเครื่องมือแผนที่ปัจจุบัน ──
  const tools = el('div', 'map-tools');
  const nameInp = el('input', 'map-name-inp'); nameInp.value = cur.name;
  nameInp.title = t('ui.common.nameMap');
  nameInp.onchange = async () => { cur.name = nameInp.value.trim() || cur.name; await save(); redraw(); };
  tools.append(nameInp);
  // หมวด (ข้อ 8) — พิมพ์ชื่อหมวดเอง มี datalist ของหมวดที่มีอยู่แล้ว
  const catInp = el('input', 'map-cat-inp'); catInp.value = cur.category || '';
  catInp.placeholder = t('ui.maps.catEgWorldCurrent'); catInp.title = t('ui.maps.catMapSkipEmpty');
  catInp.setAttribute('list', 'map-cat-list');
  const dl = el('datalist'); dl.id = 'map-cat-list';
  for (const g of groups) if (g.cat) { const o = el('option'); o.value = g.cat; dl.append(o); }
  catInp.onchange = async () => { cur.category = catInp.value.trim(); await save(); redraw(); };
  tools.append(catInp, dl);
  const chgImg = el('button', 'cmp-mini', t('ui.maps.changeImage'));
  chgImg.onclick = async () => { const it = await pickImage(state.root); if (!it) return;
    cur.image = 'Images/' + it.file; await save(); redraw(); };
  tools.append(chgImg);
  const expBtn = el('button', 'cmp-mini', t('ui.common.exportPNG'));
  expBtn.title = t('ui.maps.saveMapReadyPin');
  expBtn.onclick = () => exportMapPng(cur, S.data.maps);
  tools.append(expBtn);
  const prnBtn = el('button', 'cmp-mini', t('ui.maps.print'));
  prnBtn.onclick = () => printMap(cur, S.data.maps);
  tools.append(prnBtn);
  const delMap = el('button', 'cmp-mini k-danger', t('ui.maps.delMap'));
  delMap.onclick = async () => {
    if (!(await confirmBox(tf('ui.common.delMap', cur.name), t('ui.common.del')))) return;
    S.data.maps = deleteMap(maps, cur.id); S.currentId = S.data.maps[0]?.id || null;
    view.sel.clear(); await save(); redraw();
  };
  tools.append(delMap);
  wrap.append(tools);

  // ── แถบซูม + โอเวอร์เลย์ (ข้อ 3, 4) ──
  const ov = mapOverlays(cur);
  const tools2 = el('div', 'map-tools2');
  const zOut = el('button', 'cmp-mini', '➖'); zOut.title = t('ui.maps.zoomOutCtrlWheel');
  const zIn = el('button', 'cmp-mini', '➕'); zIn.title = t('ui.maps.zoomInCtrlWheel');
  const zSlider = el('input', 'map-zoom-slider'); zSlider.type = 'range';
  zSlider.min = String(MAP_ZOOM_MIN); zSlider.max = String(MAP_ZOOM_MAX); zSlider.step = String(MAP_ZOOM_STEP);
  zSlider.value = String(view.zoom);
  const zLabel = el('span', 'map-zoom-label', Math.round(view.zoom * 100) + '%');
  // [alpha.71 ข้อ 1] ซูมโดยยึด "จุดกึ่งกลางจอ" — เดิมขยายผืนแผนที่เฉย ๆ ภาพจึงโตออกจากมุมซ้ายบน
  // และสิ่งที่ผู้ใช้กำลังดูอยู่ตรงกลางหลุดออกนอกจอทุกครั้งที่ซูมเข้า
  const setZoom = (z, anchor) => {
    const st = wrap.querySelector('.map-stage');
    const cv = wrap.querySelector('.map-canvas');
    const before = st ? { w: st.scrollWidth, h: st.scrollHeight, l: st.scrollLeft, t: st.scrollTop } : null;
    view.zoom = clampZoom(z);
    zSlider.value = String(view.zoom);
    zLabel.textContent = Math.round(view.zoom * 100) + '%';
    if (cv) cv.style.width = (view.zoom * 100) + '%';
    if (st && before && before.w) {
      const ax = anchor ? anchor.x : 0.5, ay = anchor ? anchor.y : 0.5;
      st.scrollLeft = zoomScroll(before.l, st.clientWidth, before.w, st.scrollWidth, ax);
      st.scrollTop = zoomScroll(before.t, st.clientHeight, before.h, st.scrollHeight, ay);
    }
  };
  zOut.onclick = () => setZoom(zoomStep(view.zoom, -1));
  zIn.onclick = () => setZoom(zoomStep(view.zoom, 1));
  zSlider.oninput = () => setZoom(zSlider.value);
  const zFit = el('button', 'cmp-mini', t('ui.common.fitScreen')); zFit.title = t('ui.maps.backSizeFitFrame');
  zFit.onclick = () => setZoom(1);
  tools2.append(el('span', 'map-tool-lbl', '🔍'), zOut, zSlider, zIn, zLabel, zFit);
  tools2.append(el('span', 'map-tool-sep', ''));
  const mkOv = (key, icon, label) => {
    const b = el('button', 'cmp-mini map-ov-btn' + (ov[key] ? ' on' : ''), icon + ' ' + label);
    b.onclick = async () => { toggleOverlay(cur, key); await save(); redraw(); };
    tools2.append(b);
  };
  mkOv('grid', '▦', t('ui.maps.tableGrid'));
  mkOv('compass', '🧭', t('ui.maps.compass'));
  mkOv('scale', '📏', t('ui.maps.part'));
  if (ov.grid) {
    const gs = el('input', 'map-grid-size'); gs.type = 'number'; gs.min = '2'; gs.max = '50';
    gs.value = String(ov.gridSize); gs.title = t('ui.maps.countFieldGridNext');
    gs.onchange = async () => {
      cur.overlays = { ...ov, gridSize: Math.max(2, Math.min(50, parseInt(gs.value, 10) || 10)) };
      await save(); redraw();
    };
    tools2.append(gs);
  }
  if (ov.scale) {
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
  wrap.append(tools2);

  // ── [alpha.71 ข้อ 3] แถบเครื่องมือหมุด: แสดงตัวหนังสือ · เปิด/แก้ไข/ย้าย · ขยาย-ย่อ ──
  const tools3 = el('div', 'map-tools3');
  const lblBtn = el('button', 'cmp-mini map-ov-btn' + (view.showLabels ? ' on' : ''), t('ui.maps.showItemFilm'));
  lblBtn.title = t('ui.maps.showHideLabelUnder');
  lblBtn.onclick = () => { view.showLabels = !view.showLabels; redraw(); };
  tools3.append(lblBtn);
  tools3.append(el('span', 'map-tool-sep', ''));
  for (const tdef of MAP_TOOLS) {
    const b = el('button', 'cmp-mini map-tool-btn' + (view.tool === tdef.id ? ' on' : ''),
                 tdef.icon + ' ' + tdef.label);
    b.dataset.tool = tdef.id;
    b.title = tdef.hint;
    b.onclick = () => { view.tool = tdef.id; view.routeEdit = null; redraw(); };
    tools3.append(b);
  }
  tools3.append(el('span', 'map-tool-sep', ''));
  // ขยาย/ย่อหมุด (รวมรูปประจำตัวของเอนทิตี้) — บันทึกต่อแผนที่
  const curScale = pinScaleOf(cur);
  const psOut = el('button', 'cmp-mini', '➖'); psOut.title = t('ui.maps.collapsePin');
  const psIn = el('button', 'cmp-mini', '➕'); psIn.title = t('ui.maps.expandPin');
  const psLbl = el('span', 'map-zoom-label', Math.round(curScale * 100) + '%');
  const setScale = async (v) => {
    cur.pinScale = Math.max(PIN_SCALE_MIN, Math.min(PIN_SCALE_MAX, +v.toFixed(2)));
    await save(); redraw();
  };
  psOut.onclick = () => setScale(curScale - PIN_SCALE_STEP);
  psIn.onclick = () => setScale(curScale + PIN_SCALE_STEP);
  tools3.append(el('span', 'map-tool-lbl', t('ui.maps.sizePin')), psOut, psLbl, psIn);
  wrap.append(tools3);

  const toolHint = (MAP_TOOLS.find((x) => x.id === view.tool) || MAP_TOOLS[0]).hint;
  const hint = el('div', 'map-hint',
    t('ui.maps.clickEmptyPinPin') + toolHint + t('ui.maps.ctrlClickPickItem'));
  wrap.append(hint);

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
    bDel.onclick = async () => {
      const n = view.sel.size;
      if (!(await confirmBox(tf('ui.maps.delPinPickItem', n), t('ui.common.del')))) return;
      deletePins(cur, [...view.sel]);
      view.sel.clear(); await save(); setStatus(tf('ui.maps.delPinDone', n)); redraw();
    };
    const bNone = el('button', 'cmp-mini', t('ui.maps.cancelPick'));
    bNone.onclick = () => { view.sel.clear(); redraw(); };
    selBar.append(bCopy, bDel, bNone);
  }
  if (view.clip.length) {
    const bPaste = el('button', 'cmp-mini', tf('ui.maps.pastePin', view.clip.length));
    bPaste.title = t('ui.maps.pastePinCopyMap');
    bPaste.onclick = async () => {
      // สร้าง id ใหม่ตอนวางทุกครั้ง → วางซ้ำหลายรอบ/หลายแผนที่ได้โดย id ไม่ชนกัน
      const added = clonePins(view.clip, view.clip.map((p) => p.id), 2, cur.id);
      cur.pins = [...(cur.pins || []), ...added];
      view.sel = new Set(added.map((p) => p.id));
      await save(); setStatus(tf('ui.maps.pastePinDone', added.length, cur.name)); redraw();
    };
    selBar.append(bPaste);
  }
  wrap.append(selBar);

  // ── โหมดต่อเส้นทาง ──
  const editingRoute = view.routeEdit ? mapRoutes(cur).find((r) => r.id === view.routeEdit) : null;
  if (editingRoute) {
    const rb = el('div', 'map-routebar');
    rb.append(el('span', null, tf('ui.maps.busyNextRouteClick', editingRoute.name, (editingRoute.pinIds || []).length)));
    const undoB = el('button', 'cmp-mini', t('ui.maps.dotLatest'));
    undoB.onclick = async () => { (editingRoute.pinIds || []).pop(); await save(); redraw(); };
    const doneB = el('button', 'cmp-mini k-ok', t('ui.maps.done'));
    doneB.onclick = () => { view.routeEdit = null; redraw(); };
    rb.append(undoB, doneB);
    wrap.append(rb);
  }

  // ── ฉากที่ผูกกับหมุด (ข้อ 2) ──
  if (scenesCache === null) {
    try { scenesCache = await collectPlacedScenes(); }
    catch (e) { log('warn', t('ui.maps.mapsReadScenePin'), e); scenesCache = []; }
  }
  const counts = scenePinCounts(scenesCache, cur.id);
  const hereScenes = scenesForMap(scenesCache, cur.id);

  // ── พื้นที่แผนที่ (รูป + หมุด + โอเวอร์เลย์) ──
  const stage = el('div', 'map-stage');
  const canvas = el('div', 'map-canvas');
  canvas.style.width = (view.zoom * 100) + '%';
  const img = el('img', 'map-img');
  if (cur.image) { img.src = mapImgURL(cur.image); canvas.append(img); }
  else canvas.append(el('div', 'map-noimg', t('ui.maps.notHasImagePress')));

  // กริด
  if (ov.grid) {
    const g = el('div', 'map-grid');
    const cell = (100 / ov.gridSize) + '%';
    g.style.backgroundSize = cell + ' ' + cell;
    canvas.append(g);
  }

  // เส้นทาง (ข้อ 9) — SVG พิกัด 0–100 · vector-effect กันเส้นถูกยืดตามอัตราส่วนภาพ
  if (view.showRoutes) {
    const routes = mapRoutes(cur);
    if (routes.length) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'map-routes');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      for (const r of routes) {
        const pts = routePoints(cur, r);
        const d = routePath(pts);
        if (!d) continue;
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
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
      canvas.append(svg);
      // เลขลำดับจุดของเส้นที่กำลังแก้ — วาดเป็น HTML เพื่อไม่ให้ตัวเลขถูกยืดตาม viewBox
      if (editingRoute) {
        routePoints(cur, editingRoute).forEach((pt, i) => {
          const n = el('div', 'map-route-num', String(i + 1));
          n.style.left = pt.x + '%'; n.style.top = pt.y + '%';
          n.style.background = editingRoute.color || ROUTE_COLORS[0];
          canvas.append(n);
        });
      }
    }
  }

  // ── ปักหมุดเมื่อคลิกพื้นที่ว่าง ──
  let suppressClick = false;               // กันคลิกที่เกิดหลังลากกรอบเลือก
  canvas.onclick = async (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (e.target !== canvas && e.target !== img && !e.target.classList.contains('map-grid')) return;
    if (view.sel.size) { view.sel.clear(); redraw(); return; }   // คลิกที่ว่าง = ยกเลิกการเลือกก่อน
    const r = canvas.getBoundingClientRect();
    const x = clamp(((e.clientX - r.left) / r.width) * 100);
    const y = clamp(((e.clientY - r.top) / r.height) * 100);
    const pin = newPin(x, y);
    const res = await pinDialog(pin, maps, cur.id);
    if (!res) return;
    cur.pins.push(res); await save(); redraw();
  };

  // Shift+ลาก = เลือกหมุดเป็นกรอบ
  canvas.onpointerdown = (e) => {
    if (!e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const box = el('div', 'map-rubber');
    canvas.append(box);
    const x0 = e.clientX, y0 = e.clientY;
    const paint = (ev) => {
      const l = Math.min(x0, ev.clientX) - r.left, t = Math.min(y0, ev.clientY) - r.top;
      box.style.left = l + 'px'; box.style.top = t + 'px';
      box.style.width = Math.abs(ev.clientX - x0) + 'px';
      box.style.height = Math.abs(ev.clientY - y0) + 'px';
    };
    paint(e);
    const up = (ev) => {
      window.removeEventListener('pointermove', paint);
      window.removeEventListener('pointerup', up);
      const x1 = ((Math.min(x0, ev.clientX) - r.left) / r.width) * 100;
      const x2 = ((Math.max(x0, ev.clientX) - r.left) / r.width) * 100;
      const y1 = ((Math.min(y0, ev.clientY) - r.top) / r.height) * 100;
      const y2 = ((Math.max(y0, ev.clientY) - r.top) / r.height) * 100;
      box.remove();
      if (Math.abs(x2 - x1) < 0.5 && Math.abs(y2 - y1) < 0.5) return;   // แค่คลิก ไม่ใช่ลาก
      suppressClick = true;
      for (const p of cur.pins || []) if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) view.sel.add(p.id);
      redraw();
    };
    window.addEventListener('pointermove', paint);
    window.addEventListener('pointerup', up);
  };

  // Ctrl+ล้อ = ซูม (ล้อเปล่ายังเลื่อนดูตามปกติ) — ยึดกึ่งกลางจอเหมือนปุ่ม/สไลเดอร์
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoomStep(view.zoom, e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  // ── วาดหมุด ──
  const portraits = await loadPortraits();
  const pinScale = pinScaleOf(cur);
  for (const pin of cur.pins || []) {
    const selected = view.sel.has(pin.id);
    const el2 = el('div', 'map-pin map-pin-' + pin.kind + (selected ? ' sel' : ''));
    el2.dataset.pin = pin.id;
    el2.style.left = pin.x + '%'; el2.style.top = pin.y + '%';
    if (pinScale !== 1) el2.style.setProperty('--pin-scale', String(pinScale));
    if (pin.color) el2.style.setProperty('--pin-color', pin.color);
    // [alpha.71 ข้อ 2] หมุดเอนทิตี้ที่มีรูปประจำตัว → โชว์รูปแทนไอคอน 📍
    const portraitFile = pin.kind === 'entity' && pin.entityFile ? portraits.get(pin.entityFile) : '';
    if (portraitFile) {
      const av = el('span', 'map-pin-portrait');
      const im = el('img');
      im.src = mapImgURL('Images/' + portraitFile);
      im.alt = pin.label || '';
      // รูปเสีย/ถูกลบไปแล้ว → ถอยกลับไปใช้ไอคอนเดิม ไม่ปล่อยกรอบว่าง
      im.onerror = () => { av.replaceWith(el('span', 'map-pin-icon', PIN_KIND.entity.icon)); };
      av.append(im);
      el2.append(av);
    } else {
      el2.append(el('span', 'map-pin-icon', (PIN_KIND[pin.kind] || PIN_KIND.note).icon));
    }
    if (pin.label && view.showLabels) el2.append(el('span', 'map-pin-label', pin.label));
    // ป้ายจำนวนฉาก + รายชื่อฉากตอน hover (ข้อ 2 — เหมือนที่ผังพื้นที่ทำ)
    const scHere = hereScenes.filter((s) => s.pinId === pin.id);
    if (scHere.length) el2.append(el('span', 'map-pin-count', String(scHere.length)));
    el2.title = [pin.label || (PIN_KIND[pin.kind] || {}).label || '', pin.note,
                 scHere.length ? scHere.map((s) => '📄 ' + s.title).join('\n') : '']
      .filter(Boolean).join('\n');
    el2.onclick = async (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {          // เลือกหลายตัว
        if (view.sel.has(pin.id)) view.sel.delete(pin.id); else view.sel.add(pin.id);
        redraw(); return;
      }
      if (editingRoute) { editingRoute.pinIds = [...(editingRoute.pinIds || [])];
        if (editingRoute.pinIds[editingRoute.pinIds.length - 1] !== pin.id) editingRoute.pinIds.push(pin.id);
        await save(); redraw(); return; }
      if (e.altKey) return editPin();
      // [alpha.71 ข้อ 3] โหมดเครื่องมือเป็นตัวตัดสิน — ไม่ใช่ "คลิกแล้วแก้ไขเลย" แบบเดิม
      if (view.tool === 'edit') return editPin();
      if (view.tool === 'move') { setStatus(t('ui.maps.modeMovePosDrag')); return; }
      if (pin.kind === 'portal' && pin.toMap) { S.currentId = pin.toMap; view.sel.clear(); view.focusPin = null; redraw(); return; }
      if (pin.kind === 'entity' && pin.entityFile) { openEntity(pin.entityFile); return; }
      // หมุดที่ไม่มีลิงก์ในโหมด "เปิด/ดู" — บอกข้อมูลเฉย ๆ ไม่เปิดกล่องแก้ (ต้องกดปุ่ม ✎ ก่อน)
      setStatus('📌 ' + (pin.label || t('ui.common.notNamed')) + (pin.note ? ' — ' + pin.note : '')
                + t('ui.maps.pressBtnEditTop'));
    };
    el2.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); editPin(); };
    async function editPin() {
      const res = await pinDialog({ ...pin }, maps, cur.id, true);
      if (res === 'DELETE') { deletePins(cur, [pin.id]); view.sel.delete(pin.id); await save(); redraw(); return; }
      if (res) { Object.assign(pin, res); await save(); redraw(); }
    }
    // ลากย้ายหมุด — ถ้าหมุดนี้อยู่ในกลุ่มที่เลือก ให้ย้ายทั้งกลุ่ม (ข้อ 6)
    // [alpha.71 ข้อ 3] ลากได้เฉพาะโหมด "ย้ายตำแหน่ง" — กันหมุดเลื่อนโดยไม่ตั้งใจตอนแค่จะคลิกดู
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
      const up = async () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        el2.classList.remove('dragging');
        if (moved) { await save(); redraw(); }   // คลิกเฉย ๆ ให้ onclick ทำงาน
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    };
    canvas.append(el2);
  }

  // ฉากที่ปักพิกัดลอย (ไม่ผูกหมุด) — โชว์เป็นจุดจาง ๆ ให้รู้ว่ามีอะไรอยู่ตรงนั้น
  for (const s of hereScenes) {
    if (s.pinId || s.pinX == null) continue;
    const d = el('div', 'map-scene-dot', '◉');
    d.style.left = s.pinX + '%'; d.style.top = s.pinY + '%';
    d.title = '📄 ' + (s.title || '') + t('ui.maps.scenePinCantBind');
    canvas.append(d);
  }

  // เครื่องหมายเพ่ง (มาจากปุ่ม "ดูบนแผนที่")
  if (view.focusPin) {
    const f = el('div', 'map-focus');
    f.style.left = view.focusPin.x + '%'; f.style.top = view.focusPin.y + '%';
    canvas.append(f);
  }

  // เข็มทิศ + มาตราส่วน (ข้อ 4)
  if (ov.compass) {
    const c = el('div', 'map-compass');
    c.innerHTML = '<span class="map-compass-n">N</span><span class="map-compass-needle">▲</span>';
    c.title = t('ui.maps.topImage');
    canvas.append(c);
  }
  if (ov.scale) {
    const sc = el('div', 'map-scalebar');
    sc.append(el('div', 'map-scalebar-bar'));
    sc.append(el('div', 'map-scalebar-lbl', ov.scaleLabel || t('ui.maps.setGapField')));
    canvas.append(sc);
  }

  stage.append(canvas);
  wrap.append(stage);
  applyPinFilter(wrap);

  // ── รายการเส้นทาง (ข้อ 9) ──
  const rsec = el('div', 'map-routes-panel');
  const rhead = el('div', 'map-routes-head');
  rhead.append(el('span', null, tf('ui.maps.route3', mapRoutes(cur).length)));
  const addR = el('button', 'cmp-mini', t('ui.maps.routeNew2'));
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
    row.append(el('span', 'map-route-meta', tf('ui.maps.dotGap', pts.length, routeLength(pts))));
    const bEdit = el('button', 'cmp-mini', r.id === view.routeEdit ? t('ui.maps.done') : t('ui.maps.nextDot'));
    bEdit.onclick = () => { view.routeEdit = view.routeEdit === r.id ? null : r.id; redraw(); };
    const bColor = el('button', 'cmp-mini', '🎨');
    bColor.title = t('ui.maps.recolorLine');
    bColor.onclick = async () => {
      const i = ROUTE_COLORS.indexOf(r.color);
      r.color = ROUTE_COLORS[(i + 1) % ROUTE_COLORS.length];
      await save(); redraw();
    };
    const bDash = el('button', 'cmp-mini' + (r.dashed ? ' on' : ''), '┅');
    bDash.title = t('ui.maps.lineLineSolid');
    bDash.onclick = async () => { r.dashed = !r.dashed; await save(); redraw(); };
    const bRen = el('button', 'cmp-mini', '✏');
    bRen.title = t('ui.maps.changeNameRoute');
    bRen.onclick = async () => { const v = await ask(t('ui.maps.nameRoute'), { value: r.name }); if (!v) return;
      r.name = v.trim(); await save(); redraw(); };
    const bDel = el('button', 'cmp-mini k-danger', '🗑');
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
  if (!mapRoutes(cur).length) {
    rsec.append(el('div', 'dim map-route-empty',
      t('ui.maps.routeDragLineLink')));
  }
  wrap.append(rsec);

  // ── สรุป ──
  const st = pinStats(cur);
  wrap.append(el('div', 'map-foot',
    tf('ui.maps.portalSceneBindMap', st.entity, st.portal, st.note, hereScenes.length)
    + (counts[''] ? tf('ui.maps.scenePin', counts['']) : '')));

  if (view.focusPin) setTimeout(scrollFocusIntoView, 0);
}

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

/** วาดแผนที่ + โอเวอร์เลย์ + เส้นทาง + หมุด ลง <canvas> แล้วคืน canvas (ใช้ทั้งส่งออกและพิมพ์) */
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

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  if (img) ctx.drawImage(img, 0, 0, W, H);

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
    ctx.fillStyle = pin.color || (pin.kind === 'portal' ? '#5f9fd9' : pin.kind === 'entity' ? '#d9575e' : '#d9b757');
    ctx.fill();
    ctx.lineWidth = 2 * scale; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    if (pin.label) {
      ctx.font = `${fs}px "Sarabun", sans-serif`;
      const tw = ctx.measureText(pin.label).width;
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.fillRect(x + rad + 3 * scale, y - fs * 0.75, tw + 8 * scale, fs * 1.5);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(pin.label, x + rad + 7 * scale, y);
    }
    ctx.restore();
  }

  if (ov.compass) {
    ctx.save();
    const cx = W - 60 * scale, cy = 60 * scale, rr = 34 * scale;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    ctx.lineWidth = 2 * scale; ctx.strokeStyle = '#333'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - rr * 0.72); ctx.lineTo(cx - rr * 0.28, cy + rr * 0.4);
    ctx.lineTo(cx + rr * 0.28, cy + rr * 0.4); ctx.closePath();
    ctx.fillStyle = '#c0392b'; ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = `bold ${Math.round(13 * scale)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - rr * 0.88);
    ctx.restore();
  }
  if (ov.scale) {
    ctx.save();
    const bw = W * 0.18, bx = 40 * scale, by = H - 55 * scale, bh = 9 * scale;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(bx - 6 * scale, by - 6 * scale, bw + 12 * scale, bh + 30 * scale);
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw / 4, by + 1, bw / 4, bh - 2);
    ctx.fillStyle = '#222'; ctx.font = `${Math.round(13 * scale)}px "Sarabun", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(ov.scaleLabel || '', bx, by + bh + 12 * scale);
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
    setStatus(t('ui.common.exportPNGNotOk') + e.message);
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
    setStatus(t('ui.maps.printMapNotOk') + e.message);
    return false;
  } finally {
    document.body.classList.remove('map-printing', 'printing');
    if (layer) layer.remove();
  }
}
