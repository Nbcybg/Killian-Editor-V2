// test/sp-format.test.cjs — unit test เอนจินรูปแบบบทภาพยนตร์ (ข้อ 81–85, 92, 97)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-spformat-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'sp-format.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const SF = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── 85 ขนาดกระดาษ + ระยะขอบ ──
check('มีขนาดกระดาษ letter/a4/custom', !!(SF.PAPER_SIZES.letter && SF.PAPER_SIZES.a4 && SF.PAPER_SIZES.custom));
check('Letter = 8.5 × 11 นิ้ว', SF.PAPER_SIZES.letter.width === 8.5 && SF.PAPER_SIZES.letter.height === 11);
check('A4 = 8.27 × 11.69 นิ้ว', SF.PAPER_SIZES.a4.width === 8.27 && SF.PAPER_SIZES.a4.height === 11.69);
check('ระยะขอบเริ่มต้น T1 B1 L1.5 R1',
  SF.MARGIN_DEFAULTS.top === 1 && SF.MARGIN_DEFAULTS.bottom === 1 &&
  SF.MARGIN_DEFAULTS.left === 1.5 && SF.MARGIN_DEFAULTS.right === 1);
check('Letter + ขอบเริ่มต้น = 54 บรรทัด/หน้า', SF.linesPerPage(SF.PAPER_SIZES.letter, SF.MARGIN_DEFAULTS) === 54,
  SF.linesPerPage(SF.PAPER_SIZES.letter, SF.MARGIN_DEFAULTS));
check('A4 สูงกว่า → บรรทัดต่อหน้ามากกว่า Letter',
  SF.linesPerPage(SF.PAPER_SIZES.a4, SF.MARGIN_DEFAULTS) > SF.linesPerPage(SF.PAPER_SIZES.letter, SF.MARGIN_DEFAULTS));
check('ความกว้างพื้นที่พิมพ์ Letter = 6 นิ้ว', SF.textWidth(SF.PAPER_SIZES.letter, SF.MARGIN_DEFAULTS) === 6);
check('ขอบมากขึ้น → บรรทัดต่อหน้าน้อยลง',
  SF.linesPerPage(SF.PAPER_SIZES.letter, { top: 2, bottom: 2, left: 1.5, right: 1 }) === 42);

// ── 81 ระยะเยื้อง/ความกว้าง ──
check('ตัวละครเยื้อง 3.7 นิ้ว กว้าง 3.8', SF.SP_ELEMENT_CONFIG.character.indent === 3.7 && SF.SP_ELEMENT_CONFIG.character.width === 3.8);
check('บทพูดเยื้อง 2.5 นิ้ว กว้าง 3.5', SF.SP_ELEMENT_CONFIG.dialogue.indent === 2.5 && SF.SP_ELEMENT_CONFIG.dialogue.width === 3.5);
check('วงเล็บเยื้อง 3.1 นิ้ว กว้าง 2.9', SF.SP_ELEMENT_CONFIG.parenthetical.indent === 3.1 && SF.SP_ELEMENT_CONFIG.parenthetical.width === 2.9);
check('ทรานซิชันเยื้อง 6.0 นิ้ว', SF.SP_ELEMENT_CONFIG.transition.indent === 6.0);
check('มี element ครบทุกตัวใน SP_ELEMENT_KEYS', SF.SP_ELEMENT_KEYS.length >= 15, SF.SP_ELEMENT_KEYS.length);

// ── 82 ระยะเว้นบรรทัด ──
check('หัวฉากเว้น 2 บรรทัดก่อน (linesBefore 20)', SF.SP_ELEMENT_CONFIG.scene.linesBefore === 20);
check('บทพูดไม่เว้นก่อน (linesBefore 0)', SF.SP_ELEMENT_CONFIG.dialogue.linesBefore === 0);

// ── ผสานค่าผู้ใช้ ──
const merged = SF.mergeSpFormat({ margins: { left: 2 }, elements: { dialogue: { indent: 3 } } });
check('merge: ขอบซ้ายที่ผู้ใช้ตั้งชนะ', merged.margins.left === 2);
check('merge: ขอบอื่นยังเป็นค่าเริ่มต้น', merged.margins.top === 1 && merged.margins.right === 1);
check('merge: indent ที่ผู้ใช้ตั้งชนะ', merged.elements.dialogue.indent === 3);
check('merge: width ของ element เดิมยังอยู่', merged.elements.dialogue.width === 3.5);
check('merge: ไม่แก้ค่าคงที่ต้นฉบับ', SF.SP_ELEMENT_CONFIG.dialogue.indent === 2.5);
check('merge: paperSize ที่ไม่รู้จัก → letter', SF.mergeSpFormat({ paperSize: 'zzz' }).paperSize === 'letter');
check('merge: custom ใช้ขนาดที่กรอกเอง',
  SF.mergeSpFormat({ paperSize: 'custom', paper: { width: 7, height: 9 } }).paper.width === 7);

// ── CSS ──
const vars = SF.pageCssVars(SF.mergeSpFormat({}));
check('pageCssVars มี --page-w = 8.5in', vars['--page-w'] === '8.5in', vars['--page-w']);
check('pageCssVars มี --mg-left = 1.5in', vars['--mg-left'] === '1.5in');
check('pageCssVars มี --text-w = 6in', vars['--text-w'] === '6in', vars['--text-w']);
const css = SF.spCss(SF.mergeSpFormat({}));
check('spCss มีกฎ .sp.sp-character', css.includes('.sp.sp-character{'));
check('spCss: ตัวละคร margin-left = 3.7-1.5 = 2.2in', css.includes('margin-left:2.2in'), css.slice(css.indexOf('.sp.sp-character'), css.indexOf('.sp.sp-character') + 90));
check('spCss: ตัวละครกว้าง 3.8in', /\.sp\.sp-character\{[^}]*width:3\.8in/.test(css));
check('spCss: ตัวละครเป็นตัวพิมพ์ใหญ่บนจอ', /\.sp\.sp-character\{[^}]*text-transform:uppercase/.test(css));
check('spCss: ทรานซิชันถูกหนีบไม่ให้ล้นขอบขวา (6.0+2.0 > 7.5 → กว้าง 1.5in)',
  /\.sp\.sp-transition\{[^}]*width:1\.5in/.test(css), css.slice(css.indexOf('.sp.sp-transition'), css.indexOf('.sp.sp-transition') + 80));
check('spCss: element ที่ไม่ล้นคงความกว้างเดิม', /\.sp\.sp-dialogue\{[^}]*width:3\.5in/.test(css));
check('spCss: มีบล็อก @media print', css.includes('@media print{'));
check('spCss: มี @page ขนาด 8.5in 11in', css.includes('@page{size:8.5in 11in'), css.slice(css.indexOf('@page'), css.indexOf('@page') + 90));
check('spCss: @page ระยะขอบ 1in 1in 1in 1.5in', css.includes('margin:1in 1in 1in 1.5in'));
check('spCss: เปลี่ยนกระดาษเป็น A4 แล้ว @page ตาม',
  SF.spCss(SF.mergeSpFormat({ paperSize: 'a4' })).includes('@page{size:8.27in 11.69in'));
check('spCss: วงเล็บเอียงบนจอ แต่ไม่เอียงตอนพิมพ์',
  /\.sp\.sp-parenthetical\{[^}]*font-style:italic/.test(css.split('@media print{')[0]) &&
  /\.sp\.sp-parenthetical\{[^}]*font-style:normal/.test(css.split('@media print{')[1]));
check('spCss: ขอบซ้ายเปลี่ยน → margin-left ของ element เลื่อนตาม',
  SF.spCss(SF.mergeSpFormat({ margins: { left: 1 } })).includes('margin-left:2.7in'));

// ── 83 สไตล์ screen/print ──
check('สไตล์ตอนพิมพ์ของ act-break ขีดเส้นใต้', SF.SP_ELEMENT_STYLES['act-break'].print.underline === true);
check('สไตล์บนจอของ act-break ไม่ขีดเส้นใต้', SF.SP_ELEMENT_STYLES['act-break'].screen.underline === false);
const st = SF.mergeSpFormat({ styles: { dialogue: { print: { bold: true } } } });
check('merge สไตล์: print.bold ที่ตั้งเองชนะ', st.styles.dialogue.print.bold === true);
check('merge สไตล์: screen ของ dialogue ยังเป็นค่าเดิม', st.styles.dialogue.screen.bold === false);

// ── wrapLines ──
check('wrapLines: ข้อความสั้น = 1 บรรทัด', SF.wrapLines('สวัสดี', 6) === 1);
check('wrapLines: ว่าง = 1 บรรทัด', SF.wrapLines('', 6) === 1);
check('wrapLines: 100 ตัวอักษร กว้าง 3.5in (35 คอลัมน์) ≥ 3 บรรทัด',
  SF.wrapLines('a '.repeat(50).trim(), 3.5) >= 3, SF.wrapLines('a '.repeat(50).trim(), 3.5));
check('wrapLines: กว้างขึ้น → บรรทัดน้อยลง',
  SF.wrapLines('word '.repeat(60), 6) < SF.wrapLines('word '.repeat(60), 2));

// ── 84 pagination ──
const many = [];
for (let i = 0; i < 40; i++) many.push({ el: 'action', text: 'บรรยายฉากที่ ' + i });
const pg = SF.paginate(many, { lines: 20 });
check('paginate: บทยาว → หลายหน้า', pg.count > 1, pg.count);
check('paginate: ทุกหน้ามีบล็อก', pg.pages.every((p) => p.blocks.length > 0));
check('paginate: หน้าแรกไม่เกินจำนวนบรรทัดต่อหน้า',
  pg.pages[0].blocks.reduce((a, b) => a + (b.lines || 1) + 1, 0) <= 22);
