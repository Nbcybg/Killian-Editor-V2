// test/ai-core.test.cjs — ทดสอบ ai-core + ai-assistant (ข้อ 72) ด้วย node — ไม่ยิง API จริงสักครั้ง
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const build = (src, name) => {
  const out = path.join(os.tmpdir(), name);
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + src)], outfile: out,
    format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const AI = build('ai/ai-core.js', '_aicore.cjs');
const AS = build('ai/ai-assistant.js', '_aiassist.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── buildRequest ต่อ provider ──
const req = AI.buildRequest('openai', { apiKey: 'sk-test', model: 'gpt-4o-mini', system: 'ระบบ', prompt: 'สวัสดี', maxTokens: 100 });
check('openai: url ถูก', req.url === 'https://api.openai.com/v1/chat/completions');
check('openai: ใส่ Bearer key', req.headers.Authorization === 'Bearer sk-test');
check('openai: system เป็น message แรก', req.body.messages[0].role === 'system' && req.body.messages[1].content === 'สวัสดี');

const rc = AI.buildRequest('claude', { apiKey: 'k', system: 'ระบบ', prompt: 'ถาม' });
check('claude: ใช้ x-api-key + version', rc.headers['x-api-key'] === 'k' && rc.headers['anthropic-version'] === '2023-06-01');
check('claude: system แยกจาก messages', rc.body.system === 'ระบบ' && rc.body.messages[0].content === 'ถาม');
check('claude: โมเดลปริยาย', rc.body.model === 'claude-sonnet-4-5', rc.body.model);

const ro = AI.buildRequest('ollama', { prompt: 'ถาม', baseUrl: 'http://127.0.0.1:9999' });
check('ollama: ใช้ baseUrl ที่ตั้งเอง + ไม่มีคีย์', ro.url === 'http://127.0.0.1:9999/api/chat' && !ro.headers.Authorization);
check('provider ไม่รู้จัก → ตกไป openai', AI.buildRequest('มั่ว', { prompt: 'x' }).url.includes('openai'));
check('messages ที่ส่งมาเองถูกใช้แทน prompt', AI.buildRequest('openai', { messages: [{ role: 'user', content: 'A' }, { role: 'assistant', content: 'B' }] }).body.messages.length === 2);

// ── parseResponse ──
let p = AI.parseResponse('openai', { choices: [{ message: { content: ' ผลลัพธ์ ' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
check('openai: ถอดข้อความ + usage', p.text.trim() === 'ผลลัพธ์' && p.usage.total === 15);
p = AI.parseResponse('claude', { content: [{ type: 'text', text: 'ก' }, { type: 'text', text: 'ข' }], usage: { input_tokens: 3, output_tokens: 4 } });
check('claude: ต่อ content หลายก้อน', p.text === 'กข' && p.usage.total === 7);
p = AI.parseResponse('ollama', { message: { content: 'โอเค' }, prompt_eval_count: 2, eval_count: 3 });
check('ollama: ถอดข้อความ', p.text === 'โอเค' && p.usage.output === 3);
check('คำตอบพัง → ไม่ throw คืนข้อความว่าง', AI.parseResponse('openai', null).text === '' && AI.parseResponse('openai', { ผิด: 1 }).text === '');
check('ไม่มี usage → ประมาณจากข้อความ', AI.parseResponse('openai', { choices: [{ message: { content: 'abcdefgh' } }] }).usage.output > 0);

// ── stream chunk ──
check('openai SSE: delta', AI.parseStreamChunk('openai', 'data: {"choices":[{"delta":{"content":"ก"}}]}').text === 'ก');
check('openai SSE: [DONE]', AI.parseStreamChunk('openai', 'data: [DONE]').done === true);
check('openai SSE: บรรทัดว่าง/keepalive → null', AI.parseStreamChunk('openai', ': ping') === null);
check('claude SSE: content_block_delta', AI.parseStreamChunk('claude', 'data: {"type":"content_block_delta","delta":{"text":"ข"}}').text === 'ข');
check('claude SSE: message_stop', AI.parseStreamChunk('claude', 'data: {"type":"message_stop"}').done === true);
check('ollama: JSON บรรทัดเดียว', AI.parseStreamChunk('ollama', '{"message":{"content":"ค"}}').text === 'ค');
check('ollama: done', AI.parseStreamChunk('ollama', '{"done":true}').done === true);
check('บรรทัดพัง → null ไม่ throw', AI.parseStreamChunk('openai', 'data: {ไม่ใช่ json') === null);

// ── token + cost ──
check('estimateTokens ไทยกินน้อยกว่าอังกฤษต่อ 1 ตัวอักษร', AI.estimateTokens('กกกกกกกกกกกก') > AI.estimateTokens('aaaaaaaaaaaa'));
check('ข้อความว่าง → 0', AI.estimateTokens('') === 0);
const cost = AI.estimateCost('openai', 'gpt-4o-mini', { input: 1e6, output: 1e6 });
check('estimateCost คิดตามราคา in/out', Math.abs(cost.usd - 0.75) < 1e-6, String(cost.usd));
check('ollama ฟรีเสมอ', AI.estimateCost('ollama', 'llama3', { input: 1e6, output: 1e6 }).usd === 0);
check('โมเดลไม่รู้จัก → ใช้ราคา default', AI.estimateCost('openai', 'ไม่มีรุ่นนี้', { input: 1e6, output: 0 }).usd > 0);

const meta = {};
const tracker = new AI.CostTracker({ meta, max: 3, now: () => 1700000000000 });
for (let i = 0; i < 5; i++) tracker.record({ provider: 'openai', model: 'gpt-4o-mini', usage: { input: 100, output: 50, total: 150 }, feature: 'assistant:expand' });
check('CostTracker เขียนลง meta.ai.usage', Array.isArray(meta.ai.usage) && meta.ai.usage.length === 3);
check('CostTracker cap ตามที่ตั้ง', meta.ai.usage.length === 3);
check('summary รวมยอด', tracker.summary().calls === 3 && tracker.summary().tokens === 450, JSON.stringify(tracker.summary()));
check('byFeature แยกตามฟีเจอร์', tracker.byFeature()['assistant:expand'].calls === 3);

// ── ความปลอดภัย ──
check('mask ซ่อนคีย์', AI.mask('sk-abcdefghijklmnop') === 'sk-…mnop', AI.mask('sk-abcdefghijklmnop'));
check('mask คีย์ว่าง', AI.mask('') === '(ยังไม่ตั้ง)');
check('mask คีย์สั้น ไม่หลุด', AI.mask('sk-123') === '…');
const red = AI.redact({ url: 'x', headers: { Authorization: 'Bearer sk-abcdefghijkl', 'Content-Type': 'application/json' }, apiKey: 'sk-abcdefghijkl' });
check('redact ล้าง Authorization', !JSON.stringify(red).includes('abcdefghij'), JSON.stringify(red));
check('redact เก็บ field อื่นไว้', red.headers['Content-Type'] === 'application/json');

(async () => {
  // KeyStore กับ mock io
  const files = {};
  const io = { join: (...a) => a.join('/'), exists: async (p) => p in files,
    readJson: async (p) => (p in files ? JSON.parse(files[p]) : null),
    writeFile: async (p, t) => { files[p] = t; } };
  const ks = new AI.KeyStore({ io, root: 'R' });
  check('ยังไม่มีไฟล์ → คีย์ว่าง', (await ks.get()) === '');
  ks.clear();
  await ks.set('sk-secret-123456');
  check('set เขียน ai-key.json', 'R/ai-key.json' in files && JSON.parse(files['R/ai-key.json']).apiKey === 'sk-secret-123456');
  const ks2 = new AI.KeyStore({ io, root: 'R' });
  check('อ่านคีย์กลับได้', (await ks2.get()) === 'sk-secret-123456');
  check('masked() ไม่คืนคีย์เต็ม', (await ks2.masked()) === 'sk-…3456');

  // RateLimiter
  let clock = 0;
  const rl = new AI.RateLimiter({ rpm: 2, concurrent: 5, now: () => clock, sleep: async (ms) => { clock += ms; } });
  await rl.acquire(); rl.release();
  await rl.acquire(); rl.release();
  check('เกิน rpm → ต้องรอ', rl.check() > 0, 'wait=' + rl.check());
  await rl.acquire();
  check('รอครบนาที → ผ่านได้', clock >= 60000, 'clock=' + clock);
  rl.release();
  const rl2 = new AI.RateLimiter({ rpm: 100, concurrent: 1, now: () => clock, sleep: async () => {} });
  await rl2.acquire();
  check('เกิน concurrent → check = -1', rl2.check() === -1);
  rl2.release();
  check('ปล่อยแล้วเรียกได้อีก', rl2.check() === 0);

  // ── AIClient: สำเร็จ / ไม่มีคีย์ / retry 429 / เน็ตล่ม ──
  const mkClient = (fetchImpl, settings = {}) => new AI.AIClient({
    http: { fetch: fetchImpl }, settings: { provider: 'openai', ...settings },
    keyStore: new AI.KeyStore({ cache: 'sk-x' }), tracker: new AI.CostTracker({ meta: {} }),
    limiter: new AI.RateLimiter({ rpm: 999, concurrent: 9, sleep: async () => {} }), sleep: async () => {},
  });
  let calls = 0;
  let c = mkClient(async () => { calls++; return { ok: true, status: 200, body: JSON.stringify({ choices: [{ message: { content: 'ตอบแล้ว' } }], usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 } }) }; });
  let r = await c.complete({ prompt: 'ถาม', feature: 'test' });
  check('complete สำเร็จ', r.ok && r.text === 'ตอบแล้ว' && r.usage.total === 6, JSON.stringify(r));
  check('complete คิดต้นทุนมาด้วย', typeof r.cost.usd === 'number');

  calls = 0;
  c = mkClient(async () => { calls++; return calls < 3 ? { ok: false, status: 429, body: '' } : { ok: true, status: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) }; });
  r = await c.complete({ prompt: 'x' });
  check('429 → retry แล้วสำเร็จ', r.ok && calls === 3, 'calls=' + calls);

  calls = 0;
  c = mkClient(async () => { calls++; return { ok: false, status: 401, body: 'bad key' }; });
  r = await c.complete({ prompt: 'x' });
  check('401 → ไม่ retry คืนข้อความไทย', !r.ok && calls === 1 && r.error.includes('API key'), r.error);
  check('ไม่ throw แม้ล้มเหลว', r.ok === false && r.text === '');

  c = mkClient(async () => { throw new Error('ENOTFOUND'); });
  r = await c.complete({ prompt: 'x' });
  check('เน็ตล่ม → { ok:false, code:network }', !r.ok && r.code === 'network');

  const noKey = new AI.AIClient({ http: { fetch: async () => ({ ok: true, body: '{}' }) },
    settings: { provider: 'openai' }, keyStore: new AI.KeyStore({ cache: '' }) });
  r = await noKey.complete({ prompt: 'x' });
  check('ไม่มีคีย์ → บอกให้ไปตั้งค่า ไม่ยิงเน็ต', !r.ok && r.code === 'no-key');
  check('ready() = false เมื่อไม่มีคีย์', (await noKey.ready()) === false);
  const oll = new AI.AIClient({ http: { fetch: async () => ({ ok: true, body: '{}' }) }, settings: { provider: 'ollama' } });
  check('ollama ไม่ต้องใช้คีย์ → ready() = true', (await oll.ready()) === true);

  // ── stream: มี http.stream / ไม่มี (fallback) ──
  const got = [];
  const sc = new AI.AIClient({
    http: {
      fetch: async () => ({ ok: true, body: '{}' }),
      stream: async (url, o, onLine) => {
        for (const l of ['data: {"choices":[{"delta":{"content":"ส"}}]}', 'data: {"choices":[{"delta":{"content":"วัสดี"}}]}', 'data: [DONE]']) onLine(l);
        return { ok: true };
      },
    },
    settings: { provider: 'openai' }, keyStore: new AI.KeyStore({ cache: 'sk-x' }),
    limiter: new AI.RateLimiter({ rpm: 999, concurrent: 9, sleep: async () => {} }),
  });
  r = await sc.stream({ prompt: 'ถาม' }, (t) => got.push(t));
  check('stream: ได้ทีละก้อน', got.join() === 'ส,วัสดี', got.join());
  check('stream: รวมข้อความครบ', r.ok && r.text === 'สวัสดี', r.text);
  const got2 = [];
  r = await mkClient(async () => ({ ok: true, status: 200, body: JSON.stringify({ choices: [{ message: { content: 'ก้อนเดียว' } }] }) }))
    .stream({ prompt: 'x' }, (t) => got2.push(t));
  check('ไม่มี http.stream → fallback ส่งก้อนเดียว', got2.join() === 'ก้อนเดียว' && r.ok);

  // ── embed + fallback local ──
  const ec = mkClient(async () => ({ ok: true, status: 200, body: JSON.stringify({ data: [{ embedding: [1, 0, 0] }, { embedding: [0, 1, 0] }] }) }));
  let e = await ec.embed(['ก', 'ข']);
  check('embed ระยะไกลสำเร็จ', e.ok && e.vectors.length === 2 && !e.local);
  e = await ec.embed(['ก'], { local: true });
  check('บังคับ local ได้', e.local === true && e.vectors[0].length === AI.EMBED_DIM);
  e = await mkClient(async () => ({ ok: false, status: 500, body: '' })).embed(['ก']);
  check('embed ล้มเหลว → ตกไป local ไม่พัง', e.ok && e.local && e.fellBack);
  const cl = new AI.AIClient({ http: { fetch: async () => ({ ok: true, body: '{}' }) }, settings: { provider: 'claude' }, keyStore: new AI.KeyStore({ cache: 'k' }) });
  e = await cl.embed(['ก']);
  check('claude ไม่มี embeddings → ใช้ local อัตโนมัติ', e.local === true);

  // ── chunk / embed local / cosine / VectorIndex ──
  const long = Array.from({ length: 30 }, (_, i) => `ย่อหน้าที่ ${i} มีเนื้อหาพอสมควรสำหรับทดสอบการซอยข้อความยาว ๆ ออกเป็นก้อน`).join('\n\n');
  const chunks = AI.chunkText(long, { maxTokens: 100, overlap: 10 });
  check('chunkText ซอยหลายก้อน', chunks.length > 1, 'n=' + chunks.length);
  check('ทุกก้อนไม่เกินงบมากนัก', chunks.every((c) => AI.estimateTokens(c) <= 130), JSON.stringify(chunks.map((c) => AI.estimateTokens(c))));
  check('ข้อความว่าง → []', AI.chunkText('').length === 0);
  check('ย่อหน้าเดียวยาวเกิน → ถูกซอยตามความยาว', AI.chunkText('ก'.repeat(3000), { maxTokens: 100 }).length > 1);

  const v1 = AI.localEmbed('โทระ เดินเข้าไปในตลาดเก่า');
  const v2 = AI.localEmbed('โทระ เดินเข้าไปในตลาดเก่า');
  const v3 = AI.localEmbed('ยานอวกาศลำใหญ่ทะยานขึ้นสู่ห้วงอวกาศ');
  check('localEmbed คงที่ (deterministic)', AI.cosine(v1, v2) > 0.999);
  check('ข้อความต่างกัน → คะแนนต่ำกว่า', AI.cosine(v1, v3) < AI.cosine(v1, v2));
  check('มิติคงที่', v1.length === AI.EMBED_DIM);
  check('cosine ของเวกเตอร์ว่าง → 0', AI.cosine([0, 0], [0, 0]) === 0 && AI.cosine([1], [1, 2]) === 0);

  const idx = new AI.VectorIndex({});
  idx.add('a', 'โทระ ที่ตลาดเก่า', AI.localEmbed('โทระ ที่ตลาดเก่า'), { title: 'ฉาก 1' });
  idx.add('b', 'ยานอวกาศทะยานขึ้น', AI.localEmbed('ยานอวกาศทะยานขึ้น'), { title: 'ฉาก 2' });
  const hits = idx.search(AI.localEmbed('ตลาดเก่า'), 2);
  check('VectorIndex.search จัดอันดับถูก', hits[0].id === 'a', JSON.stringify(hits.map((h) => [h.id, +h.score.toFixed(2)])));
  check('search จำกัด k', idx.search(AI.localEmbed('x'), 1).length <= 1);
  check('filter ใช้ได้', idx.search(AI.localEmbed('ตลาด'), 5, { filter: (it) => it.id === 'b' }).every((h) => h.id === 'b'));
  const back = AI.VectorIndex.fromJSON(JSON.parse(JSON.stringify(idx.toJSON())));
  check('VectorIndex round-trip JSON', back.size === 2 && back.search(AI.localEmbed('ตลาดเก่า'), 1)[0].id === 'a');
  check('fromJSON ของพัง → ว่าง ไม่ throw', AI.VectorIndex.fromJSON(null).size === 0);

  const ctx = AI.buildContext(hits, { maxTokens: 1000 });
  check('buildContext ใส่ชื่อแหล่งที่มา', ctx.text.includes('[ฉาก 1]') && ctx.sources.length >= 1, JSON.stringify(ctx.sources));
check('search ตัดผลที่คะแนน 0 ทิ้ง', hits.length === 1, JSON.stringify(hits.map((h) => h.id)));
  check('buildContext เคารพงบ token', AI.buildContext(hits, { maxTokens: 3 }).text === '');

  // ── RagPipeline ──
  const rag = new AI.RagPipeline({ client: { embed: async (texts) => ({ ok: true, vectors: texts.map((t) => AI.localEmbed(t)), model: 'local', local: true }) } });
  const added = await rag.indexDocs([
    { id: 'sc1', text: 'โทระ เดินเข้าไปในตลาดเก่า แล้วเจอยัยแมว', meta: { title: 'ตลาดเก่า' } },
    { id: 'sc2', text: 'ยานอวกาศทะยานขึ้นเหนือเมืองในคืนฝนตก', meta: { title: 'เมืองอนาคต' } },
  ]);
  check('RagPipeline.indexDocs เพิ่มก้อนเข้า index', added.added >= 2 && rag.index.size >= 2);
  const rHits = await rag.retrieve('ตลาดเก่า', 1);
  check('RagPipeline.retrieve คืนก้อนที่เกี่ยวข้องที่สุด', rHits[0].meta.docId === 'sc1', JSON.stringify(rHits[0] && rHits[0].meta));
  const rCtx = await rag.context('ตลาดเก่า', { k: 2 });
  check('RagPipeline.context ประกอบบล็อกอ้างอิง', rCtx.text.includes('ตลาดเก่า') && rCtx.sources.length > 0);

  // ── extractJson / coerceArray / validate ──
  check('extractJson: JSON ตรง ๆ', AI.extractJson('[{"a":1}]')[0].a === 1);
  check('extractJson: ```json fence', AI.extractJson('นี่คือผลลัพธ์\n```json\n[{"a":2}]\n```\nจบ')[0].a === 2);
  check('extractJson: มีข้อความห่อหน้า-หลัง', AI.extractJson('ผลลัพธ์: {"a":3} ครับ').a === 3);
  check('extractJson: comma เกินท้าย', AI.extractJson('[{"a":4},]')[0].a === 4);
  check('extractJson: ไม่มี JSON → null', AI.extractJson('ขอโทษครับ ทำไม่ได้') === null);
  check('extractJson: object อยู่แล้ว → คืนเลย', AI.extractJson({ a: 5 }).a === 5);
  check('coerceArray: object เดี่ยว → [obj]', AI.coerceArray({ a: 1 }).length === 1);
  check('coerceArray: { items:[…] }', AI.coerceArray({ items: [1, 2] }).length === 2);
  check('coerceArray: null → []', AI.coerceArray(null).length === 0);
  const schema = { type: { required: true, type: 'string', enum: ['a', 'b'], default: 'a' }, n: { type: 'number', default: 0 } };
  const rows = AI.validate([{ type: 'b', n: '5' }, { type: 'ผิด' }, { n: 1 }, 'ขยะ'], schema);
  check('validate: แปลงชนิด + enum + default', rows.length === 3 && rows[0].n === 5 && rows[1].type === 'a', JSON.stringify(rows));
  check('validate: ตัดแถวที่ required ขาด', AI.validate([{ n: 1 }], { title: { required: true, type: 'string' } }).length === 0);

  // ── ai-assistant: prompt (pure) ──
  let bp = AS.buildPrompt('expand', { text: 'เขาเดินเข้ามา', length: 'long' });
  check('expand: prompt มีคำสั่งขยายความ + ต้นฉบับ', bp.prompt.includes('ขยายความ') && bp.prompt.includes('เขาเดินเข้ามา'));
  check('expand: ระบุความยาวตาม LENGTHS', bp.prompt.includes(AS.LENGTHS.long));
  check('system เป็นภาษาไทยและสั่งไม่ให้อธิบาย', bp.system.includes('ภาษาไทย') && bp.system.includes('ห้ามอธิบาย'));
  bp = AS.buildPrompt('changeTone', { text: 'ก', tone: 'dark' });
  check('changeTone: ใส่ชื่อโทน + คำแนะนำ', bp.prompt.includes(AS.TONES.dark.label) && bp.prompt.includes(AS.TONES.dark.hint));
  bp = AS.buildPrompt('rewrite', { text: 'ก', instruction: 'ให้สั้นลงครึ่งหนึ่ง' });
  check('rewrite: แนบคำสั่งผู้เขียน', bp.prompt.includes('ให้สั้นลงครึ่งหนึ่ง'));
  bp = AS.buildPrompt('summarize', { text: 'ก', format: 'screenplay' });
  check('format screenplay → สั่งรูปแบบบทภาพยนตร์', bp.prompt.includes('บทภาพยนตร์'));
  bp = AS.buildPrompt('expand', { text: 'ก', context: { project: 'ปีศาจแห่งบางกอก', scene: { title: 'ตลาดเก่า', pov: 'โทระ' }, entities: [{ name: 'ยัยแมว', summary: 'แมวพูดได้' }] } });
  check('context: ใส่ชื่อเรื่อง/ฉาก/ตัวละครลง prompt',
    bp.prompt.includes('ปีศาจแห่งบางกอก') && bp.prompt.includes('ตลาดเก่า') && bp.prompt.includes('ยัยแมว'));
  check('contextBlock: null → สตริงว่าง', AS.contextBlock(null) === '' && AS.contextBlock('') === '');
  check('contextBlock: retrieved → บล็อกอ้างอิง',
    AS.contextBlock({ retrieved: [{ id: 'x', text: 'เนื้อหา', score: 0.9, meta: { title: 'ฉากหนึ่ง' } }] }).includes('ฉากหนึ่ง'));

  // ── aiAssistant + client ปลอม ──
  const seen = [];
  const fake = { complete: async (o) => { seen.push(o); return { ok: true, text: 'ผลลัพธ์', usage: { total: 3 }, cost: { usd: 0 } }; } };
  let ar = await AS.aiAssistant('', { text: 'ต้นฉบับ' }, { task: 'expand', client: fake });
  check('aiAssistant คืนผลลัพธ์ + prompt ที่ใช้', ar.ok && ar.text === 'ผลลัพธ์' && ar.prompt.includes('ต้นฉบับ'));
  check('ตั้งชื่อ feature ให้ cost tracking', seen[0].feature === 'assistant:expand', seen[0].feature);
  check('ไม่ส่ง client → { ok:false } ไม่ throw', (await AS.aiAssistant('x')).ok === false);
  ar = await AS.expand('ข้อความ', { client: fake });
  check('expand() ทางลัดทำงาน', ar.ok && ar.task === 'expand');
  ar = await AS.summarize('ข้อความ', { client: fake, length: 'short' });
  check('summarize() ส่ง length ต่อ', ar.prompt.includes(AS.LENGTHS.short));
  ar = await AS.changeTone('ข้อความ', 'humorous', { client: fake });
  check('changeTone() ใส่โทนตลก', ar.prompt.includes('ตลก'));
  ar = await AS.rewrite('ข้อความ', { client: fake, instruction: 'ใช้ประโยคสั้น' });
  check('rewrite() แนบคำสั่ง', ar.prompt.includes('ใช้ประโยคสั้น'));

  const chunksGot = [];
  const streamFake = { complete: fake.complete, stream: async (o, cb) => { cb('บาง'); cb('ส่วน'); return { ok: true, text: 'บางส่วน' }; } };
  ar = await AS.aiAssistant('', { text: 'ก' }, { task: 'expand', client: streamFake, stream: true, onChunk: (t) => chunksGot.push(t) });
  check('stream:true → ใช้ client.stream + ส่ง onChunk', chunksGot.join('') === 'บางส่วน' && ar.ok);

  // RAG ต่อกับ assistant
  ar = await AS.aiAssistant('ตลาดเก่า', null, { task: 'custom', client: fake, rag });
  check('aiAssistant + rag: ดึงบริบทมาใส่ prompt', ar.prompt.includes('ข้อมูลอ้างอิง') && ar.sources.length > 0, JSON.stringify(ar.sources));

  console.log(`\nai-core: ${pass} ผ่าน, ${fail} ล้มเหลว`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
