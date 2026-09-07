// wiki-images.js — เมทาดาทาของรูปใน Wiki entity (alpha.60r2 · ข้อ 12)
// โมดูลบริสุทธิ์ — ไม่แตะ DOM/kapi (unit test แยกที่ test/wiki-images.test.cjs)
//
// เดิม entity.images[] เก็บเป็น "ชื่อไฟล์" (string) ล้วน ๆ → ใส่คำบรรยาย/ข้อความแทนรูปไม่ได้เลย
// ตอนนี้เก็บเป็นออบเจกต์ {file, caption, alt, title, width, height}
// **เข้ากันได้ย้อนหลัง 100%**: อ่านไฟล์เก่าที่เป็น string ได้เสมอ (migrateImages แปลงให้อัตโนมัติ)

/** ฟิลด์ที่เก็บได้ต่อรูปหนึ่งใบ */
export const IMAGE_FIELDS = ['file', 'caption', 'alt', 'title', 'width', 'height'];

const numOr0 = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** รูปหนึ่งใบในรูปแบบมาตรฐาน — รับได้ทั้ง string (แบบเก่า) และ object (แบบใหม่) */
export function normalizeImage(x) {
  if (x == null) return null;
  if (typeof x === 'string') {
    const f = x.trim();
    return f ? { file: f, caption: '', alt: '', title: '', width: 0, height: 0 } : null;
  }
  if (typeof x !== 'object') return null;
  // รองรับคีย์ชื่ออื่นที่เคยหลุดมาจากโค้ดเก่า (name/url)
  const file = String(x.file || x.name || x.url || '').trim();
  if (!file) return null;
  return {
    file,
    caption: String(x.caption ?? '').trim(),
    alt: String(x.alt ?? '').trim(),
    title: String(x.title ?? '').trim(),
    width: numOr0(x.width),
    height: numOr0(x.height),
  };
}

/** แปลงทั้งอาร์เรย์ให้เป็นรูปแบบใหม่ (ทิ้งรายการที่ไม่มีชื่อไฟล์) */
export function migrateImages(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list) {
    const im = normalizeImage(x);
    if (im) out.push(im);
  }
  return out;
}

/** ต้องเขียนกลับลงไฟล์ไหม — true เมื่อของเดิมยังเป็น string หรือมีรายการเสีย */
export function needsImageMigration(list) {
  if (!Array.isArray(list)) return false;
  return list.some((x) => typeof x !== 'object' || x == null || !('caption' in x));
}

/** ชื่อไฟล์ของรูป (ใช้กับโค้ดเดิมที่ต้องการ string) */
export function imageFile(x) {
  const im = normalizeImage(x);
  return im ? im.file : '';
}

/** รายชื่อไฟล์ทั้งหมด — สำหรับโค้ดเก่าที่ยังคิดว่า images เป็น string[] */
export function imageFiles(list) { return migrateImages(list).map((im) => im.file); }

/** ข้อความที่ควรแสดงใต้รูป (คำบรรยาย → ข้อความแทนรูป → ชื่อไฟล์) */
export function imageLabel(x) {
  const im = normalizeImage(x);
  if (!im) return '';
  return im.caption || im.alt || im.title || im.file;
}

/** ข้อความ alt ที่ควรใส่ใน <img> */
export function imageAlt(x) {
  const im = normalizeImage(x);
  if (!im) return '';
  return im.alt || im.caption || im.file;
}

/** แก้ไขเมทาดาทาของรูปที่ index i — คืนอาร์เรย์ใหม่ (ไม่แก้ของเดิม) */
export function setImageMeta(list, i, patch) {
  const arr = migrateImages(list);
  if (i < 0 || i >= arr.length) return arr;
  const cur = arr[i];
  const next = normalizeImage({ ...cur, ...(patch || {}) });
  arr[i] = next || cur;
  return arr;
}

/** ย้ายรูปที่ index i ไปเป็นรูปแรก (= รูปประจำตัว) */
export function makePrimary(list, i) {
  const arr = migrateImages(list);
  if (i <= 0 || i >= arr.length) return arr;
  const [pick] = arr.splice(i, 1);
  return [pick, ...arr];
}

/** เอารูปที่ index i ออก (ไฟล์จริงยังอยู่ในคลัง) */
export function removeImage(list, i) {
  const arr = migrateImages(list);
  if (i < 0 || i >= arr.length) return arr;
  arr.splice(i, 1);
  return arr;
}

/** เพิ่มรูปเข้าท้ายรายการ (ข้ามถ้ามีชื่อไฟล์ซ้ำอยู่แล้ว) */
export function addImage(list, x) {
  const arr = migrateImages(list);
  const im = normalizeImage(x);
  if (!im) return arr;
  if (arr.some((a) => a.file === im.file)) return arr;
  return [...arr, im];
}
