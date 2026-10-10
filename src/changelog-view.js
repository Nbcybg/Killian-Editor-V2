// changelog-view.js — [alpha.169 · bug hunt] อ่าน CHANGELOG.md ให้เป็น "หน้าที่คนอ่านได้" (บริสุทธิ์ 100%)
//
// ที่มา: กล่อง "มีอะไรใหม่" (ช่วยเหลือ → บันทึกการเปลี่ยนแปลง · ปุ่มในกล่องเกี่ยวกับ) เท CHANGELOG.md ทั้งไฟล์
// (1.6MB · หนึ่งหมื่นบรรทัด · 140 กว่ารุ่น) ลง <pre> ดิบ ๆ — ผู้ใช้เห็น `## `, `**…**`, `| # | อาการ | … |`
// เป็นตัวหนังสือ ตารางกลายเป็นเส้นขีดยาวข้ามจอ และต้องเลื่อนเองหารุ่นที่อยากอ่าน
// ที่นี่แยกไฟล์เป็น "รุ่น" (หัว `## `) แล้วแตกเนื้อของรุ่นเป็นบล็อก (หัวข้อ · ย่อหน้า · รายการ · ตาราง · อ้างอิง · โค้ด)
// และแตกตัวอักษรในบรรทัดเป็นชิ้น (หนา · เอียง · ขีดฆ่า · โค้ด) — ตัววาดอยู่ที่ dialogs.js (ใช้ textContent ล้วน)
//
// ★ ไม่ใช้ `parseInline()` ของ md.js: ไฟล์นี้เป็นบันทึกของนักพัฒนา เต็มไปด้วยโค้ดในแบ็กทิกที่มี `*` `_` `~` `^`
//   (ไวยากรณ์ของไฟล์งานอ่าน `_x_` เป็นขีดเส้นใต้ · `^x^` เป็นตัวยก) — ต้องกัน "ช่วงโค้ด" ออกก่อนเสมอ
// ไม่ import อะไรเลย — unit test ด้วย node ได้ตรง ๆ (test/changelog-view.test.cjs)

/**
 * แยกไฟล์เป็นรุ่น — หัวระดับ `## ` เปิดรุ่นใหม่ · ของก่อนหัวแรก (คำนำ) ทิ้ง
 * @returns {Array<{title:string, body:string}>}
 */
