// tree-actions.js — [alpha.155] คำสั่งใหม่ของเมนูคลิกขวาใน Explorer
//
// ผู้ใช้ส่งรายการเมนูครบทุกชนิดแถวมา (ดู tree-menu-spec.js) — ครึ่งหนึ่งมีอยู่แล้วใน app.js/scene-ops.js
// ไฟล์นี้คือครึ่งที่ยังไม่มี: ทำสำเนา/ย้าย/คัดลอกเล่มและบท · ลำดับ · memo · รูป · กระดาน/แผน ·
// หมุด · backup รายชิ้น · ล็อกซ้อนชั้น · คุณสมบัติแบบหน้าต่าง/แผงของทุกชนิด
//
// ตรรกะที่เทสได้ (ลำดับ · id ใหม่ · หมุด · ล็อกซ้อนชั้น · ชื่อชุดสำรอง) อยู่ใน tree-item-meta.js
// ที่นี่คือส่วนที่แตะดิสก์/DOM · เรียก app.js ตอน runtime เท่านั้น (กฎ circular import ข้อ 6 ใน AGENTS.md)
import { t, tf } from './i18n.js';
import { buildTree, closeTab, guid, openScene, safeName, saveTab, saveProjectMeta, refreshNetwork,
         sectionPathOfFile, SECTION_STATUSES, applyLockToTab, closeTabsUnderPath, moveSnapshots } from './app.js';
import { pathKey } from './tab-bridge.js';
import { SCENE_COLORS, dataLabel, el, setStatus, state, log, logAction } from './core.js';
import { allStatuses } from './custom-status.js';
import { ask, confirmBox, popupMenu, escClose } from './ui.js';
import { vivid } from './color-util.js';
import { buildLoglineFields } from './logline-ui.js';
import { compactLogline } from './logline.js';
import { mutateJson } from './json-store.js';
import { dumpMdFile, parseMdFile } from './md.js';
import { gi } from './icons.js';
import { listSections, addSection } from './section-ops.js';
import { addChapter, moveSceneToChapter, addScene } from './scene-ops.js';
import { moveToPosition, stepIndex } from './tree-menu-spec.js';
import * as IM from './tree-item-meta.js';

// ═══════════════════ ตัวช่วยกลาง ═══════════════════

/** path สัมพัทธ์กับรากโปรเจกต์ (คีย์ของ explorer meta / หมุด) */
export async function relOf(abs) {
  if (!state.root || !abs) return '';
  try { return IM.relKey(await kapi.relative(state.root, abs)); } catch { return ''; }
}

/** ก้อน explorer ของโปรเจกต์ (ถูกรูปเสมอ) */
export function explorer() { return IM.normalizeExplorer(state.meta && state.meta.explorer); }

async function saveExplorer(ex) {
  if (!state.meta) return;
  state.meta.explorer = IM.normalizeExplorer(ex);
  await saveProjectMeta();
}

/** ก๊อปทั้งโฟลเดอร์ (ไฟล์ผ่าน copyFile — รูปไม่เสีย · บทเรียนใน backup.js) */
export async function copyTree(src, dst) {
  await kapi.mkdir(dst);
  for (const f of await kapi.listFiles(src, '').catch(() => [])) {
    await kapi.copyFile(await kapi.join(src, f), await kapi.join(dst, f));
  }
  for (const d of await kapi.listDirs(src).catch(() => [])) {
    await copyTree(await kapi.join(src, d), await kapi.join(dst, d));
  }
}

/** ย้ายลงถังขยะแบบไม่ถาม (ใช้ตอนกู้คืนจากชุดสำรอง — ผู้ใช้ยืนยันไปแล้ว) */
async function moveToRecycle(abs) {
  if (!(await kapi.exists(abs))) return '';
  const recDir = await kapi.join(state.root, 'Recycle');
  await kapi.mkdir(recDir);
  const dst = await kapi.join(recDir, Date.now().toString(36) + '-' + abs.split(/[\\/]/).pop());
  await kapi.move(abs, dst);
  return dst;
}

/**
 * ปิดแท็บทุกใบที่อยู่ใต้ path นี้ (บันทึกก่อนถ้าค้าง)
 * [alpha.156] ส่งต่อให้ตัวกลางใน app.js — เดิม `startsWith(prefix)` ไม่มีตัวคั่น ("บท1" ไปจับ "บท10")
 */
function closeTabsUnder(prefix, { save = true } = {}) {
  return closeTabsUnderPath(prefix, { save });
}

/** ชื่อไม่ชนกับรายการเดิม — ตามคำต่อท้ายของภาษาที่ใช้อยู่ */
function copyName(base, existing) { return IM.uniqueCopyName(base, existing, t('ui.treeAct.copySuffix')); }

async function readJson(p, fallback) { try { return await kapi.readJson(p); } catch { return fallback; } }
const writeJson = (p, v) => kapi.writeFile(p, JSON.stringify(v, null, 2));
const sortByOrder = (list) => (list || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

// ═══════════════════ ล็อกซ้อนชั้น ═══════════════════
// ผู้ใช้: "lock เล่ม/บท = ล็อกทุกฉากข้างใน"

/** ชั้นที่ล็อกไฟล์ฉากนี้ไว้ (ไม่นับล็อกของฉากเอง) · '' = ไม่มี */
export async function containerLockOf(file) {
  const f = String(file || '');
  const secPath = sectionPathOfFile(f);
  if (secPath) {
    const sec = await readJson(await kapi.join(secPath, 'section.json'), {});
    if (sec.locked) return 'book';
  }
  const m = f.match(/^(.*)[\\/]Chapters[\\/]([^\\/]+)[\\/][^\\/]+$/);
  if (m) {
    const draft = await readJson(await kapi.join(m[1], 'draft.json'), {});
    const ch = (draft.chapters || []).find((c) => c.folderName === m[2]);
    if (ch && ch.locked) return 'chapter';
  }
  return '';
}

/** คำนวณล็อกใหม่ให้แท็บที่เปิดอยู่ใต้ path นี้ (หลังล็อก/ปลดล็อกเล่มหรือบท) */
export async function refreshOpenTabLocks(prefix) {
  for (const [file, tab] of state.tabs.entries()) {
    if (typeof file !== 'string' || !/\.md$/i.test(file)) continue;
    if (prefix && !file.startsWith(prefix)) continue;
    const own = tab.meta && (tab.meta.locked === true || tab.meta.locked === 'true');
    tab.locked = !!own || !!(await containerLockOf(file));
    try { applyLockToTab(tab); } catch {}
  }
}

/** ข้อความบอกว่าติดล็อกที่ชั้นไหน · '' = ไม่ติด */
export function lockMessage(source) {
  if (source === 'book') return t('ui.treeAct.lockedBook');
  if (source === 'chapter') return t('ui.treeAct.lockedChapter');
  return source ? t('ui.treeAct.lockedItem') : '';
}

// ═══════════════════ เมนูย่อย: สี · สถานะ ═══════════════════
export function colorMenu(e, current, apply) {
  // [alpha.157] ช่องสี่เหลี่ยมสีจริงหน้าชื่อสี (เดิมเป็นจุด bullet สีเดียวกันหมด แยกสีไม่ออก)
  popupMenu(e.clientX, e.clientY, [
    ...SCENE_COLORS.map(([name, hex]) => ({
      text: dataLabel(name), swatch: vivid(hex), checked: hex === current,
      click: () => apply(hex),
    })),
    '-',
    { label: t('ui.treeAct.clearColor'), swatch: '', click: () => apply('') },
  ]);
}

/**
 * @param {Array<[string,string]>} options [ค่า, ป้าย]
 * @param {Function} [colorOf] ค่า → สี (สถานะฉากมีสีประจำ — แสดงเป็นช่องสี่เหลี่ยมหน้าชื่อ)
 */
export function statusMenu(e, options, current, apply, clearValue = '', colorOf = null) {
  popupMenu(e.clientX, e.clientY, [
    ...options.map(([v, label]) => ({
      text: label, checked: v === current, click: () => apply(v),
      ...(colorOf ? { swatch: vivid(colorOf(v)) } : {}),
    })),
    '-',
    { label: t('ui.treeAct.clearStatus'), click: () => apply(clearValue) },
  ]);
}

export const bookStatusOptions = () => SECTION_STATUSES.map(([k, label]) => [k, label]);
export const sceneStatusOptions = () => allStatuses().map((s) => [s, dataLabel(s)]);
export const planStatusOptions = async () => {
  const { PLAN_STATUSES } = await import('./branch-plans.js');
  return PLAN_STATUSES.map((s) => [s, dataLabel(s)]);
};

// ═══════════════════ โปรเจกต์ ═══════════════════
export async function renameProject() {
  if (!state.meta) return null;
  const v = await ask(t('ui.treeAct.renameProjectAsk'), { value: state.meta.title || state.title || '' });
  if (!v || v === state.meta.title) return null;
  state.meta.title = v; state.title = v;
  await saveProjectMeta();
  document.title = v + ' — Killian 2';
  const tb = document.getElementById('tb-title'); if (tb) tb.textContent = v + ' — Killian 2';
  await buildTree();
  setStatus(tf('ui.treeAct.renamedProject', v));
  return v;
}

// ═══════════════════ เล่ม ═══════════════════
export async function readSection(secPath) { return readJson(await kapi.join(secPath, 'section.json'), {}); }

/** แก้ section.json · ค่าว่าง/false = ลบช่อง (ไฟล์ไม่บวม) */
export async function setSectionFields(secPath, patch) {
  const sf = await kapi.join(secPath, 'section.json');
  const { data: d } = await mutateJson(kapi, sf, (sec) => {        // [alpha.159 · M1] อ่านสดในคิว
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === '' || v === false || v === null || v === undefined) delete sec[k]; else sec[k] = v;
    }
  }, { fallback: {} });
  if ('locked' in (patch || {})) await refreshOpenTabLocks(secPath);
  await buildTree();
  return d;
}

