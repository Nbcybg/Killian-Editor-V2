// export-rtf.js — ส่งออกเป็น Rich Text Format (.rtf) ตามข้อ 68
// บริสุทธิ์ 100% : รับ blocks ([{el,text}]) + รูปแบบบท (sp-format) → คืนสตริง RTF
// ทดสอบด้วย node ได้ (test/sp-export.test.cjs)
//
// สำคัญ: RTF เป็นไฟล์ ANSI — ภาษาไทย (และอักขระ >127 ทุกตัว) ต้องเขียนเป็น \uNNNN?
//        ไม่งั้น Word/Pages เปิดแล้วได้ตัวขยะ (บทเรียนเดียวกับข้อ 14d เรื่องไบนารี)

import { inlinePlainText, mdBlocks, parseInline, stripMentions } from './md.js';
import { t } from './i18n.js';
import { mergeSpFormat, textWidth } from './sp-format.js';
import { normalizeTitlePages } from './sp-title-pages.js';
import { num } from './num.js';

export const TWIPS_PER_INCH = 1440;
export const TWIPS_PER_LINE = 240;          // 12pt single space
export const inTw = (v) => Math.round(num(v, 0) * TWIPS_PER_INCH);

/** หนีอักขระให้ปลอดภัยใน RTF (รวมภาษาไทยเป็น \uNNNN?) */
export function escapeRtf(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0);
    if (ch === '\\') { out += '\\\\'; continue; }
    if (ch === '{') { out += '\\{'; continue; }
    if (ch === '}') { out += '\\}'; continue; }
    if (ch === '\n') { out += '\\line '; continue; }
    if (ch === '\t') { out += '\\tab '; continue; }
    // [alpha.160 · P1-6] ตัวขึ้นหน้าใหม่ (\f จากขั้น "ขึ้นหน้าใหม่"/Ctrl+Enter) = \page ของ RTF
    // เดิมตกเงื่อนไข "อักขระควบคุม" ด้านล่างแล้วถูกทิ้ง → เส้นขึ้นหน้าหายจากไฟล์ RTF ทั้งหมด
    if (ch === '\f') { out += '\\page '; continue; }
    if (c < 32) continue;                                  // อักขระควบคุมอื่น ๆ ทิ้ง
    if (c < 128) { out += ch; continue; }
    if (c <= 0xFFFF) { out += '\\u' + (c > 32767 ? c - 65536 : c) + '?'; continue; }
    // นอก BMP (อีโมจิ) → surrogate pair
    const v = c - 0x10000;
    const hi = 0xD800 + (v >> 10), lo = 0xDC00 + (v & 0x3FF);
    out += '\\u' + (hi > 32767 ? hi - 65536 : hi) + '?';
    out += '\\u' + (lo > 32767 ? lo - 65536 : lo) + '?';
  }
  return out;
}

/** ตัดเครื่องหมายเน้นของ Markdown (RTF ใช้ระบบสไตล์ของตัวเอง) */
export function plainText(s) {
  // [alpha.159 · M6] ถอดด้วยตัวแยกเครื่องหมายตัวจริงของ md.js (`inlinePlainText` → parseInline)
  // เดิม regex ชุดของตัวเองรู้จักแค่ ** * __ ~~ [[ ]] → `_ขีดเส้นใต้_` `^ยก^` `~ห้อย~` `<span style>` `<mark>`
  // และลิงก์ หลุดเข้าไฟล์เป็นตัวอักษรดิบ (กฎ: ห้ามเขียน regex ถอดมาร์กดาวน์ชุดที่สอง)
  return inlinePlainText(String(s ?? ''))
    .replace(/(^|[^!])\[([^\]]+)\]\([^)\s]*\)/g, '$1$2');
}

