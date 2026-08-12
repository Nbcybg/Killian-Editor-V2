// test/sp-export.test.cjs — unit test ส่งออก FDX (67) / RTF (68) / PDF ลายน้ำ (70)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name + '-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const FDX = load('export-fdx');
const RTF = load('export-rtf');
const WM = load('export-watermark');
const SF = load('sp-format');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const B = (el, text) => ({ el, text });
const script = [
  B('scene', 'INT. ห้องครัว - กลางวัน'),
  B('blank', ''),
  B('action', 'ทอร่ายืนนิ่ง **มองออกไป**'),
  B('character', 'ทอร่า'),
  B('parenthetical', '(กระซิบ)'),
  B('dialogue', 'ฉันไม่ได้ตั้งใจ'),
  B('transition', 'CUT TO:'),
];

// ═════════ 67. FDX ═════════
{
  const xml = FDX.generateFdx(script, { title: 'บททดสอบ', author: 'ท็อป' });
  check('[67] ขึ้นต้นด้วย XML declaration', xml.startsWith('<?xml version="1.0"'));
  check('[67] มีรากเป็น FinalDraft DocumentType="Script"', xml.includes('<FinalDraft DocumentType="Script"'));
  check('[67] มีบล็อก <Content>', xml.includes('<Content>') && xml.includes('</Content>'));
  check('[67] ปิดแท็กรากถูกต้อง', xml.trim().endsWith('</FinalDraft>'));
  check('[67] หัวฉาก → Type="Scene Heading"', xml.includes('<Paragraph Type="Scene Heading"'));
  // [alpha.60r1] หัวฉากต้องพกเลขฉากไปด้วย (FD เก็บที่ attribute Number)
  check('[67] หัวฉากมีเลขฉาก Number="1"', xml.includes('<Paragraph Type="Scene Heading" Number="1">'), xml.slice(0, 400));
  {
    const two = FDX.generateFdx([B('scene', 'INT. A - DAY'), B('action', 'x'), B('scene', 'EXT. B - NIGHT')], {});
    check('[67] เลขฉากไล่ต่อกัน 1,2', two.includes('Number="1"') && two.includes('Number="2"'));
    const from5 = FDX.generateFdx([B('scene', 'INT. A - DAY')], {}, { startScene: 5 });
    check('[67] ตั้งเลขฉากเริ่มต้นได้ (startScene)', from5.includes('Number="5"'));
    const own = FDX.generateFdx([Object.assign(B('scene', 'INT. A - DAY'), { sceneNo: '12A' })], {});
    check('[67] เลขฉากที่บล็อกพกมาเองชนะการไล่นับ', own.includes('Number="12A"'));
  }
  check('[67] ตัวละคร → Type="Character"', xml.includes('<Paragraph Type="Character">'));
  check('[67] วงเล็บ → Type="Parenthetical"', xml.includes('<Paragraph Type="Parenthetical">'));
  check('[67] บทพูด → Type="Dialogue"', xml.includes('<Paragraph Type="Dialogue">'));
  check('[67] ทรานซิชัน → Type="Transition"', xml.includes('<Paragraph Type="Transition">'));
  check('[67] ข้ามบรรทัดว่าง (blank) ไม่ให้กลายเป็นย่อหน้าเปล่า',
    (xml.match(/<Paragraph /g) || []).length === 6 + 3, (xml.match(/<Paragraph /g) || []).length);
  check('[67] ข้อความไทยอยู่ครบ ไม่ถูกแปลง', xml.includes('ฉันไม่ได้ตั้งใจ'));
  check('[67] ตัดเครื่องหมาย **หนา** ของ Markdown ออก',
    xml.includes('มองออกไป') && !xml.includes('**'));
  check('[67] มีหน้าปก (TitlePage) เมื่อมีชื่อเรื่อง', xml.includes('<TitlePage>') && xml.includes('บททดสอบ'));
  check('[67] ไม่มีชื่อเรื่อง → ไม่ใส่ TitlePage', !FDX.generateFdx(script, {}).includes('<TitlePage>'));
  // [alpha.60r1] หน้าปกที่ผู้ใช้แต่งเอง (ข้อ 90) ต้องชนะหน้าปกอัตโนมัติจาก meta
  {
    const tp = [{ strings: [
      { text: 'ชื่อที่ผู้ใช้ตั้งเอง', x: 1.5, y: 4, align: 'center' },
      { text: 'บรรทัดบนสุด', x: 1.5, y: 1, align: 'left' },
    ] }];
    const cx = FDX.generateFdx(script, { title: 'บททดสอบ' }, { titlePages: tp });
    check('[67] ใช้หน้าปกที่ผู้ใช้แต่งเอง', cx.includes('ชื่อที่ผู้ใช้ตั้งเอง') && !cx.includes('บททดสอบ'));
    check('[67] หน้าปกเรียงตาม y (บนก่อนล่าง)',
      cx.indexOf('บรรทัดบนสุด') < cx.indexOf('ชื่อที่ผู้ใช้ตั้งเอง'));
    check('[67] หน้าปกเก็บการจัดหน้าไว้', cx.includes('Alignment="Left"') && cx.includes('Alignment="Center"'));
  }

  check('[67] escapeXml แปลง & < > " \' ครบ',
    FDX.escapeXml('a&b<c>d"e\'f') === 'a&amp;b&lt;c&gt;d&quot;e&apos;f', FDX.escapeXml('a&b<c>d"e\'f'));
  check('[67] escapeXml ตัดอักขระควบคุมที่ XML ไม่รับ',
    FDX.escapeXml('a' + String.fromCharCode(7) + 'b') === 'ab');
  check('[67] เนื้อหาที่มี & ถูก escape ในผลลัพธ์จริง',
    FDX.generateFdx([B('action', 'ทอม & เจอร์รี่')], {}).includes('ทอม &amp; เจอร์รี่'));
  check('[67] fdxType ชนิดที่ Final Draft ไม่มี → Action',
    FDX.fdxType('note') === 'Action' && FDX.fdxType('outline1') === 'Action' && FDX.fdxType('zzz') === 'Action');
  check('[67] ทุก element ของโปรแกรมมีที่ลงใน FDX',
    SF.SP_ELEMENT_KEYS.every((k) => !!FDX.FDX_TYPE_MAP[k]),
    SF.SP_ELEMENT_KEYS.filter((k) => !FDX.FDX_TYPE_MAP[k]).join(','));
  check('[67] บทว่างยังได้ XML ที่ถูกต้อง',
    FDX.generateFdx([], {}).includes('<Content>') && FDX.generateFdx([], {}).includes('</FinalDraft>'));
}

