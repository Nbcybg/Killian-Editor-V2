// sprint-ui.js — [alpha.156] สปรินต์การเขียน: กล่องเริ่ม + ป้ายจับเวลาลอยมุมจอ
//
// ตรรกะเวลา/สถิติอยู่ที่ sprint-core.js · ที่นี่: นับคำจากแท็บ + วาด + เก็บประวัติลง project.khn.json (`sprints`)
//
// นับคำยังไง: จำ "จำนวนคำตอนเห็นครั้งแรก" ของแต่ละแท็บไว้ แล้วรวมส่วนต่าง
//   → เปิดฉากอื่นระหว่างรอบ ไม่ถูกนับทั้งฉากเป็น "คำที่เขียน" · ปิดแท็บไปแล้วส่วนต่างที่ทำไว้ยังนับอยู่
import { t, tf } from './i18n.js';
import { el, state, setStatus, log, logAction } from './core.js';
import { escClose } from './ui.js';
import { countWords } from './md.js';
import { startSprint, pauseSprint, resumeSprint, sprintStatus, finishSprint, appendSprintHistory,
         sprintSummary, clampMinutes } from './sprint-core.js';

// ES module: ค่าที่เปลี่ยนต้องอยู่ใน object (กฎเหล็กข้อ 2)
const SP = { s: null, timer: null, node: null, base: new Map(), delta: new Map(), wordsAt: 0, words: 0 };

function tabWords(tab) {
  try {
    if (tab.editor) return countWords(tab.editor.getMarkdown());
    if (tab.sp) return countWords(tab.sp.getMarkdown());
  } catch {}
  return null;
}
/** คำที่เพิ่มขึ้นนับตั้งแต่เริ่มรอบ (ทุกแท็บที่เคยเห็น) */
function writtenSoFar() {
  for (const tab of state.tabs.values()) {
    if (!tab.file || String(tab.file).startsWith('::')) continue;
    const n = tabWords(tab);
    if (n === null) continue;
    if (!SP.base.has(tab.file)) SP.base.set(tab.file, n);
    SP.delta.set(tab.file, n - SP.base.get(tab.file));
  }
  let sum = 0;
  for (const v of SP.delta.values()) sum += v;
  return sum;
}

export function sprintRunning() { return !!SP.s; }
export function sprintState() {
  return SP.s ? sprintStatus(SP.s, SP.words, Date.now()) : null;
}

function renderWidget() {
  if (!SP.s) { if (SP.node) { SP.node.remove(); SP.node = null; } return; }
  const now = Date.now();
  if (now - SP.wordsAt > 3000) { SP.words = writtenSoFar(); SP.wordsAt = now; }
  const st = sprintStatus(SP.s, SP.words, now);
  if (!SP.node) {
    SP.node = el('div', 'k-sprint');
    document.body.append(SP.node);
  }
  const n = SP.node;
  n.replaceChildren();
  n.classList.toggle('k-sprint-paused', st.paused);
  n.append(el('div', 'k-sprint-clock', st.label));
  n.append(el('div', 'k-sprint-words', SP.s.goal ? tf('ui.sprint.writtenGoal', Math.max(0, st.written), SP.s.goal)
                                                   : tf('ui.sprint.written', Math.max(0, st.written))));
  n.append(el('div', 'k-sprint-wpm dim', tf('ui.sprint.wpm', st.wpm)));
  if (SP.s.goal) {
    const bar = el('div', 'k-sprint-bar'); const fill = el('div', 'k-sprint-fill');
    fill.style.width = st.goalPct + '%'; bar.append(fill); n.append(bar);
  }
  const btns = el('div', 'k-sprint-btns');
  const bPause = el('button', null, st.paused ? t('ui.sprint.resume') : t('ui.sprint.pause'));
  bPause.onclick = () => {
    SP.s = st.paused ? resumeSprint(SP.s, Date.now()) : pauseSprint(SP.s, Date.now());
    renderWidget();
  };
  const bStop = el('button', 'k-danger', t('ui.sprint.stop'));
  bStop.onclick = () => stopSprint({ save: true });
  btns.append(bPause, bStop);
  n.append(btns);
  if (st.done) stopSprint({ save: true, timeUp: true });
}

