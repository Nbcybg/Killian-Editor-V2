// test/ai-features.test.cjs — ทดสอบ ai-plot / ai-dialogue / ai-character / ai-world / ai-chat (ข้อ 73-76,79)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// ใช้ client ปลอมทั้งหมด — ไม่ยิง API จริง ไม่เสียเงิน
const path = require('path');
const os = require('os');
const build = (src, name) => {
  const out = path.join(os.tmpdir(), name);
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + src)], outfile: out,
    format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const PL = build('ai/ai-plot.js', '_aiplot.cjs');
const DG = build('ai/ai-dialogue.js', '_aidlg.cjs');
const CH = build('ai/ai-character.js', '_aichar.cjs');
const WD = build('ai/ai-world.js', '_aiworld.cjs');
const CT = build('ai/ai-chat.js', '_aichat.cjs');
const AI = build('ai/ai-core.js', '_aicore2.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
// client ปลอม: ตอบตามที่กำหนด + เก็บ request ไว้ตรวจ
const fakeClient = (reply) => {
  const calls = [];
  return {
    calls,
    complete: async (o) => { calls.push(o); const t = typeof reply === 'function' ? reply(o, calls.length) : reply;
      return typeof t === 'object' && t && 'ok' in t ? t : { ok: true, text: t, usage: { input: 10, output: 5, total: 15 }, cost: { usd: 0.001 } }; },
    stream: async (o, cb) => { calls.push(o); const t = typeof reply === 'function' ? reply(o, calls.length) : reply;
      cb(String(t)); return { ok: true, text: String(t), usage: { input: 1, output: 1, total: 2 }, cost: { usd: 0 } }; },
  };
};

// ════════ ข้อ 73: Plot Hole ════════
const scenes = [
  { id: 'sc1', title: 'ตลาดเก่า', chapterId: 'c1', storyDate: 'ปีที่ 1', pov: 'โทระ', characters: ['โทระ'], text: 'โทระ เดินเข้าตลาด' },
  { id: 'sc2', title: 'บ้านไม้', chapterId: 'c1', storyDate: 'ปีที่ 3', pov: 'โทระ', characters: ['โทระ', 'แมว'], text: 'โทระ กลับบ้าน' },
  { id: 'sc3', title: 'ย้อนอดีต', chapterId: 'c2', storyDate: 'ปีที่ 2', pov: 'แมว', characters: ['โทระ'], text: 'แมวเล่าเรื่องเก่า' },
];
let bp = PL.buildPlotPrompt(scenes, {});
check('plot: prompt แนบ sceneId ทุกฉาก', scenes.every((s) => bp.prompt.includes('[sceneId: ' + s.id + ']')));
check('plot: prompt สั่งตอบ JSON array', bp.prompt.includes('JSON array') && bp.system.includes('JSON'));
check('plot: แจงชนิดปัญหาครบ', Object.keys(PL.HOLE_TYPES).every((t) => bp.prompt.includes(t)));
check('plot: ห้ามแต่งปัญหา', bp.prompt.includes('ห้ามแต่งปัญหา'));
check('plot: แนบ storyDate/มุมมอง', bp.prompt.includes('เวลาในเรื่อง: ปีที่ 1') && bp.prompt.includes('มุมมอง: โทระ'));
check('plot: focus เพิ่มบรรทัดพิเศษ', PL.buildPlotPrompt(scenes, { focus: 'ปมมรดก' }).prompt.includes('ปมมรดก'));
check('plot: จำกัดชนิดที่ตรวจได้', !PL.buildPlotPrompt(scenes, { types: ['pacing'] }).prompt.includes('motivation-gap'));

const reply = JSON.stringify([
  { type: 'motivation-gap', severity: 'major', description: 'ไม่อธิบายว่าทำไมโทระกลับบ้าน', sceneId: 'sc2', evidence: 'โทระ กลับบ้าน', suggestion: 'เพิ่มเหตุผล' },
  { type: 'timeline-conflict', severity: 'critical', description: 'เวลาไม่ตรง', sceneId: 'sc3', relatedSceneId: 'sc2' },
  { type: 'มั่วซั่ว', severity: 'ระเบิด', description: 'ชนิดผิด', sceneId: 'sc1' },
  { type: 'pacing', severity: 'minor', description: 'ช้า', sceneId: 'ฉากที่ไม่มีจริง' },
  { severity: 'minor', sceneId: 'sc1' },
]);
let holes = PL.parsePlotHoles(reply, { sceneIds: ['sc1', 'sc2', 'sc3'], titles: { sc2: 'บ้านไม้', sc3: 'ย้อนอดีต' } });
check('plot: ตัดข้อที่ sceneId ไม่มีจริง', !holes.some((h) => h.sceneId === 'ฉากที่ไม่มีจริง'));
check('plot: ตัดข้อที่ description ขาด', !holes.some((h) => !h.description));
check('plot: ชนิด/ระดับผิด → ตกไปค่าปริยาย', holes.some((h) => h.sceneId === 'sc1' && h.type === 'plot-thread' && h.severity === 'minor'), JSON.stringify(holes.map((h) => [h.sceneId, h.type])));
check('plot: เรียงตามความรุนแรง (critical ก่อน)', holes[0].severity === 'critical', holes.map((h) => h.severity).join());
check('plot: มี location + ชื่อฉาก', holes[0].location.sceneId === 'sc3' && holes[0].location.title === 'ย้อนอดีต');
check('plot: มี label ไทย', holes[0].typeLabel === PL.HOLE_TYPES['timeline-conflict'] && holes[0].severityLabel === 'ร้ายแรง');
check('plot: ตอบไม่เป็น JSON → [] ไม่ throw', PL.parsePlotHoles('ขอโทษครับ ผมไม่พบปัญหา').length === 0);
check('plot: ตอบใน ```json fence ได้', PL.parsePlotHoles('```json\n[{"type":"pacing","severity":"minor","description":"ช้า","sceneId":"sc1"}]\n```').length === 1);
check('plot: dedupe ข้อซ้ำ', PL.dedupeHoles([{ type: 'a', sceneId: '1', description: 'x' }, { type: 'a', sceneId: '1', description: 'x' }]).length === 1);

const local = PL.localChecks(scenes);
check('plot(ออฟไลน์): จับเวลาย้อนกลับ', local.some((h) => h.type === 'timeline-conflict' && h.sceneId === 'sc3'), JSON.stringify(local.map((h) => h.type)));
check('plot(ออฟไลน์): จับ pov ที่ไม่อยู่ในรายชื่อตัวละคร', local.some((h) => h.type === 'character-continuity' && h.sceneId === 'sc3'));
check('plot(ออฟไลน์): source = local', local.every((h) => h.source === 'local'));
check('plot(ออฟไลน์): ฉากเรียงเวลาถูก → ไม่แจ้ง', PL.localChecks([scenes[0], scenes[1]]).filter((h) => h.type === 'timeline-conflict').length === 0);

const big = Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, title: 't' + i, text: 'ก'.repeat(3000) }));
const batches = PL.batchScenes(big, 2000);
check('plot: แบ่ง batch ตามงบ token', batches.length > 1, 'n=' + batches.length);
check('plot: ฉากยาวเกินงบไม่ถูกทิ้ง', batches.flat().length === 8);

