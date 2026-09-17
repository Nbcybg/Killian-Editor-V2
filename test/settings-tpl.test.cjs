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
  // [alpha.140] หัวข้อที่ dialogs.js ประกอบเป็น DOM เอง ไม่ต้องอยู่ในเทมเพลต
  const builtInJs = new Set([...dlg.matchAll(/\.id\s*=\s*['"](st-[\w-]+)['"]/g)].map((m) => m[1]));
  check('มีช่องที่โค้ดสร้างเองอย่างน้อย 1 ช่อง', builtInJs.size >= 1, builtInJs.size);
  for (const id of builtInJs) wanted.delete(id);
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

console.log(`\nsettings-tpl: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
