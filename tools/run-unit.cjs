#!/usr/bin/env node
// ตัวรัน unit test ทั้งชุด — [alpha.92]
//
// ★ ทำไมต้องมีไฟล์นี้: เดิม `test:unit` เป็นสาย `node a && node b && node c && …` ยาว 66 ตัว
//   ตัวเดียวแดง = **ทุกตัวที่อยู่ข้างหลังไม่ได้รันเลย** และไม่มีใครรู้ว่าไม่ได้รัน
//   ของจริงที่เกิดขึ้น: `export-hub` แดงมาตั้งแต่ alpha.88 (เทสค้างค่าเก่า ไม่ใช่โค้ดพัง)
//   แล้วมันบัง `session-core · plugin-core · shortcuts · empty-heading · fountain · convert`
//   ไว้ **4 รุ่นติดกัน** โดยผลรวมยังขึ้นว่า "ผ่าน" ทุกครั้งที่ไม่มีใครอ่านท้ายผล
//
// ตัวนี้: รันให้ครบทุกไฟล์เสมอ → สรุปตอนท้ายว่าไฟล์ไหนแดงบ้าง → exit 1 ถ้ามีแดง
// และ **หาไฟล์เทสเอง** จาก test/*.test.{cjs,mjs,js} — เพิ่มไฟล์เทสใหม่แล้วถูกรันทันที
// ไม่ต้องไปต่อสายใน package.json (ที่ผ่านมา md.test.js กับ nav-filter.test.mjs ตกสำรวจอยู่)

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(DIR)
  .filter((f) => /\.test\.(cjs|mjs|js)$/.test(f))
  .sort();

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const run = only.length ? files.filter((f) => only.some((o) => f.includes(o))) : files;
const quiet = process.argv.includes('--quiet');

// แต่ละไฟล์สรุปผลคนละแบบ ("PASS 27" · "27 passed" · หรือพิมพ์ PASS ทีละบรรทัด)
// นับให้ได้ทั้งสามแบบ — ตัวเลขนี้ไว้ **ดู** ว่าชุดเทสโตขึ้นหรือหด ไม่ได้เอาไปตัดสินอะไร
const SUMMARY_RE = [
  /PASS (\d+)\b/g,            // "PASS 27"            (spell, deco-diff, …)
  /(\d+) passed/g,            // "22 passed, 0 failed"
  /: (\d+) ผ่าน/g,             // "tools: 102 ผ่าน, 0 ล้มเหลว"
  /\((\d+) checks\)/g,        // "alpha.57a fountain OK (124 checks)"
  /— (\d+) checks/g,          // "ALL OK — 32 checks"
];
function countChecks(out) {
  for (const re of SUMMARY_RE) {
    let n = 0;
    for (const m of out.matchAll(re)) n += Number(m[1]);
    if (n) return n;
  }
  return out.split('\n').filter((l) => /^\s*(PASS |✓)/.test(l)).length;
}

const failed = [];
let checks = 0;
const t0 = Date.now();
for (const f of run) {
  const started = Date.now();
  try {
    const out = execFileSync(process.execPath, [path.join(DIR, f)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    const n = countChecks(out);
    checks += n;
    // "–" = ไฟล์นั้นไม่ได้พิมพ์ยอดไว้ (เช่น md.test.js ที่ throw เอาเมื่อพัง) — ไม่ใช่ 0 ข้อ
    if (!quiet) process.stdout.write(pad(f) + 'ผ่าน  ' + ms(started)
      + (n ? String(n).padStart(6) + ' ข้อ' : '     –') + '\n');
  } catch (e) {
    failed.push({ f, out: String(e.stdout || '') + String(e.stderr || '') });
    process.stdout.write(pad(f) + 'แดง   ' + ms(started) + '\n');
  }
}

function pad(f) { return '  ' + f.padEnd(34); }
function ms(t) { return String(Date.now() - t).padStart(5) + 'ms'; }

console.log('\n' + '─'.repeat(60));
if (!failed.length) {
  console.log('unit ผ่านครบ ' + run.length + ' ไฟล์ · ' + checks + ' ข้อ · '
    + ((Date.now() - t0) / 1000).toFixed(1) + ' วินาที');
  process.exit(0);
}
console.log('แดง ' + failed.length + ' จาก ' + run.length + ' ไฟล์:');
for (const { f, out } of failed) {
  console.log('\n══ ' + f + ' ' + '═'.repeat(Math.max(0, 56 - f.length)));
  const lines = out.split('\n').filter((l) => /FAIL|✗|Error|error:/i.test(l));
  console.log((lines.length ? lines : out.split('\n').slice(-12)).slice(0, 15).join('\n'));
}
process.exit(1);