(async () => {
  let r = await PL.detectPlotHoles([], { scenes, client: fakeClient(reply) });
  check('detectPlotHoles: รวมผล AI + ออฟไลน์', r.ok && r.holes.length >= 3, JSON.stringify(r.holes.map((h) => h.source)));
  check('detectPlotHoles: temperature ต่ำสำหรับงานตรวจ', r.holes.length > 0);
  r = await PL.detectPlotHoles(['sc1'], { scenes, client: fakeClient('[]') });
  check('detectPlotHoles: เลือกเฉพาะฉากที่ระบุ', r.ok && r.batches === 1);
  r = await PL.detectPlotHoles([], { scenes, client: fakeClient({ ok: false, error: 'เน็ตล่ม', code: 'network' }) });
  check('detectPlotHoles: AI ล้ม → ยังคืนผลออฟไลน์', r.holes.length > 0 && r.failedBatches === 1);
  r = await PL.detectPlotHoles([], { scenes: [] });
  check('detectPlotHoles: ไม่มีฉาก → บอกชัด ไม่ throw', !r.ok && r.code === 'no-scenes');
  r = await PL.detectPlotHoles([], { scenes });
  check('detectPlotHoles: ไม่มี client → ยังตรวจออฟไลน์ให้', r.holes.length > 0 && r.code === 'no-client');

  // ════════ ข้อ 74: Dialogue ════════
  const tora = { id: 'characters/tora.json', name: 'โทระ', aliases: ['เจ้าหนู'],
    fields: { บุคลิก: 'เงียบ ขี้ระแวง', การพูด: 'พูดสั้น ห้วน', เป้าหมาย: 'ตามหาพ่อ' } };
  const cat = { name: 'ยัยแมว', personality: 'ร่าเริง ปากไว', speech: 'พูดเร็ว ชอบหยอก', goal: 'หาของกิน',
    relationships: [{ targetName: 'โทระ', role: 'เพื่อน' }] };
  const pa = DG.characterProfile(tora), pb = DG.characterProfile(cat);
  check('dialogue: อ่านฟิลด์ไทยจาก Wiki ได้', pa.personality === 'เงียบ ขี้ระแวง' && pa.speech === 'พูดสั้น ห้วน');
  check('dialogue: อ่านฟิลด์อังกฤษได้', pb.personality === 'ร่าเริง ปากไว' && pb.goal === 'หาของกิน');
  check('dialogue: เก็บนามแฝง', pa.aliases.join() === 'เจ้าหนู');
  check('dialogue: profileBlock มีทุกอย่าง', DG.profileBlock(pa).includes('โทระ') && DG.profileBlock(pa).includes('ตามหาพ่อ'));
  check('dialogue: ความสัมพันธ์ลง prompt', DG.profileBlock(pb).includes('เพื่อน'));

  let dp = DG.buildDialoguePrompt(pa, pb, { situation: 'เจอกันที่ตลาด', conflict: 'แย่งของชิ้นเดียวกัน' }, { lines: 6 });
  check('dialogue: prompt มีทั้งสองตัวละคร + สถานการณ์', dp.prompt.includes('โทระ') && dp.prompt.includes('ยัยแมว') && dp.prompt.includes('แย่งของชิ้นเดียวกัน'));
  check('dialogue: สั่งรูปแบบ @ตัวละคร (fountain ของ K2)', dp.prompt.includes('@ชื่อตัวละคร'));
  check('dialogue: จำนวนรอบตามที่สั่ง', dp.prompt.includes('6 รอบ'));
  check('dialogue: สั่งห้ามพูดเหมือนกัน', dp.prompt.includes('ห้ามให้ทั้งคู่พูดเหมือนกัน'));
  dp = DG.buildDialoguePrompt(pa, pb, 'คุยกันสั้น ๆ', { format: 'prose' });
  check('dialogue: โหมดร้อยแก้วสั่งเครื่องหมายคำพูด', dp.format === 'prose' && dp.prompt.includes('เครื่องหมายคำพูด'));
  check('dialogue: context เป็นสตริงก็ได้', dp.prompt.includes('คุยกันสั้น ๆ'));

  let parsed = DG.parseDialogue('@โทระ\n(ระแวง)\nมาทำอะไรที่นี่\n\n@ยัยแมว\nก็มาหาของกินไง', {});
  check('dialogue: แยกผู้พูด/วงเล็บ/บทพูด', parsed.lines.length === 2 && parsed.lines[0].paren === 'ระแวง' && parsed.lines[1].speaker === 'ยัยแมว', JSON.stringify(parsed.lines));
  parsed = DG.parseDialogue('โทระ: มาทำอะไร\nยัยแมว: หาของกิน', {});
  check('dialogue: รองรับรูปแบบ "ชื่อ: บทพูด" ที่โมเดลชอบตอบ', parsed.lines.length === 2 && parsed.lines[0].speaker === 'โทระ');
  check('dialogue: แปลงกลับเป็น fountain @ชื่อ', parsed.text.startsWith('@โทระ') && parsed.text.includes('@ยัยแมว'), parsed.text);
  check('dialogue: ตัด ```fence ทิ้ง', DG.parseDialogue('```\n@ก\nสวัสดี\n```', {}).lines.length === 1);
  check('dialogue: toProse อ่านรู้เรื่อง', DG.toProse([{ speaker: 'ก', text: 'สวัสดี' }]).includes('"สวัสดี"'));
  check('dialogue: ร้อยแก้ว → แยกย่อหน้า', DG.parseDialogue('เขาพูดว่า "สวัสดี"\n\nเธอตอบ "จ้ะ"', { format: 'prose' }).lines.length === 2);

  let dr = await DG.generateDialogue(tora, cat, { situation: 'ที่ตลาด' }, { client: fakeClient('@โทระ\nมาทำอะไร\n\n@ยัยแมว\nหาของกิน') });
  check('generateDialogue: คืนบท + รายชื่อผู้พูด', dr.ok && dr.speakers.join() === 'โทระ,ยัยแมว', JSON.stringify(dr.speakers));
  check('generateDialogue: แนบ prompt กลับมา', dr.prompt.includes('โทระ'));
  dr = await DG.generateDialogue(tora, cat, {}, {});
  check('generateDialogue: ไม่มี client → ไม่ throw', !dr.ok && dr.code === 'no-client');
  dr = await DG.generateDialogue(null, cat, {}, { client: fakeClient('x') });
  check('generateDialogue: ขาดตัวละคร → บอกชัด', !dr.ok && dr.code === 'no-characters');

  // ════════ ข้อ 75: Character Consistency ════════
  const apps = [
    { sceneId: 'sc1', title: 'ฉาก 1', text: '@โทระ\nสวัสดีครับ ผมมาแล้วครับ' },
    { sceneId: 'sc2', title: 'ฉาก 2', text: '@โทระ\nขอบคุณครับ ผมจะไปแล้วครับ' },
    { sceneId: 'sc3', title: 'ฉาก 3', text: '@โทระ\nสวัสดีค่ะ หนูมาแล้วค่ะ' },
  ];
  const stats = CH.speechStats(apps, 'โทระ');
  check('character: นับคำลงท้ายรายฉาก', stats[0].particles['ครับ'] === 2 && stats[2].particles['ค่ะ'] === 2, JSON.stringify(stats.map((s) => s.particles)));
  check('character: นับสรรพนาม', stats[0].pronouns['ผม'] === 1 && stats[2].pronouns['หนู'] === 1);
  const lc = CH.localConsistency(apps, 'โทระ');
  check('character(ออฟไลน์): จับคำลงท้ายที่หลุด', lc.some((i) => i.sceneId === 'sc3' && i.issue.includes('ครับ')), JSON.stringify(lc.map((i) => i.sceneId)));
  check('character(ออฟไลน์): จับสรรพนามที่หลุด', lc.some((i) => i.sceneId === 'sc3' && i.issue.includes('ผม')));
  check('character(ออฟไลน์): ฉากที่สม่ำเสมอไม่ถูกแจ้ง', !lc.some((i) => i.sceneId === 'sc1'));
  check('character(ออฟไลน์): พูดเหมือนกันทุกฉาก → ไม่มีปัญหา', CH.localConsistency(apps.slice(0, 2), 'โทระ').length === 0);

  const profile = DG.characterProfile({ name: 'โทระ', personality: 'เงียบ' });
  const cp = CH.buildConsistencyPrompt(profile, apps, {});
  check('character: prompt แนบทุกฉากพร้อม sceneId', apps.every((a) => cp.prompt.includes('[sceneId: ' + a.sceneId + ']')));
  check('character: prompt มีโปรไฟล์', cp.prompt.includes('เงียบ'));
  check('character: สั่งรูปแบบ JSON ที่มี sceneId/issue/suggestion', cp.prompt.includes('"sceneId"') && cp.prompt.includes('"suggestion"'));

  const cReply = JSON.stringify([
    { sceneId: 'sc3', aspect: 'speech', severity: 'major', issue: 'พูดเป็นผู้หญิง', suggestion: 'แก้เป็นครับ' },
    { sceneId: 'ไม่มี', aspect: 'speech', severity: 'minor', issue: 'x' },
    { aspect: 'speech', issue: 'ไม่มี sceneId' },
  ]);
  const cIssues = CH.parseConsistency(cReply, { sceneIds: ['sc1', 'sc2', 'sc3'], titles: { sc3: 'ฉาก 3' } });
  check('character: ตัดข้อที่ sceneId ผิด/ขาด', cIssues.length === 1 && cIssues[0].sceneId === 'sc3');
  check('character: ผลมี sceneId/issue/suggestion ตาม spec', ['sceneId', 'issue', 'suggestion'].every((k) => k in cIssues[0]));
  check('character: เติมชื่อฉาก + label ไทย', cIssues[0].sceneTitle === 'ฉาก 3' && cIssues[0].aspectLabel === CH.ASPECTS.speech);

  let cr = await CH.checkConsistency('characters/tora.json', { entity: { name: 'โทระ' }, scenes: apps.map((a) => ({ id: a.sceneId, title: a.title, text: a.text })), client: fakeClient(cReply) });
  check('checkConsistency: รวมผลออฟไลน์ + AI', cr.ok && cr.issues.length >= 2 && cr.issues.some((i) => i.source === 'local') && cr.issues.some((i) => i.source === 'ai'), JSON.stringify(cr.issues.map((i) => i.source)));
  check('checkConsistency: บอกจำนวนฉากที่ตรวจ', cr.appearances === 3);
  cr = await CH.checkConsistency('x', { entity: { name: 'ไม่มีใคร' }, scenes: apps.map((a) => ({ id: a.sceneId, text: a.text })), client: fakeClient('[]') });
  check('checkConsistency: ไม่พบฉากของตัวละคร → บอกชัด', !cr.ok && cr.code === 'no-scenes');
  cr = await CH.checkConsistency('x', {});
  check('checkConsistency: ไม่มีเอนทิตี้ → ไม่ throw', !cr.ok && cr.code === 'no-entity');
  cr = await CH.checkConsistency('x', { entity: { name: 'โทระ' }, sceneIds: ['sc1', 'sc3'], scenes: apps.map((a) => ({ id: a.sceneId, text: a.text })), client: fakeClient({ ok: false, error: 'ล่ม' }) });
  check('checkConsistency: AI ล่ม → ยังได้ผลออฟไลน์', cr.issues.length > 0);

  // ════════ ข้อ 76: Worldbuilding ════════
  check('world: มีเทมเพลตครบตามข้อกำหนด', ['magic', 'city', 'culture', 'economy'].every((t) => WD.WORLD_TYPES.includes(t)));
  let wp = WD.buildWorldPrompt('magic', 'เวทที่ใช้เลือดเป็นเชื้อเพลิง', { tone: 'มืดหม่น' });
  check('world: prompt ใส่คำสั่งผู้เขียน + โทน', wp.prompt.includes('เลือดเป็นเชื้อเพลิง') && wp.prompt.includes('มืดหม่น'));
  check('world: prompt แจงฟิลด์ตามเทมเพลต', wp.prompt.includes('source') && wp.prompt.includes('cost'));
  check('world: prompt แจงหัวข้อตามเทมเพลต', WD.WORLD_TEMPLATES.magic.sections.every((s) => wp.prompt.includes(s)));
  check('world: existing → สั่งห้ามขัดกัน', WD.buildWorldPrompt('city', 'x', { existing: 'เมืองนี้ไม่มีทะเล' }).prompt.includes('ห้ามขัดกัน'));
  check('world: ประเภทมั่ว → null', WD.buildWorldPrompt('ไม่มีประเภทนี้', 'x') === null);

  const wReply = JSON.stringify({
    name: 'ศาสตร์เลือดแดง',
    fields: { source: 'เลือดของผู้ใช้', cost: 'อายุขัย', limits: 'ใช้ได้เดือนละครั้ง', whoCanUse: 'สายเลือดตระกูลเก่า', rarity: 'หายาก' },
    sections: [{ title: 'กฎของระบบ', body: 'ต้องมีเลือด' }, { title: 'ผลข้างเคียงและอันตราย', body: 'แก่เร็ว' }, { title: 'ไม่มี body' }],
    tags: ['เวท', 'เลือด'],
  });
  let w = WD.parseWorld('magic', wReply);
  check('world: ถอดชื่อ + ฟิลด์ครบ', w.name === 'ศาสตร์เลือดแดง' && w.fields.cost === 'อายุขัย');
  check('world: ตัด section ที่ไม่มีเนื้อหา', w.sections.length === 2);
  check('world: บอกหัวข้อที่ยังขาด', w.missing.includes('วิธีใช้งานจริง'), JSON.stringify(w.missing));
  check('world: เก็บแท็ก', w.tags.join() === 'เวท,เลือด');
  w = WD.parseWorld('city', '{"name":"ท่าเรือเก่า","population":"สองหมื่น","sections":[{"title":"ภาพรวมและบรรยากาศ","body":"ชื้นและคับแคบ"}]}');
  check('world: ฟิลด์ที่โมเดลวางไว้ระดับบนสุดก็รับได้', w.fields.population === 'สองหมื่น');
  check('world: ตอบมั่ว → ok:false ไม่ throw', WD.parseWorld('magic', 'ขอโทษครับ').ok === false);

  const ent = WD.toWikiEntity(w, {});
  check('world → Wiki entity: หมวดตามเทมเพลต', ent.entityTypeKey === 'locations' && ent.name === 'ท่าเรือเก่า');
  check('world → Wiki entity: หัวข้อกลายเป็น notes', ent.notes.includes('## ภาพรวมและบรรยากาศ'));
  check('world → Wiki entity: จำประเภทที่สร้าง', ent.fields.worldType === 'city');
  check('world → markdown', WD.toMarkdown(w).startsWith('# ท่าเรือเก่า'));

  let wr = await WD.generateWorld('magic', 'เวทเลือด', { client: fakeClient(wReply) });
  check('generateWorld: สำเร็จ + คืนโครงสร้าง', wr.ok && wr.world.name === 'ศาสตร์เลือดแดง');
  let tries = 0;
  wr = await WD.generateWorld('magic', 'x', { client: fakeClient((o, n) => { tries = n; return n === 1 ? 'ตอบมั่ว' : wReply; }) });
  check('generateWorld: ตอบไม่ตรงโครง → ลองใหม่ 1 ครั้ง', wr.ok && tries === 2);
  wr = await WD.generateWorld('magic', 'x', { client: fakeClient('มั่วทั้งสองรอบ') });
  check('generateWorld: ยังมั่ว → ok:false code:bad-shape', !wr.ok && wr.code === 'bad-shape');
  wr = await WD.generateWorld('ผิดประเภท', 'x', { client: fakeClient('{}') });
  check('generateWorld: ประเภทผิด → บอกรายการที่รองรับ', !wr.ok && wr.types.includes('magic'));

  // ════════ ข้อ 79: Chat ════════
  const docs = CT.collectDocs({
    scenes: [{ id: 'sc1', title: 'ตลาดเก่า', text: 'โทระ เจอ ยัยแมว ที่ตลาด' }],
    entities: [{ id: 'characters/cat.json', name: 'ยัยแมว', aliases: ['แมวดำ'], notes: 'แมวพูดได้' }],
    timeline: { events: [{ id: 'e1', title: 'ไฟไหม้ตลาด', when: 'ปีที่ 2', desc: 'ตลาดถูกเผา' }] },
  });
  check('chat: รวมฉาก+วิกิ+เส้นเวลาเป็นเอกสาร', docs.length === 3, JSON.stringify(docs.map((d) => d.id)));
  check('chat: ติด meta.kind ให้ทุกชนิด', docs.map((d) => d.meta.kind).sort().join() === 'scene,timeline,wiki');
  check('chat: ข้ามของว่าง', CT.collectDocs({ scenes: [{ id: 'x' }], entities: [{ name: '' }] }).length === 0);

  const hist = [];
  for (let i = 0; i < 50; i++) hist.push({ role: i % 2 ? 'assistant' : 'user', content: 'ข้อความยาวพอสมควรสำหรับทดสอบการตัดประวัติ ' + i });
  const trimmed = CT.trimHistory(hist, 200);
  check('chat: trimHistory ตัดตามงบ token', trimmed.length < hist.length && trimmed.length > 0, 'n=' + trimmed.length);
  check('chat: เก็บของใหม่ล่าสุดไว้', trimmed[trimmed.length - 1].content.includes('49'));
  check('chat: role ถูกทำให้ถูกต้อง', trimmed.every((m) => ['user', 'assistant'].includes(m.role)));

  const hits = [{ id: 'scene:sc1', text: 'โทระ เจอ ยัยแมว', score: 0.8, meta: { kind: 'scene', title: 'ตลาดเก่า', sceneId: 'sc1' } }];
  let bm = CT.buildChatMessages('ยัยแมวโผล่ตอนไหน', [{ role: 'user', content: 'สวัสดี' }], hits, {});
  check('chat: ประกอบ messages พร้อมบริบท', bm.messages[bm.messages.length - 1].content.includes('ตลาดเก่า'));
  check('chat: คำถามอยู่ท้ายสุด', bm.messages[bm.messages.length - 1].content.includes('ยัยแมวโผล่ตอนไหน'));
  check('chat: system สั่งไม่ให้เดา', bm.system.includes('อย่าเดา'));
  check('chat: ไม่มีข้อมูลอ้างอิง → บอกโมเดลให้ตอบตรง ๆ', CT.buildChatMessages('ถาม', [], [], {}).messages[0].content.includes('ไม่พบข้อมูลอ้างอิง'));

  const embedClient = { embed: async (texts) => ({ ok: true, vectors: texts.map((t) => AI.localEmbed(t)), model: 'local', local: true }) };
  const chatClient = { ...fakeClient('ยัยแมวโผล่ครั้งแรกที่ [ตลาดเก่า]'), embed: embedClient.embed };
  const sess = new CT.ChatSession({ client: chatClient });
  await sess.build({ scenes: [{ id: 'sc1', title: 'ตลาดเก่า', text: 'โทระ เจอ ยัยแมว ที่ตลาดเก่า' },
                              { id: 'sc2', title: 'ยานอวกาศ', text: 'ยานทะยานขึ้นเหนือเมือง' }] });
  check('ChatSession.build ทำดัชนี', sess.size >= 2, 'size=' + sess.size);
  let cres = await sess.ask('ยัยแมวโผล่ตอนไหน');
  check('ChatSession.ask: ตอบ + อ้างอิงที่มา', cres.ok && cres.sources.length > 0 && cres.sources[0].sceneId === 'sc1', JSON.stringify(cres.sources));
  check('ChatSession: จำประวัติต่อเนื่อง', sess.history.length === 2 && sess.history[0].role === 'user');
  await sess.ask('แล้วไงต่อ');
  check('ChatSession: ประวัติสะสม', sess.history.length === 4);
  check('ChatSession: ประวัติถูกส่งเข้า messages', chatClient.calls[1].messages.length >= 3, 'n=' + chatClient.calls[1].messages.length);
  sess.reset();
  check('ChatSession.reset ล้างประวัติ', sess.history.length === 0);

  const streamed = [];
  cres = await sess.ask('ถามแบบสตรีม', { onChunk: (t) => streamed.push(t) });
  check('ChatSession: สตรีมผ่าน onChunk', streamed.join('').length > 0);

  cres = await CT.chat('', [], { client: chatClient });
  check('chat: คำถามว่าง → บอกชัด', !cres.ok && cres.code === 'empty');
  cres = await CT.chat('ถาม', [], {});
  check('chat: ไม่มี client → ไม่ throw', !cres.ok && cres.code === 'no-client');
  cres = await CT.chat('ถาม', [{ role: 'user', content: 'ก่อนหน้า' }], { client: fakeClient('ตอบ'), hits });
  check('chat: คืนประวัติใหม่ที่ต่อท้ายแล้ว', cres.history.length === 3 && cres.history[2].role === 'assistant');
  check('chat: บอกจำนวน token ของบริบท', cres.contextTokens > 0);

  // บันทึก/โหลดดัชนีลงไฟล์แคช
  const files = {};
  const io = { join: (...a) => a.join('/'), exists: async (p) => p in files,
    readJson: async (p) => JSON.parse(files[p]), writeFile: async (p, t) => { files[p] = t; } };
  const s2 = new CT.ChatSession({ client: chatClient, io, root: 'R' });
  await s2.build({ scenes: [{ id: 'sc1', title: 'ก', text: 'เนื้อหาฉากหนึ่ง' }] });
  await s2.save();
  check('ChatSession.save เขียน .ai-index.json', 'R/.ai-index.json' in files);
  const s3 = new CT.ChatSession({ client: chatClient, io, root: 'R' });
  check('ChatSession.load อ่านดัชนีกลับ', (await s3.load()) && s3.size === s2.size);
  check('ไม่มีไฟล์ดัชนี → load คืน false ไม่ throw', (await new CT.ChatSession({ client: chatClient, io, root: 'ว่าง' }).load()) === false);
  await s2.updateScene({ id: 'sc1', title: 'ก', text: 'เนื้อหาใหม่ทั้งหมด' });
  check('updateScene: ไม่ทำให้ก้อนเก่าค้าง', s2.index.items.filter((i) => i.meta.sceneId === 'sc1').every((i) => i.text.includes('ใหม่')));

  console.log(`\nai-features: ${pass} ผ่าน, ${fail} ล้มเหลว`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
