// tools/i18n-strip-icons.cjs — [alpha.147] ถอด "ไอคอน" และ "คีย์ลัด" ที่ฝังอยู่ในไฟล์ภาษา
//
//   node tools/i18n-strip-icons.cjs                         # รายงานอย่างเดียว ไม่เขียนไฟล์
//   node tools/i18n-strip-icons.cjs --apply                 # เขียน languages/k2_*.csv
//   node tools/i18n-strip-icons.cjs --report=<ไฟล์.json>    # รายละเอียดทุกคีย์
//   node tools/i18n-strip-icons.cjs --overrides=<ไฟล์.json> # {"คีย์":{"th":"…","en":"…"}} แก้มือ (ประโยคที่มีไอคอนกลางประโยค)
//
// ผู้ใช้ (alpha.147): *"ส่วนข้อความ มันมีแยกอยู่แล้วในตอนแปล ก็ทำการลบ icon ออกเลย ในชุด csv ที่เป็นตัว en / th"*
//
// กติกา (ทำกับแต่ละภาษาแยกกัน — ข้อความ th/en ไม่เหมือนกัน):
//   1. ไอคอนนำหน้า ("💾 บันทึก") → ถอด · รวมไอคอนที่นำหน้าข้อความใน HTML (`<b>🧠 AI</b>`)
//      ยกเว้นลูกศรพับ/กาง (▸ ▾ ▼ ▲ ◀) ซึ่งเป็นตัวบอกสถานะ ไม่ใช่ไอคอนของคำสั่ง
//   2. ไอคอนท้ายข้อความ ("ไม่พบข้อผิดพลาด 🎉") → ถอด (ลูกศรพับ/กางเก็บไว้เหมือนข้อ 1)
//   3. คีย์ลัดท้ายวงเล็บ ("ตัวหนา (Ctrl+B)")
//        · คีย์ที่คำสั่งใช้เป็นป้ายชื่อ (อยู่ในช่อง i18n_keys ของ icons/commands.csv) → ถอดทิ้ง
//          เพราะเมนู/ปุ่มเติมคีย์ลัดจริงให้เองแล้ว (ไม่ถอด = ขึ้นซ้ำสองรอบ)
//        · ข้อความอื่น → แทนด้วย `{sc:<คำสั่ง>}` ให้โปรแกรมเติมคีย์จริงตอนแสดง
//        · คีย์ลัดที่ไม่ใช่ของคำสั่งในทะเบียน (Ctrl+Enter ในกล่อง · Esc) → ไม่แตะ (เป็นคีย์เฉพาะที่)
//   4. คีย์ลัดกลางประโยค ("(Ctrl+Alt+S เพื่อบันทึกทั้งหมด)") → `{sc:save-all}` ถ้าตรงคำสั่งเดียว
//   5. ไอคอนกลางประโยค → **ไม่แตะ** รายงานไว้ให้เขียนประโยคใหม่ (--overrides)
//   6. ข้อความที่มีแต่ไอคอนล้วน ("▶") → ไม่แตะ รายงานไว้ (ถอดแล้วจะเหลือค่าว่าง = ผิดกฎไฟล์ภาษา)
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csv-lite.cjs');
const { readCsvObjects, buildCommandsData, shortcutText } = require('./commands-data.cjs');

const ROOT = path.join(__dirname, '..');
const LANG_DIR = path.join(ROOT, 'languages');
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const APPLY = process.argv.includes('--apply');

