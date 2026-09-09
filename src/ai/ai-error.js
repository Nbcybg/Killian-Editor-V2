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
import { T, tm } from '../i18n.js';

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
    return { key: 'refused', reason: T`เครื่องปลายทางปฏิเสธการเชื่อมต่อ (ไม่มีอะไรฟังอยู่ที่พอร์ตนั้น)`,
      hints: [T`ถ้าเป็นโมเดลในเครื่อง (Ollama / LM Studio / llama.cpp) — เปิดโปรแกรมนั้นให้ทำงานอยู่ก่อน`,
              T`ตรวจเลขพอร์ตใน Base URL ให้ตรงกับที่โปรแกรมนั้นเปิดจริง`] };
  }
  if (/ENOTFOUND|getaddrinfo|DNS/i.test(s)) {
    return { key: 'dns', reason: T`หาชื่อโดเมนไม่เจอ (DNS)`,
      hints: [T`ตรวจว่าพิมพ์ Base URL ถูกต้อง`, T`ตรวจว่าเครื่องต่ออินเทอร์เน็ตอยู่`] };
  }
  if (/certificate|SSL|TLS|self[- ]signed/i.test(s)) {
    return { key: 'tls', reason: T`ใบรับรองความปลอดภัย (TLS) ของปลายทางใช้ไม่ได้`,
      hints: [T`เซิร์ฟเวอร์ในเครือข่ายภายในมักใช้ใบรับรองที่ออกเอง — ลองใช้ http:// แทน https:// ถ้าเป็นเครื่องในบ้าน`] };
  }
  if (/ETIMEDOUT|ECONNRESET|EPIPE|socket hang up|network|fetch failed/i.test(s)) {
    return { key: 'net', reason: T`ต่อกับเซิร์ฟเวอร์ไม่ติด (เครือข่ายขาดกลางทาง)`,
      hints: [T`ตรวจอินเทอร์เน็ต / VPN / ไฟร์วอลล์`,
              T`ถ้าเป็นเครื่องในบ้าน ลองเปิด Base URL ในเบราว์เซอร์ดูว่าตอบไหม`] };
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
    reason = T`หมดเวลารอคำตอบ`;
    hints = [T`เพิ่มค่า Timeout ใน ตั้งค่า AI → แก้ผู้ให้บริการ → Parameters`,
             T`โมเดลที่คิดเยอะ (reasoning) ใช้เวลานาน — ลดระดับการใช้ความคิด หรือลดความยาวคำตอบ`];
  } else if (e.aborted) {
    code = 'aborted';
    reason = T`ผู้ใช้กดหยุดเอง`;
    hints = [];
  } else if (status === 0) {
    const k = networkKind(srvMsg || rawBody || e.error);
    code = k ? 'net-' + k.key : 'net';
    reason = k ? k.reason : (srvMsg || T`ยังติดต่อเซิร์ฟเวอร์ไม่ได้เลย (คำขอไปไม่ถึงปลายทาง)`);
    hints = k ? k.hints : [T`ตรวจ Base URL · อินเทอร์เน็ต · ไฟร์วอลล์`,
                           T`ตรวจว่าโดเมนอยู่ใน Allowed HTTP Request Domains ของผู้ให้บริการ`];
  } else if (status === 401 || status === 403) {
    reason = T`เซิร์ฟเวอร์ไม่รับกุญแจ (API key) ที่ส่งไป`;
    hints = [T`ใส่คีย์ใหม่ที่ ตั้งค่า AI → แก้ผู้ให้บริการ → Credential แล้วกด 💾 Save Credential`,
             T`คีย์บางเจ้าผูกกับองค์กร/โครงการ — ตรวจว่าคีย์นี้ใช้กับ Base URL นี้ได้จริง`];
  } else if (status === 404) {
    reason = T`ปลายทางไม่มีอยู่จริง (404)`;
    hints = [T`Base URL มักต้องลงท้ายด้วย /v1 — ตรวจให้ตรงกับคู่มือของผู้ให้บริการ`,
             T`ตรวจชื่อโมเดล: กด "ดึงรายชื่อโมเดล" แล้วเลือกจากรายการแทนการพิมพ์เอง`];
  } else if (status === 408) {
    reason = T`เซิร์ฟเวอร์บอกว่าคำขอใช้เวลานานเกินไป`;
    hints = [T`ลองใหม่อีกครั้ง หรือเพิ่ม Max Retries ใน Parameters`];
  } else if (status === 429) {
    reason = T`ยิงถี่เกินโควตา หรือเครดิตหมด (429)`;
    hints = [T`รอสักครู่แล้วลองใหม่`, T`ตรวจยอดเครดิต/โควตาในหน้าผู้ให้บริการ`,
             T`เพิ่ม Max Retries ใน Parameters ให้ระบบถอยแล้วลองเองอัตโนมัติ`];
  } else if (status === 400 || status === 422) {
    reason = T`ผู้ให้บริการไม่รับพารามิเตอร์ที่ส่งไป (${String(status)})`;
    hints = [T`ดูข้อความของเซิร์ฟเวอร์ด้านล่าง — มักบอกชื่อฟิลด์ที่ผิดมาตรง ๆ`,
             T`ตัวที่ผิดบ่อย: Max Tokens สูงเกินที่โมเดลรับ · Reasoning Effort / Thinking mode ที่โมเดลนี้ไม่มี · Response Format = json_object`];
  } else if (status >= 500) {
    reason = T`ฝั่งผู้ให้บริการมีปัญหา (${String(status)})`;
    hints = [T`รอสักครู่แล้วลองใหม่ — ไม่ใช่ปัญหาที่เครื่องเรา`];
  } else {
    reason = T`เรียกไม่สำเร็จ (HTTP ${String(status)})`;
    hints = [];
  }

  const title = status ? tm('AI: {0} (HTTP {1})', reason, String(status))
                       : tm('AI: {0}', reason);
  const lines = [];
  if (e.provider) lines.push(T`ผู้ให้บริการ: ` + e.provider);
  if (e.model) lines.push(T`โมเดล: ` + e.model);
  if (host) lines.push(T`ปลายทาง: ` + host);
  if (e.url) lines.push('URL: ' + redactSecrets(e.url));
  lines.push('HTTP: ' + (status || T`ไปไม่ถึงเซิร์ฟเวอร์`));
  if (srvMsg) lines.push(T`เซิร์ฟเวอร์ตอบ: ` + clip(srvMsg));
  else if (rawBody) lines.push(T`เนื้อคำตอบ: ` + clip(rawBody));
  if (e.error && e.error !== reason) lines.push(T`ข้อความภายใน: ` + redactSecrets(String(e.error)));
  if (hints.length) lines.push('', T`แนวทางแก้:`, ...hints.map((h, i) => (i + 1) + '. ' + h));
  return { title, reason, hints, detail: lines.join('\n'), code, serverMessage: srvMsg, host, status };
}

/** บรรทัดเดียวสำหรับแถบสถานะ/บันทึก (ไม่มีขึ้นบรรทัดใหม่) */
export function shortError(info) {
  const parts = [info.reason];
  if (info.serverMessage) parts.push(clip(info.serverMessage, 160));
  return parts.filter(Boolean).join(' — ').replace(/\s+/g, ' ');
}
