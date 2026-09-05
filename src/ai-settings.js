// ai-settings.js — ตั้งค่า AI (Provider/Key/Model/Temperature) + ทดสอบเชื่อมต่อ + นับการใช้งาน
// หลักสำคัญ 2 ข้อ:
//  1) เรียก API ผ่าน main process (kapi.httpFetch) — fetch จาก renderer โดน CORS (origin เป็น file://)
//  2) API key ไม่เก็บใน project.khn.json (ไฟล์ที่ตั้งใจให้ก๊อป/แชร์) → เก็บแยกที่ <root>/ai-key.json
// [alpha.125 ข้อ D] import ที่เหลือใช้จริงเท่านั้น — ตัวที่กล่องตั้งค่าเก่าใช้
// (`$` `el` `withBusy` `escClose` `tf`) ถูกถอดออกพร้อมกล่องนั้น
import { t } from './i18n.js';
import { state, setStatus, log } from './core.js';

const KEY_FILE = 'ai-key.json';
let _keyCache = null;       // { apiKey } — อ่านครั้งเดียวต่อโปรเจกต์

// ---- ค่าที่ไม่ลับ (เก็บใน project.khn.json ได้) ----
export function getAISettings() {
  if (!state.meta) return {};
  return state.meta.ai || {};
}

export function saveAISettings(cfg) {
  if (!state.meta) return;
  const { apiKey, ...safe } = cfg;                 // กัน key หลุดลง project.khn.json
  state.meta.ai = { ...(state.meta.ai || {}), ...safe };
}

// ---- API key (ไฟล์แยก) ----
export async function loadApiKey() {
  if (_keyCache) return _keyCache.apiKey || '';
  if (!state.root) return '';
  try {
    const p = await kapi.join(state.root, KEY_FILE);
    if (await kapi.exists(p)) { _keyCache = await kapi.readJson(p); return _keyCache.apiKey || ''; }
  } catch (e) { log('warn', t('ui.common.aiReadAiKey'), e); }
  _keyCache = { apiKey: '' };
  return '';
}

export async function saveApiKey(apiKey) {
  if (!state.root) return false;
  _keyCache = { apiKey };
  await kapi.writeFile(await kapi.join(state.root, KEY_FILE),
                       JSON.stringify({ apiKey, note: t('ui.aiSet.fileKeepKeyPart') }, null, 2));
  return true;
}

export function clearKeyCache() { _keyCache = null; }

/**
 * [alpha.62 บั๊ก 6] "ตั้งค่า AI เรียบร้อยหรือยัง" — จุดเดียวที่ทุกฟีเจอร์ถาม
 *
 * alpha.61 ย้ายทะเบียนผู้ให้บริการไปที่ `meta.ai.providers[]` + คีย์ในรูปแบบใหม่
 * (`ai-key.json → {keys:{<credentialId>:…}}`) แต่ตัวเช็คเดิมของ ai-ui.js / ai-summary.js
 * ยังอ่าน `loadApiKey()` ซึ่งดูเฉพาะฟิลด์ `apiKey` เดี่ยวของรูปแบบเก่า → คืน '' เสมอ
 * ผลคือผู้ใช้ที่ตั้งค่าครบแล้วยังโดนบล็อกด้วย "ตั้งค่า AI ที่ ไฟล์ → ตั้งค่า AI ก่อน"
 * (ฟีเจอร์ที่โดน: แนะนำชื่อด้วย AI · สรุปเรื่อง · ผู้ช่วยเขียน · ตรวจพล็อต · สร้างบทสนทนา ฯลฯ)
 *
 * @returns {Promise<{ok:boolean, why:string}>} why = เหตุผลที่ยังใช้ไม่ได้ ('' เมื่อ ok)
 */
