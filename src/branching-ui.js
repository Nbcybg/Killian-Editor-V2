// branching-ui.js — เรื่องแบบแตกสาย (Non-linear, ข้อ 81 · ยกเครื่องใหม่ alpha.66)
// ผัง Branch Tree แบบเห็นภาพจริง: กล่องฉาก + เส้นโค้งเชื่อมทางเลือก + แผง inspector แก้ไขได้ในตัว
// ตรรกะผัง (จัดชั้น/ขัดด้วยแรง/วิเคราะห์วง/ไล่เส้นทาง/ส่งออก) อยู่ใน branch-graph.js — ที่นี่วาดอย่างเดียว
//
//   scenes.json → collectScenes() → buildGraph → layoutGraph → วาด SVG (เส้น) + div (กล่อง)
//
// สิ่งที่เปลี่ยนในรอบนี้ (ข้อ 1-17):
//   1  เป็น "แผง" เต็มตัวเหมือนฟีเจอร์อื่น ไม่ใช่แท็บเอกสารที่แย่งที่กับฉากที่กำลังเขียน
//   2  แถบเพิ่มทางเลือกขึ้นไปอยู่บน · ผังอยู่ล่าง (ทางเข้าอยู่ก่อนผลลัพธ์)
//   3  ป้ายข้อความทางเลือกมีแถบรองพื้น ไม่จมหายไปกับเส้น
//   4  เลือกสีการ์ดฉากและสีเส้นทางเลือกได้เอง
//   5  ตัวหนังสือในผังใหญ่เท่า UI หลัก (ผูกกับ --ui-scale ทุกจุด)
//   6  ลากย้ายการ์ดได้ · ป้ายทางเลือกอยู่กึ่งกลางเส้นจริง (คำนวณจากเส้นโค้ง ไม่ใช่กึ่งกลางหัว-ท้าย)
//   7  ส่งออกผังเป็น HTML tree / JSON / Markdown outline / SVG / PNG
//   8  ผังถูกขัดด้วยแรงหลัง BFS · เตือนเมื่อเส้นทางถูกตัด
//   9  โหมดทดลองเล่น (player-mode.js) — เดินตามทางเลือกได้จริง
//  13  ปุ่ม "ดูทั้งหมด" เปิดกล่องรายการเส้นทางพร้อมช่องกรอง
//  14  ตรวจทางเลือกที่ชี้ไปฉากที่ไม่มีอยู่จริงตอนเปิดโปรเจกต์
//  15  ไฮไลต์เส้นทางจากจุดเริ่ม → โหนดที่เลือก
//  16  ลากย้ายทางเลือกข้ามฉาก + ปุ่มรวมทางเลือกที่ซ้ำกัน
//  17  ช่องค้นหา — เน้นที่ตรง จางที่เหลือ
import { tf } from './i18n.js';
import { $, el, state, setStatus, log, t, SCENE_COLORS } from './core.js';
// [alpha.73 ข้อ 5] หลายแผนต่อหนึ่งโปรเจกต์ — ตรรกะแผนอยู่ใน branch-plans.js (บริสุทธิ์ · มี unit test)
import { BRANCH_PLAN_DIR, newBranchPlan, normalizeBranchPlan, planFromState, planDirty,
         planNameFromFile, safePlanName, sortPlans, uniquePlanName, planSummary,
         PLAN_STATUSES, PLAN_DEFAULT_STATUS, applyPlanChoices, planChoicesFor, setPlanChoices,
         snapshotChoices, comparePlans, compareSummary } from './branch-plans.js';
import {
  NODE_W, NODE_H, GAP_X, PAD,
  buildGraph, layoutGraph, analyzeGraph, graphSummary, enumeratePathsInfo,
  scanChoiceMarkers, diffChoiceMarkers,
  highlightPath, edgeKey, filterNodes, expandWithNeighbors,
  mergeDuplicateChoices, countDuplicateChoices,
  graphToOutline, graphToJson, graphToHtmlTree, danglingChoices,
} from './branch-graph.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

const ZOOM_MIN = 0.4, ZOOM_MAX = 1.8;
const PATH_LIMIT = 12;                 // แสดงในแผงขวาเท่านี้ · ที่เหลือดูได้ที่ปุ่ม "ดูทั้งหมด"
const PATH_MAX = 400;                  // เพดานตอนกดดูทั้งหมด (กันเรื่องใหญ่ระเบิด)

// ───────── i18n (ข้อ 11) — ทุกสตริงมีคีย์ ค่าเริ่มต้นเป็นไทยเหมือนเดิม ─────────
const tr = (key, fb) => t('branch.' + key, fb);
const summaryLabels = () => ({
  scenes: tr('sumScenes', t('ui.common.sceneGraph')), choices: tr('sumChoices', t('ui.common.choice')),
  roots: tr('sumRoots', t('ui.common.dotStart')), endings: tr('sumEndings', t('ui.common.actEnd')),
});
const exportLabels = () => ({
  ...summaryLabels(),
  title: tr('title', t('ui.common.graphBreakBranch')), open: tr('openEnd', t('ui.common.notSpecifyTo2')),
  gone: tr('goneScene', t('ui.common.sceneFind')), loop: tr('loopBack', t('ui.common.back')),
  root: tr('roleRoot', t('ui.common.dotStart')), ending: tr('roleEnd', t('ui.common.actEnd')),
  empty: tr('emptyGraph', t('ui.common.notHasSceneHas')),
});

// สถานะของหน้านี้ (จำระหว่าง re-render — ไม่ต้องเลือกโหนดใหม่ทุกครั้งที่แก้ทางเลือก)
// เติมค่าที่ขาดทุกครั้ง เพราะ e2e/โค้ดเก่าตั้ง state._branch เองแบบไม่ครบฟิลด์
const BS_DEFAULTS = { sel: null, zoom: 1, view: 'tree', sideOpen: true, query: '' };
function bstate() {
  if (!state._branch) state._branch = { ...BS_DEFAULTS };
  for (const [k, v] of Object.entries(BS_DEFAULTS)) if (state._branch[k] === undefined) state._branch[k] = v;
  return state._branch;
}

// ───────── ตำแหน่งการ์ดที่ผู้ใช้ลากเอง (ข้อ 6) ─────────
// เก็บใน localStorage แยกตามโปรเจกต์ — ไม่ยัดลง scenes.json เพราะเป็นเรื่อง "มุมมอง" ไม่ใช่เนื้อเรื่อง
// (แนวเดียวกับ network-layout.js ที่จำตำแหน่งโหนดผังความสัมพันธ์)
// ───────── [alpha.73 ข้อ 5] แผนของผังแตกสาย — หลายแผนต่อหนึ่งโปรเจกต์ ─────────
// เนื้อเรื่อง (ฉาก+ทางเลือก) อยู่ใน scenes.json ชุดเดียวเสมอ · "แผน" เก็บวิธีมองผังนั้น
// (ตำแหน่งการ์ด · สี · มุมมอง/ซูม · โน้ต) เป็นไฟล์ละแผนใน Branches/ แบบเดียวกับ Planners/
const planState = { path: null, saved: null, live: null, name: '' };
export function currentBranchPlan() { return planState; }

