// disk-sync.js — [alpha.170] ทำให้ "ชื่อบนดิสก์" กับ "ทะเบียน JSON" ตรงกัน (รับ io = kapi เข้ามา · ไม่แตะ DOM · ไม่ import app.js)
//
// สองทิศ:
//   1. ผู้ใช้เปลี่ยนชื่อ **ในโปรแกรม** → `renameSceneOnDisk` / `renameChapterOnDisk` / `renameSectionOnDisk`
//      ย้ายไฟล์/โฟลเดอร์ให้ตรงชื่อเรื่อง แล้วเขียน title + fileName/folderName ลง JSON ในคิวของไฟล์
//   2. ผู้ใช้เปลี่ยนชื่อ **จาก OS** → `reconcileNames` จับคู่ของหาย/ของโผล่ (disk-names.js) แล้วเขียนชื่อใหม่ลง JSON
//
// ⚠ ตัวนี้ **ไม่รู้จักแท็บ** — ผู้เรียกต้องปิด/ย้ายแท็บเอง (`movePathWithTabs` ของ tab-bridge.js)
// กฎ alpha.156: scenes.json / draft.json / section.json แก้ผ่าน `mutateJson` เท่านั้น · การย้ายไฟล์อยู่ **ในคิว** ของทะเบียน
// (ตัวตรวจการเปลี่ยนชื่อจากภายนอกเข้าคิวเดียวกัน จึงไม่เห็นสภาพ "ย้ายไฟล์แล้วแต่ยังไม่เขียนทะเบียน")
import { diskBase, freeName, nameKey, sameName, stripExt, nameFits, sectionSync, titleAfterRename, isReservedRoot,
         pairSceneRenames, pairSceneMoves, pairChapterRenames, bookNameTaken, defaultBookName } from './disk-names.js';
import { mutateJson } from './json-store.js';
import { parseMdFile, dumpMdFile } from './md.js';
import { writeMdKeepingComments } from './comments/comment-core.js';
import { visFileName } from './visual/vis-core.js';

const dirsOf = async (io, p) => { try { return (await io.listDirs(p)) || []; } catch { return []; } };
const mdOf = async (io, p) => { try { return (await io.listFiles(p, '.md')) || []; } catch { return []; } };
const has = async (io, p) => { try { return !!(await io.exists(p)); } catch { return false; } };
const baseOf = (p) => String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
const parentOf = (p) => String(p || '').replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '');
const maxOrder = (list) => Math.max(0, ...(list || []).map((x) => (x && x.order) || 0));

// ───────────────────────── ชื่อที่ว่างจริง ─────────────────────────

/**
 * ชื่อไฟล์ฉากจากชื่อเรื่อง ที่ไม่ชนทั้ง "ไฟล์บนดิสก์" และ "ชื่อที่แถวใน scenes.json จองไว้"
 * (แถวที่ไฟล์หายไปแล้วก็ยังจองชื่อ — กู้ไฟล์กลับมาทีหลังต้องไม่ได้สองแถวชี้ไฟล์เดียวกัน)
 * @param {string} [self] ชื่อไฟล์ปัจจุบันของฉากนี้เอง (ไม่นับว่าชน)
 */
export async function freeSceneFile(io, dPath, folderName, title, taken = [], self = '') {
  const used = new Set();
  for (const n of taken || []) used.add(nameKey(n));
  for (const f of await mdOf(io, await io.join(dPath, 'Chapters', folderName))) used.add(nameKey(f));
  if (self) used.delete(nameKey(self));
  return freeName(diskBase(title, 'scene'), used, '.md');
}

/** ชื่อโฟลเดอร์บทจากชื่อบท ที่ไม่ชนทั้งโฟลเดอร์บนดิสก์และชื่อที่บทอื่นจองไว้ */
export async function freeChapterFolder(io, dPath, title, taken = [], self = '') {
  const used = new Set();
  for (const n of taken || []) used.add(nameKey(n));
  for (const f of await dirsOf(io, await io.join(dPath, 'Chapters'))) used.add(nameKey(f));
  if (self) used.delete(nameKey(self));
  return freeName(diskBase(title, 'chapter'), used);
}

