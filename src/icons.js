// icons.js — ไอคอนทั้งโปรแกรม
//
// [alpha.147] ★ รูปไอคอนย้ายออกจากโค้ดแล้ว — ผู้ใช้: *"แยก icon กับข้อความ · เปลี่ยนก็แค่ใส่ svg ใหม่
// ลงไปใน folder svg โดยใช้ชื่อเดิม"*
//   · รูป            = icons/svg/<ชื่อ>.svg
//   · คำสั่งใช้รูปไหน = icons/commands.csv (ช่อง icon ว่าง = คำสั่งนั้นไม่มีไอคอน)
//   · ชื่อที่ยังไม่มีไฟล์ svg = ใช้ตัวอักษรสำรองจาก icons/glyphs.csv ไปก่อน (อีโมจิเดิม)
// build.js รวมทั้งหมดเป็น src/generated/commands-data.js — **อย่าเขียน path ของไอคอนลงโค้ดอีก**
//
// icon(name, size) → element · iconHtml(name, size) → HTML string · commandIcon(id) → ชื่อไอคอนของคำสั่ง
import { ICON_SVG, ICON_GLYPH, COMMAND_ICON } from './generated/commands-data.js';

/** มีไอคอนชื่อนี้จริงไหม (svg หรือตัวสำรอง) — ใช้กรองค่าเก่าที่เก็บเป็นอีโมจิ */
export function hasIcon(name) { return !!(name && (ICON_SVG[name] || ICON_GLYPH[name])); }

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
  return `<span class="k-icon-glyph" aria-hidden="true" data-k-icon="${escAttr(name)}" style="${style};display:inline-block;line-height:1;text-align:center;width:${sz}px;font-size:${Math.round(sz * 0.82)}px">${escAttr(g)}</span>`;
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
