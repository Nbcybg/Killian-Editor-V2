// test/branch-plans.test.cjs — หลายแผนต่อหนึ่งโปรเจกต์ (alpha.73 ข้อ 5)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_bplans.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/branch-plans.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const B = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ═══════════ สร้าง/อ่านแผน ═══════════
{
  const p = B.newBranchPlan('เส้นทางหลัก');
  check('แผนใหม่มีคีย์ครบ',
        p.version === B.BRANCH_PLAN_VERSION && p.name === 'เส้นทางหลัก' &&
        !!p.positions && !!p.colors && p.view === 'tree' && p.zoom === 1);
  check('ชื่อว่าง → ชื่อเริ่มต้น', B.newBranchPlan('').name === 'แผนใหม่' && B.newBranchPlan('   ').name === 'แผนใหม่');
  check('เก็บไว้ในโฟลเดอร์ Branches', B.BRANCH_PLAN_DIR === 'Branches');
}

// ═══════════ normalize: ไฟล์พัง/รุ่นเก่าต้องไม่ทำแผงล้ม ═══════════
{
  const n = B.normalizeBranchPlan({
    name: 'ทางลับ', view: 'list', zoom: 99, note: 'โน้ต',
    positions: { a: { x: 10, y: 20 }, b: { x: 'ไม่ใช่เลข', y: 5 }, c: null },
    colors: { a: '#ff0000', b: 'เขียว', c: 12 },
    sel: 's1',
  }, 'สำรอง');
  check('อ่านค่าที่ถูกต้องได้ครบ', n.name === 'ทางลับ' && n.view === 'list' && n.note === 'โน้ต' && n.sel === 's1');
  check('ซูมนอกช่วงถูกหนีบ', n.zoom === 3, String(n.zoom));
  check('ตำแหน่งที่พังถูกทิ้ง ไม่พาแผนล่ม',
        Object.keys(n.positions).join() === 'a' && n.positions.a.x === 10, JSON.stringify(n.positions));
  check('สีที่ไม่ใช่ hex ถูกทิ้ง', Object.keys(n.colors).join() === 'a');
  check('ไฟล์ว่าง/null → แผนเปล่าที่ใช้งานต่อได้',
        B.normalizeBranchPlan(null, 'ก').name === 'ก' && B.normalizeBranchPlan(undefined, 'ก').view === 'tree');
  check('view แปลก ๆ → tree', B.normalizeBranchPlan({ view: 'zzz' }, 'x').view === 'tree');
  check('zoom ไม่ใช่ตัวเลข → 1', B.normalizeBranchPlan({ zoom: 'aa' }, 'x').zoom === 1);
}

// ═══════════ ชื่อไฟล์ ═══════════
{
  check('ตัดอักขระต้องห้ามของ Windows', B.safePlanName('a/b:c*d?e"f<g>h|i') === 'a-b-c-d-e-f-g-h-i');
  check('ยุบช่องว่างซ้ำ + ตัดหัวท้าย', B.safePlanName('  แผน   ที่ ๑  ') === 'แผน ที่ ๑');
  check('ชื่อไทยไม่ถูกแตะ', B.safePlanName('เส้นทางลับ') === 'เส้นทางลับ');
  check('ชื่อยาวเกินถูกตัด', B.safePlanName('x'.repeat(200)).length === 80);
  check('ถอดชื่อจากพาธไฟล์ได้',
        B.planNameFromFile('C:/p/Branches/เส้นทางหลัก.json') === 'เส้นทางหลัก' &&
        B.planNameFromFile('/a/b/x.json') === 'x');
  check('ชื่อซ้ำ → เติมเลข', B.uniquePlanName('แผน', ['แผน']) === 'แผน 2');
  check('ซ้ำหลายชั้น', B.uniquePlanName('แผน', ['แผน', 'แผน 2', 'แผน 3']) === 'แผน 4');
  check('ไม่ซ้ำ → ใช้ชื่อเดิม', B.uniquePlanName('ใหม่', ['แผน']) === 'ใหม่');
  check('เทียบชื่อไม่สนตัวพิมพ์', B.uniquePlanName('Plan', ['plan']) === 'Plan 2');
  check('รายการว่าง/null ไม่พัง', B.uniquePlanName('ก', null) === 'ก');
}

