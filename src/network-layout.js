// network-layout.js — เอนจิน Force Layout 3D สำหรับ Story Network (pure module)
// import { forceLayout, seedLayout, loadPositions, savePositions, clearPositions, nodeKey } from './network-layout.js';

// v2 = คีย์แยกตามโปรเจกต์ + คีย์โหนดรวมหมวด (ของเก่า key เดียวทั้งเครื่องจึงปนกันข้ามโปรเจกต์)
const STORE_PREFIX = 'k2-net-layout2';

// NUL — อักขระเดียวที่ชื่อเอนทิตี้/ชื่อฉากมีไม่ได้ จึงใช้คั่นได้ปลอดภัย
const SEP = String.fromCharCode(0);

/** คีย์โหนดที่ไม่ชนกัน — ชื่อซ้ำข้ามหมวด (ตัวละคร/สถานที่/ฉาก) ต้องแยกจากกัน */
export function nodeKey(n) {
  return ((n && n.cat) || '') + SEP + ((n && n.name) || '');
}

/** localStorage key แยกตามโปรเจกต์ — ไม่งั้นโปรเจกต์อื่นที่มีชื่อเอนทิตี้ซ้ำจะยืมตำแหน่งกันมั่ว */
function storeKey(scope) { return scopedKey(STORE_PREFIX, scope); }
/** [alpha.166] คีย์ localStorage ต่อโปรเจกต์ (ใช้ร่วมกับกล้องของผัง `k2-net-cam`) */
export function scopedKey(prefix, scope) {
  if (!scope) return prefix;
  const s = String(scope).replace(/[\\/]+$/, '').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${prefix}:${(h >>> 0).toString(36)}`;
}

export function forceLayout(nodes, edges, { width = 900, height = 600, depth = 400, iters = 300, pinned = null } = {}) {
  const n = nodes.length;
  if (n < 2) return;
  const centerX = 0, centerY = 0, centerZ = 0;
  for (let it = 0; it < iters; it++) {
    const alpha = 1 - it / iters;
    const damping = 0.5 + alpha * 0.5;
    const repulsion = 9000 * alpha + 2500;
    const attraction = 0.02 * alpha + 0.006;
    const gravity = 0.004 * alpha + 0.001;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      if (pinned && pinned.has(a)) continue; // ล็อกโหนดที่ผู้ใช้ลากเอง
      let fx = 0, fy = 0, fz = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
        const d2 = Math.max(100, dx * dx + dy * dy + dz * dz);
        const f = repulsion / d2;
        fx += dx * f; fy += dy * f; fz += dz * f;
      }
      for (const e of edges) {
        if (e.a !== a && e.b !== a) continue;
        const o = e.a === a ? e.b : e.a;
        fx += (o.x - a.x) * attraction;
        fy += (o.y - a.y) * attraction;
        fz += ((o.z || 0) - (a.z || 0)) * attraction;
      }
      fx += (centerX - a.x) * gravity;
      fy += (centerY - a.y) * gravity;
      fz += (centerZ - (a.z || 0)) * gravity;
      const clamp = 22 * damping;
      a.x += Math.max(-clamp, Math.min(clamp, fx * damping));
      a.y += Math.max(-clamp, Math.min(clamp, fy * damping));
      a.z = (a.z || 0) + Math.max(-clamp, Math.min(clamp, fz * damping));
    }
  }
}

/**
 * [alpha.73 ข้อ 1] วางตำแหน่งเริ่มต้น
 *
 * เดิมบันทึกเฉพาะโหนดที่ผู้ใช้ลากเอง → โหนดที่เหลือถูก `Math.random()` โยนตำแหน่งใหม่
 * แล้ว forceLayout จัดใหม่ทุกครั้งที่กดรีเฟรช = **ผังเปลี่ยนหน้าตาทุกครั้ง** ผู้ใช้จำอะไรไม่ได้เลย
 *
 * ตอนนี้แยกสองเรื่องออกจากกัน:
 *   - **ตำแหน่งที่บันทึก** — เก็บทุกโหนด เพื่อให้เปิดมาเห็นผังเดิมเป๊ะ
 *   - **ปักหมุด (pinned)** — เฉพาะโหนดที่ผู้ใช้ลาก/ผลักเอง · forceLayout ห้ามขยับ
 * โหนดที่ยังไม่เคยมีตำแหน่ง (เอนทิตี้ที่เพิ่งสร้าง) ติดธง `_fresh` ให้ฝั่งเรียกจัดวางเฉพาะตัวนั้น
 */
export function seedLayout(nodes, positions, { width = 900, depth = 400 } = {}) {
  const halfW = width * 0.28, halfD = depth * 0.28;
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const pos = positions && positions[nodeKey(node)];
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      node.x = pos.x;
      node.y = pos.y;
      node.z = typeof pos.z === 'number' ? pos.z : 0;
      // ไฟล์รุ่นเก่าไม่มีธง pinned — ของที่บันทึกไว้ตอนนั้นคือ "โหนดที่ผู้ใช้ลากเอง" ทั้งหมด
      node._pinned = pos.pinned === undefined ? true : !!pos.pinned;
      node._fresh = false;
    } else {
      node._fresh = true;
      const angle = (i / Math.max(1, n)) * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * halfW;
      node.x = Math.cos(angle) * r;
      node.y = Math.sin(angle) * r;
      node.z = (Math.random() - 0.5) * halfD * 2;
      node._pinned = false;
    }
  }
}

/**
 * เก็บตำแหน่ง **ทุกโหนด** พร้อมธงว่าตัวไหนผู้ใช้จัดเอง
 * (เดิมเก็บเฉพาะตัวที่ลาก เพราะกลัวว่าเก็บหมดแล้วจะถูกปักหมุดหมดทั้งผัง —
 *  ตอนนี้ธง pinned แยกจากตำแหน่งแล้ว จึงเก็บได้ครบโดยที่ forceLayout ยังทำงานกับของใหม่ได้)
 */
export function layoutPositions(nodes) {
  const out = {};
  for (const n of nodes || []) {
    if (n && n.name && Number.isFinite(n.x) && Number.isFinite(n.y)) {
      out[nodeKey(n)] = { x: Math.round(n.x), y: Math.round(n.y), z: Math.round(n.z || 0),
                          pinned: !!n._pinned };
    }
  }
  return out;
}

export function loadPositions(scope) {
  try {
    const raw = localStorage.getItem(storeKey(scope));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function savePositions(nodes, scope) {
  try {
    localStorage.setItem(storeKey(scope), JSON.stringify(layoutPositions(nodes)));
  } catch { /* quota exceeded */ }
}

/** ปลดหมุดทั้งผัง — ลบที่บันทึกไว้ + ล้างธงบนโหนดที่ถืออยู่ (ให้ forceLayout จัดใหม่ได้) */
export function clearPositions(nodes, scope) {
  try { localStorage.removeItem(storeKey(scope)); } catch { /* ignore */ }
  for (const n of nodes || []) if (n) n._pinned = false;
}

// ═══════════════════ [alpha.166 · รอบ 2] จัดผังแบบมีความหมาย ═══════════════════
// เดิมมีแต่ "แรงผลัก/แรงดึง" (forceLayout) ซึ่งหน้าตาสุ่ม — ผังใหญ่แล้วอ่านโครงเรื่องไม่ออก
// ทุกตัวคืน Map<node,{x,y,z}> (ไม่แก้โหนดเอง — ฝั่งเรียกเป็นคนทำภาพเคลื่อนไหวจากที่เดิมไปที่ใหม่)

const STRUCT = new Set(['scene', 'chapter', 'book', 'section']);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** จัดเป็นกลุ่มตามหมวด — แต่ละหมวดเป็นดอกทานตะวัน (phyllotaxis) รอบวงใหญ่ · โครงเรื่อง (ฉาก/บท) อยู่กลาง */
export function layoutByCategory(nodes, { spacing = 62, ring = 420 } = {}) {
  const groups = new Map();
  for (const n of nodes || []) {
    const g = STRUCT.has(n.cat) ? '__struct' : (n.cat || '');
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  }
  const keys = [...groups.keys()].filter((k) => k !== '__struct');
  const out = new Map();
  const place = (list, cx, cy) => list.forEach((n, i) => {
    const r = spacing * 0.62 * Math.sqrt(i + 0.5), a = i * GOLDEN;
    out.set(n, { x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r), z: 0 });
  });
  // หมวดเดียวแต่มีโครงเรื่องด้วย = ต้องแยกวงเหมือนกัน (ไม่งั้นสองกลุ่มกองทับกันที่จุดกลาง)
  const R = keys.length > 1 || (keys.length && groups.has('__struct'))
    ? ring + spacing * Math.sqrt(Math.max(...keys.map((k) => groups.get(k).length), groups.has('__struct') ? groups.get('__struct').length : 0)) * 0.6 : 0;
  keys.forEach((k, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, keys.length)) * Math.PI * 2;
    place(groups.get(k), Math.cos(a) * R, Math.sin(a) * R);
  });
  if (groups.has('__struct')) place(groups.get('__struct'), 0, 0);
  return out;
}

/**
 * ตามลำดับเรื่อง — ฉากเรียงเป็นแกนเวลา (ซ้าย → ขวา) · บทอยู่เหนือฉากแรกของบท ·
 * เอนทิตี้อยู่ใต้แกน ตรงกลางของฉากที่ตัวเองปรากฏ (แถวตามหมวด · กันทับกันด้วยการเลื่อนตามแนวนอน)
 * @param {any[]} order  ฉากเรียงตามเรื่อง (sceneOrder)
 */
export function layoutStory(nodes, edges, order, { step = 110, gap = 58 } = {}) {
  const out = new Map();
  const xOf = new Map();
  (order || []).forEach((n, i) => { const x = Math.round((i - (order.length - 1) / 2) * step); xOf.set(n, x); out.set(n, { x, y: 0, z: 0 }); });
  const scenesOf = new Map();
  const add = (k, v) => { if (!scenesOf.has(k)) scenesOf.set(k, []); scenesOf.get(k).push(v); };
  for (const e of edges || []) {
    if (e.type !== 'ent-scene' && e.type !== 'scene-link') continue;
    if (xOf.has(e.a) && !xOf.has(e.b)) add(e.b, xOf.get(e.a));
    else if (xOf.has(e.b) && !xOf.has(e.a)) add(e.a, xOf.get(e.b));
  }
  const cats = [];
  const rows = new Map();
  let orphanX = (order && order.length ? (order.length / 2 + 1) * step : 0);
  for (const n of nodes || []) {
    if (out.has(n)) continue;
    const xs = scenesOf.get(n);
    if (n.cat === 'chapter' || n.cat === 'section' || n.cat === 'book') {
      const x = xs && xs.length ? Math.min(...xs) : (orphanX += step);
      out.set(n, { x, y: n.cat === 'chapter' ? -150 : -260, z: 0 });
      continue;
    }
    const x = xs && xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : (orphanX += gap);
    const c = n.cat || '';
    if (!rows.has(c)) { rows.set(c, []); cats.push(c); }
    rows.get(c).push({ n, x });
  }
  cats.forEach((c, ci) => {
    const list = rows.get(c).sort((a, b) => a.x - b.x);
    // กันทับ: เดินจากซ้ายไปขวา ถ้าใกล้กว่า gap ให้ลงไปแถวย่อยถัดไปของหมวด (ไม่ดันออกห่างจากฉากของตัวเอง)
    const lanes = [];
    for (const it of list) {
      let lane = lanes.findIndex((lastX) => it.x - lastX >= gap);
      if (lane < 0) { lane = lanes.length; lanes.push(-Infinity); }
      lanes[lane] = it.x;
      out.set(it.n, { x: Math.round(it.x), y: 170 + ci * 150 + lane * 44, z: 0 });
    }
  });
  return out;
}

/** รอบโหนดที่เลือก — วงแหวนตามระยะห่าง (จำนวนก้าว) · ลำดับบนวงตามมุมของโหนดแม่ (เส้นไม่พันกัน) */
export function layoutRadial(center, nodes, edges, { ringGap = 190 } = {}) {
  const out = new Map();
  if (!center) return out;
  const adj = new Map();
  for (const e of edges || []) {
    if (!e.a || !e.b || e.a === e.b) continue;
    if (!adj.has(e.a)) adj.set(e.a, []); if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a).push(e.b); adj.get(e.b).push(e.a);
  }
  const dist = new Map([[center, 0]]), parent = new Map();
  let q = [center];
  while (q.length) {
    const nx = [];
    for (const n of q) for (const m of adj.get(n) || []) if (!dist.has(m)) { dist.set(m, dist.get(n) + 1); parent.set(m, n); nx.push(m); }
    q = nx;
  }
  const maxD = Math.max(0, ...dist.values());
  const angle = new Map([[center, 0]]);
  out.set(center, { x: 0, y: 0, z: 0 });
  for (let d = 1; d <= maxD + 1; d++) {
    const ring = d <= maxD ? [...dist].filter(([, v]) => v === d).map(([n]) => n)
                           : (nodes || []).filter((n) => !dist.has(n));
    ring.sort((a, b) => (angle.get(parent.get(a)) ?? 0) - (angle.get(parent.get(b)) ?? 0));
    const R = d * ringGap + (ring.length > 12 ? (ring.length - 12) * 6 : 0);
    ring.forEach((n, i) => {
      const a = (i / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
      angle.set(n, a);
      out.set(n, { x: Math.round(Math.cos(a) * R), y: Math.round(Math.sin(a) * R), z: 0 });
    });
  }
  return out;
}