/** คำสั่งจัดย่อหน้าของ element หนึ่ง (เยื้องซ้าย/ขวา/ระยะก่อนหน้า/สไตล์) */
export function paraCtrl(el, fmt, fontPt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const c = f.elements[el] || f.elements.action;
  const st = (f.styles[el] || f.styles.action).print;
  const tw = textWidth(f.paper, f.margins);
  const li = Math.max(0, num(c.indent, 0) - f.margins.left);
  const ri = Math.max(0, tw - li - num(c.width, tw));
  // `linesBefore` เป็นหน่วย 1/10 บรรทัด = "จำนวนบรรทัดว่างก่อนบล็อก" แบบเดียวกับที่
  // paginate()/layoutPageLines() นับ (บทพูด 0 · บรรยาย/ตัวละคร 1 · หัวฉาก 2)
  // RTF ไม่มีบรรทัดว่างแถมให้จาก \par → \sb ต้องเท่ากับจำนวนบรรทัดนั้นตรง ๆ
  // (เดิมลบออก 1 บรรทัด ทำให้ RTF แน่นกว่าจอ/PDF ทุกบล็อก — ชื่อตัวละครติดบรรยาย)
  const sb = Math.max(0, Math.round(num(c.linesBefore, 10) / 10)) * TWIPS_PER_LINE;
  // \\fsN นับเป็น "ครึ่ง point" (12pt = \\fs24) — ผู้ใช้ปรับขนาดฟอนต์บทได้ (settings.spFontPt)
  let s = '\\pard\\plain\\f0\\fs' + rtfFs(fontPt);
  s += '\\li' + inTw(li) + '\\ri' + inTw(ri);
  if (sb) s += '\\sb' + Math.round(sb);
  // keepNext อ่านจาก SP_ELEMENT_CONFIG ตอนรัน — ผู้ใช้ตั้งทับได้ ไม่ต้องแก้สองที่
  if (c.keepNext === true) s += '\\keepn';
  if (el === 'transition') s += '\\qr';
  if (st.bold) s += '\\b';
  if (st.italic) s += '\\i';
  if (st.underline) s += '\\ul';
  return { ctrl: s, caps: !!st.caps };
}

/** ขนาดฟอนต์ในหน่วยของ RTF (ครึ่ง point) — หนีบ 4–96pt เหมือนตัวสร้าง PDF */
export const rtfFs = (pt) => Math.round(Math.min(96, Math.max(4, num(pt, 12))) * 2);

/**
 * หน้าปกที่ผู้ใช้แต่งเอง (sp-title-pages) → ย่อหน้า RTF
 * x/y เป็น "นิ้วจากขอบกระดาษ" → \li จากขอบพื้นที่พิมพ์ + \sb จากระยะบน
 * (RTF ไม่มีกล่องลอยแบบ absolute ที่ Word ทุกรุ่นเปิดได้ → วางเป็นย่อหน้าเรียงตาม y แทน)
 */
function titlePagesRtf(pages, f) {
  const out = [];
  const m = f.margins;
  const tw = textWidth(f.paper, m);
  for (const p of pages) {
    const rows = (p.strings || [])
      .filter((s) => String(s.text ?? '').trim() !== '')
      .slice()
      .sort((a, b) => num(a.y, 0) - num(b.y, 0) || num(a.x, 0) - num(b.x, 0));
    let prevY = m.top;
    for (const s of rows) {
      const y = num(s.y, 0);
      const li = Math.max(0, num(s.x, m.left) - m.left);
      const w = num(s.width, 0) > 0 ? num(s.width, 0) : Math.max(0.5, tw - li);
      const ri = Math.max(0, tw - li - w);
      // ระยะเว้นก่อน = ระยะที่ห่างจากชิ้นก่อนหน้า (หน่วยนิ้ว → twips)
      const gap = Math.max(0, y - prevY);
      const size = Math.round(numTitleSize(s.size) * 2);   // \fsN = ครึ่ง point
      let ctrl = '\\pard\\plain\\f0\\fs' + size + '\\li' + inTw(li) + '\\ri' + inTw(ri);
      if (gap > 0) ctrl += '\\sb' + inTw(gap);
      ctrl += s.align === 'center' ? '\\qc' : s.align === 'right' ? '\\qr' : '\\ql';
      if (s.bold) ctrl += '\\b';
      if (s.italic) ctrl += '\\i';
      if (s.underline) ctrl += '\\ul';
      out.push(ctrl + ' ' + escapeRtf(String(s.text)) + '\\par');
      prevY = y + numTitleSize(s.size) / 72;              // ชิ้นนี้สูงประมาณหนึ่งบรรทัด
    }
    out.push('\\page');
  }
  return out;
}
const numTitleSize = (v) => Math.min(96, Math.max(4, num(v, 12)));

