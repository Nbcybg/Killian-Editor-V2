// read-ui.js — [alpha.141] โหมด "อ่านทั้งเล่ม" + สายหน้าที่ตัวไล่เลขหน้าใช้ร่วม
//
// ═══ ผู้ใช้ขออะไร ═══
//   1. "เพิ่ม อ่านทั้งเล่ม ลงไปใน properties ของเล่ม และในจัดการเล่ม"
//   2. "อ่านทั้งเล่มคือโหมดอ่านที่อ่านทั้ง project ตั้งแต่หน้าปกจนถึงหน้าสุดท้าย ต้องแสดงหน้าปกด้วย"
//   3. "เลขหน้าควรไล่ต่อกันได้ เพราะเรามีลำดับของฉากและบทอยู่แล้ว"
//   4. "หน้าปกของบทต้องถูกนับเป็นหน้าด้วย"
//
// ═══ ทำไมเขียนรวมไว้ไฟล์เดียว ═══
// ข้อ 2 กับข้อ 3 **คือการคำนวณเดียวกัน**: ต้องรู้ว่าทั้งเล่มถูกหั่นเป็นหน้าอย่างไร
// ถ้าโหมดอ่านหั่นหน้าแบบหนึ่ง แล้วตัวไล่เลขหน้าคิดอีกแบบ ผู้ใช้จะเจอ "เลขในโหมดอ่านไม่ตรงกับ
// เลขบนกระดาษ" ซึ่งเป็นบั๊กตระกูลเดียวกับที่ไล่กันมาตั้งแต่ .81r (กฎถาวรข้อ 5)
// ที่นี่จึงมี **ทางเดียว**: `buildBookDoc()` → `measureBookDoc()` → ผลลัพธ์ก้อนเดียว
// ที่ทั้งโหมดอ่านและ `currentStartPage()` หยิบไปใช้
//
// เอนจินที่ใช้เป็นตัวเดียวกับมุมมองจัดหน้าและช่องตัวอย่างส่งออกทุกตัว:
//   `mdToHtmlBody()` (md.js ผ่าน compile.js) · `proseExportCss()` · `measureProseBlocks()`
//   · `sliceProsePages()` · `renderProseClipPages()` · `pageNumberLabel()`
// ไม่มีตัวแปลง/ตัวจัดหน้าตัวที่สองในไฟล์นี้เลยแม้แต่ตัวเดียว

import { t, tf } from './i18n.js';
import { el, log, setStatus, state, withBusy } from './core.js';
import { escapeHtml, mdToHtmlBody } from './compile.js';
import { projectImageUrl } from './file-url.js';
import { mergeProseFormat, proseExportCss } from './prose-format.js';
import { liveProseFonts } from './live-fonts.js';   // [alpha.160 · P1-8]
import { pageNumberLabel } from './sp-format.js';
import { DPI, measureProseBlocks, renderProseClipPages, sliceProsePages, withMeasureMode,
         whenImagesReady, afterLateImages } from './prose-measure.js';
import { XPV_CLASS, XPV_SEL, scopeCss } from './prose-export-view.js';
import { bookParts, coverPagesOf, isCoverPart, pageIndexOfY, printedPageNumber,
         projectParts, startPageMap } from './book-flow.js';
import { listSections } from './section-ops.js';
import { listDraftsForSection } from './drafts.js';
import { buildDraftModel, proseFormat, spFormat } from './app.js';
import { gi } from './icons.js';
import { createEpoch, runFresh } from './epoch-guard.js';   // [alpha.161 · C1]

// ───────────────────────── เก็บเนื้อหาของเล่ม ─────────────────────────

/** path ของ "ร่างหลัก" ของเล่ม — โหมดอ่านต้องอ่านร่างเดียวกับที่ Explorer แสดง */
async function primaryDraftPath(secPath) {
  const drafts = await listDraftsForSection(secPath);
  if (!drafts.length) return '';
  return (drafts.find((d) => d.primary) || drafts[0]).dPath;
}

/** แปลง path รูปสัมพัทธ์ (`../Images/x.png` หรือ `Images/x.png`) เป็น file:// */
async function coverUrl(rel, baseDir) {
  const r = String(rel || '').trim();
  if (!r) return '';
  try {
    for (const base of [baseDir, state.root]) {
      if (!base) continue;
      const abs = await kapi.resolve(base, r);
      if (await kapi.exists(abs)) return kapi.toFileURL(abs);
    }
    // ลิงก์เก่านับชั้นผิด → หาในคลังรูปจากชื่อไฟล์ (ทางเดียวกับ resolveImg ของตัวแก้ไข)
    const abs2 = await kapi.join(state.root, 'Images', r.split(/[\\/]/).pop());
    if (await kapi.exists(abs2)) return kapi.toFileURL(abs2);
  } catch (e) { log('warn', t('ui.readbook.coverReadFail'), e); }
  return '';
}

