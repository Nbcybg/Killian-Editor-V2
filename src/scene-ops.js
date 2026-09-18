// scene-ops.js — จัดการฉากและบท: เพิ่ม/แก้ชื่อ/ลบ/ทำสำเนา/ย้าย/เมนูสถานะ·สี
//
// ══ [alpha.156] กติกาของไฟล์นี้ ══
// 1. `scenes.json` / `draft.json` แก้ผ่าน `mutateJson()` เท่านั้น (อ่านสด → แก้ → เขียน ในคิวของไฟล์)
//    เดิมอ่านแล้วเขียนทั้งก้อน → งานที่วิ่งซ้อน (บันทึกอัตโนมัติ · แผงคุณสมบัติ · Kanban) ทับกันหาย
//    ⚠ ห้ามเรียก saveTab/updateSceneRow **ข้างใน** fn ของ mutateJson (มันแตะ scenes.json เอง = รอตัวเอง)
// 2. ชื่อไฟล์ฉากใหม่ต้องผ่าน `freeSceneFileName()` — เดิมตั้งจากเลขลำดับตรง ๆ แล้วเขียนทับ
//    ฉากเดิมที่ชื่อชนเป็นไฟล์ว่าง (ลากเรียงฉาก → ลบฉากท้าย → เพิ่มฉาก = scene-03.md ถูกทับ)
// 3. เขียน frontmatter ของไฟล์ที่เปิดอยู่ = ต้องซิงก์ `meta` ของแท็บ (`syncOpenTabMeta`)
import { t as tt, tf as ttf, t, tf } from './i18n.js';
import { buildTree, closeTab, guid, openScene, safeName, saveTab, refreshNetwork,
         closeTabsUnderPath, syncOpenTabMeta, moveSnapshots } from './app.js';
import { SCENE_STATUSES, dataLabel, el, setStatus, state, logAction } from './core.js';
import { allStatuses } from './custom-status.js';
import { deleteToTrash } from './recycle.js';
import { ask, confirmBox } from './ui.js';
import { countWords, dumpMdFile, parseMdFile } from './md.js';
// [alpha.60r2 ข้อ 13] คุณสมบัติหนักของฉากอยู่ใน frontmatter — เขียนผ่านที่นี่ที่เดียว
import { SCENE_HEAVY_KEYS, writeSceneMeta } from './scene-meta.js';
// ตาราง "เล่าด้วยภาพ" เป็นไฟล์คู่ข้างฉาก (<ชื่อฉาก>_vis.csv) — ทุกที่ที่ย้าย/ลบ/ทำสำเนาฉาก
// ต้องพาไฟล์นี้ไปด้วย ไม่งั้นกลายเป็นไฟล์กำพร้าที่ผู้ใช้มองไม่เห็นแต่ยังกินที่
import { visFileName } from './visual/vis-core.js';
import { gi } from './icons.js';
import { mutateJson } from './json-store.js';

// [alpha.159] ย้ายไป scene-file-name.js (ai-actions ใช้ตัวเดียวกันได้โดยไม่ลาก app.js) — ส่งต่อชื่อเดิม
export { freeSceneFileName } from './scene-file-name.js';
import { freeSceneFileName } from './scene-file-name.js';

const rowsOf = (d, guid0) => ((d && d.chapters) || {})[guid0] || [];
const nextOrder = (list) => Math.max(0, ...(list || []).map((x) => x.order || 0)) + 1;

export async function renameScene(dPath, ch, sc) {
  const title = await ask(tt('ui.scene.nameSceneNew'), { value: sc.title }); if (!title) return;
  return setSceneTitle(dPath, ch, sc, title);
}

// ตั้งชื่อฉากโดยไม่ต้องถามผู้ใช้ — ใช้โดย "แนะนำชื่อด้วย AI" (ข้อ 78) และ renameScene
export async function setSceneTitle(dPath, ch, sc, title) {
  if (!title || title === sc.title) return;
  const sf = await kapi.join(dPath, 'scenes.json');
  await mutateJson(kapi, sf, (d) => {
    let hit = false;
    for (const s of rowsOf(d, ch.guid)) if (s.id === sc.id) { s.title = title; hit = true; }
    return hit ? undefined : false;
  });
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  const { meta, body } = parseMdFile(await kapi.readFile(file));
  meta.title = title;
  await kapi.writeFile(file, dumpMdFile(meta, body));
  const t = state.tabs.get(file);
  if (t) {
    t.title = title;
    // [alpha.156] ไม่งั้นบันทึกครั้งถัดไปแท็บเขียน "ชื่อเก่า" กลับลง frontmatter
    if (t.meta) t.meta.title = title;
    t.tabBtn.querySelector('.tab-title').textContent = (t.dirty ? gi('dot') + ' ' : '') + title;
  }
  await buildTree();
}

