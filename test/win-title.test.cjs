// test/win-title.test.cjs — [alpha.169] ชื่อแถบชื่อหน้าต่าง + ไอคอนโปรแกรม
// (เดิมชื่อ starter-art.test.cjs — [alpha.170] ช่องภาพประกอบแบบ setup wizard ของ Story Starter ถูกถอดออกตามที่ผู้ใช้สั่ง เหลือด่านกันย้อนกลับท้ายไฟล์)
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
function load(rel, name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name + '-test.cjs');
  esbuild.buildSync({ entryPoints: [path.join(ROOT, rel)], outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(tmp);
}
const W = load('src/win-title.js', 'win-title');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ═══════════ ชื่อแถบชื่อหน้าต่าง + เลขรุ่น ═══════════
check('เลขรุ่น: เติม v นำหน้า · ไม่ซ้อน v', W.versionLabel('2.0.0-alpha.169') === 'v2.0.0-alpha.169' && W.versionLabel('v1.2') === 'v1.2');
check('เลขรุ่นว่าง = ไม่มีป้าย', W.versionLabel('') === '' && W.versionLabel(null) === '');
{
  const t = W.windowTitle('ปีศาจแห่งบางกอก', '2.0.0-alpha.169');
  check('★ มีผลงาน: <ผลงาน> — Killian 2 + เลขรุ่น', t.main === 'ปีศาจแห่งบางกอก — Killian 2' && t.version === 'v2.0.0-alpha.169'
        && t.full === 'ปีศาจแห่งบางกอก — Killian 2 v2.0.0-alpha.169', JSON.stringify(t));
  const n = W.windowTitle('', '2.0.0');
  check('★ ไม่มีผลงาน: Killian 2 + เลขรุ่น (ไม่ค้างชื่อเรื่องเดิม)', n.main === 'Killian 2' && n.full === 'Killian 2 v2.0.0');
  check('ไม่รู้เลขรุ่น = ไม่มีช่องว่างท้าย', W.windowTitle('ก', '').full === 'ก — Killian 2');
}
{
  // ทางประกอบชื่อเองต้องไม่กลับมา (เดิมสามที่ และไม่มีที่ไหนล้างตอนปิดผลงาน)
  const offenders = [];
  for (const f of ['src/app.js', 'src/dialogs.js', 'src/tree-actions.js']) {
    const s = read(f);
    if (/document\.title\s*=/.test(s) || /' — Killian 2'/.test(s)) offenders.push(f);
  }
  check('★ ไม่มีที่ไหนประกอบชื่อหน้าต่างเอง (ผ่าน applyWindowTitle ที่เดียว)', offenders.length === 0, offenders.join());
  const app = read('src/app.js');
  check('ปิดผลงานแล้วล้างชื่อบนแถบชื่อ', /state\.root = null;\s*\n\s*applyWindowTitle\(''\)/.test(app));
  const css = read('renderer/style.css');
  check('หน้าแรก (k-home-only) ยังเห็นชื่อ + เลขรุ่นบนแถบชื่อ', /body\.k-home-only #titlebar > \*:not\(#win-btns\):not\(#tb-logo\):not\(#tb-title\)/.test(css));
}

// ═══════════ ไอคอนของโปรแกรม ═══════════
{
  const svg = read('icons/app-icon.svg');
  // โลโก้ที่ผู้ใช้ออกแบบ: วงกลมไล่สีส้มของโปรแกรม (#FF6640) → กรมท่าเข้ม (#150C36) · ขนนกเป็นช่องโปร่ง
  check('★ ไอคอนใช้สีส้มประจำโปรแกรมและมีการไล่สี', /#ff6640/i.test(svg) && /#150c36/i.test(svg) && /<radialGradient|<linearGradient/.test(svg));
  check('ไอคอนเป็นเส้นรูปทรงเส้นเดียว ไม่มีเศษเส้นจากการตัดรูปทรง (เส้นย่อยที่ไม่มีพื้นที่ขึ้นเป็นเส้นผมที่ขอบ)',
        (svg.match(/<path /g) || []).length === 1 && ((/ d="([^"]+)"/.exec(svg) || [])[1] || '').split(/(?=M)/).length === 1);
  check('ไอคอนไม่ใช่ตัวหนังสือชั่วคราวแล้ว (ไม่มี <text>)', !/<text[\s>]/.test(svg));
  check('build ก๊อปไอคอนเข้า renderer/assets', read('build.js').includes("'renderer', 'assets', 'app-icon.svg'"));
  check('มีไฟล์ไอคอนที่สร้างแล้วครบ (.ico · .png · หน้าต่าง)',
        ['build/icon.ico', 'build/icon.png', 'renderer/assets/app-icon.png'].every((f) => fs.existsSync(path.join(ROOT, f))));
  const html = read('renderer/index.html');
  check('โลโก้บนแถบชื่อ = ไอคอนของโปรแกรม (ไม่ใช่ตัวหนังสือ K2) สองฉบับ: สี + ขาว',
        /<span id="tb-logo"><img class="k-logo-color" src="assets\/app-icon\.svg"[^>]*><img class="k-logo-white" src="assets\/app-icon-white\.svg"/.test(html));
  // ── โลโก้ตามพื้นหลัง: ขาวบนพื้นมืด · สีบนพื้นสว่าง ──
  const whiteP = path.join(ROOT, 'renderer/assets/app-icon-white.svg');
  check('★ build สร้างฉบับขาวจากไฟล์เดียวกัน', fs.existsSync(whiteP));
  if (fs.existsSync(whiteP)) {
    const white = fs.readFileSync(whiteP, 'utf8');
    const dOf = (x) => (/ d="([^"]+)"/.exec(x) || [])[1];
    check('★ ฉบับขาว = เส้นเดียวกับฉบับสีทุกจุด เติมขาวล้วน ไม่มีไล่สี',
          dOf(white) === dOf(svg) && /fill="#ffffff"/.test(white) && !/Gradient|url\(#/.test(white)
          && (/viewBox="([^"]+)"/.exec(white) || [])[1] === (/viewBox="([^"]+)"/.exec(svg) || [])[1]);
  }
  const cssL = read('renderer/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  check('★ CSS: ธีมมืด = ฉบับขาว · ธีมสว่าง = ฉบับสี',
        /img\.k-logo-color \{ display:none !important; \}/.test(cssL)
        && /html\[data-theme-mode="light"\] img\.k-logo-color \{ display:block !important; \}/.test(cssL)
        && /html\[data-theme-mode="light"\] img\.k-logo-white \{ display:none !important; \}/.test(cssL));
  check('โหมดของธีมถูกบอกที่ <html> ทั้งตอนบูต (ก่อนเฟรมแรก) และตอนเปลี่ยนธีม',
        /dataset\.themeMode = mode/.test(read('renderer/theme-boot.js')) && /documentElement\.dataset\.themeMode = mode/.test(read('src/app.js')));
  check('หน้าจอเปิด (พื้นมืดเสมอ) ใช้ฉบับขาว · กล่องเกี่ยวกับ (พื้นสว่างเสมอ) ใช้ฉบับสี',
        /id="brand"><img src="assets\/app-icon-white\.svg"/.test(read('renderer/splash.html')) && read('src/app.js').includes("logo.src = 'assets/app-icon.svg'"));
  check('หน้าแรกมีโลโก้สองฉบับให้ CSS เลือก', /'k-logo-color', 'app-icon\.svg'\], \['k-logo-white', 'app-icon-white\.svg'/.test(read('src/home-ui.js')));
  check('กล่องเกี่ยวกับ/หน้าจอเปิดไม่เหลือกรอบ LOGO PLACEHOLDER',
        !fs.existsSync(path.join(ROOT, 'renderer/about/logo.svg')) && !fs.existsSync(path.join(ROOT, 'renderer/splash/logo-placeholder.svg'))
        && !read('renderer/splash.html').includes('logo-placeholder') && read('src/app.js').includes("logo.src = 'assets/app-icon.svg'"));
  check('หน้าต่างได้ไอคอน (รันจากซอร์ส/Linux ไม่มีไอคอนของ exe)', (read('main.js').match(/\.\.\.WIN_ICON/g) || []).length >= 3);
}

// ═══════════ [alpha.170] Story Starter ไม่มีช่องภาพประกอบแบบ setup wizard แล้ว ═══════════
// ผู้ใช้: "story starter ตัดรูป ที่เหมือน setup wizzard ออกดีกว่าไม่ชอบเลย"
{
  const css = read('renderer/style.css');
  check('★ ไม่มีโมดูล/โฟลเดอร์ของช่องภาพเหลือ', !fs.existsSync(path.join(ROOT, 'src/starter/starter-art.js')) && !fs.existsSync(path.join(ROOT, 'renderer/starter')));
  check('★ ตัววาดของ Story Starter ไม่สร้างช่องภาพ', !/artBox|starter-art|st-art/.test(read('src/starter/starter-wizard.js') .replace(/\/\/.*$/gm, ''))
        && !/artBox|starter-art|st-art/.test(read('src/starter/starter-ui.js').replace(/\/\/.*$/gm, '')));
  check('เนื้อขั้นของ wizard ต่อกับตัว wizard ตรง ๆ (ไม่มีคอลัมน์ภาพคั่น)', /const body = el\('div', 'st-wz-body'\);\s*\n\s*wrap\.append\(body\);/.test(read('src/starter/starter-wizard.js')));
  check('CSS ไม่มีกฎของช่องภาพ/คอลัมน์ภาพ/container ที่ใช้เลือกแถบภาพ', !/\.st-art|\.st-wz-main|\.st-wz-col|@container stw|container:stw/.test(css));
  check('main/preload ไม่มีช่องถามรายชื่อไฟล์ภาพ', !/starter:artList/.test(read('main.js')) && !/starterArtList/.test(read('preload.js')));
  const th = read('languages/k2_th.csv');
  check('ไฟล์ภาษาไม่มีข้อความของช่องภาพค้าง', !/^ui\.starter\.artHint,/m.test(th));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
