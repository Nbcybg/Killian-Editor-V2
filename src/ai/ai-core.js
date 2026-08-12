// ai-core.js — แกนกลางของทุกฟีเจอร์ AI (ข้อ 72)
// provider adapter · ความปลอดภัยของคีย์ · rate limit · นับต้นทุน · RAG (chunk/embed/vector/retrieve)
// pure logic: ไม่แตะ DOM/fs/network เอง — ฉีด { http, io, now, sleep } เข้ามาทั้งหมด
// spec: docs/72-ai-core.md
import { T } from '../i18n.js';
import { tokenizeQuery } from '../search-engine.js';   // ตัดคำไทยตัวเดียวกับระบบค้นหา (คืนสตริงคำ)

// ────────────────────────────────────────────────────────────────
// 1) Provider adapters — เพิ่มเจ้าใหม่ = เพิ่ม entry เดียวที่นี่
// ────────────────────────────────────────────────────────────────
export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    needsKey: true,
    defaultModel: 'gpt-4o-mini',
    defaultEmbedModel: 'text-embedding-3-small',
    chat({ baseUrl, apiKey, model, system, messages, temperature, maxTokens, stream }) {
      return {
        url: (baseUrl || 'https://api.openai.com') + '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: {
          model, temperature, max_tokens: maxTokens, stream: !!stream,
          messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        },
      };
    },
    embed({ baseUrl, apiKey, model, texts }) {
      return {
        url: (baseUrl || 'https://api.openai.com') + '/v1/embeddings',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: { model, input: texts },
      };
    },
    parse(d) {
      const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      const u = d.usage || {};
      return { text, usage: usageOf(u.prompt_tokens, u.completion_tokens, u.total_tokens, text) };
    },
    parseEmbed(d) { return (d.data || []).map((r) => r.embedding); },
    chunk(line) {                                   // SSE ของ OpenAI: "data: {json}" / "data: [DONE]"
      if (!line.startsWith('data:')) return null;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return { done: true };
      const d = safeJson(payload);
      const t = d && d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content;
      return t ? { text: t } : null;
    },
  },

  claude: {
    label: 'Claude (Anthropic)',
    needsKey: true,
    defaultModel: 'claude-sonnet-4-5',
    defaultEmbedModel: null,                        // ไม่มี embeddings API → ตกไปใช้ local
    chat({ baseUrl, apiKey, model, system, messages, temperature, maxTokens, stream }) {
      return {
        url: (baseUrl || 'https://api.anthropic.com') + '/v1/messages',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: { model, max_tokens: maxTokens, temperature, stream: !!stream, system: system || undefined, messages },
      };
    },
    embed: null,
    parse(d) {
      const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      const u = d.usage || {};
      return { text, usage: usageOf(u.input_tokens, u.output_tokens, null, text) };
    },
    chunk(line) {
      if (!line.startsWith('data:')) return null;
      const d = safeJson(line.slice(5).trim());
      if (!d) return null;
      if (d.type === 'message_stop') return { done: true };
      if (d.type === 'content_block_delta' && d.delta && d.delta.text) return { text: d.delta.text };
      return null;
    },
  },

  ollama: {
    label: T`Ollama (เครื่องตัวเอง)`,
    needsKey: false,
    defaultModel: 'llama3',
    defaultEmbedModel: 'nomic-embed-text',
    chat({ baseUrl, model, system, messages, temperature, maxTokens, stream }) {
      return {
        url: (baseUrl || 'http://localhost:11434') + '/api/chat',
        headers: { 'Content-Type': 'application/json' },
        body: {
          model, stream: !!stream, options: { temperature, num_predict: maxTokens },
          messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        },
      };
    },
    embed({ baseUrl, model, texts }) {
      return {
        url: (baseUrl || 'http://localhost:11434') + '/api/embed',
        headers: { 'Content-Type': 'application/json' },
        body: { model, input: texts },
      };
    },
    parse(d) {
      const text = (d.message && d.message.content) || d.response || '';
      return { text, usage: usageOf(d.prompt_eval_count, d.eval_count, null, text) };
    },
    parseEmbed(d) { return d.embeddings || (d.embedding ? [d.embedding] : []); },
    chunk(line) {                                   // ollama สตรีมเป็น JSON บรรทัดละก้อน (ไม่ใช่ SSE)
      const d = safeJson(line.trim());
      if (!d) return null;
      if (d.done) return { done: true };
      const t = (d.message && d.message.content) || d.response || '';
      return t ? { text: t } : null;
    },
  },
};
export const PROVIDER_IDS = Object.keys(PROVIDERS);

