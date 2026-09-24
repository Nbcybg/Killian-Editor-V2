// test/i18n-locale.test.cjs — [alpha.162 · W7] วันที่ · ตัวเลข · การเรียง · การตัดคำ · <html lang> ตามภาษาที่เลือก
//
// สองส่วน:
//   ก. พฤติกรรมของ src/locale.js (ประกอบกับ i18n.js ตัวจริง — สลับภาษาด้วย setTable เหมือนตอนโหลดไฟล์ภาษา)
//   ข. ด่านซอร์ส: ห้ามล็อกภาษาไทยไว้ในโค้ดอีก · ห้ามส่งค่าสำรองเข้า t() · ไฟล์อังกฤษห้ามถอย
const fs = require('fs');
const path = require('path');
const os = require('os');
const ROOT = path.join(__dirname, '..');

const out = path.join(os.tmpdir(), 'k2-locale-test.cjs');
require('esbuild').buildSync({
  stdin: { contents: "export * from './src/locale.js'; export { setTable } from './src/i18n.js';", resolveDir: ROOT, loader: 'js' },
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent', platform: 'node',
});
const L = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };
const use = (code) => L.setTable({}, code);
const D = new Date(2026, 8, 22, 14, 5, 9);

// ───────── ก. พฤติกรรม ─────────
use('');
check('★ ยังไม่โหลดภาษา = ภาษาเริ่มต้นของโปรแกรม (th)', L.uiLang() === 'th');
use('th');
check('★★ ไทย → พ.ศ.', L.fmtDate(D).includes('2569') && !L.fmtDate(D).includes('2026'), L.fmtDate(D));
check('ไทย → ปฏิทินพุทธระบุชัด ๆ', L.dateLocale() === 'th-TH-u-ca-buddhist' && L.calendarOf() === 'buddhist');
use('en');
check('★★ อังกฤษ → ค.ศ.', L.fmtDate(D).includes('2026') && !L.fmtDate(D).includes('2569'), L.fmtDate(D));
check('★ อังกฤษ → วันที่+เวลา ไม่มีปี พ.ศ.', /2026/.test(L.fmtDateTime(D)) && /14|2:05/.test(L.fmtDateTime(D)), L.fmtDateTime(D));
use('ja');
check('★★ ภาษาอื่น (ja) → ค.ศ. ไม่ใช่ปฏิทินรัชศก', L.fmtDate(D).includes('2026'), L.fmtDate(D));
use('en-GB');
check('รหัสภาษามีภูมิภาค (en-GB) → ใช้ภาษาหลัก en', L.uiLang() === 'en');
use('TH_th');
check('รหัสตัวใหญ่/ขีดล่าง (TH_th) → th', L.uiLang() === 'th');
use('bad tag!!');
check('★ รหัสภาษาเสีย → ไม่พัง ตกไปใช้ th', L.uiLang() === 'th' && L.fmtDate(D).includes('2569'));
use('zz');
check('ภาษาที่ผู้ใช้เพิ่มเอง (zz) → ค.ศ. · ไม่พัง', L.fmtDate(D).includes('2026'), L.fmtDate(D));
check('★ ภาษาที่ ICU ไม่รู้จัก → ใช้รูปแบบ en (ไม่ตกไปตามภาษาของเครื่อง ซึ่งทิ้งปฏิทินที่ขอ)', L.textLocale() === 'en' && L.fmtNum(1234567) === '1,234,567');

use('th');
check('★ ค่าที่ไม่ใช่วันที่ = สตริงว่าง (คนเรียกใส่ — เอง)', L.fmtDate('ไม่ใช่วันที่') === '' && L.fmtDate(null) === ''
  && L.fmtDateTime(undefined) === '' && L.fmtTime('') === '' && L.fmtDate(NaN) === '');
check('รับ ms เป็นตัวเลข/สตริงตัวเลข/ISO/Date ได้', [D.getTime(), String(D.getTime()), D.toISOString(), D]
  .every((v) => L.fmtDate(v) === L.fmtDate(D)));
check('ส่งตัวเลือกเอง (เช่น วันในสัปดาห์) ได้', L.fmtDate(D, { weekday: 'long' }).length > 0);
check('fmtTime ไม่มีปี', !/2569|2026/.test(L.fmtTime(D)) && /05/.test(L.fmtTime(D)), L.fmtTime(D));

use('en');
check('★ ตัวเลขตามภาษา: en 1,234,567', L.fmtNum(1234567) === '1,234,567', L.fmtNum(1234567));
use('de');
check('★ ตัวเลขตามภาษา: de ใช้จุดคั่นหลักพัน', L.fmtNum(1234567) === '1.234.567', L.fmtNum(1234567));
check('ตัวเลขเสีย → ไม่พัง คืนค่าเดิมเป็นสตริง', L.fmtNum('x') === 'x' && L.fmtNum(undefined) === '' && L.fmtNum(Infinity) === 'Infinity');

