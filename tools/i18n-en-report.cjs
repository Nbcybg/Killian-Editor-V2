#!/usr/bin/env node
// i18n-en-report.cjs — [alpha.162 · W7 ข้อ 6] ไฟล์ภาษาอังกฤษยังเป็นไทยอยู่กี่แถว · แยกตาม namespace
//
//   node tools/i18n-en-report.cjs            สรุป + namespace ที่ค้างมากสุด 25 อันดับ
//   node tools/i18n-en-report.cjs --all      ทุก namespace (ใช้วางแผนรอบแปล)
//   node tools/i18n-en-report.cjs --list ns  รายชื่อคีย์ที่ยังเป็นไทยใน namespace นั้น (เช่น ui.dash)
//
// ★ รายงานอย่างเดียว — รอบนี้ **ไม่แปล** (ตัดสินใจไว้แล้ว: แยกรอบแปลตาม namespace)
// ด่านห้ามถอย (จำนวนแถวไทยใน en ห้ามเพิ่ม) อยู่ที่ test/i18n-locale.test.cjs — คีย์ใหม่ต้องมีคำแปลอังกฤษจริง
const fs = require('fs');
const path = require('path');
const { lexCsv } = require('./csv-lite.cjs');
const ROOT = path.join(__dirname, '..');

const THAI = /[฀-๿]/;

function report() {
  const en = lexCsv(fs.readFileSync(path.join(ROOT, 'languages/k2_en.csv'), 'utf8'));
  const keys = Object.keys(en).filter((k) => !k.startsWith('meta.'));
  const thai = keys.filter((k) => THAI.test(String(en[k] || '')));
  const byNs = {};
  for (const k of keys) {
    const ns = k.split('.').slice(0, k.startsWith('ui.') ? 2 : 1).join('.');
    const r = byNs[ns] || (byNs[ns] = { ns, total: 0, thai: 0 });
    r.total++;
    if (THAI.test(String(en[k] || ''))) r.thai++;
  }
  return { total: keys.length, thai: thai.length, thaiKeys: thai, byNs: Object.values(byNs) };
}

if (require.main === module) {
  const r = report();
  const pct = r.total ? Math.round(((r.total - r.thai) / r.total) * 1000) / 10 : 100;
  console.log(`k2_en.csv: ${r.total} แถว · ยังเป็นไทย ${r.thai} · แปลแล้ว ${pct}%`);
  const argi = process.argv.indexOf('--list');
  if (argi > 0) {
    const ns = process.argv[argi + 1] || '';
    for (const k of r.thaiKeys) if (k === ns || k.startsWith(ns + '.')) console.log(k);
  } else {
    const rows = r.byNs.filter((x) => x.thai).sort((a, b) => b.thai - a.thai);
    for (const x of process.argv.includes('--all') ? rows : rows.slice(0, 25)) {
      console.log('  ' + String(x.thai).padStart(4) + ' / ' + String(x.total).padEnd(4) + ' ' + x.ns);
    }
    console.log(`namespace ที่ยังค้าง ${rows.length} จาก ${r.byNs.length}`);
  }
}
module.exports = { report };