// ───────── ระดับความรุนแรงของสิ่งที่ตรวจพบ (ใช้ร่วมกันทุกโมดูลตรวจสอบ) ─────────
// เดิมประกาศซ้ำใน ai-plot.js กับ ai-character.js — แก้ที่หนึ่งแล้วอีกที่ไม่ตาม
export const SEVERITY = { critical: T`ร้ายแรง`, major: T`สำคัญ`, minor: T`เล็กน้อย` };
export const SEV_RANK = { critical: 3, major: 2, minor: 1 };

/** Build an HTTP request for a chat completion. @returns {{url,headers,body}} */
export function buildRequest(provider, opts = {}) {
  const p = PROVIDERS[provider] || PROVIDERS.openai;
  const messages = opts.messages && opts.messages.length
    ? opts.messages
    : [{ role: 'user', content: opts.prompt || '' }];
  return p.chat({
    baseUrl: opts.baseUrl, apiKey: opts.apiKey || '',
    model: opts.model || p.defaultModel, system: opts.system || '',
    messages, temperature: opts.temperature ?? 0.7, maxTokens: opts.maxTokens || 800,
    stream: !!opts.stream,
  });
}
/** Normalize a provider response → { text, usage } */
export function parseResponse(provider, json) {
  const p = PROVIDERS[provider] || PROVIDERS.openai;
  if (!json || typeof json !== 'object') return { text: '', usage: usageOf(0, 0, 0, '') };
  try { return p.parse(json); } catch { return { text: '', usage: usageOf(0, 0, 0, '') }; }
}
/** Parse one line of a streamed response → { text } | { done } | null */
export function parseStreamChunk(provider, line) {
  const p = PROVIDERS[provider] || PROVIDERS.openai;
  if (!line) return null;
  try { return p.chunk(line); } catch { return null; }
}
function usageOf(input, output, total, text) {
  // กฎ 20: `num(output) || …` ทำให้ "output = 0 จริง ๆ" (คำตอบว่าง/ถูกตัด) หลุดไปประมาณจากข้อความ
  // → ต้องแยก "ไม่มีค่ามา" ออกจาก "ค่ามาเป็น 0" ให้ชัด
  const i = num(input);
  const o = isNum(output) ? output : (text ? estimateTokens(text) : 0);
  return { input: i, output: o, total: isNum(total) ? total : i + o };
}
const isNum = (v) => typeof v === 'number' && isFinite(v);
const num = (v) => (isNum(v) ? v : 0);
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

