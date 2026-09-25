// network-insights.js — [alpha.166] ผังความสัมพันธ์ที่ "ใช้งานได้" ไม่ใช่แค่ของประดับ (บริสุทธิ์ 100% · unit `network-insights`)
//
// ผู้ใช้: *"ตอนนี้ graph เหมือนเครื่องประดับมากกว่า เอามาใช้ประโยชน์"*
// ตรรกะทั้งหมดของ: โฟกัสเฉพาะเครือข่ายรอบโหนด · หาเส้นทางระหว่างสองโหนด · ข้อสังเกตของเรื่อง
// (ตัวละครที่ลอยอยู่คนเดียว · ไม่เคยถูกเอ่ยถึงในฉากไหน · ศูนย์กลางของเรื่อง · คู่ที่เจอกันบ่อยแต่ยังไม่มีความสัมพันธ์)
// ตัววาด (network.js) กับแผงข้อมูล (network-inspector.js) อ่านจากที่นี่เท่านั้น
//
import { cmpText } from './locale.js';

// รูปแบบข้อมูล: โหนด = วัตถุใด ๆ ที่มี { name, cat } · เส้น = { a, b, type, role } (a/b = วัตถุโหนดตัวเดียวกัน)

/** ชนิดเส้นที่ไม่ใช่ "ความสัมพันธ์ที่ผู้เขียนกำหนด" (สร้างจากข้อมูลโครงเรื่องเอง) */
export const DERIVED_EDGE_TYPES = new Set(['co-occur', 'scene-link', 'ent-scene']);
export const WIKI_CATS = new Set(['characters', 'locations', 'items', 'lore']);
const STRUCT_CATS = new Set(['scene', 'chapter', 'book', 'section']);

export function isRelationEdge(e) { return !!e && !DERIVED_EDGE_TYPES.has(e.type); }
export function isStructNode(n) { return !!n && STRUCT_CATS.has(n.cat); }

/** ตารางเพื่อนบ้าน: โหนด → [{ node, edge }] (เลือกได้ว่าเอาเส้นชนิดไหน) */
export function adjacency(edges, { filter = null } = {}) {
  const adj = new Map();
  const add = (x, y, e) => { if (!adj.has(x)) adj.set(x, []); adj.get(x).push({ node: y, edge: e }); };
  for (const e of edges || []) {
    if (!e || !e.a || !e.b || e.a === e.b) continue;
    if (filter && !filter(e)) continue;
    add(e.a, e.b, e); add(e.b, e.a, e);
  }
  return adj;
}

/** จำนวนเส้นของแต่ละโหนด */
export function degreeMap(nodes, edges, { filter = null } = {}) {
  const deg = new Map();
  for (const n of nodes || []) deg.set(n, 0);
  for (const e of edges || []) {
    if (!e || !e.a || !e.b || e.a === e.b) continue;
    if (filter && !filter(e)) continue;
    deg.set(e.a, (deg.get(e.a) || 0) + 1);
    deg.set(e.b, (deg.get(e.b) || 0) + 1);
  }
  return deg;
}

/**
 * โหนดที่อยู่ห่างจาก center ไม่เกิน hops ก้าว (รวมตัวมันเอง)
 * @returns {Map<node, number>} โหนด → ระยะ (0 = ตัวมันเอง)
 */
