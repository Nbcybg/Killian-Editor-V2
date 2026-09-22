// search-engine.js — เครื่องค้นหาเต็มข้อความทั้งโปรเจกต์ (ข้อ 33)
//
// ⚠️ [alpha.124 ข้อ 22] **สถานะของแต่ละส่วน**
//   · `tokenize` / `tokenizeQuery` — ใช้งานจริง (ai-core.js · ai-analyze.js · starter-names.js)
//   · `SearchIndex` / `parseQuery` / `indexProject` — **ยังไม่มีใครเรียก**: Global Search
//     ยังสแกนไฟล์ตรง ๆ อยู่ · เก็บไว้เพราะมี unit test คุม (`test/search-engine.test.cjs`)
//     และเป็นงานที่ค้างไว้ตั้งใจ (ดู "ยังเหลือ" ใน SKILL.md) ไม่ใช่ซากที่ลืมทิ้ง
// สถาปัตยกรรม: tokenizer (ไทย+อังกฤษ) → inverted index (คำ→ไฟล์→ตำแหน่ง) → คิวรี (คำเดียว/AND/OR/NOT/field) → จัดอันดับ
//
// ออกแบบให้เป็น pure logic: รับ "เอกสาร" เป็น input ไม่ผูกกับ kapi/DOM → ทดสอบด้วย node ได้
// การอ่านไฟล์จริงจากดิสก์อยู่ที่ indexProject() (integration layer ล่างสุด) ที่รับ kapi เข้ามา
//
// รูปแบบเอกสาร 1 ชิ้น: { id, path, title, tags:[], status, body }
//   id    — คีย์เฉพาะ (เช่น path)
//   body  — เนื้อหาข้อความล้วน (แปลงจาก .md/.json มาแล้ว)

// ───────────────────────── Tokenizer ─────────────────────────

// ตัดคำด้วย Intl.Segmenter (ICU) ถ้ามี — แบ่งคำไทยได้โดยไม่ต้องมีพจนานุกรมเอง
// คืน [{ word, pos }] โดย pos = ดัชนีอักขระเริ่มต้นของคำในข้อความเดิม (ใช้ทำ snippet + เลขบรรทัด)
let _segmenter = null;
let _segTried = false;
function getSegmenter() {
  if (_segTried) return _segmenter;
  _segTried = true;
  // [alpha.162 · W7] ตัวตัดคำกลาง (locale.js) — ICU เลือกพจนานุกรมตามตัวอักษร ผลเท่ากันทุกภาษา
  //   ดัชนีที่สร้างตอนเป็นภาษาหนึ่งจึงใช้ค้นตอนเปลี่ยนภาษาได้ (unit test ตรึงไว้)
  _segmenter = wordSegmenter();
  return _segmenter;
}

// fallback เมื่อไม่มี Intl.Segmenter: อังกฤษ/ตัวเลขตัดด้วยขอบเขตอักขระ, ไทยตัดเป็น bigram (2 อักษรซ้อน)
// bigram ทำให้ค้นคำไทยเจอแม้ไม่มีพจนานุกรม (ต้องใช้ตัวเดียวกันตอน index และตอนค้น)
const _THAI = /[\u0E00-\u0E7F]/;
function tokenizeFallback(text) {
  const out = [];
  const re = /[A-Za-z0-9_]+|[\u0E00-\u0E7F]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const chunk = m[0], base = m.index;
    if (_THAI.test(chunk[0])) {
      if (chunk.length === 1) { out.push({ word: chunk, pos: base }); continue; }
      for (let i = 0; i < chunk.length - 1; i++) out.push({ word: chunk.slice(i, i + 2), pos: base + i });
    } else {
      out.push({ word: chunk.toLowerCase(), pos: base });
    }
  }
  return out;
}

// ตัดคำหลัก: ใช้ Segmenter ถ้ามี, ไม่งั้น fallback. คืนเฉพาะคำที่เป็นคำจริง (ตัด ช่องว่าง/สัญลักษณ์ทิ้ง)
import { throwIfCancelled } from './cancel.js';   // [alpha.162 · W5 ข้อ 2]
import { wordSegmenter } from './locale.js';

