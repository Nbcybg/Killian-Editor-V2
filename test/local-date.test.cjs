// test/local-date.test.cjs — [alpha.148] "วันนี้" ต้องเป็นวันของผู้ใช้ ไม่ใช่วัน UTC
process.env.TZ = 'Asia/Bangkok';            // ผู้ใช้จริงอยู่ UTC+7 — ช่วง 00:00–06:59 คือจุดที่บั๊กโผล่
const path = require('path');
const out = path.join(require('os').tmpdir(), '_localdate.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/local-date.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const L = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ localDay ═══════════
{
  const earlyMorning = new Date(Date.UTC(2026, 8, 10, 18, 30));      // 01:30 น. วันที่ 11 (เวลาไทย)
  check('ยืนยันว่าทางเดิมผิดจริง (toISOString = วันที่ 10)',
        earlyMorning.toISOString().slice(0, 10) === '2026-09-10');
  check('★ ตีหนึ่งครึ่งวันที่ 11 = วันที่ 11', L.localDay(earlyMorning) === '2026-09-11', L.localDay(earlyMorning));
  check('ห้าทุ่มห้าสิบเก้า = ยังเป็นวันเดิม',
        L.localDay(new Date(Date.UTC(2026, 8, 11, 16, 59))) === '2026-09-11');
  check('เที่ยงคืนตรง = วันใหม่', L.localDay(new Date(Date.UTC(2026, 8, 11, 17, 0))) === '2026-09-12');
  check('รับเป็นตัวเลข ms ได้', L.localDay(Date.UTC(2026, 0, 1, 0, 0)) === '2026-01-01');
  check('ไม่ส่งอะไร = วันนี้ของเครื่อง', /^\d{4}-\d{2}-\d{2}$/.test(L.localDay()));
}

// ═══════════ addDays ═══════════
{
  check('เมื่อวานของวันขึ้นปีใหม่', L.addDays('2026-01-01', -1) === '2025-12-31');
  check('ปีอธิกสุรทิน', L.addDays('2024-02-28', 1) === '2024-02-29');
  check('ข้ามเดือน', L.addDays('2026-09-30', 1) === '2026-10-01');
  check('รูปแบบผิด = ว่าง', L.addDays('11/09/2026', 1) === '' && L.addDays('', 1) === '');
}

// ═══════════ fmtUtcStamp ═══════════
{
  check('★ ชื่อไฟล์เวอร์ชัน (UTC) แสดงเป็นเวลาไทย',
        L.fmtUtcStamp('2026-07-20T08-30-00-000') === '20/07/2026 15:30', L.fmtUtcStamp('2026-07-20T08-30-00-000'));
  check('ข้ามวันเมื่อแปลงเป็นเวลาไทย', L.fmtUtcStamp('2026-07-20T20-15') === '21/07/2026 03:15');
  check('อ่านไม่ออก = คืนค่าเดิม', L.fmtUtcStamp('เวอร์ชันเก่า') === 'เวอร์ชันเก่า' && L.fmtUtcStamp('') === '');
}

// ═══════════ เขตเวลาอื่นก็ถูก (ไม่ได้ฮาร์ดโค้ด +7) ═══════════
{
  process.env.TZ = 'America/New_York';
  check('นิวยอร์ก: 02:00 UTC วันที่ 11 = วันที่ 10', L.localDay(new Date(Date.UTC(2026, 8, 11, 2, 0))) === '2026-09-10');
  process.env.TZ = 'UTC';
  check('UTC: ตรงกับ toISOString', L.localDay(new Date(Date.UTC(2026, 8, 11, 2, 0))) === '2026-09-11');
}

console.log(`\nlocal-date: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
