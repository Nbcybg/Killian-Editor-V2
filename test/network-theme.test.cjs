// test/network-theme.test.cjs — สี/การควบคุม/กล้อง ของ Story Network (alpha.73 ข้อ 2,3,4)
// กฎที่ต้องกันไม่ให้พังซ้ำ: ทุกสีที่ตัววาดใช้ ต้องมีช่องให้ตั้งในตั้งค่า และห้ามฮาร์ดโค้ดปุ่มเมาส์
const path = require('path');
const fs = require('fs');
const out = path.join(require('os').tmpdir(), '_nettheme.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/network-theme.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const N = require(out);
const relOut = path.join(require('os').tmpdir(), '_reltypes.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/relationship-types.js')], outfile: relOut, format: 'cjs', bundle: true, logLevel: 'silent' });
const { REL_TYPES } = require(relOut);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ═══════════ ครบถ้วน: ทุกสีที่ผังใช้ ต้องตั้งได้ ═══════════
{
  const defs = N.NET_COLOR_DEFS;
  check('คีย์ไม่ซ้ำกัน', new Set(defs.map((d) => d.key)).size === defs.length);
  check('ทุกนิยามมี key/id/label/group/target ครบ',
        defs.every((d) => d.key && d.id && d.label && d.group && d.target));
  check('ทุกนิยามมีค่าเริ่มต้น (สี hex หรือผูกกับตัวแปรธีม)',
        defs.every((d) => /^#[0-9a-f]{6}$/i.test(d.def) || !!d.cssVar),
        defs.filter((d) => !/^#[0-9a-f]{6}$/i.test(d.def) && !d.cssVar).map((d) => d.key).join());

  // หมวดโหนดต้องครบทุกหมวดที่ผังวาดจริง
  const nodeIds = defs.filter((d) => d.target === 'node').map((d) => d.id).sort();
  const want = ['book', 'chapter', 'characters', 'items', 'locations', 'lore', 'scene', 'section'];
  check('สีโหนดครบทุกหมวดที่ผังวาด (รวม book/section ที่เคยใช้ช่องร่วมกัน)',
        nodeIds.join() === want.join(), nodeIds.join());
  // เส้นต้องครบทุกประเภทความสัมพันธ์ + เส้นพิเศษ 3 แบบ
  const edgeIds = defs.filter((d) => d.target === 'edge').map((d) => d.id);
  check('สีเส้นครบทุกประเภทใน REL_TYPES (เดิมมีช่องเดียวคุมทุกประเภท)',
        REL_TYPES.every((t) => edgeIds.includes(t.key)),
        REL_TYPES.filter((t) => !edgeIds.includes(t.key)).map((t) => t.key).join());
  check('มีเส้นพิเศษครบ 3 แบบ',
        ['scene-link', 'co-occur', 'ent-scene'].every((k) => edgeIds.includes(k)));
  check('มีสีผืนผ้าใบครบ (พื้น/กริด/ตัวหนังสือ/ขอบ/แกน)',
        ['bg', 'grid', 'label', 'labelBg', 'border', 'hover', 'axis']
          .every((k) => defs.some((d) => d.target === 'canvas' && d.id === k)),
        defs.filter((d) => d.target === 'canvas').map((d) => d.id).join());
  check('กลุ่มที่ประกาศไว้ ครอบคลุมทุกนิยาม',
        defs.every((d) => N.NET_COLOR_GROUPS.some((g) => g.group === d.group)));
  check('netColorDefsOf คืนเฉพาะกลุ่มนั้น',
        N.netColorDefsOf('nodes').length === 8 && N.netColorDefsOf('edges').length === REL_TYPES.length,
        `${N.netColorDefsOf('nodes').length}/${N.netColorDefsOf('edges').length}`);
  check('defaultNetColors มีคีย์ครบทุกตัว',
        Object.keys(N.defaultNetColors()).length === defs.length);
}

// ═══════════ resolveNetColors ═══════════
{
  const varOf = (v) => ({ '--bg': '#101010', '--border': '#333333', '--bright': '#ffffff',
                          '--side': '#202020', '--dim': '#888888' }[v] || '');
  const r = N.resolveNetColors({}, varOf);
  check('ไม่ตั้งอะไรเลย → ได้ค่าเริ่มต้นครบ', r.node.characters === '#d97757' && r.edge.family === '#e06c75');
  check('สีผืนผ้าใบตามธีมเมื่อไม่ได้ตั้งเอง', r.canvas.bg === '#101010' && r.canvas.grid === '#333333');
  check('สีที่ไม่มี cssVar ใช้ค่าเริ่มต้นตามปกติ', r.canvas.border === '#1f1e1c');
  const r2 = N.resolveNetColors({ 'nc-char': '#00ff00', 'nb-bg': '#123456', 'ne-rt-enemy': '#ff0000' }, varOf);
  check('ค่าที่ผู้ใช้ตั้งชนะค่าเริ่มต้น', r2.node.characters === '#00ff00');
  check('ตั้งพื้นเองแล้วไม่ตามธีม', r2.canvas.bg === '#123456');
  check('ตั้งสีเส้นรายประเภทได้', r2.edge.enemy === '#ff0000' && r2.edge.family === '#e06c75');
  check('อ่านตัวแปรธีมไม่ได้ → ตกมาที่ค่าเริ่มต้น ไม่ใช่ค่าว่าง',
        N.resolveNetColors({}, () => '').canvas.bg !== '' , N.resolveNetColors({}, () => '').canvas.bg);
  check('ไม่ส่ง varOf มาก็ไม่พัง', typeof N.resolveNetColors({}).canvas.bg === 'string');
  check('saved เป็น null ไม่พัง', N.resolveNetColors(null, varOf).node.items === '#6fae8a');
}

// ═══════════ อ่านค่ารูปแบบเก่าได้ (โปรเจกต์ที่ตั้งสีไว้แล้ว) ═══════════
{
  const old = { cats: { 'nc-char': '#111111', 'nc-loca': '#222222' },
                edges: { 'ne-sl': '#333333', 'ne-rel': '#444444' } };
  check('ตรวจจับรูปแบบเก่าได้', N.needsNetColorMigration(old) === true);
  check('รูปแบบใหม่ไม่ถูกนับเป็นเก่า', N.needsNetColorMigration({ 'nc-char': '#fff' }) === false);
  check('null ไม่พัง', N.needsNetColorMigration(null) === false);
  const m = N.normalizeNetColors(old);
  check('ย้ายสีหมวดมาคีย์ใหม่', m['nc-char'] === '#111111' && m['nc-loca'] === '#222222');
  check('ไม่เหลือคีย์ cats/edges ค้าง', m.cats === undefined && m.edges === undefined);
  check('ne-rel (สีเดียวคุมทุกประเภท) ถูกกระจายให้ทุกประเภทความสัมพันธ์',
        REL_TYPES.every((t) => m['ne-rt-' + t.key] === '#444444'),
        JSON.stringify(m['ne-rt-family']));
  check('เส้นพิเศษที่ตั้งไว้เดิมยังอยู่', m['ne-sl'] === '#333333');
  const r = N.resolveNetColors(old, () => '');
  check('ใช้ค่าเก่าวาดได้ทันที', r.node.characters === '#111111' && r.edge.enemy === '#444444');
}

// ═══════════ การควบคุมด้วยเมาส์ (ห้ามฮาร์ดโค้ด) ═══════════
{
  check('ค่าเริ่มต้น: ปุ่มกลางหมุน 3D (เหมือนรุ่นก่อน)', N.DEFAULT_NET_CONTROLS.orbitButton === 'middle');
  check('แปลงชื่อปุ่ม → เลข button ของ DOM',
        N.buttonIndex('left') === 0 && N.buttonIndex('middle') === 1 && N.buttonIndex('right') === 2);
  check('ปุ่มแปลก ๆ → ถอยไปปุ่มกลาง', N.buttonIndex('zzz') === 1);
  check('ทุกปุ่มมีชื่อไทย', N.MOUSE_BUTTONS.every((b) => !!b.label) && N.buttonLabel('middle').includes('กลาง'));
  const c1 = N.resolveNetControls({ orbitButton: 'right' });
  check('ตั้งเป็นคลิกขวาได้', c1.orbitButton === 'right');
  check('แพนถอยไปปุ่มอื่นเมื่อชนกัน',
        N.resolveNetControls({ orbitButton: 'left', panButton: 'left' }).panButton === 'right');
  check('ค่าพัง → ใช้ค่าเริ่มต้น',
        N.resolveNetControls({ orbitButton: 'zzz' }).orbitButton === 'middle' &&
        N.resolveNetControls(null).orbitButton === 'middle');

  // คำอธิบายใต้ผังต้องตรงกับปุ่มที่ตั้งไว้เสมอ
  const h3 = N.controlsHint({ orbitButton: 'middle' }, true);
  check('โหมด 3D: คำอธิบายบอกปุ่มหมุนตามที่ตั้งไว้', h3.includes('ปุ่มกลาง') && h3.includes('หมุนมุมมอง 3D'), h3);
  const hr = N.controlsHint({ orbitButton: 'right' }, true);
  check('เปลี่ยนเป็นคลิกขวา → คำอธิบายเปลี่ยนตาม (ไม่ใช่ข้อความตายตัว)',
        hr.includes('คลิกขวา') && !hr.includes('ปุ่มกลาง'), hr);
  check('โหมด 2D: บอกวิธีเข้าโหมดหมุนไว้ด้วย', N.controlsHint({}, false).includes('3D'));
  check('คำอธิบายมีเรื่อง Shift+คลิก = ผลัก', N.controlsHint({}, false).includes('ผลัก'));
}

// ═══════════ กล้อง: x/y ต้องไม่เปลี่ยนตอนซูม ═══════════
{
  const w = 800, h = 600;
  const cam = { scale: 1, cx: 0, cy: 0 };
  const c0 = N.viewCenter(cam, w, h);
  check('กล้องที่จุดเริ่ม: กึ่งกลางจอ = (400,300) ในพิกัดโลก', c0.x === 400 && c0.y === 300);
  const z = N.zoomAtCenter(cam, w, h, 2);
  const c1 = N.viewCenter(z, w, h);
  check('ซูม 2 เท่าแล้วกึ่งกลางยังเป็นจุดเดิม (เดิมค่าเปลี่ยนทั้งที่มองที่เดิม)',
        Math.abs(c1.x - c0.x) < 0.001 && Math.abs(c1.y - c0.y) < 0.001, `${c1.x},${c1.y}`);
  const z2 = N.zoomAtCenter(z, w, h, 0.5);
  check('ซูมออกก็ยังยึดที่เดิม', Math.abs(N.viewCenter(z2, w, h).x - c0.x) < 0.001);
  check('ซูมถูกหนีบไม่ให้หลุดขอบ',
        N.zoomAtCenter(cam, w, h, 999).scale === 8 && N.zoomAtCenter(cam, w, h, 0).scale === 0.05);
  check('กล้องเลื่อนแล้วกึ่งกลางเปลี่ยนตามจริง',
        N.viewCenter({ scale: 1, cx: -100, cy: 0 }, w, h).x === 500);
  check('ค่าพังไม่ทำให้ NaN', Number.isFinite(N.viewCenter(null, w, h).x));
}

// ═══════════ แกนบอกทิศ ═══════════
{
  const a2 = N.axisVectors(0.4, -0.3, false);
  check('2D: X ไปขวา Y ลงล่าง ไม่มีแกน Z', a2.x.x === 1 && a2.y.y === 1 && a2.z === null);
  const a3 = N.axisVectors(0.4, -0.3, true);
  check('3D: มีแกน Z ด้วย', !!a3.z);
  check('3D: แกนทั้งสามไม่ใช่ค่าเดียวกัน',
        JSON.stringify(a3.x) !== JSON.stringify(a3.y) && JSON.stringify(a3.y) !== JSON.stringify(a3.z));
  const a0 = N.axisVectors(0, 0, true);
  check('3D ที่มุมหมุน 0: ตรงกับ 2D ทุกแกน',
        Math.abs(a0.x.x - 1) < 1e-9 && Math.abs(a0.y.y - 1) < 1e-9 && Math.abs(a0.z.x) < 1e-9);
  check('ทุกค่าเป็นตัวเลขจริง',
        [a3.x.x, a3.x.y, a3.y.x, a3.y.y, a3.z.x, a3.z.y].every(Number.isFinite));
}

// ═══════════ กันหลุด: ตัววาดต้องไม่มีเลข hex ฝังไว้เองอีก ═══════════
{
  const src = fs.readFileSync(path.join(__dirname, '../src/network.js'), 'utf8');
  // ยกเว้นบรรทัดที่เป็นค่าสำรอง (FALLBACK) และสีโปร่งใสของเงา
  const lines = src.split('\n').filter((l) => /#[0-9a-fA-F]{6}/.test(l))
    .filter((l) => !/FALLBACK|fallback|rgba\(/.test(l));
  check('network.js ไม่มีสีฝังไว้ในโค้ดแล้ว (ทุกสีมาจาก network-theme.js)',
        lines.length === 0, lines.slice(0, 3).join(' || ').slice(0, 220));
}

console.log(`network-theme: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
