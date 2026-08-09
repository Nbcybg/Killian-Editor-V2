// ai-actions.js — [alpha.63r4] ตัวลงมือทำจริงของคำสั่งที่ AI สั่ง (ai-tools.js เป็นคนแกะคำสั่ง)
//
// เขียนไฟล์ตามรูปแบบเดียวกับที่ผู้ใช้กดเองใน explorer เป๊ะ ๆ:
//   เล่ม  = <root>/<ชื่อ>/section.json + Draft/default/{draft.json,scenes.json,Chapters/}
//   บท    = draft.json.chapters[] + โฟลเดอร์ Chapters/<NN - ชื่อ>/
//   ฉาก   = scenes.json.chapters[<guid บท>][] + ไฟล์ .md ที่มี front-matter
//   เอนทิตี้ = Wiki/<หมวด>/<ชื่อ>-<ts36>.json
// ทำแบบนี้เพราะฟังก์ชันใน scene-ops/section-ops/wiki-ui เปิดกล่องถามชื่อเสมอ (สั่งจากโค้ดไม่ได้)
// การลบใช้ deleteToTrash เดิม → ได้ sidecar กู้คืนเหมือนที่ผู้ใช้ลบเอง

import { state, setStatus, smart } from '../core.js';
import { dumpMdFile, parseMdFile } from '../md.js';
import { listScenes, listEntities } from '../project-scan.js';

const SKIP_DIRS = ['Wiki', 'Bible', 'Images', 'Memos', 'Research', 'Snapshots', 'Plugins', 'Recycle', 'Sessions'];

