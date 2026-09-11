// recycle.js — ถังขยะ: ลบไปถังขยะ / กู้คืน / ล้างถังขยะเก่า (retention)
// ตรรกะที่ไม่แตะดิสก์ (อายุของของในถัง · ชื่อกันชน) อยู่ใน recycle-core.js ซึ่งมี unit test
import { t, tf } from './i18n.js';
import { buildTree, closeTab, guid, refreshNetwork } from './app.js';
import { setStatus, smart, state, logAction } from './core.js';
import { confirmBox } from './ui.js';
import { purgeCandidates, originalName, nameCandidate } from './recycle-core.js';

/**
 * [alpha.148] ชื่อที่ยังว่างในโฟลเดอร์ปลายทาง
 * การย้ายไฟล์ (`fs:move` = rename) **เขียนทับของที่มีอยู่แบบเงียบ ๆ** — เดิมกู้โน้ต "ไอเดีย.md"
 * กลับมาในวันที่มีโน้ตใหม่ชื่อเดียวกันอยู่แล้ว = โน้ตใหม่หายโดยไม่มีอะไรเตือน
 * @param {{dir?: boolean, taken?: Set<string>}} opts taken = ชื่อที่ถูกจองในข้อมูล (แม้ยังไม่มีบนดิสก์)
 */
async function freeName(dir, name, opts = {}) {
  for (let i = 1; i < 500; i++) {
    const cand = nameCandidate(name, i, opts);
    if (opts.taken && opts.taken.has(cand)) continue;
    if (!(await kapi.exists(await kapi.join(dir, cand)))) return cand;
  }
  return nameCandidate(name, Date.now(), opts);
}

export async function restoreFromTrash(p, fname) {
  const sidecar = p + '.k2restore.json';
  let note = '';                    // [alpha.148] บอกผู้ใช้เมื่อกู้คืนแล้วไม่ได้กลับไปอยู่ "ที่เดิมเป๊ะ"
  if (await kapi.exists(sidecar)) {
    const info = await kapi.readJson(sidecar);
    // [alpha.63r4] อัลบั้ม/รูปในคลัง — ก่อนหน้านี้ไม่มี sidecar เลย กดกู้คืนแล้วของไปโผล่ที่ Memos/
    if (info.kind === 'album' || info.kind === 'image') {
      const AC = await import('./gallery/album-core.js');
      await AC.restoreFromRecycle(kapi, info.root || state.root, p, info);
      await kapi.remove(sidecar);
      await buildTree(); smart.loadNames(state.root);
      setStatus(info.kind === 'album' ? t('ui.trash.recoverRestoreAlbumDone') : t('ui.trash.recoverRestoreImageDone'));
      return;
    }
    if (info.kind === 'section') {
      const folder = await freeName(info.root, info.folderName, { dir: true });
      await kapi.move(p, await kapi.join(info.root, folder));
      if (folder !== info.folderName) note = tf('ui.trash.restoredRenamed', folder);
      await kapi.remove(sidecar);
      await buildTree(); smart.loadNames(state.root);
      refreshNetwork();
      setStatus(note || t('ui.trash.recoverRestoreBookDone')); return;
    }
    if (info.kind === 'scene') note = await restoreScene(p, info);
    else if (info.kind === 'chapter') note = await restoreChapter(p, info);
    await kapi.remove(sidecar);
  } else if (fname.endsWith('.json')) {
    // Wiki entity → กลับหมวดเดิมตาม entityTypeKey
    let cat = 'characters';
    try { cat = (await kapi.readJson(p)).entityTypeKey || cat; } catch {}
    const w = await kapi.join(state.root, 'Wiki');
    const base = (await kapi.exists(w)) ? w
      : (await kapi.exists(await kapi.join(state.root, 'Bible')))
        ? await kapi.join(state.root, 'Bible') : w;
    const catDir = await kapi.join(base, cat);
    await kapi.mkdir(catDir);
    const want = originalName(fname);
    const name = await freeName(catDir, want);
    await kapi.move(p, await kapi.join(catDir, name));
    if (name !== want) note = tf('ui.trash.restoredRenamed', name);
  } else {
    // .md → Memos (ฉากมี sidecar อยู่แล้ว ที่เหลือคือ memo)
    const memoDir = await kapi.join(state.root, 'Memos');
    await kapi.mkdir(memoDir);
    const want = originalName(fname);
    const name = await freeName(memoDir, want);
    await kapi.move(p, await kapi.join(memoDir, name));
    if (name !== want) note = tf('ui.trash.restoredRenamed', name);
  }
  await buildTree(); smart.loadNames(state.root);
  refreshNetwork();
  logAction('recycle', t('ui.trash.recoverRestoreDone'), { from: p, name: fname, note });
  setStatus(note || t('ui.trash.recoverRestoreDone'));
}

