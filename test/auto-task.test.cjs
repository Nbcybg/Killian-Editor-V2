// test/auto-task.test.cjs — ทดสอบ event-queue (ข้อ 88) ด้วย node
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_atq.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/auto-task/event-queue.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const AT = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── EventBus ──
const bus = new AT.EventBus();
let got = [];
const un = bus.on('a', (p) => got.push('a:' + p));
bus.emit('a', 1);
check('on/emit ส่ง payload', got.join() === 'a:1');
un();
bus.emit('a', 2);
check('unsubscribe (คืนจาก on) ทำงาน', got.length === 1);

got = [];
bus.once('b', (p) => got.push(p));
bus.emit('b', 'x'); bus.emit('b', 'y');
check('once ทำงานครั้งเดียว', got.join() === 'x');

got = [];
bus.on('*', (p, ev) => got.push(ev));
bus.emit('c', 1); bus.emit('d', 2);
check('wildcard * ฟังทุกเหตุการณ์ + รู้ชื่อ event', got.join() === 'c,d');

let errs = 0;
const bus2 = new AT.EventBus({ onError: () => errs++ });
let after = 0;
bus2.on('z', () => { throw new Error('พัง'); });
bus2.on('z', () => after++);
bus2.emit('z');
check('listener ที่พังไม่ลากตัวอื่นตาย', after === 1 && errs === 1);

