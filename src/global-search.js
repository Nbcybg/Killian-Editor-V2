// global-search.js — ค้นหาทั้งโปรเจกต์ (Ctrl+Shift+F) ค้นทุกไฟล์ .md และ .json
import { T } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import { parseMdFile } from './md.js';

// ฟังก์ชันหลัก — เปิด dialog ค้นหา
export async function openGlobalSearch() {
  if (!state.root) { setStatus(T`ยังไม่ได้เปิดโปรเจกต์`); return; }

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-gsearch');
  box.append(el('div', 'k-dlg-title', T`🔍 ค้นหาทั้งโปรเจกต์`));

  // แถบค้นหา
  const searchRow = el('div', 'k-row');
  searchRow.style.cssText = 'gap:8px;margin:8px 0';
  const qInput = el('input', 'k-dlg-input');
  qInput.type = 'text'; qInput.placeholder = T`ค้นในทุกไฟล์ .md และ .json — กด Enter`;
  qInput.style.flex = '1';
  searchRow.append(qInput);

  // ตัวเลือกประเภทไฟล์
  const typeRow = el('div', 'k-row');
  typeRow.style.cssText = 'gap:12px;margin:4px 0 8px;font-size:12px';
  const mkChk = (label, val, def = true) => {
    const w = el('label', null);
    const c = el('input'); c.type = 'checkbox'; c.checked = def; c.value = val;
    w.append(c, document.createTextNode(' ' + label));
    typeRow.append(w); return c;
  };
  const chkMd = mkChk(T`.md (ฉาก/โน้ต/Memo)`, 'md');
  const chkJson = mkChk('.json (Wiki/scenes/section)', 'json', false);
  const chkAll = mkChk(T`ค้นเฉพาะชื่อไฟล์`, 'name', false);
  searchRow.append(typeRow);

  box.append(searchRow, typeRow);

  // แสดงผลลัพธ์
  const results = el('div', 'k-gsearch-results');
  results.style.cssText = 'max-height:60vh;overflow-y:auto;min-height:200px';
  box.append(results);

  // แถบล่าง
  const btns = el('div', 'k-dlg-btns');
  const status = el('span', 'k-gsearch-status');
  status.style.cssText = 'flex:1;font-size:11.5px;color:var(--dim);text-align:left';
  const closeB = el('button', 'k-ok', T`ปิด`);
  btns.append(status, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);

  closeB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  // ฟังก์ชันค้นหา
  async function doGlobalSearch(q) {
    if (!q.trim()) { results.innerHTML = ''; status.textContent = ''; return; }
    status.textContent = T`กำลังค้น…`;
    results.innerHTML = el('div', 'dim', T`กำลังค้นหา…`).outerHTML;

    const hits = [];
    const ql = q.toLowerCase();
    const searchNameOnly = chkAll.checked;
    const includeMd = chkMd.checked;
    const includeJson = chkJson.checked;

    try {
      const searchDir = async (dir) => {
        const entries = await kapi.listDirs(dir).catch(() => []);
        for (const name of entries) {
          const full = await kapi.join(dir, name);
          await searchDir(full);
        }
        const files = await kapi.listFiles(dir, '').catch(() => []);
        for (const f of files) {
          const ext = f.split('.').pop().toLowerCase();
          if ((ext === 'md' && includeMd) || (ext === 'json' && includeJson)) {
            const fp = await kapi.join(dir, f);
            try {
              if (searchNameOnly) {
                if (f.toLowerCase().includes(ql)) {
                  hits.push({ file: fp, name: f, matches: [{ line: 0, text: f, ctx: '' }], type: ext });
                }
              } else {
                const raw = await kapi.readFile(fp);
                const lines = raw.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  const lower = lines[i].toLowerCase();
                  const idx = lower.indexOf(ql);
                  if (idx >= 0) {
                    // หา context (2 บรรทัดก่อน-หลัง)
                    const ctxStart = Math.max(0, i - 1);
                    const ctxEnd = Math.min(lines.length, i + 2);
                    const ctx = lines.slice(ctxStart, ctxEnd).join('\n').substring(0, 300);
                    // ดึงชื่อจาก frontmatter หรือชื่อไฟล์
                    let title = f;
                    if (ext === 'md') {
                      try { title = parseMdFile(raw).meta.title || f; } catch {}
                    }
                    hits.push({
                      file: fp, name: title, type: ext,
                      matches: [{ line: i + 1, text: lines[i].trim().substring(0, 200), ctx }]
                    });
                    break; // 1 hit ต่อไฟล์
                  }
                }
              }
            } catch {}
          }
        }
      };
      await searchDir(state.root);

      // จัดกลุ่มตามไฟล์ (กรณีชื่ออาจมีหลาย match)
      const grouped = {};
      for (const h of hits) {
        if (!grouped[h.file]) grouped[h.file] = h;
        else grouped[h.file].matches.push(...h.matches);
      }

      renderResults(Object.values(grouped), ql);
      status.textContent = T`พบ ${hits.length} ไฟล์`;
    } catch (e) {
      log('error', T`global-search: ค้นล้มเหลว`, e);
      results.innerHTML = el('div', 'dim', T`เกิดข้อผิดพลาด`).outerHTML;
      status.textContent = T`ค้นล้มเหลว`;
    }
  }

  // แสดงผลลัพธ์
  function renderResults(hits, highlight) {
    results.innerHTML = '';
    if (!hits.length) {
      results.append(el('div', 'dim', T`ไม่พบผลลัพธ์`));
      return;
    }

    for (const h of hits) {
      const card = el('div', 'k-gsearch-hit');
      const header = el('div', 'k-gsearch-hit-head');
      const icon = h.type === 'md' ? '📄' : '📋';
      header.append(el('span', 'k-gsearch-hit-name', icon + ' ' + h.name));
      header.append(el('span', 'k-gsearch-hit-type', '.' + h.type));

      // แสดง path สัมพันธ์
      try {
        const rel = kapi.relative ? kapi.relative(state.root, h.file) : h.file;
        header.append(el('span', 'k-gsearch-hit-path', rel));
      } catch {}

      card.append(header);

      for (const m of (h.matches || []).slice(0, 3)) {
        const line = el('div', 'k-gsearch-line');
        // ไฮไลต์คำที่เจอ
        const idx = m.text.toLowerCase().indexOf(highlight);
        if (idx >= 0) {
          line.append(document.createTextNode(m.text.slice(0, idx)));
          const hl = el('span', 'k-gsearch-hl');
          hl.textContent = m.text.slice(idx, idx + highlight.length);
          line.append(hl);
          line.append(document.createTextNode(m.text.slice(idx + highlight.length)));
        } else {
          line.textContent = m.text;
        }
        card.append(line);
      }

      // ปุ่มเปิดไฟล์
      const openB = el('button', 'k-ok k-gsearch-open', T`เปิด`);
      openB.onclick = async (e) => {
        e.stopPropagation();
        ov.remove();
        if (h.type === 'md') {
          const { openScene } = await import('./app.js');
          openScene(h.file, h.name);
        } else {
          // เปิดเป็น JSON editor
          const { activate } = await import('./app.js');
          try {
            const raw = await kapi.readFile(h.file);
            const pane = el('div', 'pane');
            $('#panes').append(pane);
            const tabBtn = el('div', 'tab');
            tabBtn.append(el('span', 'tab-title', h.name));
            const x = el('span', 'tab-x', '×'); tabBtn.append(x);
            $('#tabs').append(tabBtn);
            const ta = el('textarea', 'plain-md');
            ta.value = raw; ta.style.cssText = 'width:100%;height:100%;background:var(--bg);color:var(--fg);border:none;padding:20px;font:14px monospace;resize:none';
            pane.append(ta);
            const tab = { file: h.file, title: h.name, pane, tabBtn, dirty: false, plain: ta, isJson: true };
            tabBtn.onclick = (ev) => { if (ev.target !== x) { const { activate } = require('./app.js') || {}; } };
            x.onclick = () => { /* closeTab via import */ };
            state.tabs.set(h.file, tab);
            activate(h.file);
          } catch {}
        }
      };
      card.append(openB);

      // คลิกที่ card = เปิด
      card.addEventListener('click', () => openB.click());
      results.append(card);
    }
  }

  qInput.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doGlobalSearch(qInput.value); }
    if (e.key === 'Escape') ov.remove();
  };
  qInput.focus();
}

