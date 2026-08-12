// history-data.js — [alpha.69] แผง "ประวัติการทำงาน" (History): สมุดบันทึก + แผนการย้อนกลับ
//
// โจทย์: เก็บว่าผู้ใช้ทำอะไรไปบ้าง แล้วย้อนกลับไปจุดไหนก็ได้
//
// ทำไมไม่ใช้ "คำสั่งผกผัน" (undo แบบ command pattern): การกระทำในโปรแกรมนี้กระจายอยู่นับร้อยจุด
// (แก้ฉาก · เปลี่ยนชื่อ · ย้าย · ลบ · Wiki · Planner · นำเข้า/ส่งออก) ไล่แปะทีละจุดยังไงก็หลุด
// และจุดใหม่ที่เพิ่มทีหลังจะไม่มีประวัติเงียบ ๆ โดยไม่มีใครรู้
//
// ทางที่ใช้: **copy-on-write ที่คอขวดของระบบไฟล์** — ทุกการเขียนของทั้งโปรแกรมวิ่งผ่าน
// `H('fs:writeFile' / 'fs:move' / 'fs:remove' / …)` ใน main.js อยู่แล้ว (ท่าเดียวกับที่ alpha.67
// ดัก `panel:fileChanged` ที่ preload) → ก่อนเขียนทับ คัดสำเนาของเดิมเก็บเป็น "ก้อน" (blob)
// แล้วจดหนึ่งบรรทัดลงสมุด · จุดเรียกใหม่ที่เพิ่มทีหลังได้ประวัติไปด้วยฟรี ๆ
//
// รูปแบบเดียวใช้ได้กับทุกการกระทำ: บันทึกว่า **"ก่อนหน้านี้ไฟล์นี้มีเนื้ออะไร"**
//   before = blob id → ย้อนกลับ = เขียนเนื้อนั้นคืน
//   before = null    → ตอนนั้นไฟล์ยังไม่มี → ย้อนกลับ = ลบทิ้ง
// ย้าย/เปลี่ยนชื่อ = สองรายการในบันทึกเดียว (ต้นทางหายไป · ปลายทางถูกสร้าง/ทับ)
//
// ไฟล์นี้ **บริสุทธิ์** (ไม่แตะ fs/DOM/kapi) — ทั้งการต่อสมุด การตัดของเก่า และ **แผนการย้อนกลับ**
// เทสด้วย node ได้หมด · ฝั่งที่ลงมือทำจริงกับดิสก์อยู่ที่ main.js

import { T } from '../i18n.js';
export const HISTORY_SCHEMA = 1;
/** โฟลเดอร์เก็บสมุด + ก้อนเนื้อไฟล์เดิม (อยู่ในโปรเจกต์ — ย้ายโปรเจกต์ไปไหนประวัติตามไปด้วย) */
export const HISTORY_DIR = '.k2history';
export const HISTORY_FILE = 'history.json';
export const BLOB_DIR = 'blobs';

/** จำนวนครั้งที่เก็บย้อนหลัง — ผู้ใช้ตั้งได้ที่ตั้งค่าโปรเจกต์ */
export const DEFAULT_HISTORY_LIMIT = 32;
export const HISTORY_LIMIT_MIN = 4;
export const HISTORY_LIMIT_MAX = 500;
export function clampLimit(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return DEFAULT_HISTORY_LIMIT;
  return Math.min(HISTORY_LIMIT_MAX, Math.max(HISTORY_LIMIT_MIN, v));
}

export function newJournal() { return { schema: HISTORY_SCHEMA, seq: 0, entries: [] }; }

