// test/maps-geo.test.cjs — [alpha.167] แผนที่: มาตราส่วน · ละติจูด/ลองจิจูด · ระยะ/เวลาเดินทาง · โซน · แผนที่ย่อย · เส้นทางเรื่อง
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_mapsgeo.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/maps.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const M = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ภาพกว้าง 2 เท่าของสูง · สเกล: จาก x10 → x20 (แนวนอน) = 100 ม.
const map = { id: 'm', aspect: 2, pins: [], geo: { scale: { a: { x: 10, y: 50 }, b: { x: 20, y: 50 }, meters: 100 },
  ref: { x: 10, y: 50, lat: 13.75, lon: 100.5 } } };

check('geoReady: ยังไม่ตั้ง', !M.geoReady({}).scale && !M.geoReady({}).full);
check('geoReady: ครบ', M.geoReady(map).full);
check('geoOf ทิ้งสเกลเสีย (จุดเดียวกัน)', M.geoOf({ geo: { scale: { a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, meters: 5 } } }).scale === null);
check('geoOf ทิ้งสเกลเสีย (ระยะ ≤ 0)', M.geoOf({ geo: { scale: { a: { x: 1, y: 1 }, b: { x: 2, y: 1 }, meters: 0 } } }).scale === null);
check('metersPerUnit = 10 ม./หน่วย', near(M.metersPerUnit(map), 10));
check('distMeters แนวนอน', near(M.distMeters(map, { x: 10, y: 50 }, { x: 30, y: 50 }), 200));
check('distMeters แนวตั้งคิดสัดส่วนภาพ (20% ของสูง = 10 หน่วย)', near(M.distMeters(map, { x: 10, y: 50 }, { x: 10, y: 70 }), 100));
check('distMeters ยังไม่ตั้งสเกล = null', M.distMeters({}, { x: 0, y: 0 }, { x: 1, y: 1 }) === null);
check('pathMeters รวมหลายช่วง', near(M.pathMeters(map, [{ x: 10, y: 50 }, { x: 20, y: 50 }, { x: 20, y: 70 }]), 200));
{
  const ll = M.toLatLon(map, { x: 20, y: 50 });
  check('toLatLon: ไปทางตะวันออก 100 ม. = ลองจิจูดเพิ่ม', ll.lat === 13.75 && ll.lon > 100.5 && near(ll.lon - 100.5, 100 / (111320 * Math.cos(13.75 * Math.PI / 180)), 1e-9));
  const ll2 = M.toLatLon(map, { x: 10, y: 70 });
  check('toLatLon: ลงล่าง = ละติจูดลด', ll2.lat < 13.75 && ll2.lon === 100.5);
  const back = M.fromLatLon(map, 13.7512, 100.5031);
  const again = M.toLatLon(map, back);
  check('fromLatLon ↔ toLatLon ไปกลับตรงกัน', near(again.lat, 13.7512, 1e-9) && near(again.lon, 100.5031, 1e-9));
  const rot = { ...map, geo: { ...map.geo, north: 90 } };
  const b2 = M.fromLatLon(rot, 13.7512, 100.5031);
  const a2 = M.toLatLon(rot, b2);
  check('ทิศเหนือเอียง: ไปกลับยังตรง', near(a2.lat, 13.7512, 1e-9) && near(a2.lon, 100.5031, 1e-9));
  check('ทิศเหนือเอียง 90°: ขวาของภาพ = ใต้', M.toLatLon(rot, { x: 20, y: 50 }).lat < 13.75);
  check('toLatLon ไม่มีจุดอ้างอิง = null', M.toLatLon({ ...map, geo: { scale: map.geo.scale } }, { x: 1, y: 1 }) === null);
}
check('formatLatLon', M.formatLatLon({ lat: 13.75, lon: -0.5 }, 2) === '13.75° N, 0.50° W');
check('niceDistance m', JSON.stringify(M.niceDistance(420.4)) === '{"value":420,"unit":"m"}');
check('niceDistance km', JSON.stringify(M.niceDistance(2345)) === '{"value":2.35,"unit":"km"}');
check('travelHours เดิน 5 กม./ชม.', M.travelHours(10000, 5) === 2);
check('splitHours', JSON.stringify(M.splitHours(26.5)) === '{"d":1,"h":2,"m":30}');
check('niceScaleBar 1-2-5', [1, 2, 5].includes(M.niceScaleBar(10, 18).meters / Math.pow(10, Math.floor(Math.log10(M.niceScaleBar(10, 18).meters)))));

