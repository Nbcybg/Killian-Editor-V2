// sp-headers.js — หัวกระดาษที่ซ้ำทุกหน้า (ข้อ 91)
// บริสุทธิ์ 100% : ไม่แตะ DOM / kapi / state → ทดสอบด้วย node ได้ (test/sp-headers.test.cjs)
//
// แนวคิด: คล้าย "หน้าปก" (sp-title-pages.js) แต่ต่างกันสองอย่างสำคัญ
//   1) หัวกระดาษ "ซ้ำเอง" ทุกหน้า — ผู้ใช้ตั้งครั้งเดียว
//   2) ข้อความมีตัวแปร ${PAGE} ฯลฯ ที่ถูกแทนค่า "ระหว่างวาดแต่ละหน้า" ไม่ใช่ตอนตั้งค่า
//
// หน่วยระยะเป็น "นิ้ว" เหมือน sp-format.js ทั้งไฟล์ (xOffset = ขยับจากตำแหน่งตามการจัดหน้า)

import { t } from './i18n.js';
import { mergeSpFormat, textWidth, lineHeightIn } from './sp-format.js';
import { num } from './num.js';

// ───────── ตัวแปรที่ใช้ได้ในข้อความหัวกระดาษ ─────────
// เขียนได้ทั้ง ${PAGE} และ ${หน้า} — ตารางนี้เป็น "คำอธิบายให้ UI แสดง" ด้วย
export const HEADER_VARS = [
  { key: 'PAGE', th: t('ui.common.page'), label: t('ui.spHeaders.pageNumCurrent') },
  { key: 'PAGES', th: t('ui.spHeaders.countPage'), label: t('ui.spHeaders.countPageAll') },
  { key: 'TITLE', th: t('ui.common.story'), label: t('ui.common.title') },
  { key: 'AUTHOR', th: t('ui.common.author'), label: t('ui.spHeaders.nameAuthor') },
  { key: 'DRAFT', th: t('ui.spHeaders.edition'), label: t('ui.spHeaders.nameDraftRoundEdit') },
  { key: 'DATE', th: t('ui.common.date'), label: t('ui.spHeaders.dateSendInAct') },
  { key: 'SCENE', th: t('ui.common.scene2'), label: t('ui.spHeaders.headSceneFirstPage') },
  { key: 'COPYRIGHT', th: t('ui.spHeaders.msg'), label: t('ui.spHeaders.text') },
];

export const HEADER_ALIGNS = ['left', 'center', 'right'];

/** สตริงหนึ่งชิ้นบนหัวกระดาษ */
export function newHeaderString(patch = {}) {
  return {
    text: '', align: 'right', xOffset: 0,
    bold: false, italic: false, underline: false, caps: false,
    ...patch,
  };
}

// ค่าเริ่มต้น: ปิดไว้ (บทภาพยนตร์มาตรฐานใช้ "เลขหน้า" ของ sp-format อยู่แล้ว)
// เปิดแล้วได้เลขหน้าชิดขวาแบบเดียวกัน แต่เพิ่มชื่อเรื่อง/ผู้เขียนได้
export const HEADER_DEFAULTS = {
  enabled: false,
  emptyLinesAfter: 1,      // เว้นกี่บรรทัดระหว่างหัวกระดาษกับเนื้อหน้า
  firstPage: false,        // ใส่หัวกระดาษบนหน้าแรกด้วยไหม (ธรรมเนียมบท: ไม่ใส่)
  strings: [newHeaderString({ text: '${PAGE}.', align: 'right' })],
};

/** ผสานค่าที่ผู้ใช้ตั้งทับค่าเริ่มต้น — คืน object ใหม่เสมอ (ไม่แก้ของเดิม) */
export function mergeHeaders(user) {
  const u = user && typeof user === 'object' ? user : {};
  const rows = Array.isArray(u.strings) ? u.strings : HEADER_DEFAULTS.strings;
  return {
    enabled: u.enabled === true,
    emptyLinesAfter: clampLines(u.emptyLinesAfter, HEADER_DEFAULTS.emptyLinesAfter),
    firstPage: u.firstPage === true,
    strings: rows.map((r) => newHeaderString({
      text: String(r?.text ?? ''),
      align: HEADER_ALIGNS.includes(r?.align) ? r.align : 'right',
      xOffset: num(r?.xOffset, 0),
      bold: r?.bold === true, italic: r?.italic === true,
      underline: r?.underline === true, caps: r?.caps === true,
    })),
  };
}

function clampLines(v, d) {
  const n = Math.round(num(v, d));
  return Math.max(0, Math.min(10, Number.isFinite(n) ? n : d));
}

/**
 * แทนค่าตัวแปรในข้อความหัวกระดาษ
 * รับได้ทั้ง ${PAGE} · ${page} · ${หน้า} — ตัวแปรที่ไม่รู้จักถูกทิ้งเป็นข้อความว่าง
 * (ปล่อยไว้เป็น "${XXX}" จะกลายเป็นขยะบนกระดาษของผู้ใช้)
 */
export function resolveHeaderVars(text, ctx = {}) {
  const map = new Map();
  for (const v of HEADER_VARS) {
    const val = ctx[v.key] ?? ctx[v.key.toLowerCase()] ?? '';
    map.set(v.key.toLowerCase(), String(val));
    map.set(v.th, String(val));
  }
  return String(text ?? '').replace(/\$\{([^}]*)\}/g, (m, name) => {
    const k = String(name).trim();
    const hit = map.has(k) ? map.get(k) : map.get(k.toLowerCase());
    return hit === undefined ? '' : hit;
  });
}

