// test/timing-palette.test.cjs — [alpha.162 · W6 ข้อ 2 + 7] ตัวเลขเวลาที่เดียว · สีที่ไม่ใช่สีเปลือกที่เดียว
const path = require('path');
const os = require('os');
const build = (name, file) => {
  const out = path.join(os.tmpdir(), 'k2-' + name + '-test.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + file)],
    outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const T = build('timing', 'timing.js');
const P = build('palette', 'palette.js');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ── timing ──
check('★ retryBackoff: 500 · 1000 · 2000 · 4000 · 8000', [0, 1, 2, 3, 4].map(T.retryBackoff).join(',') === '500,1000,2000,4000,8000',
      [0, 1, 2, 3, 4].map(T.retryBackoff).join(','));
check('★ retryBackoff มีเพดาน 8 วินาที (ไม่โตไม่สิ้นสุด)', T.retryBackoff(10) === 8000 && T.retryBackoff(1000) === 8000);
check('retryBackoff: ค่าเสีย/ติดลบ = รอสั้นสุด', T.retryBackoff(-3) === 500 && T.retryBackoff('x') === 500 && T.retryBackoff(undefined) === 500);
check('retryBackoff: เศษถูกปัดลง', T.retryBackoff(2.9) === 2000);
check('ค่าคงที่เวลาเป็นตัวเลขบวก', [T.SPLASH_MAX_MS, T.UPDATE_FETCH_TIMEOUT_MS, T.SCRATCH_SAVE_DELAY_MS]
  .every((n) => Number.isFinite(n) && n > 0));
check('ค่าคงที่เวลาเท่าค่าเดิมที่ย้ายมา (splash 30 วิ · ตรวจอัปเดต 20 วิ · สมุดโน้ต 3 วิ)',
      T.SPLASH_MAX_MS === 30000 && T.UPDATE_FETCH_TIMEOUT_MS === 20000 && T.SCRATCH_SAVE_DELAY_MS === 3000);

// ── palette ──
const hex = /^#[0-9a-f]{6}$/i;
check('★ จานสีโหนด/เส้นเป็นเลขสีจริงครบ', P.PLANNER_NODE_COLORS.length === 10 && P.PLANNER_NODE_COLORS.every((c) => hex.test(c))
      && P.PLANNER_EDGE_COLORS.every((c) => hex.test(c)));
check('สีความหมายของกระดานเป็นเลขสีจริงทุกตัว', Object.values(P.PLANNER_KIND).every((c) => hex.test(c)));
check('★ สีงานส่งออกพื้นขาว (ไม่ตามธีม)', P.PRINT.paper === '#ffffff' && Object.values(P.PRINT).every((c) => hex.test(c)));
check('สีชุดข้อมูลกราฟ 7 สี · สีสถานะที่ยังไม่ตั้งเป็นเลขสี', P.CHART_SERIES.length === 7 && hex.test(P.STATUS_UNSET));
check('★ themeColor ไม่มี DOM = ได้ค่าสำรอง (ไม่พัง)', P.themeColor('--canvas', '#262624') === '#262624');
P.clearThemeColorCache();
check('clearThemeColorCache เรียกซ้ำได้ไม่พัง', P.themeColor('--x', '#010203') === '#010203');

console.log(`\ntiming-palette: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
