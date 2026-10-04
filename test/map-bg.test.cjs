// test/map-bg.test.cjs — [alpha.168] รูปพื้นหลังของแผนที่แก้ได้ (ขนาด · สัดส่วน · ความทึบ · หมุน · pitch · yaw · พลิก · เฉือน)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_mapbg.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/map-bg.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const B = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const qs = (q) => q.map((p) => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' | ');

// ── ค่าเริ่มต้น = ภาพเต็มกรอบพอดี (ไฟล์เก่าเปิดแล้วหน้าตาเหมือนเดิมทุกไบต์) ──
const q0 = B.bgQuad(null, 1.6, 1.6);
check('[bg] ไม่มีค่าตั้ง = มุมภาพตรงมุมกรอบพอดี', near(q0[0].x, 0) && near(q0[0].y, 0) && near(q0[2].x, 100) && near(q0[2].y, 100)
      && near(q0[1].x, 100) && near(q0[1].y, 0) && near(q0[3].x, 0) && near(q0[3].y, 100), qs(q0));
check('[bg] ค่าเริ่มต้น = isDefaultBg', B.isDefaultBg({}) && B.isDefaultBg(B.BG_DEFAULTS));
check('[bg] compactBg ของค่าเริ่มต้น = null (ไม่เขียนลงไฟล์)', B.compactBg({}) === null);
check('[bg] compactBg เก็บเฉพาะช่องที่เปลี่ยน', JSON.stringify(B.compactBg({ rotate: 30, flipH: true })) === '{"rotate":30,"flipH":true}');

// ── ค่าเสีย/เกินช่วง ──
const n = B.normalizeBg({ scale: 'x', opacity: 5, pitch: 200, flipV: 'yes', rotate: 0 });
check('[bg] ค่าเสีย = ค่าเริ่มต้น · เกินช่วง = ตัดเข้าช่วง · ธงต้องเป็น true จริง', n.scale === 1 && n.opacity === 1 && n.pitch === 75 && n.flipV === false && n.rotate === 0,
      JSON.stringify(n));
check('[bg] กฎ 20: ค่า 0 ไม่ถูกแทนด้วยค่าเริ่มต้น', B.normalizeBg({ opacity: 0 }).opacity === 0);

// ── ขนาด · ตำแหน่ง · สัดส่วน ──
const qs2 = B.bgQuad({ scale: 0.5 }, 2, 2);
check('[bg] ขนาด 0.5 = ครึ่งกรอบ อยู่กลาง', near(qs2[0].x, 25) && near(qs2[2].x, 75) && near(qs2[0].y, 25) && near(qs2[2].y, 75), qs(qs2));
const qm = B.bgQuad({ x: 70, y: 20 }, 1, 1);
check('[bg] ย้ายจุดกลาง = ทั้งภาพเลื่อนตาม', near((qm[0].x + qm[2].x) / 2, 70) && near((qm[0].y + qm[2].y) / 2, 20), qs(qm));
const qr = B.bgQuad({ ratio: 2 }, 1, 1);
check('[bg] ratio 2 = สูงขึ้นสองเท่า (กว้างเท่าเดิม)', near(qr[2].x - qr[0].x, 100) && near(qr[3].y - qr[0].y, 200), qs(qr));
const qa = B.bgQuad({}, 2, 1);
check('[bg] ภาพจัตุรัสบนกรอบ 2:1 = สูงสองเท่าของกรอบ (สัดส่วนจริงของภาพ ไม่ยืดตามกรอบ)', near(qa[3].y - qa[0].y, 200), qs(qa));

// ── หมุน: บนกรอบที่ไม่จัตุรัสต้องไม่บิด (ใช้หน่วยจริงภายใน) ──
const q90 = B.bgQuad({ rotate: 90 }, 2, 2);
// ภาพ 100×50 (หน่วยจริง) หมุน 90° → กว้าง 50 สูง 100 หน่วยจริง → ในกรอบ 2:1: x ช่วง 50 (%) · y ช่วง 100×2 = 200 (%)
const w90 = Math.max(...q90.map((p) => p.x)) - Math.min(...q90.map((p) => p.x));
const h90 = Math.max(...q90.map((p) => p.y)) - Math.min(...q90.map((p) => p.y));
check('[bg] หมุน 90° บนกรอบ 2:1 = ภาพตั้งตรงสัดส่วนเดิม (ไม่บิดเป็นสี่เหลี่ยมด้านขนาน)', near(w90, 50) && near(h90, 200), w90 + '×' + h90);

// ── พลิก: มุมบนซ้ายของเนื้อภาพไปอยู่ขวา ──
const qf = B.bgQuad({ flipH: true }, 1, 1);
check('[bg] พลิกแนวนอน = มุมบนซ้ายของเนื้อภาพอยู่ขวาบนของกรอบ', near(qf[0].x, 100) && near(qf[0].y, 0) && near(qf[1].x, 0), qs(qf));
const qv = B.bgQuad({ flipV: true }, 1, 1);
check('[bg] พลิกแนวตั้ง = มุมบนซ้ายของเนื้อภาพอยู่ล่างซ้าย', near(qv[0].x, 0) && near(qv[0].y, 100), qs(qv));

