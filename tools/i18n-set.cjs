#!/usr/bin/env node
// i18n-set.cjs — ตั้ง/แก้ข้อความของคีย์ภาษาใน `languages/k2_*.csv` **ทุกไฟล์พร้อมกัน** (alpha.170)
//
//   node tools/i18n-set.cjs <ไฟล์.json> [--dry]
//
// ต่างจาก i18n-add.cjs ตรงที่ **ทับค่าเดิมได้** — ใช้ตอนแก้ถ้อยคำของคีย์ที่มีอยู่แล้ว
// (i18n-add ไม่ทับของเดิมโดยเจตนา: กันคำแปลที่คนแก้ไว้ถูกเขียนทับตอนเพิ่มคีย์ใหม่)
//
// รูปแบบไฟล์อินพุต: `{ "ui.x.y": { "th": "…", "en": "…", "de": "…", … }, "ui.gone.key": null }`
//   · ภาษาไหนไม่ได้ระบุ → คีย์ใหม่ใช้ค่า `th` ไปก่อน · คีย์เดิม **คงค่าเดิมของภาษานั้นไว้**
//   · ค่า null = ลบคีย์นั้นออกจากทุกไฟล์
//   · เรียงแถว ui.* ตามคีย์เหมือน i18n-add (diff อ่านง่าย)

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csv-lite.cjs');

const ROOT = path.join(__dirname, '..');
const LANG_DIR = path.join(ROOT, 'languages');
const BOM = String.fromCharCode(0xFEFF);

function cell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeRetry(abs, text) {
  for (let i = 0; ; i++) {
    try { fs.writeFileSync(abs, text, 'utf8'); return; }
    catch (e) { if (i >= 5) throw e; const t = Date.now() + 250; while (Date.now() < t) { /* รอตัวล็อกไฟล์ */ } }
  }
}

function setInFile(file, code, entries, dry) {
  const abs = path.join(LANG_DIR, file);
  const raw = fs.readFileSync(abs, 'utf8');
  const hadBom = raw.charCodeAt(0) === 0xFEFF;
  let rows = parseCsv(raw);
  const at = new Map(rows.map((r, i) => [String(r[0] || ''), i]));
  let added = 0, changed = 0, removed = 0;
  const drop = new Set();
  for (const key of Object.keys(entries)) {
    const e = entries[key];
    if (e === null) { if (at.has(key)) { drop.add(key); removed++; } continue; }
    const th = typeof e === 'string' ? e : (e && e.th) || '';
    const own = typeof e === 'object' && e ? e[code] : (code === 'th' ? e : undefined);
    if (at.has(key)) {
      if (own === undefined || own === null || own === '') continue;      // ไม่ได้ระบุภาษานี้ → คงเดิม
      const row = rows[at.get(key)];
      if (String(row[1]) !== String(own)) { row[1] = own; changed++; }
    } else {
      const val = own || th;
      if (!val) throw new Error('คีย์ ' + key + ' ไม่มีข้อความ (ห้ามเว้นว่าง)');
      rows.push([key, val]); added++;
    }
  }
  if (!(added || changed || removed)) return { added, changed, removed };
  rows = rows.filter((r) => !drop.has(String(r[0] || '')));
  const meta = rows.filter((r) => !String(r[0] || '').startsWith('ui.'));
  const ui = rows.filter((r) => String(r[0] || '').startsWith('ui.'))
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
  const text = [...meta, ...ui].map((r) => r.map(cell).join(',')).join('\n') + '\n';
  if (!dry) writeRetry(abs, (hadBom ? BOM : '') + text);
  return { added, changed, removed };
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const input = args.find((a) => !a.startsWith('--'));
  if (!input) { console.error('ใช้: node tools/i18n-set.cjs <ไฟล์.json> [--dry]'); process.exit(2); }
  const entries = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^﻿/, ''));
  const files = fs.readdirSync(LANG_DIR).filter((f) => /^k2_([A-Za-z-]+)\.csv$/.test(f));
  if (!files.length) { console.error('ไม่พบไฟล์ภาษา'); process.exit(2); }
  for (const f of files) {
    const code = /^k2_([A-Za-z-]+)\.csv$/.exec(f)[1];
    const n = setInFile(f, code, entries, dry);
    console.log(`${f}: +${n.added} ~${n.changed} -${n.removed}${dry ? ' (dry)' : ''}`);
  }
}

if (require.main === module) main();
module.exports = { setInFile, cell };
