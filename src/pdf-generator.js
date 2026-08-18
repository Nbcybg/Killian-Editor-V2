// pdf-generator.js — ตัวสร้าง PDF ในโปรแกรม (ข้อ 69 · 87 · 89)
//
//   69  เขียน PDF เองด้วย pdf-lib → คุมได้ทุกจุด (ฝังฟอนต์ไทย · ตำแหน่งเป็นนิ้วจริง · ลายน้ำ)
//   87  สารบัญ = PDF bookmark (outline) ต่อหัวฉาก → กระโดดในโปรแกรมอ่าน PDF ได้
//   89  OpenAction → เปิดไฟล์แล้วเด้งไปหน้าที่กำลังเขียนอยู่
//   90  วาดหน้าปกจาก sp-title-pages.js นำหน้าบท
//   91  วาดหัวกระดาษจาก sp-headers.js ซ้ำทุกหน้า
//   88  ไม่พิมพ์ element ที่ผู้ใช้เลือกตัด + วาดกรอบรอบโน้ตได้
//
// ทำไมไม่ใช้ printToPDF ของ Chromium อย่างเดียว:
//   เส้นทางนั้นคุมได้แค่ CSS — ทำ bookmark / OpenAction / เลขหน้าเริ่มต้นรายไฟล์ ไม่ได้
//   ทั้งสองทางอยู่ร่วมกัน: "ส่งออก PDF" เดิม = Chromium · "ส่งออก PDF (ในโปรแกรม)" = ไฟล์นี้
//
// ไฟล์นี้ไม่แตะ DOM/kapi — รับไบต์ฟอนต์เข้ามา คืน Uint8Array ออกไป → เทสด้วย node ได้

