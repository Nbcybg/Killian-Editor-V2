// hdr-decode.js — ถอดไฟล์ Radiance .hdr (RGBE) + ทำ tone map ให้เป็นภาพ 8 บิต (บริสุทธิ์ 100% · unit `hdr-decode`)
//
// ผู้ใช้: *"ฉากหลัง พอเป็น 3d แล้ว มันควรเป็นแบบ HDRI นะ"* — ภาพ HDRI ส่วนใหญ่ที่ดาวน์โหลดมาเป็น .hdr
// เบราว์เซอร์เปิดไฟล์ชนิดนี้ไม่ได้ จึงถอดเอง: หัวไฟล์ข้อความ → บรรทัดสแกนแบบ RLE ใหม่ (หรือแบบดิบ) → RGBE → float
// แล้ว tone map (Reinhard + แกมมา 2.2) ให้ตัววาดพาโนรามาเอาไปใช้เหมือนรูปธรรมดา

/** อ่านหัวไฟล์ — คืน { width, height, pos (ไบต์แรกของข้อมูลภาพ), exposure, flipY } หรือ null */
export function parseHdrHeader(bytes) {
  const b = bytes;
  let pos = 0;
  const line = () => {
    let s = '';
    while (pos < b.length && b[pos] !== 0x0a) s += String.fromCharCode(b[pos++]);
    pos++;
    return s;
  };
  const magic = line();
  if (!/^#\?(RADIANCE|RGBE)/.test(magic)) return null;
  let exposure = 1, format = '';
  for (let guard = 0; guard < 200 && pos < b.length; guard++) {
    const l = line();
    if (l === '') break;                               // บรรทัดว่าง = จบหัวไฟล์
    const m = l.match(/^FORMAT=(.+)$/);
    if (m) format = m[1].trim();
    const e = l.match(/^EXPOSURE=\s*([\d.eE+-]+)/);
    if (e && Number(e[1]) > 0) exposure *= Number(e[1]);
  }
  if (format && format !== '32-bit_rle_rgbe') return null;   // xyze ไม่รองรับ
  const res = line().trim().match(/^([+-])Y\s+(\d+)\s+([+-])X\s+(\d+)$/);
  if (!res) return null;
  const height = +res[2], width = +res[4];
  if (!width || !height || width * height > 64e6) return null;
  return { width, height, pos, exposure, flipY: res[1] === '+' };
}

/** ถอดข้อมูลภาพเป็น RGBE ดิบ (Uint8Array ยาว w·h·4) — รองรับ RLE แบบใหม่ + แบบดิบ */
export function decodeRgbe(bytes) {
  const h = parseHdrHeader(bytes);
  if (!h) return null;
  const { width: W, height: H } = h;
  const out = new Uint8Array(W * H * 4);
  let pos = h.pos;
  const b = bytes;
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (pos + 4 > b.length) return null;
    const rle = W >= 8 && W < 32768 && b[pos] === 2 && b[pos + 1] === 2 && !(b[pos + 2] & 0x80);
    if (!rle) {
      // ไฟล์แบบดิบ (หรือ RLE แบบเก่าที่ไม่มีใครเขียนแล้ว) — อ่านตรง ๆ ทีละพิกเซล
      const n = W * 4;
      if (pos + n > b.length) return null;
      out.set(b.subarray(pos, pos + n), y * n);
      pos += n;
      continue;
    }
    if (((b[pos + 2] << 8) | b[pos + 3]) !== W) return null;
    pos += 4;
    for (let ch = 0; ch < 4; ch++) {
      let x = 0;
      while (x < W) {
        if (pos >= b.length) return null;
        let c = b[pos++];
        if (c > 128) {                                   // ช่วงซ้ำ
          c -= 128;
          if (x + c > W) return null;
          const v = b[pos++];
          for (let i = 0; i < c; i++) scan[(x++) * 4 + ch] = v;
        } else {                                         // ช่วงดิบ
          if (!c || x + c > W || pos + c > b.length) return null;
          for (let i = 0; i < c; i++) scan[(x++) * 4 + ch] = b[pos++];
        }
      }
    }
    out.set(scan, y * W * 4);
  }
  return { width: W, height: H, rgbe: out, exposure: h.exposure, flipY: h.flipY };
}

