// Markdown ⇄ ProseMirror doc JSON — เข้ากับไฟล์ Killian v1 ทุกประการ
// กติกา (เหมือน richtext.py ใน v1):
//   **หนา**  *เอียง*  _ขีดเส้นใต้_  ~~ขีดฆ่า~~  # หัวข้อ  > คำพูดยกมา  - รายการ  1. รายการ
//   ![คำบรรยาย](path) ทั้งบรรทัด = รูป · เครื่องหมายจับคู่ไม่ได้ → คงเป็นตัวอักษร (ไม่มีข้อมูลหาย)

const PATS = [
  [/\*\*\*([^*\n]+)\*\*\*/, ['strong', 'em']],
  [/(?<!\*)\*\*([^*\n]+)\*\*(?!\*)/, ['strong']],
  [/(?<![*\w])\*([^*\n]+)\*(?![*\w])/, ['em']],
  [/(?<![\w_])_([^_\n]+)_(?![\w_])/, ['underline']],
  [/~~([^~\n]+)~~/, ['strike']],
];
// [alpha.83 ข้อ 1] `###` ล้วน ๆ (ไม่มีวรรค/ไม่มีข้อความ) ก็เป็นหัวข้อว่างตามมาตรฐาน CommonMark
// — ต้องจับให้ได้ ไม่งั้นกลายเป็น "ย่อหน้าที่มีข้อความ ###" ค้างอยู่ในไฟล์ตลอดไป
const RE_H = /^(#{1,6})(?: |$)/;
const RE_UL = /^[-*] /;
const RE_OL = /^(\d+)\. /;
const RE_IMG = /^!\[([^\]\n]*)\]\(([^)\n]+)\)\s*$/;
// [alpha.58r บั๊ก 27] เส้นคั่น + บล็อกโค้ด (schema เดิมไม่มี node สองตัวนี้เลย)
const RE_HR = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
// [alpha.61 ข้อ 3] ขึ้นหน้าใหม่ด้วยมือ (Ctrl+Enter) — เก็บเป็นคอมเมนต์มาร์กดาวน์
// แบบเดียวกับ <!--align:…--> : v1 และเครื่องมืออื่นเห็นเป็นคอมเมนต์เฉย ๆ ไม่พัง
const RE_PAGEBREAK = /^\s*<!--\s*pagebreak\s*-->\s*$/i;
const PAGEBREAK_MD = '<!--pagebreak-->';
// [alpha.61 ข้อ 3] ขึ้นบรรทัดในย่อหน้าเดิม (Shift+Enter) = hard break ตามมาตรฐาน CommonMark
// (แบ็กสแลชท้ายบรรทัด) — บรรทัดถัดไปยังเป็น "ย่อหน้าเดียวกัน" ไม่ใช่ย่อหน้าใหม่
const RE_HARDBREAK = /(^|[^\\])((?:\\\\)*)\\$/;
const endsWithHardBreak = (s) => RE_HARDBREAK.test(s);
const stripHardBreak = (s) => s.slice(0, -1);

// ---------- inline: md → [{text, marks:Set}] ----------
function parseInline(s, base = []) {
  const segs = [];
  while (s) {
    let best = null;
    for (const [rx, marks] of PATS) {
      const m = rx.exec(s);
      if (m && (best === null || m.index < best.m.index)) best = { m, marks };
    }
    if (!best) { segs.push({ text: s, marks: base }); break; }
    const { m, marks } = best;
    if (m.index) segs.push({ text: s.slice(0, m.index), marks: base });
    segs.push(...parseInline(m[1], [...new Set([...base, ...marks])]));
    s = s.slice(m.index + m[0].length);
  }
  return segs;
}

function inlineNodes(text) {
  return parseInline(text)
    .filter((x) => x.text)
    .map((x) => ({
      type: 'text', text: x.text,
      ...(x.marks.length ? { marks: x.marks.map((t) => ({ type: t })) } : {}),
    }));
}

function para(text) {
  const content = inlineNodes(text);
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
}

/**
 * [alpha.61 ข้อ 3] เนื้อในของย่อหน้าที่มี hard break — คืน inline nodes ที่คั่นด้วย hard_break
 * @param {string[]} rawLines บรรทัดดิบ (ทุกบรรทัดยกเว้นบรรทัดสุดท้ายลงท้ายด้วย `\`)
 */
