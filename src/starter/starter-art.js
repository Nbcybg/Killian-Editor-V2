// starter-art.js — [alpha.169] ช่องใส่ภาพประกอบของ Story Starter (บริสุทธิ์ 100% · unit `starter-art`)
//
// ผู้ใช้: *"ใน story starter เตรียม place holder ใส่รูป เหมือน setup wizard กำหนดขนาดมาเลย"*
//
// ตัวติดตั้งโปรแกรม (setup wizard) มีภาพสองตำแหน่ง: แถบภาพแนวตั้งข้างซ้าย กับแถบภาพหัวหน้า
// ที่นี่ทำแบบเดียวกัน และ **ขนาดถูกกำหนดไว้ตายตัว** — คนทำภาพทำตามตารางนี้แล้ววางไฟล์ได้เลย ไม่ต้อง build:
//
//   ตำแหน่ง   ขนาดไฟล์ (px)   แสดงบนจอ (px ที่ 100%)   ใช้เมื่อ
//   side      480 × 920       240 × 460                เนื้อแผงกว้าง ≥ ART_WIDE_MIN (แผงผนึกขนาดตั้งต้น 680px ก็ได้แล้ว) — แถบภาพข้างซ้ายของ wizard
//   top       1200 × 300      เต็มความกว้าง × ¼        แผงแคบ / หน้ารวม — แถบภาพหัวหน้า
//
// ไฟล์อยู่ที่ `renderer/starter/` ชื่อ `<ช่อง>-<ตำแหน่ง>.png`:
//   ช่อง = id ของขั้น (tags · intro · cast · w · cover) หรือ `home` (หน้ารวม) · ไม่มีไฟล์ของช่องนั้น = ใช้ `default-<ตำแหน่ง>.png`
//   ไม่มีทั้งคู่ = กรอบ placeholder ที่บอกขนาดกับชื่อไฟล์ (ตัววาดอยู่ใน starter-wizard.js)
//
// ทำไมไฟล์ใหญ่เป็นสองเท่าของที่แสดง: จอ 150–200% (แล็ปท็อปส่วนใหญ่) จะได้ไม่เบลอ

/** โฟลเดอร์ของภาพ (สัมพัทธ์กับ renderer/index.html) */
export const ART_DIR = 'starter';
/** นามสกุลที่รับ — ลองตามลำดับ */
export const ART_EXTS = ['png', 'jpg', 'webp'];
/** แผงกว้างเท่าไร (px) จึงใช้แถบภาพข้างซ้าย — ต้องตรงกับ `@container stw (min-width: …)` ใน style.css (unit ตรวจ) */
export const ART_WIDE_MIN = 600;

/**
 * ตำแหน่งของภาพ — `w/h` = ขนาดไฟล์ที่ต้องทำ · `cssW/cssH` = ขนาดที่แสดง (px ที่ --ui-scale 1)
 * `top` ไม่มี cssW เพราะกว้างเต็มแผง (สูงตามสัดส่วน w:h)
 */
export const ART_SLOTS = {
  side: { id: 'side', w: 480, h: 920, cssW: 240, cssH: 460 },
  top:  { id: 'top',  w: 1200, h: 300, cssW: 0, cssH: 0 },
};

/** เครื่องหมายคูณของ "กว้าง x สูง" (U+00D7) — สร้างจากรหัส เพราะตัวอักษรนี้อยู่ในช่วงที่ด่านไอคอนกวาด แต่ตรงนี้เป็นวรรคตอนของขนาด ไม่ใช่ไอคอน */
const TIMES = String.fromCharCode(0xD7);

/** ช่องของหน้ารวม (ไม่ใช่ขั้นของ wizard) */
export const ART_HOME = 'home';
/** ชื่อช่องสำรอง */
export const ART_DEFAULT = 'default';

/** ชื่อช่องที่ปลอดภัย — id ของขั้นเป็น a-z0-9 อยู่แล้ว (กันชื่อจากไฟล์เสีย/ขั้นของปลั๊กอินในอนาคต) */
export function artKey(id) {
  const k = String(id == null ? '' : id).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return k || ART_DEFAULT;
}

/** ชื่อไฟล์ของช่อง+ตำแหน่ง (ไม่มีนามสกุล) เช่น `tags-side` */
export function artBase(id, slot) {
  const s = ART_SLOTS[slot] ? slot : 'top';
  return artKey(id) + '-' + s;
}

/**
 * ทางไฟล์ที่ต้องลองตามลำดับ: ของช่องนั้นก่อน (ทุกนามสกุล) แล้วค่อยของ `default`
 * @returns {string[]} เช่น ['starter/tags-side.png', 'starter/tags-side.jpg', …, 'starter/default-side.png', …]
 */
export function artCandidates(id, slot) {
  const keys = artKey(id) === ART_DEFAULT ? [ART_DEFAULT] : [artKey(id), ART_DEFAULT];
  const s = ART_SLOTS[slot] ? slot : 'top';
  const out = [];
  for (const k of keys) for (const ext of ART_EXTS) out.push(ART_DIR + '/' + k + '-' + s + '.' + ext);
  return out;
}

/**
 * เลือกไฟล์จาก "รายชื่อที่มีจริง" (main ส่งมา) — ไม่ต้องลองโหลดทีละชื่อ
 * @param {string[]} names ชื่อไฟล์ใน renderer/starter/
 * @returns {string|null} ทางไฟล์สัมพัทธ์ที่ใช้เป็น `img.src` ได้เลย หรือ null = ไม่มีภาพ (วาด placeholder)
 */
export function pickArt(names, id, slot) {
  const have = new Map((names || []).map((n) => [String(n).toLowerCase(), String(n)]));
  for (const c of artCandidates(id, slot)) {
    const file = c.slice(ART_DIR.length + 1);
    const hit = have.get(file.toLowerCase());
    if (hit) return ART_DIR + '/' + hit;
  }
  return null;
}

/** ข้อความขนาด เช่น `480 × 920` (ตัวเลข ไม่ผ่านไฟล์ภาษา) */
export function artSizeText(slot) {
  const s = ART_SLOTS[slot] || ART_SLOTS.top;
  return s.w + ' ' + TIMES + ' ' + s.h;
}

/** สัดส่วน กว้าง/สูง ของตำแหน่ง (ใช้เป็น aspect-ratio) */
export function artRatio(slot) {
  const s = ART_SLOTS[slot] || ART_SLOTS.top;
  return s.w / s.h;
}

/** ตารางสำหรับเอกสาร/README: ทุกไฟล์ที่ทำได้ของชุดขั้นที่ให้มา */
export function artManifest(stepIds = []) {
  const keys = [ART_DEFAULT, ART_HOME, ...stepIds.map(artKey)];
  const rows = [];
  for (const k of [...new Set(keys)]) {
    for (const slot of Object.keys(ART_SLOTS)) {
      if (k === ART_HOME && slot === 'side') continue;      // หน้ารวมมีแต่แถบหัว
      rows.push({ key: k, slot, file: ART_DIR + '/' + k + '-' + slot + '.png', w: ART_SLOTS[slot].w, h: ART_SLOTS[slot].h });
    }
  }
  return rows;
}
