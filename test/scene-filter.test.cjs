// test/scene-filter.test.cjs — ตัวกรอง Explorer (alpha.120 ข้อ 4)
//
// ★ บั๊กที่เทสชุดนี้ปักหมุดไว้: ชิปตัวกรองสถานะ/แท็กสร้างคิวรีเป็น `status:ก OR status:ข`
//   มาตั้งแต่ต้น แต่ตัวจับคู่ใช้ `every()` ล้วน ๆ → ติ๊กสองสถานะเมื่อไหร่ผลลัพธ์ว่างทุกครั้ง
//   (ทั้งคำว่า `OR` เองก็ถูกนับเป็นคำค้นอีกตัวหนึ่ง ซึ่งไม่มีทางเจอในฉากไหนเลย)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-scenefilter-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'sceneFilter.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const F = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const A = { title: 'ตลาดเก่า', fileName: 'scene-01.md', status: 'กำลังเขียน',
            tags: ['บู๊', 'กลางคืน'], pov: 'ท็อป', synopsis: 'ไล่ล่ากลางตลาด', flag: true };
const B = { title: 'บ้านริมน้ำ', fileName: 'scene-02.md', status: 'เขียนเสร็จ',
            tags: ['ดราม่า'], pov: 'มินา', note: 'ต้องแก้ตอนจบ' };
const C = { title: 'ห้องเรียน', fileName: 'scene-03.md', status: 'Outline', tags: [] };

// ── ค้นอิสระ (ของเดิมต้องไม่พัง) ──
check('ค้นชื่อฉากเจอ', F.sceneMatchesQuery(A, 'ตลาด'));
check('ค้นคำที่ไม่มี = ไม่เจอ', !F.sceneMatchesQuery(A, 'อวกาศ'));
check('คิวรีว่าง = เจอทุกฉาก', F.sceneMatchesQuery(A, '') && F.sceneMatchesQuery(C, '   '));
check('สองคำ = ต้องเจอทั้งคู่ (AND)', F.sceneMatchesQuery(A, 'ตลาด บู๊'));
check('สองคำที่เจอแค่ตัวเดียว = ไม่เจอ', !F.sceneMatchesQuery(A, 'ตลาด ดราม่า'));

// ── ค้นเจาะจงฟิลด์ ──
check('status: ตรงฉาก', F.sceneMatchesQuery(A, 'status:กำลังเขียน'));
check('status: ไม่ตรง', !F.sceneMatchesQuery(B, 'status:กำลังเขียน'));
check("สถานะ 'Outline' = ยังไม่ตั้ง จึงไม่ match ค่าอะไรเลย",
      !F.sceneMatchesQuery(C, 'status:outline'));
check('tag: ตรง', F.sceneMatchesQuery(A, 'tag:บู๊') && !F.sceneMatchesQuery(B, 'tag:บู๊'));
check('pov: ตรง', F.sceneMatchesQuery(B, 'pov:มินา'));
check('flag:1 = เฉพาะฉากที่ปักหมุด',
      F.sceneMatchesQuery(A, 'flag:1') && !F.sceneMatchesQuery(B, 'flag:1'));

// ── [ข้อ 3+4] ค้นด้วย "ชื่อไฟล์" ──
check('file: หาไฟล์เจอ', F.sceneMatchesQuery(A, 'file:scene-01'));
check('file: ไฟล์อื่นไม่เจอ', !F.sceneMatchesQuery(A, 'file:scene-02'));
check('ชื่อไฟล์ค้นแบบอิสระก็เจอ (ผู้ใช้เห็นชื่อไฟล์ตอน hover)',
      F.sceneMatchesQuery(B, 'scene-02'));

// ── [ข้อ 4] OR ── (นี่คือตัวบั๊กจริงของชิปตัวกรอง)
check('OR: ตรงกลุ่มซ้าย',
      F.sceneMatchesQuery(A, 'status:กำลังเขียน OR status:เขียนเสร็จ'));
check('OR: ตรงกลุ่มขวา',
      F.sceneMatchesQuery(B, 'status:กำลังเขียน OR status:เขียนเสร็จ'));
check('OR: ไม่ตรงทั้งสองกลุ่ม = ไม่เจอ',
      !F.sceneMatchesQuery(C, 'status:กำลังเขียน OR status:เขียนเสร็จ'));
check('OR: คำว่า OR ต้องไม่ถูกนับเป็นคำค้น',
      F.sceneMatchesQuery(A, 'tag:บู๊ OR tag:ดราม่า'));
check('OR: ใช้ | แทนได้', F.sceneMatchesQuery(B, 'tag:บู๊ | tag:ดราม่า'));
check('OR: กลุ่มหนึ่งมีสองเงื่อนไข = ต้องครบทั้งคู่',
      F.sceneMatchesQuery(A, 'tag:บู๊ pov:ท็อป OR tag:ดราม่า') &&
      !F.sceneMatchesQuery(A, 'tag:บู๊ pov:มินา OR tag:ดราม่า'));

// ── [ข้อ 4] ไม่เอา (-) ──
check('-คำ: ตัดฉากที่มีคำนั้นออก',
      !F.sceneMatchesQuery(A, '-ตลาด') && F.sceneMatchesQuery(B, '-ตลาด'));
check('-field:value ใช้ได้', !F.sceneMatchesQuery(A, '-tag:บู๊'));
check('ผสม AND กับไม่เอา', F.sceneMatchesQuery(A, 'ตลาด -ดราม่า'));

// ── parseGroups ──
check('parseGroups แยกสองกลุ่ม', F.parseGroups('a OR b').length === 2);
check('parseGroups กลุ่มเดียวเมื่อไม่มี OR', F.parseGroups('a b').length === 1);
check('parseGroups คิวรีว่าง = ไม่มีกลุ่ม', F.parseGroups('').length === 0);
check('parseGroups ธง neg ติดถูกตัว',
      F.parseGroups('-a b')[0][0].neg === true && F.parseGroups('-a b')[0][1].neg === false);
check('parseQuery เดิมยังใช้ได้ (คืนแบบแบน)', F.parseQuery('a OR b').length === 2);

// ── textMatchesQuery (แถวที่ไม่ใช่ฉาก: Wiki · รูป · โน้ต) ──
check('textMatchesQuery เจอคำ', F.textMatchesQuery('โทระ นักดาบ', 'นักดาบ'));
check('textMatchesQuery ไม่เจอ', !F.textMatchesQuery('โทระ นักดาบ', 'พ่อครัว'));
check('textMatchesQuery รองรับ OR',
      F.textMatchesQuery('โทระ นักดาบ', 'พ่อครัว OR นักดาบ'));
check('textMatchesQuery รองรับไม่เอา',
      !F.textMatchesQuery('โทระ นักดาบ', '-นักดาบ'));
check('textMatchesQuery คิวรีว่าง = ผ่านหมด', F.textMatchesQuery('อะไรก็ได้', ''));
check('textMatchesQuery ไม่สนตัวพิมพ์', F.textMatchesQuery('Tora The Blade', 'blade'));

console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (fail) process.exit(1);
