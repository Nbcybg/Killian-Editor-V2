// docx-comments.js — [alpha.170 · คอมเมนต์ไปกลับกับ Word] ส่งออก DOCX พร้อมคอมเมนต์ · รับคอมเมนต์ที่ บก. ตอบกลับเข้ามา
//
// ที่มา: ผลสำรวจผู้ใช้ข้อ 6 "ทำงานร่วมกับทีม/บก./ผู้กำกับไม่ได้" — บก. ส่วนใหญ่ทำงานใน Word:
//   นักเขียนส่ง .docx ที่มีคอมเมนต์ของตัวเอง → บก. ตอบ/คอมเมนต์เพิ่ม/กด Resolve ใน Word → นักเขียนนำคอมเมนต์กลับเข้าฉาก
// บริสุทธิ์ 100% (ไม่แตะ DOM/fs/zip) · unit `docx-comments`
//
// ── ขาออก ──
//   markSceneComments(body, comments, threads) ใส่ "เครื่องหมายคอมเมนต์" (อักขระ Private Use) ล้อมข้อความที่คอมเมนต์ผูกไว้
//   ในมาร์กดาวน์ของฉาก ก่อนเข้าขั้นคอมไพล์ → ตัวสร้าง DOCX (`buildDocx`) เจอเครื่องหมายใน run ไหนก็แปลงเป็น
//   `commentRangeStart/End` + `commentReference` ตรงนั้น (`commentMarkXml`) · ส่วนประกอบไฟล์ `commentsParts(threads)`
//   ★ เครื่องหมายใส่เฉพาะตอนส่งออก DOCX ที่ติ๊ก "แนบคอมเมนต์" — ไฟล์ฉากไม่ถูกแตะ · ปลายทางอื่นไม่เคยเห็นเครื่องหมาย
//
// ── ขาเข้า ──
//   readDocxComments({ document, comments, commentsExtended }) → เธรด (หัว + คำตอบ · ข้อความที่ผูก · บริบทย่อหน้า · ปิดแล้วไหม)
//   planCommentImport(threads, scenes) → แต่ละฉากได้รายการคอมเมนต์ใหม่ (รวมกับของเดิม ไม่ซ้ำ) + สรุป

import { parseXml } from '../import/import-scrivener.js';
import { makeComment, normalizeAnchor } from './comment-core.js';

// ────────────────────────────────────────────────────────────────
// 0) เครื่องหมายในข้อความ
// ────────────────────────────────────────────────────────────────
// Private Use Area — ไม่มีฟอนต์ไหนวาด ไม่มีขั้นคอมไพล์ไหนแตะ · ตัวเลขคือดัชนีเธรดในการส่งออกครั้งนั้น
export const MK_START = String.fromCharCode(0xE0C0);
export const MK_END = String.fromCharCode(0xE0C2);
export const MK_CLOSE = String.fromCharCode(0xE0C1);
const MK_RE = new RegExp(`${MK_START}(\\d+)${MK_CLOSE}|${MK_END}(\\d+)${MK_CLOSE}`, 'g');
export const hasMarks = (s) => { const t = String(s || ''); return t.includes(MK_START) || t.includes(MK_END); };
/** ถอดเครื่องหมายทิ้ง (ทางที่ไม่ใช่ DOCX ที่ได้ข้อความมีเครื่องหมายไป) */
export const stripMarks = (s) => String(s || '').replace(MK_RE, '');