// [alpha.58 · 55–56] ไม่มีหัวฉาก = ไม่มีฉากให้ "ต่อ" → ห้ามขึ้น CONTINUED (เดิมขึ้นทุกคู่หน้า)
check('paginate: ไม่มีหัวฉาก → ไม่มี (CONTINUED)', !pg.pages[0].continuedBottom);
check('paginate: ไม่มีหัวฉาก → ไม่มี CONTINUED: ต้นหน้า', !pg.pages[1].continuedTop);
const sceneLong = [{ el: 'scene', text: 'INT. ห้องนอน - กลางคืน' }, ...many];
const pgS = SF.paginate(sceneLong, { lines: 20 });
// [alpha.83 ข้อ 6] **กฎใหม่ตามที่ผู้ใช้สั่ง**: CONTINUED ใช้กับ "บล็อกที่ถูกหั่นคร่อมหน้า" เท่านั้น
// ฉากเดียวกันที่รอยต่ออยู่ *ระหว่าง* บล็อก (บรรยายจบพอดี แล้วก้อนใหม่ขึ้นหน้าใหม่)
// = คนละบล็อก แค่บรรทัดติดกัน → ห้ามขึ้น CONTINUED
check('[83-6] ฉากข้ามหน้าแต่ไม่มีบล็อกถูกหั่น → ไม่มี (CONTINUED)',
  !pgS.pages[0].continuedBottom, pgS.pages[0].continuedBottom);
check('[83-6] …และต้นหน้า 2 ก็ไม่มี CONTINUED:',
  !pgS.pages[1].continuedTop, pgS.pages[1].continuedTop);
// บรรยายก้อนเดียวยาวจนถูกหั่นคร่อมหน้า = เคสที่ CONTINUED มีไว้ใช้จริง
const sceneSplit = [{ el: 'scene', text: 'INT. ห้องนอน - กลางคืน' },
  { el: 'action', text: 'บรรยายยาวมาก '.repeat(220) }];
const pgSp = SF.paginate(sceneSplit, { lines: 20 });
const flatSp = pgSp.pages.flatMap((p) => p.blocks);
check('[83-6] บรรยายถูกหั่นคร่อมหน้าจริง',
  flatSp.some((b) => b.split === 'head') && flatSp.some((b) => b.split === 'tail'),
  JSON.stringify(pgSp.pages.map((p) => p.blocks.map((b) => b.el + ':' + (b.split || '-')))));
check('[83-6] บล็อกถูกหั่น → ท้ายหน้ามี (CONTINUED)',
  pgSp.pages[0].continuedBottom === '(CONTINUED)', pgSp.pages[0].continuedBottom);
check('[83-6] บล็อกถูกหั่น → ต้นหน้า 2 มี CONTINUED:',
  pgSp.pages[1].continuedTop === 'CONTINUED:', pgSp.pages[1].continuedTop);
check('[83-6] ข้ามหน้าที่สามขึ้นไปใส่เลขกำกับ',
  pgSp.count < 3 || pgSp.pages[2].continuedTop === 'CONTINUED: (2)',
  pgSp.pages[2] && pgSp.pages[2].continuedTop);
// [alpha.86] ★ บัญชีบรรทัดที่ "ตรงกับที่ตาเห็น"
//   · (MORE) / ชื่อ+(cont'd) = เนื้อบทจริง → นับ 1 บรรทัด (paginate จองโควตาให้)
//   · (CONTINUED) / CONTINUED: = วาดใน **ระยะขอบ** → **ไม่นับ** (เหมือน pdf-generator.js)
//   · ระยะเว้นนำหน้าบล็อก (linesBefore) กินโควตาด้วย ต้องบวกเข้าไป ไม่งั้นเทสหลวมเกินจริง
const FMT86 = SF.mergeSpFormat({});
const pageLines = (pg, fmt = FMT86) => (pg.blocks || []).reduce((a, b, i) => {
  if (b.more || b.contd || b.el === 'blank') return a + (b.lines || 1);
  const c = fmt.elements[b.el] || fmt.elements.action;
  const before = i && b.split !== 'tail' ? Math.round((c.linesBefore ?? 10) / 10) : 0;
  return a + before + (b.lines || 1);
}, 0);

check('[86] ★ ทุกหน้าใช้โควตา 20 บรรทัดได้เต็ม และไม่ล้น',
  pgSp.pages.every((p) => pageLines(p) <= 20),
  JSON.stringify(pgSp.pages.map((p) => pageLines(p))));
// ถ้า CONTINUED ยังกินบรรทัดอยู่ จะไม่มีหน้าไหนแตะ 20 ได้เลย — เทสนี้คือประตูกันการถอยกลับ
// (หน้าที่ได้ 19 เป็นเรื่องปกติ: กฎ widow/orphan ยกบล็อกไปทั้งก้อนแทนที่จะหั่น)
check('[86] ★ CONTINUED อยู่ในระยะขอบ ไม่กินโควตา → มีหน้าที่ใช้เต็ม 20 พอดี',
  pgSp.pages.some((p) => pageLines(p) === 20),
  JSON.stringify(pgSp.pages.map((p) => pageLines(p))));
// หัวฉากใหม่ต้นหน้า = ฉากก่อนหน้าจบพอดี → ห้ามมี CONTINUED
// (หัวฉาก 1 บรรทัด + บรรยาย 9 ก้อน × 2 บรรทัด = 19 บรรทัด → หัวฉากถัดไปลงหน้าใหม่พอดี)
const twoScenes = [{ el: 'scene', text: 'INT. ก - วัน' },
  ...Array.from({ length: 9 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'scene', text: 'EXT. ข - คืน' },
  ...Array.from({ length: 5 }, (_, i) => ({ el: 'action', text: 'ต่อ ' + i }))];
const pgT = SF.paginate(twoScenes, { lines: 20 });
check('paginate: ขึ้นฉากใหม่ต้นหน้า → ไม่มี CONTINUED',
  pgT.pages.length > 1 && !pgT.pages[1].continuedTop && !pgT.pages[0].continuedBottom,
  JSON.stringify(pgT.pages.map((p) => [p.sceneStart, p.sceneEnd, p.continuedTop || ''])));
check('paginate: เลขฉากเริ่ม/จบของแต่ละหน้าถูกบันทึกไว้',
  pgS.pages.every((p) => Number.isFinite(p.sceneStart) && Number.isFinite(p.sceneEnd)));
// ปิดระบบต่อเนื่องได้
const pgOff = SF.paginate(sceneSplit, { lines: 20, fmt: SF.mergeSpFormat({ continued: { enabled: false } }) });
check('paginate: ปิดระบบต่อเนื่อง → ไม่มี CONTINUED เลย',
  pgOff.pages.every((p) => !p.continuedTop && !p.continuedBottom));
// [alpha.83 ข้อ 6] ★ กวาดทุกความยาว × ทุกโควตา — **ห้ามมีหน้าไหนล้นแม้แต่บรรทัดเดียว**
// (นับบรรทัดของ CONTINUED:/(CONTINUED)/(MORE) ที่วาดบนหน้าเข้าไปด้วย)
// เทสนี้คือประตูกันบั๊ก "หน้ากระดาษล้น margin · หน้าไม่เท่ากัน" ที่ผู้ใช้รายงาน
{
  const usedOf = (pg) => pageLines(pg);
  const over = [];
  for (let n = 20; n <= 800; n += 7) {
    for (const lines of [12, 20, 30, 54]) {
      const doc = [{ el: 'scene', text: 'INT. ทางเดิน - กลางคืน' },
                   { el: 'action', text: 'บรรยายยาวมาก '.repeat(n) }];
      const r = SF.paginate(doc, { lines });
      if (r.pages.some((pg) => usedOf(pg) > lines)) over.push('action ' + n + '/' + lines);
    }
    if (n <= 600) {
      const doc = [{ el: 'scene', text: 'INT. ครัว - เช้า' }, { el: 'character', text: 'ทอร่า' },
                   { el: 'dialogue', text: 'พูดยาว '.repeat(n) }];
      const r = SF.paginate(doc, { lines: 20 });
      if (r.pages.some((pg) => usedOf(pg) > 20)) over.push('dialogue ' + n);
    }
  }
  check('[83-6] ★ กวาด 450+ เคส: ไม่มีหน้าไหนล้นโควตาเลยสักหน้า',
    over.length === 0, over.slice(0, 5).join(' · '));
}
check('paginate: บทว่าง → 1 หน้า', SF.paginate([]).count === 1);
check('pageCount ตรงกับ paginate().count', SF.pageCount(many, { lines: 20 }) === pg.count);

// บทพูดยาวข้ามหน้า → ต้องมี (MORE) + ทวนชื่อ + (cont'd)
// [alpha.82] ของเดิม repeat(40) = **พอดีเส้นแบ่งเป๊ะ** (13 บรรทัด + ชื่อ 1 = 14 = โควตาหน้า)
// ตอนที่นับบรรทัดเกินจริงมันจึง "ข้ามหน้า" พอนับถูกมันก็ลงหน้าเดียวพอดี
// → เทสกลายเป็นการวัด "อัลกอริทึมนับเกินไหม" แทน "บทพูดข้ามหน้าได้ไหม" · ขยายให้ยาวเกินหน้าชัด ๆ
const longDlg = [
  { el: 'action', text: 'x '.repeat(30) },
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'คำพูดยาวมาก '.repeat(70) },
];
const pd = SF.paginate(longDlg, { lines: 14 });
const flat = pd.pages.flatMap((p) => p.blocks);
check('paginate: บทพูดข้ามหน้ามี (MORE)', flat.some((b) => b.el === 'more' && b.text === '(MORE)'),
  JSON.stringify(flat.map((b) => b.el)));
