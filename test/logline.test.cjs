// test/logline.test.cjs — [alpha.157] Logline 6 ช่อง = เข็มทิศเรื่องของ AI (บริสุทธิ์)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_logline.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/logline.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const L = require(out);
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (i !== '' ? ' | ' + i : '')); } };

check('6 ช่องตามลำดับที่ผู้ใช้สั่ง', L.LOGLINE_KEYS.join() === 'logline,protagonist,inciting,goal,obstacle,stakes');
check('ทุกช่องมีคีย์ป้าย+คำใบ้', L.LOGLINE_KEYS.every((k) => L.LOGLINE_LABEL_KEYS[k] && L.LOGLINE_HINT_KEYS[k]));
const n = L.normalizeLogline({ logline: '  เด็กหญิง  ', goal: 5, junk: 'x' });
check('normalize: ตัดช่องว่าง · ค่าไม่ใช่สตริงทิ้ง · คีย์แปลกไม่ติดมา', n.logline === 'เด็กหญิง' && n.goal === '' && !('junk' in n) && Object.keys(n).length === 6);
check('normalize: รับค่าพัง', L.isLoglineEmpty(null) && L.isLoglineEmpty([]) && L.isLoglineEmpty('x'));
check('compact: ช่องว่างไม่เขียน', JSON.stringify(L.compactLogline({ logline: 'a', goal: ' ' })) === '{"logline":"a"}');
check('compact: ว่างทั้งก้อน = undefined', L.compactLogline({}) === undefined);
const m = L.mergeLogline({ logline: 'โปรเจกต์', stakes: 'โลกแตก' }, { logline: 'เล่มหนึ่ง', goal: '' });
check('merge: เล่มทับเฉพาะช่องที่กรอก', m.logline === 'เล่มหนึ่ง' && m.stakes === 'โลกแตก' && m.goal === '');
const txt = L.compassText({ logline: 'เด็กหญิงตามหาแม่', stakes: 'ถ้าไม่ทัน\nแม่ตาย' }, null,
  { head: 'เข็มทิศ', rule: 'อย่าหลุด', labels: { logline: 'Logline', stakes: 'เดิมพัน' } });
check('compassText: หัว + เฉพาะช่องที่มีค่า + กฎ', txt === 'เข็มทิศ\n- Logline: เด็กหญิงตามหาแม่\n- เดิมพัน: ถ้าไม่ทัน แม่ตาย\nอย่าหลุด', JSON.stringify(txt));
check('compassText: ไม่ได้กรอก = ไม่มีข้อความ (ไม่แตะคำขอ AI)', L.compassText({}, {}, { head: 'x' }) === '');
check('compassText: ยาวเกินถูกตัด', L.compassText({ goal: 'ก'.repeat(2000) }, null, {}).length < 700);
check('compassText: ชื่อเล่ม', L.compassText({ goal: 'x' }, { goal: 'y' }, { head: 'H', bookTitle: 'เล่ม 2' }).startsWith('H — เล่ม 2'));
check('withCompass: ต่อท้าย system', L.withCompass('sys', 'C') === 'sys\n\nC');
check('withCompass: ไม่ซ้ำ', L.withCompass('sys\n\nC', 'C') === 'sys\n\nC');
check('withCompass: system ว่าง', L.withCompass('', 'C') === 'C' && L.withCompass('s', '') === 's');
console.log(`\nlogline: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
