// test/branch.test.cjs — ทดสอบ branch-graph (เอนจินผังแตกสาย ข้อ 81) ด้วย node
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = require('path').join(require('os').tmpdir(), '_bg.cjs');   // '/tmp' ใช้บน Windows ไม่ได้
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/branch-graph.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const BG = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ฉากทดสอบ: a →(เปิดประตู) b →(หนี) d · a →(หนี) c · c ไม่มีทางเลือก
const scenes = [
  { id: 'a', title: 'เริ่มเรื่อง', chapterName: 'บท 1',
    choices: [{ text: 'เปิดประตู', nextSceneId: 'b' }, { text: 'หนี', nextSceneId: 'c' }] },
  { id: 'b', title: 'ห้องมืด', chapterName: 'บท 1', choices: [{ text: 'เดินต่อ', nextSceneId: 'd' }] },
  { id: 'c', title: 'ทางตัน', chapterName: 'บท 1' },
  { id: 'd', title: 'ตอนจบ', chapterName: 'บท 2' },
  { id: 'z', title: 'ฉากธรรมดา (ไม่อยู่ในผัง)', chapterName: 'บท 2' },
];

// ── buildGraph ──
const g = BG.buildGraph(scenes);
check('buildGraph นับโหนดครบทุกฉาก', g.nodes.length === 5, String(g.nodes.length));
check('buildGraph สร้าง edge ต่อ 1 choice', g.edges.length === 3, String(g.edges.length));
check('edge เก็บ idx อ้างกลับ scenes.json ได้', g.edges[1].from === 'a' && g.edges[1].idx === 1, JSON.stringify(g.edges[1]));
check('ฉากที่ไม่มี choices → choices เป็น []', g.byId.get('c').choices.length === 0);

// ── involvedIds: เฉพาะฉากที่อยู่ในผังจริง ──
const inv = BG.involvedIds(g);
check('ฉากที่ไม่มีใครชี้และไม่มีทางเลือก ไม่อยู่ในผัง', !inv.has('z'));
check('ฉากปลายทางถูกนับเข้าผังแม้ไม่มีทางเลือกเอง', inv.has('d') && inv.has('c'));
check('ผังมี 4 ฉาก', inv.size === 4, String(inv.size));

// ── layoutGraph: จัดชั้นตามความลึก ──
const L = BG.layoutGraph(g);
check('layout วางเฉพาะฉากในผัง', L.placed.length === 4, String(L.placed.length));
check('จุดเริ่มอยู่คอลัมน์ 0', L.depths.get('a') === 0);
check('ฉากถัดจากจุดเริ่ม อยู่คอลัมน์ 1', L.depths.get('b') === 1 && L.depths.get('c') === 1);
check('ฉากลึกสุดอยู่คอลัมน์ 2', L.depths.get('d') === 2, String(L.depths.get('d')));
check('x เพิ่มตามความลึก', L.byId.get('b').x > L.byId.get('a').x);
check('โหนดคอลัมน์เดียวกันไม่ทับกัน (y ต่างกัน)', L.byId.get('b').y !== L.byId.get('c').y);
check('ขนาดผังครอบทุกโหนด', L.width >= BG.PAD * 2 + BG.NODE_W * 3 && L.height > 0, `${L.width}x${L.height}`);

// ── analyzeGraph ──
const a = BG.analyzeGraph(g);
check('หาจุดเริ่มเจอ', a.roots.join() === 'a', a.roots.join());
check('หาตอนจบเจอ (c และ d ไม่มีทางออก)', a.endings.sort().join() === 'c,d', a.endings.join());
check('ไม่มีฉากเข้าไม่ถึง', a.unreachable.length === 0, a.unreachable.join());
check('ไม่มีวงวนซ้ำ', a.cycles.length === 0);
check('ไม่มีทางเลือกห้อย', a.dangling.length === 0);
check('graphSummary บอกจำนวนถูก', BG.graphSummary(a).includes('4 ฉากในผัง') && BG.graphSummary(a).includes('3 ทางเลือก'), BG.graphSummary(a));