/** ข้อความ → ชิ้น [{text}|{start:n}|{end:n}] */
export function splitMarks(text) {
  const out = [];
  const s = String(text ?? '');
  let last = 0, m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push(m[1] != null ? { start: +m[1] } : { end: +m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

// ย่อหน้าแรกที่ "เป็นข้อความจริง" — ที่วางคอมเมนต์ที่ไม่ได้ผูกข้อความ (หรือหาข้อความที่ผูกไม่เจอแล้ว)
// วางหลังคำนำหน้าบล็อก (`# ` `> ` `- ` `1. ` `<!--align:x-->`) ไม่งั้นบล็อกเปลี่ยนชนิด
const LINE_PREFIX = /^((?:<!--align:\w+-->)?\s*(?:#{1,6}\s+|>\s*|[-*]\s+|\d+\.\s+)?)/;
const NOT_TEXT_LINE = /^\s*(?:!\[[^\]]*\]\([^)]*\)\s*$|<!--|```|~~~|(?:[-*_]\s*){3,}$|(?:\*\s+){2,}\*\s*$)/;

/**
 * ใส่เครื่องหมายของคอมเมนต์ที่ยังเปิดอยู่ลงเนื้อฉาก
 * @param {string} body เนื้อฉาก (ไม่มี frontmatter · ไม่มีบล็อก k2-comments)
 * @param {Array} comments คอมเมนต์ของฉาก (รูปของ comment-core)
 * @param {Array} threads รายการรวมของทั้งการส่งออก — ฟังก์ชันนี้ต่อท้ายให้ (ดัชนี = เลขในเครื่องหมาย)
 * @param {{includeResolved?:boolean, scene?:string}} [opts]
 * @returns {string} เนื้อที่มีเครื่องหมาย
 */
export function markSceneComments(body, comments, threads, opts = {}) {
  let md = String(body ?? '');
  const list = (comments || []).filter((c) => c && (opts.includeResolved || !c.resolved) && String(c.text || '').trim());
  // เรียงจากท้ายไปหัว — แทรกเครื่องหมายแล้วตำแหน่งของคอมเมนต์ที่อยู่ก่อนหน้าไม่ขยับ
  const placed = [];
  for (const c of list) {
    const q = c.anchor && c.anchor.quote ? String(c.anchor.quote) : '';
    let at = -1;
    if (q) {
      // หาตำแหน่งที่ใกล้ตำแหน่งเดิมที่สุด (ข้อความซ้ำหลายที่) — สมอเก็บตำแหน่งของทั้งไฟล์ จึงใช้เป็นแค่ตัวเทียบ
      let best = -1, dist = Infinity, from = 0, i;
      const want = Number(c.anchor.start) || 0;
      while ((i = md.indexOf(q, from)) >= 0) {
        const d = Math.abs(i - want);
        if (d < dist) { dist = d; best = i; }
        from = i + 1;
      }
      at = best;
    }
    placed.push({ c, at, len: at >= 0 ? q.length : 0 });
  }
  // จุดวางของคอมเมนต์ที่ไม่มีข้อความผูก = ต้นย่อหน้าข้อความแรก
  let pointAt = 0;
  {
    let off = 0;
    for (const line of md.split('\n')) {
      if (line.trim() && !NOT_TEXT_LINE.test(line)) { pointAt = off + LINE_PREFIX.exec(line)[1].length; break; }
      off += line.length + 1;
    }
  }
  const edits = [];
  for (const p of placed) {
    const n = threads.length;
    threads.push({ comment: p.c, scene: opts.scene || '', anchored: p.at >= 0 });
    const s = p.at >= 0 ? p.at : pointAt;
    const e = p.at >= 0 ? p.at + p.len : pointAt;
    edits.push({ pos: e, n, txt: MK_END + n + MK_CLOSE, order: 0 });
    edits.push({ pos: s, n, txt: MK_START + n + MK_CLOSE, order: 1 });
  }
  // แทรกจากท้ายไปหัว · ตำแหน่งเดียวกัน: ตัวที่แทรกทีหลังไปอยู่หน้า → แทรกเธรดเลขมากก่อน และ "ปิด" ก่อน "เปิด"
  // ผลในข้อความ = เรียงตามเลขเธรด และช่วงที่จบตรงนั้นปิดก่อนช่วงที่เริ่มตรงนั้น
  edits.sort((a, b) => b.pos - a.pos || b.n - a.n || a.order - b.order);
  for (const e of edits) md = md.slice(0, e.pos) + e.txt + md.slice(e.pos);
  return md;
}

// ────────────────────────────────────────────────────────────────
// 1) XML ของ Word
// ────────────────────────────────────────────────────────────────
const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // อักขระควบคุมที่ XML 1.0 ไม่ยอม
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** คอมเมนต์หนึ่งเธรด → รายการคอมเมนต์ของ Word (หัว + คำตอบเรียงตามลำดับ) พร้อมเลข id ที่ไม่ซ้ำทั้งไฟล์ */
export function flattenThreads(threads) {
  const out = [];
  threads.forEach((th, t) => {
    const walk = (c, parentIdx) => {
      const idx = out.length;
      out.push({ t, comment: c, parent: parentIdx });
      for (const r of c.replies || []) walk(r, parentIdx == null ? idx : parentIdx);   // คำตอบซ้อน = Word แบนเป็นชั้นเดียว
    };
    walk(th.comment, null);
  });
  return out;
}

/** XML ที่วางในเอกสารแทนเครื่องหมาย (ทุกคอมเมนต์ของเธรด — หัวและคำตอบผูกช่วงเดียวกันตามแบบที่ Word เขียนเอง) */
export function commentMarkXml(flat, part) {
  const ids = (t) => flat.map((f, i) => (f.t === t ? i : -1)).filter((i) => i >= 0);
  if (part.start != null) return ids(part.start).map((i) => `<w:commentRangeStart w:id="${i}"/>`).join('');
  if (part.end != null) {
    return ids(part.end).map((i) => `<w:commentRangeEnd w:id="${i}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${i}"/></w:r>`).join('');
  }
  return '';
}

const initialsOf = (name) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return 'K2';
  return w.slice(0, 2).map((x) => Array.from(x)[0]).join('').toUpperCase();
};
// paraId ของ Word = เลขฐานสิบหก 8 หลัก ต่ำกว่า 0x80000000
const paraId = (i) => (0x10000000 + i * 7 + 1).toString(16).toUpperCase().padStart(8, '0');
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';

/**
 * ส่วนประกอบ DOCX ของคอมเมนต์ทั้งหมด
 * @returns {{files:Array<{path:string,data:string}>, rels:string, types:string, count:number}}
 *   rels/types = บรรทัดที่ต้องต่อเข้า document.xml.rels และ [Content_Types].xml
 */
export function commentsParts(threads, opts = {}) {
  const flat = flattenThreads(threads);
  if (!flat.length) return { files: [], rels: '', types: '', count: 0, flat };
  const date = (c) => {
    const d = new Date(c.timestamp || opts.now || Date.now());
    return (Number.isNaN(d.getTime()) ? new Date(0) : d).toISOString().replace(/\.\d+Z$/, 'Z');
  };
  const paras = (text, i) => {
    const lines = String(text ?? '').split(/\r?\n/);
    return lines.map((l, k) => `<w:p${k === lines.length - 1 ? ` w14:paraId="${paraId(i)}" w14:textId="77777777"` : ''}>`
      + (k === 0 ? '<w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>' : '')
      + `<w:r><w:t xml:space="preserve">${xmlEsc(l)}</w:t></w:r></w:p>`).join('');
  };
  const author = (c) => String(c.author || '').trim() || opts.defaultAuthor || 'Killian';
  const commentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="${W14}">
${flat.map((f, i) => `<w:comment w:id="${i}" w:author="${xmlEsc(author(f.comment))}" w:date="${date(f.comment)}" w:initials="${xmlEsc(initialsOf(author(f.comment)))}">${paras(f.comment.text, i)}</w:comment>`).join('\n')}
</w:comments>`;
  const extXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w15:commentsEx xmlns:w15="${W15}">
${flat.map((f, i) => {
    const root = f.parent == null ? f : flat[f.parent];
    const done = root.comment.resolved ? '1' : '0';
    return `<w15:commentEx w15:paraId="${paraId(i)}"${f.parent != null ? ` w15:paraIdParent="${paraId(f.parent)}"` : ''} w15:done="${done}"/>`;
  }).join('\n')}
</w15:commentsEx>`;
  return {
    flat,
    count: flat.length,
    files: [
      { path: 'word/comments.xml', data: commentsXml },
      { path: 'word/commentsExtended.xml', data: extXml },
    ],
    rels: '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>\n'
        + '<Relationship Id="rIdCommentsEx" Type="http://schemas.microsoft.com/office/2011/relationships/commentsExtended" Target="commentsExtended.xml"/>',
    types: '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>\n'
         + '<Override PartName="/word/commentsExtended.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml"/>',
  };
}

// ────────────────────────────────────────────────────────────────
// 2) ขาเข้า: อ่านคอมเมนต์จาก .docx
// ────────────────────────────────────────────────────────────────
const local = (tag) => String(tag || '').replace(/^[\w.-]+:/, '');
const kids = (n) => (n && n.children) || [];
const attr = (n, name) => {
  if (!n) return undefined;
  for (const [k, v] of Object.entries(n.attrs || {})) if (local(k) === name) return v;
  return undefined;
};
function descend(n, name, out = []) {
  for (const c of kids(n)) { if (local(c.tag) === name) out.push(c); descend(c, name, out); }
  return out;
}
/** ข้อความล้วนของโหนด (w:t · w:tab · w:br) — ข้ามข้อความที่ถูกลบในโหมดติดตามการแก้ไข */
function plainText(n) {
  let s = '';
  const walk = (x) => {
    for (const c of kids(x)) {
      const k = local(c.tag);
      if (k === 'del' || k === 'moveFrom' || k === 'delText' || k === 'instrText') continue;
      if (k === 't') s += c.text;
      else if (k === 'tab') s += '\t';
      else if (k === 'br' || k === 'cr') s += '\n';
      else walk(c);
    }
  };
  walk(n);
  return s;
}

/**
 * @param {{document:string, comments?:string, commentsExtended?:string}} parts
 * @returns {Array<{id:string, author:string, date:string, text:string, done:boolean, quote:string, context:string,
 *                  replies:Array<{id:string, author:string, date:string, text:string}>}>} เธรดตามลำดับที่ปรากฏในเอกสาร
 */
export function readDocxComments(parts = {}) {
  if (!parts.comments) return [];
  const cm = new Map();                          // id → { author, date, text, paraId }
  for (const c of descend(parseXml(parts.comments), 'comment')) {
    const ps = kids(c).filter((x) => local(x.tag) === 'p');
    const text = ps.map((p) => plainText(p)).join('\n').replace(/\s+$/, '');
    const last = ps[ps.length - 1];
    cm.set(String(attr(c, 'id')), { id: String(attr(c, 'id')), author: String(attr(c, 'author') || ''), date: String(attr(c, 'date') || ''),
      text, paraId: last ? String(attr(last, 'paraId') || '') : '' });
  }
  // ความสัมพันธ์หัว-คำตอบ + ปิดแล้ว (Word 2013+) · ไฟล์ที่ไม่มีส่วนนี้ = ทุกคอมเมนต์เป็นหัวเธรด
  const ext = new Map();                         // paraId → { parent, done }
  if (parts.commentsExtended) {
    for (const e of descend(parseXml(parts.commentsExtended), 'commentEx')) {
      ext.set(String(attr(e, 'paraId') || ''), { parent: String(attr(e, 'paraIdParent') || ''), done: attr(e, 'done') === '1' });
    }
  }
  // ข้อความที่ผูก: เดินเอกสารตามลำดับ เก็บข้อความระหว่าง rangeStart → rangeEnd · บริบท = ย่อหน้าที่ช่วงเริ่ม
  const quote = new Map(), context = new Map(), orderOf = new Map();
  const open = new Set();
  let para = '';
  const seen = (id) => { if (!orderOf.has(id)) orderOf.set(id, orderOf.size); };
  const walk = (n) => {
    for (const c of kids(n)) {
      const k = local(c.tag);
      if (k === 'del' || k === 'moveFrom' || k === 'delText' || k === 'instrText') continue;
      if (k === 'commentRangeStart') {
        const id = String(attr(c, 'id'));
        open.add(id); quote.set(id, ''); context.set(id, para); seen(id);
        continue;
      }
      if (k === 'commentRangeEnd') { open.delete(String(attr(c, 'id'))); continue; }
      if (k === 'commentReference') { const id = String(attr(c, 'id')); seen(id); if (!context.has(id)) context.set(id, para); continue; }
      if (k === 'p') {
        for (const id of open) if (quote.get(id)) quote.set(id, quote.get(id) + '\n');   // ช่วงคร่อมย่อหน้า
        const prev = para;
        para = plainText(c);
        walk(c);
        para = prev;
        continue;
      }
      let piece = '';
      if (k === 't') piece = c.text;
      else if (k === 'tab') piece = '\t';
      else if (k === 'br' || k === 'cr') piece = '\n';
      if (piece) { for (const id of open) quote.set(id, quote.get(id) + piece); continue; }
      walk(c);
    }
  };
  walk(parseXml(parts.document || ''));

  // ประกอบเธรด
  const byPara = new Map();
  for (const c of cm.values()) if (c.paraId) byPara.set(c.paraId, c);
  const parentOf = (c) => {
    const e = ext.get(c.paraId);
    return e && e.parent && byPara.has(e.parent) ? byPara.get(e.parent) : null;
  };
  const rootOf = (c) => { let r = c, guard = 0; while (parentOf(r) && guard++ < 50) r = parentOf(r); return r; };
  const threads = new Map();
  const sorted = [...cm.values()].sort((a, b) => (orderOf.get(a.id) ?? 1e9) - (orderOf.get(b.id) ?? 1e9) || (+a.id) - (+b.id));
  for (const c of sorted) {
    const r = rootOf(c);
    if (!threads.has(r.id)) {
      const e = ext.get(r.paraId);
      threads.set(r.id, { id: r.id, author: r.author, date: r.date, text: r.text, done: !!(e && e.done),
        quote: (quote.get(r.id) || '').replace(/^\n+|\n+$/g, ''), context: String(context.get(r.id) || ''), replies: [] });
    }
    if (r !== c) threads.get(r.id).replies.push({ id: c.id, author: c.author, date: c.date, text: c.text });
  }
  return [...threads.values()].filter((t) => t.text.trim() || t.replies.length);
}

// ────────────────────────────────────────────────────────────────
// 3) ขาเข้า: จับคู่กับฉาก แล้วรวมกับคอมเมนต์เดิม
// ────────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const same = (a, b) => norm(a) === norm(b);
const tsOf = (d, fallback) => { const x = new Date(d); return Number.isNaN(x.getTime()) ? fallback : x.getTime(); };

/**
 * @param {ReturnType<typeof readDocxComments>} threads
 * @param {Array<{key:string, raw:string, plain:string, comments:Array}>} scenes
 *   raw = ทั้งไฟล์ (ตำแหน่งสมอนับจากนี่) · plain = ข้อความที่ผู้อ่านเห็น (ใช้หาฉาก) · comments = คอมเมนต์เดิม
 * @param {{now?:number}} [opts]
 * @returns {{updates:Map<string,Array>, stats:{added:number, replies:number, resolved:number, same:number, unmatched:number},
 *            unmatched:Array}}  updates: key → รายการคอมเมนต์ใหม่ทั้งชุด (เฉพาะฉากที่เปลี่ยน)
 */
export function planCommentImport(threads, scenes, opts = {}) {
  const now = opts.now || Date.now();
  const stats = { added: 0, replies: 0, resolved: 0, same: 0, unmatched: 0 };
  const work = new Map(scenes.map((s) => [s.key, { ...s, comments: JSON.parse(JSON.stringify(s.comments || [])), changed: false }]));
  const unmatched = [];
  let seq = 0;
  const idOf = () => 'cw' + now.toString(36) + (seq++).toString(36);

  const findScene = (th) => {
    const q = norm(th.quote), ctx = norm(th.context);
    const hits = [];
    for (const s of work.values()) {
      const p = norm(s.plain);
      let score = 0;
      if (ctx && ctx.length >= 4 && p.includes(ctx)) score += 2;
      if (q && p.includes(q)) score += 1;
      if (score) hits.push({ s, score });
    }
    // เธรดที่เคยส่งออกจากโปรแกรม: หาจากคอมเมนต์เดิมที่ข้อความตรงกันก่อน
    for (const s of work.values()) {
      if (s.comments.some((c) => same(c.text, th.text) && same(c.author || '', th.author || '') )) hits.push({ s, score: 3 });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.length ? hits[0].s : null;
  };

  const anchorFor = (raw, th) => {
    const q = String(th.quote || '').trim();
    if (!q) return null;
    // หาเฉพาะในเนื้อ — ข้ามหัวไฟล์ (frontmatter มีชื่อฉากซึ่งมักตรงกับข้อความที่ผูก)
    const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(raw);
    const from = fm ? fm[0].length : 0;
    let i = raw.indexOf(q, from);
    if (i >= 0) return normalizeAnchor({ start: i, end: i + q.length, quote: q });
    // ข้อความที่ผูกคร่อมเครื่องหมายรูปแบบ (`**`) — ลดลงทีละคำจนเจอส่วนที่ตรงตัว (สั้นสุด 2 ตัวอักษร)
    const words = q.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const w of words) { if (w.length >= 2 && (i = raw.indexOf(w, from)) >= 0) return normalizeAnchor({ start: i, end: i + w.length, quote: w }); }
    return null;
  };

  for (const th of threads) {
    const s = findScene(th);
    if (!s) { stats.unmatched++; unmatched.push(th); continue; }
    const mine = s.comments.find((c) => same(c.text, th.text) && same(c.author || '', th.author || ''));
    if (mine) {
      stats.same++;
      for (const r of th.replies) {
        if ((mine.replies || []).some((x) => same(x.text, r.text) && same(x.author || '', r.author || ''))) continue;
        mine.replies = [...(mine.replies || []), makeComment({ text: r.text, author: r.author, now: tsOf(r.date, now), id: idOf() })];
        stats.replies++; s.changed = true;
      }
      if (th.done && !mine.resolved) { mine.resolved = true; mine.resolvedAt = new Date(now).toISOString(); stats.resolved++; s.changed = true; }
      continue;
    }
    const c = makeComment({ text: th.text, author: th.author, position: anchorFor(s.raw, th), now: tsOf(th.date, now), id: idOf() });
    c.replies = th.replies.map((r) => makeComment({ text: r.text, author: r.author, now: tsOf(r.date, now), id: idOf() }));
    if (th.done) { c.resolved = true; c.resolvedAt = new Date(now).toISOString(); }
    c.source = 'docx';
    s.comments.push(c);
    s.changed = true;
    stats.added++;
    stats.replies += c.replies.length;
  }
  const updates = new Map();
  for (const s of work.values()) if (s.changed) updates.set(s.key, s.comments);
  return { updates, stats, unmatched };
}
