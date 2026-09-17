// sprint-core.js — [alpha.156] สปรินต์การเขียน (จับเวลา + นับคำที่เขียนได้ในรอบ) — ตรรกะล้วน
//
// ผู้เขียนนิยายใช้ "sprint" 15–30 นาทีเป็นเครื่องมือหลักในการเริ่มงาน (NaNoWriMo ฯลฯ)
// โปรแกรมมีสถิติคำรายวันอยู่แล้ว (word-history) แต่ไม่มีตัวจับเวลาที่ผูกกับจำนวนคำ
//
// จำนวนคำนับจาก **ทั้งโปรเจกต์ที่เปิดอยู่** (ผลรวมของแท็บ) เทียบกับตอนเริ่ม — สลับฉากระหว่างรอบได้
// ลบคำ = ติดลบได้ (ตรงความจริง) แต่สรุปผลไม่ต่ำกว่า 0
// เวลาเป็น ms ที่ผู้เรียกส่งมาเสมอ (ไม่อ่านนาฬิกาเอง) → เทสได้แน่นอน

export const SPRINT_MIN = 1;
export const SPRINT_MAX = 180;
export const SPRINT_HISTORY_MAX = 200;

export function clampMinutes(m) {
  const v = Math.round(Number(m));
  if (!Number.isFinite(v)) return 25;
  return Math.min(SPRINT_MAX, Math.max(SPRINT_MIN, v));
}

/** เริ่มรอบใหม่ */
export function startSprint({ minutes = 25, words = 0, goal = 0, now = 0 } = {}) {
  const m = clampMinutes(minutes);
  return { startedAt: now, endsAt: now + m * 60000, minutes: m, startWords: Math.max(0, +words || 0),
           goal: Math.max(0, Math.round(+goal || 0)), pausedAt: 0, pausedMs: 0 };
}

export function pauseSprint(s, now) {
  if (!s || s.pausedAt) return s;
  return { ...s, pausedAt: now };
}
export function resumeSprint(s, now) {
  if (!s || !s.pausedAt) return s;
  const gap = Math.max(0, now - s.pausedAt);
  return { ...s, pausedAt: 0, pausedMs: s.pausedMs + gap, endsAt: s.endsAt + gap };
}

/**
 * สถานะ ณ เวลา `now`
 * @returns {{remainingMs:number, elapsedMs:number, written:number, wpm:number, done:boolean,
 *            goalPct:number, label:string}}
 */
export function sprintStatus(s, words, now) {
  if (!s) return null;
  const t = s.pausedAt || now;
  const remainingMs = Math.max(0, s.endsAt - t);
  const elapsedMs = Math.max(0, Math.min(s.minutes * 60000, t - s.startedAt - s.pausedMs));
  const written = Math.round((+words || 0) - s.startWords);
  const mins = elapsedMs / 60000;
  const wpm = mins >= 0.25 ? Math.max(0, Math.round(written / mins)) : 0;
  const goalPct = s.goal ? Math.max(0, Math.min(100, Math.round(written / s.goal * 100))) : 0;
  return { remainingMs, elapsedMs, written, wpm, done: remainingMs === 0, goalPct,
           label: fmtClock(remainingMs), paused: !!s.pausedAt };
}

/** 125000 → "2:05" · 3725000 → "1:02:05" */
export function fmtClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

/** จบรอบ → ระเบียนสำหรับเก็บประวัติ */
export function finishSprint(s, words, now) {
  const st = sprintStatus(s, words, now);
  return { at: new Date(s.startedAt).toISOString(), minutes: s.minutes,
           actualMinutes: Math.round(st.elapsedMs / 6000) / 10,
           words: Math.max(0, st.written), wpm: st.wpm, goal: s.goal,
           reached: s.goal ? st.written >= s.goal : null };
}

/** ต่อประวัติ (ใหม่สุดท้ายสุด) ตัดให้เหลือไม่เกินเพดาน · รอบที่เขียนไม่ถึงนาทีไม่จด */
export function appendSprintHistory(list, rec) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (!rec || !(rec.actualMinutes >= 1)) return arr;
  arr.push(rec);
  return arr.slice(-SPRINT_HISTORY_MAX);
}

/** สรุปประวัติ: รอบทั้งหมด · คำรวม · wpm เฉลี่ย (ถ่วงตามเวลา) · รอบที่ดีที่สุด */
export function sprintSummary(list) {
  const arr = Array.isArray(list) ? list : [];
  let words = 0, mins = 0, best = null;
  for (const r of arr) {
    words += +r.words || 0; mins += +r.actualMinutes || 0;
    if (!best || (+r.wpm || 0) > (+best.wpm || 0)) best = r;
  }
  return { count: arr.length, words, minutes: Math.round(mins), avgWpm: mins ? Math.round(words / mins) : 0, best };
}
