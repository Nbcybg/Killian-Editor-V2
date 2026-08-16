// test/shortcuts.test.cjs — [alpha.79] ตารางคีย์ลัด
//
// ประตูกันพลาดสามข้อที่เคยหลุดมาตลอด:
//   1. ปุ่มชนกัน (สองคำสั่งใช้คีย์เดียวกัน → ตัวหลังไม่มีวันทำงาน)
//   2. รายการไม่มีชื่อ (หน้าตั้งค่าโชว์ id ดิบ)
//   3. ชื่อชี้ไปคีย์ภาษาที่ไม่มีจริง (โชว์ตัวคีย์)
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const { lexCsv } = require('../tools/csv-lite.cjs');
const out = path.join(require('os').tmpdir(), '_sccore.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
// core.js สร้าง SmartType (ซึ่งแตะ DOM) ตอน import — บน node จึงต้องมีของปลอมพอให้ผ่าน
// (ตารางคีย์ลัดเองไม่แตะ DOM เลย จึงเทสได้ตรง ๆ หลังใส่ของปลอมนี้)
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} },
  appendChild() {}, append() {}, remove() {}, setAttribute() {}, addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], firstChild: null, dataset: {} });
globalThis.document = { createElement: stubEl, body: stubEl(), documentElement: stubEl(),
  addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
globalThis.window = { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
globalThis.navigator = { platform: 'Win32' };
globalThis.localStorage = globalThis.window.localStorage;
const C = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const ROOT = path.join(__dirname, '..');
const tables = {};
for (const f of fs.readdirSync(path.join(ROOT, 'languages')).filter((x) => /^k2_.+\.csv$/.test(x))) {
  tables[f] = lexCsv(fs.readFileSync(path.join(ROOT, 'languages', f), 'utf8'));
}
const resolve = (tbl, key) => tbl[key] || tbl['ui.' + key];

// ═══════════ ขนาดตาราง ═══════════
{
  check('มีคีย์ลัดอย่างน้อย 70 รายการ', C.SHORTCUTS.length >= 70, C.SHORTCUTS.length);
  check('ทุกแถวมีอย่างน้อย 4 ช่อง', C.SHORTCUTS.every((s) => s.length >= 4));
  check('ทุกแถวมี code เป็นข้อความ', C.SHORTCUTS.every((s) => typeof s[0] === 'string' && s[0]));
  check('ช่องที่สองเป็น true/false/ctrl+alt เท่านั้น',
        C.SHORTCUTS.every((s) => s[1] === true || s[1] === false || s[1] === 'ctrl+alt'),
        JSON.stringify(C.SHORTCUTS.filter((s) => ![true, false, 'ctrl+alt'].includes(s[1]))));
}

// ═══════════ ปุ่มชนกัน ═══════════
{
  const seen = new Map();
  const clash = [];
  for (const s of C.SHORTCUTS) {
    // Alt เป็นส่วนหนึ่งของคีย์ — Ctrl+Alt+I ไม่ใช่คีย์เดียวกับ Ctrl+I
    const k = [s[0], !!s[1], C.needsAlt(s[1]), !!s[2]].join('|');
    if (seen.has(k)) clash.push(k + ' → ' + seen.get(k) + ' vs ' + C.shortcutId(s));
    else seen.set(k, C.shortcutId(s));
  }
  check('ไม่มีปุ่มชนกันเลย', clash.length === 0, clash.join(' · '));

  // คีย์ที่ระบบปฏิบัติการ/ตัวแก้ไขจองไว้ ห้ามแย่ง
  const RESERVED = [['KeyC', true, false], ['KeyV', true, false], ['KeyX', true, false],
                    ['KeyA', true, false]];
  const stolen = C.SHORTCUTS.filter((s) =>
    RESERVED.some((r) => r[0] === s[0] && r[1] === s[1] && !!r[2] === !!s[2]));
  check('ไม่แย่งคีย์ คัดลอก/วาง/ตัด/เลือกทั้งหมด', stolen.length === 0,
        JSON.stringify(stolen));
}

// ═══════════ ชื่อรายการ ═══════════
{
  const ids = C.SHORTCUTS.map((s) => C.shortcutId(s));
  const noLabel = ids.filter((id) => !C.SHORTCUT_LABELS[id]);
  check('ทุกรายการมีชื่อใน SHORTCUT_LABELS', noLabel.length === 0, noLabel.join(' · '));

  for (const f of Object.keys(tables)) {
    const missing = ids.map((id) => C.SHORTCUT_LABELS[id])
      .filter((k) => k && !resolve(tables[f], k));
    check(`${f}: ชื่อคีย์ลัดมีคำแปลครบ`, missing.length === 0, missing.join(' · '));
  }
  // `editor-redo` ผูกสองปุ่มโดยตั้งใจ (Ctrl+Shift+Z ตามแนว mac · Ctrl+Y ตามแนว Windows)
  const ALIAS_OK = ['editor-redo'];
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i).filter((x) => !ALIAS_OK.includes(x));
  check('ไม่มี id ซ้ำในตาราง (นอกจากที่ตั้งใจให้มีสองปุ่ม)', dup.length === 0, dup.join(' · '));
}

// ═══════════ หมวด ═══════════
{
  const ids = C.SHORTCUTS.map((s) => C.shortcutId(s));
  check('มีหมวดอย่างน้อย 6 หมวด', C.SHORTCUT_CATS.length >= 6);
  check('ทุกหมวดมีคีย์ภาษา', C.SHORTCUT_CATS.every((c) => /^ui\./.test(c.labelKey)));
  for (const f of Object.keys(tables)) {
    const miss = C.SHORTCUT_CATS.map((c) => c.labelKey).filter((k) => !resolve(tables[f], k));
    check(`${f}: ชื่อหมวดมีคำแปลครบ`, miss.length === 0, miss.join(' · '));
  }
  // id ที่ประกาศไว้ในหมวดต้องมีจริงในตาราง (กันพิมพ์ผิดแล้วรายการหายเงียบ ๆ)
  const declared = C.SHORTCUT_CATS.flatMap((c) => c.ids);
  const ghost = declared.filter((id) => !ids.includes(id));
  check('หมวดไม่ได้อ้าง id ที่ไม่มีจริง', ghost.length === 0, ghost.join(' · '));
  check('ทุกรายการอยู่ในหมวดใดหมวดหนึ่ง (หรือ other)',
        ids.every((id) => typeof C.shortcutCat(id) === 'string'));
  const other = ids.filter((id) => C.shortcutCat(id) === 'other' && !C.SHORTCUT_CATS.find((c) => c.key === 'other').ids.includes(id));
  check('ไม่มีรายการตกไปหมวด "อื่น ๆ" โดยไม่ตั้งใจเกิน 3 รายการ', other.length <= 3, other.join(' · '));
}

// ═══════════ formatShortcut ═══════════
{
  check('Ctrl+B', C.formatShortcut('KeyB', true, false) === 'Ctrl+B');
  check('Ctrl+Shift+F', C.formatShortcut('KeyF', true, true) === 'Ctrl+Shift+F');
  check('Ctrl+Alt+D (ช่องที่สองเป็น ctrl+alt)',
        C.formatShortcut('KeyD', 'ctrl+alt', false) === 'Ctrl+Alt+D',
        C.formatShortcut('KeyD', 'ctrl+alt', false));
  check('เรียง Ctrl → Alt → Shift',
        C.formatShortcut('KeyD', 'ctrl+alt', true) === 'Ctrl+Alt+Shift+D');
  check('ตัวเลข', C.formatShortcut('Digit1', true, false) === 'Ctrl+1');
  check('เครื่องหมายอ่านออก',
        C.formatShortcut('Period', true, true) === 'Ctrl+Shift+.'
        && C.formatShortcut('Comma', true, false) === 'Ctrl+,'
        && C.formatShortcut('Backslash', true, false) === 'Ctrl+\\'
        && C.formatShortcut('BracketLeft', true, true) === 'Ctrl+Shift+[');
  check('code ว่างไม่พัง', typeof C.formatShortcut('', true, false) === 'string');
  check('needsAlt', C.needsAlt('ctrl+alt') === true && C.needsAlt(true) === false
        && C.needsAlt(false) === false);
}

// ═══════════ ครอบคลุมฟีเจอร์หลัก ═══════════
{
  const ids = new Set(C.SHORTCUTS.map((s) => C.shortcutId(s)));
  const MUST = ['save', 'save-as', 'save-all', 'print', 'find', 'global-search', 'quick-open',
                'settings', 'export-hub', 'close-tab', 'split-view', 'focus-mode', 'typewriter',
                'reading-mode', 'insert-image', 'quick-note',
                'toggle-panel:dashboard', 'toggle-panel:timeline', 'toggle-panel:maps',
                'toggle-panel:network', 'toggle-panel:planner', 'toggle-panel:dialogue',
                'toggle-panel:plugins'];
  const missing = MUST.filter((id) => !ids.has(id));
  check('ฟีเจอร์หลักมีคีย์ลัดครบ', missing.length === 0, missing.join(' · '));
}

console.log(`\nshortcuts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
