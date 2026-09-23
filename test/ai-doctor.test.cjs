// test/ai-doctor.test.cjs — [alpha.164] 🩺 ตรวจบท 5 หัวข้อ (บทสนทนา · จังหวะอืด · ปม · OOC · โทน)
// ตรรกะบริสุทธิ์ → เทสได้โดยไม่ต้องเปิด electron และไม่ยิง API จริง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_aidoctor.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/ai/ai-analyze.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const A = require(out);
const out2 = path.join(os.tmpdir(), '_aidoctor2.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/ai/ai-doctor.js')],
  outfile: out2, format: 'cjs', bundle: true, logLevel: 'silent' });
const D = require(out2);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const chars = [
  { name: 'โทระ', aliases: [], cat: 'characters', entity: { name: 'โทระ', summary: 'หนุ่มสุภาพ พูดจาเรียบร้อย', fields: { นิสัย: 'ใจเย็น' } } },
  { name: 'คาสซี่', aliases: [], cat: 'characters' },
];
const S = (id, title, text, extra = {}) => ({ id, title, text, chapterId: 'c1', chapterTitle: 'บทที่ 1', sectionKey: 'B', ...extra });

// ═══════ ทะเบียน ═══════
check('ทะเบียน: เพิ่ม 5 ชนิด ต่อท้าย 12 เดิม = 17', A.ANALYSES.length === 17, A.ANALYSIS_IDS.join());
check('ทะเบียน: id ไม่ซ้ำ', new Set(A.ANALYSIS_IDS).size === 17);
check('ทะเบียน: ลำดับตามที่ผู้ใช้สั่ง', A.ANALYSIS_IDS.slice(12).join() === 'dialog,drag,logic,ooc,tone');
check('ทะเบียน: ทุกใบมี group=doctor + ข้อความจริง (ไม่ใช่คีย์)',
  D.DOCTOR_ANALYSES.every((a) => a.group === 'doctor' && !a.title.startsWith('ui.') && !a.desc.startsWith('ui.')));
check('ทะเบียน: ทุกชนิดมีคำสั่งถึง AI', D.DOCTOR_IDS.every((id) => A.AI_TASK_KEYS[id] && !String(A.AI_TASK_KEYS[id]).includes(' ')));

// ═══════ ถอดบทพูด ═══════
const sp = S('sp1', 'ฉากบท', '### ภายใน. ร้าน - กลางคืน\n\n@โทระ\nกูไม่ไปหรอกเว้ย\n\n@คาสซี่ (V.O.)\n((กระซิบ))\nไปเถอะนะคะ', { format: 'screenplay' });
const dl = D.extractDialogue(sp, chars);
check('บทภาพยนตร์: อ่านบทพูดจากพาร์เซอร์จริง 2 ประโยค', dl.length === 2, JSON.stringify(dl));
check('บทภาพยนตร์: ผู้พูดถูกคน (ตัด V.O.)', dl[0].speaker === 'โทระ' && dl[1].speaker === 'คาสซี่', JSON.stringify(dl));
check('บทภาพยนตร์: วงเล็บไม่ถูกนับเป็นบทพูด', !dl.some((x) => x.text.includes('กระซิบ')));
const pr = S('p1', 'ฉากนิยาย', 'โทระ หันไปพูดว่า “ผมมาแล้วครับ”\n\nแดดยามเช้าสาดส่อง\n\nคาสซี่ ตอบ "ดีค่ะ"');
const dl2 = D.extractDialogue(pr, chars);
check('นิยาย: อ่านจากเครื่องหมายคำพูดทั้งสองแบบ', dl2.length === 2 && dl2[0].text === 'ผมมาแล้วครับ', JSON.stringify(dl2));
check('นิยาย: เดาผู้พูดจากชื่อนอกเครื่องหมายคำพูด', dl2[0].speaker === 'โทระ' && dl2[1].speaker === 'คาสซี่', JSON.stringify(dl2));

