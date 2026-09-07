// lang-fonts.js — "ภาษาไหนใช้ฟอนต์อะไร" (alpha.57a ข้อ 5)
//
// ปัญหา: ฟอนต์บทภาพยนตร์มาตรฐาน (Courier Prime / Courier Final Draft) ไม่มีอักษรไทยเลย
//        ปล่อยให้ Chromium เลือกฟอนต์สำรองเอง = ได้คนละตัวในแต่ละเครื่อง คุมหน้าตาไม่ได้
// วิธีแก้: ผู้ใช้กำหนดเองว่า "ช่วงอักขระนี้ → ฟอนต์นี้" ได้อิสระ แล้วประกาศเป็น
//        @font-face หลายก้อน "ชื่อวงศ์เดียวกัน" ต่างกันที่ unicode-range
//        → เบราว์เซอร์เลือกให้เองทีละตัวอักษร ไม่ต้องแก้ font stack ทุกที่
//
// ส่วนคำนวณทั้งหมดบริสุทธิ์ (ทดสอบด้วย node ได้ — test/lang-fonts.test.cjs)
// ส่วนที่แตะ DOM มีแค่ applyLangFonts() ตัวเดียว

import { t } from './i18n.js';
/** ชื่อวงศ์ที่สร้างขึ้นสำหรับสแตก "นิยาย/ทั่วไป" — ต้องมาก่อนฟอนต์อื่นใน font stack เสมอ */
export const LANG_FAMILY = 'K2 Lang';
/** ชื่อวงศ์ที่สร้างขึ้นสำหรับสแตก "บทภาพยนตร์" (คนละชุดกับนิยาย) */
export const SP_FAMILY = 'K2 SP';

/**
 * ══ [alpha.97 ข้อ 12] ★ แถวเดียวใช้ได้ทั้งสองโหมด — และตั้งสัดส่วนได้ทีละแถว ══
 *
 * ผู้ใช้: *"ฟอนต์ตัวอักษร เรามี override มั่วไปหมด · ฟอนต์นิยาย เอาออกไปใช้กับฟอนต์ตามภาษา
 *          ดีกว่า เพราะละเอียดกว่า · คราวนี้ ฟอนต์ไทยในบทภาพยนตร์ ปรับสัดส่วนให้เท่า Courier
 *          ปัญหาคือเราต้องการให้ต่างชาติใช้ด้วย อาจจะต้องเป็น เพิ่ม ลบ เอา"*
 *
 * เดิมมีระบบฟอนต์ **ห้าชุด** ที่ไม่รู้จักกัน: `settings.fontFamily` · `settings.prose.fontFamily`
 * · `settings.spFontFamily` · `langFonts[]` · และ `spThaiFont` ที่ฮาร์ดโค้ดว่า "ไทย" กับ
 * "บทภาพยนตร์" ไว้ในตัวมันเอง — คนเขียนภาษาอื่นจึงไม่มีทางได้ตัวปรับสัดส่วนแบบเดียวกันเลย
 *
 * ตอนนี้เหลือแนวคิดเดียว: **ตารางฟอนต์ตามภาษา** ที่แต่ละแถวบอกได้ครบว่า
 *   ช่วงอักขระไหน → ฟอนต์อะไร → ใช้กับโหมดไหน (`target`) → ย่อ/ขยายเท่าไร (`size`)
 * "ไทยในบทภาพยนตร์ 85%" จึงกลายเป็นแค่ **แถวหนึ่งในตาราง** ที่ลบได้ แก้ได้ และทำซ้ำ
 * ให้ภาษาอื่นได้ทันที
 */
export const FONT_TARGETS = ['all', 'prose', 'screenplay'];

