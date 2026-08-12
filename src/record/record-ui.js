// record-ui.js — [alpha.69] แผง "บันทึกประจำวัน" (Record)
//
// ผู้ใช้จดว่าวันนี้ทำอะไรไปบ้าง (เหมือน remark) แล้วส่งออกเป็น CSV ได้
// ต่างจากสมุดโน้ตด่วนตรงที่ตัวนี้ **ผูกกับวันที่ + เก็บเป็นไฟล์ของโปรเจกต์** จึงเอาไปทำสรุปได้จริง
//
// ตรรกะ/ตัวเขียน CSV อยู่ใน record-data.js (บริสุทธิ์ · มี unit test) — ไฟล์นี้มีแต่เรื่องหน้าจอ
import { t as tt, t } from '../i18n.js';
import { $, el, state, setStatus, log } from '../core.js';
import * as RD from './record-data.js';

const S = () => (state._record || (state._record = { data: null, q: '', mood: '', editing: null }));

function recFilePath() {
  return state.root ? state.root.replace(/[\\/]+$/, '') + '/' + RD.RECORD_FILE : '';
}
export async function loadRecords() {
  const s = S();
  if (!state.root) { s.data = RD.migrate(null); return s.data; }
  const p = await kapi.join(state.root, RD.RECORD_FILE);
  try { s.data = RD.migrate(await kapi.readJson(p)); }
  catch { s.data = RD.migrate(null); }
  return s.data;
}
async function saveRecords(next) {
  const s = S();
  s.data = next;
  if (!state.root) return false;
  const p = await kapi.join(state.root, RD.RECORD_FILE);
  await kapi.writeFile(p, JSON.stringify(next, null, 2));
  return true;
}
/** id ที่ไม่ซ้ำ — โมดูลบริสุทธิ์ห้ามใช้ Date.now เอง จึงสร้างที่นี่แล้วส่งเข้าไป */
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** ล้างสถานะเมื่อปิดโปรเจกต์ (ไม่งั้นโปรเจกต์ใหม่เห็นบันทึกของเก่า) */
export function resetRecords() { state._record = null; }

