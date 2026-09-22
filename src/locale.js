// locale.js — [alpha.162 · W7] ★ วันที่ · เวลา · ตัวเลข · การเรียง · การตัดคำ ตาม "ภาษาที่ผู้ใช้เลือก" ที่เดียว
//
// เดิม: `toLocaleString('th-TH')` ตายตัว 12 จุด (เลือกภาษาอังกฤษก็ยังได้ "22/9/2569") ·
// `localeCompare(x, 'th')` 23 จุด · ตัวเลขใช้ภาษาของ OS (ไม่ใช่ภาษาที่ผู้ใช้เลือกในโปรแกรม)
//
// กติกา:
//   · ภาษาไทย → ปฏิทินพุทธ (พ.ศ.) · ภาษาอื่นทุกภาษา → ปฏิทินสากล (ค.ศ.) — ส่ง `calendar` ชัด ๆ
//     ไม่ฝากไว้กับค่าเริ่มต้นของ ICU (เช่น `ja` บางเครื่องอาจได้ปฏิทินญี่ปุ่น)
//   · ภาษาที่ ICU ไม่รู้จัก (รหัสที่ผู้ใช้ตั้งเอง) → รูปแบบ en · ไม่ตกไปตามภาษาของเครื่อง
//   · ยังไม่ได้โหลดภาษา (unit test · ช่วงเปิดโปรแกรม) = ภาษาเริ่มต้นของโปรแกรม `th`
//   · รหัสภาษาเสีย (ไฟล์ภาษาตั้งชื่อเอง) → ไม่พัง ตกไปใช้ `th`
//   · การตัดคำ: ICU เลือกพจนานุกรมตาม "ตัวอักษร" ไม่ใช่ตามภาษา — ไทย/ญี่ปุ่น/อังกฤษได้ผลเท่ากันทุกภาษา
//     (unit test ตรึงไว้) → ดัชนีค้นหาที่สร้างไว้ไม่ต้องสร้างใหม่ตอนเปลี่ยนภาษา
//
// บริสุทธิ์: ไม่แตะ DOM ยกเว้น `applyDocLang` (มีตัวกัน) · ใช้ได้ทั้ง renderer และ unit test
import { langInfo } from './i18n.js';

const DEFAULT_LANG = 'th';
/** ภาษาที่เขียนขวาไปซ้าย — ใช้ตั้ง `dir` ของเอกสาร (ยังไม่ทำ RTL เต็มรูป — ดู AGENTS W7) */
export const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'dv', 'ckb', 'sd', 'ug']);

let _override = '';
/** unit test/e2e: บังคับภาษา (ค่าว่าง = กลับไปตามภาษาที่โหลด) */
export function setLocaleOverride(code) { _override = String(code || ''); _cache.clear(); }

const _okTag = new Map();
function valid(tag) {
  if (_okTag.has(tag)) return _okTag.get(tag);
  let ok = false;
  try { ok = Intl.getCanonicalLocales(tag).length > 0; } catch { ok = false; }
  _okTag.set(tag, ok);
  return ok;
}

/** รหัสภาษาหลักของ UI ตอนนี้ ('th' · 'en' · …) — ตัวเล็ก ตัดส่วนภูมิภาคออก */
export function uiLang() {
  const raw = String(_override || langInfo.code || DEFAULT_LANG).trim().toLowerCase().replace(/_/g, '-');
  const base = raw.split('-')[0];
  return base && valid(base) ? base : DEFAULT_LANG;
}

const _known = new Map();
/** ICU รู้จักภาษานี้ไหม — ไม่รู้จัก (เช่น ภาษาที่ผู้ใช้ตั้งรหัสเอง 'zz') Intl จะตกไปใช้ภาษาของเครื่อง
 *  ซึ่งต่างกันไปทุกเครื่อง **และทิ้งส่วนขยาย -u-ca-… ด้วย** (zz-u-ca-gregory ได้ปฏิทินพุทธบนเครื่องไทย) */