// ═════════ 68. RTF ═════════
{
  const rtf = RTF.generateRtf(script, { title: 'บททดสอบ', author: 'ท็อป' });
  check('[68] ขึ้นต้น {\\rtf1\\ansi', rtf.startsWith('{\\rtf1\\ansi'));
  check('[68] ปิดวงเล็บปีกกาครบ', rtf.trim().endsWith('}'));
  check('[68] วงเล็บปีกกาเปิด-ปิดสมดุล', (() => {
    let d = 0;
    for (let i = 0; i < rtf.length; i++) {
      if (rtf[i] === '\\') { i++; continue; }
      if (rtf[i] === '{') d++; else if (rtf[i] === '}') d--;
    }
    return d === 0;
  })());
  check('[68] มีตารางฟอนต์ Courier', rtf.includes('\\fonttbl') && rtf.includes('Courier Prime'));
  check('[68] ขนาดฟอนต์ 12pt (\\fs24)', rtf.includes('\\fs24'));
  check('[68] ขนาดกระดาษ Letter = 12240 x 15840 twips',
    rtf.includes('\\paperw12240') && rtf.includes('\\paperh15840'));
  check('[68] ระยะขอบซ้าย 1.5 นิ้ว = 2160 twips', rtf.includes('\\margl2160'));
  check('[68] ภาษาไทยถูกแปลงเป็น \\uNNNN? ไม่ใช่ไบต์ดิบ',
    /\\u3617\?/.test(rtf) || /\\u\d{4}\?/.test(rtf));
  check('[68] ไม่มีอักขระ >127 หลงเหลือในไฟล์ (ANSI ล้วน)',
    [...rtf].every((c) => c.codePointAt(0) < 128),
    [...rtf].filter((c) => c.codePointAt(0) >= 128).slice(0, 5).join(''));
  check('[68] escapeRtf หนี \\ { } ถูกต้อง',
    RTF.escapeRtf('a\\b{c}d') === 'a\\\\b\\{c\\}d', RTF.escapeRtf('a\\b{c}d'));
  check('[68] escapeRtf ขึ้นบรรทัดใหม่ → \\line', RTF.escapeRtf('a\nb') === 'a\\line b');
  check('[68] escapeRtf อักขระนอก BMP (อีโมจิ) → surrogate pair 2 ตัว',
    (RTF.escapeRtf('😀').match(/\\u-?\d+\?/g) || []).length === 2, RTF.escapeRtf('😀'));
  check('[68] อักขระเกิน 32767 เขียนเป็นเลขติดลบตามสเปก',
    RTF.escapeRtf(String.fromCharCode(40000)).includes('\\u-25536?'), RTF.escapeRtf(String.fromCharCode(40000)));
  check('[68] ตัวละครถูกทำเป็นตัวพิมพ์ใหญ่ตามสไตล์ตอนพิมพ์',
    RTF.generateRtf([B('character', 'tora')], {}).includes('TORA'));
  check('[68] หัวฉากใช้ \\keepn (ไม่ค้างท้ายหน้าเดี่ยว ๆ)',
    RTF.paraCtrl('scene', null).ctrl.includes('\\keepn'));
  check('[68] ทรานซิชันชิดขวา (\\qr)', RTF.paraCtrl('transition', null).ctrl.includes('\\qr'));
  check('[68] บทพูดเยื้อง 1 นิ้ว = \\li1440', RTF.paraCtrl('dialogue', null).ctrl.includes('\\li1440'),
    RTF.paraCtrl('dialogue', null).ctrl);
  check('[68] ตัวละครเยื้อง 2.2 นิ้ว = \\li3168', RTF.paraCtrl('character', null).ctrl.includes('\\li3168'),
    RTF.paraCtrl('character', null).ctrl);
  // [alpha.60r1] \sb ต้องเท่ากับ "จำนวนบรรทัดว่าง" ที่ paginate() นับ (หัวฉาก 2 · บรรยาย/ตัวละคร 1 · บทพูด 0)
  // เดิมลบออก 1 บรรทัดทุกตัว ทำให้ RTF แน่นกว่าจอ/PDF (ชื่อตัวละครติดบรรยาย)
  check('[68] หัวฉากเว้น 2 บรรทัดก่อน (\\sb480)', RTF.paraCtrl('scene', null).ctrl.includes('\\sb480'),
    RTF.paraCtrl('scene', null).ctrl);
  check('[68] บรรยายเว้น 1 บรรทัดก่อน (\\sb240)', RTF.paraCtrl('action', null).ctrl.includes('\\sb240'),
    RTF.paraCtrl('action', null).ctrl);
  check('[68] ตัวละครเว้น 1 บรรทัดก่อน (\\sb240)', RTF.paraCtrl('character', null).ctrl.includes('\\sb240'));
  check('[68] วงเล็บไม่เว้นบรรทัดก่อน', !RTF.paraCtrl('parenthetical', null).ctrl.includes('\\sb'));
  check('[68] บทพูดไม่เว้นบรรทัดก่อน (ไม่มี \\sb)', !RTF.paraCtrl('dialogue', null).ctrl.includes('\\sb'));
  {
    // keepNext อ่านจาก SP_ELEMENT_CONFIG ตอนรัน — ตั้งทับได้โดยไม่ต้องแก้ export-rtf
    const f = SF.mergeSpFormat({ elements: { action: { keepNext: true }, scene: { keepNext: false } } });
    check('[68] ตั้ง keepNext ของบรรยาย → ได้ \\keepn', RTF.paraCtrl('action', f).ctrl.includes('\\keepn'));
    check('[68] ปิด keepNext ของหัวฉาก → ไม่มี \\keepn', !RTF.paraCtrl('scene', f).ctrl.includes('\\keepn'));
  }
  check('[68] มีหน้าปกแล้วขึ้นหน้าใหม่ (\\page)', rtf.includes('\\page'));
  {
    // [alpha.60r1] RTF ก็ต้องใช้หน้าปกที่ผู้ใช้แต่งเอง ไม่ใช่สร้างจาก meta อย่างเดียว
    const tp = [{ strings: [{ text: 'ปกที่ตั้งเอง', x: 1.5, y: 4, align: 'center', size: 18, bold: true }] }];
    const r2 = RTF.generateRtf(script, { title: 'บททดสอบ' }, null, { titlePages: tp });
    check('[68] ใช้หน้าปกที่ผู้ใช้แต่งเอง', r2.includes(RTF.escapeRtf('ปกที่ตั้งเอง')));
    check('[68] หน้าปกที่ตั้งเองชนะหน้าปกจาก meta', !r2.includes(RTF.escapeRtf('บททดสอบ')));
    check('[68] หน้าปกที่ตั้งเองจบด้วย \\page', r2.includes('\\page'));
    check('[68] ขนาดตัวอักษรบนหน้าปกเป็น \\fs36 (18pt)', r2.includes('\\fs36'));
    check('[68] RTF ยังเป็น ASCII ล้วนแม้มีหน้าปกไทย', [...r2].every((c) => c.codePointAt(0) < 128));
  }
  check('[68] ไม่มีชื่อเรื่อง → ไม่มีหน้าปก', !RTF.generateRtf(script, {}).includes('\\page'));
  check('[68] เปลี่ยนขนาดกระดาษเป็น A4 → \\paperw ตาม',
    RTF.generateRtf(script, {}, SF.mergeSpFormat({ paperSize: 'a4' })).includes('\\paperw11909'),
    RTF.generateRtf(script, {}, SF.mergeSpFormat({ paperSize: 'a4' })).slice(0, 260));
  check('[68] inTw: 1 นิ้ว = 1440 twips', RTF.inTw(1) === 1440 && RTF.inTw(1.5) === 2160);
}

