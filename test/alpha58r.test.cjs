// test/alpha58r.test.cjs — บั๊กรอบ alpha.58r ที่แก้ในโมดูลบริสุทธิ์
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
//   5+9  linesPerPage/pageMetrics ต้องนับ spLineHeight ที่ผู้ใช้ตั้ง
//   10   spCss ต้องสร้างกฎ .sp-contd
//   12   "จำคำนี้" (pinned) ต้องชนะตัวกรอง looksLikeTerm
//   13   มีพรีเซ็ตบทภาพยนตร์ที่เปิด sp-continued
//   19   mdToHtml ใช้รูปแบบนิยายที่ส่งเข้าไป
//   25   md: จัดหน้าเก็บใน frontmatter ได้ (.md สะอาด)
//   27   md: เส้นคั่น (hr) + บล็อกโค้ด round-trip
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(rel, name) {
  const tmp = path.join(os.tmpdir(), 'k2-58r-' + name + '.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', rel)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const F = load('sp-format.js', 'spformat');
const V = load('sp-view.js', 'spview');
const S = load('smart-terms.js', 'smart');
const C = load('compile.js', 'compile');
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ═══ [5] linesPerPage / paginate ต้องรู้จัก lineHeight ═══
const L = { width: 8.5, height: 11 };
const M = { top: 1, bottom: 1, left: 1.5, right: 1 };
check('[5] มาตรฐาน Letter = 54 บรรทัด/หน้า', F.linesPerPage(L, M) === 54);
check('[5] clampLineHeight: ค่าปกติ', F.clampLineHeight(1.2) === 1.2);
check('[5] clampLineHeight: นอกช่วง → 1', F.clampLineHeight(9) === 1 && F.clampLineHeight(0.1) === 1);
check('[5] clampLineHeight: ไม่ใช่ตัวเลข → 1', F.clampLineHeight('x') === 1);

const f1 = F.mergeSpFormat({});
const f12 = F.mergeSpFormat({ lineHeight: 1.2 });
const f15 = F.mergeSpFormat({ lineHeight: 1.5 });
check('[5] mergeSpFormat เก็บ lineHeight', f12.lineHeight === 1.2);
check('[5] lineHeightIn คูณตาม', Math.abs(F.lineHeightIn(f12) - (1 / 6) * 1.2) < 1e-9);
check('[5] formatLines มาตรฐาน = 54', F.formatLines(f1) === 54, String(F.formatLines(f1)));
check('[5] lineHeight 1.2 → บรรทัด/หน้าน้อยลง', F.formatLines(f12) === 45, String(F.formatLines(f12)));
check('[5] lineHeight 1.5 → 36 บรรทัด/หน้า', F.formatLines(f15) === 36, String(F.formatLines(f15)));

const blocks = [];
for (let i = 0; i < 300; i++) blocks.push({ el: 'action', text: 'บรรยายฉากทดสอบบรรทัดที่ ' + i });
const p1 = F.paginate(blocks, { fmt: f1 });
const p15 = F.paginate(blocks, { fmt: f15 });
check('[5] paginate ใช้ lineHeight จริง (หน้าเยอะขึ้น)', p15.count > p1.count,
      `${p1.count} → ${p15.count}`);
check('[5] pageCount ตามไปด้วย', F.pageCount(blocks, { fmt: f15 }) === p15.count);
check('[5] ส่ง lines มาเองยังชนะ', F.paginate(blocks, { fmt: f15, lines: 54 }).count === p1.count);

// ═══ [9] pageMetrics / layoutCssVars ═══
const m1 = V.pageMetrics(f1);
const m15 = V.pageMetrics(f15);
check('[9] มาตรฐาน: 54 บรรทัด · บรรทัดละ 16px', m1.linesPerPage === 54 && m1.lineHeightPx === 16);
check('[9] เนื้อหน้า 864px', m1.bodyHeightPx === 864);
check('[9] lineHeight 1.5 → บรรทัดละ 24px', m15.lineHeightPx === 24, String(m15.lineHeightPx));
check('[9] lineHeight 1.5 → 36 บรรทัด/หน้า', m15.linesPerPage === 36);
check('[9] ความสูงเนื้อหน้าเป็นขนาดจริงเสมอ (ไม่ขึ้นกับช่วงบรรทัด)', m15.bodyHeightPx === 864);
check('[9] pageMetrics คืน lineHeight ที่ใช้จริง', m15.lineHeight === 1.5);
const lv = V.layoutCssVars(f15, 28);
check('[9] --sp-line-h ตามช่วงบรรทัดจริง', lv['--sp-line-h'] === '24px', lv['--sp-line-h']);
check('[9] --sp-body-h ยังเป็นความสูงจริง', lv['--sp-body-h'] === '864px');

// ═══ [10] spCss สร้างกฎ .sp-contd ═══
const css = F.spCss(f1);
check('[10] มีกฎ .sp-contd', /\.sp\.sp-contd|\.sp-cont-mark\.sp-contd/.test(css), css.slice(0, 100));
// [alpha.84 ข้อ 2] สูตรมี var(--k-ct-off) พ่วงมาด้วย (ระยะชดเชยตอนถูกวาดในบล็อก · ปกติ = 0)
check('[10] .sp-contd เยื้องแนวเดียวกับชื่อตัวละคร (3.7-1.5 = 2.2in)',
  /sp-contd[^}]*margin-left:calc\(2\.2in \+ var\(--k-ct-off, 0in\)\)/.test(css));
