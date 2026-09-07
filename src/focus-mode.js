// focus-mode.js — หรี่บรรทัดอื่น เหลือเฉพาะบรรทัดที่กำลังเขียน (ใช้คู่กับ toggleFocus ใน app.js)
// สำคัญ: การไฮไลต์ทำผ่าน "decoration" ของ ProseMirror (focusLinePlugin ใน editor.js)
//        ห้ามใส่ class ลง DOM ของ PM เอง — DOMObserver ของ PM จะซ่อมกลับทันที
import { el, state } from './core.js';
import { setFocusLine, refreshFocusLine } from './editor.js';

const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, .sp-block';

let _fmActive = false;
let _fmStyle = null;

export function isFocusMode() { return _fmActive; }

function elemOf(node) {
  if (!node) return null;
  return node.nodeType === 1 ? node : node.parentElement;
}

// หาบล็อกที่เคอร์เซอร์อยู่ — เอาจาก ProseMirror ก่อน (แม่นแม้หน้าต่างไม่มี DOM focus)
// ใช้โดย typewriter.js (เลื่อนจอ) — การไฮไลต์ใช้ decoration ไม่ผ่านฟังก์ชันนี้
export function cursorBlock() {
  const view = state.active?.editor?.view || state.active?.sp?.view;
  if (view) {
    try {
      const $from = view.state.selection.$from;
      const cands = [];
      if ($from.depth >= 1) cands.push(view.nodeDOM($from.before(1)));
      const at = view.domAtPos($from.pos);
      cands.push(at.node.nodeType === 1 ? (at.node.childNodes[at.offset] || at.node) : at.node);
      for (const c of cands) {
        const start = !c ? null : c.nodeType === 1 ? c : c.parentElement;
        const blk = start && start.closest(BLOCK_SEL);
        if (blk && view.dom.contains(blk)) return { pm: view.dom, blk };
      }
      const first = view.dom.querySelector(BLOCK_SEL);
      if (first) return { pm: view.dom, blk: first };
    } catch { /* ตำแหน่งไม่ตรงกับ DOM (doc เพิ่งเปลี่ยน) → ใช้ทางสำรอง */ }
  }
  const sel = window.getSelection();
  const start = elemOf(sel && sel.anchorNode);
  if (!start) return null;
  const pm = start.closest('.ProseMirror');
  const blk = start.closest(BLOCK_SEL);
  return pm && blk ? { pm, blk } : null;
}

// สั่งให้ทุกตัวแก้ไขที่เปิดอยู่คำนวณ decoration ใหม่
function refreshAll() {
  for (const t of state.tabs.values()) {
    const v = t.editor?.view || t.sp?.view;
    if (v) refreshFocusLine(v);
  }
}

// ความจางของบรรทัดที่ไม่ได้เขียนอยู่ — ผู้ใช้ปรับได้ในตั้งค่า → การเขียน (settings.focusDim)
export function focusDim() {
  const v = Number(state.settings?.focusDim);
  return Number.isFinite(v) ? Math.min(0.8, Math.max(0.05, v)) : 0.3;
}

// ตั้งค่าความจางใหม่ระหว่างเปิดโหมดอยู่ (ตัวเลื่อนในกล่องตั้งค่าเรียกตัวนี้เพื่อดูผลทันที)
export function applyFocusDim() {
  document.documentElement.style.setProperty('--fm2-dim', String(focusDim()));
}

export function toggleFocusMode2(on) {
  const want = on === undefined ? !_fmActive : !!on;
  _fmActive = want;
  setFocusLine(want);
  if (_fmActive) {
    if (!_fmStyle) {
      // หรี่ทุกบล็อกยกเว้นบล็อกที่มีเคอร์เซอร์ — ใช้ตัวแปรสีของธีม/กระดาษ ไม่ฮาร์ดโค้ดดำ
      _fmStyle = el('style', 'fm-style');
      _fmStyle.textContent = `
        body.fm2 .ProseMirror > p, body.fm2 .ProseMirror > h1, body.fm2 .ProseMirror > h2,
        body.fm2 .ProseMirror > h3, body.fm2 .ProseMirror > h4, body.fm2 .ProseMirror > h5,
        body.fm2 .ProseMirror > h6, body.fm2 .ProseMirror > ul, body.fm2 .ProseMirror > ol,
        body.fm2 .ProseMirror > blockquote, body.fm2 .ProseMirror > .sp-block {
          opacity:var(--fm2-dim,.3); transition:opacity .15s;
        }
        body.fm2 .ProseMirror .fm2-active { opacity:1 !important; }
      `;
      document.head.append(_fmStyle);
    }
    applyFocusDim();
    document.body.classList.add('fm2');
  } else {
    document.body.classList.remove('fm2');
    if (_fmStyle) { _fmStyle.remove(); _fmStyle = null; }
  }
  refreshAll();
  return _fmActive;
}
