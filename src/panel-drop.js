// panel-drop.js — [alpha.167] "หยิบใส่" ระดับโปรแกรม: ทุกแผงรับของที่ลากมาได้
//
// ชั้นการตัดสิน (จากในสุดออกนอกสุด — ตัวแรกที่รับ = จบ):
//   1. ตัวรับเฉพาะของแผง (`bindDropTarget` ในตัววาดแผง — แผนที่ · กระดานอารมณ์ · เส้นเวลา · กระดานวางแผน ฯลฯ)
//      ตัวพวกนี้ `stopPropagation()` เอง ตัวกลางข้างล่างจึงไม่เห็นเลย
//   2. ช่องพิมพ์ (input · textarea · contenteditable) = ปล่อยให้เบราว์เซอร์วางข้อความ (ชื่อของที่ลาก)
//      — แหล่งทุกแหล่งตั้ง `text/plain` = ชื่อไว้แล้ว (`setDrag`) แชท/โน้ต/ช่องค้นหาจึงได้ชื่อไปฟรี
//   3. ตัวแก้ไขเอกสาร: เอกสาร (ฉาก/โน้ต/บท/แท็บ) = **เปิด** · เอนทิตี้ = แทรกชื่อ (ProseMirror ทำเองจาก text/plain)
//   4. แผงอื่นทุกใบ: ตารางด้านล่าง (`PANEL_DROP`) · ไม่มีในตาราง = เปิดของชิ้นนั้น
//
// ระหว่างลากมีป้ายเล็ก ๆ ข้างเคอร์เซอร์บอกว่า "ปล่อยตรงนี้แล้วจะเกิดอะไร" — ผู้ใช้ไม่ต้องเดา
import { t, tf } from './i18n.js';
import { el, state, setStatus, log } from './core.js';
import { dragKinds, readDrop, DOC_KINDS } from './drop-kit.js';
import { panelIdAt } from './panels/panel-focus.js';

/** แผงที่มีตัวรับของตัวเอง (ชั้น 1) — ตัวกลางแค่โชว์ป้าย ไม่ลงมือทำเอง */
const OWN = {
  maps:            { kinds: ['entity', 'scene', 'memo', 'map', 'image', 'gallery'], hint: 'ui.drop.hintMap' },
  'gallery-board': { kinds: ['entity', 'scene', 'memo', 'chapter', 'image', 'gallery', 'url', 'book'], hint: 'ui.drop.hintCard' },
  timeline:        { kinds: ['entity', 'scene', 'memo'], hint: 'ui.drop.hintTimeline' },
  planner:         { kinds: ['scene', 'entity', 'memo', 'chapter'], hint: 'ui.drop.hintCard' },
  network:         { kinds: ['entity'], hint: 'ui.drop.hintFocus' },
};
/** แผงที่ "ไม่รับ" (มีการลากภายในของตัวเอง — ตัวกลางห้ามยุ่ง) */
const SKIP = new Set(['tree', 'toolbar', 'statusbar', 'kanban', 'gallery', 'books', 'chapters']);

const EDITABLE = 'input, textarea, [contenteditable="true"], [contenteditable=""]';

function isEditable(node) {
  const n = node && node.nodeType === 1 ? node : node && node.parentElement;
  if (!n || !n.closest) return false;
  if (n.closest('.ProseMirror')) return false;          // ตัวแก้ไขเอกสารมีกติกาของตัวเอง (ชั้น 3)
  return !!n.closest(EDITABLE);
}

/** ป้ายข้างเคอร์เซอร์ */
let _tip = null;
function showTip(x, y, text) {
  if (!_tip || !_tip.isConnected) { _tip = el('div', 'k-drop-tip'); document.body.append(_tip); }
  _tip.textContent = text;
  _tip.style.left = (x + 16) + 'px';
  _tip.style.top = (y + 14) + 'px';
  _tip.style.display = '';
}
function hideTip() { if (_tip) _tip.style.display = 'none'; }

/** แผงนี้ทำอะไรกับการลากชุดนี้ — คืน { mode, hint } หรือ null (ไม่รับ) */
export function dropIntent(panelId, kinds, target) {
  if (!kinds || !kinds.length) return null;
  if (panelId && SKIP.has(panelId)) return null;
  if (isEditable(target)) return { mode: 'text', hint: 'ui.drop.hintText' };
  if (panelId && OWN[panelId]) {
    return kinds.some((k) => OWN[panelId].kinds.includes(k)) ? { mode: 'own', hint: OWN[panelId].hint } : null;
  }
  const inEditor = !!(target && target.closest && target.closest('.ProseMirror'));
  if (inEditor && kinds.includes('entity')) return { mode: 'text', hint: 'ui.drop.hintInsertName' };
  if (kinds.some((k) => DOC_KINDS.has(k) || k === 'chapter' || k === 'book' || k === 'map')) {
    return { mode: 'open', hint: 'ui.drop.hintOpen' };
  }
  return null;
}

