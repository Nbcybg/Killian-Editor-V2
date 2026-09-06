// scene-ops.js — จัดการฉากและบท: เพิ่ม/แก้ชื่อ/ลบ/ทำสำเนา/ย้าย/เมนูสถานะ·สี
import { t as tt, tf as ttf, t, tf } from './i18n.js';
import { buildTree, closeTab, guid, openScene, safeName, saveTab, uniqueSceneFileName, refreshNetwork } from './app.js';
import { SCENE_COLORS, SCENE_STATUSES, dataLabel, el, setStatus, state, logAction } from './core.js';
import { allStatuses } from './custom-status.js';
import { deleteToTrash } from './recycle.js';
import { ask, confirmBox, popupMenu } from './ui.js';
import { countWords, dumpMdFile, parseMdFile } from './md.js';
// [alpha.60r2 ข้อ 13] คุณสมบัติหนักของฉากอยู่ใน frontmatter — เขียนผ่านที่นี่ที่เดียว
import { SCENE_HEAVY_KEYS, writeSceneMeta } from './scene-meta.js';
// ตาราง "เล่าด้วยภาพ" เป็นไฟล์คู่ข้างฉาก (<ชื่อฉาก>_vis.csv) — ทุกที่ที่ย้าย/ลบ/ทำสำเนาฉาก
// ต้องพาไฟล์นี้ไปด้วย ไม่งั้นกลายเป็นไฟล์กำพร้าที่ผู้ใช้มองไม่เห็นแต่ยังกินที่
import { visFileName } from './visual/vis-core.js';

export async function renameScene(dPath, ch, sc) {
  const title = await ask(tt('ui.scene.nameSceneNew'), { value: sc.title }); if (!title) return;
  return setSceneTitle(dPath, ch, sc, title);
}

// ตั้งชื่อฉากโดยไม่ต้องถามผู้ใช้ — ใช้โดย "แนะนำชื่อด้วย AI" (ข้อ 78) และ renameScene
export async function setSceneTitle(dPath, ch, sc, title) {
  if (!title || title === sc.title) return;
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  for (const s of d.chapters[ch.guid] || []) if (s.id === sc.id) s.title = title;
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  const { meta, body } = parseMdFile(await kapi.readFile(file));
  meta.title = title;
  await kapi.writeFile(file, dumpMdFile(meta, body));
  const t = state.tabs.get(file);
  if (t) { t.title = title; t.tabBtn.querySelector('.tab-title').textContent = (t.dirty ? '● ' : '') + title; }
  await buildTree();
}

export async function renameChapter(dPath, ch) {
  const title = await ask(tt('ui.scene.nameChapterNew'), { value: ch.title }); if (!title) return;
  return setChapterTitle(dPath, ch, title);
}

export async function setChapterTitle(dPath, ch, title) {
  if (!title || title === ch.title) return;
  const df = await kapi.join(dPath, 'draft.json');
  const d = await kapi.readJson(df);
  for (const c of d.chapters || []) if (c.guid === ch.guid) c.title = title;
  await kapi.writeFile(df, JSON.stringify(d, null, 2));
  await buildTree();
}

/**
 * [alpha.60r3 ข้อ 3] คุณสมบัติของ "บท" — เดิมคลิกขวาบททำได้แค่เปลี่ยนชื่อ
 * ทั้งที่ `draft.json` เก็บ status/act/date/isFavorite มาตั้งแต่ v1 แล้ว (addChapter เขียนให้ทุกครั้ง)
 * แต่ไม่มี UI ไหนแก้ได้เลย → ค่าเหล่านั้นค้างเป็นค่าตั้งต้นตลอดชีพของโปรเจกต์
 * @returns {Promise<boolean>} true = บันทึกจริง
 */
