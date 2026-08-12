// record-data.js — [alpha.69] แผง "บันทึกประจำวัน" (Record): โครงข้อมูล + ส่งออก CSV
//
// ผู้ใช้จดว่า "วันนี้ทำอะไรไปบ้าง" แบบ remark — คนละเรื่องกับสมุดโน้ตด่วน (`notes`) ตรงที่
// ตัวนี้ **ผูกกับวันที่** และเป็นของโปรเจกต์ (เก็บลงไฟล์ ไม่ใช่ localStorage) จึงส่งออก CSV ได้
//
// ไฟล์นี้ **บริสุทธิ์** (ไม่แตะ DOM/kapi/state) — schema, การเรียง, สรุปรายวัน และตัวเขียน CSV
// เทสด้วย node ได้หมด · การเชื่อมกับไฟล์/หน้าจออยู่ที่ record-ui.js

import { T } from '../i18n.js';
export const RECORD_SCHEMA = 2;
/** ไฟล์เก็บบันทึกในโปรเจกต์ (อยู่ระดับเดียวกับ project.khn.json — แก้นอกโปรแกรมได้ตามหลักของโปรเจกต์) */
export const RECORD_FILE = 'records.json';

/** อารมณ์/ผลของวัน — ใช้ทำสรุปและกรอง (เก็บเป็นคีย์ ไม่ใช่ข้อความ เพื่อให้เปลี่ยนภาษาได้) */
export const MOODS = [
  { key: '', label: '—' },
  { key: 'great', label: T`😄 ลื่นไหล` },
  { key: 'ok', label: T`🙂 ปกติ` },
  { key: 'stuck', label: T`😖 ติดขัด` },
  { key: 'tired', label: T`😴 ล้า` },
];
export const moodLabel = (k) => (MOODS.find((m) => m.key === k) || MOODS[0]).label;

/** วันที่แบบ YYYY-MM-DD จาก Date (เวลาท้องถิ่น — ไม่ใช่ UTC ไม่งั้นจดตอนดึกแล้ววันเพี้ยน) */
export function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** รายการเปล่าหนึ่งใบ (id ต้องมาจากผู้เรียก — โมดูลบริสุทธิ์ห้ามใช้ Date.now/Math.random) */
export function newEntry(id, day, patch = {}) {
  return {
    id: String(id),
    day: String(day || ''),
    at: patch.at || '',            // เวลาที่จด (ISO) — ใช้เรียงภายในวันเดียวกัน
    text: patch.text || '',
    mood: patch.mood || '',
    tags: Array.isArray(patch.tags) ? patch.tags.slice() : [],
    words: Number(patch.words) || 0,   // จำนวนคำที่เขียนได้วันนั้น (ผู้ใช้กรอกเอง หรือดึงจากสถิติ)
    minutes: Number(patch.minutes) || 0,
  };
}

/** อ่านไฟล์ที่โหลดมา → โครงมาตรฐาน (รับของเก่า/ของพังได้หมด ไม่โยน) */
export function migrate(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(d.entries) ? d.entries : (Array.isArray(d) ? d : []);
  const entries = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || typeof e !== 'object') continue;
    // v1 เก็บเป็น {date, note} — แปลงเป็นชื่อฟิลด์ปัจจุบัน
    const day = e.day || e.date || '';
    const text = e.text != null ? e.text : (e.note || '');
    if (!day && !String(text).trim()) continue;
    entries.push(newEntry(e.id || 'r' + i, day, { ...e, text }));
  }
  return { schema: RECORD_SCHEMA, entries: sortEntries(entries) };
}

/** เรียงใหม่สุดอยู่บน (วันเดียวกันเรียงตามเวลาที่จด) */
export function sortEntries(entries) {
  return (entries || []).slice().sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? 1 : -1;
    if (a.at !== b.at) return (a.at || '') < (b.at || '') ? 1 : -1;
    return 0;
  });
}

export function addEntry(data, entry) {
  const d = migrate(data);
  d.entries = sortEntries([...d.entries, entry]);
  return d;
}
export function updateEntry(data, id, patch) {
  const d = migrate(data);
  d.entries = sortEntries(d.entries.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)));
  return d;
}
export function removeEntry(data, id) {
  const d = migrate(data);
  d.entries = d.entries.filter((e) => e.id !== id);
  return d;
}

