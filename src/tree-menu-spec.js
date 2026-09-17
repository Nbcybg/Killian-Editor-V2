// tree-menu-spec.js — [alpha.155] เมนูคลิกขวาของ Explorer ทุกชนิดแถว (ตรรกะล้วน · มี unit test)
//
// ผู้ใช้: *"ใน explorer หลาย ๆ ตัวยังไม่มี find on disk ... เอางี้เดี๋ยวเรา list อีกทีว่าต้องมีอะไรบ้าง"*
// → รายการที่ผู้ใช้ส่งมา (0. Project · 1. เล่ม · 1.1 บท · 1.1.1 ฉาก · 1.3 Memo · 2. คลังรูป ·
//   3. planner · 4. แผงแตกสาย) คือ **ลำดับในตารางนี้ตรงตัว** — ห้ามสลับลำดับในโค้ดที่อื่น
//
// ตารางเก็บแค่ "อะไร · ลำดับไหน · เส้นคั่นตรงไหน" · สิ่งที่แต่ละรายการทำอยู่ที่ app.js (`treeMenuHandlers`)
// ป้ายชื่อทุกรายการ = คีย์ `ui.treeMenu.<id>` ในไฟล์ภาษา (รายการที่สลับสองสถานะ เช่น ติดดาว/เอาดาวออก
// ใช้คีย์ `ui.treeMenu.<id>Off` ตอนเปิดอยู่)

/** ลำดับเมนูต่อชนิดแถว · `'-'` = เส้นคั่น */
export const TREE_MENU_SPEC = {
  // 0. Project — แถวชื่อโปรเจกต์บนสุด + คลิกขวาพื้นที่ว่างของต้นไม้
  project: [
    'addBook', 'renameProject', '-',
    'quickOpen', 'searchProject', 'dashboard', 'kanban', 'journal', '-',
    'play', 'playerHistory', '-',
    'branchPanel', '-',
    'projectSettings', 'aiSettings', 'reveal',
  ],
  // 1. เล่ม
  book: [
    'addBook', 'rename', 'reorder', '-',
    'addChapter', 'duplicate', 'star', '-',
    'manageBooks', 'manageChapters', 'searchIn', 'readBook', '-',
    'quickNote', 'viewQuickNotes', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'color', 'status', 'pin', '-',
    'lock', 'backup', 'restore', '-',
    'delete',
  ],
  // 1.1 บท
  chapter: [
    'addChapter', 'bookFromChapter', 'visual', 'rename', 'reorder', '-',
    'addScene', 'copy', 'paste', 'duplicate', 'move', 'star', '-',
    'manageChapters', 'manageScenes', 'searchIn', 'readChapter', 'readBook', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'color', 'status', 'pin', '-',
    'lock', 'backup', 'restore', '-',
    'delete',
  ],
  // 1.1.1 ฉาก
  scene: [
    'open', 'addScene', 'addChapter', 'chapterFromScenes', 'rename', 'reorder', 'switchFormat', '-',
    'copy', 'paste', 'duplicate', 'moveUp', 'moveDown', 'move', 'star', '-',
    'quickNote', 'comment', 'readScene', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'color', 'status', 'pin', '-',
    'saveVersion', 'versionHistory', 'compareVersion', '-',
    'splitView', 'toMemo', '-',
    'lock', 'backup', 'restore', '-',
    'delete',
  ],
  // 1.3 Memo (หัวหมวด)
  memoHead: ['open', 'addMemo', '-', 'reveal'],
  // 1.3.1 file memo
  memo: [
    'open', 'addMemo', 'sceneFromMemo', 'rename', '-',
    'copy', 'paste', 'duplicate', 'moveUp', 'moveDown', 'move', 'star', '-',
    'quickNote', 'comment', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'color', 'status', 'pin', '-',
    'saveVersion', 'versionHistory', 'compareVersion', '-',
    'splitView', '-',
    'lock', 'backup', 'restore', '-',
    'delete',
  ],
  // 2. คลังรูป (หัวหมวด)
  galleryHead: ['openGallery', 'addAlbum', 'importImage', 'moodBoard', '-', 'reveal'],
  // 2.1 ไฟล์รูป
  image: [
    'view', 'insert', 'rename', '-',
    'copy', 'paste', 'duplicate', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'delete',
  ],
  // 3. planner (หัวหมวด)
  plannerHead: ['addBoard', 'openPlannerPanel', '-', 'reveal'],
  // 3.1 file planner
  board: [
    'open', 'addBoard', 'rename', '-',
    'copy', 'paste', 'duplicate', 'star', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'color', 'status', 'pin', '-',
    'lock', '-',
    'delete',
  ],
  // 4. แผงแตกสาย (หัวหมวด)
  branchHead: ['openBranchPanel', 'addPlan', '-', 'reveal'],
  // 4.1 file แผน
  plan: [
    'open', 'addPlan', 'rename', '-',
    'copy', 'paste', 'duplicate', 'star', '-',
    'propsPopup', 'propsPanel', 'reveal', '-',
    'color', 'status', 'pin', '-',
    'compare', 'lock', '-',
    'delete',
  ],
};

