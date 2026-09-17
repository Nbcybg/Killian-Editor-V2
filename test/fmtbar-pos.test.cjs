// test/fmtbar-pos.test.cjs — [alpha.111] "เรียกแถบรูปแบบมาหาเคอร์เซอร์"
//
// สิ่งที่พลาดง่ายที่สุดคือ **ระบบพิกัด**: เมาส์เป็นพิกัดหน้าต่าง แต่แถบเป็น absolute ใน #content
// ลืมหักมุมของ host ออกเมื่อไหร่ = แถบเด้งหนีไปอีกมุมทันทีที่มีแผงข้างเปิดอยู่
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_fmtpos.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/toolbar/fmtbar-pos.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const P = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const HOST = { left: 260, top: 90, width: 1000, height: 700 };
const BAR = { width: 520, height: 36 };
const VP = { width: 1400, height: 900 };
const at = (o) => P.fmtBarTarget({ host: HOST, bar: BAR, viewport: VP, ...o });

// ═══════════ เส้นโค้งของการเคลื่อน ═══════════
{
  check('เริ่มที่ 0 จบที่ 1', P.easeInOutCubic(0) === 0 && P.easeInOutCubic(1) === 1);
  check('กลางทางอยู่กึ่งกลางพอดี', Math.abs(P.easeInOutCubic(0.5) - 0.5) < 1e-9);
  check('เพิ่มขึ้นตลอด (ไม่ถอยหลัง)', (() => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = P.easeInOutCubic(i / 20);
      if (v < prev) return false;
      prev = v;
    }
    return true;
  })());
  check('★ ออกช้ากว่าเส้นตรง แล้วเบรกท้าย',
        P.easeInOutCubic(0.2) < 0.2 && P.easeInOutCubic(0.8) > 0.8,
        `${P.easeInOutCubic(0.2).toFixed(3)} / ${P.easeInOutCubic(0.8).toFixed(3)}`);
  check('ค่านอกช่วงถูกหนีบ', P.easeInOutCubic(-5) === 0 && P.easeInOutCubic(9) === 1);
  check('tweenAt ที่หัว/ท้ายตรงเป๊ะ',
        P.tweenAt(100, 400, 0) === 100 && P.tweenAt(100, 400, 1) === 400);
  check('tweenAt เดินหน้าถอยหลังได้ทั้งสองทาง',
        P.tweenAt(400, 100, 0.5) === 250 && P.tweenAt(100, 400, 0.5) === 250);
}

// ═══════════ ปลายทาง: เมาส์อยู่ในพื้นที่เขียน ═══════════
{
  const r = at({ pointer: { x: 700, y: 400 }, inEditor: true });
  check('ไม่ใช่กรณีสำรอง', r.fallback === false);
  check('★ กึ่งกลางแถบตรงกับตำแหน่งเมาส์ (หลังหักมุม host แล้ว)',
        r.left + BAR.width / 2 + HOST.left === 700, r.left);
  check('★ แถบอยู่ "ใต้" เคอร์เซอร์ ไม่บังบรรทัดที่กำลังพิมพ์',
        r.top + HOST.top === 400 + P.FMTBAR_CURSOR_GAP, r.top);
  check('คืนเลขจำนวนเต็ม', Number.isInteger(r.left) && Number.isInteger(r.top));
}

// ═══════════ ปลายทาง: เมาส์อยู่นอกพื้นที่เขียน ═══════════
{
  const r = at({ pointer: { x: 5, y: 5 }, inEditor: false });
  check('เป็นกรณีสำรอง', r.fallback === true);
  check('★ กลางจอในแนวนอน', r.left + BAR.width / 2 + HOST.left === VP.width / 2, r.left);
  check('★ ต่ำกว่ากึ่งกลางจอตามที่ผู้ใช้ขอ',
        r.top + HOST.top === VP.height / 2 + P.FMTBAR_DROP, r.top);
  check('ระยะที่ต่ำกว่ากลางจออยู่ในช่วง 200–300px',
        P.FMTBAR_DROP >= 200 && P.FMTBAR_DROP <= 300, P.FMTBAR_DROP);
  check('ไม่มีตำแหน่งเมาส์เลย = ใช้กรณีสำรองเหมือนกัน',
        at({ pointer: null, inEditor: true }).fallback === true);
  check('พิกัดเมาส์เป็น NaN = ใช้กรณีสำรอง',
        at({ pointer: { x: NaN, y: 10 }, inEditor: true }).fallback === true);
}