export function splitChangelog(md) {
  const lines = String(md == null ? '' : md).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let cur = null, fence = false;
  for (const l of lines) {
    if (/^\s{0,3}(```|~~~)/.test(l)) fence = !fence;
    if (!fence && /^## (?!#)/.test(l)) { cur = { title: l.slice(3).trim(), lines: [] }; out.push(cur); continue; }
    if (cur) cur.lines.push(l);
  }
  return out.map((s) => ({ title: s.title, body: s.lines.join('\n').replace(/^\n+|\n+$/g, '') }));
}

/** แยกแถวตารางเป็นช่อง — `|` ในช่วงโค้ด (แบ็กทิก) และ `\|` ไม่ใช่ตัวคั่น */
export function splitRow(line) {
  let s = String(line || '').trim();
  if (s.startsWith('|')) s = s.slice(1);
  const cells = [];
  let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '`') { code = !code; cur += c; continue; }
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '' || !cells.length) cells.push(cur.trim());
  return cells;
}
const isSepRow = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

/**
 * เนื้อของรุ่นหนึ่ง → บล็อก
 * @returns {Array<object>} kind = h|p|li|quote|table|code|hr
 */
export function changelogBlocks(body) {
  const lines = String(body == null ? '' : body).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    const s = l.trim();
    if (!s) { i++; continue; }
    let m;
    if ((m = /^\s{0,3}(```|~~~)/.exec(l))) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(m[1])) { buf.push(lines[i]); i++; }
      i++;
      out.push({ kind: 'code', text: buf.join('\n') });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(s)) { out.push({ kind: 'hr' }); i++; continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(s))) { out.push({ kind: 'h', level: m[1].length, text: m[2].trim() }); i++; continue; }
    if (s.startsWith('|') && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      const head = splitRow(s);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
      out.push({ kind: 'table', head, rows });
      continue;
    }
    if (s.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      out.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }
    if ((m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l))) {
      const ordered = /\d/.test(m[2]);
      let text = m[3];
      const depth = Math.min(3, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
      i++;
      // บรรทัดต่อเนื่องของข้อเดิม (ย่อหน้าเข้ามา · ไม่ใช่ข้อใหม่/บรรทัดว่าง/บล็อกอื่น)
      while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])
             && !lines[i].trim().startsWith('|') && !/^\s{0,3}(```|~~~)/.test(lines[i])) { text += ' ' + lines[i].trim(); i++; }
      out.push({ kind: 'li', ordered, mark: ordered ? m[2] : '', depth, text });
      continue;
    }
    // ย่อหน้า: บรรทัดติดกันจนเจอบรรทัดว่างหรือบล็อกชนิดอื่น
    const buf = [s];
    i++;
    while (i < lines.length) {
      const n = lines[i], t = n.trim();
      if (!t || /^(#{1,6})\s+/.test(t) || t.startsWith('|') || t.startsWith('>') || /^\s{0,3}(```|~~~)/.test(n)
          || /^(\s*)([-*+]|\d+[.)])\s+/.test(n) || /^(-{3,}|\*{3,}|_{3,})$/.test(t)) break;
      buf.push(t); i++;
    }
    out.push({ kind: 'p', text: buf.join('\n') });
  }
  return out;
}

/**
 * ตัวอักษรในบรรทัด → ชิ้น · กันช่วงโค้ดออกก่อน แล้วค่อยหา **หนา** · ~~ขีดฆ่า~~ · *เอียง*
 * @returns {Array<{text:string, code?:boolean, bold?:boolean, em?:boolean, strike?:boolean}>}
 */
export function inlineParts(text) {
  const out = [];
  const src = String(text == null ? '' : text);
  // 1) ยกช่วงโค้ดออกไปพักไว้ แทนด้วยตัวยึดที่ (อักขระ Private Use สองตัวครอบเลขลำดับ) — เครื่องหมายข้างในจึงไม่ถูกตีความ
  //    แต่ตัวหนา/ขีดฆ่าที่ **ครอบ** ช่วงโค้ด (`**\`x\`**` — เขียนแบบนี้ทั้งไฟล์) ยังจับคู่กันได้
  const OPEN = String.fromCharCode(0xE000), CLOSE = String.fromCharCode(0xE001);
  const codes = [];
  const held = src.split(OPEN).join('').split(CLOSE).join('')
    .replace(/(`+)([\s\S]*?)\1/g, (m, tick, body) => { codes.push(body.replace(/^ (.*) $/, '$1')); return OPEN + (codes.length - 1) + CLOSE; });
  const reHold = new RegExp(OPEN + '(\\d+)' + CLOSE, 'g');
  // 2) ชิ้นข้อความธรรมดา: คืนช่วงโค้ดกลับเป็นชิ้นของตัวเอง (พกรูปแบบของตัวที่ครอบมันมาด้วย)
  const emit = (s, st) => {
    let last = 0, k;
    reHold.lastIndex = 0;
    while ((k = reHold.exec(s))) {
      if (k.index > last) out.push({ ...st, text: s.slice(last, k.index) });
      out.push({ ...st, text: codes[+k[1]], code: true });
      last = k.index + k[0].length;
    }
    if (last < s.length) out.push({ ...st, text: s.slice(last) });
  };
  // 3) หนา / ขีดฆ่า / เอียง — ซ้อนกันได้
  const walk = (s, st) => {
    const re = /\*\*([^*\n][\s\S]*?)\*\*|~~([^~\n][\s\S]*?)~~|(?<![*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/;
    let rest = s;
    while (rest) {
      const k = re.exec(rest);
      if (!k) { emit(rest, st); break; }
      if (k.index) emit(rest.slice(0, k.index), st);
      if (k[1] !== undefined) walk(k[1], { ...st, bold: true });
      else if (k[2] !== undefined) walk(k[2], { ...st, strike: true });
      else walk(k[3], { ...st, em: true });
      rest = rest.slice(k.index + k[0].length);
    }
  };
  walk(held, {});
  return out.filter((p) => p.text !== '');
}

/** ชื่อรุ่นแบบสั้น (ตัวเลือกในช่องเลือกรุ่น): ตัดส่วนขยายหลัง " — " ทิ้ง */
export const shortTitle = (title) => String(title || '').split(/\s+—\s+/)[0].trim() || String(title || '');
