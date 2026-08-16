// dialogue-ui.js — [alpha.79] แผง "บทพูด" (Dialogue)
//
// รวมบทพูดทั้งผลงานไว้ที่เดียว: กรองตาม เล่ม/บท/ฉาก/ตัวละคร · คลิกกระโดดไปที่บรรทัดนั้น ·
// **แก้ได้ทันทีในแผง** แล้วเขียนกลับลงไฟล์
//
// ตรรกะการจับบทพูด/เขียนกลับอยู่ใน `dialogue-core.js` (บริสุทธิ์ · 70 checks) — ไฟล์นี้มีแต่หน้าจอ
//
// ═══ กติกาความปลอดภัยตอนแก้ ═══
// การเขียนกลับต้องไม่ทำเนื้อเรื่องหาย จึงมีสามด่าน:
//   1. `replaceDialogue()` ตรวจว่าข้อความเดิมในไฟล์ยังตรงกับที่หน้าจอถืออยู่ ไม่ตรง = ไม่เขียน
//   2. ไฟล์ที่เปิดเป็นแท็บและ **ยังไม่บันทึก** → ไม่แตะไฟล์ บอกให้บันทึกก่อน
//      (ถ้าเขียนทับตรงนั้น งานที่พิมพ์ค้างในตัวแก้ไขจะหายทันที)
//   3. เขียนเสร็จแล้วโหลดแท็บที่เปิดค้างใหม่ ให้หน้าจอกับไฟล์ตรงกันเสมอ

import { t as tt, tf as ttf } from '../i18n.js';
import { $, el, state, setStatus, log, smart } from '../core.js';
import { parseMdFile, dumpMdFile } from '../md.js';
import { listScenes, listEntities } from '../project-scan.js';
import * as DC from './dialogue-core.js';

const S = () => (state._dialogue || (state._dialogue = {
  rows: null, names: [], scenes: [],
  f: { section: '', chapter: '', scene: '', speakers: [], q: '', source: '' },
  editing: null, scanning: false, error: '',
}));

/** ล้างเมื่อปิดโปรเจกต์ (ไม่งั้นโปรเจกต์ใหม่เห็นบทพูดของเก่า) */
export function resetDialogue() { state._dialogue = null; }

/** รายชื่อตัวละครที่ใช้จับ "ใครพูด" — Wiki + ชื่อที่ SmartType เก็บจากตัวบท */
async function collectNames(root) {
  const set = new Set();
  try {
    for (const e of await listEntities(root)) {
      if (e.cat !== 'characters' && e.cat !== 'people') continue;
      if (e.name) set.add(String(e.name));
      for (const a of (e.aliases || [])) if (a) set.add(String(a));
    }
  } catch (e) { log('warn', tt('ui.dialogue.warnNames'), e); }
  // ชื่อที่พิมพ์ในบทเอง (SmartType เก็บไว้แล้ว) — ครอบคลุมตัวละครที่ยังไม่ได้ทำหน้า Wiki
  try { for (const n of (smart.titles || [])) if (n) set.add(String(n)); } catch {}
  // ชื่อยาวก่อน — กัน "สม" ไปแย่งแมตช์ใน "สมชาย"
  return [...set].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
}

/** guid ของบท → ชื่อบท (อ่านจาก draft.json ที่เดียวกับที่ Explorer ใช้) */
async function chapterTitles(draftPath) {
  const map = {};
  try {
    const dj = await kapi.readJson(await kapi.join(draftPath, 'draft.json'));
    for (const ch of (dj.chapters || [])) if (ch.guid) map[ch.guid] = ch.title || ch.folderName || ch.guid;
  } catch {}
  return map;
}

/**
 * กวาดทั้งโปรเจกต์ → รายการบทพูดพร้อมตำแหน่ง
 * เก็บ `body` ของแต่ละไฟล์ไว้ด้วย เพื่อให้ตอนแก้ไม่ต้องอ่านไฟล์ซ้ำ (และตรวจได้ว่าไฟล์เปลี่ยนไปหรือยัง)
 */
