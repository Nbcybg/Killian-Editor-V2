// test/session-core.test.cjs — [alpha.79] "จำทุกอย่างล่าสุด"
// กฎเหล็ก: migrateSession **ห้าม throw** ไม่ว่าไฟล์จะเสียแค่ไหน — กู้ไม่ได้ยังดีกว่าเปิดโปรแกรมไม่ขึ้น
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_sesscore.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/session/session-core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const S = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ newSession / migrate ═══════════
{
  const s = S.newSession('C:/งาน/นิยาย');
  check('เซสชันเปล่ามีครบทุกส่วน',
        S.SESSION_PARTS.every((k) => s[k] !== undefined), JSON.stringify(Object.keys(s)));
  check('รุ่นถูกต้อง', s.v === S.SESSION_VERSION && S.SESSION_VERSION >= 2);
  check('เก็บ root', s.root === 'C:/งาน/นิยาย');

  // ห้าม throw ไม่ว่าจะโยนอะไรเข้ามา
  let threw = false;
  for (const bad of [null, undefined, 0, '', 'ข้อความมั่ว', [], NaN, { tabs: 5 }, { panels: 'x' },
                     { tabs: { open: [1, 2, null] } }, { win: 'ไม่ใช่กล่อง' }]) {
    try { S.migrateSession(bad); } catch { threw = true; }
  }
  check('migrateSession ไม่ throw กับค่าเสียทุกแบบ', !threw);
  check('ค่าเสีย → ได้เซสชันเปล่าที่ใช้ได้', S.migrateSession('ขยะ').tabs.open.length === 0);
  check('ทิ้งรายการที่ไม่ใช่ข้อความ',
        S.migrateSession({ tabs: { open: ['a.md', 5, null, 'b.md'] } }).tabs.open.length === 2);

  // รุ่น 1 เก็บแท็บเป็น array ตรง ๆ
  check('อ่านรูปแบบรุ่นเก่า (tabs เป็น array)',
        S.migrateSession({ tabs: ['x.md', 'y.md'] }).tabs.open.length === 2);

  check('active ที่ไม่อยู่ในรายการเปิด → ล้างทิ้ง',
        S.migrateSession({ tabs: { open: ['a.md'], active: 'z.md' } }).tabs.active === '');
  check('active ที่อยู่ในรายการ → คงไว้',
        S.migrateSession({ tabs: { open: ['a.md'], active: 'a.md' } }).tabs.active === 'a.md');
  check('จำกัดจำนวนแท็บ (กันไฟล์บวม)',
        S.migrateSession({ tabs: { open: Array.from({ length: 500 }, (_, i) => 'f' + i) } })
          .tabs.open.length === 200);
}

// ═══════════ กล่องหน้าต่าง ═══════════
{
  check('กล่องปกติผ่าน',
        JSON.stringify(S.normalizeWin({ x: 10, y: 20, w: 1200, h: 800 }))
          === JSON.stringify({ x: 10, y: 20, w: 1200, h: 800, max: false }));
  check('ขนาดเล็กเกินจริง = ทิ้ง', S.normalizeWin({ x: 0, y: 0, w: 10, h: 10 }) === null);
  check('ขนาดใหญ่เกินจริง = ทิ้ง', S.normalizeWin({ w: 999999, h: 999999 }) === null);
  check('ไม่มีขนาด = ทิ้ง', S.normalizeWin({ x: 5, y: 5 }) === null);
  check('ค่าที่ไม่ใช่ตัวเลข = ทิ้ง', S.normalizeWin({ w: 'กว้าง', h: 'สูง' }) === null);
  check('null/undefined = null', S.normalizeWin(null) === null && S.normalizeWin() === null);
  check('พิกัดติดลบใช้ได้ (จอที่สอง)', S.normalizeWin({ x: -1800, y: 40, w: 1000, h: 700 }).x === -1800);
  check('เก็บสถานะขยายเต็มจอ', S.normalizeWin({ w: 900, h: 700, max: true }).max === true);
}

