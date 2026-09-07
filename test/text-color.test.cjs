// test/text-color.test.cjs — unit test "สีตัวอักษร" (alpha.132 ข้อ 9)
//
// สัญญาที่ผูกไว้ถาวร:
//   · ค่าสีที่กรองไม่ผ่าน **ไม่กลายเป็นสี** (คืน '') — ไม่ใช่เดาให้ ไม่ใช่ปล่อยสตริงดิบผ่าน
//     เพราะปลายทางคือ `style="color:…"` และไฟล์ .md ที่ผู้ใช้แก้นอกโปรแกรมได้
//   · `.md` ไป-กลับได้ตรงเป๊ะ ทั้งเดี่ยว ๆ และซ้อนกับตัวหนา/เอียง
//   · "ใช้ล่าสุด" ไม่มีวันซ้ำ และตัวที่เพิ่งใช้อยู่หัวรายการเสมอ
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-textcolor-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'text-color.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const C = require(tmp);
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── ตัวกรองค่าสี ─────────
check('รับ #rrggbb', C.normColor('#B03030') === '#b03030', C.normColor('#B03030'));
check('ย่อ #rgb ให้เป็น #rrggbb', C.normColor('#abc') === '#aabbcc', C.normColor('#abc'));
check('รับ rgb() ที่วางมาจากโปรแกรมอื่น',
      C.normColor('rgb(17, 34, 51)') === '#112233', C.normColor('rgb(17, 34, 51)'));
check('รับ rgba() แล้วทิ้งค่าอัลฟา',
      C.normColor('rgba(255,0,0,0.5)') === '#ff0000', C.normColor('rgba(255,0,0,0.5)'));
check('ค่าเกิน 255 ไม่ผ่าน', C.normColor('rgb(300,0,0)') === '');
check('★ ชื่อสีอังกฤษไม่ผ่าน (ตรวจ 148 คำไม่ครบ = เปิดช่องให้สตริงอื่นหลุด)',
      C.normColor('red') === '', C.normColor('red'));
check('★★ สตริงที่พยายามหนีออกจากแอตทริบิวต์ไม่ผ่าน',
      C.normColor('red"><script>') === '' && C.normColor('#fff;background:url(x)') === '');
check('ค่าว่าง/undefined/null คืนค่าว่าง',
      C.normColor('') === '' && C.normColor(undefined) === '' && C.normColor(null) === '');

// ───────── จานสีสำเร็จ ─────────
check('มีสีสำเร็จอย่างน้อย 8 สี', C.COLOR_PRESETS.length >= 8, C.COLOR_PRESETS.length);
check('สีสำเร็จทุกตัวผ่านตัวกรองของตัวเอง',
      C.COLOR_PRESETS.every((p) => C.normColor(p.hex) === p.hex),
      C.COLOR_PRESETS.map((p) => p.hex).join(','));
check('สีสำเร็จไม่ซ้ำกัน',
      new Set(C.COLOR_PRESETS.map((p) => p.hex)).size === C.COLOR_PRESETS.length);
check('สีสำเร็จทุกตัวมีคีย์ป้ายชื่อ',
      C.COLOR_PRESETS.every((p) => C.presetLabelKey(p.hex) === p.key));
check('สีที่ไม่อยู่ในจาน คืนคีย์ว่าง (ผู้เรียกใช้รหัสสีแทน)', C.presetLabelKey('#123456') === '');

// ───────── รายการที่บันทึก / ใช้ล่าสุด ─────────
check('ใช้ล่าสุด: ตัวใหม่ขึ้นหัว',
      C.pushRecent(['#111111'], '#b03030')[0] === '#b03030');
check('★ ใช้ล่าสุด: ใช้สีเดิมซ้ำ = เลื่อนขึ้นหัว ไม่ใช่เพิ่มแถวซ้ำ',
      JSON.stringify(C.pushRecent(['#111111', '#b03030'], '#b03030'))
        === JSON.stringify(['#b03030', '#111111']),
      JSON.stringify(C.pushRecent(['#111111', '#b03030'], '#b03030')));
