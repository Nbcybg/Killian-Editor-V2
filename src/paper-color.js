// paper-color.js — สีกระดาษที่ผู้ใช้เลือกเอง (alpha.100 ข้อ 1 + 4) · **โมดูลบริสุทธิ์ 100%**
//
// ผู้ใช้: *"หน้ากระดาษที่เป็นสีเหลือง check เลยว่ามีจุดไหน ให้เปลี่ยนเป็นสีขาวให้หมด
//          หรือทำ option ให้ผู้ใช้เปลี่ยนสีที่ต้องการได้"*
//
// เดิมสีกระดาษเป็นเลขฝังใน CSS ชุดเดียว (`:root { --paper:#f5f1e6 }` = ครีมของ alpha.34)
// **ไม่มีโค้ดที่ไหนเขียนตัวแปรนี้เลย** → เปลี่ยนไม่ได้จริง ๆ · และสีข้างเคียงอีก 4 ตัว
// (เส้นขอบแผ่น · เส้นประคั่นหน้า · พื้นบล็อกโค้ด · สีหมึก) เป็นเลขครีมฝังตายกระจายอยู่หลายที่
// → เปลี่ยน --paper อย่างเดียวก็ยังได้กระดาษขาวขอบครีม
//
// ที่นี่คือแหล่งความจริงเดียว: **เลือกสีกระดาษมาสีเดียว แล้วอีกสี่ตัวคำนวณตามให้ครบ**
// (ทดสอบด้วย node ได้ — test/paper-color.test.cjs)

import { t } from './i18n.js';

/** สีกระดาษเริ่มต้น — ขาว (เดิมเป็นครีม ซึ่งยังเลือกได้จากพรีเซ็ต) */
export const PAPER_DEFAULT = '#ffffff';

/** พรีเซ็ตสีกระดาษ — `color` เป็น hex 6 หลักเสมอ
 *
 * [alpha.128] เดิมป้ายเป็น ``T`ขาว` `` (msgid = ตัวข้อความไทยเอง) — **ซึ่งไม่มีแถวในไฟล์ภาษาเลย
 * สักตัวเดียว** จึงตกกลับเป็นไทยตลอดกาล: สลับหน้าจอเป็นอังกฤษแล้วชื่อสีกระดาษยังเป็นไทยอยู่
 * ตอนนี้เป็นคีย์จริงเหมือนที่อื่นทั้งโปรเจกต์ (กฎถาวร alpha.77) */
export const PAPER_PRESETS = [
  { key: 'white', color: '#ffffff', label: t('ui.paper.colorWhite') },
  { key: 'cream', color: '#f5f1e6', label: t('ui.paper.colorCream') },
  { key: 'sepia', color: '#efe3cc', label: t('ui.paper.colorSepia') },
  { key: 'gray',  color: '#eeeeee', label: t('ui.paper.colorGray') },
  { key: 'mint',  color: '#eaf2ec', label: t('ui.paper.colorMint') },
  { key: 'dark',  color: '#2b2b2b', label: t('ui.paper.colorDark') },
];

// ───────── แปลงสี ─────────
/** '#f5f1e6' | 'f5f1e6' | '#fff' → {r,g,b} · รูปแบบที่อ่านไม่ออกคืน null */
export function hexRgb(hex) {
  let h = String(hex == null ? '' : hex).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
/** {r,g,b} → '#rrggbb' (ตัวพิมพ์เล็กเสมอ — เทียบสตริงกับพรีเซ็ตได้ตรง ๆ) */
export function rgbHex(c) {
  if (!c) return PAPER_DEFAULT;
  return '#' + [c.r, c.g, c.b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
}
/** ทำให้เป็น hex 6 หลักตัวพิมพ์เล็ก · อ่านไม่ออก = คืนค่าเริ่มต้น */
export function normalizePaperColor(hex, fallback = PAPER_DEFAULT) {
  const c = hexRgb(hex);
  return c ? rgbHex(c) : fallback;
}
/** ผสมสีเข้าหา target ตามสัดส่วน 0..1 (0 = สีเดิม · 1 = target เต็ม) */
export function mixHex(hex, target, amount) {
  const a = hexRgb(hex), b = hexRgb(target);
  if (!a || !b) return normalizePaperColor(hex);
  const k = Math.max(0, Math.min(1, +amount || 0));
  return rgbHex({ r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k });
}
/** ความสว่างรับรู้ 0..1 (สูตร sRGB relative luminance แบบย่อ — พอสำหรับตัดสินหมึกดำ/ขาว) */
export function luminance(hex) {
  const c = hexRgb(hex);
  if (!c) return 1;
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
/** กระดาษสีนี้ถือว่า "สว่าง" ไหม (สว่าง = หมึกดำ · มืด = หมึกขาว) */
export const isLightPaper = (hex) => luminance(hex) >= 0.4;

/**
 * ตัวแปร CSS ทั้งชุดจากสีกระดาษสีเดียว
 *
 * เดิมสีพวกนี้ฝังตายเป็นโทนครีมกระจายใน style.css (`#d8d2c2` ขอบแผ่น · `#c9c2ae` เส้นประ
 * · `#f2f0ea` บล็อกโค้ด) — พอผู้ใช้เลือกกระดาษขาว มันจะค้างเป็นครีมทั้งหมด
 * ตอนนี้ทุกตัวเป็น "สีกระดาษที่เข้มขึ้นเป็นขั้น ๆ" จึงเข้ากับทุกสีที่เลือกโดยอัตโนมัติ
 *
 * @param {string} hex สีกระดาษที่ผู้ใช้เลือก
 * @returns {{'--paper':string,'--paper-ink':string,'--paper-edge':string,
 *            '--paper-line':string,'--paper-code':string,'--paper-dim':string}}
 */
export function paperVars(hex) {
  const paper = normalizePaperColor(hex);
  const light = isLightPaper(paper);
  const toward = light ? '#000000' : '#ffffff';
  return {
    '--paper': paper,
    // หมึก: กระดาษสว่าง = เกือบดำ · กระดาษมืด = เกือบขาว (ไม่ใช่ดำ/ขาวสุดโต่ง อ่านสบายกว่า)
    '--paper-ink': mixHex(paper, toward, light ? 0.9 : 0.88),
    '--paper-edge': mixHex(paper, toward, 0.16),   // เส้นขอบแผ่นกระดาษ
    '--paper-line': mixHex(paper, toward, 0.26),   // เส้นประคั่นหน้า / เส้นบอกระยะขอบ
    '--paper-code': mixHex(paper, toward, 0.05),   // พื้นบล็อกโค้ดบนกระดาษ
    '--paper-dim': mixHex(paper, toward, 0.48),    // ป้ายเลขหน้า / ข้อความจาง ๆ บนกระดาษ
  };
}

/** คีย์พรีเซ็ตที่ตรงกับสีนี้ · ไม่ตรงสักตัว = '' (ผู้ใช้ตั้งเอง) */
export function matchPaperPreset(hex) {
  const c = normalizePaperColor(hex);
  const hit = PAPER_PRESETS.find((p) => p.color === c);
  return hit ? hit.key : '';
}
/** สีของพรีเซ็ต · ไม่รู้จัก = null (เรียกใช้แล้วอย่าไปแตะสีเดิม) */
export function paperPresetColor(key) {
  const hit = PAPER_PRESETS.find((p) => p.key === key);
  return hit ? hit.color : null;
}
