const fs = require('fs');
const path = require('path');

// ก๊อปไฟล์ภาษา (แหล่งจริง = languages/) เข้า renderer/languages/
// เพราะ electron-builder แพ็กแค่ renderer/** — ไม่งั้นแอปที่ build แล้วจะไม่มีไฟล์ภาษา
function syncLanguages() {
  const src = path.join(__dirname, 'languages');
  const dst = path.join(__dirname, 'renderer', 'languages');
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    // [alpha.76] ไฟล์ภาษาเป็น CSV (`k2_<code>.csv`) แล้ว — .json เก็บไว้เผื่อโปรเจกต์เก่า
    if (f.endsWith('.csv') || f.endsWith('.json')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
}

syncLanguages();

// [alpha.69] ตรรกะสมุดประวัติ (history-data.js) ถูกใช้ **สองฝั่ง**: renderer วาดแผง · main ลงมือกับดิสก์
// main.js เป็น CommonJS และ import ES module ตรง ๆ ไม่ได้ → แปลงเป็น .cjs ไว้ให้ require
// (ห้ามคัดลอกตรรกะไปไว้สองที่ — ตัวที่มี unit test ต้องเป็นตัวเดียวกับที่ทำงานจริง)
const CJS_MODULES = [['src/history/history-data.js', 'history-data.cjs']];

const esbuild = require('esbuild');
Promise.all([
  esbuild.build({
    entryPoints: ['src/app.js'],
    bundle: true, outfile: 'renderer/bundle.js',
    format: 'iife', platform: 'browser', target: 'chrome120',
    minify: false, sourcemap: false,
  }),
  ...CJS_MODULES.map(([src, out]) => esbuild.build({
    entryPoints: [src], bundle: true, outfile: out,
    format: 'cjs', platform: 'node', target: 'node20', minify: false, sourcemap: false,
  })),
]).then(() => console.log('bundle OK')).catch((e) => { console.error(e); process.exit(1); });
