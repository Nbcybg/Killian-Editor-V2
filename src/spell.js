// ตรวจคำผิดแบบออฟไลน์ — ไทย (maximal matching) + อังกฤษ (wordlist + สัณฐานวิทยา)
// พอร์ตจาก Killian v1 (spell.py) — ไม่ใช้ไลบรารีภายนอก
// คลังคำโหลดจากไฟล์ภายนอก (renderer/assets/*.txt + Plugins/dictionaries/*.txt) ไม่ฝังใน bundle

const THAI_RE = /[\u0E00-\u0E7F]+/g;
const LATIN_RE = /[A-Za-z][A-Za-z'\u2019]*/g;
const THAI_FULL = /^[\u0E00-\u0E7F]+$/;
const MAX_TH_LEN = 24;   // ความยาวคำไทยยาวสุดที่ลองจับ (กันช้า)

// [alpha.92 ข้อ 2] ★ ช่วงความยาวที่ "คุ้มจะตรวจ"
//
// สั้นไม่เกิน 2 ตัว — พยางค์เดียว/ตัวย่อ/เสียงอุทาน ("งั้น" "ฮึ่ม" "ok" "ๆๆ") คลังคำไม่มีทางครบ
//                    ขีดแดงรัวไปทั้งหน้าโดยไม่ได้ช่วยอะไร
// ยาวเกิน 65 ตัว   — ไม่ใช่คำแล้ว (URL, รหัส, คีย์, ตัวอักษรรัวจากการกดค้าง) ผู้ใช้ตั้งใจให้เป็นแบบนั้น
//                    และเป็นเคสที่ DP ตัดคำเสียเวลามากที่สุดพอดี
//
// นับเป็น "ตัวที่ตาเห็น": สระบน/ล่างและวรรณยุกต์ไทยเป็น combining mark — "ที่" ยาว 3 หน่วยใน JS
// แต่คนเห็นตัวเดียว · ถ้านับดิบ ๆ เกณฑ์จะเพี้ยนเฉพาะภาษาไทย
const MIN_WORD = 3;      // ≤2 ตัว = ไม่ตรวจ ไม่ขีด
const MAX_WORD = 65;     // >65 ตัว = ไม่ตรวจ ไม่ขีด
// \u0E19\u0E31\u0E1A\u0E41\u0E1A\u0E1A\u0E27\u0E19\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 `replace(/\u2026/g,'')` \u2014 \u0E15\u0E31\u0E27\u0E2B\u0E25\u0E31\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E15\u0E23\u0E34\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E40\u0E23\u0E35\u0E22\u0E01
// \u0E41\u0E25\u0E30\u0E15\u0E31\u0E27\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E40\u0E23\u0E35\u0E22\u0E01\u0E17\u0E38\u0E01 "\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E44\u0E17\u0E22" \u0E43\u0E19\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 (\u0E2B\u0E25\u0E31\u0E01\u0E2B\u0E21\u0E37\u0E48\u0E19\u0E04\u0E23\u0E31\u0E49\u0E07\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E2A\u0E41\u0E01\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E23\u0E2D\u0E1A)
function visLen(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x0E31 || (c >= 0x0E34 && c <= 0x0E3A) || (c >= 0x0E47 && c <= 0x0E4E)) continue;
    n++;
  }
  return n;
}

// คลังคำหลัก (โหลดครั้งเดียว) + คำเสริม (personal/plugin — เปลี่ยนได้ระหว่างใช้งาน)
const base = { th: new Set(), en: new Set(), loaded: false };
let extraTh = new Set();
let extraEn = new Set();

