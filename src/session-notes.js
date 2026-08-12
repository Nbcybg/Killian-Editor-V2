// session-notes.js — โน้ตระหว่างเขียน เชื่อมกับฉาก (ข้อ 85)
import { t, tf } from './i18n.js';
import { state, setStatus, el } from './core.js';

const NOTES_KEY = 'k2-session-notes';

// เก็บที่เดียว: มีโปรเจกต์ → project.khn.json (ติดไปกับงาน แก้นอกโปรแกรมได้)
//               ไม่มีโปรเจกต์ → localStorage (ชั่วคราว)
// เดิมเขียนทั้งสองที่แต่อ่านจาก localStorage อย่างเดียว → โน้ตไม่ติดไปกับโปรเจกต์ และ meta บวมไม่จำกัด
export function getSessionNotes() {
  if (state.meta) return state.meta.sessionNotes || [];
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; }
}

export async function saveSessionNotes(notes) {
  if (state.meta) {
    state.meta.sessionNotes = notes;
    try { const { saveProjectMeta } = await import('./app.js'); await saveProjectMeta(); } catch {}
    return;
  }
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch {}
}

export async function addSessionNote(text, sceneId, sceneTitle, future = false) {
  const notes = [...getSessionNotes(), {
    id: Date.now().toString(36), text, sceneId, sceneTitle,
    future: !!future, done: false,
    timestamp: new Date().toISOString(),
  }];
  await saveSessionNotes(notes);
  setStatus(future ? t('ui.notes.saveNoteDoDone') : t('ui.notes.saveNoteDone'));
  return notes.length;
}

/** โน้ต "ไว้ทำภายหลัง" ที่ยังไม่ได้ทำ — แสดงบนหน้าเส้นเวลา (Future Notes, ข้อ 85) */
export function getFutureNotes({ includeDone = false } = {}) {
  return getSessionNotes().filter((n) => n.future && (includeDone || !n.done));
}

/** ติ๊กว่าทำแล้ว/ยังไม่ทำ */
export async function setNoteDone(id, done = true) {
  const notes = getSessionNotes().map((n) => (n.id === id ? { ...n, done: !!done } : n));
  await saveSessionNotes(notes);
  setStatus(done ? t('ui.notes.doNoteDone') : t('ui.notes.backStuck'));
  return notes;
}

/** ลบโน้ตทีละอัน */
export async function removeSessionNote(id) {
  await saveSessionNotes(getSessionNotes().filter((n) => n.id !== id));
  setStatus(t('ui.notes.delNoteDone'));
}

/** โน้ตของฉากหนึ่ง — ใช้ตอนแสดงบนการ์ดฉากในเส้นเวลา */
export function notesForScene(sceneId) {
  if (!sceneId) return [];
  return getSessionNotes().filter((n) => n.sceneId === sceneId);
}

/**
 * แผง "Future Notes" แบบฝังได้ — ใช้บนหน้าเส้นเวลา
 * @param {HTMLElement} host  กล่องที่จะวาดลงไป (ล้างของเดิมให้)
 * @param {object} opts { onChanged, onOpenScene }
 */
export function renderFutureNotes(host, { onChanged = null, onOpenScene = null } = {}) {
  host.innerHTML = '';
  const pending = getFutureNotes();
  const done = getSessionNotes().filter((n) => n.future && n.done);
  host.append(el('div', 'fn-title', tf('ui.notes.do2', pending.length)));
  if (!pending.length) {
    host.append(el('div', 'dim', done.length
      ? tf('ui.notes.doneDoDoneList', done.length)
      : t('ui.notes.notHasNoteStuck')));
    return host;
  }
  const list = el('div', 'fn-list');
  for (const n of [...pending].reverse()) {
    const row = el('div', 'fn-row');
    const chk = el('input', 'fn-chk'); chk.type = 'checkbox';
    chk.title = t('ui.notes.doDone');
    chk.onclick = async (e) => { e.stopPropagation(); await setNoteDone(n.id, true); if (onChanged) onChanged(); };
    const body = el('div', 'fn-body');
    // ข้อความโน้ตมาจากผู้ใช้ → textContent เท่านั้น
    body.append(el('div', 'fn-text', n.text));
    let when = '';
    try { when = new Date(n.timestamp).toLocaleDateString('th-TH'); } catch { when = ''; }
    body.append(el('div', 'fn-meta', [n.sceneTitle && '📄 ' + n.sceneTitle, when].filter(Boolean).join(' · ')));
    if (n.sceneId && onOpenScene) {
      body.style.cursor = 'pointer';
      body.onclick = () => onOpenScene(n.sceneId, n.sceneTitle);
    }
    const del = el('span', 'fn-del', '✕');
    del.title = t('ui.notes.delNote');
    del.onclick = async (e) => { e.stopPropagation(); await removeSessionNote(n.id); if (onChanged) onChanged(); };
    row.append(chk, body, del);
    list.append(row);
  }
  host.append(list);
  return host;
}

