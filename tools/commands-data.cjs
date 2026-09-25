// tools/commands-data.cjs — [alpha.147] ทะเบียนคำสั่ง → ข้อมูลที่โปรแกรมใช้จริง
//
// ═══ ผู้ใช้กำหนด (alpha.147) ═══
// > "แยก icon กับข้อความ · icon ดึงออกมาเป็น svg · เปลี่ยนก็แค่ใส่ svg ใหม่ลงโฟลเดอร์ชื่อเดิม
// >  · ทำ csv ของ **ทุกคำสั่ง** · คำสั่งไหนไม่ต้องการไอคอนก็ blank · shortcut ต้องแยก"
//
// แหล่งความจริงมีสามที่ (แก้ได้นอกโปรแกรม ไม่ต้องแตะโค้ด):
//   · icons/svg/<ชื่อ>.svg      — รูปไอคอน · เปลี่ยนรูป = วางไฟล์ใหม่ทับชื่อเดิม
//   · icons/commands.csv        — คำสั่งทุกตัว: ช่อง `icon` (ว่าง = ไม่มีไอคอน) · ช่อง `shortcut` (ค่าเริ่มต้น)
//   · icons/glyphs.csv          — ตัวสำรองระหว่างที่ชื่อนั้นยังไม่มีไฟล์ svg (อีโมจิเดิม)
//
// `node build.js` เรียก `writeCommandsData()` ก่อน bundle ทุกครั้ง → src/generated/commands-data.js
// (ESM ให้ renderer) — main.js ได้สำเนา .cjs จาก CJS_MODULES ใน build.js ทางเดียวกับ update-check
//
// ช่องอื่นใน commands.csv (ป้ายชื่อ · อยู่ตรงไหน · หมายเหตุ) เป็น "ข้อมูลอ่าน" ที่
// `node tools/commands-sync.cjs` เติมให้จากโค้ด — ช่อง icon/shortcut ที่ผู้ใช้แก้ไว้ไม่ถูกทับ
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csv-lite.cjs');

const ROOT = path.join(__dirname, '..');

function readCsvObjects(file) {
  if (!fs.existsSync(file)) return [];
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const head = (rows[0] || []).map((h) => String(h).trim());
  return rows.slice(1).filter((r) => r.some((c) => String(c).trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])));
}

// ───────── คีย์ลัด: ข้อความ ⇄ แถวของตาราง SHORTCUTS ─────────
const PUNCT_CODE = {
  ',': 'Comma', '.': 'Period', '/': 'Slash', '\\': 'Backslash', '`': 'Backquote',
  '[': 'BracketLeft', ']': 'BracketRight', ';': 'Semicolon', "'": 'Quote', '-': 'Minus', '=': 'Equal',
};
const MOD_ALIAS = { ctrl: 'ctrl', cmd: 'ctrl', cmdorctrl: 'ctrl', '⌘': 'ctrl', alt: 'alt', option: 'alt', '⌥': 'alt', shift: 'shift', '⇧': 'shift' };

/** "Ctrl+Alt+Shift+K" → { code:'KeyK', ctrl:'ctrl+alt', shift:true } (รูปเดียวกับช่อง 0–2 ของ SHORTCUTS) */
function parseShortcut(text) {
  const parts = String(text).split('+').map((p) => p.trim());
  // ปุ่ม "+" ตัวจริงจะเหลือเป็นช่องว่างท้าย — ตารางนี้ไม่มีใช้ จึงถือว่าเขียนผิด
  if (parts.some((p) => !p)) throw new Error(`คีย์ลัด "${text}" เขียนไม่ถูก`);
  const key = parts.pop();
  const mods = new Set();
  for (const m of parts) {
    const k = MOD_ALIAS[m.toLowerCase()];
    if (!k) throw new Error(`คีย์ลัด "${text}": ไม่รู้จักปุ่ม "${m}" (ใช้ Ctrl / Alt / Shift)`);
    mods.add(k);
  }
  if (mods.has('alt') && !mods.has('ctrl')) throw new Error(`คีย์ลัด "${text}": Alt ต้องมาคู่กับ Ctrl`);
  let code;
  if (/^[A-Za-z]$/.test(key)) code = 'Key' + key.toUpperCase();
  else if (/^\d$/.test(key)) code = 'Digit' + key;
  else if (PUNCT_CODE[key]) code = PUNCT_CODE[key];
  else if (/^(Space|Delete|Enter|Tab|Escape|Backspace|Insert|Home|End|PageUp|PageDown|Arrow(Up|Down|Left|Right)|F\d{1,2})$/.test(key)) code = key;
  else throw new Error(`คีย์ลัด "${text}": ไม่รู้จักปุ่ม "${key}"`);
  const ctrl = mods.has('ctrl') ? (mods.has('alt') ? 'ctrl+alt' : true) : false;
  return { code, ctrl, shift: mods.has('shift') };
}

