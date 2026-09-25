// Story Network — alpha.63r4 · Canvas 2D/3D · [alpha.166] กล้องจุดโฟกัสเดียว · ฉากหลัง · โมเดล 3 มิติ · ตรวจดู/โฟกัส/เส้นทาง/ผูกความสัมพันธ์
import { t as tt, tf as ttf } from './i18n.js';
import { visualTagFor } from './visual-tags.js';
import { REL_TYPES, categorizeRole } from './relationship-types.js';
import { resolveNetColors, resolveNetControls, controlsHint, buttonIndex,
         netColorDefsOf, axisVectors } from './network-theme.js';
import { state } from './core.js';
import { seedLayout, forceLayout, loadPositions, savePositions, clearPositions, nodeKey, scopedKey,
         layoutByCategory, layoutStory, layoutRadial } from './network-layout.js';
import { ensureAutoLink, getBacklinksFor } from './world-story/auto-link-ui.js';
import { gi } from './icons.js';
import { popupMenu } from './ui.js';
import { rot3, normalizeCam, serializeCam, camOffset, panCam, makeProjector, fitCam, viewDepth,
         lerpCam, clampScale, clampRx, CAM_DEFAULT_ANGLES } from './network-camera.js';
import { egoSet, shortestPath, degreeMap, isRelationEdge, storyProgress, sceneOrder, coOccurPairs } from './network-insights.js';
import { normalizeNetScene, modelKeyOf, isLightBg } from './network-scene.js';
import { drawNetBackgroundCached } from './network-bg.js';
import { modelSprite, onModelReady, modelState } from './network-models.js';
import { buildNetSide, buildStoryBar } from './network-inspector.js';

const CAT_ARR = ['characters','locations','items','lore','scene','chapter','book'];
// [alpha.73 ข้อ 3] **ห้ามมีเลขสีในไฟล์นี้อีก** — ทุกสีมาจาก network-theme.js ที่เดียว
// (เทส network-theme.test.cjs คอยกวาดไฟล์นี้หาเลข hex ที่หลุดมา)
export function cssVar(name, fallback) {
  try {
    // [alpha.164 ข้อ A1] ธีมตั้งตัวแปรไว้ที่ `body.theme-*` ไม่ใช่ `<html>` — อ่านจาก <html> ได้ค่าของธีมพื้นฐาน
    const v = getComputedStyle(document.body || document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}
/** สีชุดปัจจุบัน — ตั้งใหม่ทุกครั้งที่ readColors() ทำงาน */
let THEME = resolveNetColors(null, cssVar);
const WIKI_CATS = new Set(['characters','locations','items','lore']);
const CAM_PREFIX = 'k2-net-cam';

// คีย์เส้นเชื่อม — ต้องอิง nodeKey ไม่ใช่ชื่อล้วน ไม่งั้นชื่อซ้ำข้ามหมวดทำให้เส้นหายไปเงียบ ๆ
const EDGE_SEP = String.fromCharCode(1);
function edgeKey(a, b) { const x = nodeKey(a), y = nodeKey(b); return x < y ? x + EDGE_SEP + y : y + EDGE_SEP + x; }

// [alpha.71 ข้อ 3] โหมดเครื่องมือของผัง · [alpha.166] + ตรวจดู (คลิก = เลือก ไม่เปิดหน้า) · ผูกความสัมพันธ์ (ลากโหนด → โหนด)
// label/hint เป็น getter — ตารางนี้ถูกสร้างตอน import (ไฟล์ภาษาอาจยังไม่โหลด · กฎ alpha.164 รอบต่อ 2)
const tool = (id, icon, lk, hk) => ({ id, icon, get label() { return tt(lk); }, get hint() { return tt(hk); } });
export const NET_TOOLS = [
  tool('open', 'pointer', 'ui.common.openView', 'ui.net.clickNodeOpenPage'),
  tool('edit', 'pencil-thin', 'ui.common.edit', 'ui.net.clickNodeOpenPage2'),
  tool('move', 'move', 'ui.common.movePos', 'ui.net.dragNodeMovePos'),
  tool('inspect', 'crosshair', 'ui.netUi.toolInspect', 'ui.netUi.toolInspectHint'),
  tool('link', 'link', 'ui.netUi.toolLink', 'ui.netUi.toolLinkHint'),
];

function tagStyle(n) { for(const t of n.tags||[]){const v=visualTagFor(t);if(v)return v;} return null; }
function isStruct(n){return n.cat==='scene'||n.cat==='chapter'||n.cat==='book'||n.cat==='section';}
function hexToRgba(hex, alpha){const h=String(hex||'').replace('#','');const r=parseInt(h.substring(0,2),16)||0;const g=parseInt(h.substring(2,4),16)||0;const b=parseInt(h.substring(4,6),16)||0;return`rgba(${r},${g},${b},${alpha})`;}
/** [alpha.167] สีเดิมที่สว่างขึ้น (k > 0 เข้าหาขาว) หรือมืดลง (k < 0 เข้าหาดำ) — แสงเงาของโหนดทรงกลม */
function shadeHex(hex, k, alpha=1){
  const h=String(hex||'').replace('#','');
  const c=[0,2,4].map(i=>parseInt(h.substring(i,i+2),16)||0);
  const t=k>=0?255:0, a=Math.abs(k);
  const [r,g,b]=c.map(v=>Math.round(v+(t-v)*a));
  return `rgba(${r},${g},${b},${alpha})`;
}
/** จุดบนเส้นโค้งกำลังสอง a → ctl → b ที่ t */
function qpt(a,ctl,b,t){const u=1-t;return{x:u*u*a.x+2*u*t*ctl.x+t*t*b.x,y:u*u*a.y+2*u*t*ctl.y+t*t*b.y};}

// ── toolbar ──
function toggleBtn(cls, title, onToggle) {
  const b = document.createElement('button'); b.className = cls; b.title = title;
  b.dataset.active = '1'; b.classList.add('on');
  b.onclick = () => { const a = b.dataset.active === '1'; b.dataset.active = a ? '0' : '1'; b.classList.toggle('on', !a); onToggle(!a); };
  return b;
}
/**
 * [alpha.167] แถบเครื่องมือของผัง = แคปซูลลอยกลางบน + ป๊อปโอเวอร์ "ตัวกรองและการแสดงผล"
 * ผู้ใช้: *"ในแต่ละ panel มันจัดเรียงแบบโบราณไปหน่อย"* — เดิมเป็นกล่องทึบมุมซ้ายบนที่อัดทุกปุ่ม/สไลเดอร์ไว้หกแถว
 * ทับผังเกือบหนึ่งในสี่ · ตอนนี้: สิ่งที่ใช้บ่อย (เครื่องมือ · 2D/3D · จัดผัง · เรื่อง · ข้อสังเกต · ฉากหลัง · ค้นหา)
 * อยู่บนแคปซูลแถวเดียว · ของที่ตั้งครั้งเดียวแล้วจบ (หมวด · ประเภทเส้น · กริด · ขนาดโหนด · ส่งออก) อยู่ในป๊อปโอเวอร์
 * คลาส/`data-act`/`data-tool` เดิมทุกตัวยังอยู่ (ทางอื่น + e2e อ้างถึง)
 */
function buildToolbar(pane, cb) {
  const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
  const bar=mk('div','net-toolbar');
  const bd=mk('div','net-tbar-body');                         // แคปซูลหลัก
  const pop=mk('div','net-tbar-pop');pop.hidden=true;         // ป๊อปโอเวอร์ตัวกรอง/การแสดงผล
  const ca=new Set(CAT_ARR.slice(0,4)),tf=new Set([...REL_TYPES.map(t=>t.key),'co-occur','scene-link','ent-scene']);
  const sep=()=>mk('span','net-tbar-sep');
  const section=(titleKey,...kids)=>{const s=mk('div','net-pop-sec');s.append(mk('div','net-pop-title',tt(titleKey)),...kids);return s;};

  // ── ป๊อปโอเวอร์: หมวด ──
  const cr=mk('div','net-tbar-row net-tbar-cats');
  // ชิปหมวด: ชื่อ/คีย์มาจาก network-theme.js · สีถูกทาทีหลังโดย _paintToolbarColors()
  for (const x of netColorDefsOf('nodes').filter(d=>CAT_ARR.slice(0,4).includes(d.id))) {
    const b = toggleBtn('net-tcat', x.label, (on) => { if (on) ca.add(x.id); else ca.delete(x.id); cb.filter(ca, tf); });
    b.dataset.cat = x.id; b.textContent = x.label; cr.appendChild(b);
  }
  // ── ป๊อปโอเวอร์: ประเภทเส้น (เดิมเป็นจุดสีไม่มีชื่อ — ต้องชี้ทีละจุดถึงรู้ว่าคืออะไร) ──
  const tr=mk('div','net-tbar-row net-tbar-types');
  const typeBtn = (key, title, extra) => {
    const b = toggleBtn('net-ttype' + (extra ? ' ' + extra : ''), title, (on) => { if (on) tf.add(key); else tf.delete(key); cb.filter(ca, tf); });
    b.dataset.type = key; b.append(mk('i','net-ttype-dot'),mk('span','net-ttype-name',title)); tr.appendChild(b);
  };
  REL_TYPES.forEach(t => typeBtn(t.key, t.label));
  typeBtn('co-occur', tt('ui.net.appear'), 'net-ttype-co');
  typeBtn('scene-link', tt('ui.net.linkScene'), 'net-ttype-sc');
  typeBtn('ent-scene', tt('ui.net.scene2'), 'net-ttype-es');
  // ── ป๊อปโอเวอร์: การแสดงผล ──
  const lblBtn=mk('button','net-tbar-btn net-tog on net-lbl-btn',gi('font'));lblBtn.title=tt('ui.net.showItemFilmName');
  lblBtn.onclick=()=>{lblBtn.classList.toggle('on');cb.toggleLabels();};
  const szLbl=mk('span','net-tbar-lbl',gi('node-size'));szLbl.title=tt('ui.net.sizeNode');
  const size=mk('input','net-grid-slider net-size-slider');size.type='range';
  size.min='50';size.max='250';size.value='100';size.title=tt('ui.net.sizeNode3');
  size.oninput=()=>{cb.setNodeScale(Number(size.value)/100);size.title=tt('ui.net.sizeNode2')+size.value+'%';};
  const gridBtn=mk('button','net-tbar-btn net-tog on',gi('ruler'));gridBtn.title=tt('ui.net.showGrid');
  const gridSize=mk('input','net-grid-slider net-grid-px');gridSize.type='range';gridSize.min='20';gridSize.max='200';gridSize.value=String(cb.gridPx());gridSize.title=tt('ui.net.sizeGridPx');
  gridBtn.onclick=()=>{cb.toggleGrid();gridBtn.classList.toggle('on');};
  gridSize.oninput=()=>{cb.setGridPx(Number(gridSize.value));gridSize.title=tt('ui.net.sizeGrid')+gridSize.value+'px';};
  const gridAlpha=mk('input','net-grid-slider net-grid-alpha');gridAlpha.type='range';gridAlpha.min='1';gridAlpha.max='100';gridAlpha.value=String(Math.round(cb.gridAlpha()*100));gridAlpha.title=tt('ui.net.hollowGrid2');
  gridAlpha.oninput=()=>{cb.setGridAlpha(Number(gridAlpha.value)/100);gridAlpha.title=tt('ui.net.hollowGrid')+gridAlpha.value+'%';};
  const viewRow=mk('div','net-tbar-row net-tbar-view');
  const gridRow=mk('div','net-tbar-row');
  gridRow.append(gridBtn,gridSize,gridAlpha);

  const btn=(x)=>{
    const b=mk('button','net-tbar-btn'+(x.cl?' '+x.cl:''),x.t);b.title=x.ti;b.setAttribute('aria-label',x.ti);
    if (x.id) b.dataset.act = x.id;
    // ปุ่มสลับ: สภาพ "ติด" ถูกตั้งโดยตัวผังเอง (syncToolbar) ไม่ใช่กลับค่าเอาเองตอนกด — กดจากทางอื่น (เมนู · ค่าที่จำไว้) ต้องตรงกัน
    b.onclick=()=>{ if(x.cl==='net-tog'||x.cl==='net-tog on') b.classList.toggle('on'); x.f(); };
    return b;
  };
  viewRow.append(lblBtn,
    btn({t:gi('edge-label'),ti:tt('ui.netUi.edgeLabelsBtn'),f:cb.cycleEdgeLabels,id:'labels'}),
    btn({t:gi('frame'),ti:tt('ui.net.showImageCollapse'),f:cb.toggleImages,cl:'net-tog on'}),
    btn({t:gi('map'),ti:'Minimap',f:cb.toggleMinimap,cl:'net-tog'}),
    sep(),szLbl,size);
  const actRow=mk('div','net-tbar-row net-tbar-acts2');
  actRow.append(
    btn({t:gi('refresh'),ti:tt('ui.common.refresh'),f:cb.refresh}),
    btn({t:gi('pin'),ti:tt('ui.net.unsetPinAllNode'),f:cb.relayout}),
    btn({t:gi('import'),ti:tt('ui.common.export'),f:cb.export}));
  pop.append(section('ui.netUi.popCats',cr),section('ui.netUi.popTypes',tr),
    section('ui.netUi.popView',viewRow,gridRow),section('ui.netUi.popMore',actRow));

  // ── แคปซูลหลัก ──
  const toolRow=mk('div','net-tbar-row net-tbar-tools');
  const toolBtns=[];
  for(const x of NET_TOOLS){
    const b=mk('button','net-tbar-btn net-tool-btn'+(x.id==='open'?' on':''),gi(x.icon));
    b.dataset.tool=x.id;b.title=x.label+' — '+x.hint;
    b.setAttribute('aria-label', x.label);
    b.onclick=()=>cb.setTool(x.id);
    toolBtns.push(b);toolRow.appendChild(b);
  }
  const btns=mk('div','net-tbar-actions');
  const filt=mk('button','net-tbar-btn net-tbar-filter',gi('filter'));
  filt.title=tt('ui.netUi.popBtn');filt.setAttribute('aria-label',tt('ui.netUi.popBtn'));filt.setAttribute('aria-expanded','false');
  const setPop=(open)=>{pop.hidden=!open;filt.classList.toggle('on',open);filt.setAttribute('aria-expanded',String(open));};
  filt.onclick=(e)=>{e.stopPropagation();setPop(pop.hidden);};
  // คลิกนอกป๊อปโอเวอร์ = ปิด (ผังยังรับคลิกนั้นตามปกติ)
  const offDoc=(e)=>{ if(!pop.hidden&&!pop.contains(e.target)&&e.target!==filt)setPop(false); };
  document.addEventListener('mousedown',offDoc,true);
  pop.addEventListener('keydown',(e)=>{if(e.key==='Escape'){e.stopPropagation();setPop(false);filt.focus();}});
  btns.append(
    btn({t:'3D',ti:tt('ui.net.toggleDD'),f:cb.toggle3D,cl:'net-tog',id:'3d'}),
    btn({t:gi('perspective'),ti:tt('ui.netUi.perspBtn'),f:cb.togglePersp,cl:'net-tog',id:'persp'}),
    sep(),
    btn({t:gi('net-layout'),ti:tt('ui.netUi.layoutBtn'),f:cb.layoutMenu,id:'layout'}),
    btn({t:gi('story-line'),ti:tt('ui.netUi.storyBtn'),f:cb.toggleStory,cl:'net-tog',id:'story'}),
    btn({t:gi('bulb'),ti:tt('ui.netUi.insights'),f:cb.toggleInsights,cl:'net-tog',id:'insights'}),
    btn({t:gi('image'),ti:tt('ui.netUi.sceneBtn'),f:cb.toggleScene,cl:'net-tog',id:'scene'}),
    sep(),
    filt,
    btn({t:gi('reset-view'),ti:tt('ui.net.reset'),f:cb.reset,cl:'net-reset'}));
  const sw=mk('div','net-tbar-search');
  sw.append(mk('span','net-tbar-search-ico',gi('search')));
  const si=mk('input','net-tbar-input');si.type='text';si.placeholder=tt('ui.net.search');
  // [รอบ 2] Enter = บินไปหาผลแรก + เลือกไว้ (เดิมแค่กรองซ้ำ — ผังใหญ่หาโหนดที่เจอไม่เจอ)
  let tm;si.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>cb.search(si.value.trim()),200);};si.onkeydown=e=>{if(e.key==='Enter'){clearTimeout(tm);cb.search(si.value.trim());cb.searchGo(si.value.trim(),e.shiftKey);}};sw.appendChild(si);
  bd.append(toolRow,sep(),btns,sw);
  bar.append(bd,pop);pane.appendChild(bar);
  // btns = ราก (ทุก [data-act] อยู่ข้างใน ทั้งบนแคปซูลและในป๊อปโอเวอร์)
  return {bar,btns:bar,toolRow,toolBtns,pop,setPop,destroy:()=>{document.removeEventListener('mousedown',offDoc,true);bar.remove();}};
}

