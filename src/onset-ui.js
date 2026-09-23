// onset-ui.js — [alpha.164] "ฉากมีปัญหา" (แก้ปัญหาหน้ากองถ่าย) · ชั้นที่แตะไฟล์/จอ
//
// ขั้นตอนของผู้ใช้:
//   1) คลิกขวาที่ฉากใน Explorer → "ฉากมีปัญหา" = เก็บเนื้อ ณ ตอนนั้นเป็น "ฉบับเดิม" (OnSet/<id>.json)
//   2) แก้ฉากตามปกติ — บรรทัดที่ต่างจากฉบับเดิมขึ้นแถบสี + ! หน้าบรรทัด ทันทีที่พิมพ์
//   3) สลับดู "ฉบับเดิม ⇄ ฉบับแก้ไข" ได้ทันที: คลิกขวาที่ฉาก · ชิปมุมขวาบนของตัวแก้ไข ·
//      คลิกขวาที่บรรทัดที่มีปัญหา · คีย์ลัดคำสั่ง `onset-toggle`
//   4) พิมพ์/ส่งออก/บันทึก = ฉบับแก้ไขเสมอ (ไฟล์ .md คือฉบับแก้ไข · ดูหัวไฟล์ onset-diff.js)
//
// ★ การแสดงฉบับเดิมใช้ตัวแก้ไขตัวเดิม (สลับ EditorState) ไม่ใช่ตัวแก้ไขตัวที่สอง —
//   หน้ากระดาษ/เลขหน้า/ซูม/ระยะขอบจึงเหมือนฉบับแก้ไขเป๊ะ · ระหว่างนั้น:
//   · ตัวอ่านเนื้อ (getMarkdown/getAlignMap/getText/mdLineCounts) ถูกครอบให้คืน **ฉบับแก้ไข**
//     → บันทึกอัตโนมัติ/ส่งออก/AI ไม่มีทางได้ฉบับเดิมไปเขียนทับงาน
//   · ตัวเขียนเนื้อทุกตัว (setMarkdown/cmd/insert…) กลับไปฉบับแก้ไขก่อนแล้วค่อยทำ
//   · ปลั๊กอินปฏิเสธทุกธุรกรรมที่แก้เนื้อ (อ่านอย่างเดียวจริง)
//   · app.js กลับไปฉบับแก้ไขก่อนทุกคำสั่ง (ยกเว้นซูม/สลับแท็บ/สลับฉบับ) — `onsetBeforeCommand`
import { t, tf } from './i18n.js';
import { el, state, setStatus, log } from './core.js';
import { confirmBox, popupMenu } from './ui.js';
import { gi } from './icons.js';
import { EditorState } from 'prosemirror-state';
import { parseMdFile } from './md.js';
import { ONSET_DIR, ONSET_COLORS, newOnsetRecord, normalizeOnsetRecord, onsetFileName, normColor } from './onset-diff.js';
import { setOnsetCompare, onsetInfo, docKeys } from './onset-plugin.js';

// ───────── ตัวเชื่อมกับ app.js (ติดตั้งครั้งเดียวตอนเริ่ม — ไม่ import app.js วนกลับ) ─────────
let H = {};
/**
 * @param {{sceneCtx:Function, openScene:Function, buildTree:Function, afterSwap:Function,
 *          alignFromString:Function, tabBodyText:Function}} hooks
 */
export function installOnset(hooks) { H = hooks || {}; }

// ───────── ดัชนีของโปรเจกต์ (sceneId → บันทึก) ─────────
const IDX = { root: '', map: new Map(), loaded: false, loading: null };

export function resetOnset() { IDX.root = ''; IDX.map = new Map(); IDX.loaded = false; IDX.loading = null; }

async function onsetDir(create = false) {
  if (!state.root) return '';
  const d = await kapi.join(state.root, ONSET_DIR);
  if (create && !(await kapi.exists(d))) await kapi.mkdir(d);
  return d;
}