let _scanning = null;                    // กันกวาดซ้อน — เปิดแผงสองทางพร้อมกันได้ (ปุ่ม + เมนู)
export async function scanDialogue() {
  if (_scanning) return _scanning;
  _scanning = scanDialogueInner().finally(() => { _scanning = null; });
  return _scanning;
}
async function scanDialogueInner() {
  const s = S();
  if (!state.root) { s.rows = []; return s.rows; }
  s.scanning = true; s.error = '';
  try {
    const names = await collectNames(state.root);
    s.names = names;
    const scenes = await listScenes(state.root, { withText: true });
    const chTitleCache = new Map();
    const rows = [];
    const sceneList = [];
    for (const sc of scenes) {
      if (!chTitleCache.has(sc.draftPath)) chTitleCache.set(sc.draftPath, await chapterTitles(sc.draftPath));
      const chTitle = (chTitleCache.get(sc.draftPath) || {})[sc.chapterId] || sc.chapterId;
      let meta = {}, body = '';
      try { const p = parseMdFile(sc.text || ''); meta = p.meta || {}; body = p.body || ''; }
      catch { body = sc.text || ''; }
      sceneList.push({ id: sc.id, title: sc.title, section: sc.section,
                       chapterId: sc.chapterId, chapterTitle: chTitle, path: sc.path });
      const script = String(meta.format || '') === 'screenplay';
      const found = DC.extractDialogue(body, { names, script: true });
      for (const r of found) {
        rows.push({ ...r,
          section: sc.section, draft: sc.draft, chapterId: sc.chapterId, chapterTitle: chTitle,
          sceneId: sc.id, sceneTitle: sc.title, path: sc.path, isScript: script });
      }
    }
    s.rows = rows;
    s.scenes = sceneList;
  } catch (e) {
    s.rows = []; s.error = e.message || String(e);
    log('error', tt('ui.dialogue.errScan'), e);
  } finally { s.scanning = false; }
  return s.rows;
}

/** รายการที่ผ่านตัวกรองตอนนี้ */
export function visibleRows() {
  const s = S();
  return DC.filterDialogue(s.rows || [], s.f);
}

// ───────────────────────── หน้าจอ ─────────────────────────

export async function renderDialoguePanel(host) {
  const h = host || $('#dialogue-body');
  if (!h) return false;
  const s = S();
  h.replaceChildren();
  h.classList.add('k-dlgp');

  if (!state.root) {
    h.append(el('div', 'dim k-dlgp-empty', tt('ui.common.openProjectBefore')));
    return true;
  }
  if (!s.rows) {
    h.append(el('div', 'dim k-dlgp-empty', tt('ui.dialogue.scanning')));
    await scanDialogue();
    return renderDialoguePanel(h);
  }

  h.append(buildBar(h));
  const body = el('div', 'k-dlgp-list');
  h.append(body);
  drawList(body);
  return true;
}