// ───────── ไอคอนไหนถอดได้ ─────────
const GLYPH_SRC = '(?:\\p{Extended_Pictographic}|[←-⇿⌀-⏿▀-◿☀-➿⤀-⥿⬀-⯿\\u{1F100}-\\u{1F1FF}])';
const status = {};
for (const r of readCsvObjects(path.join(ROOT, 'icons', 'icons.csv'))) if (r.glyph) status[r.glyph] = r.status;
const CARETS = new Set(['▸', '▾', '▼', '▲', '◀', '◂', '▴', '▹', '▿']);
const TEXT_ARROWS = new Set(['←', '↑', '→', '↓', '↔', '⇄', '⌘', '⌥', '⇧', '·']);
const norm = (g) => g.replace(/️/g, '');
const isIcon = (g) => {
  const n = norm(g);
  if (CARETS.has(n) || TEXT_ARROWS.has(n)) return false;
  return status[n] ? status[n] !== 'keep_text' : /\p{Extended_Pictographic}/u.test(n);
};

// ───────── คีย์ลัด → คำสั่ง ─────────
const MOD = '(?:Ctrl|Shift|Alt|Cmd|⌘|⇧|⌥|\\{\\d\\})';
const SC_SRC = `(?:${MOD}\\+)+(?:[A-Za-z0-9]|F\\d{1,2}|Space|Delete|Enter|Tab|Esc|[,./\\\\\\[\\];'\`=-])(?![A-Za-z0-9])`;
const normSc = (s) => {
  const parts = s.split('+').map((p) => ({ '⌘': 'Ctrl', Cmd: 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' }[p] || p));
  const mods = ['Ctrl', 'Alt', 'Shift'].filter((m) => parts.includes(m));
  const key = parts.filter((p) => !['Ctrl', 'Alt', 'Shift'].includes(p)).join('+');
  return [...mods, key.length === 1 ? key.toUpperCase() : key].join('+');
};
const SC_TO_IDS = {};
for (const row of buildCommandsData(ROOT).SHORTCUT_ROWS) {
  const id = row.slice(3).join(':');
  (SC_TO_IDS[normSc(shortcutText(row[0], row[1], row[2]))] ??= new Set()).add(id);
}
const commandOf = (sc) => { const ids = SC_TO_IDS[normSc(sc)]; return ids && ids.size === 1 ? [...ids][0] : null; };
// คีย์ที่คำสั่งเอาไปทำป้ายชื่อ (เมนู · ปุ่ม · FAB · ตั้งค่าคีย์ลัด) — ตัวแสดงผลเติมคีย์ลัดให้เองแล้ว
const LABEL_KEYS = new Set();
for (const r of readCsvObjects(path.join(ROOT, 'icons', 'commands.csv'))) {
  for (const k of (r.i18n_keys || '').split(/\s+/).filter(Boolean)) { LABEL_KEYS.add(k); LABEL_KEYS.add('ui.' + k); }
}

// ───────── ถอดหนึ่งข้อความ ─────────
function strip(key, v) {
  const notes = [];
  let s = v;
  const onlyGlyphs = new RegExp(`^\\s*(?:${GLYPH_SRC}️?\\s*)+$`, 'u');
  if (onlyGlyphs.test(s)) return { value: v, notes: ['มีแต่ไอคอนล้วน — ไม่แตะ'], pure: true };

  // 1. นำหน้า (วนได้หลายตัว "⚠️ 🔒 …")
  const lead = new RegExp(`^(\\s*)(${GLYPH_SRC})️?[ \\t\\u00A0]*`, 'u');
  for (let m; (m = s.match(lead)) && isIcon(m[2]) && s.slice(m[0].length).trim();) s = m[1] + s.slice(m[0].length);
  // 1b. นำหน้าข้อความใน HTML: >🧠 AI< · >⚙ ทั่วไป<
  if (s.includes('<')) {
    s = s.replace(new RegExp(`>(\\s*)(${GLYPH_SRC})️?[ \\t\\u00A0]+(?=[^<\\s])`, 'gu'), (m, sp, g) => (isIcon(g) ? '>' + sp : m));
  }
  // 3. คีย์ลัดท้ายวงเล็บ — วงเล็บที่มีแต่คีย์ลัด (คั่นด้วย / หรือ ,)
  // ตัวคั่นหลายคีย์ต้องมีช่องว่าง (" / " · ", ") — ปุ่ม "," กับ "/" เปล่า ๆ เป็นคีย์จริงได้: ({0}+,) · (Ctrl+Shift+/)
  const tail = new RegExp(`\\s*\\(\\s*(${SC_SRC}(?:(?:\\s+/\\s+|,\\s+)${SC_SRC})*)\\s*\\)\\s*$`, 'u');
  const tm = s.match(tail);
  if (tm) {
    const scs = tm[1].split(/\s+\/\s+|,\s+/);
    const ids = scs.map((x) => (/\{\d\}/.test(x) ? 'placeholder' : commandOf(x)));
    if (ids.every((x) => x === 'placeholder')) {
      if (key.startsWith('ui.menu.')) { s = s.slice(0, tm.index); notes.push(`ถอดคีย์ลัดท้าย (${tm[1]}) — เมนูเติมจาก accelerator`); }
      else notes.push(`คีย์ลัดท้ายแบบ {n} (${tm[1]}) นอกเมนู — ไม่แตะ`);
    } else if (ids.every(Boolean)) {
      if (LABEL_KEYS.has(key)) { s = s.slice(0, tm.index); notes.push(`ถอดคีย์ลัดท้าย (${tm[1]}) — ป้ายของคำสั่ง ${[...new Set(ids)].join(',')}`); }
      else { s = s.slice(0, tm.index) + ' (' + [...new Set(ids)].map((id) => `{sc:${id}}`).join(' / ') + ')'; notes.push(`คีย์ลัดท้าย → {sc:${[...new Set(ids)].join(',')}}`); }
    } else notes.push(`คีย์ลัดท้าย (${tm[1]}) ไม่ใช่ของคำสั่งในทะเบียน — ไม่แตะ`);
  }
  // 4. คีย์ลัดกลางประโยค
  s = s.replace(new RegExp(SC_SRC, 'gu'), (m, off, whole) => {
    if (/\{\d\}/.test(m)) return m;
    // "Ctrl+↑/↓" · "Ctrl+Z/Y" = คีย์กลุ่ม ไม่ใช่คำสั่งเดียว
    if (whole[off + m.length] === '/') return m;
    const id = commandOf(m);
    if (!id) { notes.push(`คีย์ลัด ${m} ในประโยคไม่ตรงคำสั่งเดียว — ไม่แตะ`); return m; }
    notes.push(`${m} → {sc:${id}}`);
    return `{sc:${id}}`;
  });
  // 2. ท้ายข้อความ
  const trail = new RegExp(`[ \\t\\u00A0]*(${GLYPH_SRC})️?(\\s*)$`, 'u');
  for (let m; (m = s.match(trail)) && isIcon(m[1]) && s.slice(0, m.index).trim();) s = s.slice(0, m.index) + m[2];
  // 5. ที่เหลือกลางประโยค
  const mids = [...s.matchAll(new RegExp(GLYPH_SRC, 'gu'))].map((m) => m[0]).filter(isIcon);
  if (mids.length) notes.push(`ไอคอนกลางประโยค: ${[...new Set(mids)].join(' ')}`);
  return { value: s, notes, mid: mids.length > 0 };
}

// ───────── CSV: เขียนกลับรูปเดิมเป๊ะ ─────────
const cell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function serialize(rows, { bom, eol, trailing }) {
  return (bom ? '﻿' : '') + rows.map((r) => r.map(cell).join(',')).join(eol) + (trailing ? eol : '');
}

const overrides = arg('overrides') ? JSON.parse(fs.readFileSync(arg('overrides'), 'utf8')) : {};
const report = { files: {} };
let exitCode = 0;
for (const f of fs.readdirSync(LANG_DIR).filter((x) => /^k2_.+\.csv$/.test(x)).sort()) {
  const lang = f.match(/^k2_(.+)\.csv$/)[1];
  const file = path.join(LANG_DIR, f);
  const orig = fs.readFileSync(file, 'utf8');
  const fmt = { bom: orig.startsWith('﻿'), eol: orig.includes('\r\n') ? '\r\n' : '\n', trailing: /\r?\n$/.test(orig) };
  const rows = parseCsv(orig);
  if (serialize(rows, fmt) !== orig) {
    console.error(`${f}: เขียนกลับแล้วไม่ตรงต้นฉบับ — หยุด (ไม่กล้าแตะไฟล์ที่รูปแบบไม่รู้จัก)`);
    exitCode = 1; continue;
  }
  const rep = report.files[f] = { changed: [], mid: [], pure: [], untouched: [], overridden: [] };
  for (const r of rows) {
    const key = r[0];
    if (!key || key.startsWith('meta.') || r.length < 2) continue;
    // กระดานวางแผนมีตัวดักคีย์ของตัวเอง (Ctrl+Z/Y/D/[/] ของกระดาน ไม่ใช่ของตัวแก้ไข) — ห้ามแปลงเป็น {sc:…}
    if (key.startsWith('ui.planner') && !overrides[key]) continue;
    const ov = overrides[key];
    // แก้มือแบบทั้งข้อความ — ใช้เฉพาะภาษาที่ระบุ (ภาษาที่ไม่ระบุ: ถ้าค่าเดิมเหมือนภาษาไทย ใช้ค่าไทยที่แก้แล้ว)
    const full = ov && (ov[lang] != null ? ov[lang] : (ov.th != null && lang !== 'th' && r[1] === ov.thFrom ? ov.th : null));
    if (full != null) {
      if (r[1] !== full) { rep.overridden.push({ key, from: r[1], to: full }); r[1] = full; }
      continue;
    }
    const res = strip(key, r[1]);
    // แก้มือแบบแทนที่บางช่วง (ข้อความยาว/HTML ที่ถอดอัตโนมัติแล้วยังเหลือไอคอนกลางประโยค)
    if (ov && Array.isArray(ov.replace)) {
      for (const [from, to] of ov.replace) {
        // ภาษาที่แปลแล้วอาจไม่มีช่วงนี้ (ข้อความคนละภาษา) — เตือน ไม่หยุด
        if (!res.value.includes(from)) { console.warn(`  ⚠ ${f}: ${key} ไม่พบช่วง "${from}"`); continue; }
        res.value = res.value.split(from).join(to);
      }
      res.mid = [...res.value.matchAll(new RegExp(GLYPH_SRC, 'gu'))].map((m) => m[0]).filter(isIcon).length > 0;
      res.notes.push('แก้มือบางช่วง');
    }
    if (res.value !== r[1]) { rep.changed.push({ key, from: r[1], to: res.value, notes: res.notes }); r[1] = res.value; }
    else if (res.notes.length) rep.untouched.push({ key, value: r[1], notes: res.notes });
    if (res.mid) rep.mid.push({ key, value: res.value });
    if (res.pure) rep.pure.push({ key, value: r[1] });
    if (!String(r[1]).trim()) { console.error(`${f}: ${key} กลายเป็นค่าว่าง — หยุด`); exitCode = 1; }
  }
  const out = serialize(rows, fmt);
  console.log(`${f}: เปลี่ยน ${rep.changed.length} · แก้มือ ${rep.overridden.length} · ไอคอนกลางประโยค ${rep.mid.length} · ไอคอนล้วน ${rep.pure.length} · ไม่แตะ(มีหมายเหตุ) ${rep.untouched.length}`);
  if (APPLY && !exitCode && out !== orig) fs.writeFileSync(file, out);
}
if (arg('report')) fs.writeFileSync(arg('report'), JSON.stringify(report, null, 1));
if (!APPLY) console.log('(รายงานอย่างเดียว — ใส่ --apply เพื่อเขียนไฟล์)');
process.exit(exitCode);
