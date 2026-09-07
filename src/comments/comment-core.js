// comment-core.js — คอมเมนต์/หมายเหตุแบบมีเธรด เก็บไว้ในไฟล์ .md เอง (ข้อ 64)
// pure logic + adapter · spec: docs/64-comments.md
//
// เก็บอย่างไร: บล็อก HTML comment ท้ายไฟล์ .md — มองไม่เห็นตอน render, แก้นอกโปรแกรมได้, ไม่ต้องมีไฟล์คู่
//   <!-- k2-comments
//   [ {...}, {...} ]
//   -->
// ตัวเนื้อหาไม่ถูกแตะเลย → เปิดด้วย v1 (Python) ได้เหมือนเดิม (เห็นเป็นคอมเมนต์ HTML ท้ายไฟล์)

export const BLOCK_START = '<!-- k2-comments';
export const BLOCK_END = '-->';
const BLOCK_RE = /\n*<!--\s*k2-comments\s*([\s\S]*?)-->\s*$/;

let _seq = 0;
const newId = (now) => 'c' + Number(now).toString(36) + (_seq++).toString(36);

// ───────── โครงข้อมูล ─────────
/**
 * @typedef {{id, author, text, timestamp, resolved, replies:Array, anchor:{start,end,quote}|null}} Comment
 */
export function makeComment({ text, author = '', position = null, now = Date.now(), id = null } = {}) {
  return {
    id: id || newId(now),
    author: String(author || ''),
    text: String(text || ''),
    timestamp: new Date(now).toISOString(),
    resolved: false,
    replies: [],
    anchor: normalizeAnchor(position),
  };
}
/** position อาจเป็นตัวเลข (ตำแหน่งเคอร์เซอร์) หรือ { start, end, quote } */
export function normalizeAnchor(position) {
  if (position == null) return null;
  if (typeof position === 'number') return { start: position, end: position, quote: '' };
  const { start = 0, end = start, quote = '' } = position;
  return { start: num(start), end: num(end), quote: String(quote || '') };
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

// ───────── อ่าน/เขียนในไฟล์ .md ─────────
/** Extract the comment array from a markdown file (never throws). */
export function parseComments(md) {
  const m = BLOCK_RE.exec(String(md || ''));
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1].trim());
    return Array.isArray(arr) ? arr.map(fix) : [];
  } catch { return []; }                      // บล็อกเสีย = ถือว่าไม่มีคอมเมนต์ (ห้ามทำให้เปิดไฟล์ไม่ได้)
}
function fix(c) {
  return {
    id: c.id || newId(Date.now()), author: c.author || '', text: c.text || '',
    timestamp: c.timestamp || new Date(0).toISOString(), resolved: !!c.resolved,
    replies: Array.isArray(c.replies) ? c.replies.map(fix) : [],
    anchor: c.anchor ? normalizeAnchor(c.anchor) : null,
  };
}
/** Markdown body without the comment block (this is what the editor loads). */
export function stripComments(md) {
  return String(md || '').replace(BLOCK_RE, '').replace(/\s+$/, '');
}
/** Body + comments → the text to write back to disk. */
export function mergeComments(md, comments) {
  const body = stripComments(md);
  if (!comments || !comments.length) return body ? body + '\n' : '';
  return `${body}\n\n${BLOCK_START}\n${JSON.stringify(comments, null, 1)}\n${BLOCK_END}\n`;
}
// ───────── ปฏิบัติการกับรายการคอมเมนต์ (pure — คืนรายการใหม่เสมอ) ─────────
/** Add a comment. `position` = number | {start,end,quote} | null */
export function addComment(comments, { text, author, position, now = Date.now(), id } = {}) {
  const c = makeComment({ text, author, position, now, id });
  return { comments: [...(comments || []), c], comment: c };
}
/** Reply to a comment (or to a reply — เธรดซ้อนได้). */
export function replyTo(comments, parentId, { text, author, now = Date.now(), id } = {}) {
  const reply = makeComment({ text, author, now, id });
  let found = false;
  const walk = (list) => list.map((c) => {
    if (c.id === parentId) { found = true; return { ...c, replies: [...c.replies, reply] }; }
    return c.replies.length ? { ...c, replies: walk(c.replies) } : c;
  });
  const out = walk(comments || []);
  return { comments: out, reply: found ? reply : null, ok: found };
}
/** Mark resolved/unresolved (ทั้งเธรดถือว่าปิดตามหัวเธรด). */
export function resolveComment(comments, id, resolved = true) {
  let found = false;
  const walk = (list) => list.map((c) => {
    if (c.id === id) { found = true; return { ...c, resolved: !!resolved, resolvedAt: resolved ? new Date().toISOString() : null }; }
    return c.replies.length ? { ...c, replies: walk(c.replies) } : c;
  });
  return { comments: walk(comments || []), ok: found };
}
export function editComment(comments, id, text) {
  let found = false;
  const walk = (list) => list.map((c) => {
    if (c.id === id) { found = true; return { ...c, text: String(text), editedAt: new Date().toISOString() }; }
    return c.replies.length ? { ...c, replies: walk(c.replies) } : c;
  });
  return { comments: walk(comments || []), ok: found };
}
/** Delete a comment (and its whole thread). */
export function deleteComment(comments, id) {
  let found = false;
  const walk = (list) => list.filter((c) => {
    if (c.id === id) { found = true; return false; }
    return true;
  }).map((c) => (c.replies.length ? { ...c, replies: walk(c.replies) } : c));
  return { comments: walk(comments || []), ok: found };
}
export function findComment(comments, id) {
  for (const c of comments || []) {
    if (c.id === id) return c;
    const inner = findComment(c.replies, id);
    if (inner) return inner;
  }
  return null;
}
export function countComments(comments) {
  return (comments || []).reduce((n, c) => n + 1 + countComments(c.replies), 0);
}
export function openComments(comments) { return (comments || []).filter((c) => !c.resolved); }

