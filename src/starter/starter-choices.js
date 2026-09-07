// starter-choices.js — ทางเลือกที่ Game Master ยื่นให้ผู้เล่น (โมดูลบริสุทธิ์)
//
// ปัญหาจริงที่ไฟล์นี้แก้: **โมเดลไม่ทำตามฟอร์แมตเสมอ** บางรอบใส่บล็อกให้ครบ บางรอบพ่น
// เป็นรายการมีเลขเฉย ๆ บางรอบไม่ให้เลย · ถ้า parser เข้มไปหน่อยเดียว ผู้เล่นจะเจอ
// "ไม่มีปุ่มให้กด" สลับกับ "มีปุ่ม" แบบสุ่ม ซึ่งแย่กว่าไม่มีปุ่มเลย
//
// จึงอ่านแบบ **ไล่ชั้น** — เจอชั้นไหนก่อนใช้ชั้นนั้น และชั้นสุดท้ายคือ "ไม่มีทางเลือก"
// ซึ่งเป็นผลลัพธ์ที่ถูกต้อง ไม่ใช่ข้อผิดพลาด (ผู้เล่นยังพิมพ์เองได้เสมอตามสเปกข้อ 13)
//
//   ชั้น 1  บล็อกที่สั่งไว้      <<CHOICES>> … <<END>>
//   ชั้น 2  JSON array          ["…","…"]
//   ชั้น 3  รายการมีเลข/จุดนำ ท้ายข้อความ
//   ชั้น 4  ไม่มี → []
//
// ไม่แตะ DOM/fs/network → unit test ได้ตรง ๆ

import { t } from '../i18n.js';

/** เพดานจำนวนตัวเลือกที่แสดง — มากกว่านี้ผู้เล่นอ่านไม่ไหวและกินที่บนจอ */
export const MAX_CHOICES = 6;
/** ตัวเลือกที่ยาวกว่านี้ = โมเดลเขียนเป็นย่อหน้า ไม่ใช่ตัวเลือก */
export const MAX_CHOICE_LEN = 160;

// ป้ายบล็อก — **prompt กับ parser ต้องใช้ค่าเดียวกัน** จึงประกาศไว้ที่เดียวตรงนี้
export const OPEN_TAG = '<<CHOICES>>';
export const CLOSE_TAG = '<<END>>';

/** คำสั่งที่แปะท้าย system prompt ของ GM — starter-prompt.js เป็นคนเอาไปใช้ */
export function choiceInstruction() {
  return [
    t('ui.starter.choiceRuleHead'),
    OPEN_TAG,
    t('ui.starter.choiceRuleSample1'),
    t('ui.starter.choiceRuleSample2'),
    t('ui.starter.choiceRuleSample3'),
    CLOSE_TAG,
    t('ui.starter.choiceRuleTail'),
  ].join('\n');
}

// ───────────────────────── ตัวช่วย ─────────────────────────

/** ตัดหัวข้อลำดับ (1. / 1) / - / • / ๑.) ออกจากบรรทัด */
function stripBullet(line) {
  return String(line || '')
    .replace(/^\s*(?:[-*•–—]|\(?\d{1,2}[.)]|\(?[๐-๙]{1,2}[.)])\s*/u, '')
    .trim();
}

/** บรรทัดนี้หน้าตาเหมือนรายการทางเลือกไหม */
function looksLikeItem(line) {
  return /^\s*(?:[-*•–—]|\(?\d{1,2}[.)]|\(?[๐-๙]{1,2}[.)])\s+\S/u.test(String(line || ''));
}

/** ทำความสะอาด + ตัดซ้ำ + จำกัดจำนวน */
export function normalizeChoices(list) {
  const out = [];
  const seen = new Set();
  for (const raw of (list || [])) {
    let v = String(raw == null ? '' : raw).trim();
    v = v.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    if (!v || v.length > MAX_CHOICE_LEN) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= MAX_CHOICES) break;
  }
  return out;
}

// ───────────────────────── ชั้นที่ 1: บล็อกที่สั่งไว้ ─────────────────────────

function blockRange(text) {
  const s = String(text || '');
  const i = s.lastIndexOf(OPEN_TAG);
  if (i < 0) return null;
  const from = i + OPEN_TAG.length;
  const j = s.indexOf(CLOSE_TAG, from);
  // ไม่มีป้ายปิด = โมเดลถูกตัดกลางคัน — ยังอ่านส่วนที่ได้มาแล้วได้
  return { start: i, from, to: j < 0 ? s.length : j, end: j < 0 ? s.length : j + CLOSE_TAG.length };
}

