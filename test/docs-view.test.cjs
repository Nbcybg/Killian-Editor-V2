// test/docs-view.test.cjs — [alpha.170] คู่มือในโปรแกรม (ตรรกะล้วน) + ข้อมูลเจ้าของโปรแกรม (ลิขสิทธิ์ · ลิงก์สนับสนุน)
//
// ผู้ใช้: *"เราทำ คู่มือ และ Extension guide แล้ว check ว่าถูกใส่และเรียกใช้ใน app กับ readme มั้ย default เป็นภาษาอังกฤษนะ"*
//
// ตรวจ: ภาษาตั้งต้น = อังกฤษ · ลิงก์/รูป/สมอของ **ทุกหน้าในคู่มือจริง** ไปถึงของที่มีอยู่ · สารบัญครบทุกบท ·
//       คู่มือถูกแพ็กไปกับตัวโปรแกรม · มีทางเปิดจากเมนู/กล่องเกี่ยวกับ · README ชี้คู่มือ (อังกฤษก่อน) · คีย์ภาษาครบ
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lexCsv } = require('../tools/csv-lite.cjs');
const { stripComments } = require('../tools/js-lex.cjs');

const ROOT = path.join(__dirname, '..');
const load = (rel, name) => { const o = path.join(os.tmpdir(), name); require('esbuild').buildSync({ entryPoints: [path.join(ROOT, rel)], outfile: o, format: 'cjs', bundle: true, logLevel: 'silent' }); return require(o); };
const D = load('src/docs-view.js', '_docsview170.cjs');
const A = load('src/app-info.js', '_appinfo170.cjs');
const U = load('src/update/update-check.js', '_upd170docs.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const docInfoOf = (rel) => D.docInfo(rel);

// ═══════════ ภาษา ═══════════
{
  check('★★ ภาษาตั้งต้น = อังกฤษ (ตัวแรกของรายการ)', D.DOC_LANGS[0] === 'en' && D.docLang('') === 'en' && D.docLang(undefined) === 'en');
  check('★ หน้าจอภาษาที่คู่มือไม่มี (เยอรมัน/ญี่ปุ่น/จีน/…) = อังกฤษ', ['de', 'fr', 'ja', 'pt', 'zh', 'xx'].every((l) => D.docLang(l) === 'en'));
  check('หน้าจอไทย = ไทย · รหัสมีภูมิภาค (th-TH · EN_us) ก็อ่านได้', D.docLang('th') === 'th' && D.docLang('th-TH') === 'th' && D.docLang('EN_us') === 'en');
  check('★ ภาษาที่ผู้ใช้เลือกในตัวอ่านชนะภาษาของหน้าจอ · ค่าที่จำไว้เสีย = ไม่สน', D.docLang('th', 'en') === 'en' && D.docLang('de', 'th') === 'th' && D.docLang('th', 'zz') === 'th');
  check('ทุกภาษาของคู่มือมีชื่อ + มีโฟลเดอร์จริงในทั้งสองเล่ม',
        D.DOC_LANGS.every((l) => D.DOC_LANG_NAMES[l] && Object.values(D.DOC_BOOKS).every((b) => exists(b.dir + '/' + l + '/README.md'))));
  check('หน้าแรกของเล่ม', D.docHome('manual', 'en') === 'docs/manual/en/README.md' && D.docHome('extension', 'th') === 'docs/extension/th/README.md'
        && D.docHome('nope', 'zz') === 'docs/manual/en/README.md');
  check('★ หน้าเดียวกันในอีกภาษา (ชื่อไฟล์เหมือนกัน) · ไฟล์ที่ใช้ร่วมสองภาษา = หน้าแรกของเล่ม',
        D.docInLang('docs/manual/en/05-writing-screenplay.md', 'th') === 'docs/manual/th/05-writing-screenplay.md'
        && D.docInLang('docs/extension/th/README.md', 'en') === 'docs/extension/en/README.md'
        && D.docInLang('docs/extension/k2.d.ts', 'th') === 'docs/extension/th/README.md' && D.docInLang('x/y.md', 'th') === 'docs/manual/th/README.md');
  check('เล่ม/ภาษาของทาง', JSON.stringify(D.docInfo('docs/manual/th/img/a.webp')) === '{"book":"manual","lang":"th","file":"img/a.webp"}'
        && D.docInfo('docs/extension/examples/README.md').lang === '' && D.docInfo('docs/plugin-dev.md') === null && D.docInfo('../x') === null);
}

// ═══════════ ลิงก์ ═══════════
{
  const cur = 'docs/manual/en/01-getting-started.md';
  const R = (h, c = cur) => D.resolveDocLink(c, h, U.UPDATE_HOME_URL);
  check('ลิงก์ไปบทอื่น + สมอ', JSON.stringify(R('09-export-import-print.md#import')) === '{"kind":"doc","path":"docs/manual/en/09-export-import-print.md","hash":"import"}');
  check('ลิงก์สลับภาษา / ข้ามเล่ม', R('../th/01-getting-started.md').path === 'docs/manual/th/01-getting-started.md'
        && R('../../extension/en/README.md').path === 'docs/extension/en/README.md');
  check('สมอในหน้าเดียวกัน', JSON.stringify(R('#17-where-the-app-keeps-its-data')) === '{"kind":"hash","hash":"17-where-the-app-keeps-its-data"}');
  check('สมอภาษาไทยที่ถูกเข้ารหัสมา = ถอดกลับ', R('#' + encodeURIComponent('ติดตั้ง')).hash === 'ติดตั้ง');
  check('ลิงก์เว็บ = เปิดในเบราว์เซอร์', R('https://example.com/a?b=1').kind === 'web' && R('https://example.com/a?b=1').url === 'https://example.com/a?b=1');
  check('★★ scheme อื่น (javascript: · file: · mailto:) = ไม่เปิด', ['javascript:alert(1)', 'file:///etc/passwd', 'mailto:a@b.c', 'data:text/html,x'].every((h) => R(h).kind === 'none'));
  check('ไฟล์ข้อความในคู่มือที่ไม่ใช่มาร์กดาวน์ = โชว์เป็นโค้ด', JSON.stringify(R('../k2.d.ts', 'docs/extension/en/03-sdk-reference.md')) === '{"kind":"file","path":"docs/extension/k2.d.ts"}');
  check('ลิงก์ชี้โฟลเดอร์ (ตัวอ่านแสดงรายการไฟล์ไม่ได้) = โฟลเดอร์นั้นบนรีโป',
        R('focus-timer/', 'docs/extension/examples/README.md').url === U.UPDATE_HOME_URL + '/tree/HEAD/docs/extension/examples/focus-timer');
  const out = R('../../../AGENTS.md');
  check('★ ไฟล์นอกคู่มือ (ไม่ได้มากับตัวโปรแกรม) = หน้าไฟล์นั้นบนรีโปของโปรแกรม', out.kind === 'web' && out.url === U.UPDATE_HOME_URL + '/blob/HEAD/AGENTS.md', out.url);
  check('★★ หลุดเหนือรากของตัวโปรแกรม = ไม่ไปไหน', R('../../../../etc/passwd').kind === 'none' && D.normPath('a/../../b') === null);
  check('ไม่มีที่อยู่รีโป = ไฟล์นอกคู่มือไปไหนไม่ได้ (ไม่เดาลิงก์)', D.resolveDocLink(cur, '../../../AGENTS.md').kind === 'none');
  check('รูป: ในคู่มือ = ทางของไฟล์ · รูปจากเว็บ/นอกคู่มือ/ไม่ใช่รูป = ไม่โหลด',
        D.resolveDocImage(cur, 'img/home.webp') === 'docs/manual/en/img/home.webp' && D.resolveDocImage(cur, 'img/a.png "fit=page"') === 'docs/manual/en/img/a.png'
        && D.resolveDocImage(cur, 'https://x.test/a.png') === '' && D.resolveDocImage(cur, '../../../build/icon.png') === '' && D.resolveDocImage(cur, 'img/a.exe') === '');
  const src = stripComments(read('src/docs-view.js')) + stripComments(read('src/docs-ui.js'));
  check('★★ ไม่มีที่อยู่ GitHub เขียนซ้ำในโมดูลคู่มือ (มาจาก update-check.js ที่เดียว)', !/github\.com|githubusercontent/.test(src));
  check('★ ตัววาดไม่ใช้ innerHTML · หัวข้อไม่ตั้ง id จริง (ชนกับ id ของเปลือกโปรแกรม)',
        !/innerHTML|insertAdjacentHTML/.test(stripComments(read('src/docs-ui.js'))) && !/\.id\s*=/.test(stripComments(read('src/docs-ui.js'))));
}

// ═══════════ ตัวอักษรในบรรทัด ═══════════
{
  const P = (t) => D.docInlineParts(t);
  const j = (t) => JSON.stringify(P(t));
  check('ลิงก์ธรรมดา', j('see [the docs](a.md) now') === '[{"text":"see "},{"text":"the docs","href":"a.md"},{"text":" now"}]', j('see [the docs](a.md) now'));
  check('★ ตัวหนาที่ครอบลิงก์', j('**[A](a.md)**') === '[{"bold":true,"text":"A","href":"a.md"}]', j('**[A](a.md)**'));
  check('★ โค้ดในป้ายลิงก์', j('[`k2.d.ts`](../k2.d.ts)') === '[{"text":"k2.d.ts","code":true,"href":"../k2.d.ts"}]', j('[`k2.d.ts`](../k2.d.ts)'));
  check('★★ ลิงก์ในช่วงโค้ดไม่ถูกตีความ', j('`![alt](src "h=2")` and `[x](y)`') === '[{"text":"![alt](src \\"h=2\\")","code":true},{"text":" and "},{"text":"[x](y)","code":true}]', j('`![alt](src "h=2")` and `[x](y)`'));
  check('รูป (มีชื่อกำกับได้)', j('![Main window](img/a.webp "t")') === '[{"image":true,"src":"img/a.webp","alt":"Main window","text":"Main window"}]', j('![Main window](img/a.webp "t")'));
  check('ลิงก์อัตโนมัติ <https://…>', j('at <https://example.com/x>.') === '[{"text":"at "},{"text":"https://example.com/x","href":"https://example.com/x"},{"text":"."}]');
  check('ที่อยู่มีวงเล็บ + หลายลิงก์ในบรรทัด', P('[a](x_(y).md) · [b](z.md#q)').filter((p) => p.href).map((p) => p.href).join() === 'x_(y).md,z.md#q');
  check('ข้อความที่ไม่มีลิงก์ = เหมือน inlineParts เดิม', j('a **b** `c`') === '[{"text":"a "},{"bold":true,"text":"b"},{"text":" "},{"text":"c","code":true}]');
  check('ข้อความล้วน', D.docPlainText('**[1. Getting started](01.md)** — `x`') === '1. Getting started — x' && D.docPlainText(null) === '');
  check('★ สมอแบบ GitHub: ตัวเล็ก ตัดเครื่องหมาย ช่องว่างเป็นขีด · ไทยอยู่ครบ (สระ/วรรณยุกต์ไม่หาย)',
        D.docSlug('1.7 Where the app keeps its data') === '17-where-the-app-keeps-its-data' && D.docSlug('Hooks & lifecycle') === 'hooks--lifecycle'
        && D.docSlug('The `k2` object') === 'the-k2-object' && D.docSlug('1.2 ดาวน์โหลดและเปิดใช้') === '12-ดาวน์โหลดและเปิดใช้');
  const b = D.docBlocks('# Title **X**\n\n## Same\n\ntext\n\n## Same\n\n### Other');
  check('บล็อก: ชื่อหน้า + สมอของหัวข้อ (ซ้ำ = -1)', b.title === 'Title X' && b.blocks.filter((x) => x.kind === 'h').map((x) => x.id).join() === 'title-x,same,same-1,other');
}

// ═══════════ คู่มือจริงทั้งสองเล่ม — ทุกลิงก์ ทุกรูป ทุกสมอ ═══════════
{
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]));
  const files = Object.values(D.DOC_BOOKS).flatMap((b) => walk(b.dir)).filter((f) => /\.md$/i.test(f));
  check('คู่มือมีหน้ามาร์กดาวน์อย่างน้อย 60 หน้า', files.length >= 60, files.length);
  const anchors = new Map();
  const anchorsOf = (p) => { if (!anchors.has(p)) anchors.set(p, new Set(D.docBlocks(read(p)).blocks.filter((x) => x.kind === 'h').map((x) => x.id))); return anchors.get(p); };
  const textsOf = (blocks) => blocks.flatMap((x) => (x.kind === 'table' ? [...x.head, ...x.rows.flat()] : (x.kind === 'code' || x.kind === 'hr' ? [] : [x.text])));
  const badLink = [], badImg = [], badHash = [], none = [];
  let links = 0, imgs = 0, web = 0;
  for (const f of files) {
    for (const t of textsOf(D.docBlocks(read(f)).blocks)) {
      for (const p of D.docInlineParts(t)) {
        if (p.image) {
          imgs++;
          const s = D.resolveDocImage(f, p.src);
          if (!s || !exists(s)) badImg.push(f + ' → ' + p.src);
          continue;
        }
        if (!p.href) continue;
        links++;
        const r = D.resolveDocLink(f, p.href, U.UPDATE_HOME_URL);
        if (r.kind === 'web') {
          web++;
          // ลิงก์ที่ตัวอ่านพาไปหน้าไฟล์/โฟลเดอร์บนรีโป — ของนั้นต้องมีอยู่ในรีโปจริง
          const m = /\/(?:blob|tree)\/HEAD\/(.+)$/.exec(r.url.startsWith(U.UPDATE_HOME_URL + '/') ? r.url : '');
          if (m && !exists(decodeURIComponent(m[1]))) badLink.push(f + ' → ' + p.href);
        }
        else if (r.kind === 'doc' || r.kind === 'file') {
          if (!exists(r.path)) badLink.push(f + ' → ' + p.href);
          else if (r.kind === 'doc' && r.hash && !anchorsOf(r.path).has(r.hash.toLowerCase())) badHash.push(f + ' → ' + p.href);
        } else if (r.kind === 'hash') { if (!anchorsOf(f).has(r.hash.toLowerCase())) badHash.push(f + ' → ' + p.href); }
        else none.push(f + ' → ' + p.href);
      }
    }
  }
  check('คู่มือมีลิงก์/รูปจำนวนมากพอให้การตรวจนี้มีความหมาย', links > 600 && imgs > 80, `links=${links} imgs=${imgs} web=${web}`);
  check('★★ ทุกลิงก์ในคู่มือชี้ไปไฟล์ที่มีอยู่จริง', badLink.length === 0, badLink.slice(0, 5).join(' | '));
  check('★★ ทุกรูปในคู่มือมีไฟล์จริง (และมากับตัวโปรแกรม)', badImg.length === 0, badImg.slice(0, 5).join(' | '));
  check('★★ ทุกสมอ (#…) ที่ลิงก์อ้างมีหัวข้อจริงในหน้าปลายทาง', badHash.length === 0, badHash.length + ' :: ' + badHash.slice(0, 6).join(' | '));
  check('★ ไม่มีลิงก์ที่ตัวอ่านพาไปไหนไม่ได้', none.length === 0, none.slice(0, 5).join(' | '));

  // สารบัญ: อ่านจากหน้าแรกของแต่ละเล่ม/ภาษา ต้องครบทุกบทในโฟลเดอร์ และเรียงตามเลขบท
  for (const [book, b] of Object.entries(D.DOC_BOOKS)) for (const lang of D.DOC_LANGS) {
    const home = D.docHome(book, lang);
    const toc = D.docToc(home, read(home));
    const dir = b.dir + '/' + lang;
    const want = fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.md$/i.test(f) && f !== 'README.md').sort();
    const got = toc.slice(1).map((r) => r.path.split('/').pop());
    check(`${book}/${lang}: ★★ สารบัญครบทุกบทในโฟลเดอร์ ตามลำดับ (หน้าแรกอยู่หัว)`,
          toc[0].path === home && got.join() === want.join(), 'got=' + got.join() + ' want=' + want.join());
    check(`${book}/${lang}: ทุกบทในสารบัญมีชื่อ (ไม่ใช่ชื่อไฟล์) และไม่มีเครื่องหมายมาร์กดาวน์`,
          toc.every((r) => r.title && !/\.md$/.test(r.title) && !/[*`\[\]]/.test(r.title)), toc.map((r) => r.title).join(' | ').slice(0, 200));
  }
  const tocEn = D.docToc('docs/manual/en/README.md', read('docs/manual/en/README.md'));
  check('ชื่อบทมาจากข้อความของลิงก์ในสารบัญ', tocEn[0].title === 'Killian 2 User Manual' && tocEn[1].title === 'Getting started', tocEn.slice(0, 2).map((r) => r.title).join('|'));
}

// ═══════════ มากับตัวโปรแกรม + ทางเข้า ═══════════
{
  const pkg = JSON.parse(read('package.json'));
  check('★★ คู่มือทั้งสองเล่มอยู่ใน build.files (ไม่งั้นตัวที่แจกเปิดคู่มือไม่ได้)',
        Object.values(D.DOC_BOOKS).every((b) => pkg.build.files.includes(b.dir + '/**')), pkg.build.files.join());
  // electron-builder ตัดไฟล์บางนามสกุลทิ้งเสมอ (ตั้งค่าให้รวมไม่ได้) — เจอจริงตอนแพ็ก: k2.d.ts ไม่ติดไปกับตัวโปรแกรม
  const CUT = (() => { try { return require('app-builder-lib/out/fileMatcher').excludedExts.split(',').concat('pdb'); }
                       catch { return 'iml,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,suo,xproj,cc,d.ts,mk,a,o,obj,forge-meta,pdb'.split(','); } })();
  const walkAll = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkAll(dir + '/' + e.name) : [dir + '/' + e.name]));
  const cut = Object.values(D.DOC_BOOKS).flatMap((b) => walkAll(b.dir)).filter((x) => CUT.some((ext) => x.endsWith('.' + ext)));
  check('★★ ไฟล์ของคู่มือที่ตัวแพ็กจะตัดทิ้ง มีสำเนาที่มากับตัวโปรแกรมครบทุกไฟล์',
        CUT.includes('d.ts') && cut.length >= 1 && cut.every((x) => D.DOC_PACKED_COPIES[x]), cut.join());
  check('★ สำเนาตรงกับต้นฉบับ (ลืม build = แดง) · อยู่ใน renderer/ ด้วยนามสกุลที่ไม่ถูกตัด · build.js ใช้รายการเดียวกัน',
        Object.entries(D.DOC_PACKED_COPIES).every(([from, to]) => exists(to) && read(to) === read(from) && to.startsWith('renderer/') && !CUT.some((ext) => to.endsWith('.' + ext))
          && read('build.js').includes("'" + from + "': '" + to + "'")), JSON.stringify(D.DOC_PACKED_COPIES));
  check('ตัวอ่านลองไฟล์จริงก่อน แล้วสำเนา', D.docReadPaths('docs/extension/k2.d.ts').join() === 'docs/extension/k2.d.ts,renderer/docs-copy/k2.d.ts.txt'
        && D.docReadPaths('docs/manual/en/README.md').join() === 'docs/manual/en/README.md' && /for \(const p of docReadPaths\(path\)\)/.test(read('src/docs-ui.js')));
  check('ตัว macOS ใช้ไอคอนของโปรแกรม (ไม่ใช่ไอคอน Electron ตั้งต้น)', pkg.build.mac.icon === 'build/icon.png' && exists('build/icon.png'));
  const app = read('src/app.js'), main = read('main.js'), cmds = read('icons/commands.csv');
  check('★★ คำสั่ง user-manual / extension-guide เปิดตัวอ่านของเล่มนั้น',
        /case 'user-manual': .*openDocs\('manual'\)/.test(app) && /case 'extension-guide': .*openDocs\('extension'\)/.test(app));
  check('★ เมนู ช่วยเหลือ มีคู่มือทั้งสองเล่ม (ผ่าน cmd())', /click: cmd\('user-manual'\)/.test(main) && /click: cmd\('extension-guide'\)/.test(main));
  check('ทะเบียนคำสั่งมีแถวพร้อมไอคอน', /(^|\n)user-manual,[a-z-]+,/.test(cmds) && /(^|\n)extension-guide,[a-z-]+,/.test(cmds));
  check('กล่อง "เกี่ยวกับ" มีปุ่มคู่มือ', /k-about-manual'[^\n]*ui\.docs\.bookManual/.test(app) && /handleCommand\('user-manual'\)/.test(app));
  // README: ชี้คู่มือทั้งสองเล่ม อังกฤษเป็นตัวหลัก
  const readme = read('README.md'), readmeTh = read('README.th.md');
  check('★★ README (อังกฤษ = ตัวหลัก) ชี้คู่มือทั้งสองเล่มฉบับอังกฤษ และมีลิงก์ฉบับไทย',
        readme.includes('(docs/manual/en/README.md)') && readme.includes('(docs/extension/en/README.md)')
        && readme.includes('(docs/manual/th/README.md)') && readme.includes('(docs/extension/th/README.md)'));
  check('README ภาษาไทยชี้คู่มือฉบับไทย', readmeTh.includes('(docs/manual/th/README.md)') && readmeTh.includes('(docs/extension/th/README.md)'));
  check('README บอกว่าเปิดคู่มือจากในโปรแกรมได้', /Help → User Manual/.test(readme));

  // ── README: โครง (ผู้ใช้: แบนเนอร์โลโก้+ชื่อ · มีอะไรใหม่รุ่นล่าสุดรุ่นเดียวก่อน Disclaimer · ตัด "Compatible with Killian v1") ──
  const ver = pkg.version;
  const heads = (md, re) => [...md.matchAll(re)].map((m) => m[0]);
  check('★★ README มี "มีอะไรใหม่" ของรุ่นปัจจุบัน (เลขรุ่นตรงกับ package.json) อยู่ก่อน Disclaimer',
        readme.includes("## What's new in " + ver) && readme.indexOf("## What's new in " + ver) < readme.indexOf('## Disclaimer') && readme.indexOf('## Disclaimer') > 0);
  check('★ README แสดงรุ่นล่าสุดรุ่นเดียว (ไม่ต่อรุ่นเก่าลงท้าย) — ทั้งสองภาษา',
        heads(readme, /^## What's new in .+$/gm).length === 1 && heads(readme + readmeTh, /^## (?:ใหม่ใน )?alpha\.\d.*$/gm).length === 0
        && heads(readmeTh, /^## มีอะไรใหม่ใน .+$/gm).length === 1);
  check('README ไทย: โครงเดียวกัน — มีอะไรใหม่ของรุ่นปัจจุบัน อยู่ก่อน "ข้อควรทราบ"',
        readmeTh.includes('## มีอะไรใหม่ใน ' + ver) && readmeTh.indexOf('## มีอะไรใหม่ใน ' + ver) < readmeTh.indexOf('## ข้อควรทราบ') && readmeTh.indexOf('## ข้อควรทราบ') > 0);
  check('★★ README ไม่มี "Compatible with Killian v1" แล้ว (สองภาษา)',
        !/Compatible with Killian v1/i.test(readme) && !/ไฟล์เข้ากับ v1|เปิดใน v1 ได้/.test(readmeTh));
  const banner = 'docs/assets/readme-banner.png';
  const png = exists(banner) ? fs.readFileSync(path.join(ROOT, banner)) : Buffer.alloc(0);
  check('★★ ภาพแบนเนอร์ (โลโก้ + ชื่อโปรแกรม) มีไฟล์จริง เป็น PNG แนวนอน และอยู่หัว README ทั้งสองภาษา',
        png.length > 20000 && png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) >= png.readUInt32BE(20) * 3
        && readme.indexOf(banner) > 0 && readme.indexOf(banner) < 300 && readmeTh.indexOf(banner) > 0 && readmeTh.indexOf(banner) < 300,
        png.length ? png.readUInt32BE(16) + '×' + png.readUInt32BE(20) : 'ไม่มีไฟล์');
  check('ภาพแบนเนอร์ไม่ถูกแพ็กไปกับตัวโปรแกรม (อยู่นอกโฟลเดอร์ของคู่มือ) · มีตัวสร้าง', !docInfoOf(banner) && exists('tools/make-banner.cjs'));
  check('เลขรุ่นบนป้ายของ README ตรงกับ package.json (สองภาษา)',
        [readme, readmeTh].every((r) => r.includes('badge/version-' + ver.replace(/-/g, '--') + '-')));
  check('สรุปรายรุ่นของ README ไทยฉบับเดิมถูกเก็บไว้ (ไม่ได้ลบ) และ README ชี้ไปหา',
        exists('docs/release-notes-archive.th.md') && /^## alpha\.169/m.test(read('docs/release-notes-archive.th.md')) && readmeTh.includes('(docs/release-notes-archive.th.md)'));
  check('★ README บอกสเปกของ macOS ที่วัดจริง (รุ่นขั้นต่ำ · ขนาด · หน่วยความจำ) — สองภาษา',
        /macOS 12 \(Monterey\)/.test(readme) && /#### macOS in detail/.test(readme) && /\.dmg` ~\d+ MB/.test(readme) && /Memory in use\*\* \| ~\d+ MB/.test(readme)
        && /macOS 12 \(Monterey\)/.test(readmeTh) && /#### รายละเอียดของ macOS/.test(readmeTh) && !/ยังไม่ได้ยืนยันเวอร์ชันขั้นต่ำ/.test(readmeTh));
}

// ═══════════ เจ้าของโปรแกรม: ลิขสิทธิ์ + ลิงก์สนับสนุน ═══════════
{
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md'), readmeTh = read('README.th.md');
  check('★★ ผู้ถือลิขสิทธิ์ = Noobcyborg Studio', A.COPYRIGHT_HOLDER === 'Noobcyborg Studio');
  check('บรรทัดลิขสิทธิ์: ปีแรก = ปีเดียว · ข้ามปี = ช่วงปี · ค่าเสีย = ปีแรก',
        A.copyrightLine(2026) === '© 2026 Noobcyborg Studio' && A.copyrightLine(2028) === '© 2026–2028 Noobcyborg Studio' && A.copyrightLine(1999) === '© 2026 Noobcyborg Studio' && A.copyrightLine(NaN) === '© 2026 Noobcyborg Studio');
  check('★ ชื่อเดียวกันทุกที่: LICENSE · README สองภาษา · package.json (author + build.copyright)',
        exists('LICENSE') && read('LICENSE').includes('Copyright (c) ' + A.COPYRIGHT_SINCE + ' ' + A.COPYRIGHT_HOLDER)
        && readme.includes('© ' + A.COPYRIGHT_SINCE + ' ' + A.COPYRIGHT_HOLDER) && readmeTh.includes('© ' + A.COPYRIGHT_SINCE + ' ' + A.COPYRIGHT_HOLDER)
        && pkg.author === A.COPYRIGHT_HOLDER && pkg.build.copyright === 'Copyright © ' + A.COPYRIGHT_SINCE + ' ' + A.COPYRIGHT_HOLDER
        && !/Killian 2 contributors/.test(readme + readmeTh));
  check('LICENSE เป็นสัญญาอนุญาตเดียวกับที่ package.json ประกาศ', pkg.license === 'ISC' && /^ISC License/.test(read('LICENSE')));
  check('★★ ลิงก์สนับสนุน = ที่ผู้ใช้กำหนด (https)', A.SUPPORT_URL === 'https://buymeacoffee.com/noobcyborg');
  check('★ README สองภาษามีลิงก์สนับสนุน (ไม่เหลือช่องว่างให้เติม)',
        readme.includes(A.SUPPORT_URL) && readmeTh.includes(A.SUPPORT_URL) && !/add your donation link here/i.test(readme + readmeTh));
  const app = read('src/app.js'), main = read('main.js'), cmds = read('icons/commands.csv');
  const appCode = stripComments(app), mainCode = stripComments(main), supCode = stripComments(read('src/support-ui.js'));
  check('★★ ในโปรแกรม: คำสั่ง support เปิดลิงก์จาก app-info.js (ที่อยู่ไม่ถูกพิมพ์ซ้ำในที่อื่น)',
        /case 'support': openSupportPage\(\); break;/.test(app) && /io\.open\(SUPPORT_URL\)/.test(supCode) && /kapi\.openExternal\(url\)/.test(supCode)
        && !/buymeacoffee/.test(appCode + mainCode + supCode + stripComments(read('src/selftest.js'))));
  check('★ ทางเข้า: เมนู ช่วยเหลือ (ผ่าน cmd()) + กล่อง "เกี่ยวกับ" + ทะเบียนคำสั่ง',
        /click: cmd\('support'\)/.test(main) && /k-about-support/.test(app) && /handleCommand\('support'\)/.test(app) && /(^|\n)support,[a-z-]+,/.test(cmds));
  check('กล่อง "เกี่ยวกับ" โชว์บรรทัดลิขสิทธิ์จาก app-info.js', /k-about-copy', copyrightLine\(\)/.test(app));
  // ผู้ใช้: "ตัดบรรทัด Killian v1 ในกล่องเกี่ยวกับออกด้วย" · "หน้า credit บางตัวไม่มีแล้ว ลบออก"
  const langDir = path.join(ROOT, 'languages');
  const aboutLines = fs.readdirSync(langDir).filter((x) => /^k2_.+\.csv$/.test(x)).map((x) => lexCsv(fs.readFileSync(path.join(langDir, x), 'utf8'))['ui.app.fileTaskMarkdownJSON'] || '');
  check('★★ กล่อง "เกี่ยวกับ" ไม่เอ่ยถึง Killian v1 แล้ว (ทุกภาษา) · บรรทัดยังบอกรูปแบบไฟล์งาน',
        aboutLines.length >= 7 && aboutLines.every((v) => v && !/v1|Killian/i.test(v) && /Markdown \+ JSON/.test(v)), aboutLines.join(' | '));
  // เครดิตต้องตรงกับของที่มากับตัวโปรแกรมจริง: ไลบรารีที่ให้เครดิตต้องถูก import อยู่ · ฟอนต์ที่ให้เครดิตต้องมีไฟล์
  const credit = (/export const CREDITS = \[([\s\S]*?)\n\];/.exec(app) || [])[1] || '';
  const srcAll = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcAll(dir + '/' + e.name) : (/\.js$/.test(e.name) ? [read(dir + '/' + e.name)] : []))).join('\n');
  const code = srcAll('src');
  const LIBS = { 'ProseMirror': /from 'prosemirror-/, 'Fabric.js': /from 'fabric'/, 'pdf-lib': /from 'pdf-lib'/, 'JSZip': /from 'jszip'/, 'Fuse.js': /from 'fuse\.js'/, 'three.js': /from 'three'/ };
  const dead = Object.keys(LIBS).filter((n) => credit.includes("name: '" + n) && !LIBS[n].test(code));
  check('★ ไลบรารีทุกตัวในเครดิตยังถูกใช้ในโค้ดจริง', dead.length === 0 && Object.keys(LIBS).every((n) => credit.includes(n)), dead.join());
  check('★★ เครดิตไม่มีฟอนต์ Courier ไทยที่ถอดออกจากโปรแกรมตั้งแต่ alpha.159 · ฟอนต์ที่ยังให้เครดิตมีไฟล์จริง',
        !/courierMonoThai|fontScreenplayPosView|notSource/.test(app) && /name: 'Courier Prime'/.test(credit) && exists('renderer/assets/fonts/CourierPrime-Regular.ttf')
        && /Nerd Fonts/.test(credit) && exists('renderer/assets/fonts/k2-icons.ttf')
        && read('src/lang-fonts.js').includes("REMOVED_BUILTIN_FONTS = ['CourierThaiMono.ttf', 'CourierThaiProp.ttf']"));
  check('เครดิตของ Fabric.js ไม่อ้างผังพื้นที่แล้ว (ผังพื้นที่วาดด้วย SVG ตั้งแต่ alpha.168)',
        !/from 'fabric'/.test(read('src/floorplan-ui.js')) && !/floor plan|ผังพื้นที่/i.test(lexCsv(read('languages/k2_en.csv'))['ui.app.boardPlannerPlannerGraph'] + lexCsv(read('languages/k2_th.csv'))['ui.app.boardPlannerPlannerGraph']));
  // main เปิดลิงก์นี้ได้จริง (ด่านของ shell:openExternal รับ https)
  check('ลิงก์สนับสนุนผ่านด่านของตัวเปิดลิงก์ใน main', /\/\^https\?:\\\/\\\/\/i\.test\(String\(url\)\)/.test(main) && /^https:\/\//.test(A.SUPPORT_URL));
}

// ═══════════ ภาษา — ครบทุกไฟล์ ═══════════
{
  const uiSrc = read('src/docs-ui.js');
  const keys = new Set(Object.values(D.DOC_BOOKS).map((b) => b.titleKey));
  for (const m of stripComments(uiSrc).matchAll(/'(ui\.[\w.-]+)'/g)) keys.add(m[1]);
  for (const k of ['ui.menu.userManual', 'ui.menu.extensionGuide', 'ui.menu.support', 'ui.tip.user-manual', 'ui.tip.extension-guide', 'ui.tip.support', 'ui.app.supportOpened']) keys.add(k);
  check('คีย์ของคู่มือ/สนับสนุนอย่างน้อย 15 คีย์', keys.size >= 15, keys.size);
  const dir = path.join(ROOT, 'languages');
  const th = lexCsv(fs.readFileSync(path.join(dir, 'k2_th.csv'), 'utf8'));
  for (const f of fs.readdirSync(dir).filter((x) => /^k2_.+\.csv$/.test(x))) {
    const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
    const miss = [...keys].filter((k) => !tbl[k] || !String(tbl[k]).trim());
    check(`${f}: ★★ คีย์ครบ`, miss.length === 0, miss.join(' · '));
    if (f !== 'k2_th.csv') {
      const thai = [...keys].filter((k) => /[฀-๿]/.test(String(tbl[k] || '')));
      check(`${f}: ★ เป็นคำแปลจริง (ไม่มีไทยค้าง)`, thai.length === 0, thai.join(' · '));
    }
    const ph = (s) => [...new Set([...String(s || '').matchAll(/\{(\d+)/g)].map((m) => m[1]))].sort().join();
    const bad = [...keys].filter((k) => ph(tbl[k]) !== ph(th[k]));
    check(`${f}: ที่แทรกค่าตรงกับภาษาไทย`, bad.length === 0, bad.join(' · '));
  }
  check('★ โค้ดของตัวอ่านคู่มือไม่มีข้อความไทย (นอกคอมเมนต์)', !/[฀-๿]/.test(stripComments(uiSrc)));
}

console.log(`\ndocs-view: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
