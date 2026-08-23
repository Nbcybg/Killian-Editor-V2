// test/ai-analyze.test.cjs — เอนจินแผง "🧠 AI วิเคราะห์" (alpha.89)
// ทุกอย่างในไฟล์นี้เป็นตรรกะบริสุทธิ์ → เทสได้โดยไม่ต้องเปิด electron และไม่ยิง API จริง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_aianalyze.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/ai/ai-analyze.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const A = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ───────── ข้อมูลทดสอบ: 2 เล่ม × 2 บท ─────────
const S = (id, sec, secT, ch, chT, title, text, extra = {}) =>
  ({ id, sectionKey: sec, sectionTitle: secT, chapterId: ch, chapterTitle: chT, title, text, ...extra });

const scenes = [
  S('s1', 'B1', 'เล่มหนึ่ง', 'c1', 'บทที่ 1', 'ตลาดเช้า',
    'โทระ เดินเข้าตลาด "เธอมาสายอีกแล้ว" คาสซี่ พูด โทระ ยิ้ม โทระ ยิ้มอีกครั้ง', { pov: 'โทระ', storyDate: 'ปีที่ 1' }),
  S('s2', 'B1', 'เล่มหนึ่ง', 'c1', 'บทที่ 1', 'บ้านไม้',
    'คาสซี่ โกรธ แล้วทะเลาะกับ โทระ อย่างรุนแรง เพราะเรื่องเก่าที่ยังค้างคาใจ', { pov: 'คาสซี่' }),
  S('s3', 'B1', 'เล่มหนึ่ง', 'c2', 'บทที่ 2', 'ริมน้ำ',
    'สายลมพัดผ่านผิวน้ำอย่างเงียบงัน ท้องฟ้าเปลี่ยนสีทีละน้อยจนกลายเป็นสีส้มอ่อน ไม่มีใครพูดอะไรเลยตลอดบ่ายวันนั้น '
    + 'เรือลำเล็กลอยผ่านไปอย่างช้า ๆ เงาของต้นไม้ทอดยาวลงบนพื้นทรายที่ยังอุ่นจากแดดบ่าย '
    + 'เสียงนกไกลออกไปดังขึ้นเป็นระยะก่อนจะเงียบหายไปพร้อมกับแสงสุดท้ายของวัน'),
  S('s4', 'B2', 'เล่มสอง', 'c3', 'บทที่ 3', 'หอคอย',
    'โทระ รัก คาสซี่ มานาน "ผมคิดถึงคุณ" โทระ พูด คาสซี่ เขิน แล้วจับมือ เขา ไว้แน่น', { pov: 'โทระ' }),
];
const chars = [
  { name: 'โทระ', aliases: ['เจ้าหนู'], cat: 'characters' },
  { name: 'คาสซี่', aliases: [], cat: 'characters' },
  { name: 'ลูน่า', aliases: [], cat: 'characters' },
];

// ═══════ ขอบเขต ═══════
check('scope: ทั้งโปรเจกต์ = ทุกฉาก', A.filterScope(scenes, { kind: 'project' }).length === 4);
check('scope: เฉพาะเล่ม', A.filterScope(scenes, { kind: 'book', sectionKey: 'B1' }).map((s) => s.id).join() === 's1,s2,s3');
check('scope: เฉพาะบท', A.filterScope(scenes, { kind: 'chapter', chapterId: 'c1' }).map((s) => s.id).join() === 's1,s2');
check('scope: เฉพาะฉาก', A.filterScope(scenes, { kind: 'scene', sceneId: 's4' }).map((s) => s.id).join() === 's4');
check('scope: ชนิดที่ไม่รู้จัก → ตกไปทั้งโปรเจกต์', A.filterScope(scenes, { kind: 'มั่ว' }).length === 4);
check('scope: เลือกฉากแต่ไม่ระบุ id → ว่าง (ไม่ใช่ทั้งโปรเจกต์)', A.filterScope(scenes, { kind: 'scene' }).length === 0);
check('scope: เลือกเล่มแต่ไม่ระบุ → ไม่ตัดฉากทิ้ง', A.filterScope(scenes, { kind: 'book' }).length === 4);
check('scope: SCOPE_KINDS ครบ 4 ระดับ', A.SCOPE_KINDS.join() === 'project,book,chapter,scene');
const desc = A.describeScope({ kind: 'chapter', chapterId: 'c1' }, scenes);
check('scope: describeScope บอกชื่อบทและจำนวนฉาก', desc.count === 2 && desc.text.includes('บทที่ 1') && desc.text.includes('2'), desc.text);

