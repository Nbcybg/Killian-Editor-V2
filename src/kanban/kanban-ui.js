// kanban-ui.js — กระดาน Kanban แสดงฉากตามสถานะ · ลากการ์ดเปลี่ยนสถานะ (ข้อ 12)
import { $, el, setStatus, state, t, tf, dataLabel } from '../core.js';
import { STATUS_UNSET, CHART_SERIES } from '../palette.js';   // [alpha.162 · W6 ข้อ 2] ตัวเดียวกับแดชบอร์ด
import { KanbanBoard, UNSET } from './kanban-core.js';   // คอลัมน์จัดการผ่านเมธอดของ board (removeColumn)
import { allStatuses, statusColor, setStatusColor, addCustomStatus, deleteStatus, setStatusOrder,
         manageCustomStatuses, refreshStatusChips } from '../custom-status.js';
import { vivid, normHex, nextStatusColor } from '../color-util.js';
import { chapterFolders, scenePath, syncIo } from '../project-scan.js';
import { ask, confirmBox, popupMenu } from '../ui.js';
import { cmpText, fmtNum } from '../locale.js';
import { showPanel, isPanelOpen } from '../panels/panel-ui.js';
import { gi } from '../icons.js';

let board = null;   // KanbanBoard instance

// [alpha.124 ข้อ 42] ฉบับร่างที่กระดานกำลังแสดง — จำต่อโปรเจกต์
// (ES module: ค่าที่ reassign ข้ามฟังก์ชันเก็บใน object — กฎเหล็กข้อ 2)
const KB = { draftPath: '' };
let _draftsCache = null;   // [alpha.165] รายชื่อร่างรอบล่าสุด — วาดช่องเลือกได้ทันทีไม่ต้องรอ async (กันกระพริบ)
const kbKey = () => 'k2-kanban-draft:' + state.root;
function savedDraft() { try { return localStorage.getItem(kbKey()) || ''; } catch { return ''; } }
function saveDraft(p) { try { localStorage.setItem(kbKey(), p || ''); } catch {} }

/** ฉบับร่างทั้งหมดในโปรเจกต์ — ให้ dropdown บนหัวกระดานใช้ */
export async function kanbanDrafts() {
  const { listDrafts } = await import('../app.js');
  return listDrafts();
}

/** สลับกระดานไปฉบับร่างอื่น */
export async function setKanbanDraft(dPath) {
  if (!dPath || dPath === KB.draftPath) return false;
  KB.draftPath = dPath;
  saveDraft(dPath);
  board = null;                   // สร้างใหม่ทั้งก้อน (ทะเบียนฉากเป็นคนละไฟล์)
  await renderKanbanPanel();
  return true;
}

async function getBoard() {
  if (board) return board;
  if (!state.root) return null;
  // หา draftPath จาก state (path ของฉบับร่างแรก)
  // [alpha.62] เดิมหยิบ "โฟลเดอร์แรกที่ไม่ใช่โฟลเดอร์ระบบ" แล้วถือว่านั่นคือเล่ม
  // แต่ `listDirs` ไม่ได้เรียงตามตัวอักษร (APFS คืนตามลำดับภายใน) และเล่มที่เพิ่งสร้าง
  // ยังไม่มีโฟลเดอร์ Draft → บางครั้ง Kanban เปิดไม่ขึ้นเฉย ๆ ทั้งที่มีเล่มที่ใช้ได้อยู่
  // แก้: ไล่ทุกเล่มจนเจอเล่มแรกที่ "มีฉบับร่างจริง"
  const SKIP_DIRS = ['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', 'Backups',
                     'Plugins', 'Research', 'Sessions', 'languages', 'Fonts'];
  // [alpha.124 ข้อ 42] เดิม **ฮาร์ดโค้ดเล่มแรก/ฉบับร่างแรกเสมอ** — โปรเจกต์ที่มีหลายเล่ม
  // จึงดูกระดานของเล่มอื่นไม่ได้เลย (และเล่มที่ "แรก" ก็ขึ้นกับการเรียงชื่อ ไม่ใช่ลำดับจริง)
  // ตอนนี้: ใช้ฉบับร่างที่ผู้ใช้เลือกไว้ล่าสุด ถ้ายังไม่เคยเลือกค่อยตกกลับไปตัวแรกที่ใช้ได้
  let draftPath = KB.draftPath || savedDraft();
  if (draftPath && !(await kapi.exists(await kapi.join(draftPath, 'draft.json')))) draftPath = '';
  if (!draftPath) {
    const secs = (await kapi.listDirs(state.root)).filter((s) => !SKIP_DIRS.includes(s)).sort();
    for (const s of secs) {
      const dr = await kapi.join(await kapi.join(state.root, s), 'Draft');
      if (!(await kapi.exists(dr))) continue;
      const dns = (await kapi.listDirs(dr)).sort();
      if (!dns.length) continue;
      draftPath = await kapi.join(dr, dns[0]);
      break;
    }
  }
  if (!draftPath) return null;
  KB.draftPath = draftPath;
  // io ต้องมี join แบบ sync (kapi.join เป็น async) — ดู syncIo ใน project-scan.js
  board = new KanbanBoard({ io: syncIo(), draftPath, statuses: allStatuses() });
  await board.load();
  board.onChange(() => { if (board) { refreshKanbanUI(); } });
  return board;
}

