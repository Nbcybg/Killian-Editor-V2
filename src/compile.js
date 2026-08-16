// ระบบ "เวิร์กโฟลว์ส่งออก" (compile workflows)
// แนวคิด: ฉบับร่าง 1 ชุด → ส่งออกได้หลายแบบ โดยประกอบจาก "ขั้นตอน" ที่เปิด/ปิด/สลับลำดับได้
//
// ไปป์ไลน์ 3 ช่วง (stage) — ลำดับภายในช่วงเดียวกันมีผลจริง
//   1) model  — คัดกรอง/แปลงตัวเนื้อหา (ตัดโน้ต, เอาเฉพาะเรื่องย่อ, ลอกมาร์กดาวน์ ฯลฯ)
//   2) render — ประกอบเป็นข้อความ (หน้าปก, หัวบท, ชื่อฉาก, ตัวคั่น, ขึ้นหน้าใหม่, สรุปสถิติ)
//   3) text   — แปลงข้อความสุดท้าย (→ HTML, สคริปต์เอง)
//
// model = { title, author, chapters: [ { title, scenes: [ {title, body, synopsis, status, type, words} ] } ] }
// ไฟล์นี้ "บริสุทธิ์" (ไม่แตะ DOM/ไฟล์) เพื่อให้เทสตรงๆ ได้

import { t, tf } from './i18n.js';
import { resolveVars } from './template-vars.js';
// [alpha.58 · 55–56] ส่งออกบทภาพยนตร์พร้อมข้อความต่อเนื่อง — ใช้เอนจินจัดหน้าตัวเดียวกับบนจอ
// [alpha.59 · 88] classify — ใช้ระบุประเภท element ของแต่ละบรรทัดตอน "ตัดออกตอนส่งออก"
import { parseScript, lineFor, classify, blockIsBlank,
         guessNamesFor, guessNamesForBlocks } from './fountain.js';
import { paginate, mergeSpFormat } from './sp-format.js';
import { pagesWithContinueds } from './sp-continued.js';
// [alpha.58r บั๊ก 19] WYSIWYG — HTML ที่ส่งออกต้องใช้ฟอนต์/ช่วงบรรทัด/ย่อหน้า ชุดเดียวกับบนจอ
import { mergeProseFormat, proseExportCss } from './prose-format.js';

export const PAGE_BREAK = t('ui.compile.msg');

/**
 * [alpha.58 · 55–56] แทรก (CONTINUED)/CONTINUED:/(MORE)/(cont'd) ลงในข้อความบทที่ประกอบเสร็จแล้ว
 * ใช้ตอน "ส่งออก" เท่านั้น — ไฟล์งานจริงไม่เก็บข้อความพวกนี้ (บนจอวาดเป็น decoration)
 * @param {string} text ข้อความบทแบบ fountain
 * @param {object} fmt  รูปแบบบท (sp-format) — ไม่ส่ง = ค่ามาตรฐาน Letter
 * @returns {string} ข้อความเดิม + เครื่องหมายต่อเนื่อง + ตัวคั่นหน้า
 */
export function insertContinueds(text, fmt) {
  const f = mergeSpFormat(fmt);
  const pages = pagesWithContinueds(paginate(parseScript(String(text ?? '')), { fmt: f }), f);
  const out = [];
  // ตัวเดาชื่ออัตโนมัติคิดจาก "ทั้งบท" ไม่ใช่ทีละหน้า — ต้องตรงกับตอนอ่านไฟล์กลับ
  const guessNames = guessNamesForBlocks(pages.flatMap((p) => p.blocks || []));
  pages.forEach((pg, i) => {
    if (i) out.push('', PAGE_BREAK, '');
    let prevBlank = true, prevType = 'action';
    const bl = pg.blocks || [];
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      if (b.el === 'continued-top' || b.el === 'continued-bottom' || b.el === 'more') {
        out.push(b.text || ''); prevBlank = false; continue;
      }
      // บล็อกถัดไปว่างไหม — ตัวจับชื่อตัวละครอัตโนมัติใน classify ต้องรู้ (ดู fountain.js)
      const nextBlank = blockIsBlank(bl[i + 1]);
      const line = lineFor(b.el, b.text || '', prevBlank, prevType, nextBlank, guessNames);
      out.push(line);
      if (!String(line).trim()) prevBlank = true;
      else { prevBlank = false; prevType = b.el; }
    }
  });
  return out.join('\n');
}