export async function aiConfigured() {
  if (!state.root) return { ok: false, why: t('ui.common.cantOpenProject') };
  const ai = getAISettings();
  // ทะเบียนใหม่ (alpha.61) มาก่อนเสมอ
  if (Array.isArray(ai.providers) && ai.providers.length) {
    const { currentProvider } = await import('./ai/ai-provider-ui.js');
    const p = await currentProvider();
    if (!p) return { ok: false, why: t('ui.aiSet.cantPickProviderAI') };
    if (!p.model) return { ok: false, why: t('ui.aiSet.provider') + p.name + t('ui.aiSet.cantPickModelFile') };
    return { ok: true, why: '' };
  }
  if ((ai.provider || 'openai') === 'ollama') return { ok: true, why: '' };
  if (await loadApiKey()) return { ok: true, why: '' };
  return { ok: false, why: t('ui.aiSet.settingsAIFileSettings') };
}

// ---- เรียก AI (ผ่าน main process) ----
/**
 * @param {object} [opts]  [alpha.96] reqId = ชื่อคำขอ (ให้กดหยุดได้) · timeoutMs = เพดานเวลา
 *                         คืน `null` เมื่อล้มเหลว — เหตุผลจริงอยู่ใน log และแถบสถานะเสมอ
 */
export async function callAI(prompt, system = '', opts = {}) {
  const ai = getAISettings();
  const t0 = Date.now();
  // [alpha.61 ข้อ 2] ถ้าผู้ใช้ตั้ง "ผู้ให้บริการที่เพิ่มเอง" ไว้ ให้ใช้ตัวนั้นก่อนเสมอ
  // ฟีเจอร์ AI เดิมทุกตัว (สรุปเรื่อง · แนะนำชื่อ · ผู้ช่วยเขียน) จึงวิ่งผ่านทะเบียนใหม่ได้
  // โดยไม่ต้องแก้ทีละไฟล์ — ค่าที่ตั้งแบบเก่ายังใช้ได้ถ้ายังไม่ได้เพิ่มเจ้าใหม่
  if (Array.isArray(ai.providers) && ai.providers.length) {
    const { currentProvider, complete } = await import('./ai/ai-provider-ui.js');
    const p = await currentProvider();
    // [alpha.62 บั๊ก 5] ตั้งทะเบียนใหม่ไว้แล้ว = ห้ามตกไปทางเก่าเงียบ ๆ
    // (ทางเก่าอ่าน `ai-key.json → apiKey` ซึ่งรูปแบบใหม่ไม่มี → ได้ข้อความ "ยังไม่ได้ตั้งค่า AI"
    //  ทั้งที่ตั้งครบแล้ว · ปุ่ม ✨ ในคุณสมบัติฉากจึงเงียบไปเฉย ๆ) → รายงานเหตุผลจริงเสมอ
    if (!p) { setStatus(t('ui.aiSet.aICantPickProvider')); return null; }
    // [alpha.96] จดทุกคำขอลง log — เดิมสำเร็จก็เงียบ ล้มก็บอกแค่แถบสถานะ
    // พอผู้ใช้เจอ "ปุ่ม AI ไม่ทำงาน" จึงไม่มีอะไรให้ไล่เลยสักบรรทัด
    log('info', 'ai: request', { provider: p.name, model: p.model,
                                 chars: String(prompt || '').length, reqId: opts.reqId || '' });
    const r = await complete(p, { system, messages: [{ role: 'user', content: prompt }],
                                  reqId: opts.reqId, timeoutMs: opts.timeoutMs });
    if (!r.ok) {
      const lv = r.aborted && !r.timedOut ? 'info' : 'error';
      log(lv, 'ai: ' + (r.aborted ? (r.timedOut ? 'timeout' : 'stopped by user') : 'failed'),
          { error: r.error, status: r.status, ms: Date.now() - t0, provider: p.name });
      setStatus((r.aborted && !r.timedOut ? '⏹ ' : '❌ ') + 'AI: ' + r.error);
      return null;
    }
    recordUsage((r.usage && r.usage.total) || 0, p.name, r.model);
    log('info', 'ai: reply', { ms: Date.now() - t0, chars: (r.text || '').length,
                                  usage: r.usage || null, model: r.model });
    return (r.text || '').trim();
  }
  const apiKey = await loadApiKey();
  const provider = ai.provider || 'openai';
  if (!apiKey && provider !== 'ollama') {
    setStatus(t('ui.aiSet.cantSettingsAIFile'));
    return null;
  }
  const model = ai.model || (ai.provider === 'claude' ? 'claude-sonnet-4-5'
    : ai.provider === 'deepseek' ? 'deepseek-chat'
    : ai.provider === 'grok' ? 'grok-2' : ai.provider === 'ollama' ? 'llama3' : 'gpt-4o-mini');
  const temperature = ai.temperature ?? 0.7;
  const maxTokens = ai.maxTokens || 500;

  let url, headers, body;
  if (provider === 'openai' || provider === 'deepseek' || provider === 'grok' || provider === 'custom') {
    // [alpha.60r ข้อ 3] OpenAI-compatible API (DeepSeek, Grok, Custom ใช้รูปแบบเดียวกับ OpenAI)
    url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions'
        : ai.customUrl || ai.ollamaUrl || (provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions'
        : provider === 'grok' ? 'https://api.x.ai/v1/chat/completions' : '');
    if (!url.endsWith('/chat/completions') && !url.endsWith('/v1')) url += '/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey };
    body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature, max_tokens: maxTokens };
  } else if (provider === 'claude') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    body = { model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: prompt }] };
  } else {
    url = (ai.ollamaUrl || 'http://localhost:11434') + '/api/generate';
    headers = { 'Content-Type': 'application/json' };
    body = { model, prompt: (system ? system + '\n\n' : '') + prompt, stream: false };
  }

  try {
    const res = await kapi.httpFetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res || !res.ok) {
      log('error', 'AI HTTP ' + (res?.status), (res?.body || '').slice(0, 300));
      setStatus('❌ AI: HTTP ' + (res?.status || 'error'));
      return null;
    }
    const data = JSON.parse(res.body);
    let text = '';
    if (provider === 'openai' || provider === 'deepseek' || provider === 'grok' || provider === 'custom') text = data.choices?.[0]?.message?.content || '';
    else if (provider === 'claude') text = data.content?.[0]?.text || '';
    else text = data.response || '';
    recordUsage(data.usage?.total_tokens || Math.round(text.length / 4), provider, model);
    return text.trim();
  } catch (e) {
    log('error', 'AI call failed', e);
    setStatus(t('ui.aiSet.connectAICant') + e.message);
    return null;
  }
}

