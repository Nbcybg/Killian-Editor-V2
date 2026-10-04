// test/floorplan.test.cjs — ผังพื้นที่แบบ Shot Designer (src/floorplan/fp-data.js + fp-gear.js)
// ครอบ: สร้าง/อ่านไฟล์ · จังหวะแบบสืบทอด (setPose/insert/delete/move) · มุมรับภาพจากเลนส์+เซนเซอร์ ·
//       กรวย/ใครอยู่ในภาพ · ราง · กรอบ/ซูม · ดัชนีผังจำนวนมาก · อุณหภูมิสีของไฟ
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_fp.cjs');
require('esbuild').buildSync({
  stdin: { contents: "export * from './src/floorplan/fp-data.js'; export * as G from './src/floorplan/fp-gear.js';",
           resolveDir: path.join(__dirname, '..'), loader: 'js' },
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent',
});
const F = require(out);
const G = F.G;

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

// ═══════════ สร้าง ═══════════
{
  const p = F.newPlan('ร้านเค้ก', { id: 'sc1', title: 'ฉาก 1' });
  check('newPlan: มี id/ชื่อ/ฉาก/จังหวะแรก', /^fp-/.test(p.id) && p.name === 'ร้านเค้ก' && p.scene.id === 'sc1' && p.beats.length === 1);
  check('newPlan: ไม่ผูกฉาก = null', F.newPlan('x').scene === null);
  check('newPlan: กริด 1 ม. เปิดอยู่', p.grid.on && p.grid.size === 1);
  const c = F.newObject('camera', { x: 2, y: 3 });
  check('newObject camera: ค่าตั้งต้น FX3 35mm ขาตั้ง', c.body === 'sony-fx3' && c.lens === 35 && c.support === 'tripod' && c.height === 1.5);
  check('newObject camera: หันขึ้น (-90)', c.rot === -90 && c.x === 2 && c.y === 3);
  const e = F.newObject('entity', { entityFile: 'W/a.json' });
  check('newObject entity: ระยะสายตา 120° 3 ม.', e.sight.on && e.sight.fov === 120 && e.sight.range === 3);
  const l = F.newObject('light', { kind: 'practical' });
  check('newObject light: ค่าตั้งต้นตามชนิด (practical = รอบตัว 2700K)', l.beam === 360 && l.cct === 2700);
  const w = F.newObject('shape', { kind: 'wall' });
  check('newObject wall: เป็นเส้นหลายจุด หนา 15 ซม.', Array.isArray(w.pts) && w.pts.length === 2 && w.thick === 0.15);
  const d = F.newObject('shape', { kind: 'door' });
  check('newObject door: กว้าง 90 ซม.', d.w === 0.9);
  const t = F.newObject('track', {});
  check('newObject track: ราง 3 ม.', t.pts.length === 2 && F.polylineLength(t.pts) === 3);
  check('uid ไม่ซ้ำในรอบเดียว', new Set(Array.from({ length: 200 }, () => F.uid('x'))).size === 200);
  check('nextCameraLabel: A → B', (() => { const q = F.newPlan(''); q.objects.push(F.newObject('camera', { label: 'A' })); return F.nextCameraLabel(q) === 'B'; })());
  check('normAngle: ช่วง (-180,180]', F.normAngle(270) === -90 && F.normAngle(-190) === 170 && F.normAngle(180) === 180);
}

