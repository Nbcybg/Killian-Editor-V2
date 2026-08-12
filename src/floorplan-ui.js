// floorplan-ui.js — ผังพื้นที่ (ข้อ 82): แผนที่ + เส้นเวลา + ตำแหน่งปัจจุบัน
// ผูก "ฉาก ↔ หมุดบนแผนที่" (sc.mapId / sc.pinId ใน scenes.json) → รู้ว่าฉากนี้เกิดที่ไหน
// แล้วโชว์ 3 อย่างพร้อมกัน:
//   1) แผนที่ + หมุดตำแหน่งปัจจุบัน (เต้นให้เห็นชัด) + breadcrumb ลำดับชั้น world→city→room
//   2) เส้นเวลาของฉากที่เกิดในสถานที่นี้ (เรียงตาม storyDate ผ่าน timeline.js)
//   3) สิ่งที่เห็น/ได้ยิน/พบ ของฉากที่เปิดอยู่ (เพิ่ม/ลบได้)
import { T } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import { sortMaps, findMap, breadcrumb, clamp, PIN_KIND } from './maps.js';
import { extractNum } from './timeline.js';

const FIELDS = [
  ['clues', T`👁 สิ่งที่เห็น`, T`เช่น รอยเลือดบนพื้น`],
  ['sounds', T`🔊 สิ่งที่ได้ยิน`, T`เช่น เสียงฝีเท้าชั้นบน`],
  ['discoveries', T`📦 สิ่งที่พบ`, T`เช่น กุญแจสนิม`],
];

// สถานะของหน้านี้ (จำระหว่าง re-render)
function fstate() {
  if (!state._floor) state._floor = { mapId: null, picking: false };
  return state._floor;
}

// [alpha.62 บั๊ก 16] เดิมเป็นแท็บเอกสาร `::floorplan::` — แต่ผังพื้นที่คือ "ของประกอบฉากที่กำลังเขียน"
// ยิ่งต้องเปิดคู่กับต้นฉบับได้ · ตอนนี้เป็นแผงเต็มตัว
export async function renderFloorPlanPanel() {
  const host = $('#floor-body');
  if (!host) return false;
  await renderFloorPlan(host, fstate().mapId);
  return true;
}
export async function openFloorPlan() {
  // showPanel อยู่ที่ panels/panel-ui.js — app.js เป็นแค่ผู้ใช้ ไม่ได้ re-export ออกมา
  // (`refreshToolbar` ก็ไม่ได้ export — hook `onPanelLayoutChange` เรียกให้อยู่แล้วตอนแผงเปลี่ยน)
  const { showPanel } = await import('./panels/panel-ui.js');
  const { renderFeaturePanel } = await import('./app.js');
  showPanel('floorplan');
  await renderFeaturePanel('floorplan');
}

/** วาดใหม่ถ้าแผงผังพื้นที่เปิดอยู่ (เรียกหลังเปลี่ยนฉากที่กำลังแก้) */
export function refreshOpenFloorPlan() {
  const host = $('#floor-body');
  if (host && host.firstChild) renderFloorPlan(host, fstate().mapId);
}

// รวบรวมฉากทุกร่างพร้อมข้อมูลที่ผังพื้นที่ต้องใช้ (สถานที่ + เวลาในเรื่อง)
// [alpha.70] export ออกไปให้แผงแผนที่ (maps-ui.js) ใช้ร่วม — ป้ายจำนวนฉากบนหมุดต้องอ่านชุดเดียวกัน
export async function collectPlacedScenes() {
  const out = [];
  if (!state.root) return out;
  for (const sec of await kapi.listDirs(state.root).catch(() => [])) {
    if (['Wiki','Bible','Images','Memos','Recycle','Snapshots', '.k2history','Backups','Plugins','Research'].includes(sec)) continue;
    const sp = await kapi.join(state.root, sec);
    if (!(await kapi.exists(await kapi.join(sp, 'section.json')))) continue;
    const dr = await kapi.join(sp, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    for (const dn of await kapi.listDirs(dr).catch(() => [])) {
      const dp = await kapi.join(dr, dn);
      const dj = await kapi.join(dp, 'draft.json');
      if (!(await kapi.exists(dj))) continue;
      const draft = await kapi.readJson(dj);
      const scData = await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}));
      const chMap = scData.chapters || {};
      for (const ch of (draft.chapters || [])) {
        for (const sc of (chMap[ch.guid] || [])) {
          if (sc.type === 'memo') continue;
          out.push({ ...sc, dPath: dp, chapterName: ch.title,
                     filePath: await kapi.join(dp, 'Chapters', ch.folderName, sc.fileName) });
        }
      }
    }
  }
  return out;
}

