// dialogue-core.js — [alpha.79] เอนจิน "รวมบทพูดทั้งโปรเจกต์" (บริสุทธิ์ 100% · มี unit test)
//
// โจทย์จากผู้ใช้: รวบรวมบทพูดทั้งผลงาน กรองตาม เล่ม/บท/ฉาก/ตัวละคร บอกตำแหน่งบรรทัด
// คลิกกระโดดไปได้ และแก้ไขได้ทันที
//
// ═══ วิธี "จับ" บทพูด ═══
//   1. **เครื่องหมายคำพูด** — ข้อความในเครื่องหมายคำพูดคู่ใดก็ได้ (ดู QUOTE_PAIRS)
//      ชื่อตัวละครที่อยู่ "ด้านหน้า" เครื่องหมายเปิด = คนพูด
//      ไม่เจอชื่อด้านหน้า → ลองด้านหลังเครื่องหมายปิด (ธรรมเนียมไทย: "…" สมชายกล่าว)
//      ไม่เจอทั้งสองฝั่ง → ไม่ระบุ (ผู้ใช้เรียกว่า "อื่น ๆ / ไม่ชัดเจน")
//   2. **บทภาพยนตร์** — บรรทัด `@ชื่อ` แล้วบรรทัดถัดมาเป็นบทพูด (ไม่ต้องมีเครื่องหมายคำพูด)
//      ตัวละครมาจากรหัสตรง ๆ จึงชัดเจนเสมอ
//
// ═══ ทำไมต้องบริสุทธิ์ ═══
// การ "แก้บทพูดแล้วเขียนกลับลงไฟล์" ผิดพลาดไม่ได้เลย — พลาดครั้งเดียวคือเนื้อเรื่องหาย
// ตัวตัด/ตัวเขียนกลับจึงอยู่ที่นี่ทั้งหมด ทดสอบด้วย node ตรง ๆ ได้ ไม่ต้องเปิดหน้าต่าง

// ── เครื่องหมายคำพูดที่รู้จัก ─────────────────────────────────────────
// เปิด/ปิดเหมือนกัน (") ต้องจับคู่แบบ "ตัวถัดไป" · เปิด/ปิดต่างกัน (“ ”) จับคู่ตรงตัว
export const QUOTE_PAIRS = [
  ['"', '"'],
  ['“', '”'],      // “ ”
  ['‘', '’'],      // ‘ ’
  ['«', '»'],      // « »
  ['「', '」'],      // 「 」
  ['『', '』'],      // 『 』
];
const OPENERS = new Map(QUOTE_PAIRS.map(([o, c]) => [o, c]));

/** ที่มาของบทพูดหนึ่งบรรทัด */
export const SRC_PROSE = 'prose';       // เครื่องหมายคำพูดในนิยาย
export const SRC_SCRIPT = 'script';     // บทพูดของบทภาพยนตร์ (@ตัวละคร)

/** ตำแหน่งที่เจอชื่อคนพูด */
export const WHERE_FRONT = 'front';
export const WHERE_BACK = 'back';
export const WHERE_TAG = 'tag';         // รหัส @ ของบทภาพยนตร์
export const WHERE_TURN = 'turn';       // เดาจากการสลับกันพูด (ไม่มีชื่อทั้งสองฝั่ง)
export const WHERE_NONE = 'none';

/**
 * [alpha.80] **สรรพนามไทยคือต้นตอที่ทำให้นิยายระบุคนพูดไม่ได้**
 *
 * บทภาพยนตร์มีรหัส `@ชื่อ` จึงชัดเจนเสมอ แต่นิยายไทยเขียนแบบนี้เป็นปกติ:
 *
 *     "สวัสดีครับ" โทระกล่าว          ← มีชื่อ (จับได้)
 *     "มาสายอีกแล้ว" เธอตอบ           ← **สรรพนาม** ไม่มีชื่อ (จับไม่ได้)
 *     "ขอโทษครับ" เขาก้มหน้า          ← **สรรพนาม** ไม่มีชื่อ (จับไม่ได้)
 *
 * ในบทสนทนาจริง สองบรรทัดล่างคือ "คนเดิมสองคนสลับกันพูด" — คนอ่านรู้เองจากบริบท
 * ตัวจับจึงต้องรู้ด้วย ไม่งั้นบทพูดครึ่งเรื่องตกไปกอง "ไม่ระบุ" ทั้งที่อ่านออกว่าใครพูด
 *
 * กติกาที่ใช้ (อนุรักษ์นิยม — เดาเฉพาะตอนที่มั่นใจ):
 *   · นับเฉพาะ "ช่วงบทสนทนา" = บทพูดที่ติดกัน (คั่นด้วยบรรยายได้ไม่เกิน GAP บรรทัด)
 *   · ในช่วงนั้นต้องมีคนที่ **ระบุชื่อชัดเจนแล้ว 2 คน** เท่านั้น
 *   · บทพูดที่ไม่มีชื่อ → ยกให้ "คนที่ไม่ใช่คนพูดก่อนหน้า" (สลับกันพูดตามธรรมเนียม)
 * ผลลัพธ์ติดธง `guessed:true` เสมอ — หน้าจอแสดงต่างจากที่รู้ชื่อแน่ ๆ และกรองออกได้
 */
