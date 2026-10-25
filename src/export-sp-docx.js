// export-sp-docx.js — [trial 2026-10-25 ข้อ 5] DOCX ของ "บทภาพยนตร์" (รูปแบบบทจริง ไม่ใช่เอกสารนิยาย)
//
// ผู้ใช้เจอ (เปิดไฟล์อ่านจริง): บทภาพยนตร์ที่ส่งออกเป็น DOCX ได้เอกสารแบบนิยาย — ฟอนต์หนังสือตัวเดียว
// ไม่มีเยื้องชื่อตัวละคร/บทพูด ไม่ใช่ Courier ไม่มีเลขหน้า หัวฉากเป็น Heading 3 (ขณะที่ PDF/FDX ถูกต้อง)
// ต้นตอ: ศูนย์ส่งออกส่งมาร์กดาวน์ของบทเข้า `buildDocx()` ของนิยายตรง ๆ
//
// ตัวนี้รับ **บล็อกจาก `parseScript()`** (ตัวอ่านบทตัวเดียวกับ PDF/RTF/FDX) แล้ววางย่อหน้าด้วยค่าเยื้อง/
// ความกว้าง/ระยะเว้นจาก `mergeSpFormat()` — คู่แฝดของ `generateRtf()` (export-rtf.js) ทุกค่า
// บริสุทธิ์ 100% (unit `sp-docx`) · คืนรายการไฟล์ในแพ็กเกจ แล้วให้ export-hub.js อัดซิปเอง (ทางเดียวกับ buildDocx)
import { mergeSpFormat, textWidth } from './sp-format.js';
import { normalizeTitlePages } from './sp-title-pages.js';
import { plainText } from './export-rtf.js';
import { xmlEsc } from './export-ebook.js';
import { num } from './num.js';

