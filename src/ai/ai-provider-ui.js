// ai-provider-ui.js — [alpha.61 ข้อ 2] หน้าตั้งค่า AI แบบใหม่
//
// ผู้ให้บริการไม่ใช่รายการสำเร็จรูปอีกต่อไป — เป็น dropdown ของ "เจ้าที่ผู้ใช้เพิ่มเอง"
// กด ➕ แล้วได้ป๊อปอัปกรอก 4 ส่วนตามลำดับ: ชื่อ → Credential → Model → Parameters
//
// ตรรกะทั้งหมด (validate · สร้างคำขอ · อ่านคำตอบ) อยู่ใน ai-providers.js ซึ่งเป็นโมดูลบริสุทธิ์
// ไฟล์นี้ทำแค่ "วาดและยิงคำขอ" เท่านั้น

import { t, tf } from '../i18n.js';
import { retryBackoff } from '../timing.js';
import { $, el, state, setStatus, setStatusError, log, setBusy, clearBusy } from '../core.js';
import {
  PARAM_DEFS, defaultParams, normalizeParams, parseDomains, isDomainAllowed,
  newProvider, validateProvider, validateProviderIssues, stripSecrets, withSecrets,
  modelsRequests, parseModels, chatRequest, parseChat, parseStreamChunk,
  listProviders, activeProvider, upsertProvider, removeProvider, mergeDefaults, packDefaults,
  isStarvedReply, isCutByThinking, thinkingHeadroom, boostedMaxTokens, apiKindOf, API_KINDS, PROVIDER_PRESETS,
} from './ai-providers.js';
import { SEND_KEYS, DEFAULT_SEND_KEY, estimateTokens } from './ai-session.js';
// [alpha.145] คำอธิบายความล้มเหลวที่ผู้ใช้ทำอะไรต่อได้ (โมดูลบริสุทธิ์ · unit test แยก)
import { describeHttpError, shortError, redactSecrets, clip } from './ai-error.js';
import { gi } from '../icons.js';
import { withUserSystem, listAgents, upsertAgent, removeAgent, moveAgent } from './ai-agents.js';
import { fmtNum } from '../locale.js';

const KEY_FILE = 'ai-key.json';
let _keys = null;                 // { <credentialId>: apiKey } — อ่านครั้งเดียวต่อโปรเจกต์

// ────────────────────────────── ที่เก็บคีย์ (แยกจากไฟล์ที่แชร์) ──────────────────────────────
export async function loadKeys() {
  if (_keys) return _keys;
  _keys = {};
  if (!state.root) return _keys;
  try {
    const p = await kapi.join(state.root, KEY_FILE);
    if (await kapi.exists(p)) {
      const j = await kapi.readJson(p);
      _keys = (j && j.keys) || {};
      // ไฟล์รุ่นเก่าเก็บคีย์เดียวที่ `apiKey` — พามาให้ผู้ใช้ไม่ต้องกรอกใหม่
      if (j && j.apiKey && !Object.keys(_keys).length) _keys = { legacy: j.apiKey };
    }
  } catch (e) { log('warn', t('ui.common.aiReadAiKey'), e); }
  return _keys;
}
export async function saveKeys(keys) {
  _keys = keys || {};
  if (!state.root) return false;
  await kapi.writeFile(await kapi.join(state.root, KEY_FILE), JSON.stringify({
    keys: _keys,
    note: t('ui.aiProvider.fileKeepKeyPart'),
  }, null, 2));
  return true;
}
export function clearKeysCache() { _keys = null; }

// ────────────────────────────── ทะเบียนใน project.khn.json ──────────────────────────────
export function aiMeta() {
  if (!state.meta) return {};
  state.meta.ai = state.meta.ai || {};
  return state.meta.ai;
}
/**
 * [alpha.159 · M30] จดการใช้ AI ลง `meta.ai.usage` — **ทางเดียว** ของทุกฟีเจอร์ (แชท · วิเคราะห์ · …)
 * เดิมมีแต่แผงแชทที่จด → หน้า "การใช้งาน/ค่าใช้จ่าย" ไม่รวมงานวิเคราะห์ซึ่งกินโทเคนมากที่สุด
 * ผู้เรียกเป็นคนบันทึก project meta เอง (แชทรวบทีเดียวตอนจบรอบ · วิเคราะห์บันทึกทันที)
 * @returns {boolean} true = จดแล้ว
 */
export function recordAiUsage({ usage, cost, provider = '', model = '', feature = '', session = '' } = {}) {
  if (!state.meta || !usage) return false;
  const ai = aiMeta();
  const list = ai.usage || [];
  list.push({ date: new Date().toISOString(), tokens: usage.total || ((usage.input || 0) + (usage.output || 0)),
              in: usage.input || 0, out: usage.output || 0,
              usd: cost && Number.isFinite(cost.usd) ? cost.usd : null,
              provider, model, feature, ...(session ? { session } : {}) });
  if (list.length > 500) list.splice(0, list.length - 500);
  ai.usage = list;
  return true;
}

/** ผู้ให้บริการที่เลือกใช้อยู่ พร้อมคีย์จริง (null = ยังไม่ได้ตั้งค่าอะไรเลย) */
export async function currentProvider() {
  let p = activeProvider(aiMeta());
  if (!p && await adoptMyDefaults()) p = activeProvider(aiMeta());
  if (!p) return null;
  return withSecrets(p, await loadKeys());
}

/**
 * [trial 2026-10-25 ข้อ 11] โปรเจกต์ที่ยังไม่มีผู้ให้บริการเลย → ใช้ชุด "ของฉัน" ที่ผู้ใช้บันทึกไว้ให้เอง (ครั้งเดียวต่อโปรเจกต์)
 * ผู้ใช้เจอ: ตั้งผู้ให้บริการในโปรเจกต์แรกแล้ว เปิดโปรเจกต์ใหม่ส่งแชท = เงียบ (ทะเบียนผูกกับโปรเจกต์ · ปุ่ม "บันทึกเป็นของฉัน"/
 * "นำเข้า" มีอยู่แต่ผู้ใช้ใหม่ไม่รู้) · ชุดของฉันเก็บเข้ารหัสใน userData (main) → คีย์ลงไฟล์คีย์ของโปรเจกต์เหมือนกดนำเข้าเอง
 * โหมดเทส: ไม่แตะ (userData ของเทสไม่มีชุดของฉันอยู่แล้ว แต่กันไว้ให้แน่)
 * @returns {Promise<boolean>} true = รับชุดของฉันเข้ามาแล้ว
 */
const _adopted = new Set();
async function adoptMyDefaults() {
  const root = state.root;
  if (!root || !state.meta || _adopted.has(root) || !kapi.aiDefaultsLoad) return false;
  if (listProviders(aiMeta()).length) return false;           // ผู้ใช้ตั้งเองแล้ว (แค่ยังไม่ได้เลือกตัวใช้งาน) — ไม่ยุ่ง
  _adopted.add(root);
  let defaults = null;
  try { defaults = await kapi.aiDefaultsLoad(); } catch { defaults = null; }
  if (!defaults || !Array.isArray(defaults.providers) || !defaults.providers.length) return false;
  if (state.root !== root) return false;
  const m = mergeDefaults([], defaults);
  if (!m.added) return false;
  const active = defaults.activeProviderId && m.rows.some((x) => x.id === defaults.activeProviderId)
    ? defaults.activeProviderId : m.rows[0].id;
  if (Object.keys(m.keys).length) { const keys = await loadKeys(); Object.assign(keys, m.keys); await saveKeys(keys); }
  await persist(m.rows, active);
  log('info', 'ai: defaults adopted for new project', { added: m.added, withKeys: Object.keys(m.keys).length });
  try { const { toast } = await import('../ui.js'); toast(tf('ui.aiProvider.defaultsAdopted', m.added), { level: 'ok' }); } catch {}
  return true;
}
/** provider ตาม id (เซสชันแชท override ได้) */
export async function providerById(id) {
  const rows = listProviders(aiMeta());
  const p = rows.find((x) => x.id === id);
  return p ? withSecrets(p, await loadKeys()) : null;
}
export function providerList() { return listProviders(aiMeta()); }