export async function renderRecordPanel(host) {
  const h = host || $('#record-body');
  if (!h) return false;
  const s = S();
  if (!s.data) await loadRecords();
  h.replaceChildren();
  h.classList.add('k-rec');

  if (!state.root) {
    h.append(el('div', 'dim k-rec-empty', tt('ui.recOrd.openProjectBeforeNote')));
    return true;
  }

  // ── แถบเครื่องมือ (flex:0 0 auto — ห้ามยืด ไม่งั้นรายการข้างล่างไม่เหลือที่) ──
  const bar = el('div', 'k-rec-bar');
  const q = el('input', 'k-rec-q'); q.type = 'search';
  q.placeholder = tt('ui.recOrd.searchSaveTextTag');
  q.value = s.q;
  q.oninput = () => { s.q = q.value; drawList(); };
  const moodSel = el('select', 'k-rec-mood-f');
  for (const m of RD.MOODS) {
    const o = el('option', null, m.key ? m.label : tt('ui.recOrd.allMood')); o.value = m.key; moodSel.append(o);
  }
  moodSel.value = s.mood;
  moodSel.onchange = () => { s.mood = moodSel.value; drawList(); };
  const csvBtn = el('button', null, tt('ui.recOrd.exportCSV'));
  csvBtn.onclick = exportCsv;
  bar.append(q, moodSel, csvBtn);
  h.append(bar);

  // ── ช่องจดของวันนี้ ──
  const form = el('div', 'k-rec-form');
  const today = RD.dayKey(new Date());
  const dayIn = el('input', 'k-rec-day'); dayIn.type = 'date'; dayIn.value = today;
  const ta = el('textarea', 'k-rec-text');
  ta.placeholder = tt('ui.recOrd.do');
  ta.rows = 3;
  const mood2 = el('select', 'k-rec-mood');
  for (const m of RD.MOODS) { const o = el('option', null, m.label); o.value = m.key; mood2.append(o); }
  const words = el('input', 'k-rec-num'); words.type = 'number'; words.min = '0'; words.placeholder = tt('ui.common.word2');
  const mins = el('input', 'k-rec-num'); mins.type = 'number'; mins.min = '0'; mins.placeholder = tt('ui.common.min');
  const tags = el('input', 'k-rec-tags'); tags.placeholder = tt('ui.recOrd.tagSkip');
  const add = el('button', 'k-rec-add', tt('ui.recOrd.save2'));
  add.onclick = async () => {
    const text = ta.value.trim();
    if (!text) { setStatus(tt('ui.recOrd.cantWrite')); ta.focus(); return; }
    const entry = RD.newEntry(newId(), dayIn.value || today, {
      at: new Date().toISOString(), text, mood: mood2.value,
      words: words.value, minutes: mins.value,
      tags: tags.value.split(/\s+/).filter(Boolean),
    });
    await saveRecords(RD.addEntry(s.data, entry));
    ta.value = ''; words.value = ''; mins.value = ''; tags.value = '';
    setStatus(tt('ui.recOrd.noteSaveDone'));
    drawStats(); drawList();
  };
  const row2 = el('div', 'k-rec-form-row');
  row2.append(dayIn, mood2, words, mins, tags, add);
  form.append(ta, row2);
  h.append(form);

  const stats = el('div', 'k-rec-stats');
  h.append(stats);
  // ── รายการ (ตัวเดียวที่ยืด + เลื่อนเอง) ──
  const list = el('div', 'k-rec-list');
  h.append(list);

  function drawStats() {
    const sum = RD.summarize(s.data.entries);
    stats.replaceChildren();
    for (const [label, val] of [[tt('ui.common.list2'), sum.entries], [tt('ui.recOrd.msg'), sum.days],
                                [tt('ui.recOrd.wordMerge'), sum.words.toLocaleString()], [tt('ui.recOrd.minMerge'), sum.minutes]]) {
      const b = el('span', 'k-rec-stat');
      b.append(el('b', null, String(val)), document.createTextNode(' ' + label));
      stats.append(b);
    }
  }
  function drawList() {
    list.replaceChildren();
    const rows = RD.filterEntries(s.data.entries, { q: s.q, mood: s.mood });
    if (!rows.length) {
      list.append(el('div', 'dim k-rec-empty',
        s.data.entries.length ? tt('ui.recOrd.notFoundSaveAt') : tt('ui.recOrd.notHasSaveWrite')));
      return;
    }
    for (const g of RD.groupByDay(rows)) {
      const head = el('div', 'k-rec-day-head');
      head.append(el('span', 'k-rec-day-name', g.day));
      const meta = [];
      if (g.words) meta.push(g.words.toLocaleString() + tt('ui.common.word'));
      if (g.minutes) meta.push(g.minutes + tt('ui.recOrd.min'));
      if (meta.length) head.append(el('span', 'k-rec-day-meta', meta.join(' · ')));
      list.append(head);
      for (const e of g.items) list.append(entryCard(e));
    }
  }
  function entryCard(e) {
    const card = el('div', 'k-rec-card');
    card.dataset.id = e.id;
    if (s.editing === e.id) {
      const ed = el('textarea', 'k-rec-edit'); ed.value = e.text; ed.rows = 3;
      const ok = el('button', null, tt('ui.recOrd.save'));
      const no = el('button', null, tt('ui.common.cancel'));
      ok.onclick = async () => {
        await saveRecords(RD.updateEntry(s.data, e.id, { text: ed.value.trim() }));
        s.editing = null; drawStats(); drawList(); setStatus(tt('ui.recOrd.editSaveDone'));
      };
      no.onclick = () => { s.editing = null; drawList(); };
      const btns = el('div', 'k-rec-card-btns'); btns.append(ok, no);
      card.append(ed, btns);
      return card;
    }
    const txt = el('div', 'k-rec-card-text', e.text);
    card.append(txt);
    const foot = el('div', 'k-rec-card-foot');
    if (e.mood) foot.append(el('span', 'k-rec-chip', RD.moodLabel(e.mood)));
    for (const t of e.tags || []) foot.append(el('span', 'k-rec-chip k-rec-tag', '#' + t));
    if (e.words) foot.append(el('span', 'k-rec-chip', e.words + tt('ui.common.word')));
    if (e.minutes) foot.append(el('span', 'k-rec-chip', e.minutes + tt('ui.recOrd.min')));
    const edit = el('span', 'k-rec-act', '✏️');
    edit.title = tt('ui.common.edit');
    edit.onclick = () => { s.editing = e.id; drawList(); };
    const del = el('span', 'k-rec-act', '🗑');
    del.title = tt('ui.common.del');
    del.onclick = async () => {
      const { confirmBox } = await import('../ui.js');
      if (!(await confirmBox(tt('ui.recOrd.delSave')))) return;
      await saveRecords(RD.removeEntry(s.data, e.id));
      setStatus(tt('ui.recOrd.delSaveDone')); drawStats(); drawList();
    };
    foot.append(el('span', 'k-rec-spacer'), edit, del);
    card.append(foot);
    return card;
  }
  async function exportCsv() {
    const rows = RD.filterEntries(s.data.entries, { q: s.q, mood: s.mood });
    if (!rows.length) { setStatus(tt('ui.recOrd.notHasSaveExport')); return; }
    const name = RD.csvFileName(state.title, RD.dayKey(new Date()));
    const dest = await kapi.saveAsDialog(name);
    if (!dest) return;
    await kapi.writeFile(dest, RD.toCsv(rows));
    setStatus(tt('ui.recOrd.exportCSVDone') + rows.length + tt('ui.recOrd.list') + dest);
    log('info', tt('ui.recOrd.recordExportCSV') + rows.length + tt('ui.common.list'));
  }

  drawStats(); drawList();
  return true;
}

/** เปิดแผงจากเมนู/ปุ่ม */
export async function openRecord() {
  const { showPanel } = await import('../panels/panel-ui.js');
  const { renderFeaturePanel } = await import('../app.js');
  showPanel('record');
  await renderFeaturePanel('record');
}
