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
function storeKey(scope) {
  if (!scope) return STORE_PREFIX;
  const s = String(scope).replace(/[\\/]+$/, '').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${STORE_PREFIX}:${(h >>> 0).toString(36)}`;
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