// ────────────────────────────────────────────────────────────────
// 2) นับ token + ต้นทุน
// ────────────────────────────────────────────────────────────────
// ประมาณการ: ไทยกินตัวอักษรต่อ token น้อยกว่าอังกฤษ (~3 vs ~4) — พอสำหรับคุมงบ ไม่ต้องแม่นระดับ tokenizer จริง
export function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  const thai = (s.match(/[฀-๿]/g) || []).length;
  const other = s.length - thai;
  return Math.max(1, Math.ceil(thai / 3 + other / 4));
}
// ราคา USD ต่อ 1M tokens (อัปเดตเองได้ — ไม่มีผลกับตรรกะ)
export const PRICES = {
  openai: {
    'gpt-4o-mini': { in: 0.15, out: 0.6 },
    'gpt-4o': { in: 2.5, out: 10 },
    'text-embedding-3-small': { in: 0.02, out: 0 },
    default: { in: 0.15, out: 0.6 },
  },
  claude: {
    'claude-sonnet-4-5': { in: 3, out: 15 },
    'claude-haiku-4-5': { in: 1, out: 5 },
    default: { in: 3, out: 15 },
  },
  ollama: { default: { in: 0, out: 0 } },           // รันเครื่องตัวเอง = ฟรี
};
export function estimateCost(provider, model, usage = {}) {
  const table = PRICES[provider] || PRICES.openai;
  const p = table[model] || table.default;
  const inTok = num(usage.input), outTok = num(usage.output);
  return { usd: +(((inTok * p.in) + (outTok * p.out)) / 1e6).toFixed(6), in: inTok, out: outTok };
}
/** Records every call into meta.ai.usage[] (same row shape as the old ai-settings.js). */
export class CostTracker {
  constructor({ meta = null, max = 500, now = () => Date.now() } = {}) { this.meta = meta; this.max = max; this.now = now; }
  record({ provider, model, usage, feature }) {
    const cost = estimateCost(provider, model, usage);
    const row = {
      date: new Date(this.now()).toISOString(), tokens: usage.total || usage.input + usage.output,
      in: usage.input, out: usage.output, usd: cost.usd, provider, model, feature: feature || '',
    };
    if (this.meta) {
      this.meta.ai = this.meta.ai || {};
      const list = this.meta.ai.usage || [];
      list.push(row);
      if (list.length > this.max) list.splice(0, list.length - this.max);
      this.meta.ai.usage = list;
    }
    return row;
  }
  rows() { return (this.meta && this.meta.ai && this.meta.ai.usage) || []; }
  summary() {
    return this.rows().reduce((s, r) => ({
      calls: s.calls + 1, tokens: s.tokens + num(r.tokens), usd: +(s.usd + num(r.usd)).toFixed(6),
    }), { calls: 0, tokens: 0, usd: 0 });
  }
  byFeature() {
    const m = {};
    for (const r of this.rows()) {
      const k = r.feature || T`อื่น ๆ`;
      m[k] = m[k] || { calls: 0, tokens: 0, usd: 0 };
      m[k].calls++; m[k].tokens += num(r.tokens); m[k].usd = +(m[k].usd + num(r.usd)).toFixed(6);
    }
    return m;
  }
}

// ────────────────────────────────────────────────────────────────
// 3) ความปลอดภัย: คีย์ + rate limit
// ────────────────────────────────────────────────────────────────
export const KEY_FILE = 'ai-key.json';
/** Show a key without leaking it: 'sk-abcdefghijkl' → 'sk-…ijkl' */
export function mask(key) {
  const s = String(key || '');
  if (!s) return T`(ยังไม่ตั้ง)`;
  if (s.length <= 8) return '…';
  return s.slice(0, 3) + '…' + s.slice(-4);
}
const SECRET_KEYS = ['authorization', 'x-api-key', 'apikey', 'api_key', 'key', 'token'];
/** Strip secrets from anything before it reaches the log. */
export function redact(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SECRET_KEYS.includes(k.toLowerCase()) ? mask(v) : (typeof v === 'object' ? redact(v) : v);
  }
  return out;
}
/** API key lives in <root>/ai-key.json — never inside project.khn.json (that file gets shared). */
export class KeyStore {
  constructor({ io = null, root = '', cache = null } = {}) { this.io = io; this.root = root; this._cache = cache; }
  async get() {
    if (this._cache != null) return this._cache;
    if (!this.io || !this.root) return '';
    try {
      const p = this.io.join(this.root, KEY_FILE);
      if (await this.io.exists(p)) {
        const j = await this.io.readJson(p);
        this._cache = (j && j.apiKey) || '';
        return this._cache;
      }
    } catch { /* อ่านไม่ได้ = ถือว่าไม่มีคีย์ */ }
    this._cache = '';
    return '';
  }
  async set(apiKey) {
    this._cache = apiKey || '';
    if (!this.io || !this.root) return false;
    await this.io.writeFile(this.io.join(this.root, KEY_FILE), JSON.stringify(
      { apiKey: this._cache, note: T`ไฟล์นี้เก็บคีย์ส่วนตัว — อย่าแชร์/อย่าใส่ในซิปที่ส่งต่อ` }, null, 2));
    return true;
  }
  clear() { this._cache = null; }
  async masked() { return mask(await this.get()); }
}

