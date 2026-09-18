// ai-error.js — [alpha.145] "เรียกไม่สำเร็จ (HTTP 0)" ต้องบอกให้ได้ว่าเกิดอะไรและทำยังไงต่อ
//
// ผู้ใช้: *"error ขึ้นแค่ ⚠ เรียกไม่สำเร็จ (HTTP 0) แต่ไม่รู้ว่าคืออะไรและแนวทางแก้ไข
//          log ก็ไม่ได้เก็บอะไรเลย"*
//
// ต้นตอ (ไล่จากปลายทางกลับมา):
//   · `main.js → http:stream` เวลาพัง **คืนเหตุผลจริงมาให้แล้ว** ใน `body`
//     (`fetch failed` · `ECONNREFUSED` · `certificate` …) และเวลาเซิร์ฟเวอร์ตอบ 4xx/5xx
//     ก็แนบ **ข้อความของเซิร์ฟเวอร์** มาใน `body` ด้วย
//   · แต่ `completeStream()` เรียก `httpMsg(res.status || 0)` ซึ่งดู **แค่ตัวเลข status**
//     แล้วโยน `body` ทิ้งทั้งก้อน → ทุกความผิดพลาดของชั้นเครือข่ายยุบเหลือ "HTTP 0" เท่ากันหมด
//
// ไฟล์นี้เป็น **โมดูลบริสุทธิ์** (ไม่แตะ DOM/fs/network) → unit test ได้ตรง ๆ
// หน้าที่: เอา { status, body, error, url, aborted, timedOut } มาแปลงเป็น
//   { title, reason, hints[], detail } ที่เอาไปโชว์บนจอ **และ** เขียนลงบันทึกได้ทันที
import { tf, T, tm, t } from '../i18n.js';

