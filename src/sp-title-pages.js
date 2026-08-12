// sp-title-pages.js — หน้าปก / หน้าต้นเรื่อง หลายหน้า (ข้อ 90)
// บริสุทธิ์ 100% : ไม่แตะ DOM / kapi / state → ทดสอบด้วย node ได้ (test/sp-title-pages.test.cjs)
//
// โครงข้อมูล (เก็บใน project.khn.json → titlePages)
//   pages: [ { strings: [ {text, x, y, size, font, bold, italic, underline, align, width} ] } ]
//
// **หน่วยเป็น "นิ้ววัดจากขอบกระดาษ"** เหมือน sp-format.js ทุกที่ในโปรแกรม
// (Trelby ใช้ point — แต่ K2 วัดเป็นนิ้วทั้งระบบ ปนหน่วยแล้วผู้ใช้สับสนกับแท็บ "หน้ากระดาษ")
//
// หน้าปกไม่นับรวมกับเลขหน้าของบท (ธรรมเนียม: หน้าแรกของบท = หน้า 1)

import { T } from './i18n.js';
import { mergeSpFormat, textWidth } from './sp-format.js';
import { num } from './num.js';

export const TITLE_PAGE_VERSION = 1;
export const TITLE_ALIGNS = ['left', 'center', 'right'];

/** ค่าเริ่มต้นของสตริงหนึ่งชิ้น */
export function newTitleString(patch = {}) {
  return {
    text: '', x: 1.5, y: 4.5, size: 12, font: '',
    bold: false, italic: false, underline: false,
    align: 'left', width: 0,          // width = 0 → กว้างเท่าพื้นที่พิมพ์ที่เหลือ
    ...patch,
  };
}

export function newTitlePage(strings) {
  return { strings: Array.isArray(strings) ? strings.map((s) => newTitleString(s)) : [] };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** ทำให้ข้อมูลที่อ่านจากไฟล์อยู่ในรูปที่ UI/ตัววาดใช้ได้เสมอ */
export function normalizeTitlePages(list) {
  const arr = Array.isArray(list) ? list : (list && Array.isArray(list.pages) ? list.pages : []);
  return arr.map((p) => newTitlePage(
    (Array.isArray(p?.strings) ? p.strings : []).map((s) => ({
      text: String(s?.text ?? ''),
      x: clamp(num(s?.x, 1.5), -2, 40),
      y: clamp(num(s?.y, 4.5), -2, 40),
      size: clamp(num(s?.size, 12), 4, 96),
      font: String(s?.font ?? ''),
      bold: s?.bold === true, italic: s?.italic === true, underline: s?.underline === true,
      align: TITLE_ALIGNS.includes(s?.align) ? s.align : 'left',
      width: clamp(num(s?.width, 0), 0, 40),
    }))));
}

/**
 * หน้าปกมาตรฐานอุตสาหกรรม สร้างจาก "ข้อมูลผลงาน" (project.khn.json → meta)
 * ชื่อเรื่องกลางหน้าเยื้องลงมา ~1/3 · ชื่อคนเขียนใต้ลงมา · ข้อมูลติดต่อมุมล่างซ้าย
 * @param {object} meta { title, author, screenplayBy, basedOn, contact, copyright, draft }
 * @param {object} fmt  รูปแบบบท (เอาไว้คิดกึ่งกลาง/ขอบล่างของกระดาษที่ผู้ใช้ตั้ง)
 */
export function defaultTitlePages(meta = {}, fmt = null) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const L = f.margins.left;
  const bottom = +f.paper.height - f.margins.bottom;
  const tw = textWidth(f.paper, f.margins);
  const mid = (y, text, patch) => newTitleString({
    text, x: L, y, width: tw, align: 'center', size: 12, ...patch });

  const rows = [mid(3.6, String(meta.title || T`ไม่มีชื่อเรื่อง`), { bold: true })];
  const by = String(meta.screenplayBy || '').trim() || T`บทโดย`;
  rows.push(mid(4.2, by));
  if (String(meta.author || '').trim()) rows.push(mid(4.6, String(meta.author).trim()));
  if (String(meta.basedOn || '').trim()) rows.push(mid(5.4, T`สร้างจาก ` + String(meta.basedOn).trim()));
  if (String(meta.draft || '').trim()) {
    rows.push(newTitleString({ text: String(meta.draft).trim(), x: L, y: bottom - 1.4,
                               width: tw, align: 'left', size: 12 }));
  }
  const contact = String(meta.contact || '').trim();
  if (contact) {
    rows.push(newTitleString({ text: contact, x: L, y: bottom - 1.0,
                               width: tw, align: 'left', size: 12 }));
  }
  const cr = String(meta.copyright || '').trim();
  if (cr) {
    rows.push(newTitleString({ text: cr, x: L, y: bottom - 0.3,
                               width: tw, align: 'right', size: 10 }));
  }
  return [newTitlePage(rows)];
}