/**
 * รวบรวมเล่ม (พร้อมบท/ฉาก/ปก) ให้พร้อมเข้า `bookParts()`
 * @param {string} [onlySecPath] ระบุ = เล่มเดียว · ไม่ระบุ = ทุกเล่มในโปรเจกต์
 */
export async function collectBooks(onlySecPath) {
  const secs = await listSections();
  const want = onlySecPath ? secs.filter((s) => s.secPath === onlySecPath) : secs;
  const out = [];
  for (const s of want) {
    const dPath = await primaryDraftPath(s.secPath);
    if (!dPath) continue;
    const model = await buildDraftModel(dPath, s.title);
    // แถวบทตัวจริง (draft.json) — โมเดลส่งออกไม่ได้พา `cover` ของบทมาด้วย
    let rows = [];
    try { rows = (await kapi.readJson(await kapi.join(dPath, 'draft.json'))).chapters || []; } catch {}
    const coverOf = new Map(rows.map((c) => [c.guid, c.cover]));
    const chapters = [];
    for (const c of model.chapters || []) chapters.push({ ...c, cover: coverOf.get(c.guid) });
    out.push({ key: s.folder, secPath: s.secPath, dPath, meta: s.meta,
               title: s.title || model.title, author: model.author || '', chapters });
  }
  return out;
}

// ───────────────────────── ประกอบเอกสารทั้งเล่ม ─────────────────────────

const esc = (s) => escapeHtml(s == null ? '' : String(s));

/** CSS ของหน้าปก/หัวบท — เขียนแบบไม่ผูกกับ `body` เพื่อให้ `scopeCss()` จำกัดขอบเขตได้ตามปกติ */
function readerCss(contentH) {
  return [
    '.k-rd-cover{box-sizing:border-box;margin:0;padding:0;overflow:hidden;height:' + contentH + 'px;'
      + 'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}',
    '.k-rd-cover-img{max-width:100%;max-height:58%;object-fit:contain;margin-bottom:.35in}',
    // [alpha.142 ข้อ 1] ปกที่ "ใช้ภาพเต็มหน้า" — รูปกินพื้นที่พิมพ์ทั้งผืน ไม่มีข้อความทับ
    // `object-fit:cover` = เต็มกรอบเสมอ ไม่มีแถบขาว (ส่วนที่ล้นถูกเฉือน — hint บอกอัตราส่วนไว้แล้ว)
    '.k-rd-cover-full{display:block;padding:0}',
    '.k-rd-cover-full .k-rd-cover-img{width:100%;height:100%;max-width:none;max-height:none;'
      + 'object-fit:cover;margin:0;display:block}',
    '.k-rd-cover-title{font-size:2.1em;font-weight:700;line-height:1.25;text-indent:0}',
    '.k-rd-cover-sub{font-size:1.15em;margin-top:.24in;opacity:.85;text-indent:0}',
    '.k-rd-cover-text{font-size:1em;margin-top:.3in;line-height:1.6;white-space:pre-wrap;text-indent:0}',
    '.k-rd-chap{text-align:center}',
    '.k-rd-sep{border:0;height:1.4em;text-align:center}',
  ].join('\n');
}

/** HTML ของหนึ่งส่วน — ปก/หัวบทบังคับขึ้นหน้าใหม่ด้วย `.pb` (ธงเดียวกับ Ctrl+Enter ของตัวแก้ไข) */
function partHtml(p, first) {
  const brk = first ? '' : '<div class="pb"></div>';
  if (isCoverPart(p)) {
    // ★ มีรูป + ติ๊ก "ใช้ภาพเต็มหน้า" = รูปล้วนเต็มแผ่น ไม่มีชื่อเรื่องทับ (ค่าเริ่มต้น)
    // ไม่มีรูป = ตกกลับเป็นปกข้อความเสมอ ไม่งั้นได้หน้าว่างเปล่าโดยไม่มีใครเห็นว่าทำไม
    if (p.full !== false && p.imageUrl) {
      return brk + '<section class="k-rd-cover k-rd-cover-full">'
        + '<img class="k-rd-cover-img" src="' + esc(p.imageUrl) + '" alt=""></section>';
    }
    const inner = [];
    if (p.imageUrl) inner.push('<img class="k-rd-cover-img" src="' + esc(p.imageUrl) + '" alt="">');
    inner.push('<div class="k-rd-cover-title">' + esc(p.title) + '</div>');
    if (p.subtitle) inner.push('<div class="k-rd-cover-sub">' + esc(p.subtitle) + '</div>');
    if (p.text) inner.push('<div class="k-rd-cover-text">' + esc(p.text) + '</div>');
    return brk + '<section class="k-rd-cover">' + inner.join('') + '</section>';
  }
  if (p.kind === 'chapterHead') return brk + '<h1 class="k-rd-chap">' + esc(p.title) + '</h1>';
  // ฉาก — ผ่านตัวแปลง .md ตัวเดียวของทั้งโปรแกรม (ห้ามมีตัวที่สอง · กฎถาวรข้อ 5)
  // [alpha.149] รูปในเนื้อฉากต้องเป็น URL เต็ม — HTML นี้วางในหน้าโปรแกรม path สัมพัทธ์กับไฟล์ฉาก
  // จึงถูกนับจาก renderer/index.html (log จริง: `file:///C:/Images/sunset.png`) = รูปหายทั้งเล่ม
  return (p.sep ? '<hr class="k-rd-sep">' : '')
    + mdToHtmlBody(p.body || '', { imgSrc: (s) => projectImageUrl(state.root, s) });
}

