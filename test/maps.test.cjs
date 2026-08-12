// test/maps.test.cjs — ทดสอบเอนจินแผนที่ (src/maps.js) ด้วย node
// ครอบ: หมุด/ลำดับชั้น portal · ซูม · โอเวอร์เลย์ · หมวด · ค้นหา · หลายหมุด · เส้นทาง · ฉากบนหมุด · migrate
const path = require('path');
const out = path.join(require('os').tmpdir(), '_maps.cjs');   // '/tmp' ใช้บน Windows ไม่ได้
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/maps.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const M = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ═══════════ พื้นฐาน: สร้าง/หนีบ/เรียง ═══════════
{
  const m = M.newMap('โลกเหนือ', 'Images/w.png');
  check('newMap: มี id/ชื่อ/รูป', !!m.id && m.name === 'โลกเหนือ' && m.image === 'Images/w.png');
  check('newMap: มีคีย์ใหม่ครบ (category/routes/overlays)',
        m.category === '' && Array.isArray(m.routes) && !!m.overlays, JSON.stringify(Object.keys(m)));
  check('newMap: ชื่อว่าง → ชื่อเริ่มต้น', M.newMap('').name === 'แผนที่ใหม่');

  const p = M.newPin(30, 40, 'portal');
  check('newPin: พิกัด + ชนิด', p.x === 30 && p.y === 40 && p.kind === 'portal');
  check('newPin: ชนิดเริ่มต้น = note', M.newPin(1, 2).kind === 'note');
  check('clamp: หนีบ 0–100', M.clamp(-5) === 0 && M.clamp(150) === 100 && M.clamp(50) === 50);
  check('newPin: พิกัดนอกกรอบถูกหนีบ', M.newPin(-9, 300).x === 0 && M.newPin(-9, 300).y === 100);
}
{
  // บทเรียน 14: ต้องเรียงด้วย order เป็นหลัก ไม่ใช่ชื่อไทย
  const a = { id: 'a', name: 'โลก', order: 1 }, b = { id: 'b', name: 'เมือง', order: 0 };
  check('sortMaps: order มาก่อนชื่อ', M.sortMaps([a, b]).map((m) => m.id).join() === 'b,a');
  check('sortMaps: order เท่ากัน → เรียงชื่อไทย',
        M.sortMaps([{ id: 'x', name: 'ฮ', order: 0 }, { id: 'y', name: 'ก', order: 0 }])[0].id === 'y');
  check('sortMaps: ไม่แก้ array เดิม', (() => { const src = [a, b]; M.sortMaps(src); return src[0].id === 'a'; })());
  check('findMap: หาเจอ/ไม่เจอคืน null', M.findMap([a, b], 'b') === b && M.findMap([a, b], 'zz') === null);
}

// ═══════════ ลำดับชั้น portal: breadcrumb / rootMaps / deleteMap ═══════════
{
  const world = { id: 'w', name: 'โลก', pins: [{ id: 'p1', kind: 'portal', toMap: 'c' }] };
  const city  = { id: 'c', name: 'เมือง', pins: [{ id: 'p2', kind: 'portal', toMap: 'r' }] };
  const room  = { id: 'r', name: 'ห้อง', pins: [] };
  const maps = [world, city, room];
  check('breadcrumb: โลก→เมือง→ห้อง',
        M.breadcrumb(maps, 'r').map((c) => c.id).join() === 'w,c,r', M.breadcrumb(maps, 'r').map((c) => c.id).join());
  check('breadcrumb: แผนที่ราก = ตัวเดียว', M.breadcrumb(maps, 'w').length === 1);
  check('breadcrumb: id ไม่มีจริง → ว่าง', M.breadcrumb(maps, 'zz').length === 0);
  check('rootMaps: เหลือแค่โลก', M.rootMaps(maps).length === 1 && M.rootMaps(maps)[0].id === 'w');

  // วนเป็นวง (ห้องมีประตูกลับไปโลก) ต้องไม่ค้าง
  const loop = [{ id: 'w', name: 'โลก', pins: [{ kind: 'portal', toMap: 'c' }] },
                { id: 'c', name: 'เมือง', pins: [{ kind: 'portal', toMap: 'w' }] }];
  check('breadcrumb: วงกลมไม่ค้าง (guard)', M.breadcrumb(loop, 'c').length <= 50);

  const after = M.deleteMap(JSON.parse(JSON.stringify(maps)), 'c');
  check('deleteMap: แผนที่หายไป', after.length === 2 && !after.some((m) => m.id === 'c'));
  check('deleteMap: ล้าง portal ที่ชี้มาหามัน', after.find((m) => m.id === 'w').pins.length === 0);
}
{
  const m = { pins: [{ kind: 'entity' }, { kind: 'entity' }, { kind: 'portal' }] };
  const s = M.pinStats(m);
  check('pinStats: นับแยกชนิด', s.entity === 2 && s.portal === 1 && s.note === 0);
  check('pinStats: แผนที่ว่าง/null ไม่พัง', M.pinStats(null).entity === 0 && M.pinStats({}).note === 0);
}