/**
 * ตัวแก้ไขหน้าปก — เก็บสถานะไว้ให้ UI เรียกได้ตรง ๆ
 * ทุกเมธอดคืน `true` เมื่อเปลี่ยนจริง เพื่อให้ UI รู้ว่าต้องวาดใหม่/ตั้ง dirty
 */
export class TitlePageEditor {
  constructor(pages) {
    this.pages = normalizeTitlePages(pages);
  }

  get count() { return this.pages.length; }
  page(i) { return this.pages[i] || null; }
  strings(i) { const p = this.page(i); return p ? p.strings : []; }

  addPage(at) {
    const i = Number.isFinite(+at) ? clamp(Math.round(+at), 0, this.pages.length) : this.pages.length;
    this.pages.splice(i, 0, newTitlePage());
    return i;
  }
  deletePage(i) {
    if (!this.page(i)) return false;
    this.pages.splice(i, 1);
    return true;
  }
  /**
   * ทำสำเนาหน้าปก — วางไว้ถัดจากหน้าต้นฉบับ · คืน index ของหน้าใหม่ (-1 = ไม่มีหน้านั้น)
   * ต้อง deep-copy ทุกสตริง ไม่งั้นแก้หน้าใหม่แล้วหน้าเดิมเปลี่ยนตาม
   */
  duplicatePage(i) {
    const p = this.page(i);
    if (!p) return -1;
    const copy = newTitlePage(p.strings.map((s) => newTitleString(s)));
    this.pages.splice(i + 1, 0, copy);
    return i + 1;
  }
  /** ย้ายหน้า (ลาก/ปุ่มขึ้น-ลง) — คืน index ใหม่ หรือ -1 เมื่อย้ายไม่ได้ */
  movePage(from, to) {
    if (!this.page(from)) return -1;
    const t = clamp(Math.round(+to), 0, this.pages.length - 1);
    if (t === from) return from;
    const [p] = this.pages.splice(from, 1);
    this.pages.splice(t, 0, p);
    return t;
  }

  addString(pageIdx, patch) {
    const p = this.page(pageIdx);
    if (!p) return -1;
    p.strings.push(newTitleString(patch || {}));
    return p.strings.length - 1;
  }
  updateString(pageIdx, strIdx, patch) {
    const list = this.strings(pageIdx);
    if (!list[strIdx]) return false;
    list[strIdx] = normalizeTitlePages([{ strings: [{ ...list[strIdx], ...(patch || {}) }] }])[0].strings[0];
    return true;
  }
  deleteString(pageIdx, strIdx) {
    const list = this.strings(pageIdx);
    if (!list[strIdx]) return false;
    list.splice(strIdx, 1);
    return true;
  }
  moveString(pageIdx, from, to) {
    const list = this.strings(pageIdx);
    if (!list[from]) return -1;
    const t = clamp(Math.round(+to), 0, list.length - 1);
    if (t === from) return from;
    const [s] = list.splice(from, 1);
    list.splice(t, 0, s);
    return t;
  }

  /** สตริงทุกชิ้นของทุกหน้าที่มีข้อความจริง (ใช้ตอนวาด/ส่งออก) */
  filled() {
    return this.pages.map((p) => ({
      strings: p.strings.filter((s) => String(s.text ?? '').trim() !== ''),
    }));
  }

  toJSON() { return { version: TITLE_PAGE_VERSION, pages: this.pages }; }

