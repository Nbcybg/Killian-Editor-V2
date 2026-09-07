// sp-view.js — โหมดมุมมองของบทภาพยนตร์ (ข้อ 57 · 59 · 60) + ตัวช่วยไป-ยัง-หน้า/ฉาก (ข้อ 78)
//
//   57 Draft View        → ข้อความล้วนบนพื้นว่าง · ตัวคั่นหน้าเป็นเส้นบาง (คลาส CSS)
//   59 Side-by-Side      → เรียงหน้าจริงเป็นตาราง ปรับสเกลให้พอดีความกว้างหน้าต่าง
//   60 Overview 1px/4px  → หน้าเดียวกันย่อจนแต่ละตัวอักษรเหลือ 1px / 4px
//   78 Goto page/scene   → หาตำแหน่งในเอกสารของหน้า N / ฉาก N
//
// ส่วนคำนวณทั้งหมดบริสุทธิ์ (ทดสอบด้วย node ได้ — test/sp-view.test.cjs)
// ส่วนที่แตะ DOM มีเฉพาะ renderPageView() ซึ่งรับ host element มาจากผู้เรียก

import { t, tf } from './i18n.js';
import { paginate, mergeSpFormat, textWidth, wrapLines, CHARS_PER_INCH, LINE_HEIGHT_IN,
         linesPerPage, pageNumberLabel, lineHeightIn, formatLines,
         clampLineHeight, blockDocPos, isMidBlock, elementIndentIn } from './sp-format.js';
import { num } from './num.js';

// ───────── รายการโหมด ─────────
// ══ [alpha.99 ข้อ 1+2] ★ คืนมุมมอง "จัดหน้า" · ตัด **โหมดหน้ากระดาษ** ทิ้งแทน ══
//
// ผู้ใช้: *"เราบอกว่า mode หน้ากระดาษ Ctrl+Alt+U ลบออก เพราะมันซ้ำกับ layout
//          คุณก็ไม่เอาออก แถมยังไปลบ layout ออกอีก"*
//
// alpha.98 ทำกลับด้าน — รอบนี้ทำตามที่สั่งจริง ๆ:
//   · มุมมอง **ปกติ**   = สายเนื้อหาต่อเนื่องบนกระดาษ · รอยต่อหน้าเป็น **เส้นประ** ไม่ใช่แผ่นแยก
//   · มุมมอง **จัดหน้า** = แผ่นกระดาษจริงมีช่องว่างพื้นโต๊ะคั่น (ของเดิม กลับมาแล้ว)
//   · **ไม่มีสวิตช์โหมดหน้ากระดาษอีกต่อไป** — Ctrl+Alt+U/ปุ่ม 📄/เมนู ถูกถอดออกทั้งชุด
//     เพราะมันทำเรื่องเดียวกับการสลับมุมมองสองอันข้างบน (ซึ่งคือคำว่า "ซ้ำซ้อน")
export const SP_VIEWS = ['normal', 'layout', 'draft', 'side', 'overview1', 'overview4'];
export const SP_VIEW_LABELS = {
  normal:    t('ui.common.normalPagePaper'),
  layout:    t('ui.common.arrangePageSeePage'),
  draft:     t('ui.common.draftTextDraft'),
  side:      t('ui.common.pagePairSideBy'),
  overview1: t('ui.common.overviewPxChar'),
  overview4: t('ui.common.overviewPxChar2'),
};
// คลาสที่ใส่ให้ .pane — normal ไม่ต้องมีคลาสอะไร
// ══ [alpha.100 ข้อ 1] ★ `k-paper` = "มุมมองนี้มีแผ่นกระดาษอยู่จริง" ══
//
// ผู้ใช้: *"มุมมองหน้ากระดาษปกติ จะต้องไม่แสดงหน้ากระดาษสีเหลือง ...
//           ก็ไม่มีแค่กระดาษแต่ทุกอย่างเหมือนเดิม ง่าย ๆ อยู่บน canvas"*
//
// ตั้งแต่ alpha.99 ที่ถอดสวิตช์โหมดหน้ากระดาษทิ้ง คลาส `paper-mode` อยู่บน <body> ตลอดเวลา
// → กฎกระดาษหลายสิบข้อลงไปถึง **ทุกมุมมองที่พิมพ์ได้** รวมมุมมองปกติที่ไม่ควรมีแผ่นเลย
// ตัวคุมที่ถูกต้องคือ "มุมมองนี้วาดแผ่นไหม" ซึ่งเป็นเรื่องของ pane ไม่ใช่ของ body
//   · จัดหน้า  → มีแผ่นจริง (ชั้น .k-paper-layer)      = ใส่ k-paper
//   · ปกติ/ร่าง → สายเนื้อหาบนพื้นโปรแกรม               = ไม่ใส่
//   · หน้าคู่/ภาพรวม → วาดแผ่นเองใน .sp-pageview อยู่แล้ว = ไม่ต้องใส่
export const SP_VIEW_CLASS = {
  normal: '',
  layout: 'sp-view-layout k-paper',
  draft: 'sp-view-draft',
  side: 'sp-view-side',
  overview1: 'sp-view-overview sp-view-ov1',
  overview4: 'sp-view-overview sp-view-ov4',
};
export const ALL_VIEW_CLASSES = ['sp-view-layout', 'sp-view-draft', 'sp-view-side',
                                 'sp-view-overview', 'sp-view-ov1', 'sp-view-ov4', 'k-paper'];
