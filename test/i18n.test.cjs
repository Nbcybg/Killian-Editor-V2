// test/i18n.test.cjs — unit test เอนจินภาษา (alpha.76)
//   · รหัสภาษาอ่านจาก **ชื่อไฟล์** k2_<code>.csv
//   · T`` = tagged template · msgid = ประโยคต้นฉบับ + {0},{1}
//   · ไม่มีคำแปล → ต้องตกกลับข้อความต้นฉบับเสมอ (พังไม่ได้)
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-i18n-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'i18n.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── รหัสภาษาจากชื่อไฟล์ ─────────
check('k2_en.csv → en', S.langCodeFromFile('k2_en.csv') === 'en');
check('k2_th.csv → th', S.langCodeFromFile('k2_th.csv') === 'th');
check('ตัวพิมพ์ใหญ่ก็อ่านได้', S.langCodeFromFile('K2_JA.CSV') === 'ja');
check('รหัสมีภูมิภาค k2_pt-BR.csv', S.langCodeFromFile('k2_pt-BR.csv') === 'pt-BR', S.langCodeFromFile('k2_pt-BR.csv'));
check('ขีดล่างในภูมิภาคก็ได้', S.langCodeFromFile('k2_zh_hans.csv') === 'zh-HANS', S.langCodeFromFile('k2_zh_hans.csv'));
check('ไฟล์อื่นไม่นับเป็นภาษา', S.langCodeFromFile('readme.csv') === '');
check('.json ไม่นับ', S.langCodeFromFile('k2_en.json') === '');
check('ชื่อไฟล์มาตรฐาน', S.langFileName('ja') === 'k2_ja.csv');
check('ชื่อภาษาสำรองจากรหัส', S.fallbackLangName('ja') === '日本語');
check('ชื่อภาษาสำรองใช้ส่วนหน้าของ pt-BR', S.fallbackLangName('pt-BR') === 'Português');

// ───────── CSV → ตาราง ─────────
const csv = '﻿key,text\r\nmeta.code,en\r\nmeta.nativeName,English\r\n'
  + 'ui.app.title,Killian 2\r\n"บันทึกแล้ว","Saved"\r\n'
  + '"มี, คอมมา","has, comma"\r\n"เขาว่า ""ดี""","he said ""good"""\r\n'
  + '# หมายเหตุของผู้แปล,ข้ามแถวนี้\r\nยังไม่แปล,\r\n';
const tb = S.csvToTable(csv);
check('อ่าน CSV ได้', tb['ui.app.title'] === 'Killian 2');
check('BOM ถูกตัดทิ้ง (คีย์แรกไม่มีขยะนำหน้า)', tb['meta.code'] === 'en', JSON.stringify(Object.keys(tb)[0]));
check('คีย์เป็นประโยคไทยได้', tb['บันทึกแล้ว'] === 'Saved');
check('ค่าที่มีคอมมาอยู่ในเครื่องหมายคำพูด', tb['มี, คอมมา'] === 'has, comma');
check('escape เครื่องหมายคำพูดซ้อน', tb['เขาว่า "ดี"'] === 'he said "good"', tb['เขาว่า "ดี"']);
check('แถวคอมเมนต์ # ถูกข้าม', !('# หมายเหตุของผู้แปล' in tb));
check('ช่องว่าง = ยังไม่แปล → ไม่เข้าไปในตาราง', !('ยังไม่แปล' in tb));

// ไฟล์หลายชั้นถูกต่อกันก่อนพาร์ส (โปรเจกต์ → ข้าง exe → ที่มากับโปรแกรม)
const layered = '﻿key,text\r\nui.a,ของโปรเจกต์\r\n' + '\n' + '﻿key,text\r\nui.a,ของโปรแกรม\r\nui.b,เฉพาะของโปรแกรม\r\n';
const lt = S.csvToTable(layered);
check('ชั้นแรกชนะ (ไฟล์ของโปรเจกต์ทับของโปรแกรม)', lt['ui.a'] === 'ของโปรเจกต์', lt['ui.a']);
check('คีย์ที่ชั้นแรกไม่มี ยังได้จากชั้นถัดไป', lt['ui.b'] === 'เฉพาะของโปรแกรม');
check('BOM กลางข้อความไม่ไปติดหัวคีย์', !Object.keys(lt).some((k) => k.charCodeAt(0) === 0xfeff), Object.keys(lt).join('|'));