const guid = () => 'k2-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim() || 'untitled';
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
async function findScene({ title, book, chapter }) {
  const all = await listScenes(state.root);
  let rows = all.filter((s) => eq(s.title, title));
  if (!rows.length) return null;
  if (book) {
    const b = await findBook(book);
    if (b) rows = rows.filter((s) => s.section === b.name) || rows;
  }
  if (chapter && rows.length > 1) {
    const b = await findBook(book);
    if (b) {
      const c = await findChapter(b, chapter);
      if (c) rows = rows.filter((s) => s.chapterId === c.ch.guid) || rows;
    }
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
    return ok('อ่านโครงสร้างแล้ว', { books: tree, entities: ents });
  },

  async 'scene.read'(a) {
    const sc = await findScene(a);
    if (!sc) return err(`ไม่พบฉาก "${a.title}"`);
    const raw = (await kapi.exists(sc.path)) ? await kapi.readFile(sc.path) : '';
    const { meta, body } = parseMdFile(raw);
    return ok(`อ่านฉาก "${sc.title}" แล้ว`, { title: sc.title, book: sc.section, meta, text: body });
  },

  async 'entity.read'(a) {
    const e = await findEntityFile(a.name);
    if (!e) return err(`ไม่พบเอนทิตี้ "${a.name}"`);
    return ok(`อ่าน "${e.name}" แล้ว`, e.entity);
  },

  async 'entity.create'(a) {
    if (await findEntityFile(a.name)) return err(`มี "${a.name}" อยู่แล้ว — ใช้ entity.update แทน`);
    const cat = String(a.cat || 'characters').trim();
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
    return ok(`สร้าง "${a.name}" ในหมวด ${cat} แล้ว`);
  },

  async 'entity.update'(a) {
    const hit = await findEntityFile(a.name);
    if (!hit) return err(`ไม่พบเอนทิตี้ "${a.name}"`);
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
    await kapi.writeFile(hit.path, JSON.stringify(e, null, 2));
    return ok(`แก้ "${hit.name}" แล้ว`);
  },

  async 'entity.delete'(a) {
    const hit = await findEntityFile(a.name);
    if (!hit) return err(`ไม่พบเอนทิตี้ "${a.name}"`);
    await moveToTrash(hit.path);
    return ok(`ย้าย "${hit.name}" ไปถังขยะแล้ว`);
  },

  async 'book.create'(a) {
    const title = String(a.title);
    let dir = await kapi.join(state.root, safeName(title));
    if (await kapi.exists(dir)) dir += '-' + Date.now().toString(36).slice(-4);
    const books = await listBooks();
    const order = Math.max(0, ...books.map((b) => b.order || 0)) + 1;
    await kapi.writeFile(await kapi.join(dir, 'section.json'),
      JSON.stringify({ guid: guid(), title, order }, null, 2));
    const dr = await kapi.join(dir, 'Draft', 'default');
    const ch = { guid: guid(), title: 'บทที่หนึ่ง', order: 1, status: 'Outline', act: 'I',
                 date: '', isFavorite: false, folderName: '01 - บทที่หนึ่ง' };
    await kapi.writeFile(await kapi.join(dr, 'draft.json'), JSON.stringify({ chapters: [ch] }, null, 2));
    await kapi.writeFile(await kapi.join(dr, 'scenes.json'), JSON.stringify({ chapters: { [ch.guid]: [] } }, null, 2));
    await kapi.mkdir(await kapi.join(dr, 'Chapters', ch.folderName));
    return ok(`สร้างเล่ม "${title}" พร้อมบทแรกแล้ว`);
  },

  async 'book.delete'(a) {
    const b = await findBook(a.title);
    if (!b) return err(`ไม่พบเล่ม "${a.title}"`);
    const dst = await moveToTrash(b.path);
    await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
      { kind: 'section', root: state.root, folderName: b.name }, null, 2));
    return ok(`ย้ายเล่ม "${b.title}" ไปถังขยะแล้ว`);
  },

  async 'chapter.create'(a) {
    const b = await findBook(a.book);
    if (!b) return err(a.book ? `ไม่พบเล่ม "${a.book}"` : 'ยังไม่มีเล่มในโปรเจกต์ — สร้างด้วย book.create ก่อน');
    const df = await kapi.join(b.draftPath, 'draft.json');
    const d = (await kapi.exists(df)) ? await kapi.readJson(df) : { chapters: [] };
    if ((d.chapters || []).some((c) => eq(c.title, a.title))) return err(`เล่มนี้มีบท "${a.title}" อยู่แล้ว`);
    const order = Math.max(0, ...(d.chapters || []).map((c) => c.order || 0)) + 1;
    const ch = { guid: guid(), title: String(a.title), order, status: 'Outline', act: 'I', date: '',
                 isFavorite: false, folderName: String(order).padStart(2, '0') + ' - ' + safeName(a.title) };
    d.chapters = [...(d.chapters || []), ch];
    await kapi.writeFile(df, JSON.stringify(d, null, 2));
    await kapi.mkdir(await kapi.join(b.draftPath, 'Chapters', ch.folderName));
    return ok(`เพิ่มบท "${a.title}" ใน "${b.title}" แล้ว`);
  },

  async 'chapter.rename'(a) {
    const b = await findBook(a.book);
    if (!b) return err('ไม่พบเล่ม');
    const c = await findChapter(b, a.title);
    if (!c) return err(`ไม่พบบท "${a.title}"`);
    c.ch.title = String(a.newTitle);
    c.draft.chapters = c.draft.chapters.map((x) => (x.guid === c.ch.guid ? c.ch : x));
    await kapi.writeFile(c.draftFile, JSON.stringify(c.draft, null, 2));
    return ok(`เปลี่ยนชื่อบทเป็น "${a.newTitle}" แล้ว (โฟลเดอร์คงชื่อเดิมไว้ ลิงก์ในต้นฉบับจึงไม่พัง)`);
  },

  async 'chapter.delete'(a) {
    const b = await findBook(a.book);
    if (!b) return err('ไม่พบเล่ม');
    const c = await findChapter(b, a.title);
    if (!c) return err(`ไม่พบบท "${a.title}"`);
    const dir = await kapi.join(b.draftPath, 'Chapters', c.ch.folderName);
    const sf = await kapi.join(b.draftPath, 'scenes.json');
    const sdata = (await kapi.exists(sf)) ? await kapi.readJson(sf) : { chapters: {} };
    const scenes = (sdata.chapters || {})[c.ch.guid] || [];
    if (await kapi.exists(dir)) {
      const dst = await moveToTrash(dir);
      await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
        { kind: 'chapter', dPath: b.draftPath, ch: c.ch, scenes }, null, 2));
    }
    c.draft.chapters = (c.draft.chapters || []).filter((x) => x.guid !== c.ch.guid);
    await kapi.writeFile(c.draftFile, JSON.stringify(c.draft, null, 2));
    if (sdata.chapters) delete sdata.chapters[c.ch.guid];
    await kapi.writeFile(sf, JSON.stringify(sdata, null, 2));
    return ok(`ลบบท "${a.title}" (${scenes.length} ฉาก) ไปถังขยะแล้ว`);
  },

  async 'scene.create'(a) {
    const b = await findBook(a.book);
    if (!b) return err(a.book ? `ไม่พบเล่ม "${a.book}"` : 'ยังไม่มีเล่มในโปรเจกต์ — สร้างด้วย book.create ก่อน');
    const c = await findChapter(b, a.chapter);
    if (!c) return err(a.chapter ? `ไม่พบบท "${a.chapter}"` : 'เล่มนี้ยังไม่มีบท');
    const sf = await kapi.join(b.draftPath, 'scenes.json');
    const d = (await kapi.exists(sf)) ? await kapi.readJson(sf) : { chapters: {} };
    d.chapters = d.chapters || {};
    const list = d.chapters[c.ch.guid] || [];
    if (list.some((s) => eq(s.title, a.title))) return err(`บทนี้มีฉาก "${a.title}" อยู่แล้ว`);
    const order = Math.max(0, ...list.map((s) => s.order || 0)) + 1;
    const sc = { id: guid(), title: String(a.title), order,
                 fileName: 'scene-' + String(order).padStart(2, '0') + '.md',
                 chapterGuid: c.ch.guid, date: '', isFavorite: false, wordCount: 0,
                 synopsis: String(a.synopsis || '') };
    d.chapters[c.ch.guid] = [...list, sc];
    const file = await kapi.join(b.draftPath, 'Chapters', c.ch.folderName, sc.fileName);
    await kapi.writeFile(file, dumpMdFile(
      { title: sc.title, type: 'scene', format: 'prose', pov: '', tags: [] }, String(a.text || '')));
    await kapi.writeFile(sf, JSON.stringify(d, null, 2));
    return ok(`สร้างฉาก "${a.title}" ใน "${b.title} › ${c.ch.title}" แล้ว`);
  },

  async 'scene.write'(a) {
    const sc = await findScene(a);
    if (!sc) return err(`ไม่พบฉาก "${a.title}" — สร้างก่อนด้วย scene.create`);
    const raw = (await kapi.exists(sc.path)) ? await kapi.readFile(sc.path) : '';
    const { meta, body } = parseMdFile(raw);
    const add = String(a.text || '');
    const mode = String(a.mode || 'append');
    const next = mode === 'replace' ? add
               : mode === 'prepend' ? (add + (body ? '\n\n' + body : ''))
               : (body ? body.replace(/\s+$/, '') + '\n\n' + add : add);
    await kapi.writeFile(sc.path, dumpMdFile(meta, next));
    const verb = mode === 'replace' ? 'เขียนทับ' : mode === 'prepend' ? 'แทรกหน้า' : 'เขียนต่อ';
    return ok(`${verb}ฉาก "${sc.title}" แล้ว (รวม ${next.length} ตัวอักษร)`);
  },

  async 'scene.rename'(a) {
    const sc = await findScene(a);
    if (!sc) return err(`ไม่พบฉาก "${a.title}"`);
    const sf = await kapi.join(sc.draftPath, 'scenes.json');
    const d = await kapi.readJson(sf);
    for (const k of Object.keys(d.chapters || {})) {
      d.chapters[k] = (d.chapters[k] || []).map((s) => (s.id === sc.id ? { ...s, title: String(a.newTitle) } : s));
    }
    await kapi.writeFile(sf, JSON.stringify(d, null, 2));
    if (await kapi.exists(sc.path)) {
      const { meta, body } = parseMdFile(await kapi.readFile(sc.path));
      await kapi.writeFile(sc.path, dumpMdFile({ ...meta, title: String(a.newTitle) }, body));
    }
    return ok(`เปลี่ยนชื่อฉากเป็น "${a.newTitle}" แล้ว`);
  },

  async 'scene.delete'(a) {
    const sc = await findScene(a);
    if (!sc) return err(`ไม่พบฉาก "${a.title}"`);
    const sf = await kapi.join(sc.draftPath, 'scenes.json');
    const d = await kapi.readJson(sf);
    const folderName = (sc.path.split(/[\\/]/).slice(-2, -1)[0]) || '';
    if (await kapi.exists(sc.path)) {
      const dst = await moveToTrash(sc.path);
      await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
        { kind: 'scene', dPath: sc.draftPath, folderName, chGuid: sc.chapterId, sc: sc.row }, null, 2));
    }
    for (const k of Object.keys(d.chapters || {})) {
      d.chapters[k] = (d.chapters[k] || []).filter((s) => s.id !== sc.id);
    }
    await kapi.writeFile(sf, JSON.stringify(d, null, 2));
    return ok(`ลบฉาก "${sc.title}" ไปถังขยะแล้ว`);
  },
};

