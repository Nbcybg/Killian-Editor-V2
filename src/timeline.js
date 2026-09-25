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
import { cmpText } from './locale.js';
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
    return cmpText(String(a.when || ''), String(b.when || ''));
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
// ref = { kind:'scene'|'memo'|'entity', path, title } · path เก็บแบบสัมพัทธ์กับ root เพื่อให้ย้ายโปรเจกต์ได้
export function normalizeRefs(refs) {
  if (!Array.isArray(refs)) return [];
  const seen = new Set();
  const out = [];
  for (const r of refs) {
    if (!r || !r.path) continue;
    const path = String(r.path).replace(/\\/g, '/');
    if (seen.has(path)) continue;                 // อ้างซ้ำไฟล์เดิม = เก็บอันเดียว
    seen.add(path);
    // [alpha.167] + 'entity' (ตัวละคร/สถานที่ที่หยิบใส่การ์ด → รูปบนการ์ด)
    out.push({ kind: r.kind === 'memo' || r.kind === 'entity' ? r.kind : 'scene', path,
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

// ═══════════════════ [alpha.167] บอร์ดเส้นเวลา (แบบภาพอ้างอิงที่ 1) + ส่งออก ═══════════════════
//
// ผู้ใช้: "timeline ตอนนี้มีประโยชน์แค่ดูระยะเวลาในเรื่อง ... export ไม่ได้ ... UI ควรเป็นแบบรูป 1"
// รูป 1 = แกนเวลาแนวนอนด้านบน · การ์ดวางตามช่วงเวลาจริง (ยาว = นาน) · แถบสีซ้ายการ์ด ·
//         รูปตัวละครบนการ์ด · เส้นลูกศรบอกว่า "เหตุการณ์นี้นำไปสู่อันไหน" · เส้นตั้ง "ตอนนี้"
// ทุกอย่างที่คำนวณได้โดยไม่แตะจออยู่ที่นี่ (unit test ได้) — ตัววาดอยู่ timeline-ui.js

/** ช่วงเวลาเป็นตัวเลขของเหตุการณ์ — null เมื่อระบุเป็นตัวเลขไม่ได้ (ไปอยู่ถาด "ยังไม่ระบุเวลา") */
export function eventSpan(it) {
  if (!it) return null;
  const start = (typeof it.sort === 'number' && !Number.isNaN(it.sort)) ? it.sort : extractNum(it.when);
  if (start === null || start === undefined) return null;
  let end = extractNum(it.whenEnd);
  if (end === null || end < start) end = start;
  return { start, end };
}

/**
 * แทนเลขตัวแรกในข้อความเวลาด้วยค่าใหม่ — ลากการ์ดแล้วรูปแบบที่ผู้ใช้พิมพ์ต้องอยู่ครบ
 * ("ปีที่ 1,024 ฤดูฝน" → ลากไป 1030 = "ปีที่ 1030 ฤดูฝน") · ไม่มีเลขเลย = คืนเลขเปล่า
 */
export function replaceNum(text, n) {
  const v = Math.round(Number(n) * 1000) / 1000;
  const s = String(text == null ? '' : text);
  const re = /-?\d[\d,]*(\.\d+)?/;
  return re.test(s) ? s.replace(re, String(v)) : String(v);
}

/** คำนำหน้า/หน่วยที่ใช้บ่อยที่สุดในข้อความเวลา ("ปีที่ 12" → "ปีที่") — ใช้ติดป้ายขีดบนแกน */
export function timeUnitLabel(items) {
  const count = new Map();
  for (const it of items || []) {
    const m = String(it.when || '').match(/^([^\d-]*?)\s*-?\d/);
    const k = m ? m[1].trim() : '';
    if (!k) continue;
    count.set(k, (count.get(k) || 0) + 1);
  }
  let best = '', n = 0;
  for (const [k, c] of count) if (c > n) { best = k; n = c; }
  return best;
}

/**
 * จัดการ์ดลงแถวในเลนเดียวกันไม่ให้ทับกัน (greedy interval packing) — ทำในหน่วย "พิกเซล"
 * เพราะการ์ดจุดเดียวยังต้องกว้างพออ่านชื่อ (minPx)
 * @param rows [{id, x, w}] (x,w เป็นพิกเซลแล้ว)
 * @returns Map(id → เลขแถว)
 */
export function packRows(rows, gap = 12) {
  const sorted = (rows || []).slice().sort((a, b) => a.x - b.x || b.w - a.w);
  const ends = [];                     // ขอบขวาสุดของแต่ละแถว
  const out = new Map();
  for (const r of sorted) {
    let lane = ends.findIndex((e) => e + gap <= r.x);
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = r.x + r.w;
    out.set(r.id, lane);
  }
  return out;
}

/** มาตราส่วนที่ทำให้ทั้งช่วงพอดีความกว้าง (px ต่อหน่วยเวลา) */
export function fitPxPerUnit(min, max, width, pad = 40) {
  const span = Math.max(1e-9, (max - min) || 1);
  const w = Math.max(100, (Number(width) || 0) - pad * 2);
  return w / span;
}

/** ขีดบนแกนตามความกว้างจริง (ราว ๆ ทุก 110px) */
export function boardTicks(min, max, width) {
  const n = Math.max(2, Math.min(24, Math.round((Number(width) || 600) / 110)));
  return ganttTicks(min, max, n);
}

// ---------- เส้นเชื่อม "เหตุการณ์นี้นำไปสู่…" ----------
// เก็บที่ timeline.json → links: [{from, to}] · id ของฉาก = 'scene:<sceneId>' (ไม่ผูกกับทางบนดิสก์)
/** คีย์ถาวรของรายการบนเส้นเวลา — เหตุการณ์ = id เดิม · ฉาก = scene:<id ในscenes.json> */
export function linkKey(it) {
  if (!it) return '';
  if (it.kind === 'scene') return 'scene:' + String(it.id || '').split(':').pop();
  return String(it.id || '');
}
export function normalizeLinks(links) {
  const seen = new Set();
  const out = [];
  for (const l of Array.isArray(links) ? links : []) {
    if (!l || !l.from || !l.to || l.from === l.to) continue;
    const k = l.from + '>' + l.to;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ from: String(l.from), to: String(l.to) });
  }
  return out;
}
/** เพิ่มเส้น (สลับทิศซ้ำ = ถือว่าเส้นเดิม ไม่เพิ่ม) */
export function addLink(links, from, to) {
  const list = normalizeLinks(links);
  if (!from || !to || from === to) return list;
  if (list.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from))) return list;
  return [...list, { from, to }];
}
export function removeLink(links, from, to) {
  return normalizeLinks(links).filter((l) => !(l.from === from && l.to === to));
}
/** ทิ้งเส้นที่ปลายข้างหนึ่งหายไปแล้ว (เหตุการณ์ถูกลบ/ฉากไม่มีเวลาแล้ว) */
export function liveLinks(links, items) {
  const keys = new Set((items || []).map(linkKey));
  return normalizeLinks(links).filter((l) => keys.has(l.from) && keys.has(l.to));
}
/** เส้นที่ย้อนเวลา (ต้นเกิดทีหลังปลาย) — ตัวช่วยจับปมเรื่องขัดกันเอง */
export function backwardLinks(links, items) {
  const byKey = new Map((items || []).map((it) => [linkKey(it), it]));
  return normalizeLinks(links).filter((l) => {
    const a = eventSpan(byKey.get(l.from)), b = eventSpan(byKey.get(l.to));
    return a && b && a.start > b.start;
  });
}