/** รายชื่อโฟลเดอร์บทที่ถูกจองอยู่ใน draft.json + ชื่อที่ว่างสำหรับบทที่จะกลับเข้ามา */
async function freeChapterFolder(dPath, draft, want) {
  const taken = new Set((draft.chapters || []).map((c) => c.folderName));
  return freeName(await kapi.join(dPath, 'Chapters'), want, { dir: true, taken });
}

/**
 * กู้คืนฉาก
 * [alpha.148] ★ บทของฉากถูกลบตามไปแล้ว → เดิมใส่แถวกลับไปใต้ guid ที่ไม่มีใน draft.json
 * ฉากจึง "กู้คืนสำเร็จ" แต่หายจากต้นไม้ · และถ้ากู้บทนั้นตามมาทีหลัง แถวของฉากถูกทับทิ้ง +
 * rename โฟลเดอร์บททับโฟลเดอร์ที่ไม่ว่างล้ม → ตอนนี้สร้างบทกลับมาให้ (guid เดิม) แล้วค่อยวางฉาก
 */
async function restoreScene(p, info) {
  let note = '';
  const df = await kapi.join(info.dPath, 'draft.json');
  const draft = await kapi.readJson(df).catch(() => ({}));
  draft.chapters = draft.chapters || [];
  let ch = draft.chapters.find((c) => c.guid === info.chGuid);
  if (!ch) {
    const folder = await freeChapterFolder(info.dPath, draft, info.folderName);
    const order = Math.max(0, ...draft.chapters.map((c) => c.order || 0)) + 1;
    const title = String(info.folderName || '').replace(/^\d+\s*-\s*/, '') || t('ui.common.chapter');
    ch = { guid: info.chGuid, title, order, status: 'Outline', act: 'I', date: '',
           isFavorite: false, folderName: folder, restoredFromScene: true };
    draft.chapters.push(ch);
    await kapi.writeFile(df, JSON.stringify(draft, null, 2));
    note = tf('ui.trash.restoredChapterRebuilt', title);
  }
  const chDir = await kapi.join(info.dPath, 'Chapters', ch.folderName);
  await kapi.mkdir(chDir);
  const sc = { ...info.sc };
  const fileName = await freeName(chDir, sc.fileName);
  if (fileName !== sc.fileName) { note = note || tf('ui.trash.restoredRenamed', fileName); sc.fileName = fileName; }
  const dst = await kapi.join(chDir, fileName);
  await kapi.move(p, dst);
  // ตาราง "เล่าด้วยภาพ" ถูกเก็บคู่กันมาเป็น <ไฟล์ในถังขยะ>.vis.csv → กลับไปข้างฉากเหมือนเดิม
  try {
    const visDst = dst.replace(/\.md$/i, '') + '_vis.csv';
    if (await kapi.exists(p + '.vis.csv') && !(await kapi.exists(visDst))) await kapi.move(p + '.vis.csv', visDst);
  } catch {}
  const sf = await kapi.join(info.dPath, 'scenes.json');
  const d = await kapi.readJson(sf).catch(() => ({}));
  d.chapters = d.chapters || {};
  const rows = d.chapters[ch.guid] || [];
  d.chapters[ch.guid] = rows.some((r) => r.id === sc.id)
    ? rows.map((r) => (r.id === sc.id ? sc : r)) : [...rows, sc];
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  return note;
}

/**
 * กู้คืนบท
 * [alpha.148] guid ของบทมีอยู่แล้ว (ฉากของมันถูกกู้ไปก่อน) → **รวม** เข้าบทนั้นทีละไฟล์ แทนการ rename
 * ทั้งโฟลเดอร์ทับ · ชื่อโฟลเดอร์ชนกับบทอื่น → ตั้งชื่อใหม่ ไม่ทับ
 */