/** อ่านบันทึกทั้งหมดของโปรเจกต์ (ครั้งแรกครั้งเดียว · force = อ่านใหม่) */
export async function loadOnsetIndex(force = false) {
  if (IDX.loaded && IDX.root === state.root && !force) return IDX.map;
  if (IDX.loading && IDX.root === state.root && !force) return IDX.loading;
  IDX.root = state.root || '';
  const run = (async () => {
    const map = new Map();
    const d = await onsetDir();
    if (d && await kapi.exists(d)) {
      for (const f of await kapi.listFiles(d, '.json').catch(() => [])) {
        const p = await kapi.join(d, f);
        try {
          const r = normalizeOnsetRecord(await kapi.readJson(p));
          if (r) map.set(r.sceneId, { ...r, path: p });
        } catch (e) { log('warn', t('ui.onset.errRead') + f, e); }
      }
    }
    if (IDX.root === (state.root || '')) { IDX.map = map; IDX.loaded = true; }
    IDX.loading = null;
    return map;
  })();
  IDX.loading = run;
  return run;
}

/** ฉากนี้ติดธง "ฉากมีปัญหา" อยู่ไหม (อ่านจากดัชนีที่โหลดแล้ว — ใช้ตอนวาดต้นไม้/เมนู) */
export function isProblemScene(sceneId) { return !!sceneId && IDX.map.has(sceneId); }
export function onsetRecordOf(sceneId) { return IDX.map.get(sceneId) || null; }
export function problemSceneIds() { return [...IDX.map.keys()]; }

function relOf(file) {
  const r = String(state.root || '').replace(/[\\/]+$/, '');
  const f = String(file || '');
  return r && f.toLowerCase().startsWith(r.toLowerCase()) ? f.slice(r.length + 1).replace(/\\/g, '/') : f;
}

async function writeRecord(rec) {
  const d = await onsetDir(true);
  const p = rec.path || await kapi.join(d, onsetFileName(rec.sceneId));
  const { path: _drop, ...data } = rec;
  await kapi.writeFile(p, JSON.stringify(data, null, 2));
  IDX.map.set(rec.sceneId, { ...data, path: p });
  return p;
}

// ───────── ติดธง / เลิกติดธง ─────────
/**
 * คลิกขวาที่ฉาก → "ฉากมีปัญหา" — เก็บเนื้อ ณ ตอนนี้ (รวมส่วนที่ยังไม่บันทึกในแท็บ) เป็นฉบับเดิม
 * @param {{sc:{id,title}, file:string}} c
 */
export async function markSceneProblem(c) {
  const sc = c && c.sc;
  if (!sc || !sc.id || !c.file) return false;
  await loadOnsetIndex();
  if (IDX.map.has(sc.id)) { setStatus(tf('ui.onset.already', sc.title || '')); return false; }
  const tab = state.tabs.get(c.file);
  let body = '', meta = {};
  if (tab && (tab.editor || tab.sp)) {
    // แท็บที่เปิดอยู่ชนะดิสก์ — "ฉบับเดิม" คือสิ่งที่ผู้ใช้เห็นอยู่ตอนกดเมนู
    body = H.tabBodyText ? H.tabBodyText(tab) : (tab.editor || tab.sp).getMarkdown();
    meta = tab.meta || {};
  } else {
    try { const p = parseMdFile(await kapi.readFile(c.file)); body = p.body; meta = p.meta || {}; }
    catch (e) { log('warn', t('ui.onset.errRead') + c.file, e); setStatus(t('ui.onset.errMark')); return false; }
  }
  const rec = newOnsetRecord({ sceneId: sc.id, file: relOf(c.file), title: sc.title || meta.title || '',
                               format: meta.format, align: typeof meta.align === 'string' ? meta.align : '',
                               baseline: body });
  try { await writeRecord(rec); }
  catch (e) { log('error', t('ui.onset.errMark'), e); setStatus(t('ui.onset.errMark')); return false; }
  if (H.buildTree) await H.buildTree();
  if (H.openScene) await H.openScene(c.file, sc.title);
  const open = state.tabs.get(c.file);
  if (open) await applyOnsetToTab(open);
  setStatus(gi('warning') + ' ' + tf('ui.onset.marked', sc.title || ''));
  return true;
}