/** มุมมองนี้วาด "แผ่นกระดาษ" ไว้ข้างหลังตัวแก้ไขไหม (ตัวเดียวที่ renderPaperSheets ต้องรู้) */
export const isPaperView = (mode) => mode === 'layout';
/** โหมดที่วาด "หน้ากระดาษจริง" แทนตัวแก้ไข (อ่านอย่างเดียว) */
export const isPageView = (mode) => mode === 'side' || mode === 'overview1' || mode === 'overview4';
export const isValidView = (mode) => SP_VIEWS.includes(mode);
/** โหมดที่ยังพิมพ์ได้ (ใช้ ProseMirror ตามปกติ) — ปกติ/จัดหน้า/ร่าง */
export const isEditView = (mode) => !isPageView(mode);

// ───────── 58. Layout View — ตัวเลขที่ CSS ต้องใช้วาดหน้ากระดาษจริง ─────────
/**
 * มาตรวัดของหน้ากระดาษหนึ่งหน้า (ทุกอย่างคำนวณจาก fmt เดียว — ไม่มีเลขฝังในโค้ด)
 * ใช้ทั้งกับ Layout View (ช่องว่างคั่นหน้า/ความสูงกระดาษ) และการนับหน้าในแถบสถานะ
 * @returns {{linesPerPage, charsPerLine, usableWidth, usableHeight, lineHeightIn,
 *            pageWidthPx, pageHeightPx, bodyHeightPx, lineHeightPx}}
 */
export function pageMetrics(fmt, dpi = 96) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const m = f.margins;
  const usableWidth = textWidth(f.paper, m);
  const usableHeight = Math.max(0.5, +f.paper.height - m.top - m.bottom);
  // [alpha.58r บั๊ก 9] ความสูงบรรทัดต้องคูณ spLineHeight ที่ผู้ใช้ตั้ง ไม่งั้น --sp-line-h
  // (16px เสมอ) ไม่ตรงกับความสูงที่ CSS วาดจริง (--sp-fs × --sp-lh)
  const lh = lineHeightIn(f);
  const lpp = linesPerPage(f.paper, m, lh);
  return {
    linesPerPage: lpp,
    charsPerLine: Math.floor(usableWidth * CHARS_PER_INCH),
    usableWidth: +usableWidth.toFixed(4),
    usableHeight: +usableHeight.toFixed(4),
    lineHeight: clampLineHeight(f.lineHeight),
    lineHeightIn: +lh.toFixed(6),
    pageWidthPx: Math.round(+f.paper.width * dpi),
    pageHeightPx: Math.round(+f.paper.height * dpi),
    bodyHeightPx: Math.round(usableHeight * dpi),
    lineHeightPx: +(lh * dpi).toFixed(4),
  };
}