let uiPane = null;

// บั๊ก #18: Kanban เป็นแผง ไม่ใช่แท็บเอกสาร
export async function openKanban() {
  const b = await getBoard();
  if (!b) { setStatus(t('ui.kanban.newDraftBeforeUse')); return; }
  showPanel('kanban');                 // hook ใน app.js เริ่มวาดให้ · await ตัวเดียวกันต่อ
  return renderKanbanPanel();
}

/** วาดเนื้อกระดานลง #kanban-body — ห้ามเรียก showPanel ในนี้ (วนซ้ำกับ hook) */
export async function renderKanbanPanel() {
  const b = await getBoard();
  if (!b) { setStatus(t('ui.kanban.newDraftBeforeUse')); return; }
  uiPane = $('#kanban-body');
  if (!uiPane) return;
  uiPane.classList.add('kanban-pane');
  await loadChapterTitles(b.draftPath);
  renderKanban(b);
}

// ══ [alpha.157] ★ Kanban = แหล่งความจริงของสถานะ · ซิงก์กับ Explorer อัตโนมัติ ══
// ผู้ใช้: *"สถานะใน explorer / kanban ซ้ำซ้อน และไม่ link กัน · ผู้ใช้เพิ่มสถานะได้จากกระดาน kanban ·
//          ทั้ง kanban และ explorer ต้อง auto sync กันและกัน โดยเฉพาะสถานะและสี"*
//
// ต้นตอเดิม: (1) คอลัมน์ที่เพิ่มบนกระดานเก็บใน localStorage (ของเครื่อง) — Explorer ไม่เคยเห็น
//            (2) กระดานโหลด scenes.json ครั้งเดียว — เปลี่ยนสถานะจากต้นไม้แล้วการ์ดไม่ขยับ
//            (3) ลากการ์ดแล้วต้นไม้ไม่วาดใหม่ · (4) ฉากที่ล้างสถานะจากต้นไม้ ('Outline') กลายเป็นคอลัมน์แปลก
// ตอนนี้: คอลัมน์ = `allStatuses()` ชุดเดียวกับเมนูสถานะของ Explorer (ลำดับ/สี/ลบ เก็บใน project.khn.json)
//        + ฟังการเขียนไฟล์ในหน้าต่างเดียวกัน (`kapi.onLocalWrite`) และเหตุการณ์ `k2-statuses-changed`
const SYNC = { bound: false, job: null, chapters: new Map() };

/** ชื่อบทของฉบับร่างที่กระดานแสดง — การ์ดโชว์ชื่อบท (เดิมโชว์ guid 4 ตัวแรก ซึ่งอ่านไม่ออก) */
async function loadChapterTitles(draftPath) {
  SYNC.chapters = new Map();
  try {
    const d = await kapi.readJson(await kapi.join(draftPath, 'draft.json'));
    for (const ch of (d.chapters || [])) SYNC.chapters.set(ch.guid, ch.title || '');
  } catch {}
}

function scheduleSync(reload) {
  clearTimeout(SYNC.job);
  SYNC.job = setTimeout(async () => {
    if (!board || !isPanelOpen('kanban')) return;
    try {
      board.statuses = allStatuses();
      if (reload) { await board._fresh(); await loadChapterTitles(board.draftPath); }
      refreshKanbanUI();
    } catch {}
  }, 180);
}

