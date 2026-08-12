// prose-format.js — รูปแบบ "นิยาย" ระดับใช้งานจริง (alpha.58r · บั๊ก 16–24)
//
// ที่มา: โหมดบทภาพยนตร์มี sp-format.js คุมทุกอย่าง (ระยะเยื้อง/ช่วงบรรทัด/ขนาดกระดาษ/จัดหน้า)
//        แต่โหมดนิยายไม่มีอะไรเลย — line-height 1.75 กับ margin .35em ฝังตายใน style.css
//        ไม่มี text-indent (ย่อหน้าบรรทัดแรก) ที่นิยายทุกภาษาใช้ · หัวข้อ/ยกคำพูดปรับไม่ได้
//        และฟอนต์เริ่มต้นเป็น Courier (ฟอนต์บท) ทั้งที่นิยายต้องใช้ตัวพิมพ์แบบสัดส่วน
//
//   16 ย่อหน้าบรรทัดแรก        → firstLineIndent (นิ้ว)
//   17 ช่วงบรรทัด/ระยะย่อหน้า   → lineHeight · paraSpacing
//   18 ฟอนต์เริ่มต้นของนิยาย     → DEFAULT_PROSE_FONT (สัดส่วน ไม่ใช่ monospace)
//   19 WYSIWYG ตอนส่งออก        → proseExportCss() ใช้ค่าชุดเดียวกับบนจอ
//   20 เลขหน้า/มุมมองหน้า        → paginateProse() · prosePageCount()
//   21 ค่าตั้งต้นระดับโปรเจกต์    → mergeProseFormat() เก็บใน settings.prose
//   23 หัวข้อปรับได้             → headings[] (ขนาด/ฟอนต์/จัดหน้า/สี/เลขอัตโนมัติ)
//   24 ยกคำพูดปรับได้           → quote{}
//
// บริสุทธิ์ 100% — ไม่แตะ DOM/kapi/state (ทดสอบด้วย node ได้: test/prose-format.test.cjs)

import { T } from './i18n.js';
import { PAPER_SIZES, MARGIN_DEFAULTS, textWidth } from './sp-format.js';
import { num } from './num.js';

const clamp = (v, lo, hi, d) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

// 1pt = 4/3 px (CSS)
export const PT_PX = 4 / 3;
export const DPI = 96;

/**
 * ฟอนต์เริ่มต้นของ "เนื้อเรื่องนิยาย" — ตัวพิมพ์แบบสัดส่วน (proportional)
 * [บั๊ก 18] เดิมตกไปใช้ DEFAULT_SCRIPT_FONT (Courier Prime) ซึ่งเป็นฟอนต์ของ "บทภาพยนตร์"
 * ทำให้ตัวละตินเป็น Courier ส่วนตัวไทยหล่นไป Sarabun → ปนกันน่าเกลียดและอ่านยาว ๆ ไม่สบายตา
 */
export const DEFAULT_PROSE_FONT =
  '"Sarabun", "TH Sarabun New", "Noto Serif Thai", "Noto Sans Thai", Georgia, "Times New Roman", serif';

// ───────── 23. หัวข้อ (h1–h6) ─────────
// size = เท่าของขนาดตัวอักษรเนื้อเรื่อง · before/after = ระยะเว้นเป็น em ของ "ตัวหัวข้อเอง"
const H = (size, bold, before, after) => ({ size, bold, italic: false, before, after, align: '' });
export const HEADING_DEFAULTS = [
  H(2.0, true, 1.0, 0.4),   // h1
  H(1.6, true, 1.0, 0.4),   // h2
  H(1.35, true, 1.0, 0.4),  // h3
  H(1.2, true, 1.0, 0.4),   // h4
  H(1.1, true, 1.0, 0.4),   // h5
  H(1.0, true, 1.0, 0.4),   // h6
];

// ───────── 24. ยกคำพูด (blockquote) ─────────
export const QUOTE_DEFAULTS = {
  italic: true, indent: 0.35, border: true, color: '', bg: '',
};

