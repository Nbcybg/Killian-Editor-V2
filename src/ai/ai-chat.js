// ai-chat.js — คุยกับเรื่องของตัวเอง (RAG chat, ข้อ 79)
// spec: docs/79-ai-chat.md
// แหล่งข้อมูล: ฉาก + วิกิ + เส้นเวลา + ตัวละคร → chunk → embed → เก็บใน VectorIndex (.ai-index.json)
// ตอบพร้อมอ้างอิงที่มา · สตรีมได้ถ้า transport รองรับ (ไม่งั้นส่งก้อนเดียว UI เขียนแบบเดียวกัน)
import { t, tf } from '../i18n.js';
import { VectorIndex, RagPipeline, buildContext, estimateTokens, INDEX_FILE } from './ai-core.js';

const SYSTEM = t('ui.aiChat.youAssistantKnownWorld')
  + t('ui.aiChat.replyThaiUseOnly')
  + t('ui.aiChat.dataNotAtNot')
  + t('ui.aiChat.toScenePageSpecify');

export const MAX_HISTORY_TOKENS = 2000;

// ───────── รวบรวมแหล่งข้อมูลจากโปรเจกต์ (pure — รับข้อมูลที่โหลดมาแล้ว) ─────────
/**
 * Turn project data into RAG documents.
 * @param {object} src { scenes, entities, timeline, project }
 * @returns {Array<{id,text,meta}>}
 */
export function collectDocs(src = {}) {
  const docs = [];
  for (const s of src.scenes || []) {
    if (!s || !s.text) continue;
    docs.push({
      id: 'scene:' + s.id,
      text: tf('ui.aiChat.scene', s.title || '', s.text),
      meta: { kind: 'scene', title: s.title || s.id, sceneId: s.id, chapterId: s.chapterId || '', storyDate: s.storyDate || '' },
    });
  }
  for (const e of src.entities || []) {
    if (!e) continue;
    const body = [e.name, (e.aliases || []).join(', '), e.notes || e.summary || '',
      ...Object.entries(e.fields || {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('\n');
    if (!body.trim()) continue;
    docs.push({
      id: 'wiki:' + (e.id || e.name),
      text: tf('ui.aiChat.page', e.name, body),
      meta: { kind: 'wiki', title: e.name, entityId: e.id || '', category: e.entityTypeKey || '' },
    });
  }
  const events = src.timeline && (src.timeline.events || src.timeline);
  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev || !(ev.title || ev.desc)) continue;
    docs.push({
      id: 'event:' + (ev.id || ev.title),
      text: tf('ui.aiChat.eventTime', ev.title || '', ev.when || '', ev.whenEnd ? ' – ' + ev.whenEnd : '', ev.desc || ''),
      meta: { kind: 'timeline', title: ev.title || '', when: ev.when || '', track: ev.track || '' },
    });
  }
  return docs;
}

// ───────── ประวัติการสนทนา ─────────
/** Keep the most recent turns that fit the budget (always keeps whole pairs). */
export function trimHistory(history = [], maxTokens = MAX_HISTORY_TOKENS) {
  const out = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (!m || !m.content) continue;
    const cost = estimateTokens(m.content) + 4;
    if (used + cost > maxTokens) break;
    used += cost;
    out.unshift({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) });
  }
  return out;
}

/**
 * Build the message array for a chat turn. Pure.
 * @returns {{system, messages, contextText, sources}}
 */
export function buildChatMessages(query, history = [], hits = [], opts = {}) {
  const ctx = buildContext(hits, { maxTokens: opts.maxContextTokens || 2000, header: t('ui.aiChat.dataRefStory') });
  const messages = trimHistory(history, opts.maxHistoryTokens || MAX_HISTORY_TOKENS);
  const userContent = ctx.text
    ? tf('ui.aiChat.wordAsk', ctx.text, query)
    : tf('ui.aiChat.wordAskNotFound', query);
  messages.push({ role: 'user', content: userContent });
  return { system: opts.system || SYSTEM, messages, contextText: ctx.text, sources: ctx.sources };
}

// ───────── ChatSession ─────────
/**
 * A conversation bound to one project index.
 *
 *   const chat = new ChatSession({ client });
 *   await chat.index({ scenes, entities, timeline });
 *   await chat.ask('ยัยแมวปรากฏตัวครั้งแรกตอนไหน', { onChunk });
 */