export async function chapterProps(dPath, ch) {
  const df = await kapi.join(dPath, 'draft.json');
  let d;
  try { d = await kapi.readJson(df); } catch { setStatus(tt('ui.scene.readDraftJsonCant')); return false; }
  const cur = (d.chapters || []).find((c) => c.guid === ch.guid);
  if (!cur) { setStatus(tt('ui.scene.notFoundChapterDraft')); return false; }

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-chapter-props');
  box.append(el('div', 'k-dlg-title', tt('ui.scene.propsChapter') + (cur.title || '')));
  const mk = (label, val, tag = 'input') => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const i = el(tag, 'wiki-input'); i.value = val == null ? '' : String(val);
    r.append(i); box.append(r); return i;
  };
  const mkSel = (label, options, curVal) => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const s = el('select', 'wiki-input k-dlg-select');
    for (const [v, txt] of options) {
      const o = el('option', null, txt); o.value = v;
      if (v === curVal) o.selected = true;
      s.append(o);
    }
    r.append(s); box.append(r); return s;
  };
  const mkChk = (label, checked) => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const c = el('input', 'wiki-check'); c.type = 'checkbox'; c.checked = !!checked;
    r.append(c); box.append(r); return c;
  };

  const iTitle = mk(tt('ui.scene.nameChapter'), cur.title || '');
  const statuses = allStatuses();
  const iStatus = mkSel(tt('ui.common.status'), [['Outline', tt('ui.common.notSet')], ...statuses.map((s) => [s, dataLabel(s)])],
                        statuses.includes(cur.status) ? cur.status : 'Outline');
  // องก์ (Act) — ตัวเลขโรมันแบบ v1 · เลือก "อื่น ๆ" ไม่ได้ จึงใช้ช่องพิมพ์เพื่อไม่ปิดกั้นโครงเรื่องแบบอื่น
  const iAct = mk(tt('ui.scene.actAct'), cur.act || '');
  iAct.placeholder = tt('ui.scene.iIIIIIName');
  const iDate = mk(tt('ui.scene.dateDefineSend'), cur.date || '');
  iDate.placeholder = tt('ui.scene.egPage');
  const iNote = mk(tt('ui.scene.noteChapter'), cur.note || '', 'textarea');
  const iFav = mkChk(tt('ui.scene.chapterImportantFavorite'), cur.isFavorite);

  return new Promise((resolve) => {
    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', null, tt('ui.common.cancel'));
    const okB = el('button', 'k-ok', tt('ui.common.save'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    const close = (v) => { ov.remove(); resolve(v); };
    cB.onclick = () => close(false);
    ov.onclick = (e) => { if (e.target === ov) close(false); };
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    okB.onclick = async () => {
      const title = iTitle.value.trim();
      if (title) cur.title = title;
      cur.status = iStatus.value;
      cur.act = iAct.value.trim();
      cur.date = iDate.value.trim();
      cur.isFavorite = iFav.checked;
      // ค่าว่างอย่าทิ้งบรรทัดขยะไว้ในไฟล์ (บทเรียน 26)
      const note = iNote.value.trim();
      if (note) cur.note = note; else delete cur.note;
      if (!cur.act) delete cur.act;
      if (!cur.date) delete cur.date;
      await kapi.writeFile(df, JSON.stringify(d, null, 2));
      await buildTree();
      setStatus(tt('ui.scene.savePropsChapterDone') + (cur.title || ''));
      close(true);
    };
  });
}

/**
 * [alpha.141] แถวบททั้งหมดของฉบับร่าง เรียงตาม `order` — "จัดการบท" กับโหมดอ่านใช้ตัวเดียวกัน
 * (อย่าเรียงตามชื่อ — บทเรียนข้อ 14: ชื่อไทยเรียงแล้วได้ลำดับที่ผู้ใช้ไม่ได้ตั้ง)
 */
export async function listChapters(dPath) {
  try {
    const d = await kapi.readJson(await kapi.join(dPath, 'draft.json'));
    return (d.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch { return []; }
}

/**
 * [alpha.141] เขียนคุณสมบัติของบทลง draft.json — ทางเดียวของทุกที่ที่แก้ค่าบท
 * @returns {Promise<object|null>} แถวบทหลังแก้ (null = ไม่เจอบท)
 */
export async function saveChapterMeta(dPath, guid, patch) {
  const df = await kapi.join(dPath, 'draft.json');
  let d;
  try { d = await kapi.readJson(df); } catch { return null; }
  const cur = (d.chapters || []).find((c) => c.guid === guid);
  if (!cur) return null;
  Object.assign(cur, patch);
  await kapi.writeFile(df, JSON.stringify(d, null, 2));
  return cur;
}

/** [alpha.141] จำนวนฉาก/คำของบทหนึ่ง (สำหรับการ์ดใน "จัดการบท") */
export async function chapterStats(dPath, ch) {
  let scenes = 0, words = 0;
  try {
    const all = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
    for (const sc of all[ch.guid] || []) {
      if (sc.type === 'memo') continue;
      scenes++;
      try {
        const { body } = parseMdFile(await kapi.readFile(
          await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName)));
        words += countWords(body);
      } catch {}
    }
  } catch {}
  return { scenes, words };
}

export async function deleteScene(dPath, ch, sc) {
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  const dst = await deleteToTrash(file, sc.title);
  if (!dst) return;
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'scene', dPath, chGuid: ch.guid, folderName: ch.folderName, sc }, null, 2));
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  d.chapters[ch.guid] = (d.chapters[ch.guid] || []).filter((s) => s.id !== sc.id);
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  await trashVisSidecar(dPath, ch.folderName, sc.fileName, dst);
  // [alpha.128] คำสั่งโครงสร้างมาจากเมนูคลิกขวา จึงไม่ผ่าน handleCommand ที่จด `cmd:` ให้
  // → เดิมไล่ย้อนไม่ได้เลยว่าฉากหายไปตอนไหน · จดที่ตัวการทำงานจริงแทน
  logAction('scene', ttf('ui.scene.delScene2', sc.title), { dPath, chapter: ch.title, trash: dst });
  await buildTree(); refreshNetwork();
}

