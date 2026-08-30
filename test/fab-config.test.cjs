// test/fab-config.test.cjs — [alpha.111] ปุ่มลอย (FAB): คำสั่งที่ผู้ใช้เลือกเอง + เมนูวงกลม
//
// สองเรื่องที่พลาดง่ายและเทสได้โดยไม่ต้องมีจอ:
//   1. กฎ "ไม่เกิน 4" + ลำดับ (เพิ่ม/ถอด/สลับที่แล้วต้องไม่มีตัวซ้ำ ไม่มีตัวหาย)
//   2. เรขาคณิตของเมนูวงกลม — ทิศที่กาง · รัศมีที่ปุ่มไม่ทับกัน · หน่วงเวลาไล่ทีละตัว
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const { lexCsv } = require('../tools/csv-lite.cjs');
const out = path.join(require('os').tmpdir(), '_fabcfg.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/toolbar/fab-config.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const F = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ ตารางคำสั่ง ═══════════
{
  const ids = F.allFabIds();
  check('มีคำสั่งให้เลือกอย่างน้อย 18 อัน', ids.length >= 18, ids.length);
  check('ไม่มี id ซ้ำ', new Set(ids).size === ids.length,
        ids.filter((x, i) => ids.indexOf(x) !== i).join(','));
  check('ทุกคำสั่งมีช่องคำสั่งจริง (cmd)', F.FAB_ACTIONS.every((a) => typeof a.cmd === 'string' && a.cmd));
  check('ทุกคำสั่งมีไอคอน', F.FAB_ACTIONS.every((a) => typeof a.icon === 'string' && a.icon));
  check('ทุกคำสั่งอยู่ในกลุ่มที่ประกาศไว้',
        F.FAB_ACTIONS.every((a) => F.FAB_GROUPS.some((g) => g.key === a.grp)),
        F.FAB_ACTIONS.filter((a) => !F.FAB_GROUPS.some((g) => g.key === a.grp)).map((a) => a.id).join(','));
  check('ทุกกลุ่มมีคำสั่งอย่างน้อยหนึ่งอัน',
        F.FAB_GROUPS.every((g) => F.fabGroupActions(g.key).length > 0));
  check('args ถ้ามี ต้องเป็น array', F.FAB_ACTIONS.every((a) => a.args === undefined || Array.isArray(a.args)));
  check('fabAction คืน null เมื่อไม่รู้จัก', F.fabAction('ไม่มีจริง') === null);

  // ป้ายชื่อเป็น "ข้อมูล" (labelKey) → test/i18n-keys กวาดไม่เจอ ต้องตรวจที่นี่
  const dir = path.join(__dirname, '..', 'languages');
  for (const f of fs.readdirSync(dir).filter((x) => /^k2_.+\.csv$/.test(x))) {
    const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
    const keys = F.FAB_ACTIONS.map((a) => a.labelKey)
      .concat(F.FAB_GROUPS.map((g) => g.labelKey))
      .concat(Object.values(F.FAB_DISPLAY_LABELS));
    const miss = keys.filter((k) => !tbl[k]);
    check(`${f}: ชื่อคำสั่ง/กลุ่ม/รูปแบบ มีคำแปลครบ`, miss.length === 0, miss.join(' · '));
  }
}

// ═══════════ ทำให้เป็นมาตรฐาน ═══════════
{
  const d = F.normalizeFab(null);
  check('ไม่เคยตั้งค่า → ใช้ชุดเริ่มต้น',
        d.actions.join(',') === F.DEFAULT_FAB_ACTIONS.join(','), d.actions.join(','));
  check('ชุดเริ่มต้นไม่เกินเพดาน', F.DEFAULT_FAB_ACTIONS.length <= F.FAB_MAX);
  check('รูปแบบเริ่มต้น = ไอคอน', d.display === 'icon');
  check('★ ถอดออกหมดแล้วต้องว่างจริง (ไม่เด้งกลับเป็นค่าเริ่มต้น)',
        F.normalizeFab({ actions: [] }).actions.length === 0);
  check('id ที่ไม่รู้จักถูกทิ้ง',
        F.normalizeFab({ actions: ['scene', 'ไม่มีจริง'] }).actions.join(',') === 'scene');
  check('ตัวซ้ำถูกทิ้ง',
        F.normalizeFab({ actions: ['scene', 'scene', 'memo'] }).actions.join(',') === 'scene,memo');
  check('★ เกิน 4 ถูกตัดที่ 4',
        F.normalizeFab({ actions: F.allFabIds() }).actions.length === F.FAB_MAX);
  check('รูปแบบที่ไม่รู้จักตกกลับเป็นไอคอน', F.normalizeFab({ display: 'ปีกกา' }).display === 'icon');
  check('รูปแบบที่ถูกต้องอยู่รอด', F.normalizeFab({ display: 'iconText' }).display === 'iconText');
  check('ค่าขยะไม่พัง', F.normalizeFab('อะไรก็ไม่รู้').actions.length === F.DEFAULT_FAB_ACTIONS.length);
}

// ═══════════ เพิ่ม / ถอด / สลับที่ ═══════════
{
  let c = { actions: ['scene'], display: 'icon' };
  c = F.toggleFabAction(c, 'memo', true);
  check('เพิ่มได้ ต่อท้าย', c.actions.join(',') === 'scene,memo');
  check('เพิ่มตัวที่มีอยู่แล้ว = ไม่เปลี่ยน',
        F.toggleFabAction(c, 'memo', true).actions.join(',') === 'scene,memo');
  check('เพิ่มตัวที่ไม่รู้จัก = ไม่เปลี่ยน',
        F.toggleFabAction(c, 'ไม่มีจริง', true).actions.join(',') === 'scene,memo');
  c = F.toggleFabAction(c, 'scene', false);
  check('ถอดได้', c.actions.join(',') === 'memo');
  check('ถอดตัวที่ไม่ได้เลือกไว้ = ไม่เปลี่ยน',
        F.toggleFabAction(c, 'scene', false).actions.join(',') === 'memo');

  const full = { actions: F.allFabIds().slice(0, F.FAB_MAX), display: 'icon' };
  check('เต็มแล้ว = เพิ่มไม่ได้', F.canAddFab(full) === false);
  const after = F.toggleFabAction(full, F.allFabIds()[F.FAB_MAX], true);
  check('★ เต็มแล้วยังกดเพิ่ม → ไม่เปลี่ยนอะไรเลย (ไม่เตะตัวเก่าทิ้งเงียบ ๆ)',
        after.actions.join(',') === full.actions.join(','));
  check('ถอดออกหนึ่งตัวแล้วเพิ่มได้อีก',
        F.canAddFab(F.toggleFabAction(full, full.actions[0], false)) === true);

  const ord = { actions: ['scene', 'chapter', 'memo'], display: 'icon' };
  check('เลื่อนขึ้นได้', F.moveFabAction(ord, 'memo', -1).actions.join(',') === 'scene,memo,chapter');
  check('เลื่อนลงได้', F.moveFabAction(ord, 'scene', 1).actions.join(',') === 'chapter,scene,memo');
  check('เลื่อนเลยหัวไม่ได้', F.moveFabAction(ord, 'scene', -1).actions.join(',') === 'scene,chapter,memo');
  check('เลื่อนเลยท้ายไม่ได้', F.moveFabAction(ord, 'memo', 1).actions.join(',') === 'scene,chapter,memo');
  check('เลื่อนตัวที่ไม่มี = ไม่เปลี่ยน',
        F.moveFabAction(ord, 'ไม่มีจริง', 1).actions.join(',') === 'scene,chapter,memo');
  check('ทุกคำสั่งยังอยู่ครบหลังสลับที่',
        F.moveFabAction(ord, 'memo', -1).actions.slice().sort().join(',') === 'chapter,memo,scene');

  check('เปลี่ยนรูปแบบได้', F.setFabDisplay(ord, 'text').display === 'text');
  check('รูปแบบที่ไม่รู้จัก = คงของเดิม', F.setFabDisplay(ord, 'zzz').display === 'icon');
  check('เปลี่ยนรูปแบบไม่แตะรายการคำสั่ง',
        F.setFabDisplay(ord, 'text').actions.join(',') === 'scene,chapter,memo');
  check('รีเซ็ตคืนชุดเริ่มต้น',
        F.resetFabConfig().actions.join(',') === F.DEFAULT_FAB_ACTIONS.join(','));
  check('hasFabAction ตอบถูก',
        F.hasFabAction(ord, 'memo') === true && F.hasFabAction(ord, 'gallery') === false);

  const items = F.fabMenuItems(ord);
  check('รายการเมนูเรียงตามที่จัดไว้ และเป็นนิยามเต็ม',
        items.length === 3 && items[0].id === 'scene' && typeof items[0].cmd === 'string');
  check('รายการว่าง → เมนูว่าง', F.fabMenuItems({ actions: [] }).length === 0);
}

// ═══════════ เรขาคณิตเมนูวงกลม ═══════════
{
  // ทิศที่กาง — ปุ่มอยู่มุมไหนต้องกางเข้าหากลางจอเสมอ
  check('มุมขวาล่าง → กางซ้าย-ขึ้น', (() => {
    const d = F.fabOpenDir(1800, 950, 1920, 1080);
    return d.dirX === -1 && d.dirY === -1;
  })());
  check('มุมซ้ายบน → กางขวา-ลง', (() => {
    const d = F.fabOpenDir(60, 60, 1920, 1080);
    return d.dirX === 1 && d.dirY === 1;
  })());
  check('มุมขวาบน → กางซ้าย-ลง', (() => {
    const d = F.fabOpenDir(1800, 60, 1920, 1080);
    return d.dirX === -1 && d.dirY === 1;
  })());

  // ★ รัศมี: ปุ่มสองตัวที่ติดกันต้องห่างกันไม่น้อยกว่าขนาดปุ่ม+ช่องไฟ
  for (const n of [2, 3, 4]) {
    const r = F.fabRadius(n, 46, 16, 90, 84);
    const p = F.fabRadialPositions(n, { radius: r, dirX: -1, dirY: -1, spread: 90 });
    let minGap = Infinity;
    for (let i = 1; i < p.length; i++) {
      minGap = Math.min(minGap, Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
    }
    check(`★ ${n} ปุ่มไม่ทับกัน (ห่างอย่างน้อย 46px)`, minGap >= 46, minGap.toFixed(1));
  }
  check('ปุ่มเดียวใช้รัศมีขั้นต่ำ', F.fabRadius(1, 46, 16, 90, 84) === 84);
  check('ศูนย์ปุ่มก็ไม่หารศูนย์', Number.isFinite(F.fabRadius(0, 46)));

  {
    const p = F.fabRadialPositions(4, { radius: 100, dirX: -1, dirY: -1, spread: 90, start: 0 });
    check('ทุกตัวอยู่บนวงรัศมีเดียวกัน',
          p.every((q) => Math.abs(Math.hypot(q.x, q.y) - 100) < 0.001),
          p.map((q) => Math.hypot(q.x, q.y).toFixed(2)).join(','));
    check('กางซ้าย = x ไม่เป็นบวก', p.every((q) => q.x <= 0.001), JSON.stringify(p.map((q) => q.x)));
    check('กางขึ้น = y ไม่เป็นบวก', p.every((q) => q.y <= 0.001), JSON.stringify(p.map((q) => q.y)));
    check('ตัวแรกออกด้านข้าง ตัวสุดท้ายขึ้นตรง ๆ',
          Math.abs(p[0].y) < 0.001 && Math.abs(p[3].x) < 0.001);
    check('หน่วงเวลาไล่ทีละตัวจาก 0', p.map((q) => q.delay).join(',') === '0,45,90,135');
  }
  {
    const p = F.fabRadialPositions(4, { radius: 100, dirX: 1, dirY: 1, spread: 90 });
    check('กางขวา-ลง = x ไม่ติดลบ · y ไม่ติดลบ',
          p.every((q) => q.x >= -0.001 && q.y >= -0.001),
          JSON.stringify(p.map((q) => [+q.x.toFixed(1), +q.y.toFixed(1)])));
  }
  {
    const c = F.fabRadialPositions(4, { radius: 100, stagger: 45, closing: true });
    check('★ ตอนปิด หน่วงไล่กลับทาง (ตัวไกลสุดยุบก่อน)',
          c.map((q) => q.delay).join(',') === '135,90,45,0');
  }
  check('ปุ่มเดียววางกลางเสี้ยว',
        Math.abs(F.fabRadialPositions(1, { radius: 100, spread: 90 })[0].angle - 45) < 0.001);
  check('ศูนย์ปุ่ม = รายการว่าง', F.fabRadialPositions(0).length === 0);
  check('ค่าติดลบไม่พัง', F.fabRadialPositions(-3).length === 0);
  check('เวลารวมของอนิเมชันโตตามจำนวนปุ่ม',
        F.fabAnimMs(4, 45, 220) === 355 && F.fabAnimMs(1, 45, 220) === 220
        && F.fabAnimMs(0, 45, 220) === 220);
}

// ═══════════ แถวตั้งสำหรับปุ่มที่มีข้อความ ═══════════
// ★ ทำไมต้องมีสองแบบ: บนส่วนโค้ง ระยะ **แนวตั้ง** ระหว่างสองตัวบน ๆ แคบลงจนป้ายยาว ๆ ทับกัน
//   (เจอกับตาในสกรีนช็อตรอบแรก) — ป้ายทับกันในแนวนอนอยู่แล้ว เหลือแนวตั้งอย่างเดียวที่กันได้
{
  const p = F.fabStackPositions(4, { item: 42, gap: 10, offset: 62, dirY: -1 });
  check('ทุกตัวอยู่แนวตั้งเดียวกัน (x เท่ากันหมด)', p.every((q) => q.x === 0));
  check('กางขึ้น = y ติดลบทุกตัว', p.every((q) => q.y < 0), JSON.stringify(p.map((q) => q.y)));
  check('ตัวแรกพ้นตัวปุ่มแม่', Math.abs(p[0].y) >= 62);
  check('★ ระยะห่างแนวตั้งเท่ากันและมากพอไม่ให้ป้ายทับกัน', (() => {
    for (let i = 1; i < p.length; i++) if (Math.abs(p[i].y - p[i - 1].y) < 52) return false;
    return true;
  })(), JSON.stringify(p.map((q) => q.y)));
  check('กางลงได้ด้วย (ปุ่มอยู่ครึ่งบนของจอ)',
        F.fabStackPositions(3, { dirY: 1 }).every((q) => q.y > 0));
  check('หน่วงเวลาไล่ทีละตัว', p.map((q) => q.delay).join(',') === '0,45,90,135');
  check('ตอนปิดไล่กลับทาง',
        F.fabStackPositions(4, { closing: true }).map((q) => q.delay).join(',') === '135,90,45,0');
  check('ศูนย์ปุ่ม = รายการว่าง', F.fabStackPositions(0).length === 0);
  check('ค่าเริ่มต้นใช้ได้โดยไม่ต้องส่ง opts', F.fabStackPositions(2).length === 2);
}

// ═══════════ หนีบตำแหน่งปุ่มแม่ให้อยู่ในจอ ═══════════
{
  const size = { width: 52, height: 52 };
  check('ตำแหน่งปกติไม่ถูกแตะ',
        JSON.stringify(F.clampFabPos({ left: 400, top: 300 }, size, 1200, 800))
          === JSON.stringify({ left: 400, top: 300 }));
  check('★ หลุดขอบขวา/ล่าง ถูกดึงกลับ', (() => {
    const p = F.clampFabPos({ left: 5000, top: 5000 }, size, 1200, 800);
    return p.left === 1200 - 52 - 6 && p.top === 800 - 52 - 6;
  })());
  check('ติดลบถูกดึงกลับ', (() => {
    const p = F.clampFabPos({ left: -80, top: -80 }, size, 1200, 800);
    return p.left === 6 && p.top === 6;
  })());
  check('จอเล็กกว่าตัวปุ่มก็ยังคืนค่าที่ใช้ได้', (() => {
    const p = F.clampFabPos({ left: 100, top: 100 }, size, 40, 40);
    return Number.isFinite(p.left) && Number.isFinite(p.top) && p.left >= 0 && p.top >= 0;
  })());
  check('ค่าว่างไม่พัง', (() => {
    const p = F.clampFabPos(null, null, 1200, 800);
    return Number.isFinite(p.left) && Number.isFinite(p.top);
  })());
  check('คืนเลขจำนวนเต็มเสมอ', (() => {
    const p = F.clampFabPos({ left: 100.6, top: 20.4 }, size, 1200, 800);
    return p.left === 101 && p.top === 20;
  })());
}

console.log(`\nfab-config: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