export async function reorderSectionPrompt(secPath) {
  const secs = await listSections();
  const i = secs.findIndex((s) => s.secPath === secPath);
  if (i < 0) return false;
  const v = await ask(tf('ui.treeAct.positionAsk', secs.length), { value: String(i + 1) });
  if (v === null || v === '') return false;
  const next = moveToPosition(secs, i, v);
  for (let k = 0; k < next.length; k++) {
    if ((next[k].meta.order || 0) === k + 1) continue;
    // [alpha.159 · M1] แตะเฉพาะ order ของไฟล์สด (meta ถูกอ่านไว้ก่อนกล่องถาม)
    const ord = k + 1;
    await mutateJson(kapi, next[k].sf, (sec) => { sec.order = ord; }, { fallback: {} });
  }
  await buildTree();
  setStatus(t('ui.treeAct.reordered'));
  return true;
}

export async function duplicateSection(secPath) {
  const sec = await readSection(secPath);
  const secs = await listSections();
  const title = copyName(sec.title || secPath.split(/[\\/]/).pop(), secs.map((s) => s.title));
  let dst = await kapi.join(state.root, safeName(title));
  if (await kapi.exists(dst)) dst += '-' + Date.now().toString(36).slice(-4);
  await copyTree(secPath, dst);
  const next = { ...sec, guid: guid(), title, order: Math.max(0, ...secs.map((s) => s.order || 0)) + 1 };
  delete next.locked; delete next.flag;
  await writeJson(await kapi.join(dst, 'section.json'), next);
  const draftRoot = await kapi.join(dst, 'Draft');
  for (const dn of await kapi.listDirs(draftRoot).catch(() => [])) {
    const dPath = await kapi.join(draftRoot, dn);
    const df = await kapi.join(dPath, 'draft.json');
    const sf = await kapi.join(dPath, 'scenes.json');
    if (!(await kapi.exists(df))) continue;
    const r = IM.regenDraftIds(await readJson(df, {}), await readJson(sf, { chapters: {} }), guid);
    await writeJson(df, r.draft);
    await writeJson(sf, r.scenes);
  }
  logAction('section', tf('ui.treeAct.duplicatedBook', title), { from: secPath, to: dst });
  await buildTree(); refreshNetwork();
  setStatus(tf('ui.treeAct.duplicatedBook', title));
  return dst;
}

/** ทุกฉบับร่างของทุกเล่ม — ปลายทางของ "ย้ายบท" */
async function allDrafts() {
  const out = [];
  for (const s of await listSections()) {
    const dr = await kapi.join(s.secPath, 'Draft');
    const names = await kapi.listDirs(dr).catch(() => []);
    for (const dn of names) {
      const dPath = await kapi.join(dr, dn);
      if (!(await kapi.exists(await kapi.join(dPath, 'draft.json')))) continue;
      out.push({ secPath: s.secPath, title: s.title, draft: dn, dPath, multi: names.length > 1 });
    }
  }
  return out;
}

// ═══════════════════ บท ═══════════════════
export async function setChapterFields(dPath, chGuid, patch) {
  const df = await kapi.join(dPath, 'draft.json');
  // [alpha.159 · M1] อ่านสด-แก้-เขียนในคิวของไฟล์
  const res = await mutateJson(kapi, df, (d) => {
    const c = (d.chapters || []).find((x) => x.guid === chGuid);
    if (!c) return false;
    for (const [k, v] of Object.entries(patch || {})) {
      if (k === 'isFavorite') { c.isFavorite = !!v; continue; }          // ช่องเดิมของ v1 — เก็บ false ได้
      if (v === '' || v === false || v === null || v === undefined) delete c[k]; else c[k] = v;
    }
    return { ...c };
  }, { fallback: { chapters: [] } });
  const cur = res.changed ? res.result : null;
  if (!cur) return null;
  if ('locked' in (patch || {})) await refreshOpenTabLocks(await kapi.join(dPath, 'Chapters', cur.folderName));
  await buildTree();
  return cur;
}

export async function reorderChapterPrompt(dPath, ch) {
  const df = await kapi.join(dPath, 'draft.json');
  const d = await readJson(df, { chapters: [] });
  const list = sortByOrder(d.chapters);
  const i = list.findIndex((c) => c.guid === ch.guid);
  if (i < 0) return false;
  const v = await ask(tf('ui.treeAct.positionAsk', list.length), { value: String(i + 1) });
  if (v === null || v === '') return false;
  // [alpha.159 · M1] ระหว่างรอกล่องถาม ไฟล์อาจเปลี่ยนไปแล้ว — จัดลำดับจากของสดในคิว
  await mutateJson(kapi, df, (fresh) => {
    const l2 = sortByOrder(fresh.chapters);
    const j = l2.findIndex((c) => c.guid === ch.guid);
    if (j < 0) return false;
    fresh.chapters = moveToPosition(l2, j, v).map((c, k) => ({ ...c, order: k + 1 }));
  });
  await buildTree();
  setStatus(t('ui.treeAct.reordered'));
  return true;
}

/**
 * คัดลอก/ย้ายบททั้งบท (โฟลเดอร์ + แถวใน draft.json + แถวฉากใน scenes.json) ไปฉบับร่างใดก็ได้
 * ย้าย = guid/id เดิม (ลิงก์ ทางเลือกแตกสาย หมุด ยังตามได้) · คัดลอก = id ใหม่ทั้งชุด
 */
