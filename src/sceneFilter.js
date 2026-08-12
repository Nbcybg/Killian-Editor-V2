// src/sceneFilter.js — ตัวกรอง Explorer: ค้นทุกฟิลด์ properties ของฉาก
// รองรับทั้งค้นอิสระ (ชื่อ/แท็ก/เรื่องย่อ/โน้ต ฯลฯ) และค้นเจาะจงฟิลด์ เช่น
//   status:กำลังเขียน   tag:บู๊   pov:ท็อป   flag:1   สี:เขียว
// สถานะเก็บเป็นคำไทยอยู่แล้ว ('Outline' = ยังไม่ตั้ง) → match แบบ substring ตรง ๆ

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
};

export function parseQuery(q) {
  return (q || '').trim().split(/\s+/).filter(Boolean).map((tok) => {
    const m = /^([^:]+):(.*)$/.exec(tok);
    if (m && FIELD[m[1].toLowerCase()]) return { field: FIELD[m[1].toLowerCase()], value: (m[2] || '').toLowerCase() };
    return { field: '*', value: tok.toLowerCase() };
  });
}

function tagStr(sc) {
  return (Array.isArray(sc.tags) ? sc.tags.join(' ') : String(sc.tags || '')).toLowerCase();
}

// ข้อความรวมทุกฟิลด์ (สำหรับค้นอิสระ) — ตัด 'Outline' ที่แปลว่า "ยังไม่ตั้ง"
function allText(sc) {
  const status = (sc.status && sc.status !== 'Outline') ? sc.status : '';
  return [sc.title, sc.synopsis, sc.note, sc.pov, sc.emotion, sc.conflict, status, tagStr(sc)]
    .filter(Boolean).join(' ').toLowerCase();
}

export function sceneMatchesQuery(sc, q) {
  if (!sc) return true;
  const terms = parseQuery(q);
  if (!terms.length) return true;
  const hay = allText(sc);
  return terms.every((t) => {
    if (t.field === '*') return hay.includes(t.value);
    if (t.field === 'flag') {
      const on = ['1', 'true', tt('ui.common.pinPin'), 'fav', 'yes', 'y'].includes(t.value);
      return (!!sc.flag) === on;
    }
    if (t.field === 'tags') return tagStr(sc).includes(t.value);
    if (t.field === 'status') {
      const v = (sc.status && sc.status !== 'Outline') ? String(sc.status).toLowerCase() : '';
      return v.includes(t.value);
    }
    return String(sc[t.field] ?? '').toLowerCase().includes(t.value);
  });
}