async function persist(rows, activeId) {
  const ai = aiMeta();
  ai.providers = rows.map(stripSecrets);
  if (activeId !== undefined) ai.activeProviderId = activeId;
  const { saveProjectMeta } = await import('../app.js');
  await saveProjectMeta();
}

// ────────────────────────────── ยิงคำขอจริง (ผ่าน main process) ──────────────────────────────
/** ยิง HTTP ตามคำขอที่โมดูลบริสุทธิ์สร้างให้ — ด่านโดเมนอยู่ตรงนี้ที่เดียว */
export async function sendRequest(provider, req) {
  const allowed = (provider.credential || {}).allowedDomains || [];
  if (!isDomainAllowed(req.url, allowed)) {
    // [alpha.145] ด่านของเราเองก็ต้องมีร่องรอย — เดิมเงียบสนิททั้งบนจอและในบันทึก
    return failure(provider, req, { status: 0, blocked: true,
      body: t('ui.aiProvider.domainNotListAllowed') + req.url
            + ' | Allowed: ' + (allowed.join(', ') || '—') });
  }
  const opts = { method: req.method || 'POST', headers: req.headers };
  if (req.body !== undefined) opts.body = JSON.stringify(req.body);
  // [alpha.96] ยกเลิกได้ + มีเพดานเวลา — main.js ถอดสองคีย์นี้ออกก่อนส่งให้ fetch จริง
  if (req.reqId) opts.__reqId = req.reqId;
  if (req.timeoutMs) opts.__timeoutMs = req.timeoutMs;
  const retries = Math.max(0, req.maxRetries ?? 0);
  // [alpha.96] ช่วยด้วยการหน่วงเวลาระหว่างรอบใหม่ — เดิมยิงซ้ำทันที ทำให้เน็ตช้า/เซิร์ฟเวอร์แออัดโดนถล่มซ้ำ
  // จน "ช้าจน timeout" ยิ่งยืดยาว (3 คำขอต่อเนื่อง = 3×60 วิ) หน่วงแบบ exponential สั้น ๆ ก็พอ
  const backoff = retryBackoff;   // [alpha.162 · W6 ข้อ 7] timing.js
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const who = provider.name || hostOf(req.url);
  try {
    for (let attempt = 0; ; attempt++) {
      setBusy(attempt ? tf('ui.aiProvider.busyNextTryNew', who, attempt) : tf('ui.aiProvider.busyNext', who));
      let res;
      try {
        res = await kapi.httpFetch(req.url, opts);
      } catch (e) {
        if (attempt < retries) { await sleep(backoff(attempt)); continue; }
        // [alpha.145] ข้อความจริงของชั้นเครือข่ายอยู่ใน e.message — เดิมต่อเป็นสตริงเดียว
        // แล้วชั้นบนแยกไม่ออก · ส่งเป็น `body` ให้ `describeHttpError` อ่านได้เต็ม ๆ
        return failure(provider, req, { status: 0, body: String((e && e.message) || e) });
      }
      if (res && res.ok) {
        let json = null;
        try { json = JSON.parse(res.body); } catch {}
        return { ok: true, status: res.status, json, body: res.body };
      }
      // ผู้ใช้กดหยุดเอง หรือหมดเวลา — ห้ามลองใหม่ และต้องบอกเหตุผลตรง ๆ
      if (res && res.aborted) {
        return failure(provider, req, { status: 0, aborted: true, timedOut: !!res.timedOut,
                                        body: res.error || '' });
      }
      const st = (res && res.status) || 0;
      // [alpha.145] main.js เลิก throw ตอนเน็ตพังแล้ว (คืน netError มาแทน) → ทางลองใหม่
      // ต้องรับเคสนี้ด้วย ไม่งั้น "เน็ตกระตุกหนึ่งวินาที" กลายเป็นล้มเหลวถาวรทันที
      const retryable = (res && res.netError) || st === 429 || st === 408 || (st >= 500 && st < 600);
      if (retryable && attempt < retries) { await sleep(backoff(attempt)); continue; }
      return failure(provider, req, { status: st, body: (res && res.body) || '' });
    }
  } finally { clearBusy(); }
}
/** โฮสต์ของ URL แบบไม่โยน (ใช้ตั้งข้อความ "กำลังติดต่อ …") */
function hostOf(url) {
  try { return new URL(String(url)).host; } catch { return 'AI'; }
}
/**
 * ══ [alpha.145] ★ ความล้มเหลวหนึ่งครั้ง = คำอธิบาย + แนวทางแก้ + บรรทัดในบันทึก ══
 *
 * ผู้ใช้: *"error ขึ้นแค่ ⚠ เรียกไม่สำเร็จ (HTTP 0) แต่ไม่รู้ว่าคืออะไรและแนวทางแก้ไข
 *          log ก็ไม่ได้เก็บอะไรเลย"*
 *
 * ของเดิม `httpMsg(status)` ดู **แค่ตัวเลข** แล้วทิ้ง `body` ที่ main.js อุตส่าห์แนบมาให้
 * (ข้อความจริงของเซิร์ฟเวอร์ · `ECONNREFUSED` · `certificate` …) → ทุกอย่างยุบเป็น "HTTP 0"
 * ตอนนี้ทุกทางออกที่ล้มเหลวผ่านตัวนี้ตัวเดียว = ได้ทั้งข้อความบนจอ **และ** บรรทัดในบันทึก เสมอ
 */
function failure(provider, req, e) {
  const info = describeHttpError({
    ...e, url: req && req.url, provider: provider && provider.name,
    model: (req && req.body && req.body.model) || (provider && provider.model) || '',
  });
  // ยกเลิกเอง = ไม่ใช่ข้อผิดพลาด — จดเป็น info ไม่ให้แผงบันทึกแดงโดยไม่จำเป็น
  log(info.code === 'aborted' ? 'info' : 'error', 'ai: ' + shortError(info), info.detail);
  return { ok: false, status: info.status, aborted: !!e.aborted, timedOut: !!e.timedOut,
           error: info.title, detail: info.detail, hints: info.hints, code: info.code,
           serverMessage: info.serverMessage || '',   // [trial 2026-10-25 ข้อ 12] ข้อความของเซิร์ฟเวอร์ตรง ๆ (ปุ่มทดสอบโชว์)
           body: redactSecrets(String(e.body || '')) };
}

/**
 * [alpha.145] จดทุกคำขอที่ **สำเร็จ** ลงบันทึกด้วย — ผู้ใช้: *"log ก็ไม่ได้เก็บอะไรเลย"*
 * มีแต่บรรทัดตอนพังอย่างเดียวก็ยังไล่ไม่ได้ว่า "รอบไหนช้า/รอบไหนคำตอบถูกตัด"
 * ห้ามมีเนื้อบทสนทนาในบันทึก — เก็บเฉพาะตัวเลขและปลายทาง
 */
function logCall(provider, req, { ms, usage, chars, stream }) {
  const u = usage || {};
  log('info', 'ai: ' + (provider && provider.name || '?') + ' · ' + ((req.body && req.body.model) || '?')
      + ' · ' + (ms / 1000).toFixed(1) + 's · ' + (u.total || 0) + ' tok',
      [(stream ? 'stream' : 'complete'),
       'host=' + hostOf(req.url),
       'in=' + (u.input || 0) + ' out=' + (u.output || 0)
         + (u.reasoning ? ' think=' + u.reasoning : '') + (u.cached ? ' cache=' + u.cached : ''),
       'chars=' + chars,
       'max_tokens=' + (req.body && req.body.max_tokens !== undefined ? req.body.max_tokens : '—'),
       'reasoning_effort=' + ((req.body && req.body.reasoning_effort) || '—'),
      ].join(' · '));
}

