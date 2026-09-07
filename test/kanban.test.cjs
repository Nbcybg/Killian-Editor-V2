// test/kanban.test.cjs — ทดสอบ kanban-core (ข้อ 12) ด้วย node
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_kb.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/kanban/kanban-core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const KB = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

const fixture = () => ({ chapters: {
  c1: [
    { id: 'sc1', title: 'ตลาดเก่า', order: 1, fileName: 'scene-01.md', status: 'กำลังเขียน' },
    { id: 'sc2', title: 'บทหนัง', order: 2, fileName: 'scene-02.md', status: 'โครงร่าง' },
    { id: 'sc3', title: 'ยังไม่ตั้ง', order: 3, fileName: 'scene-03.md' },
  ],
  c2: [
    { id: 'sc4', title: 'ฉากจบ', order: 1, fileName: 'scene-04.md', status: 'กำลังเขียน', kbOrder: 0 },
    { id: 'sc5', title: 'สถานะแปลก', order: 2, fileName: 'scene-05.md', status: 'รอบรรณาธิการ' },
  ],
} });

// ── getKanbanData: จัดกลุ่มตาม status ──
let sc = fixture();
let board = KB.getKanbanData(sc);
const col = (b, k) => b.columns.find((c) => c.key === k);
check('มีคอลัมน์ครบตามสถานะมาตรฐาน', KB.DEFAULT_STATUSES.every((s) => !!col(board, s)), board.columns.map((c) => c.key).join());
check('นับการ์ดทั้งหมด', board.total === 5, 'total=' + board.total);
check('กลุ่ม "กำลังเขียน" มี 2 ใบ', col(board, 'กำลังเขียน').count === 2);
check('คอลัมน์ยังไม่กำหนดอยู่หน้าสุด', board.columns[0].key === KB.UNSET && board.columns[0].cards[0].id === 'sc3');
check('สถานะแปลกปลอมได้คอลัมน์เอง (การ์ดไม่หาย)', col(board, 'รอบรรณาธิการ').count === 1 && col(board, 'รอบรรณาธิการ').custom === true);
check('การ์ดพก chapterId มาด้วย', col(board, 'โครงร่าง').cards[0].chapterId === 'c1');
check('includeUnset:false → ไม่มีคอลัมน์ยังไม่กำหนด', !col(KB.getKanbanData(sc, { includeUnset: false }), KB.UNSET));
check('filter กรองการ์ดได้', KB.getKanbanData(sc, { filter: (c) => c.chapterId === 'c1' }).total === 3);
check('chapters จำกัดเฉพาะบทที่เลือก', KB.getKanbanData(sc, { chapters: ['c2'] }).total === 2);

// ── เรียงในคอลัมน์: kbOrder → order → ลำดับในไฟล์ ──
check('kbOrder=0 มาก่อน sc1 ที่ไม่มี kbOrder', col(board, 'กำลังเขียน').cards.map((c) => c.id).join() === 'sc4,sc1',
  col(board, 'กำลังเขียน').cards.map((c) => c.id).join());

// ── updateSceneStatus (ลากการ์ด) ──
const r1 = KB.updateSceneStatus(sc, 'sc2', 'เขียนเสร็จ');
check('updateSceneStatus เปลี่ยนสถานะ', r1.changed && r1.from === 'โครงร่าง' && r1.to === 'เขียนเสร็จ');
check('immutable: ของเดิมไม่ถูกแก้', sc.chapters.c1[1].status === 'โครงร่าง', sc.chapters.c1[1].status);
check('ของใหม่ถูกแก้', r1.scenes.chapters.c1[1].status === 'เขียนเสร็จ');
check('สถานะเดิมซ้ำ → changed=false', KB.updateSceneStatus(sc, 'sc1', 'กำลังเขียน').changed === false);
check('ฉากไม่มีจริง → changed=false ไม่พัง', KB.updateSceneStatus(sc, 'ไม่มี', 'โครงร่าง').changed === false);
const rUnset = KB.updateSceneStatus(sc, 'sc1', KB.UNSET);
check('ลากกลับคอลัมน์ยังไม่กำหนด → ลบฟิลด์ status ทิ้ง', !('status' in rUnset.scenes.chapters.c1[0]));