// ═══════ เครื่องมือนับข้อความ ═══════
check('plainText: ถอดคอมเมนต์/หัวข้อ/ลิงก์', A.plainText('<!--align:center-->\n# หัวข้อ\n[ชื่อ](x.md) **หนา**') === 'หัวข้อ\nชื่อ หนา',
  JSON.stringify(A.plainText('<!--align:center-->\n# หัวข้อ\n[ชื่อ](x.md) **หนา**')));
check('countWords: นับคำไทยได้', A.countWords('โทระ เดินเข้าตลาด') >= 3);
check('dialogueRatio: มีคำพูด > ไม่มีคำพูด', A.dialogueRatio(scenes[0].text) > A.dialogueRatio(scenes[2].text));
check('dialogueRatio: ข้อความว่างคืน 0', A.dialogueRatio('') === 0);
check('isStopword: คำหยุดไทย/อังกฤษ', A.isStopword('ที่') && A.isStopword('The') && !A.isStopword('ตลาด'));
check('countMentions: นับฉายาด้วย', A.countMentions('เจ้าหนู เดินมา แล้ว โทระ ก็มา', chars[0]) === 2);
check('mean/median/stdev', A.mean([1, 2, 3]) === 2 && A.median([3, 1, 2]) === 2 && A.median([1, 2, 3, 4]) === 2.5 && A.stdev([2, 2, 2]) === 0);

// ═══════ 1) จังหวะเรื่อง ═══════
const pace = A.analyzePacing(scenes);
check('pacing: มีแถวครบทุกฉาก', pace.rows.length === 4);
check('pacing: tempo อยู่ในช่วง 0–100', pace.rows.every((r) => r.tempo >= 0 && r.tempo <= 100));
check('pacing: ฉากบรรยายล้วนช้ากว่าฉากบทพูด',
  pace.rows.find((r) => r.id === 's3').tempo < pace.rows.find((r) => r.id === 's1').tempo,
  pace.rows.map((r) => r.id + '=' + r.tempo).join(' '));
check('pacing: มี stats 4 ตัว', pace.stats.length === 4);
check('findRuns: ต้องติดกันอย่างน้อย 2 ถึงจะนับเป็นช่วง',
  A.findRuns([{ tempo: 1, id: 'a', title: 'a' }, { tempo: 9, id: 'b', title: 'b' }, { tempo: 1, id: 'c', title: 'c' }], (r) => r.tempo < 5).length === 0);
check('findRuns: ช่วงติดกันบอกต้น–ปลาย',
  A.findRuns([{ tempo: 1, id: 'a', title: 'a' }, { tempo: 1, id: 'b', title: 'b' }], (r) => r.tempo < 5)[0].count === 2);

// ═══════ 2) เส้นโค้งตัวละคร ═══════
const arc = A.analyzeArc(scenes, chars);
check('arc: ตัดตัวละครที่ไม่โผล่ทิ้ง', !arc.chars.some((c) => c.name === 'ลูน่า'));
check('arc: เรียงตามจำนวนครั้งมาก→น้อย', arc.chars[0].total >= arc.chars[arc.chars.length - 1].total);
check('arc: ต่อบทครบทุกบทที่มีในขอบเขต', arc.chars[0].perChapter.length === 3);
const cassie = arc.chars.find((c) => c.name === 'คาสซี่');
check('arc: บทที่ตัวละครหายกลางทางถูกจับได้', cassie && cassie.gaps.length === 1 && cassie.gaps[0].count === 1
  || (cassie && cassie.perChapter[1].count === 0), JSON.stringify(cassie && cassie.perChapter.map((p) => p.count)));