check("paginate: ต้นหน้าใหม่ทวนชื่อ + (cont'd)",
  flat.some((b) => b.el === 'character' && b.contd && b.text.includes("(cont'd)")));
check('paginate: บทพูดถูกแบ่งเป็น head/tail', flat.some((b) => b.split === 'head') && flat.some((b) => b.split === 'tail'));

// ชื่อตัวละครต้องไม่ค้างท้ายหน้าโดยไม่มีบทพูด
const orphan = [];
for (let i = 0; i < 9; i++) orphan.push({ el: 'action', text: 'บรรทัด ' + i });
orphan.push({ el: 'character', text: 'คัสซี่' });
orphan.push({ el: 'dialogue', text: 'ก '.repeat(60) });
const po = SF.paginate(orphan, { lines: 12 });
const lastOfFirst = po.pages[0].blocks[po.pages[0].blocks.length - 1];
check('paginate: ชื่อตัวละครไม่ค้างท้ายหน้าเดี่ยว ๆ',
  !(lastOfFirst && lastOfFirst.el === 'character' && !po.pages[0].blocks.some((b) => b.el === 'dialogue')),
  lastOfFirst && lastOfFirst.el);

// กฎที่ตั้งเองมีผลจริง — บทพูดที่ **สั้นกว่าหนึ่งหน้า** ต้องถูกยกไปทั้งก้อน ไม่ถูกหั่น
// [alpha.103 ข้อ 3] เดิมเทสนี้ใช้บทพูดที่ยาวเกินหนึ่งหน้า แล้วคาดหวังว่า "ไม่หั่น" —
// ซึ่งแปลว่ายอมให้หน้านั้นสูง 35 บรรทัดบนกระดาษ 14 บรรทัด (คือบั๊กหน้าล้นที่กำลังแก้อยู่)
// เจตนาจริงของเทสคือ "กฎที่ผู้ใช้ตั้งมีผล" → วัดด้วยบล็อกที่ยกทั้งก้อนได้จริง
const shortDlg = [
  { el: 'action', text: 'x '.repeat(30) },
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'คำพูด '.repeat(18) },
];
const strict = SF.paginate(shortDlg, { lines: 14, fmt: SF.mergeSpFormat({ rules: { minDialogueLinesAtBottom: 99 } }) });
check('paginate: ตั้ง minDialogueLinesAtBottom สูง → ไม่แบ่งบทพูด',
  !strict.pages.flatMap((p) => p.blocks).some((b) => b.split === 'head'),
  JSON.stringify(strict.pages.map((p) => p.blocks.map((b) => b.el + ':' + (b.lines || 0)))));

// ══ [alpha.103 ข้อ 3] ★ หั่นได้ทุกชนิดแบบ Fade In ══
{
  const LINES = 20;
  const long = 'ข้อความยาวมากที่ต้องพันหลายบรรทัด '.repeat(120);   // ≥ 3 หน้าทุกความกว้าง
  for (const elName of SF.SP_ELEMENT_KEYS) {
    if (['blank', 'page-break', 'more'].includes(elName)) continue;
    const pg = SF.paginate([{ el: elName, text: long }], { lines: LINES });
    const over = pg.pages.filter((p) => p.blocks.reduce((s, b) => s + (b.lines || 0), 0) > LINES);
    check('[103-3] ' + elName + ': ไม่มีหน้าไหนล้นโควตา', over.length === 0,
      JSON.stringify(pg.pages.map((p) => p.blocks.reduce((s, b) => s + (b.lines || 0), 0))));
    check('[103-3] ' + elName + ': ยาวเกินหน้า → ถูกหั่นข้ามหน้าจริง',
      pg.count > 1 && pg.pages.flatMap((p) => p.blocks).some((b) => b.split === 'tail'),
      'pages=' + pg.count);
  }
  // ★ ของสั้น (หัวฉาก/ชื่อตัวละคร/ทรานสิชั่น) ต้องไม่ถูกหั่นกลาง แม้จะเปิดอิสระให้ทุกชนิด
  const mix = [];
  for (let i = 0; i < 17; i++) mix.push({ el: 'action', text: 'บรรยาย ' + i });
  mix.push({ el: 'scene', text: 'INT. ห้องนอนของคัสซี่ที่มีหน้าต่างบานใหญ่ - กลางคืน' });
  for (let i = 0; i < 8; i++) mix.push({ el: 'action', text: 'ต่อ ' + i });
  const pmix = SF.paginate(mix, { lines: LINES });
  check('[103-3] ★ หัวฉากยังไม่ถูกหั่นกลาง (เกณฑ์ widow/orphan กันเอง)',
    !pmix.pages.flatMap((p) => p.blocks).some((b) => b.el === 'scene' && b.split));
  // ★ เกณฑ์ที่ตั้งจนหั่นไม่ได้ ก็ยังต้องไม่ปล่อยให้หน้าล้น (ด่านสุดท้าย)
  const wild = SF.paginate([{ el: 'action', text: long }],
    { lines: LINES, fmt: SF.mergeSpFormat({ rules: { minActionLinesAtTop: 999 } }) });
  check('[103-3] ★★ ตั้งเกณฑ์จนหั่นไม่ได้ ก็ยังไม่มีหน้าล้น',
    wild.pages.every((p) => p.blocks.reduce((s, b) => s + (b.lines || 0), 0) <= LINES),
    JSON.stringify(wild.pages.map((p) => p.blocks.reduce((s, b) => s + (b.lines || 0), 0))));
}

// splitText
const sp = SF.splitText('one two three four five six seven eight nine ten', 1, 2);
check('splitText: คืน head และ rest', !!sp.head && !!sp.rest);
check('splitText: รวมกันแล้วได้คำครบ',
  (sp.head + ' ' + sp.rest).split(/\s+/).length === 10, sp.head + ' || ' + sp.rest);

// ── 92 ข้อความมาตรฐาน ──
check('SP_STRINGS ครบ 4 ตัวหลัก',
  SF.SP_STRINGS.continuedBottom === '(CONTINUED)' && SF.SP_STRINGS.continuedTop === 'CONTINUED:' &&
  SF.SP_STRINGS.dialogueMore === '(MORE)' && SF.SP_STRINGS.dialogueContd === "(cont'd)");
const thStr = SF.mergeSpFormat({ strings: { dialogueMore: '(ต่อ)' } });
check('merge: ข้อความที่ผู้ใช้ตั้งชนะ', thStr.strings.dialogueMore === '(ต่อ)');
check('merge: ข้อความอื่นยังเป็นค่าเริ่มต้น', thStr.strings.continuedTop === 'CONTINUED:');
const pgTh = SF.paginate(longDlg, { lines: 14, fmt: thStr });
check('paginate ใช้ข้อความที่ผู้ใช้ตั้ง',
  pgTh.pages.flatMap((p) => p.blocks).some((b) => b.el === 'more' && b.text === '(ต่อ)'));

// ── 97 หน้ารายชื่อตัวละคร ──
const r0 = SF.newRoster();
check('newRoster: หัวเรื่องเป็น Cast of Characters', r0.title === 'Cast of Characters');
check('newRoster: แสดง Scene/Time เป็นค่าเริ่มต้น', r0.showScene === true && r0.showTime === true);
check('normalizeRoster: ข้อมูลพังกลับเป็นค่าตั้งต้น', SF.normalizeRoster(null).characters.length === 0);
check('normalizeRoster: กรองตัวละครให้เป็น {name,detail} เสมอ',
  SF.normalizeRoster({ characters: [{ name: 'A' }, 'x'] }).characters.length === 2 &&
  SF.normalizeRoster({ characters: [{ name: 'A' }] }).characters[0].detail === '');
const rTxt = SF.rosterToText({
  characters: [{ name: 'Donald Bradleyson', detail: 'นักสืบวัย 40' }, { name: 'Tora', detail: 'เจ้าของร้านเบเกอรี่' }],
  scene: 'กรุงเทพฯ ปี 2025', time: 'ฤดูฝน',
});
check('rosterToText: บรรทัดแรกเป็นหัวเรื่องจัดกลาง',
  rTxt.split('\n')[0].trim() === 'Cast of Characters' && rTxt.split('\n')[0].startsWith(' '));
check('rosterToText: ชื่อตัวละครตามด้วย :', rTxt.includes('Donald Bradleyson:'));
check('rosterToText: รายละเอียดคั่นด้วย tab', rTxt.includes('Donald Bradleyson:\tนักสืบวัย 40'));
check('rosterToText: เว้นบรรทัดระหว่างตัวละคร', /Donald Bradleyson:[^\n]*\n\nTora:/.test(rTxt));
check('rosterToText: มีหัวข้อ Scene และ Time', rTxt.includes('Scene') && rTxt.includes('Time'));
check('rosterToText: ปิด Scene แล้วไม่มีหัวข้อ Scene',
  !SF.rosterToText({ scene: 'x', showScene: false }).includes('Scene'));
check('rosterToText: ไม่มีเลขหน้า', !/^\s*\d+\s*$/m.test(rTxt));

// ═══════ alpha.57a ข้อ 2 — เลขฉาก · เลขหน้า · element ใหม่ ═══════
const F0 = SF.mergeSpFormat();
check('[57a] element ใหม่ 3 ตัวมีค่าระยะครบ',
  ['transition-in', 'subheader', 'intercut'].every((k) => F0.elements[k] && F0.elements[k].width > 0),
  Object.keys(F0.elements).join(','));
