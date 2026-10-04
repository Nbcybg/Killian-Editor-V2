// floorplan-ui.js — แผงผังพื้นที่แบบ Shot Designer (alpha.168 · เขียนใหม่ทั้งแผง)
//
// ผู้ใช้: "floor plan ง่ายๆ เหมือนยกมาจาก map ... ไม่มีระบบซ้อนกัน ของ map ไป map · drag drop entities ลงไป
//          จากนั้น ก็จะตั้งกล้อง ... entities จะมี ระยะสายตาบอก มีบอกการหันหน้าไปทางไหน มีระบบ timeline
//          ... บรรทัดของฉากได้ หรือจะพิมพ์เอง เป็น reference ให้ดูว่า floor plan นี้ คือจุดไหนของหนัง"
//        + "มีรูปทรงแบบ visio · มีไฟ ชนิดไฟ การตั้งค่าไฟ เลนส์กล้อง ชนิดกล้อง (red komodo · sony fx3 · fuji xt5)
//           ความสูง การตั้ง (jib · tripod · monopod) มีใส่ราง dolly"
//
// ชั้น: ตรรกะ = floorplan/fp-data.js (unit) · คลังอุปกรณ์ = floorplan/fp-gear.js · ไฟล์ = floorplan/fp-store.js
// ที่นี่ = วาด SVG + เมาส์/คีย์บอร์ด + แผงคุณสมบัติ + แถบจังหวะ
//
// ผืนวาดเป็น SVG ชั้นเดียว หน่วยเมตร (`<g transform="translate scale">`) — ของที่ต้องคงขนาดบนจอ (ไอคอนกล้อง ·
// ป้าย · จุดจับ) คูณด้วย k = 1/ซูม · เส้นบาง ๆ ใช้ `vector-effect: non-scaling-stroke`
import { t, tf } from './i18n.js';
import { $, el, state, setStatus, setStatusError, setStatusAction, log, logAction } from './core.js';
import { gi, icon } from './icons.js';
import { cmpText, fmtNum } from './locale.js';
import { panelEmpty } from './panels/panel-chrome.js';
import { bindDropTarget, dropFrac } from './drop-kit.js';
import { escCancelDrag } from './drag-cancel.js';
import { themeColor, safeCssColor, PRINT } from './palette.js';
import { prefixLen } from './fountain.js';
import * as F from './floorplan/fp-data.js';
import * as G from './floorplan/fp-gear.js';
import * as S from './floorplan/fp-store.js';
import * as PS from './floorplan/fp-shot.js';
import { collectPlacedScenes, findSceneById, relToRoot } from './scene-list.js';

// แผงแผนที่ยัง import ชื่อนี้จากที่นี่ได้ (ของเดิมตั้งแต่ alpha.70)
export { collectPlacedScenes };

const NS = 'http://www.w3.org/2000/svg';
/** ชื่อชนิดของชิ้น (คีย์เต็ม — ห้ามประกอบคีย์จากชิ้นส่วน) */
const TYPE_KEYS = { entity: 'ui.fp.typeEntity', camera: 'ui.fp.typeCamera', light: 'ui.fp.typeLight', shape: 'ui.fp.typeShape', track: 'ui.fp.typeTrack' };
const UNDO_MAX = 60;
const PLAY_MS = 1100;           // เวลาต่อหนึ่งจังหวะตอนเล่น

// ── สถานะการดู (ไม่บันทึก) ──
const V = {
  planId: null, beat: 0, sel: null,
  tool: 'select', toolArg: '',
  cams: new Map(),              // planId → { z, cx, cy }
  undo: [], redo: [],
  draw: null,                   // { type:'shape'|'track', kind, pts:[] }
  hover: null,                  // จุดเมาส์ในโลก (ตอนวาดเส้นหลายจุด)
  play: null,                   // { from, t0, raf, poses, cam, beat }
  names: null,                  // Map(ไฟล์เอนทิตี้ → {name, cat})
  showSight: true, showPaths: true,
  tok: 0,
  el: null,                     // { stage, svg, insp, beats, bar }
  paintJob: 0,
  gen: null,                    // งานให้ AI เขียน prompt ที่กำลังวิ่ง { cancel, reqId, msg }
  imgURL: null,                 // mapImgURL ของ app.js (ทางรูปใน Images/ → URL ที่ <image> โหลดได้)
};

// ── ตัวฟังระดับหน้าต่าง (ติดครั้งเดียว) ──
let _hooked = false;
function hookOnce() {
  if (_hooked) return;
  _hooked = true;
  // เปลี่ยนธีม = วาดผืนใหม่ด้วยสีธีมใหม่ (สีเปลือกอ่านผ่าน themeColor ที่ถูกล้างแคชแล้ว)
  try { window.addEventListener('k2-theme', () => { paint(); }); } catch {}
  // แก้/เปลี่ยนชื่อ/ลบหน้า Wiki = ชื่อบนผังต้องตาม (ล้างแคชชื่อ แล้ววาดใหม่ถ้าแผงเปิดอยู่)
  try {
    if (typeof kapi !== 'undefined' && kapi && typeof kapi.onLocalWrite === 'function') {
      kapi.onLocalWrite((p) => {
        if (!/[\\/](Wiki|Bible)[\\/]/.test(String(p || ''))) return;
        V.names = null;
        clearTimeout(hookOnce._t);
        hookOnce._t = setTimeout(async () => { if (V.el && V.el.svg.isConnected) { await entityNames(); paint(); renderInsp(); } }, 300);
      });
    }
  } catch {}
}

// ═══════════════════════ ทางเข้า ═══════════════════════
export async function renderFloorPlanPanel() {
  const host = $('#floor-body');
  if (!host) return false;
  await renderFloorPlan(host);
  return true;
}
export async function openFloorPlan(planId) {
  const { showPanel } = await import('./panels/panel-ui.js');
  const { renderFeaturePanel } = await import('./app.js');
  if (planId && planId !== V.planId) { V.planId = planId; V.beat = 0; V.sel = null; V.undo = []; V.redo = []; }
  showPanel('floorplan');
  await renderFeaturePanel('floorplan');
}
/** วาดใหม่ถ้าแผงเปิดอยู่ (หลังบันทึกฉาก/เปลี่ยนฉากที่แก้) */
export function refreshOpenFloorPlan() {
  const host = $('#floor-body');
  if (host && host.firstChild) renderFloorPlan(host);
}
/** สภาพของแผง (เทส/ภายนอก) */
export function floorPlanView() { return { planId: V.planId, beat: V.beat, sel: V.sel, tool: V.tool, playing: !!V.play }; }
export function resetFloorPlanView() {
  stopPlay(); V.planId = null; V.beat = 0; V.sel = null; V.tool = 'select'; V.undo = []; V.redo = []; V.draw = null; V.names = null;
  S.resetFpStore();
}

/** ฉากที่กำลังเขียน + ทางไฟล์ของมัน (แท็บที่เปิดอยู่ → ฉากที่เปิดล่าสุด) */
async function currentSceneCtx() {
  const { sceneCtx } = await import('./app.js');
  const act = state.active && state.active.file ? String(state.active.file).replace(/^::[a-z0-9-]+::/i, '') : '';
  const a = await sceneCtx();
  if (a) return { ...a, file: act };
  const b = await sceneCtx(state.lastSceneFile);
  return b ? { ...b, file: state.lastSceneFile } : null;
}
/** ชื่อเอนทิตี้ทั้งโปรเจกต์ (แคชต่อโปรเจกต์ · fresh = อ่านใหม่ เช่นตอนเปิดเมนูเพิ่มตัวละคร — เอนทิตี้ที่เพิ่งสร้างต้องขึ้น) */
async function entityNames(fresh = false) {
  if (V.names && V.namesRoot === state.root && !fresh) return V.names;
  V.namesRoot = state.root;
  const m = new Map();
  try {
    const { loadAllEntities } = await import('./app.js');
    for (const e of await loadAllEntities({ entitiesOnly: true })) {
      const rel = F.entityRel(e.file, state.root);
      m.set(normP(rel), { name: e.name, cat: e.cat, file: e.file, rel });
    }
  } catch (e) { log('warn', 'floorplan: entity names', e); }
  V.names = m;
  return m;
}
const normP = (p) => String(p || '').replace(/\\/g, '/').toLowerCase();
const baseP = (p) => normP(p).split('/').pop();
/** แถวของเอนทิตี้จากทางที่จดในผัง (สัมพัทธ์ · ไฟล์เก่าอาจเป็นทางเต็ม) — หาไม่เจอ = null */
function entHit(file) {
  if (!file || !V.names) return null;
  return V.names.get(normP(F.entityRel(file, state.root))) || [...V.names.values()].find((v) => baseP(v.file) === baseP(file)) || null;
}
function entityName(o) {
  if (!o || !o.entityFile || !V.names) return o ? o.label : '';
  const hit = entHit(o.entityFile);
  return hit ? hit.name : o.label;
}
/** ทางเต็มของไฟล์เอนทิตี้ (แบบเดียวกับที่ Explorer ใช้ — กุญแจแท็บต้องตรงกัน) */
async function entAbs(file) {
  const hit = entHit(file);
  if (hit) return hit.file;
  if (!file) return '';
  return F.isAbsPath(file) ? file : kapi.join(state.root, ...String(file).split('/'));
}
async function openEntityOf(o) {
  const f = await entAbs(o && o.entityFile);
  if (!f || !(await kapi.exists(f))) { setStatusError(t('ui.fp.entityMissing')); return false; }
  (await import('./wiki-ui.js')).openEntity(f);
  return true;
}
function objLabel(o) {
  if (!o) return '';
  if (o.type === 'entity') return entityName(o) || o.label || t('ui.common.notNamed');
  if (o.type === 'camera') return tf('ui.fp.camName', o.label || '?');
  if (o.type === 'light') return o.label || t(G.labelKey('light', o.kind));
  if (o.type === 'track') return o.label || t('ui.fp.typeTrack');
  return o.label || o.text || t(G.labelKey('shape', o.kind));
}

// ═══════════════════════ ตัววาดหลักของแผง ═══════════════════════
export async function renderFloorPlan(pane) {
  if (!pane) return;
  hookOnce();
  const tok = ++V.tok;
  if (!state.root) { pane.replaceChildren(panelEmpty(t('ui.common.openProjectBefore'), { icon: 'floorplan' })); return; }
  const idx = await S.loadIndex();
  const ctx = await currentSceneCtx().catch(() => null);
  await entityNames();
  if (!V.imgURL) { try { V.imgURL = (await import('./app.js')).mapImgURL; } catch {} }
  if (tok !== V.tok) return;
  const sceneId = ctx ? ctx.row.id : '';
  const plans = F.listPlans(idx, sceneId, cmpText);
  if (!V.planId || !idx.plans[V.planId]) {
    V.planId = (plans[0] && plans[0].id) || null;
    V.beat = 0; V.sel = null; V.undo = []; V.redo = [];
  }
  const plan = V.planId ? await S.openPlan(V.planId) : null;
  if (tok !== V.tok) return;
  if (plan && V.names) F.relinkPlanEntities(plan, state.root, [...V.names.values()].map((v) => v.rel));
  if (S.takeStuck()) { if (plan) V.planId = plan.id; setStatusError(t('ui.fp.saveFailStay')); }
  // วาดแผงใหม่ (สลับแท็บฉาก · บันทึกฉาก) ระหว่างเล่น = เล่นต่อบน DOM ใหม่ · หยุดเฉพาะเมื่อเปลี่ยนผัง
  if (V.play && (!plan || plan.id !== V.play.planId)) stopPlay();

  const wrap = el('div', 'fp-wrap');
  wrap.append(buildBar(plans, plan, ctx));
  if (!plan) {
    wrap.append(panelEmpty(t('ui.fp.emptyTitle'), {
      icon: 'floorplan', hint: t('ui.fp.emptyHint'), action: t('ui.fp.create'),
      onAction: async () => newPlanFlow(await currentSceneCtx().catch(() => null)),
    }));
    pane.replaceChildren(wrap);
    V.el = null;
    return;
  }
  if (V.beat >= plan.beats.length) V.beat = plan.beats.length - 1;
  if (V.sel && !F.objById(plan, V.sel)) V.sel = null;

  const body = el('div', 'fp-body');
  const stage = el('div', 'fp-stage');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'application');
  stage.setAttribute('aria-label', t('ui.common.graphArea'));
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('fp-svg');
  stage.append(svg);
  const hint = el('div', 'fp-hint');
  hint.style.display = 'none';
  stage.append(hint);
  const insp = el('div', 'fp-insp');
  body.append(stage, insp);
  const beats = el('div', 'fp-beats');
  wrap.append(body, beats);
  pane.replaceChildren(wrap);
  V.el = { stage, svg, insp, beats, hint, bar: wrap.firstChild };

  wireStage(stage, svg, plan);
  renderInsp();
  renderBeats();
  const ro = new ResizeObserver(() => { if (stage.isConnected) paint(); else ro.disconnect(); });
  ro.observe(stage);
  requestAnimationFrame(() => {
    if (!V.cams.has(plan.id)) fitAll();
    paint();
  });
}