export async function renameChapter(dPath, ch) {
  const title = await ask(tt('ui.scene.nameChapterNew'), { value: ch.title }); if (!title) return;
  return setChapterTitle(dPath, ch, title);
}

export async function setChapterTitle(dPath, ch, title) {
  if (!title || title === ch.title) return;
  const df = await kapi.join(dPath, 'draft.json');
  await mutateJson(kapi, df, (d) => {
    let hit = false;
    for (const c of d.chapters || []) if (c.guid === ch.guid) { c.title = title; hit = true; }
    return hit ? undefined : false;
  });
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
      // [alpha.156] เขียนลงแถว "สด" ไม่ใช่ `d` ที่อ่านตอนเปิดกล่อง (ระหว่างนั้นอาจมีบทใหม่/ย้ายลำดับ)
      const res = await mutateJson(kapi, df, (fresh) => {
        const live = (fresh.chapters || []).find((c) => c.guid === ch.guid);
        if (!live) return false;
        const title = iTitle.value.trim();
        if (title) live.title = title;
        live.status = iStatus.value;
        live.act = iAct.value.trim();
        live.date = iDate.value.trim();
        live.isFavorite = iFav.checked;
        // ค่าว่างอย่าทิ้งบรรทัดขยะไว้ในไฟล์ (บทเรียน 26)
        const note = iNote.value.trim();
        if (note) live.note = note; else delete live.note;
        if (!live.act) delete live.act;
        if (!live.date) delete live.date;
        return live;
      });
      if (!res.changed) { setStatus(tt('ui.scene.notFoundChapterDraft')); close(false); return; }
      await buildTree();
      setStatus(tt('ui.scene.savePropsChapterDone') + (res.result.title || ''));
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
export async function saveChapterMeta(dPath, guid0, patch) {
  const df = await kapi.join(dPath, 'draft.json');
  try {
    const res = await mutateJson(kapi, df, (d) => {
      const cur = (d.chapters || []).find((c) => c.guid === guid0);
      if (!cur) return false;
      Object.assign(cur, patch);
      return cur;
    });
    return res.changed ? res.result : null;
  } catch { return null; }
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
  await mutateJson(kapi, sf, (d) => {
    d.chapters = d.chapters || {};
    d.chapters[ch.guid] = rowsOf(d, ch.guid).filter((s) => s.id !== sc.id);
  });
  await trashVisSidecar(dPath, ch.folderName, sc.fileName, dst);
  // [alpha.128] คำสั่งโครงสร้างมาจากเมนูคลิกขวา จึงไม่ผ่าน handleCommand ที่จด `cmd:` ให้
  // → เดิมไล่ย้อนไม่ได้เลยว่าฉากหายไปตอนไหน · จดที่ตัวการทำงานจริงแทน
  logAction('scene', ttf('ui.scene.delScene2', sc.title), { dPath, chapter: ch.title, trash: dst });
  await buildTree(); refreshNetwork();
}

export async function deleteChapter(dPath, ch) {
  const dir = await kapi.join(dPath, 'Chapters', ch.folderName);
  if (!(await confirmBox(ttf('ui.scene.delChapterChapterAll', ch.title)))) return;
  // [alpha.156] ★ ปิดแท็บของฉากในบทนี้ก่อนย้ายโฟลเดอร์ (บันทึกงานค้างลงไฟล์ก่อน — ถังขยะได้ของล่าสุด)
  // เดิมไม่ปิดเลย → บันทึกอัตโนมัติเขียนไฟล์กลับที่เดิม = โฟลเดอร์บทที่ลบไปแล้วเกิดใหม่เป็นโฟลเดอร์ผี
  await closeTabsUnderPath(dir, { save: true });
  const dst = await kapi.join(state.root, 'Recycle',
                              Date.now().toString(36) + '-' + ch.folderName);
  const sf = await kapi.join(dPath, 'scenes.json');
  const scenesNow = rowsOf(await kapi.readJson(sf).catch(() => ({})), ch.guid);
  await kapi.move(dir, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'chapter', dPath, ch, scenes: scenesNow }, null, 2));
  const df = await kapi.join(dPath, 'draft.json');
  await mutateJson(kapi, df, (d) => { d.chapters = (d.chapters || []).filter((c) => c.guid !== ch.guid); });
  await mutateJson(kapi, sf, (s2) => {
    if (!s2.chapters || !(ch.guid in s2.chapters)) return false;
    delete s2.chapters[ch.guid];
  });
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
  let ch = null;
  await mutateJson(kapi, df, async (d) => {
    const order = nextOrder(d.chapters);
    const taken = new Set((d.chapters || []).map((c) => c.folderName));
    // [alpha.156] โฟลเดอร์ชื่อนี้มีอยู่แล้ว (เล่มที่กู้คืน/ก๊อปมาเอง) → ต่อท้ายเลข ไม่ไปยึดโฟลเดอร์ของคนอื่น
    let folderName = String(order).padStart(2, '0') + ' - ' + safeName(title);
    for (let n = 2; taken.has(folderName) || await kapi.exists(await kapi.join(dPath, 'Chapters', folderName)); n++) {
      folderName = String(order).padStart(2, '0') + ' - ' + safeName(title) + ' ' + n;
    }
    ch = { guid: guid(), title, order, status: 'Outline', act: 'I', date: '',
           isFavorite: false, folderName };
    d.chapters = [...(d.chapters || []), ch];
  });
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
  let sc = null, file = '';
  await mutateJson(kapi, sf, async (d) => {
    d.chapters = d.chapters || {};
    const list = rowsOf(d, ch.guid);
    const order = nextOrder(list);
    // [alpha.156] ★ เดิม `'scene-' + order` ตรง ๆ → ชนไฟล์ของฉากที่ถูกเรียงลำดับใหม่แล้วเขียนทับเป็นไฟล์ว่าง
    const fileName = await freeSceneFileName(dPath, ch.folderName, order, new Set(list.map((s) => s.fileName)));
    sc = { id: guid(), title, order, fileName,
           chapterGuid: ch.guid, date: '', isFavorite: false, wordCount: 0, synopsis: '' };
    file = await kapi.join(dPath, 'Chapters', ch.folderName, fileName);
    const meta = { title, type: 'scene', format: 'prose', pov: '', tags: [], ...(opts.meta || {}) };
    await kapi.writeFile(file, dumpMdFile(meta, opts.body || ''));
    d.chapters[ch.guid] = [...list, sc];
  });
  logAction('scene', tt('ui.scene.addScene') + title, { file });
  await buildTree();
  if (!opts.silent) openScene(file, title);
  refreshNetwork();
  return { ...sc, path: file };
}