// ═══════════ ซูม ═══════════
{
  check('clampZoom: หนีบขอบล่าง/บน',
        M.clampZoom(0.01) === M.MAP_ZOOM_MIN && M.clampZoom(99) === M.MAP_ZOOM_MAX);
  check('clampZoom: ค่าไม่ใช่ตัวเลข → 1', M.clampZoom('x') === 1 && M.clampZoom(null) === 1 && M.clampZoom(NaN) === 1);
  check('clampZoom: ค่าปกติผ่านตรง ๆ', M.clampZoom(1.5) === 1.5);
  check('zoomStep: เพิ่มทีละขั้น', M.zoomStep(1, 1) === 1 + M.MAP_ZOOM_STEP);
  check('zoomStep: ลดทีละขั้น', M.zoomStep(1, -1) === 1 - M.MAP_ZOOM_STEP);
  // ค่ากลางขั้น (เช่นซูมด้วยล้อจากค่าที่ผู้ใช้ลากสไลเดอร์มา) ต้องถูกปัดลงร่อง
  check('zoomStep: ปัดค่ากลางขั้นให้ลงร่อง', M.zoomStep(1.37, 1) === 1.5, String(M.zoomStep(1.37, 1)));
  check('zoomStep: ไม่หลุดขอบล่าง', M.zoomStep(M.MAP_ZOOM_MIN, -1) === M.MAP_ZOOM_MIN);
  check('zoomStep: ไม่หลุดขอบบน', M.zoomStep(M.MAP_ZOOM_MAX, 1) === M.MAP_ZOOM_MAX);
}

// ═══════════ [alpha.71 ข้อ 1] ซูมแล้วจุดกึ่งกลางต้องอยู่ที่เดิม ═══════════
{
  // กรอบกว้าง 500 · เนื้อหา 1000 · อยู่กลางพอดี (scroll 250 → กึ่งกลางจอชี้ที่ 50% ของภาพ)
  // ซูมเป็น 2 เท่า (เนื้อหา 2000) → 50% ของภาพ = 1000 · ต้องเลื่อนไป 1000-250 = 750
  check('ซูมเข้า: กึ่งกลางจออยู่ที่เดิม', M.zoomScroll(250, 500, 1000, 2000) === 750,
        String(M.zoomScroll(250, 500, 1000, 2000)));
  check('ซูมออก: กึ่งกลางจออยู่ที่เดิม', M.zoomScroll(750, 500, 2000, 1000) === 250,
        String(M.zoomScroll(750, 500, 2000, 1000)));
  check('ขนาดเท่าเดิม → ไม่ขยับ', M.zoomScroll(300, 500, 1000, 1000) === 300);
  // อยู่ชิดซ้ายสุด แล้วซูมเข้า — ต้องไม่ได้ค่าติดลบ
  check('ชิดซ้ายสุด: ไม่คืนค่าติดลบ', M.zoomScroll(0, 500, 1000, 2000) >= 0);
  // เนื้อหาเล็กกว่ากรอบ (ซูมออกจนภาพเล็กกว่าจอ) → ไม่มีอะไรให้เลื่อน
  check('เนื้อหาเล็กกว่ากรอบ → scroll 0', M.zoomScroll(200, 500, 1000, 300) === 0);
  check('ไม่เลื่อนเกินขอบขวา', M.zoomScroll(500, 500, 1000, 1200) <= 1200 - 500);
  check('ค่าพัง (กรอบ/เนื้อหา = 0) ไม่พัง', M.zoomScroll(100, 0, 0, 500) === 0);
  // จุดยึดอื่น: ยึดที่เมาส์ซ้ายสุดของกรอบ
  check('ยึดที่ขอบซ้าย (anchor 0): จุดซ้ายสุดอยู่ที่เดิม',
        M.zoomScroll(250, 500, 1000, 2000, 0) === 500, String(M.zoomScroll(250, 500, 1000, 2000, 0)));
  check('anchor นอกช่วง 0–1 ถูกหนีบ',
        M.zoomScroll(250, 500, 1000, 2000, 9) === M.zoomScroll(250, 500, 1000, 2000, 1));
}

