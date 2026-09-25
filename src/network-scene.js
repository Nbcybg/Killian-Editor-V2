// network-scene.js — [alpha.166] ฉากหลังของ Story Network (บริสุทธิ์ 100% · unit `network-scene`)
//
// ผู้ใช้: *"ให้ผู้ใช้ใส่ background ลงใน canvas ได้ ดูเป็นอวกาศ หรือแผนที่ wargame ปรับสีอะไรได้
//          สามารถนำเข้า 3d model ได้ วางแทน node"*
//
// เก็บที่ project.khn.json → settings.netScene (ของผลงาน — แผนที่ของโลกนี้ไม่ตามไปเรื่องอื่น)
//   bg     { kind, c1, c2, image, imageMode, imageScale, imageX, imageY, imageOpacity, stars, dim }
//   grid   { style: 'square'|'hex'|'dots'|'none', px, alpha, color }
//   models { byNode: { '<หมวด>/<ชื่อ>': ModelRef }, byCat: { '<หมวด>': ModelRef } }
//            ModelRef = { file:'Models/x.glb', scale:1, yaw:0 }   (yaw = องศาที่หมุนตัวโมเดลให้หันหน้า)
// ไฟล์รูป/โมเดลเป็น "ทางสัมพัทธ์กับโปรเจกต์" เสมอ (ย้ายโฟลเดอร์โปรเจกต์แล้วยังเปิดได้)

/** ชนิดฉากหลัง — ลำดับนี้คือลำดับในเมนู · สีของพรีเซ็ตใช้เมื่อผู้ใช้ไม่ได้ตั้งเอง */
export const NET_BG_KINDS = [
  { id: 'theme',     lk: 'ui.netScene.bgTheme' },
  { id: 'solid',     lk: 'ui.netScene.bgSolid',     c1: '#14161c' },
  { id: 'gradient',  lk: 'ui.netScene.bgGradient',  c1: '#1b1f3a', c2: '#0b0d18' },
  { id: 'space',     lk: 'ui.netScene.bgSpace',     c1: '#05060f', c2: '#2a1850', grid: 'none' },
  { id: 'wargame',   lk: 'ui.netScene.bgWargame',   c1: '#5b6b3a', c2: '#3c4a26', grid: 'hex' },
  { id: 'blueprint', lk: 'ui.netScene.bgBlueprint', c1: '#0e3a78', c2: '#0a2a5a', grid: 'square' },
  { id: 'parchment', lk: 'ui.netScene.bgParchment', c1: '#e9dcb5', c2: '#c9b27c', grid: 'none' },
  { id: 'image',     lk: 'ui.netScene.bgImage' },
];
export const NET_GRID_STYLES = [
  { id: 'square', lk: 'ui.netScene.gridSquare' },
  { id: 'hex',    lk: 'ui.netScene.gridHex' },
  { id: 'dots',   lk: 'ui.netScene.gridDots' },
  { id: 'none',   lk: 'ui.netScene.gridNone' },
];
/** สีเส้นกริดของพรีเซ็ต (ตัดกับพื้นของมันเอง) — '' = ตามธีม */
const PRESET_GRID_COLOR = { wargame: '#1f2612', blueprint: '#bcd7ff', parchment: '#7a5a2a', space: '#6b6fb0' };

export const MODEL_EXTS = ['glb', 'gltf', 'obj', 'stl'];
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'];

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v, d) => (HEX.test(String(v || '')) ? String(v).toLowerCase() : d);
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const relPath = (v) => {
  const s = String(v || '').replace(/\\/g, '/').trim();
  // ทางสัมพัทธ์ภายในโปรเจกต์เท่านั้น — ห้ามไต่ออกนอกโฟลเดอร์ (../) หรือทางเต็มของเครื่อง
  if (!s || s.startsWith('/') || /^[a-z]:/i.test(s) || s.split('/').includes('..')) return '';
  return s;
};