/** ดึงรายชื่อโมเดลจาก API ของเจ้านั้น — ลองทีละเส้นทางจนกว่าจะได้ */
export async function fetchModels(provider) {
  const reqs = modelsRequests(provider);
  if (!reqs.length) return { ok: false, models: [], error: t('ui.common.cantPutBaseURL') };
  let lastErr = t('ui.aiProvider.notFoundListModel');
  for (const r of reqs) {
    const res = await sendRequest(provider, { ...r, maxRetries: 0 });
    if (!res.ok) { lastErr = res.error; continue; }
    const models = parseModels(res.json);
    if (models.length) return { ok: true, models };
    lastErr = t('ui.aiProvider.toReplyBackDone');
  }
  return { ok: false, models: [], error: lastErr };
}

/**
 * ทดสอบการเชื่อมต่อของ Credential
 * [alpha.170 · บั๊ก 15] เดิมวัดแค่ "ขอรายชื่อโมเดลได้" — เกตเวย์ที่ต้องมี header เพิ่ม/โมเดลที่ไม่รับโปรโตคอล
 * ผ่านด่านนี้ทั้งที่แชทจริงได้ 400 · ตอนนี้ลองคุยจริงหนึ่งคำด้วยโมเดลที่เลือกอยู่ (ไม่กี่โทเคน)
 * `opts.model` = โมเดลที่ผู้ใช้เลือกในฟอร์ม · ไม่มี = ตัวแรกของรายชื่อ · `opts.chat === false` = ข้ามขั้นแชท
 * @returns {Promise<{ok, msg, models:string[], chat?:{ok,model,error?}}>}
 */
export async function testCredential(provider, opts = {}) {
  const r = await fetchModels(provider);
  if (!r.ok) return { ok: false, msg: r.error, models: [] };
  const model = (opts.model && r.models.includes(opts.model) ? opts.model : '') || provider.model || r.models[0] || '';
  if (opts.chat === false || !model) {
    return { ok: true, msg: tf('ui.aiProvider.connectOkFoundModel', r.models.length), models: r.models };
  }
  const c = await complete({ ...provider, model }, {
    messages: [{ role: 'user', content: 'ping' }], maxTokens: 16, temperature: 0,
    noCompass: true, noUserSystem: true, noEmptyRetry: true, maxRetries: 0,
  });
  // คำตอบว่างเพราะโมเดลใช้ 16 โทเคนไปกับการคิด = ปลายทางรับคำขอแล้ว นับว่าเชื่อมต่อได้
  const chatOk = c.ok || c.code === 'empty';
  return chatOk
    ? { ok: true, msg: tf('ui.aiProvider.testChatOk', r.models.length, model), models: r.models, chat: { ok: true, model } }
    : { ok: false, msg: tf('ui.aiProvider.testChatFail', r.models.length, model, c.error || ''), models: r.models,
        chat: { ok: false, model, error: c.error || '', code: c.code || '', hints: c.hints || [],
                serverMessage: c.serverMessage || '' } };
}

// ══ [alpha.170 · บั๊ก 2] โมเดลที่คิดก่อนตอบ: จำว่าเคยใช้คิดเท่าไร แล้วเผื่อที่ให้ล่วงหน้า ══
const _thinkSeen = new Map();   // "<รหัสผู้ให้บริการ>|<โมเดล>" → โทเคนที่ใช้คิดมากสุดที่เคยเห็น
const thinkKey = (provider, model) => String((provider && (provider.id || provider.name)) || '') + '|' + String(model || '');
function noteThinking(provider, model, usage, thinking) {
  const n = Math.max(Number(usage && usage.reasoning) || 0, thinking ? estimateTokens(thinking) : 0);
  if (n <= 0) return;
  const k = thinkKey(provider, model);
  _thinkSeen.set(k, Math.max(_thinkSeen.get(k) || 0, n));
}
function addHeadroom(provider, req) {
  const seen = _thinkSeen.get(thinkKey(provider, req.body && req.body.model));
  if (seen && req.body.max_tokens > 0) req.body.max_tokens += thinkingHeadroom(seen);
}
/** (เทส) ลืมสิ่งที่จำไว้เรื่องการคิดของโมเดล */
export function resetThinkingMemory() { _thinkSeen.clear(); }

/** [alpha.170 · บั๊ก 2] คำตอบว่าง = ความล้มเหลวที่มีคำอธิบาย — ห้ามคืน ok พร้อมข้อความว่างให้ฟีเจอร์ตีความเอง */
function emptyFailure(provider, req, out) {
  const starved = isStarvedReply(out);
  const title = t(starved ? 'ui.aiProvider.emptyThinking' : 'ui.aiProvider.emptyReply');
  const hints = starved ? [t('ui.aiProvider.emptyHintTokens'), t('ui.aiProvider.emptyHintEffort')]
                        : [t('ui.aiProvider.emptyHintModel')];
  const u = (out && out.usage) || {};
  const lines = [t('ui.aiError.provider') + ((provider && provider.name) || ''),
                 t('ui.aiError.model') + ((req.body && req.body.model) || ''),
                 tf('ui.aiProvider.emptyDetail', String(u.reasoning || 0),
                    req.body && req.body.max_tokens !== undefined ? String(req.body.max_tokens) : '—'),
                 '', t('ui.aiError.edit'), ...hints.map((h, i) => (i + 1) + '. ' + h)];
  log('warn', 'ai: ' + title, lines.join('\n'));
  return { ok: false, text: '', thinking: (out && out.thinking) || '', usage: u, error: title,
           detail: lines.join('\n'), hints, code: 'empty', status: 200, starved };
}

/**
 * [alpha.157] เข็มทิศเรื่อง (Logline 6 ช่องของโปรเจกต์/เล่ม) ต่อท้าย system prompt ของ **ทุก** คำขอ
 * ผู้ใช้: *"ส่วนนี้ AI จะช่วยจับได้ เพื่อช่วยในการเขียนที่ไม่หลุดมากเกินไป"*
 * ที่นี่คือจุดต่ำสุดที่ทุกฟีเจอร์ AI วิ่งผ่าน (แชท · วิเคราะห์ · Story Starter · ✨ เติมช่อง)
 * `opts.noCompass` = ข้าม (ทดสอบการเชื่อมต่อ ฯลฯ) · ยังไม่กรอก logline = ไม่แตะคำขอเลยแม้แต่ไบต์เดียว
 */
async function compassOpts(opts) {
  opts = userSystemOpts(opts);
  if (!opts || opts.noCompass) return opts || {};
  try {
    const { currentCompass } = await import('../logline-ui.js');
    const { withCompass } = await import('../logline.js');
    const c = await currentCompass();
    return c ? { ...opts, system: withCompass(opts.system, c) } : opts;
  } catch { return opts; }
}

/**
 * System prompt ที่ผู้ใช้ตั้งเอง (ตั้งค่า AI → System prompt) วางนำหน้า system ของทุกคำขอ
 * — บางโมเดลถูกกรองเนื้อหาไว้ ผู้ใช้จึงต้องใส่คำสั่งของตัวเองได้ในที่เดียวแล้วมีผลกับทุกฟีเจอร์
 * `opts.noUserSystem` = ข้าม
 */
function userSystemOpts(opts) {
  if (!opts || opts.noUserSystem) return opts || {};
  const system = withUserSystem(opts.system, aiMeta());
  return system === (opts.system || '') ? opts : { ...opts, system };
}

