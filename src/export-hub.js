// export-hub.js — [alpha.81 ข้อ 8+9] "ศูนย์รวมการส่งออก" กล่องเดียวจบ
//
// ═══ ทำไมต้องรื้อ ═══
// เมนู "ไฟล์" เคยมีทางส่งออก **9 ทาง** แยกกันคนละกล่อง (PDF · ฉบับร่าง · เวิร์กโฟลว์ · HTML ·
// zip · json · fdx · rtf · PDF ลายน้ำ) ผู้ใช้จึงต้องจำเองว่าทางไหนให้ผลอะไร
// และที่แย่กว่านั้น — ทางที่คนกดบ่อยที่สุด (ไฟล์ → พิมพ์ → Microsoft Print to PDF) เป็นทางที่
// **ให้ผลผิด**: Chromium แปลงหน้าจอทั้งหน้าเป็น "ภาพ" ก่อนส่งเข้าคิวพิมพ์ ได้ PDF ที่
// ไม่มีตัวอักษรจริงเลยสักตัว (คัดลอกไม่ได้ · ค้นหาไม่ได้ · เป็นภาพ 20 ชิ้นในหน้าเดียว)
// ยืนยันจากไฟล์ที่ผู้ใช้ส่งมา: /Producer (Microsoft: Print To PDF) · /Type/Font = 0 · Image = 20
//
// ═══ ที่นี่แก้ยังไง ═══
// 1. ทางเดียว — `openExportHub()` รวมทุกปลายทางไว้ในกล่องเดียว เลือกรูปแบบทางซ้าย
// 2. ตั้งค่าได้จริง — ขอบเขต (ฉากที่เปิด / ฉบับร่างทั้งเล่ม) · เวิร์กโฟลว์เนื้อหา · ตัวเลือกของรูปแบบ
// 3. เห็นก่อนบันทึก — ช่องตัวอย่างทางขวาเป็น "หน้ากระดาษจริง" (ตัวเดียวกับมุมมองเรียงหน้า)
// 4. **PDF ไม่แตะเครื่องพิมพ์ของระบบอีกเลย** — มีสองทางที่ให้ตัวอักษรจริงเสมอ:
//      · บทภาพยนตร์ → pdf-lib (`buildScriptPdf`) ฝังฟอนต์ไทยเอง
//      · นิยาย       → HTML ที่มี `@page` ตามขนาดกระดาษจริง → `kapi.pdfFromHtml`
//    ทั้งสองทางได้ /Type/Font จริง คัดลอก/ค้นหาข้อความในไฟล์ได้
//
// ส่วนบริสุทธิ์ (ตารางรูปแบบ · การเลือกตัวสร้าง · การรวมค่าที่จำไว้) แยกไว้บนสุด — unit test ได้ตรง ๆ

import { t as tt, tf as ttf } from './i18n.js';
import { $, el, state, setStatus, log, withBusy } from './core.js';
import { runWorkflow, mdToHtml } from './compile.js';
import { num } from './num.js';
// ตรรกะล้วน (ตารางรูปแบบ · เลือกตัวสร้าง · ค่าที่จำไว้) อยู่ใน export-formats.js — ทดสอบด้วย node ได้
import { EXPORT_FORMATS, formatDef, docKind, pdfEngine, normalizeHub,
         defaultWorkflowFor, workflowForFormat, suggestName } from './export-formats.js';
export { EXPORT_FORMATS, formatDef, docKind, pdfEngine, defaultHubSettings, normalizeHub,
         defaultWorkflowFor, workflowForFormat, suggestName } from './export-formats.js';

// ═══════════════════════ ส่วน UI ═══════════════════════

const PREVIEW_CHARS = 8000;

/**
 * โมเดลเนื้อหาตามขอบเขตที่เลือก — คืน {model, kind}
 *
 * [alpha.81r ข้อ 6] ขอบเขต "ฉากที่เปิดอยู่" **ไม่มีชื่อบท** — ชื่อแท็บคือชื่อไฟล์ ไม่ใช่เนื้อเรื่อง
 * ปล่อยว่างไว้ แล้ว runWorkflow จะข้ามหัวข้อให้เอง (ไม่มี `## ชื่อไฟล์` ติดไปในงาน)
 * [alpha.81r ข้อ 3] ชนิดเอกสารถูก **บังคับ** ได้จากกล่อง (cfg.kind) — อยู่โหมดนิยายแล้วสั่ง
 * ส่งออกเป็นบทภาพยนตร์ ต้องได้รูปแบบบทจริง ๆ ไม่ใช่ตัดสินจากไฟล์ต้นทางอย่างเดียว
 */
