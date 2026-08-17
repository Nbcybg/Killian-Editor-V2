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
check('paginate: ฉากเดียวข้ามหน้า → ท้ายหน้ามี (CONTINUED)',
  pgS.pages[0].continuedBottom === '(CONTINUED)', pgS.pages[0].continuedBottom);
check('paginate: ฉากเดียวข้ามหน้า → ต้นหน้า 2 มี CONTINUED:',
  pgS.pages[1].continuedTop === 'CONTINUED:', pgS.pages[1].continuedTop);
check('paginate: ข้ามหน้าที่สามขึ้นไปใส่เลขกำกับ',
  pgS.count < 3 || pgS.pages[2].continuedTop === 'CONTINUED: (2)', pgS.pages[2] && pgS.pages[2].continuedTop);
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
const pgOff = SF.paginate(sceneLong, { lines: 20, fmt: SF.mergeSpFormat({ continued: { enabled: false } }) });
check('paginate: ปิดระบบต่อเนื่อง → ไม่มี CONTINUED เลย',
  pgOff.pages.every((p) => !p.continuedTop && !p.continuedBottom));
check('paginate: บทว่าง → 1 หน้า', SF.paginate([]).count === 1);
check('pageCount ตรงกับ paginate().count', SF.pageCount(many, { lines: 20 }) === pg.count);

// บทพูดยาวข้ามหน้า → ต้องมี (MORE) + ทวนชื่อ + (cont'd)
const longDlg = [
  { el: 'action', text: 'x '.repeat(30) },
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'คำพูดยาวมาก '.repeat(40) },
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

// กฎที่ตั้งเองมีผลจริง
const strict = SF.paginate(longDlg, { lines: 14, fmt: SF.mergeSpFormat({ rules: { minDialogueLinesAtBottom: 99 } }) });
check('paginate: ตั้ง minDialogueLinesAtBottom สูง → ไม่แบ่งบทพูด',
  !strict.pages.flatMap((p) => p.blocks).some((b) => b.split === 'head'));

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
  check('[57a] หน้าแรกไม่ใส่เลข (ธรรมเนียมบท)', SF.pageNumberLabel(1, on, 1) === '');
  check('[57a] หน้า 2 = "2."', SF.pageNumberLabel(2, on, 1) === '2.');
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
  // ข้อควรรู้: "คำแรกที่ยาวเกินบรรทัด" ทำให้ wrapLines นับเพิ่ม 1 บรรทัด (บรรทัดว่างนำหน้า)
  // ยอมได้ — ดีกว่าข้อความล้นขอบล่าง · pdf-generator.wrapTextLines มิเรอร์พฤติกรรมนี้เป๊ะ
  check('[wrap] ไทยล้วน 40 ตัว บนกล่อง 2 นิ้ว (20 ตัว) = 2 บรรทัดจริง + 1 บรรทัดนำ',
    SF.wrapLines(thai40, 2) === 3, SF.wrapLines(thai40, 2));
  check('[wrap] ไทย 41 ตัว = เพิ่มอีกบรรทัด',
    SF.wrapLines(thai40 + 'ก', 2) === 4, SF.wrapLines(thai40 + 'ก', 2));
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

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.unlinkSync(tmp); } catch {}
if (fail) process.exit(1);