function normSections(sections, description) {
  if (Array.isArray(sections) && sections.length) {
    return sections.map((s) => ({ title: String((s && s.title) || 'คำอธิบาย'), content: String((s && s.content) || '') }));
  }
  return [{ title: 'คำอธิบาย', content: String(description || '') }];
}

/** ย้ายเข้า Recycle/ แบบเดียวกับที่ผู้ใช้ลบเอง (ไม่ถาม เพราะถามไปแล้วตอนยืนยันคำสั่ง) */
async function moveToTrash(p) {
  const base = String(p).split(/[\\/]/).pop();
  const dst = await kapi.join(state.root, 'Recycle', Date.now().toString(36) + '-' + base);
  await kapi.move(p, dst);
  return dst;
}

/**
 * ลงมือทำหนึ่งคำสั่ง — ไม่โยน error ออกไป (คืน {ok,message,error,data} เสมอ)
 * ผู้เรียกต้องผ่าน validateCall() มาก่อนแล้ว
 */
export async function runToolCall(call) {
  const h = HANDLERS[call && call.tool];
  if (!h) return { tool: call && call.tool, ok: false, error: 'ไม่รู้จักคำสั่ง' };
  if (!state.root) return { tool: call.tool, ok: false, error: 'ยังไม่ได้เปิดโปรเจกต์' };
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
  try {
    const app = await import('../app.js');
    await app.buildTree();
    await smart.loadNames(state.root);
    app.refreshNetwork();
    setStatus('AI แก้ไขโปรเจกต์แล้ว — รีเฟรชรายการเรียบร้อย');
  } catch { /* รีเฟรชไม่ได้ไม่ควรทำให้คำสั่งที่สำเร็จไปแล้วกลายเป็นล้มเหลว */ }
}