import { t as tt, t } from './i18n.js';
import { PDFDocument, StandardFonts, PDFName, PDFHexString, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
// [alpha.82] ต้องนับความกว้างแบบเดียวกับ wrapLines() เป๊ะ ไม่งั้น PDF กับหน้าจอตัดหน้าคนละที่

import { wrapScriptLines } from './sp-format.js';
import { mergeSpFormat, textWidth, lineHeightIn, paginate, pageNumberLabel,
         CHARS_PER_INCH } from './sp-format.js';
import { mergeHeaders, headerStringsFor, headerLineCount, linesForBody } from './sp-headers.js';
import { normalizeTitlePages } from './sp-title-pages.js';
import { num, numClamp } from './num.js';

export const PT_PER_IN = 72;


export const PDF_DEFAULTS = {
  toc: true,                   // [87] bookmark ต่อหัวฉาก
  openPage: 0,                 // [89] 0 = เปิดหน้าแรกตามปกติ · >0 = เด้งไปหน้านั้น
  headers: true,               // [91] หัวกระดาษซ้ำทุกหน้า
  titlePages: true,            // [90] แนบหน้าปกไว้หน้าแรก
  pageNumbers: true,           // ใช้ค่าจาก fmt.pageNumbers
  sceneNumbers: true,          // ใช้ค่าจาก fmt.sceneNumbers
  startPage: 1,                // เลขหน้าเริ่มต้นของไฟล์นี้ (scenes.json → startPage)
  omit: [],                    // [88] element ที่ไม่ต้องพิมพ์ เช่น ['note','summary']
  drawRectAroundNotes: false,  // [88] วาดกรอบรอบโน้ตที่ยังพิมพ์อยู่
  watermark: '',
  watermarkOpacity: 0.1,
  watermarkSize: 54,
  watermarkAngle: -35,
  fontPt: 12,
};

/**
 * ไฟล์ฟอนต์ที่ฝังลง PDF — อยู่ใน renderer/assets/fonts/
 *
 * ต้องใช้ **สองวงศ์** เพราะไม่มีไฟล์เดียวที่ทำได้ทั้งสองอย่าง:
 *   main  = ฟอนต์ที่มีอักษรไทย (CourierThaiMono) — CourierPrime ไม่มีไทยเลยแม้แต่ตัวเดียว
 *   latin = CourierPrime — ใช้กับเครื่องหมายวรรคตอนสากล
 *
 * **เหตุผลที่ต้องมี latin**: CourierThaiMono เป็นฟอนต์ไทยยุค 1998 ที่ cmap เอา
 * Latin-1/General Punctuation ไป **ชี้ทับด้วย glyph ไทย** — `·` ออกมาเป็น "ท", `©` เป็น "ฃ",
 * `—` `–` `…` `“ ”` เป็นวรรณยุกต์ลอย ๆ  fontkit หา glyph เจอ (id ≠ 0) จึงไม่ฟ้องอะไรเลย
 * แล้วได้ไฟล์ที่ "อ่านออกแต่ผิด" ซึ่งจับได้แค่ตอนเปิดดูด้วยตา
 */
export const PDF_FONT_FILES = {
  main: ['CourierThaiMono.ttf', 'CourierThaiProp.ttf'],
  latin: { regular: 'CourierPrime-Regular.ttf', bold: 'CourierPrime-Bold.ttf',
           italic: 'CourierPrime-Italic.ttf', boldItalic: 'CourierPrime-BoldItalic.ttf' },
};

/**
 * ตัวอักษรนี้ต้องวาดด้วยฟอนต์ละตินไหม
 * ไทย (U+0E00–U+0E7F) · PUA ไทยแบบวินโดวส์ (U+F700–U+F71F) · ASCII → ฟอนต์หลัก
 * ที่เหลือ (เครื่องหมายสากล/อักษรมีเครื่องหมาย/สัญลักษณ์) → ฟอนต์ละติน
 */
export function needsLatinFont(ch) {
  const cp = String(ch).codePointAt(0);
  if (!Number.isFinite(cp)) return false;
  if (cp <= 0x7e) return false;
  if (cp >= 0x0e00 && cp <= 0x0e7f) return false;
  if (cp >= 0xf700 && cp <= 0xf71f) return false;
  return true;
}

/** ซอยข้อความเป็นช่วง ๆ ตามฟอนต์ที่ต้องใช้ — คืน [{text, latin}] */
export function splitFontRuns(text, hasLatin = true) {
  const s = String(text ?? '');
  if (!s) return [];
  if (!hasLatin) return [{ text: s, latin: false }];
  const out = [];
  for (const ch of s) {
    const latin = needsLatinFont(ch);
    const last = out[out.length - 1];
    if (last && last.latin === latin) last.text += ch;
    else out.push({ text: ch, latin });
  }
  return out;
}

/** element ที่ปิดไว้เป็นค่าเริ่มต้นของ "ตัดออกตอนพิมพ์" (ข้อ 88) */
export const OMITTABLE_ELEMENTS = ['note', 'summary', 'outline1', 'outline2', 'outline3', 'image'];

export function mergePdfOptions(user) {
  const u = user && typeof user === 'object' ? user : {};
  const o = { ...PDF_DEFAULTS, ...u };
  o.omit = Array.isArray(u.omit) ? u.omit.filter((k) => typeof k === 'string') : [];
  // กฎ 20: ห้าม `+x || d` — openPage 0 (ไม่เด้งหน้า) เป็นค่าที่ตั้งใจ ไม่ใช่ "ไม่ได้ตั้ง"
  o.openPage = Math.max(0, Math.round(num(o.openPage, 0)));
  o.startPage = Math.max(1, Math.round(num(o.startPage, 1)));
  o.fontPt = numClamp(o.fontPt, 12, 4, 96);
  return o;
}

// ───── ตัดบรรทัด ─────
// [alpha.82] **ใช้ตัวตัดบรรทัดตัวเดียวกับหน้าจอ** — `wrapScriptLines()` ใน sp-format.js
// เดิมที่นี่มีอัลกอริทึมอีกชุด พร้อมคอมเมนต์ว่า "ต้องเหมือน wrapLines() เป๊ะ"
// — แล้วมันก็ไม่เหมือนจริง (ดันบรรทัดเปล่าออกมาทุกย่อหน้าไทย)
// สองชุดที่ต้องตรงกันเป๊ะ = ต้องเป็นชุดเดียว
/** ตัดข้อความเป็นบรรทัด — คืนอาร์เรย์บรรทัดจริง */
export function wrapTextLines(text, widthIn, cpi = CHARS_PER_INCH) {
  const s = String(text ?? '');
  if (!s.trim()) return [''];
  return wrapScriptLines(s, num(widthIn, 6), cpi);
}

/**
 * ที่อยู่ของทุกบล็อกในหน้า (บรรทัดที่เท่าไรนับจากบรรทัดแรกของเนื้อหน้า)
 * มิเรอร์การนับของ paginate(): บล็อกแรกของหน้าไม่มีระยะเว้นก่อน · เครื่องหมายต่อเนื่องไม่เว้น
 */
export function layoutPageLines(page, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const cfg = (el) => f.elements[el] || f.elements.action;
  const out = [];
  let line = 0;
  (page.blocks || []).forEach((b, i) => {
    const c = cfg(b.el);
    const marker = b.more === true || b.contd === true ||
                   b.el === 'more' || b.el === 'continued-top' || b.el === 'continued-bottom';
    // ห้ามใช้ `+c.linesBefore || 10` — บทพูด/วงเล็บมี linesBefore = 0 ซึ่ง falsy
    // จะกลายเป็น 10 (เว้น 1 บรรทัด) แล้วบทพูดหลุดจากชื่อตัวละคร (บทเรียน 5)
    const before = i > 0 && !marker ? Math.round(num(c.linesBefore, 10) / 10) : 0;
    line += before;
    const lines = wrapTextLines(b.text, c.width);
    out.push({ block: b, line, lines });
    line += Math.max(1, b.lines || lines.length);
  });
  return out;
}

// ───────── ฟอนต์ ─────────
const toBytes = (v) => {
  if (!v) return null;
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return new Uint8Array(v);
  if (v.buffer instanceof ArrayBuffer) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return null;
};

/**
 * ตัวอักษรที่ฟอนต์มาตรฐาน (WinAnsi) เขียนไม่ได้ → แทนด้วย ? ไม่งั้น pdf-lib throw ทั้งไฟล์
 * ใช้เฉพาะตอนไม่มีไฟล์ฟอนต์ให้ฝัง (ไทยจะกลายเป็น ? แต่ไฟล์ยังออกได้ ไม่ล้มทั้งการส่งออก)
 */
export function sanitizeForStandardFont(text) {
  return String(text ?? '').replace(/[^\x20-\xff]/g, '?');
}

/**
 * ฝังฟอนต์ — ไม่มีไบต์ = ตกไปใช้ Courier มาตรฐาน (เขียนไทยไม่ได้ แต่ไม่พัง)
 * @param {object} fonts { regular, bold, italic, boldItalic, latin:{regular,bold,italic,boldItalic} }
 * @returns {{regular,bold,italic,boldItalic,latin:object|null,custom:boolean}}
 */
export async function embedFonts(doc, fonts) {
  const f = fonts || {};
  const reg = toBytes(f.regular);
  if (reg) {
    try {
      doc.registerFontkit(fontkit);
      // subset:false — subsetting ฟอนต์ไทยเคยทำวรรณยุกต์หาย (ไฟล์ใหญ่ขึ้นแต่ถูกต้องเสมอ)
      const one = async (b) => (toBytes(b) ? doc.embedFont(toBytes(b), { subset: false }) : null);
      const regular = await doc.embedFont(reg, { subset: false });
      const bold = (await one(f.bold)) || regular;
      const italic = (await one(f.italic)) || regular;
      const boldItalic = (await one(f.boldItalic)) || bold;
      let latin = null;
      const lat = f.latin || {};
      const latReg = await one(lat.regular);
      if (latReg) {
        const lb = (await one(lat.bold)) || latReg;
        latin = { regular: latReg, bold: lb,
                  italic: (await one(lat.italic)) || latReg,
                  boldItalic: (await one(lat.boldItalic)) || lb };
      }
      return { regular, bold, italic, boldItalic, latin, custom: true };
    } catch { /* ฟอนต์เสีย → ใช้มาตรฐาน */ }
  }
  const regular = await doc.embedFont(StandardFonts.Courier);
  return {
    regular,
    bold: await doc.embedFont(StandardFonts.CourierBold),
    italic: await doc.embedFont(StandardFonts.CourierOblique),
    boldItalic: await doc.embedFont(StandardFonts.CourierBoldOblique),
    latin: null, custom: false,
  };
}

const pickFont = (set, bold, italic) =>
  (bold && italic ? set.boldItalic : bold ? set.bold : italic ? set.italic : set.regular);

// ───────── ตัวช่วยวาด ─────────
function makeDrawer(set, custom) {
  const clean = (s) => (custom ? String(s ?? '') : sanitizeForStandardFont(s));
  const widthOf = (font, text, size) => {
    try { return font.widthOfTextAtSize(clean(text), size); }
    catch { return String(text ?? '').length * size * 0.6; }
  };
  /**
   * วาดข้อความหนึ่งบรรทัด (พิกัดเป็น point · y = เส้นฐาน)
   *
   * **วาดทีละช่วงตามฟอนต์**: ฟอนต์ไทยที่ฝังมาชี้ `·` `©` `—` `…` `“ ”` ไปที่ glyph ไทยผิด ๆ
   * (ดู PDF_FONT_FILES) → ซอยบรรทัดเป็นช่วง แล้ววาดช่วงที่ไม่ใช่ไทย/ASCII ด้วย CourierPrime
   * ทั้งสองฟอนต์กว้าง 1229/2048 และ 1228/2048 em ต่อตัว จึงยังเรียงเป็นคอลัมน์เท่ากัน
   *
   * **ตัวหนาปลอม**: ฟอนต์ไทยที่ฝังมามีน้ำหนักเดียว (ดู THAI-FONTS.txt) → เมื่อฟอนต์ตัวหนา
   * เป็นไฟล์เดียวกับตัวปกติ ให้วาดซ้ำเยื้องไปทางขวาเล็กน้อยแทน (ช่วงละตินได้ตัวหนาจริง)
   * @returns {number} ความกว้างที่วาดจริง
   */
  const draw = (page, text, { x, y, size, bold, italic, underline, align, boxWidth, color, opacity, rotate }) => {
    const t = clean(text);
    if (!t) return 0;
    const runs = splitFontRuns(t, !!set.latin);
    const fontFor = (r) => (r.latin ? pickFont(set.latin, bold, italic) : pickFont(set, bold, italic));
    const ws = runs.map((r) => widthOf(fontFor(r), r.text, size));
    const w = ws.reduce((a, b) => a + b, 0);
    let px = x;
    if (boxWidth > 0) {
      if (align === 'center') px = x + Math.max(0, (boxWidth - w) / 2);
      else if (align === 'right') px = x + Math.max(0, boxWidth - w);
    }
    // ข้อความที่หมุน (ลายน้ำ) ต้องเดินตามแนวเส้นฐานที่เอียง ไม่ใช่ตามแกน x เฉย ๆ
    // (แม่แบบลายน้ำมาตรฐานคือ "{ชื่อ} · {วันที่}" ซึ่งมี `·` อยู่ด้วย จึงต้องสลับฟอนต์ให้ได้)
    const rad = rotate ? num(rotate.angle, 0) * Math.PI / 180 : 0;
    const ux = Math.cos(rad), uy = Math.sin(rad);
    let cx = px, cy = y;
    runs.forEach((r, i) => {
      const opts = { x: cx, y: cy, size, font: fontFor(r) };
      if (color) opts.color = color;
      if (Number.isFinite(opacity)) opts.opacity = opacity;
      if (rotate) opts.rotate = rotate;
      try { page.drawText(r.text, opts); } catch { return; }
      if (bold && opts.font === (r.latin ? set.latin.regular : set.regular)) {
        try { page.drawText(r.text, { ...opts, x: cx + size * 0.035 }); } catch {}
      }
      const adv = ws[i] || 0;
      cx += adv * ux; cy += adv * uy;
    });
    if (underline) {
      try {
        page.drawLine({ start: { x: px, y: y - size * 0.12 }, end: { x: px + w, y: y - size * 0.12 },
                        thickness: Math.max(0.5, size * 0.06) });
      } catch {}
    }
    return w;
  };
  return { draw, widthOf, clean };
}

/**
 * สร้าง PDF ของบทภาพยนตร์
 * @param {object} args
 *   blocks       [{el,text}] จาก blocksFromDoc (ห้ามใช้ parseScript(getMarkdown()) — บทเรียน 60)
 *   fmt          รูปแบบบท (sp-format) — ไม่ส่ง = ค่ามาตรฐาน Letter
 *   headers      ค่าหัวกระดาษ (sp-headers)
 *   titlePages   [{strings:[…]}] หน้าปก (sp-title-pages)
 *   fonts        {regular,bold,italic,boldItalic} เป็น Uint8Array / อาร์เรย์ไบต์
 *   meta         {title, author, draft, date, copyright, subject, keywords}
 *   opts         ดู PDF_DEFAULTS
 * @returns {Promise<{bytes:Uint8Array, pageCount:number, titleCount:number, bookmarks:Array}>}
 */
export async function generatePdf(args = {}) {
  const fmt = args.fmt && args.fmt.elements ? args.fmt : mergeSpFormat(args.fmt);
  const opts = mergePdfOptions(args.opts);
  const hdr = mergeHeaders(opts.headers ? args.headers : null);
  const meta = args.meta || {};
  const titles = opts.titlePages ? normalizeTitlePages(args.titlePages) : [];

  const omit = new Set(opts.omit);
  const blocks = (args.blocks || [])
    .filter((b) => b && b.el !== 'blank' && !omit.has(b.el));

  const bodyLines = linesForBody(fmt, hdr);
  const paged = paginate(blocks, { fmt, lines: bodyLines });

  const doc = await PDFDocument.create();
  const set = await embedFonts(doc, args.fonts);
  const { draw, widthOf } = makeDrawer(set, set.custom);

  const pw = +fmt.paper.width * PT_PER_IN;
  const ph = +fmt.paper.height * PT_PER_IN;
  const mgL = fmt.margins.left * PT_PER_IN;
  const mgT = fmt.margins.top * PT_PER_IN;
  const size = opts.fontPt;
  const lineH = lineHeightIn(fmt) * PT_PER_IN;
  const tw = textWidth(fmt.paper, fmt.margins);
  const hdrLines = headerLineCount(hdr);

  const newPage = () => doc.addPage([pw, ph]);
  /** เส้นฐานของบรรทัดที่ n (0-based) นับจากบรรทัดแรกของ "เนื้อหน้า" */
  const baseline = (n) => ph - mgT - (hdrLines + n) * lineH - size * 0.82;

  const wmText = String(opts.watermark || '').trim();
  const stampWatermark = (page) => {
    if (!wmText) return;
    const s = Math.max(8, num(opts.watermarkSize, 54));
    const w = widthOf(pickFont(set, false, false), wmText, s);
    draw(page, wmText, {
      // มุม 0 องศา (แนวนอน) เป็นค่าที่ผู้ใช้ตั้งได้จริง — `|| 0` จึงไม่ผิด แต่ใช้ num() ให้เหมือนกันทั้งไฟล์
      x: (pw - w * 0.8) / 2, y: ph / 2 - s / 2, size: s, boxWidth: 0,
      color: rgb(0, 0, 0), opacity: numClamp(opts.watermarkOpacity, 0.1, 0.02, 0.5),
      rotate: degrees(num(opts.watermarkAngle, 0)),
    });
  };

  // ── [90] หน้าปก ──
  for (const tp of titles) {
    const page = newPage();
    stampWatermark(page);
    for (const s of tp.strings) {
      const text = String(s.text ?? '');
      if (!text.trim()) continue;
      const x = num(s.x, 0) * PT_PER_IN;
      const boxW = (num(s.width, 0) > 0 ? num(s.width, 0) : Math.max(0.5, tw)) * PT_PER_IN;
      const sz = numClamp(s.size, 12, 4, 96);
      const lh = sz * 1.2;
      // ตัวอักษรบนหน้าปกปรับขนาดได้ → จำนวนตัว/บรรทัดคิดจากขนาดจริง ไม่ใช่ 10 ตัว/นิ้วของ 12pt
      const cpi = CHARS_PER_INCH * 12 / sz;
      const lines = wrapTextLines(text, boxW / PT_PER_IN, cpi);
      lines.forEach((ln, i) => {
        draw(page, ln, {
          x, y: ph - num(s.y, 0) * PT_PER_IN - lh * (i + 1) + lh * 0.22,
          size: sz, bold: s.bold, italic: s.italic, underline: s.underline,
          align: s.align, boxWidth: boxW,
        });
      });
    }
  }

  // ── บทเนื้อหา ──
  const bookmarks = [];       // [87] {title, pageIndex, y}
  const noteRects = [];
  const hdrCtx = {
    TITLE: meta.title || '', AUTHOR: meta.author || '', DRAFT: meta.draft || '',
    DATE: meta.date || '', COPYRIGHT: meta.copyright || '', PAGES: paged.count,
  };

  paged.pages.forEach((pg, pi) => {
    const page = newPage();
    stampWatermark(page);
    const rows = layoutPageLines(pg, fmt);

    // [91] หัวกระดาษ
    const hdrRows = headerStringsFor(pg.index, hdr, {
      ...hdrCtx, PAGE: opts.startPage + pg.index - 1,
      SCENE: (rows.find((r) => r.block.el === 'scene') || { block: {} }).block.text || '',
    });
    for (const r of hdrRows) {
      draw(page, r.text, {
        x: mgL + num(r.xOffset, 0) * PT_PER_IN, y: ph - mgT - size * 0.82,
        size, bold: r.bold, italic: r.italic, underline: r.underline,
        align: r.align, boxWidth: tw * PT_PER_IN,
      });
    }

    // เลขหน้าตามรูปแบบบท (ธรรมเนียม: มุมขวาบนของกระดาษ ไม่ใช่ในหัวกระดาษ)
    if (opts.pageNumbers) {
      const label = pageNumberLabel(pg.index, fmt, opts.startPage);
      if (label) {
        const w = widthOf(pickFont(set, false, false), label, size);
        draw(page, label, {
          x: pw - (fmt.pageNumbers.right || 1) * PT_PER_IN - w, boxWidth: 0,
          y: ph - (fmt.pageNumbers.top ?? 0.5) * PT_PER_IN - size * 0.82, size,
        });
      }
    }

    for (const row of rows) {
      const b = row.block;
      const c = fmt.elements[b.el] || fmt.elements.action;
      const st = (fmt.styles[b.el] || fmt.styles.action).print;
      const marker = b.el === 'more' || b.el === 'continued-top' || b.el === 'continued-bottom';
      const ind = num(c.indent, fmt.margins.left);
      const x = marker ? markerX(b, fmt) * PT_PER_IN : ind * PT_PER_IN;
      const boxW = marker ? tw * PT_PER_IN
        : Math.max(0.3, Math.min(num(c.width, 6), tw - (ind - fmt.margins.left))) * PT_PER_IN;
      const align = b.el === 'continued-bottom' || b.el === 'transition' ? 'right' : 'left';
      const lines = row.lines;
      lines.forEach((ln, i) => {
        const text = st && st.caps ? String(ln).toUpperCase() : ln;
        draw(page, text, {
          x, y: baseline(row.line + i), size, boxWidth: boxW, align,
          bold: !!(st && st.bold), italic: !!(st && st.italic), underline: !!(st && st.underline),
        });
      });

      // [alpha.57a] เลขฉากสองฝั่งของหัวฉาก
      if (opts.sceneNumbers && b.el === 'scene' && fmt.sceneNumbers.show && b.sceneNo) {
        const label = String(b.sceneNo) + (fmt.sceneNumbers.suffix || '');
        const y = baseline(row.line);
        draw(page, label, { x: (fmt.sceneNumbers.left || 0.75) * PT_PER_IN, y, size, boxWidth: 0 });
        const w = widthOf(pickFont(set, false, false), label, size);
        draw(page, label, { x: pw - (fmt.sceneNumbers.right || 1) * PT_PER_IN - w, y, size, boxWidth: 0 });
      }

      // [87] เก็บหัวฉากไว้ทำ bookmark
      if (b.el === 'scene' && String(b.text || '').trim()) {
        bookmarks.push({ title: String(b.text).trim(), pageIndex: titles.length + pi,
                         y: baseline(row.line) + size });
      }
      // [88] กรอบรอบโน้ต
      if (opts.drawRectAroundNotes && b.el === 'note') {
        noteRects.push({ page, x: x - 3, y: baseline(row.line + lines.length - 1) - size * 0.3,
                         w: boxW + 6, h: lines.length * lineH + size * 0.3 });
      }
    }
    for (const r of noteRects.splice(0)) {
      try {
        r.page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h,
                               borderWidth: 0.7, borderColor: rgb(0.45, 0.45, 0.45) });
      } catch {}
    }

    // ── [55][56] CONTINUED: ต้นหน้า / (CONTINUED) ท้ายหน้า ──
    // paginate() ไม่กันบรรทัดไว้ให้สองตัวนี้ (บนจอเป็น decoration ที่ไม่กินที่ในเอกสาร)
    // → วาดใน "ระยะขอบ" เหมือนเลขหน้า: บนหนึ่งบรรทัดเหนือเนื้อหน้า ล่างหนึ่งบรรทัดใต้เนื้อหน้า
    // ระยะขอบ 1 นิ้ว = 6 บรรทัด จึงมีที่เหลือแน่นอน และการจัดหน้าไม่ขยับเลย
    if (pg.continuedTop) {
      draw(page, pg.continuedTop, { x: mgL, y: baseline(-1), size, boxWidth: tw * PT_PER_IN,
                                    align: 'left' });
    }
    if (pg.continuedBottom) {
      draw(page, pg.continuedBottom, { x: mgL, y: baseline(bodyLines), size,
                                       boxWidth: tw * PT_PER_IN, align: 'right' });
    }
  });

  // ── เมทาดาทาของไฟล์ ──
  try {
    if (meta.title) doc.setTitle(String(meta.title));
    if (meta.author) doc.setAuthor(String(meta.author));
    if (meta.subject) doc.setSubject(String(meta.subject));
    doc.setProducer('Killian 2');
    doc.setCreator(tt('ui.pdf.killianKillian'));
  } catch {}

  // ── [87] สารบัญ = PDF outline ──
  if (opts.toc && bookmarks.length) addOutline(doc, bookmarks);
  // ── [89] เปิดไฟล์แล้วไปหน้าที่กำลังเขียน ──
  if (opts.openPage > 0) setOpenPage(doc, titles.length + opts.openPage - 1);

  // useObjectStreams:false — ค่าเริ่มต้นของ pdf-lib คือ true ซึ่งยัด dict ทั้งหมดลง
  // object stream ที่บีบอัดไว้ (PDF 1.5+) ทำให้โปรแกรมอ่าน PDF รุ่นเก่า/โรงพิมพ์บางที่
  // อ่าน /Outlines /OpenAction ไม่เจอ · pdf-lib ไม่บีบอัด content stream อยู่แล้ว
  // ปิดไปจึงแลกขนาดไฟล์เพิ่มเล็กน้อยกับ "เปิดได้ทุกที่" + ตรวจสอบไฟล์ได้ตรง ๆ
  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, pageCount: doc.getPageCount(), titleCount: titles.length,
           scriptPages: paged.count, bookmarks };
}

