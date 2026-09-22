// dashboard-stats.js — [alpha.157] ตัวเลขของแดชบอร์ด (บริสุทธิ์ 100% · unit test: test/dashboard-stats.test.cjs)
//
// ผู้ใช้: *"เพิ่มในสถิติ คือ เวลาอ่านรวม ลงไปในสถิติใหญ่"*
//        *"ใน Activity เพิ่ม filter เป็น 7d 30d 90d all มีระบุวันที่เริ่ม project และมีระบุ milestone"*
//
// ประวัติคำ (`meta.wordHistory`) เป็น "ยอดสะสม" ต่อวัน ไม่ใช่คำที่เขียนในวันนั้น และ **มีช่องว่าง**
// (วันที่ไม่ได้เปิดโปรแกรมไม่มีแถว) → กราฟต้องเติมวันที่หายเป็น 0 ไม่งั้น "7 วัน" กลายเป็น 7 แถวล่าสุด
// ซึ่งอาจกินเวลาเป็นเดือน
import { addDays, localDay } from './local-date.js';

export const ACTIVITY_RANGES = ['7d', '30d', '90d', 'all'];
export const READ_WPM = 250;            // ความเร็วอ่านเฉลี่ย (คำ/นาที) — ชุดเดียวกับค่าเดิมของแดชบอร์ด

/** เวลาอ่านรวม → { minutes, hours, mins } */
export function readingTime(words, wpm = READ_WPM) {
  const w = Math.max(0, Number(words) || 0);
  const minutes = w ? Math.max(1, Math.round(w / (Number(wpm) || READ_WPM))) : 0;
  return { minutes, hours: Math.floor(minutes / 60), mins: minutes % 60 };
}

