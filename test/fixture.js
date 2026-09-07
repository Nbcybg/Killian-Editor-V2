// สร้างโปรเจกต์ทดสอบใหม่ทั้งก้อน (เรียกก่อนรัน e2e ทุกครั้ง — กัน state ค้างจากรอบก่อน)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = process.argv[2] || '/tmp/k2proj';
fs.rmSync(root, { recursive: true, force: true });
// [alpha.87] e2e ต้อง **idempotent** (บทเรียนข้อ 4) — เทส "เปิดโปรเจกต์ใหม่ต้องปิดของเก่า"
// สร้างโปรเจกต์ข้าง ๆ ไว้แล้วไม่เคยลบ · รอบแรกผ่าน รอบสองเจอโฟลเดอร์ค้าง → แท็บเก่าไม่ถูกปิด
// (อาการโผล่เฉพาะตอนรัน e2e ซ้ำบนเครื่องที่ /tmp ไม่ถูกล้างระหว่างรอบ)
fs.rmSync(path.join(path.dirname(root), 'โปรเจกต์ทดสอบปิดเก่า'), { recursive: true, force: true });
const w = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof d === 'string' ? d : JSON.stringify(d, null, 2)); };
w(path.join(root, 'project.khn.json'), { title: 'ปีศาจแห่งบางกอก', type: 'killian-project' });
const sec = path.join(root, 'เล่มหนึ่ง');
w(path.join(sec, 'section.json'), { guid: 's1', title: 'เล่มหนึ่ง', order: 1 });
const dr = path.join(sec, 'Draft', 'default');
w(path.join(dr, 'draft.json'), { chapters: [
  { guid: 'c1', title: 'บทที่หนึ่ง', order: 1, folderName: '01 - บทที่หนึ่ง' }] });
w(path.join(dr, 'scenes.json'), { chapters: { c1: [
  { id: 'sc1', title: 'ตลาดเก่า', order: 1, fileName: 'scene-01.md' },
  { id: 'sc2', title: 'บทหนังทดสอบ', order: 2, fileName: 'scene-02.md' }] } });
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) {
  c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function png(w0, h0) {
  const raw = Buffer.alloc((w0 * 3 + 1) * h0);
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++)
    raw.set([200 - ((x / w0 * 60) | 0), 90 + ((x / w0 * 40) | 0), 60], y * (w0 * 3 + 1) + 1 + x * 3);
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]); const cc = Buffer.alloc(4);
    cc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w0); ihdr.writeUInt32BE(h0, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(path.join(root, 'Images'), { recursive: true });
fs.writeFileSync(path.join(root, 'Images', 'sunset.png'), png(240, 90));
w(path.join(dr, 'Chapters', '01 - บทที่หนึ่ง', 'scene-01.md'),
`---
title: ตลาดเก่า
type: scene
format: prose
---

# บทที่หนึ่ง — ตลาดเก่า

ค่ำวันนั้น **โทระ** เดินเข้ามาพร้อม *ความลับ* ที่ _ไม่มีใครรู้_ และ ~~ความกลัว~~ ความหวัง

![ภาพตลาดยามเย็น](../../../../../Images/sunset.png)

> คนเราเลือกเกิดไม่ได้ แต่เลือกทางเดินได้เสมอ

- ข้าวสารหนึ่งถุง
- ปลาแห้ง **อย่างดี**

1. ไปหายัยแมว
2. กลับก่อนฟ้ามืด`);
w(path.join(dr, 'Chapters', '01 - บทที่หนึ่ง', 'scene-02.md'),
'---\ntitle: บทหนังทดสอบ\ntype: scene\nformat: screenplay\n---\n\n. ตลาด - เย็น\n@โทระ\nสวัสดีครับ');
w(path.join(root, 'Wiki', 'characters', 'cat.json'),
  { name: 'ยัยแมวเก้าชีวิต', entityTypeKey: 'characters', aliases: ['แมวดำ'] });
w(path.join(root, 'Memos', 'note-1.md'), '---\ntitle: โน้ตทดสอบ\ntype: memo\n---\n\nจดไว้ก่อน');
w(path.join(root, 'Memos', 'note-2.md'), '---\ntitle: อันนี้จะโดนทิ้ง\ntype: memo\n---\n\nx');
w(path.join(root, 'Plugins', 'demo', 'plugin.json'), { name: 'ปลั๊กอินทดสอบ', entry: 'main.js' });
w(path.join(root, 'Plugins', 'demo', 'main.js'),
  "k2.registerCommand('นับอักขระฉากนี้', () => { k2.setStatus('อักขระ: ' + k2.getMarkdown().length); });");
console.log('fixture OK →', root);