function recordUsage(tokens, provider, model) {
  if (!state.meta) return;
  state.meta.ai = state.meta.ai || {};
  const usage = state.meta.ai.usage || [];
  usage.push({ date: new Date().toISOString(), tokens, provider, model });
  if (usage.length > 500) usage.splice(0, usage.length - 500);
  state.meta.ai.usage = usage;
}

// ═══ [alpha.125 ข้อ D] `testAIConnection()` + `showAISettingsDialog()` ถูกลบแล้ว ═══
//
// ทั้งคู่เป็นกล่องตั้งค่า AI ยุคก่อนหลายผู้ให้บริการ — ถูกแทนที่ด้วย `ai/ai-provider-ui.js`
// ตั้งแต่ alpha.79 (ตัวนั้นจัดการหลาย provider · คีย์แยกไฟล์ · ทดสอบการเชื่อมต่อในตัว)
// และ **ไม่มีไฟล์ไหนเรียกสองตัวนี้อีกเลย**: ทุกจุดที่เปิดกล่องตั้งค่า AI (app.js · ai-analyzer-ui
// · starter-ui) import `showAISettingsDialog` จาก `./ai/ai-provider-ui.js` ทั้งหมด
//
// ที่ยังใช้จากไฟล์นี้จริง ๆ คือ: `callAI` · `aiConfigured` · `getAISettings` / `saveAISettings`
// · `loadApiKey` / `saveApiKey` — เก็บไว้ครบ
