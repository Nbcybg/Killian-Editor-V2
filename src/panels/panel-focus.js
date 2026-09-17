// ══════════ [alpha.152 ข้อ 5] ★★ "แผงที่กำลังเลือกอยู่" ══════════
//
// ผู้ใช้: *"bug อันนี้ร้ายแรง คือ shortcut มันไปจับนอก planner … สมมุติเราพิมพ์ในคุณสมบัติ
//          ไม่ได้เลือกแผง planner นะ กลายเป็นไปโดน shortcut พิมพ์ไม่ได้ ต้องแก้คือ
//          แผงที่มี shortcut ต้องทำการเลือกแผงก่อน ทำเครื่องหมาย เช่น สี title bar เข้ม
//          หรืออะไรก็ได้ที่บอกว่าเราเลือกและไม่เลือกแผงนี้อยู่"*
//
// ปัญหาเชิงโครงสร้าง: แผงกระดานผูกคีย์ที่ `document` แล้วถามแค่ว่า "แผงมองเห็นอยู่ไหม"
// ซึ่งเป็นจริงตลอดเวลาที่กระดานเปิดค้างไว้ · คีย์เครื่องมือของมัน (V H N T S F C L I K)
// เป็นตัวอักษรเปล่าไม่มี Ctrl จึงกลืนทุกตัวอักษรที่ผู้ใช้พิมพ์ในที่อื่นทั้งโปรแกรม
//
// ทางแก้ที่ผู้ใช้เสนอเป็นทางที่ถูก และแก้ทั้งชนิดของปัญหา ไม่ใช่แค่เคสนี้:
// **แผงต้องถูกเลือกก่อน คีย์ลัดของมันถึงจะทำงาน** และต้องเห็นด้วยตาว่าตอนนี้เลือกแผงไหนอยู่
//
// กฎการย้ายโฟกัส (ตั้งใจให้เดาง่าย):
//   · กดเมาส์/โฟกัสเข้าไป **ในแผงไหน** = เลือกแผงนั้น
//   · กดนอกแผงทุกใบ (แถบเครื่องมือ · เมนู · กล่องโต้ตอบ) = **ไม่เปลี่ยน** ของเดิมยังถูกเลือกอยู่
//     (ไม่งั้นกดปุ่มบนแถบเครื่องมือทีเดียวก็หลุดโฟกัสทุกครั้ง ซึ่งน่ารำคาญและไม่มีประโยชน์)
//
// โมดูลนี้ไม่รู้จักแผงไหนเป็นพิเศษ — ใครอยากมีคีย์ลัดก็ถาม `isPanelFocused(id)` เอง

const FOCUS_CLASS = 'k-panel-focus';

/**
 * แผงที่เป็น "เปลือกโปรแกรม" ไม่ใช่พื้นที่ทำงาน — กดแล้วไม่ย้ายโฟกัส
 *
 * แถบเครื่องมือกับแถบสถานะถูกลงทะเบียนเป็นแผงเหมือนกัน (ลาก/ผนึกได้) แต่ผู้ใช้ไม่ได้ "ทำงาน"
 * ในนั้น — กดปุ่มบนแถบเครื่องมือทีเดียวแล้วกระดานหลุดโฟกัสจนคีย์ลัดตาย คือสิ่งที่ไม่มีใครต้องการ
 */
const CHROME_PANELS = new Set(['toolbar', 'statusbar']);
let _focused = null;
const _subs = new Set();

/** id ของแผงที่ถูกเลือกอยู่ (null = ยังไม่เคยเลือกอะไรเลย) */
export function focusedPanel() { return _focused; }

/** แผงนี้ถูกเลือกอยู่ไหม */
export function isPanelFocused(id) { return !!id && _focused === id; }

/** ฟังการเปลี่ยนแผงที่เลือก — คืนฟังก์ชันเลิกฟัง */
export function onPanelFocus(fn) { _subs.add(fn); return () => _subs.delete(fn); }