// ═════════ 70. PDF ลายน้ำ ═════════
{
  const pages = SF.paginate(script, {});
  const html = WM.buildWatermarkHtml(pages, null, { watermark: 'สมชาย (สำเนา 1)', title: 'บททดสอบ' });
  check('[70] เป็นเอกสาร HTML สมบูรณ์', html.startsWith('<!doctype html>') && html.includes('</html>'));
  check('[70] ระบุ charset utf-8 (ภาษาไทยไม่เพี้ยน)', html.includes('<meta charset="utf-8">'));
  check('[70] มี @page ตามขนาดกระดาษ', html.includes('@page{size:8.5in 11in'));
  check('[70] มี CSS ของ element บท (มาจาก spCss)', html.includes('.sp.sp-character{'));
  check('[70] มีหน้าเท่าจำนวนที่ paginate ให้',
    (html.match(/<section class="pg"/g) || []).length === pages.count, pages.count);
  check('[70] ทุกหน้าขึ้นหน้าใหม่ (page-break-after)', html.includes('page-break-after:always'));
  check('[70] ลายน้ำปรากฏในทุกหน้า',
    (html.match(/class="wm"/g) || []).length === pages.count);
  check('[70] ข้อความลายน้ำถูกใส่จริง', html.includes('สมชาย (สำเนา 1)'));
  check('[70] ลายน้ำเอียงตามค่าเริ่มต้น -35 องศา', html.includes('rotate(-35deg)'));
  check('[70] ลายน้ำสั่งพิมพ์สีจริง (print-color-adjust)', html.includes('print-color-adjust:exact'));
  check('[70] ไม่ใส่ลายน้ำ → ไม่มี div.wm',
    !WM.buildWatermarkHtml(pages, null, {}).includes('class="wm"'));
  check('[70] escape HTML ในเนื้อบท (กัน < > หลุดเป็นแท็ก)',
    WM.buildWatermarkHtml(SF.paginate([B('action', 'a <b> & c')], {}), null, {}).includes('a &lt;b&gt; &amp; c'));
  check('[70] ปรับสี/ขนาด/มุมของลายน้ำได้',
    WM.buildWatermarkHtml(pages, null, { watermark: 'x', wmOptions: { angle: -90, fontSize: 20 } })
      .includes('rotate(-90deg)'));

  check('[70] watermarkText แทน {ชื่อ}', WM.watermarkText('{ชื่อ}', { name: 'สมชาย' }) === 'สมชาย');
  check('[70] watermarkText แทนหลายตัวแปร',
    WM.watermarkText('{ชื่อ} · {date}', { name: 'ก', date: '2026-08-02' }) === 'ก · 2026-08-02');
  check('[70] watermarkText แม่แบบว่าง → ใช้ชื่อ', WM.watermarkText('', { name: 'ข' }) === 'ข');
  check('[70] safeFileName ตัดอักขระต้องห้าม',
    WM.safeFileName('a/b:c*d?e"f<g>h|i') === 'abcdefghi', WM.safeFileName('a/b:c*d?e"f<g>h|i'));
  check('[70] safeFileName ว่าง → มีชื่อสำรอง', WM.safeFileName('   ') === 'ไม่มีชื่อ');

  const rs = WM.parseRecipients('สมชาย\nสมหญิง | สำเนาสำหรับผู้กำกับ\n\n# หมายเหตุ\n  ');
  check('[70] parseRecipients อ่านได้ 2 คน (ข้ามบรรทัดว่าง/คอมเมนต์)', rs.length === 2, JSON.stringify(rs));
  check('[70] ไม่ระบุลายน้ำ → ใช้ชื่อเป็นลายน้ำ', rs[0].watermark === 'สมชาย');
  check('[70] ระบุลายน้ำเองด้วย | ได้', rs[1].watermark === 'สำเนาสำหรับผู้กำกับ');
  check('[70] fontFaceCss ว่างเมื่อไม่ได้ส่ง URL ฟอนต์', WM.fontFaceCss(null) === '');
  check('[70] fontFaceCss สร้าง @font-face จาก URL ที่ให้',
    WM.fontFaceCss({ regular: 'file:///a.ttf', bold: 'file:///b.ttf' }).includes('@font-face') &&
    WM.fontFaceCss({ regular: 'file:///a.ttf' }).includes('file:///a.ttf'));
}

