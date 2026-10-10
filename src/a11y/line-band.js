// line-band.js — [alpha.169 · a11y] แถบสีที่บรรทัดของเคอร์เซอร์
//
// ผู้ใช้: *"แถบสี บรรทัดที่ cursor อยู่ สำหรับผู้สมาธิสั้น หาตำแหน่ง cursor ไม่เจอ"*
//
// ══ ทำไมเป็น "แผ่นทับ" ไม่ใช่ decoration/คลาสบนบล็อก ══
// · กฎข้อ 31: อะไรที่เป็น UI ห้ามวาดลงบนกระดาษ — คลาส/พื้นหลังบนบล็อกของ ProseMirror ติดไปกับสำเนาที่มุมมอง
//   หน้ากระดาษ/ช่องตัวอย่างส่งออกโคลนไป และขยับเรขาคณิตของบล็อกไม่ได้เลยแม้พิกเซลเดียว (ตัวจัดหน้าวัดของจริง)
// · decoration ระดับบล็อกไฮไลต์ได้ทั้ง "ย่อหน้า" — ย่อหน้ายาวสิบบรรทัดก็ยังหาเคอร์เซอร์ไม่เจอเหมือนเดิม
//   แถบนี้สูง **หนึ่งบรรทัดที่ตาเห็น** (จาก `view.coordsAtPos`) กว้างเท่ากระดาษ
// · แผ่นเป็นลูกของกล่องที่เลื่อน (`.pane`) ซึ่งอยู่ **นอก** กล่องที่ถูก CSS zoom (กฎข้อ 32) → เลื่อนตามเนื้อเอง
//   ไม่ต้องคำนวณใหม่ตอนเลื่อน · ตำแหน่งคิดจากพิกัดหน้าต่างล้วน ๆ
//
// ตัวกระตุ้น: selectionchange · พิมพ์ · ปล่อยเมาส์/ปุ่ม · เปลี่ยนขนาดหน้าต่าง + `scheduleLineBand()` ที่ app.js
// เรียกคู่กับรางเลขบรรทัด (ซูม · เลย์เอาต์แผง · เนื้อหาเปลี่ยน) — รวบเหลือเฟรมละครั้ง
import { state, el } from '../core.js';
import { scrollHost } from '../typewriter.js';
import { bandBox, bandBlend, normA11y } from './a11y-core.js';

const BAND_CLASS = 'k-line-band';

let _cfg = normA11y(null);
let _bound = false;
let _job = 0;
let _band = null;
let _box = null;           // กล่องล่าสุดที่วาด (เทสอ่าน)

/** ตัวแก้ไข (ProseMirror view) ที่เคอร์เซอร์อยู่: ตัวที่มีโฟกัสก่อน ไม่งั้นแท็บที่เปิดอยู่ */
function activeView() {
  const ae = document.activeElement;
  const pm = ae && ae.closest ? ae.closest('.ProseMirror') : null;
  if (pm) {
    for (const t of state.tabs.values()) {
      const v = (t.editor && t.editor.view) || (t.sp && t.sp.view);
      if (v && v.dom === pm) return v;
    }
  }
  const t = state.active;
  return (t && ((t.editor && t.editor.view) || (t.sp && t.sp.view))) || null;
}

function hide() {
  if (_band) _band.style.display = 'none';
  _box = null;
}

function update() {
  if (!_cfg.lineBand || document.body.classList.contains('reading-mode')) { hide(); return false; }
  const view = activeView();
  if (!view || !view.dom || !view.dom.isConnected) { hide(); return false; }
  const host = scrollHost(view.dom);
  if (!host) { hide(); return false; }
  let caret = null;
  try { caret = view.coordsAtPos(view.state.selection.head); } catch { caret = null; }
  if (!caret) { hide(); return false; }
  const paper = view.dom.getBoundingClientRect();
  const box = bandBox({ caret, paper, host: host.getBoundingClientRect(),
                        scrollLeft: host.scrollLeft, scrollTop: host.scrollTop });
  if (!box) { hide(); return false; }
  if (!_band) {
    _band = el('div', BAND_CLASS);
    _band.setAttribute('aria-hidden', 'true');
  }
  if (_band.parentNode !== host) {
    // กล่องที่เลื่อนต้องเป็นกรอบอ้างอิงของ absolute — `.pane` เป็นอยู่แล้ว · หน้าต่างลอยที่ยังเป็น static ไม่วาด
    if (getComputedStyle(host).position === 'static') { hide(); return false; }
    host.appendChild(_band);
  }
  const st = _band.style;
  st.display = 'block';
  st.top = box.top + 'px'; st.left = box.left + 'px';
  st.width = box.width + 'px'; st.height = box.height + 'px';
  st.background = _cfg.lineBandColor;
  st.opacity = String(_cfg.lineBandOpacity);
  let ink = '';
  try { ink = getComputedStyle(view.dom).color; } catch {}
  st.mixBlendMode = bandBlend(ink);                  // ตัวหนังสือสว่าง = พื้นมืด → screen · ไม่งั้น multiply
  _box = box;
  return true;
}

/** ขอวาดใหม่ในเฟรมถัดไป (รวบหลายเหตุการณ์ให้เหลือครั้งเดียว · ปิดอยู่ = ไม่ทำอะไรเลย) */
export function scheduleLineBand() {
  if (!_cfg.lineBand || _job) return;
  _job = requestAnimationFrame(() => { _job = 0; try { update(); } catch { hide(); } });
}

/**
 * ใช้ค่าจาก settings — เรียกจาก applySettings()
 * @returns {boolean} เปิดอยู่ไหม
 */
export function applyLineBand(settings) {
  _cfg = normA11y(settings);
  if (_cfg.lineBand && !_bound) {
    document.addEventListener('selectionchange', scheduleLineBand);
    document.addEventListener('input', scheduleLineBand, true);
    document.addEventListener('keyup', scheduleLineBand, true);
    document.addEventListener('mouseup', scheduleLineBand, true);
    document.addEventListener('focusin', scheduleLineBand, true);
    window.addEventListener('resize', scheduleLineBand);
    _bound = true;
  }
  if (_cfg.lineBand) scheduleLineBand();
  else { if (_job) { cancelAnimationFrame(_job); _job = 0; } hide(); }
  return _cfg.lineBand;
}

/** วาดทันที (เทสใช้ — ไม่รอเฟรม) */
export function refreshLineBandNow() { try { return update(); } catch { hide(); return false; } }

/** สภาพปัจจุบัน (เทส) */
export function lineBandState() {
  const vis = !!(_band && _band.isConnected && _band.style.display !== 'none');
  return { on: _cfg.lineBand, visible: vis, box: _box ? { ..._box } : null,
           color: _cfg.lineBandColor, opacity: _cfg.lineBandOpacity,
           blend: _band ? _band.style.mixBlendMode : '' };
}
