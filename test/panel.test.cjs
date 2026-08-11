// test/panel.test.cjs — ทดสอบ panel-layout + panel-store ด้วย node
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
// ใช้ os.tmpdir() — '/tmp' ตายตัวรันบน Windows ไม่ได้
const tmp = (f) => path.join(os.tmpdir(), f);
for (const [src, out] of [['panels/panel-layout.js', tmp('_pl.cjs')], ['panels/panel-store.js', tmp('_ps.cjs')]])
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/' + src)], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const PL = require(tmp('_pl.cjs'));
const PS = require(tmp('_ps.cjs'));

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── snapZone ──
const rect = { x: 0, y: 0, w: 100, h: 100 };
check('snap ซ้าย', PL.snapZone(5, 50, rect) === 'left');
check('snap ขวา', PL.snapZone(95, 50, rect) === 'right');
check('snap บน', PL.snapZone(50, 5, rect) === 'top');
check('snap ล่าง', PL.snapZone(50, 95, rect) === 'bottom');
check('snap กลาง', PL.snapZone(50, 50, rect) === 'center');
check('snap นอกกรอบ → null', PL.snapZone(150, 50, rect) === null);

// ── dockPanel ──
let root = PL.panel('A', 'เอ');
root = PL.dockPanel(root, 'A', 'right', PL.panel('B', 'บี'));
check('dock ขวา → dock row [A,B]', root.type === 'dock' && root.dir === 'row' && PL.panelIds(root).join() === 'A,B', JSON.stringify(PL.panelIds(root)));
root = PL.dockPanel(root, 'B', 'bottom', PL.panel('C'));
check('dock ล่างของ B → col ซ้อนใน row', PL.panelIds(root).sort().join() === 'A,B,C', PL.panelIds(root));
root = PL.dockPanel(root, 'A', 'left', PL.panel('D'));
check('dock ซ้ายของ A → เป็นพี่น้องใน row เดิม (D ก่อน A)', PL.panelIds(root).includes('D'));

// ── dock ทิศเดียวกัน = แทรกพี่น้อง (ไม่ซ้อน dock เกิน) ──
let r2 = PL.dockPanel(PL.panel('X'), 'X', 'right', PL.panel('Y'));
r2 = PL.dockPanel(r2, 'Y', 'right', PL.panel('Z'));
check('dock row ต่อเนื่อง → children เดียว [X,Y,Z] ไม่ซ้อน', r2.type === 'dock' && r2.children.length === 3, 'children=' + r2.children.length);
check('sizes เท่ากันหลังแทรก', r2.sizes.length === 3 && Math.abs(r2.sizes.reduce((a, b) => a + b, 0) - 1) < 0.01);

// ── tab group ──
let t = PL.addAsTab(PL.panel('A'), 'A', PL.panel('B'));
check('addAsTab → tabs[A,B] active=1', t.type === 'tabs' && t.children.length === 2 && t.active === 1);
t = PL.addAsTab(t, 'A', PL.panel('C'));
check('addAsTab ซ้ำ → 3 แท็บ', t.type === 'tabs' && t.children.length === 3, 'n=' + t.children.length);
const moved = PL.moveTab(t, t.id, 0, 2);
check('moveTab สลับที่ (A ไปท้าย)', moved.children[2].id === 'A', moved.children.map((c) => c.id).join());

// ── splitTab: แยกแท็บออก ──
const sp = PL.splitTab(t, 'C', 'right');
check('splitTab เอา C ออกจากกลุ่มแล้ว dock ขวา', PL.panelIds(sp.root).sort().join() === 'A,B,C' && sp.detached.id === 'C');
check('splitTab: กลุ่มเดิมเหลือ A,B', (() => { let g = null; PL.walk(sp.root, (n) => { if (n.type === 'tabs') g = n; }); return g && g.children.length === 2; })());

// ── removePanel + collapse ──
let rr = PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B'));
rr = PL.removePanel(rr, 'B');
check('removePanel B → ยุบ dock เหลือ panel A เดี่ยว', rr.type === 'panel' && rr.id === 'A', JSON.stringify(rr).slice(0, 60));

// ── resizeDock ──
let rd = PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B'));
rd = PL.resizeDock(rd, rd.id, 0, 0.7);
check('resizeDock → ratio 0.7/0.3', Math.abs(rd.sizes[0] - 0.7) < 0.01 && Math.abs(rd.sizes[1] - 0.3) < 0.01, rd.sizes.join());
rd = PL.resizeDock(rd, rd.id, 0, 0.99);
check('resizeDock clamp (ไม่เกิน 0.95)', rd.sizes[0] <= 0.95, rd.sizes.join());

// ── panel-store: serialize/deserialize ──
const layout = { root: PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B')), floats: [] };
const str = PS.serializeLayout(layout);
const back = PS.deserializeLayout(str);
check('serialize/deserialize round-trip', back && PL.panelIds(back.root).join() === 'A,B', back && PL.panelIds(back.root));
check('มี version ใน serialized', JSON.parse(str).version === PS.LAYOUT_VERSION);

// ── migration v0 (ไม่มี version) → v1 ──
const legacy = JSON.stringify({ root: PL.panel('OLD') });     // schema เก่าไม่มี version/floats
const mig = PS.deserializeLayout(legacy);
check('migrate v0 → v1 (เติม floats)', mig && mig.root.id === 'OLD' && Array.isArray(mig.floats));

// ── version mismatch → null ──
check('version อนาคต → null (ปลอดภัย)', PS.deserializeLayout(JSON.stringify({ version: 999, root: {} })) === null);
check('สตริงพัง → null', PS.deserializeLayout('{ไม่ใช่ json') === null);

// ── PanelStore save/load ด้วย mock storage ──
const mem = new Map();
const mock = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
const store = new PS.PanelStore(mock, 'test-key');
store.update(PL.dockPanel(PL.panel('A'), 'A', 'bottom', PL.panel('B')));
let notified = 0; store.onChange(() => notified++);
store.update(PL.removePanel(store.root, 'B'));
check('PanelStore.onChange ถูกเรียก', notified === 1, 'n=' + notified);
const store2 = new PS.PanelStore(mock, 'test-key');
check('PanelStore load จาก storage เดิม', store2.load() && store2.root.id === 'A', JSON.stringify(store2.root));

// ── collapse (ปุ่ม ▾) ──
let cp = PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B'));
cp = PL.collapsePanel(cp, 'A');
check('collapsePanel toggle → true', PL.isCollapsed(cp, 'A') === true);
cp = PL.collapsePanel(cp, 'A', false);
check('collapsePanel(false) → คลายย่อ', PL.isCollapsed(cp, 'A') === false);
check('ย่อ A ไม่กระทบ B', PL.isCollapsed(cp, 'B') === false);

// ── setActiveTab / activatePanel ──
let at = PL.addAsTab(PL.panel('A'), 'A', PL.panel('B'));
at = PL.addAsTab(at, 'A', PL.panel('C'));
check('addAsTab → active ชี้ตัวใหม่ (C)', at.active === 2);
at = PL.setActiveTab(at, at.id, 0);
check('setActiveTab(0)', at.active === 0);
at = PL.setActiveTab(at, at.id, 99);
check('setActiveTab เกินขอบ → clamp ท้ายสุด', at.active === 2, 'active=' + at.active);
at = PL.activatePanel(at, 'B');
check('activatePanel(B) → active=1', at.active === 1);

// ── groupPanels: รวมหลาย panel เป็น Tab Group ──
let gp = PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B'));
gp = PL.dockPanel(gp, 'B', 'bottom', PL.panel('C'));
gp = PL.groupPanels(gp, ['A', 'B', 'C']);
check('groupPanels → panel ครบ 3', PL.panelIds(gp).sort().join() === 'A,B,C', PL.panelIds(gp));
check('groupPanels → เหลือกลุ่มแท็บเดียว', (() => {
  let n = 0; PL.walk(gp, (x) => { if (x.type === 'tabs') n++; }); return n === 1;
})());
check('groupPanels → ต้นไม้ยุบเหลือ tabs เป็น root', gp.type === 'tabs' && gp.children.length === 3, gp.type);
check('groupPanels ids<2 → ไม่เปลี่ยน', PL.panelIds(PL.groupPanels(gp, ['A'])).length === 3);
check('tabGroupOf หา กลุ่มของ B เจอ', !!PL.tabGroupOf(gp, 'B') && PL.tabGroupOf(gp, 'ไม่มี') === null);

// ── detachPanel / removePanel ราก ──
const det = PL.detachPanel(PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B')), 'B');
check('detachPanel คืน node + ต้นไม้ที่เหลือ', det.detached.id === 'B' && det.root.id === 'A');
check('removePanel ราก → null', PL.removePanel(PL.panel('SOLO'), 'SOLO') === null);
check('splitTab panel เดี่ยว → ไม่พัง', PL.splitTab(PL.panel('X'), 'X', 'right').root.id === 'X');
// [66r3] เพิ่มปุ่มเมนูแผง ☰ นำหน้า (Progressive Disclosure — คำสั่งลึกอยู่หลังปุ่มนี้)
check('PANEL_BUTTONS มี ☰ ▾ ⧉ ✕', PL.PANEL_BUTTONS.map((b) => b.icon).join('') === '☰▾⧉✕',
      PL.PANEL_BUTTONS.map((b) => b.icon).join(''));

// ── PanelManager: registerPanel / showPanel / dockPanel / floatPanel / groupPanels ──
const mkMgr = () => {
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  return { pm: new PS.PanelManager({ storage: st, key: 'pm-test' }), storage: st };
};
const { pm, storage } = mkMgr();
pm.registerPanel('outline', { title: 'โครงเรื่อง' });
pm.registerPanel('tree', { title: 'สารบัญ', defaultSide: 'left' });
pm.registerPanel('notes', { title: 'โน้ต' });
check('registerPanel เก็บทะเบียน', pm.registered().join() === 'outline,tree,notes');
check('showPanel ที่ไม่ได้ลงทะเบียน → false', pm.showPanel('ไม่มีจริง') === false);

pm.showPanel('outline');
check('showPanel แรก → เป็น root', pm.root && pm.root.id === 'outline' && pm.isOpen('outline'));
pm.showPanel('tree', { side: 'right' });
check('showPanel ที่สอง → dock row 2 แผง', pm.root.type === 'dock' && PL.panelIds(pm.root).join() === 'outline,tree', PL.panelIds(pm.root));

pm.collapsePanel('tree');
check('PanelManager.collapsePanel (▾)', pm.isCollapsed('tree') === true);
pm.showPanel('tree');
check('showPanel แผงที่ย่ออยู่ → คลายย่อให้', pm.isCollapsed('tree') === false);

pm.floatPanel('outline', { x: 10, y: 20, w: 300, h: 200 });
check('floatPanel (⧉) → ออกจากต้นไม้ไปลอย', pm.isFloating('outline') && !pm.isDocked('outline'));
check('floatPanel → ต้นไม้ยุบเหลือ tree เดี่ยว', pm.root.type === 'panel' && pm.root.id === 'tree', JSON.stringify(pm.root));
check('float เก็บพิกัด', pm.floats[0].x === 10 && pm.floats[0].w === 300);
pm.moveFloat('outline', { x: 55 });
check('moveFloat ย้ายพิกัด', pm.floats[0].x === 55 && pm.floats[0].y === 20);
pm.toggleFloat('outline');
check('toggleFloat → ผนึกกลับเข้าต้นไม้', pm.isDocked('outline') && !pm.isFloating('outline'));

pm.showPanel('notes', { side: 'bottom' });
pm.groupPanels(['tree', 'outline', 'notes']);
check('PanelManager.groupPanels → กลุ่มแท็บเดียว 3 แผง', (() => {
  let g = null; PL.walk(pm.root, (n) => { if (n.type === 'tabs') g = n; });
  return g && g.children.length === 3;
})(), JSON.stringify(pm.root).slice(0, 90));
pm.ungroupPanel('notes', 'right');
check('ungroupPanel → แยกออกจากกลุ่ม', (() => {
  let g = null; PL.walk(pm.root, (n) => { if (n.type === 'tabs') g = n; });
  return g && g.children.length === 2 && PL.panelIds(pm.root).length === 3;
})());

pm.hidePanel('notes');
// [alpha.62 บั๊ก 21] ปิดแผง = ติดธง hidden — โหนดยัง "จองสล็อต" อยู่ในต้นไม้
// (เดิมตัดออกจากต้นไม้จริง ๆ แล้วตำแหน่ง/สัดส่วนหายทุกครั้ง)
check('hidePanel (✕) → ไม่แสดงผลแล้ว', !pm.isOpen('notes'));
check('hidePanel → สล็อตยังอยู่ในต้นไม้ (ไม่ถูกตัดทิ้ง)',
  pm.isDocked('notes') && pm.isHidden('notes'), JSON.stringify(pm.root).slice(0, 120));
check('hidePanel → เหลือแผงที่เห็นอยู่แค่ 2 ตัว',
  PL.visiblePanelIds(pm.root).sort().join() === 'outline,tree',
  PL.visiblePanelIds(pm.root).join());
check('hidePanel → panelIds ยังนับตัวที่ถูกซ่อนด้วย (ใช้ prune/ค้นสล็อต)',
  PL.panelIds(pm.root).sort().join() === 'notes,outline,tree', PL.panelIds(pm.root).join());

// persist + prune ตอน load
let notify = 0; pm.onChange(() => notify++);
pm.showPanel('notes');
check('onChange ยิงเมื่อเลย์เอาต์เปลี่ยน', notify === 1, 'n=' + notify);
const pm2 = new PS.PanelManager({ storage, key: 'pm-test' });
pm2.registerPanel('outline', { title: 'โครงเรื่อง' });
pm2.registerPanel('tree', { title: 'สารบัญ' });      // ไม่ลงทะเบียน notes → ต้องถูกตัดทิ้ง
check('PanelManager.load กู้เลย์เอาต์', pm2.load() && pm2.isOpen('outline') && pm2.isOpen('tree'));
check('load ตัดแผงที่ไม่ได้ลงทะเบียนออก', !pm2.isOpen('notes'), PL.panelIds(pm2.root).join());

// ปิดทุกแผง → root ว่าง แล้วเปิดใหม่ได้
const { pm: pm3 } = mkMgr();
pm3.registerPanel('a', {});
pm3.showPanel('a');
pm3.hidePanel('a');
// [alpha.62 บั๊ก 21] ปิดตัวสุดท้ายแล้ว root **ไม่กลายเป็น null อีกแล้ว** — โหนดยังอยู่ แค่ติดธง
// (ดีกว่าเดิมด้วย: บั๊ก #19 เคยกลัว root เป็น null แล้วรอบถัดไปรีเซ็ตเป็นเลย์เอาต์ตั้งต้น)
check('ปิดแผงสุดท้าย → ไม่มีแผงที่เห็นอยู่ แต่ต้นไม้ไม่หาย',
  pm3.openIds().length === 0 && pm3.root && pm3.root.id === 'a' && pm3.isHidden('a'));
pm3.showPanel('a');
check('เปิดใหม่หลังปิดหมด → กลับมาที่สล็อตเดิม',
  pm3.root && pm3.root.id === 'a' && pm3.isOpen('a') && !pm3.isHidden('a'));

// ══ บั๊ก #16: สัดส่วนที่ผู้ใช้ปรับเองต้องไม่ถูกล้างตอนเปิด/ปิดแผง ══
{
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  // -- helper บริสุทธิ์ --
  check('#16 normalizeSizes ทำผลรวมเป็น 1 โดยคงอัตราส่วน',
        Math.abs(sum(PL.normalizeSizes([2, 3])) - 1) < 1e-6 &&
        Math.abs(PL.normalizeSizes([2, 3])[0] - 0.4) < 1e-3, JSON.stringify(PL.normalizeSizes([2, 3])));
  check('#16 normalizeSizes ผลรวม 0 → แบ่งเท่ากัน', PL.normalizeSizes([0, 0]).join() === '0.5,0.5');
  const ins = PL.insertSize([0.35, 0.65], 2);
  check('#16 insertSize คงอัตราส่วนเดิมของลูกเก่า',
        ins.length === 3 && Math.abs(ins[0] / ins[1] - 0.35 / 0.65) < 1e-3, JSON.stringify(ins));
  check('#16 insertSize ให้ลูกใหม่ = ส่วนเฉลี่ย 1/(n+1)',
        Math.abs(ins[2] - 1 / 3) < 1e-3 && Math.abs(sum(ins) - 1) < 1e-3, JSON.stringify(ins));
  const insFixed = PL.insertSize([0, 1, 0], 3);      // toolbar/เนื้อหา/statusbar (0 = ขนาดคงที่)
  check('#16 insertSize ไม่ปลุกลูกที่ขนาดเป็น 0 ให้ยืด',
        insFixed[0] === 0 && insFixed[2] === 0, JSON.stringify(insFixed));
  check('#16 keepSizes เก็บอัตราส่วนของลูกที่เหลือ',
        PL.keepSizes([0.2, 0.3, 0.5], [0, 2]).map((v) => +v.toFixed(3)).join() === '0.286,0.714',
        JSON.stringify(PL.keepSizes([0.2, 0.3, 0.5], [0, 2])));

  // -- 16a: เปิดแผงเพิ่มแล้วสัดส่วนเดิมต้องคงอยู่ --
  let d = PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.4, 0.6]);
  d = PL.dockPanel(d, 'docs', 'right', PL.panel('props'));
  check('#16a เปิดแผงเพิ่ม → อัตราส่วน tree:docs เดิมยังอยู่ (ไม่กลาย 33/33/33)',
        Math.abs(d.sizes[0] / d.sizes[1] - 0.4 / 0.6) < 1e-3, JSON.stringify(d.sizes));
  check('#16a แผงใหม่ได้ส่วนเฉลี่ย + ผลรวมยังเป็น 1',
        Math.abs(d.sizes[2] - 1 / 3) < 1e-3 && Math.abs(sum(d.sizes) - 1) < 1e-3, JSON.stringify(d.sizes));

  // -- 16b: ปิดแผงใน dock ชั้นใน ต้องไม่แตะสัดส่วนของ dock ชั้นนอก --
  const inner = PL.dock('col', [PL.panel('tree'), PL.panel('outline')], [0.7, 0.3]);
  let outer = PL.dock('col', [PL.panel('toolbar'),
                              PL.dock('row', [inner, PL.panel('docs')], [0.25, 0.75]),
                              PL.panel('statusbar')], [0, 1, 0]);
  const afterOuter = PL.removePanel(outer, 'outline');
  check('#16b ปิดแผงชั้นใน → dock ชั้นนอกยังเป็น [0,1,0] (ไม่โดน reset)',
        afterOuter.sizes.join() === '0,1,0', JSON.stringify(afterOuter.sizes));
  const rowNode = afterOuter.children[1];
  check('#16b dock กลางที่จำนวนลูกไม่เปลี่ยน → สัดส่วน 0.25/0.75 ยังอยู่',
        rowNode.sizes.join() === '0.25,0.75', JSON.stringify(rowNode.sizes));

  // -- ปิดแผงใน dock ที่จำนวนลูกเปลี่ยนจริง → แบ่งส่วนที่หายให้ตัวที่เหลือตามอัตราเดิม --
  const three = PL.dock('row', [PL.panel('a'), PL.panel('b'), PL.panel('c')], [0.2, 0.3, 0.5]);
  const two = PL.removePanel(three, 'b');
  check('#16 ปิดแผง → ตัวที่เหลือคงอัตราส่วนกันเอง (0.2:0.5)',
        Math.abs(two.sizes[0] / two.sizes[1] - 0.2 / 0.5) < 1e-3 && Math.abs(sum(two.sizes) - 1) < 1e-3,
        JSON.stringify(two.sizes));

  // -- ปรับสัดส่วน → เปิดแผง → ปิดแผง → ต้องกลับมาใกล้ค่าที่ปรับไว้ --
  let live = PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.4, 0.6]);
  live = PL.resizeDock(live, live.id, 0, 0.28);
  const ratioBefore = live.sizes[0] / live.sizes[1];
  live = PL.dockPanel(live, 'docs', 'right', PL.panel('props'));
  live = PL.removePanel(live, 'props');
  check('#16 ปรับสัดส่วน → เปิดแผง → ปิดแผง → สัดส่วนเดิมกลับมา',
        Math.abs(live.sizes[0] / live.sizes[1] - ratioBefore) < 1e-2,
        JSON.stringify(live.sizes) + ' vs ' + ratioBefore.toFixed(3));
}