// ── moveCard + ลำดับในคอลัมน์ ──
const mv = KB.moveCard(sc, 'sc2', 'กำลังเขียน', 0);      // แทรกหัวคอลัมน์
const mvBoard = KB.getKanbanData(mv.scenes);
check('moveCard แทรกตำแหน่ง 0', col(mvBoard, 'กำลังเขียน').cards.map((c) => c.id).join() === 'sc2,sc4,sc1',
  col(mvBoard, 'กำลังเขียน').cards.map((c) => c.id).join());
const mv2 = KB.moveCard(mv.scenes, 'sc2', 'กำลังเขียน', 99);
check('moveCard index เกิน → ไปท้ายสุด (clamp)', KB.getKanbanData(mv2.scenes).columns.find((c) => c.key === 'กำลังเขียน').cards.slice(-1)[0].id === 'sc2');
check('kbOrder ถูกเขียนกลับลง scenes.json', typeof KB.findScene(mv.scenes, 'sc4').row.kbOrder === 'number');
check('normalizeKbOrder เติมครบทุกใบ', KB.cardsOf(KB.normalizeKbOrder(sc)).every((c) => typeof c.kbOrder === 'number'));

// ── คอลัมน์: add / remove / reorder / wip / hidden ──
let ly = KB.newLayout();
ly = KB.addColumn(ly, 'รอแก้ไข');
check('addColumn เพิ่มลง order', ly.order.includes('รอแก้ไข'));
check('addColumn immutable', KB.newLayout().order.length === 0);
ly = KB.addColumn(ly, 'ด่วน', { at: 0 });
check('addColumn ระบุตำแหน่ง', ly.order[0] === 'ด่วน', ly.order.join());
ly = KB.reorderColumns(ly, 0, 1);
check('reorderColumns สลับลำดับ', ly.order.join() === 'รอแก้ไข,ด่วน', ly.order.join());
ly = KB.setWip(ly, 'กำลังเขียน', 1);
check('setWip เก็บโควตา', ly.wip['กำลังเขียน'] === 1);
check('WIP เกิน → over=true', KB.getKanbanData(sc, { layout: ly }).columns.find((c) => c.key === 'กำลังเขียน').over === true);
ly = KB.toggleHidden(ly, 'เก็บถาวร');
check('toggleHidden ซ่อนคอลัมน์', !KB.getKanbanData(sc, { layout: ly }).columns.some((c) => c.key === 'เก็บถาวร'));
check('layout.order คุมลำดับคอลัมน์จริง', (() => {
  const b = KB.getKanbanData(sc, { layout: KB.addColumn(KB.newLayout(), 'เก็บถาวร', { at: 0 }) });
  return b.columns[0].key === 'เก็บถาวร';
})());

// ── removeColumn: ต้องว่าง หรือส่ง moveTo ──
const bad = KB.removeColumn(KB.newLayout(), 'กำลังเขียน', { scenes: sc });
check('ลบคอลัมน์ที่ยังมีการ์ด → ปฏิเสธ', bad.ok === false && bad.reason === 'not-empty' && bad.count === 2);
const good = KB.removeColumn(KB.newLayout(), 'กำลังเขียน', { scenes: sc, moveTo: 'โครงร่าง' });
check('removeColumn + moveTo ย้ายการ์ดให้', good.ok === true && good.moved === 2);
check('การ์ดย้ายไปคอลัมน์ปลายทางจริง', KB.getKanbanData(good.scenes).columns.find((c) => c.key === 'โครงร่าง').count === 3,
  JSON.stringify(KB.getKanbanData(good.scenes).byStatus));
