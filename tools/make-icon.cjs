// tools/make-icon.cjs — [alpha.168] สร้างไอคอนของโปรแกรมจาก icons/app-icon.svg
//
//   ./node_modules/electron/dist/electron.exe tools/make-icon.cjs      (Windows)
//   ./node_modules/.bin/electron tools/make-icon.cjs                   (macOS / Linux)
//
// ได้ build/icon.ico (16–256px · ตัว exe / แถบงานของ Windows) + build/icon.png (1024px · electron-builder
// แปลงเป็น .icns เองตอน build บน mac) — electron-builder หยิบจากโฟลเดอร์ build/ ให้เองโดยไม่ต้องตั้งค่าเพิ่ม
// (เดิมไม่มีไฟล์ไอคอนเลย → ตัวแพ็กใช้ไอคอน Electron ตั้งต้น: "default Electron icon is used")
//
// ต้องรันด้วย Electron เพราะใช้ Chromium วาด SVG (node เปล่าวาด SVG ไม่ได้ และไม่อยากเพิ่ม dependency)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'icons', 'app-icon.svg');
const OUT = path.join(ROOT, 'build');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** ประกอบไฟล์ .ico จาก PNG หลายขนาด (รายการแบบ PNG — Windows Vista ขึ้นไปอ่านได้) */
function buildIco(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let off = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);          // 0 = 256
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(buf.length, o + 8); dir.writeUInt32LE(off, o + 12);
    off += buf.length;
  });
  return Buffer.concat([head, dir, ...pngs.map((p) => p.buf)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const svg = fs.readFileSync(SRC, 'utf8');
    const html = '<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">'
      + '<img style="display:block;width:1024px;height:1024px" src="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '"></body></html>';
    const win = new BrowserWindow({ show: false, width: 1024, height: 1024, useContentSize: true, transparent: true, frame: false,
                                    webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
    await new Promise((r) => setTimeout(r, 400));
    const shot = await win.webContents.capturePage();
    const big = shot.resize({ width: 1024, height: 1024, quality: 'best' });
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'icon.png'), big.toPNG());
    const pngs = ICO_SIZES.map((size) => ({ size, buf: big.resize({ width: size, height: size, quality: 'best' }).toPNG() }));
    fs.writeFileSync(path.join(OUT, 'icon.ico'), buildIco(pngs));
    console.log('icon OK →', path.join(OUT, 'icon.ico'), '+ icon.png', '(' + ICO_SIZES.join(',') + ')');
    app.exit(0);
  } catch (e) {
    console.error('icon FAILED', e);
    app.exit(1);
  }
});
