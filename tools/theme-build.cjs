#!/usr/bin/env node
// theme-build.cjs — [alpha.159] renderer/themes/themes.json → ไฟล์ธีมทั้งหมด
//
//   node tools/theme-build.cjs           เขียนของที่เปลี่ยน (build.js เรียกให้ทุกครั้ง)
//   node tools/theme-build.cjs --check   ไม่เขียนอะไร · exit 1 ถ้ามีไฟล์ไม่ตรงกับ themes.json
//
// สิ่งที่สร้าง (ทุกอย่างมาจาก themes.json ที่เดียว — ห้ามแก้มือ):
//   1. renderer/themes/<id>.css         ตัวแปรสีของธีม (ข้ามธีม handmade:true)
//   2. renderer/index.html              <link> ของทุกธีม ระหว่าง <!-- themes:begin --> … <!-- themes:end -->
//   3. src/generated/themes-data.js     THEMES · THEME_LABEL_KEYS · THEME_MODES (core.js re-export)
//   4. languages/k2_*.csv               ป้ายชื่อธีม `ui.themes.<id>` — เพิ่มเฉพาะคีย์ที่ยังไม่มี
//                                       (คำแปลที่แก้ใน CSV แล้วไม่ถูกเขียนทับ)
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const SPEC = path.join(ROOT, 'renderer', 'themes', 'themes.json');
const THEME_DIR = path.join(ROOT, 'renderer', 'themes');
const INDEX = path.join(ROOT, 'renderer', 'index.html');
const DATA = path.join(ROOT, 'src', 'generated', 'themes-data.js');

function loadGen() {
  const out = path.join(os.tmpdir(), '_k2themegen.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/theme-gen.js')], outfile: out,
                                 format: 'cjs', bundle: true, logLevel: 'silent' });
  delete require.cache[require.resolve(out)];
  return require(out);
}

const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const labelKeyOf = (t) => t.labelKey || 'ui.themes.' + camel(t.id);

function readSpec() {
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const list = spec.themes || [];
  const seen = new Set();
  for (const t of list) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id || '')) throw new Error('id ธีมไม่ถูกรูปแบบ: ' + t.id);
    if (seen.has(t.id)) throw new Error('id ธีมซ้ำ: ' + t.id);
    seen.add(t.id);
    if (!['dark', 'light'].includes(t.mode)) throw new Error('ธีม ' + t.id + ': mode ต้องเป็น dark/light');
    if (!t.handmade) {
      for (const k of ['bg', 'fg', 'accent', 'accentHi', 'link']) {
        if (!(t.colors || {})[k]) throw new Error('ธีม ' + t.id + ': colors.' + k + ' ขาด');
      }
      if (!t.name || !t.name.th) throw new Error('ธีม ' + t.id + ': ต้องมี name.th');
    }
  }
  return list;
}

function build(check) {
  const G = loadGen();
  const list = readSpec();
  const want = new Map();       // ไฟล์ → เนื้อหา

  for (const t of list) {
    if (t.handmade) continue;
    want.set(path.join(THEME_DIR, t.id + '.css'), G.themeCss(t));
  }

  const links = list.map((t) => '<link rel="stylesheet" href="themes/' + t.id + '.css">').join('\n');
  const html = fs.readFileSync(INDEX, 'utf8');
  const re = /<!-- themes:begin[^>]*-->[\s\S]*?<!-- themes:end -->/;
  if (!re.test(html)) throw new Error('index.html ไม่มีช่อง <!-- themes:begin --> … <!-- themes:end -->');
  want.set(INDEX, html.replace(re, '<!-- themes:begin (สร้างจาก themes/themes.json · ห้ามแก้มือ) -->\n' + links + '\n<!-- themes:end -->'));

  const data = '// ⚠️ ไฟล์นี้สร้างอัตโนมัติจาก renderer/themes/themes.json ด้วย tools/theme-build.cjs — ห้ามแก้มือ\n' +
    '// เพิ่ม/แก้ธีม = แก้ themes.json แล้วรัน `node build.js`\n\n' +
    '/** รายชื่อธีมตามลำดับในเมนู (ตัวแรก = ค่าเริ่มต้นเมื่อค่าที่บันทึกไว้ใช้ไม่ได้) */\n' +
    'export const THEMES = ' + JSON.stringify(list.map((t) => t.id)) + ';\n' +
    '/** ธีม → คีย์ป้ายชื่อในไฟล์ภาษา */\n' +
    'export const THEME_LABEL_KEYS = ' + JSON.stringify(Object.fromEntries(list.map((t) => [t.id, labelKeyOf(t)])), null, 2) + ';\n' +
    '/** ธีม → dark | light */\n' +
    'export const THEME_MODES = ' + JSON.stringify(Object.fromEntries(list.map((t) => [t.id, t.mode])), null, 2) + ';\n';
  want.set(DATA, data);

  const stale = [];
  for (const [file, text] of want) {
    let cur = null;
    try { cur = fs.readFileSync(file, 'utf8'); } catch {}
    if (cur === text) continue;
    stale.push(path.relative(ROOT, file));
    if (!check) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, 'utf8'); }
  }

  // ป้ายชื่อธีมในไฟล์ภาษา (เพิ่มเฉพาะที่ขาด)
  const labels = {};
  for (const t of list) if (!t.handmade && t.name) labels[labelKeyOf(t)] = { ...t.name };
  if (!check) {
    const { addToFile } = require('./i18n-add.cjs');
    const langDir = path.join(ROOT, 'languages');
    for (const f of fs.readdirSync(langDir).filter((x) => /^k2_([A-Za-z-]+)\.csv$/.test(x))) {
      const code = /^k2_([A-Za-z-]+)\.csv$/.exec(f)[1];
      const n = addToFile(f, code, labels);
      if (n) stale.push('languages/' + f + ' +' + n);
    }
  }
  return { themes: list.length, stale };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const r = build(check);
  if (check && r.stale.length) {
    console.error('ไฟล์ธีมไม่ตรงกับ themes.json: ' + r.stale.join(', ') + ' — รัน node tools/theme-build.cjs');
    process.exit(1);
  }
  console.log('themes: ' + r.themes + ' ธีม' + (r.stale.length ? ' · เขียน ' + r.stale.join(', ') : ' · ไม่มีอะไรเปลี่ยน'));
}
module.exports = { build, labelKeyOf };