// ═══════════════════════ แถบบน ═══════════════════════
function tbBtn(iconName, title, onClick, on = false) {
  const b = el('button', 'fp-tb' + (on ? ' on' : ''));
  b.type = 'button';
  b.append(icon(iconName, 16));
  b.title = title;
  b.setAttribute('aria-label', title);
  b.onclick = onClick;
  return b;
}
function buildBar(plans, plan, ctx) {
  const bar = el('div', 'fp-bar');
  bar.setAttribute('role', 'toolbar');
  const sel = el('select', 'fp-plansel');
  sel.title = t('ui.fp.planPick');
  sel.setAttribute('aria-label', t('ui.fp.planPick'));
  const sceneId = ctx ? ctx.row.id : '';
  const mine = plans.filter((p) => sceneId && p.sceneId === sceneId), rest = plans.filter((p) => !(sceneId && p.sceneId === sceneId));
  const addOpts = (host, list) => {
    for (const p of list) {
      const nm = p.name || t('ui.common.notNamed');
      // ชื่อตั้งต้นของผังมีชื่อฉากอยู่แล้ว ("ผัง — ตลาดเก่า") — ไม่ต่อชื่อฉากซ้ำ
      const o = el('option', null, nm + (p.sceneTitle && !nm.includes(p.sceneTitle) ? ' · ' + p.sceneTitle : ''));
      o.value = p.id; host.append(o);
    }
  };
  if (mine.length && rest.length) {
    const g1 = el('optgroup'); g1.label = t('ui.fp.thisScene'); addOpts(g1, mine);
    const g2 = el('optgroup'); g2.label = t('ui.fp.otherPlans'); addOpts(g2, rest);
    sel.append(g1, g2);
  } else addOpts(sel, plans);
  if (plan) sel.value = plan.id;
  sel.onchange = async () => {
    if (!(await S.flushPlan())) { sel.value = plan ? plan.id : ''; setStatusError(t('ui.fp.saveFailStay')); return; }
    V.planId = sel.value; V.beat = 0; V.sel = null; V.undo = []; V.redo = []; refreshOpenFloorPlan(); };
  if (plans.length) bar.append(sel);
  bar.append(tbBtn('plus', t('ui.fp.newPlan'), async () => newPlanFlow(await currentSceneCtx().catch(() => null))));
  if (plan) {
    const menuB = tbBtn('menu', t('ui.fp.menu'), (e) => planMenu(e.currentTarget, plan));
    bar.append(menuB, el('span', 'fp-tbsep'));
    const tools = [
      ['cursor-arrow', 'select', t('ui.fp.toolSelect')],
      ['user', 'entity', t('ui.fp.toolEntity')],
      ['camera', 'camera', t('ui.fp.toolCamera')],
      ['bulb', 'light', t('ui.fp.toolLight')],
      ['shape-rect', 'shape', t('ui.fp.toolShape')],
      ['road', 'track', t('ui.fp.toolTrack')],
    ];
    for (const [ic, id, tip] of tools) {
      const b = tbBtn(ic, tip, (e) => pickTool(id, e.currentTarget), V.tool === id);
      b.dataset.tool = id;
      bar.append(b);
    }
    bar.append(el('span', 'fp-tbsep'));
    bar.append(tbBtn('grid', t('ui.fp.toggleGrid'), () => edit(() => { plan.grid.on = !plan.grid.on; }, { insp: false }), plan.grid.on));
    bar.append(tbBtn('eye', t('ui.fp.toggleSight'), (e) => { V.showSight = !V.showSight; e.currentTarget.classList.toggle('on', V.showSight); paint(); }, V.showSight));
    bar.append(tbBtn('route', t('ui.fp.togglePaths'), (e) => { V.showPaths = !V.showPaths; e.currentTarget.classList.toggle('on', V.showPaths); paint(); }, V.showPaths));
    bar.append(tbBtn('fit-screen', t('ui.fp.fit'), () => { fitAll(); paint(); }));
    bar.append(tbBtn('undo', t('ui.fp.undo'), undo), tbBtn('redo', t('ui.fp.redo'), redo));
    if (plan.scene) {
      const sc = el('span', 'fp-scene');
      sc.append(icon('file', 14), document.createTextNode(' ' + (plan.scene.title || t('ui.common.notNamed'))));
      sc.title = t('ui.fp.sceneOfHint');
      sc.onclick = () => jumpToScene(plan, null);
      bar.append(sc);
    }
  }
  return bar;
}

async function pickTool(id, anchor) {
  const plan = S.currentPlan();
  if (!plan) return;
  cancelDraw();
  // เครื่องมือที่ไม่มีเมนูย่อย = สลับทันที (ไม่รอ import — กดแล้วปุ่มต้องติดไฟในจังหวะเดียวกัน)
  if (id !== 'entity' && id !== 'light' && id !== 'shape') { setTool(id, ''); return; }
  const r = anchor ? anchor.getBoundingClientRect() : { left: 100, bottom: 100 };
  const { popupMenu } = await import('./ui.js');
  if (id === 'entity') return entityMenu(r.left, r.bottom);
  if (id === 'light') {
    return popupMenu(r.left, r.bottom, G.LIGHT_TYPES.map((l) => ({ label: esc(t(G.labelKey('light', l.id))), click: () => setTool('light', l.id) })));
  }
  if (id === 'shape') {
    return popupMenu(r.left, r.bottom, G.SHAPE_KINDS.map((k) => ({ label: esc(t(G.labelKey('shape', k))), click: () => setTool('shape', k) })));
  }
}
function setTool(tool, arg) {
  V.tool = tool; V.toolArg = arg || '';
  cancelDraw();
  if (V.el && V.el.bar) for (const b of V.el.bar.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === tool);
  updateHint();
  if (V.el) { V.el.stage.classList.toggle('fp-placing', tool !== 'select'); V.el.stage.focus(); }
}
function updateHint() {
  if (!V.el) return;
  const poly = isPolyTool();
  V.el.hint.textContent = V.tool === 'select' ? '' : poly ? t('ui.fp.hintPoly') : t('ui.fp.hintPlace');
  V.el.hint.style.display = V.tool === 'select' ? 'none' : '';
}
const isPolyTool = () => V.tool === 'track' || (V.tool === 'shape' && G.POLY_KINDS.has(V.toolArg));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function entityMenu(x, y) {
  const names = await entityNames(true);
  const { popupMenu } = await import('./ui.js');
  const byCat = new Map();
  for (const v of names.values()) { if (!byCat.has(v.cat)) byCat.set(v.cat, []); byCat.get(v.cat).push(v); }
  if (!byCat.size) { setStatus(t('ui.fp.noEntities')); return; }
  const { catLabel } = await import('./app.js');
  const items = [...byCat.entries()].sort((a, b) => cmpText(a[0], b[0])).map(([cat, list]) => ({
    label: esc(catLabel ? catLabel(cat) : cat),
    sub: () => list.sort((a, b) => cmpText(a.name, b.name)).map((v) => ({ text: v.name, click: () => addEntities([{ path: v.file, title: v.name, cat: v.cat }], null) })),
  }));
  popupMenu(x, y, items);
}

// ═══════════════════════ เมนูของผัง ═══════════════════════
async function planMenu(anchor, plan) {
  const { popupMenu, confirmBox, ask } = await import('./ui.js');
  const ctx = await currentSceneCtx().catch(() => null);        // ฉากที่เปิดอยู่ "ตอนกดเมนู" (ไม่ใช่ตอนวาดแผง)
  const r = anchor.getBoundingClientRect();
  const items = [
    { label: esc(t('ui.fp.rename')), click: async () => {
      const v = await ask(t('ui.fp.renameQ'), { value: plan.name });
      if (v == null || v === plan.name) return;
      await S.updatePlanMeta({ name: v });
      refreshOpenFloorPlan();
    } },
    { label: esc(t('ui.fp.bindScene')), click: () => pickScene(plan) },
  ];
  if (ctx && (!plan.scene || plan.scene.id !== ctx.row.id)) {
    items.push({ text: tf('ui.fp.bindCurrent', ctx.row.title || ''), click: async () => {
      await S.updatePlanMeta({ scene: { id: ctx.row.id, title: ctx.row.title || '', file: relToRoot(ctx.file || '') } });
      refreshOpenFloorPlan();
    } });
  }
  if (plan.scene) items.push({ label: esc(t('ui.fp.unbindScene')), click: async () => { await S.updatePlanMeta({ scene: null }); refreshOpenFloorPlan(); } });
  items.push('-',
    { label: esc(t('ui.fp.bgImage')), click: () => pickBackground(plan) },
    { label: esc(t('ui.fp.bgFromMap')), sub: () => mapBgItems(plan) });
  if (plan.bg) items.push({ label: esc(t('ui.fp.bgRemove')), click: () => edit(() => { plan.bg = null; }) });
  items.push('-',
    { label: esc(t('ui.fp.promptGenAll')), click: () => generatePrompts(plan.beats.map((_, k) => k)) },
    { label: esc(t('ui.fp.exportPng')), click: () => exportFloorPlanPng() },
    { label: esc(t('ui.fp.exportCsv')), click: () => exportShotList('csv') },
    { label: esc(t('ui.fp.exportMd')), click: () => exportShotList('md') },
    { label: esc(t('ui.fp.duplicate')), click: async () => {
      const p = await S.duplicatePlan(plan.id, plan.name + t('ui.fp.copySuffix'));
      if (p) { V.planId = p.id; V.beat = 0; V.sel = null; V.undo = []; V.redo = []; refreshOpenFloorPlan(); }
      else if (S.takeStuck()) setStatusError(t('ui.fp.saveFailStay'));
    } },
    '-',
    { label: esc(t('ui.fp.delete')), danger: true, click: async () => {
      if (!(await confirmBox(tf('ui.fp.deleteQ', plan.name || t('ui.common.notNamed')), t('ui.common.del')))) return;
      await S.trashPlan(plan.id);
      V.planId = null; V.sel = null; V.undo = []; V.redo = [];
      setStatus(t('ui.fp.deleted'));
      refreshOpenFloorPlan();
    } });
  popupMenu(r.left, r.bottom, items);
}

async function newPlanFlow(ctx) {
  const { ask } = await import('./ui.js');
  const idx = await S.loadIndex();
  const n = Object.keys(idx.plans).length + 1;
  const def = ctx && ctx.row.title ? tf('ui.fp.defaultNameScene', ctx.row.title) : tf('ui.fp.defaultName', n);
  const name = await ask(t('ui.fp.newPlanQ'), { value: def, okLabel: t('ui.common.new') });
  if (!name) return null;
  const scene = ctx ? { id: ctx.row.id, title: ctx.row.title || '', file: relToRoot(ctx.file || '') } : null;
  const p = await S.createPlan(name, scene);
  if (!p) { S.takeStuck(); setStatusError(t('ui.fp.saveFailStay')); return null; }
  V.planId = p.id; V.beat = 0; V.sel = null; V.undo = []; V.redo = [];
  setStatus(tf('ui.fp.created', p.name));
  await refreshOpenFloorPlanNow();
  return p;
}
async function refreshOpenFloorPlanNow() { const host = $('#floor-body'); if (host) await renderFloorPlan(host); }

/** กล่องเลือกฉาก (ค้นหาได้) → ผูกผังกับฉากนั้น */
async function pickScene(plan) {
  const scenes = await collectPlacedScenes().catch(() => []);
  const picked = await listPicker(t('ui.fp.pickSceneTitle'), t('ui.fp.pickSceneSearch'),
    scenes.map((s) => ({ value: s, text: s.title || t('ui.common.notNamed'), sub: [s.sectionName, s.chapterName].filter(Boolean).join(' › ') })));
  if (!picked) return;
  await S.updatePlanMeta({ scene: { id: picked.id, title: picked.title || '', file: relToRoot(picked.filePath) } });
  refreshOpenFloorPlan();
}

/**
 * กล่องรายการค้นหาได้ (ใช้ทั้งเลือกฉาก/เลือกบรรทัด) — คืนค่าที่เลือก หรือ null
 * @param rows [{value, text, sub?}]
 */
function listPicker(title, placeholder, rows) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide fp-pick');
    box.append(el('div', 'k-dlg-title', title));
    const q = el('input', 'wiki-input fp-pick-q');
    q.placeholder = placeholder;
    const list = el('div', 'fp-pick-list');
    box.append(q, list);
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', 'k-cancel', t('ui.common.cancel'));
    btns.append(cancel);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    cancel.onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    const draw = () => {
      const w = q.value.trim().toLowerCase();
      list.replaceChildren();
      const hits = rows.filter((r) => !w || (r.text + ' ' + (r.sub || '')).toLowerCase().includes(w)).slice(0, 400);
      if (!hits.length) list.append(el('div', 'dim fp-pick-none', t('ui.common.notFound')));
      for (const r of hits) {
        const row = el('button', 'fp-pick-row');
        row.type = 'button';
        row.append(el('span', 'fp-pick-text', r.text));
        if (r.sub) row.append(el('span', 'fp-pick-sub', r.sub));
        row.onclick = () => done(r.value);
        list.append(row);
      }
    };
    q.oninput = draw;
    q.onkeydown = (e) => {
      if (e.key === 'Enter') { const f = list.querySelector('.fp-pick-row'); if (f) { e.preventDefault(); f.click(); } }
      if (e.key === 'ArrowDown') { const f = list.querySelector('.fp-pick-row'); if (f) { e.preventDefault(); f.focus(); } }
    };
    list.onkeydown = (e) => {
      const rowsEl = [...list.querySelectorAll('.fp-pick-row')];
      const i = rowsEl.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i >= 0 && rowsEl[i + 1]) { e.preventDefault(); rowsEl[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) rowsEl[i - 1].focus(); else q.focus(); }
    };
    draw();
    setTimeout(() => q.focus(), 0);
  });
}

// ═══════════════════════ รูปพื้นหลัง ═══════════════════════
async function pickBackground(plan) {
  const { pickImage } = await import('./gallery.js');
  const it = await pickImage(state.root);
  if (!it || !it.file) return;
  await setBackground(plan, 'Images/' + it.file);
}
async function mapBgItems(plan) {
  const { loadMaps } = await import('./app.js');
  let maps = [];
  try { maps = ((await loadMaps()) || {}).maps || []; } catch {}
  return maps.filter((m) => m.image).map((m) => ({ text: m.name || t('ui.common.notNamed'), click: () => setBackground(plan, m.image) }));
}
async function setBackground(plan, rel) {
  const { mapImgURL } = await import('./app.js');
  const aspect = await new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1.5);
    im.onerror = () => res(1.5);
    im.src = mapImgURL(rel);
  });
  const b = F.planBounds(plan, V.beat, { cones: false });
  const w = Math.max(6, Math.round((b.x1 - b.x0) * 10) / 10);
  edit(() => { plan.bg = { image: rel, x: b.x0, y: b.y0, w, rot: 0, opacity: 0.7, aspect: Math.round(aspect * 1000) / 1000 }; });
}

// ═══════════════════════ แก้ไข + ย้อนกลับ ═══════════════════════
function snapshot() { const p = S.currentPlan(); return p ? JSON.stringify(p) : ''; }
function restore(s) {
  const p = S.currentPlan();
  if (!p || !s) return;
  const j = JSON.parse(s);
  for (const k of Object.keys(p)) delete p[k];
  Object.assign(p, j);
}
/** ภาพก่อนแก้ ติดป้าย id ของผัง — ย้อนกลับได้เฉพาะผังเดียวกัน (กันเอาเนื้อผังอื่นมาทับ) */
function pushUndo(s) {
  if (!s) return;
  V.undo.push({ id: V.planId, s });
  if (V.undo.length > UNDO_MAX) V.undo.shift();
  V.redo = [];
}
function takeHist(stack) {
  while (stack.length) { const h = stack.pop(); if (h && h.id === V.planId) return h.s; }
  return null;
}
/** ทุกการแก้ผ่านตัวนี้: เก็บภาพก่อนแก้ → แก้ → บันทึกหน่วง → วาดใหม่ */
function edit(fn, o = {}) {
  const p = S.currentPlan();
  if (!p) return;
  const s = snapshot();
  if (fn(p) === false) return;
  pushUndo(s);
  S.markPlanDirty();
  afterChange(o);
}
function afterChange(o = {}) {
  paint();
  if (o.beats !== false) renderBeats();
  if (o.insp !== false) {
    // แก้จากช่องในแผงคุณสมบัติ (change ตอนกด Tab) — รอให้โฟกัสย้ายไปช่องถัดไปก่อน แล้วค่อยวาดใหม่ + คืนโฟกัสช่องนั้น
    if (V.el && V.el.insp.contains(document.activeElement)) setTimeout(renderInsp, 0);
    else renderInsp();
  }
}
function undo() {
  const s = takeHist(V.undo);
  if (!s) return;
  V.redo.push({ id: V.planId, s: snapshot() });
  restore(s);
  fixSel();
  S.markPlanDirty();
  afterChange();
}
function redo() {
  const s = takeHist(V.redo);
  if (!s) return;
  V.undo.push({ id: V.planId, s: snapshot() });
  restore(s);
  fixSel();
  S.markPlanDirty();
  afterChange();
}
function fixSel() {
  const p = S.currentPlan();
  if (!p) return;
  if (V.sel && !F.objById(p, V.sel)) V.sel = null;
  if (V.beat >= p.beats.length) V.beat = p.beats.length - 1;
}