/** แถว SHORTCUTS → ข้อความแบบ Windows (รูปที่เขียนใน commands.csv) */
function shortcutText(code, ctrl, shift) {
  const rev = Object.fromEntries(Object.entries(PUNCT_CODE).map(([k, v]) => [v, k]));
  const key = rev[code] || String(code).replace(/^Key/, '').replace(/^Digit/, '');
  return [ctrl ? 'Ctrl' : '', String(ctrl).includes('alt') ? 'Alt' : '', shift ? 'Shift' : '', key].filter(Boolean).join('+');
}

/** "fmt:heading:1" → ['fmt', 'heading', 1] · "zoom:-1" → ['zoom', -1] — ตัวเลขเป็น number เหมือนที่ตารางเดิมเก็บ */
function splitCommandId(id) {
  return String(id).split(':').map((p, i) => (i > 0 && /^-?\d+$/.test(p) ? Number(p) : p));
}

// ───────── SVG ─────────
const KEEP_ATTRS = ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule'];
/** ไฟล์ svg จากที่ไหนก็ได้ (Iconify · Figma · วาดเอง) → { attrs, inner } ที่ปลอดภัยพอจะยัดลง innerHTML */
function parseSvg(text) {
  let s = String(text)
    .replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '').replace(/<desc>[\s\S]*?<\/desc>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, '$1');
  const m = s.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/i);
  if (!m) throw new Error('ไม่ใช่ไฟล์ svg');
  const attrs = {};
  for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const name = a[1], val = a[3] ?? a[4];
    if (KEEP_ATTRS.includes(name)) attrs[name] = val;
  }
  if (!attrs.viewBox) {
    const w = (m[1].match(/\bwidth\s*=\s*["']([\d.]+)/) || [])[1], h = (m[1].match(/\bheight\s*=\s*["']([\d.]+)/) || [])[1];
    attrs.viewBox = w && h ? `0 0 ${w} ${h}` : '0 0 24 24';
  }
  return { attrs, inner: m[2].replace(/\s+/g, ' ').trim() };
}

// ───────── ประกอบ ─────────
// ─── [alpha.166] Nerd Fonts ───
const NERD_FONT = ['renderer', 'assets', 'fonts', 'k2-icons.ttf'];   // Symbols Nerd Font Mono (ไอคอนเต็มช่อง 1em)
const ICON_SCALE = 0.86;                  // ต้องเท่ากับ size-adjust ของ @font-face "K2 Icons" ใน style.css
const _nerd = { names: null, font: null, fontRoot: '' };
function loadNerdNames(root) {
  if (_nerd.names) return _nerd.names;
  const f = path.join(root, 'icons', 'nerdfont', 'glyphnames.json');
  _nerd.names = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).glyphs || {}) : {};
  return _nerd.names;
}
function loadNerdFont(root) {
  if (_nerd.fontRoot === root) return _nerd.font;
  _nerd.fontRoot = root; _nerd.font = null;
  const f = path.join(root, ...NERD_FONT);
  try { if (fs.existsSync(f)) _nerd.font = require('@pdf-lib/fontkit').create(fs.readFileSync(f)); } catch { _nerd.font = null; }
  return _nerd.font;
}
/** รูปเส้นทางของอักขระหนึ่งตัวในฟอนต์ → { attrs, inner } (พิกัดฟอนต์ y ชี้ขึ้น → พลิกด้วย transform) */
function nerdSvg(font, cp) {
  const g = font.glyphForCodePoint(cp);
  if (!g || !g.id) return null;
  const d = g.path.toSVG();
  if (!d) return null;
  const em = font.unitsPerEm, asc = font.ascent;
  const r = (v) => Math.round(v);
  // ระยะเผื่อรอบรูป — ฟอนต์ Mono ขยายรูปจนชนขอบ · ย่อกลับ 86% (คู่กับ size-adjust ของ @font-face "K2 Icons")
  const pad = em * (1 / ICON_SCALE - 1) / 2;
  return { attrs: { viewBox: `${r(-pad)} ${r(-asc - pad)} ${r(em + 2 * pad)} ${r(em + 2 * pad)}` },
           inner: `<path transform="scale(1,-1)" d="${d.replace(/(\d+\.\d{1,})/g, (m) => String(Math.round(+m * 10) / 10))}"/>` };
}