/** เลิกติดธง — ลบฉบับเดิมทิ้ง (เนื้อฉากปัจจุบัน = ฉบับแก้ไข ไม่ถูกแตะ) */
export async function clearSceneProblem(c, opts = {}) {
  const sc = c && c.sc;
  if (!sc || !sc.id) return false;
  await loadOnsetIndex();
  const rec = IDX.map.get(sc.id);
  if (!rec) return false;
  if (!opts.force && !(await confirmBox(tf('ui.onset.clearAsk', sc.title || rec.title || ''), t('ui.onset.clearBtn')))) return false;
  for (const tab of state.tabs.values()) {
    if (tab._onset && tab._onset.id === sc.id) { exitOriginal(tab); detach(tab); }
  }
  try { if (rec.path && await kapi.exists(rec.path)) await kapi.remove(rec.path); }
  catch (e) { log('warn', t('ui.onset.errClear'), e); }
  IDX.map.delete(sc.id);
  if (H.buildTree) await H.buildTree();
  setStatus(tf('ui.onset.cleared', sc.title || rec.title || ''));
  return true;
}

/** เปลี่ยนสีแถบของฉากนั้น */
export async function setProblemColor(sceneId, color) {
  const rec = IDX.map.get(sceneId);
  if (!rec) return false;
  rec.color = normColor(color);
  await writeRecord(rec);
  for (const tab of state.tabs.values()) if (tab._onset && tab._onset.id === sceneId) paint(tab);
  return true;
}

// ───────── ผูกกับแท็บ ─────────
function edOf(tab) { return tab && (tab.editor || tab.sp); }
function parseBaseline(tab, rec) {
  const ed = edOf(tab);
  if (tab.editor) return ed.docFromMarkdown(rec.baseline, H.alignFromString ? H.alignFromString(rec.align) : undefined);
  return ed.docFromMarkdown(rec.baseline);
}
async function sceneIdOf(tab) {
  if (tab._sceneId !== undefined) return tab._sceneId;
  let id = '';
  try { const c = H.sceneCtx ? await H.sceneCtx(tab.file) : null; id = (c && c.row && c.row.id) || ''; } catch { id = ''; }
  if (id) tab._sceneId = id;          // ว่าง = ยังหาไม่เจอ (แถวยังไม่ลง scenes.json ฯลฯ) → ถามใหม่รอบหน้า
  return id;
}

/**
 * ติดตั้ง/ถอดการเทียบให้แท็บตามบันทึกของฉากนั้น — เรียกหลังสร้างตัวแก้ไขทุกครั้ง
 * (เปิดฉาก · สลับนิยาย/บทหนัง) และหลังติดธง/เลิกติดธง
 */
export async function applyOnsetToTab(tab) {
  if (!tab || !edOf(tab) || !state.root) return false;
  await loadOnsetIndex();
  if (!IDX.map.size && !tab._onset) return false;   // โปรเจกต์ไม่มีฉากมีปัญหาเลย = ไม่ต้องหา id ของฉาก
  const id = await sceneIdOf(tab);
  const rec = id ? IDX.map.get(id) : null;
  if (!rec) { if (tab._onset) { exitOriginal(tab); detach(tab); } return false; }
  const ed = edOf(tab);
  if (tab._onsetSaved) return true;                  // กำลังโชว์ฉบับเดิมอยู่ — อย่ารื้อ
  let baseKeys;
  try { baseKeys = docKeys(parseBaseline(tab, rec)); }
  catch (e) { log('warn', t('ui.onset.errRead'), e); return false; }
  tab._onset = { id, rec, view: 'revised', baseKeys, ed };
  setOnsetCompare(ed.view, { other: baseKeys, side: 'revised', lock: false });
  paint(tab);
  return true;
}

function detach(tab) {
  const ed = edOf(tab);
  if (ed && ed.view && !ed.view.isDestroyed) setOnsetCompare(ed.view, null);
  tab._onset = null;
  paint(tab);
}

// ───────── ฉบับเดิม ⇄ ฉบับแก้ไข ─────────
const READS = ['getMarkdown', 'getAlignMap', 'mdLineCounts', 'getText'];
const WRITES = ['setMarkdown', 'cmd', 'insertImage', 'setFigureOpts', 'removeFigure', 'insertLines', 'insertScript',
                'pasteScript', 'setExtension', 'setElement', 'setAlign', 'applyAlignMap', 'cycle', 'switchTo',
                'insertPageBreak', 'enter', 'toggleTextList', 'pressEnter', 'pressBackspace', 'selectScene'];

