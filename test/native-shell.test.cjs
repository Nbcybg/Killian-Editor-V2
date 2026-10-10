// test/native-shell.test.cjs — [alpha.169 · native] "โปรแกรมจริง ไม่ใช่หน้าเว็บ"
//   ชั้น main (native-shell.cjs) · ชั้นหน้าจอ (src/native-core.js) · ด่านกวาดซอร์ส (CSS/main.js) กันย้อนกลับ
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const NS = require(path.join(ROOT, 'native-shell.cjs'));
const tmp = path.join(os.tmpdir(), 'k2-native-core-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(ROOT, 'src', 'native-core.js')], outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const C = require(tmp);
// ui.js แตะ DOM ตอนใช้งานเท่านั้น — ตัวหนีบตำแหน่งกล่องเป็นฟังก์ชันบริสุทธิ์ เทสจากซอร์สตรง ๆ ด้วยการตัดออกมา
const uiSrc = fs.readFileSync(path.join(ROOT, 'src', 'ui.js'), 'utf8');
const clampSrc = /export function clampDialogOffset\([\s\S]*?\n}/.exec(uiSrc);
const clampDialogOffset = clampSrc ? new Function(clampSrc[0].replace('export function', 'return function'))() : null;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const J = JSON.stringify;

// ───────────── 1) แถบชื่อหน้าต่างตามระบบ ─────────────
{
  const w = NS.windowChrome('win32', { mode: 'dark', color: '#1e1250', symbol: '#ffffff', height: 36 });
  check('★ Windows = แถบชื่อซ่อน + ปุ่มหน้าต่างของระบบ (Snap Layouts)',
        w.native && w.opts.titleBarStyle === 'hidden' && w.opts.titleBarOverlay.color === '#1e1250'
        && w.opts.titleBarOverlay.symbolColor === '#ffffff' && w.opts.titleBarOverlay.height === 36 && !('frame' in w.opts), J(w));
  const m = NS.windowChrome('darwin', {});
  check('★ macOS = hiddenInset (ไฟจราจร) + ตำแหน่งปุ่มกึ่งกลางแถบ',
        m.native && m.opts.titleBarStyle === 'hiddenInset' && m.opts.trafficLightPosition.y > 0 && !m.opts.titleBarOverlay, J(m));
  const l = NS.windowChrome('linux', {});
  check('ระบบอื่น = ไร้ขอบ วาดปุ่มเองเหมือนเดิม', !l.native && l.opts.frame === false && !l.opts.titleBarStyle, J(l));
  check('สีที่ไม่ใช่ #rrggbb ถูกกรองทิ้ง (ไม่ส่งสตริงดิบให้ระบบ)',
        NS.captionColors({ color: 'red; x', symbol: 'rgb(1,2,3)' }).color === '#191816'
        && NS.captionColors({ mode: 'light', color: 'zz' }).color === '#f3f3f3');
  check('ความสูงแถบถูกหนีบ 24–96', NS.captionColors({ height: 5 }).height === 24 && NS.captionColors({ height: 999 }).height === 96
        && NS.captionColors({ height: 43.4 }).height === 43 && NS.captionColors({}).height === NS.TITLEBAR_H);
  const css = fs.readFileSync(path.join(ROOT, 'renderer', 'style.css'), 'utf8');
  check('★ ความสูงแถบใน main ตรงกับ #titlebar ของ style.css',
        new RegExp('#titlebar \\{[^}]*height:' + NS.TITLEBAR_H + 'px').test(css));
  const themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'renderer', 'themes', 'themes.json'), 'utf8'));
  const list = Array.isArray(themes) ? themes : themes.themes;
  check('โหมดของธีมอ่านจาก themes.json (k2 = มืด · k2-light = สว่าง · ไม่รู้จัก = มืด)',
        NS.themeMode(themes, 'k2') === 'dark' && NS.themeMode(themes, 'k2-light') === 'light' && NS.themeMode(themes, 'nope') === 'dark');
  let bad = [];
  for (const t of list) {
    const tcss = fs.readFileSync(path.join(ROOT, 'renderer', 'themes', t.id + '.css'), 'utf8');
    if (!NS.cssVarHex(tcss, 'titlebar') || !NS.cssVarHex(tcss, 'fg')) bad.push(t.id);
  }
  check('★ ทุกธีมมี --titlebar และ --fg เป็น #rrggbb (main อ่านสีปุ่มหน้าต่างก่อน renderer บูต)', !bad.length, bad.join());
}