function buildCommandsData(root = ROOT) {
  const errors = [], warnings = [];
  const svgDir = path.join(root, 'icons', 'svg');
  const ICON_SVG = {};
  if (fs.existsSync(svgDir)) {
    for (const f of fs.readdirSync(svgDir).filter((x) => x.toLowerCase().endsWith('.svg')).sort()) {
      const name = f.slice(0, -4);
      try { ICON_SVG[name] = parseSvg(fs.readFileSync(path.join(svgDir, f), 'utf8')); }
      catch (e) { errors.push(`icons/svg/${f}: ${e.message}`); }
    }
  }
  // [alpha.166] ★ ไอคอนชุดเดียวทั้งโปรแกรม = Nerd Fonts (ผู้ใช้: "icon ทันสมัย มืออาชีพ ลองไปดึงจาก nerdfonts.com")
  //   glyphs.csv: name,nf,glyph — nf = ชื่อจาก cheat sheet ของ nerdfonts.com (เช่น nf-md-book_open_outline)
  //   · ICON_GLYPH[name] = ตัวอักษรที่วาดบนจอ (nf → อักขระ PUA ของฟอนต์ "K2 Icons" · ไม่มี nf = ตัวอักษรในช่อง glyph)
  //   · ICON_TEXT[name]  = ตัวอักษรล้วนในช่อง glyph — ใช้กับข้อความที่ออกนอกหน้าจอ (ไฟล์ส่งออก · ข้อความถึง AI)
  //   · ICON_SVG[name]   = รูปเส้นทางจากฟอนต์เดียวกัน (icon()/iconHtml()/data-icon ได้ svg คม ๆ) — ไฟล์ใน icons/svg/ ทับได้
  const ICON_GLYPH = {}, ICON_TEXT = {};
  const nfNames = loadNerdNames(root);
  const nfFont = loadNerdFont(root);
  for (const r of readCsvObjects(path.join(root, 'icons', 'glyphs.csv'))) {
    if (!r.name) continue;
    if (r.glyph) ICON_TEXT[r.name] = r.glyph;
    if (r.nf) {
      const key = r.nf.replace(/^nf-/, '');
      const code = nfNames[key];
      if (!code) { errors.push(`icons/glyphs.csv: ${r.name}: ไม่รู้จัก "${r.nf}" (ดูชื่อที่ https://www.nerdfonts.com/cheat-sheet)`); continue; }
      const cp = parseInt(code, 16);
      ICON_GLYPH[r.name] = String.fromCodePoint(cp);
      if (!ICON_SVG[r.name] && nfFont) {
        const svg = nerdSvg(nfFont, cp);
        if (svg) ICON_SVG[r.name] = svg;
        else warnings.push(`icons/glyphs.csv: ${r.name}: ฟอนต์ไม่มีรูปของ ${r.nf}`);
      }
    } else if (r.glyph) ICON_GLYPH[r.name] = r.glyph;
  }

  const COMMAND_ICON = {};
  const SHORTCUT_ROWS = [];
  const seenId = new Set();
  for (const r of readCsvObjects(path.join(root, 'icons', 'commands.csv'))) {
    const id = r.command_id;
    if (!id) continue;
    if (seenId.has(id)) { errors.push(`commands.csv: คำสั่ง ${id} ซ้ำสองแถว`); continue; }
    seenId.add(id);
    // ทุกแถวลงตาราง แม้ช่อง icon ว่าง — โปรแกรมต้องแยก "ตั้งใจไม่มีไอคอน" ออกจาก "ยังไม่ลงทะเบียน" ได้
    COMMAND_ICON[id] = r.icon || '';
    if (r.icon) {
      if (!ICON_SVG[r.icon] && !ICON_GLYPH[r.icon]) warnings.push(`commands.csv: ${id} ใช้ไอคอน "${r.icon}" ที่ยังไม่มีทั้ง svg และตัวสำรอง`);
    }
    if (r.shortcut) {
      if (id.startsWith('ui:')) { errors.push(`commands.csv: ${id} เป็นปุ่ม UI ที่ไม่ผ่าน handleCommand — ใส่คีย์ลัดไม่ได้`); continue; }
      // หลายคีย์ของคำสั่งเดียวคั่นด้วย " / " (มีช่องว่างสองข้าง — ปุ่ม "/" เปล่า ๆ เป็นคีย์จริงได้: Ctrl+Alt+/)
      for (const one of r.shortcut.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean)) {
        try {
          const { code, ctrl, shift } = parseShortcut(one);
          SHORTCUT_ROWS.push([code, ctrl, shift, ...splitCommandId(id)]);
        } catch (e) { errors.push(`commands.csv: ${id}: ${e.message}`); }
      }
    }
  }
  return { ICON_SVG, ICON_GLYPH, ICON_TEXT, COMMAND_ICON, SHORTCUT_ROWS, errors, warnings };
}

