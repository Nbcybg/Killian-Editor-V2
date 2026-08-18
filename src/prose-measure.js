// prose-measure.js — จัดหน้านิยายจาก "การวัดของจริงบนจอ" (alpha.82)
//
// ปัญหาเดิม: paginateProse() ใน prose-format.js เดาจำนวนบรรทัดจาก "จำนวนตัวอักษร ÷ 0.5em"
// ซึ่งไม่เคยมองว่าจริง ๆ แล้ว Chromium วาดออกมาสูงเท่าไหร่ พังหนักเป็นพิเศษกับภาษาไทย
// เพราะสระบน/ล่าง+วรรณยุกต์ไม่กินความกว้างเลย แต่ถูกนับเป็นตัวอักษรเต็มตัว (13–29% ของข้อความ)
// ผลคือหน้าถูกตัดเร็วเกินจริง เหลือช่องว่างท้ายหน้าเป็นสิบบรรทัด
//
// ไฟล์นี้ทำสิ่งที่โปรแกรมจัดหน้าจริงทำ: ให้เบราว์เซอร์วาดให้เสร็จก่อน แล้วค่อย "อ่านกล่องบรรทัด
// กลับออกมา" (Chromium ตัดคำไทยด้วย ICU ให้ฟรีอยู่แล้ว) จากนั้นสะสมความสูงจริงจนเต็มหน้า
//
// แนวคิดมาจากสองโปรแกรมที่ทำเรื่องนี้มาก่อน — อ่านโค้ดเขาเพื่อเข้าใจวิธีคิด ไม่ได้คัดลอกโค้ด:
//   · GenOffice (Apache-2.0) — apps/docs/src/renderer/pagination.ts
//     สแตกเดียวกับเราเป๊ะ (Electron + ProseMirror + เอกสารไหลต่อเนื่องแล้วคำนวณหน้าทีหลัง)
//     ท่าสำคัญที่ยืมความคิดมา: ลบความสูงของ "ช่องว่างคั่นหน้า" ออกตอนวัด → ได้พิกัดแบบ
//     ไม่มีช่องว่าง การคำนวณจึงไม่วนกลับมากวนตัวเอง · และการหั่นหน้าต้องเป็นฟังก์ชันบริสุทธิ์
//   · AbiWord/OpenWordWriter (GPL-2.0) — fb_ColumnBreaker::_breakSection()
//     กฎที่ตกผลึกมา 25 ปี: หน่วยของการตัดหน้าคือ "บรรทัด" ไม่ใช่ย่อหน้า ·
//     ระยะเว้นท้ายย่อหน้าไม่กินความจุของหน้า · บรรทัดแรกของหน้าที่ยังไม่พอดี = ยอมให้ล้น
//   · Univer (Apache-2.0) — layout/block/paragraph/layout-ruler.ts
//     คนละสถาปัตยกรรม (วาดเองบน canvas) แต่กฎเดียวกันเป๊ะ:
//     `lineHeight + newLineTop - section.height > TOLERANCE` → ยกบรรทัดไปหน้าใหม่
//
// ส่วนบริสุทธิ์ (sliceProsePages/lineCut/…) ทดสอบด้วย node ได้ → test/prose-measure.test.cjs
// ส่วนที่แตะ DOM (measureProseLayout/domLineRects/…) ทดสอบใน e2e

import { PAPER_SIZES, MARGIN_DEFAULTS } from './sp-format.js';
import { num } from './num.js';

/** CSS กำหนดว่า 1in = 96px เสมอ — ความกว้างกระดาษเราตั้งเป็นหน่วย `in` จึงคิดที่ 96 dpi ตรง ๆ */
export const DPI = 96;

/** คลาสของ "ช่องว่างคั่นหน้า" ที่ต้องหักออกตอนวัด (ในมุมมองจัดหน้ามันสูงจริง 28px) */
export const GAP_CLASS = 'ed-page-break';

/** ย่อหน้าเก็บบรรทัดไว้ข้างละกี่บรรทัดเป็นอย่างน้อย (กันบรรทัดโดดเดี่ยวหัว/ท้ายหน้า) */
export const WIDOW_LINES = 2;

// ═══════════════════ ส่วนบริสุทธิ์ — หั่นหน้าจากกล่องที่วัดมาแล้ว ═══════════════════