/** อ่านของที่โหลดมา → โครงมาตรฐาน (ไฟล์พัง/ของเก่า/ค่าว่าง ต้องไม่ทำโปรแกรมล้ม) */
export function migrate(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const entries = (Array.isArray(d.entries) ? d.entries : [])
    .filter((e) => e && typeof e === 'object' && Number.isFinite(Number(e.seq)))
    .map((e) => ({
      seq: Number(e.seq),
      at: e.at || '',
      kind: e.kind || 'write',
      label: e.label || '',
      files: (Array.isArray(e.files) ? e.files : []).map((f) => ({
        path: String(f && f.path || ''),
        before: f && f.before ? String(f.before) : null,
        wasDir: !!(f && f.wasDir),
      })).filter((f) => f.path),
    }))
    .sort((a, b) => a.seq - b.seq);
  const maxSeq = entries.length ? entries[entries.length - 1].seq : 0;
  return { schema: HISTORY_SCHEMA, seq: Math.max(Number(d.seq) || 0, maxSeq), entries };
}

/**
 * ต่อบันทึกใหม่หนึ่งบรรทัด แล้วตัดของเก่าให้เหลือไม่เกิน `limit`
 * @returns {{journal:object, dropped:string[]}} `dropped` = blob ที่ไม่มีใครอ้างแล้ว (ผู้เรียกลบทิ้ง)
 */
export function addRecord(journal, rec, limit = DEFAULT_HISTORY_LIMIT) {
  const j = migrate(journal);
  const files = (rec && rec.files || []).filter((f) => f && f.path);
  if (!files.length) return { journal: j, dropped: [] };
  j.seq += 1;
  j.entries.push({
    seq: j.seq,
    at: rec.at || '',
    kind: rec.kind || 'write',
    label: rec.label || '',
    files: files.map((f) => ({ path: f.path, before: f.before || null, wasDir: !!f.wasDir })),
  });
  return prune(j, limit);
}

/**
 * ตัดบันทึกเก่าให้เหลือไม่เกิน `limit` ครั้ง
 * blob ที่ยังถูกบันทึกที่เหลืออ้างอยู่ **ห้ามลบ** (ไฟล์เดียวอาจถูกอ้างจากหลายบรรทัด)
 */
export function prune(journal, limit = DEFAULT_HISTORY_LIMIT) {
  const j = migrate(journal);
  const max = clampLimit(limit);
  if (j.entries.length <= max) return { journal: j, dropped: [] };
  const cut = j.entries.slice(0, j.entries.length - max);
  const keep = j.entries.slice(j.entries.length - max);
  const live = referencedBlobs({ entries: keep });
  const dropped = [];
  for (const e of cut) for (const f of e.files) {
    if (f.before && !live.has(f.before) && !dropped.includes(f.before)) dropped.push(f.before);
  }
  j.entries = keep;
  return { journal: j, dropped };
}

/** blob ทั้งหมดที่ยังถูกอ้างอยู่ */
export function referencedBlobs(journal) {
  const s = new Set();
  for (const e of (journal && journal.entries) || []) for (const f of e.files || []) {
    if (f.before) s.add(f.before);
  }
  return s;
}

/**
 * **แผนการย้อนกลับไปยังจุดหลังบันทึกหมายเลข `seq`**
 *
 * = ถอนทุกบันทึกที่ใหม่กว่า `seq` (จากใหม่ไปเก่า)
 * ไฟล์เดียวอาจถูกแตะหลายครั้งในช่วงนั้น → สิ่งที่ถูกต้องคือ **สภาพก่อนการแตะครั้งแรกสุด**
 * (เอาบันทึกที่เก่าที่สุดของ path นั้นเป็นตัวตั้ง) — ทำให้แผนสั้นลงและไม่ต้องเขียนไฟล์ซ้ำหลายรอบ
 *
 * `seq = 0` = ย้อนกลับไปก่อนบันทึกทุกบรรทัดที่ยังเก็บอยู่
 * @returns {{ops:Array<{op:'restore'|'delete',path:string,blob:string|null}>, undone:number[], entries:object[]}}
 */