/** Token-bucket limiter: `rpm` calls per minute with at most `concurrent` in flight. */
export class RateLimiter {
  constructor({ rpm = 20, concurrent = 2, now = () => Date.now(), sleep = defaultSleep } = {}) {
    this.rpm = rpm; this.concurrent = concurrent; this.now = now; this.sleep = sleep;
    this.stamps = []; this.active = 0;
  }
  /** ms to wait before the next call is allowed (0 = go now) */
  check() {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => t - s < 60000);
    if (this.active >= this.concurrent) return -1;              // ต้องรอให้ของเดิมเสร็จก่อน
    if (this.stamps.length < this.rpm) return 0;
    return Math.max(0, 60000 - (t - this.stamps[0]));
  }
  async acquire() {
    for (let guard = 0; guard < 1000; guard++) {
      const wait = this.check();
      if (wait === 0) { this.stamps.push(this.now()); this.active++; return true; }
      await this.sleep(wait > 0 ? wait : 25);
    }
    return false;
  }
  release() { this.active = Math.max(0, this.active - 1); }
}
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ────────────────────────────────────────────────────────────────
// 4) AIClient — ตัวเรียกจริง (ไม่ throw · retry เอง · นับต้นทุนให้)
// ────────────────────────────────────────────────────────────────
export const DEFAULT_AI = {
  provider: 'openai', model: '', temperature: 0.7, maxTokens: 800,
  ollamaUrl: 'http://localhost:11434', embedProvider: 'auto', maxRetries: 2,
};
export class AIClient {
  /** @param {object} o { http:{fetch,stream?}, settings, keyStore, tracker, limiter, now, sleep } */
  constructor({ http, settings = {}, keyStore = null, tracker = null, limiter = null, sleep = defaultSleep, log = null } = {}) {
    this.http = http;
    this._settings = settings;
    this.keyStore = keyStore || new KeyStore({});
    this.tracker = tracker;
    this.limiter = limiter || new RateLimiter({ sleep });
    this.sleep = sleep;
    this.log = log;
  }
  settings() { return { ...DEFAULT_AI, ...(typeof this._settings === 'function' ? this._settings() : this._settings) }; }
  provider() { return this.settings().provider || 'openai'; }
  async ready() {
    const s = this.settings();
    if (!PROVIDERS[s.provider] || !PROVIDERS[s.provider].needsKey) return true;
    return !!(await this.keyStore.get());
  }
  baseUrl(s) { return s.provider === 'ollama' ? s.ollamaUrl : s.baseUrl; }

  /** One completion. Never throws — always returns { ok, text, usage, cost, error }. */
  async complete(opts = {}) {
    const s = { ...this.settings(), ...pickDefined(opts, ['provider', 'model', 'temperature', 'maxTokens']) };
    const provider = s.provider;
    const def = PROVIDERS[provider];
    if (!def) return fail(T`ไม่รู้จักผู้ให้บริการ: ` + provider, 'bad-provider');
    const apiKey = def.needsKey ? await this.keyStore.get() : '';
    if (def.needsKey && !apiKey) return fail(T`ยังไม่ได้ตั้งค่า API key (ไฟล์ → ตั้งค่า AI)`, 'no-key');

    const model = s.model || def.defaultModel;
    const req = buildRequest(provider, {
      apiKey, model, baseUrl: this.baseUrl(s), system: opts.system, prompt: opts.prompt,
      messages: opts.messages, temperature: s.temperature, maxTokens: s.maxTokens,
    });
    const maxRetries = s.maxRetries ?? 2;
    await this.limiter.acquire();
    try {
      for (let attempt = 0; ; attempt++) {
        let res;
        try {
          res = await this.http.fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
        } catch (e) {
          if (attempt < maxRetries) { await this.sleep(backoff(attempt)); continue; }
          return fail(T`เชื่อมต่อ AI ไม่ได้: ` + (e && e.message), 'network');
        }
        if (!res || !res.ok) {
          const status = (res && res.status) || 0;
          if (retryable(status) && attempt < maxRetries) { await this.sleep(backoff(attempt)); continue; }
          if (this.log) this.log('error', 'AI HTTP ' + status, redact({ url: req.url, body: (res && res.body || '').slice(0, 200) }));
          return { ...fail(httpMessage(status), 'http'), status };
        }
        const data = safeJson(res.body);
        if (!data) return fail(T`อ่านคำตอบจาก AI ไม่ได้ (ไม่ใช่ JSON)`, 'bad-json');
        const { text, usage } = parseResponse(provider, data);
        const cost = estimateCost(provider, model, usage);
        if (this.tracker) this.tracker.record({ provider, model, usage, feature: opts.feature });
        return { ok: true, text: (text || '').trim(), usage, cost, provider, model };
      }
    } finally { this.limiter.release(); }
  }