/**
 * จุดตัดระดับ "บรรทัด" ของบล็อกที่คร่อมขอบหน้า
 * คืนพิกัด Y ของบรรทัดแรกที่ต้องยกไปหน้าใหม่ · null = ตัดในบล็อกนี้ไม่ได้
 *
 * lineOffsets = ระยะจากขอบบนบล็อกถึง "จุดเริ่มของแต่ละบรรทัด ตั้งแต่บรรทัดที่ 2 เป็นต้นไป"
 * (บรรทัดแรกไม่นับ เพราะตัดตรงนั้น = ยกทั้งบล็อก ซึ่งเป็นคนละเส้นทาง)
 *
 * @param {{top:number,lineOffsets?:number[],splitMinLines?:number}} block
 * @param {number} pageStart  พิกัด Y ของขอบบนหน้าปัจจุบัน
 * @param {number} limit      พิกัด Y ของขอบล่างพื้นที่พิมพ์ของหน้าปัจจุบัน
 */
export function lineCut(block, pageStart, limit) {
  const offs = (block && block.lineOffsets) || null;
  if (!offs || !offs.length) return null;
  const minLines = Math.max(1, Math.round(num(block.splitMinLines, 1)));
  // บล็อกเริ่มบนหน้านี้ → ต้องเหลือหัวไว้อย่างน้อย minLines บรรทัด
  // บล็อกไหลมาจากหน้าก่อน → หัวเต็มอยู่แล้ว ตัดตั้งแต่บรรทัดแรกที่ล้นได้เลย
  const headMin = block.top >= pageStart ? minLines - 1 : 0;
  const tailMax = offs.length - minLines;      // ตัดแล้วท้ายต้องเหลือ ≥ minLines บรรทัด
  let cut = null;
  for (let k = headMin; k <= tailMax; k++) {
    const y = block.top + offs[k];
    if (y > limit) break;                      // เลยขอบล่างแล้ว จุดก่อนหน้านี้คือคำตอบ
    if (y > pageStart) cut = y;
  }
  return cut;
}

/**
 * หั่นเอกสารเป็นหน้า — ลูปแกนกลางทั้งระบบ (บริสุทธิ์ 100%)
 *
 * @param {Array<object>} blocks  กล่องที่วัดแล้ว {top,height,lineOffsets?,spaceAfterPx?,keepNext?}
 * @param {number} contentHeight  ความสูงพื้นที่พิมพ์ต่อหน้า (px ที่ซูม 100%)
 * @param {number} [totalHeight]  ความสูงรวมของเนื้อหา (ใช้ปิดท้ายหน้าสุดท้าย)
 * @returns {Array<{start:number,end:number}>} ช่วง Y ของแต่ละหน้า
 */
export function sliceProsePages(blocks, contentHeight, totalHeight) {
  // [alpha.85 ข้อ 2] `lineOffsets` เป็นแบบขี้เกียจแล้ว — การอ่านมันคือการอ่าน DOM จริง
  // จึงต้องอยู่ในโหมดยุบเส้นคั่นเสมอ ตาข่ายนี้กันไม่ให้ผู้เรียกที่ลืมครอบทำผลเพี้ยนเงียบ ๆ
  // (ซ้อนกันได้ · ไม่มี document เช่นตอน unit test = ไม่ทำอะไรเลย)
  return withMeasureMode(() => sliceProsePagesRaw(blocks, contentHeight, totalHeight));
}
function sliceProsePagesRaw(blocks, contentHeight, totalHeight) {
  const list = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  const ch = Math.max(1, num(contentHeight, 0));
  const starts = [0];
  let pageStart = 0;
  const newPage = (y) => { pageStart = y; starts.push(y); };

  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.breakBefore && b.top > pageStart) newPage(b.top);
    // [AbiWord ข้อ 4] ระยะเว้นท้ายย่อหน้าไม่กินความจุของหน้า — วัดจากหมึกบรรทัดสุดท้าย
    const inkBottom = b.top + b.height - Math.max(0, num(b.spaceAfterPx, 0));
    let guard = 0;
    while (inkBottom > pageStart + ch && guard++ < 5000) {
      const cut = lineCut(b, pageStart, pageStart + ch);
      if (cut !== null) { newPage(cut); continue; }
      if (b.top > pageStart) {
        // ยกทั้งบล็อกไปหน้าใหม่ — [AbiWord keepNext] ถ้าบล็อกก่อนหน้าเป็นหัวข้อที่ห้าม
        // ค้างท้ายหน้าเดี่ยว ๆ ให้ลากมันตามไปด้วย ไม่ปล่อยให้ "บทที่ 3" อยู่บรรทัดสุดท้าย
        const prev = i > 0 ? list[i - 1] : null;
        newPage(prev && prev.keepNext && prev.top > pageStart ? prev.top : b.top);
        continue;
      }
      // บล็อกเดียวสูงเกินหนึ่งหน้าและตัดตามบรรทัดไม่ได้ (รูป/เส้นคั่น) → ยอมตัดดิบ
      newPage(pageStart + ch);
    }
  }

  const last = list.length ? list[list.length - 1] : null;
  const end = Math.max(num(totalHeight, last ? last.top + last.height : 0), pageStart);
  return starts.map((y, i) => ({ start: y, end: i + 1 < starts.length ? starts[i + 1] : end }));
}

