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

/** โมเดลเนื้อหาตามขอบเขตที่เลือก — คืน {model, kind} */
async function buildModel(A, cfg, drafts) {
  if (cfg.scope === 'tab' && state.active && (state.active.editor || state.active.sp)) {
    const t = state.active;
    const body = t.sp ? t.sp.getMarkdown() : t.editor.getMarkdown();
    const model = {
      title: t.title || state.title, author: (state.meta && state.meta.author) || '', roster: '',
      chapters: [{ title: t.title || '', guid: 'tab', scenes: [
        { title: t.title || '', file: t.file, body: String(body || '').trim(),
          synopsis: '', status: '', type: 'scene',
          format: t.sp ? 'screenplay' : 'prose', words: 0 },
      ] }],
    };
    return { model, kind: t.sp ? 'screenplay' : 'prose' };
  }
  const d = drafts.find((x) => x.dPath === cfg.draft) || drafts[0];
  if (!d) return null;
  const model = await A.buildDraftModel(d.dPath);
  return { model, kind: docKind(model) };
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
    if (built.engine === 'pdflib') {
      const { parseScript } = await import('./fountain.js');
      const { buildScriptPdf, projectTitlePages, projectHeaders } = await import('./pdf-ui.js');
      const o = cfg.pdf;
      const r = await buildScriptPdf({
        blocks: parseScript(built.text), title: built.title, fmt: A.spFormat(),
        titlePages: o.titlePages ? projectTitlePages() : [],
        headers: o.headers ? projectHeaders() : { enabled: false },
        opts: { toc: o.toc, titlePages: o.titlePages, headers: o.headers,
                pageNumbers: o.pageNumbers, sceneNumbers: o.pageNumbers,
                watermark: o.watermark, openPage: 0 },
      });
      await kapi.writeBytes(dest, Array.from(r.bytes));
      return { dest, note: ttf('ui.xhub.donePdf', r.pageCount, r.bookmarks.length) };
    }
    // นิยาย → HTML ที่มี @page → printToPDF ในหน้าต่างซ่อน (ได้ตัวอักษรจริง ไม่ใช่ภาพ)
    await kapi.pdfFromHtml(built.html, dest, { height: num(A.spFormat().paper.height, 11) });
    return { dest, note: tt('ui.xhub.donePdfHtml') };
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
  const r = await compose(A, cfg, model, wf);
  const out = { title: model.title, kind, warnings: r.warnings || [],
                text: r.text, html: '', engine: pdfEngine(kind), blocks: null };

  if (cfg.format === 'html') out.html = await proseHtml(A, r.text, model.title, cfg.html.wysiwyg);
  if (cfg.format === 'pdf' && out.engine === 'html')
    out.html = await proseHtml(A, r.text, model.title, true);
  if (cfg.format === 'rtf' || cfg.format === 'fdx' || (cfg.format === 'pdf' && out.engine === 'pdflib')) {
    const { parseScript } = await import('./fountain.js');
    out.blocks = parseScript(r.text);
  }
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

/** วาดช่องตัวอย่าง — หน้ากระดาษจริงสำหรับ PDF · หน้าเว็บจริงสำหรับ HTML · ข้อความสำหรับที่เหลือ */
async function renderPreview(host, A, cfg, built) {
  host.replaceChildren();
  const def = formatDef(cfg.format);
  if (def.handoff) {
    host.append(el('div', 'k-hint xhub-info', tt(def.descKey)));
    return 'info';
  }
  if (!built) { host.append(el('div', 'dim', tt('ui.xhub.noPreview'))); return 'none'; }

  if (cfg.format === 'html' || (cfg.format === 'pdf' && built.engine === 'html')) {
    const fr = el('iframe', 'xhub-frame');
    fr.setAttribute('sandbox', '');                 // ตัวอย่างต้องไม่รันสคริปต์ใด ๆ
    fr.srcdoc = built.html;
    host.append(fr);
    return 'html';
  }
  if (cfg.format === 'pdf') {
    // บทภาพยนตร์ → วาดหน้ากระดาษด้วยตัวเดียวกับ "มุมมองเรียงหน้า" (จัดหน้าชุดเดียวกับที่ PDF ใช้)
    const { renderPageView, pagesOf } = await import('./sp-view.js');
    const fmt = A.spFormat();
    const box = el('div', 'xhub-pages');
    host.append(box);
    const pages = pagesOf(built.blocks || [], fmt);
    renderPageView(box, pages, fmt, { scale: 0.42, gap: 14 });
    return 'page';
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
      mk('headers', 'ui.xhub.pdfHeaders');
      mk('pageNumbers', 'ui.xhub.pdfNums');
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
