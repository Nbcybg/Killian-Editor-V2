// history-ui.js — [alpha.69] แผง "ประวัติการทำงาน" (History)
//
// แสดงไทม์ไลน์ว่าผู้ใช้ทำอะไรกับไฟล์ในโปรเจกต์ไปบ้าง แล้วกดย้อนกลับไปจุดไหนก็ได้
// ตัวจดและตัวลงมือย้อนกลับอยู่ที่ **main** (ดักที่ handler ของ fs — ดู main.js)
// เพราะเป็นจุดเดียวที่เห็นทุกการเขียนของทั้งโปรแกรม · แผงนี้เป็นแค่หน้าจอ + ปุ่ม
import { $, el, state, setStatus, log } from '../core.js';
import * as HD from './history-data.js';

const S = () => (state._history || (state._history = { journal: null, busy: false }));
export function resetHistory() { state._history = null; }

/** บอก main ว่าให้จดประวัติของโปรเจกต์ไหน เก็บกี่ครั้ง (เรียกตอนเปิดโปรเจกต์ + ตอนแก้ตั้งค่า) */
export async function configHistory() {
  if (!kapi.historyConfig) return null;
  const limit = HD.clampLimit(state.settings && state.settings.historyLimit);
  const enabled = !(state.settings && state.settings.historyOff === true);
  try { return await kapi.historyConfig({ root: state.root || '', limit, enabled }); }
  catch (e) { log('warn', 'ตั้งค่าสมุดประวัติไม่สำเร็จ', e); return null; }
}
export async function loadHistory() {
  const s = S();
  try { s.journal = HD.migrate(await kapi.historyList()); }
  catch { s.journal = HD.newJournal(); }
  return s.journal;
}

const fmtAt = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
};

export async function renderHistoryPanel(host) {
  const h = host || $('#history-body');
  if (!h) return false;
  const s = S();
  h.replaceChildren();
  h.classList.add('k-hist');

  if (!state.root) {
    h.append(el('div', 'dim k-hist-empty', 'เปิดโปรเจกต์ก่อนจึงจะมีประวัติ'));
    return true;
  }
  await loadHistory();
  const limit = HD.clampLimit(state.settings && state.settings.historyLimit);
  const rows = HD.timeline(s.journal, state.root);

  const bar = el('div', 'k-hist-bar');
  bar.append(el('span', 'k-hist-count', `${rows.length}/${limit} ครั้ง`));
  const refresh = el('button', null, '🔄 รีเฟรช');
  refresh.onclick = () => renderHistoryPanel(h);
  const clear = el('button', 'k-danger', '🗑 ล้างประวัติ');
  clear.onclick = async () => {
    const { confirmBox } = await import('../ui.js');
    if (!(await confirmBox('ล้างประวัติทั้งหมด? (ไฟล์งานไม่ถูกแตะ — หายแค่ความสามารถในการย้อนกลับ)'))) return;
    await kapi.historyClear();
    setStatus('ล้างประวัติแล้ว');
    renderHistoryPanel(h);
  };
  bar.append(refresh, clear);
  h.append(bar);

  h.append(el('div', 'k-hist-hint',
    'ประวัติจดเฉพาะ "การเปลี่ยนแปลงที่ลงไฟล์แล้ว" — การพิมพ์ที่ยังไม่บันทึกใช้ Ctrl+Z ตามปกติ '
    + '· ปรับจำนวนครั้งที่เก็บได้ที่ ตั้งค่า → ทั่วไป'));

  const list = el('div', 'k-hist-list');
  h.append(list);

  if (!rows.length) {
    list.append(el('div', 'dim k-hist-empty', '(ยังไม่มีการเปลี่ยนแปลงที่บันทึกไว้)'));
    return true;
  }

  // แถวบนสุด = ตอนนี้ · กดที่แถวไหนคือ "ย้อนกลับไปสภาพหลังการกระทำนั้น"
  const now = el('div', 'k-hist-item k-hist-now');
  now.append(el('span', 'k-hist-dot'), el('span', 'k-hist-text', 'ตอนนี้'));
  list.append(now);

  for (const r of rows) {
    const it = el('div', 'k-hist-item');
    it.dataset.seq = String(r.seq);
    it.append(el('span', 'k-hist-dot'));
    const mid = el('div', 'k-hist-mid');
    mid.append(el('div', 'k-hist-text', r.text));
    const meta = el('div', 'k-hist-meta');
    meta.append(el('span', null, fmtAt(r.at)));
    if (r.count > 1) meta.append(el('span', null, ' · ' + r.count + ' ไฟล์'));
    mid.append(meta);
    it.append(mid);
    const back = el('button', 'k-hist-back', '↩ ย้อนมาที่นี่');
    back.title = 'คืนไฟล์ทุกไฟล์กลับไปเป็นสภาพ "หลังการกระทำนี้"';
    back.onclick = () => revertTo(r.seq, r.text, h);
    it.append(back);
    list.append(it);
  }
  // จุดล่างสุด = ก่อนทุกอย่างที่ยังเก็บอยู่
  const zero = el('div', 'k-hist-item');
  zero.append(el('span', 'k-hist-dot'));
  const zmid = el('div', 'k-hist-mid');
  zmid.append(el('div', 'k-hist-text dim', 'ก่อนหน้าทั้งหมดที่เก็บไว้'));
  zero.append(zmid);
  const zback = el('button', 'k-hist-back', '↩ ย้อนมาที่นี่');
  zback.onclick = () => revertTo(0, 'ก่อนหน้าทั้งหมดที่เก็บไว้', h);
  zero.append(zback);
  list.append(zero);
  return true;
}