function normModel(m) {
  if (!m || typeof m !== 'object') return null;
  const file = relPath(m.file);
  if (!file) return null;
  const ext = file.split('.').pop().toLowerCase();
  if (!MODEL_EXTS.includes(ext)) return null;
  return { file, scale: num(m.scale, 1, 0.2, 6), yaw: num(m.yaw, 0, 0, 359) };
}

/** ค่าที่บันทึกไว้ → ค่าพร้อมใช้ (ค่าเสีย/ขาด = ค่าเริ่มต้น · ไม่ throw) */
export function normalizeNetScene(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const b = s.bg && typeof s.bg === 'object' ? s.bg : {};
  const g = s.grid && typeof s.grid === 'object' ? s.grid : {};
  const kind = NET_BG_KINDS.some((k) => k.id === b.kind) ? b.kind : 'theme';
  const preset = NET_BG_KINDS.find((k) => k.id === kind) || {};
  const style = NET_GRID_STYLES.some((x) => x.id === g.style) ? g.style : (preset.grid || 'square');
  const byNode = {}, byCat = {};
  const ms = s.models && typeof s.models === 'object' ? s.models : {};
  for (const [k, v] of Object.entries(ms.byNode || {})) { const m = normModel(v); if (m && k) byNode[String(k)] = m; }
  for (const [k, v] of Object.entries(ms.byCat || {})) { const m = normModel(v); if (m && k) byCat[String(k)] = m; }
  return {
    bg: {
      kind,
      c1: hex(b.c1, preset.c1 || ''),
      c2: hex(b.c2, preset.c2 || ''),
      image: relPath(b.image),
      imageMode: b.imageMode === 'screen' ? 'screen' : 'world',
      imageScale: num(b.imageScale, 1, 0.05, 20),
      imageX: num(b.imageX, 0, -1e6, 1e6),
      imageY: num(b.imageY, 0, -1e6, 1e6),
      imageOpacity: num(b.imageOpacity, 1, 0, 1),
      stars: num(b.stars, 1, 0, 3),
      dim: num(b.dim, 0, 0, 0.9),
    },
    grid: {
      style,
      px: num(g.px, 60, 20, 200),
      alpha: num(g.alpha, 0.12, 0, 1),
      color: hex(g.color, ''),
    },
    models: { byNode, byCat },
  };
}

/** เปลี่ยนชนิดฉากหลัง: สีของพรีเซ็ตใหม่แทนสีเดิม (ไม่งั้นเลือกอวกาศแล้วยังเป็นสีเขียวของ wargame) + กริดตามพรีเซ็ต */
export function withBgKind(scene, kind) {
  const cur = normalizeNetScene(scene);
  const p = NET_BG_KINDS.find((k) => k.id === kind);
  if (!p) return cur;
  return normalizeNetScene({
    ...cur,
    bg: { ...cur.bg, kind, c1: p.c1 || cur.bg.c1, c2: p.c2 || cur.bg.c2 },
    grid: { ...cur.grid, style: p.grid || cur.grid.style, color: '' },
  });
}

/** สีเส้นกริดที่ใช้จริง: ที่ผู้ใช้ตั้ง → ของพรีเซ็ต → ของธีม */
export function gridColorOf(scene, themeGrid) {
  const s = normalizeNetScene(scene);
  return s.grid.color || PRESET_GRID_COLOR[s.bg.kind] || themeGrid;
}

