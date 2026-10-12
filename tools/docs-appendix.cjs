#!/usr/bin/env node
// tools/docs-appendix.cjs — สร้างภาคผนวก A (เมนู) · B (คีย์ลัด) · C (คำสั่ง) ของคู่มือผู้ใช้จากโปรแกรมจริง
//
//   node tools/docs-appendix.cjs               ทุกภาษาที่มีทั้งข้อความ (docs-appendix-text.cjs) และโฟลเดอร์ docs/manual/<ภาษา>/
//   node tools/docs-appendix.cjs en            เฉพาะภาษา
//   node tools/docs-appendix.cjs --check       ไม่เขียนไฟล์ · จบด้วยรหัส 1 เมื่อไฟล์ในรีโปไม่ตรงกับที่สร้างได้ (= ภาคผนวกล้าสมัย)
//   node tools/docs-appendix.cjs --dump <dir>  เก็บข้อมูลดิบที่อ่านจากโปรแกรม (menu-<ภาษา>.txt · cheat-<ภาษา>.txt)
//   node tools/docs-appendix.cjs --from <dir>  สร้างจากข้อมูลดิบที่เก็บไว้ ไม่เปิดโปรแกรม
//
// ที่มาของข้อมูล (ไม่มีอะไรพิมพ์มือ):
//   A  เมนูระบบตัวจริง          kapi.menuLabels() ของโปรแกรมที่เปิดในภาษานั้น
//   B  กล่อง "ปุ่มลัดทั้งหมด"     คำสั่ง cheatsheet → ข้อความในกล่อง (ชื่อ · คีย์ · หมายเหตุ ตามที่ผู้ใช้เห็น)
//   C  ทะเบียนคำสั่ง            icons/commands.csv + คำอธิบาย ui.tip.<คำสั่ง> ใน languages/k2_<ภาษา>.csv
//
// ต้องรันเมื่อ: เพิ่ม/ย้าย/เปลี่ยนชื่อเมนู · เปลี่ยนคีย์ลัดตั้งต้น · เพิ่มคำสั่ง · แก้คำอธิบายคำสั่ง · ขึ้นเลขรุ่น
// (ภาคผนวกพิมพ์เลขรุ่นของ package.json ไว้ที่หัว)
//
// ตัวสร้างเปิดโปรแกรมเองหนึ่งรอบต่อภาษา: โหมดเทสที่ไม่รันชุด e2e (KILLIAN_TEST=1 + KILLIAN_TEST_NORUN=1)
// ข้อมูลผู้ใช้แยกในโฟลเดอร์ชั่วคราว (KILLIAN_USERDATA) · โปรเจกต์ตัวอย่างจาก tools/demo-project.cjs · ขับผ่าน CDP
// ใช้ fetch/WebSocket ของ Node (22 ขึ้นไป) — ไม่มี dependency เพิ่ม · บน Linux ที่ไม่มีจอให้ครอบด้วย xvfb-run
// ห้ามรันพร้อม e2e (แย่งหน้าต่างกัน)
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { parseCsv } = require('./csv-lite.cjs');
const { TEXT } = require('./docs-appendix-text.cjs');

const ROOT = path.join(__dirname, '..');
const MANUAL = path.join(ROOT, 'docs', 'manual');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const NL = '\n';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────── ตัวช่วยของข้อความ ─────────────────────────

// อักขระของฟอนต์ K2 Icons (Private Use Area) ไม่มีความหมายนอกโปรแกรม → ตัดทิ้ง
// (ประกอบจากเลขรหัส ไม่พิมพ์อักขระล่องหนลงซอร์ส)
const cp = String.fromCodePoint;
const PUA = new RegExp('[' + cp(0xE000) + '-' + cp(0xF8FF) + cp(0xF0000) + '-' + cp(0x10FFFD) + ']', 'gu');
const noPua = (s) => String(s || '').replace(PUA, '').replace(/\s{2,}/g, ' ').trim();
// ข้อความในช่องตาราง: | ต้องไม่ปิดช่อง · < ต้องไม่ถูกอ่านเป็นแท็ก
const esc = (s) => String(s || '').split('|').join('&#124;').split('<').join('&lt;');
const table = (header, rows) => '| ' + header.join(' | ') + ' |' + NL + '|' + header.map(() => '---').join('|') + '|' + NL
  + rows.map((r) => '| ' + r.join(' | ') + ' |').join(NL) + NL;

