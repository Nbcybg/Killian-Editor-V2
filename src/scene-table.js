// scene-table.js — มุมมอง "ตารางฉาก" แสดงทุกฉากเป็นตาราง Grid คลิกแถวเพื่อเปิด, เรียง/กรองได้ทุกคอลัมน์
import { T } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import { getVisualTags, renderVisualTagChips } from './visual-tags.js';
import { statusColor } from './custom-status.js';

export async function openSceneTable() {
  const key = '::scenetable::';
  if (state.tabs.has(key)) {
    const { activate } = await import('./app.js');
    activate(key);
    return renderSceneTable(state.tabs.get(key).pane);
  }
  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', T`📊 ตารางฉาก`));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file: key, title: T`ตารางฉาก`, pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null, gal: null, dash: true };
  tabBtn.onclick = (e) => { if (e.target !== x) { import('./app.js').then(m => m.activate(key)); } };
  x.onclick = async () => { const { closeTab } = await import('./app.js'); closeTab(key); };
  state.tabs.set(key, tab);
  const { activate } = await import('./app.js');
  activate(key);
  renderSceneTable(pane);
}

// เก็บสถานะการเรียง
let _sortCol = 'order';
let _sortDir = 'asc';

export async function renderSceneTable(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'sc-tbl-wrap');

  // หัว + ตัวกรอง
  const head = el('div', 'sc-tbl-head');
  head.append(el('div', 'sc-tbl-title', T`📊 ตารางฉากทั้งหมด`));
  const search = el('input', 'sc-tbl-search');
  search.placeholder = T`🔍 กรอง — ค้นชื่อ/แท็ก/สถานะ/เรื่องย่อ`;
  search.oninput = () => { setTimeout(() => renderBody(wrap, search.value.toLowerCase()), 50); };
  head.append(search);
  wrap.append(head);

  // ตาราง
  const tableWrap = el('div', 'sc-tbl-table-wrap');
  tableWrap.id = 'sc-tbl-table-wrap';
  wrap.append(tableWrap);
  pane.append(wrap);

  await renderBody(wrap, '');
}

async function loadAllScenes() {
  const scenes = [];
  if (!state.root) return scenes;

  try {
    for (const secName of await kapi.listDirs(state.root)) {
      if (['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', 'Plugins', 'Research'].includes(secName)) continue;
      const secPath = await kapi.join(state.root, secName);
      if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
      const sec = await kapi.readJson(await kapi.join(secPath, 'section.json')).catch(() => ({}));
      const draftRoot = await kapi.join(secPath, 'Draft');
      if (!(await kapi.exists(draftRoot))) continue;
      for (const dn of await kapi.listDirs(draftRoot)) {
        const dPath = await kapi.join(draftRoot, dn);
        const sf = await kapi.join(dPath, 'scenes.json');
        if (!(await kapi.exists(sf))) continue;
        const scData = await kapi.readJson(sf);
        const chs = scData.chapters || {};
        const draft = await kapi.readJson(await kapi.join(dPath, 'draft.json')).catch(() => ({}));
        for (const ch of (draft.chapters || [])) {
          for (const sc of (chs[ch.guid] || [])) {
            scenes.push({
              ...sc,
              sectionName: sec.title || secName,
              chapterName: ch.title || '',
              draftPath: dPath,
              chapter: ch,
              filePath: await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName),
            });
          }
        }
      }
    }
  } catch (e) {
    log('warn', T`scene-table: โหลดฉากล้มเหลว`, e);
  }
  return scenes;
}

