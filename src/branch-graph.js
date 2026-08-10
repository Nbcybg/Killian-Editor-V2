// branch-graph.js — เอนจินผังแตกสาย (ข้อ 81)
// บริสุทธิ์ล้วน: ไม่แตะ DOM / ไม่แตะ fs → ทดสอบด้วย node ได้ (test/branch.test.cjs)
// branching-ui.js เอาผลลัพธ์ไปวาด SVG · โครงเดียวกับ timeline.js ↔ timeline-ui.js
//
//   scenes[] (จาก scenes.json) ──buildGraph──▶ {nodes, edges}
//                                    ├─layoutGraph──▶ ตำแหน่ง x/y แบบ "ชั้นตามความลึก"
//                                    └─analyzeGraph─▶ จุดเริ่ม/ตอนจบ/วนซ้ำ/ทางตัน/เข้าไม่ถึง

// ---- ขนาดกล่องโหนดบนผัง (px) — UI ใช้ค่าเดียวกันตอนวาด SVG ----
// [alpha.66 ข้อ 5] กล่องใหญ่ขึ้นเพราะตัวหนังสือในผังถูกขยายให้เท่า UI หลัก (เดิม 12.5px เล็กกว่าที่อื่น)
export const NODE_W = 208, NODE_H = 68;
export const GAP_X = 108, GAP_Y = 26, PAD = 30;

// ---------------------------------------------------------------------------
// ทางเลือกที่ "อยู่ในเนื้อเรื่องจริง" (ข้อ 15)
// กติกา: ในไฟล์ .md ของฉาก ถ้าผู้เขียนพิมพ์ [ไปตลาด] = ประกาศว่าตรงนี้คือทางแยก
// เอนจินนี้แค่หา/เทียบ — การเขียนกลับลง scenes.json/.md เป็นหน้าที่ของ UI
// ---------------------------------------------------------------------------

// จับ [ข้อความ] — แต่ต้องไม่ใช่ ![alt](รูป) และไม่ใช่ [ข้อความ](ลิงก์) ของ markdown
const MARKER_SRC = /(!?)\[([^\[\]\n]{1,80})\](\()?/;

/** หา “ทางเลือกในข้อความ” ทั้งหมดของฉาก → [{text, index}] เรียงตามตำแหน่งในไฟล์ */
export function scanChoiceMarkers(text) {
  const out = [];
  if (!text) return out;
  const re = new RegExp(MARKER_SRC.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] === '!') continue;                 // รูปภาพ
    if (m[3] === '(') continue;                 // ลิงก์ markdown
    const t = m[2].trim();
    if (!t) continue;
    if (/^[ x*+-]$/i.test(t)) continue;         // [ ] / [x] = ช่องติ๊ก ไม่ใช่ทางเลือก
    out.push({ text: t, index: m.index + m[1].length });
  }
  return out;
}

/** ข้อความทางเลือกที่ไม่ซ้ำ เรียงตามที่พบในไฟล์ */
export function markerTexts(markers) {
  const seen = new Set();
  const out = [];
  for (const m of markers || []) {
    if (seen.has(m.text)) continue;
    seen.add(m.text); out.push(m.text);
  }
  return out;
}

/**
 * เทียบ “ข้อความในฉาก” กับ “choices ใน scenes.json”
 *   missing = มีในข้อความแล้วแต่ยังไม่เป็นทางเลือก (ควรชวนผู้ใช้ผูก)
 *   orphan  = เป็นทางเลือกอยู่ แต่หาข้อความ [..] ในฉากไม่เจอ (ควรชวนแทรกกลับ)
 */