  /**
   * Streaming completion. Uses http.stream when the transport supports it,
   * otherwise falls back to one normal call and emits the whole text once
   * (UI code stays identical either way).
   */
  async stream(opts = {}, onChunk = () => {}) {
    const s = { ...this.settings(), ...pickDefined(opts, ['provider', 'model', 'temperature', 'maxTokens']) };
    const provider = s.provider;
    const def = PROVIDERS[provider];
    if (!def) return fail(T`ไม่รู้จักผู้ให้บริการ: ` + provider, 'bad-provider');
    if (!this.http.stream) {
      const r = await this.complete(opts);
      if (r.ok && r.text) onChunk(r.text, r);
      return r;
    }
    const apiKey = def.needsKey ? await this.keyStore.get() : '';
    if (def.needsKey && !apiKey) return fail(T`ยังไม่ได้ตั้งค่า API key (ไฟล์ → ตั้งค่า AI)`, 'no-key');
    const model = s.model || def.defaultModel;
    const req = buildRequest(provider, {
      apiKey, model, baseUrl: this.baseUrl(s), system: opts.system, prompt: opts.prompt,
      messages: opts.messages, temperature: s.temperature, maxTokens: s.maxTokens, stream: true,
    });
    let text = '';
    await this.limiter.acquire();
    try {
      const res = await this.http.stream(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) },
        (line) => {
          const c = parseStreamChunk(provider, line);
          if (c && c.text) { text += c.text; onChunk(c.text, { partial: text }); }
        });
      if (res && res.ok === false) return { ...fail(httpMessage(res.status), 'http'), status: res.status };
      const usage = { input: estimateTokens(opts.prompt || ''), output: estimateTokens(text), total: 0 };
      usage.total = usage.input + usage.output;
      if (this.tracker) this.tracker.record({ provider, model, usage, feature: opts.feature });
      return { ok: true, text: text.trim(), usage, cost: estimateCost(provider, model, usage), provider, model };
    } catch (e) {
      return fail(T`สตรีมข้อความไม่สำเร็จ: ` + (e && e.message), 'network');
    } finally { this.limiter.release(); }
  }

  /** Embeddings. Falls back to the offline local embedder when no remote is usable. */
  async embed(texts, opts = {}) {
    const list = Array.isArray(texts) ? texts : [texts];
    const s = this.settings();
    const want = opts.provider || (s.embedProvider === 'auto' ? s.provider : s.embedProvider);
    const def = PROVIDERS[want];
    const usable = def && def.embed && (!def.needsKey || await this.keyStore.get());
    if (opts.local || !usable) return { ok: true, vectors: list.map((t) => localEmbed(t)), model: 'local', local: true };
    const model = opts.model || def.defaultEmbedModel;
    const apiKey = def.needsKey ? await this.keyStore.get() : '';
    const req = def.embed({ baseUrl: this.baseUrl(s), apiKey, model, texts: list });
    try {
      const res = await this.http.fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
      if (!res || !res.ok) return { ok: true, vectors: list.map((t) => localEmbed(t)), model: 'local', local: true, fellBack: true };
      const data = safeJson(res.body);
      const vectors = (data && def.parseEmbed(data)) || [];
      if (!vectors.length) return { ok: true, vectors: list.map((t) => localEmbed(t)), model: 'local', local: true, fellBack: true };
      if (this.tracker) {
        const usage = { input: list.reduce((n, t) => n + estimateTokens(t), 0), output: 0, total: 0 };
        usage.total = usage.input;
        this.tracker.record({ provider: want, model, usage, feature: 'embed' });
      }
      return { ok: true, vectors, model };
    } catch {
      return { ok: true, vectors: list.map((t) => localEmbed(t)), model: 'local', local: true, fellBack: true };
    }
  }
}
function fail(error, code) { return { ok: false, text: '', error, code, usage: { input: 0, output: 0, total: 0 }, cost: { usd: 0 } }; }
const retryable = (s) => s === 429 || s === 408 || (s >= 500 && s < 600);
const backoff = (n) => Math.min(8000, 500 * Math.pow(2, n));
function httpMessage(status) {
  if (status === 401 || status === 403) return T`API key ไม่ถูกต้องหรือหมดสิทธิ์ (HTTP ` + status + ')';
  if (status === 429) return T`เรียกถี่เกินไป — ลองใหม่อีกครั้ง (HTTP 429)`;
  if (status >= 500) return T`ฝั่งผู้ให้บริการขัดข้อง (HTTP ` + status + ')';
  return T`เรียก AI ไม่สำเร็จ (HTTP ` + status + ')';
}
function pickDefined(o, keys) {
  const out = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}