/** จำนวนหน้าอย่างเดียว */
export function proseMeasuredCount(blocks, contentHeight, totalHeight) {
  return sliceProsePages(blocks, contentHeight, totalHeight).length;
}

/**
 * ทิ้งจุดแรกเสมอ — กล่องกลิฟของบรรทัดแรกอยู่ต่ำกว่าขอบบนบล็อกไม่กี่พิกเซล
 * ถ้านับเป็นจุดตัดจะได้ "บรรทัดผี" แล้วเส้นคั่นหน้าไปตัดทะลุกลางตัวอักษร
 */
export function lineBreakOffsets(lines) {
  return (lines || []).slice(1).map((l) => l.offset).filter((o) => o > 0.5);
}

// ═══════════════════ ส่วนที่แตะ DOM ═══════════════════

/** อัตราซูมที่กระทำกับ element นี้จริง (CSS `zoom` ของ .workspace) — 1 = ไม่ซูม */
export function zoomFactorOf(el) {
  if (!el) return 1;
  const w = el.offsetWidth;
  if (!(w > 0)) return 1;
  const z = el.getBoundingClientRect().width / w;
  return z > 0.01 && z < 100 ? z : 1;
}

/** ความสูงรวมของช่องว่างคั่นหน้าที่อยู่ "ข้างใน" บล็อก (เกิดจากการตัดกลางย่อหน้า) */
function innerGapHeight(el) {
  let sum = 0;
  for (const g of el.querySelectorAll('.' + GAP_CLASS)) sum += g.getBoundingClientRect().height;
  return sum;
}

/**
 * อ่าน "กล่องบรรทัดจริง" ของบล็อกหนึ่งออกมา
 *
 * เทคนิค: `range.selectNodeContents(textNode).getClientRects()` คืนสี่เหลี่ยมหนึ่งอันต่อ
 * หนึ่งบรรทัดที่ text node นั้นกินอยู่ → เรียงตาม top แล้วจัดกลุ่มเป็นบรรทัด
 * (เร็วกว่าไล่ทีละตัวอักษรมาก · ทีละตัวอักษรค่อยใช้ตอนหา "ตัวแรกของบรรทัด" เท่านั้น)
 *
 * @returns {Array<{offset:number, top:number, node:Text}>} offset = ระยะจากขอบบนบล็อก (px ที่ 100%)
 */
export function domLineRects(el, zoomFactor) {
  const z = zoomFactor > 0 ? zoomFactor : 1;
  const gaps = [];
  for (const g of el.querySelectorAll('.' + GAP_CLASS)) gaps.push(g.getBoundingClientRect());
  const gapAbove = (top) => gaps.reduce((s, g) => (g.top <= top ? s + g.height : s), 0);

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const rects = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (p && p.closest('.' + GAP_CLASS)) continue;      // ข้อความในเส้นคั่นหน้าไม่ใช่เนื้อเรื่อง
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.height > 0 && r.width > 0) rects.push({ r, node: n });
    }
  }
  rects.sort((a, b) => a.r.top - b.r.top);

  const top0 = el.getBoundingClientRect().top;
  const lines = [];
  // [alpha.82] จัดกลุ่มด้วย **ขอบบน** ไม่ใช่ขอบล่าง
  //
  // ของเดิมใช้ `r.top >= lineBottom - 1` ซึ่งเปราะมาก เพราะ "ขอบล่าง" ขึ้นกับความสูงของกล่อง
  // ซึ่งเปลี่ยนได้เมื่อมี widget (เส้นคั่นหน้า) แทรกอยู่ในบรรทัดนั้น — กล่องสูงขึ้นนิดเดียว
  // บรรทัดถัดไปก็ถูกนับรวมเป็นบรรทัดเดียวกัน (หรือแยกเกิน) ผิดไป 1 บรรทัด
  // อาการที่วัดได้: จัดหน้าซ้ำแล้วจำนวนหน้าสลับไปมา 19 ↔ 20 ไม่รู้จบ
  //
  // ขอบบนของ rect ที่อยู่บรรทัดเดียวกันเท่ากันเสมอ (ต่างกันระดับ sub-pixel)
  // ส่วนคนละบรรทัดห่างกันเท่าระยะบรรทัด — เกณฑ์นี้จึงไม่สนใจว่ากล่องสูงเท่าไร
  let lastTop = -Infinity, lastH = 0;
  for (const { r, node } of rects) {
    const tol = Math.max(2, Math.min(lastH * 0.5, 12));
    if (r.top > lastTop + tol) {
      lines.push({ offset: (r.top - top0 - gapAbove(r.top)) / z, top: r.top, node });
      lastTop = r.top; lastH = r.height;
    } else {
      lastH = Math.max(lastH, r.height);                // ชิ้นส่วนอื่นของบรรทัดเดียวกัน
    }
  }
  return lines;
}

