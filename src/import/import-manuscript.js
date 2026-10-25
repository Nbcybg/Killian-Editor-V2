// import-manuscript.js — [alpha.170 · นำเข้าต้นฉบับ] Word (.docx) · Markdown (.md) · ข้อความ (.txt / วาง) → เล่มใหม่
//
// ที่มา: ผลสำรวจผู้ใช้ — "ย้ายงานเก่าเข้ามาไม่ได้" (อันดับ 3 · ~81 คน) · ผู้ใช้สั่งลำดับงาน 3 → 6 → 2 → 8
// บริสุทธิ์ 100% (ไม่แตะ DOM/fs/zip) — ชั้น UI แตกไฟล์ .docx เองแล้วส่ง XML เป็นข้อความเข้ามา (`import-manuscript-ui.js`)
//
// ทางเดิน:
//   docxToDoc({ document, styles, numbering, rels })  ─┐
//   mdToImportDoc(text) · textToImportDoc(text)        ─┴→ { content:[โหนดแบบ ProseMirror JSON], images, stats }
//   splitManuscript(docs, { mode })                     → { chapters:[{ title, scenes:[{ title, content }] }], counts, warnings }
//   buildBookPlan(structure, { … })                     → รายการไฟล์ของเล่มใหม่ (section.json · draft.json · scenes.json · ฉาก .md · รูป)
//
// ★ เนื้อฉากเขียนด้วย `docToMd()` ตัวจริงของ md.js — ไฟล์ที่ได้จึงเป็นรูปเดียวกับที่ผู้ใช้พิมพ์เองในตัวแก้ไขทุกไบต์
//   (หนึ่งบรรทัด = หนึ่งย่อหน้า · `\` ท้ายบรรทัด = ขึ้นบรรทัดในย่อหน้า) — ห้ามประกอบมาร์กดาวน์เองในไฟล์นี้
// ★ ข้อความ/คำเตือนคืนเป็น "รหัส" (`code`) — ชั้น UI แปลเอง (โมดูลนี้ไม่เรียก t())

import { parseXml } from './import-scrivener.js';
import { mdToDoc, docToMd, dumpMdFile, parseMdFile, countWords } from '../md.js';
import { diskBase, freeName, DEFAULT_BOOK } from '../disk-names.js';

// ────────────────────────────────────────────────────────────────
// 0) ตัวช่วยของต้นไม้ XML (ชื่อแท็กมีคำนำหน้า namespace — เทียบด้วย "ชื่อท้องถิ่น")
// ────────────────────────────────────────────────────────────────
const local = (tag) => String(tag || '').replace(/^[\w.-]+:/, '');
const kids = (n) => (n && n.children) || [];
const child = (n, name) => kids(n).find((c) => local(c.tag) === name) || null;
const attr = (n, name) => {
  if (!n) return undefined;
  for (const [k, v] of Object.entries(n.attrs || {})) if (local(k) === name) return v;
  return undefined;
};
function descend(n, name, out = []) {
  for (const c of kids(n)) { if (local(c.tag) === name) out.push(c); descend(c, name, out); }
  return out;
}
/** ค่า on/off ของ OOXML: ไม่มีแอตทริบิวต์ = เปิด · "0"/"false"/"none" = ปิด */
const onOff = (n) => !!n && !/^(0|false|off|none)$/i.test(String(attr(n, 'val') ?? '1'));

// ────────────────────────────────────────────────────────────────
// 1) styles.xml · numbering.xml · document.xml.rels
// ────────────────────────────────────────────────────────────────

/**
 * styleId → { level (1–6 = หัวข้อ · 0 = ไม่ใช่), quote, title }
 * ★ ตัดสินจาก **ชื่อมาตรฐาน** (`heading 1` · `Title`) หรือ `outlineLvl` — ไม่ใช่ styleId
 *   (Word ภาษาอื่นตั้ง styleId เป็นภาษาท้องถิ่น แต่ `w:name` ของสไตล์ในตัวเป็นอังกฤษเสมอ)
 * สไตล์ที่ผู้ใช้สร้างเองโดยสืบจากหัวข้อ (`basedOn`) นับเป็นหัวข้อระดับเดียวกัน
 */
