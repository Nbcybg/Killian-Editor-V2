// test/library-view.test.cjs — [alpha.168] หน้าจัดการเล่ม/บทแบบห้องสมุด: กรอง · เรียง · ลากเรียง (ตำแหน่งแทรก)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_libview.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/library-view.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const L = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

const items = [
  { id: 'a', title: 'ข', order: 2, words: 50, status: 'draft', updated: 3 },
  { id: 'b', title: 'ก', order: 1, words: 900, status: 'done', updated: 1 },
  { id: 'c', title: 'ค', order: 3, words: 10, status: 'draft', updated: 9, blurb: 'มังกรไฟ' },
];
const ids = (l) => l.map((x) => x.id).join();
check('เรียงตามลำดับเรื่อง (ค่าเริ่มต้น)', ids(L.libraryList(items)) === 'b,a,c');
check('เรียงตามชื่อ', ids(L.libraryList(items, { sort: 'title' })) === 'b,a,c');
check('เรียงตามจำนวนคำ (มากก่อน)', ids(L.libraryList(items, { sort: 'words' })) === 'b,a,c');
check('เรียงตามแก้ล่าสุด (ใหม่ก่อน)', ids(L.libraryList(items, { sort: 'updated' })) === 'c,a,b');
check('เรียงตามสถานะ (ตามตารางสถานะ · เท่ากัน = ลำดับเรื่อง)', ids(L.libraryList(items, { sort: 'status', statusRank: (s) => (s === 'draft' ? 0 : 1) })) === 'a,c,b');
check('กลับทิศ', ids(L.libraryList(items, { dir: 'desc' })) === 'c,a,b');
check('กรองสถานะ', ids(L.libraryList(items, { status: 'draft' })) === 'a,c');
check('ค้นหาในคำโปรยด้วย', ids(L.libraryList(items, { q: 'มังกร' })) === 'c');
check('ลากเรียงได้เฉพาะตอนเห็นลำดับจริงครบ', L.canReorder({}) && !L.canReorder({ sort: 'title' }) && !L.canReorder({ q: 'x' }) &&
  !L.canReorder({ status: 'draft' }) && !L.canReorder({ dir: 'desc' }) && L.canReorder({ status: 'all' }));

// ตาราง 3 คอลัมน์ × 2 แถว (การ์ด 100×150 ห่าง 20)
const rects = [];
for (let i = 0; i < 5; i++) rects.push({ left: (i % 3) * 120, top: Math.floor(i / 3) * 170, width: 100, height: 150 });
check('แทรก: ครึ่งซ้ายของใบแรก = 0', L.insertIndexAt(rects, 10, 50) === 0);
check('แทรก: ครึ่งขวาของใบแรก = 1', L.insertIndexAt(rects, 80, 50) === 1);
check('แทรก: ขวาสุดของแถวแรก = หลังใบที่ 3', L.insertIndexAt(rects, 400, 60) === 3);
check('แทรก: แถวสอง ครึ่งซ้ายของใบที่ 5 = 4', L.insertIndexAt(rects, 130, 230) === 4);
check('แทรก: เลยการ์ดใบสุดท้าย = ท้ายสุด', L.insertIndexAt(rects, 600, 230) === 5);
check('แทรก: เหนือแถวแรก = แถวแรก', L.insertIndexAt(rects, 10, -40) === 0);
check('แทรก: ไม่มีการ์ด = 0', L.insertIndexAt([], 1, 1) === 0);

const order = ['a', 'b', 'c', 'd'];
check('moveTarget: ปล่อยข้างตัวเอง = ไม่ขยับ', L.moveTarget(order, 'b', 1) === null && L.moveTarget(order, 'b', 2) === null);
check('moveTarget: ไปหน้าสุด', JSON.stringify(L.moveTarget(order, 'c', 0)) === '{"beforeId":"a"}');
check('moveTarget: ท้ายสุด = beforeId null', JSON.stringify(L.moveTarget(order, 'a', 4)) === '{"beforeId":null}');
check('stepTarget: ขึ้นหนึ่ง', JSON.stringify(L.stepTarget(order, 'c', -1)) === '{"beforeId":"b"}');
check('stepTarget: ลงหนึ่ง', JSON.stringify(L.stepTarget(order, 'a', 1)) === '{"beforeId":"c"}');
check('stepTarget: ลงเป็นใบสุดท้าย = ท้ายสุด', JSON.stringify(L.stepTarget(order, 'c', 1)) === '{"beforeId":null}');
check('stepTarget: ขอบ = null', L.stepTarget(order, 'a', -1) === null && L.stepTarget(order, 'd', 1) === null);
check('coverHue: คงที่ต่อชื่อ · 0..359', L.coverHue('เล่มหนึ่ง') === L.coverHue('เล่มหนึ่ง') && L.coverHue('x') >= 0 && L.coverHue('x') < 360);

console.log(`library-view: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