/**
 * [alpha.87] ตำแหน่งของ `CONTINUED:` / `(CONTINUED)` บนกระดาษ — **หน่วยนิ้ว วัดจากขอบกระดาษ**
 *
 * `paginate()` ไม่จองบรรทัดให้สองตัวนี้ (ดูคอมเมนต์ยาวใน sp-format.js) มันจึงต้องถูกวาด
 * **ในระยะขอบ** เท่านั้น · `pdf-generator.js` ทำถูกมาตลอด: บนที่ `baseline(-1)`
 * = หนึ่งบรรทัดเหนือเนื้อหน้า · ล่างที่ `baseline(bodyLines)` = หนึ่งบรรทัดใต้เนื้อหน้า
 *
 * เดิมมุมมองเรียงหน้า (`renderPageView`) วาดมันเป็น **บล็อกในสายเนื้อหา** →
 * เนื้อหน้าเกินความจุที่โมเดลคิดไป 1–2 บรรทัด แล้ว `min-height` ปล่อยให้กระดาษยืด
 * = "เรนเดอร์กระดาษไม่เท่ากัน" + "หน้ากระดาษล้น" · ตัวนี้คือแหล่งความจริงเดียวของตำแหน่ง
 * ทั้งจอและ PDF ต่อจากนี้
 * @returns {{left:number, width:number, topIn:number, bottomIn:number, lineIn:number}}
 *   topIn/bottomIn = ระยะจากขอบกระดาษบน/ล่างถึงขอบบน/ล่างของกล่องข้อความ
 */
export function continuedBox(fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const m = f.margins;
  const lineIn = lineHeightIn(f);
  // หนึ่งบรรทัดเหนือ/ใต้พื้นที่พิมพ์ — ระยะขอบ 1 นิ้ว = 6 บรรทัด จึงมีที่เหลือแน่นอน
  // หนีบไม่ให้ติดลบเมื่อผู้ใช้ตั้งระยะขอบแคบกว่าหนึ่งบรรทัด (ไม่งั้นหลุดออกนอกกระดาษ)
  return {
    left: +m.left.toFixed(4),
    width: +textWidth(f.paper, m).toFixed(4),
    topIn: +Math.max(0, m.top - lineIn).toFixed(4),
    bottomIn: +Math.max(0, m.bottom - lineIn).toFixed(4),
    lineIn: +lineIn.toFixed(6),
  };
}

/** ตัวแปร CSS ของ Layout View — ช่องว่างระหว่างหน้า + ความสูงเนื้อหน้า */
export function layoutCssVars(fmt, gapPx = 28) {
  const mt = pageMetrics(fmt);
  return {
    '--sp-body-h': mt.bodyHeightPx + 'px',
    '--sp-page-gap': Math.max(8, Math.round(gapPx)) + 'px',
    '--sp-line-h': mt.lineHeightPx + 'px',
  };
}

// ───────── 59. คำนวณสเกล/จำนวนหน้าต่อแถวให้พอดีความกว้าง ─────────
/**
 * @param {number} containerW ความกว้างพื้นที่ (px)
 * @param {number} pageW      ความกว้างหน้ากระดาษ (px ที่สเกล 1)
 * @param {number} gap        ช่องไฟระหว่างหน้า (px)
 * @returns {{perRow:number, scale:number}}
 */
