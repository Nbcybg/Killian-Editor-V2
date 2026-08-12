// kanban-ui.js — กระดาน Kanban แสดงฉากตามสถานะ · ลากการ์ดเปลี่ยนสถานะ (ข้อ 12)
import { T } from '../i18n.js';
import { $, el, setStatus, state, SCENE_COLORS, t } from '../core.js';
import { KanbanBoard } from './kanban-core.js';   // คอลัมน์จัดการผ่านเมธอดของ board (addColumn/removeColumn)
import { allStatuses, statusColor } from '../custom-status.js';
import { chapterFolders, scenePath, syncIo } from '../project-scan.js';
import { ask } from '../ui.js';
import { showPanel, isPanelOpen } from '../panels/panel-ui.js';

let board = null;   // KanbanBoard instance

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
  const secs = (await kapi.listDirs(state.root)).filter((s) => !SKIP_DIRS.includes(s)).sort();
  let draftPath = null;
  for (const s of secs) {
    const dr = await kapi.join(await kapi.join(state.root, s), 'Draft');
    if (!(await kapi.exists(dr))) continue;
    const dns = (await kapi.listDirs(dr)).sort();
    if (!dns.length) continue;
    draftPath = await kapi.join(dr, dns[0]);
    break;
  }
  if (!draftPath) return null;
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
  if (!b) { setStatus(T`สร้างฉบับร่างก่อนจึงจะใช้ Kanban ได้`); return; }
  showPanel('kanban');                 // hook ใน app.js เริ่มวาดให้ · await ตัวเดียวกันต่อ
  return renderKanbanPanel();
}

/** วาดเนื้อกระดานลง #kanban-body — ห้ามเรียก showPanel ในนี้ (วนซ้ำกับ hook) */
export async function renderKanbanPanel() {
  const b = await getBoard();
  if (!b) { setStatus(T`สร้างฉบับร่างก่อนจึงจะใช้ Kanban ได้`); return; }
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
  head.append(el('span', 'kb-title', '📋 Kanban — ' + data.total + T` ฉาก`));
  const addBtn = el('button', 'kb-add-col', T`+ เพิ่มคอลัมน์`);
  addBtn.onclick = async () => {
    // window.prompt() เป็น no-op ใน Electron — ต้องใช้กล่องของโปรแกรมเอง
    const name = await ask(t('kanban.newColumn', 'ชื่อคอลัมน์ใหม่'), { placeholder: t('kanban.newColumnHint', 'เช่น รอรีวิว') });
    if (!name) return;
    await b.addColumn(name);
    renderKanban(b);
  };
  head.append(addBtn);
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
      delBtn.title = t('kanban.deleteColumn', 'ลบคอลัมน์');
      delBtn.onclick = async (e) => { e.stopPropagation();
        const res = await b.removeColumn(col.key, { moveTo: allStatuses()[0] || '' });
        if (!res.ok) { setStatus(t('kanban.moveScenesFirst', 'ย้ายฉากออกจากคอลัมน์นี้ก่อน')); return; }
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
          setStatus(t('kanban.sceneNotFound', 'ไม่พบไฟล์ฉาก: ') + card.title);
        };

        // อ่านบทก่อนวาง (drag)
        cardEl.ondragstart = (e) => { e.dataTransfer.setData('text/plain', card.id); };
        cardList.append(cardEl);
      }
      colEl.append(cardList);

      // drop zone บนคอลัมน์
      colEl.ondragover = (e) => { e.preventDefault(); colEl.classList.add('kb-drag-over'); };
      colEl.ondragleave = () => { colEl.classList.remove('kb-drag-over'); };
      colEl.ondrop = async (e) => {
        e.preventDefault();
        colEl.classList.remove('kb-drag-over');
        const sceneId = e.dataTransfer.getData('text/plain');
        if (!sceneId) return;
        const toStatus = col.key;
        await b.updateSceneStatus(sceneId, toStatus);
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

export function closeKanban() {
  board = null; uiPane = null;
}

// โหลดซ้ำเมื่อเปลี่ยนโปรเจกต์
export function resetKanban() { board = null; uiPane = null; }
