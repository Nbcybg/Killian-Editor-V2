// ai-providers.js — [alpha.61 ข้อ 2] ทะเบียน "ผู้ให้บริการ AI ที่ผู้ใช้สร้างเอง"
//
// เดิมผู้ให้บริการเป็นรายการสำเร็จรูป (OpenAI/Claude/Ollama/…) แก้อะไรไม่ได้เลย
// ตอนนี้ผู้ใช้กด "เพิ่มผู้ให้บริการ" แล้วกรอกเองครบ 4 ส่วน:
//   1) ชื่อ            — ตั้งเอง
//   2) Credential      — ชื่อ · API key · base url · Allowed HTTP Request Domains · ทดสอบ · บันทึก
//   3) Model           — ดึงรายชื่อจาก API ของเจ้านั้นมาให้เลือกใน dropdown
//   4) Parameters      — Thinking mode · Frequency/Presence Penalty · Max Retries · Max Tokens ·
//                        Reasoning Effort · Response Format · Temperature · Timeout · Top K/P · Custom Headers
//
// ไฟล์นี้เป็น **โมดูลบริสุทธิ์**: ไม่แตะ DOM / fs / network เลย — คืนแต่ "คำอธิบายคำขอ"
// ({url, headers, body}) ให้ชั้น UI เอาไปยิงผ่าน kapi.httpFetch เอง → unit test ได้ตรง ๆ
//
// ที่เก็บ (แยกความลับออกจากไฟล์ที่แชร์กัน — หลักเดิมของ ai-settings.js):
//   project.khn.json → ai.providers[]  = ทุกอย่าง **ยกเว้น** apiKey
//   <root>/ai-key.json → keys[id]      = apiKey ของแต่ละ credential

// ────────────────────────────────────────────────────────────────
// 1) พารามิเตอร์ที่ผู้ใช้ตั้งได้ (ลำดับตามที่ผู้ใช้สั่ง — UI วาดตามอาร์เรย์นี้ตรง ๆ)
// ────────────────────────────────────────────────────────────────
export const PARAM_DEFS = [
  { key: 'thinkingMode', label: 'Thinking mode', th: 'โหมดคิดก่อนตอบ', type: 'select',
    options: ['off', 'auto', 'on'], def: 'off',
    hint: 'on = สั่งให้โมเดลคิดเป็นขั้นก่อนตอบ (ใช้ได้เฉพาะโมเดลที่รองรับ)' },
  { key: 'frequencyPenalty', label: 'Frequency Penalty', th: 'ลดการใช้คำซ้ำ', type: 'number',
    min: -2, max: 2, step: 0.1, def: null },
  { key: 'maxRetries', label: 'Max Retries', th: 'ลองใหม่สูงสุด (ครั้ง)', type: 'int',
    min: 0, max: 10, def: 2 },
  { key: 'maxTokens', label: 'Maximum Number of Tokens', th: 'ความยาวคำตอบสูงสุด', type: 'int',
    min: 1, max: 200000, def: 2048 },
  { key: 'presencePenalty', label: 'Presence Penalty', th: 'ดันให้พูดเรื่องใหม่', type: 'number',
    min: -2, max: 2, step: 0.1, def: null },
  { key: 'reasoningEffort', label: 'Reasoning Effort', th: 'ระดับการใช้เหตุผล', type: 'select',
    options: ['', 'minimal', 'low', 'medium', 'high'], def: '' },
  { key: 'responseFormat', label: 'Response Format', th: 'รูปแบบคำตอบ', type: 'select',
    options: ['text', 'json_object'], def: 'text' },
  { key: 'temperature', label: 'Sampling Temperature', th: 'ความสร้างสรรค์', type: 'number',
    min: 0, max: 2, step: 0.05, def: 0.7 },
  { key: 'timeout', label: 'Timeout', th: 'หมดเวลารอ (วินาที)', type: 'int',
    min: 1, max: 600, def: 60 },
  { key: 'topK', label: 'Top K', th: 'Top K', type: 'int', min: 0, max: 500, def: null },
  { key: 'topP', label: 'Top P', th: 'Top P', type: 'number', min: 0, max: 1, step: 0.05, def: null },
  { key: 'customHeaders', label: 'Custom Headers', th: 'ส่วนหัว HTTP เพิ่มเติม', type: 'kv', def: {} },
];
export const PARAM_KEYS = PARAM_DEFS.map((p) => p.key);
const PARAM_BY_KEY = Object.fromEntries(PARAM_DEFS.map((p) => [p.key, p]));

/** ค่าเริ่มต้นของพารามิเตอร์ทั้งชุด (คัดลอกใหม่เสมอ — customHeaders เป็น object) */
export function defaultParams() {
  const out = {};
  for (const p of PARAM_DEFS) out[p.key] = p.type === 'kv' ? {} : p.def;
  return out;
}