function fromBlock(text) {
  const r = blockRange(text);
  if (!r) return null;
  const body = String(text).slice(r.from, r.to);
  const rows = body.split(/\r?\n/).map(stripBullet).filter(Boolean);
  const got = normalizeChoices(rows);
  return got.length ? got : null;
}

// ───────────────────────── ชั้นที่ 2: JSON array ─────────────────────────

function fromJson(text) {
  const s = String(text || '');
  // หา [...] ก้อนสุดท้ายที่พาร์สผ่านจริง (ไม่ใช้ regex ตะกละ — วงเล็บซ้อนพัง)
  for (let i = s.lastIndexOf('['); i >= 0; i = s.lastIndexOf('[', i - 1)) {
    const j = s.indexOf(']', i);
    if (j < 0) continue;
    try {
      const v = JSON.parse(s.slice(i, j + 1));
      if (Array.isArray(v) && v.length) {
        const got = normalizeChoices(v.map((x) => (typeof x === 'string' ? x
          : (x && (x.text || x.label || x.choice)) || '')));
        if (got.length >= 2) return got;
      }
    } catch { /* ก้อนนี้ไม่ใช่ JSON — ลองก้อนถัดไป */ }
  }
  return null;
}

// ───────────────────────── ชั้นที่ 3: รายการท้ายข้อความ ─────────────────────────

function fromTrailingList(text) {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];
  // ไล่จากท้ายขึ้นบน เก็บเฉพาะบล็อกรายการที่ติดกันก้อนสุดท้าย
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i];
    if (!ln.trim()) { if (items.length) break; continue; }
    if (looksLikeItem(ln)) { items.unshift(stripBullet(ln)); continue; }
    break;
  }
  const got = normalizeChoices(items);
  return got.length >= 2 ? got : null;      // รายการเดียว = ไม่ใช่ทางแยก
}

// ───────────────────────── ทางเข้าหลัก ─────────────────────────

/**
 * อ่านทางเลือกจากคำตอบของ GM
 * @param {string} text
 * @returns {string[]}  ว่าง = รอบนี้ไม่มีทางแยก (ปกติ ไม่ใช่ error)
 */
export function parseChoices(text) {
  return fromBlock(text) || fromJson(text) || fromTrailingList(text) || [];
}

/**
 * เนื้อเรื่องล้วน ๆ ที่เอาไปแสดง — ตัดบล็อกทางเลือกทิ้ง
 * (ตัดเฉพาะบล็อกที่มีป้ายกำกับ · ชั้น 2/3 เป็นการ "เดา" จึงไม่กล้าตัดเนื้อผู้ใช้ทิ้ง)
 */
export function stripChoices(text) {
  const r = blockRange(text);
  if (!r) return String(text || '').trim();
  const s = String(text);
  return (s.slice(0, r.start) + s.slice(r.end)).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * แปลงทางเลือกเป็น **มาร์กเกอร์ของระบบเรื่องแตกสาย** — `[ข้อความ]`
 * นี่คือสัญญาที่ทำให้ฉากที่แปลงจากแชทไหลเข้า branch-graph.js ได้ทันที
 * (ดู `scanChoiceMarkers` — วงเล็บเหลี่ยมที่ไม่ใช่รูปและไม่ใช่ลิงก์ = ทางแยก)
 *
 * วงเล็บเหลี่ยมในตัวข้อความจะทำให้ตัวสแกนอ่านผิด จึงถอดออกก่อน
 */
export function choiceMarker(choice) {
  const v = String(choice || '').replace(/[\[\]]/g, '').trim().slice(0, 80);
  return v ? '[' + v + ']' : '';
}

/**
 * แถวทางเลือกสำหรับเขียนลง `scenes.json`
 * ชื่อฟิลด์ต้องเป็น `nextSceneId` เป๊ะ ๆ ตามที่ `buildGraph` (branch-graph.js) อ่าน
 * ปล่อยว่างไว้ = "เส้นห้อย" ซึ่งผังแตกสายจะขึ้นเตือนให้ผู้ใช้ไปผูกปลายทางเอง
 */
export function choiceRows(list) {
  return normalizeChoices(list).map((text) => ({ text, nextSceneId: '' }));
}