// ───────────── 2) เปิดด้วยไฟล์/โฟลเดอร์ ─────────────
{
  const P = (...a) => path.resolve(path.join('/k2t', ...a));
  const disk = new Set([P('proj'), P('proj', 'project.khn.json'), P('proj', 'Book', 'Draft', 'a.md'), P('proj', 'Book'), P('proj', 'Book', 'Draft'),
    P('other'), P('other', 'x.txt'), P('app')]);
  const dirs = new Set([P('proj'), P('proj', 'Book'), P('proj', 'Book', 'Draft'), P('other'), P('app')]);
  const io = { exists: (p) => disk.has(path.resolve(p)), isDir: (p) => dirs.has(path.resolve(p)), skip: [P('app')] };
  check('★ โฟลเดอร์โปรเจกต์ → รากโปรเจกต์', NS.projectFromArgv(['exe', P('proj')], io) === P('proj'));
  check('★ ไฟล์ project.khn.json → โฟลเดอร์ของมัน', NS.projectFromArgv(['exe', P('proj', 'project.khn.json')], io) === P('proj'));
  check('★ ไฟล์ฉากข้างในโปรเจกต์ → ไล่ขึ้นไปหาราก', NS.projectFromArgv(['exe', P('proj', 'Book', 'Draft', 'a.md')], io) === P('proj'));
  check('โฟลเดอร์ที่ไม่ใช่โปรเจกต์ → null', NS.projectFromArgv(['exe', P('other')], io) === null);
  check('สวิตช์ของ Chromium ถูกข้าม', NS.projectFromArgv(['exe', '--inspect=9229', '--user-data-dir=' + P('proj'), P('proj')], io) === P('proj'));
  check('ทางที่ไม่มีอยู่จริง → null', NS.projectFromArgv(['exe', P('ghost')], io) === null);
  check('โฟลเดอร์ตัวโปรแกรมเอง (`electron .`) ถูกข้าม', NS.projectFromArgv(['exe', P('app')], io) === null);
  check('argv ว่าง/เพี้ยน ไม่ throw', NS.projectFromArgv(null, io) === null && NS.projectFromArgv(['exe', '', null], io) === null);
}

// ───────────── 3) แถบงาน ─────────────
{
  const t = NS.jumpTasks(['C:/a/นิยาย', 'C:/gone', 'C:/b/"q"'], 'C:/K2.exe', { exists: (p) => p !== 'C:/gone' });
  check('★ รายการบนแถบงาน = โปรเจกต์ล่าสุดที่ยังมีอยู่ (ชื่อ = ชื่อโฟลเดอร์)',
        t.length === 2 && t[0].title === 'นิยาย' && t[0].program === 'C:/K2.exe' && t[0].arguments === '"C:/a/นิยาย"', J(t));
  check('เครื่องหมายคำพูดในทางไฟล์ถูกถอด (ไม่หลุดออกจากอาร์กิวเมนต์)', t[1].arguments === '"C:/b/q"', t[1].arguments);
  check('ไม่รู้ตัว exe = ไม่มีรายการ', NS.jumpTasks(['C:/a'], '').length === 0);
  check('จำกัดจำนวน', NS.jumpTasks(['1', '2', '3', '4', '5', '6', '7', '8'].map((x) => 'C:/' + x), 'e').length === 6);
  check('ค่าแถบความคืบหน้า: 0..1 · busy = 2 · ติดลบ/เพี้ยน = -1',
        NS.progressValue(0.4) === 0.4 && NS.progressValue(7) === 1 && NS.progressValue('busy') === 2
        && NS.progressValue(-1) === -1 && NS.progressValue('x') === -1 && NS.progressValue(0) === 0);
}