export async function copyChapterTo(srcD, chGuid, dstD, { move = false, afterGuid = null, title = '' } = {}) {
  const sdf = await kapi.join(srcD, 'draft.json'), ssf = await kapi.join(srcD, 'scenes.json');
  const ddf = await kapi.join(dstD, 'draft.json'), dsf = await kapi.join(dstD, 'scenes.json');
  const sDraft = await readJson(sdf, { chapters: [] });
  const entry = (sDraft.chapters || []).find((c) => c.guid === chGuid);
  if (!entry) return null;
  const same = srcD === dstD;
  if (move && same) return entry;
  const dList = sortByOrder((same ? sDraft : await readJson(ddf, { chapters: [] })).chapters);
  const newGuid = move && !dList.some((c) => c.guid === chGuid) ? chGuid : guid();
  const newTitle = title || entry.title || '';
  let at = afterGuid ? dList.findIndex((c) => c.guid === afterGuid) + 1 : dList.length;
  if (at <= 0 && afterGuid) at = dList.length;
  let folderName = String(at + 1).padStart(2, '0') + ' - ' + safeName(newTitle || 'chapter');
  for (let n = 2; await kapi.exists(await kapi.join(dstD, 'Chapters', folderName)); n++) {
    folderName = String(at + 1).padStart(2, '0') + ' - ' + safeName(newTitle || 'chapter') + ' ' + n;
  }
  const srcFolder = await kapi.join(srcD, 'Chapters', entry.folderName);
  const dstFolder = await kapi.join(dstD, 'Chapters', folderName);
  if (move) {
    await closeTabsUnder(srcFolder); await kapi.mkdir(await kapi.join(dstD, 'Chapters')); await kapi.move(srcFolder, dstFolder);
    await moveSnapshots(srcFolder, dstFolder);           // [alpha.156] ประวัติเวอร์ชันของทุกฉากตามบทไปด้วย
  } else {
    // [alpha.159 · M2] คัดลอกก็ต้องได้ "ของล่าสุด" — บันทึกแท็บที่ค้างของบทนี้ก่อนก๊อปไฟล์
    await saveTabsUnder(srcFolder);
    if (await kapi.exists(srcFolder)) await copyTree(srcFolder, dstFolder);
    else await kapi.mkdir(dstFolder);
  }

  // ══ [alpha.159 · M2] ★ อ่านแถวฉาก "หลัง" ปิด/บันทึกแท็บ แล้วเขียนทุกไฟล์ผ่านคิว (อ่านสด) ══
  // เดิมอ่าน scenes.json ไว้ก่อน closeTabsUnder() → การบันทึกแท็บอัปเดต wordCount ลงไฟล์ →
  // แล้วโค้ดนี้เขียนก้อนเก่าทับทั้งไฟล์ = จำนวนคำ (และอะไรก็ตามที่เปลี่ยนระหว่างนั้น) เด้งกลับ
  const rows = (((await readJson(ssf, { chapters: {} })).chapters) || {})[chGuid] || [];
  let newRows;
  if (move) newRows = rows.map((r) => ({ ...r, chapterGuid: newGuid }));
  else {
    const map = {};
    newRows = rows.map((r) => { const id = guid(); map[r.id] = id; return { ...r, id, chapterGuid: newGuid }; });
    for (const r of newRows) if (Array.isArray(r.choices))
      r.choices = r.choices.map((c) => (c && map[c.nextSceneId] ? { ...c, nextSceneId: map[c.nextSceneId] } : c));
  }
  const newEntry = { ...entry, guid: newGuid, title: newTitle, folderName };
  if (!move) delete newEntry.locked;
  if (move && !same) {
    await mutateJson(kapi, sdf, (d) => { d.chapters = (d.chapters || []).filter((c) => c.guid !== chGuid); });
    await mutateJson(kapi, ssf, (sc) => { if (!sc.chapters || !(chGuid in sc.chapters)) return false; delete sc.chapters[chGuid]; });
  }
  await mutateJson(kapi, ddf, (d) => {
    const list = sortByOrder(d.chapters);
    let at2 = afterGuid ? list.findIndex((c) => c.guid === afterGuid) + 1 : list.length;
    if (at2 <= 0 && afterGuid) at2 = list.length;
    list.splice(at2, 0, newEntry);
    d.chapters = list.map((c, k) => ({ ...c, order: k + 1 }));
  }, { fallback: { chapters: [] } });
  await mutateJson(kapi, dsf, (sc) => { sc.chapters = { ...(sc.chapters || {}), [newGuid]: newRows }; },
                   { fallback: { chapters: {} } });
  return newEntry;
}