// ═════════ [alpha.60r1] ช่องว่างเทส: RTF ขนาดฟอนต์ != 12pt · FDX/RTF ที่มีแต่บรรทัดว่าง ═════════
{
  const r14 = RTF.generateRtf(script, {}, null, { fontPt: 14 });
  check('[68] ตั้งขนาดฟอนต์ 14pt → \\fs28 ทั้งหัวเอกสารและย่อหน้า',
    r14.includes('\\fs28') && !r14.includes('\\fs24'), r14.slice(0, 200));
  check('[68] ตั้งขนาดฟอนต์ 10pt → \\fs20', RTF.generateRtf(script, {}, null, { fontPt: 10 }).includes('\\fs20'));
  check('[68] ไม่ระบุขนาด → 12pt (\\fs24) เหมือนเดิม', RTF.generateRtf(script, {}).includes('\\fs24'));
  check('[68] rtfFs หนีบขนาดต่ำ/สูงเกิน', RTF.rtfFs(0) === 8 && RTF.rtfFs(500) === 192);
  check('[68] rtfFs ค่าที่ไม่ใช่ตัวเลข → 12pt', RTF.rtfFs('x') === 24 && RTF.rtfFs(null) === 24);
  check('[68] ขนาดฟอนต์ไม่ไปกวนระยะเยื้อง (\\li ยังเท่าเดิม)',
    RTF.paraCtrl('dialogue', null, 14).ctrl.includes('\\li1440'));

  // เนื้อหาที่มีแต่บรรทัดว่าง — ต้องได้เอกสารที่เปิดได้ ไม่ใช่ไฟล์พัง
  const blanks = [B('blank', ''), B('blank', ''), B('action', '   ')];
  const xmlBlank = FDX.generateFdx(blanks, {});
  check('[67] บล็อกว่างล้วน → ไม่มี <Paragraph> เลย', !xmlBlank.includes('<Paragraph '), xmlBlank);
  check('[67] บล็อกว่างล้วน → ยังเป็น XML ที่สมบูรณ์',
    xmlBlank.includes('<Content>') && xmlBlank.trim().endsWith('</FinalDraft>'));
  check('[67] blocks เป็น null → ไม่ throw', FDX.generateFdx(null, {}).includes('</FinalDraft>'));
  check('[67] บล็อกว่างล้วน + มีชื่อเรื่อง → ยังได้ TitlePage',
    FDX.generateFdx(blanks, { title: 'ก' }).includes('<TitlePage>'));
  const rtfBlank = RTF.generateRtf(blanks, {});
  check('[68] บล็อกว่างล้วน → RTF ยังปิดวงเล็บปีกกาครบ',
    rtfBlank.startsWith('{\\rtf1') && rtfBlank.trim().endsWith('}'));
  check('[68] บล็อกว่างล้วน → ไม่มีย่อหน้าเนื้อหา', !rtfBlank.includes('\\par'), rtfBlank.slice(-120));
}