// ═══════════ หนีบไม่ให้หลุดกรอบ ═══════════
{
  const rl = at({ pointer: { x: HOST.left + 4, y: 300 }, inEditor: true });
  check('เมาส์ชิดขอบซ้าย → แถบไม่ยื่นออกนอกกรอบ', rl.left >= 8, rl.left);
  const rr = at({ pointer: { x: HOST.left + HOST.width - 4, y: 300 }, inEditor: true });
  check('เมาส์ชิดขอบขวา → ขอบขวาแถบยังอยู่ในกรอบ',
        rr.left + BAR.width <= HOST.width - 8 + 0.001, rr.left);
  const rb = at({ pointer: { x: 700, y: HOST.top + HOST.height - 2 }, inEditor: true });
  check('เมาส์ชิดขอบล่าง → แถบไม่จมใต้กรอบ',
        rb.top + BAR.height <= HOST.height - 8 + 0.001, rb.top);
  const rt = at({ pointer: { x: 700, y: HOST.top - 500 }, inEditor: true });
  check('เมาส์เหนือกรอบ → ดันลงมาในกรอบ', rt.top >= 8, rt.top);

  // ★ ที่ว่างแคบกว่าตัวแถบ (แผงข้างกินพื้นที่จนเหลือนิดเดียว) — ต้องไม่ได้ค่าติดลบ
  const narrow = P.fmtBarTarget({
    pointer: { x: 500, y: 400 }, inEditor: true,
    host: { left: 400, top: 100, width: 200, height: 60 }, bar: BAR, viewport: VP,
  });
  check('★ กรอบแคบกว่าแถบในแนวนอน → ชิดซ้าย ไม่ติดลบ', narrow.left === 8, JSON.stringify(narrow));
  check('แนวตั้งยังพอ → หนีบไว้ที่ขอบล่างของกรอบ', narrow.top === 60 - BAR.height - 8, narrow.top);
  const tiny = P.fmtBarTarget({
    pointer: { x: 500, y: 400 }, inEditor: true,
    host: { left: 400, top: 100, width: 200, height: 20 }, bar: BAR, viewport: VP,
  });
  check('★ กรอบเตี้ยกว่าตัวแถบ → ชิดบน ไม่ติดลบ',
        tiny.left === 8 && tiny.top === 8, JSON.stringify(tiny));

  check('ไม่ส่งอะไรมาเลยก็ยังคืนตัวเลขที่ใช้ได้', (() => {
    const r = P.fmtBarTarget();
    return Number.isFinite(r.left) && Number.isFinite(r.top) && r.fallback === true;
  })());
  check('ตั้งระยะกันขอบเองได้',
        P.fmtBarTarget({ pointer: { x: 0, y: 0 }, inEditor: true, host: HOST, bar: BAR,
                         viewport: VP, pad: 20 }).left === 20);
}

