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
const X = build('prose-export-view');

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

// ═══════ [alpha.143] รูปในเอกสาร: เต็มหน้า = กินแผ่นทั้งแผ่น · เพดานหนึ่งหน้า ═══════
{
  const LH = 28;
  // ย่อหน้า 3 บรรทัด → รูปเต็มหน้า → ย่อหน้า 3 บรรทัด (ถ้าไม่มีกฎ ทั้งชุดจะยัดกันสองหน้า)
  const p1 = para(0, 3);
  const fig = { top: 3 * LH, height: CH, splitMinLines: 99,
                breakBefore: true, breakAfter: true, fullPage: true,
                el: { querySelector: () => ({ currentSrc: 'file:///x/sunset.png',
                                              getAttribute: () => 'sunset.png' }) } };
  const p2 = para(3 * LH + CH, 3);
  const pages = M.sliceProsePages([p1, fig, p2], CH, 3 * LH + CH + 3 * LH);
  check('[143-2] ★★ รูปเต็มหน้าได้แผ่นของตัวเอง (ขึ้นหน้าใหม่ทั้งก่อนและหลัง)',
        pages.length === 3
        && Math.abs(pages[1].start - fig.top) < 0.001
        && Math.abs(pages[2].start - (fig.top + CH)) < 0.001,
        JSON.stringify(pages.map((x) => +x.start.toFixed(1))));
  const map = M.fullPageImages([p1, fig, p2], pages.map((x, i) => ({ ...x, index: i + 1 })));
  check('[143-2] ★ ตัววาดรู้ว่าแผ่นที่ 2 คือรูปเต็มหน้า และเป็นรูปใบไหน',
        map.size === 1 && map.get(2) === 'file:///x/sunset.png', JSON.stringify([...map]));
  // รูปเต็มหน้าที่หัวเอกสารพอดี = ไม่ต้องแทรกแผ่นว่างนำหน้า
  const fig0 = { ...fig, top: 0 };
  const pg0 = M.sliceProsePages([fig0, para(CH, 3)], CH, CH + 3 * LH);
  check('[143-2] ★ รูปเต็มหน้าที่หัวเอกสารไม่สร้างแผ่นว่างนำหน้า',
        pg0.length === 2 && pg0[0].start === 0, JSON.stringify(pg0.map((x) => x.start)));
  check('[143-2] เอกสารที่ไม่มีรูปเต็มหน้า = ไม่มีแผ่นไหนถูกทาภาพ',
        M.fullPageImages([p1, p2], pages).size === 0);
}

// ── กฎคู่แฝดของ CSS ที่ส่งออก (กฎถาวรข้อ 5: จอ · ตัวอย่าง · ไฟล์ ต้องมาจากที่เดียวกัน) ──
{
  const css = P.proseExportCss(P.mergeProseFormat({}),
                               { width: 8.5, height: 11 },
                               { top: 1, bottom: 1, left: 1.5, right: 1 });
  const rule = (re) => (css.match(re) || [''])[0];
  // [alpha.143r ข้อ 4] เพดาน = หนึ่งหน้า **ลบระยะขอบของ `<figure>` (1em+1em)** — ไม่งั้นบล็อกรวม
  // สูงเกินหนึ่งหน้านิดเดียว แล้วตัวจัดหน้าต้องตัดดิบ = รูปถูกผ่ากลางคาบสองแผ่น
  check('[143-1] ★ เพดานรูปที่ตั้งความกว้างเอง = หนึ่งหน้า ลบระยะขอบของกรอบรูป',
        css.includes('figure.k-img-w img{max-height:calc(9in - 2.2em)}'),
        rule(/figure\.k-img-w[^}]*}/));
  check('[143-2] ★ กล่องของรูปเต็มหน้าสูงเท่าพื้นที่พิมพ์หนึ่งหน้าพอดี (6 / 9)',
        /figure\.k-img-page\{[^}]*aspect-ratio:6 \/ 9/.test(css),
        rule(/figure\.k-img-page\{[^}]*}/));
  check('[143-2] ★★ ตอนพิมพ์จริง แผ่นของรูปเต็มหน้าเป็นหน้าไร้ระยะขอบ (ภาพชนขอบกระดาษ)',
        css.includes('@page k-bleed{size:8.5in 11in;margin:0}')
        && /@media print\{figure\.k-img-page\{page:k-bleed;break-before:page;break-after:page/.test(css),
        rule(/@page k-bleed[^}]*}/));
  check('[143-2] ★ ช่องตัวอย่าง/หน้าจอไม่เอากฎของเครื่องพิมพ์ไปใช้ (scopeCss ทิ้ง @page/@media)',
        !X.scopeCss(css, '.k-xpv-doc').includes('k-bleed'));
}