check('[57a] ทรานซิชันเข้าอยู่ซ้าย (เยื้องเท่าบรรยาย) · ออกอยู่ขวา',
  F0.elements['transition-in'].indent === F0.elements.action.indent &&
  F0.elements.transition.indent > F0.elements['transition-in'].indent);
check('[57a] วงเล็บอยู่ที่ 3.1 นิ้วจากขอบกระดาษ', F0.elements.parenthetical.indent === 3.1);
check('[57a] element ใหม่มีสไตล์จอ/พิมพ์ครบ',
  ['transition-in', 'subheader', 'intercut'].every((k) => F0.styles[k] && F0.styles[k].screen && F0.styles[k].print));

// ---- เลขฉาก: ค่าเริ่มต้นปิด · ตำแหน่ง 0.75" ซ้าย / 1" ขวา ----
check('[57a] เลขฉากปิดเป็นค่าเริ่มต้น', F0.sceneNumbers.show === false);
check('[57a] เลขฉากซ้าย 0.75" ขวา 1"',
  F0.sceneNumbers.left === 0.75 && F0.sceneNumbers.right === 1);
{
  const o = SF.sceneNumberOffsets(F0);
  // หัวฉากเริ่มที่ 1.5" → เลขซ้ายที่ 0.75" = ล้ำออกไปทางซ้าย 0.75"
  check('[57a] ระยะเลขฉากซ้าย = 0.75 - 1.5 = -0.75', o.left === -0.75, o.left);
  // กล่องหัวฉากจบที่ 1.5+6 = 7.5" · ขอบขวากระดาษ 8.5-1 = 7.5" → พอดี 0
  check('[57a] ระยะเลขฉากขวาพอดีขอบพื้นที่พิมพ์ (Letter)', o.right === 0, o.right);
  const wide = SF.mergeSpFormat({ sceneNumbers: { left: 0.5, right: 0.5 } });
  check('[57a] เปลี่ยนค่าแล้วระยะขยับตาม',
    SF.sceneNumberOffsets(wide).left === -1 && SF.sceneNumberOffsets(wide).right === -0.5);
}
{
  const css = SF.spCss(SF.mergeSpFormat());
  check('[57a] spCss สร้างกฎเลขฉากทั้งสองฝั่ง',
    css.includes('.k-scene-no-l{left:-0.75in}') && css.includes('.k-scene-no-r{right:0in}'));
  check('[57a] หัวฉากเป็น position:relative (ให้เลขฉากวางทับได้)',
    css.includes('.sp.sp-scene{position:relative}'));
  check('[57a] เลขฉากไม่โดน caps/หนาของหัวฉากกลืน',
    /\.k-scene-no\{[^}]*text-transform:none/.test(css));
}

// ---- เลขหน้า ----
check('[57a] เลขหน้าปิดเป็นค่าเริ่มต้น', F0.pageNumbers.show === false);
check('[57a] เลขหน้าชิดขวา 1" · 0.5" จากขอบบน',
  F0.pageNumbers.right === 1 && F0.pageNumbers.top === 0.5);
{
  const on = SF.mergeSpFormat({ pageNumbers: { show: true } });
  check('[57a] ปิดอยู่ → ไม่มีเลขหน้าเลย', SF.pageNumberLabel(3, F0, 1) === '');
  // ═══ [alpha.97 ข้อ 11] ★ ไม่มีสวิตช์ "ใส่เลขบนหน้าแรก" อีกแล้ว ═══
  // กฎเดียว: หน้าที่ไม่ใช่ฉากไม่มีเลข (หน้าปก/รายชื่อแยกเป็นหน้าหน้าเล่มตั้งแต่ .81r2)
  // หน้าเนื้อเรื่องจึงมีเลขทุกหน้ารวมหน้าแรก โดยไม่ต้องไปติ๊กอะไร
  check('[97-11] หน้าแรกของเนื้อเรื่องได้เลข "1." ทันทีที่เปิดเลขหน้า',
    SF.pageNumberLabel(1, on, 1) === '1.', SF.pageNumberLabel(1, on, 1));
  // ── [alpha.103 ข้อ 4] สวิตช์กลับมาแล้ว (ผู้ใช้ขอ) · ค่าเริ่มต้น = เปิด → พฤติกรรมเท่า .97 ──
  check('[103-4] ค่าเริ่มต้นมีคีย์ firstPage และเปิดไว้',
    SF.PAGE_NUMBER_DEFAULTS.firstPage === true, JSON.stringify(SF.PAGE_NUMBER_DEFAULTS));
  const noFirst = SF.mergeSpFormat({ pageNumbers: { show: true, firstPage: false } });
  check('[103-4] ปิดสวิตช์ → หน้าที่เลขจริงเป็น 1 ไม่มีเลข',
    SF.pageNumberLabel(1, noFirst, 1) === '', JSON.stringify(SF.pageNumberLabel(1, noFirst, 1)));
  check('[103-4] ปิดสวิตช์ → หน้าอื่นยังมีเลขครบ',
    SF.pageNumberLabel(2, noFirst, 1) === '2.' && SF.pageNumberLabel(3, noFirst, 1) === '3.');
  check('[103-4] ★ "หน้าแรก" = เลขจริง 1 เท่านั้น — ไฟล์ที่เริ่มหน้า 12 ยังได้เลขตามปกติ',
    SF.pageNumberLabel(1, noFirst, 12) === '12.', SF.pageNumberLabel(1, noFirst, 12));
  // กฎของ .82 ยังอยู่: ไฟล์ที่เริ่มหน้า 12 หน้าแรกของมันได้ "12."
  check('[88] ไฟล์ที่เริ่มหน้า 12 → หน้าแรกของไฟล์ยังได้ "12."',
    SF.pageNumberLabel(1, on, 12) === '12.', SF.pageNumberLabel(1, on, 12));
  check('[57a] หน้า 2 = "2."', SF.pageNumberLabel(2, on, 1) === '2.');

  // [alpha.88] บรรทัดว่างนำของแต่ละ element (ใช้ตอนกด Enter สร้าง element ถัดไป)
  check('[88] หัวฉากต้องมีบรรทัดว่างนำ 2 บรรทัด', SF.blankLinesBefore('scene') === 2,
    SF.blankLinesBefore('scene'));
  check('[88] ตัวละคร 1 บรรทัด', SF.blankLinesBefore('character') === 1,
    SF.blankLinesBefore('character'));
  check('[88] บรรยาย 1 บรรทัด', SF.blankLinesBefore('action') === 1);
  // บทพูด/วงเล็บ ต่อใต้ตัวละครทันที ห้ามมีบรรทัดว่างคั่น
  check('[88] บทพูดไม่มีบรรทัดว่างนำ', SF.blankLinesBefore('dialogue') === 0);
  check('[88] วงเล็บไม่มีบรรทัดว่างนำ', SF.blankLinesBefore('parenthetical') === 0);
  check('[88] ชนิดที่ไม่รู้จัก = 0 (ไม่พัง)', SF.blankLinesBefore('ไม่มีจริง') === 0);
  // ★ หัวใจของการแก้: "บรรทัดว่างนำ n ใบ" ต้องกินที่เท่ากับ `linesBefore` ของ element เป๊ะ
  //   ไม่งั้นการที่ Enter แทรกบรรทัดว่างให้ จะทำให้จำนวนหน้าขยับจากเดิม
  {
    const f88 = SF.mergeSpFormat({});
    const mkBlank = [], mkPad = [];
    for (let i = 0; i < 30; i++) {
      mkBlank.push({ el: 'action', text: 'บรรยาย ' + i });
      for (let k = 0; k < SF.blankLinesBefore('scene'); k++) mkBlank.push({ el: 'blank', text: '' });
      mkBlank.push({ el: 'scene', text: 'INT. ห้อง ' + i + ' - เช้า' });
      mkPad.push({ el: 'action', text: 'บรรยาย ' + i });
      mkPad.push({ el: 'scene', text: 'INT. ห้อง ' + i + ' - เช้า' });
    }
    const a88 = SF.paginate(mkBlank, { fmt: f88 }).count;
    const b88 = SF.paginate(mkPad, { fmt: f88 }).count;
    check('[88] ★ บรรทัดว่างนำ vs linesBefore → จำนวนหน้าเท่ากันเป๊ะ', a88 === b88,
      a88 + ' vs ' + b88);
  }
  check('[57a] เริ่มนับที่ 12 → หน้าที่ 2 ของไฟล์ = "13."', SF.pageNumberLabel(2, on, 12) === '13.');
  check('[57a] เปิด firstPage → หน้าแรกได้เลขเริ่มต้น',
    SF.pageNumberLabel(1, SF.mergeSpFormat({ pageNumbers: { show: true, firstPage: true } }), 7) === '7.');
  check('[57a] เปลี่ยนท้ายเลขได้',
    SF.pageNumberLabel(2, SF.mergeSpFormat({ pageNumbers: { show: true, suffix: '' } }), 1) === '2');
  check('[57a] startPage ที่ไม่ถูกต้อง → เริ่มที่ 1', SF.pageNumberLabel(2, on, 0) === '2.');
  const vars = SF.pageCssVars(on);
  check('[57a] pageCssVars มีตัวแปรตำแหน่งเลขหน้า',
    vars['--pg-no-top'] === '0.5in' && vars['--pg-no-right'] === '1in', JSON.stringify(vars));
}
check('[57a] paginate รองรับ element ใหม่ (ไม่หล่นหาย)',
  SF.paginate([{ el: 'transition-in', text: 'FADE IN:' }, { el: 'subheader', text: 'ห้องครัว' },
               { el: 'intercut', text: 'INTERCUT WITH:' }]).pages[0].blocks.length === 3);