export function tokenize(text) {
  if (!text) return [];
  const seg = getSegmenter();
  if (!seg) return tokenizeFallback(text);
  const out = [];
  for (const s of seg.segment(text)) {
    if (!s.isWordLike) continue;
    const w = s.segment.trim();
    if (w) out.push({ word: w.toLowerCase(), pos: s.index });
  }
  return out;
}

// คำสำหรับ "ค้นหา" — ตัดแบบเดียวกับ index (เพื่อให้ token ตรงกัน) แต่คืนเฉพาะสตริงคำ
export function tokenizeQuery(text) {
  return tokenize(text).map((t) => t.word);
}

// แผนที่ ตำแหน่งอักขระ → เลขบรรทัด (1-based) จากตาราง offset ต้นบรรทัด
function lineOffsets(text) {
  const offs = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') offs.push(i + 1);
  return offs;
}
function lineAt(offs, pos) {
  // binary search: บรรทัดสุดท้ายที่ offset <= pos
  let lo = 0, hi = offs.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offs[mid] <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans + 1;
}

// ───────────────────────── Inverted Index ─────────────────────────

export class SearchIndex {
  constructor() {
    this.docs = new Map();        // id → { path, title, tags, status, body, offs, len }
    this.index = new Map();       // word → Map(id → number[] ตำแหน่งอักขระ)
    this.fieldIndex = {           // field → Map(word → Set(id))
      title: new Map(), tags: new Map(), status: new Map(),
    };
    this.built = false;
  }

  // เพิ่มเอกสารทีละชิ้นลง index
  addDocument(doc) {
    const { id, path = id, title = '', tags = [], status = '', body = '' } = doc;
    const offs = lineOffsets(body);
    // cache token ของชื่อเรื่องไว้ล่วงหน้า → ตอนให้คะแนนไม่ต้อง tokenize ซ้ำต่อเอกสาร (เร็วขึ้นมาก)
    const titleToks = new Set(tokenizeQuery(title));
    this.docs.set(id, { path, title, tags, status, body, offs, len: body.length, titleToks });
    // index เนื้อหา (คำ → id → ตำแหน่ง)
    for (const { word, pos } of tokenize(body)) {
      let m = this.index.get(word);
      if (!m) { m = new Map(); this.index.set(word, m); }
      let arr = m.get(id);
      if (!arr) { arr = []; m.set(id, arr); }
      arr.push(pos);
    }
    // index field (ค้นแบบ title: tags: status:)
    this._indexField('title', id, title);
    this._indexField('status', id, status);
    for (const t of tags) this._indexField('tags', id, String(t));
  }

  _indexField(field, id, text) {
    const fi = this.fieldIndex[field];
    for (const w of tokenizeQuery(text)) {
      let s = fi.get(w);
      if (!s) { s = new Set(); fi.set(w, s); }
      s.add(id);
    }
  }

  // สร้าง index จากรายการเอกสาร (ล้างของเดิมก่อน)
  build(docsArr) {
    this.docs.clear(); this.index.clear();
    for (const f of Object.values(this.fieldIndex)) f.clear();
    for (const d of docsArr) this.addDocument(d);
    this.built = true;
    return this;
  }

  stats() {
    return { documents: this.docs.size, terms: this.index.size };
  }

