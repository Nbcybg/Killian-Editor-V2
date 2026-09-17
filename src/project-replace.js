// project-replace.js — [alpha.156] ค้นหา-แทนที่ทั้งโปรเจกต์ (ตรรกะล้วน)
//
// แผงค้นหาทั้งโปรเจกต์ค้นได้อย่างเดียว · "แทนที่ทั้งหมด" มีแค่ในฉากที่เปิดอยู่
// ผู้เขียนที่เปลี่ยนชื่อตัวละคร/สถานที่กลางเรื่องจึงต้องเปิดทีละฉาก
//
// กติกา: แทนที่เฉพาะ **เนื้อฉาก** (body) — frontmatter/คอมเมนต์ท้ายไฟล์ไม่ถูกแตะ (UI แยกให้ก่อนส่งมา)
// ไฟล์นี้บริสุทธิ์ → unit test ได้ตรง ๆ

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;
export const escapeRegExp = (s) => String(s).replace(RE_SPECIAL, '\\$&');

/**
 * สร้าง RegExp จากคำค้น
 * @param {string} query
 * @param {{caseSensitive?:boolean, wholeWord?:boolean, regex?:boolean}} opts
 *   wholeWord ใช้ได้กับอักษรละตินเท่านั้น (ภาษาไทยไม่มีช่องว่างคั่นคำ — ขอบคำตัดสินจากตัวอักษรไม่ได้)
 * @returns {RegExp|null} null = คำค้นว่าง/regex ผิดรูป
 */
export function buildMatcher(query, opts = {}) {
  const q = String(query == null ? '' : query);
  if (!q) return null;
  let src = opts.regex ? q : escapeRegExp(q);
  if (opts.wholeWord) src = '(?<![\\p{L}\\p{N}_])(?:' + src + ')(?![\\p{L}\\p{N}_])';
  try {
    const re = new RegExp(src, 'gu' + (opts.caseSensitive ? '' : 'i'));
    if (re.test('')) return null;                    // จับสตริงว่างได้ = แทนที่วนไม่จบ
    re.lastIndex = 0;
    return re;
  } catch { return null; }
}

/**
 * ตำแหน่งที่เจอในข้อความ + บริบทรอบ ๆ ไว้แสดงตัวอย่าง
 * @returns {Array<{index:number, length:number, line:number, before:string, match:string, after:string}>}
 */
export function findMatches(text, query, opts = {}, { limit = 500, context = 30 } = {}) {
  const re = buildMatcher(query, opts);
  const s = String(text || '');
  if (!re) return [];
  const out = [];
  let m;
  while ((m = re.exec(s)) && out.length < limit) {
    const i = m.index;
    out.push({
      index: i, length: m[0].length,
      line: s.slice(0, i).split('\n').length,
      before: s.slice(Math.max(0, i - context), i).replace(/\n/g, ' '),
      match: m[0],
      after: s.slice(i + m[0].length, i + m[0].length + context).replace(/\n/g, ' '),
    });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

/**
 * แทนที่ทั้งหมดในข้อความเดียว
 * @param {string} repl ข้อความแทน — โหมด regex รองรับ $1 $2 · โหมดธรรมดาใช้ตามตัวอักษร ($ ไม่พิเศษ)
 * @returns {{text:string, count:number}}
 */
export function replaceAllInText(text, query, repl, opts = {}) {
  const re = buildMatcher(query, opts);
  const s = String(text || '');
  if (!re) return { text: s, count: 0 };
  let count = 0;
  const r = String(repl == null ? '' : repl);
  const out = s.replace(re, (...args) => {
    count++;
    if (!opts.regex) return r;
    const groups = args.slice(1, -2);
    return r.replace(/\$(\d{1,2}|&)/g, (m, g) => (g === '&' ? args[0] : (groups[+g - 1] ?? '')));
  });
  return { text: out, count };
}

/**
 * รายการไฟล์ที่ต้องแก้ พร้อมจำนวน — ใช้ทั้งตอน "ดูตัวอย่าง" และ "แทนที่จริง" (ทางเดียวกัน)
 * @param {Array<{file:string, title?:string, body:string, locked?:boolean}>} docs
 * @returns {{files:Array<{file,title,count,locked,matches}>, total:number, lockedSkipped:number}}
 */
export function planReplace(docs, query, opts = {}) {
  const files = [];
  let total = 0, lockedSkipped = 0;
  for (const d of docs || []) {
    const matches = findMatches(d.body, query, opts, { limit: 50 });
    if (!matches.length) continue;
    const count = replaceAllInText(d.body, query, '', opts).count;
    if (d.locked) { lockedSkipped += count; }
    else total += count;
    files.push({ file: d.file, title: d.title || '', count, locked: !!d.locked, matches: matches.slice(0, 3) });
  }
  return { files, total, lockedSkipped };
}