// ═══════════ planFromState + dirty ═══════════
{
  const st = { name: 'หลัก', note: '', positions: { a: { x: 1, y: 2 } }, colors: {},
               view: 'tree', zoom: 1.5, sel: 'x', now: '2026-08-12T00:00:00.000Z' };
  const p = B.planFromState(st);
  check('เก็บสภาพหน้าจอเป็นแผนได้', p.positions.a.x === 1 && p.zoom === 1.5 && p.sel === 'x');
  check('ประทับเวลาที่บันทึก', p.updated === '2026-08-12T00:00:00.000Z');

  check('ยังไม่เคยบันทึก + ยังไม่จัดอะไร → ไม่ถือว่ามีงานค้าง',
        B.planDirty(B.newBranchPlan('ก'), null) === false);
  check('ยังไม่เคยบันทึก + จัดการ์ดแล้ว → มีงานค้าง', B.planDirty(p, null) === true);
  check('เหมือนที่บันทึกไว้ → ไม่ dirty', B.planDirty(p, p) === false);
  const moved = JSON.parse(JSON.stringify(p)); moved.positions.a.x = 99;
  check('ย้ายการ์ด → dirty', B.planDirty(moved, p) === true);
  const colored = JSON.parse(JSON.stringify(p)); colored.colors.a = '#00ff00';
  check('เปลี่ยนสี → dirty', B.planDirty(colored, p) === true);
  const noted = JSON.parse(JSON.stringify(p)); noted.note = 'ใหม่';
  check('แก้โน้ต → dirty', B.planDirty(noted, p) === true);
  const selOnly = JSON.parse(JSON.stringify(p)); selOnly.sel = 'อื่น';
  check('แค่เลือกฉากอื่น (มุมมองล้วน) → ไม่ dirty', B.planDirty(selOnly, p) === false);
  const zoomed = JSON.parse(JSON.stringify(p)); zoomed.zoom = 2;
  check('ซูมเปลี่ยน → dirty (เป็นส่วนหนึ่งของแผน)', B.planDirty(zoomed, p) === true);
}

// ═══════════ เรียง + สรุป ═══════════
{
  const list = [{ name: 'ฮาโหล' }, { name: 'กขค' }, { name: 'มมม' }];
  check('เรียงตามชื่อไทย', B.sortPlans(list).map((x) => x.name).join() === 'กขค,มมม,ฮาโหล',
        B.sortPlans(list).map((x) => x.name).join());
  check('ไม่แก้ array เดิม', list[0].name === 'ฮาโหล');
  check('null ไม่พัง', B.sortPlans(null).length === 0);
  check('สรุปบอกจำนวนการ์ดที่จัดเอง',
        B.planSummary({ positions: { a: 1, b: 2 } }) === '2 การ์ดจัดเอง',
        B.planSummary({ positions: { a: 1, b: 2 } }));
  check('สรุปบอกจำนวนทางเลือก/ฉาก + สถานะ + แท็ก',
        B.planSummary({ choices: { s1: [{ text: 'ก' }, { text: 'ข' }], s2: [{ text: 'ค' }] },
                        status: 'ใช้จริง', tags: ['หลัก'] })
          === '3 ทางเลือก / 2 ฉาก · ใช้จริง · #หลัก',
        B.planSummary({ choices: { s1: [{ text: 'ก' }, { text: 'ข' }], s2: [{ text: 'ค' }] },
                        status: 'ใช้จริง', tags: ['หลัก'] }));
  check('แผนเปล่า → บอกว่ายังไม่ได้จัด', B.planSummary(B.newBranchPlan('x')) === 'ยังไม่ได้จัดอะไร');
  check('สรุปของ null ไม่พัง', typeof B.planSummary(null) === 'string');
  check('มุมมองรายการถูกบอกด้วย', B.planSummary({ view: 'list' }).includes('รายการ'));
}

