// test/i18n-csv.test.cjs — unit test ตัวแปลงไฟล์ภาษา ↔ CSV (alpha.60r3 · ข้อ 4)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-i18ncsv-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'i18n-csv.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── flatten / unflatten ─────────
const nested = { ui: { app: { title: 'คิเลียน', ready: 'พร้อม' }, panel: { project: 'โปรเจกต์' } } };
const flat = S.flatten(nested);
check('flatten ได้ dot-path', flat['ui.app.title'] === 'คิเลียน', JSON.stringify(flat));
check('flatten ลงลึกหลายชั้น', flat['ui.panel.project'] === 'โปรเจกต์');
check('flatten ได้ครบทุกคีย์', Object.keys(flat).length === 3, Object.keys(flat).length);
check('flatten แปลงตัวเลขเป็นสตริง', S.flatten({ meta: { version: 3 } })['meta.version'] === '3');
check('flatten ข้ามอาร์เรย์ (ไม่ลงไปแตกเป็น .0 .1)',
  Object.keys(S.flatten({ a: [1, 2] })).length === 0);
check('flatten รับ null ได้', Object.keys(S.flatten(null)).length === 0);

const back = S.unflatten(flat);
check('unflatten คืนโครงเดิมเป๊ะ', JSON.stringify(back) === JSON.stringify(nested), JSON.stringify(back));
check('unflatten คีย์ชั้นเดียวได้', S.unflatten({ a: 'x' }).a === 'x');
check('unflatten ข้ามคีย์ว่าง', Object.keys(S.unflatten({ '': 'x' })).length === 0);
check('unflatten คีย์ที่ชนกัน — ระดับลึกชนะ',
  S.unflatten({ a: 'x', 'a.b': 'y' }).a.b === 'y');
check('flatten → unflatten → flatten คงที่ (round-trip)',
  JSON.stringify(S.flatten(S.unflatten(flat))) === JSON.stringify(flat));

// ───────── csvCell (escape) ─────────
check('csvCell ข้อความธรรมดาไม่ครอบ quote', S.csvCell('hello') === 'hello');
check('csvCell คอมมาในข้อความไทยถูกครอบ quote',
  S.csvCell('สั้น, ปานกลาง') === '"สั้น, ปานกลาง"', S.csvCell('สั้น, ปานกลาง'));
check('csvCell quote ข้างในกลายเป็น ""',
  S.csvCell('เขาพูดว่า "ไป"') === '"เขาพูดว่า ""ไป"""', S.csvCell('เขาพูดว่า "ไป"'));
check('csvCell ขึ้นบรรทัดใหม่ถูกครอบ quote', S.csvCell('a\nb') === '"a\nb"');
check('csvCell null → ว่าง', S.csvCell(null) === '');
check('csvCell 0 → "0" ไม่ใช่ว่าง (กฎ 20)', S.csvCell(0) === '0');

// ───────── jsonToCsv ─────────
const th = { ui: { app: { title: 'คิเลียน' }, hint: 'สั้น, ปานกลาง' } };
const en = { ui: { app: { title: 'Killian' }, hint: 'short, medium' } };
const csv = S.jsonToCsv(th, en);
check('CSV เริ่มด้วย BOM (Excel บน Windows ถึงจะอ่านไทยถูก)', csv.charCodeAt(0) === 0xfeff);
check('มีหัวตาราง key,th,en', csv.replace(/^﻿/, '').split(/\r?\n/)[0] === 'key,th,en');
check('CSV มีคีย์ทั้งสองแถว', csv.includes('ui.app.title') && csv.includes('ui.hint'));
check('CSV เรียงคีย์ A→Z',
  csv.indexOf('ui.app.title') < csv.indexOf('ui.hint'));
check('ค่าที่มีคอมมาถูกครอบ quote ใน CSV', csv.includes('"สั้น, ปานกลาง"'));
check('jsonToCsv ปิด BOM ได้', S.jsonToCsv(th, en, { bom: false }).charCodeAt(0) !== 0xfeff);
check('jsonToCsv รับภาษาเดียวได้ (en เว้นว่าง)',
  S.jsonToCsv(th).includes('ui.app.title,คิเลียน,'));

