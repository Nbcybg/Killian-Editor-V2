// tab-order.js — [alpha.161 · K2] ลำดับของแท็บเอกสาร (บริสุทธิ์ 100% · มี unit test)
//
// เดิม: ปิดแท็บแล้วไป `[...state.tabs.keys()].pop()` = แท็บที่เปิด "ล่าสุด" เสมอ
//   → ปิดแท็บกลางแถวแล้วกระโดดไปท้ายแถว · ปิดแท็บที่ไม่ได้เลือกอยู่ก็ยังดึงโฟกัสไปแท็บท้ายด้วย
// ตอนนี้: ลำดับของแท็บ = ลำดับบนแถบ (ลากสลับได้) · ปิดแท็บที่เลือกอยู่ = ไปเพื่อนบ้านขวา (ไม่มีก็ซ้าย)
//   · ปิดแท็บที่ไม่ได้เลือก = แท็บที่เลือกอยู่ไม่เปลี่ยน

/**
 * แท็บที่ควรถูกเลือกหลังปิด `closed`
 * @param {string[]} keys ลำดับแท็บ **ก่อน** ปิด
 * @param {string} closed แท็บที่ปิด · @param {string|null} active แท็บที่เลือกอยู่ก่อนปิด
 * @returns {string|null} null = ไม่เหลือแท็บ
 */
export function neighborAfterClose(keys, closed, active) {
  const list = Array.isArray(keys) ? keys : [];
  const rest = list.filter((k) => k !== closed);
  if (!rest.length) return null;
  if (active && active !== closed && rest.includes(active)) return active;
  const i = list.indexOf(closed);
  if (i < 0) return rest[rest.length - 1];
  return list[i + 1] !== undefined ? list[i + 1] : list[i - 1];
}

/** แท็บถัดไป/ก่อนหน้าแบบวนรอบ (Ctrl+Tab / Ctrl+Shift+Tab) — ไม่มีแท็บที่เลือก = ตัวแรก/ตัวท้าย */
export function cycleTab(keys, active, dir = 1) {
  const list = Array.isArray(keys) ? keys : [];
  if (!list.length) return null;
  const i = list.indexOf(active);
  if (i < 0) return dir < 0 ? list[list.length - 1] : list[0];
  const n = list.length;
  return list[(((i + (dir < 0 ? -1 : 1)) % n) + n) % n];
}

/**
 * ย้ายแท็บ `key` ไปไว้ก่อน `beforeKey` (null = ท้ายแถว) — คืนลำดับใหม่ (ไม่แก้ของเดิม)
 * ย้ายไปที่เดิม/ไม่รู้จัก = ลำดับเดิม
 */
export function moveTabBefore(keys, key, beforeKey) {
  const list = Array.isArray(keys) ? keys.slice() : [];
  const from = list.indexOf(key);
  if (from < 0 || key === beforeKey) return list;
  list.splice(from, 1);
  const to = beforeKey == null ? -1 : list.indexOf(beforeKey);
  if (to < 0) list.push(key); else list.splice(to, 0, key);
  return list;
}

/** แท็บที่อยู่ทางขวาของ `key` (เมนู "ปิดแท็บทางขวา") */
export function tabsRightOf(keys, key) {
  const list = Array.isArray(keys) ? keys : [];
  const i = list.indexOf(key);
  return i < 0 ? [] : list.slice(i + 1);
}

/**
 * ส่วนประกอบของ tooltip แท็บจากทางไฟล์ (ไม่แตะดิสก์)
 * `<ราก>/<เล่ม>/Draft/<ร่าง>/Chapters/<บท>/<ไฟล์>` → { rel, book, chapter }
 * แท็บพิเศษ (`::…`) หรือไม่มีทาง = rel ว่าง
 */
export function tabPathParts(root, file) {
  const f = String(file || '');
  if (!f || f.startsWith('::')) return { rel: '', book: '', chapter: '' };
  const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const r = norm(root), p = norm(f);
  const rel = r && p.toLowerCase().startsWith(r.toLowerCase() + '/') ? p.slice(r.length + 1) : p;
  const segs = rel.split('/');
  const di = segs.indexOf('Draft'), ci = segs.indexOf('Chapters');
  const book = di > 0 ? segs[di - 1] : '';
  const chapter = ci >= 0 && ci + 2 < segs.length ? segs[ci + 1] : '';
  return { rel, book, chapter };
}

// ───────── [alpha.162 · W4 ข้อ 11] เปิดแท็บที่เพิ่งปิด ─────────
// กองของแท็บที่ปิดไป (ใหม่สุดอยู่ท้าย) · เก็บโปรเจกต์ไว้ด้วย — สลับโปรเจกต์แล้วต้องไม่ไปเปิดไฟล์ของอีกโปรเจกต์
// แท็บพิเศษ (`::…` เช่นเวอร์ชันเก่า/หน้าจอระบบ) ไม่ใช่ไฟล์บนดิสก์ → ไม่เข้ากอง

/** เพิ่มไฟล์ที่เพิ่งปิดเข้ากอง (ซ้ำ = ย้ายขึ้นบนสุด) — คืนกองใหม่ ไม่แก้ของเดิม */
export function pushClosed(stack, file, root, max = 20) {
  const list = (Array.isArray(stack) ? stack : []).filter((x) => !(x && x.file === file && x.root === root));
  if (!file || String(file).startsWith('::')) return list;
  list.push({ file, root: root || '' });
  return list.slice(-Math.max(1, max));
}

/**
 * ตัวที่จะเปิดคืน = ตัวบนสุดของโปรเจกต์นี้ที่ยังไม่ได้เปิดอยู่
 * @returns {{ file: string|null, rest: Array }} rest = กองหลังหยิบออก (ตัวที่เปิดอยู่แล้วถูกทิ้งไปด้วย)
 */
export function takeReopen(stack, root, openKeys = []) {
  const list = Array.isArray(stack) ? stack.slice() : [];
  const open = new Set(openKeys);
  for (let i = list.length - 1; i >= 0; i--) {
    const x = list[i];
    if (!x || x.root !== (root || '')) continue;
    list.splice(i, 1);
    if (open.has(x.file)) continue;
    return { file: x.file, rest: list };
  }
  return { file: null, rest: list };
}

// ───────── [alpha.162 · W4 ข้อ 11] ปักหมุดแท็บ ─────────
/** แท็บที่ปักหมุดอยู่หน้าแถวเสมอ (ลำดับภายในกลุ่มเดิมคงไว้) — คืนลำดับใหม่ ไม่แก้ของเดิม */
export function pinnedFirst(keys, pinned) {
  const list = Array.isArray(keys) ? keys : [];
  const p = new Set(Array.isArray(pinned) ? pinned : [...(pinned || [])]);
  return [...list.filter((k) => p.has(k)), ...list.filter((k) => !p.has(k))];
}
/** รายการที่คำสั่ง "ปิดแท็บอื่น/ปิดทางขวา" แตะได้ = ไม่รวมแท็บที่ปักหมุด */
export function closableOf(files, pinned) {
  const p = new Set(Array.isArray(pinned) ? pinned : [...(pinned || [])]);
  return (Array.isArray(files) ? files : []).filter((f) => !p.has(f));
}