const W = ['ไก่', 'กา', 'เกม', 'โต๊ะ', 'ขวด', 'แมว', 'Zebra', 'apple'];
use('th');
const thSort = [...W].sort(L.cmpText).join(' ');
check('★★ ไทย: สระหน้าเรียงถูก + อักษรไทยมาก่อนละติน', thSort === 'กา เกม ไก่ ขวด โต๊ะ แมว apple Zebra', thSort);
use('en');
const enSort = [...W].sort(L.cmpText).join(' ');
check('★★ อังกฤษ: ละตินมาก่อน · สระหน้าไทยยังเรียงถูก (ICU ไม่ได้พึ่ง locale th สำหรับเรื่องนี้)',
  enSort === 'apple Zebra กา เกม ไก่ ขวด โต๊ะ แมว', enSort);
check('★ สลับภาษาแล้วตัวเทียบเปลี่ยนตาม (แคชผูกภาษา)', (use('th'), L.cmpText('apple', 'กา') > 0) && (use('en'), L.cmpText('apple', 'กา') < 0));
check('cmpText รับ null/undefined ได้', L.cmpText(null, undefined) === 0 && L.cmpText(null, 'a') < 0);

const TXT = 'ฉันกินข้าวที่ร้านอาหารใกล้บ้าน hello world 東京都に住んでいます';
const segOf = (code) => { use(code); const s = L.wordSegmenter(); return s ? [...s.segment(TXT)].filter((x) => x.isWordLike).map((x) => x.segment).join('|') : null; };
const segTh = segOf('th');
check('★ ตัวตัดคำไทยทำงาน', !!segTh && segTh.startsWith('ฉัน|กิน|ข้าว'), segTh);
check('★★ ตัดคำได้ผลเท่ากันทุกภาษา (ดัชนีค้นหาไม่ต้องสร้างใหม่ตอนเปลี่ยนภาษา)',
  ['en', 'ja', 'zz', 'bad tag!!'].every((c) => segOf(c) === segTh));

check('ทิศภาษา: ar/he = rtl · th/en = ltr', L.langDir('ar') === 'rtl' && L.langDir('he') === 'rtl' && L.langDir('th') === 'ltr' && L.langDir('en') === 'ltr');
{
  const de = { lang: '', dir: '' };
  global.document = { documentElement: de };
  L.applyDocLang('en');
  const a = de.lang === 'en' && de.dir === 'ltr';
  L.applyDocLang('ar-EG');
  const b = de.lang === 'ar' && de.dir === 'rtl';
  L.applyDocLang('th');
  check('★★ applyDocLang ตั้ง <html lang dir> ตามภาษา', a && b && de.lang === 'th' && de.dir === 'ltr', JSON.stringify(de));
  delete global.document;
  check('applyDocLang ไม่มี DOM → ไม่พัง', L.applyDocLang('th') === false);
}
L.setLocaleOverride('en'); use('th');
check('setLocaleOverride บังคับภาษาได้ · ล้างแล้วกลับไปตามภาษาที่โหลด', L.uiLang() === 'en' && (L.setLocaleOverride(''), L.uiLang() === 'th'));

// ───────── ข. ด่านซอร์ส ─────────
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const noCmt = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
const srcFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'generated') walk(p); }
    else if (e.name.endsWith('.js') && e.name !== 'locale.js') srcFiles.push(p);
  }
})(path.join(ROOT, 'src'));
const hits = (re, { skipSelftest = true } = {}) => {
  const o = [];
  for (const f of srcFiles) {
    if (skipSelftest && f.endsWith('selftest.js')) continue;
    noCmt(fs.readFileSync(f, 'utf8')).split('\n').forEach((l, i) => { if (re.test(l)) o.push(path.relative(ROOT, f) + ':' + (i + 1)); });
  }
  return o;
};

