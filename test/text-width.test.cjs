// test/text-width.test.cjs — [alpha.126] `src/text-width.js` (วัดความกว้าง + ตัดบรรทัด)
//
// ไฟล์นี้เป็นตรรกะหนาแน่นที่สุดชิ้นหนึ่งของโปรเจกต์ (แยกโทเคนไทย/ละติน · อักขระซ้อนกว้าง 0 ·
// จุดตัดคำจาก ICU · ค้นหน้าต่างแบบทวีคูณก่อน binary search) และเป็นตัวตัดสิน
// **จำนวนบรรทัด → จำนวนหน้า** ของบทภาพยนตร์ทั้งระบบ — แต่มีเทสทางอ้อมผ่าน sp-format เท่านั้น
//
// ตัววัดจริงต้องมี DOM → ที่นี่ **ฉีดตัววัดปลอมแบบกำหนดผลได้** ผ่าน `setMeasurer()`
// (ทางที่โมดูลออกแบบมาให้ทำอยู่แล้ว) จึงทดสอบเส้นทางเดียวกับของจริงได้บน node
require('./_lang.cjs');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_textwidth.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/text-width.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const T = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

// ───────── visualLength: อักขระซ้อนของไทยกว้าง 0 ─────────
{
  ck('อังกฤษนับตามจำนวนตัวอักษร', T.visualLength('hello') === 5);
  // "กิน" = ก + สระอิ(ซ้อน) + น → มองเห็นเป็น 2 ช่อง
  ck('★ สระซ้อนของไทยไม่กินความกว้าง', T.visualLength('กิน') === 2, T.visualLength('กิน'));
  ck('★ วรรณยุกต์ก็ไม่กินความกว้าง', T.visualLength('ก้') === 1, T.visualLength('ก้'));
  ck('สระบน+วรรณยุกต์ซ้อนกันสองชั้น', T.visualLength('กี่') === 1, T.visualLength('กี่'));
  ck('สระหน้า (เ แ โ ใ ไ) กินความกว้างจริง', T.visualLength('เก') === 2, T.visualLength('เก'));
  ck('null/undefined ไม่พัง', T.visualLength(null) === 0 && T.visualLength(undefined) === 0);
  ck('สตริงว่าง = 0', T.visualLength('') === 0);
}

// ───────── tokenize: ไทยตัดตรงไหนก็ได้ · ละตินห้ามตัดกลาง ─────────
{
  const toks = T.tokenize('hello โลก');
  // รูปโทเคน: { t: ชนิด, s: ข้อความ, i: ดัชนีเริ่ม }
  ck('แยกเป็น 3 โทเคน (คำ · ช่องว่าง · คำไทย)', toks.length === 3, JSON.stringify(toks.map((x) => x.t)));
  ck('★ ละติน = atom (ห้ามตัดกลางคำ)', toks[0].t === T.TOK_ATOM, toks[0].t);
  ck('ช่องว่าง = space', toks[1].t === T.TOK_SPACE);
  ck('★ ไทย = run (ตัดตรงไหนก็ได้)', toks[2].t === T.TOK_RUN, toks[2].t);
  ck('ตัวเลขเป็น atom เหมือนละติน', T.tokenize('1234')[0].t === T.TOK_ATOM);
  ck('สตริงว่างได้อาร์เรย์ว่าง', T.tokenize('').length === 0);
  ck('★ อักขระซ้อนเกาะไปกับตัวก่อนหน้า ไม่แตกเป็นโทเคนใหม่',
     T.tokenize('กิน').length === 1, JSON.stringify(T.tokenize('กิน')));
  ck('★ ทุกโทเคนต่อกันแล้วได้ข้อความเดิมเป๊ะ (ไม่มีตัวอักษรหาย/เกิน)', (() => {
    const s = 'สวัสดี hello 123 โลก';
    return T.tokenize(s).map((x) => x.s).join('') === s;
  })(), JSON.stringify(T.tokenize('สวัสดี hello 123 โลก').map((x) => x.s)));
}

