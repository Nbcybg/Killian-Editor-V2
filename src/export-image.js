// export-image.js — [alpha.168] ทางกลางของ "บันทึกผืนวาดเป็นไฟล์ PNG" (แผนที่ · กระดานวางแผน · Story Network · กระดานอารมณ์)
//
// ผู้ใช้: "map ส่งออก png ใช้ไม่ได้" · "กระดาน planner export png ไม่ได้ · check ตัว export ด้วยนะ"
// ต้นตอ: ตัวส่งออกเดิม "เขียนเงียบ ๆ" ลงคลังรูป / รากโปรเจกต์ (writeImageData) — ไม่มีกล่องให้เลือกที่เก็บ
//   ไม่บอกว่าไปอยู่ไหน (ข้อความสถานะหายเองใน 6 วินาที) = กดแล้วเหมือนไม่เกิดอะไร · กระดานยังได้พื้นโปร่งใส
//   (ข้อความสีขาวหายไปบนตัวดูรูป)
// ตอนนี้ทุกแผงผ่านตัวนี้: เปิดกล่องบันทึก → เขียนไบต์ (writeBytes · กฎข้อ 10/23) → บอกชื่อไฟล์พร้อมลิงก์ "เปิดโฟลเดอร์"
import { t, tf } from './i18n.js';
import { setStatusAction } from './core.js';

/** ผืนวาด → ไบต์ PNG */
export function canvasPngBytes(cv) {
  const bin = atob((cv.toDataURL('image/png').split(',')[1]) || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** ปูพื้นทึบใต้ผืนวาด (ของที่วาดบนพื้นโปร่งใส → ไฟล์มีพื้นสีเดียวกับบนจอ) */
export function withBackground(cv, color) {
  if (!color) return cv;
  const out = document.createElement('canvas');
  out.width = cv.width; out.height = cv.height;
  const c = out.getContext('2d');
  c.fillStyle = color; c.fillRect(0, 0, out.width, out.height);
  c.drawImage(cv, 0, 0);
  return out;
}

/**
 * บันทึกผืนวาดเป็น PNG — outPath (เทส) = เขียนตรงนั้น · ไม่มี = ถามที่เก็บด้วยกล่องบันทึก
 * @returns ทางไฟล์ที่เขียน หรือ null เมื่อผู้ใช้ยกเลิก
 */
export async function saveCanvasPng(cv, defName, outPath) {
  const dest = outPath || await kapi.saveAsDialog(defName, 'png');
  if (!dest) return null;
  await kapi.writeBytes(dest, Array.from(canvasPngBytes(cv)));
  const name = String(dest).split(/[\\/]/).pop();
  try { setStatusAction(tf('ui.panelExport.done', name), t('ui.exportImg.showInFolder'), () => kapi.revealInOS(dest)); } catch {}
  return dest;
}