// รับไฟล์แบบ 3 คอลัมน์ (key,th,en) ที่ผู้แปลส่งกลับมาได้ด้วย
const csv3 = 'key,th,en\r\nสวัสดี,สวัสดี,Hello\r\n';
check('เลือกคอลัมน์ตามชื่อได้', S.csvToTable(csv3, 'en')['สวัสดี'] === 'Hello');
check('ไม่ระบุคอลัมน์ → เอาคอลัมน์ที่ 2', S.csvToTable(csv3)['สวัสดี'] === 'สวัสดี');

// ───────── ตาราง → CSV → ตาราง (ไป-กลับ) ─────────
const round = S.csvToTable(S.tableToCsv({ 'ก, ข': 'a, b', 'มี"คำพูด"': 'has"quote"', 'หลาย\nบรรทัด': 'multi\nline' }));
check('ไป-กลับ: คอมมา', round['ก, ข'] === 'a, b');
check('ไป-กลับ: เครื่องหมายคำพูด', round['มี"คำพูด"'] === 'has"quote"');
check('ไป-กลับ: ขึ้นบรรทัดใหม่ในค่า', round['หลาย\nบรรทัด'] === 'multi\nline');
check('tableToCsv ใส่ BOM ให้ Excel', S.tableToCsv({ a: 'b' }).charCodeAt(0) === 0xfeff);

// ───────── msgid + การแทนค่า ─────────
check('makeMsgid ใส่ {0} ตามลำดับ', S.makeMsgid(['บทที่ ', ' ตอน ', '']) === 'บทที่ {0} ตอน {1}');
check('formatMsg แทนค่า', S.formatMsg('บทที่ {0}', [7]) === 'บทที่ 7');
check('formatMsg สลับลำดับได้ (ภาษาอื่นเรียงไม่เหมือนไทย)',
  S.formatMsg('{1} of {0}', ['ก', 'ข']) === 'ข of ก');
check('formatMsg ค่า null → ว่าง', S.formatMsg('[{0}]', [null]) === '[]');
check('{{ }} = ปีกกาตัวจริง', S.formatMsg('{{0}}', [9]) === '{0}');

// ───────── T`` ─────────
S.setTable({}, 'th');
const n = 5;
check('ไม่มีคำแปล → คืนต้นฉบับ', S.T`บันทึกแล้ว` === 'บันทึกแล้ว');
check('ไม่มีคำแปล + แทนค่า', S.T`บทที่ ${n}` === 'บทที่ 5');

S.setTable({
  'บันทึกแล้ว': 'Saved',
  'บทที่ {0}': 'Chapter {0}',
  'ui.app.title': 'Killian 2',
  'meta.code': 'en', 'meta.nativeName': 'English',
}, 'en');
check('มีคำแปล → ใช้คำแปล', S.T`บันทึกแล้ว` === 'Saved');
check('แปล + แทนค่า', S.T`บทที่ ${n}` === 'Chapter 5', S.T`บทที่ ${n}`);
check('T() เรียกแบบฟังก์ชันธรรมดาก็ได้', S.T('บันทึกแล้ว') === 'Saved');
check('tm() ใช้ msgid ที่สร้างเอง', S.tm('บทที่ {0}', 9) === 'Chapter 9');
check('langInfo อ่านจากแถว meta.*', S.langInfo.code === 'en' && S.langInfo.nativeName === 'English');

// ───────── t() dot-path (ของเดิม) ─────────
check('tKey หาคีย์เต็ม', S.tKey('ui.app.title') === 'Killian 2');
check('tKey เติม ui. ให้เอง (โค้ดเดิมเรียกแบบไม่มี prefix)', S.tKey('app.title') === 'Killian 2');
check('tKey ไม่เจอ → ค่าสำรอง', S.tKey('app.nope', 'สำรอง') === 'สำรอง');
check('tKey ไม่เจอและไม่มีค่าสำรอง → คืนคีย์', S.tKey('app.nope') === 'app.nope');

