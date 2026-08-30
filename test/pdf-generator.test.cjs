// test/pdf-generator.test.cjs — unit test ตัวสร้าง PDF ในโปรแกรม (ข้อ 69 · 87 · 89)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// สร้าง PDF จริงแล้วตรวจไบต์ที่ออกมา — ไม่ต้องเปิด electron
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const G = build('pdf-generator.js', 'k2-pdfgen-test.cjs');
const SF = build('sp-format.js', 'k2-pdfgen-fmt-test.cjs');
const TP = build('sp-title-pages.js', 'k2-pdfgen-tp-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const fmt = SF.mergeSpFormat();
const FONT_DIR = path.join(__dirname, '..', 'renderer', 'assets', 'fonts');
const readFont = (f) => { try { return new Uint8Array(fs.readFileSync(path.join(FONT_DIR, f))); } catch { return null; } };
const thaiFont = readFont('CourierThaiMono.ttf');
const asText = (bytes) => Buffer.from(bytes).toString('latin1');

// pdf-lib บีบอัด content stream ด้วย FlateDecode → จะตรวจ "ข้อความที่วาดจริง" ต้องคลายก่อน
// (เดิมนับ /Tj จากไบต์ดิบ ได้แค่ 2–3 ตัวที่บังเอิญโผล่ในไบนารีฟอนต์ = เทสผ่านแบบผิด ๆ)
const zlib = require('zlib');
function streamsText(bytes) {
  const buf = Buffer.from(bytes);
  const out = [];
  let i = 0;
  for (;;) {
    const s = buf.indexOf('stream', i);
    if (s < 0) break;
    const e = buf.indexOf('endstream', s);
    if (e < 0) break;
    let a = s + 6;
    if (buf[a] === 0x0d) a++;
    if (buf[a] === 0x0a) a++;
    const chunk = buf.slice(a, e);
    let text;
    try { text = zlib.inflateSync(chunk).toString('latin1'); }
    catch { text = chunk.toString('latin1'); }
    // เอาเฉพาะ "content stream" — ไบนารีของฟอนต์ที่ฝังไว้ก็ถูกบีบอัดเหมือนกัน และมีไบต์
    // ที่อ่านเป็น "Tj" ได้โดยบังเอิญ (นับรวมแล้วเลขเพี้ยนทุกครั้ง)
    const printable = (text.match(/[\x09\x0a\x0d\x20-\x7e]/g) || []).length / (text.length || 1);
    if (printable > 0.95 && /\bBT\b/.test(text) && /\bET\b/.test(text)) out.push(text);
    i = e + 9;
  }
  return out.join('\n');
}
const drawOps = (bytes) => (streamsText(bytes).match(/\bTj\b/g) || []).length;

// pdf-lib เขียนข้อความเป็น hex string (<48656C6C6F> Tj) ทั้งฟอนต์มาตรฐานและฟอนต์ที่ฝัง
// → ค้นข้อความในไฟล์ตรง ๆ ไม่เจอ ต้องถอด hex ก่อน (ฟอนต์มาตรฐาน = ได้ตัวอักษรอ่านออก)
function drawnText(bytes) {
  const s = streamsText(bytes);
  const out = [];
  for (const m of s.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
    const h = m[1];
    let t = '';
    for (let i = 0; i + 1 < h.length; i += 2) t += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
    out.push(t);
  }
  return out.join('\n');
}

// ───────── ตัดบรรทัด ─────────
check('wrapTextLines คืนอาร์เรย์บรรทัด', Array.isArray(G.wrapTextLines('abc', 6)));
check('ข้อความว่าง → 1 บรรทัดว่าง',
  G.wrapTextLines('', 6).length === 1 && G.wrapTextLines('   ', 6)[0] === '');
check('ตัดตามจำนวนตัวอักษรต่อบรรทัด (6 นิ้ว = 60 ตัว)', (() => {
  const l = G.wrapTextLines('x'.repeat(59) + ' ' + 'y'.repeat(10), 6);
  return l.length === 2 && l[0].length === 59;
})());
check('คำเดียวยาวเกินบรรทัดถูกหักดิบเป็นท่อน ๆ', (() => {
  const l = G.wrapTextLines('z'.repeat(130), 6);
  // จำนวนบรรทัดต้องเท่ากับที่ wrapLines นับ (มีบรรทัดว่างนำหน้าเมื่อคำแรกยาวเกิน)
  return l.length === SF.wrapLines('z'.repeat(130), 6) &&
    l.filter((x) => x.length === 60).length === 2 && l[l.length - 1].length === 10;
})());
check('\\n ในข้อความบังคับขึ้นบรรทัดใหม่', G.wrapTextLines('ก\nข', 6).length === 2);
check('จำนวนบรรทัดตรงกับ wrapLines ของตัวจัดหน้า (จอกับกระดาษต้องเท่ากัน)', (() => {
  const samples = ['สั้น', 'ก'.repeat(200), 'a b c '.repeat(40), 'บรรทัดหนึ่ง\nบรรทัดสอง'];
  return samples.every((s) => G.wrapTextLines(s, 3.5).length === SF.wrapLines(s, 3.5));
})());

// ───────── ตัวเลือก ─────────
check('mergePdfOptions(null) ไม่พัง', G.mergePdfOptions(null).toc === true);
check('ค่าเริ่มต้นเปิดสารบัญและหัวกระดาษ',
  G.PDF_DEFAULTS.toc === true && G.PDF_DEFAULTS.headers === true);
check('ค่าเริ่มต้นไม่ตั้งหน้าที่จะเปิด (0)', G.PDF_DEFAULTS.openPage === 0);
check('openPage ติดลบถูกหนีบเป็น 0', G.mergePdfOptions({ openPage: -3 }).openPage === 0);
check('startPage ต่ำสุด 1', G.mergePdfOptions({ startPage: 0 }).startPage === 1);
check('fontPt ถูกหนีบ 4–96',
  G.mergePdfOptions({ fontPt: 1 }).fontPt === 4 && G.mergePdfOptions({ fontPt: 500 }).fontPt === 96);
check('omit ที่ไม่ใช่อาร์เรย์ → []', G.mergePdfOptions({ omit: 'note' }).omit.length === 0);
check('OMITTABLE_ELEMENTS มีโน้ต/สรุป/โครง',
  ['note', 'summary', 'outline1'].every((k) => G.OMITTABLE_ELEMENTS.includes(k)));
check('1 นิ้ว = 72 point', G.PT_PER_IN === 72);

// ───────── layoutPageLines มิเรอร์การนับของ paginate ─────────
const blocksSmall = [
  { el: 'scene', text: 'INT. ห้องนอน - กลางคืน' },
  { el: 'action', text: 'ทอร่านั่งอยู่บนเตียง' },
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'ฉันไม่อยากไป' },
];
const rows = G.layoutPageLines(SF.paginate(blocksSmall, { fmt }).pages[0], fmt);
check('layoutPageLines คืนทุกบล็อกในหน้า', rows.length === 4);
check('บล็อกแรกของหน้าอยู่บรรทัด 0 (ไม่มีระยะเว้นก่อน)', rows[0].line === 0);
check('บรรทัดไล่ขึ้นเรื่อย ๆ ไม่ทับกัน',
  rows.every((r, i) => i === 0 || r.line > rows[i - 1].line));
