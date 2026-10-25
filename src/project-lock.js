// project-lock.js — [alpha.170 · ใช้หลายเครื่อง] "โปรเจกต์นี้เปิดอยู่ที่เครื่องไหน" + สำเนาที่ตัวซิงก์คลาวด์สร้างเมื่อไฟล์ชนกัน
//
// ที่มา: ผลสำรวจผู้ใช้ข้อ 2 "ไม่มีซิงก์ข้ามเครื่อง" (~94 คน) — โครงไฟล์ของโปรแกรม (Markdown + JSON ในโฟลเดอร์)
// ซิงก์ผ่าน Google Drive / iCloud / Dropbox / OneDrive ได้อยู่แล้ว · ที่ขาดคือ "รู้ตัวก่อนจะเขียนทับกัน":
//   1. ตัวล็อก `.k2lock.json` ในรากโปรเจกต์ (ตัวซิงก์พาไปอีกเครื่องเอง) — เปิดโปรเจกต์ที่อีกเครื่องยังเปิดค้าง = เตือนก่อน
//   2. สำเนาที่ตัวซิงก์สร้างเมื่อสองเครื่องแก้ไฟล์เดียวกัน (`ฉาก (conflicted copy).md` ฯลฯ) — ตัวตรวจสุขภาพบอกว่าคืออะไร
// บริสุทธิ์ 100% · unit `project-lock` · ตัวต่อกับไฟล์/หน้าจอ = `project-lock-ui.js`

import { PROJECT_LOCK_STALE_MS } from './timing.js';

/** ชื่อไฟล์ล็อก — จุดนำหน้า = ตัวเดินโฟลเดอร์ทุกตัวของโปรแกรมข้ามอยู่แล้ว (ค้นหา · เปิดไฟล์ด่วน · ตัวตรวจสุขภาพ) */
export const LOCK_FILE = '.k2lock.json';

/**
 * เนื้อไฟล์ล็อกของเครื่องนี้
 * @param {{machine:string, user?:string, session:string, app?:string, now:number, since?:number}} me
 */
export function makeLock(me) {
  return {
    machine: String(me.machine || ''),
    user: String(me.user || ''),
    session: String(me.session || ''),
    app: String(me.app || ''),
    // หมายเลขโปรเซสของ main — เครื่องเดียวกันตรวจได้ว่ายังรันอยู่ไหม (โปรแกรมเปิดได้ตัวเดียว = ล็อกของโปรเซสที่ตายแล้วคือโปรแกรมที่ล่ม)
    pid: Number(me.pid) || 0,
    since: new Date(me.since || me.now).toISOString(),
    beat: new Date(me.now).toISOString(),
  };
}

const timeOf = (iso) => { const t = new Date(iso).getTime(); return Number.isFinite(t) ? t : 0; };

/**
 * ตัดสินจากไฟล์ล็อกที่อ่านได้ (null = ไม่มี/อ่านไม่ออก)
 * @returns {{state:'free'|'mine'|'stale'|'other', other?:object, sameMachine?:boolean, ageMs?:number}}
 *   free  = ไม่มีใครถือ → เปิดได้เลย
 *   mine  = เซสชันนี้เองถือ (โหลดโปรเจกต์ซ้ำ)
 *   stale = มีคนถือแต่ไม่ได้ยืนยันว่ายังเปิดอยู่นานเกิน PROJECT_LOCK_STALE_MS → ถือว่าปิดไปแล้ว (เครื่องดับ/หลับ)
 *   other = อีกเครื่อง (หรืออีกโปรแกรมในเครื่องเดียวกัน) ยังเปิดอยู่ → ต้องถาม
 */
