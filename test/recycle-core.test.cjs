// test/recycle-core.test.cjs — [alpha.148] ถังขยะ: อายุนับจาก "เวลาที่ลบ" ไม่ใช่ mtime · ชื่อกันชนตอนกู้คืน
const path = require('path');
const out = path.join(require('os').tmpdir(), '_recyclecore.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/recycle-core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const R = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const DAY = 86400000;
const now = Date.UTC(2026, 8, 11, 12, 0, 0);
const stamp = (ms) => ms.toString(36);

// ═══════════ trashedAt ═══════════
{
  // ★ สถานการณ์บั๊กจริง: แก้ไฟล์ครั้งสุดท้าย 40 วันก่อน แต่เพิ่งลบวันนี้
  check('★ ลบวันนี้ = อายุนับจากวันนี้ แม้ mtime เก่า 40 วัน',
        R.trashedAt(stamp(now) + '-ฉาก.md', now - 40 * DAY, now) === now);
  check('ชื่อไม่มีเวลาประทับ → ใช้ mtime', R.trashedAt('ฉากที่ลากมาวางเอง.md', 1234, now) === 1234);
  check('ถอดได้แต่เก่ากว่า 2020 (ไม่ใช่เวลาประทับ) → ใช้ mtime',
        R.trashedAt('abcdefgh-x.md', 55, now) === 55);
  check('ถอดได้แต่อยู่ในอนาคตไกล → ใช้ mtime', R.trashedAt('zzzzzzzz-x.md', 66, now) === 66);
  check('โฟลเดอร์ (ไม่มีนามสกุล) ก็ถอดได้', R.trashedAt(stamp(now - DAY) + '-01 - บทแรก', 0, now) === now - DAY);
  check('ค่าว่างไม่พัง', R.trashedAt('', undefined, now) === 0 && R.trashedAt(null, null, now) === 0);
}

// ═══════════ purgeCandidates ═══════════
{
  const old = stamp(now - 40 * DAY);
  const entries = [
    { name: stamp(now) + '-ใหม่แต่mtimeเก่า.md', mtime: now - 90 * DAY },
    { name: old + '-เก่าจริง.md', mtime: now },
    { name: old + '-เก่าจริง.md.k2restore.json', mtime: 0 },
    { name: old + '-เก่าจริง.md.vis.csv', mtime: 0 },
    { name: '._' + old + '-เก่าจริง.md', mtime: 0 },
    { name: 'ไม่มีเวลาประทับ-เก่า.md', mtime: now - 40 * DAY },
    { name: 'ไม่มีเวลาประทับ-ใหม่.md', mtime: now },
    { name: old + '-01 - บทที่ถูกลบ', mtime: now },
  ];
  const got = R.purgeCandidates(entries, 30, now);
  check('★ ของที่เพิ่งลบไม่ถูกเลือก แม้ mtime เก่ามาก',
        !got.some((n) => n.includes('ใหม่แต่mtimeเก่า')), JSON.stringify(got));
  check('ของที่ลบนานเกินกำหนดถูกเลือก (ทั้งไฟล์และโฟลเดอร์)',
        got.includes(old + '-เก่าจริง.md') && got.includes(old + '-01 - บทที่ถูกลบ'), JSON.stringify(got));
  check('ไฟล์ประกอบ (.k2restore.json/.vis.csv) ไม่นับเป็นรายการแยก',
        !got.some((n) => /k2restore|vis\.csv/.test(n)), JSON.stringify(got));
  check('ไฟล์ขยะ ._ ของ macOS ไม่ถูกนับ', !got.some((n) => n.startsWith('._')));
  check('ไม่มีเวลาประทับ → ตัดสินด้วย mtime เหมือนเดิม',
        got.includes('ไม่มีเวลาประทับ-เก่า.md') && !got.includes('ไม่มีเวลาประทับ-ใหม่.md'));
  check('จำนวนตรงกับของที่ผู้ใช้เห็นในต้นไม้ (3 รายการ)', got.length === 3, JSON.stringify(got));
  check('days = 0 → ไม่ล้าง', R.purgeCandidates(entries, 0, now).length === 0);
  check('days ไม่ใช่ตัวเลข → ไม่ล้าง', R.purgeCandidates(entries, 'abc', now).length === 0);
  check('isTrashCompanion', R.isTrashCompanion('x.md.k2restore.json') && R.isTrashCompanion('x.md.vis.csv')
        && !R.isTrashCompanion('x.md'));
}

// ═══════════ originalName ═══════════
{
  check('ตัดเวลาประทับออก', R.originalName(stamp(now) + '-ฉาก.md', now) === 'ฉาก.md');
  check('ชื่อที่มีขีดแต่ไม่ใช่เวลาประทับ ไม่ถูกตัด', R.originalName('my-note.md', now) === 'my-note.md');
  check('ชื่อที่มีขีดหลายตัว ตัดแค่เวลาประทับ',
        R.originalName(stamp(now) + '-a-b-c.md', now) === 'a-b-c.md');
}

// ═══════════ nameCandidate ═══════════
{
  check('ลำดับที่ 1 = ชื่อเดิม', R.nameCandidate('โน้ต.md', 1) === 'โน้ต.md');
  check('ลำดับที่ 2 = เติมเลขหน้านามสกุล', R.nameCandidate('โน้ต.md', 2) === 'โน้ต-2.md');
  check('ไม่มีนามสกุล', R.nameCandidate('README', 3) === 'README-3');
  check('โฟลเดอร์ไม่แยกนามสกุล', R.nameCandidate('01 - บทที่ 1.5', 2, { dir: true }) === '01 - บทที่ 1.5-2');
  check('ไฟล์ .json', R.nameCandidate('มานี-abc.json', 2) === 'มานี-abc-2.json');
}

console.log(`\nrecycle-core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