// ═══════════ โอเวอร์เลย์: กริด/เข็มทิศ/มาตราส่วน ═══════════
{
  check('mapOverlays: แผนที่เก่าไม่มีคีย์ → ค่าเริ่มต้น',
        M.mapOverlays({}).grid === false && M.mapOverlays({}).gridSize === 10);
  check('mapOverlays: null ไม่พัง', M.mapOverlays(null).compass === false);
  check('mapOverlays: gridSize นอกช่วง → ค่าเริ่มต้น',
        M.mapOverlays({ overlays: { gridSize: 999 } }).gridSize === 10 &&
        M.mapOverlays({ overlays: { gridSize: 1 } }).gridSize === 10);
  check('mapOverlays: gridSize ในช่วงใช้ได้', M.mapOverlays({ overlays: { gridSize: 20 } }).gridSize === 20);
  check('mapOverlays: scaleLabel เป็นสตริงเสมอ', M.mapOverlays({ overlays: { scaleLabel: 5 } }).scaleLabel === '5');

  const m = { name: 'x' };
  M.toggleOverlay(m, 'grid');
  check('toggleOverlay: เปิดกริด + เขียนกลับลง map', m.overlays.grid === true);
  M.toggleOverlay(m, 'grid');
  check('toggleOverlay: ปิดกลับได้', m.overlays.grid === false);
  M.toggleOverlay(m, 'compass');
  check('toggleOverlay: ไม่ไปยุ่งกับตัวอื่น', m.overlays.compass === true && m.overlays.grid === false);

  const g = M.gridLines(4);
  check('gridLines: 4 ช่อง → เส้นแบ่ง 3 เส้น', g.length === 3 && g.join() === '25,50,75', g.join());
  check('gridLines: ไม่มีเส้นที่ขอบ (0/100)', !g.includes(0) && !g.includes(100));
  check('gridLines: ค่าเพี้ยนถูกหนีบ', M.gridLines(0).length === 1 && M.gridLines(500).length === 49);
}