// [alpha.87 ข้อ 5] ★ **คลังคำที่รวมแล้ว — คิดครั้งเดียว ไม่ใช่ทุกครั้งที่ตรวจ**
//
// ของเดิม `check()` เขียนว่า `extraTh.size ? new Set([...base.th, ...extraTh]) : base.th`
// = ทุกครั้งที่ตรวจข้อความหนึ่งก้อน จะ **สร้าง Set ใหม่จากพจนานุกรมทั้งเล่ม** (ไทย 61,000 คำ
// + อังกฤษ 20,000 คำ) · ผู้ใช้เพิ่มคำเข้าพจนานุกรมส่วนตัวแค่ **คำเดียว** ก็เข้าเงื่อนไขนี้ทันที
//
// วัดจริง (เอกสารบท 25 หน้า · 700 บล็อก):
//     ไม่มีคำเสริม    25ms/รอบ   (0.04ms ต่อบล็อก)
//     มีคำเสริม 1 คำ  3,433ms/รอบ (4.90ms ต่อบล็อก) = **ช้าลง 139 เท่า**
// โปรไฟล์ CPU ตอนกด Enter ค้าง: check() กิน 64.6% ของเวลาทั้งหมด + GC อีก 32.2%
// (ขยะจากการสร้าง Set ทิ้ง ๆ) รวม **96.8%** → เมนเธรดค้าง 5.2 วินาทีต่อการกดหนึ่งครั้ง
// ตัวจัดหน้าไม่ได้ช้าเลย มันแค่ไม่เคยได้คิว
//
// รวมล่วงหน้าแล้วเก็บไว้ · เปลี่ยนเฉพาะตอนคลังคำเปลี่ยนจริง (loadBase/setExtra)
let mergedTh = null, mergedEn = null;

// [alpha.92 ข้อ 1] แคชผลตรวจต่อ "ข้อความหนึ่งบล็อก"
// ตัวแก้ไขสแกนเฉพาะช่วงที่แตะ = อย่างน้อย 2 บล็อกที่ประกบตำแหน่ง → บล็อกที่ไม่ได้แก้เลย
// ถูกตรวจซ้ำทุกครั้งที่พิมพ์ · ล้างทิ้งเมื่อคลังคำเปลี่ยนเท่านั้น (ผลจึงไม่มีทางค้างเก่า)
const CACHE_MAX = 2000;        // เอกสารบทหนึ่งราว 700 บล็อก — ต้องใส่ได้ทั้งเล่มไม่ให้ไล่ทิ้งวน
const CACHE_TEXT_MAX = 8000;   // ยาวกว่านี้ไม่แคช (กันกินหน่วยความจำเปล่า ๆ)
const cache = new Map();

// [alpha.124 ข้อ 30] "ข้ามคำนี้ครั้งนี้" — คำที่ไม่อยากให้ขีดแดงในรอบการทำงานนี้
// ต่างจาก "เพิ่มลงพจนานุกรม" ตรงที่ **ไม่เขียนลงไฟล์**: ชื่อเฉพาะที่โผล่ครั้งเดียวในฉากนี้
// ไม่ควรไปอยู่ในคลังคำถาวรของโปรเจกต์ แต่ก็ไม่ควรมีเส้นแดงกวนสายตาระหว่างเขียน
const ignored = new Set();
export function ignoreOnce(word) {
  const w = String(word || '').trim();
  if (!w) return false;
  ignored.add(w);
  ignored.add(w.toLowerCase());
  invalidateMerged();
  return true;
}
/** ล้างรายการที่ข้ามไว้ (เทส/เปลี่ยนโปรเจกต์) */
export function clearIgnored() { const n = ignored.size; ignored.clear(); invalidateMerged(); return n; }
/** จำนวนคำที่ข้ามอยู่ตอนนี้ — ให้เทสยืนยันได้ */
export function ignoredSize() { return ignored.size; }

function invalidateMerged() { mergedTh = null; mergedEn = null; cache.clear(); }
function knownTh() {
  if (!mergedTh) mergedTh = (extraTh.size || ignored.size)
    ? new Set([...base.th, ...extraTh, ...ignored]) : base.th;
  return mergedTh;
}
function knownEn() {
  if (!mergedEn) mergedEn = (extraEn.size || ignored.size)
    ? new Set([...base.en, ...extraEn, ...[...ignored].map((w) => w.toLowerCase())]) : base.en;
  return mergedEn;
}

// ป้อนคลังคำหลักจากข้อความไฟล์ dict (เรียกครั้งเดียวตอนเริ่ม)
export function loadBase(thText, enText) {
  base.th = new Set(); base.en = new Set();
  for (const w of (thText || '').split('\n')) {
    const s = w.trim();
    if (s && !s.startsWith('#')) base.th.add(s);
  }
  for (const w of (enText || '').split('\n')) {
    const s = w.trim().toLowerCase();
    if (s) base.en.add(s);
  }
  base.loaded = true;
  invalidateMerged();
}

export function ready() { return base.loaded && (base.th.size > 0 || base.en.size > 0); }

// ป้อนคำเสริม (จาก personal dictionary.json + Plugins/dictionaries/*.txt)
export function setExtra(words) {
  extraTh = new Set(); extraEn = new Set();
  for (const w of words || []) {
    const s = String(w).trim();
    if (!s) continue;
    if (THAI_FULL.test(s)) extraTh.add(s);
    extraEn.add(s.toLowerCase());
  }
  invalidateMerged();
}