// generateWatermarkedPDFs — ใช้ api ปลอม (ไม่แตะ Electron)
(async () => {
  const made = [];
  const api = {
    join: async (...a) => a.join('/'),
    pdfFromHtml: async (html, dest) => { made.push({ dest, len: html.length }); return true; },
  };
  const pages = SF.paginate(script, {});
  const prog = [];
  const out = await WM.generateWatermarkedPDFs(api, {
    pages, fmt: null, outDir: '/out', prefix: 'บททดสอบ',
    recipients: WM.parseRecipients('สมชาย\nสมหญิง | ฉบับผู้กำกับ'),
    onProgress: (i, n, name) => prog.push(i + '/' + n + ':' + name),
  });
  check('[70] สร้างไฟล์ครบทุกคน', out.length === 2, JSON.stringify(out));
  check('[70] ชื่อไฟล์มีทั้ง prefix และชื่อผู้รับ',
    out[0].endsWith('บททดสอบ_สมชาย.pdf'), out[0]);
  check('[70] แต่ละคนได้ HTML คนละชุด (ลายน้ำต่างกัน)',
    made.length === 2 && made[0].len !== made[1].len);
  check('[70] รายงานความคืบหน้าครบทุกขั้น', prog.length === 2 && prog[1] === '2/2:สมหญิง', prog.join(' '));
  check('[70] ไม่มีผู้รับ → ไม่สร้างไฟล์',
    (await WM.generateWatermarkedPDFs(api, { pages, recipients: [], outDir: '/out' })).length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
