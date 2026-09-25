// log-core.js — แกนระบบบันทึกการทำงาน (alpha.72 · ข้อ 5)
// โมดูลบริสุทธิ์ ไม่แตะ DOM/kapi — unit test แยกที่ test/log-core.test.cjs
//
// ═══ ทำไมต้องเขียนใหม่ ═══
// ของเดิม log เป็น "สตริงต่อกันเป็นก้อน" แล้วเทลงแผงเป็นข้อความดิบ → กรองไม่ได้ ค้นไม่ได้
// นับไม่ได้ว่ามี error กี่ตัว และที่แย่ที่สุดคือ **ต้องไล่อ่านเองว่าโปรแกรมเพิ่งทำอะไรไป**
// ตอนนี้เก็บเป็น "ระเบียน" (record) มีชั้นข้อมูลจริง → แผงบันทึกกรอง/ค้น/นับ/กางรายละเอียดได้
//
// record = { seq, ts, level, source, msg, detail, count }
//   seq    เลขลำดับ (ใช้เช็คว่ามีของใหม่โดยไม่ต้องเทียบข้อความทั้งก้อน)
//   source ที่มาของบรรทัด — ถอดจากคำนำหน้า "xxx: ข้อความ" ที่โค้ดทั้งโปรเจกต์ใช้อยู่แล้ว
//   count  จำนวนครั้งที่บรรทัดเดิมซ้ำติดกัน (กัน log ท่วมจากลูปที่ยิงรัว)

import { t, tf } from './i18n.js';
import { gi } from './icons.js';
export const LEVELS = ['error', 'warn', 'info', 'debug'];
export const LEVEL_META = {
  error: { icon: gi('forbidden'), label: t('ui.log.error'), rank: 0 },
  warn:  { icon: gi('warning'), label: t('ui.log.msg'),   rank: 1 },
  info:  { icon: 'ℹ', label: t('ui.common.msg4'),  rank: 2 },
  debug: { icon: '·', label: t('ui.common.detailed'), rank: 3 },
};

export function normLevel(lv) {
  const s = String(lv || '').toLowerCase();
  return LEVELS.includes(s) ? s : 'info';
}

/**
 * ถอด "ที่มา" จากข้อความ — ทั้งโปรเจกต์เขียนกันมาแบบ `'floorplan: อ่านฉากไม่ได้'` อยู่แล้ว
 * จึงได้ที่มาฟรีโดยไม่ต้องไล่แก้ call site ทุกจุด
 * เงื่อนไข: คำนำหน้าต้องสั้น ไม่มีช่องว่างเยอะ และไม่ใช่ประโยคที่บังเอิญมี ':' (เช่น URL/เวลา)
 */
export function splitSource(msg) {
  const s = String(msg == null ? '' : msg);
  const i = s.indexOf(':');
  if (i <= 0 || i > 24) return { source: '', msg: s };
  const head = s.slice(0, i);
  // ที่มาที่ยอมรับ: ตัวอักษร/ตัวเลข/ - _ / . และช่องว่างได้ไม่เกิน 2 คำ
  // ต้องใช้ \p{L} + ธง u — `\w` ของ JS ไม่นับตัวอักษรไทย ที่มาภาษาไทยจึงหลุดหมด
  // และต้องมี \p{M} ด้วย: สระ/วรรณยุกต์ไทย ("ที่" มี ่ ) เป็น combining mark ไม่ใช่ letter
  if (!/^[\p{L}\p{M}\p{N}._\-/]+( [\p{L}\p{M}\p{N}._\-/]+)?$/u.test(head)) return { source: '', msg: s };
  return { source: head, msg: s.slice(i + 1).trim() };
}

