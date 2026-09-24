// import-sp.js — [alpha.60 ข้อ 62-66] นำเข้าบทภาพยนตร์จาก 5 รูปแบบ
// FDX · Celtx (ZIP+HTML) · Adobe Story (XML) · Fade In Pro (JSON) · Fountain (markup)
// คืน element list → convertToK2Elements → fountain markdown → inject เข้า SPEditor
import { t, tf } from './i18n.js';
import { parseScript, SP_ELEMS, classify, splitCharacter,
         blockIsBlank, guessNamesForBlocks, blocksToMd } from './fountain.js';
import { el } from './core.js';
import { confirmBox, escClose } from './ui.js';
import JSZip from 'jszip';
import { gi } from './icons.js';
import { errText } from './err-text.js';        // [alpha.162 · W4] ข้อความผิดพลาดที่ผู้ใช้อ่านรู้เรื่อง

// [62-66] ตารางนำเข้าทั้ง 5 รูปแบบ — name/ext ใช้ใน UI · parse รับ content (string|Uint8Array)
export const SP_IMPORTERS = {
  fdx:      { name: 'Final Draft XML',  ext: '.fdx',      filter: 'fdx',      parse: parseFdx },
  celtx:    { name: 'Celtx',            ext: '.celtx',    filter: 'celtx',    parse: parseCeltx },
  astx:     { name: 'Adobe Story',      ext: '.astx',     filter: 'astx',     parse: parseAstx },
  fadein:   { name: 'Fade In Pro',      ext: '.fadein',   filter: 'fadein',   parse: parseFadeIn },
  fountain: { name: 'Fountain',         ext: '.fountain', filter: 'fountain', parse: parseFountainFromText },
};

// [62-66] เปิด dialog → เลือกไฟล์ → ตรวจจับรูปแบบ → parse → **พรีวิว** → inject
//
// [alpha.124 ข้อ 29] รื้อทั้งเส้น — สามอย่างที่ผิดมาตั้งแต่ alpha.60:
//   1. ใช้ `alert()`/`confirm()` ของระบบ ทั้งที่ทั้งโปรแกรมใช้กล่องของตัวเอง
//      (หน้าตาคนละเรื่อง · Esc/ปุ่มไม่เหมือนกัน · บน Electron บางจังหวะไม่เด้งเลย)
//   2. "พรีวิว" มีแต่ตัวเลข — ไม่เคยเห็นเนื้อที่พาร์สได้สักบรรทัด ทั้งที่ตัวพาร์สคือจุดที่พังบ่อยสุด
//   3. ยืนยันแล้ว **ทับเนื้อหาแท็บปัจจุบันทั้งไฟล์** โดยไม่มีทางเลือกและไม่มีทางถอย
//      → ตอนนี้เลือกได้ว่า "สร้างฉากใหม่" (ค่าเริ่มต้น ปลอดภัย) หรือ "แทนที่แท็บนี้"
/**
 * @param {(md:string, format:string, summary:object, mode:'new'|'replace') => any} injectFn
 */
/**
 * @param {Function} injectFn  (markdown, format, summary, mode) => Promise
 * @param {{canReplace?:boolean}} [opts]  [alpha.164] false = ไม่มีแท็บบทที่ทับได้ (ไม่มีแท็บ · แท็บนิยาย · ฉากล็อก)
 *   → ไม่โชว์ปุ่ม "ทับแท็บปัจจุบัน" (เดิมโชว์เสมอ: กดบนแท็บนิยาย = ได้ฉากใหม่แทนเงียบ ๆ ·
 *   กดบนฉากที่ล็อก = เนื้อที่ล็อกไว้ถูกเขียนทับ)
 */