/**
 * ทำค่าที่ผู้ใช้กรอกให้อยู่ในช่วงที่ถูกต้อง — ค่าที่ว่าง/ผิดชนิด = null (ไม่ส่งไปเลย)
 * กฎ 20: ต้องแยก "ไม่ได้ตั้ง" (null) ออกจาก "ตั้งเป็น 0 จริง ๆ" ให้ชัด
 */
export function normalizeParams(raw = {}) {
  const out = {};
  for (const p of PARAM_DEFS) {
    const v = raw[p.key];
    if (p.type === 'kv') {
      const o = {};
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k, val] of Object.entries(v)) {
          const name = String(k).trim();
          if (name) o[name] = String(val ?? '');
        }
      }
      out[p.key] = o;
    } else if (p.type === 'select') {
      out[p.key] = p.options.includes(v) ? v : p.def;
    } else {
      const n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : Number(v);
      if (v === null || v === undefined || !Number.isFinite(n)) { out[p.key] = p.def; continue; }
      const clamped = Math.min(p.max, Math.max(p.min, n));
      out[p.key] = p.type === 'int' ? Math.round(clamped) : +clamped.toFixed(4);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// 2) Allowed HTTP Request Domains — ประตูด่านแรกก่อนยิงคำขอใด ๆ
// ────────────────────────────────────────────────────────────────
/** โฮสต์ของ URL (คืน '' เมื่อ URL ใช้ไม่ได้) */
export function hostOf(url) {
  try { return new URL(String(url)).hostname.toLowerCase(); } catch { return ''; }
}
/** "a.com, *.b.com" → ['a.com','*.b.com'] (ตัดช่องว่าง/บรรทัดว่างทิ้ง) */
export function parseDomains(text) {
  return String(text || '').split(/[\s,;]+/).map((s) => s.trim().toLowerCase())
    .filter(Boolean).map((s) => s.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
}
/**
 * URL นี้ยิงได้ไหม — รายการว่าง = **ไม่จำกัด** (ผู้ใช้ยังไม่ได้ตั้งกำแพง)
 * รองรับไวลด์การ์ดชั้นเดียวขึ้นไป: `*.example.com` ครอบ `api.example.com` และ `a.b.example.com`
 * แต่ไม่ครอบ `example.com` เปล่า ๆ (ต้องใส่เพิ่มเอง — ชัดเจนกว่าเดา)
 */
export function isDomainAllowed(url, domains) {
  const list = Array.isArray(domains) ? domains : parseDomains(domains);
  if (!list.length) return true;
  const h = hostOf(url);
  if (!h) return false;
  return list.some((d) => (d.startsWith('*.') ? h.endsWith(d.slice(1)) && h !== d.slice(2) : h === d));
}

// ────────────────────────────────────────────────────────────────
// 3) โครงข้อมูล provider / credential
// ────────────────────────────────────────────────────────────────
let _seq = 0;
export function newId(prefix = 'p') {
  _seq++;
  return prefix + '-' + Date.now().toString(36) + '-' + _seq.toString(36);
}

/** credential เปล่า ๆ (apiKey เก็บแยกไฟล์ — ที่นี่มีไว้ให้ UI ถือชั่วคราวเท่านั้น) */
export function newCredential(patch = {}) {
  return { id: patch.id || newId('cred'), name: '', apiKey: '', baseUrl: '',
           allowedDomains: [], ...patch };
}
/**
 * ผู้ให้บริการเปล่า ๆ พร้อมพารามิเตอร์ค่าเริ่มต้นครบชุด
 * ใช้เป็น "ตัวทำความสะอาด" ด้วย: อ่านของเก่าจากไฟล์แล้วส่งผ่านตัวนี้ ได้ฟิลด์ครบเสมอ
 */
export function newProvider(patch = {}) {
  const { credential, params, ...rest } = patch || {};
  return {
    id: (patch && patch.id) || newId('prov'),
    name: '', model: '', models: [],
    ...rest,
    credential: newCredential(credential || {}),
    params: normalizeParams({ ...defaultParams(), ...(params || {}) }),
  };
}

/** ตรวจก่อนบันทึก — คืนรายการปัญหาเป็นข้อความไทย (ว่าง = ผ่าน) */
export function validateProvider(p) {
  const errs = [];
  if (!p || !String(p.name || '').trim()) errs.push('ยังไม่ได้ตั้งชื่อผู้ให้บริการ');
  const c = (p && p.credential) || {};
  if (!String(c.name || '').trim()) errs.push('ยังไม่ได้ตั้งชื่อ Credential');
  if (!String(c.baseUrl || '').trim()) errs.push('ยังไม่ได้ใส่ Base URL');
  else if (!/^https?:\/\//i.test(String(c.baseUrl).trim())) errs.push('Base URL ต้องขึ้นต้นด้วย http:// หรือ https://');
  else if (!isDomainAllowed(c.baseUrl, c.allowedDomains))
    errs.push('Base URL ไม่อยู่ในรายการ Allowed HTTP Request Domains');
  return errs;
}

/** ตัดความลับออกก่อนเก็บลง project.khn.json (ไฟล์ที่ตั้งใจให้ก๊อป/แชร์) */
export function stripSecrets(p) {
  if (!p) return p;
  const { credential = {}, ...rest } = p;
  const { apiKey, ...cred } = credential;
  return { ...rest, credential: cred };
}
/** ใส่คีย์กลับเข้า provider (อ่านจาก ai-key.json → keys[credential.id]) */
export function withSecrets(p, keys = {}) {
  if (!p) return p;
  const cid = (p.credential || {}).id;
  return { ...p, credential: { ...(p.credential || {}), apiKey: keys[cid] || '' } };
}

// ────────────────────────────────────────────────────────────────
// 4) สร้างคำขอ HTTP (โมดูลนี้ไม่ยิงเอง — คืนคำอธิบายให้ชั้น UI ยิง)
// ────────────────────────────────────────────────────────────────
const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

/** ส่วนหัวมาตรฐาน + Custom Headers ที่ผู้ใช้ใส่เอง (ของผู้ใช้ทับได้ ยกเว้น Content-Type) */
export function buildHeaders(provider) {
  const c = (provider && provider.credential) || {};
  const key = String(c.apiKey || '').trim();
  const h = { 'Content-Type': 'application/json' };
  if (key) {
    h.Authorization = 'Bearer ' + key;
    // เจ้าที่ใช้ x-api-key (Anthropic) ก็ยิงชุดเดียวกันได้ — เซิร์ฟเวอร์ที่ไม่รู้จักจะเมินหัวที่เกิน
    h['x-api-key'] = key;
    h['anthropic-version'] = '2023-06-01';
  }
  const custom = ((provider && provider.params) || {}).customHeaders || {};
  for (const [k, v] of Object.entries(custom)) {
    if (!k || /^content-type$/i.test(k)) continue;
    h[k] = String(v);
  }
  return h;
}

/**
 * คำขอ "ขอรายชื่อโมเดล" — คืนได้หลายตัวเลือกเพราะแต่ละเจ้าใช้เส้นทางต่างกัน
 * ชั้น UI ลองไล่ตามลำดับจนกว่าจะได้ผล (OpenAI-compatible ก่อน แล้วค่อย Ollama)
 */
export function modelsRequests(provider) {
  const base = trimSlash((provider && provider.credential && provider.credential.baseUrl) || '');
  if (!base) return [];
  const headers = buildHeaders(provider);
  const paths = ['/models', '/v1/models', '/api/tags'];
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    // base ที่ลงท้าย /v1 อยู่แล้ว ไม่ต้องต่อ /v1 ซ้ำ
    if (p === '/v1/models' && /\/v1$/i.test(base)) continue;
    const url = base + p;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, method: 'GET', headers });
  }
  return out;
}

