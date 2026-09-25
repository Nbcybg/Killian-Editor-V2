// test/icon-font.test.cjs — [alpha.166] ไอคอนชุดเดียวจาก Nerd Fonts
// ผู้ใช้: "icon ต่าง ๆ ทั้ง app เน้นความทันสมัย และมืออาชีพ ลองไปดึงจาก nerdfonts.com ก็ได้"
// ด่าน: ทะเบียน (glyphs.csv) → อักขระของฟอนต์ + svg จากฟอนต์เดียวกัน · ข้อความที่ออกนอกโปรแกรมใช้ตัวอักษรล้วน
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const I = require('./_icons.cjs');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── gi / gt / plainIcons ──
check('★ gi() ของไอคอนที่มี nf = อักขระ Private Use (วาดด้วยฟอนต์ K2 Icons)', I.isIconChar(I.gi('save')) && I.isIconChar(I.gi('book-open')));
check('gi() ของตัวอักษรเชิงข้อความยังเป็นตัวอักษรเดิม (× ● ¶ §)', I.gi('times') === '×' && I.gi('dot') === '●' && !I.isIconChar(I.gi('times')));
check('★ gt() = ตัวอักษรล้วน (ไฟล์ส่งออก/ข้อความถึง AI ไม่มีฟอนต์ไอคอน)', I.gt('play') && !I.isIconChar(I.gt('play')) && I.gt('paperclip') === '📎');
check('gt() ชื่อที่ไม่มีตัวอักษรล้วน = ว่าง (ไม่ปล่อยอักขระ PUA ออกไป)', I.gt('ai-status-idle') === '');
check('★ plainIcons แปลงอักขระไอคอนในข้อความเป็นตัวอักษรล้วน', I.plainIcons(I.gi('play') + ' เริ่ม') === I.gt('play') + ' เริ่ม', I.plainIcons(I.gi('play') + ' เริ่ม'));
check('plainIcons ตัดไอคอนที่ไม่มีตัวแทน (ไม่ปล่อยเป็นกล่อง)', I.plainIcons(I.gi('ai-status-idle') + ' AI') === 'AI');
check('plainIcons ข้อความธรรมดาไม่เปลี่ยน (รวมอีโมจิของผู้ใช้)', I.plainIcons('ทอร่า 🍰 ★') === 'ทอร่า 🍰 ★');
check('isIconChar: ไทย/อีโมจิ ≠ ไอคอน', !I.isIconChar('ก') && !I.isIconChar('🍰') && I.isIconChar(''));

// ── ทุก gi()/gt() ในซอร์สชี้ชื่อที่มีจริง ──
{
  const miss = new Set();
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'generated') walk(p); continue; }
    if (!f.name.endsWith('.js')) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\bg[it]\('([a-z0-9-]+)'\)/g)) if (!I.hasIcon(m[1])) miss.add(m[1] + ' (' + path.relative(ROOT, p) + ')');
  } };
  walk(path.join(ROOT, 'src'));
  check('★ ทุก gi()/gt() ในซอร์สมีชื่อในทะเบียน', miss.size === 0, [...miss].slice(0, 8).join(', '));
}

// ── CSS / ฟอนต์ ──
{
  const css = rd('renderer/style.css');
  const face = (css.match(/@font-face\s*\{[^}]*"K2 Icons"[^}]*\}/) || [''])[0];
  check('★ @font-face "K2 Icons" ชี้ไฟล์ฟอนต์ที่มีจริง', /k2-icons\.ttf/.test(face) && fs.existsSync(path.join(ROOT, 'renderer/assets/fonts/k2-icons.ttf')));
  check('★ unicode-range เฉพาะ Private Use (ไม่ทับตัวอักษรจริงของผู้ใช้)', /unicode-range:\s*U\+E000-F8FF,\s*U\+F0000-FFFFD/.test(face), face.slice(0, 200));
  const sa = +((face.match(/size-adjust:\s*([\d.]+)%/) || [])[1]);
  const scale = +((rd('tools/commands-data.cjs').match(/const ICON_SCALE = ([\d.]+)/) || [])[1]);
  check('★ size-adjust ของฟอนต์ = ICON_SCALE ของรูป svg (ไอคอนในข้อความกับบนปุ่มขนาดเท่ากัน)', sa > 0 && Math.abs(sa / 100 - scale) < 1e-9, sa + ' / ' + scale);
  check('★ ตาข่ายฟอนต์ (--thai-net) มี "K2 Icons" — ทุกสแตกวาดอักขระไอคอนได้', /--thai-net:[^;]*"K2 Icons"/.test(css));
  check('ผืนวาดของกระดานใส่ฟอนต์ไอคอนในสแตก', /const FONT = [^\n]*K2 Icons/.test(rd('src/planner/planner-render.js')));
  check('ตัววางไอคอนทับอีโมจิ (glyph-upgrade · MutationObserver ทั้งหน้า) ถูกถอดแล้ว', !fs.existsSync(path.join(ROOT, 'src/glyph-upgrade.js')) && !/startGlyphUpgrade/.test(rd('src/app.js')));
  check('ไฟล์ส่งออกผังแตกสายใช้ตัวอักษรล้วน', /gt\('play'\)/.test(rd('src/branch-graph.js')) && !/\bgi\(/.test(rd('src/branch-graph.js')));
  check('ข้อความแนบที่ส่งให้ AI ใช้ตัวอักษรล้วน', /### ' \+ gt\('paperclip'\)/.test(rd('src/ai/ai-chat-panel.js')));
  check('ธีมก่อนเฟรมแรก: theme-boot.js อยู่ใต้ <body> ก่อน bundle.js', /<body>[\s\S]{0,200}theme-boot\.js[\s\S]*bundle\.js/.test(rd('renderer/index.html')));
}

console.log(`icon-font: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
