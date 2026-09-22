// ai-actions.js — [alpha.63r4] ตัวลงมือทำจริงของคำสั่งที่ AI สั่ง (ai-tools.js เป็นคนแกะคำสั่ง)
//
// เขียนไฟล์ตามรูปแบบเดียวกับที่ผู้ใช้กดเองใน explorer เป๊ะ ๆ:
//   เล่ม  = <root>/<ชื่อ>/section.json + Draft/default/{draft.json,scenes.json,Chapters/}
//   บท    = draft.json.chapters[] + โฟลเดอร์ Chapters/<NN - ชื่อ>/
//   ฉาก   = scenes.json.chapters[<guid บท>][] + ไฟล์ .md ที่มี front-matter
//   เอนทิตี้ = Wiki/<หมวด>/<ชื่อ>-<ts36>.json
// ทำแบบนี้เพราะฟังก์ชันใน scene-ops/section-ops/wiki-ui เปิดกล่องถามชื่อเสมอ (สั่งจากโค้ดไม่ได้)
// การลบใช้ deleteToTrash เดิม → ได้ sidecar กู้คืนเหมือนที่ผู้ใช้ลบเอง

import { t, tf } from '../i18n.js';
import { state, setStatus, smart } from '../core.js';
import { dumpMdFile, parseMdFile } from '../md.js';
import { listScenes, listEntities } from '../project-scan.js';
// [alpha.149] ★ ไฟล์ที่เปิดอยู่ในแท็บ ต้องถูกแก้ "ผ่านแท็บ" — เขียนดิสก์ตรง ๆ แล้วแท็บยังถือของเก่า
// พอผู้ใช้บันทึก ข้อความที่ AI เขียนก็หาย (วัดจริง: ไฟล์มี → กด Ctrl+S → หาย) · รายละเอียดหัว tab-bridge.js
import { tabHandle, closeTabsUnder, isInsideRoot, liveBody } from '../tab-bridge.js';   // [alpha.160 · P1-3] liveBody ย้ายไปตัวกลาง
// [alpha.159 · H5/M1] scenes.json/draft.json แก้ผ่านคิว (อ่านสด) — กฎ alpha.156 ใช้กับทาง AI ด้วย
import { mutateJson } from '../json-store.js';
import { freeSceneFileName, takenSceneFiles } from '../scene-file-name.js';   // [M3] ตัวเดียวกับทางคลิก
import { writeMdKeepingComments } from '../comments/comment-core.js';          // [M4] ไม่ลบเธรดคอมเมนต์
import { trashPathFor } from '../trash-path.js';                                // [alpha.162 · W1-4] ชื่อในถังไม่ชนกัน

const SKIP_DIRS = ['Wiki', 'Bible', 'Images', 'Memos', 'Research', 'Snapshots', 'Plugins', 'Recycle', 'Sessions'];

const guid = () => 'k2-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/**
 * ชื่อไฟล์/โฟลเดอร์จากคำตอบของโมเดล — [alpha.159 · H8] `..` / `.` ล้วนต้องไม่ผ่าน
 * (เดิมตัดแค่ตัวคั่น → `safeName('..')` = `'..'` แล้ว book.create เขียน section.json นอกโปรเจกต์)
 */
export const safeName = (s) => {
  const v = String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  return !v || /^\.+$/.test(v) ? 'untitled' : v;
};
/** ด่านสุดท้ายก่อนเขียน: path ที่ประกอบเสร็จต้องยังอยู่ใต้โปรเจกต์ */
function assertInside(p) {
  if (!isInsideRoot(state.root, p)) throw new Error(t('ui.aiActions.outsideProject'));
  return p;
}
const EMPTY_SCENES = () => ({ chapters: {} });
/**
 * [alpha.149] ★ ชื่อหมวด Wiki มาจาก **คำตอบของโมเดล** — ต้องไม่พาไฟล์ออกนอกโฟลเดอร์ Wiki
 * เดิมส่งเข้า `kapi.join(wiki, cat)` ตรง ๆ → `"../../ที่ไหนก็ได้"` เขียนไฟล์นอกโปรเจกต์ได้
 * (ข้อความในฉากที่คัดลอกมาจากเว็บก็หลอกให้โมเดลสั่งแบบนี้ได้) · คืน '' = ใช้ไม่ได้
 */