// ═══════════ อ่านไฟล์ (normalize) ═══════════
{
  const raw = {
    id: 'fp-a', name: 'x', objects: [
      { id: 'a', type: 'entity', x: 1, y: 1 }, { id: 'a', type: 'entity' }, { type: 'camera' },
      { id: 'z', type: 'ufo' }, { id: 'c', type: 'camera', x: 'bad', hidden: true },
    ],
    beats: [{ id: 'b0', keys: { a: { x: 5 } } }, { id: 'b1', keys: { a: { y: 9 }, ghost: { x: 1 } } }],
  };
  const p = F.normalizePlan(raw);
  check('normalize: ทิ้ง id ซ้ำ/ไม่มี id/ชนิดไม่รู้จัก', p.objects.map((o) => o.id).join() === 'a,c');
  check('normalize: ค่าเสีย = 0', p.objects[1].x === 0);
  check('normalize: hidden คงไว้', p.objects[1].hidden === true);
  check('normalize: keys ของจังหวะแรกพับเข้าตัวชิ้น', p.objects[0].x === 5 && Object.keys(p.beats[0].keys).length === 0);
  check('normalize: keys ที่ชี้ชิ้นที่ไม่มีถูกทิ้ง', !p.beats[1].keys.ghost && p.beats[1].keys.a.y === 9);
  check('normalize: idempotent', JSON.stringify(F.normalizePlan(p)) === JSON.stringify(p));
  check('normalize: ไม่มีจังหวะ = มีหนึ่งจังหวะ', F.normalizePlan({}).beats.length === 1);
  check('normalize: พื้นหลังไม่มีรูป = null', F.normalizePlan({ bg: { x: 1 } }).bg === null);
  check('normalize: ขยะทั้งก้อนไม่ throw', !!F.normalizePlan(null) && !!F.normalizePlan('x'));
  const poly = F.normalizePlan({ objects: [{ id: 'w', type: 'shape', kind: 'wall', rot: 30, pts: [{ x: 0, y: 0 }, { x: 1, y: 'x' }, { x: 2, y: 2 }] }] });
  check('normalize: จุดเสียของเส้นถูกทิ้ง · มุมหมุนของเส้นคงไว้', poly.objects[0].pts.length === 2 && poly.objects[0].rot === 30);
}

// ═══════════ จังหวะแบบสืบทอด ═══════════
{
  const p = F.newPlan('b');
  const a = F.newObject('entity', { x: 0, y: 0 }); p.objects.push(a);
  F.insertBeat(p, 0); F.insertBeat(p, 1); F.insertBeat(p, 2);   // 4 จังหวะ
  check('insertBeat: เพิ่มครบ 4 จังหวะ', p.beats.length === 4);
  F.setPose(p, a.id, 1, { x: 3 });
  check('setPose จังหวะ 2: จังหวะ 2–4 ตามไป · จังหวะแรกไม่ขยับ',
        F.poseAt(p, a.id, 0).x === 0 && F.poseAt(p, a.id, 1).x === 3 && F.poseAt(p, a.id, 3).x === 3);
  F.setPose(p, a.id, 3, { x: 7, rot: 45 });
  check('setPose จังหวะ 4 ไม่กระทบจังหวะ 3', F.poseAt(p, a.id, 2).x === 3 && F.poseAt(p, a.id, 3).x === 7 && F.poseAt(p, a.id, 3).rot === 45);
  check('keys เก็บเฉพาะที่เปลี่ยน', JSON.stringify(p.beats[2].keys) === '{}' && p.beats[1].keys[a.id].x === 3 && p.beats[1].keys[a.id].y === undefined);
  F.setPose(p, a.id, 2, { x: 3 });
  check('setPose ค่าเท่าจังหวะก่อน = ไม่เก็บ', !p.beats[2].keys[a.id]);
  F.setPose(p, a.id, 0, { y: 2 });
  check('setPose จังหวะแรก = แก้ตัวชิ้น (ทุกจังหวะตาม)', a.y === 2 && F.poseAt(p, a.id, 3).y === 2);
  F.setPose(p, a.id, 2, { hidden: true });
  check('ซ่อนในจังหวะ 3 → จังหวะ 4 ซ่อนด้วย (สืบทอด)', F.poseAt(p, a.id, 2).hidden && F.poseAt(p, a.id, 3).hidden && !F.poseAt(p, a.id, 1).hidden);
  const before = [0, 1, 2, 3].map((i) => JSON.stringify(F.poseAt(p, a.id, i)));
  F.deleteBeat(p, 1);
  const after = [0, 1, 2].map((i) => JSON.stringify(F.poseAt(p, a.id, i)));
  check('deleteBeat: ตำแหน่งของจังหวะอื่นไม่เปลี่ยน', after.join('|') === [before[0], before[2], before[3]].join('|'), after.join('|'));
  check('deleteBeat: เหลือจังหวะเดียวลบไม่ได้', (() => { const q = F.newPlan(''); return F.deleteBeat(q, 0) === false; })());
  const snap = [0, 1, 2].map((i) => JSON.stringify(F.poseAt(p, a.id, i)));
  const j = F.moveBeat(p, 2, -1);
  check('moveBeat: คืนดัชนีใหม่', j === 1);
  check('moveBeat: ตำแหน่งย้ายไปพร้อมจังหวะ', JSON.stringify(F.poseAt(p, a.id, 1)) === snap[2] && JSON.stringify(F.poseAt(p, a.id, 2)) === snap[1]);
  check('moveBeat: สุดขอบ = ไม่ขยับ', F.moveBeat(p, 0, -1) === 0);
  F.deleteBeat(p, 0);
  check('deleteBeat จังหวะแรก: ตำแหน่งตั้งต้นใหม่ = ของจังหวะที่สอง', JSON.stringify(F.poseAt(p, a.id, 0)) === snap[2] && Object.keys(p.beats[0].keys).length === 0);
  check('clearPoseKey', (() => { F.insertBeat(p, 0); F.setPose(p, a.id, 1, { x: 99 }); const ok = F.hasKey(p, a.id, 1); F.clearPoseKey(p, a.id, 1); return ok && !F.hasKey(p, a.id, 1); })());
  const mv = (() => { const q = F.newPlan(''); const o = F.newObject('entity'); q.objects.push(o); F.insertBeat(q, 0); F.setPose(q, o.id, 1, { x: 2, rot: 10 }); return F.movesInto(q, 1); })();
  check('movesInto: บอกว่าใครขยับ/หมุน', mv.length === 1 && mv[0].moved && mv[0].turned && mv[0].to.x === 2);
  const lp = F.lerpPose({ x: 0, y: 0, rot: 170 }, { x: 2, y: 4, rot: -170 }, 0.5);
  check('lerpPose: ครึ่งทาง + หมุนทางสั้น (ข้าม 180)', lp.x === 1 && lp.y === 2 && Math.abs(Math.abs(lp.rot) - 180) < 1e-6, JSON.stringify(lp));
  check('easeInOut: 0/0.5/1', F.easeInOut(0) === 0 && F.easeInOut(0.5) === 0.5 && F.easeInOut(1) === 1);
}

