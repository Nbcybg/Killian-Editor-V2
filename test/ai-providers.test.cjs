// ai-providers.test.cjs — [alpha.61 ข้อ 2] ทะเบียนผู้ให้บริการ AI + เซสชันแชท
// โมดูลบริสุทธิ์ทั้งคู่ (ไม่แตะ DOM/fs/network) → แปลงเป็น CJS ชั่วคราวแล้ว require ตรง ๆ
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function load(rel) {
  const tmp = path.join(__dirname, '.tmp-' + path.basename(rel) + '.cjs');
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', rel)], bundle: true,
                      format: 'cjs', platform: 'node', outfile: tmp, logLevel: 'silent' });
  const m = require(tmp);
  fs.unlinkSync(tmp);
  return m;
}
const P = load('src/ai/ai-providers.js');
const S = load('src/ai/ai-session.js');

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + extra : '')); }
};

// ══════════════════ 1) พารามิเตอร์ ══════════════════
{
  const want = ['thinkingMode', 'frequencyPenalty', 'maxRetries', 'maxTokens', 'presencePenalty',
                'reasoningEffort', 'responseFormat', 'temperature', 'timeout', 'topK', 'topP',
                'customHeaders'];
  check('[พารามิเตอร์] มีครบ 12 ตัวตามที่สั่ง และเรียงตามลำดับนั้น',
        JSON.stringify(P.PARAM_KEYS) === JSON.stringify(want), JSON.stringify(P.PARAM_KEYS));
  const d = P.defaultParams();
  check('[พารามิเตอร์] ค่าเริ่มต้นครบทุกคีย์', want.every((k) => k in d));
  check('[พารามิเตอร์] customHeaders เป็น object ใหม่ทุกครั้ง (ไม่แชร์ตัวเดียวกัน)',
        P.defaultParams().customHeaders !== P.defaultParams().customHeaders);

  const norm = P.normalizeParams({ temperature: '5', topP: -3, maxRetries: '2.6',
                                   reasoningEffort: 'สูงมาก', responseFormat: 'json_object',
                                   customHeaders: { ' X-A ': 1, '': 'ทิ้ง' } });
  check('[พารามิเตอร์] ค่าเกินช่วงถูกหนีบ (temperature 5 → 2)', norm.temperature === 2, norm.temperature);
  check('[พารามิเตอร์] ค่าติดลบเกินช่วงถูกหนีบ (topP -3 → 0)', norm.topP === 0, norm.topP);
  check('[พารามิเตอร์] ชนิดจำนวนเต็มถูกปัด (2.6 → 3)', norm.maxRetries === 3, norm.maxRetries);
  check('[พารามิเตอร์] ตัวเลือกที่ไม่รู้จักตกกลับค่าเริ่มต้น', norm.reasoningEffort === '', norm.reasoningEffort);
  check('[พารามิเตอร์] ตัวเลือกที่ถูกต้องผ่าน', norm.responseFormat === 'json_object');
  check('[พารามิเตอร์] customHeaders ตัดช่องว่างชื่อ + ทิ้งชื่อว่าง',
        JSON.stringify(norm.customHeaders) === JSON.stringify({ 'X-A': '1' }),
        JSON.stringify(norm.customHeaders));
  // กฎ 20: 0 ที่ตั้งมาจริง ต้องไม่ถูกมองเป็น "ไม่ได้ตั้ง"
  const zero = P.normalizeParams({ temperature: 0, topK: 0, maxTokens: 1 });
  check('[พารามิเตอร์] temperature=0 ที่ตั้งมาจริง ไม่ตกกลับ 0.7', zero.temperature === 0, zero.temperature);
  check('[พารามิเตอร์] topK=0 ที่ตั้งมาจริง ไม่กลายเป็น null', zero.topK === 0, zero.topK);
  const blank = P.normalizeParams({ temperature: '', topK: '' });
  check('[พารามิเตอร์] ช่องที่ปล่อยว่างตกกลับค่าเริ่มต้น (ไม่ใช่ 0)',
        blank.temperature === 0.7 && blank.topK === null, JSON.stringify(blank.topK));
}