/**
 * ตัวอักษรลำดับที่เท่าไรใน text node ที่เป็น "ตัวแรกของบรรทัดซึ่ง top = lineTop"
 * ใช้ binary search บน rect รายตัวอักษร (เป็นข้อมูล layout ไม่ใช่การทดสอบว่าจุดไหนอยู่บนจอ
 * จึงใช้ได้กับบรรทัดที่เลื่อนพ้นจอไปแล้ว ต่างจาก posAtCoords/caretRangeFromPoint)
 */
export function lineStartCharOffset(node, lineTop) {
  const len = node && node.length ? node.length : 0;
  if (!len) return 0;
  const range = document.createRange();
  const topAt = (i) => {
    range.setStart(node, i); range.setEnd(node, i + 1);
    for (const r of range.getClientRects()) if (r.height > 0) return r.top;
    return -Infinity;   // ตัวที่ยุบหายตอนขึ้นบรรทัด (ช่องว่างจุดตัดคำ) = ถือว่าอยู่บรรทัดก่อน
  };
  let lo = 0, hi = len - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (topAt(mid) >= lineTop - 0.5) { ans = mid; hi = mid - 1; } else lo = mid + 1;
  }
  return ans;
}

/** ชนิดของบล็อกจากชื่อแท็ก — ใช้ตัดสินกฎ widow/keepNext */
function blockRules(el) {
  const tag = (el.tagName || '').toLowerCase();
  if (/^h[1-6]$/.test(tag)) return { splitMinLines: 99, keepNext: true };  // หัวข้อห้ามฉีก + ห้ามค้างท้ายหน้า
  if (tag === 'hr' || tag === 'figure' || tag === 'img') return { splitMinLines: 99 };
  return { splitMinLines: WIDOW_LINES };
}

/**
 * วัดกล่องของบล็อกระดับบนสุดทั้งหมดในตัวแก้ไข
 * พิกัดที่คืน = "พิกัดเสมือนแบบไม่มีช่องว่างคั่นหน้า ที่ซูม 100%" — ช่องว่างคั่นหน้าถูกข้าม
 * และหักออกจากพิกัดของบล็อกถัด ๆ ไป การหั่นหน้าจึงไม่ขึ้นกับว่าตอนนี้วาดเส้นคั่นไว้ตรงไหน
 *
 * @param {HTMLElement} pm      element ของ ProseMirror
 * @param {number} origin       พิกัด Y บนจอของขอบบนพื้นที่พิมพ์หน้าแรก
 * @param {number} zoomFactor
 */
