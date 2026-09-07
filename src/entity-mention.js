// entity-mention.js — โค้ดสั้นอ้างถึงตัวละคร `{{ชื่อ}}` (โมดูลบริสุทธิ์ · เทสแยก)
//
// ผู้ใช้ (alpha.123): *"ต้องแบบนี้ {{character}} หมายถึง ใครก็ได้ใน pool ·
//                      {{ชื่อ}} คือเจาะจงเลย · {{user}} หมายถึงผู้ใช้ ในกรณีที่ผู้ใช้ควบคุมตัวละคร"*
//
// ═══ ทำไมเป็น `{{…}}` ไม่ใช่ `[…]` ═══
// `[…]` **ถูกใช้ไปแล้ว** โดย `shortcode.js` (49 โค้ด: `[title]` `[wordcount]` …) ซึ่งจับโทเคน
// ด้วย `/\[([A-Za-z][A-Za-z0-9_-]*)…\]/` — ชื่ออังกฤษอย่าง `[Kai]` จึงชนกันตรง ๆ
// และ `[]` ที่คนเขียนพิมพ์ในเนื้อเรื่องก็จะกลายเป็นระเบิดเวลา
// `{{…}}` ไม่ชนกับทั้งสองอย่าง → ข้อความเดียวกันใช้ได้ทั้งสองระบบพร้อมกัน
//
// ═══ สามชนิดของโทเคน ═══
//   `{{ชื่อ}}` หรือ `{{โค้ดสั้น}}` → ตัวละครตัวนั้นเจาะจง
//   `{{character}}`               → ใครก็ได้ใน pool (คลายเป็นรายชื่อทั้งวงให้โมเดลเลือกเอง)
//   `{{user}}`                    → ผู้เล่น (ตัวที่ผู้เล่นสวมบทอยู่ในตอนนั้น)
// สองคำหลังเป็น **คำสงวน** — ชนะเสมอแม้มีตัวละครชื่อเดียวกัน (UI เตือนตอนตั้งโค้ดสั้นชนคำสงวน)
//
// ═══ กติกาที่ห้ามพัง ═══
//   1. **เก็บลงไฟล์เป็นโค้ดสั้นเสมอ** ไม่ใช่ชื่อจริง — เปลี่ยนชื่อตัวละครแล้วทุกที่ตามไปเอง
//   2. คลายค่าตอนส่งเข้าโมเดลเท่านั้น (`expandMentions`) — โมเดลไม่ควรเห็นวงเล็บปีกกา
//   3. หาไม่เจอ = **คงข้อความเดิมไว้** ห้ามกลืนหาย ผู้ใช้ต้องเห็นว่าตัวเองพิมพ์ผิด
//
// ⚠ **ห้ามเขียน `{{…}}` ตรง ๆ ลงไฟล์ภาษา** — `t()` คลาย `{{`→`{` (ดู `formatMsg` ใน i18n.js)
//   ต้องใช้ `tf(key, mentionToken('…'))` กับ `{0}` ในไฟล์ CSV เสมอ
//
// ไม่แตะ DOM/fs/i18n → unit test ได้ตรง ๆ (test/entity-mention.test.cjs)

/** รูปแบบโค้ดสั้น — `{{ชื่อ}}` · ห้ามมีปีกกาซ้อนข้างใน กันจับคร่อมกันเอง */
export const MENTION_RE = /\{\{([^{}]{1,60})\}\}/g;

/** รูปแบบเดิมของ alpha.122 (`{[ชื่อ]}`) — เก็บไว้แปลงไฟล์เก่าเท่านั้น */
export const MENTION_RE_V1 = /\{\[([^[\]{}]{1,60})\]\}/g;

/** คำสงวน — ไม่ใช่ชื่อตัวละคร แต่เป็นตัวแทนที่ระบบเติมให้ตอนคลายค่า */
export const MENTION_ANY = 'character';   // ใครก็ได้ใน pool
export const MENTION_USER = 'user';       // ผู้เล่น
export const RESERVED_MENTIONS = [MENTION_ANY, MENTION_USER];

/**
 * คีย์สำหรับเทียบชื่อ — ไทยไม่มีช่องว่างระหว่างคำ จึงตัดช่องว่างทิ้งทั้งหมด ไม่ใช่แค่ trim
 * (กติกาเดียวกับ `normName` ใน starter-wiki-merge.js — จงใจไม่ import ข้ามกัน
 *  เพราะไฟล์นั้นดึง i18n มาด้วย ส่วนไฟล์นี้ต้องบริสุทธิ์ 100%)
 */