// Quick note dialog
export async function quickNote(sceneId, sceneTitle) {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', t('ui.notes.noteQuick') + (sceneTitle || t('ui.common.msg4'))));
  const ta = el('textarea', 'k-dlg-input');
  ta.style.cssText = 'width:100%;min-height:100px;resize:vertical;font-family:inherit';
  box.append(ta);

  // ติ๊กไว้ = ไปโผล่ในแผง "ไว้ทำภายหลัง" บนหน้าเส้นเวลา (Future Notes)
  const futRow = el('label', 'fn-future-row');
  const fut = el('input'); fut.type = 'checkbox'; fut.className = 'wiki-check';
  futRow.append(fut, el('span', null, t('ui.notes.doShowTopPage')));
  box.append(futRow);

  // Show recent notes
  // copy ก่อน reverse — getSessionNotes คืน reference ของ state.meta.sessionNotes
  const notes = [...getSessionNotes()].reverse().slice(0, 5);
  if (notes.length) {
    const recent = el('div'); recent.style.cssText = 'margin-top:8px;max-height:120px;overflow-y:auto';
    recent.append(el('div', 'dim', t('ui.notes.latest')));
    for (const n of notes) {
      const r = el('div', 'k-menu-item');
      r.style.cssText = 'font-size:11px;cursor:pointer';
      r.textContent = n.text.slice(0, 80) + ' — ' + (n.sceneTitle || '');
      r.onclick = () => { ta.value = n.text; };
      recent.append(r);
    }
    box.append(recent);
  }

  const btns = el('div', 'k-dlg-btns');
  const saveB = el('button', 'k-ok', t('ui.common.save'));
  saveB.onclick = async () => {
    const text = ta.value.trim();
    if (!text) { ov.remove(); return; }
    await addSessionNote(text, sceneId, sceneTitle, fut.checked);
    ov.remove();
    // เส้นเวลาเปิดค้างอยู่ → อัปเดตแผง "ไว้ทำภายหลัง" ทันที
    if (fut.checked) {
      try { const { refreshOpenTimeline } = await import('./timeline-ui.js'); refreshOpenTimeline(); } catch {}
    }
  };
  const closeB = el('button', null, t('ui.common.close'));
  closeB.onclick = () => ov.remove();
  btns.append(saveB, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);
  ta.focus();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ดูโน้ตทั้งหมด
export async function showAllNotes() {
  const notes = [...getSessionNotes()].reverse();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', t('ui.notes.noteAll') + notes.length + ')'));
  const list = el('div', 'k-pick-list'); list.style.maxHeight = '50vh';
  if (!notes.length) {
    list.append(el('div', 'dim', t('ui.notes.notHasNotePress')));
  } else {
    for (const n of notes) {
      const row = el('div', 'k-menu-item');
      row.style.cssText = 'flex-direction:column;align-items:stretch;gap:2px';
      // ข้อความโน้ตมาจากผู้ใช้ → textContent เท่านั้น
      const body = el('div', null, (n.future ? (n.done ? '✅ ' : '📌 ') : '') + n.text.slice(0, 120));
      body.style.fontSize = '12px';
      const sub = el('small', null,
        [n.sceneTitle, new Date(n.timestamp).toLocaleString('th-TH'),
         n.future ? (n.done ? t('ui.notes.doDone') : t('ui.notes.do')) : ''].filter(Boolean).join(' · '));
      sub.style.color = 'var(--dim)';
      row.append(body, sub);
      list.append(row);
    }
  }
  box.append(list);
  const btns = el('div', 'k-dlg-btns');
  const clearB = el('button', 'k-danger', t('ui.common.clear'));
  clearB.onclick = async () => {
    const { confirmBox } = await import('./ui.js');
    if (!(await confirmBox(tf('ui.notes.clearNoteAllList', notes.length), t('ui.common.clear')))) return;
    await saveSessionNotes([]); ov.remove(); setStatus(t('ui.notes.clearNoteAllDone'));
  };
  const closeB = el('button', 'k-ok', t('ui.common.close'));
  closeB.onclick = () => ov.remove();
  btns.append(clearB, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}
