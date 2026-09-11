// test/commands-registry.test.cjs — [alpha.147] ทะเบียนคำสั่ง: ไอคอน + คีย์ลัด แยกออกจากข้อความ
//
// ผู้ใช้: *"แยก icon กับข้อความ · เปลี่ยนก็แค่ใส่ svg ใหม่ลงโฟลเดอร์ชื่อเดิม · ทำ csv ของทุกคำสั่ง
//          (ย้ำว่าทุกคำสั่ง) · ไม่ต้องการไอคอนก็ blank · shortcut ต้องแยก เพราะคุณชอบลืมใส่ใน ui"*
//
// ประตูกันพลาดที่ต้องมี (ของที่หลุดง่ายที่สุดตอนมีคนเพิ่มคำสั่ง/ปุ่มใหม่):
//   1. คำสั่งใหม่ใน handleCommand / เมนู / ปุ่ม ที่ยังไม่มีแถวใน icons/commands.csv
//   2. src/generated/commands-data.js ไม่ตรงกับ CSV (แก้ CSV แล้วลืม build)
//   3. ชื่อไอคอนที่ไม่มีทั้ง svg และตัวสำรอง (→ ช่องว่างบนจอ · เคยเกิดกับ 'arrow-down' มาหลายรุ่น)
//   4. อีโมจิ/คีย์ลัดไหลกลับเข้าไฟล์ภาษา · `{sc:…}` ที่ชี้ไปคำสั่งที่ไม่มีคีย์ลัด
//   5. เมนูระบบที่เขียน `() => send(…)` แทน `cmd(…)` → รายการนั้นไม่ได้ accelerator
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseCsv, lexCsv } = require('../tools/csv-lite.cjs');
const CD = require('../tools/commands-data.cjs');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const data = CD.buildCommandsData(ROOT);
const rows = CD.readCsvObjects(path.join(ROOT, 'icons/commands.csv'));
const ids = new Set(rows.map((r) => r.command_id));