// ═══════════════════════ กล้องมุมมอง ═══════════════════════
function stageSize() { const s = V.el && V.el.stage; return { W: (s && s.clientWidth) || 1, H: (s && s.clientHeight) || 1 }; }
function camOf(plan) {
  if (!V.cams.has(plan.id)) {
    const { W, H } = stageSize();
    V.cams.set(plan.id, F.fitView(F.planBounds(plan, V.beat), W, H, { min: F.FP_ZOOM_MIN, max: 120 }));
  }
  return V.cams.get(plan.id);
}
function fitAll() {
  const plan = S.currentPlan();
  if (!plan) return;
  const { W, H } = stageSize();
  V.cams.set(plan.id, F.fitView(F.planBounds(plan, V.beat), W, H, { min: F.FP_ZOOM_MIN, max: 120 }));
}
function toWorld(e) {
  const plan = S.currentPlan();
  const c = camOf(plan);
  const r = V.el.svg.getBoundingClientRect();
  return { x: c.cx + (e.clientX - r.left - r.width / 2) / c.z, y: c.cy + (e.clientY - r.top - r.height / 2) / c.z };
}

// ═══════════════════════ วาด ═══════════════════════
function sv(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}
/** สีของเปลือก (ตามธีม) หรือสีสำหรับภาพส่งออก (พื้นขาวเสมอ) */
function palette(exp) {
  if (exp) return { bg: PRINT.paper, fg: PRINT.ink, dim: PRINT.inkMuted, grid: PRINT.rule, accent: PRINT.accent, chip: PRINT.panel, line: PRINT.line, onColor: '#ffffff' };
  return {
    bg: themeColor('--canvas', '#1f1e1c'), fg: themeColor('--fg', '#e8e6df'), dim: themeColor('--dim', '#8a877f'),
    grid: themeColor('--border', '#3a3935'), accent: themeColor('--accent-hi', '#d97757'), chip: themeColor('--chip', '#34332f'),
    line: themeColor('--bright', '#f5f3ee'), onColor: themeColor('--on-accent-hi', '#ffffff'),
  };
}

function schedulePaint() {
  if (V.paintJob) return;
  V.paintJob = requestAnimationFrame(() => { V.paintJob = 0; paint(); });
}
function paint() {
  const plan = S.currentPlan();
  if (!plan || !V.el || !V.el.svg.isConnected) return;
  const { W, H } = stageSize();
  const svg = V.el.svg;
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const cam = camOf(plan);
  drawPlan(svg, plan, { W, H, cam, beat: V.beat, poses: V.play ? V.play.poses : null, activeCam: V.play ? V.play.cam : null,
                        sel: V.play ? null : V.sel, editing: !V.play, exp: false });
  if (V.draw && V.draw.pts.length) drawPreview(svg, cam, W, H);
}

/**
 * วาดผังลง `<svg>` — ใช้ทั้งบนจอและภาพส่งออก (ตัวเดียวกัน · กฎ WYSIWYG)
 * @param o { W, H, cam:{z,cx,cy}, beat, poses?, activeCam?, sel?, editing, exp }
 */