// ═══════ 1) บทสนทนา ═══════
const longLine = Array.from({ length: 60 }, (_, i) => 'คำ' + i).join(' ');
const dlg = D.analyzeDialogue([
  S('d1', 'ห้องประชุม', `โทระ พูด "อย่างที่คุณรู้ เราเป็นพี่น้องกันมาสิบปีแล้ว"\n\nคาสซี่ ตอบ "อย่างไรก็ตาม ดังนั้นเราต้องไป"\n\nโทระ ว่า "${longLine}"`),
  S('d2', 'ปกติ', 'โทระ ถาม "หิวไหม"\n\nคาสซี่ ตอบ "นิดหน่อย"'),
], chars);
check('บทสนทนา: จับ "อย่างที่คุณรู้" = บอกสิ่งที่รู้กันอยู่แล้ว', dlg.flagged.some((f) => f.reasons.includes('exposition')), JSON.stringify(dlg.flagged));
check('บทสนทนา: จับภาษาเขียนในปากตัวละคร', dlg.flagged.some((f) => f.reasons.includes('written')));
check('บทสนทนา: จับบทพูดยาวเกิน', dlg.flagged.some((f) => f.reasons.includes('long')));
check('บทสนทนา: ฉากปกติไม่ถูกติดธง', !dlg.flagged.some((f) => f.sceneId === 'd2'));
check('บทสนทนา: สถิตินับบทพูดครบ 5', dlg.total === 5 && dlg.stats[0].value === 5, dlg.total);
check('บทสนทนา: ข้อความยาวถูกตัดให้สั้นลง (≤140)', dlg.flagged.every((f) => f.quote.length <= 140));
// เรียกชื่อถี่ — 4 ประโยคเรียกชื่ออีกฝ่ายทุกประโยค
const voc = D.analyzeDialogue([S('v1', 'เรียกชื่อ',
  'โทระ "คาสซี่ มานี่"\n\nโทระ "คาสซี่ เร็วเข้า"\n\nโทระ "คาสซี่ นั่นอะไร"\n\nโทระ "คาสซี่ ไปกัน"')], chars);
check('บทสนทนา: เรียกชื่ออีกฝ่ายเกินครึ่ง = สัญญาณ', voc.flagged.some((f) => f.reasons.includes('vocative')), JSON.stringify(voc.flagged));

// ═══════ 2) จังหวะอืด ═══════
const slowText = Array.from({ length: 12 }, () => 'สายลมพัดผ่านทุ่งหญ้าอย่างเงียบงัน ท้องฟ้าเปลี่ยนสีทีละน้อย เงาไม้ทอดยาว นกบินกลับรัง แสงสุดท้ายของวันจางหายไปช้า ๆ').join('\n');
const fast = 'โทระ ทะเลาะ กับ คาสซี่ "ไปให้พ้น!" "ไม่!" "ฉันเกลียดนาย" "ก็ดี"';
const sc = [S('f1', 'เร็ว1', fast), S('s1', 'อืด1', slowText), S('s2', 'อืด2', slowText), S('f2', 'เร็ว2', fast)];
const drag = A.runLocal('drag', sc, chars);
const byId = Object.fromEntries(drag.rows.map((r) => [r.id, r]));
check('จังหวะอืด: ฉากบรรยายยาวไม่มีขัดแย้ง ได้คะแนนอืดสูงกว่าฉากทะเลาะ', byId.s1.drag > byId.f1.drag, JSON.stringify(drag.rows.map((r) => [r.id, r.drag])));
check('จังหวะอืด: ติดธงฉากอืด', drag.flagged.some((r) => r.id === 's1'), JSON.stringify(drag.rows));
check('จังหวะอืด: เจอช่วงอืดติดกัน 2 ฉาก', drag.runs.length === 1 && drag.runs[0].count === 2, JSON.stringify(drag.runs));
check('จังหวะอืด: เหตุผลมี "ไม่มีความขัดแย้ง" + "บรรยายยาว"', byId.s1.reasons.includes('noConflict') && byId.s1.reasons.includes('narration'), byId.s1.reasons.join());
check('จังหวะอืด: longestNarration นับข้ามย่อหน้าที่ไม่มีบทพูด', D.longestNarration('ก ข ค\n\nง จ\n\n"ฉ"\n\nช') === 5, D.longestNarration('ก ข ค\n\nง จ\n\n"ฉ"\n\nช'));