function inlineNodesMulti(rawLines) {
  const out = [];
  rawLines.forEach((l, i) => {
    if (i) out.push({ type: 'hard_break' });
    out.push(...inlineNodes(i < rawLines.length - 1 ? stripHardBreak(l) : l));
  });
  return out;
}

// ---------- md → doc ----------
// การจัดหน้า (align) เก็บเป็นคอมเมนต์นำหน้าบล็อก <!--align:center--> (คงไฟล์เป็น markdown แท้
// เปิดร่วมกับ v1 ได้ — v1 จะเห็นเป็นข้อความคอมเมนต์เฉย ๆ ไม่พัง)
// [alpha.58r บั๊ก 25] ทางเลือกที่สะอาดกว่า: เก็บ align ไว้ใน frontmatter (`align: [3:center]`)
// แล้ว body เป็น markdown แท้ ๆ ไม่มีคอมเมนต์ปน — ยังอ่านรูปแบบเดิมได้เสมอ (ไฟล์เก่าไม่พัง)
const RE_ALIGN = /^<!--align:(left|center|right|justify)-->/;
const ALIGNS = ['left', 'center', 'right', 'justify'];

/** แผนที่ align ของบล็อกระดับบน → { "3": "center" } (ใช้เขียนลง frontmatter) */
function collectAlign(doc) {
  const out = {};
  (doc.content || []).forEach((n, i) => {
    const a = (n.attrs || {}).align;
    if (a && a !== 'left' && ALIGNS.includes(a)) out[String(i)] = a;
  });
  return out;
}
/** "3:center, 7:right" ⇄ { "3": "center" } */
function alignToString(map) {
  return Object.keys(map || {}).sort((a, b) => a - b).map((k) => k + ':' + map[k]).join(', ');
}
function alignFromString(v) {
  const out = {};
  const list = Array.isArray(v) ? v : String(v || '').split(',');
  for (const part of list) {
    const m = /^\s*(\d+)\s*:\s*(left|center|right|justify)\s*$/.exec(String(part));
    if (m && m[2] !== 'left') out[m[1]] = m[2];
  }
  return out;
}

function mdToDoc(md, alignMap) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    let align = null;
    const am = RE_ALIGN.exec(line);
    if (am) { align = am[1] === 'left' ? null : am[1]; line = line.slice(am[0].length); }
    let m;
    if ((m = RE_FENCE.exec(line))) {
      const fence = m[1], lang = m[2] || '';
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s{0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[i])) {
        body.push(lines[i]); i++;
      }
      if (i < lines.length) i++;                        // กินบรรทัดปิด
      const txt = body.join('\n');
      out.push({ type: 'code_block', attrs: { lang, fence },
                 ...(txt ? { content: [{ type: 'text', text: txt }] } : {}) });
    } else if (RE_PAGEBREAK.test(line)) {
      out.push({ type: 'page_break' });               // [alpha.61 ข้อ 3] ขึ้นหน้าใหม่ด้วยมือ
      i++;
    } else if (RE_HR.test(line)) {
      out.push({ type: 'horizontal_rule' });
      i++;
    } else if ((m = RE_IMG.exec(line))) {
      out.push({ type: 'figure', attrs: { src: m[2], alt: m[1], md: line.trimEnd() } });
      i++;
    } else if ((m = RE_H.exec(line))) {
      const rest = line.slice(m[0].length);
      const content = rest.trim() ? inlineNodes(rest) : [];
      // หัวข้อที่ไม่มีข้อความ (รวมกรณีมีแต่วรรค) = บรรทัดว่าง — เขียนกลับเป็นบรรทัดว่างจริง ๆ
      out.push(content.length
        ? { type: 'heading', attrs: { level: m[1].length, align }, ...{ content } }
        : { type: 'paragraph', attrs: { align } });
      i++;
    } else if (line.startsWith('> ')) {
      const ps = [];
      while (i < lines.length && lines[i].startsWith('> ')) { ps.push(para(lines[i].slice(2))); i++; }
      out.push({ type: 'blockquote', content: ps });
    } else if (RE_UL.test(line)) {
      const items = [];
      while (i < lines.length && RE_UL.test(lines[i])) {
        items.push({ type: 'list_item', content: [para(lines[i].slice(2))] }); i++;
      }
      out.push({ type: 'bullet_list', content: items });
    } else if ((m = RE_OL.exec(line))) {
      const start = parseInt(m[1], 10);
      const items = [];
      while (i < lines.length && RE_OL.test(lines[i])) {
        items.push({ type: 'list_item', content: [para(lines[i].replace(RE_OL, ''))] }); i++;
      }
      out.push({ type: 'ordered_list', attrs: { order: start }, content: items });
    } else {
      // [alpha.61 ข้อ 3] บรรทัดที่ลงท้ายด้วย `\` = hard break → ย่อหน้าเดียวกับบรรทัดถัดไป
      const raw = [line];
      while (endsWithHardBreak(raw[raw.length - 1]) && i + 1 < lines.length) {
        i++; raw.push(lines[i]);
      }
      const content = raw.length > 1 ? inlineNodesMulti(raw) : inlineNodes(line);
      out.push({ type: 'paragraph', attrs: { align },
                 ...(content.length ? { content } : {}) });
      i++;
    }
  }
  const doc = { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
  // align จาก frontmatter (ถ้ามี) — ทับค่าที่ได้จากคอมเมนต์แบบเก่า
  const map = alignMap && typeof alignMap === 'object' && !Array.isArray(alignMap)
    ? alignMap : alignFromString(alignMap);
  for (const k of Object.keys(map || {})) {
    const n = doc.content[+k];
    if (n && (n.type === 'paragraph' || n.type === 'heading')) {
      n.attrs = { ...(n.attrs || {}), align: map[k] };
    }
  }
  return doc;
}