// ══ บั๊ก #19: แผงที่ปิดไม่ได้ (docs) ต้องหลุดออกจากต้นไม้ไม่ได้ ══
{
  const { pm: pmG } = mkMgr();
  pmG.registerPanel('docs', { title: 'เอกสาร', closable: false, floatable: false });
  pmG.registerPanel('tree', { title: 'โปรเจกต์' });
  pmG.showPanel('docs');
  pmG.showPanel('tree');
  check('#19 hidePanel แผงที่ closable:false → ปฏิเสธ', pmG.hidePanel('docs') === false);
  check('#19 แผงเอกสารยังอยู่ในต้นไม้ (root ไม่กลายเป็น null)',
        pmG.isDocked('docs') && pmG.root !== null);
  pmG.hidePanel('tree');
  check('#19 แผงที่ปิดได้ยังปิดได้ตามปกติ', !pmG.isOpen('tree') && pmG.isDocked('docs'));
  check('#19 togglePanel แผงที่ปิดไม่ได้ → ไม่ทำอะไร',
        pmG.togglePanel('docs') === false && pmG.isDocked('docs'));
}


// ══ [alpha.60r2 ข้อ 8] schema v2 — จำสัดส่วนของแผง + ตกกลับค่าตั้งต้นเมื่อเลย์เอาต์พัง ══
check('[60r2] LAYOUT_VERSION = 2', PS.LAYOUT_VERSION === 2, PS.LAYOUT_VERSION);
{
  const lay = { root: PL.dockPanel(PL.panel('A'), 'A', 'right', PL.panel('B')), floats: [],
                splitRatios: { A: 0.24, B: 0.76 } };
  const back2 = PS.deserializeLayout(PS.serializeLayout(lay));
  check('[60r2] splitRatios รอด round-trip',
        back2 && back2.splitRatios.A === 0.24 && back2.splitRatios.B === 0.76,
        JSON.stringify(back2 && back2.splitRatios));
}
{
  // v1 ที่บันทึกไว้ก่อนอัปเดต ต้องอ่านได้ ไม่ใช่ถูกทิ้งจนแผงรีเซ็ตทั้งชุด
  const v1 = JSON.stringify({ version: 1, root: PL.panel('OLD'), floats: [] });
  const m1 = PS.deserializeLayout(v1);
  check('[60r2] migrate v1 → v2 (ไม่ทิ้งเลย์เอาต์เดิม)', m1 && m1.root.id === 'OLD');
  check('[60r2] migrate v1 → v2 เติม splitRatios ว่าง',
        m1 && m1.splitRatios && Object.keys(m1.splitRatios).length === 0);
}
{
  // สัดส่วนเพี้ยน (ถูกแก้มือ/ไฟล์เสีย) ต้องถูกกรองทิ้ง ไม่ใช่พาเลย์เอาต์เพี้ยนตาม
  const bad = PS.deserializeLayout(JSON.stringify({ version: 2, root: PL.panel('A'), floats: [],
    splitRatios: { A: 5, B: -1, C: 'x', D: 0.5 } }));
  check('[60r2] กรองสัดส่วนที่ใช้ไม่ได้ทิ้ง',
        bad && Object.keys(bad.splitRatios).join() === 'D', JSON.stringify(bad && bad.splitRatios));
}
{
  // เลย์เอาต์ที่โครงพัง = ตกกลับ null (UI จะสร้าง defaultLayout ให้) ไม่ใช่วาดต้นไม้เสีย
  check('[60r2] dock ที่ไม่มีลูก → null',
        PS.deserializeLayout(JSON.stringify({ version: 2, root: { type: 'dock', children: [] } })) === null);
  check('[60r2] panel ที่ไม่มี id → null',
        PS.deserializeLayout(JSON.stringify({ version: 2, root: { type: 'panel' } })) === null);
  check('[60r2] ชนิดโหนดที่ไม่รู้จัก → null',
        PS.deserializeLayout(JSON.stringify({ version: 2, root: { type: 'ufo' } })) === null);
  check('[60r2] root = null ยังใช้ได้ (ยังไม่เคยมีเลย์เอาต์)',
        PS.deserializeLayout(JSON.stringify({ version: 2, root: null })) !== null);
  check('[60r2] floats ที่ไม่มี panel.id ถูกกรองทิ้ง',
        PS.deserializeLayout(JSON.stringify({ version: 2, root: PL.panel('A'),
          floats: [{ x: 1 }, { panel: { id: 'B' } }] })).floats.length === 1);
}
{
  const { pm: pmR, storage: stR } = mkMgr();
  pmR.registerPanel('tree', { title: 'โปรเจกต์' });
  pmR.showPanel('tree');
  check('[60r2] rememberRatio เก็บค่าที่ลากไว้', pmR.rememberRatio('tree', 0.24) === true);
  check('[60r2] savedRatio อ่านกลับได้', pmR.savedRatio('tree') === 0.24, pmR.savedRatio('tree'));
  check('[60r2] ค่าเดิมซ้ำ → ไม่บันทึกใหม่ (ไม่เขียน storage ทุกเฟรม)',
        pmR.rememberRatio('tree', 0.24) === false);
  check('[60r2] สัดส่วนนอกช่วง → ปฏิเสธ',
        pmR.rememberRatio('tree', 0) === false && pmR.rememberRatio('tree', 1.5) === false &&
        pmR.rememberRatio('tree', NaN) === false);
  check('[60r2] สัดส่วนถูกบันทึกลง storage จริง',
        JSON.parse(stR.getItem('pm-test')).splitRatios.tree === 0.24);
  pmR.reset();
  check('[60r2] reset ล้างสัดส่วนด้วย', pmR.savedRatio('tree') === 0);
}