check('ใช้ล่าสุด: ไม่เกินขีดจำกัด',
      C.pushRecent(Array.from({ length: 30 }, (_, i) => '#0000' + String(i % 10) + '0'), '#b03030')
        .length <= C.RECENT_MAX);
check('ใช้ล่าสุด: ค่าที่กรองไม่ผ่านไม่ถูกเพิ่ม',
      C.pushRecent(['#111111'], 'red').join() === '#111111');
check('บันทึกสี: ยังไม่มี = เพิ่มท้าย',
      C.toggleSaved(['#111111'], '#b03030').join() === '#111111,#b03030');
check('บันทึกสี: มีแล้ว = เอาออก (เป็นสวิตช์จริง)',
      C.toggleSaved(['#111111', '#b03030'], '#b03030').join() === '#111111');
check('normalizeColorStore: ค่าขยะถูกโยนทิ้ง ไม่ทำให้ป๊อปอัปพัง',
      JSON.stringify(C.normalizeColorStore({ saved: ['#b03030', 'red', 7, null], recent: 'x' }))
        === JSON.stringify({ saved: ['#b03030'], recent: [] }));
check('normalizeColorStore: ไม่ส่งอะไรมาเลยก็ยังได้รูปที่ใช้ได้',
      JSON.stringify(C.normalizeColorStore(undefined))
        === JSON.stringify({ saved: [], recent: [] }));

// ───────── ไป-กลับกับไฟล์ .md ─────────
const trip = (md) => MD.docToMd(MD.mdToDoc(md));
check('★★ md ไป-กลับ: สีเดี่ยว ๆ',
      trip('ก <span style="color:#b03030">แดง</span> ข')
        === 'ก <span style="color:#b03030">แดง</span> ข',
      trip('ก <span style="color:#b03030">แดง</span> ข'));
check('★★ md ไป-กลับ: สีซ้อนตัวหนา',
      trip('<span style="color:#2b7bb9">**หนาน้ำเงิน**</span>')
        === '<span style="color:#2b7bb9">**หนาน้ำเงิน**</span>',
      trip('<span style="color:#2b7bb9">**หนาน้ำเงิน**</span>'));
{
  const doc = MD.mdToDoc('<span style="color:#b03030">แดง</span>');
  const marks = doc.content[0].content[0].marks || [];
  check('สีกลายเป็นมาร์ก color ที่มีค่าจริง',
        marks.some((m) => m.type === 'color' && m.attrs.color === '#b03030'),
        JSON.stringify(marks));
}
check('★ สแปนที่ค่าสีไม่ผ่านตัวกรอง = ข้อความธรรมดา (ไม่มีข้อมูลหาย)',
      trip('x <span style="color:red">y</span> z') === 'x <span style="color:red">y</span> z',
      trip('x <span style="color:red">y</span> z'));
check('เอกสารที่ไม่มีสีเลย เขียนกลับเหมือนเดิมทุกตัวอักษร',
      trip('**หนา** *เอียง* ~~ฆ่า~~ ธรรมดา') === '**หนา** *เอียง* ~~ฆ่า~~ ธรรมดา',
      trip('**หนา** *เอียง* ~~ฆ่า~~ ธรรมดา'));
{
  // สีสองช่วงติดกันคนละสี ต้องได้สองสแปน ไม่ใช่สแปนเดียวคร่อม
  const md = '<span style="color:#b03030">แดง</span><span style="color:#2f7d4f">เขียว</span>';
  check('★ สองสีติดกันไม่รวมร่างกัน', trip(md) === md, trip(md));
}
check('colorSpanMd: ค่าสีไม่ผ่าน = คืนเนื้อในเปล่า ๆ ไม่ห่อสแปน',
      C.colorSpanMd('red', 'ก') === 'ก' && C.colorSpanMd('#abc', 'ก')
        === '<span style="color:#aabbcc">ก</span>');

console.log('\ntext-color: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