  // ───────── การค้นหา ─────────
  // query: สตริง รองรับ  คำเดียว · หลายคำ(AND) · AND/OR/NOT · field:  เช่น
  //   'ทอร่า เค้ก'                → ทั้งสองคำ (AND)
  //   'ทอร่า OR คาสซี่'           → คำใดคำหนึ่ง
  //   'เค้ก NOT ช็อกโกแลต'        → มีเค้ก แต่ไม่มีช็อกโกแลต
  //   'title:ทอร่า status:เขียนเสร็จ' → ค้นเฉพาะ field
  // opts: { limit=50, snippetRadius=30 }
  search(query, opts = {}) {
    const limit = opts.limit ?? 50;
    const radius = opts.snippetRadius ?? 30;
    const ast = parseQuery(query);
    if (!ast) return [];
    // ได้ชุด id ที่ตรงเงื่อนไข + เก็บ term เนื้อหาที่ hit ไว้ทำ snippet/score
    const hitTerms = new Set();       // คำเนื้อหาที่เกี่ยวข้อง (term ดิบจากคิวรี)
    const ids = this._evalNode(ast, hitTerms);
    // แปลง term เป็น token ครั้งเดียว (unique) — ไม่ tokenize ซ้ำต่อเอกสาร
    const hitTokens = [...new Set([...hitTerms].flatMap((t) => tokenizeQuery(t)))];
    const results = [];
    for (const id of ids) {
      const doc = this.docs.get(id);
      if (!doc) continue;
      results.push(this._scoreDoc(id, doc, hitTokens, radius));
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ประเมิน AST → Set(id)
  _evalNode(node, hitTerms) {
    if (node.type === 'term') {
      hitTerms.add(node.value);
      return this._docsFor(node.value);
    }
    if (node.type === 'field') {
      const fi = this.fieldIndex[node.field];
      if (!fi) return new Set();
      // ทุก sub-token ของค่า field ต้องอยู่ (AND) เพื่อรองรับค่าหลายคำ
      const parts = tokenizeQuery(node.value);
      if (!parts.length) return new Set();
      let acc = null;
      for (const p of parts) {
        const s = fi.get(p) || new Set();
        acc = acc === null ? new Set(s) : intersect(acc, s);
      }
      return acc || new Set();
    }
    if (node.type === 'and') return intersect(this._evalNode(node.left, hitTerms), this._evalNode(node.right, hitTerms));
    if (node.type === 'or') return union(this._evalNode(node.left, hitTerms), this._evalNode(node.right, hitTerms));
    if (node.type === 'not') {
      const all = new Set(this.docs.keys());
      return difference(all, this._evalNode(node.right, hitTerms));
    }
    return new Set();
  }

  // เอกสารที่มีคำนี้ (รองรับ token ย่อยจาก tokenizer เดียวกัน — เช่น bigram)
  _docsFor(termText) {
    const toks = tokenizeQuery(termText);
    if (!toks.length) return new Set();
    let acc = null;
    for (const t of toks) {
      const m = this.index.get(t);
      const s = m ? new Set(m.keys()) : new Set();
      acc = acc === null ? s : intersect(acc, s);
    }
    return acc || new Set();
  }

  // ให้คะแนน + สร้าง snippet ต่อเอกสาร (hitTokens = token ที่ tokenize ไว้แล้ว, doc.titleToks = cache)
  _scoreDoc(id, doc, hitTokens, radius) {
    const matches = [];
    let freq = 0;
    // รวมตำแหน่งของทุกคำที่ hit ในเนื้อหา
    const positions = [];
    for (const t of hitTokens) {
      const m = this.index.get(t);
      const arr = m && m.get(id);
      if (arr) { freq += arr.length; for (const p of arr) positions.push({ pos: p, len: t.length }); }
    }
    positions.sort((a, b) => a.pos - b.pos);
    // ทำ snippet จากตำแหน่งแรก ๆ (สูงสุด 3 จุด, ไม่ซ้อนกัน)
    let last = -Infinity;
    for (const { pos, len } of positions) {
      if (matches.length >= 3) break;
      if (pos - last < radius) continue;      // กันซ้อน
      last = pos;
      const from = Math.max(0, pos - radius);
      const to = Math.min(doc.len, pos + len + radius);
      const snippet = (from > 0 ? '…' : '') + doc.body.slice(from, to).replace(/\n/g, ' ') + (to < doc.len ? '…' : '');
      matches.push({ line: lineAt(doc.offs, pos), pos, len, snippet });   // [alpha.161 · S] len = ความยาว token ที่เจอ
    }
    // คะแนน: ความถี่ + โบนัสถ้าคำอยู่ในชื่อเรื่อง + ปรับด้วยความยาว (สั้นกว่า = เด่นกว่า)
    let score = freq;
    for (const t of hitTokens) if (doc.titleToks.has(t)) score += 10;
    score = score / Math.log2(doc.len + 4);   // normalize ความยาว
    return { id, path: doc.path, title: doc.title, status: doc.status, score: +score.toFixed(4), freq, matches };
  }
}

// ───────────────────────── Query Parser ─────────────────────────
// ไวยากรณ์ (ซ้าย→ขวา, AND ผูกแน่นกว่า OR):
//   query   := orExpr
//   orExpr  := andExpr ( OR andExpr )*
//   andExpr := unary ( (AND)? unary )*        // เว้นวรรค = AND โดยปริยาย
//   unary   := NOT unary | atom
//   atom    := field:value | "phrase" | term | ( orExpr )

export function parseQuery(query) {
  if (!query || !query.trim()) return null;
  const toks = lexQuery(query);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === 'OR') {
      next(); const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }
  function parseAnd() {
    let left = parseUnary();
    while (peek()) {
      const t = peek();
      if (t.type === 'op' && t.value === 'OR') break;
      if (t.type === 'rparen') break;
      if (t.type === 'op' && t.value === 'AND') next();   // AND ชัดเจน
      const right = parseUnary();
      if (!right) break;
      left = { type: 'and', left, right };
    }
    return left;
  }
  function parseUnary() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'op' && t.value === 'NOT') { next(); return { type: 'not', right: parseUnary() }; }
    return parseAtom();
  }
  function parseAtom() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'lparen') { next(); const e = parseOr(); if (peek() && peek().type === 'rparen') next(); return e; }
    if (t.type === 'field') { next(); return { type: 'field', field: t.field, value: t.value }; }
    if (t.type === 'word') { next(); return { type: 'term', value: t.value }; }
    next(); return null;
  }
  return parseOr();
}