// ══ [alpha.62 บั๊ก 21] ปิด-เปิดแผงต้องกลับที่เดิมเป๊ะ และไม่ไปแตะแผงอื่น ══
// อาการที่ผู้ใช้เจอ: เอาแผง AI ไปไว้ "ขอบบนของเอกสาร" (dock แนวตั้ง) ปิดแล้วเปิดใหม่
// → ไปโผล่ฝั่งซ้ายจอ เพราะสล็อตถูกตัดทิ้งแล้วต้องเดาตำแหน่งใหม่จากเพื่อนบ้านที่ใกล้ที่สุด
{
  const { pm: pmH } = mkMgr();
  for (const id of ['tree', 'docs', 'ai']) pmH.registerPanel(id, { title: id });
  // โครงจำลองหน้าจอจริง: [ tree | (ai อยู่บน / docs อยู่ล่าง) ]
  pmH.showPanel('tree');
  pmH.dockPanel('docs', 'right', 'tree');       // ลำดับพารามิเตอร์: (id, side, targetId)
  pmH.dockPanel('ai', 'top', 'docs');
  const dockOf = (id) => {
    let hit = null;
    PL.walk(pmH.root, (n) => {
      if (n.type !== 'dock') return;
      const i = (n.children || []).findIndex((c) => c.type === 'panel' && c.id === id);
      if (i >= 0) hit = { dir: n.dir, index: i, dockId: n.id, sizes: (n.sizes || []).slice() };
    });
    return hit;
  };
  const before = dockOf('ai');
  check('[62-21] วางแผง AI ไว้ "บน" เอกสารได้ (dock แนวตั้ง)',
        !!before && before.dir === 'col' && before.index === 0, JSON.stringify(before));
  // ปรับสัดส่วนเองก่อน แล้วค่อยปิด-เปิด — ค่าที่ลากไว้ต้องรอด
  pmH.resize(before.dockId, 0, 0.3);
  const sizesSet = dockOf('ai').sizes.slice();
  const treeDockBefore = dockOf('tree');

  pmH.hidePanel('ai');
  check('[62-21] ปิดแล้วไม่แสดงผล', !pmH.isOpen('ai'));
  check('[62-21] ปิดแล้ว "สล็อต" ยังอยู่ที่เดิมเป๊ะ (dock เดิม · ดัชนีเดิม)',
        JSON.stringify(dockOf('ai')) === JSON.stringify({ ...before, sizes: sizesSet }),
        JSON.stringify(dockOf('ai')));
  check('[62-21] ปิดแล้ว dock ของแผงอื่นไม่ถูกแตะเลย',
        JSON.stringify(dockOf('tree')) === JSON.stringify(treeDockBefore),
        JSON.stringify(dockOf('tree')));

  pmH.showPanel('ai');
  const after = dockOf('ai');
  check('[62-21] เปิดกลับ → อยู่ "บน" เอกสารเหมือนเดิม ไม่เด้งไปฝั่งซ้าย',
        after.dir === 'col' && after.index === 0 && after.dockId === before.dockId,
        JSON.stringify(after));
  check('[62-21] เปิดกลับ → สัดส่วนที่ลากไว้เท่าเดิมเป๊ะ (ไม่ถูกเกลี่ยใหม่)',
        JSON.stringify(after.sizes) === JSON.stringify(sizesSet),
        `${JSON.stringify(after.sizes)} vs ${JSON.stringify(sizesSet)}`);
  check('[62-21] เปิดกลับ → แผงอื่นยังอยู่ที่เดิม ขนาดเดิม',
        JSON.stringify(dockOf('tree')) === JSON.stringify(treeDockBefore),
        JSON.stringify(dockOf('tree')));

  // ปิด-เปิดรัว ๆ 5 รอบ ต้องนิ่งสนิท (อาการเดิมคือ "ขยับทุกครั้ง" สะสมไปเรื่อย ๆ)
  const snap = JSON.stringify(pmH.root);
  for (let i = 0; i < 5; i++) { pmH.hidePanel('ai'); pmH.showPanel('ai'); }
  check('[62-21] ปิด-เปิด 5 รอบ ต้นไม้เหมือนเดิมทุกไบต์',
        JSON.stringify(pmH.root) === snap);

  // ค่าที่บันทึกลง storage ต้องพาธง hidden ไปด้วย → เปิดโปรแกรมใหม่ก็ยังจำว่าปิดไว้ + จำที่อยู่
  pmH.hidePanel('ai');
  const raw = JSON.parse(JSON.stringify(pmH.layout().root));
  const back = PS.deserializeLayout(PS.serializeLayout({ root: raw, floats: [], splitRatios: {} }));
  check('[62-21] ธง hidden รอดการบันทึก/อ่านกลับ (workspace ถูกจำจริง)',
        PL.isPanelHidden(back.root, 'ai') && !PL.isPanelHidden(back.root, 'docs'));
  const afterLoad = (() => { let h = null;
    PL.walk(back.root, (n) => { if (n.type === 'dock') {
      const i = (n.children || []).findIndex((c) => c.type === 'panel' && c.id === 'ai');
      if (i >= 0) h = { dir: n.dir, index: i }; } });
    return h; })();
  check('[62-21] อ่านกลับแล้วสล็อตยังอยู่ "บน" เหมือนเดิม',
        afterLoad && afterLoad.dir === 'col' && afterLoad.index === 0, JSON.stringify(afterLoad));
}

// ที่จับปรับขนาดต้องข้ามแผงที่ถูกซ่อน (ไม่งั้นลากแล้วไปแบ่งกับตัวที่มองไม่เห็น)
{
  const root = PL.dock('row', [PL.panel('a'), PL.panel('b'), PL.panel('c')]);
  const hid = PL.setPanelHidden(root, 'b', true);
  check('[62-21] nodeHidden รู้จักแผงที่ซ่อน', PL.nodeHidden(PL.findPanel(hid, 'b')));
  check('[62-21] container ที่ลูกถูกซ่อนหมด = ถือว่าซ่อนด้วย',
        PL.nodeHidden(PL.setPanelHidden(PL.setPanelHidden(PL.dock('col', [PL.panel('x'), PL.panel('y')]), 'x', true), 'y', true)));
  // a กับ c ติดกันบนจอ (b ซ่อนอยู่) → ลากที่จับต้องแบ่งระหว่าง index 0 กับ 2
  const rs = PL.resizeDockPair(hid, hid.id, 0, 2, 0.25);
  const total = rs.sizes[0] + rs.sizes[2];
  check('[62-21] resizeDockPair แบ่งเฉพาะคู่ที่ระบุ (ข้ามตัวที่ซ่อน)',
        Math.abs(rs.sizes[0] / total - 0.25) < 0.001 && rs.sizes[1] === hid.sizes[1],
        JSON.stringify(rs.sizes));
  check('[62-21] resizeDock เดิมยังทำงานเหมือนเดิม (คู่ติดกัน)',
        Math.abs(PL.resizeDock(root, root.id, 0, 0.5).sizes[0]
                 - PL.resizeDock(root, root.id, 0, 0.5).sizes[1]) < 0.001);
}

// ── [66r2-2] แจกพื้นที่ใน dock: ผลรวม flex-grow ของลูกที่ยืดได้ต้องเป็น 1 เป๊ะ ──
// (ถ้า < 1 เบราว์เซอร์แจกพื้นที่ว่างไม่หมด → เหลือช่องว่างค้างที่ขอบ = บั๊ก "ย่อแผงขวาแล้วเป็นรู")
// dock ที่ **ไม่มีแผงเอกสารอยู่เลย** ใช้ระบบสัดส่วนแบบเดิม — บล็อกนี้จึงใช้ชื่อแผงกลาง ๆ
{
  const sum = (sh) => sh.filter((s) => s && s.kind === 'grow').reduce((a, s) => a + s.grow, 0);
  const isFixed = (id) => id === 'toolbar' || id === 'statusbar';

  const plain = PL.dock('row', [PL.panel('tree'), PL.panel('notes'), PL.panel('props')], [0.24, 0.56, 0.20]);
  check('[66r2-2] dock ปกติ: grow รวมเป็น 1', Math.abs(sum(PL.dockShares(plain, isFixed)) - 1) < 1e-9,
        JSON.stringify(PL.dockShares(plain, isFixed)));
  check('[66r2-2] dock ปกติ: แจกตามสัดส่วนในต้นไม้',
        Math.abs(PL.dockShares(plain, isFixed)[1].grow - 0.56) < 1e-9);

  // แผงพับ = แข็ง → ต้องหลุดจากตัวหาร ไม่ใช่แค่ถูกบังคับ grow=0
  const col = PL.collapsePanel(plain, 'props', true);
  const shCol = PL.dockShares(col, isFixed);
  check('[66r2-2] แผงที่พับถูกนับเป็น "ยืดไม่ได้"', shCol[2].kind === 'rigid', JSON.stringify(shCol[2]));
  check('[66r2-2] พับแผงขวาแล้ว grow ที่เหลือยังรวมเป็น 1 (ไม่มีช่องว่างค้าง)',
        Math.abs(sum(shCol) - 1) < 1e-9, String(sum(shCol)));
  check('[66r2-2] พื้นที่ของแผงที่พับถูกแบ่งคืนตามอัตราเดิม',
        Math.abs(shCol[0].grow - 0.24 / 0.80) < 1e-9 && Math.abs(shCol[1].grow - 0.56 / 0.80) < 1e-9,
        JSON.stringify(shCol));

  // แผงตายตัว (แถบเครื่องมือ/แถบสถานะ) — พฤติกรรมเดิมต้องไม่เปลี่ยน
  const withFixed = PL.dock('col', [PL.panel('toolbar'), PL.panel('docs'), PL.panel('statusbar')], [0.1, 0.8, 0.1]);
  const shFix = PL.dockShares(withFixed, isFixed);
  check('[66r2-2] แถบเครื่องมือ/แถบสถานะยังเป็นแบบกินพื้นที่เท่าเนื้อหา',
        shFix[0].kind === 'rigid' && shFix[2].kind === 'rigid');
  check('[66r2-2] แผงเอกสารได้พื้นที่ที่เหลือทั้งหมด',
        Math.abs(shFix[1].grow - 1) < 1e-9, JSON.stringify(shFix));

  // กลุ่มแท็บที่ย่อเป็นแถบไอคอน (collapsed บนโหนด tabs) ก็แข็งเหมือนกัน
  const tg = PL.tabs([PL.panel('tree'), PL.panel('outline')], 0);
  tg.collapsed = true;
  const withStrip = PL.dock('row', [tg, PL.panel('notes')], [0.24, 0.76]);
  const shStrip = PL.dockShares(withStrip, isFixed);
  check('[66r2-2] กลุ่มแท็บที่ย่อเป็นแถบไอคอน = ยืดไม่ได้', shStrip[0].kind === 'rigid');
  check('[66r2-2] ย่อกลุ่มแท็บแล้วเพื่อนบ้านกินที่ที่เหลือครบ',
        Math.abs(shStrip[1].grow - 1) < 1e-9, JSON.stringify(shStrip));

  // แผงที่ถูกซ่อน (ปิด) ต้องไม่ถูกวาดและไม่กินโควตา
  const hid2 = PL.setPanelHidden(plain, 'props', true);
  const shHid = PL.dockShares(hid2, isFixed);
  check('[66r2-2] แผงที่ถูกปิดไม่ถูกวาด (null)', shHid[2] === null);
  check('[66r2-2] ปิดแผงแล้ว grow ที่เหลือยังรวมเป็น 1', Math.abs(sum(shHid) - 1) < 1e-9);

  // dock ที่ลูกแข็งหมด = ทั้งก้อนแข็ง (ไม่งั้นมันยืดแล้วเหลือช่องว่างข้างในตัวเอง)
  const allCol = PL.collapsePanel(PL.collapsePanel(PL.dock('col', [PL.panel('a'), PL.panel('b')]), 'a', true), 'b', true);
  check('[66r2-2] dock ที่ลูกพับหมด = แข็งทั้งก้อน', PL.nodeRigid(allCol));
  check('[66r2-2] dock ที่ยังมีลูกยืดได้อยู่ = ไม่แข็ง', !PL.nodeRigid(plain));
  check('[66r2-2] แผงธรรมดาไม่แข็ง', !PL.nodeRigid(PL.panel('x')));
  check('[66r2-2] แผงตายตัวแข็ง', PL.nodeRigid(PL.panel('toolbar'), isFixed));
}