async function buildModel(A, cfg, drafts) {
  const forced = cfg.kind === 'prose' || cfg.kind === 'screenplay' ? cfg.kind : '';
  if (cfg.scope === 'tab' && state.active && (state.active.editor || state.active.sp)) {
    const t = state.active;
    const body = t.sp ? t.sp.getMarkdown() : t.editor.getMarkdown();
    const model = {
      title: t.title || state.title, author: (state.meta && state.meta.author) || '', roster: '',
      chapters: [{ title: '', guid: 'tab', scenes: [
        { title: '', file: t.file, body: String(body || '').trim(),
          synopsis: '', status: '', type: 'scene',
          format: t.sp ? 'screenplay' : 'prose', words: 0 },
      ] }],
    };
    return { model, kind: forced || (t.sp ? 'screenplay' : 'prose') };
  }
  const d = drafts.find((x) => x.dPath === cfg.draft) || drafts[0];
  if (!d) return null;
  const model = await A.buildDraftModel(d.dPath);
  // [alpha.81r2] "หน้าปกของนิยาย = รูปปกที่เลือกใน จัดการเล่ม" — เก็บไว้ที่ section.json → cover
  // (เก็บเป็น path สัมพัทธ์กับโฟลเดอร์เล่ม เช่น `../Images/ปก.png`)
  return { model, kind: forced || docKind(model), dPath: d.dPath,
           coverUrl: await A.sectionCoverUrl(d.dPath) };
}

/** ประกอบเนื้อหาผ่านเวิร์กโฟลว์ — คืนผลของ runWorkflow (มี text / ext / warnings) */
async function compose(A, cfg, model, wf) {
  const varCtx = { title: model.title, author: model.author };
  if ((wf.steps || []).some((s) => s.on !== false && s.key === 'resolve-vars')) {
    const { buildVarContext } = await import('./template-vars.js');
    Object.assign(varCtx, await buildVarContext(state.root, kapi));
  }
  const spf = A.spFormat();
  return runWorkflow(model, workflowForFormat(wf, cfg.format), {
    varCtx, spFormat: spf, proseFormat: A.proseFormat(), paper: spf.paper, margins: spf.margins,
  });
}

/**
 * HTML ฉบับพิมพ์ได้ของนิยาย — มี `@page` ตามขนาดกระดาษจริง (ทางเดียวกับที่จะกลายเป็น PDF)
 * ฝัง `@font-face` แบบ `file://` เข้าไปด้วย ไม่งั้นไฟล์ที่ออกไปนอกโปรแกรมหาฟอนต์ไม่เจอ
 * แล้วตัวไทยตกไปฟอนต์สำรองเงียบ ๆ (WYSIWYG พัง)
 */
async function proseHtml(A, text, title, wysiwyg) {
  const spf = A.spFormat();
  const html = wysiwyg ? mdToHtml(text, title, A.proseFormat(), spf.paper, spf.margins)
                       : mdToHtml(text, title, null, spf.paper, spf.margins);
  const fontCss = await A.exportFontCss();
  return fontCss ? html.replace('<style>', '<style>\n' + fontCss + '\n') : html;
}

/**
 * [alpha.81r2] หน้าหน้าเล่มของ "นิยาย" — หน้าปก + หน้ารายชื่อตัวละคร
 *
 * ผู้ใช้สั่งไว้ชัด: **หน้าปกของนิยาย = รูปปกที่เลือกไว้ใน "จัดการเล่ม"** (บทภาพยนตร์ใช้หน้าปกของบท
 * ซึ่ง `buildScriptPdf` วาดให้อยู่แล้ว) · ทั้งสองหน้านี้เป็น "หน้าหน้าเล่ม" — ไม่นับเลขหน้า
 * @returns {Promise<string>} HTML (ว่าง = ไม่มีหน้าหน้าเล่มให้ทำ)
 */
