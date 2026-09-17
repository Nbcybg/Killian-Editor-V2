// test/file-url.test.cjs — [alpha.148] path → file:// ต้องไม่พังเพราะ # ? % / Windows / UNC
const path = require('path');
const out = path.join(require('os').tmpdir(), '_fileurl.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/file-url.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const { fileUrlFromPath, projectImageUrl } = require(out);

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
    // [alpha.149] บังคับกติกา posix — บน Windows `pathToFileURL('/tmp/…')` เติมไดรฟ์ปัจจุบัน
    // (`file:///C:/tmp/…`) เทสนี้จึงแดงเฉพาะเครื่อง Windows ทั้งที่ตัวแปลงถูก
    return new URL(fileUrlFromPath(p)).href === require('url').pathToFileURL(p, { windows: false }).href;
  })());
}

// ───────── [alpha.149] projectImageUrl: รูปในเนื้อฉากต้องเปิดได้จากที่ไหนก็ได้ ─────────
{
  const R = 'C:\\Users\\Top\\นิยาย #2';
  const u = projectImageUrl(R, '../../../../../Images/sunset.png');
  check('★ path สัมพัทธ์ของฉาก → รูปใต้ <ราก>/Images', u === fileUrlFromPath(R + '/Images/sunset.png'), u);
  check('★ ผลเป็น URL เต็ม (ไม่ขึ้นกับว่า HTML ไปวางที่ไหน)', u.startsWith('file:///C:/Users/Top/'), u);
  check('อัลบั้มย่อยยังอยู่ครบ', projectImageUrl(R, '../../../../../Images/ทดสอบ/รูป 1.png')
        === fileUrlFromPath(R + '/Images/ทดสอบ/รูป 1.png'));
  check('path ที่ขึ้นต้น Images/ (ปกเล่ม/ปกบท)', projectImageUrl(R, 'Images/a.png') === fileUrlFromPath(R + '/Images/a.png'));
  check('แบ็กสแลชแบบ Windows ก็ได้', projectImageUrl(R, '..\\..\\Images\\a.png') === fileUrlFromPath(R + '/Images/a.png'));
  check('URL เต็ม/ข้อมูลฝัง ไม่แตะ', ['data:image/png;base64,AAA', 'https://x.y/a.png', 'file:///C:/a.png']
        .every((x) => projectImageUrl(R, x) === x));
  check('path เต็มบนดิสก์ → file URL', projectImageUrl(R, 'D:/pics/a.png') === 'file:///D:/pics/a.png');
  check('ไม่มีราก = คืนค่าเดิม (ไม่เดา)', projectImageUrl('', '../Images/a.png') === '../Images/a.png');
  check('ค่าว่าง = ว่าง', projectImageUrl(R, '') === '' && projectImageUrl(R, null) === '');
}

console.log(`\nfile-url: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
