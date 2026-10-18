// test/bug-hunt5.test.cjs — [alpha.170 · bug hunt 5] ของที่เจอจากการ "ลองใช้โปรแกรมจริง" ก่อน release
//
// ที่มา: สร้างผลงานจากเทมเพลตนิยาย → เขียนสองฉาก → ส่งออกทุกปลายทางแล้วเปิดไฟล์อ่าน
//   · PDF ของนิยายไม่มีชื่อบท ไม่มีตัวคั่นฉาก (พรีเซ็ต ext=pdf มีตัวเดียว = ของบทภาพยนตร์)
//   · ตัวคั่นฉาก `* * *` กลายเป็น "จุดนำเปล่า" ใน HTML / EPUB / DOCX / RTF (`* ` = ข้อในรายการ)
//   · ชื่อไฟล์ส่งออก "เงาจันทร์: ภาค 1?" ได้ "เงาจันทร์_ ภาค 1_"
//   · Enter ในช่องค้นหา (Ctrl+F) ลบคำที่เจอ — ตัวจับไม่กัน default แล้วย้ายโฟกัสไปเอกสารกลางการกดปุ่ม
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name.replace(/[\\/]/g, '-') + '-bh5-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const C = load('compile');
const RTF = load('export-rtf');
const XF = load('export-formats');
const PF = load('prose-format');
const N = load('export-name');
const MD = require('../src/md.js');
const src = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ═════════ PDF ของนิยาย ═════════
{
  const wP = XF.defaultWorkflowFor('pdf', undefined, 'prose');
  const keys = (wP.steps || []).filter((s) => s.on !== false).map((s) => s.key);
  check('[pdf] ★ นิยาย → PDF ได้พรีเซ็ตของนิยาย (ไม่ใช่ของบทภาพยนตร์)', wP.id === 'prose-pdf', wP.id);
  check('[pdf] ★ พรีเซ็ตนั้นมีชื่อบท + ตัวคั่นฉาก', keys.includes('chapter-heading') && keys.includes('scene-separator'), keys.join(','));
  check('[pdf] บทภาพยนตร์ / ไม่ระบุชนิด: ทางเดิม', XF.defaultWorkflowFor('pdf', undefined, 'screenplay').id === 'screenplay-pdf'
        && XF.defaultWorkflowFor('pdf').id === 'screenplay-pdf');
  const model = { title: 'เรื่อง', author: '', chapters: [{ title: 'บทที่หนึ่ง', scenes: [
    { title: 'ก', body: 'ฉากแรก', format: 'prose', type: 'scene' },
    { title: 'ข', body: 'ฉากสอง', format: 'prose', type: 'scene' }] }] };
  const r = C.runWorkflow(model, wP, {});
  check('[pdf] ★ ผลของเวิร์กโฟลว์มีชื่อบทและตัวคั่นฉาก', /บทที่หนึ่ง/.test(r.text) && /\* \* \*/.test(r.text), r.text);
}

