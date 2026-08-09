// test/network-layout.test.cjs — เอนจินตำแหน่งโหนดของ Story Network
// คุมบั๊ก alpha.63r4 สามข้อ: ตำแหน่งปนข้ามโปรเจกต์ · ชื่อซ้ำข้ามหมวดชนกัน · ผังแข็งถาวร
const path = require('path');
const out = path.join(require('os').tmpdir(), '_netlayout.cjs');   // '/tmp' ใช้บน Windows ไม่ได้

// network-layout.js เรียก localStorage ตรง ๆ → ต้อง stub ก่อน require
const mem = new Map();
global.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/network-layout.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const NL = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

const PA = 'C:/Projects/เรื่องแรก';
const PB = 'C:/Projects/เรื่องที่สอง';
const mk = (cat, name) => ({ cat, name, x: 0, y: 0, z: 0 });

// ── nodeKey: ชื่อซ้ำข้ามหมวดต้องไม่ใช่โหนดเดียวกัน ──
check('ชื่อเดียวกันคนละหมวด → คีย์ต่างกัน', NL.nodeKey(mk('characters', 'วัง')) !== NL.nodeKey(mk('locations', 'วัง')));
check('หมวด+ชื่อเดียวกัน → คีย์เดียวกัน', NL.nodeKey(mk('characters', 'โทระ')) === NL.nodeKey(mk('characters', 'โทระ')));
check('ชื่อมี | ไม่ทำให้คีย์เพี้ยน', NL.nodeKey(mk('items', 'ดาบ|เก่า')) !== NL.nodeKey(mk('items', 'ดาบ')));

// ── บันทึกเฉพาะโหนดที่ปักหมุด (ไม่งั้นรอบหน้าโดนหมุดหมดทั้งผัง = ผังแข็งถาวร) ──
{
  mem.clear();
  const nodes = [mk('characters', 'โทระ'), mk('characters', 'แคสซี่')];
  nodes[0].x = 120; nodes[0].y = -40; nodes[0]._pinned = true;   // ผู้ใช้ลากเอง
  nodes[1].x = 999; nodes[1].y = 999;                             // force layout วางให้
  NL.savePositions(nodes, PA);
  const back = NL.loadPositions(PA);
  check('บันทึกโหนดที่ปักหมุด', !!back && Object.keys(back).length === 1);
  check('โหนดที่ไม่ได้ปักหมุดไม่ถูกบันทึก', !!back && back[NL.nodeKey(nodes[1])] === undefined);
  check('พิกัดที่บันทึกถูกต้อง', !!back && back[NL.nodeKey(nodes[0])].x === 120 && back[NL.nodeKey(nodes[0])].y === -40);
}

// ── seedLayout: คืนหมุดให้โหนดเดิม แต่โหนดใหม่ต้องยังขยับได้ ──
{
  const saved = NL.loadPositions(PA);
  const nodes = [mk('characters', 'โทระ'), mk('characters', 'ลูน่า')];
  NL.seedLayout(nodes, saved, { width: 900, depth: 400 });
  check('โหนดที่เคยลากกลับมาที่เดิม', nodes[0].x === 120 && nodes[0].y === -40);
  check('โหนดที่เคยลาก = ปักหมุด', nodes[0]._pinned === true);
  check('โหนดใหม่ไม่ถูกปักหมุด', nodes[1]._pinned === false);
}

// ── แยกตามโปรเจกต์: ชื่อซ้ำข้ามโปรเจกต์ต้องไม่ยืมตำแหน่งกัน ──
{
  const inB = [mk('characters', 'โทระ')];
  NL.seedLayout(inB, NL.loadPositions(PB), { width: 900, depth: 400 });
  check('โปรเจกต์อื่นไม่เห็นตำแหน่งของโปรเจกต์แรก', inB[0]._pinned === false);
  check('โปรเจกต์แรกยังมีตำแหน่งอยู่', !!NL.loadPositions(PA));
}

// ── clearPositions: ปลดหมุดทั้งผังแล้ว force layout ต้องขยับได้อีก ──
{
  const nodes = [mk('characters', 'โทระ')];
  NL.seedLayout(nodes, NL.loadPositions(PA), { width: 900, depth: 400 });
  check('ก่อนปลด: ปักหมุดอยู่', nodes[0]._pinned === true);
  NL.clearPositions(nodes, PA);
  check('ปลดหมุดแล้วธงถูกล้าง', nodes[0]._pinned === false);
  check('ปลดหมุดแล้วที่บันทึกไว้หายไป', NL.loadPositions(PA) === null);
}

// ── forceLayout ต้องไม่ขยับโหนดที่ปักหมุด แต่ขยับตัวอื่น ──
{
  const a = mk('characters', 'A'), b = mk('characters', 'B'), c = mk('characters', 'C');
  a.x = 0; a.y = 0; b.x = 5; b.y = 5; c.x = -5; c.y = -5;
  a._pinned = true;
  const nodes = [a, b, c];
  NL.forceLayout(nodes, [], { iters: 40, pinned: new Set([a]) });
  check('โหนดที่ปักหมุดไม่ขยับ', a.x === 0 && a.y === 0);
  check('โหนดที่ไม่ปักหมุดถูกผลักออก', b.x !== 5 || b.y !== 5);
}

// ── ผังไม่แข็งถาวร: วนสองรอบเหมือนเปิดแผงซ้ำ แล้วโหนดที่ไม่เคยลากต้องยังจัดใหม่ได้ ──
{
  mem.clear();
  const round = () => {
    const nodes = [mk('characters', 'A'), mk('characters', 'B'), mk('characters', 'C')];
    NL.seedLayout(nodes, NL.loadPositions(PA), { width: 900, depth: 400 });
    const pinned = new Set(nodes.filter((n) => n._pinned));
    NL.forceLayout(nodes, [], { iters: 60, pinned });
    NL.savePositions(nodes, PA);            // เลียนแบบ destroy()/ปล่อยเมาส์
    return nodes;
  };
  round();
  const second = round();
  check('รอบสองยังไม่มีโหนดไหนถูกหมุด', second.every((n) => !n._pinned));
  check('ไม่มีตำแหน่งค้างใน storage เมื่อไม่เคยลากเลย',
        JSON.stringify(NL.loadPositions(PA)) === '{}');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