// ───────── สมอ (anchor) — ข้อความขยับเมื่อผู้เขียนแก้ไฟล์ ─────────
/**
 * Re-locate an anchor after the text changed: trust the quote over the offsets.
 * @returns {{start,end,quote,lost?:boolean}}
 */
export function reanchor(text, anchor) {
  if (!anchor) return null;
  const src = String(text || '');
  const q = anchor.quote;
  if (!q) {
    const start = Math.min(anchor.start, src.length);
    return { ...anchor, start, end: Math.min(anchor.end, src.length) };
  }
  if (src.slice(anchor.start, anchor.end) === q) return { ...anchor };      // ยังอยู่ที่เดิม
  // หาที่ใกล้ตำแหน่งเดิมที่สุด (ข้อความซ้ำกันหลายที่ = เลือกอันที่ขยับน้อยสุด)
  let best = -1, bestDist = Infinity, from = 0, idx;
  while ((idx = src.indexOf(q, from)) >= 0) {
    const d = Math.abs(idx - anchor.start);
    if (d < bestDist) { bestDist = d; best = idx; }
    from = idx + 1;
  }
  if (best < 0) return { ...anchor, lost: true };                           // ข้อความที่คอมเมนต์ถูกลบไปแล้ว
  return { start: best, end: best + q.length, quote: q };
}
/** Re-anchor every comment against the current body. */
export function reanchorAll(text, comments) {
  return (comments || []).map((c) => (c.anchor ? { ...c, anchor: reanchor(text, c.anchor) } : c));
}
/** Quote helper: pull the text a position range refers to. */
export function quoteAt(text, start, end) { return String(text || '').slice(start, end); }

// ────────────────────────────────────────────────────────────────
// CommentStore — ผูกกับไฟล์ .md จริง (io = kapi ก็ได้)
//   io = { readFile, writeFile, exists }
// ────────────────────────────────────────────────────────────────
export class CommentStore {
  constructor({ io, now = () => Date.now(), author = '' } = {}) { this.io = io; this.now = now; this.author = author; }

  /** @returns {Promise<{body, comments}>} */
  async read(path) {
    let raw = '';
    try { raw = (await this.io.readFile(path)) || ''; } catch { raw = ''; }
    return { body: stripComments(raw), comments: parseComments(raw), raw };
  }
  async write(path, body, comments) {
    await this.io.writeFile(path, mergeComments(body, comments));
    return true;
  }
  /** Add a comment to a scene file. position = number | {start,end,quote} */
  async add(path, position, text, opts = {}) {
    const { body, comments } = await this.read(path);
    const anchor = normalizeAnchor(position);
    if (anchor && !anchor.quote && anchor.end > anchor.start) anchor.quote = quoteAt(body, anchor.start, anchor.end);
    const res = addComment(comments, { text, author: opts.author ?? this.author, position: anchor, now: this.now() });
    await this.write(path, body, res.comments);
    return res.comment;
  }
  async reply(path, parentId, text, opts = {}) {
    const { body, comments } = await this.read(path);
    const res = replyTo(comments, parentId, { text, author: opts.author ?? this.author, now: this.now() });
    if (!res.ok) return null;
    await this.write(path, body, res.comments);
    return res.reply;
  }
  async resolve(path, id, resolved = true) {
    const { body, comments } = await this.read(path);
    const res = resolveComment(comments, id, resolved);
    if (res.ok) await this.write(path, body, res.comments);
    return res.ok;
  }
  async edit(path, id, text) {
    const { body, comments } = await this.read(path);
    const res = editComment(comments, id, text);
    if (res.ok) await this.write(path, body, res.comments);
    return res.ok;
  }
  async remove(path, id) {
    const { body, comments } = await this.read(path);
    const res = deleteComment(comments, id);
    if (res.ok) await this.write(path, body, res.comments);
    return res.ok;
  }
  async list(path, { openOnly = false, reanchor: doReanchor = true } = {}) {
    const { body, comments } = await this.read(path);
    const list = doReanchor ? reanchorAll(body, comments) : comments;
    return openOnly ? openComments(list) : list;
  }
  /** Save an edited body while keeping the comments (re-anchored against the new text). */
  async saveBody(path, newBody) {
    const { comments } = await this.read(path);
    await this.write(path, newBody, reanchorAll(newBody, comments));
    return true;
  }
}

// ───────── ย้ายของเก่า: คอมเมนต์ที่เคยเก็บใน scenes.json (src/comments.js) ─────────
/**
 * Convert rows from scenes.json (`row.comments[] = {id,text,date}`) into the new shape.
 * @returns {{[sceneId:string]: Comment[]}}
 */
export function fromScenesJson(scenesJson, opts = {}) {
  const out = {};
  const chapters = (scenesJson && scenesJson.chapters) || {};
  for (const cg of Object.keys(chapters)) {
    for (const row of chapters[cg] || []) {
      if (!row || !Array.isArray(row.comments) || !row.comments.length) continue;
      out[row.id] = row.comments.map((c) => ({
        id: c.id || newId(Date.now()), author: c.author || opts.author || '', text: c.text || '',
        timestamp: c.date || c.timestamp || new Date(0).toISOString(),
        resolved: !!c.resolved, replies: [], anchor: null,
      }));
    }
  }
  return out;
}