/**
 * ประกอบเอกสาร "ทั้งเล่ม" เป็น HTML ก้อนเดียว
 * @returns {Promise<{html:string, css:string, parts:Array, contentH:number, paper:object, margins:object}>}
 */
export async function buildBookDoc(books) {
  const spf = spFormat();
  const pf = proseFormat();
  const paper = spf.paper, margins = spf.margins;
  const contentH = Math.max(8, (+paper.height - +margins.top - +margins.bottom) * DPI);
  const parts = books.length === 1 ? bookParts(books[0]) : projectParts(books);
  const byKey = new Map(books.map((b) => [b.key, b]));
  // ฉากที่สองเป็นต้นไปในบทเดียวกัน = มีเส้นคั่นฉาก (เหมือนพรีเซ็ต "หนังสือ" ของเวิร์กโฟลว์ส่งออก)
  let lastCh = null;
  for (const p of parts) {
    if (p.kind !== 'scene') { lastCh = null; continue; }
    p.sep = lastCh === p.guid;
    lastCh = p.guid;
  }
  // รูปปก — resolve เป็น file:// ก่อนประกอบ HTML (ไม่งั้นรูปไม่ขึ้นแล้วความสูงเพี้ยน)
  for (const p of parts) {
    if (!isCoverPart(p) || !p.image) continue;
    const b = byKey.get(p.book);
    p.imageUrl = await coverUrl(p.image, b ? b.secPath : state.root);
  }
  const html = parts.map((p, i) => partHtml(p, i === 0)).join('\n');
  // [alpha.160 · P1-8] ★ วัดหน้าด้วยฟอนต์ **ตัวเดียวกับจอ** — เดิมไม่ส่งสแตกเลย → ตกไปฟอนต์ตาม proseFormat
  // (ไม่ใช่ `--ed-font` = withLangFamily(settings.fontFamily…) ที่ตัวแก้ไขใช้) = เลขหน้าไล่ต่อเนื่องเพี้ยน
  const css = proseExportCss(mergeProseFormat(pf), paper, margins, liveProseFonts()) + '\n' + readerCss(contentH);
  return { html, css, parts, contentH, paper, margins };
}

/**
 * รอรูปในเอกสารโหลดให้เสร็จก่อนวัด — วัดก่อนรูปมา = ความสูงผิดทั้งเล่ม
 * [alpha.143 ข้อ 1] ตัวจริงย้ายไปอยู่ `prose-measure.js` แล้ว (ทุกสายที่วัดหน้าต้องใช้ตัวเดียวกัน)
 */
const waitImages = (root, ms = 2500) => whenImagesReady(root, ms) || Promise.resolve();

/**
 * วัดของจริง → หั่นหน้า → บอกว่าแต่ละส่วนเริ่มหน้าไหน
 *
 * ผู้เรียกเป็นเจ้าของ `meas` (ต้องเรียก `dispose()` เมื่อเลิกใช้) เพราะตัววาดหน้ากระดาษ
 * โคลนจากมันทีละหน้า — ถอดออกจาก DOM ก่อน = ไม่มีอะไรให้โคลน
 * @returns {Promise<{meas:HTMLElement, styleEl:HTMLElement, pages:Array, parts:Array, dispose:Function}>}
 */