/** `[ENOENT errno=-2 syscall=open path=…] ` จากฟิลด์มาตรฐานของ error ของ node/Electron (ไม่มี = '') */
export function errCodePrefix(e) {
  if (!e || typeof e !== 'object') return '';
  const bits = [];
  if (e.code !== undefined && e.code !== null && e.code !== '') bits.push(String(e.code));
  if (Number.isFinite(e.errno)) bits.push('errno=' + e.errno);
  if (e.syscall) bits.push('syscall=' + e.syscall);
  if (e.path) bits.push('path=' + e.path);
  return bits.length ? '[' + bits.join(' ') + '] ' : '';
}

/** แปลง extra ให้เป็นข้อความอ่านออก (Error → stack · object → JSON · อื่น → String) */
export function detailText(extra) {
  if (extra === undefined || extra === null) return '';
  // [alpha.165] รหัสข้อผิดพลาด (ENOENT · EACCES · EBUSY …) ขึ้นหน้าเสมอ — ผู้ใช้: "ต้องเก็บ error code ด้วย"
  if (extra instanceof Error) return errCodePrefix(extra) + (extra.stack || (extra.name + ': ' + extra.message));
  if (typeof extra === 'string') return extra;
  try { return JSON.stringify(extra, replacer(), 2); }
  catch { return String(extra); }
}
function replacer() {
  const seen = new WeakSet();
  return (k, v) => {
    if (v instanceof Error) return { name: v.name, code: v.code, message: v.message, stack: v.stack };
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return t('ui.log.dup');
      seen.add(v);
    }
    if (typeof v === 'function') return '[function]';
    return v;
  };
}

/** บรรทัดข้อความสำหรับเขียนลงไฟล์ (รูปแบบเดิม — ไฟล์ log เก่ายังอ่านเทียบกันได้) */
export function formatLine(rec) {
  let line = `[${rec.ts}] ${rec.level.toUpperCase()} `
           + (rec.source ? rec.source + ': ' : '') + rec.msg;
  // [alpha.165] หนีแบ็กสแลชก่อนขึ้นบรรทัด — ที่อยู่บน Windows (`C:\Users\noobc`) มี `\n` อยู่ในตัว
  //   ถ้าไม่หนี ตอนอ่านไฟล์กลับ (parseLogLine) มันกลายเป็นขึ้นบรรทัดกลางที่อยู่
  if (rec.detail) line += ' | ' + escDetail(rec.detail);
  return line;
}

/**
 * [alpha.165] อ่านบรรทัดในไฟล์ log กลับเป็นระเบียน (ตัวกลับของ `formatLine`) — ใช้ดูไฟล์ของวันก่อน ๆ ในแผงบันทึก
 * `[ts] LEVEL [ที่มา: ]ข้อความ[ | รายละเอียด]` · บรรทัดที่ไม่ตรงรูปแบบ (ไฟล์เก่า/ถูกแก้มือ) = ระเบียน info ทั้งบรรทัด
 * @returns {{seq,ts,level,source,msg,detail,count}|null} บรรทัดว่าง = null
 */
export function parseLogLine(line, seq = 0) {
  const s = String(line == null ? '' : line).replace(/\r$/, '');
  if (!s.trim()) return null;
  const m = s.match(/^\[([^\]]+)\] (ERROR|WARN|INFO|DEBUG) (.*)$/);
  if (!m) return { seq, ts: '', level: 'info', source: '', msg: s, detail: '', count: 1 };
  let rest = m[3], detail = '';
  const cut = rest.indexOf(' | ');
  if (cut >= 0) { detail = unescDetail(rest.slice(cut + 3)); rest = rest.slice(0, cut); }
  const { source, msg } = splitSource(rest);
  return { seq, ts: m[1], level: normLevel(m[2].toLowerCase()), source, msg, detail, count: 1 };
}
/** รายละเอียดหนึ่งบรรทัดในไฟล์: `\` → `\\` แล้วขึ้นบรรทัด → `\n` (ตัวกลับคือ unescDetail) */
export function escDetail(s) { return String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n'); }
/** ตัวกลับของ escDetail — เดินทีละตัว (`\\n` = แบ็กสแลช + n ไม่ใช่ขึ้นบรรทัด) */
export function unescDetail(s) {
  return String(s).replace(/\\(\\|n)/g, (m, c) => (c === 'n' ? '\n' : '\\'));
}
/** ชื่อไฟล์ log ของวัน (`app-YYYY-MM-DD.log`) → วัน · ไม่ใช่ไฟล์ log = '' */
export function logFileDay(name) {
  const m = String(name || '').match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);
  return m ? m[1] : '';
}

