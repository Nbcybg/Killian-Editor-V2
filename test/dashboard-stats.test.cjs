// test/dashboard-stats.test.cjs — [alpha.157] ตัวเลขแดชบอร์ด + สีแถบ (บริสุทธิ์)
const path = require('path');
const os = require('os');
const build = (name, file) => {
  const out = path.join(os.tmpdir(), '_' + name + '.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + file)],
    outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const D = build('dashstats', 'dashboard-stats.js');
const C = build('colorutil', 'color-util.js');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (i !== '' ? ' | ' + i : '')); } };

// ── เวลาอ่าน ──
check('readingTime: 0 คำ = 0 นาที', D.readingTime(0).minutes === 0);
check('readingTime: 10 คำ ปัดขึ้นเป็น 1 นาที', D.readingTime(10).minutes === 1);
const rt = D.readingTime(40000);
check('readingTime: 40,000 คำ = 160 นาที = 2 ชม. 40 นาที', rt.minutes === 160 && rt.hours === 2 && rt.mins === 40, JSON.stringify(rt));

// ── activity ──
const hist = [
  { date: '2026-09-01', words: 1000 },   // แถวแรก = ของเดิมก่อนเริ่มจด (ไม่นับเป็นเขียนวันนั้น)
  { date: '2026-09-03', words: 1500 },
  { date: '2026-09-10', words: 1400 },   // ลบงาน = ไม่ติดลบ
  { date: '2026-09-15', words: 6200 },
  { date: 'พัง', words: 9 },
];
const s7 = D.activitySeries(hist, '7d', { today: '2026-09-17' });
check('7d: ครบ 7 วัน (เติมวันที่ไม่มีแถว)', s7.days.length === 7 && s7.from === '2026-09-11', s7.days.length + ' ' + s7.from);
check('7d: วันที่ 15 = +4,800 (เทียบยอดสะสมก่อนช่วง)', s7.days.find((d) => d.date === '2026-09-15').delta === 4800);
check('7d: รวม + วันที่เขียน + วันที่ดีที่สุด', s7.sum === 4800 && s7.active === 1 && s7.best.date === '2026-09-15');
const s30 = D.activitySeries(hist, '30d', { today: '2026-09-17' });
check('30d: 30 วัน', s30.days.length === 30);
check('30d: แถวแรกของประวัติไม่ถูกนับเป็นคำที่เขียน', s30.days.find((d) => d.date === '2026-09-01').delta === 0);
check('30d: 3 ก.ย. +500 · 10 ก.ย. ไม่ติดลบ', s30.days.find((d) => d.date === '2026-09-03').delta === 500
  && s30.days.find((d) => d.date === '2026-09-10').delta === 0);
const sAll = D.activitySeries(hist, 'all', { today: '2026-09-17', start: '2026-08-30' });
check('all: เริ่มที่วันเริ่มโปรเจกต์', sAll.from === '2026-08-30' && sAll.days.length === 19, sAll.from + ' ' + sAll.days.length);
check('all: ไม่มีประวัติ = วันนี้วันเดียว', D.activitySeries([], 'all', { today: '2026-09-17' }).days.length === 1);
check('dayDiff ข้ามเดือน', D.dayDiff('2026-08-30', '2026-09-02') === 3);

// ── วันเริ่ม / milestone ──
check('projectStartDay: ใช้ created', D.projectStartDay({ created: '2026-08-20T10:00:00' }, hist) === '2026-08-20');
check('projectStartDay: ประวัติเก่ากว่า created = ใช้ประวัติ', D.projectStartDay({ created: '2026-09-05T10:00:00' }, hist) === '2026-09-01');
check('projectStartDay: ไม่มี created = วันแรกของประวัติ', D.projectStartDay({}, hist) === '2026-09-01');
const ms = D.milestones(hist, 6000);
check('milestones: 1k วันแรก · 5k วันที่ 15 · เป้า 6,000', ms.map((m) => m.words + '@' + m.date).join() === '1000@2026-09-01,5000@2026-09-15,6000@2026-09-15', JSON.stringify(ms));
check('milestones: ติดธงเป้าหมาย', ms.find((m) => m.words === 6000).goal === true);
check('nextMilestone', JSON.stringify(D.nextMilestone(6200)) === JSON.stringify({ words: 10000, left: 3800 }));

// ── สถานะตามคอลัมน์ Kanban ──
const br = D.statusBreakdown(['ก', 'ข', '', 'Outline', 'ก', 'แปลก'], ['ก', 'ข', 'ค'], '__unset__');
check('statusBreakdown: ยังไม่ตั้งขึ้นก่อน · นับครบ · คอลัมน์ว่างยังอยู่ · สถานะแปลกต่อท้าย',
  JSON.stringify(br.map((r) => r.key + ':' + r.n)) === JSON.stringify(['__unset__:2', 'ก:2', 'ข:1', 'ค:0', 'แปลก:1']), JSON.stringify(br));

// ── สี ──
check('vivid: สีจานเดิมกลายเป็นเฉดสด', C.vivid('#D9575E') === '#ff4d6d');
check('vivid: สีที่ผู้ใช้เลือกเองไม่เปลี่ยน', C.vivid('#123456') === '#123456' && C.vivid('abc') === '#aabbcc');
check('vivid: ค่าไม่ใช่สี = ว่าง', C.vivid('red') === '' && C.vivid('') === '');
check('inkOn: เหลืองใช้ตัวเข้ม · กรมท่าใช้ตัวขาว', C.inkOn('#ffc42e') === '#1a1426' && C.inkOn('#1e1250') === '#ffffff');
check('contrast ขาว/ดำ = 21', Math.round(C.contrast('#ffffff', '#000000')) === 21);
for (const hex of [...Object.values(C.VIVID), ...C.STATUS_PALETTE]) {
  check('ตัวอักษรบนแถบ ' + hex + ' อ่านออก (≥ 4.5)', C.contrast(hex, C.inkOn(hex)) >= 4.5, C.contrast(hex, C.inkOn(hex)).toFixed(2));
}
check('tint', C.tint('#ff0000', 0.5) === 'rgba(255, 0, 0, 0.5)');
check('nextStatusColor: ไม่ซ้ำสีที่ใช้แล้ว', C.nextStatusColor(['#ff4d6d']) === '#ff7a2f');

console.log(`\ndashboard-stats: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
