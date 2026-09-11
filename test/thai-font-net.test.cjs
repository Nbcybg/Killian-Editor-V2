// test/thai-font-net.test.cjs — [alpha.145] ด่านถาวรของ "วรรณยุกต์ลอย"
//
// ══ บทเรียนที่ alpha.144 ยังไม่รู้ ══
// alpha.144 แก้เฉพาะ `--ed-font`/`--sp-font` แล้วสรุปว่า "ปิดเคสแล้ว" — แต่ผู้ใช้ยังเจออยู่
// วัดจริงบนเครื่อง (แคนวาส 80px · ระยะจากท้องวรรณยุกต์ถึงหัวพยัญชนะของ `ท` + `่`):
//
//     ลูกโซ่ที่ลงท้ายด้วย monospace   → Chromium เลือก **Ayuthaya** ให้ = gap 27  (ลอย)
//     ลูกโซ่ที่ลงท้ายด้วย sans-serif  → Chromium เลือก **Thonburi** ให้ = gap  6  (ปกติ)
//     ลูกโซ่ที่ลงท้ายด้วย serif       → Thonburi = gap 6
//
// ตัวสำรองของเบราว์เซอร์จึง **ขึ้นกับ generic family ท้ายสแตก** ไม่ใช่ค่าคงที่ตัวเดียว
// → ช่องโมโนสเปซทุกช่องในโปรแกรม (ช่องแก้ Markdown ดิบ · แผงบันทึก · โค้ดบล็อกในแชท AI ·
//   เลขบรรทัด · ช่องพัฒนา) ลอยหมด ขณะที่เนื้อความปกติไม่ลอย = "อยู่ดี ๆ ก็ลอย อยู่ดี ๆ ก็ไม่ลอย"
//
// เทสนี้อ่าน `renderer/style.css` ตัวจริง แล้วฟ้อง **ทุก** font stack ที่ยังปล่อยให้อักษรไทย
// ตกไปถึงตัวเลือกของเบราว์เซอร์ · กฎเดียว: ต้องลงท้ายด้วย `var(--thai-net)`
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const cssPath = path.join(__dirname, '..', 'renderer', 'style.css');
const raw = fs.readFileSync(cssPath, 'utf8');
// ลบคอมเมนต์แต่คงความยาวไว้ → เลขบรรทัดที่ฟ้องยังตรงกับไฟล์จริง
const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const lineOf = (i) => src.slice(0, i).split('\n').length;

// ── ช่วงของ @font-face — `font-family:` ในนั้นคือ "การตั้งชื่อวงศ์" ไม่ใช่ลูกโซ่สำรอง ──
const faceRanges = [];
for (const m of src.matchAll(/@font-face\s*\{[^}]*\}/g)) faceRanges.push([m.index, m.index + m[0].length]);
const inFace = (i) => faceRanges.some(([a, b]) => i >= a && i < b);

check('style.css มีตัวแปรตาข่ายรองอักษรไทย (--thai-net) ที่ :root',
  /:root\s*\{[\s\S]*?--thai-net\s*:/.test(src));
check('ตาข่ายขึ้นต้นด้วย Thonburi (ตัวที่วัดแล้วไม่ลอยบน macOS)',
  /--thai-net\s*:\s*"Thonburi"/.test(src));
check('ตาข่ายมีตัวของ Windows (Leelawadee UI) และตัวสากล (Noto Sans Thai) ด้วย',
  /--thai-net\s*:[^;]*Leelawadee UI[^;]*Noto Sans Thai/.test(src));

// ── ตัวจับ font stack ทุกแถวในไฟล์ ──
const decls = [];
for (const m of src.matchAll(/(?<![-\w])(font-family|font)\s*:\s*([^;{}]*);/g)) {
  const value = m[2].replace(/\s+/g, ' ').trim();
  if (inFace(m.index)) continue;
  if (!/[A-Za-z]/.test(value)) continue;             // `font:` ที่เป็นแค่ตัวเลข = ไม่ใช่สแตก
  decls.push({ line: lineOf(m.index), prop: m[1], value });
}
check('พบ font stack ในไฟล์อย่างน้อย 60 แถว (ตัวจับยังทำงานอยู่)', decls.length >= 60, decls.length);

// `inherit` = สืบทอดจากพ่อแม่ ซึ่งผ่านด่านนี้มาแล้ว → ไม่ต้องต่อตาข่ายซ้ำ
const isInherit = (v) => /\binherit\s*$/.test(v);
const bad = decls.filter((d) => !isInherit(d.value) && !d.value.includes('var(--thai-net)'));
check('★ ทุก font stack ใน style.css ลงท้ายด้วย var(--thai-net) หรือ inherit',
  bad.length === 0, bad.map((d) => d.line + ': ' + d.value.slice(0, 70)).join(' | '));

// ── แถวที่เคย "ลอย" จริงในรอบนี้ ต้องมีตาข่ายแน่นอน (กันการย้อนกลับแบบเจาะจง) ──
const mustHave = [
  ['.plain-md (ช่องแก้ Markdown ดิบ)', /\.plain-md\s*\{[^}]*var\(--thai-net\)/],
  ['.k-logview (แผงบันทึก)', /\.k-logview\s*\{[^}]*var\(--thai-net\)/],
  ['.ai-md-pre-body (โค้ดบล็อกในแชท AI)', /\.ai-md-pre-body\s*\{[^}]*var\(--thai-net\)/],
  ['.ai-md-code (โค้ดในบรรทัด แชท AI)', /\.ai-md-code\s*\{[^}]*var\(--thai-net\)/],
  ['.k-ln-no (เลขบรรทัด)', /\.k-ln-no\s*\{[^}]*var\(--thai-net\)/],
  ['.ProseMirror (เนื้อความนิยาย)', /\.ProseMirror\s*\{\s*font-family:[^;]*var\(--thai-net\)/],
];
for (const [label, re] of mustHave) check('ตาข่ายไทยครอบ ' + label, re.test(src));

// ── ฝั่ง JS: สแตกที่โปรแกรมประกอบเองตอนส่งออก ก็ต้องมีตาข่าย ──
const js = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
check('หัวข้อของ "รูปแบบนิยาย" ต่อตาข่ายไทย (proseCss)',
  /font-family:\$\{withThaiFallback\(proseHeadingStack\(f\)\)\}/.test(js('prose-format.js')));
check('CSS ตอนส่งออกต่อตาข่ายไทยทั้งเนื้อความและหัวข้อ',
  /const bodyFont = withThaiFallback\(/.test(js('prose-format.js'))
  && /const headFont = withThaiFallback\(/.test(js('prose-format.js')));
check('บล็อกโค้ดในไฟล์ที่ส่งออกต่อตาข่ายไทย',
  /'font-family:' \+ withThaiFallback\('"Courier Prime"/.test(js('prose-format.js')));
check('หน้าปก/หน้าคั่นของศูนย์รวมการส่งออกต่อตาข่ายไทย',
  /font-family:\$\{withThaiFallback\(proseFontStack\(pf\)\)\}/.test(js('export-hub.js')));
check('ลายน้ำ (export-watermark) ต่อตาข่ายไทย',
  /withThaiFallback\('"Courier Prime","Courier Final Draft"/.test(js('export-watermark.js')));
check('หน้าเทียบฉบับ (sp-compare) มีฟอนต์ไทยในลูกโซ่',
  /k-compare-wrap \{ font-family:[^;]*Thonburi/.test(js('sp-compare.js')));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
