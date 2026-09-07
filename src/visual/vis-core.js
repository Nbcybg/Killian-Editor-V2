// vis-core.js — แกนของ "เล่าด้วยภาพ" (Visual telling) · บริสุทธิ์ 100% (ไม่แตะ DOM / kapi)
//
// หนึ่งฉาก = หนึ่งไฟล์ตารางข้าง ๆ กัน:  <ชื่อไฟล์ฉาก>_vis.csv
//   scene_01.md  →  scene_01_vis.csv
//
// ทำไมเป็น CSV: เปิดใน Excel/Sheets ได้ตรง ๆ ตามกฎ "ไฟล์แก้นอกโปรแกรมได้"
// คอลัมน์ในไฟล์: no,ref,image,text,remark
//   · no     = ลำดับจริง (เขียนใหม่ทุกครั้งที่ย้ายแถว)
//   · ref    = สมอ **หลายบรรทัดได้** คั่นด้วย `;` แต่ละตัวเป็น `<ตำแหน่งตอนผูก>|<ลายนิ้วมือ>`
//   · image  = พาธรูปสัมพัทธ์กับ Images/ (รูปแบบเดียวกับที่ pickImage คืนมา) · ว่าง = ยังไม่ใส่รูป
//   · text   = **สำเนา**ข้อความของสมอแต่ละตัว เรียงตรงกับ ref คั่นด้วย **บรรทัดว่าง**
//   · remark = ของผู้ใช้เอง (โน้ตกำกับภาพ)
//
// ทำไมคั่นสำเนาด้วยบรรทัดว่างได้อย่างปลอดภัย: `splitLines` ตัดนิยายที่บรรทัดว่างอยู่แล้ว
// และบทหนังตัดทีละบรรทัด → **ไม่มีทางที่บรรทัดต้นทางหนึ่งตัวจะมีบรรทัดว่างอยู่ข้างใน**
// (ยังอ่านรู้เรื่องใน Excel ด้วย — เห็นเป็นหลายย่อหน้าในช่องเดียว)
//
// "ฉาก" / "คอมเมนต์" / "ตัวละครในบรรทัด" ไม่เก็บในไฟล์นี้ — คำนวณสดจาก scenes.json,
// บล็อก k2-comments ท้าย .md และรายชื่อ Wiki (แหล่งความจริงมีที่เดียวเสมอ)

// ───────── ชื่อไฟล์ ─────────
/** 'scene_01.md' → 'scene_01_vis.csv' */
export function visFileName(sceneFileName) {
  const s = String(sceneFileName || '').trim();
  if (!s) return '';
  return s.replace(/\.md$/i, '') + '_vis.csv';
}
/** ไฟล์นี้เป็นตาราง Visual ของฉากไหน — 'scene_01_vis.csv' → 'scene_01.md' (ไม่ใช่ → '') */
export function sceneFileOfVis(visName) {
  const m = /^(.*)_vis\.csv$/i.exec(String(visName || '').trim());
  return m ? m[1] + '.md' : '';
}

