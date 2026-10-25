// scene-format-default.js — [trial 2026-10-25 ข้อ 4] ชนิดของ "ฉากใหม่" (นิยาย/บทภาพยนตร์)
// บริสุทธิ์ 100% (unit `scene-format-default`)
//
// ผู้ใช้เจอ: โปรเจกต์จากเทมเพลต "บทภาพยนตร์" กด "+ ฉาก" แล้วได้ฉากนิยาย (`format: prose`) ทุกครั้ง —
// มีแต่ฉากแรกของแต่ละองก์ (ที่เทมเพลตสร้างให้) เป็นบทภาพยนตร์ ต้องไล่สลับเองทีละฉาก
// ต้นตอ: `addScene` เขียน `format: 'prose'` ตายตัว ไม่ดูว่าบท/โปรเจกต์นี้เป็นงานชนิดไหน

/**
 * กติกา: บทที่มีแต่ชนิดเดียว = ชนิดนั้น · บทว่างหรือปนกันสองชนิด = ตามเทมเพลตของโปรเจกต์
 * (บทที่ปนกันคือผู้ใช้จงใจผสม — เดาจากฉากล่าสุดแล้วพลาดได้ จึงยึดชนิดของโปรเจกต์)
 * @param {string[]} siblings  ชนิดของฉากที่มีอยู่แล้วในบทเดียวกัน
 * @param {string} [template]  `project.khn.json → template` (ชื่อเทมเพลตที่ใช้สร้างโปรเจกต์)
 * @returns {'prose'|'screenplay'}
 */
export function defaultSceneFormat(siblings, template) {
  const kinds = new Set((Array.isArray(siblings) ? siblings : [])
    .map((f) => (f === 'screenplay' ? 'screenplay' : 'prose')));
  if (kinds.size === 1) return [...kinds][0];
  return template === 'screenplay' ? 'screenplay' : 'prose';
}
