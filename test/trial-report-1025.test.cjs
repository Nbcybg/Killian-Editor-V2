// test/trial-report-1025.test.cjs — ประตูกันพลาดของ TRIAL-REPORT-2026-10-25.md (ลองใช้แบบผู้ใช้ใหม่บนแอปจริง)
//
// ทุกข้อในรายงานเป็นของที่ e2e มองไม่เห็น (กล่องอยู่ใต้หน้าแรก · ชื่อตัวละครหลุดนอกกระดาษ · ไฟล์ DOCX ที่ไม่มีใครเปิดอ่าน …)
// ไฟล์นี้ตรึง "ตรรกะ" ของแต่ละข้อที่เทสได้ด้วย node + กฎ CSS/ซอร์สที่ต้องไม่ย้อนกลับ
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name.replace(/[\\/]/g, '-') + '-trial1025-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const src = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const css = src('renderer/style.css');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── ข้อ 1 · หน้าแรกไม่บังกล่องที่เปิดจากตัวเอง ─────────
{
  const home = src('src/home-ui.js');
  check('[1] ★ หน้าแรกไม่ตั้ง z-index 90 ตายตัว (กล่องเลือกแบบตั้งต้น/ถามชื่อเคยอยู่ใต้หน้าแรก)', !/zIndex\s*=\s*'9\d'/.test(home));
  check('[1] .k-overlay ทุกใบอยู่ชั้นเดียวกัน (80) — ลำดับใน DOM ตัดสินใบบน', /\.k-overlay \{ position:fixed; inset:0;[^}]*z-index:80/.test(css));
}

// ───────── ข้อ 2 · ชื่อในหน้ารายชื่อตัวละคร ─────────
check('[2] ★ .roster-name ไม่รับ text-indent ติดลบของแถว', /\.roster-name \{[^}]*text-indent:0/.test(css));

// ───────── ข้อ 3 · สารานุกรมในแผงแคบ ─────────
{
  const m = /@container codex \(max-width: 700px\) \{([\s\S]*?)\n\}/.exec(css);
  const q = m ? m[1] : '';
  check('[3] ★ แผงแคบ: แถวของกริดสูงเท่าเนื้อ (max-content) ไม่ถูกบีบจนทับกัน', /grid-auto-rows:max-content/.test(q), q.slice(0, 120));
  check('[3] คอลัมน์ซ้ายไม่หดต่ำกว่าเนื้อ', /\.k-codex-left \{[^}]*min-height:auto/.test(q));
  check('[24] ไม่มีเอนทิตี = บอกที่เดียว (กรอบภาพใหญ่ซ่อน)', /hero\.hidden = !e;/.test(src('src/codex/codex-ui.js')));
}