/** ประวัติเรียงตามวัน ตัดแถวพัง */
export function cleanHistory(hist) {
  return (Array.isArray(hist) ? hist : [])
    .filter((h) => h && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && Number.isFinite(Number(h.words)))
    .map((h) => ({ date: h.date, words: Math.max(0, Number(h.words)) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** จำนวนวันระหว่างสองวัน (b − a) */
export function dayDiff(a, b) {
  const pa = String(a).split('-').map(Number), pb = String(b).split('-').map(Number);
  if (pa.length < 3 || pb.length < 3) return 0;
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

/**
 * วันเริ่มโปรเจกต์ — `meta.created` (ISO) ก่อน · ไม่มีก็ใช้วันแรกของประวัติคำ
 * @returns {string} YYYY-MM-DD หรือ ''
 */
export function projectStartDay(meta = {}, hist = []) {
  const c = meta && meta.created;
  if (c) {
    const d = new Date(c);
    if (!isNaN(d.getTime())) {
      const day = localDay(d);
      const first = cleanHistory(hist)[0];
      return first && first.date < day ? first.date : day;
    }
  }
  const h = cleanHistory(hist);
  return h.length ? h[0].date : '';
}

/**
 * แท่งคำที่เขียนต่อวันในช่วงที่เลือก (เติมวันที่ไม่มีแถวเป็น 0)
 * @param {Array<{date,words}>} hist ยอดสะสมต่อวัน
 * @param {'7d'|'30d'|'90d'|'all'} range
 * @param {{today?:string, start?:string}} opts
 * @returns {{days:Array<{date,delta,total}>, from:string, to:string, sum:number, active:number, best:object|null}}
 */
export function activitySeries(hist, range = '30d', opts = {}) {
  const h = cleanHistory(hist);
  const today = opts.today || localDay();
  const n = { '7d': 7, '30d': 30, '90d': 90 }[range];
  let from;
  if (n) from = addDays(today, -(n - 1));
  else from = [opts.start, h[0] && h[0].date].filter(Boolean).sort()[0] || today;
  if (from > today) from = today;
  // ยอดสะสม ณ ก่อนวันแรกของช่วง = แถวล่าสุดที่อยู่ก่อน from (ไม่มี = 0 → วันแรกของโปรเจกต์นับทั้งหมด)
  let prevTotal = 0;
  let seenBefore = false;
  for (const r of h) { if (r.date < from) { prevTotal = r.words; seenBefore = true; } }
  const byDay = new Map(h.map((r) => [r.date, r.words]));
  // ประวัติแถวแรกสุดของโปรเจกต์: ยอดวันนั้นส่วนใหญ่คือ "ของที่มีอยู่ก่อนเริ่มจด" ไม่ใช่เขียนในวันเดียว
  const firstDate = h.length ? h[0].date : '';
  const days = [];
  let total = prevTotal;
  const span = Math.min(3660, dayDiff(from, today) + 1);
  for (let i = 0; i < span; i++) {
    const date = addDays(from, i);
    let delta = 0;
    if (byDay.has(date)) {
      const w = byDay.get(date);
      delta = (date === firstDate && !seenBefore) ? 0 : Math.max(0, w - total);
      total = w;
    }
    days.push({ date, delta, total });
  }
  const sum = days.reduce((a, d) => a + d.delta, 0);
  const active = days.filter((d) => d.delta > 0).length;
  const best = days.reduce((b, d) => (d.delta > (b ? b.delta : 0) ? d : b), null);
  return { days, from, to: today, sum, active, best };
}

/**
 * [alpha.162 · W5 ข้อ 5] คำที่เขียน "วันนี้" — นิยามเดียวกับแท่งของแดชบอร์ด (ยอดสะสมวันนี้ − ยอดของวันก่อนหน้าที่จดไว้)
 * แถบเป้ารายวันที่แถบสถานะเคยใช้ "จำนวนคำรวมของทุกแท็บที่เปิดอยู่" — เปิดฉากยาวฉากเดียวก็ครบเป้าวันนี้
 * ทั้งที่ยังไม่ได้พิมพ์สักคำ · ตัวนี้อ่านจากประวัติคำ (จดหลังทุกการบันทึก) จึงตรงกับแดชบอร์ดเสมอ
 * @param {Array<{date,words}>} hist · @param {string} [today] YYYY-MM-DD
 */
export function wordsWrittenToday(hist, today) {
  const s = activitySeries(hist, '7d', today ? { today } : {});
  const last = s.days[s.days.length - 1];
  return last ? last.delta : 0;
}

export const MILESTONE_STEPS =[1000, 5000, 10000, 25000, 50000, 75000, 100000, 150000, 200000, 300000, 500000, 1000000];

/**
 * วันที่ยอดสะสมข้ามหลักไมล์แต่ละขั้น (+ เป้าหมายโปรเจกต์ ถ้าตั้งไว้)
 * @returns {Array<{words:number, date:string, goal?:boolean}>} เรียงตามวัน
 */
export function milestones(hist, goal = 0) {
  const h = cleanHistory(hist);
  const steps = [...MILESTONE_STEPS];
  const g = Number(goal) || 0;
  if (g > 0 && !steps.includes(g)) steps.push(g);
  steps.sort((a, b) => a - b);
  const out = [];
  for (const step of steps) {
    const hit = h.find((r) => r.words >= step);
    if (hit) out.push({ words: step, date: hit.date, ...(step === g ? { goal: true } : {}) });
  }
  return out;
}

/** หลักไมล์ถัดไปที่ยังไปไม่ถึง (ไว้โชว์ "อีก N คำ") */
export function nextMilestone(words, goal = 0) {
  const w = Number(words) || 0;
  const steps = [...MILESTONE_STEPS, Number(goal) || 0].filter((x) => x > w).sort((a, b) => a - b);
  return steps.length ? { words: steps[0], left: steps[0] - w } : null;
}

/** จำนวนฉากต่อคอลัมน์สถานะ ตามลำดับของ Kanban (สถานะที่ไม่มีฉากก็ยังโชว์ 0) */
export function statusBreakdown(sceneStatuses, statuses, unsetKey = '') {
  const known = new Set(statuses);
  const count = new Map(statuses.map((s) => [s, 0]));
  let unset = 0;
  const extra = new Map();
  for (const raw of sceneStatuses || []) {
    const s = raw && raw !== 'Outline' ? raw : '';
    if (!s) { unset++; continue; }
    if (known.has(s)) count.set(s, count.get(s) + 1);
    else extra.set(s, (extra.get(s) || 0) + 1);
  }
  const rows = statuses.map((s) => ({ key: s, n: count.get(s) }));
  for (const [s, n] of extra) rows.push({ key: s, n, extra: true });
  if (unset) rows.unshift({ key: unsetKey, n: unset, unset: true });
  return rows;
}