// ═══════ 3) ปมไม่สมเหตุสมผล ═══════
const lg = D.analyzeLogic([
  S('l1', 'ต้น', 'เขาเดินเข้าป่า'), S('l2', 'กลาง', 'ไม่มีอะไร'), S('l3', 'ก่อนจบ', 'ปกติ'),
  S('l4', 'ไคลแมกซ์', 'จู่ ๆ ก็มีดาบวิเศษตกลงมาจากฟ้า โชคดีที่เขารับได้พอดี'),
]);
check('ปม: เจอคำบังเอิญ 2 จุด', lg.total === 2 && lg.rows.length === 1, JSON.stringify(lg));
check('ปม: ติดป้ายว่าอยู่ช่วงท้ายเรื่อง', lg.rows[0].late === true && lg.late === 2);
check('ปม: ยกประโยคหลักฐานมาด้วย', lg.rows[0].quote.includes('ดาบวิเศษ'), lg.rows[0].quote);
check('ปม: อังกฤษไม่สนตัวพิมพ์', D.markerHits('Suddenly, BY CHANCE he won', D.CONVENIENCE_MARKERS).length === 2);

// ═══════ 4) OOC ═══════
check('OOC voiceForms: "ผม" ใน "กระผม" ไม่นับซ้ำ', JSON.stringify(D.voiceForms('กระผมขอรับ').pron) === '{"กระผม":1}', JSON.stringify(D.voiceForms('กระผมขอรับ')));
check('OOC voiceForms: คำลงท้ายต้องอยู่ท้ายวลี ("คะแนน" ไม่ใช่ "คะ")', !D.voiceForms('ได้คะแนนเต็ม').part['คะ']);
check('OOC voiceForms: "เจ้าค่ะ" ไม่ถูกนับเป็น "ค่ะ"', JSON.stringify(D.voiceForms('ได้เจ้าค่ะ').part) === '{"เจ้าค่ะ":1}');
const mk = (id, line) => S(id, 'ฉาก' + id, '@โทระ\n' + line, { format: 'screenplay' });
const ooc = D.analyzeOoc([mk('o1', 'ผมไปก่อนนะครับ'), mk('o2', 'ผมเข้าใจแล้วครับ'), mk('o3', 'ผมขอบคุณครับ'),
                          mk('o4', 'กูไม่สนโว้ย')], chars);
const tora = ooc.rows.find((r) => r.name === 'โทระ');
check('OOC: รู้สรรพนาม/คำลงท้ายประจำของตัวละคร', tora && tora.pronoun === 'ผม' && tora.particle === 'ครับ', JSON.stringify(ooc.rows));
check('OOC: จับฉากที่น้ำเสียงเปลี่ยน (กู/โว้ย)', ooc.outliers.filter((o) => o.sceneId === 'o4').length === 2, JSON.stringify(ooc.outliers));
check('OOC: ฉากที่ใช้ตามปกติไม่ถูกติดธง', !ooc.outliers.some((o) => o.sceneId !== 'o4'));
check('OOC: รู้ว่ามีโปรไฟล์ใน Wiki', tora.profile === true);
check('OOC: profileText รวม summary + fields', D.profileText(chars[0].entity).includes('ใจเย็น') && D.profileText(chars[0].entity).includes('สุภาพ'));
check('OOC: prompt แนบโปรไฟล์ตัวละคร', A.buildAnalysisPrompt('ooc', { scenes: [mk('o1', 'x')], local: ooc, characters: chars }).prompt.includes('ใจเย็น'));