export async function importScreenplayDialog(injectFn, opts = {}) {
  // ใช้ kapi.openScreenplayFile() — เปิด dialog พร้อมฟิลเตอร์ทุกฟอร์แมตบท
  const filePath = await kapi.openScreenplayFile();
  if (!filePath) return null;

  const result = await importScreenplay(filePath, null);
  if (!result.ok) {
    await confirmBox(t('ui.importSp.importNotOk') + result.error, t('ui.common.msg3'));
    return null;
  }

  const summary = importSummary(result.elements);
  summary.title = result.title || '';
  const markdown = elementsToMarkdown(result.elements);
  const mode = await importPreviewDialog({ filePath, result, summary, markdown, canReplace: opts.canReplace !== false });
  if (!mode) return null;

  if (injectFn) await injectFn(markdown, result.format, summary, mode);
  return { markdown, format: result.format, summary, mode };
}

/**
 * กล่องพรีวิวการนำเข้า — เห็นของจริงก่อนตัดสินใจ
 * @returns {Promise<'new'|'replace'|null>} null = ยกเลิก
 */
function importPreviewDialog({ filePath, result, summary, markdown, canReplace = true }) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide imp-sp');
    box.append(el('div', 'k-dlg-title', t('ui.importSp.previewTitle')));

    const meta = el('div', 'imp-sp-meta');
    meta.append(el('div', null, t('ui.importSp.import') + result.importer));
    meta.append(el('div', null, t('ui.importSp.file') + filePath.split(/[/\\]/).pop()));
    meta.append(el('div', null,
      tf('ui.common.scene3F', summary.scenes, summary.characters)));
    meta.append(el('div', null,
      tf('ui.importSp.dialogueF', summary.dialogueBlocks, summary.actionBlocks)));
    meta.append(el('div', null, t('ui.importSp.countWord') + summary.words));
    box.append(meta);

    // เนื้อที่พาร์สได้จริง — จุดที่ผู้ใช้ต้องเห็นก่อนกดตกลง (กฎข้อ 11: textContent เท่านั้น)
    const pre = el('pre', 'imp-sp-pre');
    pre.textContent = markdown.slice(0, 4000) + (markdown.length > 4000 ? '\n…' : '');
    box.append(pre);

    if (!summary.scenes && !summary.dialogueBlocks)
      box.append(el('div', 'k-hint imp-sp-warn', gi('warning') + ' ' + t('ui.importSp.previewEmpty')));

    const done = (v) => { ov.remove(); resolve(v); };
    const btns = el('div', 'k-dlg-btns');
    const bNew = el('button', 'k-ok', t('ui.importSp.asNewScene'));
    bNew.onclick = () => done('new');
    const bRep = el('button', 'k-danger', t('ui.importSp.replaceTab'));
    bRep.onclick = () => done('replace');
    const bCancel = el('button', 'k-cancel', t('ui.common.cancel'));
    bCancel.onclick = () => done(null);
    btns.append(bCancel, ...(canReplace ? [bRep] : []), bNew);
    box.append(btns);
    ov.append(box); document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    escClose(ov, () => done(null));
  });
}

// [62-66] ตรวจจับรูปแบบจากนามสกุลไฟล์
export function detectFormat(filePath) {
  const lower = filePath.toLowerCase();
  for (const [key, imp] of Object.entries(SP_IMPORTERS)) {
    if (lower.endsWith(imp.ext)) return key;
  }
  // .txt อาจเป็น fountain
  if (lower.endsWith('.txt')) return 'fountain';
  return null;
}

