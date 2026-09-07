#!/usr/bin/env node
// tools/dead-exports.cjs — [alpha.126] หา `export` ที่ไม่มีใครเรียก
//
// ทำไมต้องมีเครื่องมือ ไม่ใช่ไล่มือ: รอบ alpha.125 ไล่มือแล้วยัง **หลุด `src/nav.js` ทั้งโมดูล**
// (orphan ตัวเดียวที่รอด) · ของแบบนี้ต้องนับด้วยเครื่อง ไม่ใช่ด้วยความจำ
//
// วิธีอ่านผล 3 ชั้น:
//   ไม่มีใครใช้เลย  — ไม่มีใครอ้างถึงจากไฟล์อื่นและไฟล์ตัวเองก็ไม่ใช้ → **ลบได้จริง**
//   ใช้ในไฟล์ตัวเอง — ถอดคำว่า `export` ออกได้ แต่ต้องเก็บโค้ดไว้
//   เทสเท่านั้น     — เข้าถึงได้ทางเทสอย่างเดียว · **ถูกต้องตาม convention ของโปรเจกต์**
//                     (โมดูลบริสุทธิ์เปิดผิวให้เทสวัดได้) — ไม่ต้องลบ
//
//   node tools/dead-exports.cjs            # สรุปทั้งหมด
//   node tools/dead-exports.cjs --removable # เฉพาะที่ลบได้จริง
//   node tools/dead-exports.cjs --modules   # โมดูลที่ไม่มีใครใน src/ import เลย (แบบ nav.js)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const jsFiles = (dir, out = []) => {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) jsFiles(p, out);
    else if (n.endsWith('.js')) out.push(p);
  }
  return out;
};
const files = jsFiles(SRC);
const testDir = path.join(ROOT, 'test');
const tests = fs.existsSync(testDir)
  ? fs.readdirSync(testDir).filter((n) => /\.(cjs|mjs|js)$/.test(n)).map((n) => path.join(testDir, n))
  : [];
const extra = ['main.js', 'preload.js', 'build.js'].map((n) => path.join(ROOT, n)).filter(fs.existsSync);

const code = new Map();
for (const f of [...files, ...tests, ...extra]) {
  try { code.set(f, fs.readFileSync(f, 'utf8')); } catch {}
}
const rel = (f) => f.replace(ROOT + path.sep, '');
const isTest = (f) => f.startsWith(testDir + path.sep);

// ───────── โมดูลที่ไม่มีใครใน src/ import ─────────
function orphanModules() {
  const out = [];
  for (const f of files) {
    const base = path.basename(f);
    let imported = false;
    for (const g of files) {
      if (g === f) continue;
      // ดูทั้ง static import และ dynamic import()
      if (new RegExp("['\"][^'\"]*" + base.replace('.', '\\.') + "['\"]").test(code.get(g))) { imported = true; break; }
    }
    if (!imported && base !== 'app.js') out.push(rel(f));
  }
  return out;
}

// ───────── export ที่ไม่มีใครเรียก ─────────
function deadExports() {
  const rows = [];
  for (const f of files) {
    const c = code.get(f);
    const names = new Set();
    const re = /^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    let m; while ((m = re.exec(c))) names.add(m[1]);
    for (const name of names) {
      const word = new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b', 'g');
      let outside = 0, inTest = 0;
      for (const [g, gc] of code) {
        if (g === f) continue;
        const n = (gc.match(word) || []).length;
        if (!n) continue;
        if (isTest(g)) inTest += n; else outside += n;
      }
      const self = (c.match(word) || []).length - 1;   // ลบบรรทัดประกาศออก
      if (outside) continue;
      rows.push({ file: rel(f), name, self,
                  kind: inTest ? 'เทสเท่านั้น' : (self ? 'ใช้ในไฟล์ตัวเอง' : 'ไม่มีใครใช้เลย') });
    }
  }
  return rows;
}

const args = process.argv.slice(2);
if (args.includes('--modules')) {
  const o = orphanModules();
  console.log(o.length ? o.join('\n') : '— ไม่มีโมดูลกำพร้า —');
  process.exit(0);
}
const rows = deadExports();
const removable = rows.filter((r) => r.kind === 'ไม่มีใครใช้เลย');
if (args.includes('--removable')) {
  for (const r of removable) console.log(r.file.padEnd(38), r.name);
  console.log('\nลบได้จริง', removable.length, 'รายการ');
  process.exit(0);
}
const by = (k) => rows.filter((r) => r.kind === k);
for (const k of ['ไม่มีใครใช้เลย', 'ใช้ในไฟล์ตัวเอง', 'เทสเท่านั้น']) {
  console.log('\n── ' + k + ' (' + by(k).length + ') ──');
  for (const r of by(k).slice(0, args.includes('--all') ? 1e9 : 12))
    console.log('  ' + r.file.padEnd(38), r.name);
  if (!args.includes('--all') && by(k).length > 12) console.log('  … อีก ' + (by(k).length - 12) + ' (ใส่ --all เพื่อดูครบ)');
}
const orph = orphanModules();
console.log('\n── โมดูลที่ไม่มีใครใน src/ import (' + orph.length + ') ──');
for (const o of orph) console.log('  ' + o);
console.log('\nสรุป: ลบได้จริง ' + removable.length + ' · ถอด export ได้ ' + by('ใช้ในไฟล์ตัวเอง').length
            + ' · เทสเท่านั้น ' + by('เทสเท่านั้น').length + ' · โมดูลกำพร้า ' + orph.length);
