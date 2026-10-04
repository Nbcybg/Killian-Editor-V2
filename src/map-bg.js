// map-bg.js — [alpha.168] รูปพื้นหลังของแผนที่ = "ของตกแต่ง" ที่แก้ได้ (บริสุทธิ์ 100% · ไม่แตะ DOM)
//
// ผู้ใช้: "แผนที่ รูปอยู่เป็นแค่ decorate ถูกแล้ว แต่มันไม่สามารถแก้ไขได้ · อยากให้แก้ไขรูปได้
//          ทั้ง ขนาด ratio ความทึบ จาง หมุน pitch yaw Hflip Vflip skew"
//
// หลักการ: **กรอบอ้างอิงของแผนที่ไม่ขยับ** (หมุด · โซน · กริด · พิกัดจริง คิดเป็น % ของกรอบเหมือนเดิม)
//   ขยับได้เฉพาะ "ภาพ" — ค่าตั้งทั้งหมดถูกแปลงเป็น **มุมทั้งสี่ของภาพ** ในพิกัดของกรอบ (bgQuad) ที่เดียว
//   แล้วทุกทางวาดใช้มุมชุดนี้: จอ = CSS matrix3d (bgCssMatrix) · ไฟล์ PNG = วาดแบบตาข่าย (bgMeshCells)
//   → จอกับไฟล์ที่ส่งออกตรงกันโดยโครงสร้าง ไม่ใช่สูตรสองชุดที่ต้องคอยให้ตรงกัน
//
// หน่วย: x,y ของผลลัพธ์ = % ของกรอบ (x% ของความกว้าง · y% ของความสูง) — หน่วยเดียวกับหมุด
//   ภายในคิดเป็น "หน่วยจริง" (กรอบกว้าง 100 · สูง 100 / สัดส่วนกรอบ) เพื่อให้การหมุด/เอียงไม่บิดตามสัดส่วนกรอบ
import { num } from './num.js';

/** ค่าเริ่มต้น = ภาพเต็มกรอบพอดี (เหมือนก่อนมีฟีเจอร์นี้ทุกไบต์) */
export const BG_DEFAULTS = Object.freeze({
  x: 50, y: 50,          // จุดกลางภาพ (% ของกรอบ)
  scale: 1,              // 1 = กว้างเท่ากรอบ
  ratio: 1,              // ยืด/หดแกนตั้งเทียบกับสัดส่วนเดิมของภาพ (1 = สัดส่วนจริง)
  opacity: 1,            // 0–1
  rotate: 0,             // องศา (หมุนบนระนาบ)
  pitch: 0, yaw: 0,      // องศา (เอียงหน้า-หลัง / ซ้าย-ขวา แบบมีมุมมองระยะ)
  skewX: 0, skewY: 0,    // องศา
  flipH: false, flipV: false,
});

/** ช่วงที่รับได้ — ตัวเลื่อนในกล่องแก้รูปอ่านจากตารางนี้ (แหล่งเดียว) */
export const BG_LIMITS = Object.freeze({
  scale: [0.05, 20], ratio: [0.2, 5], opacity: [0, 1],
  rotate: [-180, 180], pitch: [-75, 75], yaw: [-75, 75],
  skewX: [-60, 60], skewY: [-60, 60],
  x: [-10000, 10100], y: [-10000, 10100],
});

const clampTo = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/** อ่านค่าจากไฟล์ (ของเก่าไม่มี = ค่าเริ่มต้น · ค่าเสีย/เกินช่วง = ตัดเข้าช่วง) */
export function normalizeBg(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const k of Object.keys(BG_DEFAULTS)) {
    const d = BG_DEFAULTS[k];
    if (typeof d === 'boolean') out[k] = r[k] === true;
    else out[k] = BG_LIMITS[k] ? clampTo(num(r[k], d), BG_LIMITS[k]) : num(r[k], d);
  }
  return out;
}

/** ค่าเหมือนค่าเริ่มต้นทุกช่อง = ไม่ต้องบันทึก/ไม่ต้องแปลง */
export function isDefaultBg(bg) {
  const b = normalizeBg(bg);
  return Object.keys(BG_DEFAULTS).every((k) => (typeof BG_DEFAULTS[k] === 'boolean'
    ? b[k] === BG_DEFAULTS[k] : Math.abs(b[k] - BG_DEFAULTS[k]) < 1e-9));
}

/** เก็บเฉพาะช่องที่ต่างจากค่าเริ่มต้น (ไฟล์สั้น · อ่านออกด้วยตา) · ไม่มีอะไรต่าง = null */
export function compactBg(bg) {
  const b = normalizeBg(bg);
  const out = {};
  for (const k of Object.keys(BG_DEFAULTS)) {
    const d = BG_DEFAULTS[k];
    if (typeof d === 'boolean' ? b[k] !== d : Math.abs(b[k] - d) > 1e-9) out[k] = typeof d === 'boolean' ? b[k] : +b[k].toFixed(4);
  }
  return Object.keys(out).length ? out : null;
}

const RAD = Math.PI / 180;

/**
 * มุมทั้งสี่ของภาพในพิกัดของกรอบ (% ของกรอบ) — ลำดับ = มุมของ "เนื้อภาพ": บนซ้าย · บนขวา · ล่างขวา · ล่างซ้าย
 * (พลิกภาพ = มุมบนซ้ายของเนื้อภาพไปอยู่ขวา — ตัววาดจับมุมตามลำดับนี้ จึงได้ภาพกลับด้านเอง)
 * @param bg ค่าตั้ง (normalizeBg แล้วหรือยังก็ได้)
 * @param frameAspect กว้าง/สูง ของกรอบอ้างอิง
 * @param imgAspect กว้าง/สูง ของไฟล์รูป (ไม่รู้ = เท่ากรอบ)
 */