export function measureProseBlocks(pm, origin, zoomFactor) {
  const z = zoomFactor > 0 ? zoomFactor : 1;
  const blocks = [];
  let gapAccum = 0, totalHeight = 0;

  for (const el of Array.from(pm.children)) {
    if (!el || el.nodeType !== 1) continue;
    const rect = el.getBoundingClientRect();
    if (el.classList && el.classList.contains(GAP_CLASS)) { gapAccum += rect.height; continue; }
    if (!(rect.height > 0)) continue;
    const innerGap = innerGapHeight(el);
    const top = (rect.top - origin - gapAccum) / z;
    const height = (rect.height - innerGap) / z;
    const b = { top, height, el, ...blockRules(el) };
    // [alpha.85 ข้อ 2] **วัดบรรทัดแบบขี้เกียจ** — ตัวที่แพงที่สุดของทั้งระบบ
    //
    // `domLineRects()` เดินทุก text node ในบล็อกแล้วเรียก getClientRects() ทีละตัว
    // ของเดิมทำให้ **ทุกบล็อกในเอกสาร ทุกครั้งที่กดปุ่ม** ทั้งที่ `sliceProsePages()`
    // ใช้ค่านี้เฉพาะ "บล็อกที่คร่อมขอบหน้า" ซึ่งมีแค่ประมาณจำนวนหน้า (5 จาก 200)
    // วัดจริงก่อนแก้: 200 ย่อหน้า = 6.5ms ต่อรอบ · 800 ย่อหน้า = 20.8ms → กดค้างแล้วสะดุด
    //
    // ⚠ ผู้เรียกต้องอ่านค่าพวกนี้ **ในโหมด withMeasureMode เท่านั้น** เพราะตอนนี้มันไปอ่าน
    // DOM ทีหลัง ไม่ใช่ตอนวัดแล้ว (ดู proseMeasured / proseBreakList)
    let _lines = null;
    Object.defineProperty(b, 'lines', {
      configurable: true, enumerable: false,
      get() { if (!_lines) _lines = domLineRects(el, z); return _lines; },
      set(v) { _lines = v; },
    });
    let _offs = null;
    Object.defineProperty(b, 'lineOffsets', {
      configurable: true, enumerable: false,
      get() { if (!_offs) _offs = lineBreakOffsets(this.lines); return _offs; },
      set(v) { _offs = v; },
    });
    blocks.push(b);
    gapAccum += innerGap;
    totalHeight = Math.max(totalHeight, top + height);
  }

  // ระยะห่างระหว่างย่อหน้า (margin) ไม่อยู่ใน rect.height แต่กินที่จริงบนหน้า
  // → ยกไปเป็น spaceAfterPx ของบล็อกก่อนหน้าและบวกเข้าความสูง เพื่อให้บัญชีความจุ
  //   ตรงกับพิกัด Y และกฎ "ระยะเว้นท้ายไม่กินความจุ" ทำงานได้
  for (let i = 0; i + 1 < blocks.length; i++) {
    const gap = blocks[i + 1].top - (blocks[i].top + blocks[i].height);
    if (gap > 0.5) { blocks[i].spaceAfterPx = gap; blocks[i].height += gap; }
  }
  // ระยะก่อนบล็อกแรก (margin-top ของย่อหน้าแรก) — Word นับกินความจุหน้าแรกด้วย
  if (blocks.length && blocks[0].top > 0.5) {
    blocks[0].height += blocks[0].top;
    blocks[0].top = 0;
  }
  return { blocks, totalHeight };
}

/**
 * คลาสที่ทำให้ "เส้นคั่นหน้า" ยุบเหลือศูนย์ชั่วคราวระหว่างวัด (นิยามกฎอยู่ใน style.css)
 *
 * ═══ ทำไมต้องมี ═══
 * ตัวจัดหน้าเป็นวงจรป้อนกลับ: **วัด DOM → ได้จุดตัด → แทรกเส้นคั่นลง DOM → วัดอีกรอบ**
 * เส้นคั่นในโหมด "แยกหน้าเป็นแผ่นจริง" กินที่จริง (ขอบล่าง+แถบ+ขอบบน ≈ 220px ต่ออัน)
 * เดิมแก้ด้วยการ "หักความสูงเส้นคั่นออกตอนคำนวณ" ซึ่งหักได้ถูกในระดับความสูงรวมจริง
 * (วัดแล้ว totalHeight เท่ากันเป๊ะทั้งเปิด/ปิดช่องว่าง) แต่ **ไม่ถูกในระดับตำแหน่งบรรทัด** —
 * เส้นคั่นแบบตัดกลางย่อหน้าเป็น inline-block กว้างเต็มแผ่น มันจึง **เปลี่ยนการตัดบรรทัด
 * ของย่อหน้าที่มันไปแทรกอยู่** ซึ่งหักออกทีหลังไม่ได้เลย
 * ผลคือรันจัดหน้าซ้ำโดยไม่เปลี่ยนอะไร ได้คนละคำตอบ (วัดได้จริง: 20 หน้า → 6 หน้า)
 *
 * ทางแก้ที่ถูกคือทำให้ **ผลของการวัดไม่ขึ้นกับผลของการวัดรอบก่อน** — ยุบเส้นคั่นให้เหลือ
 * ศูนย์ก่อนวัดเสมอ แล้วค่อยคืนสภาพ · เพิ่ม/ถอดคลาสในจังหวะเดียวกัน เบราว์เซอร์ไม่ได้วาด
 * ระหว่างนั้น จึงไม่มีการกะพริบ
 */
