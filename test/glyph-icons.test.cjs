// test/glyph-icons.test.cjs — [alpha.157r] อีโมจิสี → ไอคอนเส้น (ส่วนบริสุทธิ์)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_glyphicons.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/glyph-icons.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const G = require(out);
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (i !== '' ? ' | ' + i : '')); } };

const noIcon = Object.entries(G.GLYPH_ICON).filter(([, v]) => !G.ICON_NAMES.includes(v.icon)).map(([k]) => k);
check('ทุกอักขระในตารางมีไอคอนจริง', noIcon.length === 0, noIcon.join(' '));
check('ทุกไอคอนเป็น SVG viewBox 24 สีตามตัวอักษร', Object.keys(G.GLYPH_ICON).every((k) => /^<svg viewBox="0 0 24 24"[^>]*stroke="currentColor"/.test(G.glyphSvg(k))));
for (const ch of ['★', '☆', '•', '→', '←', '▸', '▼', '⌘', '⌥', '●', '·']) {
  check('ไม่แตะอักขระที่เป็นข้อความ: ' + ch, !G.GLYPH_ICON[ch] && G.splitGlyphs('ก ' + ch + ' ข') === null);
}
const parts = G.splitGlyphs('💾 บันทึก ⚠️ เตือน ✏️');
check('แยกข้อความ/ไอคอนถูกลำดับ', JSON.stringify(parts.map((p) => p.glyph || p.text)) === JSON.stringify(['💾', ' บันทึก ', '⚠️', ' เตือน ', '✏️']), JSON.stringify(parts));
check('อีโมจิสองโค้ดพอยต์ (มี U+FE0F) จับทั้งตัว', parts[2].glyph === '⚠️' && parts[2].tint === 'warn');
check('ต่อกลับแล้วได้ข้อความเดิมทุกไบต์', parts.map((p) => p.glyph || p.text).join('') === '💾 บันทึก ⚠️ เตือน ✏️');
check('ไม่มีอีโมจิ = null (ไม่ต้องแตะ DOM)', G.splitGlyphs('ข้อความธรรมดา ★') === null);
console.log(`\nglyph-icons: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
