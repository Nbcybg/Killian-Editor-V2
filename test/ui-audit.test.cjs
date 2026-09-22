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
    // [alpha.159 · M19] แท็บกับแผงสร้างช่องจาก buildScratch() ตัวเดียวแล้ว (เดิมคัดลอกสองก้อน)
    // — จุดเดียวครอบทั้งสองทาง · ตรวจข้างล่างว่าทั้งสองทางยังเรียกตัวสร้างนั้นจริง
    ['src/scratchpad.js', 'ui.notes.scratchPh', 1],
    ['src/session-notes.js', 'ui.notes.quickNotePh', 1],
    ['src/wiki.js', 'ui.wiki.secTitlePh', 1],
  ];
  for (const [rel, key, n] of need) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const got = (src.match(new RegExp(key.replace(/\./g, '\\.'), 'g')) || []).length;
    ck('ช่องกรอกใน ' + rel + ' ยังมี placeholder (' + key + ')', got >= n, got + '/' + n);
  }
  {
    const sp = fs.readFileSync(path.join(ROOT, 'src/scratchpad.js'), 'utf8');
    const body = (name) => { const i = sp.indexOf('function ' + name); return i < 0 ? '' : sp.slice(i, sp.indexOf('\n}\n', i)); };
    ck('[159-M19] แท็บและแผงสมุดโน้ตด่วนสร้างช่องผ่าน buildScratch() (มี placeholder ทั้งคู่)',
       /buildScratch\(\)/.test(body('openScratchpad')) && /buildScratch\(\)/.test(body('renderNotesPanel')));
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
    const testFrom = rel === 'src/selftest.js' ? 1 : rel === 'src/app.js'
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
    const testFrom = rel === 'src/selftest.js' ? 1 : rel === 'src/app.js'
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
  const { NOT_ICON, ICON_RANGE_SRC, isCharTable } = require('../tools/icon-lexicon.cjs');
  const ico = buildCommandsData(ROOT);
  const KNOWN = new Set([...Object.keys(ico.ICON_SVG), ...Object.keys(ico.ICON_GLYPH)]);

  // ── อะไรนับเป็น "ไอคอน" ──
  // นับ: พิกโตแกรม · รูปทรงเรขาคณิต (▲ ● ▾) · เครื่องหมายถูก/กากบาท
  // ไม่นับ: ลูกศร (U+2190–21FF) และเส้นตีตาราง (U+2500–257F) — สองชุดนี้ถูกใช้เป็น
  //        **เครื่องหมายวรรคตอนในประโยค** ("ตั้งค่า → ผู้ให้บริการ") กับผังต้นไม้ในเอกสาร
  //        ฟ้องเมื่อไหร่ก็ได้แต่เสียงรบกวน ไม่ได้ช่วยให้ใครเปลี่ยนไอคอนได้
  // [alpha.159 · M36] + U+1F100–1F2FF (ตัวอักษรในกรอบ เช่น 🅣) — เดิมหลุดตาข่าย ทำให้ '🅣' ฝังในโค้ดได้
  // [alpha.162 · W6 ข้อ 1] ช่วงอักขระมาจาก icon-lexicon ที่เดียว (ตัวเดียวกับ icon-extract) และครอบกว่าเดิม:
  // × ⧉ ¶ ⋯ − ＋ ⤓ ⤢ ⤷ ⟲ ⊡ § ∅ ⊞ ⠿ ≠ ⦿ ⟳ เคยหลุดด่านนี้ 70 จุด
  const ICON = new RegExp('[' + ICON_RANGE_SRC + ']', 'u');
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
      if (isCharTable(v)) continue;           // จานแทรกอักขระพิเศษ (ข้อมูลให้ผู้ใช้เลือก ไม่ใช่ไอคอน)
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

// ───────── [alpha.159 · M24] เมนู มุมมอง → แผง (main.js) ห้ามฝังป้าย/อีโมจิ ─────────
{
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const a = main.indexOf('const MENU_PANELS = ['), b = main.indexOf('];', a);
  const block = a >= 0 && b > a ? main.slice(a, b) : '';
  const lits = [...block.matchAll(/label:\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
  ck('[159-M24] ★ MENU_PANELS: ป้ายทุกตัวมาจากไฟล์ภาษา (ไม่มีสตริงฝัง/อีโมจิ)', !!block && lits.length === 0, lits.join(' | '));
}

// ───────── [alpha.162 · W1] ★ การเขียนไฟล์ที่ "ยิงแล้วไปต่อ" ต้องไม่เงียบเมื่อล้ม ─────────
//
// สวิตช์ตั้งค่าเรียก `saveProjectMeta()` โดยไม่ await (ถูกแล้ว ไม่ควรหน่วง UI) แต่เมื่อเขียนล้ม
// กลายเป็น unhandled rejection: บนจอสวิตช์ติด ค่าไม่เคยลงไฟล์ เปิดใหม่แล้วกลับไปเหมือนเดิมเงียบ ๆ
// → ทางยิงทิ้งทั้งหมดต้องผ่าน `saveProjectMetaSoon()` ซึ่งรายงานที่แถบสถานะ + ไฟล์บันทึก
{
  const app162 = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const bad162 = app162.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /(^|[^.\w])saveProjectMeta\(\)/.test(l)
      && !/await saveProjectMeta|saveProjectMeta\(\)\.catch|export async function saveProjectMeta/.test(l)
      && !/^\s*(\/\/|\*)/.test(l))
    .map(([i]) => i);
  ck('★★ [162-W1-7] app.js: ไม่มี saveProjectMeta() แบบยิงทิ้งที่กลืน error (ใช้ saveProjectMetaSoon)',
     bad162.length === 0, 'บรรทัด ' + bad162.join(','));
  ck('[162-W1-7] มี saveProjectMetaSoon() ใช้งานจริง',
     (app162.match(/saveProjectMetaSoon\(\)/g) || []).length >= 10);
  // ชื่อปลายทางในถังขยะต้องมาจาก trash-path.js ทางเดียว (ลบรวดเดียวหลายชิ้นแล้วชื่อชนกัน = ของหายถาวร)
  const srcAll = ['src/app.js', 'src/recycle.js', 'src/scene-ops.js', 'src/ai/ai-actions.js']
    .map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
  const homemade = srcAll.filter(([, s]) => /'Recycle',\s*Date\.now\(\)/.test(s)).map(([f]) => f);
  ck('★★ [162-W1-4] ไม่มีใครประกอบชื่อในถังขยะเอง (ต้องผ่าน trashPathFor)',
     homemade.length === 0, homemade.join(','));
  ck('[162-W1-4] ทุกทางลบ import trashPathFor',
     srcAll.every(([, s]) => /trashPathFor/.test(s)));
}

// ───────── [alpha.162 · W2] ★ ระบบแผง: ของกลางชุดเดียว · ไม่มีรายชื่อซ้ำ · ไม่มีคลาสตาย ─────────
{
  const pu = fs.readFileSync(path.join(ROOT, 'src/panels/panel-ui.js'), 'utf8');
  const defsBlock = pu.slice(pu.indexOf('export const PANEL_DEFS = ['), pu.indexOf('export const TEAROFF_PANELS'));
  const defLines = defsBlock.split('\n').filter((l) => /^\s*\{ id: '/.test(l));
  ck('[162-W2] อ่านตาราง PANEL_DEFS ได้ครบ', defLines.length >= 30, defLines.length);
  // ทุกแผงต้องมีคีย์ภาษา — ไม่มีช่อง `title` ให้ฝังข้อความอีกแล้ว (กฎ .147/.154 + ค้างภาษาของ .161)
  const noI18n = defLines.filter((l) => !/\bi18n: '/.test(l)).map((l) => (l.match(/id: '([^']+)'/) || [])[1]);
  ck('★★ [162-W2] ทุกแผงมีคีย์ชื่อ (i18n) ครบ', noI18n.length === 0, noI18n.join(','));
  const hasTitle = defLines.filter((l) => /\btitle:/.test(l)).map((l) => (l.match(/id: '([^']+)'/) || [])[1]);
  ck('★★ [162-W2] ไม่มีช่อง title (ข้อความ) ในทะเบียนแผงอีกแล้ว', hasTitle.length === 0, hasTitle.join(','));
  ck('★ [162-W2] TEAROFF_PANELS สร้างจาก PANEL_DEFS ไม่ใช่รายชื่อชุดที่สอง',
     /TEAROFF_PANELS = new Set\(PANEL_DEFS\.filter/.test(pu));
  ck('[162-W2] titleOf อ่านคีย์ภาษาตรง ๆ (ไม่มีค่าสำรองที่ทำให้คีย์ผิดไม่ถูกจับ)',
     /function titleOf\(d\) \{ return t\(d\.i18n\); \}/.test(pu));

  // ปุ่มบนหัวแผงต้องมาจาก makePanelButton ตัวเดียว (กฎถาวร alpha.161 · U2)
  const srcFiles = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(dir, f.name));
      else if (f.name.endsWith('.js') && f.name !== 'selftest.js') srcFiles.push(path.join(dir, f.name));
    }
  })(path.join(ROOT, 'src'));
  const noCmt = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const handmade = srcFiles.filter((f) => !/panel-renderer\.js$/.test(f))
    .filter((f) => /el\(\s*'span'\s*,\s*'k-panel-btn/.test(noCmt(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.basename(f));
  ck('★★ [162-W2] ไม่มีใครประกอบปุ่มหัวแผงเอง (ต้องใช้ makePanelButton)',
     handmade.length === 0, handmade.join(','));

  // ปุ่มสวิตช์แผงบนแถบ: ห้ามมีรายชื่อเขียนมืออีกชุด
  const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  ck('★★ [162-W2] ไม่มีตาราง TB_PANEL_BUTTONS (ปุ่มบอกตัวเองด้วย data-command/data-panel)',
     !/const TB_PANEL_BUTTONS/.test(app));
  // นับเฉพาะโค้ดจริง และไม่นับลูปกลางที่เดินจากทะเบียนคำสั่ง (ตัวมันเองใช้ `b.classList`)
  const handToggles = (noCmt(app).match(/\$\('#[a-z-]+'\)\??\.classList\.toggle\('on', isPanelOpen\(/g) || []).length;
  ck('★★ [162-W2] ไม่มีบรรทัดติดไฟปุ่มแผงที่เขียนมือทีละตัว', handToggles === 0, handToggles);
  ck('[162-W2] ตัวติดไฟเดินจากทะเบียนคำสั่ง', /data-command\^="toggle-panel:"\], \[data-panel\]/.test(app));

  // ของตายใน CSS
  const css = fs.readFileSync(path.join(ROOT, 'renderer/style.css'), 'utf8');
  const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const dead of ['.k-panel-float', '.k-panel-floating', '.k-panel-off', '.k-panel-minimized', '.k-min-tray']) {
    ck('★ [162-W2] ไม่มีกฎของระบบแผงยุคเก่าใน CSS: ' + dead, !cssRules.includes(dead + ' ') && !cssRules.includes(dead + ',') && !cssRules.includes(dead + '{'));
  }
  ck('★★ [162-W2] ไม่มีกฎ :has(#…-body) แล้ว (ใช้ธง flush → .k-panel-flush)',
     !/:has\(#[a-z-]+-body\)/.test(cssRules));
  ck('[162-W2] มีกฎ .k-panel-flush จริง', /\.k-panel-body\.k-panel-flush/.test(cssRules));
  for (const gone of ['#tree-head', '#props-head', '#outline-head', '#home-panel', '#home-body']) {
    ck('★ [162-W2] element ที่ตายแล้วถูกถอดออกจาก index.html และ CSS: ' + gone,
       !fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8').includes('id="' + gone.slice(1) + '"')
       && !cssRules.includes(gone + ' ') && !cssRules.includes(gone + ',') && !cssRules.includes(gone + '{'));
  }
  // หัวข้อในแผงต้องอ้างสเกลกลาง ไม่ใช่ px ของตัวเอง
  const titleRules = ['.dash-title', '.books-title', '.tl-title', '.map-title', '.branch-title',
                      '.floor-title', '.player-title', '.kb-title', '.planner-props-head'];
  const offScale = titleRules.filter((sel) => {
    const m = new RegExp('\\' + sel + ' \\{([^}]*)\\}').exec(css);
    return !m || !/var\(--pan-title-fs\)/.test(m[1]);
  });
  ck('★★ [162-W2] หัวข้อในแผงทุกคลาสใช้สเกลกลาง --pan-title-fs', offScale.length === 0, offScale.join(','));

  // ข้อยกเว้นของเมนูต้องชี้แผงที่มีอยู่จริง
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const skipBlock = main.slice(main.indexOf('const MENU_PANELS_SKIP = {'), main.indexOf('ipcMain.handle(\'menu:panelIds\''));
  const skipIds = [...skipBlock.matchAll(/^\s*'?([a-z-]+)'?:/gm)].map((m) => m[1]).filter((x) => x !== 'const');
  const defIds = new Set(defLines.map((l) => (l.match(/id: '([^']+)'/) || [])[1]));
  const ghostSkip = skipIds.filter((id) => !defIds.has(id));
  ck('★★ [162-W2] ข้อยกเว้นของเมนูแผงชี้แผงที่มีอยู่จริงทุกตัว', ghostSkip.length === 0, ghostSkip.join(','));
  // ลำดับของ "เมนู มุมมอง → แผง" กับทะเบียนแผงต้องเป็นเรื่องเดียวกัน — เมนูคือลำดับที่ผู้ใช้เห็น
  // (จัด 4 หมวดตั้งแต่ .161) ทะเบียนจึงต้องเรียงตามนั้น ไม่ใช่เรียงตามลำดับที่ใครเพิ่มแผงเข้ามา
  const menuBlock = main.slice(main.indexOf('const MENU_PANELS = ['), main.indexOf('/** แผงที่จงใจไม่ใส่ในเมนูนี้'));
  const menuIds = [...menuBlock.matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);
  const defOrder = defLines.map((l) => (l.match(/id: '([^']+)'/) || [])[1]).filter((id) => menuIds.includes(id));
  ck('★★ [162-W2] ลำดับแผงในเมนูกับในทะเบียนตรงกันทั้งแถว',
     menuIds.length > 25 && JSON.stringify(defOrder) === JSON.stringify(menuIds),
     defOrder.filter((id, i) => id !== menuIds[i]).join(','));
}

// ───────── [alpha.162 · W4] มาตรฐานไดอะล็อก · คีย์ลัด · Explorer · แท็บ · Home ─────────
{
  const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const noCmt = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const ui = noCmt(rd('src/ui.js'));
  const app = noCmt(rd('src/app.js'));
  // ข้อ 9 — ตัวยกระดับกล่องกลาง
  ck('★★ [162-W4] ui.js มี installDialogA11y (role/aria-modal/โฟกัส/Tab วน/Esc/Enter ที่เดียว)',
     /export function installDialogA11y\(/.test(ui) && /setAttribute\('role', 'dialog'\)/.test(ui)
     && /setAttribute\('aria-modal', 'true'\)/.test(ui));
  ck('★★ [162-W4] app.js ติดตั้งตัวยกระดับกล่องตอนเปิดโปรแกรม', /installDialogA11y\(\)/.test(app));
  ck('★ [162-W4] Esc ของตัวกลางไม่ลบกล่องเอง (กดปุ่มยกเลิก/คลิกฉากหลังที่กล่องประกาศไว้)',
     /\.k-cancel:not\(\[disabled\]\)/.test(ui) && /ov\.click\(\)/.test(ui));
  ck('★★ [162-W4] กล่องบันทึกทั้งหมด: ปุ่มหลักขวาสุด', /btns\.append\(bCancel, bDiscard, bSave\)/.test(ui));
  ck('★★ [162-W4] ปุ่ม "ไม่บันทึก" ไม่ติด k-ok (`.k-ok` ตัวแรก = ทางหลักเสมอ)',
     /bDiscard\.className = 'k-danger k-discard'/.test(ui) && !/bDiscard\.className = '[^']*k-ok/.test(ui));
  ck('★★ [162-W4] ปุ่มอันตรายไม่เคยเป็นโฟกัสเริ่มต้น/ปุ่ม Enter ของตัวกลาง',
     (ui.match(/\.k-ok:not\(\[disabled\]\):not\(\.k-danger\)/g) || []).length >= 2);
  ck('★ [162-W4] กล่องสถานะ: ปุ่มหลักขวาสุด', /btns\.append\(outB, inB, closeB, addB\)/.test(noCmt(rd('src/custom-status.js'))));
  ck('★ [162-W4] กล่องป้ายภาพ: ปุ่มหลักขวาสุด', /btns\.append\(closeB, addB\)/.test(noCmt(rd('src/visual-tags.js'))));
  // กล่องที่ไม่มีทั้งปุ่ม .k-cancel และคลิกฉากหลัง = Esc ไปไม่ถึง (starter 4 กล่องเคยเป็นแบบนี้)
  for (const f of ['src/starter/starter-bridge.js', 'src/starter/starter-export.js',
                   'src/starter/starter-scenario.js', 'src/starter/starter-wiki.js']) {
    ck('★ [162-W4] ปุ่มยกเลิกของกล่องมีคลาส k-cancel (Esc เดินได้): ' + path.basename(f),
       !/el\('button', null, t\('ui\.common\.cancel'\)\)/.test(noCmt(rd(f))));
  }
  // ข้อ 5 — เอกสารบทเป็นเจ้าของคีย์วนธาตุ
  ck('★★ [162-W4] onShortcut ถามเอกสารบทก่อนยิง next-tab/prev-tab', /if \(spOwnsKey\(e, ch\)\) return;/.test(app));
  // ข้อ 10 — แถวใน Explorer ผูกเมนูผ่านตัวกลางเท่านั้น
  const handTreeMenu = (app.match(/\.oncontextmenu = \(e\) => showTreeMenu\(/g) || []).length;
  ck('★★ [162-W4] ไม่มีแถวไหนผูกเมนู Explorer เอง (ต้องผ่าน bindTreeMenu → F2/คัดลอกที่อยู่ใช้ได้)',
     handTreeMenu === 0, handTreeMenu);
  ck('★ [162-W4] F2 ของแถวที่ไม่ใช่ฉาก = รายการเปลี่ยนชื่อของเมนูแถวนั้น', /treeRowAction\(row, 'rename'\)/.test(app));
  // ข้อ 12 + บั๊กที่เจอระหว่างทาง
  const dlg = noCmt(rd('src/dialogs.js'));
  ck('★★ [162-W4] กล่องตั้งค่าเปิดได้แม้ยังไม่มีโปรเจกต์ (ไม่ปฏิเสธทั้งกล่อง)',
     !/if \(!state\.root\) \{ infoBox\(t\('errors\.openProjectFirst'\)\); return; \}\s*\n\s*const s = state\.settings/.test(dlg)
     && /const projOK = !!state\.root;/.test(dlg));
  ck('★★ [162-W4] บันทึกค่าผู้ใช้จากกล่องตั้งค่า = ผ่าน mergeGlobalSettings (อ่าน-รวม-เขียน · ไม่ทับค่าที่อยู่นอกตาราง)',
     /await mergeGlobalSettings\(globals\)/.test(dlg) && !/kapi\.writeGlobalSettings\(/.test(dlg));
  // ไฟล์ตั้งค่าผู้ใช้เขียนได้ทางเดียว = คิวใน mergeGlobalSettings (ต่างคนต่างอ่าน-เขียน = ค่าของอีกคนหาย)
  const wgApp = (app.match(/kapi\.writeGlobalSettings\(/g) || []).length;
  ck('★★ [162-W4] app.js เขียนไฟล์ตั้งค่าผู้ใช้ที่เดียว (ในคิวของ mergeGlobalSettings)', wgApp === 1, wgApp);
  const sgs = app.slice(app.indexOf('export async function saveGlobalSetting('));
  const sgsBody = sgs.slice(0, sgs.indexOf('\n}'));
  ck('★★ [162-W4] saveGlobalSetting ตั้งค่าในหน่วยความจำก่อนรอ IO (ตัวที่ช้ากว่าไม่ทับค่าใหม่)',
     sgsBody.indexOf('state.settings[key] = value') > -1
     && sgsBody.indexOf('state.settings[key] = value') < sgsBody.indexOf('await'));
  ck('★ [162-W4] ไม่มีใครเขียนไฟล์ตั้งค่าผู้ใช้ด้วยก้อนคีย์เดียว (writeGlobalSettings({ …)',
     // ก้อนที่รวมของเดิม `{ ...g, ...patch }` ใช้ได้ · ห้ามก้อนที่เริ่มด้วยคีย์ตรง ๆ (`{ language }`)
     !/writeGlobalSettings\(\{\s*[A-Za-z_]/.test(dlg) && !/writeGlobalSettings\(\{\s*[A-Za-z_]/.test(app));
  const home = noCmt(rd('src/home-ui.js'));
  ck('★ [162-W4] หน้า Home มีปุ่มตั้งค่า + ภาษา', /home-btn-settings/.test(home) && /settingsDialog\('lang'\)/.test(home));
  ck('★ [162-W4] โปรเจกต์ใหม่ถามแบบก่อน (มีตัวเลือกโปรเจกต์ว่าง)', /showTemplateDialog\(\{ allowBlank: true \}\)/.test(app));
  // ข้อ 11 — ปุ่มแท็บทั้งหมดต้องไม่ใช่ .tab (โค้ด/เทสทั้งหมดนับ #tabs > .tab)
  ck('★ [162-W4] ปุ่ม "แท็บทั้งหมด" ไม่ใช้คลาส tab', /el\('span', 'k-tabs-more'/.test(app));
  ck('[162-W4] แถว "+ ฉาก" ท้ายบทไม่ใช้คลาส scene', /el\('div', 'add-row k-add-scene-row'/.test(app));
}

// ───────── [alpha.162 · W5] สถานะ/toast · งานยาวยกเลิกได้ · a11y · แถบเครื่องมือ · แถบเป้า ─────────
{
  const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const noCmt = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const core = noCmt(rd('src/core.js'));
  const ui = noCmt(rd('src/ui.js'));
  const app = noCmt(rd('src/app.js'));
  // ข้อ 1
  ck('★★ [162-W5] setStatus มีอายุ (ผ่าน putStatus + ตัวจับเวลา) · error ค้าง (ttl 0)',
     /export function setStatus\(s\) \{ putStatus\(s, 'info', STATUS_TTL_MS\); \}/.test(core)
     && /export function setStatusError\(s\) \{ putStatus\(s, 'error', 0\); \}/.test(core));
  ck('★ [162-W5] แถบสถานะเป็น live region (role=status · aria-live=polite)',
     /st\.setAttribute\('role', 'status'\)/.test(core) && /st\.setAttribute\('aria-live', 'polite'\)/.test(core));
  ck('★ [162-W5] ตัวจับเวลาหมดอายุผูกกับเลขลำดับ (ตัวเก่าไม่ลบข้อความใหม่)', /if \(my !== _st\.seq\) return false;/.test(core));
  ck('★★ [162-W5] ข้อความผิดพลาด (errText/failText) ขึ้นแบบค้างทุกจุด — ไม่หายไปก่อนผู้ใช้เห็น',
     (() => {
       const bad = [];
       for (const f of ['src/app.js', 'src/dialogs.js', 'src/dialogue/dialogue-ui.js', 'src/export-hub.js', 'src/export-zip.js']) {
         for (const l of noCmt(rd(f)).split('\n')) if (/\bsetStatus\(/.test(l) && /(errText|failText)\(/.test(l)) bad.push(f + ': ' + l.trim().slice(0, 60));
       }
       return bad.length === 0 ? true : (console.log('    ' + bad.join('\n    ')), false);
     })());
  ck('★ [162-W5] toast ของงานเบื้องหลัง: สำรองอัตโนมัติสำเร็จ/ล้มต้องบอก', /else toast\(tf\('ui\.backup\.projectDoneFile'/.test(noCmt(rd('src/backup.js')))
     && /else toast\(t\('ui\.backup\.projectFail'\), \{ level: 'error' \}\)/.test(noCmt(rd('src/backup.js'))));
  ck('[162-W5] toast ปุ่มปิดใช้ไอคอนจากทะเบียน (ไม่ฮาร์ดโค้ด ×)', /k-toast-x'; x\.textContent = gi\('close'\)/.test(ui));
  // ข้อ 2
  ck('★★ [162-W5] งานยาวทั้งสี่ใช้ withBusyTask (ยกเลิกได้ + ความคืบหน้า)',
     /withBusyTask\(t\('ui\.search\.busyIndex'\)/.test(noCmt(rd('src/global-search.js')))
     && /withBusyTask\(busyMsg/.test(noCmt(rd('src/pdf-ui.js')))
     && (noCmt(rd('src/export-zip.js')).match(/withBusyTask\(/g) || []).length >= 2
     && /withBusyTask\(t\('ui\.doctor\.scanning'\)/.test(noCmt(rd('src/project-doctor-ui.js'))));
  ck('★ [162-W5] ยกเลิก ≠ พัง: ทุกทางแยกด้วย isCancelled (ไม่ log error · ไม่บอกว่า "ไม่เจอผล")',
     ['src/global-search.js', 'src/pdf-ui.js', 'src/export-zip.js', 'src/project-doctor-ui.js']
       .every((f) => /isCancelled\(e\)/.test(noCmt(rd(f)))));
  ck('[162-W5] export-zip ไม่ต่อ e.message ดิบขึ้นจออีก', !/\+ e\.message/.test(noCmt(rd('src/export-zip.js'))));
  // [alpha.162 · W5] กวาดทั้งโปรแกรม (W4-7 แก้แค่จุดที่ระบุ · เจออีก 36 จุด) — ข้อความ OS ดิบห้ามขึ้นแถบสถานะแบบ info
  // ข้อยกเว้นเดียว: error ที่ข้อความแปลแล้วโดยตั้งใจ (`k2Unsaved` ของ alpha.161 · D5)
  {
    const walkS = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'generated') walkS(q, o); } else if (e.name.endsWith('.js') && e.name !== 'selftest.js') o.push(q);
    } return o; };
    const raw = [];
    for (const f of walkS(path.join(ROOT, 'src'))) {
      noCmt(fs.readFileSync(f, 'utf8')).split('\n').forEach((l) => {
        if (/\bsetStatus\(/.test(l) && /\b(e|err)\.message\b/.test(l) && !/k2Unsaved/.test(l)) raw.push(path.relative(ROOT, f) + ': ' + l.trim().slice(0, 70));
      });
    }
    ck('★★ [162-W5] ไม่มีข้อความผิดพลาดดิบ (e.message) ขึ้นแถบสถานะแบบข้อความทั่วไปที่ไหนเลย', raw.length === 0, raw.slice(0, 3).join(' | '));
  }
  ck('★ [162-W5] ลูปวาดหน้า PDF พักได้ (ไม่ใช่ forEach ซิงก์ทั้งก้อน)',
     !/paged\.pages\.forEach\(/.test(noCmt(rd('src/pdf-generator.js'))) && /throwIfCancelled\(args\.signal\)/.test(rd('src/pdf-generator.js')));
  // ข้อ 3
  // [alpha.162 · W7] ตัวตั้งค่าย้ายไป locale.js `applyDocLang` (lang + dir · ตั้งหลังโหลดเสร็จ รวมกรณีตกไปใช้ en)
  ck('★ [162-W5] <html lang> ตามภาษาที่โหลด', /applyDocLang\(i18n\.lang\)/.test(core)
     && /de\.lang = lang;/.test(rd('src/locale.js')) && /de\.dir = langDir\(lang\);/.test(rd('src/locale.js')));
  const pr = noCmt(rd('src/panels/panel-renderer.js'));
  ck('★★ [162-W5] แถบแท็บกลุ่มแผงทั้งแบบผนึกและแบบลอยเป็น tablist (คีย์บอร์ดเข้าถึงได้)',
     (pr.match(/a11yTabBar\(bar, t\('ui\.panelRenderer\.tabsLabel'\)\)/g) || []).length === 2);
  ck('★★ [162-W5] เมนูคลิกขวามี role=menu/menuitem + ตัวดักคีย์บอร์ด', /m\.setAttribute\('role', 'menu'\)/.test(ui)
     && /d\.setAttribute\('role', it\.checked !== undefined \? 'menuitemcheckbox' : 'menuitem'\)/.test(ui)
     && /document\.addEventListener\('keydown', onMenuKey, true\)/.test(ui)
     && /document\.removeEventListener\('keydown', onMenuKey, true\)/.test(ui));
  ck('★ [162-W5] Esc ของกล่องหลีกให้เมนูที่เปิดทับอยู่', /if \(liveMenu\(\)\) return;/.test(ui));
  // เมนูที่ถูกถอดด้วยทางอื่นต้องนับว่าปิดแล้วทุกจุดที่ถาม (ตัวดักคีย์ · menuOpen · คลิกนอก) — ห้ามเช็ค curMenu ดิบ
  ck('★★ [162-W5] ทุกจุดถามสถานะเมนูผ่าน liveMenu() (เมนูที่หลุดจากหน้าไม่ค้างกินคีย์)',
     /function onMenuKey\(e\) \{\s*if \(!liveMenu\(\)\) return;/.test(ui) && /export function menuOpen\(\) \{ return !!liveMenu\(\); \}/.test(ui)
     && /function onDoc\(e\) \{\s*if \(!liveMenu\(\)\) return;/.test(ui));
  ck('★ [162-W5] ปุ่มลอยใช้คีย์บอร์ดได้', /wireFabKeyboard\(fab, fabMenu\)/.test(app) && /fab\.setAttribute\('role', 'button'\)/.test(app));
  {
    const rt = ui.slice(ui.indexOf('export function rovingToolbar('));
    const rtBody = rt.slice(0, rt.indexOf('\n}'));
    ck('★★ [162-W5] rovingToolbar ไม่มีตัวเฝ้า DOM (แถบนี้เปลี่ยนคลาสทุกตัวอักษรที่พิมพ์ — เฝ้า = วัดเลย์เอาต์ทุกเฟรม)',
       !/MutationObserver/.test(rtBody) && /e\.key === 'Tab'\) settle\(\)/.test(rtBody));
  }
  ck('★ [162-W5] แถบเครื่องมือหลักเป็น roving toolbar', /rovingToolbar\(\$\('#toolbar'\)\)/.test(app) && /bar\.setAttribute\('role', 'toolbar'\)/.test(ui)
     && /id="toolbar" data-i18n-attr="aria-label"/.test(fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8')));
  // ข้อ 4
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  ck('★ [162-W5] มีปุ่มเมนู AI + ปุ่มตั้งค่าบนแถบ', /id="tb-ai-group"[^>]*data-command="ai-menu"/.test(html) && /id="tb-settings"[^>]*data-command="settings"/.test(html));
  ck('★ [162-W5] เมนู AI ประกอบจากปุ่มจริง (กด = click ปุ่มนั้น) ไม่ใช่รายการเขียนซ้ำ',
     /for \(const id of AI_GROUP_IDS\)/.test(app) && /click: \(\) => b\.click\(\)/.test(app));
  // ข้อ 5
  const upb = app.slice(app.indexOf('export function updateProgressBar()'));
  const upbBody = upb.slice(0, upb.indexOf('\n}'));
  ck('★★ [162-W5] แถบเป้ารายวัน = คำที่เขียนวันนี้ (ประวัติ) ไม่ใช่ยอดรวมของแท็บที่เปิด',
     /wordsWrittenToday\(getWordHistory\(\)\)/.test(upbBody) && !/state\.tabs/.test(upbBody) && !/countWords\(/.test(upbBody));
}

// ───────── [alpha.162 · W6] ของฮาร์ดโค้ด: ไอคอน · สี · ข้อความ · ค่าคงที่ ─────────
{
  const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const noCmt = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const { ICON_RANGE_SRC, isCharTable, NOT_ICON } = require('../tools/icon-lexicon.cjs');
  const ICONW6 = new RegExp('[' + ICON_RANGE_SRC + ']', 'u');
  // ข้อ 1 — ตาข่ายครอบตัวที่เคยหลุด
  const escaped = ['×', '⧉', '¶', '⋯', '−', '＋', '⤓', '⤢', '⤷', '⟲', '⊡', '§', '∅', '⊞', '⠿', '≠', '⦿', '⟳', '⤾', '«', '»'];
  const miss = escaped.filter((c) => !ICONW6.test(c));
  ck('★★ [162-W6] ช่วงไอคอนครอบตัวที่เคยหลุดด่านครบ (× ⧉ ¶ ⋯ − ＋ ⤓ ⤢ ⤷ ⟲ ⊡ § …)', miss.length === 0, miss.join(' '));
  ck('[162-W6] วรรคตอน/หน่วยที่อยู่ในช่วงใหม่ถูกประกาศว่าไม่ใช่ไอคอน พร้อมเหตุผล',
     ['·', '°', '«', '»'].every((c) => typeof NOT_ICON[c] === 'string' && NOT_ICON[c].length > 10));
  ck('[162-W6] ตารางแทรกอักขระพิเศษ = ข้อมูล (ไม่ใช่ไอคอน) · ข้อความธรรมดาไม่ถูกนับเป็นตาราง',
     isCharTable('ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ') && !isCharTable('× ปิด') && !isCharTable('ABC'));
  ck('[162-W6] ตัวยกไอคอน (icon-extract) ใช้ช่วงเดียวกับเทส', /require\('\.\/icon-lexicon\.cjs'\)[\s\S]{0,200}ICON_RANGE_SRC/.test(rd('tools/icon-extract.cjs'))
     || /ICON_RANGE_SRC[^\n]*require\('\.\/icon-lexicon\.cjs'\)/.test(rd('tools/icon-extract.cjs')));
  // ข้อ 2 — สีในไฟล์ที่วาดเอง (canvas/SVG) ต้องมาจากธีมหรือ palette.js
  const hexIn = (f) => {
    const src = noCmt(rd(f)).replace(/themeColor\('--[\w-]+',\s*'#[0-9a-fA-F]{3,8}'\)/g, '')
      .replace(/\/\^#\[0-9a-f\]\{6\}\$\/i/g, '');
    return (src.match(/['"`]#[0-9a-fA-F]{3,8}['"`]|[:(\s]#[0-9a-fA-F]{6}\b/g) || []);
  };
  for (const f of ['src/planner/planner-render.js', 'src/planner/planner-ui.js', 'src/planner/planner-props.js',
                   'src/maps-ui.js', 'src/dashboard.js', 'src/kanban/kanban-ui.js', 'src/branching-ui.js']) {
    const h = hexIn(f);
    ck('★★ [162-W6] ไม่มีเลขสีตายตัวใน ' + f + ' (สีเปลือก = themeColor · สีความหมาย = palette.js)', h.length === 0, h.slice(0, 4).join(' '));
  }
  ck('★ [162-W6] จานสีโหนดของกระดานมีชุดเดียว (planner-props ไม่ซ้ำเอง)',
     !/\['#3f3e3a', '#5f7a9f'/.test(noCmt(rd('src/planner/planner-props.js'))) && !/\['#3f3e3a', '#5f7a9f'/.test(noCmt(rd('src/planner/planner-ui.js'))));
  ck('★ [162-W6] เปลี่ยนธีมแล้วล้างแคชสีของผืนวาด', /clearThemeColorCache\(\);/.test(noCmt(rd('src/app.js'))));
  // ข้อ 3 — ตัวถ่วง: เลข hex ใน style.css ห้ามเพิ่ม (263 → 214 รอบนี้ · ลดได้ ห้ามเพิ่ม)
  {
    const css = rd('renderer/style.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g, '');
    const n = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
    ck('★★ [162-W6] เลข hex ใน style.css ไม่เพิ่มจากรอบนี้ (≤ 214 · ของใหม่ใช้ตัวแปร)', n <= 214, n);
    ck('[162-W6] สีความหมายที่ย้ายออกมามีตัวแปรจริงใน base.css',
       ['--st-warn', '--st-danger', '--st-danger-alt', '--brand-navy'].every((v) => rd('renderer/themes/base.css').includes(v + ':')));
    ck('★ [162-W6] ไม่ชนตัวแปร --danger เดิมของแถบลอย (#8a3b3b)', !/--danger:/.test(rd('renderer/themes/base.css')));
  }
  // ข้อ 4 — ข้อความอังกฤษที่โชว์
  ck('★ [162-W6] ไม่มีข้อความอังกฤษตายตัวที่โชว์ (" tokens" · " px" · "Untitled")',
     !/' tokens'/.test(rd('src/ai/ai-chat-panel.js')) && !/ px`/.test(rd('src/gallery.js')) && !/\|\| 'Untitled'/.test(rd('src/export-ebook.js')));
  // ข้อ 5 — เทียบกับข้อความที่แปลแล้ว
  {
    const bad5 = [];
    const walk5 = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'generated') walk5(q); } else if (e.name.endsWith('.js') && e.name !== 'selftest.js') {
        noCmt(fs.readFileSync(q, 'utf8')).split('\n').forEach((l, i) => {
          if (/[!=]==?\s*t{1,2}f?\(\s*'ui\.|t{1,2}f?\('ui\.[^']+'\)\s*[!=]==?/.test(l)) bad5.push(path.relative(ROOT, q) + ':' + (i + 1));
        });
      }
    } };
    walk5(path.join(ROOT, 'src'));
    ck('★★ [162-W6] ไม่มีเงื่อนไขที่เทียบกับข้อความที่แปลแล้ว (=== t(…)) ทั้งโปรแกรม', bad5.length === 0, bad5.join(' '));
    ck('[162-W6] ตัวตรวจผู้ให้บริการ AI คืนปัญหาแบบมีรหัส (UI กรองด้วย code)',
       /export function validateProviderIssues\(/.test(rd('src/ai/ai-providers.js')) && /e\.code !== 'name'/.test(rd('src/ai/ai-provider-ui.js')));
  }
  // ข้อ 6 — คีย์ที่ประกอบตอนรันต้องมีจริง · ไม่มีค่าสำรองส่งเข้า t()
  {
    const { lexCsv: lex6 } = require('../tools/csv-lite.cjs');
    const tbl = { th: lex6(rd('languages/k2_th.csv')), en: lex6(rd('languages/k2_en.csv')) };
    const has = (k) => ['th', 'en'].every((l) => tbl[l][k] != null || tbl[l]['ui.' + k] != null);
    for (const [f, prefix] of [['src/branching-ui.js', 'branch.'], ['src/player-mode.js', 'player.']]) {
      const src = rd(f);
      ck('★ [162-W6] ' + path.basename(f) + ': tr() ไม่รับค่าสำรอง', new RegExp("const tr = \\(key\\) => t\\('" + prefix.replace('.', '\\.') + "' \\+ key\\);").test(src)
         && !/\btr\('[^']+',/.test(src));
      const keys = [...new Set([...src.matchAll(/\btr\('([A-Za-z0-9_]+)'\)/g)].map((m) => prefix + m[1]))];
      const missing = keys.filter((k) => !has(k));
      ck('★★ [162-W6] ' + path.basename(f) + ': คีย์ที่ประกอบตอนรัน (' + keys.length + ') มีจริงในไฟล์ภาษาทุกไฟล์',
         keys.length > 10 && missing.length === 0, missing.slice(0, 5).join(' '));
    }
  }
  // ข้อ 7 — ค่าคงที่เวลา + สูตรถอยรอ
  {
    const walk7 = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'generated') walk7(q, o); } else if (e.name.endsWith('.js')) o.push(q);
    } return o; };
    const dup = walk7(path.join(ROOT, 'src')).filter((f) => !f.endsWith('timing.js') && !f.endsWith('selftest.js')
      && /Math\.min\(8000,\s*500 \* Math\.pow\(2/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.basename(f));
    ck('★★ [162-W6] สูตรถอยรอการลองใหม่มีที่เดียว (timing.retryBackoff)', dup.length === 0, dup.join(','));
    const main = rd('main.js');
    ck('★ [162-W6] main ใช้ตัวเลขเวลาชุดเดียวกับ renderer (timing.cjs)',
       /const TIMING = require\('\.\/timing\.cjs'\);/.test(main) && /TIMING\.SPLASH_MAX_MS/.test(main) && /TIMING\.UPDATE_FETCH_TIMEOUT_MS/.test(main)
       && !/finishSplash\(\), 30000\)/.test(main));
    ck('[162-W6] timing.cjs ถูกสร้างโดย build และติดไปกับตัวติดตั้ง',
       /\['src\/timing\.js', 'timing\.cjs'\]/.test(rd('build.js')) && /"timing\.cjs"/.test(rd('package.json')));
  }
  // ข้อ 8 — รายงานคีย์ที่ไม่มีใครอ้าง (ห้ามลบยกชุด · ห้ามเพิ่ม)
  {
    const r = require('../tools/i18n-unused.cjs').report();
    ck('★ [162-W6] คีย์ภาษาที่ไม่พบการอ้างเลยไม่เพิ่มจากรอบนี้ (≤ 83 · รายงาน node tools/i18n-unused.cjs)',
       Array.isArray(r.none) && r.none.length <= 83, r.none.length);
  }
}

console.log(`\nui-audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
