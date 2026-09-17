// test/sprint-core.test.cjs — [alpha.156] สปรินต์การเขียน (ตรรกะล้วน)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-sprint-core-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'sprint-core.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const MIN = 60000;

check('clampMinutes: ค่าเสีย = 25', S.clampMinutes('x') === 25);
check('clampMinutes: เพดาน', S.clampMinutes(0) === 1 && S.clampMinutes(999) === 180);
check('fmtClock', S.fmtClock(125000) === '2:05' && S.fmtClock(3725000) === '1:02:05' && S.fmtClock(-5) === '0:00');
check('fmtClock ปัดเศษวินาทีขึ้น (ไม่โชว์ 0:00 ก่อนหมดเวลาจริง)', S.fmtClock(400) === '0:01');

const s = S.startSprint({ minutes: 20, words: 1000, goal: 500, now: 0 });
{
  const st = S.sprintStatus(s, 1000, 0);
  check('เริ่ม: เหลือ 20 นาที เขียนได้ 0', st.remainingMs === 20 * MIN && st.written === 0 && st.wpm === 0 && !st.done);
  const st2 = S.sprintStatus(s, 1250, 10 * MIN);
  check('10 นาที เขียน 250 คำ = 25 คำ/นาที · 50% ของเป้า', st2.written === 250 && st2.wpm === 25 && st2.goalPct === 50, JSON.stringify(st2));
  const st3 = S.sprintStatus(s, 1800, 25 * MIN);
  check('เลยเวลา = จบ · เวลาที่ใช้ไม่เกินที่ตั้ง', st3.done && st3.elapsedMs === 20 * MIN && st3.goalPct === 100);
  const st4 = S.sprintStatus(s, 900, 5 * MIN);
  check('ลบคำ = ติดลบในสถานะ แต่ wpm ไม่ติดลบ', st4.written === -100 && st4.wpm === 0);
}
{
  let p = S.pauseSprint(s, 5 * MIN);
  const frozen = S.sprintStatus(p, 1100, 9 * MIN);
  check('หยุดชั่วคราว: นาฬิกาหยุดเดิน', frozen.paused && frozen.remainingMs === 15 * MIN, JSON.stringify(frozen));
  p = S.resumeSprint(p, 9 * MIN);
  const after = S.sprintStatus(p, 1100, 10 * MIN);
  check('ทำต่อ: เวลาที่หยุดไม่ถูกนับ', after.remainingMs === 14 * MIN && after.elapsedMs === 6 * MIN, JSON.stringify(after));
  check('pause ซ้ำไม่เปลี่ยนอะไร', S.pauseSprint(S.pauseSprint(s, 1), 99).pausedAt === 1);
}
{
  const rec = S.finishSprint(s, 1300, 12 * MIN);
  check('finishSprint: ระเบียนครบ', rec.words === 300 && rec.actualMinutes === 12 && rec.wpm === 25 && rec.reached === false, JSON.stringify(rec));
  const neg = S.finishSprint(s, 800, 12 * MIN);
  check('finishSprint: คำติดลบถูกปัดเป็น 0', neg.words === 0);
  let h = S.appendSprintHistory([], rec);
  h = S.appendSprintHistory(h, S.finishSprint(s, 1010, 0.5 * MIN));
  check('ประวัติ: รอบไม่ถึงนาทีไม่จด', h.length === 1);
  const big = Array.from({ length: 205 }, () => rec).reduce((a, r) => S.appendSprintHistory(a, r), []);
  check('ประวัติ: ตัดเหลือเพดาน', big.length === S.SPRINT_HISTORY_MAX);
  const sum = S.sprintSummary([rec, { ...rec, words: 100, actualMinutes: 8, wpm: 12 }]);
  check('สรุป: คำรวม/นาที/เฉลี่ยถ่วงเวลา/ดีสุด', sum.count === 2 && sum.words === 400 && sum.minutes === 20 && sum.avgWpm === 20 && sum.best.wpm === 25, JSON.stringify(sum));
  check('สรุปว่าง', S.sprintSummary(null).count === 0 && S.sprintSummary([]).avgWpm === 0);
}

console.log(`\nsprint-core: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
if (fail) process.exit(1);
