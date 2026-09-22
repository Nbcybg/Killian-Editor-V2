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
  const m = /^([^:"]+):(.*)$/.exec(tok);
  if (m && FIELD[m[1].toLowerCase()]) return { field: FIELD[m[1].toLowerCase()], value: unquote(m[2] || '').toLowerCase(), neg };
  return { field: '*', value: unquote(tok).toLowerCase(), neg };
}
/** [alpha.159 · H9] ค่าในเครื่องหมายคำพูด (`status:"รอ แก้"`) — สถานะที่ผู้ใช้สร้างเองมีวรรคได้ */
const unquote = (v) => (v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
/** ค่าสำหรับใส่ในคิวรี — มีวรรค/เครื่องหมายคำพูด = ครอบด้วย "" (ตัดเครื่องหมายคำพูดข้างในทิ้ง) */
export function queryValue(v) {
  const s = String(v ?? '');
  return /[\s"]/.test(s) ? '"' + s.replace(/"/g, '') + '"' : s;
}

/**
 * แยกคิวรีเป็น "กลุ่มที่ต่อกันด้วย OR" — แต่ละกลุ่มคือชุดเงื่อนไขที่ต้องเป็นจริงพร้อมกัน
 * @returns {Array<Array<{field:string,value:string,neg:boolean}>>}
 */
export function parseGroups(q) {
  // [alpha.159] โทเคนที่มี "…" ห้ามถูกหั่นตรงวรรค (สถานะ/แท็กที่มีวรรค)
  const toks = String(q || '').trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
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

/**
 * [alpha.159 · H9] ตัวจัดอันดับ "เรียงตามสถานะ" — ลำดับมาจากรายการที่ส่งเข้ามา (allStatuses())
 * 'Outline' / ว่าง / สถานะที่ไม่รู้จัก = ท้ายสุดเสมอ · บริสุทธิ์ (unit test ได้)
 * @param {string[]} statuses ลำดับสถานะของโปรเจกต์
 * @returns {(s:string) => number}
 */
export function statusRankOf(statuses) {
  const order = new Map((statuses || []).filter((s) => s && s !== 'Outline').map((s, i) => [s, i]));
  return (s) => (!s || s === 'Outline' || !order.has(s) ? 1e6 : order.get(s));
}

// ───────── [alpha.161 · P4] ชิปตัวกรอง (สถานะ/แท็ก) ↔ คิวรีในช่องค้นหา ─────────
// เดิมกดชิปแล้ว `q.value = 'status:… OR status:…'` ทับทั้งช่อง → คำที่ผู้ใช้พิมพ์ค้นไว้หาย
// ไวยากรณ์ไม่มีวงเล็บ (OR คั่นกลุ่ม · ในกลุ่ม = AND) → "คำ AND (A OR B)" ต้องกระจายเป็น "คำ A OR คำ B"
const CHIP_FIELD = { status: 'status', 'สถานะ': 'status', tag: 'tag', tags: 'tag', 'แท็ก': 'tag' };
const splitTokens = (q) => String(q || '').trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
const isOr = (tok) => { const up = tok.toUpperCase(); return up === 'OR' || tok === '|' || up === 'หรือ'; };
/** โทเคนนี้เป็นเงื่อนไขของชิปไหม (ฝั่งบวกเท่านั้น — `-status:x` ที่ผู้ใช้พิมพ์เองไม่ใช่ของชิป) */
function chipOf(tok) {
  const m = /^([^:"-][^:"]*):(.+)$/.exec(tok);
  const f = m && CHIP_FIELD[m[1].toLowerCase()];
  return f ? { field: f, value: unquote(m[2]) } : null;
}

/**
 * แยกคิวรีเป็น ส่วนที่ผู้ใช้พิมพ์ (ต่อกลุ่ม OR) + ค่าของชิปที่อยู่ในคิวรี
 * @returns {{free: string[], status: string[], tag: string[]}}
 */
export function parseChipQuery(q) {
  const groups = [[]];
  const status = [], tag = [];
  for (const tok of splitTokens(q)) {
    if (isOr(tok)) { groups.push([]); continue; }
    const c = chipOf(tok);
    if (c) { const arr = c.field === 'status' ? status : tag; if (!arr.includes(c.value)) arr.push(c.value); continue; }
    groups[groups.length - 1].push(tok);
  }
  const free = [];
  for (const g of groups) { const s = g.join(' '); if (s && !free.includes(s)) free.push(s); }
  return { free, status, tag };
}

/**
 * ตั้งค่าของชิปหนึ่งชนิด โดย **ไม่แตะข้อความอื่นในคิวรี** — ไม่เหลือชิปชนิดนั้น = ลบเฉพาะเงื่อนไขนั้น
 * @param {string} q คิวรีปัจจุบัน · @param {'status'|'tag'} field · @param {string[]} values ค่าที่เลือก (ค่าจริง ไม่แปล)
 * @returns {string}
 */
export function setChipClause(q, field, values) {
  const cur = parseChipQuery(q);
  const vals = [...new Set((values || []).map((v) => String(v)).filter(Boolean))];
  const st = field === 'status' ? vals : cur.status;
  const tg = field === 'tag' ? vals : cur.tag;
  const free = cur.free.length ? cur.free : [''];
  const out = [];
  for (const f of free) {
    for (const s of (st.length ? st : [null])) {
      for (const t of (tg.length ? tg : [null])) {
        const g = [f, s !== null ? 'status:' + queryValue(s) : '', t !== null ? 'tag:' + queryValue(t) : '']
          .filter(Boolean).join(' ');
        if (g && !out.includes(g)) out.push(g);
      }
    }
  }
  return out.join(' OR ');
}