export function fitScale(containerW, pageW, gap = 20, opts = {}) {
  const minScale = opts.minScale ?? 0.5;      // ต่ำกว่าครึ่งหน้า = อ่านไม่ออก ไม่คุ้มที่จะยัดเพิ่ม
  const maxScale = opts.maxScale ?? 1;
  const maxPerRow = Math.max(1, opts.maxPerRow ?? 4);
  const cw = Math.max(1, +containerW || 1);
  const pw = Math.max(1, +pageW || 1);
  let perRow = 1;
  for (let n = maxPerRow; n >= 1; n--) {
    const s = (cw - gap * (n + 1)) / (n * pw);
    if (s >= minScale || n === 1) { perRow = n; break; }
  }
  const raw = (cw - gap * (perRow + 1)) / (perRow * pw);
  const scale = Math.max(0.05, Math.min(maxScale, raw));
  return { perRow, scale: +scale.toFixed(4) };
}

// ───────── 60. สเกลของโหมดภาพรวม ─────────
/** 1 ตัวอักษร Courier 12pt = 1/10 นิ้ว = 9.6px ที่ 96dpi → สเกลที่ทำให้เหลือ pxPerChar */
export function overviewScale(pxPerChar, cpi = CHARS_PER_INCH, dpi = 96) {
  const full = dpi / Math.max(1, cpi);
  return +((Math.max(0.25, +pxPerChar || 1)) / full).toFixed(4);
}
export const OVERVIEW_PX = { overview1: 1, overview4: 4 };
/** สเกลที่ใช้จริงของโหมดหนึ่ง (side = คำนวณจากความกว้าง · overview = ตายตัว) */
export function viewScale(mode, containerW, pageW, gap = 20) {
  if (mode === 'overview1') return { perRow: 0, scale: overviewScale(1) };
  if (mode === 'overview4') return { perRow: 0, scale: overviewScale(4) };
  return fitScale(containerW, pageW, gap);
}

// ───────── 61. ชนิดการจบบรรทัด (ใช้กับ "แสดงรูปแบบ") ─────────
/** บล็อกที่ข้อความยาวจนตัดบรรทัดเอง = 'soft' · จบพอดีบรรทัดเดียว = 'hard' */
export function lineEndingType(text, widthIn) {
  return wrapLines(text, widthIn) > 1 ? 'soft' : 'hard';
}
export const LINE_MARK = { hard: '¶', soft: '·' };

// ───────── บล็อกจากเอกสาร ProseMirror (ใช้กับทั้ง 57/59/60/78) ─────────
/**
 * แปลง doc ของ SPEditor เป็น blocks ที่ sp-format ใช้ได้ พร้อมตำแหน่งจริงในเอกสาร
 * บล็อก action ที่ไม่มีข้อความ = บรรทัดว่างของบท → คืน el 'blank' เพื่อให้ paginate ข้าม
 * @returns {Array<{el:string,text:string,pos:number,idx:number}>}
 */
export function blocksFromDoc(doc) {
  const out = [];
  if (!doc || typeof doc.forEach !== 'function') return out;
  let i = 0, scene = 0;
  doc.forEach((node, offset) => {
    if (node.type && node.type.name === 'spimage') {
      out.push({ el: 'image', text: node.attrs.alt || '', pos: offset, idx: i++ });
      return;
    }
    const el = (node.attrs && node.attrs.el) || 'action';
    const text = node.textContent || '';
    // [alpha.87 ข้อ B] ★ **บล็อกว่าง = บรรทัดว่าง ทุกชนิด ไม่ใช่แค่ `action`**
    //
    // เดิมเขียนว่า `el === 'action' && !text.trim()` → บล็อก **ตัวละคร/หัวฉาก/ทรานซิชัน
    // ที่ยังไม่ได้พิมพ์ข้อความ** ถูกนับเป็นบล็อกจริง = `linesBefore` + 1 บรรทัด
    // ขณะที่ฝั่ง CSS ตัด margin/padding ของ **บล็อกว่างทุกชนิด** ทิ้ง แล้วบังคับสูง 1 บรรทัด
    // (กฎ `.sp:has(> br.ProseMirror-trailingBreak:only-child)` ใน style.css)
    // → ตัวละครว่างหนึ่งก้อน: จอนับ 1 บรรทัด · โมเดลนับ 2 บรรทัด
    //   ผู้ใช้กด Enter ค้างในบล็อกตัวละคร โมเดลจึงคิดว่าหน้าเต็มตั้งแต่ 27 ก้อน
    //   ทั้งที่จอเพิ่งใช้ไปครึ่งแผ่น = "หน้าสั้นมาก" ที่ผู้ใช้เห็น
    //
    // กติกานี้ตรงกับ `lineFor()` ใน fountain.js อยู่แล้ว (บล็อกไม่มีข้อความ = เขียนเป็น
    // บรรทัดว่างลงไฟล์ ทุกชนิด — alpha.83 ข้อ 1) · ตอนนี้ทั้งไฟล์ · จอ · โมเดล ใช้นิยามเดียวกัน
    // `page-break` ยกเว้น: เป็น *คำสั่ง* ที่ไม่มีข้อความอยู่แล้ว
    const blank = !text.trim() && el !== 'page-break';
    const b = { el: blank ? 'blank' : el, text, pos: offset, idx: i++ };
    if (b.el === 'scene') b.sceneNo = ++scene;      // [alpha.57a] เลขฉากไล่ตามลำดับในไฟล์
    out.push(b);
  });
  return out;
}