function moduleText(d) {
  const j = (v) => JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ');
  const lines = [
    '// ⚠️ ไฟล์นี้สร้างอัตโนมัติจากโฟลเดอร์ icons/ ด้วย tools/commands-data.cjs — ห้ามแก้มือ',
    '// เปลี่ยนไอคอน = วาง svg ชื่อเดิมลง icons/svg/ · เปลี่ยนไอคอน/คีย์ลัดของคำสั่ง = แก้ icons/commands.csv',
    '// แล้วรัน `node build.js` (ไฟล์นี้ถูกเขียนใหม่ทุกครั้งที่ build)',
    '',
    '/** ชื่อไอคอน → { attrs, inner } จาก icons/svg/<ชื่อ>.svg */',
    'export const ICON_SVG = {',
    ...Object.entries(d.ICON_SVG).map(([k, v]) => `  ${JSON.stringify(k)}: ${j(v)},`),
    '};',
    '',
    '/** ชื่อไอคอน → ตัวอักษรบนจอ (อักขระของฟอนต์ K2 Icons = Nerd Fonts · หรือตัวอักษรล้วน) — icons/glyphs.csv */',
    `export const ICON_GLYPH = ${JSON.stringify(d.ICON_GLYPH, null, 2)};`,
    '',
    '/** ชื่อไอคอน → ตัวอักษรล้วน (ข้อความที่ออกนอกจอ: ไฟล์ส่งออก · ข้อความถึง AI) — ช่อง glyph ของ icons/glyphs.csv */',
    `export const ICON_TEXT = ${JSON.stringify(d.ICON_TEXT, null, 2)};`,
    '',
    '/** คำสั่ง → ชื่อไอคอน (คำสั่งที่ช่อง icon ว่างไม่อยู่ในตารางนี้ = ไม่มีไอคอน) */',
    `export const COMMAND_ICON = ${JSON.stringify(d.COMMAND_ICON, null, 2)};`,
    '',
    '/** คีย์ลัดค่าเริ่มต้น — รูปเดียวกับ SHORTCUTS: [code, needCtrl, needShift, channel, ...args] */',
    'export const SHORTCUT_ROWS = [',
    ...d.SHORTCUT_ROWS.map((r) => `  ${JSON.stringify(r)},`),
    '];',
    '',
  ];
  return lines.join('\n');
}

function writeCommandsData(root = ROOT) {
  const d = buildCommandsData(root);
  if (d.errors.length) throw new Error('ทะเบียนคำสั่ง (icons/) มีข้อผิดพลาด:\n  · ' + d.errors.join('\n  · '));
  const out = path.join(root, 'src', 'generated', 'commands-data.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const text = moduleText(d);
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) fs.writeFileSync(out, text);
  return d;
}

module.exports = { parseShortcut, shortcutText, splitCommandId, parseSvg, buildCommandsData, moduleText, writeCommandsData, readCsvObjects };

if (require.main === module) {
  const d = writeCommandsData();
  console.log(`commands-data OK · svg ${Object.keys(d.ICON_SVG).length} · คำสั่งมีไอคอน ${Object.keys(d.COMMAND_ICON).length} · คีย์ลัด ${d.SHORTCUT_ROWS.length}`);
  for (const w of d.warnings) console.log('  ⚠ ' + w);
}
