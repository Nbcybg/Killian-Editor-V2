// scratchpad.js — แท็บ "📝 สมุดโน้ตด่วน" textarea ไม่บันทึกเป็นไฟล์, export/ย้ายเข้า Memo ได้
import { t, tf } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';

// ══ [alpha.159 · M19] ★ แท็บกับแผงใช้ "ค่าเดียวกัน" ══
// เดิมต่างคนต่างอ่าน localStorage ตอนสร้าง แล้วต่างคนต่างเขียนทับคีย์เดียวกันทุก 3 วินาที
// → เปิดทั้งแท็บและแผง พิมพ์ที่หนึ่ง อีกที่ยังถือข้อความเก่า แล้วบันทึกทับ = โน้ตที่เพิ่งพิมพ์หาย
// ตอนนี้: ค่าอยู่ใน PAD ก้อนเดียว · ช่องทุกช่องที่เปิดอยู่ถูกซิงก์ทันทีที่อีกช่องพิมพ์
// · หน้าต่างแผงที่ฉีกออกไป (คนละ renderer) ซิงก์ผ่านอีเวนต์ `storage` ของ localStorage ก้อนเดียวกัน
// · บันทึกค้างถูกเขียนทันทีตอนปิดแท็บ/ปิดหน้าต่าง (เดิมหน่วง 3 วินาที = ปิดโปรแกรมเร็วแล้วหาย)
const PAD_KEY = 'k2-scratchpad';
const PAD = { value: null, timer: null, views: new Set() };

/** ค่าปัจจุบันของสมุดโน้ตด่วน (อ่าน localStorage ครั้งแรกครั้งเดียว) */
export function scratchValue() {
  if (PAD.value === null) {
    try { PAD.value = localStorage.getItem(PAD_KEY) || ''; } catch { PAD.value = ''; }
  }
  return PAD.value;
}
/** เขียนค้างลง localStorage ทันที */
export function flushScratch() {
  clearTimeout(PAD.timer); PAD.timer = null;
  if (PAD.value === null) return;
  try { localStorage.setItem(PAD_KEY, PAD.value); } catch {}
}
/** ตั้งค่าใหม่ แล้วซิงก์ทุกช่องที่เปิดอยู่ (ยกเว้นช่องต้นทาง) · บันทึกแบบหน่วง */
export function setScratchValue(v, from = null, { now = false } = {}) {
  PAD.value = String(v ?? '');
  for (const view of [...PAD.views]) {
    if (!view.ta.isConnected) { PAD.views.delete(view); continue; }
    if (view.ta !== from && view.ta.value !== PAD.value) { view.ta.value = PAD.value; view.update(); }
  }
  clearTimeout(PAD.timer);
  if (now) flushScratch();
  else PAD.timer = setTimeout(flushScratch, 3000);
}
try {
  window.addEventListener('beforeunload', flushScratch);
  window.addEventListener('pagehide', flushScratch);
  // หน้าต่างอื่น (แผงที่ฉีกออก) เขียนคีย์เดียวกัน → รับค่าใหม่มาแสดง (ไม่เขียนกลับ = ไม่วนกัน)
  window.addEventListener('storage', (e) => {
    if (e.key !== PAD_KEY) return;
    PAD.value = e.newValue || '';
    for (const view of PAD.views) if (view.ta.isConnected && view.ta.value !== PAD.value) { view.ta.value = PAD.value; view.update(); }
  });
} catch {}

/** แถบเครื่องมือ + ช่องพิมพ์ — ตัวเดียวที่ทั้งแท็บและแผงใช้ */
function buildScratch() {
  const ta = el('textarea', 'scratch-area');
  ta.value = scratchValue();
  // [alpha.128] ช่องนี้เริ่มว่างและไม่มีป้ายกำกับใด ๆ อยู่ข้าง ๆ — เปิดแผงมาเจอกล่องเปล่า
  // ไม่รู้ว่าใส่อะไรได้และหายไหม · บอกทั้งหน้าที่และที่เก็บในบรรทัดเดียว
  ta.placeholder = t('ui.notes.scratchPh');
  ta.spellcheck = false;
  const bar = el('div', 'scratch-bar');
  const exportBtn = el('button', null, t('ui.common.exportMd'));
  const memoBtn = el('button', null, t('ui.notes.moveInMemo'));
  const clearBtn = el('button', 'k-danger', t('ui.common.clear2'));
  const info = el('span', 'scratch-info');
  bar.append(info, exportBtn, memoBtn, clearBtn);

  const updateInfo = () => {
    const lines = ta.value.split('\n').length;
    const chars = ta.value.length;
    const words = ta.value ? ta.value.trim().split(/\s+/).length : 0;
    info.textContent = tf('ui.notes.lineWordChar', lines, words, chars);
  };
  const view = { ta, update: updateInfo };
  PAD.views.add(view);
  ta.addEventListener('input', () => { setScratchValue(ta.value, ta); updateInfo(); });
  // กลับมาที่ช่องนี้ = เอาค่าล่าสุด (กันกรณีที่อีกหน้าต่างเขียนมาตอนช่องนี้ไม่ได้อยู่ในหน้าจอ)
  ta.addEventListener('focus', () => { if (ta.value !== scratchValue()) { ta.value = scratchValue(); updateInfo(); } });

  exportBtn.onclick = async () => {
    const dest = await kapi.saveAsDialog('scratchpad.md');
    if (!dest) return;
    await kapi.writeFile(dest, ta.value);
    setStatus(t('ui.common.exportDone') + dest);
  };
  memoBtn.onclick = async () => {
    if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return; }
    if (!ta.value.trim()) { setStatus(t('ui.notes.notHasTextMove')); return; }
    const { ask } = await import('./ui.js');
    const { safeName, buildTree } = await import('./app.js');
    const title = await ask(t('ui.notes.nameNoteMemo'), { value: ta.value.trim().slice(0, 40).split('\n')[0] });
    if (!title) return;
    const memoDir = await kapi.join(state.root, 'Memos');
    await kapi.mkdir(memoDir);
    const fname = safeName(title) + '-' + Date.now().toString(36) + '.md';
    const { dumpMdFile } = await import('./md.js');
    await kapi.writeFile(await kapi.join(memoDir, fname), dumpMdFile({ title, type: 'memo' }, ta.value));
    setStatus(t('ui.notes.moveInMemoDone') + title);
    await buildTree();
  };
  clearBtn.onclick = () => {
    ta.value = '';
    setScratchValue('', ta, { now: true });
    updateInfo();
    setStatus(t('ui.notes.clearNotebookNoteDone'));
  };
  updateInfo();
  return { bar, ta };
}

export async function openScratchpad() {
  const key = '::scratchpad::';
  if (state.tabs.has(key)) {
    const { activate } = await import('./app.js');
    activate(key);
    return;
  }
  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', t('ui.notes.notebookNoteQuick')));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const { bar, ta } = buildScratch();
  pane.append(bar, ta);
  const tab = { file: key, title: t('ui.common.notebookNoteQuick'), pane, tabBtn, dirty: false,
                editor: null, plain: ta, wiki: null, gal: null };
  tabBtn.onclick = (e) => { if (e.target !== x) { import('./app.js').then(m => m.activate(key)); } };
  x.onclick = () => {
    flushScratch();                          // save before close
    import('./app.js').then(m => m.closeTab(key));
  };
  state.tabs.set(key, tab);
  const { activate } = await import('./app.js');
  activate(key);
  ta.focus();
}

export function renderNotesPanel(host) {
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';
  const { bar, ta } = buildScratch();
  host.append(bar, ta);
  ta.focus();
}