// ---------- inline: nodes → md (ซ้อนเครื่องหมายตามความยาวช่วงจริง เหมือน v1) ----------
const MARKSET = ['strong', 'em', 'underline', 'strike'];
function starKind(sig) {
  if (sig.has('strong') && sig.has('em')) return '***';
  if (sig.has('strong')) return '**';
  if (sig.has('em')) return '*';
  return '';
}

function emitRuns(runs) {
  const extent = (kind, idx) => {
    let n = 0;
    for (let j = idx; j < runs.length; j++) {
      const sig = runs[j].sig;
      if (kind === '~~' && !sig.has('strike')) break;
      if (kind === '_' && !sig.has('underline')) break;
      if (kind !== '~~' && kind !== '_' && starKind(sig) !== kind) break;
      n += runs[j].text.length;
    }
    return n;
  };
  let out = '';
  let stack = [];
  runs.forEach((run, idx) => {
    const ks = starKind(run.sig);
    const need = new Set();
    if (run.sig.has('strike')) need.add('~~');
    if (run.sig.has('underline')) need.add('_');
    if (ks) need.add(ks);
    const bad = stack.findIndex((mk) => !need.has(mk));
    const pool = new Set();
    if (bad !== -1) {
      for (let j = stack.length - 1; j >= bad; j--) {
        out += stack[j];
        if (need.has(stack[j])) pool.add(stack[j]);
      }
      stack = stack.slice(0, bad);
    }
    for (const mk of need) if (!stack.includes(mk)) pool.add(mk);
    for (const mk of [...pool].sort((a, b) => extent(b, idx) - extent(a, idx))) {
      out += mk; stack.push(mk);
    }
    out += run.text;
  });
  for (let j = stack.length - 1; j >= 0; j--) out += stack[j];
  return out;
}

function inlineToMd(content) {
  // [alpha.61 ข้อ 3] hard_break ตัดชุด run — เขียนเป็น `\` ท้ายบรรทัด แล้วขึ้นบรรทัดใหม่
  // (เครื่องหมายรูปแบบต้องปิดก่อนขึ้นบรรทัด ไม่งั้น `**` คร่อมข้าม \n แล้ว parse กลับไม่ได้)
  const parts = [[]];
  for (const n of content || []) {
    if (n.type === 'hard_break') { parts.push([]); continue; }
    if (n.type !== 'text') continue;
    parts[parts.length - 1].push({
      text: n.text,
      sig: new Set((n.marks || []).map((m) => m.type).filter((t) => MARKSET.includes(t))),
    });
  }
  return parts.map(emitRuns).join('\\\n');
}