/**
 * [alpha.59 · 88] ตัด element ของบทภาพยนตร์ออกจากข้อความตอนส่งออก
 * ("PDF per-element omit" ของ Trelby — โน้ต/สรุป/โครง ไว้ดูเองตอนเขียน ไม่ต้องติดไปกับบท)
 *
 * ทำที่ระดับ "บรรทัด" ด้วย classify() ตัวเดียวกับตัวแก้ไข → ไม่ต้องแปลงเป็นบล็อกแล้วประกอบใหม่
 * (การประกอบใหม่ไม่ใช่ round-trip ที่ปิดวง — บทเรียน 43/60)
 *
 * บรรทัดที่ถูกตัดจะ **ไม่อัปเดตบริบท** (prevBlank/prevType) เพราะข้อความผลลัพธ์ไม่มีบรรทัดนั้น
 * แล้ว → บรรทัดถัดไปต้องถูกจัดประเภทเหมือนไม่เคยมีโน้ตคั่นอยู่
 *
 * @param {string} text  ข้อความบทแบบ fountain
 * @param {string|string[]} types  ประเภทที่ตัด เช่น 'note,summary' หรือ ['note']
 */
export function omitElements(text, types) {
  const drop = new Set((Array.isArray(types) ? types : String(types ?? '').split(','))
    .map((s) => String(s).trim()).filter(Boolean));
  const s = String(text ?? '');
  if (!drop.size || !s) return s;
  const out = [];
  let prevBlank = true, prevType = 'action', prevLine;
  const src = s.split('\n');
  const guessNames = guessNamesFor(s);
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    // ส่ง prevLine ด้วยเหมือน parseScript — `((…))` ต้องแยก "โน้ต" ออกจาก "วงเล็บใต้ตัวละคร" ให้ถูก
    // และส่งบรรทัดถัดไปว่างไหม + ตัวเดาชื่อ — ต้องตัดสินเหมือน parseScript เป๊ะ ไม่งั้นตัด element ผิดตัว
    const [el] = classify(line, prevBlank, prevType, prevLine,
                          i + 1 >= src.length || src[i + 1].trim() === '', guessNames);
    prevLine = line;
    if (el === 'blank') { out.push(''); prevBlank = true; continue; }
    if (drop.has(el)) continue;
    out.push(line);
    prevBlank = false; prevType = el;
  }
  // ตัดโน้ตที่มีบรรทัดว่างขนาบทั้งสองข้าง เหลือช่องว่างซ้อน → ยุบให้เหลือบรรทัดว่างเดียว
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** ประเภทที่ให้เลือกตัดได้ (ข้อ 88) — เนื้อบทหลัก (หัวฉาก/บรรยาย/บทพูด) ไม่อยู่ในรายการ */
export const OMIT_CHOICES = ['note', 'summary', 'outline1', 'outline2', 'outline3', 'image'];