export const MEASURE_CLASS = 'k-measuring';

/**
 * ทำงาน `fn` ในสภาพ "เส้นคั่นหน้าถูกยุบเหลือศูนย์"
 *
 * **ทุกการอ่านเรขาคณิตที่ป้อนตัวจัดหน้าต้องผ่านตัวนี้** — ไม่ใช่แค่ตอนวัด แต่รวมถึงตอน
 * แปลงพิกัด Y กลับเป็นตำแหน่งในเอกสารด้วย (`proseBreakList`) เพราะตัวแปลงค้นจาก
 * **พิกัดจริงบนจอ** ที่จำไว้ตอนวัด ถ้าตอนแปลงมีเส้นคั่นกางอยู่ ตัวอักษรจะไม่อยู่ที่เดิมแล้ว
 * → หาไม่เจอ → เส้นคั่นหายทีละจุด (วัดได้จริง: 20 จุด เหลือ 5)
 * ซ้อนกันได้ปลอดภัย — ชั้นในเห็นว่ามีคลาสอยู่แล้วจึงไม่ถอดทิ้ง
 */
export function withMeasureMode(fn) {
  const root = typeof document !== 'undefined' ? document.body : null;
  const added = !!(root && !root.classList.contains(MEASURE_CLASS));
  if (added) root.classList.add(MEASURE_CLASS);
  try { return fn(); } finally { if (added) root.classList.remove(MEASURE_CLASS); }
}

/**
 * วัดทั้งหน้าเอกสารของแท็บนิยายหนึ่งแท็บ
 * @returns {null|{blocks:Array,totalHeight:number,contentHeight:number,zoomFactor:number,origin:number,pageHeight:number}}
 *          null = วัดไม่ได้ (ยังไม่ได้ต่อ DOM / ซ่อนอยู่) → ผู้เรียกตกไปใช้ตัวประมาณ
 */
export function measureProseLayout(view, opts = {}) {
  const pm = view && view.dom;
  if (!pm || !pm.isConnected || typeof pm.getBoundingClientRect !== 'function') return null;

  const paper = opts.paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(opts.margins || {}) };
  const contentHeight = (num(paper.height, 11) - num(m.top, 1) - num(m.bottom, 1)) * DPI;
  if (!(contentHeight > 8)) return null;

  // ยุบเส้นคั่นหน้าทั้งหมดก่อนวัด — ต้องครอบ **ทุกการอ่าน DOM** ของรอบนี้
  return withMeasureMode(() => {
    const rect = pm.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    const z = zoomFactorOf(pm);
    const padTop = parseFloat(getComputedStyle(pm).paddingTop) || 0;
    const origin = rect.top + padTop * z;
    const { blocks, totalHeight } = measureProseBlocks(pm, origin, z);
    if (!blocks.length) return null;
    return { blocks, totalHeight, contentHeight, zoomFactor: z, origin,
             pageHeight: num(paper.height, 11) * DPI };
  });
}

/**
 * แปลงพิกัด Y ที่หั่นได้ กลับเป็น "ตำแหน่งในเอกสาร" ของ ProseMirror
 * @returns {number|null}
 */
/** ตัวนับเหตุผลที่แปลงพิกัดกลับไม่สำเร็จ — ไล่บั๊ก "เส้นคั่นหายทีละจุด" */
export const CUT_FAIL = { detached: 0, noLine: 0, noBlock: 0, threw: 0, ok: 0 };
export function resetCutFail() {
  CUT_FAIL.detached = 0; CUT_FAIL.noLine = 0; CUT_FAIL.noBlock = 0;
  CUT_FAIL.threw = 0; CUT_FAIL.ok = 0;
}