export function docxStyles(xml) {
  const raw = new Map();
  if (xml) {
    for (const st of descend(parseXml(xml), 'style')) {
      if ((attr(st, 'type') || 'paragraph') !== 'paragraph') continue;
      const id = attr(st, 'styleId');
      if (!id) continue;
      const name = String(attr(child(st, 'name'), 'val') || '').trim().toLowerCase();
      const ppr = child(st, 'pPr');
      const ol = attr(child(ppr, 'outlineLvl'), 'val');
      raw.set(id, { name, outline: ol == null ? null : +ol, basedOn: attr(child(st, 'basedOn'), 'val') || '' });
    }
  }
  const out = new Map();
  const resolve = (id, seen = new Set()) => {
    if (out.has(id)) return out.get(id);
    const s = raw.get(id);
    if (!s || seen.has(id)) return { level: 0, quote: false, title: false };
    seen.add(id);
    let level = 0, title = false;
    const hm = /^heading\s*(\d)$/.exec(s.name);
    if (hm) level = Math.min(6, Math.max(1, +hm[1]));
    else if (s.name === 'title') { level = 1; title = true; }
    else if (Number.isFinite(s.outline) && s.outline >= 0 && s.outline < 9) level = Math.min(6, s.outline + 1);
    const quote = /quote/.test(s.name);
    let res = { level, quote, title };
    if (!level && !quote && s.basedOn) {
      const b = resolve(s.basedOn, seen);
      res = { level: b.level, quote: b.quote, title: b.title };
    }
    out.set(id, res);
    return res;
  };
  for (const id of raw.keys()) resolve(id);
  return out;
}

/** numId → (ilvl → ordered?) — `bullet`/`none` = รายการจุด · อื่น ๆ (decimal · thaiNumbers …) = รายการเลข */
export function docxNumbering(xml) {
  const out = new Map();
  if (!xml) return out;
  const root = parseXml(xml);
  const abs = new Map();
  for (const a of descend(root, 'abstractNum')) {
    const lv = new Map();
    for (const l of kids(a).filter((c) => local(c.tag) === 'lvl')) {
      const fmt = String(attr(child(l, 'numFmt'), 'val') || 'decimal');
      lv.set(+(attr(l, 'ilvl') || 0), !/^(bullet|none)$/i.test(fmt));
    }
    abs.set(attr(a, 'abstractNumId'), lv);
  }
  for (const n of descend(root, 'num')) {
    const lv = abs.get(attr(child(n, 'abstractNumId'), 'val'));
    if (lv) out.set(String(attr(n, 'numId')), lv);
  }
  return out;
}

