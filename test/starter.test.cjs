// test/starter.test.cjs — โมดูลบริสุทธิ์ของ Story Starter (alpha.94)
//
// ครอบ 5 ไฟล์: starter-model · starter-steps-def · starter-choices · starter-prompt · starter-wiki-merge
// เน้นสามเรื่องที่ "พังเงียบ" ได้ง่ายที่สุด:
//   1. ทะเบียนขั้น — เพิ่ม/ลดขั้นแล้วแถบความคืบหน้าต้องยังถูก
//   2. ตัวอ่านทางเลือก — โมเดลไม่ทำตามฟอร์แมตแล้วต้องยังใช้งานได้ (ไล่ชั้น)
//   3. สายของ scenario — ไฟล์ถูกแก้นอกโปรแกรมจนชี้วนกันเอง ต้องไม่ค้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(rel, out) {
  const file = path.join(os.tmpdir(), out);
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', rel)], outfile: file,
                      format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(file);
}

const M = load('src/starter/starter-model.js', '_st_model.cjs');
const D = load('src/starter/starter-steps-def.js', '_st_steps.cjs');
const C = load('src/starter/starter-choices.js', '_st_choices.cjs');
const P = load('src/starter/starter-prompt.js', '_st_prompt.cjs');
const W = load('src/starter/starter-wiki-merge.js', '_st_merge.cjs');
const BG = load('src/branch-graph.js', '_st_bg.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  x FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ 1. โครงข้อมูล + เวอร์ชัน ═══════════
{
  const s = M.newStarter({ name: 'เมืองใต้ทะเล' });
  check('starter ใหม่มีเวอร์ชัน', s.v === M.STARTER_VERSION && s.v === 2);
  check('ค่าเริ่มต้นครบ', Array.isArray(s.tags) && Array.isArray(s.cast)
        && typeof s.w === 'object' && s.step === 0 && s.done === false);
  check('โฟลเดอร์ตามสเปกข้อ 9', M.STARTER_DIR === 'Starters' && M.SCENARIO_DIR === 'Scenarios');

  // ไฟล์ที่ไม่มี v (ของก่อนมีเวอร์ชัน) ต้องเปิดได้
  const old = M.migrateStarter({ name: 'เก่า', tags: ['a', 'a', ' b '], junk: 1 });
  check('migrate ไฟล์ไม่มี v ได้', old.v === M.STARTER_VERSION && old.name === 'เก่า');
  check('migrate ตัดแท็กซ้ำ/ช่องว่าง', old.tags.join(',') === 'a,b', JSON.stringify(old.tags));
  check('migrate ทิ้ง field ที่ไม่รู้จัก', old.junk === undefined);
  check('migrate ของพัง/null ไม่ล้ม', M.migrateStarter(null).v === M.STARTER_VERSION
        && M.migrateStarter(7).v === M.STARTER_VERSION);
}

// ═══════════ 2. ชื่อโฟลเดอร์ (พกพาข้ามเครื่อง) ═══════════
{
  check('ไทยใช้เป็นชื่อโฟลเดอร์ได้', M.slugify('เมืองใต้ทะเล') === 'เมืองใต้ทะเล');
  check('ตัดอักขระต้องห้ามของ Windows', M.slugify('a/b:c*d?e"f<g>h|i') === 'abcdefghi');
  check('ช่องว่างกลายเป็นขีด', M.slugify('  โลก   ใหม่  ') === 'โลก-ใหม่', M.slugify('  โลก   ใหม่  '));
  check('ขึ้นต้นด้วยจุดไม่ได้ (ไฟล์ซ่อนบน mac)', M.slugify('...ซ่อน') === 'ซ่อน');
  check('ว่างเปล่า → ชื่อสำรอง', M.slugify('') === 'starter' && M.slugify('///') === 'starter');
  check('ยาวเกินถูกตัด', M.slugify('ก'.repeat(200)).length <= 48);
  check('กันชื่อซ้ำ', M.uniqueSlug('เรื่อง', ['เรื่อง']) === 'เรื่อง-2');
  check('กันชื่อซ้ำหลายชั้น', M.uniqueSlug('เรื่อง', ['เรื่อง', 'เรื่อง-2']) === 'เรื่อง-3');
}

// ═══════════ 3. แท็ก ═══════════
{
  check('toggle เพิ่มแล้วเอาออกได้', M.toggleTag(M.toggleTag([], 'dark'), 'dark').length === 0);
  check('toggle ไม่สนตัวพิมพ์', M.toggleTag(['Dark'], 'dark').length === 0);
  check('hasTag ไม่สนตัวพิมพ์', M.hasTag(['Fantasy'], 'fantasy') === true);
  check('แท็กว่างถูกทิ้ง', M.normalizeTags(['', '  ', 'x']).join() === 'x');
  check('แท็กสำเร็จรูปเป็นอังกฤษ (ส่งเข้า prompt ได้)',
        D.presetTags().every((x) => !/[฀-๿]/.test(x)));
  check('รู้ว่าอันไหนผู้ใช้พิมพ์เอง', D.isPresetTag('fantasy') && !D.isPresetTag('มุ้งมิ้ง'));
}

// ═══════════ 4. ทะเบียนขั้น — หัวใจของการต่อยอด ═══════════
{
  check('มี 5 ขั้นตามสเปก', D.STEPS.length === 5, String(D.STEPS.length));
  check('ทุกขั้นมี filled() เป็นฟังก์ชัน', D.STEPS.every((x) => typeof x.filled === 'function'));
  check('ไอดีขั้นไม่ซ้ำ', new Set(D.STEPS.map((x) => x.id)).size === D.STEPS.length);
  check('4W กับปก ข้ามได้', D.stepById('w').required === false && D.stepById('cover').required === false);

  const empty = M.newStarter({});
  const p0 = M.starterProgress(empty, D.STEPS);
  check('เริ่มต้น 0%', p0.done === 0 && p0.pct === 0);
  check('นับเฉพาะขั้นที่บังคับ', p0.total === D.STEPS.filter((x) => x.required !== false).length && p0.total === 3);

  const full = M.newStarter({ name: 'ก', intro: 'ข', tags: ['dark'],
                              cast: [{ name: 'มานี' }] });
  const p1 = M.starterProgress(full, D.STEPS);
  check('กรอกครบ = 100%', p1.pct === 100 && M.starterReady(full, D.STEPS), JSON.stringify(p1));
  check('ตัวละครไม่มีชื่อไม่นับ',
        M.starterProgress(M.newStarter({ name: 'ก', intro: 'ข', tags: ['d'], cast: [{ name: '  ' }] }),
                          D.STEPS).pct !== 100);
  check('บอกได้ว่าติดขั้นไหน',
        M.missingSteps(M.newStarter({ tags: ['d'] }), D.STEPS).map((x) => x.id).join() === 'intro,cast');

  // ขั้นที่ filled() ระเบิด ต้องไม่ทำทั้งแถบล่ม
  check('filled() ที่ throw ถูกกลืน',
        M.stepFilled({}, { filled: () => { throw new Error('boom'); } }) === false);
  check('clampStep กันไฟล์เก่าที่ step เกิน', D.clampStep(99) === D.STEPS.length - 1
        && D.clampStep(-5) === 0 && D.clampStep('x') === 0);
}

// ═══════════ 5. 4W เป็น map เปิด ═══════════
{
  check('มี 4 ช่องและคีย์เป็นอังกฤษ',
        D.W_FIELDS.map((f) => f.key).join() === 'what,when,where,why');
  const s = M.newStarter({ w: { what: 'ตามหาดาบ', why: '  ', extra: 'ของที่เพิ่มมาทีหลัง' } });
  check('เก็บคีย์ที่ไม่รู้จักไว้ (เพิ่มช่องทีหลังได้)', s.w.extra === 'ของที่เพิ่มมาทีหลัง');
  check('filledW เอาเฉพาะช่องที่มีค่าจริง', D.filledW(s).length === 1 && D.filledW(s)[0].key === 'what');
}

// ═══════════ 6. ตัวอ่านทางเลือก — ไล่ชั้น ═══════════
{
  const withBlock = 'เขาเปิดประตูออกไป\n\n<<CHOICES>>\n1. เดินเข้าไป\n2. ถอยกลับ\n3. ตะโกนถาม\n<<END>>';
  check('ชั้น 1 บล็อกที่สั่งไว้', C.parseChoices(withBlock).join('|') === 'เดินเข้าไป|ถอยกลับ|ตะโกนถาม');
  check('ตัดบล็อกออกจากเนื้อเรื่อง', C.stripChoices(withBlock) === 'เขาเปิดประตูออกไป');
  check('บล็อกถูกตัดกลางคัน (ไม่มีป้ายปิด) ยังอ่านได้',
        C.parseChoices('x\n<<CHOICES>>\n1. ก\n2. ข').join('|') === 'ก|ข');

  check('ชั้น 2 JSON', C.parseChoices('เรื่องราว\n["ไปทางซ้าย","ไปทางขวา"]').join('|') === 'ไปทางซ้าย|ไปทางขวา');
  check('ชั้น 2 JSON แบบ object', C.parseChoices('[{"text":"ก"},{"text":"ข"}]').join('|') === 'ก|ข');

  check('ชั้น 3 รายการท้ายข้อความ',
        C.parseChoices('เขายืนนิ่ง\n\n1. วิ่งหนี\n2. สู้').join('|') === 'วิ่งหนี|สู้');
  check('ชั้น 3 จุดนำก็ได้', C.parseChoices('ก\n\n- หนึ่ง\n- สอง').join('|') === 'หนึ่ง|สอง');
  check('รายการเดียวไม่ใช่ทางแยก', C.parseChoices('ก\n\n1. อันเดียว').length === 0);

  check('ชั้น 4 ไม่มีทางเลือก = ว่าง ไม่ใช่ error', C.parseChoices('เรื่องเล่าเฉย ๆ').length === 0);
  check('ข้อความว่าง/null ไม่ล้ม', C.parseChoices('').length === 0 && C.parseChoices(null).length === 0);
  check('stripChoices ที่ไม่มีบล็อก คืนของเดิม', C.stripChoices('เนื้อเรื่อง') === 'เนื้อเรื่อง');

  check('ตัดซ้ำ', C.normalizeChoices(['ก', 'ก', 'ข']).join('|') === 'ก|ข');
  check('ตัดอัญประกาศครอบ', C.normalizeChoices(['"ก"']).join() === 'ก');
  check('ยาวเกิน = ย่อหน้า ไม่ใช่ตัวเลือก', C.normalizeChoices(['x'.repeat(200)]).length === 0);
  check('จำกัดจำนวน', C.normalizeChoices(['1', '2', '3', '4', '5', '6', '7', '8']).length === C.MAX_CHOICES);

  // สัญญากับระบบเรื่องแตกสาย
  check('มาร์กเกอร์เป็น [ข้อความ]', C.choiceMarker('เดินเข้าไป') === '[เดินเข้าไป]');
  check('วงเล็บเหลี่ยมในตัวข้อความถูกถอด (ไม่งั้นตัวสแกนอ่านผิด)',
        C.choiceMarker('ไป[ที่นั่น]') === '[ไปที่นั่น]');
  check('ตัวเลือกว่าง = ไม่มีมาร์กเกอร์', C.choiceMarker('  ') === '');
  check('แถวสำหรับ scenes.json ใช้ชื่อฟิลด์ที่ buildGraph อ่านได้จริง',
        JSON.stringify(C.choiceRows(['ก'])) === '[{"text":"ก","nextSceneId":""}]',
        JSON.stringify(C.choiceRows(['ก'])));

  // prompt กับ parser ต้องพูดภาษาเดียวกัน — เคยพลาดกันมาแล้วในฟีเจอร์อื่น
  check('คำสั่งใน prompt ใช้ป้ายเดียวกับตัวอ่าน',
        C.choiceInstruction().includes(C.OPEN_TAG) && C.choiceInstruction().includes(C.CLOSE_TAG));
}

// ═══════════ 7. prompt ═══════════
{
  const s = M.newStarter({
    name: 'ดาบแห่งรุ่งอรุณ', tags: ['fantasy', 'dark'], intro: 'โลกที่ดวงอาทิตย์ไม่ขึ้นอีกแล้ว',
    w: { what: 'ตามหาดาบ', where: 'เมืองเหนือ' },
    cast: [{ id: 'c1', name: 'มานี', gender: 'female', persona: 'นักดาบสาว' },
           { id: 'c2', name: 'ปิติ', persona: 'พ่อค้าเร่' }],
  });
  const blk = P.starterBlock(s);
  check('ก้อนข้อมูลมีชื่อเรื่อง', blk.includes('ดาบแห่งรุ่งอรุณ'));
  check('ก้อนข้อมูลมีแท็ก', blk.includes('fantasy') && blk.includes('dark'));
  check('ก้อนข้อมูลมี 4W ที่กรอกแล้วเท่านั้น', blk.includes('ตามหาดาบ') && !blk.includes('why'));
  check('ก้อนข้อมูลมีตัวละครครบ', blk.includes('มานี') && blk.includes('ปิติ'));

  const cp = P.charDescPrompt(s, s.cast[0]);
  check('เขียนคำบรรยายตัวละคร: กันตัวเองออกจากรายชื่อเพื่อน (ไม่ให้ลอกของเดิม)',
        cp.includes('ปิติ') && cp.split('มานี').length - 1 <= 2, cp.split('มานี').length - 1);
  check('เขียนคำบรรยายตัวละคร: มีบริบทเรื่อง', cp.includes('โลกที่ดวงอาทิตย์'));

  const gm = P.gmSystem(s, { title: 'ตอนที่ 1', synopsis: 'ออกเดินทาง' }, { userChars: ['c1'] });
  check('GM ได้ข้อมูล starter ทั้งหมด (สเปกข้อ 13)', gm.includes('ดาบแห่งรุ่งอรุณ') && gm.includes('มานี'));
  check('GM รู้ว่าห้ามพูดแทนตัวไหน', gm.includes('มานี'));
  check('GM ได้คำสั่งเรื่องทางเลือก', gm.includes(C.OPEN_TAG));

  check('clip ไม่ตัดกลางคำ', P.clip('abc def ghi', 8).endsWith('…') && !P.clip('abc def ghi', 8).includes('gh'));
  check('clip ข้อความสั้นไม่แตะ', P.clip('สั้น', 100) === 'สั้น');

  // ส่งต่อระหว่างตอน: ต้องใช้บทย่อ ไม่ใช่บทเต็ม (กันบริบทบวม)
  const sy = P.synopsisPrompt(s, { title: 'ตอนที่ 2' },
                              { title: 'ตอนที่ 1', synopsis: 'บทย่อของตอนก่อน' });
  check('ตอนถัดไปได้บทย่อของตอนก่อน', sy.includes('บทย่อของตอนก่อน'));
}

// ═══════════ 8. Scenario ═══════════
{
  const sc = M.newScenario({ title: 'ตอนที่ 1' });
  check('scenario ใหม่มีเวอร์ชัน', sc.v === M.SCENARIO_VERSION && Array.isArray(sc.turns));
  check('ยังไม่ได้เล่น', M.hasPlay(sc) === false);

  let s2 = M.addTurn(sc, { role: M.ROLE_GM, text: 'เปิดฉาก', choices: ['ก', 'ข'] });
  check('เพิ่มเทิร์นแล้วไม่แก้ของเดิมในที่', sc.turns.length === 0 && s2.turns.length === 1);
  check('ทางเลือกค้างอยู่หลังเทิร์น GM', M.openChoices(s2).join('|') === 'ก|ข');
  s2 = M.addTurn(s2, { role: M.ROLE_PLAYER, text: 'ก', chosen: 'ก' });
  check('ผู้เล่นตอบแล้ว ทางเลือกไม่ค้าง', M.openChoices(s2).length === 0);
  check('role แปลก ๆ ตกเป็น gm', M.newTurn({ role: 'zzz' }).role === M.ROLE_GM);
  // ประวัติการแปลงต้องรอด migrate — field ที่ไม่ได้ประกาศในโมเดลจะถูกตัดทิ้งเงียบ ๆ
  // (e2e ของเฟส 4 จับได้ตอนอ่านไฟล์กลับมาแล้ว exports หายไปทั้งก้อน)
  check('ประวัติการแปลงรอดการอ่านไฟล์กลับ',
        M.migrateScenario({ exports: [{ at: 1, format: 'prose', path: '/x.md' }] }).exports.length === 1);
  check('ประวัติการแปลงที่พังไม่ทำให้ตอนล่ม',
        M.migrateScenario({ exports: 'ไม่ใช่อาร์เรย์' }).exports.length === 0);

  const st = M.scenarioStats(s2);
  check('สถิติแยกฝั่งถูก', st.turns === 2 && st.gm === 1 && st.player === 1);

  const tr = M.transcriptText(s2, (id) => (id === 'c1' ? 'มานี' : ''));
  check('บทสนทนาเป็นข้อความล้วน', tr.includes('เปิดฉาก'));

  // สายของตอน — ไฟล์แก้นอกโปรแกรมได้ ต้องกันวงซ้ำ
  const rows = [M.newScenario({ id: 'a', title: '1' }),
                M.newScenario({ id: 'b', title: '2', prevId: 'a' }),
                M.newScenario({ id: 'c', title: '3', prevId: 'b' })];
  check('สายตอนเรียงจากต้น', M.chainOf(rows, 'c').map((x) => x.id).join() === 'a,b,c');
  const loop = [M.newScenario({ id: 'x', prevId: 'y' }), M.newScenario({ id: 'y', prevId: 'x' })];
  check('prevId ชี้วนกันเองไม่ค้าง', M.chainOf(loop, 'x').length === 2);
  check('เลือกตอนก่อนหน้าได้เฉพาะที่ไม่ใช่ลูกหลาน (กันวง)',
        M.selectablePrev(rows, 'a').map((x) => x.id).join() === '',
        M.selectablePrev(rows, 'a').map((x) => x.id).join());
  check('ตอนที่ยังไม่มีลูก เลือกใครก็ได้ที่ไม่ใช่ตัวเอง',
        M.selectablePrev(rows, 'c').map((x) => x.id).join() === 'a,b');
  check('ค้นหาข้ามตอนที่จัดเก็บแล้ว',
        M.searchScenarios([...rows, M.newScenario({ id: 'z', title: '9', archived: true })], '').length === 3);
}

// ═══════════ 9. จับคู่ Wiki ตอนย้ายโปรเจกต์ ═══════════
{
  const ents = [
    { file: 'Wiki/characters/manee.json', id: 'e1', name: 'มานี', aliases: ['นักดาบ'] },
    { file: 'Wiki/characters/piti.json', id: 'e2', name: 'ปิติ', aliases: [] },
  ];
  check('ชื่อตรง = ผูกของเดิม',
        W.matchChar({ name: 'มานี' }, ents).status === W.MATCH_EXACT);
  check('ไทยไม่มีช่องว่าง — เทียบแล้วต้องตรง',
        W.matchChar({ name: ' มา นี ' }, ents).status === W.MATCH_EXACT);
  check('ตรงกับชื่อรอง', W.matchChar({ name: 'นักดาบ' }, ents).status === W.MATCH_ALIAS);
  check('ไม่มีในโปรเจกต์นี้ = สร้างใหม่',
        W.defaultAction(W.matchChar({ name: 'ชูใจ' }, ents).status) === W.ACT_CREATE);
  check('ชื่อชนกันหลายตัว = ไม่เดา ให้คนเลือก',
        W.matchChar({ name: 'ก' }, [{ file: 'a', name: 'ก' }, { file: 'b', name: 'ก' }]).status === W.MATCH_AMBIGUOUS);
  check('path เดิมยังอยู่ = ตัวเดียวกันแน่นอน',
        W.matchChar({ name: 'ชื่อเปลี่ยนไปแล้ว', wikiPath: 'Wiki/characters/piti.json' }, ents).hit.id === 'e2');
  check('path เดิมหายไป (ย้ายโปรเจกต์) ไม่ล้ม ตกไปเทียบชื่อแทน',
        W.matchChar({ name: 'มานี', wikiPath: 'ของโปรเจกต์เก่า/x.json' }, ents).status === W.MATCH_EXACT);

  const plan = W.planMerge([{ name: 'มานี' }, { name: 'ชูใจ' }, { name: '  ' }], ents);
  check('ตัวละครไม่มีชื่อไม่เข้าแผน', plan.length === 2);
  check('สรุปแผนถูก', W.mergeSummary(plan).link === 1 && W.mergeSummary(plan).create === 1);
  check('ไม่มีอะไรให้ตัดสิน = ไม่ต้องถาม', W.needsAttention(plan) === false);

  // แปลงร่างสองทาง
  const e = { name: 'มานี', aliases: ['นักดาบ'], entityTypeKey: 'characters',
              fields: { อายุ: '17' }, customProperties: { สังกัด: 'เหนือ' },
              sections: [{ title: 'ประวัติ', content: 'เกิดที่เมืองเหนือ' }, { title: 'ว่าง', content: '' }] };
  const flat = W.flattenEntityText(e);
  check('ดึงจาก Wiki แล้วเรียงเป็นช่องเดียว (สเปกข้อ 6)',
        flat.includes('อายุ: 17') && flat.includes('สังกัด: เหนือ') && flat.includes('เกิดที่เมืองเหนือ'));
  check('ส่วนที่ว่างไม่ถูกใส่มา', !flat.includes('ว่าง'));

  const ch = M.newChar(W.charPatchFromEntity(e, 'Wiki/characters/manee.json'));
  check('ดึงเข้ามาแล้วรู้ว่ามาจาก Wiki', ch.fromWiki === true && ch.wikiPath.endsWith('manee.json'));
  check('ตัวละครของ starter ใช้โครงเดียวกับห้องซ้อมบท',
        'persona' in ch && 'blurb' in ch && 'aliases' in ch && 'gender' in ch && 'image' in ch);

  const out = W.entityFromChar({ name: 'ชูใจ', persona: 'เด็กสาวลึกลับ' }, { id: 'g1' });
  check('เขียนกลับ Wiki เป็นส่วนเดียว', out.sections.length === 1 && out.sections[0].content === 'เด็กสาวลึกลับ');
  check('entity ที่สร้างมีคีย์ครบตามที่ Wiki ต้องการ',
        ['id', 'entityTypeKey', 'name', 'aliases', 'fields', 'customProperties', 'images',
         'sections', 'relationships', 'chapterOverrides', 'templateId'].every((k) => k in out));

  const merged = W.applyCharToEntity(e, { persona: 'ข้อความใหม่', aliases: ['นักดาบ', 'สาวเหนือ'] });
  check('อัปเดตแล้วไม่ทับส่วนที่ผู้ใช้เขียนเองใน Wiki',
        merged.sections.some((x) => x.title === 'ประวัติ' && x.content === 'เกิดที่เมืองเหนือ'));
  check('ชื่อรองใหม่ถูกเติม ไม่ซ้ำของเดิม',
        merged.aliases.join() === 'นักดาบ,สาวเหนือ', merged.aliases.join());
}


// ═══════════ 10. [เฟส 4] แบ่งก้อนบทยาว + ต่อกลับ ═══════════
const RP = load('src/starter/starter-render-prose.js', '_st_rp.cjs');
const RS = load('src/starter/starter-render-sp.js', '_st_rs.cjs');
{
  const mk = (role, text) => M.newTurn({ role, text });
  const long = 'ก'.repeat(1200);
  const turns = [];
  for (let i = 0; i < 8; i++) {
    turns.push(mk(M.ROLE_GM, long));
    turns.push(mk(M.ROLE_PLAYER, 'ตอบสั้น ๆ'));
  }
  const chunks = RP.chunkTurns(turns);
  check('[เฟส4] บทยาวถูกแบ่งเป็นหลายก้อน', chunks.length > 1, 'ก้อน=' + chunks.length);
  check('[เฟส4] ไม่มีเทิร์นหาย', chunks.reduce((n, c) => n + c.length, 0) === turns.length);
  // กติกาสำคัญ: ตัดตรงหัวเทิร์น GM เท่านั้น ไม่งั้นก้อนถัดไปไม่รู้ว่าใครพูดค้างไว้
  check('[เฟส4] ทุกก้อน (ยกเว้นก้อนแรก) เริ่มด้วยเทิร์นของผู้เล่าเรื่อง',
        chunks.slice(1).every((c) => c[0].role === M.ROLE_GM));
  check('[เฟส4] บทสั้นไม่ถูกแบ่ง', RP.chunkTurns([mk(M.ROLE_GM, 'สั้น')]).length === 1);
  check('[เฟส4] ไม่มีเทิร์นเลยก็ไม่ล้ม', RP.chunkTurns([]).length === 1);
  check('[เฟส4] เทิร์นข้อความว่างถูกทิ้ง',
        RP.chunkTurns([mk(M.ROLE_GM, '  '), mk(M.ROLE_GM, 'มีเนื้อ')])[0].length === 1);

  check('[เฟส4] ไทยถูกคิดโทเคนแพงกว่าอังกฤษต่ออักขระ',
        RP.roughTokens('กกกกกกกกกก') > RP.roughTokens('aaaaaaaaaa'));
  check('[เฟส4] ต่อก้อนแล้วไม่มีบรรทัดว่างเกิน',
        RP.stitch(['ก\n\n\n\n', '\n\nข']) === 'ก\n\nข', JSON.stringify(RP.stitch(['ก\n\n\n\n', '\n\nข'])));
  check('[เฟส4] ท้ายก้อนส่งต่อเป็นบริบทได้', RP.tailOf('12345', 3) === '345');

  // ทางแยกที่ยังไม่ได้ตอบ → มาร์กเกอร์ในเนื้อฉาก
  const body = RP.proseBody('เขายืนอยู่หน้าประตู', ['เดินเข้าไป', 'ถอยกลับ']);
  check('[เฟส4] ฉากนิยายจบด้วยมาร์กเกอร์ทางแยก',
        body.includes('[เดินเข้าไป]') && body.includes('[ถอยกลับ]'));
  check('[เฟส4] ไม่มีทางแยก = ไม่มีหัวข้อทางแยกโผล่มาเปล่า ๆ',
        RP.proseBody('จบแล้ว', []) === 'จบแล้ว');
}

// ═══════════ 11. [เฟส 4] รหัสนำหน้าบรรทัดของบทภาพยนตร์ ═══════════
{
  const names = ['มานี', 'ปิติ'];
  const raw = [
    'INT. ห้องนอน - คืน',
    '',
    'มานีนั่งอยู่ริมหน้าต่าง',
    '',
    'มานี',
    '(กระซิบ)',
    'เธอมาสายอีกแล้ว',
    '',
    'CUT TO:',
  ].join('\n');
  const out = RS.normalizeFountain(raw, names);
  check('[เฟส4] หัวฉากได้รหัส ###', out.includes('### INT. ห้องนอน - คืน'), out);
  check('[เฟส4] ชื่อผู้พูดได้รหัส @', out.includes('@มานี'));
  check('[เฟส4] วงเล็บอารมณ์ใต้ชื่อได้รหัส (( ))', out.includes('((กระซิบ))'));
  check('[เฟส4] ทรานซิชันได้รหัส >>', out.includes('>> CUT TO:'));
  check('[เฟส4] บรรยายไม่ถูกใส่รหัส', out.includes('\nมานีนั่งอยู่ริมหน้าต่าง'));
  check('[เฟส4] บทพูดใต้ชื่อไม่ถูกใส่รหัส', out.includes('\nเธอมาสายอีกแล้ว'));

  // โมเดลใส่รหัสมาเองแล้ว = ห้ามใส่ซ้ำ
  const already = RS.normalizeFountain('### INT. ตลาด - เช้า\n\n@ปิติ\nสวัสดี', names);
  check('[เฟส4] ของที่มีรหัสอยู่แล้วไม่ถูกใส่ซ้ำ',
        !already.includes('### ### ') && !already.includes('@@'), already);

  // วงเล็บที่ไม่ได้อยู่ใต้ชื่อ = บรรยายในวงเล็บ ไม่ใช่อารมณ์การพูด
  check('[เฟส4] วงเล็บกลางบรรยายไม่ถูกแปลงเป็นอารมณ์',
        !RS.normalizeFountain('เขาเดินเข้ามา\n\n(เสียงลมพัด)', names).includes('(('));
  check('[เฟส4] ชื่อที่ไม่ได้อยู่ในเรื่อง ไม่ถูกเดาว่าเป็นผู้พูด',
        !RS.normalizeFountain('ใครสักคน\nพูดอะไรบางอย่าง', names).includes('@ใครสักคน'));
  check('[เฟส4] ALL CAPS อังกฤษยังถือเป็นชื่อผู้พูดตามธรรมเนียมบท',
        RS.normalizeFountain('JOHN\nHello.', []).includes('@JOHN'));

  // ทางแยกในบทต้องเป็นโน้ต ไม่งั้นไปกินบรรทัดของหน้ากระดาษ (บทนับ 54 บรรทัด/หน้า)
  const spb = RS.spBody('### INT. ที่ไหนสักแห่ง - วัน\n\nเขายืนนิ่ง', ['สู้', 'หนี'], names);
  check('[เฟส4] ทางแยกในบทเป็นโน้ต ไม่กินบรรทัดของหน้า',
        spb.includes('/// [สู้]') && spb.includes('/// [หนี]'), spb);
  check('[เฟส4] มาร์กเกอร์ในโน้ตยังถูกระบบแตกสายอ่านเจอ',
        BG.scanChoiceMarkers(spb).map((x) => x.text).sort().join() === 'สู้,หนี');
}

// ═══════════ 12. [alpha.96] Story Description เป็น HTML ═══════════
const H = load('src/starter/starter-html.js', '_st_html.cjs');
{
  // กรอง: ของอันตรายต้องหายทั้งก้อน ไม่ใช่แค่ถอดแท็กแล้วเนื้อในโผล่มาเป็นข้อความ
  check('[96] สคริปต์ถูกทิ้งทั้งก้อน',
        !H.sanitizeHtml('<p>ก</p><script>alert(1)</script>').includes('alert'),
        H.sanitizeHtml('<p>ก</p><script>alert(1)</script>'));
  check('[96] สไตล์ถูกทิ้งทั้งก้อน', !H.sanitizeHtml('<style>p{}</style>ข').includes('p{}'));
  check('[96] ตัวจัดการอีเวนต์ถูกถอด',
        !H.sanitizeHtml('<p onclick="x()">ก</p>').includes('onclick'));
  check('[96] javascript: ในลิงก์ถูกถอด',
        !H.sanitizeHtml('<a href="javascript:x()">ก</a>').includes('javascript'));
  check('[96] แท็กที่อนุญาตอยู่ครบ',
        H.sanitizeHtml('<p><b>ก</b><i>ข</i><u>ค</u></p>') === '<p><b>ก</b><i>ข</i><u>ค</u></p>');
  check('[96] แท็กแปลกถูกถอดแต่เนื้อในอยู่',
        H.sanitizeHtml('<marquee>ก</marquee>') === 'ก');
  check('[96] จัดหน้าไม่ถูกทิ้ง (ผู้ใช้ขอ ซ้าย/กลาง/ขวา)',
        H.sanitizeHtml('<p style="text-align: center">ก</p>').includes('text-align'));
  check('[96] style ที่ไม่เกี่ยวถูกตัด',
        !H.sanitizeHtml('<p style="position: fixed">ก</p>').includes('position'));
  check('[96] ค่าว่าง/null ไม่ล้ม', H.sanitizeHtml('') === '' && H.sanitizeHtml(null) === '');

  // ที่อยู่รูป: เก็บสัมพัทธ์เสมอ ไม่งั้นย้ายโปรเจกต์แล้วรูปตาย
  const abs = '<img src="file:///Users/x/Starters/เรื่อง/images/a.png" />';
  check('[96] เก็บลงไฟล์เป็น images/… ไม่ใช่ที่อยู่เต็ม',
        H.htmlToStorage(abs) === '<img src="images/a.png" />', H.htmlToStorage(abs));
  check('[96] คลายกลับเป็นที่อยู่เต็มตอนวาด',
        H.htmlToDisplay('<img src="images/a.png" />', 'file:///p/s')
          === '<img src="file:///p/s/images/a.png" />');
  check('[96] ไป-กลับแล้วได้ของเดิม',
        H.htmlToStorage(H.htmlToDisplay('<img src="images/a.png" />', 'file:///p/s'))
          === '<img src="images/a.png" />');
  check('[96] ไม่มี base = ไม่แตะ', H.htmlToDisplay('<img src="images/a.png" />', '') .includes('images/a.png'));
  check('[96] รูปจากเน็ตไม่ถูกแปลง (ไม่ใช่ของเรา)',
        H.htmlToStorage('<img src="https://x/a.png" />').includes('https://x/a.png'));
  check('[96] บอกได้ว่าอ้างรูปไหนบ้าง',
        H.referencedImages('<img src="images/a.png"><img src="images/b.png"><img src="images/a.png">')
          .join() === 'a.png,b.png');
}

// ═══════════ 13. [alpha.96] ช่องที่เพิ่มมา + โทเคน ═══════════
{
  check('[96] มีช่องผู้แต่ง/คำโปรย/แบนเนอร์',
        ['author', 'blurb', 'banner'].every((k) => k in M.newStarter({})));
  check('[96] HTML ถูกแปลงเป็นข้อความล้วนก่อนส่งโมเดล',
        M.introText({ intro: '<p>บรรทัดหนึ่ง</p><p>บรรทัดสอง</p>' }) === 'บรรทัดหนึ่ง\n\nบรรทัดสอง',
        JSON.stringify(M.introText({ intro: '<p>บรรทัดหนึ่ง</p><p>บรรทัดสอง</p>' })));
  check('[96] ข้อความล้วนของเดิมผ่านไปเฉย ๆ',
        M.introText({ intro: 'ข้อความเก่าไม่มีแท็ก' }) === 'ข้อความเก่าไม่มีแท็ก');
  check('[96] รูปไม่ถูกส่งเข้าโมเดล', !M.introText({ intro: 'ก<img src="x.png">' }).includes('img'));
  check('[96] แท็กเปล่าไม่นับว่ากรอกแล้ว',
        M.hasIntro({ intro: '<p><br></p>' }) === false, JSON.stringify(M.introText({ intro: '<p><br></p>' })));
  check('[96] มีเนื้อจริงถึงนับว่ากรอกแล้ว', M.hasIntro({ intro: '<p>มีเนื้อ</p>' }) === true);

  const a = M.newScenario({ turns: [M.newTurn({ usage: { in: 100, out: 50 } })] });
  const b = M.newScenario({ turns: [M.newTurn({ usage: { in: 20, out: 5 } })] });
  const tk = M.sumTokens([a, b]);
  check('[96] รวมโทเคนทุกตอนได้', tk.inTok === 120 && tk.outTok === 55 && tk.total === 175,
        JSON.stringify(tk));
  check('[96] ไม่มี usage ก็ไม่ล้ม', M.sumTokens([M.newScenario({})]).total === 0);
  check('[96] แก้ล่าสุดเอาตัวใหม่สุดระหว่างเรื่องกับตอน',
        M.lastUpdated({ updated: 100 }, [{ updated: 500 }, { updated: 300 }]) === 500);
  check('[96] ไม่มีตอนเลยก็ใช้ของตัวเรื่อง', M.lastUpdated({ updated: 7 }, []) === 7);
}

// ═══════════ 14. [alpha.122] โหมดพื้นฐาน/ขั้นสูง ═══════════
{
  check('[122] ไฟล์เก่าไม่มี mode = พื้นฐาน',
        M.migrateStarter({ name: 'เก่า' }).mode === M.MODE_BASIC);
  check('[122] ค่าขยะก็ตกเป็นพื้นฐาน', M.normMode('อะไรก็ไม่รู้') === M.MODE_BASIC
        && M.normMode(undefined) === M.MODE_BASIC);
  check('[122] ตั้งขั้นสูงได้', M.isAdv(M.newStarter({ mode: 'adv' })) === true);
  check('[122] มีสองโหมดพอดี มีป้ายครบ',
        M.MODES.length === 2 && M.MODES.every((m) => m.label && m.icon && m.hint));
  // กติกา: โหมดคุมการมองเห็น ไม่ใช่การมีอยู่ — ข้อมูลขั้นสูงต้องรอดตอนสลับกลับ
  const advS = M.migrateStarter({ mode: 'adv', cast: [{ name: 'ก', dialogue: 'ว่าไง', tags: ['x'] }] });
  const backToBasic = M.migrateStarter({ ...advS, mode: 'basic' });
  check('[122] สลับกลับพื้นฐานแล้วช่องขั้นสูงไม่หาย',
        backToBasic.cast[0].dialogue === 'ว่าไง' && backToBasic.cast[0].tags[0] === 'x');
}

// ═══════════ 15. [alpha.122] ช่องขั้นสูงของตัวละคร ═══════════
{
  const c = M.newChar({ name: 'ลิเลียน' });
  check('[122] ตัวละครใหม่มีช่องขั้นสูงครบ',
        ['shortcode', 'dialogue', 'tags', 'prompts'].every((k) => k in c));
  check('[122] ค่าเริ่มต้นว่าง ไม่ใช่ undefined',
        c.shortcode === '' && c.dialogue === '' && c.tags.length === 0 && c.prompts.length === 0);
  check('[122] แท็กตัวละครถูกตัดซ้ำเหมือนแท็กเรื่อง',
        M.newChar({ tags: ['a', 'A', ' b '] }).tags.join(',') === 'a,b');
  check('[122] prompts ที่เป็น object แบบเก่าเปิดได้',
        M.newChar({ prompts: { 'Prompt A': 'x' } }).prompts[0].v === 'x');
  // ไฟล์เก่าเปิดแล้วต้องไม่มี field หาย (migrate ผ่าน newStarter → newChar)
  const old = M.migrateStarter({ cast: [{ name: 'เก่า' }] });
  check('[122] ตัวละครในไฟล์เก่าได้ช่องใหม่ครบ', Array.isArray(old.cast[0].prompts));
}

// ═══════════ 16. [alpha.122] ช่องขั้นสูงของตอน ═══════════
{
  const sc = M.newScenario({});
  check('[122] ตอนใหม่มีช่องขั้นสูง + รูปย่อ',
        ['thumb', 'desc', 'opener', 'openerImage', 'goal', 'conditions'].every((k) => k in sc));
  check('[122] เทิร์นมีช่องรูป', 'image' in M.newTurn({}));
  check('[122] เวอร์ชันตอนขึ้นเป็น 2', M.SCENARIO_VERSION === 2);
  // สำคัญ: field ที่ไม่อยู่ในโมเดลจะถูกตัดทิ้งตอน migrate — ช่องใหม่ต้องรอด
  const kept = M.migrateScenario({ opener: 'บทเปิด', goal: 'เป้า', thumb: 'a.png',
                                   turns: [{ role: 'gm', text: 'x', image: 'b.png' }] });
  check('[122] ช่องใหม่รอด migrate',
        kept.opener === 'บทเปิด' && kept.goal === 'เป้า' && kept.thumb === 'a.png');
  check('[122] รูปของเทิร์นรอด migrate', kept.turns[0].image === 'b.png');

  const cast = [{ id: 'a', name: 'ลิเลียน', shortcode: 'characterA' }];
  check('[122] บทเปิดคลายโค้ดสั้นก่อนแสดง/ส่งโมเดล',
        M.openerText({ opener: 'สวัสดี {{characterA}}' }, cast) === 'สวัสดี ลิเลียน');
  // [123] บทเปิดเก็บเป็น HTML แล้ว (ผู้ใช้ขอ b/i/u) — โมเดลต้องได้ข้อความล้วน จอต้องได้ HTML
  check('[123] บทเปิดที่เป็น HTML → โมเดลได้ข้อความล้วน',
        M.openerText({ opener: '<p>สวัสดี <b>{{characterA}}</b></p>' }, cast) === 'สวัสดี ลิเลียน',
        JSON.stringify(M.openerText({ opener: '<p>สวัสดี <b>{{characterA}}</b></p>' }, cast)));
  check('[123] บทเปิดที่เป็น HTML → จอได้ HTML ที่คลายโค้ดสั้นแล้ว',
        M.openerHtml({ opener: '<b>{{characterA}}</b>' }, cast) === '<b>ลิเลียน</b>');
  check('[123] แท็กเปล่าไม่นับว่ามีบทเปิด',
        M.hasOpener({ opener: '<p><br></p>' }) === false);
  check('[123] ตอนมีช่อง Mood & Tone', 'mood' in M.newScenario({}));
  check('[123] เทิร์นมีช่อง html', 'html' in M.newTurn({}));
  check('[123] โค้ดสั้นรูปแบบเก่าถูกแปลงตอนอ่านไฟล์',
        M.migrateScenario({ goal: 'ชวน {[ไก่]} กลับ' }).goal === 'ชวน {{ไก่}} กลับ');
  check('[123] ตัวละครก็ถูกแปลงด้วย',
        M.newChar({ dialogue: 'ทัก {[ไก่]}' }).dialogue === 'ทัก {{ไก่}}');
  check('[122] ไม่มีบทเปิด = รู้ว่าไม่มี',
        M.hasOpener({}) === false && M.hasOpener({ opener: '  ' }) === false
        && M.hasOpener({ opener: 'x' }) === true);
  check('[122] นับช่องขั้นสูงที่กรอกแล้วได้',
        M.scenarioAdvFilled({ desc: 'a', goal: '', conditions: 'c' }) === 2);
}

// ═══════════ 17. [alpha.122] เดินทางสองทางกับ Wiki (ช่องใหม่ต้องไม่ตกหล่น) ═══════════
{
  const ch = { name: 'ลิเลียน', persona: 'คำบรรยาย', dialogue: '"ว่าไง"',
               shortcode: 'characterA', tags: ['ตัวเอก'], prompts: [{ k: 'Prompt A', v: 'พูดห้วน' }] };
  const e = W.entityFromChar(ch, { id: 'e1' });
  check('[122] entity ใหม่พกโค้ดสั้น/แท็ก/prompt',
        e.shortcode === 'characterA' && e.tags[0] === 'ตัวเอก' && e.prompts[0].v === 'พูดห้วน');
  check('[122] ตัวอย่างคำพูดเก็บเป็นหัวข้อของตัวเอง',
        e.sections.length === 2 && e.sections[1].content === '"ว่าไง"');

  const back = W.charPatchFromEntity(e, '/x.json');
  check('[122] ดึงกลับได้ครบทุกช่อง',
        back.shortcode === 'characterA' && back.tags[0] === 'ตัวเอก'
        && back.prompts[0].k === 'Prompt A' && back.dialogue === '"ว่าไง"');
  // จุดที่พลาดง่ายที่สุด: ตัวอย่างคำพูดถูกยัดซ้ำเข้าคำบรรยายด้วย = ของซ้ำสองที่ในทุก prompt
  check('[122] คำบรรยายไม่กลืนตัวอย่างคำพูดมาซ้ำ',
        back.persona === 'คำบรรยาย', JSON.stringify(back.persona));

  // อัปเดตของเดิม: ห้ามทับสิ่งที่ผู้ใช้เขียนเพิ่มในหน้า Wiki
  const older = { name: 'ลิเลียน', shortcode: 'ของเดิม', tags: ['จากวิกิ'],
                  prompts: [{ k: 'Prompt B', v: 'ของวิกิ' }],
                  sections: [{ title: 'ประวัติ', content: 'เขียนไว้ในวิกิ' }] };
  const merged = W.applyCharToEntity(older, ch);
  check('[122] โค้ดสั้นฝั่งวิกิชนะเมื่อตั้งไว้แล้ว', merged.shortcode === 'ของเดิม');
  check('[122] แท็กรวมกันไม่ทับ',
        merged.tags.length === 2 && merged.tags.includes('จากวิกิ') && merged.tags.includes('ตัวเอก'),
        JSON.stringify(merged.tags));
  check('[122] prompt คนละหัวข้ออยู่ครบทั้งคู่',
        merged.prompts.length === 2, JSON.stringify(merged.prompts));
  check('[122] หัวข้อที่ผู้ใช้เขียนในวิกิไม่หาย',
        merged.sections.some((x) => x.title === 'ประวัติ'));
  check('[122] คำบรรยายของ starter ขึ้นเป็นหัวข้อแรก',
        merged.sections[0].content === 'คำบรรยาย', JSON.stringify(merged.sections.map((x) => x.title)));
  // เนื้อว่างต้องไม่ไปลบของเดิมทิ้ง
  const noWipe = W.applyCharToEntity(merged, { name: 'ลิเลียน', persona: '', dialogue: '' });
  check('[122] ช่องว่างไม่ล้างของเดิมในวิกิ',
        noWipe.sections[0].content === 'คำบรรยาย'
        && noWipe.sections.some((x) => x.content === '"ว่าไง"'));
}

// ═══════════ 18. [alpha.122] prompt ที่ส่งเข้าโมเดล ═══════════
{
  const s = M.newStarter({
    name: 'เรื่องทดสอบ',
    cast: [M.newChar({ id: 'a', name: 'ลิเลียน', shortcode: 'characterA', persona: 'ใบบท',
                       dialogue: 'ทักทาย {{Kai}} หน่อยสิ', tags: ['ตัวเอก'],
                       prompts: [{ k: 'Prompt A', v: 'พูดห้วน' }] }),
           M.newChar({ id: 'b', name: 'Kai' })],
  });
  const full = P.castBlock(s, { full: true });
  check('[122] ใบเต็มมีตัวอย่างคำพูด', full.includes('ทักทาย'), full);
  check('[122] โค้ดสั้นถูกคลายก่อนถึงโมเดล',
        full.includes('ทักทาย Kai') && !full.includes('{['), full);
  check('[122] แท็กและช่อง Prompt ติดไปด้วย',
        full.includes('ตัวเอก') && full.includes('พูดห้วน'));
  const brief = P.castBlock(s, { full: false });
  check('[122] ใบย่อไม่พกตัวอย่างคำพูด (ประหยัดโทเคน)', !brief.includes('ทักทาย'), brief);

  const sc = M.newScenario({ title: 'ตอนหนึ่ง', desc: 'ฉากในเมือง',
                             goal: 'ชนะใจ {{characterA}}', conditions: 'พูดว่า "รัก"',
                             mood: 'อบอุ่นแต่มีอะไรค้างคา' });
  const sys = P.gmSystem(s, sc, {});
  check('[122] GM ได้คำอธิบาย เป้าหมาย และเงื่อนไขจบ',
        sys.includes('ฉากในเมือง') && sys.includes('ชนะใจ ลิเลียน') && sys.includes('พูดว่า "รัก"'),
        sys.slice(0, 200));
  check('[123] GM ได้ Mood & Tone ด้วย', sys.includes('อบอุ่นแต่มีอะไรค้างคา'));
  check('[123] ไม่มีวงเล็บปีกกาหลุดเข้า system prompt',
        !sys.includes('{{') && !sys.includes('{['));
  // `{{user}}` ต้องกลายเป็นชื่อตัวที่ผู้เล่นสวมบท ไม่ใช่คำว่า user
  const sysUser = P.gmSystem(s, M.newScenario({ goal: 'ช่วย {{user}} หนี' }), { userChars: ['a'] });
  check('[123] {{user}} คลายเป็นตัวที่ผู้เล่นสวมบท',
        sysUser.includes('ช่วย ลิเลียน หนี'), sysUser.slice(0, 200));
  // `{{character}}` ต้องเห็นทั้ง pool
  const sysAny = P.gmSystem(s, M.newScenario({ goal: 'แต่งงานกับ {{character}}' }), {});
  check('[123] {{character}} คลายเป็นรายชื่อทั้งวง',
        sysAny.includes('ลิเลียน / Kai'), sysAny.slice(0, 200));

  // บทเปิดที่ผู้ใช้เขียนเอง = ห้ามให้โมเดลแต่งใหม่ทับ
  const withOpener = P.gmOpening(s, M.newScenario({ opener: 'ฝนตกหนัก {{characterA}} ยืนรออยู่' }));
  check('[122] มีบทเปิดเอง = สั่งให้เล่าต่อ ไม่ใช่เขียนใหม่',
        withOpener.includes('ฝนตกหนัก ลิเลียน'), withOpener);
  const noOpener = P.gmOpening(s, M.newScenario({ synopsis: 'เรื่องย่อ' }));
  check('[122] ไม่มีบทเปิด = ใช้ทางเดิม (ให้โมเดลเปิดฉากเอง)',
        noOpener.includes('เรื่องย่อ') && !noOpener.includes('ฝนตก'));

  check('[123] PROMPT_VERSION ขึ้นตามที่แก้สำนวน', P.PROMPT_VERSION === 3);
  const dlg = P.charDialoguePrompt(s, s.cast[0]);
  check('[122] คำสั่งขอตัวอย่างคำพูดมีบริบทของตัวละคร', dlg.includes('ลิเลียน'));
  check('[123] คำสั่งเงื่อนไขจบบอกให้ใช้โค้ดสั้นทั้งสามแบบ',
        P.conditionsPrompt(s, sc).includes('{{ลิเลียน}}')
        && P.conditionsPrompt(s, sc).includes('{{character}}')
        && P.conditionsPrompt(s, sc).includes('{{user}}'),
        P.conditionsPrompt(s, sc).slice(-220));
}

console.log(`starter (โมดูลบริสุทธิ์): ${pass} ผ่าน, ${fail} ล้มเหลว`);
if (fail) process.exit(1);
