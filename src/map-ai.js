// map-ai.js — [alpha.167 · รอบต่อ] ตำแหน่งบนแผนที่ → AI (คำสั่ง `map.where` + ส่วน "ตำแหน่งบนแผนที่" ในบริบทแชท)
//
// ชั้นอ่านไฟล์บาง ๆ (maps.json + รายชื่อเอนทิตี้) · ตรรกะอยู่ maps.js (`mapDigest`/`whereIs`) · ถ้อยคำอยู่ map-text.js
import { migrateMaps, mapDigest, whereIs, entityNamer } from './maps.js';
import { mapDigestText, whereText } from './map-text.js';
import { listEntities } from './project-scan.js';

async function inputs(root) {
  if (!root) return null;
  let data = null;
  try {
    const p = await kapi.join(root, 'maps.json');
    if (!(await kapi.exists(p))) return null;
    data = migrateMaps(await kapi.readJson(p));
  } catch { return null; }
  const maps = (data && data.maps) || [];
  if (!maps.length) return null;
  const nameOf = entityNamer(await listEntities(root).catch(() => []));
  return { maps, nameOf };
}

/** ส่วน "ตำแหน่งบนแผนที่" ของบริบทแชท · '' = ไม่มีอะไรบนแผนที่ */
export async function mapContextText(root, { maxChars = 3000 } = {}) {
  const inp = await inputs(root);
  if (!inp) return '';
  return mapDigestText(mapDigest(inp.maps, { nameOf: inp.nameOf }), { maxChars });
}

/** คำตอบของคำสั่ง `map.where` — { found, text } */
export async function mapWhereText(root, name, { maxChars = 6000 } = {}) {
  const inp = await inputs(root);
  if (!inp) return { found: false, text: '' };
  if (!String(name || '').trim()) {
    const text = mapDigestText(mapDigest(inp.maps, { nameOf: inp.nameOf, nearPerPlace: 2 }), { maxChars });
    return { found: !!text, text };
  }
  const rows = whereIs(inp.maps, name, { nameOf: inp.nameOf });
  return { found: rows.length > 0, text: whereText(String(name).trim(), rows) };
}
