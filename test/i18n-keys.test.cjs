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
// [alpha.154] tx/txf = ข้อความจากไฟล์ภาษาที่ลงใน HTML (src/i18n-html.js) — นับเป็นการใช้คีย์เหมือนกัน
const CALL = /(^|[^A-Za-z0-9_$.])(t|tf|tt|ttf|tx|txf)\(\s*'([^']+)'/g;
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

// ───────── [alpha.159 · H10] นามแฝงอื่นของตัวแปลภาษา ─────────
// เดิมกวาดแค่ t/tf/tt/ttf/tx/txf → `tr('ui.smart.acceptHint')` (นามแฝงของ core.t) ไม่มีแถวในไฟล์ภาษา
// แต่เทสผ่าน · หน้าจอโชว์คีย์ดิบ · ตอนนี้กวาด tr/trf/tm/tKey ด้วย และเคารพกฎของ lookup()
// (คีย์ที่ไม่ขึ้นต้นด้วย `ui.` จะถูกลองหาแบบ `ui.<คีย์>` อีกรอบ — `tr('ai.working')` = `ui.ai.working`)
{
  const ALIAS = /(^|[^A-Za-z0-9_$.])(tr|trf|tm|tKey)\(\s*'([^']+)'/g;
  const aliasUsed = new Map();
  for (const abs of srcFiles) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = fs.readFileSync(abs, 'utf8');
    const src = stripComments(raw);
    const tstart = testStart(rel, raw);
    let m;
    ALIAS.lastIndex = 0;
    while ((m = ALIAS.exec(src))) {
      const key = m[3];
      if (!/^[a-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_:-]+)+$/.test(key)) continue;   // คีย์ดอตพาธเท่านั้น (tm รับ msgid ไทยได้)
      if (tstart !== Infinity && src.slice(0, m.index).split('\n').length >= tstart) continue;
      if (!aliasUsed.has(key)) aliasUsed.set(key, rel);
    }
  }
  check('[159-H10] กวาดเจอการเรียกผ่านนามแฝง (tr/tm/tKey)', aliasUsed.size > 50, aliasUsed.size);
  for (const f of langFiles) {
    const tbl = tables[f];
    const missing = [...aliasUsed.keys()].filter((k) => !tbl[k] && !tbl['ui.' + k]);
    check(`[159-H10] ${f}: คีย์ที่เรียกผ่าน tr/tm/tKey มีครบ (ขาด 0)`, missing.length === 0,
          missing.length + ' ขาด: ' + missing.slice(0, 4).join(' · ') + (missing[0] ? '  (ที่ ' + aliasUsed.get(missing[0]) + ')' : ''));
  }
}

// ───────── [alpha.159 · H11] ข้อความ T`…` (msgid = ประโยคไทย) ต้องมีแถวในไฟล์ภาษา ─────────
// ไม่มีแถว = แปลไม่ได้ตลอดกาล (โชว์ไทยบนจอภาษาอังกฤษ) โดยไม่มีอะไรฟ้อง — เจอค้าง 71 ข้อความในรอบ alpha.159
{
  const { lexStrings: lexS, unescape: cooked } = require('../tools/js-lex.cjs');
  const esc = (x) => x.replace(/\{/g, '{{').replace(/\}/g, '}}');
  const msgidOf = (tk) => { let o = ''; for (let i = 0; i < tk.parts.length; i++) { o += esc(cooked(tk.parts[i])); if (i < tk.parts.length - 1) o += '{' + i + '}'; } return o; };
  const ids = new Map();
  for (const abs of srcFiles) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = fs.readFileSync(abs, 'utf8');
    const tstart = testStart(rel, raw);
    for (const tk of lexS(raw)) {
      if (tk.type !== 'tpl') continue;
      if (!/(^|[^A-Za-z0-9_$.])T\s*$/.test(raw.slice(Math.max(0, tk.start - 4), tk.start))) continue;
      if (tstart !== Infinity && tk.line >= tstart) continue;
      const id = msgidOf(tk);
      if (!ids.has(id)) ids.set(id, rel);
    }
  }
  for (const f of langFiles) {
    const missing = [...ids.keys()].filter((id) => !tables[f][id]);
    check(`[159-H11] ${f}: ข้อความ T\`…\` ทุกตัวมีแถว (ขาด 0)`, missing.length === 0,
          missing.length + ' ขาด: ' + missing.slice(0, 3).map((x) => JSON.stringify(x.slice(0, 30))).join(' · ')
          + (missing[0] ? '  (ที่ ' + ids.get(missing[0]) + ')' : ''));
  }
}

