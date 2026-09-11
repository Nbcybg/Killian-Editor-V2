// test/fs-safe.test.cjs — [alpha.148] เขียนไฟล์แบบ atomic + กรองชื่อไฟล์ขยะของระบบปฏิบัติการ
const fs = require('fs');
const path = require('path');
const os = require('os');
const F = require('../fs-safe.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k2fssafe-'));
const tmpLeft = (d) => fs.readdirSync(d).filter((n) => n.includes(F.TMP_TAG));

// ═══════════ isJunkName ═══════════
{
  check('★ AppleDouble ._ = ขยะ', F.isJunkName('._มานี-mt72qvfu.json'));
  check('.DS_Store / Thumbs.db = ขยะ', F.isJunkName('.DS_Store') && F.isJunkName('Thumbs.db'));
  check('ไฟล์ชั่วคราวที่ค้างของเรา = ขยะ', F.isJunkName(path.basename(F.tmpPathFor(path.join(dir, 'ฉาก.md')))));
  check('ไฟล์ปกติไม่ใช่ขยะ', !F.isJunkName('มานี-mt72qvfu.json') && !F.isJunkName('scene-01.md'));
  check('dotfile ธรรมดาไม่ใช่ขยะ', !F.isJunkName('.k2history') && !F.isJunkName('.gitkeep'));
  check('ค่าว่างไม่พัง', F.isJunkName('') === false && F.isJunkName(null) === false);
}

// ═══════════ writeFileAtomic ═══════════
{
  const p = path.join(dir, 'ใหม่', 'ฉาก.md');
  F.writeFileAtomic(p, 'สวัสดี');
  check('เขียนไฟล์ใหม่ + สร้างโฟลเดอร์ให้', fs.readFileSync(p, 'utf8') === 'สวัสดี');
  F.writeFileAtomic(p, 'เนื้อใหม่');
  check('เขียนทับได้', fs.readFileSync(p, 'utf8') === 'เนื้อใหม่');
  check('ไม่เหลือไฟล์ชั่วคราว', tmpLeft(path.dirname(p)).length === 0, tmpLeft(path.dirname(p)).join(','));

  const b = path.join(dir, 'bin.dat');
  F.writeFileAtomic(b, [0, 127, 128, 255]);
  check('array ของไบต์ (≥0x80 ไม่บวม)', Buffer.compare(fs.readFileSync(b), Buffer.from([0, 127, 128, 255])) === 0);
  F.writeFileAtomic(b, new Uint8Array([9, 200]));
  check('Uint8Array', Buffer.compare(fs.readFileSync(b), Buffer.from([9, 200])) === 0);

  // ★ เขียนล้มกลางทาง = ไฟล์เดิมต้องอยู่ครบ (หัวใจของการแก้ครั้งนี้)
  const realWrite = fs.writeSync;
  fs.writeSync = () => { throw Object.assign(new Error('ENOSPC: ดิสก์เต็ม'), { code: 'ENOSPC' }); };
  let threw = false;
  try { F.writeFileAtomic(p, 'x'.repeat(5000)); } catch { threw = true; } finally { fs.writeSync = realWrite; }
  check('★ เขียนล้มกลางทาง → โยน error ให้ผู้เรียกรู้', threw);
  check('★ เขียนล้มกลางทาง → ไฟล์เดิมยังอยู่ครบ ไม่ว่างเปล่า', fs.readFileSync(p, 'utf8') === 'เนื้อใหม่');
  check('เขียนล้มกลางทาง → เก็บไฟล์ชั่วคราวทิ้ง', tmpLeft(path.dirname(p)).length === 0);

  // Windows: ปลายทางถูกโปรแกรมอื่นจับ → rename ทับไม่ได้ → ถอยไปเขียนตรง
  F.writeFileAtomic(p, 'ทางสำรอง', 'utf-8',
    { rename: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); } });
  check('rename ล้ม → ยังบันทึกได้ (เขียนตรง)', fs.readFileSync(p, 'utf8') === 'ทางสำรอง');
  check('rename ล้ม → ไม่ทิ้งไฟล์ชั่วคราวไว้', tmpLeft(path.dirname(p)).length === 0);

  // fsync เป็นตัวเลือก (ค่าเริ่มต้นปิด — ~22ms/ไฟล์ บน mac ทำให้ทุกการบันทึกหน่วง)
  F.writeFileAtomic(p, 'บังคับลงดิสก์', 'utf-8', { fsync: true });
  check('ตัวเลือก fsync:true เขียนได้ปกติ', fs.readFileSync(p, 'utf8') === 'บังคับลงดิสก์');
  {
    const realFsync = fs.fsyncSync;
    let called = 0;
    fs.fsyncSync = (...a) => { called++; return realFsync(...a); };
    try { F.writeFileAtomic(p, 'ค่าเริ่มต้น'); } finally { fs.fsyncSync = realFsync; }
    check('★ ค่าเริ่มต้นไม่เรียก fsync (ไม่หน่วงทุกการบันทึก)', called === 0, String(called));
  }

  // ปลายทางเป็นไปไม่ได้ (โฟลเดอร์แม่เป็นไฟล์) → ต้องโยน ไม่ใช่เงียบ
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'x');
  let threw2 = false;
  try { F.writeFileAtomic(path.join(blocker, 'a.md'), 'x'); } catch { threw2 = true; }
  check('path ที่เขียนไม่ได้จริง → โยน error', threw2);
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\nfs-safe: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