export function diffChoiceMarkers(markers, choices) {
  const inText = markerTexts(markers);
  const inTextSet = new Set(inText);
  const inData = [];
  const seen = new Set();
  for (const c of choices || []) {
    const t = (c.text || '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t); inData.push(t);
  }
  return {
    missing: inText.filter((t) => !seen.has(t)),
    orphan: inData.filter((t) => !inTextSet.has(t)),
    linked: inData.filter((t) => inTextSet.has(t)),
  };
}

/**
 * แปลงรายการฉากดิบ → กราฟ {nodes, edges, byId}
 * แต่ละ choice ของฉากกลายเป็น edge หนึ่งเส้น (เก็บ idx ไว้เพื่ออ้างกลับไปแก้ scenes.json ได้ตรงตัว)
 */
export function buildGraph(scenes) {
  const nodes = (scenes || []).map((s, order) => ({
    id: s.id,
    order,
    title: s.title || '(ไม่มีชื่อ)',
    chapterName: s.chapterName || '',
    filePath: s.filePath || '',
    dPath: s.dPath || '',
    status: s.status || '',
    color: s.color || '',
    tags: Array.isArray(s.tags) ? s.tags : [],
    // เนื้อฉาก (ถ้า UI อ่านมาให้) — ใช้เทียบว่าทางเลือกไหนมี [ข้อความ] อยู่ในเรื่องจริง (ข้อ 15)
    body: typeof s.body === 'string' ? s.body : '',
    // [alpha.66 ข้อ 4] สีของเส้นทางเลือก เก็บใน scenes.json ติดกับ choice นั้น (ผู้ใช้เลือกเอง)
    choices: (s.choices || []).map((c) => ({
      text: c.text || '', nextSceneId: c.nextSceneId || '', color: c.color || '',
    })),
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [];
  for (const n of nodes) {
    n.choices.forEach((c, idx) => {
      edges.push({
        from: n.id, to: c.nextSceneId || '', text: c.text, idx, color: c.color || '',
        // ปลายทางว่าง หรือชี้ไปฉากที่ถูกลบไปแล้ว = เส้นห้อย (ต้องเตือนผู้ใช้)
        dangling: !c.nextSceneId || !byId.has(c.nextSceneId),
      });
    });
  }
  return { nodes, edges, byId };
}

/** id ของฉากที่ "อยู่ในผัง" = มีทางเลือกของตัวเอง หรือถูกทางเลือกอื่นชี้มา */
export function involvedIds(graph) {
  const set = new Set();
  for (const n of graph.nodes) if (n.choices.length) set.add(n.id);
  for (const e of graph.edges) if (!e.dangling) set.add(e.to);
  return set;
}

// รายการฉากถัดไปของแต่ละฉาก (เฉพาะเส้นที่ไม่ห้อย, ตัดปลายทางซ้ำออก)
function adjacency(graph, ids) {
  const adj = new Map([...ids].map((id) => [id, []]));
  for (const e of graph.edges) {
    if (e.dangling || !ids.has(e.from) || !ids.has(e.to)) continue;
    const list = adj.get(e.from);
    if (!list.includes(e.to)) list.push(e.to);
  }
  return adj;
}

function indegrees(adj) {
  const deg = new Map([...adj.keys()].map((id) => [id, 0]));
  for (const [, outs] of adj) for (const to of outs) deg.set(to, (deg.get(to) || 0) + 1);
  return deg;
}

/**
 * [alpha.66 ข้อ 8+12] ขัดผัง BFS ให้อ่านง่ายขึ้นด้วยแรงอย่างง่าย (force-directed refinement)
 *
 * BFS เปล่า ๆ เรียง y ตาม "ลำดับฉากในไฟล์" เท่านั้น → พอมี 10+ โหนดในชั้นเดียวกัน
 * เส้นเชื่อมจะไขว้กันไปมาจนดูไม่ออกว่าอะไรต่อกับอะไร (โหนดไม่ทับ แต่ "เส้น" ทับปมเต็มไปหมด)
 *
 * ที่นี่ทำสองแรงสลับกันไปเรื่อย ๆ:
 *   1) ดึงเข้าหาค่าเฉลี่ยของเพื่อนบ้าน (barycenter) — ลูกอยู่ใกล้พ่อ เส้นจึงตรงขึ้น ไขว้น้อยลง
 *   2) ผลักออกจากกันในคอลัมน์เดียวกัน — บังคับระยะห่างขั้นต่ำ ไม่ให้กล่อง/ป้ายทับกันเด็ดขาด
 * แรงที่ 2 ทำ "หลัง" เสมอ → ผลลัพธ์สุดท้ายรับประกันว่าไม่ทับ ไม่ว่าแรงที่ 1 จะดึงไปทางไหน
 *
 * โหนดที่ผู้ใช้ลากเอง (pinned) ไม่ถูกขยับและไม่ถูกนับเป็นสิ่งกีดขวาง — ผู้ใช้สั่งไว้แล้ว
 * บริสุทธิ์ล้วน (แก้ค่า y ใน array ที่รับมา) → ทดสอบด้วย node ได้
 *
 * @param {Array} placed โหนดที่มี {id, depth, y}
 * @param {Array} edges  เส้นเชื่อม {from,to,dangling}
 * @returns {Array} placed เดิม (แก้ y แล้ว)
 */
export function refineLayout(placed, edges, opts = {}) {
  const list = (placed || []).filter((p) => !p.pinned);
  if (list.length < 2) return placed;
  const iters = opts.iters ?? 80;
  const minGap = opts.minGap ?? (NODE_H + GAP_Y);
  const byId = new Map((placed || []).map((p) => [p.id, p]));

  // เพื่อนบ้านสองทิศ — ลูกดึงพ่อ พ่อดึงลูก ไม่งั้นชั้นแรกไม่ขยับตามเลย
  const nb = new Map(list.map((p) => [p.id, []]));
  for (const e of edges || []) {
    if (e.dangling) continue;
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b || a === b) continue;
    if (nb.has(a.id)) nb.get(a.id).push(b.id);
    if (nb.has(b.id)) nb.get(b.id).push(a.id);
  }

  const cols = new Map();
  for (const p of list) {
    const c = cols.get(p.depth) || [];
    c.push(p); cols.set(p.depth, c);
  }

  for (let it = 0; it < iters; it++) {
    const damp = 0.55 * (1 - it / iters) + 0.08;      // แรงลดลงเรื่อย ๆ → ผังนิ่ง ไม่แกว่ง
    for (const p of list) {
      const near = nb.get(p.id) || [];
      if (!near.length) continue;
      let sum = 0, n = 0;
      for (const id of near) { const o = byId.get(id); if (o) { sum += o.y; n++; } }
      if (!n) continue;
      p.y += (sum / n - p.y) * damp;
    }
    for (const [, group] of cols) {
      group.sort((a, b) => a.y - b.y);
      for (let i = 1; i < group.length; i++) {
        const need = group[i - 1].y + minGap;
        if (group[i].y < need) group[i].y = need;
      }
    }
  }

  // ดันทั้งผังกลับให้ขอบบนอยู่ที่ PAD (ไม่งั้นลอยติดลบ = โหนดหลุดจอ)
  let minY = Infinity;
  for (const p of list) minY = Math.min(minY, p.y);
  if (Number.isFinite(minY)) for (const p of list) p.y = Math.round(p.y - minY + PAD);
  return placed;
}

/**
 * จัดวางแบบชั้น (layered): ความลึก = ระยะสั้นสุดจากจุดเริ่ม → คอลัมน์ซ้าย→ขวา
 * โหนดที่วนซ้ำจนเข้าไม่ถึงจากจุดเริ่มไหนเลย ถูกวางต่อท้ายเป็นชั้นสุดท้าย (ไม่หายไปจากจอ)
 *
 * opts.positions = {id:{x,y}} ตำแหน่งที่ผู้ใช้ลากเอง (ข้อ 6) — ทับผลอัตโนมัติเสมอ
 * opts.refine=false = ข้ามการขัดผังด้วยแรง (ใช้ตอนอยากได้ผลลัพธ์ BFS ดิบ ๆ)
 * @returns {{placed:Array, width:number, height:number, depths:Map, byId:Map}}
 */
export function layoutGraph(graph, opts = {}) {
  const ids = involvedIds(graph);
  const adj = adjacency(graph, ids);
  const deg = indegrees(adj);

  // จุดเริ่ม = ไม่มีใครชี้มา · เรียงตามลำดับฉากเดิมเพื่อให้ผังนิ่ง (ไม่สลับทุกครั้งที่เปิด)
  const inOrder = graph.nodes.filter((n) => ids.has(n.id)).map((n) => n.id);
  let roots = inOrder.filter((id) => (deg.get(id) || 0) === 0);
  // ทั้งผังเป็นวงกลมล้วน (ทุกโหนดมีคนชี้มา) → หยิบฉากแรกสุดเป็นจุดเริ่มแทน ไม่งั้นจะไม่มีอะไรถูกวาง
  if (!roots.length && inOrder.length) roots = [inOrder[0]];

  // BFS ระยะสั้นสุด — จบเสมอแม้มีวง เพราะ enqueue เฉพาะตอนเจอความลึกครั้งแรก
  const depths = new Map();
  const queue = [];
  for (const r of roots) { depths.set(r, 0); queue.push(r); }
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const d = depths.get(cur);
    for (const to of adj.get(cur) || []) {
      if (depths.has(to)) continue;
      depths.set(to, d + 1);
      queue.push(to);
    }
  }
  // ที่เหลือ (ติดอยู่ในวงที่เข้าไม่ถึง) → ต่อท้ายชั้นสุดท้าย
  const maxD = depths.size ? Math.max(...depths.values()) : 0;
  for (const id of inOrder) if (!depths.has(id)) depths.set(id, maxD + 1);

  // จัดแถวในแต่ละคอลัมน์ตามลำดับฉากเดิม
  const positions = opts.positions || {};
  const rows = new Map();
  const placed = [];
  for (const id of inOrder) {
    const d = depths.get(id);
    const row = rows.get(d) || 0;
    rows.set(d, row + 1);
    const n = graph.byId.get(id);
    const manual = positions[id];
    const pinned = !!(manual && Number.isFinite(manual.x) && Number.isFinite(manual.y));
    placed.push({
      ...n, depth: d, row, pinned,
      x: pinned ? manual.x : PAD + d * (NODE_W + GAP_X),
      y: pinned ? manual.y : PAD + row * (NODE_H + GAP_Y),
    });
  }
  if (opts.refine !== false) refineLayout(placed, graph.edges, opts);

  // ขนาดผังต้องวัดจากตำแหน่งจริงหลังขัด (ไม่งั้นเลื่อนไม่ถึงโหนดที่ถูกดันลงล่าง/ลากออกไปขวา)
  let maxX = 0, maxY = 0;
  for (const p of placed) {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  return {
    placed,
    byId: new Map(placed.map((p) => [p.id, p])),
    depths,
    width: placed.length ? maxX + PAD : 0,
    height: placed.length ? maxY + PAD : 0,
  };
}

/**
 * วิเคราะห์สุขภาพของผัง — ผู้เขียนจะได้เห็นทันทีว่าเรื่องขาดตรงไหน
 * roots      = ฉากเปิดเรื่อง (ไม่มีทางเลือกไหนชี้มา)
 * endings    = ฉากจบ (ไม่มีทางเลือกออก)
 * unreachable= อยู่ในผังแต่เดินจากจุดเริ่มไปไม่ถึง
 * cycles     = ฉากที่อยู่ในวงวนซ้ำ
 * dangling   = ทางเลือกที่ยังไม่ได้ระบุปลายทาง (หรือชี้ไปฉากที่ถูกลบแล้ว)
 */
export function analyzeGraph(graph) {
  const ids = involvedIds(graph);
  const adj = adjacency(graph, ids);
  const deg = indegrees(adj);
  const inOrder = graph.nodes.filter((n) => ids.has(n.id)).map((n) => n.id);

  const roots = inOrder.filter((id) => (deg.get(id) || 0) === 0);
  const endings = inOrder.filter((id) => !(adj.get(id) || []).length);

  // เข้าถึงได้จากจุดเริ่ม (ถ้าไม่มีจุดเริ่มเลย = วงล้วน → ถือว่าเข้าถึงได้หมด ไม่ต้องเตือนซ้ำกับ cycles)
  const seen = new Set(roots);
  const stack = [...roots];
  while (stack.length) {
    const cur = stack.pop();
    for (const to of adj.get(cur) || []) if (!seen.has(to)) { seen.add(to); stack.push(to); }
  }
  const unreachable = roots.length ? inOrder.filter((id) => !seen.has(id)) : [];

  // หาโหนดในวง: DFS สีขาว(0)/เทา(1)/ดำ(2) — เจอขอบชี้กลับไปโหนดเทา = มีวง
  const color = new Map(inOrder.map((id) => [id, 0]));
  const inCycle = new Set();
  for (const start of inOrder) {
    if (color.get(start) !== 0) continue;
    const path = [];                          // เส้นทางปัจจุบัน — ใช้ตัดวงออกมาตอนเจอขอบย้อนกลับ
    const st = [{ id: start, i: 0 }];
    color.set(start, 1); path.push(start);
    while (st.length) {
      const top = st[st.length - 1];
      const outs = adj.get(top.id) || [];
      if (top.i < outs.length) {
        const to = outs[top.i++];
        const c = color.get(to);
        if (c === 1) {                        // ขอบย้อนกลับ → ทุกโหนดตั้งแต่ to ถึงปลายทางคือวง
          const at = path.indexOf(to);
          if (at >= 0) for (let k = at; k < path.length; k++) inCycle.add(path[k]);
        } else if (c === 0) {
          color.set(to, 1); path.push(to); st.push({ id: to, i: 0 });
        }
      } else {
        color.set(top.id, 2); path.pop(); st.pop();
      }
    }
  }

  const dangling = graph.edges.filter((e) => e.dangling);
  return {
    roots, endings, unreachable,
    cycles: [...inCycle],
    dangling,
    total: ids.size,
    choiceCount: graph.edges.length,
  };
}

/**
 * สรุปสั้น ๆ สำหรับแถบสถิติบนหัวผัง
 * @param {object} L ป้ายกำกับตามภาษาที่โหลดอยู่ (ไม่ส่ง = ไทย) — ข้อ 11 (i18n)
 */
export function graphSummary(a, L = {}) {
  const scenes = L.scenes || 'ฉากในผัง', choices = L.choices || 'ทางเลือก';
  const roots = L.roots || 'จุดเริ่ม', endings = L.endings || 'ตอนจบ';
  return `${a.total} ${scenes} · ${a.choiceCount} ${choices} · ${a.roots.length} ${roots} · ${a.endings.length} ${endings}`;
}

/**
 * ไล่ทุกเส้นทางจากจุดเริ่มถึงตอนจบ (ตัดวงด้วยการห้ามซ้ำในเส้นทางเดียวกัน)
 * ใช้แสดง "เส้นทางที่เป็นไปได้" ในแผง inspector — จำกัดจำนวนกันเรื่องใหญ่ระเบิด
 */
export function enumeratePaths(graph, startId, limit = 40) {
  return enumeratePathsInfo(graph, startId, limit).paths;
}

/**
 * [alpha.66 ข้อ 8+13] เหมือน enumeratePaths แต่บอกด้วยว่า "ถูกตัดหรือเปล่า"
 * ของเดิมตัดที่ 12/40 เงียบ ๆ — ผู้ใช้เห็น 12 เส้นแล้วนึกว่าเรื่องมีแค่นั้น
 * เคล็ด: ไล่ให้เกินโควตา 1 เส้น ถ้าได้เกินจริง = ยังมีต่อ (แม่นยำ ไม่เดา)
 * @returns {{paths:Array<Array<string>>, truncated:boolean, limit:number}}
 */
export function enumeratePathsInfo(graph, startId, limit = 40) {
  const ids = involvedIds(graph);
  const adj = adjacency(graph, ids);
  if (!ids.has(startId)) return { paths: [], truncated: false, limit };
  const cap = Math.max(1, limit) + 1;
  const out = [];
  const walk = (id, path) => {
    if (out.length >= cap) return;
    const next = (adj.get(id) || []).filter((t) => !path.includes(t));
    if (!next.length) { out.push([...path]); return; }
    for (const t of next) { walk(t, [...path, t]); if (out.length >= cap) return; }
  };
  walk(startId, [startId]);
  const truncated = out.length > limit;
  return { paths: truncated ? out.slice(0, limit) : out, truncated, limit };
}

// ---------------------------------------------------------------------------
// [alpha.66 ข้อ 14] ตรวจทางเลือกที่ชี้ไปฉากที่ไม่มีอยู่จริง (เรียกตอนเปิดโปรเจกต์)
// ทำงานกับ "รายการฉากดิบ" ไม่ใช่กราฟ — จะได้เรียกได้โดยไม่ต้องสร้างกราฟทั้งผังก่อน
// ---------------------------------------------------------------------------
/**
 * @returns {Array<{sceneId,sceneTitle,idx,text,nextSceneId,reason:'empty'|'missing'}>}
 *   empty   = ยังไม่ได้ระบุปลายทาง (ผู้เขียนยังคิดไม่ออก — ไม่ใช่ความผิดพลาด)
 *   missing = ชี้ไปฉากที่ถูกลบ/ย้ายไปแล้ว (นี่คือของเสีย ต้องเตือน)
 */
export function validateChoices(scenes) {
  const list = scenes || [];
  const ids = new Set(list.map((s) => s && s.id).filter(Boolean));
  const out = [];
  for (const s of list) {
    if (!s) continue;
    (s.choices || []).forEach((c, idx) => {
      const next = (c && c.nextSceneId) || '';
      const row = { sceneId: s.id, sceneTitle: s.title || '', idx, text: (c && c.text) || '', nextSceneId: next };
      if (!next) out.push({ ...row, reason: 'empty' });
      else if (!ids.has(next)) out.push({ ...row, reason: 'missing' });
    });
  }
  return out;
}
/** เฉพาะที่ "พัง" จริง (ชี้ไปฉากที่ไม่มีแล้ว) — ที่ยังไม่ระบุปลายทางไม่นับ */
export function danglingChoices(scenes) {
  return validateChoices(scenes).filter((d) => d.reason === 'missing');
}

// ---------------------------------------------------------------------------
// [alpha.66 ข้อ 15] เส้นทางจากจุดเริ่ม → โหนดที่เลือก (ไว้ไฮไลต์บนผัง)
// ---------------------------------------------------------------------------
/** คีย์ของเส้นเชื่อม (ใช้ตรงกันทั้งที่นี่และตอนวาด SVG) */
export const edgeKey = (from, to) => from + '\u0000' + to;

/**
 * BFS จากทุกจุดเริ่ม → โหนดที่เลือก แล้วคืน "เส้นทางสั้นที่สุด"
 * @returns {{path:string[], nodes:Set<string>, edges:Set<string>}}
 */
export function highlightPath(graph, selectedId) {
  const empty = { path: [], nodes: new Set(), edges: new Set() };
  if (!graph || !selectedId) return empty;
  const ids = involvedIds(graph);
  if (!ids.has(selectedId)) return empty;
  const adj = adjacency(graph, ids);
  const deg = indegrees(adj);
  const inOrder = graph.nodes.filter((n) => ids.has(n.id)).map((n) => n.id);
  let roots = inOrder.filter((id) => (deg.get(id) || 0) === 0);
  if (!roots.length && inOrder.length) roots = [inOrder[0]];   // ผังวงล้วน → ยึดฉากแรก

  const prev = new Map();
  const seen = new Set(roots);
  const queue = [...roots];
  for (let qi = 0; qi < queue.length && !seen.has(selectedId); qi++) {
    for (const to of adj.get(queue[qi]) || []) {
      if (seen.has(to)) continue;
      seen.add(to); prev.set(to, queue[qi]); queue.push(to);
    }
  }
  if (!seen.has(selectedId)) return empty;
  const path = [selectedId];
  let cur = selectedId;
  while (prev.has(cur)) { cur = prev.get(cur); path.unshift(cur); }
  const edges = new Set();
  for (let i = 1; i < path.length; i++) edges.add(edgeKey(path[i - 1], path[i]));
  return { path, nodes: new Set(path), edges };
}

// ---------------------------------------------------------------------------
// [alpha.66 ข้อ 16] รวมทางเลือกที่ซ้ำกัน
// ---------------------------------------------------------------------------
/**
 * ยุบทางเลือกข้อความเดียวกันเข้าด้วยกัน — แต่ **เฉพาะเมื่อปลายทางไปกันได้**
 * (ข้อความเดียวกันแต่ไปคนละฉาก = ทางแยกจริงของผู้เขียน ห้ามยุบทิ้ง)
 * ตัวที่ยังไม่ระบุปลายทางถูกกลืนเข้ากับตัวที่ระบุแล้ว — นี่คือกรณีที่เกิดบ่อยสุด
 * (สแกน [ข้อความ] ซ้ำหลายรอบ แล้วได้ทางเลือกเปล่าซ้อนของเดิม)
 * @returns {{list:Array, removed:number}}
 */
export function mergeDuplicateChoices(choices) {
  const out = [];
  let removed = 0;
  for (const c of choices || []) {
    const text = (c.text || '').trim();
    const next = c.nextSceneId || '';
    const at = out.findIndex((o) => o.text === text
      && (!o.nextSceneId || !next || o.nextSceneId === next));
    if (at < 0) { out.push({ ...c, text, nextSceneId: next }); continue; }
    removed++;
    if (!out[at].nextSceneId && next) out[at].nextSceneId = next;
    if (!out[at].color && c.color) out[at].color = c.color;
  }
  return { list: out, removed };
}
/** จำนวนทางเลือกซ้ำทั้งผัง — ใช้บอกว่าปุ่ม "รวมทางเลือกซ้ำ" มีอะไรให้ทำไหม */
export function countDuplicateChoices(graph) {
  let n = 0;
  for (const node of (graph && graph.nodes) || []) n += mergeDuplicateChoices(node.choices).removed;
  return n;
}

// ---------------------------------------------------------------------------
// [alpha.66 ข้อ 17] ค้นหา/กรองในผัง — คืน id ที่ตรง (UI เอาไปเน้น แล้วจาง ๆ ที่เหลือ)
// ---------------------------------------------------------------------------
export function filterNodes(graph, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;                     // null = ไม่ได้กรอง (ต่างจาก Set ว่าง = ไม่เจออะไรเลย)
  const hit = new Set();
  for (const n of (graph && graph.nodes) || []) {
    const hay = [n.title, n.chapterName, n.status, ...(n.tags || []),
                 ...n.choices.map((c) => c.text)].join(' ').toLowerCase();
    if (hay.includes(q)) hit.add(n.id);
  }
  return hit;
}
/** ขยายผลค้นหาให้รวม "เพื่อนบ้านตรงข้างเดียว" ด้วย → เห็นบริบทว่าฉากที่เจอต่อกับอะไร */
export function expandWithNeighbors(graph, hit) {
  if (!hit) return null;
  const out = new Set(hit);
  for (const e of (graph && graph.edges) || []) {
    if (e.dangling) continue;
    if (hit.has(e.from)) out.add(e.to);
    if (hit.has(e.to)) out.add(e.from);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [alpha.66 ข้อ 7+10] ส่งออกผังแตกสาย — HTML tree · JSON · Markdown outline
// ทั้งหมดบริสุทธิ์ (คืนสตริง) → UI แค่เอาไปเขียนไฟล์ · ทดสอบด้วย node ได้
// ---------------------------------------------------------------------------
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** จุดเริ่มที่ใช้ไล่ผังตอนส่งออก (ไม่มีจุดเริ่มเลย = ผังวงล้วน → ยึดฉากแรกไม่ให้ไฟล์ว่างเปล่า) */
export function exportRoots(graph, analysis) {
  const a = analysis || analyzeGraph(graph);
  if (a.roots.length) return a.roots;
  const ids = involvedIds(graph);
  const first = graph.nodes.find((n) => ids.has(n.id));
  return first ? [first.id] : [];
}

/** ตัดเนื้อฉากให้สั้นพอเป็น "เนื้อย่อ" (ทิ้งเครื่องหมาย markdown ที่รกตา) */
export function bodyExcerpt(body, max = 180) {
  const s = String(body || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Markdown outline แบบขีดเส้น — เปิดในโปรแกรมอะไรก็อ่านรู้เรื่อง
 *   ▶ เริ่มเรื่อง
 *     ├── [เปิดประตู] → ห้องมืด
 *     │   └── [เดินต่อ] → ตอนจบ
 *     └── [หนี] → ทางตัน
 */
export function graphToOutline(graph, opts = {}) {
  const L = opts.labels || {};
  const openTxt = L.open || '(ยังไม่ระบุปลายทาง)';
  const goneTxt = L.gone || 'ฉากหาย';
  const loopTxt = L.loop || 'วนกลับ';
  const titleOf = (id) => (graph.byId.get(id) || {}).title || '?';
  const lines = [];
  const walk = (id, prefix, stack) => {
    const node = graph.byId.get(id);
    const cs = (node && node.choices) || [];
    cs.forEach((c, i) => {
      const last = i === cs.length - 1;
      const target = c.nextSceneId ? graph.byId.get(c.nextSceneId) : null;
      const looped = target && stack.includes(c.nextSceneId);
      let tail;
      if (!c.nextSceneId) tail = openTxt;
      else if (!target) tail = `(${goneTxt}: ${c.nextSceneId})`;
      else tail = titleOf(c.nextSceneId) + (looped ? ` ↩ ${loopTxt}` : '');
      lines.push(`${prefix}${last ? '└── ' : '├── '}[${c.text || '—'}] → ${tail}`);
      if (target && !looped) walk(c.nextSceneId, prefix + (last ? '    ' : '│   '), [...stack, c.nextSceneId]);
    });
  };
  for (const r of exportRoots(graph, opts.analysis)) {
    lines.push('▶ ' + titleOf(r));
    walk(r, '  ', [r]);
    lines.push('');
  }
  const head = opts.title ? `# ${opts.title}\n\n` : '';
  return head + lines.join('\n').replace(/\n+$/, '') + '\n';
}

/** โครงสร้างล้วน ๆ สำหรับเอาไปเข้าเครื่องมืออื่น (Twine/Ink/สคริปต์ของตัวเอง) */
export function graphToJson(graph, opts = {}) {
  const a = opts.analysis || analyzeGraph(graph);
  const ids = involvedIds(graph);
  return {
    format: 'killian-branching',
    version: 1,
    title: opts.title || '',
    exportedAt: opts.now || '',
    stats: {
      scenes: a.total, choices: a.choiceCount, roots: a.roots.length,
      endings: a.endings.length, cycles: a.cycles.length, dangling: a.dangling.length,
    },
    roots: a.roots,
    endings: a.endings,
    scenes: graph.nodes.filter((n) => ids.has(n.id)).map((n) => ({
      id: n.id,
      title: n.title,
      chapter: n.chapterName || '',
      status: n.status || '',
      color: n.color || '',
      tags: n.tags || [],
      excerpt: bodyExcerpt(n.body, opts.excerpt ?? 180),
      choices: n.choices.map((c) => ({
        text: c.text, next: c.nextSceneId || null, color: c.color || '',
      })),
    })),
  };
}

const TREE_CSS = `
:root{color-scheme:light dark}
body{font:15px/1.7 -apple-system,"Segoe UI",Tahoma,"Sarabun",sans-serif;margin:0;padding:28px;
  background:#fbfaf7;color:#2c2a26}
h1{font-size:1.5em;margin:0 0 4px}
.stats{color:#78746b;font-size:.85em;margin-bottom:20px}
ul{list-style:none;margin:0;padding-left:22px;border-left:1px dashed #cfcabc}
:scope>ul,body>ul{padding-left:0;border:none}
li{margin:6px 0}
details>summary{cursor:pointer;list-style:none}
details>summary::-webkit-details-marker{display:none}
.scene{display:inline-block;border:1px solid #d8d3c6;border-left:4px solid #9a958a;
  border-radius:8px;padding:5px 11px;background:#fff}
.scene:hover{border-color:#d97757}
.scene .t{font-weight:600}
.scene .c{color:#8a857a;font-size:.82em;margin-left:8px}
.choice{color:#c2653f;font-weight:600}
.open{color:#a9a49a;font-style:italic}
.loop{color:#c2653f;font-size:.85em}
.excerpt{color:#6d6960;font-size:.88em;margin:4px 0 2px 12px;max-width:56em;
  border-left:2px solid #e2ddd0;padding-left:10px;white-space:pre-wrap}
.badge{font-size:.72em;padding:1px 7px;border-radius:999px;margin-left:6px;vertical-align:middle}
.b-root{background:#e4f0e4;color:#3f7a3f}
.b-end{background:#e2edf7;color:#3d6f9c}
@media print{body{background:#fff}.scene{background:#fff}}
@media (prefers-color-scheme:dark){
  body{background:#17181b;color:#e6e3db}ul{border-color:#3a3c42}
  .scene{background:#212328;border-color:#3a3c42}.scene .c{color:#8f8b82}
  .excerpt{color:#a8a49b;border-color:#3a3c42}
  .b-root{background:#23361f;color:#8bc48b}.b-end{background:#1e2c3b;color:#8fb8e0}}
`;

/**
 * ผังแตกสายเป็นหน้า HTML เดี่ยว ๆ — เปิดเบราว์เซอร์อ่านได้ทันที ส่งให้ทีมดู/พิมพ์ได้
 * ทุกฉากเป็น <details> พับได้ · เนื้อย่อขึ้นเมื่อกาง · ไม่มีไฟล์แนบ ไม่มีสคริปต์
 */
export function graphToHtmlTree(graph, opts = {}) {
  const a = opts.analysis || analyzeGraph(graph);
  const L = opts.labels || {};
  const rootSet = new Set(a.roots), endSet = new Set(a.endings);
  const title = opts.title || (L.title || 'ผังแตกสาย');
  const openTxt = L.open || 'ยังไม่ระบุปลายทาง';
  const goneTxt = L.gone || 'ฉากหาย';
  const loopTxt = L.loop || 'วนกลับ';
  const showBody = opts.excerpt !== false;

  const sceneLine = (n) => {
    const badge = rootSet.has(n.id) ? `<span class="badge b-root">▶ ${esc(L.root || 'จุดเริ่ม')}</span>`
      : endSet.has(n.id) ? `<span class="badge b-end">🏁 ${esc(L.ending || 'ตอนจบ')}</span>` : '';
    const style = n.color ? ` style="border-left-color:${esc(n.color)}"` : '';
    return `<span class="scene"${style}><span class="t">${esc(n.title)}</span>`
      + (n.chapterName ? `<span class="c">${esc(n.chapterName)}</span>` : '') + `</span>${badge}`;
  };

  const walk = (id, stack, depth) => {
    const n = graph.byId.get(id);
    if (!n) return '';
    const ex = showBody ? bodyExcerpt(n.body, opts.excerptLen ?? 260) : '';
    const kids = n.choices.map((c) => {
      const target = c.nextSceneId ? graph.byId.get(c.nextSceneId) : null;
      const looped = target && stack.includes(c.nextSceneId);
      const cstyle = c.color ? ` style="color:${esc(c.color)}"` : '';
      const label = `<span class="choice"${cstyle}>[${esc(c.text || '—')}]</span> →`;
      if (!c.nextSceneId) return `<li>${label} <span class="open">${esc(openTxt)}</span></li>`;
      if (!target) return `<li>${label} <span class="open">(${esc(goneTxt)}: ${esc(c.nextSceneId)})</span></li>`;
      if (looped) return `<li>${label} ${sceneLine(target)} <span class="loop">↩ ${esc(loopTxt)}</span></li>`;
      return `<li>${label} ${walk(c.nextSceneId, [...stack, c.nextSceneId], depth + 1)}</li>`;
    }).join('\n');
    const inner = (ex ? `<div class="excerpt">${esc(ex)}</div>` : '') + (kids ? `<ul>\n${kids}\n</ul>` : '');
    if (!inner) return sceneLine(n);
    return `<details open><summary>${sceneLine(n)}</summary>\n${inner}\n</details>`;
  };

  const body = exportRoots(graph, a).map((r) => `<ul><li>${walk(r, [r], 0)}</li></ul>`).join('\n');
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${TREE_CSS}</style></head>
<body>
<h1>${esc(title)}</h1>
<div class="stats">${esc(graphSummary(a, L))}</div>
${body || '<p class="open">' + esc(L.empty || 'ยังไม่มีฉากที่มีทางเลือก') + '</p>'}
</body></html>`;
}