// ═══════════ หมวดแผนที่ ═══════════
{
  const maps = [
    { id: 'a', name: 'ก', order: 0, category: 'โลกปัจจุบัน' },
    { id: 'b', name: 'ข', order: 1, category: 'โลกอดีต' },
    { id: 'c', name: 'ค', order: 2, category: 'โลกปัจจุบัน' },
    { id: 'd', name: 'ง', order: 3 },
  ];
  const cats = M.mapCategories(maps);
  check('mapCategories: ไม่ซ้ำ + เรียงไทย', cats.slice(0, 2).join() === 'โลกปัจจุบัน,โลกอดีต', cats.join());
  check('mapCategories: หมวดว่างอยู่ท้ายสุด', cats[cats.length - 1] === M.MAP_UNCATEGORIZED);
  check('mapCategories: ไม่มีหมวดว่าง → ไม่มีคีย์ว่างงอก',
        M.mapCategories(maps.slice(0, 3)).length === 2);

  const gr = M.groupMaps(maps);
  check('groupMaps: 3 กลุ่ม', gr.length === 3, String(gr.length));
  check('groupMaps: กลุ่มแรกมี 2 แผนที่ เรียงตาม order',
        gr[0].maps.map((m) => m.id).join() === 'a,c', gr[0].maps.map((m) => m.id).join());
  check('groupMaps: หมวดว่างท้ายสุดมีแผนที่ d', gr[2].cat === '' && gr[2].maps[0].id === 'd');
  check('groupMaps: ครบทุกแผนที่ ไม่มีตกหล่น',
        gr.reduce((n, g2) => n + g2.maps.length, 0) === maps.length);
  check('groupMaps: ช่องว่างหัวท้ายในหมวดถือว่าหมวดเดียวกัน',
        M.groupMaps([{ id: '1', name: 'a', category: ' โลก ' }, { id: '2', name: 'b', category: 'โลก' }]).length === 1);
}

// ═══════════ ค้นหา/กรองหมุด ═══════════
{
  const pins = [
    { id: '1', label: 'ปราสาทหลวง', kind: 'entity', note: '' },
    { id: '2', label: 'ท่าเรือเก่า', kind: 'note', note: 'ที่ลอบขึ้นฝั่ง' },
    { id: '3', label: 'Tavern', kind: 'portal', note: '' },
  ];
  check('matchPin: คำค้นว่าง = ผ่านหมด', M.filterPins(pins, '').length === 3 && M.filterPins(pins, '   ').length === 3);
  check('matchPin: ตรงป้ายชื่อ', M.filterPins(pins, 'ปราสาท').map((p) => p.id).join() === '1');
  check('matchPin: ตรงหมายเหตุ', M.filterPins(pins, 'ลอบขึ้น').map((p) => p.id).join() === '2');
  check('matchPin: อังกฤษไม่สนตัวพิมพ์', M.filterPins(pins, 'TAVERN').map((p) => p.id).join() === '3');
  check('matchPin: ค้นด้วยชื่อชนิดหมุดภาษาไทยได้',
        M.filterPins(pins, 'ประตู').map((p) => p.id).join() === '3', M.filterPins(pins, 'ประตู').map((p) => p.id).join());
  check('matchPin: ไม่เจอ → ว่าง', M.filterPins(pins, 'ไม่มีจริง').length === 0);
  check('matchPin: หมุดไม่มีป้ายชื่อไม่พัง', M.matchPin({ id: 'x', kind: 'note' }, 'zz') === false);
}