/** แถบตัวกรองด้านบน */
function buildBar(host) {
  const s = S();
  const bar = el('div', 'k-dlgp-bar');
  const redraw = () => { const b = host.querySelector('.k-dlgp-list'); if (b) drawList(b); syncCount(); };

  // ── แถวที่ 1: ค้นหา + รีเฟรช + ส่งออก ──
  const r1 = el('div', 'k-dlgp-row');
  const q = el('input', 'k-dlgp-q'); q.type = 'search';
  q.placeholder = tt('ui.dialogue.searchPh'); q.value = s.f.q;
  q.oninput = () => { s.f.q = q.value; redraw(); };
  const refresh = el('button', 'k-dlgp-btn');
  refresh.textContent = tt('ui.common.refresh');
  refresh.title = tt('ui.dialogue.refreshHint');
  refresh.onclick = async () => {
    s.rows = null; s.editing = null;
    await renderDialoguePanel(host);
  };
  const exp = el('button', 'k-dlgp-btn');
  exp.textContent = tt('ui.dialogue.exportCsv');
  exp.onclick = () => exportCsv();
  r1.append(q, refresh, exp);
  bar.append(r1);

  // ── แถวที่ 2: เล่ม / บท / ฉาก / ที่มา ──
  const r2 = el('div', 'k-dlgp-row');
  const sections = [...new Set(s.scenes.map((x) => x.section))];
  const secSel = pick(tt('ui.dialogue.allBooks'), sections.map((x) => [x, x]), s.f.section, (v) => {
    s.f.section = v; s.f.chapter = ''; s.f.scene = '';
    rebuild();
  });

  const chapters = [];
  const seenCh = new Set();
  for (const x of s.scenes) {
    if (s.f.section && x.section !== s.f.section) continue;
    if (seenCh.has(x.chapterId)) continue;
    seenCh.add(x.chapterId); chapters.push([x.chapterId, x.chapterTitle]);
  }
  const chSel = pick(tt('ui.dialogue.allChapters'), chapters, s.f.chapter, (v) => {
    s.f.chapter = v; s.f.scene = ''; rebuild();
  });

  const scenesOpt = s.scenes
    .filter((x) => (!s.f.section || x.section === s.f.section)
                && (!s.f.chapter || x.chapterId === s.f.chapter))
    .map((x) => [x.id, x.title || x.id]);
  const scSel = pick(tt('ui.dialogue.allScenes'), scenesOpt, s.f.scene, (v) => { s.f.scene = v; redraw(); });

  const srcSel = pick(tt('ui.dialogue.allSources'), [
    [DC.SRC_PROSE, tt('ui.dialogue.srcProse')],
    [DC.SRC_SCRIPT, tt('ui.dialogue.srcScript')],
  ], s.f.source, (v) => { s.f.source = v; redraw(); });

  r2.append(secSel, chSel, scSel, srcSel);
  bar.append(r2);

  // ── แถวที่ 3: ตัวละคร (ชิปกดเลือกได้หลายคน) ──
  const chips = el('div', 'k-dlgp-chips');
  const stats = DC.speakerStats(DC.filterDialogue(s.rows, { ...s.f, speakers: null }));
  const allChip = el('button', 'k-dlgp-chip' + (s.f.speakers.length ? '' : ' on'));
  allChip.textContent = ttf('ui.dialogue.everyone', stats.reduce((n, x) => n + x.count, 0));
  allChip.onclick = () => { s.f.speakers = []; rebuild(); };
  chips.append(allChip);
  for (const st of stats) {
    const on = s.f.speakers.includes(st.speaker);
    const c = el('button', 'k-dlgp-chip' + (on ? ' on' : '') + (st.speaker ? '' : ' k-dlgp-chip-unk'));
    c.textContent = (st.speaker || tt('ui.dialogue.unknown')) + ' · ' + st.count;
    c.title = ttf('ui.dialogue.chipHint', st.count, st.words);
    c.onclick = () => {
      const i = s.f.speakers.indexOf(st.speaker);
      if (i >= 0) s.f.speakers.splice(i, 1); else s.f.speakers.push(st.speaker);
      rebuild();
    };
    chips.append(c);
  }
  bar.append(chips);

  const count = el('div', 'k-dlgp-count dim');
  bar.append(count);
  function syncCount() {
    const n = visibleRows().length;
    count.textContent = ttf('ui.dialogue.count', n, (S().rows || []).length);
  }
  syncCount();

  function rebuild() { renderDialoguePanel(host); }
  return bar;

  function pick(allLabel, opts, cur, onChange) {
    const sel = el('select', 'k-dlgp-sel');
    const o0 = el('option', null, allLabel); o0.value = ''; sel.append(o0);
    for (const [v, label] of opts) {
      const o = el('option', null, String(label)); o.value = String(v); sel.append(o);
    }
    sel.value = cur || '';
    sel.onchange = () => onChange(sel.value);
    return sel;
  }
}

/** รายการบทพูด — จัดกลุ่มตามฉาก */
function drawList(body) {
  const s = S();
  body.replaceChildren();
  if (s.error) { body.append(el('div', 'k-dlgp-empty dim', tt('ui.dialogue.errScan') + ' ' + s.error)); return; }
  const rows = visibleRows();
  if (!rows.length) {
    body.append(el('div', 'k-dlgp-empty dim',
      (s.rows || []).length ? tt('ui.dialogue.noMatch') : tt('ui.dialogue.noneFound')));
    return;
  }
  for (const g of DC.groupByScene(rows)) {
    const head = el('div', 'k-dlgp-group');
    head.append(el('span', 'k-dlgp-gsec', g.section));
    head.append(el('span', 'k-dlgp-gsep', '›'));
    head.append(el('span', 'k-dlgp-gch', g.chapterTitle || g.chapterId));
    head.append(el('span', 'k-dlgp-gsep', '›'));
    head.append(el('span', 'k-dlgp-gsc', g.sceneTitle || g.sceneId));
    head.append(el('span', 'k-dlgp-gn dim', String(g.rows.length)));
    head.onclick = () => openAt(g.rows[0]);
    body.append(head);
    for (const r of g.rows) body.append(rowEl(r));
  }
}

