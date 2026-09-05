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
// [alpha.116 ข้อ 8] โค้ดสั้น `[title]` — ทะเบียนและตัวแทนค่าอยู่ที่ shortcode.js (บริสุทธิ์ · เทสแยก)
import { expandShortcodes, sceneContext } from './shortcode.js';
// [alpha.58 · 55–56] ส่งออกบทภาพยนตร์พร้อมข้อความต่อเนื่อง — ใช้เอนจินจัดหน้าตัวเดียวกับบนจอ
// [alpha.59 · 88] classify — ใช้ระบุประเภท element ของแต่ละบรรทัดตอน "ตัดออกตอนส่งออก"
import { parseScript, lineFor, classify, blockIsBlank,
         guessNamesFor, guessNamesForBlocks } from './fountain.js';
import { paginate, mergeSpFormat } from './sp-format.js';
import { pagesWithContinueds } from './sp-continued.js';
// [alpha.58r บั๊ก 19] WYSIWYG — HTML ที่ส่งออกต้องใช้ฟอนต์/ช่วงบรรทัด/ย่อหน้า ชุดเดียวกับบนจอ
import { mergeProseFormat, proseExportCss } from './prose-format.js';
// [alpha.132 · X-1] คอมเมนต์ `<!--align:x-->` เป็นรูปแบบของ md.js — ห้ามมีสำเนา regex ที่สอง
import { stripAlign, stripMentions as mdStripMentions, markerVars,
         mdBlocks, inlineHtml as mdInlineHtml } from './md.js';

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
export function omitElements(text, types, { keepBlanks = false } = {}) {
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
  // [alpha.113] **ยกเว้นบทภาพยนตร์** — ที่นั่นบรรทัดว่างคือ "เนื้อหา" ที่ paginate() นับเป็น
  // 1 บรรทัดเต็ม ๆ (ตั้งแต่ alpha.86) การยุบจึงเปลี่ยนการตัดหน้าและกินช่องไฟที่ผู้ใช้ตั้งใจเว้น
  const joined = out.join('\n');
  return keepBlanks ? joined : joined.replace(/\n{3,}/g, '\n\n');
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
  // [alpha.116 ข้อ 8] โค้ดสั้น `[title]` `[chapter]` `[scene]` `[date]` `[wiki:ชื่อ.ฟิลด์}`
  // ต่างจาก {{ตัวแปร}} ตรงที่รู้ "บริบทของฉากที่กำลังส่งออก" ไม่ใช่แค่ตาราง Wiki
  { key: 'shortcodes', stage: 'model', label: t('ui.compile.expandShortcode') },
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
  // == [alpha.132 . X-1] * คอมเมนต์บางตัวไม่ใช่ "คอมเมนต์ของนักเขียน" แต่เป็น **รูปแบบ** ==
  // `<!--align:x-->` (การจัดหน้า) กับ `<!--pagebreak-->` (ขึ้นหน้าใหม่ด้วยมือ) เป็นวิธีที่ .md
  // ของ Killian ใช้เก็บสิ่งที่ไวยากรณ์มาร์กดาวน์ไม่มีให้ - ขั้นตอน "ตัดคอมเมนต์" มีไว้เอา
  // บันทึกส่วนตัวของนักเขียนออก **ไม่ใช่เอารูปแบบของเอกสารออก** - เดิมกลืนทั้งคู่ไปเงียบ ๆ
  // (ผลคือส่งออกแล้วทั้งการจัดหน้าและจุดขึ้นหน้าใหม่หายหมด ทั้งที่ผู้ใช้ไม่ได้สั่งอะไรเลย)
  return s.replace(/%%[\s\S]*?%%/g, '')
    .replace(/<!--[\s\S]*?-->/g, (m) => (KEEP_COMMENT.test(m) ? m : ''));
}
/** คอมเมนต์ที่เป็น **รูปแบบของเอกสาร** ไม่ใช่บันทึกของนักเขียน - ขั้นตอนตัดคอมเมนต์ต้องเว้นไว้ */
const KEEP_COMMENT = /^<!--\s*(?:align:(?:left|center|right|justify)|pagebreak)\s*-->$/i;