// ═══════════ 1. ตัวแปลงคีย์ลัด ═══════════
{
  const p = CD.parseShortcut('Ctrl+Alt+Shift+K');
  check('parseShortcut Ctrl+Alt+Shift+K', p.code === 'KeyK' && p.ctrl === 'ctrl+alt' && p.shift === true, JSON.stringify(p));
  check('parseShortcut Ctrl+Alt+/ (ปุ่ม / เป็นคีย์จริง)', CD.parseShortcut('Ctrl+Alt+/').code === 'Slash');
  check('parseShortcut Ctrl+, → Comma', CD.parseShortcut('Ctrl+,').code === 'Comma');
  check('parseShortcut Ctrl+Shift+Delete', CD.parseShortcut('Ctrl+Shift+Delete').code === 'Delete');
  check('parseShortcut ⌘⇧ ใช้ได้เหมือน Ctrl/Shift', CD.parseShortcut('⌘+⇧+E').ctrl === true);
  let threw = false; try { CD.parseShortcut('Alt+K'); } catch { threw = true; }
  check('Alt ที่ไม่มี Ctrl = เขียนผิด (ตัวดักคีย์ไม่รองรับ)', threw);
  threw = false; try { CD.parseShortcut('Ctrl+Hyper+K'); } catch { threw = true; }
  check('ปุ่มที่ไม่รู้จัก = เขียนผิด', threw);
  check('splitCommandId เก็บเลขเป็น number (fmt:heading:1)', CD.splitCommandId('fmt:heading:1')[2] === 1);
  // ไปกลับทุกแถว — ข้อความใน CSV ต้องกลับมาเป็นแถวเดิมเป๊ะ
  const bad = data.SHORTCUT_ROWS.filter((r) => {
    const q = CD.parseShortcut(CD.shortcutText(r[0], r[1], r[2]));
    return q.code !== r[0] || q.ctrl !== r[1] || q.shift !== r[2];
  });
  check('คีย์ลัดทุกแถวแปลงไปกลับได้ตรง', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
}

// ═══════════ 2. ทะเบียน + ไฟล์ที่สร้าง ═══════════
{
  check('icons/commands.csv อ่านได้ ไม่มี error', data.errors.length === 0, data.errors.join(' | '));
  check('ทุกไอคอนที่คำสั่งใช้มี svg หรือตัวสำรอง', data.warnings.length === 0, data.warnings.slice(0, 5).join(' | '));
  check('มีคำสั่งอย่างน้อย 250 แถว', rows.length >= 250, rows.length);
  check('ไม่มี command_id ซ้ำ', ids.size === rows.length);
  check('คีย์ลัดอย่างน้อย 100 แถว', data.SHORTCUT_ROWS.length >= 100, data.SHORTCUT_ROWS.length);
  const gen = read('src/generated/commands-data.js');
  check('src/generated/commands-data.js ตรงกับ icons/ (ลืม node build.js?)', gen === CD.moduleText(data));
  check('COMMAND_ICON มีทุกแถว รวมแถวที่ช่อง icon ว่าง', Object.keys(data.COMMAND_ICON).length === rows.length);
  check('ช่อง icon ว่าง = ไม่มีไอคอน ("" ในตาราง)', rows.filter((r) => !r.icon).every((r) => data.COMMAND_ICON[r.command_id] === ''));
  // ปุ่ม UI ที่ไม่ผ่าน handleCommand ห้ามมีคีย์ลัด (ตัวดักคีย์ส่งไปได้แค่ handleCommand)
  check('แถว ui:* ไม่มีคีย์ลัด', rows.filter((r) => r.command_id.startsWith('ui:')).every((r) => !r.shortcut));
  // ครบทุกคำสั่งในโค้ด — ตัว sync เองเป็นคนเดินหาจากทุกแหล่ง
  let syncOk = true, syncOut = '';
  try { syncOut = execFileSync(process.execPath, [path.join(ROOT, 'tools/commands-sync.cjs'), '--check'], { encoding: 'utf8' }); }
  catch (e) { syncOk = false; syncOut = String(e.stdout || e.message); }
  check('★ ทุกคำสั่งในโค้ดมีแถวใน icons/commands.csv (node tools/commands-sync.cjs)', syncOk, syncOut.trim().slice(0, 300));
}

// ═══════════ 3. SVG ═══════════
{
  const svgDir = path.join(ROOT, 'icons/svg');
  const files = fs.readdirSync(svgDir).filter((f) => f.endsWith('.svg'));
  check('มีไฟล์ svg อย่างน้อย 60 ไฟล์', files.length >= 60, files.length);
  check('svg ทุกไฟล์อ่านได้', Object.keys(data.ICON_SVG).length === files.length);
  check('ชื่อไฟล์ svg เป็นตัวเล็ก-ขีด (ใช้เป็นชื่อไอคอนใน CSV)', files.every((f) => /^[a-z0-9-]+\.svg$/.test(f)), files.filter((f) => !/^[a-z0-9-]+\.svg$/.test(f)).join(','));
  const evil = CD.parseSvg('<?xml version="1.0"?><svg width="16" height="16" onload="alert(1)"><script>x()</script><title>t</title><path d="M0 0" onclick="y()"/></svg>');
  check('parseSvg ถอด <script> / on* / <title>', !/script|onload|onclick|<title/i.test(evil.inner + JSON.stringify(evil.attrs)), JSON.stringify(evil));
  check('parseSvg เดา viewBox จาก width/height', evil.attrs.viewBox === '0 0 16 16');
  const stroke = CD.parseSvg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1"/></svg>');
  check('parseSvg เก็บ fill/stroke ของไอคอนแบบเส้น', stroke.attrs.fill === 'none' && stroke.attrs['stroke-width'] === '2');
}

// ═══════════ 4. ชื่อไอคอนที่ใช้ในโค้ด/HTML มีจริง ═══════════
{
  const has = (n) => !!(data.ICON_SVG[n] || data.ICON_GLYPH[n]);
  const missing = new Set();
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'generated') walk(p); continue; }
    if (!f.name.endsWith('.js')) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\b(?:icon|iconHtml|iconLabel)\(\s*'([a-z0-9-]+)'/g)) if (!has(m[1])) missing.add(`${m[1]} (${path.relative(ROOT, p)})`);
    for (const m of src.matchAll(/data-icon="([a-z0-9-]+)"/g)) if (!has(m[1])) missing.add(`${m[1]} (${path.relative(ROOT, p)})`);
  } };
  walk(path.join(ROOT, 'src'));
  const html = read('renderer/index.html');
  for (const m of html.matchAll(/data-icon="([a-z0-9-]+)"/g)) if (!has(m[1])) missing.add(`${m[1]} (index.html)`);
  const th = lexCsv(read('languages/k2_th.csv'));
  for (const [k, v] of Object.entries(th)) for (const m of String(v).matchAll(/data-icon=\\?"([a-z0-9-]+)/g)) if (!has(m[1])) missing.add(`${m[1]} (${k})`);
  check('★ ทุกชื่อไอคอนที่โค้ด/HTML/ไฟล์ภาษาเรียกมีอยู่จริง', missing.size === 0, [...missing].join(', '));
}

// ═══════════ 5. ปุ่มใน index.html ผูกกับทะเบียน ═══════════
{
  const html = read('renderer/index.html');
  const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => m[1]);
  const withId = buttons.filter((a) => /\bid="/.test(a));
  const noCmd = withId.filter((a) => !/data-command="/.test(a)).map((a) => a.match(/\bid="([^"]+)"/)[1]);
  check('★ ทุกปุ่มที่มี id ใน index.html มี data-command', noCmd.length === 0, noCmd.join(', '));
  const unknown = [...html.matchAll(/data-command="([^"]+)"/g)].map((m) => m[1]).filter((id) => !ids.has(id));
  check('data-command ทุกตัวมีแถวในทะเบียน', unknown.length === 0, unknown.join(', '));
  check('ปุ่มใน index.html ไม่ใช้ data-icon แล้ว (ไอคอนมาจากทะเบียน)', withId.every((a) => !/data-icon="/.test(a)),
        withId.filter((a) => /data-icon="/.test(a)).map((a) => a.match(/\bid="([^"]+)"/)[1]).join(', '));
}

// ═══════════ 6. ไฟล์ภาษาไม่มีไอคอน/คีย์ลัดฝังอยู่ ═══════════
{
  const LABEL_KEYS = new Set(rows.flatMap((r) => (r.i18n_keys || '').split(/\s+/).filter(Boolean)).flatMap((k) => [k, 'ui.' + k]));
  const scIds = new Set(data.SHORTCUT_ROWS.map((r) => r.slice(3).join(':')));
  const status = {};
  for (const r of CD.readCsvObjects(path.join(ROOT, 'icons/icons.csv'))) if (r.glyph) status[r.glyph] = r.status;
  const iconGlyph = (g) => { const n = g.replace(/️/g, ''); return status[n] ? !['keep_text'].includes(status[n]) && !'▸▾▼▲◀←↑→↓↔⇄'.includes(n) : false; };
  for (const f of fs.readdirSync(path.join(ROOT, 'languages')).filter((x) => /^k2_.+\.csv$/.test(x))) {
    const tbl = lexCsv(read('languages/' + f));
    const leadIcon = [], bakedSc = [], badTok = [];
    for (const [k, v] of Object.entries(tbl)) {
      if (k.startsWith('meta.')) continue;
      const m = String(v).match(/^\s*((?:\p{Extended_Pictographic}|[☀-➿⬀-⯿])️?)\s+\S/u);
      if (m && iconGlyph(m[1])) leadIcon.push(k);
      if (LABEL_KEYS.has(k) && /\((?:Ctrl|⌘|\{\d\})\+[^()]*\)\s*$/.test(v)) bakedSc.push(k);
      for (const t of String(v).matchAll(/\{sc:([^}]+)\}/g)) if (!scIds.has(t[1])) badTok.push(`${k}→${t[1]}`);
    }
    check(`★ ${f}: ไม่มีข้อความขึ้นต้นด้วยอีโมจิไอคอน`, leadIcon.length === 0, leadIcon.slice(0, 8).join(', '));
    check(`★ ${f}: ป้ายของคำสั่งไม่มีคีย์ลัดท้ายวงเล็บ (โปรแกรมเติมเอง)`, bakedSc.length === 0, bakedSc.slice(0, 8).join(', '));
    check(`${f}: {sc:…} ทุกตัวชี้ไปคำสั่งที่มีคีย์ลัด`, badTok.length === 0, badTok.join(', '));
  }
}

// ═══════════ 7. เมนูระบบ main.js ═══════════
{
  const main = read('main.js');
  // ยกเว้นบรรทัดนิยามของ cmd() เอง (มันคือตัวห่อ send)
  const rawSends = main.split('\n').filter((l) => /\(\) => send\(/.test(l) && !/const cmd = /.test(l));
  check('★ main.js ไม่มี `() => send(…)` (ต้องใช้ cmd() ถึงจะได้คีย์ลัดบนเมนู)', rawSends.length === 0,
        rawSends.slice(0, 3).map((l) => l.trim()).join(' | '));
  check('main.js ไม่พิมพ์คีย์ลัดลงป้าย (ttf(key, C/A/S))', !/ttf\('[^']+'(?:,\s*[^,)]+)*,\s*(?:C|A|S)\s*[,)]/.test(main));
  check('main.js ใช้ buildMenuSafe ทั้งเมนูหลักและเมนูคลิกขวา', (main.match(/buildMenuSafe\(/g) || []).length >= 3);
  check('accelerator ไม่ลงทะเบียนกับระบบ (ตัวดักจริงอยู่ renderer)', /registerAccelerator\s*=\s*false/.test(main));
}

// ═══════════ 8. {sc:…} ใน i18n.js ═══════════
{
  const out = path.join(require('os').tmpdir(), '_i18n147.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/i18n.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  const I = require(out);
  I.setTable({ 'ui.x.a': 'กด {sc:save} เพื่อบันทึก', 'ui.x.b': '{0} ไฟล์ ({sc:save-all} เพื่อบันทึกทั้งหมด)' }, 'th');
  I.setShortcutResolver(null);
  check('ไม่มีตัวแปลง = token หายไป (ไม่โชว์ {sc:…} ดิบ)', I.t('ui.x.a') === 'กด  เพื่อบันทึก', I.t('ui.x.a'));
  I.setShortcutResolver((id) => (id === 'save' ? 'Ctrl+S' : id === 'save-all' ? 'Ctrl+Alt+S' : ''));
  check('t() เติมคีย์ลัดจริง', I.t('ui.x.a') === 'กด Ctrl+S เพื่อบันทึก', I.t('ui.x.a'));
  check('tf() เติมทั้งค่าแทรกและคีย์ลัด', I.tf('ui.x.b', 3) === '3 ไฟล์ (Ctrl+Alt+S เพื่อบันทึกทั้งหมด)', I.tf('ui.x.b', 3));
  I.setShortcutResolver(() => { throw new Error('boom'); });
  check('ตัวแปลงพัง ไม่ทำให้ t() พัง', I.t('ui.x.a') === 'กด  เพื่อบันทึก');
  I.setShortcutResolver(null);
}

// ═══════════ 9. แหล่งไอคอนเดิมถูกถอดจริง (ไม่มีสองแหล่ง) ═══════════
{
  const icons = read('src/icons.js');
  check('icons.js ไม่มีตาราง path ในตัว', !/<path fill=/.test(icons) && !/const ICO = \{/.test(icons));
  const core = read('src/core.js');
  check('core.js: SHORTCUTS มาจากทะเบียน (ไม่มีตารางตัวอักษร)', /export const SHORTCUTS = SHORTCUT_ROWS;/.test(core) && !/\['KeyS', true, false, 'save'\]/.test(core));
  check('core.js: withShortcut (รหัสปุ่มพิมพ์ในโค้ด) ถูกถอด', !/export function withShortcut\(/.test(core));
  // คอมเมนต์เล่าประวัติที่เอ่ยชื่อเดิมไม่นับ — นับเฉพาะโค้ดจริง
  const app = read('src/app.js').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  check('app.js: ไม่มี TB_SC_MAP / withShortcut( แล้ว', !/const TB_SC_MAP/.test(app) && !/\bwithShortcut\(/.test(app));
  const fab = read('src/toolbar/fab-config.js');
  check('FAB_ACTIONS ไม่เก็บไอคอนเอง', !/\{ id: '[a-z]+',[^\n]*icon: '/.test(fab));
  const pui = read('src/panels/panel-ui.js');
  check('PANEL_DEFS ของแผงที่เป็นคำสั่งไม่มีไอคอนเอง', [...pui.matchAll(/\{ id: '([\w-]+)'[^\n]*icon: '/g)]
    .every((m) => !ids.has(`toggle-panel:${m[1]}`)));
}

console.log(`commands-registry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
