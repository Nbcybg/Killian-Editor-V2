#!/usr/bin/env node
// i18n-shadow.cjs — หา "จุดที่ตัวแปรท้องถิ่นชื่อ t บังฟังก์ชันแปลภาษา"
//
// โปรเจกต์นี้ใช้ชื่อ `t` เป็นตัวแปรท้องถิ่นเยอะมาก (`const t = state.tabs.get(...)` = แท็บ)
// พอโคดมอดใส่ `t('ui.x.y')` เข้าไปในสโคปเดียวกัน → `t is not a function` ตอนรัน
// **build ผ่านเพราะการบังชื่อเป็น JS ที่ถูกกฎ** — เจอตอน e2e เท่านั้น
//
//   node tools/i18n-shadow.cjs           รายงานจุดที่โดนบัง
//   node tools/i18n-shadow.cjs --apply   แก้ให้: ไฟล์ไหนมีการบัง → เปลี่ยนการเรียกเป็น `tt(...)`
//                                        แล้ว import { t as tt } (ชื่อที่ไม่มีใครใช้เป็นตัวแปร)

const fs = require('fs');
const path = require('path');
const { stripComments } = require('./js-lex.cjs');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// รูปแบบการประกาศตัวแปร/พารามิเตอร์ชื่อ t
const DECLS = [
  /\b(?:const|let|var)\s+t\s*[=;,)]/g,
  /\bfor\s*\(\s*(?:const|let|var)\s+t\b/g,
  /\(\s*t\s*\)\s*=>/g,
  /\(\s*t\s*,/g,
  /,\s*t\s*\)\s*=>/g,
  /,\s*t\s*\)\s*\{/g,
  /\bfunction\s*[A-Za-z0-9_$]*\s*\(\s*t\b/g,
  /\bcatch\s*\(\s*t\s*\)/g,
];

const hits = [];
for (const abs of walk(path.join(ROOT, 'src')).concat([path.join(ROOT, 'main.js')])) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const raw = fs.readFileSync(abs, 'utf8');
  const src = stripComments(raw);
  if (!/\bt\('ui\./.test(src)) continue;
  let n = 0;
  for (const re of DECLS) { re.lastIndex = 0; const m = src.match(re); if (m) n += m.length; }
  if (n) hits.push({ rel, abs, raw, n });
}

for (const h of hits) console.log(String(h.n).padStart(4), h.rel);
console.log('ไฟล์ที่มีตัวแปรชื่อ t บังอยู่:', hits.length, APPLY ? '' : '(ลองดูเฉย ๆ)');

if (!APPLY) process.exit(0);

// แก้แบบปลอดภัยที่สุด: ในไฟล์เหล่านี้ เปลี่ยน **ทุกการเรียก** `t('ui.…')` / `tf('ui.…')`
// เป็น `tt(...)` / `ttf(...)` ซึ่งเป็นชื่อที่ไม่มีใครใช้เป็นตัวแปรในโปรเจกต์นี้
// (ไม่ต้องวิเคราะห์สโคปให้พลาด — เปลี่ยนทั้งไฟล์แล้วไม่มีทางชนกัน)
let changed = 0;
for (const h of hits) {
  let out = h.raw
    .replace(/(^|[^A-Za-z0-9_$.])t\('ui\./g, '$1tt(\'ui.')
    .replace(/(^|[^A-Za-z0-9_$.])tf\('ui\./g, '$1ttf(\'ui.');
  const needTt = /\btt\('ui\./.test(out), needTtf = /\bttf\('ui\./.test(out);
  if (!needTt && !needTtf) continue;
  const want = [];
  if (needTt) want.push('t as tt');
  if (needTtf) want.push('tf as ttf');
  // เติมเข้าไปในบรรทัด import ของ i18n ถ้ามี ไม่งั้นเพิ่มบรรทัดใหม่
  const line = /^import \{([^}]*)\} from '([^']*i18n\.js)';?/m;
  const m = line.exec(out);
  if (m) out = out.replace(line, `import { ${want.join(', ')}, ${m[1].trim()} } from '${m[2]}';`);
  else {
    const depth = h.rel.split('/').length - 2;
    const spec = h.rel === 'main.js' ? './src/i18n.js' : (depth > 0 ? '../'.repeat(depth) : './') + 'i18n.js';
    const stmt = `import { ${want.join(', ')} } from '${spec}';\n`;
    const first = /^import\s/m.exec(out);
    out = first ? out.slice(0, first.index) + stmt + out.slice(first.index) : stmt + out;
  }
  try { require('esbuild').transformSync(out, { loader: 'js', format: 'esm' }); }
  catch (e) { console.error('!! ข้ามไฟล์ (พาร์สไม่ผ่าน)', h.rel, e.message.split('\n')[0]); continue; }
  fs.writeFileSync(h.abs, out, 'utf8');
  changed++;
}
console.log('แก้แล้ว', changed, 'ไฟล์ — เปลี่ยนการเรียกเป็น tt()/ttf()');
