// test/panel-focus.test.cjs — [alpha.152 ข้อ 5] "แผงที่กำลังเลือกอยู่"
//
// ผู้ใช้: *"bug อันนี้ร้ายแรง คือ shortcut มันไปจับนอก planner … ต้องแก้คือ แผงที่มี shortcut
//          ต้องทำการเลือกแผงก่อน ทำเครื่องหมาย เช่น สี title bar เข้ม"*
//
// สิ่งที่ต้องจริงเสมอ ไม่ว่า UI จะเปลี่ยนไปแค่ไหน:
//   · กดในแผงไหน = เลือกแผงนั้น · กดนอกแผง (แถบเครื่องมือ) = ของเดิมยังถูกเลือกอยู่
//   · มีแผงถูกเลือกได้ทีละใบเดียว และต้องมีเครื่องหมายบน DOM ให้ผู้ใช้เห็น
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_pfocus.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/panels/panel-focus.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });

// DOM จำลองแบบบางที่สุดเท่าที่โมดูลต้องใช้ — ไม่ต้องลาก jsdom ทั้งก้อนมาเพื่อสี่ฟังก์ชัน
function mkEl(panelId, parent) {
  const cls = new Set();
  const el = {
    dataset: panelId ? { panelId } : {},
    parentNode: parent || null,
    classList: {
      contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); return on; },
      add: (c) => cls.add(c), remove: (c) => cls.delete(c),
    },
    _cls: cls,
  };
  return el;
}

const listeners = {};
const all = [];
global.document = {
  querySelectorAll: () => all.filter((e) => e.dataset && e.dataset.panelId),
  addEventListener: (type, fn, cap) => { (listeners[type] = listeners[type] || []).push({ fn, cap }); },
};

const P = require(out);
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ หาแผงจาก element ═══════════
{
  const panel = mkEl('planner');
  const body = mkEl(null, panel);
  const deep = mkEl(null, mkEl(null, body));
  deep.parentNode.parentNode = body;
  check('หา id ของแผงจากตัวมันเองได้', P.panelIdAt(panel) === 'planner');
  check('★ หาจากลูกที่ซ้อนลึกได้ (ผู้ใช้กดที่ปุ่มในแผง ไม่ใช่ที่กรอบแผง)',
        P.panelIdAt(deep) === 'planner', P.panelIdAt(deep));
  check('อยู่นอกแผงทุกใบ → null', P.panelIdAt(mkEl(null, null)) === null);
  check('ส่ง null มาก็ไม่พัง', P.panelIdAt(null) === null);
}

// ═══════════ เลือกแผง + เครื่องหมายบน DOM ═══════════
{
  const planner = mkEl('planner');
  const props = mkEl('planner-props');
  const tab = mkEl('planner');               // หัวแท็บของแผงเดียวกัน
  all.push(planner, props, tab);

  check('เริ่มต้น: ยังไม่ได้เลือกแผงไหน', P.focusedPanel() === null);
  check('ยังไม่เลือก = ไม่มีแผงไหนบอกว่าตัวเองถูกเลือก',
        !P.isPanelFocused('planner') && !P.isPanelFocused('planner-props'));

  check('★ เลือกแผงแล้วมีผลจริง', P.setFocusedPanel('planner') === true && P.isPanelFocused('planner'));
  check('★★ เครื่องหมายไปถึง DOM ทั้งกรอบแผงและหัวแท็บของแผงเดียวกัน',
        planner._cls.has('k-panel-focus') && tab._cls.has('k-panel-focus'));
  check('★★ แผงอื่นต้องไม่ติดเครื่องหมาย (เลือกได้ทีละใบเดียว)',
        !props._cls.has('k-panel-focus'));

  check('เลือกซ้ำใบเดิม = ไม่นับว่าเปลี่ยน', P.setFocusedPanel('planner') === false);

  P.setFocusedPanel('planner-props');
  check('★★ ย้ายไปแผงอื่น → ใบเก่าถอดเครื่องหมาย ใบใหม่ติดแทน (สองทาง)',
        !planner._cls.has('k-panel-focus') && !tab._cls.has('k-panel-focus')
        && props._cls.has('k-panel-focus'));
  check('★ และ isPanelFocused ตอบตรงกับที่เห็นบนจอ',
        P.isPanelFocused('planner-props') && !P.isPanelFocused('planner'));

  P.setFocusedPanel(null);
  check('ยกเลิกการเลือกได้ (ไม่มีแผงไหนถูกเลือก)',
        P.focusedPanel() === null && !props._cls.has('k-panel-focus'));
  check('ถาม id ว่าง ๆ ไม่เคยตอบว่าถูกเลือก',
        !P.isPanelFocused('') && !P.isPanelFocused(null) && !P.isPanelFocused(undefined));
}

