#!/usr/bin/env node
// icon-extract.cjs — [alpha.150r2] ยกไอคอนที่ฮาร์ดโค้ดในซอร์สออกไปไว้ใน `icons/`
//
//   node tools/icon-extract.cjs            # รายงานอย่างเดียว ไม่แก้ไฟล์
//   node tools/icon-extract.cjs --apply    # เขียนทับซอร์ส + เติมแถวใน icons/glyphs.csv
//
// ผู้ใช้: *"icon ข้อความ ui ห้าม hard code — ใน skill น่าจะบอกแล้วให้ใส่ที่ไหน"*
//
// ═══ ทำไมต้องมีเครื่องมือ ไม่แก้มือ ═══
// จุดที่ต้องแก้มี 600 กว่าแห่งใน 80 กว่าไฟล์ · แก้มือทีละจุดคือการเปิดโอกาสให้พิมพ์ผิดเงียบ ๆ
// 600 ครั้ง · เครื่องมือตัวนี้เดินผ่าน **เลกเซอร์ตัวเดียวกับเครื่องมือ i18n** (`js-lex.cjs`)
// จึงไม่แตะของในคอมเมนต์/regex และใช้ตัวจัดประเภทตัวเดียวกัน (`i18n-classify.cjs`)
// จึงไม่แตะค่าที่ถูกเขียนลงไฟล์งานหรือบล็อกเทส
//
// ═══ สิ่งที่แปลง ═══
//     el('div', 'x', '📄 ' + title)   →   el('div', 'x', gi('file') + ' ' + title)
//     `📝 MEMO / ${name}`             →   gi('note') + ` MEMO / ${name}`
// **อักขระที่ได้เหมือนเดิมทุกตัว** — ค่าใน `icons/glyphs.csv` คือตัวเดิมที่ถูกยกออกมา
// (จึงไม่มีอะไรบนหน้าจอเปลี่ยน และเทสที่เทียบข้อความยังเขียวเหมือนเดิม)
// เปลี่ยนหน้าตาทีหลังได้ที่ทะเบียนที่เดียว ไม่ต้องกลับมาแตะโค้ดอีก
//
// ═══ สิ่งที่ไม่แปลง (จงใจ) ═══
// · ไอคอนที่อยู่ **กลางข้อความ** — ส่วนใหญ่เป็นลูกศรเชื่อมประโยค (`"a → b"`) ไม่ใช่ไอคอน
//   ที่เป็นไอคอนจริงมีไม่กี่จุด แก้มือแม่นกว่าและอ่านรู้เรื่องกว่า
// · ตัวที่ `icon-lexicon.cjs` ระบุว่าไม่ใช่ไอคอน (ปุ่ม ⌘⌥⇧ ของ mac · เส้นต้นไม้ในเอกสาร)

const fs = require('fs');
const path = require('path');
const { lexStrings, cookedValue } = require('./js-lex.cjs');
const { classify, testStart } = require('./i18n-classify.cjs');
const { iconNameOf, ICON_RANGE_SRC } = require('./icon-lexicon.cjs');
const { readCsvObjects } = require('./commands-data.cjs');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

// อักขระที่ถือว่าเป็นไอคอน (พิกโตแกรม + สัญลักษณ์ที่โปรแกรมใช้แทนรูป)
// [alpha.162 · W6 ข้อ 1] ช่วงหลักมาจาก icon-lexicon ที่เดียวกับเทส ui-audit + ลูกศร/เส้นตีตาราง (ตัวยกเสนอได้ เทสไม่ฟ้อง)
const ICONCH = '[' + ICON_RANGE_SRC + '\\u{2190}-\\u{21FF}\\u{2500}-\\u{257F}]';
const HAS_ICON = new RegExp(ICONCH, 'u');
const LEAD = new RegExp('^(' + ICONCH + '+)([\\s\\S]*)$', 'u');

