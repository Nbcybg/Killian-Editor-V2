// prose-view.js — โหมดมุมมองของ "นิยาย" (alpha.58r · บั๊ก 15 + 20)
//
// เดิมมุมมองหน้ากระดาษ (ปกติ/จัดหน้า/ร่าง/เรียงหน้าคู่/ภาพรวม 1px-4px) มีเฉพาะโหมดบทภาพยนตร์
// คนเขียนนิยายจึงไม่รู้เลยว่าตัวเองอยู่หน้าไหน · ขึ้นหน้าใหม่ตรงไหน
// ไฟล์นี้ทำสิ่งเดียวกันให้นิยาย โดยใช้ "คลาสของ pane ชุดเดียวกัน" (sp-view-*) เพื่อไม่ต้องซ้ำ CSS
//
// ส่วนคำนวณบริสุทธิ์ (ทดสอบด้วย node ได้) · ส่วนที่แตะ DOM = renderProsePageView + plugin เส้นคั่นหน้า

import { t, tf } from './i18n.js';
// [alpha.132r] ตัวกรองค่าสี — ตัวเดียวกับตัวแก้ไข/ไฟล์ .md
import { normColor } from './text-color.js';
import { mergeProseFormat, paginateProse, proseMetrics, prosePageLabel,
         proseFontStack, proseHeadingStack, proseLinePx, proseFontPx } from './prose-format.js';
import { PAPER_SIZES, MARGIN_DEFAULTS } from './sp-format.js';
import { num } from './num.js';
import { createPageBreakPlugin } from './page-break-plugin.js';

// ───────── รายการโหมด (ชื่อเดียวกับบทภาพยนตร์ เพื่อให้เมนู/คลาส CSS ใช้ร่วมกันได้) ─────────
export const PROSE_VIEWS = ['normal', 'layout', 'draft', 'side', 'overview1', 'overview4'];
export const PROSE_VIEW_LABELS = {
  normal:    t('ui.common.normalPagePaper'),
  layout:    t('ui.common.arrangePageSeePage'),
  draft:     t('ui.common.draftTextDraft'),
  side:      t('ui.common.pagePairSideBy'),
  overview1: t('ui.common.overviewPxChar'),
  overview4: t('ui.common.overviewPxChar2'),
};
export const isValidProseView = (m) => PROSE_VIEWS.includes(m);
export const isProsePageView = (m) => m === 'side' || m === 'overview1' || m === 'overview4';
export const isProseEditView = (m) => !isProsePageView(m);

/** ตัวแปร CSS ของ Layout View ฝั่งนิยาย */
export function proseLayoutCssVars(fmt, paper, margins, gapPx = 28) {
  const mt = proseMetrics(fmt, paper, margins);
  return {
    '--ed-body-h': mt.bodyHeightPx + 'px',
    '--ed-page-gap': Math.max(8, Math.round(gapPx)) + 'px',
    '--ed-line-h': mt.lineHeightPx + 'px',
  };
}

/** หน้าของเอกสารนิยาย (ตัวช่วยสั้น ๆ ให้ app.js เรียกที่เดียว) */
export function prosePagesOf(blocks, fmt, paper, margins) {
  return paginateProse(blocks, { fmt, paper, margins });
}

// ───────── เส้นคั่นหน้าในตัวแก้ไขนิยาย (widget decoration) ─────────
// แยกคีย์/สถานะจาก spPageBreakPlugin เพราะ KEditor กับ SPEditor เปิดพร้อมกันได้คนละแท็บ
const ED_PB = createPageBreakPlugin({
  key: 'kedpagebreak', cls: 'sp-page-break ed-page-break', decoKey: 'edpb',
});
/** ตั้งรายการเส้นคั่นหน้าของนิยาย — คืน true เมื่อเปลี่ยนจริง (บทเรียน 44: อย่า dispatch ซ้ำ) */
export const setProsePageBreaks = ED_PB.setBreaks;
export const prosePageBreaks = ED_PB.breaks;
/** [alpha.83 ข้อ 4] ตัวทำ "เลขหน้าจริง" บนหน้าถัดไปของเส้นคั่นแต่ละเส้น */
export const setProsePageNumberLabel = ED_PB.setNumberLabel;
export const prosePageBreakPlugin = ED_PB.plugin;
/** [alpha.93 ข้อ 5] ทาที่ว่างท้ายหน้าลงกล่องเส้นคั่นที่วาดแล้ว (ไม่ผ่าน ProseMirror) */
export const applyProsePagePads = ED_PB.applyPads;
export const refreshProsePageBreaks = ED_PB.refresh;

