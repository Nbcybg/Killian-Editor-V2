// export-watermark.js — PDF ลายน้ำรายคน (ข้อ 70)
// สร้าง "หลายไฟล์ ลายน้ำต่างกันต่อผู้รับ" เพื่อตามรอยได้ว่าบทหลุดจากใคร
//
// ส่วนสร้าง HTML บริสุทธิ์ 100% (ทดสอบด้วย node ได้ — test/sp-export.test.cjs)
// ส่วนที่เขียนไฟล์รับ `api` เข้ามา (kapi) จึงไม่ผูกกับ Electron ตอนทดสอบ

import { T } from './i18n.js';
import { mergeSpFormat, spCss, textWidth } from './sp-format.js';
import { num } from './num.js';

export const DEFAULT_WM = {
  fontSize: 54,            // px
  color: 'rgba(0,0,0,0.10)',
  angle: -35,              // องศา
  repeat: 1,               // 1 = กลางหน้าเดียว · >1 = ปูทั้งหน้า
};

/** ชื่อไฟล์ที่ปลอดภัยกับทุกระบบไฟล์ */
export function safeFileName(s) {
  return String(s ?? '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || T`ไม่มีชื่อ`;
}

/** แทนค่าในแม่แบบลายน้ำ: {ชื่อ} {name} {วันที่} {date} {เรื่อง} {title} */
export function watermarkText(tpl, ctx = {}) {
  const t = String(tpl ?? '').trim() || T`{ชื่อ}`;
  return t
    .replace(/\{ชื่อ\}|\{name\}/g, ctx.name ?? '')
    .replace(/\{วันที่\}|\{date\}/g, ctx.date ?? '')
    .replace(/\{เรื่อง\}|\{title\}/g, ctx.title ?? '')
    .trim();
}

/**
 * แปลงข้อความหลายบรรทัดเป็นรายชื่อผู้รับ
 * รูปแบบต่อบรรทัด: "ชื่อผู้รับ" หรือ "ชื่อผู้รับ | ข้อความลายน้ำ"
 */
export function parseRecipients(text) {
  return String(text ?? '').split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('|');
      const name = (i >= 0 ? l.slice(0, i) : l).trim();
      const wm = i >= 0 ? l.slice(i + 1).trim() : '';
      return { name, watermark: wm || name };
    })
    .filter((r) => r.name);
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** @font-face ของฟอนต์ที่ฝังมากับโปรแกรม (ส่ง URL แบบ file:// เข้ามา) */
export function fontFaceCss(urls) {
  if (!urls || !urls.regular) return '';
  const face = (u, w, st) => u
    ? `@font-face{font-family:"Courier Prime";font-weight:${w};font-style:${st};` +
      `src:url("${u}") format("truetype");}`
    : '';
  return [face(urls.regular, 400, 'normal'), face(urls.bold, 700, 'normal'),
          face(urls.italic, 400, 'italic'), face(urls.boldItalic, 700, 'italic')]
    .filter(Boolean).join('\n');
}

/**
 * สร้าง HTML ของบททั้งเรื่อง (พร้อมลายน้ำ) — เอาไปสั่ง printToPDF ได้ทันที
 * @param {{pages:Array}} pages ผลจาก paginate()
 * @param {object} fmt          รูปแบบบท (sp-format)
 * @param {object} opts { watermark, wmOptions, fontUrls, title, showPageNumbers }
 */
export function buildWatermarkHtml(pages, fmt, opts = {}) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const list = (pages && pages.pages) || pages || [];
  const wm = { ...DEFAULT_WM, ...(opts.wmOptions || {}) };
  const wmText = String(opts.watermark || '').trim();
  const tw = textWidth(f.paper, f.margins);
  const ph = +f.paper.height - f.margins.top - f.margins.bottom;

  const body = list.map((pg) => {
    const rows = [];
    if (opts.showPageNumbers !== false && pg.index > 1) {
      rows.push(`<div class="pg-num">${pg.index}.</div>`);
    }
    if (pg.continuedTop) rows.push(`<div class="sp sp-cont-top">${esc(pg.continuedTop)}</div>`);
    for (const b of pg.blocks || []) {
      rows.push(`<div class="sp sp-${esc(b.el || 'action')}">${esc(b.text || '')}</div>`);
    }
    if (pg.continuedBottom) rows.push(`<div class="sp sp-cont-bottom">${esc(pg.continuedBottom)}</div>`);
    const mark = wmText ? `<div class="wm">${esc(wmText)}</div>` : '';
    return `<section class="pg">${mark}<div class="pg-body">${rows.join('')}</div></section>`;
  }).join('\n');

  const css = [
    fontFaceCss(opts.fontUrls),
    '*{box-sizing:border-box;}',
    `html,body{margin:0;padding:0;background:#fff;color:#000;` +
      `font-family:"Courier Prime","Courier Final Draft","Courier New",monospace;font-size:12pt;line-height:1;}`,
    `.pg{position:relative;width:${+tw.toFixed(4)}in;min-height:${+ph.toFixed(4)}in;` +
      `page-break-after:always;break-after:page;overflow:hidden;}`,
    '.pg:last-child{page-break-after:auto;break-after:auto;}',
    '.pg-body{position:relative;z-index:1;}',
    '.pg-num{text-align:right;margin-bottom:1em;}',
    '.sp{white-space:pre-wrap;word-break:break-word;margin:0;}',
    '.sp-cont-top{text-align:left;}',
    '.sp-cont-bottom{text-align:right;}',
    '.sp-more{margin-left:2.2in;}',
    spCss(f),
    // ลายน้ำอยู่ใต้ข้อความ (z-index 0) — อ่านบทได้ปกติแต่ถ่ายเอกสารแล้วยังติดไปด้วย
    `.wm{position:absolute;inset:0;z-index:0;display:flex;align-items:center;justify-content:center;` +
      `font-size:${wm.fontSize}px;color:${wm.color};transform:rotate(${wm.angle}deg);` +
      `white-space:nowrap;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;}`,
  ].join('\n');

  return '<!doctype html>\n<html lang="th"><head><meta charset="utf-8">\n' +
    `<title>${esc(opts.title || '')}</title>\n<style>\n${css}\n</style>\n</head>\n<body>\n` +
    body + '\n</body></html>\n';
}