// ═════ draw rounded rect with dark background ═════
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
/**
 * [alpha.167] ป้ายชื่อโหนด — ชิดขวาของโหนด ไม่มีกล่องทึบ (เงาเรืองสีพื้นรอบตัวอักษรพอให้อ่านบนทุกฉากหลัง)
 * + แคปซูลตัวเลขเล็ก ๆ (จำนวนฉากที่ปรากฏ) ต่อท้าย · ตัวสำคัญ = ตัวหนา
 */
function drawNodeLabel(c, text, x, cy, fontSize, badge, strong, col) {
  c.font = (strong ? '600 ' : '') + fontSize + 'px "K2 Icons","Segoe UI","Leelawadee UI",sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  // ขอบตัวอักษรสีพื้น (คม ไม่ใช่เงาเบลอที่กลายเป็นคราบรอบป้าย) → อ่านได้แม้ทับเส้นสว่าง
  c.save();
  c.lineJoin = 'round'; c.lineWidth = fontSize * 0.32; c.strokeStyle = hexToRgba(THEME.canvas.labelBg, 0.75);
  c.strokeText(text, x, cy);
  c.fillStyle = THEME.canvas.label;
  c.fillText(text, x, cy);
  c.restore();
  if (!badge) return;
  const tw = c.measureText(text).width;
  const bf = fontSize * 0.74;
  c.font = '600 ' + bf + 'px "Segoe UI","Leelawadee UI",sans-serif';
  const bw = c.measureText(badge).width + bf * 1.1, bh = bf * 1.55;
  const bx = x + tw + fontSize * 0.45;
  c.fillStyle = hexToRgba(THEME.canvas.labelBg, 0.85);
  roundRect(c, bx, cy - bh / 2, bw, bh, bh / 2); c.fill();
  c.strokeStyle = hexToRgba(col, 0.75); c.lineWidth = bf / 9; c.stroke();
  c.fillStyle = THEME.canvas.label; c.textAlign = 'center';
  c.fillText(badge, bx + bw / 2, cy + bf * 0.05);
}
/** ป้ายเส้น = แคปซูลเล็ก ๆ กลางเส้น (ขอบสีของเส้นเมื่อชี้อยู่) */
function drawEdgeLabel(c, text, x, y, fontSize, ring) {
  c.font = fontSize + 'px "Segoe UI","Leelawadee UI",sans-serif';
  const m = c.measureText(text); const tw = m.width + fontSize * 1.1, th = fontSize * 1.75;
  c.fillStyle = hexToRgba(THEME.canvas.labelBg, 0.82);
  roundRect(c, x - tw / 2, y - th / 2, tw, th, th / 2); c.fill();
  if (ring) { c.strokeStyle = hexToRgba(ring, 0.8); c.lineWidth = fontSize / 10; c.stroke(); }
  c.fillStyle = THEME.canvas.label; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x, y + fontSize * 0.06);
}

function buildMinimap(pane) {
  const mc = document.createElement('canvas'); mc.className = 'net-minimap'; mc.width = 160; mc.height = 120;
  pane.appendChild(mc); return mc;
}
/**
 * [alpha.167] การ์ดสัญลักษณ์มุมซ้ายล่าง — สีของแต่ละหมวด + จำนวนที่เห็นอยู่ · คลิกแถว = ซ่อน/แสดงหมวดนั้น
 * (ชิปหมวดในป๊อปโอเวอร์เป็นตัวจริง — การ์ดนี้แค่กดแทน สภาพจึงตรงกันเสมอ)
 */
function buildLegend(pane, bar) {
  const box = document.createElement('div'); box.className = 'net-legend';
  const head = document.createElement('div'); head.className = 'net-legend-title'; head.textContent = tt('ui.netUi.legendTitle');
  const list = document.createElement('div'); list.className = 'net-legend-list';
  box.append(head, list);
  pane.appendChild(box);
  let last = '';
  const rows = new Map();
  for (const d of netColorDefsOf('nodes').filter((x) => ['characters', 'locations', 'items', 'lore', 'scene', 'chapter'].includes(x.id))) {
    const r = document.createElement('button'); r.className = 'net-legend-row'; r.dataset.cat = d.id;
    const dot = document.createElement('i'); dot.className = 'net-legend-dot';
    const name = document.createElement('span'); name.className = 'net-legend-name'; name.textContent = d.label;
    const cnt = document.createElement('span'); cnt.className = 'net-legend-count'; cnt.textContent = '0';
    r.append(dot, name, cnt);
    const chip = bar.querySelector(`.net-tcat[data-cat="${d.id}"]`);
    if (chip) { r.title = tt('ui.netUi.legendToggle'); r.onclick = () => chip.click(); }
    else r.disabled = true;
    list.append(r); rows.set(d.id, { r, dot, cnt, chip });
  }
  return {
    box,
    update(counts, colors) {
      const sig = JSON.stringify(counts) + JSON.stringify(colors) + [...rows.values()].map((x) => x.chip ? x.chip.classList.contains('on') : 1).join();
      if (sig === last) return;
      last = sig;
      for (const [id, x] of rows) {
        const n = counts[id] || 0;
        x.r.hidden = !n && !x.chip;
        x.cnt.textContent = String(n);
        x.dot.style.setProperty('--dot', colors[id] || '');
        x.r.classList.toggle('off', !!x.chip && !x.chip.classList.contains('on'));
      }
    },
  };
}
function buildStatusBar(pane) {
  const sb = document.createElement('div'); sb.className = 'net-status';
  pane.appendChild(sb); return sb;
}
function buildTipBar(pane) {
  const tb = document.createElement('div'); tb.className = 'net-tip';
  tb.textContent = tt('ui.net.dragBgScrollWheel');
  pane.appendChild(tb); return tb;
}

