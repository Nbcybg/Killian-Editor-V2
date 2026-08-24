// test/toolbar-config.test.cjs — [alpha.79] เอาปุ่มเข้า-ออกจากแถบเครื่องมือ
// จุดที่พังง่ายที่สุดคือ "เส้นคั่นลอย" ตอนซ่อนทั้งกลุ่ม → layoutToolbar คือหัวใจของเทสนี้
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_tbcfg.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/toolbar/toolbar-config.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const T = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ นิยามกลุ่ม ═══════════
{
  check('มีกลุ่มอย่างน้อย 8 กลุ่ม', T.TOOLBAR_GROUPS.length >= 8, T.TOOLBAR_GROUPS.length);
  const ids = T.allButtonIds();
  check('มีปุ่มอย่างน้อย 35 ปุ่ม', ids.length >= 35, ids.length);
  check('ไม่มี id ซ้ำข้ามกลุ่ม', new Set(ids).size === ids.length,
        ids.filter((x, i) => ids.indexOf(x) !== i).join(','));
  check('ทุกกลุ่มมีคีย์ภาษา', T.TOOLBAR_GROUPS.every((g) => /^ui\./.test(g.labelKey)));
  // คีย์ที่ถูกอ้างเป็น "ข้อมูล" (labelKey) ไม่ถูกกวาดโดย test/i18n-keys — ต้องตรวจที่นี่แทน
  // ไม่งั้นชื่อกลุ่มจะโผล่เป็น `ui.tbcfg.grpView` บนหน้าจอโดยไม่มีเทสไหนจับได้
  {
    const fs = require('fs');
    const path = require('path');
    const { lexCsv } = require('../tools/csv-lite.cjs');
    const dir = path.join(__dirname, '..', 'languages');
    for (const f of fs.readdirSync(dir).filter((x) => /^k2_.+\.csv$/.test(x))) {
      const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
      const miss = T.TOOLBAR_GROUPS.map((g) => g.labelKey).filter((k) => !tbl[k]);
      check(`${f}: ชื่อกลุ่มมีคำแปลครบ`, miss.length === 0, miss.join(' · '));
    }
  }
  check('ทุก id ขึ้นต้นด้วย tb- หรือเป็น select ที่รู้จัก',
        ids.every((x) => /^tb-/.test(x)), ids.filter((x) => !/^tb-/.test(x)).join(','));
  check('ปุ่มที่โปรแกรมคุมเอง ตั้งค่าไม่ได้',
        T.LOCKED_BUTTONS.every((x) => T.isConfigurable(x) === false));
  check('ปุ่มที่โปรแกรมคุมเอง ไม่อยู่ในรายการกลุ่ม',
        T.LOCKED_BUTTONS.every((x) => !ids.includes(x)));
  check('ปุ่มที่ไม่รู้จัก = ตั้งค่าไม่ได้', T.isConfigurable('tb-ไม่มีจริง') === false);
  check('groupOf บอกกลุ่มถูก', T.groupOf('tb-bold') === 'style' && T.groupOf('tb-ai') === 'ai');
  check('groupOf ปุ่มที่ไม่รู้จัก = ว่าง', T.groupOf('zzz') === '');
  check('แผงบทพูดกับแผงปลั๊กอินอยู่ในรายการแล้ว',
        ids.includes('tb-dialogue') && ids.includes('tb-plugins'));
}