/** ระยะเยื้องของเครื่องหมายต่อเนื่อง (นิ้วจากขอบกระดาษ) */
function markerX(b, fmt) {
  if (b.el === 'more') return +(fmt.continued?.indent ?? 3.7);
  return fmt.margins.left;      // CONTINUED: / (CONTINUED) กินความกว้างเต็มพื้นที่พิมพ์
}

/**
 * [87] ใส่ bookmark (outline) ลง PDF — pdf-lib 1.x ไม่มี API ระดับสูง จึงประกอบ dict เอง
 * โครง PDF: Catalog → /Outlines → รายการลูกโซ่ First/Last/Next/Prev + /Dest ชี้หน้า
 */
export function addOutline(doc, entries) {
  const list = (entries || []).filter((e) => e && String(e.title || '').trim());
  if (!list.length) return 0;
  const ctx = doc.context;
  const pages = doc.getPages();
  const outlinesRef = ctx.nextRef();
  const refs = list.map(() => ctx.nextRef());

  list.forEach((e, i) => {
    const p = pages[Math.max(0, Math.min(pages.length - 1, e.pageIndex | 0))];
    const dict = {
      Title: PDFHexString.fromText(String(e.title).trim()),
      Parent: outlinesRef,
      Dest: [p.ref, PDFName.of('XYZ'), 0, Number.isFinite(e.y) ? e.y : p.getHeight(), null],
    };
    if (i > 0) dict.Prev = refs[i - 1];
    if (i < refs.length - 1) dict.Next = refs[i + 1];
    ctx.assign(refs[i], ctx.obj(dict));
  });

  ctx.assign(outlinesRef, ctx.obj({
    Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: refs.length,
  }));
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
  // /PageMode /UseOutlines = เปิดไฟล์แล้วโชว์แถบสารบัญเลย
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  return refs.length;
}