/** แถวบทพูดหนึ่งบรรทัด */
function rowEl(r) {
  const s = S();
  const d = el('div', 'k-dlgp-item' + (r.speaker ? '' : ' k-dlgp-item-unk'));
  d.dataset.line = String(r.line);
  d.dataset.scene = String(r.sceneId || '');

  const who = el('span', 'k-dlgp-who', r.speaker || tt('ui.dialogue.unknown'));
  who.title = whereHint(r.where);
  const ln = el('span', 'k-dlgp-line dim', ttf('ui.dialogue.lineNo', r.line + 1));
  const txt = el('span', 'k-dlgp-text', DC.preview(r.text, 300));

  const key = rowKey(r);
  if (s.editing === key) {
    const inp = el('input', 'k-dlgp-edit');
    inp.value = r.text;
    const save = async () => {
      const v = inp.value;
      s.editing = null;
      if (v !== r.text) await applyEdit(r, v);
      await refreshKeepingFilters();
    };
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); s.editing = null; refreshKeepingFilters(); }
    };
    inp.onblur = save;
    d.append(who, ln, inp);
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
    return d;
  }

  d.append(who, ln, txt);
  if (!r.closed) {
    const warn = el('span', 'k-dlgp-warn');
    warn.textContent = '⚠';
    warn.title = tt('ui.dialogue.unclosedHint');
    d.append(warn);
  }
  // คลิก = กระโดดไป · ดับเบิลคลิก = แก้ตรงนี้
  // ดับเบิลคลิกยิง click มาก่อนเสมอ → หน่วงไว้นิดแล้วยกเลิกถ้าคลิกที่สองมาทัน
  // (ไม่งั้นดับเบิลคลิกจะเด้งไปเปิดฉากทุกครั้งก่อนเข้าโหมดแก้)
  let clickT = null;
  d.onclick = () => {
    clearTimeout(clickT);
    clickT = setTimeout(() => openAt(r), 220);
  };
  d.ondblclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    clearTimeout(clickT);
    s.editing = key;
    refreshKeepingFilters();
  };
  d.title = tt('ui.dialogue.rowHint');
  return d;
}

const rowKey = (r) => [r.path, r.line, r.open].join('|');

function whereHint(where) {
  if (where === DC.WHERE_FRONT) return tt('ui.dialogue.whereFront');
  if (where === DC.WHERE_BACK) return tt('ui.dialogue.whereBack');
  if (where === DC.WHERE_TAG) return tt('ui.dialogue.whereTag');
  return tt('ui.dialogue.whereNone');
}

/** วาดใหม่โดยไม่กวาดไฟล์ซ้ำ (ตัวกรองเดิมทั้งหมด) */
async function refreshKeepingFilters() {
  const h = $('#dialogue-body');
  if (h) await renderDialoguePanel(h);
}

// ───────────────────────── กระโดดไป / แก้ ─────────────────────────

/**
 * เปิดฉากแล้วเลื่อนไปที่บทพูดนั้น
 * หา "ข้อความตรง ๆ" ในเอกสารแทนการแปลงเลขบรรทัดเป็นตำแหน่ง PM —
 * เลขบรรทัดในไฟล์ .md ไม่ตรงกับตำแหน่งในเอกสารเสมอไป (รูป/บล็อกโค้ด/hard break กินหลายบรรทัด)
 * แต่ตัวข้อความในเครื่องหมายคำพูดนั้นตรงเป๊ะเสมอ
 */