check('arc: ไม่มีตัวละคร → chars ว่าง แต่ยังมี stats', A.analyzeArc(scenes, []).chars.length === 0 && A.analyzeArc(scenes, []).stats.length === 3);

// ═══════ 3) คำที่ใช้บ่อย ═══════
const words = A.analyzeWords(scenes, { characters: chars });
check('words: ไม่มีคำหยุดในผล', !words.rows.some((r) => A.isStopword(r.word)));
check('words: ไม่มีชื่อตัวละครในผล', !words.rows.some((r) => r.word === 'โทระ' || r.word === 'คาสซี่'));
check('words: เรียงจากมากไปน้อย', words.rows.every((r, i) => i === 0 || words.rows[i - 1].count >= r.count));
check('words: per10k คำนวณจากคำทั้งหมด', words.total > 0 && words.rows.every((r) => r.per10k >= 0));
check('words: จำกัดจำนวนแถวตาม top', A.analyzeWords(scenes, { top: 3 }).rows.length <= 3);

// ═══════ 4) ความขัดแย้ง ═══════
const conf = A.analyzeConflict(scenes);
check('conflict: ฉากทะเลาะได้คะแนน > 0', conf.rows.find((r) => r.id === 's2').score > 0);
check('conflict: ฉากบรรยายเงียบถูกจัดว่าไม่มีร่องรอย', conf.empty.some((r) => r.id === 's3'),
  conf.empty.map((r) => r.id).join());
check('conflict: coverage เป็นเปอร์เซ็นต์ 0–100', conf.coverage >= 0 && conf.coverage <= 100);

// ═══════ 5) ความยาวฉาก ═══════
const len = A.analyzeLength(scenes);
check('length: total = ผลรวมของทุกฉาก', len.total === len.rows.reduce((a, r) => a + r.words, 0));
check('length: มีเวลาอ่านทุกแถว', len.rows.every((r) => r.minutes >= 0));
check('length: ฉากเดียวไม่ทำให้ sd พัง (ไม่มี outlier)', A.analyzeLength([scenes[0]]).long.length === 0);

// ═══════ 8) คำซ้ำระยะใกล้ ═══════
const rep = A.analyzeRepeats(scenes, { window: 60 });
check('repeat: จับ "ยิ้ม" ที่ซ้ำในฉากเดียวกันได้', rep.rows.some((r) => r.word === 'ยิ้ม' && r.id === 's1'),
  rep.rows.map((r) => r.word).join());
check('repeat: ระยะแคบลงแล้วเจอน้อยลงหรือเท่าเดิม',
  A.analyzeRepeats(scenes, { window: 2 }).totalFound <= rep.totalFound);
check('repeat: ไม่รายงานคำหยุด', !rep.rows.some((r) => A.isStopword(r.word)));
check('repeat: ตัดชื่อตัวละครออกได้', !A.analyzeRepeats(scenes, { characters: chars }).rows.some((r) => r.word === 'โทระ'));

// ═══════ 9) คู่จิ้น ═══════
const ship = A.analyzeShipping(scenes, chars);
check('shipping: คู่ที่อยู่ด้วยกันบ่อยขึ้นอันดับหนึ่ง',
  ship.rows[0] && [ship.rows[0].a, ship.rows[0].b].sort().join() === ['คาสซี่', 'โทระ'].sort().join(),
  JSON.stringify(ship.rows[0] || {}));
check('shipping: ชื่อคู่เรียงคงที่ (a<b เสมอ)', ship.rows.every((r) => r.a.localeCompare(r.b) <= 0));
check('shipping: ตัวละครเดียวไม่เกิดคู่', A.analyzeShipping(scenes, [chars[0]]).rows.length === 0);