/**
 * สร้างเอกสาร RTF
 * @param {Array<{el:string,text:string}>} blocks
 * @param {object} meta { title, author, contact, copyright, basedOn }
 * @param {object} fmt  รูปแบบบท (sp-format) — ไม่ใส่ = ค่ามาตรฐาน
 * @param {object} opts { titlePages } — หน้าปกที่ผู้ใช้แต่งเอง (ชนะหน้าปกที่สร้างจาก meta)
 */
export function generateRtf(blocks, meta = {}, fmt = null, opts = {}) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const m = f.margins;
  const fs = rtfFs(opts && opts.fontPt);
  const titles = normalizeTitlePages(opts && opts.titlePages).filter((p) => p.strings.some(
    (s) => String(s.text ?? '').trim() !== ''));
  const head =
    '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n' +
    '{\\fonttbl{\\f0\\fmodern\\fcharset0 Courier Prime;}{\\f1\\fmodern\\fcharset0 Courier New;}}\n' +
    '\\paperw' + inTw(f.paper.width) + '\\paperh' + inTw(f.paper.height) +
    '\\margl' + inTw(m.left) + '\\margr' + inTw(m.right) +
    '\\margt' + inTw(m.top) + '\\margb' + inTw(m.bottom) + '\n' +
    '\\f0\\fs' + fs + '\n';

  const out = [];
  // หน้าปกที่ผู้ใช้แต่งเอง (ข้อ 90) มาก่อนเสมอ — ถ้ามี ไม่ต้องสร้างหน้าปกจาก meta ซ้ำ
  if (titles.length) out.push(...titlePagesRtf(titles, f));
  // หน้าปก (ใส่เมื่อมีชื่อเรื่อง) — จบด้วย \page เพื่อขึ้นหน้าใหม่
  const title = titles.length ? '' : String(meta.title || '').trim();
  if (title) {
    // [alpha.61 ข้อ 4] เดิมบังคับชื่อเรื่องเป็นตัวพิมพ์ใหญ่เสมอ ทั้งที่ผู้ใช้พิมพ์มาแบบไหนก็ตาม
    // ตอนนี้ตามสวิตช์ "บังคับพิมพ์ใหญ่" ของรูปแบบบท (ปิด = ใช้ข้อความตามที่พิมพ์)
    const titleTx = f.forceCase === false ? title : title.toUpperCase();
    out.push('\\pard\\plain\\f0\\fs' + fs + '\\qc\\sb2880\\b ' + escapeRtf(titleTx) + '\\b0\\par');
    if (meta.author) {
      out.push('\\pard\\plain\\f0\\fs' + fs + '\\qc\\sb480 ' + escapeRtf(t('ui.exportRtf.write')) + '\\par');
      out.push('\\pard\\plain\\f0\\fs' + fs + '\\qc ' + escapeRtf(String(meta.author)) + '\\par');
    }
    if (meta.basedOn) out.push('\\pard\\plain\\f0\\fs' + fs + '\\qc\\sb480 ' + escapeRtf(String(meta.basedOn)) + '\\par');
    if (meta.contact) out.push('\\pard\\plain\\f0\\fs' + fs + '\\ql\\sb2880 ' + escapeRtf(String(meta.contact)) + '\\par');
    if (meta.copyright) out.push('\\pard\\plain\\f0\\fs' + fs + '\\ql ' + escapeRtf(String(meta.copyright)) + '\\par');
    out.push('\\page');
  }

  for (const b of blocks || []) {
    if (!b || b.el === 'blank') continue;
    const text = plainText(b.text);
    // [alpha.160 · P1-6] บรรทัดที่มีแต่ \f = ขึ้นหน้าใหม่ (`'\f'.trim()` = '' → เดิมถูกข้ามทิ้งเงียบ ๆ)
    if (b.el === 'page-break' || (!text.replace(/\f/g, '').trim() && text.includes('\f'))) { out.push('\\page'); continue; }
    if (!text.trim() && b.el === 'action') continue;
    const { ctrl, caps } = paraCtrl(b.el, f, opts && opts.fontPt);
    out.push(ctrl + ' ' + escapeRtf(caps ? text.toUpperCase() : text) + '\\par');
  }

  return head + out.join('\n') + '\n}\n';
}

