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
  // ══ [alpha.153 ข้อ 4] กฎเปลี่ยน แต่ **เจตนาเดิมยังอยู่** ══
  //
  // alpha.128 บังคับให้ `_log` ของกระดานเป็น debug ทั้งหมด เพราะมันยิงรัวจนทับบันทึกจริง
  // แต่ผลข้างเคียงคือ *ไม่มีอะไรของกระดานโผล่ในแผงบันทึกเลย* (แผงเปิดแค่ error/warn/info)
  // ผู้ใช้: *"planner ยังไม่มี log ใน system log เลยไม่รู้ว่ามัน error มั้ย ทำให้ละเอียดเลย"*
  //
  // กฎใหม่ที่ได้ทั้งสองอย่าง: หนึ่งบรรทัดต่อหนึ่งการกระทำ = info · ของที่ยิงรัว = debug
  // ตัวที่ยิงรัวที่สุดคือ `setTool` (ถูกเรียกซ้ำทุกครั้งที่ `syncNodeInteractivity()` ทำงาน)
  ck('★ [153] _log ของกระดานจดเป็น info ได้แล้ว (ไม่งั้นแผงบันทึกไม่เห็นอะไรเลย)',
     /_log\(msg, extra, level\) \{[\s\S]{0,160}?log\(level \|\| 'info'/.test(pi));
  ck('★★ [153] แต่ setTool ที่ถูกเรียกซ้ำ ๆ ต้องลง debug (กันท่วมบันทึกตามบทเรียน alpha.128)',
     /const changed = this\.tool !== name;/.test(pi)
     && /changed \? 'info' : 'debug'/.test(pi));
  ck('★ [153] กรอบนำระหว่างลาก (ยิงถี่) ยังเป็น debug', /createGuideOccurFrame[\s\S]{0,220}?'debug'/.test(pi));
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

// ───────── 4) [alpha.150r2] ★★ ไอคอนทั้งโปรแกรมต้องมาจาก `icons/` ไม่ใช่เขียนไว้ในโค้ด ─────────
//
// ผู้ใช้: *"อย่าลืมนะ icon ข้อความ ui ห้าม hard code ใน skill น่าจะบอกแล้วให้ใส่ที่ไหน"* → *"เก็บให้ครบเลย"*
//
// กฎ alpha.147 ("เปลี่ยนไอคอน = วาง svg ชื่อเดิมลง icons/svg/") มีผลกับโค้ดทุกไฟล์
// แต่ **ไม่เคยมีอะไรตรวจ** — ซอร์สจึงสะสมไอคอนที่เขียนไว้ในโค้ดถึง 570 กว่าจุด
// ตอนนี้ทุกจุดอ่านจากทะเบียนผ่าน `gi()` / `icon()` / `data-icon` แล้ว และเทสนี้เฝ้าไม่ให้ย้อนกลับ
//
// เดินผ่าน **เลกเซอร์ + ตัวจัดประเภทตัวเดียวกับเครื่องมือ i18n** จึงไม่ฟ้องของในคอมเมนต์/regex
// และไม่ฟ้องค่าที่เขียนลงไฟล์งาน — กติกาเดียวกับ `tools/icon-extract.cjs` ทุกข้อ
// (สองตัวนี้ใช้รายการยกเว้นก้อนเดียวกันจาก `tools/icon-lexicon.cjs`)
{
  const { buildCommandsData } = require('../tools/commands-data.cjs');
  const { lexStrings, cookedValue } = require('../tools/js-lex.cjs');
  const { classify, testStart } = require('../tools/i18n-classify.cjs');
  const { NOT_ICON } = require('../tools/icon-lexicon.cjs');
  const ico = buildCommandsData(ROOT);
  const KNOWN = new Set([...Object.keys(ico.ICON_SVG), ...Object.keys(ico.ICON_GLYPH)]);

  // ── อะไรนับเป็น "ไอคอน" ──
  // นับ: พิกโตแกรม · รูปทรงเรขาคณิต (▲ ● ▾) · เครื่องหมายถูก/กากบาท
  // ไม่นับ: ลูกศร (U+2190–21FF) และเส้นตีตาราง (U+2500–257F) — สองชุดนี้ถูกใช้เป็น
  //        **เครื่องหมายวรรคตอนในประโยค** ("ตั้งค่า → ผู้ให้บริการ") กับผังต้นไม้ในเอกสาร
  //        ฟ้องเมื่อไหร่ก็ได้แต่เสียงรบกวน ไม่ได้ช่วยให้ใครเปลี่ยนไอคอนได้
  const ICON = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}]/u;
  const SKIP_KIND = new Set(['test', 'data-range', 'skip-file', 'compare', 'data-call',
                             'console', 'already', 'tagged', 'obj-key', 'prop']);
  // [alpha.157r] glyph-icons.js = ตาราง "อีโมจิ → ไอคอนเส้น" (อักขระเป็นกุญแจของตาราง ไม่ใช่ไอคอนที่วาดออกจอ)
  const SKIP_FILES = new Set(['src/visual-tags.js', 'src/icons.js', 'src/glyph-icons.js']);

  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'generated') walk(p, out); }
      else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
  };

  const bad = [];
  const usedNames = new Set();
  for (const abs of walk(path.join(ROOT, 'src'))) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const src = fs.readFileSync(abs, 'utf8');
    // ★ ข้ามไฟล์ที่ยกเว้น **ก่อน** เก็บชื่อ — ไม่งั้นตัวอย่างในคอมเมนต์ของ icons.js
    //   (`gi('…')`) ถูกนับเป็นชื่อจริงแล้วเทสแดงโดยไม่มีอะไรผิด
    if (SKIP_FILES.has(rel)) continue;
    for (const m of src.matchAll(/\bgi\(\s*'([^']+)'\s*\)/g)) usedNames.add(m[1]);
    const tstart = testStart(rel, src);
    for (const tok of lexStrings(src)) {
      let v;
      try { v = cookedValue(tok); } catch { continue; }
      if (typeof v !== 'string' || !ICON.test(v)) continue;
      if (SKIP_KIND.has(classify(src, tok, rel, tstart))) continue;
      // ตัวที่ประกาศไว้ว่า "ไม่ใช่ไอคอน" (ปุ่ม ⌘⌥⇧ ของ mac ฯลฯ) — ข้ามพร้อมเหตุผลในไฟล์นั้น
      const chars = [...v].filter((c) => ICON.test(c));
      if (chars.every((c) => Object.prototype.hasOwnProperty.call(NOT_ICON, c))) continue;
      bad.push(rel + ':' + tok.line + ' ' + chars.join(''));
    }
  }
  ck('★★ [150r2] ทั้ง src/ ไม่มีไอคอนฮาร์ดโค้ดในโค้ดแล้ว (ต้องมาจาก icons/)',
     bad.length === 0, bad.length + ' จุด: ' + bad.slice(0, 6).join(' · '));

  // ชื่อที่โค้ดเรียกต้องมีของจริงในทะเบียน — ไม่งั้นไอคอนหายเงียบ ๆ (gi() คืน '')
  const unknown = [...usedNames].filter((n) => !KNOWN.has(n));
  ck('[150r2] อ่านชื่อไอคอนที่โค้ดเรียกได้', usedNames.size >= 100, usedNames.size);
  ck('★★ [150r2] ทุกชื่อที่ gi() เรียกมีอยู่จริงในทะเบียน',
     unknown.length === 0, unknown.slice(0, 8).join(', '));

  // ตารางไอคอนของกระดาน — ต้องเก็บ "ชื่อ" ไม่ใช่ตัวอีโมจิ
  const dataSrc = fs.readFileSync(path.join(ROOT, 'src/planner/planner-data.js'), 'utf8');
  const block = /export const ICONS = \{([\s\S]*?)\};/.exec(dataSrc);
  const icons = block ? [...block[1].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]) : [];
  ck('[150r] อ่านตารางไอคอนของกระดานได้', icons.length >= 11, icons.length);
  ck('★★ [150r] ทุกชื่อไอคอนของกระดานมีอยู่จริงในทะเบียน',
     icons.every((n) => KNOWN.has(n)), icons.filter((n) => !KNOWN.has(n)).join(', '));
}