// ───────── การวาดหน้ากระดาษจริง (side / overview) ─────────
const cssIn = (v) => num(v, 0) + 'in';

/**
 * วาดหน้ากระดาษนิยายลง host (DOM) — โครงเดียวกับ renderPageView ของบทภาพยนตร์
 * @returns {{pages:HTMLElement[], scale:number, perRow:number}}
 */
/**
 * == [alpha.132r] ** ใส่ข้อความลงบล็อกของช่องตัวอย่าง โดยรู้จัก "สีตัวอักษร" ==
 *
 * ผู้ใช้: *"สีก็ยังไม่มีสีเลย ยังเป็นขาวดำอยู่"*
 *
 * บล็อกของช่องตัวอย่างมาจาก `mdToProseBlocks()` ซึ่งเก็บ **ข้อความ .md ดิบ** ไว้ทั้งบรรทัด
 * -> สแปนสี (`<span style="color:#rrggbb">`) เคยถูกยัดลง `textContent` ตรง ๆ
 *    = ผู้ใช้เห็นโค้ดเป็นตัวหนังสือกลางหน้ากระดาษ และไม่เห็นสีเลยสักจุด
 *
 * ที่นี่จึงแยกสแปนออกเป็นโหนดจริง (ไม่ใช้ innerHTML — ค่าสีมาจากไฟล์ที่แก้นอกโปรแกรมได้)
 * · โหมดขาวดำ = ทิ้งสีแต่เก็บข้อความ ตรงกับที่ไฟล์จริงทำ
 * @param {boolean} mono true = ขาวดำ
 */
function putProseText(node, text, mono) {
  const s = String(text == null ? '' : text);
  if (!RE_COLOR_SPAN.test(s)) { node.textContent = s; return; }
  RE_COLOR_SPAN.lastIndex = 0;
  let last = 0, m;
  while ((m = RE_COLOR_SPAN.exec(s))) {
    if (m.index > last) node.append(document.createTextNode(s.slice(last, m.index)));
    const hex = normColor(m[1]);
    if (hex && !mono) {
      const sp = document.createElement('span');
      sp.style.color = hex;
      sp.textContent = m[2];
      node.append(sp);
    } else {
      node.append(document.createTextNode(m[2]));
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) node.append(document.createTextNode(s.slice(last)));
}
const RE_COLOR_SPAN = /<span style="color:([^"<>]{1,32})">([\s\S]*?)<\/span>/g;