// ═══════════ หมุดหลายตัว: ย้าย/ลบ/สำเนา ═══════════
{
  const pins = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 50, y: 50 }, { id: 'c', x: 98, y: 3 }];
  const moved = M.movePins(pins, ['a', 'c'], 5, -5);
  check('movePins: เลื่อนเฉพาะตัวที่เลือก',
        moved[0].x === 15 && moved[0].y === 5 && moved[1].x === 50 && moved[1].y === 50);
  check('movePins: หนีบขอบทีละตัว', moved[2].x === 100 && moved[2].y === 0, JSON.stringify(moved[2]));
  check('movePins: ไม่แก้ของเดิม (คืน array ใหม่)', pins[0].x === 10 && moved !== pins);
  check('movePins: ids ว่าง = ไม่ขยับ', M.movePins(pins, [], 9, 9)[0].x === 10);

  const map = { id: 'm', pins: JSON.parse(JSON.stringify(pins)),
                routes: [{ id: 'r1', pinIds: ['a', 'b', 'c'] }] };
  M.deletePins(map, ['b']);
  check('deletePins: หมุดหายจากแผนที่', map.pins.map((p) => p.id).join() === 'a,c');
  check('deletePins: หมุดถูกถอดออกจากเส้นทางด้วย',
        map.routes[0].pinIds.join() === 'a,c', map.routes[0].pinIds.join());

  const src = [{ id: 'a', x: 10, y: 10, label: 'บ้าน', kind: 'portal', toMap: 'other' },
               { id: 'b', x: 50, y: 50, kind: 'note' }];
  const cl = M.clonePins(src, ['a'], 2);
  check('clonePins: ได้จำนวนเท่าที่เลือก', cl.length === 1);
  check('clonePins: id ใหม่ ไม่ซ้ำของเดิม', cl[0].id !== 'a' && cl[0].id.startsWith('pin-'));
  check('clonePins: คงข้อมูล + เยื้องตำแหน่ง', cl[0].label === 'บ้าน' && cl[0].x === 12 && cl[0].y === 12);
  check('clonePins: หนีบขอบตอนเยื้อง', M.clonePins([{ id: 'z', x: 99, y: 99 }], ['z'], 5)[0].x === 100);
  check('clonePins: portal ที่ชี้แผนที่ปลายทางเอง ถูกตัด (กันวนหาตัวเอง)',
        M.clonePins(src, ['a'], 2, 'other')[0].toMap === '');
  check('clonePins: portal ที่ชี้แผนที่อื่นยังอยู่', M.clonePins(src, ['a'], 2, 'somewhere')[0].toMap === 'other');
}

// ═══════════ เส้นทาง (routes) ═══════════
{
  const r = M.newRoute();
  check('newRoute: มี id/ชื่อ/สี/pinIds ว่าง',
        r.id.startsWith('rt-') && r.name === 'เส้นทางใหม่' && !!r.color && r.pinIds.length === 0);
  check('newRoute: ตั้งชื่อ/สีเองได้', M.newRoute('เดินทัพ', '#000').name === 'เดินทัพ' && M.newRoute('x', '#000').color === '#000');

  const map = { id: 'm', pins: [{ id: 'a', x: 0, y: 0, label: 'เริ่ม' },
                                { id: 'b', x: 30, y: 40, label: 'กลาง' },
                                { id: 'c', x: 30, y: 100, label: 'จบ' }],
                routes: [] };
  const rt = M.newRoute('เดินทาง');
  M.addPinToRoute(rt, 'a'); M.addPinToRoute(rt, 'b'); M.addPinToRoute(rt, 'b'); M.addPinToRoute(rt, 'c');
  check('addPinToRoute: กันซ้ำติดกัน', rt.pinIds.join() === 'a,b,c', rt.pinIds.join());
  check('addPinToRoute: pinId ว่าง = ไม่เพิ่ม', M.addPinToRoute({ pinIds: ['a'] }, '').pinIds.length === 1);
  check('addPinToRoute: หมุดเดิมกลับมาซ้ำได้ถ้าไม่ติดกัน (เดินวน)',
        M.addPinToRoute({ pinIds: ['a', 'b'] }, 'a').pinIds.join() === 'a,b,a');

  const pts = M.routePoints(map, rt);
  check('routePoints: ได้พิกัดครบตามลำดับ', pts.map((p) => p.id).join() === 'a,b,c');
  check('routePath: เป็น M…L…', M.routePath(pts) === 'M0.00,0.00 L30.00,40.00 L30.00,100.00', M.routePath(pts));
  check('routePath: จุดเดียว/ว่าง → ไม่มี path', M.routePath([{ x: 1, y: 1 }]) === '' && M.routePath([]) === '');
  check('routeLength: 3-4-5 + เส้นตรง', M.routeLength(pts) === 110, String(M.routeLength(pts)));

  // หมุดถูกลบไป — เส้นทางต้องข้าม ไม่ใช่พาไปพิกัด undefined
  map.pins = map.pins.filter((p) => p.id !== 'b');
  const pts2 = M.routePoints(map, rt);
  check('routePoints: ข้ามหมุดที่ถูกลบ', pts2.map((p) => p.id).join() === 'a,c', pts2.map((p) => p.id).join());
  check('routePath: ยังวาดได้หลังหมุดหาย', M.routePath(pts2) !== '');

  map.routes = [rt, M.newRoute('อีกเส้น')];
  check('mapRoutes: อ่านได้', M.mapRoutes(map).length === 2);
  check('mapRoutes: แผนที่ไม่มี routes → ว่าง', M.mapRoutes({}).length === 0 && M.mapRoutes(null).length === 0);
  M.deleteRoute(map, rt.id);
  check('deleteRoute: ลบเฉพาะเส้นที่เลือก', map.routes.length === 1 && map.routes[0].name === 'อีกเส้น');
}