// ── ทางเลือกห้อย: ไม่ระบุปลายทาง + ชี้ไปฉากที่ถูกลบ ──
const g2 = BG.buildGraph([
  { id: 'a', title: 'A', choices: [{ text: 'ยังไม่คิด', nextSceneId: '' }, { text: 'ไปฉากผี', nextSceneId: 'ghost' }] },
]);
const a2 = BG.analyzeGraph(g2);
check('ทางเลือกไม่ระบุปลายทาง = dangling', a2.dangling.length === 2, String(a2.dangling.length));
check('edge ที่ปลายทางหายถูกทำเครื่องหมาย dangling', g2.edges.every((e) => e.dangling));
check('dangling ไม่ทำให้ layout พัง', BG.layoutGraph(g2).placed.length === 1);

// ── วงวนซ้ำ: a→b→c→a ──
const gc = BG.buildGraph([
  { id: 'a', title: 'A', choices: [{ text: 'x', nextSceneId: 'b' }] },
  { id: 'b', title: 'B', choices: [{ text: 'x', nextSceneId: 'c' }] },
  { id: 'c', title: 'C', choices: [{ text: 'ย้อนกลับ', nextSceneId: 'a' }] },
]);
const ac = BG.analyzeGraph(gc);
check('ตรวจเจอวงวนซ้ำครบทุกโหนดในวง', ac.cycles.sort().join() === 'a,b,c', ac.cycles.join());
check('วงล้วน = ไม่มีจุดเริ่ม', ac.roots.length === 0);
check('วงล้วนไม่ถูกรายงานว่าเข้าไม่ถึง (ไม่เตือนซ้ำ)', ac.unreachable.length === 0);
check('วงล้วนยังวางผังได้ (ไม่หายจากจอ)', BG.layoutGraph(gc).placed.length === 3);

// ── ฉากที่เข้าไม่ถึง: มีจุดเริ่ม a แต่ b→c วนกันเองอยู่ต่างหาก ──
const gu = BG.buildGraph([
  { id: 'a', title: 'A', choices: [{ text: 'x', nextSceneId: 'd' }] },
  { id: 'd', title: 'D' },
  { id: 'b', title: 'B', choices: [{ text: 'x', nextSceneId: 'c' }] },
  { id: 'c', title: 'C', choices: [{ text: 'x', nextSceneId: 'b' }] },
]);
const au = BG.analyzeGraph(gu);
check('ตรวจเจอฉากที่เดินจากจุดเริ่มไปไม่ถึง', au.unreachable.sort().join() === 'b,c', au.unreachable.join());
check('โหนดที่เข้าไม่ถึงยังถูกวางบนผัง', BG.layoutGraph(gu).placed.length === 4);

// ── enumeratePaths ──
const paths = BG.enumeratePaths(g, 'a');
check('ไล่เส้นทางจากจุดเริ่มได้ 2 สาย', paths.length === 2, JSON.stringify(paths));
check('เส้นทางยาวสุดคือ a→b→d', paths.some((p) => p.join('>') === 'a>b>d'), JSON.stringify(paths));
check('เส้นทางในวงไม่วนไม่รู้จบ', BG.enumeratePaths(gc, 'a').length >= 1 && BG.enumeratePaths(gc, 'a')[0].length === 3);
check('limit จำกัดจำนวนเส้นทาง', BG.enumeratePaths(g, 'a', 1).length === 1);
check('ฉากนอกผัง → ไม่มีเส้นทาง', BG.enumeratePaths(g, 'z').length === 0);

// ── กรณีว่าง: ต้องไม่ throw ──
const ge = BG.buildGraph([]);
check('โปรเจกต์ว่างไม่พัง', BG.layoutGraph(ge).placed.length === 0 && BG.analyzeGraph(ge).total === 0);
check('ขนาดผังว่าง = 0', BG.layoutGraph(ge).width === 0 && BG.layoutGraph(ge).height === 0);
check('buildGraph รับ undefined ได้', BG.buildGraph(undefined).nodes.length === 0);