// ───────── ข้อ 4 · ชนิดของฉากใหม่ ─────────
{
  const F = load('scene-format-default');
  check('[4] ★ บทที่มีแต่บทภาพยนตร์ → ฉากใหม่เป็นบทภาพยนตร์', F.defaultSceneFormat(['screenplay', 'screenplay'], '') === 'screenplay');
  check('[4] ★ บทว่างในโปรเจกต์เทมเพลตบทภาพยนตร์ → บทภาพยนตร์', F.defaultSceneFormat([], 'screenplay') === 'screenplay');
  check('[4] บทว่างในโปรเจกต์นิยาย → นิยาย', F.defaultSceneFormat([], 'novel') === 'prose' && F.defaultSceneFormat([], undefined) === 'prose');
  check('[4] บทที่ปนสองชนิด → ตามเทมเพลต (ไม่เดาจากฉากล่าสุด)',
        F.defaultSceneFormat(['prose', 'screenplay'], '') === 'prose' && F.defaultSceneFormat(['prose', 'screenplay'], 'screenplay') === 'screenplay');
  check('[4] บทนิยายล้วนในโปรเจกต์บทภาพยนตร์ → นิยาย (ผู้ใช้สลับบทนี้เอง)', F.defaultSceneFormat(['prose'], 'screenplay') === 'prose');
  check('[4] addScene ไม่เขียน format: prose ตายตัวแล้ว', !/format: 'prose', pov: '', tags: \[\], \.\.\.\(opts\.meta/.test(src('src/scene-ops.js')));
}

// ───────── ข้อ 5 · DOCX ของบทภาพยนตร์ ─────────
{
  const D = load('export-sp-docx');
  const blocks = [
    { el: 'scene', text: 'INT. ห้องเบรีฟ - กลางคืน' }, { el: 'action', text: 'นักบินนั่งเงียบ' },
    { el: 'character', text: 'กัปตันเอก' }, { el: 'parenthetical', text: '(กระซิบ)' },
    { el: 'dialogue', text: 'เราบินคืนนี้' }, { el: 'transition', text: 'CUT TO:' },
  ];
  const pkg = D.buildScreenplayDocx(blocks, { title: 'ทดสอบ', fontPt: 12, pageNumbers: true, suffix: '.', firstPageNumber: false,
    titlePages: [{ strings: [{ text: 'ชื่อเรื่อง', x: 1.5, y: 4, align: 'center' }] }] });
  const doc = pkg.files.find((f) => f.path === 'word/document.xml').data;
  const sty = pkg.files.find((f) => f.path === 'word/styles.xml').data;
  check('[5] ★ ฟอนต์บทเป็น Courier Prime + อักษรไทยมีฟอนต์ไทยในช่อง cs', /w:ascii="Courier Prime"/.test(sty) && /w:cs="Tahoma"/.test(sty), sty.slice(0, 300));
  // ชื่อตัวละคร 3.7" จากขอบกระดาษ − ขอบซ้าย 1.5" = 2.2" = 3168 twips · บทพูด 2.5 − 1.5 = 1" = 1440
  check('[5] ★ ชื่อตัวละครเยื้อง 2.2 นิ้วจากขอบพื้นที่พิมพ์', /SPcharacter"\/>[\s\S]*?w:left="3168"/.test(doc));
  check('[5] ★ บทพูดเยื้อง 1 นิ้ว', /SPdialogue"\/>[\s\S]*?w:left="1440"/.test(doc));
  check('[5] ชื่อตัวละครพิมพ์ใหญ่ตามรูปแบบบท + ไม่ใช่ Heading', !/Heading/.test(doc) && doc.includes('กัปตันเอก'));
  check('[5] ทรานซิชันชิดขวา', /SPtransition"\/>[\s\S]*?<w:jc w:val="right"\/>/.test(doc));
  check('[5] ★ มีเลขหน้า (ฟิลด์ PAGE + จุดท้ายเลข) ในหัวกระดาษ', pkg.files.some((f) => f.path === 'word/header1.xml' && /PAGE/.test(f.data) && /<w:t xml:space="preserve">\.<\/w:t>/.test(f.data)));
  check('[5] ไม่พิมพ์เลขบนหน้าแรก = titlePg + หัวกระดาษหน้าแรกว่าง', /<w:titlePg\/>/.test(doc) && pkg.files.some((f) => f.path === 'word/header2.xml' && !/PAGE/.test(f.data)));
  check('[5] หน้าปกอยู่ section ของตัวเอง (ไม่มีเลขหน้า) แล้วเนื้อบทเริ่มเลข 1', (doc.match(/<w:sectPr>/g) || []).length === 2 && /<w:pgNumType w:start="1"\/>/.test(doc));
  const P = D.spParaProps('scene', null, 12);
  check('[5] หัวฉากเว้นนำ 2 บรรทัด + ติดกับย่อหน้าถัดไป', P.before === 480 && P.keepNext === true && P.caps === true);
  check('[5] ศูนย์ส่งออก: DOCX ของบทภาพยนตร์ผ่านตัวสร้างบท', /spDocx = cfg\.format === 'docx' && kind === 'screenplay'/.test(src('src/export-hub.js')));
}

// ───────── ข้อ 6 · ปก/หน้าชื่อเรื่องของนิยาย ─────────
{
  const X = load('export-formats');
  check('[6ก] ★ สองเล่ม: ปกมีบรรทัดบอกเล่ม', X.coverBookLine('เล่ม 2', 'คาเฟ่', 2) === 'เล่ม 2');
  check('[6ก] เล่มที่ชื่อขึ้นต้นด้วยชื่อเรื่อง = ตัดส่วนที่ซ้ำ', X.coverBookLine('คาเฟ่ เล่มที่ 1 กาแฟแก้วแรก', 'คาเฟ่', 2) === 'เล่มที่ 1 กาแฟแก้วแรก');
  check('[6ก] เล่มเดียวชื่อตั้งต้น Book 1 = ไม่มีบรรทัดเล่ม', X.coverBookLine('Book 1', 'คาเฟ่', 1) === '');
  check('[6ก] ชื่อเล่มเท่าชื่อเรื่อง = ไม่ซ้ำ', X.coverBookLine('คาเฟ่', 'คาเฟ่', 3) === '');
  const hub = src('src/export-hub.js');
  check('[6ข] ★ PDF/DOCX ของนิยายใช้หน้าปกที่ผู้ใช้แต่งเอง (titlePages ของโปรเจกต์)', /function proseFront\(cfg, built\)/.test(hub) && /k-front-tp/.test(hub));
  check('[6ค] ★ ใช้ภาพเต็มหน้า = หน้าไม่มีระยะขอบ (named page k-bleed)', /@page k-bleed\{margin:0\}/.test(hub) && /k-cover-bleed\{display:block;width:100%;height:100%;object-fit:cover\}/.test(hub));
  check('[6ค] ปกอ่าน coverFull/coverOn จาก section.json (ตัวเดียวกับโหมดอ่าน)', /export async function sectionCoverInfo/.test(src('src/app.js')) && /normBookCover\(await kapi\.readJson\(sf\)\)/.test(src('src/app.js')));
  check('[6ง] ★ DOCX ของนิยายมีหน้าหน้าเล่ม', /const fm = opts\.front \|\| null;/.test(src('src/export-ebook.js')) && /common\.front = \{/.test(hub));
  check('[6ข] กล่องหน้าปกของนิยายตั้งต้นเขียน "โดย"', /ui\.spTitlePages\.byNovel/.test(src('src/pdf-ui.js')));
}

// ───────── ข้อ 7 · ชื่อต้นที่ชื่อเรียกนำหน้า ─────────
{
  const W = load('wiki-names');
  check('[7] ★ "ลลิตา วงศ์ปัญญา" + ชื่อเรียก "ลลิ" → นับ "ลลิตา" ด้วย', JSON.stringify(W.impliedNames('ลลิตา วงศ์ปัญญา', ['ลลิ', 'นักแผนที่น้อย'])) === '["ลลิตา"]');
  check('[7] นามสกุลไม่ถูกเพิ่ม (ไม่มีชื่อเรียกนำหน้า)', !W.impliedNames('ลลิตา วงศ์ปัญญา', ['ลลิ']).includes('วงศ์ปัญญา'));
  check('[7] ชื่อคำเดียว = ไม่มีของเพิ่ม', W.impliedNames('ปู่เมฆ', ['ปู่']).length === 0);
  check('[7] ไม่มีชื่อเรียก = ไม่เดา', W.impliedNames('กวิน ศรีเมฆา', []).length === 0);
  check('[7] smart.loadNames ใช้ impliedNames', /impliedNames\(e\.name, extra\)/.test(src('src/smart.js')));
}

// ───────── ข้อ 8 · ซูมพอดีความกว้าง / ค่าระดับผู้ใช้ในโปรเจกต์ใหม่ ─────────
{
  check('[8] ★ ผู้ใช้ใหม่จริง: เปิดซูมพอดีความกว้างคู่กับโหมดเรียบง่าย', /simpleMode: true, simpleLayoutPending: true, autoFitWidth: true/.test(src('src/app.js')));
  check('[8] ★ โปรเจกต์ใหม่จากเทมเพลตเก็บเฉพาะค่าของผลงาน (ค่าระดับผู้ใช้ไม่ถูกแช่เป็นค่าตั้งต้น)', /settings: \{ \.\.\.PROJECT_DEFAULTS/.test(src('src/project.js')));
  check('[18] นิยายในหน้าจอภาษาไทย = A4', /format !== 'screenplay' && i18n\.lang === 'th' \? \{ paperSize: 'a4' \}/.test(src('src/project.js')));
}

// ───────── ข้อ 9 · เปลี่ยนชื่อเล่ม/บท ─────────
{
  const app = src('src/app.js');
  check('[9] ★ ปิดแท็บทั้งชุดไม่กระโดดไปแท็บที่กำลังจะปิดต่อ', /closeTab\(t2\.file, \{ discard: true, skip: going \}\)/.test(app));
  check('[9] เปิดแท็บกลับแล้วคืนลำดับเดิมบนแถบ', /reorderTabs\(order0\.map/.test(app));
  check('[9] ทางเก่าระหว่างย้าย = debug ไม่ใช่ warn', /ENOENT\/\.test\(String\(\(e && e\.message\) \|\| e\)\) \? 'debug' : 'warn', 'sceneCtx failed'/.test(app));
  const C = load('comments/comment-core');
  const io = { files: { '/a.md': 'x' }, reads: 0,
    exists(p) { return p in this.files; }, readFile(p) { this.reads++; if (!(p in this.files)) throw new Error('ENOENT'); return this.files[p]; },
    writeFile(p, t) { this.files[p] = t; } };
  (async () => {
    await C.writeMdKeepingComments(io, '/new.md', 'เนื้อ');
    check('[9] ★ ไฟล์ใหม่: ไม่อ่านไฟล์ที่ยังไม่มี (ENOENT หนึ่งบรรทัดต่อฉากใหม่)', io.reads === 0 && io.files['/new.md'] === 'เนื้อ', io.reads);
  })().catch((e) => check('[9] writeMdKeepingComments ไฟล์ใหม่', false, e.message));
}

// ───────── ข้อ 10 · ปิดโปรเจกต์ล้างแถบที่อยู่/คุณสมบัติ ─────────
check('[10] ปิดโปรเจกต์ = วาดแถบที่อยู่ + แผงคุณสมบัติใหม่', /try \{ renderCrumbs\(\)\.catch\(\(\) => \{\}\); \} catch \{\}\n  try \{ syncPropsToActive\(\)/.test(src('src/app.js')));

// ───────── ข้อ 11 · ผู้ให้บริการ AI ของฉัน ─────────
{
  const pu = src('src/ai/ai-provider-ui.js');
  check('[11] ★ โปรเจกต์ที่ยังไม่มีผู้ให้บริการ = รับชุด "ของฉัน" ให้เอง', /async function adoptMyDefaults\(\)/.test(pu) && /if \(!p && await adoptMyDefaults\(\)\)/.test(pu));
  check('[11] รับครั้งเดียวต่อโปรเจกต์ + ไม่ทับผู้ให้บริการที่ผู้ใช้ตั้งเอง', /_adopted\.has\(root\)/.test(pu) && /if \(listProviders\(aiMeta\(\)\)\.length\) return false;/.test(pu));
  check('[11] ★ แชท: ยังไม่ได้ตั้งค่า = บอกในช่องแชท + ปุ่มไปตั้งค่า', /function showNoProvider\(ta\)/.test(src('src/ai/ai-chat-panel.js')));
}

// ───────── ข้อ 12 · ชื่อ header ที่เซิร์ฟเวอร์ขอ ─────────
{
  const E = load('ai/ai-error');
  check('[12] ★ ถอดชื่อ header จากข้อความเซิร์ฟเวอร์', E.headerNameOf('MissingSessionID: missing header x-opencode-session') === 'x-opencode-session');
  check('[12] ไม่มีชื่อ = ว่าง', E.headerNameOf('bad request') === '');
  const info = E.describeHttpError({ status: 400, body: JSON.stringify({ error: { message: 'Missing required header x-opencode-session' } }) });
  check('[12] ★ เหตุผลบอกชื่อ header', info.reason.includes('x-opencode-session') && info.hints[0].includes('x-opencode-session'), info.reason);
  check('[12] ปุ่มทดสอบโชว์ข้อความของเซิร์ฟเวอร์', /r\.chat\.serverMessage \? ' · ' \+ t\('ui\.aiError\.reply'\)/.test(src('src/ai/ai-provider-ui.js')));
}

// ───────── ข้อ 13 · โหมดสีของ PDF ─────────
{
  const X = load('export-formats');
  check('[13] ★ ค่าตั้งต้น auto: นิยายสี · บทภาพยนตร์ขาวดำ', X.pdfColorMode({ colorMode: 'auto' }, 'prose') === 'color' && X.pdfColorMode({ colorMode: 'auto' }, 'screenplay') === 'mono');
  check('[13] ผู้ใช้เลือกเอง = ตามที่เลือก', X.pdfColorMode({ colorMode: 'mono' }, 'prose') === 'mono' && X.pdfColorMode({ colorMode: 'color' }, 'screenplay') === 'color');
  check('[13] ไม่มีค่า = auto', X.pdfColorMode({}, 'prose') === 'color' && X.normalizeHub({}).pdf.colorMode === 'auto');
}

// ───────── ข้อ 14 · หัวข้อไม่ค้างท้ายหน้าใน PDF ─────────
{
  const PF = load('prose-format');
  check('[14] ★ CSS ส่งออก: หัวข้อ break-after:avoid (คู่แฝดของ keepNext ในตัวจัดหน้า)', /h1,h2,h3,h4,h5,h6\{break-after:avoid;page-break-after:avoid/.test(PF.proseExportCss(null, null, null)));
}

// ───────── ข้อ 15 · ตัวตรวจบทภาพยนตร์ ─────────
{
  const V = load('sp-validator');
  const B = (el, text) => ({ el, text });
  const long = 'นักบินเดินเข้ามาในห้องเบรีฟที่มืดสลัว แสงจากจอเรดาร์ส่องหน้าเขาเป็นสีเขียว เขาวางหมวกบนโต๊ะแล้วมองแผนที่เส้นทางบิน';
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - คืน'), B('action', long)]);
  check('[15] ★ ย่อหน้าบรรยายปกติ (สองบรรทัด) ไม่ถูกเตือนว่ายาวเกิน', !e.some((x) => x.type === V.SP_ERRORS.OVERLONG_LINE), long.length);
  check('[15] หัวฉากยังเป็นบรรทัดเดียว (70)', V.DEFAULT_LIMITS.scene === 70 && V.DEFAULT_LIMITS.action >= 200);
}

// ───────── ข้อ 16 · กล่องหน้าปกไม่ขยับ ─────────
check('[16] ★ คอลัมน์ของกล่องหน้าปกสูงคงที่', /\.k-tp-pages, \.k-tp-props \{ height:62vh; max-height:62vh;/.test(css));

// ───────── ข้อ 17 · แม่แบบไทยล้วน ─────────
{
  const tpl = JSON.parse(src('renderer/templates.json'));
  const mixed = [];
  for (const t of tpl.templates) {
    for (const s of t.sections || []) if (/ \/ [A-Za-z]/.test(s.title)) mixed.push(t.name + ': ' + s.title);
    for (const f of [...(t.fields || []), ...(t.customPropertyDefs || [])]) for (const o of f.options || []) if (/^[\x20-\x7e]+$/.test(o)) mixed.push(t.name + ': ' + o);
  }
  check('[17] ★ templates.json ไม่มีหัวข้อ/ตัวเลือกภาษาอังกฤษปน', !mixed.length, mixed.join(' | '));
  check('[17] หน้า Wiki โชว์ป้ายของช่องข้อมูลเพิ่ม (ไม่ใช่คีย์อังกฤษ)', /customPropertyDefs \|\| \[\]\) if \(!\(f\.key in map\)\)/.test(src('src/app.js')) && /linkedField\(\(this\.labels && this\.labels\[k\]\) \|\| k/.test(src('src/wiki.js')));
}

// ───────── ข้อ 18 · หน้ารายชื่อตัวละครตามภาษา ─────────
{
  const SF = load('sp-format');
  check('[18] ★ หัวข้อ Cast of Characters/Scene/Time มาจากไฟล์ภาษา', SF.SP_STRINGS.castTitle === 'รายชื่อตัวละคร' && SF.SP_STRINGS.sceneTitle === 'ฉาก' && SF.SP_STRINGS.timeTitle === 'เวลา',
        [SF.SP_STRINGS.castTitle, SF.SP_STRINGS.sceneTitle, SF.SP_STRINGS.timeTitle].join('|'));
  check('[18] CONTINUED/MORE ยังเป็นอังกฤษตามธรรมเนียมบท', SF.SP_STRINGS.continuedBottom === '(CONTINUED)');
}

// ───────── ข้อ 19 · ชื่อไฟล์ส่งออก ─────────
{
  const X = load('export-formats');
  check('[19] ★ ส่งออกฉากที่เปิด = [title] เป็นชื่อฉาก', X.exportNameFields('tab', { title: 'โรงเตี๊ยมริมท่า', project: 'ตำนาน' }).title === 'โรงเตี๊ยมริมท่า');
  check('[19] ★ ทั้งเล่มในโปรเจกต์หลายเล่ม = ชื่อเล่ม', X.exportNameFields('draft', { title: 'คาเฟ่', project: 'คาเฟ่', book: 'เล่มที่ 2', books: 2 }).title === 'เล่มที่ 2');
  check('[19] เล่มเดียว = ชื่อโปรเจกต์ (เหมือนเดิม)', X.exportNameFields('draft', { title: 'คาเฟ่', project: 'คาเฟ่', book: 'Book 1', books: 1 }).title === 'คาเฟ่');
}

// ───────── ข้อ 20 · ฟอนต์ไทยของ Word ─────────
{
  const L = load('live-fonts');
  check('[20] ★ สแตกที่ไม่มีฟอนต์ไทยที่ผู้ใช้เลือก = Tahoma (มีทั้ง Windows/macOS)', L.thaiFontOf('"EB Garamond", Georgia, serif, "Thonburi", "Leelawadee UI"') === 'Tahoma');
  check('[20] ฟอนต์ไทยที่ผู้ใช้เลือกเองชนะ', L.thaiFontOf('"Sarabun", serif') === 'Sarabun');
  check('[20] DOCX ของนิยายใส่ฟอนต์ไทยที่ช่อง w:cs', /w:cs="\$\{csFont\}"/.test(src('src/export-ebook.js')));
}

// ───────── ข้อ 21 · แถบค้นหาลอย ─────────
check('[21] ★ แถบค้นหาลอย (ไม่ดันเลย์เอาต์ลง)', /#findbar \{[^}]*position:fixed;/.test(css));

// ───────── ข้อ 22 · เลือกหลายรูป/ไม่ซ้ำ ─────────
{
  check('[22] ★ กล่องเลือกรูปหลายไฟล์', /H\('dialog:openImages'[\s\S]*?multiSelections[\s\S]*?r\.filePaths;/.test(src('main.js')) && /openImagesDialog: call\('dialog:openImages'\)/.test(src('preload.js')));
  const AC = load('gallery/album-core');
  const files = { '/p/Images/a.png': new Uint8Array([1, 2, 3]), '/src/a.png': new Uint8Array([1, 2, 3]), '/src2/a.png': new Uint8Array([9, 9]) };
  let copied = 0;
  const api = {
    join: (...p) => p.join('/').replace(/\/+/g, '/'), mkdir: async () => {}, exists: async (p) => p in files,
    readBytes: async (p) => files[p], readFile: async (p) => { if (!(p in files)) throw new Error('ENOENT'); return typeof files[p] === 'string' ? files[p] : ''; },
    writeFile: async (p, t) => { files[p] = t; },
    copyInto: async (s, d) => { copied++; const b = s.split('/').pop().replace(/\.png$/, ''); const n = b + '-' + copied + '.png'; files[d + '/' + n] = files[s]; return n; },
    listFiles: async () => [], listDirs: async () => [],
  };
  (async () => {
    const n1 = await AC.addImageFile(api, '/p', AC.ROOT_ALBUM, '/src/a.png');
    check('[22] ★ เพิ่มรูปเดิม (ไบต์ตรงกัน) ซ้ำ = ใช้ไฟล์เดิม ไม่ได้ a-1.png', n1 === 'a.png' && copied === 0, n1 + ' copied=' + copied);
    const n2 = await AC.addImageFile(api, '/p', AC.ROOT_ALBUM, '/src2/a.png');
    check('[22] ชื่อเดียวกันแต่คนละรูป = ยังต่อเลขเหมือนเดิม', n2 !== 'a.png' && copied === 1, n2);
  })().catch((e) => check('[22] addImageFile', false, e.stack));
}

// ───────── ข้อ 23 · ขีดแดงตรวจคำไทย ─────────
{
  const S = load('spell');
  const run = 'สวัดดีครับ';
  const [a] = S.snapThaiSpan(run, 2, 6);                 // ตัวตัดคำเคยเริ่มที่ "ั"
  check('[23] ★ ช่วงที่ขีดแดงไม่เริ่มที่สระบน/วรรณยุกต์', a === 1 && run[a] === 'ว', a);
  const [a2] = S.snapThaiSpan('เกาะแก่ง', 1, 4);          // เริ่มที่พยัญชนะหลังสระหน้า
  check('[23] สระหน้าติดไปกับพยัญชนะของมัน', a2 === 0);
  const [, e3] = S.snapThaiSpan('กิ่งไม้', 0, 2);           // จบก่อนวรรณยุกต์
  check('[23] วรรณยุกต์ท้ายช่วงติดมาด้วย', e3 === 3, e3);
}

// ───────── ข้อ 25 · เลขบนหน้าแรกเป็นตัวเลือกในศูนย์ส่งออก ─────────
{
  const hub = src('src/export-hub.js');
  check('[25] ★ ศูนย์ส่งออกมีสวิตช์ "ใส่เลขบนหน้าแรก" ที่เขียนค่าของโปรเจกต์ผ่านทางเดียว', /c\.onchange = \(\) => \{ A\.setFirstPageNumber\(c\.checked\); refresh\(\); \};/.test(hub));
  check('[25] สวิตช์อ่านค่าจากรูปแบบบทของโปรเจกต์ (ไม่มีค่าคู่แฝดในกล่อง)', /chk\(exportPageNumberFmt\(A\.spFormat\(\)\)\.pageNumbers\.firstPage !== false\)/.test(hub));
  check('[25] ตัวตั้งค่าอยู่ใน app.js ตัวเดียว', /export function setFirstPageNumber\(on\) \{[\s\S]*?cur\.firstPage = !!on;/.test(src('src/app.js')));
  const SF = load('sp-format');
  const fmt = SF.mergeSpFormat({ pageNumbers: { show: true, firstPage: false } });
  check('[25] ปิดแล้ว: หน้าที่เลขจริงเป็น 1 ไม่มีเลข · หน้า 2 มี', SF.pageNumberLabel(1, fmt, 1) === '' && SF.pageNumberLabel(2, fmt, 1) === '2.');
}

// ───────── ภาษา ─────────
{
  const th = src('languages/k2_th.csv');
  for (const k of ['ui.spTitlePages.byNovel', 'ui.xhub.monoGreyImages', 'ui.aiProvider.defaultsAdopted', 'ui.aiChatPanel.openAiSettings',
                   'ui.aiError.missingHeaderNamed', 'ui.aiError.missingHeaderNamedHint', 'ui.spFormat.castTitle', 'ui.spFormat.rosterScene', 'ui.spFormat.rosterTime']) {
    check('[i18n] มีคีย์ ' + k, th.includes('\n' + k + ','));
  }
}

setTimeout(() => {
  console.log('\ntrial-report-1025: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, 300);
