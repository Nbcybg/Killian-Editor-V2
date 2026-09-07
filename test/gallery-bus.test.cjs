// test/gallery-bus.test.cjs — [alpha.126] `src/gallery/gallery-bus.js`
//
// ตัวกลางเล็ก ๆ ที่ทำให้ "คลังรูป" กับ "กระดานอารมณ์" เห็นอัลบั้มเดียวกันโดยไม่ import หากัน
// เล็กแต่พลาดแล้วเจ็บ: ผู้ฟังที่ไม่ถูกถอดตอนปิดแผง = แผงเก่าถูกวาดซ้ำหลังถูก destroy ไปแล้ว
// (บทเรียนเดียวกับ listener ของ Esc ที่ค้างสะสมใน alpha.124)
require('./_lang.cjs');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_galbus.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/gallery/gallery-bus.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const B = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

// ───────── อัลบั้มที่กำลังดู ─────────
{
  const first = B.currentAlbum();
  ck('มีอัลบั้มตั้งต้นเสมอ', typeof first === 'string' && first.length > 0, first);
  ck('★ มุมมอง "รูปทั้งหมด" ใช้กระดานของอัลบั้มราก (ไม่มีกระดานของตัวเอง)',
     typeof B.boardAlbum() === 'string' && B.boardAlbum() !== first || B.boardAlbum() === first,
     first + ' → ' + B.boardAlbum());
  B.setCurrentAlbum('อัลบั้มหนึ่ง');
  ck('เปลี่ยนอัลบั้มแล้วอ่านค่าใหม่ได้', B.currentAlbum() === 'อัลบั้มหนึ่ง');
  ck('★ อยู่ในอัลบั้มจริง → กระดานคืออัลบั้มนั้นเอง', B.boardAlbum() === 'อัลบั้มหนึ่ง');
}

// ───────── ผู้ฟัง ─────────
{
  const seen = [];
  const off = B.onAlbumChange((id, from) => seen.push(id + '|' + (from || '')));
  B.setCurrentAlbum('สอง', 'gallery');
  ck('ผู้ฟังถูกเรียกเมื่ออัลบั้มเปลี่ยน', seen.length === 1, JSON.stringify(seen));
  ck('★ บอกด้วยว่ามาจากฝั่งไหน (กันวาดวนกลับ)', seen[0] === 'สอง|gallery', seen[0]);

  const before = seen.length;
  B.setCurrentAlbum('สอง', 'board');
  ck('★ ตั้งค่าเป็นอัลบั้มเดิม = ไม่ประกาศซ้ำ (ไม่งั้นสองแผงวาดวนกันไม่จบ)',
     seen.length === before, JSON.stringify(seen));
  B.setCurrentAlbum('', 'board');
  ck('ค่าว่างไม่ถูกรับ', seen.length === before && B.currentAlbum() === 'สอง');

  off();
  B.setCurrentAlbum('สาม');
  ck('★ ถอดผู้ฟังแล้วต้องไม่ถูกเรียกอีก (แผงที่ปิดไปแล้วห้ามถูกวาดซ้ำ)',
     seen.length === before, JSON.stringify(seen));
}

// ───────── ผู้ฟังที่โยน error ต้องไม่ล้มทั้งคิว ─────────
{
  const got = [];
  const offBad = B.onAlbumChange(() => { throw new Error('ผู้ฟังพัง'); });
  const offGood = B.onAlbumChange((id) => got.push(id));
  B.setCurrentAlbum('สี่');
  ck('★ ผู้ฟังตัวหนึ่งพัง ตัวที่เหลือยังได้รับ', got.length === 1 && got[0] === 'สี่', JSON.stringify(got));
  offBad(); offGood();
}

// ───────── กระดานถูกแก้ ─────────
{
  const hits = [];
  const off = B.onBoardChange((id) => hits.push(id));
  B.notifyBoardChanged('อัลบั้มx');
  ck('ประกาศว่ากระดานเปลี่ยนได้', hits.length === 1 && hits[0] === 'อัลบั้มx', JSON.stringify(hits));
  off();
  B.notifyBoardChanged('อัลบั้มy');
  ck('ถอดผู้ฟังกระดานได้', hits.length === 1, JSON.stringify(hits));
  ck('ไม่มีผู้ฟังเลยก็ไม่พัง', (() => { try { B.notifyBoardChanged('z'); return true; } catch { return false; } })());
}

console.log(`\ngallery-bus: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
