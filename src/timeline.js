// ระบบเส้นเวลา (Timeline) — ตรรกะบริสุทธิ์ ไม่แตะ DOM/ไฟล์ เพื่อทดสอบตรง ๆ ได้
//
// เหตุการณ์บนเส้นเวลามาจาก 2 แหล่ง:
//   1) events ที่ผู้ใช้สร้างเอง (เก็บใน timeline.json → events[])
//   2) ฉากที่มี storyDate (ดึงจากทุกเล่ม/ฉบับร่าง) — แสดงเป็นเหตุการณ์อัตโนมัติ
//
// "เวลาในเรื่อง" เป็นข้อความอิสระ (โลกแฟนตาซีไม่มีปฏิทินจริง) จึงเรียงด้วย 2 ชั้น:
//   - ถ้ามี field `sort` (ตัวเลข) ใช้ตัวเลขนั้นก่อน
//   - ไม่งั้นแยกเลขตัวแรกจากข้อความ storyDate มาเทียบ (เช่น "วันที่ 3" → 3, "ปีที่ 1024" → 1024)
//   - เท่ากันค่อยเทียบข้อความ

import { t } from './i18n.js';
export const TIMELINE_VERSION = '1.0';

// สีของ track (เลน) — วนใช้
export const TRACK_COLORS = ['#5f9fd9', '#6fae6f', '#d9b757', '#d97757', '#a97fd0', '#d9575e', '#7fb8b0', '#c98a5f'];

// ดึงเลขตัวแรกจากข้อความ (รองรับ , และ . ในตัวเลข) — ใช้จัดลำดับหยาบ ๆ
export function extractNum(s) {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// ค่าเรียงของเหตุการณ์: ใช้ e.sort ก่อน ไม่งั้นถอดเลขจาก when
function orderKey(e) {
  if (typeof e.sort === 'number' && !Number.isNaN(e.sort)) return e.sort;
  const n = extractNum(e.when);
  return n === null ? null : n;
}

// เรียงเหตุการณ์: ตัวที่มีเลขมาก่อน (ตามเลข) → ตัวไม่มีเลขไปท้าย (เรียงตามข้อความ)
export function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const ka = orderKey(a), kb = orderKey(b);
    if (ka !== null && kb !== null) { if (ka !== kb) return ka - kb; }
    else if (ka !== null) return -1;
    else if (kb !== null) return 1;
    // เท่ากัน/ไม่มีเลขทั้งคู่ → เทียบ order (ลำดับที่ผู้ใช้ลาก) แล้วค่อยข้อความ
    if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
    return String(a.when || '').localeCompare(String(b.when || ''), 'th');
  });
}

// รวมเหตุการณ์จาก events เอง + ฉากที่มี storyDate ให้เป็นชุดเดียว (normalize รูปแบบ)
// sceneEvents = [{ id, title, when, track, file, kind:'scene', color? }]
export function mergeTimeline(events, sceneEvents) {
  // ต้องคัดลอก "ทุก field ที่ UI ใช้" — เคยลืม whenEnd มาแล้ว (Gantt กลายเป็นจุดหมด)
  // refs = เอกสาร/โน้ตที่เหตุการณ์นี้อ้างอิงถึง (ข้อ 5)
  const evs = (events || []).map((e) => ({
    id: e.id, title: e.title || '', when: e.when || '', whenEnd: e.whenEnd || '', track: e.track || '',
    sort: e.sort, order: e.order || 0, color: e.color || '', tags: e.tags || [],
    refs: Array.isArray(e.refs) ? e.refs : [],
    desc: e.desc || '', kind: 'event', file: null,
  }));
  const scs = (sceneEvents || []).map((s) => ({
    id: s.id, title: s.title || '', when: s.when || '', whenEnd: '', track: s.track || '',
    sort: undefined, order: 0, color: s.color || '', tags: [], refs: [], desc: s.synopsis || '',
    kind: 'scene', file: s.file || null,
  }));
  return sortEvents([...evs, ...scs]);
}

// จัดกลุ่มเป็นเลน (track) — คงลำดับ track ตามที่พบครั้งแรก, เลนว่าง ("") ใช้ชื่อ default
export function groupByTrack(items, defaultLabel = t('ui.common.msg4')) {
  const order = [];
  const map = new Map();
  for (const it of items) {
    const key = it.track || defaultLabel;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key).push(it);
  }
  return order.map((name, i) => ({ name, color: TRACK_COLORS[i % TRACK_COLORS.length], items: map.get(name) }));
}

