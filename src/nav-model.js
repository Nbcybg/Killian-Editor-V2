// src/nav-model.js — [alpha.140] แกนของแผง Navigation (บริสุทธิ์ 100% · มี unit test)
//
// ═══ ทำไมต้องมีไฟล์นี้ ═══
// แผง Navigation เดิมเป็นโค้ดก้อนเดียวใน app.js: สแกนเอกสาร → วาด `<div>` → จบ
// ไม่มีที่ให้ตัวกรอง/ค้นหา/แบ่งหน้าไปอยู่เลย และไม่มีอะไรทดสอบได้โดยไม่เปิด Electron
//
// ไฟล์นี้จึงถือ "ตรรกะที่ตัดสินว่าจะเห็นแถวไหน หน้าไหน หน้าตายังไง" ทั้งหมด
// โดยไม่แตะ DOM/kapi/เวลา — app.js เหลือหน้าที่แค่ **สแกนเอกสาร** กับ **วาด**
//
// ═══ กติกาที่ยึด ═══
//  · ชนิดของแถว (`kind`) เป็นคำเดียวกับที่ `nav.js` และตัวสแกนใน app.js คืนมา
//    (ห้ามมีตารางชนิดชุดที่สอง — เพิ่มชนิดใหม่ = เพิ่มที่ `NAV_KIND_GROUP` ที่เดียว)
//  · ค่าที่เขียนลงไฟล์งาน (ชื่อสี) เก็บเป็นไทยเสมอ แปลตอนวาดด้วย dataLabel()
//  · คีย์ของ "จุดที่ผู้ใช้ตั้งสี/ติดดาว" ต้องไม่ผูกกับเลขบรรทัด — เพิ่มย่อหน้าข้างบน
//    แล้วเครื่องหมายต้องไม่กระโดดไปติดแถวอื่น (จึงใช้ ฉาก+ชนิด+ข้อความ+ลำดับซ้ำ)

import { t } from './i18n.js';

// ───────── ชนิดของแถว → กลุ่มตัวกรอง ─────────
/** กลุ่มตัวกรอง (เรียงตามที่โผล่บนชิป) */
export const NAV_GROUPS = ['head', 'scene', 'dialog', 'trans', 'note', 'beat'];

/** ชนิดของแถว → กลุ่ม · ชนิดที่ไม่รู้จักตกกลุ่ม 'beat' (เห็นเสมอเมื่อเปิดกลุ่มย่อหน้า) */
export const NAV_KIND_GROUP = {
  scene: 'scene',           // แถวฉาก (มุมมองทั้งเล่ม)
  sceneHeading: 'scene',    // หัวฉากของบทภาพยนตร์ (INT./EXT.)
  heading: 'head',          // หัวข้อนิยาย # ## ###
  outline: 'head',          // โครงของบทภาพยนตร์ # ## ###
  act: 'head', seq: 'head', endact: 'head',
  character: 'dialog',
  transition: 'trans',
  summary: 'note', quote: 'note', note: 'note',
  beat: 'beat',
};
export function navGroupOf(kind) { return NAV_KIND_GROUP[kind] || 'beat'; }

/** ป้ายของกลุ่ม (คีย์ภาษา) */
export const NAV_GROUP_KEYS = {
  head: 'ui.nav.grpHead', scene: 'ui.nav.grpScene', dialog: 'ui.nav.grpDialog',
  trans: 'ui.nav.grpTrans', note: 'ui.nav.grpNote', beat: 'ui.nav.grpBeat',
};
/** ไอคอนสั้น ๆ ของกลุ่ม (ไม่ใช่ข้อความ จึงไม่ต้องแปล) */
export const NAV_GROUP_ICON = {
  head: '§', scene: '◧', dialog: '☰', trans: '⇥', note: '✎', beat: '¶',
};