// ═══════════ merge ═══════════
{
  const base = S.migrateSession({ root: 'R', tabs: { open: ['a.md'], active: 'a.md' },
                                  ui: { zoom: 1.2 }, win: { w: 900, h: 700 } });
  const m = S.mergeSession(base, { win: { x: 0, y: 0, w: 1400, h: 900 } });
  check('patch ส่วนเดียว: ส่วนอื่นคงเดิม',
        m.tabs.open[0] === 'a.md' && m.ui.zoom === 1.2, JSON.stringify(m));
  check('patch ส่วนเดียว: ส่วนที่ส่งมาเปลี่ยนจริง', m.win.w === 1400);
  check('patch ว่าง = ไม่เปลี่ยนอะไร', S.sameSession(S.mergeSession(base, null), base));
  check('patch ทับ tabs แบบผสม (คง scroll เดิม)', (() => {
    const b2 = S.mergeSession(base, { tabs: { scroll: { 'a.md': 120 } } });
    const b3 = S.mergeSession(b2, { tabs: { active: 'a.md' } });
    return b3.tabs.scroll['a.md'] === 120 && b3.tabs.open[0] === 'a.md';
  })());
  check('merge บนค่าเสียก็ไม่พัง', S.mergeSession('ขยะ', { ui: { zoom: 2 } }).ui.zoom === 2);
  check('root ว่างใน patch ไม่ล้าง root เดิม', S.mergeSession(base, { root: '' }).root === 'R');
}

// ═══════════ sessionKey — ต้องเสถียร ═══════════
{
  const a = S.sessionKey('C:/งาน/นิยายเรื่องแรก');
  check('รันซ้ำได้ชื่อเดิม', a === S.sessionKey('C:/งาน/นิยายเรื่องแรก'));
  check('ไม่สนสแลชท้าย', a === S.sessionKey('C:/งาน/นิยายเรื่องแรก/'));
  check('ไม่สนตัวพิมพ์เล็กใหญ่ (Windows)',
        S.sessionKey('C:/Work/Novel') === S.sessionKey('c:/work/novel'));
  check('คนละโปรเจกต์ = คนละคีย์', a !== S.sessionKey('C:/งาน/นิยายเรื่องสอง'));
  check('root ว่าง = default', S.sessionKey('') === 'default' && S.sessionKey(null) === 'default');
  check('ชื่อไฟล์ปลอดภัย (ไม่มีอักขระต้องห้ามของ Windows)',
        !/[<>:"/\\|?*]/.test(S.sessionKey('C:/a b/c:d?e')), S.sessionKey('C:/a b/c:d?e'));
  check('มีชื่อโฟลเดอร์ติดมาให้อ่านออก', /นิยายเรื่องแรก/.test(a), a);
  check('คีย์ไม่ยาวเกินไป', S.sessionKey('C:/' + 'ก'.repeat(300)).length < 60);
}

// ═══════════ sameSession / isStale / prune ═══════════
{
  const a = S.migrateSession({ root: 'R', tabs: { open: ['a.md'] }, ts: 111 });
  const b = S.migrateSession({ root: 'R', tabs: { open: ['a.md'] }, ts: 999 });
  check('ต่างแค่เวลา = ถือว่าเหมือนกัน (ข้ามการเขียนไฟล์)', S.sameSession(a, b));
  check('เนื้อหาต่าง = ไม่เหมือน',
        !S.sameSession(a, S.migrateSession({ root: 'R', tabs: { open: ['b.md'] } })));
  check('เทียบกับค่าเสียก็ไม่พัง', S.sameSession('x', 'y') === true);

  const now = 1000 * 86400000;
  check('เก่าเกิน 90 วัน = เก่า', S.isStale({ ts: now - 100 * 86400000 }, now, 90) === true);
  check('ยังไม่เกิน = ไม่เก่า', S.isStale({ ts: now - 10 * 86400000 }, now, 90) === false);
  check('ไม่มีเวลา = ไม่ถือว่าเก่า', S.isStale({}, now, 90) === false);
  check('now ไม่ถูกต้อง = ไม่ถือว่าเก่า', S.isStale({ ts: 1 }, NaN, 90) === false);

  const p = S.pruneTabs({ tabs: { open: ['a.md', 'b.md', 'c.md'], active: 'b.md',
                                  scroll: { 'a.md': 1, 'b.md': 2, 'c.md': 3 } } }, ['a.md', 'c.md']);
  check('ไฟล์ที่หายไปหลุดออกจากเซสชัน', p.tabs.open.join() === 'a.md,c.md');
  check('scroll ของไฟล์ที่หายไปถูกลบด้วย', p.tabs.scroll['b.md'] === undefined && p.tabs.scroll['c.md'] === 3);
  check('active ที่หายไป → เลื่อนไปแท็บแรกที่ยังอยู่', p.tabs.active === 'a.md');
  check('ไม่เหลือไฟล์เลย = active ว่าง', S.pruneTabs(p, []).tabs.active === '');

  const sum = S.sessionSummary({ tabs: { open: ['a', 'b'], active: 'a' }, panels: { layout: {} }, split: { x: 1 } });
  check('สรุปนับถูก', sum.tabs === 2 && sum.hasPanels && sum.hasSplit && sum.active === 'a',
        JSON.stringify(sum));
}

console.log(`\nsession-core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