/** คุยกับโมเดลหนึ่งรอบ — ไม่โยน error ตลอด (คืน {ok,text,usage,error}) */
export async function complete(provider, opts = {}) {
  if (!provider) return { ok: false, text: '', error: t('ui.aiProvider.cantSettingsProviderAI') };
  opts = await compassOpts(opts);
  if (!provider.model && !opts.model) return { ok: false, text: '', error: t('ui.aiProvider.cantPickModel') };
  const req = chatRequest(provider, opts);
  addHeadroom(provider, req);
  // [alpha.96] ส่งต่อชื่อคำขอ + เพดานเวลา เพื่อให้กด "หยุด" ได้จริง
  if (opts.reqId) req.reqId = opts.reqId;
  if (opts.timeoutMs) req.timeoutMs = opts.timeoutMs;
  if (opts.maxRetries !== undefined) req.maxRetries = opts.maxRetries;
  const bad = (res) => ({ ok: false, text: '', error: res.error, detail: res.detail, hints: res.hints,
                          code: res.code, status: res.status,
                          aborted: !!res.aborted, timedOut: !!res.timedOut });
  let t0 = Date.now();
  let res = await sendRequest(provider, req);
  if (!res.ok) return bad(res);
  let out = parseChat(res.json);
  logCall(provider, req, { ms: Date.now() - t0, usage: out.usage, chars: (out.text || '').length, stream: false });
  noteThinking(provider, req.body.model, out.usage, out.thinking);
  // [alpha.170 · บั๊ก 2] คิดจนโควตาหมด (ว่าง) หรือคำตอบถูกตัดเพราะการคิดกินโควตา → ลองใหม่ครั้งเดียวด้วยเพดานที่สูงขึ้น
  if (!opts.noEmptyRetry && req.body.max_tokens > 0 && (isStarvedReply(out) || isCutByThinking(out))) {
    const bigger = boostedMaxTokens(req.body.max_tokens, out.usage.reasoning || estimateTokens(out.thinking || ''));
    if (bigger > req.body.max_tokens) {
      req.body = { ...req.body, max_tokens: bigger };
      t0 = Date.now();
      res = await sendRequest(provider, req);
      if (!res.ok) return bad(res);
      out = parseChat(res.json);
      logCall(provider, req, { ms: Date.now() - t0, usage: out.usage, chars: (out.text || '').length, stream: false });
      noteThinking(provider, req.body.model, out.usage, out.thinking);
    }
  }
  if (!String(out.text || '').trim()) return emptyFailure(provider, req, out);
  const { text, thinking, usage, finish, truncated } = out;
  return { ok: true, text, thinking, usage, model: req.body.model, provider: provider.name, finish, truncated };
}

/**
 * คุยกับโมเดลแบบสตรีม — ข้อความ/ความคิดไหลมาทีละก้อนผ่าน `onChunk`
 * (ผู้ใช้เห็นว่ากำลัง "ติดต่ออยู่จริง" ไม่ใช่จอว่างรอ timeout — ปัญหาที่ผู้ใช้รายงานมา)
 *
 * @param {object} provider
 * @param {object} opts   เหมือน `complete` ({system, messages, model, reqId, timeoutMs})
 * @param {function} onChunk  ({delta, thinking, text, thinkingAll}) เรียกทุกก้อน
 * @returns {Promise<{ok, text, thinking, usage, model, provider, aborted?, timedOut?}>}
 * ไม่มี `httpStream` (transport เก่า) → ตกไป `complete` แล้วส่งทั้งก้อนครั้งเดียว UI ไม่ต้องแยกกรณี
 */
export async function completeStream(provider, opts = {}, onChunk = () => {}) {
  if (!provider) return { ok: false, text: '', error: t('ui.aiProvider.cantSettingsProviderAI') };
  opts = await compassOpts(opts);
  if (!provider.model && !opts.model) return { ok: false, text: '', error: t('ui.aiProvider.cantPickModel') };
  if (typeof kapi.httpStream !== 'function') {
    const r = await complete(provider, opts);
    if (r.ok && r.text) onChunk({ delta: r.text, thinking: r.thinking || '', text: r.text, thinkingAll: r.thinking || '' });
    return r;
  }
  const req = chatRequest(provider, { ...opts, stream: true });
  addHeadroom(provider, req);
  if (opts.reqId) req.reqId = opts.reqId;
  if (opts.timeoutMs) req.timeoutMs = opts.timeoutMs;
  if (!isDomainAllowed(req.url, (provider.credential || {}).allowedDomains || [])) {
    return failure(provider, req, { status: 0, blocked: true,
      body: t('ui.aiProvider.domainNotListAllowed') + req.url });
  }
  const who = provider.name || hostOf(req.url);
  const httpOpts = { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) };
  if (req.reqId) httpOpts.__reqId = req.reqId;
  // [alpha.149] สำหรับสตรีม main.js ตีความค่านี้เป็น "เงียบนานเกิน" (ไม่ใช่เวลารวมทั้งคำตอบ)
  if (req.timeoutMs) httpOpts.__timeoutMs = req.timeoutMs;
  let text = '';
  let thinking = '';
  let finish = '';
  let streamError = '';
  const streamT0 = Date.now();
  const retries = Math.max(0, req.maxRetries ?? 0);
  const backoff = retryBackoff;   // [alpha.162 · W6 ข้อ 7] timing.js
  try {
   // [alpha.170 · บั๊ก 2] รอบที่สอง = ลองใหม่ครั้งเดียวเมื่อ "คิดจนโควตาหมด ไม่มีคำตอบไหลมาเลย"
   for (let round = 0; round < 2; round++) {
    for (let attempt = 0; ; attempt++) {
      setBusy(attempt ? tf('ui.aiProvider.busyNextTryNew', who, attempt) : tf('ui.aiProvider.busyNext', who));
      const res = await kapi.httpStream(req.url, httpOpts, (line) => {
        const c = parseStreamChunk(line);
        if (!c) return;
        // [alpha.149] ข้อผิดพลาดกลางสตรีม (HTTP 200) — เดิมไม่มีใครอ่าน = คำตอบว่างไม่มีคำอธิบาย
        if (c.error) { streamError = streamError || c.error; return; }
        if (c.finish) finish = c.finish;
        if (!c.delta && !c.thinking) return;
        if (c.thinking) thinking += c.thinking;
        if (c.delta) text += c.delta;
        onChunk({ delta: c.delta || '', thinking: c.thinking || '', text, thinkingAll: thinking });
      });
      if (res && res.ok === false) {
        // [alpha.149] ลองใหม่ได้เฉพาะตอน "ยังไม่มีอะไรไหลมาเลย" — ไหลมาแล้วยิงซ้ำ = ได้ข้อความซ้ำซ้อน
        // (เดิมสตรีมไม่ลองใหม่เลยสักครั้ง ขณะที่คำขอแบบธรรมดาลองตาม Max Retries)
        const st = res.status || 0;
        const retryable = !res.aborted && (res.netError || st === 429 || st === 408 || (st >= 500 && st < 600));
        if (retryable && !text && !thinking && attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff(attempt)));
          continue;
        }
        // ══ [alpha.145] ★ ต้นตอของ "⚠ เรียกไม่สำเร็จ (HTTP 0)" ที่ผู้ใช้เจอ ══
        // main.js แนบเหตุผลจริงมาใน `res.body` ตลอด (ข้อความเซิร์ฟเวอร์ · ECONNREFUSED · …)
        const f = failure(provider, req, { status: st, body: res.body || res.error || '',
                                           aborted: !!res.aborted, timedOut: !!res.timedOut });
        // [alpha.149] `partial` = มีข้อความไหลมาแล้วก่อนพัง/ถูกหยุด — ผู้เรียกต้องเก็บไว้ ไม่ใช่ทิ้ง
        return { ...f, text, thinking, partial: !!text.trim() };
      }
      break;
    }
    noteThinking(provider, req.body.model, null, thinking);
    const starved = !streamError && !text.trim() && (finish === 'length' || !!thinking.trim());
    if (round === 0 && starved && !opts.noEmptyRetry && req.body.max_tokens > 0) {
      const bigger = boostedMaxTokens(req.body.max_tokens, estimateTokens(thinking));
      if (bigger > req.body.max_tokens) {
        req.body = { ...req.body, max_tokens: bigger };
        httpOpts.body = JSON.stringify(req.body);
        thinking = ''; finish = '';
        continue;
      }
    }
    break;
   }
    if (!streamError && !text.trim()) {
      return emptyFailure(provider, req, { text, thinking, finish, truncated: finish === 'length',
                                           usage: { reasoning: estimateTokens(thinking) } });
    }
    if (streamError) {
      const f = failure(provider, req, { status: 0, streamError: true, body: streamError });
      return { ...f, text, thinking, partial: !!text.trim() };
    }
    const usage = {
      input: estimateTokens((opts.messages || []).reduce((n, m) => n + (m.content || ''), '') + (opts.system || '')),
      output: estimateTokens(text), reasoning: estimateTokens(thinking), cached: 0, total: 0,
    };
    usage.total = usage.input + usage.output;
    logCall(provider, req, { ms: Date.now() - streamT0, usage, chars: text.length, stream: true });
    return { ok: true, text: text.trim(), thinking, usage, model: req.body.model, provider: provider.name,
             finish, truncated: finish === 'length' };
  } catch (e) {
    const f = failure(provider, req, { status: 0, body: String((e && e.message) || e) });
    return { ...f, text, thinking, partial: !!text.trim() };
  } finally { clearBusy(); }
}

