// test/theme.test.cjs — [alpha.137·138] ทะเบียนธีมของโปรแกรม (K2 · K2 สว่าง)
//
// **ทำไมต้องมีเทสนี้**: ธีมกระจายอยู่ 4 ที่ — `THEMES` (core.js) · `body.theme-<id>` (style.css) ·
// ป้ายในไฟล์ภาษา · ช่อง `#st-theme` ในเทมเพลตกล่องตั้งค่า · ขาดที่ใดที่หนึ่งแล้ว "เลือกได้แต่ไม่เปลี่ยนสี"
// (หรือเลวกว่า: ชื่อธีมโผล่เป็นตัวคีย์บนหน้าจอ) โดยไม่มีอะไรฟ้องจนกว่าจะไปกดเอง
//
// กฎเหล็กที่ต้องถือไว้ด้วย: **ธีมห้ามแตะ --paper-*** (เปลี่ยนได้แค่เปลือกโปรแกรม ไม่ใช่หน้ากระดาษ)
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ROOT = path.join(__dirname, '..');
const out = path.join(os.tmpdir(), '_k2theme.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/core.js')], outfile: out,
                               format: 'cjs', bundle: true, logLevel: 'silent' });
// core.js สร้าง SmartType (ซึ่งแตะ DOM) ตอน import — บน node จึงต้องมีของปลอมพอให้ผ่าน
// (ทะเบียนธีมเองไม่แตะ DOM เลย · ของปลอมชุดเดียวกับ shortcuts.test.cjs)
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} },
  appendChild() {}, append() {}, remove() {}, setAttribute() {}, addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], firstChild: null, dataset: {} });
globalThis.document = { createElement: stubEl, body: stubEl(), documentElement: stubEl(),
  addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
globalThis.window = { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
globalThis.localStorage = globalThis.window.localStorage;
const C = require(out);
const { lexCsv } = require('../tools/csv-lite.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  x FAIL:', n, i ? ':: ' + i : ''); } };

const css = fs.readFileSync(path.join(ROOT, 'renderer/style.css'), 'utf8');
// [alpha.157] ตัวแปรสีของแต่ละธีมอยู่ไฟล์ของตัวเอง renderer/themes/<id>.css (ผู้ใช้สั่งแยกไฟล์)
const themeCss = (id) => { try { return fs.readFileSync(path.join(ROOT, 'renderer/themes/' + id + '.css'), 'utf8'); } catch { return ''; } };
/** เนื้อในของบล็อก `body.theme-<id> { … }` ('' = ไม่มีบล็อกนั้น) */
const blockOf = (id) => {
  const head = 'body.theme-' + id + ' {';
  const css = themeCss(id);
  const i = css.indexOf(head);
  if (i < 0) return '';
  const j = css.indexOf('\n}', i);
  return j < 0 ? '' : css.slice(i + head.length, j);
};

// ── ทะเบียน ──
// [alpha.138] ผู้ใช้สั่ง: ไม่เอา dark/light ของเดิม เหลือจานสีประจำโปรแกรมสองเฉด
// [alpha.159] ทะเบียนย้ายไป themes.json — k2 / k2-light ยังต้องอยู่หัวรายการ (ค่าเริ่มต้น + ค่าแปลงของเก่า)
check('มีทะเบียนธีม THEMES', Array.isArray(C.THEMES) && C.THEMES.length >= 2, JSON.stringify(C.THEMES));
check('k2 / k2-light อยู่หัวรายการ', C.THEMES[0] === 'k2' && C.THEMES[1] === 'k2-light', String(C.THEMES));
check('[alpha.159] มีธีมจานสีที่ผู้ใช้ขอครบ',
      ['sakura-mist', 'plum-wine', 'lagoon', 'neon-pop', 'tropical', 'claude', 'opencode', 'kimi', 'vscode',
       'word', 'excel', 'powerpoint', 'macintosh', 'gundam', 'dva', 'fruit', 'flower', 'rainbow']
        .every((id) => C.THEMES.includes(id)), String(C.THEMES));
