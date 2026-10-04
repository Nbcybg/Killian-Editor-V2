// test/main-i18n-load.test.cjs — [alpha.168 · bug hunt 2] main.js ห้ามแปลข้อความ "ตอนโหลดไฟล์"
//
// ตารางคำแปลของ main ถูกโหลดใน app.whenReady() (loadLangTable) — อะไรที่เรียก tt()/ttf() ระดับบนสุดของไฟล์
// จึงได้ **ตัวคีย์** กลับมาแล้วค้างอย่างนั้นตลอดอายุโปรแกรม (เปลี่ยนภาษาก็ไม่เปลี่ยน)
// ของจริงที่หลุดมาตั้งแต่ alpha.77: ป้ายใน MENU_PANELS (เมนู มุมมอง → แผง · เมนู ส่งออก) = `ui.menu.projectExplorer`
// และชื่อชนิดไฟล์ใน SAVE_FILTERS (กล่องบันทึกของระบบ) = `ui.menu.imagePNG (*.png)`
// เมนู/กล่องของระบบเป็นจุดบอดของ e2e → ตรวจที่ซอร์สด้วย AST
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

const src = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });

const atLoad = [];
walk.ancestor(ast, {
  CallExpression(node, anc) {
    const n = node.callee.type === 'Identifier' ? node.callee.name : '';
    if (!['tt', 'ttf', 't', 'tf'].includes(n)) return;
    if (anc.some((a) => /Function/.test(a.type))) return;          // อยู่ในฟังก์ชัน/getter = แปลตอนใช้ ✔
    const arg = node.arguments[0];
    atLoad.push('บรรทัด ' + node.loc.start.line + ': ' + n + '(' + (arg && arg.type === 'Literal' ? arg.value : '…') + ')');
  },
  TaggedTemplateExpression(node, anc) {
    if (node.tag.type !== 'Identifier' || node.tag.name !== 'T') return;
    if (anc.some((a) => /Function/.test(a.type))) return;
    atLoad.push('บรรทัด ' + node.loc.start.line + ': T`…`');
  },
});
check('★ main.js ไม่มี tt()/ttf()/T`` ที่ถูกเรียกตอนโหลดไฟล์ (ได้คีย์ดิบค้างบนเมนู/กล่องของระบบ)', atLoad.length === 0, atLoad.join(' | '));

// ตารางสองตัวที่เคยหลุด — ป้ายต้องเป็นฟังก์ชัน/getter
const block = (name) => { const i = src.indexOf('const ' + name + ' = '); return i < 0 ? '' : src.slice(i, src.indexOf('\n};', i) > 0 && name !== 'MENU_PANELS' ? src.indexOf('\n};', i) : src.indexOf('\n];', i)); };
const mp = block('MENU_PANELS');
check('MENU_PANELS: หาบล็อกเจอ + มีป้ายแบบฟังก์ชัน', mp.length > 200 && /label: \(\) => tt\(/.test(mp));
check('★ MENU_PANELS: ไม่มี `label: tt(` (ต้องเป็น `label: () => tt(`)', !/label:\s*tt\(/.test(mp));
const sf = block('SAVE_FILTERS');
check('SAVE_FILTERS: หาบล็อกเจอ', sf.length > 200);
check('★ SAVE_FILTERS: ไม่มี `name: tt(` (ต้องเป็น getter)', !/name:\s*tt\(/.test(sf));
check('กล่องไฟล์ใช้ saveFilter() (วัตถุธรรมดา ชื่อแปล ณ ตอนเปิดกล่อง)', (src.match(/saveFilter\(SAVE_FILTERS/g) || []).length >= 2);
check("มีช่องส่องป้ายเมนูตัวจริงให้ e2e ('menu:labels')", src.includes("ipcMain.handle('menu:labels'"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