/** เวลาแบบสั้นสำหรับแสดงบนแผง (HH:MM:SS) — ไม่พึ่ง locale ของเครื่อง */
export function shortTime(ts) {
  const m = String(ts || '').match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : String(ts || '').slice(0, 8);
}

/**
 * บัฟเฟอร์วงแหวนของ log — เก็บระเบียน ตัดของเก่าทิ้งเมื่อเต็ม
 * รวมบรรทัดที่ "เหมือนเดิมและติดกัน" เป็นระเบียนเดียวแล้วนับ count (ลูปที่ยิงรัวไม่กลบของสำคัญ)
 */
export function createLogStore(max = 2000) {
  const cap = Math.max(50, max | 0);
  const recs = [];
  let seq = 0;
  const counts = { error: 0, warn: 0, info: 0, debug: 0 };

  const push = (level, msg, extra, ts) => {
    const lv = normLevel(level);
    const { source, msg: text } = splitSource(msg);
    const detail = detailText(extra);
    const last = recs[recs.length - 1];
    if (last && last.level === lv && last.source === source && last.msg === text && last.detail === detail) {
      last.count++; last.ts = ts;                 // ซ้ำติดกัน = นับเพิ่ม ไม่เพิ่มระเบียนใหม่
      return last;
    }
    const rec = { seq: ++seq, ts, level: lv, source, msg: text, detail, count: 1 };
    recs.push(rec);
    counts[lv]++;
    while (recs.length > cap) { const old = recs.shift(); counts[old.level] -= old.count; }
    return rec;
  };

  return {
    push,
    all: () => recs.slice(),
    size: () => recs.length,
    lastSeq: () => seq,
    counts: () => ({ ...counts }),
    sources: () => [...new Set(recs.map((r) => r.source).filter(Boolean))].sort(),
    clear: () => { recs.length = 0; for (const k of LEVELS) counts[k] = 0; },
  };
}

/**
 * กรองระเบียนตามเงื่อนไขของแผง
 * @param opts { levels:Set|Array, source:string, q:string }
 *   levels ว่าง/ไม่ส่ง = เอาทุกระดับ · source '' = ทุกที่มา · q = ค้นในข้อความ+รายละเอียด+ที่มา
 */
export function filterLogs(recs, opts = {}) {
  const lv = opts.levels && (opts.levels.size ?? opts.levels.length)
    ? new Set(opts.levels instanceof Set ? [...opts.levels] : opts.levels) : null;
  const src = String(opts.source || '').trim();
  const q = String(opts.q || '').trim().toLowerCase();
  return (recs || []).filter((r) => {
    if (lv && !lv.has(r.level)) return false;
    if (src && r.source !== src) return false;
    if (q) {
      const hay = (r.source + ' ' + r.msg + ' ' + r.detail).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** สรุปสั้น ๆ ไว้โชว์บนหัวแผง/แถบสถานะ */
export function summarize(counts) {
  const c = counts || {};
  const parts = [];
  for (const lv of LEVELS) if (c[lv]) parts.push(LEVEL_META[lv].icon + ' ' + c[lv]);
  return parts.join(' · ');
}

/** ข้อความทั้งก้อนสำหรับปุ่มคัดลอก/ส่งออก */
export function exportText(recs) {
  return (recs || []).map((r) => formatLine(r) + (r.count > 1 ? tf('ui.log.dupTimes', r.count) : '')).join('\n');
}