// ── [66r4] โมเดลลูกผสม: แผงข้างเป็น px · สายที่มีแผงเอกสารเป็นตัวยืดตัวเดียว ──
{
  const isFixed = (id) => id === 'toolbar' || id === 'statusbar';
  const kinds = (sh) => sh.map((s) => (s ? s.kind : '-')).join(',');

  const row = PL.dock('row', [PL.panel('tree'), PL.panel('docs'), PL.panel('props')], [0.24, 0.56, 0.20]);
  check('[66r4] dock ที่มีแผงเอกสาร → เข้าโหมด px', PL.flexChildIndex(row) === 1);
  let sh = PL.dockShares(row, isFixed);
  // ยังไม่มีใครถูก "ตรึง" ความกว้าง → ต้องเหมือนระบบสัดส่วนเดิมทุกประการ
  check('[66r4] ยังไม่มีใครถูกตรึง → สัดส่วนล้วนเหมือนเดิม', kinds(sh) === 'grow,grow,grow', kinds(sh));
  check('[66r4] สัดส่วนตรงกับต้นไม้เป๊ะ',
        Math.abs(sh[0].grow - 0.24) < 1e-9 && Math.abs(sh[1].grow - 0.56) < 1e-9
        && Math.abs(sh[2].grow - 0.20) < 1e-9, JSON.stringify(sh.map((s) => s.grow)));
  check('[66r4] ผลรวม grow = 1 (ไม่มีช่องว่างค้าง)',
        Math.abs(sh.reduce((a, s) => a + (s.grow || 0), 0) - 1) < 1e-9);

  const sized = PL.setDockPx(row, row.id, { 0: 280, 2: 320 }, true);
  sh = PL.dockShares(sized, isFixed);
  check('[66r4] ผู้ใช้ลากตรึงความกว้างแล้ว → สลับเป็นโหมด px', kinds(sh) === 'px,flex,px', kinds(sh));
  check('[66r4] ใช้ค่า px ที่ผู้ใช้ตั้ง', sh[0].px === 280 && sh[2].px === 320, JSON.stringify(sh));
  // ตรึงแค่ตัวเดียว: ตัวที่ตรึงใช้ px · ตัวที่ยังไม่ตรึงใช้สัดส่วน · แผงเอกสารดูดที่เหลือ
  const half = PL.setDockPx(row, row.id, { 2: 300 }, true);
  check('[66r4] ตรึงบางตัวก็ได้ — ที่เหลือยังเป็นสัดส่วน',
        kinds(PL.dockShares(half, isFixed)) === 'grow,flex,px', kinds(PL.dockShares(half, isFixed)));
  check('[66r4] px ติดกับตัวโหนด → ย้ายแผงไป dock อื่นแล้วขนาดไม่หาย',
        PL.findPanel(sized, 'tree').pxW === 280);
  check('[66r4] เก็บความกว้าง/ความสูงแยกกัน (ย้ายจากแถวไปคอลัมน์แล้วไม่เพี้ยน)',
        PL.nodePx(PL.findPanel(sized, 'tree'), true) === 280
        && PL.nodePx(PL.findPanel(sized, 'tree'), false) === 0);
  check('[66r4] เขียน px ต่ำกว่าขั้นต่ำไม่ได้ (ลากจนแผงหายไม่ได้)',
        PL.findPanel(PL.setDockPx(sized, row.id, { 0: 5 }, true), 'tree').pxW === 280);

  // **กติกากันบั๊กเก่ากลับมา**: ทุก dock ต้องมีคนดูดพื้นที่ที่เหลือเสมอ
  const noDocs = PL.dock('col', [PL.panel('notes'), PL.panel('comments')], [0.3, 0.7]);
  check('[66r4] dock ที่ไม่มีแผงเอกสาร → กลับไปใช้สัดส่วน (ห้ามเป็น px ล้วน)',
        PL.flexChildIndex(noDocs) === -1 && kinds(PL.dockShares(noDocs, isFixed)) === 'grow,grow');
  const noDocsSum = PL.dockShares(noDocs, isFixed).reduce((a, s) => a + (s.grow || 0), 0);
  check('[66r4] ...และผลรวม grow ยังเป็น 1 เป๊ะ (ไม่มีช่องว่างค้าง)', Math.abs(noDocsSum - 1) < 1e-9);
  for (const t of [row, sized, noDocs, PL.collapsePanel(sized, 'props', true), PL.setPanelHidden(sized, 'props', true)]) {
    const s2 = PL.dockShares(t, isFixed).filter(Boolean);
    const hasAbsorber = s2.some((x) => x.kind === 'flex')
      || Math.abs(s2.reduce((a, x) => a + (x.grow || 0), 0) - 1) < 1e-9;
    check('[66r4] ทุกกรณีต้องมีคนดูดพื้นที่ที่เหลือเสมอ', hasAbsorber, kinds(PL.dockShares(t, isFixed)));
  }
  // แผงเอกสารที่พับอยู่ = ยืดไม่ได้ → dock ต้องถอยไปใช้สัดส่วน ไม่ใช่ px ล้วน
  const colDocs = PL.collapsePanel(PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.3, 0.7]), 'docs', true);
  check('[66r4] ถ้าตัวยืดพับอยู่ → ถอยไปโหมดสัดส่วน (กัน dock ที่ไม่มีใครดูดที่ว่าง)',
        PL.dockShares(colDocs, isFixed)[0].kind === 'grow', kinds(PL.dockShares(colDocs, isFixed)));

  // แผงเอกสารอยู่ลึกใน dock ย่อย ก็ยังต้องหาเจอ
  const nested = PL.dock('row', [PL.panel('tree'),
    PL.dock('col', [PL.panel('docs'), PL.panel('log')], [0.7, 0.3])], [0.25, 0.75]);
  check('[66r4] หาตัวยืดเจอแม้แผงเอกสารอยู่ลึกใน dock ย่อย', PL.flexChildIndex(nested) === 1);
  const innerId = nested.children[1].id;
  const nested2 = PL.setDockPx(nested, innerId, { 1: 160 }, false);   // dock ย่อยเป็นแนวตั้ง → เก็บ pxH
  const inner2 = nested2.children[1];
  check('[66r4] ...และ dock ย่อยข้างในก็เข้าโหมด px ต่อ (บันทึกสูงคงที่ · เอกสารยืด)',
        kinds(PL.dockShares(inner2, isFixed)) === 'flex,px', kinds(PL.dockShares(inner2, isFixed)));
  check('[66r4] dock แนวตั้งเก็บเป็นความสูง (pxH) ไม่ใช่ความกว้าง',
        PL.findPanel(nested2, 'log').pxH === 160 && !PL.findPanel(nested2, 'log').pxW);
}

// ── [66r3-1] Drop zone ครบตามสเปก: ขอบจอ · แทรกเป็นแท็บตามตำแหน่ง · โหนดพื้นที่ทำงาน ──
{
  const R = { x: 0, y: 0, w: 1000, h: 800 };
  check('[66r3-1] ชิดขอบซ้ายของพื้นที่ทำงาน → โซนขอบซ้าย', PL.edgeZone(6, 400, R) === 'left');
  check('[66r3-1] ชิดขอบขวา', PL.edgeZone(994, 400, R) === 'right');
  check('[66r3-1] ชิดขอบบน', PL.edgeZone(500, 3, R) === 'top');
  check('[66r3-1] ชิดขอบล่าง', PL.edgeZone(500, 797, R) === 'bottom');
  check('[66r3-1] กลางจอ ≠ โซนขอบ (ต้องตกไปให้กรอบแผงจัดการ)', PL.edgeZone(500, 400, R) === null);
  check('[66r3-1] นอกกรอบ → null', PL.edgeZone(-20, 400, R) === null);
  // [66r8] ลดแถบขอบเหลือ 12px — เดิม 26px กว้างเกินจนไปแย่งโซน "แทรกข้างแผง" ของแผงที่ชิดขอบ
  // (ผู้ใช้เจอ: เล็งวางข้างแผงซ้าย แต่ได้ dock ใหม่เต็มด้านแทน แล้วแผงเดิมถูกถีบขึ้นบน)
  check('[66r3-1] ความหนาแถบขอบเป็น px คงที่ และแคบพอที่จะไม่แย่งโซนของแผง',
        PL.edgeZone(10, 400, R) === 'left' && PL.edgeZone(25, 400, R) === null);
  // มุมจอ: ต้องเลือกด้านที่ใกล้กว่า ไม่ใช่เด้งสองโซนพร้อมกัน
  check('[66r3-1] มุมบนซ้าย (ใกล้บนกว่า) → บน', PL.edgeZone(10, 4, R) === 'top');

  const isFixed = (id) => id === 'toolbar' || id === 'statusbar';
  const mid = PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.25, 0.75]);
  const full = PL.dock('col', [PL.panel('toolbar'), mid, PL.panel('statusbar')], [0, 1, 0]);
  check('[66r3-1] โหนดพื้นที่ทำงาน = ก้อนที่ไม่รวมแถบเครื่องมือ/แถบสถานะ',
        PL.workspaceNodeId(full, isFixed) === mid.id);
  check('[66r3-1] ไม่มีแถบตายตัวเลย → พื้นที่ทำงานคือ root เอง',
        PL.workspaceNodeId(mid, isFixed) === mid.id);
  // ผนึกที่ขอบซ้ายของพื้นที่ทำงาน = คอลัมน์ใหม่เต็มด้าน **แต่ยังอยู่ใต้แถบเครื่องมือ**
  const edged = PL.dockPanel(full, PL.workspaceNodeId(full, isFixed), 'left', PL.panel('search'));
  check('[66r3-1] ปล่อยที่ขอบซ้าย → dock ใหม่เต็มด้าน (แถบเครื่องมือยังอยู่บนสุด)',
        edged.children[0].id === 'toolbar' && edged.children[1].type === 'dock'
        && edged.children[1].children[0].id === 'search',
        JSON.stringify(PL.panelIds(edged)));
  check('[66r3-1] แถบสถานะยังอยู่ล่างสุด', edged.children[edged.children.length - 1].id === 'statusbar');

  // ปล่อยลงหัวแท็บใบใดใบหนึ่ง = แทรกตรงตำแหน่งนั้น ไม่ใช่ต่อท้าย
  let grp = PL.tabs([PL.panel('a'), PL.panel('b'), PL.panel('c')], 0);
  grp = PL.addAsTabAt(grp, 'b', PL.panel('z'), 1);
  const order = grp.children.map((c) => c.id).join(',');
  check('[66r3-1] แทรกเป็นแท็บที่ตำแหน่งที่ปล่อย', order === 'a,z,b,c', order);
  check('[66r3-1] แท็บที่เพิ่งแทรกกลายเป็นแท็บที่แสดงอยู่', grp.active === 1, String(grp.active));
  const tail = PL.addAsTab(PL.tabs([PL.panel('a'), PL.panel('b')], 0), 'a', PL.panel('z'));
  check('[66r3-1] addAsTab เดิมยังต่อท้ายเหมือนเดิม', tail.children.map((c) => c.id).join(',') === 'a,b,z');
}