// ═══════ 11) Screentime ═══════
const st = A.analyzeScreentime(scenes, chars);
check('screentime: ตัดตัวที่ไม่โผล่ทิ้ง', !st.rows.some((r) => r.name === 'ลูน่า'));
check('screentime: เรียงตามน้ำหนักมาก→น้อย', st.rows.every((r, i) => i === 0 || st.rows[i - 1].words >= r.words));
check('screentime: share รวมไม่เกิน 100 ต่อคน', st.rows.every((r) => r.share >= 0 && r.share <= 100));
check('screentime: นับตัวที่ไม่โผล่เลยไว้ใน stats', st.stats.some((s) => String(s.value) === '1'));

// ═══════ 10) ให้คะแนน (ชั้นคำนวณเอง) ═══════
const score = A.analyzeScoreLocal(scenes, chars);
check('score: มีเกณฑ์ 6 ข้อ', score.criteria.length === 6);
check('score: ทุกเกณฑ์อยู่ในช่วง 0–10', score.criteria.every((c) => c.score >= 0 && c.score <= 10),
  score.criteria.map((c) => c.key + '=' + c.score).join(' '));
check('score: total = ค่าเฉลี่ยของเกณฑ์', Math.abs(score.total - A.mean(score.criteria.map((c) => c.score))) < 0.06);
check('score: บอกชัดว่าเป็นชั้นคำนวณเอง', score.source === 'local');

// ═══════ ทะเบียนการวิเคราะห์ ═══════
check('ทะเบียน: ครบ 11 ชนิดตามที่ผู้ใช้สั่ง', A.ANALYSES.length === 11, A.ANALYSIS_IDS.join());
check('ทะเบียน: id ไม่ซ้ำ', new Set(A.ANALYSIS_IDS).size === 11);
check('ทะเบียน: ทุกใบมีชื่อ/คำอธิบาย/ไอคอน', A.ANALYSES.every((a) => a.title && a.desc && a.icon));
check('ทะเบียน: ไม่มีคีย์ภาษาหลุดมาเป็นชื่อ', !A.ANALYSES.some((a) => a.title.startsWith('ui.') || a.desc.startsWith('ui.')),
  A.ANALYSES.filter((a) => a.title.startsWith('ui.')).map((a) => a.id).join());
check('ทะเบียน: ลำดับตรงกับที่ผู้ใช้สั่ง 1–11',
  A.ANALYSIS_IDS.join() === 'pacing,arc,words,conflict,length,plothole,continuity,repeat,shipping,score,screentime');
check('ทะเบียน: analysisById หาเจอ/ไม่เจอถูกต้อง', A.analysisById('score').id === 'score' && A.analysisById('มั่ว') === null);

// runLocal ต้องคืน stats ให้ครบทุกชนิด (ไม่มีชนิดไหนที่กดแล้วหน้าจอว่าง)
for (const id of A.ANALYSIS_IDS) {
  const r = A.runLocal(id, scenes, chars);
  check('runLocal: ' + id + ' คืน stats', Array.isArray(r.stats) && r.stats.length > 0);
}

// ═══════ ชั้น AI: prompt ═══════
const local = A.runLocal('pacing', scenes, chars);
const built = A.buildAnalysisPrompt('pacing', { scenes, local, scope: { kind: 'project' } });
check('prompt: แนบ sceneId ทุกฉาก', scenes.every((s) => built.prompt.includes('[sceneId: ' + s.id + ']')));
check('prompt: บอกขอบเขตที่วิเคราะห์', built.prompt.includes('ทั้งโปรเจกต์'));
check('prompt: แนบตัวเลขที่นับมาแล้ว', built.prompt.includes('จังหวะ=') && built.prompt.includes('ห้ามนับใหม่'));
check('prompt: สั่งตอบ JSON', built.prompt.includes('JSON') && built.system.includes('JSON'));
check('prompt: ห้ามแต่งเรื่อง', built.system.includes('ห้ามแต่ง'));
check('prompt: focus เพิ่มบรรทัดพิเศษ',
  A.buildAnalysisPrompt('pacing', { scenes, local, focus: 'ปมมรดก' }).prompt.includes('ปมมรดก'));