/**
 * id ของแผงที่ element นี้อยู่ข้างใน (null = ไม่ได้อยู่ในแผงไหนเลย)
 *
 * แยก `.k-tab` ออกไปด้วย: หัวแท็บของกลุ่มแท็บก็นับเป็น "กดในแผงนั้น" ทั้งที่เนื้อแผง
 * อยู่คนละกล่อง — ไม่งั้นคลิกสลับแท็บแล้วโฟกัสไม่ตามไป
 */
export function panelIdAt(node) {
  let el = node;
  while (el && el !== document) {
    if (el.dataset && el.dataset.panelId) return el.dataset.panelId;
    el = el.parentNode || (el.getRootNode && el.getRootNode().host) || null;
  }
  return null;
}

/** ทาคลาสบอกสถานะลง DOM — เรียกซ้ำได้ทุกเมื่อ (ระบบแผงวาดใหม่บ่อย คลาสจึงหลุดได้) */
export function applyPanelFocus(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  let n = 0;
  for (const el of root.querySelectorAll('[data-panel-id]')) {
    const on = !!_focused && el.dataset.panelId === _focused;
    if (el.classList.contains(FOCUS_CLASS) !== on) { el.classList.toggle(FOCUS_CLASS, on); n++; }
  }
  return n;
}

/** เลือกแผง (null = ไม่เลือกอะไรเลย) — คืน true ถ้าเปลี่ยนจริง */
export function setFocusedPanel(id) {
  const next = id || null;
  if (_focused === next) { applyPanelFocus(); return false; }
  const prev = _focused;
  _focused = next;
  applyPanelFocus();
  for (const fn of _subs) { try { fn(next, prev); } catch { /* ผู้ฟังพังห้ามลาก UI ลงไปด้วย */ } }
  return true;
}

// ══════════ แผงที่ "ดูแลคีย์บอร์ดของตัวเอง" ══════════
//
// กระดานวางแผนมี undo/redo ของตัวเอง (ประวัติของกระดาน คนละกองกับประวัติของเอกสาร)
// แต่ตารางคีย์ลัดระดับโปรแกรมดัก Ctrl+Z ที่ `window` ระยะ capture — ยิงก่อนใครเสมอ
// แล้วสั่ง `editor-undo` ซึ่งไป **โฟกัสตัวแก้ไขเอกสาร** ทั้งที่ผู้ใช้กำลังทำงานบนกระดาน
// ผลคือกดย้อนกลับบนกระดานแล้วเอกสารย้อนแทน และโฟกัสกระโดดหนีไปจากกระดานด้วย
//
// → แผงที่ลงทะเบียนไว้ที่นี่ได้สิทธิ์ "คีย์ของเอกสารเป็นของฉัน" ตอนที่ตัวเองถูกเลือกอยู่
const _ownsKeys = new Set();

/** ประกาศว่าแผงนี้ดูแลคีย์บอร์ดของตัวเอง (เรียกตอนสร้างแผง) */
export function setPanelOwnsKeys(id, on = true) {
  if (!id) return false;
  if (on) _ownsKeys.add(id); else _ownsKeys.delete(id);
  return true;
}

/** แผงที่ถูกเลือกอยู่ตอนนี้ ดูแลคีย์บอร์ดเองไหม */
export function focusedPanelOwnsKeys() { return !!_focused && _ownsKeys.has(_focused); }

let _bound = false;
/**
 * ผูกการติดตามโฟกัสเข้ากับเอกสาร — เรียกครั้งเดียวตอนเปิดโปรแกรม
 *
 * ใช้ `pointerdown` ระยะ capture: ต้องรู้ก่อนที่โค้ดอื่นจะ `stopPropagation()`
 * (หัวแผงลากได้ ตัวลากกินอีเวนต์ไปหลายตัว)
 */
export function bindPanelFocus() {
  if (_bound) return false;
  const pick = (e) => {
    const id = panelIdAt(e.target);
    if (id && !CHROME_PANELS.has(id)) setFocusedPanel(id);   // นอกแผง = ไม่แตะของเดิม
  };
  document.addEventListener('pointerdown', pick, true);
  document.addEventListener('focusin', pick, true);
  _bound = true;
  return true;
}