// ───────── 78. หาตำแหน่งของหน้า / ฉาก ─────────
/** บล็อกแรกของหน้าที่ "มีตัวตนจริง" ในเอกสาร (บล็อกสังเคราะห์ไม่มี pos) */
export function pageFirstBlock(pg) {
  return ((pg && pg.blocks) || []).find((x) => Number.isFinite(x && x.pos)) || null;
}
/**
 * ตำแหน่งเริ่มต้นของแต่ละหน้า (index 0 = หน้า 1)
 * [alpha.84 ข้อ 2] คิด `cut` ด้วย — หน้าที่เริ่มกลางบทพูดที่ถูกหั่นต้องได้ตำแหน่ง
 * "ในเนื้อข้อความ" ไม่ใช่หัวย่อหน้า (ไม่งั้นเส้นคั่นหน้าไปโผล่ก่อนทั้งบล็อก)
 */
export function pageStartPositions(pages) {
  const list = (pages && pages.pages) || pages || [];
  return list.map((pg) => {
    const b = pageFirstBlock(pg);
    return b ? blockDocPos(b) : null;
  });
}
/**
 * [alpha.84 ข้อ 2] ข้อมูลครบของ "จุดเริ่มหน้า" — ตำแหน่ง + อยู่กลางบล็อกไหม + ระยะเยื้องของบล็อกนั้น
 * ตัววาดต้องรู้ทั้งสามอย่าง: กลางบล็อก = widget ถูกวาดข้างในบล็อก จึงสืบระยะเยื้องมาด้วย
 * แล้วต้องชดเชยกลับ ไม่งั้นเส้นคั่นหน้า/แถบคั่นแผ่นเลื่อนไปตามระยะเยื้องของ element
 * @returns {Array<{pos:number|null, mid:boolean, indent:number}>}
 */
export function pageStartMarks(pages, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const list = (pages && pages.pages) || pages || [];
  return list.map((pg) => {
    const b = pageFirstBlock(pg);
    if (!b) return { pos: null, mid: false, indent: 0 };
    return { pos: blockDocPos(b), mid: isMidBlock(b), indent: elementIndentIn(f, b.el) };
  });
}
/** ตำแหน่งในเอกสารของหน้าที่ n (1-based) — null เมื่อไม่มี */
export function findPageStart(pages, n) {
  const arr = pageStartPositions(pages);
  const i = Math.max(1, Math.round(+n || 1)) - 1;
  if (i === 0) return arr.length ? (arr[0] ?? 0) : 0;
  return i < arr.length ? arr[i] : null;
}
/** รายชื่อหัวฉากทั้งหมด [{n, pos, text, idx}] */
export function scenePositions(blocks) {
  const out = [];
  let n = 0;
  for (const b of blocks || []) {
    if (!b || b.el !== 'scene') continue;
    n++;
    out.push({ n, pos: Number.isFinite(b.pos) ? b.pos : null, idx: b.idx ?? null,
               text: String(b.text || '').trim() });
  }
  return out;
}
/** ตำแหน่งในเอกสารของฉากที่ n (1-based) */
export function findNthScene(blocks, n) {
  const s = scenePositions(blocks)[Math.max(1, Math.round(+n || 1)) - 1];
  return s ? s.pos : null;
}

