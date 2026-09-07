// typewriter.js — บรรทัดที่กำลังเขียนอยู่กึ่งกลางหน้าจอเสมอ (Ctrl+Shift+T)
// ระวัง: selection.anchorNode มักเป็น Text node ซึ่ง "ไม่มี" .closest() → ต้องขึ้น parentElement ก่อน
//        (cursorBlock() ใน focus-mode.js จัดการให้แล้ว — อิง view.domAtPos ของ ProseMirror ก่อน)
import { cursorBlock } from './focus-mode.js';

let _twActive = false;

export function isTypewriter() { return _twActive; }

export function toggleTypewriter(on) {
  const want = on === undefined ? !_twActive : !!on;
  if (want === _twActive) return _twActive;
  _twActive = want;
  if (_twActive) {
    document.addEventListener('keyup', twScrollSoon);
    document.addEventListener('click', twScrollSoon);
    twScroll();
  } else {
    document.removeEventListener('keyup', twScrollSoon);
    document.removeEventListener('click', twScrollSoon);
    if (_twFrame) { cancelAnimationFrame(_twFrame); _twFrame = 0; }
  }
  return _twActive;
}

/**
 * [alpha.124 ข้อ 37] ★ รวบการเลื่อนให้เหลือเฟรมละครั้ง
 *
 * เดิมผูก `twScroll` กับ `keyup` ตรง ๆ → **ทุกตัวอักษรที่พิมพ์** จะ:
 *   · เรียก `getBoundingClientRect()` สองครั้ง (บังคับให้เบราว์เซอร์คำนวณ layout ใหม่ทั้งหน้า)
 *   · สั่ง `scrollTo({behavior:'smooth'})` ทับอนิเมชันเดิมที่ยังวิ่งไม่จบ
 * พิมพ์เร็ว ๆ แล้วจะรู้สึกหนืดและจอสั่น — ยิ่งเอกสารยาวยิ่งชัด
 *
 * ตอนนี้: จองคิวไว้ที่เฟรมถัดไป (rAF) ถ้ามีคิวค้างอยู่แล้วก็ไม่จองซ้ำ
 * → พิมพ์รัว 20 ตัวอักษรใน 1 เฟรม = เลื่อนครั้งเดียว ไม่ใช่ 20 ครั้ง
 */
let _twFrame = 0;
export function twScrollSoon() {
  if (_twFrame) return;
  _twFrame = requestAnimationFrame(() => { _twFrame = 0; twScroll(); });
}

// หา "ตัวที่เลื่อนได้จริง" ของตัวแก้ไข — ปกติคือ .pane
// แต่ถ้าตัวแก้ไขอยู่ในหน้าต่างลอย (float-win) จะไม่มี .pane เลย → ไต่ขึ้นไปหา element ที่ overflow เลื่อนได้
export function scrollHost(pm) {
  const pane = pm.closest('.pane');
  if (pane) return pane;
  let n = pm.parentElement;
  while (n && n !== document.body) {
    const ov = getComputedStyle(n).overflowY;
    if (ov === 'auto' || ov === 'scroll' || ov === 'overlay') return n;
    n = n.parentElement;
  }
  return null;
}

// เลื่อนให้บรรทัดที่มี cursor อยู่กลางกรอบ — คืน true เมื่อหาบรรทัดเจอและเลื่อนจริง
export function twScroll() {
  if (!_twActive) return false;
  const cur = cursorBlock();          // ใช้ตัวเดียวกับโหมดโฟกัส (อิง ProseMirror ก่อน)
  if (!cur) return false;
  const { pm, blk } = cur;
  const host = scrollHost(pm);
  if (!host) return false;
  const pr = host.getBoundingClientRect();
  const br = blk.getBoundingClientRect();
  const target = host.scrollTop + (br.top - pr.top) - pr.height / 2 + br.height / 2;
  host.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  return true;
}