/** ตำแหน่งการ์ด: อยู่ในแผนถ้าเปิดแผนอยู่ · ไม่งั้นใช้ localStorage เหมือนเดิม (โปรเจกต์ที่ยังไม่ทำแผน) */
const POS_PREFIX = 'k2-branch-pos';
function posKey() {
  const s = String(state.root || '').replace(/[\\/]+$/, '').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${POS_PREFIX}:${(h >>> 0).toString(36)}`;
}
export function loadNodePositions() {
  if (planState.path && planState.live) return planState.live.positions || {};
  try { return JSON.parse(localStorage.getItem(posKey()) || '{}') || {}; } catch { return {}; }
}
function saveNodePositions(pos) {
  if (planState.path && planState.live) { planState.live.positions = pos; markPlanDirty(); return; }
  try { localStorage.setItem(posKey(), JSON.stringify(pos)); } catch { /* quota */ }
}
function clearNodePositions() {
  if (planState.path && planState.live) { planState.live.positions = {}; markPlanDirty(); return; }
  try { localStorage.removeItem(posKey()); } catch { /* ignore */ }
}
function markPlanDirty() {
  if (!planState.path || !planState.live) return;
  planState.live.updated = new Date().toISOString();
  // แถวใน Explorer ต้องขึ้นจุด ● ทันที (import แบบไดนามิก — app.js import ไฟล์นี้อยู่ เป็นวง)
  import('./app.js').then((m) => m.markBranchPlanRow && m.markBranchPlanRow()).catch(() => {});
}

// ---- ไฟล์แผน ----
export async function branchPlansDir() {
  const d = await kapi.join(state.root, BRANCH_PLAN_DIR);
  await kapi.mkdir(d);
  return d;
}
/** รายชื่อแผนทั้งหมดในโปรเจกต์ */
export async function listBranchPlans() {
  if (!state.root) return [];
  const dir = await kapi.join(state.root, BRANCH_PLAN_DIR);
  if (!(await kapi.exists(dir))) return [];
  const out = [];
  for (const f of await kapi.listFiles(dir, '.json').catch(() => [])) {
    const path = await kapi.join(dir, f);
    let plan = null;
    try { plan = normalizeBranchPlan(await kapi.readJson(path), planNameFromFile(f)); }
    catch (e) { log('warn', t('ui.branch.branchReadFilePlan') + f, e); continue; }
    out.push({ path, name: plan.name || planNameFromFile(f), plan });
  }
  return sortPlans(out);
}
/** เปิดแผน — คืน true เมื่อสำเร็จ */
export async function openBranchPlan(path) {
  try {
    const plan = normalizeBranchPlan(await kapi.readJson(path), planNameFromFile(path));
    planState.path = path; planState.name = plan.name;
    planState.saved = JSON.parse(JSON.stringify(plan));
    planState.live = plan;
    const bs = bstate();
    bs.view = plan.view; bs.zoom = plan.zoom; if (plan.sel) bs.sel = plan.sel;
    setStatus(t('ui.branch.openPlan') + plan.name + t('ui.common.done'));
    log('info', t('ui.branch.branchOpenPlan') + plan.name, path);
    return true;
  } catch (e) { log('error', t('ui.branch.branchOpenPlanNot'), e); setStatus(t('ui.branch.openPlanNotOk')); return false; }
}
/** บันทึกแผนที่เปิดอยู่ (ไม่มีแผนเปิดอยู่ = ไม่ทำอะไร คืน false) */
export async function saveBranchPlan(silent) {
  if (!planState.path || !planState.live) return false;
  const bs = bstate();
  const L = planState.live;
  const plan = planFromState({ name: planState.name, note: L.note,
    status: L.status, color: L.color, tags: L.tags, book: L.book, choices: L.choices,
    positions: L.positions, colors: L.colors,
    view: bs.view, zoom: bs.zoom, sel: bs.sel, now: new Date().toISOString() });
  await kapi.writeFile(planState.path, JSON.stringify(plan, null, 2));
  planState.live = plan;
  planState.saved = JSON.parse(JSON.stringify(plan));
  if (!silent) setStatus(t('ui.branch.savePlan2') + plan.name + t('ui.common.done'));
  try { const m = await import('./app.js'); m.markBranchPlanRow && m.markBranchPlanRow(); } catch {}
  return true;
}
/** บันทึกเป็นแผนใหม่ */
export async function saveBranchPlanAs(name) {
  const dir = await branchPlansDir();
  const existing = (await listBranchPlans()).map((x) => x.name);
  const finalName = uniquePlanName(name || planState.name || t('ui.common.newPlan'), existing);
  const path = await kapi.join(dir, safePlanName(finalName) + '.json');
  const bs = bstate();
  const src = planState.live || newBranchPlan(finalName);
  const plan = planFromState({ name: finalName, note: src.note,
    status: src.status, color: src.color, tags: src.tags, book: src.book, choices: src.choices,
    positions: src.positions || loadNodePositions(), colors: src.colors || {},
    view: bs.view, zoom: bs.zoom, sel: bs.sel, now: new Date().toISOString() });
  await kapi.writeFile(path, JSON.stringify(plan, null, 2));
  planState.path = path; planState.name = finalName;
  planState.live = plan; planState.saved = JSON.parse(JSON.stringify(plan));
  setStatus(t('ui.branch.savePlan') + finalName + t('ui.common.done'));
  return path;
}
/** ปิดแผน กลับไปโหมด "ไม่มีแผน" (ตำแหน่งการ์ดกลับไปใช้ localStorage) */
export function closeBranchPlan() {
  planState.path = null; planState.saved = null; planState.live = null; planState.name = '';
}
/** true = แผนที่เปิดอยู่มีงานค้าง */
export function isBranchPlanDirty() {
  return !!(planState.path && planDirty(planState.live, planState.saved));
}

/** true = กำลังทำงานบน "แผน" อยู่ (ทางเลือกทั้งหมดอ่าน/เขียนที่แผน ไม่ใช่ scenes.json) */
export function inBranchPlan() { return !!(planState.path && planState.live); }

/** เอาทางเลือกของแผนสวมทับรายการฉาก — ตัวเดียวที่ผังใช้ตัดสินว่าจะวาดอะไร */
export function scenesWithPlan(scenes) {
  return inBranchPlan() ? applyPlanChoices(scenes, planState.live) : scenes;
}

/** สร้างแผนใหม่โดยถ่ายทางเลือกปัจจุบันมาเป็นจุดตั้งต้น (แผนแรกจะได้ไม่ว่างเปล่า) */
export async function newPlanFromCurrent(name) {
  const scenes = await collectScenes();
  const base = newBranchPlan(name);
  base.choices = inBranchPlan() ? JSON.parse(JSON.stringify(planState.live.choices || {}))
                                : snapshotChoices(scenes);
  base.positions = { ...loadNodePositions() };
  closeBranchPlan();
  planState.live = base;
  return saveBranchPlanAs(name);
}

/** เทียบแผนที่เปิดอยู่กับอีกแผนหนึ่ง (เหตุผลข้อ 1 ของผู้ใช้: ทำงานหลายคน) */
export async function compareWithPlan(otherPath) {
  const scenes = await collectScenes();
  const titleOf = (id) => (scenes.find((x) => String(x.id) === String(id)) || {}).title || id;
  const other = normalizeBranchPlan(await kapi.readJson(otherPath), planNameFromFile(otherPath));
  const rows = comparePlans(planState.live, other, titleOf);
  return { rows, summary: compareSummary(rows), other };
}

/**
 * กล่องคุณสมบัติแผน — ชุดฟิลด์เดียวกับ "คุณสมบัติฉาก" ตามที่ผู้ใช้ขอ
 * (ชื่อ · สถานะ · สี · แท็ก · เล่ม · โน้ต) เพื่อให้ติดป้ายได้อิสระว่าแผนไหนร่าง/ใช้จริง/สำรอง
 */
export async function planPropsDialog() {
  if (!inBranchPlan()) { setStatus(t('ui.branch.cantOpenPlan')); return false; }
  const L = planState.live;
  const { el: E } = await import('./core.js');
  return new Promise((resolve) => {
    const ov = E('div', 'k-overlay');
    const box = E('div', 'k-dialog');
    box.append(E('div', 'k-dlg-title', t('ui.branch.propsPlan') + (planState.name || '')));
    const mk = (label, val, tag) => {
      const r = E('div', 'wiki-row');
      r.append(E('label', null, label));
      const i = E(tag || 'input', 'wiki-input');
      i.value = val || '';
      r.append(i); box.append(r); return i;
    };
    const iName = mk(t('ui.common.namePlan'), planState.name);
    const rSt = E('div', 'wiki-row'); rSt.append(E('label', null, t('ui.common.status')));
    const iStatus = E('select', 'wiki-input k-dlg-select');
    for (const st of PLAN_STATUSES) {
      const o = E('option', null, st); o.value = st;
      if (st === (L.status || PLAN_DEFAULT_STATUS)) o.selected = true;
      iStatus.append(o);
    }
    rSt.append(iStatus); box.append(rSt);
    const rC = E('div', 'wiki-row'); rC.append(E('label', null, t('ui.common.color')));
    const iColor = E('select', 'wiki-input k-dlg-select');
    { const none = E('option', null, t('ui.common.notHas')); none.value = ''; iColor.append(none);
      for (const [n2, hex] of SCENE_COLORS) { const o = E('option', null, '● ' + n2); o.value = hex;
        if (hex === L.color) o.selected = true; iColor.append(o); } }
    rC.append(iColor); box.append(rC);
    const iTags = mk(t('ui.common.tag2'), (L.tags || []).join(', '));
    const iBook = mk(t('ui.branch.bookSkipEmpty'), L.book);
    iBook.placeholder = t('ui.branch.egBookOneUse');
    const iNote = mk(t('ui.common.note'), L.note, 'textarea');

    const info = E('div', 'dim', planSummary(L));
    box.append(info);

    const btns = E('div', 'k-dlg-btns');
    const cB = E('button', null, t('ui.common.cancel'));
    const okB = E('button', 'k-ok', t('ui.common.save'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    cB.onclick = () => { ov.remove(); resolve(false); };
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(false); } };
    okB.onclick = async () => {
      setPlanProps({ name: iName.value, status: iStatus.value, color: iColor.value,
                     tags: iTags.value.split(',').map((x) => x.trim()).filter(Boolean),
                     book: iBook.value.trim(), note: iNote.value });
      await saveBranchPlan(true);
      ov.remove();
      setStatus(t('ui.branch.savePropsPlanDone'));
      try { const m = await import('./app.js'); await m.refreshTreeQueued(); } catch {}
      resolve(true);
    };
    iName.focus();
  });
}

/** กล่องเทียบแผน — เลือกอีกแผนแล้วดูว่าทางเลือกต่างกันตรงไหน */
export async function comparePlanDialog() {
  if (!inBranchPlan()) { setStatus(t('ui.branch.openPlanBeforeDone')); return false; }
  const list = (await listBranchPlans()).filter((x) => x.path !== planState.path);
  if (!list.length) { setStatus(t('ui.branch.plannedNewPlanBefore')); return false; }
  const { el: E } = await import('./core.js');
  const ov = E('div', 'k-overlay');
  const box = E('div', 'k-dialog k-dialog-wide');
  box.append(E('div', 'k-dlg-title', t('ui.branch.comparePlan') + planState.name));
  const row = E('div', 'wiki-row');
  row.append(E('label', null, t('ui.branch.compare')));
  const sel = E('select', 'wiki-input k-dlg-select');
  for (const x of list) { const o = E('option', null, x.name); o.value = x.path; sel.append(o); }
  row.append(sel); box.append(row);
  const body = E('div', 'branch-cmp'); box.append(body);
  const draw = async () => {
    body.replaceChildren();
    const { rows, summary, other } = await compareWithPlan(sel.value);
    body.append(E('div', 'branch-cmp-sum',
      tf('ui.branch.hasOnly2', summary.same, summary.diff, planState.name, summary.onlyA) +
      tf('ui.branch.hasOnly', other.name, summary.onlyB)));
    if (!rows.length) { body.append(E('div', 'dim', t('ui.branch.twoPlanNotHas'))); return; }
    for (const r of rows) {
      const line = E('div', 'branch-cmp-row' + (r.same ? ' same' : ''));
      line.append(E('div', 'branch-cmp-title', (r.same ? '=' : '≠') + ' ' + r.title));
      line.append(E('div', 'branch-cmp-side', (r.a.join(' · ') || '—')));
      line.append(E('div', 'branch-cmp-side', (r.b.join(' · ') || '—')));
      body.append(line);
    }
  };
  sel.onchange = draw;
  const btns = E('div', 'k-dlg-btns');
  const cB = E('button', 'k-ok', t('ui.common.close'));
  btns.append(cB); box.append(btns); ov.append(box); document.body.append(ov);
  cB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  await draw();
  return true;
}

/** คุณสมบัติของแผน (ชุดเดียวกับฉาก) — แก้แล้วถือว่ามีงานค้าง */
export function setPlanProps(props) {
  if (!planState.live) return false;
  const L = planState.live;
  if (props.name !== undefined) { planState.name = String(props.name).trim() || planState.name; L.name = planState.name; }
  if (props.status !== undefined) L.status = PLAN_STATUSES.includes(props.status) ? props.status : PLAN_DEFAULT_STATUS;
  if (props.color !== undefined) L.color = props.color || '';
  if (props.tags !== undefined) L.tags = props.tags;
  if (props.book !== undefined) L.book = props.book || '';
  if (props.note !== undefined) L.note = props.note || '';
  markPlanDirty();
  return true;
}

// ───────── ทางเข้า: เป็นแผง ไม่ใช่แท็บเอกสาร (ข้อ 1) ─────────
/** วาดเนื้อแผง — เรียกจาก FEATURE_PANELS ใน app.js ทุกครั้งที่แผงถูกเปิด */
export async function renderBranchingPanel() {
  const host = $('#branch-body');
  if (!host) return false;
  await renderBranchingTree(host);
  return true;
}

export async function openBranchingTree() {
  const { showPanel } = await import('./panels/panel-ui.js');
  const { renderFeaturePanel } = await import('./app.js');
  showPanel('branch');
  await renderFeaturePanel('branch');
  return true;
}

/** วาดใหม่ถ้าแผงผังเปิดอยู่ (ใช้หลังแก้ scenes.json จากที่อื่น) */
export function refreshOpenBranchTab() {
  const host = $('#branch-body');
  if (host && host.firstChild) renderBranchingTree(host);
}
export { refreshOpenBranchTab as refreshOpenBranchPanel };

// รวบรวมฉากทั้งโปรเจกต์ (ใช้ทั้งแสดงผลและเป็นตัวเลือก "ไปฉากไหนต่อ")
const SKIP_DIRS = ['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Backups', 'Plugins', 'Research'];
export async function collectScenes() {
  const out = [];
  if (!state.root) return out;
  for (const sec of await kapi.listDirs(state.root).catch(() => [])) {
    if (SKIP_DIRS.includes(sec)) continue;
    const sp = await kapi.join(state.root, sec);
    if (!(await kapi.exists(await kapi.join(sp, 'section.json')))) continue;
    const dr = await kapi.join(sp, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    for (const dn of await kapi.listDirs(dr).catch(() => [])) {
      const dp = await kapi.join(dr, dn);
      const dj = await kapi.join(dp, 'draft.json');
      if (!(await kapi.exists(dj))) continue;
      const draft = await kapi.readJson(dj);
      const scData = await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}));
      const chMap = scData.chapters || {};                    // ร่างที่ยังไม่มี scenes.json
      for (const ch of (draft.chapters || [])) {
        for (const sc of (chMap[ch.guid] || [])) {
          if (sc.type === 'memo') continue;
          out.push({ ...sc, dPath: dp, chapterName: ch.title,
                     filePath: await kapi.join(dp, 'Chapters', ch.folderName, sc.fileName) });
        }
      }
    }
  }
  return out;
}

/** เติมเนื้อฉากลงในรายการ (ใช้ตอนส่งออก/โหมดทดลองเล่น — ตอนวาดผังไม่ต้องอ่านทุกไฟล์) */
export async function loadSceneBodies(scenes) {
  const { parseMdFile } = await import('./md.js');
  for (const sc of scenes) {
    if (typeof sc.body === 'string' || !sc.filePath) continue;
    try { sc.body = parseMdFile(await kapi.readFile(sc.filePath)).body || ''; }
    catch { sc.body = ''; }
  }
  return scenes;
}

/**
 * เปิดฉาก · split = แยกจอ "ผังซ้าย ฉากขวา" จริง ๆ
 *
 * ของเดิม (ตอนผังยังเป็นแท็บเอกสาร) ใช้ Split View ของพื้นที่เขียนได้ตรง ๆ
 * ตอนนี้ผังเป็น "แผง" แล้ว จึงแยกจอด้วยระบบแผงแทน: **ผนึกผังไว้ข้างแผงเอกสาร**
 * ต้องใส่ `forceMove` ด้วย ไม่งั้น showPanel เจอว่าแผงเปิดอยู่แล้วก็ถอดแค่ธง —
 * ถ้ามันบังเอิญไปซ้อนเป็นแท็บร่วมกับแผงอื่นอยู่ จะ "เปิดคู่" แล้วไม่เห็นอะไรเปลี่ยนเลย
 */
async function openSceneFromGraph(node, split) {
  if (!node.filePath) { setStatus(tr('noFile', t('ui.common.sceneNotHasFile'))); return; }
  const { openScene } = await import('./app.js');
  await openScene(node.filePath, node.title);
  if (!split) return;
  const { showPanel } = await import('./panels/panel-ui.js');
  showPanel('branch', { targetId: 'docs', side: 'left', forceMove: true });
  setStatus(tr('splitDone', t('ui.branch.splitScreenDoneGraph')));
}

// ───────── ตัวช่วยเรขาคณิตของเส้นเชื่อม (ข้อ 6: ป้ายอยู่กึ่งกลางเส้นจริง) ─────────
/**
 * เส้นโค้ง Bézier ลูกบาศก์ระหว่างสองกล่อง + จุดกึ่งกลางของ "เส้น" (t=0.5)
 * ของเดิมวางป้ายที่กึ่งกลางระหว่างหัว-ท้าย ซึ่งไม่ใช่จุดบนเส้นเมื่อเส้นโค้ง
 * (ยิ่งเส้นย้อนกลับที่อ้อมลงล่าง ป้ายยิ่งลอยห่างจากเส้นจนไม่รู้ว่าเป็นของเส้นไหน)
 */
function edgeGeom(a, b) {
  const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
  const x2 = b.x, y2 = b.y + NODE_H / 2;
  const back = x2 <= x1;                       // ไปฉากที่อยู่ซ้ายกว่า = วงวนซ้ำ → อ้อมด้านล่าง
  const cx = back ? Math.max(40, GAP_X) : Math.max(28, (x2 - x1) / 2);
  const c1x = x1 + cx, c1y = back ? y1 + NODE_H : y1;
  const c2x = x2 - cx, c2y = back ? y2 + NODE_H : y2;
  const d = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
  // จุดบนเส้นโค้งที่ t=0.5 → (P0 + 3·C1 + 3·C2 + P3) / 8
  const mx = (x1 + 3 * c1x + 3 * c2x + x2) / 8;
  const my = (y1 + 3 * c1y + 3 * c2y + y2) / 8;
  return { d, back, mid: { x: mx, y: my } };
}

const shortText = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''));

// ───────── วาดทั้งแผง ─────────
// รอบวาดล่าสุด — งานวาดที่ถูกแซงต้องทิ้งผลทิ้ง ไม่ใช่เขียนทับของใหม่ (แนวเดียวกับ `_propsGen`)
let _renderGen = 0;

/**
 * @param {HTMLElement} pane  กล่องเนื้อแผง (#branch-body)
 * @param {object} opts
 *   opts.scenes = ใช้ข้อมูลฉากชุดเดิม ไม่ต้องอ่านไฟล์ใหม่
 *     → ใช้กับการวาดใหม่ที่ "ไม่ได้แก้ข้อมูล" (เลือกโหนด · ย่อ/ขยาย · สลับมุมมอง · ซ่อนแผงข้าง)
 *       ซึ่งเป็นเหตุผลหลักที่ UI กระพริบ: เดิมคลิกโหนดทีเดียวก็ไล่อ่าน scenes.json ทั้งโปรเจกต์ใหม่
 */
export async function renderBranchingTree(pane, opts = {}) {
  const bs = bstate();
  const gen = ++_renderGen;
  pane.classList.add('branch-host');

  // จำตำแหน่งเลื่อนของผังไว้ก่อน — ไม่งั้นแก้ทางเลือกทีเดียว ผังเด้งกลับมุมซ้ายบนทุกครั้ง
  const oldVp = pane.querySelector('.branch-viewport');
  const keepScroll = oldVp ? { left: oldVp.scrollLeft, top: oldVp.scrollTop } : null;

  let scenes = opts.scenes;
  if (!scenes) {
    try { scenes = await collectScenes(); }
    catch (e) { log('error', t('ui.branch.branchingReadSceneNot'), e); scenes = []; }
  }
  // [alpha.74] เปิดแผนอยู่ → ผังวาดจาก "ทางเลือกของแผน" ไม่ใช่ของ scenes.json
  scenes = scenesWithPlan(scenes);
  // มีคนสั่งวาดใหม่แซงระหว่างอ่านไฟล์ (หรือแผงถูกปิดไปแล้ว) → ทิ้งงานนี้ อย่าเขียนทับ
  if (gen !== _renderGen || !pane.isConnected) return;

  const graph = buildGraph(scenes);
  const positions = loadNodePositions();
  const layout = layoutGraph(graph, { positions });
  const analysis = analyzeGraph(graph);
  // แก้ข้อมูล → อ่านใหม่ · แค่เปลี่ยนมุมมอง → ใช้ของเดิม (ไม่กระพริบ ไม่แตะดิสก์)
  const redraw = (o) => renderBranchingTree(pane, o);
  const redrawUi = () => renderBranchingTree(pane, { scenes });

  const shell = el('div', 'branch-shell');
  const main = el('div', 'branch-main');
  const wrap = el('div', 'branch-wrap');

  // ───────── หัวเรื่อง + แถบเครื่องมือ ─────────
  const head = el('div', 'branch-head');
  const titleRow = el('div', 'branch-title-row');
  titleRow.append(el('div', 'branch-title', '🌿 ' + tr('titleFull', t('ui.branch.graphBreakBranchNon'))));

  const tools = el('div', 'branch-tools');

  // ── [alpha.73 ข้อ 5] แถบแผน: เลือก/บันทึก/บันทึกเป็น/ใหม่ ──
  const planWrap = el('div', 'branch-plans');
  const planSel = el('select', 'branch-plan-sel');
  planSel.title = t('ui.branch.planGraphOneProject');
  const fillPlans = async () => {
    const list = await listBranchPlans().catch(() => []);
    planSel.replaceChildren();
    const o0 = el('option', null, t('ui.branch.notUsePlanRemember')); o0.value = ''; planSel.append(o0);
    for (const p2 of list) {
      const o = el('option', null, '🌿 ' + p2.name + (planSummary(p2.plan) ? ' · ' + planSummary(p2.plan) : ''));
      o.value = p2.path; planSel.append(o);
    }
    planSel.value = planState.path || '';
  };
  planSel.onchange = async () => {
    if (!planSel.value) { closeBranchPlan(); setStatus(t('ui.branch.usePlanBackRemember')); }
    else await openBranchPlan(planSel.value);
    redrawUi();
  };
  planWrap.append(planSel);
  const bSave = el('button', 'branch-zbtn', '💾');
  bSave.title = t('ui.branch.saveMapOpen');
  bSave.onclick = async () => {
    if (!planState.path) { setStatus(t('ui.branch.cantOpenPlanPress')); return; }
    await saveBranchPlan(); await fillPlans();
  };
  const bSaveAs = el('button', 'branch-zbtn', '💾+');
  bSaveAs.title = t('ui.branch.saveNewPlanCoverLayout');
  bSaveAs.onclick = async () => {
    const { ask } = await import('./ui.js');
    const v = await ask(t('ui.common.nameNewPlan'), { value: (planState.name || t('ui.branch.plan')) + t('ui.common.msg2') });
    if (!v) return;
    await saveBranchPlanAs(v); await fillPlans(); planSel.value = planState.path || '';
    const { refreshTreeQueued } = await import('./app.js');
    await refreshTreeQueued();
  };
  const bNew = el('button', 'branch-zbtn', '＋');
  bNew.title = t('ui.branch.newNewPlanStartLayout');
  bNew.onclick = async () => {
    const { ask } = await import('./ui.js');
    const v = await ask(t('ui.common.nameNewPlan'), { value: t('ui.common.map2') + ((await listBranchPlans()).length + 1) });
    if (!v) return;
    // แผนใหม่ถ่ายทางเลือกปัจจุบันมาเป็นจุดตั้งต้น — จะได้เริ่มแก้ต่อได้เลย ไม่ใช่ผังว่างเปล่า
    await newPlanFromCurrent(v);
    await fillPlans(); planSel.value = planState.path || '';
    const { refreshTreeQueued } = await import('./app.js');
    await refreshTreeQueued();
    redrawUi();
  };
  const bProps = el('button', 'branch-zbtn', '⚙');
  bProps.title = t('ui.branch.propsPlanStatusDraft');
  bProps.onclick = async () => { if (await planPropsDialog()) redrawUi(); };
  const bCmp = el('button', 'branch-zbtn', '⇋');
  bCmp.title = t('ui.branch.comparePlanViewChoice');
  bCmp.onclick = () => comparePlanDialog();
  planWrap.append(bSave, bSaveAs, bNew, bProps, bCmp);
  if (planState.path && isBranchPlanDirty()) planWrap.append(el('span', 'branch-plan-dirty', '●'));
  tools.append(planWrap);
  fillPlans();

  const viewTog = el('div', 'branch-viewtog');
  const bTree = el('button', 'branch-viewbtn' + (bs.view === 'tree' ? ' on' : ''), '🌳 ' + tr('viewTree', t('ui.branch.graph')));
  const bList = el('button', 'branch-viewbtn' + (bs.view === 'list' ? ' on' : ''), '☰ ' + tr('viewList', t('ui.common.list2')));
  bTree.onclick = () => { bs.view = 'tree'; redrawUi(); };
  bList.onclick = () => { bs.view = 'list'; redrawUi(); };
  viewTog.append(bTree, bList);
  tools.append(viewTog);

  // ---- ช่องค้นหา (ข้อ 17) ----
  const findWrap = el('div', 'branch-find');
  const findInp = el('input', 'branch-find-inp');
  findInp.type = 'search';
  findInp.value = bs.query || '';
  findInp.placeholder = '🔍 ' + tr('findPlaceholder', t('ui.branch.searchNameSceneChoice'));
  findInp.title = tr('findHint', t('ui.branch.printOnlySceneAt'));
  let findJob = null;
  findInp.oninput = () => {
    clearTimeout(findJob);
    findJob = setTimeout(() => {
      bs.query = findInp.value;
      applyFilter();
    }, 160);
  };
  findInp.onkeydown = (e) => {
    if (e.key === 'Escape') { findInp.value = ''; bs.query = ''; applyFilter(); }
  };
  findWrap.append(findInp);
  const findCount = el('span', 'branch-find-count');
  findWrap.append(findCount);
  tools.append(findWrap);

  if (bs.view === 'tree') {
    const zOut = el('button', 'branch-zbtn', '−'); zOut.title = tr('zoomOut', t('ui.branch.collapseGraph'));
    const zLbl = el('span', 'branch-zlabel', Math.round(bs.zoom * 100) + '%');
    const zIn = el('button', 'branch-zbtn', '+'); zIn.title = tr('zoomIn', t('ui.branch.expandGraph'));
    const zFit = el('button', 'branch-zbtn', '⤢'); zFit.title = tr('zoomFit', t('ui.branch.fitScreen'));
    zOut.onclick = () => { bs.zoom = Math.max(ZOOM_MIN, +(bs.zoom - 0.15).toFixed(2)); redrawUi(); };
    zIn.onclick = () => { bs.zoom = Math.min(ZOOM_MAX, +(bs.zoom + 0.15).toFixed(2)); redrawUi(); };
    zFit.onclick = () => {
      const avail = (main.clientWidth || pane.clientWidth || 900) - 40;
      const f = layout.width > 0 ? avail / layout.width : 1;
      bs.zoom = Math.max(ZOOM_MIN, Math.min(1, +f.toFixed(2)));
      redrawUi();
    };
    tools.append(zOut, zLbl, zIn, zFit);

    // จัดผังใหม่ = ลืมตำแหน่งที่ลากเอง (ข้อ 6)
    const relayout = el('button', 'branch-zbtn', '⟲');
    relayout.title = tr('relayout', t('ui.branch.arrangeGraphNewAuto'));
    relayout.onclick = () => {
      clearNodePositions();
      setStatus(tr('relayoutDone', t('ui.branch.arrangeGraphNewDone')));
      redrawUi();
    };
    tools.append(relayout);
  }

  // ---- โหมดทดลองเล่น (ข้อ 9) ----
  const playB = el('button', 'branch-zbtn branch-play', '▶️');
  playB.title = tr('playHint', t('ui.branch.trialPlayReadStory'));
  playB.onclick = async () => {
    const { openPlayerMode } = await import('./player-mode.js');
    await openPlayerMode(bs.sel || null);
  };
  tools.append(playB);

  // ---- ส่งออก (ข้อ 7+10) ----
  const expB = el('button', 'branch-zbtn branch-export', '📤');
  expB.title = tr('exportHint', t('ui.branch.exportGraphHTMLMarkdown'));
  expB.onclick = (ev) => openExportMenu(ev, graph, analysis, pane);
  tools.append(expB);

  // ---- รวมทางเลือกซ้ำ (ข้อ 16) ----
  const dupN = countDuplicateChoices(graph);
  if (dupN) {
    const mergeB = el('button', 'branch-zbtn branch-dup', '🧹' + dupN);
    mergeB.title = tr('mergeDupHint', t('ui.branch.mergeChoiceDup')) + ` (${dupN})`;
    mergeB.onclick = () => mergeAllDuplicates(graph, redraw);
    tools.append(mergeB);
  }

  // สแกนทั้งโปรเจกต์: อ่านทุกฉากหา [ข้อความ] ที่ยังไม่ได้ผูกเป็นทางเลือก (ข้อ 15 เดิม)
  const scanB = el('button', 'branch-zbtn', '🔎');
  scanB.title = tr('scanHint', t('ui.branch.scanAllSceneFind'));
  scanB.onclick = () => scanAllScenes(scenes, redraw);
  tools.append(scanB);

  const refreshB = el('button', 'branch-zbtn', '🔄');
  refreshB.title = tr('reload', t('ui.branch.readScenesJsonNew'));
  refreshB.onclick = () => redraw();
  tools.append(refreshB);

  const sideTog = el('button', 'branch-zbtn', bs.sideOpen ? '▶' : '◀');
  sideTog.title = bs.sideOpen ? tr('hideSide', t('ui.branch.hidePanelChoice')) : tr('showSide', t('ui.branch.showPanelChoice'));
  sideTog.onclick = () => { bs.sideOpen = !bs.sideOpen; redrawUi(); };
  tools.append(sideTog);

  titleRow.append(tools);
  head.append(titleRow);
  head.append(el('div', 'branch-stats', graphSummary(analysis, summaryLabels())));
  wrap.append(head);

  // ───────── คำเตือนสุขภาพผัง ─────────
  const warn = el('div', 'branch-warn');
  const addWarn = (cls, text, title) => {
    const d = el('span', 'branch-badge ' + cls, text);
    if (title) d.title = title;
    warn.append(d);
    return d;
  };
  const brokeN = analysis.dangling.filter((e) => e.to).length;      // ชี้ไปฉากที่ไม่มีแล้ว
  const openN = analysis.dangling.length - brokeN;                  // ยังไม่ได้ระบุปลายทาง
  if (openN) addWarn('bw-open', `⚠ ${openN} ${tr('warnOpen', t('ui.branch.choiceNotSpecifyTo2'))}`);
  if (brokeN) {
    const b = addWarn('bw-lost', `💔 ${brokeN} ${tr('warnBroken', t('ui.branch.choicePointSceneNot'))}`);
    b.classList.add('branch-badge-btn');
    b.onclick = () => showBrokenDialog(graph, analysis, bs, redraw, redrawUi);
  }
  if (analysis.unreachable.length) addWarn('bw-lost', `🚫 ${analysis.unreachable.length} ${tr('warnLost', t('ui.branch.sceneNotTo'))}`);
  if (analysis.cycles.length) addWarn('bw-loop', `🔁 ${analysis.cycles.length} ${tr('warnLoop', t('ui.branch.sceneDup'))}`);
  if (analysis.endings.length) addWarn('bw-end', `🏁 ${analysis.endings.length} ${tr('sumEndings', t('ui.common.actEnd'))}`);
  if (warn.childNodes.length) wrap.append(warn);

  // ───────── (ข้อ 2) แถบ "เพิ่มทางเลือก" ขึ้นมาอยู่บนสุด — ทางเข้าต้องมาก่อนผลลัพธ์ ─────────
  if (scenes.length) wrap.append(buildAdder(graph, bs, redraw));

  if (!analysis.total) {
    wrap.append(el('div', 'branch-empty dim',
      tr('emptyHint', t('ui.branch.notHasSceneHas'))));
  }

  // ───────── มุมมองผัง (SVG เส้น + กล่อง HTML) ─────────
  const cycleSet = new Set(analysis.cycles);
  const unreachSet = new Set(analysis.unreachable);
  const rootSet = new Set(analysis.roots);
  const endSet = new Set(analysis.endings);
  const hi = highlightPath(graph, bs.sel);                          // ข้อ 15

  // ที่เก็บอ้างอิงของทุกชิ้นบนผัง — ใช้ตอนลากการ์ด (อัปเดตเส้นสด ๆ) และตอนกรอง
  const nodeEls = new Map();                     // id → กล่อง
  const edgeParts = [];                          // {e, path, label, rect, glow}
  const labelPad = { x: 7, y: 3 };

  if (bs.view === 'tree' && analysis.total) {
    const viewport = el('div', 'branch-viewport');
    // [ข้อ 4] ลากผังด้วยปุ่มกลางเมาส์ — preventDefault บน mousedown สำคัญ
    // ไม่งั้น Chromium เข้าโหมด autoscroll (ไอคอนวงกลม) แล้วผังไถลเองไม่หยุด
    viewport.addEventListener('mousedown', (ev) => {
      if (ev.button !== 1) return;
      ev.preventDefault();
      const st = { x: ev.clientX, y: ev.clientY, l: viewport.scrollLeft, t: viewport.scrollTop };
      viewport.classList.add('branch-panning');
      const onMove = (e2) => {
        viewport.scrollLeft = st.l - (e2.clientX - st.x);
        viewport.scrollTop = st.t - (e2.clientY - st.y);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        viewport.classList.remove('branch-panning');
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    viewport.addEventListener('auxclick', (ev) => { if (ev.button === 1) ev.preventDefault(); });
    const canvas = el('div', 'branch-canvas');
    const sizeCanvas = () => {
      canvas.style.width = layout.width + 'px';
      canvas.style.height = layout.height + 'px';
      viewport.style.setProperty('--bw', Math.round(layout.width * bs.zoom) + 'px');
      viewport.style.setProperty('--bh', Math.round(layout.height * bs.zoom) + 'px');
    };
    canvas.style.transform = `scale(${bs.zoom})`;
    canvas.style.transformOrigin = 'top left';
    sizeCanvas();

    // --- เส้นเชื่อม ---
    const svg = svgEl('svg', { class: 'branch-edges', width: layout.width, height: layout.height });
    const defs = svgEl('defs');
    const markers = new Map();
    const markerFor = (color) => {
      const id = 'bg-arrow-' + color.replace(/[^a-z0-9]/gi, '');
      if (!markers.has(id)) {
        const mk = svgEl('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5',
          markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
        mk.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }));
        defs.append(mk);
        markers.set(id, true);
      }
      return id;
    };
    markerFor('#98958b'); markerFor('#d97757');
    svg.append(defs);

    for (const e of graph.edges) {
      if (e.dangling) continue;
      const a = layout.byId.get(e.from), b = layout.byId.get(e.to);
      if (!a || !b) continue;
      const g = edgeGeom(a, b);
      const onPath = hi.edges.has(edgeKey(e.from, e.to));
      const hot = bs.sel === e.from || bs.sel === e.to;
      const color = e.color || (onPath || hot ? '#d97757' : '#98958b');
      const path = svgEl('path', {
        d: g.d,
        class: 'branch-edge' + (g.back ? ' branch-edge-back' : '')
             + (hot ? ' branch-edge-hot' : '') + (onPath ? ' branch-edge-path' : ''),
        'marker-end': `url(#${markerFor(color)})`,
      });
      if (e.color) path.style.stroke = e.color;
      const tt = svgEl('title'); tt.textContent = e.text || tr('sumChoices', t('ui.common.choice'));
      path.append(tt);
      svg.append(path);

      // ป้ายข้อความทางเลือก — กึ่งกลางเส้นจริง (ข้อ 6) + มีแถบรองพื้น (ข้อ 3)
      let label = null, rect = null;
      if (e.text) {
        const gsub = svgEl('g', { class: 'branch-edge-lg' + (hot || onPath ? ' on' : '') });
        rect = svgEl('rect', { class: 'branch-edge-labelbg', rx: '5', ry: '5' });
        if (e.color) { rect.style.stroke = e.color; }
        label = svgEl('text', { class: 'branch-edge-label', 'text-anchor': 'middle',
                                'dominant-baseline': 'middle' });
        label.textContent = shortText(e.text, 18);
        if (e.color) label.style.fill = e.color;
        const lt = svgEl('title');
        lt.textContent = `[${e.text}] — ` + tr('labelClick', t('ui.branch.clickOpenSceneFrom'));
        gsub.append(rect, label);
        gsub.append(lt);
        gsub.addEventListener('click', () => {
          const src = graph.byId.get(e.from);
          if (src) openSceneFromGraph(src, false);
        });
        svg.append(gsub);
      }
      edgeParts.push({ e, path, label, rect, geom: g });
    }
    canvas.append(svg);

    // ป้ายต้องรู้ขนาดตัวอักษรจริงก่อนจึงวางแถบรองพื้นได้ → วางประมาณไว้ก่อน แล้ววัดจริงหลังต่อ DOM
    const placeLabels = (measure) => {
      for (const p of edgeParts) {
        if (!p.label) continue;
        const { x, y } = p.geom.mid;
        p.label.setAttribute('x', x);
        p.label.setAttribute('y', y);
        let w = p.label.textContent.length * 8.2, h = 17;
        if (measure) {
          try { const bb = p.label.getBBox(); if (bb.width) { w = bb.width; h = bb.height; } } catch { /* ยังไม่ได้ layout */ }
        }
        p.rect.setAttribute('x', x - w / 2 - labelPad.x);
        p.rect.setAttribute('y', y - h / 2 - labelPad.y);
        p.rect.setAttribute('width', w + labelPad.x * 2);
        p.rect.setAttribute('height', h + labelPad.y * 2);
      }
    };
    placeLabels(false);

    // เส้นทุกเส้นที่แตะโหนดหนึ่ง — ใช้ตอนลากการ์ดให้เส้นวิ่งตามทันที (ข้อ 6)
    const redrawEdgesOf = (id) => {
      for (const p of edgeParts) {
        if (p.e.from !== id && p.e.to !== id) continue;
        const a = layout.byId.get(p.e.from), b = layout.byId.get(p.e.to);
        if (!a || !b) continue;
        p.geom = edgeGeom(a, b);
        p.path.setAttribute('d', p.geom.d);
      }
      placeLabels(true);
    };

    // --- กล่องฉาก ---
    for (const n of layout.placed) {
      const box = el('div', 'branch-node');
      box.dataset.id = n.id;
      if (bs.sel === n.id) box.classList.add('on');
      if (rootSet.has(n.id)) box.classList.add('bn-root');
      if (endSet.has(n.id)) box.classList.add('bn-end');
      if (cycleSet.has(n.id)) box.classList.add('bn-loop');
      if (unreachSet.has(n.id)) box.classList.add('bn-lost');
      if (hi.nodes.has(n.id) && bs.sel !== n.id) box.classList.add('bn-onpath');
      if (n.pinned) box.classList.add('bn-pinned');
      box.style.cssText = `left:${n.x}px;top:${n.y}px;width:${NODE_W}px;height:${NODE_H}px`;
      if (n.color) { box.style.borderLeftColor = n.color; box.style.setProperty('--bn-tint', n.color); box.classList.add('bn-tinted'); }

      const icon = rootSet.has(n.id) ? '▶ ' : endSet.has(n.id) ? '🏁 ' : '📄 ';
      box.append(el('div', 'branch-node-name', icon + n.title));
      const meta = el('div', 'branch-node-meta');
      meta.append(el('span', 'branch-node-ch', n.chapterName || '—'));
      if (n.choices.length) meta.append(el('span', 'branch-node-count', '⤷ ' + n.choices.length));
      box.append(meta);

      box.title = [
        n.title,
        n.chapterName ? tr('chapterOf', t('ui.common.chapter2')) + n.chapterName : '',
        tr('choiceCount', t('ui.branch.choice2')) + n.choices.length,
        rootSet.has(n.id) ? '▶ ' + tr('roleRoot', t('ui.common.dotStart')) : '',
        endSet.has(n.id) ? '🏁 ' + tr('roleEndFull', t('ui.branch.actEndNotHas')) : '',
        cycleSet.has(n.id) ? '🔁 ' + tr('roleLoop', t('ui.branch.dup2')) : '',
        unreachSet.has(n.id) ? '🚫 ' + tr('roleLost', t('ui.branch.dotStartNotTo')) : '',
        tr('nodeHelp', t('ui.branch.clickPickDragMove')),
      ].filter(Boolean).join('\n');

      box.ondblclick = () => openSceneFromGraph(n, false);
      makeNodeDraggable(box, n, layout, bs, { redrawEdgesOf, canvas, viewport, sizeCanvas, redraw: redrawUi });

      // ---- ปลายทางของการลากทางเลือกข้ามฉาก (ข้อ 16) ----
      box.addEventListener('dragover', (ev) => {
        if (!dragChoice) return;
        ev.preventDefault();
        box.classList.add('bn-drop');
      });
      box.addEventListener('dragleave', () => box.classList.remove('bn-drop'));
      box.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        box.classList.remove('bn-drop');
        await dropChoiceOn(n, graph, redraw);
      });

      nodeEls.set(n.id, box);
      canvas.append(box);
    }
    viewport.append(canvas);
    wrap.append(viewport);
    // วัดขนาดป้ายจริงหลังต่อเข้า DOM (getBBox ใช้ได้เมื่ออยู่ในเอกสารแล้วเท่านั้น)
    requestAnimationFrame(() => { if (svg.isConnected) placeLabels(true); });
  }

  // ───────── มุมมองรายการ (โครงเดิม — อ่านง่ายตอนฉากเยอะ) ─────────
  const cardEls = new Map();
  if (bs.view === 'list' && analysis.total) {
    const tree = el('div', 'branch-tree');
    for (const n of graph.nodes.filter((x) => x.choices.length)) {
      const card = el('div', 'branch-card');
      card.dataset.id = n.id;
      if (bs.sel === n.id) card.classList.add('on');
      if (n.color) { card.style.borderLeft = '4px solid ' + n.color; }
      const title = el('div', 'branch-node-title', '📄 ' + n.title);
      title.onclick = () => openSceneFromGraph(n, false);
      card.append(title);
      if (n.chapterName) card.append(el('div', 'branch-ch', n.chapterName));
      const choices = el('div', 'branch-choices');
      n.choices.forEach((c, idx) => {
        const target = c.nextSceneId ? graph.byId.get(c.nextSceneId) : null;
        const row = el('div', 'branch-choice' + (target ? '' : ' branch-choice-open'),
                       '➤ ' + (c.text || tr('sumChoices', t('ui.common.choice'))));
        if (c.color) row.style.color = c.color;
        row.title = tr('goTo', t('ui.branch.msg2')) + (target ? target.title : tr('openEndParen', t('ui.common.notSpecifyTo')));
        if (target) row.onclick = async () => {
          const { recordChoice } = await import('./player-choices.js');
          await recordChoice(n.id, n.title, c.text);
          openSceneFromGraph(target, false);
        };
        const del = el('span', 'branch-choice-del', '✕');
        del.title = tr('delChoice', t('ui.branch.delChoice2'));
        del.onclick = async (e) => { e.stopPropagation(); await removeChoice(n, idx); redraw(); };
        row.append(del);
        choices.append(row);
      });
      card.append(choices);
      card.onclick = (e) => { if (e.target === card) { bs.sel = n.id; redrawUi(); } };
      // การ์ดในมุมมองรายการก็รับทางเลือกที่ลากมาได้ (ข้อ 16)
      card.addEventListener('dragover', (ev) => { if (dragChoice) { ev.preventDefault(); card.classList.add('bn-drop'); } });
      card.addEventListener('dragleave', () => card.classList.remove('bn-drop'));
      card.addEventListener('drop', async (ev) => {
        ev.preventDefault(); card.classList.remove('bn-drop');
        await dropChoiceOn(n, graph, redraw);
      });
      cardEls.set(n.id, card);
      tree.append(card);
    }
    wrap.append(tree);
  }

  main.append(wrap);
  shell.append(main);

  // ───────── แผงขวา: inspector ของฉากที่เลือก ─────────
  if (bs.sideOpen) shell.append(buildInspector(graph, layout, analysis, bs, redraw, redrawUi));

  // สลับเนื้อทีเดียวจบ — เดิม `pane.innerHTML=''` ตั้งแต่ต้นแล้วค่อยไปอ่านไฟล์ทั้งโปรเจกต์
  // → แผงว่างเปล่าอยู่หลายร้อยมิลลิวินาทีทุกครั้งที่วาดใหม่ = ที่มาของอาการกระพริบ
  pane.replaceChildren(shell);

  // คืนตำแหน่งเลื่อนของผังให้เท่าเดิม (ผู้ใช้เลื่อนไปดูมุมไหนไว้ ก็ควรอยู่มุมนั้นต่อ)
  if (keepScroll) {
    const vp = pane.querySelector('.branch-viewport');
    if (vp) { vp.scrollLeft = keepScroll.left; vp.scrollTop = keepScroll.top; }
  }

  // ───────── (ข้อ 17) กรอง: เน้นที่ตรง จางที่เหลือ — ทำหลังต่อ DOM แล้วเท่านั้น ─────────
  function applyFilter() {
    const hit = filterNodes(graph, bs.query);
    const show = expandWithNeighbors(graph, hit);
    const all = [...nodeEls.values(), ...cardEls.values()];
    if (!hit) {
      for (const b of all) b.classList.remove('bn-faded', 'bn-hit');
      for (const p of edgeParts) {
        p.path.classList.remove('branch-edge-faded');
        if (p.label) p.label.parentNode.classList.remove('branch-edge-faded');
      }
      findCount.textContent = '';
      findWrap.classList.remove('on');
      return;
    }
    for (const [id, b] of [...nodeEls, ...cardEls]) {
      b.classList.toggle('bn-hit', hit.has(id));
      b.classList.toggle('bn-faded', !show.has(id));
    }
    for (const p of edgeParts) {
      const keep = show.has(p.e.from) && show.has(p.e.to);
      p.path.classList.toggle('branch-edge-faded', !keep);
      if (p.label) p.label.parentNode.classList.toggle('branch-edge-faded', !keep);
    }
    findCount.textContent = hit.size ? `${hit.size} ${tr('sumScenes', t('ui.common.sceneGraph'))}` : tr('noMatch', t('ui.common.notFound'));
    findWrap.classList.add('on');
  }
  if (bs.query) applyFilter();

  // เลื่อนให้เห็นโหนดที่เลือก (หลังต่อเข้า DOM แล้วเท่านั้น ไม่งั้นวัดตำแหน่งไม่ได้)
  // **เฉพาะตอนเพิ่งเปลี่ยนตัวที่เลือก** — ถ้าทำทุกครั้งที่วาดใหม่ ผู้ใช้ที่เลื่อนไปดูมุมอื่น
  // จะโดนดึงกลับมาที่โหนดเดิมทุกครั้งที่แก้ทางเลือก (อาการเดียวกับที่บ่นว่า "ผังเด้ง")
  if (bs.view === 'tree' && bs.sel && bs.sel !== _lastScrolledSel) {
    const on = pane.querySelector('.branch-node.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  _lastScrolledSel = bs.sel;
}
let _lastScrolledSel = null;

// ───────── (ข้อ 6) ลากย้ายการ์ด ─────────
// คลิกเฉย ๆ = เลือกโหนด · ลากเกิน 4px = ย้ายตำแหน่ง (แล้วไม่ต้องนับเป็นคลิก)
function makeNodeDraggable(box, n, layout, bs, ctx) {
  let start = null;
  box.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    start = { mx: ev.clientX, my: ev.clientY, x: n.x, y: n.y, moved: false };
    const zoom = bs.zoom || 1;
    const onMove = (e2) => {
      if (!start) return;
      const dx = (e2.clientX - start.mx) / zoom;
      const dy = (e2.clientY - start.my) / zoom;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;      // สั่นมือ ≠ ตั้งใจลาก
      start.moved = true;
      box.classList.add('bn-dragging');
      n.x = Math.max(0, Math.round(start.x + dx));
      n.y = Math.max(0, Math.round(start.y + dy));
      box.style.left = n.x + 'px';
      box.style.top = n.y + 'px';
      // ผังต้องโตตามถ้าลากออกไปเลยขอบ ไม่งั้นเลื่อนตามไปดูไม่ได้
      layout.width = Math.max(layout.width, n.x + NODE_W + PAD);
      layout.height = Math.max(layout.height, n.y + NODE_H + PAD);
      ctx.sizeCanvas();
      ctx.redrawEdgesOf(n.id);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      box.classList.remove('bn-dragging');
      if (start && start.moved) {
        const pos = loadNodePositions();
        pos[n.id] = { x: n.x, y: n.y };
        saveNodePositions(pos);
        box.classList.add('bn-pinned');
        box._noClick = true;              // เบราว์เซอร์ยิง click ต่อท้ายการลาก — อย่าให้นับเป็นการเลือก
        setStatus(tr('moved', t('ui.branch.moveCardDonePress')));
      }
      start = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  // เลือกโหนดด้วย click จริง ๆ (ไม่ใช่ mouseup) เพื่อให้เรียกจากโค้ด/เทส/คีย์บอร์ดได้เหมือนปุ่มทั่วไป
  box.onclick = () => {
    if (box._noClick) { box._noClick = false; return; }
    bs.sel = n.id;
    ctx.redraw();
  };
}

// ───────── (ข้อ 16) ลากทางเลือกจากฉากหนึ่งไปอีกฉาก ─────────
let dragChoice = null;                 // {node, idx, choice}

async function dropChoiceOn(target, graph, redraw) {
  const d = dragChoice;
  dragChoice = null;
  if (!d || !target || d.node.id === target.id) return false;
  // ย้ายแบบสองขั้น: ถอดจากต้นทางก่อน แล้วค่อยต่อท้ายปลายทาง (mutateChoices ต่อคิวให้อยู่แล้ว)
  await mutateChoices(d.node, (list) => { list.splice(d.idx, 1); return list; });
  await mutateChoices(target, (list) => [...list, { ...d.choice }]);
  setStatus(`${tr('movedChoice', t('ui.branch.moveChoice'))} "${d.choice.text}" → ${target.title}`);
  redraw();
  return true;
}

// ───────── (ข้อ 16) รวมทางเลือกที่ซ้ำกันทั้งผัง ─────────
async function mergeAllDuplicates(graph, redraw) {
  const { confirmBox } = await import('./ui.js');
  const targets = [];
  for (const n of graph.nodes) {
    const m = mergeDuplicateChoices(n.choices);
    if (m.removed) targets.push({ node: n, list: m.list, removed: m.removed });
  }
  if (!targets.length) { setStatus(tr('noDup', t('ui.branch.notHasChoiceDup'))); return 0; }
  const total = targets.reduce((a, x) => a + x.removed, 0);
  const preview = targets.slice(0, 8).map((x) => `• ${x.node.title} (−${x.removed})`).join('\n');
  const ok = await confirmBox(
    `${tr('mergeAsk', t('ui.branch.mergeChoiceDup'))} ${total} ${tr('items', t('ui.common.list2'))} ` +
    `${tr('fromScenes', t('ui.branch.msg'))} ${targets.length} ${tr('sumScenes', t('ui.common.sceneGraph'))}\n\n${preview}` +
    (targets.length > 8 ? `\n… +${targets.length - 8}` : '') +
    `\n\n${tr('mergeNote', t('ui.branch.textPersonSceneNot'))}`,
    tr('mergeOk', t('ui.branch.merge')));
  if (!ok) return 0;
  for (const x of targets) await mutateChoices(x.node, () => x.list);
  setStatus(`${tr('mergedDone', t('ui.branch.mergeChoiceDupDone'))} ${total}`);
  redraw();
  return total;
}

// ───────── (ข้อ 14) ทางเลือกที่ชี้ไปฉากที่ไม่มีแล้ว ─────────
function showBrokenDialog(graph, analysis, bs, redraw, redrawUi = redraw) {
  const rows = analysis.dangling.filter((e) => e.to);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog branch-dlg');
  box.append(el('div', 'k-dlg-title', '💔 ' + tr('brokenTitle', t('ui.branch.choicePointSceneNot2')) + ` (${rows.length})`));
  box.append(el('div', 'dim', tr('brokenHint',
    t('ui.branch.sceneToDelMove'))));
  const list = el('div', 'k-pick-list');
  list.style.maxHeight = '46vh';
  for (const e of rows) {
    const src = graph.byId.get(e.from);
    const row = el('div', 'k-menu-item branch-broken-row');
    row.append(el('span', 'branch-broken-sc', (src && src.title) || e.from));
    row.append(el('span', 'branch-broken-ch', '[' + (e.text || '—') + ']'));
    row.append(el('span', 'dim', '→ ' + e.to));
    const fix = el('button', 'branch-doc-add', tr('fixIt', t('ui.branch.edit')));
    fix.onclick = () => { bs.sel = e.from; bs.sideOpen = true; ov.remove(); redrawUi(); };
    const del = el('button', 'branch-edit-del', '✕');
    del.title = tr('delChoice', t('ui.branch.delChoice2'));
    del.onclick = async () => {
      if (src) { await removeChoice(src, e.idx); ov.remove(); redraw(); }
    };
    row.append(fix, del);
    list.append(row);
  }
  box.append(list);
  const btns = el('div', 'k-dlg-btns');
  const close = el('button', 'k-ok', tr('close', t('ui.common.close')));
  close.onclick = () => ov.remove();
  btns.append(close); box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

/**
 * [ข้อ 14] ตรวจตอนเปิดโปรเจกต์ — ทางเลือกชี้ไปฉากที่ไม่มีอยู่จริง
 * เรียกจาก loadProject() แบบไม่บล็อก · เตือนที่แถบสถานะ ไม่เด้งกล่องมาขวางการเปิดงาน
 */
export async function checkDanglingOnOpen() {
  try {
    if (!state.root) return 0;
    const scenes = await collectScenes();
    const bad = danglingChoices(scenes);
    if (!bad.length) return 0;
    const names = [...new Set(bad.map((b) => b.sceneTitle))].slice(0, 3).join(', ');
    setStatus(`💔 ${bad.length} ${tr('warnBroken', t('ui.branch.choicePointSceneNot'))} (${names}` +
              `${bad.length > 3 ? '…' : ''}) — ${tr('openBranchToFix', t('ui.branch.openGraphBreakBranch'))}`);
    log('warn', t('ui.branch.branchingFoundChoicePoint') + bad.length + t('ui.common.list'),
        bad.slice(0, 10));
    return bad.length;
  } catch (e) { log('warn', t('ui.branch.branchingCheckChoiceAct'), e); return 0; }
}

// ───────── (ข้อ 7+10) ส่งออก ─────────
function openExportMenu(ev, graph, analysis, pane) {
  const at = ev.currentTarget.getBoundingClientRect();
  import('./ui.js').then(({ popupMenu }) => {
    popupMenu(at.left, at.bottom + 4, [
      { label: '🌐 ' + tr('expHtml', t('ui.branch.hTMLTreeClickHas')), click: () => exportBranchHtml(graph, analysis) },
      { label: '📝 ' + tr('expMd', t('ui.branch.markdownOutlineListPara')), click: () => exportBranchMarkdown(graph, analysis) },
      { label: '🧩 ' + tr('expJson', t('ui.branch.jSONStructureInTool')), click: () => exportBranchJson(graph, analysis) },
      '-',
      { label: '🖼 ' + tr('expSvg', t('ui.branch.sVGImageGraphStyle')), click: () => exportBranchSvg(pane) },
      { label: '📷 ' + tr('expPng', t('ui.branch.pNGImageGraphSend')), click: () => exportBranchPng(pane) },
    ]);
  });
}

const projTitle = () => state.title || 'branching';
const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) || 'branching';

async function exportBranchHtml(graph, analysis) {
  await loadSceneBodies(graph.nodes);                       // เนื้อย่อต้องมีของจริง
  const html = graphToHtmlTree(graph, { analysis, title: projTitle(), labels: exportLabels() });
  const dest = await kapi.saveAsDialog(safeName(projTitle()) + '-branching.html', 'html');
  if (!dest) return false;
  await kapi.writeFile(dest, html);
  setStatus(tr('expDone', t('ui.branch.exportGraphDone')) + dest);
  return true;
}
async function exportBranchMarkdown(graph, analysis) {
  const md = graphToOutline(graph, { analysis, title: projTitle(), labels: exportLabels() });
  const dest = await kapi.saveAsDialog(safeName(projTitle()) + '-branching.md', 'md');
  if (!dest) return false;
  await kapi.writeFile(dest, md);
  setStatus(tr('expDone', t('ui.branch.exportGraphDone')) + dest);
  return true;
}
async function exportBranchJson(graph, analysis) {
  await loadSceneBodies(graph.nodes);
  const j = graphToJson(graph, { analysis, title: projTitle(), now: new Date().toISOString() });
  const dest = await kapi.saveAsDialog(safeName(projTitle()) + '-branching.json', 'json');
  if (!dest) return false;
  await kapi.writeFile(dest, JSON.stringify(j, null, 2));
  setStatus(tr('expDone', t('ui.branch.exportGraphDone')) + dest);
  return true;
}

// SVG บนจอพึ่ง CSS ของโปรแกรม → ไฟล์ที่ส่งออกต้องพกสไตล์ไปเอง ไม่งั้นเปิดที่อื่นได้เส้นดำล้วน
const SVG_STYLE = `
.branch-edge{fill:none;stroke:#98958b;stroke-width:1.8;opacity:.75}
.branch-edge-back{stroke-dasharray:5 4}
.branch-edge-hot,.branch-edge-path{stroke:#d97757;stroke-width:2.6;opacity:1}
.branch-edge-labelbg{fill:#fbfaf7;stroke:#d8d3c6;stroke-width:1}
.branch-edge-label{fill:#57534a;font:12px -apple-system,"Segoe UI",Tahoma,"Sarabun",sans-serif}
.bx{fill:#fff;stroke:#d8d3c6;stroke-width:1}
.bx-accent{stroke-width:4}
.bt{fill:#2c2a26;font:600 13px -apple-system,"Segoe UI",Tahoma,"Sarabun",sans-serif}
.bm{fill:#8a857a;font:11px -apple-system,"Segoe UI",Tahoma,"Sarabun",sans-serif}
`;

/** ผังปัจจุบันเป็น SVG ก้อนเดียวจบ (กล่องฉากบนจอเป็น <div> จึงต้องวาดใหม่เป็น <rect>+<text>) */
function buildStandaloneSvg(pane) {
  const src = pane.querySelector('svg.branch-edges');
  const canvas = pane.querySelector('.branch-canvas');
  if (!src || !canvas) return null;
  const w = parseFloat(canvas.style.width) || 900;
  const h = parseFloat(canvas.style.height) || 600;
  const out = svgEl('svg', { xmlns: SVG_NS, width: w, height: h, viewBox: `0 0 ${w} ${h}` });
  const st = svgEl('style'); st.textContent = SVG_STYLE;
  out.append(st);
  out.append(svgEl('rect', { x: 0, y: 0, width: w, height: h, fill: '#fbfaf7' }));
  for (const child of src.childNodes) out.append(child.cloneNode(true));
  for (const box of canvas.querySelectorAll('.branch-node')) {
    const x = parseFloat(box.style.left) || 0, y = parseFloat(box.style.top) || 0;
    const accent = box.style.borderLeftColor || '#9a958a';
    out.append(svgEl('rect', { x, y, width: NODE_W, height: NODE_H, rx: 8, ry: 8, class: 'bx' }));
    out.append(svgEl('path', { d: `M ${x + 2} ${y + 6} L ${x + 2} ${y + NODE_H - 6}`,
                               class: 'bx-accent', stroke: accent, fill: 'none' }));
    const name = svgEl('text', { x: x + 12, y: y + 24, class: 'bt' });
    name.textContent = shortText((box.querySelector('.branch-node-name') || {}).textContent || '', 24);
    const meta = svgEl('text', { x: x + 12, y: y + 44, class: 'bm' });
    meta.textContent = shortText((box.querySelector('.branch-node-meta') || {}).textContent || '', 28);
    out.append(name, meta);
  }
  return { svg: out, w, h };
}

async function exportBranchSvg(pane) {
  const built = buildStandaloneSvg(pane);
  if (!built) { setStatus(tr('needTreeView', t('ui.branch.openViewGraphBefore'))); return false; }
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(built.svg);
  const dest = await kapi.saveAsDialog(safeName(projTitle()) + '-branching.svg', 'svg');
  if (!dest) return false;
  await kapi.writeFile(dest, text);
  setStatus(tr('expDone', t('ui.branch.exportGraphDone')) + dest);
  return true;
}

async function exportBranchPng(pane) {
  const built = buildStandaloneSvg(pane);
  if (!built) { setStatus(tr('needTreeView', t('ui.branch.openViewGraphBefore'))); return false; }
  try {
    const text = new XMLSerializer().serializeToString(built.svg);
    // data: URI ของ SVG ต้องเป็น base64 — utf-8 ตรง ๆ พังทันทีที่มีตัวอักษรไทย
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
    const scale = 2;                              // จอ retina / เอาไปขยายในสไลด์ได้
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(built.w * scale); cv.height = Math.round(built.h * scale);
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const b64 = cv.toDataURL('image/png').split(',')[1];
    const dir = await kapi.join(state.root, 'Images');
    const name = await kapi.writeImageData(dir, safeName(projTitle()) + '-branching.png', b64);
    setStatus('📷 ' + tr('pngSaved', t('ui.branch.saveImageGraphLibrary')) + (typeof name === 'string' ? name : 'branching.png'));
    return true;
  } catch (e) {
    log('error', t('ui.branch.branchingExportPNGNot'), e);
    setStatus(tr('pngFail', t('ui.common.exportPNGNotOk')) + e.message);
    return false;
  }
}

// ---- เขียน choices กลับลง scenes.json ----
// ต้องต่อคิว: updateSceneRow เป็น อ่าน→แก้→เขียน ทั้งไฟล์ ถ้ายิงพร้อมกันสองครั้ง
// (เช่นกดลบสองแถวรัว ๆ หรือ blur ช่องข้อความแล้วกดปุ่มทันที) ตัวหลังจะอ่านของเก่า
// แล้วเขียนทับ = การแก้ครั้งแรกหายเงียบ ๆ (บั๊กข้อ 15c)
let _choiceQueue = Promise.resolve();
export function mutateChoices(node, fn) {
  // [alpha.74] เปิดแผนอยู่ = ทางเลือกเป็นของแผนนั้น ไม่ใช่ของ scenes.json
  // (เหตุผลข้อ 2 ของผู้ใช้: แต่ละเล่มมีทางเลือกคนละชุด — เขียนทับกันไม่ได้)
  if (inBranchPlan()) {
    const cur = planChoicesFor(planState.live, node.id);
    setPlanChoices(planState.live, node.id, fn([...cur]));
    markPlanDirty();
    return Promise.resolve(true);
  }
  const run = async () => {
    const { updateSceneRow } = await import('./app.js');
    return updateSceneRow(node.dPath, node.id, (r) => {
      r.choices = fn([...(r.choices || [])]);
      if (!r.choices.length) delete r.choices;           // ไม่ทิ้ง [] ว่างไว้ในไฟล์
    });
  };
  _choiceQueue = _choiceQueue.then(run, run);            // ล้มแล้วคิวต้องไปต่อ ไม่ค้าง
  return _choiceQueue;
}
const removeChoice = (node, idx) => mutateChoices(node, (list) => { list.splice(idx, 1); return list; });

/** [ข้อ 4] สีของการ์ดฉาก — เก็บใน scenes.json ช่อง color เดิม (ใช้ร่วมกับ explorer/kanban) */
export function setNodeColor(node, color) {
  const run = async () => {
    const { updateSceneRow } = await import('./app.js');
    return updateSceneRow(node.dPath, node.id, (r) => {
      if (color) r.color = color; else delete r.color;
    });
  };
  _choiceQueue = _choiceQueue.then(run, run);
  return _choiceQueue;
}

// ---- อ่านเนื้อฉากจากดิสก์ (ใช้หา [ข้อความ] ทางเลือก) ----
async function readSceneBody(node) {
  if (!node || !node.filePath) return '';
  try {
    const { parseMdFile } = await import('./md.js');
    return parseMdFile(await kapi.readFile(node.filePath)).body || '';
  } catch (e) { log('warn', t('ui.branch.branchingReadBodyScene'), e); return ''; }
}

// ---- แทรก [ข้อความ] ลงท้ายฉาก เพื่อให้ทางเลือกมีที่อยู่จริงในเนื้อเรื่อง ----
async function insertMarkerIntoScene(node, text) {
  if (!node.filePath) { setStatus(tr('noFile', t('ui.common.sceneNotHasFile'))); return false; }
  const { parseMdFile, dumpMdFile } = await import('./md.js');
  const { state: st } = await import('./core.js');
  const raw = await kapi.readFile(node.filePath);
  const { meta, body } = parseMdFile(raw);
  const marker = '[' + text + ']';
  if (body.includes(marker)) return true;
  const next = (body.replace(/\s+$/, '') + '\n\n' + marker + '\n');
  await kapi.writeFile(node.filePath, dumpMdFile(meta, next));
  // ฉากเปิดค้างอยู่ → โหลดเนื้อใหม่ให้เห็นทันที (ไม่งั้นพิมพ์ต่อแล้วเขียนทับของที่เพิ่งแทรก)
  const tab = st.tabs.get(node.filePath);
  if (tab && !tab.dirty) {
    if (tab.editor) tab.editor.setMarkdown(next);
    else if (tab.sp) tab.sp.setMarkdown(next);
  } else if (tab && tab.dirty) {
    setStatus(tr('insertedDirty', t('ui.branch.insertFileDoneScene')));
  }
  return true;
}

/**
 * สแกน [ข้อความ] ในฉากที่เปิดอยู่ แล้วสร้างทางเลือกที่ยังไม่มีให้ครบ (ข้อ 15)
 * เรียกได้จากเมนู/คีย์ลัด ระหว่างเขียนฉากอยู่ ไม่ต้องเปิดหน้าผังก่อน
 */
export async function syncChoicesFromScene() {
  const { sceneCtx, updateSceneRow } = await import('./app.js');
  const ctx = await sceneCtx();
  if (!ctx) { setStatus(tr('needScene', t('ui.branch.openSceneBeforeDonePrint'))); return 0; }
  const tab = state.tabs.get(state.active?.file);
  // ใช้เนื้อในตัวแก้ไขก่อน (ผู้ใช้เพิ่งพิมพ์ อาจยังไม่บันทึก) ไม่งั้นค่อยอ่านจากไฟล์
  let body = '';
  if (tab && (tab.editor || tab.sp)) body = (tab.editor || tab.sp).getMarkdown();
  if (!body) {
    const { parseMdFile } = await import('./md.js');
    try { body = parseMdFile(await kapi.readFile(state.active.file)).body || ''; } catch {}
  }
  const markers = scanChoiceMarkers(body);
  if (!markers.length) {
    setStatus(tr('noMarker', t('ui.branch.notFoundChoiceScene')));
    return 0;
  }
  const { missing } = diffChoiceMarkers(markers, ctx.row.choices || []);
  if (!missing.length) { setStatus(tr('allLinked', t('ui.branch.choiceSceneBindComplete')) + markers.length + ')'); return 0; }
  await updateSceneRow(ctx.dPath, ctx.row.id, (r) => {
    r.choices = [...(r.choices || []), ...missing.map((t2) => ({ text: t2, nextSceneId: '' }))];
  });
  setStatus(tr('addedFromText', t('ui.branch.addChoiceText')) + missing.length +
            tr('addedFromTextTail', t('ui.branch.listDefineToGraph')));
  refreshOpenBranchTab();
  return missing.length;
}

// ───────── สแกนทั้งโปรเจกต์: [ข้อความ] ในฉาก → ทางเลือก ─────────
async function scanAllScenes(scenes, redraw) {
  const { parseMdFile } = await import('./md.js');
  const { confirmBox } = await import('./ui.js');
  const found = [];
  for (const sc of scenes) {
    if (!sc.filePath) continue;
    let body = '';
    try { body = parseMdFile(await kapi.readFile(sc.filePath)).body || ''; } catch { continue; }
    const { missing } = diffChoiceMarkers(scanChoiceMarkers(body), sc.choices || []);
    if (missing.length) found.push({ sc, missing });
  }
  if (!found.length) {
    setStatus(tr('scanClean', t('ui.branch.scanCompleteDoneAll')));
    return 0;
  }
  const total = found.reduce((n, f) => n + f.missing.length, 0);
  const preview = found.slice(0, 8)
    .map((f) => `• ${f.sc.title}: ${f.missing.map((x) => '[' + x + ']').join(' ')}`).join('\n');
  const ok = await confirmBox(
    `${tr('scanFound', t('ui.branch.foundChoiceTextNot'))} ${total} ${tr('spots', t('ui.common.dot'))} ` +
    `${tr('fromScenes', t('ui.branch.msg'))} ${found.length} ${tr('sumScenes', t('ui.common.sceneGraph'))}\n\n${preview}` +
    (found.length > 8 ? `\n… +${found.length - 8}` : '') +
    '\n\n' + tr('scanAsk', t('ui.branch.bindAllChoiceTo')),
    tr('scanOk', t('ui.branch.bindAll')));
  if (!ok) return 0;
  for (const f of found) {
    await mutateChoices(f.sc, (list) => [...list, ...f.missing.map((x) => ({ text: x, nextSceneId: '' }))]);
  }
  setStatus(`${tr('scanDone', t('ui.branch.bindChoiceTextDone'))} ${total}`);
  redraw();
  return total;
}

// ───────── แผงเพิ่มทางเลือก (ข้อ 2: อยู่บนสุด) ─────────
function buildAdder(graph, bs, redraw) {
  const adder = el('div', 'branch-adder');
  adder.append(el('span', 'branch-adder-lbl', '➕ ' + tr('addChoice', t('ui.branch.addChoice3'))));
  const fromSel = el('select', 'k-field-select');
  const toSel = el('select', 'k-field-select');
  const none = el('option', null, tr('openEndDash', t('ui.branch.notSpecify'))); none.value = ''; toSel.append(none);
  for (const s of graph.nodes) {
    const a = el('option', null, s.title); a.value = s.id; fromSel.append(a);
    const b = el('option', null, s.title); b.value = s.id; toSel.append(b);
  }
  if (bs.sel && graph.byId.has(bs.sel)) fromSel.value = bs.sel;   // เลือกโหนดไว้ = เติมให้เลย
  const textInp = el('input', 'k-field-input');
  textInp.placeholder = tr('choiceTextPh', t('ui.branch.textChoiceEgOpen'));
  const addB = el('button', 'k-ok', '+ ' + tr('addChoiceBtn', t('ui.branch.addChoice2')));
  const doAdd = async () => {
    const from = graph.byId.get(fromSel.value);
    const text = textInp.value.trim();
    if (!from || !text) { setStatus(tr('needFromText', t('ui.branch.pickScenePutText'))); return; }
    await mutateChoices(from, (list) => [...list, { text, nextSceneId: toSel.value || '' }]);
    textInp.value = '';
    bs.sel = from.id;
    setStatus(tr('added', t('ui.branch.addChoiceDone')));
    redraw();
  };
  addB.onclick = doAdd;
  textInp.onkeydown = (e) => { if (e.key === 'Enter') doAdd(); };
  adder.append(fromSel, textInp, el('span', 'dim', '→'), toSel, addB);
  return adder;
}

// ───────── (ข้อ 4) แถวเลือกสี ─────────
function colorRow(current, onPick) {
  const row = el('div', 'branch-colors');
  const mk = (value, label, cls) => {
    const dot = el('span', 'branch-color' + (cls ? ' ' + cls : '') + (current === value ? ' on' : ''));
    if (value) dot.style.background = value;
    dot.title = label;
    dot.onclick = () => onPick(value);
    row.append(dot);
    return dot;
  };
  mk('', tr('colorNone', t('ui.branch.notDefineColor')), 'branch-color-none').textContent = '∅';
  for (const [name, hex] of SCENE_COLORS) mk(hex, name);
  return row;
}

// ───────── (ข้อ 13) กล่อง "เส้นทางทั้งหมด" พร้อมตัวกรอง ─────────
function showAllPathsDialog(graph, startId) {
  const info = enumeratePathsInfo(graph, startId, PATH_MAX);
  const titleOf = (id) => (graph.byId.get(id) || {}).title || '?';
  const lines = info.paths.map((p) => ({ ids: p, text: p.map(titleOf).join(' → ') }));

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog branch-dlg');
  box.append(el('div', 'k-dlg-title',
    `🧭 ${tr('allPaths', t('ui.branch.route'))} (${lines.length}${info.truncated ? '+' : ''})`));
  if (info.truncated) {
    box.append(el('div', 'branch-badge bw-open',
      `⚠ ${tr('pathTrunc', t('ui.branch.storyBreakBranchMore'))} ${PATH_MAX} ${tr('paths', t('ui.common.route'))} — ` +
      tr('pathTruncHint', t('ui.branch.show'))));
  }
  const inp = el('input', 'k-dlg-input');
  inp.placeholder = '🔍 ' + tr('filterPaths', t('ui.branch.filterRoutePrintName'));
  box.append(inp);
  const count = el('div', 'dim');
  box.append(count);
  const list = el('div', 'k-pick-list');
  list.style.maxHeight = '48vh';
  box.append(list);

  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    list.replaceChildren();
    const rows = q ? lines.filter((l) => l.text.toLowerCase().includes(q)) : lines;
    count.textContent = `${rows.length} / ${lines.length} ${tr('paths', t('ui.common.route'))}`;
    for (const l of rows.slice(0, 300)) {
      const row = el('div', 'k-menu-item branch-path-row');
      row.append(el('span', 'branch-path-len', l.ids.length + ' ' + tr('steps', t('ui.common.scene2'))));
      row.append(el('span', 'branch-path-txt', l.text));
      row.title = l.text;
      row.onclick = async () => {
        ov.remove();
        const { openPlayerMode } = await import('./player-mode.js');
        await openPlayerMode(l.ids[0]);
      };
      list.append(row);
    }
    if (rows.length > 300) list.append(el('div', 'dim', `… +${rows.length - 300}`));
  };
  let job = null;
  inp.oninput = () => { clearTimeout(job); job = setTimeout(draw, 130); };
  draw();

  const btns = el('div', 'k-dlg-btns');
  const copyB = el('button', null, '📋 ' + tr('copyPaths', t('ui.common.copyAll')));
  copyB.onclick = async () => {
    try { await navigator.clipboard.writeText(lines.map((l) => l.text).join('\n')); setStatus(tr('copied', t('ui.branch.copyDone'))); }
    catch { setStatus(tr('copyFail', t('ui.common.copyNotOk'))); }
  };
  const close = el('button', 'k-ok', tr('close', t('ui.common.close')));
  close.onclick = () => ov.remove();
  btns.append(copyB, close); box.append(btns);
  ov.append(box); document.body.append(ov);
  inp.focus();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ───────── แผง inspector ด้านขวา ─────────
function buildInspector(graph, layout, analysis, bs, redraw, redrawUi = redraw) {
  const side = el('div', 'branch-side');
  const shead = el('div', 'branch-side-head');
  shead.append(el('span', null, '🎯 ' + tr('inspector', t('ui.branch.choiceScene'))));
  const closeB = el('span', 'branch-side-x', '✕');
  closeB.title = tr('hideThis', t('ui.branch.hidePanel'));
  closeB.onclick = () => { bs.sideOpen = false; redrawUi(); };
  shead.append(closeB);
  side.append(shead);

  const body = el('div', 'branch-side-body');
  side.append(body);

  const node = bs.sel ? graph.byId.get(bs.sel) : null;
  if (!node) {
    body.append(el('div', 'dim', analysis.total
      ? tr('pickNode', t('ui.branch.clickDialogSceneTop'))
      : tr('pickNodeEmpty', t('ui.branch.notHasSceneGraph'))));
    return side;
  }

  body.append(el('div', 'branch-side-title', node.title));
  body.append(el('div', 'dim', node.chapterName || '—'));

  // ปุ่มเปิดฉาก (ปกติ / คู่กับผัง) / ทดลองเล่นจากฉากนี้
  const acts = el('div', 'branch-side-acts');
  const openB = el('button', 'k-ok', '📄 ' + tr('openScene', t('ui.branch.openScene2')));
  openB.onclick = () => openSceneFromGraph(node, false);
  const splitB = el('button', null, '⊞ ' + tr('openSplit', t('ui.branch.openPairGraph')));
  splitB.title = tr('openSplitHint', t('ui.branch.openSceneAreaWriteSee'));
  splitB.onclick = () => openSceneFromGraph(node, true);
  const playB = el('button', null, '▶️ ' + tr('playFrom', t('ui.branch.play')));
  playB.title = tr('playFromHint', t('ui.branch.openModeTrialPlay'));
  playB.onclick = async () => {
    const { openPlayerMode } = await import('./player-mode.js');
    await openPlayerMode(node.id);
  };
  acts.append(openB, splitB, playB);
  body.append(acts);

  // ป้ายบอกบทบาทของฉากในผัง
  const roleWrap = el('div', 'branch-roles');
  if (analysis.roots.includes(node.id)) roleWrap.append(el('span', 'branch-badge bw-root', '▶ ' + tr('roleRoot', t('ui.common.dotStart'))));
  if (analysis.endings.includes(node.id)) roleWrap.append(el('span', 'branch-badge bw-end', '🏁 ' + tr('roleEnd', t('ui.common.actEnd'))));
  if (analysis.cycles.includes(node.id)) roleWrap.append(el('span', 'branch-badge bw-loop', '🔁 ' + tr('roleLoopShort', t('ui.branch.dup'))));
  if (analysis.unreachable.includes(node.id)) roleWrap.append(el('span', 'branch-badge bw-lost', '🚫 ' + tr('roleLostShort', t('ui.branch.inNotTo'))));
  if (roleWrap.childNodes.length) body.append(roleWrap);

  // ---- (ข้อ 15) เส้นทางจากจุดเริ่มมาถึงฉากนี้ ----
  const hi = highlightPath(graph, node.id);
  if (hi.path.length > 1) {
    body.append(el('div', 'branch-side-sub', tr('pathFromStart', t('ui.branch.routeDotStart'))));
    const line = el('div', 'branch-path branch-path-hi');
    line.textContent = hi.path.map((id) => (graph.byId.get(id) || {}).title || '?').join(' → ');
    line.title = line.textContent;
    body.append(line);
  }

  // ---- (ข้อ 4) สีการ์ดฉาก ----
  body.append(el('div', 'branch-side-sub', '🎨 ' + tr('cardColor', t('ui.branch.colorCardScene'))));
  body.append(colorRow(node.color, async (c) => {
    await setNodeColor(node, c);
    setStatus(c ? tr('colorSet', t('ui.branch.recolorCardDone')) : tr('colorClear', t('ui.branch.clearColorCardDone')));
    redraw();
  }));

  // ---- ทางเลือกที่เขียนไว้ในเนื้อฉากจริง (ข้อ 15 เดิม) ----
  // หัวใจ: ผังต้องผูกกับ "ข้อความในเอกสาร" ไม่ใช่ข้อมูลลอย ๆ ใน scenes.json
  const docSec = el('div', 'branch-doc');
  docSec.append(el('div', 'branch-side-sub', '🔗 ' + tr('docChoices', t('ui.branch.choiceBodyScene'))));
  const docBody = el('div', 'branch-doc-body');
  docBody.append(el('div', 'dim', tr('reading', t('ui.branch.busyReadScene'))));
  docSec.append(docBody);
  body.append(docSec);
  readSceneBody(node).then((text) => {
    if (!docBody.isConnected) return;
    docBody.replaceChildren();
    const markers = scanChoiceMarkers(text);
    const { missing, orphan, linked } = diffChoiceMarkers(markers, node.choices);

    docBody.append(el('div', 'branch-doc-hint',
      tr('docHint', t('ui.branch.printTextSceneAt'))));

    if (linked.length) {
      const okLine = el('div', 'branch-doc-ok', `✓ ${tr('docLinked', t('ui.branch.bindTextDone'))} ${linked.length}`);
      okLine.title = linked.map((x) => '• ' + x).join('\n');
      docBody.append(okLine);
    }

    if (missing.length) {
      docBody.append(el('div', 'branch-doc-lbl', `${tr('docMissing', t('ui.branch.foundTextNotChoice'))} (${missing.length})`));
      for (const txt of missing) {
        const row = el('div', 'branch-doc-row');
        row.append(el('span', 'branch-doc-mark', '[' + txt + ']'));
        const b = el('button', 'branch-doc-add', '＋ ' + tr('docLink', t('ui.branch.bindChoice')));
        b.onclick = async () => {
          await mutateChoices(node, (list) => [...list, { text: txt, nextSceneId: '' }]);
          setStatus(`${tr('docLinked1', t('ui.branch.bindChoiceDone'))}: ${txt}`);
          redraw();
        };
        row.append(b); docBody.append(row);
      }
      const all = el('button', 'k-tpl-add', `＋ ${tr('docLinkAll', t('ui.branch.bindAll'))} (${missing.length})`);
      all.onclick = async () => {
        await mutateChoices(node, (list) => [...list, ...missing.map((x) => ({ text: x, nextSceneId: '' }))]);
        setStatus(tr('docLinkedAll', t('ui.branch.bindChoiceTextComplete')));
        redraw();
      };
      docBody.append(all);
    }

    if (orphan.length) {
      docBody.append(el('div', 'branch-doc-lbl', `${tr('docOrphan', t('ui.branch.choiceNotHasText'))} (${orphan.length})`));
      for (const txt of orphan) {
        const row = el('div', 'branch-doc-row branch-doc-orphan');
        row.append(el('span', 'branch-doc-mark', txt));
        const b = el('button', 'branch-doc-add', '↩ ' + tr('docInsert', t('ui.branch.insertScene')));
        b.onclick = async () => {
          if (await insertMarkerIntoScene(node, txt)) { setStatus(tr('docInserted', t('ui.branch.insertSceneDone'))); redraw(); }
        };
        row.append(b); docBody.append(row);
      }
    }

    if (!missing.length && !orphan.length && !linked.length)
      docBody.append(el('div', 'dim', tr('docNone', t('ui.branch.sceneNotHasText'))));
  });

  // ---- รายการทางเลือก: แก้ข้อความ + เปลี่ยนปลายทาง + สีเส้น + ลบ ----
  body.append(el('div', 'branch-side-sub', tr('sumChoices', t('ui.common.choice')) + ' (' + node.choices.length + ')'));
  if (!node.choices.length) body.append(el('div', 'dim', tr('noChoice', t('ui.branch.sceneNotHasChoice'))));
  if (node.choices.length) {
    body.append(el('div', 'branch-drag-hint', tr('dragHint', t('ui.branch.dragBarPasteTop'))));
  }

  node.choices.forEach((c, idx) => {
    const row = el('div', 'branch-edit-row');

    // ที่จับสำหรับลากทางเลือกไปฉากอื่น (ข้อ 16)
    const grip = el('span', 'branch-grip', '⠿');
    grip.draggable = true;
    grip.title = tr('dragChoice', t('ui.branch.dragPasteTopScene'));
    grip.addEventListener('dragstart', (ev) => {
      dragChoice = { node, idx, choice: { ...c } };
      row.classList.add('dragging');
      try { ev.dataTransfer.setData('text/plain', c.text || ''); ev.dataTransfer.effectAllowed = 'move'; } catch {}
    });
    grip.addEventListener('dragend', () => { row.classList.remove('dragging'); dragChoice = null; });

    const tIn = el('input', 'k-field-input branch-edit-text');
    tIn.value = c.text;
    tIn.placeholder = tr('choiceText', t('ui.branch.textChoice'));
    const commitText = async () => {
      const v = tIn.value.trim();
      if (v === c.text) return;
      await mutateChoices(node, (list) => {
        if (list[idx]) list[idx] = { ...list[idx], text: v };
        return list;
      });
      setStatus(tr('textEdited', t('ui.branch.editTextChoiceDone')));
      redraw();
    };
    tIn.onblur = commitText;
    tIn.onkeydown = (e) => { if (e.key === 'Enter') tIn.blur(); };

    const tSel = el('select', 'k-field-select branch-edit-to');
    const none = el('option', null, tr('openEndDash', t('ui.branch.notSpecify'))); none.value = ''; tSel.append(none);
    for (const s of graph.nodes) { const o = el('option', null, s.title); o.value = s.id; tSel.append(o); }
    tSel.value = graph.byId.has(c.nextSceneId) ? c.nextSceneId : '';
    tSel.onchange = async () => {
      await mutateChoices(node, (list) => {
        if (list[idx]) list[idx] = { ...list[idx], nextSceneId: tSel.value };
        return list;
      });
      setStatus(tr('targetChanged', t('ui.branch.changeToDone')));
      redraw();
    };

    // สีเส้น (ข้อ 4) — จานสีเล็ก ๆ กางเมื่อกด
    const colB = el('button', 'branch-edit-col', '🎨');
    colB.title = tr('lineColor', t('ui.branch.colorLineChoice'));
    if (c.color) colB.style.borderColor = c.color;
    colB.onclick = () => {
      const open = row.parentNode.querySelector('.branch-colors-pop');
      if (open) open.remove();
      const pop = colorRow(c.color, async (col) => {
        await mutateChoices(node, (list) => {
          if (list[idx]) list[idx] = { ...list[idx], color: col };
          return list;
        });
        setStatus(col ? tr('lineColorSet', t('ui.branch.recolorLineDone')) : tr('lineColorClear', t('ui.branch.clearColorLineDone')));
        redraw();
      });
      pop.classList.add('branch-colors-pop');
      row.after(pop);
    };

    const goB = el('button', 'branch-edit-go', '➜');
    goB.title = tr('walkChoice', t('ui.branch.choiceSaveHistoryDecide'));
    goB.onclick = async () => {
      const target = graph.byId.get(c.nextSceneId);
      if (!target) { setStatus(tr('noTarget', t('ui.branch.choiceNotSpecifyTo'))); return; }
      const { recordChoice } = await import('./player-choices.js');
      await recordChoice(node.id, node.title, c.text);
      bs.sel = target.id;
      openSceneFromGraph(target, false);
      redraw();
    };
    const delB = el('button', 'branch-edit-del', '✕');
    delB.title = tr('delChoice', t('ui.branch.delChoice2'));
    delB.onclick = async () => { await removeChoice(node, idx); redraw(); };

    row.append(grip, tIn, tSel, colB, goB, delB);
    body.append(row);
  });

  const addB = el('button', 'k-tpl-add', '+ ' + tr('addToThis', t('ui.branch.addChoiceScene')));
  addB.title = tr('addToThisHint', t('ui.branch.newChoiceNewReady'));
  addB.onclick = async () => {
    const { ask } = await import('./ui.js');
    const txt = (await ask(tr('choiceText', t('ui.branch.textChoice')),
                           { placeholder: tr('choiceEg', t('ui.branch.eg')), okLabel: tr('add', t('ui.branch.add2')) }) || '').trim();
    if (!txt) return;
    await mutateChoices(node, (list) => [...list, { text: txt, nextSceneId: '' }]);
    await insertMarkerIntoScene(node, txt);      // ผูกกับเนื้อเรื่องตั้งแต่แรก ไม่ปล่อยให้ลอย
    redraw();
  };
  body.append(addB);

  // ---- เส้นทางที่เป็นไปได้จากฉากนี้ (ข้อ 13: บอกด้วยว่าถูกตัด + ดูทั้งหมดได้) ----
  const info = enumeratePathsInfo(graph, node.id, PATH_LIMIT);
  if (info.paths.length) {
    const sub = el('div', 'branch-side-sub branch-paths-head');
    sub.append(el('span', null, `${tr('pathsFrom', t('ui.branch.routeScene'))} (${info.paths.length}${info.truncated ? '+' : ''})`));
    const allB = el('button', 'branch-doc-add', tr('seeAll', t('ui.branch.viewAll')));
    allB.onclick = () => showAllPathsDialog(graph, node.id);
    sub.append(allB);
    body.append(sub);
    if (info.truncated) {
      body.append(el('div', 'branch-badge bw-open branch-trunc',
        `⚠ ${tr('truncWarn', t('ui.branch.show2'))} ${PATH_LIMIT} ${tr('paths', t('ui.common.route'))} — ` +
        tr('truncWarnTail', t('ui.branch.hasMorePressView'))));
    }
    for (const p of info.paths.slice(0, 8)) {
      const line = el('div', 'branch-path');
      line.textContent = p.map((id) => (graph.byId.get(id) || {}).title || '?').join(' → ');
      line.title = line.textContent;
      body.append(line);
    }
  }

  // ---- ประวัติการตัดสินใจที่ผ่านฉากนี้ (ข้อ 83) ----
  import('./player-choices.js').then(({ choicesByScene }) => {
    const hist = choicesByScene(node.id);
    if (!hist.length || !body.isConnected) return;
    body.append(el('div', 'branch-side-sub', `${tr('pastChoices', t('ui.branch.pickScene'))} (${hist.length})`));
    for (const h of hist.slice(-5).reverse()) {
      body.append(el('div', 'branch-path', '🎯 ' + (h.choice || '')));
    }
  }).catch(() => {});

  return side;
}