export function prosePosAtCut(view, blocks, y) {
  if (!view || !Number.isFinite(y)) return null;
  const list = blocks || [];
  // 1) ตรงหัวบล็อกพอดี = ยกทั้งบล็อกไปหน้าใหม่ → เส้นคั่นอยู่ "ก่อนบล็อก"
  //    ต้องตรวจกรณีนี้ให้ครบทั้งชุดก่อน เพราะระยะเว้นท้ายย่อหน้าทำให้ช่วงของบล็อกก่อนหน้า
  //    ยืดมาคาบเกี่ยวหัวบล็อกถัดไป ถ้าไล่เรียงลำดับเฉย ๆ บล็อกก่อนหน้าจะคว้าไปแล้วหาไม่เจอ
  for (const b of list) {
    if (Math.abs(y - b.top) >= 0.6) continue;
    try { return Math.max(0, view.posAtDOM(b.el, 0) - 1); } catch { return null; }
  }
  // 2) จุดตัดกลางบล็อก → หาบรรทัดที่ตรงกับพิกัดนั้น
  for (const b of list) {
    if (y <= b.top || y > b.top + b.height + 0.6) continue;
    const want = y - b.top;
    for (const ln of b.lines || []) {
      if (Math.abs(ln.offset - want) > 0.6) continue;
      // [alpha.82] โหนดที่จำไว้อาจ "ตายแล้ว" — ProseMirror วาดย่อหน้าใหม่ทุกครั้งที่
      // decoration เปลี่ยน (เส้นคั่นหน้าเป็น widget decoration) text node เดิมจึงหลุดจาก
      // เอกสาร แล้ว posAtDOM() โยน error → จุดตัดถูกทิ้งเงียบ ๆ
      if (!ln.node || !ln.node.isConnected) { CUT_FAIL.detached++; return null; }
      try {
        // [alpha.82] **คำนวณพิกัดจอใหม่ตอนใช้ ห้ามใช้ `ln.top` ที่จำไว้ตอนวัด**
        //
        // `lineStartCharOffset()` เทียบกับพิกัดจอสัมบูรณ์ (คลาดเกิน 0.5px ก็หาไม่เจอ)
        // แต่ผลการวัดถูกแคชไว้ข้ามหลายรอบ — ระหว่างนั้นเนื้อหาเลื่อนได้ทั้งจากการแทรกเส้นคั่น
        // และจากการเลื่อนจอ → ค่าที่จำไว้ชี้ไปคนละที่ แล้วจุดตัดถูกทิ้งเงียบ ๆ
        // (วัดได้จริง: ผลการวัดก้อนเดียวกันเป๊ะ แปลงสำเร็จ 20/20 แล้วรอบถัดมาเหลือ 5/20)
        //
        // `offset` (ระยะจากขอบบนบล็อก) เป็นค่าเสถียร จึงยึดอันนั้นแล้วบวกกับตำแหน่งบล็อก
        // "ตอนนี้" — ผู้เรียกอยู่ในโหมดยุบเส้นคั่นอยู่แล้ว ช่องว่างจึงไม่มีผลกับผลลัพธ์
        const zNow = zoomFactorOf(view.dom);
        const topNow = b.el.getBoundingClientRect().top + ln.offset * zNow;
        const p = view.posAtDOM(ln.node, lineStartCharOffset(ln.node, topNow));
        CUT_FAIL.ok++;
        return p;
      } catch { CUT_FAIL.threw++; return null; }
    }
    CUT_FAIL.noLine++;
    return null;
  }
  CUT_FAIL.noBlock++;
  return null;
}

/**
 * รายการเส้นคั่นหน้าพร้อมใช้ [{pos, page}] จากผลการวัด
 * @param {number} basePage เลขหน้าเริ่มต้นของไฟล์ (1 = ปกติ)
 */
export function proseBreakList(view, blocks, pages, basePage = 1) {
  // ต้องอยู่ในโหมด "ยุบเส้นคั่น" เหมือนตอนวัด ไม่งั้นพิกัดที่จำไว้ชี้ไปคนละที่กับของจริง
  return withMeasureMode(() => {
    const out = [];
    const list = pages || [];
    for (let i = 1; i < list.length; i++) {
      const pos = prosePosAtCut(view, blocks, list[i].start);
      if (Number.isFinite(pos) && pos > 0) out.push({ pos, page: basePage + i });
    }
    return out;
  });
}

// ═══════════════════ มุมมองหน้ากระดาษ (เรียงหน้าคู่ / ภาพรวม) ═══════════════════

/**
 * [alpha.82] วาดหน้ากระดาษจาก "สำเนาเนื้อหาจริง แล้วครอบตามช่วง Y ของหน้า"
 *
 * ของเดิม renderProsePageView() สร้างย่อหน้าขึ้นมาใหม่จากผลการเดา — เนื้อหาบนหน้าจึงไม่ตรง
 * กับที่เห็นในตัวแก้ไข และตัดกลางย่อหน้าไม่ได้เลย  วิธีนี้ก๊อป DOM ที่เบราว์เซอร์วาดไว้แล้ว
 * มาเลื่อนขึ้น -start แล้วครอบด้วยกล่องสูงเท่าพื้นที่พิมพ์ → หน้ากระดาษตรงกับตัวแก้ไขเป๊ะเสมอ
 * (ครอบด้วย overflow:hidden = สิ่งเดียวกับที่โปรแกรมพรีวิวหน้าใช้กัน)
 */