const css2 = F.spCss(F.mergeSpFormat({ elements: { character: { indent: 4 } } }));
check('[10] เปลี่ยนระยะเยื้องตัวละคร → .sp-contd ขยับตาม',
  /sp-contd[^}]*margin-left:calc\(2\.5in \+ var\(--k-ct-off, 0in\)\)/.test(css2));
check('[10] .sp-contd/.sp-more มีช่องชดเชยตอนถูกวาดในบล็อก (--k-ct-off)',
  /sp-more\{margin-left:calc\([^)]*\+ var\(--k-ct-off, 0in\)\)/.test(css) &&
  css.includes('.sp-continued-top,.sp-cont-top{margin-left:var(--k-ct-off, 0in)'));
check('[10] ยังมีกฎ .sp-more เหมือนเดิม', css.includes('.sp.sp-more{'));

// ═══ [alpha.84 ข้อ 2] pageStartPositions / pageStartMarks คิด cut ด้วย ═══
{
  const fmt84 = F.mergeSpFormat({});
  const long84 = Array.from({ length: 140 }, (_, i) => 'บทพูดยาวมากบรรทัดที่' + i + ' ').join('');
  let at84 = 0;
  const mk84 = (el, text) => { const b = { el, text, pos: at84 }; at84 += text.length + 2; return b; };
  const bl84 = [mk84('scene', 'INT. ROOM - DAY'), mk84('character', 'TORA'), mk84('dialogue', long84)];
  const dlgPos84 = bl84[2].pos;
  const pg84 = V.pagesOf(bl84, fmt84);
  const st84 = V.pageStartPositions(pg84);
  check('[84-2] หน้าแรกยังเริ่มที่ 0', st84[0] === 0, String(st84[0]));
  check('[84-2] หน้าถัดไปไม่ใช่หัวบล็อกบทพูดอีกแล้ว', st84[1] !== dlgPos84,
    `${st84[1]} vs ${dlgPos84}`);
  check('[84-2] หน้าถัดไป = ตำแหน่งในเนื้อข้อความของบล็อกเดิม', st84[1] > dlgPos84);
  const mks84 = V.pageStartMarks(pg84, fmt84);
  check('[84-2] pageStartMarks บอกทั้งตำแหน่ง/กลางบล็อก/ระยะเยื้อง',
    mks84[1].pos === st84[1] && mks84[1].mid === true && mks84[1].indent === 1,
    JSON.stringify(mks84[1]));
  check('[84-2] หน้าแรกไม่ใช่รอยตัดกลางบล็อก', mks84[0].mid === false && mks84[0].indent === 0);
  check('[84-2] pageFirstBlock ข้ามบล็อกสังเคราะห์ที่ไม่มี pos',
    V.pageFirstBlock({ blocks: [{ el: 'more', text: '(MORE)' }, { el: 'action', pos: 9 }] }).pos === 9);
}

// ═══ [12] pinned ชนะ looksLikeTerm ═══
const counts = new Map([['ก่้อน', 1], ['ทอร่า', 3], ['พมิมพ์', 1]]);
const noPin = S.learnedTerms(counts, { min: 2 });
check('[12] ไม่ pin: คำมั่วตกหมด', !noPin.includes('ก่้อน') && !noPin.includes('พมิมพ์'));
check('[12] ไม่ pin: ชื่อจริงยังผ่าน', noPin.includes('ทอร่า'));
const pinned = S.learnedTerms(counts, { min: 2, pinned: ['ก่้อน'] });
check('[12] pin แล้วคำที่ตกด่านตัวอักษรกลับมาได้', pinned.includes('ก่้อน'), JSON.stringify(pinned));
check('[12] ignore ยังชนะ pin ไม่ได้ (ignore มาก่อน)',
  !S.learnedTerms(counts, { min: 2, pinned: ['ทอร่า'], ignored: ['ทอร่า'] }).includes('ทอร่า'));
check('[12] คำที่เจอครั้งเดียวแต่มีใน Wiki ยังผ่าน',
  S.learnedTerms(new Map([['แคสซี่', 1]]), { min: 2, known: ['แคสซี่'] }).includes('แคสซี่'));

