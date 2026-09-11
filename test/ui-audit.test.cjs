// test/ui-audit.test.cjs — [alpha.128] ตาข่ายของ 3 เรื่องที่ผู้ใช้สั่งให้ตรวจ
//
//   1) ปุ่มไอคอนล้วนต้องมี tooltip — ไม่มีข้อความ ไม่มี title = ผู้ใช้เดาไม่ออกว่าปุ่มนี้ทำอะไร
//   2) ช่องกรอกที่ "เริ่มว่างและไม่มีป้ายกำกับ" ต้องมี placeholder บอก
//   3) คำสั่งที่ลบ/ย้ายไฟล์ของผู้ใช้ต้องจดลงบันทึก — พวกนี้มาจากเมนูคลิกขวา
//      จึงไม่ผ่าน `handleCommand` ที่จด `cmd:` ให้ ถ้าไม่จดเองเลยก็ไล่ย้อนไม่ได้ว่างานหายตอนไหน
//      (ก่อน alpha.128: recycle/scene-ops/section-ops/drafts ไม่มี log สักบรรทัดเดียว)
//
// เรื่องข้อความไทยฮาร์ดโค้ดอยู่ที่ test/i18n-keys.test.cjs (ใช้ tools/i18n-classify.cjs ร่วมกัน)
require('./_lang.cjs');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

// ───────── 1) tooltip ของปุ่มไอคอนล้วนใน index.html ─────────
{
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  const bad = [];
  const re = /<(button|span|div|a)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, , attrs, inner] = m;
    if (!/data-icon/.test(attrs)) continue;            // ไม่ใช่ปุ่มไอคอน
    if (/\btitle\s*=/.test(attrs)) continue;
    if (inner.replace(/<[^>]*>/g, '').trim()) continue; // มีข้อความให้อ่านอยู่แล้ว
    bad.push((attrs.match(/id="([^"]+)"/) || [, '(ไม่มี id)'])[1]);
  }
  ck('★ ปุ่มไอคอนล้วนใน index.html มี tooltip ครบทุกปุ่ม', bad.length === 0, bad.join(', '));

  // tooltip ต้องผ่านระบบภาษาด้วย ไม่ใช่ไทยตายตัว (กฎถาวร alpha.77)
  const noKey = [];
  for (const t of html.match(/<[^>]*\btitle\s*=\s*"[^"]*"[^>]*>/g) || []) {
    if (/\btitle\s*=\s*""/.test(t)) continue;          // title ว่าง = ตั้งค่าตอนรัน (เช่น จุด "ยังไม่บันทึก")
    if (!/data-i18n-title/.test(t)) noKey.push(t.slice(0, 60));
  }
  ck('★ ทุก title= ใน index.html มี data-i18n-title คู่กัน (แปลตามภาษาได้)',
     noKey.length === 0, noKey.join(' | '));
}

// ───────── 2) ช่องกรอกที่เริ่มว่าง + ไม่มีป้าย ต้องมี placeholder ─────────
{
  // จุดที่รอบ alpha.128 ไล่ปิดไว้ — ถ้าใครลบ placeholder ออกต้องรู้ทันที
  const need = [
    ['src/scratchpad.js', 'ui.notes.scratchPh', 2],
    ['src/session-notes.js', 'ui.notes.quickNotePh', 1],
    ['src/wiki.js', 'ui.wiki.secTitlePh', 1],
  ];
  for (const [rel, key, n] of need) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const got = (src.match(new RegExp(key.replace(/\./g, '\\.'), 'g')) || []).length;
    ck('ช่องกรอกใน ' + rel + ' ยังมี placeholder (' + key + ')', got >= n, got + '/' + n);
  }
  // placeholder ทุกตัวต้องมาจากไฟล์ภาษา ห้ามเป็นข้อความไทยตรง ๆ
  const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, o); } else if (e.name.endsWith('.js')) o.push(p);
  } return o; };
  const litThai = [];
  for (const abs of walk(path.join(ROOT, 'src'))) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const src = fs.readFileSync(abs, 'utf8');
    const testFrom = rel === 'src/app.js'
      ? src.slice(0, src.indexOf('\nasync function runTest(')).split('\n').length : Infinity;
    const re = /\.placeholder\s*=\s*(['"])([^'"]*[฀-๿][^'"]*)\1/g;
    let m;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      if (line < testFrom) litThai.push(rel + ':' + line);
    }
  }
  ck('★ ไม่มี placeholder ที่ฮาร์ดโค้ดข้อความไทย', litThai.length === 0, litThai.join(', '));
}