async function renderBody(wrap, filter) {
  const tableWrap = wrap.querySelector('#sc-tbl-table-wrap') || wrap;
  tableWrap.innerHTML = '';

  const scenes = await loadAllScenes();
  if (!scenes.length) {
    tableWrap.append(el('div', 'dim', T`ยังไม่มีฉากในโปรเจกต์`));
    return;
  }

  // กรอง
  let filtered = scenes;
  if (filter) {
    filtered = scenes.filter((s) =>
      (s.title || '').toLowerCase().includes(filter) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(filter)) ||
      (s.status || '').toLowerCase().includes(filter) ||
      (s.synopsis || '').toLowerCase().includes(filter) ||
      (s.sectionName || '').toLowerCase().includes(filter) ||
      (s.chapterName || '').toLowerCase().includes(filter)
    );
  }

  // เรียง
  filtered.sort((a, b) => {
    let va, vb;
    switch (_sortCol) {
      case 'title': va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase(); break;
      case 'status': va = a.status || ''; vb = b.status || ''; break;
      case 'words': va = a.wordCount || 0; vb = b.wordCount || 0; break;
      case 'section': va = a.sectionName || ''; vb = b.sectionName || ''; break;
      case 'chapter': va = a.chapterName || ''; vb = b.chapterName || ''; break;
      case 'tags': va = (a.tags || []).join(','); vb = (b.tags || []).join(','); break;
      case 'pov': va = a.pov || ''; vb = b.pov || ''; break;
      default: va = a.order || 0; vb = b.order || 0; break;
    }
    if (typeof va === 'number') return _sortDir === 'asc' ? va - vb : vb - va;
    return _sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  // สร้างตาราง
  const table = el('table', 'sc-tbl-table');
  const thead = el('thead');
  const cols = [
    { key: 'title', label: T`ชื่อ`, w: '25%' },
    { key: 'status', label: T`สถานะ`, w: '12%' },
    { key: 'words', label: T`คำ`, w: '8%' },
    { key: 'section', label: T`เล่ม`, w: '12%' },
    { key: 'chapter', label: T`บท`, w: '12%' },
    { key: 'tags', label: T`แท็ก`, w: '15%' },
    { key: 'pov', label: 'POV', w: '10%' },
  ];
  const tr = el('tr');
  for (const col of cols) {
    const th = el('th');
    th.style.width = col.w;
    th.textContent = (col.key === _sortCol ? (_sortDir === 'asc' ? '▲ ' : '▼ ') : '') + col.label;
    th.style.cursor = 'pointer';
    th.onclick = () => {
      if (_sortCol === col.key) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      else { _sortCol = col.key; _sortDir = 'asc'; }
      renderBody(wrap, filter);
    };
    tr.append(th);
  }
  thead.append(tr);
  table.append(thead);

  const tbody = el('tbody');
  for (const sc of filtered) {
    const row = el('tr', 'sc-tbl-row');
    row.style.cursor = 'pointer';
    row.onclick = async () => {
      if (!sc.filePath) return;
      const { openScene } = await import('./app.js');
      openScene(sc.filePath, sc.title || '');
    };

    // ชื่อ
    const tdTitle = el('td');
    const icon = sc.type === 'memo' ? '📝 ' : sc.locked ? '🔒 ' : sc.flag ? '⭐ ' : '📄 ';
    tdTitle.textContent = icon + (sc.title || '');
    if (sc.synopsis) tdTitle.title = sc.synopsis;
    row.append(tdTitle);

    // สถานะ
    const tdStatus = el('td');
    tdStatus.textContent = sc.status || '—';
    // สีตามสถานะ — เดิมมีสีแค่ 4 ตัวสำหรับสถานะมาตรฐาน 5 ตัว และสถานะที่ผู้ใช้เพิ่มเองไม่มีสีเลย
    if (sc.status) tdStatus.style.color = statusColor(sc.status);
    row.append(tdStatus);

    // จำนวนคำ
    const tdWords = el('td');
    tdWords.textContent = sc.wordCount ? sc.wordCount.toLocaleString() : '0';
    tdWords.style.textAlign = 'right';
    row.append(tdWords);

    // เล่ม
    const tdSec = el('td');
    tdSec.textContent = sc.sectionName || '';
    row.append(tdSec);

    // บท
    const tdCh = el('td');
    tdCh.textContent = sc.chapterName || '';
    row.append(tdCh);

    // แท็ก — แท็กที่ตรงกับ Visual Tag จะแสดงเป็นชิปสี ที่เหลือเป็นข้อความ
    const tdTags = el('td');
    tdTags.style.fontSize = '11px';
    const vNames = new Set(getVisualTags().map((v) => v.name));
    const plain = (sc.tags || []).filter((t) => !vNames.has(t));
    if ((sc.tags || []).some((t) => vNames.has(t))) tdTags.append(renderVisualTagChips(sc.tags));
    if (plain.length) tdTags.append(el('span', null, plain.join(', ')));
    row.append(tdTags);

    // POV
    const tdPov = el('td');
    tdPov.textContent = sc.pov || '';
    row.append(tdPov);

    tbody.append(row);
  }
  table.append(tbody);

  // จำนวนรวม
  const info = el('div', 'sc-tbl-info', T`${filtered.length} / ${scenes.length} ฉาก`);

  tableWrap.innerHTML = '';
  tableWrap.append(info, table);
}
