// drafts.js — CRUD ฉบับร่าง: สร้าง/ลบ/เปลี่ยนชื่อ/ตั้ง primary
import { t, tf } from './i18n.js';
import { setStatus, state, logAction } from './core.js';
import { confirmBox, ask } from './ui.js';

/**
 * รายชื่อร่างในเล่ม
 * @returns {Promise<Array<{name: string, dPath: string, primary: boolean}>>}
 */
export async function listDraftsForSection(secPath) {
  const draftRoot = await kapi.join(secPath, 'Draft');
  if (!(await kapi.exists(draftRoot))) return [];
  const sf = await kapi.join(secPath, 'section.json');
  let meta = {}; try { meta = await kapi.readJson(sf); } catch {}
  const primary = meta.primaryDraft || 'default';
  const out = [];
  for (const name of await kapi.listDirs(draftRoot)) {
    const dPath = await kapi.join(draftRoot, name);
    const df = await kapi.join(dPath, 'draft.json');
    if (!(await kapi.exists(df))) continue;
    out.push({ name, dPath, primary: name === primary });
  }
  return out;
}

/**
 * ก๊อบเนื้อหาร่าง (ใช้เมื่อ kapi.copyDir ไม่มี)
 */
async function copyDraftContents(src, dst) {
  await kapi.mkdir(dst);
  const df = JSON.parse(await kapi.readFile(await kapi.join(src, 'draft.json')));
  await kapi.writeFile(await kapi.join(dst, 'draft.json'), JSON.stringify(df, null, 2));
  const sf = await kapi.readFile(await kapi.join(src, 'scenes.json'));
  await kapi.writeFile(await kapi.join(dst, 'scenes.json'), sf);
  const chSrc = await kapi.join(src, 'Chapters');
  if (!(await kapi.exists(chSrc))) return;
  await kapi.mkdir(await kapi.join(dst, 'Chapters'));
  for (const ch of df.chapters || []) {
    const from = await kapi.join(chSrc, ch.folderName);
    if (!(await kapi.exists(from))) continue;
    const to = await kapi.join(dst, 'Chapters', ch.folderName);
    await kapi.mkdir(to);
    for (const f of await kapi.listFiles(from, '.md')) {
      await kapi.writeFile(await kapi.join(to, f), await kapi.readFile(await kapi.join(from, f)));
    }
  }
}

/**
 * สร้างร่างใหม่ — ก๊อบโครงสร้างจาก source draft หรือสร้างเปล่า
 */
export async function createDraft(secPath, name, sourceDraft = null) {
  const draftRoot = await kapi.join(secPath, 'Draft');
  await kapi.mkdir(draftRoot);
  const newPath = await kapi.join(draftRoot, name);
  if (await kapi.exists(newPath)) throw new Error(t('ui.drafts.hasDraftNameDone'));

  if (sourceDraft) {
    const srcPath = await kapi.join(draftRoot, sourceDraft);
    if (!(await kapi.exists(srcPath))) throw new Error(t('ui.drafts.notFoundDraftFrom'));
    await copyDraftContents(srcPath, newPath);
  } else {
    const { guid } = await import('./app.js');
    const ch = { guid: guid(), title: t('ui.common.chapterOne2'), order: 1, status: 'Outline',
                 act: 'I', date: '', isFavorite: false, folderName: t('ui.common.chapterOne') };
    await kapi.mkdir(await kapi.join(newPath, 'Chapters', ch.folderName));
    await kapi.writeFile(await kapi.join(newPath, 'draft.json'),
      JSON.stringify({ chapters: [ch] }, null, 2));
    await kapi.writeFile(await kapi.join(newPath, 'scenes.json'),
      JSON.stringify({ chapters: { [ch.guid]: [] } }, null, 2));
  }
  return newPath;
}

/** ลบร่าง (ห้ามลบ primary) */
export async function deleteDraft(secPath, name) {
  const sf = await kapi.join(secPath, 'section.json');
  let meta = {}; try { meta = await kapi.readJson(sf); } catch {}
  if ((meta.primaryDraft || 'default') === name) {
    setStatus(t('ui.drafts.delCantDraftMain')); return false;
  }
  if (!(await confirmBox(tf('ui.drafts.delDraftDraft', name), t('ui.drafts.delDraft')))) return false;
  const dPath = await kapi.join(secPath, 'Draft', name);
  const recycle = await kapi.join(state.root, 'Recycle', 'draft-' + Date.now().toString(36));
  await kapi.move(dPath, recycle);
  logAction('draft', t('ui.drafts.delDraft') + ': ' + name, { from: dPath, trash: recycle });
  return true;
}

/** เปลี่ยนชื่อร่าง */
export async function renameDraft(secPath, oldName, newName) {
  const oldPath = await kapi.join(secPath, 'Draft', oldName);
  const newPath = await kapi.join(secPath, 'Draft', newName);
  if (await kapi.exists(newPath)) { setStatus(t('ui.drafts.hasDraftNameDone')); return false; }
  await kapi.move(oldPath, newPath);
  logAction('draft', tf('ui.drafts.renameDraftTo', oldName, newName), { secPath });
  const sf = await kapi.join(secPath, 'section.json');
  let meta = {}; try { meta = await kapi.readJson(sf); } catch {}
  if ((meta.primaryDraft || 'default') === oldName) {
    meta.primaryDraft = newName;
    await kapi.writeFile(sf, JSON.stringify(meta, null, 2));
  }
  return true;
}

/** ตั้งร่างนี้เป็น primary */
export async function setPrimaryDraft(secPath, name) {
  const sf = await kapi.join(secPath, 'section.json');
  let meta = {}; try { meta = await kapi.readJson(sf); } catch {}
  meta.primaryDraft = name;
  await kapi.writeFile(sf, JSON.stringify(meta, null, 2));
  const { buildTree } = await import('./app.js');
  await buildTree();
}
