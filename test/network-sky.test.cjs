// test/network-sky.test.cjs — [alpha.167] skybox ของ Story Network · ขั้วของการ์ดผังแตกสาย · ข้อมูลการ์ด Kanban
// ผู้ใช้: "Background แบบที่เป็นแผ่น ไม่ค่อย work มันต้องเป็นแบบ skybox" ·
//         "story network ควรเป็นแบบรูปที่ 1 · karban แบบรูปที่ 2 · story branch แนวรูปที่ 3"
require('./_lang.cjs').installLang('th');
const path = require('path');
const fs = require('fs');
const os = require('os');
const build = (name) => {
  const out = path.join(os.tmpdir(), '_sky_' + name.replace(/\W/g, '') + '.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + name)], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const K = build('network-sky.js');
const C = build('network-camera.js');
const S = build('network-scene.js');
const BG = build('branch-graph.js');
const KB = build('kanban/kanban-core.js');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const len = (v) => Math.hypot(v.x, v.y, v.z);

// ═══════════ ทิศทางของพิกเซล ═══════════
{
  const W = 1200, H = 700;
  const d0 = K.skyDir(W / 2, H / 2, W, H, { rx: 0, ry: 0 });
  check('กลางจอ มุม 0 = มองไปทาง +z ของโลก', near(d0.x, 0) && near(d0.y, 0) && near(d0.z, 1));
  for (const rot of [{ rx: 0, ry: 0 }, { rx: -0.5, ry: -0.3 }, { rx: 1.1, ry: 2.4 }]) {
    for (const [X, Y] of [[0, 0], [W, H], [300, 520]]) {
      const d = K.skyDir(X, Y, W, H, rot);
      check(`ทิศทางเป็นเวกเตอร์หนึ่งหน่วย (${rot.rx},${rot.ry} · ${X},${Y})`, near(len(d), 1, 1e-9));
      const p = K.skyProject(d, W, H, rot);
      check(`ฉายกลับได้พิกเซลเดิม (${rot.rx},${rot.ry} · ${X},${Y})`, !!p && near(p.x, X, 1e-6) && near(p.y, Y, 1e-6), JSON.stringify(p));
    }
  }
  // skybox = ไม่เลื่อนตามแพน/ซูม: ฟังก์ชันไม่รับกล้อง (tx,ty,scale) เลย — มีแค่มุม
  check('skyDir ไม่ขึ้นกับตำแหน่ง/ซูมของกล้อง (รับเฉพาะมุม)', K.skyDir.length === 6);
  // หมุนกล้อง → ทิศเดียวกันในโลกย้ายไปที่อื่นบนจอ (ฟ้าหมุนตาม)
  const star = K.skyDir(600, 350, W, H, { rx: 0, ry: 0 });
  const moved = K.skyProject(star, W, H, { rx: 0, ry: 0.3 });
  check('หมุนกล้อง (ry) → ดาวดวงเดิมเลื่อนบนจอ', !!moved && Math.abs(moved.x - 600) > 50, JSON.stringify(moved));
  const behind = K.skyProject({ x: 0, y: 0, z: -1 }, W, H, { rx: 0, ry: 0 });
  check('ทิศข้างหลังกล้อง = ไม่วาด (null)', behind === null);
  check('ระยะโฟกัสของฟ้าคงที่ตามขนาดจอ ไม่ขึ้นกับซูม', K.skyFocal(1000, 600) === 900 && K.skyFocal(600, 1000) === 900);
}

// ═══════════ พาโนรามา 360° ═══════════
{
  const up = K.equirectUV({ x: 0, y: -1, z: 0 });
  check('ทิศบน (−y) = แถวบนสุดของพาโนรามา', near(up.v, 0));
  const down = K.equirectUV({ x: 0, y: 1, z: 0 });
  check('ทิศล่าง = แถวล่างสุด', near(down.v, 1));
  const fwd = K.equirectUV({ x: 0, y: 0, z: 1 });
  check('ข้างหน้า (+z) = กลางภาพ', near(fwd.u, 0.5) && near(fwd.v, 0.5));
  const right = K.equirectUV({ x: 1, y: 0, z: 0 });
  check('ขวา (+x) = สามในสี่ของความกว้าง', near(right.u, 0.75));
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const a = i * 0.7, b = Math.sin(i) * 1.5;
    const d = { x: Math.cos(b) * Math.sin(a), y: Math.sin(b) * 0.99, z: Math.cos(b) * Math.cos(a) };
    const L = len(d); d.x /= L; d.y /= L; d.z /= L;
    const uv = K.equirectUV(d);
    if (!(uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1)) ok = false;
  }
  check('พิกัดพาโนรามาอยู่ในช่วง 0..1 ทุกทิศ', ok);
}

// ═══════════ ดาว · เนบิวลา · โดม ═══════════
{
  const a = K.skyStars(1), b = K.skyStars(1);
  check('ดาวบนทรงกลมคงที่ (สุ่มแบบกำหนดผลได้ — ไม่กะพริบ)', JSON.stringify(a.slice(0, 20)) === JSON.stringify(b.slice(0, 20)));
  check('ดาวทุกดวงเป็นทิศหนึ่งหน่วย', a.every((s) => near(len(s), 1, 1e-9)));
  check('ความหนาแน่น 0 = ไม่มีดาว', K.skyStars(0).length === 0);
  check('ความหนาแน่นมากขึ้น = ดาวมากขึ้น', K.skyStars(2).length > a.length);
  check('ดาวกระจายทั่วทรงกลม (มีทั้งซีกบนและซีกล่าง)', a.some((s) => s.y > 0.5) && a.some((s) => s.y < -0.5));
  const scene = S.normalizeNetScene({ bg: { kind: 'space' } });
  const sh = K.domeShader(scene.bg, '#1e1250');
  const c1 = sh({ x: 0, y: 0, z: 1 });
  check('โดมคืนสี RGB ครบสามช่องในช่วง 0..255', c1.length === 3 && c1.every((v) => v >= 0 && v <= 255.0001), JSON.stringify(c1));
  let differs = false;
  const ref = JSON.stringify(sh({ x: 1, y: 0, z: 0 }).map(Math.round));
  for (const blob of K.nebulaBlobs(5)) if (JSON.stringify(sh(blob).map(Math.round)) !== ref) differs = true;
  check('อวกาศมีเนบิวลา (ทิศต่าง ๆ ได้สีต่างกัน ไม่ใช่สีเรียบ)', differs);
  for (const kind of ['theme', 'solid', 'gradient', 'blueprint', 'wargame', 'parchment', 'image']) {
    const sc = S.normalizeNetScene(S.withBgKind({}, kind));
    const f = K.domeShader(sc.bg, '#1e1250');
    const col = f({ x: 0, y: -0.6, z: 0.8 });
    check(`โดมของ "${kind}" ให้สีได้ไม่พัง`, Array.isArray(col) && col.every(Number.isFinite), JSON.stringify(col));
  }
  const grad = K.domeShader(S.normalizeNetScene(S.withBgKind({}, 'gradient')).bg, '#000000');
  const top = grad({ x: 0, y: -1, z: 0 }), bot = grad({ x: 0, y: 1, z: 0 });
  check('ไล่สี: ฟ้าบน ≠ ใต้เท้า (ก้ม/เงยแล้วเห็นว่าหมุน)', JSON.stringify(top) !== JSON.stringify(bot));
}

// ═══════════ ค่าตั้ง: skybox เป็นค่าเริ่มต้น · ย้อนเป็นแผ่นได้ ═══════════
{
  check('ค่าเริ่มต้นของโหมด 3D = skybox', S.normalizeNetScene({}).bg.sky3d === 'sky');
  check('เลือก "แผ่นบนพื้น" แบบเดิมได้', S.normalizeNetScene({ bg: { sky3d: 'plane' } }).bg.sky3d === 'plane');
  check('ค่าเสีย = skybox', S.normalizeNetScene({ bg: { sky3d: 'xx' } }).bg.sky3d === 'sky');
  check('เปลี่ยนชนิดฉากหลังแล้วยังจำตัวเลือก 3D ของผู้ใช้', S.withBgKind({ bg: { sky3d: 'plane' } }, 'space').bg.sky3d === 'plane');
}

// ═══════════ ผังแตกสาย: ขั้วของแต่ละแถวทางเลือก ═══════════
{
  check('ขั้วเข้าอยู่ในแถบหัวการ์ด', BG.PORT_IN_Y > 0 && BG.PORT_IN_Y < BG.CHOICE_Y0);
  const ys = [0, 1, 2].map((i) => BG.choicePortY(i, 3));
  check('สามทางเลือก = สามขั้วเรียงลงล่าง ห่างเท่ากัน', ys[1] - ys[0] === BG.CHOICE_ROW_H && ys[2] - ys[1] === BG.CHOICE_ROW_H, ys.join());
  check('ขั้วทุกอันอยู่ในการ์ด', [0, 1, 2, 3, 9].every((i) => { const y = BG.choicePortY(i, 10); return y > BG.CHOICE_Y0 && y < BG.NODE_H; }));
  check('ทางเลือกที่ล้น (+N) ออกจากแถวสุดท้าย', BG.choicePortY(7, 10) === BG.choicePortY(BG.CHOICE_ROWS - 1, 10));
  check('ไม่มีทางเลือก = กลางการ์ด (ไม่ throw)', BG.choicePortY(0, 0) === BG.NODE_H / 2);
  check('แถวที่วาดได้ครบพอดีความสูงการ์ด', BG.CHOICE_Y0 + BG.CHOICE_ROWS * BG.CHOICE_ROW_H <= BG.NODE_H);
}

// ═══════════ Kanban: การ์ดพกข้อมูลที่หน้าตาใหม่ใช้ ═══════════
{
  const cards = KB.cardsOf({ chapters: { c1: [
    { id: 'a', title: 'ก', wordCount: 1200, flag: true, tags: ['ปม'], synopsis: 'ย่อ', pov: 'โทระ' },
    { id: 'b', title: 'ข', wordCount: 'x' },
  ] } });
  check('การ์ดมีจำนวนคำ (แถบความยาว)', cards[0].words === 1200);
  check('จำนวนคำเสีย = 0 (ไม่ใช่ NaN)', cards[1].words === 0);
  check('การ์ดพกธง/แท็ก/เรื่องย่อ/ผู้เล่า', cards[0].flag === true && cards[0].tags[0] === 'ปม' && cards[0].synopsis === 'ย่อ' && cards[0].pov === 'โทระ');
}

// ═══════════ ซอร์ส: ทางเข้าของ skybox ต่อครบ ═══════════
{
  const bg = fs.readFileSync(path.join(__dirname, '../src/network-bg.js'), 'utf8');
  const net = fs.readFileSync(path.join(__dirname, '../src/network.js'), 'utf8');
  const insp = fs.readFileSync(path.join(__dirname, '../src/network-inspector.js'), 'utf8');
  check('ตัววาดฉากหลังเรียก drawSky', /drawSky\(/.test(bg));
  check('ผังส่งค่า sky (0..1) ตามโหมด 3D', /sky\}/.test(net) && /_standK\(\)/.test(net));
  check('แผงฉากหลังมีตัวเลือก skybox/แผ่น', /ui\.netScene\.sky3d/.test(insp));
  check('รูปฉากหลังโหลดผ่าน blob: (อ่านพิกเซล/ส่งออก PNG ได้)', /createObjectURL/.test(net) && /revokeObjectURL/.test(net));
}

console.log(`network-sky: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
