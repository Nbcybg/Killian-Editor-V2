// kanban-ui.js — กระดาน Kanban แสดงฉากตามสถานะ · ลากการ์ดเปลี่ยนสถานะ (ข้อ 12)
import { $, el, setStatus, state, t, tf, dataLabel } from '../core.js';
import { STATUS_UNSET } from '../palette.js';   // [alpha.162 · W6 ข้อ 2] ตัวเดียวกับแดชบอร์ด
import { KanbanBoard, UNSET } from './kanban-core.js';   // คอลัมน์จัดการผ่านเมธอดของ board (removeColumn)
import { allStatuses, statusColor, setStatusColor, addCustomStatus, deleteStatus, setStatusOrder,
         manageCustomStatuses, refreshStatusChips } from '../custom-status.js';
import { vivid, inkOn, normHex, nextStatusColor } from '../color-util.js';
import { chapterFolders, scenePath, syncIo } from '../project-scan.js';
import { ask, confirmBox } from '../ui.js';
import { showPanel, isPanelOpen } from '../panels/panel-ui.js';
import { gi } from '../icons.js';

let board = null;   // KanbanBoard instance

// [alpha.124 ข้อ 42] ฉบับร่างที่กระดานกำลังแสดง — จำต่อโปรเจกต์
// (ES module: ค่าที่ reassign ข้ามฟังก์ชันเก็บใน object — กฎเหล็กข้อ 2)
const KB = { draftPath: '' };
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