// ═══════════ กล้องที่ใช้ในจังหวะ ═══════════
{
  const p = F.newPlan('');
  check('activeCamId: ไม่มีกล้อง = ""', F.activeCamId(p, 0) === '');
  const A = F.newObject('camera', { label: 'A' }), B = F.newObject('camera', { label: 'B' });
  p.objects.push(A, B);
  check('activeCamId: ไม่ระบุ = กล้องตัวแรก', F.activeCamId(p, 0) === A.id);
  F.insertBeat(p, 0); p.beats[1].cam = B.id; F.insertBeat(p, 1);
  check('activeCamId: จังหวะใหม่ใช้กล้องของจังหวะก่อน', p.beats[2].cam === B.id && F.activeCamId(p, 2) === B.id);
  p.beats[2].cam = 'gone';
  check('activeCamId: กล้องที่ถูกลบ = ย้อนไปหาของจังหวะก่อน', F.activeCamId(p, 2) === B.id);
}

// ═══════════ เลนส์ · เซนเซอร์ · มุมรับภาพ ═══════════
{
  check('lensFov: ฟูลเฟรม 36mm @ 35mm ≈ 54.4°', near(F.lensFov(36, 35), 54.43, 0.05), F.lensFov(36, 35));
  check('lensFov: ฟูลเฟรม @ 50mm ≈ 39.6°', near(F.lensFov(36, 50), 39.6, 0.05));
  check('lensFov: ค่าเสีย = 0', F.lensFov(36, 0) === 0 && F.lensFov(0, 35) === 0);
  const fx3 = F.newObject('camera', { body: 'sony-fx3', lens: 35 });
  const kom = F.newObject('camera', { body: 'red-komodo', lens: 35 });
  check('★ เลนส์เดียวกัน: FX3 (ฟูลเฟรม) กว้างกว่า Komodo (S35)', F.cameraFov(fx3) > F.cameraFov(kom) + 10, F.cameraFov(fx3) + ' vs ' + F.cameraFov(kom));
  check('Fuji X-T5 มีในคลัง (APS-C 23.5 มม.)', G.bodyOf('fuji-xt5').sw === 23.5);
  check('RED Komodo มีในคลัง', G.bodyOf('red-komodo') && G.bodyName(G.bodyOf('red-komodo')) === 'RED Komodo 6K');
  const cust = F.newObject('camera', { body: 'custom', sensorW: 17.3, lens: 25 });
  check('custom ใช้ sensorW ของกล้องตัวนั้น', near(F.cameraFov(cust), F.lensFov(17.3, 25)));
  check('lensForFov กลับทาง lensFov', near(F.lensForFov(36, F.lensFov(36, 50)), 50, 0.01));
  check('equivFF: S35 35mm ≈ 46–48mm', (() => { const v = F.equivFF(kom); return v >= 44 && v <= 50; })(), F.equivFF(kom));
  check('บอดี้ไม่รู้จัก = ไม่ throw', F.cameraFov({ body: 'nope', lens: 35, sensorW: 36 }) > 0);
  check('ทุกบอดี้มี id ไม่ซ้ำ + ขนาดเซนเซอร์บวก', new Set(G.CAMERA_BODIES.map((b) => b.id)).size === G.CAMERA_BODIES.length
        && G.CAMERA_BODIES.every((b) => b.sw > 0 && b.sh > 0));
  check('ขาตั้งมี jib/tripod/monopod/dolly', ['jib', 'tripod', 'monopod', 'dolly'].every((id) => G.SUPPORTS.some((s) => s.id === id)));
  check('dolly/slider ใช้รางได้', G.supportOf('dolly').rail && G.supportOf('slider').rail && !G.supportOf('tripod').rail);
  check('supportOf ไม่รู้จัก = tripod', G.supportOf('zzz').id === 'tripod');
}