export const TURN_GAP = 6;              // บรรยายคั่นได้กี่บรรทัดถึงยังนับเป็นบทสนทนาเดียวกัน

// ── ตัดคำ/ตัวคั่นที่ไม่ใช่ชื่อ ───────────────────────────────────────
// ใช้ตัดหางประโยคก่อนหาชื่อ เช่น `สมชายพูดว่า "…"` → prefix = `สมชายพูดว่า`
const TRIM_CHARS = /[\s \t.,:;!?—–\-…()[\]{}<>"'“”‘’]+$/;

/**
 * หาเครื่องหมายคำพูดทั้งหมดในหนึ่งบรรทัด
 * @param {string} line บรรทัดเดียว (ไม่มี \n)
 * @returns {Array<{open:number, close:number, text:string, pair:[string,string], closed:boolean}>}
 *   open  = ดัชนีของอักขระเปิด · close = ดัชนีของอักขระปิด (-1 = ไม่ปิดในบรรทัดนี้)
 */
export function findQuotes(line) {
  const s = String(line == null ? '' : line);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const closer = OPENERS.get(ch);
    if (closer === undefined) { i++; continue; }
    let close = -1;
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === closer) { close = j; break; }
    }
    if (close === -1) {
      // ไม่ปิดในบรรทัดนี้ — ยังนับเป็นบทพูด (ดีกว่าปล่อยหาย) แต่ติดธงไว้ให้ UI เตือน
      out.push({ open: i, close: -1, text: s.slice(i + 1), pair: [ch, closer], closed: false });
      break;
    }
    out.push({ open: i, close, text: s.slice(i + 1, close), pair: [ch, closer], closed: true });
    i = close + 1;
  }
  return out;
}

/**
 * หาชื่อที่ "อยู่ใกล้เครื่องหมายคำพูดที่สุด" ในข้อความชิ้นหนึ่ง
 *
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงหาแบบ substring ล้วน ๆ แล้วเลือกตัวที่ชิดขอบที่สุด
 * @param {string} chunk ข้อความที่จะค้น
 * @param {string[]} names รายชื่อตัวละคร (รวมชื่อเล่น/นามแฝง)
 * @param {'end'|'start'} edge ชิดปลายไหน — 'end' = ใกล้เครื่องหมายเปิด (ข้อความด้านหน้า)
 * @returns {string} ชื่อที่เจอ ('' = ไม่เจอ)
 */