// ═══════════ [alpha.116 ข้อ 5] หนีบตำแหน่งกลับเข้ากรอบหลังย่อ/ขยายหน้าต่าง ═══════════
{
  const BAR = { width: 300, height: 40 };
  const BIG = { width: 1400, height: 800 };
  const SMALL = { width: 700, height: 400 };

  const inside = P.clampBarPos({ left: 100, top: 60 }, BAR, BIG);
  check('อยู่ในกรอบอยู่แล้ว → ไม่ขยับ',
        inside.left === 100 && inside.top === 60 && inside.moved === false,
        JSON.stringify(inside));

  // ★ เคสของผู้ใช้: ลากไปขวาสุดตอนขยายเต็มจอ แล้วย่อหน้าต่างกลับ
  const shrunk = P.clampBarPos({ left: 1050, top: 60 }, BAR, SMALL);
  check('★ ย่อหน้าต่างแล้วแถบหลุดขวา → ถูกดึงกลับเข้ากรอบ',
        shrunk.left === SMALL.width - BAR.width - 4 && shrunk.moved === true,
        JSON.stringify(shrunk));
  check('ค่าที่ถูกหนีบต้องรายงานว่า moved (ผู้เรียกจะได้บันทึกทับ)', shrunk.moved === true);

  const below = P.clampBarPos({ left: 20, top: 900 }, BAR, SMALL);
  check('หลุดขอบล่าง → ดึงขึ้นมาชิดขอบล่างของกรอบ',
        below.top === SMALL.height - BAR.height - 4, JSON.stringify(below));

  const neg = P.clampBarPos({ left: -80, top: -50 }, BAR, BIG);
  check('ค่าติดลบ → ชิดขอบซ้ายบน', neg.left === 4 && neg.top === 4, JSON.stringify(neg));

  // กรอบเล็กกว่าตัวแถบ — ห้ามได้ค่าติดลบ (บทเรียนข้อ 5)
  const tinyHost = P.clampBarPos({ left: 500, top: 500 }, BAR, { width: 120, height: 20 });
  check('★ กรอบเล็กกว่าแถบ → ชิดซ้ายบน ไม่ติดลบ',
        tinyHost.left === 4 && tinyHost.top === 4, JSON.stringify(tinyHost));

  check('ตั้งระยะกันขอบเองได้',
        P.clampBarPos({ left: -80, top: -80 }, BAR, BIG, 12).left === 12);
  check('ไม่ส่งอะไรมาเลยก็ยังคืนตัวเลขที่ใช้ได้', (() => {
    const r = P.clampBarPos();
    return Number.isFinite(r.left) && Number.isFinite(r.top);
  })());
}