export function normKey(s) {
  return String(s || '')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** ชื่อ → โค้ดสั้นที่พิมพ์ลงข้อความได้ */
export function mentionToken(name) { return '{{' + String(name || '').trim() + '}}'; }

/** เป็นคำสงวนไหม (`character` / `user`) */
export function isReserved(raw) { return RESERVED_MENTIONS.includes(normKey(raw)); }

/**
 * แปลงข้อความจากรูปแบบ alpha.122 (`{[x]}`) มาเป็น `{{x}}`
 * เรียกตอนอ่านไฟล์เก่า — ไฟล์ที่ไม่มีของเก่าเลยผ่านไปเฉย ๆ ไม่เสียอะไร
 */
export function migrateMentions(text) {
  const s = String(text == null ? '' : text);
  if (!s.includes('{[')) return s;
  return s.replace(new RegExp(MENTION_RE_V1.source, 'g'), (all, raw) => mentionToken(raw.trim()));
}

/**
 * โค้ดสั้นประจำตัวของตัวละคร/entity
 * ไม่ได้ตั้งเอง = ใช้ชื่อจริง — ผู้ใช้จึงพิมพ์ `{{ชื่อ}}` ได้เลยโดยไม่ต้องไปตั้งอะไรก่อน
 */
export function shortcodeOf(x) {
  const own = String((x && x.shortcode) || '').trim();
  return own || String((x && x.name) || '').trim();
}

/** ชื่อทั้งหมดที่ตัวละครหนึ่งตัว "ตอบสนอง" — โค้ดสั้น · ชื่อจริง · ชื่อรอง */
export function keysOf(x) {
  const out = [shortcodeOf(x), (x && x.name) || '', ...(((x && x.aliases) || []))];
  return [...new Set(out.map(normKey).filter(Boolean))];
}

/** ตาราง คีย์ → ตัวละคร (ตัวแรกที่เจอชนะ — กันชื่อรองไปทับชื่อจริงของอีกคน) */
export function mentionIndex(cast = []) {
  const map = new Map();
  for (const c of cast || []) {
    if (!c) continue;
    for (const k of keysOf(c)) if (!map.has(k)) map.set(k, c);
  }
  return map;
}

/** โค้ดสั้นทุกตัวที่ปรากฏในข้อความ (ตามลำดับที่เจอ ไม่ซ้ำ) */
export function parseMentions(text) {
  const out = [];
  const seen = new Set();
  const re = new RegExp(MENTION_RE.source, 'g');
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    const k = normKey(raw);
    if (seen.has(k)) continue;
    seen.add(k); out.push(raw);
  }
  return out;
}

/** รายชื่อทั้งวงที่มีชื่อจริง (ตัวแทนของ `{{character}}`) */
export function castNames(cast = []) {
  return (cast || []).map((c) => String((c && c.name) || '').trim()).filter(Boolean);
}

/**
 * คลายโค้ดสั้นเป็นชื่อจริง — ใช้ตอนส่งเข้าโมเดลเท่านั้น
 *
 * @param {string} text
 * @param {Array} cast
 * @param {object} opts
 *   - user     ชื่อที่ `{{user}}` หมายถึง (ตัวที่ผู้เล่นสวมบทอยู่) · ไม่ส่ง = คำสำรอง
 *   - userLabel / anyLabel  คำสำรองเมื่อไม่มีข้อมูลจริง (คนเรียกส่งคำแปลเข้ามา)
 *
 * หาไม่เจอ → คืนข้อความในวงเล็บแบบดิบ (ไม่ทิ้ง ไม่ปล่อยวงเล็บปีกกาให้โมเดลเห็น)
 */
export function expandMentions(text, cast = [], opts = {}) {
  const idx = mentionIndex(cast);
  const names = castNames(cast);
  const userName = String(opts.user || '').trim();
  const userLabel = String(opts.userLabel || '').trim();
  const anyLabel = String(opts.anyLabel || '').trim();
  return String(text || '').replace(new RegExp(MENTION_RE.source, 'g'), (all, raw) => {
    const k = normKey(raw);
    // คำสงวนชนะเสมอ — ผู้ใช้ตั้งชื่อตัวละครว่า user/character ได้ แต่โทเคนสองตัวนี้จองไว้แล้ว
    if (k === MENTION_USER) return userName || userLabel || raw.trim();
    if (k === MENTION_ANY) {
      // ให้โมเดลเห็น **ทั้ง pool** จะได้เลือกเองอย่างมีข้อมูล ไม่ใช่เดาว่าใครบ้าง
      if (names.length) return (anyLabel ? anyLabel + ' (' + names.join(' / ') + ')' : names.join(' / '));
      return anyLabel || raw.trim();
    }
    const hit = idx.get(k);
    return hit ? (hit.name || raw.trim()) : raw.trim();
  });
}

/** โค้ดสั้นที่ชี้ไปหาตัวละครที่ไม่มีอยู่จริง — UI เตือนเป็นสีส้มจากค่านี้ (คำสงวนไม่นับ) */
export function unknownMentions(text, cast = []) {
  const idx = mentionIndex(cast);
  return parseMentions(text).filter((raw) => !isReserved(raw) && !idx.get(normKey(raw)));
}

/** ตัวละครที่ถูกอ้างถึงในข้อความ (ไว้บอกว่าช่องนี้พูดถึงใครบ้าง · คำสงวนไม่นับ) */
export function mentionedChars(text, cast = []) {
  const idx = mentionIndex(cast);
  const out = [];
  const seen = new Set();
  for (const raw of parseMentions(text)) {
    if (isReserved(raw)) continue;
    const hit = idx.get(normKey(raw));
    if (hit && !seen.has(hit.id || hit.name)) { seen.add(hit.id || hit.name); out.push(hit); }
  }
  return out;
}

