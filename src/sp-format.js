// sp-format.js — เอนจินรูปแบบบทภาพยนตร์ "ระดับใช้งานจริง" (ข้อ 81–85, 92)
// บริสุทธิ์ 100% : ไม่แตะ DOM / kapi / state → ทดสอบด้วย node ได้ (test/sp-format.test.cjs)
//
//   81 ระยะเยื้อง/ความกว้างต่อ element   → spCssVars()
//   82 ระยะเว้นบรรทัดต่อ element         → linesBefore/linesBetween (หน่วย 1/10 บรรทัด)
//   83 สไตล์จอ vs สไตล์พิมพ์             → screen/print (caps/bold/italic/underline)
//   84 กฎการตัดหน้า                      → PAGE_BREAK_RULES + paginate()
//   85 ขนาดกระดาษ + ระยะขอบ              → PAPER_SIZES / MARGIN_DEFAULTS / linesPerPage()
//   92 ข้อความมาตรฐานที่แก้ได้            → SP_STRINGS
//
// หน่วยทั้งไฟล์เป็น "นิ้ว" (in) เหมือนอุตสาหกรรมบท — CSS ใช้ `in` ได้ตรง ๆ

import { T } from './i18n.js';
import { num } from './num.js';

// ───────── 85. ขนาดกระดาษ + ระยะขอบ ─────────
export const PAPER_SIZES = {
  letter: { name: T`Letter (8.5 × 11 นิ้ว)`, width: 8.5,  height: 11,    unit: 'in' },
  a4:     { name: T`A4 (8.27 × 11.69 นิ้ว)`, width: 8.27, height: 11.69, unit: 'in' },
  legal:  { name: T`Legal (8.5 × 14 นิ้ว)`,  width: 8.5,  height: 14,    unit: 'in' },
  custom: { name: T`กำหนดเอง`,                width: 8.5,  height: 11,    unit: 'in' },
};
export const MARGIN_DEFAULTS = { top: 1, bottom: 1, left: 1.5, right: 1 };

// Courier 12pt = 10 ตัวอักษร/นิ้ว · 6 บรรทัด/นิ้ว (single space) — มาตรฐานบทภาพยนตร์
export const CHARS_PER_INCH = 10;
export const LINES_PER_INCH = 6;
export const LINE_HEIGHT_IN = 1 / LINES_PER_INCH;

/** ช่วงบรรทัดที่ใช้ได้จริง (0.8–2.5 · 1 = มาตรฐาน 6 บรรทัด/นิ้ว) */
export function clampLineHeight(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0.8 && n <= 2.5 ? n : 1;
}
/** ความสูงบรรทัดจริงเป็น "นิ้ว" ของรูปแบบหนึ่ง (นับ spLineHeight ที่ผู้ใช้ปรับด้วย) */
export function lineHeightIn(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  return LINE_HEIGHT_IN * clampLineHeight(f.lineHeight);
}
/** จำนวนบรรทัดที่พิมพ์ได้ต่อหน้า (หลังหักระยะขอบบน/ล่าง) */
export function linesPerPage(paper, margins, lh = LINE_HEIGHT_IN) {
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  const usable = (num(p.height, 11)) - num(m.top, 1) - num(m.bottom, 1);
  return Math.max(1, Math.floor(usable / (lh || LINE_HEIGHT_IN)));
}
/**
 * [alpha.58r บั๊ก 5] บรรทัดต่อหน้า "ของรูปแบบนี้" — จุดเดียวที่ทุกที่ควรเรียก
 * เดิม paginate/pageMetrics เรียก linesPerPage(paper,margins) ตรง ๆ จึงได้ 54 เสมอ
 * แม้ผู้ใช้ตั้ง spLineHeight = 1.2 (เส้นคั่นหน้า/CONTINUED เพี้ยนทั้งหมด)
 */
