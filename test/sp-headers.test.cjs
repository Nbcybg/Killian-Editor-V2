// test/sp-headers.test.cjs — unit test หัวกระดาษทุกหน้า (ข้อ 91)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const H = build('sp-headers.js', 'k2-hdr-test.cjs');
const SF = build('sp-format.js', 'k2-hdr-fmt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── ค่าเริ่มต้น ──
check('ค่าเริ่มต้นปิดไว้ (บทมาตรฐานใช้เลขหน้าของ sp-format อยู่แล้ว)',
  H.HEADER_DEFAULTS.enabled === false);
check('ค่าเริ่มต้นเว้น 1 บรรทัดหลังหัวกระดาษ', H.HEADER_DEFAULTS.emptyLinesAfter === 1);
check('ค่าเริ่มต้นไม่ใส่หัวบนหน้าแรก', H.HEADER_DEFAULTS.firstPage === false);
check('ค่าเริ่มต้นมี ${PAGE} ชิดขวา',
  H.HEADER_DEFAULTS.strings[0].text.includes('${PAGE}') &&
  H.HEADER_DEFAULTS.strings[0].align === 'right');
check('มีตัวแปรให้ใช้อย่างน้อย 6 ตัว และมีชื่อไทยกำกับ',
  H.HEADER_VARS.length >= 6 && H.HEADER_VARS.every((v) => v.key && v.th && v.label));
check('มีตัวแปร PAGE / TITLE / AUTHOR',
  ['PAGE', 'TITLE', 'AUTHOR'].every((k) => H.HEADER_VARS.some((v) => v.key === k)));
check('newHeaderString คืนค่าเริ่มต้นครบทุกคีย์', (() => {
  const s = H.newHeaderString();
  return s.text === '' && s.align === 'right' && s.xOffset === 0 &&
    s.bold === false && s.caps === false;
})());

// ── mergeHeaders ──
const m0 = H.mergeHeaders(null);
check('mergeHeaders(null) ไม่พัง และปิดไว้', m0.enabled === false && Array.isArray(m0.strings));
const m1 = H.mergeHeaders({ enabled: true, emptyLinesAfter: 99, strings: [{ text: 'x', align: 'bogus' }] });
check('emptyLinesAfter ถูกหนีบไม่ให้เกิน 10', m1.emptyLinesAfter === 10, m1.emptyLinesAfter);
check('align ที่ไม่รู้จัก → right', m1.strings[0].align === 'right');
check('mergeHeaders ไม่แก้ของเดิม (คืน object ใหม่)',
  H.mergeHeaders(H.HEADER_DEFAULTS).strings !== H.HEADER_DEFAULTS.strings);
const mNeg = H.mergeHeaders({ enabled: true, emptyLinesAfter: -5, strings: [] });
check('emptyLinesAfter ติดลบ → 0', mNeg.emptyLinesAfter === 0);

// ── ตัวแปร ──
const ctx = { PAGE: 7, PAGES: 12, TITLE: 'ยามเมื่อฟ้าสาง', AUTHOR: 'ท็อป', DATE: '2026-08-04' };
check('${PAGE} ถูกแทนค่า', H.resolveHeaderVars('หน้า ${PAGE}', ctx) === 'หน้า 7');
check('รองรับชื่อไทย ${หน้า}', H.resolveHeaderVars('${หน้า}/${จำนวนหน้า}', ctx) === '7/12');
check('รองรับตัวพิมพ์เล็ก ${title}', H.resolveHeaderVars('${title}', ctx) === 'ยามเมื่อฟ้าสาง');
check('ตัวแปรที่ไม่รู้จักกลายเป็นว่าง (ไม่ทิ้ง ${…} ไว้บนกระดาษ)',
  H.resolveHeaderVars('a${NOPE}b', ctx) === 'ab');
check('ไม่มีค่าใน ctx → ว่าง ไม่ใช่ undefined',
  H.resolveHeaderVars('[${AUTHOR}]', {}) === '[]');
check('ข้อความว่าง/undefined ไม่พัง',
  H.resolveHeaderVars(undefined, ctx) === '' && H.resolveHeaderVars('', ctx) === '');
check('ข้อความไม่มีตัวแปรคงเดิมเป๊ะ',
  H.resolveHeaderVars('ร่างที่สอง', ctx) === 'ร่างที่สอง');

// ── นับบรรทัด ──
check('ปิด = ไม่กินบรรทัดเลย', H.headerLineCount({ enabled: false }) === 0);
check('เปิด + 1 บรรทัดว่าง = กิน 2 บรรทัด',
  H.headerLineCount({ enabled: true, emptyLinesAfter: 1, strings: [{ text: '${PAGE}' }] }) === 2);
check('เปิดแต่ข้อความว่างทุกชิ้น = ไม่กินบรรทัด',
  H.headerLineCount({ enabled: true, strings: [{ text: '  ' }] }) === 0);
check('ทุกชิ้นอยู่บรรทัดเดียวกัน (3 ชิ้นก็ยัง 1+1)',
  H.headerLineCount({ enabled: true, emptyLinesAfter: 1,
    strings: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }) === 2);

// ── บรรทัดที่เหลือให้เนื้อหา ──
const fmt = SF.mergeSpFormat();
check('ไม่มีหัวกระดาษ → 54 บรรทัด/หน้าเหมือนเดิม',
  H.linesForBody(fmt, null) === SF.formatLines(fmt), H.linesForBody(fmt, null));
const hdrOn = { enabled: true, emptyLinesAfter: 1, strings: [{ text: '${PAGE}' }] };
check('มีหัวกระดาษ → เนื้อหน้าลด 2 บรรทัด',
  H.linesForBody(fmt, hdrOn) === SF.formatLines(fmt) - 2, H.linesForBody(fmt, hdrOn));
check('หัวกระดาษยาวผิดปกติก็ยังเหลือเนื้ออย่างน้อย 4 บรรทัด',
  H.linesForBody({ ...fmt, paper: { width: 8.5, height: 2 } },
    { enabled: true, emptyLinesAfter: 10, strings: [{ text: 'x' }] }) >= 4);

// ── สตริงต่อหน้า ──
check('ปิด → ไม่มีสตริงเลย', H.headerStringsFor(3, { enabled: false }, ctx).length === 0);
check('หน้าแรกไม่ใส่หัว (firstPage=false)', H.headerStringsFor(1, hdrOn, ctx).length === 0);
check('หน้า 2 ใส่หัว', H.headerStringsFor(2, hdrOn, ctx).length === 1);
check('firstPage=true → หน้าแรกมีหัวด้วย',
  H.headerStringsFor(1, { ...hdrOn, firstPage: true }, ctx).length === 1);
check('${PAGE} ใช้เลขหน้าที่ส่งมาก่อน index',
  H.headerStringsFor(3, hdrOn, { PAGE: 99 })[0].text === '99');
check('ไม่ส่ง PAGE มา → ใช้ index ของหน้า',
  H.headerStringsFor(5, hdrOn, {})[0].text === '5');
check('caps ทำให้เป็นตัวพิมพ์ใหญ่',
  H.headerStringsFor(2, { enabled: true, strings: [{ text: 'draft two', caps: true }] }, ctx)[0]
    .text === 'DRAFT TWO');
check('ชิ้นที่แทนค่าแล้วว่างถูกตัดทิ้ง',
  H.headerStringsFor(2, { enabled: true, strings: [{ text: '${NOPE}' }, { text: 'ok' }] }, ctx)
    .length === 1);
check('คืน align / xOffset / สไตล์มาให้ตัววาด', (() => {
  const r = H.headerStringsFor(2, { enabled: true,
    strings: [{ text: 'x', align: 'center', xOffset: 0.25, bold: true, italic: true, underline: true }] },
    ctx)[0];
  return r.align === 'center' && r.xOffset === 0.25 && r.bold && r.italic && r.underline;
})());
check('3 ชิ้นซ้าย/กลาง/ขวา ได้ครบทั้งสาม', (() => {
  const rows = H.headerStringsFor(2, { enabled: true, strings: [
    { text: '${TITLE}', align: 'left' }, { text: '${AUTHOR}', align: 'center' },
    { text: '${PAGE}', align: 'right' }] }, ctx);
  return rows.length === 3 && rows[0].text === ctx.TITLE && rows[2].text === '7';
})());

// ── HTML ──
const html = H.headerHtml(2, hdrOn, ctx);
check('headerHtml คืนกล่อง .sp-hdr', html.includes('class="sp-hdr"'));
check('headerHtml บอกจำนวนบรรทัดที่กินไว้ใน data-lines', html.includes('data-lines="2"'));
check('headerHtml หน้าแรก = ว่าง', H.headerHtml(1, hdrOn, ctx) === '');
check('headerHtml escape < > & ให้เรียบร้อย',
  !H.headerHtml(2, { enabled: true, strings: [{ text: '<b>&x' }] }, ctx).includes('<b>'));
check('ชิดขวาใช้ right: (xOffset บวก = ขยับไปทางขวา จึงกลับเครื่องหมาย)',
  H.headerHtml(2, { enabled: true, strings: [{ text: 'x', align: 'right', xOffset: 0.5 }] }, ctx)
    .includes('right:-0.5in'));
check('ชิดซ้ายใช้ left:',
  H.headerHtml(2, { enabled: true, strings: [{ text: 'x', align: 'left', xOffset: 0.5 }] }, ctx)
    .includes('left:0.5in'));
check('กึ่งกลางใช้ translateX',
  H.headerHtml(2, { enabled: true, strings: [{ text: 'x', align: 'center' }] }, ctx)
    .includes('translateX'));
const css = H.headerCss(hdrOn, fmt);
check('headerCss มีกฎ .sp-hdr และความกว้างเป็นนิ้ว', css.includes('.sp-hdr{') && css.includes('in;'));
check('headerCss วางชิ้นแบบ absolute (ชิ้นหนึ่งยาวไม่ดันชิ้นอื่น)',
  css.includes('.sp-hdr-item{position:absolute'));

// ── ข้อความล้วน ──
const line = H.headerPlainLine(2, { enabled: true, strings: [
  { text: 'เรื่อง', align: 'left' }, { text: '${PAGE}', align: 'right' }] }, ctx, 40);
check('headerPlainLine วางซ้าย-ขวาในบรรทัดเดียว',
  line.startsWith('เรื่อง') && line.trimEnd().endsWith('7'), JSON.stringify(line));
check('headerPlainLine ไม่ยาวเกินความกว้างที่ให้', line.length <= 40, line.length);
check('headerPlainLine หน้าแรก = ว่าง',
  H.headerPlainLine(1, hdrOn, ctx, 40) === '');

// ═════ [alpha.60r1] caps: HTML preview / PDF / ข้อความล้วน ต้องได้ตัวพิมพ์ใหญ่ตรงกันหมด ═════
// (ตรวจข้อสงสัยว่า headerHtml ลืมใส่ text-transform — จริง ๆ ทุกทางวิ่งผ่าน headerStringsFor
//  ซึ่ง toUpperCase() ให้แล้ว จึงไม่มีทางเพี้ยน · ล็อกเป็นเทสถาวรกันคนไปแยกทางกันภายหลัง)
{
  const capsHdr = H.mergeHeaders({ enabled: true, firstPage: true,
    strings: [{ text: 'draft ${DRAFT}', align: 'left', caps: true },
              { text: 'draft ${DRAFT}', align: 'right', caps: false }] });
  const c = { DRAFT: 'two' };
  const rows = H.headerStringsFor(1, capsHdr, c);
  check('[91] caps=true → ข้อความถูกทำเป็นตัวพิมพ์ใหญ่ตั้งแต่ headerStringsFor',
    rows[0].text === 'DRAFT TWO', rows[0].text);
  check('[91] caps=false → คงตัวพิมพ์เดิม', rows[1].text === 'draft two', rows[1].text);
  const html = H.headerHtml(1, capsHdr, c);
  check('[91] HTML preview ได้ตัวพิมพ์ใหญ่ตรงกับที่ PDF วาด',
    html.includes('DRAFT TWO') && html.includes('draft two'), html);
  const plain = H.headerPlainLine(1, capsHdr, c, 60);
  check('[91] ข้อความล้วนก็ตรงกัน', plain.includes('DRAFT TWO') && plain.includes('draft two'), plain);
  check('[91] caps ไม่ทำให้ภาษาไทยเพี้ยน',
    H.headerStringsFor(1, H.mergeHeaders({ enabled: true, firstPage: true,
      strings: [{ text: 'ฉบับร่าง', caps: true }] }), {})[0].text === 'ฉบับร่าง');
  // xOffset = 0 ต้องไม่ถูกแทนด้วยค่าเริ่มต้น (กฎ 20)
  const zero = H.mergeHeaders({ enabled: true, strings: [{ text: 'a', xOffset: 0, align: 'right' }] });
  check('[กฎ20] xOffset 0 รอด mergeHeaders', zero.strings[0].xOffset === 0);
  check('[กฎ20] xOffset 0 → CSS ชิดขวาพอดี 0in',
    H.headerHtml(2, zero, {}).includes('right:0in'), H.headerHtml(2, zero, {}));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