// ───────── สถานะของจุด (flags) ─────────
//
// ผู้ใช้: *"บอกสถานะของจุดนั้น ๆ เช่น ตัวหนา = เป็นทางเลือก"*
// ชุดนี้คือคำตอบว่า "ต้องมีอะไรบ้าง" — ทุกตัวอ่านจากข้อมูลที่โปรเจกต์มีอยู่จริง
// (ไม่มีตัวไหนต้องให้ผู้ใช้มากรอกเพิ่ม ยกเว้น `star`/`color` ที่เป็นของผู้ใช้เอง)
/** @type {Array<{id:string, mark:string, key:string}>} */
export const NAV_FLAG_DEFS = [
  { id: 'choice',  mark: '⤷', key: 'ui.nav.flagChoice' },   // ตัวหนา + จำนวนทางเลือก
  { id: 'star',    mark: '★', key: 'ui.nav.flagStar' },
  { id: 'color',   mark: '▌', key: 'ui.nav.flagColor' },
  { id: 'todo',    mark: '⚠', key: 'ui.nav.flagTodo' },
  { id: 'empty',   mark: '○', key: 'ui.nav.flagEmpty' },
  { id: 'locked',  mark: '🔒', key: 'ui.nav.flagLocked' },
  { id: 'comment', mark: '💬', key: 'ui.nav.flagComment' },
  { id: 'break',   mark: '▤', key: 'ui.nav.flagBreak' },
];
export const NAV_FLAG_IDS = NAV_FLAG_DEFS.map((f) => f.id);

/** ตัวจับ "งานค้าง" ในข้อความ — ครอบคลุมทั้งคำอังกฤษที่นักเขียนใช้กันและวงเล็บไทย */
const TODO_RE = /\b(TODO|FIXME|XXX|TBD)\b|\?\?\?|\((?:ยังไม่เขียน|รอเขียน|เขียนต่อ|เช็ค)\)/i;

/**
 * สถานะที่ "อ่านออกจากตัวแถวเอง" — สิ่งที่ต้องถามข้อมูลนอกแถว (ดาว/สี/คอมเมนต์/ล็อก)
 * ผู้เรียกใส่มาให้ทาง `item` ก่อนแล้ว ฟังก์ชันนี้แค่รวบให้เป็นชุดเดียว
 * @param {object} it แถวหนึ่งใน Navigation
 * @returns {string[]} รหัสสถานะ เรียงตาม NAV_FLAG_DEFS
 */
export function navFlags(it) {
  const on = new Set();
  if (!it) return [];
  if (it.choices > 0) on.add('choice');
  if (it.star) on.add('star');
  if (it.color) on.add('color');
  if (TODO_RE.test(String(it.label || ''))) on.add('todo');
  if (!String(it.label || '').trim() || it.empty) on.add('empty');
  if (it.locked) on.add('locked');
  if (it.comments > 0) on.add('comment');
  if (it.pageBreak) on.add('break');
  return NAV_FLAG_IDS.filter((f) => on.has(f));
}

// ───────── คีย์ของเครื่องหมายที่ผู้ใช้ตั้งเอง ─────────
/**
 * คีย์ต้องอยู่รอด "แก้ย่อหน้าอื่น" — จึงห้ามใช้เลขบรรทัด/ตำแหน่งใน doc
 * ใช้ ฉาก + ชนิด + ข้อความ (ตัดช่องว่างซ้ำ) + ลำดับของข้อความซ้ำในฉากเดียวกัน
 */