// ───────── 5) [alpha.151] ★★ `$('#id').onclick = …` กับปุ่มที่ไม่มีจริง = ตัวผูกปุ่มตายทั้งแถว ─────────
//
// ผู้ใช้: *"comment ใช้จาก float bar ไม่ได้ แต่ใช้จาก menu ได้"*
//
// ตัวผูกปุ่มเกือบร้อยบรรทัดอยู่ในก้อน `DOMContentLoaded` ก้อนเดียว เขียนแบบ `$('#x').onclick = …`
// ถอดปุ่มออกจาก index.html เมื่อไหร่ (หรือพิมพ์ id ผิด) บรรทัดนั้นจะโยน TypeError
// แล้ว **ทุกบรรทัดที่เหลือหลังจากนั้นไม่ถูกรันเลย** — ปุ่มครึ่งแถบกดแล้วเงียบ
// และแถบรูปแบบลอยไม่ถูกสร้างด้วยซ้ำ · ไม่มี error ให้ผู้ใช้เห็น มีแต่ "ปุ่มนี้เสีย"
//
// เจอจริงตอนย้ายปุ่มจัดแนวตั้งไปแถบกระดาน (alpha.151) — เทสนี้จับได้ทันทีโดยไม่ต้องเปิดโปรแกรม
{
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const tstart = (() => {
    const m = /\nasync function runTest\(/.exec(appSrc);
    return m ? appSrc.slice(0, m.index).split('\n').length : Infinity;
  })();
  const lines = appSrc.split('\n');
  const bad = [];
  // เฉพาะรูปแบบที่ **ระเบิดทันทีถ้าไม่มีปุ่ม**: `$('#id').` โดยไม่มีตัวกัน null คั่นหน้า
  for (let i = 0; i < lines.length; i++) {
    if (i + 1 >= tstart) break;                      // บล็อกเทสมีตัวกันของตัวเอง
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;   // คอมเมนต์
    for (const m of line.matchAll(/\$\('#([\w-]+)'\)\s*(\.|\?)/g)) {
      if (m[2] === '?') continue;                    // `$('#x')?.` = กันไว้แล้ว
      const before = line.slice(0, m.index);
      if (/(\$\('#[\w-]+'\)\s*&&|if\s*\()/.test(before)) continue;   // `x && x.onclick` / ใน if
      if (!htmlIds.has(m[1])) bad.push(`app.js:${i + 1} #${m[1]}`);
    }
  }
  ck('★★ [151] ทุก $(\'#id\') ที่ใช้ตรง ๆ มีปุ่มจริงใน index.html',
     bad.length === 0, bad.slice(0, 8).join(' · '));
  ck('[151] อ่าน id จาก index.html ได้', htmlIds.size >= 60, htmlIds.size);
}

// ───────── 6) [alpha.151] ★★ `.k-fmtbar` ไม่ใช่ชื่อที่ชี้แถบเดียวอีกแล้ว ─────────
//
// กระดานมีแถบรูปแบบของตัวเอง (ข้อ 3 ของผู้ใช้) ที่ใช้คลาส `.k-fmtbar` ร่วมกันเพื่อให้หน้าตาเหมือนกัน
// `document.querySelector('.k-fmtbar')` จึงคว้าแถบผิดตัวได้เมื่อกระดานเปิดอยู่ —
// การตั้งค่าของหน้าเขียนไปลงแถบกระดานแทน โดยไม่มีข้อผิดพลาดให้เห็น
// (เจอจริงตอน alpha.151: เทสลำดับปุ่มบนแถบลอยอ่านเจอ pb-* ทั้งแถบ)
{
  const walk6 = (dir, out = []) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, f.name);
      if (f.isDirectory()) walk6(fp, out);
      else if (f.name.endsWith('.js')) out.push(fp);
    }
    return out;
  };
  const bad6 = [];
  for (const fp of walk6(path.join(ROOT, 'src'))) {
    const src6 = fs.readFileSync(fp, 'utf8');
    const rel6 = path.relative(ROOT, fp).split(path.sep).join('/');
    src6.split('\n').forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      if (/TB_FMT_HOST\s*=/.test(line)) return;          // ตัวประกาศเอง
      // สตริงไหนก็ตามที่ลงท้ายด้วย `.k-fmtbar` พอดี (ไม่ใช่ `.k-fmtbar-grip` ฯลฯ)
      for (const m of line.matchAll(/'([^']*\.k-fmtbar)'/g)) {
        if (/closest\(\s*'[^']*$/.test(line.slice(0, m.index + 1))) continue;   // ไต่ขึ้นจากปุ่ม ถูกตัวเสมอ
        bad6.push(rel6 + ':' + (i + 1) + ' ' + m[1]);
      }
    });
  }
  ck('★★ [151] ไม่มีที่ไหนเลือกแถบรูปแบบด้วย .k-fmtbar เปล่า ๆ (คว้าแถบกระดานผิดตัว)',
     bad6.length === 0, bad6.slice(0, 6).join(' · '));
  const tbu6 = fs.readFileSync(path.join(ROOT, 'src/toolbar/toolbar-ui.js'), 'utf8');
  ck('[151] TB_FMT_HOST กันแถบกระดานออกจริง',
     /TB_FMT_HOST\s*=\s*'[^']*:not\(\.planner-fmtbar\)'/.test(tbu6));
}