// ═══════════ กรวย · ใครอยู่ในภาพ ═══════════
{
  const pose = { x: 0, y: 0, rot: 0 };
  check('inCone: ตรงหน้าในระยะ', F.inCone({ x: 5, y: 0 }, pose, 60, 8));
  check('inCone: เกินระยะ', !F.inCone({ x: 9, y: 0 }, pose, 60, 8));
  check('inCone: นอกมุม', !F.inCone({ x: 1, y: 1 }, pose, 60, 8));
  check('inCone: ข้างหลัง', !F.inCone({ x: -2, y: 0 }, pose, 60, 8));
  check('inCone: 360° = รอบตัว', F.inCone({ x: -2, y: 0 }, pose, 360, 8));
  check('conePath: เริ่มจากจุดกล้อง', F.conePath(1, 2, 0, 60, 5).startsWith('M1 2L'));
  check('conePath: 360 = วงกลม', /a5 5 0 1 0 10 0/.test(F.conePath(0, 0, 0, 360, 5)));
  check('conePath: ระยะ 0 = ว่าง', F.conePath(0, 0, 0, 60, 0) === '');

  const p = F.newPlan('');
  const cam = F.newObject('camera', { x: 0, y: 5, rot: -90, lens: 24, range: 10 });
  const a = F.newObject('entity', { x: 0, y: 0 }), b = F.newObject('entity', { x: 0, y: 2 }), c = F.newObject('entity', { x: 8, y: 0 });
  p.objects.push(cam, a, b, c);
  const f = F.framedIds(p, 0, cam.id);
  check('framedIds: อยู่ในภาพ 2 คน เรียงใกล้→ไกล', f.map((x) => x.id).join() === [b.id, a.id].join(), JSON.stringify(f));
  F.insertBeat(p, 0); F.setPose(p, b.id, 1, { hidden: true });
  check('framedIds: คนที่ออกจากฉาก (ซ่อน) ไม่นับ', F.framedIds(p, 1, cam.id).map((x) => x.id).join() === a.id);
  check('framedIds: ไม่ใช่กล้อง = []', F.framedIds(p, 0, a.id).length === 0);
  a.rot = 90;   // หันลง (หาทาง b)
  check('sees: a หันหา b = เห็น', F.sees(p, 0, a.id, b.id));
  a.rot = -90;
  check('sees: a หันหนี = ไม่เห็น', !F.sees(p, 0, a.id, b.id));
  a.sight.on = false;
  check('coneOf: ปิดระยะสายตา = null', F.coneOf(a) === null);
  check('coneOf ไฟ = ลำแสง', F.coneOf(F.newObject('light', { kind: 'hmi' })).fov === 20);
}