/**
 * ย้อนกลับจริง — เป็นการกระทำที่**ทับไฟล์งานของผู้ใช้** จึงต้องถามก่อนเสมอ
 * และต้องบันทึกงานที่ค้างอยู่ก่อน ไม่งั้นกด Ctrl+S ทีหลังจะทับของที่เพิ่งคืนมา
 */
async function revertTo(seq, label, host) {
  const s = S();
  if (s.busy) return false;
  const plan = HD.planRevert(s.journal, seq);
  if (!plan.ops.length) { setStatus('อยู่ที่จุดนี้อยู่แล้ว'); return false; }
  const { confirmBox } = await import('../ui.js');
  const ok = await confirmBox(
    `ย้อนกลับไปที่ "${label}"?\n\n`
    + `จะถอน ${plan.undone.length} การกระทำ และแตะไฟล์ ${plan.ops.length} ไฟล์\n`
    + 'ไฟล์ที่ถูกเขียนทับหลังจุดนั้นจะกลับไปเป็นของเดิม — ย้อนกลับซ้ำอีกทีไม่ได้');
  if (!ok) return false;
  s.busy = true;
  try {
    // งานที่ยังไม่บันทึกต้องลงไฟล์ให้จบก่อน ไม่งั้นการบันทึกครั้งถัดไปจะทับของที่เพิ่งคืน
    const { saveAllTabs, loadProject } = await import('../app.js');
    try { await saveAllTabs(); } catch {}
    const res = await kapi.historyRevert(seq);
    if (!res || res.ok === false) {
      setStatus('ย้อนกลับไม่สำเร็จบางส่วน (ดูรายละเอียดในแผงบันทึก)');
      log('warn', 'history: ย้อนกลับไม่ครบ', res);
    } else {
      setStatus(`ย้อนกลับแล้ว — คืน ${res.restored} ไฟล์ · ลบ ${res.deleted} ไฟล์`);
      log('info', 'history: ย้อนกลับสำเร็จ ' + JSON.stringify(res));
    }
    // ไฟล์บนดิสก์เปลี่ยนไปทั้งชุด → โหลดโปรเจกต์ใหม่ทั้งก้อนคือทางเดียวที่ปลอดภัยจริง
    if (state.root) await loadProject(state.root);
  } catch (e) {
    log('error', 'history: ย้อนกลับล้มเหลว', e);
    setStatus('ย้อนกลับล้มเหลว: ' + (e && e.message ? e.message : e));
  } finally {
    s.busy = false;
  }
  try { await renderHistoryPanel(host || $('#history-body')); } catch {}
  return true;
}

export async function openHistory() {
  const { showPanel } = await import('../panels/panel-ui.js');
  const { renderFeaturePanel } = await import('../app.js');
  showPanel('history');
  await renderFeaturePanel('history');
}