// ── ข้อ 15: ทางเลือกที่เขียนไว้ในเนื้อฉากจริง — [ไปตลาด] ──
{
  const body = 'เขายืนอยู่หน้าทางแยก\n\n[ไปตลาด] หรือจะ [กลับบ้าน]\n' +
               '![ภาพประกอบ](../Images/a.png)\n' +
               'อ่านเพิ่มที่ [เว็บนี้](https://x.dev)\n' +
               '- [ ] ยังไม่ทำ\n- [x] ทำแล้ว\n' +
               'ย้ำอีกที [ไปตลาด]\n';
  const mk = BG.scanChoiceMarkers(body);
  const texts = BG.markerTexts(mk);
  check('สแกนเจอ [ข้อความ] ทางเลือกในเนื้อฉาก', texts.join('|') === 'ไปตลาด|กลับบ้าน', texts.join('|'));
  check('ไม่นับ ![alt](รูป) เป็นทางเลือก', !texts.includes('ภาพประกอบ'));
  check('ไม่นับ [ข้อความ](ลิงก์) ของ markdown', !texts.includes('เว็บนี้'));
  check('ไม่นับช่องติ๊ก [ ] และ [x]', !texts.includes('x') && !texts.includes(''));
  check('ข้อความซ้ำถูกยุบเหลือรายการเดียว', texts.length === 2, String(texts.length));
  check('marker เก็บตำแหน่งในไฟล์ (เรียงตามที่พบ)',
        mk.length === 3 && mk[0].index < mk[1].index && mk[1].index < mk[2].index,
        JSON.stringify(mk.map((m) => m.index)));

  const d = BG.diffChoiceMarkers(mk, [{ text: 'ไปตลาด', nextSceneId: 'b' }, { text: 'ปีนกำแพง' }]);
  check('missing = มีในข้อความแต่ยังไม่เป็นทางเลือก', d.missing.join() === 'กลับบ้าน', d.missing.join());
  check('orphan = เป็นทางเลือกแต่ไม่มีข้อความในฉาก', d.orphan.join() === 'ปีนกำแพง', d.orphan.join());
  check('linked = ผูกกันเรียบร้อยแล้ว', d.linked.join() === 'ไปตลาด', d.linked.join());

  check('ฉากว่าง/undefined ไม่พัง',
        BG.scanChoiceMarkers('').length === 0 && BG.scanChoiceMarkers(undefined).length === 0);
  check('diff กับ choices ที่ไม่มี ไม่พัง', BG.diffChoiceMarkers([], undefined).missing.length === 0);
  check('วงเล็บว่าง [] ไม่ถูกนับ', BG.scanChoiceMarkers('ข้อความ [] ต่อ').length === 0);
  check('buildGraph เก็บ body ไว้ให้ UI เทียบได้',
        BG.buildGraph([{ id: 'a', body: 'x [ไปตลาด]' }]).byId.get('a').body === 'x [ไปตลาด]');
}

// ── layout ต้องไม่วางกล่องทับกัน แม้ทุกฉากอยู่ชั้นเดียวกัน ──
{
  const wide = BG.buildGraph([
    { id: 'r', title: 'ราก', choices: ['a', 'b', 'c', 'd'].map((t) => ({ text: t, nextSceneId: t })) },
    ...['a', 'b', 'c', 'd'].map((id) => ({ id, title: id })),
  ]);
  const lay = BG.layoutGraph(wide);
  const seen = new Set(lay.placed.map((p) => p.x + ':' + p.y));
  check('โหนดชั้นเดียวกันไม่ทับกัน (พิกัดไม่ซ้ำ)', seen.size === lay.placed.length,
        `${seen.size}/${lay.placed.length}`);
  check('ความสูงผังครอบคลุมทุกแถว',
        lay.height >= Math.max(...lay.placed.map((p) => p.y)) + BG.NODE_H, String(lay.height));
  check('ความกว้างผังครอบคลุมทุกคอลัมน์',
        lay.width >= Math.max(...lay.placed.map((p) => p.x)) + BG.NODE_W, String(lay.width));
}

