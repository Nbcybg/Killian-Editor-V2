// test/live-fonts.test.cjs — [alpha.160 · P1-7/P1-8/P1-10] ฟอนต์ของนิยายที่ส่งออก/อ่านทั้งเล่ม = ฟอนต์บนจอ
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-livefonts-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'live-fonts.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const L = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── DOM ปลอม: selector → โหนด · getComputedStyle อ่าน fontFamily/ตัวแปร ──
function fakeDoc({ proseEd = null, anyEd = null, edVar = '' } = {}) {
  const root = { _vars: { '--ed-font': edVar } };
  return {
    documentElement: root,
    defaultView: { getComputedStyle: (n) => (n === root
      ? { getPropertyValue: (k) => root._vars[k] || '' }
      : { fontFamily: n.font }) },
    querySelector: (sel) => (sel === L.PROSE_EDITOR_SEL ? proseEd : sel === '.ProseMirror' ? anyEd : null),
  };
}
const spEd = { font: '"K2 SP", "Courier Prime", monospace', querySelector: () => null };
const proseEd = { font: '"K2 Lang", Garamond, serif', querySelector: () => ({ font: 'Garamond, serif' }) };

check('selector ตัดบทภาพยนตร์/Wiki ออก', /:not\(\.sp-pane\)/.test(L.PROSE_EDITOR_SEL) && /:not\(\.wiki-pane\)/.test(L.PROSE_EDITOR_SEL));
const a = L.liveProseFonts(fakeDoc({ proseEd, anyEd: spEd }));
check('มีตัวแก้ไขนิยายเปิด = ฟอนต์ของตัวแก้ไขนิยาย + หัวข้อ', a.fontStack === proseEd.font && a.headingStack === 'Garamond, serif', JSON.stringify(a));
// ★ ต้นตอ P1-7: เปิดแต่บทภาพยนตร์ → เดิมหยิบ `.ProseMirror` ตัวแรก (ของบท) = ส่งออกนิยายเป็น Courier
const b = L.liveProseFonts(fakeDoc({ anyEd: spEd, edVar: '"K2 Lang", Garamond, serif' }));
check('★★ เปิดแต่บทภาพยนตร์ = ไม่หยิบฟอนต์ของบท', !/Courier|K2 SP/.test(b.fontStack || ''), JSON.stringify(b));
check('★ ไม่มีตัวแก้ไขนิยาย = ใช้ --ed-font (ตัวเดียวกับที่ตัวแก้ไขนิยายจะใช้)', b.fontStack === '"K2 Lang", Garamond, serif');
check('ไม่มีอะไรเลย = {} (ผู้เรียกตกไปค่าเดิม)', Object.keys(L.liveProseFonts(fakeDoc({ anyEd: spEd }))).length === 0);
check('ไม่มี document = {} ไม่ throw', Object.keys(L.liveProseFonts(null)).length === 0);

// ── P1-10: ฟอนต์ DOCX ต้องเป็นชื่อที่ Word รู้จัก ──
check('★★ ข้ามวงศ์สังเคราะห์ K2 Lang', L.firstRealFont('"K2 Lang", Garamond, serif') === 'Garamond');
check('★ ข้าม K2 SP', L.firstRealFont("'K2 SP', 'Courier Prime', monospace") === 'Courier Prime');
check('ข้ามตระกูลทั่วไปของ CSS', L.firstRealFont('serif, sans-serif') === '');
check('ชื่อไทยผ่าน', L.firstRealFont('"K2 Lang", "TH Sarabun New", serif') === 'TH Sarabun New');
check('สแตกว่าง = ""', L.firstRealFont('') === '' && L.firstRealFont(undefined) === '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