export function safeCat(cat) {
  const s = String(cat == null || cat === '' ? 'characters' : cat).trim();
  if (!s || /[\\/]/.test(s) || /^\.+$/.test(s) || s.includes('..')) return '';
  return s.replace(/[:*?"<>|]/g, '').trim();
}
const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ────────────────────────────── หาของในโปรเจกต์ ──────────────────────────────

/** เล่มทั้งหมด → [{ name, path, draftPath, title, order }] */
async function listBooks() {
  const out = [];
  const root = state.root;
  if (!root) return out;
  for (const nm of await kapi.listDirs(root).catch(() => [])) {
    if (SKIP_DIRS.includes(nm) || nm.startsWith('.')) continue;
    const secPath = await kapi.join(root, nm);
    const sj = await kapi.join(secPath, 'section.json');
    if (!(await kapi.exists(sj))) continue;
    let meta = {};
    try { meta = await kapi.readJson(sj); } catch {}
    const draftPath = await kapi.join(secPath, 'Draft', 'default');
    out.push({ name: nm, path: secPath, draftPath, title: meta.title || nm, order: meta.order || 0, meta });
  }
  return out.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** เล่มที่อ้างถึง — ไม่ระบุ = เล่มแรก */
async function findBook(title) {
  const books = await listBooks();
  if (!books.length) return null;
  if (!title) return books[0];
  return books.find((b) => eq(b.title, title) || eq(b.name, title)) || null;
}

/** บทในเล่ม — ไม่ระบุชื่อ = บทแรก */
async function findChapter(book, title) {
  const df = await kapi.join(book.draftPath, 'draft.json');
  if (!(await kapi.exists(df))) return null;
  const d = await kapi.readJson(df);
  const chs = (d.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!chs.length) return null;
  const ch = title ? chs.find((c) => eq(c.title, title)) : chs[0];
  return ch ? { ch, draft: d, draftFile: df } : null;
}

/** ฉากตามชื่อ — ค้นทั้งโปรเจกต์ถ้าไม่ระบุเล่ม/บท */
// [alpha.160 · P0-4] ★ ระบุเล่ม/บทมาแล้ว **หาไม่เจอ = null** (ผู้เรียกตอบ error)
// เดิม `findBook()` คืน null แล้วข้ามการกรองไปเฉย ๆ → คืน `rows[0]` ที่อาจเป็นฉากชื่อเดียวกันในเล่มอื่น
// = `scene.write/rename/delete` ลงผิดฉาก · ตัวกรองบทเดิมทำงานเฉพาะตอนเหลือ >1 แถว และยึดเล่มแรกเสมอเมื่อไม่ระบุเล่ม
// · `rows.filter(...) || rows` เป็นโค้ดตาย (อาร์เรย์ว่างไม่ falsy) — ตัดทิ้ง
async function findScene({ title, book, chapter }) {
  const all = await listScenes(state.root);
  let rows = all.filter((s) => eq(s.title, title));
  if (!rows.length) return null;
  let b = null;
  if (book) {
    b = await findBook(book);
    if (!b) return null;
    rows = rows.filter((s) => s.section === b.name);
  }
  if (chapter) {
    const guids = new Set();
    for (const bk of (b ? [b] : await listBooks())) {
      const c = await findChapter(bk, chapter);
      if (c) guids.add(c.ch.guid);
    }
    rows = rows.filter((s) => guids.has(s.chapterId));
  }
  return rows[0] || null;
}

async function findEntityFile(name) {
  for (const e of await listEntities(state.root).catch(() => [])) {
    if (eq(e.name, name)) return e;
    const al = (e.entity && e.entity.aliases) || [];
    if (al.some((a) => eq(a, name))) return e;
  }
  return null;
}

async function wikiBase() {
  const w = await kapi.join(state.root, 'Wiki');
  if (await kapi.exists(w)) return w;
  const b = await kapi.join(state.root, 'Bible');
  if (await kapi.exists(b)) return b;
  await kapi.mkdir(w);
  return w;
}

// ────────────────────────────── ตัวคำสั่ง ──────────────────────────────

const ok = (message, data) => ({ ok: true, message, data });
const err = (error) => ({ ok: false, error });

const HANDLERS = {
  async 'project.tree'() {
    const books = await listBooks();
    const scenes = await listScenes(state.root);
    const tree = [];
    for (const b of books) {
      const c = await findChapter(b, null);
      const chs = c ? (c.draft.chapters || []).slice().sort((x, y) => (x.order || 0) - (y.order || 0)) : [];
      tree.push({
        book: b.title,
        chapters: chs.map((ch) => ({
          chapter: ch.title,
          scenes: scenes.filter((s) => s.section === b.name && s.chapterId === ch.guid).map((s) => s.title),
        })),
      });
    }
    const ents = (await listEntities(state.root).catch(() => []))
      .map((e) => ({ name: e.name, cat: e.cat }));
    return ok(t('ui.aiActions.readStructureDone'), { books: tree, entities: ents });
  },

  async 'scene.read'(a) {
    const sc = await findScene(a);
    if (!sc) return err(tf('ui.aiActions.notFoundScene', a.title));
    const raw = (await kapi.exists(sc.path)) ? await kapi.readFile(sc.path) : '';
    const { meta, body } = parseMdFile(raw);
    return ok(tf('ui.aiActions.readSceneDone', sc.title),
              { title: sc.title, book: sc.section, meta, text: liveBody(sc.path, body) });
  },

  async 'entity.read'(a) {
    const e = await findEntityFile(a.name);
    if (!e) return err(tf('ui.aiActions.notFound', a.name));
    return ok(tf('ui.aiActions.readDone', e.name), e.entity);
  },

  async 'entity.create'(a) {
    if (await findEntityFile(a.name)) return err(tf('ui.aiActions.hasUseEntityUpdate', a.name));
    const cat = safeCat(a.cat);
    if (!cat) return err(tf('ui.aiActions.badCat', String(a.cat || '')));
    const dir = await kapi.join(await wikiBase(), cat);
    await kapi.mkdir(dir);
    const e = {
      id: guid(), entityTypeKey: cat, name: String(a.name),
      aliases: Array.isArray(a.aliases) ? a.aliases : [],
      fields: (a.fields && typeof a.fields === 'object') ? a.fields : {},
      customProperties: {}, images: [],
      sections: normSections(a.sections, a.description),
      relationships: [], chapterOverrides: [], templateId: '',
      created: new Date().toISOString(),
    };
    const file = await kapi.join(dir, safeName(a.name) + '-' + Date.now().toString(36) + '.json');
    await kapi.writeFile(file, JSON.stringify(e, null, 2));
    return ok(tf('ui.aiActions.newCatDone', a.name, cat));
  },

  async 'entity.update'(a) {
    const hit = await findEntityFile(a.name);
    if (!hit) return err(tf('ui.aiActions.notFound', a.name));
    const e = { ...hit.entity };
    if (a.newName) e.name = String(a.newName);
    if (Array.isArray(a.aliases)) e.aliases = a.aliases;
    if (a.fields && typeof a.fields === 'object') e.fields = { ...(e.fields || {}), ...a.fields };
    if (a.sections || a.description) {
      const add = normSections(a.sections, a.description);
      const cur = Array.isArray(e.sections) ? e.sections.slice() : [];
      for (const s of add) {
        const i = cur.findIndex((x) => eq(x.title, s.title));
        if (i === -1) cur.push(s); else cur[i] = s;
      }
      e.sections = cur;
    }
    // [alpha.149] หน้า Wiki นี้เปิดแก้ค้างอยู่ → ไม่เขียนทับ (ไม่งั้นงานของใครสักคนหาย) · ไม่ค้าง = โหลดใหม่ให้เห็นทันที
    const h = tabHandle(hit.path);
    if (h && h.dirty) return err(tf('ui.aiActions.entityOpenDirty', hit.name));
    await kapi.writeFile(hit.path, JSON.stringify(e, null, 2));
    if (h) await h.reloadFromDisk();
    return ok(tf('ui.aiActions.editDone', hit.name));
  },

  async 'entity.delete'(a) {
    const hit = await findEntityFile(a.name);
    if (!hit) return err(tf('ui.aiActions.notFound', a.name));
    // ผู้ใช้ยืนยันการลบแล้ว — แท็บของไฟล์ที่ไม่มีอยู่แล้วต้องไม่ค้าง · [alpha.159] บันทึกงานค้างก่อน (ถังได้ของล่าสุด)
    // [alpha.160 · P0-3] post-check แบบเดียวกับ scene.delete — บันทึกไม่ผ่าน = ไม่ลบ
    if (tabHandle(hit.path) && !(await closeTabsUnder(hit.path)).ok) return err(tf('ui.aiActions.dirOpenUnsaved', hit.name));
    if (tabHandle(hit.path)) return err(tf('ui.aiActions.dirOpenUnsaved', hit.name));
    await moveToTrash(hit.path);
    return ok(tf('ui.aiActions.moveTrashDone', hit.name));
  },

  async 'book.create'(a) {
    const title = String(a.title);
    let dir = assertInside(await kapi.join(state.root, safeName(title)));
    if (await kapi.exists(dir)) dir += '-' + Date.now().toString(36).slice(-4);
    const books = await listBooks();
    const order = Math.max(0, ...books.map((b) => b.order || 0)) + 1;
    await kapi.writeFile(await kapi.join(dir, 'section.json'),
      JSON.stringify({ guid: guid(), title, order }, null, 2));
    const dr = await kapi.join(dir, 'Draft', 'default');
    const ch = { guid: guid(), title: t('ui.common.chapterOne2'), order: 1, status: 'Outline', act: 'I',
                 date: '', isFavorite: false, folderName: t('ui.common.chapterOne') };
    await kapi.writeFile(await kapi.join(dr, 'draft.json'), JSON.stringify({ chapters: [ch] }, null, 2));
    await kapi.writeFile(await kapi.join(dr, 'scenes.json'), JSON.stringify({ chapters: { [ch.guid]: [] } }, null, 2));
    await kapi.mkdir(await kapi.join(dr, 'Chapters', ch.folderName));
    return ok(tf('ui.aiActions.newBookReadyChapter', title));
  },

  async 'book.delete'(a) {
    const b = await findBook(a.title);
    if (!b) return err(tf('ui.aiActions.notFoundBook2', a.title));
    // [alpha.149] แท็บของฉากในเล่มที่ย้ายไปถังขยะต้องไม่ค้าง · [alpha.159] บันทึกก่อน + รอจนปิดเสร็จ
    if (!(await closeTabsUnder(b.path)).ok) return err(tf('ui.aiActions.dirOpenUnsaved', b.title));   // [alpha.160 · P0-3]
    const dst = await moveToTrash(b.path, { dir: true });
    await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
      { kind: 'section', root: state.root, folderName: b.name }, null, 2));
    return ok(tf('ui.aiActions.moveBookTrashDone', b.title));
  },

  async 'chapter.create'(a) {
    const b = await findBook(a.book);
    if (!b) return err(a.book ? tf('ui.aiActions.notFoundBook2', a.book) : t('ui.aiActions.notHasBookProject'));
    const df = await kapi.join(b.draftPath, 'draft.json');
    let ch = null;
    await mutateJson(kapi, df, (d) => {
      if ((d.chapters || []).some((c) => eq(c.title, a.title))) return false;
      const order = Math.max(0, ...(d.chapters || []).map((c) => c.order || 0)) + 1;
      ch = { guid: guid(), title: String(a.title), order, status: 'Outline', act: 'I', date: '',
             isFavorite: false, folderName: String(order).padStart(2, '0') + ' - ' + safeName(a.title) };
      d.chapters = [...(d.chapters || []), ch];
    }, { fallback: { chapters: [] } });
    if (!ch) return err(tf('ui.aiActions.bookHasChapter', a.title));
    await kapi.mkdir(assertInside(await kapi.join(b.draftPath, 'Chapters', ch.folderName)));
    return ok(tf('ui.aiActions.addChapterDone', a.title, b.title));
  },

  async 'chapter.rename'(a) {
    const b = await findBook(a.book);
    if (!b) return err(t('ui.aiActions.notFoundBook'));
    const c = await findChapter(b, a.title);
    if (!c) return err(tf('ui.aiActions.notFoundChapter', a.title));
    await mutateJson(kapi, c.draftFile, (d) => {
      const row = (d.chapters || []).find((x) => x.guid === c.ch.guid);
      if (!row) return false;
      row.title = String(a.newTitle);
    });
    return ok(tf('ui.aiActions.changeNameChapterDone', a.newTitle));
  },

  async 'chapter.delete'(a) {
    const b = await findBook(a.book);
    if (!b) return err(t('ui.aiActions.notFoundBook'));
    const c = await findChapter(b, a.title);
    if (!c) return err(tf('ui.aiActions.notFoundChapter', a.title));
    const dir = await kapi.join(b.draftPath, 'Chapters', c.ch.folderName);
    const sf = await kapi.join(b.draftPath, 'scenes.json');
    // [alpha.159 · H5] ปิดแท็บ (บันทึกงานค้างก่อน) **ก่อน** อ่านรายชื่อฉาก — บันทึกฉากอัปเดตแถวใน scenes.json
    if (await kapi.exists(dir) && !(await closeTabsUnder(dir)).ok) return err(tf('ui.aiActions.dirOpenUnsaved', a.title));   // [alpha.160 · P0-3]
    let scenes = [];
    await mutateJson(kapi, sf, (sd) => {
      scenes = ((sd.chapters || {})[c.ch.guid] || []).slice();
      if (!sd.chapters || !(c.ch.guid in sd.chapters)) return false;
      delete sd.chapters[c.ch.guid];
    }, { fallback: EMPTY_SCENES });
    if (await kapi.exists(dir)) {
      const dst = await moveToTrash(dir, { dir: true });
      await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
        { kind: 'chapter', dPath: b.draftPath, ch: c.ch, scenes }, null, 2));
    }
    await mutateJson(kapi, c.draftFile, (d) => {
      const before = (d.chapters || []).length;
      d.chapters = (d.chapters || []).filter((x) => x.guid !== c.ch.guid);
      if (d.chapters.length === before) return false;
    });
    return ok(tf('ui.aiActions.delChapterSceneTrash', a.title, scenes.length));
  },

  async 'scene.create'(a) {
    const b = await findBook(a.book);
    if (!b) return err(a.book ? tf('ui.aiActions.notFoundBook2', a.book) : t('ui.aiActions.notHasBookProject'));
    const c = await findChapter(b, a.chapter);
    if (!c) return err(a.chapter ? tf('ui.aiActions.notFoundChapter', a.chapter) : t('ui.common.bookNotHasChapter'));
    const sf = await kapi.join(b.draftPath, 'scenes.json');
    const chDir = await kapi.join(b.draftPath, 'Chapters', c.ch.folderName);
    // [alpha.159 · M3/H5] ชื่อไฟล์ผ่าน freeSceneFileName (ตัวเดียวกับทางคลิก — กันทั้งไฟล์บนดิสก์
    // และชื่อที่แถวอื่นจองไว้) · แถวใหม่เขียนผ่านคิวของ scenes.json · ไฟล์ .md เขียนก่อนแถว
    // (แถวที่ชี้ไฟล์ที่ไม่มี = ฉากผีใน Explorer)
    const snap = await kapi.readJson(sf).catch(() => EMPTY_SCENES());
    const list0 = ((snap.chapters || {})[c.ch.guid]) || [];
    if (list0.some((s) => eq(s.title, a.title))) return err(tf('ui.aiActions.chapterHasScene', a.title));
    const order0 = Math.max(0, ...list0.map((s) => s.order || 0)) + 1;
    const fileName = await freeSceneFileName(b.draftPath, c.ch.folderName, order0, takenSceneFiles(snap));
    const file = assertInside(await kapi.join(chDir, fileName));
    await kapi.writeFile(file, dumpMdFile(
      { title: String(a.title), type: 'scene', format: 'prose', pov: '', tags: [] }, String(a.text || '')));
    let dup = false;
    await mutateJson(kapi, sf, (d) => {
      d.chapters = d.chapters || {};
      const list = d.chapters[c.ch.guid] || [];
      if (list.some((s) => eq(s.title, a.title))) { dup = true; return false; }
      const order = Math.max(0, ...list.map((s) => s.order || 0)) + 1;
      d.chapters[c.ch.guid] = [...list, { id: guid(), title: String(a.title), order, fileName,
        chapterGuid: c.ch.guid, date: '', isFavorite: false, wordCount: 0, synopsis: String(a.synopsis || '') }];
    }, { fallback: EMPTY_SCENES });
    if (dup) { await kapi.remove(file).catch(() => {}); return err(tf('ui.aiActions.chapterHasScene', a.title)); }
    return ok(tf('ui.aiActions.newSceneDone', a.title, b.title, c.ch.title));
  },

  async 'scene.write'(a) {
    const sc = await findScene(a);
    if (!sc) return err(tf('ui.aiActions.notFoundSceneNew', a.title));
    const raw = (await kapi.exists(sc.path)) ? await kapi.readFile(sc.path) : '';
    const { meta, body: diskBody } = parseMdFile(raw);
    const add = String(a.text || '');
    const mode = String(a.mode || 'append');
    const h = tabHandle(sc.path);
    const live = !!(h && h.kind !== 'wiki');
    // [alpha.149] ต่อจาก "เนื้อที่ผู้ใช้เห็นอยู่" — แท็บที่ค้างการแก้ไว้ชนะไฟล์บนดิสก์
    const body = live ? h.getText() : diskBody;
    const next = mode === 'replace' ? add
               : mode === 'prepend' ? (add + (body ? '\n\n' + body : ''))
               : (body ? body.replace(/\s+$/, '') + '\n\n' + add : add);
    const verb = mode === 'replace' ? t('ui.common.overwrite') : mode === 'prepend' ? t('ui.common.insertPage') : t('ui.aiActions.writeNext');
    const msg = tf('ui.aiActions.sceneDoneMergeChar', verb, sc.title, next.length);
    if (live && h.dirty) {
      // แท็บมีงานที่ยังไม่บันทึก → เขียนลงแท็บอย่างเดียว (ห้ามบันทึกงานของผู้ใช้แทนเขาเงียบ ๆ)
      h.setText(next, { keepAlign: mode === 'append' });
      return ok(msg + ' · ' + t('ui.aiActions.openTabUnsaved'));
    }
    // [alpha.159 · M4] พาเธรดคอมเมนต์ไปด้วย — parseMdFile ตัดบล็อก k2-comments ออกแล้ว
    // เขียน dumpMdFile ตรง ๆ = คอมเมนต์ของฉากหายถาวร (ทั้งตอนแท็บเปิดไม่ค้างและตอนไม่ได้เปิด)
    await writeMdKeepingComments(kapi, sc.path, dumpMdFile(meta, next));
    if (live) await h.reloadFromDisk();          // แท็บเห็นของใหม่ทันที · บันทึกทีหลังจะไม่เขียนทับอีก
    return ok(msg);
  },

  async 'scene.rename'(a) {
    const sc = await findScene(a);
    if (!sc) return err(tf('ui.aiActions.notFoundScene', a.title));
    const sf = await kapi.join(sc.draftPath, 'scenes.json');
    await mutateJson(kapi, sf, (d) => {
      let hit = false;
      for (const k of Object.keys(d.chapters || {})) {
        for (const s of d.chapters[k] || []) if (s.id === sc.id) { s.title = String(a.newTitle); hit = true; }
      }
      if (!hit) return false;
    });
    if (await kapi.exists(sc.path)) {
      const { meta, body } = parseMdFile(await kapi.readFile(sc.path));
      // [alpha.159 · M4] เขียนหัวไฟล์ใหม่ต้องไม่ลบเธรดคอมเมนต์ท้ายไฟล์
      await writeMdKeepingComments(kapi, sc.path, dumpMdFile({ ...meta, title: String(a.newTitle) }, body));
    }
    // [alpha.149] แท็บที่เปิดอยู่ถือ meta.title ของเก่า — บันทึกทีหลังจะเขียนชื่อเดิมกลับลงไฟล์
    const h = tabHandle(sc.path);
    if (h) h.rename(String(a.newTitle));
    return ok(tf('ui.aiActions.changeNameSceneDone', a.newTitle));
  },

  async 'scene.delete'(a) {
    const sc = await findScene(a);
    if (!sc) return err(tf('ui.aiActions.notFoundScene', a.title));
    const sf = await kapi.join(sc.draftPath, 'scenes.json');
    const folderName = (sc.path.split(/[\\/]/).slice(-2, -1)[0]) || '';
    // [alpha.149] ไม่งั้นบันทึกแท็บค้าง = ไฟล์ฉากที่ลบไปแล้วเกิดใหม่
    // [alpha.159 · H5] บันทึกงานค้างก่อนปิด (เดิม h.close() = ทิ้ง → ถังขยะได้ฉบับเก่า)
    if (tabHandle(sc.path)) await closeTabsUnder(sc.path);
    if (tabHandle(sc.path)) return err(tf('ui.aiActions.sceneOpenUnsaved', sc.title));   // บันทึกไม่ผ่าน = ไม่ลบ
    if (await kapi.exists(sc.path)) {
      const dst = await moveToTrash(sc.path);
      await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
        { kind: 'scene', dPath: sc.draftPath, folderName, chGuid: sc.chapterId, sc: sc.row }, null, 2));
    }
    await mutateJson(kapi, sf, (d) => {
      let hit = false;
      for (const k of Object.keys(d.chapters || {})) {
        const n0 = (d.chapters[k] || []).length;
        d.chapters[k] = (d.chapters[k] || []).filter((s) => s.id !== sc.id);
        if (d.chapters[k].length !== n0) hit = true;
      }
      if (!hit) return false;
    });
    return ok(tf('ui.aiActions.delSceneTrashDone', sc.title));
  },
};

