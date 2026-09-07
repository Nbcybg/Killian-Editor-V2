// ai-bridge.js — ต่อเอนจิน ai-core.js (AIClient + RAG) เข้ากับแอปจริง
// เดิม ai-ui.js เรียก API เองด้วย callAI() ทำให้ RAG/VectorIndex/streaming ใน ai-core ไม่ถูกใช้เลย
import { t } from '../i18n.js';
import { state, log } from '../core.js';
import { AIClient, KeyStore, CostTracker, RagPipeline, VectorIndex,
         httpFromKapi, INDEX_FILE, buildContext, estimateCost, localEmbed } from './ai-core.js';
import { getAISettings } from '../ai-settings.js';
import { currentProvider, complete as providerComplete, completeStream as providerStream } from './ai-provider-ui.js';
import { listScenes, listEntities, syncIo } from '../project-scan.js';

let _client = null;
let _rag = null;
let _ragRoot = '';       // โปรเจกต์ที่ดัชนีปัจจุบันสร้างจาก
export const tracker = new CostTracker({});

// io adapter สำหรับ KeyStore (join ต้องเป็น sync — ดู syncIo ใน project-scan.js)
const keyIo = () => syncIo();

/** ทะเบียนผู้ให้บริการแบบใหม่ (alpha.61) ทำงานอยู่หรือยัง */
function registryActive() {
  const ai = (state.meta && state.meta.ai) || {};
  return Array.isArray(ai.providers) && ai.providers.length > 0;
}

/**
 * [alpha.96] client ที่ใช้ทะเบียนใหม่ — คืนออบเจกต์หน้าเหมือน AIClient
 * (`.complete` / `.stream` / `.embed` / `.ready`) แต่ยิงผ่าน `ai-provider-ui.js`
 *
 * ต้นตอของบั๊ก "AI วิเคราะห์ติดต่อ API ไม่ได้ทั้งที่ตั้งค่าแล้ว": เดิมทุกฟีเจอร์ที่เรียก
 * `getAIClient()` ได้ `AIClient` รุ่นเก่าที่อ่าน `meta.ai.provider` + `ai-key.json → apiKey`
 * ส่วนทะเบียนใหม่เก็บ `meta.ai.providers[]` + `ai-key.json → keys` → คีย์ว่าง/เจ้าเป็น openai เสมอ
 */
function registryClient() {
  const empty = (error, extra = {}) => ({ ok: false, text: '', error, code: 'no-provider',
    usage: { input: 0, output: 0, total: 0 }, cost: { usd: 0 }, ...extra });
  const normUsage = (u) => ({ ...(u || {}), total: (u && (u.total || (u.input || 0) + (u.output || 0))) || 0 });
  return {
    async ready() { const p = await currentProvider(); return !!(p && p.model); },
    async complete(opts = {}) {
      const p = await currentProvider();
      if (!p) return empty(t('ui.aiProvider.cantSettingsProviderAI'));
      const messages = (opts.messages && opts.messages.length)
        ? opts.messages : [{ role: 'user', content: opts.prompt || '' }];
      const r = await providerComplete(p, {
        system: opts.system || '', messages, model: opts.model || undefined,
        temperature: opts.temperature, maxTokens: opts.maxTokens,
        reqId: opts.reqId, timeoutMs: opts.timeoutMs,
      });
      if (!r.ok) return empty(r.error, { status: r.status, aborted: !!r.aborted, timedOut: !!r.timedOut });
      const usage = normUsage(r.usage);
      return { ok: true, text: (r.text || '').trim(), thinking: r.thinking || '', usage,
               cost: estimateCost(p.provider || 'openai', r.model || '', usage), provider: r.provider, model: r.model };
    },
    async stream(opts = {}, onChunk = () => {}) {
      const p = await currentProvider();
      if (!p) return empty(t('ui.aiProvider.cantSettingsProviderAI'));
      const messages = (opts.messages && opts.messages.length)
        ? opts.messages : [{ role: 'user', content: opts.prompt || '' }];
      const r = await providerStream(p, {
        system: opts.system || '', messages, model: opts.model || undefined,
        temperature: opts.temperature, maxTokens: opts.maxTokens,
        reqId: opts.reqId, timeoutMs: opts.timeoutMs,
      }, (c) => onChunk(c.delta || '', { partial: c.text }));
      if (!r.ok) return empty(r.error, { status: r.status, aborted: !!r.aborted, timedOut: !!r.timedOut });
      const usage = normUsage(r.usage);
      return { ok: true, text: r.text, thinking: r.thinking || '', usage,
               cost: estimateCost(p.provider || 'openai', r.model || '', usage), provider: r.provider, model: r.model };
    },
    async embed(texts, opts = {}) {
      // ทะเบียนใหม่ไม่มี remote embeddings — ใช้ local อย่างเดียว (RAG ยังทำงานได้แบบออฟไลน์)
      const list = Array.isArray(texts) ? texts : [texts];
      return { ok: true, vectors: list.map((x) => localEmbed(x)), model: 'local', local: true };
    },
  };
}