/** ผูกตัวฟังครั้งเดียวต่อหน้าต่าง */
export function bindKanbanSync() {
  if (SYNC.bound) return true;
  SYNC.bound = true;
  try {
    kapi.onLocalWrite((p) => {
      if (!board || !p) return;
      const norm = String(p).replace(/\\/g, '/');
      const dp = String(board.draftPath || '').replace(/\\/g, '/');
      if (dp && norm.startsWith(dp) && /\/(scenes|draft)\.json$/.test(norm)) scheduleSync(true);
    });
  } catch {}
  window.addEventListener('k2-statuses-changed', () => scheduleSync(false));
  return true;
}

// [alpha.167] ค้นหา/เรียงบนกระดาน — สภาพของหน้าต่างนี้ (ไม่ลงไฟล์ · เปิดใหม่เริ่มที่ลำดับบนกระดาน)
const VIEW = { q: '', sort: 'board' };
const SORTS = [['board', 'ui.kanban.sortBoard'], ['title', 'ui.kanban.sortTitle'], ['words', 'ui.kanban.sortWords']];

/** ตัวอักษรแรกของชื่อ — ข้ามสระหน้าของไทย (เ แ โ ใ ไ) ไม่งั้น "ไคลี่" ได้วงกลมตัว "ไ" */
function initialOf(name) {
  const s = String(name || '').trim().replace(/^[\u0E40-\u0E44]+/, '');
  const m = s.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}
/** สีประจำชื่อ (คงที่ต่อชื่อ) — จากชุดสีกราฟกลาง */
function hueOf(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return CHART_SERIES[h % CHART_SERIES.length];
}

