// test/screenplay-marks.test.cjs — [alpha.164 · บั๊ก] บทภาพยนตร์ต้องเปิดได้ทุกมาร์กที่ md.js ให้
//
// ═══ ที่มา ═══
// `spSchema` มีมาร์กแค่ strong/em/underline/strike แต่ `mdToDoc()` (ตัวแยก inline ตัวเดียวของโปรแกรม)
// ให้ `sub` (`~…~`) · `sup` (`^…^`) · `color` · `highlight` ได้ด้วย → `nodeFromJSON` โยน
// "There is no mark type sub in this schema" = **เปิดไฟล์บทไม่ได้ทั้งไฟล์**
// (คนไทยพิมพ์ "ค่ะ~ … นะ~" บ่อย — สองตัวหนอนในบรรทัดเดียวกันก็พอแล้ว)
// และ [IMG-IN-A] รูปกลางบรรทัดต้องกลับเป็นข้อความดิบ (spSchema ไม่มีโหนด `image`)
//
// screenplay.js แตะ DOM ตอน import (core.js สร้าง SmartType) → ใช้ jsdom ที่มากับ fabric
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const k of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'getComputedStyle']) {
  globalThis[k] = k === 'window' ? dom.window : dom.window[k];
}

const out = path.join(os.tmpdir(), 'k2-screenplay-marks.cjs');
esbuild.buildSync({
  stdin: { contents: "export * from './src/screenplay.js';", resolveDir: path.join(__dirname, '..'), loader: 'js' },
  outfile: out, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const SP = require(out);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const CASES = [
  ['ตัวห้อย ~…~ (ค่ะ~ … นะ~)', '### INT. บ้าน - กลางวัน\n\nครับ~ ไปก่อนนะ~'],
  ['ตัวยก ^…^', '### INT. บ้าน - กลางวัน\n\nราคา x^2^ บาท'],
  ['สีตัวอักษร', '### INT. บ้าน - กลางวัน\n\n<span style="color:#b03030">แดง</span> ต่อ'],
  ['สีเน้น', '### INT. บ้าน - กลางวัน\n\n<mark style="background:#fff3a3">เน้น</mark> ต่อ'],
  ['รูปกลางบรรทัด', '### INT. บ้าน - กลางวัน\n\nเดิน ![a](x.png) นั่ง'],
  ['ตัวหนา+รูป', '### INT. บ้าน - กลางวัน\n\n**เดิน ![a](x.png "h=2") นั่ง**'],
];
for (const [name, md] of CASES) {
  let doc = null, err = '';
  try { doc = SP.spDocFromMarkdown(md); } catch (e) { err = e.message; }
  check('เปิดได้: ' + name, !!doc, err);
  if (!doc) continue;
  let img = false;
  doc.descendants((n) => { if (n.type.name === 'image') img = true; });
  check('ไม่มีโหนด image: ' + name, !img);
  const back = SP.spDocToMarkdown(doc);
  check('ไป-กลับไม่เปลี่ยน: ' + name, back === md, JSON.stringify(back));
}
check('spSchema มีมาร์กครบชุดของนิยาย',
  ['strong', 'em', 'underline', 'strike', 'sup', 'sub', 'color', 'highlight'].every((m) => !!SP.spSchema.marks[m]));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
