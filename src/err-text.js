// err-text.js — [alpha.162 · W4] ★ ข้อความผิดพลาดที่ "ผู้ใช้อ่านแล้วรู้ว่าต้องทำอะไรต่อ"
//
// ══ ต้นตอ ══
// ทั่วโปรแกรมมีแบบแผนเดียวกันซ้ำ ๆ: `setStatus(t('ui.x.fail') + e.message)` — ซึ่งเอา
// **ข้อความของระบบปฏิบัติการดิบ ๆ** ขึ้นจอ เช่น
//     EPERM: operation not permitted, rename 'C:\…'
//     ENOENT: no such file or directory, open 'C:\…'
// ผู้ใช้ไทยที่เขียนนิยายอ่านแล้วไม่ได้อะไรเลย (และบางข้อความยาวจนดันแถบสถานะจนล้น)
// ที่แย่กว่านั้นคือ **มันเป็นภาษาอังกฤษเสมอ** ไม่ว่าจะตั้งภาษาอะไรไว้
//
// โมดูลนี้บริสุทธิ์ 100% (ไม่แตะ DOM/fs/network) — unit test ได้ตรง ๆ
// หน้าที่: `errText(e)` → ประโยคเดียวที่แปลแล้ว · ไม่รู้จัก = คืนข้อความเดิมแบบตัดสั้น+ปิดบังความลับ
// (ของเดิมยังดีกว่าไม่มีอะไรเลย — แต่ต้นตอที่รู้จักจะได้ประโยคที่บอกทางแก้)
import { t } from './i18n.js';
import { redactSecrets, clip } from './ai/ai-error.js';

/** รหัสข้อผิดพลาดของระบบไฟล์ที่เจอจริงบน Windows/macOS/Linux → คีย์ข้อความ */
const CODE_KEY = {
  ENOENT: 'ui.err.notFound',
  EACCES: 'ui.err.denied',
  EPERM: 'ui.err.denied',
  EBUSY: 'ui.err.busy',
  ETXTBSY: 'ui.err.busy',
  ENOSPC: 'ui.err.noSpace',
  EDQUOT: 'ui.err.noSpace',
  EROFS: 'ui.err.readOnly',
  EISDIR: 'ui.err.isDir',
  ENOTDIR: 'ui.err.isDir',
  EMFILE: 'ui.err.tooManyFiles',
  ENFILE: 'ui.err.tooManyFiles',
  ECONNREFUSED: 'ui.err.network',
  ECONNRESET: 'ui.err.network',
  ETIMEDOUT: 'ui.err.network',
  ENOTFOUND: 'ui.err.network',
  EAI_AGAIN: 'ui.err.network',
};

/**
 * รหัสของข้อผิดพลาด — `e.code` ก่อน แล้วค่อยแกะจากข้อความ (Electron/Node ห่อมาหลายชั้น)
 * @returns {string} '' = อ่านไม่ออก
 */
export function errCode(e) {
  if (!e) return '';
  const direct = String(e.code || '').toUpperCase();
  if (CODE_KEY[direct]) return direct;
  const msg = String((e && e.message) || e || '');
  const m = /\b(E[A-Z]{2,10})\b/.exec(msg);
  if (m && CODE_KEY[m[1]]) return m[1];
  if (/UNKNOWN/i.test(direct) || /\bUNKNOWN\b/.test(msg)) return 'EBUSY';   // Windows: ตัวล็อกไฟล์ชั่วคราว
  if (/fetch failed|network|ERR_INTERNET|ERR_NAME_NOT_RESOLVED/i.test(msg)) return 'ECONNREFUSED';
  if (/JSON|Unexpected token .* in JSON|Unexpected end of JSON/i.test(msg)) return 'EJSON';
  return '';
}

/**
 * ประโยคเดียวที่เอาไปโชว์ได้ทันที
 * @param {any} e ข้อผิดพลาด (Error · string · อะไรก็ได้)
 * @param {{max?: number}} [o] ความยาวสูงสุดของข้อความดิบที่ตกกลับ
 * @returns {string}
 */
export function errText(e, o = {}) {
  if (e == null) return t('ui.err.unknown');
  const code = errCode(e);
  if (code === 'EJSON') return t('ui.err.badJson');
  if (code && CODE_KEY[code]) return t(CODE_KEY[code]);
  const raw = clip(redactSecrets(String((e && e.message) || e || '')).trim(), o.max || 160);
  return raw || t('ui.err.unknown');
}

/**
 * ข้อความสำหรับแถบสถานะ: `<สิ่งที่ทำไม่สำเร็จ> — <เหตุผล>`
 * @param {string} what ข้อความที่แปลแล้ว (เช่น "เปิดไฟล์ไม่สำเร็จ")
 */
export function failText(what, e, o) {
  const why = errText(e, o);
  const head = String(what || '').replace(/[:\s]+$/, '');
  return why ? head + ' — ' + why : head;
}