/** ฉากหลังนี้ "สว่าง" ไหม (ป้ายชื่อ/แกนต้องเปลี่ยนน้ำหนัก) — คิดจากความสว่างของสีหลัก */
export function isLightBg(scene, themeBg) {
  const s = normalizeNetScene(scene);
  const c = s.bg.kind === 'theme' || s.bg.kind === 'image' ? themeBg : s.bg.c1;
  if (!HEX.test(String(c || ''))) return false;
  const n = parseInt(String(c).slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6;
}

/** ตัวเลขสุ่มที่กำหนดผลได้ (mulberry32) — ดาวต้องอยู่ที่เดิมทุกเฟรม ไม่งั้นกะพริบ */
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ดาวสามชั้น (ไกล/กลาง/ใกล้) พิกัด 0..1 ของแผ่นกระเบื้อง — ตัววาดเลื่อนแต่ละชั้นช้า-เร็วต่างกัน (parallax)
 * @returns {{x:number,y:number,r:number,a:number,layer:number,tint:number}[]}
 */
export function starField(density = 1, seed = 7) {
  const rnd = seededRandom(seed);
  const out = [];
  const per = [140, 60, 18].map((n) => Math.round(n * Math.max(0, density)));
  per.forEach((count, layer) => {
    for (let i = 0; i < count; i++) {
      out.push({ x: rnd(), y: rnd(), r: (0.35 + rnd() * 0.6) * (1 + layer * 0.7),
                 a: 0.35 + rnd() * 0.6, layer, tint: rnd() });
    }
  });
  return out;
}

/**
 * จุดศูนย์กลางของหกเหลี่ยม (ยอดแหลมขึ้นบน) ที่คลุมกรอบ [x0,x1]×[y0,y1] ในพิกัดโลก
 * size = รัศมี (ศูนย์กลาง → มุม) · จำกัดจำนวนกันผืนใหญ่ซูมออกสุดแล้วค้าง
 */
export function hexCenters(x0, y0, x1, y1, size, max = 6000) {
  const s = Math.max(4, +size || 30);
  const w = Math.sqrt(3) * s, h = 1.5 * s;
  const out = [];
  const r0 = Math.floor(y0 / h) - 1, r1 = Math.ceil(y1 / h) + 1;
  const q0 = Math.floor(x0 / w) - 1, q1 = Math.ceil(x1 / w) + 1;
  if ((r1 - r0) * (q1 - q0) > max) return out;
  for (let r = r0; r <= r1; r++) {
    const off = (r & 1) ? w / 2 : 0;
    for (let q = q0; q <= q1; q++) out.push({ x: q * w + off, y: r * h });
  }
  return out;
}

/** มุมทั้งหกของหกเหลี่ยม (ยอดแหลมขึ้นบน) */
export function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    pts.push({ x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) });
  }
  return pts;
}

/** คีย์ของโหนดในตารางโมเดล — หมวด/ชื่อ (อ่านออกด้วยตา · ไม่ผูกกับตำแหน่งไฟล์) */
export function modelKeyOf(node) { return (node && node.cat ? node.cat : '') + '/' + (node && node.name ? node.name : ''); }

/** โมเดลของโหนด: ของตัวมันเอง → ของหมวด → ไม่มี */
export function modelFor(scene, node) {
  const s = normalizeNetScene(scene);
  return s.models.byNode[modelKeyOf(node)] || (node && s.models.byCat[node.cat]) || null;
}

/** ตั้ง/ลบโมเดลของโหนด (ref = null → ลบ) · คืนฉากใหม่ */
export function setNodeModel(scene, node, ref) {
  const s = normalizeNetScene(scene);
  const k = modelKeyOf(node);
  const byNode = { ...s.models.byNode };
  if (ref) byNode[k] = ref; else delete byNode[k];
  return normalizeNetScene({ ...s, models: { ...s.models, byNode } });
}
/** ตั้ง/ลบโมเดลประจำหมวด */
export function setCatModel(scene, cat, ref) {
  const s = normalizeNetScene(scene);
  const byCat = { ...s.models.byCat };
  if (ref) byCat[cat] = ref; else delete byCat[cat];
  return normalizeNetScene({ ...s, models: { ...s.models, byCat } });
}

/** นามสกุลไฟล์ → ชนิดตัวอ่านโมเดล ('' = ไม่รองรับ) */
export function modelKind(file) {
  const ext = String(file || '').split('.').pop().toLowerCase();
  return MODEL_EXTS.includes(ext) ? ext : '';
}
