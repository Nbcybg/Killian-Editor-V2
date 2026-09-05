// export-name.js — [alpha.132 ข้อ 6] ★ ชื่อไฟล์ส่งออกที่ตั้งเองได้ (บริสุทธิ์ 100%)
//
// ผู้ใช้: *"เพิ่ม export file name สามารถตั้งได้ ทำเป็นแถวแยกมาเลย เป็น global
//          สามารถใช้ shortcode ได้ และแสดงตัวอย่างว่า file ที่ save จะใช้ชื่ออะไร
//          และเก็บ โหลด preset ได้"*
//
// ═══ ทำไมต้องมีไฟล์นี้ ไม่ใช่แก้ `suggestName()` ตรง ๆ ═══
// ชื่อไฟล์ที่เสนอตอนกดบันทึกเดิมคือ `<ชื่อเรื่อง>.<นามสกุล>` **ตายตัวทุกทาง** — ผู้ใช้ที่ส่งงาน
// ให้บรรณาธิการรอบละหลายฉบับต้องมานั่งเปลี่ยนชื่อไฟล์ในกล่องบันทึกเองทุกครั้ง (วันที่ · เล่ม ·
// จำนวนคำ) · รอบนี้ชื่อไฟล์กลายเป็น **เทมเพลตที่ใช้โค้ดสั้นได้** เหมือนหัวกระดาษ/หน้าปก
// ซึ่งมีเอนจินอยู่แล้วใน `shortcode.js` — ไฟล์นี้จึงเป็นแค่ชั้นบาง ๆ: ขยายโค้ด → กรองอักขระ
// ต้องห้าม → ต่อ นามสกุล · บวกทะเบียนพรีเซ็ตที่ผู้ใช้เก็บเอง
//
// **ที่เก็บข้อมูล**: `settings.exportName = { template, presets:[{name, template}] }`
// เก็บเป็นค่า **global** (`userData/settings.json`) ตามที่ผู้ใช้สั่งว่า "เป็น global"

import { expandShortcodes } from './shortcode.js';

/** เทมเพลตเริ่มต้น = พฤติกรรมเดิมเป๊ะ (ชื่อเรื่องล้วน) — อัปเกรดมาแล้วต้องไม่มีอะไรเปลี่ยน */
export const DEFAULT_EXPORT_NAME = '[title]';

/** จำนวนพรีเซ็ตที่ผู้ใช้เก็บเองได้สูงสุด */
export const NAME_PRESET_MAX = 20;

/**
 * พรีเซ็ตที่แถมมากับโปรแกรม — **แหล่งความจริงเดียว** ของทั้งเมนูในกล่องและเทส
 * (ป้ายชื่ออ่านจากไฟล์ภาษาโดยผู้เรียก — ไฟล์นี้ไม่ import i18n เพื่อให้เทสด้วย node ล้วนได้)
 */
export const BUILTIN_NAME_PRESETS = [
  { id: 'title', labelKey: 'ui.xname.pTitle', template: '[title]' },
  { id: 'title-date', labelKey: 'ui.xname.pTitleDate', template: '[title] [date:iso]' },
  { id: 'title-book', labelKey: 'ui.xname.pTitleBook', template: '[title] - [book]' },
  { id: 'title-chapter', labelKey: 'ui.xname.pTitleChapter', template: '[title] - [chapter]' },
  { id: 'author-title', labelKey: 'ui.xname.pAuthorTitle', template: '[author] - [title]' },
  { id: 'draft-date', labelKey: 'ui.xname.pDraftDate', template: '[title] draft [date:iso] [words]w' },
];

