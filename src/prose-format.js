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

import { t } from './i18n.js';
import { PAPER_SIZES, MARGIN_DEFAULTS, textWidth } from './sp-format.js';
import { num } from './num.js';
// [alpha.132r2] ข้อความสำหรับแสดงผล/บรรทัดรูป — md.js เป็นเจ้าของไวยากรณ์ .md
import { inlineDisplayText, RE_IMG, mdBlocks } from './md.js';
// [alpha.82] ไทยนับสระ/วรรณยุกต์เป็นตัวเต็มไม่ได้ — ใช้ร่วมกับฝั่งบทภาพยนตร์
import { visualLength, wrapVisual } from './text-width.js';
// [alpha.145] ตาข่ายรองอักษรไทย — ทุกสแตกที่ไฟล์นี้ประกอบเองต้องผ่านตัวนี้
// (lang-fonts.js import แค่ i18n.js → ไม่มีวงวน)
import { withThaiFallback } from './lang-fonts.js';
export { visualLength, ZERO_WIDTH_RE } from './text-width.js';

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
  headingNumberFormat: t('ui.common.chapterN'),
  headingNumberLevel: 1,     // ใส่เลขให้หัวข้อระดับไหน
  headings: null,            // [23] null = HEADING_DEFAULTS
  quote: null,               // [24] null = QUOTE_DEFAULTS
  avgCharEm: 0.5,            // ความกว้างเฉลี่ยต่อตัวอักษร (เท่าของ em) — ใช้ประมาณการนับหน้า
  pageNumbers: false,        // [20] แสดงเลขหน้าในมุมมองหน้ากระดาษ
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
  // [alpha.81r ข้อ 1+2] "ตัวหนังสือไม่ตรงกับที่ตั้งไว้เลย"
  // ต้นตอ: กฎนี้ **ไม่เคยตั้ง font-family/font-size ให้ตัวแก้ไข** — ฟอนต์นิยายที่ผู้ใช้เลือก
  // ถูกใช้แค่ตอนส่งออก (`proseExportCss`) กับมุมมองเรียงหน้าเท่านั้น บนจอจึงเป็นฟอนต์ UI
  // เขียนอย่างหนึ่ง ได้อีกอย่าง · ผู้ใช้สั่งว่า "มุมมอง layout คือตัว override" →
  // ทั้งสองที่ต้องอ่านจาก proseFormat ชุดเดียวกัน (ขนาดผ่าน --ed-fs ที่คิดจาก fontPt ตัวเดียวกัน)
  // ══ [alpha.98 ข้อ 2] ★ **ฟอนต์ตามภาษาในโหมดนิยายไม่เคยทำงานเลย** ══
  //
  // ผู้ใช้: *"ฟอนต์ตามภาษา ใน mode นิยายใช้ไม่ได้"*
  //
  // กฎนี้เขียน `font-family` ลง `.ProseMirror` ตรง ๆ ด้วยตัวเลือกที่ specificity สูงกว่า
  // `.ProseMirror { font-family:var(--ed-font) }` ใน style.css **ทุกกรณี** → วงศ์ "K2 Lang"
  // ที่ applySettings() อุตส่าห์เอาไปนำหน้า `--ed-font` ถูกทับหายตั้งแต่ยังไม่ทันได้ใช้
  // (บั๊กมาตั้งแต่ alpha.81r ที่เพิ่งเริ่มเขียน font-family ลงกฎนี้ — ฝั่งบทไม่โดนเพราะ
  //  `--sp-font` ไม่มีใครเขียนทับ)
  //
  // แก้: อ่านผ่านตัวแปรเสมอ แล้วให้สแตกของ "รูปแบบนิยาย" เป็นแค่ค่าสำรองเมื่อไม่มีตัวแปร
  out.push(`${sel}{font-family:var(--ed-font, ${proseFontStack(f)});` +
           `font-size:var(--ed-fs, ${proseFontPx(f)}px);` +
           `line-height:${f.lineHeight};text-align:${f.align}}`);
  out.push(`${sel} p{margin:0 0 ${f.paraSpacing}em;text-indent:${f.firstLineIndent}in}`);
  // ══ [alpha.98 ข้อ 3] ★ รายการต้องกินที่แนวตั้ง **เท่ากับย่อหน้าเป๊ะ** ══
  //
  // ผู้ใช้: *"ข้อความที่ bullet หรือมีหมายเลข ระยะห่างระหว่างบรรทัดเปลี่ยนไป
  //          พอกด toggle ไปมา แล้วบรรทัดขยับ"*
  //
  // ต้นตอ: กฎ `${sel} p{...}` ข้างบนลงไปถึง `<p>` ที่อยู่ใน `<li>` ด้วย (เป็นตัวเลือกแบบลูกหลาน)
  // ย่อหน้าในข้อรายการจึงได้ทั้ง **ระยะท้ายย่อหน้า** และ **ย่อหน้าบรรทัดแรก** ติดมา
  // แล้ว `<ul>` ยังมี margin ของตัวเองอีก .3em บน-ล่าง → toggle ทีเดียวบรรทัดขยับทันที
  //
  // กติกาใหม่: N ข้อ = N ย่อหน้าเป๊ะ · ระยะระหว่างข้อ = ระยะระหว่างย่อหน้า ·
  // ตัวรายการเองมีระยะท้ายเท่าย่อหน้า และไม่มีระยะนำ (ให้ย่อหน้าก่อนหน้าเป็นคนเว้น)
  out.push(`${sel} ul,${sel} ol{margin:0 0 ${f.paraSpacing}em;` +
           `padding-left:var(--ed-list-pad, 28px)}`);
  out.push(`${sel} li>p{margin:0;text-indent:0}`);
  out.push(`${sel} li+li>p{margin-top:${f.paraSpacing}em}`);
  // รายการซ้อนชั้นก็ไม่เพิ่มระยะเกินมา
  out.push(`${sel} li>ul,${sel} li>ol{margin:0}`);
  // ══ [alpha.134 ข้อ 1] ★ "ย่อหน้าแรกของเอกสาร" ไม่ใช่ "ย่อหน้าแรกหลังหัวข้อ" ══
  //
  // ผู้ใช้: *"เวลาเราใช้ย่อหน้าอัตโนมัติ บรรทัดแรก ต้องย่อหน้า"*
  //
  // ต้นตอ: `> p:first-child` ถูกเหมารวมไว้ในกฎเดียวกับ `hN+p` ใต้สวิตช์
  // **"ย่อหน้าแรกหลังหัวข้อด้วย"** ซึ่งบนหน้าจอตั้งค่าเขียนไว้ชัดว่าเป็นเรื่องของ *หัวข้อ*
  // → เปิดย่อหน้าอัตโนมัติแล้วบรรทัดแรกของฉากไม่ย่อ และไม่มีสวิตช์ไหนแก้ได้เลย
  //   (ติ๊กช่องนั้นก็ได้ย่อหน้าหลังหัวข้อพ่วงมาด้วย ซึ่งเป็นคนละเรื่องกับที่ผู้ใช้ขอ)
  // ตอนนี้ย่อหน้าแรกของเอกสารย่อเสมอเมื่อเปิดย่อหน้าอัตโนมัติ · สวิตช์คุมเฉพาะหลังหัวข้อ
  if (!f.indentAfterHeading) {
    out.push(`${sel} > h1+p,${sel} > h2+p,${sel} > h3+p,` +
             `${sel} > h4+p,${sel} > h5+p,${sel} > h6+p{text-indent:0}`);
  }
  f.headings.forEach((h, i) => {
    const lv = i + 1;
    const parts = [`font-size:${+h.size.toFixed(3)}em`,
                   `font-weight:${h.bold ? 700 : 400}`,
                   `font-style:${h.italic ? 'italic' : 'normal'}`,
                   `margin:${h.before}em 0 ${h.after}em`,
                   // [alpha.145] หัวข้อเขียน font-family ลงไปตรง ๆ (ไม่ผ่าน --ed-font) จึงต้อง
                   // ต่อตาข่ายไทยเอง ไม่งั้นหัวข้อ "ลอย" ทั้งที่เนื้อความไม่ลอย
                   `font-family:${withThaiFallback(proseHeadingStack(f))}`];
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
  return String(f.headingNumberFormat || t('ui.common.chapterN')).replace(/\{n\}/g, String(n));
}

// ───────── 19. CSS ตอนส่งออก (WYSIWYG) ─────────
/**
 * CSS สำหรับไฟล์ HTML ที่ส่งออก — ใช้ตัวเลขชุดเดียวกับที่เห็นบนจอ
 * (เดิม mdToHtml ฝัง Sarabun 18px/1.85 ตายตัว → เขียนอย่างหนึ่ง ได้อีกอย่าง)
 */
/**
 * == [alpha.132r3 ข้อ 1] ** ฟอนต์ของไฟล์ที่ส่งออก ต้องเป็นตัวเดียวกับบนจอ ==
 *
 * ผู้ใช้: *"export ตัว font ไม่ตรงกับ app เลย"*
 *
 * ต้นตอ: **สองฝั่งอ่านคนละแหล่ง** มาตั้งแต่ alpha.97 ข้อ 12 ที่ย้ายฟอนต์นิยายบนจอไปใช้
 * `settings.fontFamily` + "ฟอนต์ตามภาษา" (วงศ์ `K2 Lang`) แล้ว **ลืมฝั่งส่งออกไว้ที่เดิม**
 *   · บนจอ  → `--ed-font` = `withLangFamily(settings.fontFamily, …)`
 *   · ส่งออก → `proseFontStack(fmt)` = `proseFormat.fontFamily` ซึ่งปกติว่าง = ฟอนต์มาตรฐาน
 * ไฟล์ที่ได้จึงเป็นคนละฟอนต์กับที่เขียนอยู่ ทั้งที่ `@font-face` ของ `K2 Lang` ถูกฝังไปด้วยแล้ว
 * (มีวงศ์ให้ใช้ แต่ไม่มีใครเรียกใช้)
 *
 * แก้: ผู้เรียกส่ง **สแตกที่ใช้จริงบนจอ** เข้ามาได้ (`opts.fontStack`/`opts.headingStack`)
 * — ไม่ส่งมาก็ตกไปใช้ของเดิมเป๊ะ จึงไม่กระทบทางที่ไม่มีหน้าจอ (เทส/สคริปต์)
 * @param {{fontStack?:string, headingStack?:string}} [opts]
 */
export function proseExportCss(fmt, paper, margins, opts = {}) {
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  const tw = textWidth(p, m);
  // [alpha.145] ไฟล์ที่ส่งออกไปเปิดในเบราว์เซอร์อื่นก็ต้องไม่ลอย — ต่อตาข่ายไทยทั้งสองสแตก
  const bodyFont = withThaiFallback(String((opts && opts.fontStack) || '').trim() || proseFontStack(f));
  const headFont = withThaiFallback(String((opts && opts.headingStack) || '').trim() || proseHeadingStack(f));
  const body = [
    `font-family:${bodyFont}`,
    `font-size:${f.fontPt}pt`,
    `line-height:${f.lineHeight}`,
    `max-width:${+tw.toFixed(3)}in`,
    'margin:3em auto', 'padding:0 1.2em',
    `text-align:${f.align}`,
    // [alpha.83r ข้อ 2] คำยาวที่ไม่มีจุดตัดต้องถูกหั่น — ตรงกับที่ตัวจัดหน้าคิดไว้
    'overflow-wrap:break-word', 'word-break:break-word',
  ].join(';');
  const out = [`body{${body}}`,
               `p{margin:0 0 ${f.paraSpacing}em;text-indent:${f.firstLineIndent}in}`,
               // ══ [alpha.133 · Y-4] ★ ช่องว่างนำหน้าบรรทัดต้องรอดไปถึงไฟล์ ══
               //
               // ผู้ใช้เยื้องย่อหน้าด้วยการเคาะวรรค/แท็บ (เห็นผลจริงในตัวแก้ไข เพราะ
               // `.ProseMirror` ตั้ง `white-space:break-spaces` ไว้ตั้งแต่ alpha.62)
               // แต่ CSS ที่ส่งออกไม่เคยมีกฎคู่กัน → เบราว์เซอร์ยุบช่องว่างทิ้งตามค่าเริ่มต้น
               // = "เยื้องหายหมด" ทั้งในไฟล์และในช่องตัวอย่าง
               //
               // ★ ตั้งเฉพาะบล็อกที่ **มีแต่ข้อความอยู่ข้างใน** — ห้ามตั้งที่ `body`/`ul`/`blockquote`
               //   เพราะขึ้นบรรทัดใหม่ระหว่างแท็กใน HTML ที่เราประกอบจะกลายเป็นบรรทัดว่างจริง
               'p,h1,h2,h3,h4,h5,h6{white-space:break-spaces}'];
  // ══ [alpha.134 ข้อ 1] ★ กฎ "ไม่ย่อหน้าแรก" ต้องเป็นกฎคู่แฝดกับ `proseCss()` ══
  //
  // สองอย่างที่ต่างกันมาตลอดและไม่มีใครสังเกต:
  //   · ฝั่งจอเป็นกฎแบบมีเงื่อนไข (`if (!f.indentAfterHeading)`) แต่ **ฝั่งไฟล์เขียนตายเสมอ**
  //     → ติ๊ก "ย่อหน้าแรกหลังหัวข้อด้วย" แล้วบนจอย่อ แต่ในไฟล์ไม่ย่อ
  //   · ฝั่งไฟล์ยังกิน `body > p:first-of-type` (ย่อหน้าแรกของเอกสาร) ซึ่งเป็นคนละเรื่อง
  //     กับสวิตช์นั้น — ผู้ใช้: *"ใช้ย่อหน้าอัตโนมัติ บรรทัดแรก ต้องย่อหน้า"*
  if (!f.indentAfterHeading) out.push('h1+p,h2+p,h3+p,h4+p,h5+p,h6+p{text-indent:0}');
  f.headings.forEach((h, i) => {
    out.push(`h${i + 1}{font-size:${+h.size.toFixed(3)}em;font-weight:${h.bold ? 700 : 400};` +
             (h.italic ? 'font-style:italic;' : '') +
             `margin:${h.before}em 0 ${h.after}em;font-family:${headFont}` +
             (h.align ? ';text-align:' + h.align : '') +
             (f.headingColor ? ';color:' + f.headingColor : '') + '}');
  });
  // [alpha.81r ข้อ 2] "ส่งออกต้องตรงกับมุมมองจัดหน้า" — เลขบทอัตโนมัติเคยมีแต่บนจอ
  // (proseCss ใส่ counter ให้ แต่ proseExportCss ไม่เคยมี) → เปิดเลขบทแล้วไฟล์ที่ได้ไม่มีเลขบท
  if (f.headingNumber) {
    const lv = f.headingNumberLevel;
    out.push('body{counter-reset:k-chap}');
    out.push(`h${lv}{counter-increment:k-chap}`);
    out.push(`h${lv}::before{content:"${headingNumberText(f, '" counter(k-chap) "')}\\A";` +
             'white-space:pre;display:block;font-size:.62em;opacity:.72;font-weight:400}');
  }
  const q = f.quote;
  out.push(`blockquote{font-style:${q.italic ? 'italic' : 'normal'};` +
           `padding-left:${q.indent}in;margin:1em 0;` +
           (q.border ? 'border-left:3px solid #ccc' : 'border-left:0') +
           (q.color ? ';color:' + q.color : ';color:#555') + '}');
  out.push('blockquote p{text-indent:0}');
  // == [alpha.132 . X-1 + ข้อ 8] * รายการในไฟล์ที่ส่งออกต้องหน้าตาเหมือนบนจอเป๊ะ ==
  //
  // สองกฎนี้เป็นคู่แฝดของกฎใน style.css (ตัวแก้ไข) - ต้องมาด้วยกันเสมอ:
  //   1. ย่อหน้าในข้อไม่มีระยะย่อหน้า/ระยะท้ายของตัวเอง (ไม่งั้นข้อรายการสูงกว่าย่อหน้าปกติ)
  //   2. จัดกึ่งกลาง/ชิดขวา = ปิด marker ของเบราว์เซอร์ แล้ววาดจุดนำเองในบรรทัดแรกของข้อ
  //      **วาดเป็นวงกลม .36em ไม่ใช่อักขระ `•`** (วัดแล้ว: กลีฟเล็กกว่าวงกลมของเบราว์เซอร์ 36%
  //      และไม่เท่ากันในแต่ละฟอนต์ - ดูบันทึกใน style.css)
  out.push(`ul,ol{margin:0 0 ${f.paraSpacing}em;padding-left:28px}`);
  out.push('li>p{margin:0;text-indent:0}');
  out.push(`li+li>p{margin-top:${f.paraSpacing}em}`);
  out.push('li>ul,li>ol{margin:0}');
  // [alpha.132r3 ข้อ 3] จุดนำ/หมายเลขข้อเป็น **ตัวอักษร** ทั้งสองทาง และรับรูปแบบจากตัวแปร
  // ที่ `<li>` ถือไว้ (มาจากอักษรตัวแรกของข้อ) — กฎชุดเดียวกับ style.css ของตัวแก้ไขเป๊ะ
  out.push('ul > li::marker{content:"•  "}');
  out.push('ol > li::marker{content:counter(list-item) ".  "}');
  out.push('li::marker,li > p:first-child::before{color:var(--k-mk-color, currentColor);' +
           'font-weight:var(--k-mk-weight, inherit);font-style:var(--k-mk-style, inherit)}');
  // [alpha.132r4] `content` ที่เราบังคับไว้ชนะ `list-style-type` → ต้องปิดที่ ::marker ด้วย
  // ไม่งั้นได้จุดนำสองอัน (ของเบราว์เซอร์ที่ขอบซ้าย + ของเราที่กลางบรรทัด)
  out.push('li:has(> p[data-align="center"]:first-child),' +
           'li:has(> p[data-align="right"]:first-child){list-style:none}');
  out.push('li:has(> p[data-align="center"]:first-child)::marker,' +
           'li:has(> p[data-align="right"]:first-child)::marker{content:none}');
  out.push('ul > li > p[data-align="center"]:first-child::before,' +
           'ul > li > p[data-align="right"]:first-child::before' +
           '{content:"•  "}');
  out.push('ol > li > p[data-align="center"]:first-child::before,' +
           'ol > li > p[data-align="right"]:first-child::before' +
           '{content:counter(list-item) ".  "}');
  out.push('hr{border:0;border-top:1px solid #ccc;margin:2em 0}');
  out.push('img{max-width:100%}');
  // [alpha.133 · Y-1] รูปทั้งบรรทัด = `<figure>` เหมือนโหนดของตัวแก้ไข (กฎคู่กับ style.css)
  out.push('figure{margin:1em 0;text-align:center}');
  out.push('figure img{max-width:100%;max-height:480px;border-radius:8px}');
  // ══ [alpha.142 ข้อ 6] ★ รูปที่ปรับขนาด/เต็มหน้า — **กฎคู่แฝด** ของ `.ProseMirror figure.*`
  // ใน style.css (กฎถาวรข้อ 5: เขียนฝั่งหนึ่งต้องเขียนอีกฝั่งในคอมมิตเดียวกัน)
  // ฝั่งไฟล์รู้ขนาดกระดาษจริงอยู่แล้ว จึงใส่อัตราส่วนเป็นตัวเลขตรง ๆ ไม่ต้องพึ่งตัวแปร CSS
  {
    const bh = Math.max(0.5, (+p.height || 11) - (+m.top || 0) - (+m.bottom || 0));
    const pw = +p.width || 8.5, ph = +p.height || 11;
    // ── รูปเต็มหน้า: กล่องสูงเท่าพื้นที่พิมพ์หนึ่งหน้าเป๊ะ (ตัวจัดหน้าให้แผ่นเต็มใบ) ──
    // การ "ชนขอบกระดาษ" เป็นเรื่องของสื่อที่มีหน้ากระดาษเท่านั้น จึงแยกกันสามทางโดยตั้งใจ:
    //   · ไฟล์ .html ที่เปิดในเบราว์เซอร์ = ไม่มีหน้ากระดาษ → รูปเต็มกล่องพื้นที่พิมพ์พอ
    //   · ตอนพิมพ์/PDF → `@media print` ข้างล่าง (หน้าไร้ระยะขอบ)
    //   · ช่องตัวอย่าง/มุมมองจัดหน้า → ตัววาดทาภาพที่ **พื้นของแผ่น** เอง (fullPageImages)
    //     จึงชนขอบจริงโดยไม่ต้องพึ่ง CSS ชุดนี้เลย (scopeCss ทิ้ง @page/@media ให้อยู่แล้ว)
    out.push(`figure.k-img-page{margin:0;position:relative;width:100%;`
             + `aspect-ratio:${+tw.toFixed(4)} / ${+bh.toFixed(4)}}`);
    out.push('figure.k-img-page img{position:absolute;inset:0;width:100%;height:100%;'
             + 'object-fit:cover;max-width:none;max-height:none}');
    // ── ตอนพิมพ์จริง: แผ่นของรูปเต็มหน้าเป็น **หน้าไร้ระยะขอบ** (named page ของ CSS) ──
    // ไม่ต้องอาศัยการล้นออกนอกกล่องหน้า ซึ่งเป็นพฤติกรรมที่เชื่อไม่ได้ตอนพิมพ์
    out.push('@page k-bleed{size:' + pw + 'in ' + ph + 'in;margin:0}');
    out.push('@media print{'
             + 'figure.k-img-page{page:k-bleed;break-before:page;break-after:page;'
             + 'position:static;aspect-ratio:auto;width:' + pw + 'in;height:' + ph + 'in}'
             + 'figure.k-img-page img{position:static;width:' + pw + 'in;height:' + ph + 'in;'
             + 'object-fit:cover;border-radius:0}'
             + '}');
    // [alpha.143 ข้อ 1] เพดานความสูงของรูปที่ตั้งความกว้างเอง = หนึ่งหน้า (คู่กับ style.css)
    // ★ หักระยะขอบของ figure (1em + 1em) ออกจากเพดานด้วย — บล็อกที่สูง "เกินหนึ่งหน้านิดเดียว"
    //   ตัดตามบรรทัดไม่ได้ ตัวจัดหน้าเลยตัดดิบ แล้วรูปถูกผ่ากลางคาบสองแผ่น
    out.push(`figure.k-img-w img{max-height:calc(${+bh.toFixed(4)}in - 2.2em)}`);
  }
  out.push('pre{background:#f4f4f4;padding:10px 14px;border-radius:6px;overflow:auto;' +
           'font-family:' + withThaiFallback('"Courier Prime","Courier New",monospace') +
           ';font-size:.92em;text-indent:0}');
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
  // [alpha.82] ตรรกะจริงอยู่ที่ text-width.js แหล่งเดียว (ดูคำอธิบายบั๊ก off-by-one ที่นั่น)
  return wrapVisual(text, cols, indentCols);
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
    // [alpha.133 · Y-5] ขึ้นหน้าใหม่ด้วยมือ — ตัวประมาณก็ต้องเคารพเหมือนตัววัดของจริง
    // (บล็อกนี้ไม่มีเนื้อหาให้วาด มันคือ "คำสั่ง" ไม่ใช่ข้อความ)
    if (b.type === 'pagebreak') { if (used) push(); continue; }
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
  // [alpha.97 ข้อ 11] เลิกเว้นหน้าแรก — กฎเดียวคือ "หน้าที่ไม่ใช่ฉากไม่มีเลข"
  const i = Math.max(1, Math.round(+index || 1));
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
    // [alpha.133 · Y-5] ขึ้นหน้าใหม่ด้วยมือ (Ctrl+Enter) — ชนิดเดียวกับที่ mdToProseBlocks ให้
    else if (name === 'page_break') type = 'pagebreak';
    const b = { type, text, pos: offset, idx: i++ };
    if (level) b.level = level;
    if (name === 'figure') { b.src = node.attrs.resolved || node.attrs.src; b.alt = node.attrs.alt || ''; }
    out.push(b);
  });
  return out;
}