// ประเภทที่ไม่ใช่ข้อความบนหน้าจอ — ข้ามทั้งหมด (ตัวเดียวกับที่ระบบภาษาใช้)
const SKIP_KIND = new Set([
  'test', 'data-range', 'skip-file', 'compare', 'data-call', 'console',
  // ★ ห้ามแตะสามอย่างนี้เด็ดขาด (เจอตอนรันรอบแรก — ซอร์สพังทันที):
  //   · `already` = ข้อความที่ถูกครอบด้วยแท็กภาษาอยู่แล้ว (``T`⏳ …` ``) — แท็ก `T` อยู่ติดหน้า
  //     backtick พอดี แทนที่ทั้งโทเคนเมื่อไหร่ก็ได้ `Tgi('hourglass') + …` ซึ่งไม่มีอยู่จริง
  //     (ไอคอนในข้อความพวกนี้เดินทางผ่านไฟล์ภาษา ไม่ใช่ผ่านทะเบียนไอคอน — คนละสาย)
  //   · `tagged`  = template ที่มีแท็กอื่นนำหน้า เหตุผลเดียวกัน
  //   · `obj-key` / `prop` = ตัวอักษรถูกใช้เป็น **คีย์** ไม่ใช่สิ่งที่ผู้ใช้เห็น
  'already', 'tagged', 'obj-key', 'prop',
]);
// ไฟล์ที่ไอคอนข้างในเป็น "ข้อมูล" ทั้งไฟล์
const SKIP_FILES = new Set([
  'src/visual-tags.js',        // แท็กมาตรฐาน = ค่าที่เก็บลง scenes.json (ไอคอนติดไปกับข้อมูล)
  'src/icons.js',              // ตัวระบบไอคอนเอง
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'generated') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** แถวในทะเบียนตัวสำรอง: ตัวอักษร → ชื่อ (ชื่อแรกที่เจอชนะ) */
function glyphIndex() {
  const byGlyph = new Map(), byName = new Map();
  for (const r of readCsvObjects(path.join(ROOT, 'icons', 'glyphs.csv'))) {
    if (!r.name || !r.glyph) continue;
    byName.set(r.name, r.glyph);
    if (!byGlyph.has(r.glyph)) byGlyph.set(r.glyph, r.name);
  }
  return { byGlyph, byName };
}

function run() {
  const { byGlyph, byName } = glyphIndex();
  const stats = { files: 0, rewrote: 0, mid: 0, unknown: 0, notIcon: 0, newRows: 0 };
  const unknownRuns = new Map();
  const newRows = [];
  const collisions = new Map();

  for (const abs of walk(path.join(ROOT, 'src'))) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (SKIP_FILES.has(rel)) continue;
    const src = fs.readFileSync(abs, 'utf8');
    const tstart = testStart(rel, src);
    const edits = [];

    for (const tok of lexStrings(src)) {
      let v;
      try { v = cookedValue(tok); } catch { continue; }
      if (typeof v !== 'string' || !HAS_ICON.test(v)) continue;
      if (SKIP_KIND.has(classify(src, tok, rel, tstart))) continue;

      const m = LEAD.exec(v);
      if (!m) { stats.mid++; continue; }          // ไอคอนอยู่กลางข้อความ — แก้มือ
      const runChars = m[1];
      // `iconNameOf` คืน **null** = จงใจไม่ใช่ไอคอน — ต้องเช็คก่อนเข้าสายทางเลือก
      // (ไม่งั้น `null || …` กลืนสัญญาณนั้นไป แล้วมันไปโผล่ในกอง "ไม่รู้จัก" แทน)
      const lex = iconNameOf(runChars);
      if (lex === null) { stats.notIcon++; continue; }
      const name = lex || byGlyph.get(runChars) || '';
      if (!name) {
        stats.unknown++;
        unknownRuns.set(runChars, (unknownRuns.get(runChars) || 0) + 1);
        continue;
      }
      // ชื่อนี้ยังไม่มีในทะเบียน → เตรียมแถวใหม่ (ค่าคือตัวอักษรเดิมเป๊ะ)
      if (!byName.has(name)) {
        byName.set(name, runChars);
        byGlyph.set(runChars, name);
        newRows.push([name, runChars]);
      }
      // ตัวอักษรเดิมที่ชื่อนี้ชี้ไปต้องตรงกับที่เจอ ไม่งั้นแปลงแล้วหน้าตาเปลี่ยน
      if (byName.get(name) !== runChars) {
        stats.unknown++;
        collisions.set(name, `${name} = ${byName.get(name)} แต่ในซอร์สเป็น ${runChars} (${rel}:${tok.line})`);
        continue;
      }

      const raw = src.slice(tok.start, tok.end);
      const q = tok.quote;
      const openLen = q.length;                     // ' " หรือ `
      const rawLead = raw.slice(openLen, openLen + runChars.length);
      if (rawLead !== runChars) continue;           // มี escape คั่น — ไม่แตะ
      const restRaw = raw.slice(openLen + runChars.length, raw.length - openLen);
      const call = `gi('${name}')`;
      const repl = restRaw === '' ? call : `${call} + ${q}${restRaw}${q}`;
      edits.push({ start: tok.start, end: tok.end, repl });
    }

    if (!edits.length) continue;
    stats.files++;
    stats.rewrote += edits.length;
    if (!APPLY) continue;

    edits.sort((a, b) => b.start - a.start);
    let out = src;
    for (const e of edits) out = out.slice(0, e.start) + e.repl + out.slice(e.end);
    out = ensureImport(out, rel);
    fs.writeFileSync(abs, out, 'utf8');
  }

  if (APPLY && newRows.length) {
    const p = path.join(ROOT, 'icons', 'glyphs.csv');
    const lines = fs.readFileSync(p, 'utf8').replace(/\n+$/, '').split('\n');
    const head = lines[0];
    const body = lines.slice(1);
    for (const [name, glyph] of newRows) {
      body.push(`${name},${glyph}`);          // [alpha.154] glyphs.csv มีแค่สองช่องที่โปรแกรมอ่านจริง
    }
    body.sort((a, b) => a.split(',')[0].localeCompare(b.split(',')[0]));
    fs.writeFileSync(p, [head, ...body].join('\n') + '\n', 'utf8');
    stats.newRows = newRows.length;
  }

  console.log(`แปลง ${stats.rewrote} จุด ใน ${stats.files} ไฟล์`
    + ` · แถวใหม่ใน glyphs.csv ${APPLY ? stats.newRows : newRows.length}`
    + ` · กลางข้อความ(แก้มือ) ${stats.mid} · ไม่รู้จัก ${stats.unknown} · ไม่ใช่ไอคอน ${stats.notIcon}`);
  if (unknownRuns.size) {
    console.log('ยังไม่มีชื่อใน icon-lexicon.cjs:');
    for (const [r, n] of [...unknownRuns].sort((a, b) => b[1] - a[1])) {
      console.log('  ' + String(n).padStart(3) + '  ' + r + '  '
        + [...r].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' '));
    }
  }
  if (collisions.size) {
    console.log('ชื่อชนกับของเดิมในทะเบียน (ต้องตั้งชื่อใหม่ใน icon-lexicon.cjs):');
    for (const v of collisions.values()) console.log('  ' + v);
  }
  if (!APPLY) console.log('(รายงานอย่างเดียว — ใส่ --apply เพื่อเขียนจริง)');
}