// อักขระที่ Windows ห้ามใช้ในชื่อไฟล์ → แทนด้วย `_` (ท่าเดิมของ `suggestName` ก่อนรอบนี้)
// (macOS/Linux ห้ามน้อยกว่า — ใช้กฎเข้มที่สุดชุดเดียวทุกระบบ
// ไม่งั้นไฟล์ที่สร้างบนแมคย้ายมาเปิดบนวินโดวส์ไม่ได้ ซึ่งผิดหลัก "พกพาได้" ของโปรเจกต์)
const BAD_CHARS = /[\\\/:*?"<>|\u0000-\u001f]/g;
// ชื่อที่ Windows สงวนไว้ให้อุปกรณ์ — ตั้งเป็นชื่อไฟล์ไม่ได้แม้จะมีนามสกุลต่อท้าย
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
/** ความยาวสูงสุดของส่วนชื่อ (ไม่รวมนามสกุล) — กันเส้นทางยาวเกิน 260 ตัวอักษรของ Windows */
export const NAME_MAX = 120;

/**
 * ทำข้อความให้เป็น "ส่วนชื่อไฟล์" ที่เขียนลงดิสก์ได้จริงทุกระบบ
 * @returns {string} ว่างเปล่าไม่ได้ — ไม่เหลืออะไรเลยคืน `'export'`
 */
export function sanitizeFileBase(s) {
  let out = String(s == null ? '' : s)
    .replace(BAD_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    // จุด/ช่องว่างท้ายชื่อถูก Windows ตัดทิ้งเงียบ ๆ → ตัดเองให้เห็นผลตรงกับที่พรีวิวบอก
    .replace(/[. ]+$/, '')
    .slice(0, NAME_MAX)
    .replace(/[. ]+$/, '');
  // เหลือแต่ตัวคั่น (`///` → `___`) = ไม่มีชื่อจริง — ให้ชื่อสำรองดีกว่าไฟล์ที่อ่านไม่ออก
  if (/^[_\s.]*$/.test(out)) out = '';
  if (RESERVED.test(out)) out = out + '_';
  return out || 'export';
}

/**
 * ชื่อไฟล์เต็มจากเทมเพลต
 * @param {string} template เทมเพลตที่มีโค้ดสั้นได้ (`[title] [date:iso]`)
 * @param {object} ctx      บริบทของ `expandShortcodes` (ดู shortcode.js)
 * @param {string} ext      นามสกุลไม่มีจุด (`'pdf'`)
 * @returns {string} เช่น `นิยายของฉัน 2026-09-04.pdf`
 */
export function buildExportName(template, ctx, ext) {
  const raw = String(template || '').trim() || DEFAULT_EXPORT_NAME;
  // โค้ดที่ไม่รู้จัก **ถูกปล่อยไว้เป็นข้อความเดิม** ตามกฎของ shortcode.js (กฎ "ไม่มี fallback")
  // → พิมพ์ `[titel]` ผิด แล้วเห็น `[titel]` โผล่ในช่องตัวอย่างทันที ดีกว่าชื่อไฟล์หายไปเงียบ ๆ
  const filled = expandShortcodes(raw, ctx || {}).trim();
  const base = sanitizeFileBase(filled);
  const e = String(ext || '').replace(/^\./, '');
  return e ? base + '.' + e : base;
}

/** ค่าที่จำไว้ในการตั้งค่า → รูปที่ใช้งานได้เสมอ (ค่าขยะถูกโยนทิ้ง ไม่ทำให้กล่องพัง) */
export function normalizeExportName(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const seen = new Set();
  const presets = [];
  for (const p of Array.isArray(s.presets) ? s.presets : []) {
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name || '').trim();
    const template = String(p.template || '').trim();
    if (!name || !template || seen.has(name)) continue;
    seen.add(name);
    presets.push({ name, template });
    if (presets.length >= NAME_PRESET_MAX) break;
  }
  // [alpha.132r3] "เปิดไฟล์เมื่อส่งออกเสร็จ" — อยู่ก้อนเดียวกับชื่อไฟล์ เพราะเป็นเรื่องของ
  // **ไฟล์ปลายทาง** เหมือนกัน และเป็นค่า global เหมือนกัน (ไม่ใช่ค่าของโปรเจกต์ใดโปรเจกต์หนึ่ง)
  return { template: String(s.template || '').trim() || DEFAULT_EXPORT_NAME, presets,
           openAfter: s.openAfter === true };
}

/** บันทึกพรีเซ็ต (ชื่อซ้ำ = เขียนทับตัวเดิม ไม่เพิ่มแถวใหม่) */
export function saveNamePreset(list, name, template) {
  const n = String(name || '').trim();
  const tpl = String(template || '').trim();
  const cur = normalizeExportName({ presets: list }).presets;
  if (!n || !tpl) return cur;
  const i = cur.findIndex((p) => p.name === n);
  if (i >= 0) { const next = cur.slice(); next[i] = { name: n, template: tpl }; return next; }
  return cur.length >= NAME_PRESET_MAX ? cur : [...cur, { name: n, template: tpl }];
}

/** ลบพรีเซ็ตตามชื่อ */
export function deleteNamePreset(list, name) {
  const n = String(name || '').trim();
  return normalizeExportName({ presets: list }).presets.filter((p) => p.name !== n);
}