async function restoreChapter(p, info) {
  let note = '';
  const df = await kapi.join(info.dPath, 'draft.json');
  const draft = await kapi.readJson(df).catch(() => ({}));
  draft.chapters = draft.chapters || [];
  const sf = await kapi.join(info.dPath, 'scenes.json');
  const s2 = await kapi.readJson(sf).catch(() => ({}));
  s2.chapters = s2.chapters || {};
  const scenes = info.scenes || [];
  const existing = draft.chapters.find((c) => c.guid === info.ch.guid);
  if (existing) {
    const dstDir = await kapi.join(info.dPath, 'Chapters', existing.folderName);
    await kapi.mkdir(dstDir);
    const renamed = new Map();
    for (const f of await kapi.listFiles(p, '').catch(() => [])) {
      const nm = await freeName(dstDir, f);
      await kapi.move(await kapi.join(p, f), await kapi.join(dstDir, nm));
      if (nm !== f) renamed.set(f, nm);
    }
    for (const dn of await kapi.listDirs(p).catch(() => [])) {
      const nm = await freeName(dstDir, dn, { dir: true });
      await kapi.move(await kapi.join(p, dn), await kapi.join(dstDir, nm));
    }
    await kapi.remove(p);
    const rows = [...(s2.chapters[existing.guid] || [])];
    for (const sc of scenes) {
      if (rows.some((r) => r.id === sc.id)) continue;
      rows.push(renamed.has(sc.fileName) ? { ...sc, fileName: renamed.get(sc.fileName) } : sc);
    }
    s2.chapters[existing.guid] = rows;
    // บทที่ถูกสร้างแทนชั่วคราวตอนกู้ฉาก → ได้ชื่อ/สถานะจริงของตัวเองกลับมา (โฟลเดอร์คงไว้ที่เดิม)
    Object.assign(existing, { ...info.ch, folderName: existing.folderName });
    delete existing.restoredFromScene;
  } else {
    const folder = await freeChapterFolder(info.dPath, draft, info.ch.folderName);
    await kapi.move(p, await kapi.join(info.dPath, 'Chapters', folder));
    if (folder !== info.ch.folderName) note = tf('ui.trash.restoredRenamed', folder);
    draft.chapters = [...draft.chapters, { ...info.ch, folderName: folder }];
    const rows = [...(s2.chapters[info.ch.guid] || [])];
    for (const sc of scenes) if (!rows.some((r) => r.id === sc.id)) rows.push(sc);
    s2.chapters[info.ch.guid] = rows;
  }
  await kapi.writeFile(df, JSON.stringify(draft, null, 2));
  await kapi.writeFile(sf, JSON.stringify(s2, null, 2));
  return note;
}

export async function deleteToTrash(file, label) {
  if (!(await confirmBox(tf('ui.trash.delMoveTrashProject', label)))) return null;
  const base = file.split(/[\\/]/).pop();
  const dst = await kapi.join(state.root, 'Recycle', Date.now().toString(36) + '-' + base);
  await kapi.move(file, dst);
  if (state.tabs.has(file)) { state.tabs.get(file).dirty = false; closeTab(file); }
  await buildTree(); smart.loadNames(state.root);
  refreshNetwork();
  // [alpha.128] การลบเป็นสิ่งที่ต้องไล่ย้อนได้ที่สุด แต่เดิมไม่มีร่องรอยในบันทึกเลยสักบรรทัด
  // (คำสั่งพวกนี้มาจากเมนูคลิกขวา จึงไม่ผ่าน handleCommand ที่จด `cmd:` ให้)
  logAction('recycle', t('ui.trash.moveTrash') + label, { from: file, to: dst });
  setStatus(t('ui.trash.moveTrash') + label);
  return dst;
}

/**
 * โปรเจกต์ที่ผู้ใช้ตอบ "เก็บไว้ก่อน" ไปแล้วในรอบนี้ — ไม่ถามซ้ำจนกว่าจะเปิดโปรแกรมใหม่
 * (ES module: ค่าที่ reassign ข้ามไฟล์ต้องอยู่ใน object — กฎเหล็กข้อ 2 ของ AGENTS.md)
 */
const PURGE_C = { skipped: new Set() };

