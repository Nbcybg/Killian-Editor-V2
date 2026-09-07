// history-ui.js — [alpha.69] แผง "ประวัติการทำงาน" (History)
//
// แสดงไทม์ไลน์ว่าผู้ใช้ทำอะไรกับไฟล์ในโปรเจกต์ไปบ้าง แล้วกดย้อนกลับไปจุดไหนก็ได้
// ตัวจดและตัวลงมือย้อนกลับอยู่ที่ **main** (ดักที่ handler ของ fs — ดู main.js)
// เพราะเป็นจุดเดียวที่เห็นทุกการเขียนของทั้งโปรแกรม · แผงนี้เป็นแค่หน้าจอ + ปุ่ม
import { t, tf } from '../i18n.js';
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
  catch (e) { log('warn', t('ui.histOry.settingsNotebookHistoryNot'), e); return null; }
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
    h.append(el('div', 'dim k-hist-empty', t('ui.histOry.openProjectBeforeHas')));
    return true;
  }
  await loadHistory();
  const limit = HD.clampLimit(state.settings && state.settings.historyLimit);
  const rows = HD.timeline(s.journal, state.root);

  const bar = el('div', 'k-hist-bar');
  bar.append(el('span', 'k-hist-count', tf('ui.histOry.times', rows.length, limit)));
  const refresh = el('button', null, t('ui.common.refresh2'));
  refresh.onclick = () => renderHistoryPanel(h);
  const clear = el('button', 'k-danger', t('ui.histOry.clearHistory'));
  clear.onclick = async () => {
    const { confirmBox } = await import('../ui.js');
    if (!(await confirmBox(t('ui.histOry.clearHistoryAllFile')))) return;
    await kapi.historyClear();
    setStatus(t('ui.histOry.clearHistoryDone'));
    renderHistoryPanel(h);
  };
  bar.append(refresh, clear);
  h.append(bar);

  h.append(el('div', 'k-hist-hint',
    t('ui.histOry.historyNoteOnlyChange')
    + t('ui.histOry.adjustCountTimesKeep')));

  const list = el('div', 'k-hist-list');
  h.append(list);

  if (!rows.length) {
    list.append(el('div', 'dim k-hist-empty', t('ui.histOry.notHasChangeSave')));
    return true;
  }

  // แถวบนสุด = ตอนนี้ · กดที่แถวไหนคือ "ย้อนกลับไปสภาพหลังการกระทำนั้น"
  const now = el('div', 'k-hist-item k-hist-now');
  now.append(el('span', 'k-hist-dot'), el('span', 'k-hist-text', t('ui.histOry.now')));
  list.append(now);

  for (const r of rows) {
    const it = el('div', 'k-hist-item');
    it.dataset.seq = String(r.seq);
    it.append(el('span', 'k-hist-dot'));
    const mid = el('div', 'k-hist-mid');
    mid.append(el('div', 'k-hist-text', r.text));
    const meta = el('div', 'k-hist-meta');
    meta.append(el('span', null, fmtAt(r.at)));
    if (r.count > 1) meta.append(el('span', null, ' · ' + r.count + t('ui.histOry.file')));
    mid.append(meta);
    it.append(mid);
    const back = el('button', 'k-hist-back', t('ui.histOry.msg'));
    back.title = t('ui.histOry.restoreFileAllFile');
    back.onclick = () => revertTo(r.seq, r.text, h);
    it.append(back);
    list.append(it);
  }
  // จุดล่างสุด = ก่อนทุกอย่างที่ยังเก็บอยู่
  const zero = el('div', 'k-hist-item');
  zero.append(el('span', 'k-hist-dot'));
  const zmid = el('div', 'k-hist-mid');
  zmid.append(el('div', 'k-hist-text dim', t('ui.histOry.beforePageAllKeep')));
  zero.append(zmid);
  const zback = el('button', 'k-hist-back', t('ui.histOry.msg'));
  zback.onclick = () => revertTo(0, t('ui.histOry.beforePageAllKeep'), h);
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
  if (!plan.ops.length) { setStatus(t('ui.histOry.dot')); return false; }
  const { confirmBox } = await import('../ui.js');
  const ok = await confirmBox(
    tf('ui.histOry.undo', label)
    + tf('ui.histOry.doFileFile', plan.undone.length, plan.ops.length)
    + t('ui.histOry.fileOverwriteDotBack'));
  if (!ok) return false;
  s.busy = true;
  try {
    // งานที่ยังไม่บันทึกต้องลงไฟล์ให้จบก่อน ไม่งั้นการบันทึกครั้งถัดไปจะทับของที่เพิ่งคืน
    const { saveAllTabs, loadProject } = await import('../app.js');
    try { await saveAllTabs(); } catch {}
    const res = await kapi.historyRevert(seq);
    if (!res || res.ok === false) {
      setStatus(t('ui.histOry.undoNotOkPart'));
      log('warn', t('ui.histOry.historyUndoNotComplete'), res);
    } else {
      setStatus(tf('ui.histOry.undoDoneRestoreFile', res.restored, res.deleted));
      log('info', t('ui.histOry.historyUndoOk') + JSON.stringify(res));
    }
    // ไฟล์บนดิสก์เปลี่ยนไปทั้งชุด → โหลดโปรเจกต์ใหม่ทั้งก้อนคือทางเดียวที่ปลอดภัยจริง
    if (state.root) await loadProject(state.root);
  } catch (e) {
    log('error', t('ui.histOry.historyUndoFail'), e);
    setStatus(t('ui.histOry.undoFail') + (e && e.message ? e.message : e));
  } finally {
    s.busy = false;
  }
  try { await renderHistoryPanel(host || $('#history-body')); } catch {}
  return true;
}

// [alpha.126] `openHistory()` ถูกลบ — เป็นแค่ตัวห่อ
// `showPanel(id)` + `renderFeaturePanel(id)` ซึ่ง `togglePanel()` ของระบบแผงทำให้อยู่แล้ว
// (เมนู มุมมอง → แผง · ปุ่มบนแถบ · คีย์ลัด Ctrl+Alt+ตัวอักษร เดินทางนั้นทั้งหมด)