// เรียงตามเวลาในเรื่อง: ตัวเลขที่ถอดได้ก่อน แล้วค่อยเรียงตามข้อความ (ฉากไม่มีเวลา = ไปท้ายสุด)
function byStoryDate(a, b) {
  const na = extractNum(a.storyDate), nb = extractNum(b.storyDate);
  if (na != null && nb != null && na !== nb) return na - nb;
  if (na != null && nb == null) return -1;
  if (na == null && nb != null) return 1;
  return String(a.storyDate || '').localeCompare(String(b.storyDate || ''), 'th');
}

export async function renderFloorPlan(pane, mapId) {
  const fs = fstate();
  pane.innerHTML = '';
  const { mapImgURL, loadMaps, sceneCtx, updateSceneRow, openScene } = await import('./app.js');
  const wrap = el('div', 'floor-wrap');

  let data = { maps: [] };
  try { data = (await loadMaps()) || { maps: [] }; }
  catch (e) { log('warn', T`floorplan: โหลด maps.json ไม่ได้`, e); }
  const maps = sortMaps(data.maps || []);

  // ฉากที่กำลังเขียน: ปกติคือแท็บที่ active — แต่พอผู้ใช้สลับมาดูผังพื้นที่ แท็บที่ active
  // กลายเป็นผังเอง จึงถอยไปใช้ฉากที่เปิดล่าสุดแทน (ไม่งั้นตำแหน่งปัจจุบันหายทุกครั้งที่เปิดหน้านี้)
  const ctx = (await sceneCtx()) || (await sceneCtx(state.lastSceneFile));
  let scenes = [];
  try { scenes = await collectPlacedScenes(); } catch (e) { log('warn', T`floorplan: อ่านฉากไม่ได้`, e); }

  // แผนที่ที่แสดง: ที่ผู้ใช้เลือก → แผนที่ของฉากที่เปิดอยู่ → แผนที่แรก
  const wanted = mapId || fs.mapId || (ctx && ctx.row.mapId) || null;
  const cur = (wanted && findMap(maps, wanted)) || maps[0] || null;
  fs.mapId = cur ? cur.id : null;
  const redraw = () => renderFloorPlan(pane, fs.mapId);

  // ───────── หัว: ชื่อ + ตัวเลือกแผนที่ + breadcrumb ─────────
  const head = el('div', 'floor-head');
  const titleRow = el('div', 'floor-title-row');
  titleRow.append(el('div', 'floor-title', T`📍 ผังพื้นที่`));
  const sel = el('select', 'k-dlg-select');
  for (const m of maps) { const o = el('option', null, m.name || T`(ไม่มีชื่อ)`); o.value = m.id; sel.append(o); }
  if (cur) sel.value = cur.id;
  sel.onchange = () => { fs.mapId = sel.value; fs.picking = false; redraw(); };
  if (maps.length) titleRow.append(sel);

  // ปุ่มปักตำแหน่งให้ฉากที่เปิดอยู่
  if (ctx && cur) {
    const pinB = el('button', 'floor-pinbtn' + (fs.picking ? ' on' : ''),
                    fs.picking ? T`✖ ยกเลิกการปัก` : T`📌 ปักตำแหน่งฉากนี้`);
    pinB.title = T`คลิกปุ่มนี้แล้วคลิกบนแผนที่ เพื่อบอกว่าฉาก "` + (ctx.row.title || '') + T`" เกิดตรงไหน`;
    pinB.onclick = () => { fs.picking = !fs.picking; redraw(); };
    titleRow.append(pinB);
    if (ctx.row.mapId) {
      const clearB = el('button', 'floor-pinbtn', T`🚫 ล้างตำแหน่ง`);
      clearB.title = T`เอาฉากนี้ออกจากแผนที่`;
      clearB.onclick = async () => {
        await updateSceneRow(ctx.dPath, ctx.row.id, (r) => { delete r.mapId; delete r.pinId; });
        setStatus(T`ล้างตำแหน่งของฉากแล้ว`);
        redraw();
      };
      titleRow.append(clearB);
    }
  }
  head.append(titleRow);

  if (cur) {
    const crumbs = breadcrumb(maps, cur.id);
    if (crumbs.length > 1) {
      const bc = el('div', 'floor-crumb');
      crumbs.forEach((c, i) => {
        if (i) bc.append(el('span', 'floor-crumb-sep', '›'));
        const item = el('span', 'floor-crumb-item', c.name || T`(ไม่มีชื่อ)`);
        if (c.id !== cur.id) item.onclick = () => { fs.mapId = c.id; redraw(); };
        else item.classList.add('on');
        bc.append(item);
      });
      head.append(bc);
    }
  }
  wrap.append(head);

  // ───────── พื้นแผนที่ ─────────
  const main = el('div', 'floor-main' + (fs.picking ? ' floor-picking' : ''));
  if (cur && cur.image) {
    const holder = el('div', 'floor-canvas');
    const img = el('img', 'floor-img');
    img.src = mapImgURL(cur.image);          // ผ่าน kapi.toFileURL — 'file://'+path พังบน Windows
    holder.append(img);

    // หมุดปกติของแผนที่
    for (const p of (cur.pins || [])) {
      const dot = el('span', 'floor-pin', PIN_KIND[p.kind]?.icon || '📌');
      dot.style.left = p.x + '%'; dot.style.top = p.y + '%';
      if (p.color) dot.style.color = p.color;
      // ฉากที่ผูกกับหมุดนี้ — hover เห็นได้เลยว่าเกิดอะไรตรงนี้บ้าง
      const here = scenes.filter((s) => s.mapId === cur.id && s.pinId === p.id);
      dot.title = (p.label || T`(ไม่มีชื่อ)`)
        + (here.length ? '\n' + here.map((s) => '📄 ' + s.title).join('\n') : '');
      dot.onclick = (e) => {
        e.stopPropagation();
        if (fs.picking && ctx) return bindSceneTo(p.id, p.x, p.y);
        setStatus(T`หมุด: ` + (p.label || '—') + (here.length ? T` · ${here.length} ฉาก` : ''));
      };
      if (here.length) dot.append(el('span', 'floor-pin-count', String(here.length)));
      holder.append(dot);
    }

    // ตำแหน่งปัจจุบัน = ฉากที่เปิดอยู่ ถ้าผูกกับแผนที่นี้
    if (ctx && ctx.row.mapId === cur.id) {
      const pin = (cur.pins || []).find((p) => p.id === ctx.row.pinId);
      const px = pin ? pin.x : ctx.row.pinX, py = pin ? pin.y : ctx.row.pinY;
      if (px != null && py != null) {
        const you = el('div', 'floor-you');
        you.style.left = px + '%'; you.style.top = py + '%';
        you.title = T`คุณอยู่ที่นี่: ` + (ctx.row.title || '');
        you.append(el('span', 'floor-you-dot', '◉'));
        you.append(el('span', 'floor-you-label', ctx.row.title || T`ฉากปัจจุบัน`));
        holder.append(you);
      }
    }

    // โหมดปัก: คลิกที่ว่างบนแผนที่ = เก็บพิกัดตรงนั้นให้ฉาก (ไม่ต้องมีหมุดก่อน)
    if (fs.picking && ctx) {
      holder.classList.add('floor-canvas-pick');
      holder.onclick = (e) => {
        const r = holder.getBoundingClientRect();
        if (!r.width || !r.height) return;
        bindSceneTo(null, clamp(((e.clientX - r.left) / r.width) * 100),
                          clamp(((e.clientY - r.top) / r.height) * 100));
      };
    }
    main.append(holder);

    async function bindSceneTo(pinId, x, y) {
      await updateSceneRow(ctx.dPath, ctx.row.id, (r) => {
        r.mapId = cur.id;
        if (pinId) { r.pinId = pinId; delete r.pinX; delete r.pinY; }
        else { delete r.pinId; r.pinX = +x.toFixed(1); r.pinY = +y.toFixed(1); }
      });
      fs.picking = false;
      setStatus(T`ปักตำแหน่งฉาก "` + (ctx.row.title || '') + T`" บนแผนที่ ` + (cur.name || '') + T` แล้ว`);
      redraw();
    }
  } else {
    main.append(el('div', 'floor-ph', '🗺'));
    main.append(el('div', 'dim', maps.length ? T`แผนที่นี้ยังไม่มีรูป — ใส่รูปได้ที่หน้า แผนที่ (Maps)`
                                             : T`ยังไม่มีแผนที่ — สร้างได้ที่ มุมมอง → แผนที่ (Maps)`));
  }
  if (fs.picking) main.append(el('div', 'floor-pickhint', T`📌 คลิกบนแผนที่ (หรือบนหมุด) เพื่อกำหนดตำแหน่งของฉากนี้`));

  // ───────── แผงข้อมูลของฉากที่เปิดอยู่ ─────────
  const panel = el('div', 'floor-panel');

  panel.append(el('div', 'floor-panel-title', T`📄 ฉากที่เปิดอยู่`));
  panel.append(el('div', 'floor-cur', ctx ? (ctx.row.title || '—') : T`ยังไม่ได้เปิดฉาก`));
  if (ctx) {
    const where = ctx.row.mapId ? findMap(maps, ctx.row.mapId) : null;
    const pin = where && (where.pins || []).find((p) => p.id === ctx.row.pinId);
    panel.append(el('div', 'dim floor-where', where
      ? '📍 ' + (where.name || '') + (pin ? ' · ' + (pin.label || T`หมุด`) : '')
      : T`ยังไม่ได้ปักตำแหน่ง — กด "📌 ปักตำแหน่งฉากนี้"`));
    if (ctx.row.storyDate) panel.append(el('div', 'dim', '🕒 ' + ctx.row.storyDate));
  }

  if (cur) {
    const here = scenes.filter((s) => s.mapId === cur.id);
    panel.append(el('div', 'floor-panel-title', T`🗺 แผนที่`));
    panel.append(el('div', 'dim',
      T`${cur.name || '—'} · ${(cur.pins || []).length} หมุด · ${here.length} ฉาก`));
  }

  for (const [key2, label, ph] of FIELDS) {
    panel.append(el('div', 'floor-panel-title', label));
    const vals = (ctx && Array.isArray(ctx.row[key2])) ? ctx.row[key2] : [];
    if (!vals.length) panel.append(el('div', 'dim', '—'));
    vals.forEach((v, i) => {
      const row = el('div', 'floor-item');
      row.append(el('span', 'floor-item-text', v));
      if (ctx) {
        const del = el('span', 'floor-item-del', '✕');
        del.title = T`ลบรายการนี้`;
        del.onclick = async () => {
          await updateSceneRow(ctx.dPath, ctx.row.id, (r) => {
            r[key2] = (r[key2] || []).filter((_, k) => k !== i);
            if (!r[key2].length) delete r[key2];
          });
          redraw();
        };
        row.append(del);
      }
      panel.append(row);
    });
    if (ctx) {
      const add = el('button', 'floor-add', T`+ เพิ่ม`);
      add.onclick = async () => {
        const { ask } = await import('./ui.js');
        const v = await ask(label.replace(/^\S+\s/, '') + T` — เพิ่มรายการ`, { placeholder: ph });
        if (!v) return;
        await updateSceneRow(ctx.dPath, ctx.row.id, (r) => { r[key2] = [...(r[key2] || []), v]; });
        redraw();
      };
      panel.append(add);
    }
  }

  // ───────── เส้นเวลา: ฉากที่เกิดในสถานที่นี้ เรียงตามเวลาในเรื่อง ─────────
  const tl = el('div', 'floor-timeline');
  tl.append(el('div', 'floor-panel-title', T`🕒 เส้นเวลาของสถานที่นี้`));
  const here = cur ? scenes.filter((s) => s.mapId === cur.id).sort(byStoryDate) : [];
  if (!here.length) {
    tl.append(el('div', 'dim', cur
      ? T`ยังไม่มีฉากผูกกับแผนที่นี้ — เปิดฉากแล้วกด "📌 ปักตำแหน่งฉากนี้"`
      : T`ยังไม่มีแผนที่`));
  } else {
    const strip = el('div', 'floor-tl-strip');
    for (const s of here) {
      const item = el('div', 'floor-tl-item' + (ctx && ctx.row.id === s.id ? ' on' : ''));
      if (s.color) item.style.borderLeftColor = s.color;
      item.append(el('div', 'floor-tl-when', s.storyDate || T`(ไม่ระบุเวลา)`));
      item.append(el('div', 'floor-tl-title', s.title || T`(ไม่มีชื่อ)`));
      const pin = (cur.pins || []).find((p) => p.id === s.pinId);
      if (pin) item.append(el('div', 'floor-tl-pin', '📍 ' + (pin.label || T`หมุด`)));
      const seen = [(s.clues || []).length && `👁${s.clues.length}`,
                    (s.sounds || []).length && `🔊${s.sounds.length}`,
                    (s.discoveries || []).length && `📦${s.discoveries.length}`].filter(Boolean);
      if (seen.length) item.append(el('div', 'floor-tl-badges', seen.join(' ')));
      item.title = [s.title, s.chapterName, s.synopsis].filter(Boolean).join('\n') + T`\nคลิกเพื่อเปิดฉาก`;
      item.onclick = () => openScene(s.filePath, s.title);
      strip.append(item);
    }
    tl.append(strip);
  }

  wrap.append(main, panel, tl);
  pane.append(wrap);
}