// ───────── 3) คำสั่งที่ลบ/ย้ายไฟล์ต้องจดลงบันทึก ─────────
{
  const mustLog = ['src/recycle.js', 'src/scene-ops.js', 'src/section-ops.js', 'src/drafts.js'];
  for (const rel of mustLog) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const writes = (src.match(/kapi\.(move|remove|writeFile|mkdir)\(/g) || []).length;
    const logs = (src.match(/logAction\(/g) || []).length;
    ck('★ ' + rel + ' จดบันทึกการเปลี่ยนแปลงไฟล์ (' + writes + ' จุดที่แตะดิสก์)',
       logs > 0, 'logAction ' + logs + ' ครั้ง');
  }
  // ตัววินิจฉัยกระดานต้องไม่ยิง INFO รัว ๆ ทับบันทึกจริงอีก (alpha.128: 45% ของไฟล์เป็นของมัน)
  const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  ck("★ auditPlannerRows ยิง debug ตอนปกติ (ไม่ท่วมบันทึกด้วย info)",
     /const bad = !sec \|\| !rows\.length \|\| hidden \|\| faded \|\| blank;[\s\S]{0,600}?log\(bad \? 'warn' : 'debug'/.test(app));
  const pi = fs.readFileSync(path.join(ROOT, 'src/planner/planner-interact.js'), 'utf8');
  ck('★ _log ของกระดานเป็น debug ไม่ใช่ info', /_log\(msg, extra\) \{[\s\S]{0,120}?log\('debug'/.test(pi));
  // ตัวเฝ้า DOM ของ K-1 ทั้งชุด (ปิดเคสแล้วที่ alpha.75) ต้องไม่กลับมายิง info/warn รัว ๆ อีก
  const noisy = (app.match(/log\('info',\s*t{1,2}f?\('ui\.app\.plannerTree/g) || []).length
              + (app.match(/log\('warn',\s*t{1,2}\('ui\.app\.plannerTreeRowBoard/g) || []).length;
  ck('★ ตัววินิจฉัย planner/tree ไม่ยิง info/warn ประจำอีกแล้ว', noisy === 0, String(noisy));
}

// ───────── 4) ห้ามเทียบเงื่อนไขกับ "ข้อความที่แปลแล้ว" ─────────
//
// `pick.startsWith('เลือกจากคลัง')` · `e.includes('ชื่อผู้ให้บริการ')` · `title === 'ใหม่'`
// ใช้ได้เฉพาะหน้าจอภาษาไทย — สลับเป็นอังกฤษแล้ว **ฟีเจอร์ตายเงียบ ไม่มี error ให้เห็น**
// (alpha.128 เจอ 8 จุด: คลิก "เลือกจากคลัง" เด้งกล่องไฟล์ของ OS · ปุ่มทดสอบ AI ถูกบล็อก ·
//  ชื่อการ์ด/เซสชันไม่ตั้งอัตโนมัติ · ปุ่มแทรกยัดข้อความ "กำลังทำงาน…" ลงฉากจริง)
{
  const acorn = require('acorn');
  const TH = /[ก-๙]/;
  const STRCMP = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'search']);
  // จุดที่เทียบกับ **ค่าข้อมูล** ไม่ใช่ข้อความบนจอ — ค่าพวกนี้เก็บเป็นไทยในไฟล์งานตามกฎ
  const OK = new Set([
    'src/app.js|เก็บถาวร',        // สถานะฉากใน scenes.json (SCENE_STATUSES)
    'src/sceneFilter.js|หรือ',    // คำเชื่อมของภาษาค้นหาที่ผู้ใช้พิมพ์เอง
    'src/sceneFilter.js|ไม่',
  ]);
  const walk2 = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk2(p, o); } else if (e.name.endsWith('.js')) o.push(p);
  } return o; };
  const bad = [];
  for (const abs of walk2(path.join(ROOT, 'src'))) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const src = fs.readFileSync(abs, 'utf8');
    const testFrom = rel === 'src/app.js'
      ? src.slice(0, src.indexOf('\nasync function runTest(')).split('\n').length : Infinity;
    let ast;
    try { ast = acorn.parse(src, { sourceType: 'module', ecmaVersion: 'latest', locations: true }); } catch { continue; }
    const isTh = (n) => n && n.type === 'Literal' && typeof n.value === 'string' && TH.test(n.value);
    (function w(n) {
      if (!n || typeof n.type !== 'string') return;
      let lit = null;
      if (n.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(n.operator))
        lit = [n.left, n.right].find(isTh);
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed
          && STRCMP.has(n.callee.property.name) && isTh(n.arguments[0])) lit = n.arguments[0];
      if (n.type === 'SwitchCase' && isTh(n.test)) lit = n.test;
      if (lit && n.loc.start.line < testFrom && !OK.has(rel + '|' + lit.value))
        bad.push(rel + ':' + n.loc.start.line + ' "' + String(lit.value).slice(0, 24) + '"');
      for (const k in n) {
        if (k === 'loc') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && w(x));
        else if (v && typeof v.type === 'string') w(v);
      }
    })(ast);
  }
  ck('★★ ไม่มีที่ไหนเทียบเงื่อนไขกับข้อความไทยที่แปลตามภาษา', bad.length === 0, bad.join(' | '));
}

// ───────── 5) หัวแผง: คีย์ภาษาต้องมีจริง · ชื่อไอคอนต้องมีในชุด ─────────
//
// `titleOf()` เรียก `t(d.i18n)` ซึ่ง **ไม่มีการตกกลับ** (กฎถาวร alpha.77) → คีย์ผิดเมื่อไหร่
// หัวแผงโชว์ตัวคีย์โต้ง ๆ · และ `iconSpan()` ตกไป `textContent = name` เมื่อไอคอนไม่มีในชุด
// → ชื่อไอคอนโผล่เป็นตัวหนังสือบนหัวแผง (alpha.128 เจอทั้งคู่พร้อมกันที่แผง planner-props:
//  หัวแผงขึ้นว่า `info PANEL.PLANNERPROPSTITLE`)
{
  const src = fs.readFileSync(path.join(ROOT, 'src/panels/panel-ui.js'), 'utf8');
  const csv = fs.readFileSync(path.join(ROOT, 'languages/k2_th.csv'), 'utf8');
  const keys = new Set(csv.split('\n').map((l) => l.split(',')[0]));
  // [alpha.147] ชุดไอคอน = ไฟล์ใน icons/svg + ตัวสำรองใน icons/glyphs.csv (icons.js ไม่มีตารางในตัวแล้ว)
  const { buildCommandsData } = require('../tools/commands-data.cjs');
  const icoData = buildCommandsData(ROOT);
  const ICON = new Set([...Object.keys(icoData.ICON_SVG), ...Object.keys(icoData.ICON_GLYPH)]);

  const badKey = [...src.matchAll(/i18n:\s*'([^']+)'/g)].map((m) => m[1])
    .filter((k) => !keys.has(k) && !keys.has('ui.' + k));
  ck('★★ ทุกแผงมีคีย์ภาษาจริง (ไม่งั้นหัวแผงโชว์ตัวคีย์)', badKey.length === 0, badKey.join(', '));

  const badIcon = [...new Set([...src.matchAll(/icon:\s*'([^']+)'/g)].map((m) => m[1]))]
    .filter((n) => !ICON.has(n));
  ck('★★ ทุกแผงใช้ชื่อไอคอนที่มีอยู่จริง (ไม่งั้นชื่อไอคอนโผล่เป็นตัวหนังสือ)',
     badIcon.length === 0, badIcon.join(', '));

  // t() รับคีย์ตัวเดียว — เขียนค่าสำรองไว้ = หลอกคนอ่าน
  ck('titleOf ไม่ส่งค่าสำรองให้ t() (ซึ่งถูกทิ้งอยู่แล้ว)',
     !/function titleOf\(d\)[^\n]*t\(d\.i18n,/.test(src));
}

console.log(`\nui-audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