// ═══════════════ alpha.66 — ยกเครื่องระบบแตกสาย ═══════════════

// ── ข้อ 8+12: force-directed refinement หลัง BFS ──
{
  // 12 โหนดในชั้นเดียวกัน — ของเดิม BFS เรียง y ตามลำดับไฟล์เฉย ๆ
  const many = ['n0','n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11'];
  const g8 = BG.buildGraph([
    { id: 'r', title: 'ราก', choices: many.map((t) => ({ text: t, nextSceneId: t })) },
    ...many.map((id) => ({ id, title: id })),
  ]);
  const L8 = BG.layoutGraph(g8);
  const col1 = L8.placed.filter((p) => p.depth === 1).sort((a, b) => a.y - b.y);
  let minSep = Infinity;
  for (let i = 1; i < col1.length; i++) minSep = Math.min(minSep, col1[i].y - col1[i - 1].y);
  check('12 โหนดชั้นเดียวกัน: ระยะห่างไม่น้อยกว่าความสูงกล่อง (ไม่ทับกัน)',
        minSep >= BG.NODE_H, String(minSep));
  check('ผังสูงพอครอบทุกโหนดหลังขัดด้วยแรง',
        L8.height >= Math.max(...L8.placed.map((p) => p.y)) + BG.NODE_H, String(L8.height));
  check('รากถูกดึงมาอยู่กลาง ๆ ของลูก (barycenter)', (() => {
    const r = L8.byId.get('r');
    const ys = col1.map((p) => p.y);
    return r.y > ys[0] && r.y < ys[ys.length - 1];
  })(), String(L8.byId.get('r').y));

  // refineLayout เรียกตรง ๆ ได้ (บริสุทธิ์)
  const raw = BG.layoutGraph(g8, { refine: false });
  const rawCol = raw.placed.filter((p) => p.depth === 1).map((p) => p.y);
  check('refine:false = ได้ผล BFS ดิบ (y เรียงตามลำดับฉาก)',
        rawCol.every((y, i) => i === 0 || y > rawCol[i - 1]));
  check('refineLayout เป็นฟังก์ชันบริสุทธิ์ เรียกแยกได้',
        typeof BG.refineLayout === 'function'
        && BG.refineLayout([{ id: 'x', depth: 0, y: 0 }], []).length === 1);
}

// ── ข้อ 6: ตำแหน่งที่ผู้ใช้ลากเอง ต้องชนะการจัดวางอัตโนมัติ ──
{
  const L = BG.layoutGraph(g, { positions: { b: { x: 999, y: 777 } } });
  const b = L.byId.get('b');
  check('โหนดที่ลากเองอยู่ตรงตำแหน่งที่ลากเป๊ะ', b.x === 999 && b.y === 777, `${b.x},${b.y}`);
  check('โหนดที่ลากเองถูกทำเครื่องหมาย pinned', b.pinned === true);
  check('ผังกว้าง/สูงพอครอบโหนดที่ถูกลากออกไปไกล',
        L.width >= 999 + BG.NODE_W && L.height >= 777 + BG.NODE_H, `${L.width}x${L.height}`);
  check('โหนดอื่นยังถูกจัดวางอัตโนมัติตามเดิม', L.byId.get('a').pinned === false);
}

// ── ข้อ 8+13: enumeratePaths ต้องบอกได้ว่าถูกตัด ──
{
  const info = BG.enumeratePathsInfo(g, 'a', 1);
  check('ถูกตัด → truncated = true', info.truncated === true && info.paths.length === 1);
  const full = BG.enumeratePathsInfo(g, 'a', 40);
  check('ไม่ถูกตัด → truncated = false', full.truncated === false && full.paths.length === 2);
  check('ตัดพอดีขอบเขต ไม่รายงานผิดว่าถูกตัด',
        BG.enumeratePathsInfo(g, 'a', 2).truncated === false);
  check('enumeratePaths เดิมยังใช้ได้เหมือนเดิม', BG.enumeratePaths(g, 'a').length === 2);
}