function installProxies(tab, ed, saved) {
  const shadow = Object.create(ed, { view: { value: { state: saved, dom: ed.view.dom } } });
  const own = {};
  for (const m of READS) {
    if (typeof ed[m] !== 'function') continue;
    own[m] = Object.prototype.hasOwnProperty.call(ed, m) ? ed[m] : undefined;
    const proto = Object.getPrototypeOf(ed)[m];
    ed[m] = (...a) => proto.apply(shadow, a);
  }
  for (const m of WRITES) {
    if (typeof ed[m] !== 'function' || m === 'selectScene') continue;
    own[m] = Object.prototype.hasOwnProperty.call(ed, m) ? ed[m] : undefined;
    // ตัวที่ถูกครอบไว้แล้ว (edit-guard: ล็อก = ไม่ทำงาน) ต้องยังทำงานต่อ — เรียกของเดิม ไม่ใช่ของ prototype
    const prev = own[m] || Object.getPrototypeOf(ed)[m];
    ed[m] = (...a) => { exitOriginal(tab); return prev.apply(ed, a); };
  }
  tab._onsetOwn = own;
}
function removeProxies(tab, ed) {
  const own = tab._onsetOwn || {};
  for (const m of Object.keys(own)) {
    if (own[m] === undefined) delete ed[m]; else ed[m] = own[m];
  }
  tab._onsetOwn = null;
}

/** โชว์ฉบับเดิม (อ่านอย่างเดียว) — ฉบับแก้ไขถูกพักไว้ทั้ง state (ประวัติ undo/เคอร์เซอร์ครบ) */
export function showOriginal(tab = state.active) {
  if (!tab || !tab._onset || tab._onsetSaved) return false;
  const ed = edOf(tab);
  if (!ed || !ed.view || ed !== tab._onset.ed) return false;
  const v = ed.view;
  const saved = v.state;
  let doc;
  try { doc = parseBaseline(tab, tab._onset.rec); }
  catch (e) { log('warn', t('ui.onset.errRead'), e); return false; }
  const revisedKeys = docKeys(saved.doc);
  tab._onsetSaved = saved;                           // ต้องตั้งก่อน updateState — editable() อ่านค่านี้
  installProxies(tab, ed, saved);
  v.updateState(EditorState.create({ doc, plugins: saved.plugins }));
  setOnsetCompare(v, { other: revisedKeys, side: 'original', lock: true });
  tab._onset.view = 'original';
  paint(tab);
  if (H.afterSwap) H.afterSwap(tab);
  return true;
}

/** กลับไปฉบับแก้ไข — คืน state เดิมทั้งก้อน (ไม่ใช่สร้างใหม่ = ไม่มีอะไรหาย) */
export function exitOriginal(tab = state.active) {
  if (!tab || !tab._onsetSaved) return false;
  const ed = edOf(tab);
  const saved = tab._onsetSaved;
  tab._onsetSaved = null;
  if (ed) removeProxies(tab, ed);
  if (ed && ed.view && !ed.view.isDestroyed) {
    ed.view.updateState(saved);
    if (tab._onset) setOnsetCompare(ed.view, { other: tab._onset.baseKeys, side: 'revised', lock: false });
  }
  if (tab._onset) tab._onset.view = 'revised';
  paint(tab);
  if (H.afterSwap) H.afterSwap(tab);
  return true;
}

/** สลับ ฉบับเดิม ⇄ ฉบับแก้ไข · want = 'original' | 'revised' (ไม่ส่ง = สลับ) */
export function toggleOnsetView(tab = state.active, want) {
  if (!tab || !tab._onset) { setStatus(t('ui.onset.notProblem')); return false; }
  const to = want || (tab._onset.view === 'original' ? 'revised' : 'original');
  if (to === tab._onset.view) return true;
  const ok = to === 'original' ? showOriginal(tab) : exitOriginal(tab);
  if (ok) setStatus(to === 'original' ? t('ui.onset.nowOriginal') : t('ui.onset.nowRevised'));
  return ok;
}

/**
 * เอกสาร **ฉบับแก้ไข** ของแท็บ ไม่ว่าจอกำลังโชว์ฉบับไหน — ทางส่งออก/รายงานที่อ่าน doc ตรง ๆ
 * (ไม่ผ่าน getMarkdown) ต้องใช้ตัวนี้ ไม่งั้นส่งออกขณะดูฉบับเดิมได้ฉบับเดิมไป
 */
