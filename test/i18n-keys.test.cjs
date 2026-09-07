// test/i18n-keys.test.cjs — **ประตูกันพลาดของระบบภาษา** (alpha.77)
//
// กฎที่ผู้ใช้กำหนด: แอป **ไม่มีการตกกลับข้ามภาษา** — ไฟล์ภาษาต้องครบทุกแถวเสมอ
// คีย์ไหนขาดจะโชว์ตัวคีย์โต้ง ๆ บนหน้าจอ · เทสนี้จึงต้องจับให้ได้ตั้งแต่ตอน build
//
// ตรวจ 4 อย่าง:
//   1. ทุก `t('ui.…')` / `tf('ui.…')` ในซอร์ส ต้องมีคีย์นั้นในไฟล์ภาษา **ทุกไฟล์** และค่าไม่ว่าง
//   2. ไม่มีข้อความไทยฮาร์ดโค้ดหลงเหลือในซอร์ส (นอกรายการยกเว้นที่จงใจ)
//   3. ไฟล์ภาษาทุกไฟล์มีชุดคีย์เหมือนกันเป๊ะ (ไม่มีคีย์กำพร้า/ตกหล่น)
//   4. จำนวนที่แทรกค่า {0},{1} ต้องตรงกันทุกภาษา (ไม่งั้นแปลแล้วค่าหาย)

const fs = require('fs');
const path = require('path');
const { lexStrings, stripComments } = require('../tools/js-lex.cjs');
const { classify, testStart } = require('../tools/i18n-classify.cjs');
const { lexCsv } = require('../tools/csv-lite.cjs');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, extra) => {
  if (c) { pass++; console.log('PASS ' + n); }
  else { fail++; console.log('FAIL ' + n + (extra !== undefined ? ' | ' + extra : '')); }
};

// ───────── อ่านไฟล์ภาษาทั้งหมด ─────────
const langDir = path.join(ROOT, 'languages');
const langFiles = fs.readdirSync(langDir).filter((f) => /^k2_[A-Za-z-]+\.csv$/.test(f));
const tables = {};
for (const f of langFiles) tables[f] = lexCsv(fs.readFileSync(path.join(langDir, f), 'utf8'));
check('มีไฟล์ภาษาอย่างน้อย 2 ภาษา', langFiles.length >= 2, langFiles.join(','));

// ───────── กวาดคีย์ที่ซอร์สเรียกใช้จริง ─────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const srcFiles = walk(path.join(ROOT, 'src')).concat([path.join(ROOT, 'main.js')]);

const used = new Map();                                     // คีย์ → ไฟล์แรกที่เจอ
// tt/ttf = นามแฝงในไฟล์ที่มีตัวแปรท้องถิ่นชื่อ t บังอยู่ (ดู tools/i18n-shadow.cjs)
const CALL = /(^|[^A-Za-z0-9_$.])(t|tf|tt|ttf)\(\s*'([^']+)'/g;
for (const abs of srcFiles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  // ตัวอย่างในคอมเมนต์ (`tf('ui.scene.chapterNum', 7)` ในเอกสารของ i18n.js) ไม่ใช่โค้ดจริง
  const raw = fs.readFileSync(abs, 'utf8');
  const src = stripComments(raw);
  const tstart = testStart(rel, raw);                       // บล็อก selftest ไม่นับ —
  let m;                                                    // เทสจงใจเรียกคีย์ที่ไม่มีจริง เพื่อพิสูจน์ว่าไม่ตกกลับ
  CALL.lastIndex = 0;
  while ((m = CALL.exec(src))) {
    const key = m[3];
    if (!/^ui\./.test(key)) continue;                       // เอาเฉพาะคีย์ของระบบภาษา
    if (tstart !== Infinity) {
      const line = src.slice(0, m.index).split('\n').length;
      if (line >= tstart) continue;
    }
    if (!used.has(key)) used.set(key, rel);
  }
}
check('ซอร์สเรียกคีย์ภาษาเกิน 3,000 คีย์', used.size > 3000, used.size);

for (const f of langFiles) {
  const tbl = tables[f];
  const missing = [...used.keys()].filter((k) => !tbl[k]);
  check(`${f}: มีครบทุกคีย์ที่ซอร์สเรียก (ขาด 0)`, missing.length === 0,
        missing.length + ' ขาด: ' + missing.slice(0, 4).join(' · ') +
        (missing[0] ? '  (ที่ ' + used.get(missing[0]) + ')' : ''));
}

// ───────── ไฟล์ภาษาทุกไฟล์ต้องมีชุดคีย์เหมือนกัน ─────────
const base = langFiles[0];
for (const f of langFiles.slice(1)) {
  const a = new Set(Object.keys(tables[base])), b = new Set(Object.keys(tables[f]));
  const onlyA = [...a].filter((k) => !b.has(k)), onlyB = [...b].filter((k) => !a.has(k));
  check(`${f}: ชุดคีย์ตรงกับ ${base}`, onlyA.length === 0 && onlyB.length === 0,
        `ขาด ${onlyA.length} (${onlyA.slice(0, 3)}) · เกิน ${onlyB.length} (${onlyB.slice(0, 3)})`);
}