check('คอลัมน์ที่ลบไม่โผล่กลับมา', !KB.getKanbanData(good.scenes, { layout: good.layout }).columns.some((c) => c.key === 'กำลังเขียน'));
const empty = KB.removeColumn(KB.newLayout(), 'ตรวจแล้ว', { scenes: sc });
check('ลบคอลัมน์ว่าง → ผ่านเลย', empty.ok === true && empty.moved === 0);

// ── KanbanStore ──
const mem = new Map();
const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
const st = new KB.KanbanStore(storage, 'kb-test');
st.set(KB.addColumn(KB.newLayout(), 'ของฉัน'));
const st2 = new KB.KanbanStore(storage, 'kb-test');
check('KanbanStore save/load', st2.load() && st2.layout.order.includes('ของฉัน'));
check('deserialize สตริงพัง → null', KB.deserializeKanban('{พัง') === null);
check('version อนาคต → null', KB.deserializeKanban(JSON.stringify({ version: 99 })) === null);
check('migrate v0 (ไม่มี version)', !!KB.deserializeKanban(JSON.stringify({ order: ['x'] })));

// ── KanbanBoard + mock io: อัปเดต scenes.json อัตโนมัติ ──
const files = { 'D/scenes.json': JSON.stringify(fixture()) };
const io = {
  join: (...p) => p.join('/'),
  exists: async (p) => p in files,
  readJson: async (p) => (p in files ? JSON.parse(files[p]) : null),
  writeFile: async (p, t) => { files[p] = t; },
};
(async () => {
  const kbB = new KB.KanbanBoard({ io, draftPath: 'D', storage });
  await kbB.load();
  check('KanbanBoard.load อ่าน scenes.json', kbB.data().total === 5);
  let events = 0; kbB.onChange(() => events++);
  await kbB.updateSceneStatus('sc3', 'กำลังเขียน');
  check('อัปเดตสถานะ → เขียนไฟล์ทันที', JSON.parse(files['D/scenes.json']).chapters.c1[2].status === 'กำลังเขียน');
  check('เขียนเป็น JSON อ่านได้ (indent 2)', files['D/scenes.json'].includes('\n  "chapters"'));
  check('onChange ถูกเรียก', events === 1, 'n=' + events);
  check('data() สะท้อนสถานะใหม่', kbB.data().columns.find((c) => c.key === 'กำลังเขียน').count === 3);

  await kbB.addColumn('รอแก้ไข');
  check('addColumn ผ่านบอร์ด → คอลัมน์โผล่', kbB.data().columns.some((c) => c.key === 'รอแก้ไข'));
  await kbB.updateSceneStatus('sc5', 'รอแก้ไข');
  const rm = await kbB.removeColumn('รอแก้ไข', { moveTo: 'โครงร่าง' });
  check('removeColumn ผ่านบอร์ด → ย้ายการ์ด + เขียนไฟล์', rm.ok && JSON.parse(files['D/scenes.json']).chapters.c2[1].status === 'โครงร่าง');

  const noAuto = new KB.KanbanBoard({ io, draftPath: 'D', storage, autoSave: false });
  await noAuto.load();
  const before = files['D/scenes.json'];
  await noAuto.updateSceneStatus('sc1', 'ตรวจแล้ว');
  check('autoSave:false → ยังไม่เขียนไฟล์', files['D/scenes.json'] === before && noAuto.dirty === true);
  await noAuto.flush();
  check('flush() เขียนไฟล์', JSON.parse(files['D/scenes.json']).chapters.c1[0].status === 'ตรวจแล้ว' && noAuto.dirty === false);

  const missing = new KB.KanbanBoard({ io, draftPath: 'ไม่มี', storage });
  await missing.load();
  check('scenes.json หาย → บอร์ดว่าง ไม่ throw', missing.data().total === 0);

  console.log(`\nkanban: ${pass} ผ่าน, ${fail} ล้มเหลว`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
