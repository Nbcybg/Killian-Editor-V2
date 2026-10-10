// test/a11y.test.cjs — [alpha.169 · a11y] การช่วยการเข้าถึง
//   ตรรกะ (src/a11y/a11y-core.js) · แป้นพิมพ์บนจอของระบบ (a11y-shell.cjs) · ธีมช่วยการมองเห็น · ด่านกวาดซอร์สกันย้อนกลับ
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const build = (entry, name) => {
  const out = path.join(os.tmpdir(), name);
  esbuild.buildSync({ entryPoints: [path.join(ROOT, entry)], outfile: out, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(out);
};
const C = build('src/a11y/a11y-core.js', 'k2-a11y-core-test.cjs');
const G = build('src/theme-gen.js', 'k2-a11y-themegen-test.cjs');
const U = build('src/color-util.js', 'k2-a11y-color-test.cjs');
const SH = require(path.join(ROOT, 'a11y-shell.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const J = JSON.stringify;
const ev = (key, o = {}) => ({ key, code: o.code || '', ctrlKey: !!o.ctrl, altKey: !!o.alt, shiftKey: !!o.shift,
                               metaKey: !!o.meta, isComposing: !!o.composing,
                               getModifierState: (m) => m === 'AltGraph' && !!o.altGr });
const parts = (key, o, opts) => { const r = C.keyEchoParts(ev(key, o), opts); return r ? r.parts.join('+') + '/' + r.kind : null; };

// ───────────── 1) ค่าเริ่มต้น: สองฝั่งต้องตรงกัน ─────────────
{
  const core = R('src/core.js');
  const a = core.indexOf('export const GLOBAL_DEFAULTS = {'), b = core.indexOf('\n};', a);
  const body = core.slice(a, b);
  const proj = core.slice(core.indexOf('export const PROJECT_DEFAULTS = {'), core.indexOf('\n};', core.indexOf('export const PROJECT_DEFAULTS = {')));
  for (const [k, v] of Object.entries(C.A11Y_DEFAULTS)) {
    const lit = typeof v === 'string' ? "'" + v + "'" : String(v);
    check('★ GLOBAL_DEFAULTS มี ' + k + ' ค่าเดียวกับ A11Y_DEFAULTS', new RegExp('\\b' + k + ':\\s*' + lit.replace(/[.#]/g, '\\$&') + '\\b').test(body) || body.includes(k + ': ' + lit), lit);
    check(k + ' เป็นค่าระดับผู้ใช้ (ไม่อยู่ใน PROJECT_DEFAULTS)', !new RegExp('\\b' + k + ':').test(proj));
  }
  check('ค่าเริ่มต้น: ตัวช่วยทุกตัว "ปิด" (ผู้ใช้ทั่วไปไม่เห็นอะไรเปลี่ยน)',
        C.A11Y_DEFAULTS.a11yKeyEcho === false && C.A11Y_DEFAULTS.a11yLineBand === false && C.A11Y_DEFAULTS.typewriterMode === false);
}

// ───────────── 2) ตัวหนีบค่า ─────────────
{
  const d = C.normA11y(null);
  check('normA11y(null) = ค่าเริ่มต้นครบ', !d.keyEcho && d.keyEchoMode === 'all' && d.keyEchoPos === 'center' && d.keyEchoSize === 160
        && d.keyEchoMs === 900 && !d.lineBand && d.lineBandColor === '#ffe066' && d.lineBandOpacity === 0.4 && !d.typewriter, J(d));
  const x = C.normA11y({ a11yKeyEcho: true, a11yKeyEchoMode: 'nope', a11yKeyEchoPos: 'left', a11yKeyEchoSize: 9999,
                         a11yKeyEchoMs: 1, a11yLineBand: 'yes', a11yLineBandColor: 'red; x:1', a11yLineBandOpacity: 7 });
  check('★ ค่าเสียถูกแทนด้วยค่าเริ่มต้น · ตัวเลขถูกหนีบเข้าช่วง',
        x.keyEcho && x.keyEchoMode === 'all' && x.keyEchoPos === 'center' && x.keyEchoSize === C.KEY_ECHO_SIZE.max
        && x.keyEchoMs === C.KEY_ECHO_MS.min && x.lineBand === false && x.lineBandColor === '#ffe066'
        && x.lineBandOpacity === C.LINE_BAND_OPACITY.max, J(x));
  check('สวิตช์รับเฉพาะ true จริง (สตริง "true" ไม่นับ)', C.normA11y({ a11yKeyEcho: 'true', typewriterMode: 1 }).keyEcho === false
        && C.normA11y({ typewriterMode: 1 }).typewriter === false);
  check('สีแบบย่อ #fc0 ถูกขยาย', C.normA11y({ a11yLineBandColor: '#fc0' }).lineBandColor === '#ffcc00');
  check('ค่าจากช่องกรอก (สตริง) ใช้ได้', C.normA11y({ a11yKeyEchoSize: '200', a11yKeyEchoMs: '1500', a11yLineBandOpacity: '0.25' }).keyEchoSize === 200
        && C.normA11y({ a11yKeyEchoMs: '1500' }).keyEchoMs === 1500 && C.normA11y({ a11yLineBandOpacity: '0.25' }).lineBandOpacity === 0.25);
}

// ───────────── 2b) เปิดผลงาน: ค่าช่วยการเข้าถึงของ "คน" ชนะสำเนาในไฟล์ผลงาน ─────────────
{
  // ผลงาน ก เคยบันทึกตอนสวิตช์ปิด (saveProjectMeta เขียน settings ทั้งก้อน) · ผู้ใช้เปิดสวิตช์ในผลงาน ข → กลับมาเปิด ก
  const proj = { a11yKeyEcho: false, a11yLineBand: false, typewriterMode: false, a11yKeyEchoSize: 100, edFontPt: 14, theme: 'k2' };
  const user = { a11yKeyEcho: true, a11yLineBand: true, typewriterMode: true, theme: 'hc-dark' };
  const merged = C.userA11yWins({ ...C.A11Y_DEFAULTS, ...user, ...proj }, user);
  check('★★ เปิดผลงานที่เคยบันทึกตอนสวิตช์ปิด: ค่าจากไฟล์ผู้ใช้ชนะ (ไม่ต้องเปิดตัวช่วยใหม่ทุกผลงาน)',
        merged.a11yKeyEcho === true && merged.a11yLineBand === true && merged.typewriterMode === true, J(merged));
  check('คีย์ที่ไฟล์ผู้ใช้ยังไม่มี = คงค่าที่รวมมาแล้ว (ของไฟล์ผลงานรุ่นก่อน)', merged.a11yKeyEchoSize === 100);
  check('ไม่แตะคีย์อื่น (ค่าของผลงานยังเป็นของผลงาน)', merged.edFontPt === 14);
  check('★★ ธีม (คอนทราสต์สูง/ตาบอดสี) ตามผู้ใช้ไปด้วย — ไม่กลับเป็นธีมที่ผลงานเก่าจำไว้', merged.theme === 'hc-dark');
  check('ค่าของเสียงพิมพ์ดีด (อยู่หน้าเดียวกัน) ตามผู้ใช้ด้วย', C.userA11yWins({ typeSound: false, typeSoundVolume: 0.5 }, { typeSound: true, typeSoundVolume: 0.9 }).typeSoundVolume === 0.9
        && C.A11Y_USER_KEYS.includes('typeSound') && C.A11Y_USER_KEYS.includes('typeSoundMode'));
  {
    // ทุกคีย์ในรายการต้องเป็นค่าระดับผู้ใช้จริง และทุกทางเขียนของมันต้องเขียนไฟล์ผู้ใช้ (ไม่งั้นค่าเก่าดึงกลับตอนเปิดผลงาน)
    const coreSrc = R('src/core.js');
    const gAt = coreSrc.indexOf('export const GLOBAL_DEFAULTS = {');
    const gBody = coreSrc.slice(gAt, coreSrc.indexOf('\n};', gAt));
    const notGlobal = C.A11Y_USER_KEYS.filter((k) => !new RegExp('\\b' + k + ':').test(gBody));
    check('★ ทุกคีย์ที่ไฟล์ผู้ใช้ชนะ อยู่ใน GLOBAL_DEFAULTS', notGlobal.length === 0, notGlobal.join(','));
    const appSrc = R('src/app.js');
    for (const k of ['theme', 'typeSound', 'typewriterMode']) check('ทางเขียนของ ' + k + ' ในเมนู/คำสั่ง เขียนไฟล์ผู้ใช้', new RegExp("saveGlobalSetting\\('" + k + "'").test(appSrc));
  }
  check('ไฟล์ผู้ใช้ว่าง/ไม่มี = ไม่เปลี่ยนอะไร', J(C.userA11yWins({ a11yKeyEcho: true }, null)) === J({ a11yKeyEcho: true })
        && J(C.userA11yWins({ a11yKeyEcho: true }, {})) === J({ a11yKeyEcho: true }));
  check('ค่า false ในไฟล์ผู้ใช้ก็ชนะ (ปิดจากผลงานอื่นแล้วต้องปิดจริง)', C.userA11yWins({ a11yKeyEcho: true }, { a11yKeyEcho: false }).a11yKeyEcho === false);
  check('★ loadSettings ใช้ตัวรวมนี้', /state\.settings = userA11yWins\(\{ \.\.\.DEFAULT_SETTINGS, \.\.\.globalSettings, \.\.\.\(meta\.settings \|\| \{\}\) \}, globalSettings\);/.test(R('src/app.js')));
  check('★ ตัวช่วยทำงานตั้งแต่หน้าแรก (บูตเรียก applyA11y ก่อนมีโปรเจกต์)', /try \{ applyA11y\(\); \} catch \(e\) \{ log\('warn', 'boot a11y', e\); \}/.test(R('src/app.js')));
}

// ───────────── 3) ปุ่มที่กด → ข้อความบนป้าย ─────────────
{
  check('★ ตัวอักษรไทยโชว์ตามที่พิมพ์ออกมาจริง', parts('ก') === 'ก/char' && parts('ฏ', { shift: true }) === 'ฏ/char');
  check('★ สระบน/วรรณยุกต์กดเดี่ยว ๆ วางบนวงกลมประ (ไม่ลอยอยู่บนที่ว่าง)', parts('่') === '◌่/char' && parts('ิ') === '◌ิ/char'
        && parts('ุ') === '◌ุ/char' && parts('า') === 'า/char' && parts('ๆ') === 'ๆ/char', parts('่'));
  check('ตัวอักษรอังกฤษ: Shift รวมอยู่ในผลแล้ว ไม่บอกซ้ำ', parts('a') === 'a/char' && parts('A', { shift: true }) === 'A/char');
  check('สัญลักษณ์/ตัวเลข', parts('?', { shift: true }) === '?/char' && parts('7') === '7/char');
  check('★ ปุ่มที่มีชื่อ', parts('Enter') === 'Enter/key' && parts('Backspace') === 'Backspace/key' && parts('Escape') === 'Esc/key'
        && parts('Tab') === 'Tab/key' && parts('PageDown') === 'Page Down/key' && parts('F5') === 'F5/key', parts('Escape'));
  check('ลูกศร', parts('ArrowUp') === '↑/key' && parts('ArrowLeft') === '←/key');
  check('เว้นวรรค = Space (ตัวอักษรเปล่ามองไม่เห็น)', parts(' ') === 'Space/key' && parts('Spacebar') === 'Space/key');
  check('Shift + ปุ่มที่มีชื่อ บอก Shift ด้วย', parts('Tab', { shift: true }) === 'Shift+Tab/combo' && parts(' ', { shift: true }) === 'Shift+Space/combo');
  check('★ คีย์ลัดบนแป้นไทย: โชว์ตำแหน่งปุ่ม (Ctrl+ห → Ctrl + S) ตรงกับที่เมนูเขียน',
        parts('ห', { ctrl: true, code: 'KeyS' }) === 'Ctrl+S/combo', parts('ห', { ctrl: true, code: 'KeyS' }));
  check('คีย์ลัดหลายปุ่มปรับแต่ง เรียง Ctrl · Alt · Shift', parts('S', { ctrl: true, alt: true, shift: true, code: 'KeyS' }) === 'Ctrl+Alt+Shift+S/combo');
  check('คีย์ลัดกับปุ่มที่มีชื่อ/เครื่องหมาย', parts('Enter', { ctrl: true }) === 'Ctrl+Enter/combo'
        && parts(',', { ctrl: true, code: 'Comma' }) === 'Ctrl+,/combo' && parts(' ', { ctrl: true, code: 'Space' }) === 'Ctrl+Space/combo');
  check('ไม่มี code → ใช้ตัวอักษรตัวใหญ่', parts('s', { ctrl: true }) === 'Ctrl+S/combo');
  check('ปุ่มปรับแต่งล้วน ๆ', parts('Shift') === 'Shift/mod' && parts('Control') === 'Ctrl/mod' && parts('Alt') === 'Alt/mod' && parts('Meta') === 'Win/mod');
  check('macOS ใช้ชื่อบนแป้นของ Mac', parts('Meta', {}, { mac: true }) === 'Cmd/mod' && parts('Alt', {}, { mac: true }) === 'Option/mod'
        && parts('s', { meta: true, code: 'KeyS' }, { mac: true }) === 'Cmd+S/combo');
  check('★ AltGr (Ctrl+Alt ของ Windows) = การพิมพ์ตัวอักษร ไม่ใช่คีย์ลัด', parts('€', { ctrl: true, alt: true, altGr: true }) === '€/char');
  check('★ กำลังประกอบอักษร (IME) · ปุ่มตาย · ไม่รู้ปุ่ม = ไม่โชว์', parts('Process') === null && parts('Dead') === null
        && parts('Unidentified') === null && parts('a', { composing: true }) === null && C.keyEchoParts(null) === null && parts('') === null);
  check('โหมด typing: เฉพาะตัวอักษรที่พิมพ์', parts('ก', {}, { mode: 'typing' }) === 'ก/char' && parts('Enter', {}, { mode: 'typing' }) === null
        && parts('s', { ctrl: true }, { mode: 'typing' }) === null && parts('Shift', {}, { mode: 'typing' }) === null);
  check('โหมด special: เฉพาะปุ่มพิเศษ/คีย์ลัด', parts('ก', {}, { mode: 'special' }) === null && parts('Enter', {}, { mode: 'special' }) === 'Enter/key'
        && parts('s', { ctrl: true, code: 'KeyS' }, { mode: 'special' }) === 'Ctrl+S/combo');
  check('โหมดที่ไม่รู้จัก = all', parts('ก', {}, { mode: 'zzz' }) === 'ก/char' && parts('Enter', {}, { mode: 'zzz' }) === 'Enter/key');
  check('codeLabel: ตัวอักษร · ตัวเลข · แป้นตัวเลข · F', C.codeLabel('KeyQ') === 'Q' && C.codeLabel('Digit4') === '4'
        && C.codeLabel('Numpad7') === '7' && C.codeLabel('F12') === 'F12' && C.codeLabel('BracketLeft') === '[' && C.codeLabel('') === '');
  check('★ ช่องรหัสผ่าน/ช่องลับไม่ถูกโชว์', C.isSecretField({ type: 'password' }) && C.isSecretField({ type: 'PASSWORD' })
        && C.isSecretField({ type: 'text', dataset: { secret: '1' } }) && !C.isSecretField({ type: 'text' })
        && !C.isSecretField(null) && !C.isSecretField({ dataset: {} }));
}

// ───────────── 3b) ป้ายไม่ล้นหน้าต่าง ─────────────
{
  check('จอปกติ + ตัวอักษรเดียว = ขนาดที่ตั้งไว้เป๊ะ', C.fitKeyEchoSize(160, 1, 1400, 900) === 160 && C.fitKeyEchoSize(200, 1, 1920, 1080) === 200);
  const big = C.fitKeyEchoSize(400, 9, 1024, 700);          // "Backspace" ที่ 400px บนจอเล็ก
  check('★ ชื่อปุ่มยาว + ขนาดใหญ่สุด บนหน้าต่างเล็ก = ย่อให้พอดีกว้าง', big < 400 && big * (9 * 0.62 + 0.8) <= 1024 * 0.86 + 1, big);
  check('★ หน้าต่างเตี้ย = ย่อให้พอดีสูง', C.fitKeyEchoSize(400, 1, 2000, 400) * 1.75 <= 400 * 0.7 + 1, C.fitKeyEchoSize(400, 1, 2000, 400));
  check('ไม่เล็กกว่า 16px · ค่าเสียใช้ค่าเริ่มต้น', C.fitKeyEchoSize(400, 40, 100, 100) === 16 && C.fitKeyEchoSize(NaN, 1, 1400, 900) === 160
        && C.fitKeyEchoSize(160, 1) === 160);
}

// ───────────── 4) แถบสีบรรทัดเคอร์เซอร์ ─────────────
{
  const g = { caret: { top: 300, bottom: 324 }, paper: { left: 220, width: 816 }, host: { left: 200, top: 100 }, scrollLeft: 0, scrollTop: 1000, pad: 2 };
  const b = C.bandBox(g);
  check('★ กล่องอยู่ในพิกัดของกล่องที่เลื่อน (รวมระยะที่เลื่อนไป)', b && b.top === 300 - 100 + 1000 - 2 && b.left === 20 && b.width === 816 && b.height === 28, J(b));
  check('เลื่อนแนวนอนถูกบวกเข้า', C.bandBox({ ...g, scrollLeft: 50 }).left === 70);
  check('ไม่ส่ง pad = เผื่อเองตามความสูงบรรทัด (อย่างน้อย 1px)', C.bandBox({ ...g, pad: undefined }).height === 24 + 2 * 2);
  check('★ ตัวแก้ไขถูกซ่อน (สูง/กว้าง 0) = ไม่วาด', C.bandBox({ ...g, caret: { top: 0, bottom: 0 } }) === null
        && C.bandBox({ ...g, paper: { left: 0, width: 0 } }) === null);
  check('ค่าเสีย = ไม่วาด', C.bandBox(null) === null && C.bandBox({ caret: {}, paper: {}, host: {} }) === null
        && C.bandBox({ ...g, caret: { top: NaN, bottom: 10 } }) === null);
  check('★ ตัวหนังสือเข้ม (พื้นสว่าง) = multiply · ตัวหนังสือสว่าง (พื้นมืด) = screen — ตัดสินจากสีที่จอใช้จริง',
        C.bandBlend('rgb(26, 26, 26)') === 'multiply' && C.bandBlend('#1a1a1a') === 'multiply'
        && C.bandBlend('rgb(236, 232, 247)') === 'screen' && C.bandBlend('rgba(255, 255, 255, 0.9)') === 'screen'
        && C.bandBlend('') === 'multiply' && C.bandBlend('zz') === 'multiply');
  check('cssColorHex: rgb()/rgba()/hex', C.cssColorHex('rgb(236, 232, 247)') === '#ece8f7' && C.cssColorHex('rgb(0 0 0 / 50%)') === '#000000'
        && C.cssColorHex('#fc0') === '#ffcc00' && C.cssColorHex('transparent') === '');
  check('★ แถบบรรทัดไม่อ่านตัวแปร --paper (มุมมองปกติไม่วาดกระดาษ — พื้นเป็นของธีม)', !/--paper/.test(require('../tools/js-lex.cjs').stripComments(R('src/a11y/line-band.js'))));
}

// ───────────── 5) แป้นพิมพ์บนจอของระบบ ─────────────
(async () => {
  const w = SH.oskPlan('win32', { SystemRoot: 'D:\\Win' });
  check('★ Windows: เปิด osk.exe ผ่านเชลล์ (ไม่ spawn — osk ประกาศ uiAccess สร้างโปรเซสตรง ๆ ไม่ได้)',
        w[0].kind === 'open' && w[0].target === 'D:\\Win\\System32\\osk.exe' && !w.some((p) => p.kind === 'spawn'), J(w));
  check('Windows: ไม่มี SystemRoot → C:\\Windows', SH.oskPlan('win32', {})[0].target === 'C:\\Windows\\System32\\osk.exe');
  check('Windows: ทางสุดท้าย = หน้าตั้งค่าของระบบ', w[w.length - 1].kind === 'url' && w[w.length - 1].settings === true && /^ms-settings:/.test(w[w.length - 1].target));
  const m = SH.oskPlan('darwin', {});
  check('macOS: ลองตัวแสดงแป้นก่อน แล้วพาไปหน้าตั้งค่า', m[0].kind === 'spawn' && m[0].target === '/usr/bin/open'
        && m[m.length - 1].kind === 'url' && /^x-apple\.systempreferences:/.test(m[m.length - 1].target), J(m));
  const l = SH.oskPlan('linux', {});
  check('Linux: ลองหลายตัวตามลำดับ (onboard ก่อน)', l.length >= 3 && l[0].target === 'onboard' && l.every((p) => p.kind === 'spawn'));
  check('★ ทุกแผน: คำสั่ง/อาร์กิวเมนต์ตายตัว ไม่มีช่องให้ข้อมูลภายนอกแทรก',
        [w, m, l].every((pl) => pl.every((p) => typeof p.target === 'string' && p.target && (!p.args || p.args.every((a) => typeof a === 'string')))));
  const calls = [];
  const r1 = await SH.runOskPlan(l, { spawn: (st) => { calls.push(st.target); return st.target === 'florence'; } });
  check('★ เดินตามแผนจนกว่าจะสำเร็จ แล้วหยุด', r1.ok && r1.step.target === 'florence' && J(calls) === J(['onboard', 'florence']) && r1.tried === 2, J(calls));
  const r2 = await SH.runOskPlan(w, { open: () => false, url: async () => true });
  check('★ เปิดตรง ๆ ไม่ได้ → หน้าตั้งค่า + บอกผู้เรียกว่าเป็นทางสำรอง', r2.ok && r2.settings === true && r2.tried === 2);
  const r3 = await SH.runOskPlan(l, { spawn: () => { throw new Error('ENOENT'); } });
  check('ทุกขั้นล้ม/โยน error = ไม่สำเร็จ ไม่โยนต่อ', r3.ok === false && r3.tried === l.length);
  check('แผนว่าง/ไม่มีตัวลงมือ = ไม่สำเร็จ', (await SH.runOskPlan(null, {})).ok === false && (await SH.runOskPlan(w, {})).tried === 0);

  // ───────────── 6) ธีมช่วยการมองเห็น ─────────────
  {
    const spec = JSON.parse(R('renderer/themes/themes.json')).themes;
    const a11y = spec.filter((t) => t.group === 'a11y');
    const ids = a11y.map((t) => t.id);
    check('★ มีธีมช่วยการมองเห็นครบ: คอนทราสต์สูง 2 · ตาบอดสี 4 · ขาวดำ 2',
          J(ids) === J(['hc-dark', 'hc-light', 'cvd-rg-dark', 'cvd-rg-light', 'cvd-by-dark', 'cvd-by-light', 'mono-dark', 'mono-light']), J(ids));
    check('k2 · k2-light ยังอยู่หัวทะเบียน', spec[0].id === 'k2' && spec[1].id === 'k2-light');
    check('★ ทะเบียนที่สร้าง (THEMES_A11Y) ตรงกับ themes.json', R('src/generated/themes-data.js').includes('export const THEMES_A11Y = ' + J(ids) + ';'));
    const vars = (t) => Object.fromEntries(G.themeVars(t));
    for (const id of ['hc-dark', 'hc-light']) {
      const v = vars(a11y.find((t) => t.id === id));
      const c = U.contrast(v['--fg'], v['--bg']);
      check('★ ' + id + ': ตัวหนังสือ/พื้น คอนทราสต์สูงสุด (21:1)', c >= 20.9, c.toFixed(2));
      check(id + ': ตัวหนังสือรองยังเกิน 7:1 (AAA)', U.contrast(v['--dim'], v['--bg']) >= 7, U.contrast(v['--dim'], v['--bg']).toFixed(2));
      check(id + ': เส้นขอบเห็นชัด (≥ 7:1 กับพื้น)', U.contrast(v['--border'], v['--bg']) >= 7);
      check(id + ': สีเน้น/ลิงก์ ≥ 7:1', U.contrast(v['--accent'], v['--bg']) >= 7 && U.contrast(v['--link'], v['--bg']) >= 7,
            U.contrast(v['--accent'], v['--bg']).toFixed(2) + ' / ' + U.contrast(v['--link'], v['--bg']).toFixed(2));
    }
    for (const t of a11y) {
      check(t.id + ': ผ่านด่านคอนทราสต์ของธีมทั่วไป', G.checkThemeVars(G.themeVars(t)).length === 0, G.checkThemeVars(G.themeVars(t)).join(' | '));
      const st = Object.fromEntries(G.themeStatusVars(t));
      check('★ ' + t.id + ': ทับสีเตือน/อันตราย (ค่ากลางเป็นเหลืองอมส้มกับแดง — แยกยากสำหรับคนตาบอดสี)',
            !!st['--st-warn'] && !!st['--st-danger'] && !!st['--st-danger-alt'], J(st));
      const bg = vars(t)['--bg'];
      check(t.id + ': สีเตือน/อันตรายอ่านออกบนพื้น (≥ 4.5:1)', U.contrast(st['--st-warn'], bg) >= 4.5 && U.contrast(st['--st-danger'], bg) >= 4.5,
            U.contrast(st['--st-warn'], bg).toFixed(2) + ' / ' + U.contrast(st['--st-danger'], bg).toFixed(2));
      const css = R('renderer/themes/' + t.id + '.css');
      check(t.id + '.css มีสีความหมายที่ทับ', css.includes('--st-danger:' + st['--st-danger'] + ';') && css.includes('body.theme-' + t.id + ' {'));
    }
    // ตาบอดสีแดง–เขียว: สีเน้นสองสีต้องต่างกันที่ "ความสว่าง + แกนน้ำเงิน–เหลือง" (แกนที่ยังเห็น) ไม่ใช่แกนแดง–เขียว
    const by = (hex) => { const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return { rg: r - g, b: b - (r + g) / 2 }; };
    for (const id of ['cvd-rg-dark', 'cvd-rg-light']) {
      const t = a11y.find((x) => x.id === id);
      const A = by(t.colors.accent), H = by(t.colors.accentHi);
      check('★ ' + id + ': สีเน้นสองสีต่างกันบนแกนน้ำเงิน–เหลือง (ฟ้า ↔ ส้ม)', Math.abs(A.b - H.b) >= 150, Math.round(A.b) + ' / ' + Math.round(H.b));
    }
    for (const id of ['mono-dark', 'mono-light']) {
      const t = a11y.find((x) => x.id === id);
      const gray = Object.values(t.colors).concat(Object.values(t.status)).every((h) => /^#([0-9a-f]{2})\1\1$/i.test(h));
      check('★ ' + id + ': ทุกสีเป็นเทาล้วน (ไม่พึ่งสีแยกความหมาย)', gray, J(t.colors));
    }
    check('ธีมที่ไม่รู้จักกลุ่มถูกปฏิเสธตอนสร้าง', /group != null && t\.group !== 'a11y'/.test(R('tools/theme-build.cjs')));
    check('สีความหมายที่ไม่ใช่ #rrggbb ถูกทิ้ง', G.themeStatusVars({ status: { warn: 'red;x', danger: '#abc' } }).length === 1
          && G.themeStatusVars({ status: { danger: '#abc' } })[0][1] === '#aabbcc' && G.themeStatusVars({}).length === 0);
  }

  // ───────────── 7) ด่านกวาดซอร์ส (กันย้อนกลับ) ─────────────
  {
    const css = R('renderer/style.css');
    const rule = (sel) => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
    const ke = rule('.k-key-echo');
    check('★ ป้ายปุ่ม: ชั้นบนสุดของหน้าต่าง (z-index สูงสุด) · ไม่รับคลิก', /z-index:2147483647/.test(ke) && /pointer-events:none/.test(ke) && /position:fixed/.test(ke), ke.slice(0, 120));
    const zs = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => +m[1]);
    check('ไม่มีอะไรใน style.css อยู่เหนือป้ายปุ่ม', Math.max(...zs) === 2147483647 && zs.filter((z) => z === 2147483647).length === 1);
    const lb = rule('.k-line-band');
    check('★ แถบบรรทัด: แผ่นทับ absolute · ไม่รับคลิก', /position:absolute/.test(lb) && /pointer-events:none/.test(lb));
    check('★ ไม่ติดไปกับงานพิมพ์', /@media print \{ \.k-key-echo, \.k-line-band \{ display:none !important; \} \}/.test(css));
    check('เคารพ "ลดการเคลื่อนไหว" ของระบบ', /prefers-reduced-motion:reduce\) \{ \.k-key-echo/.test(css));

    const kjs = R('src/a11y/key-echo.js'), ljs = R('src/a11y/line-band.js');
    const code = (s) => require('../tools/js-lex.cjs').stripComments(s);
    check('★ ตัวแสดงปุ่ม "ดู" อย่างเดียว — ไม่กินปุ่ม ไม่หยุดเหตุการณ์', !/preventDefault|stopPropagation|stopImmediatePropagation/.test(code(kjs)));
    check('ตัวแสดงปุ่มฟังที่ window ระยะ capture (เห็นทุกปุ่มแม้อยู่ในกล่อง/เมนู)', /window\.addEventListener\('keydown', onKey, true\)/.test(kjs));
    check('★ ตัวแสดงปุ่มเช็คช่องลับก่อนโชว์', /isSecretField\(ev\.target\)/.test(kjs));
    check('ป้ายเขียนด้วย textContent (el) ไม่ใช่ innerHTML', !/innerHTML/.test(code(kjs)) && !/innerHTML/.test(code(ljs)));
    check('★ แถบบรรทัดไม่แตะคลาส/สไตล์ของ DOM ตัวแก้ไข (ของ ProseMirror — กฎข้อ 31)', !/view\.dom\.(classList|style)/.test(code(ljs)));
    check('แถบบรรทัดซ่อนในโหมดอ่าน', /reading-mode/.test(ljs));

    const main = R('main.js');
    const tools = main.slice(main.indexOf("{ id: 'Tools'"), main.indexOf("{ id: 'View'"));
    for (const c of ['key-echo', 'line-band', 'type-sound', 'osk', 'a11y-settings']) {
      check('เมนู เครื่องมือ → การช่วยการเข้าถึง มี ' + c, new RegExp("cmd\\('" + c + "'\\)").test(tools));
    }
    check('★ ช่อง IPC ของแป้นพิมพ์บนจอไม่รับอาร์กิวเมนต์จาก renderer', /H\('a11y:osk', async \(\) => \{/.test(main));
    check('★ โหมดเทสไม่เปิดแป้นพิมพ์จริงบนเครื่องที่รันเทส', /H\('a11y:osk'[\s\S]{0,200}if \(TEST\) return \{ ok: true, dry: true/.test(main));
    check('preload เปิดช่อง openOsk', /openOsk: call\('a11y:osk'\)/.test(R('preload.js')));
    check('★ a11y-shell.cjs อยู่ในรายการไฟล์ของตัวแพ็ก', JSON.parse(R('package.json')).build.files.includes('a11y-shell.cjs'));
    check('ตัวเลขเวลารอของแป้นพิมพ์บนจออยู่ timing.js', /export const OSK_SPAWN_WAIT_MS = \d+;/.test(R('src/timing.js')) && /TIMING\.OSK_SPAWN_WAIT_MS/.test(main));

    const app = R('src/app.js');
    for (const k of ['typeSound', 'typewriterMode']) {
      check('★ สวิตช์ ' + k + ' บันทึกเป็นค่าระดับผู้ใช้ (กฎ W3)', new RegExp("saveGlobalSetting\\('" + k + "'").test(app));
    }
    check('★ สวิตช์ a11y ผ่านทางกลางตัวเดียว (setA11ySwitch → saveGlobalSetting)', /export function setA11ySwitch\(key, on\)[\s\S]{0,260}saveGlobalSetting\(key, v\)/.test(app)
          && /case 'key-echo': \{\s*const v = setA11ySwitch\('a11yKeyEcho'\)/.test(app) && /case 'line-band': \{\s*const v = setA11ySwitch\('a11yLineBand'\)/.test(app));
    check('applySettings เรียก applyA11y', /\n  applyA11y\(\);/.test(app));

    // หน้าในกล่องตั้งค่า
    const T = build('src/settings-template.js', 'k2-a11y-tpl-test.cjs').settingsTemplate();
    const page = (id) => { const m = new RegExp('<div class="k-set-page[^"]*" data-p="' + id + '">([\\s\\S]*?)(?=\\n    <div class="k-set-page|\\n  <\\/div>)').exec(T); return m ? m[1] : ''; };
    const a = page('a11y'), wr = page('write');
    check('★ มีหน้า "การช่วยการเข้าถึง" + หัวข้อในรายการ', !!a && /class="k-set-tab" data-p="a11y"/.test(T));
    check('★ หน้านี้เป็นค่าระดับผู้ใช้', /data-scope="global"/.test(a));
    const IDS = ['st-a11y-themes', 'st-a11y-keyecho', 'st-a11y-keyecho-mode', 'st-a11y-keyecho-pos', 'st-a11y-keyecho-size', 'st-a11y-keyecho-ms',
                 'st-a11y-keyecho-test', 'st-a11y-band', 'st-a11y-band-color', 'st-a11y-band-op', 'st-typewriter',
                 'st-typesnd', 'st-typesnd-mode', 'st-typesnd-vol', 'st-typesnd-test', 'st-a11y-osk'];
    const miss = IDS.filter((id) => !a.includes('id="' + id + '"'));
    check('★ หน้านี้มีครบ: ธีม · แสดงปุ่ม · แถบบรรทัด · พิมพ์ดีด · เสียง · แป้นพิมพ์บนจอ', miss.length === 0, miss.join(' · '));
    check('★ เสียงพิมพ์ดีดย้ายออกจากหน้า "การเขียน" แล้ว (ช่องเดียว ไม่ซ้ำสองหน้า)', !wr.includes('st-typesnd') && (T.match(/id="st-typesnd"/g) || []).length === 1);
    const dlg = R('src/dialogs.js');
    check('ธีมช่วยการมองเห็นเป็นปุ่มที่ตั้งช่องธีมเดิม (ไม่มีช่องธีมที่สอง)', (T.match(/<select id="st-[\w-]*theme/g) || []).length === 1
          && /sel\.value = id; previewTheme\(id\)/.test(dlg));
    check('★ ค่าของหน้านี้ผูกตอนกดบันทึก (Object.assign(s, readA11y()) อยู่ในทางบันทึกที่เดียว)', (dlg.match(/Object\.assign\(s, readA11y\(\)\)/g) || []).length === 1);
    // คำสั่งใหม่มีไอคอน + คำอธิบาย
    const cmds = R('icons/commands.csv');
    for (const c of ['key-echo,keyboard,', 'line-band,highlight,', 'osk,keyboard,', 'a11y-settings,cog,']) check('ทะเบียนคำสั่งมี ' + c, cmds.includes('\n' + c));
  }

  console.log(`\na11y: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