export async function measureBookDoc(doc, opts = {}) {
  const styleEl = document.createElement('style');
  styleEl.textContent = scopeCss(doc.css, XPV_SEL);
  document.head.append(styleEl);

  const meas = document.createElement('div');
  meas.className = XPV_CLASS;
  const textW = Math.max(0.5, +doc.paper.width - +doc.margins.left - +doc.margins.right);
  meas.style.cssText = 'position:fixed;left:-30000px;top:0;visibility:hidden;'
                     + 'width:' + textW + 'in;max-width:none;margin:0;padding:0;';
  meas.innerHTML = doc.html;
  document.body.append(meas);
  // ★ ตีตราว่าลูกคนไหนเป็นของส่วนไหน — ทำบน DOM ตัวจริงหลังพาร์ส ไม่ใช่ตอนต่อสตริง
  // (ต่อสตริงแล้วนับเองไม่ได้ เพราะเบราว์เซอร์อาจแก้โครงสร้างที่ผิดรูปให้)
  {
    const kids = [...meas.children];
    let i = 0;
    for (let pi = 0; pi < doc.parts.length; pi++) {
      const tpl = document.createElement('template');
      tpl.innerHTML = partHtml(doc.parts[pi], pi === 0);
      const n = tpl.content.children.length;
      for (let k = 0; k < n && i < kids.length; k++, i++) kids[i].dataset.k2part = String(pi);
    }
  }
  // [alpha.160] ผู้เรียกเบื้องหลัง (ตัวไล่เลขหน้า) รอรูปได้นานกว่า — ไม่มีใครนั่งรอหน้าจออยู่
  await waitImages(meas, opts.imgWaitMs || 2500);

  let pages = [];
  let blocks = [];
  try {
    pages = withMeasureMode(() => {
      const origin = meas.getBoundingClientRect().top;
      const m = measureProseBlocks(meas, origin, 1);
      blocks = m.blocks;
      if (!blocks.length) return [];
      return sliceProsePages(blocks, doc.contentH, m.totalHeight)
        .map((p, i) => ({ ...p, index: i + 1 }));
    });
  } catch (e) { log('warn', t('ui.readbook.measureFail'), e); }
  if (!pages.length) pages = [{ start: 0, end: doc.contentH, index: 1 }];

  // ส่วนไหนเริ่มที่พิกัด Y เท่าไร → เลขหน้าของส่วนนั้น
  const topOf = new Map();
  for (const b of blocks) {
    const k = b.el && b.el.dataset ? b.el.dataset.k2part : undefined;
    if (k === undefined || topOf.has(k)) continue;
    topOf.set(k, b.top);
  }
  // ★ [alpha.142 ข้อ 2] สองเลขคนละเรื่องกัน — `page` = แผ่นที่เท่าไร · `startPage` = เลขที่พิมพ์
  // หน้าปกเล่มกินแผ่นจริงแต่ไม่มีเลข → ทุกแผ่นหลังจากนั้นเลขเลื่อนลงหนึ่ง
  const withPhys = doc.parts.map((p, i) => {
    const y = topOf.has(String(i)) ? topOf.get(String(i)) : null;
    return { ...p, page: y === null ? 1 : pageIndexOfY(pages, y) };
  });
  const coverPages = coverPagesOf(withPhys);
  const parts = withPhys.map((p) => ({ ...p, startPage: printedPageNumber(coverPages, p.page) }));
  // [alpha.142r] แผ่นไหนต้องทาภาพเต็มแผ่น (ชนขอบกระดาษ) — ปกที่ติ๊ก "ใช้ภาพเต็มหน้า" และมีรูปจริง
  const bleed = new Map();
  for (const p of parts) {
    if (isCoverPart(p) && p.full !== false && p.imageUrl) bleed.set(p.page, p.imageUrl);
  }
  const dispose = () => { meas.remove(); styleEl.remove(); };
  return { meas, styleEl, pages, blocks, parts, coverPages, bleed, dispose };
}

// ───────────────────────── แคชสายหน้า (ตัวไล่เลขหน้าใช้) ─────────────────────────

// [alpha.160 · P1-12] ★ แคช "ต่อเล่ม" — เดิมเก็บได้เล่มเดียว (`key`/`map` ตัวเดียว) → เปิดฉากของสองเล่มสลับกัน
// วัดเล่มสองแล้วตารางของเล่มหนึ่งหาย → แท็บเล่มหนึ่งกลับไปขึ้นหน้า 1 แล้วสั่งวัดใหม่ วนแย่งแคชกันไปมา
const flowCache = { byKey: new Map(), busy: new Map(), stale: new Map(), epoch: createEpoch() };
// byKey = ผลที่ "สด" (secPath → Map(file → page)) · busy = งานที่กำลังวัด (secPath → Promise)
// [alpha.161 · C1] stale = ผลที่วัดเสร็จแต่ข้อมูลเปลี่ยนระหว่างวัด — ใช้โชว์ชั่วคราวได้ **แต่ไม่นับว่าพร้อม**
// (เดิม `epoch` ถูกเขียนแต่ไม่มีใครอ่าน: งานที่เริ่มก่อน bumpBookFlow() แล้วเสร็จทีหลังถูกเก็บถาวร
//  → บันทึกฉากระหว่างวัด = เลขหน้าของฉากถัด ๆ ไปค้างค่าก่อนบันทึกจนกว่าจะมีอะไรล้างแคชอีกรอบ)
const FLOW_MAX_ROUNDS = 3;

