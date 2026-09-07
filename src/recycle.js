// recycle.js — ถังขยะ: ลบไปถังขยะ / กู้คืน / ล้างถังขยะเก่า (retention)
import { t, tf } from './i18n.js';
import { buildTree, closeTab, guid, refreshNetwork } from './app.js';
import { setStatus, smart, state, logAction } from './core.js';
import { confirmBox } from './ui.js';

export async function restoreFromTrash(p, fname) {
  const sidecar = p + '.k2restore.json';
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
      await kapi.move(p, await kapi.join(info.root, info.folderName));
      await kapi.remove(sidecar);
      await buildTree(); smart.loadNames(state.root);
      refreshNetwork();
      setStatus(t('ui.trash.recoverRestoreBookDone')); return;
    }
    if (info.kind === 'scene') {
      const dst = await kapi.join(info.dPath, 'Chapters', info.folderName, info.sc.fileName);
      await kapi.move(p, dst);
      // ตาราง "เล่าด้วยภาพ" ถูกเก็บคู่กันมาเป็น <ไฟล์ในถังขยะ>.vis.csv → กลับไปข้างฉากเหมือนเดิม
      try {
        if (await kapi.exists(p + '.vis.csv'))
          await kapi.move(p + '.vis.csv', dst.replace(/\.md$/i, '') + '_vis.csv');
      } catch {}
      const sf = await kapi.join(info.dPath, 'scenes.json');
      const d = await kapi.readJson(sf);
      d.chapters = d.chapters || {};
      d.chapters[info.chGuid] = [...(d.chapters[info.chGuid] || []), info.sc];
      await kapi.writeFile(sf, JSON.stringify(d, null, 2));
    } else if (info.kind === 'chapter') {
      await kapi.move(p, await kapi.join(info.dPath, 'Chapters', info.ch.folderName));
      const df = await kapi.join(info.dPath, 'draft.json');
      const d = await kapi.readJson(df);
      d.chapters = [...(d.chapters || []), info.ch];
      await kapi.writeFile(df, JSON.stringify(d, null, 2));
      const sf = await kapi.join(info.dPath, 'scenes.json');
      const s2 = await kapi.readJson(sf);
      s2.chapters = s2.chapters || {};
      s2.chapters[info.ch.guid] = info.scenes || [];
      await kapi.writeFile(sf, JSON.stringify(s2, null, 2));
    }
    await kapi.remove(sidecar);
  } else if (fname.endsWith('.json')) {
    // Wiki entity → กลับหมวดเดิมตาม entityTypeKey
    let cat = 'characters';
    try { cat = (await kapi.readJson(p)).entityTypeKey || cat; } catch {}
    const w = await kapi.join(state.root, 'Wiki');
    const base = (await kapi.exists(w)) ? w
      : (await kapi.exists(await kapi.join(state.root, 'Bible')))
        ? await kapi.join(state.root, 'Bible') : w;
    await kapi.mkdir(await kapi.join(base, cat));
    await kapi.move(p, await kapi.join(base, cat, fname.replace(/^[a-z0-9]+-/, '')));
  } else {
    // .md → Memos (ฉากมี sidecar อยู่แล้ว ที่เหลือคือ memo)
    await kapi.mkdir(await kapi.join(state.root, 'Memos'));
    await kapi.move(p, await kapi.join(state.root, 'Memos', fname.replace(/^[a-z0-9]+-/, '')));
  }
  await buildTree(); smart.loadNames(state.root);
  refreshNetwork();
  logAction('recycle', t('ui.trash.recoverRestoreDone'), { from: p, name: fname });
  setStatus(t('ui.trash.recoverRestoreDone'));
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
  const recDir = await kapi.join(root, 'Recycle');
  if (!(await kapi.exists(recDir))) return 0;
  const cutoff = Date.now() - days * 86400000;

  // ── รอบที่ 1: นับว่าจะลบอะไรบ้าง (ยังไม่แตะไฟล์) ──
  const doomed = [];
  for (const name of await kapi.listDirs(recDir).catch(() => [])) {
    const p = await kapi.join(recDir, name);
    if ((await kapi.mtime(p)) < cutoff) doomed.push(p);
  }
  for (const name of await kapi.listFiles(recDir, '').catch(() => [])) {
    if (/\.k2restore\.json$/i.test(name)) continue;     // ใบกู้คืนไปพร้อมของจริง ไม่นับซ้ำ
    const p = await kapi.join(recDir, name);
    if ((await kapi.mtime(p)) < cutoff) doomed.push(p);
  }
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
    try { await kapi.remove(p); await kapi.remove(p + '.k2restore.json').catch(() => {}); purged++; }
    catch { /* ไฟล์ถูกลบไปแล้ว/ถูกล็อก — ข้ามไป ไม่ให้ค้างทั้งชุด */ }
  }
  if (purged) {
    logAction('recycle', tf('ui.trash.clearTrashAutoList', purged, days), doomed);
    setStatus(tf('ui.trash.clearTrashAutoList', purged, days));
  }
  return purged;
}
