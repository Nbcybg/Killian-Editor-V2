// export-formats.js — [alpha.81 ข้อ 8+9] ตรรกะล้วนของ "ศูนย์รวมการส่งออก"
//
// แยกจาก export-hub.js (ซึ่งแตะ DOM/kapi) เพื่อให้ทดสอบด้วย node ได้ตรง ๆ
// สิ่งที่พังแล้วเจ็บที่สุดอยู่ในไฟล์นี้ทั้งหมด:
//   · เลือกตัวสร้าง PDF ผิดชนิด → บทหนังถูกจัดหน้าแบบนิยาย (หรือกลับกัน)
//   · ขั้นตอน to-html เปิด/ปิดไม่ตรงปลายทาง → .txt เต็มไปด้วยแท็ก / .html เป็นข้อความเปล่า
// import ได้เฉพาะโมดูลบริสุทธิ์ (compile.js · num.js) — **ห้าม import core.js**
import { PRESETS, mkStep } from './compile.js';
import { num } from './num.js';
// [alpha.82] เลขหน้าของเนื้อเรื่องอ่านค่าตั้งต้นชุดเดียวกับหน้าจอ (ไม่บังคับทับอีกแล้ว)
import { PAGE_NUMBER_DEFAULTS } from './sp-format.js';
// [alpha.132 ข้อ 6] เทมเพลตชื่อไฟล์ส่งออก (บริสุทธิ์เหมือนกัน — import ได้)
import { buildExportName, DEFAULT_EXPORT_NAME } from './export-name.js';
import { gi } from './icons.js';

// ═══════════════════════ ส่วนบริสุทธิ์ (ไม่แตะ DOM / ไม่แตะ kapi) ═══════════════════════

/**
 * ปลายทางที่ส่งออกได้ทั้งหมด — **แหล่งความจริงเดียว**
 *  · `ext`      นามสกุลไฟล์
 *  · `preview`  ชนิดช่องตัวอย่าง: 'page' = หน้ากระดาษจริง · 'text' = ข้อความ · 'info' = คำอธิบาย
 *  · `binary`   true = เขียนด้วย writeBytes (กฎ 10) ไม่ใช่ writeFile
 *  · `handoff`  true = ปลายทางนี้มีกล่องตั้งค่าของตัวเองอยู่แล้ว กล่องนี้แค่พาไป
 *  · `needScript` true = ใช้ได้เฉพาะเอกสารที่เป็นบทภาพยนตร์
 */
export const EXPORT_FORMATS = [
  { key: 'pdf',  ext: 'pdf',  icon: gi('file-pdf'), binary: true, preview: 'page',
    labelKey: 'ui.xhub.fPdf', descKey: 'ui.xhub.fPdfDesc' },
  { key: 'html', ext: 'html', icon: gi('globe'), preview: 'html',
    labelKey: 'ui.xhub.fHtml', descKey: 'ui.xhub.fHtmlDesc' },
  { key: 'md',   ext: 'md',   icon: gi('note'), preview: 'text',
    labelKey: 'ui.xhub.fMd', descKey: 'ui.xhub.fMdDesc' },
  { key: 'txt',  ext: 'txt',  icon: gi('file-txt'), preview: 'text',   // [alpha.159 · M36] เดิมฝัง '🅣' ตรง ๆ
    labelKey: 'ui.xhub.fTxt', descKey: 'ui.xhub.fTxtDesc' },
  { key: 'rtf',  ext: 'rtf',  icon: gi('file'), preview: 'text',
    labelKey: 'ui.xhub.fRtf', descKey: 'ui.xhub.fRtfDesc' },
  { key: 'fdx',  ext: 'fdx',  icon: gi('film'), preview: 'text', needScript: true,
    labelKey: 'ui.xhub.fFdx', descKey: 'ui.xhub.fFdxDesc' },
  // [alpha.156] อีบุ๊ก + Word — ประกอบจากมาร์กดาวน์ของเวิร์กโฟลว์ด้วย md.js (export-ebook.js)
  { key: 'epub', ext: 'epub', icon: gi('book-open'), binary: true, preview: 'text',
    labelKey: 'ui.xhub.fEpub', descKey: 'ui.xhub.fEpubDesc' },
  { key: 'docx', ext: 'docx', icon: gi('file'), binary: true, preview: 'text',
    labelKey: 'ui.xhub.fDocx', descKey: 'ui.xhub.fDocxDesc' },
  { key: 'blog', ext: 'html', icon: gi('news'), preview: 'info', handoff: true,
    labelKey: 'ui.xhub.fBlog', descKey: 'ui.xhub.fBlogDesc' },
  { key: 'watermark', ext: 'pdf', icon: gi('water'), preview: 'info', handoff: true, needScript: true,
    labelKey: 'ui.xhub.fWm', descKey: 'ui.xhub.fWmDesc' },
  { key: 'zip',  ext: 'zip',  icon: gi('package'), preview: 'info', handoff: true,
    labelKey: 'ui.xhub.fZip', descKey: 'ui.xhub.fZipDesc' },
  { key: 'json', ext: 'json', icon: gi('receipt'), preview: 'info', handoff: true,
    labelKey: 'ui.xhub.fJson', descKey: 'ui.xhub.fJsonDesc' },
];