// หมวดของภาคผนวก C — ลำดับ = ลำดับในเอกสาร · คำสั่งเข้าหมวดแรกที่ตรง · ชื่อหมวดอยู่ในไฟล์ข้อความ (cGroups)
// คำสั่งใหม่ที่ไม่ตรงหมวดไหนตกไปอยู่ "ช่วยเหลือ · ระบบ" — เพิ่มคำนำหน้าของมันในหมวดที่ควรอยู่ที่นี่
const C_GROUPS = [
  ['create', /^(chapter|character|location|memo|scene|quick-note|new-entity|scratchpad)(:|$)/],
  ['file', /^(new-project|new-from-template|open-project|open-project-path|save|save-all|save-as|revert|close-tab|close-all-tabs|next-tab|prev-tab|reopen-closed-tab|backup-now|project-doctor|project-setup|settings|home|confirm-quit|sync-scene-meta|custom-status|visual-tags|lang-fonts)$/],
  ['io', /^(export-|import-|compile|print$)/],
  ['edit', /^(editor-|find|replace|global-search|project-replace|goto|quick-open|select-scene|delete-line|nbsp|insert-|thesaurus|char-map|all-notes|comments|word-history|smart-manage|reveal-active|ui:find)/],
  ['format', /^(fmt|text-case|prose-|ui:tb-(case|color|highlight|indent|quote|source))/],
  ['screenplay', /^(sp-|set-format|toggle-format|scene-numbers|page-numbers|page-headers|page-setup|title-pages|roster|remove-elements|onset-toggle|ui:tb-sp)/],
  ['view', /^(zoom|ui-scale|focus-mode|reading-mode|read-book|typewriter|line-numbers|markdown-codes|page-guides|auto-fit-width|toggle-theme|toggle-fab|fmtbar-|split-|toolbar-config|toggle-home-always|toggle-open-last|ui:filter)/],
  ['panels', /^(toggle-panel|show-panel|panels-|panel-system|reset-panels|workspace|kanban|gallery|dashboard|books|chapters|timeline|maps|network|planner|branching|branch-sync|floorplan|player-|sprint)/],
  ['ai', /^(ai-|story-starter)/],
  ['a11y', /^(a11y-settings|key-echo|line-band|osk|type-sound)$/],
  ['help', /^/],
];
// คำสั่งของชุดเทส ไม่ใช่ของผู้ใช้
const C_SKIP = new Set(['plugin:k2test:hello', 'test-run']);

// ───────────────────────── สร้างเอกสาร (ข้อมูลดิบ → Markdown) ─────────────────────────

// ภาษาที่คู่มือมีจริง (มีทั้งข้อความและโฟลเดอร์) — ใช้ทำลิงก์สลับภาษาใต้หัวเรื่องของทุกหน้า
const DOC_LANGS = Object.keys(TEXT).filter((l) => fs.existsSync(path.join(MANUAL, l)));
function pageHead(T, lang, title, file) {
  const others = DOC_LANGS.filter((l) => l !== lang).map((l) => '[' + TEXT[l].linkName + '](../' + l + '/' + file + ')');
  const langLine = others.length ? '**' + T.langWord + ':** ' + [T.selfName, ...others].join(' · ') + NL + NL : '';
  return '# ' + title + NL + NL + langLine + T.head(VERSION);
}

function buildMenus(T, lang, menuLines) {
  let md = pageHead(T, lang, T.aTitle, 'A-menus.md') + T.aIntro.join(NL + NL) + NL + NL;
  const problems = [];
  let sawRecent = false;
  for (const line of menuLines) {
    const parts = line.split(' > ');
    const label = parts[parts.length - 1];
    if (parts.length === 1) {
      const name = T.menuRename[label] || label;
      md += NL + '## ' + T.menuHeading(name) + NL + NL;
      if (T.menuNote[name]) md += T.menuNote[name] + NL + NL;
      continue;
    }
    const indent = '  '.repeat(parts.length - 2);
    if (parts[0] === T.recentPath[0] && parts[1] === T.recentPath[1]) {
      if (parts.length === 2) sawRecent = true;
      // รายการข้างใต้เป็นทางโฟลเดอร์ของเครื่องที่รันตัวสร้าง → แทนด้วยคำอธิบายบรรทัดเดียว
      if (parts.length === 3) { if (!md.endsWith(T.recentNote + NL)) md += '    - ' + T.recentNote + NL; continue; }
    }
    if (label === 'Toggle Developer Tools') { md += indent + '- Toggle Developer Tools ' + T.devToolsNote + NL; continue; }
    const isHead = /^— .* —$/.test(label);
    md += indent + (isHead ? '- **' + label.replace(/—/g, '').trim() + '**' : '- ' + esc(label)) + NL;
  }
  if (!sawRecent) problems.push('ไม่เจอเมนู "' + T.recentPath.join(' > ') + '" — ป้ายเมนูเปลี่ยน? แก้ recentPath ใน docs-appendix-text.cjs');
  md += NL + '---' + NL + NL + T.aSeeAlso + NL;
  return { md, problems };
}