// ───────── การวาดหน้ากระดาษจริง (59/60) ─────────
/** ข้อมูลหน้าทั้งหมดของบท (พร้อม pos) — ผู้เรียกส่ง blocks จาก blocksFromDoc มา */
export function pagesOf(blocks, fmt, lines) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  // ไม่ส่ง lines = ให้ paginate คิดเองจาก fmt (รวม lineHeight ที่ผู้ใช้ตั้ง — บั๊ก 5)
  return paginate(blocks, { fmt: f, lines: lines || formatLines(f) });
}

const cssIn = (v) => num(v, 0) + 'in';

/**
 * วาดหน้ากระดาษลง host (DOM) — ใช้กับโหมด side / overview
 * ไม่ผูกกับ ProseMirror เลย: อ่านจาก pages ที่ paginate ให้มา
 * @returns {{pages:HTMLElement[], scale:number, perRow:number}}
 */
export function renderPageView(host, pages, fmt, opts = {}) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const list = (pages && pages.pages) || pages || [];
  const scale = opts.scale ?? 1;
  const gap = opts.gap ?? 20;
  const pw = +f.paper.width, ph = +f.paper.height;
  const pxW = pw * 96 * scale, pxH = ph * 96 * scale;

  host.innerHTML = '';
  host.style.setProperty('--sp-pv-scale', String(scale));
  host.style.setProperty('--sp-pv-gap', gap + 'px');
  const els = [];

  for (const pg of list) {
    const slot = document.createElement('div');
    slot.className = 'sp-page-slot';
    slot.style.width = pxW + 'px';
    slot.style.height = pxH + 'px';

    const page = document.createElement('div');
    page.className = 'sp-page';
    page.dataset.page = String(pg.index);
    page.style.width = cssIn(pw);
    // [alpha.87] **height ไม่ใช่ min-height** — กระดาษคือกระดาษ สูงเท่าที่ตั้งไว้เสมอ
    // เดิมเป็น min-height: อะไรที่ล้นความจุจะ "ดันกระดาษให้ยืด" → หน้าแต่ละแผ่นสูงไม่เท่ากัน
    // (ตัวการคือ CONTINUED ที่เคยถูกวาดเป็นบล็อกในเนื้อหน้า — ย้ายเป็นโอเวอร์เลย์แล้วข้างล่าง)
    // ตัววาดหน้าหน้าเล่มใน export-hub.js ใช้ `height` มาตั้งแต่ต้น ตอนนี้ตรงกันทั้งสองที่
    page.style.height = cssIn(ph);
    page.style.paddingTop = cssIn(f.margins.top);
    page.style.paddingBottom = cssIn(f.margins.bottom);
    page.style.paddingLeft = cssIn(f.margins.left);
    page.style.paddingRight = cssIn(f.margins.right);
    page.style.transform = 'scale(' + scale + ')';

    // [alpha.57a ข้อ 2] เลขหน้า — เปิด/ปิดได้ที่ตั้งค่าโปรเจกต์ · ตำแหน่งวัดจากขอบกระดาษ
    // (ค่าเริ่มต้น: ชิดขวา 1" จากขอบขวา · 0.5" จากขอบบน · เริ่มนับที่ startPage ของไฟล์นั้น)
    //
    // [alpha.83 ข้อ 5] **ตัดกิ่งสำรองทิ้ง** — เดิมเมื่อปิดสวิตช์เลขหน้า โค้ดจะตกไปพิมพ์
    // `pg.index + '.'` ให้ทุกหน้าตั้งแต่หน้า 2 อยู่ดี → ผู้ใช้ปิดเลขหน้าแล้วเลขไม่หาย
    // ("ติดตายเลย เอาออกไม่ได้") และหน้า 1 **ไม่เคยได้เลข** ไม่ว่าจะตั้งค่ายังไง
    // ตอนนี้มีกฎเดียว: `pageNumberLabel()` ซึ่งอ่าน show/firstPage/suffix/startPage ชุดเดียว
    const label = opts.showPageNumbers === false
      ? '' : pageNumberLabel(pg.index, f, opts.startPage);
    if (label) {
      const num = document.createElement('div');
      num.className = 'sp-page-num';
      // ตำแหน่งเป็น "โอเวอร์เลย์" เสมอ — วัดจากขอบกระดาษจริง ไม่กินที่ในสายเนื้อหา
      num.style.top = cssIn(f.pageNumbers.top);
      num.style.right = cssIn(f.pageNumbers.right);
      num.textContent = label;
      page.append(num);
    }
    // [alpha.87] CONTINUED = **โอเวอร์เลย์ในระยะขอบ** เหมือนเลขหน้า ไม่ใช่บล็อกในเนื้อหน้า
    // (paginate() ไม่จองบรรทัดให้ → ถ้าวาดในสายเนื้อหาจะเกินความจุแล้วกระดาษยืด)
    const cbox = continuedBox(f);
    const putCont = (which, text) => {
      const d = document.createElement('div');
      d.className = 'sp-cont-page sp-continued-' + which;
      d.style.left = cssIn(cbox.left);
      d.style.width = cssIn(cbox.width);
      d.style[which === 'top' ? 'top' : 'bottom'] = cssIn(which === 'top' ? cbox.topIn : cbox.bottomIn);
      d.textContent = text;
      page.append(d);
    };
    if (pg.continuedTop) putCont('top', pg.continuedTop);
    // ══ [alpha.134 · X-1] ★ หัวกระดาษ = **บล็อกในสายเนื้อหา** ไม่ใช่โอเวอร์เลย์ ══
    //
    // ผู้ใช้: *"ตัวเลือก PDF ใช้ไม่ได้เลย"* (ฝั่งบทภาพยนตร์)
    //
    // ตัวสร้าง PDF หักบรรทัดให้หัวกระดาษด้วย `linesForBody()` แล้วดันเนื้อหาลงมา —
    // ช่องตัวอย่างจึงต้องกินที่แบบเดียวกัน ไม่งั้นเนื้อหาบนจอสูงกว่าไฟล์อยู่ 1+N บรรทัด
    // (ผู้เรียกต้องส่ง `lines: linesForBody(...)` ให้ `pagesOf` ด้วย — สองอย่างนี้มาคู่กันเสมอ)
    const hdrRows = typeof opts.headerRows === 'function' ? opts.headerRows(pg.index) : null;
    if (hdrRows && hdrRows.length) {
      const hd = document.createElement('div');
      hd.className = 'sp-hdr';
      hd.style.cssText = 'position:relative;height:1em;white-space:nowrap;'
        + 'margin:0 0 ' + Math.max(0, num(opts.headerGapLines, 1)) + 'em 0';
      for (const r of hdrRows) {
        const sp = document.createElement('span');
        const side = r.align === 'right' ? 'right' : r.align === 'center' ? 'center' : 'left';
        const off = num(r.xOffset, 0);
        // xOffset เป็นบวก = ขยับไปทางขวา → ฝั่งขวาต้อง "ลดระยะจากขอบขวา" (กฎเดียวกับ headerHtml)
        sp.style.cssText = 'position:absolute;top:0;'
          + (side === 'center' ? 'left:50%;transform:translateX(calc(-50% + ' + off + 'in))'
            : side === 'right' ? 'right:' + (+(-off).toFixed(4)) + 'in'
              : 'left:' + off + 'in')
          + (r.bold ? ';font-weight:700' : '')
          + (r.italic ? ';font-style:italic' : '')
          + (r.underline ? ';text-decoration:underline' : '');
        sp.textContent = r.text;
        hd.append(sp);
      }
      page.append(hd);
    }
    for (const b of pg.blocks || []) {
      const d = document.createElement('div');
      d.className = 'sp sp-' + (b.el || 'action');
      if (Number.isFinite(b.pos)) d.dataset.pos = String(b.pos);
      d.textContent = b.text || '';
      // [alpha.132r] ช่องตัวอย่างต้องบอกได้ว่าเลือก "สี" แล้วไฟล์จะออกมาหน้าตายังไง
      // -> ผู้เรียกส่ง `colorOf(el)` มาให้ ซึ่งอ่านจาก **จานสีเดียวกับที่ pdf-lib วาดจริง**
      // (ไม่ import pdf-generator เข้ามาที่นี่ — ไฟล์นี้เป็นตัววาดหน้าจอล้วน ๆ)
      if (typeof opts.colorOf === 'function') {
        const c = opts.colorOf(b.el || 'action');
        if (c) d.style.color = c;
      }
      // [alpha.57a] เลขฉากสองฝั่ง (ตำแหน่งมาจาก .k-scene-no-l/.k-scene-no-r ใน spCss)
      if (b.el === 'scene' && b.sceneNo && f.sceneNumbers && f.sceneNumbers.show) {
        for (const side of ['l', 'r']) {
          const s = document.createElement('span');
          s.className = 'k-scene-no k-scene-no-' + side;
          s.textContent = String(b.sceneNo) + (f.sceneNumbers.suffix || '');
          d.append(s);
        }
      }
      page.append(d);
    }
    // [alpha.87 ข้อ 4] บล็อกแรกของหน้า **ไม่มีระยะเว้นนำ** — ตรงกับ paginate() ที่ตั้ง
    // `before = 0` เมื่อหน้ายังว่าง (`cur.length === 0`) · ถ้าไม่ตัด หน้าที่ขึ้นด้วยหัวฉาก
    // จะล้นไป 2 บรรทัด (วัดจริง: 32px) ทั้งที่จำนวนบรรทัดในโมเดลยังไม่เกินโควตา
    const firstBlock = page.querySelector('.sp');
    // [alpha.112] ตัด padding แล้วต้องตัด `--k-pad` ด้วย ไม่งั้นเลขฉากของหัวฉากที่เป็น
    // บรรทัดบนสุดของหน้าไปลอยคนละบรรทัดกับตัวมันเอง (บทเรียนเดียวกับ alpha.102 บั๊ก 1
    // ซึ่งแก้ไว้เฉพาะฝั่งตัวแก้ไข แต่ตกมุมมองหน้าคู่/ภาพรวมไว้)
    if (firstBlock) { firstBlock.style.paddingTop = '0'; firstBlock.style.setProperty('--k-pad', '0'); }
    if (pg.continuedBottom) putCont('bottom', pg.continuedBottom);
    // [alpha.134 · X-1] ลายน้ำ — ตัวสร้าง PDF วาดกลางหน้าเอียง -35° จาง ๆ · ตัวอย่างต้องเห็นด้วย
    const wm = String(opts.watermark || '').trim();
    if (wm) {
      const w = document.createElement('div');
      w.className = 'sp-page-wm';
      w.textContent = wm;
      page.append(w);
    }
    slot.append(page);
    host.append(slot);
    els.push(page);
  }
  return { pages: els, scale, perRow: opts.perRow ?? 0 };
}

/** ข้อความสรุปมุมมองปัจจุบัน (แถบสถานะ) */
export function viewStatusText(mode, pageCount) {
  const name = SP_VIEW_LABELS[mode] || SP_VIEW_LABELS.normal;
  return Number.isFinite(pageCount) ? tf('ui.common.viewPage', name, pageCount) : t('ui.common.view2') + name;
}

export { textWidth };