// ═════════ [alpha.60r1] ช่องว่างเทส: ตัดบรรทัดไทย+ละตินผสม / กระดาษขนาดสุดขั้ว ═════════
{
  // wrapLines นับเป็น "จำนวนตัวอักษร" ไม่ใช่ความกว้างจริง — ไทยไม่มีช่องว่างระหว่างคำ
  // จึงถูกนับเป็นคำเดียวยาว ๆ แล้วถูกหั่นทุก cols ตัว (พฤติกรรมที่ paginate/PDF ต้องตรงกันเป๊ะ)
  const thai40 = 'ก'.repeat(40);
  // [alpha.82] **เดิมเทสสองข้อนี้ล็อกบั๊กเอาไว้** — คอมเมนต์เก่าเขียนว่า "คำแรกที่ยาวเกินบรรทัด
  // ทำให้นับเพิ่ม 1 บรรทัด (บรรทัดว่างนำหน้า) ยอมได้" · แต่ไทยไม่มีช่องว่างคั่น **ทุกย่อหน้า**
  // จึงเป็น "คำแรกที่ยาวเกินบรรทัด" เสมอ → เกินจริงย่อหน้าละ 1 บรรทัดทั้งเอกสาร
  // นั่นคือต้นตอที่หน้ากระดาษบนจอสูงไม่เท่ากันและตัดหน้าเร็วเกินจริง
  check('[wrap] ไทยล้วน 40 ตัว บนกล่อง 2 นิ้ว (20 ตัว) = 2 บรรทัดพอดี ไม่มีบรรทัดเปล่านำ',
    SF.wrapLines(thai40, 2) === 2, SF.wrapLines(thai40, 2));
  check('[wrap] ไทย 41 ตัว = ล้นไปบรรทัดที่ 3',
    SF.wrapLines(thai40 + 'ก', 2) === 3, SF.wrapLines(thai40 + 'ก', 2));
  check('[wrap] ไทยพอดีบรรทัดเดียว (20 ตัว) = 1 บรรทัด',
    SF.wrapLines('ก'.repeat(20), 2) === 1, SF.wrapLines('ก'.repeat(20), 2));
  check('[wrap] สระ/วรรณยุกต์ไม่กินความกว้าง — 20 พยัญชนะ + สระ ยังเป็น 1 บรรทัด',
    SF.wrapLines('กิ'.repeat(20), 2) === 1, SF.wrapLines('กิ'.repeat(20), 2));
  // ข้อความที่มีของอยู่บนบรรทัดแล้ว ตามด้วยไทยยาว ๆ → ไทยต้องไหลต่อจากที่ค้าง ไม่ใช่ขึ้นบรรทัดใหม่ทั้งก้อน
  // [alpha.86] ก×37 ไม่มีขอบคำของ ICU อยู่ข้างใน = "คำเดียวที่ตัดไม่ได้"
  // UAX#14 + `overflow-wrap:break-word` สั่งว่า: ยกไปขึ้นบรรทัดใหม่ก่อน ถ้ายังไม่พอค่อยหั่นกลางคำ
  // → 'ab' / ก×20 / ก×17 = 3 บรรทัด ซึ่งคือสิ่งที่ Chromium วาดจริง
  // (ของเดิมได้ 2 เพราะโมเดลถือว่าไทยตัดตรงไหนก็ได้ จึงเติมท้ายบรรทัดแรกทันที = ไม่ตรงกับจอ)
  check('[wrap] คำไทยที่ตัดไม่ได้ ต้องยกไปบรรทัดใหม่ก่อน (ตามที่เบราว์เซอร์ทำ)',
    SF.wrapLines('ab ' + 'ก'.repeat(37), 2) === 3, SF.wrapLines('ab ' + 'ก'.repeat(37), 2));
  // ไทยที่มีขอบคำจริง ต้องไหลต่อจากที่ค้างบนบรรทัดได้ตามปกติ
  check('[wrap] ไทยที่มีขอบคำ ไหลต่อจากคำที่ค้างบนบรรทัดได้',
    SF.wrapLines('ab ' + 'กินข้าวแล้วออกไปเดินเล่นที่สวนสาธารณะ', 2) <= 3,
    SF.wrapLines('ab ' + 'กินข้าวแล้วออกไปเดินเล่นที่สวนสาธารณะ', 2));
  const mixed = 'ทอร่าพูดว่า OK then she left ห้องครัวไปเงียบ ๆ';
  check('[wrap] ไทย+ละตินผสม ตัดที่ช่องว่างของฝั่งละติน',
    SF.wrapLines(mixed, 6) >= 1 && SF.wrapLines(mixed, 6) <= 2, SF.wrapLines(mixed, 6));
  check('[wrap] ไทย+ละตินผสม กล่องแคบมาก → หลายบรรทัด',
    SF.wrapLines(mixed, 1) >= 4, SF.wrapLines(mixed, 1));
  // [alpha.82] เช็คนี้เคยล็อกพฤติกรรม **ที่ผิด** ไว้ตรง ๆ ว่า "สระ/วรรณยุกต์นับเป็นตัวอักษรด้วย"
  // ซึ่งเป็นต้นตอที่ทำให้บทไทยตัดหน้าเร็วเกินจริง — วัดจากการวาดจริง (Courier Thai Mono 12pt
  // กว้าง 6") พบว่า wrapLines เดาเกินความจริง **45.8%** · `กิ่ง` = 4 code point แต่กว้างแค่ 2 ตัว
  // (`ิ` กับ `่` ซ้อนบน `ก` ไม่กินความกว้างเลย) จึงต้องเท่ากับ `x` 20 ตัว ไม่ใช่ 40
  check('[wrap] สระ/วรรณยุกต์ไม่กินความกว้าง (กิ่ง×10 = 20 ตัว ไม่ใช่ 40)',
    SF.wrapLines('กิ่ง'.repeat(10), 1) === SF.wrapLines('x'.repeat(20), 1),
    SF.wrapLines('กิ่ง'.repeat(10), 1) + ' vs ' + SF.wrapLines('x'.repeat(20), 1));
  check('[wrap] ...และต้องน้อยกว่าตอนนับทุก code point',
    SF.wrapLines('กิ่ง'.repeat(10), 1) < SF.wrapLines('x'.repeat(40), 1),
    SF.wrapLines('กิ่ง'.repeat(10), 1) + ' vs ' + SF.wrapLines('x'.repeat(40), 1));
  // splitText ต้องใช้เกณฑ์เดียวกับ wrapLines เป๊ะ ไม่งั้นหัวที่ตัดมายาวไม่ตรงกับบรรทัดที่จองไว้
  // ข้อบังคับจริงคือ "หัวที่ตัดมา n บรรทัด ต้องวัดด้วย wrapLines แล้วได้ n เป๊ะ"
  // ถ้าสองตัวนี้ใช้คนละเกณฑ์ หน้าจะจองที่ไว้ n บรรทัดแต่ข้อความจริงล้นหรือขาด
  {
    const long = 'กิ่ง '.repeat(20).trim();
    for (const n of [1, 2, 3]) {
      const h = SF.splitText(long, 1, n).head;
      check('[wrap] splitText หัว ' + n + ' บรรทัด วัดด้วย wrapLines ได้ ' + n + ' เป๊ะ',
        SF.wrapLines(h, 1) === n, SF.wrapLines(h, 1) + ' :: ' + JSON.stringify(h));
    }
  }
  check('[wrap] ข้อความว่าง = 1 บรรทัดเสมอ (ไม่ใช่ 0)', SF.wrapLines('   ', 6) === 1);
  check('[wrap] wrapLines ความกว้าง 0 ไม่พัง (อย่างน้อย 1 คอลัมน์)',
    SF.wrapLines('กขค', 0) >= 1, SF.wrapLines('กขค', 0));

  // ── กระดาษกำหนดเองขนาดสุดขั้ว ──
  const tiny = SF.mergeSpFormat({ paperSize: 'custom', paper: { width: 1, height: 1 },
                                  margins: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } });
  check('[85] กระดาษ 1×1 นิ้ว → พื้นที่พิมพ์ยังเป็นบวก', SF.textWidth(tiny.paper, tiny.margins) > 0);
  check('[85] กระดาษ 1×1 นิ้ว → บรรทัด/หน้าอย่างน้อย 1', SF.formatLines(tiny) >= 1, SF.formatLines(tiny));
  check('[85] กระดาษ 1×1 นิ้ว จัดหน้าได้ ไม่วนลูป',
    SF.paginate([{ el: 'action', text: 'ก'.repeat(200) }], { fmt: tiny }).count >= 1);
  const huge = SF.mergeSpFormat({ paperSize: 'custom', paper: { width: 40, height: 60 } });
  check('[85] กระดาษ 40×60 นิ้ว → บรรทัด/หน้าเยอะตามจริง', SF.formatLines(huge) > 300, SF.formatLines(huge));
  const bad = SF.mergeSpFormat({ paperSize: 'custom', paper: { width: 'x', height: null } });
  check('[85] ขนาดกระดาษที่กรอกผิด → ตกกลับค่ามาตรฐาน Letter',
    bad.paper.width === 8.5 && bad.paper.height === 11, JSON.stringify(bad.paper));
  const negM = SF.mergeSpFormat({ margins: { left: 99, right: 99 } });
  check('[85] ระยะขอบกว้างเกินกระดาษ → พื้นที่พิมพ์ไม่ติดลบ',
    SF.textWidth(negM.paper, negM.margins) >= 0.5, SF.textWidth(negM.paper, negM.margins));
}

