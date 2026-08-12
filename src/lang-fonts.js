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
/** ชื่อวงศ์ที่สร้างขึ้น — ต้องมาก่อนฟอนต์อื่นใน font stack เสมอ */
export const LANG_FAMILY = 'K2 Lang';

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
 * [alpha.60r3a] ฟอนต์ไทย "ของระบบ" ที่วางวรรณยุกต์ได้ถูกต้อง — เลือกได้จากกล่องฟอนต์ตามภาษา
 * แจกมากับโปรแกรมไม่ได้ (สิทธิ์ของผู้ผลิต) แต่ถ้าเครื่องมีอยู่แล้วก็ใช้ได้ทันที
 * Ayuthaya = ฟอนต์ระบบของ macOS · Leelawadee UI = ของ Windows
 */
export const SYSTEM_THAI_FONTS = [
  { family: 'Ayuthaya',       label: t('ui.common.ayuthayaMacOSNotFloat') },
  { family: 'Thonburi',       label: 'Thonburi (macOS)' },
  { family: 'Leelawadee UI',  label: 'Leelawadee UI (Windows)' },
  { family: 'TH Sarabun New', label: t('ui.fonts.tHSarabunNew') },
];

/** รายการเริ่มต้น: ไทยใช้ Courier Thai Mono ที่ฝังมา · นอกนั้นปล่อยตาม font stack เดิม */
export function defaultLangFonts() {
  return [
    { id: 'thai', label: t('ui.common.msg8'), range: 'U+0E00-0E7F',
      builtin: 'CourierThaiMono.ttf', family: '', file: '', enabled: false },
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

/**
 * สร้างข้อความ CSS ของทั้งรายการ
 * @param {Array} rows  [{range, builtin, file, family, enabled}]
 * @param {(row)=>string} resolveUrl  แปลง builtin/file เป็น URL ที่โหลดได้ (คืน '' = ข้ามแถวนั้น)
 * @returns {string}
 */
export function buildLangFontCss(rows, resolveUrl) {
  const out = [];
  for (const row of rows || []) {
    if (!isUsable(row)) continue;
    const range = normalizeRange(row.range);
    const srcs = [];
    const url = (row.builtin || row.file) && resolveUrl ? resolveUrl(row) : '';
    if (url) srcs.push(`url("${String(url).replace(/"/g, '%22')}")`);
    const fam = cssFamilyName(row.family);
    // local() = ใช้ฟอนต์ที่ลงไว้ในเครื่องแล้ว (ไม่ต้องมีไฟล์ในโปรเจกต์)
    if (fam) srcs.push(`local("${fam}")`);
    if (!srcs.length) continue;
    out.push(`@font-face{font-family:"${LANG_FAMILY}";font-display:swap;` +
             `src:${srcs.join(',')};` + (range ? `unicode-range:${range};` : '') + '}');
  }
  return out.join('\n');
}

/**
 * เอา "K2 Lang" ไปนำหน้า font stack ที่ผู้ใช้ตั้งไว้
 * (ถ้าไม่มีแถวไหนใช้ได้เลย ก็คืน stack เดิมไม่แตะต้อง)
 */
export function withLangFamily(stack, hasRows) {
  const s = String(stack || '').trim();
  if (!hasRows) return s;
  if (s.startsWith(`"${LANG_FAMILY}"`)) return s;
  return `"${LANG_FAMILY}"` + (s ? ', ' + s : '');
}

/** ทำให้แถวที่อ่านจาก project.khn.json อยู่ในรูปที่ UI ใช้ได้เสมอ */
export function normalizeLangFonts(list) {
  if (!Array.isArray(list)) return defaultLangFonts();
  return list.map((r, i) => ({
    id: String(r?.id || 'f' + i),
    label: String(r?.label || ''),
    range: String(r?.range || ''),
    builtin: String(r?.builtin || ''),
    file: String(r?.file || ''),
    family: String(r?.family || ''),
    enabled: r?.enabled !== false,
  }));
}

// ───────── ส่วนที่แตะ DOM ─────────
/**
 * ยัด <style id="k-lang-fonts"> เข้า <head> — เรียกซ้ำได้ (เขียนทับก้อนเดิม)
 * @returns {number} จำนวนแถวที่ใช้จริง
 */
export function applyLangFonts(rows, resolveUrl) {
  const list = normalizeLangFonts(rows).filter(isUsable);
  let st = document.getElementById('k-lang-fonts');
  if (!st) {
    st = document.createElement('style');
    st.id = 'k-lang-fonts';
    // ต้องอยู่ท้าย <head> เพื่อให้ทับ @font-face ของ style.css ได้เมื่อชื่อวงศ์ซ้ำ
    document.head.appendChild(st);
  }
  st.textContent = buildLangFontCss(list, resolveUrl);
  return list.length;
}