// ═══════════ [alpha.74] แผนเก็บ "ทางเลือก" ของตัวเอง + คุณสมบัติแบบฉาก ═══════════
{
  const p = B.newBranchPlan('เส้นทาง D&D');
  check('[74] แผนใหม่มีคุณสมบัติแบบฉากครบ (สถานะ/สี/แท็ก/เล่ม/ทางเลือก)',
        p.status === B.PLAN_DEFAULT_STATUS && p.color === '' && Array.isArray(p.tags) &&
        p.book === '' && !!p.choices, JSON.stringify(Object.keys(p)));
  check('[74] มีสถานะให้เลือกครบตามที่ผู้ใช้อธิบาย (ร่าง/ใช้จริง/สำรอง)',
        ['ร่าง', 'ใช้จริง', 'สำรอง'].every((x) => B.PLAN_STATUSES.includes(x)), B.PLAN_STATUSES.join());
  check('[74] เวอร์ชันไฟล์ขึ้นเป็น 3', B.BRANCH_PLAN_VERSION === 3);
}

// ── ทางเลือกในแผน ──
{
  check('normalizeChoice: ต้องมีข้อความ',
        B.normalizeChoice({ text: 'ไปตลาด', nextSceneId: 's2' }).text === 'ไปตลาด' &&
        B.normalizeChoice({ text: '   ' }) === null && B.normalizeChoice(null) === null);
  check('normalizeChoice: เก็บสีเฉพาะที่เป็น hex',
        B.normalizeChoice({ text: 'ก', color: '#ff0000' }).color === '#ff0000' &&
        B.normalizeChoice({ text: 'ก', color: 'แดง' }).color === undefined);
  check('normalizeChoice: ไม่มีปลายทาง = ค่าว่าง ไม่ใช่ undefined',
        B.normalizeChoice({ text: 'ก' }).nextSceneId === '');
  const m = B.normalizeChoiceMap({ s1: [{ text: 'ก' }, { text: '' }], s2: [], s3: 'ไม่ใช่ array' });
  check('normalizeChoiceMap: ทิ้งทางเลือกว่าง + ฉากที่ไม่เหลืออะไร',
        Object.keys(m).join() === 's1' && m.s1.length === 1, JSON.stringify(m));

  const scenes = [{ id: 's1', title: 'เริ่ม', choices: [{ text: 'ซ้าย', nextSceneId: 's2' }] },
                  { id: 's2', title: 'กลาง', choices: [] },
                  { id: 's3', title: 'จบ' }];
  const snap = B.snapshotChoices(scenes);
  check('[74] ถ่ายทางเลือกปัจจุบันมาเป็นจุดตั้งต้นของแผนได้',
        Object.keys(snap).join() === 's1' && snap.s1[0].text === 'ซ้าย', JSON.stringify(snap));

  const plan = B.newBranchPlan('ทางลับ');
  B.setPlanChoices(plan, 's1', [{ text: 'ขวา', nextSceneId: 's3' }]);
  check('[74] ตั้งทางเลือกในแผนได้', B.planChoicesFor(plan, 's1')[0].text === 'ขวา');
  const applied = B.applyPlanChoices(scenes, plan);
  check('[74] เปิดแผนแล้วผังใช้ทางเลือกของแผน ไม่ใช่ของ scenes.json',
        applied[0].choices[0].text === 'ขวา' && applied[0].choices[0].nextSceneId === 's3',
        JSON.stringify(applied[0].choices));
  check('[74] ฉากที่แผนไม่ได้พูดถึง = ไม่มีทางเลือกในแผนนี้ (ลบออกจากแผนได้จริง)',
        applied[1].choices.length === 0 && applied[2].choices.length === 0);
  check('[74] ไม่แก้ข้อมูลฉากต้นฉบับ (scenes.json ยังเหมือนเดิม)',
        scenes[0].choices[0].text === 'ซ้าย');
  B.setPlanChoices(plan, 's1', []);
  check('[74] ตั้งเป็นรายการว่าง = ถอดฉากนั้นออกจากแผน', B.planChoicesFor(plan, 's1').length === 0 &&
        plan.choices.s1 === undefined);
  check('[74] ไม่ได้เปิดแผน → ใช้ของเดิมทั้งหมด',
        B.applyPlanChoices(scenes, null)[0].choices[0].text === 'ซ้าย');
}