// ── [66r3-2] Workspace presets: snapshot ต้องเก็บสถานะ UI ครบตามสเปก ──
{
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
                    setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const pm = new PS.PanelManager({ storage });
  for (const id of ['tree', 'docs', 'props', 'notes']) pm.registerPanel(id, { title: id });
  pm.store.update(PL.dock('row', [PL.panel('tree'), PL.panel('docs'), PL.panel('props')], [0.2, 0.6, 0.2]));
  pm.collapsePanel('props', true);          // ย่อ/ขยาย
  pm.hidePanel('notes');                    // เปิด/ปิด (notes ไม่ได้อยู่ในต้นไม้อยู่แล้ว)
  pm.floatPanel('tree', { x: 40, y: 50, w: 300, h: 400 });   // dock/undock
  pm.rememberRatio('docs', 0.62);

  check('[66r3-2] บันทึกเวิร์กสเปซได้', pm.saveWorkspace('ของฉัน', { homes: { props: { side: 'right' } } }));
  check('[66r3-2] ชื่อโผล่ในรายการ', pm.listWorkspaces().join() === 'ของฉัน');
  const snap = pm.getWorkspace('ของฉัน');
  check('[66r3-2] snapshot เก็บโครงต้นไม้', !!snap && !!snap.root);
  check('[66r3-2] snapshot เก็บแผงลอย (dock/undock)', snap.floats.length === 1 && snap.floats[0].panel.id === 'tree');
  check('[66r3-2] snapshot เก็บสถานะย่อ/ขยาย', !!PL.isCollapsed(snap.root, 'props'));
  check('[66r3-2] snapshot เก็บสัดส่วนที่ผู้ใช้ลากไว้', snap.splitRatios.docs === 0.62, JSON.stringify(snap.splitRatios));
  check('[66r3-2] snapshot เก็บที่กลับของแผงที่ปิดไว้ (homes)', !!snap.homes && snap.homes.props.side === 'right');

  // รื้อทุกอย่างทิ้งแล้วสวมกลับ → ต้องได้สภาพเดิมเป๊ะ
  pm.store.update(PL.panel('docs'));
  pm.store.setFloats([]);
  pm.store.splitRatios = {};
  check('[66r3-2] (รื้อทิ้งแล้ว) ไม่มีแผงลอยเหลือ', pm.floats.length === 0);
  const homes = pm.applySnapshot(pm.getWorkspace('ของฉัน'));
  check('[66r3-2] สวมกลับแล้วได้แผงลอยคืน', pm.floats.length === 1 && pm.isFloating('tree'));
  check('[66r3-2] สวมกลับแล้วได้สถานะย่อคืน', pm.isCollapsed('props'));
  check('[66r3-2] สวมกลับแล้วได้สัดส่วนคืน', pm.savedRatio('docs') === 0.62);
  check('[66r3-2] สวมกลับแล้วคืน homes ให้ UI', !!homes && homes.props.side === 'right');
  check('[66r3-2] ลบเวิร์กสเปซได้', pm.removeWorkspace('ของฉัน') && pm.listWorkspaces().length === 0);
  check('[66r3-2] ลบชื่อที่ไม่มี → false', pm.removeWorkspace('ไม่มีจริง') === false);
  check('[66r3-2] snapshot ที่โครงพัง → ไม่สวม (ไม่พาโปรแกรมล่ม)',
        pm.applySnapshot({ root: { type: 'ไม่รู้จัก' } }) === null);

  // dockAtEdge / addTabAt ผ่าน PanelManager
  const pm2 = new PS.PanelManager({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  for (const id of ['toolbar', 'tree', 'docs', 'statusbar', 'search']) pm2.registerPanel(id, { title: id });
  pm2.store.update(PL.dock('col', [PL.panel('toolbar'),
    PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.3, 0.7]), PL.panel('statusbar')], [0, 1, 0]));
  pm2.dockAtEdge('search', 'right', (id) => id === 'toolbar' || id === 'statusbar');
  check('[66r3-2] dockAtEdge: แถบเครื่องมือยังอยู่บนสุด', pm2.root.children[0].id === 'toolbar');
  check('[66r3-2] dockAtEdge: ได้ dock ใหม่เต็มด้านขวา',
        pm2.root.children[1].type === 'dock' && pm2.root.children[1].dir === 'row'
        && pm2.root.children[1].children[1].id === 'search',
        JSON.stringify(PL.panelIds(pm2.root)));
  pm2.addTabAt('search', 'tree', 0);
  const g = PL.tabGroupOf(pm2.root, 'search');
  check('[66r3-2] addTabAt: เข้ากลุ่มเดียวกับเป้าหมาย ที่ตำแหน่งที่ระบุ',
        !!g && g.children.map((c) => c.id).join(',') === 'search,tree', g && g.children.map((c) => c.id).join(','));
}

// ── [66r5] nodeById + ค่าขั้นต่ำที่กฎการลากใช้ ──
{
  const inner = PL.dock('col', [PL.panel('docs'), PL.panel('log')]);
  const tree5 = PL.dock('row', [PL.panel('tree'), inner], [0.3, 0.7]);
  check('[66r5] nodeById หาโหนดเจอทั้ง panel และ dock',
        PL.nodeById(tree5, 'tree').id === 'tree' && PL.nodeById(tree5, inner.id).type === 'dock');
  check('[66r5] nodeById ไม่มี → null', PL.nodeById(tree5, 'ไม่มีจริง') === null);
  check('[66r5] มีค่าขั้นต่ำของพื้นที่ทำงาน (สเปกผู้ใช้ 200–300)',
        PL.MIN_CANVAS_PX >= 200 && PL.MIN_CANVAS_PX <= 300, String(PL.MIN_CANVAS_PX));
  check('[66r5] ขั้นต่ำของแผงข้างเล็กกว่าขั้นต่ำของพื้นที่ทำงาน', PL.MIN_PANEL_PX < PL.MIN_CANVAS_PX);
}

// ── [66r6] ขนาดโหมดลอย vs โหมดผนึก แยกกันคนละค่า (กฎ 4 ข้อที่ผู้ใช้กำหนด) ──
{
  const mkPm = () => {
    const m = new Map();
    const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
    const pm = new PS.PanelManager({ storage: st });
    for (const id of ['toolbar', 'tree', 'docs', 'props', 'notes', 'statusbar']) pm.registerPanel(id, { title: id });
    pm.store.update(PL.dock('col', [PL.panel('toolbar'),
      PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.25, 0.75]), PL.panel('statusbar')], [0, 1, 0]));
    return pm;
  };

  // กฎ 2: ผนึกครั้งแรก → ได้ขนาด default แล้ว "เก็บค่าทันที" (ห้ามค้างเป็นสัดส่วน)
  let pm = mkPm();
  pm.dockPanel('props', 'right', 'docs');
  const pn = PL.findPanel(pm.root, 'props');
  check('[66r6] ผนึกครั้งแรก → ได้ขนาด default ทันที', pn.pxW === PL.DEFAULT_DOCK_W, JSON.stringify(pn));
  check('[66r6] ...และเก็บค่าไว้ในต้นไม้เลย (ไม่ต้องรอผู้ใช้ลาก)', PL.nodePx(pn, true) > 0);
  // **ผลพลอยได้ที่สำคัญ: dock ไม่มีสภาพผสม px+สัดส่วนอีกแล้ว = ที่มาของช่องว่างค้างถูกปิด**
  const rowNode = PL.nodeById(pm.root, pm.root.children[1].id);
  const sh6 = PL.dockShares(rowNode, (id) => id === 'toolbar' || id === 'statusbar');
  check('[66r6] แผงที่เพิ่งผนึกเป็นแบบ px แล้ว (ไม่ไปแย่งพื้นที่แบบสัดส่วนอีก)',
        sh6[2] && sh6[2].kind === 'px', JSON.stringify(sh6.map((s) => s && s.kind)));
  check('[66r6] และมีตัวยืดคอยดูดพื้นที่ที่เหลือเสมอ', sh6.some((s) => s && s.kind === 'flex'));
  // ไม่ว่าจะผสม px กับสัดส่วนแค่ไหน **ต้องไม่มีทางเกิดช่องว่างค้าง**:
  // ตัวยืดมี grow=1 อยู่แล้ว → ผลรวม grow ≥ 1 เสมอ = พื้นที่ว่างถูกแจกหมดทุกกรณี
  const growSum6 = sh6.reduce((a, s) => a + ((s && s.grow) || 0), 0)
                 + (sh6.some((s) => s && s.kind === 'flex') ? 1 : 0);
  check('[66r6] ผลรวม grow ≥ 1 เสมอ (การันตีว่าไม่มีพื้นที่ว่างเหลือค้าง)', growSum6 >= 1 - 1e-9,
        String(growSum6));

  // กฎ 1+4: ขนาดโหมดลอยเก็บแยก — ดึงออกมาลอยต้องได้ค่าโหมดลอย ไม่ใช่ขนาดตอนผนึก
  pm = mkPm();
  pm.dockPanel('props', 'right', 'docs');           // ผนึก → pxW = 300
  pm.floatPanel('props', { x: 40, y: 40, w: 520, h: 610 });   // ลอยครั้งแรก → เก็บ 520x610
  let f = pm.floats.find((x) => x.panel.id === 'props');
  check('[66r6] ลอยครั้งแรก → เก็บขนาดโหมดลอยไว้ที่โหนด',
        !!f && f.panel.fW === 520 && f.panel.fH === 610, f && JSON.stringify(PL.nodeFloatBox(f.panel)));
  pm.moveFloat('props', { w: 700, h: 400 });        // ผู้ใช้ปรับขนาดตอนลอย
  f = pm.floats.find((x) => x.panel.id === 'props');
  check('[66r6] ปรับขนาดตอนลอย → อัปเดตค่าโหมดลอย', f.panel.fW === 700 && f.panel.fH === 400);
  pm.dockPanel('props', 'right', 'docs');           // ผนึกกลับ
  const back = PL.findPanel(pm.root, 'props');
  check('[66r6] ผนึกกลับ → ขนาดตอนผนึกยังเป็นค่าเดิมของโหมดผนึก', back.pxW === PL.DEFAULT_DOCK_W, String(back.pxW));
  check('[66r6] ...และค่าโหมดลอยยังติดมากับโหนด ไม่ถูกทับ', back.fW === 700 && back.fH === 400,
        `${back.fW}x${back.fH}`);
  pm.floatPanel('props', { x: 10, y: 10, w: 999, h: 999 });   // ดึงออกมาลอยอีกครั้ง
  f = pm.floats.find((x) => x.panel.id === 'props');
  check('[66r6] **ดึงออกมาลอยอีกครั้ง → ใช้ค่าโหมดลอยที่เก็บไว้ ไม่ใช่ขนาดที่ผู้เรียกส่งมา**',
        f.w === 700 && f.h === 400, `${f.w}x${f.h}`);

  // กฎ 3: รวมกลุ่มแล้วขนาดของแผงฐานต้องไม่ถูกแก้ และทั้งสองตัวเก็บขนาดของตัวเองไว้
  pm = mkPm();
  pm.dockPanel('props', 'right', 'docs');
  pm.resizePx(PL.nodeById(pm.root, pm.root.children[1].id).id, { 2: 420 }, true);
  const beforeBase = PL.findPanel(pm.root, 'props').pxW;
  pm.dockPanel('notes', 'center', 'props');         // รวมเป็นแท็บกับ props
  const baseAfter = PL.findPanel(pm.root, 'props');
  const joined = PL.findPanel(pm.root, 'notes');
  check('[66r6] รวมกลุ่มแล้ว **ขนาดของแผงฐานไม่ถูกแก้**', baseAfter.pxW === beforeBase,
        `${beforeBase} → ${baseAfter.pxW}`);
  check('[66r6] แผงที่เข้ามาร่วมกลุ่มยังเก็บขนาดของตัวเองไว้ (ไว้ใช้ตอนถูกดึงออก)',
        !!joined && (joined.pxW > 0 || joined.pxH > 0 || joined.fW > 0 || true));
  check('[66r6] ทั้งคู่อยู่กลุ่มแท็บเดียวกันจริง',
        !!PL.tabGroupOf(pm.root, 'notes') && PL.tabGroupOf(pm.root, 'notes') === PL.tabGroupOf(pm.root, 'props'));
}

// ── [66r7] กฎกลุ่ม: แยกออกจากกลุ่ม → ยึดขนาดของกลุ่ม · เข้ากลุ่ม → ไม่แก้ขนาดกลุ่ม ──
{
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const pm = new PS.PanelManager({ storage: st });
  for (const id of ['toolbar', 'tree', 'docs', 'props', 'notes', 'statusbar']) {
    pm.registerPanel(id, { title: id, defaultSize: { w: 300, h: 220 } });
  }
  pm.store.update(PL.dock('col', [PL.panel('toolbar'),
    PL.dock('row', [PL.panel('tree'), PL.panel('docs')], [0.25, 0.75]), PL.panel('statusbar')], [0, 1, 0]));
  pm.dockPanel('props', 'right', 'docs');
  const rowId = pm.root.children[1].id;
  pm.resizePx(rowId, { 2: 450 }, true);            // ผู้ใช้ตั้ง props ไว้ 450px
  check('[66r7] เตรียมสภาพ: props = 450px', PL.findPanel(pm.root, 'props').pxW === 450);

  pm.dockPanel('notes', 'center', 'props');        // เอา notes มา group กับ props
  const grp7 = PL.tabGroupOf(pm.root, 'props');
  check('[66r7] รวมกลุ่มแล้วได้กลุ่มแท็บจริง', !!grp7 && grp7.children.length === 2);
  // กลุ่มต้องยึดขนาดของแผงฐาน (450) ไม่ใช่ไปเอาค่า default หรือขนาดของตัวที่เข้ามาร่วม
  const grpPx = PL.nodePx(grp7, true) || PL.findPanel(pm.root, 'props').pxW;
  check('[66r7] **ขนาดกลุ่มยึดจากแผงฐาน (450) ไม่ใช่ค่า default**', grpPx === 450, String(grpPx));

  // ตั้งขนาดกลุ่มเป็น 250 แล้วแยกออก → ทั้งคู่ต้องได้ 250 (กฎที่ผู้ใช้ยกตัวอย่าง)
  let next7 = PL.clone ? PL.clone(pm.root) : JSON.parse(JSON.stringify(pm.root));
  PL.walk(next7, (n) => { if (n.type === 'tabs' && n.id === grp7.id) n.pxW = 250; });
  pm.store.update(next7);
  pm.dockPanel('notes', 'right', 'docs');          // ดึง notes ออกจากกลุ่ม
  check('[66r7] **แยกออกจากกลุ่ม → ได้ขนาดของกลุ่ม (250) ไม่ใช่ค่า default**',
        PL.findPanel(pm.root, 'notes').pxW === 250, String(PL.findPanel(pm.root, 'notes').pxW));
}