function renderKanban(b) {
  if (!uiPane) return;
  bindKanbanSync();
  b.statuses = allStatuses();
  // ลำดับคอลัมน์มาจากโปรเจกต์ ไม่ใช่ localStorage (ที่เหลือใน layout = พับ/ WIP ของเครื่องนี้)
  b.store.layout = { ...b.store.layout, order: [UNSET, ...b.statuses], hidden: [] };   // ยังไม่กำหนดอยู่ซ้ายสุด
  const data = b.data();
  // [alpha.165] วาดใหม่ทั้งกระดานทุกครั้งที่ย้ายการ์ด → จำตำแหน่งเลื่อนไว้คืน (แนวนอนของแถวคอลัมน์ ·
  // แนวตั้งของแต่ละคอลัมน์ตามชื่อสถานะ) · เดิมกระโดดกลับซ้ายสุด/บนสุดทุกครั้ง
  const oldCols = uiPane.querySelector('.kb-cols');
  const keepX = oldCols ? oldCols.scrollLeft : 0;
  const keepY = new Map();
  for (const c of uiPane.querySelectorAll('.kb-col[data-status]')) {
    const cards = c.querySelector('.kb-cards');
    if (cards && cards.scrollTop) keepY.set(c.dataset.status, cards.scrollTop);
  }
  const hadFocus = document.activeElement && document.activeElement.classList.contains('kb-search');
  uiPane.innerHTML = '';
  const wrap = el('div', 'kb-wrap');

  // ── หัวกระดาน: ชื่อ + จำนวน · ค้นหา · เรียง · ร่าง · เพิ่มสถานะ · จัดการ ──
  // [alpha.167] ผู้ใช้: "karban มันควรจะเป็นแบบรูปที่ 2" — แถบเครื่องมือเดียว ปุ่มหลักขวาสุด
  const head = el('div', 'kb-head');
  const titleBox = el('div', 'kb-titlebox');
  titleBox.append(el('span', 'kb-title', 'Kanban'), el('span', 'kb-total', tf('ui.kanban.totalScenes', data.total)));
  head.append(titleBox);
  const tools = el('div', 'kb-tools');
  const searchBox = el('label', 'kb-searchbox');
  searchBox.append(el('span', 'kb-search-ico', gi('search')));
  const search = el('input', 'kb-search');
  search.type = 'search'; search.placeholder = t('ui.kanban.search'); search.value = VIEW.q;
  search.setAttribute('aria-label', t('ui.kanban.search'));
  let sJob = null;
  search.oninput = () => { clearTimeout(sJob); sJob = setTimeout(() => { VIEW.q = search.value.trim(); renderKanban(b); }, 160); };
  search.onkeydown = (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; VIEW.q = ''; renderKanban(b); } };
  searchBox.append(search);
  const sortSel = el('select', 'k-dlg-select kb-sort');
  sortSel.title = t('ui.kanban.sortBy'); sortSel.setAttribute('aria-label', t('ui.kanban.sortBy'));
  for (const [v, k] of SORTS) { const o = el('option', null, t(k)); o.value = v; sortSel.append(o); }
  sortSel.value = VIEW.sort;
  sortSel.onchange = () => { VIEW.sort = sortSel.value; renderKanban(b); };
  // [alpha.124 ข้อ 42] ตัวเลือกฉบับร่าง — เติมรายการแบบ async หลังวาดหัวเสร็จ (ไม่หน่วงกระดาน)
  const draftSel = el('select', 'k-dlg-select kb-draft');
  draftSel.title = t('ui.kanban.draftPick');
  // [alpha.165] ★ ต้นตอ "dropdown กระพริบมุมขวาบน" ตอนย้ายการ์ด: ช่องนี้เกิดใหม่ว่าง ๆ และ **มองเห็น** ทุกรอบวาด
  // จนรายชื่อร่าง (async) กลับมาแล้วถึงถูกซ่อน (โปรเจกต์ร่างเดียว) → วาดจากรายการที่จำไว้ทันที แล้วค่อยเติมของสด
  const fillDrafts = (ds) => {
    draftSel.replaceChildren();
    for (const d of ds) { const o = el('option', null, d.label); o.value = d.dPath; draftSel.append(o); }
    draftSel.value = KB.draftPath;
    draftSel.style.display = ds.length > 1 ? '' : 'none';   // เล่มเดียว = ไม่ต้องรกหัวกระดาน
  };
  if (_draftsCache) fillDrafts(_draftsCache); else draftSel.style.display = 'none';
  kanbanDrafts().then((ds) => {
    _draftsCache = ds;
    if (draftSel.isConnected) fillDrafts(ds);
  }).catch(() => {});
  draftSel.onchange = () => setKanbanDraft(draftSel.value);
  const mgrBtn = el('button', 'kb-manage', gi('cog'));
  mgrBtn.title = t('ui.kanban.manageStatus'); mgrBtn.setAttribute('aria-label', t('ui.kanban.manageStatus'));
  mgrBtn.onclick = () => manageCustomStatuses();
  const addBtn = el('button', 'kb-add-col', gi('plus-plain') + ' ' + t('ui.kanban.addStatus'));
  addBtn.title = t('ui.kanban.addStatusHint');
  addBtn.onclick = async () => {
    // window.prompt() เป็น no-op ใน Electron — ต้องใช้กล่องของโปรแกรมเอง
    const name = await ask(t('ui.kanban.newColumn'), { placeholder: t('ui.kanban.newColumnHint') });
    if (!name) return;
    const used = allStatuses().map((s) => statusColor(s));
    if (!(await addCustomStatus(name, nextStatusColor(used)))) { setStatus(t('ui.kanban.statusExists')); return; }
    renderKanban(b);
    treeRefresh();
  };
  tools.append(searchBox, sortSel, draftSel, mgrBtn, addBtn);
  head.append(tools);
  wrap.append(head);

  // ค้นหา: ชื่อฉาก · เรื่องย่อ · ผู้เล่า · แท็ก · ชื่อบท (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
  const q = VIEW.q.toLowerCase();
  const match = (card) => !q || [card.title, card.synopsis, card.pov, SYNC.chapters.get(card.chapterId), ...(card.tags || [])]
    .some((x) => String(x || '').toLowerCase().includes(q));
  const maxWords = Math.max(1, ...data.columns.flatMap((c) => c.cards.map((x) => x.words || 0)));
  const reorderable = VIEW.sort === 'board' && !q;

  const cols = el('div', 'kb-cols');
  for (const col of data.columns) {
    const isStatus = col.key !== UNSET;
    const colHex = isStatus ? vivid(statusColor(col.key)) : '';
    const colEl = el('div', 'kb-col' + (col.over ? ' kb-over' : '') + (col.custom ? ' kb-custom' : '')
      + (col.collapsed ? ' kb-collapsed' : '') + (isStatus ? '' : ' kb-col-unset'));
    colEl.dataset.status = col.key;
    colEl.style.setProperty('--kb-col', colHex || STATUS_UNSET);
    const shown = col.cards.filter(match);
    if (VIEW.sort === 'title') shown.sort((x, y) => cmpText(x.title, y.title));
    else if (VIEW.sort === 'words') shown.sort((x, y) => (y.words || 0) - (x.words || 0));

    // หัวคอลัมน์: จุดสีสถานะ · ชื่อ · จำนวน · ⋯ (สีเดียวกับชิปสถานะใน Explorer — จุด + พื้นคอลัมน์อ่อน ๆ)
    const colHead = el('div', 'kb-col-head');
    const toggleCol = async () => {
      b.store.layout = { ...b.store.layout, collapsed: col.collapsed
        ? b.store.layout.collapsed.filter((k) => k !== col.key)
        : [...(b.store.layout.collapsed || []), col.key] };
      b.store.save();
      renderKanban(b);
    };
    const toggleBtn = el('button', 'kb-col-toggle', col.collapsed ? gi('play') : gi('triangle-down'));
    toggleBtn.title = t(col.collapsed ? 'ui.kanban.colExpand' : 'ui.kanban.colCollapse');
    toggleBtn.setAttribute('aria-label', toggleBtn.title);
    toggleBtn.onclick = (e) => { e.stopPropagation(); toggleCol(); };
    const dot = el('span', 'kb-col-dot');
    const colTitle = el('span', 'kb-col-title');
    colTitle.textContent = (col.over ? gi('warning') + ' ' : '') + (isStatus ? dataLabel(col.label) : t('ui.kanban.unset'));
    const colCount = el('span', 'kb-col-count', q && shown.length !== col.count ? shown.length + '/' + col.count : String(col.count));
    colHead.append(toggleBtn, dot, colTitle, colCount);

    if (isStatus) {
      // เปลี่ยนสีสถานะ — Explorer เปลี่ยนตามทันที · ช่องเลือกสีจริงซ่อนอยู่ในหัว เปิดจากเมนู ⋯ หรือคลิกจุดสี
      const pick = el('label', 'kb-col-color');
      pick.title = t('ui.status.recolorStatus');
      const inp = el('input', 'kb-col-color-input');
      inp.type = 'color'; inp.value = normHex(statusColor(col.key)) || STATUS_UNSET;
      inp.onchange = async () => { await setStatusColor(col.key, inp.value); refreshStatusChips(); treeRefresh(); };
      pick.append(inp);
      pick.addEventListener('mousedown', (e) => e.stopPropagation());
      dot.replaceWith(pick);
      pick.prepend(dot);
      const delCol = async () => {
        const others = allStatuses().filter((s) => s !== col.key);
        if (col.count) {
          if (!(await confirmBox(tf('ui.kanban.deleteMove', dataLabel(col.key), col.count, others[0] ? dataLabel(others[0]) : t('ui.kanban.unset')), t('ui.common.del')))) return;
          const res = await b.removeColumn(col.key, { moveTo: others[0] || UNSET });
          if (!res.ok) { setStatus(t('ui.kanban.moveScenesFirst')); return; }
        } else if (!(await confirmBox(tf('ui.status.delStatus', dataLabel(col.key)), t('ui.common.del')))) return;
        await deleteStatus(col.key);
        renderKanban(b);
        treeRefresh();
      };
      const delBtn = el('span', 'kb-col-del', gi('close'));   // ทางลัดเดิม (e2e + ผู้ใช้เดิม) — โผล่ตอนชี้หัวคอลัมน์
      delBtn.title = t('ui.kanban.deleteColumn');
      delBtn.onclick = (e) => { e.stopPropagation(); delCol(); };
      const more = el('button', 'kb-col-more', gi('more'));
      more.title = t('ui.kanban.colMenu'); more.setAttribute('aria-label', t('ui.kanban.colMenu'));
      more.onclick = (e) => {
        e.stopPropagation();
        const r = more.getBoundingClientRect();
        popupMenu(r.left, r.bottom + 4, [
          { text: t('ui.kanban.colColor'), swatch: colHex, click: () => inp.click() },
          { text: t(col.collapsed ? 'ui.kanban.colExpand' : 'ui.kanban.colCollapse'), click: toggleCol },
          '-',
          { text: t('ui.kanban.deleteColumn'), danger: true, click: delCol },
        ]);
      };
      colHead.append(delBtn, more);
      // ลากหัวคอลัมน์เพื่อสลับลำดับสถานะ (ลำดับเดียวกับเมนูสถานะของ Explorer)
      colHead.draggable = true;
      colHead.ondragstart = (e) => {
        e.dataTransfer.setData('text/k2-kb-col', col.key);
        e.dataTransfer.effectAllowed = 'move';
        colEl.classList.add('kb-col-dragging');
      };
      colHead.ondragend = () => colEl.classList.remove('kb-col-dragging');
    }
    colEl.append(colHead);

    if (!col.collapsed) {
      const cardList = el('div', 'kb-cards');
      for (const card of shown) cardList.append(cardEl(card, colHex, maxWords));
      if (!shown.length) cardList.append(el('div', 'kb-empty', t(q && col.count ? 'ui.kanban.noMatch' : 'ui.kanban.empty')));
      colEl.append(cardList);

      /** ตำแหน่งที่จะแทรก (ในรายการเต็มของคอลัมน์) จากตำแหน่งเมาส์แนวตั้ง
       *  [alpha.167] กรอง/เรียงอยู่ = การ์ดที่เห็นไม่ใช่ลำดับจริง → วางท้ายคอลัมน์ (ไม่เดาตำแหน่งผิด) */
      const visibleIndex = (clientY) => {
        const cards = [...cardList.querySelectorAll('.kb-card:not(.kb-dragging)')];
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          if (clientY < r.top + r.height / 2) return i;
        }
        return cards.length;
      };
      const dropIndex = (clientY) => (reorderable ? visibleIndex(clientY) : col.cards.length);
      const showMarker = (idx) => {
        let mk = cardList.querySelector('.kb-drop-mark');
        if (!mk) { mk = el('div', 'kb-drop-mark'); }
        const cards = [...cardList.querySelectorAll('.kb-card:not(.kb-dragging)')];
        if (idx >= cards.length) cardList.append(mk);
        else cardList.insertBefore(mk, cards[idx]);
      };
      const clearMarker = () => cardList.querySelector('.kb-drop-mark')?.remove();
      colEl.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        colEl.classList.add('kb-drag-over');
        if (!isColDrag(e)) showMarker(reorderable ? visibleIndex(e.clientY) : Infinity);
      };
      colEl.ondragleave = (e) => {
        if (colEl.contains(e.relatedTarget)) return;
        colEl.classList.remove('kb-drag-over');
        clearMarker();
      };
      colEl.ondrop = async (e) => {
        e.preventDefault();
        colEl.classList.remove('kb-drag-over');
        clearMarker();
        if (await dropColumn(e, col.key, b)) return;
        const idx = dropIndex(e.clientY);
        const sceneId = e.dataTransfer.getData('text/plain');
        if (!sceneId) return;
        await b.moveCard(sceneId, col.key, idx);
        renderKanban(b);
        treeRefresh();
      };
    } else {
      colEl.ondragover = (e) => { e.preventDefault(); };
      colEl.ondrop = async (e) => { e.preventDefault(); await dropColumn(e, col.key, b); };
    }
    cols.append(colEl);
  }
  wrap.append(cols);
  uiPane.append(wrap);
  if (keepX) cols.scrollLeft = keepX;
  for (const [k, y] of keepY) {
    const c = [...cols.querySelectorAll('.kb-col[data-status]')].find((x) => x.dataset.status === k);
    const cards = c && c.querySelector('.kb-cards');
    if (cards) cards.scrollTop = y;
  }
  if (hadFocus) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
}

