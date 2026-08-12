// ai-settings.js — ตั้งค่า AI (Provider/Key/Model/Temperature) + ทดสอบเชื่อมต่อ + นับการใช้งาน
// หลักสำคัญ 2 ข้อ:
//  1) เรียก API ผ่าน main process (kapi.httpFetch) — fetch จาก renderer โดน CORS (origin เป็น file://)
//  2) API key ไม่เก็บใน project.khn.json (ไฟล์ที่ตั้งใจให้ก๊อป/แชร์) → เก็บแยกที่ <root>/ai-key.json
import { t, tf } from './i18n.js';
import { $, el, state, setStatus, log, withBusy } from './core.js';

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
export async function callAI(prompt, system = '') {
  const ai = getAISettings();
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
    const r = await complete(p, { system, messages: [{ role: 'user', content: prompt }] });
    if (!r.ok) { log('error', t('ui.aiSet.aIProviderNewFail'), r.error); setStatus('❌ AI: ' + r.error); return null; }
    recordUsage((r.usage && r.usage.total) || 0, p.name, r.model);
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

export async function testAIConnection() {
  // [alpha.62 บั๊ก 10] เครือข่ายช้าได้เป็นสิบวินาที — ต้องเห็นว่าโปรแกรมยังทำงานอยู่
  const result = await withBusy(t('ui.aiSet.busyTestConnectAI'),
                                () => callAI(t('ui.aiSet.replyBackWordOk'), ''));
  const ok = !!result && result.toLowerCase().includes('ok');
  setStatus(ok ? t('ui.aiSet.aIConnectOk') : t('ui.aiSet.aITestFail'));
  return ok;
}

// ---- กล่องตั้งค่า ----
export async function showAISettingsDialog() {
  if (!state.root) { setStatus(t('ui.common.openProjectBeforeSettings')); return; }
  const ai = getAISettings();
  const curKey = await loadApiKey();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-ai-settings');
  box.append(el('div', 'k-dlg-title', t('ui.common.settingsAI')));

  const mkRow = (label) => { const r = el('div', 'wiki-row'); r.append(el('label', null, label)); box.append(r); return r; };

  const provRow = mkRow(t('ui.common.provider'));
  const provSel = el('select', 'wiki-input k-dlg-select');
  // [alpha.60r ข้อ 3] เพิ่ม DeepSeek, Grok, และกำหนดเอง
  const providers = [
    ['openai', 'OpenAI — ChatGPT / GPT-4o / o3'],
    ['deepseek', 'DeepSeek — V3 / R1'],
    ['grok', 'Grok (xAI)'],
    ['claude', 'Claude (Anthropic)'],
    ['ollama', t('ui.common.ollamaItem')],
    ['custom', t('ui.aiSet.defineCustomLLM')],
  ];
  for (const [v, t] of providers) {
    const o = el('option', null, t); o.value = v; provSel.append(o);
  }
  provSel.value = ai.provider || 'openai';
  provRow.append(provSel);

  const keyRow = mkRow('API Key');
  const keyInp = el('input', 'wiki-input'); keyInp.type = 'password'; keyInp.value = curKey; keyInp.placeholder = 'sk-…';
  keyRow.append(keyInp);
  const keyNote = el('div', 'dim', tf('ui.aiSet.keepSplitFolderProject', KEY_FILE));
  keyNote.style.cssText = 'font-size:11px;margin:-4px 0 6px';
  box.append(keyNote);

  const modelRow = mkRow(t('ui.common.model'));
  const modelInp = el('input', 'wiki-input'); modelInp.value = ai.model || ''; modelInp.placeholder = 'gpt-4o-mini / claude-sonnet-4-5 / llama3';
  modelRow.append(modelInp);

  const tempRow = mkRow(t('ui.aiSet.newTemperature'));
  const tempRng = el('input', 'wiki-input'); tempRng.type = 'range'; tempRng.min = '0'; tempRng.max = '1'; tempRng.step = '0.1';
  tempRng.value = String(ai.temperature ?? 0.7);
  const tempLbl = el('span', null, ' ' + (ai.temperature ?? 0.7));
  tempRng.oninput = () => { tempLbl.textContent = ' ' + tempRng.value; };
  tempRow.append(tempRng, tempLbl);

  const tokRow = mkRow(t('ui.aiSet.longHighLastTokens'));
  const tokInp = el('input', 'wiki-input'); tokInp.type = 'number'; tokInp.value = String(ai.maxTokens || 500);
  tokInp.min = '50'; tokInp.max = '8192';
  tokRow.append(tokInp);

  // แถว Ollama URL / Custom URL — แสดง/ซ่อนตามผู้ให้บริการที่เลือก
  const urlRow = mkRow('Ollama / Custom URL');
  const urlInp = el('input', 'wiki-input');
  urlInp.value = ai.customUrl || ai.ollamaUrl || (ai.provider === 'deepseek' ? 'https://api.deepseek.com' :
                   ai.provider === 'grok' ? 'https://api.x.ai/v1' : 'http://localhost:11434');
  urlInp.placeholder = 'https://api.example.com/v1/chat/completions';
  urlRow.append(urlInp);
  const syncProv = () => {
    const show = ['ollama', 'custom', 'deepseek', 'grok'].includes(provSel.value);
    urlRow.style.display = show ? '' : 'none';
    keyRow.style.display = provSel.value === 'ollama' ? 'none' : '';
    // [alpha.60r ข้อ 3] อัปเดต placeholder model ตาม provider ที่เลือก
    const defs = { openai: 'gpt-4o-mini', deepseek: 'deepseek-chat', grok: 'grok-2',
                   claude: 'claude-sonnet-4-5', ollama: 'llama3', custom: 'gpt-4o-mini' };
    modelInp.placeholder = defs[provSel.value] || 'gpt-4o-mini';
  };
  provSel.onchange = syncProv;
  syncProv();

  const usage = ai.usage || [];
  if (usage.length) {
    const total = usage.reduce((s, u) => s + (u.tokens || 0), 0);
    const last = usage[usage.length - 1];
    const stat = el('div', 'dim',
      tf('ui.aiSet.mergeTokensTimesLatest', total.toLocaleString(), usage.length, new Date(last.date).toLocaleString('th-TH')));
    stat.style.cssText = 'margin:10px 0;font-size:12px';
    box.append(stat);
  }

  const collect = () => ({
    provider: provSel.value, model: modelInp.value.trim(),
    temperature: parseFloat(tempRng.value), maxTokens: parseInt(tokInp.value, 10) || 500,
    ollamaUrl: urlInp.value.trim() || 'http://localhost:11434',
    customUrl: urlInp.value.trim() || '',
  });

  const btns = el('div', 'k-dlg-btns');
  const testB = el('button', null, t('ui.aiSet.testConnect'));
  const cB = el('button', null, t('ui.common.cancel'));
  const okB = el('button', 'k-ok', t('ui.common.save'));
  btns.append(testB, cB, okB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);

  testB.onclick = async () => {
    saveAISettings(collect());
    await saveApiKey(keyInp.value.trim());
    await testAIConnection();
  };
  cB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  okB.onclick = async () => {
    saveAISettings(collect());
    await saveApiKey(keyInp.value.trim());
    const { saveProjectMeta } = await import('./app.js');
    await saveProjectMeta();
    ov.remove();
    setStatus(t('ui.common.saveSettingsAIDone'));
  };
}
