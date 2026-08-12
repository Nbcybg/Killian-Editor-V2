// i18n.js — เอนจินภาษา (alpha.76) · **โมดูลบริสุทธิ์ 100%** (ไม่แตะ DOM · แตะ kapi เฉพาะตอน init แบบกันพัง)
//
// ทำไมต้องมีไฟล์นี้ (แยกจาก core.js):
//   1. โมดูลบริสุทธิ์ (compile/timeline/maps/planner-data/fountain…) ต้องแปลข้อความได้
//      แต่ import core.js ไม่ได้ (core แตะ document/kapi → unit test บน node พัง)
//   2. ตารางคำแปลต้องพร้อม **ก่อน** โมดูลอื่นเริ่มทำงาน เพราะค่าคงที่ระดับโมดูล
//      (ex. `const STATUSES = [{label: T`ร่าง`}]`) ถูกคำนวณตอน import — ถ้าโหลดภาษาแบบ async
//      ทีหลัง ค่าพวกนั้นจะค้างเป็นภาษาเดิมตลอดอายุโปรแกรม
//      → โหลด **แบบ synchronous** (`kapi.langSync`) ในบอดี้ของไฟล์นี้ ซึ่ง esbuild วางไว้บนสุด
//         (ESM init order = ลูกก่อนแม่ · ทุกคนนำเข้าผ่าน core.js ซึ่งนำเข้าไฟล์นี้)
//
// รูปแบบข้อความ 2 แบบ ใช้คู่กันได้:
//   · `t('settings.language')`  → คีย์ dot-path (ของเดิม · ใช้กับ data-i18n ใน index.html ด้วย)
//   · T`บทที่ ${n}`             → tagged template · msgid = "บทที่ {0}" = ตัวคีย์เอง (สไตล์ gettext)
//     ข้อดี: ไม่ต้องตั้งชื่อคีย์ 4,000 อัน · ข้อความต้นฉบับอยู่ในโค้ดให้อ่านรู้เรื่อง ·
//     ผู้แปลเห็นประโยคเต็ม ๆ ไม่ใช่คีย์ลอย ๆ · ถ้าไม่มีคำแปลก็ตกกลับเป็นภาษาต้นฉบับเสมอ (พังไม่ได้)
//
// ไฟล์ภาษา = **CSV ชื่อ `k2_<รหัสภาษา>.csv`** (2 คอลัมน์: key,text) — รหัสภาษาอ่านจากชื่อไฟล์ล้วน ๆ
// วางไฟล์เพิ่มแล้วเปิดโปรแกรมใหม่ = มีภาษาใหม่ทันที **ไม่ต้อง build**

import { parseCsv } from './i18n-csv.js';

// ───────── ตารางคำแปล ─────────
/** ตารางแบน: { 'ui.settings.language': 'ภาษา', 'บทที่ {0}': 'Chapter {0}' } */
let TABLE = Object.create(null);
/** ข้อมูลภาษาที่กำลังใช้ (มาจากแถว meta.* ในไฟล์ CSV) */
export const langInfo = { code: '', name: '', nativeName: '', version: '', author: '', file: '' };
/** ภาษาที่หาเจอในเครื่อง — [{code,name,nativeName,file}] (สแกนจาก **ชื่อไฟล์** k2_*.csv) */
export let langCatalog = [];

