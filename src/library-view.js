// library-view.js — [alpha.168] ตรรกะของหน้า "จัดการเล่ม" / "จัดการบท" แบบห้องสมุด (บริสุทธิ์ 100% · unit `library-view`)
//
// ผู้ใช้: "จัดการบท จัดการเล่ม ปรับ ui ux ให้ด้วย ดูโบราณมาก ๆ · การเรียงลำดับยังติด ๆ ขัด ๆ มั่ว ๆ อยู่
//          อาจจะเพราะไม่มี info หรือ ui ที่บอกอะไรเลย · เหมือนรูปที่ 1 มากกว่า" (หน้าคลังหนังสือ: ตารางปก + แผงรายละเอียด)
// ต้นตอ "ลากเรียงติดขัด": ใช้ HTML5 drag บนการ์ดทั้งใบ — ไม่มีเส้นบอกว่าจะไปลงตรงไหน · dragleave ยิงรัวเมื่อผ่านลูก
//   (ไฮไลต์กระพริบ) · ปล่อยได้แค่ "ก่อนใบที่ชี้" (ย้ายไปท้ายสุดไม่ได้) · และถ้าเรียงมุมมองด้วยอย่างอื่นอยู่ ลำดับที่เห็น ≠ ลำดับจริง
// ตอนนี้: ลากด้วยเมาส์ (pointer) · เส้นแทรกชัด · ลงท้ายสุดได้ · ลากเรียงได้เฉพาะตอน "เรียงตามลำดับเรื่อง" (บอกผู้ใช้ตรง ๆ)

/** ตัวเลือกการเรียงที่หน้าจอใช้ (ป้ายแปลตอนวาด) */
export const LIB_SORTS = ['order', 'title', 'words', 'status', 'updated'];

/**
 * กรอง + เรียงรายการ
 * @param items [{ id, title, order, words, status, updated }]
 * @param o { q, status, sort, dir, statusRank }  statusRank = (status) → ลำดับของสถานะ (ตามตารางสถานะ)
 */
export function libraryList(items, o = {}) {
  const q = String(o.q || '').trim().toLowerCase();
  let list = (items || []).filter((it) => {
    if (o.status && o.status !== 'all' && (it.status || '') !== o.status) return false;
    if (!q) return true;
    return [it.title, it.blurb, it.folder].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  const sort = LIB_SORTS.includes(o.sort) ? o.sort : 'order';
  const rank = typeof o.statusRank === 'function' ? o.statusRank : () => 0;
  const cmpTitle = typeof o.cmpText === 'function' ? o.cmpText : (a, b) => String(a).localeCompare(String(b));
  const by = {
    order: (a, b) => (a.order || 0) - (b.order || 0),
    title: (a, b) => cmpTitle(a.title || '', b.title || ''),
    words: (a, b) => (b.words || 0) - (a.words || 0),
    status: (a, b) => rank(a.status) - rank(b.status),
    updated: (a, b) => (b.updated || 0) - (a.updated || 0),
  }[sort];
  list = list.slice().sort((a, b) => by(a, b) || (a.order || 0) - (b.order || 0));
  if (o.dir === 'desc') list.reverse();
  return list;
}

/** ลากเรียงได้ไหมในสภาพนี้ — ต้องเห็นลำดับจริงครบ (เรียงตามลำดับ · ไม่กรอง · ไม่ค้นหา) */
export function canReorder(o = {}) {
  return (o.sort || 'order') === 'order' && o.dir !== 'desc' && !String(o.q || '').trim() && (!o.status || o.status === 'all');
}

/**
 * ตำแหน่งแทรกจากจุดเมาส์ — rects = กรอบของการ์ดตามลำดับที่เห็น ({left,top,width,height})
 * ตาราง: หาแถวที่เมาส์อยู่ (ตามแนวตั้ง) แล้วดูว่าอยู่ซ้าย/ขวาของกึ่งกลางการ์ดใบไหน
 * @returns 0..rects.length (length = ต่อท้ายสุด)
 */
export function insertIndexAt(rects, x, y) {
  const n = (rects || []).length;
  if (!n) return 0;
  // แถว = การ์ดที่ช่วงแนวตั้งทับกัน
  const rows = [];
  rects.forEach((r, i) => {
    const row = rows.find((w) => Math.abs(w.top - r.top) < Math.min(w.height, r.height) / 2);
    if (row) { row.items.push(i); row.bottom = Math.max(row.bottom, r.top + r.height); }
    else rows.push({ top: r.top, height: r.height, bottom: r.top + r.height, items: [i] });
  });
  rows.sort((a, b) => a.top - b.top);
  let row = rows.find((w) => y < w.bottom) || rows[rows.length - 1];
  if (y < rows[0].top) row = rows[0];
  for (const i of row.items) {
    const r = rects[i];
    if (x < r.left + r.width / 2) return i;
  }
  return row.items[row.items.length - 1] + 1;
}

/**
 * ย้ายรายการ id ไปตำแหน่งแทรก idx (ของลำดับเดิม) → { beforeId } สำหรับ API แบบ "ย้ายไปก่อน X" (null = ท้ายสุด)
 * คืน null เมื่อไม่ต้องขยับ (ปล่อยที่เดิม)
 */
export function moveTarget(ids, fromId, idx) {
  const i = (ids || []).indexOf(fromId);
  if (i < 0) return null;
  if (idx === i || idx === i + 1) return null;             // ปล่อยข้างตัวเอง = ไม่เปลี่ยน
  return { beforeId: idx >= ids.length ? null : ids[idx] };
}

/** ย้ายขึ้น/ลงหนึ่งตำแหน่ง → { beforeId } (null = ท้ายสุด) หรือ null ถ้าขยับไม่ได้ */
export function stepTarget(ids, id, dir) {
  const i = (ids || []).indexOf(id);
  if (i < 0) return null;
  if (dir < 0) return i === 0 ? null : { beforeId: ids[i - 1] };
  if (i >= ids.length - 1) return null;
  return { beforeId: i + 2 >= ids.length ? null : ids[i + 2] };
}

/** สีปกที่สร้างเองจากชื่อ (ไม่มีรูปปก) — เฉดคงที่ต่อชื่อ */
export function coverHue(title) {
  let h = 0;
  for (const ch of String(title || '')) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}