/**
 * ชื่อเล่มใหม่ (ชื่อเรื่อง + โฟลเดอร์ตรงกันเสมอ)
 * @param {string} [title] ไม่ส่ง = ชื่อเริ่มต้น `Book N` ที่ยังว่าง
 * @returns {Promise<{title:string, folder:string, taken:boolean}>} taken = ชื่อที่ขอชนกับโฟลเดอร์อื่น (folder ถูกต่อเลขให้แล้ว)
 */
export async function freeBookName(io, root, title) {
  const dirs = await dirsOf(io, root);
  if (!title) { const n = defaultBookName([...dirs]); return { title: n, folder: n, taken: false }; }
  const base = diskBase(title, 'Book');
  if (!bookNameTaken(base, dirs)) return { title: String(title), folder: base, taken: false };
  let n = 2, name = `${base} ${n}`;
  while (bookNameTaken(name, dirs)) name = `${base} ${++n}`;
  // เล่ม: ชื่อเรื่องต้องตรงกับโฟลเดอร์ → เลขกันชนติดไปกับชื่อเรื่องด้วย
  return { title: `${String(title).trim()} ${n}`, folder: name, taken: true };
}

// ───────────────────────── เปลี่ยนชื่อในโปรแกรม ─────────────────────────

/** ย้ายตาราง "เล่าด้วยภาพ" (<ฉาก>_vis.csv) ตามไฟล์ฉาก — ไม่ throw */
async function moveVis(io, fromDir, fromFile, toDir, toFile) {
  try {
    const src = await io.join(fromDir, visFileName(fromFile));
    if (!(await has(io, src))) return false;
    const dst = await io.join(toDir, visFileName(toFile));
    if (await has(io, dst)) return false;
    await io.move(src, dst);
    return true;
  } catch { return false; }
}

/**
 * ฉากนี้ต้องย้ายไฟล์ไหมถ้าชื่อเรื่องเป็น `title` — อ่านอย่างเดียว (ผู้เรียกใช้ตัดสินว่าต้องปิดแท็บก่อนหรือเปล่า)
 * @returns {Promise<string>} ชื่อไฟล์ใหม่ ('' = ชื่อปัจจุบันตรงอยู่แล้ว/ไม่เจอแถว)
 */
export async function sceneRenameTarget(io, dPath, ch, sceneId, title) {
  let d; try { d = await io.readJson(await io.join(dPath, 'scenes.json')); } catch { return ''; }
  const rows = ((d && d.chapters) || {})[ch.guid] || [];
  const row = rows.find((r) => r.id === sceneId);
  if (!row || !row.fileName || nameFits(title, row.fileName, '.md')) return '';
  return freeSceneFile(io, dPath, ch.folderName, title, rows.filter((r) => r !== row).map((r) => r.fileName), row.fileName);
}

/**
 * ตั้งชื่อฉาก: frontmatter (แหล่งความจริง) → ย้ายไฟล์ให้ตรงชื่อ → scenes.json
 * @returns {Promise<{ok:boolean, moved:boolean, from:string, to:string, fileName:string, reason?:string}>}
 */
export async function renameSceneOnDisk(io, dPath, ch, sceneId, title) {
  const sf = await io.join(dPath, 'scenes.json');
  const dir = await io.join(dPath, 'Chapters', ch.folderName);
  const out = { ok: false, moved: false, from: '', to: '', fileName: '' };
  await mutateJson(io, sf, async (d) => {
    const rows = ((d && d.chapters) || {})[ch.guid] || [];
    const row = rows.find((r) => r.id === sceneId);
    if (!row || !row.fileName) { out.reason = 'no-row'; return false; }
    const from = await io.join(dir, row.fileName);
    out.from = from; out.to = from; out.fileName = row.fileName;
    // frontmatter ก่อน — ไฟล์หาย/อ่านไม่ได้ = ไม่แตะทะเบียน (ชื่อในทะเบียนกับในไฟล์ต้องไม่แยกทางกัน)
    try {
      const { meta, body } = parseMdFile(await io.readFile(from));
      if (meta.title !== title) { meta.title = title; await writeMdKeepingComments(io, from, dumpMdFile(meta, body)); }
    } catch (e) { out.reason = 'no-file'; out.error = e; return false; }
    let fileName = row.fileName;
    if (!nameFits(title, row.fileName, '.md')) {
      fileName = await freeSceneFile(io, dPath, ch.folderName, title,
        rows.filter((r) => r !== row).map((r) => r.fileName), row.fileName);
      if (!sameName(fileName, row.fileName)) {
        const to = await io.join(dir, fileName);
        await io.move(from, to);
        await moveVis(io, dir, row.fileName, dir, fileName);
        out.moved = true; out.to = to;
      }
    }
    row.title = title; row.fileName = fileName;
    out.ok = true; out.fileName = fileName;
  });
  return out;
}

