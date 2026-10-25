// simple-mode.js — [alpha.170 · ข้อ 8] โหมดเรียบง่าย: เห็นแค่ Explorer + ตัวแก้ไข + ปุ่มพื้นฐาน
//
// ที่มา: ผลสำรวจผู้ใช้ข้อ 8 "ฟีเจอร์เยอะ ดูเรียนรู้ยาก" — ผู้ใช้สั่ง "ทำข้ออื่นที่ค้างต่อเลย"
// ★ เป็น "ตัวกรองซ้อน" บนค่าของผู้ใช้ — ไม่แก้ `settings.toolbar` / `settings.fmtbar` / เลย์เอาต์ที่ผู้ใช้จัดไว้
//   ปิดโหมด = ทุกอย่างกลับมาเหมือนก่อนเปิดทุกปุ่ม (เลย์เอาต์เดิมถูกจดไว้ตอนเปิด แล้วคืนตอนปิด)
// ★ เมนูระบบยังครบทุกคำสั่ง — โหมดนี้ลด "สิ่งที่เห็นบนจอ" ไม่ได้ปิดความสามารถ (ปุ่มที่ถูกซ่อนยังอยู่ในเมนู »)
// บริสุทธิ์ 100% · unit `simple-mode` · ตัวสลับ (เลย์เอาต์ · เมนู · ข้อความลอย) = `setSimpleMode()` ใน app.js

/** ปุ่มบนแถบหลักที่ยังเห็นในโหมดเรียบง่าย (ปุ่มที่โปรแกรมคุมเอง — เปิด/บันทึก/ค้นหาโปรเจกต์ · » — เห็นเสมออยู่แล้ว) */
export const SIMPLE_MAIN = new Set([
  'tb-undo', 'tb-redo',
  'tb-tree-panel', 'tb-outline-panel',      // Explorer · Navigation
  'tb-read', 'tb-focus',                    // อ่าน · โฟกัส
  'tb-settings',
]);

/** ปุ่มบนแถบรูปแบบลอยที่ยังเห็น — งานเขียนพื้นฐาน (หัวข้อ · หนา/เอียง/ขีดเส้นใต้ · รายการ · ค้นหา) */
export const SIMPLE_FMT = new Set([
  'tb-undo', 'tb-redo',
  'tb-style', 'tb-h2', 'tb-h3',
  'tb-bold', 'tb-italic', 'tb-underline',
  'tb-ul', 'tb-ol', 'tb-quote',
  'tb-find',
]);

/** ชื่อเวิร์กสเปซภายในที่จดเลย์เอาต์ก่อนเข้าโหมด — ขึ้นต้นด้วย `__k2` = ไม่โผล่ในรายชื่อเวิร์กสเปซของผู้ใช้ */
export const SIMPLE_WS = '__k2-before-simple';
export const isInternalWorkspace = (name) => String(name || '').startsWith('__k2');

/** ปุ่มบนแถบหลักนี้เห็นไหม (on = โหมดเปิดอยู่) */
export const simpleMainVisible = (on, id) => !on || SIMPLE_MAIN.has(id);

/**
 * ค่าแถบรูปแบบลอยที่ผ่านตัวกรองของโหมดแล้ว (ค่าที่ normalize แล้ว: `{ <โหมด>: { hidden:{}, shown:{} } }`)
 * คืนก้อนใหม่เสมอ — ไม่แก้ของผู้ใช้
 * @param {object} norm ผลของ normalizeFmtbar
 * @param {string[]} ids ทุก id ที่ตั้งค่าได้บนแถบ
 */
export function simpleFmtbar(norm, ids) {
  const out = {};
  for (const [mode, v] of Object.entries(norm || {})) {
    const hidden = { ...((v && v.hidden) || {}) };
    for (const id of ids || []) if (!SIMPLE_FMT.has(id)) hidden[id] = true;
    out[mode] = { ...(v || {}), hidden };
  }
  return out;
}

/**
 * เปิดโหมดเรียบง่ายเป็นค่าเริ่มต้นไหม — เฉพาะผู้ใช้ใหม่จริง ๆ (ไฟล์ตั้งค่าผู้ใช้ยังว่าง)
 * ผู้ใช้เดิมที่อัปเดตโปรแกรมต้องไม่เจอหน้าตาเปลี่ยนเอง
 */
export function simpleByDefault(rawGlobal) {
  return !rawGlobal || typeof rawGlobal !== 'object' || Object.keys(rawGlobal).length === 0;
}