export class ChatSession {
  constructor({ client, index = null, k = 6, io = null, root = '', maxHistoryTokens = MAX_HISTORY_TOKENS } = {}) {
    this.client = client;
    this.rag = new RagPipeline({ client, index: index || new VectorIndex({}) });
    this.k = k;
    this.io = io; this.root = root;
    this.history = [];
    this.maxHistoryTokens = maxHistoryTokens;
  }
  get index() { return this.rag.index; }
  get size() { return this.rag.index.size; }

  /** (Re)index the project — scenes + wiki + timeline. Returns { added, model }. */
  async build(src) { this.rag.index.clear(); return this.rag.indexDocs(collectDocs(src)); }
  /** Add more documents without clearing what is already indexed. */
  async add(src) { return this.rag.indexDocs(collectDocs(src)); }
  /** Re-index one scene without rebuilding everything. */
  async updateScene(scene) {
    this.rag.index.remove((it) => it.meta && it.meta.sceneId === scene.id);
    return this.rag.indexDocs(collectDocs({ scenes: [scene] }));
  }

  // ---- บันทึก/โหลดดัชนีลงไฟล์แคช (สร้างใหม่ได้เสมอ — ไม่ใช่ข้อมูลงานเขียน) ----
  async save() {
    if (!this.io || !this.root) return false;
    await this.io.writeFile(this.io.join(this.root, INDEX_FILE), JSON.stringify(this.rag.index.toJSON()));
    return true;
  }
  async load() {
    if (!this.io || !this.root) return false;
    try {
      const p = this.io.join(this.root, INDEX_FILE);
      if (!(await this.io.exists(p))) return false;
      const j = await this.io.readJson(p);
      this.rag.index = VectorIndex.fromJSON(j);
      return this.rag.index.size > 0;
    } catch { return false; }
  }

  /** Ask a question; history is kept inside the session. */
  async ask(query, options = {}) {
    const res = await chat(query, this.history, { ...options, client: this.client, rag: this.rag, k: options.k || this.k,
                                                  maxHistoryTokens: this.maxHistoryTokens });
    if (res.ok) {
      this.history.push({ role: 'user', content: query });
      this.history.push({ role: 'assistant', content: res.text });
    }
    return res;
  }
  reset() { this.history = []; }
}

/**
 * Main chat API required by the spec.
 * @param {string} query
 * @param {Array}  history [{role:'user'|'assistant', content}]
 * @param {object} options { client, rag, k, onChunk, stream, model, temperature, maxTokens, maxContextTokens }
 * @returns {Promise<{ok, text, sources, history, usage, cost, error?}>}
 */
export async function chat(query, history = [], options = {}) {
  const client = options.client;
  if (!client) return { ok: false, text: '', sources: [], error: t('ui.common.cantSettingsAIClient'), code: 'no-client', history };
  if (!query || !String(query).trim()) return { ok: false, text: '', sources: [], error: t('ui.aiChat.cantPrintWordAsk'), code: 'empty', history };

  let hits = options.hits || [];
  if (!hits.length && options.rag && typeof options.rag.retrieve === 'function') {
    hits = await options.rag.retrieve(query, options.k || 6);
  }
  const built = buildChatMessages(query, history, hits, options);
  const req = {
    messages: built.messages, system: built.system, feature: 'chat',
    model: options.model, temperature: options.temperature ?? 0.4,
    maxTokens: options.maxTokens || 1000,
  };
  const useStream = (options.stream !== false) && typeof options.onChunk === 'function';
  const res = useStream ? await client.stream(req, options.onChunk) : await client.complete(req);
  const nextHistory = res.ok
    ? [...history, { role: 'user', content: query }, { role: 'assistant', content: res.text }]
    : history;
  return {
    ...res,
    sources: hits.map((h) => ({ id: h.id, title: (h.meta && h.meta.title) || h.id, kind: (h.meta && h.meta.kind) || '',
                                sceneId: (h.meta && h.meta.sceneId) || '', score: +(h.score || 0).toFixed(4) })),
    history: nextHistory,
    contextTokens: estimateTokens(built.contextText || ''),
  };
}