/** ช่วงอักขระสำเร็จรูป — ผู้ใช้เลือกจากรายการนี้ หรือพิมพ์ช่วงเองก็ได้ */
export const SCRIPT_PRESETS = [
  { key: 'thai',    label: t('ui.common.msg8'),            range: 'U+0E00-0E7F' },
  { key: 'latin',   label: t('ui.fonts.english'), range: 'U+0000-024F, U+2000-206F' },
  { key: 'lao',     label: t('ui.fonts.msg2'),            range: 'U+0E80-0EFF' },
  { key: 'khmer',   label: t('ui.fonts.khmer'),           range: 'U+1780-17FF' },
  { key: 'myanmar', label: t('ui.fonts.msg'),           range: 'U+1000-109F' },
  { key: 'cjk',     label: t('ui.fonts.chineseJapanese'), range: 'U+3000-30FF, U+4E00-9FFF, U+FF00-FFEF' },
  { key: 'hangul',  label: t('ui.fonts.korean'),          range: 'U+1100-11FF, U+AC00-D7AF' },
  { key: 'cyrillic', label: t('ui.fonts.cyrillic'),       range: 'U+0400-04FF' },
  { key: 'arabic',  label: t('ui.fonts.msg3'),          range: 'U+0600-06FF' },
  { key: 'devanagari', label: t('ui.fonts.msg4'),     range: 'U+0900-097F' },
  { key: 'all',     label: t('ui.fonts.allChar'),       range: '' },
];

/** ฟอนต์ที่ฝังมากับโปรแกรม — เลือกได้ทันทีโดยไม่ต้องลงเครื่อง */
export const BUILTIN_FONT_FILES = [
  { file: 'CourierPrime-Regular.ttf',  label: t('ui.fonts.courierPrimeDefaultChapter') },
  { file: 'CourierThaiMono.ttf',       label: t('ui.fonts.courierThaiMonoWide') },
  { file: 'CourierThaiProp.ttf',       label: t('ui.fonts.courierThaiProportionalWide') },
];

/**
 * [alpha.60r3a] ฟอนต์ไทย "ของระบบ" — เลือกได้จากกล่องฟอนต์ตามภาษา
 * แจกมากับโปรแกรมไม่ได้ (สิทธิ์ของผู้ผลิต) แต่ถ้าเครื่องมีอยู่แล้วก็ใช้ได้ทันที
 * Thonburi/Ayuthaya = ฟอนต์ระบบของ macOS · Leelawadee UI = ของ Windows
 *
 * ══ [alpha.144] ★★ **Ayuthaya คือตัวที่ "ลอย" ไม่ใช่ตัวที่แก้** ══
 *
 * alpha.60r3a สรุปกลับด้าน แล้วเอา Ayuthaya ไปไว้หัวลูกโซ่ทุกที่ในโปรแกรม พร้อมป้ายว่า
 * "วรรณยุกต์ไม่ลอย" · วัดจริงบนเครื่อง (แคนวาส 80px · ระยะจากท้องวรรณยุกต์ถึงหัวพยัญชนะ
 * ของ `ท` + `่` — ยิ่งมากยิ่งลอย):
 *
 *     CourierThaiMono 3 · Tahoma 2 · TH Sarabun New 6 · Thonburi 7 · Sarabun 8
 *     **Ayuthaya 28**  ← ห่างกว่าตัวอื่น 4 เท่า = อาการ "วรรณยุกต์ลอย" ที่ผู้ใช้เห็น
 *
 * (บทเรียน 48 ที่ว่า CourierThaiMono วางมาร์กห่างก็ผิดด้วย — มันแน่นที่สุดในกลุ่มนี้)
 * → Thonburi ขึ้นหัวลูกโซ่แทน · Ayuthaya ยังเลือกเองได้ แต่ป้ายบอกความจริงแล้ว
 */
export const SYSTEM_THAI_FONTS = [
  { family: 'Thonburi',       label: t('ui.fonts.thonburiMacNoFloat') },
  { family: 'Leelawadee UI',  label: 'Leelawadee UI (Windows)' },
  { family: 'TH Sarabun New', label: t('ui.fonts.tHSarabunNew') },
  { family: 'Ayuthaya',       label: t('ui.fonts.ayuthayaMacFloat') },
];

/**
 * รายการเริ่มต้น
 *  1. ไทยในบทภาพยนตร์ — ย่อ 85% ให้เท่ากล่องบรรทัดของ Courier (เดิมคือ `spThaiFont`)
 *  2. ไทยแบบฝังมากับโปรแกรม — ปิดไว้ ให้เลือกเปิดเอง
 */