/** ชื่อไฟล์ → รหัสภาษา (`k2_en.csv` → `en`, `K2_pt-BR.CSV` → `pt-BR`) · ไม่ใช่รูปแบบนี้คืน '' */
export function langCodeFromFile(name) {
  const m = /^k2[_-]([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)\.csv$/i.exec(String(name || '').trim());
  if (!m) return '';
  const raw = m[1].replace('_', '-');
  const p = raw.split('-');
  return p.length > 1 ? p[0].toLowerCase() + '-' + p.slice(1).join('-').toUpperCase() : p[0].toLowerCase();
}

/** ชื่อไฟล์มาตรฐานของรหัสภาษา */
export function langFileName(code) { return 'k2_' + String(code || 'en') + '.csv'; }

/** ชื่อภาษาสำรอง เผื่อไฟล์ไม่ได้ใส่แถว meta.nativeName */
const FALLBACK_NAMES = {
  th: 'ไทย', en: 'English', ja: '日本語', zh: '中文', ko: '한국어', fr: 'Français',
  de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia', it: 'Italiano', ar: 'العربية', hi: 'हिन्दी', my: 'မြန်မာ',
};
export function fallbackLangName(code) {
  const c = String(code || '').toLowerCase();
  return FALLBACK_NAMES[c] || FALLBACK_NAMES[c.split('-')[0]] || code || '';
}

// ───────── อ่าน CSV ของภาษาเดียว ─────────
/**
 * CSV 2 คอลัมน์ (key,text) → ตารางแบน
 * หัวตารางยืดหยุ่น: ถ้าบรรทัดแรกมีคำว่า `key` ถือเป็นหัวตาราง คอลัมน์ค่าคือคอลัมน์ที่ 2
 * (รับไฟล์แบบเก่า 3 คอลัมน์ `key,th,en` ด้วย — ระบุ `pick` ว่าจะเอาคอลัมน์ชื่ออะไร)
 * @param {string} text
 * @param {string} [pick] ชื่อคอลัมน์ที่ต้องการ (ex. 'th') — ไม่ระบุ = คอลัมน์ที่ 2
 * @returns {Record<string,string>}
 */
export function csvToTable(text, pick) {
  // ตัว loader ต่อไฟล์หลายชั้นเข้าด้วยกัน (โปรเจกต์ → ข้าง exe → ที่มากับโปรแกรม)
  // BOM ของไฟล์ชั้นที่ 2 เป็นต้นไปจะไปติดหัวคีย์แรกของไฟล์นั้น → ต้องกวาดทิ้งทั้งข้อความ
  const rows = parseCsv(String(text || '').replace(/﻿/g, ''));
  const out = Object.create(null);
  if (!rows.length) return out;
  const head = rows[0].map((c) => String(c).trim().toLowerCase());
  const isHeader = head[0] === 'key';
  let vi = 1;
  if (isHeader && pick) { const i = head.indexOf(String(pick).toLowerCase()); if (i > 0) vi = i; }
  else if (isHeader) { const i = head.findIndex((h, n) => n > 0 && (h === 'text' || h === 'value')); if (i > 0) vi = i; }
  for (const r of (isHeader ? rows.slice(1) : rows)) {
    const k = r[0] == null ? '' : String(r[0]);
    if (!k || k.startsWith('#')) continue;               // แถวคอมเมนต์ของผู้แปล
    const v = r[vi] == null ? '' : String(r[vi]);
    // ช่องว่าง = ยังไม่แปล → ตกกลับต้นฉบับ
    // **คีย์แรกที่เจอชนะ** เพราะไฟล์ถูกต่อกันตามลำดับความสำคัญ (ของโปรเจกต์มาก่อน)
    if (v !== '' && !(k in out)) out[k] = v;
  }
  return out;
}

/** ตาราง → CSV 2 คอลัมน์ (ใส่ BOM ให้ Excel อ่านภาษาไทยถูก) */
export function tableToCsv(table, opts = {}) {
  const { bom = true, eol = '\r\n', header = ['key', 'text'] } = opts;
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const keys = Object.keys(table || {});
  const rows = [header.join(',')];
  for (const k of keys) rows.push(cell(k) + ',' + cell(table[k]));
  return (bom ? '﻿' : '') + rows.join(eol) + eol;
}

// ───────── ติดตั้งตาราง ─────────
/** ใส่ตารางคำแปลทั้งก้อน (ใช้ตอนโหลดไฟล์ภาษา + ใน unit test) */
export function setTable(table, code) {
  TABLE = Object.assign(Object.create(null), table || {});
  _memo = new WeakMap();                                  // แคชผูกกับตารางเดิม ต้องล้าง
  langInfo.code = code || TABLE['meta.code'] || '';
  langInfo.name = TABLE['meta.name'] || '';
  langInfo.nativeName = TABLE['meta.nativeName'] || fallbackLangName(langInfo.code);
  langInfo.version = TABLE['meta.version'] || '';
  langInfo.author = TABLE['meta.author'] || '';
  return TABLE;
}
export function getTable() { return TABLE; }
export function setCatalog(list) { langCatalog = Array.isArray(list) ? list : []; return langCatalog; }

/** เติมคีย์ที่ยังไม่มี (ไม่ทับของเดิม) — ใช้ผสมไฟล์ภาษาของโปรเจกต์ทับไฟล์ที่มากับโปรแกรม */
export function fillTable(table) {
  for (const k of Object.keys(table || {})) if (!(k in TABLE)) TABLE[k] = table[k];
  _memo = new WeakMap();
  return TABLE;
}

// ───────── ค้นคำแปล ─────────
/**
 * คีย์ dot-path — โค้ดเดิมเรียกโดยไม่ใส่ `ui.` นำหน้า (`t('settings.language')`)
 * จึงลองทั้งแบบมี `ui.` และไม่มี
 */
export function lookup(key) {
  if (typeof key !== 'string' || !key) return undefined;
  const v = TABLE[key];
  if (typeof v === 'string' && v !== '') return v;
  const u = TABLE['ui.' + key];
  if (typeof u === 'string' && u !== '') return u;
  return undefined;
}

/** `t('a.b', 'สำรอง')` — ไม่เจอคืนค่าสำรอง (ถ้าไม่ส่งมาก็คืนตัวคีย์) */
export function tKey(key, fallback) {
  const v = lookup(key);
  return v != null ? v : (fallback != null ? fallback : key);
}

// ───────── tagged template ─────────
/**
 * แทน {0},{1}… ด้วยค่าที่ส่งมา · `{{` = วงเล็บปีกกาตัวจริง
 * @param {string} tpl
 * @param {any[]} vals
 */
export function formatMsg(tpl, vals) {
  if (!vals || !vals.length) return String(tpl).replace(/\{\{|\}\}/g, (m) => m[0]);
  return String(tpl).replace(/\{\{|\}\}|\{(\d+)\}/g, (m, d) => {
    if (m === '{{' || m === '}}') return m[0];
    const v = vals[+d];
    return v == null ? '' : String(v);
  });
}

/** สร้าง msgid จากชิ้นส่วนของ template: ['บทที่ ', ''] → 'บทที่ {0}' */
export function makeMsgid(strings) {
  let s = '';
  for (let i = 0; i < strings.length; i++) { s += strings[i]; if (i < strings.length - 1) s += '{' + i + '}'; }
  return s;
}

// แคชผลค้นหาต่อ "จุดเรียก" — array ของ tagged template เป็นวัตถุตัวเดิมทุกครั้งที่เรียกซ้ำ
// จึงใช้เป็นคีย์ WeakMap ได้ → ต่อจากครั้งแรกไม่ต้องต่อสตริง/ค้นตารางอีกเลย
let _memo = new WeakMap();

/**
 * T`ข้อความ ${ค่า}` — คืนข้อความที่แปลแล้ว
 * เรียกแบบฟังก์ชันธรรมดาก็ได้: `T('ข้อความ')` (เผื่อโค้ดที่สร้างข้อความเอง)
 */
export function T(strings, ...vals) {
  if (typeof strings === 'string') return formatMsg(lookup(strings) ?? strings, vals);
  let tpl = _memo.get(strings);
  if (tpl === undefined) {
    const id = makeMsgid(strings);
    tpl = lookup(id) ?? id;
    _memo.set(strings, tpl);
  }
  return formatMsg(tpl, vals);
}

/** เหมือน T แต่รับ msgid เป็นสตริงตรง ๆ + ค่าที่จะแทน — ใช้ตอนสร้าง msgid แบบไดนามิกไม่ได้ */
export function tm(msgid, ...vals) { return formatMsg(lookup(msgid) ?? msgid, vals); }

// ───────── โหลดแบบ synchronous ตอนเริ่มโปรแกรม ─────────
// เก็บภาษาที่ผู้ใช้เลือกไว้ใน localStorage เพราะตอนนี้ยังอ่าน project.khn.json ไม่ได้ (async)
export const LANG_LS_KEY = 'k2-lang';

/** ทำงานเฉพาะใน renderer ที่มี kapi.langSync — ที่อื่น (unit test/node) เงียบ ๆ ไม่ทำอะไร */
export function initSyncFromHost() {
  try {
    const api = (typeof globalThis !== 'undefined' && globalThis.kapi) || null;
    if (!api || typeof api.langSync !== 'function') return false;
    let want = '';
    try { want = globalThis.localStorage?.getItem(LANG_LS_KEY) || ''; } catch {}
    const res = api.langSync(want);                 // { code, csv, catalog:[{code,file,name,nativeName}] }
    if (!res) return false;
    if (Array.isArray(res.catalog)) setCatalog(res.catalog);
    if (res.csv) { setTable(csvToTable(res.csv), res.code); return true; }
  } catch {}
  return false;
}

// เรียกทันทีตอนโมดูลถูกโหลด — บรรทัดนี้คือหัวใจที่ทำให้ค่าคงที่ระดับโมดูลได้ภาษาถูกตั้งแต่แรก
initSyncFromHost();
