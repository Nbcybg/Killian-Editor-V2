// edit-guard.js — [alpha.164 · บั๊ก] "ล็อก = แก้ไม่ได้" ต้องจริงทุกทาง ไม่ใช่แค่การพิมพ์
//
// `editable: false` ของ ProseMirror กันแค่ **อินพุตจาก DOM** (พิมพ์ · วาง · ลากวาง)
// แต่คำสั่งที่โค้ดสั่งเอง (`view.dispatch`) ผ่านได้หมด → ฉากที่ล็อกไว้ถูกแก้ได้จาก
// ปุ่มจัดรูปแบบบนแถบ · คีย์ลัด (Ctrl+B ถูกดักระดับแอปแล้วยิงคำสั่ง) · สีตัวอักษร/สีเน้น ·
// ช่องสไตล์ย่อหน้า · รูปตัวพิมพ์ · แทรกรูป · เปลี่ยนชนิด element ของบท · undo/redo
//
// ตัวนี้ครอบ "เมธอดที่แก้เนื้อ" ของตัวแก้ไขทั้งสองชนิดตอนสร้าง — ไม่แก้ได้ = ไม่ทำอะไรและคืน false
// (ทางของระบบ เช่น setMarkdown ตอนโหลดจากดิสก์ / applyAlignMap ตอนเปิดไฟล์ ไม่ถูกครอบ)
/**
 * @param {object} ed          ตัวแก้ไข (KEditor / SPEditor)
 * @param {string[]} names     ชื่อเมธอดที่แก้เนื้อ
 * @param {() => boolean} [isEditable]  ไม่ส่ง = แก้ได้เสมอ (ตัวแก้ไขที่ไม่มีระบบล็อก)
 */
export function guardEditable(ed, names, isEditable) {
  if (typeof isEditable !== 'function') return ed;
  for (const m of names) {
    const orig = ed[m];
    if (typeof orig !== 'function') continue;
    ed[m] = function guarded(...a) {
      let ok = true;
      try { ok = isEditable() !== false; } catch { ok = true; }
      return ok ? orig.apply(this, a) : false;
    };
  }
  return ed;
}
