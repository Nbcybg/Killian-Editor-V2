// test/prose-format.test.cjs — unit test รูปแบบนิยาย (alpha.58r · บั๊ก 16–24)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-prose-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'prose-format.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const P = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── ค่าตั้งต้น (บั๊ก 16/17/18/21) ─────────
const D = P.mergeProseFormat(null);
check('[21] merge จาก null ได้ค่าครบ', !!D && !!D.headings && !!D.quote);
check('[16] มีย่อหน้าบรรทัดแรกเป็นค่าเริ่มต้น', D.firstLineIndent > 0, String(D.firstLineIndent));
check('[17] ช่วงบรรทัดปรับได้และมีค่าเริ่มต้น', D.lineHeight > 1 && D.lineHeight <= 2, String(D.lineHeight));
check('[17] ระยะย่อหน้าเริ่มต้น = 0 (นิยายใช้ย่อหน้าแทนเว้นบรรทัด)', D.paraSpacing === 0);
check('[18] ฟอนต์เริ่มต้นนิยายไม่ใช่ Courier',
  !/Courier/i.test(P.DEFAULT_PROSE_FONT), P.DEFAULT_PROSE_FONT);
check('[18] ฟอนต์เริ่มต้นมีฟอนต์ไทย', /Sarabun|Thai/i.test(P.DEFAULT_PROSE_FONT));
check('[18] proseFontStack ว่าง → ใช้ค่ามาตรฐาน', P.proseFontStack(D) === P.DEFAULT_PROSE_FONT);
check('[18] ตั้งฟอนต์เองแล้วใช้ของเรา',
  P.proseFontStack(P.mergeProseFormat({ fontFamily: 'Georgia, serif' })) === 'Georgia, serif');
check('[23] มีหัวข้อ 6 ระดับ', D.headings.length === 6);
check('[23] h1 ใหญ่กว่า h6', D.headings[0].size > D.headings[5].size);
check('[24] blockquote มีค่าตั้งครบ',
  typeof D.quote.italic === 'boolean' && typeof D.quote.border === 'boolean');

// หนีบค่าผิด ๆ
check('หนีบขนาดฟอนต์ที่เล็กเกิน', P.mergeProseFormat({ fontPt: 1 }).fontPt === 6);
check('ค่าที่กรอกไม่ใช่ตัวเลข → ค่าเริ่มต้น', P.mergeProseFormat({ fontPt: 'abc' }).fontPt === 12);
check('หนีบขนาดฟอนต์ที่ใหญ่เกิน', P.mergeProseFormat({ fontPt: 999 }).fontPt === 48);
check('หนีบช่วงบรรทัดที่ผิด', P.mergeProseFormat({ lineHeight: 'abc' }).lineHeight === D.lineHeight);
check('หนีบย่อหน้าติดลบ', P.mergeProseFormat({ firstLineIndent: -5 }).firstLineIndent === 0);
check('align ที่ไม่รู้จัก → left', P.mergeProseFormat({ align: 'xxx' }).align === 'left');
check('align justify ผ่าน', P.mergeProseFormat({ align: 'justify' }).align === 'justify');
check('merge ไม่แก้ของเดิม', P.PROSE_DEFAULTS.fontPt === 12);
check('headings ที่ผู้ใช้ตั้งบางช่องยัง merge กับค่าเริ่มต้น',
  P.mergeProseFormat({ headings: [{ size: 3 }] }).headings[0].bold === true);

// ───────── ตัวแปร CSS ─────────
const V = P.proseCssVars(D);
check('[16] มี --ed-indent', V['--ed-indent'] === D.firstLineIndent + 'in', V['--ed-indent']);
check('[17] มี --ed-lh', V['--ed-lh'] === String(D.lineHeight));
check('[17] มี --ed-para', V['--ed-para'] === D.paraSpacing + 'em');
check('มี --ed-line-h เป็น px', /px$/.test(V['--ed-line-h']));

