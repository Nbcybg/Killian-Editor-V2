// network-bg.js — [alpha.166] วาดฉากหลังของ Story Network (อวกาศ · แผนที่ wargame · พิมพ์เขียว · กระดาษเก่า · รูปของผู้ใช้)
//
// ค่าตั้งมาจาก network-scene.js (บริสุทธิ์) · ไฟล์นี้แตะ canvas อย่างเดียว ไม่อ่าน/เขียนไฟล์
// พื้นระนาบ (กริด · รูปแผนที่ · ภูมิประเทศ) วางบน "ระนาบ z = 0 ของโลก" แล้วฉายด้วย **ตัวฉายตัวเดียวกับโหนด**
// (makeProjector ของ network-camera.js) → โหมด 3D ได้พื้นโต๊ะเอียงตามกล้องจริง · มุมมองระยะก็ตรงกับโหนด
// · 2D = มองตรงลงมา เหมือนเดิมทุกพิกเซล
// [รอบ 2] วาดในพิกัดจอ (เส้นตรงยังเป็นเส้นตรงแม้มีมุมมองระยะ) + แคชทั้งผืน — ชี้เมาส์/ไฮไลต์โหนดไม่ต้องวาดพื้นใหม่
import { normalizeNetScene, starField, hexCenters, hexCorners, gridColorOf, seededRandom } from './network-scene.js';
import { skyFocal, skyDir, skyProject, equirectUV, skyStars, domeShader } from './network-sky.js';

const _tiles = new Map();               // ดาวแต่ละชั้น (แผ่นกระเบื้องที่วาดไว้แล้ว)
const TILE = 512;

function hexToRgb(h) {
  const n = parseInt(String(h || '').slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }

function starTile(layer, density, tint) {
  const key = layer + '|' + density + '|' + tint;
  if (_tiles.has(key)) return _tiles.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = TILE;
  const c = cv.getContext('2d');
  const tintRgb = hexToRgb(tint);
  for (const s of starField(density, 11 + layer * 7)) {
    if (s.layer !== layer) continue;
    const warm = s.tint > 0.8, cool = s.tint < 0.2;
    const col = warm ? [255, 226, 190] : cool ? [Math.min(255, 180 + tintRgb[0] / 4), 200, 255] : [255, 255, 255];
    c.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${s.a})`;
    c.beginPath(); c.arc(s.x * TILE, s.y * TILE, s.r, 0, Math.PI * 2); c.fill();
    if (layer === 2 && s.r > 1.5) {                      // ดาวใกล้ = มีแสงฟุ้งนิด ๆ
      const g = c.createRadialGradient(s.x * TILE, s.y * TILE, 0, s.x * TILE, s.y * TILE, s.r * 4);
      g.addColorStop(0, `rgba(255,255,255,${s.a * 0.35})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(s.x * TILE, s.y * TILE, s.r * 4, 0, Math.PI * 2); c.fill();
    }
  }
  _tiles.set(key, cv);
  return cv;
}

/** วาดแผ่นกระเบื้องซ้ำเต็มจอ เลื่อนตาม (ox,oy) */
function tileFill(c, tile, w, h, ox, oy) {
  const x0 = -(((ox % TILE) + TILE) % TILE), y0 = -(((oy % TILE) + TILE) % TILE);
  for (let x = x0; x < w; x += TILE) for (let y = y0; y < h; y += TILE) c.drawImage(tile, x, y);
}

/**
 * กรอบของระนาบ z=0 (พิกัด u,v) ที่มองเห็นบนจอ — ย้อนจุดรอบขอบจอผ่านตัวฉาย
 * มุมกล้องต่ำ/มีมุมมองระยะ บางจุดของจอไม่ได้มองเห็นระนาบ (เหนือขอบฟ้า) → ใช้เฉพาะจุดที่เห็น + จำกัดขนาด
 */