function buildShortcuts(T, lang, cheatText) {
  const raw = String(cheatText || '').split(/\r?\n/).map(noPua);
  const isKey = (s) => /^(Ctrl|Alt|Shift|F\d)/.test(s);
  const keyCell = (k) => '`' + k.split('`').join('` `` ` `` `') + '`';
  let md = pageHead(T, lang, T.bTitle, 'B-shortcuts.md') + T.bIntro.join(NL) + NL + NL;
  const problems = [];
  const seenCats = new Set();
  let open = false, pending = null, count = 0;
  const rows = [];
  const flush = () => { if (!rows.length) return; md += table(T.bHeader, rows) + NL; rows.length = 0; };
  for (let i = 1; i < raw.length; i++) {            // บรรทัดแรก = ชื่อกล่อง
    const s = raw[i];
    if (!s || s === T.cheatClose) continue;
    if (T.cheatCats.includes(s)) { flush(); md += '## ' + s + NL + NL; open = true; pending = null; seenCats.add(s); continue; }
    if (!open) continue;
    if (isKey(s)) {
      if (pending && !T.cheatOdd.includes(pending.name)) { rows.push([esc(pending.name), keyCell(s), esc(pending.note)]); count++; }
      pending = null;
      continue;
    }
    if (pending) pending.note = (pending.note ? pending.note + ' ' : '') + s;     // บรรทัดคำอธิบายใต้ชื่อ
    else pending = { name: s, note: '' };
  }
  flush();
  const missing = T.cheatCats.filter((c) => !seenCats.has(c));
  if (missing.length) problems.push('ไม่เจอหมวดในกล่องปุ่มลัด: ' + missing.join(' · ') + ' — ชื่อหมวดเปลี่ยน? แก้ cheatCats ใน docs-appendix-text.cjs');
  if (count < 50) problems.push('อ่านคีย์ลัดจากกล่องได้แค่ ' + count + ' แถว — กล่อง "ปุ่มลัดทั้งหมด" เปลี่ยนโครง?');
  md += '## ' + T.bFixedTitle + NL + NL + table(T.bFixedHeader, T.bFixed) + NL + '---' + NL + NL + T.bSeeAlso + NL;
  return { md, problems, count };
}

function buildCommands(T, lang) {
  const tips = Object.create(null);
  for (const r of parseCsv(fs.readFileSync(path.join(ROOT, 'languages', 'k2_' + lang + '.csv'), 'utf8'))) {
    if (r[0] && !(r[0] in tips)) tips[r[0]] = r[1] || '';
  }
  const cmds = parseCsv(fs.readFileSync(path.join(ROOT, 'icons', 'commands.csv'), 'utf8')).slice(1).filter((r) => r[0]);
  const scOf = Object.fromEntries(cmds.map((r) => [r[0], r[2] || '']));
  // {sc:คำสั่ง} ในคำอธิบาย = คีย์ลัดของคำสั่งนั้น (ในโปรแกรมตามที่ผู้ใช้ตั้ง · ในเอกสารใช้ค่าเริ่มต้น)
  const withSc = (s) => noPua(String(s || '').replace(/\{sc:([^}]+)\}/g, (m, id) => scOf[id] || id));
  const buckets = C_GROUPS.map(() => []);
  const noTip = [];
  for (const [id, , sc] of cmds) {
    if (C_SKIP.has(id)) continue;
    const tip = tips['ui.tip.' + id];
    if (!tip) noTip.push(id);
    buckets[C_GROUPS.findIndex((g) => g[1].test(id))].push(['`' + id + '`', sc ? '`' + sc + '`' : '', esc(withSc(tip || ''))]);
  }
  let md = pageHead(T, lang, T.cTitle, 'C-commands.md') + T.cIntro.join(NL) + NL + NL;
  C_GROUPS.forEach((g, i) => {
    if (!buckets[i].length) return;
    md += '## ' + T.cGroups[g[0]] + NL + NL + table(T.cHeader, buckets[i]) + NL;
  });
  md += '---' + NL + NL + T.cSeeAlso + NL;
  const problems = noTip.length ? ['คำสั่งที่ไม่มีคำอธิบาย ui.tip.* ในภาษา ' + lang + ': ' + noTip.join(' ')] : [];
  return { md, problems, count: cmds.length - C_SKIP.size };
}

