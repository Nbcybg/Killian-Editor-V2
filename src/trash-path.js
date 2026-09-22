// trash-path.js — [alpha.162 · W1-4] ★ ทางเดียวของ "ชื่อปลายทางในถังขยะ" + ชื่อที่ยังว่างในโฟลเดอร์
//
// ══ ต้นตอ ══
// ทางลบสี่ทาง (ลบไฟล์จากต้นไม้ · ลบหลายฉากรวดเดียว · ลบบท · AI ลบ) ต่างคนต่างประกอบชื่อเองว่า
//     Date.now().toString(36) + '-' + ชื่อไฟล์
// ซึ่งชนกันได้สองชั้น:
//   1. **ลบรวดเดียวหลายชิ้น** — `deleteSceneSilent` วนลูปโดยไม่มีกล่องถามคั่น และ
//      **ทุกบทมี `scene-01.md`** (กฎ alpha.159) → สองฉากได้ชื่อในถังเดียวกัน
//   2. **ของชื่อนั้นอยู่ในถังแล้ว** — เวลาเครื่องถูกปรับย้อน · สำเนาที่ผู้ใช้วางเอง
// ทั้งสองแบบจบที่ `kapi.move` = rename ซึ่ง **ทับของเดิมเงียบ ๆ** (พร้อมใบกู้คืน `.k2restore.json`
// และตาราง `.vis.csv` ที่ใช้ชื่อเดียวกันต่อท้าย) = ของที่ลบก่อนหายถาวร กู้ไม่ได้
//
// โมดูลนี้ import แค่ core.js + recycle-core.js (ไม่แตะ app.js) — `ai/ai-actions.js` จึงเรียกได้
// โดยไม่ลากทั้งแอปเข้ามาเป็นวงของ import
import { state } from './core.js';
import { nextStamp, nameCandidate } from './recycle-core.js';

/**
 * [alpha.148] ชื่อที่ยังว่างในโฟลเดอร์ปลายทาง
 * การย้ายไฟล์ (`fs:move` = rename) **เขียนทับของที่มีอยู่แบบเงียบ ๆ** — เดิมกู้โน้ต "ไอเดีย.md"
 * กลับมาในวันที่มีโน้ตใหม่ชื่อเดียวกันอยู่แล้ว = โน้ตใหม่หายโดยไม่มีอะไรเตือน
 * @param {{dir?: boolean, taken?: Set<string>}} opts taken = ชื่อที่ถูกจองในข้อมูล (แม้ยังไม่มีบนดิสก์)
 */
export async function freeName(dir, name, opts = {}) {
  for (let i = 1; i < 500; i++) {
    const cand = nameCandidate(name, i, opts);
    if (opts.taken && opts.taken.has(cand)) continue;
    if (!(await kapi.exists(await kapi.join(dir, cand)))) return cand;
  }
  return nameCandidate(name, Date.now(), opts);
}

const TRASH_C = { last: 0 };

/**
 * ทางเต็มของของชิ้นนี้ในถังขยะ — **ทุกทางลบต้องเรียกตัวนี้** (ห้ามประกอบชื่อเอง)
 * @param {string} file ไฟล์/โฟลเดอร์ต้นทาง
 * @param {{dir?: boolean, root?: string}} opts dir = เป็นโฟลเดอร์ (ไม่แยกนามสกุลตอนกันชน)
 * @returns {Promise<string>} ทางปลายทางที่ยังว่างจริง
 */
export async function trashPathFor(file, { dir = false, root } = {}) {
  const base = String(file || '').split(/[\\/]/).filter(Boolean).pop() || 'item';
  const recDir = await kapi.join(root || state.root, 'Recycle');
  await kapi.mkdir(recDir);
  TRASH_C.last = nextStamp(Date.now(), TRASH_C.last);
  return kapi.join(recDir, await freeName(recDir, TRASH_C.last.toString(36) + '-' + base, { dir }));
}