check('ไม่มีชื่อธีมซ้ำ', new Set(C.THEMES).size === C.THEMES.length);
// ค่าเก่าที่เคยบันทึกไว้ต้องยังเปิดได้ (ไม่ตกไปค่าเริ่มต้นเงียบ ๆ)
check('มีตารางแปลงค่าเก่า dark→k2 · light→k2-light',
      C.THEME_ALIAS && C.THEME_ALIAS.dark === 'k2' && C.THEME_ALIAS.light === 'k2-light',
      JSON.stringify(C.THEME_ALIAS));
check('ค่าที่แปลงแล้วต้องเป็นธีมที่มีอยู่จริง',
      Object.values(C.THEME_ALIAS).every((v) => C.THEMES.includes(v)));
check('ธีมเก่าถูกลบออกจาก style.css แล้วจริง ๆ (ไม่เหลือกฎกำพร้า)',
      !css.includes('body.theme-light ') && !css.includes('body.theme-dark '),
      css.includes('body.theme-light ') ? 'ยังมี theme-light' : 'ยังมี theme-dark');
check('ค่าเริ่มต้นของโปรแกรม = ธีม K2 (ผู้ใช้กำหนดจานสีนี้)',
      C.DEFAULT_SETTINGS.theme === 'k2', C.DEFAULT_SETTINGS.theme);
check('ค่าเริ่มต้นต้องเป็นธีมที่มีอยู่จริง', C.THEMES.includes(C.DEFAULT_SETTINGS.theme));

// ── ทุกธีมต้องมีกฎ CSS + ป้ายในไฟล์ภาษาทุกไฟล์ ──
const langDir = path.join(ROOT, 'languages');
const langs = fs.readdirSync(langDir).filter((f) => /^k2_.+\.csv$/.test(f))
  .map((f) => [f, lexCsv(fs.readFileSync(path.join(langDir, f), 'utf8'))]);