function drawPlan(svg, plan, o) {
  const P = palette(o.exp);
  const z = o.cam.z, k = 1 / z;
  sv('rect', { x: 0, y: 0, width: o.W, height: o.H, fill: P.bg, class: 'fp-bgfill' }, svg);
  const world = sv('g', { class: 'fp-world', transform: `translate(${o.W / 2 - o.cam.cx * z} ${o.H / 2 - o.cam.cy * z}) scale(${z})` }, svg);
  const poses = o.poses || F.posesAt(plan, o.beat);
  const activeCam = o.activeCam || F.activeCamId(plan, o.beat);
  // ระหว่างเล่น ตำแหน่งเป็นค่ากลางทาง — วงเน้น "อยู่ในภาพ" คิดจากตำแหน่งนั้นจริง ไม่ใช่ของจังหวะ
  const framed = new Set();
  if (o.poses) {
    const camO = F.objById(plan, activeCam), cp = camO && poses.get(camO.id);
    if (cp && !cp.hidden) for (const ob of plan.objects) { const q = poses.get(ob.id); if (ob.type === 'entity' && q && !q.hidden && F.inCone(q, cp, F.cameraFov(camO), camO.range)) framed.add(ob.id); }
  } else for (const x of F.framedIds(plan, o.beat, activeCam)) framed.add(x.id);

  // ── รูปพื้นหลัง ──
  if (plan.bg && plan.bg.image) {
    const bg = plan.bg;
    const h = bg.aspect > 0 ? bg.w / bg.aspect : bg.w * 0.66;
    const img = sv('image', { x: bg.x, y: bg.y, width: bg.w, height: h, opacity: bg.opacity, preserveAspectRatio: 'none',
                              transform: bg.rot ? `rotate(${bg.rot} ${bg.x + bg.w / 2} ${bg.y + h / 2})` : null, class: 'fp-bgimg' }, world);
    img.setAttribute('href', o.imgHref || bgHref(bg.image));
  }
  // ── กริด ──
  if (plan.grid.on) {
    const step = F.gridStep(plan.grid.size, z);
    const x0 = o.cam.cx - o.W / 2 * k, x1 = o.cam.cx + o.W / 2 * k, y0 = o.cam.cy - o.H / 2 * k, y1 = o.cam.cy + o.H / 2 * k;
    let d = '';
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) d += `M${x} ${y0}V${y1}`;
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) d += `M${x0} ${y}H${x1}`;
    sv('path', { d, stroke: P.grid, 'stroke-width': 1, fill: 'none', 'vector-effect': 'non-scaling-stroke', opacity: 0.6, class: 'fp-grid' }, world);
    // แกนศูนย์ (จุด 0,0) ให้รู้ทิศ
    sv('path', { d: `M${x0} 0H${x1}M0 ${y0}V${y1}`, stroke: P.grid, 'stroke-width': 1.5, fill: 'none', 'vector-effect': 'non-scaling-stroke', opacity: 0.9 }, world);
  }

  const layer = (cls) => sv('g', { class: cls }, world);
  const Lshape = layer('fp-l-shapes'), Lcone = layer('fp-l-cones'), Lpath = layer('fp-l-paths'), Lobj = layer('fp-l-objs'), Llab = layer('fp-l-labels'), Lsel = layer('fp-l-sel');

  // ── รูปทรง + ราง ──
  for (const ob of plan.objects) {
    if (ob.type !== 'shape' && ob.type !== 'track') continue;
    const p = poses.get(ob.id);
    if (!p || (p.hidden && !o.editing)) continue;
    const g = drawShape(Lshape, ob, p, k, P);
    if (p.hidden) g.setAttribute('opacity', '0.3');
  }
  // ── กรวย (ไฟ → สายตา → กล้อง · กล้องที่ใช้อยู่บนสุด) ──
  const coneOrder = [...plan.objects].filter((x) => x.type === 'light' || x.type === 'entity' || x.type === 'camera')
    .sort((a, b) => rank(a) - rank(b));
  function rank(x) { return x.type === 'light' ? 0 : x.type === 'entity' ? 1 : x.id === activeCam ? 3 : 2; }
  for (const ob of coneOrder) {
    const p = poses.get(ob.id);
    if (!p || p.hidden) continue;
    const c = F.coneOf(ob);
    if (!c) continue;
    if (ob.type === 'entity' && !V.showSight && !o.exp) continue;
    const d = F.conePath(p.x, p.y, p.rot, c.fov, c.range);
    if (!d) continue;
    if (ob.type === 'camera') {
      const on = ob.id === activeCam;
      sv('path', { d, fill: ob.color || P.accent, 'fill-opacity': on ? 0.2 : 0.06, stroke: ob.color || P.accent, 'stroke-opacity': on ? 0.9 : 0.35,
                   'stroke-width': on ? 1.6 : 1, 'vector-effect': 'non-scaling-stroke', class: 'fp-cone fp-cone-cam' + (on ? ' on' : '') }, Lcone);
    } else if (ob.type === 'light') {
      const col = lightColor(ob);
      sv('path', { d, fill: col, 'fill-opacity': 0.08 + 0.14 * Math.min(1, (ob.intensity || 0) / 100), stroke: col, 'stroke-opacity': 0.5,
                   'stroke-width': 1, 'stroke-dasharray': '2 3', 'vector-effect': 'non-scaling-stroke', class: 'fp-cone fp-cone-light' }, Lcone);
    } else {
      sv('path', { d, fill: ob.color || P.fg, 'fill-opacity': 0.07, stroke: ob.color || P.fg, 'stroke-opacity': 0.45,
                   'stroke-width': 1, 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke', class: 'fp-cone fp-cone-sight' }, Lcone);
    }
  }
  // ── เส้นการเคลื่อนที่จากจังหวะก่อน ──
  if ((o.editing || o.exp) && (V.showPaths || o.exp) && o.beat > 0) {
    for (const m of F.movesInto(plan, o.beat)) {
      const ob = F.objById(plan, m.id);
      if (!ob || ob.type === 'shape' || ob.type === 'track' || !m.moved) continue;
      const col = ob.type === 'camera' ? (ob.color || P.accent) : ob.type === 'light' ? lightColor(ob) : (ob.color || P.fg);
      sv('line', { x1: m.from.x, y1: m.from.y, x2: m.to.x, y2: m.to.y, stroke: col, 'stroke-width': 1.5, 'stroke-dasharray': '5 4',
                   'vector-effect': 'non-scaling-stroke', class: 'fp-move' }, Lpath);
      sv('circle', { cx: m.from.x, cy: m.from.y, r: 7 * k, fill: 'none', stroke: col, 'stroke-dasharray': '2 2', 'stroke-width': 1,
                     'vector-effect': 'non-scaling-stroke', class: 'fp-ghost' }, Lpath);
      // หัวลูกศรที่ปลาย (สามเหลี่ยมขนาดคงที่บนจอ)
      const a = Math.atan2(m.to.y - m.from.y, m.to.x - m.from.x);
      const back = 14 * k, ax = m.to.x - Math.cos(a) * back, ay = m.to.y - Math.sin(a) * back, s = 5 * k;
      sv('path', { d: `M${ax + Math.cos(a) * s} ${ay + Math.sin(a) * s}L${ax + Math.cos(a + 2.4) * s} ${ay + Math.sin(a + 2.4) * s}L${ax + Math.cos(a - 2.4) * s} ${ay + Math.sin(a - 2.4) * s}Z`, fill: col }, Lpath);
    }
  }
  // ── ตัวละคร · ไฟ · กล้อง ──
  for (const ob of plan.objects) {
    if (ob.type === 'shape' || ob.type === 'track') continue;
    const p = poses.get(ob.id);
    if (!p || (p.hidden && !o.editing)) continue;
    const g = sv('g', { 'data-id': ob.id, class: 'fp-obj fp-' + ob.type + (p.hidden ? ' fp-hidden' : '') }, Lobj);
    if (p.hidden) g.setAttribute('opacity', '0.3');
    if (ob.type === 'entity') drawEntity(g, Llab, ob, p, k, P, framed.has(ob.id));
    else if (ob.type === 'camera') drawCamera(g, Llab, ob, p, k, P, ob.id === activeCam);
    else drawLight(g, Llab, ob, p, k, P);
  }
  // ── จุดจับของชิ้นที่เลือก ──
  if (o.sel) drawSelection(Lsel, plan, o.sel, poses, k, P);
}

function bgHref(rel) { try { return V.imgURL ? V.imgURL(rel) : rel; } catch { return rel; } }
function lightColor(ob) {
  if (ob.gel === 'color' && ob.gelColor) return safeCssColor(ob.gelColor, '#ffd27f');
  return G.cctToHex((ob.cct || 5600) + G.gelShift(ob.gel));
}

function label(L, x, y, text, k, P, o = {}) {
  if (!text) return null;
  const n = sv('text', { x, y, 'font-size': (o.size || 11) * k, 'text-anchor': 'middle', fill: o.fill || P.fg,
                         'paint-order': 'stroke', stroke: P.bg, 'stroke-width': 3 * k, 'stroke-linejoin': 'round',
                         'font-weight': o.bold ? 600 : 400, class: 'fp-label' }, L);
  n.textContent = text;
  return n;
}
function entityR(ob, k) { return Math.max(ob.size || 0.35, 9 * k); }
function drawEntity(g, L, ob, p, k, P, inFrame) {
  const r = entityR(ob, k), col = ob.color || P.fg;
  if (inFrame) sv('circle', { cx: p.x, cy: p.y, r: r + 4 * k, fill: 'none', stroke: P.accent, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', class: 'fp-framed' }, g);
  sv('circle', { cx: p.x, cy: p.y, r, fill: col, stroke: P.bg, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, g);
  // จมูก = ทิศที่หันหน้า
  const a = (p.rot * Math.PI) / 180;
  const nx = p.x + Math.cos(a) * r, ny = p.y + Math.sin(a) * r;
  const s = Math.max(r * 0.55, 5 * k);
  sv('path', { d: `M${nx + Math.cos(a) * s} ${ny + Math.sin(a) * s}L${nx + Math.cos(a + 1.9) * s * 0.8} ${ny + Math.sin(a + 1.9) * s * 0.8}L${nx + Math.cos(a - 1.9) * s * 0.8} ${ny + Math.sin(a - 1.9) * s * 0.8}Z`,
               fill: col, stroke: P.bg, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', class: 'fp-nose' }, g);
  const name = entityName(ob) || ob.label || '';
  const ini = sv('text', { x: p.x, y: p.y + r * 0.36, 'font-size': r * 1.05, 'text-anchor': 'middle', fill: P.onColor, 'font-weight': 600, 'pointer-events': 'none' }, g);
  ini.textContent = Array.from(name.trim())[0] || '';
  // ป้ายชื่ออยู่ฝั่งตรงข้ามกับทิศที่หัน (ไม่ทับจมูก/จุดจับหมุน)
  const lx = p.x - Math.cos(a) * (r + 12 * k), ly = p.y - Math.sin(a) * (r + 12 * k) + 4 * k;
  label(L, lx, ly, name, k, P);
}
function drawCamera(g, L, ob, p, k, P, on) {
  const col = on ? (ob.color || P.accent) : P.dim;
  const inner = sv('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot})` }, g);
  sv('rect', { x: -12 * k, y: -8 * k, width: 17 * k, height: 16 * k, rx: 2 * k, fill: col, stroke: P.bg, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, inner);
  sv('path', { d: `M${5 * k} ${-5 * k}L${13 * k} ${-9 * k}V${9 * k}L${5 * k} ${5 * k}Z`, fill: col, stroke: P.bg, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, inner);
  if (ob.support === 'dolly' || ob.support === 'slider') sv('rect', { x: -14 * k, y: -11 * k, width: 21 * k, height: 22 * k, fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '2 2', 'vector-effect': 'non-scaling-stroke' }, inner);
  label(L, p.x, p.y - 15 * k, (ob.label || '?') + ' · ' + Math.round(ob.lens || 0) + 'mm', k, P, { bold: on, fill: on ? col : P.fg });
}
function drawLight(g, L, ob, p, k, P) {
  const col = lightColor(ob);
  const inner = sv('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot})` }, g);
  if (ob.beam >= 359) {
    sv('circle', { cx: 0, cy: 0, r: 8 * k, fill: col, stroke: P.bg, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, inner);
  } else if (ob.kind === 'softbox' || ob.kind === 'ledPanel' || ob.kind === 'tube' || ob.kind === 'bounce') {
    sv('rect', { x: -3 * k, y: -11 * k, width: 6 * k, height: 22 * k, rx: 1.5 * k, fill: col, stroke: P.bg, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, inner);
  } else {
    sv('path', { d: `M${-9 * k} ${-6 * k}H${2 * k}L${9 * k} ${-10 * k}V${10 * k}L${2 * k} ${6 * k}H${-9 * k}Z`, fill: col, stroke: P.bg, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, inner);
  }
  label(L, p.x, p.y - 14 * k, ob.label || t(G.labelKey('light', ob.kind)), k, P, { size: 10 });
}
function drawShape(L, ob, p, k, P) {
  const g = sv('g', { 'data-id': ob.id, class: 'fp-obj fp-shape fp-shape-' + (ob.kind || ob.type) }, L);
  const fill = ob.fill || P.chip, stroke = ob.stroke || P.fg;
  if (ob.type === 'track') {
    const pts = F.worldPts(ob, p);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q.x + ' ' + q.y).join('');
    sv('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 12 * k, class: 'fp-hit' }, g);
    sv('path', { d, fill: 'none', stroke: ob.color || P.dim, 'stroke-width': 0.3, 'stroke-opacity': 0.55, 'stroke-linejoin': 'round' }, g);
    sv('path', { d, fill: 'none', stroke: ob.color || P.fg, 'stroke-width': 1.2, 'stroke-dasharray': '1 6', 'vector-effect': 'non-scaling-stroke' }, g);
    if (pts.length) label(g, pts[0].x, pts[0].y - 10 * k, ob.label || t('ui.fp.typeTrack'), k, P, { size: 10, fill: P.dim });
    return g;
  }
  if (G.POLY_KINDS.has(ob.kind)) {
    const pts = F.worldPts(ob, p);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q.x + ' ' + q.y).join('');
    sv('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 12 * k, class: 'fp-hit' }, g);
    if (ob.kind === 'wall') {
      sv('path', { d, fill: 'none', stroke: ob.stroke || P.line, 'stroke-width': Math.max(ob.thick || 0.15, 2 * k), 'stroke-linecap': 'square', 'stroke-linejoin': 'miter', opacity: ob.opacity }, g);
    } else {
      sv('path', { d, fill: 'none', stroke, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', opacity: ob.opacity }, g);
      if (ob.kind === 'arrow' && pts.length > 1) {
        const a = pts[pts.length - 1], b = pts[pts.length - 2], ang = Math.atan2(a.y - b.y, a.x - b.x), s = 9 * k;
        sv('path', { d: `M${a.x} ${a.y}L${a.x - Math.cos(ang - 0.45) * s} ${a.y - Math.sin(ang - 0.45) * s}L${a.x - Math.cos(ang + 0.45) * s} ${a.y - Math.sin(ang + 0.45) * s}Z`, fill: stroke }, g);
      }
    }
    if (ob.label && pts.length) label(g, pts[0].x, pts[0].y - 8 * k, ob.label, k, P, { size: 10, fill: P.dim });
    return g;
  }
  const w = ob.w || 1, h = ob.h || 1;
  const inner = sv('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot})`, opacity: ob.opacity }, g);
  const common = { fill, stroke, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' };
  switch (ob.kind) {
    case 'ellipse': sv('ellipse', { cx: 0, cy: 0, rx: w / 2, ry: h / 2, ...common }, inner); break;
    case 'rounded': sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: Math.min(w, h) * 0.22, ...common }, inner); break;
    case 'triangle': sv('path', { d: `M0 ${-h / 2}L${w / 2} ${h / 2}L${-w / 2} ${h / 2}Z`, ...common }, inner); break;
    case 'door': {
      // เฟรม + บานประตู + เส้นโค้งแนววงสวิง (สัญลักษณ์แบบแปลนสถาปัตย์)
      sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: P.bg, stroke, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, inner);
      sv('line', { x1: -w / 2, y1: 0, x2: -w / 2, y2: -w, stroke, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, inner);
      sv('path', { d: `M${-w / 2} ${-w}A${w} ${w} 0 0 1 ${w / 2} 0`, fill: 'none', stroke, 'stroke-width': 1, 'stroke-dasharray': '3 3', 'vector-effect': 'non-scaling-stroke' }, inner);
      break;
    }
    case 'window':
      sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: P.bg, stroke, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, inner);
      sv('line', { x1: -w / 2, y1: 0, x2: w / 2, y2: 0, stroke, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, inner);
      break;
    case 'stairs': {
      sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, ...common }, inner);
      const n = Math.max(2, Math.min(40, Math.round(h / 0.28)));
      let d = '';
      for (let i = 1; i < n; i++) { const y = -h / 2 + (h * i) / n; d += `M${-w / 2} ${y}H${w / 2}`; }
      sv('path', { d, stroke, 'stroke-width': 0.8, fill: 'none', 'vector-effect': 'non-scaling-stroke' }, inner);
      sv('path', { d: `M0 ${h / 2 - h * 0.1}V${-h / 2 + h * 0.15}M${-w * 0.12} ${-h / 2 + h * 0.28}L0 ${-h / 2 + h * 0.12}L${w * 0.12} ${-h / 2 + h * 0.28}`, stroke, fill: 'none', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, inner);
      break;
    }
    case 'flag': sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: ob.fill || P.line, stroke: P.bg, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', opacity: 0.85 }, inner); break;
    case 'text': {
      sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent', class: 'fp-hit' }, inner);
      const tx = sv('text', { x: 0, y: h * 0.32, 'font-size': h * 0.9, 'text-anchor': 'middle', fill: ob.stroke || P.fg, class: 'fp-label' }, inner);
      tx.textContent = ob.text || ob.label || t(G.labelKey('shape', 'text'));
      return g;
    }
    default: sv('rect', { x: -w / 2, y: -h / 2, width: w, height: h, ...common }, inner);
  }
  if (ob.label) label(g, p.x, p.y + 4 * k, ob.label, k, P, { size: 10 });
  return g;
}

function handle(L, x, y, h, k, P, shape = 'circle') {
  const a = { 'data-h': h, class: 'fp-h fp-h-' + h.split(':')[0], fill: P.bg, stroke: P.accent, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' };
  if (shape === 'rect') return sv('rect', { x: x - 5 * k, y: y - 5 * k, width: 10 * k, height: 10 * k, ...a }, L);
  return sv('circle', { cx: x, cy: y, r: 5.5 * k, ...a }, L);
}
function objRadius(ob, k) {
  if (ob.type === 'entity') return entityR(ob, k);
  if (ob.type === 'camera') return 14 * k;
  if (ob.type === 'light') return 11 * k;
  return Math.hypot(ob.w || 1, ob.h || 1) / 2;
}
function drawSelection(L, plan, id, poses, k, P) {
  const ob = F.objById(plan, id), p = poses.get(id);
  if (!ob || !p) return;
  if (ob.pts) {
    const pts = F.worldPts(ob, p);
    pts.forEach((q, i) => handle(L, q.x, q.y, 'v:' + i, k, P, 'rect'));
    return;
  }
  const R = objRadius(ob, k);
  sv('circle', { cx: p.x, cy: p.y, r: R + 5 * k, fill: 'none', stroke: P.accent, 'stroke-width': 1.2, 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, L);
  const a = (p.rot * Math.PI) / 180;
  const rr = R + 22 * k;
  sv('line', { x1: p.x + Math.cos(a) * (R + 5 * k), y1: p.y + Math.sin(a) * (R + 5 * k), x2: p.x + Math.cos(a) * rr, y2: p.y + Math.sin(a) * rr,
               stroke: P.accent, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, L);
  handle(L, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 'rot', k, P);
  const c = F.coneOf(ob);
  if (c && c.range > 0) handle(L, p.x + Math.cos(a) * c.range, p.y + Math.sin(a) * c.range, 'range', k, P, 'rect');
  if (ob.type === 'shape') {
    const cx = (ob.w || 1) / 2, cy = (ob.h || 1) / 2;
    handle(L, p.x + cx * Math.cos(a) - cy * Math.sin(a), p.y + cx * Math.sin(a) + cy * Math.cos(a), 'size', k, P, 'rect');
  }
}
function drawPreview(svg, cam, W, H) {
  const P = palette(false), z = cam.z;
  const g = sv('g', { transform: `translate(${W / 2 - cam.cx * z} ${H / 2 - cam.cy * z}) scale(${z})`, 'pointer-events': 'none' }, svg);
  const pts = [...V.draw.pts, ...(V.hover ? [V.hover] : [])];
  sv('path', { d: pts.map((q, i) => (i ? 'L' : 'M') + q.x + ' ' + q.y).join(''), fill: 'none', stroke: P.accent, 'stroke-width': 2, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke', class: 'fp-drawing' }, g);
  for (const q of V.draw.pts) sv('circle', { cx: q.x, cy: q.y, r: 4 / z, fill: P.accent }, g);
}

// ═══════════════════════ เมาส์ · คีย์บอร์ด ═══════════════════════
function wireStage(stage, svg, plan) {
  svg.addEventListener('pointerdown', (e) => onDown(e));
  svg.addEventListener('pointermove', (e) => { if (V.draw) { V.hover = toWorld(e); schedulePaint(); } });
  svg.addEventListener('dblclick', (e) => { if (V.draw) { e.preventDefault(); finishDraw(); } else onDbl(e); });
  svg.addEventListener('contextmenu', (e) => onContext(e));
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = S.currentPlan(); if (!p) return;
    const c = camOf(p);
    if (e.shiftKey) { c.cx += (e.deltaY || e.deltaX) / c.z; schedulePaint(); return; }
    const r = svg.getBoundingClientRect();
    V.cams.set(p.id, F.zoomAt(c, F.zoomStepFp(c.z, e.deltaY < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top, r.width, r.height));
    schedulePaint();
  }, { passive: false });
  stage.addEventListener('keydown', onKey);
  // หยิบใส่: ลากเอนทิตี้จาก Explorer/แผงอื่นมาวางลงผัง = วางตรงจุดที่ปล่อย
  bindDropTarget(stage, {
    accept: ['entity'],
    onDrop: (payload, e) => addEntities(payload.items, toWorld(e)),
    onError: (err) => log('warn', 'floorplan: drop', err),
  });
}

function hitObj(e) { const n = e.target && e.target.closest && e.target.closest('[data-id]'); return n ? n.getAttribute('data-id') : null; }
function hitHandle(e) { const n = e.target && e.target.closest && e.target.closest('[data-h]'); return n ? n.getAttribute('data-h') : null; }

function onDown(e) {
  const plan = S.currentPlan();
  if (!plan || V.play) { if (V.play) stopPlay(); return; }
  V.el.stage.focus({ preventScroll: true });
  if (e.button === 1) { e.preventDefault(); return panDrag(e); }
  if (e.button !== 0) return;
  const w = toWorld(e);
  if (V.tool !== 'select') { e.preventDefault(); return placeAt(w, e); }
  const h = hitHandle(e);
  if (h && V.sel) { e.preventDefault(); return handleDrag(e, h); }
  const id = hitObj(e);
  if (id) {
    e.preventDefault();
    if (V.sel !== id) { V.sel = id; renderInsp(); paint(); }
    return moveDrag(e, id);
  }
  panDrag(e, true);
}

/** ลากพื้นว่าง = เลื่อนผัง · ไม่ขยับ = ยกเลิกการเลือก */
function panDrag(e, clickDeselect = false) {
  const plan = S.currentPlan();
  const c = camOf(plan), c0 = { ...c };
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  V.el.stage.classList.add('fp-panning');
  const mv = (ev) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    c.cx = c0.cx - dx / c.z; c.cy = c0.cy - dy / c.z;
    schedulePaint();
  };
  const end = () => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (V.el) V.el.stage.classList.remove('fp-panning');
  };
  const up = () => {
    end(); offEsc();
    if (!moved && clickDeselect && V.sel) { V.sel = null; renderInsp(); paint(); }
  };
  const offEsc = escCancelDrag(() => { end(); Object.assign(c, c0); paint(); });
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}

/** ลากชิ้น — ขยับตำแหน่ง "ในจังหวะนี้" (จังหวะหลังจากนี้ที่ไม่มีตำแหน่งของตัวเองตามไปด้วย) */
function moveDrag(e, id) {
  const plan = S.currentPlan();
  const ob = F.objById(plan, id);
  const p0 = F.poseAt(plan, id, V.beat);
  const w0 = toWorld(e);
  const snap = snapshot();
  let moved = false;
  const mv = (ev) => {
    const w = toWorld(ev);
    let nx = p0.x + (w.x - w0.x), ny = p0.y + (w.y - w0.y);
    if (ev.altKey && plan.grid.on) { const s = plan.grid.size; nx = Math.round(nx / s) * s; ny = Math.round(ny / s) * s; }
    if (ob.type === 'camera' && ob.trackId) { const q = F.snapToTrack(plan, ob, { x: nx, y: ny }, V.beat); nx = q.x; ny = q.y; }
    if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
    moved = true;
    F.setPose(plan, id, V.beat, { x: nx, y: ny });
    schedulePaint();
  };
  const end = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  const up = () => {
    end(); offEsc();
    if (!moved) return;
    // ย้ายราง = กล้องที่ติดรางนี้ต้องตามไปอยู่บนราง (ไม่งั้นลอยค้างที่เดิม)
    if (ob.type === 'track') {
      for (const c of plan.objects) {
        if (c.type !== 'camera' || c.trackId !== ob.id) continue;
        F.setPose(plan, c.id, V.beat, F.snapToTrack(plan, c, F.poseAt(plan, c.id, V.beat), V.beat));
      }
      paint();
    }
    pushUndo(snap); S.markPlanDirty(); renderBeats(); renderInsp();
  };
  // [alpha.168 · bug hunt] restore() สร้างวัตถุใหม่ทั้งผัง — แผงคุณสมบัติที่ยังถือวัตถุเก่าต้องวาดใหม่ (ไม่งั้นการแก้ครั้งถัดไปหาย)
  const offEsc = escCancelDrag(() => { end(); restore(snap); fixSel(); afterChange(); });
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}

/** ลากจุดจับ: หมุน · ระยะของกรวย · ขนาดรูปทรง · จุดของเส้น */
function handleDrag(e, h) {
  const plan = S.currentPlan();
  const ob = F.objById(plan, V.sel);
  if (!ob) return;
  const snap = snapshot();
  let moved = false;
  const mv = (ev) => {
    moved = true;
    const w = toWorld(ev);
    const p = F.poseAt(plan, ob.id, V.beat);
    if (h === 'rot') {
      let a = (Math.atan2(w.y - p.y, w.x - p.x) * 180) / Math.PI;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      F.setPose(plan, ob.id, V.beat, { rot: a });
    } else if (h === 'range') {
      const d = Math.max(0.2, Math.round(Math.hypot(w.x - p.x, w.y - p.y) * 10) / 10);
      if (ob.type === 'entity') ob.sight.range = d; else ob.range = d;
    } else if (h === 'size') {
      const a = (-p.rot * Math.PI) / 180, dx = w.x - p.x, dy = w.y - p.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      ob.w = Math.max(0.1, Math.round(Math.abs(lx) * 2 * 100) / 100);
      ob.h = Math.max(0.05, Math.round(Math.abs(ly) * 2 * 100) / 100);
    } else if (h.startsWith('v:')) {
      const i = +h.slice(2);
      const a = (-p.rot * Math.PI) / 180, dx = w.x - p.x, dy = w.y - p.y;
      let lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (ev.altKey && plan.grid.on) { const s = plan.grid.size; lx = Math.round((lx + p.x) / s) * s - p.x; ly = Math.round((ly + p.y) / s) * s - p.y; }
      if (ob.pts[i]) ob.pts[i] = { x: Math.round(lx * 1000) / 1000, y: Math.round(ly * 1000) / 1000 };
    }
    schedulePaint();
  };
  const end = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  const up = () => { end(); offEsc(); if (moved) { pushUndo(snap); S.markPlanDirty(); renderInsp(); renderBeats(); } };
  // [alpha.168 · bug hunt] restore() สร้างวัตถุใหม่ทั้งผัง — แผงคุณสมบัติที่ยังถือวัตถุเก่าต้องวาดใหม่ (ไม่งั้นการแก้ครั้งถัดไปหาย)
  const offEsc = escCancelDrag(() => { end(); restore(snap); fixSel(); afterChange(); });
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}

function onDbl(e) {
  const id = hitObj(e);
  const plan = S.currentPlan();
  if (!id || !plan) return;
  const ob = F.objById(plan, id);
  if (ob && ob.type === 'entity' && ob.entityFile) openEntityOf(ob);
}

async function onContext(e) {
  e.preventDefault();
  const id = hitObj(e);
  const plan = S.currentPlan();
  if (!id || !plan) return;
  V.sel = id; renderInsp(); paint();
  const ob = F.objById(plan, id);
  const { popupMenu } = await import('./ui.js');
  const hid = F.poseAt(plan, id, V.beat).hidden;
  const items = [
    { label: esc(t(hid ? 'ui.fp.showHere' : 'ui.fp.hideHere')), click: () => edit(() => F.setPose(plan, id, V.beat, { hidden: !hid })) },
  ];
  if (V.beat > 0 && F.hasKey(plan, id, V.beat)) items.push({ label: esc(t('ui.fp.fResetKey')), click: () => edit(() => F.clearPoseKey(plan, id, V.beat)) });
  items.push('-',
    { label: esc(t('ui.fp.fDup')), click: () => duplicateSel() },
    { label: esc(t('ui.fp.fFront')), click: () => edit(() => { plan.objects = [...plan.objects.filter((x) => x.id !== id), ob]; }) },
    { label: esc(t('ui.fp.fBack')), click: () => edit(() => { plan.objects = [ob, ...plan.objects.filter((x) => x.id !== id)]; }) });
  if (ob.type === 'entity' && ob.entityFile) items.push({ label: esc(t('ui.fp.fOpenWiki')), click: () => openEntityOf(ob) });
  items.push('-', { label: esc(t('ui.common.del')), danger: true, click: () => removeSel() });
  popupMenu(e.clientX, e.clientY, items);
}

function onKey(e) {
  const plan = S.currentPlan();
  if (!plan) return;
  if (e.target !== V.el.stage) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.code === 'KeyZ') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.code === 'KeyY') { e.preventDefault(); e.stopPropagation(); redo(); return; }
  if (mod && e.code === 'KeyD') { e.preventDefault(); e.stopPropagation(); duplicateSel(); return; }
  if (e.key === 'Escape') {
    if (V.play) { e.preventDefault(); stopPlay(); return; }
    if (V.draw) { e.preventDefault(); e.stopPropagation(); cancelDraw(); paint(); return; }
    if (V.tool !== 'select') { e.preventDefault(); e.stopPropagation(); setTool('select'); return; }
    if (V.sel) { e.preventDefault(); e.stopPropagation(); V.sel = null; renderInsp(); paint(); }
    return;
  }
  if (V.draw && e.key === 'Enter') { e.preventDefault(); finishDraw(); return; }
  if (V.draw && e.key === 'Backspace') { e.preventDefault(); V.draw.pts.pop(); if (!V.draw.pts.length) cancelDraw(); paint(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && V.sel) { e.preventDefault(); removeSel(); return; }
  // [alpha.168 · bug hunt] ปุ่มสัญลักษณ์จับด้วย e.code (ปุ่มกายภาพ) — เดิมเทียบ e.key ซึ่งบนแป้นไทยเป็นตัวอักษรไทย = กดไม่ติดทั้งชุด
  if (e.key === 'PageDown' || (e.code === 'Period' && !mod)) { e.preventDefault(); gotoBeat(V.beat + 1); return; }
  if (e.key === 'PageUp' || (e.code === 'Comma' && !mod)) { e.preventDefault(); gotoBeat(V.beat - 1); return; }
  if (e.code === 'Space') { e.preventDefault(); if (V.play) stopPlay(); else startPlay(); return; }
  if (mod || e.altKey) return;
  if (V.sel && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
    e.preventDefault();
    const p = F.poseAt(plan, V.sel, V.beat);
    edit(() => F.setPose(plan, V.sel, V.beat, { rot: p.rot + (e.code === 'BracketRight' ? 15 : -15) }), { beats: false });
    return;
  }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key]) {
    e.preventDefault();
    const [dx, dy] = arrows[e.key];
    if (V.sel) {
      const st = e.shiftKey ? 1 : 0.1;
      const p = F.poseAt(plan, V.sel, V.beat);
      edit(() => F.setPose(plan, V.sel, V.beat, { x: p.x + dx * st, y: p.y + dy * st }), { beats: false });
    } else {
      const c = camOf(plan); c.cx += (dx * 60) / c.z; c.cy += (dy * 60) / c.z; paint();
    }
    return;
  }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); const c = camOf(plan); c.z = F.zoomStepFp(c.z, 1); paint(); return; }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); const c = camOf(plan); c.z = F.zoomStepFp(c.z, -1); paint(); return; }
  if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); fitAll(); paint(); }
}

// ── วางของใหม่ ──
function placeAt(w, e) {
  const plan = S.currentPlan();
  if (isPolyTool()) {
    if (!V.draw) V.draw = { type: V.tool === 'track' ? 'track' : 'shape', kind: V.toolArg, pts: [] };
    const q = e.altKey && plan.grid.on ? { x: Math.round(w.x / plan.grid.size) * plan.grid.size, y: Math.round(w.y / plan.grid.size) * plan.grid.size } : w;
    V.draw.pts.push({ x: Math.round(q.x * 1000) / 1000, y: Math.round(q.y * 1000) / 1000 });
    paint();
    return;
  }
  let ob;
  if (V.tool === 'camera') ob = F.newObject('camera', { x: w.x, y: w.y, label: F.nextCameraLabel(plan), color: '' });
  else if (V.tool === 'light') ob = F.newObject('light', { x: w.x, y: w.y, kind: V.toolArg || 'fresnel' });
  else if (V.tool === 'shape') ob = F.newObject('shape', { x: w.x, y: w.y, kind: V.toolArg || 'rect' });
  if (!ob) return;
  edit(() => { plan.objects.push(ob); });
  V.sel = ob.id;
  if (!e.shiftKey) setTool('select');          // Shift ค้าง = วางต่อหลายชิ้น
  renderInsp(); paint();
}
function finishDraw() {
  const plan = S.currentPlan();
  const d = V.draw;
  V.draw = null; V.hover = null;
  if (!plan || !d || d.pts.length < 2) { paint(); return; }
  const o = d.pts[0];
  const pts = d.pts.map((q) => ({ x: q.x - o.x, y: q.y - o.y }));
  const ob = d.type === 'track' ? F.newObject('track', { x: o.x, y: o.y, pts }) : F.newObject('shape', { x: o.x, y: o.y, kind: d.kind, pts });
  edit(() => { plan.objects.push(ob); });
  V.sel = ob.id;
  setTool('select');
  renderInsp(); paint();
}
function cancelDraw() { V.draw = null; V.hover = null; }

/** เอนทิตี้จาก Wiki ลงผัง — ปล่อยหลายชิ้นพร้อมกัน = เรียงเยื้องกันไม่ทับ */
export async function addEntities(items, at) {
  const plan = S.currentPlan();
  if (!plan || !items || !items.length) return 0;
  const names = await entityNames();
  const c = camOf(plan);
  const base = at || { x: c.cx, y: c.cy };
  const add = [];
  items.forEach((it, i) => {
    const file = it.path || it.file;
    if (!file) return;
    const rel = F.entityRel(file, state.root);
    const hit = names.get(normP(rel));
    const ob = F.newObject('entity', { x: base.x + i * 0.9, y: base.y, entityFile: rel, cat: it.cat || (hit && hit.cat) || '',
                                       label: (hit && hit.name) || it.title || '', color: F.nextColor({ objects: [...plan.objects, ...add] }, 'entity') });
    add.push(ob);
  });
  if (!add.length) return 0;
  edit(() => { plan.objects.push(...add); });
  V.sel = add[add.length - 1].id;
  renderInsp(); paint();
  return add.length;
}

async function removeSel() {
  const plan = S.currentPlan();
  if (!plan || !V.sel) return;
  const ob = F.objById(plan, V.sel);
  if (!ob) return;
  const snap = snapshot();
  const planId0 = plan.id;
  const name = objLabel(ob);
  edit(() => {
    plan.objects = plan.objects.filter((x) => x.id !== ob.id);
    for (const b of plan.beats) { delete b.keys[ob.id]; if (b.cam === ob.id) b.cam = ''; }
    for (const x of plan.objects) if (x.trackId === ob.id) x.trackId = '';
  });
  V.sel = null;
  renderInsp(); paint();
  const { toast } = await import('./ui.js');
  toast(tf('ui.fp.removed', name), { action: { label: t('ui.fp.undoAct'), onClick: () => {
    if (!S.currentPlan() || S.currentPlan().id !== planId0) return;      // เปลี่ยนผังไปแล้ว — ห้ามเอาภาพของผังเดิมมาทับ
    V.undo.push({ id: V.planId, s: snapshot() }); restore(snap); S.markPlanDirty(); fixSel(); afterChange();
  } } });
}
function duplicateSel() {
  const plan = S.currentPlan();
  const ob = plan && F.objById(plan, V.sel);
  if (!ob) return;
  const p = F.poseAt(plan, ob.id, V.beat);
  const cp = JSON.parse(JSON.stringify(ob));
  cp.id = F.uid(ob.type[0]);
  cp.x = p.x + 0.6; cp.y = p.y + 0.6; cp.rot = p.rot; delete cp.hidden;
  if (cp.type === 'camera') cp.label = F.nextCameraLabel(plan);
  edit(() => { plan.objects.push(cp); });
  V.sel = cp.id;
  renderInsp(); paint();
}

// ═══════════════════════ แผงคุณสมบัติ ═══════════════════════
function field(labelText, input) {
  const r = el('label', 'fp-f');
  r.append(el('span', 'fp-f-l', labelText), input);
  return r;
}
function numIn(v, step, onSet, o = {}) {
  const i = el('input', 'fp-in fp-num');
  i.type = 'number'; i.step = String(step);
  if (o.min != null) i.min = String(o.min);
  if (o.max != null) i.max = String(o.max);
  i.value = String(Math.round(v * 1000) / 1000);
  i.onchange = () => { const n = parseFloat(i.value); if (Number.isFinite(n)) onSet(o.min != null ? Math.max(o.min, o.max != null ? Math.min(o.max, n) : n) : n); };
  return i;
}
function textIn(v, onSet, ph = '') {
  const i = el('input', 'fp-in');
  i.value = v || ''; if (ph) i.placeholder = ph;
  i.onchange = () => onSet(i.value);
  return i;
}
function selIn(options, v, onSet) {
  const s = el('select', 'fp-in');
  for (const [val, text, group] of options) {
    let host = s;
    if (group) { host = [...s.children].find((g) => g.tagName === 'OPTGROUP' && g.label === group); if (!host) { host = el('optgroup'); host.label = group; s.append(host); } }
    const o = el('option', null, text); o.value = val; host.append(o);
  }
  s.value = v;
  s.onchange = () => onSet(s.value);
  return s;
}
function colorIn(v, onSet) {
  const i = el('input', 'fp-in fp-color');
  i.type = 'color';
  i.value = /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#888888';
  i.onchange = () => onSet(i.value);
  return i;
}
function checkIn(v, text, onSet) {
  const r = el('label', 'fp-chk');
  const i = el('input'); i.type = 'checkbox'; i.checked = !!v;
  i.onchange = () => onSet(i.checked);
  r.append(i, el('span', null, text));
  return r;
}
function sec(title) { return el('div', 'fp-sec', title); }

function renderInsp() {
  if (!V.el) return;
  const box = V.el.insp;
  const keep = box.scrollTop;
  const act = document.activeElement;
  const focusIdx = act && box.contains(act) ? [...box.querySelectorAll(FOCUSABLE)].indexOf(act) : -1;
  box.replaceChildren();
  const plan = S.currentPlan();
  if (!plan) return;
  const ob = V.sel ? F.objById(plan, V.sel) : null;
  if (!ob) inspPlan(box, plan); else inspObj(box, plan, ob);
  box.scrollTop = keep;
  // แก้ช่องหนึ่งแล้วกด Tab = แผงถูกวาดใหม่ทั้งแผง → คืนโฟกัสไปช่องลำดับเดียวกัน (ไม่งั้นโฟกัสหลุดทุกช่อง)
  if (focusIdx >= 0) { const f = box.querySelectorAll(FOCUSABLE)[focusIdx]; if (f) f.focus({ preventScroll: true }); }
}
const FOCUSABLE = 'input, select, textarea, button';

/** ไม่ได้เลือกอะไร = จังหวะปัจจุบัน + การตั้งค่าผัง */
function inspPlan(box, plan) {
  const b = plan.beats[V.beat];
  box.append(sec(tf('ui.fp.beat', V.beat + 1)));
  // อ้างอิง
  const ref = el('div', 'fp-ref' + (b.ref.text ? '' : ' empty'));
  ref.append(icon(b.ref.kind === 'scene' ? 'file' : 'pencil', 14), el('span', null, ' ' + (b.ref.text || t('ui.fp.refNone'))));
  ref.title = t('ui.fp.refMenu');
  ref.onclick = (e) => refMenu(e.currentTarget, plan, V.beat);
  box.append(ref);
  const cams = plan.objects.filter((o) => o.type === 'camera');
  if (cams.length) {
    box.append(field(t('ui.fp.camOfBeat'), selIn(cams.map((c) => [c.id, tf('ui.fp.camName', c.label)]), F.activeCamId(plan, V.beat),
      (v) => edit(() => { b.cam = v; }))));
  }
  box.append(field(t('ui.fp.shotSize'), selIn([['', '—'], ...G.SHOT_SIZES.map((s) => [s, t(G.labelKey('shot', s))])], b.shot || '',
    (v) => edit(() => { b.shot = v; }))));
  const note = el('textarea', 'fp-in fp-note');
  note.value = b.note || '';
  note.placeholder = t('ui.fp.beatNotePh');
  note.onchange = () => edit(() => { b.note = note.value; }, { insp: false });
  box.append(field(t('ui.fp.beatNote'), note));
  appendFramed(box, plan, F.activeCamId(plan, V.beat));
  appendPromptBox(box, plan);

  box.append(sec(t('ui.fp.planSettings')));
  const style = el('textarea', 'fp-in fp-note fp-style');
  style.value = plan.style || '';
  style.placeholder = t('ui.fp.promptStylePh');
  style.onchange = () => edit(() => { plan.style = style.value.trim(); }, { insp: false });
  box.append(field(t('ui.fp.promptStyle'), style));
  box.append(field(t('ui.fp.gridSize'), numIn(plan.grid.size, 0.1, (v) => edit(() => { plan.grid.size = Math.max(0.1, v); }), { min: 0.1, max: 50 })));
  if (plan.bg) {
    const bg = plan.bg;
    box.append(field(t('ui.fp.bgW'), numIn(bg.w, 0.5, (v) => edit(() => { bg.w = Math.max(0.1, v); }), { min: 0.1 })));
    box.append(field(t('ui.fp.bgX'), numIn(bg.x, 0.1, (v) => edit(() => { bg.x = v; }))));
    box.append(field(t('ui.fp.bgY'), numIn(bg.y, 0.1, (v) => edit(() => { bg.y = v; }))));
    box.append(field(t('ui.fp.bgRot'), numIn(bg.rot, 1, (v) => edit(() => { bg.rot = F.normAngle(v); }))));
    box.append(field(t('ui.fp.bgOpacity'), numIn(bg.opacity, 0.05, (v) => edit(() => { bg.opacity = Math.max(0.05, Math.min(1, v)); }), { min: 0.05, max: 1 })));
  }
  const counts = el('div', 'dim fp-counts');
  counts.textContent = tf('ui.fp.counts', plan.objects.filter((o) => o.type === 'entity').length, plan.objects.filter((o) => o.type === 'camera').length,
    plan.objects.filter((o) => o.type === 'light').length, plan.beats.length);
  box.append(counts);
}
function appendFramed(box, plan, camId) {
  if (!camId) return;
  const f = F.framedIds(plan, V.beat, camId);
  const wrap = el('div', 'fp-framedlist');
  wrap.append(el('span', 'fp-f-l', t('ui.fp.fInFrame')));
  if (!f.length) wrap.append(el('span', 'dim', t('ui.fp.fNobody')));
  for (const x of f) {
    const ob = F.objById(plan, x.id);
    const chip = el('button', 'fp-chip');
    chip.type = 'button';
    chip.textContent = objLabel(ob) + ' · ' + fmtNum(Math.round(x.dist * 10) / 10) + ' ' + t('ui.fp.meterUnit');
    chip.onclick = () => { V.sel = x.id; renderInsp(); paint(); };
    wrap.append(chip);
  }
  box.append(wrap);
}

function inspObj(box, plan, ob) {
  const head = el('div', 'fp-sec fp-sec-obj');
  head.append(el('span', null, t(TYPE_KEYS[ob.type] || TYPE_KEYS.shape) + ' · '), el('b', null, objLabel(ob)));
  box.append(head);
  const set = (fn, o) => edit(() => { fn(); }, o);
  const pose = F.poseAt(plan, ob.id, V.beat);

  // ตัวละคร/ของที่ผูก Wiki: ชื่อมาจาก Wiki เสมอ (แก้ที่หน้า Wiki) — ช่องชื่อในผังจะไม่มีผลเลย จึงไม่แสดง
  const wikiLinked = ob.type === 'entity' && ob.entityFile;
  if (!wikiLinked && (ob.type !== 'shape' || ob.kind !== 'text')) box.append(field(t('ui.fp.fLabel'), textIn(ob.label, (v) => set(() => { ob.label = v; }))));
  if (ob.type === 'entity') {
    if (ob.entityFile) {
      const b = el('button', 'fp-mini');
      b.type = 'button';
      b.append(icon('link-external', 14), document.createTextNode(' ' + t('ui.fp.fOpenWiki')));
      b.onclick = () => openEntityOf(ob);
      box.append(b);
    }
    box.append(field(t('ui.fp.fColor'), colorIn(ob.color, (v) => set(() => { ob.color = v; }))));
    box.append(field(t('ui.fp.fSize'), numIn(ob.size, 0.05, (v) => set(() => { ob.size = Math.max(0.05, v); }), { min: 0.05, max: 20 })));
    box.append(checkIn(ob.sight.on, t('ui.fp.fSightOn'), (v) => set(() => { ob.sight.on = v; })));
    box.append(field(t('ui.fp.fSightFov'), numIn(ob.sight.fov, 5, (v) => set(() => { ob.sight.fov = v; }), { min: 1, max: 360 })));
    box.append(field(t('ui.fp.fSightRange'), numIn(ob.sight.range, 0.5, (v) => set(() => { ob.sight.range = v; }), { min: 0.1, max: 500 })));
  }
  if (ob.type === 'camera') {
    const bodies = G.CAMERA_BODIES.map((b) => [b.id, b.id === 'custom' ? t('ui.fp.fCustom') : G.bodyName(b) + (b.fmt ? ' (' + b.fmt + ')' : ''), b.id === 'custom' ? t('ui.fp.fCustom') : b.brand]);
    box.append(field(t('ui.fp.fBody'), selIn(bodies, ob.body, (v) => set(() => { ob.body = v; }))));
    if (ob.body === 'custom') box.append(field(t('ui.fp.fSensorW'), numIn(ob.sensorW, 0.1, (v) => set(() => { ob.sensorW = v; }), { min: 1, max: 80 })));
    const lens = numIn(ob.lens, 1, (v) => set(() => { ob.lens = v; }), { min: 1, max: 2000 });
    const dl = el('datalist'); dl.id = 'fp-lens-presets';
    for (const mm of G.LENS_PRESETS) { const o = el('option'); o.value = String(mm); dl.append(o); }
    lens.setAttribute('list', dl.id);
    box.append(field(t('ui.fp.fLens'), lens), dl);
    box.append(el('div', 'dim fp-fov', tf('ui.fp.fFovOut', fmtNum(Math.round(F.cameraFov(ob) * 10) / 10), F.equivFF(ob))));
    box.append(field(t('ui.fp.fRange'), numIn(ob.range, 0.5, (v) => set(() => { ob.range = v; }), { min: 0.1, max: 2000 })));
    box.append(field(t('ui.fp.fSupport'), selIn(G.SUPPORTS.map((s) => [s.id, t(G.labelKey('support', s.id))]), ob.support, (v) => set(() => {
      const was = G.supportOf(ob.support); ob.support = v;
      if (Math.abs(ob.height - was.h) < 1e-6) ob.height = G.supportOf(v).h;     // ยังเป็นความสูงตั้งต้น = ตามขาตั้งใหม่
      if (!G.supportOf(v).rail) ob.trackId = '';
    }))));
    if (G.supportOf(ob.support).rail) {
      const tracks = plan.objects.filter((x) => x.type === 'track');
      box.append(field(t('ui.fp.fTrack'), selIn([['', t('ui.fp.fNoTrack')], ...tracks.map((x) => [x.id, objLabel(x)])], ob.trackId || '', (v) => set(() => {
        ob.trackId = v;
        if (v) { const p = F.poseAt(plan, ob.id, V.beat); const q = F.snapToTrack(plan, ob, p, V.beat); F.setPose(plan, ob.id, V.beat, q); }
      }))));
    }
    box.append(field(t('ui.fp.fHeight'), numIn(ob.height, 0.1, (v) => set(() => { ob.height = v; }), { min: 0, max: 500 })));
    box.append(field(t('ui.fp.fAngle'), selIn(G.CAM_ANGLES.map((a) => [a, t(G.labelKey('angle', a))]), ob.angle, (v) => set(() => { ob.angle = v; }))));
    box.append(field(t('ui.fp.fColor'), colorIn(ob.color || themeColor('--accent-hi', '#d97757'), (v) => set(() => { ob.color = v; }))));
    const useB = el('button', 'fp-mini');
    useB.type = 'button';
    useB.append(icon('film', 14), document.createTextNode(' ' + t('ui.fp.fUseInBeat')));
    useB.onclick = () => edit(() => { plan.beats[V.beat].cam = ob.id; });
    box.append(useB);
    appendFramed(box, plan, ob.id);
  }
  if (ob.type === 'light') {
    box.append(field(t('ui.fp.fLightKind'), selIn(G.LIGHT_TYPES.map((l) => [l.id, t(G.labelKey('light', l.id))]), ob.kind, (v) => set(() => {
      const lt = G.lightTypeOf(v); ob.kind = v; ob.beam = lt.beam; ob.cct = lt.cct; ob.watts = lt.watts; ob.range = lt.range;
    }))));
    box.append(field(t('ui.fp.fWatts'), numIn(ob.watts, 10, (v) => set(() => { ob.watts = v; }), { min: 0, max: 100000 })));
    box.append(field(t('ui.fp.fCct'), numIn(ob.cct, 100, (v) => set(() => { ob.cct = v; }), { min: 1000, max: 20000 })));
    box.append(field(t('ui.fp.fIntensity'), numIn(ob.intensity, 5, (v) => set(() => { ob.intensity = v; }), { min: 0, max: 100 })));
    box.append(field(t('ui.fp.fBeam'), numIn(ob.beam, 5, (v) => set(() => { ob.beam = v; }), { min: 1, max: 360 })));
    box.append(field(t('ui.fp.fRange'), numIn(ob.range, 0.5, (v) => set(() => { ob.range = v; }), { min: 0.1, max: 500 })));
    box.append(field(t('ui.fp.fHeight'), numIn(ob.height, 0.1, (v) => set(() => { ob.height = v; }), { min: 0, max: 100 })));
    box.append(field(t('ui.fp.fDiffusion'), selIn(G.DIFFUSIONS.map((d) => [d, t(G.labelKey('diff', d))]), ob.diffusion, (v) => set(() => { ob.diffusion = v; }))));
    box.append(field(t('ui.fp.fGel'), selIn(G.GELS.map((d) => [d, t(G.labelKey('gel', d))]), ob.gel, (v) => set(() => { ob.gel = v; }))));
    if (ob.gel === 'color') box.append(field(t('ui.fp.fGelColor'), colorIn(ob.gelColor, (v) => set(() => { ob.gelColor = v; }))));
    const sw = el('span', 'fp-swatch'); sw.style.background = lightColor(ob);
    box.append(sw);
  }
  if (ob.type === 'shape') {
    box.append(el('div', 'dim', t(G.labelKey('shape', ob.kind))));
    if (ob.kind === 'text') box.append(field(t('ui.fp.fText'), textIn(ob.text, (v) => set(() => { ob.text = v; }))));
    if (!ob.pts) {
      box.append(field(t('ui.fp.fW'), numIn(ob.w, 0.1, (v) => set(() => { ob.w = Math.max(0.05, v); }), { min: 0.05 })));
      box.append(field(ob.kind === 'text' ? t('ui.fp.fTextH') : t('ui.fp.fH'), numIn(ob.h, 0.1, (v) => set(() => { ob.h = Math.max(0.02, v); }), { min: 0.02 })));
      if (ob.kind !== 'text' && ob.kind !== 'flag') box.append(field(t('ui.fp.fFill'), colorIn(ob.fill || '#8a8a8a', (v) => set(() => { ob.fill = v; }))));
    } else {
      box.append(field(t('ui.fp.fThick'), numIn(ob.thick, 0.01, (v) => set(() => { ob.thick = Math.max(0.01, v); }), { min: 0.01, max: 5 })));
      box.append(el('div', 'dim', tf('ui.fp.fLength', fmtNum(Math.round(F.polylineLength(ob.pts) * 100) / 100))));
    }
    box.append(field(t('ui.fp.fStroke'), colorIn(ob.stroke || '#dddddd', (v) => set(() => { ob.stroke = v; }))));
    box.append(field(t('ui.fp.fOpacity'), numIn(ob.opacity, 0.05, (v) => set(() => { ob.opacity = v; }), { min: 0.05, max: 1 })));
  }
  if (ob.type === 'track') {
    box.append(el('div', 'dim', tf('ui.fp.fLength', fmtNum(Math.round(F.polylineLength(ob.pts) * 100) / 100))));
    box.append(field(t('ui.fp.fColor'), colorIn(ob.color || '#999999', (v) => set(() => { ob.color = v; }))));
  }

  // ── ตำแหน่งในจังหวะนี้ ──
  box.append(sec(tf('ui.fp.poseIn', V.beat + 1)));
  box.append(field(t('ui.fp.fX'), numIn(pose.x, 0.1, (v) => set(() => F.setPose(plan, ob.id, V.beat, { x: v })))));
  box.append(field(t('ui.fp.fY'), numIn(pose.y, 0.1, (v) => set(() => F.setPose(plan, ob.id, V.beat, { y: v })))));
  box.append(field(t('ui.fp.fFacing'), numIn(pose.rot, 5, (v) => set(() => F.setPose(plan, ob.id, V.beat, { rot: v })))));
  box.append(checkIn(pose.hidden, t('ui.fp.fHiddenHere'), (v) => set(() => F.setPose(plan, ob.id, V.beat, { hidden: v }))));
  if (V.beat > 0 && F.hasKey(plan, ob.id, V.beat)) {
    const r = el('button', 'fp-mini');
    r.type = 'button';
    r.append(icon('reset', 14), document.createTextNode(' ' + t('ui.fp.fResetKey')));
    r.onclick = () => edit(() => F.clearPoseKey(plan, ob.id, V.beat));
    box.append(r);
  }
  const acts = el('div', 'fp-acts');
  const dup = el('button', 'fp-mini'); dup.type = 'button'; dup.append(icon('duplicate', 14), document.createTextNode(' ' + t('ui.fp.fDup'))); dup.onclick = duplicateSel;
  const del = el('button', 'fp-mini fp-danger'); del.type = 'button'; del.append(icon('trash', 14), document.createTextNode(' ' + t('ui.common.del'))); del.onclick = removeSel;
  acts.append(dup, del);
  box.append(acts);
}

// ═══════════════════════ แถบจังหวะ ═══════════════════════
function renderBeats() {
  if (!V.el) return;
  const bar = V.el.beats;
  const keep = bar.querySelector('.fp-beat-strip') ? bar.querySelector('.fp-beat-strip').scrollLeft : 0;
  bar.replaceChildren();
  const plan = S.currentPlan();
  if (!plan) return;
  const head = el('div', 'fp-beat-head');
  head.append(icon('timeline', 15), el('span', 'fp-beat-title', t('ui.fp.beats')));
  const play = tbBtn(V.play ? 'stop' : 'play', V.play ? t('ui.fp.stop') : t('ui.fp.play'), () => (V.play ? stopPlay() : startPlay()));
  play.classList.add('fp-play');
  const prev = tbBtn('skip-previous', t('ui.fp.beatPrev'), () => gotoBeat(V.beat - 1));
  const next = tbBtn('skip-next', t('ui.fp.beatNext'), () => gotoBeat(V.beat + 1));
  const add = tbBtn('plus', t('ui.fp.beatAdd'), () => {
    edit(() => { V.beat = F.insertBeat(plan, V.beat); });
  });
  add.classList.add('fp-beat-add');
  head.append(prev, play, next, add);
  const strip = el('div', 'fp-beat-strip');
  plan.beats.forEach((b, i) => {
    const card = el('div', 'fp-beat' + (i === V.beat ? ' on' : ''));
    card.tabIndex = 0;
    card.dataset.i = String(i);
    const top = el('div', 'fp-beat-top');
    const cam = F.objById(plan, F.activeCamId(plan, i));
    top.append(el('span', 'fp-beat-no', String(i + 1)));
    if (cam) top.append(el('span', 'fp-beat-cam', tf('ui.fp.camName', cam.label)));
    if (b.shot) top.append(el('span', 'fp-beat-shot', t(G.labelKey('shot', b.shot))));
    const nMoves = F.movesInto(plan, i).length;
    if (nMoves) { const mv = el('span', 'fp-beat-moves'); mv.append(icon('route', 12), document.createTextNode(String(nMoves))); mv.title = tf('ui.fp.movesN', nMoves); top.append(mv); }
    card.append(top);
    const ref = el('div', 'fp-beat-ref' + (b.ref.text ? '' : ' empty'));
    ref.append(icon(b.ref.kind === 'scene' ? 'file' : 'pencil', 12), el('span', null, ' ' + (b.ref.text || t('ui.fp.refNone'))));
    ref.title = b.ref.text || t('ui.fp.refNone');
    card.append(ref);
    const fr = cam ? F.framedIds(plan, i, cam.id) : [];
    if (fr.length) card.append(el('div', 'fp-beat-framed', fr.map((x) => objLabel(F.objById(plan, x.id))).join(', ')));
    card.onclick = (e) => {
      if (e.target.closest('.fp-beat-ref') && i === V.beat) return refMenu(e.target.closest('.fp-beat-ref'), plan, i);
      gotoBeat(i);
    };
    card.ondblclick = () => refMenu(ref, plan, i);
    card.oncontextmenu = (e) => { e.preventDefault(); gotoBeat(i); beatMenu(e.clientX, e.clientY, plan, i); };
    card.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); gotoBeat(i); }
      if (e.key === 'ArrowRight') { e.preventDefault(); const n = card.nextElementSibling; if (n) n.focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); const n = card.previousElementSibling; if (n) n.focus(); }
      if (e.key === 'Delete') {
        e.preventDefault();
        if (plan.beats.length <= 1) return;
        deleteBeatAt(plan, i);
        // คีย์บอร์ด: โฟกัสไปการ์ดที่มาแทนที่ (ไม่หลุดไปที่ body)
        const cards = V.el && V.el.beats.querySelectorAll('.fp-beat');
        if (cards && cards.length) cards[Math.min(i, cards.length - 1)].focus();
      }
    };
    strip.append(card);
  });
  bar.append(head, strip);
  strip.scrollLeft = keep;
  const on = strip.querySelector('.fp-beat.on');
  if (on) { const r = on.offsetLeft, w = on.offsetWidth; if (r < strip.scrollLeft || r + w > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - 20; }
}
/** ลบจังหวะ i — จังหวะที่เลือกอยู่ยังเป็นจังหวะเดิม (ลบก่อนหน้า = เลื่อนดัชนีตาม) */
function deleteBeatAt(plan, i) {
  edit(() => {
    if (!F.deleteBeat(plan, i)) return false;
    if (i < V.beat) V.beat--;
    if (V.beat >= plan.beats.length) V.beat = plan.beats.length - 1;
  });
}
function gotoBeat(i) {
  const plan = S.currentPlan();
  if (!plan) return;
  const n = Math.max(0, Math.min(plan.beats.length - 1, i));
  if (n === V.beat && !V.play) return;
  stopPlay();
  V.beat = n;
  paint(); renderBeats(); renderInsp();
}
async function beatMenu(x, y, plan, i) {
  const { popupMenu } = await import('./ui.js');
  popupMenu(x, y, [
    { label: esc(t('ui.fp.beatAdd')), click: () => edit(() => { V.beat = F.insertBeat(plan, i); }) },
    { label: esc(t('ui.fp.beatLeft')), disabled: i === 0, click: () => edit(() => { V.beat = F.moveBeat(plan, i, -1); }) },
    { label: esc(t('ui.fp.beatRight')), disabled: i >= plan.beats.length - 1, click: () => edit(() => { V.beat = F.moveBeat(plan, i, 1); }) },
    '-',
    { label: esc(t('ui.fp.refPick')), click: () => pickRefLine(plan, i) },
    { label: esc(t('ui.fp.refType')), click: () => typeRef(plan, i) },
    '-',
    { label: esc(t('ui.fp.beatDel')), danger: true, disabled: plan.beats.length <= 1,
      click: () => deleteBeatAt(plan, i) },
  ]);
}
async function refMenu(anchor, plan, i) {
  const { popupMenu } = await import('./ui.js');
  const r = anchor.getBoundingClientRect();
  const b = plan.beats[i];
  const items = [
    { label: esc(t('ui.fp.refPick')), click: () => pickRefLine(plan, i) },
    { label: esc(t('ui.fp.refType')), click: () => typeRef(plan, i) },
  ];
  if (b.ref.kind === 'scene' && b.ref.text) items.push({ label: esc(t('ui.fp.refGo')), click: () => jumpToScene(plan, b.ref) });
  if (b.ref.text) items.push('-', { label: esc(t('ui.fp.refClear')), click: () => edit(() => { b.ref = { kind: 'text', text: '' }; }) });
  popupMenu(r.left, r.bottom + 2, items);
}
async function typeRef(plan, i) {
  const { ask } = await import('./ui.js');
  const b = plan.beats[i];
  const v = await ask(t('ui.fp.refTypeQ'), { value: b.ref.kind === 'text' ? b.ref.text : '', placeholder: t('ui.fp.refTypePh'), allowEmpty: true });
  if (v == null) return;
  edit(() => { b.ref = { kind: 'text', text: v.trim() }; });
}

/** บรรทัดของฉาก (ข้อความล้วน) — แท็บที่เปิดค้างชนะไฟล์บนดิสก์ */
async function sceneLines(file) {
  const { parseMdFile, inlinePlainText } = await import('./md.js');
  const { liveBody } = await import('./tab-bridge.js');
  let body = '';
  try { body = parseMdFile(await kapi.readFile(file)).body || ''; } catch {}
  body = liveBody(file, body);
  const out = [];
  const seen = new Map();
  for (const raw of String(body).split(/\r?\n/)) {
    let s = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!s || /^---+$/.test(s) || /^!\[/.test(s)) continue;
    s = s.slice(prefixLen(s)).replace(/^>\s*/, '').replace(/^#{1,6}\s+/, '').replace(/^(?:[-*+]|\d+[.)])\s+/, '').trim();
    s = inlinePlainText ? inlinePlainText(s) : s;
    s = s.trim();
    if (!s) continue;
    const nth = seen.get(s) || 0;
    seen.set(s, nth + 1);
    out.push({ text: s, nth });
  }
  return out;
}
async function sceneFileOf(plan) {
  if (!plan.scene) return null;
  if (plan.scene.file) {
    const f = await kapi.join(state.root, plan.scene.file);
    if (await kapi.exists(f)) return f;
  }
  const sc = await findSceneById(plan.scene.id);
  if (!sc) return null;
  // ทางเก่าไม่ตรงแล้ว (ย้ายไฟล์/บท) — จดทางใหม่ไว้ครั้งหน้าไม่ต้องสแกน
  plan.scene.file = relToRoot(sc.filePath);
  plan.scene.title = sc.title || plan.scene.title;
  S.markPlanDirty();
  return sc.filePath;
}
async function pickRefLine(plan, i) {
  if (!plan.scene) { setStatus(t('ui.fp.refNeedScene')); return pickScene(plan).then(() => { const p = S.currentPlan(); if (p && p.scene) pickRefLine(p, i); }); }
  const file = await sceneFileOf(plan);
  if (!file) { setStatusError(t('ui.fp.sceneMissing')); return; }
  const lines = await sceneLines(file);
  if (!lines.length) { setStatus(t('ui.fp.sceneEmpty')); return; }
  const picked = await listPicker(tf('ui.fp.pickLineTitle', plan.scene.title || ''), t('ui.fp.pickLineSearch'),
    lines.map((l, n) => ({ value: l, text: l.text, sub: String(n + 1) })));
  if (!picked) return;
  const p = S.currentPlan();
  if (!p || p.id !== plan.id || !p.beats[i]) return;
  edit(() => { p.beats[i].ref = { kind: 'scene', text: picked.text, nth: picked.nth }; });
}
/** เปิดฉากของผัง (และกระโดดไปบรรทัดอ้างอิง ถ้ามี) */
async function jumpToScene(plan, ref) {
  const file = await sceneFileOf(plan);
  if (!file) { setStatusError(t('ui.fp.sceneMissing')); return false; }
  const app = await import('./app.js');
  await app.openScene(file, plan.scene.title);
  if (!ref || !ref.text) return true;
  for (let n = 0; n < 40; n++) {
    const tab = state.tabs.get(file);
    if (tab && (tab.editor || tab.sp)) {
      const term = ref.text.slice(0, 80);
      return app.gotoSearchMatch(tab, { term, nth: PS.refSearchNth(await sceneLines(file), ref, term) });
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

// ═══════════════════════ เล่นภาพเคลื่อนไหว ═══════════════════════
export function startPlay(from) {
  const plan = S.currentPlan();
  if (!plan || plan.beats.length < 2) return false;
  stopPlay();
  let start = from != null ? from : V.beat;
  if (start >= plan.beats.length - 1) start = 0;
  const abs = F.allPoses(plan);
  V.play = { planId: plan.id, from: start, t0: performance.now(), raf: 0, poses: abs[start], cam: F.activeCamId(plan, start), beat: start };
  V.beat = start;
  renderBeats();
  const step = (now) => {
    if (!V.play) return;
    // เวลาของ rAF = ต้นเฟรม ซึ่งอาจมาก่อน performance.now() ตอนกดเล่น → ติดลบ = ดัชนี -1 (pa ว่าง)
    const el2 = Math.max(0, (now - V.play.t0) / PLAY_MS);
    const seg = Math.floor(el2), tt = el2 - seg;
    const a = start + seg;
    if (a >= plan.beats.length - 1) { const last = plan.beats.length - 1; V.play = null; V.beat = last; paint(); renderBeats(); renderInsp(); return; }
    const pa = abs[a], pb = abs[a + 1];
    const m = new Map();
    const e = F.easeInOut(Math.min(1, tt / 0.8));          // เคลื่อน 80% ของช่วง · พัก 20% ให้เห็นภาพของจังหวะ
    for (const [id, p] of pa) m.set(id, F.lerpPose(p, pb.get(id) || p, e));
    V.play.poses = m;
    V.play.cam = F.activeCamId(plan, e < 0.5 ? a : a + 1);
    const shown = e < 0.5 ? a : a + 1;
    if (shown !== V.play.beat) { V.play.beat = shown; V.beat = shown; renderBeats(); }
    paint();
    V.play.raf = requestAnimationFrame(step);
  };
  V.play.raf = requestAnimationFrame(step);
  return true;
}
export function stopPlay() {
  if (!V.play) return;
  cancelAnimationFrame(V.play.raf);
  V.play = null;
  paint(); renderBeats(); renderInsp();
}

// ═══════════════════════ ส่งออก PNG ═══════════════════════
/** ภาพของผังในจังหวะปัจจุบัน (พื้นขาว · พอดีทุกชิ้น) → ไฟล์ PNG · outPath = เทส (ไม่เปิดกล่องบันทึก) */
export async function exportFloorPlanPng(outPath) {
  const plan = S.currentPlan();
  if (!plan) { setStatus(t('ui.fp.emptyTitle')); return null; }
  const W = 1800, H = 1200;
  const cam = F.fitView(F.planBounds(plan, V.beat), W - 120, H - 160, { min: 1, max: 400 });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('font-family', 'Tahoma, "Leelawadee UI", "Noto Sans Thai", sans-serif');
  let imgHref = '';
  if (plan.bg && plan.bg.image) imgHref = await dataUrlOf(plan.bg.image);
  drawPlan(svg, plan, { W, H, cam, beat: V.beat, sel: null, editing: false, exp: true, imgHref });
  // หัวภาพ: ชื่อผัง · จังหวะ · อ้างอิง
  const b = plan.beats[V.beat];
  const cap = sv('text', { x: 40, y: 52, 'font-size': 30, fill: PRINT.inkTitle, 'font-weight': 600 }, svg);
  cap.textContent = (plan.name || '') + ' · ' + tf('ui.fp.beat', V.beat + 1) + (plan.scene && plan.scene.title ? ' · ' + plan.scene.title : '');
  if (b.ref.text) { const r = sv('text', { x: 40, y: 88, 'font-size': 20, fill: PRINT.inkSoft }, svg); r.textContent = b.ref.text; }
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.getContext('2d').drawImage(img, 0, 0);
    const { saveCanvasPng } = await import('./export-image.js');
    const base = String(plan.name || 'floorplan').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) + '-' + (V.beat + 1);
    return await saveCanvasPng(cv, base + '.png', outPath);
  } catch (e) {
    log('warn', 'floorplan: export png', e);
    setStatusError(t('ui.fp.exportFail'));
    return null;
  } finally { URL.revokeObjectURL(url); }
}
async function dataUrlOf(rel) {
  try {
    const f = await kapi.join(state.root, rel);
    const bytes = await kapi.readBytes(f);
    const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
    let s = ''; for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
    const ext = (rel.split('.').pop() || 'png').toLowerCase();
    return 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + btoa(s);
  } catch { return ''; }
}

// ═══════════════════════ prompt ภาพนิ่ง/วิดีโอ (AI เขียนจากบท + ผัง) ═══════════════════════
// ผู้ใช้: "เพิ่ม prompt generate ได้มั้ย โดยอิงจากบท กับ floor plan" — ภาพนิ่ง + วิดีโอ · AI เขียน · ภาษาอังกฤษ
// ผังคำนวณ "ข้อเท็จจริงของช็อต" เอง (fp-shot.js · ขนาดภาพ/ตำแหน่งในเฟรม/ทิศหน้า/ทิศไฟ/การเคลื่อน)
// แล้ว AI แปลงเป็นภาษาของตัวสร้างภาพ — ไม่ปล่อยให้ AI เดาจากพิกัด
const PROMPT_KINDS = [['image', 'ui.fp.promptImage'], ['video', 'ui.fp.promptVideo']];
const nameByFile = (file) => { const v = entHit(file); return v ? v.name : ''; };
function beatFacts(plan, i) { return PS.shotFacts(plan, i, nameByFile); }

function appendPromptBox(box, plan) {
  const b = plan.beats[V.beat];
  box.append(sec(t('ui.fp.promptSec')));
  const acts = el('div', 'fp-acts fp-prompt-acts');
  if (V.gen) {
    const st = el('span', 'dim fp-prompt-busy', V.gen.msg || t('ui.fp.promptWorking'));
    const stop = el('button', 'fp-mini fp-prompt-stop'); stop.type = 'button';
    stop.append(icon('stop', 14), document.createTextNode(' ' + t('ui.fp.promptStop')));
    stop.onclick = stopPromptGen;
    acts.append(st, stop);
  } else {
    const gen = el('button', 'fp-mini fp-prompt-gen'); gen.type = 'button';
    gen.append(icon('magic', 14), document.createTextNode(' ' + t('ui.fp.promptGen')));
    gen.title = t('ui.fp.promptGenHint');
    gen.onclick = () => generatePrompts([V.beat]);
    const all = el('button', 'fp-mini fp-prompt-genall'); all.type = 'button';
    all.append(icon('magic', 14), document.createTextNode(' ' + t('ui.fp.promptGenAll')));
    all.onclick = () => generatePrompts(plan.beats.map((_, k) => k));
    acts.append(gen, all);
  }
  box.append(acts);
  const facts = beatFacts(plan, V.beat);
  if (!facts) box.append(el('div', 'dim fp-prompt-hint', t('ui.fp.promptNeedCam')));
  if (b.prompt && b.prompt.hash && facts && b.prompt.hash !== PS.factsHash(facts)) {
    box.append(el('div', 'fp-prompt-stale', t('ui.fp.promptStale')));
  }
  for (const [kind, key] of PROMPT_KINDS) {
    const head = el('div', 'fp-prompt-head');
    head.append(el('span', 'fp-f-l', t(key)));
    const cp = el('button', 'fp-tb fp-prompt-copy'); cp.type = 'button';
    cp.append(icon('clipboard', 14));
    cp.title = t('ui.fp.promptCopy'); cp.setAttribute('aria-label', t('ui.fp.promptCopy'));
    cp.dataset.kind = kind;
    const ta = el('textarea', 'fp-in fp-prompt fp-prompt-' + kind);
    ta.value = (b.prompt && b.prompt[kind]) || '';
    ta.placeholder = t('ui.fp.promptEmpty');
    ta.spellcheck = false;
    ta.onchange = () => edit(() => {
      const cur = b.prompt || { image: '', video: '', hash: '', at: '' };
      b.prompt = { ...cur, [kind]: ta.value };
      if (!b.prompt.image && !b.prompt.video) b.prompt = null;
    }, { insp: false });
    cp.onclick = async () => {
      if (!ta.value.trim()) return;
      try { await navigator.clipboard.writeText(ta.value); setStatus(t('ui.fp.promptCopied')); }
      catch { ta.select(); document.execCommand('copy'); setStatus(t('ui.fp.promptCopied')); }
    };
    head.append(cp);
    box.append(head, ta);
  }
}

/** ข้อความของไฟล์ภาษาสำหรับคำขอ (system + หัวข้อแต่ละส่วน) */
function promptLabels() {
  return { system: t('ui.fp.aiSystem'), facts: t('ui.fp.aiFacts'), excerpt: t('ui.fp.aiExcerpt'), characters: t('ui.fp.aiCharacters'),
           style: t('ui.fp.aiStyle'), previous: t('ui.fp.aiPrevious'), sceneInfo: t('ui.fp.aiSceneInfo') };
}

/** ประกอบคำขอของจังหวะ i (อ่านบท + หน้าตาตัวละครจาก Wiki) — ไม่ยิงเน็ต */
async function promptRequestFor(plan, i) {
  const facts = beatFacts(plan, i);
  if (!facts) return null;
  const b = plan.beats[i];
  let excerpt = '', sceneInfo = '';
  const file = plan.scene ? await sceneFileOf(plan).catch(() => null) : null;
  if (file) {
    excerpt = PS.excerptAround(await sceneLines(file), b.ref && b.ref.kind === 'scene' ? b.ref : null);
    try {
      const { parseMdFile } = await import('./md.js');
      const m = parseMdFile(await kapi.readFile(file)).meta || {};
      sceneInfo = [plan.scene.title, m.storyDate, m.synopsis, m.pov && ('POV: ' + m.pov), m.emotion].filter(Boolean).join(' · ');
    } catch { sceneInfo = plan.scene.title || ''; }
  }
  const characters = [];
  const seen = new Set();
  for (const s of facts.subjects.concat(facts.entersNextBeat.map((name) => ({ name, entityFile: '' })))) {
    const o = plan.objects.find((x) => x.type === 'entity' && ((s.entityFile && x.entityFile === s.entityFile) || nameByFile(x.entityFile) === s.name || x.label === s.name));
    if (!o || !o.entityFile || seen.has(o.entityFile)) continue;
    seen.add(o.entityFile);
    try { characters.push({ name: s.name, text: PS.entityBrief(await kapi.readJson(await entAbs(o.entityFile))) }); } catch {}
  }
  const prev = i > 0 && plan.beats[i - 1].prompt ? plan.beats[i - 1].prompt.image : '';
  const req = PS.buildShotPromptRequest({ facts, excerpt, sceneInfo, characters, style: plan.style || '', previous: prev }, promptLabels());
  return { req, facts };
}

function stopPromptGen() {
  if (!V.gen) return;
  V.gen.cancel = true;
  if (V.gen.reqId && kapi.httpAbort) { try { kapi.httpAbort(V.gen.reqId); } catch {} }
}

/**
 * ให้ AI เขียน prompt ของจังหวะที่ระบุ (ทีละจังหวะ · กดหยุดได้) → เก็บลง beat.prompt (บันทึกลงไฟล์ผัง)
 * @returns {Promise<{done:number, failed:number, stopped:boolean}>}
 */
export async function generatePrompts(indices) {
  const plan = S.currentPlan();
  if (!plan || V.gen) return { done: 0, failed: 0, stopped: false };
  const { aiConfigured } = await import('./ai-settings.js');
  const ready = await aiConfigured();
  if (!ready.ok) {
    setStatusAction(ready.why || t('ui.fp.promptNeedAi'), t('ui.fp.promptOpenAi'), async () => (await import('./app.js')).handleCommand('ai-settings'));
    return { done: 0, failed: 0, stopped: false };
  }
  // [alpha.168 · bug hunt] จำเป็น id ของจังหวะ ไม่ใช่ดัชนี — ลบ/สลับจังหวะระหว่างรอ AI แล้วผลต้องลงจังหวะเดิม
  const list = indices.filter((i) => plan.beats[i] && beatFacts(plan, i)).map((i) => plan.beats[i].id);
  if (!list.length) { setStatus(t('ui.fp.promptNeedCam')); return { done: 0, failed: 0, stopped: false }; }
  V.gen = { cancel: false, reqId: '', msg: '' };
  let done = 0, failed = 0, lastErr = '', stopped = false;
  const { getAIClient } = await import('./ai/ai-bridge.js');
  try {
    for (let n = 0; n < list.length && !V.gen.cancel; n++) {
      const beatId = list[n];
      const i = plan.beats.findIndex((b) => b.id === beatId);
      if (i < 0) continue;                                   // จังหวะถูกลบไประหว่างรอ
      V.gen.msg = tf('ui.fp.promptWorkingN', n + 1, list.length, i + 1);
      setStatus(V.gen.msg);
      // วาดแผงใหม่เฉพาะครั้งแรก (ปุ่มหยุด) · ครั้งต่อไปเปลี่ยนแค่ข้อความ — ไม่ล้างช่องที่ผู้ใช้กำลังพิมพ์
      const busyEl = V.el && V.el.insp.querySelector('.fp-prompt-busy');
      if (busyEl) busyEl.textContent = V.gen.msg; else if (n === 0) renderInsp();
      const built = await promptRequestFor(plan, i);
      if (!built) { failed++; continue; }
      V.gen.reqId = 'fp-prompt-' + Date.now().toString(36);
      const res = await getAIClient().stream({ system: built.req.system, prompt: built.req.prompt, feature: 'floorplan-prompt',
                                               reqId: V.gen.reqId, temperature: 0.7 }, () => {});
      if (S.currentPlan() !== plan) break;                  // เปลี่ยนผังระหว่างรอ — ไม่เขียนลงผังอื่น
      if (!res || !res.ok) {
        if (V.gen.cancel || (res && res.aborted && !res.timedOut)) break;
        failed++; lastErr = (res && res.error) || t('ui.fp.promptBadReply');
        log('warn', 'floorplan: prompt failed', { beat: i + 1, error: lastErr });
        continue;
      }
      const got = PS.parseShotPrompts(res.text);
      if (!got.ok) { failed++; lastErr = t('ui.fp.promptBadReply'); log('warn', 'floorplan: prompt reply not JSON', { beat: i + 1, text: String(res.text || '').slice(0, 300) }); continue; }
      const hash = PS.factsHash(built.facts);
      const at = plan.beats.findIndex((b) => b.id === beatId);
      if (at < 0) continue;
      edit(() => { plan.beats[at].prompt = { image: got.image, video: got.video, hash, at: new Date().toISOString() }; }, { insp: false });
      done++;
    }
  } finally {
    stopped = !!(V.gen && V.gen.cancel);
    V.gen = null;
    renderInsp();
    if (failed && !done) setStatusError(tf('ui.fp.promptFail', lastErr));
    else if (stopped) setStatus(tf('ui.fp.promptStopped', done));
    else setStatus(failed ? tf('ui.fp.promptDonePart', done, failed) : tf('ui.fp.promptDone', done));
    logAction('floorplan', 'prompts', { plan: plan.id, done, failed, stopped });
  }
  return { done, failed, stopped };
}

// ═══════════════════════ shot list (CSV · Markdown) ═══════════════════════
const COL_KEYS = {
  beat: 'ui.fp.colBeat', reference: 'ui.fp.colRef', camera: 'ui.fp.colCamera', body: 'ui.fp.colBody', lens: 'ui.fp.colLens',
  fov: 'ui.fp.colFov', height: 'ui.fp.colHeight', angle: 'ui.fp.colAngle', support: 'ui.fp.colSupport', shot: 'ui.fp.colShot',
  move: 'ui.fp.colMove', inFrame: 'ui.fp.colInFrame', lights: 'ui.fp.colLights', note: 'ui.fp.colNote',
  image: 'ui.fp.promptImage', video: 'ui.fp.promptVideo',
};
/** ส่งออก shot list ของผังที่เปิดอยู่ · fmt = 'csv' | 'md' · outPath = เทส (ไม่เปิดกล่องบันทึก) */
export async function exportShotList(fmt, outPath) {
  const plan = S.currentPlan();
  if (!plan) { setStatus(t('ui.fp.emptyTitle')); return null; }
  await entityNames();
  const facts = plan.beats.map((_, i) => beatFacts(plan, i));
  const rows = PS.shotListRows(plan, facts, (g, id) => t(G.labelKey(g, id)));
  const heads = PS.SHOT_LIST_COLS.map((k) => t(COL_KEYS[k]));
  const ext = fmt === 'md' ? 'md' : 'csv';
  const title = (plan.name || 'floorplan') + (plan.scene && plan.scene.title ? ' — ' + plan.scene.title : '');
  const text = ext === 'md' ? PS.shotListMarkdown(title, rows, heads) : PS.shotListCsv(rows, heads);
  const base = String(plan.name || 'floorplan').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) + '-shotlist.' + ext;
  const dest = outPath || await kapi.saveAsDialog(base, ext);
  if (!dest) return null;
  await kapi.writeFile(dest, text);
  setStatusAction(tf('ui.panelExport.done', String(dest).split(/[\\/]/).pop()), t('ui.exportImg.showInFolder'), () => kapi.revealInOS(dest));
  logAction('floorplan', 'shot list', { to: dest, beats: rows.length });
  return dest;
}

// ═══════════════════════ แถว "ผังพื้นที่" ในคุณสมบัติฉาก ═══════════════════════
/** รายการผังของฉากนี้ + ปุ่มสร้างผังใหม่ (อ่านจากดัชนี — ไม่เปิดไฟล์ผังเลย) */
export async function buildScenePlansRow(row) {
  const r = el('div', 'wiki-row props-fprow');
  r.append(el('label', null, t('ui.fp.sceneRow')));
  const box = el('div', 'props-fprow-body');
  const list = row && row.id ? F.plansForScene(await S.loadIndex(), row.id) : [];
  if (!list.length) box.append(el('span', 'dim', t('ui.fp.sceneRowNone')));
  for (const p of list) {
    const b = el('button', 'cmp-mini props-fpbtn');
    b.type = 'button';
    b.append(icon('floorplan', 14), document.createTextNode(' ' + (p.name || t('ui.common.notNamed'))));
    b.title = tf('ui.fp.sceneRowBeats', p.beats);
    b.onclick = () => openFloorPlan(p.id);
    box.append(b);
  }
  const nb = el('button', 'cmp-mini props-fpnew');
  nb.type = 'button';
  nb.append(icon('plus', 14), document.createTextNode(' ' + t('ui.fp.sceneRowNew')));
  nb.onclick = async () => {
    await openFloorPlan();
    const ctx = await currentSceneCtx().catch(() => null);
    if (ctx && row && ctx.row.id === row.id) await newPlanFlow(ctx);
    else if (row && row.id) {
      const sc = await findSceneById(row.id);
      await newPlanFlow(sc ? { row: sc, file: sc.filePath } : null);
    }
  };
  box.append(nb);
  r.append(box);
  return r;
}

// ═══════════════════════ ทะเบียนงานค้าง / เทส ═══════════════════════
export { fpDirtyList, flushPlan as flushFloorPlan } from './floorplan/fp-store.js';
/** ทางลัดของเทส e2e (ไม่มีทางอื่นเข้าถึงตัวแก้ภายในของแผง) */
export const __fpTest = {
  V, S, F, G, paint, edit, undo, redo, gotoBeat, placeAt, setTool, finishDraw, addEntities, removeSel,
  sceneLines, jumpToScene, startPlay, stopPlay, fitAll, generatePrompts, exportShotList, beatFacts, promptRequestFor,
  camOf: () => { const p = S.currentPlan(); return p ? camOf(p) : null; },
  worldToScreen: (x, y) => {
    const p = S.currentPlan(); const c = camOf(p); const r = V.el.svg.getBoundingClientRect();
    return { x: r.left + r.width / 2 + (x - c.cx) * c.z, y: r.top + r.height / 2 + (y - c.cy) * c.z };
  },
};