export function planRevert(journal, seq) {
  const j = migrate(journal);
  const target = Number(seq) || 0;
  const rollback = j.entries.filter((e) => e.seq > target);
  const byPath = new Map();                       // path → before ของการแตะครั้งแรกสุดในช่วงนี้
  for (const e of rollback) {                     // entries เรียงจากเก่าไปใหม่อยู่แล้ว
    for (const f of e.files) {
      if (!byPath.has(f.path)) byPath.set(f.path, f);
    }
  }
  const ops = [];
  for (const [path, f] of byPath) {
    ops.push(f.before ? { op: 'restore', path, blob: f.before }
                      : { op: 'delete', path, blob: null, wasDir: !!f.wasDir });
  }
  // ลบก่อนคืน — กันเคสย้ายไฟล์ (ปลายทางต้องหายก่อน ต้นทางถึงจะคืนกลับได้โดยไม่ชนกัน)
  ops.sort((a, b) => (a.op === b.op ? 0 : a.op === 'delete' ? -1 : 1));
  return { ops, undone: rollback.map((e) => e.seq), entries: rollback };
}

/**
 * สมุดหลังย้อนกลับสำเร็จ — บันทึกที่ถูกถอนออกไปแล้วต้องหายไปด้วย (ไม่งั้นกดย้ำแล้วงง)
 *
 * **`seq` ไม่ถูกรีเซ็ตกลับโดยตั้งใจ** — ตัวนับต้องเดินหน้าอย่างเดียวตลอดอายุโปรเจกต์
 * ถ้าย้อนกลับแล้วลดตัวนับ เลขที่เคยใช้ไปแล้วจะถูกแจกซ้ำให้บันทึกใหม่ → ทุกอย่างที่อ้าง seq
 * (ปุ่มย้อนกลับในแผง · แผนที่คำนวณค้างไว้) จะชี้ผิดตัวแบบเงียบ ๆ · ถูกแล้วที่เห็น entries ว่างแต่ seq ค้างสูง
 */
export function afterRevert(journal, seq) {
  const j = migrate(journal);
  const target = Number(seq) || 0;
  const keep = j.entries.filter((e) => e.seq <= target);
  const live = referencedBlobs({ entries: keep });
  const dropped = [];
  for (const e of j.entries) {
    if (e.seq <= target) continue;
    for (const f of e.files) if (f.before && !live.has(f.before) && !dropped.includes(f.before)) dropped.push(f.before);
  }
  return { journal: { ...j, entries: keep }, dropped };
}

// ───────── คำอธิบายที่ผู้ใช้อ่านรู้เรื่อง ─────────
const KIND_LABEL = {
  write: T`แก้ไข`, create: T`สร้าง`, remove: T`ลบ`, move: T`ย้าย/เปลี่ยนชื่อ`,
  copy: T`คัดลอกเข้ามา`, image: T`เพิ่มรูป`,
};
export const kindLabel = (k) => KIND_LABEL[k] || T`เปลี่ยนแปลง`;

/** ชื่อไฟล์แบบสั้น (เทียบกับรากโปรเจกต์) — สมุดเก็บ path เต็มเพื่อคืนไฟล์ได้ถูกที่ */
export function relPath(p, root) {
  const norm = (s) => String(s || '').replace(/\\/g, '/');
  const a = norm(p), b = norm(root).replace(/\/+$/, '');
  return b && a.toLowerCase().startsWith(b.toLowerCase() + '/') ? a.slice(b.length + 1) : a;
}

/** หนึ่งบรรทัดในแผง: "แก้ไข · บท1/ฉาก1.md" (มากกว่า 1 ไฟล์ → บอกจำนวน) */
export function describe(entry, root) {
  if (!entry) return '';
  const files = entry.files || [];
  const head = entry.label || kindLabel(entry.kind);
  if (!files.length) return head;
  const first = relPath(files[0].path, root);
  return files.length === 1 ? `${head} · ${first}` : `${head} · ${first} +${files.length - 1}`;
}

/** ประวัติที่พร้อมวาด (ใหม่สุดอยู่บน) + ธงว่าย้อนกลับมาถึงจุดนี้ได้ไหม */
export function timeline(journal, root) {
  const j = migrate(journal);
  return j.entries.slice().reverse().map((e) => ({
    seq: e.seq, at: e.at, kind: e.kind,
    text: describe(e, root),
    files: (e.files || []).map((f) => relPath(f.path, root)),
    count: (e.files || []).length,
  }));
}