export const STEP_DEFS = [
  // ---- ช่วงเนื้อหา ----
  { key: 'skip-memo', stage: 'model', label: t('ui.compile.cutNoteMemoOut') },
  // [alpha.59 · 88] ตัด element ทีละประเภท — ค่าเริ่มต้นตัดแค่ ((โน้ต)) เพราะ # ## ###
  // ในโหมดนิยายคือ "หัวข้อ" ไม่ใช่ "โครง" (เปิดตัดโครงกับไฟล์นิยายจะกินหัวข้อไปด้วย)
  { key: 'omit-elements', stage: 'model', label: t('ui.compile.screenplayNotMergeElement'),
    opts: { types: 'note', drawRectAroundNotes: false },
    fields: [
      { k: 'types', label: t('ui.compile.typeCutOut') + OMIT_CHOICES.join(', ') + ')',
        type: 'text' },
      { k: 'drawRectAroundNotes', label: t('ui.compile.drawFrameRoundNote'),
        type: 'check' },
    ] },
  { key: 'filter-status', stage: 'model', label: t('ui.compile.onlySceneStatus'),
    opts: { status: t('ui.compile.writeDoneCheckDone') },
    fields: [{ k: 'status', label: t('ui.compile.status'), type: 'text' }] },
  { key: 'synopsis-only', stage: 'model', label: t('ui.compile.useSynopsisReplaceBody') },
  { key: 'number-scenes', stage: 'model', label: t('ui.compile.putNumOrderPage') },
  { key: 'strip-comments', stage: 'model', label: t('ui.compile.cutComment') },
  { key: 'strip-mentions', stage: 'model', label: t('ui.compile.linkNameText') },
  { key: 'strip-markdown', stage: 'model', label: t('ui.compile.cutMarkdownText') },
  { key: 'resolve-vars', stage: 'model', label: t('ui.compile.editItemNameWiki') },
  // ---- ช่วงประกอบ ----
  { key: 'cover', stage: 'render', label: t('ui.compile.coverTitleAuthorCount'),
    opts: { author: '' }, fields: [{ k: 'author', label: t('ui.compile.authorEmptyUseProject'), type: 'text' }] },
  // [97] หน้ารายชื่อตัวละคร (Cast of Characters) ประจำเล่ม — ปิดได้ที่นี่ หรือที่สวิตช์ในหน้ารายชื่อเอง
  { key: 'roster', stage: 'render', label: t('ui.compile.pageListCharacterCast') },
  { key: 'chapter-heading', stage: 'render', label: t('ui.compile.headChapter'),
    opts: { template: '## {title}' },
    fields: [{ k: 'template', label: t('ui.compile.formatUseNTitle'), type: 'text' }] },
  { key: 'scene-heading', stage: 'render', label: t('ui.compile.nameScene'),
    opts: { template: '### {title}' },
    fields: [{ k: 'template', label: t('ui.compile.formatUseNTitle'), type: 'text' }] },
  { key: 'scene-meta', stage: 'render', label: t('ui.compile.statusCountWordScene') },
  { key: 'scene-separator', stage: 'render', label: t('ui.compile.itemBetweenScene'),
    opts: { text: '* * *' }, fields: [{ k: 'text', label: t('ui.compile.text'), type: 'text' }] },
  { key: 'page-break', stage: 'render', label: t('ui.compile.pageBreakAllChapter') },
  { key: 'stats', stage: 'render', label: t('ui.compile.nextSummaryStats') },
  // ---- ช่วงข้อความสุดท้าย ----
  // [alpha.58 · 55–56] เฉพาะบทภาพยนตร์ — ปิดไว้ในทุกพรีเซ็ต (นิยายไม่ต้องใช้)
  { key: 'sp-continued', stage: 'text',
    label: t('ui.compile.screenplayInsertCONTINUEDMORE') },
  { key: 'to-html', stage: 'text', label: t('ui.compile.hTML') },
  { key: 'js', stage: 'text', label: t('ui.compile.javaScript'),
    opts: { code: t('ui.compile.textTextDoneRestore') },
    fields: [{ k: 'code', label: t('ui.compile.codeHasItemText'), type: 'code' }] },
];

export const stepDef = (k) => STEP_DEFS.find((s) => s.key === k) || null;

// ขั้นตอนหนึ่งชิ้นพร้อมค่าเริ่มต้น
export function mkStep(key, on = true, opts = null) {
  const d = stepDef(key);
  return { key, on, opts: { ...(d && d.opts ? d.opts : {}), ...(opts || {}) } };
}

const wf = (id, name, ext, keys) => ({
  id, name, ext, builtIn: true,
  steps: keys.map((k) => (Array.isArray(k) ? mkStep(k[0], true, k[1]) : mkStep(k))),
});

