// kanban-ui.js — กระดาน Kanban แสดงฉากตามสถานะ · ลากการ์ดเปลี่ยนสถานะ (ข้อ 12)
import { $, el, setStatus, state, SCENE_COLORS, t } from '../core.js';
import { KanbanBoard } from './kanban-core.js';   // คอลัมน์จัดการผ่านเมธอดของ board (addColumn/removeColumn)
import { allStatuses, statusColor } from '../custom-status.js';
import { chapterFolders, scenePath, syncIo } from '../project-scan.js';
import { ask } from '../ui.js';
import { showPanel, isPanelOpen } from '../panels/panel-ui.js';

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
  renderKanban(b);
}

function renderKanban(b) {
  if (!uiPane) return;
  const data = b.data();
  uiPane.innerHTML = '';
  const wrap = el('div', 'kb-wrap');

  // หัวกระดาน + ปุ่มเพิ่มคอลัมน์
  const head = el('div', 'kb-head');
  head.append(el('span', 'kb-title', '📋 Kanban — ' + data.total + t('ui.common.scene')));
  const addBtn = el('button', 'kb-add-col', t('ui.kanban.add'));
  addBtn.onclick = async () => {
    // window.prompt() เป็น no-op ใน Electron — ต้องใช้กล่องของโปรแกรมเอง
    const name = await ask(t('ui.kanban.newColumn'), { placeholder: t('ui.kanban.newColumnHint') });
    if (!name) return;
    await b.addColumn(name);
    renderKanban(b);
  };
  head.append(addBtn);
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
    const colEl = el('div', 'kb-col' + (col.over ? ' kb-over' : '') + (col.custom ? ' kb-custom' : ''));
    colEl.dataset.status = col.key;

    const colHead = el('div', 'kb-col-head');
    // แถบสีหัวคอลัมน์ = สีประจำสถานะ (ตั้งได้ในกล่องจัดการสถานะฉาก)
    const colHex = statusColor(col.key);
    if (colHex) colHead.style.borderTop = '3px solid ' + colHex;
    const colTitle = el('span', 'kb-col-title');
    colTitle.textContent = (col.over ? '⚠ ' : '') + col.label + ' (' + col.count + ')';
    colHead.append(colTitle);

    // ปุ่มลบคอลัมน์ (เฉพาะคอลัมน์ที่กำหนดเอง)
    if (col.custom) {
      const delBtn = el('span', 'kb-col-del', '×');
      delBtn.title = t('ui.kanban.deleteColumn');
      delBtn.onclick = async (e) => { e.stopPropagation();
        const res = await b.removeColumn(col.key, { moveTo: allStatuses()[0] || '' });
        if (!res.ok) { setStatus(t('ui.kanban.moveScenesFirst')); return; }
        renderKanban(b);
      };
      colHead.append(delBtn);
    }

    // ยุบ/ขยาย
    const toggleBtn = el('span', 'kb-col-toggle', col.collapsed ? '▶' : '▼');
    toggleBtn.onclick = async () => {
      b.store.layout = { ...b.store.layout, collapsed: col.collapsed
        ? b.store.layout.collapsed.filter((k) => k !== col.key)
        : [...(b.store.layout.collapsed || []), col.key] };
      b.store.save();
      renderKanban(b);
    };
    colHead.prepend(toggleBtn);
    colEl.append(colHead);

    if (!col.collapsed) {
      const cardList = el('div', 'kb-cards');
      for (const card of col.cards) {
        const cardEl = el('div', 'kb-card');
        cardEl.draggable = true;
        cardEl.dataset.sceneId = card.id;
        cardEl.textContent = card.title;

        // ระบายสีตามแท็กสี
        if (card.color) cardEl.style.borderLeftColor = SCENE_COLORS.find((c) => c[0] === card.color)?.[1] || '';

        // แสดงป้ายสั้น ๆ (chapter, pov)
        if (card.chapterId) {
          const badge = el('span', 'kb-badge');
          badge.textContent = card.chapterId.slice(0, 4);
          cardEl.append(badge);
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

        // อ่านบทก่อนวาง (drag)
        cardEl.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', card.id);
          e.dataTransfer.effectAllowed = 'move';
          cardEl.classList.add('kb-dragging');
        };
        cardEl.ondragend = () => cardEl.classList.remove('kb-dragging');
        cardList.append(cardEl);
      }
      colEl.append(cardList);

      // ═══ [alpha.124 ข้อ 42] ลากแล้ว **เลือกตำแหน่งในคอลัมน์ได้** ═══
      //
      // เดิม drop เรียก `updateSceneStatus(id, status)` เฉย ๆ → การ์ดไปต่อท้ายเสมอ
      // จัดลำดับฉากบนกระดานไม่ได้เลย ทั้งที่เอนจินรองรับมาตั้งแต่แรก
      // (`moveCard(id, status, index)` + `kbOrder` ที่เขียนลง scenes.json ให้ด้วย)
      // ที่ขาดคือฝั่ง UI ไม่เคยคำนวณ index ส่งไป

      /** ตำแหน่งที่จะแทรก จากตำแหน่งเมาส์แนวตั้ง (เทียบกับกึ่งกลางการ์ดแต่ละใบ) */
      const dropIndex = (clientY) => {
        const cards = [...cardList.querySelectorAll('.kb-card:not(.kb-dragging)')];
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          if (clientY < r.top + r.height / 2) return i;
        }
        return cards.length;
      };
      /** เส้นบอกตำแหน่งที่จะวาง — ไม่มีเส้นนี้ผู้ใช้เดาไม่ออกว่าจะลงตรงไหน */
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
        showMarker(dropIndex(e.clientY));
      };
      colEl.ondragleave = (e) => {
        // dragleave ยิงตอนเมาส์ข้ามไปทับ "ลูก" ของคอลัมน์ด้วย → เช็คว่าออกจากคอลัมน์จริงไหม
        if (colEl.contains(e.relatedTarget)) return;
        colEl.classList.remove('kb-drag-over');
        clearMarker();
      };
      colEl.ondrop = async (e) => {
        e.preventDefault();
        colEl.classList.remove('kb-drag-over');
        const idx = dropIndex(e.clientY);
        clearMarker();
        const sceneId = e.dataTransfer.getData('text/plain');
        if (!sceneId) return;
        await b.moveCard(sceneId, col.key, idx);
        renderKanban(b);
      };
    }
    cols.append(colEl);
  }
  wrap.append(cols);
  uiPane.append(wrap);
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
