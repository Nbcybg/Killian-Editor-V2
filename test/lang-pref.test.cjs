// test/lang-pref.test.cjs — [alpha.170 · ภาษา] ภาษาของโปรแกรมมีความจริงที่เดียว (ไฟล์ตั้งค่าผู้ใช้)
//
// ที่มา: เปลี่ยน ฝรั่งเศส → อังกฤษ แล้วเปิดใหม่ = หน้าจออังกฤษ เมนูระบบฝรั่งเศสทั้งเมนู (สลับไปมาทุกครั้งที่เปิด)
// "ภาษาที่เลือก" ถูกจำไว้สี่ที่ โดยแต่ละทางเขียนไม่ครบ และแต่ละฝั่งอ่านคนละที่
//   1) ตัวตัดสิน NS.pickLang (บริสุทธิ์)   2) ด่านกวาดซอร์ส — กันทางเขียน/ทางอ่านเส้นที่สองกลับมา
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const NS = require(path.join(ROOT, 'native-shell.cjs'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const codes = ['de', 'en', 'fr', 'ja', 'pt', 'th', 'zh'];
const pick = (o) => NS.pickLang({ codes, ...o });

// ───────────── 1) ตัวตัดสินภาษาตอนเปิดโปรแกรม ─────────────
{
  check('★ ผู้ใช้เลือกแล้ว (มีธง): ไฟล์ตั้งค่าผู้ใช้ชนะทุกอย่าง',
        pick({ picked: true, settings: 'en', project: 'fr', want: 'fr', last: 'fr' }) === 'en');
  check('★ เคสของผู้ใช้: เลือกอังกฤษแล้ว — lang.txt/localStorage/ไฟล์ผลงานที่ค้างฝรั่งเศสไม่ดึงกลับ',
        ['fr', 'ja', 'th', ''].every((stale) => pick({ picked: true, settings: 'en', project: stale, want: stale, last: stale }) === 'en'));
  check('มีธงแต่ไฟล์ภาษานั้นหายจากเครื่อง → ที่หน้าจอจำไว้ → lang.txt',
        pick({ picked: true, settings: 'xx', want: 'ja', last: 'fr' }) === 'ja'
        && pick({ picked: true, settings: 'xx', want: '', last: 'fr' }) === 'fr');
  check('★ ไฟล์ของรุ่นก่อน (ไม่มีธง): เชื่อภาษาในไฟล์ผลงานที่เปิดล่าสุดก่อนไฟล์ผู้ใช้ที่ค้างค่าเก่า',
        pick({ picked: false, settings: 'fr', project: 'en', want: 'fr', last: 'fr' }) === 'en');
  check('ไม่มีธง + ไม่มีผลงานล่าสุด: ที่หน้าจอจำไว้ → ไฟล์ผู้ใช้ → lang.txt',
        pick({ settings: 'fr', want: 'ja', last: 'de' }) === 'ja'
        && pick({ settings: 'fr', want: '', last: 'de' }) === 'fr'
        && pick({ settings: '', want: '', last: 'de' }) === 'de');
  check('ค่าที่ไม่มีไฟล์ภาษา = ข้าม (ไม่คืนรหัสที่โหลดไม่ได้)',
        pick({ picked: true, settings: 'zz', want: 'yy', last: 'xx' }) === 'th'
        && pick({ project: 'zz', want: ' en ', settings: 'fr' }) === 'en');
  check('ไม่มีอะไรเลย = ไทย · ไม่มีไทย = ตัวแรกที่มี · ไม่มีไฟล์ภาษาเลย = ว่าง',
        pick({}) === 'th' && NS.pickLang({ codes: ['en', 'fr'] }) === 'en' && NS.pickLang({ codes: [] }) === '' && NS.pickLang() === '');
  check('ค่าที่ไม่ใช่ข้อความไม่ทำให้พัง', pick({ picked: true, settings: null, want: undefined, last: 5 }) === 'th');
}

// ───────────── 2) ด่านกวาดซอร์ส ─────────────
{
  const main = read('main.js');
  check('★ main: เมนูระบบตอนเปิดกับตัวโหลดแบบ sync ของหน้าจอ ถามตัวตัดสินตัวเดียวกัน (bootLangCode)',
        /loadLangTable\(bootLangCode\(''\)\)/.test(main)
        && /ipcMain\.on\('lang:sync'[\s\S]{0,700}bootLangCode\(/.test(main)
        && /function bootLangCode[\s\S]{0,1500}NS\.pickLang\(/.test(main));
  check('★ main: lang:sync ตั้งภาษาของเมนูระบบให้ตรงกับที่ส่งให้หน้าจอ (setMainLang)',
        /ipcMain\.on\('lang:sync'[\s\S]{0,900}setMainLang\(code\)/.test(main));
  check('main: ไม่มีตัวอ่านภาษาเส้นเก่า (lastLangCode — อ่าน lang.txt ก่อนไฟล์ผู้ใช้)', !/lastLangCode/.test(main));
  check('main: setMainLang ข้ามเมื่อเป็นภาษาเดิม (renderer เรียกทุกครั้งที่โหลดภาษา — ห้ามสร้างเมนูซ้ำทุกรอบ)',
        /function setMainLang[\s\S]{0,400}c === LANG_CODE\) return false/.test(main));

  const core = read('src/core.js');
  const loadFn = core.slice(core.indexOf('export async function loadLanguage'), core.indexOf('export function applyDataI18n'));
  check('★ loadLanguage บอก main ทุกครั้ง (เมนูระบบ = ภาษาเดียวกับหน้าจอ ไม่ว่าโหลดจากทางไหน)',
        /kapi\.langSet\(i18n\.lang\)/.test(loadFn));

  const app = read('src/app.js');
  const setFn = app.slice(app.indexOf('export async function setAppLanguage'), app.indexOf('export async function setAppLanguage') + 900);
  check('★ setAppLanguage เขียนไฟล์ตั้งค่าผู้ใช้ (language + ธง) เสมอ — ไม่ขึ้นกับว่ามีผลงานเปิดอยู่ไหม',
        /mergeGlobalSettings\(\{ language: real, languagePicked: true \}\)/.test(setFn) && !/if \(!state\.root\)[^\n]*mergeGlobalSettings/.test(setFn));
  const loadProj = app.slice(app.indexOf('const probe = await kapi.readJson'), app.indexOf('await buildTree();', app.indexOf('const probe = await kapi.readJson')));
  check('★ เปิดผลงานไม่เปลี่ยนภาษาของโปรแกรม (ไม่โหลดภาษาจาก settings ของผลงาน)',
        loadProj.length > 200 && !/projLang/.test(loadProj) && !/loadLanguage\(\s*state\.settings\.language/.test(loadProj)
        && /loadLanguage\(i18n\.lang, root\)/.test(loadProj));
  const loadSet = app.slice(app.indexOf('async function loadSettings(meta)'), app.indexOf('export function applySettings()'));
  check('★ loadSettings: ภาษาในหน่วยความจำ = ภาษาที่ใช้อยู่ (สำเนาในไฟล์ผลงานทับไม่ได้)',
        /state\.settings\.language = i18n\.lang;/.test(loadSet));
  const boot = app.slice(app.indexOf('export async function bootSequence()'), app.indexOf('startupUpdateCheck()', app.indexOf('export async function bootSequence()')));
  check('★ bootSequence ไม่โหลดภาษาซ้ำจากไฟล์ผู้ใช้ (main ตัดสินไปแล้ว) + ปักธงให้ไฟล์ของรุ่นก่อนครั้งเดียว',
        !/loadLanguage\(/.test(boot) && /languagePicked !== true/.test(boot) && /mergeGlobalSettings\(\{ language: i18n\.lang, languagePicked: true \}\)/.test(boot));
  check('★ ภาพของเซสชันไม่เก็บ/ไม่กู้ k2-lang (ภาพเก่ายัดภาษาเดิมกลับตอนเปิดใหม่)',
        (app.match(/k\.startsWith\('k2-'\) && k !== LANG_LS_KEY/g) || []).length === 2);

  const dlg = read('src/dialogs.js');
  check('★ กล่องตั้งค่าเปลี่ยนภาษาผ่าน setAppLanguage ทางเดียว (ไม่เขียน s.language / ไม่เรียก langSet เอง)',
        /setAppLanguage\(selLang\)/.test(dlg) && !/s\.language\s*=/.test(dlg) && !/kapi\.langSet\(/.test(dlg));
  check('กล่องตั้งค่า: ปุ่ม "โหลดไฟล์ภาษาใหม่" อ่านภาษาที่ใช้อยู่ (ไม่เปลี่ยนภาษาโดยไม่ได้บันทึก)',
        !/loadLanguage\(q\('#st-lang'\)\.value/.test(dlg) && /loadLanguage\(i18n\.lang, state\.root\)/.test(dlg));

  // ทางเขียนภาษาลงไฟล์ผู้ใช้ต้องมีทางเดียว — ไม่มีใครเรียก saveGlobalSetting('language', …) นอก setAppLanguage
  const srcDir = path.join(ROOT, 'src');
  const offenders = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (f !== 'generated') walk(p); continue; }
      if (!f.endsWith('.js') || f === 'selftest.js') continue;
      if (/saveGlobalSetting\(\s*['"]language['"]/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(ROOT, p));
    }
  })(srcDir);
  check('ไม่มีทางเขียนภาษาลงไฟล์ผู้ใช้เส้นที่สอง (saveGlobalSetting(\'language\'))', offenders.length === 0, offenders.join(', '));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
