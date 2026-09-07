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
 * @param {number} [minOverride] บังคับกฎบรรทัดโดดเดี่ยวเป็นค่านี้ (ใช้ตอน "ไม่ตัดไม่ได้แล้ว")
 */
export function lineCut(block, pageStart, limit, minOverride) {
  const offs = (block && block.lineOffsets) || null;
  if (!offs || !offs.length) return null;
  const minLines = Number.isFinite(minOverride)
    ? Math.max(1, Math.round(minOverride))
    : Math.max(1, Math.round(num(block.splitMinLines, 1)));
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
    // [alpha.143 ข้อ 2] `breakAfter` ของบล็อกก่อนหน้า = `breakBefore` ของบล็อกนี้
    // (รูปเต็มหน้าจึงอยู่บนแผ่นของตัวเองเสมอ ไม่มีข้อความมาต่อท้ายในแผ่นเดียวกัน)
    const forced = b.breakBefore || (i > 0 && list[i - 1].breakAfter);
    if (forced && b.top > pageStart) newPage(b.top);
    // [AbiWord ข้อ 4] ระยะเว้นท้ายย่อหน้าไม่กินความจุของหน้า — วัดจากหมึกบรรทัดสุดท้าย
    const inkBottom = b.top + b.height - Math.max(0, num(b.spaceAfterPx, 0));
    // ══ [alpha.103r ข้อ 2] ★★ บล็อกที่สูงเกินหนึ่งหน้า **ต้องยอมให้ตัดกลาง** ══
    //
    // ผู้ใช้: *"block ที่ไม่ใช่ข้อความปกติ ไม่ตัดหน้าให้เลย"* (หัวข้อยาว ๆ ไหลทะลุขอบกระดาษ)
    //
    // ต้นตอ: `blockRules()` ให้หัวข้อ `splitMinLines: 99` = "ห้ามฉีก" ซึ่งถูกสำหรับหัวข้อ
    // ปกติ (1–2 บรรทัด ต้องไปทั้งก้อน) แต่พอหัวข้อยาวเกินหนึ่งหน้า กฎนี้ทำให้ `lineCut()`
    // คืน null ตลอด → ตกไปเส้นทาง "ตัดดิบที่ขอบหน้า" ซึ่งได้พิกัดที่ **ไม่ตรงกับบรรทัดไหนเลย**
    // → `prosePosAtCut()` แปลงกลับไม่ได้ (CUT_FAIL.noLine) → เส้นคั่นถูกทิ้งเงียบ ๆ
    // = จำนวนหน้าเพิ่มขึ้นจริง แต่บนจอไม่มีรอยตัด ตัวหนังสือเลยไหลข้ามพื้นโต๊ะไปเรื่อย ๆ
    //
    // กติกาใหม่: ถ้าบล็อกเดียวสูงเกินความจุหนึ่งหน้า ให้ผ่อนกฎบรรทัดโดดเดี่ยวเหลือ 1
    // (ยังตัด "ตามบรรทัดจริง" อยู่ จึงแปลงพิกัดกลับได้และวาดเส้นคั่นได้ตามปกติ)
    const tooTall = b.height - Math.max(0, num(b.spaceAfterPx, 0)) > ch;
    let guard = 0;
    while (inkBottom > pageStart + ch && guard++ < 5000) {
      const cut = lineCut(b, pageStart, pageStart + ch)
        ?? (tooTall ? lineCut(b, pageStart, pageStart + ch, 1) : null);
      if (cut !== null) { newPage(cut); continue; }
      if (b.top > pageStart && !tooTall) {
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

/**
 * ══ [alpha.98 ข้อ 8] ★ ความสูงของช่องว่างคั่นหน้าที่อยู่ "ข้างใน" แต่ละบล็อก ══
 *
 * ของเดิมเป็น `el.querySelectorAll()` **ต่อบล็อก** → เอกสาร 80 หน้า (2,400 บล็อก)
 * = ค้นต้นไม้ย่อย 2,400 รอบต่อการจัดหน้าหนึ่งครั้ง ทั้งที่ทั้งเอกสารมีเส้นคั่นแค่ ~80 อัน
 * ตอนนี้กวาดเส้นคั่นครั้งเดียวแล้วไต่ขึ้นไปหาว่า "อยู่ในบล็อกไหน" — O(เส้นคั่น) แทน O(บล็อก)
 * @param {HTMLElement} pm
 * @param {Set<Element>} owners  บล็อกที่กำลังวัด (ผลของ measurableChildren)
 * @returns {Map<Element, number>}
 */
function innerGapMap(pm, owners) {
  const out = new Map();
  for (const g of pm.querySelectorAll('.' + GAP_CLASS)) {
    const h = g.getBoundingClientRect().height;
    if (!(h > 0)) continue;                       // โหมดวัดซ่อนไว้อยู่แล้ว = ไม่ต้องคิด
    for (let n = g.parentElement; n && n !== pm; n = n.parentElement) {
      if (!owners.has(n)) continue;
      out.set(n, (out.get(n) || 0) + h);
      break;
    }
  }
  return out;
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

/**
 * ══ [alpha.133 · Y-5] ★ "ขึ้นหน้าใหม่ด้วยมือ" (Ctrl+Enter) — บล็อกที่บังคับตัดหน้า ══
 *
 * `sliceProsePages()` รองรับธง `breakBefore` มาตั้งแต่ต้น แต่ **ไม่เคยมีใครตั้งค่าให้เลย**
 * (ธงนี้เป็นโค้ดตายมาตลอด) → กด Ctrl+Enter แล้วเห็นเส้นในตัวแก้ไข แต่ตัวจัดหน้าไม่รู้จัก
 * = ทั้งมุมมองจัดหน้า ช่องตัวอย่าง และไฟล์ PDF ตัดหน้าคนละที่กับที่ผู้ใช้สั่ง
 *
 * ชื่อคลาสมีสองตัวเพราะเป็นของสองฝั่งที่ต้องให้ผลตรงกัน:
 *   `.k-manual-page-break` = โหนด page_break ของตัวแก้ไข · `.pb` = ตัวเดียวกันในไฟล์ที่ส่งออก
 */
export const FORCE_BREAK_SEL = '.k-manual-page-break, .pb';
const isForcedBreak = (el) => !!(el && el.matches && el.matches(FORCE_BREAK_SEL));

/**
 * ══ [alpha.143 ข้อ 2] ★ รูป "เต็มหน้า" = **กินแผ่นทั้งแผ่น ไม่แบ่งกับใคร** ══
 *
 * ผู้ใช้: *"ขนาดรูปแบบเต็มหน้า ต้องเต็มจริง ๆ เรียกว่าแทนหน้ากระดาษเลย …
 *          เมื่อใช้แบบเต็มหน้า หน้านั้นจะไม่ได้ถูกใช้เลย จะเป็นรูปภาพอย่างเดียว"*
 *
 * ของเดิม `fit=page` เป็นแค่ "กล่องสูงเท่าพื้นที่พิมพ์" ที่ไหลอยู่ในสายเนื้อหาตามปกติ →
 * ถ้ามันเริ่มกลางหน้า ที่เหลือของหน้าก่อนก็ยังมีข้อความ แล้วตัวรูปถูกดันไปคร่อมสองแผ่น
 * (กลายเป็นบล็อกสูงเกินหนึ่งหน้า = เข้าเส้นทาง "ตัดดิบ" ซึ่งแปลงพิกัดกลับไม่ได้ → เส้นคั่นหาย)
 *
 * กติกาใหม่: **บังคับขึ้นหน้าใหม่ทั้งก่อนและหลัง** — แผ่นนั้นจึงมีแต่รูปใบเดียว
 * ส่วนการทาให้ชนขอบกระดาษเป็นหน้าที่ของตัววาด (`fullPageImages` + `opts.bleed`)
 */
export const FULLPAGE_SEL = 'figure.k-img-page';
export const isFullPageFigure = (el) => !!(el && el.matches && el.matches(FULLPAGE_SEL));

/** ชนิดของบล็อกจากชื่อแท็ก — ใช้ตัดสินกฎ widow/keepNext */
function blockRules(el) {
  if (isForcedBreak(el)) return { splitMinLines: 99, breakBefore: true };
  if (isFullPageFigure(el)) {
    return { splitMinLines: 99, breakBefore: true, breakAfter: true, fullPage: true };
  }
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
/**
 * ══════ [alpha.97 ข้อ 2] ★ "หนึ่งรายการ" ไม่ใช่ "หนึ่งบล็อก" ══════
 *
 * ผู้ใช้: *"มี 1 หัวข้อ บรรทัดอยู่ท้ายกระดาษ พอมี 2 หัวข้อ ทั้งกลุ่มกลับย้ายไปหน้าสอง
 *          เราว่าปัญหาเกิดจากระยะบรรทัดไม่เท่ากัน"* — ระยะบรรทัดเท่ากันจริง ต้นตออยู่ที่นี่
 *
 * ตัววัดเดินแค่ `pm.children` → `<ul>` ทั้งชุด (จะกี่ข้อก็ตาม) นับเป็น **บล็อกเดียว**
 * ที่มีกฎกันบรรทัดโดดเดี่ยว `splitMinLines = 2` · พอรายการมี 2 ข้อ `lineOffsets` มีจุดเดียว
 * `tailMax` จึงติดลบ → `lineCut()` คืน null → **ยกทั้งรายการไปหน้าใหม่ทั้งก้อน**
 * (มีข้อเดียวไม่เจอ เพราะมันยังพอดีหน้าอยู่)
 *
 * ที่ถูกคือรายการเป็น "หลายบล็อกเรียงกัน" เหมือนย่อหน้า — ตัดระหว่างข้อได้ ไม่ตัดกลางข้อสั้น ๆ
 * (ข้อเดียวบรรทัดเดียวไม่มี lineOffsets อยู่แล้ว จึงยกทั้งข้อไปหน้าใหม่โดยอัตโนมัติ)
 *
 * ผลพลอยได้: จุดตัดตกที่ **ตำแหน่งของ `<li>` ในเอกสาร** ซึ่ง parent เป็น `<ul>` ไม่ใช่ textblock
 * → เส้นคั่นถูกวาดเป็น `<div>` ระหว่าง `<li>` แทนที่จะไปแทรก *ข้างใน* `<li>` ก่อน `<p>`
 * ซึ่งเป็นตัวที่ทำให้หัวข้อกับข้อความแยกคนละบรรทัดในภาพที่ผู้ใช้ส่งมา
 */
function measurableChildren(pm) {
  const out = [];
  for (const el of Array.from(pm.children)) {
    if (!el || el.nodeType !== 1) continue;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      const kids = Array.from(el.children).filter((k) => k && k.nodeType === 1
        && ((k.tagName || '').toLowerCase() === 'li'
            || (k.classList && k.classList.contains(GAP_CLASS))));
      if (kids.length) { out.push(...kids); continue; }
    }
    out.push(el);
  }
  return out;
}

/**
 * ══ [alpha.98 ข้อ 8] ต้นแบบของ "กล่องบล็อก" — getter อยู่บน prototype ไม่ใช่ทีละใบ ══
 *
 * ของเดิมเรียก `Object.defineProperty()` **สองครั้งต่อบล็อก** → เอกสาร 80 หน้า
 * (2,400 บล็อก) = 4,800 ครั้งต่อการจัดหน้าหนึ่งรอบ ซึ่งเป็นการสร้าง property descriptor
 * ใหม่ทั้งหมด · ย้ายมาไว้บน prototype ก้อนเดียว แล้วเก็บสถานะเป็นพร็อพเพอร์ตี้ธรรมดา
 * พฤติกรรมเหมือนเดิมทุกประการ (ยังขี้เกียจ · ยังเขียนทับค่าได้จากภายนอก)
 */
const BLOCK_PROTO = {
  get lines() {
    if (!this._lines) this._lines = domLineRects(this.el, this._z);
    return this._lines;
  },
  set lines(v) { this._lines = v; },
  get lineOffsets() {
    if (!this._offs) this._offs = lineBreakOffsets(this.lines);
    return this._offs;
  },
  set lineOffsets(v) { this._offs = v; },
};

export function measureProseBlocks(pm, origin, zoomFactor) {
  const z = zoomFactor > 0 ? zoomFactor : 1;
  const blocks = [];
  let gapAccum = 0, totalHeight = 0;

  const kids = measurableChildren(pm);
  const gapMap = innerGapMap(pm, new Set(kids));
  for (const el of kids) {
    if (!el || el.nodeType !== 1) continue;
    const rect = el.getBoundingClientRect();
    if (el.classList && el.classList.contains(GAP_CLASS)) { gapAccum += rect.height; continue; }
    // [alpha.133 · Y-5] เส้นขึ้นหน้าใหม่ด้วยมือสูง 0 — ต้องไม่ถูกข้ามที่ด่านนี้
    // ไม่งั้นธง breakBefore ไม่มีทางไปถึงตัวหั่นหน้า (ต้นตอที่ทำให้ Ctrl+Enter ไม่มีผลจริง)
    if (!(rect.height > 0) && !isForcedBreak(el)) continue;
    const innerGap = gapMap.get(el) || 0;
    const top = (rect.top - origin - gapAccum) / z;
    const height = (rect.height - innerGap) / z;
    const b = Object.assign(Object.create(BLOCK_PROTO),
                           { top, height, el, _z: z }, blockRules(el));
    // [alpha.85 ข้อ 2] **วัดบรรทัดแบบขี้เกียจ** — ตัวที่แพงที่สุดของทั้งระบบ
    //
    // `domLineRects()` เดินทุก text node ในบล็อกแล้วเรียก getClientRects() ทีละตัว
    // ของเดิมทำให้ **ทุกบล็อกในเอกสาร ทุกครั้งที่กดปุ่ม** ทั้งที่ `sliceProsePages()`
    // ใช้ค่านี้เฉพาะ "บล็อกที่คร่อมขอบหน้า" ซึ่งมีแค่ประมาณจำนวนหน้า (5 จาก 200)
    // วัดจริงก่อนแก้: 200 ย่อหน้า = 6.5ms ต่อรอบ · 800 ย่อหน้า = 20.8ms → กดค้างแล้วสะดุด
    //
    // ⚠ ผู้เรียกต้องอ่านค่าพวกนี้ **ในโหมด withMeasureMode เท่านั้น** เพราะตอนนี้มันไปอ่าน
    // DOM ทีหลัง ไม่ใช่ตอนวัดแล้ว (ดู proseMeasured / proseBreakList)
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

/**
 * ══ [alpha.143r ข้อ 4] ★★ ตำแหน่ง "ก่อนบล็อกนี้" ที่ถูกต้องกับ **ทุกชนิดโหนด** ══
 *
 * ผู้ใช้ส่งภาพมาว่ารูปที่อยู่ตรงขอบล่างทำให้หน้าเลื่อน แล้วหมึกไหลต่ำกว่าพื้นที่พิมพ์ ·
 * วัดจริงแล้วพบว่า **โมเดลถูกทุกหน้า** (789/859/168 จากเพดาน 864) แต่ที่วาดจริงได้ 745/903
 * = มีบล็อกหนึ่งขนาด 44px หลุดจากหน้า 1 ไปโผล่หน้า 2 แล้วหน้า 2 ล้นเกินเพดาน 39px
 *
 * ต้นตอ: `view.posAtDOM(el, 0) - 1`
 *   · `<p>` — `posAtDOM(el, 0)` = ตำแหน่ง **ข้างใน** ย่อหน้า → ลบ 1 = ก่อนย่อหน้า ✔
 *   · `<figure>` (โหนด atom ไม่มีตำแหน่งข้างใน) — `posAtDOM(el, 0)` = **ก่อนโหนดอยู่แล้ว**
 *     → ลบ 1 อีกที = ไปโผล่ก่อน *บล็อกก่อนหน้า* = เส้นคั่นเลื่อนขึ้นหนึ่งบล็อกเต็ม ๆ
 * ดังนั้นหน้าที่ **เริ่มด้วยรูป** จะดูดย่อหน้าสุดท้ายของหน้าก่อนมาด้วยเสมอ (แล้วล้น)
 *
 * ท่าที่ถูก: ได้ตำแหน่งมาแล้วให้ **ถามกลับ** ว่าโหนดที่ตำแหน่งนั้นคือ element ตัวเดียวกันไหม
 * (`nodeDOM`) — ตรงก็คือ "ก่อนบล็อก" อยู่แล้ว ไม่ตรงค่อยถอยหนึ่ง · ใช้ได้กับทุกชนิดโหนด
 * โดยไม่ต้องรู้ว่าอันไหนเป็น atom
 */
export function posBeforeBlock(view, el) {
  if (!view || !el) return null;
  let p;
  try { p = view.posAtDOM(el, 0); } catch { return null; }
  if (!Number.isFinite(p)) return null;
  const doc = view.state && view.state.doc;
  const size = doc ? doc.content.size : 0;
  for (const cand of [p, p - 1]) {
    if (cand < 0 || cand > size) continue;
    try { if (view.nodeDOM(cand) === el) return cand; } catch { /* ไม่ใช่ขอบโหนด */ }
  }
  return Math.max(0, p - 1);
}

export function prosePosAtCut(view, blocks, y) {
  if (!view || !Number.isFinite(y)) return null;
  const list = blocks || [];
  // 1) ตรงหัวบล็อกพอดี = ยกทั้งบล็อกไปหน้าใหม่ → เส้นคั่นอยู่ "ก่อนบล็อก"
  //    ต้องตรวจกรณีนี้ให้ครบทั้งชุดก่อน เพราะระยะเว้นท้ายย่อหน้าทำให้ช่วงของบล็อกก่อนหน้า
  //    ยืดมาคาบเกี่ยวหัวบล็อกถัดไป ถ้าไล่เรียงลำดับเฉย ๆ บล็อกก่อนหน้าจะคว้าไปแล้วหาไม่เจอ
  for (const b of list) {
    if (Math.abs(y - b.top) >= 0.6) continue;
    return posBeforeBlock(view, b.el);
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
 * รายการเส้นคั่นหน้าพร้อมใช้ [{pos, page, pad}] จากผลการวัด
 *
 * [alpha.93 ข้อ 5] ★ **`pad` = ที่ว่างท้ายหน้า** — หัวใจของการทำให้ "หน้ากระดาษเท่ากันทุกแผ่น"
 *
 * ผู้ใช้: *"เรายังเจอหน้ากระดาษไม่เท่ากันอยู่นะ"* · วัดจริงในเอกสารที่มีหัวข้อ/คำพูดยกมา/
 * คำยาวปนกัน: ระยะระหว่างเส้นคั่นหน้าได้ 822.3 / 805.4 / 838.2 / 805.4 / 833.4 px
 * = **ต่างกันถึง 32.8px** ทั้งที่พื้นที่พิมพ์ต่อหน้าเป็นค่าคงที่
 *
 * เพราะหน้าหนึ่ง ๆ "ใช้ไปไม่เต็มพื้นที่" เสมอ — บรรทัดถัดไปสูงเกินที่เหลือก็ต้องยกไปหน้าใหม่
 * (ยิ่งเป็นหัวข้อที่ห้ามค้างท้ายหน้า ยิ่งเหลือเยอะ) ที่ว่างส่วนนั้นคือ **ก้นหน้าที่ยังว่างอยู่**
 * ซึ่งของจริงบนกระดาษมันมีอยู่ แต่บนจอเราไม่เคยวาดมัน → เส้นคั่นเลยขยับเข้ามาชิดข้อความ
 *
 * ให้เส้นคั่นแต่ละเส้น "อมที่ว่างที่เหลือของหน้าที่มันปิด" ไว้ → ระยะระหว่างเส้นคงที่เป๊ะทุกหน้า
 * ปลอดภัยกับวงจรป้อนกลับของตัววัด เพราะโหมด `k-measuring` สั่ง `display:none` ทั้งก้อนอยู่แล้ว
 *
 * @param {number} basePage เลขหน้าเริ่มต้นของไฟล์ (1 = ปกติ)
 * @param {number} [contentHeight] ความสูงพื้นที่พิมพ์ต่อหน้า (px) — ไม่ส่ง = ไม่คิด pad
 */
export function proseBreakList(view, blocks, pages, basePage = 1, contentHeight = 0) {
  // ต้องอยู่ในโหมด "ยุบเส้นคั่น" เหมือนตอนวัด ไม่งั้นพิกัดที่จำไว้ชี้ไปคนละที่กับของจริง
  return withMeasureMode(() => {
    const out = [];
    const list = pages || [];
    const ch = num(contentHeight, 0);
    for (let i = 1; i < list.length; i++) {
      const pos = prosePosAtCut(view, blocks, list[i].start);
      if (!Number.isFinite(pos) || pos <= 0) continue;
      // หน้าก่อนหน้าใช้ไปจริงเท่าไร (พิกัดชุดนี้เป็นแบบ "ไม่มีช่องว่างคั่นหน้า" อยู่แล้ว)
      const used = list[i].start - list[i - 1].start;
      // ── ★ ระยะเว้นระหว่างย่อหน้าตรงรอยต่อนี้ (margin ที่ยุบรวมกันแล้ว) ──
      // เส้นคั่นระดับบล็อกกางที่ว่างด้วย `margin-top` เพราะกล่องมันสูง 0 และไม่มีขอบ/พื้นใน
      // → margin ของย่อหน้าบน/ล่างกับของมัน **ยุบรวมกันเป็นก้อนเดียว** เหลือค่ามากที่สุด
      //   (ถ้าไปตั้ง `height` แทน กล่องจะเลิกเป็นกล่องว่าง margin เลิกยุบ แล้วระยะจะเกินมา
      //    เท่ากับ margin ที่เคยยุบหายไป — ต่างกันตามชนิดบล็อกที่ประกบ วัดจริงแล้วบานเป็น 66.8px)
      // ดังนั้นค่าที่ตั้งต้องรวม `g` เข้าไปด้วย เพราะมันไป **แทนที่** ระยะเว้นเดิมทั้งก้อน
      let g = 0;
      const bl = blocks || [];
      for (let j = 1; j < bl.length; j++) {
        if (Math.abs(num(bl[j].top, -1e9) - list[i].start) < 0.6) {
          g = Math.max(0, num(bl[j - 1].spaceAfterPx, 0));
          break;
        }
      }
      const pad = ch > 0 ? Math.max(0, Math.round((ch - used + g) * 10) / 10) : 0;
      out.push({ pos, page: basePage + i, pad });
    }
    return out;
  });
}

// ═══════════════════ มุมมองหน้ากระดาษ (เรียงหน้าคู่ / ภาพรวม) ═══════════════════

/**
 * ══ [alpha.143 ข้อ 2] แผ่นไหนเป็น "รูปเต็มหน้า" และรูปใบไหน ══
 *
 * คีย์ = **ลำดับที่เท่าไรในชุดหน้าที่ส่งเข้ามา** (ไม่ใช่เลขหน้าของทั้งเล่ม) — ตรงกับ
 * argument ที่ `renderProseClipPages` ส่งให้ `opts.bleed()` เป๊ะ ผู้เรียกทุกคนจึงไม่ต้อง
 * รู้เรื่องนี้เลย แค่ส่ง `blocks` ที่วัดมาให้ · หน้าที่หัวแผ่นตรงกับบล็อกรูปเต็มหน้า = แผ่นนั้นทั้งแผ่น
 * @param {Array<object>} blocks ผลของ measureProseBlocks
 * @param {Array<{start:number}>} pages ชุดหน้าที่กำลังจะวาด
 * @returns {Map<number,string>} ลำดับหน้า (1-based) → URL ของรูป
 */
export function fullPageImages(blocks, pages) {
  const out = new Map();
  const list = (pages && pages.pages) || pages || [];
  const full = (blocks || []).filter((b) => b && b.fullPage);
  if (!full.length || !list.length) return out;
  for (let i = 0; i < list.length; i++) {
    const start = num(list[i] && list[i].start, 0);
    for (const b of full) {
      if (Math.abs(num(b.top, -1e9) - start) > 0.6) continue;
      const im = b.el && b.el.querySelector ? b.el.querySelector('img') : null;
      const src = im ? (im.currentSrc || im.getAttribute('src') || '') : '';
      if (src) out.set(i + 1, src);
      break;
    }
  }
  return out;
}

/**
 * ══ [alpha.143 ข้อ 1] ★ รอรูปโหลดให้เสร็จก่อนวัด — วัดก่อนรูปมา = **หน้าเหลื่อมทั้งไฟล์** ══
 *
 * ผู้ใช้: *"รูปใหญ่ เช่น 75% หรือรูปปกติ ทำให้การคำนวณตัดหน้าเหลื่อมหมดเลย"*
 *
 * `<img>` ที่ยังไม่โหลดสูง 0 — ตัววัดจึงคิดว่าย่อหน้าถัด ๆ ไปอยู่สูงกว่าความจริงราวหนึ่งหน้า
 * แล้ว **ไม่มีใครสั่งวัดใหม่อีกเลย** เพราะสายจัดหน้าถูกปลุกด้วย "เอกสารเปลี่ยน" เท่านั้น
 * (ตระกูลเดียวกับ alpha.104r ฟอนต์/ระยะขอบ และ alpha.109 รอฟอนต์โหลด)
 * โหมดอ่านทั้งเล่มมีตัวรอแบบนี้ของตัวเองมาตั้งแต่ต้น — ย้ายมาไว้ที่นี่ให้ทุกสายใช้ตัวเดียวกัน
 */
export function whenImagesReady(root, ms = 2500) {
  const imgs = root && root.querySelectorAll
    ? [...root.querySelectorAll('img')].filter((im) => !im.complete)
    : [];
  if (!imgs.length) return null;                       // null = ไม่มีอะไรต้องรอ (ผู้เรียกวัดได้เลย)
  return Promise.race([
    Promise.all(imgs.map((im) => new Promise((res) => {
      im.addEventListener('load', res, { once: true });
      im.addEventListener('error', res, { once: true });
    }))),
    new Promise((res) => setTimeout(res, ms)),
  ]);
}

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

  // [alpha.143 ข้อ 2] แผ่นที่เป็น "รูปเต็มหน้า" — ผู้เรียกส่ง `blocks` มาก็พอ ที่เหลือที่นี่จัดการเอง
  // (ผู้เรียกที่ไม่ส่งมาก็ได้พฤติกรรมเดิมทุกประการ)
  const fullMap = opts.blocks ? fullPageImages(opts.blocks, list) : null;

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
    // [alpha.87 ข้อ 2+4] **height ไม่ใช่ min-height** — กระดาษต้องสูงเท่ากันทุกแผ่น
    // min-height ปล่อยให้แผ่นที่เนื้อเกินความจุ "ยืด" ออกไป = เรนเดอร์ไม่เท่ากัน
    // (ฝั่งบทแก้ที่ sp-view.js ด้วยเหตุผลเดียวกัน · ตัววาดหน้าหน้าเล่มใช้ height อยู่แล้ว)
    page.style.height = ph + 'in';
    page.style.paddingTop = num(m.top, 1) + 'in';
    page.style.paddingBottom = num(m.bottom, 1) + 'in';
    page.style.paddingLeft = num(m.left, 1.5) + 'in';
    page.style.paddingRight = num(m.right, 1) + 'in';
    page.style.transform = 'scale(' + scale + ')';

    // ══ [alpha.142r] ★ ภาพเต็มหน้า **ชนขอบกระดาษ** ══
    //
    // ผู้ใช้: "ปกเล่ม ถ้ามีรูป ควรขึ้นรูปเต็มหน้า" — ครั้งแรกทำเป็น "เต็มพื้นที่พิมพ์"
    // แล้วภาพที่ได้ยังมีกรอบขาวรอบรูป (เห็นจากสกรีนช็อตของ e2e) ซึ่งไม่ใช่ปกหนังสือ
    //
    // เนื้อหาในสายเอกสารไม่มีทางล้นออกไปในระยะขอบได้เลย เพราะ `.ed-page-clip` เป็น
    // `overflow:hidden` และมันคือหัวใจของการหั่นหน้า (จะไปเปิด overflow ไม่ได้)
    // → ทางที่ถูกคือ **ทาที่พื้นของแผ่นกระดาษเอง**: `.sp-page` กินเต็มแผ่นและ `overflow:hidden`
    //   อยู่แล้ว พื้นหลังของมันจึงชนขอบพอดีโดยไม่ต้องแตะตรรกะจัดหน้าแม้แต่บรรทัดเดียว
    // ผู้เรียกที่ไม่ส่ง `bleed` มา (มุมมองจัดหน้า · ช่องตัวอย่างส่งออก) ไม่รู้จักเรื่องนี้เลย
    const pageNo = els.length + 1;
    // สองที่มาคนละเรื่องกัน — **หน้าปก** (ผู้เรียกบอกมา) กับ **รูปเต็มหน้าในเนื้อเรื่อง**
    // ต่างกันตรงเลขหน้า: ปกบทยังพิมพ์เลขตามธรรมเนียม (คำสั่งจาก alpha.141–142)
    // ส่วนแผ่นที่เป็นรูปล้วนกลางเล่มไม่พิมพ์เลขทับรูป
    const coverUrl = typeof opts.bleed === 'function' ? (opts.bleed(pageNo) || '') : '';
    const fullUrl = fullMap ? (fullMap.get(pageNo) || '') : '';
    const bleedUrl = coverUrl || fullUrl;
    if (bleedUrl) {
      page.style.backgroundImage = 'url("' + String(bleedUrl).replace(/"/g, '%22') + '")';
      page.style.backgroundSize = 'cover';
      page.style.backgroundPosition = 'center';
      page.style.backgroundRepeat = 'no-repeat';
    }

    // [alpha.143 ข้อ 2] แผ่นที่เป็น "รูปเต็มหน้าในเนื้อเรื่อง" ไม่พิมพ์เลขทับรูป
    // (ยังนับเป็นหนึ่งแผ่นตามปกติ เลขของแผ่นถัด ๆ ไปจึงไม่ขยับ) · หน้าปกยังพิมพ์เลขเหมือนเดิม
    const label = opts.label && !fullUrl ? opts.label(pageNo) : '';
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
                          'margin:' + (-num(pg.start, 0)) + 'px 0 0;'
      // แผ่นที่ทาพื้นด้วยภาพแล้ว ไม่ต้องวาดตัวภาพในสายเอกสารซ้ำอีก (ไม่งั้นภาพซ้อนกันสองชั้น)
      // ★ ต้องต่อท้าย `cssText` ไม่ใช่ตั้ง `style.visibility` ก่อนหน้า — การกำหนด `cssText`
      //   **ล้างสไตล์อินไลน์ทั้งก้อนทิ้ง** (เทสจับได้ทันทีในรอบแรก)
      + (bleedUrl ? 'visibility:hidden;' : '');
    clip.append(inner);
    page.append(clip);
    slot.append(page);
    host.append(slot);
    els.push(page);
  }
  return { pages: els, scale, perRow: opts.perRow ?? 0 };
}