export function egoSet(center, edges, hops = 1, { filter = null } = {}) {
  const dist = new Map();
  if (!center) return dist;
  const adj = adjacency(edges, { filter });
  dist.set(center, 0);
  let frontier = [center];
  for (let h = 1; h <= Math.max(0, hops | 0); h++) {
    const next = [];
    for (const n of frontier) {
      for (const { node } of adj.get(n) || []) {
        if (dist.has(node)) continue;
        dist.set(node, h); next.push(node);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return dist;
}

/**
 * เส้นทางสั้นที่สุดระหว่าง a → b (BFS · นับเป็นจำนวนก้าว)
 * ชนิด "ความสัมพันธ์" ถูกลองก่อน — ไม่เจอค่อยยอมผ่านฉาก/การปรากฏร่วม (เส้นทางที่ผู้เขียนตั้งใจมีความหมายกว่า)
 * @returns {{nodes:any[], edges:any[], viaDerived:boolean}|null}
 */
export function shortestPath(a, b, edges, { allowDerived = true } = {}) {
  if (!a || !b) return null;
  if (a === b) return { nodes: [a], edges: [], viaDerived: false };
  const bfs = (filter) => {
    const adj = adjacency(edges, { filter });
    const prev = new Map([[a, null]]);
    const q = [a];
    while (q.length) {
      const n = q.shift();
      if (n === b) break;
      for (const { node, edge } of adj.get(n) || []) {
        if (prev.has(node)) continue;
        prev.set(node, { from: n, edge });
        q.push(node);
      }
    }
    if (!prev.has(b)) return null;
    const nodes = [b], es = [];
    let cur = b;
    while (prev.get(cur)) { const p = prev.get(cur); es.unshift(p.edge); nodes.unshift(p.from); cur = p.from; }
    return { nodes, edges: es };
  };
  const rel = bfs(isRelationEdge);
  if (rel) return { ...rel, viaDerived: false };
  if (!allowDerived) return null;
  const any = bfs(null);
  return any ? { ...any, viaDerived: true } : null;
}

/** ฉากที่โหนดนี้ถูกเอ่ยถึง (เส้น ent-scene) — เรียงตามลำดับในเรื่อง (ลำดับของโหนดฉากในผัง) */
export function scenesOf(node, edges, nodes) {
  const out = [];
  for (const e of edges || []) {
    if (e.type !== 'ent-scene') continue;
    const o = e.a === node ? e.b : e.b === node ? e.a : null;
    if (o && o.cat === 'scene' && !out.includes(o)) out.push(o);
  }
  if (nodes) { const order = new Map(nodes.map((n, i) => [n, i])); out.sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0)); }
  return out;
}

/** เพื่อนบ้านที่เป็นความสัมพันธ์จริง (ไม่รวมฉาก) — [{ node, edge }] เรียงตามชื่อ */
export function relationsOf(node, edges) {
  const out = [];
  for (const e of edges || []) {
    if (!isRelationEdge(e)) continue;
    if (e.a === node) out.push({ node: e.b, edge: e });
    else if (e.b === node) out.push({ node: e.a, edge: e });
  }
  return out;
}

/** จำนวนฉากที่ปรากฏร่วมกัน (จากป้าย 'co-occur N' ที่ผังสร้าง) */
export function coCount(e) {
  if (!e || e.type !== 'co-occur') return 0;
  if (Number.isFinite(e.count)) return e.count;
  const m = String(e.role || '').match(/(\d+)\s*$/);
  return m ? +m[1] : 0;
}

/**
 * ข้อสังเกตของทั้งเรื่อง — แต่ละรายการคลิกแล้วพาไปที่โหนด/สร้างความสัมพันธ์ได้
 *   isolated     เอนทิตี้ Wiki ที่ไม่มีความสัมพันธ์กับใครเลย
 *   unmentioned  เอนทิตี้ Wiki ที่ไม่เคยถูกเอ่ยถึงในฉากไหน (ผังมีฉากอยู่ด้วยเท่านั้น — ไม่งั้นทุกตัวจะติด)
 *   hubs         ศูนย์กลางของเรื่อง (ความสัมพันธ์ + ฉากที่ปรากฏ) สูงสุด 5 อันดับ
 *   suggestions  คู่ที่ปรากฏร่วมกันหลายฉากแต่ยังไม่มีความสัมพันธ์ที่ผู้เขียนตั้งไว้
 */
export function storyInsights(nodes, edges, { top = 5, minCo = 2 } = {}) {
  const ents = (nodes || []).filter((n) => WIKI_CATS.has(n.cat));
  const hasScenes = (nodes || []).some((n) => n.cat === 'scene');
  const relDeg = degreeMap(ents, edges, { filter: isRelationEdge });
  const sceneDeg = degreeMap(ents, edges, { filter: (e) => e.type === 'ent-scene' });
  const isolated = ents.filter((n) => !relDeg.get(n));
  const unmentioned = hasScenes ? ents.filter((n) => !sceneDeg.get(n)) : [];
  const hubs = ents
    .map((n) => ({ node: n, rel: relDeg.get(n) || 0, scenes: sceneDeg.get(n) || 0 }))
    .filter((x) => x.rel + x.scenes > 0)
    .sort((x, y) => (y.rel * 2 + y.scenes) - (x.rel * 2 + x.scenes) || cmpText(String(x.node.name), String(y.node.name)))
    .slice(0, top);
  const related = new Set();
  const pk = (x, y) => (x.name < y.name ? x.name + '\u0001' + y.name : y.name + '\u0001' + x.name) + '\u0001' + x.cat + y.cat;
  for (const e of edges || []) if (isRelationEdge(e)) { related.add(pk(e.a, e.b)); related.add(pk(e.b, e.a)); }
  const suggestions = [];
  for (const e of edges || []) {
    const c = coCount(e);
    if (c < minCo) continue;
    if (!WIKI_CATS.has(e.a.cat) || !WIKI_CATS.has(e.b.cat)) continue;
    if (related.has(pk(e.a, e.b))) continue;
    suggestions.push({ a: e.a, b: e.b, count: c });
  }
  suggestions.sort((x, y) => y.count - x.count);
  return { isolated, unmentioned, hubs, suggestions: suggestions.slice(0, top * 2) };
}

// ═══════════════════ [alpha.166 · รอบ 2] ไทม์ไลน์เรื่อง — ผังโตตามลำดับฉาก ═══════════════════
// "ถึงฉากที่ N แล้วใครรู้จักใคร" — เห็นตัวละครทยอยเข้าเรื่อง · ความสัมพันธ์เกิดเมื่อทั้งคู่ปรากฏแล้ว

/** ฉากเรียงตามลำดับในเรื่อง (ช่อง `seq` ที่ loadAllEntities ใส่ให้ · ไม่มี = ลำดับในรายการ) */
export function sceneOrder(nodes) {
  const sc = (nodes || []).filter((n) => n && n.cat === 'scene');
  const idx = new Map(sc.map((n, i) => [n, i]));
  return sc.slice().sort((a, b) => (Number.isFinite(a.seq) ? a.seq : idx.get(a)) - (Number.isFinite(b.seq) ? b.seq : idx.get(b)));
}

/**
 * สภาพของผังเมื่ออ่านถึงฉากที่ `upTo` (1 = ฉากแรก · 0 = ยังไม่เริ่ม)
 * @returns {{nodes:Set, edges:Set, current:any, fresh:Set, total:number, firstSeen:Map}}
 *   nodes/edges = ที่ "เกิดขึ้นแล้ว" · current = ฉากล่าสุด · fresh = เอนทิตี้ที่เพิ่งปรากฏครั้งแรกในฉากล่าสุด
 */
export function storyProgress(nodes, edges, upTo) {
  const order = sceneOrder(nodes);
  const total = order.length;
  const k = Math.max(0, Math.min(total, upTo | 0));
  const rank = new Map(order.map((n, i) => [n, i + 1]));
  const seen = new Set(order.slice(0, k));
  const firstSeen = new Map();
  for (const e of edges || []) {
    if (e.type !== 'ent-scene') continue;
    const sc = e.a.cat === 'scene' ? e.a : e.b.cat === 'scene' ? e.b : null;
    const ent = sc === e.a ? e.b : e.a;
    if (!sc || !rank.has(sc)) continue;
    const r = rank.get(sc);
    if (!firstSeen.has(ent) || r < firstSeen.get(ent)) firstSeen.set(ent, r);
  }
  for (const [ent, r] of firstSeen) if (r <= k) seen.add(ent);
  // บท/เล่ม: มีฉากที่ปรากฏแล้วอย่างน้อยหนึ่งฉาก (ผ่านเส้น scene-link สองชั้น)
  for (let pass = 0; pass < 2; pass++) {
    for (const e of edges || []) {
      if (e.type !== 'scene-link') continue;
      // ขึ้นอย่างเดียว (ฉาก → บท → เล่ม) — ห้ามไหลกลับลงไปเปิดฉากอื่นของบทเดียวกัน
      if (seen.has(e.a) && !seen.has(e.b) && e.b.cat !== 'scene') seen.add(e.b);
      else if (seen.has(e.b) && !seen.has(e.a) && e.a.cat !== 'scene') seen.add(e.a);
    }
  }
  const es = new Set();
  for (const e of edges || []) {
    if (!seen.has(e.a) || !seen.has(e.b)) continue;
    if (e.type === 'ent-scene') { const sc = e.a.cat === 'scene' ? e.a : e.b; if ((rank.get(sc) || Infinity) > k) continue; }
    es.add(e);
  }
  const current = k ? order[k - 1] : null;
  const fresh = new Set([...firstSeen].filter(([, r]) => r === k && k > 0).map(([n]) => n));
  return { nodes: seen, edges: es, current, fresh, total, firstSeen };
}

/**
 * [รอบ 2] คู่เอนทิตี้ที่ "ปรากฏร่วม" ≥ min ฉาก — นับจากเส้น ent-scene ตรง ๆ (แหล่งเดียวกับที่ผังวาด)
 * @returns {{a:any, b:any, count:number}[]}
 */
export function coOccurPairs(edges, min = 2) {
  const scenesOf = new Map();
  for (const e of edges || []) {
    if (e.type !== 'ent-scene') continue;
    const sc = e.a.cat === 'scene' ? e.a : e.b, ent = sc === e.a ? e.b : e.a;
    if (!scenesOf.has(ent)) scenesOf.set(ent, new Set());
    scenesOf.get(ent).add(sc);
  }
  const ents = [...scenesOf.keys()], out = [];
  for (let i = 0; i < ents.length; i++) {
    const A = scenesOf.get(ents[i]);
    for (let j = i + 1; j < ents.length; j++) {
      let sh = 0; for (const x of scenesOf.get(ents[j])) if (A.has(x)) sh++;
      if (sh >= min) out.push({ a: ents[i], b: ents[j], count: sh });
    }
  }
  return out;
}
