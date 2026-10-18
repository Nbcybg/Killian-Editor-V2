// export-ebook.js — [alpha.156] ส่งออก EPUB 3 (อีบุ๊ก) และ DOCX (Microsoft Word)
//
// ต้นทาง = **มาร์กดาวน์ที่ออกจากเวิร์กโฟลว์** (ตัวเดียวกับที่กลายเป็น PDF/HTML) แล้วอ่านด้วย
// `mdBlocks()` / `parseInline()` ของ md.js — กฎถาวรข้อ 5: ไวยากรณ์ .md มีที่เดียว ห้ามเขียน regex ชุดที่สอง
//
// ไฟล์นี้ **บริสุทธิ์** (ไม่แตะ DOM / kapi / JSZip) — คืน "รายการไฟล์ในแพ็กเกจ" แล้วให้ export-hub.js
// อัดซิปเอง · รูปภาพต้องถูกอ่านเป็นไบต์มาก่อน (`collectImageSrcs` บอกว่าต้องอ่านอะไรบ้าง)
import { mdBlocks, parseInline, stripMentions } from './md.js';

import { t } from './i18n.js';   // [alpha.162 · W6 ข้อ 4]
// ═══════════════════════ ตัวช่วยร่วม ═══════════════════════
/** XML 1.0 ห้ามอักขระควบคุม (ยกเว้น tab/LF/CR) — เจอในข้อความที่วางมาจากเว็บบ่อย */
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
export const xmlEsc = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const markName = (m) => (typeof m === 'string' ? m : m && m.type);
const segsOf = (text) => parseInline(stripMentions(String(text || ''))).filter((s) => s.text);
const RE_INLINE_IMG = /!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;

function hex6(c) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return '';
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return h.toUpperCase();
}
/** ข้อความล้วนของหนึ่งบรรทัด (หัวข้อในสารบัญ) */
export function plainInline(text) {
  return segsOf(text).map((s) => s.text.replace(RE_INLINE_IMG, (m, a) => a)).join('').trim();
}

const EXT_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
};
const extOf = (p) => String(p || '').split(/[?#]/)[0].split('.').pop().toLowerCase();

/** รูปทั้งหมดที่เนื้อหาอ้างถึง (รูปทั้งบรรทัด + รูปกลางย่อหน้า) — ผู้เรียกอ่านไบต์มาให้ */
export function collectImageSrcs(md, { breakMarker = '' } = {}) {
  const out = new Set();
  for (const b of mdBlocks(md, { breakMarker })) {
    if (b.kind === 'figure' && b.src) out.add(b.src);
    for (const m of String(b.text || '').matchAll(RE_INLINE_IMG)) if (m[2]) out.add(m[2]);
  }
  return [...out];
}

/**
 * ขนาดพิกเซลของรูป (PNG · JPEG · GIF) จากหัวไฟล์ — ไม่รู้จัก/เสีย = null
 * DOCX ต้องบอกขนาดรูปเป็นหน่วย EMU ตอนเขียน จึงต้องรู้ขนาดจริง
 */
export function imageSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const be16 = (i) => (b[i] << 8) | b[i + 1];
  const be32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
    return { w: be32(16), h: be32(20), type: 'png' };
  }
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8), type: 'gif' };
  }
  if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const mk = b[i + 1];
      if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) {
        return { w: be16(i + 7), h: be16(i + 5), type: 'jpeg' };
      }
      if (mk === 0xD8 || mk === 0x01 || (mk >= 0xD0 && mk <= 0xD7)) { i += 2; continue; }
      i += 2 + be16(i + 2);
    }
  }
  return null;
}

