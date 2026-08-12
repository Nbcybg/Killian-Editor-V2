// timeline-ui.js — เส้นเวลา (UI): เปิด/วาดเส้นเวลา (การ์ด·Gantt)
import { T } from './i18n.js';
import { eventDialog, loadTimeline, openRef, openScene, saveTimeline, sceneEventsFromProject } from './app.js';
import { $, el, state } from './core.js';
import { findClashes, ganttBar, ganttData, ganttTicks, groupByTrack, mergeTimeline, newEvent, sortEvents, trackNames } from './timeline.js';
import { renderFutureNotes, notesForScene } from './session-notes.js';
import { findScenePath } from './project-scan.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';

/** วาดเส้นเวลาใหม่ถ้าแผงเปิดอยู่ (เรียกหลังเพิ่มโน้ต "ไว้ทำภายหลัง") */
export function refreshOpenTimeline() {
  if (isPanelOpen('timeline') && $('#tl-body')) renderTimeline($('#tl-body'));
}

// บั๊ก #18: เส้นเวลาเป็นแผง ไม่ใช่แท็บเอกสาร
export async function openTimeline() {
  showPanel('timeline');
  return renderTimeline($('#tl-body'));
}

export async function renderTimeline(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'tl-wrap'); pane.append(wrap);
  const head = el('div', 'tl-head');
  head.append(el('div', 'tl-title', T`🕒 เส้นเวลา`));
  const addBtn = el('button', 'k-ok', T`＋ เพิ่มเหตุการณ์`);
  head.append(addBtn);
  // ปุ่มสลับมุมมอง การ์ด ↔ Gantt (จำค่าไว้ใน state)
  if (!state._tlView) state._tlView = 'cards';
  const viewTog = el('div', 'tl-viewtog');
  const bCards = el('button', 'tl-viewbtn' + (state._tlView === 'cards' ? ' on' : ''), T`▦ การ์ด`);
  const bGantt = el('button', 'tl-viewbtn' + (state._tlView === 'gantt' ? ' on' : ''), '▬ Gantt');
  bCards.onclick = () => { state._tlView = 'cards'; renderTimeline(pane); };
  bGantt.onclick = () => { state._tlView = 'gantt'; renderTimeline(pane); };
  viewTog.append(bCards, bGantt); head.append(viewTog);
  const hint = el('span', 'tl-hint', T`ฉากที่ตั้ง "เวลาในเรื่อง" จะขึ้นบนเส้นเวลาอัตโนมัติ`);
  head.append(hint);
  wrap.append(head);

  // ---- Future Notes (ข้อ 85): โน้ต "ไว้ทำภายหลัง" ค้างอยู่บนหน้าเส้นเวลา ----
  const fn = el('div', 'tl-future');
  renderFutureNotes(fn, {
    onChanged: () => renderTimeline(pane),
    onOpenScene: async (sceneId, title) => {
      const hit = await findScenePath(state.root, sceneId);
      if (hit && (await kapi.exists(hit.path))) openScene(hit.path, hit.title || title);
    },
  });
  wrap.append(fn);

  const data = await loadTimeline();
  const sceneEvs = await sceneEventsFromProject();
  const items = mergeTimeline(data.events, sceneEvs);
  const tracks = groupByTrack(items);
  const knownTracks = trackNames(data.events, sceneEvs);
  const clashes = findClashes(items);
  const clashIds = new Set(clashes.flat().map((x) => x.id));

  addBtn.onclick = async () => {
    const ev = newEvent();
    const res = await eventDialog(ev, knownTracks);
    if (!res) return;
    data.events.push(res); await saveTimeline(data); renderTimeline(pane);
  };

  if (!items.length) {
    wrap.append(el('div', 'tl-empty',
      T`ยังไม่มีเหตุการณ์ — กด "＋ เพิ่มเหตุการณ์" หรือไปตั้ง "เวลาในเรื่อง" ให้ฉากในคุณสมบัติฉาก`));
    return;
  }

  // ตัวจัดการคลิกเหตุการณ์ (ใช้ทั้งการ์ดและ Gantt)
  const onEventClick = async (it) => {
    if (it.kind === 'scene' && it.file) { openScene(it.file, it.title); return; }
    if (it.kind !== 'event') return;
    const idx = data.events.findIndex((e) => e.id === it.id);
    const res = await eventDialog({ ...data.events[idx] }, knownTracks, true);
    if (res === 'DELETE') { data.events.splice(idx, 1); await saveTimeline(data); renderTimeline(pane); return; }
    if (res) { data.events[idx] = res; await saveTimeline(data); renderTimeline(pane); }
  };

  // ============ มุมมอง Gantt (แท่งตามช่วงเวลา) ============
  if (state._tlView === 'gantt') {
    const g = ganttData(items);
    if (!g.rows.length) {
      wrap.append(el('div', 'tl-empty',
        T`มุมมอง Gantt ต้องมีเหตุการณ์ที่ระบุเวลาเป็นตัวเลข (เช่น "ปีที่ 1024") — ยังไม่มีเลย`));
      return;
    }
    const gb = el('div', 'gantt-board'); wrap.append(gb);
    // แถวหัว: ขีดแกนเวลา
    const ticks = ganttTicks(g.min, g.max, 6);
    const axis = el('div', 'gantt-axis');
    axis.append(el('div', 'gantt-axis-label', ''));
    const axisTrack = el('div', 'gantt-axis-track');
    for (const tk of ticks) {
      const t = el('div', 'gantt-tick', String(tk.value));
      t.style.left = tk.pct + '%'; axisTrack.append(t);
    }
    axis.append(axisTrack); gb.append(axis);
    // แต่ละ track เป็นแถว — แท่งเรียงตามเวลา
    for (const tr of tracks) {
      const rowItems = g.rows.filter((r) => (r.track || T`ทั่วไป`) === tr.name);
      if (!rowItems.length) continue;
      const grow = el('div', 'gantt-row');
      const lbl = el('div', 'gantt-row-label');
      const dot = el('span', 'tl-lane-dot'); dot.style.background = tr.color;
      lbl.append(dot, el('span', null, tr.name)); grow.append(lbl);
      const track = el('div', 'gantt-track');
      for (const r of rowItems) {
        const { left, width } = ganttBar(r, g.min, g.span);
        const bar = el('div', 'gantt-bar' + (r.kind === 'scene' ? ' gantt-bar-scene' : '')
                        + (clashIds.has(r.id) ? ' tl-clash' : ''));
        bar.style.left = left + '%'; bar.style.width = width + '%';
        bar.style.background = r.color || tr.color;
        bar.append(el('span', 'gantt-bar-label',
          (r.kind === 'scene' ? '📄 ' : '') + r.title + ((r.refs || []).length ? ' 🔗' : '')));
        bar.title = [`${r.title} · ${r.when}${r.whenEnd ? ' → ' + r.whenEnd : ''}`,
          ...(r.refs || []).map((x) => '🔗 ' + x.title)].join('\n');
        bar.onclick = () => onEventClick(r);
        track.append(bar);
      }
      grow.append(track); gb.append(grow);
    }
    if (g.undated.length)
      wrap.append(el('div', 'tl-hint', T`+ อีก ${g.undated.length} เหตุการณ์ไม่มีเวลาเป็นตัวเลข (ดูในมุมมองการ์ด)`));
    if (clashes.length)
      wrap.append(el('div', 'tl-clash-note', T`⚠ มี ${clashes.length} จุดที่เวลาตรงกัน (ไฮไลต์สีส้ม)`));
    return;
  }

  // เส้นเวลาแนวตั้ง: จัดกลุ่มตาม track เป็นเลนสี · ในแต่ละ track เรียงตามเวลา
  const board = el('div', 'tl-board'); wrap.append(board);
  for (const tr of tracks) {
    const lane = el('div', 'tl-lane');
    const laneHead = el('div', 'tl-lane-head');
    const dot = el('span', 'tl-lane-dot'); dot.style.background = tr.color;
    laneHead.append(dot, el('span', 'tl-lane-name', tr.name),
                    el('span', 'tl-lane-count', String(tr.items.length)));
    lane.append(laneHead);
    const line = el('div', 'tl-line');
    for (const it of sortEvents(tr.items)) {
      const card = el('div', 'tl-event' + (it.kind === 'scene' ? ' tl-event-scene' : '')
                       + (clashIds.has(it.id) ? ' tl-clash' : ''));
      card.style.borderLeftColor = it.color || tr.color;
      const when = el('div', 'tl-when',
        (it.when || T`(ไม่ระบุเวลา)`) + (it.whenEnd ? ' → ' + it.whenEnd : ''));
      const title = el('div', 'tl-ev-title', (it.kind === 'scene' ? '📄 ' : '') + it.title);
      card.append(when, title);
      if (it.desc) card.append(el('div', 'tl-ev-desc', it.desc));
      // ---- เอกสาร/โน้ตที่เหตุการณ์นี้อ้างอิง (ข้อ 5) — คลิกชิปเพื่อเปิดไฟล์นั้น ----
      if ((it.refs || []).length) {
        const rw = el('div', 'tl-ev-refs');
        for (const r of it.refs) {
          const chip = el('span', 'tl-ev-ref', (r.kind === 'memo' ? '📝 ' : '📄 ') + r.title);
          chip.title = T`เปิด: ` + r.path;
          chip.onclick = (e) => { e.stopPropagation(); openRef(r); };   // กันไปโดนคลิกของการ์ด
          rw.append(chip);
        }
        card.append(rw);
      }
      // โน้ตที่ผูกกับฉากนี้ (ข้อ 85) — id ฉากบนเส้นเวลาเป็น 'sc:<dPath>:<id>'
      if (it.kind === 'scene') {
        const notes = notesForScene(String(it.id || '').split(':').pop());
        if (notes.length) {
          const b = el('div', 'tl-ev-notes', '📝 ' + notes.length + T` โน้ต`);
          b.title = notes.map((n) => '• ' + n.text).join('\n');
          card.append(b);
        }
      }
      card.classList.add('tl-clickable');
      card.onclick = () => onEventClick(it);
      if (it.kind === 'scene') card.title = T`คลิกเปิดฉากนี้`;
      line.append(card);
    }
    lane.append(line);
    board.append(lane);
  }

  if (clashes.length)
    wrap.append(el('div', 'tl-clash-note',
      T`⚠ มี ${clashes.length} จุดที่เหตุการณ์เวลาตรงกัน (ไฮไลต์สีส้ม) — ตรวจว่าตั้งใจหรือไม่`));
}