// ---- ตัดคำไทยแบบ DP (maximal matching) หา 'ช่วงที่ตัดไม่ลงเลย' ----
function reachForward(run, known) {
  const n = run.length;
  const ok = new Array(n + 1).fill(false); ok[0] = true;
  let far = 0;
  for (let i = 1; i <= n; i++) {
    // [alpha.92 ข้อ 2] ★ ออกทันทีเมื่อ "ตัดต่อไม่ได้อีกแล้วแน่นอน"
    // ok[i] จะจริงได้ก็ต่อเมื่อมี ok[i-L] จริงสักตัว (L ≤ MAX_TH_LEN) — แต่จุดที่จริงและไกลสุด
    // คือ far · พอ i - far > MAX_TH_LEN ทุกตัวในหน้าต่างนั้นเป็นเท็จหมด และจะเท็จตลอดไป
    // เคสจริง: กดแป้นค้าง/แปะรหัส/URL — เดิมไล่จนจบ 900 ตัว × 24 = สองหมื่นครั้งเพื่อผลที่รู้อยู่แล้ว
    if (i - far > MAX_TH_LEN) break;
    for (let L = 1; L <= Math.min(MAX_TH_LEN, i); L++) {
      if (ok[i - L] && known.has(run.slice(i - L, i))) { ok[i] = true; break; }
    }
    if (ok[i]) far = i;
  }
  return { full: ok[n], far };
}
function reachBackward(run, known) {
  const n = run.length;
  const ok = new Array(n + 1).fill(false); ok[n] = true;
  let near = n;
  for (let i = n - 1; i >= 0; i--) {
    if (near - i > MAX_TH_LEN) break;               // เหตุผลเดียวกับ reachForward (กลับทาง)
    for (let L = 1; L <= Math.min(MAX_TH_LEN, n - i); L++) {
      if (ok[i + L] && known.has(run.slice(i, i + L))) { ok[i] = true; break; }
    }
    if (ok[i]) near = i;
  }
  return near;
}
function badThaiSpans(run, known) {
  const { full, far } = reachForward(run, known);
  if (full) return [];
  const near = reachBackward(run, known);
  let a = Math.min(far, near), b = Math.max(far, near);
  if (b <= a) { a = 0; b = run.length; }
  return [[a, b]];
}

// ---- ตรวจข้อความ → [{start, end, word}] (offset ในสตริง) ----
// ผลที่คืนออกไปเป็นของ "อ่านอย่างเดียว" (ถูกแคชไว้ใช้ซ้ำ) — ผู้เรียกห้ามแก้ค่าในนั้น
export function check(text) {
  if (!text || !base.loaded) return [];
  const cached = cache.get(text);
  if (cached) return cached;
  const thKnown = knownTh();
  const enKnown = knownEn();
  const out = [];
  let m;
  THAI_RE.lastIndex = 0;
  while ((m = THAI_RE.exec(text))) {
    const run = m[0];
    // [alpha.92 ข้อ 2] ทั้งช่วงยังสั้นกว่าเกณฑ์ = ข้ามไปเลย ไม่ต้องเสียเวลาตัดคำ
    if (visLen(run) < MIN_WORD || thKnown.has(run)) continue;
    for (const [a, b] of badThaiSpans(run, thKnown)) {
      const word = run.slice(a, b);
      const n = visLen(word);
      if (n < MIN_WORD || n > MAX_WORD) continue;
      out.push({ start: m.index + a, end: m.index + b, word });
    }
  }
  LATIN_RE.lastIndex = 0;
  while ((m = LATIN_RE.exec(text))) {
    const w = m[0];
    if (w.length < MIN_WORD || w.length > MAX_WORD) continue;   // [alpha.92 ข้อ 2]
    const lw = w.toLowerCase().replace(/^['\u2019]+|['\u2019]+$/g, '');
    if (enKnown.has(lw)) continue;
    // สัณฐานวิทยาแบบเบา ๆ: พหูพจน์/กริยา
    if (lw.endsWith('s') && enKnown.has(lw.slice(0, -1))) continue;
    if (lw.endsWith('es') && enKnown.has(lw.slice(0, -2))) continue;
    if (lw.endsWith('ed') && (enKnown.has(lw.slice(0, -2)) || enKnown.has(lw.slice(0, -1)))) continue;
    if (lw.endsWith('ing') && (enKnown.has(lw.slice(0, -3)) || enKnown.has(lw.slice(0, -3) + 'e'))) continue;
    out.push({ start: m.index, end: m.index + w.length, word: w });
  }
  if (text.length <= CACHE_TEXT_MAX) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);   // ทิ้งตัวเก่าสุดก่อน
    cache.set(text, out);
  }
  return out;
}