export function renderProseClipPages(host, pm, pages, opts = {}) {
  const paper = opts.paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(opts.margins || {}) };
  const scale = num(opts.scale, 1) || 1;
  const pw = num(paper.width, 8.5), ph = num(paper.height, 11);
  const textW = Math.max(0.5, pw - num(m.left, 1.5) - num(m.right, 1));
  const contentH = Math.max(8, (ph - num(m.top, 1) - num(m.bottom, 1)) * DPI);
  const list = (pages && pages.pages) || pages || [];

  host.innerHTML = '';
  host.style.setProperty('--sp-pv-scale', String(scale));
  host.style.setProperty('--sp-pv-gap', num(opts.gap, 20) + 'px');

  // สำเนาต้นแบบหนึ่งชุด — ตัดเส้นคั่นหน้าออก เพราะพิกัดที่วัดมาเป็นแบบ "ไม่มีช่องว่างคั่นหน้า"
  const master = pm.cloneNode(true);
  master.removeAttribute('contenteditable');
  master.removeAttribute('id');
  for (const g of master.querySelectorAll('.' + GAP_CLASS)) g.remove();

  const els = [];
  for (const pg of list) {
    const slot = document.createElement('div');
    slot.className = 'sp-page-slot';
    slot.style.width = (pw * DPI * scale) + 'px';
    slot.style.height = (ph * DPI * scale) + 'px';

    const page = document.createElement('div');
    page.className = 'sp-page ed-page';
    page.dataset.page = String(pg.index ?? (els.length + 1));
    page.style.width = pw + 'in';
    page.style.minHeight = ph + 'in';
    page.style.paddingTop = num(m.top, 1) + 'in';
    page.style.paddingBottom = num(m.bottom, 1) + 'in';
    page.style.paddingLeft = num(m.left, 1.5) + 'in';
    page.style.paddingRight = num(m.right, 1) + 'in';
    page.style.transform = 'scale(' + scale + ')';

    const label = opts.label ? opts.label(els.length + 1) : '';
    if (label) {
      const n = document.createElement('div');
      n.className = 'sp-page-num';
      // [alpha.83 ข้อ 2] **โอเวอร์เลย์เสมอ** — เดิมเป็นกล่องในสายเนื้อหา (`margin-bottom:1em`)
      // เปิดเลขหน้าทีเดียว เนื้อหาทั้งหน้าถูกดันลงราวหนึ่งบรรทัดครึ่ง แล้วบรรทัดล่างสุดถูก
      // `overflow:hidden` ของหน้ากระดาษเฉือนหายไป (บั๊กข้อ 3: "ตัวหนังสือขาดที่ขอบล่าง")
      n.style.top = num(opts.numTop, 0.5) + 'in';
      n.style.right = num(opts.numRight, 1) + 'in';
      n.textContent = label;
      page.append(n);
    }

    const clip = document.createElement('div');
    clip.className = 'ed-page-clip';
    // [alpha.83 ข้อ 3] สูงเท่า "ช่วงที่หั่นไว้จริง" ไม่ใช่ความสูงพื้นที่พิมพ์เต็มเสมอ
    // หน้าที่จบก่อนขอบล่าง (ตัดตามบรรทัด/ยกทั้งย่อหน้า) จะมีที่ว่างเหลือ — ถ้าครอบเต็มความสูง
    // ช่องว่างนั้นจะไปโชว์ **บรรทัดแรกของหน้าถัดไป** ค้างอยู่ท้ายหน้านี้
    const sliceH = num(pg.end, NaN) - num(pg.start, 0);
    clip.style.height = (Number.isFinite(sliceH) && sliceH > 0
      ? Math.min(contentH, sliceH) : contentH) + 'px';
    // ตำแหน่งในเอกสารของหัวหน้า — คลิกหน้าไหนแล้วกระโดดไปตรงนั้นได้ (เหมือนตัววาดเดิม)
    const sp = opts.startPos && opts.startPos[els.length];
    if (Number.isFinite(sp)) clip.dataset.pos = String(sp);
    const inner = master.cloneNode(true);
    inner.style.cssText = 'width:' + textW + 'in;max-width:none;padding:0;min-height:0;' +
                          'margin:' + (-num(pg.start, 0)) + 'px 0 0;';
    clip.append(inner);
    page.append(clip);
    slot.append(page);
    host.append(slot);
    els.push(page);
  }
  return { pages: els, scale, perRow: opts.perRow ?? 0 };
}