// ══════════════════ 2) Allowed HTTP Request Domains ══════════════════
{
  check('[โดเมน] แยกได้ทั้งคอมมา ช่องว่าง และขึ้นบรรทัด',
        JSON.stringify(P.parseDomains('a.com, b.com\n c.com')) === JSON.stringify(['a.com', 'b.com', 'c.com']));
  check('[โดเมน] ปอก https:// และ path ทิ้ง',
        JSON.stringify(P.parseDomains('https://api.openai.com/v1')) === JSON.stringify(['api.openai.com']));
  check('[โดเมน] รายการว่าง = ไม่จำกัด (ยังไม่ตั้งกำแพง)',
        P.isDomainAllowed('https://any.example/x', []) === true);
  check('[โดเมน] ตรงเป๊ะผ่าน', P.isDomainAllowed('https://api.openai.com/v1/models', ['api.openai.com']));
  check('[โดเมน] ไม่ตรงถูกปฏิเสธ', P.isDomainAllowed('https://evil.com/x', ['api.openai.com']) === false);
  check('[โดเมน] ไวลด์การ์ดครอบซับโดเมน',
        P.isDomainAllowed('https://api.example.com/x', ['*.example.com']) &&
        P.isDomainAllowed('https://a.b.example.com/x', ['*.example.com']));
  check('[โดเมน] ไวลด์การ์ดไม่ครอบโดเมนเปล่า (ต้องใส่เพิ่มเอง)',
        P.isDomainAllowed('https://example.com/x', ['*.example.com']) === false);
  check('[โดเมน] URL เสียถูกปฏิเสธเมื่อมีกำแพง', P.isDomainAllowed('ไม่ใช่ url', ['a.com']) === false);
}

// ══════════════════ 3) โครง provider + validate ══════════════════
{
  const p = P.newProvider({ name: 'เจ้าของฉัน' });
  check('[provider] สร้างแล้วมี id/credential/params ครบ',
        !!p.id && !!p.credential.id && P.PARAM_KEYS.every((k) => k in p.params));
  check('[provider] id ไม่ซ้ำกัน', P.newProvider().id !== P.newProvider().id);
  // อ่านของเก่าที่ credential ยังไม่มี id → ต้องเติมให้ ไม่ใช่ปล่อยว่าง
  const old = P.newProvider({ name: 'เก่า', credential: { name: 'c', baseUrl: 'https://a.com' } });
  check('[provider] credential ของเก่าที่ไม่มี id ถูกเติม id ให้', !!old.credential.id);
  check('[provider] ฟิลด์ที่ส่งมายังอยู่ครบ', old.credential.baseUrl === 'https://a.com');

  const bad = P.validateProvider(P.newProvider({}));
  check('[validate] provider เปล่าฟ้องครบ 3 ข้อ (ชื่อ · ชื่อ credential · base url)',
        bad.length === 3, JSON.stringify(bad));
  const noProto = P.validateProvider(P.newProvider({ name: 'a',
    credential: { name: 'c', baseUrl: 'api.openai.com' } }));
  check('[validate] base url ที่ไม่มี http(s):// ถูกฟ้อง',
        noProto.some((e) => e.includes('http')), JSON.stringify(noProto));
  const blocked = P.validateProvider(P.newProvider({ name: 'a',
    credential: { name: 'c', baseUrl: 'https://evil.com', allowedDomains: ['api.openai.com'] } }));
  check('[validate] base url ที่หลุดกำแพงโดเมนถูกฟ้อง',
        blocked.some((e) => e.includes('Allowed')), JSON.stringify(blocked));
  const ok = P.validateProvider(P.newProvider({ name: 'a',
    credential: { name: 'c', baseUrl: 'https://api.openai.com/v1', allowedDomains: ['api.openai.com'] } }));
  check('[validate] ครบถ้วนแล้วผ่าน', ok.length === 0, JSON.stringify(ok));
}