// ═══════════ ราง · เส้นหลายจุด ═══════════
{
  const n = F.nearestOnPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], { x: 3, y: 4 });
  check('nearestOnPolyline: ฉากลงบนเส้น', n.x === 3 && n.y === 0 && n.dist === 4 && n.angle === 0);
  const n2 = F.nearestOnPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], { x: -5, y: 0 });
  check('nearestOnPolyline: หนีบที่ปลาย', n2.x === 0 && n2.t === 0);
  check('nearestOnPolyline: ไม่มีจุด = null', F.nearestOnPolyline([], { x: 0, y: 0 }) === null);
  const p = F.newPlan('');
  const tr = F.newObject('track', { x: 2, y: 2, pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }] });
  const cam = F.newObject('camera', { support: 'dolly', trackId: tr.id });
  p.objects.push(tr, cam);
  const s = F.snapToTrack(p, cam, { x: 3, y: 5 }, 0);
  check('snapToTrack: กล้องบนรางถูกดูดลงราง', s.x === 3 && s.y === 2, JSON.stringify(s));
  check('snapToTrack: ไม่มีราง = ตำแหน่งเดิม', F.snapToTrack(p, { trackId: '' }, { x: 3, y: 5 }, 0).y === 5);
  const wp = F.worldPts({ pts: [{ x: 1, y: 0 }] }, { x: 1, y: 1, rot: 90 });
  check('worldPts: เลื่อน + หมุน', near(wp[0].x, 1) && near(wp[0].y, 2), JSON.stringify(wp));
}

// ═══════════ กรอบ · ซูม ═══════════
{
  const p = F.newPlan('');
  const e = F.planBounds(p);
  check('planBounds: ผังว่าง = กรอบตั้งต้น', e.x1 - e.x0 === 10);
  p.objects.push(F.newObject('entity', { x: 0, y: 0 }), F.newObject('entity', { x: 10, y: 4 }));
  const b = F.planBounds(p, 0, { cones: false });
  check('planBounds: ครอบทุกชิ้น + ขอบเผื่อ', b.x0 < 0 && b.x1 > 10 && b.y1 > 4);
  const v = F.fitView(b, 600, 300);
  check('fitView: จุดกลางกรอบ', near(v.cx, 5) && near(v.cy, 2));
  check('fitView: เห็นทั้งกรอบ', (b.x1 - b.x0) * v.z <= 600.01 && (b.y1 - b.y0) * v.z <= 300.01);
  const z = F.zoomAt({ z: 10, cx: 0, cy: 0 }, 20, 400, 200, 600, 300);
  // จุดโลกใต้เคอร์เซอร์ก่อน = (400-300)/10 = 10 · หลัง = cx + (400-300)/20 ต้องเท่า 10
  check('zoomAt: จุดใต้เคอร์เซอร์อยู่ที่เดิม', near(z.cx + 100 / 20, 10) && near(z.cy + 50 / 20, 5));
  check('zoomStepFp: หนีบเพดาน', F.zoomStepFp(400, 1) === 400 && F.zoomStepFp(4, -1) === 4);
  check('gridStep: ช่องไม่แคบกว่า 14 px', F.gridStep(1, 5) * 5 >= 14 && F.gridStep(1, 50) === 1);
}

// ═══════════ ดัชนี (ผังจำนวนมาก) ═══════════
{
  const p = F.newPlan('ผัง A', { id: 's1', title: 'ฉากหนึ่ง' });
  const e = F.indexEntry(p);
  check('indexEntry: เก็บชื่อ/ฉาก/จำนวน', e.name === 'ผัง A' && e.sceneId === 's1' && e.beats === 1 && e.objects === 0);
  const idx = F.normalizeIndex({ plans: { 'fp-1': { name: 'b', sceneId: 's1' }, 'fp-2': { name: 'a', sceneId: 's2' }, '../x': { name: 'hack' }, 'fp-3': null } });
  check('normalizeIndex: ทิ้ง id อันตราย/ค่าเสีย', Object.keys(idx.plans).join() === 'fp-1,fp-2');
  const r = F.reconcileIndex(idx, ['fp-1', 'fp-9']);
  check('reconcileIndex: หาไฟล์ใหม่/ไฟล์ที่หาย โดยไม่อ่านเนื้อ', r.missing.join() === 'fp-9' && r.stale.join() === 'fp-2');
  check('listPlans: ผังของฉากที่เปิดอยู่ขึ้นก่อน', F.listPlans(idx, 's2')[0].id === 'fp-2' && F.listPlans(idx, '')[0].id === 'fp-2');
  check('plansForScene', F.plansForScene(idx, 's1').map((x) => x.id).join() === 'fp-1' && F.plansForScene(idx, '').length === 0);
  check('planFileName: กรองอักขระ', F.planFileName('fp-1/../x') === 'fp-1x.json');
  check('idFromFile: index.json ไม่ใช่ผัง', F.idFromFile('index.json') === null && F.idFromFile('fp-abc.json') === 'fp-abc' && F.idFromFile('a b.json') === null);
}