// ───────────── 4) ชั้นหน้าจอ ─────────────
{
  check('rgb()/rgba()/hex → #rrggbb', C.rgbToHex('rgb(25, 24, 22)') === '#191816' && C.rgbToHex('rgba(255,0,10,1)') === '#ff000a'
        && C.rgbToHex('#ABC') === '#aabbcc' && C.rgbToHex('#1E1250') === '#1e1250' && C.rgbToHex('rgb(30 18 80 / 100%)') === '#1e1250');
  check('โปร่งใส/อ่านไม่ออก = ว่าง', C.rgbToHex('rgba(0, 0, 0, 0)') === '' && C.rgbToHex('transparent') === '' && C.rgbToHex('') === '');

  const tap = C.createAltTap();
  tap.down({ key: 'Alt', code: 'AltLeft' });
  check('★ แตะ Alt (ลง → ขึ้น ไม่มีอะไรแทรก) = เข้าแถบเมนู', tap.up({ key: 'Alt' }) === true);
  tap.down({ key: 'Alt', code: 'AltLeft' }); tap.down({ key: 'F4', code: 'F4', altKey: true });
  check('★ Alt ค้างแล้วกดคีย์อื่น (Alt+F4) ไม่นับ', tap.up({ key: 'Alt' }) === false);
  tap.down({ key: 'Alt', code: 'AltLeft', ctrlKey: true });
  check('AltGr (Ctrl+Alt) ไม่นับ', tap.up({ key: 'Alt' }) === false);
  tap.down({ key: 'Alt', code: 'AltRight' });
  check('Alt ขวา (AltGr ของหลายแป้น) ไม่นับ', tap.up({ key: 'Alt' }) === false);
  tap.down({ key: 'Alt', code: 'AltLeft' }); tap.cancel();
  check('คลิกเมาส์ระหว่างค้าง Alt (Alt+คลิก) ไม่นับ', tap.up({ key: 'Alt' }) === false);
  check('ปล่อย Alt โดยไม่เคยกดลงในหน้าต่างนี้ ไม่นับ', C.createAltTap().up({ key: 'Alt' }) === false);

  check('เดินแถบเมนู: → ← วนรอบ · Home/End · คีย์อื่น = -1',
        C.menubarStep(9, 8, 'ArrowRight') === 0 && C.menubarStep(9, 0, 'ArrowLeft') === 8 && C.menubarStep(9, 3, 'Home') === 0
        && C.menubarStep(9, 3, 'End') === 8 && C.menubarStep(9, 3, 'a') === -1 && C.menubarStep(0, 0, 'ArrowRight') === -1);

  const is = { isImage: (n) => /\.(png|jpe?g|webp|gif)$/i.test(n), isScreenplay: C.isScreenplayFile };
  check('★ ลากโฟลเดอร์โปรเจกต์ = เปิดโปรเจกต์ (ชนะรูปที่ลากมาด้วยกัน)',
        J(C.classifyOsDrop([{ name: 'a.png', path: 'C:/a.png' }, { name: 'นิยาย', path: 'C:/n', isDir: true, projectRoot: 'C:/n' }], is)) === J({ kind: 'project', root: 'C:/n' }));
  const im = C.classifyOsDrop([{ name: 'a.PNG' }, { name: 'b.txt' }, { name: 'c.jpg' }], is);
  check('★ ลากรูป = รูป (ไฟล์อื่นในชุดเดียวกันถูกข้าม)', im.kind === 'images' && im.items.length === 2);
  check('★ ลากไฟล์บท = นำเข้าบท', C.classifyOsDrop([{ name: 'ep1.fdx', path: 'C:/ep1.fdx' }], is).kind === 'screenplay');
  check('ไฟล์ที่ไม่รู้จัก / โฟลเดอร์ธรรมดา / ว่าง = ไม่รับ',
        C.classifyOsDrop([{ name: 'x.zip' }], is).kind === 'none' && C.classifyOsDrop([{ name: 'รูป.png', isDir: true }], is).kind === 'none'
        && C.classifyOsDrop([], is).kind === 'none' && C.classifyOsDrop(null, is).kind === 'none');
  // นามสกุลบท = ชุดเดียวกับตัวนำเข้า + ตัวกรองของกล่องเปิดไฟล์ (ยกเว้น .txt ที่กำกวม)
  const impSrc = fs.readFileSync(path.join(ROOT, 'src', 'import-sp.js'), 'utf8');
  const exts = [...impSrc.matchAll(/ext:\s*'\.([a-z]+)'/g)].map((m) => m[1]).sort();
  check('★ นามสกุลไฟล์บทที่ลากมาวางได้ ตรงกับตัวนำเข้า (SP_IMPORTERS)', J(exts) === J([...C.SCREENPLAY_EXT].sort()), exts.join());
  check('.txt ไม่ถูกนับเป็นไฟล์บท (กำกวม)', !C.isScreenplayFile('note.txt') && C.isScreenplayFile('A.FOUNTAIN'));

  check('ชื่อไฟล์รูปไม่ชนของเดิม: a.png → a-2.png → a-3.png (ไม่สนตัวพิมพ์)',
        C.freeFileName('a.png', []) === 'a.png' && C.freeFileName('a.png', ['A.PNG']) === 'a-2.png'
        && C.freeFileName('a.png', ['a.png', 'a-2.png']) === 'a-3.png' && C.freeFileName('noext', ['noext']) === 'noext-2');
  check('เรียกความสนใจเฉพาะงานที่นานพอ + ผู้ใช้ไม่ได้อยู่ที่หน้าต่าง',
        C.shouldCallAttention(9000, false, 8000) && !C.shouldCallAttention(9000, true, 8000) && !C.shouldCallAttention(100, false, 8000));
}

