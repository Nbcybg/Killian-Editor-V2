// test/plugin-install.test.cjs — [alpha.80] ติดตั้งปลั๊กอินจากลิงก์ GitHub
//
// จุดที่พลาดแล้วอันตรายจริง: **zip-slip** — ซิปที่มี path `../../` เขียนทับไฟล์นอกโฟลเดอร์ได้
// เทสนี้จึงเน้นเรื่องความปลอดภัยของ path เป็นหลัก
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_pinstall.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/plugins/plugin-install.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const P = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ parseSource ═══════════
{
  const a = P.parseSource('https://github.com/top/killian-plugin');
  check('ลิงก์ repo เต็ม', a.ok && a.kind === P.SRC_GITHUB && a.owner === 'top'
        && a.repo === 'killian-plugin', JSON.stringify(a));
  check('ไม่มี https ก็ได้', P.parseSource('github.com/top/abc').ok === true);
  check('ทางลัด user/repo', (() => {
    const x = P.parseSource('top/abc');
    return x.ok && x.owner === 'top' && x.repo === 'abc';
  })());
  check('ตัด .git ท้ายชื่อ repo', P.parseSource('https://github.com/top/abc.git').repo === 'abc');

  const br = P.parseSource('https://github.com/top/abc/tree/dev');
  check('อ่าน branch จาก /tree/', br.ref === 'dev' && br.sub === '', JSON.stringify(br));
  const sub = P.parseSource('https://github.com/top/abc/tree/dev/plugins/hello');
  check('อ่านโฟลเดอร์ย่อยด้วย', sub.ref === 'dev' && sub.sub === 'plugins/hello', JSON.stringify(sub));

  const z = P.parseSource('https://example.com/a/b.zip');
  check('ซิปตรง ๆ', z.ok && z.kind === P.SRC_ZIP && z.url.endsWith('b.zip'));
  check('ซิปพร้อม query string', P.parseSource('https://x.com/a.zip?token=1').ok === true);

  check('ค่าว่าง = ไม่ผ่าน', P.parseSource('').ok === false && P.parseSource(null).ok === false);
  check('ลิงก์ที่ไม่ใช่ซิป/ไม่ใช่ github = ไม่ผ่าน',
        P.parseSource('https://example.com/hello').ok === false);
  check('ข้อความมั่ว = ไม่ผ่าน', P.parseSource('ติดตั้งปลั๊กอินให้หน่อย').ok === false);
  check('ทุกกรณีที่ไม่ผ่านมีเหตุผลเป็นคีย์ภาษา',
        ['', 'https://example.com/x', 'มั่ว'].every((x) => /^ui\.plug\./.test(P.parseSource(x).reason)));
  // ห้ามรับโปรโตคอลไฟล์ในเครื่อง
  check('file:// ไม่ผ่าน', P.parseSource('file:///C:/evil.zip').ok === false);
}

// ═══════════ zipCandidates ═══════════
{
  const src = P.parseSource('https://github.com/top/abc');
  const c = P.zipCandidates(src);
  check('ไม่ระบุ branch → ลอง main แล้ว master', c.length === 2
        && c[0].includes('/refs/heads/main') && c[1].includes('/refs/heads/master'), JSON.stringify(c));
  check('ใช้ codeload (ไม่กินโควตา API)', c.every((u) => u.startsWith('https://codeload.github.com/')));
  check('ระบุ branch → ลองอันเดียว',
        P.zipCandidates(P.parseSource('https://github.com/top/abc/tree/dev')).length === 1);
  check('ซิปตรง ๆ → ใช้ URL นั้นเลย',
        P.zipCandidates(P.parseSource('https://x.com/a.zip'))[0] === 'https://x.com/a.zip');
  check('ที่มาไม่ผ่าน → ไม่มี URL', P.zipCandidates(P.parseSource('')).length === 0
        && P.zipCandidates(null).length === 0);
}