/**
 * [alpha.81r ข้อ 5] Markdown → บล็อกนิยาย (pure) — รูปแบบเดียวกับ `proseBlocksFromDoc`
 *
 * ตัวอย่างในกล่องส่งออกไม่มีเอกสาร ProseMirror ให้เดินโหนด (เนื้อหาถูกประกอบมาเป็นข้อความแล้ว)
 * จึงต้องมีทางแปลงจากข้อความกลับเป็นบล็อกเพื่อ "จัดหน้า" ให้เห็นหน้ากระดาษจริง
 * — ใช้เกณฑ์ระดับบรรทัดชุดเดียวกับ `mdToHtmlBody` ใน compile.js (หัวข้อ/ยกคำพูด/รายการ/เส้นคั่น)
 */
export function mdToProseBlocks(md) {
  const out = [];
  let i = 0;
  // ══ [alpha.133 · Y-1] ★ สคีมาบล็อกมาจาก `mdBlocks()` ที่เดียว (เหมือน mdToHtmlBody) ══
  // ของเดิมเป็นลูป regex ชุดที่สาม ซึ่งไม่รู้จัก `<!--align:x-->` · `<!--pagebreak-->` ·
  // รั้วโค้ด · hard break เลย — ช่องตัวอย่างจึงโชว์คอมเมนต์เป็นตัวหนังสือกลางหน้ากระดาษ
  // และนับบรรทัดผิดตั้งแต่ต้น (การตัดหน้าเลยไม่มีทางตรงกับไฟล์จริง)
  for (const b of mdBlocks(md)) {
    const push = (o) => out.push({ ...o, idx: i++ });
    if (b.kind === 'pagebreak') { push({ type: 'pagebreak', text: '' }); continue; }
    if (b.kind === 'hr') { push({ type: 'hr', text: '' }); continue; }
    if (b.kind === 'figure') { push({ type: 'figure', text: '', alt: b.alt, src: b.src }); continue; }
    if (b.kind === 'code') { push({ type: 'code', text: b.text, align: b.align }); continue; }
    if (b.kind === 'h') {
      push({ type: 'h' + b.level, level: b.level, align: b.align,
             text: inlineDisplayText(b.text) });
      continue;
    }
    if (b.kind === 'quote') {
      push({ type: 'blockquote', align: b.align, text: inlineDisplayText(b.text) });
      continue;
    }
    if (b.kind === 'li') {
      push({ type: 'li', align: b.align, ordered: !!b.ordered, num: b.num,
             text: inlineDisplayText(b.text) });
      continue;
    }
    // ย่อหน้า — hard break ถูกยุบเป็นบรรทัดจริงในข้อความเดียวกัน (เหมือน <br> บนจอ)
    push({ type: 'p', align: b.align,
           text: (b.lines || [b.text]).map(inlineDisplayText).join('\n') });
  }
  // ย่อหน้าว่างที่หัว/ท้ายไม่ใช่ระยะเว้นที่ผู้ใช้ตั้งใจ (เศษจากการประกอบ) — กฎเดียวกับ mdToHtmlBody
  const blankB = (b) => b && b.type === 'p' && !b.text;
  while (out.length && blankB(out[0])) out.shift();
  while (out.length && blankB(out[out.length - 1])) out.pop();
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
