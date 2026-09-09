// ai-provider-ui.js — [alpha.61 ข้อ 2] หน้าตั้งค่า AI แบบใหม่
//
// ผู้ให้บริการไม่ใช่รายการสำเร็จรูปอีกต่อไป — เป็น dropdown ของ "เจ้าที่ผู้ใช้เพิ่มเอง"
// กด ➕ แล้วได้ป๊อปอัปกรอก 4 ส่วนตามลำดับ: ชื่อ → Credential → Model → Parameters
//
// ตรรกะทั้งหมด (validate · สร้างคำขอ · อ่านคำตอบ) อยู่ใน ai-providers.js ซึ่งเป็นโมดูลบริสุทธิ์
// ไฟล์นี้ทำแค่ "วาดและยิงคำขอ" เท่านั้น

import { t, tf } from '../i18n.js';
import { $, el, state, setStatus, log, setBusy, clearBusy } from '../core.js';
import {
  PARAM_DEFS, defaultParams, normalizeParams, parseDomains, isDomainAllowed,
  newProvider, validateProvider, stripSecrets, withSecrets,
  modelsRequests, parseModels, chatRequest, parseChat, parseStreamChunk,
  listProviders, activeProvider, upsertProvider, removeProvider,
} from './ai-providers.js';
import { SEND_KEYS, DEFAULT_SEND_KEY, estimateTokens } from './ai-session.js';
// [alpha.145] คำอธิบายความล้มเหลวที่ผู้ใช้ทำอะไรต่อได้ (โมดูลบริสุทธิ์ · unit test แยก)
import { describeHttpError, shortError, redactSecrets } from './ai-error.js';

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
/** ผู้ให้บริการที่เลือกใช้อยู่ พร้อมคีย์จริง (null = ยังไม่ได้ตั้งค่าอะไรเลย) */
export async function currentProvider() {
  const p = activeProvider(aiMeta());
  if (!p) return null;
  return withSecrets(p, await loadKeys());
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
  const backoff = (n) => Math.min(8000, 500 * Math.pow(2, n));
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

/** ทดสอบการเชื่อมต่อของ Credential (ใช้รายชื่อโมเดลเป็นตัววัด — ถูกและไม่เสียเงิน) */
export async function testCredential(provider) {
  const r = await fetchModels(provider);
  return r.ok ? { ok: true, msg: tf('ui.aiProvider.connectOkFoundModel', r.models.length), models: r.models }
              : { ok: false, msg: r.error, models: [] };
}

/** คุยกับโมเดลหนึ่งรอบ — ไม่โยน error ตลอด (คืน {ok,text,usage,error}) */
export async function complete(provider, opts = {}) {
  if (!provider) return { ok: false, text: '', error: t('ui.aiProvider.cantSettingsProviderAI') };
  if (!provider.model && !opts.model) return { ok: false, text: '', error: t('ui.aiProvider.cantPickModel') };
  const req = chatRequest(provider, opts);
  // [alpha.96] ส่งต่อชื่อคำขอ + เพดานเวลา เพื่อให้กด "หยุด" ได้จริง
  if (opts.reqId) req.reqId = opts.reqId;
  if (opts.timeoutMs) req.timeoutMs = opts.timeoutMs;
  const t0 = Date.now();
  const res = await sendRequest(provider, req);
  if (!res.ok) {
    return { ok: false, text: '', error: res.error, detail: res.detail, hints: res.hints,
             code: res.code, status: res.status,
             aborted: !!res.aborted, timedOut: !!res.timedOut };
  }
  const { text, thinking, usage } = parseChat(res.json);
  logCall(provider, req, { ms: Date.now() - t0, usage, chars: (text || '').length, stream: false });
  return { ok: true, text, thinking, usage, model: req.body.model, provider: provider.name };
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
  if (!provider.model && !opts.model) return { ok: false, text: '', error: t('ui.aiProvider.cantPickModel') };
  if (typeof kapi.httpStream !== 'function') {
    const r = await complete(provider, opts);
    if (r.ok && r.text) onChunk({ delta: r.text, thinking: r.thinking || '', text: r.text, thinkingAll: r.thinking || '' });
    return r;
  }
  const req = chatRequest(provider, { ...opts, stream: true });
  if (opts.reqId) req.reqId = opts.reqId;
  if (opts.timeoutMs) req.timeoutMs = opts.timeoutMs;
  if (!isDomainAllowed(req.url, (provider.credential || {}).allowedDomains || [])) {
    return failure(provider, req, { status: 0, blocked: true,
      body: t('ui.aiProvider.domainNotListAllowed') + req.url });
  }
  const who = provider.name || hostOf(req.url);
  const httpOpts = { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) };
  if (req.reqId) httpOpts.__reqId = req.reqId;
  if (req.timeoutMs) httpOpts.__timeoutMs = req.timeoutMs;
  let text = '';
  let thinking = '';
  const streamT0 = Date.now();
  try {
    setBusy(tf('ui.aiProvider.busyNext', who));
    const res = await kapi.httpStream(req.url, httpOpts, (line) => {
      const c = parseStreamChunk(line);
      if (!c) return;
      if (c.done) return;
      if (c.thinking) thinking += c.thinking;
      if (c.delta) text += c.delta;
      onChunk({ delta: c.delta || '', thinking: c.thinking || '', text, thinkingAll: thinking });
    });
    if (res && res.ok === false) {
      // ══ [alpha.145] ★ ต้นตอของ "⚠ เรียกไม่สำเร็จ (HTTP 0)" ที่ผู้ใช้เจอ ══
      // main.js แนบเหตุผลจริงมาใน `res.body` ตลอด (ข้อความเซิร์ฟเวอร์ · ECONNREFUSED · …)
      // แต่บรรทัดนี้เคยส่งแค่ `httpMsg(status)` แล้วทิ้ง body ทั้งก้อน
      const f = failure(provider, req, { status: res.status || 0, body: res.body || res.error || '',
                                         aborted: !!res.aborted, timedOut: !!res.timedOut });
      return { ...f, text, thinking };
    }
    const usage = {
      input: estimateTokens((opts.messages || []).reduce((n, m) => n + (m.content || ''), '') + (opts.system || '')),
      output: estimateTokens(text), reasoning: estimateTokens(thinking), cached: 0, total: 0,
    };
    usage.total = usage.input + usage.output;
    logCall(provider, req, { ms: Date.now() - streamT0, usage, chars: text.length, stream: true });
    return { ok: true, text: text.trim(), thinking, usage, model: req.body.model, provider: provider.name };
  } catch (e) {
    const f = failure(provider, req, { status: 0, body: String((e && e.message) || e) });
    return { ...f, text, thinking };
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
  const delBtn = el('button', 'ai-prov-del', '🗑');
  delBtn.title = t('ui.aiProvider.delProvider2');
  provRow.append(provSel, addBtn, editBtn, delBtn);
  box.append(provRow);

  const info = el('div', 'ai-prov-info dim');
  box.append(info);

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

  // ---- สรุปการใช้งาน ----
  const usage = ai.usage || [];
  if (usage.length) {
    const total = usage.reduce((s, u) => s + (u.tokens || 0), 0);
    const cost = usage.reduce((s, u) => s + (u.usd || 0), 0);
    const stat = el('div', 'dim ai-usage-stat',
      tf('ui.aiProvider.useDoneTokensTimes', total.toLocaleString(), usage.length, cost.toFixed(4)));
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
  provSel.onchange = () => { activeId = provSel.value; refresh(); };
  addBtn.onclick = async () => {
    const p = await providerDialog(null);
    if (!p) return;
    rows = upsertProvider(rows, p);
    activeId = p.id;
    refresh();
  };
  editBtn.onclick = async () => {
    const cur = rows.find((p) => p.id === provSel.value);
    if (!cur) return;
    const p = await providerDialog(withSecrets(cur, await loadKeys()));
    if (!p) return;
    rows = upsertProvider(rows, p);
    refresh();
  };
  delBtn.onclick = async () => {
    const cur = rows.find((p) => p.id === provSel.value);
    if (!cur) return;
    const { confirmBox } = await import('../ui.js');
    if (!(await confirmBox(tf('ui.aiProvider.delProvider', cur.name)))) return;
    rows = removeProvider(rows, cur.id);
    if (activeId === cur.id) activeId = (rows[0] && rows[0].id) || '';
    refresh();
  };
  refresh();

  const close = () => ov.remove();
  cB.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  okB.onclick = async () => {
    aiMeta().sendKey = sendSel.value;
    aiMeta().historyTokens = Math.max(0, Math.round(Number(histInp.value) || 0));
    await persist(rows, activeId);
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
    const nameInp = field(s1, t('ui.aiProvider.nameSet'), el('input', 'wiki-input ai-prov-name'),
                          t('ui.aiProvider.nameSeeDropdownEg'));
    nameInp.value = P.name || '';

    // ── 2. Credential ──
    const s2 = sec(2, 'Credential');
    const credName = field(s2, t('ui.aiProvider.nameCredential'), el('input', 'wiki-input ai-cred-name'));
    credName.value = P.credential.name || '';
    const apiInp = field(s2, 'API', el('input', 'wiki-input ai-cred-key'),
                         tf('ui.aiProvider.keepSplitFolderProject', KEY_FILE));
    apiInp.type = 'password';
    apiInp.value = P.credential.apiKey || '';
    apiInp.placeholder = t('ui.aiProvider.skSkipEmptyNot');
    const baseInp = field(s2, 'Base URL', el('input', 'wiki-input ai-cred-base'));
    baseInp.value = P.credential.baseUrl || '';
    baseInp.placeholder = 'https://api.openai.com/v1';
    const domInp = field(s2, 'Allowed HTTP Request Domains',
                         el('textarea', 'wiki-input ai-cred-domains'),
                         t('ui.aiProvider.lineNewExampleCom'));
    domInp.rows = 2;
    domInp.value = (P.credential.allowedDomains || []).join(', ');
    domInp.placeholder = 'api.openai.com, *.openai.com';

    const credBtns = el('div', 'ai-cred-btns');
    const testBtn = el('button', 'ai-cred-test', t('ui.aiProvider.testConnect'));
    const saveCredBtn = el('button', 'k-ok ai-cred-save', '💾 Save Credential');
    const credMsg = el('span', 'ai-cred-msg dim');
    credBtns.append(testBtn, saveCredBtn, credMsg);
    s2.append(credBtns);

    // ── 3. Model (ดึงจาก API) ──
    const s3 = sec(3, 'Model');
    const modelSel = field(s3, t('ui.common.model'), el('select', 'wiki-input k-dlg-select ai-model-sel'),
                           t('ui.aiProvider.pressFetchListModel'));
    const modelBtns = el('div', 'ai-model-btns');
    const loadModelsBtn = el('button', 'ai-model-load', t('ui.aiProvider.fetchListModel'));
    const modelMsg = el('span', 'ai-model-msg dim');
    modelBtns.append(loadModelsBtn, modelMsg);
    s3.append(modelBtns);

    function fillModels(list, keep) {
      modelSel.innerHTML = '';
      const models = list && list.length ? list : (P.model ? [P.model] : []);
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
    const s4 = sec(4, 'Parameters');
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
          name: credName.value.trim(),
          apiKey: apiInp.value.trim(),
          baseUrl: baseInp.value.trim(),
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
      const errs = validateProvider(p).filter((e) => e !== t('ui.aiProviders.cantRenameProvider'));
      if (errs.length) { say(credMsg, false, errs[0]); return; }
      setBusy(true, credMsg, t('ui.aiProvider.busyTest'));
      const r = await testCredential(p);
      setBusy(false);
      say(credMsg, r.ok, (r.ok ? '✅ ' : '❌ ') + r.msg);
      if (r.ok && r.models.length) fillModels(r.models, modelSel.value);
    };
    loadModelsBtn.onclick = async () => {
      if (busy) return;
      const p = collect();
      setBusy(true, modelMsg, t('ui.aiProvider.busyFetchListModel'));
      const r = await fetchModels(p);
      setBusy(false);
      if (r.ok) { fillModels(r.models, modelSel.value); say(modelMsg, true, tf('ui.aiProvider.foundModel', r.models.length)); }
      else say(modelMsg, false, '❌ ' + r.error);
    };
    saveCredBtn.onclick = async () => {
      const p = collect();
      const errs = validateProvider(p).filter((e) => e !== t('ui.aiProviders.cantRenameProvider'));
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
      if (errs.length) { errBox.textContent = '⚠ ' + errs.join(' · '); return; }
      const keys = await loadKeys();
      keys[p.credential.id] = p.credential.apiKey;
      await saveKeys(keys);
      done(stripSecrets(p));                 // ผู้เรียกเก็บลง project.khn.json — ไม่มีคีย์ปน
    };
  });
}