// ── ข้อ 14: ตรวจทางเลือกที่ชี้ไปฉากที่ไม่มีอยู่จริง ──
{
  const bad = [
    { id: 'a', title: 'A', choices: [{ text: 'ไปผี', nextSceneId: 'ghost' }, { text: 'ยังไม่คิด', nextSceneId: '' }] },
    { id: 'b', title: 'B', choices: [{ text: 'ไป A', nextSceneId: 'a' }] },
  ];
  const v = BG.validateChoices(bad);
  check('validateChoices เจอทั้งชี้ผิดและยังไม่ระบุ', v.length === 2, String(v.length));
  check('แยกสาเหตุถูก (missing vs empty)',
        v.find((x) => x.nextSceneId === 'ghost').reason === 'missing'
        && v.find((x) => !x.nextSceneId).reason === 'empty');
  check('รายงานพอให้ผู้ใช้ตามไปแก้ได้ (ชื่อฉาก + ลำดับทางเลือก)',
        v[0].sceneTitle === 'A' && v[0].idx === 0 && v[0].text === 'ไปผี');
  check('danglingChoices = เฉพาะที่พังจริง',
        BG.danglingChoices(bad).length === 1 && BG.danglingChoices(bad)[0].reason === 'missing');
  check('ทางเลือกครบถ้วน → ไม่มีรายงาน', BG.danglingChoices([
    { id: 'a', choices: [{ text: 'x', nextSceneId: 'b' }] }, { id: 'b' }]).length === 0);
  check('validateChoices รับ undefined ได้', BG.validateChoices(undefined).length === 0);
}

// ── ข้อ 15: ไฮไลต์เส้นทางจากจุดเริ่ม → โหนดที่เลือก ──
{
  const h = BG.highlightPath(g, 'd');
  check('หาเส้นทาง root → โหนดที่เลือกเจอ', h.path.join('>') === 'a>b>d', h.path.join('>'));
  check('ไฮไลต์ครอบทุกโหนดบนเส้นทาง', h.nodes.has('a') && h.nodes.has('b') && h.nodes.has('d'));
  check('ไฮไลต์ครอบทุกเส้นบนเส้นทาง (ไม่เกินนั้น)',
        h.edges.size === 2 && h.edges.has(BG.edgeKey('a', 'b')) && h.edges.has(BG.edgeKey('b', 'd')));
  check('เลือกที่ root เอง = เส้นทางยาว 1 ไม่มีเส้น',
        BG.highlightPath(g, 'a').path.join() === 'a' && BG.highlightPath(g, 'a').edges.size === 0);
  check('โหนดนอกผัง → ไม่มีเส้นทาง', BG.highlightPath(g, 'z').path.length === 0);
  check('ไม่เลือกอะไร → ว่าง ไม่พัง', BG.highlightPath(g, null).nodes.size === 0);
  check('ผังวงล้วนยังหาเส้นทางได้ (ยึดฉากแรกเป็นราก)',
        BG.highlightPath(gc, 'c').path.join('>') === 'a>b>c', BG.highlightPath(gc, 'c').path.join('>'));
}