/**
 * เส้นหักมุมจากขอบขวาของการ์ดต้นทาง → ขอบซ้ายของการ์ดปลายทาง (พิกัดพิกเซล)
 * แบบในภาพอ้างอิง: ออกขวา → ลง/ขึ้น → เข้าซ้าย · ถ้าปลายทางอยู่ซ้ายกว่า อ้อมลงใต้การ์ดต้นทาง
 */
export function elbowPath(a, b, r = 10) {
  const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
  const out = 18;
  if (x2 - x1 >= out * 2) {
    const mx = Math.round(x1 + Math.max(out, Math.min((x2 - x1) / 2, 60)));
    const dy = y2 - y1;
    if (Math.abs(dy) < 1) return `M${x1},${y1} L${x2},${y2}`;
    const s = Math.sign(dy), rr = Math.min(r, Math.abs(dy) / 2, (mx - x1), (x2 - mx));
    return `M${x1},${y1} L${mx - rr},${y1} Q${mx},${y1} ${mx},${y1 + s * rr} L${mx},${y2 - s * rr} Q${mx},${y2} ${mx + rr},${y2} L${x2},${y2}`;
  }
  // ย้อนกลับ: ออกขวา → ลงไปช่องระหว่างแถว → วิ่งซ้าย → ขึ้น/ลงหาเป้า → เข้าซ้าย
  const lane = Math.max(y1, y2) + 34;
  return `M${x1},${y1} L${x1 + out},${y1} L${x1 + out},${lane} L${x2 - out},${lane} L${x2 - out},${y2} L${x2},${y2}`;
}