export const formatDef = (k) => EXPORT_FORMATS.find((f) => f.key === k) || EXPORT_FORMATS[0];

/**
 * เอกสารชุดนี้เป็น "บทภาพยนตร์" หรือ "นิยาย" — ตัดสินจากฉากส่วนใหญ่ที่ไม่ใช่โน้ต
 * (ฉบับร่างเดียวกันปนกันได้ · เสมอกันให้ถือเป็นนิยาย เพราะเป็นค่าเริ่มต้นของไฟล์ใหม่)
 */
export function docKind(model) {
  let sp = 0, pr = 0;
  for (const ch of (model && model.chapters) || [])
    for (const sc of ch.scenes || []) {
      if (sc.type === 'memo') continue;
      if (sc.format === 'screenplay') sp++; else pr++;
    }
  return sp > pr ? 'screenplay' : 'prose';
}

/**
 * ตัวสร้าง PDF ที่ต้องใช้ — **ไม่มีทางเลือกที่ผ่านเครื่องพิมพ์ของระบบ**
 * @returns {'pdflib'|'html'}
 */
export const pdfEngine = (kind) => (kind === 'screenplay' ? 'pdflib' : 'html');

/**
 * [alpha.81r3] รูปแบบกระดาษฉบับ "ตอนส่งออกจากกล่องนี้" — บังคับให้ **หน้าแรกของเนื้อเรื่องมีเลขหน้า**
 *
 * ธรรมเนียมบทภาพยนตร์คือ "หน้าแรกไม่ใส่เลข" (`pageNumbers.firstPage = false`) ซึ่งถูกต้อง
 * ตอนที่หน้าแรกของไฟล์ = หน้าปก · แต่ในกล่องนี้ **หน้าปกกับหน้ารายชื่อถูกแยกออกไปเป็นหน้าหน้าเล่มแล้ว**
 * หน้าที่เหลือหน้าแรกจึงเป็น "หน้า 1 ของเนื้อเรื่อง" ซึ่งต้องมีเลข — ตรงกับกฎที่ผู้ใช้ให้ไว้:
 * เลขหน้าไม่นับ *เฉพาะ* หน้าปกกับหน้ารายชื่อตัวละคร
 *
 * คืนสำเนาเสมอ — ห้ามแก้ค่าที่ผู้ใช้ตั้งไว้ในโปรเจกต์ (ตัวแก้ไขบนจอยังใช้ธรรมเนียมเดิม)
 */
export function exportPageNumberFmt(fmt) {
  const f = fmt || {};
  // [alpha.82] เดิมบังคับ `firstPage: true` ทับค่าที่ผู้ใช้ตั้ง เพื่อให้หน้าฉากแรกใน PDF มีเลข
  // — แต่หน้าจอไม่ได้ใช้ทางนี้ **จอกับ PDF จึงไม่ตรงกัน** (จอไม่มีเลข 1 แต่ PDF มี)
  // ตอนนี้ค่าเริ่มต้นเป็น true อยู่แล้ว จึงเลิกบังคับ แล้วให้ทั้งสองฝั่งอ่านค่าเดียวกันจริง ๆ
  return { ...f, pageNumbers: { ...PAGE_NUMBER_DEFAULTS, ...(f.pageNumbers || {}) } };
}