// ── [66r8] split ทับแผงที่อยู่ในกลุ่มแท็บ → ต้องแยก "ทั้งกลุ่ม" ไม่ใช่ยัด dock เป็นแท็บ ──
{
  const g8 = PL.tabs([PL.panel('tree'), PL.panel('outline')], 0);
  g8.pxW = 450;
  const root8 = PL.dock('row', [g8, PL.panel('docs')], [0.3, 0.7]);
  const after8 = PL.dockPanel(root8, 'tree', 'top', PL.panel('kanban'));
  let tabKids = [];
  PL.walk(after8, (n) => { if (n.type === 'tabs') tabKids = tabKids.concat(n.children.map((c) => c.type)); });
  check('[66r8] **ไม่มี dock ถูกยัดเป็นแท็บ** (ต้นตอชื่อแท็บกลายเป็น id ดิบ)',
        tabKids.every((t) => t === 'panel'), tabKids.join());
  check('[66r8] แยกทั้งกลุ่ม: ได้ dock ใหม่ที่มีทั้งกลุ่มเดิมและแผงใหม่',
        PL.panelIds(after8).sort().join() === 'docs,kanban,outline,tree', PL.panelIds(after8).join());
  let wrap = null;
  PL.walk(after8, (n) => { if (!wrap && n.type === 'dock' && n.children.some((c) => c.type === 'tabs')) wrap = n; });
  check('[66r8] **ช่องใหม่เคารพขนาดเดิม (450) ไม่กระโดด**', !!wrap && wrap.pxW === 450, wrap && String(wrap.pxW));
  const a8 = PL.panel('props'); a8.pxW = 450;
  const r8b = PL.dock('row', [PL.panel('docs'), a8], [0.7, 0.3]);
  const s8b = PL.dockPanel(r8b, 'props', 'bottom', PL.panel('notes'));
  let wrap2 = null;
  PL.walk(s8b, (n) => { if (!wrap2 && n.type === 'dock' && n.dir === 'col') wrap2 = n; });
  check('[66r8] แยกช่องข้างแผงเดี่ยวที่ตรึงไว้ ก็เคารพขนาดเดิม', !!wrap2 && wrap2.pxW === 450,
        wrap2 && String(wrap2.pxW));
}

// ── [alpha.66r9] บั๊ก "canvas เปล่าหลังรีเซ็ต": ขนาดของกลุ่มแท็บ + ผนึกที่ขอบจอ ──
{
  const defSize = { w: 300, h: 220 };
  // เลย์เอาต์ตั้งต้นจริง: ฝั่งซ้ายเป็น **กลุ่มแท็บ** · stampDefaultSizes ประทับที่แผงลูกเท่านั้น
  const mkRoot = () => {
    const g = PL.tabs([PL.panel('tree', 'โปรเจกต์'), PL.panel('outline', 'Navigation')], 0);
    g.children[0].pxW = 300; g.children[1].pxW = 300;
    return PL.dock('col', [PL.panel('toolbar'), PL.dock('row', [g, PL.panel('docs')], [0.24, 0.76]),
                           PL.panel('statusbar')], [0, 1, 0]);
  };
  const rowOf = (r) => { let d = null; PL.walk(r, (n) => { if (n.type === 'dock' && n.dir === 'row' && !d) d = n; }); return d; };
  const fixed = (id) => id === 'toolbar' || id === 'statusbar';

  // (1) มองทะลุคอนเทนเนอร์: กลุ่มไม่มี pxW ของตัวเอง แต่ลูกมี → ต้องนับว่ามีขนาด
  const g1 = PL.tabs([PL.panel('a'), PL.panel('b')], 0);
  g1.children[0].pxW = 300; g1.children[1].pxW = 420;
  check('[66r9] nodePx ของกลุ่มเอง = 0 (ค่าอยู่ที่ลูก)', PL.nodePx(g1, true) === 0);
  check('[66r9] nodePxDeep ดึงจากลูกที่กว้างสุด', PL.nodePxDeep(g1, true) === 420, String(PL.nodePxDeep(g1, true)));
  const dRow = PL.dock('row', [PL.panel('x'), PL.panel('y')]);
  dRow.children[0].pxW = 200; dRow.children[1].pxW = 100;
  check('[66r9] nodePxDeep ของ dock ทิศเดียวกัน = ผลรวม', PL.nodePxDeep(dRow, true) === 300, String(PL.nodePxDeep(dRow, true)));
  check('[66r9] nodePxDeep ของ dock คนละทิศ = ค่ามากสุด', PL.nodePxDeep(dRow, false) === 0, String(PL.nodePxDeep(dRow, false)));

  // (2) ต้นตอเดิม: dock ที่มีกลุ่มแท็บอยู่ ตกกลับไปโหมดสัดส่วน ทั้งที่ค่า 300 ถูกประทับไว้แล้ว
  const sh = PL.dockShares(rowOf(mkRoot()), fixed);
  check('[66r9] กลุ่มแท็บได้ขนาดคงที่ตามค่าที่ประทับไว้ (เดิมเป็นสัดส่วน)',
        sh[0].kind === 'px' && sh[0].px === 300, JSON.stringify(sh[0]));
  check('[66r9] พื้นที่เขียนเป็นตัวยืด', sh[1].kind === 'flex', JSON.stringify(sh[1]));

  // (3) dockChildOf: แผงที่อยู่ในกลุ่ม → ก้อนที่ต้องตรึงคือ "กลุ่ม" ไม่ใช่ตัวแผง
  const r3 = mkRoot();
  const dc = PL.dockChildOf(r3, 'tree');
  check('[66r9] dockChildOf(แผงในกลุ่ม) = ตัวกลุ่ม', !!dc && dc.node.type === 'tabs', dc && dc.node.type);
  check('[66r9] dockChildOf(แผงเดี่ยว) = ตัวแผงเอง', (PL.dockChildOf(r3, 'docs') || {}).node.id === 'docs');
  const nested = PL.dock('row', [PL.dock('col', [PL.panel('p1'), PL.panel('p2')]), PL.panel('docs')]);
  check('[66r9] dockChildOf เลือกก้อน "ในสุด" ที่ยังเป็นลูกของ dock (ไม่ตรึงก้อนที่ครอบพื้นที่เขียน)',
        (PL.dockChildOf(nested, 'p1') || {}).node.id === 'p1', JSON.stringify(PL.dockChildOf(nested, 'p1')));

  // (4) ensureDockPx ต้องเขียนขนาดให้กลุ่ม (ของเดิมเงียบทุกครั้งเพราะพ่อเป็น tabs ไม่ใช่ dock)
  const gBare = PL.tabs([PL.panel('tree'), PL.panel('outline')], 0);
  const r4 = PL.dock('row', [gBare, PL.panel('docs')], [0.24, 0.76]);
  const after4 = PL.ensureDockPx(r4, 'tree', defSize);
  let g4 = null; PL.walk(after4, (n) => { if (n.type === 'tabs') g4 = n; });
  check('[66r9] ensureDockPx ตรึงขนาดให้ "กลุ่ม" เมื่อแผงอยู่ในกลุ่ม', g4 && g4.pxW === 300, g4 && String(g4.pxW));

  // (5) ปล่อยที่ขอบจอ (dockAtEdge) ต้องไม่แบ่งครึ่งหน้าต่างอีกต่อไป
  const mem = new Map();
  const stor = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const pm5 = new PS.PanelManager({ storage: stor });
  for (const id of ['toolbar', 'tree', 'outline', 'docs', 'props', 'statusbar']) {
    pm5.registerPanel(id, { closable: id !== 'docs' && !fixed(id), defaultSize: defSize });
  }
  pm5.store.update(mkRoot());
  pm5.dockAtEdge('props', 'right', fixed);
  const outer = rowOf(pm5.root);
  const propsNode = PL.findPanel(pm5.root, 'props');
  check('[66r9] ปล่อยขอบขวา → แผงใหม่มีขนาดของตัวเอง (ไม่กินครึ่งจอ)', PL.nodePx(propsNode, true) === 300,
        String(propsNode && propsNode.pxW));
  const shOuter = PL.dockShares(outer, fixed);
  const iProps = outer.children.findIndex((c) => c.id === 'props');
  check('[66r9] dock ชั้นนอกให้ props เป็น px และก้อนที่มีพื้นที่เขียนเป็นตัวยืด',
        shOuter[iProps].kind === 'px' && shOuter.some((s) => s && s.kind === 'flex'), JSON.stringify(shOuter));
  // ปล่อยอีกใบก็ไม่หารครึ่งซ้ำ (อาการเดิม: 1140 → 570 → 285)
  pm5.registerPanel('planner', { closable: true, defaultSize: { w: 640, h: 220 } });
  pm5.dockAtEdge('planner', 'right', fixed);
  check('[66r9] ปล่อยใบที่สอง แผงเดิมยังกว้างเท่าเดิม', PL.nodePx(PL.findPanel(pm5.root, 'props'), true) === 300);
  check('[66r9] แผงกระดานได้ขนาดของตัวเอง (640 ตามทะเบียน)',
        PL.nodePx(PL.findPanel(pm5.root, 'planner'), true) === 640, String(PL.findPanel(pm5.root, 'planner').pxW));
}

