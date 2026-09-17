// disk-conflict.js — [alpha.156] ไฟล์ถูกแก้ "นอกโปรแกรม" ระหว่างที่แท็บเปิดอยู่หรือไม่ — ตรรกะล้วน
//
// หลักของโปรแกรม: **ไฟล์งานแก้นอกโปรแกรมได้** (.md) — แต่เดิมไม่มีใครตรวจเลย
// แท็บถือเนื้อชุดที่อ่านตอนเปิด แล้วบันทึกทับของที่ผู้ใช้เพิ่งแก้ใน VS Code/Obsidian หรือที่ตัวซิงก์คลาวด์
// (Dropbox/OneDrive/Google Drive) ดึงมาจากอีกเครื่อง — หายเงียบ ๆ ไม่มีคำเตือน
//
// ตัดสินจาก **เนื้อ (body)** ไม่ใช่เวลาแก้ไฟล์ (mtime):
//   · โปรแกรมเองก็เขียน frontmatter ลับหลังแท็บอยู่แล้ว (คุณสมบัติฉาก · ชื่อฉาก · คอมเมนต์ท้ายไฟล์)
//     ถ้าใช้ mtime จะเด้งเตือนผิดทุกครั้งที่แก้คุณสมบัติ
//   · เนื้อฉากถูกเขียนจากแท็บทางเดียว (AI/ไล่แก้ชื่อก็ผ่านแท็บ — tab-bridge.js) จึงเชื่อได้

/** เทียบแบบไม่สนการขึ้นบรรทัดของ Windows และช่องว่างท้ายไฟล์ */
export const normBody = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/\s+$/, '');

/**
 * @param {{diskBody:string|null, baseBody:string, tabBody:string}} p
 *   diskBody = เนื้อบนดิสก์ตอนนี้ (null = ไฟล์หายไป) · baseBody = เนื้อตอนที่แท็บอ่าน/บันทึกล่าสุด
 *   tabBody  = เนื้อในแท็บตอนนี้
 * @returns {'none'|'same'|'external'|'deleted'}
 *   none     = ดิสก์ยังเหมือนที่แท็บรู้จัก → บันทึกได้
 *   same     = ดิสก์ถูกเปลี่ยน แต่บังเอิญตรงกับเนื้อในแท็บ → บันทึกได้ (ไม่มีอะไรหาย)
 *   external = ดิสก์ถูกแก้นอกโปรแกรม และต่างจากแท็บ → ต้องถาม
 *   deleted  = ไฟล์ถูกลบ/ย้ายนอกโปรแกรม → ต้องถาม (บันทึก = สร้างไฟล์ใหม่ที่เดิม)
 */
export function diskConflict({ diskBody, baseBody, tabBody }) {
  if (diskBody === null || diskBody === undefined) return 'deleted';
  const d = normBody(diskBody);
  if (d === normBody(baseBody)) return 'none';
  if (d === normBody(tabBody)) return 'same';
  return 'external';
}

/**
 * แท็บที่ "ไม่มีงานค้าง" + ดิสก์ถูกแก้ → โหลดใหม่เงียบ ๆ ได้เลย
 * แท็บที่มีงานค้าง → ห้ามแตะ รอให้ผู้ใช้ตัดสินตอนบันทึก
 * @returns {'reload'|'keep'|'none'}
 */
export function focusAction({ dirty, diskBody, baseBody }) {
  if (diskBody === null || diskBody === undefined) return 'none';
  if (normBody(diskBody) === normBody(baseBody)) return 'none';
  return dirty ? 'keep' : 'reload';
}
