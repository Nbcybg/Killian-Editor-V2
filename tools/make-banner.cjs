// tools/make-banner.cjs — [alpha.170] สร้างภาพแบนเนอร์หัว README (โลโก้ + ชื่อโปรแกรม) จาก icons/app-icon.svg
//
//   ./node_modules/.bin/electron tools/make-banner.cjs                   (macOS / Linux)
//   ./node_modules/electron/dist/electron.exe tools/make-banner.cjs      (Windows)
//
// ได้ docs/assets/readme-banner.png (2560 × 640 · มุมมนโปร่งใส) — README.md / README.th.md แสดงที่กว้างเต็มคอลัมน์
// ผู้ใช้: *"ทำ ภาพ leaderboard ใส่ใน readme ให้หน่อย เป็น logo กับชื่อ app"*
//
// · โลโก้มาจากแหล่งเดียว (icons/app-icon.svg) — พื้นมืดใช้ฉบับขาว (กติกาเดียวกับ build.js: เส้นเดียวกัน เติมขาวล้วน)
//   แก้โลโก้/คำโปรย/เลขรุ่นแล้วรันตัวนี้ใหม่ ห้ามวาดแบนเนอร์แยกด้วยมือ
// · สีเป็นจานสีประจำโปรแกรม (ธีม K2): #1e1250 #452f5e #ff6640 #ffc55c
// · ต้องรันด้วย Electron เพราะใช้ Chromium วาด (เหตุผลเดียวกับ tools/make-icon.cjs) · ห้ามรันพร้อม e2e
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'icons', 'app-icon.svg');
const OUT = path.join(ROOT, 'docs', 'assets', 'readme-banner.png');
const W = 2560, H = 640;
const NAME = 'Killian 2';
const TAGLINE = 'A novel and screenplay writing app for the people behind the scenes.';
const KINDS = ['Game narrative', 'Novels', 'Screenplays'];

/** ฉบับขาวของโลโก้ — สูตรเดียวกับ build.js (syncAppIcon) */
function whiteLogo(svg) {
  const white = svg.replace(/fill="url\(#[^)]+\)"/g, 'fill="#ffffff"').replace(/\s*<defs>[\s\S]*?<\/defs>/, '').replace(/<!--[\s\S]*?-->\s*/, '');
  if (white === svg || /url\(#/.test(white)) throw new Error('app-icon.svg: หาเส้นที่เติมสีไล่เฉดไม่เจอ — สร้างฉบับขาวไม่ได้');
  return white;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function bannerHtml(logoSvg) {
  const logo = 'data:image/svg+xml;base64,' + Buffer.from(logoSvg).toString('base64');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin:0; width:${W}px; height:${H}px; background:transparent; overflow:hidden; }
    .card { position:relative; width:${W}px; height:${H}px; box-sizing:border-box; border-radius:56px; overflow:hidden;
      display:flex; align-items:center; gap:112px; padding:0 168px;
      background:
        radial-gradient(900px 620px at 13% 52%, rgba(255,102,64,.34), rgba(255,102,64,0) 70%),
        radial-gradient(1100px 700px at 96% 110%, rgba(255,197,92,.16), rgba(255,197,92,0) 70%),
        linear-gradient(118deg, #150c36 0%, #1e1250 46%, #452f5e 100%);
      font-family:-apple-system, "SF Pro Display", "Segoe UI", "Helvetica Neue", Arial, sans-serif; color:#fff; }
    .logo { flex:none; width:372px; height:372px; filter:drop-shadow(0 18px 44px rgba(10,5,30,.55)); }
    .text { min-width:0; }
    .name { font-size:212px; font-weight:800; letter-spacing:-5px; line-height:1; }
    .name b { color:#ff6640; font-weight:800; }
    .tag { margin-top:34px; font-size:48px; white-space:nowrap; font-weight:500; color:#ffc55c; letter-spacing:.2px; line-height:1.25; }
    .kinds { margin-top:38px; display:flex; gap:20px; }
    .kinds span { padding:11px 30px; border:2.5px solid rgba(255,255,255,.36); border-radius:999px; font-size:36px; font-weight:600;
      color:rgba(255,255,255,.88); }
    .edge { position:absolute; inset:0; border-radius:56px; box-shadow:inset 0 0 0 3px rgba(255,255,255,.08); }
  </style></head><body><div class="card">
    <img class="logo" src="${logo}" alt="">
    <div class="text">
      <div class="name">${esc(NAME.replace(/\s*2$/, ''))} <b>2</b></div>
      <div class="tag">${esc(TAGLINE)}</div>
      <div class="kinds">${KINDS.map((k) => '<span>' + esc(k) + '</span>').join('')}</div>
    </div>
    <div class="edge"></div>
  </div></body></html>`;
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const html = bannerHtml(whiteLogo(fs.readFileSync(SRC, 'utf8')));
    const win = new BrowserWindow({ show: false, width: W, height: H, useContentSize: true, transparent: true, frame: false,
                                    webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
    await new Promise((r) => setTimeout(r, 600));
    const shot = await win.webContents.capturePage();
    const size = shot.getSize();
    const img = size.width === W && size.height === H ? shot : shot.resize({ width: W, height: H, quality: 'best' });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, img.toPNG());
    console.log('banner OK →', OUT, '(' + W + '×' + H + ' · ' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
    app.exit(0);
  } catch (e) {
    console.error('banner FAILED:', e);
    app.exit(1);
  }
});
