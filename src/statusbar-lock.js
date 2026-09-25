// statusbar-lock.js — [alpha.166] ช่องบนแถบสถานะ "ไม่ขยับ"
//
// ผู้ใช้: *"status bar ที่มันขยับทุก ๆ ครั้ง"*
// ต้นตอ (วัดบนแอปจริง): ช่องขวา (#status-right) กว้างตามข้อความของตัวเอง — "บันทึกแล้ว 14:02" ↔ "ยังไม่บันทึก"
// สลับกันทุกครั้งที่พิมพ์ตัวแรก/บันทึกอัตโนมัติ · จำนวนคำเพิ่มหลัก · เลขหน้า → ช่องสวิตช์กับแถบความคืบหน้า
// ทางซ้ายเลื่อนไปมา 48px ทุกครั้ง (ช่องข้อความเป็นช่องเดียวที่ยืด จึงเป็นคนรับส่วนต่าง)
//
// ทางแก้: แต่ละชิ้นในช่องขวา "กว้างได้ ห้ามหด" (ratchet) — ResizeObserver จด min-width สูงสุดที่เคยเห็น
// ไม่มีการวัดเลย์เอาต์แบบ sync (ResizeObserver รายงานหลังเลย์เอาต์อยู่แล้ว) · ไม่ใช่ MutationObserver ทุกตัวอักษร
// (กฎ W5) · ล้างเมื่อ "ชนิดของแท็บ" เปลี่ยน (นิยาย ↔ บท ↔ อื่น ๆ) เพราะชุดข้อมูลบนแถบเปลี่ยนทั้งชุด
// ส่วน "บันทึกแล้ว/ยังไม่บันทึก" จองที่ของข้อความที่ยาวที่สุดไว้ตั้งแต่แรก — สลับครั้งแรกก็ไม่ขยับ

const LOCK_SEL = '#status-right > *, #zoom-label';
let _ro = null;
let _kind = null;

/** ความกว้าง (px) ของข้อความเมื่อแสดงด้วยฟอนต์เดียวกับ element — ใช้จองที่ล่วงหน้า */
function textWidth(el, text) {
  try {
    const cs = getComputedStyle(el);
    const cv = textWidth._c || (textWidth._c = document.createElement('canvas'));
    const ctx = cv.getContext('2d');
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return Math.ceil(ctx.measureText(String(text || '')).width);
  } catch { return 0; }
}

/** จองความกว้างขั้นต่ำให้ el = ข้อความที่ยาวที่สุดในชุด (+ ที่ของไอคอน) */
export function reserveStatusWidth(el, texts, extra = 0) {
  if (!el) return 0;
  let w = 0;
  for (const s of texts || []) w = Math.max(w, textWidth(el, s));
  w += extra;
  const cur = parseFloat(el.style.minWidth) || 0;
  if (w > cur) { el.style.boxSizing = 'border-box'; el.style.minWidth = w + 'px'; }
  return w;
}

export function installStatusBarLock(root = document) {
  if (_ro || typeof ResizeObserver === 'undefined') return false;
  _ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target;
      const box = e.borderBoxSize && e.borderBoxSize[0];
      const w = Math.ceil(box ? box.inlineSize : el.offsetWidth);
      const cur = parseFloat(el.style.minWidth) || 0;
      if (w > cur) { el.style.boxSizing = 'border-box'; el.style.minWidth = w + 'px'; }
    }
  });
  for (const el of root.querySelectorAll(LOCK_SEL)) _ro.observe(el);
  return true;
}

/**
 * ปลดความกว้างที่จำไว้ — เรียกเมื่อชนิดแท็บเปลี่ยน (ไม่ใช่ทุกครั้งที่สลับแท็บชนิดเดิม)
 * @param {string} kind  ชนิดของแท็บที่เพิ่งเลือก ('prose' | 'sp' | 'other' …)
 * @returns {boolean} true = ปลดจริง
 */
export function resetStatusBarLock(kind, root = document) {
  if (kind === _kind) return false;
  _kind = kind;
  for (const el of root.querySelectorAll(LOCK_SEL)) el.style.minWidth = '';
  return true;
}