// ───────────── 5) กล่องโต้ตอบลากย้ายได้ ─────────────
{
  check('มีตัวหนีบตำแหน่งกล่องใน ui.js', typeof clampDialogOffset === 'function');
  if (clampDialogOffset) {
    const base = { left: 200, top: 72, width: 1040 };
    check('ย้ายในจอ = ได้ตามที่ลาก', J(clampDialogOffset({ x: 50, y: 30 }, base, 1440, 900)) === J({ x: 50, y: 30 }));
    check('★ ลากขึ้นเกินขอบบน = หัวกล่องหยุดที่ขอบ (ไม่หลุดไปใต้แถบชื่อ)', clampDialogOffset({ x: 0, y: -500 }, base, 1440, 900).y === -72);
    check('★ ลากลงเกินจอ = หัวกล่องยังเหลือ 48px', clampDialogOffset({ x: 0, y: 5000 }, base, 1440, 900).y === 900 - 48 - 72);
    check('★ ลากออกซ้าย/ขวา = ยังเหลือ 48px ให้จับ',
          clampDialogOffset({ x: -5000, y: 0 }, base, 1440, 900).x === 48 - 1240 && clampDialogOffset({ x: 5000, y: 0 }, base, 1440, 900).x === 1440 - 48 - 200);
  }
}