// ═══════════════════════ EPUB 3 ═══════════════════════
const X_TAGS = [['strong', 'strong'], ['em', 'em'], ['underline', 'u'], ['strike', 's'], ['sup', 'sup'], ['sub', 'sub']];
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function inlineXhtml(text, imgHref) {
  return segsOf(text).map((seg) => {
    let s = xmlEsc(seg.text).replace(RE_INLINE_IMG, (m, a, u) => {
      const href = imgHref(unesc(u));
      return href ? `<img alt="${a}" src="${xmlEsc(href)}"/>` : a;
    });
    const marks = seg.marks || [];
    const has = (n) => marks.some((m) => markName(m) === n);
    for (const [n, tag] of X_TAGS) if (has(n)) s = `<${tag}>${s}</${tag}>`;
    const col = marks.find((m) => m && typeof m === 'object' && m.type === 'color');
    const h = col ? hex6((col.attrs || {}).color) : '';
    if (h) s = `<span style="color:#${h}">${s}</span>`;
    return s;
  }).join('');
}

/**
 * มาร์กดาวน์ → ส่วนของเล่ม (แยกไฟล์ที่หัวข้อระดับ ≤ splitLevel และที่ตัวคั่นหน้า)
 * @returns {Array<{title:string, html:string}>}
 */
export function mdToXhtmlSections(md, { breakMarker = '', imgHref = () => '', splitLevel = 2 } = {}) {
  const sections = [];
  let cur = null, list = null;
  const start = (title) => { cur = { title: title || '', parts: [] }; sections.push(cur); };
  const flushList = () => {
    if (!list) return;
    cur.parts.push(`<${list.tag}${list.start > 1 ? ` start="${list.start}"` : ''}>${list.items.join('')}</${list.tag}>`);
    list = null;
  };
  const al = (a) => (a ? ` style="text-align:${a}"` : '');
  for (const b of mdBlocks(md, { breakMarker })) {
    if (b.kind === 'pagebreak') { flushList(); if (cur && cur.parts.length) start(''); continue; }
    if (b.kind === 'h' && b.level <= splitLevel) {
      flushList();
      const title = plainInline(b.text);
      if (!cur || cur.parts.length || cur.title) start(title); else cur.title = title;
    }
    if (!cur) start('');
    if (b.kind !== 'li') flushList();
    switch (b.kind) {
      case 'h': cur.parts.push(`<h${b.level}${al(b.align)}>${inlineXhtml(b.text, imgHref)}</h${b.level}>`); break;
      case 'li': {
        const tag = b.ordered ? 'ol' : 'ul';
        if (list && list.tag !== tag) flushList();
        if (!list) list = { tag, start: b.ordered ? (b.num || 1) : 1, items: [] };
        list.items.push(`<li${al(b.align)}>${inlineXhtml(b.text, imgHref)}</li>`);
        break;
      }
      case 'quote': cur.parts.push(`<blockquote><p${al(b.align)}>${inlineXhtml(b.text, imgHref)}</p></blockquote>`); break;
      case 'hr': cur.parts.push(b.text ? `<p class="scene-break" style="text-align:center;text-indent:0">${xmlEsc(b.text)}</p>` : '<hr/>'); break;
      case 'code': cur.parts.push(`<pre><code>${xmlEsc(b.text)}</code></pre>`); break;
      case 'figure': {
        const href = imgHref(b.src);
        if (href) cur.parts.push(`<figure${al(b.align)}><img alt="${xmlEsc(b.alt || '')}" src="${xmlEsc(href)}"/></figure>`);
        else if (b.alt) cur.parts.push(`<p class="k-img-alt">${xmlEsc(b.alt)}</p>`);
        break;
      }
      default: {                                   // p — ย่อหน้าว่างเป็นตัวคั่นของมาร์กดาวน์ ไม่ใช่เนื้อหา
        const lines = (b.lines || [b.text]).map((l) => inlineXhtml(l, imgHref));
        if (!lines.join('').trim()) break;
        cur.parts.push(`<p${al(b.align)}>${lines.join('<br/>')}</p>`);
      }
    }
  }
  flushList();
  return sections.filter((s) => s.parts.length || s.title).map((s) => ({ title: s.title, html: s.parts.join('\n') }));
}