const TW = 1440;                                   // twips ต่อนิ้ว
const tw = (inch) => Math.round(num(inch, 0) * TW);
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const safeFont = (f, d) => String(f || d).replace(/["<>&]/g, '').trim() || d;

/** ย่อหน้าของหนึ่ง element — ค่าเดียวกับ `paraCtrl()` ของ RTF (นิ้วจากขอบกระดาษ → เยื้องจากขอบพื้นที่พิมพ์) */
export function spParaProps(el, fmt, linePt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const c = f.elements[el] || f.elements.action;
  const st = (f.styles[el] || f.styles.action).print;
  const width = textWidth(f.paper, f.margins);
  const li = Math.max(0, num(c.indent, 0) - f.margins.left);
  const ri = Math.max(0, width - li - num(c.width, width));
  // `linesBefore` = จำนวนบรรทัดว่างก่อนบล็อก × 10 (ตัวเดียวกับที่ paginate()/RTF นับ)
  const before = Math.max(0, Math.round(num(c.linesBefore, 10) / 10)) * Math.round(num(linePt, 12) * 20);
  return { li: tw(li), ri: tw(ri), before, keepNext: c.keepNext === true,
           right: el === 'transition', bold: !!st.bold, italic: !!st.italic,
           underline: !!st.underline, caps: !!st.caps };
}

function runXml(text, p) {
  const rp = [];
  if (p && p.bold) rp.push('<w:b/><w:bCs/>');
  if (p && p.italic) rp.push('<w:i/><w:iCs/>');
  if (p && p.underline) rp.push('<w:u w:val="single"/>');
  if (p && p.size) rp.push(`<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>`);
  const rPr = rp.length ? `<w:rPr>${rp.join('')}</w:rPr>` : '';
  return String(text).split('\n').map((line, i) =>
    (i ? `<w:r>${rPr}<w:br/></w:r>` : '') + (line ? `<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r>` : '')).join('');
}

/** หน้าปกที่ผู้ใช้แต่งเอง → ย่อหน้าเรียงตาม y (DOCX ไม่มีกล่องลอยที่ทุกโปรแกรมเปิดได้ — ทางเดียวกับ RTF) · DOCX ของนิยายใช้ด้วย */
export function titlePageParas(pages, f) {
  const out = [];
  const width = textWidth(f.paper, f.margins);
  pages.forEach((p, pi) => {
    const rows = (p.strings || []).filter((s) => String(s.text ?? '').trim() !== '')
      .slice().sort((a, b) => num(a.y, 0) - num(b.y, 0) || num(a.x, 0) - num(b.x, 0));
    let prevY = f.margins.top;
    rows.forEach((s, i) => {
      const li = Math.max(0, num(s.x, f.margins.left) - f.margins.left);
      const w = num(s.width, 0) > 0 ? num(s.width, 0) : Math.max(0.5, width - li);
      const ri = Math.max(0, width - li - w);
      const gap = Math.max(0, num(s.y, 0) - prevY);
      const jc = s.align === 'center' ? 'center' : s.align === 'right' ? 'right' : 'left';
      const pg = pi > 0 && i === 0 ? '<w:pageBreakBefore/>' : '';
      out.push(`<w:p><w:pPr>${pg}<w:spacing w:before="${tw(gap)}" w:after="0"/><w:ind w:left="${tw(li)}" w:right="${tw(ri)}"/><w:jc w:val="${jc}"/></w:pPr>` +
        runXml(String(s.text), { bold: s.bold, italic: s.italic, underline: s.underline, size: Math.round(num(s.size, 12) * 2) }) + '</w:p>');
      prevY = num(s.y, 0) + num(s.size, 12) / 72;
    });
  });
  return out;
}

/**
 * บทภาพยนตร์ → DOCX
 * @param {Array<{el:string,text:string}>} blocks  ผลของ `parseScript()`
 * @param {{title?:string, author?:string, fmt?:object, titlePages?:Array, fontPt?:number,
 *          font?:string, thaiFont?:string, language?:string, pageNumbers?:boolean,
 *          firstPageNumber?:boolean, suffix?:string, startPage?:number, created?:string}} opts
 * @returns {{files:Array<{path:string,data:string}>, paragraphs:number, images:number, comments:number}}
 */
export function buildScreenplayDocx(blocks, opts = {}) {
  const f = opts.fmt && opts.fmt.elements ? opts.fmt : mergeSpFormat(opts.fmt);
  const m = f.margins;
  const pt = Math.min(96, Math.max(4, num(opts.fontPt, 12)));
  const font = safeFont(opts.font, 'Courier Prime');
  const thai = safeFont(opts.thaiFont, 'Tahoma');
  const lang = String(opts.language || 'th-TH');
  const body = [];
  let paragraphs = 0;
  const push = (xml) => { body.push(xml); paragraphs++; };

  const titles = normalizeTitlePages(opts.titlePages).filter((p) => p.strings.some((s) => String(s.text ?? '').trim() !== ''));
  const front = titles.length ? titlePageParas(titles, f) : [];
  for (const x of front) push(x);

  let firstBody = true;
  let pendingBreak = false;
  for (const b of blocks || []) {
    if (!b || b.el === 'blank') continue;
    const text = plainText(b.text);
    if (b.el === 'page-break' || (!text.replace(/\f/g, '').trim() && text.includes('\f'))) { pendingBreak = true; continue; }
    if (!text.trim() && b.el === 'action') continue;
    const p = spParaProps(b.el, f, pt);
    const t2 = (p.caps ? text.toUpperCase() : text).replace(/\f/g, '');
    const pPr = [
      `<w:pStyle w:val="SP${b.el.replace(/[^a-z0-9]/gi, '')}"/>`,
      p.keepNext ? '<w:keepNext/>' : '',
      pendingBreak ? '<w:pageBreakBefore/>' : '',
      // ย่อหน้าแรกของหน้าไม่ต้องเว้นนำ (เหมือน paginate() ที่ตัดบรรทัดว่างหัวหน้าทิ้ง)
      `<w:spacing w:before="${firstBody || pendingBreak ? 0 : p.before}" w:after="0" w:line="240" w:lineRule="auto"/>`,
      `<w:ind w:left="${p.li}" w:right="${p.ri}"/>`,
      p.right ? '<w:jc w:val="right"/>' : '',
    ].join('');
    push(`<w:p><w:pPr>${pPr}</w:pPr>${runXml(t2, p)}</w:p>`);
    firstBody = false; pendingBreak = false;
  }

  // เลขหน้า: หัวกระดาษชิดขวา (ตำแหน่ง/จุดท้ายเลขเดียวกับ PDF) · หน้าปกอยู่ section ของตัวเองที่ไม่มีหัวกระดาษ
  const showNum = opts.pageNumbers !== false;
  const suffix = String(opts.suffix == null ? '.' : opts.suffix).replace(/[<>&"]/g, '');
  const start = Math.max(1, Math.round(num(opts.startPage, 1)));
  const pgSz = `<w:pgSz w:w="${tw(f.paper.width)}" w:h="${tw(f.paper.height)}"/>`;
  const pgMar = (header) => `<w:pgMar w:top="${tw(m.top)}" w:right="${tw(m.right)}" w:bottom="${tw(m.bottom)}" w:left="${tw(m.left)}" w:header="${header}" w:footer="708" w:gutter="0"/>`;
  const headerTw = tw(num(f.pageNumbers && f.pageNumbers.top, 0.5));
  if (front.length) {
    // ปิด section ของหน้าปก (ไม่มีหัวกระดาษ ไม่มีเลขหน้า) — เนื้อบทเริ่มหน้าใหม่ที่เลข `start`
    body.push(`<w:p><w:pPr><w:sectPr>${pgSz}${pgMar(headerTw)}</w:sectPr></w:pPr></w:p>`);
  }
  const titlePg = showNum && opts.firstPageNumber === false;
  const sectPr = `<w:sectPr>${showNum ? '<w:headerReference w:type="default" r:id="rIdHdr1"/>' : ''}` +
    `${titlePg ? '<w:headerReference w:type="first" r:id="rIdHdr2"/>' : ''}` +
    `${pgSz}${pgMar(headerTw)}<w:pgNumType w:start="${start}"/>${titlePg ? '<w:titlePg/>' : ''}</w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS}><w:body>
${body.join('\n')}
${sectPr}
</w:body></w:document>`;
  const rightInd = Math.max(0, tw(num(m.right, 1) - num(f.pageNumbers && f.pageNumbers.right, 1)));
  const headerXml = (withNum) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W_NS}><w:p><w:pPr><w:jc w:val="right"/><w:ind w:right="${-rightInd}"/></w:pPr>${withNum
    ? `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${start}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>${suffix ? `<w:r><w:t xml:space="preserve">${xmlEsc(suffix)}</w:t></w:r>` : ''}`
    : ''}</w:p></w:hdr>`;

  const fonts = `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${thai}"/>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:sz w:val="${Math.round(pt * 2)}"/><w:szCs w:val="${Math.round(pt * 2)}"/><w:lang w:val="${xmlEsc(lang)}" w:bidi="${xmlEsc(lang)}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${Object.keys(f.elements).map((k) => `<w:style w:type="paragraph" w:customStyle="1" w:styleId="SP${k.replace(/[^a-z0-9]/gi, '')}"><w:name w:val="Screenplay ${xmlEsc(k)}"/><w:basedOn w:val="Normal"/></w:style>`).join('\n')}
</w:styles>`;

  const created = String(opts.created || new Date().toISOString()).replace(/\.\d+Z$/, 'Z');
  const hdrTypes = showNum ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n' +
    (titlePg ? '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n' : '') : '';
  const hdrRels = showNum ? '<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>\n' +
    (titlePg ? '<Relationship Id="rIdHdr2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>\n' : '') : '';
  const files = [
    { path: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
${hdrTypes}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>` },
    { path: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
    { path: 'word/document.xml', data: documentXml },
    { path: 'word/styles.xml', data: stylesXml },
    { path: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${hdrRels}</Relationships>` },
    { path: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEsc(opts.title || '')}</dc:title>
<dc:creator>${xmlEsc(opts.author || '')}</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${xmlEsc(created)}</dcterms:created>
</cp:coreProperties>` },
  ];
  if (showNum) files.push({ path: 'word/header1.xml', data: headerXml(true) });
  if (titlePg) files.push({ path: 'word/header2.xml', data: headerXml(false) });
  return { files, paragraphs, images: 0, comments: 0 };
}
