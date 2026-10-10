// scene-file-name.js — [alpha.159] ชื่อไฟล์ฉากที่ว่างจริง (ย้ายออกมาจาก scene-ops.js)
//
// ai-actions.js ต้องใช้ตัวเดียวกับที่ผู้ใช้กดเอง (กฎ alpha.156) แต่ import scene-ops.js ไม่ได้
// เพราะมันลาก app.js/DOM ทั้งก้อนเข้ามา (unit test ของ ai-actions บันเดิลทั้งสาย) → แยกเป็นไฟล์เล็กที่พึ่งแค่ kapi
// scene-ops.js ส่งต่อชื่อเดิม (`export { freeSceneFileName } from './scene-file-name.js'`) — ผู้เรียกเดิมไม่ต้องแก้
//
// [alpha.170] ★ ชื่อไฟล์ = **ชื่อฉาก** (เดิม `scene-03.md` ตามเลขลำดับ) — ลำดับอยู่ใน `order` ของ scenes.json ที่เดียว
// ตรรกะอยู่ที่ disk-names.js (บริสุทธิ์) + disk-sync.js · ไฟล์นี้เหลือเป็นตัวห่อที่ผูก kapi ให้ผู้เรียกเดิม
import { freeSceneFile, freeChapterFolder } from './disk-sync.js';

/**
 * [alpha.156] ชื่อไฟล์ฉากที่ว่างจริง — ไม่ชนทั้ง "ไฟล์บนดิสก์" และ "ชื่อที่แถวใน scenes.json จองไว้"
 * (แถวที่ไฟล์หายไปแล้วก็ยังจองชื่อ ไม่งั้นกู้ไฟล์กลับมาทีหลังแล้วสองแถวชี้ไฟล์เดียวกัน)
 * รูปชื่อ: `ตลาดเก่า.md` → `ตลาดเก่า 2.md` → …
 * @param {string} title ชื่อฉาก (ไม่ใช่เลขลำดับแล้ว)
 */
export async function freeSceneFileName(dPath, folderName, title, taken = new Set()) {
  return freeSceneFile(kapi, dPath, folderName, String(title == null ? '' : title), taken);
}

/** [alpha.170] ชื่อโฟลเดอร์บทที่ว่างจริง = ชื่อบท (ไม่มีเลขนำ) */
export async function freeChapterFolderName(dPath, title, taken = new Set()) {
  return freeChapterFolder(kapi, dPath, String(title == null ? '' : title), taken);
}

/** ชื่อไฟล์ที่แถวใน scenes.json จองไว้แล้ว (ทุกบท) — ส่งเป็น `taken` ของ freeSceneFileName */
export function takenSceneFiles(scenesJson) {
  const out = new Set();
  for (const rows of Object.values((scenesJson && scenesJson.chapters) || {})) {
    for (const r of rows || []) if (r && r.fileName) out.add(r.fileName);
  }
  return out;
}