// ───────────────────────── [alpha.161 · S] ผลค้นหาที่ "ใช้จริงได้" ─────────────────────────

/**
 * คำที่ผู้ใช้ต้องการ "เห็น" ในผล — คำ/วลีฝั่งบวกของคิวรี (ไม่เอาคำใต้ NOT · ไม่เอาค่าของ field:)
 * เรียงยาวก่อนสั้น (ไฮไลต์คำยาวก่อน คำสั้นที่เป็นส่วนของมันจะไม่ถูกตัดกลาง)
 * @returns {string[]}
 */
export function highlightTerms(query) {
  const out = [];
  const walk = (n, neg) => {
    if (!n) return;
    if (n.type === 'term') { if (!neg && String(n.value || '').trim()) out.push(String(n.value).trim()); return; }
    if (n.type === 'not') return walk(n.right, !neg);
    if (n.type === 'and' || n.type === 'or') { walk(n.left, neg); walk(n.right, neg); }
  };
  let ast = null;
  try { ast = parseQuery(query); } catch { ast = null; }
  walk(ast, false);
  const seen = new Set();
  return out.filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.length - a.length);
}

/**
 * ตัดข้อความเป็นช่วง ๆ พร้อมธงว่าช่วงไหนตรงคำค้น (ไม่สนตัวพิมพ์ · ไม่ซ้อนกัน · คำยาวชนะ)
 * ผู้เรียกประกอบเป็น text node/`<mark>` เอง — **ไม่มี HTML ออกจากฟังก์ชันนี้** (กฎข้อ 11)
 * @returns {Array<{text:string, hl:boolean}>}
 */
export function splitHighlight(text, terms) {
  const s = String(text || '');
  const list = (terms || []).map((x) => String(x || '')).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!s || !list.length) return s ? [{ text: s, hl: false }] : [];
  const low = s.toLowerCase();
  const lows = list.map((x) => x.toLowerCase());
  const out = [];
  let i = 0, plain = 0;
  while (i < s.length) {
    let hit = 0;
    for (const w of lows) { if (low.startsWith(w, i)) { hit = w.length; break; } }
    if (!hit) { i++; continue; }
    if (i > plain) out.push({ text: s.slice(plain, i), hl: false });
    out.push({ text: s.slice(i, i + hit), hl: true });
    i += hit; plain = i;
  }
  if (plain < s.length) out.push({ text: s.slice(plain), hl: false });
  return out;
}

/**
 * รายละเอียดของจุดที่เจอ สำหรับ "กระโดดไปตรงนั้น" ในตัวแก้ไข
 * - term  = คำค้นที่ครอบตำแหน่งนี้ (ถ้าไม่มี = token ที่เจอจริง)
 * - start = ตำแหน่งอักขระของ term ใน body
 * - nth   = term นี้เป็นครั้งที่เท่าไรใน body (นับจาก 0 · ไม่สนตัวพิมพ์) — ตัวแก้ไขนับแบบเดียวกันในเอกสาร
 *           (เลขบรรทัดของ .md ≠ ลำดับบล็อกในตัวแก้ไข: บรรทัดว่าง/คอมเมนต์จัดหน้า/รั้วโค้ดทำให้คลาด)
 * - line/lineText = บรรทัดใน body (1-based) และข้อความของบรรทัดนั้น
 */