// รายชื่อ track ที่มีอยู่ (ไว้เติม dropdown)
export function trackNames(events, sceneEvents) {
  const set = new Set();
  for (const e of events || []) if (e.track) set.add(e.track);
  for (const s of sceneEvents || []) if (s.track) set.add(s.track);
  return [...set];
}

export function newEvent(when = '') {
  return { id: 'ev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
           title: '', when, track: '', sort: undefined, order: 0, color: '', tags: [],
           refs: [], desc: '' };
}

// ---- การอ้างอิงของเหตุการณ์ (ข้อ 5) ----
// ref = { kind:'scene'|'memo', path, title } · path เก็บแบบสัมพัทธ์กับ root เพื่อให้ย้ายโปรเจกต์ได้
export function normalizeRefs(refs) {
  if (!Array.isArray(refs)) return [];
  const seen = new Set();
  const out = [];
  for (const r of refs) {
    if (!r || !r.path) continue;
    const path = String(r.path).replace(/\\/g, '/');
    if (seen.has(path)) continue;                 // อ้างซ้ำไฟล์เดิม = เก็บอันเดียว
    seen.add(path);
    out.push({ kind: r.kind === 'memo' ? 'memo' : 'scene', path,
               title: r.title || path.split('/').pop() });
  }
  return out;
}

// ตรวจเหตุการณ์ที่ "เวลาชนกัน" (when เดียวกันใน track เดียวกัน) — คืนกลุ่มที่ชน
export function findClashes(items) {
  const seen = new Map();
  for (const it of items) {
    if (!it.when) continue;
    const key = (it.track || '') + '||' + it.when.trim();
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(it);
  }
  return [...seen.values()].filter((g) => g.length > 1);
}

// ---------------- Gantt ----------------
// สำหรับมุมมองแท่ง: แต่ละเหตุการณ์ต้องมีตัวเลข "เริ่ม" (จาก when/sort) และ "จบ" (จาก whenEnd ถ้ามี ไม่งั้น=เริ่ม)
// คืนเฉพาะเหตุการณ์ที่ระบุเวลาเป็นตัวเลขได้ พร้อม min/max รวม เพื่อ normalize เป็น % บนแกน
export function ganttData(items) {
  const rows = [];
  for (const it of items) {
    const start = (typeof it.sort === 'number' && !Number.isNaN(it.sort)) ? it.sort : extractNum(it.when);
    if (start === null) continue;                        // ไม่มีเลข → วางบนแกนไม่ได้ ข้ามไป
    let end = extractNum(it.whenEnd);
    if (end === null || end < start) end = start;        // ไม่มีจุดจบ = เหตุการณ์จุดเดียว
    rows.push({ ...it, _start: start, _end: end });
  }
  if (!rows.length) return { rows: [], min: 0, max: 1, span: 1, undated: [] };
  let min = Infinity, max = -Infinity;
  for (const r of rows) { if (r._start < min) min = r._start; if (r._end > max) max = r._end; }
  const span = (max - min) || 1;
  return { rows, min, max, span, undated: items.filter((it) =>
    (typeof it.sort !== 'number' || Number.isNaN(it.sort)) && extractNum(it.when) === null) };
}

// ตำแหน่ง/ความกว้างของแท่ง (เป็น %) เทียบกับช่วงรวม — ให้ min/max/span จาก ganttData
export function ganttBar(row, min, span) {
  const left = ((row._start - min) / span) * 100;
  const width = Math.max(1.2, ((row._end - row._start) / span) * 100);   // จุดเดียว = แท่งบางแต่เห็น
  return { left, width };
}

// สร้าง "ขีดแกน" ~5-8 ขีดจาก min→max (ตัวเลขกลม ๆ) สำหรับหัวตาราง Gantt
export function ganttTicks(min, max, count = 6) {
  if (max <= min) return [{ value: min, pct: 0 }];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = (raw / mag >= 5 ? 5 : raw / mag >= 2 ? 2 : 1) * mag;
  const ticks = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + 1e-9; v += step)
    ticks.push({ value: Math.round(v * 1000) / 1000, pct: ((v - min) / span) * 100 });
  return ticks.length ? ticks : [{ value: min, pct: 0 }, { value: max, pct: 100 }];
}