function visiblePlaneRect(pj, w, h) {
  const pts = [];
  const N = 6;
  for (let i = 0; i <= N; i++) for (const [X, Y] of [[w * i / N, 0], [w * i / N, h], [0, h * i / N], [w, h * i / N]]) {
    const p = pj.planeAt(X, Y);
    if (p && Number.isFinite(p.u) && Number.isFinite(p.v)) pts.push(p);
  }
  const c = pj.planeAt(w / 2, h / 2);
  if (!pts.length && !c) return null;
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const p of pts) { u0 = Math.min(u0, p.u); v0 = Math.min(v0, p.v); u1 = Math.max(u1, p.u); v1 = Math.max(v1, p.v); }
  // เพดาน: ขอบฟ้าของมุมกล้องต่ำ ๆ ยาวไม่สิ้นสุด — เกินนี้ไปเล็กจนมองไม่เห็นอยู่แล้ว (เดิม 12 เท่า = หกเหลี่ยมเกินเพดานนับ แล้วหายทั้งกริด)
  const lim = 3 * Math.max(w, h) / pj.s;
  const mu = c ? c.u : (u0 + u1) / 2, mv = c ? c.v : (v0 + v1) / 2;
  // ด้านที่มองไม่เห็นระนาบ (ขอบฟ้า) ขยายออกไปถึงเพดาน
  const partial = pts.length < 4 * (N + 1);
  if (partial) { u0 = Math.min(u0, mu - lim); u1 = Math.max(u1, mu + lim); v0 = Math.min(v0, mv - lim); v1 = Math.max(v1, mv + lim); }
  return { u0: Math.max(u0, mu - lim), u1: Math.min(u1, mu + lim), v0: Math.max(v0, mv - lim), v1: Math.min(v1, mv + lim), mu, mv };
}

/** จุดบนระนาบ → จอ (null = อยู่หลังกล้อง) */
function P(pj, u, v) { const p = pj.proj({ x: u, y: v, z: 0 }); return p.behind ? null : p; }

/** เส้นบนระนาบ (u0,v0)→(u1,v1) — ตัดเป็นช่วงสั้นเมื่อมีมุมมองระยะ (ปลายที่หลังกล้องไม่ลากทะลุจอ) */
function planeLine(c, pj, a, b) {
  const seg = pj.persp ? 8 : 1;
  let prev = null;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = P(pj, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (p && prev) { c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); }
    prev = p;
  }
}

/** กรอบที่เล็กลงรอบจุดกลางจอ ให้จำนวนช่องไม่เกินเพดาน (มุมกล้องต่ำ = ระนาบยาวถึงขอบฟ้า — วาดใกล้ ๆ พอ ไม่หายทั้งกริด) */
function capRect(pr, cellArea, max) {
  const area = (pr.u1 - pr.u0) * (pr.v1 - pr.v0);
  if (area / cellArea <= max) return pr;
  const L = Math.sqrt(max * cellArea) / 2;
  return { ...pr, u0: Math.max(pr.u0, pr.mu - L), u1: Math.min(pr.u1, pr.mu + L), v0: Math.max(pr.v0, pr.mv - L), v1: Math.min(pr.v1, pr.mv + L) };
}

let _gridCv = null;
function gridLayer(w, h) {
  if (!_gridCv || _gridCv.width !== w || _gridCv.height !== h) { _gridCv = document.createElement('canvas'); _gridCv.width = w; _gridCv.height = h; }
  return _gridCv;
}

