// test/planner-data.test.cjs — Unit tests for PlannerData v4
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// รันด้วย: node test/planner-data.test.cjs
'use strict';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS [' + pass + '] ' + name); }
  else { fail++; console.error('FAIL ' + name + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

// esbuild the module to CJS for testing
const { buildSync } = require('esbuild');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Build planner-data.js as CJS
const srcFile = path.join(__dirname, '..', 'src', 'planner', 'planner-data.js');
const numFile = path.join(__dirname, '..', 'src', 'num.js');

const result = buildSync({
  entryPoints: [srcFile],
  bundle: true,
  format: 'cjs',
  write: false,
  platform: 'node',
});

// Eval the CJS output
const mod = { exports: {} };
const fn = new Function('module', 'exports', 'require', result.outputFiles[0].text);
fn(mod, mod.exports, require);

const { PlannerData, validatePort, validateEdgeStyle, uid,
        createDefaultNode, CARD_W, CARD_H,
        // [alpha.150] ของใหม่: รูป · รายการติ๊ก · พื้นหลังกระดาน · snap ขนาด
        IMAGE_FITS, validateFit, _normBgImage, normTodoItems, todoProgress, toggleTodo,
        parseTodoText, todoToText, todoRowAt, todoContentHeight, TODO_LAYOUT,
        // [alpha.150r] ขนาดรูป + ตารางไอคอน (ต้องเก็บ "ชื่อ" ไม่ใช่อีโมจิ)
        IMG_SCALE_MIN, IMG_SCALE_MAX, ICONS,
        // [alpha.151] จัดข้อความในการ์ด · ดัดเส้นหักมุมฉาก
        TEXT_ALIGNS, TEXT_VALIGNS, bendHandles, applyBends, setBend,
        NODE_TYPES } = mod.exports;

// ── Mock kapi (in-memory filesystem) ──
function mockIo() {
  const files = {};
  return {
    files,
    async join(...parts) { return parts.join('/'); },
    async exists(p) { return p in files; },
    async readJson(p) {
      if (!(p in files)) throw new Error('not found');
      return JSON.parse(files[p]);
    },
    async writeFile(p, data) {
      files[p] = data;
    },
  };
}

// ================================================
console.log('--- planner-data v4 ---');

// 1. validatePort
check('validatePort top', validatePort('top') === true);
check('validatePort right', validatePort('right') === true);
check('validatePort bottom', validatePort('bottom') === true);
check('validatePort left', validatePort('left') === true);
check('validatePort invalid', validatePort('invalid') === false);
check('validatePort empty', validatePort('') === false);

// 2. validateEdgeStyle
check('validateEdgeStyle solid', validateEdgeStyle('solid') === true);
check('validateEdgeStyle dashed', validateEdgeStyle('dashed') === true);
check('validateEdgeStyle dotted', validateEdgeStyle('dotted') === true);
check('validateEdgeStyle invalid', validateEdgeStyle('invalid') === false);

// 3. uid
const u1 = uid('pl-'), u2 = uid('pl-');
check('uid unique', u1 !== u2);
check('uid starts with prefix', u1.startsWith('pl-'));

// 4. createDefaultNode
const dn = createDefaultNode('scene', 'ทดสอบ', '#f00', 10, 20);
check('createDefaultNode type', dn.type === 'scene');
check('createDefaultNode title', dn.title === 'ทดสอบ');
check('createDefaultNode color', dn.color === '#f00');
check('createDefaultNode x/y', dn.x === 10 && dn.y === 20);
check('createDefaultNode defaults: width=180, height=110', dn.width === 180 && dn.height === 110);
check('createDefaultNode defaults: file=null', dn.file === null);
check('createDefaultNode defaults: tags=[]', Array.isArray(dn.tags) && dn.tags.length === 0);
check('createDefaultNode defaults: synopsis=""', dn.synopsis === '');
check('createDefaultNode defaults: status=""', dn.status === '');

// 5. PlannerData CRUD
const io = mockIo();
const pd = new PlannerData('/proj', io);

// addNode
const n1 = pd.addNode('scene', 'ฉากแรก', '#333');
check('addNode → count 1', pd.getAllNodes().length === 1);
check('getNode returns node', pd.getNode(n1.id) === n1);

const n2 = pd.addNode('entity', 'ตัวละคร', '#555', 100, 200);
check('addNode → count 2', pd.getAllNodes().length === 2);

// 6. addEdge valid
const e1 = pd.addEdge(n1.id, 'right', n2.id, 'left', { label: 'เชื่อม', color: '#f00', width: 3, style: 'dashed' });
check('addEdge → valid edge created', !!e1);
check('addEdge label', e1.label === 'เชื่อม');
check('addEdge color', e1.color === '#f00');
check('addEdge width', e1.width === 3);
check('addEdge style', e1.style === 'dashed');

// 7. addEdge self-loop rejected
const selfLoop = pd.addEdge(n1.id, 'right', n1.id, 'left');
check('addEdge → self-loop rejected (null)', selfLoop === null);

// 8. addEdge duplicate rejected
const dup = pd.addEdge(n1.id, 'right', n2.id, 'left');
check('addEdge → duplicate from+fromPort+to+toPort rejected', dup === null);

// 9. addEdge invalid port rejected
const badPort = pd.addEdge(n1.id, 'invalid', n2.id, 'left');
check('addEdge → invalid port rejected', badPort === null);

// Different port is allowed
const eDiff = pd.addEdge(n1.id, 'top', n2.id, 'bottom');
check('addEdge → different port allowed', !!eDiff);

// 10. removeNode cascade
pd.removeNode(n1.id);
check('removeNode → node count decreases', pd.getAllNodes().length === 1);
check('removeNode → edges from/to removed node are removed',
      pd.getAllEdges().every((e) => e.from.nodeId !== n1.id && e.to.nodeId !== n1.id));

// 11. removeEdge
const ne1 = pd.addNode('note', 'โน้ต', '#666');
const ne2 = pd.addNode('note', 'โน้ต2', '#666');
const ee = pd.addEdge(ne1.id, 'left', ne2.id, 'right');
const before = pd.getAllEdges().length;
pd.removeEdge(ee.id);
check('removeEdge → edge count decreases', pd.getAllEdges().length === before - 1);

// 12. updateNode
pd.updateNode(ne1.id, { title: 'ชื่อใหม่', synopsis: 'สรุป', status: 'กำลังเขียน' });
const nu = pd.getNode(ne1.id);
check('updateNode title', nu.title === 'ชื่อใหม่');
check('updateNode synopsis', nu.synopsis === 'สรุป');
check('updateNode status', nu.status === 'กำลังเขียน');

// 13. updateNode invalid id
check('updateNode → invalid id returns false', pd.updateNode('nonexistent', { title: 'x' }) === false);

// 14. updateEdge
const ee2 = pd.addEdge(ne1.id, 'bottom', ne2.id, 'top');
pd.updateEdge(ee2.id, { label: 'ป้ายใหม่', color: '#0f0', width: 5, style: 'dotted' });
const eu = pd.getEdge(ee2.id);
check('updateEdge label', eu.label === 'ป้ายใหม่');
check('updateEdge color', eu.color === '#0f0');
check('updateEdge width=5', eu.width === 5);
check('updateEdge style=dotted', eu.style === 'dotted');

// 15. updateEdge invalid style rejected
pd.updateEdge(ee2.id, { style: 'invalid' });
check('updateEdge → invalid style rejected (still dotted)', pd.getEdge(ee2.id).style === 'dotted');

// 16. updateEdge width clamped
pd.updateEdge(ee2.id, { width: 0 });
check('updateEdge → width clamped to min 1', pd.getEdge(ee2.id).width === 1);
pd.updateEdge(ee2.id, { width: 99 });
check('updateEdge → width clamped to max 8', pd.getEdge(ee2.id).width === 8);

// 17. addGroup
const g = pd.addGroup('กลุ่มทดสอบ', [ne1.id, ne2.id], '#f0f');
check('addGroup → group created with children', !!g && g.childrenIds.length === 2 && g.name === 'กลุ่มทดสอบ');

// 18. updateGroupBounds
ne1.x = 100; ne1.y = 100; ne2.x = 400; ne2.y = 300;
pd.updateGroupBounds(g.id);
const gu = pd.getGroup(g.id);
check('updateGroupBounds → x,y,w,h calculated', gu.x < 100 && gu.y < 100 && gu.width > 300 && gu.height > 200);

// 19-22. filterNodes
const fn1 = pd.addNode('scene', 'พระเอกสู้มังกร', '#333');
fn1.synopsis = 'การต่อสู้ครั้งยิ่งใหญ่';
fn1.status = 'กำลังเขียน';

const fn2 = pd.addNode('entity', 'มังกรไฟ', '#555');
fn2.synopsis = 'เป็นมังกรตัวสุดท้าย';
fn2.status = '';

const fn3 = pd.addNode('chapter', 'บทที่สอง', '#666');
fn3.synopsis = '';
fn3.status = 'ตรวจแล้ว';

check('filterNodes text matches title', pd.filterNodes({ text: 'มังกร', type: '', status: '' }).length === 2);
check('filterNodes text matches synopsis', pd.filterNodes({ text: 'ต่อสู้', type: '', status: '' }).length === 1);
check('filterNodes type filter', pd.filterNodes({ text: '', type: 'chapter', status: '' }).length === 1);
check('filterNodes status filter', pd.filterNodes({ text: '', type: '', status: 'กำลังเขียน' }).length >= 2);
check('filterNodes combined', pd.filterNodes({ text: 'มังกร', type: 'entity', status: '' }).length === 1);

// 23-25. needsMigration + v1/v2 migration
const v1data = { nodes: [{ id: 'a1', type: 'scene', title: 'เก่า', x: 10, y: 20 }], edges: [] };
check('needsMigration → null for v1 (no version)', pd.needsMigration(v1data) === '1.0');
check('needsMigration → "1.0" for explicit v1', pd.needsMigration({ version: '1.0' }) === '1.0');
check('needsMigration → "2.0" for v2', pd.needsMigration({ version: '2.0' }) === '2.0');
check('needsMigration → "3.0" for v3 (ต้อง migrate ต่อเป็น v4)', pd.needsMigration({ version: '3.0' }) === '3.0');
check('needsMigration → null for v4', pd.needsMigration({ version: '4.0' }) === null);

const migrated1 = pd.migrateV1toV3(v1data);
check('migrateV1toV3 version=3.0', migrated1.version === '3.0');
check('migrateV1toV3 node gets width=180', migrated1.nodes[0].width === 180);
check('migrateV1toV3 node gets height=110', migrated1.nodes[0].height === 110);
check('migrateV1toV3 node gets synopsis=""', migrated1.nodes[0].synopsis === '');
check('migrateV1toV3 node gets status=""', migrated1.nodes[0].status === '');

const v2data = { version: '2.0', nodes: [{ id: 'b1', type: 'scene', title: 'v2', x: 0, y: 0,
  width: CARD_W, height: CARD_H }], edges: [{ id: 'e1', from: 'b1', to: 'b1', label: 'x' }] };
const migrated2 = pd.migrateV2toV3(v2data);
check('migrateV2toV3 version=3.0', migrated2.version === '3.0');
check('migrateV2toV3 edge from→{nodeId,port:right}', migrated2.edges[0].from.port === 'right');
check('migrateV2toV3 edge to→{nodeId,port:left}', migrated2.edges[0].to.port === 'left');
check('migrateV2toV3 edge width=2', migrated2.edges[0].width === 2);
check('migrateV2toV3 edge style=solid', migrated2.edges[0].style === 'solid');

// 26-27. _exportData
const ex = pd._exportData();
check('_exportData version=4.0', ex.version === '4.0');
check('_exportData มี settings.grid', !!ex.settings && ex.settings.grid.size > 0);
check('_exportData has updated', !!ex.updated);

// 28. countStats
const stats = pd.countStats();
check('countStats nodes', stats.nodes >= 0);
check('countStats edges', stats.edges >= 0);
check('countStats groups', stats.groups >= 0);

// 29. findEdge
const fa = pd.addNode('scene', 'findA', '#333');
const fb = pd.addNode('scene', 'findB', '#333');
const fe = pd.addEdge(fa.id, 'top', fb.id, 'bottom');
check('findEdge found', !!pd.findEdge(fa.id, 'top', fb.id, 'bottom'));
check('findEdge not found (diff port)', pd.findEdge(fa.id, 'top', fb.id, 'top') === null);
check('findEdge not found (diff node)', pd.findEdge(fa.id, 'top', fa.id, 'bottom') === null);

// 30. dirty tracking
check('isDirty after CRUD', pd.isDirty() === true);
pd.markDirty();
check('markDirty', pd.isDirty() === true);

async function v4Tests() {

  // ═══════════════ v4: ชนิดโหนดใหม่ · กริด · routing · หัวลูกศร · หลายกระดาน ═══════════════
  const {
    NODE_TYPES, SHAPES, EDGE_ROUTINGS, ARROW_HEADS, GRID_STYLES, DEFAULT_GRID, TYPE_DEFAULTS,
    validateRouting, validateArrow, validateShape, snapTo,
    portPoint, edgeGeometry, edgePathString, edgeMidpoint, edgeAngles, createDefaultEdge, trimGeometry, sampleGeometry, distanceToPolyline,
  } = mod.exports;

  console.log('\n--- planner-data v4: ชนิดโหนด/รูปทรง ---');
  for (const t of ['sticky', 'text', 'shape', 'frame', 'comment']) {
    check('NODE_TYPES มี ' + t, NODE_TYPES.includes(t));
  }
  check('SHAPES ครบ 8 แบบ', SHAPES.length === 8 && SHAPES.includes('ellipse') && SHAPES.includes('diamond'));
  check('validateShape ถูก', validateShape('star') === true && validateShape('nope') === false);
  const stickyDef = createDefaultNode('sticky', '', null, 0, 0);
  check('โพสต์อิตใช้ขนาด/สีเริ่มต้นของตัวเอง (ไม่ใช่ของการ์ดฉาก)',
        stickyDef.width === TYPE_DEFAULTS.sticky.width && stickyDef.color === TYPE_DEFAULTS.sticky.color &&
        stickyDef.textColor === '#1a1815');
  const frameDef = createDefaultNode('frame', 'เฟรม', null, 0, 0);
  check('เฟรมมีขนาดใหญ่กว่าการ์ดปกติ', frameDef.width === 640 && frameDef.height === 420);
  check('ชนิดที่ไม่รู้จัก → ตกกลับเป็น scene', createDefaultNode('อะไรก็ไม่รู้', 'x').type === 'scene');

  console.log('\n--- planner-data v4: กริด + snap ---');
  const pg = new PlannerData('/proj', mockIo());
  pg._parse({});
  check('กริดเริ่มต้น: แสดง · 20px · ไม่ snap · จุด',
        pg.getGrid().show === true && pg.getGrid().size === 20 &&
        pg.getGrid().snap === false && pg.getGrid().style === 'dots');
  pg.updateGrid({ size: 50, snap: true, style: 'lines', opacity: 0.5 });
  check('ปรับกริดได้ครบทุกค่า',
        pg.getGrid().size === 50 && pg.getGrid().snap === true &&
        pg.getGrid().style === 'lines' && pg.getGrid().opacity === 0.5);
  pg.updateGrid({ style: 'ไม่มีจริง' });
  check('รูปแบบกริดที่ไม่รู้จักถูกปฏิเสธ', pg.getGrid().style === 'lines');
  pg.updateGrid({ size: 9999 });
  check('ขนาดกริดถูกหนีบไม่เกิน 400', pg.getGrid().size === 400);
  check('snapTo ปัดเข้าเส้นกริด', snapTo(137, 50) === 150 && snapTo(24, 50) === 0 && snapTo(26, 50) === 50);
  check('snapTo size=0 → คืนค่าเดิม (กันหารศูนย์)', snapTo(137, 0) === 137);
  pg.updateGrid({ size: 50, snap: true });
  const snapped = pg.addNode('scene', 'snap', null, 137, 88);
  check('addNode ตอน snap เปิด → พิกัดถูกดูดเข้ากริด', snapped.x === 150 && snapped.y === 100);
  pg.updateGrid({ snap: false });
  const free = pg.addNode('scene', 'free', null, 137, 88);
  check('addNode ตอน snap ปิด → พิกัดตามที่สั่ง', free.x === 137 && free.y === 88);
  check('viewport เก็บ/อ่านได้', (pg.setViewport(30, -40, 1.5), pg.getViewport().x === 30 && pg.getViewport().zoom === 1.5));
  check('viewport zoom ถูกหนีบช่วง', (pg.setViewport(0, 0, 99), pg.getViewport().zoom === 8));

  console.log('\n--- planner-data v4: เส้นเชื่อม routing + หัวลูกศร ---');
  check('EDGE_ROUTINGS = straight/orthogonal/curved',
        EDGE_ROUTINGS.length === 3 && EDGE_ROUTINGS.includes('orthogonal') && EDGE_ROUTINGS.includes('curved'));
  check('ARROW_HEADS มีครบ 6 แบบ', ARROW_HEADS.length === 6 && ARROW_HEADS.includes('diamond'));
  check('validateRouting/validateArrow', validateRouting('curved') && !validateRouting('zigzag') &&
        validateArrow('circle') && !validateArrow('heart'));
  const pe = new PlannerData('/proj', mockIo());
  const ea = pe.addNode('scene', 'A', null, 0, 0);
  const eb = pe.addNode('scene', 'B', null, 400, 0);
  const ed = pe.addEdge(ea.id, 'right', eb.id, 'left', { routing: 'curved', arrowEnd: 'triangle' });
  check('addEdge เก็บ routing + arrowEnd', ed.routing === 'curved' && ed.arrowEnd === 'triangle' && ed.arrowStart === 'none');
  pe.updateEdge(ed.id, { routing: 'orthogonal', arrowStart: 'circle', arrowEnd: 'diamond' });
  check('updateEdge เปลี่ยน routing/หัวลูกศรได้',
        pe.getEdge(ed.id).routing === 'orthogonal' && pe.getEdge(ed.id).arrowStart === 'circle' &&
        pe.getEdge(ed.id).arrowEnd === 'diamond');
  pe.updateEdge(ed.id, { routing: 'ซิกแซก', arrowEnd: 'ปีก' });
  check('routing/หัวลูกศรที่ไม่รู้จักถูกปฏิเสธ',
        pe.getEdge(ed.id).routing === 'orthogonal' && pe.getEdge(ed.id).arrowEnd === 'diamond');
  pe.updateEdge(ed.id, { fromPort: 'top', toPort: 'auto' });
  check('เปลี่ยนจุดต่อ (port) ของเส้นได้ + รองรับ auto',
        pe.getEdge(ed.id).from.port === 'top' && pe.getEdge(ed.id).to.port === 'auto');
  check('edgesTouching คืนเฉพาะเส้นที่แตะโหนดที่ระบุ',
        pe.edgesTouching([ea.id]).length === 1 && pe.edgesTouching(['ไม่มีจริง']).length === 0);
  check('createDefaultEdge ค่าเริ่มต้น = โค้ง + หัวลูกศรปลายเดียว',
        createDefaultEdge('a', 'right', 'b', 'left').routing === 'curved' &&
        createDefaultEdge('a', 'right', 'b', 'left').arrowEnd === 'arrow');
  check('addEdge ปฏิเสธถ้าโหนดปลายทางไม่มีอยู่จริง', pe.addEdge(ea.id, 'top', 'ไม่มีโหนดนี้', 'left') === null);

  console.log('\n--- planner-data v4: เรขาคณิตเส้น (บั๊ก 9) ---');
  const boxA = { x: 0, y: 0, width: 100, height: 100 };
  const boxB = { x: 300, y: 0, width: 100, height: 100 };
  const pr = portPoint(boxA, 'right', { x: 350, y: 50 });
  check('portPoint right อยู่กลางขอบขวา', pr.x === 100 && pr.y === 50 && pr.dir.x === 1);
  const pauto = portPoint(boxA, 'auto', { x: 50, y: 900 });
  check('portPoint auto เลือกด้านที่หันไปหาเป้าหมาย (ล่าง)', pauto.port === 'bottom' && pauto.y === 100);
  const gStraight = edgeGeometry(boxA, boxB, { from: { port: 'right' }, to: { port: 'left' }, routing: 'straight' });
  check('เส้นตรง = 2 จุด', gStraight.kind === 'line' && gStraight.points.length === 2);
  const gCurve = edgeGeometry(boxA, boxB, { from: { port: 'right' }, to: { port: 'left' }, routing: 'curved' });
  check('เส้นโค้งเป็น bezier + มีจุดควบคุมยื่นตามทิศ port',
        gCurve.kind === 'bezier' && gCurve.c1.x > 100 && gCurve.c2.x < 300);
  check('edgePathString ของเส้นโค้งมีคำสั่ง C', /C /.test(edgePathString(gCurve)));
  const gOrtho = edgeGeometry(boxA, { x: 300, y: 300, width: 100, height: 100 },
    { from: { port: 'right' }, to: { port: 'top' }, routing: 'orthogonal' });
  check('เส้นหักมุมฉากมีจุดหักมากกว่า 2 และทุกช่วงตั้งฉาก',
        gOrtho.points.length > 2 && gOrtho.points.every((p, i) =>
          i === 0 || Math.abs(p.x - gOrtho.points[i - 1].x) < 0.01 || Math.abs(p.y - gOrtho.points[i - 1].y) < 0.01),
        JSON.stringify(gOrtho.points.map((p) => [Math.round(p.x), Math.round(p.y)])));
  const mid = edgeMidpoint(gStraight);
  check('edgeMidpoint ของเส้นตรงอยู่กึ่งกลางจริง', Math.abs(mid.x - 200) < 0.01 && Math.abs(mid.y - 50) < 0.01);
  const ang = edgeAngles(gStraight);
  check('edgeAngles ปลายทางชี้ไปทางขวา (0°)', Math.abs(ang.end) < 0.01);

  console.log('\n--- planner-data v4: migrate v3→v4 + หลายกระดาน (บั๊ก 5) ---');
  const pm4 = new PlannerData('/proj', mockIo());
  pm4._parse({ version: '3.0',
    nodes: [{ id: 'x1', type: 'scene', title: 'เก่า', x: 0, y: 0, width: 180, height: 110 }],
    edges: [{ id: 'x1e', from: { nodeId: 'x1', port: 'right' }, to: { nodeId: 'x1', port: 'left' } }] });
  check('v3 → v4 เติม textColor/fontSize/shape/locked ให้โหนด',
        pm4.getNode('x1').textColor === '#faf9f5' && pm4.getNode('x1').fontSize > 0 &&
        pm4.getNode('x1').shape === 'rect' && pm4.getNode('x1').locked === false);
  check('v3 → v4 เติม settings.grid ให้กระดานเก่า', pm4.getGrid().size === DEFAULT_GRID.size);

  const io2 = mockIo();
  const pb1 = new PlannerData('/proj', io2);
  await pb1.load();
  check('load: ไม่มีไฟล์ → กระดานว่าง ไม่ dirty', pb1.isEmpty() && pb1.isDirty() === false);
  check('ชื่อกระดานเริ่มต้น = กระดานหลัก (planner.json)', pb1.getName() === 'กระดานหลัก' && pb1.getFileBase() === 'planner');
  pb1.addNode('scene', 'ก', null, 10, 10);
  check('แก้แล้ว dirty', pb1.isDirty() === true);
  await pb1.save();
  check('save เขียนไฟล์ + ล้าง dirty', io2.files['/proj/planner.json'] && pb1.isDirty() === false);
  await pb1.saveAs('/proj/Planners/กระดานสอง.json');
  check('saveAs เขียนไฟล์ใหม่ + ย้าย path ปัจจุบันตามไป',
        !!io2.files['/proj/Planners/กระดานสอง.json'] && pb1.getName() === 'กระดานสอง');
  pb1.reset('/proj/Planners/ใหม่.json');
  check('reset = กระดานเปล่าใบใหม่', pb1.isEmpty() && pb1.getName() === 'ใหม่' && pb1.isDirty() === false);
  const pb2 = new PlannerData('/proj', io2);
  await pb2.load('/proj/Planners/กระดานสอง.json');
  check('เปิดกระดานอีกใบแล้วได้ข้อมูลของใบนั้น',
        pb2.getAllNodes().length === 1 && pb2.getAllNodes()[0].title === 'ก');

  console.log('\n--- planner-data v4: ลำดับซ้อนทับ (บั๊ก 65r2-1) ---');
  const pz = new PlannerData('/proj', mockIo());
  const za = pz.addNode('scene', 'A'), zb = pz.addNode('scene', 'B'), zc = pz.addNode('scene', 'C');
  check('ลำดับเริ่มต้นเรียงตามที่สร้าง', pz.nodeZ(za.id) === 0 && pz.nodeZ(zc.id) === 2);
  pz.moveNodeZ(za.id, 'front');
  check('bring to front', pz.nodeZ(za.id) === 2 && pz.nodeZ(zb.id) === 0);
  pz.moveNodeZ(za.id, 'backward');
  check('send backward', pz.nodeZ(za.id) === 1);
  pz.moveNodeZ(za.id, 'forward');
  check('bring forward', pz.nodeZ(za.id) === 2);
  pz.moveNodeZ(za.id, 'back');
  check('send to back', pz.nodeZ(za.id) === 0);
  pz.moveNodeZ(za.id, 'backward');
  check('ล่างสุดแล้วสั่งลดอีก = คงเดิม ไม่พัง', pz.nodeZ(za.id) === 0);
  pz.moveNodeZ(zc.id, 'forward');
  check('บนสุดแล้วสั่งขึ้นอีก = คงเดิม', pz.nodeZ(zc.id) === 2);
  pz.moveNodeZ([za.id, zb.id], 'front');
  check('ยกหลายใบพร้อมกัน ลำดับภายในกลุ่มคงเดิม',
        pz.nodeZ(zc.id) === 0 && pz.nodeZ(za.id) === 1 && pz.nodeZ(zb.id) === 2);
  check('mode ที่ไม่รู้จัก → false', pz.moveNodeZ(za.id, 'ไม่มีโหมดนี้') === false);
  check('id ที่ไม่มีจริง → false', pz.moveNodeZ('ไม่มี', 'front') === false);

  console.log('\n--- planner-data v4: ร่นปลายเส้นให้หัวลูกศร (บั๊ก 65r2-3) ---');
  const tgStraight = edgeGeometry({ x: 0, y: 0, width: 100, height: 100 },
                                  { x: 300, y: 0, width: 100, height: 100 },
                                  { from: { port: 'right' }, to: { port: 'left' }, routing: 'straight' });
  const trimmed = trimGeometry(tgStraight, 0, 10);
  check('ร่นปลายทาง 10px → จุดสุดท้ายขยับเข้ามา 10',
        Math.abs(trimmed.points[1].x - 290) < 0.01 && Math.abs(tgStraight.points[1].x - 300) < 0.01);
  check('trimGeometry ไม่แก้ของเดิม (คืนชุดใหม่)', tgStraight.points[1].x === 300);
  const trimmed2 = trimGeometry(tgStraight, 12, 0);
  check('ร่นต้นทางได้เหมือนกัน', Math.abs(trimmed2.points[0].x - 112) < 0.01);
  check('ไม่ร่น → คืนวัตถุเดิม', trimGeometry(tgStraight, 0, 0) === tgStraight);
  const tgCurve = edgeGeometry({ x: 0, y: 0, width: 100, height: 100 },
                               { x: 300, y: 0, width: 100, height: 100 },
                               { from: { port: 'right' }, to: { port: 'left' }, routing: 'curved' });
  const trimCurve = trimGeometry(tgCurve, 0, 8);
  check('เส้นโค้งก็ร่นได้ + ยังเป็น bezier',
        trimCurve.kind === 'bezier' && trimCurve.points[1].x < tgCurve.points[1].x);
  const tgOrtho = edgeGeometry({ x: 0, y: 0, width: 100, height: 100 },
                               { x: 300, y: 300, width: 100, height: 100 },
                               { from: { port: 'right' }, to: { port: 'top' }, routing: 'orthogonal' });
  const trimO = trimGeometry(tgOrtho, 0, 9);
  check('เส้นหักมุมฉาก: ร่นเฉพาะช่วงสุดท้าย จุดหักอื่นไม่ขยับ',
        trimO.points.length === tgOrtho.points.length &&
        Math.abs(trimO.points[1].x - tgOrtho.points[1].x) < 0.01 &&
        Math.abs(trimO.points[trimO.points.length - 1].y - (tgOrtho.points[tgOrtho.points.length - 1].y - 9)) < 0.01);
  check('ร่นเกินความยาวช่วง → ไม่กลับทิศ (คงจุดเดิม)',
        trimGeometry(tgStraight, 0, 9999).points[1].x === 300);

  console.log('\n--- planner-data v4: ทดสอบการคลิกโดนเส้นด้วยระยะจริง (บั๊ก 65r3-3) ---');
  const boxL = { x: 0, y: 0, width: 100, height: 100 };
  const boxR = { x: 600, y: 600, width: 100, height: 100 };
  const diag = edgeGeometry(boxL, boxR, { from: { port: 'right' }, to: { port: 'left' }, routing: 'straight' });
  const diagPts = sampleGeometry(diag);
  check('เส้นตรง: sampleGeometry คืนจุดหัวท้าย', diagPts.length === 2);
  check('จุดกลางเส้นทแยง → ระยะ ~0',
        distanceToPolyline({ x: (diagPts[0].x + diagPts[1].x) / 2, y: (diagPts[0].y + diagPts[1].y) / 2 }, diagPts) < 0.01);
  // มุมของกรอบสี่เหลี่ยมที่ครอบเส้นทแยง — fabric เคยนับว่า "โดน" ทั้งที่ห่างเป็นร้อยพิกเซล
  const corner = { x: diagPts[0].x, y: diagPts[1].y };
  check('มุมกรอบสี่เหลี่ยมของเส้นทแยง อยู่ห่างจากตัวเส้นมาก (ต้องไม่นับว่าโดน)',
        distanceToPolyline(corner, diagPts) > 200, Math.round(distanceToPolyline(corner, diagPts)));
  // เส้นทแยงจริงคือ (100,50) → (600,650) ไม่ใช่ 45° → คำนวณเวกเตอร์ตั้งฉากเอา
  const dvx = diagPts[1].x - diagPts[0].x, dvy = diagPts[1].y - diagPts[0].y;
  const dlen = Math.hypot(dvx, dvy);
  const perp = { x: -dvy / dlen, y: dvx / dlen };
  const midD = { x: (diagPts[0].x + diagPts[1].x) / 2, y: (diagPts[0].y + diagPts[1].y) / 2 };
  check('ห่างจากเส้นตั้งฉาก 10px → ระยะ ~10',
        Math.abs(distanceToPolyline({ x: midD.x + perp.x * 10, y: midD.y + perp.y * 10 }, diagPts) - 10) < 0.01);
  check('เลยปลายเส้นไป → วัดจากปลาย ไม่ใช่จากเส้นที่ยืดต่อออกไป',
        Math.abs(distanceToPolyline({ x: diagPts[1].x + 100, y: diagPts[1].y }, diagPts) - 100) < 0.01,
        distanceToPolyline({ x: diagPts[1].x + 100, y: diagPts[1].y }, diagPts));
  const curveG = edgeGeometry(boxL, boxR, { from: { port: 'right' }, to: { port: 'left' }, routing: 'curved' });
  const curvePts = sampleGeometry(curveG, 20);
  check('เส้นโค้ง: แตกเป็นจุดย่อย 21 จุด', curvePts.length === 21);
  check('เส้นโค้ง: ทุกจุดที่แตกออกมาอยู่บนเส้น (ระยะ ~0)',
        curvePts.every((p) => distanceToPolyline(p, curvePts) < 0.01));
  check('เส้นโค้ง: จุดหัว/ท้ายตรงกับ start/end',
        Math.abs(curvePts[0].x - curveG.start.x) < 0.01 &&
        Math.abs(curvePts[curvePts.length - 1].x - curveG.end.x) < 0.01);
  check('distanceToPolyline: จุดน้อยกว่า 2 → Infinity',
        distanceToPolyline({ x: 0, y: 0 }, [{ x: 1, y: 1 }]) === Infinity &&
        distanceToPolyline({ x: 0, y: 0 }, []) === Infinity);
  check('ท่อนยาวศูนย์ไม่ทำให้หารศูนย์',
        Math.abs(distanceToPolyline({ x: 3, y: 4 }, [{ x: 0, y: 0 }, { x: 0, y: 0 }]) - 5) < 0.01);

  console.log('\n--- planner-data v4: ล็อก + bounds ---');
  const pl = new PlannerData('/proj', mockIo());
  const ln = pl.addNode('scene', 'ล็อก', null, 0, 0);
  pl.updateNode(ln.id, { locked: true });
  check('ล็อกการ์ดได้', pl.isLocked(ln.id) === true);
  pl.addNode('scene', 'ไกล', null, 500, 400);
  const bd = pl.bounds();
  check('bounds ครอบทุกโหนด', bd.x === 0 && bd.y === 0 && bd.right === 680 && bd.bottom === 510,
        JSON.stringify(bd));
  check('bounds ของกระดานว่าง = null', new PlannerData('/proj', mockIo()).bounds() === null);

  // ═══════════ [alpha.150] ขอบ · พื้น · รูป · รายการติ๊ก · snap ขนาด · พื้นหลังกระดาน ═══════════
  console.log('\n--- alpha.150: ชนิดโหนดใหม่ + ช่องใหม่ ---');
  check('[150] ชนิดโหนดมี image และ todo',
        NODE_TYPES.includes('image') && NODE_TYPES.includes('todo'));
  check('[150] วิธีวางรูปมีสี่แบบ', IMAGE_FITS.join(',') === 'full,fit,fill,tile');
  check('[150] validateFit คัดค่าที่ไม่รู้จักออก',
        validateFit('fill') === true && validateFit('zoom') === false);

  const p150 = new PlannerData('/proj', mockIo());
  const nb150 = p150.addNode('scene', 'ขอบ', null, 0, 0);
  check('[150] การ์ดใหม่มีช่องขอบ/พื้นครบ',
        nb150.borderWidth === 1 && nb150.borderColor === '' && nb150.fillOpacity === 1);
  p150.updateNode(nb150.id, { borderColor: '#ff0000', borderWidth: 99, fillOpacity: 5 });
  const nb150b = p150.getNode(nb150.id);
  check('[150] ความหนาขอบถูกหนีบที่ 12', nb150b.borderWidth === 12, nb150b.borderWidth);
  check('[150] ความจางพื้นถูกหนีบที่ 1', nb150b.fillOpacity === 1, nb150b.fillOpacity);
  check('[150] สีขอบเก็บได้', nb150b.borderColor === '#ff0000');
  p150.updateNode(nb150.id, { borderWidth: 0 });
  check('[150] ความหนา 0 = ไม่มีขอบ (ไม่ใช่ตกกลับเป็นค่าเริ่มต้น)',
        p150.getNode(nb150.id).borderWidth === 0);

  const img150 = p150.addNode('image', 'รูป', null, 10, 10);
  check('[150] การ์ดรูปไม่มีขอบเป็นค่าเริ่มต้น', img150.borderWidth === 0);
  p150.updateNode(img150.id, { fit: 'tile', blur: 99, src: 'Images/a.png' });
  const img150b = p150.getNode(img150.id);
  check('[150] วิธีวางรูปเปลี่ยนได้', img150b.fit === 'tile');
  check('[150] ค่าเบลอถูกหนีบที่ 30', img150b.blur === 30, img150b.blur);
  p150.updateNode(img150.id, { fit: 'ไม่มีจริง' });
  check('[150] วิธีวางที่ไม่รู้จักถูกปฏิเสธ (ค่าเดิมอยู่)', p150.getNode(img150.id).fit === 'tile');

  console.log('\n--- alpha.150: รายการสิ่งที่ต้องทำ ---');
  check('[150] normTodoItems รับทั้ง string และ object',
        JSON.stringify(normTodoItems(['ก', { text: 'ข', done: true }]))
          === JSON.stringify([{ text: 'ก', done: false }, { text: 'ข', done: true }]));
  check('[150] normTodoItems ค่าที่ไม่ใช่ array → []', normTodoItems(null).length === 0);
  const prog150 = todoProgress([{ text: 'a', done: true }, { text: 'b' }, { text: 'c' }]);
  check('[150] ความคืบหน้า 1/3 = 33%',
        prog150.done === 1 && prog150.total === 3 && prog150.percent === 33, JSON.stringify(prog150));
  check('[150] รายการว่าง = 0%', todoProgress([]).percent === 0);
  const tg150 = toggleTodo([{ text: 'a', done: false }], 0);
  check('[150] toggleTodo คืนก้อนใหม่ที่ติ๊กแล้ว', tg150[0].done === true);
  check('[150] toggleTodo ดัชนีนอกช่วง = ไม่เปลี่ยนอะไร',
        toggleTodo([{ text: 'a' }], 5)[0].done === false);
  const parsed150 = parseTodoText('[x] ทำแล้ว\n- [ ] ยังไม่ทำ\nเปล่า ๆ\n   ');
  check('[150] parseTodoText อ่านสามรูปแบบ + ทิ้งบรรทัดว่าง',
        parsed150.length === 3 && parsed150[0].done === true && parsed150[1].done === false
        && parsed150[1].text === 'ยังไม่ทำ' && parsed150[2].text === 'เปล่า ๆ', JSON.stringify(parsed150));
  check('[150] todoToText ↔ parseTodoText เป็นทางกลับกัน',
        JSON.stringify(parseTodoText(todoToText(parsed150))) === JSON.stringify(parsed150));

  const td150 = p150.addNode('todo', 'งาน', null, 0, 0,
                          { items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] });
  const TL150 = TODO_LAYOUT;
  const hit150 = todoRowAt(td150, TL150.padX + 2, TL150.headH + 4);
  check('[150] คลิกช่องติ๊กของข้อแรกได้ข้อ 0', hit150.index === 0 && hit150.onBox === true,
        JSON.stringify(hit150));
  const hitText150 = todoRowAt(td150, TL150.padX + TL150.boxSize + 40, TL150.headH + 4);
  check('[150] คลิกบนตัวหนังสือ = ข้อเดียวกันแต่ไม่ใช่ช่องติ๊ก',
        hitText150.index === 0 && hitText150.onBox === false, JSON.stringify(hitText150));
  check('[150] คลิกข้อที่สาม', todoRowAt(td150, TL150.padX, TL150.headH + TL150.rowH * 2 + 4).index === 2);
  check('[150] คลิกเหนือหัว = ไม่โดนข้อไหน', todoRowAt(td150, TL150.padX, 4).index === -1);
  check('[150] คลิกใต้ข้อสุดท้าย = ไม่โดนข้อไหน',
        todoRowAt(td150, TL150.padX, TL150.headH + TL150.rowH * 9).index === -1);
  // เลื่อนเนื้อหาในการ์ดแล้ว การคลิกต้องเลื่อนตาม (ไม่งั้นติ๊กผิดข้อ)
  p150.updateNode(td150.id, { scrollY: TL150.rowH });
  check('[150] เลื่อนลงหนึ่งแถวแล้วตำแหน่งเดิมกลายเป็นข้อถัดไป',
        todoRowAt(p150.getNode(td150.id), TL150.padX, TL150.headH + 4).index === 1);
  check('[150] ความสูงเนื้อหาของรายการนับจากจำนวนข้อ',
        todoContentHeight(td150) === TL150.headH + 3 * TL150.rowH + 6, todoContentHeight(td150));

  console.log('\n--- alpha.150: snap ขนาด + พื้นหลังกระดาน ---');
  const ps150 = new PlannerData('/proj', mockIo());
  ps150.updateGrid({ snap: true, size: 20 });
  check('[150] snapSize ปัดขนาดเข้ากริด', ps150.snapSize(47) === 40, ps150.snapSize(47));
  check('[150] snapSize ไม่ยอมให้ขนาดเป็นศูนย์', ps150.snapSize(3) === 20, ps150.snapSize(3));
  const sb150 = ps150.snapBox({ x: 13, y: 27, width: 47, height: 3 });
  check('[150] snapBox ปัดทั้งตำแหน่งและขนาด',
        sb150.x === 20 && sb150.y === 20 && sb150.width === 40 && sb150.height === 20, JSON.stringify(sb150));
  ps150.updateGrid({ snap: false });
  check('[150] ปิด snap แล้วขนาดไม่ถูกปัด', ps150.snapSize(47) === 47);

  check('[150] พื้นหลังกระดานเริ่มต้นว่าง',
        ps150.getBackgroundImage().src === '' && ps150.getBackgroundImage().fit === 'fill');
  ps150.setBackgroundImage({ src: 'Images/bg150.png', blur: 8, opacity: 0.4, fit: 'tile' });
  const bg150 = ps150.getBackgroundImage();
  check('[150] ตั้งรูปพื้นหลังได้ครบทุกช่อง',
        bg150.src === 'Images/bg150.png' && bg150.blur === 8 && bg150.opacity === 0.4 && bg150.fit === 'tile',
        JSON.stringify(bg150));
  ps150.setBackgroundImage({ blur: 999, opacity: -3, fit: 'มั่ว' });
  const bg150b = ps150.getBackgroundImage();
  check('[150] ค่านอกช่วงถูกหนีบ · วิธีวางที่ไม่รู้จักตกเป็นค่าเดิมของระบบ',
        bg150b.blur === 30 && bg150b.opacity === 0 && bg150b.fit === 'fill', JSON.stringify(bg150b));
  check('[150] _normBgImage รับค่าขยะได้โดยไม่พัง',
        _normBgImage(null).src === '' && _normBgImage('x').fit === 'fill');

  // ค่าใหม่ทั้งหมดต้องรอดการเขียนลงไฟล์แล้วอ่านกลับ (ไม่งั้นบันทึกแล้วหาย)
  const io150 = mockIo();
  const pw150 = new PlannerData('/proj', io150, '/proj/b.json');
  pw150.setBackgroundImage({ src: 'Images/bg150.png', blur: 5, opacity: 0.5, fit: 'fit' });
  const wn150 = pw150.addNode('todo', 'งาน', null, 0, 0,
    { items: [{ text: 'ก', done: true }], borderColor: '#123456', borderWidth: 3,
      fill: '#abcdef', fillOpacity: 0.25, scrollY: 40 });
  pw150.updateNode(wn150.id, { src: 'Images/x.png', fit: 'fill', blur: 4 });
  await pw150.save();
  const pr150 = new PlannerData('/proj', io150, '/proj/b.json');
  await pr150.load();
  const rn150 = pr150.getAllNodes()[0];
  check('[150] บันทึกแล้วอ่านกลับ: ขอบ/พื้น/รูป/เลื่อน ครบ',
        rn150.borderColor === '#123456' && rn150.borderWidth === 3 && rn150.fill === '#abcdef'
        && rn150.fillOpacity === 0.25 && rn150.src === 'Images/x.png' && rn150.fit === 'fill'
        && rn150.blur === 4 && rn150.scrollY === 40, JSON.stringify(rn150));
  check('[150] บันทึกแล้วอ่านกลับ: รายการติ๊กครบ',
        rn150.items.length === 1 && rn150.items[0].done === true && rn150.items[0].text === 'ก');
  check('[150] บันทึกแล้วอ่านกลับ: รูปพื้นหลังกระดานครบ',
        pr150.getBackgroundImage().src === 'Images/bg150.png' && pr150.getBackgroundImage().blur === 5,
        JSON.stringify(pr150.getBackgroundImage()));
  check('[150] กระดานรุ่นเก่า (ไม่มีช่องใหม่) โหลดแล้วได้ค่าเริ่มต้น ไม่พัง',
        (() => {
          const old = new PlannerData('/p', mockIo());
          old._parse({ version: '4.0', nodes: [{ id: 'a', type: 'scene' }] });
          const n0 = old.getNode('a');
          return n0.borderWidth === 1 && n0.fillOpacity === 1 && n0.src === ''
                 && old.getBackgroundImage().src === '';
        })());

  // ═══════════ [alpha.150r] รูปปรับขนาดได้ + เลื่อนแนวนอน + ไอคอนออกจากโค้ด ═══════════
  console.log('\n--- alpha.150r: ขนาดรูป + เลื่อนสองแกน ---');
  const imgBoard150r = new PlannerData('/proj', mockIo());
  const im150 = imgBoard150r.addNode('image', 'รูป', null, 0, 0);
  check('[150r] รูปใหม่เริ่มที่ขนาดพอดีกรอบ (100%)', im150.scale === 1, im150.scale);
  check('[150r] รูปใหม่ยังไม่เลื่อนทั้งสองแกน', im150.scrollX === 0 && im150.scrollY === 0);
  imgBoard150r.updateNode(im150.id, { scale: 2.5 });
  check('[150r] ขยายรูปได้', imgBoard150r.getNode(im150.id).scale === 2.5);
  imgBoard150r.updateNode(im150.id, { scale: 99 });
  check('[150r] ขนาดรูปถูกหนีบที่เพดาน', imgBoard150r.getNode(im150.id).scale === IMG_SCALE_MAX,
        imgBoard150r.getNode(im150.id).scale);
  imgBoard150r.updateNode(im150.id, { scale: 0 });
  check('[150r] ขนาดรูปถูกหนีบที่พื้น', imgBoard150r.getNode(im150.id).scale === IMG_SCALE_MIN,
        imgBoard150r.getNode(im150.id).scale);
  check('[150r] ช่วงขนาดครอบทั้งย่อและขยาย', IMG_SCALE_MIN < 1 && IMG_SCALE_MAX > 1);
  imgBoard150r.updateNode(im150.id, { scrollX: 120, scrollY: 40 });
  check('[150r] ★ เลื่อนแนวนอนเก็บได้ (รูปไม่ตัดบรรทัด จึงล้นด้านข้างได้จริง)',
        imgBoard150r.getNode(im150.id).scrollX === 120 && imgBoard150r.getNode(im150.id).scrollY === 40);
  imgBoard150r.updateNode(im150.id, { scrollX: -50 });
  check('[150r] เลื่อนแนวนอนติดลบไม่ได้', imgBoard150r.getNode(im150.id).scrollX === 0);

  // ค่าที่เพิ่มต้องรอดการบันทึก/อ่านกลับเหมือนช่องอื่น
  const ioR = mockIo();
  const pwR = new PlannerData('/proj', ioR, '/proj/r.json');
  const nR = pwR.addNode('image', 'รูป', null, 0, 0);
  pwR.updateNode(nR.id, { src: 'Images/a.png', scale: 2, scrollX: 33, scrollY: 12 });
  await pwR.save();
  const prR = new PlannerData('/proj', ioR, '/proj/r.json');
  await prR.load();
  const backR = prR.getAllNodes()[0];
  check('[150r] บันทึกแล้วอ่านกลับ: ขนาดรูปและตำแหน่งเลื่อนสองแกนครบ',
        backR.scale === 2 && backR.scrollX === 33 && backR.scrollY === 12, JSON.stringify(backR));
  check('[150r] กระดานรุ่นเก่าที่ไม่มีช่องพวกนี้ → ได้ค่าเริ่มต้น ไม่พัง',
        (() => {
          const o = new PlannerData('/p', mockIo());
          o._parse({ version: '4.0', nodes: [{ id: 'i', type: 'image', src: 'Images/x.png' }] });
          const g = o.getNode('i');
          return g.scale === 1 && g.scrollX === 0 && g.scrollY === 0;
        })());


  // ═══════════ [alpha.151] จัดข้อความในการ์ด · รูปในการ์ด · ดัดเส้นหักมุมฉาก ═══════════
  console.log('\n--- alpha.151: จัดข้อความในการ์ด ---');
  const p151 = new PlannerData('/proj', mockIo());
  const c151 = p151.addNode('scene', 'ฉาก', null, 0, 0);
  check('[151] การ์ดใหม่: ข้อความชิดซ้ายบนเป็นค่าเริ่มต้น',
        c151.textAlign === 'left' && c151.textVAlign === 'top');
  p151.updateNode(c151.id, { textAlign: 'center', textVAlign: 'middle' });
  check('[151] ★ จัดข้อความได้ทั้งสองแกน',
        p151.getNode(c151.id).textAlign === 'center' &&
        p151.getNode(c151.id).textVAlign === 'middle');
  const beforeXY = { x: p151.getNode(c151.id).x, y: p151.getNode(c151.id).y };
  p151.updateNode(c151.id, { textVAlign: 'bottom' });
  check('[151] ★★ จัดข้อความแล้ว **ตำแหน่งการ์ดไม่ขยับ** (ผู้ใช้: "ไม่ใช่ขยับ card")',
        p151.getNode(c151.id).x === beforeXY.x && p151.getNode(c151.id).y === beforeXY.y);
  p151.updateNode(c151.id, { textAlign: 'มั่ว', textVAlign: 'มั่ว' });
  check('[151] ค่าที่ไม่รู้จักถูกปฏิเสธ (ค่าเดิมอยู่)',
        p151.getNode(c151.id).textAlign === 'center' &&
        p151.getNode(c151.id).textVAlign === 'bottom');
  check('[151] รายการทิศครบสามค่าในแต่ละแกน',
        TEXT_ALIGNS.join(',') === 'left,center,right' &&
        TEXT_VALIGNS.join(',') === 'top,middle,bottom');

  console.log('\n--- alpha.151: รูปในการ์ด (ไม่ใช่แค่การ์ดที่เป็นรูปทั้งใบ) ---');
  p151.updateNode(c151.id, { src: 'Images/a.png', imageH: 0.6 });
  check('[151] ★ การ์ดฉากใส่รูปได้',
        p151.getNode(c151.id).src === 'Images/a.png' && p151.getNode(c151.id).imageH === 0.6);
  p151.updateNode(c151.id, { imageH: 9 });
  check('[151] สัดส่วนความสูงของรูปถูกหนีบไม่เกินเต็มการ์ด', p151.getNode(c151.id).imageH === 1);

  console.log('\n--- alpha.151: ดัดเส้นหักมุมฉาก ---');
  {
    const a151 = p151.addNode('scene', 'A', null, 0, 0, { width: 100, height: 60 });
    const b151 = p151.addNode('scene', 'B', null, 400, 300, { width: 100, height: 60 });
    const e151 = p151.addEdge(a151.id, 'right', b151.id, 'left', { routing: 'orthogonal' });
    check('[151-9] เส้นใหม่ยังไม่ถูกดัด', Array.isArray(e151.bends) && e151.bends.length === 0);
    const boxA = { x: 0, y: 0, width: 100, height: 60 };
    const boxB = { x: 400, y: 300, width: 100, height: 60 };
    const g0 = edgeGeometry(boxA, boxB, e151);
    const h0 = bendHandles(g0);
    check('[151-9] ★ เส้นหักมุมฉากมีมือจับให้ลากอย่างน้อยหนึ่งจุด', h0.length >= 1, h0.length);
    check('[151-9] มือจับอยู่กลางท่อนจริง ๆ (ไม่ใช่ที่ปลายเส้น)',
          h0.every((h) => (h.axis === 'v' || h.axis === 'h')
                          && h.index >= 1 && h.index <= g0.points.length - 3),
          JSON.stringify(h0));
    // ลากท่อนแรกออกไป 40 หน่วย แล้วเส้นต้องขยับตามจริง
    const moved = { ...e151, bends: setBend(e151.bends, h0[0].index, 40) };
    const g1 = edgeGeometry(boxA, boxB, moved);
    const h1 = bendHandles(g1);
    const sameIdx = h1.find((h) => h.index === h0[0].index);
    const delta = h0[0].axis === 'v' ? sameIdx.x - h0[0].x : sameIdx.y - h0[0].y;
    check('[151-9] ★★ ลากมือจับแล้วท่อนนั้นเลื่อนไปตามระยะที่ลากจริง',
          Math.abs(delta - 40) < 0.01, delta);
    check('[151-9] ★ ปลายเส้นทั้งสองข้างยังเกาะขอบการ์ดเหมือนเดิม (ไม่หลุดออกจากพอร์ต)',
          Math.abs(g1.start.x - g0.start.x) < 0.01 && Math.abs(g1.start.y - g0.start.y) < 0.01 &&
          Math.abs(g1.end.x - g0.end.x) < 0.01 && Math.abs(g1.end.y - g0.end.y) < 0.01);
    check('[151-9] ★ เส้นยังเป็นมุมฉากทุกท่อนหลังดัด',
          g1.points.every((pt, i) => i === 0 ||
            Math.abs(pt.x - g1.points[i - 1].x) < 0.01 || Math.abs(pt.y - g1.points[i - 1].y) < 0.01),
          JSON.stringify(g1.points));
    // ★ เก็บเป็น "ระยะ" ไม่ใช่พิกัด — การ์ดย้ายแล้วเส้นต้องตามไป แต่รูปทรงที่ดัดไว้ยังอยู่
    const boxAmoved = { x: 60, y: 40, width: 100, height: 60 };
    const g2 = edgeGeometry(boxAmoved, boxB, moved);
    check('[151-9] ★★ ย้ายการ์ดแล้วเส้นตามไปเกาะขอบใหม่ (ไม่ค้างที่เดิม)',
          Math.abs(g2.start.x - 160) < 0.01, g2.start.x);
    const h2 = bendHandles(g2);
    check('[151-9] ★★ …และรูปทรงที่ผู้ใช้ดัดไว้ยังอยู่ครบ', h2.length === h1.length, h2.length);

    p151.updateEdge(e151.id, { bends: [0, 40, 0] });
    check('[151-9] บันทึกค่าดัดลงเส้นได้', p151.getEdge(e151.id).bends[1] === 40);
    p151.updateEdge(e151.id, { bends: 'มั่ว' });
    check('[151-9] ค่าที่ไม่ใช่รายการตัวเลข = ไม่มีการดัด', p151.getEdge(e151.id).bends.length === 0);
    check('[151-9] setBend ยืดรายการให้พอกับดัชนีที่ขอ',
          setBend([], 3, 10).length === 4 && setBend([], 3, 10)[3] === 10);
    check('[151-9] applyBends กับเส้นสั้น ๆ ไม่พัง',
          applyBends([{ x: 0, y: 0 }, { x: 10, y: 0 }], [5]).length === 2);
    check('[151-9] เส้นตรง/เส้นโค้งไม่มีมือจับ (ดัดได้เฉพาะหักมุมฉาก)',
          bendHandles({ kind: 'bezier', points: [] }).length === 0);
  }

  // บันทึกแล้วอ่านกลับ — ช่องใหม่ต้องรอดทั้งหมด
  {
    const ioA = mockIo();
    const pw2 = new PlannerData('/proj', ioA, '/proj/a151.json');
    const n1 = pw2.addNode('scene', 'ก', null, 0, 0);
    const n2 = pw2.addNode('scene', 'ข', null, 300, 300);
    pw2.updateNode(n1.id, { textAlign: 'right', textVAlign: 'bottom', src: 'Images/x.png', imageH: 0.3 });
    const ed = pw2.addEdge(n1.id, 'right', n2.id, 'left', { routing: 'orthogonal' });
    pw2.updateEdge(ed.id, { bends: [0, 25] });
    await pw2.save();
    const pr2 = new PlannerData('/proj', ioA, '/proj/a151.json');
    await pr2.load();
    const back = pr2.getAllNodes()[0];
    check('[151] บันทึกแล้วอ่านกลับ: การจัดข้อความ + รูปในการ์ดครบ',
          back.textAlign === 'right' && back.textVAlign === 'bottom'
          && back.src === 'Images/x.png' && back.imageH === 0.3, JSON.stringify(back));
    check('[151-9] บันทึกแล้วอ่านกลับ: ค่าดัดเส้นครบ',
          pr2.getAllEdges()[0].bends[1] === 25, JSON.stringify(pr2.getAllEdges()[0].bends));
    check('[151] กระดานรุ่นเก่าไม่มีช่องใหม่ → ค่าเริ่มต้น ไม่พัง',
          (() => {
            const o = new PlannerData('/p', mockIo());
            o._parse({ version: '4.0', nodes: [{ id: 'z', type: 'scene' }],
                       edges: [] });
            const z = o.getNode('z');
            return z.textAlign === 'left' && z.textVAlign === 'top' && z.imageH === 0.45;
          })());
  }

  console.log('\n--- alpha.150r: ไอคอนต้องมาจากทะเบียน ไม่ใช่ฮาร์ดโค้ด ---');
  {
    // กฎ alpha.147: "อย่าเขียนไอคอนลงโค้ด — เปลี่ยนไอคอน = วาง svg ชื่อเดิมลง icons/svg/"
    // ICONS จึงต้องเก็บแค่ **ชื่อ** และทุกชื่อต้องมีของจริงอยู่ในทะเบียน
    const glyphCsv = fs.readFileSync(path.join(__dirname, '..', 'icons', 'glyphs.csv'), 'utf8');
    const svgDir = fs.readdirSync(path.join(__dirname, '..', 'icons', 'svg'));
    const known = new Set(glyphCsv.split(/\r?\n/).slice(1)
      .map((l) => l.split(',')[0]).filter(Boolean));
    for (const f of svgDir) if (f.endsWith('.svg')) known.add(f.slice(0, -4));
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
    const badIcon = Object.entries(ICONS).filter(([, v]) => emoji.test(String(v)));
    check('[150r] ★ ตาราง ICONS ไม่มีอีโมจิฮาร์ดโค้ดแล้ว (เก็บชื่อไอคอนอย่างเดียว)',
          badIcon.length === 0, JSON.stringify(badIcon));
    const missing = Object.entries(ICONS).filter(([, v]) => !known.has(v));
    check('[150r] ★ ทุกชื่อไอคอนของกระดานมีอยู่จริงในทะเบียน (svg หรือตัวสำรอง)',
          missing.length === 0, JSON.stringify(missing));
    check('[150r] ทุกชนิดโหนดมีไอคอนกำกับครบ',
          NODE_TYPES.every((t) => !!ICONS[t]), NODE_TYPES.filter((t) => !ICONS[t]).join(','));
  }

}

// ================================================
v4Tests().then(() => {
  console.log('\n--- RESULT ---');
  console.log(`PASS ${pass}  FAIL ${fail}`);
  if (fail > 0) process.exit(1);
}).catch((e) => { console.error('FAIL v4Tests threw', e); process.exit(1); });
