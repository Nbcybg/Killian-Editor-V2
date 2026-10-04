// test/panel-exports.test.cjs — [alpha.167] เมนู "ส่งออก" (main.js) ตรงกับตาราง PANEL_EXPORTS (src/panel-exports.js)
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };
const grab = (file, name) => {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = src.match(new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\n\\]);'));
  return m ? Function('"use strict";return (' + m[1] + ')')() : null;
};
const a = grab('src/panel-exports.js', 'PANEL_EXPORTS');
const b = grab('main.js', 'PANEL_EXPORTS_MENU');
check('อ่านตารางทั้งสองได้', Array.isArray(a) && Array.isArray(b), String(!!a) + String(!!b));
check('★ เมนู ส่งออก ตรงกับ PANEL_EXPORTS ทุกแถว (แผง + รูปแบบ + ลำดับ)', JSON.stringify(a) === JSON.stringify(b));
const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const keys = (main.match(/const EXPORT_FMT_KEYS = \{([\s\S]*?)\};/) || [])[1] || '';
const fmts = new Set((a || []).flatMap((e) => e.fmts));
for (const f of fmts) check('รูปแบบ ' + f + ' มีป้ายในเมนู', new RegExp('\\b' + f + ":\\s*'ui\\.menu\\.").test(keys));
check('เมนู ส่งออก ใช้คำสั่ง export-panel ผ่าน cmd() (ได้คีย์ลัด/ทะเบียนคำสั่ง)', /cmd\('export-panel', e\.panel, f\)/.test(main));
check('handleCommand มี case export-panel', /case 'export-panel': await exportPanel\(a\[0\], a\[1\]\)/.test(fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8')));
// ทุกแผงในตารางต้องมีอยู่จริงใน PANEL_DEFS และในเมนูแผง (ป้ายชื่อมาจากที่นั่น)
const defs = fs.readFileSync(path.join(ROOT, 'src/panels/panel-ui.js'), 'utf8');
for (const e of a || []) {
  check('แผง ' + e.panel + ' มีในทะเบียนแผง', defs.includes("id: '" + e.panel + "'"));
  check('แผง ' + e.panel + ' มีในเมนูแผง (ป้ายชื่อ)', main.includes("{ id: '" + e.panel + "', label:"));
}
// ═══════════ [alpha.168 · bug hunt] Kanban CSV: ร่างหลักของแต่ละเล่ม · เรียงตามลำดับเรื่อง ═══════════
{
  const out = path.join(require('os').tmpdir(), '_kanbancsv.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/kanban/kanban-csv.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  const K = require(out);
  const secs = K.kanbanSections([
    { folder: 'Zeta', meta: { title: 'เล่ม 1', order: 1 } },
    { folder: 'Alpha', meta: { title: 'เล่ม 2', order: 2, primaryDraft: 'rewrite' } },
    { folder: 'NoOrder', meta: {} },
  ]);
  check('[bh] ★ เล่มเรียงตาม order ไม่ใช่ชื่อโฟลเดอร์', secs.map((x) => x.folder).join() === 'Zeta,Alpha,NoOrder', secs.map((x) => x.folder).join());
  check('[bh] ★ ใช้ร่างหลักของเล่ม (ไม่ระบุ = default)', secs[0].draft === 'default' && secs[1].draft === 'rewrite');
  check('[bh] ไม่มีชื่อ = ใช้ชื่อโฟลเดอร์', secs[2].title === 'NoOrder');
  const rows = K.kanbanRows([{ title: 'เล่ม 1', draft: { chapters: [{ guid: 'b', title: 'บทสอง', order: 2 }, { guid: 'a', title: 'บทหนึ่ง', order: 1 }] },
    scenes: { a: [{ title: 'ฉาก 2', order: 2, status: 'Draft' }, { title: 'ฉาก 1', order: 1, words: 40, storyDate: 'ปีที่ 3' }, { title: 'โน้ต', order: 3, type: 'memo' }], b: [{ title: 'ฉาก 3', order: 1 }] } }], (v) => '[' + v + ']');
  check('[bh] บท/ฉากเรียงตาม order · ไม่เอาโน้ต', rows.map((r) => r[2]).join() === 'ฉาก 1,ฉาก 2,ฉาก 3', rows.map((r) => r[2]).join());
  check('[bh] สถานะผ่านตัวแปลป้าย · คอลัมน์ครบ 6', rows[1][3] === '[Draft]' && rows[0][3] === '' && rows.every((r) => r.length === 6) && rows[0][5] === 40 && rows[0][4] === 'ปีที่ 3');
  const pe = fs.readFileSync(path.join(ROOT, 'src/panel-exports.js'), 'utf8');
  check('[bh] ★ exportKanbanCsv ไม่ไล่ทุกร่าง (ไม่มี listDirs ของโฟลเดอร์ Draft)', !/listDirs\(dr\)/.test(pe) && /kanbanSections\(secs\)/.test(pe));
  check('[bh] ★ ผังแตกสายส่งออกตามรูปแบบที่เลือก (ไม่ใช่แค่เปิดเมนูของแผง)', /exportBranchFmt\(fmt, outPath\)/.test(pe) && !/b\.click\(\);\s*return true;/.test(pe));
  check('[bh] Story Network PNG ผ่าน saveCanvasPng (ทางกลาง)', /saveCanvasPng\(net\.canvas/.test(pe));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