/** @returns {object|null} กรอบที่วาดจริง (อาจเล็กกว่า pr0 เมื่อเกินเพดาน) · null = ไม่ได้วาด */
function drawGrid(c, pj, pr0, grid, color) {
  if (!pr0 || grid.style === 'none' || grid.alpha <= 0) return null;
  const px = grid.px;
  const pr = capRect(pr0, grid.style === 'hex' ? px * px * 0.87 : px * px, grid.style === 'square' ? 250000 : 12000);
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.globalAlpha = grid.alpha;
  if (grid.style === 'square') {
    const lines = (step, maxN) => {
      c.beginPath();
      let n = 0;
      for (let u = Math.floor(pr.u0 / step) * step; u <= pr.u1 && n < maxN; u += step, n++) planeLine(c, pj, [u, pr.v0], [u, pr.v1]);
      for (let v = Math.floor(pr.v0 / step) * step; v <= pr.v1 && n < maxN * 2; v += step, n++) planeLine(c, pj, [pr.u0, v], [pr.u1, v]);
      c.stroke();
    };
    c.lineWidth = 0.6; lines(px, 1500);
    // เส้นหลักทุก 5 ช่อง (อ่านระยะได้ เหมือนกระดาษกราฟ)
    c.globalAlpha = Math.min(1, grid.alpha * 2.2); c.lineWidth = 1; lines(px * 5, 400);
  } else if (grid.style === 'hex') {
    const size = px / Math.sqrt(3);
    c.lineWidth = 0.8;
    c.beginPath();
    for (const hx of hexCenters(pr.u0, pr.v0, pr.u1, pr.v1, size, 14000)) {
      const k = hexCorners(hx.x, hx.y, size).map((q) => P(pj, q.x, q.y));
      if (k.some((q) => !q)) continue;
      c.moveTo(k[0].x, k[0].y);
      for (let i = 1; i < 6; i++) c.lineTo(k[i].x, k[i].y);
      c.closePath();
    }
    c.stroke();
  } else if (grid.style === 'dots') {
    const u0 = Math.floor(pr.u0 / px) * px, v0 = Math.floor(pr.v0 / px) * px;
    let n = 0;
    c.globalAlpha = Math.min(1, grid.alpha * 3);
    c.beginPath();
    for (let u = u0; u <= pr.u1 && n < 20000; u += px) {
      for (let v = v0; v <= pr.v1 && n < 20000; v += px, n++) {
        const p = P(pj, u, v); if (!p) continue;
        const r = Math.max(0.9, px * 0.035 * pj.s * p.f);
        c.moveTo(p.x + r, p.y); c.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
    }
    c.fill();
  }
  c.restore();
  return pr;
}

/** ภูมิประเทศของแผนที่ wargame — ก้อนสีเข้ม/อ่อนสุ่มแบบคงที่ต่อช่อง (ติดไปกับแผนที่เวลาเลื่อน) */
function drawTerrain(c, pj, pr, bg) {
  if (!pr) return;
  const CELL = 520;
  const i0 = Math.floor(pr.u0 / CELL), i1 = Math.floor(pr.u1 / CELL), j0 = Math.floor(pr.v0 / CELL), j1 = Math.floor(pr.v1 / CELL);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 900) return;
  c.save();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const rnd = seededRandom((i * 73856093) ^ (j * 19349663));
    for (let k = 0; k < 3; k++) {
      const u = (i + rnd()) * CELL, v = (j + rnd()) * CELL, rr = CELL * (0.25 + rnd() * 0.5);
      const dark = rnd() < 0.55;
      const p = P(pj, u, v); if (!p || p.f < 0.35) continue;      // ใกล้ขอบฟ้า = ยืดเป็นแถบยาวผิดรูป → ข้าม
      // ก้อนกลมบนระนาบ = วงรีบนจอ: ใช้การแปลงเชิงเส้นเฉพาะที่ (แกน u,v ที่จุดนั้น)
      const pu = P(pj, u + rr, v), pv = P(pj, u, v + rr); if (!pu || !pv) continue;
      c.setTransform(pu.x - p.x, pu.y - p.y, pv.x - p.x, pv.y - p.y, p.x, p.y);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, dark ? rgba(bg.c2, 0.55) : 'rgba(255,255,230,0.10)');
      g.addColorStop(1, dark ? rgba(bg.c2, 0) : 'rgba(255,255,230,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

/**
 * รูปของผู้ใช้บนระนาบ — แบ่งเป็นตาราง แล้ววาดแต่ละช่องด้วยการแปลงเชิงเส้นของมุมช่อง
 * (ไม่มีมุมมองระยะ = ช่องเดียวก็ตรงเป๊ะ · มีมุมมองระยะ = 10×10 ช่องต่อกันจนดูเป็นแผ่นเดียว)
 */
function drawPlaneImage(c, pj, img, bg) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const W = iw * bg.imageScale, H = ih * bg.imageScale;
  const U0 = bg.imageX - W / 2, V0 = bg.imageY - H / 2;
  const N = pj.persp ? 10 : 1;
  c.save();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const u = U0 + W * i / N, v = V0 + H * j / N, du = W / N, dv = H / N;
    const a = P(pj, u, v), b = P(pj, u + du, v), d = P(pj, u, v + dv), e = P(pj, u + du, v + dv);
    if (!a || !b || !d || !e) continue;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(e.x, e.y); c.lineTo(d.x, d.y); c.closePath();
    c.clip();
    const sx = iw * i / N, sy = ih * j / N, sw = iw / N, sh = ih / N;
    c.setTransform((b.x - a.x) / sw, (b.y - a.y) / sw, (d.x - a.x) / sh, (d.y - a.y) / sh, a.x, a.y);
    // ช่องต่อกันเกินครึ่งพิกเซล (ของภาพต้นทาง) — กันรอยต่อบาง ๆ ระหว่างช่องตอนมีมุมมองระยะ
    const ov = N > 1 ? 0.6 : 0;
    c.drawImage(img, sx, sy, Math.min(sw + ov, iw - sx), Math.min(sh + ov, ih - sy), 0, 0, Math.min(sw + ov, iw - sx), Math.min(sh + ov, ih - sy));
    c.restore();
  }
  c.restore();
}

