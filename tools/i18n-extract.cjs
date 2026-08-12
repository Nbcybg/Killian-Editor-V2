#!/usr/bin/env node
// i18n-extract.cjs — ตรวจ/แปลง "ข้อความไทยที่ฮาร์ดโค้ด" ให้เป็นข้อความที่แปลได้ + ออกไฟล์ CSV
//
//   node tools/i18n-extract.cjs            ตรวจอย่างเดียว (ไม่แก้ไฟล์) — สรุปว่าเหลือกี่จุด ที่ไหน
//   node tools/i18n-extract.cjs --list     รายการเต็ม file:line ข้อความ
//   node tools/i18n-extract.cjs --apply    แก้ซอร์สจริง (ห่อด้วย T`…`) + เขียน languages/k2_*.csv
//   node tools/i18n-extract.cjs --csv      เขียนไฟล์ CSV อย่างเดียว (ไม่แตะซอร์ส)
//
// หลักการ: ข้อความต้นฉบับ (ไทย) = ตัวคีย์เอง แบบ gettext
//   `'บันทึกแล้ว'`      →  T`บันทึกแล้ว`
//   `` `บทที่ ${n}` ``  →  T`บทที่ ${n}`      (msgid = "บทที่ {0}")
// ไม่มีคำแปล → ตกกลับข้อความต้นฉบับเสมอ จึงพังไม่ได้แม้ไฟล์ภาษาหาย
//
// **สิ่งที่จงใจไม่แตะ** (ไทยที่เป็น "ข้อมูล" ไม่ใช่ "ข้อความ") — แปลแล้วไฟล์งานพัง:
//   · ค่าที่เขียนลง .md/.json แล้วอ่านกลับ (สถานะฉาก, คำนำหน้าหัวฉากของ fountain, ชนิดความสัมพันธ์)
//   · ตัวเปรียบเทียบ (`x === 'ฉาก'`), คีย์ของ object, อาร์กิวเมนต์ของ split/replace/match/RegExp
//   · บล็อกเทสใน app.js (ชื่อเทสเป็นของนักพัฒนา ไม่ใช่ของผู้ใช้)
//   · console.* (ข้อความสำหรับนักพัฒนา)

const fs = require('fs');
const path = require('path');
const { lexStrings, cookedValue } = require('./js-lex.cjs');

const ROOT = path.join(__dirname, '..');
const TH = /[฀-๿]/;

