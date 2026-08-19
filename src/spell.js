// ตรวจคำผิดแบบออฟไลน์ — ไทย (maximal matching) + อังกฤษ (wordlist + สัณฐานวิทยา)
// พอร์ตจาก Killian v1 (spell.py) — ไม่ใช้ไลบรารีภายนอก
// คลังคำโหลดจากไฟล์ภายนอก (renderer/assets/*.txt + Plugins/dictionaries/*.txt) ไม่ฝังใน bundle

const THAI_RE = /[\u0E00-\u0E7F]+/g;
const LATIN_RE = /[A-Za-z][A-Za-z'\u2019]*/g;
const THAI_FULL = /^[\u0E00-\u0E7F]+$/;
const MAX_TH_LEN = 24;   // ความยาวคำไทยยาวสุดที่ลองจับ (กันช้า)

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
function invalidateMerged() { mergedTh = null; mergedEn = null; }
function knownTh() {
  if (!mergedTh) mergedTh = extraTh.size ? new Set([...base.th, ...extraTh]) : base.th;
  return mergedTh;
}
function knownEn() {
  if (!mergedEn) mergedEn = extraEn.size ? new Set([...base.en, ...extraEn]) : base.en;
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
export function check(text) {
  if (!text || !base.loaded) return [];
  const thKnown = knownTh();
  const enKnown = knownEn();
  const out = [];
  let m;
  THAI_RE.lastIndex = 0;
  while ((m = THAI_RE.exec(text))) {
    const run = m[0];
    if (run.length < 2 || thKnown.has(run)) continue;
    for (const [a, b] of badThaiSpans(run, thKnown)) {
      if (b - a >= 2) out.push({ start: m.index + a, end: m.index + b, word: run.slice(a, b) });
    }
  }
  LATIN_RE.lastIndex = 0;
  while ((m = LATIN_RE.exec(text))) {
    const w = m[0];
    if (w.length < 3) continue;
    const lw = w.toLowerCase().replace(/^['\u2019]+|['\u2019]+$/g, '');
    if (enKnown.has(lw)) continue;
    // สัณฐานวิทยาแบบเบา ๆ: พหูพจน์/กริยา
    if (lw.endsWith('s') && enKnown.has(lw.slice(0, -1))) continue;
    if (lw.endsWith('es') && enKnown.has(lw.slice(0, -2))) continue;
    if (lw.endsWith('ed') && (enKnown.has(lw.slice(0, -2)) || enKnown.has(lw.slice(0, -1)))) continue;
    if (lw.endsWith('ing') && (enKnown.has(lw.slice(0, -3)) || enKnown.has(lw.slice(0, -3) + 'e'))) continue;
    out.push({ start: m.index, end: m.index + w.length, word: w });
  }
  return out;
}