export function getAIClient() {
  if (registryActive()) {
    if (_client && _client._root === state.root && _client._adapter) return _client;
    _client = registryClient();
    _client._root = state.root;
    _client._adapter = true;
    return _client;
  }
  if (_client && _client._root === state.root) return _client;
  _client = new AIClient({
    http: httpFromKapi(kapi),
    // settings เป็นฟังก์ชัน → เปลี่ยนใน dialog แล้วมีผลทันที ไม่ต้องสร้าง client ใหม่
    settings: () => {
      const ai = getAISettings();
      return { provider: ai.provider || 'openai', model: ai.model || '',
               temperature: ai.temperature ?? 0.7, maxTokens: ai.maxTokens || 800,
               ollamaUrl: ai.ollamaUrl || 'http://localhost:11434' };
    },
    keyStore: new KeyStore({ io: keyIo(), root: state.root || '' }),
    tracker,
    log: (lv, msg, extra) => log(lv, msg, extra),
  });
  _client._root = state.root;
  return _client;
}

// ───────── RAG: รวบรวมฉาก + Wiki ทั้งโปรเจกต์เป็นเอกสาร ─────────
export async function collectDocs(root) {
  const docs = [];
  for (const e of await listEntities(root)) {
    const body = [Object.values(e.entity.fields || {}).join('\n'),
                  (e.entity.sections || []).map((s) => (s.title || '') + '\n' + (s.content || '')).join('\n')]
      .join('\n').trim();
    if (body) docs.push({ id: 'wiki:' + e.path, text: body,
                          meta: { kind: 'wiki', title: e.name, cat: e.cat, path: e.path } });
  }
  for (const s of await listScenes(root, { withText: true })) {
    if (s.text && s.text.trim()) {
      docs.push({ id: 'scene:' + s.id, text: s.text,
                  meta: { kind: 'scene', title: s.title, sceneId: s.id, path: s.path } });
    }
  }
  return docs;
}

/** สร้าง/คืน RagPipeline ของโปรเจกต์ปัจจุบัน (โหลดดัชนีที่เคยเก็บไว้ก่อน) */
export async function getRag({ rebuild = false, onProgress = null } = {}) {
  if (!state.root) return null;
  if (_rag && _ragRoot === state.root && !rebuild) return _rag;
  const client = getAIClient();
  let index = new VectorIndex({});
  const idxPath = await kapi.join(state.root, INDEX_FILE);
  if (!rebuild) {
    try { if (await kapi.exists(idxPath)) index = VectorIndex.fromJSON(await kapi.readJson(idxPath)); } catch {}
  }
  _rag = new RagPipeline({ client, index });
  _ragRoot = state.root;
  if (!index.size) {
    onProgress && onProgress(t('ui.aiBridge.busyNewIndexBody'));
    const docs = await collectDocs(state.root);
    const res = await _rag.indexDocs(docs);
    log('info', t('ui.aiBridge.aiRagNewIndex'), { docs: docs.length, chunks: res.added, model: res.model });
    try { await kapi.writeFile(idxPath, JSON.stringify(_rag.index.toJSON())); } catch {}
  }
  return _rag;
}

/** ดึงบริบทที่เกี่ยวข้องกับคำถาม (คืน '' ถ้าไม่มีดัชนี) */
export async function ragContext(query, opts = {}) {
  const rag = await getRag(opts);
  if (!rag) return { text: '', sources: [], tokens: 0 };
  try { return await rag.context(query, { k: opts.k || 5, maxTokens: opts.maxTokens || 1500 }); }
  catch (e) { log('warn', t('ui.aiBridge.aiRagRetrieveFail'), e); return buildContext([], {}); }
}

/** ล้างทุกอย่างเมื่อเปลี่ยนโปรเจกต์ (คีย์/ดัชนีของโปรเจกต์เดิมห้ามข้ามมา) */
export function resetAI() { _client = null; _rag = null; _ragRoot = ''; }