/** Wrap kapi (or any {fetch}) as the http adapter. */
export function httpFromKapi(kapi) {
  return {
    fetch: (url, opts) => kapi.httpFetch(url, opts),
    stream: kapi.httpStream ? (url, opts, onLine) => kapi.httpStream(url, opts, onLine) : undefined,
  };
}

// ────────────────────────────────────────────────────────────────
// 5) RAG: chunk → embed → vector index → retrieve → context
// ────────────────────────────────────────────────────────────────
/** Split long text into overlapping chunks, preferring paragraph boundaries. */
export function chunkText(text, { maxTokens = 400, overlap = 40 } = {}) {
  const src = String(text || '').trim();
  if (!src) return [];
  const paras = src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ''; };
  for (const p of paras) {
    if (estimateTokens(p) > maxTokens) {                 // ย่อหน้าเดียวยาวเกิน → ซอยตามความยาว
      flush();
      const step = maxTokens * 3;                        // ~3 ตัวอักษร/token (เผื่อไทย)
      const back = overlap * 3;
      for (let i = 0; i < p.length; i += Math.max(1, step - back)) out.push(p.slice(i, i + step).trim());
      continue;
    }
    if (estimateTokens(buf + '\n\n' + p) > maxTokens) flush();
    buf = buf ? buf + '\n\n' + p : p;
  }
  flush();
  return out.filter(Boolean);
}

export const EMBED_DIM = 256;
/** Offline embedding: hashed bag-of-words over the Thai-aware tokenizer. No network, deterministic. */
export function localEmbed(text, dim = EMBED_DIM) {
  const v = new Array(dim).fill(0);
  const toks = tokenizeQuery(String(text || ''));
  for (const t of toks) {
    const h = hash(t) % dim;
    v[h] += 1;
    v[(h * 7 + hash(t + '#') % dim) % dim] += 0.5;      // ช่องที่สองช่วยลดการชนของแฮช
  }
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => +(x / len).toFixed(6));
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** In-memory vector store (cache only — rebuildable, stored at <root>/.ai-index.json). */
export class VectorIndex {
  constructor({ model = 'local' } = {}) { this.model = model; this.items = []; }
  add(id, text, vector, meta = {}) {
    this.items.push({ id, text, vector, meta });
    return this.items.length;
  }
  remove(pred) { const n = this.items.length; this.items = this.items.filter((it) => !pred(it)); return n - this.items.length; }
  clear() { this.items = []; }
  get size() { return this.items.length; }
  /** @returns {Array<{id,text,meta,score}>} top-k by cosine similarity */
  search(vector, k = 5, { minScore = 0, filter = null } = {}) {
    const pool = filter ? this.items.filter(filter) : this.items;
    return pool.map((it) => ({ id: it.id, text: it.text, meta: it.meta, score: cosine(vector, it.vector) }))
      .filter((r) => r.score > minScore)
      .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
      .slice(0, k);
  }
  toJSON() { return { version: 1, model: this.model, items: this.items }; }
  static fromJSON(o) {
    const idx = new VectorIndex({ model: (o && o.model) || 'local' });
    idx.items = (o && Array.isArray(o.items) ? o.items : []);
    return idx;
  }
}
export const INDEX_FILE = '.ai-index.json';

