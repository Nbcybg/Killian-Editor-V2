#!/usr/bin/env node
// i18n-defallback.cjs — ถอด "ค่าสำรองภาษาไทย" ที่ยังติดอยู่ในโค้ด (alpha.77)
//
//   t('panel.jumped', 'กระโดดไปแล้ว')   →   t('ui.panel.jumped')
//
// ตั้งแต่ alpha.77 แอปไม่มีการตกกลับ — ข้อความต้องอยู่ในไฟล์ภาษาเท่านั้น
// สคริปต์นี้จึงย้ายข้อความไทยที่ยังเป็นอาร์กิวเมนต์ที่สอง เข้าไฟล์ภาษาให้เรียบร้อยแล้วตัดทิ้ง
//   · คีย์มีอยู่ใน CSV แล้ว → **CSV ชนะ** (ค่าที่ผู้ใช้แปลไว้สำคัญกว่าค่าสำรองในโค้ด)
//   · ยังไม่มี → เพิ่มแถวใหม่ด้วยข้อความไทยนั้น (ทุกไฟล์ภาษา ตามกฎ "ต้องครบทุกแถว")

const fs = require('fs');
const path = require('path');
const { lexCsv } = require('./csv-lite.cjs');
const { SKIP_FILES } = require('./i18n-classify.cjs');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const THAI = /[฀-๿]/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const langDir = path.join(ROOT, 'languages');
const langFiles = fs.readdirSync(langDir).filter((f) => /^k2_[A-Za-z-]+\.csv$/.test(f));
const tables = {};
for (const f of langFiles) tables[f] = lexCsv(fs.readFileSync(path.join(langDir, f), 'utf8'));
const th = tables['k2_th.csv'];

// `t('คีย์', 'ข้อความไทย')` — จับเฉพาะที่อาร์กิวเมนต์สองเป็นสตริงเดี่ยว ๆ (ไม่ใช่นิพจน์)
const CALL = /(^|[^A-Za-z0-9_$.])(t|tKey)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g;

const added = {};
let changed = 0, files = 0;
for (const abs of walk(path.join(ROOT, 'src')).concat([path.join(ROOT, 'main.js')])) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = fs.readFileSync(abs, 'utf8');
  let n = 0;
  const out = src.replace(CALL, (m, pre, fn, key, fb) => {
    if (!THAI.test(fb)) return m;                                  // ค่าสำรองไม่ใช่ไทย ปล่อยไว้
    const full = key.startsWith('ui.') ? key : 'ui.' + key;
    const text = fb.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    if (!th[full]) { added[full] = text; }
    n++;
    return `${pre}t('${full}')`;
  });
  if (!n) continue;
  changed += n; files++;
  if (APPLY) fs.writeFileSync(abs, out, 'utf8');
}

console.log('ถอดค่าสำรอง', changed, 'จุด ใน', files, 'ไฟล์', APPLY ? '' : '(ลองดูเฉย ๆ)');
console.log('คีย์ที่ต้องเพิ่มเข้าไฟล์ภาษา:', Object.keys(added).length);
for (const k of Object.keys(added).slice(0, 8)) console.log('   +', k, '=', added[k]);

if (APPLY && Object.keys(added).length) {
  const cell = (v) => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  for (const f of langFiles) {
    const tbl = tables[f];
    for (const k of Object.keys(added)) if (!tbl[k]) tbl[k] = added[k];   // ภาษาที่ยังไม่แปล = ใส่ไทยไปก่อน
    const meta = ['meta.code', 'meta.name', 'meta.nativeName', 'meta.version', 'meta.author'];
    const rows = meta.filter((k) => tbl[k]).map((k) => [k, tbl[k]]);
    for (const k of Object.keys(tbl).sort()) if (!k.startsWith('meta.')) rows.push([k, tbl[k]]);
    fs.writeFileSync(path.join(langDir, f),
      '﻿' + rows.map((r) => cell(r[0]) + ',' + cell(r[1])).join('\r\n') + '\r\n', 'utf8');
    console.log('   เขียน', f, rows.length, 'แถว');
  }
}