// ───────── CSS ที่สร้าง ─────────
const css = P.proseCss(D, '.X');
check('[16] CSS มี text-indent ของย่อหน้า', /\.X p\{[^}]*text-indent:0\.5in/.test(css), css.slice(0, 200));
check('[16] ย่อหน้าแรกหลังหัวข้อไม่ย่อ', css.includes('h1+p') && /text-indent:0\}/.test(css));
check('[17] CSS มี line-height', /\.X\{[^}]*line-height:1\.75/.test(css));
check('[23] CSS มี h1..h6', ['1', '2', '3', '4', '5', '6'].every((n) => css.includes('.X h' + n + '{')));
check('[24] CSS มี blockquote', css.includes('.X blockquote{'));
const cssQ = P.proseCss(P.mergeProseFormat({ quote: { border: false, italic: false } }), '.X');
check('[24] ปิดเส้นขอบ → border-left:0', cssQ.includes('border-left:0'));
check('[24] ปิดเอียง → font-style:normal', cssQ.includes('font-style:normal'));
const cssN = P.proseCss(P.mergeProseFormat({ headingNumber: true, headingNumberFormat: 'ตอนที่ {n}' }), '.X');
check('[23] เปิดเลขบท → มี counter', cssN.includes('counter-increment:k-chap') && cssN.includes('ตอนที่'));
check('[23] ปิดเลขบท → ไม่มี counter', !css.includes('counter-increment:k-chap'));
check('[23] headingNumberText แทน {n}',
  P.headingNumberText(P.mergeProseFormat({ headingNumberFormat: 'บทที่ {n}' }), 7) === 'บทที่ 7');

// ───────── [19] CSS ตอนส่งออก (WYSIWYG) ─────────
const ex = P.proseExportCss(D);
check('[19] ส่งออกใช้ฟอนต์เดียวกับบนจอ', ex.includes(P.DEFAULT_PROSE_FONT));
check('[19] ส่งออกใช้ขนาดเป็น pt ตามที่ตั้ง', ex.includes('font-size:12pt'));
check('[19] ส่งออกใช้ช่วงบรรทัดเดียวกัน', ex.includes('line-height:1.75'));
check('[19] ส่งออกมีย่อหน้าบรรทัดแรก', ex.includes('text-indent:0.5in'));
check('[19] ส่งออกมี @page ตามขนาดกระดาษ', ex.includes('@page{size:8.5in 11in'));
check('[19] ไม่มี Sarabun 18px แบบเดิมฝังตายแล้ว', !ex.includes('font-size:18px'));
const ex2 = P.proseExportCss(P.mergeProseFormat({ fontPt: 20, lineHeight: 2.2, firstLineIndent: 0 }));
check('[19] เปลี่ยนค่าแล้ว CSS ส่งออกเปลี่ยนตาม',
  ex2.includes('font-size:20pt') && ex2.includes('line-height:2.2') && ex2.includes('text-indent:0in'));

// ───────── [20] การจัดหน้า ─────────
const LETTER = { width: 8.5, height: 11 };
const MG = { top: 1, bottom: 1, left: 1.5, right: 1 };
const lpp = P.proseLinesPerPage(D, LETTER, MG);
check('[20] บรรทัด/หน้ามีค่าสมเหตุผล', lpp > 10 && lpp < 80, String(lpp));
check('[20] ช่วงบรรทัดมากขึ้น → บรรทัด/หน้าน้อยลง',
  P.proseLinesPerPage(P.mergeProseFormat({ lineHeight: 3 }), LETTER, MG) < lpp);
check('[20] ฟอนต์ใหญ่ขึ้น → บรรทัด/หน้าน้อยลง',
  P.proseLinesPerPage(P.mergeProseFormat({ fontPt: 24 }), LETTER, MG) < lpp);
const cpl = P.proseCharsPerLine(D, LETTER, MG);
check('[20] ตัวอักษร/บรรทัดสมเหตุผล', cpl > 40 && cpl < 200, String(cpl));
const M = P.proseMetrics(D, LETTER, MG);
check('[20] proseMetrics: กระดาษ 816×1056px', M.pageWidthPx === 816 && M.pageHeightPx === 1056);
check('[20] proseMetrics: เนื้อหน้า 864px', M.bodyHeightPx === 864);
check('[20] proseMetrics: lineHeightPx = fontPx × lineHeight',
  Math.abs(M.lineHeightPx - M.fontPx * D.lineHeight) < 0.01);