// ───────── 21. ค่าตั้งต้นระดับโปรเจกต์ ─────────
export const PROSE_DEFAULTS = {
  fontFamily: '',            // '' = DEFAULT_PROSE_FONT
  fontPt: 12,                // ขนาดเนื้อเรื่อง (พอยต์)
  lineHeight: 1.75,          // ช่วงบรรทัด (เท่าของขนาดตัวอักษร)
  paraSpacing: 0,            // ระยะระหว่างย่อหน้า (em) — นิยายมาตรฐาน = 0 (ใช้ย่อหน้าแทน)
  firstLineIndent: 0.5,      // [16] ย่อหน้าบรรทัดแรก (นิ้ว) — 0 = ไม่ย่อ
  indentAfterHeading: false, // ย่อหน้าแรกหลังหัวข้อไหม (ธรรมเนียมสากล = ไม่ย่อ)
  align: 'left',             // left | justify (จัดหน้าเริ่มต้นของย่อหน้า)
  headingFont: '',           // '' = เหมือนเนื้อเรื่อง
  headingColor: '',          // '' = ใช้สีของธีม
  headingNumber: false,      // [23] เติมเลขบทอัตโนมัติ
  headingNumberFormat: T`บทที่ {n}`,
  headingNumberLevel: 1,     // ใส่เลขให้หัวข้อระดับไหน
  headings: null,            // [23] null = HEADING_DEFAULTS
  quote: null,               // [24] null = QUOTE_DEFAULTS
  avgCharEm: 0.5,            // ความกว้างเฉลี่ยต่อตัวอักษร (เท่าของ em) — ใช้ประมาณการนับหน้า
  pageNumbers: false,        // [20] แสดงเลขหน้าในมุมมองหน้ากระดาษ
  pageNumberFirst: false,    // พิมพ์เลขบนหน้าแรกไหม
};

/** ผสานค่าที่ผู้ใช้ตั้ง (settings.prose) ทับค่าเริ่มต้น — คืน object ใหม่เสมอ */
export function mergeProseFormat(user) {
  const u = user || {};
  const headings = HEADING_DEFAULTS.map((d, i) => ({ ...d, ...((u.headings || [])[i] || {}) }));
  return {
    ...PROSE_DEFAULTS, ...u,
    fontFamily: String(u.fontFamily || ''),
    fontPt: clamp(u.fontPt, 6, 48, PROSE_DEFAULTS.fontPt),
    lineHeight: clamp(u.lineHeight, 0.8, 4, PROSE_DEFAULTS.lineHeight),
    paraSpacing: clamp(u.paraSpacing, 0, 4, PROSE_DEFAULTS.paraSpacing),
    firstLineIndent: clamp(u.firstLineIndent, 0, 3, PROSE_DEFAULTS.firstLineIndent),
    align: u.align === 'justify' ? 'justify' : 'left',
    avgCharEm: clamp(u.avgCharEm, 0.3, 1.2, PROSE_DEFAULTS.avgCharEm),
    headingNumberLevel: clamp(u.headingNumberLevel, 1, 6, 1),
    headings,
    quote: { ...QUOTE_DEFAULTS, ...(u.quote || {}) },
  };
}

/** ชุดฟอนต์ที่ใช้จริง (ว่าง = ค่ามาตรฐานของนิยาย) */
export function proseFontStack(fmt) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  return f.fontFamily && f.fontFamily.trim() ? f.fontFamily : DEFAULT_PROSE_FONT;
}
export function proseHeadingStack(fmt) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  return f.headingFont && f.headingFont.trim() ? f.headingFont : proseFontStack(f);
}
/** ขนาดตัวอักษรเนื้อเรื่องเป็น px */
export const proseFontPx = (fmt) => {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  return +(f.fontPt * PT_PX).toFixed(4);
};
/** ความสูงบรรทัดเนื้อเรื่องเป็น px */
export const proseLinePx = (fmt) => {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  return +(proseFontPx(f) * f.lineHeight).toFixed(4);
};

// ───────── ตัวแปร CSS (ตั้งที่ :root จาก app.js) ─────────
/** คืน { '--ed-lh': '1.75', '--ed-indent': '0.5in', … } */
export function proseCssVars(fmt) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  return {
    '--ed-lh': String(f.lineHeight),
    '--ed-para': f.paraSpacing + 'em',
    '--ed-indent': f.firstLineIndent + 'in',
    '--ed-align': f.align,
    '--ed-line-h': proseLinePx(f) + 'px',
  };
}

/**
 * CSS ของเนื้อเรื่องนิยาย (ยัดใส่ <style> ได้ทันที)
 * @param {object} fmt
 * @param {string} sel  ตัวเลือกฐาน (ค่าเริ่มต้น = '.ProseMirror' ในตัวแก้ไข)
 */