/** การ์ดหนึ่งใบ: แท็ก · ชื่อ · เรื่องย่อ · ความยาว · ผู้เล่า + บท */
function cardEl(card, colHex, maxWords) {
  const cardEl = el('div', 'kb-card');
  cardEl.draggable = true;
  cardEl.tabIndex = 0;
  cardEl.dataset.sceneId = card.id;
  cardEl.title = t('ui.kanban.openHint');
  // แถบสีซ้าย: สีป้ายของฉาก → ไม่มีก็ใช้สีสถานะ
  const stripe = vivid(card.color) || colHex;
  if (stripe) { cardEl.style.setProperty('--kb-card', stripe); cardEl.classList.add('kb-card-colored'); }
  // แท็ก (สูงสุดสองอัน) + ธง/ล็อก
  const tags = (card.tags || []).filter(Boolean);
  if (tags.length || card.flag || card.locked) {
    const top = el('div', 'kb-card-top');
    for (const tg of tags.slice(0, 2)) top.append(el('span', 'kb-tag', tg));
    if (tags.length > 2) top.append(el('span', 'kb-tag kb-tag-more', '+' + (tags.length - 2)));
    const marks = el('span', 'kb-card-marks');
    if (card.flag) { const f = el('span', 'kb-flag', gi('star')); marks.append(f); }
    if (card.locked) { const l = el('span', 'kb-lock', gi('lock')); l.title = t('ui.kanban.locked'); marks.append(l); }
    top.append(marks);
    cardEl.append(top);
  }
  const title = el('div', 'kb-card-title');
  title.textContent = card.title;
  cardEl.append(title);
  if (card.synopsis) cardEl.append(el('div', 'kb-card-syn', card.synopsis));
  // ความยาว: แถบเทียบกับฉากที่ยาวที่สุดบนกระดาน (ไม่ใช่ "ความคืบหน้า" — ฉากไม่มีเป้าหมายคำของตัวเอง)
  if (card.words) {
    const prog = el('div', 'kb-card-len');
    prog.title = t('ui.kanban.wordsBar');
    const bar = el('div', 'kb-len-bar'); const fill = el('i', 'kb-len-fill');
    fill.style.width = Math.max(4, Math.round(card.words / maxWords * 100)) + '%';
    bar.append(fill);
    prog.append(bar, el('span', 'kb-len-num', tf('ui.kanban.words', fmtNum(card.words))));
    cardEl.append(prog);
  }
  const chTitle = SYNC.chapters.get(card.chapterId);
  if (chTitle || card.pov) {
    const meta = el('div', 'kb-card-meta');
    if (card.pov) {
      const who = el('span', 'kb-pov');
      const av = el('span', 'kb-avatar', initialOf(card.pov));
      av.style.setProperty('--av', hueOf(card.pov));
      who.append(av, el('span', 'kb-pov-name', card.pov));
      meta.append(who);
    }
    if (chTitle) meta.append(el('span', 'kb-chapter', gi('folder') + ' ' + chTitle));
    cardEl.append(meta);
  }

  const open = async () => {
    if (!board) return;
    // ต้องใช้ folderName ของบทนั้น — ชื่อไฟล์ (scene-01.md) ซ้ำกันได้หลายบท
    const folders = await chapterFolders(board.draftPath);
    const p = await scenePath(board.draftPath, card.chapterId, card, folders);
    if (card.fileName && await kapi.exists(p)) {
      const { openScene } = await import('../app.js');
      openScene(p, card.title);
      return;
    }
    setStatus(t('ui.kanban.sceneNotFound') + card.title);
  };
  // ดับเบิลคลิก / Enter เปิดฉาก
  cardEl.ondblclick = open;
  cardEl.onkeydown = (e) => { if (e.key === 'Enter' && e.target === cardEl) { e.preventDefault(); open(); } };
  cardEl.ondragstart = (e) => {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    cardEl.classList.add('kb-dragging');
  };
  cardEl.ondragend = () => cardEl.classList.remove('kb-dragging');
  return cardEl;
}