// ═══════════ pickPluginRoot ═══════════
{
  const flat = ['abc-main/plugin.json', 'abc-main/main.js', 'abc-main/README.md'];
  const r1 = P.pickPluginRoot(flat);
  check('เจอ plugin.json ใต้โฟลเดอร์ห่อของ GitHub', r1.ok && r1.root === 'abc-main', JSON.stringify(r1));

  const nested = ['repo-main/README.md', 'repo-main/plugins/hello/plugin.json',
                  'repo-main/plugins/hello/main.js'];
  check('อยู่ลึกก็หาเจอ', P.pickPluginRoot(nested).root === 'repo-main/plugins/hello');

  // มีหลายตัว → เอาตัวตื้นที่สุด
  const many = ['r-main/plugin.json', 'r-main/x/plugin.json'];
  check('มีหลายตัว → เอาตัวตื้นที่สุด', P.pickPluginRoot(many).root === 'r-main');

  // ระบุโฟลเดอร์ย่อย
  const two = ['r-main/plugins/a/plugin.json', 'r-main/plugins/b/plugin.json'];
  check('ระบุโฟลเดอร์ย่อย → ได้ตัวที่ขอ',
        P.pickPluginRoot(two, 'plugins/b').root === 'r-main/plugins/b');
  check('ระบุโฟลเดอร์ย่อยที่ไม่มี → ไม่ผ่านพร้อมเหตุผล', (() => {
    const x = P.pickPluginRoot(two, 'plugins/zzz');
    return x.ok === false && x.reason === 'ui.plug.errSubNotFound';
  })());

  check('ไม่มี plugin.json เลย → ไม่ผ่าน', (() => {
    const x = P.pickPluginRoot(['a/README.md']);
    return x.ok === false && x.reason === 'ui.plug.errNoManifest';
  })());
  check('รายการว่างไม่พัง', P.pickPluginRoot([]).ok === false && P.pickPluginRoot(null).ok === false);
  check('plugin.json อยู่รากซิปเลยก็ได้', P.pickPluginRoot(['plugin.json', 'main.js']).root === '');
}

// ═══════════ filesToInstall + ความปลอดภัย ═══════════
{
  const paths = ['abc-main/plugin.json', 'abc-main/main.js', 'abc-main/lib/util.js',
                 'abc-main/README.md', 'abc-main/', 'other/file.txt'];
  const f = P.filesToInstall(paths, 'abc-main');
  check('ตัดคำนำหน้าออก', f.some((x) => x.to === 'plugin.json' && x.from === 'abc-main/plugin.json'));
  check('เก็บโครงโฟลเดอร์ย่อย', f.some((x) => x.to === 'lib/util.js'));
  check('ข้ามโฟลเดอร์เปล่า', !f.some((x) => x.to === ''));
  check('ข้ามไฟล์นอกโฟลเดอร์ปลั๊กอิน', !f.some((x) => x.from === 'other/file.txt'));
  check('จำนวนไฟล์ถูก', f.length === 4, f.length);

  // ── zip-slip: ห้ามหลุดออกนอกโฟลเดอร์ปลายทางเด็ดขาด ──
  check('ปฏิเสธ ../ ใน path', P.isSafeRel('../evil.js') === false);
  check('ปฏิเสธ ../ ที่ซ่อนอยู่กลาง path', P.isSafeRel('lib/../../evil.js') === false);
  check('ปฏิเสธ path แบบ absolute', P.isSafeRel('/etc/passwd') === false);
  check('ปฏิเสธ path แบบ C:\\', P.isSafeRel('C:/Windows/x.dll') === false);
  check('ปฏิเสธแบ็กสแลชที่แปลงแล้วยังหลุด', P.isSafeRel('..\\evil.js') === false);
  check('path ปกติผ่าน', P.isSafeRel('lib/util.js') === true && P.isSafeRel('main.js') === true);
  check('filesToInstall ไม่ปล่อยไฟล์อันตรายผ่าน',
        P.filesToInstall(['r/../../evil.js', 'r/ok.js'], 'r').every((x) => x.to === 'ok.js'));

  // ขยะที่ไม่ควรติดตั้ง
  check('ข้าม .git/', P.isJunk('.git/config') === true);
  check('ข้าม node_modules/', P.isJunk('node_modules/x/index.js') === true);
  check('ข้าม __MACOSX/', P.isJunk('__MACOSX/._main.js') === true);
  check('ข้าม .DS_Store', P.isJunk('lib/.DS_Store') === true);
  check('ไฟล์ปกติไม่ถูกมองว่าขยะ', P.isJunk('main.js') === false && P.isJunk('lib/a.js') === false);
  check('filesToInstall กรองขยะออกจริง',
        P.filesToInstall(['r/.git/config', 'r/main.js', 'r/node_modules/a.js'], 'r').length === 1);
}

// ═══════════ installSummary ═══════════
{
  const s = P.installSummary([{ to: 'main.js', size: 100 }, { to: 'a.png', size: 50 }]);
  check('นับไฟล์และขนาด', s.count === 2 && s.bytes === 150, JSON.stringify(s));
  check('บอกว่ามีโค้ดที่รันได้', s.hasCode === true);
  check('ไม่มีโค้ด → hasCode false',
        P.installSummary([{ to: 'a.png', size: 1 }]).hasCode === false);
  check('รายการว่างไม่พัง', P.installSummary(null).count === 0);
  check('มีคีย์คำเตือนก่อนติดตั้ง', /^ui\.plug\./.test(P.INSTALL_WARN_KEY));
}

console.log(`\nplugin-install: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