/**
 * ทิ้งแคชสายหน้า — เรียกเมื่อเนื้อหา/รูปแบบหน้าเปลี่ยน (บันทึกฉาก · เปลี่ยนฟอนต์/ขอบ/ขนาดกระดาษ
 * · ติ๊กปกบท · ย้ายลำดับบท) · **"มีคีย์" ไม่ใช่ `map.size`** — เล่มที่ยังไม่มีฉากเลยคืนตาราง
 * ว่างอย่างถูกต้อง ถ้าใช้ขนาดตารางเป็นตัวตัดสิน มันจะไล่คำนวณใหม่ทุกครั้งที่วาดหน้า
 */
export function bumpBookFlow() {
  flowCache.byKey = new Map(); flowCache.epoch.bump();
}
/** [alpha.161 · C1] รุ่นของข้อมูลสายหน้า (เทส/วินิจฉัย) */
export const bookFlowEpoch = () => flowCache.epoch.value;
/** เล่มนี้คำนวณสายหน้าไว้แล้วหรือยัง — **เฉพาะผลที่สด** (ผลที่ล้าสมัยระหว่างวัด = ยังไม่พร้อม) */
export const bookFlowReady = (secPath) => flowCache.byKey.has(String(secPath || ''));
/** เล่มที่คำนวณไว้ล่าสุด (คืน '' = ยังไม่มี) — คงไว้ให้ตัวเรียกเดิม/เทส */
export const bookFlowKey = () => { const k = [...flowCache.byKey.keys()]; return k.length ? k[k.length - 1] : ''; };

/** เลขหน้าเริ่มต้นของไฟล์ฉาก (จากแคชที่สดของทุกเล่ม) — ไม่มีในแคช = null (ผู้เรียกตกกลับไปที่ 1) */
export function cachedStartPage(file) {
  const f = String(file || '');
  for (const map of flowCache.byKey.values()) {
    const v = map.get(f);
    if (Number.isFinite(v)) return v;
  }
  return null;
}
/**
 * [alpha.161 · C1] เลขหน้าจากผลที่ "ล้าสมัยแล้ว" — ใช้โชว์ระหว่างรอวัดใหม่เท่านั้น (ผู้เรียกต้องสั่งวัดใหม่เอง)
 * @returns {number|null}
 */