const isColDrag = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('text/k2-kb-col');
/** วางหัวคอลัมน์ลงคอลัมน์อื่น = ย้ายลำดับสถานะ · คืน true ถ้าเป็นการลากคอลัมน์ */
async function dropColumn(e, targetKey, b) {
  // ต้องดูชนิดข้อมูลก่อน — ตัวลากการ์ดบางทาง (และเทส) คืนค่าเดียวกันทุกชนิดที่ขอ
  if (!isColDrag(e)) return false;
  const from = e.dataTransfer.getData('text/k2-kb-col');
  if (!from || !allStatuses().includes(from)) return false;
  if (from === targetKey || targetKey === UNSET) return true;
  const order = allStatuses().filter((s) => s !== from);
  const at = order.indexOf(targetKey);
  order.splice(at < 0 ? order.length : at, 0, from);
  await setStatusOrder(order);
  renderKanban(b);
  treeRefresh();
  return true;
}

function treeRefresh() {
  import('../app.js').then((m) => m.refreshTreeQueued && m.refreshTreeQueued()).catch(() => {});
}

function refreshKanbanUI() {
  if (!board) return;
  // แผงอาจถูกวาดใหม่ (ย้าย dock/ลอย) → หยิบ element ปัจจุบันเสมอ ไม่ยึดตัวที่ค้างไว้
  if (isPanelOpen('kanban')) uiPane = $('#kanban-body');
  if (!uiPane) return;
  renderKanban(board);
}

// โหลดซ้ำเมื่อเปลี่ยนโปรเจกต์
export function resetKanban() { board = null; uiPane = null; _draftsCache = null; }