export async function setSceneMeta(dPath, ch, sc, patch) {
  const sf = await kapi.join(dPath, 'scenes.json');
  let fileName = null;
  const res = await mutateJson(kapi, sf, (d) => {
    const row = rowsOf(d, ch.guid).find((x) => x.id === sc.id);
    if (!row) return false;
    Object.assign(row, patch);
    fileName = row.fileName;
  });
  if (!res.changed) return;
  // [alpha.60r2 ข้อ 13] คุณสมบัติที่เป็นของ "เนื้อฉาก" ต้องลง frontmatter ของ .md ด้วย
  // ไม่งั้นแก้จากเมนูคลิกขวาแล้วไฟล์จริงไม่รู้เรื่อง (เปิดนอกโปรแกรมก็ไม่เห็น)
  const heavy = {};
  for (const k of SCENE_HEAVY_KEYS) if (k in (patch || {})) heavy[k] = patch[k];
  if (Object.keys(heavy).length) {
    try {
      const file = await kapi.join(dPath, 'Chapters', ch.folderName, fileName);
      await writeSceneMeta(file, heavy);
      await syncOpenTabMeta(file);          // [alpha.156] แท็บที่เปิดอยู่ต้องไม่เขียนค่าเก่ากลับ
    } catch {}
  }
  await buildTree();
}

export async function toggleSceneFlag(dPath, ch, sc) {
  await setSceneMeta(dPath, ch, sc, { flag: !sc.flag });
  setStatus(sc.flag ? tt('ui.scene.pinOut') + sc.title : tt('ui.scene.pinPin') + sc.title);
}