/**
 * สร้าง PDF ทีละคน
 *
 * มีสองเส้นทาง — เลือกเองด้วย `buildPdf`:
 *   (ก) **ตัวสร้างในโปรแกรม** (แนะนำ) — ส่ง `buildPdf(watermarkText) → Uint8Array` เข้ามา
 *       ได้สารบัญ/เปิดที่หน้าเดิม/ฟอนต์ไทยสองวงศ์ครบเหมือนส่งออก PDF ปกติ (กฎ 19)
 *   (ข) Chromium printToPDF — ทางเดิม ใช้เมื่อไม่มี `buildPdf` (เช่นในเทสที่ไม่มีไฟล์ฟอนต์)
 *
 * @param {object} api  { join, pdfFromHtml, writeBytes }  (kapi)
 * @param {object} args { pages, fmt, recipients, outDir, prefix, wmTemplate, wmOptions,
 *                        fontUrls, title, date, onProgress, buildPdf }
 * @returns {Promise<string[]>} รายการไฟล์ที่สร้าง
 */
export async function generateWatermarkedPDFs(api, args = {}) {
  const { pages, fmt, recipients = [], outDir, prefix = 'script',
          wmTemplate = T`{ชื่อ}`, wmOptions, fontUrls, title, date, onProgress, buildPdf } = args;
  const made = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const text = watermarkText(r.watermark || wmTemplate, { name: r.name, title, date });
    const file = `${safeFileName(prefix)}_${safeFileName(r.name)}.pdf`;
    const dest = await api.join(outDir, file);
    if (typeof buildPdf === 'function') {
      const bytes = await buildPdf(text, { ...wmOptions });
      await api.writeBytes(dest, Array.from(bytes));            // กฎ 10/23 — ไบนารีห้ามผ่าน writeFile
    } else {
      const html = buildWatermarkHtml(pages, fmt, { watermark: text, wmOptions, fontUrls, title });
      await api.pdfFromHtml(html, dest, {
        width: num(fmt && fmt.paper && fmt.paper.width, 8.5),
        height: num(fmt && fmt.paper && fmt.paper.height, 11),
        margins: (fmt && fmt.margins) || null,
      });
    }
    made.push(dest);
    if (onProgress) onProgress(i + 1, recipients.length, r.name);
  }
  return made;
}
