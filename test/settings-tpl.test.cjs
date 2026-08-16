// test/settings-tpl.test.cjs — [alpha.79] โครง HTML ของกล่องตั้งค่าอยู่ในไฟล์ภาษา (คีย์เดียว)
//
// **ทำไมต้องมีเทสนี้**: รอบ .79 แก้โครงกล่องตั้งค่าด้วยสคริปต์ แล้ว regex จับขอบผิดไปหนึ่งตัว
// → หน้า "ทั่วไป" กับ "การเขียน" **หายไปทั้งหน้า** โดยไม่มีอะไรฟ้อง จนไปพังตอน e2e
// (`Cannot set properties of null`) · เทสนี้จับได้ทันทีตั้งแต่ยังไม่ build
//
// ตรวจ: ทุก `#st-*` ที่ dialogs.js อ้าง ต้องมีอยู่ในเทมเพลต · แท็บกับหน้าต้องจับคู่ครบ ·
// ที่แทรกค่า {0}..{n} ต้องอยู่ครบตามจำนวนที่โค้ดส่งเข้ามา
const fs = require('fs');
const path = require('path');
const { lexCsv } = require('../tools/csv-lite.cjs');

const ROOT = path.join(__dirname, '..');
const KEY = 'ui.dlg.alphaItemLevelUser';
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const langDir = path.join(ROOT, 'languages');
const files = fs.readdirSync(langDir).filter((f) => /^k2_.+\.csv$/.test(f));
const src = fs.readFileSync(path.join(ROOT, 'src', 'dialogs.js'), 'utf8');

// id ที่โค้ดอ้างจริง — q('#st-xxx') / box.querySelector('#st-xxx')
// (`'#st-mg-' + side` เป็นชื่อที่ต่อขึ้นตอนรัน → ใส่ตัวจริงทั้งสี่ให้แทน)
const wanted = new Set(['st-mg-top', 'st-mg-bottom', 'st-mg-left', 'st-mg-right']);
for (const m of src.matchAll(/['"]#(st-[\w-]+)['"]/g)) {
  if (!m[1].endsWith('-')) wanted.add(m[1]);     // ตัดชื่อที่เป็นแค่คำนำหน้าของ id ที่ต่อเอง
}
check('dialogs.js อ้าง #st-* อย่างน้อย 60 ตัว', wanted.size >= 60, wanted.size);

for (const f of files) {
  const tbl = lexCsv(fs.readFileSync(path.join(langDir, f), 'utf8'));
  const tpl = tbl[KEY];
  check(`${f}: มีเทมเพลตกล่องตั้งค่า`, !!tpl);
  if (!tpl) continue;

  const ids = new Set([...tpl.matchAll(/id="(st-[\w-]+)"/g)].map((m) => m[1]));
  const missing = [...wanted].filter((id) => !ids.has(id));
  check(`${f}: เทมเพลตมีทุกช่องที่โค้ดอ้าง`, missing.length === 0, missing.join(' · '));

  const tabs = [...tpl.matchAll(/class="k-set-tab[^"]*"\s+data-p="(\w+)"/g)].map((m) => m[1]);
  const pages = [...tpl.matchAll(/class="k-set-page[^"]*"\s+data-p="(\w+)"/g)].map((m) => m[1]);
  check(`${f}: มีหัวข้ออย่างน้อย 13 หัวข้อ`, tabs.length >= 13, tabs.length);
  check(`${f}: ทุกหัวข้อมีหน้าเนื้อหาคู่กัน`,
        tabs.every((x) => pages.includes(x)), tabs.filter((x) => !pages.includes(x)).join(' · '));
  check(`${f}: ทุกหน้าเนื้อหามีหัวข้อคู่กัน (ไม่มีหน้ากำพร้า)`,
        pages.every((x) => tabs.includes(x)), pages.filter((x) => !tabs.includes(x)).join(' · '));
  check(`${f}: ไม่มี data-p ซ้ำในหัวข้อ`, new Set(tabs).size === tabs.length);
  check(`${f}: มีหน้าที่เปิดอยู่ตอนแรกหน้าเดียว`,
        (tpl.match(/class="k-set-page[^"]*\bon"/g) || []).length === 1,
        (tpl.match(/class="k-set-page[^"]*\bon"/g) || []).join(' · '));

  // ที่แทรกค่า: โค้ดส่ง 44 ค่าเข้า tf() → {0}..{43} ต้องอยู่ครบ ไม่ขาดไม่เกิน
  const slots = new Set([...tpl.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]));
  const missSlot = [];
  for (let i = 0; i < 44; i++) if (!slots.has(i)) missSlot.push(i);
  check(`${f}: ที่แทรกค่า {0}..{43} ครบ`, missSlot.length === 0, missSlot.join(','));
  check(`${f}: ไม่มีที่แทรกค่าเกิน {43}`, [...slots].every((n) => n < 44),
        [...slots].filter((n) => n >= 44).join(','));

  // โครงใหม่: รายการอยู่ซ้าย ไม่ใช่แท็บบนหัว
  check(`${f}: ใช้โครงรายการด้านซ้าย (k-set-nav)`, tpl.includes('k-set-nav') && tpl.includes('k-set-main'));
  check(`${f}: ไม่เหลือโครงแท็บบนหัวแบบเก่า`, !tpl.includes('k-set-tabs'));
  check(`${f}: มีหัวกลุ่มอย่างน้อย 2 กลุ่ม`,
        (tpl.match(/k-set-navgrp"/g) || []).length >= 2);
  check(`${f}: มีช่องค้นหาหัวข้อ`, tpl.includes('id="st-nav-q"'));
  check(`${f}: มีที่วางรายการปุ่มแถบเครื่องมือ`, tpl.includes('id="st-toolbar-host"'));

  // แท็ก div ต้องปิดครบ (โครงที่ปิดไม่ครบทำให้ปุ่มตกลง/ยกเลิกหลุดออกนอกกล่อง)
  const open = (tpl.match(/<div\b/g) || []).length;
  const close = (tpl.match(/<\/div>/g) || []).length;
  check(`${f}: แท็ก <div> เปิด-ปิดครบคู่`, open === close, open + ' เปิด / ' + close + ' ปิด');
}

console.log(`\nsettings-tpl: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