/**
 * รายชื่อโค้ดสั้นให้ UI วาดเป็นชิปกดแทรก — [{id,name,token,kind}]
 * `kind` = 'any' | 'user' | 'char' · สองชิปแรกคือคำสงวน ให้มาก่อนเสมอ
 * @param {object} labels  คำอธิบายของคำสงวน (คนเรียกส่งคำแปลเข้ามา — ไฟล์นี้ไม่รู้จัก i18n)
 */
export function mentionChips(cast = [], labels = {}) {
  const rows = [
    { id: '', kind: 'any', name: String(labels.any || MENTION_ANY), token: mentionToken(MENTION_ANY) },
    { id: '', kind: 'user', name: String(labels.user || MENTION_USER), token: mentionToken(MENTION_USER) },
  ];
  for (const c of cast || []) {
    if (!c || !String(c.name || '').trim()) continue;
    rows.push({ id: c.id || '', kind: 'char', name: c.name, token: mentionToken(shortcodeOf(c)) });
  }
  return rows;
}

/**
 * แทรกโค้ดสั้นลงข้อความที่ตำแหน่งเคอร์เซอร์
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพื่อให้เทสได้โดยไม่ต้องมี textarea จริง
 * @returns {{text:string, caret:number}}
 */
export function insertAt(text, start, end, token) {
  const s = String(text || '');
  const a = Math.max(0, Math.min(s.length, Number(start) || 0));
  const b = Math.max(a, Math.min(s.length, Number(end) === 0 ? 0 : (Number(end) || a)));
  // เว้นวรรคให้เองเมื่อจำเป็น — ไม่งั้นได้ `เขาพูดว่า{{A}}ตอบ` ที่อ่านไม่ออก
  const before = s.slice(0, a);
  const after = s.slice(b);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const tail = after && !/^\s/.test(after) ? ' ' : '';
  const ins = lead + token + tail;
  return { text: before + ins + after, caret: (before + lead + token).length };
}

// ───────────────────────── ช่อง Prompt แบบเพิ่มเองได้ ─────────────────────────
//
// ผู้ใช้: *"เพิ่ม field ใน entities ทั้งหมด คือ Prompt เพื่อให้ ai เข้าใจลักษณะ
//          ตัวละคร entities เมือง ได้ สามารถเพิ่ม field prompt ได้นะ เช่น prompt A prompt B"*
//
// เก็บเป็น **อาร์เรย์ของคู่** ไม่ใช่ object เพราะลำดับมีความหมาย (Prompt A มาก่อน Prompt B เสมอ)
// และผู้ใช้ตั้งชื่อหัวข้อซ้ำกันได้โดยไม่ทำให้ของหาย

/** ทำให้เป็นรูปแบบมาตรฐาน — รับทั้งอาร์เรย์คู่ และ object แบบเก่า */
export function normalizePrompts(list) {
  const rows = Array.isArray(list)
    ? list
    : Object.entries((list && typeof list === 'object') ? list : {}).map(([k, v]) => ({ k, v }));
  const out = [];
  for (const r of rows) {
    if (!r) continue;
    const k = String(r.k != null ? r.k : (r.key != null ? r.key : r.label || '')).trim();
    const v = String(r.v != null ? r.v : (r.value != null ? r.value : r.text || ''));
    if (!k && !v.trim()) continue;
    out.push({ k, v });
  }
  return out;
}

/**
 * ค่าที่เก็บอยู่ยัง **ไม่ใช่** รูปแบบมาตรฐานไหม (object แบบเก่า / ของพัง / ไม่มีเลย)
 * ตัววาดใช้ตัดสินว่าต้องเขียนรูปแบบใหม่กลับลง entity ไหม — เลียนแบบ `needsImageMigration`
 */
export function needsPromptMigration(list) {
  if (list == null) return false;                 // ไม่มีเลย = ไม่ต้องแปลง (อย่าไปสร้าง field เปล่า)
  if (!Array.isArray(list)) return true;
  return list.some((r) => !r || typeof r !== 'object'
    || typeof r.k !== 'string' || typeof r.v !== 'string');
}

/** ชื่อหัวข้อถัดไปแบบไม่ต้องคิดเอง — Prompt A · Prompt B · … · Prompt Z · Prompt 27 */
export function nextPromptKey(list) {
  const n = normalizePrompts(list).length;
  return 'Prompt ' + (n < 26 ? String.fromCharCode(65 + n) : String(n + 1));
}

/** ช่อง prompt ที่มีเนื้อจริง → ข้อความก้อนเดียวสำหรับยัดเข้า context ของโมเดล */
export function promptsText(list, cast = [], opts = {}) {
  return normalizePrompts(list)
    .filter((r) => r.v.trim())
    .map((r) => (r.k ? r.k + ': ' : '') + expandMentions(r.v.trim(), cast, opts))
    .join('\n');
}