export function matchDetail(body, pos, len, terms) {
  const b = String(body || '');
  const p = Math.max(0, Math.min(b.length, Number(pos) || 0));
  const l = Math.max(0, Number(len) || 0);
  const low = b.toLowerCase();
  let term = b.slice(p, p + l), start = p;
  for (const w of (terms || []).map((x) => String(x || '')).filter(Boolean).sort((a, c) => c.length - a.length)) {
    const wl = w.toLowerCase();
    // หาคำค้นที่ "ครอบ" ตำแหน่ง token นี้ (token ไทยอาจเป็นแค่ส่วนหนึ่งของคำที่พิมพ์ค้น)
    let k = low.indexOf(wl, Math.max(0, p - wl.length + 1));
    if (k >= 0 && k <= p + Math.max(0, l - 1)) { term = b.slice(k, k + w.length); start = k; break; }
  }
  const tl = term.toLowerCase();
  let nth = 0;
  if (tl) { for (let k = low.indexOf(tl); k >= 0 && k < start; k = low.indexOf(tl, k + 1)) nth++; }
  const ls = b.lastIndexOf('\n', start - 1) + 1;
  let le = b.indexOf('\n', start); if (le < 0) le = b.length;
  const line = b.slice(0, ls).split('\n').length;
  return { term, start, nth, line, lineText: b.slice(ls, le) };
}

// แยก token ของคิวรี: field:value, "วลี", คำ, วงเล็บ, ตัวดำเนินการ AND/OR/NOT
function lexQuery(q) {
  const out = [];
  const re = /\s+|(\()|(\))|"([^"]*)"|(\w[\w\u0E00-\u0E7F]*)\s*:\s*("([^"]*)"|\S+)|([^\s()]+)/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    if (m[0].trim() === '' && !m[1] && !m[2]) continue;
    if (m[1]) { out.push({ type: 'lparen' }); continue; }
    if (m[2]) { out.push({ type: 'rparen' }); continue; }
    if (m[3] !== undefined) { out.push({ type: 'word', value: m[3] }); continue; }
    if (m[4]) {                                   // field:value
      const field = m[4].toLowerCase();
      const val = m[6] !== undefined ? m[6] : m[5];
      out.push({ type: 'field', field, value: val });
      continue;
    }
    if (m[7]) {
      const w = m[7];
      if (w === 'AND' || w === 'OR' || w === 'NOT') out.push({ type: 'op', value: w });
      else out.push({ type: 'word', value: w });
    }
  }
  return out;
}

// ───────────────────────── set helpers ─────────────────────────
function intersect(a, b) { const [s, l] = a.size < b.size ? [a, b] : [b, a]; const o = new Set(); for (const x of s) if (l.has(x)) o.add(x); return o; }
function union(a, b) { const o = new Set(a); for (const x of b) o.add(x); return o; }
function difference(a, b) { const o = new Set(a); for (const x of b) o.delete(x); return o; }

// ───────────────────────── Integration layer ─────────────────────────
// อ่านไฟล์จริงจากโปรเจกต์ผ่าน kapi แล้วสร้าง index — เรียกจาก renderer (app/opencode wire ทีหลัง)
// แยกจาก core logic เพื่อให้ทดสอบ logic ได้โดยไม่ต้องมี electron
// parseMd: ฟังก์ชันแปลง .md → { meta, body } (ส่ง parseMdFile จาก md.js เข้ามา)
/**
 * [alpha.161 · C3] โฟลเดอร์ชั้นบนของโปรเจกต์ที่ไม่ใช่ "งาน" แต่เป็นสำเนาของงาน — ไม่ค้นเข้าไป
 * (ฉากที่ลบแล้วอยู่ใน Recycle · ประวัติเวอร์ชันใน Snapshots · ชุดสำรองใน Backups = ผลค้นหาชี้ไฟล์ผี)
 */
export const SEARCH_SKIP_DIRS = ['Recycle', 'Snapshots', 'Backups'];