/** อ่านรายชื่อโมเดลจากคำตอบรูปแบบไหนก็ได้ (OpenAI `data[].id` · Ollama `models[].name` · อาร์เรย์ล้วน) */
export function parseModels(json) {
  const rows = !json ? []
    : Array.isArray(json) ? json
    : Array.isArray(json.data) ? json.data
    : Array.isArray(json.models) ? json.models
    : [];
  const out = [];
  for (const r of rows) {
    const id = typeof r === 'string' ? r : (r && (r.id || r.name || r.model));
    if (id && !out.includes(String(id))) out.push(String(id));
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * คำขอ "คุยกับโมเดล" — รูปแบบ OpenAI chat/completions (มาตรฐานที่เจ้าอื่นทำตามกันหมด)
 * พารามิเตอร์ที่ผู้ใช้ปล่อยว่าง (null) จะ **ไม่ถูกส่ง** เพื่อไม่ให้เซิร์ฟเวอร์ที่ไม่รองรับตอบ 400
 */
export function chatRequest(provider, { messages = [], system = '', stream = false, model } = {}) {
  const base = trimSlash((provider && provider.credential && provider.credential.baseUrl) || '');
  const pr = normalizeParams((provider && provider.params) || {});
  const url = /\/chat\/completions$/i.test(base) ? base
            : /\/v1$/i.test(base) ? base + '/chat/completions'
            : base + '/v1/chat/completions';
  const body = {
    model: model || (provider && provider.model) || '',
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
  };
  if (stream) body.stream = true;
  const put = (k, v) => { if (v !== null && v !== undefined && v !== '') body[k] = v; };
  put('temperature', pr.temperature);
  put('max_tokens', pr.maxTokens);
  put('frequency_penalty', pr.frequencyPenalty);
  put('presence_penalty', pr.presencePenalty);
  put('top_p', pr.topP);
  put('top_k', pr.topK);
  put('reasoning_effort', pr.reasoningEffort);
  if (pr.responseFormat && pr.responseFormat !== 'text') body.response_format = { type: pr.responseFormat };
  // Thinking mode — ส่งทั้งสองสำนวนที่ใช้กันจริง เจ้าที่ไม่รู้จักจะเมินฟิลด์ที่เกิน
  if (pr.thinkingMode === 'on') body.thinking = { type: 'enabled' };
  else if (pr.thinkingMode === 'off' && pr.reasoningEffort) body.thinking = { type: 'disabled' };
  return { url, method: 'POST', headers: buildHeaders(provider), body,
           timeoutMs: (pr.timeout || 60) * 1000, maxRetries: pr.maxRetries ?? 2 };
}

/** อ่านข้อความ + การใช้ token จากคำตอบ (รองรับทั้งสำนวน OpenAI และ Anthropic) */
export function parseChat(json) {
  if (!json || typeof json !== 'object') return { text: '', usage: emptyUsage() };
  const ch = json.choices && json.choices[0];
  let text = (ch && ch.message && ch.message.content) || '';
  if (!text && Array.isArray(json.content)) {
    text = json.content.filter((c) => c && c.type === 'text').map((c) => c.text).join('');
  }
  if (!text && json.message && typeof json.message.content === 'string') text = json.message.content;
  if (!text && typeof json.response === 'string') text = json.response;
  const u = json.usage || {};
  const input = numOr(u.prompt_tokens, u.input_tokens, u.promptTokens, 0);
  const output = numOr(u.completion_tokens, u.output_tokens, u.completionTokens, 0);
  const reasoning = numOr((u.completion_tokens_details || {}).reasoning_tokens, u.reasoning_tokens, 0);
  const cached = numOr((u.prompt_tokens_details || {}).cached_tokens,
                       u.cache_read_input_tokens, u.cached_tokens, 0);
  const total = numOr(u.total_tokens, input + output);
  return { text: String(text || ''), thinking: parseThinking(json), usage: { input, output, reasoning, cached, total } };
}

/**
 * ข้อความ "ความคิด" ของโมเดล — แต่ละเจ้าวางไว้คนละที่ ลองทุกสำนวนที่ใช้กันจริง
 * DeepSeek/Qwen: choices[0].message.reasoning_content · OpenRouter: .reasoning
 * Anthropic: content[] ที่ type === 'thinking' · Ollama: message.thinking
 */
export function parseThinking(json) {
  if (!json || typeof json !== 'object') return '';
  const msg = (json.choices && json.choices[0] && json.choices[0].message) || json.message || {};
  const direct = msg.reasoning_content || msg.reasoning || msg.thinking;
  if (typeof direct === 'string' && direct.trim()) return direct;
  if (Array.isArray(json.content)) {
    const th = json.content.filter((c) => c && (c.type === 'thinking' || c.type === 'redacted_thinking'))
      .map((c) => c.thinking || c.text || '').join('\n').trim();
    if (th) return th;
  }
  return '';
}
function emptyUsage() { return { input: 0, output: 0, reasoning: 0, cached: 0, total: 0 }; }
function numOr(...vals) {
  for (const v of vals) if (typeof v === 'number' && isFinite(v)) return v;
  return 0;
}

// ────────────────────────────────────────────────────────────────
// 5) ทะเบียนผู้ให้บริการทั้งหมด (เก็บใน meta.ai)
// ────────────────────────────────────────────────────────────────
/** อ่านรายการ provider จาก meta.ai (ทำความสะอาดให้ครบทุกฟิลด์) */
export function listProviders(ai = {}) {
  const rows = Array.isArray(ai.providers) ? ai.providers : [];
  return rows.filter(Boolean).map((p) => newProvider(p));
}
/** provider ที่เลือกใช้อยู่ (ไม่มี = ตัวแรก · ไม่มีเลย = null) */
export function activeProvider(ai = {}) {
  const rows = listProviders(ai);
  if (!rows.length) return null;
  return rows.find((p) => p.id === ai.activeProviderId) || rows[0];
}
/** เพิ่ม/แทนที่ provider แล้วคืนอาร์เรย์ใหม่ (ไม่แก้ของเดิม) */
export function upsertProvider(rows, provider) {
  const list = (rows || []).slice();
  const i = list.findIndex((p) => p.id === provider.id);
  if (i === -1) list.push(provider); else list[i] = provider;
  return list;
}
export function removeProvider(rows, id) {
  return (rows || []).filter((p) => p.id !== id);
}
