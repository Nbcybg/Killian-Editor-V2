// ai-bridge.js — ต่อเอนจิน ai-core.js (AIClient + RAG) เข้ากับแอปจริง
// เดิม ai-ui.js เรียก API เองด้วย callAI() ทำให้ RAG/VectorIndex/streaming ใน ai-core ไม่ถูกใช้เลย
import { T } from '../i18n.js';
import { state, log } from '../core.js';
import { AIClient, KeyStore, CostTracker, RagPipeline, VectorIndex,
         httpFromKapi, INDEX_FILE, buildContext } from './ai-core.js';
import { getAISettings } from '../ai-settings.js';
import { listScenes, listEntities, syncIo } from '../project-scan.js';

let _client = null;
let _rag = null;
let _ragRoot = '';       // โปรเจกต์ที่ดัชนีปัจจุบันสร้างจาก
export const tracker = new CostTracker({});

// io adapter สำหรับ KeyStore (join ต้องเป็น sync — ดู syncIo ใน project-scan.js)
const keyIo = () => syncIo();

export function getAIClient() {
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
    onProgress && onProgress(T`กำลังสร้างดัชนีเนื้อหา…`);
    const docs = await collectDocs(state.root);
    const res = await _rag.indexDocs(docs);
    log('info', T`ai rag: สร้างดัชนี`, { docs: docs.length, chunks: res.added, model: res.model });
    try { await kapi.writeFile(idxPath, JSON.stringify(_rag.index.toJSON())); } catch {}
  }
  return _rag;
}

/** ดึงบริบทที่เกี่ยวข้องกับคำถาม (คืน '' ถ้าไม่มีดัชนี) */
export async function ragContext(query, opts = {}) {
  const rag = await getRag(opts);
  if (!rag) return { text: '', sources: [], tokens: 0 };
  try { return await rag.context(query, { k: opts.k || 5, maxTokens: opts.maxTokens || 1500 }); }
  catch (e) { log('warn', T`ai rag: retrieve ล้มเหลว`, e); return buildContext([], {}); }
}

/** ล้างทุกอย่างเมื่อเปลี่ยนโปรเจกต์ (คีย์/ดัชนีของโปรเจกต์เดิมห้ามข้ามมา) */
export function resetAI() { _client = null; _rag = null; _ragRoot = ''; }
