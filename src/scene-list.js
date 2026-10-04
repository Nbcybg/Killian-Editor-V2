// scene-list.js — รายชื่อฉากทุกร่างของโปรเจกต์ (อ่านจาก draft.json + scenes.json)
// [alpha.168] ย้ายมาจาก floorplan-ui.js ตอนแผงผังพื้นที่ถูกเขียนใหม่เป็นแบบ Shot Designer
// — แผงแผนที่ใช้นับฉากบนหมุด · ผังพื้นที่ใช้หาฉากที่ผูกไว้ / ให้ผู้ใช้เลือกฉาก
import { state } from './core.js';

const SKIP = new Set(['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Backups', 'Plugins', 'Research', 'FloorPlans', 'Planners', 'Branches', 'Models', 'OnSet']);

/**
 * ฉากทุกฉาก (ไม่รวมโน้ต) พร้อมทางไฟล์และชื่อบท · เรียงตามเล่ม → บท → ฉาก
 * ชื่อเดิม `collectPlacedScenes` (แผงแผนที่ใช้นับฉากที่ปักหมุด — แถวมี mapId/pinId ครบ)
 */
export async function collectPlacedScenes() {
  const out = [];
  if (!state.root) return out;
  const secs = [];
  for (const sec of await kapi.listDirs(state.root).catch(() => [])) {
    if (SKIP.has(sec)) continue;
    const sp = await kapi.join(state.root, sec);
    const sj = await kapi.join(sp, 'section.json');
    if (!(await kapi.exists(sj))) continue;
    let order = 0; let secTitle = sec;
    try { const j = await kapi.readJson(sj); order = +j.order || 0; secTitle = j.title || sec; } catch {}
    secs.push({ sec, sp, order, secTitle });
  }
  secs.sort((a, b) => a.order - b.order);
  for (const { sp, secTitle } of secs) {
    const dr = await kapi.join(sp, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    for (const dn of await kapi.listDirs(dr).catch(() => [])) {
      const dp = await kapi.join(dr, dn);
      const dj = await kapi.join(dp, 'draft.json');
      if (!(await kapi.exists(dj))) continue;
      const draft = await kapi.readJson(dj);
      const scData = await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}));
      const chMap = scData.chapters || {};
      const chs = (draft.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const ch of chs) {
        const rows = (chMap[ch.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        for (const sc of rows) {
          if (sc.type === 'memo') continue;
          out.push({ ...sc, dPath: dp, chapterName: ch.title, sectionName: secTitle,
                     filePath: await kapi.join(dp, 'Chapters', ch.folderName, sc.fileName) });
        }
      }
    }
  }
  return out;
}

/** หาฉากจาก id (id ในฉากไม่เปลี่ยนเมื่อย้าย/เปลี่ยนชื่อไฟล์) — ไม่เจอ = null */
export async function findSceneById(id) {
  if (!id) return null;
  return (await collectPlacedScenes()).find((s) => s.id === id) || null;
}

/** ทางสัมพัทธ์จากรากโปรเจกต์ (ไว้จดในไฟล์ — ย้ายเครื่องแล้วยังใช้ได้) */
export function relToRoot(file) {
  const r = String(state.root || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const f = String(file || '').replace(/\\/g, '/');
  return r && f.toLowerCase().startsWith(r.toLowerCase() + '/') ? f.slice(r.length + 1) : f;
}