/** Assemble retrieved chunks into a prompt-ready context block, capped by token budget. */
export function buildContext(hits, { maxTokens = 1500, header = T`ข้อมูลอ้างอิงจากโปรเจกต์` } = {}) {
  const parts = [];
  const used = [];
  let budget = maxTokens;
  for (const h of hits || []) {
    const label = (h.meta && (h.meta.title || h.meta.name)) || h.id;
    const block = `[${label}]\n${h.text}`;
    const cost = estimateTokens(block);
    if (cost > budget) continue;                          // ข้ามก้อนที่ยาวเกินงบ (ไม่ตัดกลางประโยค)
    budget -= cost;
    parts.push(block);
    used.push({ id: h.id, label, score: +(h.score || 0).toFixed(4) });
  }
  return { text: parts.length ? `### ${header}\n\n` + parts.join('\n\n---\n\n') : '', sources: used, tokens: maxTokens - budget };
}

/**
 * RAG pipeline: index documents once, then retrieve per query.
 * docs = [{ id, text, meta }]
 */
export class RagPipeline {
  constructor({ client, index = null, chunk = {}, embedOpts = {} } = {}) {
    this.client = client;
    this.index = index || new VectorIndex({});
    this.chunk = chunk;
    this.embedOpts = embedOpts;
  }
  async indexDocs(docs = []) {
    const chunks = [];
    for (const d of docs) {
      const parts = chunkText(d.text, this.chunk);
      parts.forEach((text, i) => chunks.push({ id: `${d.id}#${i}`, text, meta: { ...(d.meta || {}), docId: d.id, part: i } }));
    }
    if (!chunks.length) return { added: 0, model: this.index.model };
    const res = await this.client.embed(chunks.map((c) => c.text), this.embedOpts);
    this.index.model = res.model;
    chunks.forEach((c, i) => this.index.add(c.id, c.text, res.vectors[i] || localEmbed(c.text), c.meta));
    return { added: chunks.length, model: res.model, local: !!res.local };
  }
  async retrieve(query, k = 5, opts = {}) {
    if (!this.index.size) return [];
    const res = await this.client.embed([query], { ...this.embedOpts, ...(this.index.model === 'local' ? { local: true } : {}) });
    return this.index.search(res.vectors[0] || localEmbed(query), k, opts);
  }
  async context(query, opts = {}) {
    const hits = await this.retrieve(query, opts.k || 5, opts);
    return buildContext(hits, opts);
  }
}

// ────────────────────────────────────────────────────────────────
// 6) แปลงคำตอบเป็นโครงสร้าง (โมเดลตอบไม่เป็น JSON เป็นเรื่องปกติ — ต้องพยายามกู้)
// ────────────────────────────────────────────────────────────────
/** Pull JSON out of a model reply (code fences, prose wrappers, trailing commas). */
export function extractJson(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const direct = safeJson(s);
  if (direct) return direct;
  const start = s.search(/[[{]/);
  if (start < 0) return null;
  const open = s[start], close = open === '[' ? ']' : '}';
  const end = s.lastIndexOf(close);
  if (end <= start) return null;
  let body = s.slice(start, end + 1);
  const parsed = safeJson(body) || safeJson(body.replace(/,\s*([\]}])/g, '$1'));  // ลบ comma เกินท้ายรายการ
  return parsed;
}
export function coerceArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'object') {
    for (const k of ['items', 'results', 'issues', 'list', 'data']) if (Array.isArray(v[k])) return v[k];
    return [v];                                        // ผลลัพธ์เดียว โมเดลมักคืน object เดี่ยว
  }
  return [];
}
/**
 * Keep only rows that satisfy the schema; fill defaults; drop the rest.
 * schema = { field: { required?, type?, enum?, default? } }
 */
export function validate(rows, schema) {
  const out = [];
  for (const row of coerceArray(rows)) {
    if (!row || typeof row !== 'object') continue;
    const clean = {};
    let ok = true;
    for (const [field, rule] of Object.entries(schema)) {
      let v = row[field];
      if (v === undefined || v === null || v === '') v = rule.default;
      if (rule.enum && !rule.enum.includes(v)) v = rule.default !== undefined ? rule.default : rule.enum[0];
      if (rule.type === 'number') v = Number(v);
      if (rule.type === 'string' && v != null) v = String(v);
      if (rule.type === 'array') v = Array.isArray(v) ? v : (v == null ? [] : [v]);
      if (rule.required && (v === undefined || v === null || v === '' || (rule.type === 'number' && !isFinite(v)))) { ok = false; break; }
      clean[field] = v;
    }
    if (ok) out.push(clean);
  }
  return out;
}