check('proseWrap: ข้อความว่าง = 1 บรรทัด', P.proseWrap('', 60) === 1);
check('proseWrap: สั้น = 1 บรรทัด', P.proseWrap('สวัสดี', 60) === 1);
check('proseWrap: ยาวเกิน → หลายบรรทัด', P.proseWrap('word '.repeat(60), 40) > 5);
check('proseWrap: ย่อหน้ากินที่ของบรรทัดแรก',
  P.proseWrap('aaaa bbbb cccc', 12, 8) >= P.proseWrap('aaaa bbbb cccc', 12, 0));

const blocks = [];
for (let i = 0; i < 200; i++) blocks.push({ type: 'p', text: 'ประโยคทดสอบยาวพอประมาณสำหรับการจัดหน้า ' + i, pos: i * 10 });
const pg = P.paginateProse(blocks, { fmt: D, paper: LETTER, margins: MG });
check('[20] จัดหน้าได้มากกว่า 1 หน้า', pg.count > 1, String(pg.count));
check('[20] ทุกบล็อกยังอยู่ครบ',
  pg.pages.reduce((n, p) => n + p.blocks.length, 0) === blocks.length);
check('[20] หน้าแรกมี index 1', pg.pages[0].index === 1);
check('[20] prosePageCount ตรงกับ paginate',
  P.prosePageCount(blocks, { fmt: D, paper: LETTER, margins: MG }) === pg.count);
check('[20] ไม่มีบล็อก → ยังได้ 1 หน้า', P.paginateProse([], { fmt: D }).count === 1);
check('[20] ช่วงบรรทัดคู่ → หน้าเยอะขึ้น',
  P.paginateProse(blocks, { fmt: P.mergeProseFormat({ lineHeight: 3 }), paper: LETTER, margins: MG }).count > pg.count);

const starts = P.prosePageStarts(pg);
check('[20] ตำแหน่งเริ่มหน้า = จำนวนหน้า', starts.length === pg.count);
check('[20] findProsePageStart หน้า 1 = 0', P.findProsePageStart(pg, 1) === 0);
check('[20] findProsePageStart หน้า 2 ตรงกับ starts[1]', P.findProsePageStart(pg, 2) === starts[1]);
check('[20] หน้าที่ไม่มี → null', P.findProsePageStart(pg, 9999) === null);

check('[20] proseBlockLines: hr กินน้อย', P.proseBlockLines({ type: 'hr' }, D, 60) === 2);
check('[20] proseBlockLines: หัวข้อกินมากกว่าย่อหน้าเปล่า',
  P.proseBlockLines({ type: 'h1', text: 'บทที่ 1' }, D, 60) >
  P.proseBlockLines({ type: 'p', text: 'บทที่ 1' }, D, 60));

// ───────── หัวข้อ / ไปที่บท ─────────
const hb = [{ type: 'h1', text: 'บทที่หนึ่ง', pos: 0, level: 1 },
            { type: 'p', text: 'เนื้อ', pos: 5 },
            { type: 'h2', text: 'ตอนย่อย', pos: 20, level: 2 },
            { type: 'h1', text: 'บทที่สอง', pos: 40, level: 1 }];
check('proseHeadings: เจอครบทุกระดับ', P.proseHeadings(hb).length === 3);
check('proseHeadings: กรองระดับได้', P.proseHeadings(hb, 1).length === 2);
check('proseHeadings: เลขไล่จาก 1', P.proseHeadings(hb)[0].n === 1);
check('proseHeadings: มี pos จริง', P.proseHeadings(hb)[2].pos === 40);
check('proseHeadings: doc ว่างไม่พัง', P.proseHeadings(null).length === 0);

