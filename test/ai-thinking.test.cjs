// test/ai-thinking.test.cjs — [alpha.170 · บั๊ก 2/14/15] โมเดลที่คิดก่อนตอบ · คำตอบว่าง · รูปแบบ API · ข้อความ 400
//
// ที่มา (ลองใช้แอปจริงกับโมเดลที่คิดก่อนตอบ):
//   · ตรวจ Plot Hole ได้ out=1500 think=1500 chars=0 แล้วกล่องขึ้น "ไม่พบจุดบกพร่องของพล็อต"
//   · สร้างโลกได้ JSON ถูกตัดกลางทาง แล้วขึ้น "AI ตอบไม่ตรงโครง"
//   · 400 เพราะขาด header / โมเดลไม่รับ chat/completions ถูกอธิบายว่า "พารามิเตอร์ผิด"
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', file)], outfile: tmp,
    bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(tmp);
};
const P = build('ai/ai-providers.js', 'k2-aithink-prov.cjs');
const E = build('ai/ai-error.js', 'k2-aithink-err.cjs');
const PLOT = build('ai/ai-plot.js', 'k2-aithink-plot.cjs');
const CHR = build('ai/ai-character.js', 'k2-aithink-chr.cjs');
const WLD = build('ai/ai-world.js', 'k2-aithink-wld.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── คำตอบว่าง / ถูกตัด เพราะการคิด ─────────
check('ว่าง + ชนเพดาน = คิดจนโควตาหมด', P.isStarvedReply({ text: '', truncated: true, usage: {} }) === true);
check('ว่าง + มีโทเคนคิด = คิดจนโควตาหมด', P.isStarvedReply({ text: '  ', usage: { reasoning: 1500 } }) === true);
check('ว่าง + มีข้อความความคิด = คิดจนโควตาหมด', P.isStarvedReply({ text: '', thinking: 'กำลังคิด', usage: {} }) === true);
check('ว่างเฉย ๆ (ไม่มีร่องรอยการคิด) = ไม่ใช่', P.isStarvedReply({ text: '', usage: { reasoning: 0 } }) === false);
check('มีคำตอบ = ไม่ใช่', P.isStarvedReply({ text: '[]', truncated: true, usage: { reasoning: 99 } }) === false);
check('null ไม่พัง', P.isStarvedReply(null) === false && P.isCutByThinking(null) === false);
check('มีคำตอบ + ถูกตัด + มีการคิด = ถูกตัดเพราะการคิด',
      P.isCutByThinking({ text: '{"a":', truncated: true, usage: { reasoning: 920 } }) === true);
check('ถูกตัดแต่ไม่ได้คิด = ไม่ใช่ (คำตอบยาวเองจริง ๆ)',
      P.isCutByThinking({ text: 'ยาว', truncated: true, usage: { reasoning: 0 } }) === false);
check('ไม่ถูกตัด = ไม่ใช่', P.isCutByThinking({ text: 'จบ', usage: { reasoning: 500 } }) === false);

check('ไม่เคยเห็นคิด = ไม่เผื่อ', P.thinkingHeadroom(0) === 0 && P.thinkingHeadroom(undefined) === 0);
check('เผื่อสองเท่าของที่เคยเห็น', P.thinkingHeadroom(1500) === 3000);
check('เผื่อขั้นต่ำ', P.thinkingHeadroom(10) === P.THINK_HEADROOM_MIN);
check('เผื่อไม่เกินเพดาน', P.thinkingHeadroom(999999) === P.THINK_HEADROOM_MAX);
check('★ รอบลองใหม่ของเคสจริง (1500 คิด 1500) ได้ที่พอให้ทั้งคิดและตอบ',
      P.boostedMaxTokens(1500, 1500) >= 1500 + 1500 + 1000, P.boostedMaxTokens(1500, 1500));
check('เพดานเล็กมาก (16) ก็ยกขึ้นถึงขั้นต่ำ', P.boostedMaxTokens(16, 0) === 4096);
check('ไม่จำกัดอยู่แล้ว = คงเดิม', P.boostedMaxTokens(-1, 500) === -1 && P.boostedMaxTokens(0, 500) === 0);
check('ไม่เกินเพดานรวม', P.boostedMaxTokens(30000, 30000) === P.BOOST_MAX_TOKENS);

// ───────── รูปแบบ API ─────────
{
  const mk = (cred) => P.newProvider({ name: 'x', model: 'm', credential: { name: 'c', apiKey: 'k-secret', ...cred } });
  const oa = mk({ baseUrl: 'https://gw.example.com/v1' });
  check('ไม่ได้ตั้ง = openai', P.apiKindOf(oa) === 'openai' && oa.credential.api === 'openai');
  check('ค่าแปลกในไฟล์ = openai', P.apiKindOf({ credential: { api: 'soap' } }) === 'openai');
  check('โฮสต์ anthropic ที่ไม่ได้ตั้ง ยังเป็น openai (ของเดิมไม่ถูกย้ายเอง)',
        P.apiKindOf(mk({ baseUrl: 'https://api.anthropic.com/v1' })) === 'openai');
  const r1 = P.chatRequest(oa, { messages: [{ role: 'user', content: 'hi' }], system: 's' });
  check('openai → …/chat/completions + system เป็นข้อความแรก',
        r1.url === 'https://gw.example.com/v1/chat/completions' && r1.body.messages[0].role === 'system');

  const an = mk({ baseUrl: 'https://gw.example.com/v1', api: 'anthropic' });
  const r2 = P.chatRequest(an, { messages: [{ role: 'system', content: 'กฎเพิ่ม' }, { role: 'user', content: 'hi' },
                                            { role: 'assistant', content: 'yo' }], system: 'หลัก', stream: true, maxTokens: 300 });
  check('★ anthropic → …/messages', r2.url === 'https://gw.example.com/v1/messages', r2.url);
  check('anthropic: system แยกออกจาก messages (รวม role=system ที่ปนมา)',
        r2.body.system === 'หลัก\n\nกฎเพิ่ม' && r2.body.messages.every((m) => m.role !== 'system') && r2.body.messages.length === 2,
        JSON.stringify(r2.body));
  check('anthropic: ส่ง max_tokens ที่ฟีเจอร์ขอ + stream', r2.body.max_tokens === 300 && r2.body.stream === true);
  check('anthropic: มีหัว x-api-key + anthropic-version',
        r2.headers['x-api-key'] === 'k-secret' && !!r2.headers['anthropic-version']);
  const an2 = P.newProvider({ name: 'x', model: 'm', params: { maxTokens: -1, temperature: 1.6 },
                              credential: { name: 'c', baseUrl: 'https://api.anthropic.com', api: 'anthropic' } });
  const r3 = P.chatRequest(an2, { messages: [{ role: 'user', content: 'hi' }] });
  check('anthropic: ไม่จำกัด (-1) ก็ยังต้องส่ง max_tokens (โปรโตคอลบังคับ)', r3.body.max_tokens === P.ANTHROPIC_DEFAULT_MAX);
  check('anthropic: ฐานไม่มี /v1 → ต่อ /v1/messages', r3.url === 'https://api.anthropic.com/v1/messages', r3.url);
  check('anthropic: temperature ถูกหนีบไม่เกิน 1', r3.body.temperature === 1, r3.body.temperature);
  check('anthropic: ไม่มี system = ไม่ส่งช่อง system', !('system' in r3.body));
  check('ชุดสำเร็จรูปทุกตัวมีที่อยู่ https/localhost + รูปแบบที่รู้จัก',
        P.PROVIDER_PRESETS.length >= 5 && P.PROVIDER_PRESETS.every((x) =>
          x.id && x.name && /^https?:\/\//.test(x.baseUrl) && P.API_KINDS.includes(x.api)));
  check('ชุดสำเร็จรูป: id ไม่ซ้ำ', new Set(P.PROVIDER_PRESETS.map((x) => x.id)).size === P.PROVIDER_PRESETS.length);
}

// ───────── ข้อความ 400 ─────────
{
  const hdr = 'Request is missing x-opencode-session and cannot be routed efficiently.';
  const proto = 'Model does not support this protocol.';
  check('ขาด header → header', E.badRequestKind(hdr) === 'header');
  check('"required header" → header', E.badRequestKind('The anthropic-version header is required') === 'header');
  check('ไม่รับโปรโตคอล → protocol', E.badRequestKind(proto) === 'protocol');
  check('พารามิเตอร์ผิดธรรมดา → ไม่จัดประเภทพิเศษ',
        E.badRequestKind('max_tokens is too large: 999999') === '' && E.badRequestKind('') === '');
  const a = E.describeHttpError({ status: 400, body: JSON.stringify({ error: { message: hdr } }), url: 'https://x.example/v1/chat/completions' });
  check('★ 400 ขาด header: คำแนะนำพูดถึง Custom Headers (ไม่ใช่ Max Tokens)',
        a.code === 'http-400-header' && a.hints.length === 1 && /Custom Headers/.test(a.hints[0]), JSON.stringify(a.hints));
  const b = E.describeHttpError({ status: 400, body: JSON.stringify({ error: { message: proto } }) });
  check('★ 400 โปรโตคอล: คำแนะนำพาไปที่ "รูปแบบ API"', b.code === 'http-400-protocol' && /API/.test(b.hints[0]), JSON.stringify(b.hints));
  const c = E.describeHttpError({ status: 400, body: JSON.stringify({ error: { message: 'bad temperature' } }) });
  check('400 ทั่วไป: รหัสเดิม', c.code === 'http-400' && c.hints.length === 2);
  check('★ หัวข้อไม่มีเลขสถานะซ้ำสองรอบ', (c.title.match(/400/g) || []).length === 1, c.title);
  const d = E.describeHttpError({ status: 401, body: '' });
  check('สถานะอื่นยังมี (HTTP n) หนึ่งครั้ง', (d.title.match(/401/g) || []).length === 1, d.title);
}

// ───────── ฟีเจอร์: คำตอบที่อ่านไม่ได้ ≠ "ไม่พบปัญหา" ─────────
(async () => {
  const scenes = [{ id: 's1', title: 'หนึ่ง', text: 'มีนาเดินเข้าห้อง ' + 'ก'.repeat(50) },
                  { id: 's2', title: 'สอง', text: 'มีนานั่งลง ' + 'ข'.repeat(50) }];
  const clientOf = (reply) => ({ complete: async () => reply });

  const empty = await PLOT.detectPlotHoles([], { client: clientOf({ ok: true, text: '', truncated: true }), scenes, includeLocal: false });
  check('★★ ตรวจ Plot Hole: AI ตอบว่าง → ไม่ ok + มีข้อความผิดพลาด (เดิม: ok และ "ไม่พบ")',
        empty.ok === false && !!empty.error && empty.holes.length === 0, JSON.stringify({ ok: empty.ok, e: empty.error }));
  const prose = await PLOT.detectPlotHoles([], { client: clientOf({ ok: true, text: 'ผมอ่านแล้ว ไม่มีอะไรน่าเป็นห่วงครับ' }), scenes, includeLocal: false });
  check('ตรวจ Plot Hole: ตอบเป็นเรียงความ (ไม่มี JSON) → ไม่ ok', prose.ok === false && !!prose.error);
  const none = await PLOT.detectPlotHoles([], { client: clientOf({ ok: true, text: '[]' }), scenes, includeLocal: false });
  check('ตรวจ Plot Hole: ตอบ [] = "ไม่พบ" ของจริง (ok ไม่มี error)', none.ok === true && none.holes.length === 0 && !none.error,
        JSON.stringify({ ok: none.ok, e: none.error }));
  const fenced = await PLOT.detectPlotHoles([], { client: clientOf({ ok: true, text: '```json\n[]\n```' }), scenes, includeLocal: false });
  check('ตรวจ Plot Hole: [] ในบล็อกโค้ดก็นับ', fenced.ok === true && !fenced.error);

  const ent = { name: 'มีนา', aliases: [], fields: {} };
  const c1 = await CHR.checkConsistency('x', { client: clientOf({ ok: true, text: '' }), entity: ent, scenes, includeLocal: false });
  check('★ ตรวจความสม่ำเสมอ: ตอบว่าง → มี error (เดิม "ไม่พบความไม่สม่ำเสมอ")',
        !!c1.error && c1.code === 'unreadable' && c1.issues.length === 0, JSON.stringify({ e: c1.error, c: c1.code }));
  const c2 = await CHR.checkConsistency('x', { client: clientOf({ ok: true, text: '[]' }), entity: ent, scenes, includeLocal: false });
  check('ตรวจความสม่ำเสมอ: ตอบ [] = ไม่พบจริง', c2.ok === true && !c2.error);

  let calls = 0;
  const cut = await WLD.generateWorld('faction', 'องค์กรลับ', { client: { complete: async (o) => { calls++; return { ok: true, truncated: true, text: '{"name":"เงา","fields":{"goal":"' }; } } });
  check('★ สร้างโลก: JSON ถูกตัด → บอกว่า "ถูกตัด" (รหัส truncated) ไม่ใช่ "ไม่ตรงโครง"',
        cut.ok === false && cut.code === 'truncated', JSON.stringify({ c: cut.code, e: cut.error }));
  check('สร้างโลก: ลองซ้ำหนึ่งรอบก่อนยอมแพ้', calls === 2, calls);
  let asked = 0;
  await WLD.generateWorld('city', 'เมืองท่า', { client: { complete: async (o) => { asked = o.maxTokens; return { ok: false, error: 'x' }; } } });
  check('สร้างโลก: ขอความยาวคำตอบ ≥ 3000 โทเคน (JSON ไทยยาว)', asked >= 3000, asked);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