// ══════════════════════════════ UI: กล่องตั้งค่า AI ══════════════════════════════
export async function showAISettingsDialog() {
  if (!state.root) { setStatus(t('ui.common.openProjectBeforeSettings')); return null; }
  await loadKeys();
  const ai = aiMeta();

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-ai-settings');
  box.append(el('div', 'k-dlg-title', t('ui.common.settingsAI')));

  // ---- แถวผู้ให้บริการ (dropdown ของเจ้าที่ผู้ใช้เพิ่มเอง) ----
  const provRow = el('div', 'wiki-row');
  provRow.append(el('label', null, t('ui.common.provider')));
  const provSel = el('select', 'wiki-input k-dlg-select ai-prov-sel');
  const addBtn = el('button', 'ai-prov-add', t('ui.aiProvider.add'));
  addBtn.title = t('ui.aiProvider.addProviderNew');
  const editBtn = el('button', 'ai-prov-edit', t('ui.aiProvider.edit'));
  const delBtn = el('button', 'ai-prov-del', gi('trash'));
  delBtn.title = t('ui.aiProvider.delProvider2');
  provRow.append(provSel, addBtn, editBtn, delBtn);
  box.append(provRow);

  const info = el('div', 'ai-prov-info dim');
  box.append(info);
  // [alpha.168 · bug hunt] ผู้ให้บริการ "ของฉัน" — บันทึกชุดนี้ไว้ในเครื่อง / นำเข้ามาใช้กับโปรเจกต์นี้ (ไม่ต้องกรอกใหม่ทุกโปรเจกต์)
  const defRow = el('div', 'ai-defaults-row');
  const defImport = el('button', 'cmp-mini ai-defaults-import', t('ui.aiProvider.defaultsImport'));
  defImport.type = 'button'; defImport.title = t('ui.aiProvider.defaultsImportTip');
  const defSave = el('button', 'cmp-mini ai-defaults-save', t('ui.aiProvider.defaultsSave'));
  defSave.type = 'button'; defSave.title = t('ui.aiProvider.defaultsSaveTip');
  const defNote = el('span', 'dim ai-defaults-note');
  defRow.append(defImport, defSave, defNote);
  box.append(defRow);

  const empty = el('div', 'ai-prov-empty dim',
    t('ui.aiProvider.notHasProviderPress'));
  box.append(empty);

  // ---- ปุ่มส่งของแชท (ผู้ใช้สั่งให้ตั้งได้ในตั้งค่า) ----
  const sendRow = el('div', 'wiki-row');
  sendRow.append(el('label', null, t('ui.aiProvider.btnSendText')));
  const sendSel = el('select', 'wiki-input k-dlg-select ai-send-sel');
  for (const k of SEND_KEYS) { const o = el('option', null, k.label); o.value = k.id; sendSel.append(o); }
  sendSel.value = ai.sendKey || DEFAULT_SEND_KEY;
  sendRow.append(sendSel);
  box.append(sendRow);

  // ---- [alpha.129 ข้อ 1] งบประวัติแชท ----
  // เดิมงบตายตัว 6,000 token ฝังในโค้ด → คุยไม่กี่รอบ AI ก็ลืมต้นบทสนทนาแล้วตอบมั่ว
  // 0 = อัตโนมัติ (60% ของขีดจำกัดโมเดลที่เดาได้จากรอบก่อน · ไม่รู้ = 32,000)
  const histRow = el('div', 'wiki-row');
  histRow.append(el('label', null, t('ui.aiProvider.historyTokens')));
  const histInp = el('input', 'wiki-input ai-hist-tokens');
  histInp.type = 'number';
  histInp.min = '0';
  histInp.step = '1000';
  histInp.value = String(Number(ai.historyTokens) || 0);
  histInp.title = t('ui.aiProvider.historyTokensHint');
  histRow.append(histInp);
  box.append(histRow);
  box.append(el('div', 'dim ai-hist-hint', t('ui.aiProvider.historyTokensHint')));

  // ---- System prompt ของผู้ใช้ (นำหน้าทุกคำขอ) ----
  // บางโมเดลถูกกรองเนื้อหาไว้ (soft censored) — ผู้ใช้ใส่คำสั่งของตัวเองได้ที่นี่ที่เดียว มีผลกับทุกฟีเจอร์ AI
  const spSec = el('div', 'ai-set-sec ai-sysprompt-sec');
  const spHead = el('div', 'ai-set-sec-head');
  spHead.append(el('span', 'ai-set-sec-title', t('ui.aiAgent.sysPrompt')));
  const spOnLbl = el('label', 'ai-sysprompt-on-lbl');
  const spOn = el('input', 'wiki-check ai-sysprompt-on');
  spOn.type = 'checkbox';
  spOn.checked = ai.systemPromptOn !== false;
  spOnLbl.append(spOn, document.createTextNode(' ' + t('ui.aiAgent.sysPromptOn')));
  spHead.append(spOnLbl);
  const spTa = el('textarea', 'wiki-input ai-sysprompt');
  spTa.rows = 5;
  spTa.value = ai.systemPrompt || '';
  spTa.placeholder = t('ui.aiAgent.sysPromptPh');
  spSec.append(spHead, spTa, el('div', 'dim ai-hint', t('ui.aiAgent.sysPromptHint')));
  box.append(spSec);

  // ---- Agents บุคลิกการเขียน (ใช้กับ "Rewrite this" ในตัวแก้ไข) ----
  const agSec = el('div', 'ai-set-sec ai-agents-sec');
  const agHead = el('div', 'ai-set-sec-head');
  agHead.append(el('span', 'ai-set-sec-title', t('ui.aiAgent.agents')));
  const agAdd = el('button', 'ai-agent-add', gi('plus-thick') + ' ' + t('ui.aiAgent.add'));
  agHead.append(agAdd);
  const agList = el('div', 'ai-agent-list');
  agSec.append(agHead, agList, el('div', 'dim ai-hint', t('ui.aiAgent.agentsHint')));
  box.append(agSec);
  let agents = listAgents(ai);
  const { agentDialog } = await import('./ai-agents-ui.js');
  function drawAgents() {
    agList.replaceChildren();
    if (!agents.length) agList.append(el('div', 'dim ai-agent-empty', t('ui.aiAgent.empty')));
    agents.forEach((a, i) => {
      const row = el('div', 'ai-agent-row');
      row.dataset.id = a.id;
      const info = el('div', 'ai-agent-info');
      info.append(el('div', 'ai-agent-title', a.name));
      const sub = String(a.persona || '').replace(/\s+/g, ' ').trim();
      info.append(el('div', 'dim ai-agent-sub', (sub.length > 90 ? sub.slice(0, 90) + '…' : sub)
        + (a.refs.length ? '  · ' + tf('ui.aiAgent.refCount', a.refs.length) : '')));
      const up = el('button', 'ai-agent-up', '↑'); up.title = t('ui.aiAgent.moveUp'); up.disabled = i === 0;
      const dn = el('button', 'ai-agent-down', '↓'); dn.title = t('ui.aiAgent.moveDown'); dn.disabled = i === agents.length - 1;
      const ed = el('button', 'ai-agent-edit', t('ui.aiProvider.edit'));
      const del = el('button', 'ai-agent-del', gi('trash')); del.title = t('ui.aiAgent.delete');
      up.onclick = () => { agents = moveAgent(agents, a.id, -1); drawAgents(); };
      dn.onclick = () => { agents = moveAgent(agents, a.id, 1); drawAgents(); };
      ed.onclick = async () => { const r = await agentDialog(a); if (r) { agents = upsertAgent(agents, r); drawAgents(); } };
      del.onclick = async () => {
        const { confirmBox } = await import('../ui.js');
        if (!(await confirmBox(tf('ui.aiAgent.confirmDelete', a.name)))) return;
        agents = removeAgent(agents, a.id);
        drawAgents();
      };
      row.append(info, up, dn, ed, del);
      agList.append(row);
    });
  }
  agAdd.onclick = async () => { const r = await agentDialog(null); if (r) { agents = upsertAgent(agents, r); drawAgents(); } };
  drawAgents();

  // ---- สรุปการใช้งาน ----
  const usage = ai.usage || [];
  if (usage.length) {
    const total = usage.reduce((s, u) => s + (u.tokens || 0), 0);
    const cost = usage.reduce((s, u) => s + (u.usd || 0), 0);
    const stat = el('div', 'dim ai-usage-stat',
      tf('ui.aiProvider.useDoneTokensTimes', fmtNum(total), usage.length, cost.toFixed(4)));
    box.append(stat);
  }

  const btns = el('div', 'k-dlg-btns');
  const cB = el('button', 'k-cancel', t('ui.common.close'));
  const okB = el('button', 'k-ok', t('ui.common.save'));
  btns.append(cB, okB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);

  let rows = listProviders(ai);
  let activeId = ai.activeProviderId || (rows[0] && rows[0].id) || '';

  function refresh() {
    provSel.innerHTML = '';
    for (const p of rows) {
      const o = el('option', null, p.name + (p.model ? ' · ' + p.model : ''));
      o.value = p.id;
      provSel.append(o);
    }
    if (rows.length) provSel.value = activeId || rows[0].id;
    const has = rows.length > 0;
    provSel.style.display = has ? '' : 'none';
    editBtn.disabled = delBtn.disabled = !has;
    empty.style.display = has ? 'none' : '';
    const cur = rows.find((p) => p.id === provSel.value);
    info.textContent = cur
      ? tf('ui.aiProvider.baseURLModel', cur.credential.baseUrl || '—', cur.model || t('ui.aiProvider.notPick')) +
        tf('ui.aiProvider.domainAllow', (cur.credential.allowedDomains || []).join(', ') || t('ui.aiProvider.notRemember'))
      : '';
  }
  // ══ [alpha.170 · บั๊ก 7] ★ รายการผู้ให้บริการบันทึกลงไฟล์ทันทีที่เพิ่ม/แก้/ลบ ══
  // เดิมรอปุ่ม "บันทึก" ของกล่องนี้ — ผู้ใช้กด "บันทึกผู้ให้บริการ" ในป๊อปอัป (เห็นขึ้นในรายการแล้ว)
  // แล้วกด "ปิด" = ผู้ให้บริการหายเงียบ ไม่มีคำเตือน (เจอบนแอปจริง) · คีย์ลงไฟล์ทันทีอยู่แล้ว รายการต้องไปด้วยกัน
  const keepKeysOf = async (list) => {
    try {
      const keys = await loadKeys();
      const used = new Set(list.map((p) => (p.credential || {}).id).filter(Boolean));
      const stale = Object.keys(keys).filter((k) => !used.has(k));
      if (stale.length) { for (const k of stale) delete keys[k]; await saveKeys(keys); }
    } catch (e) { log('warn', 'ai: key cleanup', e); }
  };
  const saveRows = async (msg) => {
    try { await persist(rows, activeId); await keepKeysOf(rows); if (msg) setStatus(msg); return true; }
    catch (e) { log('error', 'ai: save providers failed', e); setStatusError(t('ui.aiProvider.defaultsFail')); return false; }
  };
  provSel.onchange = async () => { activeId = provSel.value; refresh(); await saveRows(); };
  addBtn.onclick = async () => {
    const p = await providerDialog(null);
    if (!p) return;
    rows = upsertProvider(rows, p);
    activeId = p.id;
    refresh(); paintDefaults();
    await saveRows(tf('ui.aiProvider.providerSaved', p.name));
  };
  editBtn.onclick = async () => {
    const cur = rows.find((p) => p.id === provSel.value);
    if (!cur) return;
    const p = await providerDialog(withSecrets(cur, await loadKeys()));
    if (!p) return;
    rows = upsertProvider(rows, p);
    refresh();
    await saveRows(tf('ui.aiProvider.providerSaved', p.name));
  };
  delBtn.onclick = async () => {
    const cur = rows.find((p) => p.id === provSel.value);
    if (!cur) return;
    const { confirmBox } = await import('../ui.js');
    if (!(await confirmBox(tf('ui.aiProvider.delProvider', cur.name)))) return;
    rows = removeProvider(rows, cur.id);
    if (activeId === cur.id) activeId = (rows[0] && rows[0].id) || '';
    refresh(); paintDefaults();
    await saveRows(tf('ui.aiProvider.providerDeleted', cur.name));
  };
  refresh();

  // ชุด "ของฉัน": บอกว่ามีเก็บไว้ไหม · นำเข้า = เพิ่มเฉพาะตัวที่โปรเจกต์ยังไม่มี · บันทึก = แทนที่ชุดที่เก็บไว้
  let defaults = null;
  const paintDefaults = () => {
    const n = defaults && defaults.providers ? defaults.providers.length : 0;
    defImport.disabled = !n;
    defSave.disabled = !rows.length;
    defNote.textContent = n ? tf('ui.aiProvider.defaultsHave', n) : t('ui.aiProvider.defaultsNone');
  };
  const loadDefaults = async () => { try { defaults = kapi.aiDefaultsLoad ? await kapi.aiDefaultsLoad() : null; } catch { defaults = null; } paintDefaults(); };
  loadDefaults();
  defImport.onclick = async () => {
    if (!defaults) return;
    const m = mergeDefaults(rows, defaults);
    if (!m.added) { setStatus(t('ui.aiProvider.defaultsNothingNew')); return; }
    rows = m.rows;
    if (!activeId) activeId = defaults.activeProviderId && rows.some((p) => p.id === defaults.activeProviderId) ? defaults.activeProviderId : rows[0].id;
    // คีย์ลงไฟล์คีย์ของโปรเจกต์ทันที (รายการผู้ให้บริการยังรอปุ่มบันทึกของกล่อง — ยกเลิก = คีย์ถูกเก็บกวาดตอนบันทึกครั้งถัดไป)
    if (Object.keys(m.keys).length) { const keys = await loadKeys(); Object.assign(keys, m.keys); await saveKeys(keys); }
    refresh(); paintDefaults();
    await saveRows();
    setStatus(tf('ui.aiProvider.defaultsImported', m.added));
    log('info', 'ai: defaults imported', { added: m.added, withKeys: Object.keys(m.keys).length });
  };
  defSave.onclick = async () => {
    if (!rows.length || !kapi.aiDefaultsSave) return;
    try {
      const r = await kapi.aiDefaultsSave(packDefaults(rows, await loadKeys(), activeId));
      setStatus(r && r.keysSaved ? tf('ui.aiProvider.defaultsSaved', rows.length) : tf('ui.aiProvider.defaultsSavedNoKeys', rows.length));
      log('info', 'ai: defaults saved', { providers: rows.length, keys: !!(r && r.keysSaved) });
      await loadDefaults();
    } catch (e) { log('warn', 'ai: defaults save failed', e); setStatusError(t('ui.aiProvider.defaultsFail')); }
  };

  // ค่าที่ยังรอปุ่ม "บันทึก" ของกล่องนี้ (ปุ่มส่ง · งบประวัติ · System prompt · Agents) — ปิดทิ้งต้องถามก่อน
  const snap = () => JSON.stringify([sendSel.value, String(Math.max(0, Math.round(Number(histInp.value) || 0))),
                                     spTa.value.trim(), !!spOn.checked, agents]);
  const snap0 = snap();
  const close = () => ov.remove();
  const tryClose = async () => {
    if (snap() !== snap0) {
      const { confirmBox } = await import('../ui.js');
      if (!(await confirmBox(t('ui.common.discardChangesAsk'), t('ui.app.closeNotSave')))) return;
    }
    close();
  };
  cB.onclick = tryClose;
  ov.onclick = (e) => { if (e.target === ov) tryClose(); };
  okB.onclick = async () => {
    aiMeta().sendKey = sendSel.value;
    aiMeta().historyTokens = Math.max(0, Math.round(Number(histInp.value) || 0));
    aiMeta().systemPrompt = spTa.value.trim();
    aiMeta().systemPromptOn = !!spOn.checked;
    aiMeta().agents = agents;
    await persist(rows, activeId);
    // [alpha.149] ลบผู้ให้บริการแล้ว คีย์ของมันต้องไม่ค้างอยู่ใน ai-key.json ต่อไป
    await keepKeysOf(rows);
    close();
    setStatus(t('ui.common.saveSettingsAIDone'));
  };
  return ov;
}

