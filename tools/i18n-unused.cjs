#!/usr/bin/env node
// i18n-unused.cjs — [alpha.162 · W6 ข้อ 8] รายงานคีย์ภาษาที่ "อาจไม่มีใครใช้" · **รายงานอย่างเดียว ห้ามลบยกชุด**
//
//   node tools/i18n-unused.cjs            สรุปตัวเลข + ตัวอย่าง
//   node tools/i18n-unused.cjs --list     รายชื่อทั้งหมดที่ไม่พบการอ้าง
//
// ทำไมห้ามลบยกชุดตามรายงานนี้: คีย์จำนวนมากถูก **ประกอบตอนรัน** (`'ui.treeMenu.' + id` ·
// `t('branch.' + key)` · `'ui.tip.' + commandId` · ชื่อธีม/สถานะจากข้อมูล) ซึ่งการค้นข้อความหาไม่เจอ
// ตัวนี้จึงแยกสามกอง: อ้างตรง ๆ · อาจถูกประกอบ (ขึ้นต้นด้วย prefix ที่โค้ดต่อสตริงอยู่) · ไม่พบเลย
// กองสุดท้ายต้องให้คนดูทีละก้อน (ตาม namespace) ก่อนตัดสินใจ — หรือตรวจแบบรันจริง
const fs = require('fs');
const path = require('path');
const { lexCsv } = require('./csv-lite.cjs');
const ROOT = path.join(__dirname, '..');

function allKeys() {
  return Object.keys(lexCsv(fs.readFileSync(path.join(ROOT, 'languages/k2_th.csv'), 'utf8')));
}

function sources() {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'generated'].includes(e.name)) walk(p); }
    else if (/\.(js|cjs|mjs)$/.test(e.name) && e.name !== 'selftest.js') out.push(p);
  } };
  walk(path.join(ROOT, 'src'));
  for (const f of ['main.js', 'preload.js', 'renderer/index.html', 'src/generated/commands-data.js', 'src/generated/themes-data.js']) {
    const p = path.join(ROOT, f); if (fs.existsSync(p)) out.push(p);
  }
  return out.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
}

/** ค่าที่มีรูปคีย์ในโค้ด (ในเครื่องหมายคำพูด) + prefix ที่ถูกต่อสตริง ('x.y.' + …) */
function scan(src) {
  const lits = new Set();
  for (const m of src.matchAll(/['"`]((?:ui\.)?[a-zA-Z][\w-]*(?:\.[\w-]+)+)['"`]/g)) lits.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) lits.add(m[1]);
  const prefixes = new Set();
  for (const m of src.matchAll(/['"`]((?:ui\.)?[a-zA-Z][\w-]*(?:\.[\w-]+)*\.)['"`]\s*\+/g)) prefixes.add(m[1]);
  for (const m of src.matchAll(/`((?:ui\.)?[a-zA-Z][\w-]*(?:\.[\w-]+)*\.)\$\{/g)) prefixes.add(m[1]);
  return { lits, prefixes };
}

function report() {
  const keys = allKeys();
  const { lits, prefixes } = scan(sources());
  // prefix กว้างเกิน ('ui.' + อะไรก็ได้ — ตัว lookup เอง) ไม่นับ ไม่งั้นทุกคีย์ "อาจถูกใช้" หมด
  const pre = [...prefixes].flatMap((p) => [p, p.startsWith('ui.') ? p.slice(3) : 'ui.' + p])
    .filter((p) => p.startsWith('ui.') ? p.split('.').length >= 3 : p.split('.').length >= 2);
  const direct = [], dyn = [], none = [];
  for (const k of keys) {
    const short = k.startsWith('ui.') ? k.slice(3) : k;
    if (lits.has(k) || lits.has(short)) direct.push(k);
    else if (pre.some((p) => k.startsWith(p))) dyn.push(k);
    else none.push(k);
  }
  const byNs = {};
  for (const k of none) { const ns = k.split('.').slice(0, 2).join('.'); byNs[ns] = (byNs[ns] || 0) + 1; }
  return { total: keys.length, direct: direct.length, dynamic: dyn.length, none, byNs };
}

if (require.main === module) {
  const r = report();
  console.log(`คีย์ทั้งหมด ${r.total} · อ้างตรง ${r.direct} · อาจถูกประกอบตอนรัน ${r.dynamic} · ไม่พบการอ้าง ${r.none.length}`);
  console.log('namespace ที่ไม่พบการอ้างมากที่สุด:');
  for (const [ns, n] of Object.entries(r.byNs).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ' + String(n).padStart(4) + '  ' + ns);
  if (process.argv.includes('--list')) for (const k of r.none) console.log(k);
}
module.exports = { report };
