// prose-export-view.js — [alpha.133 · Y-6] ช่องตัวอย่างส่งออก = **ไฟล์จริง** ไม่ใช่ของเลียนแบบ
//
// ═══ ทำไมต้องรื้อ ═══
// ผู้ใช้: *"การตัดหน้า … รูปที่ 1 (preview) ผิด"* — ทั้งที่มุมมองจัดหน้ากับไฟล์ที่ส่งออกตรงกัน
//
// ต้นตอ: ช่องตัวอย่างของกล่องส่งออกเดินคนละเส้นทางกับอีกสองที่ **ตั้งแต่ต้นทาง**
//   · มุมมองจัดหน้า → ให้ Chromium วาดจริง แล้ว "อ่านกล่องบรรทัดกลับ" (prose-measure.js)
//   · ไฟล์ PDF     → `mdToHtmlBody()` + `proseExportCss()` แล้วให้ Chromium จัดหน้าให้
//   · ช่องตัวอย่าง  → `mdToProseBlocks()` + `paginateProse()` = **เดา** จำนวนบรรทัดจาก
//                     "จำนวนตัวอักษร ÷ 0.5em" ซึ่งไม่เคยมองว่าจริง ๆ วาดออกมาสูงเท่าไร
//                     (และพังหนักเป็นพิเศษกับภาษาไทย — สระ/วรรณยุกต์ไม่กินความกว้าง)
// สองทางแรกจึงตรงกันเสมอ ส่วนทางที่สามไม่มีวันตรงกับใครเลย ไม่ว่าจะไปไล่แก้ตัวเลขกี่รอบ
//
// ═══ ที่นี่แก้ยังไง ═══
// เลิกเดา — เอา **HTML ก้อนเดียวกับที่จะกลายเป็น PDF** มาวางในเอกสารจริง (ขอบเขต CSS
// ถูกจำกัดด้วยคลาสห่อ ไม่รั่วไปทับหน้าจอโปรแกรม) วัดด้วย `measureProseBlocks()` ตัวเดียว
// กับมุมมองจัดหน้า หั่นหน้าด้วย `sliceProsePages()` ตัวเดียวกัน แล้วครอบทีละหน้าด้วย
// `renderProseClipPages()` ตัวเดียวกัน
// → ตัวอย่างกับไฟล์ **ตรงกันโดยโครงสร้าง** ไม่ใช่เพราะบังเอิญปรับเลขให้ใกล้กัน
//
// `scopeCss()` เป็นฟังก์ชันบริสุทธิ์ → ทดสอบด้วย node ได้ (test/prose-export-view.test.cjs)

import { PAPER_SIZES, MARGIN_DEFAULTS } from './sp-format.js';
import { num } from './num.js';
import { measureProseBlocks, sliceProsePages, withMeasureMode,
         renderProseClipPages, whenImagesReady, DPI } from './prose-measure.js';

/** คลาสห่อของเอกสารตัวอย่าง — ทุกกฎ CSS ที่ส่งออกถูกจำกัดขอบเขตไว้ใต้ตัวนี้ */
export const XPV_CLASS = 'k-xpv-doc';
/**
 * ★ ตัวเลือกห่อเขียนคลาสซ้ำสามรอบ **โดยตั้งใจ** — เพื่อชนะกฎของหน้ากระดาษในโปรแกรม
 *
 * style.css มีกฎอย่าง `.sp-pageview .ed-page h1{margin:1em 0 .4em;line-height:1.3}`
 * (ค่าเฉพาะกิจ = 0,2,1) ซึ่งมีไว้ให้ตัววาดหน้าแบบเดิม · ถ้าเราห่อด้วยคลาสเดียว (0,1,1)
 * กฎพวกนั้นชนะ แล้วระยะเว้นหัวข้อในช่องตัวอย่างจะไม่ใช่ค่าที่ไฟล์จริงใช้ = ตัดหน้าคนละที่อีก
 * ซ้ำสามรอบได้ 0,3,1 ซึ่งชนะแน่นอน **และเหมือนกันทั้งตอนวัดนอกจอและตอนวาดในหน้ากระดาษ**
 * (จะพึ่ง "ลำดับใน DOM" ไม่ได้ เพราะตอนวัดเราอยู่คนละที่กับตอนวาด)
 */