export function revisedDoc(tab) {
  const ed = edOf(tab);
  if (!ed || !ed.view) return null;
  return tab._onsetSaved ? tab._onsetSaved.doc : ed.view.state.doc;
}

/** ฉากนี้ (ตามไฟล์) กำลังแสดงฉบับไหน — '' = ไม่ได้เปิด/ไม่ได้ติดธง */
export function onsetViewOf(file) {
  const tab = state.tabs.get(file);
  return tab && tab._onset ? tab._onset.view : '';
}

// คำสั่งที่ทำได้ระหว่างดูฉบับเดิมโดยไม่ต้องกลับฉบับแก้ไขก่อน (ดูอย่างเดียว ไม่อ่าน/ไม่เขียนเนื้อ)
const VIEW_ONLY = new Set(['onset-toggle', 'zoom', 'zoom-in', 'zoom-out', 'zoom-reset', 'ui-scale', 'scroll',
                           'find', 'find-next', 'find-prev', 'goto-page', 'goto-scene',
                           'next-tab', 'prev-tab', 'toggle-panel', 'show-panel', 'reveal-active', 'cheatsheet',
                           'settings', 'line-numbers', 'reading-mode', 'focus-mode', 'typewriter']);
/**
 * app.js เรียกก่อนทุกคำสั่ง — กำลังดูฉบับเดิมแล้วสั่งอย่างอื่น (บันทึก · พิมพ์ · ส่งออก · สลับโหมด ·
 * จัดรูปแบบ …) = กลับฉบับแก้ไขก่อน · "พิมพ์และส่งออกยึดฉบับแก้ไข" ตามที่ผู้ใช้กำหนด
 * @returns {boolean} true = สลับกลับให้แล้ว
 */
export function onsetBeforeCommand(channel) {
  if (VIEW_ONLY.has(channel)) return false;
  let did = false;
  for (const tab of state.tabs.values()) if (tab._onsetSaved) did = exitOriginal(tab) || did;
  return did;
}

// ───────── ชิปบนตัวแก้ไข + สีแถบ ─────────
/** วาดชิปมุมขวาบนของแผง + ตั้งสีแถบ (เรียกซ้ำได้ — เปลี่ยนเฉพาะที่ต่าง) */
export function paint(tab) {
  if (!tab || !tab.pane) return;
  const on = !!tab._onset;
  tab.pane.classList.toggle('k-onset-pane', on);
  tab.pane.classList.toggle('k-onset-orig', on && tab._onset.view === 'original');
  if (tab.tabBtn) tab.tabBtn.classList.toggle('k-onset-tab', on);
  let bar = tab.pane.querySelector(':scope > .k-onset-bar');
  if (!on) { if (bar) bar.remove(); tab.pane.style.removeProperty('--k-onset-color'); return; }
  tab.pane.style.setProperty('--k-onset-color', normColor(tab._onset.rec.color));
  if (!bar) {
    // สูง 0 + sticky = ติดขอบบนของแผงตอนเลื่อน โดยไม่ดันหน้ากระดาษลง (ไม่กระทบการจัดหน้า)
    bar = el('div', 'k-onset-bar');
    tab.pane.insertBefore(bar, tab.pane.firstChild);
  }
  const orig = tab._onset.view === 'original';
  const info = onsetInfo(edOf(tab) && edOf(tab).view) || { hunks: 0 };
  const chip = el('div', 'k-onset-chip' + (orig ? ' is-orig' : ''));
  chip.append(el('span', 'k-onset-chip-bang', '!'));
  chip.append(el('span', 'k-onset-chip-text', t('ui.onset.chipTitle') + ' · '
    + (orig ? t('ui.onset.viewOriginal') : t('ui.onset.viewRevised'))
    + ' · ' + (info.hunks ? tf('ui.onset.nChanges', info.hunks) : t('ui.onset.noChanges'))));
  const btn = el('button', 'k-onset-chip-btn', gi('swap') + ' ' + (orig ? t('ui.onset.toRevised') : t('ui.onset.toOriginal')));
  btn.type = 'button';
  btn.title = t('ui.onset.toggleTip');
  btn.onclick = (e) => { e.stopPropagation(); toggleOnsetView(tab); };
  const more = el('button', 'k-onset-chip-more', gi('more'));
  more.type = 'button';
  more.title = t('ui.onset.moreTip');
  more.onclick = (e) => {
    e.stopPropagation();
    const r = more.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 2, onsetMenuItems(tab));
  };
  chip.append(btn, more);
  chip.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); popupMenu(e.clientX, e.clientY, onsetMenuItems(tab)); };
  bar.replaceChildren(chip);
}

