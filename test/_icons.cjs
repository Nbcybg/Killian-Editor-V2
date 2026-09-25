// test/_icons.cjs — [alpha.166] ทะเบียนไอคอนสำหรับเทส (gi/gt จาก src/icons.js ตัวจริง)
// ไอคอนบนจอเป็นอักขระของฟอนต์ Nerd Fonts แล้ว — เทสเทียบกับ gi('<ชื่อ>') แทนการพิมพ์อีโมจิลงไป
const path = require('path');
const out = path.join(require('os').tmpdir(), '_k2icons.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/icons.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
module.exports = require(out);