// ═══════════ ไฟ ═══════════
{
  check('cctToHex: 2700K ออกส้ม (แดง > น้ำเงิน)', (() => { const h = G.cctToHex(2700); return parseInt(h.slice(1, 3), 16) > parseInt(h.slice(5, 7), 16) + 60; })(), G.cctToHex(2700));
  check('cctToHex: 9000K ออกฟ้า (น้ำเงิน ≥ แดง)', (() => { const h = G.cctToHex(9000); return parseInt(h.slice(5, 7), 16) >= parseInt(h.slice(1, 3), 16); })(), G.cctToHex(9000));
  check('cctToHex: ค่าเสียไม่ throw', /^#[0-9a-f]{6}$/.test(G.cctToHex('x')));
  check('gelShift: CTO ลด · CTB เพิ่ม', G.gelShift('ctoFull') < 0 && G.gelShift('ctbFull') > 0 && G.gelShift('none') === 0);
  check('lightTypeOf ไม่รู้จัก = fresnel', G.lightTypeOf('x').id === 'fresnel');
  check('labelKey', G.labelKey('support', 'jib') === 'ui.fp.supJib');
}

// ═══════════ ป้ายทุกตัวในคลังมีคีย์ภาษา (ทั้งไทยและอังกฤษ) ═══════════
{
  const fs = require('fs');
  const csvKeys = (code) => new Set(fs.readFileSync(path.join(__dirname, '..', 'languages', 'k2_' + code + '.csv'), 'utf8')
    .split(/\r?\n/).map((l) => l.replace(/^﻿/, '').split(',')[0]));
  for (const code of ['th', 'en']) {
    const K = csvKeys(code);
    const need = [
      ...G.SUPPORTS.map((s) => G.labelKey('support', s.id)), ...G.CAM_ANGLES.map((a) => G.labelKey('angle', a)),
      ...G.SHOT_SIZES.map((a) => G.labelKey('shot', a)), ...G.LIGHT_TYPES.map((a) => G.labelKey('light', a.id)),
      ...G.DIFFUSIONS.map((a) => G.labelKey('diff', a)), ...G.GELS.map((a) => G.labelKey('gel', a)),
      ...G.SHAPE_KINDS.map((a) => G.labelKey('shape', a)),
    ];
    const miss = need.filter((k) => !K.has(k));
    check(`[${code}] ป้ายของคลังอุปกรณ์มีครบในไฟล์ภาษา`, !miss.length, miss.join(' '));
  }
}

// ═══════════ [alpha.168 · bug hunt] ทางไฟล์เอนทิตี้ = สัมพัทธ์จากรากโปรเจกต์ (ย้ายเครื่อง/โฟลเดอร์แล้วยังชี้ถูก) ═══════════
{
  const BS = String.fromCharCode(92);
  const winRoot = 'C:' + BS + 'Users' + BS + 'me' + BS + 'proj';
  const winFile = winRoot + BS + 'Wiki' + BS + 'characters' + BS + 'cat.json';
  check('[bh] entityRel: ทาง Windows ใต้ราก = สัมพัทธ์แบบ /', F.entityRel(winFile, winRoot) === 'Wiki/characters/cat.json', F.entityRel(winFile, winRoot));
  check('[bh] entityRel: ทาง mac ใต้ราก', F.entityRel('/Users/me/proj/Wiki/locations/a.json', '/Users/me/proj/') === 'Wiki/locations/a.json');
  check('[bh] entityRel: ตัวพิมพ์ของรากต่างกัน (Windows) ยังนับว่าใต้ราก', F.entityRel('c:/users/ME/proj/Wiki/x.json', 'C:/Users/me/proj') === 'Wiki/x.json');
  check('[bh] entityRel: ทางสัมพัทธ์อยู่แล้ว = เดิม', F.entityRel('Wiki/characters/cat.json', winRoot) === 'Wiki/characters/cat.json');
  check('[bh] entityRel: ว่าง = ว่าง', F.entityRel('', winRoot) === '');
  check('[bh] isAbsPath', F.isAbsPath('C:/x') && F.isAbsPath('/x') && F.isAbsPath('d:' + BS + 'x') && !F.isAbsPath('Wiki/x.json'));
  const known = ['Wiki/characters/cat.json', 'Wiki/locations/market.json', 'Wiki/items/cat.json'];
  check('[bh] ★ rebase: ไฟล์จากเครื่องอื่น จับหาง Wiki/… ได้', F.rebaseEntityRel('/Users/other/OldProj/Wiki/characters/cat.json', winRoot, known) === 'Wiki/characters/cat.json');
  check('[bh] rebase: หางไม่ตรง แต่ชื่อไฟล์ไม่ซ้ำ = จับชื่อไฟล์', F.rebaseEntityRel('/x/Bible/places/market.json', winRoot, known) === 'Wiki/locations/market.json');
  check('[bh] ★ rebase: ชื่อไฟล์ซ้ำสองที่ = ไม่เดา (คืนทางเดิม)', F.rebaseEntityRel('/x/y/cat.json', winRoot, known) === '/x/y/cat.json');
  const plan = F.newPlan('p');
  plan.objects.push(F.newObject('entity', { entityFile: winFile }), F.newObject('entity', { entityFile: 'Wiki/locations/market.json' }), F.newObject('camera', {}));
  check('[bh] ★ relinkPlanEntities: แปลงเฉพาะที่ต้องแปลง', F.relinkPlanEntities(plan, winRoot, known) === 1 && plan.objects[0].entityFile === 'Wiki/characters/cat.json');
  check('[bh] relinkPlanEntities: ทำซ้ำ = ไม่เปลี่ยนอะไร', F.relinkPlanEntities(plan, winRoot, known) === 0);
  check('[bh] normalizePlan คงทางสัมพัทธ์', F.normalizePlan(JSON.parse(JSON.stringify(plan))).objects[0].entityFile === 'Wiki/characters/cat.json');
}

// ═══════════ [alpha.168 · bug hunt] ประตูกันพลาดของแผง (อ่านซอร์ส) ═══════════
{
  const fs = require('fs');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'floorplan-ui.js'), 'utf8');
  const maps = fs.readFileSync(path.join(__dirname, '..', 'src', 'maps-ui.js'), 'utf8');
  const keyFn = ui.slice(ui.indexOf('function onKey(e)'), ui.indexOf('// ── วางของใหม่'));
  const bad = keyFn.match(/e\.key === '[^A-Za-z]'/g) || [];
  check('[bh] ★ คีย์ลัดผังพื้นที่ไม่เทียบ e.key กับสัญลักษณ์ (แป้นไทยกดไม่ติด) — ใช้ e.code', !bad.length, bad.join(' '));
  check('[bh] คีย์ลัดผังพื้นที่ใช้ e.code ครบชุด', ['Period', 'Comma', 'BracketLeft', 'BracketRight', 'Equal', 'Minus', 'Digit0'].every((c) => keyFn.includes("'" + c + "'")));
  check('[bh] ★ แผนที่: WASD จับด้วย e.code', ['KeyW', 'KeyA', 'KeyS', 'KeyD'].every((c) => maps.includes("'" + c + "'")) && !/e\.key\.toLowerCase\(\)/.test(maps));
  check('[bh] ★ วางเอนทิตี้ลงผัง = จดทางสัมพัทธ์', /entityFile: rel\b/.test(ui) && !/entityFile: file\b/.test(ui));
  check('[bh] เปิดหน้า Wiki ผ่าน openEntityOf (ไม่ส่งทางที่จดในผังตรง ๆ)', !/openEntity\(ob\.entityFile\)/.test(ui));
  check('[bh] ★ Esc ยกเลิกการลาก = วาดแผงคุณสมบัติใหม่', !/restore\(snap\); paint\(\); \}\);/.test(ui) && (ui.match(/restore\(snap\); fixSel\(\); afterChange\(\);/g) || []).length === 2);
  const store = fs.readFileSync(path.join(__dirname, '..', 'src', 'floorplan', 'fp-store.js'), 'utf8');
  check('[bh] ★ fp-store ไม่ทิ้งผลของ flushPlan ตอนสลับ/สร้าง/ทำสำเนา', !/\n  await flushPlan\(\);/.test(store));
}
console.log(`floorplan: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