export function navKey(sceneId, kind, label, ord = 0) {
  const s = String(label || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return [String(sceneId || ''), String(kind || ''), s, String(ord || 0)].join('');
}

/** เติม `ord` (ลำดับของข้อความซ้ำ) ให้ทุกแถว แล้วคำนวณ `key` — แก้ในที่ คืนตัวเดิม */
export function withNavKeys(items) {
  const seen = new Map();
  for (const it of items || []) {
    const base = navKey(it.sceneId, it.kind, it.label, 0);
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    it.ord = n;
    it.key = navKey(it.sceneId, it.kind, it.label, n);
  }
  return items || [];
}

// ───────── ค้นหา + กรอง ─────────
/** คำค้นหนึ่งคำตรงกับแถวนี้ไหม (ไม่สนตัวพิมพ์) */
export function matchNavText(it, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return [it.label, it.status, it.color, it.sceneTitle]
    .some((v) => String(v || '').toLowerCase().includes(s));
}

/**
 * กรองรายการตามสภาพของแถบเครื่องมือ
 * @param {Array} items
 * @param {object} o
 *   o.q       คำค้น ('' = ไม่กรอง)
 *   o.groups  Set/Array ของกลุ่มที่ "เปิด" (ว่าง = เปิดหมด)
 *   o.colors  Set/Array ของชื่อสีไทยที่ต้องการ (ว่าง = ไม่กรองสี)
 *   o.star    true = เอาเฉพาะที่ติดดาว
 *   o.flags   Set/Array ของสถานะที่ต้องมีอย่างน้อยหนึ่งตัว (ว่าง = ไม่กรอง)
 */
export function filterNav(items, o = {}) {
  const groups = toSet(o.groups), colors = toSet(o.colors), flags = toSet(o.flags);
  return (items || []).filter((it) => {
    if (groups.size && !groups.has(navGroupOf(it.kind))) return false;
    if (colors.size && !colors.has(it.color || '')) return false;
    if (o.star && !it.star) return false;
    if (flags.size) {
      const f = navFlags(it);
      if (!f.some((x) => flags.has(x))) return false;
    }
    return matchNavText(it, o.q);
  });
}
function toSet(v) {
  if (!v) return new Set();
  return v instanceof Set ? v : new Set(v);
}

// ───────── แบ่งหน้า ─────────
export const NAV_PER_PAGE_MIN = 5, NAV_PER_PAGE_MAX = 500, NAV_PER_PAGE_DEFAULT = 50;
/** หนีบ "จำนวนแถวต่อหน้า" ให้อยู่ในช่วงที่ใช้ได้จริง (ค่าเพี้ยน = ค่าเริ่มต้น) */
export function clampPerPage(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return NAV_PER_PAGE_DEFAULT;
  return Math.max(NAV_PER_PAGE_MIN, Math.min(NAV_PER_PAGE_MAX, v));
}
/** จำนวนหน้าทั้งหมด (อย่างน้อย 1 เสมอ — รายการว่างก็ยังเป็น "หน้า 1 จาก 1") */
export function navPageCount(total, perPage) {
  return Math.max(1, Math.ceil(Math.max(0, total) / clampPerPage(perPage)));
}
/** แถวของหน้าที่ `page` (นับจาก 0) — หน้าที่เกินขอบถูกหนีบให้อยู่ในช่วง */
export function navSlice(items, page, perPage) {
  const list = items || [];
  const per = clampPerPage(perPage);
  const pages = navPageCount(list.length, per);
  const p = Math.max(0, Math.min(pages - 1, parseInt(page, 10) || 0));
  return { page: p, pages, rows: list.slice(p * per, p * per + per) };
}

// ───────── คอลัมน์ที่อยู่ ─────────
/**
 * ข้อความคอลัมน์แรก — "บรรทัด" กับ "หน้า" ของจุดนั้น
 * ไม่มีเลขบรรทัด (แถวฉากในมุมมองทั้งเล่ม) = โชว์เลขหน้าอย่างเดียว · ไม่มีทั้งคู่ = '–'
 */
export function navLocText(it) {
  const ln = Number.isFinite(it && it.line) ? (it.line + 1) : null;
  const pg = Number.isFinite(it && it.page) ? it.page : null;
  if (ln != null && pg != null) return ln + ' · ' + t('ui.nav.pageAbbr') + pg;
  if (ln != null) return String(ln);
  if (pg != null) return t('ui.nav.pageAbbr') + pg;
  return '–';
}

/** เลขหน้าของตำแหน่ง `pos` จากรายการเส้นคั่นหน้า `[{pos,page}]` (หน้าแรก = basePage) */
export function pageOfPos(breaks, pos, basePage = 1) {
  let page = basePage;
  for (const b of breaks || []) {
    if (!b || !Number.isFinite(b.pos)) continue;
    if (b.pos <= pos) page = Number.isFinite(b.page) ? b.page : page + 1;
    else break;
  }
  return page;
}

/**
 * เลข "บรรทัดในไฟล์ .md" ของบล็อกลำดับที่ `idx` — จาก `mdLineCounts()` ของตัวแก้ไข
 *
 * ★ กติกาที่ทำเทสรอบแรกแดง (จดไว้กันพลาดซ้ำ): `mdLineCounts()` คืน **หนึ่งค่าต่อบล็อกระดับบน**
 * และ `docToMd()` ต่อบรรทัดด้วย `
` เดี่ยว ๆ — **บรรทัดว่างในไฟล์เป็น "ย่อหน้าว่าง" ที่เป็นบล็อก
 * ของตัวเอง** (มีค่า 1 ในตารางนี้) จึงห้ามบวกตัวคั่นเพิ่มเอง ไม่งั้นเลขบรรทัดเดินเป็นสองเท่า
 *
 * @returns {number} เลขบรรทัดนับจาก 0
 */
export function mdLineOfBlock(counts, idx) {
  let line = 0;
  const c = counts || [];
  for (let i = 0; i < idx && i < c.length; i++) line += (c[i] || 1);
  return line;
}

/** กลับทาง: บรรทัดที่ `line` (นับจาก 0) ตกอยู่ในบล็อกลำดับที่เท่าไร */
export function blockOfMdLine(counts, line) {
  const c = counts || [];
  let at = 0;
  for (let i = 0; i < c.length; i++) {
    const n = (c[i] || 1);
    if (line < at + n) return i;
    at += n;
  }
  return Math.max(0, c.length - 1);
}

// ───────── จับคู่แถวจากดิสก์ ↔ บล็อกจริงในเอกสาร ─────────
/** ตัดเครื่องหมายไวยากรณ์ทิ้ง เหลือแต่ถ้อยคำ (ใช้เทียบข้ามสองทางที่อ่าน .md คนละแบบ) */
export function navNormLabel(v) {
  return String(v || '').replace(/…$/, '').replace(/[.>@=]+/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
/**
 * เข้มกว่านั้นอีกขั้น: ตัดจุดนำ/หมายเลขข้อ/ช่องว่างทิ้งหมด
 * ★ ต้องตัด "หมายเลขข้อ" **ก่อน** ตัดจุด ไม่งั้น `1.` เหลือ `1` ค้างอยู่ในผลลัพธ์
 */
export function navTightLabel(v) {
  return String(v || '').replace(/…$/, '')
    .replace(/(^|\s)\d+[.)](?=\s|$)/g, ' ')
    .replace(/[.>@=]+/g, ' ')
    .replace(/[-–—•*]/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * หาบล็อกในเอกสารที่ตรงกับแถวที่มาจากไฟล์บนดิสก์ — ไล่จากเข้มไปหลวมสี่ชั้น
 *
 * ต้องมีหลายชั้นเพราะสองฝั่งเดินคนละทาง:
 *  · ฝั่งดิสก์  = `nav.js` อ่าน **ข้อความ .md ดิบ** (รายการยังมี `- ` / `1. ` นำหน้า)
 *  · ฝั่งเอกสาร = `node.textContent` ของ ProseMirror (ไม่มีจุดนำ · ไม่มีช่องว่างระหว่างข้อ ·
 *    บทภาพยนตร์อาจถูกบังคับ ALL-CAPS และกลืน `.` หน้าหัวฉาก)
 * และทั้งสองฝั่งตัดข้อความที่ 42 ตัวอักษร **คนละจุดกัน** เพราะความยาวต่างกัน
 *
 * @param {Array} scanned บล็อกจริงในเอกสาร (จาก navScanTab)
 * @param {object} row    แถวจากมุมมองทั้งเล่ม
 */
export function navMatchRow(scanned, row) {
  const list = scanned || [];
  const want = navNormLabel(row && row.label);
  if (!want) return null;
  let seen = 0;
  const exact = list.find((s) => s.kind === row.kind && navNormLabel(s.label) === want
                                 && seen++ === (row.ord || 0));
  if (exact) return exact;
  const sameText = list.find((s) => navNormLabel(s.label) === want);
  if (sameText) return sameText;
  const tw = navTightLabel(row.label);
  const sameTight = list.find((s) => navTightLabel(s.label) === tw);
  if (sameTight) return sameTight;
  const head = tw.slice(0, 12);
  if (!head) return null;
  return list.find((s) => {
    const st = navTightLabel(s.label);
    return st.startsWith(head) || tw.startsWith(st.slice(0, 12));
  }) || null;
}