/** เติม `gi` เข้า import ของไฟล์ (ไฟล์ที่ import จาก icons.js อยู่แล้วก็เติมในบรรทัดเดิม) */
function ensureImport(src, rel) {
  if (/\bimport\s*\{[^}]*\bgi\b[^}]*\}\s*from\s*'[^']*icons\.js'/.test(src)) return src;
  const depth = rel.split('/').length - 2;          // src/x.js = 0 · src/a/x.js = 1
  const from = (depth > 0 ? '../'.repeat(depth) : './') + 'icons.js';
  const re = new RegExp("import\\s*\\{([^}]*)\\}\\s*from\\s*'[^']*icons\\.js';");
  const m = re.exec(src);
  if (m) return src.slice(0, m.index) + `import {${m[1].replace(/\s*$/, '')}, gi } from '${from}';`
    + src.slice(m.index + m[0].length);
  // ยังไม่เคย import จาก icons.js — แทรกต่อจาก **คำสั่ง** import สุดท้ายบนหัวไฟล์
  //
  // ★ ห้ามจับด้วย "บรรทัดที่ขึ้นต้นด้วย import" — import หลายบรรทัด (`import {` แล้วขึ้นบรรทัดใหม่)
  //   จะถูกนับว่าจบที่บรรทัดแรก แล้วบรรทัดใหม่ไปแทรกกลางคำสั่งนั้นพอดี = ซอร์สพังทันที
  //   (เจอจริงตอนรันรอบแรก: branching-ui.js) จึงต้องนับปีกกาจนคำสั่งจบจริง
  // ★ จับเฉพาะ **หัวไฟล์** และเฉพาะ import ที่เริ่มต้นคอลัมน์ 0 — `import('./x.js')` แบบไดนามิก
  //   ที่อยู่กลางฟังก์ชัน (ย่อหน้าเข้าไป) ต้องไม่ถูกนับ ไม่งั้นบรรทัดใหม่ไปแทรกกลางฟังก์ชัน
  //   (เจอจริง: scene-props.js · starter-ui.js) · เจอบรรทัดที่ไม่ใช่ import/คอมเมนต์/ว่าง = จบหัวไฟล์
  const lines = src.split('\n');
  let at = 0, pos = 0, brace = 0, inImport = false;
  for (const line of lines) {
    const len = line.length + 1;
    const t = line.trim();
    if (!inImport && /^import\b/.test(line)) inImport = true;
    if (inImport) {
      brace += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (brace <= 0 && /;\s*$/.test(line)) { inImport = false; brace = 0; at = pos + len; }
    } else if (t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) {
      break;                                   // พ้นหัวไฟล์แล้ว
    }
    pos += len;
  }
  return src.slice(0, at) + `import { gi } from '${from}';\n` + src.slice(at);
}

run();