export async function deleteChapter(dPath, ch) {
  const dir = await kapi.join(dPath, 'Chapters', ch.folderName);
  if (!(await confirmBox(ttf('ui.scene.delChapterChapterAll', ch.title)))) return;
  const dst = await kapi.join(state.root, 'Recycle',
                              Date.now().toString(36) + '-' + ch.folderName);
  const scenesNow = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters?.[ch.guid] || [];
  await kapi.move(dir, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'chapter', dPath, ch, scenes: scenesNow }, null, 2));
  const df = await kapi.join(dPath, 'draft.json');
  const d = await kapi.readJson(df);
  d.chapters = (d.chapters || []).filter((c) => c.guid !== ch.guid);
  await kapi.writeFile(df, JSON.stringify(d, null, 2));
  const sf = await kapi.join(dPath, 'scenes.json');
  const s2 = await kapi.readJson(sf);
  if (s2.chapters) delete s2.chapters[ch.guid];
  await kapi.writeFile(sf, JSON.stringify(s2, null, 2));
  logAction('chapter', ttf('ui.scene.delChapter2', ch.title),
            { dPath, scenes: scenesNow.length, trash: dst });
  await buildTree(); refreshNetwork();
}

/**
 * เพิ่มบทใหม่
 * @param {string} [preset]  ส่งชื่อมา = ข้ามกล่องถาม ([alpha.95] ตัวแปลงอัตโนมัติ)
 * @returns {Promise<object|null>} แถวบทที่สร้าง (null = ยกเลิก)
 */
export async function addChapter(dPath, preset) {
  const title = preset || await ask(tt('ui.scene.nameChapterNew'));
  if (!title) return null;
  const df = await kapi.join(dPath, 'draft.json');
  const d = await kapi.readJson(df);
  const order = Math.max(0, ...(d.chapters || []).map((c) => c.order || 0)) + 1;
  const ch = { guid: guid(), title, order, status: 'Outline', act: 'I', date: '',
               isFavorite: false, folderName: String(order).padStart(2, '0') + ' - ' + safeName(title) };
  d.chapters = [...(d.chapters || []), ch];
  await kapi.writeFile(df, JSON.stringify(d, null, 2));
  await kapi.mkdir(await kapi.join(dPath, 'Chapters', ch.folderName));
  logAction('chapter', tt('ui.scene.addChapter') + title, { dPath, folder: ch.folderName });
  await buildTree(); setStatus(tt('ui.scene.addChapter') + title); refreshNetwork();
  return ch;
}