// ══ [146-P2] ★★ ระยะเว้นท้ายย่อหน้าที่ล้นขอบหน้า — ทำไม "ที่ว่างท้ายหน้า" ต้องติดลบได้ ══
//
// เคสที่ทำให้ e2e `[131-P1]` แดงบนเครื่องผู้ใช้: หน้าจบด้วยย่อหน้าที่ **หมึกพอดีขอบล่าง
// แต่ระยะเว้นท้ายย่อหน้าล้นออกไป** · ตัวหั่นวัดการล้นจาก "หมึก" (spaceAfterPx ไม่กินความจุ)
// จึงไม่ยกย่อหน้านั้นไปหน้าใหม่ — **ถูกต้องแล้ว** เพราะบนกระดาษจริงระยะเว้นนั้นถูกกลืน
// ผลข้างเคียงคือช่วงหน้าที่คืนมายาวเกินพื้นที่พิมพ์เท่ากับส่วนที่ล้น
// → ตัวชดเชย (tuneProsePagePads) จึงต้องส่งค่า **ติดลบ** ให้กล่องเส้นคั่นหดกลืนส่วนเกิน
//   ไม่ใช่ปัดเป็น 0 แล้วปล่อยให้สายเนื้อหาเดินเกินแผ่นที่ปูตายตัว `k × (สูงกระดาษ + ช่องว่าง)`
//   จนความคลาด **สะสม** ทีละหน้า
// เทสนี้ล็อกพฤติกรรมของตัวหั่นไว้ ไม่ให้ใครไป "แก้" ด้วยการดันย่อหน้าไปหน้าใหม่แทน
{
  const blocks = [
    { top: 0,   height: 836, spaceAfterPx: 0, lineOffsets: [] },
    { top: 836, height: 32,  spaceAfterPx: 4, lineOffsets: [] },   // หมึกจบที่ 864 พอดี
    { top: 868, height: 400, spaceAfterPx: 4, lineOffsets: [] },
  ];
  const pg = M.sliceProsePages(blocks, CH, 1268);
  check('[146-P2] ★ ระยะเว้นท้ายย่อหน้าที่ล้นขอบ ไม่ดันย่อหน้านั้นไปหน้าใหม่',
        pg.length === 2 && pg[1].start === 868, JSON.stringify(pg));
  check('[146-P2] ★★ ช่วงหน้าจึงยาวเกินพื้นที่พิมพ์เท่ากับส่วนที่ล้นพอดี (= ค่าที่ต้องชดเชยติดลบ)',
        (pg[0].end - pg[0].start) - CH === 4, (pg[0].end - pg[0].start) + ' vs ' + CH);
  // คู่แฝด: ถ้า **หมึก** ล้นจริง ต้องยกไปหน้าใหม่ตามปกติ (กันแก้เกินจนเลิกตัดหน้า)
  const blocks2 = [
    { top: 0,   height: 836, spaceAfterPx: 0, lineOffsets: [] },
    { top: 836, height: 40,  spaceAfterPx: 4, lineOffsets: [] },   // หมึกจบที่ 872 = ล้นจริง
  ];
  const pg2 = M.sliceProsePages(blocks2, CH, 876);
  check('[146-P2] ★ หมึกที่ล้นจริงยังถูกยกไปหน้าใหม่เหมือนเดิม',
        pg2.length === 2 && pg2[1].start === 836, JSON.stringify(pg2));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