let chipTimer = null;
/** ตัวแก้ไขเปลี่ยน → จำนวนจุดที่แก้บนชิปต้องตาม (หน่วงรวบ ไม่วาดทุกตัวอักษร) */
export function onsetChanged(tab) {
  if (!tab || !tab._onset) return;
  clearTimeout(chipTimer);
  chipTimer = setTimeout(() => paint(tab), 200);
}

const COLOR_NAME = {
  '#e5484d': 'ui.onset.color.e5484d', '#f76b15': 'ui.onset.color.f76b15', '#ffc53d': 'ui.onset.color.ffc53d',
  '#30a46c': 'ui.onset.color.30a46c', '#0090ff': 'ui.onset.color.0090ff', '#8e4ec6': 'ui.onset.color.8e4ec6',
};
/** รายการเมนูของฉากที่ติดธง (ใช้ทั้งชิป · คลิกขวาในตัวแก้ไข · เมนูย่อยใน Explorer) */
export function onsetMenuItems(tab, c = null) {
  const id = (tab && tab._onset && tab._onset.id) || (c && c.sc && c.sc.id) || '';
  const rec = IDX.map.get(id);
  if (!rec) return [];
  const orig = !!(tab && tab._onset && tab._onset.view === 'original');
  const items = [];
  if (tab && tab._onset) {
    items.push({ label: orig ? t('ui.onset.toRevised') : t('ui.onset.toOriginal'), cmd: 'onset-toggle',
                 click: () => toggleOnsetView(tab) });
  }
  items.push({ label: t('ui.onset.colorMenu'), sub: () => ONSET_COLORS.map((hex) => ({
    text: t(COLOR_NAME[hex] || 'ui.onset.color.e5484d'), swatch: hex, checked: normColor(rec.color) === hex,
    click: () => setProblemColor(id, hex) })) });
  items.push('-');
  items.push({ label: t('ui.onset.clear'), danger: true,
               click: () => clearSceneProblem({ sc: { id, title: rec.title } }) });
  return items;
}

/**
 * คลิกขวาในตัวแก้ไข — บนบรรทัดที่มีปัญหา (หรือที่ไหนก็ได้ตอนดูฉบับเดิม) ได้เมนูของฉากมีปัญหา
 * พร้อมคำสั่งแก้ไขพื้นฐาน (เมนูนี้แทนเมนูของระบบ จึงต้องมีคัดลอก/ตัด/วางให้ครบ)
 * @returns {Array|null} null = ไม่ใช่กรณีนี้ ปล่อยเมนูเดิมทำงาน
 */
export function onsetEditorMenu(tab, target) {
  if (!tab || !tab._onset) return null;
  const ed = edOf(tab);
  if (!ed || !ed.view || !ed.view.dom.contains(target)) return null;
  const orig = tab._onset.view === 'original';
  const onLine = !!(target.closest && target.closest('.k-onset-line, .k-onset-bang'));
  if (!orig && !onLine) return null;
  const v = ed.view;
  const selText = () => { const s = v.state.selection; return s.empty ? '' : v.state.doc.textBetween(s.from, s.to, '\n'); };
  const items = [...onsetMenuItems(tab), '-'];
  items.push({ label: t('ui.common.copy'), disabled: !selText(), click: () => kapi.clipboardWrite(selText()) });
  if (!orig) {
    items.push({ label: t('ui.menu.cut'), disabled: !selText(), click: async () => {
      await kapi.clipboardWrite(selText()); v.dispatch(v.state.tr.deleteSelection()); } });
    items.push({ label: t('ui.menu.paste'), click: async () => {
      const txt = await kapi.clipboardRead(); if (txt) v.pasteText(String(txt)); } });
  }
  return items;
}