export function lockState(lock, me, now, staleMs = PROJECT_LOCK_STALE_MS) {
  if (!lock || typeof lock !== 'object' || !lock.session) return { state: 'free' };
  if (lock.session === me.session) return { state: 'mine' };
  const age = Math.max(0, now - timeOf(lock.beat));
  const sameMachine = !!lock.machine && lock.machine === me.machine;
  if (!timeOf(lock.beat) || age > staleMs) return { state: 'stale', other: lock, sameMachine, ageMs: age };
  // เครื่องเดียวกันแต่โปรเซสที่ถือล็อกไม่อยู่แล้ว (`alive:false` — main ตรวจให้ตอนอ่าน) = โปรแกรมล่ม/ถูกปิดแรง → ไม่ต้องถาม
  if (sameMachine && lock.alive === false) return { state: 'stale', other: lock, sameMachine, ageMs: age };
  return { state: 'other', other: lock, sameMachine, ageMs: age };
}

/**
 * ปิดโปรเจกต์: ลบไฟล์ล็อกเฉพาะเมื่อยังเป็นของเซสชันนี้ (อีกเครื่องรับช่วงไปแล้ว = ห้ามลบของเขา)
 */
export function shouldRelease(lock, me) {
  return !!lock && lock.session === me.session;
}

// ────────────────────────────────────────────────────────────────
// สำเนาจากตัวซิงก์เมื่อไฟล์ชนกัน
// ────────────────────────────────────────────────────────────────

/**
 * รูปชื่อสำเนาของตัวซิงก์แต่ละเจ้า → ชื่อไฟล์ต้นทาง (ไม่มีนามสกุล) หรือ null
 * ใช้ตัดสินเฉพาะ "ไฟล์ที่ไม่มีใครอ้าง" ที่วางอยู่ข้างไฟล์ต้นทางที่มีอยู่จริงเท่านั้น (ไม่งั้นชื่อธรรมดาอย่าง "ฉาก 2" ถูกเดาผิด)
 */
const PATTERNS = [
  // Dropbox: "ชื่อ (conflicted copy).md" · "ชื่อ (ชื่อเครื่อง's conflicted copy 2024-01-02).md" · ภาษาอื่นของ Dropbox ใช้คำว่า copy/คัดลอก ต่างกัน
  { app: 'dropbox', re: /^(.*?) \([^()]*conflicted copy[^()]*\)$/i },
  // Syncthing: "ชื่อ.sync-conflict-20240102-123456-ABCDEFG"
  { app: 'syncthing', re: /^(.*?)\.sync-conflict-\d{8}-\d{6}(?:-[A-Z0-9]+)?$/ },
  // OneDrive: "ชื่อ-ชื่อเครื่อง" · "ชื่อ-ชื่อเครื่อง-2"
  { app: 'onedrive', re: /^(.*)-[A-Za-z0-9][A-Za-z0-9_-]{1,30}?(?:-\d+)?$/ },
  // Google Drive (สำหรับเดสก์ท็อป): "ชื่อ (1)"
  { app: 'gdrive', re: /^(.*?) \((\d{1,3})\)$/ },
  // iCloud: "ชื่อ 2"
  { app: 'icloud', re: /^(.*?) (\d{1,3})$/ },
];

/**
 * @param {string} name ชื่อไฟล์ (มีนามสกุล) ที่ไม่มีใครอ้าง
 * @param {Iterable<string>} siblings ชื่อไฟล์ที่ "ทะเบียนอ้างอยู่" ในโฟลเดอร์เดียวกัน
 * @returns {{of:string, app:string}|null} of = ชื่อไฟล์ต้นทาง (มีนามสกุล)
 */
export function syncCopyOf(name, siblings) {
  const m = /^(.*?)(\.[^.]+)?$/.exec(String(name || ''));
  const base = m[1], ext = m[2] || '';
  const sib = new Map();
  for (const s of siblings || []) sib.set(String(s).toLowerCase(), String(s));
  for (const p of PATTERNS) {
    const r = p.re.exec(base);
    if (!r || !r[1]) continue;
    const of = sib.get((r[1] + ext).toLowerCase());
    if (of && of.toLowerCase() !== String(name).toLowerCase()) return { of, app: p.app };
  }
  return null;
}

/** ชื่อเครื่องที่อ่านง่าย (ตัดโดเมน `.local` ของ macOS) */
export function machineLabel(m) {
  return String(m || '').replace(/\.(local|lan|home)$/i, '').trim();
}
