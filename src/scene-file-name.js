// scene-file-name.js — [alpha.159] ชื่อไฟล์ฉากที่ว่างจริง (ย้ายออกมาจาก scene-ops.js)
//
// ai-actions.js ต้องใช้ตัวเดียวกับที่ผู้ใช้กดเอง (กฎ alpha.156) แต่ import scene-ops.js ไม่ได้
// เพราะมันลาก app.js/DOM ทั้งก้อนเข้ามา (unit test ของ ai-actions บันเดิลทั้งสาย) → แยกเป็นไฟล์เล็กที่พึ่งแค่ kapi
// scene-ops.js ส่งต่อชื่อเดิม (`export { freeSceneFileName } from './scene-file-name.js'`) — ผู้เรียกเดิมไม่ต้องแก้

/**
 * [alpha.156] ชื่อไฟล์ฉากที่ว่างจริง — ไม่ชนทั้ง "ไฟล์บนดิสก์" และ "ชื่อที่แถวใน scenes.json จองไว้"
 * (แถวที่ไฟล์หายไปแล้วก็ยังจองชื่อ ไม่งั้นกู้ไฟล์กลับมาทีหลังแล้วสองแถวชี้ไฟล์เดียวกัน)
 * รูปชื่อเดียวกับ `uniqueSceneFileName()` ของเดิม: scene-03.md → scene-03-2.md → …
 */
export async function freeSceneFileName(dPath, folderName, order, taken = new Set()) {
  const base = 'scene-' + String(order).padStart(2, '0');
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? base + '.md' : `${base}-${n}.md`;
    if (taken.has(name)) continue;
    if (await kapi.exists(await kapi.join(dPath, 'Chapters', folderName, name))) continue;
    return name;
  }
  return base + '-' + Date.now().toString(36) + '.md';
}

/** ชื่อไฟล์ที่แถวใน scenes.json จองไว้แล้ว (ทุกบท) — ส่งเป็น `taken` ของ freeSceneFileName */
export function takenSceneFiles(scenesJson) {
  const out = new Set();
  for (const rows of Object.values((scenesJson && scenesJson.chapters) || {})) {
    for (const r of rows || []) if (r && r.fileName) out.add(r.fileName);
  }
  return out;
}
