// src/sceneFilter.js — ตัวกรอง Explorer: ค้นทุกฟิลด์ properties ของฉาก
// รองรับทั้งค้นอิสระ (ชื่อ/แท็ก/เรื่องย่อ/โน้ต ฯลฯ) และค้นเจาะจงฟิลด์ เช่น
//   status:กำลังเขียน   tag:บู๊   pov:ท็อป   flag:1   สี:เขียว   file:scene-01
//
// [alpha.120 ข้อ 4] เพิ่ม **OR** และ **ไม่เอา (-)** — ไม่ใช่ของแถม แต่เป็นบั๊กที่มีมานาน:
// ชิปตัวกรองสถานะ/แท็กสร้างคิวรีเป็น `status:ก OR status:ข` อยู่แล้ว แต่ตัวจับคู่ใช้ `every()`
// ล้วน ๆ → ติ๊กสองสถานะเมื่อไหร่ผลลัพธ์ว่างเปล่าทุกครั้ง (คำว่า `OR` ยังถูกนับเป็นคำค้นอีกต่างหาก)
// ไวยากรณ์ตอนนี้:  กลุ่ม = คำที่ต้องเจอทั้งหมด (AND) · `OR` คั่นกลุ่ม · `-คำ` = ต้องไม่เจอ

import { t as tt, t } from './i18n.js';
const FIELD = {
  'สถานะ': 'status', 'status': 'status',
  'แท็ก': 'tags', 'tag': 'tags', 'tags': 'tags', '#': 'tags',
  'มุมมอง': 'pov', 'pov': 'pov',
  'อารมณ์': 'emotion', 'emotion': 'emotion',
  'ขัดแย้ง': 'conflict', 'ความขัดแย้ง': 'conflict', 'conflict': 'conflict',
  'สี': 'color', 'color': 'color',
  'เรื่องย่อ': 'synopsis', 'synopsis': 'synopsis',
  'โน้ต': 'note', 'note': 'note',
  'ปักหมุด': 'flag', 'flag': 'flag', 'fav': 'flag',
  /* i18n-skip: คีย์ตารางนี้คือคำสั่งค้นหาที่ผู้ใช้พิมพ์ เช่น ไฟล์:scene-01 ไม่ใช่ป้ายบนหน้าจอ
     แปลตามภาษา UI เมื่อไหร่ คิวรีที่ผู้ใช้จำไว้ก็ใช้ไม่ได้ทันที (เหตุผลเดียวกับคีย์ไทยด้านบน) */
  'ไฟล์': 'fileName', 'file': 'fileName', 'filename': 'fileName',
  'ชื่อ': 'title', 'title': 'title',
  /* /i18n-skip */
};

/** โทเคนเดียว → { field, value, neg } */
function term(tok) {
  let neg = false;
  if (tok.startsWith('-') && tok.length > 1) { neg = true; tok = tok.slice(1); }
  const m = /^([^:]+):(.*)$/.exec(tok);
  if (m && FIELD[m[1].toLowerCase()]) return { field: FIELD[m[1].toLowerCase()], value: (m[2] || '').toLowerCase(), neg };
  return { field: '*', value: tok.toLowerCase(), neg };
}

/**
 * แยกคิวรีเป็น "กลุ่มที่ต่อกันด้วย OR" — แต่ละกลุ่มคือชุดเงื่อนไขที่ต้องเป็นจริงพร้อมกัน
 * @returns {Array<Array<{field:string,value:string,neg:boolean}>>}
 */
export function parseGroups(q) {
  const toks = (q || '').trim().split(/\s+/).filter(Boolean);
  const groups = [[]];
  for (const tok of toks) {
    const up = tok.toUpperCase();
    if (up === 'OR' || tok === '|' || up === 'หรือ') { groups.push([]); continue; }
    if (up === 'NOT' || up === 'ไม่') { groups[groups.length - 1].push({ pendingNot: true }); continue; }
    const last = groups[groups.length - 1];
    const prev = last[last.length - 1];
    const tm = term(tok);
    if (prev && prev.pendingNot) { last.pop(); tm.neg = true; }
    last.push(tm);
  }
  return groups.map((g) => g.filter((x) => !x.pendingNot)).filter((g) => g.length);
}

/** ของเดิม — คงไว้เพื่อความเข้ากันได้ (คืนเงื่อนไขแบบแบน ไม่มีชั้น OR) */
export function parseQuery(q) {
  return parseGroups(q).flat();
}

function tagStr(sc) {
  return (Array.isArray(sc.tags) ? sc.tags.join(' ') : String(sc.tags || '')).toLowerCase();
}

// ข้อความรวมทุกฟิลด์ (สำหรับค้นอิสระ) — ตัด 'Outline' ที่แปลว่า "ยังไม่ตั้ง"
function allText(sc) {
  const status = (sc.status && sc.status !== 'Outline') ? sc.status : '';
  return [sc.title, sc.fileName, sc.synopsis, sc.note, sc.pov, sc.emotion, sc.conflict, status, tagStr(sc)]
    .filter(Boolean).join(' ').toLowerCase();
}

function hitTerm(sc, hay, t) {
  let ok;
  if (t.field === '*') ok = hay.includes(t.value);
  else if (t.field === 'flag') {
    const on = ['1', 'true', tt('ui.common.pinPin'), 'fav', 'yes', 'y'].includes(t.value);
    ok = (!!sc.flag) === on;
  } else if (t.field === 'tags') ok = tagStr(sc).includes(t.value);
  else if (t.field === 'status') {
    const v = (sc.status && sc.status !== 'Outline') ? String(sc.status).toLowerCase() : '';
    ok = v.includes(t.value);
  } else ok = String(sc[t.field] ?? '').toLowerCase().includes(t.value);
  return t.neg ? !ok : ok;
}

export function sceneMatchesQuery(sc, q) {
  if (!sc) return true;
  const groups = parseGroups(q);
  if (!groups.length) return true;
  const hay = allText(sc);
  return groups.some((g) => g.every((t) => hitTerm(sc, hay, t)));
}

/**
 * ตัวจับคู่สำหรับแถวที่ "ไม่ใช่ฉาก" (เอนทิตี้ Wiki · รูป · โน้ต · กระดาน · แผนที่)
 * ใช้ไวยากรณ์เดียวกัน แต่มีแค่ข้อความรวมก้อนเดียว (`data-search`)
 * — ไม่งั้นติ๊กชิปสองสถานะแล้วแถวพวกนี้หายเกลี้ยงเพราะไปเจอคำว่า "OR" ไม่ได้
 */
export function textMatchesQuery(hay, q) {
  const groups = parseGroups(q);
  if (!groups.length) return true;
  const h = String(hay || '').toLowerCase();
  return groups.some((g) => g.every((t) => {
    // แถวพวกนี้ไม่มีฟิลด์แยก — เทียบค่าที่ขอกับข้อความรวมทั้งก้อน
    const ok = h.includes(t.value);
    return t.neg ? !ok : ok;
  }));
}