export function proseCss(fmt, sel = '.pane:not(.sp-pane):not(.wiki-pane) > .workspace > .ProseMirror') {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const out = [];
  const q = f.quote;
  out.push(`${sel}{line-height:${f.lineHeight};text-align:${f.align}}`);
  out.push(`${sel} p{margin:0 0 ${f.paraSpacing}em;text-indent:${f.firstLineIndent}in}`);
  // ย่อหน้าแรกของเอกสาร/หลังหัวข้อ ไม่ย่อ (ธรรมเนียมการจัดหน้าหนังสือ)
  if (!f.indentAfterHeading) {
    out.push(`${sel} > p:first-child,` +
             `${sel} > h1+p,${sel} > h2+p,${sel} > h3+p,` +
             `${sel} > h4+p,${sel} > h5+p,${sel} > h6+p{text-indent:0}`);
  }
  f.headings.forEach((h, i) => {
    const lv = i + 1;
    const parts = [`font-size:${+h.size.toFixed(3)}em`,
                   `font-weight:${h.bold ? 700 : 400}`,
                   `font-style:${h.italic ? 'italic' : 'normal'}`,
                   `margin:${h.before}em 0 ${h.after}em`,
                   `font-family:${proseHeadingStack(f)}`];
    if (h.align) parts.push('text-align:' + h.align);
    if (f.headingColor) parts.push('color:' + f.headingColor);
    out.push(`${sel} h${lv}{${parts.join(';')}}`);
  });
  // [23] เลขบทอัตโนมัติ — นับด้วย CSS counter จึงไม่ต้องเขียนตัวเลขลงไฟล์
  if (f.headingNumber) {
    const lv = f.headingNumberLevel;
    out.push(`${sel}{counter-reset:k-chap}`);
    out.push(`${sel} h${lv}{counter-increment:k-chap}`);
    out.push(`${sel} h${lv}::before{content:"${headingNumberText(f, '" counter(k-chap) "')}\\A";` +
             'white-space:pre;display:block;font-size:.62em;opacity:.72;font-weight:400}');
  }
  // [24] ยกคำพูด
  const qp = [`font-style:${q.italic ? 'italic' : 'normal'}`,
              `padding:2px 0 2px ${q.indent}in`,
              `margin:${Math.max(0.2, f.paraSpacing || 0.6)}em 0`];
  qp.push(q.border ? 'border-left:3px solid var(--accent)' : 'border-left:0');
  if (q.color) qp.push('color:' + q.color);
  if (q.bg) qp.push('background:' + q.bg);
  out.push(`${sel} blockquote{${qp.join(';')}}`);
  out.push(`${sel} blockquote p{text-indent:0}`);
  return out.join('\n');
}

/** ข้อความเลขบทตามรูปแบบที่ตั้ง (ใช้ {n}) */
export function headingNumberText(fmt, n) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  return String(f.headingNumberFormat || T`บทที่ {n}`).replace(/\{n\}/g, String(n));
}

// ───────── 19. CSS ตอนส่งออก (WYSIWYG) ─────────
/**
 * CSS สำหรับไฟล์ HTML ที่ส่งออก — ใช้ตัวเลขชุดเดียวกับที่เห็นบนจอ
 * (เดิม mdToHtml ฝัง Sarabun 18px/1.85 ตายตัว → เขียนอย่างหนึ่ง ได้อีกอย่าง)
 */
export function proseExportCss(fmt, paper, margins) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  const tw = textWidth(p, m);
  const body = [
    `font-family:${proseFontStack(f)}`,
    `font-size:${f.fontPt}pt`,
    `line-height:${f.lineHeight}`,
    `max-width:${+tw.toFixed(3)}in`,
    'margin:3em auto', 'padding:0 1.2em',
    `text-align:${f.align}`,
  ].join(';');
  const out = [`body{${body}}`,
               `p{margin:0 0 ${f.paraSpacing}em;text-indent:${f.firstLineIndent}in}`,
               'body > p:first-of-type,h1+p,h2+p,h3+p,h4+p,h5+p,h6+p{text-indent:0}'];
  f.headings.forEach((h, i) => {
    out.push(`h${i + 1}{font-size:${+h.size.toFixed(3)}em;font-weight:${h.bold ? 700 : 400};` +
             `margin:${h.before}em 0 ${h.after}em;font-family:${proseHeadingStack(f)}` +
             (h.align ? ';text-align:' + h.align : '') +
             (f.headingColor ? ';color:' + f.headingColor : '') + '}');
  });
  const q = f.quote;
  out.push(`blockquote{font-style:${q.italic ? 'italic' : 'normal'};` +
           `padding-left:${q.indent}in;margin:1em 0;` +
           (q.border ? 'border-left:3px solid #ccc' : 'border-left:0') +
           (q.color ? ';color:' + q.color : ';color:#555') + '}');
  out.push('blockquote p{text-indent:0}');
  out.push('hr{border:0;border-top:1px solid #ccc;margin:2em 0}');
  out.push('img{max-width:100%}');
  out.push('pre{background:#f4f4f4;padding:10px 14px;border-radius:6px;overflow:auto;' +
           'font-family:"Courier Prime","Courier New",monospace;font-size:.92em;text-indent:0}');
  out.push('.pb{page-break-before:always;break-before:page;height:0}');
  out.push(`@page{size:${p.width}in ${p.height}in;margin:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in}`);
  out.push('@media print{body{margin:0;max-width:none;padding:0}}');
  return out.join('\n');
}

