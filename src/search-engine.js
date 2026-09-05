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
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      _segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    }
  } catch { _segmenter = null; }
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
      matches.push({ line: lineAt(doc.offs, pos), pos, snippet });
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
export async function indexProject(root, kapi, parseMd, opts = {}) {
  const docs = [];
  const walk = async (dir) => {
    for (const name of await kapi.listDirs(dir)) {
      const p = await kapi.join(dir, name);
      await walk(p);
    }
    for (const name of (await kapi.listFiles?.(dir)) || []) {
      const p = await kapi.join(dir, name);
      if (name.endsWith('.md')) {
        try {
          const raw = await kapi.readFile(p);
          const { meta = {}, body = raw } = parseMd ? parseMd(raw) : {};
          docs.push({ id: p, path: p, title: meta.title || name.replace(/\.md$/, ''),
                      tags: meta.tags || [], status: meta.status || '', body });
        } catch {}
      } else if (name.endsWith('.json') && opts.includeJson) {
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