/**
 * ตั้งชื่อบท: ย้ายโฟลเดอร์ให้ตรงชื่อ → draft.json
 * @returns {Promise<{ok:boolean, moved:boolean, from:string, to:string, folderName:string}>}
 */
export async function renameChapterOnDisk(io, dPath, chGuid, title) {
  const df = await io.join(dPath, 'draft.json');
  const out = { ok: false, moved: false, from: '', to: '', folderName: '' };
  await mutateJson(io, df, async (d) => {
    const list = (d && d.chapters) || [];
    const c = list.find((x) => x.guid === chGuid);
    if (!c) return false;
    const cur = c.folderName || '';
    const from = await io.join(dPath, 'Chapters', cur);
    out.from = from; out.to = from;
    let folderName = cur;
    if (!cur || !nameFits(title, cur)) {
      folderName = await freeChapterFolder(io, dPath, title, list.filter((x) => x !== c).map((x) => x.folderName), cur);
      if (!sameName(folderName, cur)) {
        const to = await io.join(dPath, 'Chapters', folderName);
        if (cur && await has(io, from)) await io.move(from, to); else await io.mkdir(to);
        out.moved = !!cur; out.to = to;
      }
    }
    c.title = title; c.folderName = folderName;
    out.ok = true; out.folderName = folderName;
  });
  return out;
}

/** โฟลเดอร์เล่มที่ชื่อเรื่องนี้ต้องใช้ + ชนกับโฟลเดอร์อื่นไหม (อ่านอย่างเดียว) */
export async function sectionRenameTarget(io, secPath, title) {
  const cur = baseOf(secPath);
  const want = diskBase(title, 'Book');
  if (sameName(want, cur)) return { folder: cur, moves: false, taken: false };
  return { folder: want, moves: true, taken: bookNameTaken(want, await dirsOf(io, parentOf(secPath)), cur) };
}

/**
 * ตั้งชื่อเล่ม: โฟลเดอร์ = ชื่อเล่มเสมอ (ชนกับโฟลเดอร์อื่น = ไม่ทำ คืน `taken`) → section.json
 * @returns {Promise<{ok:boolean, moved:boolean, taken:boolean, from:string, to:string, folderName:string}>}
 */
export async function renameSectionOnDisk(io, secPath, title) {
  const tg = await sectionRenameTarget(io, secPath, title);
  const out = { ok: false, moved: false, taken: tg.taken, from: secPath, to: secPath, folderName: tg.folder };
  if (tg.taken) return out;
  if (tg.moves) {
    const to = await io.join(parentOf(secPath), tg.folder);
    await io.move(secPath, to);
    out.moved = true; out.to = to;
  }
  await mutateJson(io, await io.join(out.to, 'section.json'), (d) => { d.title = title; d.folderName = tg.folder; }, { fallback: {} });
  out.ok = true;
  return out;
}

// ───────────────────────── เปลี่ยนชื่อจาก OS ─────────────────────────

async function metaTitle(io, file) {
  try { const m = parseMdFile(await io.readFile(file)).meta || {}; return { title: m.title != null ? String(m.title) : '' }; }
  catch { return null; }
}

/** เขียน title ลง frontmatter ของไฟล์ (ไม่ throw) */
async function stampTitle(io, file, title) {
  try {
    const { meta, body } = parseMdFile(await io.readFile(file));
    if (meta.title === title) return false;
    meta.title = title;
    await writeMdKeepingComments(io, file, dumpMdFile(meta, body));
    return true;
  } catch { return false; }
}