// แคชต่อจุดเรียกต้องล้างเมื่อเปลี่ยนตาราง (ไม่งั้นสลับภาษาแล้วข้อความค้าง)
function greet() { return S.T`บันทึกแล้ว`; }
check('เรียกซ้ำได้ค่าเดิม (แคช)', greet() === 'Saved' && greet() === 'Saved');
S.setTable({ 'บันทึกแล้ว': 'บันทึกแล้ว' }, 'th');
check('เปลี่ยนตารางแล้วแคชถูกล้าง', greet() === 'บันทึกแล้ว', greet());

// fillTable = เติมเฉพาะที่ยังไม่มี
S.setTable({ a: '1' }, 'x');
S.fillTable({ a: '2', b: '3' });
check('fillTable ไม่ทับของเดิม', S.getTable().a === '1');
check('fillTable เติมคีย์ใหม่', S.getTable().b === '3');

// ───────── ไฟล์ภาษาจริงในรีโป ─────────
const langDir = path.join(__dirname, '..', 'languages');
const files = fs.readdirSync(langDir).filter((f) => S.langCodeFromFile(f));
check('มีไฟล์ภาษาอย่างน้อย th + en', files.length >= 2, files.join(','));
for (const f of files) {
  const code = S.langCodeFromFile(f);
  const t = S.csvToTable(fs.readFileSync(path.join(langDir, f), 'utf8'));
  check(`${f}: meta.code ตรงกับชื่อไฟล์`, t['meta.code'] === code, t['meta.code']);
  check(`${f}: มีชื่อภาษาให้กล่องตั้งค่าแสดง`, !!t['meta.nativeName']);
  check(`${f}: มีข้อความเกิน 500 คีย์`, Object.keys(t).length > 500, Object.keys(t).length);
}
// [alpha.79 · แก้เทสที่ล้าสมัยตั้งแต่ .77]
// สองข้อเดิมเช็คว่า "คีย์เป็นข้อความไทย" (แนว gettext ของ .76) — แต่ .77 เปลี่ยนเป็นคีย์ดอตพาธแล้ว
// จำนวนจึงเป็น 0 เสมอและเทสแดงมาตลอด (ไม่มีใครเห็น เพราะ i18n-csv.test พังก่อนจนชุดหยุดกลางทาง)
// ตอนนี้เช็ค **กฎของ .77 จริง ๆ**: คีย์ต้องเป็นดอตพาธล้วน ห้ามมีข้อความไทยเป็นคีย์
const thTable = S.csvToTable(fs.readFileSync(path.join(langDir, 'k2_th.csv'), 'utf8'));
const enTable = S.csvToTable(fs.readFileSync(path.join(langDir, 'k2_en.csv'), 'utf8'));
const thaiKeys = Object.keys(thTable).filter((k) => /[฀-๿]/.test(k));
check('k2_th.csv ไม่มีคีย์ที่เป็นข้อความไทย (คีย์ต้องเป็นดอตพาธ)',
  thaiKeys.length === 0, thaiKeys.slice(0, 3).join(' | '));
check('k2_th.csv มีคีย์เกิน 3,000 รายการ', Object.keys(thTable).length > 3000,
  Object.keys(thTable).length);
check('ทุกคีย์อยู่ในรูป ui.<module>.<name> หรือ meta.*',
  Object.keys(thTable).every((k) => /^(ui|meta)\.[\w.:-]+$/.test(k)),
  Object.keys(thTable).filter((k) => !/^(ui|meta)\.[\w.:-]+$/.test(k)).slice(0, 3).join(' | '));
check('คีย์ของ en เป็นชุดย่อยของ th (ไม่มีคีย์กำพร้า)',
  Object.keys(enTable).filter((k) => !k.startsWith('meta.') && !(k in thTable)).length === 0,
  Object.keys(enTable).filter((k) => !k.startsWith('meta.') && !(k in thTable)).slice(0, 3).join(' | '));

console.log(`\n--- RESULT ---\nPASS ${pass}  FAIL ${fail}`);
if (fail) process.exit(1);