export function nameNear(chunk, names, edge = 'end') {
  const s = String(chunk == null ? '' : chunk);
  if (!s || !Array.isArray(names) || !names.length) return '';
  let best = '', bestScore = -Infinity;
  for (const raw of names) {
    const n = String(raw || '').trim();
    if (!n) continue;
    const at = edge === 'end' ? s.lastIndexOf(n) : s.indexOf(n);
    if (at < 0) continue;
    // ชิดขอบมากกว่า = คะแนนสูงกว่า · เท่ากันให้ชื่อยาวชนะ (กัน "สม" แย่ง "สมชาย")
    const dist = edge === 'end' ? s.length - (at + n.length) : at;
    const score = -dist * 1000 + n.length;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

/** ตัดหางที่ไม่ใช่ชื่อออกจากข้อความด้านหน้าเครื่องหมายเปิด */
export function trimPrefix(s) {
  return String(s == null ? '' : s).replace(TRIM_CHARS, '');
}

/** รหัส `@ชื่อ (V.O.)` → `ชื่อ` (ตัดส่วนขยายในวงเล็บออก) */
export function characterFromTag(line) {
  const s = String(line == null ? '' : line).trim();
  if (!s.startsWith('@')) return '';
  return s.slice(1).replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** บรรทัดนี้เป็นรหัสของบทภาพยนตร์ที่ "ไม่ใช่บทพูด" ไหม (หัวฉาก/ทรานซิชัน/โน้ต ฯลฯ) */
export function isScriptCode(line) {
  const s = String(line == null ? '' : line).trim();
  if (!s) return false;
  // `.หัวฉาก` `$shot ` `$sub ` `$in ` = รหัสรุ่น v1 — ไฟล์เก่ายังใช้อยู่ ต้องรู้จักด้วย
  // (`.` ต้องตามด้วยอักขระที่ไม่ใช่จุด กัน "..." ที่เป็นจุดไข่ปลาในนิยาย)
  return /^(#{1,6}\s|@|\(\(|>>|<<|!\s|\/\/\/|=\s|\$\w+\s|---+$|\||\.[^.\s])/.test(s)
      || /^\s*<!--/.test(s);
}

/**
 * ตัดบทพูดออกจากเนื้อไฟล์ฉากหนึ่งไฟล์
 *
 * @param {string} text เนื้อฉาก (body ของ .md — ไม่รวม frontmatter)
 * @param {object} [opts]
 * @param {string[]} [opts.names] ชื่อตัวละครที่รู้จัก (Wiki + ชื่อที่พิมพ์ในบท)
 * @param {boolean} [opts.script] ไฟล์นี้เป็นบทภาพยนตร์ (เปิดโหมดอ่านรหัส @)
 * @param {boolean} [opts.backTag] ยอมให้หาชื่อ "ด้านหลัง" เครื่องหมายปิดด้วย (ค่าเริ่มต้น: ใช่)
 * @param {boolean} [opts.guessTurns] เดาคนพูดจากการสลับกันพูดในบทสนทนา (ค่าเริ่มต้น: ใช่)
 * @returns {Array<{line:number, open:number, close:number, text:string, speaker:string,
 *                  where:string, source:string, closed:boolean, guessed:boolean,
 *                  pair:[string,string]}>}
 */
export function extractDialogue(text, opts = {}) {
  const rows = extractRaw(text, opts);
  return opts.guessTurns === false ? rows : guessTurns(rows);
}

/** ตัดบทพูดแบบตรงไปตรงมา (ยังไม่เดาการสลับกันพูด) */
export function extractRaw(text, opts = {}) {
  const names = Array.isArray(opts.names) ? opts.names : [];
  const script = opts.script !== false;          // อ่านรหัส @ เสมอ เว้นแต่สั่งปิด
  const backTag = opts.backTag !== false;
  const lines = String(text == null ? '' : text).split('\n');
  const out = [];
  let cur = '';                                   // ตัวละครของบทพูดในบทภาพยนตร์
  let afterChar = false;                          // บรรทัดก่อนหน้าเป็น @ตัวละคร หรือ ((วงเล็บ))

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    const trimmed = line.trim();

    if (script) {
      const tag = characterFromTag(line);
      if (tag) { cur = tag; afterChar = true; continue; }
      if (!trimmed) { cur = ''; afterChar = false; continue; }
      if (/^\(\(/.test(trimmed)) { continue; }    // วงเล็บบอกอารมณ์ — ยังอยู่ในบล็อกบทพูด
      if (isScriptCode(line)) { cur = ''; afterChar = false; continue; }
    } else if (!trimmed) { cur = ''; afterChar = false; continue; }

    const quotes = findQuotes(line);

    // บทพูดของบทภาพยนตร์: บรรทัดถัดจาก @ตัวละคร ที่ไม่มีเครื่องหมายคำพูดก็นับเป็นบทพูด
    if (script && afterChar && cur && !quotes.length) {
      out.push({ line: ln, open: 0, close: line.length, text: line,
                 speaker: cur, where: WHERE_TAG, source: SRC_SCRIPT,
                 closed: true, guessed: false, pair: ['', ''] });
      afterChar = false;
      continue;
    }

    for (const q of quotes) {
      let speaker = '', where = WHERE_NONE;
      if (script && cur) { speaker = cur; where = WHERE_TAG; }
      if (!speaker) {
        const front = nameNear(trimPrefix(line.slice(0, q.open)), names, 'end');
        if (front) { speaker = front; where = WHERE_FRONT; }
      }
      if (!speaker && backTag && q.closed) {
        const back = nameNear(line.slice(q.close + 1), names, 'start');
        if (back) { speaker = back; where = WHERE_BACK; }
      }
      out.push({ line: ln, open: q.open, close: q.close, text: q.text,
                 speaker, where, guessed: false,
                 source: script && cur ? SRC_SCRIPT : SRC_PROSE,
                 closed: q.closed, pair: q.pair });
    }
    if (quotes.length) afterChar = false;
  }
  return out;
}

/**
 * [alpha.80] เดาคนพูดของบทพูดที่ไม่มีชื่อทั้งสองฝั่ง จาก "การสลับกันพูด"
 *
 * ทำเฉพาะในนิยาย (บทภาพยนตร์รู้จากรหัส `@` อยู่แล้ว) และเฉพาะช่วงที่มั่นใจ:
 * ช่วงบทสนทนาที่มีคน **ระบุชื่อชัดเจน 2 คนพอดี** → บทพูดที่ไม่มีชื่อยกให้คนที่ไม่ใช่คนพูดก่อนหน้า
 *
 * ที่จงใจ **ไม่** ทำ: ช่วงที่มีคนพูด 3 คนขึ้นไป (สลับไม่เป็นแบบแผน) และช่วงที่รู้ชื่อแค่คนเดียว
 * (จะกลายเป็นยกทุกบรรทัดให้คนเดียวซึ่งผิดแน่ ๆ) — ปล่อยเป็น "ไม่ระบุ" ดีกว่าเดาผิด
 *
 * @param {Array} rows ผลจาก extractRaw (ต้องเรียงตามบรรทัด)
 * @returns {Array} แถวชุดใหม่ (ไม่แก้ของเดิม)
 */
export function guessTurns(rows) {
  const list = (rows || []).map((r) => ({ ...r }));
  // ตัดเป็นช่วงบทสนทนา: ห่างกันเกิน TURN_GAP บรรทัด = คนละวง
  let i = 0;
  while (i < list.length) {
    let j = i;
    while (j + 1 < list.length
           && (list[j + 1].line - list[j].line) <= TURN_GAP) j++;
    resolveRun(list.slice(i, j + 1));
    i = j + 1;
  }
  return list;
}

function resolveRun(run) {
  // เฉพาะนิยาย — บทภาพยนตร์มีรหัสบอกอยู่แล้ว ไม่ต้องเดา
  if (run.some((r) => r.source === SRC_SCRIPT)) return;
  const named = [...new Set(run.filter((r) => r.speaker).map((r) => r.speaker))];
  if (named.length !== 2) return;                 // เดาได้เฉพาะบทสนทนาสองคน
  let prev = '';
  for (const r of run) {
    if (r.speaker) { prev = r.speaker; continue; }
    if (!prev) continue;                          // ยังไม่มีใครพูดก่อนหน้า = เดาไม่ได้
    const other = named.find((n) => n !== prev);
    if (!other) continue;
    r.speaker = other;
    r.where = WHERE_TURN;
    r.guessed = true;
    prev = other;
  }
}

/** นับว่าเดาไปกี่แถว (โชว์บนแผงให้ผู้ใช้รู้ว่าอะไรแน่ อะไรเดา) */
export function guessedCount(rows) {
  return (rows || []).filter((r) => r && r.guessed).length;
}

/**
 * เขียนบทพูดที่แก้แล้วกลับลงเนื้อไฟล์
 *
 * **กติกาความปลอดภัย**: ตรวจก่อนว่าข้อความเดิมตรงกับที่หน้าจอถืออยู่จริง
 * ไม่ตรง = ไฟล์ถูกแก้จากที่อื่นแล้ว → คืน `null` (ห้ามเดา ห้ามเขียนทับ)
 *
 * @param {string} text เนื้อไฟล์เดิมทั้งก้อน
 * @param {object} row แถวจาก extractDialogue (ต้องมี line/open/close/text/source)
 * @param {string} next ข้อความใหม่ (ไม่รวมเครื่องหมายคำพูด)
 * @returns {string|null} เนื้อไฟล์ใหม่ · null = แก้ไม่ได้ (ไฟล์เปลี่ยนไปแล้ว)
 */
export function replaceDialogue(text, row, next) {
  if (!row || typeof row.line !== 'number') return null;
  const lines = String(text == null ? '' : text).split('\n');
  if (row.line < 0 || row.line >= lines.length) return null;
  const line = lines[row.line];
  const val = String(next == null ? '' : next).replace(/[\r\n]+/g, ' ');

  if (row.source === SRC_SCRIPT && (!row.pair || !row.pair[0])) {
    // บทพูดของบทภาพยนตร์ = ทั้งบรรทัด
    if (line !== row.text) return null;
    lines[row.line] = val;
    return lines.join('\n');
  }
  const [open, close] = row.pair || ['"', '"'];
  if (line[row.open] !== open) return null;
  const endIdx = row.closed ? row.close : line.length;
  const cur = line.slice(row.open + 1, endIdx);
  if (cur !== row.text) return null;
  lines[row.line] = line.slice(0, row.open + 1) + val
                  + (row.closed ? line.slice(row.close) : close);
  return lines.join('\n');
}

/**
 * กรองรายการบทพูด
 * @param {Array} rows แถวที่มีข้อมูลตำแหน่งครบ (section/chapter/scene/speaker/text)
 * @param {object} f {section, chapter, scene, speakers:Set|Array, q, source}
 */
export function filterDialogue(rows, f = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const sp = f.speakers instanceof Set ? f.speakers
           : (Array.isArray(f.speakers) && f.speakers.length ? new Set(f.speakers) : null);
  const q = String(f.q || '').trim().toLowerCase();
  return list.filter((r) => {
    if (f.section && r.section !== f.section) return false;
    if (f.chapter && r.chapterId !== f.chapter) return false;
    if (f.scene && r.sceneId !== f.scene) return false;
    if (f.source && r.source !== f.source) return false;
    if (sp && !sp.has(r.speaker || '')) return false;
    if (q) {
      const hay = ((r.text || '') + ' ' + (r.speaker || '') + ' ' + (r.sceneTitle || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * นับบทพูดต่อตัวละคร — เรียงจากมากไปน้อย · ไม่ระบุชื่อ ('') ไปท้ายสุดเสมอ
 * @returns {Array<{speaker:string, count:number, words:number}>}
 */
export function speakerStats(rows) {
  const m = new Map();
  for (const r of (rows || [])) {
    const k = r.speaker || '';
    const cur = m.get(k) || { speaker: k, count: 0, words: 0 };
    cur.count++;
    cur.words += countWords(r.text);
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => {
    if (!a.speaker !== !b.speaker) return a.speaker ? -1 : 1;
    return b.count - a.count || a.speaker.localeCompare(b.speaker, 'th');
  });
}

/** นับ "คำ" แบบหยาบ — ไทยนับตัวอักษร/3 · ภาษาอื่นนับช่องว่าง (พอสำหรับสถิติในแผง) */
export function countWords(s) {
  const t = String(s || '').trim();
  if (!t) return 0;
  const thai = (t.match(/[฀-๿]/g) || []).length;
  const other = t.replace(/[฀-๿]/g, ' ').trim();
  const otherWords = other ? other.split(/\s+/).filter(Boolean).length : 0;
  return Math.max(1, Math.round(thai / 3) + otherWords);
}

/**
 * จัดกลุ่มตามลำดับ เล่ม → บท → ฉาก (คงลำดับเดิมของรายการที่ส่งเข้ามา)
 * @returns {Array<{key:string, section:string, chapterId:string, sceneId:string,
 *                  sceneTitle:string, chapterTitle:string, rows:Array}>}
 */
export function groupByScene(rows) {
  const order = [];
  const map = new Map();
  for (const r of (rows || [])) {
    const key = [r.section || '', r.draft || '', r.chapterId || '', r.sceneId || '', r.path || ''].join('');
    let g = map.get(key);
    if (!g) {
      g = { key, section: r.section || '', draft: r.draft || '', chapterId: r.chapterId || '',
            chapterTitle: r.chapterTitle || '', sceneId: r.sceneId || '',
            sceneTitle: r.sceneTitle || '', path: r.path || '', rows: [] };
      map.set(key, g); order.push(g);
    }
    g.rows.push(r);
  }
  return order;
}

/** รายชื่อคนพูดทั้งหมดที่โผล่ในชุดนี้ (เรียงแบบเดียวกับ speakerStats) */
export function speakerList(rows) { return speakerStats(rows).map((s) => s.speaker); }

/** ข้อความย่อสำหรับแสดงในแถว (ยาวเกินตัด) */
export function preview(s, max = 120) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
