// test/sp-continued.test.cjs — unit test ระบบต่อเนื่อง (ข้อ 55 + 56)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const CT = build('sp-continued.js', 'k2-spcont-test.cjs');
const SF = build('sp-format.js', 'k2-spcont-fmt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── ค่าเริ่มต้น ──
check('CONTINUED_DEFAULTS เปิดใช้งานมาแต่แรก',
  CT.CONTINUED_DEFAULTS.enabled === true && CT.CONTINUED_DEFAULTS.scene === true &&
  CT.CONTINUED_DEFAULTS.dialogue === true);
check('มีสวิตช์เลขกำกับ CONTINUED: (2)', CT.CONTINUED_DEFAULTS.number === true);
check('ระยะ (MORE) เท่าแนวชื่อตัวละคร (3.7 นิ้ว)', CT.CONTINUED_DEFAULTS.indent === 3.7);
check('ชนิดเครื่องหมายครบ 4 อย่าง', CT.CONTINUED_TYPES.length === 4 &&
  CT.CONTINUED_TYPES.every((t) => CT.CONTINUED_CLASS[t] && Number.isFinite(CT.CONTINUED_SIDE[t])));
check('ของท้ายหน้าอยู่ก่อนเส้นคั่นหน้า (side < -1)',
  CT.CONTINUED_SIDE.more < -1 && CT.CONTINUED_SIDE['continued-bottom'] < -1);
check('ของต้นหน้าอยู่หลังเส้นคั่นหน้า (side > -1)',
  CT.CONTINUED_SIDE['continued-top'] > -1 && CT.CONTINUED_SIDE.contd > -1);
check('(MORE) อยู่ก่อน (CONTINUED) ท้ายหน้า',
  CT.CONTINUED_SIDE.more < CT.CONTINUED_SIDE['continued-bottom']);
check('CONTINUED: อยู่ก่อนชื่อ+(cont\'d) ต้นหน้า',
  CT.CONTINUED_SIDE['continued-top'] < CT.CONTINUED_SIDE.contd);

// ── ฉากข้ามหน้า ──
const withPos = (arr) => arr.map((b, i) => ({ ...b, pos: (i + 1) * 10, idx: i }));
// [alpha.83 ข้อ 6] CONTINUED ใช้กับ "บล็อกที่ถูกหั่นคร่อมหน้า" เท่านั้น (กฎที่ผู้ใช้สั่ง)
// — บรรยายก้อนสั้น ๆ 40 ก้อนที่รอยต่ออยู่ระหว่างก้อน **ไม่ใช่** เคสของ CONTINUED อีกต่อไป
const longScene = withPos([{ el: 'scene', text: 'INT. ห้องนอน - กลางคืน' },
  ...Array.from({ length: 12 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'action', text: 'บรรยายยาวมาก '.repeat(400) }]);
const pagesA = SF.paginate(longScene, { lines: 20 });
const marksA = CT.computeContinueds(pagesA, SF.mergeSpFormat());
check('ฉากยาวข้ามหน้า → ได้เครื่องหมาย', marksA.length > 0, marksA.length);
check('มี (CONTINUED) ท้ายหน้า',
  marksA.some((m) => m.type === 'continued-bottom' && m.text === '(CONTINUED)'));
check('มี CONTINUED: ต้นหน้า',
  marksA.some((m) => m.type === 'continued-top' && m.text.startsWith('CONTINUED:')));
check('ทุกเครื่องหมายมีตำแหน่งจริงในเอกสาร',
  marksA.every((m) => Number.isFinite(m.pos) && m.pos > 0));
check('ทุกเครื่องหมายมีคลาส CSS', marksA.every((m) => !!m.cls));
check('ข้ามหลายหน้า → มีเลขกำกับอย่างน้อยหนึ่งอัน',
  pagesA.count < 3 || marksA.some((m) => /CONTINUED: \(\d+\)/.test(m.text)),
  marksA.map((m) => m.text).join(' / '));
check('เลขกำกับเริ่มที่ (2) ไม่ใช่ (1)', !marksA.some((m) => m.text === 'CONTINUED: (1)'));

// ── ไม่มีหัวฉาก = ไม่มีเครื่องหมายฉาก ──
const noScene = withPos([...Array.from({ length: 12 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'action', text: 'บรรยายยาวมาก '.repeat(400) }]);
const marksN = CT.computeContinueds(SF.paginate(noScene, { lines: 20 }), SF.mergeSpFormat());
check('ไม่มีหัวฉาก → ไม่มี (CONTINUED)/CONTINUED:',
  !marksN.some((m) => m.type === 'continued-top' || m.type === 'continued-bottom'));

// ── บทพูดข้ามหน้า ──
const dlg = withPos([{ el: 'scene', text: 'INT. ครัว - เช้า' },
  ...Array.from({ length: 6 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'พูดยาวมาก '.repeat(60) }]);
const pagesD = SF.paginate(dlg, { lines: 20 });
const marksD = CT.computeContinueds(pagesD, SF.mergeSpFormat());
check('บทพูดถูกตัด → มี (MORE)', marksD.some((m) => m.type === 'more' && m.text === '(MORE)'),
  marksD.map((m) => m.type).join(','));
check('บทพูดต่อหน้าใหม่ → ทวนชื่อ + (cont\'d)',
  marksD.some((m) => m.type === 'contd' && m.text.includes('ทอร่า') && m.text.includes("(cont'd)")),
  marksD.filter((m) => m.type === 'contd').map((m) => m.text).join(','));

// ── สวิตช์ปิด ──
const offAll = SF.mergeSpFormat({ continued: { enabled: false } });
check('ปิดทั้งระบบ → ไม่มีเครื่องหมายเลย',
  CT.computeContinueds(SF.paginate(longScene, { lines: 20, fmt: offAll }), offAll).length === 0);
const offScene = SF.mergeSpFormat({ continued: { scene: false } });
check('ปิดเฉพาะฉาก → ไม่มี CONTINUED แต่ยังตัดหน้าปกติ',
  !CT.computeContinueds(SF.paginate(longScene, { lines: 20, fmt: offScene }), offScene)
    .some((m) => m.type === 'continued-top'));
const offDlg = SF.mergeSpFormat({ continued: { dialogue: false } });
check('ปิดเฉพาะบทพูด → ไม่มี (MORE)',
  !CT.computeContinueds(SF.paginate(dlg, { lines: 20, fmt: offDlg }), offDlg)
    .some((m) => m.type === 'more'));
const noNum = SF.mergeSpFormat({ continued: { number: false } });
check('ปิดเลขกำกับ → ไม่มีวงเล็บตัวเลข',
  !CT.computeContinueds(SF.paginate(longScene, { lines: 20, fmt: noNum }), noNum)
    .some((m) => /CONTINUED: \(\d+\)/.test(m.text)));

// ── ข้อความที่ผู้ใช้ตั้งเอง (ข้อ 92) ──
const thai = SF.mergeSpFormat({ strings: { continuedBottom: '(ต่อหน้าถัดไป)', continuedTop: 'ต่อจากหน้าก่อน:' } });
const marksTH = CT.computeContinueds(SF.paginate(longScene, { lines: 20, fmt: thai }), thai);
check('ใช้ข้อความไทยที่ผู้ใช้ตั้งได้',
  marksTH.some((m) => m.text === '(ต่อหน้าถัดไป)') &&
  marksTH.some((m) => m.text.startsWith('ต่อจากหน้าก่อน:')));

// ── ตัวช่วยอื่น ──
check('continuedsFromBlocks ให้ผลเท่ากับเรียกสองขั้น',
  CT.continuedsFromBlocks(longScene, { lines: 20 }).length === marksA.length);
const sum = CT.continuedSummary(marksA);
check('continuedSummary นับครบ', sum.total === marksA.length && sum['continued-top'] > 0);
check('continuedStatusText อ่านรู้เรื่อง', /ต่อเนื่อง/.test(CT.continuedStatusText(marksA)));
check('continuedStatusText ตอนไม่มีอะไร', CT.continuedStatusText([]) === 'ต่อเนื่อง: ไม่มี');
check('pageAnchor คืนตำแหน่งบล็อกจริงตัวแรก',
  CT.pageAnchor(pagesA.pages[1]) === (pagesA.pages[1].blocks.find((b) => Number.isFinite(b.pos)) || {}).pos);
check('pageAnchor หน้าว่าง → null', CT.pageAnchor({ blocks: [] }) === null);

// ── หน้าที่พร้อมพิมพ์ (ส่งออก) ──
const withMarks = CT.pagesWithContinueds(pagesA, SF.mergeSpFormat());
// [alpha.83 ข้อ 6] หน้าที่ได้ CONTINUED ไม่ใช่หน้าแรกเสมอไปแล้ว — หาหน้าที่มีจริง
const iBot = pagesA.pages.findIndex((p) => p.continuedBottom);
const iTop = pagesA.pages.findIndex((p) => p.continuedTop);
check('pagesWithContinueds ใส่ CONTINUED: เป็นบล็อกจริงต้นหน้าที่ต่อจากฉากเดิม',
  iTop > 0 && withMarks[iTop].blocks[0].el === 'continued-top', iTop);
check('pagesWithContinueds ใส่ (CONTINUED) ท้ายหน้าที่ยังไม่จบบล็อก',
  iBot >= 0 && withMarks[iBot].blocks[withMarks[iBot].blocks.length - 1].el === 'continued-bottom',
  iBot);
check('pagesWithContinueds ไม่ทำลายบล็อกเดิม',
  withMarks[0].blocks.filter((b) => b.el === 'action').length ===
  pagesA.pages[0].blocks.filter((b) => b.el === 'action').length);
check('continuedPlainText มีข้อความต่อเนื่องอยู่ในนั้น',
  CT.continuedPlainText(pagesA, SF.mergeSpFormat()).includes('CONTINUED:'));

// ── CSS ที่ spCss สร้างให้ ──
const css = SF.spCss(SF.mergeSpFormat());
check('spCss สร้างกฎ .sp-more', /\.sp\.sp-more\{/.test(css));
check('spCss สร้างกฎ CONTINUED บน/ล่าง',
  /\.sp-continued-top/.test(css) && /\.sp-continued-bottom/.test(css));
check('(CONTINUED) ชิดขวา', /\.sp-continued-bottom[^}]*text-align:right/.test(css));
check('CONTINUED: ชิดซ้าย', /\.sp-continued-top[^}]*text-align:left/.test(css));

// ── ส่งออกผ่าน compile.js (ขั้นตอน sp-continued) ──
const CP = build('compile.js', 'k2-spcont-compile-test.cjs');
// [alpha.83 ข้อ 6] ต้องมี "บล็อกเดียวที่ยาวจนถูกหั่นคร่อมหน้า" ไม่งั้นไม่มี CONTINUED ตามกฎใหม่
const scriptText = ['.INT. ห้องนอน - กลางคืน',
  '!' + 'บรรยายยาวมากจนล้นหน้า '.repeat(400),
  ...Array.from({ length: 20 }, (_, i) => '!บรรยายฉากที่ ' + i)].join('\n');
const withCont = CP.insertContinueds(scriptText);
check('[compile] แทรก CONTINUED: ลงในข้อความส่งออก', withCont.includes('CONTINUED:'));
check('[compile] แทรก (CONTINUED) ท้ายหน้า', withCont.includes('(CONTINUED)'));
check('[compile] คั่นหน้าด้วยเครื่องหมายขึ้นหน้าใหม่', withCont.includes(CP.PAGE_BREAK));
check('[compile] เนื้อบทเดิมยังอยู่ครบ',
  withCont.includes('บรรยายฉากที่ 0') && withCont.includes('บรรยายฉากที่ 19'));
// [alpha.60r3a] มาตรฐานรหัสใหม่: หัวฉากเขียนออกเป็น `### ` (H3) — รับรหัสเดิม (`.` / INT.) ด้วย
check('[compile] หัวฉากยัง round-trip ได้ (### / จุด / INT.)',
  /(^|\n)(### |\.|INT\.)/.test(withCont),
  withCont.split('\n').slice(0, 3).join(' | '));
check('[compile] มีขั้นตอน sp-continued ให้เลือกในเวิร์กโฟลว์',
  !!CP.stepDef('sp-continued') && CP.stepDef('sp-continued').stage === 'text');
// [alpha.58r บั๊ก 13] พรีเซ็ตนิยายยังต้องไม่เปิด — แต่ต้องมีพรีเซ็ต "บทภาพยนตร์" ที่เปิดให้
const spOn = (p) => (p.steps || []).some((s) => s.key === 'sp-continued' && s.on !== false);
check('[compile] พรีเซ็ตของนิยายไม่เปิดขั้นตอนนี้',
  CP.PRESETS.filter((p) => p.id !== 'screenplay').every((p) => !spOn(p)));
check('[compile] มีพรีเซ็ตบทภาพยนตร์ที่เปิด sp-continued ให้เลย (บั๊ก 13)',
  !!CP.PRESETS.find((p) => p.id === 'screenplay' && spOn(p)));
check('[compile] ข้อความว่าง → ไม่พัง', typeof CP.insertContinueds('') === 'string');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
