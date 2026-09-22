// status-choices.js — [alpha.160 · P1-11] ตัวเลือกของช่อง "สถานะ" ที่ไม่ทำค่าของฉากหายเงียบ ๆ (บริสุทธิ์ 100%)
//
// ★ ต้นตอ: ลบสถานะที่กำหนดเองแล้ว ฉากที่ยังใช้ค่านั้นอยู่ **ไม่ถูกแตะ** (ถูกต้อง) แต่แผงคุณสมบัติสร้างช่องเลือกจาก
//   `allStatuses()` แล้วตั้งค่า `includes(row.status) ? row.status : 'Outline'` → เปิดคุณสมบัติแล้วกดบันทึก
//   (แม้ไม่ได้แตะช่องสถานะเลย) = เขียน `Outline` ทับค่าเดิมเงียบ ๆ
//
// กติกา: ค่าที่ไม่อยู่ในรายการแล้ว **คงไว้เป็นตัวเลือกพิเศษ** จนกว่าผู้ใช้จะเปลี่ยนเอง

/**
 * @param {string[]} all   สถานะที่ใช้ได้ตอนนี้ (allStatuses())
 * @param {string} current ค่าของฉาก
 * @returns {{values:string[], selected:string, orphan:string}} orphan = ค่าเดิมที่ไม่อยู่ในรายการแล้ว ('' = ไม่มี)
 */
export function statusChoices(all, current) {
  const list = Array.isArray(all) ? all.slice() : [];
  const cur = String(current || '').trim();
  if (!cur || cur === 'Outline') return { values: list, selected: 'Outline', orphan: '' };
  if (list.includes(cur)) return { values: list, selected: cur, orphan: '' };
  return { values: [...list, cur], selected: cur, orphan: cur };
}

/** นับฉากที่ใช้สถานะนี้ (แถวจาก listScenes → `.row.status` หรือ `.status`) */
export function countStatusUse(rows, label) {
  const l = String(label || '');
  if (!l) return 0;
  let n = 0;
  for (const r of rows || []) {
    const s = r && ((r.row && r.row.status) || r.status);
    if (s === l) n++;
  }
  return n;
}