/** [alpha.159 · M2] บันทึกแท็บที่ค้างของไฟล์ใต้โฟลเดอร์ (ไม่ปิด) — ก่อนคัดลอกให้ได้ของล่าสุด */
async function saveTabsUnder(dir) {
  const k = String(dir || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() + '/';
  const { saveTab } = await import('./app.js');
  for (const t2 of state.tabs.values()) {
    const f = String(t2.file || '').replace(/\\/g, '/').toLowerCase();
    if (t2.dirty && f.startsWith(k)) { try { await saveTab(t2); } catch {} }
  }
}

export async function duplicateChapter(dPath, ch) {
  const d = await readJson(await kapi.join(dPath, 'draft.json'), { chapters: [] });
  const title = copyName(ch.title || '', (d.chapters || []).map((c) => c.title));
  const ne = await copyChapterTo(dPath, ch.guid, dPath, { afterGuid: ch.guid, title });
  await buildTree(); refreshNetwork();
  if (ne) setStatus(tf('ui.treeAct.duplicatedChapter', ne.title));
  return ne;
}

/** เมนู "ย้ายไป ▸" ของบท — ทุกฉบับร่างของทุกเล่ม ยกเว้นที่อยู่ปัจจุบัน */
export async function moveChapterMenu(e, dPath, ch) {
  const targets = (await allDrafts()).filter((d) => d.dPath !== dPath);
  if (!targets.length) { setStatus(t('ui.treeAct.noOtherBook')); return; }
  popupMenu(e.clientX, e.clientY, targets.map((d) => ({
    text: d.title + (d.multi ? ' / ' + d.draft : ''),
    click: async () => {
      const ne = await copyChapterTo(dPath, ch.guid, d.dPath, { move: true });
      await buildTree(); refreshNetwork();
      if (ne) setStatus(tf('ui.treeAct.movedChapter', ne.title, d.title));
    },
  })));
}

export async function bookFromChapter(dPath, ch) {
  const name = await ask(t('ui.treeAct.bookFromChapterAsk'), { value: ch.title || '' });
  if (!name) return '';
  const secDir = await addSection(name);
  if (!secDir) return '';
  const dstD = await kapi.join(secDir, 'Draft', 'default');
  // addSection สร้าง "บทที่หนึ่ง" เปล่าไว้ให้ — เล่มนี้เกิดจากบทที่เลือก จึงเอาบทเปล่านั้นออก
  const df = await kapi.join(dstD, 'draft.json');
  const draft = await readJson(df, { chapters: [] });
  for (const c of draft.chapters || []) {
    const folder = await kapi.join(dstD, 'Chapters', c.folderName);
    if (!(await kapi.listFiles(folder, '').catch(() => [])).length) await kapi.remove(folder).catch(() => {});
  }
  await writeJson(df, { ...draft, chapters: [] });
  await writeJson(await kapi.join(dstD, 'scenes.json'), { chapters: {} });
  await copyChapterTo(dPath, ch.guid, dstD, { move: true });
  await buildTree(); refreshNetwork();
  setStatus(tf('ui.treeAct.bookFromChapterDone', name));
  return secDir;
}

// ═══════════════════ ฉาก ═══════════════════
export async function reorderScenePrompt(dPath, ch, sc) {
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await readJson(sf, { chapters: {} });
  const list = sortByOrder((d.chapters || {})[ch.guid]);
  const i = list.findIndex((x) => x.id === sc.id);
  if (i < 0) return false;
  const v = await ask(tf('ui.treeAct.positionAsk', list.length), { value: String(i + 1) });
  if (v === null || v === '') return false;
  await mutateJson(kapi, sf, (fresh) => {                    // [alpha.159 · M1] ของสดหลังกล่องถาม
    const l2 = sortByOrder((fresh.chapters || {})[ch.guid]);
    const j = l2.findIndex((x) => x.id === sc.id);
    if (j < 0) return false;
    fresh.chapters[ch.guid] = moveToPosition(l2, j, v).map((x, k) => ({ ...x, order: k + 1 }));
  });
  await buildTree();
  setStatus(t('ui.treeAct.reordered'));
  return true;
}

/** @param {Array<{dPath, ch, sc}>} items ฉากที่เลือก (ต้องอยู่ฉบับร่างเดียวกับบทต้นทาง) */
export async function chapterFromScenes(dPath, ch, items) {
  const list = (items || []).filter((it) => it && it.sc);
  const same = list.filter((it) => it.dPath === dPath);
  if (!same.length) return null;
  const name = await ask(t('ui.treeAct.chapterFromScenesAsk'), { value: same[0].sc.title || '' });
  if (!name) return null;
  const newCh = await addChapter(dPath, name);
  if (!newCh) return null;
  // บทใหม่ไปอยู่ต่อจากบทต้นทาง (addChapter ต่อท้ายฉบับร่าง)
  const df = await kapi.join(dPath, 'draft.json');
  await mutateJson(kapi, df, (fresh) => {                    // [alpha.159 · M1]
    const sorted = sortByOrder(fresh.chapters);
    const from = sorted.findIndex((c) => c.guid === newCh.guid);
    const anchor = sorted.findIndex((c) => c.guid === ch.guid);
    if (from < 0 || anchor < 0) return false;
    fresh.chapters = moveToPosition(sorted, from, anchor + 2).map((c, k) => ({ ...c, order: k + 1 }));
  });
  for (const it of same) await moveSceneToChapter(dPath, it.ch, { id: it.sc.id }, newCh);
  await buildTree();
  const skipped = list.length - same.length;
  setStatus(tf('ui.treeAct.chapterFromScenesDone', name, same.length)
            + (skipped ? ' · ' + tf('ui.treeAct.crossDraftSkipped', skipped) : ''));
  return newCh;
}

// ═══════════════════ Memo (Memos/*.md) ═══════════════════
export async function readMemo(file) {
  try { return parseMdFile(await kapi.readFile(file)); } catch { return { meta: {}, body: '' }; }
}

/** แก้ frontmatter ของ memo · ธงเก็บเป็นข้อความ 'true' แบบเดียวกับล็อกของฉาก */
export async function setMemoFields(file, patch) {
  const { meta, body } = await readMemo(file);
  for (const [k, v] of Object.entries(patch || {})) {
    if (k === 'flag' || k === 'locked') { if (v) meta[k] = 'true'; else delete meta[k]; continue; }
    if (k === 'tags') { const arr = Array.isArray(v) ? v : String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (arr.length) meta.tags = arr; else delete meta.tags; continue; }
    if (v === '' || v === null || v === undefined) delete meta[k]; else meta[k] = v;
  }
  await kapi.writeFile(file, dumpMdFile(meta, body));
  const tab = state.tabs.get(file);
  if (tab) {
    tab.meta = { ...(tab.meta || {}), ...meta };
    if ('title' in (patch || {}) && patch.title) {
      tab.title = patch.title;
      const tt0 = tab.tabBtn && tab.tabBtn.querySelector('.tab-title');
      if (tt0) tt0.textContent = (tab.dirty ? gi('dot') + ' ' : '') + patch.title;
    }
    if ('locked' in (patch || {})) { tab.locked = !!patch.locked; try { applyLockToTab(tab); } catch {} }
  }
  await buildTree();
  return meta;
}

const memoFlag = (v) => v === true || v === 'true';
export const isMemoFlag = memoFlag;

/** memo ทั้งหมดตามลำดับที่ผู้ใช้จัด (order ใน frontmatter) — ไม่มี order = ต่อท้ายตามชื่อไฟล์ */
export async function listMemos() {
  const dir = await kapi.join(state.root, 'Memos');
  const out = [];
  for (const f of await kapi.listFiles(dir, '.md').catch(() => [])) {
    const p = await kapi.join(dir, f);
    const { meta } = await readMemo(p);
    out.push({ f, p, meta, title: meta.title || f.replace(/\.md$/i, ''), order: Number(meta.order) || 0 });
  }
  return out.sort((a, b) => ((a.order || 1e9) - (b.order || 1e9)) || a.f.localeCompare(b.f));
}

export async function moveMemoStep(file, dir) {
  const list = await listMemos();
  const i = list.findIndex((m) => m.p === file);
  const to = stepIndex(list.length, i, dir);
  if (to < 0) { setStatus(t('ui.treeAct.memoMovedEdge')); return false; }
  const next = moveToPosition(list, i, to + 1);
  for (let k = 0; k < next.length; k++) {
    if (next[k].order === k + 1) continue;
    const { meta, body } = await readMemo(next[k].p);
    meta.order = k + 1;
    await kapi.writeFile(next[k].p, dumpMdFile(meta, body));
  }
  await buildTree();
  return true;
}

async function writeMemoCopy(srcFile, title) {
  const dir = await kapi.join(state.root, 'Memos');
  await kapi.mkdir(dir);
  const { meta, body } = await readMemo(srcFile);
  const dst = await kapi.join(dir, safeName(title) + '-' + Date.now().toString(36) + '.md');
  const m = { ...meta, title, type: 'memo' };
  delete m.locked; delete m.order;
  await kapi.writeFile(dst, dumpMdFile(m, body));
  return dst;
}

export async function duplicateMemo(file) {
  const list = await listMemos();
  const { meta } = await readMemo(file);
  const title = copyName(meta.title || file.split(/[\\/]/).pop().replace(/\.md$/i, ''), list.map((m) => m.title));
  const dst = await writeMemoCopy(file, title);
  await buildTree();
  setStatus(tf('ui.treeAct.duplicated', title));
  return dst;
}

export async function sceneFromMemo(file, dst) {
  if (!dst || !dst.dPath || !dst.chapter) return null;
  const { meta, body } = await readMemo(file);
  const title = meta.title || file.split(/[\\/]/).pop().replace(/\.md$/i, '');
  const m = { ...meta, title, type: 'scene' };
  for (const k of ['order', 'flag', 'locked', 'color', 'status']) delete m[k];
  const r = await addScene(dst.dPath, dst.chapter, title, { body, meta: m });
  if (r) setStatus(tf('ui.treeAct.sceneFromMemoDone', title));
  return r;
}

// ═══════════════════ คลิปบอร์ดของต้นไม้ (บท · memo · รูป · กระดาน · แผน) ═══════════════════
// ฉากใช้ treeClip เดิมใน app.js (เลือกหลายแถว · Ctrl+C/V) — ที่นี่เก็บชนิดที่เหลือ
const CLIP = { kind: '', item: null };
export function clipCopy(kind, item, title) {
  CLIP.kind = kind; CLIP.item = item;
  setStatus(tf('ui.treeAct.copied', title || ''));
}
export function clipOf(kind) { return CLIP.kind === kind ? CLIP.item : null; }

export async function pasteChapter(dPath, afterCh) {
  const it = clipOf('chapter');
  if (!it) { setStatus(t('ui.treeAct.clipEmpty')); return null; }
  const d = await readJson(await kapi.join(dPath, 'draft.json'), { chapters: [] });
  const title = it.dPath === dPath ? copyName(it.title || '', (d.chapters || []).map((c) => c.title)) : it.title;
  const ne = await copyChapterTo(it.dPath, it.guid, dPath, { afterGuid: afterCh ? afterCh.guid : null, title });
  await buildTree(); refreshNetwork();
  if (ne) setStatus(tf('ui.treeAct.pasted', ne.title));
  return ne;
}

export async function pasteMemo() {
  const it = clipOf('memo');
  if (!it) { setStatus(t('ui.treeAct.clipEmpty')); return null; }
  if (!(await kapi.exists(it.file))) { setStatus(t('ui.treeAct.clipEmpty')); return null; }
  const list = await listMemos();
  const dst = await writeMemoCopy(it.file, copyName(it.title || 'memo', list.map((m) => m.title)));
  await buildTree();
  setStatus(tf('ui.treeAct.pasted', it.title || ''));
  return dst;
}

// ═══════════════════ รูปในคลัง ═══════════════════
async function albumCore() { return import('./gallery/album-core.js'); }

/** @param {{path:string, file:string, album:string}} im แถวรูปจาก album-core */
export async function setImageFields(im, patch) {
  const AC = await albumCore();
  const doc = await AC.readAlbumDoc(kapi, state.root, im.album);
  const p = {};
  if ('caption' in patch) p.caption = String(patch.caption || '');
  if ('tags' in patch) p.tags = (Array.isArray(patch.tags) ? patch.tags : String(patch.tags || '').split(','))
    .map((x) => String(x).trim()).filter(Boolean);
  await AC.writeAlbumDoc(kapi, state.root, im.album, AC.setImageMeta(doc, im.file, p));
  await AC.syncFlatIndex(kapi, state.root);
  await buildTree();
}

export async function renameImage(abs, im) {
  const ext = (im.file.match(/\.[^.]+$/) || [''])[0];
  let v = await ask(t('ui.treeAct.renameImageAsk'), { value: im.file });
  if (!v || v === im.file) return null;
  v = safeName(v);
  if (!/\.[^.]+$/.test(v)) v += ext;
  const dir = abs.replace(/[\\/][^\\/]+$/, '');
  const dst = await kapi.join(dir, v);
  if (await kapi.exists(dst)) { setStatus(t('ui.treeAct.nameTaken')); return null; }
  await kapi.move(abs, dst);
  const AC = await albumCore();
  const doc = await AC.readAlbumDoc(kapi, state.root, im.album);
  const meta = (doc.images || {})[im.file];
  let next = AC.removeImageMeta(doc, im.file);
  if (meta) next = AC.setImageMeta(next, v, meta);
  await AC.writeAlbumDoc(kapi, state.root, im.album, next);
  await AC.syncFlatIndex(kapi, state.root);
  // ลิงก์ ![](…) ในทุกฉากที่ใช้รูปนี้ต้องตามชื่อใหม่ (ตัวเดียวกับที่คลังรูปใช้ตอนย้ายอัลบั้ม)
  const newRel = im.path.replace(/[^/]+$/, v);
  let fixed = 0;
  try {
    const UI = await import('./gallery/usage-index.js');
    const { index } = await UI.scanUsage(kapi, state.root);
    fixed = await UI.applyRefRewrite(kapi, index, im.path, newRel);
  } catch (e) { log('warn', 'renameImage: ref rewrite failed', e); }
  await saveExplorer(IM.renameItemPath(explorer(), 'Images/' + im.path, 'Images/' + newRel));
  await buildTree();
  setStatus(tf('ui.treeAct.renamedImage', v, fixed));
  return dst;
}

/** วางสำเนารูปลงอัลบั้ม (copyInto ตั้งชื่อไม่ชนให้เอง) + พาคำบรรยาย/แท็กไปด้วย */
export async function copyImageInto(srcAbs, srcIm, albumId) {
  const AC = await albumCore();
  const dir = await AC.albumDir(kapi, state.root, albumId);
  const name = await kapi.copyInto(srcAbs, dir);
  await AC.getAlbumImages(kapi, state.root, albumId);          // ซิงก์ album.json ให้รู้จักไฟล์ใหม่
  if (srcIm) {
    const doc = await AC.readAlbumDoc(kapi, state.root, albumId);
    await AC.writeAlbumDoc(kapi, state.root, albumId,
      AC.setImageMeta(doc, name, { caption: srcIm.caption || '', tags: srcIm.tags || [] }));
  }
  await AC.syncFlatIndex(kapi, state.root);
  await buildTree();
  return name;
}

export async function pasteImage(albumId) {
  const it = clipOf('image');
  if (!it || !(await kapi.exists(it.abs))) { setStatus(t('ui.treeAct.clipEmpty')); return null; }
  const name = await copyImageInto(it.abs, it.im, albumId);
  setStatus(tf('ui.treeAct.pasted', name));
  return name;
}

// ═══════════════════ กระดาน · แผนแตกสาย (คุณสมบัติอยู่ใน explorer meta) ═══════════════════
export async function itemMeta(abs) { return IM.getItemMeta(explorer(), await relOf(abs)); }

export async function setItemFields(abs, patch) {
  await saveExplorer(IM.setItemMeta(explorer(), await relOf(abs), patch));
  await buildTree();
}

/** ไฟล์เปลี่ยนชื่อ/ย้าย (กระดาน · แผน · memo · รูป) → คุณสมบัติ + หมุดตามไป */
export async function explorerRenamed(oldAbs, newAbs) {
  if (!oldAbs || !newAbs) return;
  await saveExplorer(IM.renameItemPath(explorer(), await relOf(oldAbs), await relOf(newAbs)));
}
export async function explorerForget(abs) {
  if (!abs) return;
  await saveExplorer(IM.forgetItemPath(explorer(), await relOf(abs)));
}

/** ล็อกของไฟล์กระดาน/แผน (อ่านได้จากโมดูลอื่นโดยไม่ต้อง import app.js) */
export async function isItemLocked(abs) { return !!(await itemMeta(abs)).locked; }

export async function copyJsonFile(srcAbs, dirAbs, name, patchData) {
  await kapi.mkdir(dirAbs);
  const safe = safeName(name).replace(/[\\/:*?"<>|]/g, '_');
  let dst = await kapi.join(dirAbs, safe + '.json');
  for (let n = 2; await kapi.exists(dst); n++) dst = await kapi.join(dirAbs, safe + ' ' + n + '.json');
  let data = await readJson(srcAbs, null);
  if (!data) data = JSON.parse(await kapi.readFile(srcAbs));
  if (patchData) data = patchData(data);
  await writeJson(dst, data);
  return dst;
}

export async function duplicatePlan(path) {
  const { listBranchPlans } = await import('./branching-ui.js');
  const plans = await listBranchPlans();
  const cur = plans.find((p) => p.path === path);
  const name = copyName(cur ? cur.name : 'plan', plans.map((p) => p.name));
  const dst = await copyJsonFile(path, await kapi.join(state.root, 'Branches'), name, (d) => ({ ...d, name }));
  await buildTree();
  setStatus(tf('ui.treeAct.duplicated', name));
  return dst;
}

/** สี/สถานะของแผนอยู่ในไฟล์แผนเอง (ชุดเดียวกับที่หน้าต่างคุณสมบัติแผนแก้) */
export async function setPlanFileFields(path, patch) {
  const data = await readJson(path, null);
  if (!data) return false;
  const m = await import('./branching-ui.js');
  const cur = m.currentBranchPlan();
  for (const k of ['color', 'status', 'note', 'tags']) {
    if (!(k in patch)) continue;
    data[k] = patch[k];
    if (cur && cur.path === path && cur.live) {
      cur.live[k] = patch[k];
      if (cur.saved) cur.saved[k] = patch[k];       // แก้จาก Explorer = บันทึกลงไฟล์แล้ว ไม่ใช่งานค้าง
    }
  }
  await writeJson(path, data);
  await buildTree();
  return true;
}

// ═══════════════════ หมุด ═══════════════════
export function pinned(kind, key) { return IM.isPinned(explorer(), kind, key); }

export async function togglePinItem(kind, key, info) {
  const was = pinned(kind, key);
  await saveExplorer(IM.togglePin(explorer(), kind, key, { ...(info || {}), at: Date.now() }));
  await buildTree();
  setStatus(tf(was ? 'ui.treeAct.pinOff' : 'ui.treeAct.pinOn', (info && info.title) || ''));
  return !was;
}

/**
 * หาของจริงของหมุดแต่ละอัน · `target = null` = หาไม่เจอแล้ว (ถูกลบ/ย้ายออกนอกโปรเจกต์)
 * @returns {Promise<Array<{pin, target}>>}
 */
export async function resolvePins() {
  const out = [];
  const secs = await listSections().catch(() => []);
  for (const pin of explorer().pins) {
    let target = null;
    try {
      if (pin.kind === 'book') {
        const s = secs.find((x) => (x.meta.guid || x.folder) === pin.key);
        if (s) target = { secPath: s.secPath, title: s.title };
      } else if (pin.kind === 'chapter' || pin.kind === 'scene') {
        const dPaths = pin.dRel ? [await kapi.join(state.root, ...pin.dRel.split('/'))] : [];
        for (const d of await allDrafts()) if (!dPaths.includes(d.dPath)) dPaths.push(d.dPath);
        for (const dPath of dPaths) {
          const draft = await readJson(await kapi.join(dPath, 'draft.json'), null);
          if (!draft) continue;
          if (pin.kind === 'chapter') {
            const ch = (draft.chapters || []).find((c) => c.guid === pin.key);
            if (ch) { target = { dPath, ch, title: ch.title }; break; }
          } else {
            const sj = await readJson(await kapi.join(dPath, 'scenes.json'), { chapters: {} });
            for (const ch of draft.chapters || []) {
              const sc = ((sj.chapters || {})[ch.guid] || []).find((r) => r.id === pin.key);
              if (sc) { target = { dPath, ch, sc, title: sc.title,
                                   file: await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName) }; break; }
            }
            if (target) break;
          }
        }
      } else {
        const abs = await kapi.join(state.root, ...pin.key.split('/'));
        if (await kapi.exists(abs)) target = { abs, title: pin.title || abs.split(/[\\/]/).pop() };
      }
    } catch (e) { log('warn', 'resolvePins', e); }
    out.push({ pin, target });
  }
  return out;
}

// ═══════════════════ backup รายชิ้น ═══════════════════
// ผู้ใช้: "สำรองทั้งชิ้น เลือกกู้ได้" — คนละเรื่องกับ Save version (เวอร์ชันของเนื้อความ)
// ชุดสำรอง = Backups/Items/<ชนิด>/<กุญแจ>/<เวลา>/{item.json, payload/…}

/** กุญแจของชิ้น (ตัวเดียวกับที่ใช้หาชุดสำรองตอนกู้) */
export function backupKey(kind, ctx) {
  if (kind === 'book') return ctx.sec && ctx.sec.guid ? ctx.sec.guid : String(ctx.secPath || '').split(/[\\/]/).pop();
  if (kind === 'chapter') return ctx.ch.guid;
  if (kind === 'scene') return ctx.sc.id;
  return String(ctx.file || '').split(/[\\/]/).pop();
}

async function backupRoot(kind, ctx) {
  return kapi.join(state.root, ...IM.itemBackupDir(kind, backupKey(kind, ctx)).split('/'));
}

export async function backupItem(kind, ctx) {
  const title = ctx.title || '';
  try {
    const dir = await kapi.join(await backupRoot(kind, ctx), IM.backupStamp());
    const payload = await kapi.join(dir, 'payload');
    const info = { kind, title, created: new Date().toISOString() };
    if (kind === 'book') {
      await closeTabsUnder(ctx.secPath, { save: true }).catch(() => {});
      await copyTree(ctx.secPath, payload);
      info.folder = ctx.secPath.split(/[\\/]/).pop();
    } else if (kind === 'chapter') {
      const folder = await kapi.join(ctx.dPath, 'Chapters', ctx.ch.folderName);
      // [alpha.156] เทียบแบบมีตัวคั่น — "01 - บท" ต้องไม่ไปจับแท็บของ "01 - บทสอง"
      const fk = pathKey(folder) + '/';
      for (const [f, tab] of [...state.tabs.entries()]) {
        if (typeof f === 'string' && pathKey(f).startsWith(fk) && tab.dirty) await saveTab(tab);
      }
      await copyTree(folder, payload);
      const d = await readJson(await kapi.join(ctx.dPath, 'draft.json'), { chapters: [] });
      const s = await readJson(await kapi.join(ctx.dPath, 'scenes.json'), { chapters: {} });
      info.entry = (d.chapters || []).find((c) => c.guid === ctx.ch.guid) || ctx.ch;
      info.rows = (s.chapters || {})[ctx.ch.guid] || [];
    } else if (kind === 'scene') {
      const tab = state.tabs.get(ctx.file);
      if (tab && tab.dirty) await saveTab(tab);
      await kapi.copyFile(ctx.file, await kapi.join(payload, ctx.sc.fileName));
      const vis = ctx.file.replace(/\.md$/i, '_vis.csv');
      if (await kapi.exists(vis)) await kapi.copyFile(vis, await kapi.join(payload, vis.split(/[\\/]/).pop()));
      const s = await readJson(await kapi.join(ctx.dPath, 'scenes.json'), { chapters: {} });
      info.row = ((s.chapters || {})[ctx.ch.guid] || []).find((r) => r.id === ctx.sc.id) || ctx.sc;
      info.chGuid = ctx.ch.guid;
    } else if (kind === 'memo') {
      const tab = state.tabs.get(ctx.file);
      if (tab && tab.dirty) await saveTab(tab);
      await kapi.copyFile(ctx.file, await kapi.join(payload, ctx.file.split(/[\\/]/).pop()));
    } else return false;
    await writeJson(await kapi.join(dir, 'item.json'), info);
    logAction('backup', tf('ui.treeAct.backupDone', title), { kind, dir });
    setStatus(tf('ui.treeAct.backupDone', title));
    return dir;
  } catch (e) {
    log('error', t('ui.treeAct.backupFail'), e);
    setStatus(t('ui.treeAct.backupFail'));
    return false;
  }
}

export async function listItemBackups(kind, ctx) {
  const root = await backupRoot(kind, ctx);
  if (!(await kapi.exists(root))) return [];
  const names = IM.sortBackups(await kapi.listDirs(root).catch(() => []));
  const out = [];
  for (const n of names) out.push({ name: n, dir: await kapi.join(root, n), ts: IM.parseBackupStamp(n) });
  return out;
}

const fmtLocal = (ms) => { try { return new Date(ms).toLocaleString(); } catch { return String(ms); } };

/** เมนูเลือกชุดสำรอง → ยืนยัน → กู้ (ของปัจจุบันลงถังขยะก่อน) */
export async function restoreItemMenu(e, kind, ctx) {
  const list = await listItemBackups(kind, ctx);
  if (!list.length) { setStatus(tf('ui.treeAct.noBackups', ctx.title || '')); return; }
  popupMenu(e.clientX, e.clientY, [
    { label: t('ui.treeAct.restorePick'), disabled: true },
    '-',
    ...list.slice(0, 20).map((b) => ({ text: fmtLocal(b.ts), click: () => restoreItem(kind, ctx, b) })),
  ]);
}

export async function restoreItem(kind, ctx, backup) {
  const title = ctx.title || '';
  if (!(await confirmBox(tf('ui.treeAct.restoreConfirm', title, fmtLocal(backup.ts)), t('ui.treeAct.restoreBtn')))) return false;
  const payload = await kapi.join(backup.dir, 'payload');
  const info = await readJson(await kapi.join(backup.dir, 'item.json'), {});
  try {
    if (kind === 'book') {
      await closeTabsUnder(ctx.secPath, { save: false });
      await moveToRecycle(ctx.secPath);
      await copyTree(payload, ctx.secPath);
    } else if (kind === 'chapter') {
      const folder = await kapi.join(ctx.dPath, 'Chapters', ctx.ch.folderName);
      await closeTabsUnder(folder, { save: false });
      await moveToRecycle(folder);
      await copyTree(payload, folder);
      const df = await kapi.join(ctx.dPath, 'draft.json'), sf = await kapi.join(ctx.dPath, 'scenes.json');
      const entry = { ...(info.entry || ctx.ch), folderName: ctx.ch.folderName };
      // [alpha.159 · M1] ทะเบียนแก้ผ่านคิว (อ่านสด)
      await mutateJson(kapi, df, (d) => {
        const i = (d.chapters || []).findIndex((c) => c.guid === ctx.ch.guid);
        if (i >= 0) d.chapters[i] = { ...entry, order: d.chapters[i].order };
        else d.chapters = [...(d.chapters || []), { ...entry, order: (d.chapters || []).length + 1 }];
      }, { fallback: { chapters: [] } });
      await mutateJson(kapi, sf, (sc) => { sc.chapters = { ...(sc.chapters || {}), [ctx.ch.guid]: info.rows || [] }; },
                       { fallback: { chapters: {} } });
    } else if (kind === 'scene') {
      await closeTabsUnder(ctx.file, { save: false });
      await moveToRecycle(ctx.file);
      await kapi.copyFile(await kapi.join(payload, ctx.sc.fileName), ctx.file);
      const visName = ctx.sc.fileName.replace(/\.md$/i, '_vis.csv');
      if (await kapi.exists(await kapi.join(payload, visName)))
        await kapi.copyFile(await kapi.join(payload, visName), ctx.file.replace(/\.md$/i, '_vis.csv'));
      const sf = await kapi.join(ctx.dPath, 'scenes.json');
      const row = { ...(info.row || ctx.sc), id: ctx.sc.id, fileName: ctx.sc.fileName, chapterGuid: ctx.ch.guid };
      await mutateJson(kapi, sf, (sc) => {                       // [alpha.159 · M1]
        const rows = (sc.chapters || {})[ctx.ch.guid] || [];
        const i = rows.findIndex((r) => r.id === ctx.sc.id);
        if (i >= 0) rows[i] = { ...row, order: rows[i].order }; else rows.push({ ...row, order: rows.length + 1 });
        sc.chapters = { ...(sc.chapters || {}), [ctx.ch.guid]: rows };
      }, { fallback: { chapters: {} } });
    } else if (kind === 'memo') {
      await closeTabsUnder(ctx.file, { save: false });
      await moveToRecycle(ctx.file);
      await kapi.copyFile(await kapi.join(payload, ctx.file.split(/[\\/]/).pop()), ctx.file);
    } else return false;
    logAction('backup', tf('ui.treeAct.restoreDone', title), { kind, from: backup.dir });
    await buildTree(); refreshNetwork();
    setStatus(tf('ui.treeAct.restoreDone', title));
    return true;
  } catch (err) {
    log('error', t('ui.treeAct.restoreFail'), err);
    setStatus(t('ui.treeAct.restoreFail'));
    await buildTree();
    return false;
  }
}

// ═══════════════════ คุณสมบัติ: หน้าต่าง + แผง (ชุดช่องเดียวกัน) ═══════════════════
// เล่ม/บท/แผนมีหน้าต่างคุณสมบัติเต็มของตัวเองอยู่แล้ว (sectionProps · chapterProps · planPropsDialog)
// ชุดนี้ใช้กับ memo · รูป · กระดาน (หน้าต่าง) และทุกชนิดที่ไม่ใช่ฉาก (แผง)

/** นิยามช่องต่อชนิด — `key` = ชื่อช่องที่ read/write ใช้ */
export async function itemFieldDefs(kind) {
  const F = (key, type, label, options) => ({ key, type, label: t(label), options });
  const color = F('color', 'color', 'ui.treeAct.fColor');
  const flag = F('flag', 'check', 'ui.treeAct.fFlag');
  const locked = F('locked', 'check', 'ui.treeAct.fLocked');
  const withBlank = (opts) => [['', t('ui.treeAct.clearStatus')], ...opts];
  switch (kind) {
    case 'book': return [F('title', 'text', 'ui.treeAct.fTitle'), F('status', 'select', 'ui.treeAct.fStatus', bookStatusOptions()),
                         color, flag, locked, F('blurb', 'textarea', 'ui.treeAct.fBlurb')];
    case 'chapter': return [F('title', 'text', 'ui.treeAct.fTitle'), F('status', 'select', 'ui.treeAct.fStatus', withBlank(sceneStatusOptions())),
                            color, flag, locked, F('act', 'text', 'ui.treeAct.fAct'), F('date', 'text', 'ui.treeAct.fDate'),
                            F('note', 'textarea', 'ui.treeAct.fNote')];
    case 'memo': return [F('title', 'text', 'ui.treeAct.fTitle'), F('status', 'select', 'ui.treeAct.fStatus', withBlank(sceneStatusOptions())),
                         color, flag, locked, F('tags', 'text', 'ui.treeAct.fTags')];
    case 'image': return [F('caption', 'text', 'ui.treeAct.fCaption'), F('tags', 'text', 'ui.treeAct.fTags')];
    case 'board': return [F('status', 'select', 'ui.treeAct.fStatus', withBlank(sceneStatusOptions())), color, flag, locked,
                          F('note', 'textarea', 'ui.treeAct.fNote')];
    case 'plan': return [F('status', 'select', 'ui.treeAct.fStatus', await planStatusOptions()), color, flag, locked,
                         F('tags', 'text', 'ui.treeAct.fTags'), F('note', 'textarea', 'ui.treeAct.fNote')];
    default: return [];
  }
}

/** ค่าปัจจุบันของทุกช่อง */
export async function readItemValues(kind, ctx) {
  if (kind === 'book') {
    const s = await readSection(ctx.secPath);
    return { title: s.title || '', status: s.status || 'outline', color: s.color || '', flag: !!s.flag, locked: !!s.locked, blurb: s.blurb || '' };
  }
  if (kind === 'chapter') {
    const d = await readJson(await kapi.join(ctx.dPath, 'draft.json'), { chapters: [] });
    const c = (d.chapters || []).find((x) => x.guid === ctx.ch.guid) || ctx.ch;
    return { title: c.title || '', status: c.status && c.status !== 'Outline' ? c.status : '', color: c.color || '',
             flag: !!c.isFavorite, locked: !!c.locked, act: c.act || '', date: c.date || '', note: c.note || '' };
  }
  if (kind === 'memo') {
    const { meta } = await readMemo(ctx.file);
    return { title: meta.title || '', status: meta.status || '', color: meta.color || '', flag: memoFlag(meta.flag),
             locked: memoFlag(meta.locked), tags: (Array.isArray(meta.tags) ? meta.tags : []).join(', ') };
  }
  if (kind === 'image') return { caption: ctx.im.caption || '', tags: (ctx.im.tags || []).join(', ') };
  if (kind === 'board') {
    const m = await itemMeta(ctx.path);
    return { status: m.status || '', color: m.color || '', flag: !!m.flag, locked: !!m.locked, note: m.note || '' };
  }
  if (kind === 'plan') {
    const data = await readJson(ctx.path, {});
    const m = await itemMeta(ctx.path);
    return { status: data.status || '', color: data.color || '', flag: !!m.flag, locked: !!m.locked,
             tags: (data.tags || []).join(', '), note: data.note || '' };
  }
  return {};
}

/** เขียนช่องที่เปลี่ยน · `patch` = เฉพาะช่องที่ต่างจากเดิม */
export async function writeItemValues(kind, ctx, patch) {
  if (!patch || !Object.keys(patch).length) return false;
  if (kind === 'book') {
    const p = { ...patch };
    if (p.title !== undefined && !String(p.title).trim()) delete p.title;
    await setSectionFields(ctx.secPath, p);
  } else if (kind === 'chapter') {
    const p = { ...patch };
    if ('flag' in p) { p.isFavorite = !!p.flag; delete p.flag; }
    if ('status' in p) p.status = p.status || 'Outline';
    if (p.title !== undefined && !String(p.title).trim()) delete p.title;
    await setChapterFields(ctx.dPath, ctx.ch.guid, p);
  } else if (kind === 'memo') {
    const p = { ...patch };
    if (p.title !== undefined && !String(p.title).trim()) delete p.title;
    await setMemoFields(ctx.file, p);
  } else if (kind === 'image') {
    await setImageFields(ctx.im, patch);
  } else if (kind === 'board') {
    await setItemFields(ctx.path, patch);
  } else if (kind === 'plan') {
    const filePatch = {}, metaPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'flag' || k === 'locked') metaPatch[k] = v;
      else if (k === 'tags') filePatch.tags = String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
      else filePatch[k] = v;
    }
    if (Object.keys(filePatch).length) await setPlanFileFields(ctx.path, filePatch);
    if (Object.keys(metaPatch).length) {
      await setItemFields(ctx.path, metaPatch);
      if ('locked' in metaPatch) {
        const m = await import('./branching-ui.js');
        const cur = m.currentBranchPlan();
        if (cur && cur.path === ctx.path && m.setPlanLocked) m.setPlanLocked(!!metaPatch.locked);
      }
    }
  }
  setStatus(t('ui.treeAct.saved'));
  return true;
}