// คีย์ที่มีเฉพาะฝั่ง en ต้องยังโผล่ในตาราง
const onlyEn = S.jsonToCsv({}, { solo: 'only-en' });
check('คีย์ที่มีเฉพาะ en ยังอยู่ในตาราง', onlyEn.includes('solo,,only-en'), onlyEn);

// ───────── parseCsv ─────────
check('parseCsv แถวธรรมดา',
  JSON.stringify(S.parseCsv('a,b,c')) === JSON.stringify([['a', 'b', 'c']]));
check('parseCsv หลายแถว (LF)', S.parseCsv('a,b\nc,d').length === 2);
check('parseCsv หลายแถว (CRLF ของ Excel)', S.parseCsv('a,b\r\nc,d').length === 2);
check('parseCsv ไม่ได้แถวว่างเกินตอนจบด้วย newline', S.parseCsv('a,b\n').length === 1);
check('parseCsv quoted field ที่มีคอมมา',
  S.parseCsv('k,"x, y",z')[0][1] === 'x, y', JSON.stringify(S.parseCsv('k,"x, y",z')));
check('parseCsv "" ข้างใน quoted field',
  S.parseCsv('k,"เขาพูดว่า ""ไป""",z')[0][1] === 'เขาพูดว่า "ไป"');
check('parseCsv ขึ้นบรรทัดใหม่ข้างใน quoted field',
  S.parseCsv('k,"a\nb"')[0][1] === 'a\nb' && S.parseCsv('k,"a\nb"').length === 1);
check('parseCsv ตัด BOM ทิ้ง', S.parseCsv('﻿key,th,en')[0][0] === 'key');
check('parseCsv ช่องว่างล้วนคืนสตริงว่าง', S.parseCsv('a,,c')[0][1] === '');

// ───────── csvToJson ─────────
const rt = S.csvToJson(csv);
check('round-trip: ไทยกลับมาเหมือนเดิม',
  JSON.stringify(rt.th) === JSON.stringify(th), JSON.stringify(rt.th));
check('round-trip: อังกฤษกลับมาเหมือนเดิม', JSON.stringify(rt.en) === JSON.stringify(en));
check('round-trip: คอมมาในค่าไม่หาย', rt.th.ui.hint === 'สั้น, ปานกลาง');
check('csvToJson นับคีย์ถูก', rt.keys.length === 2, rt.keys.length);
check('csvToJson ไม่มีแถวที่ถูกข้าม', rt.skipped === 0);

check('csvToJson รับหัวตารางสลับลำดับได้',
  S.csvToJson('en,key,th\nHello,greet,สวัสดี').th.greet === 'สวัสดี');
check('csvToJson รับหัวตารางชื่อยาว (th_value/en_value)',
  S.csvToJson('key,th_value,en_value\ngreet,สวัสดี,Hello').en.greet === 'Hello');
check('csvToJson ไม่มีหัวตาราง → ถือว่าเรียง key,th,en',
  S.csvToJson('greet,สวัสดี,Hello').th.greet === 'สวัสดี');
check('csvToJson นับแถวที่ไม่มีคีย์เป็น skipped',
  S.csvToJson('key,th,en\n,ว่าง,empty\ngreet,สวัสดี,Hello').skipped === 1);
check('csvToJson ค่าว่างไม่เขียนทับ (ไม่มีคีย์ในผลลัพธ์)',
  S.csvToJson('key,th,en\ngreet,,Hello').th.greet === undefined);
check('csvToJson ไฟล์ว่าง → ไม่ throw',
  S.csvToJson('').keys.length === 0);
check('csvToJson ไฟล์ที่มีแต่หัวตาราง → 0 คีย์', S.csvToJson('key,th,en\n').keys.length === 0);

// ───────── mergeStrings ─────────
const base = { ui: { a: 'เก่า', b: 'คงเดิม' } };
const patch = { ui: { a: 'ใหม่', c: 'เพิ่ม' } };
const m = S.mergeStrings(base, patch);
check('merge: ค่าที่แก้ถูกทับ', m.merged.ui.a === 'ใหม่');
check('merge: คีย์ที่ไม่มีใน patch ไม่หาย (สำคัญที่สุด)', m.merged.ui.b === 'คงเดิม');
check('merge: คีย์ใหม่ถูกเพิ่ม', m.merged.ui.c === 'เพิ่ม');
check('merge: นับ added ถูก', m.added === 1, m.added);
check('merge: นับ changed ถูก', m.changed === 1, m.changed);
check('merge: patch ว่าง → ไม่เปลี่ยนอะไร',
  JSON.stringify(S.mergeStrings(base, {}).merged) === JSON.stringify(base));
