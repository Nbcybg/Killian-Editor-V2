// i18n-csv.js — แปลงไฟล์ภาษา (.json) ↔ ตาราง CSV 3 คอลัมน์ (alpha.60r3 ข้อ 4)
//
// เป้าหมาย: ให้ผู้แปลที่ไม่เขียนโค้ดทำงานใน Excel / Google Sheets ได้
//   คอลัมน์: `key, th, en`   (key = dot-path เช่น `panel.project`)
//
// โมดูลบริสุทธิ์ 100% — ไม่แตะ DOM / kapi เลย (มี unit test แยก · `test/i18n-csv.test.cjs`)
//
// เรื่องที่พลาดง่ายและถูกจัดการไว้แล้ว:
//   · **คอมมาในข้อความไทย** ("เช่น สั้น, ปานกลาง") → ต้องครอบ `"` เสมอเมื่อมี , " \n หรือ CR
//   · **เครื่องหมายคำพูดในค่า** → escape เป็น `""` ตามมาตรฐาน RFC 4180
//   · **BOM** — Excel บน Windows อ่าน UTF-8 ที่ไม่มี BOM เป็น ANSI แล้วภาษาไทยกลายเป็นขยะ
//     → `jsonToCsv()` ใส่ BOM ให้เสมอ · `csvToJson()` ตัด BOM ทิ้งก่อนพาร์ส
//   · **บรรทัดจบด้วย CRLF** (Excel เขียนแบบนี้) → พาร์สรับทั้ง \n และ \r\n

export const CSV_BOM = '﻿';
export const CSV_HEADER = ['key', 'th', 'en'];

// ───────── flatten / unflatten ─────────
/**
 * แบนวัตถุซ้อนเป็น { 'a.b.c': 'value' } — ข้ามค่าที่ไม่ใช่สตริง (เช่น meta.version ที่เป็นเลข)
 * @param {object} obj
 * @param {string} [prefix]
 * @returns {Record<string,string>}
 */
export function flatten(obj, prefix = '') {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[key] = String(v);
  }
  return out;
}

/** ย้อนกลับ: { 'a.b': 'x' } → { a: { b: 'x' } } */
export function unflatten(map) {
  const out = {};
  for (const key of Object.keys(map || {})) {
    const parts = String(key).split('.').filter(Boolean);
    if (!parts.length) continue;
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      // คีย์ชนกัน (มีทั้ง `a` และ `a.b`) → ให้ระดับลึกชนะ ไม่งั้นเขียนทับกันเงียบ ๆ
      if (!node[p] || typeof node[p] !== 'object') node[p] = {};
      node = node[p];
    }
    node[parts[parts.length - 1]] = map[key];
  }
  return out;
}

// ───────── เขียน CSV ─────────
/** ครอบเครื่องหมายคำพูดเมื่อจำเป็น (RFC 4180) */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * สร้าง CSV 3 คอลัมน์จากไฟล์ภาษาไทย + อังกฤษ
 * คีย์ = union ของทั้งสองภาษา (เรียง A→Z) — คีย์ที่ขาดฝั่งใดฝั่งหนึ่งจึงเห็นเป็นช่องว่างในตาราง
 * @param {object} th  ไฟล์ th.json (ทั้งก้อน หรือเฉพาะ `ui`)
 * @param {object} [en]
 * @param {{bom?:boolean, eol?:string}} [opts]
 * @returns {string}
 */
export function jsonToCsv(th, en = {}, opts = {}) {
  const { bom = true, eol = '\r\n' } = opts;
  const fth = flatten(th), fen = flatten(en);
  const keys = [...new Set([...Object.keys(fth), ...Object.keys(fen)])].sort();
  const rows = [CSV_HEADER.join(',')];
  for (const k of keys) rows.push([csvCell(k), csvCell(fth[k]), csvCell(fen[k])].join(','));
  return (bom ? CSV_BOM : '') + rows.join(eol) + eol;
}