// ══ [alpha.169 · bug hunt] RTF ของ "นิยาย" ══
//
// วัดจากไฟล์ที่ส่งออกบนแอปจริง: นิยายที่เลือกปลายทาง RTF ถูกส่งเข้า `parseScript()` (ตัวอ่านบทภาพยนตร์)
// เหมือนบทหนัง → ย่อหน้าสั้นที่ตามด้วยอีกบรรทัดถูกเดาเป็น "ชื่อตัวละคร + บทพูด" (เยื้อง 2.2 นิ้ว)
// ตัวหนา/เอียง/สี/การจัดกึ่งกลาง/รายการ หายหมด และได้ฟอนต์ Courier ของบท
// ตัวนี้อ่านมาร์กดาวน์ของเวิร์กโฟลว์ด้วยสคีมาตัวจริง (`mdBlocks` + `parseInline` — กฎถาวรข้อ 5)
// แล้วเขียนย่อหน้า RTF ตามชนิดบล็อก · คู่แฝดของ `buildDocx()` (export-ebook.js)
const markName = (m) => (typeof m === 'string' ? m : m && m.type);
/** `#rgb` / `#rrggbb` → [r,g,b] (ไม่ใช่สี = null) */
function rgbOf(c) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** ชื่อฟอนต์ในตารางฟอนต์ — ตัดอักขระที่ปิดกลุ่ม/คั่นรายการของ RTF */
const rtfFontName = (s, d) => escapeRtf(String(s || d).replace(/[{};\\]/g, '').trim() || d);
const RTF_ALIGN = { center: '\\qc', right: '\\qr', justify: '\\qj' };
const RTF_HEAD_SCALE = [0, 2, 1.6, 1.35, 1.2, 1.1, 1];     // ชุดเดียวกับหัวข้อของ DOCX

/**
 * มาร์กดาวน์ (ผลของเวิร์กโฟลว์ส่งออก) → RTF ของนิยาย
 * @param {string} md
 * @param {{title?:string, author?:string, font?:string, fontPt?:number, breakMarker?:string,
 *          paper?:{width:number,height:number}, margins?:{top:number,right:number,bottom:number,left:number}}} opts
 * @returns {string}
 */