// [62-66] นำเข้าไฟล์ — อ่านเนื้อหาแล้วเลือก parser
export async function importScreenplay(filePath, format) {
  if (!format) format = detectFormat(filePath);
  if (!format || !SP_IMPORTERS[format]) {
    return { ok: false, error: t('ui.importSp.notKnownFormatFile') + (filePath.split(/[/\\]/).pop() || filePath) };
  }

  const importer = SP_IMPORTERS[format];
  let content;
  try {
    if (format === 'celtx') {
      // Celtx เป็น ZIP — ต้องอ่านเป็น bytes
      const raw = await kapi.readBytes(filePath);
      content = new Uint8Array(raw);
    } else {
      content = await kapi.readFile(filePath);
    }
  } catch (e) {
    return { ok: false, error: t('ui.importSp.readFileNotOk') + errText(e) };
  }

  try {
    const elements = await importer.parse(content);
    const titlePage = (elements && elements.titlePage) || {};
    return { ok: true, elements, format, importer: importer.name, titlePage,
             title: String(titlePage.title || '').replace(/[_*]/g, '').trim() };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}

// ===================== [62] FDX (Final Draft XML) =====================
// FDX type → K2 element mapping
const FDX_TYPE_MAP = {
  'Scene Heading':    'scene',
  'Action':           'action',
  'Character':        'character',
  'Dialogue':         'dialogue',
  'Parenthetical':    'parenthetical',
  'Transition':       'transition',
  'Shot':             'shot',
  'Cast List':        'raw',
  'New Act':          'act-break',
  'End of Act':       'transition',
  'General':          'action',
  'Scene Number':     'raw',
  'Scene Characters': 'raw',
  'Notes':            'note',
  'Synopsis':         'note',
};

function parseFdx(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const errNode = doc.querySelector('parsererror');
  if (errNode) throw new Error(t('ui.importSp.xMLNotValid') + errNode.textContent);

  const elements = [];
  const paragraphs = doc.querySelectorAll('Paragraph');

  for (const p of paragraphs) {
    const type = (p.getAttribute('Type') || 'General').trim();
    const el = FDX_TYPE_MAP[type] || 'action';

    // FDX เก็บข้อความใน <Text> ย่อย (รองรับ styling แต่เราสนใจ plain text)
    const textNodes = p.querySelectorAll('Text');
    let text;
    if (textNodes.length) {
      text = Array.from(textNodes).map(t => t.textContent || '').join('');
    } else {
      text = p.textContent || '';
    }

    elements.push({ el, text: text.trim() });
  }

  return elements;
}

// ===================== [63] Celtx (ZIP + HTML) =====================
// Celtx type (className) → K2 element
const CELTX_TYPE_MAP = {
  'sceneheading':  'scene',
  'action':        'action',
  'character':     'character',
  'dialogue':      'dialogue',
  'parenthetical': 'parenthetical',
  'transition':    'transition',
  'shot':          'shot',
  'text':          'action',
  'chapter-heading':'act-break',
};

async function parseCeltx(buffer) {
  const zip = new JSZip();
  await zip.loadAsync(buffer);

  // ลำดับความสำคัญ: script/index.html > script.html > index.html
  let htmlFile = zip.file('script/index.html') || zip.file('script.html');
  if (!htmlFile) {
    // ลองหาไฟล์ .html ใด ๆ ใน zip
    const htmlFiles = Object.keys(zip.files).filter(f => f.endsWith('.html') && !f.startsWith('__MACOSX'));
    if (htmlFiles.length) htmlFile = zip.file(htmlFiles[0]);
  }
  if (!htmlFile) {
    throw new Error(t('ui.importSp.notFoundFileHTML'));
  }

  const html = await htmlFile.async('text');
  return parseCeltxHtml(html);
}

function parseCeltxHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = [];

  // Celtx ใช้ <p class="..."> หรือ <div class="...">
  const blocks = doc.querySelectorAll('p, div.script-block, div[class*="scene"], div[class*="character"], div[class*="action"], div[class*="dialogue"]');

  for (const block of blocks) {
    const cls = (block.className || block.getAttribute('class') || '').toLowerCase();
    let el = 'action';

    for (const [cKey, cEl] of Object.entries(CELTX_TYPE_MAP)) {
      if (cls.includes(cKey)) { el = cEl; break; }
    }

    const text = (block.textContent || '').trim();
    if (!text) continue;
    elements.push({ el, text });
  }

  // ถ้าไม่เจอ element จาก className เลย → scan ทั้งหมดเป็น action
  if (!elements.length) {
    const paras = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div');
    for (const p of paras) {
      const text = (p.textContent || '').trim();
      if (text) elements.push({ el: 'action', text });
    }
  }

  return elements;
}

