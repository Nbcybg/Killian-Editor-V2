// project-scan.js — เดินทั้งโปรเจกต์เพื่อเก็บฉาก/เอนทิตี้ Wiki (ที่เดียว ใช้ร่วมกันทุกโมดูล)
//
// สำคัญ: **folderName ของบทอยู่ใน draft.json ไม่ใช่ scenes.json**
// โค้ดรอบก่อนใช้ `sc.folderName || chapterId` → path ผิด อ่านไฟล์ไม่เจอ (เงียบ ๆ)
// ทำให้ backlinks/plot-hole/AI chat เห็นเนื้อหาเป็นค่าว่างทั้งหมด
import { t } from './i18n.js';
import { log, state } from './core.js';

// ---- io adapter ที่ join เป็น sync ----
// เอนจินบริสุทธิ์ (KanbanBoard/importScrivener/KeyStore) เรียก io.join(...) แบบ sync
// แต่ `kapi.join` เป็น async (IPC) → ถ้าส่ง kapi ตรง ๆ จะได้ Promise เป็น path
// แล้วโยนกลับเข้า IPC จะพังด้วย "An object could not be cloned"
export function pathSep(sample) {
  const s = sample || (state && state.root) || '';
  if (s.includes('\\')) return '\\';
  if (s.includes('/')) return '/';
  return (typeof navigator !== 'undefined' && /win/i.test(navigator.platform || '')) ? '\\' : '/';
}
export function joinSync(...parts) {
  const sep = pathSep(parts[0]);
  return parts.filter((p) => p != null && p !== '').join(sep).replace(/[\\/]+/g, sep === '\\' ? '\\' : '/');
}
export function syncIo() {
  return {
    join: joinSync,
    exists: (p) => kapi.exists(p),
    readFile: (p) => kapi.readFile(p),
    readJson: (p) => kapi.readJson(p),
    writeFile: (p, c) => kapi.writeFile(p, c),
    mkdir: (p) => kapi.mkdir(p),
    listFiles: (p, ext) => kapi.listFiles(p, ext),
    listDirs: (p) => kapi.listDirs(p),
    move: (a, b) => kapi.move(a, b),
    remove: (p) => kapi.remove(p),
  };
}

export const SKIP_DIRS = ['Images', 'Memos', 'Recycle', 'Snapshots', 'Backups', 'Plugins', 'Research',
                          'Analysis'];   // [alpha.89r] เซสชันผลวิเคราะห์ ไม่ใช่เนื้อเรื่อง
export const WIKI_DIRS = ['Wiki', 'Bible'];

/** chapterGuid → folderName จาก draft.json */
export async function chapterFolders(draftPath) {
  const map = {};
  try {
    const dj = await kapi.readJson(await kapi.join(draftPath, 'draft.json'));
    for (const ch of (dj.chapters || [])) if (ch.guid) map[ch.guid] = ch.folderName || ch.guid;
  } catch { /* ไม่มี draft.json = ใช้ fallback ด้านล่าง */ }
  return map;
}

/** path จริงของไฟล์ฉาก (folders = ผลจาก chapterFolders) */
export async function scenePath(draftPath, chapterId, sc, folders) {
  const folder = (folders && folders[chapterId]) || sc.folderName || chapterId;
  return kapi.join(draftPath, 'Chapters', folder, sc.fileName || (sc.id + '.md'));
}

/**
 * ฉากทั้งโปรเจกต์
 * @returns {Promise<Array<{id,title,chapterId,path,draftPath,section,draft,row}>>}
 */
export async function listScenes(root, { withText = false } = {}) {
  const out = [];
  if (!root) return out;
  let secs = [];
  try { secs = await kapi.listDirs(root); } catch { return out; }
  for (const sec of secs) {
    if (WIKI_DIRS.includes(sec) || SKIP_DIRS.includes(sec)) continue;
    const dr = await kapi.join(await kapi.join(root, sec), 'Draft');
    if (!(await kapi.exists(dr))) continue;
    let drafts = [];
    try { drafts = await kapi.listDirs(dr); } catch { continue; }
    for (const dn of drafts) {
      const dp = await kapi.join(dr, dn);
      const scFile = await kapi.join(dp, 'scenes.json');
      if (!(await kapi.exists(scFile))) continue;
      let sdata;
      try { sdata = await kapi.readJson(scFile); } catch { continue; }
      const folders = await chapterFolders(dp);
      for (const chId of Object.keys(sdata.chapters || {})) {
        for (const sc of (sdata.chapters[chId] || [])) {
          if (sc.type === 'memo') continue;
          const p = await scenePath(dp, chId, sc, folders);
          const row = { id: sc.id, title: sc.title || sc.fileName || '', chapterId: chId,
                        path: p, draftPath: dp, section: sec, draft: dn, row: sc };
          if (withText) {
            try { row.text = (await kapi.exists(p)) ? await kapi.readFile(p) : ''; }
            catch { row.text = ''; }
          }
          out.push(row);
        }
      }
    }
  }
  return out;
}

/** หา path ของฉากจาก sceneId (ใช้ตอนคลิก backlink) */
export async function findScenePath(root, sceneId) {
  const all = await listScenes(root);
  const hit = all.find((s) => s.id === sceneId);
  return hit ? hit : null;
}

/** เอนทิตี้ Wiki ทั้งโปรเจกต์ */
export async function listEntities(root) {
  const out = [];
  if (!root) return out;
  let secs = [];
  try { secs = await kapi.listDirs(root); } catch { return out; }
  for (const sec of secs) {
    if (!WIKI_DIRS.includes(sec)) continue;
    const wp = await kapi.join(root, sec);
    let cats = [];
    try { cats = await kapi.listDirs(wp); } catch { continue; }
    for (const cat of cats) {
      const cd = await kapi.join(wp, cat);
      for (const f of await kapi.listFiles(cd, '.json')) {
        try {
          const fp = await kapi.join(cd, f);
          const e = await kapi.readJson(fp);
          if (e && e.name) out.push({ id: fp, path: fp, name: e.name, aliases: e.aliases || [], cat, entity: e });
        } catch (err) { log('warn', t('ui.project.readCant') + f, err); }
      }
    }
  }
  return out;
}