// ═══ [13] พรีเซ็ตบทภาพยนตร์ ═══
const sp = C.PRESETS.find((p) => p.id === 'screenplay');
check('[13] มีพรีเซ็ต screenplay', !!sp);
check('[13] เปิด sp-continued ให้เลย',
  !!sp && sp.steps.some((s) => s.key === 'sp-continued' && s.on !== false));
check('[13] พรีเซ็ตนิยายไม่เปิด',
  C.PRESETS.filter((p) => p.id !== 'screenplay')
    .every((p) => !p.steps.some((s) => s.key === 'sp-continued' && s.on !== false)));

// ═══ [19] mdToHtml ใช้รูปแบบนิยายที่ส่งเข้าไป ═══
const html = C.mdToHtml('# หัวข้อ\n\nย่อหน้า', 'เรื่องทดสอบ');
check('[19] ไม่มีขนาด 18px ฝังตายแล้ว', !html.includes('font-size:18px'));
check('[19] ใช้ pt ตามรูปแบบนิยาย', html.includes('font-size:12pt'));
const html2 = C.mdToHtml('ย่อหน้า', 'x', { fontPt: 20, lineHeight: 2.5, fontFamily: 'Georgia, serif' });
check('[19] ส่ง style เข้าไปแล้วเปลี่ยนจริง',
  html2.includes('font-size:20pt') && html2.includes('line-height:2.5') && html2.includes('Georgia, serif'));
check('[19] เนื้อ HTML ยังถูกต้อง', html.includes('<h1>หัวข้อ</h1>'));

// ═══ [25] จัดหน้าไป frontmatter ═══
const doc = MD.mdToDoc('<!--align:center-->กลางหน้า\nปกติ');
check('[25] ยังอ่าน <!--align--> แบบเดิมได้', doc.content[0].attrs.align === 'center');
check('[25] collectAlign ได้แผนที่', JSON.stringify(MD.collectAlign(doc)) === '{"0":"center"}');
check('[25] alignToString', MD.alignToString({ 0: 'center', 3: 'right' }) === '0:center, 3:right');
check('[25] alignFromString (string)',
  JSON.stringify(MD.alignFromString('0:center, 3:right')) === '{"0":"center","3":"right"}');
check('[25] alignFromString (array จาก frontmatter)',
  JSON.stringify(MD.alignFromString(['2:justify'])) === '{"2":"justify"}');
check('[25] ค่าขยะไม่พัง', JSON.stringify(MD.alignFromString('xyz')) === '{}');
const clean = MD.docToMd(doc, { alignComments: false });
check('[25] docToMd แบบสะอาด — ไม่มีคอมเมนต์ใน .md', !clean.includes('<!--align'), clean);
check('[25] เนื้อหายังครบ', clean === 'กลางหน้า\nปกติ');
const back = MD.mdToDoc(clean, { 0: 'center' });
check('[25] ใส่ align กลับจาก frontmatter ได้', back.content[0].attrs.align === 'center');
check('[25] แบบเดิมยังใช้ได้ถ้าอยากได้',
  MD.docToMd(doc).includes('<!--align:center-->'));
check('[25] ไม่มี align → ไม่มีอะไรใน map',
  JSON.stringify(MD.collectAlign(MD.mdToDoc('ธรรมดา'))) === '{}');

// ═══ [27] hr + code_block ═══
const d2 = MD.mdToDoc('ก่อน\n---\nหลัง');
check('[27] --- → horizontal_rule', d2.content[1].type === 'horizontal_rule');
check('[27] hr round-trip', MD.docToMd(d2) === 'ก่อน\n---\nหลัง');
const d3 = MD.mdToDoc('```js\nlet a = 1;\nlet b = 2;\n```');
check('[27] ``` → code_block', d3.content[0].type === 'code_block');
check('[27] เก็บภาษาไว้', d3.content[0].attrs.lang === 'js');
check('[27] เนื้อโค้ดครบทุกบรรทัด',
  d3.content[0].content[0].text === 'let a = 1;\nlet b = 2;');
check('[27] code_block round-trip',
  MD.docToMd(d3) === '```js\nlet a = 1;\nlet b = 2;\n```', JSON.stringify(MD.docToMd(d3)));
check('[27] code_block ไม่มีภาษา ก็ได้',
  MD.mdToDoc('```\nx\n```').content[0].attrs.lang === '');
check('[27] เครื่องหมาย markdown ในโค้ดไม่ถูกตีความ',
  MD.mdToDoc('```\n**ไม่หนา**\n```').content[0].content[0].text === '**ไม่หนา**');
check('[27] *** ยังเป็นเส้นคั่น', MD.mdToDoc('***').content[0].type === 'horizontal_rule');
check('[27] ข้อความปกติไม่กลายเป็น hr', MD.mdToDoc('-- สอง').content[0].type === 'paragraph');

console.log(`\nalpha58r: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