export function staleStartPage(file) {
  const f = String(file || '');
  for (const map of flowCache.stale.values()) {
    const v = map.get(f);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * คำนวณสายหน้าของเล่มหนึ่ง แล้วเก็บลงแคช
 * @param {string} secPath โฟลเดอร์เล่ม
 * @returns {Promise<Map<string, number>>} ไฟล์ฉาก → เลขหน้าที่ฉากนั้นเริ่ม
 */
export async function computeBookFlow(secPath) {
  const key = String(secPath || '');
  if (flowCache.byKey.has(key)) return flowCache.byKey.get(key);
  if (flowCache.busy.has(key)) return flowCache.busy.get(key);
  // [alpha.161 · C1] ★ จับรุ่นข้อมูลก่อนอ่าน · ข้อมูลเปลี่ยนระหว่างวัด = วัดใหม่ทันที (ไม่เกิน FLOW_MAX_ROUNDS รอบ)
  // ครบเพดานแล้วยังเปลี่ยน → เก็บเป็น "ใช้ชั่วคราว" (stale) **ไม่ใช่ของสด** — bookFlowReady() คืน false
  // ผู้เรียก (ensureBookFlow) สั่งวัดใหม่แบบหน่วงเวลา + มีเพดาน จึงไม่วนวัดทั้งเล่มรัว ๆ (ปัญหาเดิมของ alpha.160)
  const measureOnce = async () => {
    const books = await collectBooks(key);
    if (!books.length) return new Map();
    const doc = await buildBookDoc(books);
    // [alpha.160] วัดเบื้องหลัง = รอรูปได้ถึง 20 วินาที (เดิม 2.5 วินาทีแล้ววัดตอนรูปยังสูง 0 → เลขหน้าเลื่อนทั้งเล่ม)
    const mz = await measureBookDoc(doc, { imgWaitMs: 20000 });
    let map;
    try { map = startPageMap(mz.parts); } finally { mz.dispose(); }
    // จุดพักของ e2e (เหมือน window.__k2conflictChoice) — เทสแก้ไฟล์ "หลังวัดรอบนี้เสร็จ แต่ก่อนเก็บผล" ได้แน่นอน
    // ไม่ต้องเดาจังหวะ · ไม่ได้ตั้ง = ไม่มีผลใด ๆ
    if (typeof window !== 'undefined' && typeof window.__k2flowHold === 'function') await window.__k2flowHold();
    return map;
  };
  const job = runFresh(flowCache.epoch, measureOnce, { maxRounds: FLOW_MAX_ROUNDS });
  const busyP = job.then((r) => r.value);
  busyP.catch(() => {});                                   // ผู้รอเห็น error เอง · กัน unhandled ตอนไม่มีใครรอ
  flowCache.busy.set(key, busyP);
  try {
    const { value: map, fresh } = await job;
    if (fresh) { flowCache.byKey.set(key, map); flowCache.stale.delete(key); }
    else flowCache.stale.set(key, map);
    return map;
  } finally { flowCache.busy.delete(key); }
}

// ───────────────────────── โหมดอ่านทั้งเล่ม (โอเวอร์เลย์) ─────────────────────────

const RD = { ov: null, mz: null, doc: null, page: 1, cols: 2, zoom: 1, secPath: '', books: [],
             ro: null };

/** ปิดโหมดอ่าน (ปลอดภัยเมื่อยังไม่เปิด) */
export function closeBookReader() {
  if (RD.ro) { try { RD.ro.disconnect(); } catch {} RD.ro = null; }
  if (RD.mz) { try { RD.mz.dispose(); } catch {} RD.mz = null; }
  if (RD.ov) { RD.ov.remove(); RD.ov = null; }
  document.removeEventListener('keydown', onReaderKey, true);
  RD.doc = null; RD.books = [];
}
export const isBookReaderOpen = () => !!RD.ov;
/** จำนวนหน้าทั้งเล่มที่โหมดอ่านกำลังแสดง (0 = ยังไม่ได้เปิด) — e2e ใช้ยืนยัน */
export const bookReaderPages = () => (RD.mz && RD.mz.pages.length) || 0;
/** หน้าที่กำลังเปิดอยู่ (0 = ยังไม่ได้เปิด) — e2e ใช้ยืนยันว่าปุ่มบนแถบทำงานจริง */
export const bookReaderPage = () => (RD.ov ? RD.page : 0);
/** ส่วนทั้งหมดพร้อมเลขหน้า (เทส/เครื่องมือวินิจฉัย) */
export const bookReaderParts = () => (RD.mz && RD.mz.parts) || [];

function onReaderKey(e) {
  if (!RD.ov) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeBookReader(); return; }
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.code === 'Space') { e.preventDefault(); gotoPage(RD.page + RD.cols); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); gotoPage(RD.page - RD.cols); }
  else if (e.key === 'Home') { e.preventDefault(); gotoPage(1); }
  else if (e.key === 'End') { e.preventDefault(); gotoPage(pageCount()); }
}

const pageCount = () => (RD.mz && RD.mz.pages.length) || 0;

/** ไปหน้าที่ n (หนีบไว้ในช่วงที่มีจริง) — e2e เรียกตัวนี้ตรง ๆ */
export function gotoPage(n) {
  const total = pageCount();
  if (!total) return 0;
  RD.page = Math.min(total, Math.max(1, Math.round(+n || 1)));
  drawSpread();
  return RD.page;
}

/** ขนาดย่อ/ขยายให้พอดีเวที × ระดับซูมที่ผู้ใช้ตั้ง */
function fitScale(stage) {
  const pw = +RD.doc.paper.width * DPI, ph = +RD.doc.paper.height * DPI;
  const w = Math.max(120, stage.clientWidth - 24);
  const h = Math.max(120, stage.clientHeight - 24);
  const gap = 18;
  const fit = Math.min((w - gap * (RD.cols - 1)) / (pw * RD.cols), h / ph);
  return Math.max(0.12, Math.min(3, fit * RD.zoom));
}