/**
 * [alpha.81r2] ต่อ PDF หลายก้อนเป็นเล่มเดียว แล้วประทับเลขหน้า **เฉพาะเนื้อเรื่อง**
 *
 * ═══ ทำไมต้องมี ═══
 * PDF ของนิยายเกิดจาก `printToPDF` ของ Chromium ซึ่งไม่มีทางสั่งว่า "อย่านับหน้าปก"
 * (Chromium ไม่รองรับ margin box ของ `@page` และ footerTemplate ก็นับทุกหน้าเสมอ)
 * ผู้ใช้บอกชัดว่า **เลขหน้าไม่นับหน้าปกและหน้ารายชื่อตัวละคร** ซึ่งเป็นธรรมเนียมหนังสือจริง
 * ทางที่คุมได้จริงคือประกอบเองทีหลัง: หน้าปก/รายชื่อเป็น PDF ก้อนหนึ่ง เนื้อเรื่องอีกก้อนหนึ่ง
 * เอามาต่อกันแล้ววาดเลขหน้าลงเฉพาะก้อนหลัง — เลขหน้าเริ่มที่ 1 ของเนื้อเรื่องเสมอ
 *
 * @param {Array<Uint8Array|number[]>} frontParts ก้อนหน้าแรก ๆ ที่ **ไม่นับเลขหน้า**
 * @param {Uint8Array|number[]} bodyBytes         เนื้อเรื่อง (นับเลขหน้าจาก 1)
 * @param {object} o { fmt, fonts, pageNumbers, startPage }
 * @returns {Promise<{bytes:Uint8Array, pageCount:number, frontCount:number}>}
 */