export const XPV_SEL = '.k-xpv-doc.k-xpv-doc.k-xpv-doc';

/**
 * จำกัดขอบเขตของ CSS ที่ส่งออก ให้มีผลเฉพาะใต้ตัวเลือกหนึ่ง
 *
 * `proseExportCss()` เขียนกฎระดับเอกสาร (`body{…}` `p{…}` `h1{…}`) เพราะปลายทางของมัน
 * คือ **ไฟล์ HTML ทั้งใบ** · เอามาแปะในหน้าจอโปรแกรมตรง ๆ ไม่ได้ — มันจะไปทับทั้งแอป
 *
 * `@page` กับ `@media print` ถูกทิ้ง (ไม่มีความหมายบนจอ — ขนาดกระดาษมาจากกล่องหน้าแทน)
 * @param {string} css
 * @param {string} sel ตัวเลือกห่อ เช่น `.k-xpv-doc`
 */
export function scopeCss(css, sel) {
  const s = String(css == null ? '' : css);
  const root = String(sel || '').trim() || ':root';
  const out = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i);
    if (open < 0) break;
    const head = s.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < s.length && depth) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') depth--;
      j++;
    }
    const body = s.slice(open + 1, j - 1);
    i = j;
    if (!head) continue;
    if (head.startsWith('@')) {
      // ขนาดกระดาษ/กฎตอนพิมพ์ ไม่มีความหมายบนจอ — กล่องหน้ากระดาษเป็นคนกำหนดแทน
      if (/^@(page|media)\b/i.test(head)) continue;
      out.push(head + '{' + body + '}');
      continue;
    }
    const sels = head.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      if (x === 'body') return root;
      if (x.startsWith('body')) return root + x.slice(4);   // `body > p:first-of-type` · `body *`
      return root + ' ' + x;
    });
    if (sels.length) out.push(sels.join(',') + '{' + body + '}');
  }
  return out.join('\n');
}

/**
 * วาดช่องตัวอย่าง "หน้ากระดาษจริง" จาก HTML ฉบับส่งออก
 *
 * @param {HTMLElement} host       ที่วาง (ถูกล้างก่อนเสมอ)
 * @param {string} bodyHtml        ผลของ `mdToHtmlBody()` — ก้อนเดียวกับที่จะกลายเป็น PDF
 * @param {string} css             ผลของ `proseExportCss()` — ชุดเดียวกับที่จะฝังในไฟล์
 * @param {object} opts            {paper, margins, scale, gap, label, numTop, numRight}
 * @returns {{box:HTMLElement, pageCount:number, ready:(Promise<number>|null)}}
 *          `ready` = จำนวนหน้าหลังรูปโหลดครบ (null = ไม่มีรูปค้างตั้งแต่แรก)
 */
