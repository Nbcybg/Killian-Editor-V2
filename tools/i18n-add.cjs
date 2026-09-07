#!/usr/bin/env node
// i18n-add.cjs — เพิ่มคีย์ภาษาใหม่ลง `languages/k2_*.csv` **ทุกไฟล์พร้อมกัน**
//
//   node tools/i18n-add.cjs <ไฟล์.json>
//
// รูปแบบไฟล์อินพุต: `{ "ui.x.y": { "th": "ข้อความไทย", "en": "English" }, ... }`
//   · ภาษาไหนไม่ได้ระบุ → ใช้ค่า `th` ไปก่อน (กฎข้อ 0: ห้ามเว้นว่าง ไม่มีการตกกลับในแอป)
//   · คีย์ที่มีอยู่แล้ว → **ไม่ทับ** (ของที่แปลไปแล้วต้องไม่ถูกเขียนทับ)
//   · แทรกในตำแหน่งที่เรียงตามคีย์ เพื่อให้ diff อ่านง่าย
//
// เขียนเองด้วยมือก็ได้ แต่ตัวนี้กัน 3 อย่างที่พลาดบ่อย: ลืมไฟล์ใดไฟล์หนึ่ง · ลืม BOM · ลืมใส่ quote

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csv-lite.cjs');

const ROOT = path.join(__dirname, '..');
const LANG_DIR = path.join(ROOT, 'languages');

/** ค่าที่ต้องใส่เครื่องหมายคำพูด */
function cell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function addToFile(file, code, entries) {
  const abs = path.join(LANG_DIR, file);
  const raw = fs.readFileSync(abs, 'utf8');
  const hadBom = raw.charCodeAt(0) === 0xFEFF;
  const rows = parseCsv(raw);
  const have = new Set(rows.map((r) => String(r[0] || '')));

  const add = [];
  for (const key of Object.keys(entries)) {
    if (have.has(key)) continue;
    const e = entries[key];
    const th = typeof e === 'string' ? e : (e && e.th) || '';
    const val = (typeof e === 'object' && e && e[code]) || th;
    if (!val) throw new Error('คีย์ ' + key + ' ไม่มีข้อความ (ห้ามเว้นว่าง)');
    add.push([key, val]);
  }
  if (!add.length) return 0;

  const merged = rows.concat(add);
  // เรียงเฉพาะแถว ui.* — แถว meta.* คงลำดับเดิมไว้บนสุด
  const meta = merged.filter((r) => !String(r[0] || '').startsWith('ui.'));
  const ui = merged.filter((r) => String(r[0] || '').startsWith('ui.'))
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
  const text = [...meta, ...ui].map((r) => r.map(cell).join(',')).join('\n') + '\n';
  fs.writeFileSync(abs, (hadBom ? '﻿' : '') + text, 'utf8');
  return add.length;
}

function main() {
  const input = process.argv[2];
  if (!input) { console.error('ใช้: node tools/i18n-add.cjs <ไฟล์.json>'); process.exit(2); }
  const entries = JSON.parse(fs.readFileSync(input, 'utf8'));
  const files = fs.readdirSync(LANG_DIR).filter((f) => /^k2_([A-Za-z-]+)\.csv$/.test(f));
  if (!files.length) { console.error('ไม่พบไฟล์ภาษา'); process.exit(2); }
  for (const f of files) {
    const code = /^k2_([A-Za-z-]+)\.csv$/.exec(f)[1];
    const n = addToFile(f, code, entries);
    console.log(`${f}: +${n}`);
  }
}

if (require.main === module) main();
module.exports = { addToFile, cell };
