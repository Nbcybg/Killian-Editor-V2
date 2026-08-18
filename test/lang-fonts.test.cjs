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
  check('ค่าเริ่มต้นเป็นไทย + ปิดไว้ก่อน (ไม่แอบเปลี่ยนหน้าตาโปรเจกต์เดิม)',
    LF.defaultLangFonts()[0].range === 'U+0E00-0E7F' && LF.defaultLangFonts()[0].enabled === false);
}

// ═══ [alpha.84 ข้อ 1] ตัวปรับสัดส่วนฟอนต์ไทยของบทภาพยนตร์ ═══
{
  check('ค่าเริ่มต้นเปิดไว้ที่ 85% (วัดแล้วเท่า Courier Prime)',
    LF.SP_THAI_DEFAULTS.enabled === true && LF.SP_THAI_DEFAULTS.size === 85);
  const d = LF.normalizeSpThai(undefined);
  check('normalizeSpThai: ไม่ส่งอะไรมา → ได้ค่าเริ่มต้นครบ',
    d.enabled === true && d.size === 85 && d.family === '' && d.ascent === 0 && d.descent === 0);
  check('normalizeSpThai: หนีบขนาดไว้ 50–150',
    LF.normalizeSpThai({ size: 5 }).size === 50 && LF.normalizeSpThai({ size: 999 }).size === 150);
  check('normalizeSpThai: ค่าไม่ใช่ตัวเลข → คืนค่าเริ่มต้น',
    LF.normalizeSpThai({ size: 'x' }).size === 85);
  check('normalizeSpThai: ล้างอักขระอันตรายออกจากชื่อฟอนต์ (กัน CSS injection)',
    LF.normalizeSpThai({ family: 'A";}body{x' }).family === 'Abodyx',
    LF.normalizeSpThai({ family: 'A";}body{x' }).family);
  check('ชื่อฟอนต์ที่ถูกล้างแล้วยังยัดลง CSS ได้อย่างปลอดภัย',
    !LF.buildSpThaiCss({ family: 'A";}body{x' }).includes('body{'));

  const css = LF.buildSpThaiCss({});
  check('สร้าง @font-face ของวงศ์ K2 SP Thai', css.includes('font-family:"' + LF.SP_THAI_FAMILY + '"'));
  check('จำกัดเฉพาะช่วงอักษรไทย', css.includes('unicode-range:U+0E00-0E7F'));
  check('มี size-adjust ซึ่งเป็นหัวใจของการแก้', css.includes('size-adjust:85%'));
  check('ใช้ local() ล้วน (ฟอนต์ไทยของระบบแจกไม่ได้)',
    css.includes('local("Ayuthaya")') && !css.includes('url('));
  check('ไม่ใส่ ascent/descent-override ถ้าไม่ได้ตั้ง',
    !css.includes('ascent-override') && !css.includes('descent-override'));
  const css2 = LF.buildSpThaiCss({ ascent: 90, descent: 25, size: 80 });
  check('ตั้ง ascent/descent แล้วออกมาใน CSS',
    css2.includes('ascent-override:90%') && css2.includes('descent-override:25%') &&
    css2.includes('size-adjust:80%'));
  check('ปิดสวิตช์ = ไม่มี CSS เลย', LF.buildSpThaiCss({ enabled: false }) === '');

  check('เลือกฟอนต์เองแล้วมันมาก่อนลูกโซ่มาตรฐาน',
    LF.spThaiSources({ family: 'Sarabun' })[0] === 'Sarabun' &&
    LF.spThaiSources({ family: 'Sarabun' }).filter((f) => f === 'Sarabun').length === 1);
  check('ไม่เลือก = ใช้ลูกโซ่มาตรฐานทั้งชุด',
    LF.spThaiSources({}).join(',') === LF.SP_THAI_FALLBACKS.join(','));

  const stack = '"Courier Prime", monospace';
  check('withSpThaiFamily: เอาวงศ์ไปไว้หน้าสุด',
    LF.withSpThaiFamily(stack, {}) === '"K2 SP Thai", ' + stack);
  check('withSpThaiFamily: เรียกซ้ำไม่ซ้อน',
    LF.withSpThaiFamily(LF.withSpThaiFamily(stack, {}), {}) === '"K2 SP Thai", ' + stack);
  check('withSpThaiFamily: ปิดสวิตช์ = คืนสแตกเดิมไม่แตะ',
    LF.withSpThaiFamily(stack, { enabled: false }) === stack);
  check('withSpThaiFamily: ต้องมาก่อน K2 Lang ด้วย (ไทยของบทชนะฟอนต์ตามภาษา)',
    LF.withSpThaiFamily(LF.withLangFamily(stack, true), {})
      .startsWith('"K2 SP Thai", "K2 Lang"'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