// ═══════════ [alpha.117] ความจาง 3 ระดับ · ชิดขอบบน/ล่าง · ล็อก ═══════════
//
// ผู้ใช้เลือก "จาง" แทน "ย่อ" เพราะแถบต้องไม่หายไปทั้งอัน — เทสนี้จึงล็อกสองอย่าง:
// วนแล้ว **กลับมา 100% เสมอ** (นี่คือทางรีเซ็ต) และค่าที่อ่านจากดิสก์ที่พังไม่ทำให้แถบหาย
{
  check('มีสามระดับตามที่ผู้ใช้กำหนด (100 / 50 / 5)',
        P.FMTBAR_OPACITIES.map((v) => Math.round(v * 100)).join(',') === '100,50,5',
        P.FMTBAR_OPACITIES.join(','));
  check('★ วนครบรอบแล้วกลับมาชัดเต็ม (= รีเซ็ตในตัว)',
        P.nextOpacity(P.nextOpacity(P.nextOpacity(1))) === 1);
  check('ลำดับการวน 100 → 50 → 5',
        P.nextOpacity(1) === 0.5 && P.nextOpacity(0.5) === 0.05 && P.nextOpacity(0.05) === 1);
  check('ป้ายเปอร์เซ็นต์อ่านง่าย', P.opacityPercent(0.05) === 5 && P.opacityPercent(1) === 100);

  // ★ ค่าที่จำไว้พังแล้วห้ามทำให้แถบหายไปเลย
  check('★ ค่าพัง/ไม่มี → ชัดเต็ม ไม่ใช่ 0 (แถบต้องไม่หายไปทั้งอัน)',
        P.normalizeOpacity(0) === 1 && P.normalizeOpacity(-1) === 1
        && P.normalizeOpacity(undefined) === 1 && P.normalizeOpacity('x') === 1
        && P.normalizeOpacity(5) === 1);
  check('ค่ากลาง ๆ ถูกดึงเข้าระดับที่ใกล้ที่สุด',
        P.normalizeOpacity(0.45) === 0.5 && P.normalizeOpacity(0.1) === 0.05
        && P.normalizeOpacity(0.9) === 1);

  // ── ชิดขอบบน/ล่าง ──
  const BAR = { width: 300, height: 40 };
  const HOST = { width: 1000, height: 600 };
  const top = P.alignBarPos('top', { left: 120, top: 400 }, BAR, HOST);
  const bot = P.alignBarPos('bottom', { left: 120, top: 10 }, BAR, HOST);
  check('ชิดขอบบน = ชิดขอบจริง', top.top === 4, JSON.stringify(top));
  check('ชิดขอบล่าง = ชิดขอบล่างจริง', bot.top === 600 - 40 - 4, JSON.stringify(bot));
  check('★ แนวนอนไม่ขยับ (ผู้ใช้จัดซ้าย-ขวาไว้แล้ว)',
        top.left === 120 && bot.left === 120, top.left + '/' + bot.left);
  check('กรอบเตี้ยกว่าตัวแถบก็ไม่ได้ค่าติดลบ',
        P.alignBarPos('bottom', { left: 0 }, BAR, { width: 1000, height: 20 }).top === 4);
  // ★★ เคสที่ e2e จับได้จริง: แถบรูปแบบกว้างเกือบเท่าพื้นที่เขียน (ปุ่มยี่สิบกว่าตัว)
  // รอบแรกเขียนให้ผ่านตัวหนีบทั้งก้อน → กฎ "ที่ว่างแคบกว่าแถบ = ชิดซ้าย" ดีดมันไปซ้ายทุกครั้ง
  const wide = P.alignBarPos('bottom', { left: 200, top: 10 },
                             { width: 980, height: 40 }, { width: 1000, height: 600 });
  check('★★ แถบกว้างเกือบเท่ากรอบ → สั่งชิดขอบล่างแล้วแนวนอนต้องยังไม่ขยับ',
        wide.left === 200, JSON.stringify(wide));
  check('★★ ...และยังไปอยู่ขอบล่างจริง', wide.top === 600 - 40 - 4, JSON.stringify(wide));
  check('แถบกว้างเกินกรอบทั้งใบก็ไม่แตะแนวนอน',
        P.alignBarPos('top', { left: 120 }, { width: 2000, height: 40 },
                      { width: 900, height: 600 }).left === 120);
  check('สลับบน↔ล่าง', P.nextAlign('top') === 'bottom' && P.nextAlign('bottom') === 'top');
  // [alpha.118] ค่าเริ่มต้นเปลี่ยนจาก 'top' เป็น 'bottom' — ผู้ใช้ขอให้แถบเริ่มที่ขอบล่างกึ่งกลาง
  check('★ ค่าชิดขอบที่ไม่รู้จัก → ขอบล่าง (ค่าเริ่มต้นใหม่ของ alpha.118)',
        P.normalizeAlign('ไม่มี') === 'bottom' && P.normalizeAlign() === 'bottom');

  // ── สภาพรวม + รีเซ็ต ──
  const st = P.normalizeBarState({ opacity: 0.5, align: 'top', locked: 1 });
  check('อ่านสภาพที่จำไว้ได้ครบสามช่อง',
        st.opacity === 0.5 && st.align === 'top' && st.locked === true, JSON.stringify(st));
  const old = P.normalizeBarState({ left: 10, top: 20 });      // เลย์เอาต์รุ่นเก่า ไม่มีสามช่องนี้
  check('★ เลย์เอาต์เก่าที่ไม่มีสามช่องนี้ → ชัดเต็ม · ขอบล่าง · ไม่ล็อก',
        old.opacity === 1 && old.align === 'bottom' && old.locked === false, JSON.stringify(old));
  check('ไม่ส่งอะไรมาเลยก็ไม่พัง', P.normalizeBarState().opacity === 1);
  const rs = P.resetBarState();
  check('★ รีเซ็ต = ชัดเต็ม ปลดล็อก ขอบล่าง',
        rs.opacity === 1 && rs.locked === false && rs.align === 'bottom', JSON.stringify(rs));

  // ── [alpha.118] ตำแหน่งเริ่มต้น: กึ่งกลางแนวนอน ชิดขอบล่าง ──
  const dp = P.defaultBarPos(BAR, HOST);
  check('★ ค่าเริ่มต้นอยู่กึ่งกลางแนวนอนจริง',
        dp.left === Math.round((1000 - 300) / 2), JSON.stringify(dp));
  check('★ ค่าเริ่มต้นชิดขอบล่างจริง (ไม่ใช่มุมบนซ้ายแบบเดิม)',
        dp.top === 600 - 40 - 16, JSON.stringify(dp));
  const dpWide = P.defaultBarPos({ width: 980, height: 40 }, HOST);
  check('แถบกว้างเกือบเท่ากรอบ ยังไม่ได้ค่าติดลบ',
        dpWide.left >= 16, JSON.stringify(dpWide));
  const dpHuge = P.defaultBarPos({ width: 2000, height: 40 }, { width: 900, height: 600 });
  check('แถบกว้างเกินกรอบทั้งใบก็ไม่ได้ค่าติดลบ (หนีบไว้ที่ pad)',
        dpHuge.left === 16, JSON.stringify(dpHuge));
  check('ไม่ส่งอะไรมาเลยก็ไม่พัง', Number.isFinite(P.defaultBarPos().left));
}