// ═══════ 5) โทน ═══════
const joke = 'ทุกคนหัวเราะลั่น โทระ ปล่อยมุก คาสซี่ ขำ จนท้องแข็ง หัวเราะ อีกรอบ ตลก ดี';
const sad = 'เธอร้องไห้ น้ำตา ไหลไม่หยุด ความเจ็บปวด ของการสูญเสีย ทำให้เสียใจ จนสะอื้น';
const tn = D.analyzeTone([S('t1', 'มุก', joke), S('t2', 'มุก2', joke), S('t3', 'เศร้า', sad)], { toneTarget: 'comedy' });
check('โทน: แยกชนิดตลก/ดราม่าได้', tn.rows[0].tone === 'comedy' && tn.rows[2].tone === 'drama', JSON.stringify(tn.rows));
check('โทน: เป้าตลก → ฉากดราม่าถูกบอกให้ลดดราม่า', tn.rows[2].adjust === 'less-drama');
check('โทน: สวิงจากตลกเป็นดราม่าติดกัน = whiplash', tn.rows[2].whiplash === true && tn.rows[1].whiplash === false);
const tn2 = D.analyzeTone([S('t1', 'มุก', joke), S('t3', 'เศร้า', sad)], { toneTarget: 'drama' });
check('โทน: เป้าดราม่า → ฉากตลกถูกบอกให้ลดความตลก', tn2.rows[0].adjust === 'less-comedy');
const tn3 = D.analyzeTone([S('t1', 'มุก', joke), S('t2', 'มุก', joke), S('t4', 'มุก', joke), S('t3', 'เศร้า', sad)], {});
check('โทน: อัตโนมัติยึดโทนรวมของเรื่อง', tn3.want === 'auto' && tn3.target === 'comedy', tn3.overall + '/' + tn3.target);
check('โทน: prompt บอกโทนที่ตั้งใจ', A.buildAnalysisPrompt('tone', { scenes: [S('t1', 'x', joke)], local: tn, opts: { toneTarget: 'drama' } }).prompt.includes('ดราม่า'));
check('โทน: รูปแบบคำตอบมีช่อง adjust', A.buildAnalysisPrompt('tone', { scenes: [S('t1', 'x', joke)], local: tn }).prompt.includes('less-comedy'));

// ═══════ ชั้น AI: แปลงคำตอบ ═══════
const reply = JSON.stringify([
  { title: 'หลุดโทน', detail: 'หนักเกิน', severity: 'major', sceneId: 't3', adjust: 'less-drama', quote: 'เธอร้องไห้', suggestion: 'เบาลง' },
  { title: 'แปลก', severity: 'minor', sceneId: 't1', adjust: 'หยุดเลย' },
]);
const parsed = A.parseAnalysisReply('tone', reply, { sceneIds: ['t1', 't3'] });
check('แปลงคำตอบ: เก็บ quote/adjust ไว้', parsed.rows[0].quote === 'เธอร้องไห้' && parsed.rows[0].adjust === 'less-drama', JSON.stringify(parsed.rows));
check('แปลงคำตอบ: adjust นอกรายการ → ว่าง (ไม่ยัดค่าดิบลงจอ)', parsed.rows[1].adjust === '');
check('ข้อความ digest มีหลักฐานจากชั้นคำนวณ', A.localDigest('logic', lg).includes('ดาบวิเศษ'));

// ═══════ analyze() ครบวงจรด้วย client ปลอม ═══════
(async () => {
  let seen = null;
  const client = { complete: async (o) => { seen = o; return { ok: true, text: reply, usage: { total: 9 } }; } };
  const r = await A.analyze('tone', { scenes: [S('t1', 'มุก', joke), S('t3', 'เศร้า', sad)], characters: chars,
                                      scope: { kind: 'project' }, client, toneTarget: 'comedy' });
  check('analyze: ส่งโทนที่ตั้งใจเข้า prompt', seen && seen.prompt.includes('ตลก') && seen.feature === 'analyze:tone');
  check('analyze: ตรวจบทได้โควตาคำตอบ 1800', seen && seen.maxTokens === 1800, seen && seen.maxTokens);
  check('analyze: ได้ผลทั้งสองชั้น', r.local && r.local.rows.length === 2 && r.ai.ok && r.ai.rows.length === 2);
  const csv = A.resultCsv('tone', r);
  check('CSV: มีตารางโทนรายฉาก + คอลัมน์ข้อความของ AI', csv.includes('ควรปรับ') && csv.includes('เธอร้องไห้'), csv.slice(0, 200));
  for (const id of D.DOCTOR_IDS) {
    const loc = A.runLocal(id, sc, chars);
    check('CSV ' + id + ': มีตารางชั้นคำนวณ', Array.isArray(A.localTable(id, loc)));
    check('estimate ' + id + ': คิดโควตาตอบ 1800', A.estimateAnalysis(id, { scenes: 3, sceneTokens: 100 }).output === 1800);
  }
  console.log('--- RESULT ---');
  console.log(`PASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
