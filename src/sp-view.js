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
         clampLineHeight } from './sp-format.js';
import { num } from './num.js';

// ───────── รายการโหมด ─────────
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
export const SP_VIEW_CLASS = {
  normal: '',
  layout: 'sp-view-layout',
  draft: 'sp-view-draft',
  side: 'sp-view-side',
  overview1: 'sp-view-overview sp-view-ov1',
  overview4: 'sp-view-overview sp-view-ov4',
};
export const ALL_VIEW_CLASSES = ['sp-view-layout', 'sp-view-draft', 'sp-view-side',
                                 'sp-view-overview', 'sp-view-ov1', 'sp-view-ov4'];
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
    const blank = el === 'action' && !text.trim();
    const b = { el: blank ? 'blank' : el, text, pos: offset, idx: i++ };
    if (b.el === 'scene') b.sceneNo = ++scene;      // [alpha.57a] เลขฉากไล่ตามลำดับในไฟล์
    out.push(b);
  });
  return out;
}

// ───────── 78. หาตำแหน่งของหน้า / ฉาก ─────────
/** ตำแหน่งเริ่มต้นของแต่ละหน้า (index 0 = หน้า 1) — บล็อกแรกของหน้าที่มี pos จริง */
export function pageStartPositions(pages) {
  const list = (pages && pages.pages) || pages || [];
  return list.map((pg) => {
    const b = (pg.blocks || []).find((x) => Number.isFinite(x && x.pos));
    return b ? b.pos : null;
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
    page.style.minHeight = cssIn(ph);
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
    if (pg.continuedTop) {
      const ct = document.createElement('div');
      ct.className = 'sp-continued-top';
      ct.textContent = pg.continuedTop;
      page.append(ct);
    }
    for (const b of pg.blocks || []) {
      const d = document.createElement('div');
      d.className = 'sp sp-' + (b.el || 'action');
      if (Number.isFinite(b.pos)) d.dataset.pos = String(b.pos);
      d.textContent = b.text || '';
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
    if (pg.continuedBottom) {
      const cb = document.createElement('div');
      cb.className = 'sp-continued-bottom';
      cb.textContent = pg.continuedBottom;
      page.append(cb);
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
