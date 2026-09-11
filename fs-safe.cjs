// fs-safe.cjs — [alpha.148] การเขียนไฟล์ที่ "ไม่มีทางได้ไฟล์ครึ่งใบ" + ชื่อไฟล์ขยะของระบบปฏิบัติการ
//
// main.js เป็นคนเดียวที่แตะดิสก์ (renderer ผ่าน IPC `fs:*` ทั้งหมด) → ด่านเดียวที่ต้องแก้คือที่นี่
// แยกเป็นไฟล์ของตัวเองเพื่อให้ unit test ด้วย node ได้ตรง ๆ (main.js require electron — เทสไม่ได้)
//
// ── ทำไมต้อง atomic ──
// `fs.writeFileSync(p)` = เปิดไฟล์แบบตัดทิ้ง (O_TRUNC) ก่อน แล้วค่อยเขียน
// โปรแกรมถูกฆ่า/ไฟดับ/เครื่องค้าง ระหว่างสองจังหวะนั้น = ไฟล์ .md / scenes.json / project.khn.json
// **ว่างเปล่า** — งานทั้งฉากหรือทั้งสารบัญหายทันที
// ทางแก้มาตรฐาน: เขียนลงไฟล์ชั่วคราวข้าง ๆ → rename ทับ (rename ในโฟลเดอร์เดียวกันเป็น atomic)
// (fsync เป็นตัวเลือก ไม่เปิดเป็นค่าเริ่มต้น — เหตุผลอยู่ที่ writeFileAtomic)
//
// ── ทำไมต้องกรองชื่อขยะ ──
// macOS สร้าง `._<ชื่อไฟล์>` (AppleDouble) ทุกครั้งที่ก๊อปลงไดรฟ์ FAT/exFAT/SMB หรือแตกซิปจาก Mac
// ไฟล์พวกนี้ลงท้าย `.json`/`.md` เหมือนของจริง → โผล่เป็นแถวผีใน Explorer + WARN อ่าน JSON ไม่ได้
// (เจอจริงใน log ของผู้ใช้: "อ่านเอนทิตี้ไม่ได้: ._มานี-….json")

const fs = require('fs');
const path = require('path');

const TMP_TAG = '.k2tmp-';

/** ชื่อไฟล์ที่ระบบปฏิบัติการสร้างเอง หรือไฟล์ชั่วคราวของเราที่ค้างจากการเขียนที่ล้ม — ห้ามโชว์/อ่าน/ก๊อป */
function isJunkName(name) {
  const s = String(name || '');
  if (!s) return false;
  if (s.startsWith('._')) return true;                  // AppleDouble ของ macOS
  if (s === '.DS_Store' || s === 'Thumbs.db') return true;
  return s.startsWith('.') && s.includes(TMP_TAG);      // ไฟล์ชั่วคราวของ writeFileAtomic
}

let _seq = 0;
/** ไฟล์ชั่วคราว **ในโฟลเดอร์เดียวกัน** (rename ข้ามไดรฟ์ไม่ atomic และอาจล้ม) */
function tmpPathFor(p) {
  return path.join(path.dirname(p), '.' + path.basename(p) + TMP_TAG + process.pid + '-' + (_seq++));
}

function toBuffer(data, encoding) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data, encoding || 'utf-8');
  if (data instanceof Uint8Array || Array.isArray(data)) return Buffer.from(data);
  return Buffer.from(String(data == null ? '' : data), encoding || 'utf-8');
}

/**
 * เขียนไฟล์แบบ atomic — ผลลัพธ์มีแค่สองแบบ: ไฟล์ใหม่ครบทั้งใบ หรือไฟล์เดิมไม่ถูกแตะ
 * @param {string} p ไฟล์ปลายทาง (สร้างโฟลเดอร์ให้ถ้ายังไม่มี)
 * @param {string|Buffer|Uint8Array|number[]} data
 * @param {string} [encoding] ใช้เมื่อ data เป็นข้อความ (ค่าเริ่มต้น utf-8)
 * @param {{rename?: Function, fsync?: boolean}} [hooks] rename = ให้เทสจำลอง rename ล้มได้ ·
 *        fsync = บังคับลงดิสก์จริงก่อน rename (ค่าเริ่มต้น **ปิด**)
 *
 * ทำไม fsync ปิดเป็นค่าเริ่มต้น: วัดบนเครื่องจริง (mac Intel) fsync ใช้ ~22 ms ต่อไฟล์
 * เทียบกับ ~0.15 ms ของการเขียนปกติ และ main process เขียนแบบซิงก์ → ทุกการบันทึก/autosave
 * ทำให้ทั้งโปรแกรมหน่วง (e2e แผนที่ `[70-4]` แดงเพราะรอ 120 ms ไม่พอ) · สิ่งที่ผู้ใช้เจอจริงคือ
 * โปรแกรมถูกฆ่า/ค้าง — ข้อมูลที่เขียนลง OS แล้วรอดเสมอ และ rename ทำให้ไม่มีไฟล์ครึ่งใบ
 * กรณีที่ fsync ช่วยเพิ่มคือไฟดับทั้งเครื่อง ซึ่งต้องจ่ายด้วยความหน่วงทุกครั้งที่บันทึก
 */
function writeFileAtomic(p, data, encoding, hooks = {}) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const buf = toBuffer(data, encoding);
  const tmp = tmpPathFor(p);
  const rename = hooks.rename || fs.renameSync;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w');
    let off = 0;
    while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
    if (hooks.fsync) { try { fs.fsyncSync(fd); } catch {} }   // บางระบบไฟล์ (เครือข่าย) ไม่รองรับ — ไม่ใช่เหตุให้ล้ม
    fs.closeSync(fd); fd = null;
    try {
      rename(tmp, p);
    } catch {
      // Windows: ปลายทางถูกโปรแกรมอื่นจับอยู่ (แอนตี้ไวรัส/ตัวซิงก์คลาวด์) → rename ทับไม่ได้
      // ยอมถอยไปเขียนตรงแบบเดิมดีกว่าบันทึกไม่ได้เลย แล้วเก็บไฟล์ชั่วคราวทิ้ง
      fs.writeFileSync(p, buf);
      try { fs.rmSync(tmp, { force: true }); } catch {}
    }
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd); } catch {} }
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw e;
  }
  return true;
}

module.exports = { isJunkName, writeFileAtomic, tmpPathFor, TMP_TAG };