function drawSpread() {
  if (!RD.ov || !RD.mz) return;
  const stage = RD.ov.querySelector('.k-rd-stage');
  const total = pageCount();
  const from = Math.min(RD.page, Math.max(1, total - RD.cols + 1));
  const slice = RD.mz.pages.slice(from - 1, from - 1 + RD.cols);
  const spf = spFormat();
  const scale = fitScale(stage);
  renderProseClipPages(stage, RD.mz.meas, slice, {
    scale, gap: 18, paper: RD.doc.paper, margins: RD.doc.margins,
    numTop: spf.pageNumbers.top, numRight: spf.pageNumbers.right,
    // เลขหน้า = **เลขที่พิมพ์** ของทั้งเล่ม (หน้าปกเล่มไม่มีเลข · ปกบทมี) ผ่านกฎเดียวกับ
    // ไฟล์ที่ส่งออก (แสดง/ไม่แสดง · ใส่เลขบนหน้าแรกไหม · ท้ายเลข)
    label: (i) => {
      const n = printedPageNumber(RD.mz.coverPages, from + i - 1);
      return n ? pageNumberLabel(n, spf, 1) : '';
    },
    // ปกเต็มหน้า = ทาภาพที่พื้นของแผ่น → ชนขอบกระดาษจริง ไม่มีกรอบขาว
    bleed: (i) => RD.mz.bleed.get(from + i - 1) || '',
    // [alpha.143 ข้อ 2] รูป `fit=page` ในเนื้อเรื่องก็กินแผ่นทั้งแผ่นเหมือนกัน (ตัววาดหาเอง)
    blocks: RD.mz.blocks,
  });
  const lab = RD.ov.querySelector('.k-rd-pageno');
  if (lab) {
    lab.textContent = tf('ui.readbook.pageOf', from, total);
    lab.title = t('ui.readbook.pageTip');
  }
  const inp = RD.ov.querySelector('.k-rd-jump');
  if (inp) { inp.max = String(total); inp.value = String(from); }
}

/**
 * เปิดโหมด "อ่านทั้งเล่ม"
 * @param {string} [secPath] เล่มที่จะอ่าน · '' = ทั้งโปรเจกต์
 */
