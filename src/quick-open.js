// quick-open.js — เปิดไฟล์ด่วนแบบ fuzzy (Ctrl+Shift+O)
import { t, tf } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import Fuse from 'fuse.js';

const SKIP_DIRS = ['Snapshots', 'Backups', 'Recycle', 'node_modules', '.git'];

// แคชรายชื่อไฟล์ต่อโปรเจกต์ — เปิดกล่องครั้งที่ 2 เป็นต้นไปมีรายการให้พิมพ์ทันที
// แล้วสแกนซ้ำในพื้นหลังเพื่อเก็บไฟล์ที่เพิ่งสร้าง (เดิมสแกนครั้งเดียวจนกว่าจะรีโหลดโปรแกรม)
let _cacheRoot = null;
let _cacheFiles = [];

export function quickOpenCache() { return { root: _cacheRoot, files: _cacheFiles }; }
export function clearQuickOpenCache() { _cacheRoot = null; _cacheFiles = []; }

async function scanProject(root) {
  const out = [];
  const rootLen = root.length;
  const scan = async (dir) => {
    for (const f of await kapi.listFiles(dir, '').catch(() => [])) {
      const fp = await kapi.join(dir, f);
      // kapi.relative เป็น IPC (async) — เดิมเรียกแบบ sync เลยได้ Promise มาโชว์เป็น [object Promise]
      const rel = fp.slice(rootLen).replace(/^[\\/]/, '').replace(/\\/g, '/');
      out.push({ path: fp, name: f, rel, ext: (f.split('.').pop() || '').toLowerCase() });
    }
    for (const d of await kapi.listDirs(dir).catch(() => [])) {
      if (SKIP_DIRS.includes(d)) continue;
      await scan(await kapi.join(dir, d));
    }
  };
  await scan(root);
  return out;
}

export function openQuickOpen() {
  if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return null; }

  const ov = el('div', 'k-overlay');
  ov.style.cssText = 'z-index:100;background:rgba(0,0,0,.45)';
  const box = el('div', 'k-qo');
  const input = el('input', 'k-qo-input');
  input.placeholder = t('ui.quickOpen.printNameFile');
  const list = el('div', 'k-qo-list');
  // แถบคำใบ้ท้ายกล่อง (ผู้ใช้ไม่รู้ว่ากดอะไรได้บ้าง) + ปุ่มสแกนใหม่
  const foot = el('div', 'k-qo-foot');
  foot.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:11px;opacity:.75;border-top:1px solid var(--border)';
  const hint = el('span', 'k-qo-hint', t('ui.quickOpen.pickEnterOpenEsc'));
  const count = el('span', 'k-qo-count');
  count.style.cssText = 'margin-left:auto';
  const reBtn = el('button', 'k-qo-refresh', '🔄');
  reBtn.title = t('ui.quickOpen.scanFileNew');
  reBtn.style.cssText = 'border:none;background:none;cursor:pointer;font-size:13px';
  foot.append(hint, count, reBtn);
  box.append(input, list, foot);
  ov.append(box);
  document.body.append(ov);

  let allFiles = (_cacheRoot === state.root) ? _cacheFiles.slice() : [];
  let fuse = allFiles.length ? mkFuse(allFiles) : null;
  let selectedIdx = 0;
  let results = [];
  let scanning = false;

  function mkFuse(files) { return new Fuse(files, { keys: ['name', 'rel'], threshold: 0.4, distance: 100 }); }

  async function rescan() {
    if (scanning) return;
    scanning = true;
    count.textContent = t('ui.quickOpen.busyScan');
    try {
      const files = await scanProject(state.root);
      _cacheRoot = state.root; _cacheFiles = files;
      allFiles = files.slice();
      fuse = mkFuse(allFiles);
      doFilter();
    } catch (e) { log('warn', 'quick-open: scan failed', e); }
    finally { scanning = false; }
  }

  if (allFiles.length) doFilter();          // มีแคช → เห็นรายการทันที
  const ready = rescan();                   // แล้วอัปเดตพื้นหลังเสมอ (จับไฟล์ที่เพิ่งสร้าง)

  function doFilter() {
    const q = input.value.trim();
    results = q && fuse ? fuse.search(q).map((r) => r.item).slice(0, 20) : allFiles.slice(0, 20);
    list.innerHTML = '';
    selectedIdx = 0;
    results.forEach((f) => {
      const row = el('div', 'k-qo-row');
      const icon = f.ext === 'md' ? '📄' : f.ext === 'json' ? '📋' : '📎';
      row.append(el('span', 'k-qo-icon', icon));
      row.append(el('span', 'k-qo-name', f.name));
      row.append(el('span', 'k-qo-rel', f.rel));
      row.onclick = () => openFile(f);
      list.append(row);
    });
    count.textContent = tf('ui.quickOpen.file', results.length, allFiles.length);
    highlight(selectedIdx);
  }

  function highlight(idx) {
    const rows = [...list.querySelectorAll('.k-qo-row')];
    rows.forEach((r, i) => r.classList.toggle('on', i === idx));
    if (rows[idx]) rows[idx].scrollIntoView({ block: 'nearest' });
  }

  async function openFile(f) {
    ov.remove();
    const { openScene, openPlainFile } = await import('./app.js');
    if (f.ext === 'md') openScene(f.path, f.name.replace(/\.md$/i, ''));
    else if (f.ext === 'json' || f.ext === 'txt') await openPlainFile(f.path, f.name);
    else kapi.revealInOS(f.path);
  }

  reBtn.onclick = () => { rescan(); input.focus(); };
  input.oninput = doFilter;
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, results.length - 1); highlight(selectedIdx); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); highlight(selectedIdx); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[selectedIdx]) openFile(results[selectedIdx]); }
    else if (e.key === 'Escape') { e.preventDefault(); ov.remove(); }
    else if (e.code === 'KeyR' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rescan(); }
  };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  input.focus();
  return ready;                     // ให้ selftest รอสแกนเสร็จได้
}