/**
 * [trial 2026-10-25 ข้อ 6ก] บรรทัด "เล่ม" ใต้ชื่อเรื่องบนหน้าปกนิยาย
 *
 * ผู้ใช้เจอ: ส่งออกเล่ม 2 ของชุดสองเล่ม แล้วปกเขียนแค่ชื่อโปรเจกต์ — ไม่มีอะไรบอกว่าเป็นเล่มไหน
 * กติกา: ชื่อเล่มที่ซ้ำกับชื่อเรื่อง/ชื่อตั้งต้น (`Book N`) ของโปรเจกต์เล่มเดียว = ไม่ต้องมีบรรทัดนี้ ·
 * ชื่อเล่มที่ขึ้นต้นด้วยชื่อเรื่อง ("ชื่อเรื่อง เล่มที่ 1 …") ตัดส่วนที่ซ้ำออก
 * @returns {string} '' = ไม่ใส่บรรทัดเล่ม
 */
export function coverBookLine(book, title, bookCount = 1) {
  const b = String(book || '').trim();
  const tl = String(title || '').trim();
  if (!b || b === tl) return '';
  if ((+bookCount || 1) <= 1 && /^Book \d+$/i.test(b)) return '';
  if (tl && b.startsWith(tl)) {
    const rest = b.slice(tl.length).replace(/^[\s:·—–-]+/, '').trim();
    return rest;
  }
  return b;
}

/**
 * [trial 2026-10-25 ข้อ 19] `[title]` ของชื่อไฟล์ส่งออก = "ของที่ส่งออก" ไม่ใช่ชื่อโปรเจกต์เสมอ
 * ผู้ใช้เจอ: ส่งออกฉากเดียว/เล่ม 2 แล้วกล่องบันทึกเสนอชื่อโปรเจกต์ทุกครั้ง (ไฟล์ทับกันเอง)
 * ฉากที่เปิด = ชื่อฉาก · ทั้งเล่มในโปรเจกต์ที่มีหลายเล่ม = ชื่อเล่ม · เล่มเดียว = ชื่อโปรเจกต์ (เหมือนเดิม)
 * @returns {{title:string, book:string}} ค่าที่ทับบริบทของโค้ดสั้น
 */
export function exportNameFields(scope, { title = '', project = '', book = '', books = 1 } = {}) {
  if (scope === 'tab') return { title: String(title || project || ''), book: String(book || '') };
  const many = (+books || 1) > 1 && String(book || '').trim();
  return { title: many ? String(book) : String(project || title || ''), book: String(book || '') };
}

/**
 * [trial 2026-10-25 ข้อ 13] โหมดสีของ PDF ตามชนิดเอกสาร — ค่าเริ่มต้น 'auto' = นิยายสี · บทภาพยนตร์ขาวดำ
 * (เดิมขาวดำทั้งคู่: รูปประกอบในนิยายกลายเป็นภาพเทาทั้งเล่มโดยไม่มีอะไรเตือน) · ผู้ใช้เลือกเอง = ตามที่เลือก
 * @returns {'mono'|'color'}
 */
export function pdfColorMode(pdf, kind) {
  const m = pdf && pdf.colorMode;
  if (m === 'color' || m === 'mono') return m;
  return kind === 'screenplay' ? 'mono' : 'color';
}