const thTH = hits(/toLocale(Date|Time)?String\(\s*['"]th/, { skipSelftest: false });
check('★★ ไม่มี toLocale*(\'th-TH\') ในซอร์สเลย (รวม selftest)', thTH.length === 0, thTH.join(' '));
const anyLocale = hits(/\.toLocale(Date|Time)?String\(/);
check('★★ วันที่/ตัวเลขทุกจุดผ่าน locale.js (ไม่มี .toLocaleString() ตรง ๆ ใน src)', anyLocale.length === 0, anyLocale.slice(0, 6).join(' '));
const fixedCmp = hits(/localeCompare\([^)]*,\s*['"][a-z]{2}(-[A-Z]{2})?['"]/);
check('★★ ไม่มีการเรียงที่ล็อกภาษา (localeCompare(x, \'th\'))', fixedCmp.length === 0, fixedCmp.join(' '));
const fixedIntl = hits(/new Intl\.(Collator|Segmenter|DateTimeFormat|NumberFormat)\(\s*['"]/);
check('★★ ไม่มี Intl.* ที่ล็อกภาษาไว้ (ต้องผ่าน locale.js)', fixedIntl.length === 0, fixedIntl.join(' '));
check('★ app.js: _thCmp ตามภาษาที่เลือก', /const _thCmp = \(a, b\) => cmpText\(/.test(rd('src/app.js')) || /const _thCmp = cmpText;/.test(rd('src/app.js')));

// <html lang> + dir ต้องถูกตั้ง **หลัง** โหลดเสร็จ (รวมกรณีตกไปใช้ en) — ไม่ใช่ก่อน
{
  const core = rd('src/core.js');
  const body = core.slice(core.indexOf('export async function loadLanguage('));
  const fnEnd = body.indexOf('\n}\n') > 0 ? body.indexOf('\n}\n') : body.indexOf('\r\n}\r\n');
  const fn = body.slice(0, fnEnd);
  const iFallback = fn.indexOf("i18n.lang = 'en';");
  const iApply = fn.indexOf('applyDocLang(i18n.lang)');
  check('★★ loadLanguage ตั้ง <html lang dir> หลังโหลด/หลังตกไปใช้ en', iApply > 0 && iFallback > 0 && iApply > iFallback);
  check('★ loadLanguage ไม่ตั้ง documentElement.lang เองก่อนโหลด (ทางเดียว = applyDocLang)', !/documentElement\.lang\s*=/.test(noCmt(fn)));
  check('ภาษาที่โหลดแบบ sync ตอนเปิดก็ตั้ง <html lang> ด้วย', /if \(langInfo\.code\) \{\s*i18n\.lang = langInfo\.code;\s*applyDocLang\(/.test(core));
}

// t() ไม่รับค่าสำรอง
{
  const i18n = rd('src/i18n.js');
  check('★★ t() รับอาร์กิวเมนต์เดียว', /export function t\(key\) \{/.test(i18n));
  const fb = hits(/\bt{1,2}\(\s*'(ui\.)?[A-Za-z][\w.]*'\s*,/);
  check('★★ ไม่มีจุดไหนส่งค่าสำรองเข้า t()/tt() (ไม่มีผล — หลอกคนอ่าน)', fb.length === 0, fb.slice(0, 6).join(' '));
  const wrap = hits(/=>\s*t{1,2}\([^()]*\+\s*\w+\s*,\s*\w+\s*\)/);
  check('★ ไม่มีตัวห่อ t() ที่ส่งค่าสำรองต่อ (แบบ tr(key, fb) เดิม)', wrap.length === 0, wrap.join(' '));
}

// ฟอนต์: ป้ายแปลได้ · ค่าเริ่มต้นไม่ใช่ไทยล้วน
{
  const lf = noCmt(rd('src/lang-fonts.js'));
  const hard = (lf.match(/label:\s*'[^']*\(Windows\)[^']*'/g) || []);
  check('★ ป้ายฟอนต์ระบบแปลได้ (ไม่มี \'… (Windows)\' ตายตัว)', hard.length === 0, hard.join(' '));
  const body = rd('renderer/style.css').match(/\nbody\s*\{[^}]*font-family:([^;]+);/);
  check('★ ฟอนต์เริ่มต้นของ UI ไม่ใช่ไทยล้วน (มีฟอนต์ละติน + system-ui)',
    !!body && /Segoe UI/.test(body[1]) && /system-ui/.test(body[1]), body && body[1]);
}

// ไฟล์อังกฤษห้ามถอย
{
  const r = require('../tools/i18n-en-report.cjs').report();
  // [alpha.164 · L-1] แปลครบแล้ว — เหลือ 3 แถวที่ "ตั้งใจเป็นไทย" (ตัวอย่างฟอนต์ไทย 2 · ตัวแปรหัวกระดาษชื่อไทย 1)
  const INTENTIONAL_THAI = ['ui.dlg.fontSampleText', 'ui.dlg.iNTNightSceneOne', 'ui.pdf.printNameEgPage'];
  check('★★ แถวที่ยังเป็นไทยใน k2_en.csv ไม่เพิ่ม (≤ 3 · คีย์ใหม่ต้องมีคำแปลอังกฤษจริง)', r.thai <= 3, r.thai);
  check('★ [164-L1] แถวไทยที่เหลือใน k2_en.csv เป็นของที่ตั้งใจเท่านั้น',
    r.thaiKeys.every((k) => INTENTIONAL_THAI.includes(k)), r.thaiKeys.filter((k) => !INTENTIONAL_THAI.includes(k)).join(' · '));
  check('รายงานแยก namespace ได้ (ใช้วางแผนรอบแปล)', r.byNs.length > 50 && r.byNs.every((x) => x.thai <= x.total));
}

// ทิศทาง: ย้ายไป logical properties ทีละน้อย — ห้ามถอย · กลเม็ด direction:rtl ต้องคงแบบกายภาพ
{
  const css = rd('renderer/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const physTa = (css.match(/text-align\s*:\s*(left|right)\b/g) || []).length;
  const physBox = (css.match(/(margin|padding|border)-(left|right)\s*:/g) || []).length;
  check('★ text-align แบบกายภาพใน style.css ไม่เพิ่ม (≤ 23 · ที่เหลือคือหน้ากระดาษ/บทภาพยนตร์/กลเม็ดตัดหัว) · ของใหม่ใช้ start/end',
    physTa <= 23, physTa);
  check('★ margin/padding/border -left/-right ใน style.css ไม่เพิ่ม (≤ 158 · ของใหม่ใช้ -inline-start/-end)', physBox <= 158, physBox);
  check('UI ส่วนที่ย้ายแล้วใช้ text-align:start/end จริง', (css.match(/text-align\s*:\s*(start|end)\b/g) || []).length >= 24);
  // กลเม็ด "ตัดหัวที่อยู่ให้เห็นท้ายทาง" (direction:rtl) — ถ้าเปลี่ยนเป็น start จะชิดขวาทันที
  const rtlRules = css.match(/[^{}]*\{[^{}]*direction\s*:\s*rtl[^{}]*\}/g) || [];
  check('★★ กฎที่ใช้ direction:rtl เป็นกลเม็ดตัดข้อความ ยังชิดซ้ายแบบกายภาพ (ไม่ใช่ start)',
    rtlRules.length >= 2 && rtlRules.every((r) => /text-align\s*:\s*left/.test(r)), rtlRules.map((r) => r.trim().split('{')[0]).join(' | '));
  check('★ ที่อยู่โปรเจกต์บนการ์ดหน้าแรกยังตัดหัว (home-ui ใช้ .home-card-pathtxt)',
    /\.home-card-pathtxt\s*\{[^}]*direction\s*:\s*rtl/.test(css) && /'home-card-pathtxt'/.test(rd('src/home-ui.js')));
  // หน้ากระดาษบทภาพยนตร์ตามรูปแบบมาตรฐาน = เรขาคณิตของหน้าพิมพ์ ไม่ใช่ทิศของ UI
  check('บทภาพยนตร์: transition/CONTINUED ยังชิดขวาแบบกายภาพ', /\.sp-transition\s*\{[^}]*text-align\s*:\s*right/.test(css));
}

// ช่วงข้ามแบบเลขบรรทัด (SKIP_RANGES) เลิกใช้แล้ว — ใช้เครื่องหมายในซอร์สที่ย้ายตามโค้ด
{
  const C = require('../tools/i18n-classify.cjs');
  check('★★ SKIP_RANGES ว่าง (เลขบรรทัดเลื่อนเงียบ ๆ เมื่อแทรกโค้ด — ใช้ /* i18n-skip */ แทน)',
    Object.keys(C.SKIP_RANGES).length === 0, Object.keys(C.SKIP_RANGES).join(' '));
  const moved = ['src/kanban/kanban-core.js', 'src/branch-plans.js', 'src/visual-tags.js', 'src/convert.js',
    'src/ai/ai-character.js', 'src/ai/ai-analyze.js', 'src/plugins/plugin-core.js'];
  const bad = moved.filter((f) => C.markedRegions(rd(f)).length === 0);
  check('★ ไฟล์ที่ย้ายมามีเครื่องหมาย i18n-skip ที่ตัวจัดกลุ่มอ่านได้จริง', bad.length === 0, bad.join(' '));
  check('★ เหตุผลในเครื่องหมายมี * ได้ (เดิมทำให้ตัวเปิดไม่ถูกจับแบบเงียบ)',
    JSON.stringify(C.markedRegions("a /* i18n-skip: ไฟล์ Branches/*.json */ 'x' /* /i18n-skip */ b")) === '[[2,57]]'
    || C.markedRegions("a /* i18n-skip: ไฟล์ Branches/*.json */ 'x' /* /i18n-skip */ b").length === 1);
  check('ตัวปิดอย่างเดียวไม่นับเป็นช่วง', C.markedRegions('/* /i18n-skip */ x').length === 0);
}

console.log(`\ni18n-locale: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