/** ปิดบังความลับก่อนขึ้นจอ/ลงไฟล์บันทึก — คีย์ห้ามรั่วออกจากเครื่องผู้ใช้เด็ดขาด */
export function redactSecrets(text) {
  return String(text ?? '')
    .replace(/\b(sk|xai|gsk|pplx|or)-[A-Za-z0-9_-]{6,}/g, '$1-••••')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1••••')
    .replace(/("?(?:api[_-]?key|x-api-key|authorization)"?\s*[:=]\s*"?)[^"'\s,}]{8,}/gi, '$1••••')
    // คีย์ที่ห้อยมากับ URL (บางเจ้ารับผ่าน query string) — ต้องล้างก่อนขึ้นจอ/ลงบันทึกด้วย
    .replace(/([?&](?:api[_-]?key|key|token|access[_-]?token|auth)=)[^&\s]+/gi, '$1••••');
}

/** ตัดข้อความยาว ๆ ให้พอดีกล่อง (เก็บหัวไว้ — ข้อความจริงของเซิร์ฟเวอร์อยู่ต้นเสมอ) */
export function clip(text, max = 600) {
  const s = String(text ?? '').trim();
  return s.length > max ? s.slice(0, max) + ' …' : s;
}

/**
 * ข้อความผิดพลาดของเซิร์ฟเวอร์ — แต่ละเจ้าห่อคนละชั้น ลองทุกสำนวนที่ใช้กันจริง
 * OpenAI `{error:{message}}` · Anthropic `{error:{message}}` · Ollama `{error:"…"}`
 * · บางเจ้า `{message}` · บางเจ้าโยน HTML/ข้อความเปล่ามาเลย
 * @returns {string} '' = อ่านไม่ออก (ผู้เรียกใช้ body ดิบแทน)
 */
export function serverMessage(body) {
  const raw = String(body ?? '').trim();
  if (!raw) return '';
  let d = null;
  try { d = JSON.parse(raw); } catch { /* ไม่ใช่ JSON — ใช้ข้อความดิบ */ }
  if (d && typeof d === 'object') {
    const e = d.error;
    if (typeof e === 'string' && e.trim()) return e.trim();
    if (e && typeof e === 'object') {
      const m = e.message || e.detail || e.type || '';
      const code = e.code ? ' [' + e.code + ']' : '';
      if (String(m).trim()) return String(m).trim() + code;
    }
    for (const k of ['message', 'detail', 'msg', 'reason']) {
      if (typeof d[k] === 'string' && d[k].trim()) return d[k].trim();
    }
    return '';
  }
  // HTML (พร็อกซี/เกตเวย์ตอบหน้าเว็บมา) — เอาแต่ตัวหนังสือ ไม่งั้นเต็มจอด้วยแท็ก
  if (/^\s*</.test(raw)) return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return raw;
}

/** โฮสต์ของ URL แบบไม่โยน */
export function hostOf(url) {
  try { return new URL(String(url)).host; } catch { return ''; }
}

/**
 * ระดับเครือข่าย: ข้อความของ Node/Chromium บอกอะไรได้บ้าง
 * @returns {{key:string, reason:string, hints:string[]}|null}
 */
function networkKind(text) {
  const s = String(text || '');
  if (/ECONNREFUSED|Connection refused/i.test(s)) {
    return { key: 'refused', reason: t('ui.aiError.toConnectNotHas'),
      hints: [t('ui.aiError.modelOllamaLMStudio'),
              t('ui.aiError.checkNumBaseURL')] };
  }
  if (/ENOTFOUND|getaddrinfo|DNS/i.test(s)) {
    return { key: 'dns', reason: t('ui.aiError.findNameDomainNot'),
      hints: [t('ui.aiError.checkPrintBaseURL'), t('ui.aiError.checkNext')] };
  }
  if (/certificate|SSL|TLS|self[- ]signed/i.test(s)) {
    return { key: 'tls', reason: t('ui.aiError.itemTLSToUse'),
      hints: [t('ui.aiError.innerUseItemOut')] };
  }
  if (/ETIMEDOUT|ECONNRESET|EPIPE|socket hang up|network|fetch failed/i.test(s)) {
    return { key: 'net', reason: t('ui.aiError.nextNotMissingCenter'),
      hints: [t('ui.aiError.checkVPN'),
              t('ui.aiError.tryOpenBaseURL')] };
  }
  return null;
}

/**
 * แปลงความล้มเหลวหนึ่งครั้งเป็นคำอธิบายที่ผู้ใช้ทำอะไรต่อได้
 *
 * @param {object} e
 *   status    รหัส HTTP (0 = ยังไปไม่ถึงเซิร์ฟเวอร์)
 *   body      เนื้อคำตอบของเซิร์ฟเวอร์ **หรือ** ข้อความผิดพลาดของชั้นเครือข่าย
 *   error     ข้อความผิดพลาดที่ชั้นบนมีอยู่แล้ว (ถ้ามี)
 *   url       ปลายทางที่ยิงไป
 *   provider  ชื่อผู้ให้บริการที่ผู้ใช้ตั้ง
 *   model     โมเดลที่ใช้
 *   aborted / timedOut
 * @returns {{title:string, reason:string, hints:string[], detail:string, code:string}}
 */
export function describeHttpError(e = {}) {
  const status = Number(e.status) || 0;
  const rawBody = redactSecrets(String(e.body ?? ''));
  const srvMsg = serverMessage(rawBody);
  const host = hostOf(e.url);
  let reason = '';
  let hints = [];
  let code = 'http-' + status;

  if (e.aborted && e.timedOut) {
    code = 'timeout';
    reason = t('ui.aiError.timeAnswer');
    hints = [t('ui.aiError.addValueTimeoutSettings'),
             t('ui.aiError.modelThinkReasoningUse')];
  } else if (e.aborted) {
    code = 'aborted';
    reason = t('ui.aiError.userPress');
    hints = [];
  } else if (e.streamError) {
    // [alpha.149] ผู้ให้บริการตอบ 200 แล้วส่งข้อผิดพลาดมาเป็นก้อนหนึ่งในสตรีม (เครดิตหมด · ถูกปฏิเสธ)
    code = 'stream-error';
    reason = t('ui.aiError.streamReason');
    hints = [t('ui.aiError.streamHintServer'), t('ui.aiError.streamHintCredit')];
  } else if (status === 0) {
    const k = networkKind(srvMsg || rawBody || e.error);
    code = k ? 'net-' + k.key : 'net';
    reason = k ? k.reason : (srvMsg || t('ui.aiError.nextCantWordNot'));
    hints = k ? k.hints : [t('ui.aiError.checkBaseURL'),
                           t('ui.aiError.checkDomainAllowedHTTP')];
  } else if (status === 401 || status === 403) {
    reason = t('ui.aiError.notAPIKeySend');
    hints = [t('ui.aiError.putKeyNewSettings'),
             t('ui.aiError.keyBindOutlineCheck')];
  } else if (status === 404) {
    reason = t('ui.aiError.toNotHas');
    hints = [t('ui.aiError.baseURLMustV1'),
             t('ui.aiError.checkNameModelPress')];
  } else if (status === 408) {
    reason = t('ui.aiError.wordUseTime');
    hints = [t('ui.aiError.tryNewTimesAdd')];
  } else if (status === 429) {
    reason = t('ui.aiError.msg');
    hints = [t('ui.aiError.doneTryNew'), t('ui.aiError.checkPageProvider'),
             t('ui.aiError.addMaxRetriesParameters')];
  } else if (status === 400 || status === 422) {
    reason = tf('ui.aiError.providerNotParamSend', String(status));
    hints = [t('ui.aiError.viewTextBottomName'),
             t('ui.aiError.itemMaxTokensHigh')];
  } else if (status >= 500) {
    reason = tf('ui.aiError.sideProviderHasProblem', String(status));
    hints = [t('ui.aiError.doneTryNewNot')];
  } else {
    reason = tf('ui.aiError.callNotOkHTTP', String(status));
    hints = [];
  }

  const title = status ? tm('AI: {0} (HTTP {1})', reason, String(status))
                       : tm('AI: {0}', reason);
  const lines = [];
  if (e.provider) lines.push(t('ui.aiError.provider') + e.provider);
  if (e.model) lines.push(t('ui.aiError.model') + e.model);
  if (host) lines.push(t('ui.aiError.to') + host);
  if (e.url) lines.push('URL: ' + redactSecrets(e.url));
  lines.push('HTTP: ' + (status || t('ui.aiError.notTo')));
  if (srvMsg) lines.push(t('ui.aiError.reply') + clip(srvMsg));
  else if (rawBody) lines.push(t('ui.aiError.bodyAnswer') + clip(rawBody));
  if (e.error && e.error !== reason) lines.push(t('ui.aiError.textInner') + redactSecrets(String(e.error)));
  if (hints.length) lines.push('', t('ui.aiError.edit'), ...hints.map((h, i) => (i + 1) + '. ' + h));
  return { title, reason, hints, detail: lines.join('\n'), code, serverMessage: srvMsg, host, status };
}

/** บรรทัดเดียวสำหรับแถบสถานะ/บันทึก (ไม่มีขึ้นบรรทัดใหม่) */
export function shortError(info) {
  const parts = [info.reason];
  if (info.serverMessage) parts.push(clip(info.serverMessage, 160));
  return parts.filter(Boolean).join(' — ').replace(/\s+/g, ' ');
}