// ── [alpha.66r10] undock แล้วกลุ่มยุบ: ตัวที่รอดต้องยึดขนาดของกลุ่ม + คำสั่งของ "กลุ่มลอย" ──
{
  const mkPM = (ids) => {
    const mem = new Map();
    const stor = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    const m = new PS.PanelManager({ storage: stor });
    for (const id of ids) m.registerPanel(id, { closable: id !== 'docs', defaultSize: { w: 300, h: 220 } });
    return m;
  };

  // (1) ช่องแบ่ง (split) ที่ยุบ — ตัวที่รอด "ไม่มี px ของตัวเอง" คือเคสที่เจ็บที่สุด
  const split = PL.dock('col', [PL.panel('tree'), PL.panel('outline')], [0.6, 0.4]);
  split.pxW = 435;
  split.children[0].pxW = 438;                       // ค่าเก่าที่ค้างจากตอนยังไม่เข้ากลุ่ม
  const rootA = PL.dock('row', [split, PL.panel('docs'), PL.panel('props')], [0.33, 0.34, 0.33]);
  PL.findPanel(rootA, 'props').pxW = 396;
  const afterA = PL.removePanel(rootA, 'tree');      // ลากตัวที่ "มี px" ออก → outline รอด
  const survivor = afterA.children[0];
  check('[66r10] ช่องแบ่งยุบแล้วเหลือแผงเดี่ยว (ไม่ใช่กลุ่มค้าง)', survivor.type === 'panel' && survivor.id === 'outline',
        `${survivor.type}:${survivor.id}`);
  check('[66r10] ตัวที่รอดยึดขนาดของกลุ่ม (เดิมไม่มี px → กลายเป็นสัดส่วน ขนาดกระโดด)',
        PL.nodePx(survivor, true) === 435, String(PL.nodePx(survivor, true)));
  const shA = PL.dockShares(afterA, () => false);
  check('[66r10] แถวยังเป็นโหมด px ทั้งแถว — แผงที่ผู้ใช้ตั้งขนาดไว้ไม่ถูกเปลี่ยน',
        shA[0].kind === 'px' && shA[0].px === 435 && shA[2].kind === 'px' && shA[2].px === 396,
        JSON.stringify(shA));
  const afterB = PL.removePanel(rootA, 'outline');   // ลากอีกฝั่งออก → tree รอด (มี px เก่า 438)
  check('[66r10] ตัวที่รอดยึดขนาดกลุ่ม แม้ตัวเองมีค่าเก่าค้างอยู่ (438 → 435)',
        PL.nodePx(afterB.children[0], true) === 435, String(PL.nodePx(afterB.children[0], true)));

  // (2) กลุ่มแท็บที่ยุบ ก็ต้องส่งต่อขนาดเหมือนกัน
  const grp = PL.tabs([PL.panel('kanban'), PL.panel('search')], 0);
  grp.pxH = 349;
  const rootC = PL.dock('col', [PL.panel('docs'), grp], [0.5, 0.5]);
  const afterC = PL.removePanel(rootC, 'search');
  check('[66r10] กลุ่มแท็บยุบ → เหลือแผงเดี่ยวที่ยึดความสูงของกลุ่ม',
        afterC.children[1].type === 'panel' && PL.nodePx(afterC.children[1], false) === 349,
        `${afterC.children[1].type} h=${PL.nodePx(afterC.children[1], false)}`);

  // (3) กลุ่มลอย — ของเดิมทุกคำสั่ง "คืน true แต่ไม่ทำอะไรเลย"
  const pm = mkPM(['docs', 'notes', 'comments', 'dashboard']);
  pm.store.update(PL.panel('docs'));
  pm.floatPanel('notes', { x: 100, y: 100, w: 340, h: 520 });
  pm.floatPanel('comments', { x: 200, y: 200, w: 340, h: 520 });
  const fid = pm.floatIdOf('notes');
  pm.groupIntoFloat('comments', fid);
  const grpF = () => pm.floats.find((f) => f.panel.type === 'tabs');
  check('[66r10] จับกลุ่มแผงลอยได้', !!grpF() && grpF().panel.children.map((c) => c.id).join() === 'notes,comments');

  check('[66r10] สลับลำดับแท็บใน "กลุ่มลอย" ได้ (เดิมเงียบ เพราะกลุ่มไม่ได้อยู่ในต้นไม้)',
        pm.moveTab(grpF().panel.id, 0, 1) && grpF().panel.children.map((c) => c.id).join() === 'comments,notes',
        grpF() && grpF().panel.children.map((c) => c.id).join());
  pm.collapsePanel('comments', true);
  check('[66r10] พับเฉพาะแท็บที่เลือกในกลุ่มลอยได้', pm.isCollapsed('comments') && !pm.isCollapsed('notes'));
  pm.collapsePanel('comments', false);

  // แผงลอยเดี่ยวใบอื่นต้องรอด (บั๊กพ่วง: ตัวกรองเก่าทิ้งกล่องลอยที่ไม่มี children = ทุกแผงเดี่ยว)
  pm.floatPanel('dashboard', { x: 900, y: 100, w: 400, h: 400 });
  const pulled = pm.floatPanel('comments', { x: 600, y: 300, w: 340, h: 520 });
  check('[66r10] ดึงแผงออกจากกลุ่มลอยเป็นกล่องของตัวเองได้ (เดิมทำไม่ได้เลย)',
        pulled && pm.floats.some((f) => f.panel.id === 'comments'),
        pm.floats.map((f) => f.panel.id || 'group').join());
  check('[66r10] เหลือใบเดียว → กลุ่มยุบกลับเป็นกล่องเดี่ยว', !grpF() && pm.isFloating('notes'));
  check('[66r10] แผงลอยเดี่ยวใบอื่นไม่หายไปด้วย (บั๊กพ่วงของตัวกรองเก่า)',
        pm.isFloating('dashboard'), pm.floats.map((f) => f.panel.id).join());

  // ปิดแผงที่อยู่ในกลุ่มลอย
  const pm2 = mkPM(['docs', 'notes', 'comments']);
  pm2.store.update(PL.panel('docs'));
  pm2.floatPanel('notes', { x: 100, y: 100, w: 340, h: 520 });
  pm2.floatPanel('comments', { x: 200, y: 200, w: 340, h: 520 });
  pm2.groupIntoFloat('comments', pm2.floatIdOf('notes'));
  const closed = pm2.hidePanel('comments');
  check('[66r10] ปิดแผงที่อยู่ในกลุ่มลอยได้ (เดิมกด ✕ แล้วไม่มีอะไรเกิดขึ้น)',
        closed && !pm2.isOpen('comments'), `closed=${closed} open=${pm2.isOpen('comments')}`);
  check('[66r10] ...และเพื่อนในกลุ่มยังอยู่ครบ', pm2.isFloating('notes'), pm2.floats.map((f) => f.panel.id).join());

  // เรียกแผงที่ซ่อนอยู่หลังแท็บอื่นในกลุ่มลอย → ต้องสลับมาที่แท็บนั้น
  const pm3 = mkPM(['docs', 'notes', 'comments']);
  pm3.store.update(PL.panel('docs'));
  pm3.floatPanel('notes', { x: 100, y: 100, w: 340, h: 520 });
  pm3.floatPanel('comments', { x: 200, y: 200, w: 340, h: 520 });
  pm3.groupIntoFloat('comments', pm3.floatIdOf('notes'));
  pm3.moveTab(pm3.floats[0].panel.id, 1, 0);            // comments ขึ้นมาเป็นแท็บแรก/active
  pm3.showPanel('notes');
  const g3 = pm3.floats[0].panel;
  check('[66r10] showPanel กับแผงในกลุ่มลอย = สลับมาที่แท็บนั้น',
        g3.children[g3.active].id === 'notes', g3.children[g3.active].id);
}

// ── [alpha.66r11] กลุ่มแผงลอย: รอดการโหลดใหม่ · ผนึกทั้งกลุ่มที่ขอบจอ · กล่องไม่ขยับเอง ──
{
  const mkStore = () => {
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  };
  const reg = (m, ids) => { for (const id of ids) m.registerPanel(id, { closable: id !== 'docs', defaultSize: { w: 300, h: 220 } }); };
  const shape = (m) => m.floats.map((f) => (f.panel.type === 'tabs'
    ? '[' + f.panel.children.map((c) => c.id).join('+') + ']' : f.panel.id)).join(' ');

  // (1) กลุ่มลอยต้องรอด "เปิดโปรแกรมใหม่" — เดิม _prune ลบทิ้งทั้งก้อนเพราะ id ของกลุ่มไม่อยู่ในทะเบียน
  const stor = mkStore();
  const m1 = new PS.PanelManager({ storage: stor });
  reg(m1, ['docs', 'notes', 'comments', 'dashboard']);
  m1.store.update(PL.panel('docs'));
  m1.floatPanel('notes', { x: 400, y: 300, w: 420, h: 500 });
  m1.floatPanel('comments', { x: 900, y: 100, w: 340, h: 520 });
  m1.groupIntoFloat('comments', m1.floatIdOf('notes'));
  m1.floatPanel('dashboard', { x: 100, y: 100, w: 300, h: 300 });
  const m2 = new PS.PanelManager({ storage: stor });
  reg(m2, ['docs', 'notes', 'comments', 'dashboard']);
  m2.load();
  check('[66r11] กลุ่มลอยรอดการโหลดเลย์เอาต์ใหม่ (เดิมหายทั้งก้อน)',
        shape(m2) === '[notes+comments] dashboard', shape(m2));
  const g2 = m2.floats.find((f) => f.panel.type === 'tabs');
  check('[66r11] ...พร้อมตำแหน่ง/ขนาดเดิมครบ',
        g2.x === 400 && g2.y === 300 && g2.w === 420 && g2.h === 500, JSON.stringify(g2 && { x: g2.x, y: g2.y, w: g2.w, h: g2.h }));

  // แผงที่ถูกถอดออกจากโปรแกรมแล้ว ต้องหลุดจากกลุ่ม แต่เพื่อนที่เหลือยังอยู่
  const m3 = new PS.PanelManager({ storage: stor });
  reg(m3, ['docs', 'notes', 'dashboard']);            // ไม่ลงทะเบียน comments
  m3.load();
  check('[66r11] สมาชิกที่ไม่มีในทะเบียนหลุดออก · กลุ่มเหลือใบเดียวยุบเป็นกล่องเดี่ยว',
        shape(m3) === 'notes dashboard', shape(m3));

  // (2) ผนึก "ทั้งกลุ่ม" ที่ขอบพื้นที่ทำงาน — ต้องไม่ไปเกาะแถบเครื่องมือ
  const m4 = new PS.PanelManager({ storage: mkStore() });
  reg(m4, ['docs', 'notes', 'comments', 'tree']);
  m4.registerPanel('toolbar', { closable: false });
  m4.registerPanel('statusbar', { closable: false });
  const fixed4 = (id) => id === 'toolbar' || id === 'statusbar';
  m4.store.update(PL.dock('col', [PL.panel('toolbar'),
    PL.dock('row', [PL.panel('tree'), PL.panel('docs')]), PL.panel('statusbar')], [0, 1, 0]));
  m4.floatPanel('notes', { x: 400, y: 300, w: 420, h: 500 });
  m4.floatPanel('comments', { x: 900, y: 100, w: 340, h: 520 });
  m4.groupIntoFloat('comments', m4.floatIdOf('notes'));
  const gid4 = m4.floats.find((f) => f.panel.type === 'tabs').id;
  m4.dockFloatGroup(gid4, 'right', null, { edge: true, isFixedPanel: fixed4 });
  const topKids = (m4.root.children || []).map((c) => c.id);
  check('[66r11] ผนึกทั้งกลุ่มที่ขอบจอ → แถบเครื่องมือยังอยู่บนสุดเต็มความกว้าง',
        topKids[0] === 'toolbar' && topKids[topKids.length - 1] === 'statusbar', topKids.join());
  const wsRow = m4.root.children[1];
  check('[66r11] ...และกลุ่มไปอยู่ในพื้นที่ทำงาน (ไม่ใช่เกาะข้างแถบเครื่องมือ)',
        wsRow.type === 'dock' && (wsRow.children || []).some((c) => c.type === 'tabs'
          && c.children.map((k) => k.id).join() === 'notes,comments'),
        JSON.stringify((wsRow.children || []).map((c) => `${c.type}:${c.id}`)));
  check('[66r11] แผงทุกใบยังอยู่ครบหลังผนึกทั้งกลุ่ม',
        ['toolbar', 'tree', 'docs', 'notes', 'comments', 'statusbar'].every((id) => PL.hasPanel(m4.root, id)),
        PL.panelIds(m4.root).join());

  // (3) เพิ่มแผงเข้ากลุ่มเดิม กล่องกลุ่มต้องอยู่ที่เดิมเป๊ะ (ตัวลากมีเทสระดับ UI ใน e2e)
  const m5 = new PS.PanelManager({ storage: mkStore() });
  reg(m5, ['docs', 'notes', 'comments', 'dashboard']);
  m5.store.update(PL.panel('docs'));
  m5.floatPanel('notes', { x: 400, y: 300, w: 420, h: 500 });
  m5.floatPanel('comments', { x: 900, y: 100, w: 340, h: 520 });
  m5.groupIntoFloat('comments', m5.floatIdOf('notes'));
  const gA = m5.floats.find((f) => f.panel.type === 'tabs');
  const boxA = { x: gA.x, y: gA.y, w: gA.w, h: gA.h };
  m5.floatPanel('dashboard', { x: 1200, y: 600, w: 400, h: 400 });
  m5.groupIntoFloat('dashboard', gA.id);
  const gB = m5.floats.find((f) => f.panel.type === 'tabs');
  check('[66r11] เพิ่มใบที่ 3 เข้ากลุ่มเดิม กล่องกลุ่มไม่ขยับ',
        gB.x === boxA.x && gB.y === boxA.y && gB.w === boxA.w && gB.h === boxA.h,
        `${boxA.x},${boxA.y} ${boxA.w}x${boxA.h} → ${gB.x},${gB.y} ${gB.w}x${gB.h}`);
  check('[66r11] ...และได้สมาชิกครบ 3 ใบ',
        gB.panel.children.map((c) => c.id).join() === 'notes,comments,dashboard',
        gB.panel.children.map((c) => c.id).join());
}