export function generateProseRtf(md, opts = {}) {
  const paper = opts.paper || { width: 8.27, height: 11.69 };
  const m = opts.margins || { top: 1, right: 1, bottom: 1, left: 1 };
  const fs = rtfFs(opts.fontPt);
  const colors = [];                                       // ดัชนี 1.. ใน \colortbl
  const colorIdx = (c) => {
    const rgb = rgbOf(c);
    if (!rgb) return 0;
    const key = rgb.join(',');
    let i = colors.indexOf(key);
    if (i < 0) { colors.push(key); i = colors.length - 1; }
    return i + 1;
  };
  const run = (text, marks) => {
    if (!text) return '';
    const has = (n) => (marks || []).some((x) => markName(x) === n);
    let c = '';
    if (has('strong')) c += '\\b';
    if (has('em')) c += '\\i';
    if (has('underline')) c += '\\ul';
    if (has('strike')) c += '\\strike';
    if (has('sup')) c += '\\super';
    else if (has('sub')) c += '\\sub';
    const col = (marks || []).find((x) => x && typeof x === 'object' && x.type === 'color');
    const ci = col ? colorIdx((col.attrs || {}).color) : 0;
    if (ci) c += '\\cf' + ci;
    return c ? '{' + c + ' ' + escapeRtf(text) + '}' : escapeRtf(text);
  };
  const runsOf = (text, extra = []) => parseInline(stripMentions(String(text || '')))
    .map((seg) => run(seg.image ? String(seg.image.alt || '') : seg.text, [...(seg.marks || []), ...extra]))
    .join('');
  const base = '\\pard\\plain\\f0\\fs' + fs;
  const out = [];
  let list = null;                                         // {ordered, n}
  for (const b of mdBlocks(md, { breakMarker: opts.breakMarker || '' })) {
    if (b.kind !== 'li') list = null;
    const al = RTF_ALIGN[b.align] || '';
    switch (b.kind) {
      case 'pagebreak': out.push('\\page'); break;
      case 'h': {
        const hs = Math.round(fs * (RTF_HEAD_SCALE[Math.min(6, b.level)] || 1));
        out.push('\\pard\\plain\\f0\\fs' + hs + '\\sb240\\sa120\\keepn' + al + '\\b ' + runsOf(b.text) + '\\par');
        break;
      }
      case 'li': {
        if (!list || list.ordered !== b.ordered) list = { ordered: b.ordered, n: b.ordered && Number.isFinite(b.num) ? b.num : 1 };
        else list.n++;
        const mark = b.ordered ? list.n + '.' : '\\bullet';
        out.push(base + '\\li720\\fi-360\\sa60' + al + ' ' + mark + '\\tab ' + runsOf(b.text) + '\\par');
        break;
      }
      case 'quote': out.push(base + '\\li720\\ri720\\sa120' + al + ' ' + runsOf(b.text, ['em']) + '\\par'); break;
      case 'hr': out.push(base + '\\sa120\\brdrb\\brdrs\\brdrw10\\brsp20 \\par'); break;
      case 'code':
        for (const line of String(b.text).split('\n')) out.push('\\pard\\plain\\f1\\fs' + fs + ' ' + escapeRtf(line) + '\\par');
        break;
      case 'figure':
        if (String(b.alt || '').trim()) out.push(base + '\\sa120' + (al || '\\qc') + ' ' + run(String(b.alt), ['em']) + '\\par');
        break;
      default: {
        const lines = b.lines || [b.text];
        if (!lines.join('').trim()) { out.push(base + ' \\par'); break; }      // บรรทัดว่างของผู้เขียน = เนื้อหา
        out.push(base + '\\sa120' + al + ' ' + lines.map((l) => runsOf(l)).join('\\line ') + '\\par');
      }
    }
  }
  const info = (opts.title || opts.author)
    ? '{\\info' + (opts.title ? '{\\title ' + escapeRtf(String(opts.title)) + '}' : '')
      + (opts.author ? '{\\author ' + escapeRtf(String(opts.author)) + '}' : '') + '}\n' : '';
  const head =
    '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n' +
    '{\\fonttbl{\\f0\\fnil\\fcharset0 ' + rtfFontName(opts.font, 'Tahoma') + ';}{\\f1\\fmodern\\fcharset0 Courier New;}}\n' +
    '{\\colortbl;' + colors.map((k) => { const [r, g, bl] = k.split(','); return '\\red' + r + '\\green' + g + '\\blue' + bl + ';'; }).join('') + '}\n' +
    info +
    '\\paperw' + inTw(paper.width) + '\\paperh' + inTw(paper.height) +
    '\\margl' + inTw(m.left) + '\\margr' + inTw(m.right) +
    '\\margt' + inTw(m.top) + '\\margb' + inTw(m.bottom) + '\n' +
    '\\f0\\fs' + fs + '\n';
  return head + out.join('\n') + '\n}\n';
}