// ---------- ส่งออก ----------
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** CSV (มี BOM ให้ Excel อ่านไทยออก) — หัวคอลัมน์รับมาจากผู้เรียก (แปลตามภาษาแล้ว) */
export function timelineCsv(items, head) {
  const h = head || ['title', 'when', 'whenEnd', 'track', 'kind', 'description', 'references'];
  const lines = [h.map(csvCell).join(',')];
  for (const it of items || []) {
    lines.push([it.title, it.when, it.whenEnd, it.track, it.kind, it.desc,
      (it.refs || []).map((r) => r.title).join('; ')].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Markdown: หัวข้อตามเลน · รายการเรียงตามเวลา · ต่อท้ายด้วยรายการเส้นเชื่อม */
export function timelineMarkdown(items, links, L = {}) {
  const lab = { title: 'Timeline', undated: 'Undated', links: 'Links', ...L };
  const out = ['# ' + lab.title, ''];
  for (const tr of groupByTrack(sortEvents(items || []), lab.defaultTrack)) {
    out.push('## ' + tr.name, '');
    for (const it of tr.items) {
      const when = it.when ? `**${it.when}${it.whenEnd ? ' → ' + it.whenEnd : ''}** — ` : '';
      out.push(`- ${when}${it.title || ''}`);
      if (it.desc) out.push('  ' + String(it.desc).replace(/\n+/g, ' '));
      for (const r of it.refs || []) out.push('  - ' + (r.title || r.path || ''));
    }
    out.push('');
  }
  const byKey = new Map((items || []).map((it) => [linkKey(it), it]));
  const ls = normalizeLinks(links).filter((l) => byKey.has(l.from) && byKey.has(l.to));
  if (ls.length) {
    out.push('## ' + lab.links, '');
    for (const l of ls) out.push(`- ${byKey.get(l.from).title} → ${byKey.get(l.to).title}`);
    out.push('');
  }
  return out.join('\n');
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/**
 * HTML ไฟล์เดียว (เปิดในเบราว์เซอร์/ส่งให้คนอื่นดูได้ทันที) — บอร์ดแนวนอนแบบเดียวกับบนจอ วาดด้วย CSS ล้วน
 * พื้นขาวเสมอ (งานส่งออก — กฎ W6) · ข้อความผู้ใช้ผ่าน esc ทุกตัว
 */
export function timelineHtml(items, links, L = {}) {
  const lab = { title: 'Timeline', undated: 'Undated', lang: 'th', ...L };
  const dated = [], undated = [];
  for (const it of sortEvents(items || [])) (eventSpan(it) ? dated : undated).push(it);
  const pxW = 1400;
  let min = Infinity, max = -Infinity;
  for (const it of dated) { const s = eventSpan(it); min = Math.min(min, s.start); max = Math.max(max, s.end); }
  if (!dated.length) { min = 0; max = 1; }
  const ppu = fitPxPerUnit(min, max, pxW, 40);
  const X = (v) => 40 + (v - min) * ppu;
  const unit = timeUnitLabel(items);
  const ticks = boardTicks(min, max, pxW);
  const tracks = groupByTrack(dated, lab.defaultTrack);
  let y = 46;
  const cards = [], lanes = [], pos = new Map();
  for (const tr of tracks) {
    const rows = tr.items.map((it) => { const s = eventSpan(it); const x = X(s.start); return { id: linkKey(it), x, w: Math.max(170, X(s.end) - x) }; });
    const pk = packRows(rows);
    const nRows = Math.max(1, ...[...pk.values()].map((v) => v + 1));
    lanes.push(`<div class="lane" style="top:${y}px;height:${nRows * 64 + 16}px"><span class="ln"><i style="background:${esc(tr.color)}"></i>${esc(tr.name)}</span></div>`);
    for (const r of rows) {
      const it = tr.items.find((x) => linkKey(x) === r.id);
      const top = y + 12 + pk.get(r.id) * 64;
      pos.set(r.id, { x1: r.x + r.w, x0: r.x, y: top + 26 });
      cards.push(`<div class="card" style="left:${r.x}px;top:${top}px;width:${r.w}px;border-color:${esc(it.color || tr.color)}">`
        + `<b>${esc(it.title)}</b><small>${esc(it.when)}${it.whenEnd ? ' → ' + esc(it.whenEnd) : ''}</small></div>`);
    }
    y += nRows * 64 + 22;
  }
  const paths = normalizeLinks(links).filter((l) => pos.has(l.from) && pos.has(l.to)).map((l) => {
    const a = pos.get(l.from), b = pos.get(l.to);
    return `<path d="${elbowPath({ x: a.x1, y: a.y }, { x: b.x0, y: b.y })}" />`;
  }).join('');
  const H = y + 20;
  const tickHtml = ticks.map((t) => `<div class="tk" style="left:${X(t.value)}px"><span>${esc((unit ? unit + ' ' : '') + t.value)}</span></div>`).join('');
  const und = undated.length ? `<h2>${esc(lab.undated)}</h2><ul>${undated.map((it) => `<li><b>${esc(it.title)}</b> ${esc(it.when || '')}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html lang="${esc(lab.lang)}"><head><meta charset="utf-8"><title>${esc(lab.title)}</title><style>
body{font-family:"Sarabun","Noto Sans Thai",sans-serif;background:#fff;color:#222;margin:24px}
h1{font-size:22px;margin:0 0 12px}h2{font-size:16px;margin:22px 0 8px}
.board{position:relative;width:${pxW + 40}px;height:${H}px;border:1px solid #ddd;border-radius:10px;overflow:hidden;
background:repeating-linear-gradient(135deg,#fafafa 0 10px,#f3f3f3 10px 20px)}
.tk{position:absolute;top:0;bottom:0;border-left:1px dashed #ddd}.tk span{position:absolute;top:8px;left:4px;font-size:12px;color:#777;white-space:nowrap}
.lane{position:absolute;left:0;right:0;border-top:1px solid #e6e6e6}.ln{position:absolute;left:8px;top:-10px;background:#fff;padding:0 6px;font-size:12px;color:#555}
.ln i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-inline-end:5px}
.card{position:absolute;height:52px;box-sizing:border-box;background:#fff;border:1px solid #ddd;border-left-width:5px;border-radius:8px;padding:6px 10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card small{color:#777;font-size:11.5px}
svg{position:absolute;inset:0;pointer-events:none}path{fill:none;stroke:#8a7fd0;stroke-width:1.6;marker-end:url(#a)}
</style></head><body><h1>${esc(lab.title)}</h1><div class="board">${tickHtml}${lanes.join('')}
<svg width="${pxW + 40}" height="${H}"><defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8" style="fill:#8a7fd0;stroke:none"/></marker></defs>${paths}</svg>
${cards.join('')}</div>${und}</body></html>`;
}
