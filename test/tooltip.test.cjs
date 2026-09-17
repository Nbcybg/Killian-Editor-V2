// test/tooltip.test.cjs — [alpha.150] คำอธิบายใต้ชื่อปุ่ม (hover tooltip สองชั้น)
//
// ผู้ใช้: *"ตอนนี้เรายังขาดคือ hover tooltip ที่ไม่มีคำอธิบาย เช่น align left (ctrl+L) | Align your…"*
//
// สิ่งที่เทสนี้เฝ้าไว้ไม่ใช่ "กล่องสวยไหม" แต่คือกฎสามข้อที่พังเงียบได้:
//   1. ปุ่มที่ยังไม่มีคำอธิบายต้องได้ '' — **ห้ามโชว์ตัวคีย์ให้ผู้ใช้เห็น** (ข้อยกเว้นของกฎ "ไม่มี fallback")
//   2. คีย์ต้องมาจาก id ของคำสั่งตรง ๆ ไม่มีตารางแปลงชื่อ (= แหล่งความจริงที่สอง)
//   3. คำอธิบายของปุ่มบนแถบรูปแบบลอยต้องมีครบทุกตัวที่ผูกคำสั่งไว้
require('./_lang.cjs').installLang('th');
const path = require('path');
const fs = require('fs');
const out = path.join(require('os').tmpdir(), '_k2tooltip.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/tooltip.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const T = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ คีย์คำอธิบาย ═══════════
{
  check('คีย์มาจาก id ของคำสั่งตรง ๆ', T.tipKey('fmt:align:left') === 'ui.tip.fmt:align:left');
  check('ขีดกลางใน id ของคำสั่งใช้ได้', T.tipKey('editor-undo') === 'ui.tip.editor-undo');
  check('data-tip เขียนทับคำสั่งได้', T.tipKey('fmt:bold', 'ui.tip.pageView') === 'ui.tip.pageView');
  check('ไม่มีคำสั่งและไม่ระบุเอง = ไม่มีคีย์', T.tipKey('', '') === '' && T.tipKey(null) === '');
  check('คำนำหน้าคีย์เป็นค่าคงที่เดียว', T.TIP_PREFIX === 'ui.tip.');
}

// ═══════════ ข้อความ ═══════════
{
  const left = T.tipText('fmt:align:left');
  check('★ ชิดซ้ายมีคำอธิบายจริง', left.length > 20, left);
  check('★ คำอธิบายไม่ใช่ตัวคีย์ที่หลุดออกมา', !left.startsWith('ui.'), left);
  check('★ ปุ่มที่ยังไม่มีคำอธิบาย = ข้อความว่าง (ไม่โชว์คีย์)',
        T.tipText('คำสั่งที่ไม่มีอยู่จริง') === '', T.tipText('คำสั่งที่ไม่มีอยู่จริง'));
  check('ไม่มีคำสั่งเลย = ว่าง', T.tipText('') === '');
}

// ═══════════ เนื้อกล่อง ═══════════
{
  const c = T.tipContent('ชิดซ้าย (Ctrl+Shift+L)', 'fmt:align:left');
  check('★ กล่องมีสองชั้น: หัวเรื่อง + คำอธิบาย',
        c && c.head === 'ชิดซ้าย (Ctrl+Shift+L)' && c.desc.length > 20, JSON.stringify(c));
  const only = T.tipContent('ปุ่มเปล่า', 'ไม่มีคำสั่งนี้');
  check('★ ไม่มีคำอธิบาย = เหลือหัวเรื่องอย่างเดียว (พฤติกรรมเดิมไม่เปลี่ยน)',
        only && only.head === 'ปุ่มเปล่า' && only.desc === '');
  check('ไม่มีทั้งสองอย่าง = null', T.tipContent('', '') === null);
  check('หัวเรื่องถูกตัดช่องว่างหัวท้าย', T.tipContent('  ก  ', '').head === 'ก');
}

// ═══════════ ความครบของแถบรูปแบบลอย ═══════════
{
  const html = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');
  const cfgOut = path.join(require('os').tmpdir(), '_k2tbcfg_tip.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/toolbar/toolbar-config.js')],
    outfile: cfgOut, format: 'cjs', bundle: true, logLevel: 'silent' });
  const TC = require(cfgOut);

  // id ของปุ่ม → คำสั่ง/คีย์คำอธิบายที่เขียนไว้ใน index.html
  const cmdOf = {}, tipOf = {};
  for (const m of html.matchAll(/id="([\w-]+)"([^>]*)>/g)) {
    const attrs = m[2];
    const c = /data-command="([^"]+)"/.exec(attrs);
    const t = /data-tip="([^"]+)"/.exec(attrs);
    if (c) cmdOf[m[1]] = c[1];
    if (t) tipOf[m[1]] = t[1];
  }
  const miss = [];
  for (const id of TC.FMTBAR_IDS) {
    if (!(id in cmdOf) && !(id in tipOf)) { miss.push(id + '(ไม่ผูกคำสั่ง)'); continue; }
    if (!T.tipText(cmdOf[id], tipOf[id])) miss.push(id);
  }
  check('★★ ทุกปุ่มบนแถบรูปแบบลอยมีคำอธิบายครบ', miss.length === 0, miss.join(' · '));
}

console.log(`tooltip: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