async function reconcileDraft(io, dPath, changes) {
  const df = await io.join(dPath, 'draft.json');
  const sf = await io.join(dPath, 'scenes.json');
  const chRoot = await io.join(dPath, 'Chapters');
  let draft, scenes;
  try { draft = await io.readJson(df); scenes = await io.readJson(sf); } catch { return; }   // อ่านไม่ออก = เรื่องของตัวตรวจสุขภาพ
  let chapters = (draft && Array.isArray(draft.chapters)) ? draft.chapters : [];
  const rowsBy = (scenes && scenes.chapters && typeof scenes.chapters === 'object') ? scenes.chapters : {};
  const folders = await dirsOf(io, chRoot);
  const folderKeys = new Set(folders.map(nameKey));

  // ── บท ──
  const exact = new Set(folders);
  if (chapters.some((c) => c && c.folderName && !exact.has(c.folderName))) {
    const known = new Set(chapters.map((c) => nameKey(c.folderName || '')));
    const files = {}, metas = {};
    const needMeta = chapters.some((c) => c && c.folderName && !folderKeys.has(nameKey(c.folderName)));
    for (const f of folders) {
      if (known.has(nameKey(f)) || !needMeta) continue;
      files[f] = await mdOf(io, await io.join(chRoot, f));
      for (const fn of files[f]) metas[f + '/' + fn] = await metaTitle(io, await io.join(chRoot, f, fn));
    }
    const res = pairChapterRenames(chapters, folders, rowsBy, (f) => files[f] || [], (f, fn) => metas[f + '/' + fn]);
    if (res.pairs.length) {
      const done = [];
      await mutateJson(io, df, async (d) => {
        let hit = false;
        for (const p of res.pairs) {
          const c = (d.chapters || []).find((x) => x.guid === p.guid);
          if (!c || !sameName(c.folderName, p.from)) continue;                   // มีคนแก้ไปแล้วระหว่างรอคิว
          if (!(await has(io, await io.join(chRoot, p.to)))) continue;
          const oldTitle = c.title || '';
          // เปลี่ยนแค่ตัวพิมพ์ + ชื่อเรื่องไม่ได้ตามโฟลเดอร์อยู่แล้ว = แก้แค่ชื่อโฟลเดอร์ในทะเบียน
          const title = (p.by === 'case' && !nameFits(oldTitle, p.from)) ? oldTitle : titleAfterRename('chapter', p.to, oldTitle);
          c.folderName = p.to; c.title = title; hit = true;
          done.push({ kind: 'chapter', from: await io.join(chRoot, p.from), to: await io.join(chRoot, p.to), oldTitle, title });
        }
        return hit ? undefined : false;
      });
      changes.push(...done);
      try { chapters = (await io.readJson(df)).chapters || chapters; } catch {}
    }
  }

  // ── ฉาก (ในบทเดียวกัน) ──
  const leftMissing = [], leftOrphans = [];
  for (const c of chapters) {
    if (!c || !c.folderName || !folderKeys.has(nameKey(c.folderName))) continue;   // โฟลเดอร์หาย = เรื่องของตัวตรวจสุขภาพ
    const dir = await io.join(chRoot, c.folderName);
    const rows = rowsBy[c.guid] || [];
    const files = await mdOf(io, dir);
    const fileSet = new Set(files);
    const rowKeys = new Set(rows.map((r) => nameKey((r && r.fileName) || '')));
    const anyGone = rows.some((r) => r && r.fileName && !fileSet.has(r.fileName));
    const strays = files.filter((f) => !rowKeys.has(nameKey(f)));
    if (!anyGone) { for (const f of strays) leftOrphans.push({ chGuid: c.guid, folder: c.folderName, file: f }); continue; }
    const metas = {};
    for (const f of strays) metas[f] = await metaTitle(io, await io.join(dir, f));
    const res = pairSceneRenames(rows, files, (f) => metas[f]);
    for (const r of res.missing) leftMissing.push({ chGuid: c.guid, folder: c.folderName, row: r });
    for (const f of res.orphans) leftOrphans.push({ chGuid: c.guid, folder: c.folderName, file: f, title: (metas[f] && metas[f].title) || '' });
    if (!res.pairs.length) continue;
    const done = [];
    await mutateJson(io, sf, async (d) => {
      let hit = false;
      const live = ((d && d.chapters) || {})[c.guid] || [];
      for (const p of res.pairs) {
        const row = live.find((r) => r.id === p.id);
        if (!row || !sameName(row.fileName, p.from)) continue;
        if (!(await has(io, await io.join(dir, p.to)))) continue;
        if (live.some((r) => r !== row && sameName(r.fileName, p.to))) continue;   // ชื่อนั้นมีแถวอื่นถืออยู่
        const oldTitle = row.title || '';
        const nb = stripExt(p.to, '.md');
        const title = (p.by === 'case' && !nameFits(oldTitle, p.from, '.md')) ? oldTitle : titleAfterRename('scene', nb, oldTitle);
        row.fileName = p.to; row.title = title; hit = true;
        done.push({ kind: 'scene', from: await io.join(dir, p.from), to: await io.join(dir, p.to), oldTitle, title, _dir: dir, _from: p.from, _to: p.to });
      }
      return hit ? undefined : false;
    });
    for (const ch of done) {
      await moveVis(io, ch._dir, ch._from, ch._dir, ch._to);
      if (ch.title !== ch.oldTitle) await stampTitle(io, ch.to, ch.title);
      delete ch._dir; delete ch._from; delete ch._to;
    }
    changes.push(...done);
  }

  // ── ฉากที่ถูกลากไปโฟลเดอร์บทอื่น ──
  if (leftMissing.length && leftOrphans.length) {
    for (const o of leftOrphans) {
      if (o.title === undefined) { const m = await metaTitle(io, await io.join(chRoot, o.folder, o.file)); o.title = (m && m.title) || ''; }
    }
    const moves = pairSceneMoves(leftMissing, leftOrphans);
    if (moves.length) {
      const folderOf = (g) => { const c = chapters.find((x) => x.guid === g); return c ? c.folderName : ''; };
      const done = [];
      await mutateJson(io, sf, async (d) => {
        let hit = false;
        d.chapters = d.chapters || {};
        for (const m of moves) {
          const src = d.chapters[m.fromCh] || [];
          const row = src.find((r) => r.id === m.id);
          if (!row || !sameName(row.fileName, m.from)) continue;
          const toDir = await io.join(chRoot, folderOf(m.toCh));
          if (!(await has(io, await io.join(toDir, m.to)))) continue;
          const dst = d.chapters[m.toCh] || [];
          if (dst.some((r) => sameName(r.fileName, m.to))) continue;
          d.chapters[m.fromCh] = src.filter((r) => r !== row);
          row.fileName = m.to; row.chapterGuid = m.toCh; row.order = maxOrder(dst) + 1;
          d.chapters[m.toCh] = [...dst, row];
          hit = true;
          done.push({ kind: 'scene', from: await io.join(chRoot, folderOf(m.fromCh), m.from), to: await io.join(toDir, m.to),
                      oldTitle: row.title || '', title: row.title || '', moved: true,
                      _fromDir: await io.join(chRoot, folderOf(m.fromCh)), _toDir: toDir, _from: m.from, _to: m.to });
        }
        return hit ? undefined : false;
      });
      for (const ch of done) {
        await moveVis(io, ch._fromDir, ch._from, ch._toDir, ch._to);
        delete ch._fromDir; delete ch._toDir; delete ch._from; delete ch._to;
      }
      changes.push(...done);
    }
  }
}