function known(lang) {
  if (!_known.has(lang)) {
    let ok = false;
    try { ok = Intl.DateTimeFormat.supportedLocalesOf([lang]).length > 0; } catch { ok = false; }
    _known.set(lang, ok);
  }
  return _known.get(lang);
}
/** แท็กสำหรับตัวเลข/การเรียง/วันที่ · ภาษาที่ ICU ไม่รู้จัก → en (ผลเท่ากันทุกเครื่อง) */
export function textLocale(lang = uiLang()) { return lang === 'th' ? 'th-TH' : known(lang) ? lang : 'en'; }
/** ปฏิทิน: ไทย = พุทธ (พ.ศ.) · อื่น ๆ = สากล (ค.ศ.) — ส่งเป็นตัวเลือก `calendar` (ไม่ใช่ส่วนขยายของแท็ก) */
export function calendarOf(lang = uiLang()) { return lang === 'th' ? 'buddhist' : 'gregory'; }
/** แท็ก BCP-47 ของวันที่ (ไว้ส่งต่อให้ของนอกที่รับแค่แท็ก) */
export function dateLocale(lang = uiLang()) { return textLocale(lang) + '-u-ca-' + calendarOf(lang); }

const _cache = new Map();
function cached(kind, key, make) {
  const k = kind + '|' + uiLang() + '|' + key;
  let v = _cache.get(k);
  if (v === undefined) {
    try { v = make(); } catch { v = null; }
    if (_cache.size > 200) _cache.clear();
    _cache.set(k, v);
  }
  return v;
}

function toDate(v) {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(typeof v === 'string' && /^\d+$/.test(v) ? +v : v);
  return isNaN(d.getTime()) ? null : d;
}

function fmt(kind, v, opts, dflt) {
  const d = toDate(v);
  if (!d) return '';
  const o = opts || dflt;
  const f = cached('dt-' + kind, JSON.stringify(o), () => new Intl.DateTimeFormat(textLocale(), { calendar: calendarOf(), ...o }));
  if (f) return f.format(d);
  try { return d.toISOString().slice(0, kind === 'time' ? undefined : 10); } catch { return ''; }
}

/** วันที่อย่างเดียว · ค่าที่ไม่ใช่วันที่ = '' (คนเรียกใส่ '—' เอง) */
export function fmtDate(v, opts) { return fmt('date', v, opts, { year: 'numeric', month: 'numeric', day: 'numeric' }); }
/** เวลาอย่างเดียว */
export function fmtTime(v, opts) { return fmt('time', v, opts, { hour: 'numeric', minute: '2-digit', second: '2-digit' }); }
/** วันที่ + เวลา (แทน `toLocaleString()`) */
export function fmtDateTime(v, opts) {
  return fmt('dt', v, opts, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

/** ตัวเลขมีตัวคั่นหลักพันตามภาษาที่เลือก (แทน `n.toLocaleString()`) */
export function fmtNum(n, opts) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n ?? '');
  const f = cached('num', opts ? JSON.stringify(opts) : '', () => new Intl.NumberFormat(textLocale(), opts));
  return f ? f.format(x) : String(x);
}

/** ตัวเทียบข้อความสำหรับ `sort` ตามภาษาที่เลือก (ICU เรียงสระหน้าไทยถูกทุกภาษา — ต่างกันแค่ลำดับระหว่างอักษรไทย/ละติน) */
export function collator(opts) {
  return cached('col', opts ? JSON.stringify(opts) : '', () => new Intl.Collator(textLocale(), opts));
}
/** เทียบสองข้อความ (null/undefined = '') — แทน `a.localeCompare(b, 'th')` */
export function cmpText(a, b) {
  const c = collator();
  const x = String(a ?? ''), y = String(b ?? '');
  return c ? c.compare(x, y) : (x < y ? -1 : x > y ? 1 : 0);
}

/** ตัวตัดคำของ ICU (ตามภาษาที่เลือก · สร้างไม่ได้ = null ให้คนเรียกใช้ทางสำรองของตัวเอง) */
export function wordSegmenter() {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return null;
  return cached('seg', 'word', () => {
    try { return new Intl.Segmenter(textLocale(), { granularity: 'word' }); }
    catch { return new Intl.Segmenter(DEFAULT_LANG, { granularity: 'word' }); }
  });
}

/** ทิศของภาษา */
export function langDir(lang = uiLang()) { return RTL_LANGS.has(lang) ? 'rtl' : 'ltr'; }

/** ตั้ง `<html lang dir>` ตามภาษาที่ใช้จริง — เรียกหลังโหลดภาษาทุกครั้ง (รวมกรณีตกไปใช้ en) */
export function applyDocLang(code) {
  const lang = code ? String(code).toLowerCase().split(/[-_]/)[0] : uiLang();
  try {
    const de = typeof document !== 'undefined' && document.documentElement;
    if (!de) return false;
    de.lang = lang;
    de.dir = langDir(lang);
    return true;
  } catch { return false; }
}