// ===================== [64] Adobe Story (.astx) =====================
const ASTX_TYPE_MAP = {
  'scene_heading':   'scene',
  'scene-heading':   'scene',
  'action':          'action',
  'character':       'character',
  'dialogue':        'dialogue',
  'parenthetical':   'parenthetical',
  'transition':      'transition',
  'shot':            'shot',
  'chapter':         'act-break',
  'act-break':       'act-break',
  'note':            'note',
  'general':         'action',
};

function parseAstx(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const errNode = doc.querySelector('parsererror');
  if (errNode) throw new Error(t('ui.importSp.xMLNotValid') + errNode.textContent);

  const elements = [];

  // Adobe Story ใช้ element หลายชื่อ — ลองทีละแบบ
  const paragraphs = doc.querySelectorAll(
    'paragraph, p, Paragraph, dialogue-block, scene, action, character, transition, note'
  );

  for (const p of paragraphs) {
    const tag = p.tagName.toLowerCase();
    const typeAttr = (p.getAttribute('type') || '').toLowerCase();
    const el = ASTX_TYPE_MAP[typeAttr] || ASTX_TYPE_MAP[tag] || 'action';
    const text = (p.textContent || '').trim();
    if (text) elements.push({ el, text });
  }

  // ใช้ inner element ซ้อน (Story > scene > paragraph)
  if (!elements.length) {
    const els = doc.querySelectorAll('*');
    for (const el of els) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'document' || tag === 'story' || tag === 'script' || tag === 'body') continue;
      if (el.children.length) continue; // ข้าม container — เอา leaf
      const text = (el.textContent || '').trim();
      if (text) {
        const typeAttr = (el.getAttribute('type') || '').toLowerCase();
        const k2el = ASTX_TYPE_MAP[typeAttr] || ASTX_TYPE_MAP[tag] || 'action';
        elements.push({ el: k2el, text });
      }
    }
  }

  return elements;
}

// ===================== [65] Fade In Pro (.fadein) =====================
const FADEIN_TYPE_MAP = {
  'scene-heading':     'scene',
  'scene_heading':     'scene',
  'action':            'action',
  'character':         'character',
  'dialogue':          'dialogue',
  'parenthetical':     'parenthetical',
  'transition':        'transition',
  'shot':              'shot',
  'act-break':         'act-break',
  'chapter-heading':   'act-break',
  'note':              'note',
  'general':           'action',
};

function parseFadeIn(jsonStr) {
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(t('ui.common.jSONNotValid') + e.message);
  }

  const elements = [];

  // Fade In เก็บ element ในหลายรูปแบบ — หาให้เจอ
  const items = data.script || data.elements || data.blocks || data.items || data;

  function processItem(item) {
    if (Array.isArray(item)) {
      for (const sub of item) processItem(sub);
      return;
    }
    if (!item || typeof item !== 'object') return;

    const type = item.type || item.element || item.el || '';
    const text = item.text || item.content || item.value || item.line || '';

    if (type || text) {
      const el = FADEIN_TYPE_MAP[type.toLowerCase()] || 'action';
      if (el === 'dialogue' && !text.trim()) return; // ข้ามบทพูดว่าง
      elements.push({ el, text: String(text).trim() });
    }

    // เจาะลึก children (Fade In nested structure)
    if (item.children) processItem(item.children);
    if (item.content) processItem(item.content);
  }

  processItem(items);
  return elements;
}