export async function openBookReader(secPath = '', opts = {}) {
  closeBookReader();
  RD.secPath = String(secPath || '');
  // [alpha.155] "อ่านทั้งบท" จากเมนูคลิกขวาของบท — ตัวอ่านเดิมทั้งชุด แค่กรองเหลือบทเดียว
  RD.chapterGuid = String((opts && opts.chapterGuid) || '');
  const ov = el('div', 'k-overlay k-rd-overlay');
  RD.ov = ov;

  const wrap = el('div', 'k-rd-wrap');
  const bar = el('div', 'k-rd-bar');
  const titleEl = el('div', 'k-rd-title', t('ui.readbook.title'));
  titleEl.title = t('ui.readbook.titleTip');
  bar.append(titleEl);

  const pick = el('select', 'k-rd-pick');
  pick.title = t('ui.readbook.pickTip');
  bar.append(pick);

  // ★ ทุกตัวควบคุมต้องมี tooltip และ tooltip ต้องบอก **คีย์ลัดของมันเอง** ด้วย
  // (โหมดอ่านเป็นเต็มจอ ไม่มีเมนูให้เปิดดู — ถ้าไม่บอกตรงนี้ก็ไม่มีที่ให้รู้)
  const mkBtn = (cls, label, title, fn) => {
    const b = el('button', 'k-rd-btn ' + cls, label);
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.onclick = fn; bar.append(b); return b;
  };
  mkBtn('k-rd-first', gi('skip-previous'), t('ui.readbook.first'), () => gotoPage(1));
  mkBtn('k-rd-prev', gi('chevron-left'), t('ui.readbook.prev'), () => gotoPage(RD.page - RD.cols));
  const jump = el('input', 'k-rd-jump'); jump.type = 'number'; jump.min = '1';
  jump.title = t('ui.readbook.jump');
  jump.setAttribute('aria-label', t('ui.readbook.jump'));
  jump.onchange = () => gotoPage(parseInt(jump.value, 10));
  bar.append(jump);
  const pageNo = el('div', 'k-rd-pageno', '…');
  pageNo.title = t('ui.readbook.pageTip');
  bar.append(pageNo);
  mkBtn('k-rd-next', gi('play'), t('ui.readbook.next'), () => gotoPage(RD.page + RD.cols));
  mkBtn('k-rd-last', gi('skip-next'), t('ui.readbook.last'), () => gotoPage(pageCount()));
  const colsBtn = mkBtn('k-rd-cols', gi('page-double'), t('ui.readbook.spread'), () => {
    RD.cols = RD.cols === 1 ? 2 : 1;
    colsBtn.textContent = RD.cols === 1 ? gi('page-single') : gi('page-double');
    colsBtn.title = RD.cols === 1 ? t('ui.readbook.spreadTo2') : t('ui.readbook.spreadTo1');
    drawSpread();
  });
  colsBtn.title = t('ui.readbook.spreadTo1');       // ตอนนี้สองหน้า → กดแล้วเป็นหน้าเดียว
  mkBtn('k-rd-zoomout', gi('minus'), t('ui.readbook.zoomOut'), () => { RD.zoom = Math.max(0.4, RD.zoom - 0.1); drawSpread(); });
  mkBtn('k-rd-zoomin', '+', t('ui.readbook.zoomIn'), () => { RD.zoom = Math.min(2.5, RD.zoom + 0.1); drawSpread(); });
  mkBtn('k-rd-fit', gi('maximize'), t('ui.readbook.fit'), () => { RD.zoom = 1; drawSpread(); });
  mkBtn('k-rd-close k-danger', gi('close'), t('ui.readbook.close'), () => closeBookReader());

  const stage = el('div', 'k-rd-stage sp-pageview');
  stage.title = t('ui.readbook.stageTip');
  wrap.append(bar, stage);
  ov.append(wrap);
  document.body.append(ov);
  document.addEventListener('keydown', onReaderKey, true);
  ov.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    RD.zoom = Math.max(0.4, Math.min(2.5, RD.zoom + (e.deltaY < 0 ? 0.08 : -0.08)));
    drawSpread();
  }, { passive: false });

  stage.append(el('div', 'k-rd-busy', t('ui.readbook.busy')));

  // รายชื่อเล่มให้สลับได้ในตัว (ผู้ใช้: "อ่านทั้ง project")
  const secs = await listSections();
  const optAll = el('option', null, t('ui.readbook.allBooks')); optAll.value = '';
  pick.append(optAll);
  for (const s of secs) {
    const o = el('option', null, s.title || s.folder); o.value = s.secPath;
    if (s.secPath === RD.secPath) o.selected = true;
    pick.append(o);
  }
  pick.onchange = () => { openBookReader(pick.value); };

  try {
    await withBusy(t('ui.readbook.busy'), async () => {
      RD.books = await collectBooks(RD.secPath);
      if (RD.chapterGuid) {
        RD.books = RD.books
          .map((b) => ({ ...b, chapters: (b.chapters || []).filter((c) => c.guid === RD.chapterGuid) }))
          .filter((b) => b.chapters.length);
      }
      if (!RD.books.length) throw new Error(t('ui.readbook.empty'));
      RD.doc = await buildBookDoc(RD.books);
      RD.mz = await measureBookDoc(RD.doc);
    });
  } catch (e) {
    stage.replaceChildren(el('div', 'k-rd-busy', (e && e.message) || t('ui.readbook.empty')));
    return false;
  }
  if (!RD.ov) return false;                    // ผู้ใช้ปิดไปแล้วระหว่างจัดหน้า
  // ย่อ/ขยายหน้าต่าง = พื้นที่เวทีเปลี่ยน → ต้องคำนวณสเกลใหม่ ไม่งั้นหน้ากระดาษล้นออกนอกจอ
  // (รวบเป็นเฟรมเดียวด้วย rAF — ResizeObserver ยิงถี่มากระหว่างลากขอบ · บทเรียนข้อ 25)
  // ★ เฝ้าที่ **โอเวอร์เลย์** ไม่ใช่ที่เวที — เวทีเปลี่ยนขนาดเองได้เมื่อแถบเลื่อนโผล่/หาย
  //   ซึ่งเป็นผลของการวาด → เฝ้าที่เวทีแล้ววาดใหม่ = วงวน (วาด → ขนาดขยับ → วาด …)
  if (typeof ResizeObserver === 'function') {
    let raf = 0, lastW = 0, lastH = 0;
    RD.ro = new ResizeObserver(() => {
      const w = ov.clientWidth, h = ov.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; drawSpread(); });
    });
    RD.ro.observe(ov);
  }
  titleEl.textContent = RD.books.length === 1
    ? tf('ui.readbook.titleOf', RD.books[0].title) : t('ui.readbook.title');
  RD.page = 1;
  drawSpread();
  // [alpha.160] รูปที่มาช้ากว่าเวลารอใน measureBookDoc → วัดทั้งเล่มใหม่เมื่อมาครบ
  // (เดิมวัดครั้งเดียวตอนรูปยังสูง 0 = หน้าเหลื่อมทั้งเล่มค้างอยู่อย่างนั้นจนกว่าจะปิด-เปิดใหม่)
  const mz0 = RD.mz;
  RD.late = afterLateImages(mz0.meas, async () => {
    if (!RD.ov || RD.mz !== mz0) return;
    const next = await measureBookDoc(RD.doc);
    if (!RD.ov || RD.mz !== mz0) { next.dispose(); return; }
    mz0.dispose();
    RD.mz = next;
    RD.page = Math.min(RD.page, pageCount());
    drawSpread();
  });
  setStatus(t('ui.readbook.opened'));
  return true;
}