// ── เฉือน ──
const qk = B.bgQuad({ skewX: 45 }, 1, 1);
check('[bg] เฉือนแนวนอน 45° = ขอบบนเลื่อนซ้าย ขอบล่างเลื่อนขวา เท่ากัน', near(qk[0].x, -50) && near(qk[3].x, 50) && near(qk[0].y, 0), qs(qk));

// ── pitch / yaw = มุมมองระยะ (สี่เหลี่ยมคางหมู) ──
const qp = B.bgQuad({ pitch: 40 }, 1, 1);
const topW = qp[1].x - qp[0].x, botW = qp[2].x - qp[3].x;
check('[bg] pitch บวก = ขอบบนเอนห่าง (แคบกว่าขอบล่าง)', topW < botW && topW > 0, topW.toFixed(2) + ' < ' + botW.toFixed(2));
const qy = B.bgQuad({ yaw: 40 }, 1, 1);
const leftH = qy[3].y - qy[0].y, rightH = qy[2].y - qy[1].y;
check('[bg] yaw บวก = ขอบขวาเอนห่าง (เตี้ยกว่าขอบซ้าย)', rightH < leftH && rightH > 0, rightH.toFixed(2) + ' < ' + leftH.toFixed(2));
check('[bg] มีมุมมองระยะ = bgIsProjective', B.bgIsProjective({ yaw: 5 }) && !B.bgIsProjective({ rotate: 30, skewX: 10 }));
const qx = B.bgQuad({ pitch: 75, yaw: -75, scale: 3 }, 1, 1);
check('[bg] เอียงสุดสองแกน = มุมไม่ข้ามไปหลังกล้อง (ตัวเลขจำกัด)', qx.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), qs(qx));

// ── homography: มุมทั้งสี่ตรง · จุดกลางถูกฉายตามมุมมองระยะ ──
for (const bg of [{}, { rotate: 33, skewY: 12, flipH: true }, { pitch: 50, yaw: 20, scale: 0.7, ratio: 1.3 }]) {
  const q = B.bgQuad(bg, 1.5, 1.2);
  const H = B.unitToQuad(q);
  const c = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => B.applyH(H, u, v));
  check('[bg] homography ส่งมุมหน่วยไปตรงมุมภาพ ' + JSON.stringify(bg), c.every((p, i) => near(p.x, q[i].x, 1e-6) && near(p.y, q[i].y, 1e-6)));
}
{
  // ไม่มีมุมมองระยะ = affine (g=h=0) → จุดกลางภาพ = ค่าเฉลี่ยมุม
  const H = B.unitToQuad(B.bgQuad({ rotate: 20, skewX: 15 }, 1, 1));
  check('[bg] ไม่มี pitch/yaw = affine (g = h = 0)', near(H[6], 0, 1e-9) && near(H[7], 0, 1e-9));
}

// ── CSS matrix3d: ใช้มุมชุดเดียวกัน (จอ = ไฟล์) ──
{
  const m = B.bgCssMatrix({}, 2, 2, 1000, 1000, 500);
  check('[bg] ค่าเริ่มต้น = matrix3d เอกลักษณ์ (ภาพไม่ขยับจากเดิม)', m === 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', m);
  const bg = { pitch: 30, rotate: 15, x: 40 };
  const vals = B.bgCssMatrix(bg, 1.5, 1.5, 900, 900, 600).slice(9, -1).split(',').map(Number);
  // ฉายมุมล่างขวาของ <img> (900, 600) ด้วยเมทริกซ์ → ต้องตรงกับ bgQuad มุมที่ 3
  const X = 900, Y = 600;
  const w = vals[3] * X + vals[7] * Y + vals[15];
  const px = (vals[0] * X + vals[4] * Y + vals[12]) / w, py = (vals[1] * X + vals[5] * Y + vals[13]) / w;
  const q = B.bgQuad(bg, 1.5, 1.5)[2];
  check('[bg] matrix3d ส่งมุมล่างขวาของรูปไปตรง bgQuad (พิกเซลของกรอบ)', near(px, q.x / 100 * 900, 1e-4) && near(py, q.y / 100 * 600, 1e-4),
        px.toFixed(3) + ',' + py.toFixed(3) + ' vs ' + (q.x * 9).toFixed(3) + ',' + (q.y * 6).toFixed(3));
}

// ── ตาข่ายสำหรับส่งออก ──
{
  const tris = B.bgMeshCells({ yaw: 30 }, 1, 1, 8);
  check('[bg] ตาข่าย 8×8 = 128 สามเหลี่ยม', tris.length === 128, tris.length);
  const q = B.bgQuad({ yaw: 30 }, 1, 1);
  const first = tris[0][0], last = tris[tris.length - 1][1];
  check('[bg] ตาข่ายเริ่มที่มุมบนซ้าย และจบที่มุมล่างขวาของภาพ', near(first.x, q[0].x) && near(first.y, q[0].y) && near(last.x, q[2].x) && near(last.y, q[2].y));
  const bb = B.bgBounds({ scale: 2 }, 1, 1);
  check('[bg] bgBounds ครอบทั้งภาพ', near(bb.x0, -50) && near(bb.x1, 150) && near(bb.y0, -50) && near(bb.y1, 150), JSON.stringify(bb));
}

console.log(`map-bg: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