// ===================== [66] Fountain =====================
// ใช้ parseScript ที่มีอยู่แล้วใน fountain.js — round-trip การันตีโดย lineFor+classify
function parseFountainFromText(text) {
  // หน้าปกของ Fountain (`Title:` `Author:` … ต้นไฟล์) ไม่ใช่เนื้อบท — เดิมหลุดเข้าไปเป็น "บรรยาย" บรรทัดแรก
  const tp = splitFountainTitlePage(text);
  const els = parseScript(tp.body);
  els.titlePage = tp.fields;
  return els;
}

/**
 * แยกหน้าปกของ Fountain ออกจากเนื้อบท (สเปก: บรรทัด `Key: value` ต่อกันตั้งแต่ต้นไฟล์จนถึงบรรทัดว่างแรก
 * · บรรทัดที่ย่อหน้า = ค่าต่อของคีย์ก่อนหน้า) · ไม่มีหน้าปก = คืนข้อความเดิมทั้งหมด
 * @returns {{fields: Object<string,string>, body: string}}  คีย์เป็นตัวพิมพ์เล็ก (title · author · credit …)
 */
export function splitFountainTitlePage(text) {
  const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/^\ufeff/, '');
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const KEY = /^([A-Za-z][A-Za-z ]{0,30}):\s*(.*)$/;
  if (i >= lines.length || !KEY.test(lines[i])) return { fields: {}, body: src };
  const fields = {};
  let last = '';
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') break;
    const m = KEY.exec(l);
    if (m && !/^\s/.test(l)) { last = m[1].trim().toLowerCase(); fields[last] = m[2].trim(); }
    else if (last && /^\s/.test(l)) fields[last] = (fields[last] ? fields[last] + '\n' : '') + l.trim();
    else return { fields: {}, body: src };          // ไม่ใช่รูปแบบหน้าปก — ถือเป็นเนื้อบทตามเดิม
  }
  return { fields, body: lines.slice(i).join('\n').replace(/^\n+/, '') };
}

// ===================== แปลง element → fountain markdown =====================
// [62-66] ใช้ prefix จาก SP_ELEMS เพื่อสร้าง fountain markdown ที่ K2 อ่านกลับได้
export function elementsToMarkdown(elements) {
  // ตัวเขียนตัวเดียวของโปรแกรม (fountain.js · blocksToMd → lineFor) — เดิมไฟล์นี้มีสำเนาของตัวเอง
  // ที่ต่อ prefix ตรง ๆ: วงเล็บคำกำกับ "(กระซิบ)" กลายเป็น "((" + "(กระซิบ)" = "(((กระซิบ)" บนจอ
  // สองที่ที่ต้องตัดสินเหมือนกันเป๊ะ = บั๊กรอเกิด (ตามที่คอมเมนต์ของ blocksToMd เตือนไว้)
  return blocksToMd((elements || []).map((b) => (b && b.el === 'blank' ? { el: 'action', text: '' } : b)));
}

// [62-66] สรุปสถิติหลังนำเข้า — ใช้ใน dialog ยืนยัน
export function importSummary(elements) {
  const counts = {};
  const chars = new Set();
  let words = 0;

  for (const { el, text } of elements) {
    counts[el] = (counts[el] || 0) + 1;
    if (el === 'character') {
      // ห้ามใช้ text.split('(')[0] — ชื่อที่มีวงเล็บอยู่ในตัว ("ดร. (ปรายฟ้า)") จะถูกตัดผิด
      // splitCharacter() ตัดเฉพาะ "ส่วนเสริมท้ายบรรทัด" ((V.O.)/(ต่อ)) ซึ่งเป็นกติกาเดียวกับตัวแก้ไข
      const { name } = splitCharacter(text);
      if (name) chars.add(name);
    }
    if (text) words += text.split(/[\s\u00A0]+/).filter(Boolean).length;
  }

  return {
    scenes: counts.scene || 0,
    characters: chars.size,
    dialogueBlocks: counts.dialogue || 0,
    actionBlocks: counts.action || 0,
    words,
    counts,
  };
}
