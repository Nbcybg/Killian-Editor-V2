// starter-ai.js — ทางผ่านเดียวของทุกคำขอ AI ใน Story Starter (alpha.96)
//
// ทำไมต้องมี — ผู้ใช้รายงานสามอย่างที่จริง ๆ แล้วเป็นเรื่องเดียวกัน:
//   · "ตอน AI กำลังคิด หยุดไม่ได้"
//   · "ปุ่มเรื่องย่อ เหมือน AI จะกดให้ไม่ได้"   ← ปุ่มค้างอยู่จากคำขอก่อนหน้าที่ไม่มีวันจบ
//   · "log ไม่ได้เก็บค่าเลย เลยไม่รู้ว่า error ตรงไหน"
// ต้นตอ: `http:fetch` เดิมไม่มีทั้งเพดานเวลาและการยกเลิก และเส้นทาง AI ไม่จดอะไรลง log เลย
//
// ที่นี่จึงรวมสามอย่างไว้ที่เดียว: **ชื่อคำขอ (ยกเลิกได้) · เพดานเวลา · จด log ทุกคำขอ**
// ทุกปุ่ม AI ของฟีเจอร์นี้ต้องเรียกผ่านไฟล์นี้เท่านั้น ห้ามเรียก callAI ตรง ๆ

import { el, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { callAI } from '../ai-settings.js';

/** เพดานเวลาต่อคำขอ — โมเดลคิดนานได้ แต่ไม่ใช่ค้างตลอดกาล */
export const AI_TIMEOUT_MS = 180000;

let _seq = 0;
export function newReqId() { _seq += 1; return 'st-' + Date.now().toString(36) + '-' + _seq; }

/** คำขอที่กำลังวิ่งอยู่ตอนนี้ (ปุ่ม/แผงอื่นถามได้ว่ามีอะไรค้าง) */
const RUNNING = new Set();
export function aiBusy() { return RUNNING.size > 0; }

/** สั่งหยุดคำขอตาม id — คืน true เมื่อยกเลิกได้จริง */
export async function stopAI(reqId) {
  if (!reqId) return false;
  try {
    const ok = await kapi.httpAbort(reqId);
    log('info', 'starter ai: abort', { reqId, ok });
    return !!ok;
  } catch (e) { log('warn', 'starter ai: abort failed', e); return false; }
}

/** หยุดทุกคำขอที่ยังวิ่งอยู่ — ใช้ตอนปิดแผง/ปิดโปรเจกต์ */
export async function stopAllAI() {
  const ids = [...RUNNING];
  for (const id of ids) await stopAI(id);
  RUNNING.clear();
  return ids.length;
}

/**
 * เรียก AI หนึ่งครั้ง — จดลง log ทั้งขาไปและขากลับเสมอ
 * @param {string} what     ชื่องาน (โผล่ใน log · ไล่ย้อนได้ว่าปุ่มไหนยิง)
 * @param {string} prompt
 * @param {string} system
 * @param {string} reqId    จาก `newReqId()` — ต้องส่งมาถ้าอยากให้กดหยุดได้
 * @returns {Promise<string|null>} null = ล้มเหลว/ถูกหยุด (เหตุผลอยู่ใน log + แถบสถานะแล้ว)
 */
export async function askAI(what, prompt, system, reqId = '') {
  const id = reqId || newReqId();
  RUNNING.add(id);
  const t0 = Date.now();
  log('info', 'starter ai: ' + what, { reqId: id, promptChars: String(prompt || '').length });
  try {
    const out = await callAI(prompt, system, { reqId: id, timeoutMs: AI_TIMEOUT_MS });
    log(out ? 'info' : 'warn', 'starter ai: ' + what + (out ? ' ok' : ' no-reply'),
        { reqId: id, ms: Date.now() - t0, chars: (out || '').length });
    return out;
  } catch (e) {
    log('error', 'starter ai: ' + what + ' threw', e);
    setStatus(t('ui.starter.aiFail'));
    return null;
  } finally { RUNNING.delete(id); }
}

/**
 * ปุ่ม AI มาตรฐาน — **กดครั้งแรก = เริ่ม · กดซ้ำระหว่างคิด = หยุด**
 * ไม่ทำเป็นสองปุ่มเพราะที่บนแถบมีจำกัด และผู้ใช้มองหาปุ่มหยุดตรงที่เพิ่งกดไปอยู่แล้ว
 *
 * @param {string} label
 * @param {(reqId:string)=>Promise<any>} run  ต้องส่ง reqId ต่อให้ `askAI`
 */
export function aiBtn(label, run, { cls = 'st-ai' } = {}) {
  const b = el('button', cls, '✨ ' + label);
  const S = { busy: false, reqId: '' };
  b.onclick = async () => {
    if (S.busy) {                       // กดซ้ำระหว่างคิด = สั่งหยุด
      b.textContent = '⏹ ' + t('ui.starter.aiStopping');
      await stopAI(S.reqId);
      return;
    }
    S.busy = true;
    S.reqId = newReqId();
    b.classList.add('busy');
    b.textContent = '⏹ ' + t('ui.starter.aiStop');
    b.title = t('ui.starter.aiStopHint');
    try { await run(S.reqId); }
    catch (e) {
      log('error', 'starter ai (button): ' + label, e);
      setStatus(t('ui.starter.aiFail'));
    } finally {
      S.busy = false; S.reqId = '';
      b.classList.remove('busy');
      b.textContent = '✨ ' + label;
      b.title = '';
    }
  };
  return b;
}

/** ป้ายบอกจำนวนโทเคน/ค่าใช้จ่ายแบบสั้น — ใช้ซ้ำได้ทุกหน้า */
export function tokenBadge(stats) {
  const s = stats || {};
  const inTok = s.inTok || 0, outTok = s.outTok || 0;
  const wrap = el('span', 'st-tok');
  if (!inTok && !outTok) { wrap.textContent = t('ui.starter.tokNone'); return wrap; }
  wrap.textContent = tf('ui.starter.tokLine', compactNum(inTok + outTok));
  wrap.title = tf('ui.starter.tokDetail', compactNum(inTok), compactNum(outTok));
  return wrap;
}

/** 1,234 → 1.2k (ตัวเลขโทเคนอ่านง่ายกว่าเลขเต็มตอนกวาดตา) */
export function compactNum(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1000000) return (v / 1000).toFixed(v < 10000 ? 1 : 0) + 'k';
  return (v / 1000000).toFixed(1) + 'M';
}