// จำนวนรายการในแคช — ให้เทสยืนยันว่าแคชทำงานจริงและไม่โตเกินเพดาน
export function cacheSize() { return cache.size; }

// ═══════════ [alpha.124 ข้อ 30] ★ คำแนะนำการแก้คำผิด ═══════════
//
// เดิมคลิกขวาคำที่ขีดแดงได้รายการเดียว: "เพิ่มลงพจนานุกรม" — ซึ่งเป็นทางเดียวที่ **ไม่แก้คำให้เลย**
// (ตัวแก้ไขทุกตัวให้คำที่น่าจะถูกมาเลือกก่อน แล้ว "เพิ่มลงพจนานุกรม" ค่อยอยู่ท้ายสุด)
//
// วิธี: สร้าง "คำที่ห่างกัน 1 การแก้" (ลบ/สลับ/แทน/แทรก) แล้วเช็คว่าอยู่ในคลังคำไหม
// — **ไม่ไล่สแกนคลังทั้งกอง** ซึ่งอาจมีหลายหมื่นคำและช้าเกินจะทำตอนคลิกขวา
// จำนวนครั้งที่เช็ค ≈ ความยาวคำ × ขนาดตัวอักษร × 4 (หลักพันครั้ง = ต่ำกว่ามิลลิวินาที)

const TH_ALPHA = 'กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮะัาำิีึืุูเแโใไ็่้๊๋์ํฯๆ';
const EN_ALPHA = 'abcdefghijklmnopqrstuvwxyz';

/** คำที่ห่างจาก `w` หนึ่งการแก้ (เซตอาจใหญ่ แต่สร้างเร็วและถูกกรองด้วยคลังคำทันที) */
function edits1(w, alpha) {
  const out = new Set();
  for (let i = 0; i < w.length; i++) {
    out.add(w.slice(0, i) + w.slice(i + 1));                                  // ลบ
    if (i + 1 < w.length) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));   // สลับที่
    for (const c of alpha) {
      out.add(w.slice(0, i) + c + w.slice(i + 1));                            // แทนที่
      out.add(w.slice(0, i) + c + w.slice(i));                                // แทรก
    }
  }
  for (const c of alpha) out.add(w + c);                                      // แทรกท้าย
  out.delete(w);
  return out;
}

/**
 * คำที่น่าจะถูก สำหรับคำที่ขีดแดงอยู่
 * @param {string} word คำที่สะกดผิด
 * @param {number} max จำนวนสูงสุดที่คืน
 * @returns {string[]} เรียงจาก "ใกล้เคียงที่สุด" (ยาวใกล้กันและขึ้นต้นเหมือนกันมาก่อน)
 */
export function suggest(word, max = 6) {
  const w = String(word || '').trim();
  if (!w || !base.loaded || w.length > 24) return [];
  const thai = THAI_FULL.test(w);
  const known = thai ? knownTh() : knownEn();
  const target = thai ? w : w.toLowerCase();
  const hits = [];
  for (const cand of edits1(target, thai ? TH_ALPHA : EN_ALPHA)) {
    if (cand.length < 2 || !known.has(cand)) continue;
    // คะแนนต่ำ = ดีกว่า: ต่างความยาวน้อย + ตัวอักษรแรกตรงกัน
    hits.push([Math.abs(cand.length - target.length) + (cand[0] === target[0] ? 0 : 2), cand]);
    if (hits.length > 400) break;                    // กันคำสั้นมากที่ match เยอะผิดปกติ
  }
  hits.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  const out = [];
  for (const [, cand] of hits) {
    // คำอังกฤษ: คืนโดยรักษารูปตัวพิมพ์ใหญ่ตัวแรกของคำเดิมไว้ (Bangkok → Bangkok ไม่ใช่ bangkok)
    const shown = (!thai && /^[A-Z]/.test(w)) ? cand[0].toUpperCase() + cand.slice(1) : cand;
    if (!out.includes(shown)) out.push(shown);
    if (out.length >= max) break;
  }
  return out;
}