/**
 * [alpha.162 · W1-1] ดัชนีที่ถืออยู่ (หรือที่กำลังสร้าง) ใช้ตอบคำขอนี้ได้ไหม
 *
 * ต้นตอบั๊ก: `global-search.js` เช็ค "สด" ครบทุกช่อง (รุ่น/โปรเจกต์/ขอบเขต) แต่ตอนเจองานสร้าง
 * ที่กำลังวิ่งอยู่กลับคืนงานนั้นทันทีโดย **ไม่ดูว่ามันเป็นของโปรเจกต์ไหน/รวม .json ไหม**
 * → สลับโปรเจกต์ระหว่างสร้างดัชนี = ได้ `null` (งานเก่าทิ้งผลตัวเอง) · ขอแบบรวม .json
 * ระหว่างที่งานแบบไม่รวมวิ่งอยู่ = ได้ดัชนีที่ไม่มีไฟล์ .json แล้วค้นไม่เจอทั้งที่ไฟล์มีอยู่
 * ทั้งสองกรณีเงียบสนิท (ไม่มี error) — ผู้ใช้เห็นแค่ "ไม่พบผลลัพธ์"
 *
 * @param {{root?:string, json?:boolean, stale?:boolean}|null} have ดัชนี/งานที่ถืออยู่
 * @param {{root?:string, json?:boolean}} want คำขอรอบนี้
 */
export function indexMatches(have, want) {
  if (!have || have.stale) return false;
  return have.root === (want || {}).root && !!have.json === !!(want || {}).json;
}

/**
 * [alpha.161 · C3] ไฟล์นี้เปลี่ยนแล้วดัชนีค้นหาต้องล้างไหม
 * .md/.json ใต้โปรเจกต์ ที่ไม่ได้อยู่ในโฟลเดอร์สำเนาชั้นบน · การย้าย/ลบส่ง path **ต้นทาง** มา
 */
export function searchPathMatters(root, p) {
  const k = String(p || '').replace(/\\/g, '/');
  if (!/\.(md|json)$/i.test(k)) return false;
  const r = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (!r || !k.toLowerCase().startsWith(r.toLowerCase() + '/')) return false;
  const top = k.slice(r.length + 1).split('/')[0].toLowerCase();
  return !SEARCH_SKIP_DIRS.some((d) => d.toLowerCase() === top);
}

// [alpha.161 · C3] opts.skipDirs = ชื่อโฟลเดอร์ **ชั้นบนสุดของโปรเจกต์** ที่ไม่ต้องเข้า (ไม่สนตัวพิมพ์)
//   — ถังขยะ/ประวัติเวอร์ชัน/ชุดสำรองเป็น "สำเนา" ของงาน ถ้านับด้วย ฉากที่ลบแล้วยังโผล่ในผลค้นหา (ไฟล์ผี)
// [alpha.162 · W5 ข้อ 2] opts.signal = ยกเลิกได้ (โยน cancelledError ระหว่างไฟล์) ·
//   opts.onProgress(n) = อ่านไปแล้ว n ไฟล์ (ไม่รู้จำนวนทั้งหมดล่วงหน้า — เดินไปนับไป)
export async function indexProject(root, kapi, parseMd, opts = {}) {
  const docs = [];
  const skip = new Set((opts.skipDirs || []).map((x) => String(x).toLowerCase()));
  let seen = 0;
  const tick = () => {
    throwIfCancelled(opts.signal);
    seen++;
    if (typeof opts.onProgress === 'function' && seen % 10 === 0) { try { opts.onProgress(seen); } catch {} }
  };
  const walk = async (dir, depth = 0) => {
    throwIfCancelled(opts.signal);
    for (const name of await kapi.listDirs(dir)) {
      if (depth === 0 && skip.has(String(name).toLowerCase())) continue;
      const p = await kapi.join(dir, name);
      await walk(p, depth + 1);
    }
    for (const name of (await kapi.listFiles?.(dir)) || []) {
      const p = await kapi.join(dir, name);
      if (name.endsWith('.md')) {
        tick();
        try {
          const raw = await kapi.readFile(p);
          const { meta = {}, body = raw } = parseMd ? parseMd(raw) : {};
          docs.push({ id: p, path: p, title: meta.title || name.replace(/\.md$/, ''),
                      tags: meta.tags || [], status: meta.status || '', body });
        } catch {}
      } else if (name.endsWith('.json') && opts.includeJson) {
        tick();
        try {
          const raw = await kapi.readFile(p);
          docs.push({ id: p, path: p, title: name, tags: [], status: '', body: raw });
        } catch {}
      }
    }
  };
  await walk(root);
  return new SearchIndex().build(docs);
}