function fieldInput(def, value) {
  let inp;
  if (def.type === 'textarea') { inp = el('textarea', 'wiki-input'); inp.rows = 3; inp.value = value || ''; }
  else if (def.type === 'check') { inp = el('input', 'wiki-check'); inp.type = 'checkbox'; inp.checked = !!value; }
  else if (def.type === 'select' || def.type === 'color') {
    inp = el('select', 'wiki-input k-dlg-select');
    const opts = def.type === 'color'
      ? [['', t('ui.treeAct.clearColor')], ...SCENE_COLORS.map(([n, hex]) => [hex, gi('dot') + ' ' + dataLabel(n)])]
      : (def.options || []);
    for (const [v, label] of opts) { const o = el('option', null, label); o.value = v; inp.append(o); }
    inp.value = value || '';
  } else { inp = el('input', 'wiki-input'); inp.value = value || ''; }
  return inp;
}
const valueOf = (def, inp) => (def.type === 'check' ? inp.checked : inp.value);

export async function itemPropsDialog(kind, ctx) {
  const defs = await itemFieldDefs(kind);
  const vals = await readItemValues(kind, ctx);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', tf('ui.treeAct.propsTitle', ctx.title || '')));
  const inputs = [];
  for (const def of defs) {
    const r = el('div', 'wiki-row'); r.append(el('label', null, def.label));
    const inp = fieldInput(def, vals[def.key]);
    r.append(inp); box.append(r); inputs.push([def, inp]);
  }
  return new Promise((resolve) => {
    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', null, t('ui.common.cancel'));
    const okB = el('button', 'k-ok', t('ui.common.save'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    const close = (v) => { ov.remove(); resolve(v); };
    cB.onclick = () => close(false);
    ov.onclick = (e) => { if (e.target === ov) close(false); };
    escClose(ov, () => close(false));
    okB.onclick = async () => {
      const patch = {};
      for (const [def, inp] of inputs) {
        const v = valueOf(def, inp);
        if (v !== vals[def.key]) patch[def.key] = v;
      }
      close(true);
      await writeItemValues(kind, ctx, patch);
    };
  });
}

/** วาดคุณสมบัติลงแผง — ช่องบันทึกทันทีที่เปลี่ยน (ข้อความ = ตอนออกจากช่อง) */
export async function renderItemProps(host, kind, ctx) {
  host.replaceChildren();
  const defs = await itemFieldDefs(kind);
  const vals = await readItemValues(kind, ctx);
  if (kind === 'book') {
    // [alpha.157] Logline ของเล่มในแผงคุณสมบัติ (บันทึกเมื่อออกจากช่อง)
    const tail = el('div', 'props-logline-host');
    queueMicrotask(async () => {
      const s = await readSection(ctx.secPath);
      buildLoglineFields(tail, s.logline, {
        placeholderFrom: state.meta && state.meta.logline,
        onChange: async (val) => {
          const cur = await readSection(ctx.secPath);
          const next = compactLogline(val);
          if (JSON.stringify(next || null) === JSON.stringify(cur.logline || null)) return;
          await mutateJson(kapi, await kapi.join(ctx.secPath, 'section.json'), (d) => {
            if (next) d.logline = next; else delete d.logline;
          }, { fallback: {} });
          setStatus(t('ui.logline.saved'));
        },
      });
    });
    host._loglineTail = tail;
  }
  host.append(el('div', 'props-name', tf('ui.treeAct.propsTitle', ctx.title || '')));
  for (const def of defs) {
    const r = el('div', 'props-row'); r.append(el('label', null, def.label));
    const inp = fieldInput(def, vals[def.key]);
    const commit = async () => {
      const v = valueOf(def, inp);
      if (v === vals[def.key]) return;
      vals[def.key] = v;
      await writeItemValues(kind, ctx, { [def.key]: v });
    };
    if (def.type === 'text' || def.type === 'textarea') inp.addEventListener('blur', () => commit().catch(() => {}));
    else inp.addEventListener('change', () => commit().catch(() => {}));
    r.append(inp); host.append(r);
  }
  if (host._loglineTail) { host.append(host._loglineTail); delete host._loglineTail; }
  return host;
}

// ═══════════════════ quick note ของเล่ม/บท/memo ═══════════════════
/** id ที่โน้ตผูก — ฉากใช้ id ของฉากเหมือนเดิม */
export function noteIdOf(kind, ctx) {
  if (kind === 'book') return 'book:' + backupKey('book', ctx);
  if (kind === 'chapter') return 'chapter:' + ctx.ch.guid;
  if (kind === 'memo') return 'memo:' + String(ctx.file || '').split(/[\\/]/).pop();
  return ctx.sc ? ctx.sc.id : '';
}

/** โน้ตทั้งหมดที่นับว่าเป็นของเล่ม (ของเล่มเอง + ทุกบท + ทุกฉากข้างใน) */
export async function bookNoteIds(secPath, sec) {
  const ids = new Set([noteIdOf('book', { secPath, sec })]);
  const dr = await kapi.join(secPath, 'Draft');
  for (const dn of await kapi.listDirs(dr).catch(() => [])) {
    const dPath = await kapi.join(dr, dn);
    const d = await readJson(await kapi.join(dPath, 'draft.json'), { chapters: [] });
    const s = await readJson(await kapi.join(dPath, 'scenes.json'), { chapters: {} });
    for (const c of d.chapters || []) {
      ids.add('chapter:' + c.guid);
      for (const r of (s.chapters || {})[c.guid] || []) ids.add(r.id);
    }
  }
  return ids;
}
