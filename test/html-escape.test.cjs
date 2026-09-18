// test/html-escape.test.cjs — [alpha.159 · H6/M11] ข้อความผู้เขียนห้ามทะลุออกมาเป็นแอตทริบิวต์ HTML
// เดิม `![a" onerror="alert(1)](x)` ในฉาก → `<img alt="a" onerror="alert(1)" src="x">` ในไฟล์ HTML/PDF ที่ส่งออก
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
const tmp = path.join(os.tmpdir(), 'k2-htmlesc-compile.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'compile.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const C = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
/** แท็ก <img> ทุกตัวในผล — แอตทริบิวต์ที่พาร์สได้ (ชื่อ) */
const imgAttrs = (html) => [...String(html).matchAll(/<img\b([^>]*)>/g)]
  .map((m) => [...m[1].matchAll(/([a-zA-Z-]+)\s*=\s*"[^"]*"/g)].map((x) => x[1].toLowerCase()));

/** มีแอตทริบิวต์อีเวนต์ "จริง" ไหม — ตัดค่าในเครื่องหมายคำพูดทิ้งก่อน (ข้อความใน alt ไม่นับ) */
const hasEventAttr = (html) => [...String(html).matchAll(/<img\b([^>]*)>/g)]
  .some((m) => /\son[a-z]+\s*=/i.test(m[1].replace(/"[^"]*"/g, '""')));
const evil = 'ก่อน ![a" onerror="alert(1)](x" onload="y) หลัง';
const h1 = MD.inlineHtml(evil);
check('★ inlineHtml: รูปในบรรทัดไม่มีแอตทริบิวต์เกิน alt/src', imgAttrs(h1).every((a) => a.join() === 'alt,src'), h1);
check('★ inlineHtml: ไม่มี onerror/onload เป็นแอตทริบิวต์', !hasEventAttr(h1), h1);
check('inlineHtml: ข้อความยังอยู่ครบ (escape ไม่ใช่ลบ)', h1.includes('&quot;') && h1.includes('ก่อน') && h1.includes('หลัง'), h1);
check('รูปธรรมดายังได้ <img> ปกติ', /<img alt="ภาพ" src="images\/a.png">/.test(MD.inlineHtml('![ภาพ](images/a.png)')),
      MD.inlineHtml('![ภาพ](images/a.png)'));
check("single quote ก็ถูก escape", !MD.inlineHtml("![x' onerror='1](y)").includes("x' onerror"));

const body = C.mdToHtmlBody('ย่อหน้า ' + evil + '\n\n![a" onmouseover="z](p.png)');
check('★ mdToHtmlBody (ไฟล์ที่ส่งออกจริง): ไม่มีแอตทริบิวต์อีเวนต์หลุด', !hasEventAttr(body), body.slice(0, 300));
check('mdToHtmlBody: รูปทุกตัวมีเฉพาะแอตทริบิวต์ที่คาด', imgAttrs(body).every((a) => a.every((n) => ['alt', 'src', 'style', 'class'].includes(n))),
      JSON.stringify(imgAttrs(body)));

// M11: หน้าปกใน export-hub.js — esc ของ frontMatterHtml ต้อง escape " ด้วย (ตรวจจากซอร์ส: ฟังก์ชันไม่ได้ export)
const hub = fs.readFileSync(path.join(__dirname, '..', 'src', 'export-hub.js'), 'utf8');
const fm = hub.slice(hub.indexOf('async function frontMatterHtml'), hub.indexOf('async function frontMatterHtml') + 1500);
check('[M11] esc ของหน้าปกแปลง " เป็น &quot; (ใช้ใน src="…")', /replace\(\/"\/g, '&quot;'\)/.test(fm));

console.log(`\nhtml-escape: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
