// test/prose-measure.test.cjs — เอนจินหั่นหน้านิยายจากการวัดจริง (alpha.68)
// ทดสอบเฉพาะ "ส่วนบริสุทธิ์" — ป้อนกล่องที่วัดมาแล้วเข้าไปตรง ๆ ไม่ต้องมี DOM
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (name) => {
  const tmp = path.join(os.tmpdir(), 'k2-' + name + '.test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const M = build('prose-measure');
const P = build('prose-format');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// หน้ามาตรฐานที่ใช้ทั้งไฟล์: Letter ขอบบน/ล่าง 1" → พื้นที่พิมพ์ 9in = 864px
const CH = 864;
const LINE = 28;                                   // 12pt × 1.75
/** ย่อหน้าที่มี n บรรทัด เริ่มที่ y */
const para = (top, n, extra) => ({
  top, height: n * LINE, splitMinLines: 2,
  lineOffsets: Array.from({ length: n - 1 }, (_, i) => (i + 1) * LINE),
  ...extra,
});

// ───────── กรณีของ Top: ทั้งเอกสารต้องอยู่หน้าเดียว ─────────
{
  // 23 บรรทัดจริง (เท่าที่ Chromium วาดออกมา) ในหน้าที่จุ 30 บรรทัด
  const blocks = [para(0, 5), para(5 * LINE, 4), para(9 * LINE, 3), para(12 * LINE, 4),
                  para(16 * LINE, 1), para(17 * LINE, 1), para(18 * LINE, 1),
                  para(19 * LINE, 1), para(20 * LINE, 1), para(21 * LINE, 1),
                  para(22 * LINE, 2)];
  const pages = M.sliceProsePages(blocks, CH);
  check('[Top] 24 บรรทัดในหน้าที่จุ 30 → หน้าเดียว', pages.length === 1, pages.length);
}

// ───────── ตัดกลางย่อหน้าตามบรรทัด (แบบ Word/Google Docs) ─────────
{
  // ย่อหน้าเดียว 40 บรรทัด = 1120px > 864px
  const pages = M.sliceProsePages([para(0, 40)], CH);
  check('ย่อหน้ายาวถูกตัดกลาง ไม่ยกทั้งก้อน', pages.length === 2, JSON.stringify(pages));
  const cut = pages[1].start;
  check('จุดตัดตรงกับขอบบรรทัดพอดี', cut % LINE === 0, cut);
  check('จุดตัดเป็นบรรทัดสุดท้ายที่ยังพอดีหน้า', cut === 30 * LINE && cut <= CH, cut);
}

// ───────── กฎบรรทัดโดดเดี่ยว (widow/orphan) ─────────
{
  // ย่อหน้า 31 บรรทัดเริ่มที่ 0 → ถ้าตัดที่บรรทัด 31 จะเหลือท้ายบรรทัดเดียว
  const pages = M.sliceProsePages([para(0, 31)], CH);
  check('ไม่ทิ้งบรรทัดเดียวไว้หน้าถัดไป', pages[1].start <= 29 * LINE, pages[1].start);

  // ย่อหน้า 3 บรรทัดที่เริ่มเกือบท้ายหน้า → ต้องไม่เหลือหัวบรรทัดเดียว
  const near = [para(0, 29), para(29 * LINE, 3)];
  const pg2 = M.sliceProsePages(near, CH);
  check('ไม่ทิ้งบรรทัดเดียวไว้ท้ายหน้า', pg2[1].start === 29 * LINE, pg2[1].start);
}

// ───────── หัวข้อ: ห้ามฉีก และห้ามค้างท้ายหน้าเดี่ยว ๆ ─────────
{
  const heading = { top: 29 * LINE, height: 2 * LINE, splitMinLines: 99, keepNext: true };
  const blocks = [para(0, 29), heading, para(31 * LINE, 4)];
  const pages = M.sliceProsePages(blocks, CH);
  check('[keepNext] หัวข้อถูกลากไปหน้าใหม่พร้อมย่อหน้าถัดไป',
        pages.length === 2 && pages[1].start === 29 * LINE, JSON.stringify(pages));
}

// ───────── ระยะเว้นท้ายย่อหน้าไม่กินความจุหน้า (กฎ AbiWord) ─────────
{
  // เนื้อหาจบพอดี 864 แต่มีระยะเว้นท้าย 14px ต่อท้าย → ต้องไม่ขึ้นหน้าใหม่
  const b = { top: 0, height: CH + 14, spaceAfterPx: 14, lineOffsets: [], splitMinLines: 2 };
  check('ระยะเว้นท้ายย่อหน้าไม่ดันขึ้นหน้าใหม่', M.sliceProsePages([b], CH).length === 1);
}

// ───────── บล็อกที่ตัดไม่ได้ (รูป/เส้นคั่น) ─────────
{
  const img = { top: 10, height: 400, splitMinLines: 99, lineOffsets: [] };
  const pages = M.sliceProsePages([para(0, 1), { ...img, top: LINE }], CH);
  check('รูปที่ยังพอดีหน้า ไม่ถูกยก', pages.length === 1, pages.length);

  const tall = { top: 0, height: CH * 2.5, splitMinLines: 99, lineOffsets: [] };
  const pg = M.sliceProsePages([tall], CH);
  check('บล็อกสูงเกินหน้า ตัดดิบแล้วจบ ไม่วนไม่รู้จบ', pg.length === 3, pg.length);
}

// ───────── ขอบเขต/ค่าพัง ─────────
{
  check('ไม่มีบล็อก → หนึ่งหน้า', M.sliceProsePages([], CH).length === 1);
  check('บล็อกเป็น null ถูกข้าม', M.sliceProsePages([null, para(0, 2)], CH).length === 1);
  check('contentHeight เป็น 0 ก็ไม่ระเบิด', M.sliceProsePages([para(0, 2)], 0).length >= 1);
  const pages = M.sliceProsePages([para(0, 40)], CH, 40 * LINE);
  check('หน้าสุดท้ายจบที่ความสูงรวม', pages[pages.length - 1].end === 40 * LINE);
}

// ───────── lineCut ตรง ๆ ─────────
{
  const b = para(0, 10);
  check('lineCut คืน null เมื่อไม่มีขอบบรรทัด',
        M.lineCut({ top: 0, height: 100 }, 0, 50) === null);
  check('lineCut ไม่ตัดเลยขอบล่าง', M.lineCut(b, 0, 3 * LINE) <= 3 * LINE);
  check('lineCut เคารพ splitMinLines ฝั่งหัว',
        M.lineCut({ ...b, splitMinLines: 4 }, 0, 2 * LINE) === null);
}

// ───────── lineBreakOffsets: ทิ้งบรรทัดผีตัวแรก ─────────
{
  const offs = M.lineBreakOffsets([{ offset: 0.3 }, { offset: 28 }, { offset: 56 }]);
  check('ทิ้ง rect แรก (บรรทัดผี)', offs.length === 2 && offs[0] === 28, JSON.stringify(offs));
  check('ทิ้งค่าที่ชิด 0 ด้วย',
        M.lineBreakOffsets([{ offset: 0 }, { offset: 0.2 }, { offset: 28 }]).length === 1);
}

// ───────── ตัวประมาณสำรอง: ต้องรู้จักสระ/วรรณยุกต์ไทยแล้ว ─────────
{
  check('visualLength ตัดสระบน/ล่างและวรรณยุกต์ออก',
        P.visualLength('น้ำใสไหลเย็น') < 'น้ำใสไหลเย็น'.length);
  check('visualLength ไม่แตะอักษรละติน', P.visualLength('hello') === 5);
  const thai = 'เนื้อเรื่องคือ น้องสาวจากเชียงใหม่ได้ตามหาพี่ชายที่กรุงเทพ ' +
               'ที่หายตัวไปตั้งแต่เหตุการณ์ในครั้งนั้น เพื่อนำข่าวให้พี่ชายรับรู้ว่า พ่อเสียชีวิต';
  check('ข้อความไทยจริงมีอักขระกว้างศูนย์ราวหนึ่งในห้าขึ้นไป',
        (thai.length - P.visualLength(thai)) / thai.length > 0.15,
        ((thai.length - P.visualLength(thai)) / thai.length).toFixed(3));
  // เดิมนับ 371 ตัวอักษร/78 คอลัมน์ = 6 บรรทัด · ของจริง 4 → ต้องเข้าใกล้ของจริงขึ้น
  const long = thai + thai;
  check('proseWrap ประมาณน้อยลงหลังตัดอักขระกว้างศูนย์',
        P.proseWrap(long, 78) <= Math.ceil(long.length / 78), P.proseWrap(long, 78));
}


// ══ [alpha.103r ข้อ 2] ★★ บล็อกที่สูงเกินหนึ่งหน้าต้องถูกหั่น "ตามบรรทัดจริง" ══
// ผู้ใช้: *"block ที่ไม่ใช่ข้อความปกติ ไม่ตัดหน้าให้เลย"* — หัวข้อยาว ๆ ไหลทะลุขอบกระดาษ
// ต้นตอ: blockRules() ให้หัวข้อ splitMinLines:99 (ห้ามฉีก) → lineCut() คืน null ตลอด
// → ตกไปเส้นทาง "ตัดดิบที่ขอบหน้า" ซึ่งได้พิกัดที่ไม่ตรงกับบรรทัดไหนเลย
// → prosePosAtCut() แปลงกลับไม่ได้ แล้วเส้นคั่นถูกทิ้งเงียบ ๆ (จอไม่มีรอยตัดให้เห็น)
{
  const LH = 24;
  const nLines = 100;                        // 100 บรรทัด = สูงกว่าหนึ่งหน้า (36 บรรทัด)
  const offs = Array.from({ length: nLines - 1 }, (_, i) => (i + 1) * LH);
  const head = { top: 0, height: nLines * LH, lineOffsets: offs, splitMinLines: 99, keepNext: true };
  const pages = M.sliceProsePages([head], CH, nLines * LH);
  check('[103r-2] ★★ หัวข้อยาวเกินหน้า → ถูกหั่นเป็นหลายหน้า', pages.length >= 3, pages.length);
  const onGrid = pages.slice(1).every((p) => Math.abs(p.start % LH) < 0.001);
  check('[103r-2] ★★ จุดตัดทุกจุดตกที่ "ขอบบรรทัดจริง" (แปลงกลับเป็นตำแหน่งในเอกสารได้)',
        onGrid, JSON.stringify(pages.map((p) => p.start)));
  const over = pages.filter((p) => p.end - p.start > CH + 0.001);
  check('[103r-2] ★ ไม่มีหน้าไหนสูงเกินพื้นที่พิมพ์', over.length === 0,
        JSON.stringify(pages.map((p) => +(p.end - p.start).toFixed(1))));
  // ★ หัวข้อสั้น (ไม่เกินหนึ่งหน้า) ต้องยังยกไปทั้งก้อนเหมือนเดิม — กฎ "ห้ามฉีกหัวข้อ" ยังอยู่
  const body = { top: 0, height: CH - 60, lineOffsets: [24, 48], splitMinLines: 2 };
  const h2 = { top: CH - 60, height: 3 * LH, lineOffsets: [LH, 2 * LH], splitMinLines: 99 };
  const p2 = M.sliceProsePages([body, h2], CH, CH - 60 + 3 * LH);
  check('[103r-2] ★★ หัวข้อสั้นที่คร่อมขอบหน้า ยังถูกยกไปทั้งก้อน (ไม่ฉีก)',
        p2.length === 2 && Math.abs(p2[1].start - h2.top) < 0.001,
        JSON.stringify(p2.map((p) => p.start)));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