// ══════════════════ 4) แยกความลับออกจากไฟล์ที่แชร์ ══════════════════
{
  const p = P.newProvider({ name: 'x', credential: { name: 'c', apiKey: 'sk-ลับมาก', baseUrl: 'https://a.com' } });
  const safe = P.stripSecrets(p);
  check('[ความลับ] stripSecrets ตัด apiKey ออกจริง', !('apiKey' in safe.credential));
  check('[ความลับ] คีย์ไม่โผล่ใน JSON ที่จะเขียนลง project.khn.json',
        !JSON.stringify(safe).includes('sk-ลับมาก'));
  check('[ความลับ] ฟิลด์อื่นยังอยู่ครบ', safe.credential.baseUrl === 'https://a.com' && safe.name === 'x');
  const back = P.withSecrets(safe, { [p.credential.id]: 'sk-ลับมาก' });
  check('[ความลับ] ใส่คีย์กลับได้จาก ai-key.json', back.credential.apiKey === 'sk-ลับมาก');
  check('[ความลับ] ไม่มีคีย์ในไฟล์ → ได้สตริงว่าง ไม่ใช่ undefined',
        P.withSecrets(safe, {}).credential.apiKey === '');
}

// ══════════════════ 5) คำขอรายชื่อโมเดล ══════════════════
{
  const p = P.newProvider({ name: 'x', credential: { name: 'c', apiKey: 'k', baseUrl: 'https://api.x.ai/v1' } });
  const reqs = P.modelsRequests(p);
  check('[models] base ที่ลงท้าย /v1 ไม่ต่อ /v1 ซ้ำ',
        !reqs.some((r) => r.url.includes('/v1/v1')), JSON.stringify(reqs.map((r) => r.url)));
  check('[models] ลอง /models เป็นอันแรก', reqs[0].url === 'https://api.x.ai/v1/models', reqs[0].url);
  check('[models] มีทางเลือกของ Ollama ด้วย', reqs.some((r) => r.url.endsWith('/api/tags')));
  check('[models] ไม่มี base url → ไม่มีคำขอเลย', P.modelsRequests(P.newProvider()).length === 0);
  check('[models] คำขอเป็น GET พร้อมส่วนหัวรับรองตัวตน',
        reqs[0].method === 'GET' && reqs[0].headers.Authorization === 'Bearer k');

  check('[models] อ่านรูปแบบ OpenAI (data[].id)',
        JSON.stringify(P.parseModels({ data: [{ id: 'b' }, { id: 'a' }] })) === JSON.stringify(['a', 'b']));
  check('[models] อ่านรูปแบบ Ollama (models[].name)',
        JSON.stringify(P.parseModels({ models: [{ name: 'llama3' }] })) === JSON.stringify(['llama3']));
  check('[models] อ่านอาร์เรย์สตริงล้วน',
        JSON.stringify(P.parseModels(['z', 'y'])) === JSON.stringify(['y', 'z']));
  check('[models] ตัดชื่อซ้ำทิ้ง', P.parseModels({ data: [{ id: 'a' }, { id: 'a' }] }).length === 1);
  check('[models] คำตอบพัง → คืนอาร์เรย์ว่าง ไม่โยน error',
        JSON.stringify(P.parseModels(null)) === '[]' && JSON.stringify(P.parseModels({ oops: 1 })) === '[]');
}

