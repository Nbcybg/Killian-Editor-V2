// export-rtf.js — ส่งออกเป็น Rich Text Format (.rtf) ตามข้อ 68
// บริสุทธิ์ 100% : รับ blocks ([{el,text}]) + รูปแบบบท (sp-format) → คืนสตริง RTF
// ทดสอบด้วย node ได้ (test/sp-export.test.cjs)
//
// สำคัญ: RTF เป็นไฟล์ ANSI — ภาษาไทย (และอักขระ >127 ทุกตัว) ต้องเขียนเป็น \uNNNN?
//        ไม่งั้น Word/Pages เปิดแล้วได้ตัวขยะ (บทเรียนเดียวกับข้อ 14d เรื่องไบนารี)

import { T } from './i18n.js';
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
  return String(s ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
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
      out.push('\\pard\\plain\\f0\\fs' + fs + '\\qc\\sb480 ' + escapeRtf(T`เขียนโดย`) + '\\par');
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
    if (!text.trim() && b.el === 'action') continue;
    const { ctrl, caps } = paraCtrl(b.el, f, opts && opts.fontPt);
    out.push(ctrl + ' ' + escapeRtf(caps ? text.toUpperCase() : text) + '\\par');
  }

  return head + out.join('\n') + '\n}\n';
}