export function defaultLangFonts() {
  return [
    { id: 'sp-thai', label: t('ui.common.msg8'), range: SP_THAI_RANGE, target: 'screenplay',
      builtin: '', file: '', family: SP_THAI_FALLBACKS.join(', '), system: true,
      size: 85, ascent: 0, descent: 0, enabled: true },
    { id: 'thai', label: t('ui.common.msg8'), range: 'U+0E00-0E7F', target: 'all',
      builtin: 'CourierThaiMono.ttf', family: '', file: '', system: false,
      size: 100, ascent: 0, descent: 0, enabled: false },
  ];
}

const SAFE_RANGE = /^\s*u\+[0-9a-f]{1,6}(-[0-9a-f]{1,6})?\s*$/i;

/**
 * ทำให้ unicode-range ที่ผู้ใช้พิมพ์ปลอดภัยก่อนยัดลง CSS
 * รับได้ทั้ง "U+0E00-0E7F" และหลายช่วงคั่นด้วยจุลภาค · คืน '' เมื่อไม่มีช่วงที่ใช้ได้เลย
 */
export function normalizeRange(range) {
  const parts = String(range || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = parts.filter((p) => SAFE_RANGE.test(p)).map((p) => p.replace(/\s+/g, '').toUpperCase());
  return ok.join(', ');
}

/** ชื่อฟอนต์ที่ผู้ใช้พิมพ์ → ใส่ใน CSS ได้ (ตัดอัญประกาศ/วงเล็บ/เซมิโคลอนทิ้ง) */
export function cssFamilyName(name) {
  return String(name || '').replace(/["'();{}\\]/g, '').trim();
}

/** แถวหนึ่งใช้งานได้จริงไหม (มีที่มาของฟอนต์ + ช่วงที่อ่านออก) */
export function isUsable(row) {
  if (!row || row.enabled === false) return false;
  const src = row.builtin || row.file || cssFamilyName(row.family);
  if (!src) return false;
  return !row.range || !!normalizeRange(row.range);
}

/** เป้าหมายของแถว — 'all' ใช้ได้ทั้งสองโหมด */
export function rowTarget(row) {
  const v = String((row && row.target) || 'all');
  return FONT_TARGETS.includes(v) ? v : 'all';
}
/** แถวนี้มีผลกับสแตกไหน ('prose' | 'screenplay') */
export function rowAppliesTo(row, target) {
  const t2 = rowTarget(row);
  return t2 === 'all' || t2 === target;
}

const clampPct = (v, lo, hi, dflt) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

/** ชื่อฟอนต์ในเครื่องของแถวหนึ่ง — คั่นด้วยจุลภาคได้ (ลูกโซ่สำรอง) */
export function familyList(row) {
  return String((row && row.family) || '').split(',')
    .map((x) => cssFamilyName(x)).filter(Boolean);
}

/**
 * สร้างข้อความ CSS ของทั้งรายการ
 * @param {Array} rows  [{range, builtin, file, family, target, size, ascent, descent, enabled}]
 * @param {(row)=>string} resolveUrl  แปลง builtin/file เป็น URL ที่โหลดได้ (คืน '' = ข้ามแถวนั้น)
 * @param {{family?:string, target?:string}} [opts]
 *        family = ชื่อวงศ์ที่จะประกาศ (ค่าเริ่มต้น LANG_FAMILY) · target = กรองเฉพาะแถวของโหมดนั้น
 * @returns {string}
 */
export function buildLangFontCss(rows, resolveUrl, opts = {}) {
  const famName = opts.family || LANG_FAMILY;
  const target = opts.target || '';
  const out = [];
  for (const row of rows || []) {
    if (!isUsable(row)) continue;
    if (target && !rowAppliesTo(row, target)) continue;
    const range = normalizeRange(row.range);
    const srcs = [];
    const url = (row.builtin || row.file) && resolveUrl ? resolveUrl(row) : '';
    if (url) srcs.push('url("' + String(url).replace(/"/g, '%22') + '")');
    // local() = ใช้ฟอนต์ที่ลงไว้ในเครื่องแล้ว (ไม่ต้องมีไฟล์ในโปรเจกต์)
    // หลายชื่อ = ลูกโซ่สำรอง ตัวแรกที่เครื่องมีจะถูกใช้ (mac → Ayuthaya · win → Leelawadee UI)
    for (const f of familyList(row)) srcs.push('local("' + f + '")');
    if (!srcs.length) continue;
    // [alpha.97 ข้อ 12] สัดส่วนรายแถว — ตัวที่ทำให้ "ไทยในบทเท่า Courier" เป็นแค่ค่าในตาราง
    const size = clampPct(row.size, 50, 150, 100);
    const asc = clampPct(row.ascent, 0, 200, 0);
    const desc = clampPct(row.descent, 0, 200, 0);
    out.push('@font-face{font-family:"' + famName + '";font-display:swap;' +
             'src:' + srcs.join(',') + ';' +
             (range ? 'unicode-range:' + range + ';' : '') +
             (size !== 100 ? 'size-adjust:' + size + '%;' : '') +
             (asc > 0 ? 'ascent-override:' + asc + '%;' : '') +
             (desc > 0 ? 'descent-override:' + desc + '%;' : '') + '}');
  }
  return out.join('\n');
}

/** เอาวงศ์ที่สร้างขึ้นไปนำหน้า font stack ที่ผู้ใช้ตั้งไว้ */
export function withFamily(stack, famName, hasRows) {
  const s = String(stack || '').trim();
  if (!hasRows || !famName) return s;
  if (s.startsWith('"' + famName + '"')) return s;
  return '"' + famName + '"' + (s ? ', ' + s : '');
}
/** สแตกของนิยาย/ทั่วไป */
export function withLangFamily(stack, hasRows) { return withFamily(stack, LANG_FAMILY, hasRows); }
/** สแตกของบทภาพยนตร์ */
export function withSpFamily(stack, hasRows) { return withFamily(stack, SP_FAMILY, hasRows); }

/**
 * ══ [alpha.144] ★★ ตาข่ายรองอักษรไทย — ท้ายสแตกทุกเส้นทาง ══
 *
 * ผู้ใช้: *"bug วรรณยุกต์ลอย · ตอนนี้เอกสารมีทั้งลอยและไม่ลอย"*
 *
 * ต้นตอ: ผู้ใช้ตั้งฟอนต์เป็น `"Courier New", monospace` ซึ่ง **ไม่มีอักษรไทยสักตัว**
 * เราไม่ได้บอกต่อว่าไทยควรไปที่ไหน → Chromium เลือกเองเป็น **Ayuthaya** (ตัวที่ลอยที่สุด)
 * ขณะที่ช่อง markdown ใช้ `ui-monospace` ซึ่งตกไป Thonburi → **เอกสารเดียวกันลอยบ้างไม่ลอยบ้าง**
 * วัดจริง (ระยะวรรณยุกต์–พยัญชนะ ที่ 80px):
 *     `"Courier New", monospace`              → 28  (ลอย)
 *     `"Courier New", monospace, Thonburi`    →  7  (ปกติ)
 *
 * กติกา: **ห้ามปล่อยให้อักษรไทยตกไปถึงตัวเลือกของเบราว์เซอร์** ต่อท้ายลูกโซ่ไทยที่วางมาร์กถูก
 * ไว้เสมอ · มันไม่มีผลกับฟอนต์ที่มีไทยอยู่แล้ว (ตัวหน้าชนะทุกกรณี) และไม่แตะละติน
 * — ต่างจาก "ฟอนต์ตามภาษา" (K2 Lang) ที่อยู่ **หัวสแตก** และตั้งใจทับของผู้ใช้
 */
export const THAI_SAFE_FALLBACKS = ['Thonburi', 'Leelawadee UI', 'TH Sarabun New', 'Sarabun', 'Noto Sans Thai'];

/** ชื่อวงศ์ในสแตกหนึ่ง (ตัดอัญประกาศ/ช่องว่าง) — ใช้เทียบว่ามีอยู่แล้วหรือยัง */
function stackFamilies(stack) {
  return String(stack || '').split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean);
}

/**
 * ต่อท้ายลูกโซ่ฟอนต์ไทยที่วางวรรณยุกต์ถูก — เรียกซ้ำได้ (ไม่เติมตัวที่มีอยู่แล้ว)
 * @param {string} stack สแตกที่ประกอบเสร็จแล้ว (รวมวงศ์ K2 Lang/K2 SP ถ้ามี)
 * @returns {string}
 */
export function withThaiFallback(stack) {
  const s = String(stack || '').trim();
  const have = new Set(stackFamilies(s));
  const add = THAI_SAFE_FALLBACKS.filter((f) => !have.has(f.toLowerCase()))
    .map((f) => '"' + f + '"');
  if (!add.length) return s;
  return s ? s + ', ' + add.join(', ') : add.join(', ');
}

/**
 * [alpha.144] แถว `sp-thai` ของโปรเจกต์เก่ายังเป็นลูกโซ่ที่ **Ayuthaya นำ** (ตัวที่ลอย)
 * → สลับให้เป็นลูกโซ่ใหม่ แต่ **เฉพาะแถวที่ยังตรงกับค่าเริ่มต้นเดิมเป๊ะ ๆ** เท่านั้น
 * ผู้ใช้ที่เคยพิมพ์ชื่อฟอนต์เองไว้ไม่ถูกแตะ (คนละกติกากับ "รีเซ็ต")
 */
function upgradeThaiChain(family) {
  const cur = String(family || '').split(',').map((s) => s.trim()).filter(Boolean);
  const same = cur.length === SP_THAI_FALLBACKS_LEGACY.length
    && cur.every((f, i) => f.toLowerCase() === SP_THAI_FALLBACKS_LEGACY[i].toLowerCase());
  return same ? SP_THAI_FALLBACKS.join(', ') : String(family || '');
}

/** ทำให้แถวที่อ่านจาก project.khn.json อยู่ในรูปที่ UI ใช้ได้เสมอ */
export function normalizeLangFonts(list) {
  if (!Array.isArray(list)) return defaultLangFonts();
  return list.map((r, i) => ({
    id: String(r?.id || 'f' + i),
    label: String(r?.label || ''),
    range: String(r?.range || ''),
    target: rowTarget(r),
    builtin: String(r?.builtin || ''),
    file: String(r?.file || ''),
    family: upgradeThaiChain(r?.family),
    // [alpha.97 ข้อ 12] ชื่อฟอนต์มาจาก "รายชื่อฟอนต์ในเครื่อง" — ใช้เตือนว่าย้ายเครื่องแล้วอาจหาย
    system: r?.system === true,
    size: clampPct(r?.size, 50, 150, 100),
    ascent: clampPct(r?.ascent, 0, 200, 0),
    descent: clampPct(r?.descent, 0, 200, 0),
    enabled: r?.enabled !== false,
  }));
}

/** จำนวนแถวที่ใช้ได้จริงของแต่ละสแตก */
export function usableCounts(rows) {
  const list = normalizeLangFonts(rows).filter(isUsable);
  return {
    prose: list.filter((r) => rowAppliesTo(r, 'prose')).length,
    screenplay: list.filter((r) => rowAppliesTo(r, 'screenplay')).length,
    total: list.length,
  };
}

// ═════════ ไทยในบทภาพยนตร์ — ตอนนี้เป็น "แถวหนึ่งในตาราง" ไม่ใช่ระบบแยก ═════════
//
// อาการเดิม (alpha.84 ข้อ 1): ฟอนต์ Courier Prime สวยในโหมดนิยาย แต่ในบทภาพยนตร์
// ตัวไทยใหญ่เกิน วรรณยุกต์ชนบรรทัดบน บางตัวหายไปเลย
//
// ต้นเหตุ (วัดจริงด้วย canvas ที่ 100px):
//   · สแตกนิยายเริ่มด้วย **Sarabun** ซึ่งเป็นฟอนต์ไทย → ไทยกับละตินสัดส่วนตรงกัน
//   · สแตกบทเริ่มด้วย **Courier Prime** ซึ่ง *ไม่มีอักษรไทยเลย* → ไทยตกไปฟอนต์สำรอง
//     ที่มีเมตริกคนละชุด: Courier Prime ขึ้นสูง 66 / ลงลึก 22 · Ayuthaya 107 / 30
//     = สูงรวม 137 ในกล่องบรรทัดที่สูงแค่ 100
//   · บทใช้ `line-height:1` ตายตัว (6 บรรทัด/นิ้ว = มาตรฐานอุตสาหกรรม ห้ามขยับ)
//     → ตัวไทยล้นกล่องบรรทัดแล้วชนกันเอง
//
// วิธีแก้ยังเหมือนเดิมทุกประการ (`size-adjust` 85%) — เปลี่ยนแค่ "ที่อยู่ของค่า":
// จากค่าคงที่ในโค้ด มาเป็นแถวในตารางที่ลบได้/ทำซ้ำให้ภาษาอื่นได้

/** ช่วงอักษรไทย (รวมเลขไทยและอักขระพิเศษ) */
export const SP_THAI_RANGE = 'U+0E00-0E7F';
/** ลูกโซ่ฟอนต์ไทยมาตรฐาน — ตัวแรกที่เครื่องมีจะถูกใช้ ([alpha.144] Ayuthaya ออกจากหัวแถว) */
export const SP_THAI_FALLBACKS = ['Thonburi', 'Leelawadee UI', 'TH Sarabun New', 'Sarabun', 'Tahoma'];
/** ลูกโซ่เดิม (Ayuthaya นำ) — ใช้จำหน้าแถวที่ยังไม่เคยถูกผู้ใช้แก้ ตอนอัปเกรดโปรเจกต์เก่า */
export const SP_THAI_FALLBACKS_LEGACY = ['Ayuthaya', 'Thonburi', 'Leelawadee UI', 'Sarabun', 'Tahoma'];
/** 85 = ค่าที่วัดแล้วตัวไทยเท่า Courier Prime พอดี */
export const SP_THAI_SIZE = 85;

/**
 * ย้ายค่าของโปรเจกต์เก่า (`settings.spThaiFont`) มาเป็นแถวในตาราง — เรียกซ้ำได้ ไม่ทับของใหม่
 * @returns {{rows:Array, moved:boolean}}
 */
export function migrateSpThai(list, spThai) {
  const rows = normalizeLangFonts(list);
  if (!spThai || typeof spThai !== 'object') return { rows, moved: false };
  // มีแถวของบทที่คุมช่วงไทยอยู่แล้ว = เคยย้ายแล้ว (หรือผู้ใช้ตั้งเอง) → ไม่ยุ่ง
  const has = rows.some((r) => rowAppliesTo(r, 'screenplay')
    && normalizeRange(r.range) === SP_THAI_RANGE);
  if (has) return { rows, moved: false };
  const fam = cssFamilyName(spThai.family);
  rows.unshift(normalizeLangFonts([{
    id: 'sp-thai', label: t('ui.common.msg8'), range: SP_THAI_RANGE, target: 'screenplay',
    family: fam ? [fam, ...SP_THAI_FALLBACKS.filter((f) => f !== fam)].join(', ')
                : SP_THAI_FALLBACKS.join(', '),
    system: true,
    size: clampPct(spThai.size, 50, 150, SP_THAI_SIZE),
    ascent: clampPct(spThai.ascent, 0, 200, 0),
    descent: clampPct(spThai.descent, 0, 200, 0),
    enabled: spThai.enabled !== false,
  }])[0]);
  return { rows, moved: true };
}

// ───────── ส่วนที่แตะ DOM ─────────
/** ยัด <style id> ก้อนหนึ่งเข้า <head> — เรียกซ้ำได้ (เขียนทับก้อนเดิม) */
function putStyle(id, css) {
  let st = document.getElementById(id);
  if (!st) {
    st = document.createElement('style');
    st.id = id;
    // ต้องอยู่ท้าย <head> เพื่อให้ทับ @font-face ของ style.css ได้เมื่อชื่อวงศ์ซ้ำ
    document.head.appendChild(st);
  }
  st.textContent = css;
  return !!css;
}

/**
 * ยัด @font-face ตามภาษาเข้า <head> — **สองวงศ์**: ของนิยาย (K2 Lang) กับของบท (K2 SP)
 * @returns {{prose:number, screenplay:number, total:number}} จำนวนแถวที่ใช้จริงของแต่ละสแตก
 */
export function applyLangFonts(rows, resolveUrl) {
  const list = normalizeLangFonts(rows).filter(isUsable);
  putStyle('k-lang-fonts',
    buildLangFontCss(list, resolveUrl, { family: LANG_FAMILY, target: 'prose' }));
  putStyle('k-sp-fonts',
    buildLangFontCss(list, resolveUrl, { family: SP_FAMILY, target: 'screenplay' }));
  return usableCounts(list);
}