/** rId → ทางไฟล์ภายในแพ็กเกจ (`word/media/image1.png`) */
export function docxRels(xml) {
  const out = new Map();
  if (!xml) return out;
  for (const r of descend(parseXml(xml), 'Relationship')) {
    const id = attr(r, 'Id'), target = String(attr(r, 'Target') || '');
    if (!id || /^external$/i.test(attr(r, 'TargetMode') || '')) continue;
    const p = target.startsWith('/') ? target.slice(1) : 'word/' + target;
    out.set(id, p.replace(/\/\.\//g, '/'));
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// 2) document.xml → โหนดแบบ ProseMirror JSON (ชนิดเดียวกับที่ md.js รู้จัก)
// ────────────────────────────────────────────────────────────────

// ของในย่อหน้าที่ "เดินลึกลงไป" (ห่อ run ไว้) · ของที่ข้ามทั้งก้อน
const P_WRAP = new Set(['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'customXml', 'fldSimple', 'moveTo', 'dir', 'bdo']);
const P_SKIP = new Set(['pPr', 'del', 'moveFrom', 'proofErr', 'bookmarkStart', 'bookmarkEnd', 'commentRangeStart',
  'commentRangeEnd', 'permStart', 'permEnd', 'sdtPr', 'sdtEndPr', 'oMath', 'oMathPara']);
const JC = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' };

function runMarks(rPr) {
  const m = [];
  if (!rPr) return m;
  if (onOff(child(rPr, 'b'))) m.push('strong');
  if (onOff(child(rPr, 'i'))) m.push('em');
  const u = child(rPr, 'u');
  if (u && !/^none$/i.test(String(attr(u, 'val') || 'single'))) m.push('underline');
  if (onOff(child(rPr, 'strike')) || onOff(child(rPr, 'dstrike'))) m.push('strike');
  return m;
}

/** ชิ้นของย่อหน้า: [{text, marks}] · {br} · {img: rId} · {page} */
function paraPieces(p) {
  const out = [];
  // ฟิลด์ (สารบัญ · เลขหน้า · ลิงก์): begin → รหัสฟิลด์ → separate → ผลที่แสดง → end · ซ้อนกันได้
  // เก็บเฉพาะ "ผลที่แสดง" · ฟิลด์ที่ไม่มี separate ก็ปิดที่ end
  const fields = [];
  const walkRun = (r) => {
    const marks = runMarks(child(r, 'rPr'));
    for (const c of kids(r)) {
      const k = local(c.tag);
      if (k === 'fldChar') {
        const tp = attr(c, 'fldCharType');
        if (tp === 'begin') fields.push('code');
        else if (tp === 'separate' && fields.length) fields[fields.length - 1] = 'result';
        else if (tp === 'end') fields.pop();
        continue;
      }
      if (fields.includes('code')) continue;
      if (k === 't') out.push({ text: c.text, marks });
      else if (k === 'tab') out.push({ text: '\t', marks });
      else if (k === 'noBreakHyphen') out.push({ text: '-', marks });
      else if (k === 'br' || k === 'cr') {
        if (attr(c, 'type') === 'page') out.push({ page: true });
        else if (attr(c, 'type') !== 'column') out.push({ br: true });
      } else if (k === 'drawing' || k === 'pict' || k === 'object' || k === 'AlternateContent') {
        // รูป: <a:blip r:embed> (DrawingML) · <v:imagedata r:id> (VML รุ่นเก่า) — ข้อความในกล่องข้อความข้าม
        const blip = descend(c, 'blip')[0];
        const rid = blip ? attr(blip, 'embed') : attr(descend(c, 'imagedata')[0], 'id');
        if (rid) out.push({ img: rid, alt: String(attr(descend(c, 'docPr')[0], 'descr') || '') });
      }
    }
  };
  const walk = (n) => {
    for (const c of kids(n)) {
      const k = local(c.tag);
      if (P_SKIP.has(k)) continue;
      if (k === 'r') walkRun(c);
      else if (P_WRAP.has(k)) walk(c);
    }
  };
  walk(p);
  return out;
}

/** ชิ้นของย่อหน้า → inline nodes (รวม run ที่รูปแบบเดียวกันติดกัน · ช่องว่างหัว/ท้ายไม่ถูกห่อด้วยรูปแบบ) */
function inlineNodes(pieces) {
  const out = [];
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  for (const pc of pieces) {
    if (pc.br) { out.push({ type: 'hard_break' }); continue; }
    if (pc.text == null || pc.text === '') continue;
    const last = out[out.length - 1];
    if (last && last.type === 'text' && same(last._m, pc.marks)) { last.text += pc.text; continue; }
    out.push({ type: 'text', text: pc.text, _m: pc.marks });
  }
  // ตัดช่องว่างหัว/ท้ายของ "ทั้งย่อหน้า" · hard_break หัว/ท้ายทิ้ง
  while (out.length && out[0].type === 'hard_break') out.shift();
  while (out.length && out[out.length - 1].type === 'hard_break') out.pop();
  if (out.length && out[0].type === 'text') out[0].text = out[0].text.replace(/^[ \t ]+/, '');
  const z = out[out.length - 1];
  if (z && z.type === 'text') z.text = z.text.replace(/[ \t ]+$/, '');
  const res = [];
  for (const n of out) {
    if (n.type !== 'text') { res.push(n); continue; }
    if (!n.text) continue;
    if (!n._m.length || !n.text.trim()) { res.push({ type: 'text', text: n.text }); continue; }
    // ช่องว่างหัว/ท้ายของช่วงที่มีรูปแบบ → ย้ายออกนอกเครื่องหมาย (`** คำ**` อ่านกลับไม่ได้)
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.text);
    if (m[1]) res.push({ type: 'text', text: m[1] });
    res.push({ type: 'text', text: m[2], marks: n._m.map((type) => ({ type })) });
    if (m[3]) res.push({ type: 'text', text: m[3] });
  }
  return res;
}

const plainOf = (content) => (content || []).map((n) => (n.type === 'text' ? n.text : n.type === 'hard_break' ? ' ' : '')).join('').trim();

/**
 * document.xml (+ styles/numbering/rels) → { content, images, stats }
 * @param {{document:string, styles?:string, numbering?:string, rels?:string}} parts
 * @param {{keyPrefix?:string}} [opts]
 * @returns {{content:object[], images:Array<{key:string, path:string, alt:string}>, stats:{paragraphs:number, headings:number, images:number, tables:number}}}
 *   `images[].key` = ค่าที่อยู่ใน `figure.attrs.src` จนกว่า buildBookPlan จะเปลี่ยนเป็นทางไฟล์จริง
 */
export function docxToDoc(parts = {}, opts = {}) {
  const keyPrefix = opts.keyPrefix || 'k2img:';      // หลายไฟล์ในการนำเข้าครั้งเดียว = คนละคำนำหน้า (รูปไม่ชนกัน)
  const styles = docxStyles(parts.styles);
  const numbering = docxNumbering(parts.numbering);
  const rels = docxRels(parts.rels);
  const root = parseXml(parts.document || '');
  const body = descend(root, 'body')[0] || root;
  const content = [];
  const images = [];
  const seenImg = new Map();
  const stats = { paragraphs: 0, headings: 0, images: 0, tables: 0 };
  let list = null;                                 // { node, numId, ordered } — รายการที่กำลังต่อ

  const pushBlock = (n) => { if (n.type !== 'bullet_list' && n.type !== 'ordered_list') list = null; content.push(n); };
  const figureOf = (pc) => {
    const path = rels.get(pc.img);
    if (!path) return null;
    let key = seenImg.get(path);
    if (!key) {
      key = keyPrefix + (images.length + 1);
      seenImg.set(path, key);
      images.push({ key, path, alt: pc.alt || '' });
    }
    stats.images++;
    return { type: 'figure', attrs: { src: key, alt: pc.alt || '', md: '' } };
  };

  const doPara = (p) => {
    const pPr = child(p, 'pPr');
    const st = styles.get(attr(child(pPr, 'pStyle'), 'val')) || { level: 0, quote: false };
    let level = st.level;
    const ol = attr(child(pPr, 'outlineLvl'), 'val');          // หัวข้อที่ตั้งตรงที่ย่อหน้า (ไม่ผ่านสไตล์)
    if (!level && ol != null && +ol >= 0 && +ol < 9) level = Math.min(6, +ol + 1);
    const align = JC[attr(child(pPr, 'jc'), 'val')] || null;
    const pieces = paraPieces(p);
    const figs = [];
    const textPieces = [];
    let pageAfter = false;
    for (const pc of pieces) {
      if (pc.img) { const f = figureOf(pc); if (f) figs.push(f); }
      else if (pc.page) { if (textPieces.some((x) => x.text && x.text.trim())) pageAfter = true; else pushBlock({ type: 'page_break' }); }
      else textPieces.push(pc);
    }
    const inl = inlineNodes(textPieces);
    const hasText = !!plainOf(inl);
    const numPr = child(pPr, 'numPr');
    const numId = numPr ? String(attr(child(numPr, 'numId'), 'val') || '') : '';
    if (hasText) {
      stats.paragraphs++;
      const attrs = align ? { align } : {};
      if (level) {
        stats.headings++;
        pushBlock({ type: 'heading', attrs: { ...attrs, level }, content: inl.filter((n) => n.type !== 'hard_break') });
      } else if (numId && numId !== '0' && numbering.has(numId)) {
        const ilvl = +(attr(child(numPr, 'ilvl'), 'val') || 0);
        const ordered = !!numbering.get(numId).get(ilvl) || (!numbering.get(numId).has(ilvl) && !!numbering.get(numId).get(0));
        const item = { type: 'list_item', content: [{ type: 'paragraph', attrs, content: inl }] };
        if (list && list.numId === numId && list.ordered === ordered) list.node.content.push(item);
        else {
          const node = { type: ordered ? 'ordered_list' : 'bullet_list', attrs: ordered ? { order: 1 } : {}, content: [item] };
          content.push(node);
          list = { node, numId, ordered };
        }
      } else if (st.quote) {
        pushBlock({ type: 'blockquote', content: [{ type: 'paragraph', attrs, content: inl }] });
      } else {
        pushBlock({ type: 'paragraph', attrs, content: inl });
      }
    } else if (!figs.length && !pieces.some((x) => x.page)) {
      pushBlock({ type: 'paragraph', attrs: {}, content: [] });      // ย่อหน้าว่าง (ช่องไฟที่ผู้เขียนเว้น)
    }
    for (const f of figs) pushBlock(f);
    if (pageAfter) pushBlock({ type: 'page_break' });
  };

  const walkBlocks = (n) => {
    for (const c of kids(n)) {
      const k = local(c.tag);
      if (k === 'p') doPara(c);
      else if (k === 'tbl') {
        // ตาราง: ไม่มีตารางในไฟล์งานของโปรแกรม → ย่อหน้าในช่องเรียงต่อกันตามลำดับอ่าน (ข้อความไม่หาย)
        stats.tables++;
        for (const tc of descend(c, 'tc')) walkBlocks(tc);
      } else if (k === 'sdt' || k === 'sdtContent' || k === 'customXml' || k === 'ins' || k === 'moveTo') walkBlocks(c);
    }
  };
  walkBlocks(body);
  return { content: tidyBlanks(content), images, stats };
}

/**
 * ย่อหน้าว่างจาก Word: ผู้เขียนหลายคนกด Enter สองทีเพื่อเว้นระยะ "ทุกย่อหน้า" (= ระยะห่างของย่อหน้า ไม่ใช่เนื้อหา)
 * → ย่อหน้าว่างที่คั่นระหว่างย่อหน้าเนื้อหาเกินครึ่งของทั้งหมด = ตัวคั่น (ตัดทิ้ง) · ว่างติดกันหลายบรรทัดเหลือหนึ่ง · หัว/ท้ายตัดทิ้ง
 * กติกาเดียวกับ `aiProseText()` (บรรทัดว่างหนึ่งบรรทัด = ตัวคั่นย่อหน้า) แต่ดูทั้งเอกสารก่อนตัดสิน
 */
export function tidyBlanks(content) {
  const isBlank = (n) => n && n.type === 'paragraph' && !plainOf(n.content);
  const nonBlank = content.filter((n) => !isBlank(n)).length;
  let gaps = 0;
  for (let i = 1; i < content.length - 1; i++) if (isBlank(content[i]) && !isBlank(content[i - 1]) && !isBlank(content[i + 1])) gaps++;
  const separator = nonBlank > 2 && gaps >= (nonBlank - 1) * 0.5;
  const out = [];
  for (let i = 0; i < content.length; i++) {
    const n = content[i];
    if (!isBlank(n)) { out.push(n); continue; }
    let j = i; while (j + 1 < content.length && isBlank(content[j + 1])) j++;
    const run = j - i + 1;
    i = j;
    if (!out.length || i === content.length - 1) continue;           // หัว/ท้ายเอกสาร
    if (separator && run === 1) continue;
    out.push({ type: 'paragraph', attrs: {}, content: [] });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// 3) Markdown / ข้อความล้วน
// ────────────────────────────────────────────────────────────────

/**
 * หัวบท/ตอนที่เขียนเป็นย่อหน้าธรรมดา (ไม่ได้ใช้สไตล์หัวข้อ) — นักเขียนนิยายเว็บส่วนใหญ่พิมพ์ "ตอนที่ 12 ..." เป็นตัวหนาเฉย ๆ
 * ใช้เมื่อเอกสาร "ไม่มีหัวข้อจริงเลย" เท่านั้น (มีสไตล์หัวข้อ = ผู้เขียนบอกโครงไว้แล้ว ไม่เดา)
 */
/* i18n-skip: คำที่นักเขียนพิมพ์ขึ้นต้นหัวบท/ตอนในต้นฉบับ (ข้อมูลที่ใช้จับรูปแบบ ไม่ใช่ข้อความบนจอ) */
const CHAPTER_NUM_RE = /^(?:ตอนที่|ตอน|บทที่|ภาคที่|chapter|chap\.?|ch\.|episode|ep\.?|part)\s*[0-9๐-๙]+(?:\s*[:：.\-–—)]|\s|$)/i;
const CHAPTER_WORD_RE = /^(?:บทนำ|อารัมภบท|ปฐมบท|บทส่งท้าย|ปัจฉิมบท|ตอนพิเศษ|ตอนจบ|prologue|epilogue|interlude|afterword|foreword)(?:\s*[:：.\-–—]|\s|$)/i;
/* /i18n-skip */
const CHAPTER_MAX = 80;
const BOM_RE = new RegExp('^' + String.fromCharCode(0xFEFF));   // ไฟล์ที่บันทึกจาก Notepad (UTF-8 with BOM)

/** บรรทัดนี้เป็นหัวบท/ตอนที่พิมพ์เป็นข้อความธรรมดาหรือไม่ */
export function isChapterLine(text) {
  const s = String(text || '').replace(/[*_~#]/g, '').trim();
  if (!s || s.length > CHAPTER_MAX) return false;
  return CHAPTER_NUM_RE.test(s) || CHAPTER_WORD_RE.test(s);
}

/** ตัวคั่นฉากที่พิมพ์ด้วยมือ (`***` `* * *` `---` `◇◇◇` `#`) → ตัวคั่นฉากของโปรแกรม `* * *` */
export function isSceneBreakLine(text) {
  const s = String(text || '').trim();
  return /^(?:[*＊]\s*){3,}$/.test(s) || /^(?:[-–—_=~]\s*){3,}$/.test(s) || /^(?:[◇◆○●♦✦✧❖⁂§#]\s*){1,5}$/.test(s);
}

/** เปลี่ยนย่อหน้าที่เป็นหัวบทแบบพิมพ์มือ → หัวข้อระดับ 1 · ตัวคั่นฉากแบบพิมพ์มือ → `* * *` (เฉพาะเอกสารที่ไม่มีหัวข้อจริง) */
export function detectStructure(content) {
  const hasHeading = content.some((n) => n.type === 'heading');
  let detected = 0;
  const out = content.map((n) => {
    if (n.type !== 'paragraph') return n;
    const txt = plainOf(n.content);
    if (isSceneBreakLine(txt)) return { type: 'paragraph', attrs: { align: 'center' }, content: [{ type: 'text', text: '* * *' }] };
    if (!hasHeading && isChapterLine(txt)) { detected++; return { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: txt.replace(/[*_~]/g, '').trim() }] }; }
    return n;
  });
  return { content: out, detected };
}

/** ไฟล์ .md (Obsidian · Notion · Typora …) → โหนด · frontmatter ถูกตัดออก (`title:` ใช้เป็นชื่อเอกสาร) */
export function mdToImportDoc(text) {
  const src = String(text ?? '').replace(BOM_RE, '').replace(/\r\n?/g, '\n');
  let body = src, title = '';
  if (/^---\n/.test(src)) {
    try { const p = parseMdFile(src); body = p.body; title = String((p.meta || {}).title || ''); } catch { /* frontmatter เสีย = ใช้ทั้งไฟล์ */ }
  }
  // มาร์กดาวน์มาตรฐานคั่นย่อหน้าด้วยบรรทัดว่าง — ไฟล์ของโปรแกรมใช้หนึ่งบรรทัดต่อย่อหน้า
  const doc = mdToDoc(collapseMdParagraphs(body));
  const content = tidyBlanks(doc.content || []);
  return { content, images: [], title, stats: statsOf(content) };
}

/**
 * บรรทัดว่างหนึ่งบรรทัด = ตัวคั่นย่อหน้า (ตัดทิ้ง) · ตั้งแต่สองบรรทัด = ผู้เขียนตั้งใจเว้น (เหลือหนึ่ง)
 * บรรทัดในรั้วโค้ดไม่แตะ
 */
function collapseMdParagraphs(s) {
  const lines = s.replace(/[ \t]+$/gm, '').split('\n');
  const out = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s{0,3}(`{3,}|~{3,})/.test(l)) fence = !fence;
    if (fence || l !== '') { out.push(l); continue; }
    let j = i; while (j + 1 < lines.length && lines[j + 1] === '') j++;
    if (j > i) out.push('');
    i = j;
  }
  return out.join('\n').replace(/^\n+|\n+$/g, '');
}

/** ข้อความล้วน (.txt · ข้อความที่วาง) → โหนด — ทุกบรรทัดเป็นข้อความตรงตัว (ไม่ตีความเครื่องหมายมาร์กดาวน์) */
export function textToImportDoc(text) {
  const lines = collapseMdParagraphs(String(text ?? '').replace(BOM_RE, '').replace(/\r\n?/g, '\n')).split('\n');
  const content = lines.map((l) => {
    const s = l.replace(/^[ \t 　]+/, '');
    return { type: 'paragraph', attrs: {}, content: s ? [{ type: 'text', text: s }] : [] };
  });
  const c = tidyBlanks(content);
  return { content: c, images: [], title: '', stats: statsOf(c) };
}

function statsOf(content) {
  return {
    paragraphs: content.filter((n) => n.type !== 'heading' && n.type !== 'figure' && hasBody([n])).length,
    headings: content.filter((n) => n.type === 'heading').length,
    images: content.filter((n) => n.type === 'figure').length,
    tables: 0,
  };
}

// ────────────────────────────────────────────────────────────────
// 4) แบ่งเป็นบท/ฉาก
// ────────────────────────────────────────────────────────────────

export const SPLIT_MODES = ['auto', 'file-chapter', 'headings', 'file-scene'];

/** ชื่อไฟล์ → ชื่อเรื่อง ("03 - ทางกลับบ้าน.docx" → "ทางกลับบ้าน" · "ตอนที่ 3.docx" คงไว้ทั้งชื่อ) */
export function titleFromFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '').trim();
  if (isChapterLine(base)) return base;
  const s = base.replace(/^\d{1,4}\s*[-_.)\]]\s*/, '').replace(/[_]+/g, ' ').trim();
  return s || base;
}

/** เรียงไฟล์แบบที่คนอ่าน: "ตอน 2" มาก่อน "ตอน 10" */
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** มีเนื้อจริงไหม (ข้อความในชั้นไหนก็ได้ · รูป · ตัวขึ้นหน้าใหม่) — ย่อหน้าว่างล้วนไม่นับ */
const hasBody = (nodes) => (nodes || []).some((n) => n.type === 'figure' || n.type === 'page_break'
  || (n.type === 'text' ? !!String(n.text || '').trim() : hasBody(n.content)));

/**
 * @param {Array<{name:string, title?:string, content:object[]}>} docs ตามลำดับที่จะนำเข้า
 * @param {{mode?:string, chapterTitle?:string, detect?:boolean}} opts
 *   mode: auto (ไฟล์เดียว = ตามหัวข้อ · หลายไฟล์ = ไฟล์ละบท) · file-chapter · headings · file-scene
 *   detect: จับหัวบทที่พิมพ์เป็นข้อความธรรมดา (ค่าเริ่มต้น เปิด)
 * @returns {{chapters:Array<{title:string, scenes:Array<{title:string, content:object[]}>}>, mode:string,
 *            counts:{chapters:number, scenes:number, words:number, images:number}, warnings:Array<{code:string, name?:string}>}}
 */
export function splitManuscript(docs, opts = {}) {
  const warnings = [];
  const list = (docs || []).map((d) => {
    const det = opts.detect === false ? { content: d.content || [], detected: 0 } : detectStructure(d.content || []);
    return { name: d.name || '', title: d.title || titleFromFileName(d.name), content: det.content };
  });
  let mode = SPLIT_MODES.includes(opts.mode) ? opts.mode : 'auto';
  if (mode === 'auto') mode = list.length > 1 ? 'file-chapter' : 'headings';
  const chapters = [];

  if (mode === 'file-scene') {
    const ch = { title: opts.chapterTitle || '', scenes: [] };
    for (const d of list) {
      let content = d.content, title = d.title;
      const first = content.findIndex((n) => n.type !== 'paragraph' || plainOf(n.content));
      if (first >= 0 && content[first].type === 'heading') { title = plainOf(content[first].content) || title; content = content.slice(first + 1); }
      if (hasBody(content)) ch.scenes.push({ title, content });
      else warnings.push({ code: 'empty', name: d.name });
    }
    if (ch.scenes.length) chapters.push(ch);
  } else if (mode === 'file-chapter') {
    for (const d of list) {
      const ch = splitByHeadings(d.content, d.title, { fileTitle: true });
      if (!ch.length) { warnings.push({ code: 'empty', name: d.name }); continue; }
      // ไฟล์หนึ่ง = บทเดียว: หัวข้อในไฟล์ทุกชั้นกลายเป็นฉากของบทนี้
      chapters.push({ title: ch[0].title, scenes: ch.flatMap((c) => c.scenes) });
    }
  } else {
    // headings: ต่อทุกไฟล์เป็นเรื่องเดียว แล้วตัดตามหัวข้อ
    for (const d of list) {
      const ch = splitByHeadings(d.content, d.title, {});
      if (!ch.length) warnings.push({ code: 'empty', name: d.name });
      chapters.push(...ch);
    }
    if (chapters.length === 1 && chapters[0].scenes.length === 1 && list.length === 1 && !list[0].content.some((n) => n.type === 'heading')) {
      warnings.push({ code: 'noHeadings', name: list[0].name });
    }
  }
  const scenes = chapters.flatMap((c) => c.scenes);
  return {
    chapters, mode,
    counts: {
      chapters: chapters.length,
      scenes: scenes.length,
      words: scenes.reduce((n, s) => n + countWords(sceneMd(s.content)), 0),
      images: scenes.reduce((n, s) => n + s.content.filter((x) => x.type === 'figure').length, 0),
    },
    warnings,
  };
}

/**
 * ตัดเอกสารหนึ่งฉบับตามหัวข้อ: ระดับบนสุดที่มีในเอกสาร = บท · ระดับถัดลงไป = ฉาก · ลึกกว่านั้น = คงเป็นหัวข้อในเนื้อฉาก
 * เนื้อหาก่อนหัวข้อบทแรก = บทชื่อเดียวกับเอกสาร (บทนำ/คำนำที่ไม่มีหัวข้อ)
 * บทที่ไม่มีหัวข้อฉาก = ฉากเดียวชื่อเดียวกับบท
 */
function splitByHeadings(content, docTitle, { fileTitle } = {}) {
  const levels = [...new Set(content.filter((n) => n.type === 'heading').map((n) => n.attrs.level))].sort((a, b) => a - b);
  const L1 = levels[0], L2 = levels[1];
  const chapters = [];
  let ch = null, sc = null;
  const newChapter = (title) => { ch = { title: title || docTitle || '', scenes: [] }; chapters.push(ch); sc = null; };
  const newScene = (title) => { sc = { title: title || ch.title, content: [] }; ch.scenes.push(sc); };
  for (const n of content) {
    if (n.type === 'heading' && n.attrs.level === L1) {
      // ไฟล์ละบท: หัวข้อบนสุดตัวแรก "ก่อนมีเนื้อหา" = ชื่อบท (ไม่ใช่บทซ้อน)
      if (fileTitle && ch && !ch.scenes.some((s) => hasBody(s.content)) && !ch._named) { ch.title = plainOf(n.content) || ch.title; ch._named = true; ch.scenes = []; sc = null; continue; }
      newChapter(plainOf(n.content)); ch._named = true; continue;
    }
    if (!ch) newChapter(docTitle);
    if (n.type === 'heading' && L2 != null && n.attrs.level === L2) { newScene(plainOf(n.content)); continue; }
    if (!sc) newScene('');
    sc.content.push(n);
  }
  for (const c of chapters) {
    delete c._named;
    c.scenes = c.scenes.filter((s) => hasBody(s.content)).map((s) => ({ title: s.title, content: tidyBlanks(s.content) }));
  }
  return chapters.filter((c) => c.scenes.length);
}

/** โหนดของฉาก → เนื้อ .md (ทางเดียว: `docToMd` ของ md.js) */
export function sceneMd(content) {
  return docToMd({ type: 'doc', content: stripPrivate(content || []) });
}
function stripPrivate(nodes) {
  return nodes.map((n) => {
    const o = { ...n };
    delete o._m;
    if (o.content) o.content = stripPrivate(o.content);
    return o;
  });
}

// ────────────────────────────────────────────────────────────────
// 5) แผนไฟล์ของเล่มใหม่ (ทางสัมพัทธ์จากรากโปรเจกต์)
// ────────────────────────────────────────────────────────────────

/** ชั้นจากโฟลเดอร์ฉาก `<เล่ม>/Draft/default/Chapters/<บท>/` ถึงรากโปรเจกต์ */
export const SCENE_TO_ROOT = '../../../../../';

/**
 * @param {ReturnType<typeof splitManuscript>} structure
 * @param {{bookTitle:string, bookFolder:string, order:number, guid?:()=>string, now?:string,
 *          images?:Map<string,{ext:string, name?:string}>, sceneTitle?:(ch,i)=>string}} opts
 *   images: key ของรูป (จาก docxToDoc) → นามสกุลไฟล์ · รูปลง `Images/<โฟลเดอร์เล่ม>/` (อัลบั้มของเล่ม)
 * @returns {{files:Array<{path:string[], content?:string, image?:string}>, chapters:number, scenes:number}}
 *   `image` = key ของรูป — ผู้เรียกเขียนไบต์ของรูปนั้นลงทางนี้เอง
 */
export function buildBookPlan(structure, opts = {}) {
  let n = 0;
  const guid = opts.guid || (() => 'imp' + (++n).toString(36));
  const book = opts.bookFolder || diskBase(opts.bookTitle, DEFAULT_BOOK);
  const files = [];
  files.push({ path: [book, 'section.json'], content: JSON.stringify({
    guid: guid(), title: opts.bookTitle || book, order: opts.order || 1, folderName: book,
    importedFrom: opts.source || 'manuscript', importedAt: opts.now || null,
  }, null, 2) });

  // รูป: ชื่อไฟล์ไม่ชนกันในอัลบั้มของเล่ม
  const imgPath = new Map();
  const usedImg = [];
  for (const [key, im] of (opts.images || new Map())) {
    const base = diskBase(im.name || 'image', 'image');
    const nm = freeName(base, usedImg, '.' + String(im.ext || 'png').replace(/^\./, ''));
    usedImg.push(nm);
    imgPath.set(key, nm);
    files.push({ path: ['Images', book, nm], image: key });
  }
  const fixImages = (nodes) => nodes.map((x) => {
    if (x.type === 'figure' && imgPath.has(x.attrs.src)) {
      return { ...x, attrs: { ...x.attrs, src: SCENE_TO_ROOT + 'Images/' + book + '/' + imgPath.get(x.attrs.src) } };
    }
    if (x.type === 'figure' && /^k2img:/.test(x.attrs.src)) return null;      // รูปที่ใช้ไม่ได้ (emf/wmf · หาไฟล์ไม่เจอ) → ทิ้ง (UI เตือนแล้ว)
    return x.content ? { ...x, content: fixImages(x.content).filter(Boolean) } : x;
  }).filter(Boolean);

  const chapters = [];
  const scenesMap = {};
  const usedCh = [];
  let sceneCount = 0;
  structure.chapters.forEach((ch, ci) => {
    const title = String(ch.title || '').trim() || (opts.chapterFallback ? opts.chapterFallback(ci) : 'Chapter ' + (ci + 1));
    const folderName = freeName(diskBase(title, 'chapter'), usedCh);
    usedCh.push(folderName);
    const cg = guid();
    chapters.push({ guid: cg, title, order: ci + 1, status: 'Outline', act: 'I', date: '', isFavorite: false, folderName });
    const usedSc = [];
    scenesMap[cg] = ch.scenes.map((sc, si) => {
      const st = String(sc.title || '').trim() || title;
      const fileName = freeName(diskBase(st, 'scene'), usedSc, '.md');
      usedSc.push(fileName);
      const body = sceneMd(fixImages(sc.content));
      const words = countWords(body);
      files.push({ path: [book, 'Draft', 'default', 'Chapters', folderName, fileName],
        content: dumpMdFile({ title: st, type: 'scene', format: 'prose', pov: '', tags: [] }, body + (body ? '\n' : '')) });
      sceneCount++;
      return { id: guid(), title: st, order: si + 1, fileName, chapterGuid: cg, date: '', isFavorite: false, wordCount: words, synopsis: '' };
    });
  });
  files.push({ path: [book, 'Draft', 'default', 'draft.json'], content: JSON.stringify({ chapters }, null, 2) });
  files.push({ path: [book, 'Draft', 'default', 'scenes.json'], content: JSON.stringify({ chapters: scenesMap }, null, 2) });
  return { files, chapters: chapters.length, scenes: sceneCount, book };
}

/** นามสกุลไฟล์ของรูปจากทางในแพ็กเกจ (`word/media/image3.jpeg` → jpeg) · ชนิดที่ไม่ใช่รูปบนเว็บ (emf/wmf) = null */
export function imageExtOf(path) {
  const ext = String(path || '').split('.').pop().toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ? ext : null;
}
