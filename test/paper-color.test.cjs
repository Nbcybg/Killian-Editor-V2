// test/paper-color.test.cjs — unit test สีกระดาษที่ผู้ใช้เลือกเอง (alpha.100 ข้อ 1 + 4)
//
// สัญญาที่ผูกไว้ถาวร:
//   · ค่าเริ่มต้นเป็น **ขาว** (ผู้ใช้: "ให้เปลี่ยนเป็นสีขาวให้หมด")
//   · เลือกสีไหนก็ได้ แล้ว **สีข้างเคียงตามให้ครบ** — ไม่มีทางได้ "กระดาษขาวขอบครีม"
//     ซึ่งเป็นอาการของเดิมที่ขอบ/เส้นประ/พื้นบล็อกโค้ดเป็นเลขโทนครีมฝังตายใน CSS
//   · กระดาษมืด = หมึกสว่าง (ไม่งั้นตัวหนังสือดำบนพื้นดำ)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-papercolor-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'paper-color.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const P = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── ค่าเริ่มต้น ──
check('[100-4] ★ ค่าเริ่มต้นของกระดาษ = ขาว (ไม่ใช่ครีมของเดิม)',
  P.PAPER_DEFAULT === '#ffffff', P.PAPER_DEFAULT);
check('[100-4] ครีมของเดิมยังเลือกได้จากพรีเซ็ต (ไม่ได้ตัดทิ้ง)',
  P.PAPER_PRESETS.some((x) => x.color === '#f5f1e6'));
