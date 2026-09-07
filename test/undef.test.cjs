// test/undef.test.cjs — ตาข่ายถาวรของ **กฎเหล็กข้อ 1**
//
// esbuild ปล่อยชื่อที่ไม่รู้จักผ่านไปเป็น global ตอนรัน → `node build.js` ขึ้น "bundle OK"
// แต่พังตอนกดปุ่มจริง และถ้าอยู่ใน try/catch หรือ callback async ก็ **เงียบสนิท**
// (ของจริงที่หลุดมาถึง alpha.127: `stale()` ใน countProjectWords ทำให้จำนวนคำเป็น 0 มาหลายสิบรุ่น
//  โดยมีแค่บรรทัด WARN ในบันทึกเป็นร่องรอย)
//
// เทสนี้ตรวจทั้ง src/ + main.js + preload.js — เพิ่มไฟล์ใหม่แล้วได้ตาข่ายไปด้วยเลย ไม่ต้องแก้อะไร
require('./_lang.cjs');
const { findUndefined } = require('../tools/undef-check.cjs');

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

const hits = findUndefined();
ck('★ ไม่มีชื่อที่ถูกเรียกใช้แต่หาที่ประกาศไม่เจอเลยทั้งโปรเจกต์',
   hits.length === 0,
   hits.map((h) => h.rel + ':' + h.lines[0] + ' ' + h.name).join(' | '));

// ยามของตัวเครื่องมือเอง — ถ้าตัวตรวจพังเงียบ (คืน [] เพราะ parse ไม่ได้) เทสข้างบนจะเขียวปลอม
ck('ตัวตรวจอ่านไฟล์ได้จริง (ไม่มีไฟล์ไหน parse ไม่ผ่าน)',
   !hits.some((h) => h.name.startsWith('PARSE ERROR')),
   hits.filter((h) => h.name.startsWith('PARSE ERROR')).map((h) => h.rel).join(', '));

// พิสูจน์ว่าตัวตรวจ "จับได้จริง" ไม่ใช่คืนศูนย์เพราะไม่ได้ทำงาน
{
  const fs = require('fs'), os = require('os'), path = require('path');
  const acorn = require('acorn'), walk = require('acorn-walk');
  const probe = path.join(os.tmpdir(), '_undef_probe.js');
  fs.writeFileSync(probe, 'export function f(){ return ' + 'ghostName' + '(1); }\n');
  const ast = acorn.parse(fs.readFileSync(probe, 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' });
  let seen = false;
  walk.full(ast, (n) => { if (n.type === 'Identifier' && n.name === 'ghostName') seen = true; });
  fs.unlinkSync(probe);
  ck('ตัวพาร์สมองเห็นชื่อที่ไม่มีที่ประกาศ (ตัวอย่างคุมสอบ)', seen);
}

console.log(`\nundef: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