/**
 * เพิ่มฉากใหม่
 * @param {string} [preset]  ส่งชื่อมา = ข้ามกล่องถาม ([alpha.95] ตัวแปลงอัตโนมัติ)
 * @param {object} [opts]    body = เนื้อฉาก · meta = frontmatter เพิ่ม (format/tags/…)
 *                           silent = ไม่ต้องเปิดแท็บให้ (แปลงทีละหลายฉากแล้วเปิดหมดคือรก)
 * @returns {Promise<object|null>} แถวฉากที่สร้าง (null = ยกเลิก)
 */
export async function addScene(dPath, ch, preset, opts = {}) {
  const title = preset || await ask(tt('ui.scene.nameSceneNew'));
  if (!title) return null;
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  d.chapters = d.chapters || {};
  const list = d.chapters[ch.guid] || [];
  const order = Math.max(0, ...list.map((s) => s.order || 0)) + 1;
  const sc = { id: guid(), title, order, fileName: 'scene-' + String(order).padStart(2, '0') + '.md',
               chapterGuid: ch.guid, date: '', isFavorite: false, wordCount: 0, synopsis: '' };
  d.chapters[ch.guid] = [...list, sc];
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  const meta = { title, type: 'scene', format: 'prose', pov: '', tags: [], ...(opts.meta || {}) };
  await kapi.writeFile(file, dumpMdFile(meta, opts.body || ''));
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  logAction('scene', tt('ui.scene.addScene') + title, { file });
  await buildTree();
  if (!opts.silent) openScene(file, title);
  refreshNetwork();
  return { ...sc, path: file };
}

export async function setSceneMeta(dPath, ch, sc, patch) {
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  const row = (d.chapters[ch.guid] || []).find((x) => x.id === sc.id);
  if (!row) return;
  Object.assign(row, patch);
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  // [alpha.60r2 ข้อ 13] คุณสมบัติที่เป็นของ "เนื้อฉาก" ต้องลง frontmatter ของ .md ด้วย
  // ไม่งั้นแก้จากเมนูคลิกขวาแล้วไฟล์จริงไม่รู้เรื่อง (เปิดนอกโปรแกรมก็ไม่เห็น)
  const heavy = {};
  for (const k of SCENE_HEAVY_KEYS) if (k in (patch || {})) heavy[k] = patch[k];
  if (Object.keys(heavy).length) {
    try { await writeSceneMeta(await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName), heavy); }
    catch {}
  }
  await buildTree();
}

export async function toggleSceneFlag(dPath, ch, sc) {
  await setSceneMeta(dPath, ch, sc, { flag: !sc.flag });
  setStatus(sc.flag ? tt('ui.scene.pinOut') + sc.title : tt('ui.scene.pinPin') + sc.title);
}

export async function duplicateScene(dPath, ch, sc) {
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  const list = d.chapters[ch.guid] || [];
  const row = list.find((x) => x.id === sc.id);
  if (!row) return;
  const order = Math.max(0, ...list.map((s) => s.order || 0)) + 1;
  const fileName = 'scene-' + String(order).padStart(2, '0') + '.md';
  const newTitle = row.title + tt('ui.common.msg');
  const srcFile = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
  let meta = { title: newTitle, type: 'scene', format: 'prose', pov: '', tags: [] }, body = '';
  try { const parsed = parseMdFile(await kapi.readFile(srcFile)); meta = parsed.meta; body = parsed.body; } catch {}
  meta.title = newTitle;
  const nrow = { ...row, id: guid(), title: newTitle, order, fileName, isFavorite: false };
  d.chapters[ch.guid] = [...list, nrow];
  await kapi.writeFile(await kapi.join(dPath, 'Chapters', ch.folderName, fileName), dumpMdFile(meta, body));
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  await copyVisSidecar(dPath, ch.folderName, row.fileName, fileName);
  await buildTree();
  openScene(await kapi.join(dPath, 'Chapters', ch.folderName, fileName), newTitle);
}

