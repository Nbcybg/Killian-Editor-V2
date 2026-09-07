// test/lang-fonts.test.cjs — unit test "ฟอนต์ตามภาษา" (alpha.57a ข้อ 5)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-langfonts-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'lang-fonts.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const LF = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const url = (r) => (r.builtin ? 'assets/fonts/' + r.builtin : (r.file ? 'file:///F/' + r.file : ''));

// ── ค่าสำเร็จรูป ──
check('มีช่วงอักขระสำเร็จรูปอย่างน้อย 8 ภาษา', LF.SCRIPT_PRESETS.length >= 8, LF.SCRIPT_PRESETS.length);
check('มีพรีเซ็ตไทยและช่วงถูกต้อง',
  LF.SCRIPT_PRESETS.some((p) => p.key === 'thai' && p.range === 'U+0E00-0E7F'));
check('พรีเซ็ตทุกตัวมีป้ายภาษาไทย', LF.SCRIPT_PRESETS.every((p) => p.label.length > 1));
check('พรีเซ็ต "ทุกอักขระ" ไม่มีช่วง (= ครอบทั้งหมด)',
  LF.SCRIPT_PRESETS.find((p) => p.key === 'all').range === '');
check('ฟอนต์ที่ฝังมามีทั้งละตินและไทย',
  LF.BUILTIN_FONT_FILES.some((f) => /Prime/.test(f.file)) &&
  LF.BUILTIN_FONT_FILES.filter((f) => /Thai/.test(f.file)).length === 2);

// ── normalizeRange: กัน CSS injection + ช่วงมั่ว ──
check('รับช่วงเดี่ยว', LF.normalizeRange('U+0E00-0E7F') === 'U+0E00-0E7F');
check('รับหลายช่วงคั่นจุลภาค',
  LF.normalizeRange('U+0000-024F, U+2000-206F') === 'U+0000-024F, U+2000-206F');
check('รับจุดโค้ดเดี่ยว (ไม่มีขีด)', LF.normalizeRange('U+0E01') === 'U+0E01');
check('ตัดตัวพิมพ์เล็กให้เป็นใหญ่', LF.normalizeRange('u+0e00-0e7f') === 'U+0E00-0E7F');
check('ทิ้งช่วงที่พิมพ์ผิด', LF.normalizeRange('0E00-0E7F') === '');
check('ทิ้งของแปลกปลอมแต่เก็บช่วงที่ดีไว้',
  LF.normalizeRange('U+0E00-0E7F, }body{display:none}') === 'U+0E00-0E7F');
check('ว่าง → ว่าง', LF.normalizeRange('') === '' && LF.normalizeRange(null) === '');

// ── cssFamilyName: กันอักขระที่แหกออกจากสตริง CSS ──
check('ชื่อฟอนต์ปกติผ่าน', LF.cssFamilyName('TH Sarabun New') === 'TH Sarabun New');
check('ถอดอัญประกาศ/วงเล็บ/เซมิโคลอนทิ้ง',
  LF.cssFamilyName('a"; } body { color:red } .x{"') === 'a  body  color:red  .x',
  LF.cssFamilyName('a"; } body { color:red } .x{"'));

// ── isUsable ──
check('แถวปิดอยู่ = ใช้ไม่ได้', !LF.isUsable({ enabled: false, builtin: 'x.ttf', range: 'U+0E00' }));
check('ไม่มีที่มาของฟอนต์ = ใช้ไม่ได้', !LF.isUsable({ range: 'U+0E00-0E7F' }));
check('มีไฟล์ฝังมา + ช่วงถูก = ใช้ได้', LF.isUsable({ builtin: 'CourierThaiMono.ttf', range: 'U+0E00-0E7F' }));
check('ใช้ชื่อฟอนต์ในเครื่องอย่างเดียวก็ได้', LF.isUsable({ family: 'Sarabun', range: 'U+0E00-0E7F' }));
check('ช่วงพิมพ์ผิด = ใช้ไม่ได้', !LF.isUsable({ builtin: 'a.ttf', range: 'zzz' }));
check('ไม่ระบุช่วง = ครอบทุกอักขระ (ใช้ได้)', LF.isUsable({ builtin: 'a.ttf', range: '' }));