// ───────── 20. การจัดหน้าของนิยาย ─────────
/** จำนวนบรรทัดเนื้อเรื่องต่อหน้า */
export function proseLinesPerPage(fmt, paper, margins) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  const usable = Math.max(0.5, num(p.height, 11) - num(m.top, 1) - num(m.bottom, 1));
  return Math.max(1, Math.floor((usable * DPI) / proseLinePx(f)));
}
/** จำนวนตัวอักษรโดยประมาณต่อบรรทัด (ฟอนต์สัดส่วน → ประมาณจาก avgCharEm) */
export function proseCharsPerLine(fmt, paper, margins) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  const wPx = textWidth(p, m) * DPI;
  return Math.max(10, Math.floor(wPx / (proseFontPx(f) * f.avgCharEm)));
}

/** มาตรวัดหน้ากระดาษของนิยาย (คู่กับ pageMetrics ของบทภาพยนตร์) */
export function proseMetrics(fmt, paper, margins) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  const usableH = Math.max(0.5, num(p.height, 11) - num(m.top, 1) - num(m.bottom, 1));
  return {
    linesPerPage: proseLinesPerPage(f, p, m),
    charsPerLine: proseCharsPerLine(f, p, m),
    usableWidth: +textWidth(p, m).toFixed(4),
    usableHeight: +usableH.toFixed(4),
    pageWidthPx: Math.round(num(p.width, 8.5) * DPI),
    pageHeightPx: Math.round(num(p.height, 11) * DPI),
    bodyHeightPx: Math.round(usableH * DPI),
    lineHeightPx: proseLinePx(f),
    fontPx: proseFontPx(f),
  };
}

/** จำนวนบรรทัดที่ข้อความหนึ่งย่อหน้ากินจริง (หน่วย = บรรทัดของเนื้อเรื่อง) */
export function proseWrap(text, cols, indentCols = 0) {
  const s = String(text ?? '');
  if (!s.trim()) return 1;
  const c = Math.max(1, Math.floor(cols));
  let total = 0;
  for (const para of s.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    // ไทยไม่มีช่องว่างระหว่างคำ → คำเดียวยาวมาก ตัดตามความกว้างล้วน
    if (!words.length) { total += 1; continue; }
    let line = 0, used = Math.max(0, Math.round(indentCols));
    for (const w of words) {
      const need = used ? used + 1 + w.length : w.length;
      if (need <= c) used = need;
      else { line++; used = w.length; while (used > c) { line++; used -= c; } }
    }
    total += line + 1;
  }
  return Math.max(1, total);
}

/** จำนวนบรรทัด (รวมระยะเว้นก่อน/หลัง) ที่บล็อกหนึ่งกินบนหน้า */
export function proseBlockLines(b, fmt, cols) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const type = (b && b.type) || 'p';
  const text = String((b && b.text) || '');
  if (type === 'hr') return 2;
  if (type === 'figure') return 8;                     // รูปกินพื้นที่ประมาณ 8 บรรทัด
  const hm = /^h([1-6])$/.exec(type);
  if (hm) {
    const h = f.headings[+hm[1] - 1] || f.headings[0];
    const c = Math.max(4, Math.floor(cols / h.size));
    const body = proseWrap(text, c) * h.size;
    return Math.ceil(body + h.before * h.size + h.after * h.size);
  }
  if (type === 'blockquote' || type === 'li' || type === 'code') {
    const c = Math.max(4, cols - 6);
    return proseWrap(text, c) + (f.paraSpacing ? Math.ceil(f.paraSpacing) : 0);
  }
  const indentCols = f.firstLineIndent
    ? Math.round((f.firstLineIndent * DPI) / (proseFontPx(f) * f.avgCharEm)) : 0;
  return proseWrap(text, cols, indentCols) + (f.paraSpacing ? Math.ceil(f.paraSpacing) : 0);
}

/**
 * จัดหน้านิยาย — คู่ขนานกับ paginate() ของบทภาพยนตร์ แต่ไม่มีกฎ (MORE)/(CONTINUED)
 * @param {Array<{type:string,text:string,pos?:number}>} blocks
 * @returns {{pages:Array<{index:number,blocks:Array}>,count:number}}
 */