  /** HTML ของหน้าเดียว (พรีวิวในกล่อง) — คืน '' เมื่อไม่มีหน้านั้น */
  renderToHtml(pageIdx, fmt) {
    const p = this.page(pageIdx);
    return p ? titlePageInnerHtml(p, fmt) : '';
  }
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * ชิ้นส่วน HTML ในหน้าปกหนึ่งหน้า (ตัว `<div>` ที่วางแบบ absolute)
 * x/y = นิ้วจากขอบกระดาษ → ผู้เรียกต้องทำ container เป็นขนาดกระดาษเต็มใบ (position:relative)
 */
export function titlePageInnerHtml(page, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const tw = textWidth(f.paper, f.margins);
  return (page && page.strings ? page.strings : [])
    .filter((s) => String(s.text ?? '').trim() !== '')
    .map((s) => {
      const w = num(s.width, 0) > 0
        ? Math.min(num(s.width, 0), +f.paper.width - num(s.x, 0))
        : Math.max(0.5, Math.min(tw, +f.paper.width - num(s.x, 0) - f.margins.right));
      const st = [
        'position:absolute',
        `left:${+num(s.x, 0).toFixed(4)}in`,
        `top:${+num(s.y, 0).toFixed(4)}in`,
        `width:${+w.toFixed(4)}in`,
        `font-size:${+num(s.size, 12)}pt`,
        `text-align:${TITLE_ALIGNS.includes(s.align) ? s.align : 'left'}`,
        s.font ? `font-family:${cssFamily(s.font)}` : '',
        s.bold ? 'font-weight:700' : 'font-weight:400',
        s.italic ? 'font-style:italic' : 'font-style:normal',
        s.underline ? 'text-decoration:underline' : 'text-decoration:none',
        'white-space:pre-wrap',
      ].filter(Boolean).join(';');
      return `<div class="sp-tp-str" style="${st}">${esc(s.text)}</div>`;
    }).join('');
}

/** ชื่อวงศ์ฟอนต์ที่ปลอดภัยพอจะเขียนลงกฎ CSS (กันสตริงหลุดไปปิด declaration) */
export function cssFamily(name) {
  const s = String(name ?? '').replace(/["'\\;{}()<>]/g, '').trim();
  return s ? `"${s}",monospace` : '';
}

/**
 * HTML ของ "หน้าปกทั้งชุด" — แต่ละหน้าเป็น <section class="pg pg-title">
 * ใช้กับ kapi.pdfFromHtml ได้ทันที (ใส่ก่อนหน้าบท)
 */
export function titlePagesHtml(pages, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const list = normalizeTitlePages(pages);
  return list.map((p) => `<section class="pg pg-title">${titlePageInnerHtml(p, f)}</section>`).join('\n');
}

/** CSS ของหน้าปก (กระดาษเต็มใบ ไม่มีระยะขอบ เพราะ x/y วัดจากขอบกระดาษเอง) */
export function titlePagesCss(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  return [
    `.pg-title{position:relative;width:${+f.paper.width}in;height:${+f.paper.height}in;` +
      'padding:0;margin:0;overflow:hidden;page-break-after:always;break-after:page}',
    '.sp-tp-str{line-height:1.2}',
  ].join('\n');
}

/**
 * ข้อความล้วนของหน้าปก (ใช้ตอนส่งออก .txt / แทรกหัวไฟล์ compile)
 * เรียงตาม y แล้ว x — จัดกลางด้วยช่องว่างตามความกว้างพื้นที่พิมพ์
 */
export function titlePagesText(pages, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const cols = Math.max(20, Math.floor(textWidth(f.paper, f.margins) * 10));
  const out = [];
  normalizeTitlePages(pages).forEach((p, i) => {
    if (i) out.push('', '');
    const rows = p.strings
      .filter((s) => String(s.text ?? '').trim() !== '')
      .slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    for (const s of rows) {
      const text = String(s.text).trim();
      if (s.align === 'center') {
        out.push(' '.repeat(Math.max(0, Math.floor((cols - text.length) / 2))) + text);
      } else if (s.align === 'right') {
        out.push(' '.repeat(Math.max(0, cols - text.length)) + text);
      } else out.push(text);
      out.push('');
    }
    while (out.length && out[out.length - 1] === '') out.pop();
  });
  return out.join('\n');
}

/** จำนวนหน้าปกที่มีเนื้อหาจริง (หน้าเปล่าก็ยังเป็นกระดาษหนึ่งแผ่น — นับด้วย) */
export function titlePageCount(pages) { return normalizeTitlePages(pages).length; }
