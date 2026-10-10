// test/starter-art.test.cjs — [alpha.169] ช่องใส่ภาพประกอบของ Story Starter (แบบ setup wizard) + ชื่อแถบชื่อหน้าต่าง + ไอคอนโปรแกรม
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
const A = load('src/starter/starter-art.js', 'starter-art');
const W = load('src/win-title.js', 'win-title');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ═══════════ ขนาดของช่องภาพ (สเปกที่คนทำภาพยึด) ═══════════
check('★ side = ไฟล์ 480×920 แสดง 240×460 (สองเท่าพอดี)',
      A.ART_SLOTS.side.w === 480 && A.ART_SLOTS.side.h === 920 && A.ART_SLOTS.side.cssW === 240 && A.ART_SLOTS.side.cssH === 460);
check('★ top = ไฟล์ 1200×300 (4:1)', A.ART_SLOTS.top.w === 1200 && A.ART_SLOTS.top.h === 300 && A.artRatio('top') === 4);
check('ข้อความขนาด', A.artSizeText('side') === '480 × 920' && A.artSizeText('top') === '1200 × 300');
check('ตำแหน่งที่ไม่รู้จัก = top', A.artSizeText('zzz') === '1200 × 300' && A.artBase('tags', 'zzz') === 'tags-top');

// ═══════════ ชื่อไฟล์ ═══════════
check('ชื่อไฟล์ = <ช่อง>-<ตำแหน่ง>', A.artBase('tags', 'side') === 'tags-side' && A.artBase('home', 'top') === 'home-top');
check('ชื่อช่องถูกกรอง (ห้ามมีตัวคั่นทาง/จุด)', A.artKey('../x/y') === 'xy' && A.artKey('') === 'default' && A.artKey(null) === 'default'
      && A.artKey('Cast') === 'cast');
{
  const c = A.artCandidates('tags', 'side');
  check('ลำดับที่ลอง: ของช่องก่อน (png → jpg → webp) แล้วค่อย default',
        c[0] === 'starter/tags-side.png' && c[1] === 'starter/tags-side.jpg' && c[2] === 'starter/tags-side.webp'
        && c[3] === 'starter/default-side.png' && c.length === 6, JSON.stringify(c));
  check('ช่อง default ไม่ลองซ้ำสองรอบ', A.artCandidates('default', 'top').length === 3);
}

// ═══════════ เลือกจากรายชื่อไฟล์ที่มีจริง ═══════════
check('มีไฟล์ของขั้น → ใช้ของขั้น', A.pickArt(['tags-side.png', 'default-side.png'], 'tags', 'side') === 'starter/tags-side.png');
check('★ ไม่มีของขั้น → ใช้ default', A.pickArt(['default-side.png'], 'cast', 'side') === 'starter/default-side.png');
check('★ ไม่มีอะไรเลย → null (วาด placeholder)', A.pickArt([], 'cast', 'side') === null && A.pickArt(null, 'cast', 'top') === null);
check('คนละตำแหน่งไม่ใช้แทนกัน', A.pickArt(['tags-top.png'], 'tags', 'side') === null);
check('นามสกุลอื่น + ตัวพิมพ์ต่างกัน (ระบบไฟล์ของ Windows ไม่แยก) → คืนชื่อจริงบนดิสก์',
      A.pickArt(['Tags-Side.JPG'], 'tags', 'side') === 'starter/Tags-Side.JPG');
check('png มาก่อน jpg เมื่อมีทั้งคู่', A.pickArt(['w-top.jpg', 'w-top.png'], 'w', 'top') === 'starter/w-top.png');

// ═══════════ ตารางไฟล์ทั้งหมด ↔ ทะเบียนขั้นจริง ↔ README ═══════════
{
  const defSrc = read('src/starter/starter-steps-def.js');
  const stepIds = [...defSrc.matchAll(/\{ id: '([a-z0-9]+)', icon:/g)].map((m) => m[1]);
  check('อ่าน id ของขั้นจากทะเบียนได้ (≥ 5 ขั้น)', stepIds.length >= 5, stepIds.join());
  const rows = A.artManifest(stepIds);
  check('ตารางไฟล์: default 2 + home 1 + ขั้นละ 2', rows.length === 3 + stepIds.length * 2, String(rows.length));
  check('หน้ารวมมีแต่แถบหัว', rows.filter((r) => r.key === 'home').length === 1 && rows.find((r) => r.key === 'home').slot === 'top');
  const readme = read('renderer/starter/README.md');
  const missing = rows.filter((r) => !readme.includes(path.basename(r.file)));
  check('★ README ของโฟลเดอร์ภาพบอกครบทุกไฟล์ (เพิ่มขั้นใหม่แล้วลืมเอกสาร = แดง)', missing.length === 0, missing.map((r) => r.file).join());
  check('README บอกขนาดตรงกับโค้ด', readme.includes('480 × 920') && readme.includes('1200 × 300'));
}

// ═══════════ CSS ต้องตรงกับค่าคงที่ ═══════════
{
  const css = read('renderer/style.css');
  check('★ เกณฑ์ความกว้างใน CSS = ART_WIDE_MIN', css.includes('@container stw (min-width: ' + A.ART_WIDE_MIN + 'px)'));
  check('★ ขนาดแถบภาพข้างใน CSS = cssW × cssH',
        new RegExp('\\.st-art-side \\{[^}]*width:calc\\(' + A.ART_SLOTS.side.cssW + 'px[^}]*height:calc\\(' + A.ART_SLOTS.side.cssH + 'px').test(css));
  check('แผง Story Starter เป็น container ชื่อ stw', /#starter-body \{[^}]*container:stw \/ inline-size/.test(css));
  const main = read('main.js'), pre = read('preload.js');
  check('main มีช่อง starter:artList ที่ไม่รับอาร์กิวเมนต์', /H\('starter:artList', \(\) =>/.test(main));
  check('preload เปิด starterArtList', /starterArtList: call\('starter:artList'\)/.test(pre));
}

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