// ── buildLangFontCss ──
{
  const rows = [
    { range: 'U+0E00-0E7F', builtin: 'CourierThaiMono.ttf' },
    { range: 'U+0400-04FF', family: 'Sarabun' },
    { range: 'U+0E80-0EFF', enabled: false, builtin: 'x.ttf' },   // ปิดอยู่ → ต้องไม่โผล่
    { range: 'U+1000-109F' },                                     // ไม่มีฟอนต์ → ต้องไม่โผล่
  ];
  const css = LF.buildLangFontCss(rows, url);
  check('สร้าง @font-face เฉพาะแถวที่ใช้ได้', (css.match(/@font-face/g) || []).length === 2, css);
  check('ทุกก้อนใช้ชื่อวงศ์เดียวกัน',
    (css.match(new RegExp('font-family:"' + LF.LANG_FAMILY + '"', 'g')) || []).length === 2);
  check('แถวไฟล์ → url()', css.includes('url("assets/fonts/CourierThaiMono.ttf")'));
  check('แถวชื่อฟอนต์ในเครื่อง → local()', css.includes('local("Sarabun")'));
  check('ใส่ unicode-range ให้ทุกแถว', (css.match(/unicode-range:/g) || []).length === 2);
  check('แถวที่ปิด/ไม่มีฟอนต์ ไม่โผล่', !css.includes('x.ttf') && !css.includes('U+1000'));
}
{
  const css = LF.buildLangFontCss([{ range: '', builtin: 'CourierPrime-Regular.ttf' }], url);
  check('ไม่ระบุช่วง = ไม่ใส่ unicode-range (ครอบทุกตัว)',
    css.includes('@font-face') && !css.includes('unicode-range'), css);
}
check('รายการว่าง → CSS ว่าง', LF.buildLangFontCss([], url) === '');
check('รายการ null ไม่พัง', LF.buildLangFontCss(null, url) === '');

// ── withLangFamily: เอาวงศ์รวมไปนำหน้า font stack เดิม ──
{
  const base = '"Courier Prime", monospace';
  const s = LF.withLangFamily(base, true);
  check('นำวงศ์รวมไว้หน้าสุด', s.startsWith('"' + LF.LANG_FAMILY + '"'), s);
  check('ยังเก็บ stack เดิมไว้ครบ', s.includes('"Courier Prime", monospace'));
  check('เรียกซ้ำไม่ซ้อนวงศ์', LF.withLangFamily(s, true) === s);
  check('ไม่มีแถวใช้ได้ → คืน stack เดิม', LF.withLangFamily(base, false) === base);
  check('stack ว่าง + มีแถว → ได้วงศ์รวมอย่างเดียว',
    LF.withLangFamily('', true) === '"' + LF.LANG_FAMILY + '"');
}

// ── normalizeLangFonts ──
{
  const n = LF.normalizeLangFonts([{ range: 'U+0E00-0E7F' }, { builtin: 'a.ttf', enabled: false }]);
  check('เติม field ที่ขาดให้ครบ',
    n.length === 2 && n.every((r) => 'id' in r && 'label' in r && 'family' in r && 'file' in r));
  check('เก็บสถานะปิดไว้', n[1].enabled === false);
  check('แถวไม่ระบุ enabled = เปิด', n[0].enabled === true);
  check('ค่าไม่ใช่อาร์เรย์ → คืนค่าเริ่มต้น',
    LF.normalizeLangFonts(null).length === LF.defaultLangFonts().length);
  // [alpha.97 ข้อ 12] ค่าเริ่มต้นมีสองแถว: ไทยของบท (เปิด · แทน spThaiFont เดิม) + ไทยฝังมา (ปิด)
  const D = LF.defaultLangFonts();
  check('[97-12] แถวแรก = ไทยของบทภาพยนตร์ ย่อ 85% และเปิดไว้',
    D[0].target === 'screenplay' && D[0].range === 'U+0E00-0E7F' &&
    D[0].size === 85 && D[0].enabled === true, JSON.stringify(D[0]));
  check('[97-12] แถวไทยที่ฝังมากับโปรแกรมยังปิดไว้ก่อนเหมือนเดิม',
    D[1].range === 'U+0E00-0E7F' && D[1].enabled === false && D[1].target === 'all');
  check('[97-12] normalize เติม target/size/system ให้ครบทุกแถว',
    n.every((r) => 'target' in r && 'size' in r && 'system' in r));
  check('[97-12] target ที่ไม่รู้จัก → ตกเป็น all',
    LF.normalizeLangFonts([{ builtin: 'a.ttf', target: 'zzz' }])[0].target === 'all');
  check('[97-12] size ถูกหนีบไว้ 50–150',
    LF.normalizeLangFonts([{ builtin: 'a.ttf', size: 5 }])[0].size === 50 &&
    LF.normalizeLangFonts([{ builtin: 'a.ttf', size: 999 }])[0].size === 150);
  check('[97-12] size ที่ไม่ใช่ตัวเลข → 100 (ขนาดจริง)',
    LF.normalizeLangFonts([{ builtin: 'a.ttf', size: 'x' }])[0].size === 100);
}