for (const id of C.THEMES) {
  check('ธีม ' + id + ' มีบล็อก body.theme-' + id + ' ในไฟล์ themes/' + id + '.css', !!blockOf(id));
  check('ธีม ' + id + ' ถูกโหลดใน index.html', fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8').includes('href="themes/' + id + '.css"'));
  check('ธีม ' + id + ' ไม่มีบล็อกซ้ำค้างใน style.css', !css.includes('body.theme-' + id + ' {'));
  check('ธีม ' + id + ' กำหนดพื้นรอบกระดาษ + ชุดแท็บ (alpha.157)', ['--paper-surround', '--tab-bar', '--tab-bg', '--tab-fg-on'].every((v) => blockOf(id).includes(v + ':')));
  check('ธีม ' + id + ' มีคีย์ป้ายใน THEME_LABEL_KEYS', !!C.THEME_LABEL_KEYS[id]);
  for (const [f, tbl] of langs) {
    const k = C.THEME_LABEL_KEYS[id];
    check(f + ': มีป้ายของธีม ' + id, !!(tbl[k] || '').trim(), k);
  }
}

// ── ธีมห้ามแตะหน้ากระดาษ (กฎเหล็กเดิมของโปรเจกต์) ──
for (const id of C.THEMES) {
  const b = blockOf(id);
  // ธีมสว่างตั้ง --paper-surround (พื้น "รอบ" กระดาษ = เปลือกโปรแกรม) ได้ — แต่ห้ามแตะตัวกระดาษเอง
  const bad = [...b.matchAll(/--paper-[\w-]+/g)].map((x) => x[0])
    .filter((v) => v !== '--paper-surround');
  check('ธีม ' + id + ' ไม่แตะตัวแปรของหน้ากระดาษ', bad.length === 0, bad.join(' '));
}

// ── จานสี K2 ต้องเป็นสี่สีที่ผู้ใช้กำหนด ──
{
  const b = blockOf('k2');
  check('ธีม K2 มีบล็อกของตัวเอง', !!b);
  if (b) {
    for (const [name, hex] of [['--k2-navy', '#1e1250'], ['--k2-purple', '#452f5e'],
                               ['--k2-orange', '#ff6640'], ['--k2-yellow', '#ffc55c']]) {
      check('จานสี K2: ' + name + ' = ' + hex, b.includes(name + ':' + hex + ';'));
    }
    check('ธีม K2 ใช้ส้มของจานเป็นสีเน้น', b.includes('--accent:#ff6640;'));
    check('ธีม K2 ใช้เหลืองของจานเป็นสีเน้นรอง', b.includes('--accent-hi:#ffc55c;'));
    // ตัวแปรพื้นผิวทุกตัวต้องถูกกำหนดครบ ไม่งั้นมีพื้นผิวค้างสีของธีมเดิม (บทเรียน [81-5])
    for (const v of ['--bg', '--side', '--bar', '--border', '--fg', '--bright', '--dim',
                     '--hover', '--hover-soft', '--titlebar', '--sunken', '--chip',
                     '--danger-soft', '--canvas', '--sel', '--link', '--curline', '--orange']) {
      check('ธีม K2 กำหนด ' + v + ' ครบ', b.includes(v + ':'));
    }
  }
}

// ── ทั้งสองธีมต้องใช้จานสีเดียวกัน (คนละเฉด) และธีมสว่างต้อง "สว่างจริง" ──
{
  for (const id of ['k2', 'k2-light']) {
    const b = blockOf(id);
    for (const name of ['--k2-navy', '--k2-purple', '--k2-orange', '--k2-yellow']) {
      check('ธีม ' + id + ' ประกาศสีจาน ' + name, b.includes(name + ':'));
    }
  }
  // ความสว่างของ --bg: k2 ต้องเข้ม · k2-light ต้องสว่าง (กันสลับค่ากันเอง)
  const bgOf = (id) => (/--bg:\s*#([0-9a-f]{6})/i.exec(blockOf(id)) || [])[1] || '';
  const lum = (hex) => hex ? (parseInt(hex.slice(0, 2), 16) * .299 + parseInt(hex.slice(2, 4), 16) * .587
                            + parseInt(hex.slice(4, 6), 16) * .114) : -1;
  check('ธีม k2 = เฉดเข้ม', lum(bgOf('k2')) < 90, bgOf('k2'));
  check('ธีม k2-light = เฉดสว่าง', lum(bgOf('k2-light')) > 200, bgOf('k2-light'));
  check('หมึกของสองธีมกลับด้านกันจริง (ไม่ใช่ copy มาแล้วลืมแก้)',
        lum((/--fg:\s*#([0-9a-f]{6})/i.exec(blockOf('k2')) || [])[1] || '') >
        lum((/--fg:\s*#([0-9a-f]{6})/i.exec(blockOf('k2-light')) || [])[1] || ''));
}

// ── ธีมต้องไม่มีปุ่มบนแถบ/คีย์ลัดอีกแล้ว (alpha.138 — ผู้ใช้สั่ง) ──
{
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  check('ไม่มีปุ่มธีม (#tb-theme) ใน index.html แล้ว', !html.includes('id="tb-theme"'));
  check('ไม่มีคีย์ลัดสลับธีมในตารางแล้ว',
        !C.SHORTCUTS.some((x) => x[3] === 'toggle-theme'));
  check('ไม่มีป้ายปุ่มลัดของธีมค้างอยู่', !C.SHORTCUT_LABELS['toggle-theme']);
  const tbcfg = fs.readFileSync(path.join(ROOT, 'src/toolbar/toolbar-config.js'), 'utf8');
  check("ไม่มี 'tb-theme' ในทะเบียนปุ่มแถบเครื่องมือแล้ว", !tbcfg.includes("id: 'tb-theme'"));
}

// ── ช่องเลือกธีมต้องอยู่ในเทมเพลตกล่องตั้งค่า ──
// [alpha.154] โครงกล่องย้ายจากไฟล์ภาษามาอยู่ src/settings-template.js (ภาษาไหนก็โครงเดียวกัน)
{
  const tplSrc = fs.readFileSync(path.join(ROOT, 'src/settings-template.js'), 'utf8');
  check('เทมเพลตกล่องตั้งค่ามีช่องเลือกธีม (#st-theme)', tplSrc.includes('id="st-theme"'));
  for (const [f, tbl] of langs) check(f + ': ไม่มีเทมเพลตก้อนเดิมในไฟล์ภาษาแล้ว', !('ui.dlg.alphaItemLevelUser' in tbl));
}

// ── [alpha.159] ธีมที่สร้างจาก themes.json ──
{
  const G = (() => {
    const o = path.join(os.tmpdir(), '_k2themegen-test.cjs');
    require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/theme-gen.js')], outfile: o,
                                   format: 'cjs', bundle: true, logLevel: 'silent' });
    return require(o);
  })();
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'renderer/themes/themes.json'), 'utf8')).themes;
  check('themes.json ตรงกับ THEMES (ลำดับเดียวกัน)', spec.map((x) => x.id).join(',') === C.THEMES.join(','));
  const varsOf = (id) => Object.fromEntries([...blockOf(id).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  for (const t of spec) {
    check('ธีม ' + t.id + ' mode ตรงกับ THEME_MODES', C.THEME_MODES[t.id] === t.mode);
    const v = varsOf(t.id);
    const missing = G.THEME_VAR_NAMES.filter((n) => !v[n] && !(t.handmade && n === '--find-hit'));
    check('ธีม ' + t.id + ' กำหนดตัวแปรครบทุกตัวใน THEME_VARS', missing.length === 0, missing.join(' '));
    if (t.handmade) continue;
    const probs = G.checkThemeVars(v);
    check('ธีม ' + t.id + ' ผ่านเกณฑ์คอนทราสต์', probs.length === 0, probs.join(' | '));
    const lum = G.mix(v['--bg'], v['--bg'], 0);
    const bright = parseInt(lum.slice(1, 3), 16) * .299 + parseInt(lum.slice(3, 5), 16) * .587 + parseInt(lum.slice(5, 7), 16) * .114;
    check('ธีม ' + t.id + ' พื้นตรงกับ mode (' + t.mode + ')', t.mode === 'dark' ? bright < 110 : bright > 180, v['--bg']);
  }
  // ไฟล์ที่สร้างต้องเป็นปัจจุบัน (ลืม build หลังแก้ themes.json = เทสแดง)
  const r = require('../tools/theme-build.cjs').build(true);
  check('ไฟล์ธีม/ทะเบียนตรงกับ themes.json (รัน node build.js แล้ว)', r.stale.length === 0, r.stale.join(', '));
}

// ── [alpha.159] สูตรคำนวณ ──
{
  const o = path.join(os.tmpdir(), '_k2themegen-test.cjs');
  const G = require(o);
  check('mix 0 = สีเดิม', G.mix('#123456', '#ffffff', 0) === '#123456');
  check('mix 1 = สีปลาย', G.mix('#123456', '#ffffff', 1) === '#ffffff');
  check('ensureContrast ไม่แตะสีที่ผ่านแล้ว', G.ensureContrast('#000000', '#ffffff', 4.5) === '#000000');
  const pushed = G.ensureContrast('#ffff66', '#ffffff', 3);
  check('ensureContrast ดันสีที่อ่านไม่ออกจนผ่าน', pushed !== '#ffff66', pushed);
  const vars = G.themeVars({ mode: 'light', colors: { bg: '#ffffff', fg: '#222222', accent: '#ffff66', accentHi: '#ffee00', link: '#99ccff' } });
  check('themeVars คืนครบทุกตัว', vars.length === G.THEME_VAR_NAMES.length && vars.every(([, x]) => !!x));
  check('themeVars ผ่าน checkThemeVars เสมอ', G.checkThemeVars(vars).length === 0, G.checkThemeVars(vars).join(' | '));
  const ov = Object.fromEntries(G.themeVars({ mode: 'dark', colors: { bg: '#101010', fg: '#eeeeee', accent: '#ff6640', accentHi: '#ffc55c', link: '#88bbff' },
                                              vars: { '--chip': '#abcdef', '--nope': '#000' } }));
  check('vars ทับตัวแปรที่รู้จักได้', ov['--chip'] === '#abcdef');
  check('vars ตัวที่ไม่รู้จักถูกทิ้ง', !('--nope' in ov));
  check('checkThemeVars จับตัวแปรขาด', G.checkThemeVars({ '--bg': '#000000' }).some((x) => x.includes('--fg')));
}

console.log('theme: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