// ───────────── 6) ด่านกวาดซอร์ส (กันย้อนกลับเป็นหน้าเว็บ) ─────────────
{
  const css = fs.readFileSync(path.join(ROOT, 'renderer', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  check('★ [native] body ปิดการลากเลือกข้อความของ UI', /(^|\n)body \{[^}]*user-select:none/.test(css));
  check('★ [native] ตัวแก้ไข/ช่องกรอกยังเลือกข้อความได้', /\.ProseMirror,[^{]*\{[^}]*user-select:text/.test(css) && /(^|\n)input, textarea,[^{]*\{[^}]*user-select:text/.test(css));
  check('★ [native] ไม่มี scroll-behavior:smooth ที่ html/body', !/html,\s*body\s*\{[^}]*scroll-behavior:\s*smooth/.test(css));
  // เคอร์เซอร์รูปมือ: เหลือได้เฉพาะของที่เป็นลิงก์ (รายชื่อในด่านนี้) — ปุ่ม/แถว/แท็บ ใช้ลูกศรปกติ
  const LINKISH = /(link|mention|#sp-errors|wiki-prof-avatar|aia-jump|tl-ev-ref|has-wiki|home-card-pathbtn)/;
  const hands = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/cursor\s*:\s*pointer/.test(m[2]) && !LINKISH.test(m[1])) hands.push(m[1].trim().slice(0, 50));
  check('★ [native] cursor:pointer เหลือเฉพาะของที่เป็นลิงก์ (ปุ่ม/แถว/แท็บ = ลูกศรปกติ)', hands.length === 0, hands.slice(0, 6).join(' | '));
  check('[native] ปุ่มมีสภาพกดลง (:active)', /button:not\(:disabled\):active/.test(css));
  check('[native] รูป/ไอคอนของ UI ลากเป็นเงาไม่ได้', /img:not\(\[draggable="true"\]\)[^{]*\{[^}]*-webkit-user-drag:none/.test(css));

  // ── [alpha.169] รอบสอง: ท่าของหน้าเว็บที่เหลือ ──
  // (ก) ชี้แล้วของ "ขยับ" — การ์ดลอยขึ้น/ขยาย/เลื่อนข้างตอน :hover · ที่ยอมได้ต้องประกาศพร้อมเหตุผล
  const HOVER_MOVE_OK = [
    '#k-fab',                     // ปุ่มลอย + = รสนิยมของผู้ใช้ (สั่งไว้ว่าไม่แตะ)
    'input[type="range"]',        // ปุ่มจับของตัวเลื่อนโตขึ้นตอนชี้ = พฤติกรรมของ Windows 11 เอง
    '.bn-port',                   // ขั้วต่อเส้นของผังแตกสาย: เป้าเล็ก ต้องขยายให้เล็งได้ (เครื่องมือบนผืนวาด)
    'transform:none',             // กฎที่ "ยกเลิก" การขยับ
  ];
  const movers = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/:hover/.test(m[1]) || !/transform\s*:/.test(m[2])) continue;
    if (/transform\s*:\s*none/.test(m[2])) continue;
    if (HOVER_MOVE_OK.some((k) => m[1].includes(k))) continue;
    movers.push(m[1].trim().slice(0, 60));
  }
  check('★ [native] ชี้แล้วไม่มีอะไรขยับ (ไม่มี transform ใน :hover นอกรายการที่ประกาศ)', movers.length === 0, movers.slice(0, 6).join(' | '));
  // (ข) กล่องโต้ตอบ: จางเข้าเร็ว ๆ — ไม่เด้งขยายแบบ modal ของเว็บ
  const dlgAnim = /\.k-dialog \{ animation:k2-dlg-in ([\d.]+)s/.exec(css);
  const dlgFrom = /@keyframes k2-dlg-in \{\s*from \{[^}]*scale\(([\d.]+)\)/.exec(css);
  check('★ [native] กล่องโต้ตอบเปิดใน ≤ 0.12s และขยายไม่เกิน 3%', !!dlgAnim && +dlgAnim[1] <= 0.12 && !!dlgFrom && +dlgFrom[1] >= 0.97,
        JSON.stringify([dlgAnim && dlgAnim[1], dlgFrom && dlgFrom[1]]));
  check('[native] สลับแท็บไม่เฟดเอกสาร', !/(^|\n)\.pane \{[^}]*transition:[^}]*opacity/.test(css));
  // (ค) ทูลทิป: ชี้ค้างก่อนจึงขึ้น
  const timingSrc = fs.readFileSync(path.join(ROOT, 'src', 'timing.js'), 'utf8');
  const tipMs = /export const TIP_DELAY_MS = (\d+);/.exec(timingSrc);
  check('★ [native] ทูลทิปรอชี้ค้าง 300–700ms (ไม่ขึ้นทันทีที่เมาส์แตะ)', !!tipMs && +tipMs[1] >= 300 && +tipMs[1] <= 700, tipMs && tipMs[1]);
  const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  check('[native] ตัวดัก mouseover ใช้ตัวหน่วง (hoverTipWait) และยกเลิกเมื่อเมาส์ออกก่อนครบเวลา',
        /const wait = hoverTipWait\(\);/.test(appSrc) && /cancelTipPending\(\)/.test(appSrc));
  // (ง) ช่องวันที่ไม่ใช้ฟอนต์ monospace ของเบราว์เซอร์
  check('[native] ช่องวันที่/เวลาใช้ฟอนต์ของโปรแกรม', /input\[type="date"\][^{]*\{[^}]*font-family:inherit/.test(css));

  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  check('★ [native] หน้าต่างหลักใช้ตัวเลือกจาก windowChrome (ไม่มี frame:false ตายตัว)',
        /\.\.\.CHROME\.opts/.test(main) && !/backgroundColor: userThemeBg\(\),[^\n]*\n\s*frame: false/.test(main));
  check('★ [native] ตั้งโหมดของเมนู/กล่องไฟล์ระบบตามธีม (nativeTheme.themeSource)', /nativeTheme\.themeSource\s*=/.test(main));
  check('★ [native] เปิดซ้ำ/เปิดด้วยไฟล์ → เปิดโปรเจกต์ (second-instance อ่าน argv · open-file ของ macOS)',
        /second-instance', \(e, argv\)/.test(main) && /app\.on\('open-file'/.test(main));
  check('[native] ตัวตนบนแถบงาน + ความคืบหน้า + เรียกความสนใจ',
        /setAppUserModelId\(/.test(main) && /setProgressBar\(/.test(main) && /flashFrame\(true\)/.test(main));
  // เมนูคลิกขวาของ main (ช่องกรอก/ข้อความที่เลือก) ต้องไม่มีคำสั่งของตัวแก้ไข
  const ctx = /webContents\.on\('context-menu'[\s\S]*?menu\.popup\(\{ window: win \}\);/.exec(main);
  check('★ [native] เมนูคลิกขวาของช่องกรอกไม่มี ตัวหนา/แทรกรูป (เป็นของตัวแก้ไข ซึ่งมีเมนูของตัวเอง)',
        !!ctx && !/cmd\('fmt'|insert-image|cmd\('save'\)/.test(ctx[0]) && /role: 'copy'/.test(ctx[0]), ctx ? '' : 'no ctx');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('★ native-shell.cjs อยู่ในรายการไฟล์ของตัวแพ็ก', pkg.build.files.includes('native-shell.cjs'));
  const pre = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
  check('preload มีช่องของชั้นหน้าต่างครบ', ['platform:', 'winState:', 'onWinState:', 'winChrome:', 'winProgress:', 'winAttention:', 'launchProject:', 'pathForFile:']
        .every((k) => pre.includes(k)));
}

// ───────────── [alpha.169] ทูลทิป: ตรรกะตัวหน่วง ─────────────
{
  const tmpT = path.join(os.tmpdir(), 'k2-tooltip-169.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src', 'tooltip.js')], outfile: tmpT, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  const { tipDelay } = require(tmpT);
  check('[169] ทูลทิปตัวแรก = รอเต็มเวลา', tipDelay(10000, 0, { delay: 450, warm: 600 }) === 450);
  check('[169] ★ เพิ่งปิดตัวก่อนไปไม่เกิน warm = ขึ้นทันที (ไล่ดูปุ่มข้าง ๆ)', tipDelay(10300, 10000, { delay: 450, warm: 600 }) === 0);
  check('[169] เลย warm แล้ว = กลับไปรอเต็มเวลา', tipDelay(10700, 10000, { delay: 450, warm: 600 }) === 450);
  check('[169] ค่าเสียไม่พัง', tipDelay(NaN, 5, {}) === 450 && tipDelay(1, 2, { delay: 450 }) === 450 && tipDelay(5, 5, { delay: -3 }) === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