// ═══ [alpha.97 ข้อ 12] แถวเดียวใช้ได้ทั้งสองโหมด + สัดส่วนรายแถว ═══
{
  const rows = [
    { id: 'a', range: 'U+0E00-0E7F', family: 'Ayuthaya', target: 'screenplay', size: 85 },
    { id: 'b', range: 'U+0400-04FF', family: 'Sarabun', target: 'prose' },
    { id: 'c', range: 'U+1000-109F', family: 'Padauk', target: 'all' },
  ];
  const sp = LF.buildLangFontCss(rows, url, { family: LF.SP_FAMILY, target: 'screenplay' });
  const pr = LF.buildLangFontCss(rows, url, { family: LF.LANG_FAMILY, target: 'prose' });
  check('[97-12] สแตกบทได้เฉพาะแถว screenplay + all', (sp.match(/@font-face/g) || []).length === 2);
  check('[97-12] สแตกนิยายได้เฉพาะแถว prose + all', (pr.match(/@font-face/g) || []).length === 2);
  check('[97-12] สองสแตกใช้คนละชื่อวงศ์ (ไม่ปนกัน)',
    sp.includes('font-family:"' + LF.SP_FAMILY + '"') &&
    pr.includes('font-family:"' + LF.LANG_FAMILY + '"') &&
    !sp.includes('"' + LF.LANG_FAMILY + '"'));
  check('[97-12] ★ สัดส่วนรายแถวออกมาเป็น size-adjust', sp.includes('size-adjust:85%'), sp);
  check('[97-12] size 100 = ไม่ต้องใส่ size-adjust (ไม่รบกวนของเดิม)',
    !pr.includes('size-adjust'), pr);
  check('[97-12] นับแถวที่ใช้ได้แยกตามโหมด',
    LF.usableCounts(rows).screenplay === 2 && LF.usableCounts(rows).prose === 2 &&
    LF.usableCounts(rows).total === 3);
  const ov = LF.buildLangFontCss([{ range: 'U+0E00-0E7F', family: 'A', ascent: 90, descent: 25 }],
    url, {});
  check('[97-12] ascent/descent override ออกมาครบ',
    ov.includes('ascent-override:90%') && ov.includes('descent-override:25%'), ov);
  check('[97-12] ชื่อฟอนต์หลายตัวคั่นจุลภาค = ลูกโซ่ local() ตามลำดับ',
    (LF.buildLangFontCss([{ range: '', family: 'A, B, C' }], url, {}).match(/local\(/g) || [])
      .length === 3);
  check('[97-12] ★ ลูกโซ่ชื่อฟอนต์ยังถูกล้างอักขระอันตรายทุกตัว (กัน CSS injection)',
    !LF.buildLangFontCss([{ range: '', family: 'A, x";}body{y' }], url, {}).includes('body{'));
}

// ═══ [alpha.97 ข้อ 12] ย้ายค่า spThaiFont ของโปรเจกต์เก่ามาเป็นแถว ═══
{
  const r1 = LF.migrateSpThai([], { enabled: true, size: 92, family: 'Leelawadee UI' });
  check('[97-12] ★ ย้าย spThaiFont เก่ามาเป็นแถวของบท',
    r1.moved === true && r1.rows[0].target === 'screenplay' && r1.rows[0].size === 92 &&
    r1.rows[0].family.startsWith('Leelawadee UI'), JSON.stringify(r1.rows[0]));
  check('[97-12] ฟอนต์ที่ผู้ใช้เลือกมาก่อน แล้วต่อด้วยลูกโซ่มาตรฐาน',
    r1.rows[0].family.split(',').length === LF.SP_THAI_FALLBACKS.length);
  const r2 = LF.migrateSpThai(r1.rows, { enabled: true, size: 60 });
  check('[97-12] ★ ย้ายซ้ำไม่ทับของที่มีอยู่แล้ว',
    r2.moved === false && r2.rows[0].size === 92);
  check('[97-12] ไม่มีค่าเก่า = ไม่ทำอะไร', LF.migrateSpThai([], null).moved === false);
  check('[97-12] ปิดสวิตช์ไว้ก็ย้ายมาแบบปิด',
    LF.migrateSpThai([], { enabled: false }).rows[0].enabled === false);
}

// ═══ ไทยในบทภาพยนตร์ — ค่าคงที่ที่ยังใช้ตั้งค่าเริ่มต้นของแถว ═══
check('ช่วงอักษรไทยของบทยังเป็นค่าเดิม', LF.SP_THAI_RANGE === 'U+0E00-0E7F');
check('85% = ค่าที่วัดแล้วเท่า Courier Prime', LF.SP_THAI_SIZE === 85);
check('ลูกโซ่ฟอนต์ไทยมาตรฐานยังครบ',
  LF.SP_THAI_FALLBACKS.includes('Thonburi') && LF.SP_THAI_FALLBACKS.includes('Leelawadee UI'));

// ═══ [alpha.144] วรรณยุกต์ลอย — ฟอนต์ที่ "ลอย" ต้องไม่อยู่หัวลูกโซ่ไหนอีก ═══
// วัดจริงบนเครื่อง (แคนวาส 80px · ระยะท้องวรรณยุกต์ถึงหัวพยัญชนะ `ท`+`่`):
//   CourierThaiMono 3 · Tahoma 2 · TH Sarabun New 6 · Thonburi 7 · Sarabun 8 · Ayuthaya 28
check('[144] Ayuthaya ไม่ใช่ตัวแรกของลูกโซ่ฟอนต์ไทยของบท',
  LF.SP_THAI_FALLBACKS[0] === 'Thonburi', LF.SP_THAI_FALLBACKS.join(','));
check('[144] Ayuthaya หลุดออกจากลูกโซ่มาตรฐานแล้ว',
  !LF.SP_THAI_FALLBACKS.includes('Ayuthaya'), LF.SP_THAI_FALLBACKS.join(','));
check('[144] ยังเก็บลูกโซ่เดิมไว้เทียบตอนอัปเกรดโปรเจกต์เก่า',
  LF.SP_THAI_FALLBACKS_LEGACY[0] === 'Ayuthaya');
check('[144] Thonburi ขึ้นก่อน Ayuthaya ในรายการฟอนต์ระบบ',
  LF.SYSTEM_THAI_FONTS.findIndex((f) => f.family === 'Thonburi')
    < LF.SYSTEM_THAI_FONTS.findIndex((f) => f.family === 'Ayuthaya'));

// ── ตาข่ายรองอักษรไทยท้ายสแตก ──
// ต้นตอบั๊ก: ผู้ใช้ตั้ง `"Courier New", monospace` ซึ่งไม่มีอักษรไทยเลย → Chromium เลือก
// Ayuthaya ให้เอง = วรรณยุกต์ลอย · ต่อลูกโซ่ไทยท้ายสแตกแล้ววัดได้ 28 → 7
{
  const CN = '"Courier New", monospace';
  const out = LF.withThaiFallback(CN);
  check('[144] สแตกละตินล้วนได้ลูกโซ่ไทยต่อท้าย', out.startsWith(CN) && /Thonburi/.test(out), out);
  check('[144] ตัวไทยตัวแรกที่ต่อให้คือ Thonburi ไม่ใช่ Ayuthaya',
    /Thonburi/.test(out) && !/Ayuthaya/.test(out), out);
  check('[144] เรียกซ้ำแล้วไม่บวมขึ้นเรื่อย ๆ (idempotent)',
    LF.withThaiFallback(out) === out, LF.withThaiFallback(out));
  const already = 'Sarabun, "TH Sarabun New", serif';
  check('[144] ฟอนต์ที่มีไทยอยู่แล้วยังอยู่หัวสแตก (ตาข่ายไม่แย่งที่)',
    LF.withThaiFallback(already).startsWith(already), LF.withThaiFallback(already));
  check('[144] ไม่เติมชื่อที่มีอยู่แล้วซ้ำ',
    (LF.withThaiFallback(already).match(/Sarabun/g) || []).length
      === (already.match(/Sarabun/g) || []).length + 0
      || !/Sarabun".*"Sarabun/.test(LF.withThaiFallback(already)));
  check('[144] สแตกว่างก็ยังได้ลูกโซ่ไทย', /Thonburi/.test(LF.withThaiFallback('')));
  check('[144] วงศ์ K2 Lang ยังอยู่หัวสแตกหลังต่อตาข่าย',
    LF.withThaiFallback(LF.withLangFamily('"Courier New"', true)).startsWith('"K2 Lang"'),
    LF.withThaiFallback(LF.withLangFamily('"Courier New"', true)));
}

// ── อัปเกรดแถวของโปรเจกต์เก่า (ลูกโซ่ Ayuthaya นำ → Thonburi นำ) ──
{
  const legacy = LF.normalizeLangFonts([{ id: 'sp-thai', range: 'U+0E00-0E7F', target: 'screenplay',
    family: LF.SP_THAI_FALLBACKS_LEGACY.join(', '), system: true }]);
  check('[144] แถวเดิมที่ยังเป็นค่าเริ่มต้นถูกสลับเป็นลูกโซ่ใหม่',
    legacy[0].family === LF.SP_THAI_FALLBACKS.join(', '), legacy[0].family);
  const mine = LF.normalizeLangFonts([{ id: 'sp-thai', range: 'U+0E00-0E7F', target: 'screenplay',
    family: 'Ayuthaya, Tahoma', system: true }]);
  check('[144] แถวที่ผู้ใช้พิมพ์เองไม่ถูกแตะ',
    mine[0].family === 'Ayuthaya, Tahoma', mine[0].family);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