function renderKanban(b) {
  if (!uiPane) return;
  bindKanbanSync();
  b.statuses = allStatuses();
  // ลำดับคอลัมน์มาจากโปรเจกต์ ไม่ใช่ localStorage (ที่เหลือใน layout = พับ/ WIP ของเครื่องนี้)
  b.store.layout = { ...b.store.layout, order: [UNSET, ...b.statuses], hidden: [] };   // ยังไม่กำหนดอยู่ซ้ายสุด
  const data = b.data();
  uiPane.innerHTML = '';
  const wrap = el('div', 'kb-wrap');

  // หัวกระดาน
  const head = el('div', 'kb-head');
  head.append(el('span', 'kb-title', gi('clipboard') + ' Kanban — ' + data.total + t('ui.common.scene')));
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
  const mgrBtn = el('button', 'kb-manage', gi('cog') + ' ' + t('ui.kanban.manageStatus'));
  mgrBtn.onclick = () => manageCustomStatuses();
  head.append(addBtn, mgrBtn);
  // [alpha.124 ข้อ 42] ตัวเลือกฉบับร่าง — เติมรายการแบบ async หลังวาดหัวเสร็จ (ไม่หน่วงกระดาน)
  const draftSel = el('select', 'k-dlg-select kb-draft');
  draftSel.title = t('ui.kanban.draftPick');
  head.append(draftSel);
  kanbanDrafts().then((ds) => {
    if (!draftSel.isConnected) return;
    draftSel.replaceChildren();
    for (const d of ds) { const o = el('option', null, d.label); o.value = d.dPath; draftSel.append(o); }
    draftSel.value = KB.draftPath;
    draftSel.style.display = ds.length > 1 ? '' : 'none';   // เล่มเดียว = ไม่ต้องรกหัวกระดาน
  }).catch(() => {});
  draftSel.onchange = () => setKanbanDraft(draftSel.value);
  wrap.append(head);

  const cols = el('div', 'kb-cols');
  for (const col of data.columns) {
    const isStatus = col.key !== UNSET;
    const colHex = isStatus ? vivid(statusColor(col.key)) : '';
    const colEl = el('div', 'kb-col' + (col.over ? ' kb-over' : '') + (col.custom ? ' kb-custom' : '')
      + (col.collapsed ? ' kb-collapsed' : ''));
    colEl.dataset.status = col.key;
    if (colHex) colEl.style.setProperty('--kb-col', colHex);

    // หัวคอลัมน์ = แถบสีเต็มแถบ (สีเดียวกับชิปสถานะใน Explorer)
    const colHead = el('div', 'kb-col-head');
    if (colHex) { colHead.style.background = colHex; colHead.style.color = inkOn(colHex); }
    const toggleBtn = el('span', 'kb-col-toggle', col.collapsed ? gi('play') : gi('triangle-down'));
    toggleBtn.onclick = async () => {
      b.store.layout = { ...b.store.layout, collapsed: col.collapsed
        ? b.store.layout.collapsed.filter((k) => k !== col.key)
        : [...(b.store.layout.collapsed || []), col.key] };
      b.store.save();
      renderKanban(b);
    };
    const colTitle = el('span', 'kb-col-title');
    colTitle.textContent = (col.over ? gi('warning') + ' ' : '') + (isStatus ? dataLabel(col.label) : t('ui.kanban.unset'));
    const colCount = el('span', 'kb-col-count', String(col.count));
    colHead.append(toggleBtn, colTitle, colCount);

    if (isStatus) {
      // เปลี่ยนสีสถานะจากหัวคอลัมน์ — Explorer เปลี่ยนตามทันที
      // จุดสีที่เห็นเป็นกล่องธรรมดา · ช่องเลือกสีจริงโปร่งใสวางทับ (ช่อง color ของ Chromium จัดหน้าตายาก)
      const pick = el('label', 'kb-col-color');
      pick.style.background = colHex;
      pick.title = t('ui.status.recolorStatus');
      const inp = el('input', 'kb-col-color-input');
      inp.type = 'color'; inp.value = normHex(statusColor(col.key)) || STATUS_UNSET;
      inp.onchange = async () => { await setStatusColor(col.key, inp.value); refreshStatusChips(); treeRefresh(); };
      pick.append(inp);
      pick.addEventListener('mousedown', (e) => e.stopPropagation());
      const delBtn = el('span', 'kb-col-del', gi('close'));
      delBtn.title = t('ui.kanban.deleteColumn');
      delBtn.onclick = async (e) => {
        e.stopPropagation();
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
      colHead.append(pick, delBtn);
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
      for (const card of col.cards) {
        const cardEl = el('div', 'kb-card');
        cardEl.draggable = true;
        cardEl.dataset.sceneId = card.id;
        // แถบสีเต็มแถบ: สีป้ายของฉาก → ไม่มีก็ใช้สีสถานะ
        const stripe = vivid(card.color) || colHex;
        if (stripe) { cardEl.style.setProperty('--kb-card', stripe); cardEl.classList.add('kb-card-colored'); }
        cardEl.append(el('div', 'kb-card-title', null));
        cardEl.lastChild.textContent = card.title;
        const chTitle = SYNC.chapters.get(card.chapterId);
        if (chTitle || card.pov) {
          const meta = el('div', 'kb-card-meta');
          meta.textContent = [chTitle, card.pov].filter(Boolean).join(' · ');
          cardEl.append(meta);
        }

        // ดับเบิลคลิกเปิดฉาก
        cardEl.ondblclick = async () => {
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

        cardEl.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', card.id);
          e.dataTransfer.effectAllowed = 'move';
          cardEl.classList.add('kb-dragging');
        };
        cardEl.ondragend = () => cardEl.classList.remove('kb-dragging');
        cardList.append(cardEl);
      }
      colEl.append(cardList);

      /** ตำแหน่งที่จะแทรก จากตำแหน่งเมาส์แนวตั้ง (เทียบกับกึ่งกลางการ์ดแต่ละใบ) */
      const dropIndex = (clientY) => {
        const cards = [...cardList.querySelectorAll('.kb-card:not(.kb-dragging)')];
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          if (clientY < r.top + r.height / 2) return i;
        }
        return cards.length;
      };
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
        if (!isColDrag(e)) showMarker(dropIndex(e.clientY));
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
export function resetKanban() { board = null; uiPane = null; }
