// test/cancel.test.cjs — [alpha.162 · W5 ข้อ 2] "ยกเลิกงานยาว" แบบเดียวทั้งโปรแกรม (src/cancel.js)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), 'k2-cancel-test.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/cancel.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const C = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// error ของการยกเลิก
{
  const e = C.cancelledError();
  check('cancelledError เป็น Error จริง', e instanceof Error);
  check('★ isCancelled จำ error ของเราได้', C.isCancelled(e));
  const ab = new Error('x'); ab.name = 'AbortError';
  check('isCancelled จำ AbortError มาตรฐาน (AbortSignal) ได้ด้วย', C.isCancelled(ab));
  check('★ error ธรรมดา ≠ ยกเลิก (พังจริงต้องไม่ถูกกลืนเป็น "ยกเลิก")', !C.isCancelled(new Error('ENOENT')));
  check('ค่าว่าง ≠ ยกเลิก', !C.isCancelled(null) && !C.isCancelled(undefined));
  // ห้ามแยกด้วยข้อความ (กฎ .128) — ข้อความ "cancelled" อย่างเดียวไม่นับ
  check('ข้อความ "cancelled" เฉย ๆ ไม่นับเป็นยกเลิก', !C.isCancelled(new Error('cancelled')));
}

// throwIfCancelled
{
  let threw = null;
  try { C.throwIfCancelled({ aborted: true }); } catch (e) { threw = e; }
  check('★ signal ถูกยกเลิก → โยน error ยกเลิก', !!threw && C.isCancelled(threw));
  let ok = true;
  try { C.throwIfCancelled({ aborted: false }); C.throwIfCancelled(null); C.throwIfCancelled(undefined); } catch { ok = false; }
  check('ยังไม่ยกเลิก / ไม่มี signal = ไม่โยน', ok);
  const ctl = new AbortController();
  let t2 = null;
  ctl.abort();
  try { C.throwIfCancelled(ctl.signal); } catch (e) { t2 = e; }
  check('ใช้กับ AbortSignal จริงได้', !!t2 && C.isCancelled(t2));
}

// progressText
{
  check('★ รู้จำนวนทั้งหมด = "ข้อความ (3/10)"', C.progressText('กำลังทำ', 3, 10) === 'กำลังทำ (3/10)', C.progressText('กำลังทำ', 3, 10));
  check('ไม่รู้จำนวนทั้งหมด = "ข้อความ (3)"', C.progressText('กำลังทำ', 3) === 'กำลังทำ (3)');
  check('ยังไม่เริ่ม = ข้อความล้วน', C.progressText('กำลังทำ', 0) === 'กำลังทำ');
  check('เกินทั้งหมดถูกหนีบ', C.progressText('x', 12, 10) === 'x (10/10)');
  check('ค่าเสีย/ติดลบไม่พัง', C.progressText('x', -5, 'abc') === 'x' && C.progressText('x', NaN, 4) === 'x (0/4)',
        C.progressText('x', NaN, 4));
  check('เศษถูกปัดลง', C.progressText('x', 2.9, 7.6) === 'x (2/7)', C.progressText('x', 2.9, 7.6));
}

console.log(`\ncancel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