function normSections(sections, description) {
  if (Array.isArray(sections) && sections.length) {
    return sections.map((s) => ({ title: String((s && s.title) || t('ui.common.desc')), content: String((s && s.content) || '') }));
  }
  return [{ title: t('ui.common.desc'), content: String(description || '') }];
}

/**
 * ย้ายเข้า Recycle/ แบบเดียวกับที่ผู้ใช้ลบเอง (ไม่ถาม เพราะถามไปแล้วตอนยืนยันคำสั่ง)
 * [alpha.162 · W1-4] ชื่อปลายทางมาจาก `trashPathFor` ทางเดียวกับทางคลิก — เดิมประกอบเองแล้วชนกันได้
 */
async function moveToTrash(p, { dir = false } = {}) {
  const dst = await trashPathFor(p, { dir });
  await kapi.move(p, dst);
  return dst;
}

/**
 * ลงมือทำหนึ่งคำสั่ง — ไม่โยน error ออกไป (คืน {ok,message,error,data} เสมอ)
 * ผู้เรียกต้องผ่าน validateCall() มาก่อนแล้ว
 */
export async function runToolCall(call) {
  const h = HANDLERS[call && call.tool];
  if (!h) return { tool: call && call.tool, ok: false, error: t('ui.aiActions.notKnownCmd') };
  if (!state.root) return { tool: call.tool, ok: false, error: t('ui.common.cantOpenProject') };
  try {
    const r = await h(call.args || {});
    return { tool: call.tool, ...r };
  } catch (e) {
    return { tool: call.tool, ok: false, error: String((e && e.message) || e) };
  }
}