check('merge: ค่าเท่าเดิมไม่นับเป็น changed',
  S.mergeStrings(base, { ui: { b: 'คงเดิม' } }).changed === 0);
check('merge: ไม่แก้ object เดิมของผู้เรียก', base.ui.a === 'เก่า');

// ───────── importSummary ─────────
const sum = S.importSummary({ keys: ['a', 'b'], skipped: 1, thAdded: 1, thChanged: 1, enAdded: 0, enChanged: 2 });
check('importSummary บอกจำนวนคีย์', sum.includes('2'));
check('importSummary บอกจำนวนแถวที่ข้าม', sum.includes('ข้าม 1'));
check('importSummary รับ null ได้', typeof S.importSummary(null) === 'string');

// ───────── ทดสอบกับไฟล์ภาษาจริงของโปรเจกต์ (round-trip ปิดวง) ─────────
//
// [alpha.79 · แก้เทสที่พังมาตั้งแต่ .76] เดิมอ่าน `languages/th.json` + `en.json`
// ซึ่ง **ถูกลบไปตั้งแต่รอบ .76** (ย้ายไป CSV) → เทสนี้ throw ตั้งแต่บรรทัดแรก
// ทำให้ `npm run test:unit` หยุดกลางทางและไฟล์เทสที่เหลือไม่ได้รันเลย
// ตอนนี้ round-trip กับ **ไฟล์ CSV จริง** แทน — ซึ่งเป็นแหล่งความจริงเดียวของระบบภาษาแล้ว
const fs = require('fs');
const langDir = path.join(__dirname, '..', 'languages');
const { lexCsv } = require('../tools/csv-lite.cjs');
const thTbl = lexCsv(fs.readFileSync(path.join(langDir, 'k2_th.csv'), 'utf8'));
const enTbl = lexCsv(fs.readFileSync(path.join(langDir, 'k2_en.csv'), 'utf8'));
check('ไฟล์ภาษาจริงมีคีย์เกิน 3,000 รายการ', Object.keys(thTbl).length > 3000,
  Object.keys(thTbl).length);
check('ไฟล์ไทย/อังกฤษมีจำนวนคีย์เท่ากัน',
  Object.keys(thTbl).length === Object.keys(enTbl).length,
  Object.keys(thTbl).length + ' vs ' + Object.keys(enTbl).length);
// jsonToCsv/csvToJson ยังใช้กับ "ส่งออก/นำเข้าตารางแปล" อยู่ → round-trip ต้องปิดวงกับของจริง
const realTree = {};
for (const k of Object.keys(thTbl)) {
  const parts = k.split('.');
  let cur = realTree;
  for (let i = 0; i < parts.length - 1; i++) cur = (cur[parts[i]] = cur[parts[i]] || {});
  cur[parts[parts.length - 1]] = thTbl[k];
}
const realCsv = S.jsonToCsv(realTree, realTree);
const realBack = S.csvToJson(realCsv);
const flatThReal = S.flatten(realTree);
const flatBack = S.flatten(realBack.th);
check('ไฟล์ภาษาจริง: จำนวนคีย์เท่าเดิมหลัง round-trip',
  Object.keys(flatBack).length === Object.keys(flatThReal).length,
  Object.keys(flatBack).length + ' vs ' + Object.keys(flatThReal).length);
let diff = 0;
for (const k of Object.keys(flatThReal)) if (flatBack[k] !== flatThReal[k]) diff++;
check('ไฟล์ภาษาจริง: ทุกค่าตรงกันหลัง round-trip', diff === 0, diff + ' ค่าเพี้ยน');
check('CSV ของไฟล์จริงมีคีย์เกิน 300 รายการ (ครอบคลุมทั้งแอป)',
  realBack.keys.length > 300, realBack.keys.length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
