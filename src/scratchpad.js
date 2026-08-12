// scratchpad.js — แท็บ "📝 สมุดโน้ตด่วน" textarea ไม่บันทึกเป็นไฟล์, export/ย้ายเข้า Memo ได้
import { t, tf } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';

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
  // restore from localStorage
  let saved = '';
  try { saved = localStorage.getItem('k2-scratchpad') || ''; } catch {}
  const ta = el('textarea', 'scratch-area');
  ta.value = saved;
  ta.spellcheck = false;
  // auto-save to localStorage every 3s
  let saveTimer = null;
  ta.oninput = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem('k2-scratchpad', ta.value); } catch {}
    }, 3000);
  };
  // toolbar for scratchpad
  const bar = el('div', 'scratch-bar');
  const exportBtn = el('button', null, t('ui.common.exportMd'));
  const memoBtn = el('button', null, t('ui.notes.moveInMemo'));
  const clearBtn = el('button', 'k-danger', t('ui.common.clear2'));
  const info = el('span', 'scratch-info');
  bar.append(info, exportBtn, memoBtn, clearBtn);

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
    await kapi.writeFile(await kapi.join(memoDir, fname),
                         dumpMdFile({ title, type: 'memo' }, ta.value));
    setStatus(t('ui.notes.moveInMemoDone') + title);
    await buildTree();
  };
  clearBtn.onclick = () => {
    ta.value = '';
    try { localStorage.setItem('k2-scratchpad', ''); } catch {}
    setStatus(t('ui.notes.clearNotebookNoteDone'));
  };

  const updateInfo = () => {
    const lines = ta.value.split('\n').length;
    const chars = ta.value.length;
    const words = ta.value ? ta.value.trim().split(/\s+/).length : 0;
    info.textContent = tf('ui.notes.lineWordChar', lines, words, chars);
  };
  ta.addEventListener('input', updateInfo);
  updateInfo();

  pane.append(bar, ta);
  const tab = { file: key, title: t('ui.common.notebookNoteQuick'), pane, tabBtn, dirty: false,
                editor: null, plain: ta, wiki: null, gal: null };
  tab.plain = ta;
  tabBtn.onclick = (e) => { if (e.target !== x) { import('./app.js').then(m => m.activate(key)); } };
  x.onclick = () => {
    // save before close
    try { localStorage.setItem('k2-scratchpad', ta.value); } catch {}
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

  let saved = '';
  try { saved = localStorage.getItem('k2-scratchpad') || ''; } catch {}

  const ta = el('textarea', 'scratch-area');
  ta.value = saved;
  ta.spellcheck = false;

  let saveTimer = null;
  ta.oninput = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem('k2-scratchpad', ta.value); } catch {}
    }, 3000);
  };

  const bar = el('div', 'scratch-bar');
  const exportBtn = el('button', null, t('ui.common.exportMd'));
  const memoBtn = el('button', null, t('ui.notes.moveInMemo'));
  const clearBtn = el('button', 'k-danger', t('ui.common.clear2'));
  const info = el('span', 'scratch-info');
  bar.append(info, exportBtn, memoBtn, clearBtn);

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
    try { localStorage.setItem('k2-scratchpad', ''); } catch {}
    setStatus(t('ui.notes.clearNotebookNoteDone'));
  };

  const updateInfo = () => {
    const lines = ta.value.split('\n').length;
    const chars = ta.value.length;
    const words = ta.value ? ta.value.trim().split(/\s+/).length : 0;
    info.textContent = tf('ui.notes.lineWordChar', lines, words, chars);
  };
  ta.addEventListener('input', updateInfo);
  updateInfo();

  host.append(bar, ta);
  ta.focus();
}