export function formatLines(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  return linesPerPage(f.paper, f.margins, lineHeightIn(f));
}
/** ความกว้างพื้นที่พิมพ์ (นิ้ว) */
export function textWidth(paper, margins) {
  const p = paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(margins || {}) };
  return Math.max(0.5, num(p.width, 8.5) - num(m.left, 1.5) - num(m.right, 1));
}
// ───────── 81+82. ระยะเยื้อง / ความกว้าง / ระยะเว้นบรรทัด ต่อ element ─────────
// indent = ระยะจาก "ขอบกระดาษ" (แบบ Final Draft) · width = ความกว้างของบล็อก
// linesBefore/linesBetween = 1/10 บรรทัด (10 = 1 บรรทัด, 20 = 2 บรรทัด)
// `keepNext` = ห้ามค้างท้ายหน้าเดี่ยว ๆ ต้องอยู่ติดบล็อกถัดไป
// (RTF ใช้เป็น `\keepn` · เป็นแหล่งความจริงเดียว — export-rtf.js ดึงจากที่นี่ตอนรัน ไม่ฮาร์ดโค้ดซ้ำ)
export const SP_ELEMENT_CONFIG = {
  scene:         { indent: 1.5, width: 6.0, linesBefore: 20, linesBetween: 10, keepNext: true },
  action:        { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  character:     { indent: 3.7, width: 3.8, linesBefore: 10, linesBetween: 10, keepNext: true },
  parenthetical: { indent: 3.1, width: 2.9, linesBefore: 0,  linesBetween: 10, keepNext: true },
  dialogue:      { indent: 2.5, width: 3.5, linesBefore: 0,  linesBetween: 10, keepNext: false },
  // [alpha.57a ข้อ 2] ทรานซิชันเข้า = ชิดซ้าย · ทรานซิชันออก = ชิดขวา (ของเดิม)
  'transition-in': { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: true },
  transition:    { indent: 6.0, width: 2.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  // [alpha.58 ข้อเสนอ] ฉากย่อย + ช็อต วางตัวเหมือนหัวฉากทุกอย่าง (ระยะเยื้อง/ความกว้าง/ระยะเว้น)
  // ต่างกันแค่ "ไม่มีเลขฉาก" — เลขฉากผูกกับ el === 'scene' เท่านั้น
  subheader:     { indent: 1.5, width: 6.0, linesBefore: 20, linesBetween: 10, keepNext: true },
  intercut:      { indent: 1.5, width: 6.0, linesBefore: 20, linesBetween: 10, keepNext: true },
  shot:          { indent: 1.5, width: 6.0, linesBefore: 20, linesBetween: 10, keepNext: true },
  'act-break':   { indent: 1.5, width: 6.0, linesBefore: 20, linesBetween: 10, keepNext: true },
  // [alpha.60r3a] `---` บังคับขึ้นหน้าใหม่ — ไม่กินบรรทัดของตัวเอง (paginate ปิดหน้าให้แทน)
  'page-break':  { indent: 1.5, width: 6.0, linesBefore: 0,  linesBetween: 0,  keepNext: false },
  note:          { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  summary:       { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  outline1:      { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: true },
  outline2:      { indent: 1.7, width: 5.8, linesBefore: 10, linesBetween: 10, keepNext: true },
  outline3:      { indent: 1.9, width: 5.6, linesBefore: 10, linesBetween: 10, keepNext: true },
  image:         { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  raw:           { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
};

/** element ที่ต้องอยู่ติดบล็อกถัดไป — อ่านจาก fmt ตอนรัน (ผู้ใช้ตั้งทับได้) */
export function keepNextElements(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  return SP_ELEMENT_KEYS.filter((k) => f.elements[k] && f.elements[k].keepNext === true);
}

// ───────── 83. สไตล์ จอ (screen) vs พิมพ์ (print) ─────────
const ST = (caps, bold, italic, underline) => ({ caps, bold, italic, underline });
export const SP_ELEMENT_STYLES = {
  scene:         { screen: ST(true,  true,  false, false), print: ST(true,  true,  false, false) },
  action:        { screen: ST(false, false, false, false), print: ST(false, false, false, false) },
  character:     { screen: ST(true,  false, false, false), print: ST(true,  false, false, false) },
  parenthetical: { screen: ST(false, false, true,  false), print: ST(false, false, false, false) },
  dialogue:      { screen: ST(false, false, false, false), print: ST(false, false, false, false) },
  'transition-in': { screen: ST(true, false, false, false), print: ST(true,  false, false, false) },
  transition:    { screen: ST(true,  false, false, false), print: ST(true,  false, false, false) },
  // [alpha.58] ฉากย่อย/สลับฉาก/ช็อต = ตัวหนาพิมพ์ใหญ่เหมือนหัวฉาก (เลิกขีดเส้นใต้)
  subheader:     { screen: ST(true,  true,  false, false), print: ST(true,  true,  false, false) },
  intercut:      { screen: ST(true,  true,  false, false), print: ST(true,  true,  false, false) },
  shot:          { screen: ST(true,  true,  false, false), print: ST(true,  true,  false, false) },
  'act-break':   { screen: ST(true,  true,  false, false), print: ST(true,  true,  false, true) },
  'page-break':  { screen: ST(false, false, false, false), print: ST(false, false, false, false) },
  note:          { screen: ST(false, false, true,  false), print: ST(false, false, true,  false) },
  summary:       { screen: ST(false, false, true,  false), print: ST(false, false, true,  false) },
  outline1:      { screen: ST(false, true,  false, false), print: ST(false, true,  false, false) },
  outline2:      { screen: ST(false, true,  false, false), print: ST(false, true,  false, false) },
  outline3:      { screen: ST(false, true,  false, false), print: ST(false, true,  false, false) },
  image:         { screen: ST(false, false, false, false), print: ST(false, false, false, false) },
  raw:           { screen: ST(false, false, false, false), print: ST(false, false, false, false) },
};

// ───────── [alpha.62 บั๊ก 11] ตัวพิมพ์ใหญ่รายชนิด element ─────────
// อาการที่ผู้ใช้เจอ: "บทหนัง พวกตัวละคร ยังเป็น uppercase ถูก lock ปรับไม่ได้"
// ต้นเหตุ: caps เป็น **การแสดงผล** (`text-transform:uppercase` ที่ spCss สร้าง)
// ไม่ใช่ตัวอักษรจริงในไฟล์ → เปลี่ยน case ของข้อความยังไงบนจอก็ยังเป็นตัวใหญ่เหมือนเดิม
// ของเดิมปิดได้แค่ "สวิตช์ใหญ่ปิดทั้งบท" (forceCase) กับตารางรูปแบบที่ซ่อนอยู่ในกล่องตั้งค่า
// → เพิ่มทางลัดรายชนิดที่ตรงไปตรงมา: ปิดเฉพาะ "ชื่อตัวละคร" ได้โดยหัวฉากยังเป็นตัวใหญ่อยู่

/** element ที่ค่ามาตรฐานบังคับตัวพิมพ์ใหญ่ (= ตัวที่ให้ผู้ใช้สลับได้) */
export const CAPS_ELEMENTS = Object.keys(SP_ELEMENT_STYLES)
  .filter((k) => SP_ELEMENT_STYLES[k].screen.caps || SP_ELEMENT_STYLES[k].print.caps);

/** ตอนนี้ element นี้ถูกบังคับตัวพิมพ์ใหญ่อยู่ไหม (อ่านจาก fmt ที่ merge แล้ว) */
export function elementCaps(fmt, elName, mode = 'screen') {
  const st = fmt && fmt.styles && fmt.styles[elName];
  return !!(st && st[mode] && st[mode].caps);
}

/**
 * คืน `styles` ชุดใหม่ที่ตั้ง caps ของ element หนึ่งตัว (ไม่แก้ของเดิม)
 * เก็บเฉพาะคีย์ที่ตั้งจริง — ผสานทับค่ามาตรฐานตอน mergeSpFormat
 * @param {object} userStyles ค่าที่ผู้ใช้ตั้งไว้ (settings.spStyles) — ว่างได้
 */
export function setElementCaps(userStyles, elName, on, mode = 'both') {
  if (!SP_ELEMENT_STYLES[elName]) return userStyles || {};
  const out = JSON.parse(JSON.stringify(userStyles || {}));
  out[elName] = out[elName] || {};
  for (const m of (mode === 'both' ? ['screen', 'print'] : [mode])) {
    out[elName][m] = { ...SP_ELEMENT_STYLES[elName][m], ...(out[elName][m] || {}), caps: !!on };
  }
  return out;
}

// ───────── 84. กฎการตัดหน้า (widow/orphan control) ─────────
export const PAGE_BREAK_RULES = {
  minActionLinesAtBottom: 2,     // ต้องเหลือ action อย่างน้อยกี่บรรทัดท้ายหน้าจึงยอมตัด
  minDialogueLinesAtBottom: 2,   // ต้องเหลือบทพูดอย่างน้อยกี่บรรทัดท้ายหน้า
  minActionLinesAtTop: 3,        // ส่วนที่ยกไปหน้าใหม่ต้องได้อย่างน้อยกี่บรรทัด
  minDialogueLinesAtTop: 3,
  maxConsecutiveHyphens: 2,      // ห้ามลงท้ายบรรทัดด้วยขีดติดกันเกินกี่บรรทัด
  keepSceneWithNext: 2,          // หัวฉากท้ายหน้าต้องมีเนื้อตามอย่างน้อยกี่บรรทัด ไม่งั้นยกทั้งก้อน
};

// ───────── 55–56. CONTINUED / (MORE) / (cont'd) ─────────
// สวิตช์ของ "ระบบต่อเนื่อง" ทั้งชุด — ข้อความที่ใช้จริงอยู่ใน SP_STRINGS (ข้อ 92)
//   scene    = (CONTINUED) ท้ายหน้า + CONTINUED: ต้นหน้า เมื่อฉากเดียวกันข้ามหน้า
//   dialogue = (MORE) ท้ายหน้า + ทวนชื่อ + (cont'd) ต้นหน้า เมื่อบทพูดถูกตัดกลาง
//   number   = ข้ามหลายหน้าติดกันให้ใส่เลขกำกับ "CONTINUED: (2)"
//   indent   = ระยะเยื้องของ (MORE) วัดจากขอบกระดาษ (นิ้ว) — แนวเดียวกับชื่อตัวละคร
export const CONTINUED_DEFAULTS = {
  enabled: true, scene: true, dialogue: true, number: true, indent: 3.7,
};

// ───────── 92. ข้อความมาตรฐานที่ผู้ใช้แก้ได้ ─────────
export const SP_STRINGS = {
  continuedBottom: '(CONTINUED)',
  continuedTop: 'CONTINUED:',
  dialogueMore: '(MORE)',
  dialogueContd: "(cont'd)",
  sceneContinued: T`ต่อ`,
  castTitle: 'Cast of Characters',
  sceneTitle: 'Scene',
  timeTitle: 'Time',
};

// ───────── alpha.57a ข้อ 2 · เลขฉาก + เลขหน้า ─────────
// เลขฉาก: อยู่ข้าง ๆ หัวฉากทั้งสองฝั่ง — ซ้ายวัด 0.75" จากขอบกระดาษซ้าย · ขวาวัด 1" จากขอบขวา
export const SCENE_NUMBER_DEFAULTS = { show: false, left: 0.75, right: 1.0, suffix: '' };
// เลขหน้า: ชิดขวา 1" จากขอบขวา · 0.5" จากขอบบนของกระดาษ · มีเฉพาะไฟล์ที่เป็นฉาก
// firstPage=false → ไม่พิมพ์เลขบนหน้าแรก (ธรรมเนียมบทภาพยนตร์)
export const PAGE_NUMBER_DEFAULTS = { show: false, right: 1.0, top: 0.5, suffix: '.', firstPage: false };

/** ตำแหน่งเลขฉากเทียบกับ "กล่องหัวฉาก" (นิ้ว · ค่าติดลบ = ล้ำออกนอกกล่องไปทางนั้น) */
export function sceneNumberOffsets(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const sn = f.sceneNumbers;
  const cfg = f.elements.scene;
  const boxLeft = num(cfg.indent, f.margins.left);
  const boxRight = boxLeft + num(cfg.width, 6);
  return {
    left: +(num(sn.left, 0.75) - boxLeft).toFixed(4),
    right: +(boxRight - (num(f.paper.width, 8.5) - num(sn.right, 1))).toFixed(4),
  };
}

/** เลขหน้าที่ต้องพิมพ์บนหน้าที่ index (1-based ภายในไฟล์) — คืน '' เมื่อไม่ต้องพิมพ์ */
export function pageNumberLabel(index, fmt, startPage) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const pn = f.pageNumbers;
  if (!pn.show) return '';
  const i = Math.max(1, Math.round(+index || 1));
  if (i === 1 && !pn.firstPage) return '';
  const start = Math.max(1, Math.round(+startPage || 1));
  return String(start + i - 1) + (pn.suffix || '');
}

// ───────── ค่าตั้งต้นรวม + การผสานกับค่าที่ผู้ใช้ตั้ง ─────────
export const DEFAULT_SP_FORMAT = {
  paperSize: 'letter',
  paper: { width: 8.5, height: 11 },   // ใช้เมื่อ paperSize === 'custom'
  margins: { ...MARGIN_DEFAULTS },
  elements: SP_ELEMENT_CONFIG,
  styles: SP_ELEMENT_STYLES,
  rules: PAGE_BREAK_RULES,
  strings: SP_STRINGS,
  sceneNumbers: SCENE_NUMBER_DEFAULTS,
  pageNumbers: PAGE_NUMBER_DEFAULTS,
  continued: CONTINUED_DEFAULTS,
  // [alpha.58r บั๊ก 5+9] ช่วงบรรทัดที่ผู้ใช้ปรับได้ — ต้องอยู่ใน fmt เพื่อให้ paginate/pageMetrics เห็น
  lineHeight: 1,
  // [alpha.61 ข้อ 4] สวิตช์ใหญ่ "บังคับพิมพ์ใหญ่ตามรูปแบบบทมาตรฐาน"
  //   true  = หัวฉาก/ชื่อตัวละคร/ทรานซิชัน เป็น ALL-CAPS ตามธรรมเนียมฮอลลีวูด (ค่าเดิม)
  //   false = ไม่บังคับเลย — ผู้ใช้พิมพ์อย่างไรก็แสดง/พิมพ์/ส่งออกอย่างนั้น
  // ปิดที่นี่ที่เดียวแล้วทุกทางออกตาม เพราะทุกตัว (spCss · pdf-generator · export-rtf ·
  // sp-headers) อ่าน `styles[k][mode].caps` ตัวเดียวกัน — mergeSpFormat เป็นคนล้างให้
  forceCase: true,
};

export const SP_ELEMENT_KEYS = Object.keys(SP_ELEMENT_CONFIG);

/** ผสานค่าที่ผู้ใช้ตั้ง (settings.spFormat) ทับค่าเริ่มต้น — ไม่แก้ของเดิม (คืน object ใหม่เสมอ) */
export function mergeSpFormat(user) {
  const u = user || {};
  const paperSize = PAPER_SIZES[u.paperSize] ? u.paperSize : 'letter';
  const basePaper = PAPER_SIZES[paperSize];
  const paper = paperSize === 'custom'
    ? { width: num(u.paper?.width, basePaper.width), height: num(u.paper?.height, basePaper.height), unit: 'in' }
    : { ...basePaper };
  const elements = {};
  for (const k of SP_ELEMENT_KEYS) elements[k] = { ...SP_ELEMENT_CONFIG[k], ...(u.elements?.[k] || {}) };
  // [alpha.61 ข้อ 4] forceCase=false → ล้าง caps ทุก element ทั้งบนจอและตอนพิมพ์
  // (ยังจำค่าที่ผู้ใช้ติ๊กไว้ใน settings.spStyles — เปิดสวิตช์กลับแล้วได้ของเดิมคืนครบ)
  const forceCase = u.forceCase !== false;
  const styles = {};
  for (const k of SP_ELEMENT_KEYS) {
    styles[k] = {
      screen: { ...SP_ELEMENT_STYLES[k].screen, ...(u.styles?.[k]?.screen || {}) },
      print:  { ...SP_ELEMENT_STYLES[k].print,  ...(u.styles?.[k]?.print  || {}) },
    };
    if (!forceCase) { styles[k].screen.caps = false; styles[k].print.caps = false; }
  }
  return {
    forceCase,
    paperSize, paper,
    margins: { ...MARGIN_DEFAULTS, ...(u.margins || {}) },
    elements, styles,
    rules: { ...PAGE_BREAK_RULES, ...(u.rules || {}) },
    strings: { ...SP_STRINGS, ...(u.strings || {}) },
    sceneNumbers: { ...SCENE_NUMBER_DEFAULTS, ...(u.sceneNumbers || {}) },
    pageNumbers: { ...PAGE_NUMBER_DEFAULTS, ...(u.pageNumbers || {}) },
    continued: { ...CONTINUED_DEFAULTS, ...(u.continued || {}) },
    lineHeight: clampLineHeight(u.lineHeight),
  };
}

// ───────── ตัวแปร CSS ของหน้ากระดาษ (ใช้ได้ทั้งนิยายและบทหนัง) ─────────
/** คืน { '--page-w': '8.5in', '--mg-top': '1in', ... } */
export function pageCssVars(fmt) {
  const f = fmt && fmt.margins ? fmt : mergeSpFormat(fmt);
  const m = f.margins;
  return {
    '--page-w': f.paper.width + 'in',
    '--page-h': f.paper.height + 'in',
    '--mg-top': m.top + 'in',
    '--mg-bottom': m.bottom + 'in',
    '--mg-left': m.left + 'in',
    '--mg-right': m.right + 'in',
    '--text-w': +textWidth(f.paper, m).toFixed(4) + 'in',
    // [alpha.57a] เลขหน้า — ระยะจากขอบกระดาษ (ไม่ใช่จากขอบพื้นที่พิมพ์)
    '--pg-no-top': (f.pageNumbers?.top ?? 0.5) + 'in',
    '--pg-no-right': (f.pageNumbers?.right ?? 1) + 'in',
  };
}

/** CSS ต่อ element ของบทหนัง (ข้อ 81–83) — คืนเป็นสตริง เอาไปยัด <style> ได้ทันที */
export function spCss(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const left = f.margins.left;
  const out = [];
  const decl = (st) => [
    'text-transform:' + (st.caps ? 'uppercase' : 'none'),
    'font-weight:' + (st.bold ? '700' : '400'),
    'font-style:' + (st.italic ? 'italic' : 'normal'),
    'text-decoration:' + (st.underline ? 'underline' : 'none'),
  ].join(';');
  const tw = textWidth(f.paper, f.margins);
  for (const k of SP_ELEMENT_KEYS) {
    const c = f.elements[k];
    const s = f.styles[k];
    const ml = Math.max(0, +(num(c.indent, left) - left).toFixed(4));
    // ความกว้างต้องไม่ล้นพื้นที่พิมพ์ (บาง element เช่นทรานซิชันตั้ง indent+width เกินขอบขวาได้)
    // คำนวณเป็นนิ้วที่นี่ ไม่ใช้ max-width:calc(100% - …) เพราะ 100% รวมเส้นขอบกระดาษด้วย → เพี้ยน 2px
    const w = Math.max(0.3, Math.min(num(c.width, 6), +(tw - ml).toFixed(4)));
    const mt = num(c.linesBefore, 10) / 10;
    const mb = num(c.linesBetween, 10) / 10 - 1;      // 1 บรรทัดคือระยะของตัวมันเอง
    // [alpha.60r3a] `page-break` ใช้คลาส `sp-page-break-el` (ชื่อ `sp-page-break` เป็นของเส้นคั่นหน้าอัตโนมัติ)
    const cls = k === 'page-break' ? 'page-break-el' : k;
    out.push(`.sp.sp-${cls}{margin-left:${ml}in;width:${w}in;max-width:none;` +
             `margin-top:${mt}em;margin-bottom:${Math.max(0, mb)}em;${decl(s.screen)}}`);
  }
  // [alpha.57a ข้อ 2] เลขฉากสองฝั่งของหัวฉาก — วางแบบ absolute เทียบกับกล่องหัวฉาก
  // (คำนวณระยะเป็น "นิ้ว" ที่นี่ ไม่ใช้ calc(%) ด้วยเหตุผลเดียวกับความกว้างด้านบน)
  const so = sceneNumberOffsets(f);
  out.push('.sp.sp-scene{position:relative}');
  out.push('.k-scene-no{position:absolute;top:0;white-space:nowrap;user-select:none;' +
           'pointer-events:none;text-transform:none;font-weight:400;font-style:normal;text-decoration:none}');
  out.push(`.k-scene-no-l{left:${so.left}in}`);
  out.push(`.k-scene-no-r{right:${so.right}in}`);
  // [alpha.58 · 55–56] ข้อความต่อเนื่อง — (MORE) เยื้องแนวชื่อตัวละคร · CONTINUED: ชิดซ้าย · (CONTINUED) ชิดขวา
  const ct = { ...CONTINUED_DEFAULTS, ...(f.continued || {}) };
  const moreML = Math.max(0, +(num(ct.indent, 3.7) - left).toFixed(4));
  out.push(`.sp.sp-more{margin-left:${moreML}in;width:auto;max-width:none;` +
           'margin-top:0;margin-bottom:0;text-transform:none}');
  out.push(`.sp-continued-top,.sp-cont-top{margin-left:0;width:${+tw.toFixed(4)}in;text-align:left}`);
  out.push(`.sp-continued-bottom,.sp-cont-bottom{margin-left:0;width:${+tw.toFixed(4)}in;text-align:right}`);
  // [alpha.58r บั๊ก 10] ชื่อตัวละคร + (cont'd) ต้นหน้า — วางแนวเดียวกับ element `character` จริง
  // เดิมไม่มีกฎตรงนี้เลย จึงตกไปใช้ค่าคงที่ใน style.css แล้วไม่ขยับตามที่ผู้ใช้ตั้งระยะเยื้อง
  const contdML = Math.max(0, +(num(f.elements.character?.indent, 3.7) - left).toFixed(4));
  out.push(`.sp.sp-contd,.sp-cont-mark.sp-contd{margin-left:${contdML}in;width:auto;max-width:none;` +
           'margin-top:0;margin-bottom:0}');
  // ขนาดกระดาษ + ระยะขอบตอนพิมพ์ (@page ใช้ CSS variable ไม่ได้ จึงต้องสร้างเป็นข้อความ)
  // orphans/widows = กฎ widow/orphan ระดับบรรทัดของเบราว์เซอร์ (ข้อ 84)
  const m = f.margins;
  out.push(`@page{size:${f.paper.width}in ${f.paper.height}in;` +
           `margin:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in;` +
           `orphans:${Math.max(1, f.rules.minActionLinesAtBottom)};` +
           `widows:${Math.max(1, f.rules.minActionLinesAtTop)};}`);
  // สไตล์ตอนพิมพ์/ส่งออก PDF — แยกชุดจากที่เห็นบนจอ (ข้อ 83)
  const printRules = SP_ELEMENT_KEYS
    .map((k) => `.sp.sp-${k}{${decl(f.styles[k].print)}}`)
    .join('');
  out.push('@media print{' + printRules + '}');
  return out.join('\n');
}

// ───────── 84. การจัดหน้า (pagination) ─────────
/** จำนวนบรรทัดที่ข้อความหนึ่งบล็อกกินจริง เมื่อกว้าง width นิ้ว */
export function wrapLines(text, widthIn, cpi = CHARS_PER_INCH) {
  const cols = Math.max(1, Math.floor(num(widthIn, 6) * cpi));
  const s = String(text ?? '');
  if (!s.trim()) return 1;
  let total = 0;
  for (const para of s.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { total += 1; continue; }
    let line = 0, used = 0;
    for (const w of words) {
      const need = used ? used + 1 + w.length : w.length;
      if (need <= cols) { used = need; }
      else { line++; used = w.length; while (used > cols) { line++; used -= cols; } }
    }
    total += line + 1;
  }
  return Math.max(1, total);
}

/**
 * จัดหน้าบทภาพยนตร์ตามกฎ widow/orphan
 * @param {Array<{el:string,text:string}>} blocks
 * @param {object} opts { fmt, lines }  (lines = บรรทัดต่อหน้า · ไม่ใส่ = คำนวณจาก fmt)
 * @returns {{pages:Array<{index:number,blocks:Array}>,count:number}}
 */
export function paginate(blocks, opts = {}) {
  const fmt = opts.fmt && opts.fmt.elements ? opts.fmt : mergeSpFormat(opts.fmt);
  // [alpha.58r บั๊ก 5] บรรทัดต่อหน้าคิดจาก "ช่วงบรรทัดที่ผู้ใช้ตั้ง" ด้วย ไม่ใช่ 1/6 นิ้วตายตัว
  const perPage = Math.max(4, opts.lines || formatLines(fmt));
  const R = fmt.rules, S = fmt.strings;
  const cfg = (el) => fmt.elements[el] || fmt.elements.action;

  const CT = { ...CONTINUED_DEFAULTS, ...(fmt.continued || {}) };
  const wantDlgMarkers = CT.enabled !== false && CT.dialogue !== false;

  const pages = [];
  let cur = [], used = 0, lastChar = '';
  // [55–56] ติดตามว่าหน้าหนึ่ง ๆ เริ่ม/จบด้วย "ฉากที่เท่าไร" เพื่อรู้ว่าฉากข้ามหน้าจริงไหม
  let sceneSeq = 0, curScene = 0, pageSceneStart = 0;
  /** ใส่บล็อกลงหน้าปัจจุบัน — ตัวเดียวที่นับเลขฉาก (ท่อนหางของบล็อกที่ถูกตัดไม่นับซ้ำ) */
  const addBlock = (blk) => {
    if (blk.el === 'scene' && blk.split !== 'tail') {
      curScene = ++sceneSeq;
      if (!cur.length) pageSceneStart = curScene;
    }
    cur.push(blk);
  };
  const pushPage = () => {
    pages.push({ index: pages.length + 1, blocks: cur,
                 sceneStart: pageSceneStart, sceneEnd: curScene });
    cur = []; used = 0; pageSceneStart = curScene;   // หน้าใหม่เริ่มด้วยฉากเดิมจนกว่าจะเจอหัวฉากใหม่
  };

  const list = (blocks || []).filter((b) => b && b.el !== 'blank');
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const c = cfg(b.el);
    // [alpha.60r3a] `---` = บังคับขึ้นหน้าใหม่ — ปิดหน้าปัจจุบันแล้วไปต่อหน้าถัดไป
    // ตัวมันเองไม่กินบรรทัดและไม่ถูกใส่ลงหน้าใด (เป็นคำสั่ง ไม่ใช่เนื้อหา)
    if (b.el === 'page-break') { if (cur.length) pushPage(); continue; }
    if (b.el === 'character') lastChar = String(b.text || '');
    const before = cur.length ? Math.round(num(c.linesBefore, 10) / 10) : 0;
    const body = wrapLines(b.text, c.width);
    const need = before + body;
    const free = perPage - used;

    if (need <= free) { addBlock({ ...b, lines: body }); used += need; continue; }

    // ── ไม่พอ: ตัดสินใจตามชนิด ──
    const isDlg = b.el === 'dialogue';
    const isAct = b.el === 'action' || b.el === 'note' || b.el === 'summary';
    const minBot = isDlg ? R.minDialogueLinesAtBottom : R.minActionLinesAtBottom;
    const minTop = isDlg ? R.minDialogueLinesAtTop : R.minActionLinesAtTop;
    const canBottom = free - before;

    if ((isDlg || isAct) && canBottom >= minBot && body - canBottom >= minTop) {
      // แบ่งครึ่ง: ท้ายหน้าใส่ (MORE) · ต้นหน้าใหม่ทวนชื่อ + (cont'd)
      const head = splitText(b.text, c.width, canBottom);
      addBlock({ ...b, text: head.head, lines: canBottom, split: 'head' });
      if (isDlg && wantDlgMarkers) addBlock({ el: 'more', text: S.dialogueMore, lines: 1, more: true });
      pushPage();
      if (isDlg && wantDlgMarkers && lastChar) {
        addBlock({ el: 'character', text: lastChar + ' ' + S.dialogueContd, lines: 1, contd: true });
        used += 1;
      }
      addBlock({ ...b, text: head.rest, lines: body - canBottom, split: 'tail' });
      used += body - canBottom;
      continue;
    }
    // ยกทั้งบล็อกไปหน้าใหม่ — หัวฉาก/ชื่อตัวละครต้องพาบล็อกก่อนหน้าที่ผูกกันไปด้วย
    const carry = [];
    if (b.el === 'dialogue' || b.el === 'parenthetical') {
      while (cur.length && ['character', 'parenthetical'].includes(cur[cur.length - 1].el)) {
        carry.unshift(cur.pop());
      }
    }
    for (const x of carry) used -= x.lines || 1;
    pushPage();
    for (const x of carry) { cur.push(x); used += x.lines || 1; }
    addBlock({ ...b, lines: body });
    used += body;
  }
  if (cur.length) pushPage();
  if (!pages.length) pages.push({ index: 1, blocks: [], sceneStart: 0, sceneEnd: 0 });

  annotateContinued(pages, fmt);
  return { pages, count: pages.length };
}

/**
 * [55–56] ใส่ CONTINUED ให้กับผลของ paginate
 * เงื่อนไข: หน้าถัดไป "เริ่มด้วยฉากเดิม" (ไม่ได้ขึ้นหัวฉากใหม่) เท่านั้นจึงถือว่าฉากข้ามหน้า
 * เดิมใส่ทุกคู่หน้าโดยไม่ดูเลย → หน้าที่จบฉากพอดีก็ยังขึ้น (CONTINUED) ผิดธรรมเนียม
 * page.contdRun = ฉากนี้ต่อเนื่องมาเป็นหน้าที่เท่าไร (2, 3, …) ใช้ทำ "CONTINUED: (2)"
 */
export function annotateContinued(pages, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const S = f.strings;
  const CT = { ...CONTINUED_DEFAULTS, ...(f.continued || {}) };
  const on = CT.enabled !== false && CT.scene !== false;
  for (const p of pages) { delete p.continuedBottom; delete p.continuedTop; delete p.contdRun; }
  let run = 1, contScene = 0;
  for (let i = 0; i < pages.length - 1; i++) {
    const p = pages[i], n = pages[i + 1];
    const spans = on && p.sceneEnd > 0 && n.sceneStart === p.sceneEnd;
    if (!spans) { run = 1; contScene = 0; continue; }
    // เปลี่ยนฉากแล้ว = เริ่มนับใหม่ (ไม่งั้นฉากใหม่ที่ข้ามหน้าครั้งแรกได้เลข (2) ทันที)
    if (p.sceneEnd !== contScene) { run = 1; contScene = p.sceneEnd; }
    run++;
    p.continuedBottom = S.continuedBottom;
    n.contdRun = run;
    n.continuedTop = CT.number !== false && run > 2
      ? `${S.continuedTop} (${run - 1})` : S.continuedTop;
  }
  return pages;
}

/** ตัดข้อความให้ส่วนแรกยาว n บรรทัด (กว้าง widthIn นิ้ว) — คืน {head, rest} */
export function splitText(text, widthIn, n) {
  const cols = Math.max(1, Math.floor(num(widthIn, 6) * CHARS_PER_INCH));
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= cols) cur = next;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const k = Math.max(1, Math.min(n, lines.length - 1 >= 1 ? lines.length - 1 : 1));
  return { head: lines.slice(0, k).join(' '), rest: lines.slice(k).join(' ') };
}

/** นับหน้าอย่างเดียว (ใช้กับแถบสถานะ — เร็วกว่า paginate เต็มรูปแบบเล็กน้อย) */
export function pageCount(blocks, opts) { return paginate(blocks, opts).count; }

// ───────── 97. หน้ารายชื่อตัวละคร (Cast of Characters / dramatis personae) ─────────
export const ROSTER_VERSION = 1;
export function newRoster() {
  return {
    version: ROSTER_VERSION,
    title: SP_STRINGS.castTitle,
    characters: [],
    scene: '', time: '',
    showScene: true, showTime: true,
    includeInExport: true,
  };
}
/** ทำให้ roster ที่อ่านจากไฟล์อยู่ในรูปที่ UI ใช้ได้เสมอ */
export function normalizeRoster(r) {
  const base = newRoster();
  if (!r || typeof r !== 'object') return base;
  return {
    ...base, ...r,
    version: ROSTER_VERSION,
    title: typeof r.title === 'string' && r.title.trim() ? r.title : base.title,
    characters: (Array.isArray(r.characters) ? r.characters : [])
      .map((c) => ({ name: String(c?.name ?? ''), detail: String(c?.detail ?? '') })),
    scene: String(r.scene ?? ''), time: String(r.time ?? ''),
    showScene: r.showScene !== false, showTime: r.showTime !== false,
    includeInExport: r.includeInExport !== false,
  };
}
/**
 * แปลง roster เป็นข้อความบรรทัดต่อบรรทัด (ใช้ตอนส่งออก/พิมพ์)
 * รูปแบบ: หัวเรื่องกลางหน้า → เว้น 1 บรรทัด → รายชื่อ (ชื่อ: <tab> รายละเอียด, เว้นบรรทัดระหว่างคน)
 *         → Scene (กลางหน้า, เว้น 1 บรรทัด, คำอธิบายชิดซ้าย) → เว้น 2 บรรทัด → Time
 */
export function rosterToText(roster, fmt) {
  const r = normalizeRoster(roster);
  const f = fmt && fmt.margins ? fmt : mergeSpFormat(fmt);
  const cols = Math.max(20, Math.floor(textWidth(f.paper, f.margins) * CHARS_PER_INCH));
  const mid = (s) => ' '.repeat(Math.max(0, Math.floor((cols - s.length) / 2))) + s;
  const out = [mid(r.title)];
  out.push('');
  for (const c of r.characters) {
    if (!c.name && !c.detail) continue;
    out.push(c.name + ':' + (c.detail ? '\t' + c.detail : ''));
    out.push('');
  }
  if (r.showScene && (r.scene || '').trim()) {
    out.push(mid(f.strings.sceneTitle), '', r.scene.trim(), '', '');
  }
  if (r.showTime && (r.time || '').trim()) {
    out.push(mid(f.strings.timeTitle), '', r.time.trim());
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}