// ───────── [alpha.164 · A4] คีย์ที่เขียนเป็นสตริงเปล่า ๆ แล้วส่งต่อเป็นตัวแปร ─────────
// `mk('sceneNumbers', 'ui.xhub.pdfSceneNums')` → `tt(labelKey)` — ตัวกวาด CALL ข้างบนมองไม่เห็น
// เพราะคีย์ไม่ได้อยู่ในวงเล็บของ t() ตรง ๆ · คีย์นี้ขาดจริงและโชว์เป็นตัวคีย์บนจอกล่องส่งออก
// (e2e ก็ไม่ฟ้อง: เทียบ `lbls.includes(tt(key))` — tt คืนตัวคีย์ ป้ายก็เป็นตัวคีย์ = เท่ากัน)
{
  const lits = new Map();
  for (const abs of srcFiles) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = fs.readFileSync(abs, 'utf8');
    const tstart = testStart(rel, raw);
    for (const tk of lexStrings(raw)) {
      if (tk.type === 'tpl' && tk.parts.length > 1) continue;
      if (tstart !== Infinity && tk.line >= tstart) continue;
      const v = tk.parts[0];
      if (/^ui\.[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9_]*$/.test(v) && !lits.has(v)) lits.set(v, rel + ':' + tk.line);
    }
  }
  check('[164-A4] กวาดเจอคีย์ที่เป็นสตริงเปล่า ๆ', lits.size > 3000, lits.size);
  for (const f of langFiles) {
    const missing = [...lits.keys()].filter((k) => !(k in tables[f]));
    check(`[164-A4] ${f}: คีย์ที่ส่งต่อเป็นตัวแปรมีครบ (ขาด 0)`, missing.length === 0,
          missing.length + ' ขาด: ' + missing.slice(0, 4).join(' · ') + (missing[0] ? '  (ที่ ' + lits.get(missing[0]) + ')' : ''));
  }
}