/** เปิดของที่ถูกวาง (ทางเดียวกับที่คลิกใน Explorer) */
export async function openDropped(payload) {
  const app = await import('./app.js');
  const it = payload.items[0];
  if (!it) return false;
  switch (payload.kind) {
    case 'scene': case 'memo': case 'image':
      if (it.path) { app.openScene(it.path, it.title); return true; }
      return false;
    case 'entity': {
      const { openEntity } = await import('./wiki-ui.js');
      openEntity(it.path); return true;
    }
    case 'tab':
      if (state.tabs.has(it.path)) { app.activate(it.path); return true; }
      return false;
    case 'chapter': return openChapterFirst(it);
    case 'book': {
      const { openBookManager } = await import('./books.js');
      await openBookManager(); return true;
    }
    case 'map': {
      const { focusMapPin } = await import('./maps-ui.js');
      await focusMapPin(it.id, null, null); return true;
    }
    default: return false;
  }
}

async function openChapterFirst(it) {
  const dPath = it.draftDir, guid = it.guid;
  if (!dPath || !guid) return false;
  try {
    const dj = await kapi.readJson(await kapi.join(dPath, 'draft.json'));
    const ch = (dj.chapters || []).find((c) => c.guid === guid);
    const sj = await kapi.readJson(await kapi.join(dPath, 'scenes.json'));
    const sc = ((sj.chapters || {})[guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    if (!ch || !sc) { setStatus(t('ui.drop.chapterEmpty')); return false; }
    const { openScene } = await import('./app.js');
    openScene(await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName), sc.title);
    return true;
  } catch (e) { log('warn', 'drop: open chapter failed', e); return false; }
}

let _bound = false;
/** ผูกตัวกลางเข้ากับเอกสาร — เรียกครั้งเดียวตอนบูต */
export function installPanelDrop() {
  if (_bound) return false;
  _bound = true;
  let lastKinds = [];
  // ชั้น 3 (ตัวแก้ไข): ฉาก/โน้ต/บท ที่ปล่อยลงเอกสาร = เปิด — ต้องแย่งก่อน ProseMirror (ระยะ capture)
  // ไม่งั้น ProseMirror แทรกชื่อฉาก (text/plain) ลงไปในเนื้อเรื่อง
  document.addEventListener('drop', (e) => {
    // [alpha.167 · รอบต่อ · บั๊ก] ซ่อนป้ายระยะ capture — ตัวรับของแผง `stopPropagation()` แล้วตัวซ่อนระยะ bubble ไม่เคยทำงาน
    // (ป้ายค้างบนจอจนกว่าจะมี dragend · การลากจากนอกโปรแกรมไม่มี dragend ให้เลย)
    hideTip();
    const pm = e.target && e.target.closest && e.target.closest('.ProseMirror');
    if (!pm) return;
    const ks = dragKinds(e.dataTransfer);
    if (!ks.some((k) => k === 'scene' || k === 'memo' || k === 'chapter' || k === 'tab' || k === 'book')) return;
    const payload = readDrop(e.dataTransfer, ['scene', 'memo', 'chapter', 'tab', 'book']);
    if (!payload) return;
    e.preventDefault(); e.stopPropagation();
    hideTip();
    openDropped(payload);
  }, true);

  document.addEventListener('dragover', (e) => {
    const kinds = dragKinds(e.dataTransfer);
    lastKinds = kinds;
    if (!kinds.length || kinds.every((k) => k === 'files' || k === 'url')) { hideTip(); return; }
    const pid = panelIdAt(e.target);
    const intent = dropIntent(pid, kinds, e.target);
    if (!intent) { hideTip(); return; }
    showTip(e.clientX, e.clientY, t(intent.hint));
    // ตัวกลางลงมือเองเฉพาะโหมด open (ชั้น 4) — โหมดอื่นเป็นของแผง/ของเบราว์เซอร์
    if (intent.mode === 'open' && !e.defaultPrevented) {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch {}
    }
  });
  document.addEventListener('drop', async (e) => {
    hideTip();
    if (e.defaultPrevented) return;
    const pid = panelIdAt(e.target);
    const intent = dropIntent(pid, dragKinds(e.dataTransfer), e.target);
    if (!intent || intent.mode !== 'open') return;
    const payload = readDrop(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    const ok = await openDropped(payload);
    if (ok) setStatus(tf('ui.drop.opened', payload.items[0].title || ''));
  });
  document.addEventListener('dragend', hideTip);
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) hideTip(); });
  return true;
}

/** สำหรับเทส: ป้ายที่กำลังโชว์ */
export function dropTipText() { return _tip && _tip.style.display !== 'none' ? _tip.textContent : ''; }
