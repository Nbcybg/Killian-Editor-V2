// test/disk-conflict.test.cjs — [alpha.156] ไฟล์ถูกแก้นอกโปรแกรมระหว่างที่แท็บเปิดอยู่
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-disk-conflict-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'disk-conflict.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const C = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

check('ดิสก์เท่าที่แท็บรู้จัก = none', C.diskConflict({ diskBody: 'ก', baseBody: 'ก', tabBody: 'กข' }) === 'none');
check('ต่างแค่ \\r\\n/ช่องว่างท้าย = none', C.diskConflict({ diskBody: 'ก\r\nข\n\n', baseBody: 'ก\nข', tabBody: 'x' }) === 'none');
check('ดิสก์ถูกแก้ แต่ตรงกับแท็บพอดี = same', C.diskConflict({ diskBody: 'ใหม่', baseBody: 'เก่า', tabBody: 'ใหม่' }) === 'same');
check('ดิสก์ถูกแก้นอกโปรแกรม = external', C.diskConflict({ diskBody: 'แก้ใน VS Code', baseBody: 'เก่า', tabBody: 'พิมพ์ในแท็บ' }) === 'external');
check('ไฟล์หาย = deleted', C.diskConflict({ diskBody: null, baseBody: 'เก่า', tabBody: 'x' }) === 'deleted');

check('โฟกัสกลับ: ไม่ค้าง + ดิสก์เปลี่ยน = reload', C.focusAction({ dirty: false, diskBody: 'ใหม่', baseBody: 'เก่า' }) === 'reload');
check('โฟกัสกลับ: มีงานค้าง = keep (ห้ามแตะ)', C.focusAction({ dirty: true, diskBody: 'ใหม่', baseBody: 'เก่า' }) === 'keep');
check('โฟกัสกลับ: ไม่เปลี่ยน = none', C.focusAction({ dirty: false, diskBody: 'เก่า\n', baseBody: 'เก่า' }) === 'none');
check('โฟกัสกลับ: ไฟล์หาย = none (ไม่ปิดแท็บเอง)', C.focusAction({ dirty: false, diskBody: null, baseBody: 'เก่า' }) === 'none');

console.log(`\ndisk-conflict: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
if (fail) process.exit(1);