/** เริ่มรอบ (ทางเดียวของกล่องและ e2e) */
export function beginSprint({ minutes = 25, goal = 0 } = {}) {
  if (SP.s) { setStatus(t('ui.sprint.alreadyRunning')); return false; }
  SP.base = new Map(); SP.delta = new Map();
  writtenSoFar();                                        // จำจุดเริ่มของทุกแท็บที่เปิดอยู่
  SP.words = 0; SP.wordsAt = Date.now();
  SP.s = startSprint({ minutes: clampMinutes(minutes), words: 0, goal, now: Date.now() });
  clearInterval(SP.timer);
  SP.timer = setInterval(renderWidget, 1000);
  renderWidget();
  logAction('sprint', tf('ui.sprint.running', SP.s.minutes), { goal: SP.s.goal });
  return true;
}

/**
 * จบรอบ — save = จดประวัติลงโปรเจกต์ (รอบที่ไม่ถึงนาทีไม่จด)
 * @returns {Promise<object|null>} ระเบียนของรอบนี้
 */
export async function stopSprint({ save = true, timeUp = false } = {}) {
  if (!SP.s) return null;
  clearInterval(SP.timer); SP.timer = null;
  SP.words = writtenSoFar();
  const rec = finishSprint(SP.s, SP.words, Date.now());
  SP.s = null;
  renderWidget();
  if (save && state.meta) {
    const before = (state.meta.sprints || []).length;
    state.meta.sprints = appendSprintHistory(state.meta.sprints, rec);
    if (state.meta.sprints.length !== before) {
      try { await (await import('./app.js')).saveProjectMeta(); }
      catch (e) { log('warn', t('ui.sprint.saveFail'), e); }
    }
  }
  setStatus((timeUp ? t('ui.sprint.timeUp') + ' ' : '') + tf('ui.sprint.doneStatus', rec.words, rec.actualMinutes, rec.wpm));
  logAction('sprint', tf('ui.sprint.doneStatus', rec.words, rec.actualMinutes, rec.wpm), rec);
  return rec;
}

/** ทะเบียนงานค้าง (กฎถาวร alpha.72): รอบที่กำลังจับเวลาอยู่หายตอนปิดโปรแกรม = ต้องขึ้นรายการ */
export function sprintDirtyList() {
  if (!SP.s) return [];
  return [{ key: '::sprint::', title: tf('ui.sprint.running', SP.s.minutes), file: '' }];
}

/** กล่องเริ่มสปรินต์ */
export function openSprintDialog() {
  if (SP.s) { setStatus(t('ui.sprint.alreadyRunning')); return null; }
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-sprint-dlg');
  box.append(el('div', 'k-dlg-title', t('ui.sprint.title')));
  box.append(el('div', 'k-hint', t('ui.sprint.hint')));
  const last = (state.meta && state.meta.sprints && state.meta.sprints.slice(-1)[0]) || null;
  const mk = (labelKey, val) => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, t(labelKey)));
    const i = el('input', 'k-dlg-input'); i.type = 'number'; i.min = '0'; i.value = String(val);
    r.append(i); box.append(r); return i;
  };
  const iMin = mk('ui.sprint.minutes', last ? last.minutes : 25);
  iMin.min = '1'; iMin.max = '180';
  const iGoal = mk('ui.sprint.goal', last ? last.goal || 0 : 0);
  const sum = sprintSummary(state.meta && state.meta.sprints);
  box.append(el('div', 'dim k-sprint-hist', sum.count ? tf('ui.sprint.history', sum.count, sum.words, sum.avgWpm)
                                                       : t('ui.sprint.noHistory')));
  const btns = el('div', 'k-dlg-btns');
  const bC = el('button', 'k-cancel', t('ui.common.close'));
  const bGo = el('button', 'k-ok', t('ui.sprint.start'));
  btns.append(bC, bGo); box.append(btns);
  ov.append(box); document.body.append(ov);
  const close = () => ov.remove();
  bC.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  escClose(ov, close);
  bGo.onclick = () => { close(); beginSprint({ minutes: +iMin.value, goal: +iGoal.value }); };
  iMin.focus();
  return { ov, close, iMin, iGoal, go: () => bGo.click() };
}