// ── โซน ──
{
  const sq = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }];
  check('pointInPolygon ใน', M.pointInPolygon({ x: 20, y: 20 }, sq));
  check('pointInPolygon นอก', !M.pointInPolygon({ x: 40, y: 20 }, sq));
  const z = M.newZone(sq, { name: 'หมู่บ้าน', entityFile: 'Wiki/locations/v.json' });
  check('newZone เก็บชื่อ/เอนทิตี้', z.name === 'หมู่บ้าน' && z.entityFile.endsWith('v.json') && z.points.length === 4);
  const m2 = { ...map, zones: [z, { id: 'bad', points: [{ x: 1, y: 1 }] }] };
  check('mapZones ทิ้งโซนที่จุดไม่ถึง 3', M.mapZones(m2).length === 1);
  check('zoneAt เจอ', M.zoneAt(m2, { x: 15, y: 15 }).id === z.id);
  check('zoneAt ไม่เจอ = null', M.zoneAt(m2, { x: 90, y: 90 }) === null);
  // 20×20 (%) บนภาพสัดส่วน 2 = 20 × 10 หน่วย = 200 หน่วย² × 10² = 20,000 ม²
  check('zoneAreaM2 คิดสัดส่วนภาพ', near(M.zoneAreaM2(m2, z), 20000));
  check('niceArea km²', M.niceArea(2.5e6).unit === 'km2');
  check('polygonCentroid สี่เหลี่ยม', JSON.stringify(M.polygonCentroid(sq)) === '{"x":20,"y":20}');
  check('zonePath ปิดรูป', M.zonePath(sq).endsWith(' Z'));
  M.deleteZone(m2, z.id);
  check('deleteZone', m2.zones.length === 1);
  check('migrateMaps เติม zones', Array.isArray(M.migrateMaps({ maps: [{ id: 'x' }] }).maps[0].zones));
}

// ── แผนที่ย่อย ──
{
  const maps = [
    { id: 'w', name: 'โลก', order: 0, pins: [M.portalPin(50, 50, 'c', 'เมือง')] },
    { id: 'c', name: 'เมือง', order: 1, pins: [M.entityPin(10, 10, 'Wiki/a.json', 'อลิส')] },
    { id: 'x', name: 'อื่น', order: 2, pins: [] },
  ];
  check('childMaps', M.childMaps(maps, 'w').map((m) => m.id).join() === 'c');
  check('parentMap', M.parentMap(maps, 'c').id === 'w' && M.parentMap(maps, 'w') === null);
  check('portalPin ชนิด portal ชี้ถูก', maps[0].pins[0].kind === 'portal' && maps[0].pins[0].toMap === 'c');
  check('pinsOfEntity หาได้ข้ามแผนที่', M.pinsOfEntity(maps, 'Wiki/a.json').length === 1 && M.pinsOfEntity(maps, 'Wiki/a.json')[0].map.id === 'c');
}

// ── เส้นทางของเรื่อง ──
{
  const m3 = { ...map, pins: [{ id: 'p1', x: 10, y: 50 }, { id: 'p2', x: 30, y: 50 }] };
  const scenes = [
    { id: 's2', title: 'สอง', mapId: 'm', pinId: 'p2', storyDate: 'วัน 5' },
    { id: 's1', title: 'หนึ่ง', mapId: 'm', pinId: 'p1', storyDate: 'วัน 1' },
    { id: 's3', title: 'สาม', mapId: 'm', pinX: 10, pinY: 50, storyDate: 'วัน 9' },
    { id: 's4', title: 'ที่อื่น', mapId: 'zz', pinId: 'p1' },
  ];
  const num = (s) => { const m = String(s.storyDate || '').match(/\d+/); return m ? +m[0] : null; };
  const j = M.storyJourney(m3, scenes, num);
  check('storyJourney เรียงตามเวลาในเรื่อง', j.stops.map((s) => s.scene.id).join() === 's1,s2,s3');
  check('storyJourney ข้ามฉากแผนที่อื่น', j.stops.length === 3);
  check('storyJourney ระยะรวมจริง', near(j.total, 400));
  check('storyJourney ไม่มีสเกล = total null', M.storyJourney({ ...m3, geo: null }, scenes, num).total === null);
  check('scenePoint พิกัดลอย', JSON.stringify(M.scenePoint(m3, scenes[2])) === '{"x":10,"y":50}');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