// ───────── [alpha.164 · B1–B2] โน้ตนักพัฒนา / มาร์กดาวน์ดิบ ห้ามหลุดขึ้นจอ ─────────
// เจอบนหน้าตั้งค่า: `[บั๊ก 14]` · `[60r2 ข้อ 9]` · `[85]` · `[81][82][83]` · `(network-theme.js)` = เลขข้อจาก
// CHANGELOG ติดมากับข้อความ · `**ชื่อไฟล์**` / `` `k2_xx.csv` `` = คำใบ้ลง HTML ผ่าน tx() ซึ่งไม่ตีความมาร์กดาวน์
{
  const DEV_TAG = /\[\d{1,3}(r\d*)?( ข้อ \d+)?\]|\[บั๊ก|\[\d{1,3}[–-]\d{1,3}\]|\([a-z-]+\.(js|cjs)\)/;
  // คำสั่งถึง AI (prompt) ใช้มาร์กดาวน์เป็นภาษาของมันเอง — ไม่ใช่ข้อความบนจอ
  const PROMPT_KEY = /^ui\.(ai|aia|aiAgent|aiAssistant|aiCharacter|aiPlot|aiTools|aiDoctor|aiRewrite|aiWorld|aiSummary|aiDialogue|aiConsistency|aiTitle|aiChat|aiChatPanel|starter|aiStarter|aiPrompt)[A-Za-z]*\./;
  const MD_RAW = /\*\*[^*\n]+\*\*|`[^`\n]+`/;
  for (const f of langFiles) {
    const dev = Object.entries(tables[f]).filter(([k, v]) => k.startsWith('ui.') && DEV_TAG.test(v));
    check(`[164-B1] ${f}: ไม่มีเลขข้อของนักพัฒนาในข้อความ`, dev.length === 0,
          dev.slice(0, 3).map(([k, v]) => k + '=' + String(v).slice(0, 30)).join(' · '));
    const md = Object.entries(tables[f]).filter(([k, v]) => k.startsWith('ui.') && !PROMPT_KEY.test(k) && MD_RAW.test(v));
    check(`[164-B2] ${f}: ไม่มีมาร์กดาวน์ดิบในข้อความบนจอ`, md.length === 0,
          md.length + ': ' + md.slice(0, 4).map(([k]) => k).join(' · '));
  }
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
  let m;
  // [alpha.154 ข้อ 6] ★ ผู้ใช้: *"บอกแล้วว่าอย่า hardcode ... ภาษาอยู่ส่วนภาษา ไม่ซ้ำซ้อน"*
  // กฎเดิมยอมให้มีข้อความไทย "สำรอง" ใน HTML ถ้ามีคีย์กำกับ — ผลคือข้อความชุดเดียวกันอยู่สองที่
  // (HTML + CSV) และแก้ที่ CSV แล้ว HTML ก็ยังเป็นของเก่า · ตอนนี้: **ไม่มีไทยใน index.html เลย**
  // (นอกคอมเมนต์) — ข้อความทั้งหมดเติมจากไฟล์ภาษาผ่าน `applyDataI18n()` ตอนเริ่มโปรแกรม
  const bad = html.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => THAI.test(l))
    .map(([n, l]) => n + ': ' + l.trim().slice(0, 40));
  check('★ index.html ไม่มีข้อความไทยเลย (ข้อความมาจากไฟล์ภาษาเท่านั้น)', bad.length === 0,
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
// [alpha.150] อนุญาต `-` ในส่วนชื่อด้วย — คีย์คำอธิบายของปุ่ม (`ui.tip.<คำสั่ง>`) สร้างจาก
// id ของคำสั่งตรง ๆ ซึ่งมีขีดกลางอยู่แล้วทั้งระบบ (`editor-undo` · `toggle-panel:comments`)
// การแปลงชื่ออีกชั้นจะทำให้เกิด "ตารางแปลง id → คีย์" ซึ่งเป็นแหล่งความจริงที่สองทันที
const badShape = [...used.keys()].filter((k) => !/^ui\.[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9:-]*$/.test(k));
check('คีย์ทุกตัวอยู่ในรูป ui.<module>.<name>', badShape.length === 0, badShape.slice(0, 5).join(' · '));
// ═══════ [alpha.154] ★ ไฟล์ภาษาเก็บ "ข้อความล้วน" — ห้ามมีโครง HTML ═══════
//
// ผู้ใช้: *"ย้าย HTML ในกล่องตั้งค่าออกจาก CSV"* → *"ย้าย HTML ที่เหลือออกจาก CSV ด้วย"*
// โครงอยู่ในโค้ด (template + `tx()`/`txf()` จาก src/i18n-html.js) · คนแปลเห็นแต่ประโยค
// ยกเว้น: คำสั่งถึง AI ที่ **เอ่ยถึงแท็กเป็นคำ** (บอก AI ว่าให้ตอบเป็น <p> <b> / รูปแบบ JSON ที่มี "<id ฉาก>")
// ซึ่งไม่ใช่โครงหน้าจอ และคำแปลต้องมีคำนั้นอยู่จริง
const HTML_IN_TEXT_OK = new Set([
  'ui.aiCharacter.sceneIdAspectSeverityCritical',   // ตัวอย่าง JSON ในคำสั่ง AI: "sceneId":"<id ฉาก>"
  'ui.aiPlot.descriptionExplainProblemThai',        // ตัวอย่าง JSON ในคำสั่ง AI: "<id ของฉาก>"
  'ui.aiPlot.typeSeverityCriticalMajor',            // [alpha.164 · L-1] ตัวอย่าง JSON: "<type from the list above>" (ฉบับอังกฤษ)
  'ui.starter.pDescRule',                           // บอก AI ว่าให้ตอบด้วยแท็ก <p> <b> <i> <br> เท่านั้น
]);
const HTML_TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/;
for (const f of langFiles) {
  const tagged = Object.keys(tables[f]).filter((k) => !HTML_IN_TEXT_OK.has(k) && HTML_TAG.test(tables[f][k]));
  check(`★ ${f}: ไม่มีโครง HTML ในข้อความ (โครงอยู่ในโค้ด)`, tagged.length === 0,
        tagged.length + ' คีย์: ' + tagged.slice(0, 5).join(' · '));
}

const thaiKeys = Object.keys(tables[base]).filter((k) => THAI.test(k));
check('ไม่มีคีย์ที่เป็นข้อความไทยหลงเหลือในไฟล์ภาษา', thaiKeys.length === 0, thaiKeys.slice(0, 3).join(' · '));

console.log(`\n--- RESULT ---\nPASS ${pass}  FAIL ${fail}`);
if (fail) process.exit(1);
