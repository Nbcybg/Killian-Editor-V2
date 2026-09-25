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
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