// ═════════ ตัวคั่นฉาก `* * *` ═════════
{
  const md = 'ฉากแรก\n\n* * *\n\nฉากสอง';
  const bl = MD.mdBlocks(md);
  const hr = bl.find((b) => b.kind === 'hr');
  check('[sep] ★ mdBlocks: `* * *` = เส้นคั่นที่พาข้อความไปด้วย ไม่ใช่ข้อในรายการ',
        !!hr && hr.text === '* * *' && !bl.some((b) => b.kind === 'li'), JSON.stringify(bl));
  check('[sep] `---` ยังเป็นเส้นคั่นธรรมดา (ไม่มีข้อความ)', MD.mdBlocks('a\n\n---\n\nb').some((b) => b.kind === 'hr' && !b.text));
  check('[sep] `* ข้อ` ยังเป็นรายการตามเดิม', MD.mdBlocks('* ข้อหนึ่ง\n* ข้อสอง').filter((b) => b.kind === 'li').length === 2);
  const html = C.mdToHtmlBody(md);
  check('[sep] ★ HTML: ดาวกึ่งกลาง ไม่มี <ul>/<em>', /k-scene-break[^>]*>\* \* \*<\/p>/.test(html) && !/<ul|<em/.test(html), html);
  check('[sep] ★ ข้อความล้วน: ดาวยังอยู่', /\* \* \*/.test(C.stripMarkdown(md)), C.stripMarkdown(md));
  const rtf = RTF.generateProseRtf(md, {});
  check('[sep] ★ RTF: จัดกึ่งกลาง ไม่มีจุดนำ', /\\qc[^\n]*\* \* \*/.test(rtf) && !/\\bullet/.test(rtf), rtf.slice(-300));
  const pb = PF.mdToProseBlocks(md);
  const mid = pb.find((b) => b.text === '* * *');
  check('[sep] ★ ช่องตัวอย่าง: ย่อหน้ากึ่งกลาง (ตรงกับไฟล์จริง)', !!mid && mid.type === 'p' && mid.align === 'center' && !pb.some((b) => b.type === 'li'),
        JSON.stringify(pb));
  check('[sep] ตัวสร้าง EPUB/DOCX วาดดาวกึ่งกลางเมื่อเส้นคั่นมีข้อความ',
        /case 'hr': cur\.parts\.push\(b\.text \?/.test(src('src/export-ebook.js')) && /case 'hr': if \(b\.text\)/.test(src('src/export-ebook.js')));
}

// ═════════ รอบสอง: เลขหน้าของ PDF นิยาย · แผงเปิดครั้งแรก = ผนึก · ถ้อยคำ ═════════
{
  check('[pdf] ★ เลขหน้าของนิยายไม่ใช่ฟอนต์พิมพ์ดีด: มีเชิง = serif · ไม่มีเชิง = sans · ตั้งใจใช้พิมพ์ดีด = ทางเดิม',
        XF.proseNumberFont('"EB Garamond", "K2 Lang", serif') === 'serif' && XF.proseNumberFont('Sarabun, sans-serif') === 'sans'
        && XF.proseNumberFont('"Courier Prime", monospace') === '' && XF.proseNumberFont('') === 'serif');
  const gen = src('src/pdf-generator.js');
  check('[pdf] ตัวประทับเลขหน้ารับ numberFont แล้วใช้ฟอนต์มาตรฐานของ PDF เฉพาะป้าย ASCII',
        /o\.numberFont === 'sans' \? StandardFonts\.Helvetica : StandardFonts\.TimesRoman/.test(gen) && /std && \/\^\[\\x20-\\x7e\]\+\$\/\.test\(label\)/.test(gen));
  const hub = src('src/export-hub.js');
  check('[pdf] หน้าปกของนิยายใช้ฟอนต์ที่เนื้อเรื่องใช้อยู่จริง', /body\{font-family:\$\{withThaiFallback\(liveProseFonts\(\)\.fontStack \|\|/.test(hub));
  check('[hub] ส่งออกแล้วกล่องไม่ปิดเอง + บอกผลในกล่อง', /warnLbl\.classList\.add\('xhub-done'\)/.test(hub)
        && !/await saveCfg\(\);\s*\n\s*close\(\);/.test(hub));
  check('[hub] นิยาย: "หน้ารายชื่อตัวละคร" เห็นเฉพาะเมื่อเล่มมีรายชื่อ · "หัวกระดาษ" เป็นของบท',
        /if \(kind0 !== 'prose' \|\| hasRoster\) mk\('roster'/.test(hub) && /if \(kind0 !== 'prose'\) mk\('headers'/.test(hub));
  const pui = src('src/panels/panel-ui.js');
  check('[panel] ★★ เปิดแผงครั้งแรกจากเมนู/ปุ่ม = ผนึก (firstDockPlan) · เคยลอย = ลอยที่เดิม · ไม่มีที่ = ลอย',
        /const plan = firstDockPlan\(m, pid\);\s*\n\s*if \(!plan\) return showPanel\(pid, \{ prefer: 'float'/.test(pui)
        && /if \(home && \(home\.float \|\| home\.floatWith\)\) return showPanel\(pid, \{ prefer: 'float'/.test(pui));
  check('[panel] ผนึกครั้งแรกเอาที่จากพื้นที่เขียนเท่านั้น (เหลือ ≥ MIN_CANVAS_PX)', /getBoundingClientRect\(\)\.width\) - PL\.MIN_CANVAS_PX/.test(pui));
  const langs = fs.readdirSync(path.join(__dirname, '..', 'languages')).filter((x) => /^k2_.*\.csv$/.test(x));
  const bad = [];
  for (const f of langs) for (const line of src('languages/' + f).split('\n')) {
    if (/^ui\.tip\.toggle-panel:floorplan,/.test(line) && /Shot Designer/i.test(line)) bad.push(f + ': floorplan');
    if (/^ui\.settings\.spellCheckDictHint,/.test(line) && /Chromium/i.test(line)) bad.push(f + ': spell');
    if (/^ui\.app\.versionEditF,/.test(line) && /\{0\}/.test(line)) bad.push(f + ': version');
  }
  check('[text] ★ คำอธิบายแผงผังพื้นที่ไม่อ้างชื่อโปรแกรมอื่น · คำอธิบายตรวจคำผิดไม่เอ่ยชื่อเทคโนโลยี · แผงคุณสมบัติไม่โชว์เลขรุ่นโปรแกรม (ทุกภาษา)',
        bad.length === 0, bad.join(' | '));
}

// ═════════ ชื่อไฟล์ส่งออก ═════════
{
  check('[name] ★ อักขระต้องห้ามที่ติดวรรค/ท้ายชื่อ ไม่ทิ้งรอย "_"', N.sanitizeFileBase('เงาจันทร์: ภาค 1?') === 'เงาจันทร์ ภาค 1',
        N.sanitizeFileBase('เงาจันทร์: ภาค 1?'));
  check('[name] อักขระต้องห้ามระหว่างตัวอักษรยังเป็น "_"', N.sanitizeFileBase('a/b') === 'a_b');
  check('[name] "_" ที่ผู้ใช้พิมพ์เองไม่ถูกแตะ', N.sanitizeFileBase('ร่าง_ ที่ 2_') === 'ร่าง_ ที่ 2_', N.sanitizeFileBase('ร่าง_ ที่ 2_'));
}

// ═════════ กันย้อนกลับ (อ่านซอร์ส) ═════════
{
  const app = src('src/app.js');
  const findQ = app.slice(app.indexOf("$('#find-q').addEventListener('keydown'"), app.indexOf("$('#find-next').onclick"));
  check('[find] ★★ Enter ในช่องค้นหา: กัน default + ไม่ย้ายโฟกัสไปเอกสาร (เคยลบคำที่เจอทิ้ง)',
        /e\.key === 'Enter'\) \{ e\.preventDefault\(\)/.test(findQ) && /focus: false/.test(app.slice(app.indexOf('const findStep'), app.indexOf('const findStep') + 200)),
        findQ.slice(0, 200));
  check('[find] ช่อง "แทนที่" มี Enter/Esc ของตัวเอง', /\$\('#find-r'\)\.addEventListener\('keydown'/.test(app));
  check('[find] gotoMatch รับ focus:false', /opts\.focus !== false\) view\.focus\(\)/.test(src('src/search.js')));
  check('[search] ★ เปิดแผงค้นหาทั้งโปรเจกต์แล้วยืนที่ช่องคำค้น', /case 'global-search':[\s\S]{0,400}focusSearchPanel/.test(app)
        && /export function focusSearchPanel/.test(src('src/global-search.js')));
  const wiki = src('src/wiki-ui.js');
  check('[wiki] ★ เพิ่ม/ทำสำเนา/เปลี่ยนชื่อเอนทิตี้ → ผ่าน reloadWikiNames (ไฮไลต์ชื่อ + ดัชนีฉากที่กล่าวถึง)',
        (wiki.match(/reloadWikiNames\(\)/g) || []).length >= 3 && !/smart\.loadNames\(state\.root\);\s*\n\s*refreshNetwork/.test(wiki));
  check('[wiki] reloadWikiNames รีเฟรชไฮไลต์ทุกแท็บ + ล้างดัชนี', /export async function reloadWikiNames\(\) \{[\s\S]{0,200}refreshAllMentions\(\);\s*resetAutoLink\(\);/.test(app));
  const css = src('renderer/style.css');
  check('[menu] ★ เมนูคลิกขวาเจาะ no-drag (ทับแถบชื่อหน้าต่างแล้วยังกดได้)', /\.k-menu, \.k-menu \* \{ -webkit-app-region:no-drag; \}/.test(css));
  check('[dlg] ปุ่มลบของกล่องยืนยัน: ตัวหนังสือไม่ถูกย้อมแดงบนพื้นแดง', /\.k-ok\.k-danger \{ background:[^;]+; color:#fff !important; \}/.test(css));
  const home = src('src/home-ui.js');
  check('[home] ★ ช่องค้นหายืมที่ของปุ่มส่งออก/นำเข้า (แถวไม่พับ — ปุ่มออกจากโปรแกรมไม่เลื่อนมาใต้เมาส์)',
        /exportBtn\.style\.display = importBtn\.style\.display = on \? 'none' : ''/.test(home));
  check('[home] หน้าแรกปิดเมื่อเปิดผลงานได้จริงเท่านั้น', /await newProject\(\);\s*\n\s*if \(state\.root && state\.root !== before\) opts\.onClose/.test(home)
        && /if \(state\.root === projectPath\) opts\.onClose/.test(home));
  check('[tip] ทูลทิปไม่เด้งกลับหลังกดปุ่มจนกว่าเมาส์จะออก', /_tipDismissed && \(host === _tipDismissed/.test(app));
  const dlg = src('src/dialogs.js');
  check('[settings] ค้นหาในตั้งค่าค้นถึงเนื้อของหน้า', /pg \? pg\.textContent : ''/.test(dlg));
  check('[lang] เริ่มใหม่หลังเปลี่ยนภาษา = กลับมาที่ผลงานเดิม', /sessionStorage\.setItem\('k2-reopen'/.test(dlg) && /sessionStorage\.getItem\('k2-reopen'\)/.test(app));
}

// ═════════ ค้นหาทั้งโปรเจกต์: โฟลเดอร์จุดนำไม่ใช่งานเขียน · ทางไฟล์ในผลค้นหา ═════════
(async () => {
  const SE = load('search-engine');
  const root = '/p';
  check('[search] ★ ไฟล์ใต้ .k2history ไม่ทำให้ดัชนีล้าง (ไม่ใช่งานเขียน)',
        SE.searchPathMatters(root, '/p/.k2history/blobs/a.md') === false && SE.searchPathMatters(root, '/p/Book 1/Draft/default/Chapters/c/a.md') === true);
  // ระบบไฟล์จำลอง: ฉากจริงหนึ่งไฟล์ + สำเนาใน .k2history
  const tree = { '/p': { dirs: ['.k2history', 'Book 1', 'Recycle'], files: [] },
                 '/p/.k2history': { dirs: ['blobs'], files: [] }, '/p/.k2history/blobs': { dirs: [], files: ['old.md'] },
                 '/p/Book 1': { dirs: [], files: ['real.md'] }, '/p/Recycle': { dirs: [], files: ['gone.md'] } };
  const kapi = { listDirs: async (d) => (tree[d] || { dirs: [] }).dirs, listFiles: async (d) => (tree[d] || { files: [] }).files,
                 join: async (...a) => a.join('/'), readFile: async () => 'มีนา' };
  const idx = await SE.indexProject(root, kapi, (raw) => ({ meta: {}, body: raw }), { skipDirs: SE.SEARCH_SKIP_DIRS });
  const files = [...idx.docs.keys()].map(String);
  check('[search] ★ ดัชนีมีแต่ฉากจริง — ไม่มีสำเนาจาก .k2history / Recycle',
        files.length === 1 && /real\.md$/.test(files[0]), JSON.stringify(files));
  // ★ ชื่อไทยที่ตัวตัดคำหั่นกลางคำ ("มีนาหยุดเดิน" → มี|นา|หยุด|เดิน) ต้องค้นเจอ
  const ix = new SE.SearchIndex().build([
    { id: 'a', title: 'ฉากหนึ่ง', body: 'คืนนั้นฝนตก\nมีนาหยุดเดิน มือกำสายกระเป๋าแน่น' },
    { id: 'b', title: 'ฉากสอง', body: '“มีนา” เขาเรียก' },
    { id: 'c', title: 'ฉากสาม', body: 'ไม่มีใครอยู่ที่นั่น the category list' }]);
  const hs = ix.search('มีนา');
  const ha = hs.find((h) => h.id === 'a');
  check('[search] ★★ ค้นชื่อตัวละครเจอทุกฉาก แม้ชื่อเขียนติดกับคำถัดไป',
        hs.length === 2 && !!ha && ha.freq === 1 && ha.matches.length === 1 && ha.matches[0].line === 2 && /มีนาหยุดเดิน/.test(ha.matches[0].snippet),
        JSON.stringify(hs));
  check('[search] ภาษาที่เว้นวรรคระหว่างคำยังเทียบทั้งคำ ("cat" ไม่เจอ "category")', ix.search('cat').length === 0 && ix.search('category').length === 1);
  const gs = src('src/global-search.js');
  check('[search] ★ ทางไฟล์ในผลค้นหาคิดแบบ sync (เดิมขึ้น "[object Promise]")',
        /relToProject\(state\.root, h\.file\)/.test(gs) && !/String\(rel\)/.test(gs));
  finish();
})();

// ═════════ ชื่อธีมไม่อ้างชื่อแบรนด์ (ผู้ใช้สั่งถอดก่อน release) ═════════
{
  const BRANDS = /Claude|opencode|Kimi|VS ?Code|\bWord\b|Excel|PowerPoint|Macintosh|Gundam|กันดั้ม|ガンダム|高达|D\.Va|Mobile Suit|モビルスーツ|โมบิลสูท/i;
  const bad = [];
  const tj = JSON.parse(src('renderer/themes/themes.json'));
  for (const t of (tj.themes || [])) for (const v of Object.values(t.name || {})) if (BRANDS.test(v)) bad.push('themes.json:' + v);
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'languages')).filter((x) => /^k2_.*\.csv$/.test(x))) {
    for (const line of src('languages/' + f).split('\n')) {
      if (line.startsWith('ui.themes.') && BRANDS.test(line.slice(line.indexOf(',') + 1))) bad.push(f + ':' + line);
    }
  }
  check('[theme] ★ ชื่อธีมทุกภาษาไม่มีชื่อแบรนด์/เครื่องหมายการค้า', bad.length === 0, bad.join(' | '));
}

// ── [รอบต่อ 7] ผู้ใช้: "ก็ต้องใช้ บทภาพยนตร์ สิ" — คำว่า "บท" เดี่ยว ๆ เป็นของ chapter เท่านั้น ──
{
  const main = src('main.js');
  check('[บทภาพยนตร์] ★ เมนูระบบใช้คีย์ของตัวเอง (เดิมยืม ui.common.chapter → ภาษาอื่นขึ้น "Chapter")',
    /id: 'Script', label: tt\('ui\.menu\.script'\)/.test(main) && !/id: 'Script', label: tt\('ui\.common\.chapter'\)/.test(main));
  const th = src('languages/k2_th.csv');
  const val = (k) => { const m = th.match(new RegExp('^' + k.replace(/[.:]/g, '\\$&') + ',(.*)$', 'm')); return m ? m[1] : null; };
  check('[บทภาพยนตร์] ชื่อเมนู = "บทภาพยนตร์" · chapter ยังเป็น "บท"', val('ui.menu.script') === 'บทภาพยนตร์' && val('ui.common.chapter') === 'บท');
  check('[บทภาพยนตร์] ไม่มีคำเรียกที่สอง ("บทหนัง") ในไฟล์ภาษาไทย', !th.includes('บทหนัง'));
  check('[บทภาพยนตร์] หน้าตั้งค่า "รูปแบบบทภาพยนตร์" · ข้อความที่ชี้ทางบอกชื่อเมนูใหม่',
    val('ui.setTpl.formatChapter') === 'รูปแบบบทภาพยนตร์' && /เมนู บทภาพยนตร์ →/.test(val('ui.pdf.cantSetCoverChapter') || '') && !/(เมนู|ที่) บท →/.test(th));
  const txt = src('tools/docs-appendix-text.cjs');
  check('[บทภาพยนตร์] ตัวสร้างภาคผนวกไม่ต้องแก้ชื่อเมนูให้อีก', !/menuRename: \{ Chapter/.test(txt));
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