export async function openAt(r) {
  if (!r || !r.path) return false;
  const app = await import('../app.js');
  try {
    await app.openScene(r.path, r.sceneTitle || '');
  } catch (e) { setStatus(tt('ui.dialogue.errOpen') + ' ' + (e.message || e)); return false; }
  await new Promise((res) => setTimeout(res, 120));
  return selectInEditor(r.text);
}

/** เลือกข้อความในตัวแก้ไขที่เปิดอยู่ (นิยายหรือบทหนังก็ได้) */
export async function selectInEditor(needle) {
  const t = state.active;
  const view = t && ((t.sp && t.sp.view) || (t.editor && t.editor.view));
  const text = String(needle || '');
  if (!view || !text) return false;
  let hit = null;
  view.state.doc.descendants((node, pos) => {
    if (hit || !node.isText) return !hit;
    const i = node.text.indexOf(text);
    if (i >= 0) hit = { from: pos + i, to: pos + i + text.length };
    return !hit;
  });
  if (!hit) return false;
  const { TextSelection } = await import('prosemirror-state');
  view.dispatch(view.state.tr
    .setSelection(TextSelection.create(view.state.doc, hit.from, hit.to)).scrollIntoView());
  view.focus();
  return true;
}

/**
 * เขียนบทพูดที่แก้แล้วกลับลงไฟล์
 * @returns {Promise<boolean>} สำเร็จไหม (ไม่สำเร็จ = บอกเหตุผลผ่าน setStatus แล้ว)
 */
export async function applyEdit(r, next) {
  if (!r || !r.path) return false;
  const app = await import('../app.js');
  // ด่านที่ 2: ไฟล์เปิดค้างและยังไม่บันทึก → ห้ามแตะไฟล์
  const tab = state.tabs && state.tabs.get(r.path);
  if (tab && tab.dirty) {
    setStatus(tt('ui.dialogue.errDirty'));
    return false;
  }
  let raw = '';
  try { raw = await kapi.readFile(r.path); }
  catch (e) { setStatus(tt('ui.dialogue.errRead') + ' ' + (e.message || e)); return false; }
  let meta = {}, body = '';
  try { const p = parseMdFile(raw); meta = p.meta || {}; body = p.body || ''; }
  catch { body = raw; }

  // ด่านที่ 1: ข้อความเดิมต้องตรงกับที่หน้าจอถืออยู่
  const out = DC.replaceDialogue(body, r, next);
  if (out === null) {
    setStatus(tt('ui.dialogue.errStale'));
    return false;
  }
  try { await kapi.writeFile(r.path, dumpMdFile(meta, out)); }
  catch (e) { setStatus(tt('ui.dialogue.errWrite') + ' ' + (e.message || e)); return false; }

  // ด่านที่ 3: แท็บที่เปิดค้างต้องเห็นของใหม่
  try { if (tab) await app.reloadTabsFromDisk(r.path); } catch {}
  r.text = String(next == null ? '' : next).replace(/[\r\n]+/g, ' ');
  setStatus(tt('ui.dialogue.saved'));
  return true;
}

/** ส่งออกรายการที่กรองอยู่เป็น CSV */
export async function exportCsv() {
  const rows = visibleRows();
  if (!rows.length) { setStatus(tt('ui.dialogue.noneToExport')); return false; }
  const q = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = [tt('ui.dialogue.colBook'), tt('ui.dialogue.colChapter'), tt('ui.dialogue.colScene'),
                tt('ui.dialogue.colLine'), tt('ui.dialogue.colSpeaker'), tt('ui.dialogue.colText')];
  const csv = '﻿' + [head, ...rows.map((r) => [
    r.section, r.chapterTitle || r.chapterId, r.sceneTitle || r.sceneId,
    r.line + 1, r.speaker || tt('ui.dialogue.unknown'), r.text,
  ])].map((cols) => cols.map(q).join(',')).join('\n');
  try {
    const p = await kapi.saveAsDialog('dialogue.csv');
    if (!p) return false;
    await kapi.writeFile(p, csv);
    setStatus(tt('ui.dialogue.exported') + ' ' + p);
    return true;
  } catch (e) { setStatus(tt('ui.dialogue.errWrite') + ' ' + (e.message || e)); return false; }
}