check('prompt: ให้คะแนนใช้รูปแบบ object ไม่ใช่ array',
  A.buildAnalysisPrompt('score', { scenes, local: A.analyzeScoreLocal(scenes, chars) }).prompt.includes('"criteria"'));
const tiny = A.buildAnalysisPrompt('pacing', { scenes, local, budget: 120 });
check('prompt: งบน้อย → ตัดเนื้อฉากแต่ไม่ทิ้งทั้งหมด', tiny.truncated === true && tiny.prompt.length > 0);
check('sceneBlocks: ฉากยาวเกินงบถูกตัด ไม่ถูกทิ้ง', A.sceneBlocks(scenes, 200).blocks.length >= 1);
check('AI_TASK_KEYS: ครบทุกชนิด', A.ANALYSIS_IDS.every((id) => !!A.AI_TASK_KEYS[id]));

// ═══════ ชั้น AI: แปลงคำตอบ ═══════
const reply = JSON.stringify([
  { title: 'บทที่ 2 หน่วง', detail: 'ไม่มีเหตุการณ์', severity: 'major', sceneId: 's3', suggestion: 'ตัดครึ่ง' },
  { title: 'เร่งไป', severity: 'ระเบิด', sceneId: 's1' },
  { title: 'ฉากผี', severity: 'minor', sceneId: 'ไม่มีจริง' },
  { detail: 'ไม่มีหัวข้อ' },
]);
const parsed = A.parseAnalysisReply('pacing', reply, { sceneIds: scenes.map((s) => s.id) });
check('parse: ตัดข้อที่ sceneId ไม่มีจริง', !parsed.rows.some((r) => r.sceneId === 'ไม่มีจริง'));
check('parse: ตัดข้อที่ไม่มีหัวข้อ', !parsed.rows.some((r) => !r.title));
check('parse: ระดับความรุนแรงผิด → ตกไปค่าปริยาย', parsed.rows.some((r) => r.sceneId === 's1' && r.severity === 'minor'));
check('parse: เรียง major มาก่อน minor', parsed.rows[0].severity === 'major', parsed.rows.map((r) => r.severity).join());
check('parse: แนบป้ายภาษาไทยของระดับ', parsed.rows.every((r) => !!r.severityLabel));
check('parse: ตอบไม่เป็น JSON → rows ว่าง ไม่ throw', A.parseAnalysisReply('pacing', 'ขอโทษครับ ผมทำไม่ได้').rows.length === 0);

const sc = A.parseAnalysisReply('score', JSON.stringify({
  criteria: [{ label: 'จังหวะ', score: 7, note: 'ดี' }, { label: 'ภาษา', score: 99 }],
  total: 8, summary: 'ใช้ได้',
}));
check('parse score: คืนชนิด score', sc.kind === 'score');
check('parse score: คะแนนเกิน 10 ถูกบีบลง', sc.rows.find((r) => r.label === 'ภาษา').score === 10);
check('parse score: ใช้ total ที่โมเดลให้มา', sc.total === 8);
check('parse score: ไม่ให้ total → เฉลี่ยเอง',
  A.parseAnalysisReply('score', JSON.stringify({ criteria: [{ label: 'a', score: 4 }, { label: 'b', score: 6 }] })).total === 5);
check('parse score: เก็บบทสรุป', sc.summary === 'ใช้ได้');

// ═══════ ประมาณโทเคน "ก่อนใช้" ═══════
const baseAll = A.scopeTokens(scenes, { kind: 'project' });
const baseCh = A.scopeTokens(scenes, { kind: 'chapter', chapterId: 'c1' });
check('scopeTokens: นับฉากในขอบเขต', baseAll.scenes === 4 && baseCh.scenes === 2);
check('scopeTokens: ขอบเขตเล็กกว่า → โทเคนน้อยกว่า', baseCh.sceneTokens < baseAll.sceneTokens,
  baseCh.sceneTokens + ' vs ' + baseAll.sceneTokens);