// ───────────────────────── อ่านจากโปรแกรมจริง ─────────────────────────

function electronExe() {
  const dir = path.join(ROOT, 'node_modules', 'electron');
  const tries = [];
  try { tries.push(path.join(dir, 'dist', fs.readFileSync(path.join(dir, 'path.txt'), 'utf8').trim())); } catch {}
  // node_modules ที่ซิงก์ข้ามระบบมี path.txt ของอีกระบบ — ลองชื่อของระบบนี้ตรง ๆ ด้วย
  tries.push(path.join(dir, 'dist', 'electron.exe'), path.join(dir, 'dist', 'electron'),
    path.join(dir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'));
  const hit = tries.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('ไม่พบ Electron ใน node_modules/electron/dist — รัน npm install ก่อน');
  return hit;
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.on('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

async function connect(port, child) {
  const deadline = Date.now() + 60000;
  let page = null;
  while (!page) {
    if (child.exitCode != null) throw new Error('โปรแกรมปิดตัวก่อนต่อได้ (รหัส ' + child.exitCode + ')');
    if (Date.now() > deadline) throw new Error('รอหน้าต่างของโปรแกรมเกิน 60 วินาที');
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      page = list.find((p) => p.type === 'page' && p.url.includes('index.html'));
    } catch {}
    if (!page) await sleep(300);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ต่อ CDP ไม่ได้')); });
  let id = 0;
  const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const bad = r.result && r.result.exceptionDetails;
    if (bad) throw new Error(JSON.stringify(bad.exception || bad).slice(0, 600));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  return { ev, close: () => { try { ws.close(); } catch {} } };
}

async function until(fn, ms, what) {
  const deadline = Date.now() + ms;
  for (;;) {
    let v = null;
    try { v = await fn(); } catch {}
    if (v) return v;
    if (Date.now() > deadline) throw new Error('รอ' + what + 'เกิน ' + Math.round(ms / 1000) + ' วินาที');
    await sleep(250);
  }
}

function killTree(child) {
  if (child.exitCode != null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { child.kill('SIGKILL'); } catch {} }
}

function rmQuiet(dir) {
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return; } catch {}
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 400)']);        // ไฟล์ของ Chromium ยังถูกล็อกชั่วครู่หลังปิด
  }
}

/** เปิดโปรแกรมในภาษา lang แล้วอ่าน เมนูระบบ + ข้อความของกล่อง "ปุ่มลัดทั้งหมด" */
async function collect(lang, projDir) {
  if (typeof WebSocket === 'undefined' || typeof fetch === 'undefined') throw new Error('ต้องใช้ Node 22 ขึ้นไป (fetch + WebSocket ในตัว)');
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'k2docs-ud-'));
  // ภาษาของโปรแกรม = ไฟล์ตั้งค่าผู้ใช้ (language + ธง languagePicked) — main อ่านก่อนสร้างเมนู
  fs.writeFileSync(path.join(ud, 'settings.json'), JSON.stringify({ language: lang, languagePicked: true }));
  const port = await freePort();
  const child = spawn(electronExe(), [ROOT, '--remote-debugging-port=' + port,
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], {
    stdio: 'ignore',
    env: { ...process.env, KILLIAN_TEST: '1', KILLIAN_TEST_NORUN: '1', KILLIAN_NO_SPLASH: '1', KILLIAN_USERDATA: ud },
  });
  let cdp = null;
  try {
    cdp = await connect(port, child);
    await until(() => cdp.ev('!!(window.__k2dev && window.kapi)'), 60000, 'โปรแกรมพร้อม');
    const got = await until(() => cdp.ev('document.documentElement.lang'), 15000, 'ภาษาของหน้าจอ');
    if (got !== lang) throw new Error('หน้าจอเป็นภาษา "' + got + '" ไม่ใช่ "' + lang + '" — มีไฟล์ languages/k2_' + lang + '.csv ไหม');
    await cdp.ev('window.__k2dev.loadProject(' + JSON.stringify(projDir) + ').then(() => { window.__k2dev.resetPanels(); return 1; })');
    await sleep(1500);
    const menu = await cdp.ev('window.kapi.menuLabels()');
    if (!Array.isArray(menu) || menu.length < 50) throw new Error('อ่านเมนูระบบได้ ' + (menu ? menu.length : 0) + ' รายการ');
    await cdp.ev('document.querySelectorAll(".k-overlay").forEach((o) => o.remove()); window.__k2dev.handleCommand("cheatsheet"); 1');
    const dlg = '(() => { const d = [...document.querySelectorAll(".k-overlay .k-dialog")].pop(); return d ? d.innerText : ""; })()';
    let cheat = '';
    await until(async () => { const now = await cdp.ev(dlg); const same = now.length > 500 && now === cheat; cheat = now; return same; }, 15000, 'กล่องปุ่มลัด');
    return { menu, cheat };
  } finally {
    if (cdp) cdp.close();
    killTree(child);
    rmQuiet(ud);
  }
}