// ───────── อ่าน CSV ─────────
/**
 * พาร์ส CSV เป็นตาราง 2 มิติ (รองรับ quoted field ที่มี , " และขึ้นบรรทัดใหม่ข้างใน)
 * เขียนเป็น state machine ตัวต่อตัว — regex ทำเคส `""` ข้างใน quoted field ไม่ได้
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', inQ = false, i = 0;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }   // "" = " ตัวจริง
        inQ = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { endCell(); i++; continue; }
    if (c === '\r') { i++; continue; }                            // CRLF ของ Excel
    if (c === '\n') { endRow(); i++; continue; }
    cell += c; i++;
  }
  // บรรทัดสุดท้ายที่ไม่มี newline ปิดท้าย ต้องไม่หาย · แต่ไฟล์ที่จบด้วย newline ต้องไม่ได้แถวว่างเกินมา
  if (cell !== '' || row.length) endRow();
  return rows;
}

/**
 * CSV → ไฟล์ภาษาแยกตามคอลัมน์
 * หัวตารางยืดหยุ่น: หา index ของ `key`/`th`/`en` จากบรรทัดแรก (ไม่บังคับลำดับ)
 * ถ้าบรรทัดแรกไม่ใช่หัวตาราง ให้ถือว่าเรียงตาม CSV_HEADER
 * @returns {{th:object, en:object, keys:string[], skipped:number}}
 */
export function csvToJson(text) {
  const rows = parseCsv(text).filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!rows.length) return { th: {}, en: {}, keys: [], skipped: 0 };
  const head = rows[0].map((c) => String(c).trim().toLowerCase());
  const isHeader = head.includes('key');
  const idx = { key: 0, th: 1, en: 2 };
  if (isHeader) {
    idx.key = head.indexOf('key');
    idx.th = head.findIndex((h) => h === 'th' || h === 'th_value' || h === 'thai');
    idx.en = head.findIndex((h) => h === 'en' || h === 'en_value' || h === 'english');
  }
  const body = isHeader ? rows.slice(1) : rows;
  const fth = {}, fen = {}, keys = [];
  let skipped = 0;
  for (const r of body) {
    const key = String(r[idx.key] == null ? '' : r[idx.key]).trim();
    if (!key) { skipped++; continue; }
    keys.push(key);
    if (idx.th >= 0 && r[idx.th] != null && r[idx.th] !== '') fth[key] = String(r[idx.th]);
    if (idx.en >= 0 && r[idx.en] != null && r[idx.en] !== '') fen[key] = String(r[idx.en]);
  }
  return { th: unflatten(fth), en: unflatten(fen), keys, skipped };
}

/**
 * รวมคำแปลใหม่ทับของเดิม — **เติม/ทับเฉพาะคีย์ที่ CSV มีค่า** ไม่ลบคีย์ที่หายไปจากตาราง
 * (ผู้แปลมักส่งกลับมาแค่บางส่วน · ถ้าเอา CSV ทับทั้งไฟล์ สตริงที่เหลือจะหายหมด)
 * @returns {{merged:object, added:number, changed:number}}
 */
export function mergeStrings(base, patch) {
  const fb = flatten(base), fp = flatten(patch);
  let added = 0, changed = 0;
  for (const k of Object.keys(fp)) {
    if (!(k in fb)) added++;
    else if (fb[k] !== fp[k]) changed++;
    fb[k] = fp[k];
  }
  return { merged: unflatten(fb), added, changed };
}

/** สรุปผลนำเข้าเป็นข้อความไทยสำหรับแถบสถานะ */
export function importSummary(res) {
  if (!res) return 'นำเข้าไม่สำเร็จ';
  return `นำเข้า ${res.keys.length} คีย์ · ไทยเพิ่ม/แก้ ${res.thAdded + res.thChanged}`
       + ` · อังกฤษเพิ่ม/แก้ ${res.enAdded + res.enChanged}`
       + (res.skipped ? ` · ข้าม ${res.skipped} แถวที่ไม่มีคีย์` : '');
}
