// test/err-text.test.cjs — [alpha.162 · W4] ข้อความผิดพลาดที่ผู้ใช้อ่านรู้เรื่อง
//
// ต้นตอ: ทั่วโปรแกรมเขียน `setStatus(t('...fail') + e.message)` ซึ่งเอาข้อความของระบบปฏิบัติการ
// ดิบ ๆ ขึ้นจอ (`EPERM: operation not permitted, rename 'C:\…'`) — เป็นภาษาอังกฤษเสมอ
// ไม่ว่าจะตั้งภาษาอะไร และไม่บอกว่าต้องทำอะไรต่อ
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_errtext162.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/err-text.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const E = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ errCode — แกะรหัสจากทุกทรงที่เจอจริง ═══════════
{
  check('อ่านจาก e.code ตรง ๆ', E.errCode({ code: 'ENOENT' }) === 'ENOENT');
  check('อ่านจากข้อความเมื่อไม่มี code (Electron ห่อมาหลายชั้น)',
        E.errCode(new Error("ENOENT: no such file or directory, open 'C:/x.md'")) === 'ENOENT');
  check('★ Windows คืน UNKNOWN ตอนไฟล์ถูกล็อกชั่วคราว = ถือว่าไฟล์ไม่ว่าง',
        E.errCode({ code: 'UNKNOWN' }) === 'EBUSY');
  check('ข้อความเครือข่ายของ fetch', E.errCode(new Error('fetch failed')) === 'ECONNREFUSED');
  check('JSON พัง', E.errCode(new Error('Unexpected token < in JSON at position 0')) === 'EJSON');
  check('รหัสที่ไม่รู้จัก = ว่าง (ตกไปใช้ข้อความเดิม)', E.errCode({ code: 'EWEIRD' }) === '');
  check('ค่าว่าง/null ไม่พัง', E.errCode(null) === '' && E.errCode(undefined) === '');
}

// ═══════════ errText — ต้องเป็นข้อความที่แปลแล้ว ไม่ใช่รหัสดิบ ═══════════
{
  const th = (s) => /[ก-๙]/.test(s);
  for (const [e, name] of [
    [{ code: 'ENOENT' }, 'ไฟล์หาย'],
    [{ code: 'EPERM' }, 'ไม่มีสิทธิ์'],
    [{ code: 'EACCES' }, 'ไม่มีสิทธิ์ (EACCES)'],
    [{ code: 'EBUSY' }, 'ไฟล์ไม่ว่าง'],
    [{ code: 'ENOSPC' }, 'ดิสก์เต็ม'],
    [{ code: 'EROFS' }, 'เขียนไม่ได้'],
    [{ code: 'EISDIR' }, 'เป็นโฟลเดอร์'],
    [{ code: 'EMFILE' }, 'เปิดไฟล์มากเกิน'],
    [{ code: 'ETIMEDOUT' }, 'เครือข่าย'],
  ]) {
    const s = E.errText(e);
    check('★ ' + name + ': ได้ประโยคภาษาไทย ไม่ใช่รหัสดิบ', th(s) && !/^E[A-Z]+/.test(s), s);
  }
  check('★★ ข้อความ EPERM เต็ม ๆ ของ Windows ถูกแปลทั้งก้อน',
        th(E.errText(new Error("EPERM: operation not permitted, rename 'C:\\\\proj\\\\a.md' -> 'C:\\\\proj\\\\b.md'")))
        && !E.errText(new Error("EPERM: operation not permitted, rename 'C:\\\\a'")).includes('EPERM'),
        E.errText(new Error('EPERM: operation not permitted')));
  check('ไม่มีข้อผิดพลาด = ข้อความกลาง (ไม่ใช่ค่าว่าง)', E.errText(null).length > 4);
  // ของที่ไม่รู้จัก: คืนข้อความเดิม แต่ตัดสั้นและปิดบังความลับ
  const long = 'x'.repeat(500);
  check('ข้อความยาวถูกตัดให้พอดีแถบสถานะ', E.errText(new Error(long)).length <= 170, E.errText(new Error(long)).length);
  check('★ คีย์ลับไม่หลุดขึ้นจอ',
        !E.errText(new Error('bad key sk-abcdef123456789')).includes('abcdef123456789'),
        E.errText(new Error('bad key sk-abcdef123456789')));
}

// ═══════════ failText — ประกอบกับ "สิ่งที่ทำไม่สำเร็จ" ═══════════
{
  const s = E.failText('เปิดไฟล์ไม่สำเร็จ:', { code: 'ENOENT' });
  check('ตัดเครื่องหมายท้ายหัวข้อแล้วต่อด้วยเหตุผล', s.startsWith('เปิดไฟล์ไม่สำเร็จ —') && s.length > 20, s);
  check('ไม่มีเหตุผล = เหลือแค่หัวข้อเดิม', E.failText('ทำไม่สำเร็จ', null).startsWith('ทำไม่สำเร็จ'));
}

console.log(`\nerr-text: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