// ── คิว: ลำดับ / dedupe / retry / error ──
let clock = 1000;
const mk = (meta) => new AT.AutoTaskEngine({ meta, now: () => clock++ });
let q = mk({});
const order = [];
q.registerTask('x', async (p) => { order.push(p.n); });
q.enqueue('x', { n: 1 });
q.enqueue('x', { n: 2 }, { priority: 5 });
q.enqueue('x', { n: 3 });
q.enqueue('x', { n: 4 }, { priority: 5 });
check('pending นับงานที่รอ', q.pending().length === 4);
(async () => {
  const res = await q.processQueue();
  check('processQueue ทำครบทุกงาน', res.processed === 4);
  check('priority สูงก่อน · เท่ากันเรียงตามเวลาเข้าคิว', order.join() === '2,4,1,3', order.join());
  check('คิวว่างหลังทำเสร็จ', q.pending().length === 0);

  // dedupe ด้วย key
  q = mk({});
  let runs = 0, lastTag = '';
  q.registerTask('idx', async (p) => { runs++; lastTag = p.tag; return p.tag; });
  q.enqueue('idx', { tag: 'a' }, { key: 'reindex' });
  q.enqueue('idx', { tag: 'b' }, { key: 'reindex' });
  q.enqueue('idx', { tag: 'c' }, { key: 'reindex' });
  check('งานคีย์เดียวกันรวมเป็นงานเดียว', q.pending().length === 1);
  await q.processQueue();
  check('งานที่รวมแล้วทำครั้งเดียว ใช้ payload ล่าสุด', runs === 1 && lastTag === 'c', `runs=${runs} tag=${lastTag}`);

  // retry แล้วสำเร็จ
  q = mk({});
  let tries = 0;
  q.registerTask('flaky', async () => { tries++; if (tries < 2) throw new Error('เน็ตหลุด'); return 'ok'; });
  q.enqueue('flaky', {});
  const r2 = await q.processQueue();
  check('retry: ลองใหม่แล้วสำเร็จ', tries === 2 && r2.tasks[0].status === 'done');

  // error ไม่ทำให้คิวตาย
  q = mk({});
  let later = 0;
  q.registerTask('bad', async () => { throw new Error('พังจริง'); });
  q.registerTask('good', async () => { later++; });
  q.enqueue('bad', {}, { maxTries: 2 });
  q.enqueue('good', {});
  const r3 = await q.processQueue();
  check('handler พัง → status error', r3.tasks[0].status === 'error' && r3.tasks[0].tries === 2);
  check('งานถัดไปยังทำต่อ', later === 1);
  check('stats นับ done/error', q.stats().done === 1 && q.stats().error === 1, JSON.stringify(q.stats()));

  // ไม่มี handler → skipped ไม่ใช่ error
  q = mk({});
  q.enqueue('ไม่รู้จัก', {});
  const r4 = await q.processQueue();
  check('งานที่ไม่มี handler → skipped', r4.tasks[0].status === 'skipped');

  // ── rule: event → task ──
  q = mk({});
  const seen = [];
  q.registerTask('save', async (p) => { seen.push(p.id); });
  q.rule('scene:status', 'save', (p) => ({ id: p.sceneId }), { key: 'save' });
  const em = q.emit('scene:status', { sceneId: 'sc1' });
  check('emit → เข้าคิวตามกฎ', em.queued.length === 1 && q.pending().length === 1);
  q.emit('scene:status', { sceneId: 'sc2' });
  check('กฎ + key เดียวกัน → รวบเป็นงานเดียว', q.pending().length === 1);
  await q.processQueue();
  check('งานได้ payload ที่ map แล้ว (ล่าสุด)', seen.join() === 'sc2', seen.join());
  q.rule('e2', 'save', () => null);
  q.emit('e2', {});
  check('map คืน null → ไม่เข้าคิว', q.pending().length === 0);

  // listener ปกติยังได้รับ event ด้วย
  let heard = 0;
  q.on('scene:status', () => heard++);
  q.emit('scene:status', { sceneId: 'sc3' });
  check('emit ยิง listener + เข้าคิวพร้อมกัน', heard === 1 && q.pending().length === 1);

  // ── taskLog ใน project.khn.json ──
  const meta = {};
  q = new AT.AutoTaskEngine({ meta, now: () => clock++, logMax: 3 });
  q.registerTask('t', async () => 'เรียบร้อย');
  for (let i = 0; i < 5; i++) q.enqueue('t', { i }, { key: 'k' + i });
  await q.processQueue();
  check('เขียน taskLog ลง meta', Array.isArray(meta.taskLog) && meta.taskLog.length === 3, JSON.stringify(meta.taskLog));
  check('taskLog เก็บแค่ล่าสุดตาม logMax', meta.taskLog.length === 3);
  check('log มี ts/type/status/detail', meta.taskLog[0].type === 't' && meta.taskLog[0].status === 'done' && meta.taskLog[0].detail === 'เรียบร้อย');
  check('taskLog() อ่านกลับได้', q.taskLog().length === 3);
  const metaErr = {};
  const q5 = new AT.AutoTaskEngine({ meta: metaErr, now: () => clock++ });
  q5.registerTask('boom', async () => { throw new Error('ระเบิด'); });
  q5.enqueue('boom', {}, { maxTries: 1 });
  await q5.processQueue();
  check('งานที่พังก็ลง log พร้อมข้อความ', metaErr.taskLog[0].status === 'error' && metaErr.taskLog[0].detail === 'ระเบิด');
  check('ไม่มี meta → ไม่พัง', (() => { const e = new AT.AutoTaskEngine({}); return e.taskLog().length === 0; })());

  // ── replaceName ──
  let rn = AT.replaceName('โทระ เดินมา แล้ว โทระ ก็ไป', 'โทระ', 'โทระ ยามาโมโตะ');
  check('replaceName แทนทุกที่', rn.changed === 2 && rn.text === 'โทระ ยามาโมโตะ เดินมา แล้ว โทระ ยามาโมโตะ ก็ไป', rn.text);
  rn = AT.replaceName('เมื่อ [[โทระ]] มาถึง', 'โทระ', 'ทาโร่');
  check('replaceName แก้ในลิงก์ [[…]]', rn.text === 'เมื่อ [[ทาโร่]] มาถึง', rn.text);
  rn = AT.replaceName('[[โทระ|เขา]] พูด', 'โทระ', 'ทาโร่');
  check('replaceName เก็บส่วนข้อความหลัง |', rn.text === '[[ทาโร่|เขา]] พูด', rn.text);
  rn = AT.replaceName('the category of Cat', 'Cat', 'Kitty');
  check('อังกฤษเช็คขอบคำ (category ไม่โดน)', rn.text === 'the category of Kitty' && rn.changed === 1, rn.text);
  check('ชื่อเดิม=ชื่อใหม่ → ไม่แตะ', AT.replaceName('โทระ', 'โทระ', 'โทระ').changed === 0);
  check('ไม่เจอชื่อ → changed=0', AT.replaceName('ไม่มีใคร', 'โทระ', 'ทาโร่').changed === 0);

  // ── renameEntityTask + mock io ──
  const files = {
    'a.md': 'โทระ เดินเข้ามา',
    'b.md': 'ไม่มีใครในนี้',
    'c.md': '[[โทระ]] กับ โทระ',
  };
  const writes = [];
  const io = {
    readFile: async (p) => (p in files ? files[p] : null),
    writeFile: async (p, t) => { files[p] = t; writes.push(p); },
  };
  const meta2 = {};
  const eng = new AT.AutoTaskEngine({ meta: meta2, now: () => clock++ });
  eng.registerTask('rename-entity', AT.renameEntityTask(io));
  AT.installDefaultRules(eng);
  eng.registerTask('reindex-links', async () => 'สร้างดัชนีใหม่');
  eng.emit('entity:renamed', { entityId: 'characters/tora.json', oldName: 'โทระ', newName: 'ทาโร่',
                               files: ['a.md', 'b.md', 'c.md', 'ไม่มีไฟล์.md'] });
  check('installDefaultRules: entity:renamed → 2 งาน', eng.pending().length === 2, JSON.stringify(eng.pending().map((t) => t.type)));
  const rr = await eng.processQueue();
  check('rename แก้เฉพาะไฟล์ที่มีชื่อจริง', writes.sort().join() === 'a.md,c.md', writes.join());
  check('เนื้อไฟล์ถูกแทนที่', files['a.md'] === 'ทาโร่ เดินเข้ามา' && files['c.md'] === '[[ทาโร่]] กับ ทาโร่', files['c.md']);
  check('ไฟล์ที่ไม่มีชื่อไม่ถูกแตะ', files['b.md'] === 'ไม่มีใครในนี้');
  check('ไฟล์หาย → ข้ามเงียบ ๆ ไม่ throw', rr.tasks.every((t) => t.status === 'done'));
  check('log บอกจำนวนไฟล์', meta2.taskLog.some((l) => l.detail.includes('2 ไฟล์')), JSON.stringify(meta2.taskLog));

  // ── start/stop ด้วย scheduler ที่ฉีดเข้ามา ──
  const eng2 = new AT.AutoTaskEngine({ now: () => clock++ });
  let ticks = [];
  const handle = eng2.start((fn) => { ticks.push(fn); return 'H'; });
  check('start ใช้ scheduler ที่ฉีดเข้ามา', handle === 'H' && ticks.length === 1);
  check('stop ยกเลิกด้วย cancel ที่ส่งมา', eng2.stop(() => {}) === true && eng2.stop(() => {}) === false);

  console.log(`\nauto-task: ${pass} ผ่าน, ${fail} ล้มเหลว`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
