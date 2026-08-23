// [alpha.88] ประตูกัน "CHANGELOG ในโปรแกรมค้างอยู่คนละรุ่นกับของจริง"
//
// เมนู "บันทึกการเปลี่ยนแปลง" อ่านจาก `renderer/CHANGELOG.md` (fetch จากหน้า renderer)
// เพราะ electron-builder แพ็กแค่ `renderer/**` — ไฟล์ที่รากไม่ติดไปกับ asar
// เดิมสำเนานี้ถูกก๊อปด้วยมือครั้งเดียวแล้วไม่มีใครแตะอีก → ค้างที่ alpha.75 ขณะที่ของจริงถึง .88
// ตอนนี้ `build.js` ก๊อปให้ทุกครั้ง เทสนี้กันไม่ให้ใครเผลอถอดออก (หรือ commit สำเนาเก่าทับ)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + extra)); }
}

const srcP = path.join(ROOT, 'CHANGELOG.md');
const dstP = path.join(ROOT, 'renderer', 'CHANGELOG.md');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

check('มี CHANGELOG.md ที่ราก (แหล่งความจริง)', fs.existsSync(srcP));
check('มีสำเนาใน renderer/ (ตัวที่โปรแกรมอ่านจริง)', fs.existsSync(dstP));

if (fs.existsSync(srcP) && fs.existsSync(dstP)) {
  const a = fs.readFileSync(srcP, 'utf8');
  const b = fs.readFileSync(dstP, 'utf8');
  check('★ สำเนาใน renderer ตรงกับของจริงทุกไบต์ (build.js ก๊อปให้)', a === b,
    'ราก ' + a.length + ' ไบต์ vs renderer ' + b.length + ' ไบต์ — ลืมรัน `node build.js` หรือเปล่า');

  // หัวข้อรุ่นบนสุดต้องเป็นรุ่นปัจจุบันใน package.json
  const top = (b.match(/^## alpha\.([0-9a-z.]+)/m) || [])[1] || '';
  const ver = String(pkg.version || '').replace(/^.*alpha\./, '');
  check('★ รุ่นบนสุดของ changelog ตรงกับ package.json', top === ver,
    'changelog=' + top + ' vs package.json=' + ver);
}

// build.js ต้องยังก๊อปอยู่ — ถอดออกเมื่อไหร่ สำเนาจะค้างอีกโดยไม่มีใครรู้
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
check('build.js ยังก๊อป CHANGELOG เข้า renderer/ อยู่',
  /syncChangelog\s*\(\s*\)/.test(build) && /CHANGELOG\.md/.test(build));

// และ renderer/** ต้องถูกแพ็กจริง (เหตุผลที่ต้องมีสำเนาตั้งแต่แรก)
check('electron-builder แพ็ก renderer/** (ที่มาของกติกานี้)',
  (pkg.build && pkg.build.files || []).some((f) => String(f).startsWith('renderer/')));

console.log('');
console.log('--- RESULT ---');
console.log('PASS ' + pass + '  FAIL ' + fail);
if (fail) process.exit(1);