// ═══════════ [alpha.119] ออกจากเต็มจอแล้วแถบต้องไม่ล้นขอบบน/ขอบล่าง ═══════════
//
// ผู้ใช้: *"กด fullscreen แล้วย้ายตำแหน่ง หรือ reset ตำแหน่ง พอออกจาก fullscreen แถบล้นจอ"*
// ตัวเลขล้วน ๆ ของเคสนี้: จำตำแหน่งตอนกรอบสูง แล้วกรอบเตี้ยลง → ต้องถูกดันขึ้นมาให้เห็นครบทั้งแถบ
{
  const BAR = { width: 300, height: 40 };
  const FULL = { width: 1400, height: 900 };     // ตอนเต็มจอ
  const WIN  = { width: 1400, height: 600 };     // หลังออกจากเต็มจอ

  // ★ เคสตรงของผู้ใช้: ชิดขอบล่างตอนเต็มจอ (856) แล้วออกจากเต็มจอ
  const bottomFull = P.alignBarPos('bottom', { left: 400 }, BAR, FULL);
  check('[119] ชิดขอบล่างตอนเต็มจอได้ค่าที่ถูกต้องก่อน',
        bottomFull.top === 900 - 40 - 4, JSON.stringify(bottomFull));
  const afterExit = P.clampBarPos(bottomFull, BAR, WIN);
  check('[119] ★ ออกจากเต็มจอแล้วถูกดันขึ้นมาไม่ให้ล้นขอบล่าง',
        afterExit.top === 600 - 40 - 4 && afterExit.moved === true, JSON.stringify(afterExit));
  check('[119] ★ ทั้งตัวแถบอยู่ในกรอบจริง (ขอบล่างของแถบไม่เลยกรอบ)',
        afterExit.top + BAR.height <= WIN.height, JSON.stringify(afterExit));
  check('[119] แนวนอนไม่ถูกขยับตามโดยไม่จำเป็น', afterExit.left === 400);

  // ── กรอบที่ "มองเห็นได้จริง" ไม่จำเป็นต้องเริ่มที่ (0,0) ──
  const box = P.visibleHostBox({ left: 220, top: 40, width: 1180, height: 900 },
                               { width: 1400, height: 600 });
  check('[119] ★ host สูงเลยขอบล่างหน้าต่าง → กรอบที่มองเห็นถูกตัดที่ขอบจอ',
        box.bottom === 560 && box.top === 0, JSON.stringify(box));
  const clipped = P.clampBarInBox({ left: 400, top: 856 }, BAR, box);
  check('[119] ★ หนีบเข้ากรอบที่มองเห็น ไม่ใช่ทั้ง host (ไม่งั้นยังจมใต้ขอบจอ)',
        clipped.top === 560 - 40 - 4, JSON.stringify(clipped));

  const pushed = P.visibleHostBox({ left: 0, top: -120, width: 1000, height: 900 },
                                  { width: 1000, height: 600 });
  check('[119] host ถูกดันขึ้นเหนือขอบบน → กรอบที่มองเห็นเริ่มที่ 120',
        pushed.top === 120 && pushed.bottom === 720, JSON.stringify(pushed));
  const up = P.clampBarInBox({ left: 10, top: 0 }, BAR, pushed);
  check('[119] ★ แถบที่อยู่เหนือขอบจอถูกดันลงมาให้เห็น',
        up.top === 124 && up.moved === true, JSON.stringify(up));

  check('[119] ไม่รู้ขนาดหน้าต่าง → เชื่อ host ทั้งก้อน (พฤติกรรมเดิม)',
        (() => { const b = P.visibleHostBox({ left: 0, top: 0, width: 800, height: 500 }, null);
                 return b.right === 800 && b.bottom === 500; })());
  check('[119] clampBarPos ยังให้ผลเดิมเป๊ะหลังเปลี่ยนไปใช้ clampBarInBox',
        (() => { const a = P.clampBarPos({ left: 1050, top: 900 }, BAR, { width: 700, height: 400 });
                 return a.left === 700 - 300 - 4 && a.top === 400 - 40 - 4 && a.moved === true; })());
  check('[119] ไม่ส่งอะไรมาเลยก็ยังคืนตัวเลขที่ใช้ได้',
        Number.isFinite(P.clampBarInBox().left) && Number.isFinite(P.visibleHostBox().left));
}