/** รายการที่เป็นการลบ/ทิ้ง — วาดเป็นสีอันตรายเสมอ */
export const DANGER_ITEMS = new Set(['delete']);

/** รายการที่สลับสองสถานะ — ป้ายตอน "เปิดอยู่" ใช้คีย์ `<id>Off` */
export const TOGGLE_ITEMS = new Set(['star', 'pin', 'lock']);

/** รายการที่ "เปลี่ยนโครง/เนื้อหา" — ของที่ถูกล็อก (หรืออยู่ในเล่ม/บทที่ล็อก) ทำไม่ได้ */
export const LOCK_BLOCKED = new Set([
  'rename', 'reorder', 'addChapter', 'addScene', 'chapterFromScenes', 'bookFromChapter',
  'switchFormat', 'paste', 'moveUp', 'moveDown', 'move', 'toMemo', 'restore', 'delete',
]);

/** คีย์ป้ายชื่อของรายการ */
export function menuLabelKey(id, on = false) {
  return 'ui.treeMenu.' + id + (on && TOGGLE_ITEMS.has(id) ? 'Off' : '');
}

/** ทุกคีย์ป้ายชื่อที่ตารางนี้อาจใช้ (ให้เทสตรวจว่ามีในไฟล์ภาษาครบ) */
export function allMenuLabelKeys() {
  const keys = new Set();
  for (const list of Object.values(TREE_MENU_SPEC)) {
    for (const id of list) {
      if (id === '-') continue;
      keys.add(menuLabelKey(id));
      if (TOGGLE_ITEMS.has(id)) keys.add(menuLabelKey(id, true));
    }
  }
  return [...keys];
}

/**
 * ประกอบรายการเมนูจากตาราง
 * @param {string} kind ชนิดแถว (คีย์ของ TREE_MENU_SPEC)
 * @param {(id:string) => (object|null)} resolve คืน `{label, click, danger?, disabled?}` ·
 *   `null` = ไม่แสดงรายการนี้ในบริบทนี้
 * @returns {Array<object|'-'>} เส้นคั่นซ้อน/หัว/ท้ายถูกยุบทิ้งแล้ว
 */
export function buildMenuItems(kind, resolve) {
  const spec = TREE_MENU_SPEC[kind];
  if (!spec) return [];
  const out = [];
  for (const id of spec) {
    if (id === '-') {
      if (out.length && out[out.length - 1] !== '-') out.push('-');
      continue;
    }
    const it = resolve(id);
    if (!it) continue;
    out.push({ ...it, id, danger: it.danger || DANGER_ITEMS.has(id) });
  }
  while (out.length && out[out.length - 1] === '-') out.pop();
  return out;
}

/**
 * ย้ายสมาชิกไปตำแหน่งที่ระบุ (1 = บนสุด) — ใช้กับ "เปลี่ยนลำดับเล่ม/บท/ฉาก"
 * @returns {Array} อาร์เรย์ใหม่ (ของเดิมไม่ถูกแก้) · ตำแหน่งนอกช่วงถูกหนีบเข้าช่วง
 */
export function moveToPosition(list, index, position) {
  const arr = [...(list || [])];
  if (index < 0 || index >= arr.length) return arr;
  const to = Math.max(0, Math.min(arr.length - 1, Math.round(Number(position) || 1) - 1));
  const [it] = arr.splice(index, 1);
  arr.splice(to, 0, it);
  return arr;
}

/** ลำดับติดกันที่ต้องสลับเพื่อ "เลื่อนขึ้น/ลง" — คืน index ปลายทาง (-1 = ขยับไม่ได้) */
export function stepIndex(length, index, dir) {
  const to = index + (dir < 0 ? -1 : 1);
  return (index < 0 || to < 0 || to >= length) ? -1 : to;
}