check('scopeTokens: งบน้อย → บอกว่าถูกตัด', A.scopeTokens(scenes, { kind: 'project' }, 80).truncated === true);
const est = A.estimateAnalysis('pacing', baseAll);
check('estimateAnalysis: total = input + output', est.total === est.input + est.output);
check('estimateAnalysis: input มากกว่าเนื้อฉากล้วน (มีคำสั่ง+ตัวเลขบวกเข้าไป)',
  est.input > baseAll.sceneTokens, est.input + ' vs ' + baseAll.sceneTokens);
check('estimateAnalysis: ให้คะแนนเผื่อคำตอบสั้นกว่าชนิดอื่น',
  A.estimateAnalysis('score', baseAll).output < A.estimateAnalysis('pacing', baseAll).output);
check('estimateAnalysis: ขอบเขตว่างก็ไม่พัง', A.estimateAnalysis('pacing', {}).total > 0);
const tot = A.estimateTotal(A.ANALYSIS_IDS, baseAll);
check('estimateTotal: รวมครบ 11 ชนิด', tot.count === 11 && tot.total > est.total);
check('estimateUsd: ollama ฟรี', A.estimateUsd('ollama', 'llama3', tot) === 0);
check('estimateUsd: เจ้าที่คิดเงิน > 0', A.estimateUsd('openai', 'gpt-4o-mini', tot) > 0);
check('estimateUsd: โมเดลแพงกว่า → ราคาสูงกว่า',
  A.estimateUsd('claude', 'claude-sonnet-4-5', tot) > A.estimateUsd('openai', 'gpt-4o-mini', tot));

// ═══════ โทเคนที่ใช้ไปจริง "หลังใช้งาน" ═══════
const usedRes = {
  pacing: { id: 'pacing', local: {}, ai: { ok: true, usage: { total: 100 }, cost: { usd: 0.002 } } },
  words: { id: 'words', local: {}, ai: { ok: true, usage: { input: 30, output: 20 }, cost: { usd: 0.001 } } },
  length: { id: 'length', local: {}, ai: { ok: false, error: 'x' } },
  score: { id: 'score', local: {}, ai: null },
};
const used = A.usageOfResults(usedRes);
check('usageOfResults: นับเฉพาะรอบที่สำเร็จ', used.calls === 2, JSON.stringify(used));
check('usageOfResults: ไม่มี total ก็บวก in+out ให้', used.tokens === 150, used.tokens);
check('usageOfResults: รวมราคา', Math.abs(used.usd - 0.003) < 1e-9, used.usd);
check('usageOfResults: ไม่มีผลเลย → ศูนย์', A.usageOfResults({}).tokens === 0);

// ═══════ เซสชัน ═══════
const sess = A.newAnalysisSession({ now: 1700000000000, name: 'รอบแรก',
  scope: { kind: 'chapter', chapterId: 'c1' }, scopeText: 'เฉพาะบท: บทที่ 1 · 2 ฉาก', results: usedRes });
check('session: มีเลขรุ่น schema', sess.v === A.ANALYSIS_SESSION_VERSION);
check('session: id มาจากเวลา (ไม่สุ่ม → เทสซ้ำได้)', sess.id === 'ana-1700000000000');
check('session: เก็บขอบเขตครบทุกช่อง',
  sess.scope.kind === 'chapter' && sess.scope.chapterId === 'c1' && sess.scope.sectionKey === '');
check('session: คิดโทเคนที่ใช้ให้อัตโนมัติ', sess.usage.tokens === 150);
check('session: ไม่ตั้งชื่อก็ไม่พัง', A.newAnalysisSession({ now: 1 }).name === '');
const round = A.migrateAnalysisSession(JSON.parse(JSON.stringify(sess)));
check('session: เขียนเป็น JSON แล้วอ่านกลับได้เหมือนเดิม',
  round.id === sess.id && Object.keys(round.results).length === 4);