/**
 * [alpha.148] ของในถังที่เกินอายุ (path เต็ม) — **นับจากเวลาที่ลบ** ซึ่งฝังอยู่ในชื่อ ไม่ใช่ mtime
 * (ย้ายลงถัง = rename ซึ่งไม่เปลี่ยน mtime → ของที่เพิ่งลบแต่แก้ครั้งสุดท้ายนานแล้วถูกนับว่า "เก่า")
 * ไฟล์ประกอบ `.k2restore.json`/`.vis.csv` ไม่นับเป็นรายการ → ตัวเลขในกล่องตรงกับที่เห็นในต้นไม้
 */
export async function listPurgeable(root, days = parseInt(state.settings.recycleDays, 10) || 0, now = Date.now()) {
  if (!root || !(days > 0)) return [];
  const recDir = await kapi.join(root, 'Recycle');
  if (!(await kapi.exists(recDir))) return [];
  const names = [...await kapi.listDirs(recDir).catch(() => []),
                 ...await kapi.listFiles(recDir, '').catch(() => [])];
  const entries = [];
  for (const name of names) entries.push({ name, mtime: await kapi.mtime(await kapi.join(recDir, name)) });
  const out = [];
  for (const name of purgeCandidates(entries, days, now)) out.push(await kapi.join(recDir, name));
  return out;
}

/**
 * ล้างถังขยะที่เกินอายุ — [alpha.124 ข้อ 16] **ต้องถามก่อนเสมอ**
 *
 * เดิมลบถาวรทันทีตอนเปิดโปรเจกต์ โดยผู้ใช้ไม่มีทางรู้ล่วงหน้าเลยว่ากำลังจะเสียอะไร
 * (มีแค่ข้อความบนแถบสถานะ *หลัง* ลบเสร็จ ซึ่งหายไปในไม่กี่วินาที) — กลับมาอีกเดือน
 * แล้วงานที่ลบทิ้งไว้ "เผื่อเปลี่ยนใจ" หายเกลี้ยงแบบไม่มีทางกู้
 *
 * ตอนนี้: นับก่อน → ถาม → ลบเฉพาะเมื่อผู้ใช้ยืนยัน · ตอบไม่ = เก็บไว้ ไม่ถามซ้ำในรอบนี้
 * @param {boolean} silent ข้ามการถาม (เทส/โหมดอัตโนมัติ) — ไม่ลบอะไรเลยถ้าไม่ได้ยืนยัน
 */
export async function purgeRecycle(root, { silent = false, force = false } = {}) {
  const days = parseInt(state.settings.recycleDays, 10) || 0;
  if (days <= 0) return 0;
  // สั่งเองจากเมนูคลิกขวาถังขยะ = ต้องถามใหม่เสมอ แม้เพิ่งตอบ "เก็บไว้ก่อน" ไปเมื่อกี้
  if (force) PURGE_C.skipped.delete(root);
  else if (PURGE_C.skipped.has(root)) return 0;

  // ── รอบที่ 1: นับว่าจะลบอะไรบ้าง (ยังไม่แตะไฟล์) ──
  const doomed = await listPurgeable(root, days);
  if (!doomed.length) return 0;

  // ── รอบที่ 2: ถาม แล้วค่อยลบ ──
  if (silent) return 0;
  if (!(await confirmBox(tf('ui.trash.purgeAsk', doomed.length, days), t('ui.trash.purgeGo')))) {
    PURGE_C.skipped.add(root);
    setStatus(tf('ui.trash.purgeKept', doomed.length));
    return 0;
  }
  let purged = 0;
  for (const p of doomed) {
    try {
      await kapi.remove(p);
      // ไฟล์ประกอบไปพร้อมของจริง (ใบกู้คืน · ตารางเล่าด้วยภาพ)
      await kapi.remove(p + '.k2restore.json').catch(() => {});
      await kapi.remove(p + '.vis.csv').catch(() => {});
      purged++;
    } catch { /* ไฟล์ถูกลบไปแล้ว/ถูกล็อก — ข้ามไป ไม่ให้ค้างทั้งชุด */ }
  }
  if (purged) {
    logAction('recycle', tf('ui.trash.clearTrashAutoList', purged, days), doomed);
    setStatus(tf('ui.trash.clearTrashAutoList', purged, days));
  }
  return purged;
}