async function frontMatterHtml(A, cfg, model, coverUrl) {
  const wantCover = cfg.pdf.titlePages !== false;
  const roster = cfg.pdf.roster !== false ? String(model.roster || '').trim() : '';
  if (!wantCover && !roster) return '';
  const spf = A.spFormat();
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pages = [];
  if (wantCover) {
    pages.push('<section class="k-front k-cover">' +
      (coverUrl ? `<img class="k-cover-img" src="${esc(coverUrl)}" alt="">` : '') +
      `<div class="k-cover-title">${esc(model.title || '')}</div>` +
      (model.author ? `<div class="k-cover-author">${esc(model.author)}</div>` : '') +
      '</section>');
  }
  if (roster) {
    pages.push('<section class="k-front k-cast"><pre class="k-cast-body">' +
               esc(roster) + '</pre></section>');
  }
  const m = spf.margins;
  const { proseFontStack } = await import('./prose-format.js');
  const pf = A.proseFormat();
  const css = [
    `@page{size:${spf.paper.width}in ${spf.paper.height}in;` +
      `margin:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in}`,
    'html,body{margin:0;padding:0}',
    `body{font-family:${proseFontStack(pf)};` +
      `font-size:${pf.fontPt}pt;line-height:1.5;color:#111}`,
    // ความสูงหนึ่งหน้าเต็ม (หักระยะขอบบน-ล่าง) → แต่ละ section = หนึ่งแผ่นเป๊ะ
    `.k-front{height:${+(spf.paper.height - m.top - m.bottom).toFixed(3)}in;` +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'text-align:center;break-after:page;page-break-after:always;overflow:hidden}',
    '.k-front:last-child{break-after:auto;page-break-after:auto}',
    '.k-cover-img{max-width:100%;max-height:62%;object-fit:contain;margin-bottom:.5in}',
    '.k-cover-title{font-size:2.1em;font-weight:700;line-height:1.25}',
    '.k-cover-author{font-size:1.15em;margin-top:.28in;opacity:.85}',
    '.k-cast{justify-content:flex-start;text-align:left;align-items:stretch}',
    '.k-cast-body{font-family:inherit;white-space:pre-wrap;margin:0;font-size:1em;line-height:1.6}',
  ].join('\n');
  const fontCss = await A.exportFontCss();
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><title>${esc(model.title || '')}</title>
<style>
${fontCss}
${css}
</style></head><body>
${pages.join('\n')}
</body></html>`;
}

/**
 * เขียนไฟล์ปลายทางจริง
 * @returns {Promise<{dest:string, note:string}|null>} null = ผู้ใช้กดยกเลิกกล่องบันทึก
 */
async function writeOut(A, cfg, built) {
  const def = formatDef(cfg.format);
  const name = suggestName(built.title, cfg.format);
  const dest = def.ext === 'pdf' ? await kapi.savePdfDialog(name)
                                 : await kapi.saveAsDialog(name, def.ext);
  if (!dest) return null;

  if (cfg.format === 'pdf') {
    const o = cfg.pdf;
    if (built.engine === 'pdflib') {
      const { parseScript } = await import('./fountain.js');
      const { buildScriptPdf, projectTitlePages, projectHeaders } = await import('./pdf-ui.js');
      // [alpha.81r2] "หน้ารายชื่อตัวละครไม่มีให้เลือกเลย"
      // ฝั่งบทภาพยนตร์ทำเป็น **หน้าปกเพิ่มอีกหนึ่งแผ่น** ต่อท้ายหน้าปกจริง —
      // ตัวสร้าง PDF นับเลขหน้าจาก "หน้าเนื้อเรื่อง" อยู่แล้ว (`titles.length` เป็นตัวเลื่อน)
      // หน้ารายชื่อจึงไม่ถูกนับเลขไปด้วยโดยอัตโนมัติ ตรงกับที่ผู้ใช้ต้องการ
      const fmtS = A.spFormat();
      const titles = o.titlePages ? [...projectTitlePages()] : [];
      const roster = o.roster !== false ? String(built.roster || '').trim() : '';
      if (roster) {
        titles.push({ strings: [{ text: roster, x: fmtS.margins.left, y: fmtS.margins.top,
                                  size: num(state.settings.spFontPt, 12), align: 'left',
                                  width: Math.max(1, fmtS.paper.width - fmtS.margins.left - fmtS.margins.right) }] });
      }
      const r = await buildScriptPdf({
        blocks: parseScript(built.text), title: built.title, fmt: fmtS,
        titlePages: titles,
        headers: o.headers ? projectHeaders() : { enabled: false },
        opts: { toc: o.toc, titlePages: titles.length > 0, headers: o.headers,
                pageNumbers: o.pageNumbers, sceneNumbers: o.pageNumbers,
                watermark: o.watermark, openPage: 0 },
      });
      await kapi.writeBytes(dest, Array.from(r.bytes));
      return { dest, note: ttf('ui.xhub.donePdf', r.pageCount, r.bookmarks.length) };
    }
    // นิยาย → HTML ที่มี @page → printToPDF ในหน้าต่างซ่อน (ได้ตัวอักษรจริง ไม่ใช่ภาพ)
    // [alpha.81r2] หน้าปก/หน้ารายชื่อ ทำเป็น PDF อีกก้อนแล้วเอามาต่อหน้าเนื้อเรื่อง
    // จากนั้นประทับเลขหน้าเองเฉพาะเนื้อเรื่อง — Chromium สั่ง "อย่านับหน้าปก" ไม่ได้
    const h = { height: num(A.spFormat().paper.height, 11) };
    const front = built.frontHtml ? await kapi.pdfHtmlToBytes(built.frontHtml, h) : null;
    const body = await kapi.pdfHtmlToBytes(built.html, h);
    const { mergeAndNumber } = await import('./pdf-generator.js');
    const { pdfFontBytes } = await import('./pdf-ui.js');
    const r = await mergeAndNumber(front ? [front] : [], body, {
      fmt: A.spFormat(), fonts: await pdfFontBytes(),
      pageNumbers: o.pageNumbers !== false, startPage: 1,
      fontPt: num(A.proseFormat().fontPt, 12), meta: { title: built.title },
    });
    await kapi.writeBytes(dest, Array.from(r.bytes));
    return { dest, note: ttf('ui.xhub.donePdfPages', r.pageCount, r.frontCount) };
  }
  if (cfg.format === 'html') { await kapi.writeFile(dest, built.html); return { dest, note: '' }; }
  await kapi.writeFile(dest, built.text);
  return { dest, note: '' };
}

/**
 * ประกอบผลลัพธ์ของรูปแบบที่เลือกให้พร้อมทั้ง "ดูตัวอย่าง" และ "บันทึกจริง"
 * — ทางเดียวกันเป๊ะทั้งสองกรณี จึงไม่มีทางที่ตัวอย่างกับไฟล์จริงจะไม่ตรงกัน
 */
async function buildAll(A, cfg, drafts) {
  const mk = await buildModel(A, cfg, drafts);
  if (!mk) return null;
  const { model, kind } = mk;
  const wf = A.allWorkflows().find((w) => w.id === cfg.workflow)
          || defaultWorkflowFor(cfg.format, A.allWorkflows());
  // [alpha.81r2] หน้าปก/หน้ารายชื่อ คุมจาก "ตัวเลือก PDF" ในกล่องนี้ — ไม่ใช่จากเวิร์กโฟลว์
  // (เดิมกดติ๊กแล้วไม่มีอะไรเปลี่ยน เพราะสองสวิตช์นี้ไม่เคยถูกส่งไปถึงตัวสร้างเลย)
  // จึงปิดขั้นตอน cover/roster ของเวิร์กโฟลว์ทิ้ง ไม่ให้ซ้อนกับหน้าที่กล่องนี้ทำเอง
  const wf2 = { ...wf, steps: (wf.steps || []).map((s) =>
    (s.key === 'cover' || s.key === 'roster') ? { ...s, on: false } : s) };
  const r = await compose(A, cfg, model, wf2);
  const engine = pdfEngine(kind);
  const { parseScript, stripFountainCodes } = await import('./fountain.js');
  // [alpha.81r ข้อ 4] ทางที่ผ่าน `parseScript` (PDF บทหนัง · rtf · fdx) พาร์เซอร์กินรหัสไปแล้ว
  // ทางที่เหลือเป็น Markdown ล้วน ๆ ต้องตัดรหัส fountain (`@ชื่อ` `.หัวฉาก` `((โน้ต))`) เองที่นี่
  // ไม่งั้นมันติดไปในไฟล์ที่ส่งให้คนอ่าน ทั้งที่บนจอถูกซ่อนไว้ตลอด
  const viaScript = cfg.format === 'rtf' || cfg.format === 'fdx' ||
                    (cfg.format === 'pdf' && engine === 'pdflib');
  const text = viaScript ? r.text : stripFountainCodes(r.text);
  const out = { title: model.title, kind, warnings: r.warnings || [],
                text, html: '', frontHtml: '', roster: model.roster || '',
                coverUrl: mk.coverUrl || '', engine, blocks: null };

  if (cfg.format === 'html') out.html = await proseHtml(A, text, model.title, cfg.html.wysiwyg);
  if (cfg.format === 'pdf' && engine === 'html') {
    out.html = await proseHtml(A, text, model.title, true);
    out.frontHtml = await frontMatterHtml(A, cfg, model, mk.coverUrl || '');
  }
  if (viaScript) out.blocks = parseScript(r.text);
  if (cfg.format === 'rtf') {
    const { generateRtf } = await import('./export-rtf.js');
    const { projectTitlePages } = await import('./pdf-ui.js');
    out.text = generateRtf(out.blocks, A.scriptMeta(model.title), A.spFormat(),
                           { titlePages: projectTitlePages(), fontPt: num(cfg.rtf.fontPt, 12) });
  }
  if (cfg.format === 'fdx') {
    const { generateFdx } = await import('./export-fdx.js');
    const { projectTitlePages } = await import('./pdf-ui.js');
    out.text = generateFdx(out.blocks, A.scriptMeta(model.title), { titlePages: projectTitlePages() });
  }
  return out;
}

/**
 * [alpha.81r2] วาด "หน้าหน้าเล่ม" (ปก + รายชื่อตัวละคร) ลงในช่องตัวอย่าง
 *
 * ใช้โครง `.sp-page-slot > .sp-page` ชุดเดียวกับมุมมองเรียงหน้า จึงได้ขนาด/เงา/สีกระดาษเท่ากันเป๊ะ
 * ผู้ใช้ต้อง **เห็น** ว่าติ๊กหน้าปกแล้วมีหน้าปกจริง — เดิมติ๊กแล้วไม่มีอะไรเปลี่ยนในตัวอย่างเลย
 * @returns {number} จำนวนหน้าที่วาด
 */
function renderFrontPreview(box, built, cfg, paper, scale) {
  const wantCover = cfg.pdf.titlePages !== false;
  const roster = cfg.pdf.roster !== false ? String(built.roster || '').trim() : '';
  if (!wantCover && !roster) return 0;
  // ตัววาดหน้าเนื้อเรื่อง (`renderPageView`) ล้าง host ทิ้งก่อนเสมอ → ต้องเรียกตัวนี้ **ทีหลัง**
  // แล้วแทรกไว้ข้างหน้า ไม่งั้นหน้าหน้าเล่มถูกล้างหายไปทุกครั้ง
  const frag = document.createDocumentFragment();
  const pxW = paper.width * 96 * scale, pxH = paper.height * 96 * scale;
  const mkPage = (cls) => {
    const slot = el('div', 'sp-page-slot');
    slot.style.width = pxW + 'px'; slot.style.height = pxH + 'px';
    const page = el('div', 'sp-page xhub-front ' + cls);
    page.style.width = paper.width + 'in';
    page.style.height = paper.height + 'in';
    page.style.transform = 'scale(' + scale + ')';
    slot.append(page); frag.append(slot);
    return page;
  };
  let n = 0;
  if (wantCover) {
    const p = mkPage('xhub-front-cover');
    if (built.coverUrl) { const img = el('img', 'xhub-front-img'); img.src = built.coverUrl; p.append(img); }
    p.append(el('div', 'xhub-front-title', built.title || ''));
    n++;
  }
  if (roster) { mkPage('xhub-front-cast').append(el('pre', 'xhub-front-cast-body', roster)); n++; }
  box.prepend(frag);
  return n;
}

/** วาดช่องตัวอย่าง — หน้ากระดาษจริงสำหรับ PDF · หน้าเว็บจริงสำหรับ HTML · ข้อความสำหรับที่เหลือ */
async function renderPreview(host, A, cfg, built) {
  host.replaceChildren();
  const def = formatDef(cfg.format);
  if (def.handoff) {
    host.append(el('div', 'k-hint xhub-info', tt(def.descKey)));
    return 'info';
  }
  if (!built) { host.append(el('div', 'dim', tt('ui.xhub.noPreview'))); return 'none'; }

  // ลำดับสำคัญ: PDF ต้องมาก่อนเสมอ
  // [alpha.81r ข้อ 5] เดิมเงื่อนไข `format==='pdf' && engine==='html'` ถูกรวมไว้กับกิ่ง iframe
  // → PDF ของ **นิยาย** ได้ตัวอย่างเป็นหน้าเว็บไหลยาว ไม่ใช่หน้ากระดาษที่แบ่งหน้าแล้ว
  //   (กิ่งวาดหน้ากระดาษของนิยายกลายเป็นโค้ดตายที่ไม่มีทางถูกเรียก)
  // ปลายทางเป็น PDF = ต้องเห็น "แผ่นกระดาษ" เสมอ · ปลายทางเป็น HTML ค่อยโชว์หน้าเว็บจริง
  if (cfg.format === 'pdf') {
    // [alpha.81r ข้อ 5] "ตัวอย่างเพี้ยน" — ต้นตอ: `renderPageView()` เอา `.sp-page-slot` ใส่
    // host **ตรง ๆ** โดยหน้าตาทั้งหมด (flex · พื้นโต๊ะ · สีกระดาษ · ฟอนต์) มาจากกฎที่ขึ้นต้นด้วย
    // `.sp-pageview` แต่ผมส่ง div ที่ไม่มีคลาสนั้นไปเป็น host → ไม่มีกฎไหนตรงเลยสักข้อ
    // ได้กล่องเปล่ากับหน้ากระดาษที่หลุดไปมุมหนึ่ง · host ต้องมีคลาส `sp-pageview` เสมอ
    const box = el('div', 'sp-pageview xhub-pv');
    host.append(box);
    const fmt = A.spFormat();
    const { fitScale } = await import('./sp-view.js');
    const fs = fitScale(host.clientWidth || 420, fmt.paper.width * 96, 14,
                        { maxPerRow: 1, minScale: 0.15 });
    if (built.engine === 'pdflib') {
      const { renderPageView, pagesOf } = await import('./sp-view.js');
      renderPageView(box, pagesOf(built.blocks || [], fmt), fmt,
                     { scale: fs.scale, gap: 14, startPage: 1 });
    } else {
      // นิยายต้องใช้ตัววาดของนิยาย — ตัววาดบทจะจัดหน้าแบบสคริปต์ให้ทั้งที่เนื้อเป็นร้อยแก้ว
      const { renderProsePageView, prosePagesOf } = await import('./prose-view.js');
      const { mdToProseBlocks } = await import('./prose-format.js');
      const pf = A.proseFormat();
      renderProsePageView(box, prosePagesOf(mdToProseBlocks(built.text), pf, fmt.paper, fmt.margins),
                          pf, { scale: fs.scale, gap: 14, paper: fmt.paper, margins: fmt.margins,
                                showPageNumbers: cfg.pdf.pageNumbers !== false });
    }
    // หน้าปก/หน้ารายชื่อ ต้องเห็นในตัวอย่างด้วย — ติ๊กแล้วต้องมีอะไรเปลี่ยนบนจอเสมอ
    renderFrontPreview(box, built, cfg, fmt.paper, fs.scale);
    return 'page';
  }
  if (cfg.format === 'html') {
    const fr = el('iframe', 'xhub-frame');
    fr.setAttribute('sandbox', '');                 // ตัวอย่างต้องไม่รันสคริปต์ใด ๆ
    fr.srcdoc = built.html;
    host.append(fr);
    return 'html';
  }
  const pre = el('pre', 'xhub-pre');
  pre.textContent = built.text.slice(0, PREVIEW_CHARS) +
                    (built.text.length > PREVIEW_CHARS ? '\n…' : '');
  host.append(pre);
  return 'text';
}

/**
 * ศูนย์รวมการส่งออก — จุดเข้าเดียวจากเมนู ไฟล์ → ส่งออก… (Ctrl+Shift+E)
 * @returns {Promise<object|null>} ตัวช่วยสำหรับ selftest (ov / refresh / setFormat / run)
 */
export async function openExportHub() {
  if (!state.root) { setStatus(tt('ui.xhub.needProject')); return null; }
  const A = await import('./app.js');
  const drafts = await A.listDrafts();

  const cfg = normalizeHub((state.meta || {}).exportHub);
  if (!drafts.some((d) => d.dPath === cfg.draft)) cfg.draft = drafts.length ? drafts[0].dPath : '';
  if (!drafts.length) cfg.scope = 'tab';
  const saveCfg = async () => {
    if (!state.meta) return;
    state.meta.exportHub = cfg;
    try { await A.saveProjectMeta(); } catch (e) { log('warn', tt('ui.xhub.saveCfgFail'), e); }
  };

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-xhub');
  box.append(el('div', 'k-dlg-title', tt('ui.xhub.title')));
  const body = el('div', 'xhub-body');
  const colFmt = el('div', 'xhub-formats');
  const colOpt = el('div', 'xhub-options');
  const colPrev = el('div', 'xhub-preview');
  body.append(colFmt, colOpt, colPrev);
  box.append(body);

  const foot = el('div', 'k-dlg-btns');
  const warnLbl = el('span', 'dim xhub-warn');
  const bClose = el('button', 'k-cancel', tt('ui.common.close'));
  const bGo = el('button', 'k-ok', tt('ui.common.export2'));
  foot.append(warnLbl, bClose, bGo);
  box.append(foot);
  ov.append(box); document.body.append(ov);
  const close = () => ov.remove();
  bClose.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };

  // ---- ซ้าย: รายการรูปแบบ ----
  function renderFormats() {
    colFmt.replaceChildren();
    for (const f of EXPORT_FORMATS) {
      const row = el('div', 'xhub-fmt' + (f.key === cfg.format ? ' on' : ''));
      row.dataset.fmt = f.key;
      row.append(el('span', 'xhub-fmt-ic', f.icon));
      const txt = el('div', 'xhub-fmt-txt');
      txt.append(el('div', 'xhub-fmt-name', tt(f.labelKey)),
                 el('div', 'xhub-fmt-desc dim', tt(f.descKey)));
      row.append(txt);
      row.onclick = () => { cfg.format = f.key; saveCfg(); renderFormats(); renderOptions(); refresh(); };
      colFmt.append(row);
    }
  }

  // ---- กลาง: ตัวเลือก ----
  const chk = (on) => { const c = el('input'); c.type = 'checkbox'; c.checked = !!on; return c; };
  const optRow = (label, node, hint) => {
    const r = el('label', 'xhub-row');
    r.append(node, el('span', 'xhub-row-lbl', label));
    if (hint) r.append(el('span', 'dim xhub-row-hint', hint));
    return r;
  };

  function renderOptions() {
    colOpt.replaceChildren();
    const def = formatDef(cfg.format);
    if (def.handoff) {
      colOpt.append(el('div', 'k-hint', tt(def.descKey)));
      const b = el('button', 'k-ok xhub-handoff', tt('ui.xhub.openOwnDialog'));
      b.onclick = async () => {
        close();
        if (cfg.format === 'zip') { const m = await import('./export-zip.js'); m.exportProjectZip(); }
        else if (cfg.format === 'json') { const m = await import('./export-zip.js'); m.exportProjectJson(); }
        else if (cfg.format === 'blog') { const m = await import('./export-blog.js'); m.exportBlogHTML(); }
        else A.watermarkDialog();
      };
      colOpt.append(b);
      return;
    }

    // ขอบเขต
    colOpt.append(el('div', 'cmp-sub', tt('ui.xhub.scope')));
    const selScope = el('select', 'k-dlg-select'); selScope.id = 'xhub-scope';
    for (const [v, k] of [['draft', 'ui.xhub.scopeDraft'], ['tab', 'ui.xhub.scopeTab']]) {
      const o = el('option', null, tt(k)); o.value = v; selScope.append(o);
    }
    selScope.value = cfg.scope;
    selScope.onchange = () => { cfg.scope = selScope.value; saveCfg(); renderOptions(); refresh(); };
    colOpt.append(selScope);

    if (cfg.scope === 'draft') {
      const selD = el('select', 'k-dlg-select'); selD.id = 'xhub-draft';
      for (const d of drafts) { const o = el('option', null, d.label); o.value = d.dPath; selD.append(o); }
      selD.value = cfg.draft;
      selD.onchange = () => { cfg.draft = selD.value; saveCfg(); refresh(); };
      colOpt.append(selD);
      if (!drafts.length) colOpt.append(el('div', 'dim', tt('ui.xhub.noDraft')));
    }

    // [alpha.81r ข้อ 3] ชนิดเอกสาร — บังคับได้ ไม่ใช่เดาจากไฟล์อย่างเดียว
    // "อยู่โหมดนิยายแล้วส่งออกเป็นหนัง ต้องได้รูปแบบหนังจริง ๆ"
    colOpt.append(el('div', 'cmp-sub', tt('ui.xhub.docKind')));
    const selKind = el('select', 'k-dlg-select'); selKind.id = 'xhub-kind';
    for (const [v, k] of [['auto', 'ui.xhub.kindAuto'], ['prose', 'ui.xhub.kindProse'],
                          ['screenplay', 'ui.xhub.kindScript']]) {
      const o = el('option', null, tt(k)); o.value = v; selKind.append(o);
    }
    selKind.value = cfg.kind;
    selKind.onchange = () => { cfg.kind = selKind.value; saveCfg(); refresh(); };
    colOpt.append(selKind);

    // เวิร์กโฟลว์เนื้อหา
    colOpt.append(el('div', 'cmp-sub', tt('ui.xhub.content')));
    const selWf = el('select', 'k-dlg-select'); selWf.id = 'xhub-wf';
    const auto = el('option', null, tt('ui.xhub.wfAuto')); auto.value = ''; selWf.append(auto);
    for (const w of A.allWorkflows()) { const o = el('option', null, w.name); o.value = w.id; selWf.append(o); }
    selWf.value = cfg.workflow;
    selWf.onchange = () => { cfg.workflow = selWf.value; saveCfg(); refresh(); };
    colOpt.append(selWf);
    const bSteps = el('button', 'cmp-mini', tt('ui.xhub.editSteps'));
    bSteps.onclick = () => { close(); A.openCompileDialog(); };
    colOpt.append(bSteps);

    // ตัวเลือกเฉพาะรูปแบบ
    if (cfg.format === 'pdf') {
      colOpt.append(el('div', 'cmp-sub', tt('ui.xhub.pdfOpts')));
      const mk = (k, labelKey) => {
        const c = chk(cfg.pdf[k]);
        c.onchange = () => { cfg.pdf[k] = c.checked; saveCfg(); refresh(); };
        colOpt.append(optRow(tt(labelKey), c));
      };
      mk('toc', 'ui.xhub.pdfToc');
      mk('titlePages', 'ui.xhub.pdfCover');
      mk('roster', 'ui.xhub.pdfRoster');
      mk('headers', 'ui.xhub.pdfHeaders');
      mk('pageNumbers', 'ui.xhub.pdfNums');
      colOpt.append(el('div', 'k-hint', tt('ui.xhub.pdfFrontNoNum')));
      const wm = el('input', 'k-dlg-input'); wm.id = 'xhub-wm';
      wm.value = cfg.pdf.watermark; wm.placeholder = tt('ui.xhub.pdfWmHint');
      wm.onchange = () => { cfg.pdf.watermark = wm.value.trim(); saveCfg(); refresh(); };
      colOpt.append(el('div', 'xhub-row-lbl', tt('ui.xhub.pdfWm')), wm);
      colOpt.append(el('div', 'k-hint', tt('ui.xhub.pdfNoPrinter')));
    }
    if (cfg.format === 'html') {
      colOpt.append(el('div', 'cmp-sub', tt('ui.xhub.htmlOpts')));
      const c = chk(cfg.html.wysiwyg);
      c.onchange = () => { cfg.html.wysiwyg = c.checked; saveCfg(); refresh(); };
      colOpt.append(optRow(tt('ui.xhub.htmlWysiwyg'), c));
    }
    if (cfg.format === 'rtf') {
      colOpt.append(el('div', 'cmp-sub', tt('ui.xhub.rtfOpts')));
      const inp = el('input', 'k-dlg-input'); inp.type = 'number'; inp.min = '6'; inp.max = '48';
      inp.value = String(num(cfg.rtf.fontPt, 12));
      inp.onchange = () => { cfg.rtf.fontPt = num(inp.value, 12); saveCfg(); refresh(); };
      colOpt.append(el('div', 'xhub-row-lbl', tt('ui.xhub.rtfFontPt')), inp);
    }
  }

  // ---- ขวา: ตัวอย่าง ----
  let built = null;
  let job = 0;
  let busy = false;
  async function refresh() {
    const def = formatDef(cfg.format);
    if (def.handoff) { built = null; warnLbl.textContent = ''; await renderPreview(colPrev, A, cfg, null); return; }
    const gen = ++job;
    colPrev.replaceChildren(el('div', 'dim', tt('ui.xhub.building')));
    busy = true;
    try {
      const r = await buildAll(A, cfg, drafts);
      if (gen !== job) return;                       // มีรอบใหม่แซงแล้ว — ทิ้งผลรอบนี้
      built = r;
      warnLbl.textContent = r && r.warnings.length ? r.warnings.join(' · ') : '';
      await renderPreview(colPrev, A, cfg, r);
    } catch (e) {
      if (gen !== job) return;
      built = null;
      log('error', tt('ui.xhub.buildFail'), e);
      colPrev.replaceChildren(el('div', 'k-hint', tt('ui.xhub.buildFail') + ' — ' + (e && e.message ? e.message : e)));
    } finally { if (gen === job) busy = false; }
  }

  bGo.onclick = async () => {
    const def = formatDef(cfg.format);
    if (def.handoff) return;
    if (!(await A.checkBeforeExport())) return;
    bGo.disabled = true;
    try {
      const r = built && !busy ? built : await withBusy(tt('ui.xhub.building'), () => buildAll(A, cfg, drafts));
      if (!r) { setStatus(tt('ui.xhub.nothingToExport')); return; }
      const done = await writeOut(A, cfg, r);
      if (!done) return;                              // ยกเลิกกล่องบันทึก
      await saveCfg();
      close();
      setStatus(tt('ui.common.exportDone') + done.dest + (done.note ? ' · ' + done.note : ''));
      log('info', tt('ui.xhub.title'), { format: cfg.format, dest: done.dest, kind: r.kind });
    } catch (e) {
      log('error', tt('ui.xhub.exportFail'), e);
      setStatus(tt('ui.xhub.exportFail') + ' — ' + (e && e.message ? e.message : e));
    } finally { bGo.disabled = false; }
  };

  renderFormats(); renderOptions();
  await refresh();
  return { ov, cfg, refresh, close,
           setFormat: (k) => { cfg.format = k; renderFormats(); renderOptions(); return refresh(); },
           build: () => buildAll(A, cfg, drafts) };
}
