// test/en-ui-round2.test.cjs — [alpha.164 · รอบต่อ 2] ตรวจ UI ภาษาอังกฤษบนแอปจริง แล้วตรึงสิ่งที่เจอไว้
//
// (1) ชนิดความสัมพันธ์เคยเป็นไทยตายตัวใน `label` → โผล่ไทยในกล่องผูกความสัมพันธ์/ปุ่มกรองผัง/หน้าตั้งค่าสีผัง
// (2) ชื่อช่องสีของผังเคยแปลตอน import → เปลี่ยนภาษาแล้วค้างภาษาเดิม (บทเรียนข้อ 37)
// (3) "เสียงเครื่องพิมพ์ดีด" ย้ายจากเมนูมุมมอง → เมนูเครื่องมือ (ผู้ใช้ตัดสินในรอบนี้)
// (4) ป้ายใต้ตัวเลขของแดชบอร์ด/วิเคราะห์เป็นพหูพจน์ ("2 Scenes" ไม่ใช่ "2 Scene")
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const os = require('os');

const entry = path.join(os.tmpdir(), '_en2-entry.mjs');
fs.writeFileSync(entry, [
  `export * from ${JSON.stringify(path.join(__dirname, '../src/network-theme.js'))};`,
  `export { REL_TYPES, REL_LABEL } from ${JSON.stringify(path.join(__dirname, '../src/relationship-types.js'))};`,
  `export { setTable, csvToTable, formatMsg } from ${JSON.stringify(path.join(__dirname, '../src/i18n.js'))};`,
  `export { hf } from ${JSON.stringify(path.join(__dirname, '../src/i18n-html.js'))};`,
].join('\n'));
const out = path.join(os.tmpdir(), '_en2.cjs');
require('esbuild').buildSync({ entryPoints: [entry], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const M = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };
const TH = /[฀-๿]/;
const useLang = (code) => {
  const csv = fs.readFileSync(path.join(__dirname, '..', 'languages', 'k2_' + code + '.csv'), 'utf8');
  M.setTable(M.csvToTable(csv), code);
};

// ═══════════ (1)+(2) ป้ายตามภาษาที่โหลด "ตอนอ่าน" ═══════════
{
  useLang('th');
  const thRel = M.REL_TYPES.map((x) => x.label);
  check('ไทย: ชื่อประเภทความสัมพันธ์เป็นไทย', thRel.every((l) => TH.test(l)), thRel.join(','));
  const thNet = M.NET_COLOR_DEFS.map((d) => d.label);
  useLang('en');
  const enRel = M.REL_TYPES.map((x) => x.label);
  check('★ อังกฤษ: ชื่อประเภทความสัมพันธ์ไม่มีไทยเลย', enRel.every((l) => l && !TH.test(l)), enRel.join(','));
  check('อังกฤษ: ไม่มีคีย์ดิบหลุด (ui.relType.*)', enRel.every((l) => !/^ui\./.test(l)), enRel.join(','));
  check('REL_LABEL ตามภาษาเดียวกับ REL_TYPES', M.REL_TYPES.every((x) => M.REL_LABEL[x.key] === x.label));
  const enNet = M.NET_COLOR_DEFS.map((d) => d.label);
  check('★ ชื่อช่องสีผังเปลี่ยนตามภาษาโดยไม่ต้อง import ใหม่',
        enNet.every((l, i) => l && l !== thNet[i]), enNet.filter((l, i) => l === thNet[i]).join(','));
  check('อังกฤษ: ชื่อช่องสีผังไม่มีไทย', enNet.every((l) => !TH.test(l)), enNet.filter((l) => TH.test(l)).join(','));
  check('หัวกลุ่มสีผังเปลี่ยนตามภาษาด้วย', M.NET_COLOR_GROUPS.every((g) => g.label && !TH.test(g.label)));
  check('ปุ่มเมาส์ของผังเปลี่ยนตามภาษาด้วย', M.MOUSE_BUTTONS.every((b) => b.label && !TH.test(b.label)));
  check('ช่องสีเส้นยังผูกกับ key ของประเภทเดิม (ไฟล์ตั้งค่าเก่าอ่านได้)',
        M.REL_TYPES.every((x) => M.NET_COLOR_DEFS.some((d) => d.key === 'ne-rt-' + x.key && d.id === x.key)));
  useLang('th');
}

// ═══════════ (3) เมนู ═══════════
{
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const tools = main.slice(main.indexOf("{ id: 'Tools'"), main.indexOf("{ id: 'View'"));
  const view = main.slice(main.indexOf("{ id: 'View'"), main.indexOf("{ id: 'Help'"));
  check('★ สวิตช์เสียงพิมพ์ดีดอยู่เมนูเครื่องมือ', /cmd\('type-sound'\)/.test(tools));
  check('★ สวิตช์เสียงพิมพ์ดีดไม่อยู่เมนูมุมมองแล้ว', !/cmd\('type-sound'\)/.test(view));
  check('โหมดเครื่องพิมพ์ดีด (มุมมอง) ยังอยู่เมนูมุมมอง', /cmd\('typewriter'\)/.test(view));
}

// ═══════════ (4) พหูพจน์ของป้ายสถิติ ═══════════
{
  const en = M.csvToTable(fs.readFileSync(path.join(__dirname, '..', 'languages', 'k2_en.csv'), 'utf8'));
  for (const k of ['ui.dash.statBooks', 'ui.dash.statChapters', 'ui.dash.statScenes']) {
    check('ป้ายสถิติเป็นพหูพจน์: ' + k, /s$/.test(en[k] || ''), en[k]);
  }
  const dash = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.js'), 'utf8');
  const aia = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai-analyzer-ui.js'), 'utf8');
  check('แดชบอร์ดใช้ป้ายพหูพจน์', /ui\.dash\.statScenes/.test(dash) && /ui\.dash\.statChapters/.test(dash));
  check('หน้าวิเคราะห์ใช้ป้ายพหูพจน์', /ui\.dash\.statScenes/.test(aia) && /ui\.dash\.statBooks/.test(aia));
  check('ไม่มี "used {1} times" (1 times)', !Object.values(en).some((v) => /used \{\d\} times/.test(v)));
}

// ═══════════ (4b) รูปพหูพจน์ `{0|page|pages}` ═══════════
{
  check('พหูพจน์: 1 = เอกพจน์', M.formatMsg('{0} {0|page|pages}', [1]) === '1 page');
  check('พหูพจน์: 2 = พหูพจน์', M.formatMsg('{0} {0|page|pages}', [2]) === '2 pages');
  check('พหูพจน์: 0 = พหูพจน์', M.formatMsg('{0} {0|page|pages}', [0]) === '0 pages');
  check('พหูพจน์: ตัวเลขที่จัดรูปแล้ว "1,000"', M.formatMsg('{0} {0|word|words}', ['1,000']) === '1,000 words');
  check('พหูพจน์: ช่องอื่นยังแทนค่าตามปกติ', M.formatMsg('{1} of {0} {0|file|files}', [1, 'x']) === 'x of 1 file');
  check('{{ }} ยังคลายเหมือนเดิม', M.formatMsg('{{a}} {0}', [5]) === '{a} 5');
  check('hf (HTML) รู้จักพหูพจน์ + escape ส่วนของไฟล์ภาษา', M.hf('<{0} {0|line|lines}>', [1]) === '&lt;1 line&gt;');
  check('hf ช่องธรรมดาไม่ escape (ค่าที่คนเรียกเตรียมมาแล้ว)', M.hf('{0}', ['<b>']) === '<b>');
  // main.js มีตัวแทนค่าของตัวเอง — ต้องกติกาเดียวกัน
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  check('main.js tf รู้จักพหูพจน์', /const fillSlots = [^\n]*\\\|/.test(main) && /return fillSlots\(tpl, vals\)/.test(main));
  // ไฟล์อังกฤษ: "{N} words/pages/..." ต้องมีรูปพหูพจน์คู่เสมอ
  const enRaw = fs.readFileSync(path.join(__dirname, '..', 'languages', 'k2_en.csv'), 'utf8');
  const bare = enRaw.split(/\r?\n/).filter((l) => /\{\d+\} (words|pages|scenes|chapters|files|lines|times)\b/.test(l));
  check('★ อังกฤษไม่มี "{N} pages" แบบไม่มีรูปเอกพจน์', bare.length === 0, bare.slice(0, 3).join(' | '));
}

// ═══════════ (4c) [รอบต่อ 3] กวาดทั่วไป: คำนามพหูพจน์หลัง {N} ต้องมีรูปคู่ ═══════════
// เดิมด่านรู้จักแค่ 7 คำ → "1 mentions" · "1 issues" · "1 images" ยังหลุดอีก 150 แถว
// ตอนนี้: `{N} [คำขยาย ]<คำลงท้าย s>` ทุกแถว ต้องเป็น `{N} [คำขยาย ]{N|x|xs}` — ยกเว้นกริยา/คำที่ไม่ใช่คำนาม
// และแถวที่ {N} ไม่ใช่จำนวน (ต้องประกาศพร้อมเหตุผล)
{
  const enRaw = fs.readFileSync(path.join(__dirname, '..', 'languages', 'k2_en.csv'), 'utf8');
  const NOT_NOUN = new Set(['is', 'has', 'was', 'as', 'says', 'sees', 'decides', 'does', 'goes', 'needs', 'uses', 'gets',
    'makes', 'calls', 'keeps', 'looks', 'seems', 'wants', 'means', 'remains', 'appears', 'contains', 'exists', 'its',
    'this', 'his', 'us', 'yes', 'plus', 'across', 'less', 'unless', 'always']);
  const NOT_COUNT = {
    'ui.app.hideEmptyCatHide': 'บันทึกวินิจฉัย — "categories" เป็นป้ายของค่าถัดไป ไม่ใช่นามของ {2}',
    'ui.app.plannerTreeCheckImage': 'บันทึกวินิจฉัย — {1} คือชื่อหมวด "rows=" เป็นป้าย',
    'ui.panelExport.dockAreaWritePanel': '{0} คือชื่อฝั่ง (dock left/right) — "splits" เป็นกริยา',
  };
  const bad = [];
  let key = '', pluralRows = 0;
  for (const line of enRaw.split(/\r?\n/)) {
    const m = /^([a-zA-Z][\w.:-]*),/.exec(line);
    if (m) key = m[1];
    if (/\{\d+\|[^|{}]*\|[^{}]*\}/.test(line)) pluralRows++;
    if (NOT_COUNT[key]) continue;
    const re = /\{(\d+)\} (?:([A-Za-z-]+) )?([a-z]{2,}s)\b(?![|}])/g;
    for (let x; (x = re.exec(line));) {
      if (NOT_NOUN.has(x[3]) || (x[2] && NOT_NOUN.has(x[2]))) continue;
      bad.push(key + ' :: ' + x[0]);
    }
    if (/\{\d+\} (?:[A-Za-z-]+ )?[a-z]+\(s\)/.test(line)) bad.push(key + ' :: (s)');
  }
  check('★★ อังกฤษ: คำนามพหูพจน์หลัง {N} มีรูปเอกพจน์คู่ทุกแถว', bad.length === 0, bad.slice(0, 5).join(' | '));
  check('รูปพหูพจน์ถูกใช้จริงหลายแถว (กันด่านหลวมเพราะไฟล์อ่านผิด)', pluralRows > 250, pluralRows);
  check('ข้อยกเว้นทุกตัวชี้แถวที่มีอยู่จริง', Object.keys(NOT_COUNT).every((k) => enRaw.includes('\n' + k + ',')));
  // รูปพหูพจน์ต้องชี้ช่องที่มีตัวเลขจริงในแถวเดียวกัน · เอกพจน์ ≠ พหูพจน์
  const orphan = [];
  for (const line of enRaw.split(/\r?\n/)) {
    for (const x of line.matchAll(/\{(\d+)\|([^|{}]*)\|([^{}]*)\}/g)) {
      if (!line.includes('{' + x[1] + '}') || x[2] === x[3]) orphan.push(line.slice(0, 60));
    }
  }
  check('รูปพหูพจน์ทุกตัวมี {N} คู่ในแถวเดียวกัน', orphan.length === 0, orphan.slice(0, 3).join(' | '));
  const en = M.csvToTable(enRaw);
  useLang('en');
  check('ตัวอย่างจริง: 1 mention', M.formatMsg(en['ui.aia.rowScreentime'], [1, 1]) === '1 scene · 1 mention', M.formatMsg(en['ui.aia.rowScreentime'], [1, 1]));
  check('ตัวอย่างจริง: 1 tab has (กริยาตามจำนวน)', M.formatMsg(en['ui.app.closeAllDirtyAsk'], [1]) === '1 tab has unsaved changes');
  check('ตัวอย่างจริง: 3 tabs have', M.formatMsg(en['ui.app.closeAllDirtyAsk'], [3]) === '3 tabs have unsaved changes');
  check('ตัวอย่างจริง: 1 entry (คำพหูพจน์ไม่ปกติ)', /1 Wiki entry\)/.test(M.formatMsg(en['ui.aiSum.busySendAISummary'], [2, 1])));
  useLang('th');
}

// ═══════════ (5) ตัวโหลดภาษาตอนบูตต้องไม่ทับด้วยไทยตายตัว ═══════════
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  check('★ บูตไม่เรียก loadLanguage(DEFAULT_SETTINGS.language) ตรง ๆ', !/loadLanguage\(DEFAULT_SETTINGS\.language\)/.test(app));
  check('bootSequence โหลดภาษาของตั้งค่าผู้ใช้ก่อนหน้าแรก',
        /g\.language && g\.language !== i18n\.lang/.test(app));
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const fn = main.slice(main.indexOf('function lastLangCode'), main.indexOf('function saveLangCode'));
  check('lastLangCode ดูภาษาในตั้งค่าผู้ใช้ก่อนตกเป็นไทย', /globalSettingsPath\(\)/.test(fn));
}

console.log(`en-ui-round2: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