// ══════════════════ 6) คำขอแชท: ค่าที่ว่างต้องไม่ถูกส่ง ══════════════════
{
  const p = P.newProvider({ name: 'x', model: 'gpt-x',
    credential: { name: 'c', apiKey: 'k', baseUrl: 'https://api.openai.com/v1' },
    params: { temperature: 0.3, maxTokens: 100, topP: null, topK: null,
              frequencyPenalty: null, presencePenalty: null, reasoningEffort: '',
              responseFormat: 'text', customHeaders: { 'X-Trace': 'abc' } } });
  const r = P.chatRequest(p, { messages: [{ role: 'user', content: 'สวัสดี' }], system: 'ระบบ' });
  check('[chat] URL ต่อ /chat/completions ให้เมื่อ base ลงท้าย /v1',
        r.url === 'https://api.openai.com/v1/chat/completions', r.url);
  check('[chat] system ถูกยัดเป็นข้อความแรก',
        r.body.messages[0].role === 'system' && r.body.messages[1].content === 'สวัสดี');
  check('[chat] ค่าที่ตั้งไว้ถูกส่ง', r.body.temperature === 0.3 && r.body.max_tokens === 100);
  check('[chat] ค่าที่ปล่อยว่างไม่ถูกส่งเลย (กันเซิร์ฟเวอร์ตอบ 400)',
        !('top_p' in r.body) && !('top_k' in r.body) && !('frequency_penalty' in r.body) &&
        !('presence_penalty' in r.body) && !('reasoning_effort' in r.body),
        JSON.stringify(Object.keys(r.body)));
  check('[chat] response_format = text ไม่ต้องส่ง', !('response_format' in r.body));
  check('[chat] Custom Headers ถูกผสมเข้าไป', r.headers['X-Trace'] === 'abc');
  check('[chat] Custom Headers ทับ Content-Type ไม่ได้', r.headers['Content-Type'] === 'application/json');
  check('[chat] timeout/maxRetries ติดมากับคำขอ', r.timeoutMs === 60000 && r.maxRetries === 2);

  const j = P.chatRequest(P.newProvider({ params: { responseFormat: 'json_object' },
    credential: { baseUrl: 'https://a.com' } }), {});
  check('[chat] json_object ส่ง response_format ให้', j.body.response_format.type === 'json_object');
  check('[chat] base ที่ไม่มี /v1 ต่อ /v1/chat/completions ให้',
        j.url === 'https://a.com/v1/chat/completions', j.url);
  const t = P.chatRequest(P.newProvider({ params: { thinkingMode: 'on' },
    credential: { baseUrl: 'https://a.com' } }), {});
  check('[chat] thinking mode = on ส่ง thinking.enabled', t.body.thinking.type === 'enabled');

  // อ่านคำตอบ
  const oa = P.parseChat({ choices: [{ message: { content: 'ตอบ' } }],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14,
             completion_tokens_details: { reasoning_tokens: 2 },
             prompt_tokens_details: { cached_tokens: 6 } } });
  check('[chat] อ่านคำตอบ OpenAI ได้ครบ ทั้งข้อความและ token',
        oa.text === 'ตอบ' && oa.usage.input === 10 && oa.usage.output === 4 &&
        oa.usage.reasoning === 2 && oa.usage.cached === 6 && oa.usage.total === 14,
        JSON.stringify(oa));
  const an = P.parseChat({ content: [{ type: 'text', text: 'ก' }, { type: 'thinking', text: 'ข' }],
    usage: { input_tokens: 3, output_tokens: 1 } });
  check('[chat] อ่านคำตอบสำนวน Anthropic ได้ (เอาเฉพาะ type=text)',
        an.text === 'ก' && an.usage.input === 3 && an.usage.total === 4, JSON.stringify(an));
  check('[chat] คำตอบพังไม่ทำให้ล้ม', P.parseChat(null).text === '' && P.parseChat('x').usage.total === 0);
}

// ══════════════════ 7) ทะเบียน provider ══════════════════
{
  const a = P.newProvider({ name: 'A' }), b = P.newProvider({ name: 'B' });
  let rows = P.upsertProvider([], a);
  rows = P.upsertProvider(rows, b);
  check('[ทะเบียน] เพิ่มได้ 2 ตัว', rows.length === 2);
  const rows2 = P.upsertProvider(rows, { ...a, name: 'A2' });
  check('[ทะเบียน] แก้ตัวเดิมไม่เพิ่มแถวใหม่', rows2.length === 2 && rows2[0].name === 'A2');
  check('[ทะเบียน] ไม่แก้อาร์เรย์เดิมของผู้เรียก', rows[0].name === 'A');
  check('[ทะเบียน] ลบได้', P.removeProvider(rows2, a.id).length === 1);
  check('[ทะเบียน] activeProviderId เลือกถูกตัว',
        P.activeProvider({ providers: rows2, activeProviderId: b.id }).name === 'B');
  check('[ทะเบียน] ไม่มี activeProviderId → ใช้ตัวแรก',
        P.activeProvider({ providers: rows2 }).name === 'A2');
  check('[ทะเบียน] ยังไม่มีผู้ให้บริการเลย → null', P.activeProvider({}) === null);
  check('[ทะเบียน] แถวเสีย (null) ถูกกรองทิ้ง', P.listProviders({ providers: [null, a] }).length === 1);
}