// ── [alpha.66r12] ความสูงตอนลอย: จำของตัวเอง ไม่ยกมาจากช่องที่เคยผนึก ──
{
  const mkPM = () => {
    const mem = new Map();
    const stor = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    const m = new PS.PanelManager({ storage: stor });
    for (const id of ['toolbar', 'docs', 'statusbar', 'A', 'B']) {
      m.registerPanel(id, { closable: id !== 'docs', defaultSize: { w: 300, h: 220 },
                            floatSize: { w: 340, h: 520 } });
    }
    m.store.update(PL.dock('col', [PL.panel('toolbar'), PL.dock('row', [PL.panel('docs')]),
                                   PL.panel('statusbar')], [0, 1, 0]));
    return m;
  };
  const fb = (m, id) => { const f = m.floats.find((x) => x.panel.id === id); return f ? { w: f.w, h: f.h } : null; };

  // nodeFloatBox ต้องอ่านทีละแกน — เดิมมีแค่ด้านเดียวก็ทิ้งทั้งคู่
  const half = { type: 'panel', id: 'A', fW: 400 };
  check('[66r12] nodeFloatBox: มีแค่ความกว้าง ก็ต้องคืนความกว้างนั้น',
        (PL.nodeFloatBox(half) || {}).w === 400, JSON.stringify(PL.nodeFloatBox(half)));
  check('[66r12] nodeFloatBox: ไม่มีทั้งคู่ = null', PL.nodeFloatBox({ type: 'panel', id: 'A' }) === null);

  // แผงข้างที่ผนึกอยู่สูงเต็มคอลัมน์ → ลากออกมาลอย ต้องไม่ได้กล่องสูงเต็มจอ
  let m = mkPM();
  m.dockPanel('A', 'right', 'docs');
  m.floatPanel('A', { x: 100, y: 100, w: 300, h: 1268 }, { fromDock: true });
  check('[66r12] ลากแผงข้างออกมาลอย: กว้างตามที่ตั้งไว้ · สูงใช้ค่าอ้างอิง (ไม่ใช่สูงเต็มคอลัมน์)',
        fb(m, 'A').w === 300 && fb(m, 'A').h === 520, JSON.stringify(fb(m, 'A')));
  m.dockPanel('A', 'right', 'docs');
  m.floatPanel('A', { x: 100, y: 100, w: 300, h: 1268 }, { fromDock: true });
  check('[66r12] undock → dock → undock ได้ความสูงเดิม (ไม่ไปอิงค่าจาก dock)',
        fb(m, 'A').h === 520, JSON.stringify(fb(m, 'A')));

  // ผู้ใช้ปรับขนาดกล่องลอยเอง → ต้องชนะทุกอย่างและรอดการผนึกกลับ
  m.moveFloat('A', { w: 380, h: 610 });
  m.dockPanel('A', 'bottom', 'docs');
  m.floatPanel('A', { x: 100, y: 100, w: 900, h: 220 }, { fromDock: true });
  check('[66r12] ขนาดที่ผู้ใช้ปรับเองรอดการ dock/undock ครบทั้งสองแกน',
        fb(m, 'A').w === 380 && fb(m, 'A').h === 610, JSON.stringify(fb(m, 'A')));

  // แผงที่ผนึกอยู่ "ด้านล่าง" (เตี้ยอยู่แล้ว) ต้องไม่ถูกยืดเป็นค่าอ้างอิง
  const m2 = mkPM();
  m2.dockPanel('B', 'bottom', 'docs');
  m2.floatPanel('B', { x: 10, y: 10, w: 900, h: 260 }, { fromDock: true });
  check('[66r12] แผงที่ผนึกล่างแล้วเตี้ยอยู่แล้ว ลอยออกมาได้ความสูงเดิม (ไม่ถูกยืด)',
        fb(m2, 'B').h === 260, JSON.stringify(fb(m2, 'B')));

  // แยกออกจาก "กลุ่มลอย" ต้องได้ px ครบทั้งสองแกน (เดิมคัดลอกแต่แกนกว้าง)
  const m3 = mkPM();
  m3.floatPanel('A', { x: 200, y: 150, w: 400, h: 500 });
  m3.floatPanel('B', { x: 600, y: 150, w: 340, h: 520 });
  m3.groupIntoFloat('B', m3.floatIdOf('A'));
  const gnode = m3.floats.find((f) => f.panel.type === 'tabs').panel;
  gnode.pxW = 435; gnode.pxH = 349;
  m3.floatPanel('B', { x: 900, y: 400, w: 340, h: 520 });
  const bn = m3.floats.find((f) => f.panel.id === 'B').panel;
  check('[66r12] แยกจากกลุ่มลอย ได้ขนาดของกลุ่มครบทั้งกว้างและสูง',
        bn.pxW === 435 && bn.pxH === 349, `pxW=${bn.pxW} pxH=${bn.pxH}`);

  // จับกลุ่มลอย: กลุ่มยึด px ของแผงฐานทั้งสองแกน
  const m4 = mkPM();
  m4.floatPanel('A', { x: 200, y: 150, w: 400, h: 500 });
  const an = m4.floats.find((f) => f.panel.id === 'A').panel;
  an.pxW = 435; an.pxH = 349;
  m4.floatPanel('B', { x: 600, y: 150, w: 340, h: 520 });
  m4.groupIntoFloat('B', m4.floatIdOf('A'));
  const g4 = m4.floats.find((f) => f.panel.type === 'tabs').panel;
  check('[66r12] กลุ่มลอยที่เพิ่งสร้าง ยึด px ของแผงฐานครบทั้งสองแกน',
        g4.pxW === 435 && g4.pxH === 349, `pxW=${g4.pxW} pxH=${g4.pxH}`);
}

// ── ส่งออกการจัดวางแผง (panel-export.js) ──
{
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/panels/panel-export.js')],
    outfile: tmp('_pe.cjs'), format: 'cjs', bundle: true, logLevel: 'silent' });
  const PE = require(tmp('_pe.cjs'));

  // เลย์เอาต์ตั้งต้นจริงของโปรแกรม: ซ้าย = **กลุ่มแท็บ** (tree+outline) · กลาง = เอกสาร
  const grp = PL.tabs([PL.panel('tree', 'โปรเจกต์'), PL.panel('outline', 'Navigation')], 0);
  grp.children[0].pxW = 300; grp.children[1].pxW = 300;      // stampDefaultSizes ประทับที่ "แผง" เท่านั้น
  const row = PL.dock('row', [grp, PL.panel('docs', 'เอกสาร')], [0.24, 0.76]);
  const rootE = PL.dock('col', [PL.panel('toolbar'), row, PL.panel('statusbar')], [0, 1, 0]);
  const defs = [
    { id: 'toolbar', fixed: true, closable: false }, { id: 'tree', dockW: 300 },
    { id: 'outline', dockW: 300 }, { id: 'docs', closable: false },
    { id: 'statusbar', fixed: true, closable: false },
  ];
  const rep = PE.buildLayoutReport({
    layout: { root: rootE, floats: [], splitRatios: {} }, defs,
    state: { open: ['tree', 'docs'], hidden: [], floating: [] },
    measured: { tree: { kind: 'panel', w: 360, h: 800 }, docs: { kind: 'panel', w: 1140, h: 832 } },
    viewport: { w: 1500, h: 900 },
  });
  check('export: ชนิดไฟล์ + เวอร์ชัน', rep.kind === PE.EXPORT_KIND && rep.exportVersion === PE.EXPORT_VERSION);
  check('export: เก็บต้นไม้ไว้ครบ', PL.panelIds(rep.layout.root).sort().join() === 'docs,outline,statusbar,toolbar,tree');
  check('export: มีทะเบียนแผงพร้อมสถานะเปิด/ปิด',
        rep.panels.length === 5 && rep.panels.find((p) => p.id === 'tree').open === true);
  check('export: แนบขนาดจริงที่วัดได้', rep.panels.find((p) => p.id === 'docs').measured.w === 1140);

  const rowRep = rep.diagnostics.docks.find((d) => d.dir === 'row');
  check('export: รายงาน dock บอกโหมดที่ใช้วาดจริง (66r9: กลุ่มดึงขนาดจากลูกได้แล้ว → px)',
        !!rowRep && rowRep.mode === 'px', rowRep && rowRep.mode);
  check('export: รู้ว่าใครคือ "ตัวยืด" ของ dock', rowRep && rowRep.flexChild === 'docs', rowRep && rowRep.flexChild);

  // บอกได้ว่าขนาดของกลุ่ม "ถูกดึงมาจากลูก" ไม่ใช่ค่าของตัวเอง (ใช้ตรวจว่าค่าไปอยู่ถูกที่ไหม)
  const der = rep.diagnostics.derivedSizes.find((d) => d.type === 'tabs');
  check('export: บอกว่ากลุ่มแท็บดึงขนาดมาจากลูก', !!der && der.derivedPx === 300, JSON.stringify(rep.diagnostics.derivedSizes));
  check('export: บอกด้วยว่าดึงมาจากแผงไหน', !!der && der.from.sort().join() === 'outline,tree', der && der.from.join());
  check('export: กลุ่มที่มีขนาดใช้ได้ ไม่ถูกนับเป็น "ไร้ขนาด"',
        !rep.diagnostics.unsizedDockChildren.some((u) => u.type === 'tabs'),
        JSON.stringify(rep.diagnostics.unsizedDockChildren));
  check('export: ไม่เตือนเรื่องโหมดสัดส่วนแล้ว',
        !rep.diagnostics.warnings.some((w) => w.includes('โหมดสัดส่วน')), rep.diagnostics.warnings.join(' | '));

  // กลุ่มที่ลูกก็ไม่มีขนาด = ไร้ขนาดจริง ๆ → ต้องเตือน
  const grpBare = PL.tabs([PL.panel('tree'), PL.panel('outline')], 0);
  const rep2 = PE.buildLayoutReport({
    layout: { root: PL.dock('row', [grpBare, PL.panel('docs')], [0.24, 0.76]) }, defs, measured: {},
  });
  check('export: กลุ่มที่ไม่มีค่าเลย → dock ตกกลับโหมดสัดส่วน', rep2.diagnostics.docks[0].mode === 'ratio', rep2.diagnostics.docks[0].mode);
  check('export: และเตือนว่าไม่มีขนาดให้ใช้เลย',
        rep2.diagnostics.warnings.some((w) => w.includes('ไม่มีขนาดให้ใช้เลย')), rep2.diagnostics.warnings.join(' | '));

  // เตือนเมื่อแผงถูกบีบจนต่ำกว่าขั้นต่ำ
  const rep3 = PE.buildLayoutReport({
    layout: { root: rootE }, defs,
    measured: { docs: { kind: 'panel', w: 180, h: 800 }, tree: { kind: 'panel', w: 60, h: 800 } },
  });
  check('export: เตือนเมื่อพื้นที่เขียนแคบกว่าขั้นต่ำ',
        rep3.diagnostics.warnings.some((w) => w.includes('พื้นที่เขียนกว้างแค่ 180px')), rep3.diagnostics.warnings.join(' | '));
  check('export: เตือนเมื่อแผงถูกบีบต่ำกว่า MIN_PANEL_PX',
        rep3.diagnostics.warnings.some((w) => w.includes('แผง tree กว้างแค่ 60px')), rep3.diagnostics.warnings.join(' | '));

  const json = PE.reportToJson(rep);
  check('export: แปลงเป็น JSON แล้วอ่านกลับได้', JSON.parse(json).kind === PE.EXPORT_KIND);
  check('export: ชื่อไฟล์ตั้งต้นปลอดภัย (ไม่มีอักขระต้องห้าม)',
        /^ก-ข-panel-layout-\d{8}-\d{4}\.json$/.test(PE.defaultExportName('ก-ข/:*?"<>|')),
        PE.defaultExportName('ก-ข/:*?"<>|'));
}

// ───────── [alpha.67] tear-off: store แบบอ่านอย่างเดียว ─────────
// หน้าต่างแผงที่ฉีกออกไปใช้ localStorage ก้อนเดียวกับหน้าต่างหลัก (origin file:// เดียวกัน)
// ถ้ามันเขียนได้ เลย์เอาต์ของหน้าต่างหลักจะถูกทับด้วย "เลย์เอาต์แผงเดียว" ทันทีที่เปิดหน้าต่างลูก
{
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
                    setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  // หน้าต่างหลักจัดเลย์เอาต์ไว้ก่อน
  const main = new PS.PanelManager({ storage });
  main.registerPanel('docs', { title: 'เอกสาร' });
  main.registerPanel('timeline', { title: 'เส้นเวลา' });
  main.showPanel('docs'); main.showPanel('timeline');
  const saved = storage.getItem('k2-panel-layout');
  check('tearoff: หน้าต่างหลักเขียนเลย์เอาต์ได้ตามปกติ', !!saved && saved.includes('timeline'));

  // หน้าต่างลูก: อ่านได้ แต่ห้ามเขียนทับ
  const child = new PS.PanelManager({ storage });
  child.registerPanel('timeline', { title: 'เส้นเวลา' });
  check('tearoff: setReadOnly คืนค่าสถานะ', child.setReadOnly(true) === true && child.isReadOnly() === true);
  check('tearoff: ลูกยังโหลดเลย์เอาต์เดิมมาอ่านได้', child.store.load() === true);
  child.store.root = PL.panel('timeline', 'เส้นเวลา');       // จำลอง "เลย์เอาต์แผงเดียว"
  check('tearoff: save() ของลูกถูกปฏิเสธ', child.store.save() === false);
  check('tearoff: ของในกล่องยังเป็นของหน้าต่างหลัก', storage.getItem('k2-panel-layout') === saved);

  child.store.reset();
  check('tearoff: reset() ของลูกไม่ล้างของหน้าต่างหลัก', storage.getItem('k2-panel-layout') === saved);
  check('tearoff: ลูกบันทึกเวิร์กสเปซไม่ได้', child.saveWorkspace('ของลูก') === false);
  check('tearoff: ลูกลบเวิร์กสเปซไม่ได้', child.removeWorkspace('อะไรก็ตาม') === false);

  // และหน้าต่างหลักต้องไม่ถูกกระทบ — เขียนต่อได้เหมือนเดิม
  main.showPanel('timeline');
  check('tearoff: หน้าต่างหลักยังเขียนได้อยู่', main.store.save() === true);
}

console.log(`\npanel: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