// ═══════════ ฉากที่ผูกกับหมุด ═══════════
{
  const scenes = [
    { id: 's1', title: 'ฉาก1', mapId: 'w', pinId: 'p1' },
    { id: 's2', title: 'ฉาก2', mapId: 'w', pinId: 'p1' },
    { id: 's3', title: 'ฉาก3', mapId: 'w', pinId: 'p2' },
    { id: 's4', title: 'ฉาก4', mapId: 'w' },                  // ปักพิกัดลอย ไม่มีหมุด
    { id: 's5', title: 'ฉาก5', mapId: 'c', pinId: 'p9' },
  ];
  check('scenesForMap: กรองตามแผนที่', M.scenesForMap(scenes, 'w').length === 4);
  check('scenesForMap: แผนที่ไม่มีฉาก → ว่าง', M.scenesForMap(scenes, 'zz').length === 0);
  check('scenesForMap: null ไม่พัง', M.scenesForMap(null, 'w').length === 0);
  const cnt = M.scenePinCounts(scenes, 'w');
  check('scenePinCounts: นับต่อหมุด', cnt.p1 === 2 && cnt.p2 === 1, JSON.stringify(cnt));
  check('scenePinCounts: ฉากพิกัดลอยไปคีย์ว่าง', cnt[''] === 1);
  check('scenePinCounts: ไม่ปนแผนที่อื่น', cnt.p9 === undefined);
}

// ═══════════ migrate: maps.json v1.0 เดิมต้องเปิดได้ ═══════════
{
  const old = { version: '1.0', maps: [{ id: 'a', name: 'เก่า', image: 'Images/a.png',
                                         pins: [{ id: 'p', x: 1, y: 2, kind: 'note' }], order: 0 }] };
  const d = M.migrateMaps(JSON.parse(JSON.stringify(old)));
  check('migrateMaps: อัปเวอร์ชัน', d.version === M.MAPS_VERSION);
  check('migrateMaps: เติม category/routes/overlays', d.maps[0].category === '' &&
        Array.isArray(d.maps[0].routes) && d.maps[0].overlays.grid === false);
  check('migrateMaps: ไม่ทำหมุดเดิมหาย', d.maps[0].pins.length === 1 && d.maps[0].pins[0].id === 'p');
  check('migrateMaps: ไฟล์ว่าง/พัง → โครงว่างที่ใช้ต่อได้',
        M.migrateMaps(null).maps.length === 0 && M.migrateMaps({ maps: 'ไม่ใช่ array' }).maps.length === 0);
  check('migrateMaps: ไม่ทับค่าที่มีอยู่แล้ว',
        M.migrateMaps({ maps: [{ id: 'z', category: 'โลกอดีต', overlays: { grid: true, gridSize: 20 } }] })
          .maps[0].overlays.gridSize === 20);
}

// ═══════════ ค่าคงที่ ═══════════
check('PIN_KIND ครบ 3 ชนิด + มีไอคอน',
      ['entity', 'portal', 'note'].every((k) => M.PIN_KIND[k] && M.PIN_KIND[k].icon && M.PIN_KIND[k].label));
check('PIN_COLORS / ROUTE_COLORS เป็นสี hex', M.PIN_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c)) &&
      M.ROUTE_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c)));

console.log(`maps.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