export function renderExportPagePreview(host, bodyHtml, css, opts = {}) {
  const paper = opts.paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(opts.margins || {}) };
  const textW = Math.max(0.5, num(paper.width, 8.5) - num(m.left, 1.5) - num(m.right, 1));
  const contentH = Math.max(8, (num(paper.height, 11) - num(m.top, 1) - num(m.bottom, 1)) * DPI);

  // ★ **ห้ามล้าง host** — ผู้เรียกวางป้ายเตือน/ป้าย "ตามไฟล์ต้นทาง" ไว้ก่อนหน้าเราแล้ว
  // (เคยล้างทิ้งตรงนี้ แล้วป้ายพวกนั้นหายไปทั้งชุดโดยไม่มีใครเห็น — e2e [132r-3] จับได้)
  const style = document.createElement('style');
  style.textContent = scopeCss(css, XPV_SEL);
  host.append(style);                          // อยู่คู่กับ host → ตายพร้อมกล่องส่งออก
  const box = document.createElement('div');
  box.className = 'sp-pageview xhub-pv';
  host.append(box);

  // ── เอกสารต้นแบบ: วางนอกจอ กว้างเท่าพื้นที่พิมพ์จริงเป๊ะ ──
  // สไตล์ inline ชนะกฎ `body{max-width:…;margin:3em auto;padding:0 1.2em}` ที่ถูก scope มา
  // (กฎพวกนั้นมีไว้ให้ไฟล์ .html ที่เปิดในเบราว์เซอร์ดูดี ไม่ใช่ตอนวัดเพื่อจัดหน้า)
  const meas = document.createElement('div');
  meas.className = XPV_CLASS;
  meas.style.cssText = 'position:fixed;left:-30000px;top:0;visibility:hidden;'
                     + 'width:' + textW + 'in;max-width:none;margin:0;padding:0;';
  meas.innerHTML = bodyHtml;
  document.body.append(meas);

  /**
   * วัด → หั่น → วาด หนึ่งรอบเต็ม (เรียกซ้ำได้)
   *
   * ★ `renderProseClipPages()` **ล้างกล่องทิ้งก่อนเสมอ** — และผู้เรียกเอา "หน้าหน้าเล่ม"
   * (ปก/หน้ารายชื่อ) มาแทรกไว้ข้างหน้าทีหลัง · การวาดรอบสอง (หลังรูปโหลดครบ) จึงกลืนมันหายไป
   * ทั้งชุด (เทส `[81r2] ตัวอย่างโชว์หน้าปกให้เห็น` จับได้ = บทเรียนข้อ 48 ซ้ำรอย)
   * → ตีตราแผ่นที่ **เราเป็นคนสร้าง** ไว้ แล้วคืนของคนอื่นกลับที่เดิมทุกครั้ง
   */
  const paint = () => {
    let blocks = [];
    let pages = withMeasureMode(() => {
      const origin = meas.getBoundingClientRect().top;
      const mm = measureProseBlocks(meas, origin, 1);
      blocks = mm.blocks;
      if (!blocks.length) return [];
      return sliceProsePages(blocks, contentH, mm.totalHeight).map((p, i) => ({ ...p, index: i + 1 }));
    });
    if (!pages.length) pages = [{ start: 0, end: contentH, index: 1 }];
    const keep = [...box.children].filter((n) => !n.dataset || n.dataset.xpv !== '1');
    renderProseClipPages(box, meas, pages, {
      scale: num(opts.scale, 1) || 1, gap: num(opts.gap, 14), paper, margins: m,
      numTop: opts.numTop, numRight: opts.numRight, label: opts.label,
      // [alpha.143 ข้อ 2] แผ่นของ "รูปเต็มหน้า" ถูกทาภาพชนขอบกระดาษเหมือนมุมมองจัดหน้า
      blocks,
    });
    for (const n of box.children) n.dataset.xpv = '1';
    if (keep.length) box.prepend(...keep);      // หน้าหน้าเล่มอยู่ข้างหน้าเสมอ (ผู้เรียกแทรกไว้แบบนั้น)
    return pages;
  };

  // ══ [alpha.143 ข้อ 1] ★ รูปที่ยังโหลดไม่เสร็จสูง 0 — วัดตอนนั้น = ทั้งไฟล์เหลื่อม ══
  // วาดรอบแรกทันที (ผู้ใช้เห็นหน้าเลย ไม่ต้องรอ) แล้ววาดซ้ำอีกรอบเมื่อรูปมาครบ
  // `ready` มีไว้ให้เทส/ผู้เรียกที่อยากรอผลสุดท้ายจริง ๆ · null = ไม่มีรูปค้าง
  let pages = [];
  try { pages = paint(); } catch (e) { meas.remove(); throw e; }
  const wait = whenImagesReady(meas);
  if (!wait) { meas.remove(); return { box, pageCount: pages.length, ready: null }; }
  const ready = wait.then(() => {
    let n = pages.length;
    // กล่องอาจถูกทิ้งไปแล้ว (ผู้ใช้เปลี่ยนตัวเลือกส่งออกระหว่างรอรูป) → ไม่ต้องวาดทับของใหม่
    try { if (box.isConnected) n = paint().length; } catch {}
    meas.remove();
    return n;
  });
  return { box, pageCount: pages.length, ready };
}
