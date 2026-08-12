// test/margin-presets.test.cjs — unit test ชุดระยะขอบสำเร็จรูป (alpha.60r2 · ข้อ 6)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-mgpreset-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'margin-presets.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

check('มีพรีเซ็ตอย่างน้อย 5 ชุด', S.MARGIN_PRESET_KEYS.length >= 5, S.MARGIN_PRESET_KEYS.length);
for (const k of ['normal', 'narrow', 'wide', 'screenplay', 'a4-narrow']) {
  check('มีพรีเซ็ต ' + k + ' ตามที่ผู้ใช้ระบุ', S.MARGIN_PRESET_KEYS.includes(k));
}

// ทุกพรีเซ็ตต้องมีครบ 4 ด้าน เป็นตัวเลขที่ใช้ได้จริง + มีป้ายชื่อ
for (const k of S.MARGIN_PRESET_KEYS) {
  const p = S.marginPreset(k);
  check(k + ': มีครบ 4 ด้าน เป็นตัวเลข',
    p && ['top', 'bottom', 'left', 'right'].every((d) => Number.isFinite(p[d]) && p[d] >= 0 && p[d] <= 3),
    JSON.stringify(p));
  const lb = S.marginPresetLabel(k);
  check(k + ': มีป้ายชื่อ', typeof lb === 'string' && lb.length > 0 && lb !== k, lb);
}

// ค่าที่ผู้ใช้ระบุมาเป๊ะ ๆ
check('normal = 1 นิ้วรอบด้าน',
  JSON.stringify(S.marginPreset('normal')) === JSON.stringify({ top: 1, bottom: 1, left: 1, right: 1 }));
check('narrow = 0.5 นิ้วรอบด้าน',
  JSON.stringify(S.marginPreset('narrow')) === JSON.stringify({ top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }));
check('screenplay = มาตรฐาน Final Draft (T1 B1 L1.5 R1)',
  JSON.stringify(S.marginPreset('screenplay')) === JSON.stringify({ top: 1, bottom: 1, left: 1.5, right: 1 }));
check('a4-narrow = 0.79 นิ้ว (2 ซม.)', S.marginPreset('a4-narrow').left === 0.79);

check('พรีเซ็ตที่ไม่รู้จัก → null', S.marginPreset('zzz') === null && S.marginPreset('') === null);
check('ป้ายของคีย์ที่ไม่รู้จัก → คืนคีย์เดิม', S.marginPresetLabel('zzz') === 'zzz');

// ── marginPresetOptions ──
{
  const opts = S.marginPresetOptions();
  check('options เป็นคู่ [key, label] ครบทุกชุด',
    opts.length === S.MARGIN_PRESET_KEYS.length && opts.every((o) => o.length === 2 && o[0] && o[1]));
  check('options เรียงตามลำดับในไฟล์ json',
    opts[0][0] === S.MARGIN_PRESET_KEYS[0], opts[0] && opts[0][0]);
}

// ── matchMarginPreset: <select> ต้องสะท้อนตัวเลขในช่องจริง ──
check('จับคู่ normal ได้', S.matchMarginPreset({ top: 1, bottom: 1, left: 1, right: 1 }) === 'normal');
check('จับคู่ screenplay ได้',
  S.matchMarginPreset({ top: 1, bottom: 1, left: 1.5, right: 1 }) === 'screenplay');
check('ค่าที่ผู้ใช้ตั้งเอง → ว่าง (Custom)',
  S.matchMarginPreset({ top: 0.9, bottom: 1, left: 1.2, right: 1 }) === '');
check('null/undefined → ว่าง', S.matchMarginPreset(null) === '' && S.matchMarginPreset(undefined) === '');
check('คลาดเคลื่อนจากทศนิยมนิดเดียวยังจับคู่ได้',
  S.matchMarginPreset({ top: 1.0001, bottom: 1, left: 1.5, right: 1 }) === 'screenplay');
check('ต่างกันจริงต้องไม่จับคู่',
  S.matchMarginPreset({ top: 1.05, bottom: 1, left: 1.5, right: 1 }) === '');
check('รับค่าที่เป็นสตริงตัวเลข (มาจาก <input>)',
  S.matchMarginPreset({ top: '1', bottom: '1', left: '1', right: '1' }) === 'normal');

// ทุกพรีเซ็ตต้องจับคู่กลับหาตัวเองได้ (ไม่มีสองชุดค่าซ้ำกันจนสลับกัน)
for (const k of S.MARGIN_PRESET_KEYS) {
  const m = S.matchMarginPreset(S.marginPreset(k));
  check(k + ': จับคู่กลับหาตัวเองได้', m === k, m);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