/** คำสั่งชุดนี้แตะไฟล์จริงไหม — ถ้าใช่ต้องรีเฟรช explorer/wiki/network หลังทำเสร็จ */
export function touchesProject(results) {
  return (results || []).some((r) => r.ok && !/^(project\.tree|scene\.read|entity\.read)$/.test(r.tool));
}

/** รีเฟรช UI หลัง AI แก้ไฟล์ — import แบบ dynamic กัน circular กับ app.js */
export async function refreshAfterActions() {
  // [alpha.160 · P1-5] ★ AI เขียน/ลบฉากแล้ว ดัชนี RAG ต้องล้าง — เดิมล้างเฉพาะตอนผู้ใช้บันทึกแท็บ (saveTab)
  // → แชท/ผู้ช่วยเขียนตอบจากดัชนีเก่าที่ยังไม่มีสิ่งที่ AI เพิ่งเขียน · ทำก่อน/แยกจากรีเฟรช UI (app.js อาจยังไม่พร้อม)
  try { (await import('./ai-chat-panel.js')).invalidateChatRag(); } catch {}
  try { (await import('../global-search.js')).invalidateSearchIndex(); } catch {}
  try {
    const app = await import('../app.js');
    await app.buildTree();
    await smart.loadNames(state.root);
    app.refreshNetwork();
    setStatus(t('ui.aiActions.aIEditProjectDone'));
  } catch { /* รีเฟรชไม่ได้ไม่ควรทำให้คำสั่งที่สำเร็จไปแล้วกลายเป็นล้มเหลว */ }
}
