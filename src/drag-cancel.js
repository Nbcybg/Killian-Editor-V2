// drag-cancel.js — [alpha.165] Esc = ยกเลิกการลากที่กำลังทำอยู่ (ทุกการลากที่ผูกเมาส์เอง)
//
// ผู้ใช้: "ลาก panel แล้วไม่พอใจ กด Esc ยกเลิกไม่ได้" — ตัวลากทุกตัว (ย้าย/ผนึกแผง · ย้าย/ย่อขยายแผงลอย ·
// เส้นแบ่งแผง · แถบลอย) ผูก mousemove/mouseup เองแล้วไม่มีใครฟังคีย์เลย
// ตัวนี้ดักที่ window ระยะ capture (ก่อนตัวดัก Esc ของกล่อง/เมนูที่อยู่ระดับ document) แล้วกลืนคีย์ไว้
// → Esc ครั้งนั้นยกเลิกการลากอย่างเดียว ไม่ไปปิดกล่อง/ออกจากโหมดอื่นพร้อมกัน
//
//   const offEsc = escCancelDrag(() => { …คืนสภาพเดิม · ถอดตัวฟังเมาส์… });
//   …ตอน mouseup ปกติ: offEsc();
//
// ไม่ import อะไร (ใช้ได้ทั้งแผง · app.js · โมดูลย่อย)

let _active = 0;

/** มีการลากที่ยกเลิกด้วย Esc ได้ค้างอยู่ไหม (ตัวดัก Esc อื่นใช้ถามเพื่อหลบ) */
export function dragInProgress() { return _active > 0; }

/**
 * ติดตั้งตัวฟัง Esc ระหว่างลาก — คืนฟังก์ชันถอด (เรียกซ้ำได้ ไม่ทำอะไรครั้งที่สอง)
 * @param {() => void} onCancel คืนสภาพก่อนลาก + ถอดตัวฟังเมาส์ของผู้เรียกเอง
 */
export function escCancelDrag(onCancel) {
  let on = true;
  _active++;
  const off = () => {
    if (!on) return;
    on = false;
    _active = Math.max(0, _active - 1);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('mouseup', off, true);
    window.removeEventListener('blur', off);
  };
  function key(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    off();
    try { onCancel(); } catch (err) { try { console.error('[drag-cancel]', err); } catch {} }
  }
  window.addEventListener('keydown', key, true);
  // ตาข่าย: การลากจบด้วยทางไหนก็ตาม (ปล่อยเมาส์ · สลับหน้าต่างกลางคัน = mouseup หาย) ต้องถอดตัวฟังเสมอ
  // ไม่งั้น Esc ครั้งถัดไป (เช่นปิดกล่อง) ถูกกลืนทิ้งเงียบ ๆ · ระยะ capture = ถอดก่อนตัวจัดการ mouseup ของผู้เรียก
  window.addEventListener('mouseup', off, true);
  window.addEventListener('blur', off);
  return off;
}