// ── เทียบสองแผน (เหตุผลข้อ 1: ทำงานหลายคน) ──
{
  const a = B.newBranchPlan('ของเอ');
  const b = B.newBranchPlan('ของบี');
  B.setPlanChoices(a, 's1', [{ text: 'ซ้าย', nextSceneId: 's2' }]);
  B.setPlanChoices(b, 's1', [{ text: 'ซ้าย', nextSceneId: 's2' }]);
  B.setPlanChoices(a, 's2', [{ text: 'สู้', nextSceneId: 's4' }]);
  B.setPlanChoices(b, 's2', [{ text: 'หนี', nextSceneId: 's5' }]);
  B.setPlanChoices(a, 's9', [{ text: 'เฉพาะเอ' }]);
  const rows = B.comparePlans(a, b, (id) => 'ฉาก ' + id);
  check('[74] เทียบครบทุกฉากที่เกี่ยวข้อง', rows.length === 3, rows.map((r) => r.sceneId).join());
  check('[74] ฉากที่เหมือนกันถูกทำเครื่องหมายว่าเหมือน',
        rows.find((r) => r.sceneId === 's1').same === true);
  check('[74] ฉากที่ต่างกันถูกจับได้', rows.find((r) => r.sceneId === 's2').same === false);
  check('[74] ฉากที่มีเฉพาะแผนเอ', rows.find((r) => r.sceneId === 's9').only === 'a');
  check('[74] ใส่ชื่อฉากให้อ่านออกได้', rows[0].title === 'ฉาก s1');
  const sum = B.compareSummary(rows);
  check('[74] สรุปผลเทียบ', sum.total === 3 && sum.same === 1 && sum.diff === 1 && sum.onlyA === 1 && sum.onlyB === 0,
        JSON.stringify(sum));
  check('[74] เทียบกับแผนเปล่า/null ไม่พัง',
        B.comparePlans(a, null).length === 3 && B.compareSummary(null).total === 0);
}

// ── คุณสมบัติแบบฉาก: อ่าน/เขียน/dirty ──
{
  const raw = { name: 'x', status: 'ใช้จริง', color: '#00ff00', tags: [' หลัก ', '', 'ดี'],
                book: 'เล่มหนึ่ง', choices: { s1: [{ text: 'ก' }] } };
  const n = B.normalizeBranchPlan(raw, 'x');
  check('[74] อ่านคุณสมบัติแบบฉากได้ครบ',
        n.status === 'ใช้จริง' && n.color === '#00ff00' && n.tags.join() === 'หลัก,ดี' && n.book === 'เล่มหนึ่ง');
  check('[74] สถานะแปลก ๆ → ค่าเริ่มต้น',
        B.normalizeBranchPlan({ status: 'ไม่มีจริง' }, 'x').status === B.PLAN_DEFAULT_STATUS);
  check('[74] สีที่ไม่ใช่ hex ถูกทิ้ง', B.normalizeBranchPlan({ color: 'แดง' }, 'x').color === '');
  check('[74] tags ที่ไม่ใช่ array ไม่พัง', B.normalizeBranchPlan({ tags: 'ก' }, 'x').tags.length === 0);

  const saved = B.planFromState({ name: 'x', status: 'ร่าง', choices: { s1: [{ text: 'ก' }] }, now: 'T' });
  const cur = JSON.parse(JSON.stringify(saved));
  check('[74] ไม่แก้อะไร → ไม่ dirty', B.planDirty(cur, saved) === false);
  cur.status = 'ใช้จริง';
  check('[74] เปลี่ยนสถานะ → dirty', B.planDirty(cur, saved) === true);
  const cur2 = JSON.parse(JSON.stringify(saved));
  B.setPlanChoices(cur2, 's2', [{ text: 'ใหม่' }]);
  check('[74] เพิ่มทางเลือก → dirty', B.planDirty(cur2, saved) === true);
  const cur3 = JSON.parse(JSON.stringify(saved));
  cur3.tags = ['สำรอง'];
  check('[74] ติดแท็ก → dirty', B.planDirty(cur3, saved) === true);
  check('[74] แผนใหม่ที่มีทางเลือกแล้วแต่ยังไม่บันทึก = มีงานค้าง',
        B.planDirty(cur2, null) === true);
}

console.log(`branch-plans: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