function loadCam(scope) {
  try { const raw = localStorage.getItem(scopedKey(CAM_PREFIX, scope)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ═════ StoryNetwork ═════
export class StoryNetwork {
  constructor(pane, { loadEntities, onOpen=null, onOpenScene=null, onReveal=null,
                       onDeleteStruct=null, onRenameStruct=null, onDuplicateStruct=null, onAddChild=null,
                       onCreateRel=null, onSceneChange=null, assetPath=null, assetUrl=null, importAsset=null }) {
    // ── [alpha.166] กล้อง = จุดโฟกัสในพิกัดโลก (network-camera.js) ──
    // ชื่อเดิม (_cx/_cy/_scale/_rx/_ry/_mode3D) ยังอ่าน/เขียนได้ — เป็นมุมมองของกล้องตัวเดียว ไม่ใช่ค่าแยก
    const saved = loadCam(state.root || '');
    this._cam = normalizeCam(saved);
    this._camTouched = !!saved;
    Object.defineProperties(this, {
      _scale: { get() { return this._cam.scale; }, set(v) { this._cam.scale = clampScale(v); } },
      _rx: { get() { return this._cam.rx; }, set(v) { this._cam.rx = clampRx(v); } },
      _ry: { get() { return this._cam.ry; }, set(v) { this._cam.ry = Number.isFinite(+v) ? +v : 0; } },
      _mode3D: { get() { return this._cam.mode3D; }, set(v) { this._cam.mode3D = !!v; this._rotAnim = null; } },
      _cx: { get() { return this._off().cx; },
             set(v) { const d = (+v || 0) - this._off().cx; this._cam = panCam(this._cam, d, 0, this._rot()); } },
      _cy: { get() { return this._off().cy; },
             set(v) { const d = (+v || 0) - this._off().cy; this._cam = panCam(this._cam, 0, d, this._rot()); } },
    });

    this.pane=pane; this.onOpen=onOpen; this.onOpenScene=onOpenScene; this.onReveal=onReveal;
    this.onDeleteStruct=onDeleteStruct; this.onRenameStruct=onRenameStruct;
    this.onDuplicateStruct=onDuplicateStruct; this.onAddChild=onAddChild;
    this.onCreateRel=onCreateRel; this.onSceneChange=onSceneChange;
    this.assetPath=assetPath; this.assetUrl=assetUrl; this.importAsset=importAsset;
    this.loadEntities=loadEntities;
    this.title='Story Network'; this.dirty=false;
    this.nodes=[];this.edges=[];this.drag=null;
    this._deg=new Map();
    this._hoverNode=null;
    this._catFilter=new Set(CAT_ARR.slice(0,4));
    this._typeFilter=new Set([...REL_TYPES.map(t=>t.key),'co-occur','scene-link','ent-scene']);
    this._searchQuery='';
    this._showImages=true; this._showMinimap=false;
    this._showGrid=true;
    this._orbitDrag=null;
    // [alpha.71 ข้อ 3] เครื่องมือ + ป้ายชื่อ + ขนาดโหนด
    this._tool='open'; this._showLabels=true; this._nodeScale=1;
    // [alpha.166] เลือก/โฟกัส/เส้นทาง
    this._sel=null; this._focusHops=0; this._path=null; this._pathPick=false; this._linkDrag=null;
    // [รอบ 2] ป้ายเส้น ('rel' ความสัมพันธ์ที่ตั้งไว้ · 'all' ทุกเส้น · 'none' เฉพาะเส้นของโหนดที่ชี้/เลือก) · หลบป้ายทับกัน · ไทม์ไลน์เรื่อง
    this._edgeLabels='rel'; this._declutter=true; this._story=null; this._searchIdx=-1;
    this._scene=normalizeNetScene(state.settings && state.settings.netScene);
    this._bgImg={ rel:'', img:null, loading:false };

    this.canvas=document.createElement('canvas');
    this.canvas.className='net-canvas';
    this.canvas.tabIndex=0;                       // Esc = ล้างการเลือก/โฟกัส/เส้นทาง (คีย์เฉพาะในผัง ไม่ใช่คำสั่งกลาง)
    pane.appendChild(this.canvas);

    this.canvas.addEventListener('mousedown',e=>this._down(e));
    this.canvas.addEventListener('mousemove',e=>this._move(e));
    this._upDoc=e=>this._up(e);
    document.addEventListener('mouseup',this._upDoc);
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this._zoom(e);},{passive:false});
    this.canvas.addEventListener('contextmenu',e=>{e.preventDefault();this._ctxMenu(e);});
    this.canvas.addEventListener('dblclick',e=>{e.preventDefault();const{node}=this._hit(e);if(!node)return;this._openNode(node);});
    this.canvas.addEventListener('keydown',e=>{
      if(e.key==='Escape' && this.clearEmphasis()){ e.preventDefault(); e.stopPropagation(); return; }
      // [รอบ 2] ไทม์ไลน์เรื่องเปิดอยู่ = ← → เดินทีละฉาก (คีย์เฉพาะในผัง ตอนผังมีโฟกัสเท่านั้น)
      if(this._story && (e.key==='ArrowLeft'||e.key==='ArrowRight')){
        e.preventDefault(); e.stopPropagation(); this.playStory(false);
        this.setStory({upTo:this._story.upTo+(e.key==='ArrowRight'?1:-1)});
      }
    });

    this._resize=()=>{this._fit();this.draw();};
    window.addEventListener('resize',this._resize);
    // [alpha.164 ข้อ A1] เปลี่ยนธีมระหว่างเปิดผังค้างไว้ = อ่านสีใหม่ทันที (ไม่ต้องปิด-เปิดแผง)
    this._onTheme=()=>{try{this.readColors();this.draw();}catch{}};
    window.addEventListener('k2-theme',this._onTheme);
    if(typeof ResizeObserver!=='undefined'){
      this._ro=new ResizeObserver(()=>{try{this._fit();this.draw();this._updateMinimap();}catch{}});
      this._ro.observe(pane);
    }
    onModelReady(() => { try { this.draw(); this._side && this._side.update(); } catch {} });

    const self=this;
    this._tb=buildToolbar(pane,{
      // buildToolbar ส่ง Set ตัวเดิมกลับมาทุกครั้ง (แก้ในที่) → ต้องล้าง cache เอง
      filter(ca,tf){self._catFilter=ca;self._typeFilter=tf;self._vfCache=null;self.draw();},
      search(q){self._searchQuery=q;self.draw();},
      refresh(){self.refresh();},
      relayout(){self.relayout();},
      toggleImages(){self._showImages=!self._showImages;self.draw();},
      toggleLabels(){self._showLabels=!self._showLabels;self.draw();},
      setTool(id){self.setTool(id);},
      setNodeScale(v){self._nodeScale=Math.max(0.5,Math.min(2.5,v||1));self.draw();},
      toggleMinimap(){self._showMinimap=!self._showMinimap;self._mm.style.display=self._showMinimap?'':'none';self._updateMinimap();},
      toggle3D(){self.toggle3D();},
      toggleGrid(){self._showGrid=!self._showGrid;self.draw();},
      gridPx(){return self._scene.grid.px;},
      gridAlpha(){return self._scene.grid.alpha;},
      setGridPx(v){self.updateScene({grid:{...self._scene.grid,px:v}});},
      setGridAlpha(v){self.updateScene({grid:{...self._scene.grid,alpha:v}});},
      toggleInsights(){self._side.toggle('insights');},
      toggleStory(){self.setStory(self._story?null:{upTo:0});},
      layoutMenu(){self._layoutMenu();},
      cycleEdgeLabels(){self.cycleEdgeLabels();},
      togglePersp(){self._cam.persp=!self._cam.persp;self._touchCam();self._syncToolbar();self.draw();},
      searchGo(q,back){self.searchGo(q,back);},
      toggleScene(){self._side.toggle('scene');},
      export(){self.draw();const d=self.canvas.toDataURL('image/png');const a=document.createElement('a');a.download='story-network.png';a.href=d;document.body.appendChild(a);a.click();document.body.removeChild(a);},
      reset(){self.resetView();},
    });

    this._mm = buildMinimap(pane); this._mm.style.display = 'none';
    this._sb = buildStatusBar(pane);
    this._legend = buildLegend(pane, this._tb.bar);
    this._tip = buildTipBar(pane);
    this._side = buildNetSide(pane, this);
    this._storyBar = buildStoryBar(pane, this);

    this._fit(); this.readColors(); this._syncToolbar(); this.draw(); this.refresh();
  }

  // ═════════ กล้อง ═════════
  /** มุมที่ใช้ฉายจริงเฟรมนี้ — 2D = 0 · 3D = มุมของกล้อง · ระหว่างสลับโหมด = ค่าที่กำลังหมุนไป */
  _rot(){
    const a=this._rotAnim;
    if(a){
      const k=Math.min(1,(performance.now()-a.t0)/a.dur);
      const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      return { rx:a.from.rx+(a.to.rx-a.from.rx)*e, ry:a.from.ry+(a.to.ry-a.from.ry)*e };
    }
    return this._cam.mode3D ? { rx:this._cam.rx, ry:this._cam.ry } : { rx:0, ry:0 };
  }
  _off(){ return camOffset(this._cam, this.canvas.width||1, this.canvas.height||1, this._rot()); }
  /**
   * [รอบ 2] ความแรงของมุมมองระยะเฟรมนี้ (0 = แบบขนาน) — 2D ไม่มีเลย · ระหว่างสลับโหมดไล่ไปพร้อมมุมหมุน
   * (ไม่งั้นภาพกระตุกตอนเข้า/ออก 3D)
   */
  _perspK(){
    if(!this._cam.persp)return 0;
    const a=this._rotAnim;
    if(a){
      const k=Math.min(1,(performance.now()-a.t0)/a.dur);
      const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      return a.toMode3D ? e : 1-e;
    }
    return this._cam.mode3D?1:0;
  }
  /** [รอบ 2] ท่าของโมเดล 3 มิติ: 0 = หันหน้าเข้าหาผู้ชม (2D) · 1 = ยืนบนระนาบ (3D) · ไล่ตามภาพเคลื่อนไหวตอนสลับ */
  _standK(){
    const a=this._rotAnim;
    if(a){ const k=Math.min(1,(performance.now()-a.t0)/a.dur); const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; return a.toMode3D?e:1-e; }
    return this._cam.mode3D?1:0;
  }
  /** ตัวฉายของเฟรมนี้ — วาดโหนด · วาดพื้น · คลิก · ลาก ใช้ตัวเดียวกัน (network-camera.makeProjector) */
  _pj(){ return makeProjector(this._cam, this.canvas.width||1, this.canvas.height||1, this._rot(), this._perspK()); }
  /** ตำแหน่งบนผืนวาด (พิกเซล) ของจุดในโลก — ตัววาดเฟรมนี้ใช้การฉายเดียวกันเป๊ะ (เทส/แผงข้างใช้) */
  screenOf(p){ const q=this._pj().proj(p); return { x:q.x, y:q.y, depth:q.z, f:q.f }; }

  _saveCamSoon(){
    clearTimeout(this._camJob);
    this._camJob=setTimeout(()=>{ try{ localStorage.setItem(scopedKey(CAM_PREFIX,this._scope()), JSON.stringify(serializeCam(this._cam))); }catch{} },400);
  }
  _touchCam(){ this._camTouched=true; this._saveCamSoon(); }

  /** วงรอบภาพเคลื่อนไหว (สลับ 2D/3D · บินไปหาโหนด) — หยุดเองเมื่อไม่มีอะไรขยับ */
  _animate(){
    if(this._animId)return;
    const step=()=>{
      this._animId=null;
      const now=performance.now();
      let more=false;
      if(this._rotAnim){ if(now-this._rotAnim.t0>=this._rotAnim.dur){ this._rotAnim=null; } else more=true; }
      if(this._layoutAnim){
        const a=this._layoutAnim, k=Math.min(1,(now-a.t0)/a.dur), e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        for(const [n,p] of a.to){const f=a.from.get(n)||p;n.x=f.x+(p.x-f.x)*e;n.y=f.y+(p.y-f.y)*e;n.z=f.z+(p.z-f.z)*e;}
        if(k>=1)this._finishLayout(); else more=true;
      }
      if(this._flyAnim){
        const f=this._flyAnim, k=Math.min(1,(now-f.t0)/f.dur);
        const c=lerpCam(f.from,f.to,k);
        this._cam={...this._cam, tx:c.tx, ty:c.ty, tz:c.tz, scale:c.scale};
        if(k>=1)this._flyAnim=null; else more=true;
      }
      this.draw(); if(this._showMinimap)this._updateMinimap();
      if(more)this._animId=requestAnimationFrame(step);
    };
    this._animId=requestAnimationFrame(step);
  }

  /**
   * [alpha.166] ★ สลับ 2D ↔ 3D โดยกล้องไม่หลุด
   * จุดโฟกัสอยู่กลางจอตลอด แล้วหมุนมุมไป/กลับจาก 0 อย่างต่อเนื่อง (2D = มองตรงลงมา ของชิ้นเดียวกัน)
   * เข้า 3D: ตั้งความลึกของจุดโฟกัส = ความลึกเฉลี่ยของโหนดที่อยู่ในจอ → หมุนรอบกลุ่มที่กำลังดู ไม่เหวี่ยงหลุดจอ
   */
  toggle3D(on){
    const want = on===undefined ? !this._cam.mode3D : !!on;
    if(want===this._cam.mode3D){ this._syncToolbar(); return want; }
    const from=this._rot();
    const w=this.canvas.width, h=this.canvas.height;
    if(want) this._cam.tz = viewDepth(this.nodes, this._cam, w, h, from);
    this._cam.mode3D=want;
    const to = want ? { rx:this._cam.rx, ry:this._cam.ry } : { rx:0, ry:0 };
    this._rotAnim={ from, to, t0:performance.now(), dur:420, toMode3D:want };
    this._syncTip(); this._syncToolbar(); this._touchCam();
    this._animate();
    return want;
  }

  resetView(){
    this._cam.rx=CAM_DEFAULT_ANGLES.rx; this._cam.ry=CAM_DEFAULT_ANGLES.ry;
    this._rotAnim=null; this._flyAnim=null;
    this._camTouched=false; this._fitView(); this._saveCamSoon();
    this.draw(); if(this._showMinimap)this._updateMinimap();
  }

  /** บินไปหาโหนด (จากรายการในแผงข้าง · ผลค้นหา) */
  flyTo(node, { minScale=0.9 }={}){
    if(!node)return false;
    const to={ ...this._cam, tx:node.x, ty:node.y, tz:node.z||0, scale:Math.max(this._cam.scale, minScale) };
    this._flyAnim={ from:{...this._cam}, to, t0:performance.now(), dur:420 };
    this._touchCam(); this._animate();
    return true;
  }

  // ═════════ ปุ่ม/สภาพ ═════════
  setTool(id){
    if(!NET_TOOLS.some(x=>x.id===id))return false;
    this._tool=id;
    this.canvas.classList.toggle('net-move-mode',id==='move');
    this.canvas.classList.toggle('net-link-mode',id==='link');
    for(const b of this._tb.toolBtns)b.classList.toggle('on',b.dataset.tool===id);
    this.draw();
    return true;
  }
  _syncToolbar(){
    const b=this._tb && this._tb.btns.querySelector('[data-act="3d"]');
    if(b)b.classList.toggle('on',!!this._cam.mode3D);
    const q=(id)=>this._tb&&this._tb.btns.querySelector(`[data-act="${id}"]`);
    if(q('story'))q('story').classList.toggle('on',!!this._story);
    if(q('persp')){q('persp').classList.toggle('on',!!this._cam.persp);q('persp').disabled=!this._cam.mode3D;}
    if(q('labels')){
      const lk={rel:'ui.netUi.edgeLabelsRel',all:'ui.netUi.edgeLabelsAll',none:'ui.netUi.edgeLabelsNone'}[this._edgeLabels];
      q('labels').title=tt('ui.netUi.edgeLabelsBtn')+' — '+tt(lk);
      q('labels').classList.toggle('on',this._edgeLabels!=='none');
    }
    if(this._side){
      for(const id of ['insights','scene']){
        const x=this._tb.btns.querySelector(`[data-act="${id}"]`);
        if(x)x.classList.toggle('on',this._side.isOpen(id));
      }
    }
  }

  readColors(){
    // [alpha.73 ข้อ 3] สีทุกสีมาจากนิยามกลางที่เดียว (network-theme.js)
    THEME = resolveNetColors(state.settings && state.settings.netColors, cssVar);
    this._catCol = THEME.node;
    this._edgeCol = THEME.edge;
    this._bg = THEME.canvas.bg;
    this._grid = THEME.canvas.grid;
    this._controls = resolveNetControls(state.settings && state.settings.netControls);
    this._scene = normalizeNetScene(state.settings && state.settings.netScene);
    this._vfCache=null;
    this._paintToolbarColors();
    this._syncTip();
  }

  /**
   * [alpha.166] เปลี่ยนค่าฉากหลัง/กริด/โมเดล — วาดทันที · บันทึกลงผลงานแบบหน่วง (ลากสไลเดอร์ไม่เขียนไฟล์ทุกพิกเซล)
   * @param {object} patch  ส่วนที่เปลี่ยน ({bg:{…}} · {grid:{…}} · {models:{…}}) หรือฉากทั้งก้อน
   */
  updateScene(patch){
    this._scene=normalizeNetScene({ ...this._scene, ...(patch||{}) });
    if(state.settings)state.settings.netScene=this._scene;
    this.draw();
    clearTimeout(this._sceneJob);
    this._sceneJob=setTimeout(()=>{ try{ this.onSceneChange && this.onSceneChange(this._scene); }catch{} },400);
    return this._scene;
  }

  /** ภาพฉากหลังของผู้ใช้ (โหลดครั้งเดียวต่อไฟล์) */
  _bgImage(){
    const rel=this._scene.bg.kind==='image'?this._scene.bg.image:'';
    if(!rel)return null;
    if(this._bgImg.rel!==rel){
      this._bgImg={ rel, img:null, loading:true };
      const mine=this._bgImg;
      if(this._bgBlobUrl){ try{URL.revokeObjectURL(this._bgBlobUrl);}catch{} this._bgBlobUrl=''; }
      // [alpha.167] โหลดผ่านไบต์ → blob: (ต้นทางเดียวกับหน้า) — รูป file:// ทำให้ผืนวาด "เปื้อน":
      // skybox อ่านพิกเซลของพาโนรามาไม่ได้ และปุ่มส่งออก PNG (toDataURL) โยน SecurityError เงียบ ๆ
      const viaBytes=async()=>{
        const abs=this.assetPath?this.assetPath(rel):'';
        const k=globalThis.kapi;
        if(!abs||!k||!k.readBytes)return '';
        const bytes=await k.readBytes(abs);
        if(!bytes)return '';
        const ext=String(rel).split('.').pop().toLowerCase();
        const mime={jpg:'image/jpeg',jpeg:'image/jpeg',svg:'image/svg+xml'}[ext]||('image/'+ext);
        const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
        if(this._bgImg!==mine){ URL.revokeObjectURL(url); return ''; }
        this._bgBlobUrl=url;
        return url;
      };
      viaBytes().catch(()=>'').then((u)=>u||(this.assetUrl ? this.assetUrl(rel) : '')).then((url)=>{
        if(!url||this._bgImg!==mine)return;
        const img=new Image();
        img.onload=()=>{ if(this._bgImg===mine){ mine.img=img; mine.loading=false; this.draw(); } };
        img.onerror=()=>{ mine.loading=false; };
        img.src=url;
      }).catch(()=>{ mine.loading=false; });
    }
    return this._bgImg.img;
  }

  /** โมเดลของโหนด ({file,scale,yaw} · ทางเต็มใน abs) หรือ null */
  modelOf(n){
    if(!n||isStruct(n))return null;
    const m=this._scene.models.byNode[modelKeyOf(n)]||this._scene.models.byCat[n.cat]||null;
    if(!m)return null;
    const abs=this.assetPath?this.assetPath(m.file):'';
    return abs?{...m,abs}:null;
  }

  /** คำอธิบายใต้ผัง — สร้างจากค่าที่ตั้งไว้จริง (ข้อ 2: tooltip ต้อง sync กับ setting) */
  _syncTip(){
    if(!this._tip)return;
    let s=controlsHint(this._controls, this._mode3D);
    if(this._tool==='link')s=tt('ui.netUi.toolLinkHint')+' · '+s;
    if(this._pathPick)s=tt('ui.netUi.pathPickHint');
    this._tip.textContent = s;
  }

  _paintToolbarColors(){
    if(!this._tb||!this._tb.bar)return;
    for(const b of this._tb.bar.querySelectorAll('.net-tcat[data-cat]')){
      const col=this._catCol[b.dataset.cat];
      if(col)b.style.setProperty('--tcolor',col);
    }
    for(const b of this._tb.bar.querySelectorAll('.net-ttype[data-type]')){
      const col=this._edgeCol[b.dataset.type];
      if(col)b.style.setProperty('--tcolor',col);
    }
  }

  /** โปรเจกต์ที่ผังนี้เป็นของ — ใช้แยก localStorage ของตำแหน่งโหนด */
  _scope(){ return state.root || ''; }

  async refresh() {
    try {
      this._sb && (this._sb.textContent = tt('ui.net.busyLoad'));
      const ents=await this.loadEntities();
      if (!ents || !Array.isArray(ents)) { this._sb && (this._sb.textContent = tt('ui.net.loadError')); return; }
      if (!ents.length) { this.nodes=[]; this.edges=[]; this._sb && (this._sb.textContent = tt('ui.net.notFoundNewCharacter')); this.draw(); this._updateStatus(); return; }
      const W=Math.max(600,this.pane.clientWidth||900);
      const H=Math.max(400,this.pane.clientHeight||600);
      const pos=loadPositions(this._scope());
      // โหนดที่เลือก/โฟกัสอยู่ต้องรอดการโหลดใหม่ (วัตถุใหม่ทั้งชุด → จับด้วยคีย์)
      const selKey=this._sel?nodeKey(this._sel):'';
      this.nodes = ents.map((e)=>({...e, x:0,y:0,z:0}));
      seedLayout(this.nodes,pos,{width:W,height:H,depth:400});
      // ความสัมพันธ์อ้างถึงกันด้วย "ชื่อ" → ถ้าชื่อซ้ำข้ามหมวด ให้เอนทิตี้ Wiki ชนะฉาก/บทเสมอ
      const byName={};
      for(const n of this.nodes){
        const cur=byName[n.name];
        if(!cur||(WIKI_CATS.has(n.cat)&&!WIKI_CATS.has(cur.cat)))byName[n.name]=n;
      }
      this.edges=[];const seen=new Set();
      for(const n of this.nodes){for(const r of n.relationships||[]){const t=byName[r.targetName||r.target];if(!t||t===n)continue;const k=edgeKey(n,t);if(seen.has(k))continue;seen.add(k);this.edges.push({a:n,b:t,role:r.role||'',type:r.type||categorizeRole(r.role)});}}
      await this._loadCoOccur(byName,seen);
      this._linkStructNodes(byName,seen);
      // [alpha.73 ข้อ 1] จัดผังเฉพาะ "โหนดที่ยังไม่เคยมีตำแหน่ง"
      const fresh=this.nodes.filter(n=>n._fresh);
      if(fresh.length){
        const frozen=new Set(this.nodes.filter(n=>!n._fresh));
        forceLayout(this.nodes,this.edges,{width:W,height:H,depth:400,iters:280,pinned:frozen});
      }
      savePositions(this.nodes,this._scope());
      this._deg=degreeMap(this.nodes,this.edges);this._degMax=0;this._scCount=null;
      this._sel=selKey?this.nodes.find(n=>nodeKey(n)===selKey)||null:null;
      if(!this._sel){this._focusHops=0;}
      this._path=null;
      this._vfCache=null;
      this._progCache=null;                        // [รอบ 2] โหนดชุดใหม่ (วัตถุใหม่) — แคชไทม์ไลน์เรื่องอ้างของเก่า
      this._storyBar&&this._storyBar.update();
      this._fit();if(!this._camTouched)this._fitView();this.draw();this._updateMinimap();
      this._side && this._side.update();
    }catch(e){console.error('SN refresh error:',e?.message||e);}
  }

  /**
   * เส้น "ปรากฏร่วม" (co-occur) = สองเอนทิตี้อยู่ในฉากเดียวกันอย่างน้อย 2 ฉาก
   * [รอบ 2 · bug hunt] เดิมนับจาก `state.meta.backlinks` **ก่อน** สร้างดัชนี (ensureAutoLink อยู่ท้ายฟังก์ชัน)
   * → เปิดผังครั้งแรกของโปรเจกต์ไม่มีเส้นปรากฏร่วมเลย (ต้องกดรีเฟรชอีกรอบ) · และเดินคีย์ไฟล์เองอีกชุดซ้ำกับ _linkEntToScenes
   * ตอนนี้: เชื่อมเอนทิตี้กับฉากก่อน (ดัชนีสด) แล้วนับฉากร่วมจากเส้นเหล่านั้นตรง ๆ — แหล่งเดียว ผลตรงกันเสมอ
   */
  async _loadCoOccur(byName,seen) {
    try {
      if(!state.root)return;
      await this._linkEntToScenes(byName,seen);
      for(const {a,b,count} of coOccurPairs(this.edges,2)){
        const k=edgeKey(a,b);if(seen.has(k))continue;
        seen.add(k);this.edges.push({a,b,role:'co-occur '+count,type:'co-occur',count});
      }
    }catch{}
  }

  async _linkEntToScenes(byName,seen){
    await ensureAutoLink();
    const ents=this.nodes.filter(n=>WIKI_CATS.has(n.cat||''));
    const scs=this.nodes.filter(n=>n.cat==='scene');
    if(!ents.length||!scs.length)return;
    const bySid={};
    for(const n of scs){
      if(n.sid){const s=String(n.sid).toLowerCase();if(!bySid[s])bySid[s]=[];bySid[s].push(n);}
    }
    for(const ent of ents){
      if(!ent.file)continue;
      const bks=getBacklinksFor(ent.file);
      if(!bks||!bks.length)continue;
      for(const bk of bks){
        const sns=bySid[String(bk.sceneId).toLowerCase()];
        if(!sns)continue;
        for(const sn of sns){
          const ek=edgeKey(ent,sn)+'+esc';
          if(seen.has(ek))continue;
          seen.add(ek);
          this.edges.push({a:ent,b:sn,role:tt('ui.net.mention'),type:'ent-scene'});
        }
      }
    }
  }

  _linkStructNodes(byName,seen) {
    const scs=this.nodes.filter(n=>n.cat==='scene');
    const chs=this.nodes.filter(n=>n.cat==='chapter');
    for(const s of scs){
      const chId=(s.chapterId||s.ch||'').toLowerCase();
      const ch=chs.find(c=>(c.name||'').toLowerCase()===chId||(c.chName||'').toLowerCase()===chId);
      if(!ch)continue;
      const k=edgeKey(s,ch);if(seen.has(k))continue;
      seen.add(k);this.edges.push({a:s,b:ch,role:tt('ui.net.msg'),type:'scene-link'});
    }
    const secs=this.nodes.filter(n=>n.cat==='section');
    for(const ch of chs){
      if(!ch.sectionName)continue;
      const sec=secs.find(s=>(s.name||'').toLowerCase()===ch.sectionName.toLowerCase());
      if(!sec)continue;
      const k=edgeKey(ch,sec);if(seen.has(k))continue;
      seen.add(k);this.edges.push({a:ch,b:sec,role:tt('ui.net.msg'),type:'scene-link'});
    }
  }

  /**
   * [alpha.72 ข้อ 1] ขนาดผืนวาดต้องเท่ากับกล่อง CSS "เป๊ะ ๆ"
   * แผงที่ยังไม่มีขนาด (ซ่อนอยู่) = ข้ามไป ไม่ตั้งเป็น 0 (จะล้างภาพทิ้งเปล่า ๆ)
   * [alpha.166] ขนาดเปลี่ยน → จุดโฟกัสยังอยู่กลางจอเอง (กล้องเก็บเป็นพิกัดโลก ไม่ใช่ระยะเลื่อนพิกเซล)
   */
  _fit() {
    const r=this.pane.getBoundingClientRect();
    const w=Math.round(r.width),h=Math.round(r.height);
    if(w<2||h<2)return;
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;if(!this._camTouched)this._fitView();}
  }

  /**
   * [alpha.164 ข้อ A9] ★ จัดกล้องให้เห็นโหนดทั้งหมด · [alpha.166] คิดในแกนที่หมุนแล้ว (ใช้ได้ทั้ง 2D/3D)
   * @returns {boolean} true = จัดแล้ว
   */
  _fitView(){
    const w=this.canvas.width,h=this.canvas.height;
    if(!w||!h||!this.nodes.length)return false;
    // [alpha.167] เว้นที่ให้แคปซูลเครื่องมือด้านบน + บรรทัดคำแนะนำด้านล่าง (เดิมโหนดแถวบนสุดจมใต้แถบ)
    const top=h>300?56:0, bottom=h>300?30:0;
    const f=fitCam(this.nodes,w,h-top-bottom,this._rot(),{pad:Math.min(90,Math.max(40,w*0.06))});
    if(!f)return false;
    this._cam=panCam({...this._cam,...f},0,(top-bottom)/2,this._rot());
    return true;
  }

  /** รัศมีของโหนดบนผัง (หน่วยโลก) — ตัววาดกับตัวจับคลิกใช้ค่าเดียวกัน */
  _nodeR(n){
    const ns=this._nodeScale||1;
    const baseR=(isStruct(n)?10:14)*ns;
    const degree=this._deg.get(n)||0;
    let r=Math.max(baseR,Math.min(28*ns,baseR+degree*0.6*ns));
    const m=this._showImages?this.modelOf(n):null;
    if(m&&modelState(m.abs)!=='error')r*=1.9*m.scale;
    // [alpha.167] ซูมออกแล้วโหนดเหลือจุด 2 พิกเซล (ผังจริงพอดีจอที่ซูม ~15%) — ขนาดบนจอมีขั้นต่ำตามความสำคัญ
    // (ตัวเชื่อมเยอะ = ใหญ่กว่า เหมือนศูนย์กลางของเครือข่าย) · ซูม 100% ขึ้นไปเท่าเดิมทุกพิกเซล
    const s=this._cam.scale||1;
    if(s<1){
      const imp=this._importance(n);
      const minPx=(isStruct(n)?5:7+imp*13)*ns;
      if(r*s<minPx)r=minPx/s;
    }
    return r;
  }
  /** ความสำคัญ 0..1 ของโหนด (จำนวนเส้นเทียบกับตัวที่เส้นเยอะสุด · รากที่สอง = ตัวกลาง ๆ ไม่จมหาย) */
  _importance(n){
    if(!this._degMax){ let m=1; for(const v of this._deg.values())if(v>m)m=v; this._degMax=m; }
    return Math.sqrt((this._deg.get(n)||0)/this._degMax);
  }
  /** จำนวนฉากที่เอนทิตีปรากฏ (เส้น "กล่าวถึงในฉาก") — ตัวเลขเล็ก ๆ ข้างป้ายชื่อ */
  _sceneCount(n){
    if(!this._scCount){
      const m=new Map();
      for(const e of this.edges)if(e.type==='ent-scene'){const ent=isStruct(e.a)?e.b:e.a;m.set(ent,(m.get(ent)||0)+1);}
      this._scCount=m;
    }
    return this._scCount.get(n)||0;
  }

  /** โหนด/เส้นที่ "เด่น" ตอนนี้ (เส้นทาง > โฟกัส > ทั้งหมด) — null = ทุกตัวเด่นเท่ากัน */
  _emphasis(){
    if(this._path)return { nodes:new Set(this._path.nodes), edges:new Set(this._path.edges) };
    if(this._sel&&this._focusHops>0){
      const ego=egoSet(this._sel,this.edges,this._focusHops);
      const es=new Set(this.edges.filter(e=>ego.has(e.a)&&ego.has(e.b)));
      return { nodes:new Set(ego.keys()), edges:es };
    }
    return null;
  }

  /** ป้ายของเส้น (ข้อความบนจอ) — ชนิดที่ผังสร้างเองแปลตามภาษา · เดิม "co-occur 3" ภาษาอังกฤษดิบโผล่บนผัง */
  _edgeLabel(e){
    if(e.type==='co-occur')return ttf('ui.netUi.coScenes',e.count||+(String(e.role).match(/\d+/)||[0])[0]||0);
    return e.role||'';
  }

  draw() {
    const c=this.canvas.getContext('2d');const w=this.canvas.width,h=this.canvas.height;
    if(!w||!h)return;
    const pj=this._pj(), rot=pj.rot, s=this._cam.scale, off=this._off();
    c.setTransform(1,0,0,1,0,0);
    c.clearRect(0,0,w,h);
    // [alpha.166] ฉากหลัง (ธีม · อวกาศ · แผนที่ wargame · พิมพ์เขียว · กระดาษเก่า · รูปของผู้ใช้) + กริดบนระนาบของโลก
    // [รอบ 2] แคชทั้งผืน — วาดใหม่เฉพาะตอนกล้อง/ค่าฉากหลังเปลี่ยน (ชี้เมาส์ไม่ต้องวาดกริดหกเหลี่ยมพันช่องใหม่)
    const img=this._bgImage();
    const cam=this._cam;
    const sky=this._standK();                     // [alpha.167] 0 = 2D · 1 = 3D (skybox) · ระหว่างสลับ = จางเข้าหากัน
    const bgKey=[w,h,cam.tx,cam.ty,cam.tz,s,rot.rx,rot.ry,pj.persp,sky,this._bg,this._grid,this._showGrid,img?img.src:'',
                 JSON.stringify(this._scene.bg),JSON.stringify(this._scene.grid)].join('|');
    drawNetBackgroundCached(c,w,h,pj,this._scene,{bg:this._bg,grid:this._grid},{image:img,showGrid:this._showGrid,cam,sky},bgKey);
    c.save();
    c.translate(off.cx,off.cy);c.scale(s,s);

    if(!this.nodes.length){
      c.restore();c.fillStyle=THEME.canvas.axis;c.font='15px sans-serif';c.textAlign='center';
      c.fillText(tt('ui.net.notHasWiki'),w/2,h/2-10);c.font='12px sans-serif';
      c.fillText(tt('ui.net.newCharacterPlaceLegend'),w/2,h/2+14);
      this._updateStatus();return;
    }
    // [alpha.164 ข้อ A9] ชื่อโหนดอ่านออกเสมอ — ตัวหนังสือถูกย่อตาม scale ของกล้อง
    const ls=Math.max(1,1/(s||1));

    const at=this._typeFilter.size===REL_TYPES.length+3;
    const {q,m,visible}=this._visFilter();
    const emph=this._emphasis();
    const prog=this._progress();                 // [รอบ 2] ไทม์ไลน์เรื่อง: ของที่ยังไม่เกิด = เงาจาง ๆ

    const visNodes=[];const visSet=new Set();
    for(const n of this.nodes){ if(!visible(n))continue; visNodes.push(n); visSet.add(n); }

    // [รอบ 2] ตัวฉายตัวเดียว (มุมมองระยะ) — ตำแหน่งในแกนจอ + ตัวคูณขนาดตามความลึก
    const V=new Map();
    for(const n of this.nodes)V.set(n,pj.view(n));
    const P=(n)=>V.get(n)||{x:n.x,y:n.y,z:0,f:1};
    const is3=this._cam.mode3D||!!this._rotAnim;

    const sortedEdges=is3
      ?[...this.edges].sort((a,b)=>((P(b.a).z+P(b.b).z)-(P(a.a).z+P(a.b).z)))
      :this.edges;
    const focusEnds=new Set([this._hoverNode,this._sel].filter(Boolean));
    // [alpha.167] พื้นมืด = แสงบวกกัน (เส้น/โหนดเรืองแสงแบบผังเครือข่ายสมัยใหม่) · พื้นสว่าง = วาดทับธรรมดา
    const dark=!isLightBg(this._scene,this._bg);
    const px=1/(s||1);                              // หนึ่งพิกเซลบนจอ ในหน่วยโลก

    // [alpha.167] ป้ายชื่อโหนดจัดวางก่อน — ป้ายเส้นต้องหลบทั้งโหนดและป้ายชื่อ (เดิม "ลูกน้อง" ทับชื่อ "ลูน่า")
    const sortedNodes=is3?[...visNodes].sort((a,b)=>P(b).z-P(a).z):visNodes;
    const labelOk=this._placeLabels(c,sortedNodes,P,s,ls,prog);
    const edgeLbls=[];

    // edges
    for(const e of sortedEdges){
      const aVis=visSet.has(e.a),bVis=visSet.has(e.b);
      if(!aVis&&!bVis)continue;
      const pa=P(e.a),pb=P(e.b);
      if(pa.behind||pb.behind)continue;
      let alpha=at||this._typeFilter.has(e.type)?1:0.08;
      const color=this._edgeCol[e.type]||THEME.canvas.grid;let lw=2.0;
      const rel=isRelationEdge(e);
      if(e.type==='co-occur'){lw=1.1;if(alpha===1)alpha=0.4;c.setLineDash([4*px,3*px]);}
      else if(e.type==='scene-link'){lw=1.2;if(alpha===1)alpha=0.45;c.setLineDash([3*px,4*px]);}
      else if(e.type==='ent-scene'){lw=1;if(alpha===1)alpha=0.35;c.setLineDash([5*px,4*px,2*px,4*px]);}
      else c.setLineDash([]);
      const isHover=this._hoverNode&&(e.a===this._hoverNode||e.b===this._hoverNode);
      const onPath=this._path&&emph&&emph.edges.has(e);
      if(emph&&!emph.edges.has(e))alpha*=0.08;
      const ghost=prog&&!prog.edges.has(e);
      if(ghost)alpha*=0.05;
      const hot=(isHover||onPath)&&!ghost;
      if(hot){lw=onPath?3.4:2.6;alpha=1;}
      lw*=Math.sqrt((pa.f+pb.f)/2)*Math.max(px,1/Math.max(1,s*1.4));
      // ความสัมพันธ์ที่ผู้เขียนตั้ง = เส้นโค้งนุ่ม ๆ + ลำแสงเรียวจากโหนดใหญ่ไปโหนดเล็ก · เส้นที่ผังสร้างเอง = เส้นตรงบาง
      const ctl=rel?{x:(pa.x+pb.x)/2-(pb.y-pa.y)*0.08,y:(pa.y+pb.y)/2+(pb.x-pa.x)*0.08}:null;
      if(rel&&alpha>0.05){
        const ra=this._nodeR(e.a)*Math.min(1.6,pa.f), rb=this._nodeR(e.b)*Math.min(1.6,pb.f);
        const wa=ra*(hot?0.5:0.34), wb=rb*(hot?0.5:0.34);
        const N=14, L=[], R=[];
        for(let i=0;i<=N;i++){
          const t=i/N, p=qpt(pa,ctl,pb,t), q=qpt(pa,ctl,pb,Math.min(1,t+0.02)), q0=qpt(pa,ctl,pb,Math.max(0,t-0.02));
          const dx=q.x-q0.x, dy=q.y-q0.y, dl=Math.hypot(dx,dy)||1;
          // เรียวตรงกลาง (เหมือนลำแสงที่พุ่งออกจากทั้งสองโหนด) ไม่ใช่ท่อกว้างเท่ากันตลอด
          const wv=(wa*(1-t)+wb*t)*(0.35+0.65*Math.pow(Math.abs(t-0.5)*2,1.6));
          L.push({x:p.x-dy/dl*wv,y:p.y+dx/dl*wv}); R.push({x:p.x+dy/dl*wv,y:p.y-dx/dl*wv});
        }
        const g=c.createLinearGradient(pa.x,pa.y,pb.x,pb.y);
        const ca=this._catCol[e.a.cat]||color, cb=this._catCol[e.b.cat]||color;
        g.addColorStop(0,hexToRgba(ca,0.55));g.addColorStop(0.5,hexToRgba(color,0.28));g.addColorStop(1,hexToRgba(cb,0.55));
        c.save();
        if(dark)c.globalCompositeOperation='lighter';
        c.globalAlpha=alpha*(hot?1:0.8);c.fillStyle=g;
        c.beginPath();c.moveTo(L[0].x,L[0].y);for(const p of L)c.lineTo(p.x,p.y);for(let i=R.length-1;i>=0;i--)c.lineTo(R[i].x,R[i].y);c.closePath();c.fill();
        c.restore();
      }
      c.globalAlpha=alpha;c.strokeStyle=rel?shadeHex(color,dark?0.35:-0.1,hot?1:0.85):color;c.lineWidth=rel?Math.max(lw*0.55,0.8*px):lw;
      if(hot){c.shadowColor=hexToRgba(color,0.7);c.shadowBlur=12;}
      c.beginPath();c.moveTo(pa.x,pa.y);
      if(ctl)c.quadraticCurveTo(ctl.x,ctl.y,pb.x,pb.y);else c.lineTo(pb.x,pb.y);
      c.stroke();c.setLineDash([]);c.shadowBlur=0;
      // [รอบ 2] ป้ายเส้นรกเต็มจอในผังใหญ่ ("กล่าวถึง/อยู่ใน" ทุกเส้น) — ค่าเริ่มต้นโชว์เฉพาะความสัมพันธ์ที่ผู้เขียนตั้ง
      // เส้นของโหนดที่ชี้/เลือกอยู่โชว์เสมอ · ทั้งหมด/ซ่อน สลับได้ที่ปุ่มบนแถบ
      const lbl=this._edgeLabel(e);
      const mode=this._edgeLabels;
      const touching=focusEnds.has(e.a)||focusEnds.has(e.b);
      const want=mode==='all'||touching||(mode==='rel'&&isRelationEdge(e));
      if(lbl&&want&&alpha>0.3){
        const mid=ctl?qpt(pa,ctl,pb,0.5):{x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};
        edgeLbls.push({lbl,mid,fs:(isHover?11.5:10.5)*ls,ring:hot?color:'',alpha,pri:hot?1e6:touching?1e5:rel?10:0});
      }
      c.globalAlpha=1;
    }

    // ป้ายเส้น: วางตามความสำคัญ ข้ามตัวที่ทับโหนด/ป้ายชื่อ/ป้ายเส้นที่วางแล้ว (ชี้/เลือกอยู่ = วางเสมอ)
    if(edgeLbls.length){
      edgeLbls.sort((a,b)=>b.pri-a.pri);
      const taken=labelOk.boxes||[];
      for(const L of edgeLbls){
        c.font=L.fs+'px "Segoe UI","Leelawadee UI",sans-serif';
        const bw=(c.measureText(L.lbl).width+L.fs*1.1)*s, bh=L.fs*1.75*s;
        const b={x0:L.mid.x*s-bw/2,x1:L.mid.x*s+bw/2,y0:L.mid.y*s-bh/2,y1:L.mid.y*s+bh/2};
        if(this._declutter&&L.pri<1e5&&taken.some((o)=>b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0))continue;
        taken.push(b);
        c.globalAlpha=L.alpha;drawEdgeLabel(c,L.lbl,L.mid.x,L.mid.y,L.fs,L.ring);c.globalAlpha=1;
      }
    }

    // [alpha.166] ลากผูกความสัมพันธ์: เส้นประจากโหนดต้นทางถึงเมาส์
    if(this._linkDrag){
      const pa=P(this._linkDrag.from);
      c.save();c.setLineDash([6,5]);c.lineWidth=2.4*ls;c.strokeStyle=THEME.canvas.hover;c.globalAlpha=0.9;
      c.beginPath();c.moveTo(pa.x,pa.y);c.lineTo(this._linkDrag.x,this._linkDrag.y);c.stroke();c.restore();
    }

    const dpr=window.devicePixelRatio||1;

    for(const n of sortedNodes){
      const pp=P(n);
      if(pp.behind)continue;
      const vt=tagStyle(n);
      const isHov=n===this._hoverNode||(this._linkDrag&&this._linkDrag.over===n);
      const isSel=n===this._sel;
      const struct=isStruct(n);
      const ghost=prog&&!prog.nodes.has(n);
      const faded=(emph&&!emph.nodes.has(n))||ghost;
      let r=this._nodeR(n)*Math.min(1.6,pp.f);          // มุมมองระยะ: ของใกล้ใหญ่ขึ้นได้ไม่เกิน 2 เท่า (อ่านป้ายรอบ ๆ ได้)
      if(isHov)r+=4;
      const nx=pp.x, ny=pp.y;
      const col=this._catCol[n.cat]||THEME.edge['ent-scene'];
      if(faded)c.globalAlpha=ghost?0.08:0.14;

      // [alpha.167] รัศมีเรืองแสง — ตัวสำคัญ (เส้นเยอะ) ฟุ้งกว้างกว่า · ชี้เมาส์ = สว่างขึ้น
      const imp=this._importance(n);
      if(!faded&&(dark||isHov)){
        const gr=r*(isHov?2.6:1.9+imp*1.6);
        const glow=c.createRadialGradient(nx,ny,r*0.6,nx,ny,gr);
        glow.addColorStop(0,hexToRgba(col,isHov?0.55:0.22+imp*0.3));glow.addColorStop(1,hexToRgba(col,0));
        c.save();if(dark)c.globalCompositeOperation='lighter';
        c.fillStyle=glow;c.beginPath();c.arc(nx,ny,gr,0,Math.PI*2);c.fill();c.restore();
      }
      // [alpha.166] โมเดล 3 มิติแทนวงกลม (หมุนตามกล้องจริง) — ยังไม่พร้อม = วาดวงกลมไปก่อน
      const mdl=this._showImages&&!struct?this.modelOf(n):null;
      const spr=mdl?modelSprite(mdl.abs,{rx:rot.rx,ry:rot.ry,yaw:(mdl.yaw||0)*Math.PI/180,stand:this._standK(),px:r*2*s*dpr,color:col}):null;
      if(spr){
        // เงาบนพื้น — บอกตำแหน่งจริงของโหนด (โมเดลบางตัวทรงเตี้ย/ลอย)
        c.save();c.globalAlpha*=0.35;c.fillStyle=THEME.canvas.border;
        c.beginPath();c.ellipse(nx,ny+r*0.82,r*0.62,r*0.16,0,0,Math.PI*2);c.fill();c.restore();
        c.drawImage(spr,nx-r,ny-r,r*2,r*2);
      }else{
        const hasImg=this._showImages&&n.image&&n._img&&!struct;
        if(vt){c.beginPath();c.fillStyle=vt.color;c.arc(nx,ny,r+3.5*Math.max(px,Math.min(1,r/14)),0,Math.PI*2);c.fill();}
        if(struct){
          // ฉาก/บท/เล่ม = แผ่นมุมมน (แยกจากตัวละคร/สถานที่ที่เป็นทรงกลมได้ด้วยตา)
          const sw2=r*1.7,sh2=r*1.3;
          const g=c.createLinearGradient(nx,ny-sh2/2,nx,ny+sh2/2);
          g.addColorStop(0,shadeHex(col,0.25));g.addColorStop(1,shadeHex(col,-0.25));
          c.fillStyle=g;roundRect(c,nx-sw2/2,ny-sh2/2,sw2,sh2,Math.min(sw2,sh2)*0.28);c.fill();
          c.strokeStyle=isHov?THEME.canvas.hover:hexToRgba(THEME.canvas.label,0.28);
          c.lineWidth=(isHov?2:1)*px;c.stroke();
        }else{
          // ทรงกลมมันวาว: จุดสะท้อนแสงมุมซ้ายบน → สีหมวด → ขอบเข้ม
          const sg=c.createRadialGradient(nx-r*0.35,ny-r*0.4,r*0.08,nx,ny,r);
          sg.addColorStop(0,shadeHex(col,0.6));sg.addColorStop(0.5,shadeHex(col,0));sg.addColorStop(1,shadeHex(col,-0.45));
          c.beginPath();c.fillStyle=hasImg?col:sg;c.arc(nx,ny,r,0,Math.PI*2);c.fill();
          if(hasImg){
            const iw=n._img.naturalWidth||1, ih=n._img.naturalHeight||1;
            const side=Math.min(iw,ih);
            const sxi=(iw-side)/2, syi=(ih-side)/2;
            c.save();c.beginPath();c.arc(nx,ny,r-1,0,Math.PI*2);c.clip();
            c.drawImage(n._img,sxi,syi,side,side,nx-r+1,ny-r+1,(r-1)*2,(r-1)*2);
            c.restore();
          }
          c.beginPath();c.arc(nx,ny,r,0,Math.PI*2);
          if(hasImg){c.strokeStyle=col;c.lineWidth=Math.max(3,2.5*px);}
          else{c.strokeStyle=isHov?THEME.canvas.hover:hexToRgba(THEME.canvas.label,dark?0.35:0.5);c.lineWidth=(isHov?2:1)*px;}
          c.stroke();
          if(hasImg&&isHov){c.beginPath();c.arc(nx,ny,r+2*px,0,Math.PI*2);
            c.strokeStyle=THEME.canvas.hover;c.lineWidth=2*px;c.stroke();}
          // ตัวศูนย์กลางของเครือข่าย = วงแหวนแก้วรอบนอก (แบบโหนดหลักในผังนโยบาย/วงโคจร)
          if(imp>0.55&&!faded){
            c.beginPath();c.arc(nx,ny,r*1.38,0,Math.PI*2);
            c.strokeStyle=hexToRgba(THEME.canvas.label,0.22+imp*0.2);c.lineWidth=1.2*px;c.stroke();
            c.beginPath();c.arc(nx,ny,r*1.38,-Math.PI*0.85,-Math.PI*0.35);
            c.strokeStyle=hexToRgba(col,0.9);c.lineWidth=2*px;c.stroke();
          }
        }
        c.shadowBlur=0;
      }
      // [alpha.166] โหนดที่เลือก = วงแหวนสองชั้น (เห็นได้ทั้งบนพื้นมืดและพื้นสว่าง)
      if(isSel){
        c.beginPath();c.arc(nx,ny,r+6*ls,0,Math.PI*2);c.lineWidth=2.6*ls;c.strokeStyle=THEME.canvas.hover;c.stroke();
        c.beginPath();c.arc(nx,ny,r+9.5*ls,0,Math.PI*2);c.lineWidth=1.4*ls;c.strokeStyle=col;c.stroke();
      }
      // [รอบ 2] ไทม์ไลน์เรื่อง: ฉากปัจจุบัน + ตัวที่เพิ่งปรากฏครั้งแรกในฉากนี้ = วงแหวนสีเน้น
      if(prog&&!ghost&&(n===prog.current||prog.fresh.has(n))){
        c.beginPath();c.arc(nx,ny,r+5*ls,0,Math.PI*2);c.lineWidth=2.4*ls;c.strokeStyle=THEME.edge.ally;
        c.setLineDash(n===prog.current?[]:[4*ls,3*ls]);c.stroke();c.setLineDash([]);
      }

      if(q&&m.has(n)&&!this._rafId){
        c.beginPath();c.strokeStyle=THEME.edge.ally;c.lineWidth=2.6*ls;c.globalAlpha=0.5+Math.sin(performance.now()*0.005)*0.5;
        c.arc(nx,ny,r+5*ls,0,Math.PI*2);c.stroke();c.globalAlpha=faded?0.14:1;
      }

      // ป้ายชื่อ — ปิดได้ด้วยปุ่ม · [รอบ 2] ป้ายที่ทับกันถูกหลบ (ตัวสำคัญก่อน) · ชี้เมาส์/เลือกอยู่โชว์เสมอ
      // [alpha.167] ป้ายอยู่ขวาของโหนด (ไม่มีกล่องทึบ — เงาเรืองรอบตัวอักษรพอให้อ่านบนทุกพื้น) + ตัวเลขฉากที่ปรากฏ
      if(labelOk.has(n)){
        const lb=labelOk.get(n);
        drawNodeLabel(c,lb.text,nx+r+lb.gap,ny,lb.fs,lb.badge,lb.strong,col);
      }
      c.globalAlpha=1;
    }

    c.restore();
    this._drawAxis(c);
    this._updateStatus();
    if(q&&m.size&&!this._rafId)this._rafId=requestAnimationFrame(()=>{this._rafId=null;this.draw();});
  }

  /**
   * [รอบ 2] เลือกป้ายชื่อที่จะวาด — ผังใหญ่ ป้ายทับกันจนอ่านไม่ออกสักตัว
   * วางตามลำดับความสำคัญ (ชี้/เลือกอยู่ → ฉากปัจจุบัน → จำนวนเส้นมาก → อยู่ใกล้กล้อง) แล้วข้ามตัวที่ทับกรอบที่วางไปแล้ว
   * @returns {Map<node,{text:string, fs:number}>}
   */
  _placeLabels(c,nodes,P,s,ls,prog){
    const out=new Map();
    if(!nodes.length)return out;
    const cand=[];
    for(const n of nodes){
      const pp=P(n); if(pp.behind)continue;
      const isHov=n===this._hoverNode, isSel=n===this._sel;
      if(!this._showLabels&&!isHov&&!isSel)continue;
      if(prog&&!prog.nodes.has(n)&&!isHov&&!isSel)continue;      // ยังไม่เกิดในเรื่อง = ไม่มีป้าย
      const vt=tagStyle(n);
      const text=(vt&&vt.icon?vt.icon+' ':'')+(n.name.length>22?n.name.slice(0,21)+'…':n.name);
      const imp=this._importance(n);
      const strong=isHov||isSel||imp>0.55;
      const fs=(isHov||isSel?12.5:isStruct(n)?10:10.5+imp*2)*ls*Math.min(1.25,Math.max(0.8,pp.f));
      const pri=(isHov||isSel?1e6:0)+(prog&&(n===prog.current||prog.fresh.has(n))?1e5:0)+(this._deg.get(n)||0)*10+(isStruct(n)?0:1000)-pp.z*0.001;
      const badge=isStruct(n)?'':(this._sceneCount(n)?String(this._sceneCount(n)):'');
      cand.push({n,text,fs,pri,pp,strong,badge});
    }
    cand.sort((a,b)=>b.pri-a.pri);
    const boxes=[];
    // โหนดเองก็เป็นสิ่งกีดขวาง — ป้ายห้ามทับวงกลมของโหนดอื่น
    for(const n of nodes){ const pp=P(n); if(pp.behind)continue; const r=this._nodeR(n)*Math.min(1.6,pp.f)*s;
      boxes.push({x0:pp.x*s-r,x1:pp.x*s+r,y0:pp.y*s-r,y1:pp.y*s+r,node:n}); }
    for(const k of cand){
      c.font=(k.strong?'600 ':'')+k.fs+'px "K2 Icons","Segoe UI","Leelawadee UI",sans-serif';
      const gap=7*ls;
      const wW=(c.measureText(k.text).width+(k.badge?k.fs*2.4:0)+4*ls)*s, hW=k.fs*1.35*s;          // กรอบบนจอ (พิกเซล)
      const r=this._nodeR(k.n)*Math.min(1.6,k.pp.f);
      const x0=(k.pp.x+r+gap)*s, cy=k.pp.y*s;
      const b={x0,x1:x0+wW,y0:cy-hW/2,y1:cy+hW/2};
      const hit=this._declutter&&k.pri<1e5&&boxes.some((o)=>o.node!==k.n&&b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0);
      if(hit)continue;
      boxes.push(b);
      out.set(k.n,{text:k.text,fs:k.fs,gap,badge:k.badge,strong:k.strong});
    }
    out.boxes=boxes;
    return out;
  }

  /**
   * [alpha.73 ข้อ 4] แกนบอกทิศที่มุมล่างซ้ายของผัง — ลูกศรหมุนตามมุมกล้องที่ใช้วาดจริง (รวมตอนกำลังสลับโหมด)
   */
  _drawAxis(c){
    const w=this.canvas.width,h=this.canvas.height;
    if(w<160||h<120)return;
    const ox=34,oy=h-34,len=22;
    const r=this._rot();
    const is3=this._cam.mode3D||!!this._rotAnim;
    const ax=axisVectors(r.rx,r.ry,is3);
    const axes=[['X',ax.x,THEME.node.characters],['Y',ax.y,THEME.node.items]];
    if(ax.z)axes.push(['Z',ax.z,THEME.node.locations]);
    c.save();
    c.globalAlpha=0.85;c.lineWidth=1.6;c.font='11px sans-serif';
    c.textAlign='center';c.textBaseline='middle';
    for(const [name,v,col] of axes){
      const ex=ox+v.x*len, ey=oy+v.y*len;
      c.strokeStyle=col;c.fillStyle=col;
      c.beginPath();c.moveTo(ox,oy);c.lineTo(ex,ey);c.stroke();
      c.beginPath();c.arc(ex,ey,2.2,0,Math.PI*2);c.fill();
      c.fillText(name,ox+v.x*(len+8),oy+v.y*(len+8));
    }
    c.fillStyle=THEME.canvas.axis;c.globalAlpha=0.6;
    c.beginPath();c.arc(ox,oy,2,0,Math.PI*2);c.fill();
    c.restore();
  }

  /**
   * [alpha.73 ข้อ 4] X/Y/Z = พิกัดโลกของจุดกึ่งกลางจอ · [alpha.166] = จุดโฟกัสของกล้องตรง ๆ
   * (เดิม Z = ค่าเฉลี่ยความลึกของทุกโหนด ซึ่งไม่ใช่ค่าของกล้อง — หมุน/เลื่อนแล้วไม่เปลี่ยนเลย)
   */
  _updateStatus() {
    if(this._legend){
      const cnt={};
      for(const n of this.nodes){const k=n.cat==='section'||n.cat==='book'?'chapter':n.cat;cnt[k]=(cnt[k]||0)+1;}
      this._legend.update(cnt,this._catCol||{});
    }
    if(!this._sb)return;
    const structN=this.nodes.filter(n=>!WIKI_CATS.has(n.cat)).length;
    const st=structN?ttf('ui.net.sceneChapter', structN):'';
    const cam=this._cam;
    this._sb.textContent=ttf('ui.net.line', this.nodes.length, st, this.edges.length)+
      `X ${Math.round(cam.tx)} · Y ${Math.round(cam.ty)} · Z ${Math.round(cam.tz)}`+
      (cam.mode3D?` · ${gi('refresh-thin')} ${Math.round(cam.rx*180/Math.PI)}°,${Math.round(cam.ry*180/Math.PI)}°`:'')+
      ttf('ui.net.zoom', Math.round(cam.scale*100));
  }

  /** [alpha.166] มินิแมปใช้การฉายเดียวกับผังหลัก (เดิมใช้ x/y ดิบ = ผิดทั้งผังตอนเป็น 3D) */
  _updateMinimap() {
    if(!this._showMinimap||!this._mm||this._mm.style.display==='none')return;
    const c=this._mm.getContext('2d');const mw=160,mh=120;
    c.clearRect(0,0,mw,mh);c.fillStyle=hexToRgba(THEME.canvas.labelBg,0.92);c.fillRect(0,0,mw,mh);
    if(!this.nodes.length){c.strokeStyle=THEME.canvas.grid;c.strokeRect(0,0,mw,mh);return;}
    const rot=this._rot();
    const pts=this.nodes.map(n=>({n,p:rot3(n,rot.rx,rot.ry)}));
    let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
    for(const {p} of pts){if(p.x<mnx)mnx=p.x;if(p.y<mny)mny=p.y;if(p.x>mxx)mxx=p.x;if(p.y>mxy)mxy=p.y;}
    const pw=mxx-mnx||200,ph=mxy-mny||200;
    const s=Math.min((mw-20)/pw,(mh-20)/ph);
    const ox=10+(mw-20-pw*s)/2,oy=10+(mh-20-ph*s)/2;
    for(const {n,p} of pts){
      c.fillStyle=this._catCol[n.cat]||THEME.edge['ent-scene'];c.beginPath();c.arc(ox+(p.x-mnx)*s,oy+(p.y-mny)*s,2.5,0,Math.PI*2);c.fill();
    }
    const T=rot3({x:this._cam.tx,y:this._cam.ty,z:this._cam.tz},rot.rx,rot.ry);
    const vw=this.canvas.width/this._cam.scale,vh=this.canvas.height/this._cam.scale;
    c.strokeStyle=THEME.edge.ally;c.lineWidth=1.5;c.strokeRect(ox+(T.x-vw/2-mnx)*s,oy+(T.y-vh/2-mny)*s,vw*s,vh*s);
  }

  // ── hit / mouse ──
  /** เงื่อนไข "โหนดนี้โผล่ไหม" ชุดเดียวที่ทั้ง draw() และ _hit() ใช้ร่วมกัน */
  _visFilter(){
    if(this._vfCache&&this._vfCache.q===this._searchQuery&&this._vfCache.cf===this._catFilter
       &&this._vfCache.len===this.nodes.length)return this._vfCache;
    const cf=this._catFilter;
    const ac=cf.size===4;
    const q=(this._searchQuery||'').toLowerCase();
    const m=new Set();
    if(q)for(const n of this.nodes)if((n.name||'').toLowerCase().includes(q))m.add(n);
    const visible=(n)=>!((!ac&&!cf.has(n.cat)&&!isStruct(n))||(q&&!m.has(n)));
    this._vfCache={q:this._searchQuery,cf,len:this.nodes.length,ac,m,visible};
    return this._vfCache;
  }

  /** พิกัด "แกนจอ" (ก่อนคูณสเกล) ใต้เมาส์ + โหนดที่อยู่ใต้เมาส์ (ตัวที่อยู่หน้าสุดชนะ) */
  _hit(e){
    const r=this.canvas.getBoundingClientRect();
    const o=this._off(), s=this._cam.scale;
    const sx=(e.clientX-r.left-o.cx)/s;
    const sy=(e.clientY-r.top-o.cy)/s;
    const {visible}=this._visFilter();
    const pj=this._pj();
    const prog=this._progress();
    let best=null,bestZ=Infinity,bestD=Infinity;
    for(const n of this.nodes){
      if(!visible(n))continue;
      if(prog&&!prog.nodes.has(n))continue;          // [รอบ 2] ของที่ยังไม่เกิดในไทม์ไลน์เรื่อง = คลิกทะลุ
      const p=pj.view(n);
      if(p.behind)continue;
      const d=(p.x-sx)**2+(p.y-sy)**2;
      // [alpha.167 · bug hunt] เป้าคลิกคิดเป็นพิกเซลบนจอ — เดิม 20 หน่วยโลก = 3 พิกเซลตอนซูมพอดีจอ (~15%) จนแทบคลิกโหนดไม่โดน
      const rr=Math.max(10/s,this._nodeR(n)*Math.min(1.6,p.f)+4/s);
      if(d>rr*rr)continue;
      // ซ้อนกัน: 3D เลือกตัวที่อยู่หน้าสุด (ความลึกน้อยสุด) · 2D เลือกตัวที่ใกล้เมาส์สุด
      if(p.z<bestZ-1e-6||(Math.abs(p.z-bestZ)<1e-6&&d<bestD)){best=n;bestZ=p.z;bestD=d;}
    }
    return{x:sx,y:sy,node:best};
  }

  _down(e){
    try{this.canvas.focus({preventScroll:true});}catch{}
    const ctl=this._controls||resolveNetControls(null);
    const orbitBtn=buttonIndex(ctl.orbitButton), panBtn=buttonIndex(ctl.panButton);
    if(e.button===orbitBtn&&this._mode3D){
      e.preventDefault();                       // ปุ่มกลางของ Chromium = auto-scroll ต้องกันไว้
      this._rotAnim=null;
      this._orbitDrag={sx:e.clientX,sy:e.clientY,orx:this._cam.rx,ory:this._cam.ry};return;}
    if(e.button!==panBtn)return;
    const{x,y,node}=this._hit(e);
    // [alpha.73 ข้อ 1] ผลักแล้วต้องอยู่ถาวร
    if(node&&e.shiftKey){this._repel(node,x,y);savePositions(this.nodes,this._scope());this.draw();return;}
    // [alpha.166] เลือกปลายทางของ "หาเส้นทาง"
    if(this._pathPick){
      this._pathPick=false;this._syncTip();
      if(node&&this._sel&&node!==this._sel){this.findPath(this._sel,node);return;}
    }
    if(node&&this._tool==='move'){
      this.drag={node,moved:false,sx:e.clientX,sy:e.clientY,start:{x:node.x,y:node.y,z:node.z||0},f:this._pj().view(node).f};return;}
    if(node&&this._tool==='link'&&WIKI_CATS.has(node.cat)){
      this._linkDrag={from:node,x,y,over:null};this.draw();return;}
    if(node){this._clickNode=node;}
    this.pan={sx:e.clientX,sy:e.clientY,cam0:{...this._cam},moved:false};this.canvas.classList.add('net-panning');
  }

  _move(e){
    if(this._orbitDrag){
      this._cam.rx=clampRx(this._orbitDrag.orx+(e.clientY-this._orbitDrag.sy)*0.008);
      this._cam.ry=this._orbitDrag.ory+(e.clientX-this._orbitDrag.sx)*0.008;
      this._camTouched=true;
      this.draw();if(this._showMinimap)this._updateMinimap();return;
    }
    if(this._linkDrag){
      const{x,y,node}=this._hit(e);
      this._linkDrag.x=x;this._linkDrag.y=y;
      this._linkDrag.over=node&&node!==this._linkDrag.from&&WIKI_CATS.has(node.cat)?node:null;
      this.draw();return;
    }
    if(this.pan){
      const dx=e.clientX-this.pan.sx, dy=e.clientY-this.pan.sy;
      this._camTouched=true;this._flyAnim=null;
      this._cam=panCam(this.pan.cam0,dx,dy,this._rot());
      if(Math.abs(dx)+Math.abs(dy)>3)this.pan.moved=true;
      this.draw();if(this._showMinimap)this._updateMinimap();return;}
    if(!this.drag){const{node}=this._hit(e);if(this._hoverNode!==node){this._hoverNode=node;this.draw();}
      this.canvas.style.cursor=node?(this._tool==='link'&&WIKI_CATS.has(node.cat)?'crosshair':'pointer'):'grab';return;}
    // [alpha.166] ลากโหนดบนระนาบที่หันเข้าหากล้อง (3D ลากตามทิศที่เห็นบนจอ · 2D เหมือนเดิม)
    // [รอบ 2] มุมมองระยะ: ของที่อยู่ลึกเคลื่อนบนจอน้อยกว่า → หารด้วยตัวคูณขนาดของโหนดนั้น (ตามเมาส์พอดี)
    const d=this._pj().deltaToWorld(e.clientX-this.drag.sx,e.clientY-this.drag.sy,this.drag.f||1);
    const n=this.drag.node;
    n.x=this.drag.start.x+d.x;n.y=this.drag.start.y+d.y;n.z=this.drag.start.z+d.z;
    this.drag.moved=true;this.draw();if(this._showMinimap)this._updateMinimap();}

  _up(e){
    const clicked=this._clickNode;this._clickNode=null;
    if(this._orbitDrag){this._orbitDrag=null;this._saveCamSoon();return;}
    if(this._linkDrag){
      const ld=this._linkDrag;this._linkDrag=null;
      let target=ld.over;
      if(!target&&e&&Number.isFinite(e.clientX)){const h=this._hit(e);target=h.node;}
      this.draw();
      if(target&&target!==ld.from&&WIKI_CATS.has(target.cat)&&this.onCreateRel){
        Promise.resolve(this.onCreateRel(ld.from,target)).then((ok)=>{ if(ok)this.refresh(); }).catch(()=>{});
      }
      return;
    }
    if(this.pan){const moved=this.pan.moved;this.pan=null;this.canvas.classList.remove('net-panning');
      if(moved){this._saveCamSoon();return;}}
    if(this.drag&&this.drag.moved){this.drag.node._pinned=true;savePositions(this.nodes,this._scope());}
    const wasDrag=!!this.drag;
    this.drag=null;
    if(wasDrag)return;
    // [alpha.166] คลิกโหนด = เลือก (แผงข้างโชว์ข้อมูล) · คลิกที่ว่าง = เลิกเลือก
    if(clicked)this.select(clicked);
    else if(e&&e.target===this.canvas&&!this._pathPick&&this._sel&&!this._focusHops&&!this._path)this.select(null);
    // [alpha.71 ข้อ 3] โหมด เปิด/แก้ไข → คลิกเดียวเปิดได้เลย
    if(clicked&&(this._tool==='open'||this._tool==='edit'))this._openNode(clicked);
  }

  _openNode(node){
    if(!node)return;
    if(isStruct(node)){if(this.onOpenScene)this.onOpenScene(node.file);}
    else if(this.onOpen)this.onOpen(node);
  }

  // ═════════ [alpha.166] เลือก · โฟกัส · เส้นทาง ═════════
  select(node){
    if(node===this._sel)return this._sel;
    this._sel=node||null;
    if(!node){this._focusHops=0;this._path=null;}
    else if(this._path&&!this._path.nodes.includes(node))this._path=null;
    this.draw();this._side&&this._side.update();
    return this._sel;
  }
  /** โฟกัสเฉพาะเครือข่ายรอบโหนดที่เลือก (0 = ปิด · 1–3 ชั้น) */
  setFocus(hops){
    this._focusHops=this._sel?Math.max(0,Math.min(3,hops|0)):0;
    this._path=null;
    this.draw();this._side&&this._side.update();
    return this._focusHops;
  }
  startPathPick(){
    if(!this._sel)return false;
    this._pathPick=true;this._syncTip();
    return true;
  }
  findPath(a,b){
    const p=shortestPath(a,b,this.edges);
    this._path=p?{...p,from:a,to:b}:{nodes:[a,b],edges:[],none:true,from:a,to:b};
    if(p){
      // ย่อ/เลื่อนกล้องให้เห็นทั้งเส้นทาง
      const f=fitCam(p.nodes,this.canvas.width,this.canvas.height,this._rot(),{pad:120,maxScale:Math.max(0.5,this._cam.scale)});
      if(f){this._flyAnim={from:{...this._cam},to:{...this._cam,...f},t0:performance.now(),dur:420};this._touchCam();this._animate();}
    }
    this.draw();this._side&&this._side.update();
    return this._path;
  }
  /** Esc: ล้างเส้นทาง → โฟกัส → การเลือก ทีละชั้น · คืน true = มีอะไรให้ล้าง */
  clearEmphasis(){
    if(this._pathPick){this._pathPick=false;this._syncTip();return true;}
    if(this._path){this._path=null;}
    else if(this._focusHops){this._focusHops=0;}
    else if(this._sel){this._sel=null;}
    else return false;
    this.draw();this._side&&this._side.update();
    return true;
  }
  relationCount(n){ return this.edges.filter(e=>isRelationEdge(e)&&(e.a===n||e.b===n)).length; }

  // ═════════ [รอบ 2] ไทม์ไลน์เรื่อง ═════════
  /**
   * เปิด/ปิด/เลื่อนไทม์ไลน์เรื่อง — st = null (ปิด) | { upTo } (ถึงฉากที่เท่าไร · 0 = ยังไม่เริ่ม)
   * ของที่ "ยังไม่เกิด" ในเรื่องเป็นเงาจาง ๆ คลิกไม่ได้ · ฉากล่าสุดกับตัวที่เพิ่งเข้าเรื่องมีวงแหวนเน้น
   */
  setStory(st){
    if(this._storyTimer&&!st){clearInterval(this._storyTimer);this._storyTimer=null;}
    const total=sceneOrder(this.nodes).length;
    this._story=st?{upTo:Math.max(0,Math.min(total,st.upTo|0))}:null;
    this._progCache=null;
    this._storyBar&&this._storyBar.update();
    this._syncToolbar();this.draw();this._side&&this._side.update();
    return this._story;
  }
  /** เดินหน้าทีละฉากอัตโนมัติ (ถึงฉากสุดท้ายแล้วหยุดเอง) */
  playStory(on){
    if(this._storyTimer){clearInterval(this._storyTimer);this._storyTimer=null;}
    if(on&&this._story){
      const total=sceneOrder(this.nodes).length;
      if(this._story.upTo>=total)this.setStory({upTo:0});
      this._storyTimer=setInterval(()=>{
        if(!this._story){this.playStory(false);return;}
        const t=sceneOrder(this.nodes).length;
        if(this._story.upTo>=t){this.playStory(false);return;}
        this.setStory({upTo:this._story.upTo+1});
      },900);
    }
    this._storyBar&&this._storyBar.update();
    return !!this._storyTimer;
  }
  isStoryPlaying(){ return !!this._storyTimer; }
  /** สภาพของไทม์ไลน์เรื่องเฟรมนี้ (แคช — ตัววาด/ตัวคลิกเรียกบ่อย) */
  _progress(){
    if(!this._story)return null;
    const key=this._story.upTo+'|'+this.nodes.length+'|'+this.edges.length;
    if(!this._progCache||this._progCache.key!==key)this._progCache={key,v:storyProgress(this.nodes,this.edges,this._story.upTo)};
    return this._progCache.v;
  }

  // ═════════ [รอบ 2] จัดผังแบบมีความหมาย ═════════
  _layoutMenu(){
    const b=this._tb.btns.querySelector('[data-act="layout"]');
    const r=b?b.getBoundingClientRect():{left:40,bottom:40};
    popupMenu(r.left,r.bottom+4,[
      {text:tt('ui.netUi.layoutForce'),click:()=>this.applyLayout('force')},
      {text:tt('ui.netUi.layoutCategory'),click:()=>this.applyLayout('category')},
      {text:tt('ui.netUi.layoutStory'),click:()=>this.applyLayout('story'),disabled:!sceneOrder(this.nodes).length},
      {text:tt('ui.netUi.layoutRadial'),click:()=>this.applyLayout('radial'),disabled:!this._sel},
    ]);
  }
  /**
   * จัดผังใหม่ทั้งผัง — โหนดเลื่อนไปที่ใหม่แบบภาพเคลื่อนไหว แล้วถูกปักหมุดทั้งหมด (รีเฟรชแล้วไม่เด้งกลับ)
   * @param {'force'|'category'|'story'|'radial'} kind
   */
  applyLayout(kind){
    if(kind==='force'){this.relayout();return true;}
    let map=null;
    if(kind==='category')map=layoutByCategory(this.nodes);
    else if(kind==='story')map=layoutStory(this.nodes,this.edges,sceneOrder(this.nodes));
    else if(kind==='radial'){if(!this._sel)return false;map=layoutRadial(this._sel,this.nodes,this.edges);}
    if(!map||!map.size)return false;
    const from=new Map(this.nodes.map((n)=>[n,{x:n.x,y:n.y,z:n.z||0}]));
    this._layoutAnim={from,to:map,t0:performance.now(),dur:650};
    this._animate();
    return true;
  }
  _finishLayout(){
    const a=this._layoutAnim; if(!a)return;
    for(const [n,p] of a.to){n.x=p.x;n.y=p.y;n.z=p.z;n._pinned=true;}
    this._layoutAnim=null;
    savePositions(this.nodes,this._scope());
    const f=fitCam(this.nodes,this.canvas.width,this.canvas.height,this._rot());
    if(f){this._flyAnim={from:{...this._cam},to:{...this._cam,...f},t0:performance.now(),dur:420};this._touchCam();this._animate();}
  }

  // ═════════ [รอบ 2] ป้ายเส้น · ค้นหา ═════════
  cycleEdgeLabels(){
    const order=['rel','all','none'];
    this._edgeLabels=order[(order.indexOf(this._edgeLabels)+1)%order.length];
    this._syncToolbar();this.draw();
    return this._edgeLabels;
  }
  /** Enter ในช่องค้นหา = บินไปหาผลถัดไป (Shift = ย้อน) + เลือกไว้ */
  searchGo(q,back){
    const ql=String(q||'').toLowerCase();
    if(!ql)return null;
    const hits=this.nodes.filter((n)=>(n.name||'').toLowerCase().includes(ql));
    if(!hits.length)return null;
    this._searchIdx=((this._searchIdx+(back?-1:1))%hits.length+hits.length)%hits.length;
    const n=hits[this._searchIdx];
    this.select(n);this.flyTo(n,{minScale:1});
    return n;
  }

  /** ปลดหมุดทุกโหนด + ลบตำแหน่งที่บันทึกไว้ → รอบถัดไปทุกโหนดเป็น "ของใหม่" จึงถูกจัดผังใหม่หมด */
  relayout(){
    clearPositions(this.nodes,this._scope());
    for(const n of this.nodes)n._fresh=true;
    this.refresh();
  }

  /** ปลดหมุดโหนดเดียว — รอบ refresh ถัดไป force layout จะขยับมันได้อีก */
  unpin(node){
    if(!node)return;
    node._pinned=false;
    savePositions(this.nodes,this._scope());
  }

  /**
   * [alpha.73 ข้อ 1] Shift+คลิก = "เคลียร์ที่ว่างรอบโหนดนี้"
   * ดันเฉพาะโหนดที่อยู่ใกล้กว่ารัศมีเคลียร์ ให้ออกไปอยู่ที่ขอบรัศมีพอดี · โหนดที่ถูกดันถือว่า "ผู้ใช้จัดเอง" (ปักหมุด)
   */
  _repel(node, hx, hy) {
    const R = 220 * (this._nodeScale || 1);
    const use3D = !!this._mode3D;
    let moved = 0;
    for(const n of this.nodes){
      if(n===node)continue;
      let dx=n.x-node.x, dy=n.y-node.y, dz=use3D?((n.z||0)-(node.z||0)):0;
      let d=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(d>=R)continue;
      if(d<1){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);dz=0;d=1;}
      const k=R/d;
      n.x=node.x+dx*k; n.y=node.y+dy*k; if(use3D)n.z=(node.z||0)+dz*k;
      n._pinned=true;
      moved++;
    }
    return moved;
  }

  /**
   * [alpha.73 ข้อ 4] ซูมยึด "จุดกึ่งกลางจอ" · [alpha.166] = จุดโฟกัสของกล้อง (สเกลเปลี่ยนอย่างเดียว)
   */
  _zoom(e){
    // [alpha.167 · bug hunt] เดิมซูมทีละ 10% ต่ออีเวนต์ — ทัชแพด/Magic Mouse ยิงอีเวนต์เล็ก ๆ หลายสิบครั้งต่อการปัด
    // ผังจึงพุ่งเข้า/ออกสุดทางในทีเดียว · ตอนนี้ตามระยะที่เลื่อนจริง (ล้อเมาส์หนึ่งคลิก ≈ 100 → ~14% เท่าเดิมโดยประมาณ)
    const dy=Number.isFinite(e.deltaY)?e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1):0;
    if(!dy)return;
    const f=Math.exp(-Math.max(-300,Math.min(300,dy))*0.0015);
    this._flyAnim=null;
    this._cam.scale=clampScale(this._cam.scale*f);
    this._touchCam();
    this.draw();if(this._showMinimap)this._updateMinimap();
  }

  _ctxMenu(e){
    if(this._orbitDrag)return;
    const{node}=this._hit(e);
    const items=[];
    const add=(label,click,o={})=>items.push({text:label,click,...o});
    if(node){
      if(node!==this._sel)this.select(node);
      const struct=isStruct(node);
      if(struct){
        if(node.cat==='scene'){
          add(tt('ui.net.open'),()=>{if(this.onOpenScene)this.onOpenScene(node.file);});
          if(this.onRenameStruct)add(tt('ui.net.changeName'),()=>this.onRenameStruct(node));
          if(this.onDuplicateStruct)add(tt('ui.net.repeat'),()=>this.onDuplicateStruct(node));
          if(node.file&&this.onReveal)add(tt('ui.net.findDisk'),()=>{try{this.onReveal(node.file);}catch{}});
          items.push('-');
          if(this.onDeleteStruct)add(tt('ui.common.delMoveTrash'),()=>this.onDeleteStruct(node),{danger:true});
        }else if(node.cat==='chapter'){
          add(tt('ui.net.openChapter'),()=>{if(this.onOpenScene&&node.file)this.onOpenScene(node.file);});
          if(this.onAddChild)add(tt('ui.net.addScene'),()=>this.onAddChild(node));
          if(this.onRenameStruct)add(tt('ui.net.changeNameChapter'),()=>this.onRenameStruct(node));
          items.push('-');
          if(this.onDeleteStruct)add(tt('ui.net.delChapterChapter'),()=>this.onDeleteStruct(node),{danger:true});
        }else if(node.cat==='section'){
          if(this.onOpenScene&&node.file)add(tt('ui.net.openBook'),()=>this.onOpenScene(node.file));
          if(this.onAddChild)add(tt('ui.net.addBookNew'),()=>this.onAddChild(node));
          if(this.onRenameStruct)add(tt('ui.common.changeNameBook'),()=>this.onRenameStruct(node));
          items.push('-');
          if(this.onDeleteStruct)add(tt('ui.common.delBookBook'),()=>this.onDeleteStruct(node),{danger:true});
        }
      }else{
        add(tt('ui.net.open2'),()=>{if(this.onOpen)this.onOpen(node);});
        if(node.file&&this.onReveal)add(tt('ui.net.findDisk'),()=>{try{this.onReveal(node.file);}catch{}});
        items.push('-');
        // [alpha.166] ใช้ผังทำงานจริง: โฟกัส · หาเส้นทาง · ผูกความสัมพันธ์ · โมเดล 3 มิติ
        add(tt('ui.netUi.focus1'),()=>{this.select(node);this.setFocus(1);});
        add(tt('ui.netUi.focus2'),()=>{this.select(node);this.setFocus(2);});
        add(tt('ui.netUi.pathFrom'),()=>{this.select(node);this.startPathPick();});
        if(this.onCreateRel)add(tt('ui.netUi.linkFrom'),()=>{this.select(node);this.setTool('link');this._syncTip();});
        items.push('-');
        add(tt('ui.netUi.modelPick'),()=>this._side.pickModel(node));
        if(this._scene.models.byNode[modelKeyOf(node)])add(tt('ui.netUi.modelRemove'),()=>this._side.setModel(node,null));
      }
      if(node._pinned){
        items.push('-');
        add(tt('ui.net.unsetPinNode'),()=>{this.unpin(node);this.draw();});
      }
    }else{
      add(tt('ui.net.resetView'),()=>this.resetView());
      add(tt('ui.common.refresh2'),()=>this.refresh());
      add(tt('ui.net.unsetPinAllNode2'),()=>this.relayout());
      items.push('-');
      add(tt('ui.netUi.sceneBtn'),()=>{this._side.open('scene');this._syncToolbar();});
      if(this._scene.bg.kind==='image'&&this._scene.bg.image&&!this._cam.mode3D){
        // วางกึ่งกลางรูปแผนที่ตรงจุดที่คลิก (จัดแผนที่ให้ตรงกับโหนด)
        const h=this._hit(e);
        add(tt('ui.netUi.bgCenterHere'),()=>this.updateScene({bg:{...this._scene.bg,imageX:Math.round(h.x),imageY:Math.round(h.y)}}));
      }
    }
    popupMenu(e.clientX,e.clientY,items);
  }

  focus(){this._fit();this.draw();}
  save(){return true;}
  destroy(){
    if(this._rafId)cancelAnimationFrame(this._rafId);
    if(this._animId)cancelAnimationFrame(this._animId);
    clearTimeout(this._camJob);
    if(this._sceneJob){clearTimeout(this._sceneJob);try{this.onSceneChange&&this.onSceneChange(this._scene);}catch{}}
    window.removeEventListener('resize',this._resize);
    window.removeEventListener('k2-theme',this._onTheme);
    document.removeEventListener('mouseup',this._upDoc);
    if(this._ro)this._ro.disconnect();
    if(this._tb)this._tb.destroy();
    if(this._legend)this._legend.box.remove();
    if(this._side)this._side.destroy();
    if(this._storyTimer)clearInterval(this._storyTimer);
    if(this._storyBar)this._storyBar.destroy();
    onModelReady(null);
    if(this._bgBlobUrl){try{URL.revokeObjectURL(this._bgBlobUrl);}catch{}this._bgBlobUrl='';}
    try{localStorage.setItem(scopedKey(CAM_PREFIX,this._scope()),JSON.stringify(serializeCam(this._cam)));}catch{}
    savePositions(this.nodes,this._scope());
  }
}