// ── [alpha.61 ข้อ 4] สวิตช์ "บังคับพิมพ์ใหญ่" — ปิดที่เดียวแล้วทุกทางออกต้องตาม ──
{
  const on = SF.mergeSpFormat({});
  check('[61-4] ค่าเริ่มต้นยังบังคับพิมพ์ใหญ่ตามธรรมเนียมเดิม',
    on.forceCase === true && on.styles.scene.screen.caps === true &&
    on.styles.character.print.caps === true);
  const off = SF.mergeSpFormat({ forceCase: false });
  check('[61-4] ปิดสวิตช์ → caps เป็น false ทุก element ทั้งบนจอและตอนพิมพ์',
    SF.SP_ELEMENT_KEYS.every((k) => off.styles[k].screen.caps === false && off.styles[k].print.caps === false));
  const css = SF.spCss(off);
  check('[61-4] CSS ที่สร้างไม่มี text-transform:uppercase เหลืออยู่เลย',
    !/text-transform:uppercase/.test(css), (css.match(/text-transform:[a-z]+/g) || []).join(','));
  check('[61-4] เปิดสวิตช์แล้ว CSS กลับมามี uppercase', /text-transform:uppercase/.test(SF.spCss(on)));
  // ค่าที่ผู้ใช้ติ๊กเองต้องไม่ถูกลบทิ้ง — เปิดสวิตช์กลับต้องได้ของเดิมคืน
  const userStyles = { character: { screen: { caps: false }, print: { caps: false } } };
  const back = SF.mergeSpFormat({ forceCase: true, styles: userStyles });
  check('[61-4] เปิดสวิตช์แล้วยังเคารพ caps รายบรรทัดที่ผู้ใช้ปิดเอง',
    back.styles.character.screen.caps === false && back.styles.scene.screen.caps === true);
  check('[61-4] ปิด caps ไม่ไปแตะ bold/italic/underline',
    off.styles.scene.screen.bold === true && off.styles.parenthetical.screen.italic === true);
}

// ── [alpha.62 บั๊ก 11] ตัวพิมพ์ใหญ่รายชนิด element ──
// สวิตช์ใหญ่ (forceCase) ปิดได้แค่ "ทั้งบท" → ผู้ใช้ที่อยากให้ชื่อตัวละครตามที่พิมพ์
// แต่หัวฉากยังเป็นตัวใหญ่ ทำไม่ได้เลย · ชุดนี้คุมทางรายชนิด
{
  check('[62-11] CAPS_ELEMENTS มีเฉพาะชนิดที่ค่ามาตรฐานบังคับตัวใหญ่จริง',
    SF.CAPS_ELEMENTS.includes('scene') && SF.CAPS_ELEMENTS.includes('character')
    && SF.CAPS_ELEMENTS.includes('transition') && !SF.CAPS_ELEMENTS.includes('dialogue')
    && !SF.CAPS_ELEMENTS.includes('action'), SF.CAPS_ELEMENTS.join(','));

  const base = SF.mergeSpFormat({});
  check('[62-11] elementCaps อ่านสถานะบนจอได้', SF.elementCaps(base, 'character') === true);
  check('[62-11] elementCaps อ่านสถานะตอนพิมพ์ได้', SF.elementCaps(base, 'character', 'print') === true);
  check('[62-11] elementCaps ของชนิดที่ไม่บังคับ = false', SF.elementCaps(base, 'dialogue') === false);
  check('[62-11] elementCaps กับชนิดที่ไม่มีจริง = false ไม่โยน', SF.elementCaps(base, 'ไม่มีจริง') === false);

  // ปิดเฉพาะ "ตัวละคร" — หัวฉากต้องไม่ถูกแตะ (นี่คือสิ่งที่สวิตช์ใหญ่ทำไม่ได้)
  const src = {};
  const st1 = SF.setElementCaps(src, 'character', false);
  check('[62-11] setElementCaps ไม่แก้ของเดิม (คืน object ใหม่)', Object.keys(src).length === 0);
  const f1 = SF.mergeSpFormat({ styles: st1 });
  check('[62-11] ปิดตัวละครแล้ว ตัวละครเลิกบังคับตัวใหญ่',
    SF.elementCaps(f1, 'character') === false && SF.elementCaps(f1, 'character', 'print') === false);
  check('[62-11] แต่หัวฉากยังบังคับเหมือนเดิม', SF.elementCaps(f1, 'scene') === true);
  const css1 = SF.spCss(f1);
  // spCss ออกเป็นคลาส `.sp.sp-<element>` (ไม่ใช่ attribute selector) — ตรวจตามของจริง
  check('[62-11] CSS: ตัวละครเป็น none · หัวฉากยังเป็น uppercase',
    /\.sp\.sp-character\{[^}]*text-transform:none/.test(css1)
    && /\.sp\.sp-scene\{[^}]*text-transform:uppercase/.test(css1),
    (css1.match(/\.sp\.sp-(character|scene)\{[^}]*text-transform:[a-z]+/g) || []).join(' · '));

  // เปิดกลับได้ + ตั้งเฉพาะ screen ได้
  const st2 = SF.setElementCaps(st1, 'character', true);
  check('[62-11] เปิดกลับได้', SF.elementCaps(SF.mergeSpFormat({ styles: st2 }), 'character') === true);
  const st3 = SF.setElementCaps({}, 'scene', false, 'screen');
  const f3 = SF.mergeSpFormat({ styles: st3 });
  check('[62-11] ตั้งเฉพาะบนจอได้ — ตอนพิมพ์ยังเป็นตัวใหญ่',
    SF.elementCaps(f3, 'scene') === false && SF.elementCaps(f3, 'scene', 'print') === true);

  check('[62-11] setElementCaps กับชนิดที่ไม่มีจริง = คืนของเดิม',
    Object.keys(SF.setElementCaps({}, 'ไม่มีจริง', false)).length === 0);
  check('[62-11] ตั้ง caps ไม่ทำ bold/italic ที่ค่ามาตรฐานตั้งไว้หาย',
    SF.mergeSpFormat({ styles: SF.setElementCaps({}, 'scene', false) }).styles.scene.screen.bold === true);
  // สวิตช์ใหญ่ยังชนะเสมอ — ปิดทั้งบทแล้วค่ารายชนิดต้องถูกกลบหมด (ไม่งั้นสวิตช์ใหญ่ไม่มีความหมาย)
  check('[62-11] forceCase=false ยังกลบค่ารายชนิดทั้งหมด',
    SF.elementCaps(SF.mergeSpFormat({ forceCase: false, styles: SF.setElementCaps({}, 'scene', true) }), 'scene') === false);
}

// ═══ [alpha.87 ข้อ A] ★ บรรทัดว่างเต็มหน้าแล้วต้อง "ขึ้นหน้าใหม่" ไม่ใช่ถูกกลืนทิ้ง ═══
// อาการที่ผู้ใช้เจอ: กด Enter ค้างในบล็อกบรรยาย → หน้ากระดาษยืดยาวไปเรื่อย ๆ ไม่มีเส้นคั่นเลย
// ต้นตอ: `if (cur.length && used < perPage)` — พอหน้าเต็ม บรรทัดว่างที่เหลือไม่ถูกนับ
// ไม่ถูกเก็บ และไม่ทำให้ขึ้นหน้าใหม่ · วัดได้: ป้อน 201 บล็อก ได้ 1 หน้า และหายไป 147 ก้อน
{
  const F = SF.mergeSpFormat({});
  const perPage = SF.linesPerPage(F.paper, F.margins, SF.lineHeightIn(F));
  const blocks = [{ el: 'action', text: 'บรรยายเปิดเรื่อง' }];
  for (let i = 0; i < 200; i++) blocks.push({ el: 'blank', text: '' });
  const pg = SF.paginate(blocks, { fmt: F });
  const kept = pg.pages.reduce((n, p) => n + p.blocks.length, 0);

  check('[87-A] ★ บรรทัดว่างล้วนยังตัดหน้าให้ (ไม่ยืดเป็นแผ่นเดียว)',
    pg.pages.length >= 4, pg.pages.length + ' หน้า');
  check('[87-A] ★ ไม่มีบล็อกไหนถูกกลืนหาย', kept === blocks.length,
    kept + '/' + blocks.length);
  check('[87-A] ไม่มีหน้าไหนเกินโควตา',
    pg.pages.every((p) => p.blocks.length <= perPage),
    pg.pages.map((p) => p.blocks.length).join(','));
  check('[87-A] หน้าที่เต็มมีบรรทัดครบโควตาพอดี (ไม่ตัดเร็วเกินจริง)',
    pg.pages[0].blocks.length === perPage, pg.pages[0].blocks.length + ' vs ' + perPage);

  // บรรทัดว่างที่ต้นหน้าก็ต้องนับ — บนจอมันมีตัวตนจริง (โหนด sp สูงหนึ่งบรรทัด)
  const onlyBlank = SF.paginate(Array.from({ length: 120 }, () => ({ el: 'blank', text: '' })),
    { fmt: F });
  check('[87-A] เอกสารที่มีแต่บรรทัดว่างก็ยังแบ่งหน้า',
    onlyBlank.pages.length >= 2, onlyBlank.pages.length + ' หน้า');
  check('[87-A] บรรทัดว่างต้นหน้าไม่ถูกทิ้ง (จอกับโมเดลนับเท่ากัน)',
    onlyBlank.pages.reduce((n, p) => n + p.blocks.length, 0) === 120,
    onlyBlank.pages.map((p) => p.blocks.length).join(','));
}