/** ค่าเริ่มต้นของกล่องส่งออก */
export function defaultHubSettings() {
  return {
    format: 'pdf',
    scope: 'draft',            // 'draft' = ฉบับร่างทั้งเล่ม · 'tab' = ฉาก/บทที่เปิดอยู่
    kind: 'auto',              // 'auto' = ตามชนิดของฉากในเล่ม · 'prose' · 'screenplay' = บังคับ
    draft: '',
    workflow: '',              // '' = เลือกให้อัตโนมัติตามรูปแบบ
    // titlePages = หน้าปก (บทหนัง = หน้าปกของบท · นิยาย = รูปปกจาก "จัดการเล่ม")
    // roster     = หน้ารายชื่อตัวละคร — ทั้งคู่เป็น "หน้าหน้าเล่ม" ที่ **ไม่นับเลขหน้า**
    // [alpha.132 ข้อ 3+4] เลขหน้ากับเลขฉากเป็นคนละสวิตช์ · โหมดสี/ขาวดำ
    // (ค่าเริ่มต้น 'auto' — บทภาพยนตร์ขาวดำตามธรรมเนียมบทถ่ายทำ · นิยายสี: ดู pdfColorMode())
    pdf: { toc: true, titlePages: true, roster: true, headers: true,
           pageNumbers: true, sceneNumbers: true, colorMode: 'auto', watermark: '' },
    html: { wysiwyg: true },
    rtf: { fontPt: 12 },
    // [alpha.170 · คอมเมนต์ไปกลับกับ Word] แนบคอมเมนต์ที่ยังเปิดอยู่ของฉากไปในไฟล์ Word (ส่งให้ บก. ตอบ)
    docx: { comments: false },
  };
}

/** รวมค่าที่จำไว้กับค่าเริ่มต้น (ค่าที่ผิดชนิด/นอกรายการถูกโยนทิ้ง) */
export function normalizeHub(saved) {
  const d = defaultHubSettings();
  const s = saved && typeof saved === 'object' ? saved : {};
  const out = { ...d, ...s };
  out.format = EXPORT_FORMATS.some((f) => f.key === s.format) ? s.format : d.format;
  out.scope = s.scope === 'tab' ? 'tab' : 'draft';
  out.kind = s.kind === 'prose' || s.kind === 'screenplay' ? s.kind : 'auto';
  out.workflow = typeof s.workflow === 'string' ? s.workflow : '';
  out.pdf = { ...d.pdf, ...(s.pdf || {}) };
  out.pdf.watermark = String(out.pdf.watermark || '');
  // ค่าที่บันทึกไว้ก่อนมีฟีเจอร์นี้ไม่มีสองฟิลด์นี้ → ตกกลับเป็นค่าเริ่มต้น (เลขฉากเปิด · สีตามชนิดเอกสาร)
  out.pdf.sceneNumbers = s.pdf && 'sceneNumbers' in s.pdf ? !!s.pdf.sceneNumbers : d.pdf.sceneNumbers;
  out.pdf.colorMode = out.pdf.colorMode === 'color' || out.pdf.colorMode === 'mono' ? out.pdf.colorMode : 'auto';
  out.html = { ...d.html, ...(s.html || {}) };
  out.rtf = { ...d.rtf, ...(s.rtf || {}) };
  out.rtf.fontPt = num(out.rtf.fontPt, 12);
  out.docx = { comments: !!(s.docx && s.docx.comments) };
  return out;
}

/**
 * เวิร์กโฟลว์เนื้อหาที่เหมาะกับรูปแบบปลายทาง เมื่อผู้ใช้ยังไม่ได้เลือกเอง
 * (เลือกจากพรีเซ็ตที่มี ext ตรงกันก่อน แล้วค่อยตกไปหาพรีเซ็ตที่ให้ Markdown ล้วน)
 */
export function defaultWorkflowFor(fmtKey, workflows = PRESETS, kind = '') {
  // [alpha.159 · M6] RTF/FDX ถูกแปลงผ่าน parseScript (เป็น "บท" เสมอ) — เดิมตกไปที่พรีเซ็ต `plain`
  // ซึ่งมีขั้น strip-markdown ตัดรหัสบรรทัด (`.` หัวฉาก · `###`) ทิ้ง → หัวฉากไทยที่ไม่มี INT./EXT.
  // ถูกเดาเป็นชื่อตัวละครแทน · ใช้พรีเซ็ตของบทภาพยนตร์เมื่อเอกสารไม่ใช่นิยาย
  if ((fmtKey === 'rtf' || fmtKey === 'fdx') && kind !== 'prose') {
    const sp = workflows.find((w) => w.id === 'screenplay');
    if (sp) return sp;
  }
  // [alpha.169 · bug hunt] RTF ของนิยายประกอบจากมาร์กดาวน์ (generateProseRtf) — ต้องได้เวิร์กโฟลว์ที่ **ไม่ตัด**
  // เครื่องหมายทิ้ง ไม่งั้นตัวหนา/เอียง/หัวข้อ/รายการหายก่อนถึงตัวสร้างไฟล์ (เดิมตกไปพรีเซ็ต "ข้อความล้วน")
  if (fmtKey === 'pdf' && kind === 'prose') {
    const pp = workflows.find((w) => w.id === 'prose-pdf');
    if (pp) return pp;
  }
  const want = { pdf: 'pdf', html: 'html', txt: 'txt', md: 'md', rtf: kind === 'prose' ? 'md' : 'txt', fdx: 'txt' }[fmtKey] || 'md';
  return (workflows.find((w) => w.ext === want && w.builtIn)
       || workflows.find((w) => w.ext === want)
       || workflows.find((w) => w.id === 'manuscript')
       || workflows[0] || null);
}