// ═══════════════ [alpha.167] skybox — ฉากหลังของโหมด 3D ═══════════════
// ทุกพิกเซล = ทิศทางหนึ่งในโลก (network-sky.js) → ฟ้าหมุนตามมุมกล้อง แต่ไม่เลื่อนตามแพน/ซูม
// โดม (สีไล่ · เนบิวลา · พาโนรามา) คำนวณที่ความละเอียดต่ำแล้วขยายแบบนุ่ม (สีฟ้าไม่มีรายละเอียดคม)
// ดาววาดทีละดวงที่ความละเอียดเต็ม (จุดคม ไม่เบลอ)
const SKY = { cv: null, px: null, stars: null, starKey: '' };
const _pano = new WeakMap();          // รูป → {w,h,data} (อ่านพิกเซลครั้งเดียวต่อรูป)

function panoPixels(img) {
  if (_pano.has(img)) return _pano.get(img);
  let out = null;
  try {
    const W = Math.min(2048, img.naturalWidth), H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0, W, H);
    out = { w: W, h: H, data: c.getImageData(0, 0, W, H).data };
  } catch { out = null; }        // รูปข้ามต้นทาง (อ่านพิกเซลไม่ได้) → ใช้โดมสีไล่แทน
  _pano.set(img, out);
  return out;
}

/**
 * วาด skybox เต็มผืน
 * @param {{rx:number,ry:number}} rot  มุมกล้องของเฟรมนี้
 * @param {object} bg  ค่าฉากหลังที่ normalize แล้ว
 */