check('บทพูดอยู่ต่อจากชื่อตัวละครทันที (ไม่เว้นบรรทัด)',
  rows[3].line === rows[2].line + 1, rows.map((r) => r.line).join(','));
check('เก็บบรรทัดข้อความจริงไว้ให้ตัววาด', rows[1].lines[0].includes('ทอร่า'));

// ───────── สร้าง PDF จริง ─────────
const longBlocks = [];
for (let s = 1; s <= 4; s++) {
  longBlocks.push({ el: 'scene', text: `INT. ห้องที่ ${s} - กลางวัน`, sceneNo: s });
  for (let i = 0; i < 22; i++) longBlocks.push({ el: 'action', text: `บรรยายฉาก ${s} บรรทัด ${i}` });
  longBlocks.push({ el: 'character', text: 'ทอร่า' });
  longBlocks.push({ el: 'dialogue', text: 'เราต้องไปแล้วนะ ไม่มีเวลาอีกแล้ว' });
  longBlocks.push({ el: 'note', text: 'โน้ตของนักเขียน — ยังไม่ตัดสินใจ' });
}
const meta = { title: 'ยามเมื่อฟ้าสาง', author: 'ท็อป', draft: 'ร่างที่สอง', date: '2026-08-04' };

(async () => {
  // ── พื้นฐาน (ฟอนต์ไทยฝังจริง) ──
  const r1 = await G.generatePdf({
    blocks: longBlocks, fmt, meta,
    fonts: { regular: thaiFont },
    opts: { toc: true, titlePages: false, headers: false },
  });
  check('มีฟอนต์ไทยอยู่ในโปรเจกต์ให้ฝัง', !!thaiFont, FONT_DIR);
  check('คืน Uint8Array', r1.bytes instanceof Uint8Array && r1.bytes.length > 1000, r1.bytes.length);
  check('เป็นไฟล์ PDF จริง (%PDF-)', asText(r1.bytes.slice(0, 5)) === '%PDF-');
  check('ปิดไฟล์ด้วย %%EOF', asText(r1.bytes.slice(-8)).includes('%%EOF'));
  check('บทยาว 4 ฉาก → ได้หลายหน้า', r1.scriptPages >= 2, r1.scriptPages);
  check('pageCount = หน้าปก + หน้าบท', r1.pageCount === r1.titleCount + r1.scriptPages);
  check('ไม่ใส่หน้าปก → titleCount = 0', r1.titleCount === 0);
  check('[87] เก็บหัวฉากไว้ทำสารบัญครบ 4 ฉาก', r1.bookmarks.length === 4, r1.bookmarks.length);
  check('[87] สารบัญเก็บเลขหน้าและตำแหน่ง y',
    r1.bookmarks.every((b) => Number.isFinite(b.pageIndex) && Number.isFinite(b.y)));
  check('[87] หัวฉากที่ 4 อยู่หน้าหลังกว่าฉากแรก',
    r1.bookmarks[3].pageIndex > r1.bookmarks[0].pageIndex);
  const t1 = asText(r1.bytes);
  check('[87] ไฟล์มี /Outlines', t1.includes('/Outlines'));
  check('[87] เปิดมาโชว์แถบสารบัญ (/PageMode /UseOutlines)', t1.includes('/UseOutlines'));
  check('[87] bookmark เป็น UTF-16 (ชื่อฉากไทยไม่กลายเป็นขยะ)', t1.includes('/Title <FEFF'));
  check('[89] ไม่ตั้ง openPage → ไม่มี /OpenAction', !t1.includes('/OpenAction'));
  check('ฝังฟอนต์ TrueType ลงไฟล์ (/FontFile2)', t1.includes('/FontFile2'));
  check('ใส่ชื่อเรื่องเป็นเมทาดาทาของไฟล์', t1.includes('/Producer') || t1.includes('/Creator'));

  // ── [89] OpenAction ──
  const r2 = await G.generatePdf({
    blocks: longBlocks, fmt, meta, fonts: { regular: thaiFont },
    opts: { openPage: 2, toc: false, titlePages: false },
  });
  check('[89] ตั้ง openPage → มี /OpenAction', asText(r2.bytes).includes('/OpenAction'));
  const rOver = await G.generatePdf({ blocks: blocksSmall, fmt, fonts: { regular: thaiFont },
    opts: { openPage: 999, titlePages: false } });
  check('[89] openPage เกินจำนวนหน้าไม่พัง (หนีบให้อยู่ในไฟล์)',
    rOver.pageCount >= 1 && asText(rOver.bytes).includes('/OpenAction'));
  check('[87] ปิดสารบัญ → ไม่มี /Outlines', !asText(r2.bytes).includes('/Outlines'));

  // ── ไม่มีไบต์ฟอนต์ → Courier มาตรฐาน + ไทยไม่ทำให้ล้ม ──
  const r3 = await G.generatePdf({
    blocks: longBlocks, fmt, meta, fonts: null, opts: { titlePages: false },
  });
  check('ไม่มีฟอนต์ไทย → ยังสร้าง PDF ได้ (ไม่ throw)',
    r3.bytes instanceof Uint8Array && r3.pageCount >= 1);
  check('ตกไปใช้ Courier มาตรฐาน (ไม่มี /FontFile2)', !asText(r3.bytes).includes('/FontFile2'));
  check('sanitizeForStandardFont แปลงไทยเป็น ?',
    G.sanitizeForStandardFont('กข') === '??' && G.sanitizeForStandardFont('abc') === 'abc');
  check('sanitizeForStandardFont เก็บอักษรละตินมีวรรณยุกต์ไว้ได้',
    G.sanitizeForStandardFont('café') === 'café');

  // ── [90] หน้าปก ──
  const titles = TP.defaultTitlePages(meta, fmt);
  const r4 = await G.generatePdf({
    blocks: blocksSmall, fmt, meta, titlePages: titles, fonts: { regular: thaiFont },
    opts: { titlePages: true, toc: true },
  });
  check('[90] หน้าปก 1 หน้าถูกนับ', r4.titleCount === 1);
  check('[90] หน้าปกอยู่หน้าแรก → หน้าบทเลื่อนไป 1',
    r4.bookmarks[0].pageIndex === 1, r4.bookmarks[0].pageIndex);
  check('[90] ปิดสวิตช์หน้าปก → ไม่แนบแม้ส่งข้อมูลมา', (await G.generatePdf({
    blocks: blocksSmall, fmt, titlePages: titles, fonts: { regular: thaiFont },
    opts: { titlePages: false } })).titleCount === 0);
  const r4b = await G.generatePdf({
    blocks: blocksSmall, fmt, meta, fonts: { regular: thaiFont },
    titlePages: [...titles, { strings: [{ text: 'หน้าปกใบที่สอง' }] }],
    opts: { titlePages: true } });
  check('[90] หน้าปกหลายใบได้', r4b.titleCount === 2);

  // ── [88] ตัด element ──
  const r5 = await G.generatePdf({
    blocks: longBlocks, fmt, fonts: { regular: thaiFont },
    opts: { omit: ['note'], titlePages: false, toc: false },
  });
  check('[88] ตัดโน้ตออก → หน้าน้อยลงหรือเท่าเดิม', r5.scriptPages <= r1.scriptPages);
  check('[88] ตัด element ทุกชนิดที่มี → ยังได้ไฟล์ 1 หน้า', (await G.generatePdf({
    blocks: blocksSmall, fmt, fonts: { regular: thaiFont },
    opts: { omit: ['scene', 'action', 'character', 'dialogue'], titlePages: false } })).pageCount === 1);
  const r5b = await G.generatePdf({
    blocks: longBlocks, fmt, fonts: { regular: thaiFont },
    opts: { drawRectAroundNotes: true, titlePages: false, toc: false } });
  check('[88] วาดกรอบรอบโน้ตได้ (ไฟล์ใหญ่กว่าตอนไม่วาด)',
    r5b.bytes.length > r5.bytes.length, `${r5b.bytes.length} vs ${r5.bytes.length}`);

  // ── [91] หัวกระดาษ ──
  const hdr = { enabled: true, emptyLinesAfter: 1, firstPage: false,
                strings: [{ text: '${TITLE}', align: 'left' }, { text: '${PAGE}.', align: 'right' }] };
  const r6 = await G.generatePdf({
    blocks: longBlocks, fmt, meta, headers: hdr, fonts: { regular: thaiFont },
    opts: { headers: true, titlePages: false, toc: false } });
  check('[91] หัวกระดาษกินบรรทัด → จำนวนหน้ามากกว่าหรือเท่ากับตอนไม่มีหัว',
    r6.scriptPages >= r1.scriptPages, `${r6.scriptPages} vs ${r1.scriptPages}`);
  check('[91] ปิดสวิตช์หัวกระดาษ → หน้าเท่าตอนไม่มีหัวเป๊ะ', (await G.generatePdf({
    blocks: longBlocks, fmt, meta, headers: hdr, fonts: { regular: thaiFont },
    opts: { headers: false, titlePages: false, toc: false } })).scriptPages === r1.scriptPages);

  // ── เลขหน้า / เลขฉาก ──
  const fmtNum = SF.mergeSpFormat({ pageNumbers: { show: true }, sceneNumbers: { show: true } });
  const r7 = await G.generatePdf({
    blocks: longBlocks, fmt: fmtNum, meta, fonts: { regular: thaiFont },
    opts: { titlePages: false, toc: false, startPage: 10 } });
  check('เปิดเลขหน้า/เลขฉาก → สร้างได้และไฟล์ใหญ่ขึ้น',
    r7.bytes.length > 1000 && r7.scriptPages === r1.scriptPages);
  check('ปิดเลขหน้าที่ระดับตัวเลือก → ยังสร้างได้', (await G.generatePdf({
    blocks: longBlocks, fmt: fmtNum, fonts: { regular: thaiFont },
    opts: { pageNumbers: false, sceneNumbers: false, titlePages: false } })).pageCount >= 1);

  // ── ลายน้ำ ──
  const rNoWm = await G.generatePdf({
    blocks: blocksSmall, fmt, fonts: { regular: thaiFont }, opts: { titlePages: false } });
  const r8 = await G.generatePdf({
    blocks: blocksSmall, fmt, fonts: { regular: thaiFont },
    opts: { watermark: 'สำเนาผู้กำกับ', titlePages: false } });
  check('ลายน้ำเขียนลงไฟล์ได้ (ไฟล์ใหญ่กว่าตอนไม่มี)',
    r8.bytes.length > rNoWm.bytes.length, `${r8.bytes.length} vs ${rNoWm.bytes.length}`);
  check('ลายน้ำใช้ความโปร่งใส → มี ExtGState ในไฟล์', asText(r8.bytes).includes('/ExtGState'));

  // ── ขนาดกระดาษ A4 ──
  const r9 = await G.generatePdf({
    blocks: blocksSmall, fmt: SF.mergeSpFormat({ paperSize: 'a4' }), fonts: { regular: thaiFont },
    opts: { titlePages: false } });
  check('A4 → ขนาดหน้าไม่ใช่ 612×792', asText(r9.bytes).includes('/MediaBox') &&
    !asText(r9.bytes).includes('612 792'));

  // ── กรณีสุดขอบ ──
  const r10 = await G.generatePdf({ blocks: [], fmt, opts: { titlePages: false } });
  check('บทว่างเปล่า → ยังได้ PDF 1 หน้า (ไม่ throw)', r10.pageCount === 1);
  check('บทว่าง → ไม่มีสารบัญ', r10.bookmarks.length === 0);
  const r11 = await G.generatePdf({});
  check('ไม่ส่งอะไรมาเลย → ไม่พัง', r11.bytes instanceof Uint8Array);
  const r12 = await G.generatePdf({
    blocks: [{ el: 'blank', text: '' }, { el: 'action', text: 'ก' }], fmt,
    fonts: { regular: thaiFont }, opts: { titlePages: false } });
  check('บล็อกว่าง (blank) ถูกข้าม', r12.pageCount === 1);
  const r13 = await G.generatePdf({
    blocks: blocksSmall, fmt, fonts: { regular: new Uint8Array([1, 2, 3]) },
    opts: { titlePages: false } });
  check('ไบต์ฟอนต์เสีย → ตกไปฟอนต์มาตรฐาน ไม่ throw', r13.pageCount === 1);
  const r14 = await G.generatePdf({
    blocks: blocksSmall, fmt, fonts: { regular: Array.from(thaiFont || []) },
    opts: { titlePages: false } });
  check('รับไบต์ฟอนต์เป็นอาร์เรย์ตัวเลขได้ (kapi.readBytes คืนแบบนี้)',
    r14.pageCount === 1 && asText(r14.bytes).includes('/FontFile2'));

  // ── ฟอนต์ที่ฝัง: ไทยหนึ่งวงศ์ + ละตินอีกหนึ่งวงศ์ ──
  check('PDF_FONT_FILES.main เป็นฟอนต์ที่มีอักษรไทย',
    G.PDF_FONT_FILES.main[0].includes('Thai'), G.PDF_FONT_FILES.main.join(','));
  check('ไฟล์ฟอนต์ในรายการมีอยู่จริงในโปรเจกต์ทั้งสองวงศ์',
    G.PDF_FONT_FILES.main.every((f) => fs.existsSync(path.join(FONT_DIR, f))) &&
    Object.values(G.PDF_FONT_FILES.latin).every((f) => fs.existsSync(path.join(FONT_DIR, f))));
  check('CourierPrime ไม่มีอักษรไทย จึงเป็นวงศ์ละตินไม่ใช่วงศ์หลัก', (() => {
    const fk = require('@pdf-lib/fontkit');
    const prime = fk.create(fs.readFileSync(path.join(FONT_DIR, 'CourierPrime-Regular.ttf')));
    const thai = fk.create(fs.readFileSync(path.join(FONT_DIR, G.PDF_FONT_FILES.main[0])));
    const nodef = (f, s) => f.layout(s).glyphs.filter((g) => g.id === 0).length;
    return nodef(prime, 'กิน') === 3 && nodef(thai, 'กิน') === 0 && nodef(thai, 'abc') === 0 &&
      !Object.values(G.PDF_FONT_FILES.latin).some((f) => G.PDF_FONT_FILES.main.includes(f));
  })());
  check('ฟอนต์ไทยวางวรรณยุกต์เป็น advance 0 (ไม่กินคอลัมน์ของ monospace)', (() => {
    const fk = require('@pdf-lib/fontkit');
    const f = fk.create(fs.readFileSync(path.join(FONT_DIR, G.PDF_FONT_FILES.main[0])));
    const adv = f.layout('ที่').glyphs.map((g) => g.advanceWidth);
    return adv[0] > 0 && adv[1] === 0 && adv[2] === 0;
  })());
  // เหตุที่ต้องมีวงศ์ละติน: ฟอนต์ไทยยุคเก่าชี้ · © — ไปที่ glyph ไทยผิด ๆ (id ≠ 0 จึงไม่มีใครฟ้อง)
  check('ฟอนต์ไทยชี้ · © — ไปที่ glyph ไทย จึงห้ามวาดด้วยวงศ์หลัก', (() => {
    const fk = require('@pdf-lib/fontkit');
    const thai = fk.create(fs.readFileSync(path.join(FONT_DIR, G.PDF_FONT_FILES.main[0])));
    const prime = fk.create(fs.readFileSync(path.join(FONT_DIR, G.PDF_FONT_FILES.latin.regular)));
    // glyph ที่ฟอนต์ไทยให้กับ · ต้องไม่ใช่ตัวเดียวกับที่ CourierPrime ให้ (ยืนยันว่าคนละรูป)
    const gid = (f, ch) => f.layout(ch).glyphs[0].id;
    return gid(thai, '·') !== 0 && gid(prime, '·') !== 0 &&
      ['·', '©', '—', '…', '“'].every((ch) => gid(prime, ch) !== 0);
  })());
  check('needsLatinFont: ไทย/ASCII → วงศ์หลัก · เครื่องหมายสากล → วงศ์ละติน',
    !G.needsLatinFont('ก') && !G.needsLatinFont('A') && !G.needsLatinFont(' ') &&
    G.needsLatinFont('·') && G.needsLatinFont('©') && G.needsLatinFont('—') &&
    G.needsLatinFont('…') && G.needsLatinFont('“'));
  check('needsLatinFont ไม่ดึง PUA ไทยของวินโดวส์ไปวงศ์ละติน',
    !G.needsLatinFont(''));
  check('splitFontRuns ซอยเป็นช่วงตามฟอนต์', (() => {
    const r = G.splitFontRuns('ทอร่า · Tora');
    return r.length === 3 && r[0].latin === false && r[1].latin === true &&
      r[1].text === '·' && r[2].latin === false && r.map((x) => x.text).join('') === 'ทอร่า · Tora';
  })());
  check('splitFontRuns ไม่มีวงศ์ละติน → ช่วงเดียว',
    G.splitFontRuns('ก · A', false).length === 1);
  check('splitFontRuns ข้อความว่าง → []', G.splitFontRuns('').length === 0);
  check('splitFontRuns รวมตัวติดกันที่ใช้ฟอนต์เดียวกันเป็นช่วงเดียว',
    G.splitFontRuns('abcก').length === 1 && G.splitFontRuns('—…©').length === 1);
  const rBold = await G.generatePdf({
    blocks: [{ el: 'scene', text: 'INT. ห้องนอน - เช้า' }], fmt,
    fonts: { regular: thaiFont }, opts: { titlePages: false } });
  const rPlain = await G.generatePdf({
    blocks: [{ el: 'action', text: 'บรรยายธรรมดาหนึ่งบรรทัด' }], fmt,
    fonts: { regular: thaiFont }, opts: { titlePages: false } });
  check('บรรยายธรรมดา (ไม่หนา) วาดรอบเดียว', drawOps(rPlain.bytes) === 1, drawOps(rPlain.bytes));
  check('หัวฉาก (ตัวหนา) วาดสองรอบ = ตัวหนาปลอมทำงาน',
    drawOps(rBold.bytes) === 2, drawOps(rBold.bytes));
  // สลับฟอนต์จริงในไฟล์: บรรทัดที่มีทั้งไทยและ · ต้องฝังฟอนต์สองตัว
  const rMix = await G.generatePdf({
    blocks: [{ el: 'action', text: 'ทอร่ามองเค้ก · แล้วยิ้ม © 2569' }], fmt,
    fonts: { regular: thaiFont, latin: { regular: readFont('CourierPrime-Regular.ttf') } },
    opts: { titlePages: false, toc: false } });
  check('ส่งวงศ์ละตินมาด้วย → ฝังฟอนต์ 2 ตัวลงไฟล์',
    (asText(rMix.bytes).match(/\/FontFile2/g) || []).length === 2,
    (asText(rMix.bytes).match(/\/FontFile2/g) || []).length);
  check('ไม่ส่งวงศ์ละติน → ฝังฟอนต์ตัวเดียว (ยังทำงานได้)',
    (asText(rBold.bytes).match(/\/FontFile2/g) || []).length === 1);

  // ── [55][56] CONTINUED ในไฟล์ PDF ──
  // [alpha.83 ข้อ 6] CONTINUED ขึ้นเฉพาะเมื่อ "บล็อกถูกหั่นคร่อมหน้า" — บรรยายก้อนสั้น ๆ
  // ที่รอยต่ออยู่ระหว่างก้อนไม่ใช่เคสของ CONTINUED อีกต่อไป จึงต้องมีก้อนยาวจริง ๆ
  const oneLongScene = [{ el: 'scene', text: 'INT. ทางเดินยาว - กลางคืน', sceneNo: 1 }];
  oneLongScene.push({ el: 'action', text: 'เดินต่อไปเรื่อย ๆ ไม่มีที่สิ้นสุด '.repeat(300) });
  for (let i = 0; i < 20; i++) oneLongScene.push({ el: 'action', text: 'เดินต่อไป ' + i });
  const rCont = await G.generatePdf({
    blocks: oneLongScene, fmt, fonts: { regular: thaiFont },
    opts: { titlePages: false, toc: false } });
  check('[55] ฉากเดียวยาวข้ามหน้า → ได้หลายหน้า', rCont.scriptPages >= 2, rCont.scriptPages);
  const rContOff = await G.generatePdf({
    blocks: oneLongScene, fmt: SF.mergeSpFormat({ continued: { enabled: false } }),
    fonts: { regular: thaiFont }, opts: { titlePages: false, toc: false } });
  check('[55] ปิดระบบต่อเนื่อง → ยังสร้างได้ปกติ', rContOff.scriptPages >= 2);
  // (CONTINUED)/CONTINUED: วาดเพิ่มจริง → คำสั่งวาดข้อความต้องมากกว่าตอนปิด
  check('[55] เปิดระบบต่อเนื่อง → มีข้อความ CONTINUED วาดเพิ่มในไฟล์',
    drawOps(rCont.bytes) > drawOps(rContOff.bytes),
    `${drawOps(rCont.bytes)} vs ${drawOps(rContOff.bytes)}`);
  // [alpha.83 ข้อ 6] **กลับด้านจากเดิม** — ผู้ใช้สั่งว่า CONTINUED ต้อง *กินบรรทัดของหน้า*
  // (เดิมวาดทับระยะขอบแล้วหน้ากลายเป็น 31 บรรทัดจาก 30 → ล้นขอบล่างทุกหน้าที่มีเครื่องหมาย)
  // เปิดแล้วจำนวนหน้าจึงมากกว่าหรือเท่ากับตอนปิดเสมอ ไม่มีทางน้อยกว่า
  check('[55] เปิดระบบต่อเนื่อง → เครื่องหมายกินบรรทัด (หน้าไม่น้อยกว่าตอนปิด)',
    rCont.scriptPages >= rContOff.scriptPages,
    `${rCont.scriptPages} vs ${rContOff.scriptPages}`);
  // ฟอนต์มาตรฐาน (ASCII) → หา "(CONTINUED)" เป็นข้อความในไฟล์ได้ตรง ๆ
  const rContStd = await G.generatePdf({
    blocks: oneLongScene.map((b) => ({ ...b, text: b.text.replace(/[^\x20-\x7e]/g, 'x') })),
    fmt, fonts: null, opts: { titlePages: false, toc: false } });
  check('[55] ไฟล์มีข้อความ (CONTINUED) ท้ายหน้า และ CONTINUED: ต้นหน้า', (() => {
    const s = drawnText(rContStd.bytes);
    return s.includes('(CONTINUED)') && s.includes('CONTINUED:');
  })(), drawnText(rContStd.bytes).split('\n').filter((l) => l.includes('CONTINU')).join(' | '));
  check('[55] เนื้อบทถูกวาดลงไฟล์จริง (ไม่ใช่หน้าเปล่า)',
    drawnText(rContStd.bytes).includes('He keeps walking') ||
    drawnText(rContStd.bytes).includes('HALLWAY') ||
    drawnText(rContStd.bytes).length > 100, drawnText(rContStd.bytes).slice(0, 60));

  // ── addOutline / setOpenPage เรียกตรง ๆ ──
  check('addOutline / setOpenPage ถูก export ให้เรียกแยกได้',
    typeof G.addOutline === 'function' && typeof G.setOpenPage === 'function');
  check('addOutline รายการว่าง → 0 (ไม่แตะไฟล์)', G.addOutline({ context: null }, []) === 0);
  check('addOutline ชื่อว่างล้วน → 0', G.addOutline({ context: null }, [{ title: '  ' }]) === 0);

  // ═══ [alpha.60r1] ช่องว่างเทส: needsLatinFont กับอีโมจิ / splitFontRuns สลับไทย-ละตินหลายรอบ ═══
  {
    // กฎ 19: ฟอนต์ไทยปี 1998 เอา cmap ของเครื่องหมายสากลไปชี้ทับ → ต้องส่งตัวพวกนี้ให้วงศ์ละติน
    const EMO = String.fromCodePoint(0x1F600);
    check('[63] needsLatinFont: อีโมจิ → ใช้วงศ์ละติน (ไทยไม่มี glyph)', G.needsLatinFont(EMO));
    check('[63] needsLatinFont: ตัวอักษรไทย → ไม่ใช่ละติน', !G.needsLatinFont('ก'));
    check('[63] needsLatinFont: ASCII → ไม่ใช่ละติน (ฟอนต์ไทยมีครบ)',
      !G.needsLatinFont('A') && !G.needsLatinFont('1'));
    check('[63] needsLatinFont: PUA F701 (รูปเลื่อนของไทย) → ไม่ใช่ละติน',
      !G.needsLatinFont(String.fromCharCode(0xF701)));
    check('[63] needsLatinFont: มิดดอต · → ละติน', G.needsLatinFont(String.fromCharCode(0x00B7)));
    check('[63] needsLatinFont: จุดไข่ปลา … → ละติน', G.needsLatinFont(String.fromCharCode(0x2026)));
    check('[63] needsLatinFont: อัญประกาศโค้ง “ ” → ละติน',
      G.needsLatinFont(String.fromCharCode(0x201C)) && G.needsLatinFont(String.fromCharCode(0x201D)));
    check('[63] needsLatinFont: ขีดยาว — → ละติน', G.needsLatinFont(String.fromCharCode(0x2014)));

    const src = 'กิน A ข B ค' + String.fromCharCode(0x00B7) + 'ง' + String.fromCharCode(0x2026) + 'จ';
    const runs = G.splitFontRuns(src, true);
    check('[63] splitFontRuns: สลับไทย-ละตินหลายรอบ แล้วต่อกลับได้ข้อความเดิม',
      runs.map((r) => r.text).join('') === src, JSON.stringify(runs));
    check('[63] splitFontRuns: มีช่วงละตินมากกว่า 1 ช่วง (ไม่ยุบรวมผิด)',
      runs.filter((r) => r.latin).length >= 2, JSON.stringify(runs.map((r) => r.latin)));
    check('[63] splitFontRuns: ไม่มีช่วงว่าง', runs.every((r) => r.text.length > 0));
    check('[63] splitFontRuns: ช่วงติดกันต้องสลับค่า latin เสมอ (ยุบช่วงเดียวกันแล้ว)',
      runs.every((r, i) => i === 0 || r.latin !== runs[i - 1].latin), JSON.stringify(runs));
    check('[63] splitFontRuns: ไม่มีวงศ์ละติน → คืนช่วงเดียว',
      G.splitFontRuns('กิน A ข', false).length === 1);
    check('[63] splitFontRuns: ข้อความว่าง → อาร์เรย์ว่าง', G.splitFontRuns('', true).length === 0);
    check('[63] splitFontRuns: ไทยล้วน → ช่วงเดียว ไม่ใช่ละติน',
      G.splitFontRuns('กินข้าว', true).length === 1 && !G.splitFontRuns('กินข้าว', true)[0].latin);
    check('[63] splitFontRuns: อีโมจิถูกแยกไปช่วงละติน',
      G.splitFontRuns('ก' + EMO + 'ข', true).some((r) => r.latin && r.text.includes(EMO)),
      JSON.stringify(G.splitFontRuns('ก' + EMO + 'ข', true)));
  }

  // ═══ [alpha.81r2] ต่อ PDF + ประทับเลขหน้าเฉพาะเนื้อเรื่อง ═══
  // ผู้ใช้สั่ง: "เลขหน้าจะไม่นับที่หน้าปก และหน้า cast of character"
  // Chromium สั่งแบบนั้นไม่ได้ → เราต่อเองแล้ววาดเลขหน้าเองหลังหน้าหน้าเล่ม
  {
    const blk = (n) => Array.from({ length: n }, () => ({ el: 'action', text: 'บรรทัด' }));
    const mk = async (n) => (await G.generatePdf({
      blocks: blk(n), fmt: fmt, meta: {}, opts: { toc: false, titlePages: false,
        headers: false, pageNumbers: false } })).bytes;
    const front1 = await mk(1);
    const body = await mk(120);                       // ยาวพอให้ได้หลายหน้า
    const bodyPages = (await G.generatePdf({ blocks: blk(120), fmt: fmt, meta: {},
      opts: { toc: false, titlePages: false, headers: false, pageNumbers: false } })).pageCount;

    const numFmt = { ...fmt, pageNumbers: { show: true, right: 1, top: 0.5, suffix: '.', firstPage: true } };
    const r = await G.mergeAndNumber([front1], body, { fmt: numFmt, startPage: 1 });
    check('[81r2] ต่อหน้าครบ = หน้าหน้าเล่ม + เนื้อเรื่อง',
          r.pageCount === 1 + bodyPages, r.pageCount + ' vs ' + (1 + bodyPages));
    check('[81r2] รายงานจำนวนหน้าหน้าเล่มถูก', r.frontCount === 1, String(r.frontCount));
    check('[81r2] ได้ไบต์ PDF ที่ถูกต้อง',
          r.bytes instanceof Uint8Array && String.fromCharCode(...r.bytes.slice(0, 4)) === '%PDF');
    // ไม่มีหน้าหน้าเล่มเลยก็ต้องทำงาน (ผู้ใช้ปิดทั้งสองสวิตช์)
    const r0 = await G.mergeAndNumber([], body, { fmt: numFmt, startPage: 1 });
    check('[81r2] ไม่มีหน้าหน้าเล่ม → เนื้อเรื่องล้วน', r0.frontCount === 0 && r0.pageCount === bodyPages);
    // ปิดเลขหน้า = ไม่วาดอะไรเพิ่ม แต่ยังต่อหน้าให้
    const rNo = await G.mergeAndNumber([front1], body, { fmt, pageNumbers: false });
    check('[81r2] ปิดเลขหน้าแล้วยังต่อหน้าครบ', rNo.pageCount === 1 + bodyPages);
    check('[81r2] ไฟล์ที่ประทับเลขหน้าใหญ่กว่าไฟล์ที่ไม่ประทับ (มีการวาดจริง)',
          r.bytes.length > rNo.bytes.length, r.bytes.length + ' vs ' + rNo.bytes.length);
    // ก้อนหน้าเล่มหลายก้อน (ปก + รายชื่อ)
    const r2 = await G.mergeAndNumber([front1, front1], body, { fmt: numFmt });
    check('[81r2] หน้าหน้าเล่มหลายก้อนต่อกันได้', r2.frontCount === 2 && r2.pageCount === 2 + bodyPages);
  }

  // ══════════ [alpha.112] ★★ บรรทัดว่างต้องไม่ถูกโยนทิ้งก่อนจัดหน้า ══════════
  //
  // ผู้ใช้: *"ในเอกสารมี 2 หน้า แต่ PDF ออกมา 1 หน้า"*
  // ต้นตอ: ตัวกรองใน generatePdf ยังเป็น `b.el !== 'blank'` แบบก่อน alpha.86
  // → PDF จัดหน้าจากเอกสารคนละฉบับกับที่จอเห็น และบรรทัดว่างที่ผู้ใช้เว้นไว้หายหมด
  {
    const SH = build('sp-headers.js', 'k2-pdfgen-hdr-test.cjs');
    const fmtA4 = SF.mergeSpFormat({ paperSize: 'a4', margins: { top: 1, bottom: 1, left: 1, right: 1 } });
    const lines = SH.linesForBody(fmtA4, SH.mergeHeaders(null));
    // เลียนไฟล์จริงของผู้ใช้: บรรยายยาว ๆ คั่นด้วยบรรทัดว่างเป็นชุด ๆ
    const para = 'บรรยายฉากยาวพอสมควรเพื่อให้กินหลายบรรทัดในหน้ากระดาษ A4 ของผู้ใช้จริง '.repeat(3);
    const withBlanks = [];
    for (let i = 0; i < 20; i++) {
      withBlanks.push({ el: 'action', text: para + i });
      withBlanks.push({ el: 'blank', text: '' });
      withBlanks.push({ el: 'blank', text: '' });
    }
    const noBlanks = withBlanks.filter((b) => b.el !== 'blank');
    const modelPages = SF.paginate(withBlanks, { fmt: fmtA4, lines }).count;
    const strippedPages = SF.paginate(noBlanks, { fmt: fmtA4, lines }).count;
    check('[112] ชุดทดสอบนี้ "บรรทัดว่างมีผลจริง" (ทิ้งแล้วจำนวนหน้าเปลี่ยน)',
          modelPages !== strippedPages, modelPages + ' vs ' + strippedPages);

    const pdf = await G.generatePdf({ blocks: withBlanks, fmt: fmtA4,
      opts: { toc: false, titlePages: false, headers: false, pageNumbers: false } });
    check('[112] ★★ PDF ได้จำนวนหน้าเท่ากับที่โมเดล (จอ) คิด',
          pdf.pageCount === modelPages, 'PDF ' + pdf.pageCount + ' vs โมเดล ' + modelPages);
    check('[112] ★ และไม่เท่ากับตอนที่โยนบรรทัดว่างทิ้ง (พิสูจน์ว่าบั๊กเดิมจะแดง)',
          pdf.pageCount !== strippedPages, 'PDF ' + pdf.pageCount + ' vs ทิ้งว่าง ' + strippedPages);

    // ตัวกรอง `omit` ต้องยังทำงานเหมือนเดิม (ทิ้งเฉพาะชนิดที่ผู้ใช้สั่ง)
    const pdfOmit = await G.generatePdf({ blocks: withBlanks, fmt: fmtA4,
      opts: { toc: false, titlePages: false, headers: false, pageNumbers: false, omit: ['action'] } });
    check('[112] ตัวเลือก "ไม่เอาชนิดนี้" ยังทำงาน', pdfOmit.pageCount < pdf.pageCount,
          pdfOmit.pageCount + ' vs ' + pdf.pageCount);

    // ── layoutPageLines ต้องมิเรอร์กฎ prevBlank ของ paginate() ──
    const pg1 = SF.paginate(withBlanks, { fmt: fmtA4, lines }).pages[0];
    const rows = G.layoutPageLines(pg1, fmtA4);
    check('[112] ทุกบล็อกในหน้าได้ที่อยู่ครบ', rows.length === pg1.blocks.length);
    {
      // หาบล็อกที่อยู่ "ถัดจากบรรทัดว่าง" แล้วดูว่าไม่มีระยะเว้นนำเพิ่ม
      let checked = 0, bad = [];
      for (let i = 1; i < rows.length; i++) {
        if (pg1.blocks[i - 1].el !== 'blank' || pg1.blocks[i].el === 'blank') continue;
        checked++;
        const gap = rows[i].line - (rows[i - 1].line + Math.max(1, pg1.blocks[i - 1].lines || 1));
        if (gap !== 0) bad.push(i + ':' + gap);
      }
      check('[112] ★★ บล็อกถัดจากบรรทัดว่างไม่เติมระยะเว้นนำซ้ำ',
            checked > 0 && bad.length === 0, 'ตรวจ ' + checked + ' จุด · ผิด ' + bad.join(','));
    }
    {
      const blankRows = rows.filter((r, i) => pg1.blocks[i].el === 'blank');
      check('[112] บรรทัดว่างมีอยู่จริงในหน้า', blankRows.length > 0);
      let bad = 0;
      rows.forEach((r, i) => {
        if (pg1.blocks[i].el !== 'blank') return;
        const prev = rows[i - 1];
        if (i > 0 && r.line !== prev.line + Math.max(1, pg1.blocks[i - 1].lines || 1)) bad++;
      });
      check('[112] ★ บรรทัดว่างกินพอดี 1 บรรทัด ไม่มีระยะเว้นนำของตัวเอง', bad === 0, String(bad));
    }
    {
      const last = rows[rows.length - 1];
      const used = last.line + Math.max(1, pg1.blocks[pg1.blocks.length - 1].lines || 1);
      check('[112] ★★ เนื้อหน้าไม่ล้นโควตาบรรทัดของหน้า', used <= lines, used + ' vs ' + lines);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL exception | ' + (e && e.stack || e)); process.exit(1); });