// ───────── ลายนิ้วมือข้อความ ─────────
/** ตัดช่องว่างซ้ำ/หัวท้าย — ให้การเว้นบรรทัดที่ต่างกันไม่นับเป็นคนละข้อความ */
export function normText(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
/** djb2 → base36 (สั้น อ่านในไฟล์ได้ ไม่ต้องพึ่ง crypto) */
export function lineHash(s) {
  const t = normText(s);
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export const REF_SEP = ';';
export function makeRef(idx, text) { return String(idx | 0) + '|' + lineHash(text); }
export function parseRef(ref) {
  const s = String(ref || '').trim();
  if (!s) return { idx: -1, hash: '' };
  const i = s.indexOf('|');
  if (i < 0) return { idx: -1, hash: s };
  return { idx: parseInt(s.slice(0, i), 10) || 0, hash: s.slice(i + 1) };
}
/** สมอหลายตัวในช่องเดียว → รายการ */
export function parseRefs(ref) {
  return String(ref || '').split(REF_SEP).map((x) => x.trim()).filter(Boolean).map(parseRef);
}
/** สำเนาข้อความหลายตัวในช่องเดียว → รายการ (คั่นด้วยบรรทัดว่าง) */
export function splitSnaps(text) {
  const s = String(text == null ? '' : text);
  if (!s.trim()) return [];
  return s.split(/\n\s*\n/).map((x) => x.trim());
}
export const SNAP_SEP = '\n\n';
export function joinSnaps(list) { return (list || []).join(SNAP_SEP); }

// ───────── ความคล้าย (ใช้ตอนผู้เขียนแก้ย่อหน้าจนลายนิ้วมือไม่ตรง) ─────────
// ไทยไม่มีช่องว่างระหว่างคำ → เทียบเป็น trigram ของตัวอักษร ไม่ใช่คำ
function trigrams(s) {
  const t = normText(s);
  const out = new Set();
  if (t.length <= 3) { if (t) out.add(t); return out; }
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}
/** Jaccard 0..1 */
export function similarity(a, b) {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return A.size === B.size ? 1 : 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return hit / (A.size + B.size - hit);
}
export const SIMILAR_MIN = 0.4;   // ต่ำกว่านี้ถือว่าคนละย่อหน้า

// ───────── แตกเนื้อฉากเป็น "บรรทัดที่เลือกได้" ─────────
/**
 * นิยาย = หนึ่งย่อหน้า (คั่นด้วยบรรทัดว่าง) · บทหนัง = หนึ่งบรรทัด (หนึ่ง element ของ fountain)
 * @param {string} body เนื้อ .md (ไม่รวม frontmatter / บล็อกคอมเมนต์)
 * @param {'prose'|'screenplay'} format
 * @returns {{i:number,text:string}[]}
 */
export function splitLines(body, format = 'prose') {
  const raw = String(body || '').replace(/<!--align:[^>]*-->/g, '').replace(/\r\n/g, '\n');
  const parts = format === 'screenplay' ? raw.split('\n') : raw.split(/\n\s*\n/);
  const out = [];
  for (const p of parts) {
    const text = p.trim();
    if (!text) continue;
    out.push({ i: out.length, text });
  }
  return out;
}

// ───────── ข้อความสำหรับ "อ่าน" (สตอรีบอร์ดไม่ควรเห็น ** ~~ # > ของมาร์กดาวน์) ─────────
// สำคัญ: ใช้ตอน **แสดงผลเท่านั้น** — สมอ/ลายนิ้วมือยังผูกกับข้อความดิบใน .md เสมอ
// ไม่งั้นแก้ตัวหนาในฉากทีเดียว แถวหลุดสมอทั้งตาราง
export function displayText(raw) {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');       // ![คำบรรยาย](รูป) → คำบรรยาย
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');        // [ข้อความ](ลิงก์) → ข้อความ
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');              // หัวข้อ
  s = s.replace(/^\s{0,3}>\s?/gm, '');                   // ยกคำพูด
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, '');               // รายการไม่มีลำดับ
  s = s.replace(/^\s{0,3}\d+[.)]\s+/gm, '');             // รายการมีลำดับ
  s = s.replace(/~~([^~]+)~~/g, '$1');                   // ขีดฆ่า
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');               // ตัวหนา
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');       // ตัวเอียง
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1$2');         // ตัวเอียงแบบขีดล่าง
  s = s.replace(/`([^`]+)`/g, '$1');                     // โค้ดในบรรทัด
  return s.replace(/[ \t]+$/gm, '');
}

// ───────── ตัวละคร/สถานที่ที่โผล่ในบรรทัด ─────────
/**
 * หาชื่อจาก Wiki ที่ปรากฏในข้อความ — longest-match ไม่ให้ชื่อสั้นแย่งชื่อยาว
 * (ไทยไม่มีช่องว่างระหว่างคำ จะใช้ขอบเขตคำแบบอังกฤษไม่ได้ ต้องจับคู่บนข้อความตรง ๆ)
 * @param {string} text
 * @param {string[]} names รายชื่อทั้งหมด (ชื่อจริง + ชื่อเล่น)
 * @returns {string[]} ชื่อที่เจอ เรียงตามตำแหน่งที่โผล่ ไม่ซ้ำ
 */
export function entitiesIn(text, names) {
  const s = displayText(text);
  if (!s || !names || !names.length) return [];
  const sorted = [...new Set(names.filter(Boolean).map(String))].sort((a, b) => b.length - a.length);
  const taken = new Array(s.length).fill(false);
  const hits = [];
  for (const n of sorted) {
    if (!n) continue;
    let from = 0, at;
    while ((at = s.indexOf(n, from)) >= 0) {
      let free = true;
      for (let k = at; k < at + n.length; k++) if (taken[k]) { free = false; break; }
      if (free) {
        for (let k = at; k < at + n.length; k++) taken[k] = true;
        hits.push({ at, name: n });
      }
      from = at + 1;
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const out = [];
  for (const h of hits) if (!out.includes(h.name)) out.push(h.name);
  return out;
}

// ───────── แถว ─────────
export function makeRow({ no = 0, ref = '', image = '', text = '', remark = '' } = {}) {
  return { no: no | 0, ref: String(ref || ''), image: String(image || ''),
           text: String(text || ''), remark: String(remark || '') };
}
/** สร้างแถวจากบรรทัดต้นทางหนึ่งตัวหรือหลายตัว */
export function rowFromLines(lines) {
  const ls = Array.isArray(lines) ? lines : [lines];
  return makeRow({ ref: ls.map((l) => makeRef(l.i, l.text)).join(REF_SEP),
                   text: joinSnaps(ls.map((l) => l.text)) });
}
/** ผูกแถวกับชุดบรรทัดใหม่ทั้งชุด (ติ๊กเพิ่ม/ติ๊กออกในกล่องเลือกบรรทัด) */
export function bindRow(row, lines, idxs) {
  const byI = new Map((lines || []).map((l) => [l.i, l]));
  const picked = [...new Set(idxs || [])].filter((i) => byI.has(i)).sort((a, b) => a - b);
  row.ref = picked.map((i) => makeRef(i, byI.get(i).text)).join(REF_SEP);
  row.text = joinSnaps(picked.map((i) => byI.get(i).text));
  return row;
}
/** เขียนเลขลำดับใหม่ 1..n — เรียกทุกครั้งหลังเพิ่ม/ลบ/ย้าย */
export function renumber(rows) { (rows || []).forEach((r, i) => { r.no = i + 1; }); return rows; }
/** ย้ายแถว dir = -1 ขึ้น / +1 ลง — คืน index ใหม่ (ไม่ขยับ = คืนค่าเดิม) */
export function moveRow(rows, idx, dir) {
  const j = idx + (dir < 0 ? -1 : 1);
  if (idx < 0 || idx >= rows.length || j < 0 || j >= rows.length) return idx;
  const [r] = rows.splice(idx, 1);
  rows.splice(j, 0, r);
  renumber(rows);
  return j;
}
export function insertRow(rows, idx, row) {
  const at = Math.max(0, Math.min(rows.length, idx < 0 ? rows.length : idx));
  rows.splice(at, 0, row);
  renumber(rows);
  return at;
}
export function removeRow(rows, idx) {
  if (idx < 0 || idx >= rows.length) return null;
  const [r] = rows.splice(idx, 1);
  renumber(rows);
  return r;
}

// ───────── จับคู่แถวกับเนื้อฉากปัจจุบัน ─────────
/**
 * สถานะของ **สมอหนึ่งตัว**:
 *   ok      — เจอย่อหน้าเดิม (อยู่ที่เดิมหรือถูกย้ายที่ก็ตาม)
 *   changed — เจอย่อหน้าที่ "น่าจะใช่" แต่ข้อความถูกแก้ไปแล้ว → ให้ผู้ใช้กดอัปเดตเอง
 *   lost    — หาไม่เจอแล้ว (ผู้เขียนลบบรรทัดนั้นไป) → **แค่ไม่แสดง ไม่ลบแถวทิ้ง**
 */
function resolvePart(hash, snap, ls, hintIdx) {
  if (ls[hintIdx] && lineHash(ls[hintIdx].text) === hash)
    return { status: 'ok', idx: hintIdx, text: ls[hintIdx].text, snap };
  for (let k = 0; k < ls.length; k++)
    if (lineHash(ls[k].text) === hash) return { status: 'ok', idx: k, text: ls[k].text, snap };
  let best = -1, bs = 0;
  for (let k = 0; k < ls.length; k++) {
    const s = similarity(ls[k].text, snap);
    if (s > bs) { bs = s; best = k; }
  }
  if (best >= 0 && bs >= SIMILAR_MIN)
    return { status: 'changed', idx: best, text: ls[best].text, snap, score: bs };
  return { status: 'lost', idx: -1, text: '', snap };
}

/**
 * @returns {{status:'free'|'ok'|'changed'|'lost', parts:Array, live:Array}}
 *   parts = ทุกสมอ (รวมที่หายไปแล้ว — เก็บไว้ในไฟล์เผื่อผู้เขียนกู้ข้อความคืน)
 *   live  = เฉพาะที่ยังหาเจอ = ตัวที่เอาไปแสดงบนจอ
 */
export function resolveRow(row, lines) {
  const ls = lines || [];
  const refs = parseRefs(row && row.ref);
  const snaps = splitSnaps(row && row.text);
  if (!refs.length) return { status: 'free', parts: [], live: [] };
  const parts = refs.map((r, i) => resolvePart(r.hash, snaps[i] == null ? '' : snaps[i], ls, r.idx));
  const live = parts.filter((p) => p.status !== 'lost');
  const status = parts.some((p) => p.status === 'changed') ? 'changed'
               : live.length ? 'ok' : 'lost';
  return { status, parts, live };
}
export function resolveAll(rows, lines) { return (rows || []).map((r) => resolveRow(r, lines)); }

/** ข้อความที่เอาไปแสดง = ทุกสมอที่ยังอยู่ ต่อกันด้วยบรรทัดว่าง */
export function liveText(res) { return (res && res.live ? res.live : []).map((p) => p.text).join(SNAP_SEP); }
/** เลขบรรทัดในฉากของสมอที่ยังอยู่ (นับจาก 1 ให้คนอ่าน) */
export function liveLineNos(res) { return (res && res.live ? res.live : []).map((p) => p.idx + 1); }

/** รับข้อความใหม่เข้าแถว (ผูกสมอใหม่ทุกตัวที่ยังหาเจอ · ตัวที่หายเก็บของเดิมไว้) */
export function syncRow(row, res) {
  if (!res || !res.parts || !res.parts.length) return row;
  const refs = parseRefs(row.ref);
  const snaps = splitSnaps(row.text);
  const nextRefs = [], nextSnaps = [];
  res.parts.forEach((p, i) => {
    if (p.status === 'lost') {
      nextRefs.push(refs[i] ? String(refs[i].idx) + '|' + refs[i].hash : '');
      nextSnaps.push(snaps[i] == null ? '' : snaps[i]);
    } else {
      nextRefs.push(makeRef(p.idx, p.text));
      nextSnaps.push(p.text);
    }
  });
  row.ref = nextRefs.filter(Boolean).join(REF_SEP);
  row.text = joinSnaps(nextSnaps);
  return row;
}

/** บรรทัดที่แถวนี้ผูกอยู่ตอนนี้ (ใช้ติ๊กช่องไว้ล่วงหน้าในกล่องเลือกบรรทัด) */
export function boundIdxs(row, lines) {
  return resolveRow(row, lines).live.map((p) => p.idx);
}
/** map: เลขบรรทัด → จำนวนแถวที่ผูกอยู่ (ให้กล่องเลือกบอกได้ว่าบรรทัดนี้ถูกใช้ไปแล้ว) */
export function lineUsage(rows, lines) {
  const m = new Map();
  for (const r of rows || [])
    for (const i of boundIdxs(r, lines)) m.set(i, (m.get(i) || 0) + 1);
  return m;
}
/** บรรทัดที่ยังไม่มีแถวไหนผูกไว้ */
export function unusedLines(rows, lines) {
  const used = lineUsage(rows, lines);
  return (lines || []).filter((l) => !used.has(l.i));
}

// ───────── คอมเมนต์ของฉาก → แถว ─────────
/** คอมเมนต์ผูกกับข้อความ (anchor.quote) — แถวไหนมีข้อความนั้นอยู่ ก็เป็นของแถวนั้น */
export function commentsForText(text, comments) {
  const t = normText(text);
  if (!t) return [];
  return (comments || []).filter((c) => {
    const q = normText(c && c.anchor && c.anchor.quote);
    return !!q && (t.includes(q) || q.includes(t));
  });
}

// ───────── คอลัมน์ (แสดง/ซ่อน · เรียง · ความกว้าง) ─────────
export const VIS_COL_KEYS = ['no', 'scene', 'image', 'text', 'entities', 'remark', 'comment'];
export const VIS_COL_DEFAULT_OFF = ['scene'];     // ฉากซ้ำทุกแถวในไฟล์เดียว → ปิดไว้ก่อน
/** ความกว้างเริ่มต้น (px) — คอลัมน์ frame ใหญ่ตามสตอรีบอร์ดจริง */
export const VIS_COL_W = { no: 64, scene: 150, image: 300, text: 340, entities: 170, remark: 240, comment: 220 };
export const COL_W_MIN = 56, COL_W_MAX = 1200;
export function clampColW(w, key) {
  const n = Math.round(Number(w));
  if (!Number.isFinite(n)) return VIS_COL_W[key] || 160;
  return Math.max(COL_W_MIN, Math.min(COL_W_MAX, n));
}
/** รับค่าที่เก็บใน project.khn.json (อาจเก่า/เพี้ยน) → คืนรายการคอลัมน์ที่ใช้ได้เสมอ */
export function normalizeCols(cfg) {
  const seen = new Set(), out = [];
  for (const c of Array.isArray(cfg) ? cfg : []) {
    const key = typeof c === 'string' ? c : (c && c.key);
    if (!VIS_COL_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key,
               on: typeof c === 'string' ? true : c.on !== false,
               w: clampColW(typeof c === 'string' ? VIS_COL_W[key] : c.w, key) });
  }
  for (const key of VIS_COL_KEYS)
    if (!seen.has(key)) out.push({ key, on: !VIS_COL_DEFAULT_OFF.includes(key), w: VIS_COL_W[key] });
  if (!out.some((c) => c.on)) out.forEach((c) => { c.on = true; });   // ปิดหมด = ตารางหาย → กันไว้
  return out;
}
export function toggleCol(cols, key) {
  const c = cols.find((x) => x.key === key);
  if (!c) return cols;
  if (c.on && cols.filter((x) => x.on).length === 1) return cols;      // เหลือคอลัมน์สุดท้าย ปิดไม่ได้
  c.on = !c.on;
  return cols;
}
export function moveCol(cols, key, dir) {
  const i = cols.findIndex((x) => x.key === key);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= cols.length) return cols;
  const [c] = cols.splice(i, 1);
  cols.splice(j, 0, c);
  return cols;
}
export function setColWidth(cols, key, w) {
  const c = cols.find((x) => x.key === key);
  if (c) c.w = clampColW(w, key);
  return cols;
}
export function visibleCols(cols) { return normalizeCols(cols).filter((c) => c.on).map((c) => c.key); }
/** ความกว้างรวมของคอลัมน์ที่เปิด (+ คอลัมน์ปุ่มหัว/ท้ายที่ตารางเพิ่มให้เอง) */
export const VIS_FIXED_W = 40 + 42;              // ราง ▲▼ ซ้าย + ปุ่มลบขวา
export function totalWidth(cols) {
  return normalizeCols(cols).filter((c) => c.on).reduce((a, c) => a + c.w, 0) + VIS_FIXED_W;
}

// ───────── CSV (RFC 4180 + BOM + CRLF) ─────────
export const CSV_BOM = '﻿';
export const VIS_HEADER = ['no', 'ref', 'image', 'text', 'remark'];

export function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/** แปลงข้อความ CSV → ตาราง 2 มิติ (รับทั้ง \n และ \r\n · ค่าที่ครอบ " มีคอมมา/ขึ้นบรรทัดได้) */
export function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
      continue;
    }
    if (ch === '"') { q = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}

/** ข้อความไฟล์ → แถว (ไฟล์เสีย/ว่าง = ไม่มีแถว · ห้าม throw) */
export function parseVis(text) {
  const table = parseCsv(text);
  if (!table.length) return [];
  let start = 0;
  const head = table[0].map((h) => String(h || '').trim().toLowerCase());
  const idxOf = {};
  if (head.includes('ref') || head.includes('no')) {
    start = 1;
    VIS_HEADER.forEach((k) => { idxOf[k] = head.indexOf(k); });
  } else {
    VIS_HEADER.forEach((k, i) => { idxOf[k] = i; });     // ไม่มีหัวตาราง = เรียงตามลำดับมาตรฐาน
  }
  const rows = [];
  for (let r = start; r < table.length; r++) {
    const t = table[r];
    const g = (k) => (idxOf[k] >= 0 ? (t[idxOf[k]] || '') : '');
    rows.push(makeRow({ no: parseInt(g('no'), 10) || 0, ref: g('ref'), image: g('image'),
                        text: g('text'), remark: g('remark') }));
  }
  return renumber(rows);
}
/** แถว → ข้อความไฟล์ (มี BOM เสมอ ไม่งั้น Excel บน Windows อ่านไทยเป็นขยะ) */
export function dumpVis(rows) {
  const out = [VIS_HEADER.join(',')];
  for (const r of renumber(rows || []))
    out.push(VIS_HEADER.map((k) => csvCell(r[k])).join(','));
  return CSV_BOM + out.join('\r\n') + '\r\n';
}