export async function moveSceneOrder(dPath, ch, sc, dir) {
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  const list = (d.chapters[ch.guid] || []).slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const i = list.findIndex((x) => x.id === sc.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;           // สุดขอบแล้ว
  const oa = list[i].order || 0, ob = list[j].order || 0;
  list[i].order = ob; list[j].order = oa;                    // สลับเลขลำดับ
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  await buildTree();
}

export async function moveSceneToChapter(dPath, ch, sc, dstCh) {
  if (dstCh.guid === ch.guid) return;
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  d.chapters = d.chapters || {};
  const from = d.chapters[ch.guid] || [];
  const row = from.find((x) => x.id === sc.id);   // ดึง row จริง (fileName สดจากทะเบียน ไม่พึ่งค่าที่ caller ส่ง)
  if (!row) return;

  // แท็บที่เปิดฉากนี้ค้างอยู่ = พาธเดิม — เซฟแล้วปิดก่อนย้าย (พาธกำลังจะเปลี่ยน) กัน stale tab เขียนทับ
  const oldPath = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
  const openTab = state.tabs.get(oldPath);
  if (openTab) { if (openTab.dirty) await saveTab(openTab); openTab.dirty = false; closeTab(oldPath); }

  const dst = d.chapters[dstCh.guid] || [];
  const order = Math.max(0, ...dst.map((s) => s.order || 0)) + 1;
  const newFile = await uniqueSceneFileName(dPath, dstCh.folderName, order);

  // ย้ายไฟล์เนื้อหาจริงก่อน แล้วค่อยแก้ทะเบียน (ถ้าย้ายไฟล์พลาด ทะเบียนยังตรงของเดิม)
  await kapi.move(oldPath, await kapi.join(dPath, 'Chapters', dstCh.folderName, newFile));
  await moveVisSidecar(dPath, ch.folderName, row.fileName, dstCh.folderName, newFile);
  d.chapters[ch.guid] = from.filter((x) => x.id !== sc.id);
  row.order = order; row.fileName = newFile; row.chapterGuid = dstCh.guid;
  d.chapters[dstCh.guid] = [...dst, row];
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  await buildTree();
  setStatus(tt('ui.scene.move') + row.title + tt('ui.scene.chapter2') + dstCh.title + tt('ui.common.done2'));
}

export async function moveChapterBefore(dPath, srcGuid, dstGuid) {
  if (srcGuid === dstGuid) return;
  const df = await kapi.join(dPath, 'draft.json');
  const d = await kapi.readJson(df);
  const list = (d.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const si = list.findIndex((c) => c.guid === srcGuid);
  if (si < 0) return;
  const [moved] = list.splice(si, 1);
  const di = dstGuid ? list.findIndex((c) => c.guid === dstGuid) : list.length;
  list.splice(di < 0 ? list.length : di, 0, moved);
  list.forEach((c, i) => { c.order = i + 1; });
  d.chapters = list;
  await kapi.writeFile(df, JSON.stringify(d, null, 2));
  await buildTree();
  setStatus(tt('ui.scene.reorderChapterNewDone'));
}

export async function moveSceneBefore(dPath, srcCh, srcId, dstCh, dstId) {
  const sf = await kapi.join(dPath, 'scenes.json');
  // ข้ามบท → ย้ายไฟล์ก่อน (moveSceneToChapter) แล้วค่อยจัดตำแหน่ง
  if (srcCh.guid !== dstCh.guid) {
    const d0 = await kapi.readJson(sf);
    const row0 = (d0.chapters[srcCh.guid] || []).find((x) => x.id === srcId);
    if (!row0) return;
    await moveSceneToChapter(dPath, srcCh, { id: srcId }, dstCh);
    // หา id ที่ย้ายมา (ชื่อเดิม) แล้วจัดก่อน dstId
    srcCh = dstCh;
  }
  const d = await kapi.readJson(sf);
  const list = (d.chapters[dstCh.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const si = list.findIndex((x) => x.id === srcId);
  if (si < 0) { await buildTree(); return; }
  const [moved] = list.splice(si, 1);
  const di = dstId ? list.findIndex((x) => x.id === dstId) : list.length;
  list.splice(di < 0 ? list.length : di, 0, moved);
  list.forEach((x, i) => { x.order = i + 1; });
  d.chapters[dstCh.guid] = list;
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  await buildTree();
  setStatus(tt('ui.scene.reorderSceneNewDone'));
}

export function sceneStatusMenu(e, dPath, ch, sc) {
  popupMenu(e.clientX, e.clientY, [
    // allStatuses = มาตรฐาน + ที่ผู้ใช้เพิ่มเอง (custom-status.js)
    ...allStatuses().map((s) => ({ label: s, click: () => setSceneMeta(dPath, ch, sc, { status: s }) })),
    '-',
    { label: tt('ui.scene.clearStatus'), click: () => setSceneMeta(dPath, ch, sc, { status: 'Outline' }) },
  ]);
}

export function sceneColorMenu(e, dPath, ch, sc) {
  popupMenu(e.clientX, e.clientY, [
    ...SCENE_COLORS.map(([name, hex]) => ({ label: '● ' + name, click: () => setSceneMeta(dPath, ch, sc, { color: hex }) })),
    '-',
    { label: tt('ui.scene.clearColor'), click: () => setSceneMeta(dPath, ch, sc, { color: '' }) },
  ]);
}

// ---- เรียงลำดับหมายเลขใหม่ (Renumber: ข้อ 16) ----
// รีเซ็ต order ของบทในฉบับร่างให้เรียง 1,2,3... และเรียงฉากในแต่ละบท
export async function renumberChapters(dPath) {
  const df = await kapi.join(dPath, 'draft.json');
  const draft = await kapi.readJson(df);
  const chapters = (draft.chapters || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  chapters.forEach((ch, i) => { ch.order = i + 1; });
  await kapi.writeFile(df, JSON.stringify(draft, null, 2));

  const sf = await kapi.join(dPath, 'scenes.json');
  const scData = await kapi.readJson(sf);
  for (const ch of chapters) {
    const scenes = (scData.chapters[ch.guid] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    scenes.forEach((sc, i) => { sc.order = i + 1; });
  }
  await kapi.writeFile(sf, JSON.stringify(scData, null, 2));
  await buildTree();
  setStatus(tt('ui.scene.orderChapterSceneNew') + chapters.length + tt('ui.scene.chapter'));
}

// ───────── ไฟล์คู่ของ "เล่าด้วยภาพ" ─────────
// ทั้งสามตัวห้าม throw — ฉากย้าย/ลบสำเร็จไปแล้ว ไฟล์คู่พลาดต้องไม่ทำให้ทั้งงานล้ม
async function visOf(dPath, folderName, fileName) {
  return kapi.join(dPath, 'Chapters', folderName, visFileName(fileName));
}
async function moveVisSidecar(dPath, srcFolder, srcFile, dstFolder, dstFile) {
  try {
    const src = await visOf(dPath, srcFolder, srcFile);
    if (!(await kapi.exists(src))) return false;
    await kapi.move(src, await visOf(dPath, dstFolder, dstFile));
    return true;
  } catch { return false; }
}
async function copyVisSidecar(dPath, folderName, srcFile, dstFile) {
  try {
    const src = await visOf(dPath, folderName, srcFile);
    if (!(await kapi.exists(src))) return false;
    await kapi.writeFile(await visOf(dPath, folderName, dstFile), await kapi.readFile(src));
    return true;
  } catch { return false; }
}
/**
 * ฉากถูกย้ายไปถังขยะที่ `trashPath` แล้ว — เอาตารางไปเก็บเป็น `<trashPath>.vis.csv`
 * (ไม่ใช้ deleteToTrash เพราะมันถามยืนยันซ้ำ · ชื่อคู่กันแบบนี้ทำให้กู้คืนพร้อมฉากได้ในที่เดียว)
 */
async function trashVisSidecar(dPath, folderName, fileName, trashPath) {
  try {
    const src = await visOf(dPath, folderName, fileName);
    if (!trashPath || !(await kapi.exists(src))) return false;
    await kapi.move(src, trashPath + '.vis.csv');
    return true;
  } catch { return false; }
}