// ───────── [20] เลขหน้า ─────────
check('เลขหน้าปิดไว้ → ว่าง', P.prosePageLabel(2, D) === '');
const PN = P.mergeProseFormat({ pageNumbers: true });
// [alpha.97 ข้อ 11] ไม่มีสวิตช์ "ใส่เลขบนหน้าแรก" อีกแล้ว — หน้าเนื้อเรื่องมีเลขทุกหน้า
check('เปิดเลขหน้า: หน้าแรกมีเลข "1" ทันที', P.prosePageLabel(1, PN) === '1');
check('เปิดเลขหน้า: หน้า 2 = "2"', P.prosePageLabel(2, PN) === '2');
check('เลขเริ่มต้นรายไฟล์', P.prosePageLabel(2, PN, 10) === '11');
check('ไฟล์ที่เริ่มหน้า 10 → หน้าแรกของมันได้ "10"', P.prosePageLabel(1, PN, 10) === '10');
check('ไม่มีคีย์ pageNumberFirst หลงเหลือในค่าเริ่มต้น',
  !('pageNumberFirst' in P.mergeProseFormat({})));

// ───────── blocksFromDoc (จำลอง doc ของ ProseMirror) ─────────
const fakeDoc = {
  forEach(fn) {
    const nodes = [
      { type: { name: 'heading' }, attrs: { level: 2 }, textContent: 'บทที่ 1' },
      { type: { name: 'paragraph' }, attrs: {}, textContent: 'เนื้อเรื่อง' },
      { type: { name: 'blockquote' }, attrs: {}, textContent: 'คำพูด' },
      { type: { name: 'horizontal_rule' }, attrs: {}, textContent: '' },
      { type: { name: 'code_block' }, attrs: {}, textContent: 'x=1' },
      { type: { name: 'figure' }, attrs: { src: 'a.png', alt: 'รูป' }, textContent: '' },
    ];
    let off = 0;
    for (const n of nodes) { fn(n, off); off += 10; }
  },
};
const fb = P.proseBlocksFromDoc(fakeDoc);
check('blocksFromDoc: ได้ครบ 6 บล็อก', fb.length === 6);
check('blocksFromDoc: heading → h2', fb[0].type === 'h2' && fb[0].level === 2);
check('blocksFromDoc: paragraph → p', fb[1].type === 'p');
check('blocksFromDoc: blockquote', fb[2].type === 'blockquote');
check('[27] blocksFromDoc: horizontal_rule → hr', fb[3].type === 'hr');
check('[27] blocksFromDoc: code_block → code', fb[4].type === 'code');
check('blocksFromDoc: figure เก็บ src/alt', fb[5].type === 'figure' && fb[5].alt === 'รูป');
check('blocksFromDoc: pos ไล่ตามจริง', fb[2].pos === 20);
check('blocksFromDoc: doc ว่างไม่พัง', P.proseBlocksFromDoc(null).length === 0);

// [alpha.60r1] เติมเช็คที่หายไป 1 ข้อ (เอกสารอ้าง 84 แต่ไฟล์มี 83)
// num() ย้ายไป num.js แล้ว — พิสูจน์ว่าค่า 0 ที่ผู้ใช้ตั้งเองยังรอด ไม่ถูกแทนด้วยค่าเริ่มต้น (กฎ 20)
check('[กฎ20] ตั้งย่อหน้าแรกไม่เยื้อง (0) แล้วต้องได้ 0 จริง',
  P.mergeProseFormat({ firstLineIndent: 0 }).firstLineIndent === 0,
  P.mergeProseFormat({ firstLineIndent: 0 }).firstLineIndent);
check('[กฎ20] ตั้งระยะห่างย่อหน้าเป็น 0 แล้วต้องได้ 0 จริง',
  P.mergeProseFormat({ paraSpacing: 0 }).paraSpacing === 0,
  P.mergeProseFormat({ paraSpacing: 0 }).paraSpacing);