export async function duplicateScene(dPath, ch, sc) {
  const sf = await kapi.join(dPath, 'scenes.json');
  // งานค้างของต้นฉบับต้องลงไฟล์ก่อน (สำเนาอ่านจากดิสก์) — ทำ **นอกคิว** เพราะ saveTab แตะ scenes.json เอง
  if (sc && sc.fileName) {
    const openSrc = state.tabs.get(await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName));
    if (openSrc && openSrc.dirty) await saveTab(openSrc);
  }
  let made = null;
  await mutateJson(kapi, sf, async (d) => {
    const list = rowsOf(d, ch.guid);
    const row = list.find((x) => x.id === sc.id);
    if (!row) return false;
    const order = nextOrder(list);
    // [alpha.156] ★ ชื่อไฟล์ต้องว่างจริง (เดิมชนแล้วเขียนทับฉากอื่น — ต้นตอเดียวกับ addScene)
    const fileName = await freeSceneFileName(dPath, ch.folderName, order, new Set(list.map((s) => s.fileName)));
    const newTitle = row.title + tt('ui.common.msg');
    const srcFile = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
    let meta = { title: newTitle, type: 'scene', format: 'prose', pov: '', tags: [] }, body = '';
    try { const parsed = parseMdFile(await kapi.readFile(srcFile)); meta = parsed.meta; body = parsed.body; } catch {}
    meta.title = newTitle;
    const nrow = { ...row, id: guid(), title: newTitle, order, fileName, isFavorite: false };
    await kapi.writeFile(await kapi.join(dPath, 'Chapters', ch.folderName, fileName), dumpMdFile(meta, body));
    d.chapters[ch.guid] = [...list, nrow];
    made = { srcName: row.fileName, fileName, newTitle };
  });
  if (!made) return;
  await copyVisSidecar(dPath, ch.folderName, made.srcName, made.fileName);
  await buildTree();
  openScene(await kapi.join(dPath, 'Chapters', ch.folderName, made.fileName), made.newTitle);
}

