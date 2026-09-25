// test/network-camera.test.cjs — [alpha.166] กล้องของ Story Network · ข้อสังเกตของเรื่อง · ฉากหลัง/โมเดล
// ผู้ใช้: "สลับเป็น 2d 3d แล้ว กล้องไม่อิงค่า หรือไม่ sync อะไรเลย" · "graph เหมือนเครื่องประดับ" ·
//         "ใส่ background ... อวกาศ หรือแผนที่ wargame ... นำเข้า 3d model ได้ วางแทน node"
require('./_lang.cjs').installLang('th');
const path = require('path');
const fs = require('fs');
const os = require('os');
const build = (name) => {
  const out = path.join(os.tmpdir(), '_' + name.replace(/\W/g, '') + '.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + name)], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const C = build('network-camera.js');
const I = build('network-insights.js');
const S = build('network-scene.js');
const TH = build('network-theme.js');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ═══════════ การหมุน ═══════════
{
  const p = { x: 120, y: -40, z: 75 };
  for (const [rx, ry] of [[0, 0], [0.4, -0.3], [-1.2, 2.5], [1.4, -3.1]]) {
    const q = C.rot3(p, rx, ry), b = C.unrot3(q, rx, ry);
    check(`rot3 → unrot3 คืนจุดเดิม (${rx},${ry})`, near(b.x, p.x, 1e-9) && near(b.y, p.y, 1e-9) && near(b.z, p.z, 1e-9));
    // ต้องตรงกับสูตรฉายเดิม (project3D ของ network.js รุ่นก่อน) — รูปผังของผู้ใช้ไม่ขยับหลังอัปเดต
    const cosX = Math.cos(rx), sinX = Math.sin(rx), cosY = Math.cos(ry), sinY = Math.sin(ry);
    const ox = p.x * cosY + p.z * sinY, oy = p.y * cosX - (p.x * -sinY + p.z * cosY) * sinX;
    check(`rot3 x,y ตรงสูตรฉายเดิม (${rx},${ry})`, near(q.x, ox, 1e-9) && near(q.y, oy, 1e-9));
    // แกนของ axisVectors (ลูกศรมุมผัง) ต้องมาจากสูตรเดียวกัน
    const ax = TH.axisVectors(rx, ry, true);
    const e1 = C.rot3({ x: 1, y: 0, z: 0 }, rx, ry);
    check(`ลูกศรแกน X ตรงกับการฉายจริง (${rx},${ry})`, near(ax.x.x, e1.x, 1e-9) && near(ax.x.y, e1.y, 1e-9));
  }
  const r = C.rot3({ x: 3, y: 4, z: 5 }, 0.7, 1.1);
  check('การหมุนไม่เปลี่ยนระยะ', near(Math.hypot(r.x, r.y, r.z), Math.hypot(3, 4, 5), 1e-9));
  const id = C.rot3({ x: 3, y: 4, z: 5 }, 0, 0);
  check('มุม 0 = เอกลักษณ์ (2D คือ 3D ที่ไม่หมุน)', id.x === 3 && id.y === 4 && id.z === 5);
}

// ═══════════ ★ จุดโฟกัสอยู่กลางจอเสมอ ═══════════
{
  const W = 1000, H = 700;
  const cam = C.normalizeCam({ tx: 250, ty: -80, tz: 40, scale: 1.7, rx: 0.5, ry: -0.8, mode3D: true });
  for (const rot of [{ rx: 0, ry: 0 }, { rx: 0.5, ry: -0.8 }, { rx: -1.1, ry: 2 }]) {
    const s = C.worldToScreen(cam, { x: cam.tx, y: cam.ty, z: cam.tz }, W, H, rot);
    check(`★ จุดโฟกัสอยู่กลางจอทุกมุม (${rot.rx},${rot.ry})`, near(s.x, W / 2, 1e-9) && near(s.y, H / 2, 1e-9), s.x + ',' + s.y);
  }
  // สลับ 2D ↔ 3D = เปลี่ยนแค่มุม · จุดโฟกัสไม่ขยับ → ของที่กลางจอยังอยู่กลางจอ
  const flat = C.worldToScreen(cam, { x: cam.tx, y: cam.ty, z: 999 }, W, H, { rx: 0, ry: 0 });
  check('★ 2D: ความลึกไม่มีผลกับตำแหน่งบนจอ (z ของโฟกัสเปลี่ยนแล้วภาพ 2D ไม่ขยับ)', near(flat.x, W / 2) && near(flat.y, H / 2));
  // แพน: ลากไปขวา 100px → ทุกจุดบนจอเลื่อนขวา 100px (ทั้ง 2D และ 3D)
  for (const rot of [{ rx: 0, ry: 0 }, { rx: 0.5, ry: -0.8 }]) {
    const p = { x: 31, y: 77, z: -12 };
    const a = C.worldToScreen(cam, p, W, H, rot);
    const cam2 = C.panCam(cam, 100, -40, rot);
    const b = C.worldToScreen(cam2, p, W, H, rot);
    check(`แพนตามมือพอดี (${rot.rx})`, near(b.x - a.x, 100, 1e-6) && near(b.y - a.y, -40, 1e-6), (b.x - a.x) + ',' + (b.y - a.y));
  }
  // ลากโหนดบนระนาบของจอ → โหนดตามเมาส์พอดีทุกมุม (เดิมโหมด 3D โหนดวิ่งผิดทิศ)
  {
    const rot = { rx: 0.9, ry: 1.3 };
    const n = { x: 10, y: 20, z: 30 };
    const a = C.worldToScreen(cam, n, W, H, rot);
    const d = C.screenDeltaToWorld(cam, 50, 25, rot);
    const b = C.worldToScreen(cam, { x: n.x + d.x, y: n.y + d.y, z: n.z + d.z }, W, H, rot);
    check('★ ลากโหนดตอน 3D = โหนดตามเมาส์ (ไม่วิ่งผิดทิศ)', near(b.x - a.x, 50, 1e-6) && near(b.y - a.y, 25, 1e-6));
    check('ลากตอน 3D ไม่เปลี่ยนความลึกบนจอ', near(b.depth, a.depth, 1e-6));
  }
  const o = C.camOffset(cam, W, H, { rx: 0, ry: 0 });
  check('camOffset: 2D = กลางจอ − สเกล × โฟกัส', near(o.cx, W / 2 - 1.7 * 250) && near(o.cy, H / 2 - 1.7 * -80));
}

// ═══════════ จัดให้เห็นทั้งผัง · ความลึกของสิ่งที่กำลังดู ═══════════
{
  const pts = [{ x: -300, y: -100, z: 50 }, { x: 500, y: 200, z: -50 }, { x: 100, y: 0, z: 0 }];
  for (const rot of [{ rx: 0, ry: 0 }, { rx: 0.4, ry: -0.3 }]) {
    const f = C.fitCam(pts, 900, 600, rot);
    const cam = { ...C.normalizeCam({}), ...f };
    const ok = pts.every((p) => { const s = C.worldToScreen(cam, p, 900, 600, rot); return s.x >= 0 && s.x <= 900 && s.y >= 0 && s.y <= 600; });
    check(`fitCam เห็นทุกจุด (${rot.rx})`, ok);
  }
  check('fitCam ไม่มีจุด = null', C.fitCam([], 900, 600) === null);
  const cam = C.normalizeCam({ tx: 0, ty: 0, tz: 0, scale: 1 });
  const vis = [{ x: 0, y: 0, z: 100 }, { x: 10, y: 10, z: 200 }, { x: 99999, y: 0, z: -5000 }];
  check('viewDepth = ความลึกเฉลี่ยของจุดที่อยู่ในจอเท่านั้น', near(C.viewDepth(vis, cam, 800, 600, { rx: 0, ry: 0 }), 150));
  check('viewDepth ไม่มีจุดในจอ = เฉลี่ยทั้งหมด', near(C.viewDepth([{ x: 9e5, y: 0, z: 10 }], cam, 800, 600, { rx: 0, ry: 0 }), 10));
}

// ═══════════ ค่าที่เก็บ · ภาพเคลื่อนไหว ═══════════
{
  const n = C.normalizeCam({ tx: 'x', scale: -3, rx: 99, ry: NaN, mode3D: 1 });
  check('normalizeCam: ค่าเสีย → ค่าเริ่มต้น/หนีบช่วง', n.tx === 0 && n.scale === 1 && n.rx < Math.PI / 2 && n.ry === C.CAM_DEFAULT_ANGLES.ry && n.mode3D === true);
  check('สเกลหนีบ 0.05–8', C.clampScale(100) === 8 && C.clampScale(0.001) === 0.05);
  const s = C.serializeCam({ tx: 1.23456, ty: 2, tz: 3, scale: 0.123456, rx: 0.4444, ry: 1, mode3D: false, v: 2 });
  check('[รอบ 2] กล้องที่บันทึกก่อนรุ่นนี้ (มุมบวก = มองจากใต้โต๊ะ) ถูกพลิกเป็นมองจากด้านบนครั้งเดียว',
    C.normalizeCam({ rx: 0.4 }).rx === -0.4 && C.normalizeCam({ rx: 0.4, v: 2 }).rx === 0.4 && C.normalizeCam(C.normalizeCam({ rx: 0.4 })).rx === -0.4);
  check('[รอบ 2] ค่าเริ่มต้น = มองโต๊ะจากด้านบน (rx ติดลบ) + มุมมองระยะเปิด', C.normalizeCam(null).rx < 0 && C.normalizeCam(null).persp === true);
  check('serializeCam ปัดเศษ (ไม่ให้ localStorage บวม)', s.tx === 1 && s.scale === 0.123 && s.rx === 0.444);
  check('serializeCam → normalizeCam ไป-กลับได้', C.normalizeCam(s).scale === 0.123);
  const a = { tx: 0, ty: 0, tz: 0, scale: 1, rx: 0, ry: 3.0 }, b = { tx: 100, ty: 50, tz: 10, scale: 4, rx: 0, ry: -3.0 };
  const m0 = C.lerpCam(a, b, 0), m1 = C.lerpCam(a, b, 1), mh = C.lerpCam(a, b, 0.5);
  check('lerpCam: ต้น/ปลายตรง', near(m0.tx, 0) && near(m1.tx, 100) && near(m1.scale, 4));
  check('lerpCam: สเกลไล่แบบเรขาคณิต (กลางทาง = 2 ไม่ใช่ 2.5)', near(mh.scale, 2, 1e-9));
  check('lerpCam: มุมหมุนทางสั้น (3 → −3 ผ่าน π ไม่อ้อมผ่าน 0)', Math.abs(mh.ry) > 3);
}

// ═══════════ ★ ข้อสังเกตของเรื่อง ═══════════
{
  const N = (name, cat = 'characters') => ({ name, cat });
  const A = N('ก'), B = N('ข'), Cc = N('ค'), D = N('ง'), E = N('จ'), L = N('วัง', 'locations');
  const s1 = N('ฉาก1', 'scene'), s2 = N('ฉาก2', 'scene');
  const edges = [
    { a: A, b: B, type: 'family', role: 'พ่อ' },
    { a: B, b: Cc, type: 'ally', role: 'เพื่อน' },
    { a: A, b: s1, type: 'ent-scene' }, { a: Cc, b: s1, type: 'ent-scene' }, { a: Cc, b: s2, type: 'ent-scene' },
    { a: D, b: s2, type: 'ent-scene' },
    { a: Cc, b: D, type: 'co-occur', role: 'co-occur 3', count: 3 },
    { a: A, b: Cc, type: 'co-occur', role: 'co-occur 2' },
  ];
  const nodes = [A, B, Cc, D, E, L, s1, s2];
  const ego1 = I.egoSet(A, edges, 1);
  check('egoSet 1 ชั้น = ตัวเอง + เพื่อนบ้าน', ego1.get(A) === 0 && ego1.get(B) === 1 && ego1.has(s1) && !ego1.has(E));
  const ego2 = I.egoSet(A, edges, 2);
  check('egoSet 2 ชั้น เห็นเพื่อนของเพื่อน', ego2.get(Cc) === 1 || ego2.get(Cc) === 2);
  check('egoSet กรองชนิดเส้นได้', !I.egoSet(A, edges, 1, { filter: I.isRelationEdge }).has(s1));
  const p = I.shortestPath(A, Cc, edges);
  check('★ หาเส้นทาง: ผ่านความสัมพันธ์ก่อน (ก → ข → ค)', p && p.nodes.map((x) => x.name).join('>') === 'ก>ข>ค' && !p.viaDerived, p && p.nodes.map((x) => x.name).join('>'));
  const p2 = I.shortestPath(A, D, edges);
  check('★ หาเส้นทาง: ไม่มีความสัมพันธ์ตรง → ยอมผ่านฉาก (แจ้งว่า viaDerived)', p2 && p2.viaDerived && p2.nodes[0] === A && p2.nodes[p2.nodes.length - 1] === D);
  check('หาเส้นทาง: ไม่มีทางเลย = null', I.shortestPath(A, E, edges) === null);
  check('หาเส้นทาง: allowDerived:false ไม่ผ่านฉาก', I.shortestPath(A, D, edges, { allowDerived: false }) === null);
  check('หาเส้นทาง: เส้นในผลลัพธ์เรียงตามก้าว', p.edges.length === 2 && p.edges[0].role === 'พ่อ');
  check('scenesOf เรียงตามลำดับโหนด', I.scenesOf(Cc, edges, nodes).map((x) => x.name).join() === 'ฉาก1,ฉาก2');
  check('relationsOf ไม่รวมฉาก/การปรากฏร่วม', I.relationsOf(Cc, edges).map((x) => x.node.name).join() === 'ข');
  check('coCount อ่านจากป้ายได้', I.coCount({ type: 'co-occur', role: 'co-occur 7' }) === 7 && I.coCount({ type: 'ally' }) === 0);
  const ins = I.storyInsights(nodes, edges);
  check('★ ลอยอยู่คนเดียว = ไม่มีความสัมพันธ์ (ฉากไม่นับ)', ins.isolated.map((x) => x.name).sort().join() === ['ง', 'จ', 'วัง'].sort().join(), ins.isolated.map((x) => x.name).join());
  check('★ ไม่เคยถูกเอ่ยถึง', ins.unmentioned.map((x) => x.name).sort().join() === ['ข', 'จ', 'วัง'].sort().join(), ins.unmentioned.map((x) => x.name).join());
  check('★ ศูนย์กลาง: ความสัมพันธ์นับ ×2 + ฉาก (ข = 2×2 เสมอ ค = 1×2+2 → เรียงชื่อ ข ก่อน)', ins.hubs[0].node === B, ins.hubs.map((h) => h.node.name).join());
  check('★ คู่ที่ควรผูก: ค–ง (3 ฉาก) + ก–ค (2 ฉาก) · เรียงมากไปน้อย', ins.suggestions.length === 2 && ins.suggestions[0].count === 3);
  const ins2 = I.storyInsights([A, B], [{ a: A, b: B, type: 'co-occur', count: 5 }, { a: A, b: B, type: 'family' }]);
  check('คู่ที่ผูกแล้วไม่ถูกเสนอซ้ำ', ins2.suggestions.length === 0);
  check('ผังไม่มีฉาก = ไม่ฟ้อง "ไม่เคยถูกเอ่ยถึง"', I.storyInsights([A, B], []).unmentioned.length === 0);
  const deg = I.degreeMap(nodes, edges);
  check('degreeMap นับทั้งสองปลาย', deg.get(Cc) === 5 && deg.get(E) === 0);
}

// ═══════════ ★ ฉากหลัง / กริด / โมเดล ═══════════
{
  const d = S.normalizeNetScene(null);
  check('ค่าเริ่มต้น = ตามธีม + กริดตาราง (หน้าตาเดิมก่อนอัปเดต)', d.bg.kind === 'theme' && d.grid.style === 'square' && d.grid.px === 60 && d.grid.alpha === 0.12);
  check('ชนิดไม่รู้จัก → ตามธีม', S.normalizeNetScene({ bg: { kind: 'lava' } }).bg.kind === 'theme');
  const sp = S.withBgKind(d, 'space');
  check('★ เลือกอวกาศ = สีของพรีเซ็ต + ไม่มีกริด', sp.bg.kind === 'space' && sp.bg.c1 && sp.grid.style === 'none');
  const wg = S.withBgKind(sp, 'wargame');
  check('★ เลือกแผนที่ wargame = กริดหกเหลี่ยม + สีของพรีเซ็ต (ไม่ค้างสีอวกาศ)', wg.grid.style === 'hex' && wg.bg.c1 !== sp.bg.c1);
  check('สีเสีย → สีของพรีเซ็ต', S.normalizeNetScene({ bg: { kind: 'solid', c1: 'red' } }).bg.c1.startsWith('#'));
  check('ช่วงค่าถูกหนีบ', S.normalizeNetScene({ grid: { px: 5, alpha: 9 }, bg: { dim: 5, imageOpacity: -1 } }).grid.px === 20
    && S.normalizeNetScene({ grid: { alpha: 9 } }).grid.alpha === 1 && S.normalizeNetScene({ bg: { dim: 5 } }).bg.dim === 0.9);
  check('★ ทางรูป/โมเดลต้องเป็นทางสัมพัทธ์ในโปรเจกต์ (กัน ../ และทางเต็ม)',
    S.normalizeNetScene({ bg: { image: '../x.png' } }).bg.image === '' &&
    S.normalizeNetScene({ bg: { image: 'C:\\x.png' } }).bg.image === '' &&
    S.normalizeNetScene({ bg: { image: '/etc/x.png' } }).bg.image === '' &&
    S.normalizeNetScene({ bg: { image: 'Images\\map.png' } }).bg.image === 'Images/map.png');
  check('gridColorOf: ผู้ใช้ตั้ง > พรีเซ็ต > ธีม', S.gridColorOf({ grid: { color: '#123456' } }, '#000000') === '#123456'
    && S.gridColorOf(wg, '#000000') !== '#000000' && S.gridColorOf(d, '#abcdef') === '#abcdef');
  check('isLightBg: กระดาษเก่า = สว่าง · อวกาศ = มืด', S.isLightBg(S.withBgKind(d, 'parchment'), '#000000') && !S.isLightBg(sp, '#ffffff'));
  const node = { cat: 'characters', name: 'ทอร่า' };
  let sc = S.setNodeModel(d, node, { file: 'Models/tora.glb', scale: 2 });
  check('★ ตั้งโมเดลให้โหนด', S.modelFor(sc, node).file === 'Models/tora.glb' && S.modelFor(sc, node).scale === 2);
  sc = S.setCatModel(sc, 'characters', { file: 'Models/pawn.obj' });
  check('โมเดลของโหนดชนะโมเดลประจำหมวด', S.modelFor(sc, node).file === 'Models/tora.glb');
  check('โหนดอื่นในหมวดได้โมเดลประจำหมวด', S.modelFor(sc, { cat: 'characters', name: 'อื่น' }).file === 'Models/pawn.obj');
  sc = S.setNodeModel(sc, node, null);
  check('ลบโมเดลของโหนด → กลับไปใช้ของหมวด', S.modelFor(sc, node).file === 'Models/pawn.obj');
  check('นามสกุลที่ไม่รองรับถูกทิ้ง', S.modelFor(S.setNodeModel(d, node, { file: 'Models/x.fbx' }), node) === null);
  check('modelKind', S.modelKind('a/b.GLB') === 'glb' && S.modelKind('x.fbx') === '');
  // ดาว/หกเหลี่ยม
  const st1 = S.starField(1, 7), st2 = S.starField(1, 7);
  check('ดาวคงที่ทุกครั้ง (ไม่กะพริบ)', st1.length === st2.length && st1.every((s, i) => s.x === st2[i].x && s.y === st2[i].y));
  check('ดาวมีสามชั้น (parallax)', new Set(st1.map((s) => s.layer)).size === 3);
  check('ความหนาแน่น 0 = ไม่มีดาว', S.starField(0).length === 0);
  const hx = S.hexCenters(0, 0, 300, 300, 30);
  check('หกเหลี่ยมคลุมกรอบ', hx.length > 20 && hx.some((h) => h.x <= 0) && hx.some((h) => h.x >= 300));
  check('หกเหลี่ยมจำกัดจำนวน (ซูมออกสุดไม่ค้าง)', S.hexCenters(-1e6, -1e6, 1e6, 1e6, 10).length === 0);
  const k = S.hexCorners(0, 0, 10);
  check('มุมหกเหลี่ยมอยู่บนวงรัศมีเท่ากัน', k.length === 6 && k.every((p) => near(Math.hypot(p.x, p.y), 10, 1e-9)));
}

// ═══════════ [รอบ 2] มุมมองระยะ (ตัวฉายตัวเดียว) ═══════════
{
  const L = build('network-layout.js');
  const W = 900, H = 600;
  const cam = C.normalizeCam({ tx: 40, ty: -20, tz: 15, scale: 1.3, v: 2 });
  const rot = { rx: -0.6, ry: 0.4 };
  const p0 = C.makeProjector(cam, W, H, rot, 0);
  const pts = [{ x: 120, y: -40, z: 75 }, { x: -300, y: 210, z: -140 }, { x: 5, y: 5, z: 5 }];
  check('★ ตัวฉาย k=0 = สูตรเดิมทุกจุด (worldToScreen)', pts.every((p) => { const a = p0.proj(p), b = C.worldToScreen(cam, p, W, H, rot); return near(a.x, b.x, 1e-9) && near(a.y, b.y, 1e-9); }));
  const p1 = C.makeProjector(cam, W, H, rot, 1);
  const t = p1.proj({ x: cam.tx, y: cam.ty, z: cam.tz });
  check('★ มีมุมมองระยะ: จุดโฟกัสยังอยู่กลางจอพอดี', near(t.x, W / 2, 1e-9) && near(t.y, H / 2, 1e-9) && near(t.f, 1, 1e-12));
  const near1 = p1.proj(C.unrot3({ x: 0, y: 0, z: -300 }, rot.rx, rot.ry)), far1 = p1.proj(C.unrot3({ x: 0, y: 0, z: 300 }, rot.rx, rot.ry));
  check('★ ของใกล้กล้อง (ความลึกน้อย) ตัวคูณขนาดโต · ของไกลเล็กลง', near1.f > 1 && far1.f < 1, near1.f + ' / ' + far1.f);
  check('ของหลังกล้อง = behind (ไม่วาด)', p1.proj(C.unrot3({ x: 0, y: 0, z: -5000 }, rot.rx, rot.ry)).behind === true);
  // ย้อนจอ → ระนาบ z=0 ต้องได้จุดเดิม (ทั้งแบบขนานและมุมมองระยะ) — กริด/รูปแผนที่วางตรงกับโหนดบนพื้น
  for (const [k, pj] of [[0, p0], [1, p1]]) {
    const ok = [[100, 50], [-220, 310], [0, 0], [480, -90]].every(([u, v]) => { const sp = pj.proj({ x: u, y: v, z: 0 }); const b = pj.planeAt(sp.x, sp.y); return b && near(b.u, u, 1e-6) && near(b.v, v, 1e-6); });
    check(`★ planeAt ย้อน proj บนระนาบได้จุดเดิม (k=${k})`, ok);
  }
  // ลากตอนมีมุมมองระยะ: หารด้วยตัวคูณของโหนด → ตามเมาส์พอดี
  const n = { x: 200, y: 80, z: 120 };
  const a = p1.proj(n), d = p1.deltaToWorld(30, -20, a.f);
  const b = p1.proj({ x: n.x + d.x, y: n.y + d.y, z: n.z + d.z });
  check('★ ลากโหนดตอนมีมุมมองระยะ = ตามเมาส์ (คลาดไม่เกินครึ่งพิกเซล)', Math.abs(b.x - a.x - 30) < 0.5 && Math.abs(b.y - a.y + 20) < 0.5, (b.x - a.x) + ',' + (b.y - a.y));

  // ═══════════ ไทม์ไลน์เรื่อง ═══════════
  const N = (name, cat, extra = {}) => ({ name, cat, ...extra });
  const s1 = N('ฉาก1', 'scene', { seq: 1 }), s2 = N('ฉาก2', 'scene', { seq: 2 }), s3 = N('ฉาก3', 'scene', { seq: 3 });
  const ch = N('บท1', 'chapter');
  const A = N('ก', 'characters'), B = N('ข', 'characters'), Cc = N('ค', 'characters'), D = N('ง', 'characters');
  const edges = [
    { a: A, b: s1, type: 'ent-scene' }, { a: B, b: s2, type: 'ent-scene' }, { a: A, b: s2, type: 'ent-scene' },
    { a: Cc, b: s3, type: 'ent-scene' }, { a: s1, b: ch, type: 'scene-link' }, { a: s2, b: ch, type: 'scene-link' },
    { a: A, b: B, type: 'family' }, { a: A, b: Cc, type: 'enemy' }, { a: A, b: D, type: 'ally' },
  ];
  const nodes = [s3, A, B, Cc, D, s1, s2, ch];
  check('sceneOrder เรียงตาม seq (ไม่ใช่ลำดับในรายการ)', I.sceneOrder(nodes).map((x) => x.name).join() === 'ฉาก1,ฉาก2,ฉาก3');
  const p0s = I.storyProgress(nodes, edges, 0);
  check('ยังไม่เริ่มเรื่อง = ไม่มีอะไรเกิดขึ้น', p0s.nodes.size === 0 && p0s.edges.size === 0 && p0s.total === 3);
  const pa = I.storyProgress(nodes, edges, 1);
  check('★ บทที่เกิดแล้วไม่ดึงฉากอื่นของบทเดียวกันให้เกิดตาม (ไหลขึ้นอย่างเดียว)', !pa.nodes.has(s2));
  check('★ ถึงฉาก 1: ฉาก + บท + ตัวที่ปรากฏ (ก) · ข ยังไม่เข้าเรื่อง', pa.nodes.has(s1) && pa.nodes.has(ch) && pa.nodes.has(A) && !pa.nodes.has(B) && !pa.nodes.has(s2));
  check('★ ความสัมพันธ์ ก–ข ยังไม่เกิด (ข ยังไม่ปรากฏ)', ![...pa.edges].some((e) => e.type === 'family'));
  check('ตัวที่เพิ่งเข้าเรื่องในฉากนี้ = ก · ฉากปัจจุบัน = ฉาก1', pa.fresh.has(A) && pa.current === s1);
  const pb = I.storyProgress(nodes, edges, 2);
  check('★ ถึงฉาก 2: ข เข้าเรื่อง + ความสัมพันธ์ ก–ข เกิดขึ้น · ก ไม่นับเป็นตัวใหม่', pb.nodes.has(B) && [...pb.edges].some((e) => e.type === 'family') && pb.fresh.has(B) && !pb.fresh.has(A));
  check('ตัวที่ไม่เคยถูกเอ่ยถึง (ง) ไม่เข้าเรื่องเลย', !I.storyProgress(nodes, edges, 3).nodes.has(D));
  {
    const X = N('x', 'characters'), Y = N('y', 'characters');
    const es2 = [{ a: X, b: s1, type: 'ent-scene' }, { a: Y, b: s1, type: 'ent-scene' }, { a: s2, b: X, type: 'ent-scene' }, { a: Y, b: s2, type: 'ent-scene' }, { a: A, b: s3, type: 'ent-scene' }];
    const cp = I.coOccurPairs(es2, 2);
    check('★ [รอบ 2] ปรากฏร่วม: นับฉากร่วมจากเส้น ent-scene (ไม่พึ่งดัชนีที่อาจยังไม่สร้าง)', cp.length === 1 && cp[0].count === 2 && new Set([cp[0].a, cp[0].b]).has(X));
    check('ปรากฏร่วมฉากเดียวไม่นับ (ขั้นต่ำ 2)', I.coOccurPairs(es2.slice(0, 2), 2).length === 0 && I.coOccurPairs(es2.slice(0, 2), 1).length === 1);
  }
  check('ค่าเกินช่วงถูกหนีบ', I.storyProgress(nodes, edges, 99).nodes.has(Cc) && I.storyProgress(nodes, edges, -5).nodes.size === 0);

  // ═══════════ จัดผัง ═══════════
  const cat = L.layoutByCategory(nodes);
  check('★ จัดตามหมวด: ทุกโหนดได้ตำแหน่ง · z = 0 (วางบนโต๊ะ)', nodes.every((x) => cat.has(x) && cat.get(x).z === 0));
  const cx = (list) => list.reduce((a, x) => a + cat.get(x).x, 0) / list.length;
  check('จัดตามหมวด: โครงเรื่องอยู่กลาง ตัวละครอยู่วงนอก', Math.abs(cx([s1, s2, s3, ch])) < 80 && Math.hypot(cx([A, B, Cc, D]), cat.get(A).y) > 150);
  const st = L.layoutStory(nodes, edges, I.sceneOrder(nodes));
  check('★ ตามลำดับเรื่อง: ฉากเรียงซ้ายไปขวาตามลำดับ', st.get(s1).x < st.get(s2).x && st.get(s2).x < st.get(s3).x && st.get(s1).y === 0);
  check('ตามลำดับเรื่อง: บทอยู่เหนือแกน · ตัวละครอยู่ใต้แกน ตรงกับฉากของตัวเอง', st.get(ch).y < 0 && st.get(Cc).y > 0 && st.get(Cc).x === st.get(s3).x);
  check('ตามลำดับเรื่อง: ตัวละครที่ x เดียวกันไม่ทับกัน', (() => { const ps = [A, B, Cc, D].map((x) => st.get(x)); return ps.every((p, i) => ps.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 30)); })());
  const rd = L.layoutRadial(A, nodes, edges);
  check('★ วงรอบโหนดที่เลือก: ศูนย์กลาง (0,0) · เพื่อนบ้านวงแรก · ที่เหลือวงถัดไป',
    rd.get(A).x === 0 && rd.get(A).y === 0 && near(Math.hypot(rd.get(B).x, rd.get(B).y), 190, 2) && Math.hypot(rd.get(ch).x, rd.get(ch).y) > 300);
  check('วงรอบ: ไม่มีศูนย์กลาง = ว่าง', L.layoutRadial(null, nodes, edges).size === 0);
}

// ═══════════ กันหลุด: ตัววาด/แผงข้างต้องไม่ใส่ข้อความผู้ใช้ลง innerHTML · ต้องใช้กล้องตัวเดียว ═══════════
{
  const rd = (f) => fs.readFileSync(path.join(__dirname, '../src/' + f), 'utf8');
  const net = rd('network.js'), side = rd('network-inspector.js');
  check('network.js ไม่มี project3D แยกของตัวเองแล้ว (กล้องตัวเดียว)', !/function project3D/.test(net));
  check('network.js ไม่มี innerHTML', !/innerHTML/.test(net));
  check('แผงข้างไม่มี innerHTML', !/innerHTML/.test(side));
  check('เมนูคลิกขวาของผังใช้ popupMenu (คีย์บอร์ดได้)', /popupMenu\(e\.clientX,e\.clientY,items\)/.test(net));
  check('ผังส่งข้อความผู้ใช้ในเมนูทาง text (ไม่ใช่ label HTML)', /items\.push\(\{text:label/.test(net));
  check('three.js ไม่อยู่ในบันเดิลหลัก (โหลดแยกเมื่อใช้)', !/from 'three'/.test(rd('network-models.js')) && !/from 'three'/.test(net));
  check('build.js สร้าง renderer/net3d.js', /renderer\/net3d\.js/.test(fs.readFileSync(path.join(__dirname, '../build.js'), 'utf8')));
}

console.log(`network-camera: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
