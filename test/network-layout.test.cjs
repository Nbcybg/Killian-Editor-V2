// test/network-layout.test.cjs — เอนจินตำแหน่งโหนดของ Story Network
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
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

// ── [alpha.73 ข้อ 1] บันทึก "ทุกโหนด" พร้อมธงว่าตัวไหนผู้ใช้จัดเอง ──
// เดิมบันทึกเฉพาะตัวที่ลาก → ตัวที่เหลือถูกสุ่มตำแหน่งใหม่ทุกครั้งที่รีเฟรช ผังเปลี่ยนหน้าตาตลอด
{
  mem.clear();
  const nodes = [mk('characters', 'โทระ'), mk('characters', 'แคสซี่')];
  nodes[0].x = 120; nodes[0].y = -40; nodes[0]._pinned = true;   // ผู้ใช้ลากเอง
  nodes[1].x = 999; nodes[1].y = 999;                             // force layout วางให้
  NL.savePositions(nodes, PA);
  const back = NL.loadPositions(PA);
  check('บันทึกตำแหน่งครบทุกโหนด (ไม่ใช่เฉพาะตัวที่ลาก)', !!back && Object.keys(back).length === 2,
        back ? Object.keys(back).length : 'null');
  check('ตัวที่ผู้ใช้ลากเอง ติดธง pinned', !!back && back[NL.nodeKey(nodes[0])].pinned === true);
  check('ตัวที่ force layout วางให้ ไม่ติดธง pinned', !!back && back[NL.nodeKey(nodes[1])].pinned === false);
  check('พิกัดที่บันทึกถูกต้อง', !!back && back[NL.nodeKey(nodes[0])].x === 120 && back[NL.nodeKey(nodes[0])].y === -40);
  check('พิกัด z ถูกบันทึกด้วย', back[NL.nodeKey(nodes[0])].z === 0);
  check('โหนดที่พิกัดเพี้ยน (NaN) ไม่ถูกบันทึก',
        (() => { mem.clear(); const bad = [mk('items', 'x')]; bad[0].x = NaN; bad[0].y = 0;
                 NL.savePositions(bad, PA); return Object.keys(NL.loadPositions(PA) || {}).length === 0; })());
  NL.savePositions(nodes, PA);   // คืนค่าให้เทสถัดไปใช้ต่อ
}

// ── รีเฟรชแล้วผังต้องหน้าตาเดิม ──
{
  const saved = NL.loadPositions(PA);
  const again = [mk('characters', 'โทระ'), mk('characters', 'แคสซี่')];
  NL.seedLayout(again, saved, { width: 900, depth: 400 });
  check('[73-1] รีเฟรช: โหนดที่ไม่เคยลากก็กลับมาที่เดิม (เดิมโดนสุ่มใหม่)',
        again[1].x === 999 && again[1].y === 999, `${again[1].x},${again[1].y}`);
  check('[73-1] รีเฟรช: ธง pinned คงเดิม ไม่ใช่ปักหมุดหมดทั้งผัง',
        again[0]._pinned === true && again[1]._pinned === false);
  check('[73-1] โหนดที่มีตำแหน่งแล้ว ไม่ใช่ของใหม่', again[0]._fresh === false && again[1]._fresh === false);
  const withNew = [mk('characters', 'โทระ'), mk('characters', 'คนใหม่')];
  NL.seedLayout(withNew, saved, { width: 900, depth: 400 });
  check('[73-1] เอนทิตี้ที่เพิ่งสร้าง ติดธง _fresh ให้จัดผังเฉพาะตัวมัน',
        withNew[0]._fresh === false && withNew[1]._fresh === true);
}

// ── ไฟล์รุ่นเก่า (ไม่มีธง pinned) ต้องอ่านได้ ──
{
  const oldFormat = { [NL.nodeKey(mk('characters', 'เก่า'))]: { x: 10, y: 20, z: 0 } };
  const n2 = [mk('characters', 'เก่า')];
  NL.seedLayout(n2, oldFormat, { width: 900, depth: 400 });
  check('[73-1] ไฟล์รุ่นเก่า: ของที่บันทึกไว้ถือว่าผู้ใช้ลากเอง (ปักหมุด)',
        n2[0].x === 10 && n2[0]._pinned === true);
}

// ── seedLayout: คืนหมุดให้โหนดเดิม แต่โหนดใหม่ต้องยังขยับได้ ──
{
  const saved = NL.loadPositions(PA);
  const nodes = [mk('characters', 'โทระ'), mk('characters', 'ลูน่า')];
  NL.seedLayout(nodes, saved, { width: 900, depth: 400 });
  check('โหนดที่เคยลากกลับมาที่เดิม', nodes[0].x === 120 && nodes[0].y === -40);
  check('โหนดที่เคยลาก = ปักหมุด', nodes[0]._pinned === true);
  check('โหนดใหม่ไม่ถูกปักหมุด', nodes[1]._pinned === false);
  check('โหนดใหม่ติดธง _fresh', nodes[1]._fresh === true);
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
  // [alpha.73 ข้อ 1] เปลี่ยนกติกา: ตำแหน่งถูกบันทึกทุกโหนด (กันผังเปลี่ยนหน้าตาทุกครั้งที่รีเฟรช)
  // สิ่งที่ต้องไม่เกิดคือ "ถูกปักหมุดหมดทั้งผัง" ซึ่งดูจากธง pinned ไม่ใช่จากการมี/ไม่มีตำแหน่ง
  {
    const stored = NL.loadPositions(PA) || {};
    check('[73-1] ตำแหน่งถูกบันทึกไว้ครบ แม้ไม่เคยลากเลย', Object.keys(stored).length === second.length,
          Object.keys(stored).length + '/' + second.length);
    check('[73-1] แต่ไม่มีตัวไหนถูกปักหมุด (forceLayout ยังจัดของใหม่ได้)',
          Object.values(stored).every((p2) => p2.pinned === false));
  }
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