check('เวลาเคลื่อนที่อยู่ในช่วงที่รู้สึกว่า "ลื่นแต่ไม่อืด"',
      P.FMTBAR_TWEEN_MS >= 200 && P.FMTBAR_TWEEN_MS <= 700, P.FMTBAR_TWEEN_MS);


// ═══════ [alpha.151 ข้อ 5] ★★ อยู่ในกรอบยังไม่พอ — ต้องอยู่ใน "หน้าต่าง" ด้วย ═══════
//
// ผู้ใช้: *"comment ใช้จาก float bar ไม่ได้ แต่ใช้จาก menu ได้"*
// เปิดแผงกระดานแล้ว #content หดจนแคบกว่าแถบ · ของเดิมปักไว้ที่ขอบซ้ายของ #content
// ซึ่งอยู่ค่อนไปทางขวาของจอ → ครึ่งขวาของแถบ (ปุ่มบันทึกความเห็น/ค้นหา) ยื่นออกนอกจอ
{
  const WIDE = { width: 1200, height: 36 };
  const VP2 = { width: 1440, height: 900 };
  // #content ถูกแผงกระดานเบียดไปอยู่ทางขวา เหลือกว้าง 300
  const SQUEEZED = { left: 1100, top: 90, width: 300, height: 700 };
  const r = P.fmtBarTarget({ pointer: { x: 1200, y: 400 }, inEditor: true,
                             host: SQUEEZED, bar: WIDE, viewport: VP2 });
  const winL = r.left + SQUEEZED.left;
  check('★★ กรอบแคบกว่าแถบ → ขอบซ้ายของแถบยังอยู่ในจอ', winL >= 0, winL);
  check('★★ และขอบขวาก็ยังอยู่ในจอ (ปุ่มท้ายแถบกดได้จริง)',
        winL + WIDE.width <= VP2.width, winL + WIDE.width);

  // แนวตั้งก็เหมือนกัน — กรอบเตี้ยที่วางไว้ค่อนล่างจอ ต้องไม่ดันแถบลงไปใต้ขอบจอ
  const LOW = { left: 20, top: 700, width: 1400, height: 60 };
  const r2 = P.fmtBarTarget({ host: LOW, bar: { width: 400, height: 300 }, viewport: VP2 });
  const winT = r2.top + LOW.top;
  check('★ แถบสูงในกรอบที่อยู่ค่อนล่างจอ → ยังอยู่ในจอทั้งใบ',
        winT >= 0 && winT + 300 <= VP2.height, winT + ' + 300 / ' + VP2.height);

  // กรณีปกติ (กรอบกว้างพอ) ต้องไม่ถูกกฎใหม่แตะเลย
  const plain = P.fmtBarTarget({ pointer: { x: 700, y: 300 }, inEditor: true,
                                 host: HOST, bar: BAR, viewport: VP });
  check('★ กรอบกว้างพอ → กฎกันล้นจอไม่เปลี่ยนผลลัพธ์เดิม (ยังกึ่งกลางที่เมาส์)',
        Math.abs(plain.left + BAR.width / 2 + HOST.left - 700) < 1, JSON.stringify(plain));

  // จอเล็กกว่าตัวแถบเอง = ยัดยังไงก็ล้น → อย่าไปขยับมันมั่ว ปล่อยตามกรอบเดิม
  const tinyVp = P.fmtBarTarget({ host: HOST, bar: { width: 2000, height: 36 },
                                  viewport: { width: 900, height: 600 } });
  check('จอเล็กกว่าแถบ → ไม่พยายามยัด (คืนค่าตามกรอบเดิม ไม่ติดลบมั่ว)',
        Number.isFinite(tinyVp.left) && tinyVp.left === 8, JSON.stringify(tinyVp));
}


