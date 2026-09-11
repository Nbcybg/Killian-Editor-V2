// test/file-url.test.cjs — [alpha.148] path → file:// ต้องไม่พังเพราะ # ? % / Windows / UNC
const path = require('path');
const out = path.join(require('os').tmpdir(), '_fileurl.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/file-url.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const { fileUrlFromPath } = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

{
  const p = '/Users/top/นิยาย #2/Images/ปก?1%.png';
  const u = fileUrlFromPath(p);
  check('★ ขึ้นต้น file:/// บน macOS/Linux', u.startsWith('file:///Users/'), u);
  check('★ # ถูกเข้ารหัส (ไม่กลายเป็น fragment)', !u.includes('#') && u.includes('%23'), u);
  check('? และ % ถูกเข้ารหัส', !u.includes('?') && u.includes('%3F') && u.includes('%25'), u);
  check('ถอดกลับได้ path เดิมทุกตัวอักษร', decodeURIComponent(new URL(u).pathname) === p,
        decodeURIComponent(new URL(u).pathname));
  check('URL ไม่มีส่วน hash/search เลย', new URL(u).hash === '' && new URL(u).search === '');
}
{
  const u = fileUrlFromPath('C:\\Users\\Top\\งาน เขียน\\a.png');
  check('★ Windows: file:///C:/…', u.startsWith('file:///C:/Users/Top/'), u);
  check('Windows: ช่องว่างถูกเข้ารหัส', u.includes('%20') && new URL(u).host === '', u);
}
{
  const u = fileUrlFromPath('\\\\server\\share\\ปก.png');
  check('UNC: ชื่อเครื่องอยู่ที่ host', new URL(u).host === 'server' && u.startsWith('file://server/share/'), u);
}
{
  check('.. คงไว้ให้เบราว์เซอร์คลี่เอง', fileUrlFromPath('/a/b/../Images/x.png') === 'file:///a/b/../Images/x.png');
  check('ค่าว่าง = ว่าง', fileUrlFromPath('') === '' && fileUrlFromPath(null) === '');
  check('ตรงกับ pathToFileURL ของ node (posix)', (() => {
    const p = '/tmp/k2proj/เล่ม 1/Images/รูป.png';
    return new URL(fileUrlFromPath(p)).href === require('url').pathToFileURL(p).href;
  })());
}

console.log(`\nfile-url: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
