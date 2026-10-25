// test/project-lock.test.cjs — [alpha.170 · ใช้หลายเครื่อง] ตัวล็อกโปรเจกต์ + สำเนาจากตัวซิงก์คลาวด์ (ผลสำรวจผู้ใช้ข้อ 2)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-project-lock-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'project-lock.js')], outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const L = require(tmp);
const T = (() => {
  const t2 = path.join(os.tmpdir(), 'k2-project-lock-timing.cjs');
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'timing.js')], outfile: t2, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(t2);
})();

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

const now = Date.UTC(2026, 9, 23, 10, 0, 0);
const me = { machine: 'LAPTOP', user: 'nb', session: 's-me', app: '2.0.0', now };
const other = { machine: 'DESKTOP', user: 'nb', session: 's-other', app: '2.0.0' };

// ── ล็อก ──
{
  const lk = L.makeLock(me);
  check('[pl-1] makeLock: เวลาเป็น ISO · เซสชัน · เครื่อง', lk.machine === 'LAPTOP' && lk.session === 's-me' && lk.beat === new Date(now).toISOString() && lk.since === lk.beat);
  check('[pl-1] ไม่มีไฟล์ = free', L.lockState(null, me, now).state === 'free');
  check('[pl-1] ไฟล์เสีย/ไม่มีเซสชัน = free', L.lockState({}, me, now).state === 'free' && L.lockState('x', me, now).state === 'free');
  check('[pl-1] ของตัวเอง = mine', L.lockState(lk, me, now + 5000).state === 'mine');
  const fresh = L.makeLock({ ...other, now: now - 60 * 1000 });
  const st = L.lockState(fresh, me, now);
  check('[pl-1] อีกเครื่องเพิ่งยืนยันเมื่อนาทีก่อน = other', st.state === 'other' && st.other.machine === 'DESKTOP' && st.sameMachine === false && st.ageMs === 60000, st);
  const old = L.makeLock({ ...other, now: now - T.PROJECT_LOCK_STALE_MS - 1 });
  check('[pl-1] ไม่ได้ยืนยันนานเกินเพดาน = stale (เครื่องดับ/หลับ)', L.lockState(old, me, now).state === 'stale');
  const sameM = L.lockState(L.makeLock({ ...other, machine: 'LAPTOP', now }), me, now);
  check('[pl-1] เครื่องเดียวกันคนละเซสชัน = other + sameMachine', sameM.state === 'other' && sameM.sameMachine === true);
  check('[pl-1] เวลาเสีย = stale', L.lockState({ session: 'x', beat: 'garbage' }, me, now).state === 'stale');
  const crashed = { ...L.makeLock({ ...other, machine: 'LAPTOP', pid: 4242, now }), alive: false };
  check('[pl-1] เครื่องเดียวกัน โปรเซสที่ถือล็อกไม่อยู่แล้ว (โปรแกรมล่ม) = stale ไม่ถาม', L.lockState(crashed, me, now).state === 'stale' && L.makeLock({ ...me, pid: 7 }).pid === 7);
  check('[pl-1] เครื่องอื่น: alive ไม่มีความหมาย (main ไม่ตรวจ) → ยังถาม', L.lockState({ ...L.makeLock({ ...other, now }), alive: false }, me, now).state === 'other');
  check('[pl-1] ปล่อยล็อกเฉพาะของตัวเอง', L.shouldRelease(lk, me) && !L.shouldRelease(fresh, me) && !L.shouldRelease(null, me));
  check('[pl-1] จังหวะยืนยันถี่กว่าเพดานอย่างน้อยสามเท่า (ตัวซิงก์ช้ายังไม่ถูกนับว่าปิด)', T.PROJECT_LOCK_STALE_MS >= 3 * T.PROJECT_LOCK_BEAT_MS);
  check('[pl-1] ชื่อไฟล์ล็อกขึ้นต้นด้วยจุด (ตัวเดินโฟลเดอร์ข้าม)', L.LOCK_FILE.startsWith('.'));
}

// ── สำเนาจากตัวซิงก์ ──
{
  const sib = ['ร้านเบเกอรี่.md', 'กลางคืน.md', 'my-scene.md'];
  const cases = [
    ['ร้านเบเกอรี่ (conflicted copy).md', 'ร้านเบเกอรี่.md', 'dropbox'],
    ["ร้านเบเกอรี่ (LAPTOP's conflicted copy 2026-10-23).md", 'ร้านเบเกอรี่.md', 'dropbox'],
    ['กลางคืน.sync-conflict-20261023-101500-ABCDEF1.md', 'กลางคืน.md', 'syncthing'],
    ['my-scene-DESKTOP.md', 'my-scene.md', 'onedrive'],
    ['my-scene-DESKTOP-2.md', 'my-scene.md', 'onedrive'],
    ['กลางคืน (1).md', 'กลางคืน.md', 'gdrive'],
    ['กลางคืน 2.md', 'กลางคืน.md', 'icloud'],
  ];
  for (const [n, of, app] of cases) {
    const r = L.syncCopyOf(n, sib);
    check('[pl-2] ' + app + ': ' + n, r && r.of === of && r.app === app, r);
  }
  check('[pl-2] ไม่มีไฟล์ต้นทางข้าง ๆ = ไม่ใช่สำเนา (ชื่อธรรมดา "ฉาก 2")', L.syncCopyOf('ฉาก 2.md', sib) === null);
  check('[pl-2] ชื่อไม่เข้ารูป = null', L.syncCopyOf('อื่น.md', sib) === null);
  check('[pl-2] ไม่สนตัวพิมพ์ (Windows/macOS)', (L.syncCopyOf('MY-SCENE (1).md', sib) || {}).of === 'my-scene.md');
  check('[pl-2] ตัวเองไม่ใช่สำเนาของตัวเอง', L.syncCopyOf('กลางคืน.md', sib) === null);
  check('[pl-2] machineLabel ตัด .local', L.machineLabel('Noob-MacBook.local') === 'Noob-MacBook');
}

console.log(`\nproject-lock: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