// ───────── measureWidth: ตัววัดจริง vs สูตรสำรอง ─────────
{
  T.setMeasurer(null);
  ck('ไม่มีตัววัด = ไม่ได้ติดตั้งอยู่', T.hasMeasurer() === false);
  const w = T.measureWidth('hello', { cpi: 10 });
  ck('★ ไม่มีตัววัด → ตกไปใช้สูตร (5 ตัว ÷ 10 cpi × 96 dpi = 48px)', w === 48, w);
  ck('สตริงว่าง = 0 เสมอ', T.measureWidth('') === 0);

  let calls = 0;
  T.setMeasurer((s) => { calls++; return s.length * 7; });
  ck('ติดตั้งตัววัดแล้วรู้ตัว', T.hasMeasurer() === true);
  ck('★ มีตัววัดจริง → ใช้ค่าจากตัววัด', T.measureWidth('abcd') === 28, T.measureWidth('abcd'));
  ck('ตัววัดถูกเรียกจริง', calls > 0);
  // 4 ตัว ÷ 10 cpi × 96 dpi = 38.4 (ทศนิยมลอยตัว → เทียบแบบมีค่าคลาดเคลื่อนที่ยอมได้)
  ck('★ บังคับ heuristic = ไม่แตะตัววัดจริงเลย',
     Math.abs(T.measureWidth('abcd', { heuristic: true, cpi: 10 }) - 38.4) < 1e-9,
     T.measureWidth('abcd', { heuristic: true, cpi: 10 }));

  // ตัววัดที่คืนค่าเพี้ยนต้องไม่ทำให้ทั้งระบบพัง — ต้องตกกลับไปสูตร
  T.setMeasurer(() => NaN);
  ck('★ ตัววัดคืน NaN → ตกกลับไปใช้สูตร ไม่ใช่ปล่อย NaN ทะลุไปคำนวณหน้า',
     T.measureWidth('abcde', { cpi: 10 }) === 48, T.measureWidth('abcde', { cpi: 10 }));
  T.setMeasurer(() => -5);
  ck('ตัววัดคืนค่าติดลบ → ตกกลับไปใช้สูตร', T.measureWidth('abcde', { cpi: 10 }) === 48);
  T.setMeasurer(null);
}

// ───────── รุ่นของการวัด: ฟอนต์เปลี่ยน = ของที่จำไว้ใช้ไม่ได้ ─────────
{
  const before = T.measureEpoch();
  T.bumpMeasureEpoch();
  ck('★ ล้างแคชแล้วรุ่นเดินหน้า (ผลเก่าต้องไม่ถูกใช้ซ้ำ)', T.measureEpoch() === before + 1);
  const mid = T.measureEpoch();
  T.setMeasurer(() => 10);
  ck('★ ติดตั้งตัววัดใหม่ = ล้างแคชให้เองด้วย', T.measureEpoch() > mid);
  T.setMeasurer(null);
}

// ───────── wrapVisual / wrapText: นับบรรทัด ─────────
{
  ck('ข้อความว่าง = 1 บรรทัด (บรรทัดว่างก็กินที่)', T.wrapVisual('', 40) === 1);
  ck('ช่องว่างล้วน = 1 บรรทัด', T.wrapVisual('   ', 40) === 1);
  ck('สั้นกว่าความกว้าง = 1 บรรทัด', T.wrapVisual('สั้น', 40) === 1);
  const n = T.wrapVisual('ก'.repeat(100), 20);
  ck('★ ยาว 100 ช่อง กว้าง 20 → ประมาณ 5 บรรทัด', n >= 5 && n <= 6, n);
  ck('★ กว้างขึ้น = บรรทัดน้อยลง (ไม่ใช่เท่าเดิม)',
     T.wrapVisual('ก'.repeat(100), 50) < T.wrapVisual('ก'.repeat(100), 20));
  ck('เยื้องเข้ามาแล้วบรรทัดต้องไม่น้อยลง',
     T.wrapVisual('ก'.repeat(100), 40, 10) >= T.wrapVisual('ก'.repeat(100), 40));
  ck('cols เป็น 0/ติดลบไม่ทำให้วนไม่จบ', T.wrapVisual('ก'.repeat(30), 0) >= 1);
  ck('★ ละตินยาวคำเดียวต้องตัดได้ (ไม่ค้างเป็นบรรทัดเดียวยาวเกินหน้า)',
     T.wrapVisual('a'.repeat(200), 20) > 5, T.wrapVisual('a'.repeat(200), 20));
}

// ───────── wrapCuts: ตำแหน่งตัดต้องเรียงและอยู่ในช่วง ─────────
{
  const s = 'ก'.repeat(90);
  const cuts = T.wrapCuts(s, 2, { heuristic: true, cpi: 10 });
  ck('คืนอาร์เรย์ตำแหน่งตัด', Array.isArray(cuts));
  ck('★ ตำแหน่งตัดเรียงจากน้อยไปมาก', cuts.every((v, i) => i === 0 || v > cuts[i - 1]), JSON.stringify(cuts));
  ck('★ ทุกตำแหน่งอยู่ในช่วงของข้อความ', cuts.every((v) => v > 0 && v < s.length), JSON.stringify(cuts));
  ck('จำนวนบรรทัด = จำนวนจุดตัด + 1',
     T.wrapText(s, 2, { heuristic: true, cpi: 10 }) === cuts.length + 1);
  const strs = T.wrapLineStrings(s, 2, { heuristic: true, cpi: 10 });
  ck('★ ต่อบรรทัดกลับมาแล้วได้ข้อความเดิม (ไม่มีตัวอักษรหาย)',
     strs.join('') === s, strs.length + ' บรรทัด · ยาวรวม ' + strs.join('').length);
}

console.log(`\ntext-width: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