// ---------- doc → md ----------
function docToMd(doc, opts) {
  const lines = [];
  // opts.alignComments === false → ไม่เขียน <!--align:…--> ลงไฟล์ (เก็บใน frontmatter แทน)
  const useComments = !opts || opts.alignComments !== false;
  const alignPfx = (n) => { const a = (n.attrs || {}).align;
                            return useComments && a && a !== 'left' ? `<!--align:${a}-->` : ''; };
  const textOf = (n) => (n.content || []).filter((x) => x.type === 'text')
                          .map((x) => x.text).join('');
  for (const node of doc.content || []) {
    switch (node.type) {
      case 'horizontal_rule':
        lines.push('---');
        break;
      case 'page_break':                       // [alpha.61 ข้อ 3] ขึ้นหน้าใหม่ด้วยมือ (Ctrl+Enter)
        lines.push(PAGEBREAK_MD);
        break;
      case 'code_block': {
        const a = node.attrs || {};
        const fence = a.fence && /^(`{3,}|~{3,})$/.test(a.fence) ? a.fence : '```';
        lines.push(fence + (a.lang || ''));
        for (const l of textOf(node).split('\n')) lines.push(l);
        lines.push(fence);
        break;
      }
      case 'figure': {
        const a = node.attrs || {};
        lines.push(a.md || `![${a.alt || ''}](${a.src || ''})`);
        break;
      }
      case 'heading': {
        // [alpha.83 ข้อ 1] หัวข้อที่ไม่มีข้อความ = บรรทัดว่าง **ห้ามเขียน `### ` เปล่า ๆ ลงไฟล์**
        // เดิมเขียน `'### ' + ''` ออกมาเป็น `"### "` (มีวรรคท้าย) ซึ่งดูเหมือนบรรทัดว่างในตัวแก้ไข
        // แต่ทุกตัวที่อ่านไฟล์กลับจะ `replace(/\s+$/,'')` ก่อน แล้วกฎหัวข้อ `#{1,6}\s+` ไม่แมตช์
        // → กลายเป็น **ย่อหน้าที่มีข้อความ `###`** ทั้งใน PDF และ HTML (ดู mdToProseBlocks/mdToHtmlBody)
        const ht = inlineToMd(node.content);
        lines.push(ht.trim() ? alignPfx(node) + '#'.repeat((node.attrs || {}).level || 1) + ' ' + ht : '');
        break;
      }
      case 'blockquote':
        for (const p of node.content || []) lines.push('> ' + inlineToMd(p.content));
        break;
      case 'bullet_list':
        for (const it of node.content || [])
          lines.push('- ' + inlineToMd(((it.content || [])[0] || {}).content));
        break;
      case 'ordered_list': {
        let n = (node.attrs || {}).order || 1;
        for (const it of node.content || [])
          lines.push(`${n++}. ` + inlineToMd(((it.content || [])[0] || {}).content));
        break;
      }
      default:
        lines.push(alignPfx(node) + inlineToMd(node.content));
    }
  }
  return lines.join('\n');
}

// ---------- frontmatter (โครงเดียวกับ v1: --- k: v --- ) ----------
// บล็อกคอมเมนต์ท้ายไฟล์ (comment-core.js) — ต้องตัดออกทุกทางเข้า ไม่งั้นโผล่ในตัวแก้ไข/ส่งออก/นับคำ
// (regex ตัวเดียวกับ BLOCK_RE ใน comments/comment-core.js — md.js เป็น CommonJS จึงไม่ import ข้ามมา)
const K2_COMMENTS_RE = /\n*<!--\s*k2-comments\s*([\s\S]*?)-->\s*$/;

function parseMdFile(text) {
  let meta = {}, body = String(text || '').replace(K2_COMMENTS_RE, '');
  text = body;
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) {
      for (const line of text.slice(3, end).split('\n')) {
        const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
        if (!m) continue;
        const v = m[2].trim();
        meta[m[1]] = v.startsWith('[') && v.endsWith(']')
          ? v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean) : v;
      }
      body = text.slice(end + 4).replace(/^\n+/, '');
    }
  }
  return { meta, body };
}

function dumpMdFile(meta, body) {
  const out = ['---'];
  for (const [k, v] of Object.entries(meta))
    out.push(Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`);
  out.push('---\n');
  return out.join('\n') + body;
}

function countWords(body) {
  const t = body.replace(/[#>*_~\-!\[\]()]/g, ' ');
  let n = 0;
  for (const chunk of t.split(/\s+/)) {
    if (!chunk) continue;
    n += /[\u0E00-\u0E7F]/.test(chunk) ? Math.max(1, Math.round(chunk.length / 5)) : 1;
  }
  return n;
}

module.exports = { mdToDoc, docToMd, parseMdFile, dumpMdFile, countWords,
                   collectAlign, alignToString, alignFromString };