// [alpha.132r2] กฎเดียวกับที่ช่องตัวอย่างใช้ — ย้ายไปอยู่ที่ md.js (เจ้าของไวยากรณ์) แล้ว
export function stripMentions(s) { return mdStripMentions(s); }
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
/** escape สำหรับค่าในแอตทริบิวต์ (ต้องกินอัญประกาศคู่ด้วย ไม่งั้นหลุดออกนอกแอตทริบิวต์ได้) */
const escAttr = (s) => esc(s == null ? '' : s).replace(/"/g, '&quot;');
// ══ [alpha.133 · Y-2] ★★ ตัวแปลง inline **ตัวเดียวกับตัวแก้ไข** ══
//
// ผู้ใช้: *"แบบอักษร … มีแค่ Editor อย่างเดียวที่ถูกต้อง"*
//
// ของเดิมที่นี่เป็น regex ชุดที่สอง ซึ่งเดินคนละทางกับ `parseInline()` ของ md.js:
//   · `_ขีดเส้นใต้_` → `<em>` (บนจอเป็น `<u>`)  · `^ตัวยก^` / `~ตัวห้อย~` → ไม่รู้จักเลย
//   · `[[เอนทิตี้]]` → โผล่วงเล็บให้ผู้อ่านเห็น   · `\` ท้ายบรรทัด → พิมพ์แบ็กสแลชออกมาจริง ๆ
// ตอนนี้เรียก `inlineHtml()` ของ md.js (เจ้าของไวยากรณ์) ซึ่งใช้ `parseInline()` ตัวจริง
// และคายแท็กชุดเดียวกับ `toDOM` ของสคีมา — WYSIWYG จึงมาจากตัวเดียวกันโดยโครงสร้าง
//
// [alpha.132r] สีตัวอักษร (`<span style="color:#rrggbb">` ในไฟล์ .md) ก็เดินทางเดียวกันแล้ว —
// `parseInline()` รู้จักสแปนสีเป็นมาร์กอยู่แล้ว จึงไม่ต้องมีขั้น "escape ก่อนแล้วคืนสภาพทีหลัง"
// (ท่าเดิมที่ต้องคอยไล่ตามว่า escape ไปแล้วกี่ชั้น) อีกต่อไป
const inline = (s, mono) => mdInlineHtml(s, { mono });

// แปลง Markdown → ชิ้นส่วน HTML (ไม่มี <html>/<head>) — ใช้ซ้ำได้ทั้ง compile และ export-blog
export function mdToHtmlBody(md, o = {}) {
  const mono = !!o.mono;
  const out = []; let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  let quote = false;
  const closeQuote = () => { if (quote) { out.push('</blockquote>'); quote = false; } };
  const closeAll = () => { closeList(); closeQuote(); };
  // == [alpha.132 . X-1] ** การจัดหน้าต้องเดินทางมาถึง HTML/PDF ==
  //
  // ผู้ใช้จัดกึ่งกลางไว้ในตัวแก้ไข แต่ไฟล์ที่ส่งออกกลับชิดซ้ายหมด - เพราะแผนที่ align
  // เก็บอยู่ใน **frontmatter** ของ .md (ตั้งแต่ alpha.58r ที่อยากให้ไฟล์สะอาด) แล้วสาย
  // ส่งออกหยิบไปแค่ `body` - ตอนนี้ต้นทางยัด align กลับเป็นคอมเมนต์ให้แล้ว ที่นี่จึงต้องอ่าน
  //
  // `data-align` ใส่ไว้ด้วยเพื่อให้ CSS ของรายการ (จุดนำเดินทางไปกับข้อความ) จับได้
  // ด้วยตัวเลือกชุดเดียวกับในตัวแก้ไขเป๊ะ - WYSIWYG ต้องมาจากกฎเดียวกัน ไม่ใช่กฎคู่ขนาน
  const attrOf = (a) => (a ? ` style="text-align:${a}" data-align="${a}"` : '');
  // ══ [alpha.133 · Y-1] ★ สคีมาบล็อกมาจาก `mdBlocks()` ของ md.js ที่เดียว ══
  // (ของเดิมเป็นลูป regex ชุดที่สองที่ไม่รู้จักรั้วโค้ด · hard break · ขึ้นหน้าใหม่ด้วยมือ
  //  · ลำดับเริ่มต้นของรายการเลข — ทั้งสี่อย่างนี้จึงหายไปจากไฟล์ที่ส่งออกมาตลอด)
  for (const b of mdBlocks(md, { breakMarker: PAGE_BREAK })) {
    const al = b.align;
    if (b.kind === 'pagebreak') { closeAll(); out.push('<div class="pb"></div>'); continue; }
    if (b.kind === 'hr') { closeAll(); out.push('<hr>'); continue; }
    if (b.kind === 'figure') {
      closeAll();
      // โครงเดียวกับ `toDOM` ของโหนด figure ในตัวแก้ไข (รูปเดี่ยวใน <figure> ไม่มีคำบรรยาย)
      out.push(`<figure${attrOf(al)}><img alt="${escAttr(b.alt)}" src="${escAttr(b.src)}"></figure>`);
      continue;
    }
    if (b.kind === 'code') {
      // [alpha.133 · Y-1] รั้วโค้ดเคยหลุดออกมาเป็นย่อหน้าที่มีข้อความ ``` ในไฟล์ที่ส่งออก
      closeAll();
      out.push('<pre' + (b.lang ? ` data-lang="${escAttr(b.lang)}"` : '') + '><code>'
               + esc(b.text) + '</code></pre>');
      continue;
    }
    if (b.kind === 'h') {
      closeAll();
      out.push(`<h${b.level}${attrOf(al)}>${inline(b.text, mono)}</h${b.level}>`);
      continue;
    }
    if (b.kind === 'quote') {
      closeList();
      if (!quote) { out.push('<blockquote>'); quote = true; }
      out.push(`<p${attrOf(al)}>${inline(b.text, mono)}</p>`);
      continue;
    }
    if (b.kind === 'li') {
      closeQuote();
      const want = b.ordered ? 'ol' : 'ul';
      if (list !== want) {
        closeList();
        // [alpha.133 · Y-1] `3.` ต้องเริ่มนับที่ 3 เหมือนในตัวแก้ไข (mdToDoc เก็บ attrs.order)
        out.push(want === 'ol' && b.num > 1 ? `<ol start="${b.num}">` : `<${want}>`);
        list = want;
      }
      // ย่อหน้าใน <li> ถือ align เอง (ตรงกับสคีมาของตัวแก้ไข ที่ลูกของ li เป็น <p>)
      // [alpha.132r3 ข้อ 3] `<li>` พก "รูปแบบของจุดนำ" ไปด้วย — มาจากอักษรตัวแรกของข้อ
      // (โหมดขาวดำไม่ต้องพกสี เพราะ CSS บังคับดำทั้งแผ่นอยู่แล้ว)
      const mv = mono ? '' : markerVars(b.text);
      out.push(`<li${mv ? ` style="${mv}"` : ''}><p${attrOf(al)}>`
               // ข้อที่ว่างเปล่าต้องมีกล่องบรรทัดจริง ไม่งั้นสูง 0 แล้วหายไปจากหน้า
               + `${b.text ? inline(b.text, mono) : '<br>'}</p></li>`);
      continue;
    }
    // ── ย่อหน้า ──
    closeAll();
    // ══ [alpha.132 ข้อ 1] ★★ บรรทัดว่าง = **ย่อหน้าว่างจริง** ไม่ใช่ตัวคั่นย่อหน้า ══
    //
    // .md ของ Killian เป็นรูปแบบ **หนึ่งบรรทัด = หนึ่งบล็อก** (ไม่ใช่ Markdown มาตรฐานที่ใช้
    // บรรทัดว่างเป็นตัวคั่นย่อหน้า) → `<br>` คือกล่องบรรทัดของย่อหน้าว่าง ตรงกับที่
    // ProseMirror ใส่ให้ในตัวแก้ไข (`ProseMirror-trailingBreak`)
    const parts = (b.lines && b.lines.length ? b.lines : [b.text]);
    const html = parts.map((l) => inline(l, mono)).join('<br>');
    out.push(html.trim() || parts.length > 1
      ? `<p${attrOf(al)}>${html}</p>` : '<p class="k-blank"><br></p>');
  }
  closeAll();
  // ย่อหน้าว่างที่หัว/ท้ายไม่ใช่ระยะเว้นที่ผู้ใช้ตั้งใจ (ไฟล์ที่ลงท้ายด้วยขึ้นบรรทัดใหม่มีเสมอ)
  // — ปล่อยไว้จะได้หน้าว่างแถมท้ายเล่ม
  const BLANK = '<p class="k-blank"><br></p>';
  while (out.length && out[0] === BLANK) out.shift();
  while (out.length && out[out.length - 1] === BLANK) out.pop();
  return out.join('\n');
}

/**
 * แปลง Markdown → หน้า HTML เต็ม (หัวข้อ/ย่อหน้า/ยกคำพูด/รายการ/เส้นคั่น/รูป)
 * [alpha.58r บั๊ก 19] `style` = รูปแบบนิยายที่ใช้อยู่ (prose-format) — ไม่ส่ง = ค่ามาตรฐานนิยาย
 * เดิมฝัง Sarabun 18px/1.85 ตายตัว → เขียนอย่างหนึ่ง ส่งออกได้อีกอย่าง (ผิดหลัก WYSIWYG)
 */
export function mdToHtml(md, title, style = null, paper = null, margins = null, o = {}) {
  const css = proseExportCss(mergeProseFormat(style), paper, margins,
                             { fontStack: o && o.fontStack, headingStack: o && o.headingStack })
    // [alpha.132r] โหมดขาวดำ = **บังคับทุกอย่างเป็นดำ** ที่ชั้น CSS (สีหัวข้อ/สีคำพูดยกมา/
    // สีตัวอักษรที่ผู้เขียนตั้งเอง) + ทำรูปเป็นโทนเทา — ตรงกับความหมายของคำว่า "ขาวดำ"
    + (o && o.mono
      ? String.fromCharCode(10) + 'body,body *{color:#000 !important}'
        + String.fromCharCode(10) + 'img{filter:grayscale(1)}'
      : '');
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<title>${esc(title || '')}</title>
<style>
${css}
</style></head><body>
${mdToHtmlBody(md, o)}
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

/**
 * ══ [alpha.113] เอกสารชุดนี้เป็นบทภาพยนตร์ไหม ══
 *
 * **ตรรกะเดียวกับ `docKind()` ใน export-formats.js** — ที่นั่น `import` ไฟล์นี้อยู่แล้ว
 * จึงย้อนกลับมา import ไม่ได้ (วงกลม) · มี unit test ล็อกไว้ว่าสองที่ต้องตอบตรงกันเสมอ
 */
export function modelIsScreenplay(model) {
  let sp = 0, pr = 0;
  for (const ch of (model && model.chapters) || [])
    for (const sc of ch.scenes || []) {
      if (sc.type === 'memo') continue;
      if (sc.format === 'screenplay') sp++; else pr++;
    }
  return sp > pr;
}

/**
 * มีฉากที่เป็นบทภาพยนตร์อยู่ไหม (แม้แค่ฉากเดียว)
 *
 * **ทำไมไม่ใช้เสียงข้างมากแบบ `docKind()`**: ฉบับร่างจริงของผู้ใช้ปนกันได้
 * (7 ฉาก เป็นบทแค่ฉากเดียว) — ถ้าตัดสินด้วยเสียงข้างมาก ฉากบทฉากนั้นจะโดนกฎของนิยาย
 * แล้วบรรทัดว่างหายไปทั้งฉาก · การเก็บบรรทัดว่างต้องตัดสิน **รายฉาก** เสมอ
 */
export function modelHasScreenplay(model) {
  for (const ch of (model && model.chapters) || [])
    for (const sc of ch.scenes || []) {
      if (sc.type === 'memo') continue;
      if (sc.format === 'screenplay') return true;
    }
  return false;
}

function modelStats(model) {
  let sc = 0, w = 0;
  for (const ch of model.chapters) for (const s of ch.scenes) { sc++; w += s.words || 0; }
  return { chapters: model.chapters.length, scenes: sc, words: w };
}

export function runWorkflow(model0, workflow,
    { allowJs = true, varCtx = {}, spFormat = null, now = null,
      proseFormat = null, paper = null, margins = null, keepBlanks,
      // [alpha.132r3 ข้อ 1] สแตกฟอนต์ที่ใช้จริงบนจอ — ไม่ส่งมาก็ใช้ของ proseFormat ตามเดิม
      fontStack = '', headingStack = '',
      // ══ [alpha.133 · Y-3] ★★ "ผลลัพธ์นี้จะถูกตีความเป็นมาร์กดาวน์ต่อไหม" ══
      //
      // ผู้ใช้: *"การจัดหน้า … มีแค่ layout อย่างเดียวที่ถูกต้อง"*
      //
      // ต้นตอ: ท้ายฟังก์ชันนี้ตัดคอมเมนต์ `<!--align:x-->` ทิ้งเมื่อ `ext !== 'html'`
      // ซึ่ง **จริงสำหรับ PDF ด้วย** (ext = 'pdf') — แต่ PDF ของนิยายไม่ได้จบที่นี่
      // มันเดินต่อไปเข้า `mdToHtml()` ในกล่องส่งออก · การจัดหน้าจึงถูกลบทิ้งไปก่อน
      // จะถึงตัวที่รู้จักมันหนึ่งก้าวพอดี = ไฟล์ PDF ชิดซ้ายทั้งเล่มเสมอ
      //
      // true = ผู้เรียกจะแปลงมาร์กดาวน์ต่อเอง → เก็บคอมเมนต์รูปแบบและตัวคั่นหน้าไว้ให้ครบ
      markdownOut = false } = {}) {
  // [alpha.116 ข้อ 8] เวลาที่โค้ดสั้น `[date]` ใช้ — ฉีดเข้ามาได้เพื่อให้เทสคาดเดาผลได้
  const shortcodeNow = now || new Date();
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
  // ══ [alpha.113 ★ ต้นตอ "PDF ตัดหน้าผิด บรรทัดว่างถูกลบทิ้ง"] ══
  //
  // ผู้ใช้: *"ใน markdown มี 41 บรรทัด แต่ใน pdf น่าจะแค่ 30 บรรทัด บรรทัดว่างถูกลบทิ้ง"*
  //
  // ไปป์ไลน์นี้ประกอบข้อความให้ **ทั้งนิยายและบท** แต่กฎ "จัดระเบียบช่องว่าง" ที่ถูกต้อง
  // สำหรับนิยาย (ยุบบรรทัดว่างซ้อนให้เหลือหนึ่ง = ย่อหน้ามาร์กดาวน์ปกติ) **ทำลายบทภาพยนตร์**
  // เพราะที่นั่นบรรทัดว่างเป็นเนื้อหาจริงที่ `paginate()` นับเป็น 1 บรรทัด (alpha.86)
  //
  // วัดจากไฟล์จริงของผู้ใช้ (A4 · 58 บรรทัด/หน้า): 41 บรรทัด (ว่าง 22) → `.trim()` เหลือ 39
  // → ยุบ `\n{3,}` เหลือ **28** (ว่าง 9) เพราะมีช่วงว่างติดกัน 3, 4 และ 7 บรรทัด
  // ผลคือ PDF ที่ออกจาก "ศูนย์รวมการส่งออก" ได้ **1 หน้า** ขณะที่ตัวแก้ไขเห็น 2 หน้า
  // (ทางที่ส่งออกจากแท็บบทโดยตรงไม่ผ่านที่นี่ จึงถูกอยู่แล้ว — คนละไปป์ไลน์กัน)
  // ══ [alpha.132 ข้อ 1] ★★ บรรทัดว่างเป็น "เนื้อหา" ทั้งสองโหมด — เลิกแยกตามชนิดเอกสาร ══
  //
  // alpha.113 เก็บช่องไฟให้ **เฉพาะฝั่งบท** โดยให้เหตุผลว่านิยายเป็นมาร์กดาวน์ปกติที่บรรทัดว่าง
  // เป็นแค่ตัวคั่นย่อหน้า — **ซึ่งไม่จริงสำหรับ .md ของ Killian** ที่เป็นรูปแบบ
  // "หนึ่งบรรทัด = หนึ่งบล็อก": `mdToDoc('ก\n\n\n\nข')` ให้ย่อหน้าว่าง 3 ใบ และ `docToMd`
  // เขียนกลับได้ตรงเป๊ะ · ตัวแก้ไขก็แสดงย่อหน้าว่างพวกนั้นจริง ๆ
  // → ผู้ใช้: *"pdf ออกมา บรรทัดว่างหาย"* คืออาการของกฎเดิมข้อนี้ตรง ๆ (และเป็นเหตุให้
  //   เนื้อเลื่อนขึ้นทั้งเรื่องจน "ตัดหน้าไม่ตรง" ตามมาเป็นลูกโซ่)
  // `keepBlanks` ที่ผู้เรียกส่งมายังชนะเสมอ (ทางเรียกที่อยากได้มาร์กดาวน์แบบเว็บยังสั่งได้)
  const keepFor = (sc) => (keepBlanks === undefined ? true : !!keepBlanks);
  const squashAll = keepBlanks === undefined ? false : !keepBlanks;

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
          s.body = omitElements(s.body || '', types, { keepBlanks: keepFor(s) });
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
      // [alpha.116 ข้อ 8] แทนโค้ดสั้น — บริบทสร้างใหม่ต่อฉาก (ฉากรู้ว่าตัวเองอยู่บทไหน ลำดับที่เท่าไร)
      case 'shortcodes': {
        let ci = 0;
        for (const c of model.chapters) {
          ci++;
          let si = 0;
          for (const s of c.scenes) {
            si++;
            // [alpha.121] model.book/language/appVersion/stats มาจาก buildDraftModel() แล้ว —
            // sceneContext อ่าน model.book/.language/.appVersion เองจาก model ที่ส่งมาทั้งก้อน
            const ctx = sceneContext({ model, chapter: c, scene: s, chapterNo: ci, sceneNo: si,
                                       vars: varCtx, now: shortcodeNow, stats: model.stats });
            s.body = expandShortcodes(s.body || '', ctx);
            s.title = expandShortcodes(s.title || '', ctx);
          }
        }
        break;
      }
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
      // บท: ตัดแค่ช่องว่างท้าย (กันซ้อนกับ `''` ที่ push ตามหลัง) — ช่องไฟข้างในเป็นเนื้อหา
      // ══ [alpha.132 ข้อ 1] ★★ ฝั่งนิยายก็เหมือนกัน — เพิ่งรู้ว่ากฎเดิมผิดมาตลอด ══
      // ผู้ใช้: *"pdf ออกมา บรรทัดว่างหาย"*
      // alpha.113 แก้เรื่องนี้ให้ฝั่งบทไปแล้ว แต่เว้นฝั่งนิยายไว้ด้วยเหตุผลว่า "นิยาย = มาร์กดาวน์
      // ปกติ ที่บรรทัดว่างเป็นแค่ตัวคั่นย่อหน้า" — **ซึ่งไม่จริงสำหรับ .md ของ Killian**:
      // รูปแบบนี้คือ "หนึ่งบรรทัด = หนึ่งบล็อก" · `mdToDoc('ก\n\n\n\nข')` ให้ย่อหน้าว่าง 3 ใบ
      // และ `docToMd` เขียนกลับได้ตรงเป๊ะ → บรรทัดว่างในนิยายก็เป็น **เนื้อหาจริง** เท่ากับฝั่งบท
      // เหลือแค่ตัด **ช่องว่างหัว/ท้ายฉาก** ซึ่งเป็นเศษจากการประกอบ ไม่ใช่ช่องไฟที่ผู้เขียนตั้งใจ
      const b = keepFor(s) ? String(s.body || '').replace(/\s+$/, '')
                           : String(s.body || '').trim();
      if (b) out.push(b, '');
    }
  }
  if (has('stats')) {
    out.push('---', '', t('ui.compile.summaryStats'), '',
             tf('ui.compile.chapter', st0.chapters), tf('ui.compile.scene', st0.scenes),
             tf('ui.compile.wordAll', st0.words.toLocaleString()),
             tf('ui.compile.timeReadMin', Math.max(1, Math.round(st0.words / 250))), '');
  }
  // `.trim()` ของทั้งเอกสารยังทำทั้งสองโหมด — บรรทัดว่างหัว/ท้ายสุดเป็นเศษจากโครงประกอบ
  // (ปก/หัวบท/ตัวคั่น) ไม่ใช่ช่องไฟที่ผู้เขียนตั้งใจ · ที่ห้ามแตะคือช่องว่าง **ข้างใน**
  // [alpha.132 ข้อ 1] เดิมยุบ `\n{3,}` ของ **ทั้งเอกสาร** ซึ่งกลืนช่องไฟที่ผู้เขียนตั้งใจไปด้วย
  // สิ่งที่ต้องยุบจริง ๆ คือ "บรรทัดว่างที่โครงประกอบใส่เอง" = สมาชิกว่าง ๆ ของ `out` ที่ติดกัน
  // (หัวบท/หัวฉาก/สถิติ ต่างก็ push `''` ตามหลังตัวเอง แล้วมาชนกับ `''` หลังเนื้อฉากก่อนหน้า)
  // ยุบที่ระดับสมาชิกจึงสะอาดเท่าเดิมตรงรอยต่อ โดย **ไม่แตะเนื้อฉากแม้แต่บรรทัดเดียว**
  let lines = out;
  if (squashAll) {
    lines = [];
    for (const x of out) {
      if (x === '' && lines.length && lines[lines.length - 1] === '') continue;
      lines.push(x);
    }
  }
  let text = lines.join('\n');
  text = text.trim() + '\n';

  // ---- 3) ช่วงข้อความสุดท้าย ----
  let ext = workflow.ext || 'md';
  for (const st of at('text')) {
    if (st.key === 'sp-continued') {
      try { text = insertContinueds(text, spFormat); }
      catch (e) { warn.push(t('ui.compile.insertTextContNot') + e.message); }
      continue;
    }
    if (st.key === 'to-html') {
      // [alpha.132r3 ข้อ 1] ปลายทาง .html ก็ต้องได้ฟอนต์ชุดเดียวกับบนจอ (ผู้เรียกส่งมาให้)
      text = mdToHtml(text, model.title, proseFormat, paper, margins,
                      { fontStack, headingStack });
      ext = 'html'; continue;
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
  if (ext !== 'html' && !markdownOut) {
    text = text.split(PAGE_BREAK).join('\f');
    // [alpha.132 . X-1] `.md`/`.txt`/`.rtf` ที่ส่งออกเป็น "ต้นฉบับแบน" ไม่ใช่ไฟล์โปรเจกต์
    // -> เอาคอมเมนต์รูปแบบออก ไม่งั้นผู้อ่านเห็น align โผล่กลางเรื่อง
    text = text.replace(/<!--\s*align:(?:left|center|right|justify)\s*-->/gi, '');
  }
  return { text, ext, stats: st0, warnings: warn };
}