/**
 * ปรับเวิร์กโฟลว์ให้เข้ากับปลายทางที่เลือก **โดยไม่แก้ของที่ผู้ใช้บันทึกไว้**
 * ขั้นตอน `to-html` ต้องเปิดเมื่อปลายทางเป็น HTML และปิดในทุกกรณีอื่น —
 * ไม่งั้นได้ .txt ที่เต็มไปด้วยแท็ก หรือ .html ที่เป็นข้อความเปล่า (บั๊กเดิมของกล่องเวิร์กโฟลว์)
 */
export function workflowForFormat(wf, fmtKey) {
  const src = wf || PRESETS[0];
  const wantHtml = fmtKey === 'html';
  const steps = (src.steps || []).map((s) => ({ key: s.key, on: s.on !== false, opts: { ...s.opts } }));
  const i = steps.findIndex((s) => s.key === 'to-html');
  if (wantHtml) { if (i >= 0) steps[i].on = true; else steps.push(mkStep('to-html', true)); }
  else if (i >= 0) steps[i].on = false;
  return { ...src, ext: formatDef(fmtKey).ext, steps };
}

/**
 * ชื่อไฟล์ที่เสนอให้ (ไม่มีอักขระต้องห้ามของ Windows)
 *
 * [alpha.132 ข้อ 6] เดิมเป็น `<ชื่อเรื่อง>.<นามสกุล>` ตายตัว · ตอนนี้เดินผ่าน **เทมเพลตชื่อไฟล์**
 * ที่ผู้ใช้ตั้งเองได้และใช้โค้ดสั้นได้ (`export-name.js`) — ไม่ส่ง `opts` มาก็ได้ผลเท่าเดิมเป๊ะ
 * @param {{template?:string, ctx?:object}} [opts] เทมเพลต + บริบทของโค้ดสั้น
 */
export function suggestName(title, fmtKey, opts) {
  const o = opts || {};
  return buildExportName(o.template || DEFAULT_EXPORT_NAME,
                         { title: String(title || ''), ...(o.ctx || {}) },
                         formatDef(fmtKey).ext);
}

/**
 * [alpha.170 · bug hunt 5] ฟอนต์ของ "เลขหน้า" ในไฟล์ PDF ของนิยาย
 * เลขหน้าถูกประทับด้วย pdf-lib หลัง Chromium พิมพ์เนื้อเรื่อง (ต้องข้ามหน้าปก) — ชุดฟอนต์ที่ส่งให้คือของบทภาพยนตร์
 * (Courier) เลขหน้าของนิยายจึงเป็นตัวพิมพ์ดีดอยู่เล่มเดียวทั้งหน้า · เลขหน้าเป็นตัวเลขล้วน จึงใช้ฟอนต์มาตรฐานของ PDF ได้
 * โดยไม่ต้องฝังไฟล์: เนื้อเรื่องไม่มีเชิง = 'sans' · ตั้งใจใช้ฟอนต์พิมพ์ดีด = '' (ทางเดิม) · นอกนั้น = 'serif'
 */
export function proseNumberFont(stack) {
  const s = String(stack || '').toLowerCase();
  if (!s) return 'serif';
  if (/courier|monospace|consolas|typewriter/.test(s.split(',')[0])) return '';
  const generic = s.split(',').map((x) => x.trim()).filter((x) => x === 'serif' || x === 'sans-serif' || x === 'monospace')[0];
  return generic === 'sans-serif' ? 'sans' : generic === 'monospace' ? '' : 'serif';
}