// ───────── ขอบเขตที่ไม่แตะ ─────────
const SKIP_FILES = new Set([
  'src/i18n.js', 'src/i18n-csv.js',                 // ตัวระบบภาษาเอง
  'src/fountain.js',                                // คำนำหน้า/ทรานซิชัน = ไวยากรณ์ของไฟล์บท
  'src/md.js',                                      // โทเคนของมาร์กดาวน์
  'src/spell.js',                                   // พจนานุกรม
  'src/relationship-types.js',                      // ชนิดความสัมพันธ์ = ค่าที่เก็บใน Wiki JSON
]);
// ช่วงบรรทัดที่เป็น "ค่าคงที่ที่ถูกเขียนลงไฟล์งาน" — แปลไม่ได้ (จะอ่านไฟล์เก่าไม่ออก)
const SKIP_RANGES = {
  'src/core.js': [[368, 390]],                      // SCENE_STATUSES / SCENE_COLORS / STATUS_COLORS
  'src/planner/planner-data.js': [[14, 24]],        // PLANNER_STATUSES (เก็บใน Planners/*.json)
  'src/kanban/kanban-core.js': [[8, 20]],           // คอลัมน์ = สถานะฉากตัวเดียวกับ scenes.json
  'src/branch-plans.js': [[20, 28]],                // PLAN_STATUSES (เก็บใน Branches/*.json)
  'src/visual-tags.js': [[1, 12]],                  // แท็กมาตรฐาน = ค่าที่เก็บใน scenes.json
  'src/scene-meta.js': [[1, 40]],
};
// app.js: บล็อก selftest — หาแบบไดนามิกเพราะเลขบรรทัดขยับทุกรุ่น
function testStart(rel, src) {
  if (rel !== 'src/app.js') return Infinity;
  const m = /\nasync function runTest\(/.exec(src);
  return m ? src.slice(0, m.index).split('\n').length : Infinity;
}

// ───────── ตัวกรองตามบริบท ─────────
const CMP_BEFORE = /(===|!==|==|!=|\bcase)\s*$/;
const CMP_AFTER = /^\s*(===|!==|==|!=)/;
// อาร์กิวเมนต์ของเมธอดที่ "ประมวลผลข้อความ" — แปลแล้วตรรกะเพี้ยน
const DATA_CALL = /\.(includes|indexOf|lastIndexOf|startsWith|endsWith|split|match|matchAll|search|test|exec|localeCompare|replace|replaceAll|hasOwnProperty)\s*\([^()]*$/;
const REGEX_CALL = /(new\s+RegExp|RegExp)\s*\([^()]*$/;
const CONSOLE_CALL = /console\.\w+\s*\([^()]*$/;
// เป็นค่าสำรองของ t()/tr() อยู่แล้ว → ถือว่าแปลได้แล้ว
const T_FALLBACK = /\b(t|tr|tKey|tm)\s*\(\s*(['"])[^'"]*\2\s*,\s*$/;
const OBJ_KEY_BEFORE = /[{,]\s*$/;
// `obj['คีย์']` = อ่าน property (ข้าม) · แต่ `f(['ข้อความ'])` = อาร์เรย์ (ไม่ใช่)
const PROP_BEFORE = /[A-Za-z0-9_$)\]]\s*\[\s*$/, PROP_AFTER = /^\s*\]/;
// คำสงวนที่นำหน้า template ได้โดยไม่ใช่ tagged template (`return \`…\``)
const KEYWORD_BEFORE = /(^|[^A-Za-z0-9_$.])(return|typeof|instanceof|case|else|do|new|delete|void|in|of|await|yield|throw)\s*$/;
const KEY_AFTER = /^\s*:/;
// ถูกห่อด้วย T แล้ว (โคดมอดรันซ้ำได้)
const ALREADY = /(^|[^A-Za-z0-9_$.])(T|tm)\s*$/;
// ป้ายกำกับของ log/dirty-registry ที่เป็นคีย์ระบบ
const SKIP_TEXT = [
  /^[\s\-–—·:|/\\]*$/,                              // มีแต่เครื่องหมาย
];

function classify(src, tok, rel, tstart) {
  if (tok.line >= tstart) return 'test';
  for (const [a, b] of (SKIP_RANGES[rel] || [])) if (tok.line >= a && tok.line <= b) return 'data-range';
  const before = src.slice(Math.max(0, tok.start - 120), tok.start);
  const after = src.slice(tok.end, tok.end + 24);
  if (ALREADY.test(before)) return 'already';
  if (T_FALLBACK.test(before)) return 'already';
  if (CMP_BEFORE.test(before) || CMP_AFTER.test(after)) return 'compare';
  if (DATA_CALL.test(before) || REGEX_CALL.test(before)) return 'data-call';
  if (CONSOLE_CALL.test(before)) return 'console';
  if (KEY_AFTER.test(after) && OBJ_KEY_BEFORE.test(before)) return 'obj-key';
  if (PROP_BEFORE.test(before) && PROP_AFTER.test(after)) return 'prop';
  // tagged template ของคนอื่น (`html\`…\``) — ห้ามแทรก T คั่น
  if (tok.type === 'tpl' && /[A-Za-z0-9_$)\]]\s*$/.test(before) && !KEYWORD_BEFORE.test(before)) return 'tagged';
  const val = cookedValue(tok);
  for (const re of SKIP_TEXT) if (re.test(val)) return 'symbol';
  return 'ui';
}

// ───────── แปลงข้อความเป็น template literal ─────────
/** raw ของสตริง '…' / "…" → raw ที่ใส่ใน `…` ได้ */
function toTemplateRaw(raw, quote) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\') {
      const nx = raw[i + 1];
      if (nx === quote) { out += nx === '`' ? '\\`' : nx; i++; continue; }   // \' → ' (ในแบ็กทิกไม่ต้อง escape)
      out += c + (nx || ''); i++; continue;
    }
    if (c === '`') { out += '\\`'; continue; }
    if (c === '$' && raw[i + 1] === '{') { out += '\\${'; i++; continue; }
    out += c;
  }
  return out;
}

/** msgid จากโทเคน: ชิ้นข้อความคั่นด้วย {0},{1}… (ปีกกาตัวจริงต้องพิมพ์คู่) */
function msgidOf(tok) {
  const esc = (s) => s.replace(/\{/g, '{{').replace(/\}/g, '}}');
  if (tok.type === 'str') return esc(cooked(tok.parts[0]));
  let s = '';
  for (let i = 0; i < tok.parts.length; i++) {
    s += esc(cooked(tok.parts[i]));
    if (i < tok.parts.length - 1) s += '{' + i + '}';
  }
  return s;
}
const { unescape: cooked } = require('./js-lex.cjs');

// ───────── เดินไฟล์ ─────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CSVONLY = args.includes('--csv');
const LIST = args.includes('--list');

const ONLY = (args.find((a) => a.startsWith('--file=')) || '').slice(7);   // ทดลองทีละไฟล์ก่อนลงมือทั้งโปรเจกต์
let files = walk(path.join(ROOT, 'src')).concat([path.join(ROOT, 'main.js')]);
if (ONLY) files = files.filter((f) => path.relative(ROOT, f).replace(/\\/g, '/') === ONLY);
const msgids = new Map();      // msgid → {count, files:Set}
function record(id, rel) {
  const rec = msgids.get(id) || { count: 0, files: new Set() };
  rec.count++; rec.files.add(rel); msgids.set(id, rec);
}
const stats = {};
const hits = [];

for (const abs of files) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = fs.readFileSync(abs, 'utf8');
  if (SKIP_FILES.has(rel)) { stats['skip-file'] = (stats['skip-file'] || 0) + 1; continue; }
  const tstart = testStart(rel, src);
  const toks = lexStrings(src).filter((tk) => tk.parts.some((p) => TH.test(p)));
  const edits = [];
  for (const tk of toks) {
    const kind = classify(src, tk, rel, tstart);
    stats[kind] = (stats[kind] || 0) + 1;
    // ข้อความที่ห่อ T`…` ไว้แล้ว ก็ยังต้องเก็บ msgid ลง CSV (เครื่องมือนี้รันซ้ำได้เรื่อย ๆ แบบ xgettext)
    if (kind === 'already') {
      if (tk.type === 'tpl' && /(^|[^A-Za-z0-9_$.])T\s*$/.test(src.slice(Math.max(0, tk.start - 4), tk.start))) record(msgidOf(tk), rel);
      continue;
    }
    hits.push({ rel, line: tk.line, kind, text: cookedValue(tk).slice(0, 80) });
    if (kind !== 'ui') continue;
    record(msgidOf(tk), rel);
    // สร้างโค้ดใหม่
    // template literal → **แค่แทรกตัว T ข้างหน้า** ไม่ใช่แทนที่ทั้งก้อน
    //   เพราะข้างใน ${…} มีสตริงไทยซ้อนอยู่ได้ (`… “${x || '(ว่าง)'}” …`) ซึ่งก็ต้องถูกห่อด้วย
    //   ถ้าแทนที่ทั้งช่วง อีดิตของตัวข้างในจะชี้ตำแหน่งที่ถูกเขียนทับไปแล้ว = ซอร์สเละ
    if (tk.type === 'tpl') edits.push({ start: tk.start, end: tk.start, repl: 'T' });
    else edits.push({ start: tk.start, end: tk.end, repl: 'T`' + toTemplateRaw(tk.parts[0], tk.quote) + '`' });
  }
  if (!APPLY || !edits.length) continue;

  // ใช้ edit จากท้ายไปหน้า (ตำแหน่งข้างหน้าไม่ขยับ) — เลกเซอร์คืนโทเคนตามลำดับ "ปิด"
  // ตัวที่ซ้อนข้างในจึงมาก่อนตัวนอก ต้องเรียงตามตำแหน่งเองก่อนเสมอ
  edits.sort((a, b) => a.start - b.start);
  let out = src;
  for (let i = edits.length - 1; i >= 0; i--) out = out.slice(0, edits[i].start) + edits[i].repl + out.slice(edits[i].end);

  // ── ตรวจความถูกต้องก่อนเขียนทับ ──
  // 1) ค่าจริงของ literal ทุกตัวต้องเหมือนเดิมเป๊ะ (โคดมอดเปลี่ยนแค่ชนิดเครื่องหมายคำพูด)
  const before = lexStrings(src).map(cookedValue).join('');
  const after = lexStrings(out).map(cookedValue).join('');
  if (before !== after) { console.error('!! ค่าข้อความเปลี่ยน — ข้ามไฟล์', rel); continue; }
  // 2) ต้องยังพาร์สผ่าน
  try {
    require('esbuild').transformSync(out, { loader: 'js', format: 'esm' });
  } catch (e) { console.error('!! พาร์สไม่ผ่าน — ข้ามไฟล์', rel, e.message.split('\n')[0]); continue; }
  // 3) ต้อง import T
  if (!/\bimport\s*\{[^}]*\bT\b[^}]*\}\s*from/.test(out) && !/\bexport\s*\{[^}]*\bT\b/.test(out)) {
    out = addImportT(out, rel);
  }
  fs.writeFileSync(abs, out, 'utf8');
  console.log('แก้', rel, '·', edits.length, 'จุด');
}