export async function moveSceneOrder(dPath, ch, sc, dir) {
  const sf = await kapi.join(dPath, 'scenes.json');
  const res = await mutateJson(kapi, sf, (d) => {
    const list = rowsOf(d, ch.guid).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = list.findIndex((x) => x.id === sc.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;     // สุดขอบแล้ว
    const oa = list[i].order || 0, ob = list[j].order || 0;
    list[i].order = ob; list[j].order = oa;                    // สลับเลขลำดับ (แถวชุดเดียวกับใน d)
  });
  if (res.changed) await buildTree();
}

export async function moveSceneToChapter(dPath, ch, sc, dstCh) {
  if (dstCh.guid === ch.guid) return;
  const sf = await kapi.join(dPath, 'scenes.json');
  // ดึง row จริง (fileName สดจากทะเบียน ไม่พึ่งค่าที่ caller ส่ง) — อ่านอย่างเดียว เพื่อจัดการแท็บก่อนเข้าคิว
  const row0 = rowsOf(await kapi.readJson(sf), ch.guid).find((x) => x.id === sc.id);
  if (!row0) return;

  // แท็บที่เปิดฉากนี้ค้างอยู่ = พาธเดิม — เซฟแล้วปิดก่อนย้าย (พาธกำลังจะเปลี่ยน) กัน stale tab เขียนทับ
  // (ต้องทำนอก mutateJson — saveTab อัปเดตจำนวนคำใน scenes.json เอง)
  const oldPath = await kapi.join(dPath, 'Chapters', ch.folderName, row0.fileName);
  const openTab = state.tabs.get(oldPath);
  if (openTab) { if (openTab.dirty) await saveTab(openTab); openTab.dirty = false; closeTab(oldPath, { discard: true }); }

  let moved = null;
  await mutateJson(kapi, sf, async (d) => {
    d.chapters = d.chapters || {};
    const from = rowsOf(d, ch.guid);
    const row = from.find((x) => x.id === sc.id);
    if (!row) return false;
    const dst = rowsOf(d, dstCh.guid);
    const order = nextOrder(dst);
    const newFile = await freeSceneFileName(dPath, dstCh.folderName, order, new Set(dst.map((s) => s.fileName)));
    const src = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
    const newPath = await kapi.join(dPath, 'Chapters', dstCh.folderName, newFile);
    // ย้ายไฟล์เนื้อหาจริงก่อน แล้วค่อยแก้ทะเบียน (ถ้าย้ายไฟล์พลาด → โยน error → ไม่เขียนทะเบียน)
    await kapi.move(src, newPath);
    await moveVisSidecar(dPath, ch.folderName, row.fileName, dstCh.folderName, newFile);
    d.chapters[ch.guid] = from.filter((x) => x.id !== sc.id);
    row.order = order; row.fileName = newFile; row.chapterGuid = dstCh.guid;
    d.chapters[dstCh.guid] = [...dst, row];
    moved = { row, src, newPath };
  });
  if (!moved) return;
  // [alpha.156] ประวัติเวอร์ชันต้องตามไฟล์ไปด้วย (ผูกกับ path)
  await moveSnapshots(moved.src, moved.newPath);
  logAction('scene', ttf('ui.scene.movedToChapter', moved.row.title, dstCh.title), { from: moved.src, to: moved.newPath });
  await buildTree();
  setStatus(tt('ui.scene.move') + moved.row.title + tt('ui.scene.chapter2') + dstCh.title + tt('ui.common.done2'));
}

export async function moveChapterBefore(dPath, srcGuid, dstGuid) {
  if (srcGuid === dstGuid) return;
  const df = await kapi.join(dPath, 'draft.json');
  const res = await mutateJson(kapi, df, (d) => {
    const list = (d.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const si = list.findIndex((c) => c.guid === srcGuid);
    if (si < 0) return false;
    const [moved] = list.splice(si, 1);
    const di = dstGuid ? list.findIndex((c) => c.guid === dstGuid) : list.length;
    list.splice(di < 0 ? list.length : di, 0, moved);
    list.forEach((c, i) => { c.order = i + 1; });
    d.chapters = list;
  });
  if (!res.changed) return;
  await buildTree();
  setStatus(tt('ui.scene.reorderChapterNewDone'));
}

export async function moveSceneBefore(dPath, srcCh, srcId, dstCh, dstId) {
  const sf = await kapi.join(dPath, 'scenes.json');
  // ข้ามบท → ย้ายไฟล์ก่อน (moveSceneToChapter) แล้วค่อยจัดตำแหน่ง
  if (srcCh.guid !== dstCh.guid) {
    const row0 = rowsOf(await kapi.readJson(sf), srcCh.guid).find((x) => x.id === srcId);
    if (!row0) return;
    await moveSceneToChapter(dPath, srcCh, { id: srcId }, dstCh);
    srcCh = dstCh;
  }
  const res = await mutateJson(kapi, sf, (d) => {
    const list = rowsOf(d, dstCh.guid).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const si = list.findIndex((x) => x.id === srcId);
    if (si < 0) return false;
    const [moved] = list.splice(si, 1);
    const di = dstId ? list.findIndex((x) => x.id === dstId) : list.length;
    list.splice(di < 0 ? list.length : di, 0, moved);
    list.forEach((x, i) => { x.order = i + 1; });
    d.chapters[dstCh.guid] = list;
  });
  await buildTree();
  if (res.changed) setStatus(tt('ui.scene.reorderSceneNewDone'));
}

// [alpha.155] เมนูสี/สถานะของฉากย้ายไปเป็นตัวกลางของทุกชนิดแถว — colorMenu/statusMenu ใน tree-actions.js

// ---- เรียงลำดับหมายเลขใหม่ (Renumber: ข้อ 16) ----
// รีเซ็ต order ของบทในฉบับร่างให้เรียง 1,2,3... และเรียงฉากในแต่ละบท
export async function renumberChapters(dPath) {
  const df = await kapi.join(dPath, 'draft.json');
  let guids = [];
  await mutateJson(kapi, df, (draft) => {
    const chapters = (draft.chapters || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    chapters.forEach((ch, i) => { ch.order = i + 1; });
    guids = chapters.map((c) => c.guid);
  });
  const sf = await kapi.join(dPath, 'scenes.json');
  await mutateJson(kapi, sf, (scData) => {
    scData.chapters = scData.chapters || {};
    for (const g of guids) {
      const scenes = (scData.chapters[g] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
      scenes.forEach((sc, i) => { sc.order = i + 1; });
    }
  });
  await buildTree();
  setStatus(tt('ui.scene.orderChapterSceneNew') + guids.length + tt('ui.scene.chapter'));
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
export async function trashVisSidecar(dPath, folderName, fileName, trashPath) {
  try {
    const src = await visOf(dPath, folderName, fileName);
    if (!trashPath || !(await kapi.exists(src))) return false;
    await kapi.move(src, trashPath + '.vis.csv');
    return true;
  } catch { return false; }
}