// ══════════════════════════════ UI: ป๊อปอัปผู้ให้บริการ ══════════════════════════════
/**
 * ป๊อปอัปกรอกผู้ให้บริการหนึ่งเจ้า — 4 ส่วนตามที่ผู้ใช้สั่ง
 * @param {object|null} existing แก้ของเดิม (null = สร้างใหม่)
 * @returns {Promise<object|null>} provider ที่กรอกเสร็จ (พร้อม apiKey) หรือ null เมื่อยกเลิก
 */
export function providerDialog(existing) {
  return new Promise((resolve) => {
    const P = existing ? JSON.parse(JSON.stringify(existing)) : newProvider();
    P.params = normalizeParams({ ...defaultParams(), ...(P.params || {}) });

    const ov = el('div', 'k-overlay k-ai-prov-ov');
    ov.style.zIndex = '120';
    const box = el('div', 'k-dialog k-ai-prov');
    box.append(el('div', 'k-dlg-title', existing ? t('ui.aiProvider.editProvider') : t('ui.aiProvider.addProvider')));

    const sec = (n, title) => {
      const s = el('div', 'ai-sec');
      s.append(el('div', 'ai-sec-title', n + '. ' + title));
      box.append(s);
      return s;
    };
    const field = (host, label, node, hint) => {
      const r = el('div', 'ai-field');
      r.append(el('label', null, label));
      r.append(node);
      if (hint) r.append(el('div', 'ai-hint dim', hint));
      host.append(r);
      return node;
    };

    // ── 1. ชื่อ ──
    const s1 = sec(1, t('ui.aiProvider.nameProvider'));
    // [alpha.170] ชุดสำเร็จรูป — เลือกแล้วเติมชื่อ · ที่อยู่ API · รูปแบบ API (เดิมต้องรู้และพิมพ์ Base URL เอง)
    const presetSel = el('select', 'wiki-input k-dlg-select ai-prov-preset');
    { const o = el('option', null, t('ui.aiProvider.presetPick')); o.value = ''; presetSel.append(o); }
    for (const ps of PROVIDER_PRESETS) { const o = el('option', null, ps.name); o.value = ps.id; presetSel.append(o); }
    if (!existing) field(s1, t('ui.aiProvider.preset'), presetSel, t('ui.aiProvider.presetHint'));
    const nameInp = field(s1, t('ui.aiProvider.nameSet'), el('input', 'wiki-input ai-prov-name'),
                          t('ui.aiProvider.nameSeeDropdownEg'));
    nameInp.value = P.name || '';

    // ── 2. Credential ──
    // [alpha.160 · P3] หัวข้อ/ป้ายเคยเป็นอังกฤษฝังโค้ด — ย้ายเข้า CSV (กฎถาวรข้อ 0)
    const s2 = sec(2, t('ui.aiProvider.secCredential'));
    // [alpha.170] ชื่อ Credential เว้นว่างได้ = ใช้ชื่อผู้ให้บริการ (เดิมบังคับตั้งสองชื่อ)
    const credName = field(s2, t('ui.aiProvider.nameCredential'), el('input', 'wiki-input ai-cred-name'),
                           t('ui.aiProvider.credNameHint'));
    credName.value = P.credential.name || '';
    const keyWrap = el('div', 'ai-cred-keywrap');
    const apiInp = el('input', 'wiki-input ai-cred-key');
    apiInp.type = 'password';
    apiInp.value = P.credential.apiKey || '';
    apiInp.placeholder = t('ui.aiProvider.skSkipEmptyNot');
    const eyeBtn = el('button', 'cmp-mini ai-cred-eye', gi('eye'));
    eyeBtn.type = 'button';
    eyeBtn.title = t('ui.aiProvider.showKey');
    eyeBtn.onclick = () => {
      const show = apiInp.type === 'password';
      apiInp.type = show ? 'text' : 'password';
      eyeBtn.textContent = gi(show ? 'eye-off' : 'eye');
      eyeBtn.title = t(show ? 'ui.aiProvider.hideKey' : 'ui.aiProvider.showKey');
    };
    keyWrap.append(apiInp, eyeBtn);
    field(s2, t('ui.aiProvider.apiKey'), keyWrap, tf('ui.aiProvider.keepSplitFolderProject', KEY_FILE));
    const baseInp = field(s2, t('ui.aiProvider.baseUrl'), el('input', 'wiki-input ai-cred-base'));
    baseInp.value = P.credential.baseUrl || '';
    baseInp.placeholder = 'https://api.openai.com/v1';
    // [alpha.170 · บั๊ก 15] รูปแบบ API — เดิมมีแบบเดียว (chat/completions) โมเดล Claude ของเกตเวย์ที่รับสองแบบใช้ไม่ได้
    const apiSel = el('select', 'wiki-input k-dlg-select ai-cred-api');
    const API_LABELS = { openai: 'ui.aiProvider.apiKindOpenai', anthropic: 'ui.aiProvider.apiKindAnthropic' };
    for (const kind of API_KINDS) { const o = el('option', null, t(API_LABELS[kind])); o.value = kind; apiSel.append(o); }
    apiSel.value = apiKindOf(P);
    field(s2, t('ui.aiProvider.apiKind'), apiSel, t('ui.aiProvider.apiKindHint'));
    presetSel.onchange = () => {
      const ps = PROVIDER_PRESETS.find((x) => x.id === presetSel.value);
      if (!ps) return;
      if (!nameInp.value.trim() || PROVIDER_PRESETS.some((x) => x.name === nameInp.value.trim())) nameInp.value = ps.name;
      baseInp.value = ps.baseUrl;
      apiSel.value = ps.api;
    };
    const domInp = field(s2, t('ui.aiProvider.allowedDomains'),
                         el('textarea', 'wiki-input ai-cred-domains'),
                         t('ui.aiProvider.lineNewExampleCom'));
    domInp.rows = 2;
    domInp.value = (P.credential.allowedDomains || []).join(', ');
    domInp.placeholder = 'api.openai.com, *.openai.com';

    const credBtns = el('div', 'ai-cred-btns');
    const testBtn = el('button', 'ai-cred-test', t('ui.aiProvider.testConnect'));
    // [alpha.170] ปุ่มรอง + ข้อความจากไฟล์ภาษา (เดิมเป็นปุ่มหลักสีเดียวกับ "บันทึกผู้ให้บริการ" และเป็นอังกฤษฝังโค้ด)
    const saveCredBtn = el('button', 'ai-cred-save', gi('save') + ' ' + t('ui.aiProvider.saveCredential'));
    const credMsg = el('span', 'ai-cred-msg dim');
    credBtns.append(testBtn, saveCredBtn, credMsg);
    s2.append(credBtns);

    // ── 3. Model (ดึงจาก API) ──
    const s3 = sec(3, t('ui.aiProvider.secModel'));
    const modelSel = field(s3, t('ui.common.model'), el('select', 'wiki-input k-dlg-select ai-model-sel'),
                           t('ui.aiProvider.pressFetchListModel'));
    const modelHint = modelSel.parentElement.querySelector('.ai-hint');
    const modelBtns = el('div', 'ai-model-btns');
    const loadModelsBtn = el('button', 'ai-model-load', t('ui.aiProvider.fetchListModel'));
    const modelMsg = el('span', 'ai-model-msg dim');
    modelBtns.append(loadModelsBtn, modelMsg);
    s3.append(modelBtns);

    function fillModels(list, keep) {
      modelSel.innerHTML = '';
      const models = list && list.length ? list : (P.model ? [P.model] : []);
      // [alpha.170] คำใบ้ตามสภาพจริง — เดิมยังบอกให้ "กดดึงรายชื่อ" ทั้งที่รายชื่อมาแล้ว
      if (modelHint) modelHint.textContent = list && list.length > 1 ? tf('ui.aiProvider.modelsLoaded', list.length)
                                                                     : t('ui.aiProvider.pressFetchListModel');
      if (!models.length) {
        const o = el('option', null, t('ui.aiProvider.notHasListPress'));
        o.value = '';
        modelSel.append(o);
        return;
      }
      for (const m of models) { const o = el('option', null, m); o.value = m; modelSel.append(o); }
      modelSel.value = models.includes(keep) ? keep : models[0];
    }
    fillModels(P.models, P.model);

    // ── 4. Parameters ──
    const s4 = sec(4, t('ui.aiProvider.secParams'));
    const grid = el('div', 'ai-param-grid');
    const inputs = {};
    for (const d of PARAM_DEFS) {
      const cell = el('div', 'ai-param');
      cell.append(el('label', null, d.label + (d.th ? ' — ' + d.th : '')));
      let node;
      if (d.type === 'select') {
        node = el('select', 'wiki-input k-dlg-select');
        for (const opt of d.options) {
          const o = el('option', null, opt === '' ? t('ui.common.notSpecify') : opt);
          o.value = opt;
          node.append(o);
        }
        node.value = P.params[d.key] ?? d.def;
      } else if (d.type === 'kv') {
        node = el('textarea', 'wiki-input ai-param-kv');
        node.rows = 3;
        node.placeholder = t('ui.aiProvider.xHeaderValueLine');
        node.value = Object.entries(P.params[d.key] || {}).map(([k, v]) => k + ': ' + v).join('\n');
      } else {
        node = el('input', 'wiki-input');
        node.type = 'number';
        node.min = String(d.min); node.max = String(d.max);
        if (d.step) node.step = String(d.step);
        node.value = P.params[d.key] === null || P.params[d.key] === undefined ? '' : String(P.params[d.key]);
        node.placeholder = d.def === null ? t('ui.aiProvider.notSendValue') : String(d.def);
      }
      node.dataset.param = d.key;
      inputs[d.key] = node;
      cell.append(node);
      if (d.hint) cell.append(el('div', 'ai-hint dim', d.hint));
      if (d.type === 'kv') cell.classList.add('ai-param-wide');
      grid.append(cell);
    }
    s4.append(grid);

    // ---- เก็บค่าจากฟอร์ม ----
    function readParams() {
      const raw = {};
      for (const d of PARAM_DEFS) {
        const node = inputs[d.key];
        if (d.type === 'kv') {
          const o = {};
          for (const line of String(node.value || '').split('\n')) {
            const i = line.indexOf(':');
            if (i <= 0) continue;
            o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
          }
          raw[d.key] = o;
        } else raw[d.key] = node.value;
      }
      return normalizeParams(raw);
    }
    function collect() {
      return newProvider({
        ...P,
        name: nameInp.value.trim(),
        model: modelSel.value || '',
        models: [...modelSel.options].map((o) => o.value).filter(Boolean),
        credential: {
          ...P.credential,
          name: credName.value.trim() || nameInp.value.trim(),
          apiKey: apiInp.value.trim(),
          baseUrl: baseInp.value.trim(),
          api: apiSel.value,
          allowedDomains: parseDomains(domInp.value),
        },
        params: readParams(),
      });
    }

    // ---- ทดสอบ / ดึงโมเดล / บันทึก credential ----
    let busy = false;
    const setBusy = (on, msgNode, text) => {
      busy = on;
      testBtn.disabled = loadModelsBtn.disabled = on;
      if (msgNode) { msgNode.textContent = text || ''; msgNode.className = msgNode.className.replace(/ ai-(ok|bad)/g, ''); }
    };
    const say = (node, ok, text) => {
      node.textContent = text;
      node.className = node.className.replace(/ ai-(ok|bad)/g, '') + (ok ? ' ai-ok' : ' ai-bad');
    };
    testBtn.onclick = async () => {
      if (busy) return;
      const p = collect();
      // [alpha.128] เดิมกรองด้วยตัวอักษรไทย `e.includes('ชื่อผู้ให้บริการ')` ทั้งที่ข้อความนี้
      // มาจาก `t('ui.aiProviders.cantRenameProvider')` ซึ่งแปลตามภาษา → หน้าจออังกฤษกรองไม่ติด
      // แล้วปุ่ม "ทดสอบ" ถูกบล็อกด้วยข้อผิดพลาดที่ตั้งใจจะข้าม · เทียบกับข้อความตัวเดียวกันแทน
      const errs = validateProviderIssues(p).filter((e) => e.code !== 'name' && e.code !== 'credName').map((e) => e.msg);
      if (errs.length) { say(credMsg, false, errs[0]); return; }
      setBusy(true, credMsg, t('ui.aiProvider.busyTest'));
      const r = await testCredential(p, { model: modelSel.value });
      setBusy(false);
      say(credMsg, r.ok, (r.ok ? gi('check-circle') + ' ' : gi('fail') + ' ') + r.msg
        + (r.chat && !r.ok && r.chat.hints && r.chat.hints[0] ? ' — ' + r.chat.hints[0] : '')
        // [trial 2026-10-25 ข้อ 12] ข้อความจริงของเซิร์ฟเวอร์ (เช่น ชื่อ header ที่ขาด) — ผู้ใช้ต้องเห็นเพื่อแก้เองได้
        + (r.chat && !r.ok && r.chat.serverMessage ? ' · ' + t('ui.aiError.reply') + clip(r.chat.serverMessage, 240) : ''));
      if (r.models.length) fillModels(r.models, modelSel.value);
    };
    loadModelsBtn.onclick = async () => {
      if (busy) return;
      const p = collect();
      setBusy(true, modelMsg, t('ui.aiProvider.busyFetchListModel'));
      const r = await fetchModels(p);
      setBusy(false);
      if (r.ok) { fillModels(r.models, modelSel.value); say(modelMsg, true, tf('ui.aiProvider.foundModel', r.models.length)); }
      else say(modelMsg, false, gi('fail') + ' ' + r.error);
    };
    saveCredBtn.onclick = async () => {
      const p = collect();
      const errs = validateProviderIssues(p).filter((e) => e.code !== 'name' && e.code !== 'credName').map((e) => e.msg);
      if (errs.length) { say(credMsg, false, errs[0]); return; }
      const keys = await loadKeys();
      keys[p.credential.id] = p.credential.apiKey;
      await saveKeys(keys);
      P.credential = { ...p.credential };
      say(credMsg, true, t('ui.aiProvider.saveCredentialDoneKey') + KEY_FILE + ')');
    };

    // ---- ปุ่มท้ายกล่อง ----
    const errBox = el('div', 'ai-prov-err');
    box.append(errBox);
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', 'k-cancel', t('ui.common.cancel'));
    const ok = el('button', 'k-ok', t('ui.aiProvider.saveProvider'));
    btns.append(cancel, ok);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    nameInp.focus();

    const done = (v) => { ov.remove(); document.removeEventListener('keydown', esc, true); resolve(v); };
    function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); done(null); } }
    document.addEventListener('keydown', esc, true);
    cancel.onclick = () => done(null);
    ok.onclick = async () => {
      const p = collect();
      const errs = validateProvider(p);
      if (errs.length) { errBox.textContent = gi('warning') + ' ' + errs.join(' · '); return; }
      const keys = await loadKeys();
      keys[p.credential.id] = p.credential.apiKey;
      await saveKeys(keys);
      done(stripSecrets(p));                 // ผู้เรียกเก็บลง project.khn.json — ไม่มีคีย์ปน
    };
  });
}