// พรีเซ็ตสำเร็จรูป — ก๊อบไปแก้เป็นของตัวเองได้ (ปุ่ม "ทำสำเนา")
export const PRESETS = [
  wf('manuscript', t('ui.compile.sourceMarkdown'), 'md',
     ['skip-memo', 'chapter-heading', 'scene-separator']),
  wf('reader', t('ui.compile.draftPersonRead'), 'md',
     ['cover', 'skip-memo', 'strip-comments', 'chapter-heading', 'scene-separator']),
  wf('editor', t('ui.compile.draftEditor'), 'md',
     ['cover', 'skip-memo', 'number-scenes', 'chapter-heading', 'scene-heading',
      'scene-meta', 'stats']),
  wf('synopsis', t('ui.common.synopsis'), 'md',
     ['skip-memo', 'synopsis-only', 'chapter-heading', ['scene-heading', { template: '**{title}**' }]]),
  wf('plain', t('ui.compile.textTxt'), 'txt',
     ['skip-memo', 'strip-comments', 'strip-mentions', 'strip-markdown',
      ['chapter-heading', { template: '{title}' }], 'scene-separator']),
  wf('html', t('ui.compile.webHTML'), 'html',
     ['cover', 'skip-memo', 'chapter-heading', 'scene-separator', 'to-html']),
  wf('print', t('ui.compile.readyPrintHTMLPageBreak'), 'html',
     ['cover', 'skip-memo', 'chapter-heading', 'page-break', 'scene-separator', 'to-html']),
  // [alpha.58r บั๊ก 13] พรีเซ็ตของ "บทภาพยนตร์" — เดิมไม่มีพรีเซ็ตไหนเปิด sp-continued เลย
  // ผู้ใช้จึงต้องไปเปิดเองทุกครั้ง (และส่วนใหญ่ไม่รู้ว่ามีฟีเจอร์นี้)
  // [alpha.59 · 88] ตัด ((โน้ต)) ออกด้วย — โน้ตของนักเขียนไม่ควรติดไปกับบทที่ส่งให้คนอื่นอ่าน
  wf('screenplay', t('ui.compile.screenplayCONTINUEDMORE'), 'txt',
     ['skip-memo', 'strip-comments', ['omit-elements', { types: 'note' }], 'sp-continued']),
  // [alpha.59 · 69] ปลายทางเป็น PDF ที่ตัวสร้างในโปรแกรมเขียนให้ (สารบัญ + หน้าปก + หัวกระดาษ)
  // ไม่เปิด sp-continued เพราะตัวสร้าง PDF จัดหน้าเองแล้วใส่ CONTINUED ให้ตอนวาด
  wf('screenplay-pdf', t('ui.compile.screenplayPDFTocCover'), 'pdf',
     ['skip-memo', 'strip-comments', ['omit-elements', { types: 'note' }]]),
];

export function newWorkflow(name) {
  return { id: 'wf-' + Date.now().toString(36), name: name || t('ui.compile.workFlowNew'), ext: 'md',
           builtIn: false, steps: STEP_DEFS.map((d) => mkStep(d.key, false)) };
}

// ทำสำเนาพรีเซ็ตให้แก้ได้ + เติมขั้นตอนที่ยังไม่มีเป็นแบบ "ปิดไว้"
export function cloneWorkflow(src, name) {
  const have = new Set((src.steps || []).map((s) => s.key));
  return {
    id: 'wf-' + Date.now().toString(36), name: name || (src.name + t('ui.common.msg')),
    ext: src.ext || 'md', builtIn: false,
    steps: [...(src.steps || []).map((s) => ({ key: s.key, on: s.on !== false, opts: { ...s.opts } })),
            ...STEP_DEFS.filter((d) => !have.has(d.key)).map((d) => mkStep(d.key, false))],
  };
}

// ---------------- ตัวช่วยแปลงข้อความ ----------------
export function stripComments(s) {
  return s.replace(/%%[\s\S]*?%%/g, '').replace(/<!--[\s\S]*?-->/g, '');
}
export function stripMentions(s) {
  return s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
}
export function stripMarkdown(s) {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')      // รูป → ข้อความแทน
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // ลิงก์ → ข้อความ
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')            // หัวข้อ
    .replace(/^\s{0,3}>\s?/gm, '')                 // ยกคำพูด
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '')     // รายการ
    .replace(/^\s{0,3}(-{3,}|\*{3,})\s*$/gm, '')   // เส้นคั่น
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (m, a, u) => `<img alt="${a}" src="${u}">`)
  .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
  .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
  .replace(/(?<!_)_(?!_)([^_]+)_(?!_)/g, '<em>$1</em>')
  .replace(/~~(.*?)~~/g, '<del>$1</del>');