// ── ข้อ 16: รวมทางเลือกที่ซ้ำกัน ──
{
  const m = BG.mergeDuplicateChoices([
    { text: 'เปิดประตู', nextSceneId: '' },
    { text: 'เปิดประตู', nextSceneId: 'b' },
    { text: 'หนี', nextSceneId: 'c' },
  ]);
  check('ทางเลือกซ้ำถูกยุบเหลือหนึ่ง', m.list.length === 2 && m.removed === 1, JSON.stringify(m));
  check('ตัวที่ยังไม่ระบุปลายทางกลืนปลายทางของคู่แฝดมาด้วย',
        m.list[0].nextSceneId === 'b', JSON.stringify(m.list[0]));
  const keep = BG.mergeDuplicateChoices([
    { text: 'ไปต่อ', nextSceneId: 'x' }, { text: 'ไปต่อ', nextSceneId: 'y' }]);
  check('ข้อความเดียวกันแต่ไปคนละฉาก = ทางแยกจริง ห้ามยุบ',
        keep.list.length === 2 && keep.removed === 0);
  check('ตัดช่องว่างหัวท้ายก่อนเทียบ',
        BG.mergeDuplicateChoices([{ text: ' หนี ' }, { text: 'หนี' }]).removed === 1);
  check('countDuplicateChoices นับทั้งผัง', BG.countDuplicateChoices(BG.buildGraph([
    { id: 'a', choices: [{ text: 'x' }, { text: 'x' }] },
    { id: 'b', choices: [{ text: 'y' }, { text: 'y' }, { text: 'y' }] },
  ])) === 3);
  check('ไม่มีของซ้ำ → removed = 0', BG.mergeDuplicateChoices(g.byId.get('a').choices).removed === 0);
}

// ── ข้อ 17: ค้นหา/กรองในผัง ──
{
  check('ค้นชื่อฉากเจอ', [...BG.filterNodes(g, 'ห้องมืด')].join() === 'b');
  check('ค้นข้อความทางเลือกก็เจอฉากต้นทาง', BG.filterNodes(g, 'เปิดประตู').has('a'));
  check('ค้นชื่อบทเจอทุกฉากในบทนั้น', BG.filterNodes(g, 'บท 2').size === 2);
  check('ไม่ใส่คำค้น = ไม่กรอง (null ไม่ใช่ Set ว่าง)', BG.filterNodes(g, '  ') === null);
  check('ค้นไม่เจอ = Set ว่าง', BG.filterNodes(g, 'ไม่มีคำนี้แน่นอน').size === 0);
  const exp = BG.expandWithNeighbors(g, BG.filterNodes(g, 'ห้องมืด'));
  check('ขยายผลค้นหาให้เห็นเพื่อนบ้าน', exp.has('a') && exp.has('b') && exp.has('d') && !exp.has('c'),
        [...exp].join());
}

