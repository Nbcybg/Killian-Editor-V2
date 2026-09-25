// network-camera.js — [alpha.166] กล้องของ Story Network (บริสุทธิ์ 100% · unit `network-camera`)
//
// ผู้ใช้: *"story network ที่มี bug ตอนสลับเป็น 2d 3d แล้ว กล้องไม่อิงค่า หรือไม่ sync อะไรเลย"*
//
// ต้นตอ (อ่านจากโค้ดเดิม):
//   · กล้องเก็บเป็น "ระยะเลื่อนบนจอ" (_cx/_cy พิกเซล) ส่วน 3D หมุนรอบจุด (0,0,0) ของโลก
//     → หมุนแล้วผังเหวี่ยงออกนอกจอ (ไม่ได้หมุนรอบสิ่งที่กำลังดู) · สลับ 2D↔3D ภาพกระโดดไปคนละที่
//   · ค่า X/Y/Z บนแถบสถานะ: Z = ค่าเฉลี่ยความลึกของทุกโหนด ไม่ใช่ค่าของกล้อง · มินิแมปใช้ x/y ดิบตอนเป็น 3D
//   · ลากโหนดตอน 3D = เอาพิกัดจอไปใส่ x/y ของโลกตรง ๆ (โหนดวิ่งผิดทิศเมื่อหมุนกล้อง)
//
// โมเดลใหม่: กล้องมี **จุดโฟกัสในพิกัดโลก** T = (tx,ty,tz) + สเกล + มุมหมุน (rx,ry)
//   จอ = กึ่งกลางผืนวาด + สเกล × R(p − T)       (R = หมุนรอบแกน Y แล้วรอบแกน X · 2D = R เป็นเอกลักษณ์)
//   → 2D คือ 3D ที่มุมเป็นศูนย์ · สลับโหมด = หมุนมุมไปหา 0 (หรือกลับ) โดย T อยู่กลางจอตลอด
//   → หมุนรอบ T เสมอ · ค่าบนแถบสถานะ = T ตรง ๆ · แพน = เลื่อน T ตามแกนของจอ

/** หมุนเวกเตอร์ของโลกเข้าแกนจอ — x,y ตรงกับสูตร project3D เดิมทุกประการ · z = ความลึก (มาก = ไกล) */
export function rot3(p, rx, ry) {
  const x = +p.x || 0, y = +p.y || 0, z = +p.z || 0;
  const cx = Math.cos(rx || 0), sx = Math.sin(rx || 0);
  const cy = Math.cos(ry || 0), sy = Math.sin(ry || 0);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return { x: x1, y: y * cx - z1 * sx, z: y * sx + z1 * cx };
}

/** ย้อน rot3 — เวกเตอร์ในแกนจอ → แกนโลก */
export function unrot3(v, rx, ry) {
  const X = +v.x || 0, Y = +v.y || 0, Z = +v.z || 0;
  const cx = Math.cos(rx || 0), sx = Math.sin(rx || 0);
  const cy = Math.cos(ry || 0), sy = Math.sin(ry || 0);
  const y = Y * cx + Z * sx;
  const z1 = -Y * sx + Z * cx;
  return { x: X * cy - z1 * sy, y, z: X * sy + z1 * cy };
}

// [รอบ 2] rx ติดลบ = มองโต๊ะจากด้านบนเฉียง ๆ (ขอบบนของจอ = ไกล) — เดิม +0.4 = มองจากใต้โต๊ะ
// พอมีมุมมองระยะแล้วเห็นชัดว่ากลับหัว (ของด้านบนจอใหญ่กว่าด้านล่าง)
export const CAM_DEFAULT_ANGLES = { rx: -0.5, ry: -0.3 };
export const SCALE_MIN = 0.05, SCALE_MAX = 8;
const RX_LIMIT = Math.PI / 2.2;