// ───────────────────────── คำสั่ง ─────────────────────────

(async () => {
  const argv = process.argv.slice(2);
  const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v || ''; };
  const dumpDir = opt('--dump');
  const fromDir = opt('--from');
  const check = argv.includes('--check');
  const want = argv.filter((a) => !a.startsWith('--'));
  const unknown = want.filter((l) => !TEXT[l]);
  if (unknown.length) { console.error('ไม่มีข้อความของภาษา: ' + unknown.join(' ') + ' (เพิ่มใน tools/docs-appendix-text.cjs)'); process.exit(2); }
  const langs = (want.length ? want : Object.keys(TEXT)).filter((l) => fs.existsSync(path.join(MANUAL, l)));
  if (!langs.length) { console.error('ไม่พบโฟลเดอร์ docs/manual/<ภาษา>/ ของภาษาที่ขอ'); process.exit(2); }

  let projDir = null;
  if (!fromDir) {
    projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k2docs-proj-'));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'demo-project.cjs'), projDir], { stdio: 'ignore' });
    if (r.status !== 0) { console.error('สร้างโปรเจกต์ตัวอย่างไม่ได้ (tools/demo-project.cjs)'); process.exit(1); }
  }
  if (dumpDir) fs.mkdirSync(dumpDir, { recursive: true });

  let stale = 0, failed = 0;
  try {
    for (const lang of langs) {
      const T = TEXT[lang];
      let raw;
      if (fromDir) {
        raw = { menu: fs.readFileSync(path.join(fromDir, 'menu-' + lang + '.txt'), 'utf8').split(/\r?\n/).filter(Boolean),
                cheat: fs.readFileSync(path.join(fromDir, 'cheat-' + lang + '.txt'), 'utf8') };
      } else {
        process.stdout.write('[' + lang + '] เปิดโปรแกรม… ');
        raw = await collect(lang, projDir);
        console.log('เมนู ' + raw.menu.length + ' รายการ');
      }
      if (dumpDir) {
        fs.writeFileSync(path.join(dumpDir, 'menu-' + lang + '.txt'), raw.menu.join(NL));
        fs.writeFileSync(path.join(dumpDir, 'cheat-' + lang + '.txt'), raw.cheat);
      }
      const a = buildMenus(T, lang, raw.menu);
      const b = buildShortcuts(T, lang, raw.cheat);
      const c = buildCommands(T, lang);
      const problems = [...a.problems, ...b.problems, ...c.problems];
      for (const p of problems) console.error('[' + lang + '] ✗ ' + p);
      if (problems.length) { failed++; continue; }                 // ข้อมูลไม่ครบ = ไม่เขียนทับของเดิม
      const files = [['A-menus.md', a.md], ['B-shortcuts.md', b.md], ['C-commands.md', c.md]];
      const changed = [];
      for (const [name, md] of files) {
        const file = path.join(MANUAL, lang, name);
        const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
        if (old === md) continue;
        changed.push(name);
        if (!check) fs.writeFileSync(file, md);
      }
      stale += changed.length;
      console.log('[' + lang + '] คีย์ลัด ' + b.count + ' แถว · คำสั่ง ' + c.count + ' ตัว · '
        + (changed.length ? (check ? 'ไม่ตรงกับไฟล์ในรีโป: ' : 'เขียนใหม่: ') + changed.join(' ') : 'ตรงกับไฟล์ในรีโปแล้ว'));
    }
  } catch (e) {
    console.error('\n✗ ' + e.message);
    failed++;
  } finally {
    if (projDir) rmQuiet(projDir);
  }
  process.exit(failed ? 1 : (check && stale ? 1 : 0));
})();