export function bgQuad(bg, frameAspect, imgAspect) {
  const b = normalizeBg(bg);
  const fa = frameAspect > 0 ? frameAspect : 1;
  const ia = imgAspect > 0 ? imgAspect : fa;
  const w = 100 * b.scale;
  const h = (100 / ia) * b.scale * b.ratio;
  const d = 2.2 * Math.max(w, h);                 // ระยะกล้องของมุมมองระยะ — ไกลพอที่มุมไม่ข้ามไปหลังกล้อง
  const tx = Math.tan(b.skewX * RAD), ty = Math.tan(b.skewY * RAD);
  const cp = Math.cos(b.pitch * RAD), sp = Math.sin(b.pitch * RAD);
  const cyw = Math.cos(b.yaw * RAD), syw = Math.sin(b.yaw * RAD);
  const cr = Math.cos(b.rotate * RAD), sr = Math.sin(b.rotate * RAD);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return corners.map(([sx, sy]) => {
    let x = sx * w / 2, y = sy * h / 2;
    if (b.flipH) x = -x;
    if (b.flipV) y = -y;
    // เฉือน
    const x1 = x + tx * y, y1 = y + ty * x;
    // เอียงหน้า-หลัง (รอบแกนนอน) · บวก = ขอบบนเอนออกห่าง
    const y2 = y1 * cp, z2 = -y1 * sp;
    // เอียงซ้าย-ขวา (รอบแกนตั้ง) · บวก = ขอบขวาเอนออกห่าง
    const x3 = x1 * cyw - z2 * syw, z3 = x1 * syw + z2 * cyw;
    // มุมมองระยะ (z บวก = ห่างออกไป = เล็กลง)
    const k = d / (d + z3);
    const px = x3 * k, py = y2 * k;
    // หมุนบนระนาบจอ
    const rx = px * cr - py * sr, ry = px * sr + py * cr;
    return { x: rx + b.x, y: ry * fa + b.y };
  });
}

/**
 * homography ของสี่เหลี่ยมจัตุรัสหน่วย (0,0)(1,0)(1,1)(0,1) → สี่มุม q (Heckbert)
 * คืน [a,b,c,d,e,f,g,h]: X = (a u + b v + c) / (g u + h v + 1) · Y = (d u + e v + f) / (g u + h v + 1)
 */
export function unitToQuad(q) {
  const [p0, p1, p2, p3] = q;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) > 1e-12) {
      g = (sx * dy2 - dx2 * sy) / den;
      h = (dx1 * sy - sx * dy1) / den;
    }
  }
  return [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y,
    g, h,
  ];
}

/** จุด (u,v) ในภาพ (0–1) → จุดบนกรอบ ตาม homography */
export function applyH(H, u, v) {
  const [a, b, c, d, e, f, g, h] = H;
  const w = g * u + h * v + 1;
  return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
}

/**
 * CSS `matrix3d(...)` ของ <img> ที่วางมุมซ้ายบนของกรอบ (transform-origin 0 0) ขนาด elW × elH พิกเซล
 * ให้เนื้อภาพไปตกที่สี่มุมของ bgQuad บนกรอบกว้าง boxW พิกเซล
 */
export function bgCssMatrix(bg, frameAspect, imgAspect, boxW, elW, elH) {
  const fa = frameAspect > 0 ? frameAspect : 1;
  const boxH = boxW / fa;
  const q = bgQuad(bg, fa, imgAspect).map((p) => ({ x: (p.x / 100) * boxW, y: (p.y / 100) * boxH }));
  const [a, b, c, d, e, f, g, h] = unitToQuad(q);
  const W = elW > 0 ? elW : 1, Hh = elH > 0 ? elH : 1;
  const m = [a / W, d / W, 0, g / W, b / Hh, e / Hh, 0, h / Hh, 0, 0, 1, 0, c, f, 0, 1];
  return 'matrix3d(' + m.map((v) => (Math.abs(v) < 1e-12 ? 0 : +v.toPrecision(10))).join(',') + ')';
}

/** กรอบที่ภาพกินพื้นที่ (% ของกรอบ) — ใช้ตอน "พอดีทุกอย่าง" และตอนส่งออกให้ครอบทั้งภาพ */
export function bgBounds(bg, frameAspect, imgAspect) {
  const q = bgQuad(bg, frameAspect, imgAspect);
  const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/**
 * แบ่งภาพเป็นตาข่าย n×n แล้วคืนสามเหลี่ยมคู่ (ต้นทางเป็นพิกัด 0–1 ของภาพ · ปลายทางเป็น % ของกรอบ)
 * ตัววาดบนผืน 2D วาดแต่ละสามเหลี่ยมแบบ affine — ละเอียดพอ = มุมมองระยะ (pitch/yaw) ดูเรียบ
 */
export function bgMeshCells(bg, frameAspect, imgAspect, n = 16) {
  const H = unitToQuad(bgQuad(bg, frameAspect, imgAspect));
  const N = Math.max(1, Math.min(64, Math.round(n)));
  const pt = (i, j) => ({ u: i / N, v: j / N, ...applyH(H, i / N, j / N) });
  const tris = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      tris.push([a, b, c], [a, c, d]);
    }
  }
  return tris;
}

/** ต้องแบ่งตาข่ายไหม (มีมุมมองระยะ) — ไม่มี = วาดครั้งเดียวด้วย affine ก็พอ */
export function bgIsProjective(bg) {
  const b = normalizeBg(bg);
  return Math.abs(b.pitch) > 1e-9 || Math.abs(b.yaw) > 1e-9;
}