/** เติม `import { T } from '<ทางไป i18n.js>'` ให้ไฟล์ที่ยังไม่มี */
function addImportT(src, rel) {
  const depth = rel.split('/').length - 2;                   // src/x.js → 0 · src/a/b.js → 1
  const spec = (depth > 0 ? '../'.repeat(depth) : './') + 'i18n.js';
  const line = `import { T } from '${rel === 'main.js' ? './src/i18n.js' : spec}';\n`;
  // วางไว้ **ก่อน** import ตัวแรก — import ถูก hoist อยู่แล้ว วางบนสุดจึงปลอดภัยและอ่านง่ายที่สุด
  const first = /^import\s/m.exec(src);
  if (first) return src.slice(0, first.index) + line + src.slice(first.index);
  const m = /^(\/\/[^\n]*\n|\s*\n)*/.exec(src);          // ไฟล์บริสุทธิ์ที่ไม่มี import เลย → หลังคอมเมนต์หัวไฟล์
  const at = m ? m[0].length : 0;
  return src.slice(0, at) + line + src.slice(at);
}

// ───────── รายงาน ─────────
if (LIST) for (const h of hits) console.log(`${h.rel}:${h.line}\t[${h.kind}]\t${h.text}`);
console.log('\nสรุปการจัดประเภทข้อความไทยในซอร์ส');
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log('  ', String(v).padStart(5), k);
console.log('   msgid ไม่ซ้ำ:', msgids.size);