export async function renderSearchPanel(host) {
  if (!state.root) { setStatus(T`ยังไม่ได้เปิดโปรเจกต์`); return; }
  host.innerHTML = '';

  host.append(el('div', 'k-dlg-title', T`🔍 ค้นหาทั้งโปรเจกต์`));

  const searchRow = el('div', 'k-row');
  searchRow.style.cssText = 'gap:8px;margin:8px 0';
  const qInput = el('input', 'k-dlg-input');
  qInput.type = 'text'; qInput.placeholder = T`ค้นในทุกไฟล์ .md และ .json — กด Enter`;
  qInput.style.flex = '1';
  searchRow.append(qInput);

  const typeRow = el('div', 'k-row');
  typeRow.style.cssText = 'gap:12px;margin:4px 0 8px;font-size:12px';
  const mkChk = (label, val, def = true) => {
    const w = el('label', null);
    const c = el('input'); c.type = 'checkbox'; c.checked = def; c.value = val;
    w.append(c, document.createTextNode(' ' + label));
    typeRow.append(w); return c;
  };
  const chkMd = mkChk(T`.md (ฉาก/โน้ต/Memo)`, 'md');
  const chkJson = mkChk('.json (Wiki/scenes/section)', 'json', false);
  const chkAll = mkChk(T`ค้นเฉพาะชื่อไฟล์`, 'name', false);
  host.append(searchRow, typeRow);

  const results = el('div', 'k-gsearch-results');
  results.style.cssText = 'max-height:60vh;overflow-y:auto;min-height:100px;flex:1';
  host.append(results);

  const status = el('span');
  status.style.cssText = 'font-size:11.5px;color:var(--dim);margin-top:4px';
  host.append(status);

  async function doSearch(q) {
    if (!q.trim()) { results.innerHTML = ''; status.textContent = ''; return; }
    status.textContent = T`กำลังค้น…`;
    results.innerHTML = el('div', 'dim', T`กำลังค้นหา…`).outerHTML;
    const hits = [];
    const ql = q.toLowerCase();
    const searchNameOnly = chkAll.checked;
    const includeMd = chkMd.checked;
    const includeJson = chkJson.checked;
    try {
      const searchDir = async (dir) => {
        const entries = await kapi.listDirs(dir).catch(() => []);
        for (const name of entries) await searchDir(await kapi.join(dir, name));
        const files = await kapi.listFiles(dir, '').catch(() => []);
        for (const f of files) {
          const ext = f.split('.').pop().toLowerCase();
          if ((ext === 'md' && includeMd) || (ext === 'json' && includeJson)) {
            const fp = await kapi.join(dir, f);
            try {
              if (searchNameOnly) {
                if (f.toLowerCase().includes(ql))
                  hits.push({ file: fp, name: f, matches: [{ line: 0, text: f, ctx: '' }], type: ext });
              } else {
                const raw = await kapi.readFile(fp);
                const lines = raw.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  const idx = lines[i].toLowerCase().indexOf(ql);
                  if (idx >= 0) {
                    let title = f;
                    if (ext === 'md') { try { title = parseMdFile(raw).meta.title || f; } catch {} }
                    hits.push({ file: fp, name: title, type: ext,
                      matches: [{ line: i + 1, text: lines[i].trim().substring(0, 200), ctx: '' }] });
                    break;
                  }
                }
              }
            } catch {}
          }
        }
      };
      await searchDir(state.root);
      const grouped = {};
      for (const h of hits) { if (!grouped[h.file]) grouped[h.file] = h; else grouped[h.file].matches.push(...h.matches); }
      showResults(Object.values(grouped), ql);
      status.textContent = T`พบ ${hits.length} ไฟล์`;
    } catch (e) {
      log('error', T`search-panel: ค้นล้มเหลว`, e);
      results.innerHTML = el('div', 'dim', T`เกิดข้อผิดพลาด`).outerHTML;
      status.textContent = T`ค้นล้มเหลว`;
    }
  }

  function showResults(hits, highlight) {
    results.innerHTML = '';
    if (!hits.length) { results.append(el('div', 'dim', T`ไม่พบผลลัพธ์`)); return; }
    for (const h of hits) {
      const card = el('div', 'k-gsearch-hit');
      const header = el('div', 'k-gsearch-hit-head');
      header.append(el('span', 'k-gsearch-hit-name', (h.type === 'md' ? '📄 ' : '📋 ') + h.name));
      try {
        const rel = kapi.relative ? kapi.relative(state.root, h.file) : h.file;
        header.append(el('span', 'k-gsearch-hit-path', rel));
      } catch {}
      card.append(header);
      for (const m of (h.matches || []).slice(0, 3)) {
        const line = el('div', 'k-gsearch-line');
        const idx = m.text.toLowerCase().indexOf(highlight);
        if (idx >= 0) {
          line.append(document.createTextNode(m.text.slice(0, idx)));
          const hl = el('span', 'k-gsearch-hl'); hl.textContent = m.text.slice(idx, idx + highlight.length);
          line.append(hl, document.createTextNode(m.text.slice(idx + highlight.length)));
        } else { line.textContent = m.text; }
        card.append(line);
      }
      const openB = el('button', 'k-ok k-gsearch-open', T`เปิด`);
      openB.onclick = async (e) => {
        e.stopPropagation();
        if (h.type === 'md') { const { openScene } = await import('./app.js'); openScene(h.file, h.name); }
        else {
          const { activate } = await import('./app.js');
          try {
            const raw = await kapi.readFile(h.file);
            const pane = el('div', 'pane'); $('#panes').append(pane);
            const tabBtn = el('div', 'tab'); tabBtn.append(el('span', 'tab-title', h.name));
            const x = el('span', 'tab-x', '×'); tabBtn.append(x);
            $('#tabs').append(tabBtn);
            const ta = el('textarea', 'plain-md');
            ta.value = raw; ta.style.cssText = 'width:100%;height:100%;background:var(--bg);color:var(--fg);border:none;padding:20px;font:14px monospace;resize:none';
            pane.append(ta);
            const tab = { file: h.file, title: h.name, pane, tabBtn, dirty: false, plain: ta, isJson: true };
            state.tabs.set(h.file, tab);
            activate(h.file);
          } catch {}
        }
      };
      card.append(openB);
      card.addEventListener('click', () => openB.click());
      results.append(card);
    }
  }

  qInput.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(qInput.value); }
  };
  qInput.focus();
}

// เปิดจากคีย์ลัด
// คีย์ลัดผูกผ่านตาราง SHORTCUTS ใน app.js (channel 'global-search') แล้ว
// เดิมผูก listener ของตัวเองที่ Ctrl+Shift+F ซึ่งชนกับ 'focus-mode' ในตาราง → กดทีเดียวยิง 2 คำสั่ง
export function bindGlobalSearchShortcut() { /* ไม่ใช้แล้ว — คงชื่อไว้กันโค้ดเก่าเรียก */ }