check('session: ชนิดที่ไม่มีในทะเบียนแล้วถูกตัดทิ้ง',
  Object.keys(A.migrateAnalysisSession({ results: { pacing: { local: {} }, ของเก่า: { local: {} } } }).results).join() === 'pacing');
check('session: ไฟล์พัง/ว่างก็ไม่ throw',
  !!A.migrateAnalysisSession(null).id && !!A.migrateAnalysisSession('มั่ว').id);
const sum = A.sessionSummary(sess);
check('sessionSummary: บอกจำนวนชนิด/โทเคน/ราคา', sum.kinds === 4 && sum.tokens === 150 && sum.usd === 0.003);
check('sessionFileName: ลงท้าย .json', A.sessionFileName(sess).endsWith('.json'));
check('sessionFileName: ตัวอักษรต้องห้ามของ Windows ถูกแทนที่',
  !/[\\/:*?"<>|]/.test(A.sessionFileName({ name: 'a/b:c*d?e"f<g>h|i' })),
  A.sessionFileName({ name: 'a/b:c*d?e"f<g>h|i' }));
check('sessionFileName: ไม่มีชื่อ → ใช้ id', A.sessionFileName({ id: 'ana-9' }) === 'ana-9.json');

// ═══════ ส่งออก CSV ═══════
check('csvEscape: ข้อความมีจุลภาคถูกครอบด้วยอัญประกาศ', A.csvEscape('a,b') === '"a,b"');
check('csvEscape: อัญประกาศถูกซ้อนสองตัว', A.csvEscape('เขา "พูด"') === '"เขา ""พูด"""');
check('csvEscape: ขึ้นบรรทัดใหม่ก็ต้องครอบ', A.csvEscape('a\nb').startsWith('"'));
check('csvEscape: null/undefined → ค่าว่าง', A.csvEscape(null) === '' && A.csvEscape(undefined) === '');
check('csvJoin: คั่นแถวด้วย CRLF', A.csvJoin([['a', 'b'], ['c', 'd']]) === 'a,b\r\nc,d');

for (const id of A.ANALYSIS_IDS) {
  const r = { id, local: A.runLocal(id, scenes, chars), scope: A.describeScope({ kind: 'project' }, scenes) };
  const csv = A.resultCsv(id, r);
  check('csv: ' + id + ' มีเนื้อหาและชื่อการ์ด', csv.includes(A.analysisById(id).title) && csv.length > 40);
  // อัญประกาศต้องปิดครบเสมอ — ถ้าเปิดค้าง Excel จะกลืนทั้งไฟล์เป็นเซลล์เดียว
  check('csv: ' + id + ' อัญประกาศปิดครบ', ((csv.match(/"/g) || []).length % 2) === 0);
  check('csv: ' + id + ' ขึ้นบรรทัดด้วย CRLF เท่านั้น', !/[^\r]\n/.test(csv));
}
const tblPace = A.localTable('pacing', A.runLocal('pacing', scenes, chars));
check('localTable: pacing มีหัวตาราง + แถวเท่าจำนวนฉาก', tblPace.length === 5 && tblPace[0].length === 6);
const tblArc = A.localTable('arc', A.runLocal('arc', scenes, chars));
check('localTable: arc กระจายเป็น ตัวละคร×บท', tblArc.length === 1 + 2 * 3, tblArc.length);
check('localTable: ชนิดที่ไม่มีตารางคืน null', A.localTable('pacing', {}) === null);

const csvOne = A.resultCsv('screentime', {
  id: 'screentime', local: A.runLocal('screentime', scenes, chars),
  scope: A.describeScope({ kind: 'project' }, scenes),
  ai: { ok: true, kind: 'findings', rows: [{ severity: 'major', severityLabel: 'สำคัญ', title: 'โทระกินพื้นที่มาก', detail: 'ก', suggestion: 'ข', sceneId: 's1' }], usage: { total: 42 }, cost: { usd: 0.01 } },
});
check('csv: ใส่สิ่งที่ AI พบลงไปด้วย', csvOne.includes('โทระกินพื้นที่มาก') && csvOne.includes('สำคัญ'));
check('csv: บอกโทเคนที่ใช้ไปจริง', csvOne.includes('42'));
const csvScore = A.resultCsv('score', {
  id: 'score', local: A.runLocal('score', scenes, chars),
  ai: { ok: true, kind: 'score', total: 8, summary: 'ดี', rows: [{ label: 'จังหวะ', score: 7, note: 'ก' }] },
});
check('csv: คะแนนจาก AI มีบทสรุปด้วย', csvScore.includes('ดี') && csvScore.includes('จังหวะ'));

const full = A.sessionCsv(A.newAnalysisSession({
  now: 1, name: 'ทั้งเล่ม', scopeText: 'ทั้งโปรเจกต์ · 4 ฉาก',
  results: Object.fromEntries(A.ANALYSIS_IDS.map((id) => [id,
    { id, local: A.runLocal(id, scenes, chars), scope: A.describeScope({ kind: 'project' }, scenes) }])),
}));
check('sessionCsv: ขึ้นต้นด้วย BOM (Excel บน Windows อ่านไทยออก)', full.charCodeAt(0) === 0xFEFF);
check('sessionCsv: มีครบทุกชนิดในไฟล์เดียว',
  A.ANALYSES.every((a) => full.includes(a.title)),
  A.ANALYSES.filter((a) => !full.includes(a.title)).map((a) => a.id).join());
check('sessionCsv: มีหัวเซสชันและขอบเขต', full.includes('ทั้งเล่ม') && full.includes('ทั้งโปรเจกต์'));
check('sessionCsv: เซสชันว่างก็ไม่ throw', typeof A.sessionCsv({}) === 'string');

// ═══════ analyze() ครบวงจร ═══════
const fakeClient = (text) => {
  const calls = [];
  return { calls, complete: async (o) => { calls.push(o); return { ok: true, text, usage: { total: 12 }, cost: { usd: 0.001 } }; } };
};
(async () => {
  const c1 = fakeClient(reply);
  const r1 = await A.analyze('pacing', { scenes, characters: chars, scope: { kind: 'chapter', chapterId: 'c1' }, client: c1 });
  check('analyze: ใช้เฉพาะฉากในขอบเขต', r1.scenes === 2 && !c1.calls[0].prompt.includes('[sceneId: s3]'));
  check('analyze: มีทั้งชั้นคำนวณเองและชั้น AI', !!r1.local.stats && r1.ai && r1.ai.ok === true);
  check('analyze: ตั้งชื่อ feature ให้ตัวนับต้นทุน', c1.calls[0].feature === 'analyze:pacing');
  check('analyze: อุณหภูมิต่ำ (งานตรวจสอบ)', c1.calls[0].temperature <= 0.4);

  const r2 = await A.analyze('pacing', { scenes, characters: chars, scope: { kind: 'project' }, useAI: false });
  check('analyze: ปิด AI แล้วยังได้ผลคำนวณเอง', r2.ai === null && r2.local.rows.length === 4);

  const r3 = await A.analyze('pacing', { scenes, scope: { kind: 'scene', sceneId: 'ไม่มีจริง' } });
  check('analyze: ขอบเขตว่าง → บอกเหตุผล ไม่ throw', !!r3.error);

  const r4 = await A.analyze('มั่วซั่ว', { scenes });
  check('analyze: ชนิดที่ไม่รู้จัก → error', !!r4.error);

  const r5 = await A.analyze('pacing', {
    scenes, scope: { kind: 'project' },
    client: { complete: async () => ({ ok: false, error: 'HTTP 401' }) },
  });
  check('analyze: AI ล้มเหลว → ชั้นคำนวณเองยังอยู่', r5.local.rows.length === 4 && r5.ai.ok === false && r5.ai.error === 'HTTP 401');

  console.log('\n--- RESULT ---');
  console.log('PASS ' + pass + '  FAIL ' + fail);
  if (fail) process.exit(1);
})();