// ───────── เขียนไฟล์ CSV ─────────
if (APPLY || CSVONLY) writeCsv();

function flat(obj, prefix, out) {
  for (const k of Object.keys(obj || {})) {
    const v = obj[k], key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[key] = String(v);
  }
  return out;
}
function cell(v) { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

function writeCsv() {
  const langDir = path.join(ROOT, 'languages');
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8')); } catch { return {}; } };
  const th = flat(readJson('th.json'), '', {});
  const en = flat(readJson('en.json'), '', {});
  // คำแปลเดิมที่มีอยู่ใน CSV (ถ้าเคยแปลไว้แล้วต้องไม่หาย)
  const prev = (code) => {
    const f = path.join(langDir, 'k2_' + code + '.csv');
    if (!fs.existsSync(f)) return {};
    const { lexCsv } = require('./csv-lite.cjs');
    return lexCsv(fs.readFileSync(f, 'utf8'));
  };
  const prevTh = prev('th'), prevEn = prev('en');

  const ids = [...msgids.keys()].sort((a, b) => a.localeCompare(b, 'th'));
  // คีย์แบบ dot-path มาจาก 2 ทาง: ไฟล์ .json ยุคเก่า (ถ้ายังมี) + ไฟล์ CSV ที่ใช้อยู่ตอนนี้
  // **ต้องอ่านจาก CSV ด้วย** ไม่งั้นพอเลิกใช้ .json แล้ว รันเครื่องมือรอบต่อไปคีย์พวกนี้จะหายเกลี้ยง
  // คีย์ id ของปุ่มลัดมี `:` อยู่ข้างใน (`ui.shortcuts.format:align:left`) ต้องนับเป็น dot-path ด้วย
  const isDot = (k) => /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_:]+)+$/.test(k) && !/^meta\.(code|name|nativeName|version)$/.test(k);
  const dotKeys = [...new Set([...Object.keys(th), ...Object.keys(en),
                               ...Object.keys(prevTh).filter(isDot), ...Object.keys(prevEn).filter(isDot)])].sort();

  const build = (code, base, prevMap, isSource) => {
    const rows = [];
    rows.push(['meta.code', code]);
    rows.push(['meta.name', prevMap['meta.name'] || (code === 'th' ? 'Thai' : code === 'en' ? 'English' : code)]);
    rows.push(['meta.nativeName', prevMap['meta.nativeName'] || (code === 'th' ? 'ไทย' : code === 'en' ? 'English' : code)]);
    rows.push(['meta.version', '2']);
    rows.push(['meta.author', prevMap['meta.author'] || base['meta.author'] || 'Killian 2']);
    rows.push(['# ---- ข้อความที่มีคีย์ (ใช้กับ data-i18n ใน index.html ด้วย) ----', '']);
    for (const k of dotKeys) {
      if (k.startsWith('meta.')) continue;
      rows.push([k, prevMap[k] || base[k] || '']);
    }
    rows.push(['# ---- ข้อความจากซอร์ส · คีย์ = ประโยคภาษาไทยต้นฉบับ ----', '']);
    for (const id of ids) rows.push([id, prevMap[id] || (isSource ? id : '')]);
    return '﻿' + rows.map((r) => cell(r[0]) + ',' + cell(r[1])).join('\r\n') + '\r\n';
  };

  fs.mkdirSync(langDir, { recursive: true });
  fs.writeFileSync(path.join(langDir, 'k2_th.csv'), build('th', th, prevTh, true), 'utf8');
  fs.writeFileSync(path.join(langDir, 'k2_en.csv'), build('en', en, prevEn, false), 'utf8');
  const filled = ids.filter((id) => prevEn[id]).length + dotKeys.filter((k) => prevEn[k] || en[k]).length;
  console.log(`\nเขียน languages/k2_th.csv · k2_en.csv (${dotKeys.length} คีย์ + ${ids.length} msgid)`);
  console.log(`   อังกฤษที่แปลแล้ว ${filled} · ยังว่าง ${dotKeys.length + ids.length - filled} (ช่องว่าง = ตกกลับภาษาไทย)`);
}
