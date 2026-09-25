// icons.js — ไอคอนทั้งโปรแกรม
//
// [alpha.147] ★ รูปไอคอนย้ายออกจากโค้ดแล้ว — ผู้ใช้: *"แยก icon กับข้อความ · เปลี่ยนก็แค่ใส่ svg ใหม่
// ลงไปใน folder svg โดยใช้ชื่อเดิม"*
// [alpha.166] ★ ไอคอนชุดเดียวทั้งโปรแกรม = **Nerd Fonts** (ผู้ใช้: *"icon ทั้ง app เน้นความทันสมัย และมืออาชีพ
// ลองไปดึงจาก nerdfonts.com"*) — เดิมปนกันสามแบบ: svg ทึบ (Boxicons) · อีโมจิสี · ไอคอนเส้นวาดเอง
//   · ชื่อ → ไอคอน     = icons/glyphs.csv ช่อง `nf` (ชื่อจาก cheat sheet ของ nerdfonts.com)
//   · รูป svg          = สร้างจากฟอนต์เดียวกันตอน build (icons/svg/<ชื่อ>.svg ของผู้ใช้ทับได้)
//   · ตัวอักษรบนจอ     = อักขระของฟอนต์ "K2 Icons" (renderer/assets/fonts/k2-icons.ttf · อยู่ในทุกสแตกฟอนต์ผ่าน --thai-net)
//   · ตัวอักษรล้วน     = ช่อง `glyph` — ใช้กับข้อความที่ออกนอกจอ (ไฟล์ส่งออก · ข้อความถึง AI) ผ่าน gt()
//   · คำสั่งใช้รูปไหน  = icons/commands.csv (ช่อง icon ว่าง = คำสั่งนั้นไม่มีไอคอน)
// build.js รวมทั้งหมดเป็น src/generated/commands-data.js — **อย่าเขียน path ของไอคอนลงโค้ด**
//
// icon(name, size) → element · iconHtml(name, size) → HTML string · commandIcon(id) → ชื่อไอคอนของคำสั่ง
import { ICON_SVG, ICON_GLYPH, ICON_TEXT, COMMAND_ICON } from './generated/commands-data.js';

/** ชื่อวงศ์ฟอนต์ไอคอน — ผืนวาด (canvas/fabric) ต้องใส่หัวสแตกเองเพราะไม่ได้รับ CSS */
export const ICON_FONT = '"K2 Icons"';

/** มีไอคอนชื่อนี้จริงไหม (svg หรือตัวสำรอง) — ใช้กรองค่าเก่าที่เก็บเป็นอีโมจิ */
export function hasIcon(name) { return !!(name && (ICON_SVG[name] || ICON_GLYPH[name])); }

/** อักขระนี้เป็นของฟอนต์ไอคอน (Private Use Area) ไหม — ต้องวาดด้วยวงศ์ K2 Icons */
export function isIconChar(g) { const c = String(g || '').codePointAt(0) || 0; return (c >= 0xE000 && c <= 0xF8FF) || c >= 0xF0000; }

/**
 * ══ [alpha.150r2] ไอคอนในรูป **ตัวอักษร** ══
 *
 * ผู้ใช้: *"icon ข้อความ ui ห้าม hard code"* — ทั้งโปรแกรมมีไอคอนเขียนไว้ในโค้ดตรง ๆ 600 กว่าจุด
 * ซึ่งส่วนใหญ่เป็นข้อความที่ถูกต่อสตริง (`'📄 ' + ชื่อฉาก`) ไม่ใช่ element ที่ใส่ svg ได้
 * `gi()` จึงเป็นทางให้จุดพวกนั้นอ่านค่าจากทะเบียนแทนการฝังอักขระไว้ในซอร์ส
 *
 * ที่ที่ใส่ element ได้ ให้ใช้ `icon()` / `iconHtml()` / `data-icon` ต่อไป — ได้ svg จริงซึ่งคมกว่า
 * และเปลี่ยนรูปได้ด้วยการวางไฟล์ svg ทับ · `gi()` คืนตัวอักษรจาก `icons/glyphs.csv` เท่านั้น
 *
 * ไม่มีชื่อนี้ในทะเบียน = คืน `''` (ไม่โชว์ชื่อไอคอนเป็นตัวหนังสือให้ผู้ใช้เห็น)
 * — เทส `ui-audit` กวาดทุก `gi('…')` ในซอร์สเทียบกับทะเบียน ชื่อผิดจึงแดงตั้งแต่ยังไม่ถึงผู้ใช้
 */
export function gi(name) { return (name && ICON_GLYPH[name]) || ''; }

/**
 * [alpha.166] ไอคอนในรูป **ตัวอักษรล้วน** — สำหรับข้อความที่ออกนอกหน้าจอของโปรแกรม
 * (ไฟล์ HTML/ข้อความที่ส่งออก · ข้อความที่ส่งให้ AI · คลิปบอร์ด) ซึ่งไม่มีฟอนต์ K2 Icons ให้ใช้
 * — อักขระ Private Use ของ gi() จะกลายเป็นกล่องสี่เหลี่ยมทันทีที่ออกไปนอกโปรแกรม
 */
export function gt(name) { return (name && ICON_TEXT[name]) || ''; }

let _rev = null;
/**
 * [alpha.166] แปลงอักขระไอคอน (ฟอนต์ K2 Icons) ในข้อความ → ตัวอักษรล้วน ก่อนข้อความออกนอกโปรแกรม
 * (ข้อความที่อ่านมาจากหน้าจอแล้วเอาไปเขียนไฟล์ · คัดลอก) — อักขระที่ไม่มีตัวแทนถูกตัดทิ้ง ไม่ปล่อยเป็นกล่อง
 */