/** จัดกลุ่มตามวัน (ใหม่สุดก่อน) — UI วาดเป็นหัวข้อวันแล้วไล่รายการข้างใต้ */
export function groupByDay(entries) {
  const map = new Map();
  for (const e of sortEntries(entries)) {
    if (!map.has(e.day)) map.set(e.day, []);
    map.get(e.day).push(e);
  }
  return [...map.entries()].map(([day, items]) => ({
    day,
    items,
    words: items.reduce((a, x) => a + (Number(x.words) || 0), 0),
    minutes: items.reduce((a, x) => a + (Number(x.minutes) || 0), 0),
  }));
}

/** สรุปทั้งกอง — ใช้ขึ้นแถบสถิติหัวแผง */
export function summarize(entries) {
  const list = sortEntries(entries);
  const days = new Set(list.map((e) => e.day).filter(Boolean));
  return {
    entries: list.length,
    days: days.size,
    words: list.reduce((a, x) => a + (Number(x.words) || 0), 0),
    minutes: list.reduce((a, x) => a + (Number(x.minutes) || 0), 0),
    first: list.length ? list[list.length - 1].day : '',
    last: list.length ? list[0].day : '',
  };
}

/** กรองด้วยคำค้น (ข้อความ/แท็ก/วัน) + ช่วงวัน — คืนของใหม่เสมอ */
export function filterEntries(entries, { q = '', from = '', to = '', mood = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return sortEntries(entries).filter((e) => {
    if (from && e.day < from) return false;
    if (to && e.day > to) return false;
    if (mood && e.mood !== mood) return false;
    if (!needle) return true;
    const hay = [e.text, e.day, (e.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

// ───────── ส่งออก CSV ─────────
/**
 * หนึ่งช่องของ CSV ตาม RFC 4180
 * ครอบด้วยเครื่องหมายคำพูดเมื่อมี `,` `"` ขึ้นบรรทัดใหม่ หรือช่องว่างหัว-ท้าย
 * และ `"` ข้างในต้องกลายเป็น `""` — พลาดข้อนี้ = ไฟล์เปิดใน Excel แล้วคอลัมน์เลื่อนทั้งแถว
 */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (!/[",\r\n]/.test(s) && s === s.trim()) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export const CSV_COLUMNS = [
  ['day', T`วันที่`], ['at', T`เวลาที่จด`], ['text', T`บันทึก`],
  ['mood', T`อารมณ์`], ['tags', T`แท็ก`], ['words', T`จำนวนคำ`], ['minutes', T`นาที`],
];
/**
 * แปลงรายการเป็น CSV
 * - ขึ้นบรรทัดด้วย CRLF (สเปกกำหนด และ Excel บนวินโดวส์คาดหวังแบบนี้)
 * - `bom: true` ใส่ BOM นำหน้า — **จำเป็นสำหรับภาษาไทยใน Excel** ไม่งั้นได้ตัวต่างดาวทั้งไฟล์
 */
export function toCsv(entries, opts = {}) {
  const rows = [CSV_COLUMNS.map(([, label]) => csvCell(label)).join(',')];
  for (const e of sortEntries(entries)) {
    rows.push(CSV_COLUMNS.map(([key]) => {
      if (key === 'tags') return csvCell((e.tags || []).join(' '));
      if (key === 'mood') return csvCell(e.mood ? moodLabel(e.mood) : '');
      return csvCell(e[key]);
    }).join(','));
  }
  const text = rows.join('\r\n') + '\r\n';
  return opts.bom === false ? text : '﻿' + text;
}

/** ชื่อไฟล์ที่แนะนำตอนส่งออก (ผู้เรียกส่งวันที่มาเอง — โมดูลบริสุทธิ์ไม่รู้จักเวลา) */
export function csvFileName(projectTitle, stamp) {
  const safe = String(projectTitle || 'project').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project';
  return `${safe}-records-${stamp || ''}`.replace(/-+$/, '') + '.csv';
}
