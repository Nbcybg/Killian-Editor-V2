// project-lock-ui.js — [alpha.170 · ใช้หลายเครื่อง] ตัวล็อกโปรเจกต์ฝั่งหน้าจอ: ถามก่อนเปิด · ยืนยันเป็นระยะ · ปล่อยตอนปิด
//
// ตรรกะ (ตัดสินว่าใครถือ · หมดอายุไหม) อยู่ที่ `project-lock.js` (บริสุทธิ์ · unit `project-lock`)
// ไฟล์ล็อกเขียน/ลบที่ main (`lock:*` — ไม่ผ่านประวัติไฟล์ · ปิดโปรแกรมแล้ว main ลบของเซสชันนี้ให้เอง)
// ★ หน้าต่างแผงที่ฉีกออกมาไม่ถือล็อก (หน้าต่างหลักถือให้แล้ว) — ผู้เรียกข้ามเองด้วย PANEL_WIN

import { t, tf, log, el } from './core.js';
import { toast, escClose } from './ui.js';
import { fmtDateTime } from './locale.js';
import { makeLock, lockState, machineLabel } from './project-lock.js';
import { PROJECT_LOCK_BEAT_MS } from './timing.js';

const L = { root: '', timer: 0, since: 0, me: null };

async function me() {
  if (!L.me) { try { L.me = await kapi.lockMe(); } catch { L.me = null; } }
  return L.me;
}

/**
 * ก่อนเปิดโปรเจกต์: อีกเครื่องยังเปิดค้างอยู่ = ถาม · ผลคือ true (เปิดต่อ) / false (ยกเลิก)
 * ไม่มีล็อก · ล็อกหมดอายุ · ของเซสชันนี้เอง = เปิดได้เลย (หมดอายุของเครื่องอื่น = บอกเบา ๆ หลังเปิด)
 */
export async function checkProjectLock(root) {
  const m = await me();
  if (!m) return true;                                 // main รุ่นเก่า/ไม่มี IPC — ไม่ขวางการเปิด
  let lock = null;
  try { lock = await kapi.lockRead(root); } catch { lock = null; }
  const st = lockState(lock, m, Date.now());
  L.staleNote = null;
  if (st.state === 'stale' && !st.sameMachine && st.ageMs < 24 * 3600 * 1000) L.staleNote = st.other;
  if (st.state !== 'other') return true;
  log('info', 'project lock: held by ' + (st.other.machine || '?'), { root, beat: st.other.beat });
  const who = machineLabel(st.other.machine) || t('ui.lock.unknownMachine');
  const title = st.sameMachine ? tf('ui.lock.heldSameF', fmtDateTime(st.other.beat)) : tf('ui.lock.heldF', who, fmtDateTime(st.other.beat));
  const ok = await askLock(title, t('ui.lock.heldWhy'));
  if (ok) log('info', 'project lock: user opened anyway', { root, other: st.other.machine });
  return ok;
}

/** กล่องถามของตัวล็อก — หัวข้อสั้น + คำอธิบายใต้หัว (กล่อง choose() กว้างตามหัวข้อ = ยาวเต็มจอ) */
function askLock(title, detail) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-lockdlg');
    box.append(el('div', 'k-dlg-title', title), el('div', 'k-hint k-lockdlg-why', detail));
    const btns = el('div', 'k-dlg-btns');
    const no = el('button', 'k-cancel', t('ui.common.cancel'));
    const yes = el('button', 'k-ok', t('ui.lock.openAnyway'));
    btns.append(no, yes);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    no.onclick = () => done(false);
    yes.onclick = () => done(true);
    ov.onclick = (e) => { if (e.target === ov) done(false); };
    escClose(ov, () => done(false));
  });
}

/** หลังเปิดโปรเจกต์สำเร็จ: เขียนล็อกของเซสชันนี้ + ยืนยันเป็นระยะ */
export async function holdProjectLock(root) {
  const m = await me();
  if (!m) return;
  stopBeat();
  L.root = root; L.since = Date.now();
  const beat = async () => {
    if (L.root !== root) return;
    try { await kapi.lockWrite(root, makeLock({ ...m, now: Date.now(), since: L.since })); }
    catch (e) { log('warn', 'project lock: write failed', e); }
  };
  await beat();
  L.timer = setInterval(beat, PROJECT_LOCK_BEAT_MS);
  if (L.staleNote) {
    const o = L.staleNote; L.staleNote = null;
    toast(tf('ui.lock.lastOtherF', machineLabel(o.machine) || t('ui.lock.unknownMachine'), fmtDateTime(o.beat)), { level: 'info', ttl: 12000 });
  }
}

function stopBeat() { if (L.timer) { clearInterval(L.timer); L.timer = 0; } }

/** ปิดโปรเจกต์: หยุดยืนยัน + ลบล็อก (main ลบเฉพาะเมื่อยังเป็นของเซสชันนี้) */
export async function releaseProjectLock() {
  stopBeat();
  if (!L.root) return;
  L.root = '';
  try { await kapi.lockRelease(); } catch { /* ปิดโปรแกรมแล้ว main ลบให้อยู่ดี */ }
}