export async function mergeAndNumber(frontParts, bodyBytes, o = {}) {
  const fmt = o.fmt && o.fmt.elements ? o.fmt : mergeSpFormat(o.fmt);
  const out = await PDFDocument.create();
  const add = async (src) => {
    const b = toBytes(src);
    if (!b || !b.length) return 0;
    const d = await PDFDocument.load(b, { ignoreEncryption: true });
    const pages = await out.copyPages(d, d.getPageIndices());
    for (const p of pages) out.addPage(p);
    return pages.length;
  };
  let frontCount = 0;
  for (const part of (frontParts || [])) frontCount += await add(part);
  const bodyStart = out.getPageCount();
  await add(bodyBytes);

  if (o.pageNumbers !== false && fmt.pageNumbers && fmt.pageNumbers.show) {
    const set = await embedFonts(out, o.fonts);
    const { draw, widthOf } = makeDrawer(set, set.custom);
    const size = numClamp(o.fontPt, 12, 4, 96);
    const pages = out.getPages();
    for (let i = bodyStart; i < pages.length; i++) {
      // index ของ "หน้าในเนื้อเรื่อง" เริ่มที่ 1 — หน้าปก/รายชื่อไม่ถูกนับเลย
      const label = pageNumberLabel(i - bodyStart + 1, fmt, o.startPage);
      if (!label) continue;
      const page = pages[i];
      const w = widthOf(pickFont(set, false, false), label, size);
      draw(page, label, {
        x: page.getWidth() - (fmt.pageNumbers.right || 1) * PT_PER_IN - w, boxWidth: 0,
        y: page.getHeight() - (fmt.pageNumbers.top ?? 0.5) * PT_PER_IN - size * 0.82, size,
      });
    }
  }
  if (o.meta && o.meta.title) { try { out.setTitle(String(o.meta.title)); } catch {} }
  return { bytes: await out.save(), pageCount: out.getPageCount(), frontCount };
}

/** [89] ให้โปรแกรมอ่าน PDF เปิดมาที่หน้า index (0-based) */
export function setOpenPage(doc, index) {
  const pages = doc.getPages();
  if (!pages.length) return false;
  const i = Math.max(0, Math.min(pages.length - 1, index | 0));
  const p = pages[i];
  doc.catalog.set(PDFName.of('OpenAction'),
    doc.context.obj([p.ref, PDFName.of('XYZ'), null, null, null]));
  return true;
}