// ═══════ [alpha.151 ข้อ 5] barClampBox — แถบใหญ่กว่ากรอบ ให้หนีบกับหน้าต่างแทน ═══════
{
  const VP3 = { width: 1440, height: 900 };
  // #content ถูกแผงกระดานเบียดไปอยู่ทางขวา เหลือกว้าง 300 · แถบกว้าง 1400
  const SQ = { left: 1100, top: 90, width: 300, height: 700 };
  const box = P.barClampBox(SQ, { width: 1400, height: 36 }, VP3);
  check('★★ แกนนอน: แถบกว้างกว่ากรอบ → กรอบหนีบขยายเป็นความกว้างของหน้าต่าง',
        box.left === -1100 && box.right === 340, JSON.stringify(box));
  check('★ แกนตั้งยังใช้กฎเดิม (แถบเตี้ยกว่ากรอบ ไม่ต้องแตะ)',
        box.top === 0 && box.bottom === 700, JSON.stringify(box));
  // หนีบจริงแล้วต้องอยู่ในจอทั้งใบ
  const c = P.clampBarInBox({ left: 8, top: 100 }, { width: 1400, height: 36 }, box);
  check('★★ หนีบแล้วขอบขวาของแถบอยู่ในจอ (ปุ่มท้ายแถบกดได้)',
        c.left + SQ.left >= 0 && c.left + SQ.left + 1400 <= VP3.width,
        (c.left + SQ.left) + '..' + (c.left + SQ.left + 1400));

  // กรอบกว้างพอ → ต้องได้ผลเท่ากับ visibleHostBox เป๊ะ (กฎใหม่ไม่รั่วไปเคสปกติ)
  const wide = { left: 260, top: 90, width: 1000, height: 700 };
  check('★ กรอบกว้างพอ → เหมือน visibleHostBox ทุกประการ',
        JSON.stringify(P.barClampBox(wide, { width: 520, height: 36 }, VP3))
        === JSON.stringify(P.visibleHostBox(wide, VP3)));
  check('ไม่รู้ขนาดหน้าต่าง → ไม่เดา ใช้กฎเดิม',
        JSON.stringify(P.barClampBox(wide, { width: 5000, height: 36 }, {}))
        === JSON.stringify(P.visibleHostBox(wide, {})));
  check('เรียกเปล่า ๆ ก็ไม่พัง', (() => {
    const r = P.barClampBox();
    return Number.isFinite(r.left) && Number.isFinite(r.right);
  })());
  // แกนตั้ง: กรอบเตี้ยกว่าแถบ → ขยายเป็นความสูงของหน้าต่าง
  const short = { left: 20, top: 600, width: 1400, height: 80 };
  const bv = P.barClampBox(short, { width: 400, height: 300 }, VP3);
  check('★ แกนตั้ง: แถบสูงกว่ากรอบ → หนีบกับความสูงของหน้าต่างแทน',
        bv.top === -600 && bv.bottom === 300, JSON.stringify(bv));
}

console.log(`\nfmtbar-pos: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