export function drawSky(c, w, h, rot, bg, themeBg, image) {
  const f = skyFocal(w, h);
  const pano = bg.kind === 'image' && image && image.naturalWidth ? panoPixels(image) : null;
  const step = pano ? 2 : 4;
  const lw = Math.ceil(w / step) + 1, lh = Math.ceil(h / step) + 1;
  if (!SKY.cv) SKY.cv = document.createElement('canvas');
  if (SKY.cv.width !== lw || SKY.cv.height !== lh) { SKY.cv.width = lw; SKY.cv.height = lh; SKY.px = null; }
  const sc = SKY.cv.getContext('2d');
  if (!SKY.px) SKY.px = sc.createImageData(lw, lh);
  const D = SKY.px.data;
  const shader = domeShader(bg, themeBg);
  let o = 0;
  for (let j = 0; j < lh; j++) {
    for (let i = 0; i < lw; i++, o += 4) {
      const d = skyDir(i * step, j * step, w, h, rot, f);
      let r, g, b;
      if (pano) {
        const uv = equirectUV(d);
        const x = Math.min(pano.w - 1, Math.max(0, (uv.u * pano.w) | 0)), y = Math.min(pano.h - 1, Math.max(0, (uv.v * pano.h) | 0));
        const k = (y * pano.w + x) * 4;
        r = pano.data[k]; g = pano.data[k + 1]; b = pano.data[k + 2];
      } else { const col = shader(d); r = col[0]; g = col[1]; b = col[2]; }
      D[o] = r; D[o + 1] = g; D[o + 2] = b; D[o + 3] = 255;
    }
  }
  sc.putImageData(SKY.px, 0, 0);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(SKY.cv, 0, 0, lw * step, lh * step);
  // ดาว — เฉพาะอวกาศ
  if (bg.kind === 'space' && bg.stars > 0) {
    const key = String(bg.stars);
    if (SKY.starKey !== key) { SKY.stars = skyStars(bg.stars); SKY.starKey = key; }
    for (const s of SKY.stars) {
      const p = skyProject(s, w, h, rot, f);
      if (!p || p.x < -4 || p.y < -4 || p.x > w + 4 || p.y > h + 4) continue;
      const warm = s.tint > 0.85, cool = s.tint < 0.2;
      const col = warm ? '255,226,190' : cool ? '190,210,255' : '255,255,255';
      if (s.r > 1.5) {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, s.r * 5);
        g.addColorStop(0, `rgba(${col},${s.a * 0.45})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, s.r * 5, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = `rgba(${col},${s.a})`;
      if (s.r < 0.8) c.fillRect(p.x - 0.5, p.y - 0.5, 1.1, 1.1);
      else { c.beginPath(); c.arc(p.x, p.y, s.r, 0, Math.PI * 2); c.fill(); }
    }
  }
  c.restore();
}

/**
 * วาดฉากหลังทั้งหมด (พื้น + ของบนระนาบ + กริด) — เรียกก่อนวาดเส้น/โหนด
 * @param {CanvasRenderingContext2D} c
 * @param {ReturnType<import('./network-camera.js').makeProjector>} pj  ตัวฉายของเฟรมนี้
 * @param {object} sceneCfg  settings.netScene
 * @param {{bg:string, grid:string}} theme  สีธีมของผัง (canvas.bg / canvas.grid)
 * @param {{image?:HTMLImageElement|null, showGrid?:boolean, cam?:{tx:number,ty:number}}} extra
 */
export function drawNetBackground(c, w, h, pj, sceneCfg, theme, extra = {}) {
  const sc = normalizeNetScene(sceneCfg);
  const bg = sc.bg;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  // [alpha.167] โหมด 3D = skybox (sky = 0..1 ไล่ตามภาพเคลื่อนไหวตอนสลับโหมด — 2D ค่อย ๆ จางเป็นฟ้า)
  // ชนิดสีเดียวไม่มีอะไรให้หมุน → วาดแบบเดิม · ผู้ใช้เลือก 'plane' = แผ่นบนระนาบแบบ alpha.166
  const sky = bg.sky3d === 'sky' && bg.kind !== 'solid' ? Math.max(0, Math.min(1, +extra.sky || 0)) : 0;
  const rot = pj.rot || { rx: 0, ry: 0 };
  if (sky >= 1) {
    drawSky(c, w, h, rot, bg, theme.bg, extra.image);
  } else if (bg.kind === 'solid') { c.fillStyle = bg.c1 || theme.bg; c.fillRect(0, 0, w, h); }
  else if (bg.kind === 'gradient' || bg.kind === 'blueprint') {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, bg.c1 || theme.bg); g.addColorStop(1, bg.c2 || bg.c1 || theme.bg);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else if (bg.kind === 'space') {
    c.fillStyle = bg.c1 || theme.bg; c.fillRect(0, 0, w, h);
    // เนบิวลา — ตำแหน่งคงที่ตามจอ เลื่อนนิดเดียวตามกล้อง (อยู่ไกลที่สุด)
    const cam = extra.cam || { tx: 0, ty: 0 };
    const par = (k) => ({ x: -cam.tx * pj.s * k - pj.rot.ry * w * 0.25 * k * 8, y: -cam.ty * pj.s * k + pj.rot.rx * h * 0.25 * k * 8 });
    const pn = par(0.02);
    const rnd = seededRandom(5);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = ((rnd() * 1.4 - 0.2) * w + pn.x), y = ((rnd() * 1.4 - 0.2) * h + pn.y), r = Math.max(w, h) * (0.25 + rnd() * 0.35);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(bg.c2 || theme.grid, 0.55)); g.addColorStop(1, rgba(bg.c2 || theme.grid, 0));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    c.globalCompositeOperation = 'source-over';
    if (bg.stars > 0) {
      for (let layer = 0; layer < 3; layer++) {
        const k = [0.04, 0.1, 0.22][layer];
        const p = par(k);
        tileFill(c, starTile(layer, bg.stars, bg.c2 || theme.grid), w, h, -p.x, -p.y);
      }
    }
  } else if (bg.kind === 'wargame') {
    c.fillStyle = bg.c1 || theme.bg; c.fillRect(0, 0, w, h);
  } else if (bg.kind === 'parchment') {
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, bg.c1 || theme.bg); g.addColorStop(1, bg.c2 || bg.c1 || theme.bg);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else {
    c.fillStyle = theme.bg; c.fillRect(0, 0, w, h);
  }
  const pr = visiblePlaneRect(pj, w, h);
  // ── ของบนระนาบ (แผ่น) — โหมด skybox เต็มตัวไม่มีแผ่น ──
  if (sky < 1 && bg.kind === 'wargame') drawTerrain(c, pj, pr, bg);
  if (sky < 1 && bg.kind === 'image' && extra.image && extra.image.naturalWidth) {
    const img = extra.image;
    c.globalAlpha = bg.imageOpacity;
    if (bg.imageMode === 'screen') {
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      c.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    } else drawPlaneImage(c, pj, img, bg);
    c.globalAlpha = 1;
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (sky > 0 && sky < 1) { c.globalAlpha = sky; drawSky(c, w, h, rot, bg, theme.bg, extra.image); c.globalAlpha = 1; }
  if (bg.dim > 0) { c.fillStyle = `rgba(0,0,0,${bg.dim})`; c.fillRect(0, 0, w, h); }
  // ── กริด ──
  // วาดลงแผ่นแยกก่อน แล้วค่อย ๆ จางออกตามระยะ (มุมกล้องต่ำ/มุมมองระยะ = กริดถูกจำกัดรอบกลางจอ — ขอบตัดตรงดูเป็นกำแพง)
  if (extra.showGrid !== false && pr) {
    const L = gridLayer(w, h);
    const gc = L.getContext('2d');
    gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, w, h);
    const used = drawGrid(gc, pj, pr, sc.grid, gridColorOf(sc, theme.grid));
    if (used && (used !== pr || pj.persp)) {
      const ctr = P(pj, used.mu, used.mv) || { x: w / 2, y: h / 2 };
      let R = Infinity;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const e = P(pj, du ? (du > 0 ? used.u1 : used.u0) : used.mu, dv ? (dv > 0 ? used.v1 : used.v0) : used.mv);
        if (e) R = Math.min(R, Math.hypot(e.x - ctr.x, e.y - ctr.y));
      }
      if (Number.isFinite(R) && R > 20) {
        gc.globalCompositeOperation = 'destination-in';
        const g = gc.createRadialGradient(ctr.x, ctr.y, R * 0.55, ctr.x, ctr.y, R);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        gc.fillStyle = g; gc.fillRect(0, 0, w, h);
        gc.globalCompositeOperation = 'source-over';
      }
    }
    c.drawImage(L, 0, 0);
  }
  c.restore();
}

// ── แคชทั้งผืน — ชี้เมาส์/ไฮไลต์/ลากป้ายไม่ต้องวาดพื้นใหม่ (กริดหกเหลี่ยมหลายพันช่องต่อเฟรมหนักจริง) ──
const _cache = { key: '', cv: null };
/**
 * เหมือน drawNetBackground แต่ใช้ภาพเดิมถ้าทุกอย่างที่มีผลกับพื้นเท่าเดิม
 * @param {string} key  ลายเซ็นของสภาพ (กล้อง · ขนาด · ค่าฉากหลัง · สีธีม · รูป) — ฝั่งเรียกประกอบให้
 */
export function drawNetBackgroundCached(c, w, h, pj, sceneCfg, theme, extra, key) {
  if (!_cache.cv || _cache.cv.width !== w || _cache.cv.height !== h) {
    _cache.cv = document.createElement('canvas'); _cache.cv.width = w; _cache.cv.height = h; _cache.key = '';
  }
  if (_cache.key !== key) {
    const cc = _cache.cv.getContext('2d');
    cc.setTransform(1, 0, 0, 1, 0, 0); cc.clearRect(0, 0, w, h);
    drawNetBackground(cc, w, h, pj, sceneCfg, theme, extra);
    _cache.key = key;
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(_cache.cv, 0, 0); c.restore();
}