export function renderProsePageView(host, pages, fmt, opts = {}) {
  // [alpha.132r] ขาวดำ = บังคับดำทั้งแผ่น (กฎอยู่ใน style.css คู่กับคลาสนี้)
  const mono = opts.colorMode ? opts.colorMode !== 'color' : false;
  host.classList.toggle('pv-mono', mono);
  const f = fmt && fmt.headings ? fmt : mergeProseFormat(fmt);
  const paper = opts.paper || PAPER_SIZES.letter;
  const m = { ...MARGIN_DEFAULTS, ...(opts.margins || {}) };
  const list = (pages && pages.pages) || pages || [];
  const scale = opts.scale ?? 1;
  const gap = opts.gap ?? 20;
  const pw = +paper.width, ph = +paper.height;
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
    page.className = 'sp-page ed-page';
    page.dataset.page = String(pg.index);
    page.style.width = cssIn(pw);
    // [alpha.87 ข้อ 2+4] **height ไม่ใช่ min-height** — กระดาษต้องสูงเท่ากันทุกแผ่น
    // min-height ปล่อยให้แผ่นที่เนื้อเกินความจุ "ยืด" ออกไป = เรนเดอร์ไม่เท่ากัน
    // (ฝั่งบทแก้ที่ sp-view.js ด้วยเหตุผลเดียวกัน · ตัววาดหน้าหน้าเล่มใช้ height อยู่แล้ว)
    page.style.height = cssIn(ph);
    page.style.paddingTop = cssIn(m.top);
    page.style.paddingBottom = cssIn(m.bottom);
    page.style.paddingLeft = cssIn(m.left);
    page.style.paddingRight = cssIn(m.right);
    page.style.transform = 'scale(' + scale + ')';
    page.style.fontFamily = proseFontStack(f);
    page.style.fontSize = proseFontPx(f) + 'px';
    page.style.lineHeight = String(f.lineHeight);

    // [alpha.83 ข้อ 4+5] ป้ายเลขหน้ามาจาก **ผู้เรียก** เป็นหลัก (`opts.label`) เพื่อให้
    // ทุกมุมมองของนิยาย — ตัวแก้ไข · จัดหน้า · เรียงหน้า · ตัวอย่างส่งออก — ใช้กฎเดียวกันเป๊ะ
    // เดิมที่นี่มีกฎของตัวเอง (`pg.index > 1`) ซึ่งไม่ตรงกับตัวแก้ไข ผู้ใช้จึงเห็นเลข
    // "โผล่บ้างหายบ้าง" แล้วแต่ว่าอยู่มุมมองไหน
    const start = Math.max(1, Math.round(+opts.startPage || 1));
    const label = typeof opts.label === 'function'
      ? String(opts.label(pg.index) ?? '')
      : (opts.showPageNumbers === undefined
          ? prosePageLabel(pg.index, f, opts.startPage)
          : (opts.showPageNumbers && (pg.index > 1 || opts.numberFirst !== false)
              ? String(start + pg.index - 1) : ''));
    if (label) {
      const n = document.createElement('div');
      n.className = 'sp-page-num';
      // โอเวอร์เลย์เสมอ — ระยะจากขอบกระดาษจริง (ไม่ดันเนื้อหาลง ดูบั๊กข้อ 2)
      n.style.top = cssIn(num(opts.numTop, 0.5));
      n.style.right = cssIn(num(opts.numRight, 1));
      n.textContent = label;
      page.append(n);
    }
    for (const b of pg.blocks || []) {
      const type = b.type || 'p';
      let d;
      if (type === 'hr') { d = document.createElement('hr'); }
      else if (/^h[1-6]$/.test(type)) {
        d = document.createElement(type);
        d.style.fontSize = ((f.headings[+type[1] - 1] || f.headings[0]).size) + 'em';
        d.style.fontFamily = proseHeadingStack(f);
        // [alpha.132r] สีหัวข้อที่ผู้ใช้ตั้งไว้ต้องเห็นในตัวอย่างด้วย (โหมดสีเท่านั้น)
        if (!mono && f.headingColor) d.style.color = f.headingColor;
        putProseText(d, b.text, mono);
      } else if (type === 'blockquote') {
        d = document.createElement('blockquote');
        if (!mono && f.quote && f.quote.color) d.style.color = f.quote.color;
        putProseText(d, b.text, mono);
      } else if (type === 'figure') {
        d = document.createElement('div');
        d.className = 'pv-figure';
        d.textContent = '🖼 ' + (b.alt || t('ui.prose.image'));
      } else {
        d = document.createElement('p');
        d.style.textIndent = f.firstLineIndent + 'in';
        d.style.marginBottom = f.paraSpacing + 'em';
        putProseText(d, b.text, mono);
        // [alpha.132r] ย่อหน้าว่างต้องมี **กล่องบรรทัดจริง** ไม่งั้นสูง 0 แล้วหายไปจากหน้า
        // (ตรงกับที่ `mdToHtmlBody` ใส่ `<br>` ให้ `<p class="k-blank">` ในไฟล์จริง)
        if (!d.textContent) { d.classList.add('pv-blank'); d.append(document.createElement('br')); }
      }
      d.classList.add('pv-block');
      if (Number.isFinite(b.pos)) d.dataset.pos = String(b.pos);
      page.append(d);
    }
    slot.append(page);
    host.append(slot);
    els.push(page);
  }
  return { pages: els, scale, perRow: opts.perRow ?? 0 };
}

/** ข้อความสรุปมุมมองปัจจุบัน (แถบสถานะ) */
export function proseViewStatusText(mode, pageCount) {
  const name = PROSE_VIEW_LABELS[mode] || PROSE_VIEW_LABELS.normal;
  return Number.isFinite(pageCount) ? tf('ui.common.viewPage', name, pageCount) : t('ui.common.view2') + name;
}

export { proseLinePx };
