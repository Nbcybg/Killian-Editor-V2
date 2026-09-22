// test/epoch-guard.test.cjs — [alpha.161 · C] งานสร้างแคชที่เริ่มก่อน invalidate ต้องไม่ถูกเก็บเป็นของสด
// ของจริงที่ผูกกับ computeBookFlow (read-ui) · ensureRag (ai-chat-panel) · ensureSearchIndex (global-search)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-epochguard-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'epoch-guard.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const G = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  const e = G.createEpoch();
  check('เริ่มที่ 0', e.value === 0 && e.snap() === 0);
  const s0 = e.snap();
  e.bump();
  check('bump แล้วเลขเดิมไม่ current', !e.isCurrent(s0) && e.isCurrent(e.snap()) && e.value === 1);

  // ไม่มีใคร bump ระหว่างรัน = สดในรอบเดียว
  let calls = 0;
  const r1 = await G.runFresh(e, async () => { calls++; await tick(); return 'A'; });
  check('ไม่มี bump = สด · รอบเดียว', r1.fresh === true && r1.rounds === 1 && r1.value === 'A' && calls === 1);

  // ★ ต้นตอ: bump ระหว่างรัน (บันทึกฉากตอนกำลังวัด) → ต้องรันใหม่ แล้วได้ผลจากข้อมูลใหม่
  let data = 'เก่า';
  let n = 0;
  const r2 = await G.runFresh(e, async () => {
    const seen = data;
    if (n++ === 0) { data = 'ใหม่'; e.bump(); }       // ข้อมูลเปลี่ยนกลางงานรอบแรก
    await tick();
    return seen;
  });
  check('★ bump กลางงาน → รันใหม่ ได้ผลของข้อมูลใหม่ และสด', r2.fresh === true && r2.rounds === 2 && r2.value === 'ใหม่',
        JSON.stringify(r2));

  // ★ มีคน bump ตลอด → ต้องหยุดที่เพดาน และบอกว่าไม่สด (ห้ามเก็บเป็นของสด · ห้ามวนไม่จบ)
  let m = 0;
  const r3 = await G.runFresh(e, async () => { m++; e.bump(); await tick(); return m; }, { maxRounds: 3 });
  check('★ bump ทุกรอบ → หยุดที่เพดาน 3 รอบ', r3.rounds === 3 && m === 3, JSON.stringify(r3));
  check('★ ครบเพดานแล้วยังเปลี่ยน = fresh:false', r3.fresh === false && r3.value === 3);

  // เพดานผิดรูป = อย่างน้อย 1 รอบ
  const r4 = await G.runFresh(e, () => 'x', { maxRounds: 0 });
  check('maxRounds 0 → รัน 1 รอบ', r4.rounds === 1 && r4.fresh === true);
  const r5 = await G.runFresh(e, () => 'y', { maxRounds: 'ไม่ใช่เลข' });
  check('maxRounds ไม่ใช่ตัวเลข → รัน 1 รอบ', r5.rounds === 1 && r5.value === 'y');

  // งานพัง → ส่ง error ต่อ (ผู้เรียกจัดการเอง ไม่กลืน)
  let threw = false;
  try { await G.runFresh(e, async () => { throw new Error('พัง'); }); } catch { threw = true; }
  check('งานพัง = โยนต่อ (ไม่กลืน)', threw);

  // สองตัวนับแยกกัน
  const a = G.createEpoch(), b = G.createEpoch();
  const sa = a.snap(); b.bump();
  check('ตัวนับแยกกัน (bump ของอีกตัวไม่กระทบ)', a.isCurrent(sa));

  // งานสองชิ้นซ้อนกัน: ชิ้นที่เริ่มก่อน bump ไม่สด ชิ้นที่เริ่มหลังสด
  const c = G.createEpoch();
  let release;
  const gate = new Promise((r) => { release = r; });
  const pOld = G.runFresh(c, async () => { await gate; return 'old'; }, { maxRounds: 1 });
  c.bump();
  const pNew = G.runFresh(c, async () => 'new', { maxRounds: 1 });
  release();
  const [ro, rn] = await Promise.all([pOld, pNew]);
  check('★ งานที่เริ่มก่อน invalidate (เพดาน 1) = ไม่สด', ro.fresh === false && ro.value === 'old');
  check('งานที่เริ่มหลัง invalidate = สด', rn.fresh === true && rn.value === 'new');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