export function plainIcons(str) {
  const s = String(str == null ? '' : str);
  if (!/[\uE000-\uF8FF\uDB80-\uDBBF]/.test(s)) return s;
  if (!_rev) {
    _rev = new Map();
    for (const [name, g] of Object.entries(ICON_GLYPH)) if (isIconChar(g) && !_rev.has(g)) _rev.set(g, ICON_TEXT[name] || '');
  }
  return Array.from(s, (ch) => (isIconChar(ch) ? (_rev.get(ch) ?? '') : ch)).join('').replace(/^ +/, '');
}

/** ชื่อไอคอนของคำสั่ง · '' = ช่อง icon ว่าง (ตั้งใจไม่มี) หรือคำสั่งยังไม่ลงทะเบียน */
export function commandIcon(id) { return (id && COMMAND_ICON[id]) || ''; }

/** คำสั่งนี้มีแถวใน icons/commands.csv ไหม — แยก "ตั้งใจเว้นว่าง" ออกจาก "ลืมลงทะเบียน" */
export function isRegisteredCommand(id) { return !!id && Object.prototype.hasOwnProperty.call(COMMAND_ICON, id); }

const escAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function svgMarkup(name, sz, style) {
  const def = ICON_SVG[name];
  // fill="currentColor" เป็นค่าตั้งต้น — ไฟล์เส้น (stroke) ที่ประกาศ fill="none" เองจะทับให้เอง
  const attrs = { viewBox: '0 0 24 24', fill: 'currentColor', ...def.attrs };
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${escAttr(v)}"`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" ${a} aria-hidden="true" data-k-icon="${escAttr(name)}" style="${style}">${def.inner}</svg>`;
}
function glyphMarkup(name, sz, style) {
  const g = ICON_GLYPH[name];
  if (!g) return '';
  // อักขระของฟอนต์ไอคอนเต็มช่อง 1em พอดี (Nerd Font Mono) · ตัวอักษรธรรมดาย่อลงให้พอดีกรอบ
  const fs = isIconChar(g) ? sz : Math.round(sz * 0.82);
  return `<span class="k-icon-glyph" aria-hidden="true" data-k-icon="${escAttr(name)}" style="${style};display:inline-block;line-height:1;text-align:center;width:${sz}px;font-size:${fs}px">${escAttr(g)}</span>`;
}

export function icon(name, size) {
  const sz = size || 18;
  const style = 'vertical-align:middle;flex-shrink:0;pointer-events:none';
  const html = name && ICON_SVG[name] ? svgMarkup(name, sz, style) : glyphMarkup(name, sz, style);
  const wrap = document.createElement('span');
  wrap.innerHTML = html;
  // ไม่มีทั้งรูปและตัวสำรอง = คืนช่องว่างกว้างเท่าไอคอน (ของเดิมคืน svg เปล่า — ปุ่มไม่เบี้ยว)
  if (!wrap.firstElementChild) {
    const blank = document.createElement('span');
    blank.setAttribute('aria-hidden', 'true');
    blank.style.cssText = `${style};display:inline-block;width:${sz}px;height:${sz}px`;
    return blank;
  }
  return wrap.firstElementChild;
}

// [alpha.126] `iconSvg` / `nfCss` / `hasNf` ถูกถอด — ไม่มีใครเรียกเลยสักที่
// [alpha.147] ตาราง NerdFont ถูกถอดด้วย — ตัวสำรองตอนไม่มี svg คือ icons/glyphs.csv แทน
// [alpha.166] Nerd Fonts กลับมาเป็นแหล่งหลัก — แต่อยู่ในทะเบียน (glyphs.csv) ไม่ใช่ตารางในโค้ด
export function iconHtml(name, size) {
  const sz = size || 18;
  const style = 'vertical-align:middle;flex-shrink:0';
  return name && ICON_SVG[name] ? svgMarkup(name, sz, style) : glyphMarkup(name, sz, style);
}

/**
 * ใส่ไอคอนให้ element ใน HTML
 *   · `data-command="fmt:bold"` — [alpha.147] ไอคอนมาจากทะเบียนคำสั่ง (ช่องว่าง = ไม่ใส่)
 *   · `data-icon="bold"`        — ไอคอนประดับที่ไม่ใช่คำสั่ง (ของเดิม)
 * เรียกซ้ำได้ — ตัวที่ใส่แล้วไม่ใส่ซ้ำ
 */
export function initIcons(root) {
  const scope = root || document;
  for (const el of scope.querySelectorAll('[data-command]')) {
    if (el.hasAttribute('data-k-icon-done')) continue;
    el.setAttribute('data-k-icon-done', '1');
    const name = commandIcon(el.getAttribute('data-command'));
    if (!name) continue;
    const sz = parseInt(el.getAttribute('data-icon-size'), 10) || 18;
    el.insertBefore(icon(name, sz), el.firstChild);
  }
  for (const el of scope.querySelectorAll('[data-icon]')) {
    const name = el.getAttribute('data-icon');
    const sz = parseInt(el.getAttribute('data-icon-size'), 10) || 18;
    if (!name) continue;
    el.insertBefore(icon(name, sz), el.firstChild);
    el.removeAttribute('data-icon');
    el.removeAttribute('data-icon-size');
  }
}

export function iconLabel(name, text, size) {
  const span = document.createElement('span');
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px';
  if (name) span.appendChild(icon(name, size || 16));
  if (text) span.appendChild(document.createTextNode(text));
  return span;
}