// ───────── 7) [alpha.152] ★★ การ์ดที่เพิ่งเกิดต้องเชื่อฟังเครื่องมือที่เลือกอยู่ ─────────
//
// ผู้ใช้: *"ถ้าเรา double click สร้าง card ตัวไกด์ตอนสร้าง card ครั้งถัดไปจะหาย"*
//
// ตอนใช้เครื่องมือวาด การ์ดทุกใบต้อง `evented:false` (ตั้งใน `setTool`) ไม่งั้น fabric คว้าการ์ด
// ที่อยู่ใต้เมาส์ไปลากแทนการวาดกรอบนำ · แต่ `setTool` วนแค่การ์ดที่มีอยู่ ณ ตอนเรียก —
// การ์ดที่เกิดทีหลังจึงเกิดมา `evented:true` แล้วกลายเป็นหลุมดำกลางกระดาน
//
// กฎถาวร: ทุกที่ที่เรียก `renderNode()` ต้องมี `syncNodeInteractivity()` ตามมาในระยะใกล้ ๆ
{
  const src7 = fs.readFileSync(path.join(ROOT, 'src/planner/planner.js'), 'utf8');
  const lines7 = src7.split('\n');
  const bad7 = [];
  for (let i = 0; i < lines7.length; i++) {
    if (!/this\.renderer\.renderNode\(/.test(lines7[i])) continue;
    const window7 = lines7.slice(i, i + 14).join('\n');
    if (!/syncNodeInteractivity\(\)/.test(window7)) bad7.push('planner.js:' + (i + 1));
  }
  ck('★★ [152] ทุกทางที่สร้างการ์ด ตามด้วย syncNodeInteractivity() เสมอ',
     bad7.length === 0, bad7.join(' · '));
  ck('[152] หาจุดสร้างการ์ดเจอจริง',
     (src7.match(/this\.renderer\.renderNode\(/g) || []).length >= 4);
}

// ───────── 8) [alpha.152] ★ clipPath ของ fabric อยู่ในระบบพิกัดก่อนสเกลของวัตถุ ─────────
//
// ผู้ใช้: *"รูปไม่เต็มกรอบเลย มัน crop มาเลย"*
// กรอบครอบถูกคูณด้วย scaleX/scaleY ของรูป → ต้องหารกลับตอนตั้งค่า ไม่งั้นเห็นรูปแค่เศษเสี้ยว
{
  const rnd = fs.readFileSync(path.join(ROOT, 'src/planner/planner-render.js'), 'utf8');
  // เฉพาะกรอบครอบ **ของรูป** — รูปเท่านั้นที่ถูกย่อ/ขยายด้วย scaleX/scaleY
  // (กล่องข้อความในการ์ดมีสเกล 1 เสมอ กรอบครอบจึงตรงอยู่แล้ว ไม่ต้องหาร)
  const clips = [...rnd.matchAll(/\bimg\.clipPath\s*=\s*new fabric\.Rect\(\{([\s\S]{0,320}?)\}\)/g)];
  const bad8 = clips.filter((m) => !/\/\s*scaleX/.test(m[1]) || !/\/\s*scaleY/.test(m[1]));
  ck('★★ [152] clipPath ของรูปถูกหารกลับด้วยสเกลทุกที่',
     bad8.length === 0, bad8.length + ' ที่ยังไม่หาร');
  ck('[152] หา clipPath ของรูปเจอจริง', clips.length >= 2, clips.length);
}

// ───────── 9) [alpha.152] ★ คีย์ลัดของกระดานต้องอ่านปุ่มกายภาพ ไม่ใช่ตัวอักษร ─────────
//
// ผู้ใช้: *"shortcut ของ planner ไม่ถูกผูกจาก os ทำให้ต้องเปลี่ยนภาษาตลอดเวลาใช้ shortcut"*
// แป้นไทย: Ctrl+Z ได้ `e.key === 'ผ'` — เทียบกับ 'z' ไม่มีวันตรง
{
  const ia9 = fs.readFileSync(path.join(ROOT, 'src/planner/planner-interact.js'), 'utf8');
  const body9 = ia9.slice(ia9.indexOf('_onKeyDown('), ia9.indexOf('_onKeyUp('));
  const bad9 = [...body9.matchAll(/\bk\s*===\s*'([a-z0-9=+-])'/g)].map((m) => m[1]);
  ck('★★ [152] คีย์ลัดกระดานไม่เทียบกับ e.key อีกแล้ว (แป้นไทยก็ใช้ได้)',
     bad9.length === 0, bad9.join(','));
  ck('[152] ชุด Ctrl ของกระดานอ่านจาก e.code',
     /c === 'KeyZ'/.test(body9) && /c === 'KeyS'/.test(body9));
}

console.log(`\nui-audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
