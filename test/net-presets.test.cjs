// test/net-presets.test.cjs — [alpha.80] ชุดสีสำเร็จรูปของ Story Network
//
// ประตูกันพลาดสำคัญ: **คีย์ในชุดสีต้องมีอยู่จริงใน NET_COLOR_DEFS**
// ถ้าพิมพ์ผิดแม้ตัวเดียว ชุดนั้นจะ "เลือกได้แต่ไม่มีอะไรเปลี่ยน" ซึ่งหาสาเหตุยากมาก
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const { lexCsv } = require('../tools/csv-lite.cjs');
const esbuild = require('esbuild');
const tmp = require('os').tmpdir();
const o1 = path.join(tmp, '_netpreset.cjs'), o2 = path.join(tmp, '_nettheme.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/net-presets.js')],
  outfile: o1, format: 'cjs', bundle: true, logLevel: 'silent' });
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/network-theme.js')],
  outfile: o2, format: 'cjs', bundle: true, logLevel: 'silent' });
const P = require(o1), N = require(o2);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ ชุดในตัว ═══════════
{
  const ids = P.BUILTIN_PRESETS.map((p) => p.id);
  check('มีชุดในตัวครบ 5 ชุดตามที่ผู้ใช้สั่ง',
        ['default', 'cable', 'flower', 'xrite', 'rainbow'].every((x) => ids.includes(x)),
        ids.join(','));
  check('ทุกชุดติดธง builtIn', P.BUILTIN_PRESETS.every((p) => p.builtIn === true));

  // **หัวใจ**: คีย์ทุกตัวต้องมีอยู่จริงในนิยามสีของผัง
  const real = new Set(N.NET_COLOR_DEFS.map((d) => d.key));
  const ghost = P.PRESET_KEYS.filter((k) => !real.has(k));
  check('คีย์ในชุดสีมีอยู่จริงใน NET_COLOR_DEFS ทุกตัว', ghost.length === 0, ghost.join(' '));

  for (const p of P.BUILTIN_PRESETS) {
    const keys = Object.keys(p.colors);
    check(`ชุด ${p.id}: กำหนดสีครบทุกคีย์`, keys.length === P.PRESET_KEYS.length,
          keys.length + '/' + P.PRESET_KEYS.length);
    check(`ชุด ${p.id}: ทุกค่าเป็นสี hex 6 หลัก`,
          keys.every((k) => /^#[0-9a-f]{6}$/.test(p.colors[k])),
          keys.filter((k) => !/^#[0-9a-f]{6}$/.test(p.colors[k])).join(' '));
  }
  // ชุด default ต้องตรงกับค่าเริ่มต้นจริงของโปรแกรม ไม่งั้น "คืนค่าเดิม" จะไม่เดิม
  const off = P.PRESET_KEYS.filter((k) => {
    const d = N.NET_COLOR_DEFS.find((x) => x.key === k);
    return d && d.def && d.def.toLowerCase() !== P.builtinPreset('default').colors[k];
  });
  check('ชุด default ตรงกับค่าเริ่มต้นของโปรแกรมเป๊ะ', off.length === 0, off.join(' '));

  // ชื่อชุดในตัวต้องมีคำแปลครบทุกภาษา (ไม่งั้นโชว์ตัวคีย์)
  const langDir = path.join(__dirname, '..', 'languages');
  for (const f of fs.readdirSync(langDir).filter((x) => /^k2_.+\.csv$/.test(x))) {
    const tbl = lexCsv(fs.readFileSync(path.join(langDir, f), 'utf8'));
    const miss = P.BUILTIN_PRESETS.map((p) => 'ui.netPreset.' + p.id).filter((k) => !tbl[k]);
    check(`${f}: ชื่อชุดสีมีคำแปลครบ`, miss.length === 0, miss.join(' '));
  }
  check('presetLabel ของชุดในตัวไม่คืนตัวคีย์',
        P.BUILTIN_PRESETS.every((p) => !/^ui\./.test(P.presetLabel(p))),
        P.BUILTIN_PRESETS.map((p) => P.presetLabel(p)).join(','));
  check('presetLabel ของชุดผู้ใช้ = ชื่อที่ตั้ง',
        P.presetLabel({ id: 'x', name: 'ชุดของฉัน' }) === 'ชุดของฉัน');
  check('presetLabel รับ null ได้', P.presetLabel(null) === '');
}

// ═══════════ ชุดของผู้ใช้ ═══════════
{
  check('ยังไม่มีชุดของตัวเอง = มีแต่ชุดในตัว',
        P.allPresets(null).length === P.BUILTIN_PRESETS.length);

  let saved = P.addPreset(null, 'ชุดของฉัน', { 'nc-char': '#123456', 'ไม่รู้จัก': '#000000' });
  check('เพิ่มชุดได้', saved.length === 1 && saved[0].name === 'ชุดของฉัน', JSON.stringify(saved));
  check('เก็บเฉพาะคีย์ที่รู้จัก',
        saved[0].colors['nc-char'] === '#123456' && !saved[0].colors['ไม่รู้จัก']);
  check('ชุดผู้ใช้ไม่ติดธง builtIn', saved[0].builtIn === false);
  check('รวมกับชุดในตัวแล้วได้ครบ', P.allPresets(saved).length === P.BUILTIN_PRESETS.length + 1);

  saved = P.addPreset(saved, 'ชุดของฉัน', {});
  check('ชื่อซ้ำ → id ไม่ชนกัน', saved[0].id !== saved[1].id, JSON.stringify(saved.map((x) => x.id)));

  check('ลบชุดของตัวเองได้', P.removePreset(saved, saved[0].id).length === 1);
  check('ชุดในตัวลบไม่ได้', P.canRemove('default') === false && P.canRemove('cable') === false);
  check('ชุดของผู้ใช้ลบได้', P.canRemove(saved[0].id) === true);
  check('id ว่างลบไม่ได้', P.canRemove('') === false);

  // ห้ามสร้างชุดที่ทับ id ของชุดในตัว
  check('id ที่ตั้งใหม่ไม่ชนชุดในตัว',
        P.newPresetId('default', null) !== 'default', P.newPresetId('default', null));
  check('ชุดที่บันทึกมาแบบทับ id ชุดในตัว ถูกทิ้ง',
        P.normalizePresets([{ id: 'cable', name: 'ปลอม', colors: {} }]).length === 0);

  // ไฟล์เสียต้องไม่พัง
  let threw = false;
  for (const bad of [null, 'ข้อความ', 5, [null], [{}], [{ id: '' }], [{ id: 'a', colors: 'x' }]]) {
    try { P.normalizePresets(bad); } catch { threw = true; }
  }
  check('normalizePresets ไม่ throw กับค่าเสียทุกแบบ', !threw);
  check('รายการที่ไม่มี id ถูกข้าม', P.normalizePresets([{ name: 'ไม่มี id' }]).length === 0);
}

// ═══════════ applyPreset / matchPreset ═══════════
{
  const cur = { 'nb-bg': '#101010', 'nc-char': '#ffffff' };
  const next = P.applyPreset(cur, P.builtinPreset('rainbow'));
  check('ทับเฉพาะคีย์ที่ชุดกำหนด', next['nc-char'] === P.builtinPreset('rainbow').colors['nc-char']);
  check('สีที่ชุดไม่ได้พูดถึงคงเดิม (สีพื้น/กริดไม่หาย)', next['nb-bg'] === '#101010');
  check('applyPreset ไม่แก้ของเดิม', cur['nc-char'] === '#ffffff');
  check('applyPreset รับ null ได้', typeof P.applyPreset(null, null) === 'object');

  check('matchPreset รู้ว่าตรงชุดไหน',
        P.matchPreset(P.builtinPreset('cable').colors, null) === 'cable');
  check('แก้สีเองแล้ว = ไม่ตรงชุดไหน',
        P.matchPreset({ ...P.builtinPreset('cable').colors, 'nc-char': '#000000' }, null) === '');
  check('ค่าว่าง = ไม่ตรงชุดไหน', P.matchPreset({}, null) === '');
  check('matchPreset เห็นชุดของผู้ใช้ด้วย', (() => {
    const mine = P.addPreset(null, 'ของฉัน', P.builtinPreset('flower').colors);
    // ชุดในตัวมาก่อนในลำดับการค้น → ต้องได้ flower (สีเหมือนกันเป๊ะ) ไม่ใช่พัง
    return P.matchPreset(P.builtinPreset('flower').colors, mine) === 'flower';
  })());
}

console.log(`\nnet-presets: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
