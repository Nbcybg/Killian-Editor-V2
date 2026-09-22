// test/settings-tpl.test.cjs — โครง HTML ของกล่องตั้งค่า
//
// [alpha.79] เทมเพลตเคยอยู่ในไฟล์ภาษาทั้งกล่อง (คีย์เดียว 26KB) — รอบนั้นแก้โครงด้วยสคริปต์แล้ว regex
// จับขอบผิดไปหนึ่งตัว หน้า "ทั่วไป" กับ "การเขียน" **หายไปทั้งหน้า** โดยไม่มีอะไรฟ้อง
// [alpha.154] ผู้ใช้: *"ย้าย HTML ในกล่องตั้งค่าออกจาก CSV"* → โครงอยู่ `src/settings-template.js`
// ข้อความทุกชิ้นเป็นคีย์ `ui.setTpl.*` ในไฟล์ภาษา (ข้อความล้วน ไม่มีแท็ก)
//
// ตรวจ: ทุก `#st-*` ที่ dialogs.js อ้างมีในเทมเพลต · แท็บกับหน้าจับคู่ครบ · ค่าแทรกครบตามที่โค้ดส่ง ·
//       คีย์เดิมหายจากไฟล์ภาษาทุกไฟล์ · คีย์ใหม่ครบทุกภาษาและไม่มีแท็ก HTML · โมดูลไม่มีข้อความไทย
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');
const { lexCsv } = require('../tools/csv-lite.cjs');
const { stripComments } = require('../tools/js-lex.cjs');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const out = path.join(os.tmpdir(), '_settings_tpl154.cjs');
esbuild.buildSync({ entryPoints: [path.join(ROOT, 'src/settings-template.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const M = require(out);
const N = M.SETTINGS_TEMPLATE_ARGS;
const tpl = M.settingsTemplate(Array.from({ length: N }, (_, i) => '{' + i + '}'));
const modSrc = fs.readFileSync(path.join(ROOT, 'src/settings-template.js'), 'utf8');
const dlg = fs.readFileSync(path.join(ROOT, 'src', 'dialogs.js'), 'utf8');

// ───────── ค่าที่แทรก: โค้ดส่งกี่ค่า เทมเพลตต้องใช้ครบเท่านั้น ─────────
{
  const call = dlg.match(/settingsTemplate\(\[([\s\S]*?)\]\)/);
  check('dialogs.js เรียก settingsTemplate([...])', !!call);
  check('dialogs.js ไม่อ่านเทมเพลตจากไฟล์ภาษาแล้ว', !dlg.includes('alphaItemLevelUser'));
  const slots = new Set([...tpl.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]));
  const miss = []; for (let i = 0; i < N; i++) if (!slots.has(i)) miss.push(i);
  check(`ที่แทรกค่า {0}..{${N - 1}} ครบ`, N >= 44 && miss.length === 0, miss.join(','));
}

// ───────── โครง ─────────
{
  const wanted = new Set(['st-mg-top', 'st-mg-bottom', 'st-mg-left', 'st-mg-right']);
  for (const m of dlg.matchAll(/['"]#(st-[\w-]+)['"]/g)) if (!m[1].endsWith('-')) wanted.add(m[1]);
  // [alpha.162 · W3] ★ ทุกช่องอยู่ในเทมเพลต — ไม่มีหน้าไหนถูกประกอบตอนรันอีกแล้ว
  // (หน้า "แผงนำทาง" เคยสร้างเป็น DOM ใน dialogs.js ตั้งแต่ .140 จึงไม่เคยถูกด่านนี้ตรวจเลย)
  const builtInJs = new Set([...dlg.matchAll(/\.id\s*=\s*['"](st-[\w-]+)['"]/g)].map((m) => m[1]));
  check('★ ไม่มีช่องตั้งค่าที่ dialogs.js สร้างเองตอนรัน (โครงอยู่ในเทมเพลตทั้งหมด)',
        builtInJs.size === 0, [...builtInJs].join(' · '));
  check('dialogs.js อ้าง #st-* อย่างน้อย 60 ตัว', wanted.size >= 60, wanted.size);
  const ids = new Set([...tpl.matchAll(/id="(st-[\w-]+)"/g)].map((m) => m[1]));
  const missing = [...wanted].filter((id) => !ids.has(id));
  check('เทมเพลตมีทุกช่องที่โค้ดอ้าง', missing.length === 0, missing.join(' · '));

  const tabs = [...tpl.matchAll(/class="k-set-tab[^"]*"\s+data-p="(\w+)"/g)].map((m) => m[1]);
  const pages = [...tpl.matchAll(/class="k-set-page[^"]*"\s+data-p="(\w+)"/g)].map((m) => m[1]);
  check('มีหัวข้ออย่างน้อย 13 หัวข้อ', tabs.length >= 13, tabs.length);
  check('ทุกหัวข้อมีหน้าเนื้อหาคู่กัน', tabs.every((x) => pages.includes(x)), tabs.filter((x) => !pages.includes(x)).join(' · '));
  check('ทุกหน้าเนื้อหามีหัวข้อคู่กัน (ไม่มีหน้ากำพร้า)', pages.every((x) => tabs.includes(x)), pages.filter((x) => !tabs.includes(x)).join(' · '));
  check('ไม่มี data-p ซ้ำในหัวข้อ', new Set(tabs).size === tabs.length);
  check('มีหน้าที่เปิดอยู่ตอนแรกหน้าเดียว', (tpl.match(/class="k-set-page[^"]*\bon"/g) || []).length === 1);
  check('ใช้โครงรายการด้านซ้าย (k-set-nav)', tpl.includes('k-set-nav') && tpl.includes('k-set-main'));
  check('ไม่เหลือโครงแท็บบนหัวแบบเก่า', !tpl.includes('k-set-tabs'));
  check('มีหัวกลุ่มอย่างน้อย 2 กลุ่ม', (tpl.match(/k-set-navgrp"/g) || []).length >= 2);
  check('มีช่องค้นหาหัวข้อ', tpl.includes('id="st-nav-q"'));
  check('มีที่วางรายการปุ่มแถบเครื่องมือ', tpl.includes('id="st-toolbar-host"'));
  const open = (tpl.match(/<div\b/g) || []).length, close = (tpl.match(/<\/div>/g) || []).length;
  check('แท็ก <div> เปิด-ปิดครบคู่', open === close, open + ' เปิด / ' + close + ' ปิด');
  check('ไม่มีคีย์โผล่แทนข้อความ (คีย์ขาดในไฟล์ภาษาไทย)', !/ui\.setTpl\./.test(tpl), (tpl.match(/ui\.setTpl\.\w+/) || [''])[0]);
}

// ───────── ข้อความอยู่ไฟล์ภาษา · โครงอยู่โค้ด ─────────
{
  check('★ โมดูลเทมเพลตไม่มีข้อความไทย (นอกคอมเมนต์)', !/[฀-๿]/.test(stripComments(modSrc)));
  const keys = [...new Set([...modSrc.matchAll(/\btx?\('(ui\.setTpl\.[\w:-]+)'\)/g)].map((m) => m[1]))];
  check('มีคีย์ข้อความของกล่องตั้งค่าอย่างน้อย 150 คีย์', keys.length >= 150, keys.length);
  const langDir = path.join(ROOT, 'languages');
  for (const f of fs.readdirSync(langDir).filter((x) => /^k2_.+\.csv$/.test(x))) {
    const tbl = lexCsv(fs.readFileSync(path.join(langDir, f), 'utf8'));
    check(`${f}: ★ ไม่มีเทมเพลต HTML ก้อนเดิม (ui.dlg.alphaItemLevelUser) แล้ว`, !('ui.dlg.alphaItemLevelUser' in tbl));
    const miss = keys.filter((k) => !tbl[k]);
    check(`${f}: มีข้อความของกล่องตั้งค่าครบทุกคีย์`, miss.length === 0, miss.slice(0, 5).join(' · '));
    const tagged = Object.keys(tbl).filter((k) => k.startsWith('ui.setTpl.') && /<\/?[a-z][^>]*>/i.test(tbl[k]));
    check(`${f}: ★ ข้อความของกล่องตั้งค่าไม่มีแท็ก HTML`, tagged.length === 0, tagged.slice(0, 5).join(' · '));
  }
}

// ───────── [alpha.162 · W3] ★ ขอบเขตของค่า: ป้ายบนหน้าต้องตรงกับที่เก็บจริง ─────────
//
// ต้นตอ: รายการด้านซ้ายแบ่งสองกลุ่มตาม "ระดับผู้ใช้ / เฉพาะผลงาน" แต่มีแถวข้ามกลุ่มอยู่ 13 แถว
// (ชื่อเรื่อง · ผู้แต่ง · เป้าหมายคำ · ประวัติ · ขนาดฟอนต์เอกสาร · ปรับหน้าอัตโนมัติ อยู่ในกลุ่มผู้ใช้ ·
//  สีกระดาษ · เส้นบอกระยะขอบ อยู่ในกลุ่มผลงาน) — ผู้ใช้จึงเดาไม่ออกว่าค่าไหนจะตามไปผลงานอื่น
{
  const core = fs.readFileSync(path.join(ROOT, 'src/core.js'), 'utf8');
  const keysOf = (name) => {
    const a = core.indexOf('export const ' + name + ' = {');
    const b = core.indexOf('\n};', a);
    // ตัดออบเจกต์ซ้อน (customPaper:{…} ฯลฯ) ออกก่อน ไม่งั้นชื่อฟิลด์ข้างในปนมาเป็นคีย์ระดับบน
    // และต้องจับหลายคีย์ในบรรทัดเดียวด้วย (`uiFontSize: 0, uiScale: 1, spellCheck: true,`)
    const body = core.slice(a, b)
      .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')     // ตัดคอมเมนต์ (มี `คีย์:` ในข้อความ)
      .replace(/\{[^{}]*\}/g, '{}');
    return new Set([...body.matchAll(/(?:^\s*|[{,]\s*)([A-Za-z_]\w*)\s*:/gm)].map((m) => m[1])
      .filter((k) => k !== name));
  };
  const G = keysOf('GLOBAL_DEFAULTS');
  const P = keysOf('PROJECT_DEFAULTS');
  check('อ่านตารางค่าเริ่มต้นทั้งสองชุดได้', G.size > 20 && P.size > 20, G.size + '/' + P.size);
  check('★ ไม่มีคีย์ไหนอยู่ทั้งสองตาราง (ขอบเขตต้องชัด)',
        [...G].every((k) => !P.has(k)), [...G].filter((k) => P.has(k)).join(','));

  // หน้าเนื้อหาทุกหน้าต้องประกาศขอบเขตของตัวเอง
  const pageBlocks = [...tpl.matchAll(/<div class="k-set-page[^"]*" data-p="(\w+)">([\s\S]*?)(?=\n    <div class="k-set-page|\n  <\/div>)/g)]
    .map((m) => ({ id: m[1], html: m[2] }));
  check('แยกหน้าเนื้อหาออกมาได้ครบ', pageBlocks.length >= 16, pageBlocks.length);
  const noScope = pageBlocks.filter((p2) => !/k-set-scope k-full" data-scope="(global|project)"/.test(p2.html)).map((p2) => p2.id);
  check('★★ [162-W3] ทุกหน้าในกล่องตั้งค่าติดป้ายบอกขอบเขต (global/project)', noScope.length === 0, noScope.join(' · '));
  const scopeOfPage = {};
  for (const b of pageBlocks) {
    const m = b.html.match(/k-set-scope k-full" data-scope="(global|project)"/);
    if (m) scopeOfPage[b.id] = m[1];
  }
  const pageOfId = {};
  for (const b of pageBlocks) for (const m of b.html.matchAll(/id="(st-[\w-]+)"/g)) pageOfId[m[1]] = b.id;

  // ตัวอย่างที่ต้องตรงเสมอ — ทุกแถวที่รอบนี้ย้าย + หลักหมุดของแต่ละขอบเขต
  // (คีย์ถูกเทียบกับตารางจริงข้างบน ตารางนี้จึงเพี้ยนตามลำพังไม่ได้)
  const SPOT = [
    // เคยอยู่กลุ่ม "ระดับผู้ใช้" ทั้งที่เก็บในไฟล์ผลงาน
    ['st-title', 'meta'], ['st-author', 'meta'],
    ['st-daily', 'goals'], ['st-proj', 'goals'],
    ['st-histlimit', 'historyLimit'], ['st-histoff', 'historyOff'],
    ['st-sppt', 'spFontPt'], ['st-pr-pt', 'edFontPt'],
    ['st-autopag', 'spAutoPaginate'], ['st-pagintv', 'spPaginateInterval'],
    // เคยอยู่กลุ่ม "เฉพาะผลงาน" ทั้งที่เป็นค่าระดับผู้ใช้
    ['st-paper-color', 'paperColor'], ['st-page-guides', 'pageGuides'],
    // หลักหมุด (ไม่ได้ย้าย แต่ต้องไม่หลุดขอบเขตในอนาคต)
    ['st-theme', 'theme'], ['st-uiscale', 'uiScale'], ['st-recycle', 'recycleDays'],
    ['st-navmode', 'navMode'], ['st-navper', 'navPerPage'], ['st-sp-errmark', 'spErrorMarks'],
    ['st-mg-top', 'pageMargins'], ['st-pn-show', 'spPageNumbers'],
  ];
  const wrongScope = [];
  for (const [id, key] of SPOT) {
    const want = key === 'meta' || key === 'goals' ? 'project' : G.has(key) ? 'global' : P.has(key) ? 'project' : '';
    if (!want) { wrongScope.push(id + ':คีย์ ' + key + ' ไม่อยู่ในตารางค่าเริ่มต้นเลย'); continue; }
    const page = pageOfId[id];
    if (!page) { wrongScope.push(id + ':ไม่อยู่ในเทมเพลต'); continue; }
    if (scopeOfPage[page] !== want) wrongScope.push(`${id} อยู่หน้า ${page} (${scopeOfPage[page]}) แต่ควรเป็น ${want}`);
  }
  check('★★ [162-W3] ทุกช่องอยู่ในหน้าที่ขอบเขตตรงกับที่เก็บจริง', wrongScope.length === 0, wrongScope.join(' · '));

  // รายชื่อคีย์ระดับผู้ใช้ต้องไม่มีสำเนาเขียนมืออีกชุด
  check('★★ [162-W3] dialogs.js ไม่มีรายชื่อคีย์ระดับผู้ใช้เขียนมือ (อ่านจาก GLOBAL_DEFAULTS)',
        !/const globalKeys\s*=\s*\[/.test(dlg) && /Object\.keys\(GLOBAL_DEFAULTS\)/.test(dlg));

  // สวิตช์ในเมนูที่เป็นค่าระดับผู้ใช้ ต้องเขียนลงไฟล์ตั้งค่าผู้ใช้ด้วย
  const app3 = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  for (const k of ['theme', 'fabEnabled', 'lineNumbers', 'showMarkdownCodes']) {
    check(`★ [162-W3] สวิตช์ ${k} จากเมนูบันทึกเป็นค่าระดับผู้ใช้`,
          new RegExp("saveGlobalSetting\\('" + k + "'").test(app3));
  }
  // ช่องซ้ำที่ถอดออกแล้วต้องไม่กลับมา
  check('★ [162-W3] ไม่มีช่องขนาดฟอนต์นิยายซ้ำสองที่ (#st-edpt ถูกถอด)',
        !tpl.includes('id="st-edpt"') && !dlg.includes("'#st-edpt'"));
  check('★ [162-W3] ไม่มีสวิตช์เลขหน้าซ้ำสองที่ (#st-pr-pgnum ถูกถอด)',
        !tpl.includes('id="st-pr-pgnum"') && !dlg.includes("'#st-pr-pgnum'"));
  check('★ [162-W3] มีแท็บผู้ช่วย AI ในกล่องตั้งค่า',
        /data-p="ai"/.test(tpl) && tpl.includes('id="st-ai-open"'));
}

console.log(`\nsettings-tpl: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