/** RGBE → ค่าสีจริง (float) */
export function rgbeToFloat(r, g, b, e) {
  if (!e) return [0, 0, 0];
  const f = Math.pow(2, e - 136);                        // 2^(e-128) / 256
  return [(r + 0.5) * f, (g + 0.5) * f, (b + 0.5) * f];
}

/**
 * ไฟล์ .hdr → พิกเซล RGBA 8 บิตพร้อมวาด (ย่อด้านยาวไม่เกิน maxW)
 * tone map: Reinhard ต่อช่องสี แล้วแกมมา 2.2 · exposure คูณก่อน
 * @returns {{width:number,height:number,data:Uint8ClampedArray}|null}
 */
export function hdrToRgba8(bytes, { maxW = 2048, exposure = 1 } = {}) {
  const d = decodeRgbe(bytes);
  if (!d) return null;
  const step = Math.max(1, Math.ceil(d.width / maxW));
  const W = Math.floor(d.width / step), H = Math.floor(d.height / step);
  const data = new Uint8ClampedArray(W * H * 4);
  const ex = exposure * d.exposure;
  const tm = (v) => Math.round(255 * Math.pow(v / (1 + v), 1 / 2.2));
  for (let y = 0; y < H; y++) {
    const sy = d.flipY ? d.height - 1 - y * step : y * step;
    for (let x = 0; x < W; x++) {
      const i = (sy * d.width + x * step) * 4;
      const [r, g, b] = rgbeToFloat(d.rgbe[i], d.rgbe[i + 1], d.rgbe[i + 2], d.rgbe[i + 3]);
      const o = (y * W + x) * 4;
      data[o] = tm(r * ex); data[o + 1] = tm(g * ex); data[o + 2] = tm(b * ex); data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

/** ภาพนี้เป็นพาโนรามาแบบ equirectangular ไหม (สัดส่วน 2:1 · ยอมคลาด 8%) */
export function isPanorama(w, h) {
  if (!(w > 0 && h > 0)) return false;
  const r = w / h;
  return r > 1.84 && r < 2.16;
}

/**
 * ทิศที่กล้องมองผ่านพิกเซล (X,Y) ของจอ → พิกัด (u,v) บนภาพพาโนรามา 0..1
 * กล้องของผังเป็นแบบขนาน (orthographic) — ฉากหลังจึงใช้ "เลนส์สมมติ" มุมกว้าง fov แทน ไม่งั้นทุกพิกเซลมองทิศเดียวกัน = สีเดียวทั้งจอ
 * ry หมุนซ้าย-ขวา (yaw) · rx ก้ม-เงย (pitch) — ทิศเดียวกับที่ผังหมุน
 */
export function panoUV(X, Y, w, h, rx, ry, fov = 75) {
  const f = (0.5 * w) / Math.tan((fov * Math.PI) / 360);
  let dx = X - w / 2, dy = Y - h / 2, dz = f;
  // pitch (รอบแกน X) แล้ว yaw (รอบแกน Y)
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const y1 = dy * cx - dz * sx, z1 = dy * sx + dz * cx;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x2 = dx * cy + z1 * sy, z2 = -dx * sy + z1 * cy;
  dx = x2; dy = y1; dz = z2;
  const len = Math.hypot(dx, dy, dz) || 1;
  const lon = Math.atan2(dx, dz);                        // −π..π
  const lat = Math.asin(Math.max(-1, Math.min(1, dy / len)));   // −π/2..π/2 (บวก = ลง)
  return { u: 0.5 + lon / (2 * Math.PI), v: 0.5 + lat / Math.PI };
}