check('[100-4] ทุกพรีเซ็ตมีคีย์/ป้ายชื่อ/สี hex 6 หลัก',
  P.PAPER_PRESETS.every((x) => x.key && (x.label || '').length > 0 && /^#[0-9a-f]{6}$/.test(x.color)));
check('[100-4] คีย์พรีเซ็ตไม่ซ้ำกัน',
  new Set(P.PAPER_PRESETS.map((x) => x.key)).size === P.PAPER_PRESETS.length);

// ── แปลง/กันค่าเพี้ยน ──
check('hexRgb อ่าน 6 หลัก', JSON.stringify(P.hexRgb('#f5f1e6')) === JSON.stringify({ r: 245, g: 241, b: 230 }));
check('hexRgb อ่าน 3 หลัก (#fff → ขาว)', JSON.stringify(P.hexRgb('#fff')) === JSON.stringify({ r: 255, g: 255, b: 255 }));
check('hexRgb ไม่มี # ก็อ่านได้', P.hexRgb('20201c') !== null);
check('hexRgb ค่าที่อ่านไม่ออกคืน null',
  P.hexRgb('') === null && P.hexRgb('rgb(1,2,3)') === null && P.hexRgb(null) === null);
check('rgbHex คืนตัวพิมพ์เล็กเสมอ (เทียบกับพรีเซ็ตได้ตรง ๆ)',
  P.rgbHex({ r: 245, g: 241, b: 230 }) === '#f5f1e6');
check('normalizePaperColor ทำ #FFF → #ffffff', P.normalizePaperColor('#FFF') === '#ffffff');
check('normalizePaperColor ค่าพังตกกลับค่าเริ่มต้น',
  P.normalizePaperColor('พัง') === P.PAPER_DEFAULT && P.normalizePaperColor(undefined) === P.PAPER_DEFAULT);
check('normalizePaperColor รับ fallback เองได้', P.normalizePaperColor('x', '#123456') === '#123456');

// ── ผสมสี ──
check('mixHex 0 = สีเดิม', P.mixHex('#f5f1e6', '#000000', 0) === '#f5f1e6');
check('mixHex 1 = สีปลายทางเต็ม', P.mixHex('#f5f1e6', '#000000', 1) === '#000000');
check('mixHex ครึ่งทางของขาว→ดำ ≈ เทากลาง', P.mixHex('#ffffff', '#000000', 0.5) === '#808080',
  P.mixHex('#ffffff', '#000000', 0.5));
check('mixHex หนีบ amount นอกช่วง 0..1',
  P.mixHex('#ffffff', '#000000', -5) === '#ffffff' && P.mixHex('#ffffff', '#000000', 9) === '#000000');

// ── ความสว่าง / หมึก ──
check('ขาวสว่าง · ดำมืด', P.isLightPaper('#ffffff') && !P.isLightPaper('#000000'));
check('ครีมยังนับเป็นกระดาษสว่าง', P.isLightPaper('#f5f1e6'));
check('luminance อยู่ในช่วง 0..1', P.luminance('#7f7f7f') > 0 && P.luminance('#7f7f7f') < 1);

// ── ★ หัวใจของข้อ 4: เลือกสีเดียว แล้วสีข้างเคียงตามให้ครบ ──
const KEYS = ['--paper', '--paper-ink', '--paper-edge', '--paper-line', '--paper-code', '--paper-dim'];
for (const hex of ['#ffffff', '#f5f1e6', '#efe3cc', '#2b2b2b', '#123456']) {
  const v = P.paperVars(hex);
  check('paperVars(' + hex + ') ครบทุกตัวแปร และเป็น hex ถูกรูปแบบ',
    KEYS.every((k) => /^#[0-9a-f]{6}$/.test(v[k])), JSON.stringify(v));
  check('paperVars(' + hex + ') --paper = สีที่เลือกเป๊ะ', v['--paper'] === P.normalizePaperColor(hex));
  // ★ ไม่มีค่าไหน "ค้างเป็นโทนครีมของเดิม" — ทุกตัวต้องคำนวณจากสีที่เลือกจริง
  // (เลขที่เทียบคือของที่เคยฝังตายใน style.css: ขอบ #d8d2c2 · เส้นประ #c9c2ae · โค้ด #f2f0ea)
  const OLD_CREAM = ['#d8d2c2', '#c9c2ae', '#f2f0ea'];
  check('paperVars(' + hex + ') ★ ขอบ/เส้นประ/พื้นโค้ด ไม่ค้างเป็นเลขครีมฝังตายของเดิม',
    hex === '#f5f1e6'
      || !['--paper-edge', '--paper-line', '--paper-code'].some((k) => OLD_CREAM.includes(v[k])),
    JSON.stringify(v));
  check('paperVars(' + hex + ') ★ สีข้างเคียงอยู่ในโทนเดียวกับกระดาษ (ไม่ใช่โทนอื่นค้างอยู่)',
    ['--paper-edge', '--paper-line', '--paper-code'].every((k) => {
      const a = P.hexRgb(v['--paper']), b = P.hexRgb(v[k]);
      // ผลต่างของช่องสีต้องไล่ไปทางเดียวกันทุกช่อง (= ผสมกับดำ/ขาวล้วน ไม่ใช่ไปเจือสีอื่น)
      const d = [b.r - a.r, b.g - a.g, b.b - a.b];
      return d.every((x) => x <= 1) || d.every((x) => x >= -1);
    }), JSON.stringify(v));
  const inkLight = P.luminance(v['--paper-ink']) > 0.5;
  check('paperVars(' + hex + ') ★ กระดาษสว่าง = หมึกเข้ม · กระดาษมืด = หมึกสว่าง',
    inkLight !== P.isLightPaper(hex), hex + ' → ink ' + v['--paper-ink']);
  // เส้นประต้องเข้มกว่าขอบแผ่น (ไม่งั้นเห็นเส้นขอบชัดกว่าเส้นบอกระยะ = สลับความสำคัญ)
  const d = (k) => Math.abs(P.luminance(v[k]) - P.luminance(v['--paper']));
  check('paperVars(' + hex + ') ไล่ระดับถูกลำดับ: โค้ด < ขอบ < เส้น < จาง < หมึก',
    d('--paper-code') <= d('--paper-edge') && d('--paper-edge') <= d('--paper-line')
    && d('--paper-line') <= d('--paper-dim') && d('--paper-dim') <= d('--paper-ink'),
    JSON.stringify(v));
}
check('paperVars ค่าพัง → ตกกลับกระดาษขาว', P.paperVars('พัง')['--paper'] === P.PAPER_DEFAULT);

// ── จับคู่พรีเซ็ต ──
check('matchPaperPreset เจอขาว', P.matchPaperPreset('#ffffff') === 'white');
check('matchPaperPreset ไม่สนตัวพิมพ์ใหญ่', P.matchPaperPreset('#F5F1E6') === 'cream');
check('matchPaperPreset สีที่ไม่ตรงพรีเซ็ต = ตั้งเอง (คืนค่าว่าง)', P.matchPaperPreset('#123456') === '');
check('paperPresetColor คืนสีของพรีเซ็ต', P.paperPresetColor('cream') === '#f5f1e6');
check('paperPresetColor คีย์ที่ไม่รู้จักคืน null (อย่าไปแตะสีเดิม)', P.paperPresetColor('zzz') === null);
for (const p of P.PAPER_PRESETS) {
  check(p.key + ': จับคู่กลับหาตัวเองได้', P.matchPaperPreset(p.color) === p.key);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