// ───────── ที่แทรกค่าต้องเท่ากันทุกภาษา ─────────
const slots = (s) => (String(s).match(/\{\d+\}/g) || []).sort().join('');
for (const f of langFiles.slice(1)) {
  const bad = Object.keys(tables[base]).filter((k) => tables[f][k] && slots(tables[base][k]) !== slots(tables[f][k]));
  check(`${f}: ที่แทรกค่า {0},{1} ตรงกับต้นฉบับ`, bad.length === 0,
        bad.slice(0, 3).map((k) => k + ': "' + tables[base][k] + '" vs "' + tables[f][k] + '"').join(' | '));
}

// ───────── ห้ามมีข้อความไทยฮาร์ดโค้ดหลงเหลือ ─────────
// ใช้ **ตัวจัดประเภทตัวเดียวกับเครื่องมือ** (tools/i18n-classify.cjs) — ถ้าใช้กฎคนละชุด
// เทสกับเครื่องมือจะเถียงกันเอง · อะไรที่ classify บอกว่า 'ui' = ต้องแปล ห้ามเหลือเป็นไทยในโค้ด
const THAI = /[฀-๿]/;
let hardcoded = 0; const where = [];
for (const abs of srcFiles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = fs.readFileSync(abs, 'utf8');
  const tstart = testStart(rel, src);
  for (const tk of lexStrings(src)) {
    if (!tk.parts.some((p) => THAI.test(p))) continue;
    if (classify(src, tk, rel, tstart) !== 'ui') continue;
    hardcoded++;
    if (where.length < 6) where.push(rel + ':' + tk.line);
  }
}
check('ไม่มีข้อความไทยที่ต้องแปลตกค้างในซอร์ส', hardcoded === 0,
      hardcoded + ' จุด: ' + where.join(' · '));

// ═══════ [alpha.116 ข้อ 6] ★ index.html ก็ต้องไม่มีไทยฮาร์ดโค้ด ═══════
//
// ผู้ใช้: *"เช็ค hardcode ต้องไม่มีภาษาไทย อย่าลืม"*
//
// ประตูกันพลาดเดิมกวาดเฉพาะ `.js` — `renderer/index.html` จึงรอดมาตลอด และมีไทย
// ฮาร์ดโค้ดค้างอยู่ **92 จุด** (tooltip ของปุ่มแทบทั้งแถบ + ตัวเลือกในกล่องเลือก)
// สลับภาษาเป็นอังกฤษแล้วแถบเครื่องมือยังเป็นไทยทั้งแถบ
//
// กติกา: ข้อความไทยใน index.html ต้องมี `data-i18n` / `data-i18n-title` /
// `data-i18n-attr` กำกับเสมอ และคีย์นั้นต้องมีจริงในไฟล์ภาษาทุกไฟล์
{
  const htmlPath = path.join(ROOT, 'renderer/index.html');
  const raw = fs.readFileSync(htmlPath, 'utf8');
  // ตัดคอมเมนต์ HTML ทิ้ง (คำอธิบายในนั้นเป็นของนักพัฒนา ไม่ใช่ข้อความบนหน้าจอ)
  const html = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  const bad = [];

  // 1) title="…" ที่ไม่มีคีย์กำกับ
  const TITLE = /<[a-z]+[^>]*\stitle="([^"]*)"[^>]*>/g;
  let m;
  while ((m = TITLE.exec(html))) {
    if (!THAI.test(m[1])) continue;
    if (/data-i18n-title=/.test(m[0]) || /data-i18n-attr="title"/.test(m[0])) continue;
    bad.push('title: ' + m[1].slice(0, 30));
  }
  // 2) ข้อความไทยระหว่างแท็กที่ไม่มีคีย์กำกับ
  const TEXT = /<([a-z]+)([^>]*)>([^<>]*[฀-๿][^<>]*)</g;
  while ((m = TEXT.exec(html))) {
    if (/data-i18n=/.test(m[2])) continue;
    bad.push('<' + m[1] + '>: ' + m[3].trim().slice(0, 30));
  }
  check('★ index.html ไม่มีข้อความไทยที่ไม่ได้ผ่านระบบภาษา', bad.length === 0,
        bad.length + ' จุด: ' + bad.slice(0, 5).join(' · '));

  // 3) คีย์ที่ index.html อ้าง ต้องมีจริงในไฟล์ภาษาทุกไฟล์
  const keys = new Set();
  const KEY = /data-i18n(?:-title)?="([^"]+)"/g;
  while ((m = KEY.exec(html))) keys.add(m[1]);
  check('index.html อ้างคีย์ภาษาอย่างน้อย 80 คีย์', keys.size >= 80, keys.size);
  for (const f of langFiles) {
    const miss = [...keys].filter((k) => !(tables[f][k] || tables[f]['ui.' + k]));
    check(`${f}: คีย์ที่ index.html อ้างมีครบ`, miss.length === 0,
          miss.length + ' ขาด: ' + miss.slice(0, 4).join(' · '));
  }
}

// ───────── คีย์ต้องอ่านรู้เรื่อง ─────────
const badShape = [...used.keys()].filter((k) => !/^ui\.[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9:]*$/.test(k));
check('คีย์ทุกตัวอยู่ในรูป ui.<module>.<name>', badShape.length === 0, badShape.slice(0, 5).join(' · '));
const thaiKeys = Object.keys(tables[base]).filter((k) => THAI.test(k));
check('ไม่มีคีย์ที่เป็นข้อความไทยหลงเหลือในไฟล์ภาษา', thaiKeys.length === 0, thaiKeys.slice(0, 3).join(' · '));

console.log(`\n--- RESULT ---\nPASS ${pass}  FAIL ${fail}`);
if (fail) process.exit(1);