// ═══════════ normalize / เปิด-ปิด ═══════════
{
  const empty = T.normalizeToolbar(null);
  check('ค่าเริ่มต้น = ไม่ซ่อนอะไรเลย', Object.keys(empty.hidden).length === 0);
  check('ค่าเริ่มต้น: ทุกปุ่มมองเห็น', T.allButtonIds().every((id) => T.isButtonVisible(null, id)));

  let cfg = T.setButtonVisible(null, 'tb-ai', false);
  check('ปิดปุ่มได้', T.isButtonVisible(cfg, 'tb-ai') === false);
  check('ปิดตัวหนึ่งไม่กระทบตัวอื่น', T.isButtonVisible(cfg, 'tb-bold') === true);
  cfg = T.setButtonVisible(cfg, 'tb-ai', true);
  check('เปิดกลับได้', T.isButtonVisible(cfg, 'tb-ai') === true);
  check('เปิดกลับแล้วไม่เหลือขยะใน hidden', !cfg.hidden['tb-ai']);

  check('ปุ่มที่โปรแกรมคุมเอง สั่งปิดไม่ได้',
        T.isButtonVisible(T.setButtonVisible(null, 'tb-mode', false), 'tb-mode') === true);
  check('setButtonVisible ไม่แก้ของเดิม', (() => {
    const a = { hidden: {} };
    T.setButtonVisible(a, 'tb-ai', false);
    return Object.keys(a.hidden).length === 0;
  })());
  check('คีย์ที่ไม่รู้จักในไฟล์ตั้งค่า ถูกทิ้ง',
        !T.normalizeToolbar({ hidden: { 'tb-ผี': true } }).hidden['tb-ผี']);
  check('ค่าที่ไม่ใช่ object ก็ไม่พัง',
        Object.keys(T.normalizeToolbar('ข้อความมั่ว').hidden).length === 0
        && Object.keys(T.normalizeToolbar(42).hidden).length === 0);

  const g = T.setGroupVisible(null, 'ai', false);
  check('ปิดทั้งกลุ่ม',
        (T.TOOLBAR_GROUPS.find((x) => x.key === 'ai') || { buttons: [] }).buttons
          .filter((b) => T.isConfigurable(b.id))
          .every((b) => !T.isButtonVisible(g, b.id)));
  check('ปิดกลุ่มหนึ่ง ไม่กระทบกลุ่มอื่น', T.isButtonVisible(g, 'tb-bold'));
  check('เปิดทั้งกลุ่มกลับ',
        ['tb-ai', 'tb-ai-chat'].every((id) => T.isButtonVisible(T.setGroupVisible(g, 'ai', true), id)));
  check('กลุ่มที่ไม่รู้จัก ไม่พัง', T.setGroupVisible(null, 'ไม่มี', false).hidden !== undefined);

  const c2 = T.toolbarCounts(g);
  // [alpha.94] เดิมฮาร์ดโค้ด "- 3" ตามจำนวนปุ่มในกลุ่ม ai ตอนนั้น → เพิ่มปุ่มเข้ากลุ่มไหนก็แดง
  // นับจากทะเบียนจริงแทน (บทเรียนข้อ 13: เทสที่พึ่งค่าคงที่พังทุกครั้งที่ฟีเจอร์โต)
  const aiGroupSize = (T.TOOLBAR_GROUPS.find((x) => x.key === 'ai') || { buttons: [] })
    .buttons.filter((b) => T.isConfigurable(b.id)).length;
  check('นับปุ่มที่เปิดอยู่ถูก',
        c2.total === T.allButtonIds().length && c2.on === c2.total - aiGroupSize,
        JSON.stringify(c2) + ' aiGroupSize=' + aiGroupSize);
  check('รีเซ็ตแล้วกลับมาเปิดหมด',
        T.toolbarCounts(T.resetToolbarConfig()).on === T.allButtonIds().length);
}

// ═══════════ layoutToolbar — เส้นคั่น ═══════════
{
  const L = T.layoutToolbar;
  const all = () => true;
  const none = () => false;

  check('ทุกปุ่มเปิด: เส้นคั่นกลางแสดง',
        JSON.stringify(L(['a', 'sep', 'b'], all)) === JSON.stringify([true, true, true]));
  check('เส้นคั่นหน้าสุดไม่แสดง',
        JSON.stringify(L(['sep', 'a'], all)) === JSON.stringify([false, true]));
  check('เส้นคั่นท้ายสุดไม่แสดง',
        JSON.stringify(L(['a', 'sep'], all)) === JSON.stringify([true, false]));
  check('ปิดหมด = ไม่เหลืออะไรเลย',
        L(['a', 'sep', 'b', 'sep', 'c'], none).every((x) => x === false));

  // ซ่อนทั้งกลุ่มกลาง → ต้องเหลือเส้นคั่นเดียว ไม่ใช่สองอันติดกัน
  const seq = ['a', 'sep', 'b1', 'b2', 'sep', 'c'];
  const hideB = (id) => !/^b/.test(id);
  const r = L(seq, hideB);
  check('ซ่อนกลุ่มกลาง: เหลือเส้นคั่นอันเดียว',
        r.filter((x, i) => seq[i] === 'sep' && x).length === 1, JSON.stringify(r));
  check('ซ่อนกลุ่มกลาง: ปุ่มหัว-ท้ายยังอยู่', r[0] === true && r[5] === true);
  check('ซ่อนกลุ่มกลาง: เส้นคั่นที่แสดงคืออันที่สอง (อยู่ระหว่าง a กับ c)',
        r[1] === false && r[4] === true, JSON.stringify(r));

  // ซ่อนปุ่มแรกทั้งหมด → เส้นคั่นแรกต้องหาย
  const r2 = L(['a', 'sep', 'b', 'sep', 'c'], (id) => id !== 'a');
  check('ซ่อนปุ่มแรก: เส้นคั่นแรกหาย', r2[1] === false && r2[3] === true, JSON.stringify(r2));

  // เส้นคั่นสองอันติดกันในซอร์ส
  const r3 = L(['a', 'sep', 'sep', 'b'], all);
  check('เส้นคั่นสองอันติดกัน → แสดงอันเดียว',
        r3[1] === false && r3[2] === true, JSON.stringify(r3));

  check('รายการว่างไม่พัง', L([], all).length === 0 && L(null, all).length === 0);
  check('ไม่มีเส้นคั่นเลยก็ได้',
        JSON.stringify(L(['a', 'b'], all)) === JSON.stringify([true, true]));
}

console.log(`\ntoolbar-config: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