export function paginateProse(blocks, opts = {}) {
  const f = opts.fmt && opts.fmt.headings ? opts.fmt : mergeProseFormat(opts.fmt);
  const paper = opts.paper || PAPER_SIZES.letter;
  const margins = { ...MARGIN_DEFAULTS, ...(opts.margins || {}) };
  const perPage = Math.max(4, opts.lines || proseLinesPerPage(f, paper, margins));
  const cols = Math.max(8, opts.cols || proseCharsPerLine(f, paper, margins));

  const pages = [];
  let cur = [], used = 0;
  const push = () => { pages.push({ index: pages.length + 1, blocks: cur }); cur = []; used = 0; };
  for (const b of blocks || []) {
    if (!b) continue;
    const need = proseBlockLines(b, f, cols);
    if (used && used + need > perPage) push();
    // บล็อกเดียวยาวเกินหนึ่งหน้า → ยอมให้ล้น (ไม่ตัดกลางย่อหน้าเหมือนบทพูดในบท)
    cur.push({ ...b, lines: need });
    used += need;
    if (used >= perPage) push();
  }
  if (cur.length) push();
  if (!pages.length) pages.push({ index: 1, blocks: [] });
  return { pages, count: pages.length };
}

/** นับหน้าอย่างเดียว (แถบสถานะ) */
export function prosePageCount(blocks, opts) { return paginateProse(blocks, opts).count; }

/** เลขหน้าที่ต้องพิมพ์บนหน้าที่ index — คืน '' เมื่อไม่ต้องพิมพ์ */
export function prosePageLabel(index, fmt, startPage) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  if (!f.pageNumbers) return '';
  const i = Math.max(1, Math.round(+index || 1));
  if (i === 1 && !f.pageNumberFirst) return '';
  const start = Math.max(1, Math.round(+startPage || 1));
  return String(start + i - 1);
}

// ───────── บล็อกจากเอกสาร ProseMirror (นิยาย) ─────────
/**
 * แปลง doc ของ KEditor เป็น blocks ที่ paginateProse ใช้ได้ พร้อมตำแหน่งจริงในเอกสาร
 * @returns {Array<{type:string,text:string,pos:number,idx:number,level?:number}>}
 */
export function proseBlocksFromDoc(doc) {
  const out = [];
  if (!doc || typeof doc.forEach !== 'function') return out;
  let i = 0;
  doc.forEach((node, offset) => {
    const name = node.type && node.type.name;
    const text = node.textContent || '';
    let type = 'p', level = 0;
    if (name === 'heading') { level = (node.attrs && node.attrs.level) || 1; type = 'h' + level; }
    else if (name === 'blockquote') type = 'blockquote';
    else if (name === 'bullet_list' || name === 'ordered_list') type = 'li';
    else if (name === 'figure') type = 'figure';
    else if (name === 'horizontal_rule') type = 'hr';
    else if (name === 'code_block') type = 'code';
    const b = { type, text, pos: offset, idx: i++ };
    if (level) b.level = level;
    if (name === 'figure') { b.src = node.attrs.resolved || node.attrs.src; b.alt = node.attrs.alt || ''; }
    out.push(b);
  });
  return out;
}

/** ตำแหน่งเริ่มต้นของแต่ละหน้า (index 0 = หน้า 1) */
export function prosePageStarts(pages) {
  const list = (pages && pages.pages) || pages || [];
  return list.map((pg) => {
    const b = (pg.blocks || []).find((x) => Number.isFinite(x && x.pos));
    return b ? b.pos : null;
  });
}
/** ตำแหน่งในเอกสารของหน้าที่ n (1-based) — null เมื่อไม่มี */
export function findProsePageStart(pages, n) {
  const arr = prosePageStarts(pages);
  const i = Math.max(1, Math.round(+n || 1)) - 1;
  if (i === 0) return arr.length ? (arr[0] ?? 0) : 0;
  return i < arr.length ? arr[i] : null;
}
/** รายชื่อหัวข้อทั้งหมด [{n,pos,text,level}] — ใช้กับกล่อง "ไปที่บท" */
export function proseHeadings(blocks, level) {
  const out = [];
  let n = 0;
  for (const b of blocks || []) {
    if (!b || !/^h[1-6]$/.test(b.type)) continue;
    if (level && b.level !== level) continue;
    n++;
    out.push({ n, pos: Number.isFinite(b.pos) ? b.pos : null, level: b.level,
               text: String(b.text || '').trim() });
  }
  return out;
}