/** หัวกระดาษกินพื้นที่กี่บรรทัดของหน้า (0 = ไม่มี) */
export function headerLineCount(hdr) {
  const h = hdr && 'strings' in hdr ? hdr : mergeHeaders(hdr);
  if (!h.enabled) return 0;
  const rows = visibleRows(h);
  if (!rows.length) return 0;
  // สตริงทุกชิ้นอยู่ "บรรทัดเดียวกัน" (ซ้าย/กลาง/ขวา) → 1 บรรทัด + บรรทัดว่างที่ตั้งไว้
  return 1 + h.emptyLinesAfter;
}

function visibleRows(h) {
  return (h.strings || []).filter((r) => String(r.text ?? '').trim() !== '');
}

/**
 * บรรทัดต่อหน้า "ที่เหลือให้เนื้อหา" หลังหักหัวกระดาษ
 * ใช้แทน formatLines(fmt) ตอนจัดหน้าเพื่อส่งออก PDF ที่มีหัวกระดาษ
 */
export function linesForBody(fmt, hdr) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const total = Math.max(1, Math.floor(
    (+f.paper.height - f.margins.top - f.margins.bottom) / lineHeightIn(f)));
  return Math.max(4, total - headerLineCount(hdr));
}

/**
 * สตริงที่ต้องพิมพ์บนหัวของหน้า index (1-based)
 * @returns {Array<{text,align,xOffset,bold,italic,underline}>} — ว่าง = หน้านั้นไม่มีหัวกระดาษ
 */
export function headerStringsFor(index, hdr, ctx = {}) {
  const h = hdr && 'strings' in hdr ? hdr : mergeHeaders(hdr);
  if (!h.enabled) return [];
  const i = Math.max(1, Math.round(num(index, 1)));
  if (i === 1 && !h.firstPage) return [];
  const c = { ...ctx, PAGE: ctx.PAGE ?? i };
  return visibleRows(h).map((r) => {
    let text = resolveHeaderVars(r.text, c);
    if (r.caps) text = text.toUpperCase();
    return { text, align: r.align, xOffset: num(r.xOffset, 0),
             bold: !!r.bold, italic: !!r.italic, underline: !!r.underline };
  }).filter((r) => r.text !== '');
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * HTML ของหัวกระดาษหน้าหนึ่ง (สำหรับ print-to-PDF / พรีวิว)
 * ทุกชิ้นอยู่ในแถวเดียว — วาง absolute ตาม align เพื่อไม่ให้ความยาวของชิ้นหนึ่งดันชิ้นอื่น
 */
export function headerHtml(index, hdr, ctx = {}) {
  const rows = headerStringsFor(index, hdr, ctx);
  if (!rows.length) return '';
  const h = hdr && 'strings' in hdr ? hdr : mergeHeaders(hdr);
  // xOffset เป็นบวก = ขยับไปทางขวา → ฝั่งขวาต้อง "ลดระยะจากขอบขวา" จึงใช้เครื่องหมายกลับ
  const cell = (r) => {
    const side = r.align === 'right' ? 'right' : r.align === 'center' ? 'center' : 'left';
    const off = num(r.xOffset, 0);
    const place = side === 'center'
      ? `left:50%;transform:translateX(calc(-50% + ${off}in))`
      : side === 'right' ? `right:${+(-off).toFixed(4)}in` : `left:${off}in`;
    const st = [
      r.bold ? 'font-weight:700' : '',
      r.italic ? 'font-style:italic' : '',
      r.underline ? 'text-decoration:underline' : '',
      place,
    ].filter(Boolean).join(';');
    return `<span class="sp-hdr-item sp-hdr-${side}" style="${st}">${esc(r.text)}</span>`;
  };
  return `<div class="sp-hdr" data-lines="${headerLineCount(h)}">${rows.map(cell).join('')}</div>`;
}

/** CSS ของหัวกระดาษ (ใช้ร่วมกับ spCss) */
export function headerCss(hdr, fmt) {
  const h = hdr && 'strings' in hdr ? hdr : mergeHeaders(hdr);
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const tw = +textWidth(f.paper, f.margins).toFixed(4);
  return [
    `.sp-hdr{position:relative;width:${tw}in;height:1em;` +
      `margin:0 0 ${Math.max(0, h.emptyLinesAfter)}em 0;white-space:nowrap}`,
    '.sp-hdr-item{position:absolute;top:0}',
    '.sp-hdr-left{left:0}',
    '.sp-hdr-right{right:0}',
  ].join('\n');
}

/** ข้อความหัวกระดาษแบบบรรทัดเดียว (ใช้ตอนส่งออกข้อความล้วน / ตรวจในเทส) */
export function headerPlainLine(index, hdr, ctx = {}, cols = 60) {
  const rows = headerStringsFor(index, hdr, ctx);
  if (!rows.length) return '';
  const w = Math.max(10, Math.round(cols));
  const buf = new Array(w).fill(' ');
  const put = (s, at) => {
    const start = Math.max(0, Math.min(w - s.length, at));
    for (let i = 0; i < s.length; i++) buf[start + i] = s[i];
  };
  for (const r of rows) {
    const s = r.text;
    if (r.align === 'right') put(s, w - s.length);
    else if (r.align === 'center') put(s, Math.floor((w - s.length) / 2));
    else put(s, 0);
  }
  return buf.join('').replace(/\s+$/, '');
}
