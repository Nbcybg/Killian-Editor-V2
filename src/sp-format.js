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

import { t } from './i18n.js';
import { num } from './num.js';
// [alpha.82] ไทยนับสระ/วรรณยุกต์เป็นตัวเต็มไม่ได้ — บรรทัด/หน้าของบทจะเกินจริงเกือบครึ่ง
import { visualLength, wrapText, wrapLineStrings, wrapCuts } from './text-width.js';

// ───────── 85. ขนาดกระดาษ + ระยะขอบ ─────────
export const PAPER_SIZES = {
  letter: { name: t('ui.spFormat.letterInch'), width: 8.5,  height: 11,    unit: 'in' },
  a4:     { name: t('ui.spFormat.a4Inch'), width: 8.27, height: 11.69, unit: 'in' },
  legal:  { name: t('ui.spFormat.legalInch'),  width: 8.5,  height: 14,    unit: 'in' },
  custom: { name: t('ui.spFormat.define'),                width: 8.5,  height: 11,    unit: 'in' },
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
  // [alpha.83r ข้อ 3] "ต่อเนื่อง" แบบพิมพ์เอง — กว้างเต็มพื้นที่พิมพ์ทั้งคู่
  // ตัวขวาชิดขวาด้วย text-align (ดู spCss) ให้ตรงกับ (CONTINUED) ของตัวอัตโนมัติเป๊ะ
  'cont-left':   { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: true },
  'cont-right':  { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  summary:       { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  outline1:      { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: true },
  outline2:      { indent: 1.7, width: 5.8, linesBefore: 10, linesBetween: 10, keepNext: true },
  outline3:      { indent: 1.9, width: 5.6, linesBefore: 10, linesBetween: 10, keepNext: true },
  image:         { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
  raw:           { indent: 1.5, width: 6.0, linesBefore: 10, linesBetween: 10, keepNext: false },
};

// [alpha.126] `keepNextElements()` ถูกถอด — ไม่มีใครเรียกเลย
// กฎ "บล็อกนี้ห้ามหลุดจากบล็อกถัดไป" ใช้ผ่าน `SP_ELEMENT_CONFIG[el].keepNext` ตรง ๆ
// (กฎข้อ 28: ตารางที่ต้องตรงกับอีกไฟล์ให้ derive ตอนรัน อย่าคัดลอก)
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
  'cont-left':   { screen: ST(false, false, true,  false), print: ST(false, false, true,  false) },
  'cont-right':  { screen: ST(false, false, true,  false), print: ST(false, false, true,  false) },
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

/**
 * ══ [alpha.102 บั๊ก 2] ★★ element ที่ "ห้ามค้างท้ายหน้าตัวเดียว" ══
 *
 * ผู้ใช้: *"ในกรณีที่ หัวฉาก / ทรานสิชั่นขวา / ฉากย่อย / สลับฉาก / shot / ตอน /
 *           ขึ้นหน้าใหม่ / note / ต่อเนื่องซ้าย / ต่อเนื่องขวา อยู่บรรทัดสุดท้าย
 *           จะไม่เกิดการตัดหน้า"*
 *
 * ทั้งหมดนี้เป็น **หัวเรื่องของสิ่งที่ตามมา** ไม่ใช่เนื้อหาที่จบในตัวเอง — ธรรมเนียมบท
 * (และทุกโปรแกรมบท) ห้ามปล่อยให้มันเป็นบรรทัดสุดท้ายของหน้าโดยไม่มีเนื้อตามอย่างน้อยสองบรรทัด
 * เพราะคนอ่านจะพลิกหน้าไปเจอเนื้อที่ไม่รู้ว่าเป็นของฉากไหน
 *
 * ★ กฎนี้ **มีอยู่ในตารางมาตั้งแต่ข้อ 84 แล้ว** (`keepSceneWithNext`) และมีช่องให้ผู้ใช้ตั้ง
 * ใน ตั้งค่า → หน้ากระดาษ ด้วย — แต่ `paginate()` **ไม่เคยอ่านมันเลยสักครั้ง**
 * มันจึงเป็นสวิตช์ที่ปรับแล้วไม่มีอะไรเกิดขึ้นมาตลอด (grep เจอแค่ 2 ที่: ตรงนี้กับกล่องตั้งค่า)
 *
 * `dialogue`/`parenthetical` ไม่อยู่ในชุดนี้เพราะมีกฎของตัวเองอยู่แล้ว (ยกชื่อตัวละครตามไปด้วย)
 * `character` ก็เช่นกัน — มันถูกดึงตามบทพูดผ่าน `carry`
 */
export const KEEP_WITH_NEXT = new Set([
  'scene', 'subheader', 'intercut', 'shot', 'act-break',
  'transition', 'transition-in', 'note', 'cont-left', 'cont-right',
]);

/**
 * มีเนื้อหาจริงตามหลังบล็อกที่ i ไหม (ข้ามบรรทัดว่าง)
 * — ถ้าไม่มี (จบเอกสาร หรือเจอคำสั่งขึ้นหน้าใหม่พอดี) ก็ไม่ต้องยกไปหน้าใหม่
 *   เพราะมันไม่ได้ "ค้างอยู่คนเดียว" แต่มันคือของชิ้นสุดท้ายจริง ๆ
 */
function hasContentAfter(list, i) {
  for (let j = i + 1; j < list.length; j++) {
    const e = list[j] && list[j].el;
    if (e === 'page-break') return false;      // ผู้ใช้สั่งขึ้นหน้าใหม่ตรงนั้นเอง
    if (e !== 'blank') return true;
  }
  return false;
}

// ───────── 55–56. CONTINUED / (MORE) / (cont'd) ─────────
// สวิตช์ของ "ระบบต่อเนื่อง" ทั้งชุด — ข้อความที่ใช้จริงอยู่ใน SP_STRINGS (ข้อ 92)
//   scene    = (CONTINUED) ท้ายหน้า + CONTINUED: ต้นหน้า เมื่อฉากเดียวกันข้ามหน้า
//   dialogue = (MORE) ท้ายหน้า + ทวนชื่อ + (cont'd) ต้นหน้า เมื่อบทพูดถูกตัดกลาง
//   number   = ข้ามหลายหน้าติดกันให้ใส่เลขกำกับ "CONTINUED: (2)"
//   indent   = ระยะเยื้องของ (MORE) วัดจากขอบกระดาษ (นิ้ว) — แนวเดียวกับชื่อตัวละคร
export const CONTINUED_DEFAULTS = {
  enabled: true, scene: true, dialogue: true, number: true, indent: 3.7,
  // [alpha.125 ข้อ J] `noHeading` — ให้ (CONTINUED) ขึ้นได้แม้หน้านั้น "ยังไม่มีหัวฉาก"
  //
  // ค่าเริ่มต้น false = พฤติกรรมเดิมเป๊ะ (ต้องมีหัวฉากถึงจะนับว่าเป็นฉากที่ต่อข้ามหน้า)
  // ที่ต้องเป็นสวิตช์ ไม่ใช่เปิดทิ้ง: บทที่เขียนค้างไว้แบบยังไม่ใส่หัวฉากเลยสักอัน จะได้
  // (CONTINUED) โผล่ทุกหน้าทันที ซึ่งผิดสำหรับคนส่วนใหญ่ — แต่คนที่เขียนบทแบบไม่มีหัวฉาก
  // (สเก็ตช์ · บทพูดล้วน · สคริปต์โฆษณา) ต้องการมันจริง
  noHeading: false,
};

// ───────── 92. ข้อความมาตรฐานที่ผู้ใช้แก้ได้ ─────────
export const SP_STRINGS = {
  continuedBottom: '(CONTINUED)',
  continuedTop: 'CONTINUED:',
  dialogueMore: '(MORE)',
  dialogueContd: "(cont'd)",
  sceneContinued: t('ui.spFormat.next'),
  castTitle: 'Cast of Characters',
  sceneTitle: 'Scene',
  timeTitle: 'Time',
};

// ───────── alpha.57a ข้อ 2 · เลขฉาก + เลขหน้า ─────────
// เลขฉาก: อยู่ข้าง ๆ หัวฉากทั้งสองฝั่ง — ซ้ายวัด 0.75" จากขอบกระดาษซ้าย · ขวาวัด 1" จากขอบขวา
export const SCENE_NUMBER_DEFAULTS = { show: false, left: 0.75, right: 1.0, suffix: '' };
// เลขหน้า: ชิดขวา 1" จากขอบขวา · 0.5" จากขอบบนของกระดาษ
//
// ══ [alpha.97 ข้อ 11] ★ กฎเดียว: **หน้าที่ไม่ใช่ฉาก ไม่มีเลขหน้า** ══
//
// ผู้ใช้: *"ใส่เลขบนหน้าแรกด้วย มันถูกต้อง แต่มันไม่ควรต้องมาติ๊กไง
//          เราบอกว่า หน้าที่ไม่ใช่ฉาก ไม่ต้องขึ้นเลขหน้า แค่นั้น ง่ายๆ"*
//
// .82 → .83r → .88 เถียงกันเรื่อง "หน้าแรกใส่เลขไหม" มาสามรุ่น มีทั้งสวิตช์ `firstPage`
// สองช่องในกล่องตั้งค่า และโค้ดย้ายค่าของโปรเจกต์เก่าอีกก้อน — ทั้งหมดเกิดจากการตีความ
// คำว่า "หน้าแรก" ผิด · สิ่งที่ต้องไม่มีเลขคือ **หน้าหน้าเล่ม** (ปก · รายชื่อนักแสดง ·
// สารบัญ) ซึ่งแยกเป็นหน้าที่ไม่ถูกนับอยู่แล้วตั้งแต่ .81r2 — ไม่ใช่หน้าแรกของเนื้อเรื่อง
// จึงตัดสวิตช์ทิ้งทั้งชุด: หน้าเนื้อเรื่องได้เลขทุกหน้ารวมหน้าแรก
//
// ══ [alpha.103 ข้อ 4] ★ เอาสวิตช์กลับมา — แต่คราวนี้ความหมายไม่กำกวมแล้ว ══
//
// ผู้ใช้: *"เราขอโทษ นำ toggle เลขหน้าแรกกลับมาได้มั้ย เพราะเราถาม บางคนบอกว่า
//           หน้าแรกในบทหนัง หน้า 1 บางคนเขาไม่ใส่กัน"* — เป็นเรื่องธรรมเนียมของแต่ละคนจริง
//
// สิ่งที่ .97 แก้ถูกและยังอยู่: **หน้าหน้าเล่ม (ปก/รายชื่อ/สารบัญ) ไม่นับเลขหน้า** — นั่นเป็น
// เรื่องของโครงสร้างเอกสาร ไม่ใช่สวิตช์ · ส่วน `firstPage` ตอนนี้แปลว่า "หน้าที่เลขจริง = 1
// ต้องพิมพ์เลขไหม" เท่านั้น (ไฟล์ที่ตั้ง `startPage` ไว้ที่ 5 หน้าแรกของมันคือหน้า 5 ไม่ใช่หน้าแรก
// จึงมีเลขเสมอ) — ตีความได้ทางเดียว ไม่ต้องมีโค้ดย้ายค่าและไม่ต้องมีสองช่องในกล่องตั้งค่าอีก
// ค่าเริ่มต้น = true (เหมือนพฤติกรรมตั้งแต่ .97 → โปรเจกต์เดิมไม่เปลี่ยนอะไรเลย)
export const PAGE_NUMBER_DEFAULTS = { show: false, firstPage: true, right: 1.0, top: 0.5, suffix: '.' };

/**
 * [alpha.88] จำนวน **บรรทัดว่างนำ** ที่ element ชนิดนี้ต้องมี เมื่อขึ้นต่อจากบล็อกที่มีข้อความ
 *
 * ระยะเว้นนำของบทมีสองทางที่ให้ผลเท่ากันเป๊ะ และ paginate() ก็ตั้งใจให้เท่ากัน:
 *   (ก) บรรทัดว่างจริงในไฟล์  → `prevBlank` ทำให้ `linesBefore` ถูกข้าม (ดูลูปของ paginate)
 *   (ข) ไม่มีบรรทัดว่าง        → `linesBefore` ของ element ทำหน้าที่แทน
 * ไฟล์ที่เขียนด้วยมือ/เปิดจากดิสก์เป็นแบบ (ก) เกือบทั้งหมด แต่ตอนกด Enter ในแอปได้แบบ (ข)
 * — ต่างกันตรงที่แบบ (ข) **ยังไม่มีระยะเว้นจนกว่าจะพิมพ์ตัวแรก** เพราะบล็อกที่ยังว่าง
 * นับเป็นบรรทัดว่าง 1 บรรทัดตามกฎกลาง ทำให้พอพิมพ์ปุ๊บบล็อกโตขึ้นทันที 1–2 บรรทัด
 * แล้วดันทุกอย่างข้างล่างลง (ผู้ใช้: "บรรทัดถูกดัน")
 * @returns {number} จำนวนบล็อกบรรทัดว่างที่ควรแทรกไว้ข้างหน้า (0 = ไม่ต้อง)
 */
export function blankLinesBefore(el, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const cfg = f.elements[el];
  if (!cfg) return 0;
  return Math.max(0, Math.round(num(cfg.linesBefore, 0) / 10));
}

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
  const start = Math.max(1, Math.round(+startPage || 1));
  const no = start + i - 1;
  // [alpha.103 ข้อ 4] ข้ามเฉพาะ "หน้าที่เลขจริงเป็น 1" — ไม่ใช่ "หน้าแรกของไฟล์"
  // (ฉากที่ตั้งเลขเริ่มต้นไว้ 5 หน้าแรกของมันคือหน้า 5 ต้องมีเลขตามปกติ)
  if (no === 1 && pn.firstPage === false) return '';
  return String(no) + (pn.suffix || '');
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
    // [alpha.83r ข้อ 2] คำยาวที่ไม่มีจุดตัดต้องถูกหั่น ไม่งั้นทะลุขอบกระดาษ
    // — ตัวจัดหน้าหั่นกลางคำอยู่แล้ว จอต้องหั่นตรงกัน ไม่งั้นตัวเลขหน้าไม่ตรงกับที่เห็น
    'overflow-wrap:break-word',
    'word-break:break-word',
  ].join(';');
  const tw = textWidth(f.paper, f.margins);
  for (const k of SP_ELEMENT_KEYS) {
    const c = f.elements[k];
    const s = f.styles[k];
    const ml = Math.max(0, +(num(c.indent, left) - left).toFixed(4));
    // ความกว้างต้องไม่ล้นพื้นที่พิมพ์ (บาง element เช่นทรานซิชันตั้ง indent+width เกินขอบขวาได้)
    // คำนวณเป็นนิ้วที่นี่ ไม่ใช้ max-width:calc(100% - …) เพราะ 100% รวมเส้นขอบกระดาษด้วย → เพี้ยน 2px
    const w = Math.max(0.3, Math.min(num(c.width, 6), +(tw - ml).toFixed(4)));
    // [alpha.87 ข้อ 4] ★ **ระยะเว้นบรรทัดต้องเป็น padding บนกริดบรรทัดของโมเดล**
    //
    // เดิมเป็น `margin-top:<n>em` ซึ่งผิดสองชั้นพร้อมกัน:
    //   1. CSS **ยุบ** margin ที่ติดกันเป็น max() แต่ paginate() **บวก** → หน้าที่มีบล็อกหลายก้อน
    //      ติดกันสั้นกว่าที่โมเดลคิด (เห็นเป็นช่องว่างโหว่กลางหน้า) และบางหน้าล้นขอบล่าง
    //      วัดจริงในแอป: หน้าหนึ่งมี 54 บรรทัด (โควตา 55) แต่สูง 882.9px เกินพื้นที่ 862px
    //   2. `em` ผูกกับ **ขนาดฟอนต์** ไม่ใช่ความสูงบรรทัดของโมเดล — ตั้งฟอนต์ 11pt แล้ว
    //      1 บรรทัดของ CSS = 14.67px ขณะที่โมเดลคิด ⅙ นิ้ว = 16px (บทเรียนเดียวกับ alpha.86
    //      ที่แก้ line-height ไปแล้ว แต่ตกระยะเว้นบรรทัดไว้)
    //
    // padding ยุบไม่ได้ + `--sp-line-h` คือกริดของโมเดลเป๊ะ → DOM สูงเท่าที่โมเดลนับทุกบรรทัด
    // ปัดเป็นจำนวนเต็มบรรทัดให้ตรงกับ `Math.round(linesBefore/10)` ที่ paginate() ใช้
    const mt = Math.round(num(c.linesBefore, 10) / 10);
    const mb = Math.round(num(c.linesBetween, 10) / 10) - 1;   // 1 บรรทัดคือระยะของตัวมันเอง
    // [alpha.60r3a] `page-break` ใช้คลาส `sp-page-break-el` (ชื่อ `sp-page-break` เป็นของเส้นคั่นหน้าอัตโนมัติ)
    const cls = k === 'page-break' ? 'page-break-el' : k;
    const LH = 'var(--sp-line-h, 16px)';
    // [alpha.87 ข้อ D] เก็บ "ระยะเว้นนำ" ไว้ในตัวแปร CSS ด้วย — widget ที่วางแบบ absolute
    // ในบล็อก (เลขฉาก) ต้องเลื่อนลงมาให้เท่ากัน ไม่งั้นมันไปลอยอยู่เหนือข้อความของตัวเอง
    out.push(`.sp.sp-${cls}{--k-pad:${mt};margin-left:${ml}in;width:${w}in;max-width:none;` +
             `margin-top:0;margin-bottom:0;` +
             `padding-top:calc(var(--k-pad) * ${LH});padding-bottom:calc(${Math.max(0, mb)} * ${LH});` +
             `${decl(s.screen)}}`);
  }
  // [alpha.57a ข้อ 2] เลขฉากสองฝั่งของหัวฉาก — วางแบบ absolute เทียบกับกล่องหัวฉาก
  // (คำนวณระยะเป็น "นิ้ว" ที่นี่ ไม่ใช้ calc(%) ด้วยเหตุผลเดียวกับความกว้างด้านบน)
  const so = sceneNumberOffsets(f);
  out.push('.sp.sp-scene{position:relative}');
  // [alpha.83r ข้อ 3] "ต่อเนื่อง (ขวา)" ที่ผู้ใช้พิมพ์เอง — ชิดขวาแบบเดียวกับ (CONTINUED) อัตโนมัติ
  out.push('.sp.sp-cont-right{text-align:right}');
  out.push('.sp.sp-cont-left{text-align:left}');
  // [alpha.87 ข้อ D] ★ **เลขฉากเพี้ยน** — `top:0` ของ absolute คือขอบบนของ *padding box*
  // ตั้งแต่ระยะเว้นบรรทัดย้ายจาก margin มาเป็น padding (alpha.87 ข้อ 4 — เพื่อให้ตรงกับโมเดล)
  // ขอบนั้นอยู่ **เหนือบรรทัดข้อความ** เท่ากับ linesBefore ของหัวฉาก (2 บรรทัด)
  // → เลขฉากไปลอยอยู่คนละบรรทัดกับหัวฉากของตัวเอง (ยิ่งฉากเยอะยิ่งเห็นชัด)
  // เลื่อนลงมาเท่าระยะเว้นนำที่บล็อกนั้นใช้จริง (`--k-pad` ที่กฎด้านบนตั้งไว้ให้)
  out.push('.k-scene-no{position:absolute;top:calc(var(--k-pad, 0) * var(--sp-line-h, 16px));' +
           'white-space:nowrap;user-select:none;' +
           'pointer-events:none;text-transform:none;font-weight:400;font-style:normal;text-decoration:none}');
  out.push(`.k-scene-no-l{left:${so.left}in}`);
  out.push(`.k-scene-no-r{right:${so.right}in}`);
  // [alpha.58 · 55–56] ข้อความต่อเนื่อง — (MORE) เยื้องแนวชื่อตัวละคร · CONTINUED: ชิดซ้าย · (CONTINUED) ชิดขวา
  // [alpha.84 ข้อ 2] `--k-ct-off` = ระยะชดเชยตอนเครื่องหมายถูกวาด **ข้างใน** บล็อก
  // (บทพูดยาวถูกหั่นกลาง → widget อยู่ใน .sp-dialogue ซึ่งเยื้องมาแล้ว) ค่าปกติ = 0
  const ct = { ...CONTINUED_DEFAULTS, ...(f.continued || {}) };
  const moreML = Math.max(0, +(num(ct.indent, 3.7) - left).toFixed(4));
  out.push(`.sp.sp-more{margin-left:calc(${moreML}in + var(--k-ct-off, 0in));width:auto;max-width:none;` +
           'margin-top:0;margin-bottom:0;text-transform:none}');
  out.push(`.sp-continued-top,.sp-cont-top{margin-left:var(--k-ct-off, 0in);` +
           `width:${+tw.toFixed(4)}in;text-align:left}`);
  out.push(`.sp-continued-bottom,.sp-cont-bottom{margin-left:var(--k-ct-off, 0in);` +
           `width:${+tw.toFixed(4)}in;text-align:right}`);
  // [alpha.58r บั๊ก 10] ชื่อตัวละคร + (cont'd) ต้นหน้า — วางแนวเดียวกับ element `character` จริง
  // เดิมไม่มีกฎตรงนี้เลย จึงตกไปใช้ค่าคงที่ใน style.css แล้วไม่ขยับตามที่ผู้ใช้ตั้งระยะเยื้อง
  const contdML = Math.max(0, +(num(f.elements.character?.indent, 3.7) - left).toFixed(4));
  out.push('.sp.sp-contd,.sp-cont-mark.sp-contd{' +
           `margin-left:calc(${contdML}in + var(--k-ct-off, 0in));width:auto;max-width:none;` +
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
/**
 * ══ [alpha.103r ข้อ 1] ★★ ข้อความ "อย่างที่ตาเห็น" — ตัวพิมพ์ใหญ่ต้องวัดจากตัวใหญ่ ══
 *
 * ผู้ใช้ส่งภาพบทที่ตัวหนังสือไหลทะลุขอบล่างของแผ่นลงไปบนพื้นโต๊ะสองบรรทัด
 *
 * ต้นตอ: `caps` ของบทเป็น **การแสดงผลล้วน ๆ** (`text-transform:uppercase` — ตัวอักษรในไฟล์
 * ยังเป็นตัวเล็กตามที่พิมพ์ ดูคอมเมนต์ข้อ 62 บั๊ก 11) แต่ตัววัดความกว้าง **วัดข้อความดิบ**
 * → ชื่อตัวละคร/หัวฉาก/ทรานซิชันถูกวัดเป็นตัวเล็ก แล้วไปวาดเป็นตัวใหญ่ซึ่งกว้างกว่า
 * (ฟอนต์สัดส่วนกว้างขึ้น ~10–15% · ฟอนต์ monospace ไม่ต่าง — จึงไม่มีใครเห็นบั๊กนี้
 *  ตราบใดที่ยังใช้ Courier Prime ล้วน ๆ) → จอตัดบรรทัดได้มากกว่าที่โมเดลนับ
 * = หน้าล้นทีละ 1–2 บรรทัด และ **PDF ก็ผิดแบบเดียวกัน** (pdf-generator วาดตัวใหญ่
 *   แต่ตัดบรรทัดจากตัวเล็ก)
 *
 * ★ ปลอดภัยกับการหั่นข้อความ: เราคืน "ดัชนี" ที่ชี้กลับไปยังข้อความต้นฉบับเสมอ จึงใช้ตัวใหญ่
 * ก็ต่อเมื่อความยาวเท่าเดิมเป๊ะ (ß→SS · ﬁ→FI ทำให้ยาวขึ้น — เคสพวกนั้นถอยไปวัดของเดิม)
 */
export function displayText(text, caps) {
  const s = String(text ?? '');
  if (!caps) return s;
  const up = s.toUpperCase();
  return up.length === s.length ? up : s;
}

/** จำนวนบรรทัดที่ข้อความหนึ่งบล็อกกินจริง เมื่อกว้าง width นิ้ว */
export function wrapLines(text, widthIn, cpi = CHARS_PER_INCH, caps = false, style = null) {
  // [alpha.82] วัดจากความกว้างจริงของฟอนต์ (ถ้าติดตั้งตัววัดไว้) ไม่ใช่กริดตัวอักษรต่อนิ้ว
  // — `cpi` เหลือไว้เป็นทางสำรองตอนยังไม่มีตัววัด (เทสด้วย node / ก่อนฟอนต์พร้อม)
  // ตัวตัดบรรทัดเป็นตัวเดียวกับที่ PDF ใช้ จึงได้จำนวนบรรทัดตรงกันโดยโครงสร้าง
  return wrapText(displayText(text, caps), num(widthIn, 6),
                  { kind: 'sp', cpi, bold: !!(style && style.bold), italic: !!(style && style.italic) });
}
/** บรรทัดจริง ๆ ของบล็อกหนึ่ง (ตัวเดียวกับที่ wrapLines นับ) */
export function wrapScriptLines(text, widthIn, cpi = CHARS_PER_INCH, caps = false, style = null) {
  return wrapLineStrings(displayText(text, caps), num(widthIn, 6),
                         { kind: 'sp', cpi, bold: !!(style && style.bold),
                           italic: !!(style && style.italic) });
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
  const wantSceneMarks = CT.enabled !== false && CT.scene !== false;

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

  // ═══ [alpha.86 ★ ต้นตอของ "บทหนังตัดหน้าผิดตลอด"] บรรทัดว่างเป็นของจริง ห้ามทิ้ง ═══
  //
  // เดิมบรรทัดนี้เขียนว่า `.filter((b) => b.el !== 'blank')` — ทิ้งบรรทัดว่างทั้งหมด
  // แล้วไปสร้างช่องไฟจาก `linesBefore` แทน · **แต่บนจอบรรทัดว่างมีตัวตนจริง**
  // (`spDocFromMarkdown` แปลงบรรทัดว่างในไฟล์เป็นโหนด sp ว่าง ๆ · CSS `.sp{min-height:1em}`)
  //
  // ผลคือช่องไฟหนึ่งช่องระหว่างสองบล็อก:
  //   จอ   = margin-top ของบรรทัดว่าง (1) + ตัวบรรทัดว่าง (1) + margin-top ของบล็อกถัดไป (1) = **3**
  //   โมเดล = linesBefore ของบล็อกถัดไป                                                     = **1**
  // เพี้ยน 2 บรรทัดต่อช่องไฟ · บทหนึ่งหน้ามีช่องไฟหลายสิบ → คลาดเป็นหน้า ๆ และสะสมลงไปเรื่อย ๆ
  // (นิยายไม่เจอเพราะมันวัด DOM จริง ไม่ได้เดา)
  //
  // ที่ถูกคือ **นับบรรทัดว่างเป็น 1 บรรทัดตามที่ตาเห็น** แล้ว *ไม่* เติม linesBefore ซ้ำ
  // เมื่อมีบรรทัดว่างคั่นอยู่แล้ว · ฝั่ง CSS ตัด margin ของบรรทัดว่างทิ้งให้ตรงกัน (ดู style.css)
  // → จอ · โมเดล · PDF · มุมมองหน้าคู่ ได้ตัวเลขเดียวกันทั้งหมด
  const list = (blocks || []).filter(Boolean);
  let prevBlank = false;                 // บล็อกก่อนหน้าเป็นบรรทัดว่างไหม (ช่องไฟมีอยู่แล้ว)
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const c = cfg(b.el);
    // [alpha.60r3a] `---` = บังคับขึ้นหน้าใหม่ — ปิดหน้าปัจจุบันแล้วไปต่อหน้าถัดไป
    // ตัวมันเองไม่กินบรรทัดและไม่ถูกใส่ลงหน้าใด (เป็นคำสั่ง ไม่ใช่เนื้อหา)
    if (b.el === 'page-break') { if (cur.length) pushPage(); prevBlank = false; continue; }
    // บรรทัดว่าง = 1 บรรทัดเต็ม ๆ ไม่มีช่องไฟนำหน้า (ตัวมันเองคือช่องไฟ)
    //
    // [alpha.87 ข้อ A] ★ **เดิมบรรทัดว่างที่เกินโควตาถูกกลืนทิ้งเงียบ ๆ**
    // เงื่อนไขเก่า `if (cur.length && used < perPage)` แปลว่า พอหน้าหนึ่งเต็ม
    // บรรทัดว่างที่เหลือ **ไม่ถูกนับ ไม่ถูกเก็บ และไม่ทำให้ขึ้นหน้าใหม่** —
    // ผู้ใช้กด Enter ค้างในบล็อกบรรยาย จอจึงยืดยาวไปเรื่อย ๆ โดยไม่มีเส้นคั่นหน้าเลย
    // วัดจริง: ป้อน 201 บล็อก (บรรยาย 1 + บรรทัดว่าง 200) → ได้ **1 หน้า** และ
    // **บล็อกหายไป 147 ก้อน** จากผลลัพธ์ของ paginate()
    //
    // และ `cur.length` (ทิ้งบรรทัดว่างที่ต้นหน้า) ก็ทำให้ตัวเลขไม่ตรงกับจอเช่นกัน —
    // บนจอบรรทัดว่างต้นหน้า **มีตัวตนจริง** (เป็นโหนด sp ที่สูงหนึ่งบรรทัด)
    // กติกาเดียวที่ทำให้จอ·โมเดล·PDF ตรงกันคือ **นับทุกบรรทัดว่างเป็น 1 บรรทัด**
    if (b.el === 'blank') {
      if (used >= perPage) pushPage();
      addBlock({ ...b, lines: 1 });
      used += 1;
      prevBlank = true;
      continue;
    }
    if (b.el === 'character') lastChar = String(b.text || '');
    // ท่อนหางที่ไหลมาจากหน้าก่อนไม่ต้องเว้นบรรทัดนำ (มันคือย่อหน้าเดิมที่ถูกหั่น)
    // และถ้ามีบรรทัดว่างคั่นมาแล้ว ช่องไฟก็ถูกใช้ไปแล้ว ไม่เติมซ้ำ
    const before = cur.length && b.split !== 'tail' && !prevBlank
      ? Math.round(num(c.linesBefore, 10) / 10) : 0;
    prevBlank = false;
    // [alpha.103r ข้อ 1] element ที่บังคับตัวพิมพ์ใหญ่ต้องนับบรรทัดจากตัวใหญ่
    const caps = elementCaps(fmt, b.el, 'screen');
    // [alpha.104r] ตัวหนา/ตัวเอียงของ element ก็เป็นความกว้างจริงที่ต้องวัดด้วย
    const stEl = (fmt.styles[b.el] || fmt.styles.action).screen;
    // [alpha.104r] ★ ความกว้างที่ "วาดจริง" ไม่ใช่ค่าดิบในตาราง (ทรานซิชันออกถูกหนีบ 2→1.5)
    const wEl = elementWidthIn(fmt, b.el);
    const body = wrapLines(b.text, wEl, CHARS_PER_INCH, caps, stEl);
    const need = before + body;
    const free = perPage - used;

    // ── [alpha.102 บั๊ก 2] ★ หัวเรื่องห้ามค้างท้ายหน้าโดยไม่มีเนื้อตาม ──
    // ใส่ลงหน้านี้ได้ก็จริง แต่ถ้าที่เหลือไม่พอให้เนื้อของมันตามมาอย่างน้อย keepSceneWithNext
    // บรรทัด ก็ต้องยกไปขึ้นหน้าใหม่ทั้งก้อน (เงื่อนไข `cur.length` กันวนไม่จบ — อยู่ต้นหน้าว่าง ๆ
    // อยู่แล้วก็ไม่มีที่ไหนให้ยกไปอีก · ตั้งค่าเป็น 0 = ปิดกฎนี้)
    const keepN = Math.max(0, Math.round(num(R.keepSceneWithNext, 0)));
    if (need <= free && keepN > 0 && cur.length && KEEP_WITH_NEXT.has(b.el)
        && free - need < keepN && hasContentAfter(list, i)) {
      pushPage();
      i--;                         // คิดใหม่บนหน้าใหม่ (`before` จะกลายเป็น 0 เองเพราะ cur ว่าง)
      continue;
    }
    if (need <= free) { addBlock({ ...b, lines: body }); used += need; continue; }

    // ── ไม่พอ: ตัดสินใจตามชนิด ──
    //
    // ══ [alpha.103 ข้อ 3] ★★ หั่นได้ทุกชนิด — "ให้อิสระแบบ Fade In" ══
    //
    // ผู้ใช้: *"ใน mode บทหนัง block ที่ไม่ใช่บทพูดหรือบรรยาย เมื่อพิมพ์เกินหน้า
    //           จะไม่ยอมตัดบรรทัด · เราไป test ใน Fade In แล้ว block พวกนี้อนุญาตให้ตัดหน้าได้"*
    //
    // ต้นตอเป็นบรรทัดเดียว: เงื่อนไขเดิม `if ((isDlg || isAct) && …)` เป็น **whitelist**
    // ที่มีแค่ dialogue/action/note/summary · ชนิดอื่น (หัวฉาก · วงเล็บ · ทรานสิชั่น ·
    // ฉากย่อย · สลับฉาก · shot · ตอน · โครงเรื่อง 1–3 · raw …) ตกลงเส้นทาง
    // "ยกทั้งก้อนไปหน้าใหม่" เสมอ — แล้วถ้าก้อนนั้นยาวเกินหนึ่งหน้า มันก็กองอยู่หน้าเดียว
    // ทั้งก้อน (ดูด่านสุดท้ายท้ายบล็อกนี้) = หน้าสูงเท่าไรก็ได้ ล้นแผ่นออกไปบนพื้นโต๊ะ
    //
    // ★ **ไม่ต้องมีข้อยกเว้นรายชนิดเลย** — เกณฑ์ widow/orphan ที่มีอยู่แล้วทำหน้าที่นั้นให้เอง:
    //   ต้องเหลือท้ายหน้า ≥ `minBot` (2) และยกไปหน้าใหม่ ≥ `minTop` (3)
    //   → บล็อกที่สั้นกว่า 5 บรรทัด (หัวฉาก · ชื่อตัวละคร · ทรานสิชั่น ซึ่งยาว 1–2 บรรทัด)
    //     ได้ `canBottom = body - minTop` ติดลบ จึงไม่มีทางถูกหั่นกลางโดยอัตโนมัติอยู่ดี
    // กฎ "ห้ามค้างท้ายหน้าเดี่ยว ๆ" (KEEP_WITH_NEXT) ก็ยังทำงานเหมือนเดิม เพราะมันตัดสิน
    // ไปแล้วตั้งแต่ก่อนถึงตรงนี้ (ตอนที่บล็อก *ใส่ลงหน้านี้ได้* แต่ไม่มีที่ให้เนื้อตาม)
    const isDlg = b.el === 'dialogue';
    const minBot = isDlg ? R.minDialogueLinesAtBottom : R.minActionLinesAtBottom;
    const minTop = isDlg ? R.minDialogueLinesAtTop : R.minActionLinesAtTop;

    // [alpha.83 ข้อ 6] ★ **เครื่องหมายต่อเนื่องกินบรรทัดของหน้า — จองไว้ตรงนี้เลย**
    //
    // เดิม annotateContinued() ทำงาน *หลัง* จัดหน้าเสร็จ แล้วแปะ (CONTINUED) ท้ายหน้า /
    // CONTINUED: ต้นหน้าเข้าไปเฉย ๆ → หน้าที่เต็มพอดี 30 บรรทัดกลายเป็น 31 แล้วล้นขอบล่างทุกครั้ง
    // (`(MORE)` ก็เป็นแบบเดียวกัน — ไม่เคยถูกหักออกจากโควตาเลย)
    //
    // เคยลองแก้ด้วยการ "จัดหน้าซ้ำจนลู่เข้า" แล้วพบว่า **ไม่ลู่เสมอไป**: ความกว้างจริงของฟอนต์
    // ทำให้จำนวนบรรทัดขยับตามจุดตัด แล้วรายการจองแกว่งไปมาไม่จบ → ยังมีหน้าที่ล้นหลุดออกมา
    //
    // ที่ถูกคือจองตรงจุดที่ *ตัดสินใจหั่นบล็อก* พอดี เพราะที่นี่รู้ครบแล้วว่า
    // หน้านี้จะได้ (CONTINUED) ท้ายหน้า และหน้าถัดไปจะได้ CONTINUED: ต้นหน้า —
    // เงื่อนไขเดียวกับ annotateContinued() เป๊ะ (บล็อกถูกหั่น + อยู่ในฉากเดียวกัน = `curScene > 0`)
    // จึงไม่ต้องวนซ้ำ ไม่มีทางแกว่ง และตัวเลขตรงกันโดยโครงสร้าง
    // [alpha.86] ★ **เครื่องหมายต่อเนื่องมีสองระบบ และกินบรรทัดไม่เท่ากัน**
    //
    //   บทพูดถูกหั่น  → `(MORE)` ท้ายหน้า + `ชื่อ (CONT'D)` ต้นหน้าใหม่ = **กินบรรทัดจริง**
    //                   (เป็นเนื้อบทตามธรรมเนียม ต้องจองโควตาให้)
    //   ฉากข้ามหน้า   → `(CONTINUED)` / `CONTINUED:` = **วาดในระยะขอบ ไม่กินบรรทัดเลย**
    //                   (แบบเดียวกับ betterfountain และแบบเดียวกับที่ `pdf-generator.js`
    //                    วาดอยู่แล้ว — ดูคอมเมนต์ที่นั่น: "paginate() ไม่กันบรรทัดไว้ให้สองตัวนี้")
    //
    // alpha.83 เคยเผลอจองบรรทัดให้ CONTINUED ด้วย → จอเสียโควตาไป 1 บรรทัด/หน้า
    // ในขณะที่ PDF ไม่เสีย = จอกับไฟล์ตัดคนละที่ · ตอนนี้ถอดออกแล้ว ตรงกันทุกทาง
    const dlgSplit = isDlg && wantDlgMarkers && !!lastChar;
    const moreLines = dlgSplit ? 1 : 0;
    // [alpha.83 ข้อ 6] เดิมถ้าท่อนที่ยกไปหน้าใหม่สั้นกว่า minTop จะ **ไม่ตัดเลย** แล้วยกทั้งก้อน
    // ไปหน้าใหม่ — ซึ่งกับ *ท่อนหางของบล็อกที่ถูกหั่นมาแล้ว* แปลว่ามันจะกองอยู่หน้าถัดไปทั้งก้อน
    // ทั้งที่โควตาไม่พอ (หน้าละ 20 บรรทัดกลายเป็น 21) · ที่ถูกคือ **ดึงบรรทัดขึ้นมาน้อยลง**
    // ให้ท้ายเหลือครบ minTop พอดี แล้วค่อยตัด — กฎ widow/orphan ยังได้ตามเดิมและไม่มีหน้าล้น
    const canBottom = Math.min(free - before - moreLines, body - Math.max(1, minTop));

    if (canBottom >= minBot) {
      // แบ่งครึ่ง: ท้ายหน้าใส่ (MORE) · ต้นหน้าใหม่ทวนชื่อ + (cont'd)
      const head = splitText(b.text, wEl, canBottom, caps, stEl);
      // [alpha.84 ข้อ 2] **จำ "จุดตัด" เป็นระยะตัวอักษรจากต้นบล็อกเดิม**
      // ท่อนหางถือ `pos` ของบล็อกต้นฉบับ (มันคือย่อหน้าเดียวกัน) — ถ้าไม่จำ cut ไว้
      // ตัววาดฝั่ง ProseMirror จะเอาเส้นคั่นหน้า/(MORE)/ชื่อ+(cont'd) ไปแปะที่ *ต้นบล็อก*
      // ทั้งก้อน แทนที่จะเป็นบรรทัดที่ถูกหั่นจริง (โหมดปกติ/จัดหน้าจึงตัดคนละที่กับหน้าคู่)
      const at = String(b.text ?? '').length - String(head.rest ?? '').length;
      // `contIn`/`contOut` = "ไหลมาจากหน้าก่อน" / "ไหลต่อไปหน้าถัดไป" — บล็อกเดียวเป็นได้ทั้งคู่
      // (ย่อหน้ายาวข้ามสามหน้า) ซึ่ง `split:'head'|'tail'` ตัวเดียวบอกไม่ได้
      addBlock({ ...b, text: head.head, lines: canBottom,
                 split: 'head', contIn: !!b.contIn, contOut: true });
      if (moreLines) addBlock({ el: 'more', text: S.dialogueMore, lines: 1, more: true });
      pushPage();
      if (dlgSplit) {
        addBlock({ el: 'character', text: lastChar + ' ' + S.dialogueContd, lines: 1, contd: true });
        used += 1;
      }
      // **ป้อนท่อนหางกลับเข้าลูป** — เดิมยัดลงหน้าใหม่ทั้งก้อนโดยไม่ตรวจซ้ำ
      // ย่อหน้าเดียวที่ยาวเกินสองหน้าจึงได้หน้าที่สูงเท่าไรก็ได้ (อาการ "หน้ากระดาษไม่เท่ากัน")
      // cut สะสม เพราะท่อนหางถูกหั่นซ้ำได้อีก (ย่อหน้าเดียวข้ามสามหน้า)
      list[i] = { ...b, text: head.rest, split: 'tail', contIn: true, contOut: false,
                  cut: num(b.cut, 0) + at };
      i--;
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
    const opened = cur.length > 0;          // ได้ขึ้นหน้าใหม่จริงไหม (กันวนไม่จบด้านล่าง)
    if (cur.length) pushPage();
    for (const x of carry) { cur.push(x); used += x.lines || 1; }
    // [alpha.85 ข้อ 1] **ป้อนกลับเข้าลูปแทนที่จะยัดทั้งก้อน**
    //
    // เดิมเส้นทาง "ยกทั้งบล็อกไปหน้าใหม่" เขียนบล็อกลงหน้าใหม่ตรง ๆ โดยไม่ตรวจซ้ำว่าพอไหม
    // บทพูดที่ยาวเกินหนึ่งหน้าและบังเอิญมาถึงตอนหน้าเดิมเหลือที่น้อยเกินจะหั่น (canBottom < minBot)
    // จึงกองอยู่หน้าใหม่ทั้งก้อน — วัดได้จริง: หน้าละ 20 บรรทัด แต่ได้หน้าที่มี 28 บรรทัด
    // (เส้นทางที่หั่นครึ่งแก้เรื่องนี้ไปแล้วตั้งแต่ alpha.83 แต่เส้นทางนี้ถูกลืม)
    // `opened` กันกรณีอยู่ต้นหน้าว่าง ๆ อยู่แล้ว — ป้อนกลับก็ไม่มีอะไรดีขึ้น มีแต่จะวนไม่จบ
    if (opened && body > perPage - used) { list[i] = b; i--; continue; }
    // ══ [alpha.103 ข้อ 3] ★ ด่านสุดท้าย: อยู่ต้นหน้าแล้วแต่ยังยาวเกินทั้งหน้า ══
    // เกิดได้เมื่อเกณฑ์ที่ผู้ใช้ตั้งเองหั่นไม่ได้ (เช่น `minLinesAtTop` สูงกว่าความจุหนึ่งหน้า
    // → `canBottom` ติดลบตลอด) · เดิมบรรทัดถัดไปยัดทั้งก้อนลงหน้าเดียวโดยไม่ตรวจซ้ำ
    // = แผ่นสูงเท่าไรก็ได้ · ยอมหั่นดิบตรงขอบหน้าดีกว่า — จำนวนหน้าจึงเป็นจริงเสมอ
    let freeNow = perPage - used;
    if (freeNow < 1 && cur.length) { pushPage(); freeNow = perPage; }
    const before2 = cur.length && b.split !== 'tail' && !prevBlank
      ? Math.round(num(c.linesBefore, 10) / 10) : 0;
    const take = Math.max(1, freeNow - before2);
    if (body > take) {
      const head = splitText(b.text, wEl, take, caps, stEl);
      const at = String(b.text ?? '').length - String(head.rest ?? '').length;
      addBlock({ ...b, text: head.head, lines: take, split: 'head',
                 contIn: !!b.contIn, contOut: true });
      pushPage();
      list[i] = { ...b, text: head.rest, split: 'tail', contIn: true, contOut: false,
                  cut: num(b.cut, 0) + at };
      i--;
      continue;
    }
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
  // [alpha.83 ข้อ 6] **CONTINUED ใช้กับ "บล็อกที่ต่อกัน" เท่านั้น**
  // เดิมพอฉากเดียวกันกินสองหน้าก็ขึ้น CONTINUED ทันที แม้รอยต่อจะอยู่ *ระหว่าง* บล็อก
  // (บรรยายจบพอดีบรรทัดสุดท้าย แล้วบรรยายก้อนถัดไปเริ่มหน้าใหม่ = คนละบล็อก แค่บรรทัดติดกัน)
  // ตอนนี้ต้องมีบล็อกที่ถูก *หั่นกลาง* คร่อมรอยต่อจริง ๆ — หน้าถัดไปจึงต้องเริ่มด้วยท่อนหาง
  // (`split:'tail'`) หรือชื่อตัวละคร + (cont'd) ที่ตัวจัดหน้าเติมให้คู่กับท่อนหาง
  const splitsAcross = (n) => {
    const fb = (n.blocks || [])[0];
    return !!fb && (fb.contIn === true || fb.contd === true);
  };
  // [alpha.85 ข้อ 1] รอยต่อที่เป็น "บทพูดถูกหั่น" ใช้ระบบ (MORE)/(CONT'D) ไปแล้ว
  // ห้ามใส่ CONTINUED ซ้ำอีกชั้น (ตัวจัดหน้าก็ไม่ได้จองบรรทัดไว้ให้ด้วย — จะล้นหน้า)
  const dialogueBreak = (p, n) => {
    const lb = (p.blocks || []).slice(-1)[0];
    const fb = (n.blocks || [])[0];
    return (!!lb && lb.more === true) || (!!fb && fb.contd === true);
  };
  let run = 1, contScene = 0;
  for (let i = 0; i < pages.length - 1; i++) {
    const p = pages[i], n = pages[i + 1];
    // [alpha.125 ข้อ J] เปิดสวิตช์ `noHeading` แล้ว หน้าที่ยังไม่มีหัวฉาก (sceneEnd = 0)
    // ก็นับเป็น "ฉากเดียวกันที่ต่อข้ามหน้า" ได้ — ที่เหลือ (ต้องมีบล็อกถูกหั่นคร่อมรอยต่อจริง
    // และต้องไม่ใช่รอยต่อของบทพูดซึ่งใช้ (MORE)/(CONT'D) อยู่แล้ว) ยังเข้มเท่าเดิมทุกข้อ
    const sameScene = n.sceneStart === p.sceneEnd
                      && (p.sceneEnd > 0 || CT.noHeading === true);
    const spans = on && sameScene && splitsAcross(n) && !dialogueBreak(p, n);
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

/**
 * ตัดข้อความให้ส่วนแรกยาว n บรรทัด (กว้าง widthIn นิ้ว) — คืน {head, rest}
 *
 * [alpha.82] ใช้รอยตัดชุดเดียวกับ wrapLines() — เดิมที่นี่เป็นอัลกอริทึมชุดที่สาม
 * ที่ต้อง "ตรงกับอีกสองชุดเป๊ะ" — หัวที่ตัดมายาวไม่เท่าที่หน้าจองไว้เมื่อไหร่ ข้อความก็ล้นหน้า
 * · และตัดจาก **ข้อความต้นฉบับ** ตรง ๆ จึงไม่มีช่องว่างแปลกปลอมโผล่เข้ามาเหมือนตอน join เอง
 */
export function splitText(text, widthIn, n, caps = false, style = null) {
  const s = String(text ?? '');
  // [alpha.103r ข้อ 1] วัดจาก "ตัวที่ตาเห็น" แต่หั่นจากข้อความต้นฉบับ (ดัชนีตรงกันเสมอ)
  const cuts = wrapCuts(displayText(s, caps), num(widthIn, 6),
                        { kind: 'sp', bold: !!(style && style.bold),
                          italic: !!(style && style.italic) });
  if (!cuts.length) return { head: s, rest: '' };
  const k = Math.max(1, Math.min(Math.round(n) || 1, cuts.length));
  const at = cuts[k - 1];
  return { head: s.slice(0, at).replace(/\s+$/, ''), rest: s.slice(at) };
}

/**
 * [alpha.84 ข้อ 2] ตำแหน่ง **ในเอกสาร ProseMirror** ของบล็อกหนึ่งหลังจัดหน้าแล้ว
 *
 * บล็อกปกติ → `pos` = ตำแหน่งของโหนด (ระดับบล็อก)
 * ท่อนหางของบล็อกที่ถูกหั่นกลาง (`cut > 0`) → ตำแหน่ง **ในเนื้อข้อความ** ของโหนดเดิม
 *   = `pos + 1 + cut`  (บวก 1 = ข้ามขอบเปิดของโหนด ตามโมเดลตำแหน่งของ ProseMirror)
 *
 * ถ้าไม่คิด cut ทุกอย่างที่อ้าง "ต้นหน้าถัดไป" (เส้นคั่นหน้า · (MORE) · CONTINUED · ชื่อ+(cont'd))
 * จะไปกองที่หัวย่อหน้าทั้งก้อน — ตรงข้ามกับหน้าที่ตัวจัดหน้าคิดไว้จริง
 * @returns {number|null} null = บล็อกสังเคราะห์ (ไม่มีตัวตนในเอกสาร)
 */
export function blockDocPos(b) {
  if (!b || !Number.isFinite(b.pos)) return null;
  const cut = num(b.cut, 0);
  return cut > 0 ? b.pos + 1 + cut : b.pos;
}

/** บล็อกนี้ถูกหั่นกลางย่อหน้ามาไหม (ตำแหน่งของมันอยู่ "ใน" โหนด ไม่ใช่ระหว่างโหนด) */
export function isMidBlock(b) { return !!b && num(b.cut, 0) > 0; }

/**
 * ระยะเยื้องของ element หนึ่ง เทียบจาก **ขอบพื้นที่พิมพ์** (นิ้ว) — ตัวเดียวกับที่ spCss ใช้
 * ใช้ชดเชยตำแหน่งของเครื่องหมายที่ถูกวาดไว้ *ข้างใน* บล็อก (มันสืบระยะเยื้องของบล็อกมาด้วย)
 */
/**
 * ══ [alpha.104r] ★★ ความกว้างที่ element นี้ **ถูกวาดจริง** (นิ้ว) ══
 *
 * ผู้ใช้: *"ส่วนบทภาพยนตร์ หน้ายังเหลื่อม ตามรูป"* — และต้นตออยู่ตรงนี้
 *
 * `spCss()` หนีบความกว้างไม่ให้ล้นพื้นที่พิมพ์มาตั้งแต่ต้น (คอมเมนต์ในนั้นอธิบายไว้ครบ)
 * แต่ **ตัวจัดหน้าใช้ `c.width` ดิบ ๆ** ไม่เคยหนีบตาม → สองที่คิดคนละความกว้าง
 *
 * มีอยู่ชนิดเดียวที่โดน: **ทรานซิชันออก** (`indent 6.0 + width 2.0 = 8.0` ซึ่งเลยขอบขวา
 * ของพื้นที่พิมพ์ที่ 7.5) → CSS วาดที่ **1.5 นิ้ว** แต่โมเดลนับบรรทัดที่ **2.0 นิ้ว**
 * = จอต้องการบรรทัดมากกว่าที่โมเดลจองไว้ราวหนึ่งในสาม แล้วหน้าก็ล้นสะสมไปเรื่อย ๆ
 * (วัดจริงในโปรแกรม: โมเดล 400 บรรทัด · จอวาด 467)
 *
 * ตั้งแต่นี้ทั้งจอ · โมเดล · PDF อ่านความกว้างจากฟังก์ชันตัวเดียวกัน
 */
export function elementWidthIn(fmt, el) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const c = f.elements[el] || f.elements.action;
  const tw = textWidth(f.paper, f.margins);
  const ml = Math.max(0, +(num(c.indent, f.margins.left) - f.margins.left).toFixed(4));
  return Math.max(0.3, Math.min(num(c.width, 6), +(tw - ml).toFixed(4)));
}

export function elementIndentIn(fmt, el) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const c = f.elements[el] || f.elements.action;
  return Math.max(0, +(num(c.indent, f.margins.left) - f.margins.left).toFixed(4));
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