export function clampScale(s) {
  const v = Number(s);
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Number.isFinite(v) && v > 0 ? v : 1));
}
export function clampRx(rx) {
  const v = Number(rx);
  return Math.max(-RX_LIMIT, Math.min(RX_LIMIT, Number.isFinite(v) ? v : 0));
}

/** กล้องจากค่าที่บันทึกไว้ (ค่าเสีย = ค่าเริ่มต้น) */
export function normalizeCam(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const n = (v, d) => (Number.isFinite(+v) ? +v : d);
  return {
    tx: n(s.tx, 0), ty: n(s.ty, 0), tz: n(s.tz, 0),
    scale: clampScale(s.scale),
    // [รอบ 2] กล้องที่บันทึกก่อนรุ่นนี้ (ไม่มี v) ใช้มุมบวก = มองจากใต้โต๊ะ → พลิกเป็นมองจากด้านบนครั้งเดียว
    rx: clampRx(Number.isFinite(+s.rx) ? (s.v >= 2 ? +s.rx : -Math.abs(+s.rx)) : CAM_DEFAULT_ANGLES.rx),
    ry: n(s.ry, CAM_DEFAULT_ANGLES.ry),
    mode3D: !!s.mode3D,
    // [รอบ 2] มุมมองระยะในโหมด 3D (ค่าเริ่มต้นเปิด — ของไกลเล็กลง) · 2D ไม่มีผลเลย
    persp: s.persp !== false,
    v: 2,
  };
}

/** ระยะเลื่อนของผืนวาด (พิกเซล) ที่ทำให้ T อยู่กลางจอ — ตัววาดใช้ `translate(cx,cy) · scale(s)` แล้ววาดที่ R(p) */
export function camOffset(cam, w, h, rot) {
  const r = rot || cam;
  const t = rot3({ x: cam.tx, y: cam.ty, z: cam.tz }, r.rx, r.ry);
  const s = clampScale(cam.scale);
  return { cx: w / 2 - s * t.x, cy: h / 2 - s * t.y };
}

/** แพนด้วยพิกเซลบนจอ (ลากไปขวา = ภาพไปขวา = T ถอยไปซ้าย) · คืนกล้องใหม่ */
export function panCam(cam, dx, dy, rot) {
  const r = rot || cam;
  const s = clampScale(cam.scale);
  const d = unrot3({ x: dx / s, y: dy / s, z: 0 }, r.rx, r.ry);
  return { ...cam, tx: cam.tx - d.x, ty: cam.ty - d.y, tz: cam.tz - d.z };
}

/** ระยะลากบนจอ → ระยะในโลก บนระนาบที่หันหน้าเข้าหากล้อง (ลากโหนดตอน 3D) */
export function screenDeltaToWorld(cam, dx, dy, rot) {
  const r = rot || cam;
  const s = clampScale(cam.scale);
  return unrot3({ x: dx / s, y: dy / s, z: 0 }, r.rx, r.ry);
}

/** พิกัดบนจอ (สัมพัทธ์กับมุมซ้ายบนของผืนวาด) ของจุดในโลก */
export function worldToScreen(cam, p, w, h, rot) {
  const r = rot || cam;
  const o = camOffset(cam, w, h, r);
  const q = rot3(p, r.rx, r.ry);
  const s = clampScale(cam.scale);
  return { x: o.cx + q.x * s, y: o.cy + q.y * s, depth: q.z };
}

/**
 * จัดกล้องให้เห็นทุกจุด — คืน {tx,ty,tz,scale} (มุมไม่เปลี่ยน)
 * จุดกึ่งกลางกรอบ (ในแกนจอ) + ความลึกเฉลี่ย ย้อนกลับเป็นพิกัดโลก = จุดโฟกัสที่หมุนรอบแล้วผังไม่หลุดจอ
 */
