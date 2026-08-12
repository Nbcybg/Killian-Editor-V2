// import-sp.js — [alpha.60 ข้อ 62-66] นำเข้าบทภาพยนตร์จาก 5 รูปแบบ
// FDX · Celtx (ZIP+HTML) · Adobe Story (XML) · Fade In Pro (JSON) · Fountain (markup)
// คืน element list → convertToK2Elements → fountain markdown → inject เข้า SPEditor
import { t } from './i18n.js';
import { parseScript, SP_ELEMS, classify, splitCharacter } from './fountain.js';
import JSZip from 'jszip';

// [62-66] ตารางนำเข้าทั้ง 5 รูปแบบ — name/ext ใช้ใน UI · parse รับ content (string|Uint8Array)
export const SP_IMPORTERS = {
  fdx:      { name: 'Final Draft XML',  ext: '.fdx',      filter: 'fdx',      parse: parseFdx },
  celtx:    { name: 'Celtx',            ext: '.celtx',    filter: 'celtx',    parse: parseCeltx },
  astx:     { name: 'Adobe Story',      ext: '.astx',     filter: 'astx',     parse: parseAstx },
  fadein:   { name: 'Fade In Pro',      ext: '.fadein',   filter: 'fadein',   parse: parseFadeIn },
  fountain: { name: 'Fountain',         ext: '.fountain', filter: 'fountain', parse: parseFountainFromText },
};

// [62-66] เปิด dialog → เลือกไฟล์ → ตรวจจับรูปแบบ → parse → inject
export async function importScreenplayDialog(injectFn) {
  // ใช้ kapi.openScreenplayFile() — เปิด dialog พร้อมฟิลเตอร์ทุกฟอร์แมตบท
  const filePath = await kapi.openScreenplayFile();
  if (!filePath) return null;

  const result = await importScreenplay(filePath, null);
  if (!result.ok) {
    alert(t('ui.importSp.importNotOk') + result.error);
    return null;
  }

  const summary = importSummary(result.elements);
  const lines = [
    t('ui.importSp.import') + result.importer,
    t('ui.importSp.file') + filePath.split(/[/\\]/).pop(),
    '',
    t('ui.common.scene3') + summary.scenes + t('ui.importSp.character') + summary.characters,
    t('ui.importSp.dialogue') + summary.dialogueBlocks + t('ui.importSp.caption') + summary.actionBlocks,
    t('ui.importSp.countWord') + summary.words,
    '',
    t('ui.importSp.bodyInNovelScreenplay'),
  ];

  if (!confirm(lines.join('\n'))) return null;

  const markdown = elementsToMarkdown(result.elements);
  if (injectFn) {
    injectFn(markdown, result.format, summary);
  }
  return { markdown, format: result.format, summary };
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
    return { ok: false, error: t('ui.importSp.readFileNotOk') + e.message };
  }

  try {
    const elements = await importer.parse(content);
    return { ok: true, elements, format, importer: importer.name };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
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
  // parseScript คืน [{el, text}] — ใช้ได้เลย
  return parseScript(text);
}

// ===================== แปลง element → fountain markdown =====================
// [62-66] ใช้ prefix จาก SP_ELEMS เพื่อสร้าง fountain markdown ที่ K2 อ่านกลับได้
export function elementsToMarkdown(elements) {
  const lines = [];
  let prevType = 'action';
  let prevBlank = true;

  for (const { el, text } of elements) {
    if (el === 'blank') {
      lines.push('');
      prevBlank = true;
      continue;
    }

    const prefix = SP_ELEMS[el]?.prefix || '';
    let line = prefix + text;

    // กัน round-trip: เช็คว่า classify อ่านกลับได้ element เดิมไหม
    // ถ้าไม่ได้ ให้ใส่ prefix แบบชัดเจนของ element นั้น ๆ จาก SP_ELEMS
    // (เดิมรองรับแค่ action/character/scene จาก ~15 ชนิด — ชนิดอื่นที่ classify เดาผิด
    //  จะเงียบไปเลย เช่น ฉากย่อย/สลับฉาก/ทรานซิชันเข้า ที่มี prefix `$sub `/`$intercut `/`$in `)
    try {
      let [got] = classify(line, prevBlank, prevType);
      if (got !== el && prefix) {
        // prefix สัญลักษณ์เดี่ยว (. ! @ > (( ) เขียนติดข้อความได้ · prefix คำ ($sub …) ต้องมีวรรค
        line = prefix.endsWith(' ') ? prefix + text : prefix + ' ' + text;
        [got] = classify(line, prevBlank, prevType);
        if (got !== el) line = prefix + text;          // แบบไม่มีวรรคยังใกล้เคียงกว่าไม่ใส่เลย
      }
      // [alpha.60r3a] "บรรยาย" ไม่มี prefix ของตัวเองแล้ว (มาตรฐานใหม่ = ข้อความเปล่า)
      // ถ้าอ่านกลับกลายเป็นชนิดอื่น (เช่นโดนตัวจับชื่อตัวละครอัตโนมัติกิน) ต้องบังคับด้วย `!` แบบ v1
      // — ตรงกับที่ `lineFor()` ทำ (โค้ดสองที่นี้ต้องตัดสินใจเหมือนกัน ไม่งั้นนำเข้าแล้วเนื้อเพี้ยน)
      if (got !== el && el === 'action') line = '!' + text;
      // element ที่ไม่มี prefix ของตัวเอง (บทพูด/วงเล็บ) พึ่งบริบทบรรทัดก่อนหน้าล้วน ๆ
      // → ถ้าอ่านกลับไม่ได้ ต้องมี "ชื่อตัวละคร" นำหน้าอยู่แล้ว ไม่มีอะไรให้แก้ตรงนี้
    } catch {}

    lines.push(line);
    prevBlank = false;
    prevType = el;
  }

  return lines.join('\n');
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