// ── ข้อ 7+10: ส่งออกผัง (Markdown outline · JSON · HTML tree) ──
{
  const out = BG.graphToOutline(g);
  check('outline เริ่มด้วยจุดเริ่มเรื่อง', out.startsWith('▶ เริ่มเรื่อง'), out.split('\n')[0]);
  check('outline ใช้เส้นขีดแบบต้นไม้', out.includes('├── [เปิดประตู] → ห้องมืด'), out);
  check('outline ย่อหน้าลูกด้วยเส้นตั้ง', out.includes('│   └── [เดินต่อ] → ตอนจบ'), out);
  check('outline ปิดกิ่งสุดท้ายด้วย └──', out.includes('└── [หนี] → ทางตัน'), out);
  const outOpen = BG.graphToOutline(BG.buildGraph([{ id: 'a', title: 'A', choices: [{ text: 'x' }] }]));
  check('outline บอกทางเลือกที่ยังไม่ระบุปลายทาง', outOpen.includes('(ยังไม่ระบุปลายทาง)'), outOpen);
  const outLoop = BG.graphToOutline(gc);
  check('outline ไม่วนไม่รู้จบเมื่อผังมีวง', outLoop.includes('↩ วนกลับ') && outLoop.length < 4000, outLoop);

  const j = BG.graphToJson(g, { title: 'เรื่องทดสอบ' });
  check('JSON บอกรูปแบบ+เวอร์ชันไว้ให้เครื่องมืออื่นอ่าน',
        j.format === 'killian-branching' && j.version === 1);
  check('JSON มีเฉพาะฉากที่อยู่ในผัง', j.scenes.length === 4, String(j.scenes.length));
  check('JSON เก็บทางเลือก + ปลายทาง', j.scenes[0].choices[0].next === 'b');
  check('JSON บอกปลายทางที่ยังไม่ระบุเป็น null',
        BG.graphToJson(BG.buildGraph([{ id: 'a', choices: [{ text: 'x' }] }])).scenes[0].choices[0].next === null);
  check('JSON มีสถิติผังครบ', j.stats.scenes === 4 && j.stats.choices === 3 && j.stats.roots === 1);
  check('JSON serialize ได้จริง (ไม่มี Map/Set หลุดเข้าไป)',
        JSON.parse(JSON.stringify(j)).scenes.length === 4);

  const gBody = BG.buildGraph([
    { id: 'a', title: 'ประตู', body: 'เขายืนอยู่หน้าประตู **บานใหญ่**', choices: [{ text: 'เปิด', nextSceneId: 'b' }] },
    { id: 'b', title: 'ห้องมืด<script>', body: 'มืดสนิท' },
  ]);
  const html = BG.graphToHtmlTree(gBody, { title: 'ผังของฉัน' });
  check('HTML tree เป็นหน้าเดี่ยวเปิดเบราว์เซอร์ได้', html.startsWith('<!DOCTYPE html>') && html.includes('</html>'));
  check('HTML tree ใช้ <ul><li> จริงตามที่ขอ', html.includes('<ul>') && html.includes('<li>'));
  check('HTML tree พับ/กางฉากได้ (<details>)', html.includes('<details'));
  check('HTML tree แสดงเนื้อฉากย่อ', html.includes('เขายืนอยู่หน้าประตู'), '');
  check('HTML tree ตัดเครื่องหมาย markdown ออกจากเนื้อย่อ', !html.includes('**บานใหญ่**'));
  check('HTML tree หนีอักขระ HTML จากชื่อฉาก (กันสคริปต์ฝัง)',
        html.includes('&lt;script&gt;') && !html.includes('<script>'));
  check('HTML tree แสดงข้อความทางเลือกบนกิ่ง', html.includes('[เปิด]'));
  check('HTML tree ใส่สถิติผังไว้ด้านบน', html.includes('ฉากในผัง'));
  check('ผังว่างส่งออกได้ ไม่พัง',
        BG.graphToHtmlTree(BG.buildGraph([])).includes('</html>') && BG.graphToOutline(BG.buildGraph([]))
        && JSON.stringify(BG.graphToJson(BG.buildGraph([]))).length > 10);
  check('bodyExcerpt ตัดความยาวตามที่กำหนด',
        BG.bodyExcerpt('ก'.repeat(500), 50).length === 50, String(BG.bodyExcerpt('ก'.repeat(500), 50).length));
}

// ── ข้อ 11 (i18n): ข้อความสรุปต้องเปลี่ยนภาษาได้ ──
{
  const en = BG.graphSummary(BG.analyzeGraph(g),
    { scenes: 'scenes', choices: 'choices', roots: 'starts', endings: 'endings' });
  check('graphSummary รับป้ายกำกับภาษาอื่นได้', en === '4 scenes · 3 choices · 1 starts · 2 endings', en);
  check('ไม่ส่งป้าย = ไทยเหมือนเดิม (ของเก่ายังใช้ได้)',
        BG.graphSummary(BG.analyzeGraph(g)).includes('4 ฉากในผัง'));
}

// ── สีของการ์ด/เส้น (ข้อ 4) ต้องรอดจาก buildGraph ──
{
  const gcol = BG.buildGraph([
    { id: 'a', title: 'A', color: '#d97757', choices: [{ text: 'x', nextSceneId: 'b', color: '#5f9fd9' }] },
    { id: 'b', title: 'B' },
  ]);
  check('สีการ์ดติดมากับโหนด', gcol.byId.get('a').color === '#d97757');
  check('สีเส้นติดมากับทางเลือกและ edge',
        gcol.byId.get('a').choices[0].color === '#5f9fd9' && gcol.edges[0].color === '#5f9fd9');
  check('ไม่ตั้งสี = ว่าง ไม่ใช่ undefined', BG.buildGraph([{ id: 'x' }]).byId.get('x').color === '');
}

console.log(`branch-graph: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