export const EPUB_CSS = [
  'body{margin:0 5%;line-height:1.7;font-family:serif}',
  'p{margin:0;text-indent:1.5em;text-align:justify}',
  'h1,h2,h3,h4,h5,h6{text-indent:0;line-height:1.3;margin:1.2em 0 .6em;page-break-after:avoid}',
  'h1+p,h2+p,h3+p,hr+p{text-indent:0}',
  'blockquote{margin:.8em 1.5em;font-style:italic}',
  'blockquote p{text-indent:0}',
  'figure{margin:1em 0;text-align:center;text-indent:0}',
  'figure img,p img{max-width:100%;height:auto}',
  'hr{border:0;border-top:1px solid #999;margin:1.2em 20%}',
  'pre{white-space:pre-wrap;font-family:monospace;font-size:.9em}',
  '.k-img-alt{text-indent:0;font-style:italic;text-align:center}',
  '.k-title-page{text-align:center;margin-top:30%}',
  '.k-title-page h1{font-size:2em}',
].join('\n');

const xhtmlDoc = (title, lang, body) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEsc(lang)}" lang="${xmlEsc(lang)}">
<head><meta charset="utf-8"/><title>${xmlEsc(title)}</title><link rel="stylesheet" type="text/css" href="../style.css"/></head>
<body>
${body}
</body>
</html>
`;

/**
 * ประกอบแพ็กเกจ EPUB 3
 * @param {string} md มาร์กดาวน์ของทั้งเล่ม (ผลของเวิร์กโฟลว์ markdownOut)
 * @param {{title?:string, author?:string, language?:string, identifier?:string, modified?:string,
 *          breakMarker?:string, images?:Map<string,Uint8Array>, css?:string, titlePage?:boolean}} opts
 * @returns {{files:Array<{path:string, data:string|Uint8Array, store?:boolean}>, sections:number, images:number}}
 *   ไฟล์แรกคือ `mimetype` ต้องอยู่หน้าสุดและไม่บีบอัด (`store`) — ข้อบังคับของ EPUB
 */
export function buildEpub(md, opts = {}) {
  const title = String(opts.title || '').trim() || t('ui.xhub.untitledBook');   // [alpha.162 · W6 ข้อ 4] เดิม 'Untitled' ตายตัว
  const lang = String(opts.language || 'th').trim() || 'th';
  const id = String(opts.identifier || 'urn:uuid:00000000-0000-4000-8000-000000000000');
  const modified = String(opts.modified || new Date().toISOString()).replace(/\.\d+Z$/, 'Z');
  const imgData = opts.images instanceof Map ? opts.images : new Map();
  const used = new Map();                                   // src → {href,type,id,data}
  const imgHref = (src) => {
    if (!src || !imgData.has(src)) return '';
    if (!used.has(src)) {
      const ext = extOf(src);
      const type = EXT_TYPES[ext];
      if (!type) return '';
      const n = used.size + 1;
      used.set(src, { href: `images/img${n}.${ext === 'jpg' ? 'jpeg' : ext}`, type, id: 'img' + n, data: imgData.get(src) });
    }
    return '../' + used.get(src).href;
  };
  const sections = mdToXhtmlSections(md, { breakMarker: opts.breakMarker || '', imgHref });
  const chapters = [];
  if (opts.titlePage !== false) {
    chapters.push({ id: 'titlepage', title, file: 'text/title.xhtml',
      html: `<div class="k-title-page"><h1>${xmlEsc(title)}</h1>${opts.author ? `<p>${xmlEsc(opts.author)}</p>` : ''}</div>`, toc: false });
  }
  sections.forEach((s, i) => {
    const n = String(i + 1).padStart(3, '0');
    chapters.push({ id: 's' + n, title: s.title, file: `text/s${n}.xhtml`, html: s.html, toc: !!s.title });
  });
  if (!sections.length) chapters.push({ id: 's001', title, file: 'text/s001.xhtml', html: '<p></p>', toc: true });
  const tocItems = chapters.filter((c) => c.toc);
  if (!tocItems.length && chapters.length) tocItems.push({ ...chapters[chapters.length - 1], title });

  const files = [{ path: 'mimetype', data: 'application/epub+zip', store: true }];
  files.push({ path: 'META-INF/container.xml', data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
` });
  for (const c of chapters) {
    files.push({ path: 'OEBPS/' + c.file, data: xhtmlDoc(c.title || title, lang, c.html) });
  }
  files.push({ path: 'OEBPS/style.css', data: opts.css ? EPUB_CSS + '\n' + opts.css : EPUB_CSS });
  files.push({ path: 'OEBPS/nav.xhtml', data: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEsc(lang)}" lang="${xmlEsc(lang)}">
<head><meta charset="utf-8"/><title>${xmlEsc(title)}</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>${xmlEsc(title)}</h1>
<ol>
${tocItems.map((c) => `<li><a href="${xmlEsc(c.file)}">${xmlEsc(c.title)}</a></li>`).join('\n')}
</ol>
</nav>
</body>
</html>
` });
  files.push({ path: 'OEBPS/toc.ncx', data: `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${xmlEsc(id)}"/></head>
<docTitle><text>${xmlEsc(title)}</text></docTitle>
<navMap>
${tocItems.map((c, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${xmlEsc(c.title)}</text></navLabel><content src="${xmlEsc(c.file)}"/></navPoint>`).join('\n')}
</navMap>
</ncx>
` });
  for (const im of used.values()) files.push({ path: 'OEBPS/' + im.href, data: im.data, store: true });
  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
    ...chapters.map((c) => `<item id="${c.id}" href="${xmlEsc(c.file)}" media-type="application/xhtml+xml"/>`),
    ...[...used.values()].map((im) => `<item id="${im.id}" href="${xmlEsc(im.href)}" media-type="${im.type}"/>`),
  ];
  files.splice(2, 0, { path: 'OEBPS/content.opf', data: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${xmlEsc(lang)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${xmlEsc(id)}</dc:identifier>
<dc:title>${xmlEsc(title)}</dc:title>
${opts.author ? `<dc:creator>${xmlEsc(opts.author)}</dc:creator>\n` : ''}<dc:language>${xmlEsc(lang)}</dc:language>
<meta property="dcterms:modified">${xmlEsc(modified)}</meta>
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine toc="ncx">
${chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n')}
</spine>
</package>
` });
  return { files, sections: sections.length, images: used.size };
}

// ═══════════════════════ DOCX (WordprocessingML) ═══════════════════════
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const JC = { center: 'center', right: 'right', justify: 'both' };
const twip = (inch, d) => Math.round((Number.isFinite(+inch) ? +inch : d) * 1440);

function runXml(text, marks, fontPt) {
  const has = (n) => (marks || []).some((m) => markName(m) === n);
  const rp = [];
  if (has('strong')) rp.push('<w:b/><w:bCs/>');
  if (has('em')) rp.push('<w:i/><w:iCs/>');
  if (has('underline')) rp.push('<w:u w:val="single"/>');
  if (has('strike')) rp.push('<w:strike/>');
  const col = (marks || []).find((m) => m && typeof m === 'object' && m.type === 'color');
  const h = col ? hex6((col.attrs || {}).color) : '';
  if (h) rp.push(`<w:color w:val="${h}"/>`);
  if (fontPt) rp.push(`<w:sz w:val="${Math.round(fontPt * 2)}"/><w:szCs w:val="${Math.round(fontPt * 2)}"/>`);
  if (has('sup')) rp.push('<w:vertAlign w:val="superscript"/>');
  else if (has('sub')) rp.push('<w:vertAlign w:val="subscript"/>');
  const rPr = rp.length ? `<w:rPr>${rp.join('')}</w:rPr>` : '';
  // tab ในข้อความต้องเป็น <w:tab/> — ไม่งั้น Word แสดงเป็นช่องว่างเดียว
  return String(text).split('\t').map((part, i) =>
    (i ? `<w:r>${rPr}<w:tab/></w:r>` : '') + (part ? `<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(part)}</w:t></w:r>` : '')).join('');
}

/**
 * มาร์กดาวน์ → DOCX
 * @param {string} md
 * @param {{title?:string, author?:string, font?:string, fontPt?:number, language?:string,
 *          paper?:{width:number,height:number}, margins?:{top:number,right:number,bottom:number,left:number},
 *          breakMarker?:string, images?:Map<string,Uint8Array>, created?:string}} opts
 * @returns {{files:Array<{path:string,data:string|Uint8Array}>, paragraphs:number, images:number}}
 */
export function buildDocx(md, opts = {}) {
  const font = String(opts.font || 'Tahoma').replace(/["<>&]/g, '');
  const fontPt = Number.isFinite(+opts.fontPt) && +opts.fontPt > 0 ? +opts.fontPt : 14;
  const lang = String(opts.language || 'th-TH');
  const paper = opts.paper || { width: 8.27, height: 11.69 };
  const mg = opts.margins || { top: 1, right: 1, bottom: 1, left: 1 };
  const contentIn = Math.max(1, (+paper.width || 8.27) - (+mg.left || 1) - (+mg.right || 1));
  const imgData = opts.images instanceof Map ? opts.images : new Map();
  const media = new Map();                                // src → {rid,name,type,w,h,data,n}
  const imgRun = (src, alt) => {
    const data = imgData.get(src);
    if (!data) return '';
    const sz = imageSize(data);
    if (!sz || !sz.w || !sz.h) return '';
    if (!media.has(src)) {
      const n = media.size + 1;
      media.set(src, { rid: 'rIdImg' + n, name: `image${n}.${sz.type === 'jpeg' ? 'jpeg' : sz.type}`, type: sz.type, data, n });
    }
    const m = media.get(src);
    const wIn = Math.min(contentIn, sz.w / 96), hIn = wIn * (sz.h / sz.w);
    const cx = Math.round(wIn * 914400), cy = Math.round(hIn * 914400);
    const id = 1000 + m.n;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${id}" name="${xmlEsc(m.name)}" descr="${xmlEsc(alt || '')}"/>` +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${xmlEsc(m.name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${m.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  };
  const runsOf = (text, extraMarks = []) => segsOf(text).map((seg) => {
    const marks = [...(seg.marks || []), ...extraMarks];
    // รูปกลางย่อหน้า: แยกข้อความรอบ ๆ ออกเป็น run แล้ววางรูปตรงกลาง
    let out = '', last = 0;
    for (const m of seg.text.matchAll(RE_INLINE_IMG)) {
      out += runXml(seg.text.slice(last, m.index), marks, 0);
      out += imgRun(m[2], m[1]) || runXml(m[1], marks, 0);
      last = m.index + m[0].length;
    }
    return out + runXml(seg.text.slice(last), marks, 0);
  }).join('');

  const body = [];
  const nums = [];                                        // [{id, ordered, start}]
  let curList = null;
  const pPr = (style, align, extra = '') =>
    `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}${JC[align] ? `<w:jc w:val="${JC[align]}"/>` : ''}</w:pPr>`;
  let paragraphs = 0;
  const push = (xml) => { body.push(xml); paragraphs++; };
  for (const b of mdBlocks(md, { breakMarker: opts.breakMarker || '' })) {
    if (b.kind !== 'li') curList = null;
    switch (b.kind) {
      case 'pagebreak': push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); break;
      case 'h': push(`<w:p>${pPr('Heading' + Math.min(6, b.level), b.align)}${runsOf(b.text)}</w:p>`); break;
      case 'li': {
        if (!curList || curList.ordered !== b.ordered) {
          curList = { id: nums.length + 1, ordered: b.ordered, start: b.ordered ? (b.num || 1) : 1 };
          nums.push(curList);
        }
        push(`<w:p>${pPr('ListParagraph', b.align, `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${curList.id}"/></w:numPr>`)}${runsOf(b.text)}</w:p>`);
        break;
      }
      case 'quote': push(`<w:p>${pPr('Quote', b.align)}${runsOf(b.text)}</w:p>`); break;
      case 'hr': if (b.text) { push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(b.text)}</w:t></w:r></w:p>`); break; }
        push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>'); break;
      case 'code':
        for (const line of String(b.text).split('\n')) push(`<w:p>${pPr('Code', null)}${runXml(line, [], 0)}</w:p>`);
        break;
      case 'figure': {
        const r = imgRun(b.src, b.alt);
        if (r) push(`<w:p>${pPr('Figure', b.align || 'center')}${r}</w:p>`);
        else if (b.alt) push(`<w:p>${pPr('Figure', b.align || 'center')}${runXml(b.alt, ['em'], 0)}</w:p>`);
        break;
      }
      default: {
        const lines = b.lines || [b.text];
        const runs = lines.map((l) => runsOf(l)).join('<w:r><w:br/></w:r>');
        if (!lines.join('').trim()) break;               // ย่อหน้าว่าง = ตัวคั่นของมาร์กดาวน์
        push(`<w:p>${pPr(null, b.align)}${runs}</w:p>`);
      }
    }
  }
  const sectPr = `<w:sectPr><w:pgSz w:w="${twip(paper.width, 8.27)}" w:h="${twip(paper.height, 11.69)}"/>` +
    `<w:pgMar w:top="${twip(mg.top, 1)}" w:right="${twip(mg.right, 1)}" w:bottom="${twip(mg.bottom, 1)}" w:left="${twip(mg.left, 1)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS}><w:body>
${body.join('\n')}
${sectPr}
</w:body></w:document>`;

  const fonts = `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>`;
  const hs = [0, 2, 1.6, 1.35, 1.2, 1.1, 1];
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:sz w:val="${fontPt * 2}"/><w:szCs w:val="${fontPt * 2}"/><w:lang w:val="${xmlEsc(lang)}" w:bidi="${xmlEsc(lang)}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${[1, 2, 3, 4, 5, 6].map((n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="${Math.round(fontPt * 2 * hs[n])}"/><w:szCs w:val="${Math.round(fontPt * 2 * hs[n])}"/></w:rPr></w:style>`).join('\n')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/><w:iCs/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="${font}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Figure"><w:name w:val="Figure"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style>
</w:styles>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
${nums.map((n) => `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.ordered ? 1 : 0}"/>${n.ordered ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${n.start}"/></w:lvlOverride>` : ''}</w:num>`).join('\n')}
</w:numbering>`;

  const exts = new Set([...media.values()].map((m) => (m.type === 'jpeg' ? 'jpeg' : m.type)));
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${[...exts].map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join('\n')}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
  const created = String(opts.created || new Date().toISOString()).replace(/\.\d+Z$/, 'Z');
  const files = [
    { path: '[Content_Types].xml', data: contentTypes },
    { path: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
    { path: 'word/document.xml', data: documentXml },
    { path: 'word/styles.xml', data: stylesXml },
    { path: 'word/numbering.xml', data: numberingXml },
    { path: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
${[...media.values()].map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('\n')}
</Relationships>` },
    { path: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEsc(opts.title || '')}</dc:title>
<dc:creator>${xmlEsc(opts.author || '')}</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${xmlEsc(created)}</dcterms:created>
</cp:coreProperties>` },
    ...[...media.values()].map((m) => ({ path: 'word/media/' + m.name, data: m.data })),
  ];
  return { files, paragraphs, images: media.size };
}