// แปลง Markdown → ชิ้นส่วน HTML (ไม่มี <html>/<head>) — ใช้ซ้ำได้ทั้ง compile และ export-blog
export function mdToHtmlBody(md) {
  const out = []; let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === PAGE_BREAK) { closeList(); out.push('<div class="pb"></div>'); continue; }
    if (!line.trim()) { closeList(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { closeList(); out.push('<hr>'); continue; }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`); continue;
    }
    const bq = /^\s*>\s?(.*)$/.exec(line);
    if (bq) { closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }
    closeList(); out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

/**
 * แปลง Markdown → หน้า HTML เต็ม (หัวข้อ/ย่อหน้า/ยกคำพูด/รายการ/เส้นคั่น/รูป)
 * [alpha.58r บั๊ก 19] `style` = รูปแบบนิยายที่ใช้อยู่ (prose-format) — ไม่ส่ง = ค่ามาตรฐานนิยาย
 * เดิมฝัง Sarabun 18px/1.85 ตายตัว → เขียนอย่างหนึ่ง ส่งออกได้อีกอย่าง (ผิดหลัก WYSIWYG)
 */
export function mdToHtml(md, title, style = null, paper = null, margins = null) {
  const css = proseExportCss(mergeProseFormat(style), paper, margins);
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<title>${esc(title || '')}</title>
<style>
${css}
</style></head><body>
${mdToHtmlBody(md)}
</body></html>`;
}

// escape สำหรับผู้เรียกภายนอก (ชื่อเรื่อง/ชื่อบทที่มาจากผู้ใช้)
export const escapeHtml = esc;

// ---------------- ไปป์ไลน์ ----------------
const fill = (tpl, n, title, ctx = {}) => {
  let s = String(tpl == null ? '' : tpl)
    .replace(/\{n\}/g, n).replace(/\{title\}/g, title);
  return resolveVars(s, ctx);
};

function modelStats(model) {
  let sc = 0, w = 0;
  for (const ch of model.chapters) for (const s of ch.scenes) { sc++; w += s.words || 0; }
  return { chapters: model.chapters.length, scenes: sc, words: w };
}

export function runWorkflow(model0, workflow,
    { allowJs = true, varCtx = {}, spFormat = null,
      proseFormat = null, paper = null, margins = null } = {}) {
  const warn = [];
  // สำเนาลึกแบบพอเพียง — ไม่แก้ของเดิม
  const model = { title: model0.title, author: model0.author || '', roster: model0.roster || '',
    chapters: (model0.chapters || []).map((c) => ({ ...c, scenes: (c.scenes || []).map((s) => ({ ...s })) })) };
  const steps = (workflow.steps || []).filter((s) => s.on !== false);
  const at = (stage) => steps.filter((s) => (stepDef(s.key) || {}).stage === stage);
  const opt = (key, k, dflt) => {
    const s = steps.find((x) => x.key === key);
    const v = s && s.opts ? s.opts[k] : undefined;
    return v === undefined || v === null ? dflt : v;
  };
  const has = (key) => steps.some((s) => s.key === key);

  // ---- 1) ช่วงเนื้อหา ----
  for (const st of at('model')) {
    const o = st.opts || {};
    switch (st.key) {
      case 'skip-memo':
        for (const c of model.chapters) c.scenes = c.scenes.filter((s) => s.type !== 'memo');
        break;
      // [alpha.59 · 88] ตัด element ตามประเภทออกจากทุกฉาก
      case 'omit-elements': {
        const types = o.types === undefined ? 'note' : o.types;
        for (const c of model.chapters) for (const s of c.scenes)
          s.body = omitElements(s.body || '', types);
        break;
      }
      case 'filter-status': {
        const want = String(o.status || '').split(',').map((x) => x.trim()).filter(Boolean);
        if (want.length) for (const c of model.chapters)
          c.scenes = c.scenes.filter((s) => want.includes(String(s.status || '').trim()));
        break;
      }
      case 'synopsis-only':
        for (const c of model.chapters) for (const s of c.scenes) s.body = (s.synopsis || '').trim();
        break;
      case 'number-scenes': {
        let i = 0;
        for (const c of model.chapters) for (const s of c.scenes) s.title = `${++i}. ${s.title || ''}`;
        break;
      }
      case 'strip-comments':
        for (const c of model.chapters) for (const s of c.scenes) s.body = stripComments(s.body || '');
        break;
      case 'strip-mentions':
        for (const c of model.chapters) for (const s of c.scenes) s.body = stripMentions(s.body || '');
        break;
      case 'strip-markdown':
        for (const c of model.chapters) for (const s of c.scenes) s.body = stripMarkdown(s.body || '');
        break;
      case 'resolve-vars':
        for (const c of model.chapters) for (const s of c.scenes) {
          s.body = resolveVars(s.body || '', varCtx);
          s.title = resolveVars(s.title || '', varCtx);
        }
        break;
      default: break;
    }
  }

  // ---- 2) ช่วงประกอบข้อความ ----
  const out = [];
  const st0 = modelStats(model);
  // [alpha.81r ข้อ 6] "ส่งออกไม่ควรมีหัวเรื่อง ชื่อไฟล์ มานะ"
  // เดิมกิ่ง else ยัด `# <ชื่อเรื่อง>` ลงไป **เสมอ** แม้เวิร์กโฟลว์จะไม่ได้เปิดขั้นตอน "หน้าปก"
  // → ส่งออกฉากเดียวก็ได้ชื่อไฟล์เป็นหัวข้อ h1 ติดมาด้วยทุกครั้ง ลบไม่ได้เลยสักทาง
  // ตอนนี้ชื่อเรื่องมาจากขั้นตอน "หน้าปก" ที่เดียว — ไม่เปิด = ไม่มี
  if (has('cover')) {
    if (String(model.title || '').trim()) out.push('# ' + model.title, '');
    const au = String(opt('cover', 'author', '') || model.author || '').trim();
    if (au) out.push(au, '');
    out.push(tf('ui.compile.wordChapterScene', st0.words.toLocaleString(), st0.chapters, st0.scenes), '');
    if (has('page-break')) out.push(PAGE_BREAK, '');
  }
  // [97] หน้ารายชื่อตัวละคร — วางก่อนเนื้อเรื่อง แล้วขึ้นหน้าใหม่
  if (has('roster') && String(model.roster || '').trim()) {
    out.push(String(model.roster).trim(), '');
    if (has('page-break')) out.push(PAGE_BREAK, '');
  }
  const sep = String(opt('scene-separator', 'text', '* * *'));
  let cn = 0;
  for (const ch of model.chapters) {
    cn++;
    if (has('page-break') && cn > 1) out.push(PAGE_BREAK, '');
    // [alpha.81r ข้อ 6] บท/ฉากที่ไม่มีชื่อ ต้องไม่ได้หัวข้อเปล่า (`##` ลอย ๆ)
    // — เกิดกับการส่งออก "ฉากที่เปิดอยู่" ซึ่งไม่มีชื่อบทให้ใช้
    if (has('chapter-heading') && String(ch.title || '').trim())
      out.push(fill(opt('chapter-heading', 'template', '## {title}'), cn, ch.title || '', varCtx), '');
    let sn = 0;
    for (const s of ch.scenes) {
      sn++;
      if (has('scene-separator') && sn > 1 && sep.trim()) out.push(sep, '');
      if (has('scene-heading') && String(s.title || '').trim())
        out.push(fill(opt('scene-heading', 'template', '### {title}'), sn, s.title || '', varCtx), '');
      if (has('scene-meta'))
        out.push(tf('ui.compile.word', s.status || t('ui.compile.notSpecifyStatus'), (s.words || 0).toLocaleString()), '');
      const b = String(s.body || '').trim();
      if (b) out.push(b, '');
    }
  }
  if (has('stats')) {
    out.push('---', '', t('ui.compile.summaryStats'), '',
             tf('ui.compile.chapter', st0.chapters), tf('ui.compile.scene', st0.scenes),
             tf('ui.compile.wordAll', st0.words.toLocaleString()),
             tf('ui.compile.timeReadMin', Math.max(1, Math.round(st0.words / 250))), '');
  }
  let text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // ---- 3) ช่วงข้อความสุดท้าย ----
  let ext = workflow.ext || 'md';
  for (const st of at('text')) {
    if (st.key === 'sp-continued') {
      try { text = insertContinueds(text, spFormat); }
      catch (e) { warn.push(t('ui.compile.insertTextContNot') + e.message); }
      continue;
    }
    if (st.key === 'to-html') {
      text = mdToHtml(text, model.title, proseFormat, paper, margins); ext = 'html'; continue;
    }
    if (st.key === 'js') {
      if (!allowJs) { warn.push(t('ui.compile.skipStepJavaScriptClose')); continue; }
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('text', 'model', String((st.opts || {}).code || 'return text;'));
        const r = fn(text, model);
        if (typeof r === 'string') text = r;
        else warn.push(t('ui.compile.stepJavaScriptCantRestore'));
      } catch (e) { warn.push(t('ui.compile.stepJavaScriptError') + e.message); }
    }
  }
  if (ext !== 'html') text = text.split(PAGE_BREAK).join('\f');
  return { text, ext, stats: st0, warnings: warn };
}