// ═══════ [alpha.81r ข้อ 1+2] จอกับไฟล์ที่ส่งออกต้องใช้ฟอนต์/ขนาดชุดเดียวกัน ═══════
// เดิม proseCss (ตัวแก้ไข) ไม่ตั้ง font-family เลย — ฟอนต์นิยายที่เลือกไว้มีผลแค่ตอนส่งออก
{
  const f = P.mergeProseFormat({ fontFamily: '"ฟอนต์ทดสอบ", serif', fontPt: 14 });
  const css = P.proseCss(f, '.X');
  check('proseCss ตั้ง font-family ให้ตัวแก้ไขแล้ว', /font-family:"ฟอนต์ทดสอบ", serif/.test(css), css.slice(0, 120));
  check('proseCss ตั้งขนาดผ่าน --ed-fs (ค่าสำรอง = ขนาดจริงจาก fontPt)',
        css.includes('font-size:var(--ed-fs, ' + P.proseFontPx(f) + 'px)'), css.slice(0, 160));
  const ex = P.proseExportCss(f);
  check('ฟอนต์ที่ส่งออกเป็นตัวเดียวกับที่ตั้ง', ex.includes('"ฟอนต์ทดสอบ", serif'));
  check('ขนาดที่ส่งออกคิดจาก fontPt ตัวเดียวกัน', ex.includes('font-size:14pt'), ex.slice(0, 120));
  // เลขบทอัตโนมัติเคยมีแต่บนจอ — เปิดแล้วไฟล์ที่ส่งออกไม่มีเลขบท (จอ ≠ ไฟล์)
  const fn = P.mergeProseFormat({ headingNumber: true, headingNumberLevel: 2 });
  check('เปิดเลขบท → CSS ตอนส่งออกมี counter ให้ด้วย',
        /counter-increment:k-chap/.test(P.proseExportCss(fn)) &&
        /counter\(k-chap\)/.test(P.proseExportCss(fn)));
  check('เลขบทของจอกับของไฟล์ใช้ระดับหัวข้อเดียวกัน',
        P.proseExportCss(fn).includes('h2{counter-increment:k-chap}') &&
        P.proseCss(fn, '.X').includes('.X h2{counter-increment:k-chap}'));
  check('ปิดเลขบท → ไม่มี counter ทั้งสองฝั่ง',
        !/counter-increment/.test(P.proseExportCss(P.mergeProseFormat({ headingNumber: false }))));
}

// ═══════ [alpha.81r ข้อ 5] Markdown → บล็อกนิยาย (ใช้จัดหน้าในช่องตัวอย่าง) ═══════
{
  const b = P.mdToProseBlocks('# หัวข้อ\n\nย่อหน้าแรก\n> ยกคำพูด\n- รายการ\n---\nย่อหน้าท้าย');
  check('แยกบล็อกได้ครบ 6 ชิ้น (บรรทัดว่างไม่นับ)', b.length === 6, b.length + ':' + b.map((x) => x.type).join(','));
  check('หัวข้อได้ type/level ถูก', b[0].type === 'h1' && b[0].level === 1 && b[0].text === 'หัวข้อ');
  check('ย่อหน้าเป็น p', b[1].type === 'p' && b[1].text === 'ย่อหน้าแรก');
  check('ยกคำพูดถอด > ออก', b[2].type === 'blockquote' && b[2].text === 'ยกคำพูด');
  check('รายการถอดสัญลักษณ์ออก', b[3].type === 'li' && b[3].text === 'รายการ');
  check('เส้นคั่นเป็น hr', b[4].type === 'hr');
  check('idx เรียงต่อเนื่อง', b.every((x, i) => x.idx === i));
  check('ข้อความว่างได้อาเรย์ว่าง', P.mdToProseBlocks('').length === 0 && P.mdToProseBlocks(null).length === 0);
  // รูปแบบเดียวกับ proseBlocksFromDoc → เอาไปเข้า paginateProse ได้ตรง ๆ
  const pg = P.paginateProse(P.mdToProseBlocks('ก\n'.repeat(400)), { fmt: P.mergeProseFormat({}) });
  check('เอาไปจัดหน้าได้จริง (ยาว ๆ แล้วได้หลายหน้า)', pg.count > 1, String(pg.count));
}

console.log(`\nprose-format: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