// ═══════════ ผู้ฟังการเปลี่ยนแผง ═══════════
{
  const seen = [];
  const off = P.onPanelFocus((next, prev) => seen.push(prev + '→' + next));
  P.setFocusedPanel('tree');
  P.setFocusedPanel('docs');
  check('★ ผู้ฟังได้ทั้งใบใหม่และใบเก่า', seen.join(',') === 'null→tree,tree→docs', seen.join(','));
  off();
  P.setFocusedPanel('outline');
  check('เลิกฟังแล้วไม่ได้รับอีก', seen.length === 2, seen.length);
  // ผู้ฟังที่พังต้องไม่ลากทั้งระบบลงไปด้วย
  const off2 = P.onPanelFocus(() => { throw new Error('พัง'); });
  let threw = false;
  try { P.setFocusedPanel('tree'); } catch { threw = true; }
  check('★ ผู้ฟังที่โยน error ไม่ทำให้การเลือกแผงล้มทั้งระบบ',
        !threw && P.focusedPanel() === 'tree');
  off2();
}

// ═══════════ การผูกอีเวนต์: กดในแผง / นอกแผง ═══════════
{
  check('ผูกครั้งแรกสำเร็จ', P.bindPanelFocus() === true);
  check('ผูกซ้ำไม่ผูกทับ (กันฟังสองรอบ)', P.bindPanelFocus() === false);
  check('★ ดัก pointerdown กับ focusin ทั้งคู่ ในระยะ capture',
        (listeners.pointerdown || []).length === 1 && (listeners.focusin || []).length === 1
        && listeners.pointerdown[0].cap === true && listeners.focusin[0].cap === true);

  const fire = (el) => listeners.pointerdown[0].fn({ target: el });
  const planner = mkEl('planner');
  const propsBtn = mkEl(null, mkEl('planner-props'));
  propsBtn.parentNode = mkEl('planner-props');

  P.setFocusedPanel(null);
  fire(planner);
  check('★★ กดในแผงกระดาน → เลือกกระดาน', P.focusedPanel() === 'planner');

  // แถบเครื่องมือเป็นแผงเหมือนกัน แต่ไม่ใช่พื้นที่ทำงาน → ต้องไม่แย่งโฟกัส
  fire(mkEl('toolbar'));
  check('★★ กดปุ่มบนแถบเครื่องมือ → กระดานยังถูกเลือกอยู่ (ไม่งั้นคีย์ลัดตายทุกครั้งที่กดปุ่ม)',
        P.focusedPanel() === 'planner', P.focusedPanel());
  fire(mkEl('statusbar'));
  check('แถบสถานะก็เหมือนกัน', P.focusedPanel() === 'planner');

  fire(mkEl(null, null));
  check('★ กดนอกแผงทุกใบ (เมนู/กล่องโต้ตอบ) → ของเดิมยังถูกเลือก',
        P.focusedPanel() === 'planner');

  fire(propsBtn);
  check('★★ ไปกดในแผงคุณสมบัติ → ย้ายโฟกัสไปจริง (คีย์ลัดกระดานต้องเงียบทันที)',
        P.focusedPanel() === 'planner-props', P.focusedPanel());

  listeners.focusin[0].fn({ target: planner });
  check('★ เลื่อนโฟกัสด้วยคีย์บอร์ด (focusin) ก็ย้ายแผงที่เลือกเหมือนกัน',
        P.focusedPanel() === 'planner');
}

// ═══════════ [alpha.152 ข้อ 4] แผงที่ "ดูแลคีย์บอร์ดของตัวเอง" ═══════════
//
// กระดานมี undo/redo ของตัวเอง — ตอนถูกเลือกอยู่ Ctrl+Z ต้องเป็นของกระดาน ไม่ใช่ของเอกสาร
// (ตารางคีย์ลัดระดับโปรแกรมดักที่ window ระยะ capture จึงยิงก่อนตัวจับของกระดานเสมอ)
{
  P.setFocusedPanel(null);
  check('ยังไม่ได้เลือกอะไร → ไม่มีใครอ้างสิทธิ์คีย์ของเอกสาร', P.focusedPanelOwnsKeys() === false);
  P.setPanelOwnsKeys('planner', true);
  P.setFocusedPanel('planner');
  check('★★ เลือกกระดานที่ดูแลคีย์เอง → คีย์ของเอกสารเป็นของกระดาน',
        P.focusedPanelOwnsKeys() === true);
  P.setFocusedPanel('docs');
  check('★★ ย้ายไปแผงเอกสาร → คืนคีย์ให้เอกสารตามเดิม (สองทาง)',
        P.focusedPanelOwnsKeys() === false);
  P.setFocusedPanel('planner');
  P.setPanelOwnsKeys('planner', false);
  check('★ ถอนทะเบียนได้ (สองทาง)', P.focusedPanelOwnsKeys() === false);
  check('ลงทะเบียน id ว่างไม่ทำอะไร', P.setPanelOwnsKeys('') === false);
}

console.log(`\npanel-focus: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