// ══════════════════ 8) เซสชันแชท ══════════════════
{
  // [alpha.63r4] เพิ่มโหมดที่สาม: ปลดล็อกเต็มที่ (สั่งลบได้)
  check('[เซสชัน] มี 3 โหมด: วางแผน(อ่านอย่างเดียว) · ช่วยเขียน(สร้าง/แก้) · ปลดล็อกเต็มที่',
        S.CHAT_MODES.length === 3 && S.modeDef('plan').write === false
        && S.modeDef('write').write === true && S.modeDef('agent').write === true);
  check('[เซสชัน] สิทธิ์ของแต่ละโหมดไล่ระดับถูก',
        S.modeCap('plan') === 'read' && S.modeCap('write') === 'write' && S.modeCap('agent') === 'full');
  check('[เซสชัน] โหมดที่ไม่รู้จักตกกลับโหมดแรก', S.modeDef('มั่ว').id === 'plan');
  check('[เซสชัน] ระดับการเข้าถึงครบ project/book/chapter/scene',
        ['project', 'book', 'chapter', 'scene'].every((id) => S.SCOPES.some((s) => s.id === id)));

  // ปุ่มส่ง
  const ev = (k, shift) => ({ key: k, shiftKey: shift });
  check('[ปุ่มส่ง] ค่าเริ่มต้น Enter = ส่ง', S.isSendKey(ev('Enter', false), 'enter') === true);
  check('[ปุ่มส่ง] ค่าเริ่มต้น Shift+Enter = ไม่ส่ง', S.isSendKey(ev('Enter', true), 'enter') === false);
  check('[ปุ่มส่ง] สลับเป็น shift-enter แล้วกลับด้านถูก',
        S.isSendKey(ev('Enter', true), 'shift-enter') === true &&
        S.isSendKey(ev('Enter', false), 'shift-enter') === false);
  check('[ปุ่มส่ง] ระหว่างเรียบเรียงภาษา (IME) ไม่ส่ง',
        S.isSendKey({ key: 'Enter', shiftKey: false, isComposing: true }, 'enter') === false);
  check('[ปุ่มส่ง] Ctrl+Enter ไม่นับเป็นส่ง (สงวนให้ขึ้นหน้าใหม่)',
        S.isSendKey({ key: 'Enter', ctrlKey: true }, 'enter') === false);

  // ชื่ออัตโนมัติจากข้อความแรก
  let s = S.newSession();
  check('[เซสชัน] เริ่มต้นชื่อ "เซสชันใหม่" และไม่มีข้อความ', s.title === 'เซสชันใหม่' && s.messages.length === 0);
  s = S.addMessage(s, S.newMessage('user', 'ช่วยคิดชื่อบทที่ 3 ให้หน่อย'));
  check('[เซสชัน] ชื่อเซสชันตั้งจากข้อความแรกของผู้ใช้', s.title === 'ช่วยคิดชื่อบทที่ 3 ให้หน่อย', s.title);
  s = S.addMessage(s, S.newMessage('user', 'ข้อความที่สอง'));
  check('[เซสชัน] ข้อความที่สองไม่เปลี่ยนชื่ออีก', s.title === 'ช่วยคิดชื่อบทที่ 3 ให้หน่อย');
  const r = S.renameSession(s, 'ชื่อที่ตั้งเอง');
  check('[เซสชัน] เปลี่ยนชื่อเองแล้วล็อกไว้', r.title === 'ชื่อที่ตั้งเอง' && r.titleSet === true);
  check('[เซสชัน] เปลี่ยนชื่อเป็นค่าว่าง = ไม่เปลี่ยน', S.renameSession(r, '   ').title === 'ชื่อที่ตั้งเอง');
  check('[เซสชัน] addMessage ไม่แก้เซสชันเดิม (immutable)', s.messages.length === 2);
  check('[เซสชัน] ชื่อยาวถูกตัดพร้อม …', S.titleFromText('ก'.repeat(80)).endsWith('…'));

  // [alpha.62 บั๊ก 3] เริ่มใหม่ — ล้างบทสนทนาแต่เก็บเซสชัน/ค่าตั้งไว้
  const restartSrc = S.newSession({ mode: 'write', scope: 'book', model: 'gpt-x', providerId: 'p1',
                                    files: [{ path: '/a.md', name: 'a.md' }], contextLimit: 8192 });
  let rs = S.addMessage(restartSrc, S.newMessage('user', 'คำถามแรกของรอบเก่า'));
  rs = S.addMessage(rs, S.newMessage('assistant', 'คำตอบ'));
  const cleared = S.clearMessages(rs);
  check('[เริ่มใหม่] ล้างข้อความหมด', cleared.messages.length === 0);
  check('[เริ่มใหม่] เก็บ id เดิม (ไฟล์เดิม ไม่ใช่เซสชันใหม่)', cleared.id === rs.id);
  check('[เริ่มใหม่] เก็บโหมด/ระดับการเข้าถึง/โมเดล/ผู้ให้บริการ',
        cleared.mode === 'write' && cleared.scope === 'book' &&
        cleared.model === 'gpt-x' && cleared.providerId === 'p1');
  check('[เริ่มใหม่] เก็บไฟล์แนบไว้', (cleared.files || []).length === 1);
  check('[เริ่มใหม่] ล้าง contextLimit ที่เดาไว้จากรอบก่อน', cleared.contextLimit === 0);
  check('[เริ่มใหม่] ชื่ออัตโนมัติกลับเป็นค่าเริ่มต้น', cleared.title === 'เซสชันใหม่', cleared.title);
  check('[เริ่มใหม่] ชื่อที่ผู้ใช้ตั้งเองไม่ถูกล้าง',
        S.clearMessages(S.renameSession(rs, 'บทที่ 3')).title === 'บทที่ 3');
  check('[เริ่มใหม่] ไม่แก้เซสชันเดิม (immutable)', rs.messages.length === 2);

  // สถิติ
  const u = (i, o, extra = {}) => ({ input: i, output: o, total: i + o, ...extra });
  let st = S.newSession({ contextLimit: 1000 });
  st = S.addMessage(st, S.newMessage('user', 'ถาม'));
  st = S.addMessage(st, S.newMessage('assistant', 'ตอบ', { usage: u(100, 50, { reasoning: 10, cached: 20 }) }));
  st = S.addMessage(st, S.newMessage('user', 'ถามอีก'));
  st = S.addMessage(st, S.newMessage('assistant', 'ตอบอีก', { usage: u(200, 60) }));
  const stats = S.sessionStats(st);
  check('[สถิติ] นับข้อความผู้ใช้/ผู้ช่วยแยกกัน', stats.userMsgs === 2 && stats.agentMsgs === 2);
  check('[สถิติ] รวม token นำเข้า/ส่งออก/เหตุผล/แคช',
        stats.input === 300 && stats.output === 110 && stats.reasoning === 10 && stats.cached === 20,
        JSON.stringify(stats));
  check('[สถิติ] บริบท = คำขอครั้งล่าสุด ไม่ใช่ยอดสะสม', stats.context === 260, stats.context);
  check('[สถิติ] เปอร์เซ็นต์คิดจากขีดจำกัดของโมเดล', stats.percent === 26, stats.percent);
  check('[สถิติ] ไม่รู้ขีดจำกัด → 0% (ไม่หารด้วยศูนย์)',
        S.sessionStats(S.newSession()).percent === 0);
  const cost = S.sessionStats(st, { prices: { in: 3, out: 15 } });
  check('[สถิติ] ต้นทุน USD คิดจากราคาต่อ 1M tokens',
        Math.abs(cost.usd - ((300 * 3 + 110 * 15) / 1e6)) < 1e-9, cost.usd);
  check('[สถิติ] ป้ายบริบทอ่านออก', S.contextLabel(stats) === '260 / 1k', S.contextLabel(stats));
  check('[สถิติ] ป้ายบริบทเมื่อไม่รู้ขีดจำกัด = ตัวเลขเปล่า',
        S.contextLabel({ context: 1500, limit: 0 }) === '1.5k');
  check('[สถิติ] ย่อตัวเลข', S.compact(999) === '999' && S.compact(2500000) === '2.5M');
  check('[สถิติ] แสดงเงินละเอียดพอเมื่อยอดน้อย', S.usd(0.0123) === '$0.0123' && S.usd(12.5) === '$12.50');

  // ค้นหา / เรียง
  const rows = [
    S.newSession({ id: 'a', title: 'บทที่หนึ่ง', updated: '2026-01-01T00:00:00Z' }),
    S.newSession({ id: 'b', title: 'อื่น ๆ', updated: '2026-03-01T00:00:00Z',
                   messages: [S.newMessage('user', 'พูดถึงมังกร')] }),
    S.newSession({ id: 'c', title: 'เก็บแล้ว', archived: true, updated: '2026-05-01T00:00:00Z' }),
  ];
  check('[ค้นหา] เรียงใหม่สุดก่อน และซ่อนอันที่จัดเก็บ',
        S.searchSessions(rows, '').map((s) => s.id).join() === 'b,a',
        S.searchSessions(rows, '').map((s) => s.id).join());
  check('[ค้นหา] ค้นจากชื่อได้', S.searchSessions(rows, 'หนึ่ง').map((s) => s.id).join() === 'a');
  check('[ค้นหา] ค้นจากเนื้อความในเซสชันได้', S.searchSessions(rows, 'มังกร').map((s) => s.id).join() === 'b');
  check('[ค้นหา] เปิดสวิตช์แล้วเห็นอันที่จัดเก็บด้วย',
        S.searchSessions(rows, 'เก็บ', { includeArchived: true }).length === 1);
  check('[ค้นหา] ไม่เจอ → อาร์เรย์ว่าง', S.searchSessions(rows, 'zzzz').length === 0);
  check('[จัดเก็บ] archiveSession สลับสถานะได้', S.archiveSession(rows[0]).archived === true &&
        S.archiveSession(rows[2], false).archived === false);

  // ประวัติที่ส่งให้โมเดล
  let big = S.newSession();
  for (let i = 0; i < 50; i++) big = S.addMessage(big, S.newMessage(i % 2 ? 'assistant' : 'user', 'ข'.repeat(300)));
  const trimmed = S.chatMessages(big, { maxTokens: 500 });
  check('[ประวัติ] ตัดประวัติเก่าทิ้งเมื่อเกินงบ', trimmed.length < 50 && trimmed.length > 0, trimmed.length);
  check('[ประวัติ] เก็บข้อความล่าสุดไว้เสมอ',
        trimmed[trimmed.length - 1].content === big.messages[big.messages.length - 1].text);
  check('[ประวัติ] อย่างน้อย 1 ข้อความเสมอ แม้งบไม่พอ',
        S.chatMessages(big, { maxTokens: 1 }).length === 1);

  // ไฟล์ + ส่งออก
  check('[ไฟล์] ชื่อไฟล์เซสชันเป็น <id>.json', S.sessionFileName({ id: 'abc' }) === 'abc.json');
  check('[ดิบ] rawJson อ่านกลับเป็น object เดิมได้', JSON.parse(S.rawJson(st)).id === st.id);
  const md = S.shareMarkdown(st);
  check('[แชร์] Markdown มีทั้งหัวข้อและบทสนทนา',
        md.startsWith('# ') && md.includes('**คุณ:**') && md.includes('**ผู้ช่วย:**'), md.slice(0, 40));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