// ═══ [alpha.87 ข้อ D] ★ เลขฉากต้องอยู่บรรทัดเดียวกับหัวฉากของตัวเอง ═══
// `.k-scene-no` วางแบบ absolute · `top:0` = ขอบบนของ **padding box** ซึ่งตั้งแต่ระยะเว้นบรรทัด
// ย้ายจาก margin มาเป็น padding (alpha.87 ข้อ 4) อยู่เหนือบรรทัดข้อความเท่ากับ linesBefore
// → เลขฉากไปลอยคนละบรรทัดกับหัวฉาก · ต้องเลื่อนลงมาเท่า `--k-pad` ที่กฎของบล็อกตั้งไว้
{
  const css = SF.spCss(SF.mergeSpFormat({}));
  check('[87-D] ★ กฎของบล็อกประกาศระยะเว้นนำเป็นตัวแปร --k-pad',
    /\.sp\.sp-scene\{--k-pad:\d+;/.test(css), (css.match(/\.sp\.sp-scene\{[^}]{0,40}/) || [''])[0]);
  check('[87-D] ★ เลขฉากเลื่อนลงตาม --k-pad (ไม่ใช่ top:0)',
    /\.k-scene-no\{position:absolute;top:calc\(var\(--k-pad/.test(css),
    (css.match(/\.k-scene-no\{[^}]{0,60}/) || [''])[0]);
  check('[87-D] padding-top ของบล็อกใช้ตัวแปรตัวเดียวกัน (สองที่ห้ามหลุดจากกัน)',
    /padding-top:calc\(var\(--k-pad\)/.test(css));
  // หัวฉากมี linesBefore มากกว่า 0 จริง ไม่งั้นเทสข้างบนผ่านแบบไม่มีความหมาย
  const F = SF.mergeSpFormat({});
  check('[87-D] หัวฉากมีระยะเว้นนำจริง (เทสข้างบนจึงมีความหมาย)',
    Math.round((F.elements.scene.linesBefore ?? 10) / 10) >= 1,
    String(F.elements.scene.linesBefore));
}

// ══════ [alpha.102 บั๊ก 2] ★ keepSceneWithNext — หัวเรื่องห้ามค้างท้ายหน้าตัวเดียว ══════
//
// ผู้ใช้: *"ในกรณีที่ หัวฉาก / ทรานสิชั่นขวา / ฉากย่อย / สลับฉาก / shot / ตอน / note /
//           ต่อเนื่องซ้าย / ต่อเนื่องขวา อยู่บรรทัดสุดท้าย จะไม่เกิดการตัดหน้า"*
//
// กฎนี้อยู่ในตาราง `PAGE_BREAK_RULES` มาตั้งแต่ข้อ 84 และมีช่องให้ตั้งในกล่องตั้งค่า
// แต่ `paginate()` **ไม่เคยอ่านมันเลย** — เป็นสวิตช์ที่ปรับแล้วไม่มีอะไรเกิดขึ้นมาตลอด
{
  const fmt = SF.mergeSpFormat({});
  const perPage = SF.formatLines(fmt);
  const MK = { scene: 'INT. ตลาด - เย็น', transition: 'CUT TO:', 'transition-in': 'FADE IN:',
               subheader: 'ห้องครัว', intercut: 'สลับฉาก', shot: 'ภาพระยะใกล้',
               'act-break': 'องก์สอง', note: 'โน้ต',
               'cont-left': 'ต่อเนื่องซ้าย', 'cont-right': 'ต่อเนื่องขวา' };
  check('[102-2] มี KEEP_WITH_NEXT ครบทุกชนิดที่ผู้ใช้แจ้ง',
    Object.keys(MK).every((k) => SF.KEEP_WITH_NEXT.has(k)),
    [...SF.KEEP_WITH_NEXT].join(','));
  check('[102-2] บทพูด/วงเล็บ/ชื่อตัวละคร ไม่อยู่ในชุดนี้ (มีกฎของตัวเองอยู่แล้ว)',
    !SF.KEEP_WITH_NEXT.has('dialogue') && !SF.KEEP_WITH_NEXT.has('parenthetical')
    && !SF.KEEP_WITH_NEXT.has('character'));

  // กวาดทุกชนิด × ทุกตำแหน่งใกล้ท้ายหน้า — ต้องไม่มีอันไหนค้างเป็นบล็อกสุดท้ายของหน้า
  const orphans = [];
  for (const el of Object.keys(MK)) {
    for (let fill = perPage - 6; fill <= perPage - 1; fill++) {
      const blocks = [];
      for (let i = 0; i < fill; i++) blocks.push({ el: 'action', text: 'บรรยาย ' + i });
      blocks.push({ el, text: MK[el] });
      for (let i = 0; i < 6; i++) blocks.push({ el: 'action', text: 'ต่อจากนั้น ' + i });
      const r = SF.paginate(blocks, { fmt });
      r.pages.forEach((p, pi) => {
        const last = p.blocks[p.blocks.length - 1];
        if (last && last.el === el && pi < r.pages.length - 1) orphans.push(el + '@' + fill);
      });
    }
  }
  check('[102-2] ★★ ไม่มีหัวเรื่องชนิดไหนค้างเป็นบรรทัดสุดท้ายของหน้าเลย',
    orphans.length === 0, orphans.slice(0, 8).join(' , '));

  // ★ ต้องยังไม่ล้นหน้า — กฎใหม่ห้ามไปทำให้หน้าไหนเกินโควตา
  const usedOf = (page) => {
    let used = 0, prevBlank = false;
    page.blocks.forEach((b, j) => {
      const c = fmt.elements[b.el] || fmt.elements.action;
      if (b.el === 'blank') { used += 1; prevBlank = true; return; }
      const before = j > 0 && b.split !== 'tail' && !prevBlank
        ? Math.round((c.linesBefore ?? 10) / 10) : 0;
      prevBlank = false;
      used += before + (b.lines || 1);
    });
    return used;
  };
  const over = [];
  for (const el of Object.keys(MK)) {
    for (let fill = perPage - 6; fill <= perPage - 1; fill++) {
      const blocks = [];
      for (let i = 0; i < fill; i++) blocks.push({ el: 'action', text: 'บรรยาย ' + i });
      blocks.push({ el, text: MK[el] });
      for (let i = 0; i < 6; i++) blocks.push({ el: 'action', text: 'ต่อจากนั้น ' + i });
      SF.paginate(blocks, { fmt }).pages.forEach((p, pi) => {
        if (usedOf(p) > perPage) over.push(el + '@' + fill + '=' + usedOf(p));
      });
    }
  }
  check('[102-2] ★ และไม่มีหน้าไหนล้นโควตาบรรทัด', over.length === 0, over.slice(0, 6).join(' , '));

  // ── ตัวช่วย: กวาดหาความยาว filler ที่ทำให้บล็อกนั้น "ตกเป็นบล็อกสุดท้ายของหน้าแรก" ──
  // (คำนวณด้วยมือไม่ได้ เพราะบล็อกบรรยายแต่ละก้อนกิน 1 บรรทัดเนื้อ + 1 บรรทัดเว้นนำ
  //  และหน้าแรกไม่มีเว้นนำ — กวาดหาเอาตรง ๆ ชัดกว่าและไม่พังเมื่อค่าเริ่มต้นเปลี่ยน)
  const anyFillWhereLastOnPage1 = (el, text, f, withTail) => {
    for (let fill = 1; fill < perPage; fill++) {
      const blocks = [];
      for (let i = 0; i < fill; i++) blocks.push({ el: 'action', text: 'บรรยาย ' + i });
      blocks.push({ el, text });
      if (withTail) for (let i = 0; i < 6; i++) blocks.push({ el: 'action', text: 'ต่อ ' + i });
      const r = SF.paginate(blocks, { fmt: f });
      if (r.pages.length < 2) continue;
      const last = r.pages[0].blocks[r.pages[0].blocks.length - 1];
      if (last && last.el === el) return fill;
    }
    return -1;
  };

  // ตั้งเป็น 0 = ปิดกฎ (ผู้ใช้ตั้งเองได้ที่ ตั้งค่า → หน้ากระดาษ)
  {
    const off = SF.mergeSpFormat({ rules: { keepSceneWithNext: 0 } });
    check('[102-2] ตั้งกฎเป็น 0 = ปิดได้จริง (หัวฉากค้างท้ายหน้าได้ตามเดิม)',
      anyFillWhereLastOnPage1('scene', 'INT. ตลาด - เย็น', off, true) > 0);
    check('[102-2] ★ และเปิดกฎแล้วเคสเดียวกันไม่มีทางเกิดขึ้นเลย',
      anyFillWhereLastOnPage1('scene', 'INT. ตลาด - เย็น', fmt, true) === -1);
  }

  // หัวเรื่องที่เป็น "ของชิ้นสุดท้ายจริง ๆ" ไม่ต้องยกไปหน้าใหม่ (ไม่ได้ค้างอยู่คนเดียว)
  // — `FADE OUT.` ท้ายบทเป็นเคสคลาสสิก ถ้าดันไปหน้าใหม่จะได้หน้าเปล่าทั้งหน้าเพื่อบรรทัดเดียว
  // เทียบ "เปิดกฎ" กับ "ปิดกฎ" ตรง ๆ: ไม่มีเนื้อตาม = ผลต้องเหมือนกันเป๊ะทุกความยาว
  {
    const off = SF.mergeSpFormat({ rules: { keepSceneWithNext: 0 } });
    const pagesOf = (el, text, f, withTail) => {
      const out = [];
      for (let fill = 1; fill < perPage; fill++) {
        const blocks = [];
        for (let i = 0; i < fill; i++) blocks.push({ el: 'action', text: 'บรรยาย ' + i });
        blocks.push({ el, text });
        if (withTail) for (let i = 0; i < 6; i++) blocks.push({ el: 'action', text: 'ต่อ ' + i });
        out.push(SF.paginate(blocks, { fmt: f }).pages.length);
      }
      return out.join(',');
    };
    check('[102-2] ★ ไม่มีเนื้อตาม (ปิดเรื่องท้ายบท) → กฎต้องไม่แตะอะไรเลย',
      pagesOf('transition', 'FADE OUT.', fmt, false)
      === pagesOf('transition', 'FADE OUT.', off, false),
      pagesOf('transition', 'FADE OUT.', fmt, false));
    check('[102-2] ★ หัวฉากก็เช่นกันเมื่อเป็นบล็อกสุดท้ายของเอกสาร',
      pagesOf('scene', 'INT. ตลาด - เย็น', fmt, false)
      === pagesOf('scene', 'INT. ตลาด - เย็น', off, false));
    // และต้อง "ต่างกันจริง" เมื่อมีเนื้อตาม — เอาความยาวที่ปิดกฎแล้วเกิด orphan มาเป็นตัวตั้ง
    // แล้วยืนยันว่าเปิดกฎ **หัวฉากย้ายไปเป็นบล็อกแรกของหน้าถัดไป** ไม่ใช่แค่หายไปเฉย ๆ
    // (จำนวนหน้ามักเท่าเดิม เพราะย้ายบรรทัดเดียว — เทียบจำนวนหน้าจึงพิสูจน์อะไรไม่ได้)
    {
      const fill = anyFillWhereLastOnPage1('scene', 'INT. ตลาด - เย็น', off, true);
      const blocks = [];
      for (let i = 0; i < fill; i++) blocks.push({ el: 'action', text: 'บรรยาย ' + i });
      blocks.push({ el: 'scene', text: 'INT. ตลาด - เย็น' });
      for (let i = 0; i < 6; i++) blocks.push({ el: 'action', text: 'ต่อ ' + i });
      const on = SF.paginate(blocks, { fmt });
      const p1 = on.pages[0].blocks;
      const p2 = on.pages[1] ? on.pages[1].blocks : [];
      check('[102-2] ★★ เปิดกฎแล้วหัวฉากย้ายไปเป็นบล็อกแรกของหน้าถัดไปจริง',
        fill > 0 && p1[p1.length - 1].el !== 'scene' && !!p2[0] && p2[0].el === 'scene',
        'fill=' + fill + ' · ท้ายหน้า1=' + (p1[p1.length - 1] || {}).el
        + ' · ต้นหน้า2=' + (p2[0] || {}).el);
      check('[102-2] ★ และเนื้อของฉากยังตามมาต่อทันที (ไม่ได้ขาดจากกัน)',
        !!p2[1] && p2[1].el === 'action', (p2[1] || {}).el);
    }
  }
}


// ══ [alpha.103r ข้อ 1] ★★ element ที่บังคับตัวพิมพ์ใหญ่ ต้องนับบรรทัดจาก "ตัวใหญ่" ══
// ผู้ใช้ส่งภาพ: ชื่อตัวละครยาว ๆ ไหลทะลุขอบล่างแผ่นลงไปบนพื้นโต๊ะสองบรรทัด
// ต้นตอ: caps เป็น text-transform (ตัวอักษรในไฟล์ยังเป็นตัวเล็ก) แต่ตัววัดวัดข้อความดิบ
// → ฟอนต์สัดส่วนวาดตัวใหญ่กว้างกว่า จอจึงตัดบรรทัดมากกว่าที่โมเดลนับ = หน้าล้น
{
  check('[103r-1] มี displayText ให้ใช้ร่วมกันทั้งจอ/PDF', typeof SF.displayText === 'function');
  check('[103r-1] caps=false → ข้อความเดิม', SF.displayText('abc', false) === 'abc');
  check('[103r-1] caps=true → ตัวใหญ่', SF.displayText('abc', true) === 'ABC');
  // ตัวที่ยาวขึ้นตอนแปลง (ß→SS) ต้องถอยไปใช้ของเดิม ไม่งั้นดัชนีที่ใช้หั่นจะเลื่อน
  check('[103r-1] ★ ตัวอักษรที่ยาวขึ้นตอนแปลง → ใช้ของเดิม (ดัชนีหั่นต้องไม่เลื่อน)',
        SF.displayText('straße', true) === 'straße', SF.displayText('straße', true));

  // ★ ตัววัดของ node เป็นแบบ cpi (ตัวอักษรเท่ากันทุกตัว) จึงพิสูจน์ "ความกว้างต่างกัน" ไม่ได้
  //   สิ่งที่พิสูจน์ได้ที่นี่คือ **เส้นทางส่งค่า**: paginate ต้องส่ง caps ของ element เข้าไปจริง
  //   (ตัวเลขความกว้างจริงถูกวัดใน e2e ที่มีฟอนต์จริง)
  const capsOn = SF.mergeSpFormat({});
  check('[103r-1] ชื่อตัวละคร/หัวฉาก/ทรานซิชัน = ตัวพิมพ์ใหญ่ตามค่ามาตรฐาน',
        SF.elementCaps(capsOn, 'character') && SF.elementCaps(capsOn, 'scene')
        && SF.elementCaps(capsOn, 'transition'));
  check('[103r-1] บทพูด/บรรยาย ไม่ใช่ตัวพิมพ์ใหญ่',
        !SF.elementCaps(capsOn, 'dialogue') && !SF.elementCaps(capsOn, 'action'));
  // ★ พิสูจน์ว่า "ข้อความที่ตาเห็น" เดินไปถึงตัวตัดบรรทัดจริง — บรรทัดที่คืนมาต้องเป็นตัวใหญ่
  const ls = SF.wrapScriptLines('abc def ghi', 3.8, 10, true);
  check('[103r-1] ★★ wrapScriptLines(caps=true) ตัดบรรทัดจากตัวใหญ่จริง',
        ls.join('') === ls.join('').toUpperCase() && /[A-Z]/.test(ls.join('')), JSON.stringify(ls));
  const ls0 = SF.wrapScriptLines('abc def ghi', 3.8, 10, false);
  check('[103r-1] ★ caps=false ยังได้ตัวเล็กเหมือนเดิม', !/[A-Z]/.test(ls0.join('')), JSON.stringify(ls0));
  // splitText ต้องคืนชิ้นส่วนของ "ข้อความต้นฉบับ" (ตัวเล็ก) แม้จะวัดจากตัวใหญ่
  const sp2 = SF.splitText('one two three four five six seven eight nine ten', 1, 2, true);
  check('[103r-1] ★★ splitText หั่นจากข้อความต้นฉบับ (ไม่คืนตัวใหญ่ออกมา)',
        !/[A-Z]/.test(sp2.head + sp2.rest), sp2.head + ' || ' + sp2.rest);
  check('[103r-1] ★ และรวมกันแล้วยังได้คำครบ',
        (sp2.head + ' ' + sp2.rest).split(/\s+/).length === 10, sp2.head + ' || ' + sp2.rest);
}

// ───────── [alpha.125 ข้อ J] (CONTINUED) บนหน้าที่ยังไม่มีหัวฉาก ─────────
{
  // หน้าจำลอง: ฉาก 0 = "ยังไม่มีหัวฉาก" · บล็อกแรกของหน้าถัดไปเป็นท่อนหางที่ถูกหั่นมา
  const mkPages = () => ([
    { sceneStart: 0, sceneEnd: 0, blocks: [{ el: 'action', text: 'a' }] },
    { sceneStart: 0, sceneEnd: 0, blocks: [{ el: 'action', text: 'b', contIn: true }] },
  ]);
  const off = SF.annotateContinued(mkPages(), SF.mergeSpFormat({}));
  check('[J] ค่าเริ่มต้น: หน้าที่ไม่มีหัวฉากยังไม่ขึ้น CONTINUED (พฤติกรรมเดิม)',
     !off[0].continuedBottom && !off[1].continuedTop,
     JSON.stringify([off[0].continuedBottom, off[1].continuedTop]));

  const on = SF.annotateContinued(mkPages(), SF.mergeSpFormat({ continued: { noHeading: true } }));
  check('[J] ★ เปิดสวิตช์แล้วขึ้น CONTINUED ได้แม้ไม่มีหัวฉาก',
     !!on[0].continuedBottom && !!on[1].continuedTop,
     JSON.stringify([on[0].continuedBottom, on[1].continuedTop]));

  // เงื่อนไขอื่นต้องยังเข้มเท่าเดิม: ไม่มีบล็อกถูกหั่นคร่อมรอยต่อ = ไม่ขึ้น
  const noSplit = SF.annotateContinued([
    { sceneStart: 0, sceneEnd: 0, blocks: [{ el: 'action', text: 'a' }] },
    { sceneStart: 0, sceneEnd: 0, blocks: [{ el: 'action', text: 'b' }] },
  ], SF.mergeSpFormat({ continued: { noHeading: true } }));
  check('[J] เปิดสวิตช์แล้วก็ยังต้องมีบล็อกถูกหั่นคร่อมหน้าจริง',
     !noSplit[0].continuedBottom, JSON.stringify(noSplit[0].continuedBottom));

  // รอยต่อของบทพูด ใช้ (MORE)/(CONT'D) อยู่แล้ว — ห้ามใส่ CONTINUED ซ้ำ
  const dlg = SF.annotateContinued([
    { sceneStart: 0, sceneEnd: 0, blocks: [{ el: 'dialogue', text: 'a', more: true }] },
    { sceneStart: 0, sceneEnd: 0, blocks: [{ el: 'dialogue', text: 'b', contd: true }] },
  ], SF.mergeSpFormat({ continued: { noHeading: true } }));
  check('[J] รอยต่อบทพูดยังไม่ซ้อน CONTINUED', !dlg[0].continuedBottom);

  check('[J] ค่าเริ่มต้นของ noHeading เป็น false', SF.CONTINUED_DEFAULTS.noHeading === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.unlinkSync(tmp); } catch {}
if (fail) process.exit(1);