export function fitCam(points, w, h, rot, { pad = 90, maxScale = 1.4, minScale = 0.15 } = {}) {
  const r = rot || { rx: 0, ry: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zs = 0, n = 0;
  for (const p of points || []) {
    const q = rot3(p, r.rx, r.ry);
    if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    zs += q.z; n++;
  }
  if (!n || !w || !h) return null;
  const s = Math.max(minScale, Math.min(maxScale,
    (w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, y1 - y0)));
  const t = unrot3({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: zs / n }, r.rx, r.ry);
  return { tx: t.x, ty: t.y, tz: t.z, scale: s };
}

/**
 * ความลึกของ "สิ่งที่กำลังดูอยู่" — ใช้ตอนเข้าโหมด 3D: ตั้ง tz ให้เท่าความลึกเฉลี่ยของจุดที่อยู่ในจอ
 * (2D มองไม่เห็นแกน z · ถ้าไม่ตั้ง จุดหมุนจะอยู่ลึกคนละระดับกับกลุ่มที่ดูอยู่ แล้วหมุนทีกลุ่มก็เหวี่ยงหลุดจอ)
 */
export function viewDepth(points, cam, w, h, rot) {
  const r = rot || cam;
  let zs = 0, n = 0, all = 0, allN = 0;
  for (const p of points || []) {
    const sp = worldToScreen(cam, p, w, h, r);
    const wz = +p.z || 0;
    all += wz; allN++;
    if (sp.x >= 0 && sp.x <= w && sp.y >= 0 && sp.y <= h) { zs += wz; n++; }
  }
  if (n) return zs / n;
  return allN ? all / allN : (+cam.tz || 0);
}

/** มุมสั้นที่สุดระหว่าง a → b (กันหมุนอ้อมโลก 350° ตอนสลับโหมด) */
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
/** ช้า-เร็ว-ช้า */
export function ease(t) { const x = Math.max(0, Math.min(1, t)); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

/** กล้องระหว่าง a → b ที่เวลา t (0..1) — ใช้ทั้งสลับ 2D/3D และบินไปหาโหนด */
export function lerpCam(a, b, t) {
  const k = ease(t);
  const L = (x, y) => x + (y - x) * k;
  // สเกลไล่แบบเรขาคณิต (ซูมเข้า/ออกดูเร็วเท่ากันทั้งสองทิศ)
  const sa = clampScale(a.scale), sb = clampScale(b.scale);
  return {
    ...b,
    tx: L(a.tx, b.tx), ty: L(a.ty, b.ty), tz: L(a.tz, b.tz),
    scale: sa * Math.pow(sb / sa, k),
    rx: lerpAngle(a.rx, b.rx, k), ry: lerpAngle(a.ry, b.ry, k),
  };
}

/** ข้อมูลที่เก็บลงดิสก์/localStorage (ปัดเศษ — ไม่งั้นไฟล์บวมด้วยทศนิยม 17 หลัก) */
export function serializeCam(cam) {
  const c = normalizeCam(cam);
  const r = (v, d = 1) => Math.round(v * d) / d;
  return { tx: r(c.tx), ty: r(c.ty), tz: r(c.tz), scale: r(c.scale, 1000),
           rx: r(c.rx, 1000), ry: r(c.ry, 1000), mode3D: c.mode3D, persp: c.persp, v: 2 };
}

// ═══════════════════ [alpha.166 · รอบ 2] มุมมองระยะ (perspective) ═══════════════════
// ผู้ใช้ขอให้ 3D "ดูเป็นอวกาศ/โต๊ะเกมสงคราม" — แบบขนาน (orthographic) ของเดิมทำให้ของไกลกับของใกล้ขนาดเท่ากัน
// สูตร: ย่อ/ขยายรอบจุดโฟกัสตามความลึกเทียบกับจุดโฟกัส  f = F / (F + Δz·k)
//   · จุดโฟกัส (Δz = 0) ไม่ขยับเลย → กฎ "จุดโฟกัสอยู่กลางจอเสมอ" ยังจริง · k = 0 = แบบขนานเดิมทุกพิกเซล
//   · ของที่อยู่หลังกล้อง (ตัวหาร < 0.2F) = ไม่วาด (behind)

/** ระยะโฟกัส (หน่วยโลก) — ผังจริงกว้าง ~±600 หน่วย: ของที่ลึกกว่า 450 หน่วยเหลือ ~2/3 */
export const FOCAL = 900;

/**
 * ตัวฉายของเฟรมหนึ่ง — ทุกคน (วาดโหนด · วาดพื้น · คลิก · ลาก) ต้องใช้ตัวเดียวกัน
 * @param {{tx,ty,tz,scale}} cam
 * @param {{rx:number, ry:number}} rot  มุมที่ใช้จริงเฟรมนี้
 * @param {number} persp  ความแรงของมุมมองระยะ 0..1
 */
export function makeProjector(cam, w, h, rot, persp = 0) {
  const s = clampScale(cam.scale);
  const r = rot || { rx: 0, ry: 0 };
  const T = rot3({ x: cam.tx, y: cam.ty, z: cam.tz }, r.rx, r.ry);
  const cx = w / 2, cy = h / 2;
  const k = Math.max(0, Math.min(1, Number(persp) || 0));
  const F = FOCAL;
  const fOf = (dz) => { if (!k) return 1; const den = F + dz * k; return den < F * 0.2 ? 0 : Math.min(3, F / den); };
  /** จุดในโลก → แกนจอก่อนคูณสเกล (ตัววาดใช้กับ translate(offset)·scale(s)) + ตัวคูณขนาด f */
  function view(p) {
    const q = rot3(p, r.rx, r.ry);
    const f = fOf(q.z - T.z);
    return { x: T.x + (q.x - T.x) * f, y: T.y + (q.y - T.y) * f, z: q.z, f: f || 1, behind: f === 0 };
  }
  /** จุดในโลก → พิกเซลบนผืนวาด */
  function proj(p) {
    const v = view(p);
    return { x: cx + (v.x - T.x) * s, y: cy + (v.y - T.y) * s, z: v.z, f: v.f, behind: v.behind };
  }
  const ex = rot3({ x: 1, y: 0, z: 0 }, r.rx, r.ry), ey = rot3({ x: 0, y: 1, z: 0 }, r.rx, r.ry);
  /**
   * พิกเซลบนผืนวาด → จุด (u,v) บนระนาบ z = 0 ของโลก (null = มองไม่เห็นระนาบตรงนั้น — เหนือขอบฟ้า/สันขอบ)
   * แก้สมการเชิงเส้นสองตัวแปร: d·(F + k·a.z) = F·a.xy โดย a = u·ex + v·ey − T
   */
  function planeAt(X, Y) {
    const dx = (X - cx) / s, dy = (Y - cy) / s;
    const kk = k || 0, FF = kk ? F : 1;
    const a11 = FF * ex.x - dx * kk * ex.z, a12 = FF * ey.x - dx * kk * ey.z;
    const a21 = FF * ex.y - dy * kk * ex.z, a22 = FF * ey.y - dy * kk * ey.z;
    const b1 = (kk ? dx * F - dx * kk * T.z : dx) + FF * T.x;
    const b2 = (kk ? dy * F - dy * kk * T.z : dy) + FF * T.y;
    const det = a11 * a22 - a12 * a21;
    if (Math.abs(det) < 1e-9 * FF * FF) return null;
    const u = (b1 * a22 - a12 * b2) / det, v = (a11 * b2 - a21 * b1) / det;
    if (kk) { const az = u * ex.z + v * ey.z - T.z; if (F + az * kk < F * 0.2) return null; }
    return { u, v };
  }
  /** ระยะลากบนจอ → ระยะในโลก ที่ความลึกของจุดที่ลาก (f ของจุดนั้น) */
  function deltaToWorld(dx, dy, f = 1) {
    const ff = f || 1;
    return unrot3({ x: dx / (s * ff), y: dy / (s * ff), z: 0 }, r.rx, r.ry);
  }
  return { view, proj, planeAt, deltaToWorld, s, cx, cy, rot: r, persp: k, T };
}