/**
 * ตรวจทั้งโปรเจกต์ว่ามีอะไรถูกเปลี่ยนชื่อ/ย้ายจากนอกโปรแกรม แล้วปรับทะเบียนให้ตรง
 * ลำดับ: เล่ม → บท → ฉาก (ชั้นบนเปลี่ยนก่อน ทางของชั้นล่างถึงจะถูก)
 * @returns {Promise<Array<{kind:'book'|'chapter'|'scene', from:string, to:string, oldTitle:string, title:string, moved?:boolean}>>}
 *   from/to = ทางเต็ม (ของ from ไม่มีอยู่บนดิสก์แล้ว) — ผู้เรียกใช้ย้ายแท็บ/ประวัติเวอร์ชันตาม
 */
export async function reconcileNames(io, root) {
  const changes = [];
  if (!root) return changes;
  for (const name of await dirsOf(io, root)) {
    const secPath = await io.join(root, name);
    const sf = await io.join(secPath, 'section.json');
    if (!(await has(io, sf))) continue;
    let meta; try { meta = await io.readJson(sf); } catch { continue; }
    const s = sectionSync(meta || {}, name);
    // โฟลเดอร์เล่มใช้ชื่อที่โปรแกรมสงวนไว้ (ผู้ใช้เปลี่ยนชื่อจาก OS เป็น Planners/Wiki/…) — ของของโปรแกรมจะปนกับเล่ม
    // และบางชื่อทำให้เล่มหายจาก Explorer · ไม่ย้ายให้เอง (อาจมีของของโปรแกรมอยู่ข้างในแล้ว) แค่รายงานให้ผู้ใช้ตั้งชื่อใหม่
    if (isReservedRoot(name)) changes.push({ kind: 'book', reserved: true, from: secPath, to: secPath, oldTitle: (meta && meta.title) || '', title: name });
    if (s.record) {
      const oldTitle = (meta && meta.title) || '';
      try {
        // โฟลเดอร์ชื่อเดิมยังอยู่ = นี่คือ **สำเนา** ของเล่ม (ก๊อปวางใน OS) ไม่ใช่การเปลี่ยนชื่อ →
        // ได้ชื่อของตัวเอง + guid ใหม่ และห้ามย้ายแท็บ/ประวัติของเล่มต้นฉบับมาให้
        const from = s.renamed ? await io.join(root, meta.folderName) : '';
        const copied = s.renamed && await has(io, await io.join(from, 'section.json'));
        await mutateJson(io, sf, (d) => {
          d.folderName = name;
          if (s.renamed) d.title = s.title;
          if (copied) d.guid = 'k2-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        });
        if (s.renamed) changes.push({ kind: 'book', from, to: secPath, oldTitle, title: s.title, copied });
      } catch { /* เขียนไม่ได้ (อ่านอย่างเดียว) = ข้าม */ }
    }
    for (const dn of await dirsOf(io, await io.join(secPath, 'Draft'))) {
      const dPath = await io.join(secPath, 'Draft', dn);
      if (!(await has(io, await io.join(dPath, 'draft.json')))) continue;
      try { await reconcileDraft(io, dPath, changes); } catch { /* ฉบับร่างนี้พัง = ข้าม ไม่ลากทั้งโปรเจกต์ล้ม */ }
    }
  }
  return changes;
}

// ───────────────────────── ชื่อที่ยังไม่ตรงกับชื่อเรื่อง (ของรุ่นเก่า) ─────────────────────────

/**
 * รายการที่ "ชื่อบนดิสก์ไม่ตรงกับชื่อเรื่อง" — ของรุ่นเก่า (`scene-01.md` · `01 - บทที่หนึ่ง`) หรือชื่อเล่มที่เคยเปลี่ยนโดยโฟลเดอร์ไม่ตาม
 * อ่านอย่างเดียว · ตัวแก้ = เรียก rename*OnDisk ด้วยชื่อเรื่องเดิม (ผู้เรียกดูแลแท็บ)
 * @returns {Promise<Array<{kind:string, title:string, disk:string, secPath:string, dPath?:string, ch?:object, id?:string}>>}
 */
export async function listNameMismatches(io, root) {
  const out = [];
  if (!root) return out;
  for (const name of await dirsOf(io, root)) {
    const secPath = await io.join(root, name);
    const sf = await io.join(secPath, 'section.json');
    if (!(await has(io, sf))) continue;
    let meta; try { meta = await io.readJson(sf); } catch { continue; }
    const title = (meta && meta.title) || name;
    if (!sameName(diskBase(title, 'Book'), name)) out.push({ kind: 'book', title, disk: name, secPath });
    for (const dn of await dirsOf(io, await io.join(secPath, 'Draft'))) {
      const dPath = await io.join(secPath, 'Draft', dn);
      let draft, scenes;
      try { draft = await io.readJson(await io.join(dPath, 'draft.json')); scenes = await io.readJson(await io.join(dPath, 'scenes.json')); } catch { continue; }
      const folders = new Set((await dirsOf(io, await io.join(dPath, 'Chapters'))).map(nameKey));
      for (const c of (draft && draft.chapters) || []) {
        if (!c || !c.folderName || !folders.has(nameKey(c.folderName))) continue;
        if (c.title && !nameFits(c.title, c.folderName)) out.push({ kind: 'chapter', title: c.title || '', disk: c.folderName, secPath, dPath, ch: c });
        const files = new Set((await mdOf(io, await io.join(dPath, 'Chapters', c.folderName))).map(nameKey));
        for (const r of ((scenes && scenes.chapters) || {})[c.guid] || []) {
          if (!r || !r.fileName || !r.title || !files.has(nameKey(r.fileName))) continue;   // ไม่มีชื่อเรื่อง = ไม่มีชื่อให้ตาม
          if (!nameFits(r.title || '', r.fileName, '.md')) out.push({ kind: 'scene', title: r.title || '', disk: r.fileName, secPath, dPath, ch: c, id: r.id });
        }
      }
    }
  }
  return out;
}
