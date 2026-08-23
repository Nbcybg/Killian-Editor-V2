// vis-ui.js — หน้าตารางของ "เล่าด้วยภาพ" (Visual telling)
//
// หนึ่งแท็บ = หนึ่งฉาก · แหล่งข้อมูลสี่ทาง:
//   scenes.json → ชื่อฉาก        (อ่านอย่างเดียว)
//   ฉาก .md     → action + คอมเมนต์ (อ่านอย่างเดียว — ตารางนี้ไม่เคยเขียนทับเนื้อฉาก)
//   Wiki        → ตัวละคร/สถานที่ที่โผล่ในบรรทัดที่ผูก (คำนวณสด)
//   *_vis.csv   → ลำดับ · frame · หมายเหตุ (ของตารางเอง)
//
// เลย์เอาต์ตามสตอรีบอร์ดจริง: [▲▼] [ลำดับ] [frame] [action] [ตัวละคร] [หมายเหตุ] [คอมเมนต์] [✕]
// ราง ▲▼ กับปุ่มลบเป็นคอลัมน์ของตารางเอง — ผู้ใช้ซ่อน/ย้ายไม่ได้ (ไม่งั้นย้ายแถวไม่ได้เลย)
//
// **บันทึกทันทีทุกครั้งที่แก้** ไฟล์เล็กมาก → ไม่มีสถานะ "งานค้าง" ให้หลุดตอนปิดโปรแกรม (กฎข้อ 1)
import { $, el, state, setStatus, log, smart, t, tf } from '../core.js';
import { popupMenu, confirmBox } from '../ui.js';
import { pickImage } from '../gallery.js';
import { imageLightbox } from '../wiki.js';
import { parseComments } from '../comments/comment-core.js';
import { parseMdFile } from '../md.js';
import * as VC from './vis-core.js';

export const VIS_TAB = '::vis::';

// ───────── พาธ ─────────
function dirOf(p) { const i = Math.max(String(p).lastIndexOf('/'), String(p).lastIndexOf('\\')); return i < 0 ? '' : String(p).slice(0, i); }
function baseOf(p) { const i = Math.max(String(p).lastIndexOf('/'), String(p).lastIndexOf('\\')); return String(p).slice(i + 1); }
/** ตาราง Visual ของฉากนี้อยู่ไฟล์ไหน */
export async function visPathOf(scenePath) {
  return kapi.join(dirOf(scenePath), VC.visFileName(baseOf(scenePath)));
}
export async function hasVis(scenePath) {
  try { return await kapi.exists(await visPathOf(scenePath)); } catch { return false; }
}

// ───────── อ่าน/เขียน ─────────
async function loadAll(scenePath) {
  const raw = await kapi.readFile(scenePath);
  const { meta, body } = parseMdFile(raw);
  const format = meta.format === 'screenplay' ? 'screenplay' : 'prose';
  const vp = await visPathOf(scenePath);
  let rows = [];
  try { if (await kapi.exists(vp)) rows = VC.parseVis(await kapi.readFile(vp)); }
  catch (e) { log('warn', 'vis: cannot read table', String(e)); }
  return { visPath: vp, rows, lines: VC.splitLines(body, format), comments: parseComments(raw),
           sceneTitle: meta.title || baseOf(scenePath).replace(/\.md$/i, ''), format };
}
async function saveRows(st, quiet) {
  await kapi.writeFile(st.visPath, VC.dumpVis(st.rows));
  if (!quiet) setStatus(t('ui.vis.saved'));
}

// ───────── คอลัมน์ (เก็บใน project.khn.json → พกไปกับโปรเจกต์ ไม่ใช่ localStorage) ─────────
function readCols() { return VC.normalizeCols(state.meta && state.meta.visColumns); }
async function writeCols(cols) {
  if (!state.meta) return;
  state.meta.visColumns = cols.map((c) => ({ key: c.key, on: c.on, w: c.w }));
  const { saveProjectMeta } = await import('../app.js');
  await saveProjectMeta();
}
const COL_LABEL = () => ({
  no: t('ui.vis.colNo'), scene: t('ui.vis.colScene'), image: t('ui.vis.colFrame'),
  text: t('ui.vis.colAction'), entities: t('ui.vis.colEntities'),
  remark: t('ui.vis.colRemark'), comment: t('ui.vis.colComment'),
});

// ───────── รูป ─────────
const _imgUrl = new Map();
async function imgUrl(rel) {
  if (!rel) return '';
  if (_imgUrl.has(rel)) return _imgUrl.get(rel);
  const u = await kapi.toFileURL(await kapi.join(state.root, 'Images', rel));
  _imgUrl.set(rel, u);
  return u;
}

// ───────── เปิดแท็บ ─────────
export async function openVisual(scenePath, sceneTitle) {
  if (!scenePath) { setStatus(t('ui.vis.needScene')); return; }
  const key = VIS_TAB + scenePath;
  const { activate } = await import('../app.js');
  if (state.tabs.has(key)) { activate(key); return renderVisual(key); }

  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', '🎬 ' + (sceneTitle || t('ui.vis.title'))));
  const x = el('span', 'tab-x', '×');
  tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file: key, title: '🎬 ' + (sceneTitle || t('ui.vis.title')), pane, tabBtn,
                dirty: false, editor: null, plain: null, wiki: null, gal: null, dash: true,
                visScene: scenePath };
  tabBtn.onclick = (e) => { if (e.target !== x) import('../app.js').then((m) => m.activate(key)); };
  x.onclick = async () => { const { closeTab } = await import('../app.js'); closeTab(key); };
  state.tabs.set(key, tab);
  activate(key);
  await renderVisual(key);
}

/** วาดใหม่ทั้งแท็บ — เรียกได้เสมอ (อ่านไฟล์สดทุกครั้ง ข้อความจึงตรงกับฉากที่เพิ่งแก้) */
export async function renderVisual(key) {
  const tab = state.tabs.get(key);
  if (!tab) return;
  const st = await loadAll(tab.visScene);
  st.scenePath = tab.visScene;
  st.key = key;
  tab.visState = st;
  const pane = tab.pane;
  pane.innerHTML = '';
  const wrap = el('div', 'vis-wrap');
  wrap.append(buildBar(st));
  const body = el('div', 'vis-body');
  wrap.append(body);
  pane.append(wrap);
  await drawBody(st, body);
}

async function redraw(st) {
  const tab = state.tabs.get(st.key);
  const body = tab && tab.pane.querySelector('.vis-body');
  if (body) await drawBody(st, body);
}

// ───────── แถบเครื่องมือ ─────────
function buildBar(st) {
  const bar = el('div', 'vis-bar');
  const add = el('button', 'vis-btn vis-add', t('ui.vis.addRow'));
  add.onclick = () => pickLinesDialog(st);
  bar.append(add);

  const free = el('button', 'vis-btn vis-addfree', t('ui.vis.addFree'));
  free.onclick = async () => {
    VC.insertRow(st.rows, -1, VC.makeRow({}));
    await saveRows(st);
    await redraw(st);
  };
  bar.append(free);

  bar.append(el('span', 'vis-sp'));

  const views = el('div', 'vis-views');
  for (const [v, label] of [['table', t('ui.vis.viewTable')], ['list', t('ui.vis.viewList')]]) {
    const b = el('button', 'vis-btn vis-view' + (visView() === v ? ' on' : ''), label);
    b.dataset.view = v;
    b.onclick = async () => { state._visView = v; await renderVisual(st.key); };
    views.append(b);
  }
  const full = el('button', 'vis-btn vis-full', t('ui.vis.viewFull'));
  full.onclick = async () => (await import('./vis-player.js')).openVisPlayer(st);
  views.append(full);
  bar.append(views);

  bar.append(el('span', 'vis-sp'));

  const colBtn = el('button', 'vis-btn vis-cols', t('ui.vis.cols'));
  colBtn.onclick = (e) => colMenu(e, st);
  bar.append(colBtn);

  bar.append(el('span', 'vis-count', tf('ui.vis.rowNum', st.rows.length)));

  // แถวที่ต้นทางเปลี่ยนไปแล้ว — บอกจำนวน + ปุ่มอัปเดตรวดเดียว
  const changed = VC.resolveAll(st.rows, st.lines).filter((r) => r.status === 'changed').length;
  if (changed) {
    bar.append(el('span', 'vis-warn', tf('ui.vis.changedCount', changed)));
    const syncAll = el('button', 'vis-btn vis-syncall', t('ui.vis.syncAll'));
    syncAll.onclick = async () => {
      const res = VC.resolveAll(st.rows, st.lines);
      st.rows.forEach((r, i) => { if (res[i].status === 'changed') VC.syncRow(r, res[i]); });
      await saveRows(st);
      await renderVisual(st.key);
    };
    bar.append(syncAll);
  }

  const reveal = el('button', 'vis-btn vis-reveal', t('ui.vis.reveal'));
  reveal.onclick = () => kapi.revealInOS(st.visPath);
  bar.append(reveal);
  return bar;
}
function visView() { return state._visView === 'list' ? 'list' : 'table'; }

function colMenu(e, st) {
  const cols = readCols();
  const L = COL_LABEL();
  const items = [];
  for (const c of cols)
    items.push({ label: (c.on ? '☑ ' : '☐ ') + L[c.key], click: async () => {
      VC.toggleCol(cols, c.key); await writeCols(cols); await renderVisual(st.key); } });
  items.push('-');
  cols.forEach((c, i) => {
    if (i === 0) return;
    items.push({ label: '▲ ' + L[c.key], click: async () => {
      VC.moveCol(cols, c.key, -1); await writeCols(cols); await renderVisual(st.key); } });
  });
  items.push('-');
  items.push({ label: t('ui.vis.colResetW'), click: async () => {
    for (const c of cols) c.w = VC.VIS_COL_W[c.key];
    await writeCols(cols); await renderVisual(st.key); } });
  popupMenu(e.clientX, e.clientY, items);
}

// ───────── เนื้อตาราง ─────────
async function drawBody(st, body) {
  body.innerHTML = '';
  // ชื่อคลาสโหมดต้องมี prefix ของตัวเอง — 'vis-table' เป็นชื่อของ **ตัวตาราง** อยู่แล้ว
  // ถ้าโหมดใช้ชื่อเดียวกัน querySelector('.vis-table') จะคว้าตัวห่อแทน (บทเรียนข้อ 32)
  body.className = 'vis-body vis-view-' + visView();
  if (!st.rows.length) {
    body.append(el('div', 'vis-empty', t('ui.vis.empty')));
    return;
  }
  const cols = readCols().filter((c) => c.on);
  const L = COL_LABEL();
  const res = VC.resolveAll(st.rows, st.lines);
  const names = (smart && smart.names) || [];

  if (visView() === 'table') {
    const table = el('div', 'vis-table');
    // ราง ▲▼ ซ้ายสุด + ปุ่มลบขวาสุด เป็นคอลัมน์ของตารางเสมอ (ข้อ 8)
    applyGrid(table, cols);
    table.append(el('div', 'vis-th vis-th-move', ''));
    for (const c of cols) table.append(headCell(st, c, L[c.key]));
    table.append(el('div', 'vis-th vis-th-del', ''));
    for (let i = 0; i < st.rows.length; i++) {
      table.append(moveCell(st, i));
      for (const c of cols) {
        const cell = el('div', 'vis-td vis-td-' + c.key);
        cell.dataset.row = String(i);
        cell.dataset.col = c.key;
        cell.append(await fieldFor(st, i, res[i], c.key, names));
        table.append(cell);
      }
      table.append(delCell(st, i));
    }
    body.append(table);
  } else {
    for (let i = 0; i < st.rows.length; i++) body.append(await cardFor(st, i, res[i], cols, names));
  }
}
/** กว้างรวมเกินจอ = ตัวห่อ .vis-body มีแถบเลื่อนแนวนอนให้เอง (ข้อ 4) */
function applyGrid(table, cols) {
  const ws = cols.map((c) => c.w);
  table.style.gridTemplateColumns = '40px ' + ws.map((w) => w + 'px').join(' ') + ' 42px';
  table.style.width = (ws.reduce((a, b) => a + b, 0) + VC.VIS_FIXED_W) + 'px';
}

/** หัวคอลัมน์ + มือจับลากปรับความกว้าง (ข้อ 3) */
function headCell(st, col, label) {
  const th = el('div', 'vis-th vis-th-' + col.key, label);
  const grip = el('div', 'vis-grip');
  grip.title = t('ui.vis.colDragW');
  grip.onmousedown = (e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = col.w;
    const table = th.closest('.vis-table');
    const cols = readCols().filter((c) => c.on);
    const move = (ev) => {
      col.w = VC.clampColW(w0 + (ev.clientX - x0), col.key);
      applyGrid(table, cols.map((c) => (c.key === col.key ? col : c)));
    };
    const up = async () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      const all = readCols();
      VC.setColWidth(all, col.key, col.w);
      await writeCols(all);
      await renderVisual(st.key);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  th.append(grip);
  return th;
}

/** ราง ▲▼ หน้าลำดับ — สองแถว บน/ล่าง (ข้อ 8) */
function moveCell(st, i) {
  const cell = el('div', 'vis-td vis-td-move');
  cell.dataset.row = String(i);
  const up = el('button', 'vis-mini vis-up', '▲'); up.title = t('ui.vis.up');
  up.disabled = i === 0;
  up.onclick = async () => { VC.moveRow(st.rows, i, -1); await saveRows(st, true); await redraw(st); };
  const dn = el('button', 'vis-mini vis-down', '▼'); dn.title = t('ui.vis.down');
  dn.disabled = i === st.rows.length - 1;
  dn.onclick = async () => { VC.moveRow(st.rows, i, 1); await saveRows(st, true); await redraw(st); };
  cell.append(up, dn);
  return cell;
}
/** ปุ่มลบ — ท้ายสุดหลังคอมเมนต์ (ข้อ 8) */
function delCell(st, i) {
  const cell = el('div', 'vis-td vis-td-del');
  cell.dataset.row = String(i);
  const del = el('button', 'vis-mini vis-mini-del', '✕'); del.title = t('ui.vis.delRow');
  del.onclick = async () => {
    if (!(await confirmBox(t('ui.vis.delRowAsk')))) return;
    VC.removeRow(st.rows, i);
    await saveRows(st);
    await renderVisual(st.key);
  };
  cell.append(del);
  return cell;
}

async function cardFor(st, i, res, cols, names) {
  const card = el('div', 'vis-card');
  card.dataset.row = String(i);
  const L = COL_LABEL();
  const head = el('div', 'vis-card-head');
  head.append(el('span', 'vis-card-no', String(st.rows[i].no)));
  const up = el('button', 'vis-mini vis-up', '▲'); up.disabled = i === 0;
  up.onclick = async () => { VC.moveRow(st.rows, i, -1); await saveRows(st, true); await redraw(st); };
  const dn = el('button', 'vis-mini vis-down', '▼'); dn.disabled = i === st.rows.length - 1;
  dn.onclick = async () => { VC.moveRow(st.rows, i, 1); await saveRows(st, true); await redraw(st); };
  const del = el('button', 'vis-mini vis-mini-del', '✕'); del.title = t('ui.vis.delRow');
  del.onclick = async () => {
    if (!(await confirmBox(t('ui.vis.delRowAsk')))) return;
    VC.removeRow(st.rows, i); await saveRows(st); await renderVisual(st.key);
  };
  head.append(up, dn, del);
  card.append(head);
  for (const c of cols) {
    if (c.key === 'no') continue;                      // เลขอยู่บนหัวการ์ดแล้ว
    const line = el('div', 'vis-card-line vis-card-' + c.key);
    line.append(el('div', 'vis-card-label', L[c.key]));
    const v = el('div', 'vis-card-val');
    v.append(await fieldFor(st, i, res, c.key, names));
    line.append(v);
    card.append(line);
  }
  return card;
}

/** ตัวจริงของแต่ละช่อง — ใช้ร่วมกันทั้งมุมมองตารางและรายการ */
async function fieldFor(st, i, res, key, names) {
  const row = st.rows[i];
  if (key === 'no') return el('span', 'vis-no-num', String(row.no));
  if (key === 'scene') return el('span', 'vis-scene', st.sceneTitle);

  if (key === 'image') {
    const box = el('div', 'vis-img');
    if (row.image) {
      const im = el('img', 'vis-thumb');
      im.src = await imgUrl(row.image);
      im.title = row.image;
      im.onclick = async () => imageLightbox(await imgUrl(row.image), row.image);
      box.append(im);
    } else {
      box.append(el('div', 'vis-noimg', t('ui.vis.noImage')));
    }
    const tools = el('div', 'vis-img-tools');
    const pick = el('button', 'vis-mini vis-pick', row.image ? '⇄' : '＋');
    pick.title = t('ui.vis.pickImage');
    pick.onclick = async () => {
      const got = await pickImage(state.root);
      if (!got) return;
      row.image = got.file;
      await saveRows(st);
      await redraw(st);
    };
    tools.append(pick);
    if (row.image) {
      const clr = el('button', 'vis-mini', '✕'); clr.title = t('ui.vis.clearImage');
      clr.onclick = async () => { row.image = ''; await saveRows(st); await redraw(st); };
      tools.append(clr);
    }
    box.append(tools);
    return box;
  }

  if (key === 'text') {
    const box = el('div', 'vis-text vis-st-' + res.status);
    const showLn = !!(state.settings && state.settings.lineNumbers);
    if (res.status === 'free') {
      box.append(el('div', 'vis-text-body vis-text-empty', t('ui.vis.freeRow')));
    } else if (!res.live.length) {
      box.append(el('div', 'vis-text-body vis-text-empty', t('ui.vis.allLost')));
    } else {
      // หนึ่งบรรทัดที่ผูก = หนึ่งย่อหน้าในช่อง (ข้อ 1)
      // บรรทัดที่ผู้เขียนลบไปแล้ว "ก็ไม่มี" — ไม่แสดง และ **ไม่ลบแถว**
      for (const p of res.live) {
        const one = el('div', 'vis-line');
        if (showLn) one.append(el('span', 'vis-lineno', String(p.idx + 1)));
        one.append(el('span', 'vis-text-body', VC.displayText(p.text)));
        if (p.status === 'changed') {
          const b = el('button', 'vis-mini vis-sync', '⟳');
          b.title = t('ui.vis.statusChanged');
          b.onclick = async () => { VC.syncRow(row, res); await saveRows(st); await renderVisual(st.key); };
          one.append(el('span', 'vis-tag vis-tag-changed', t('ui.vis.statusChangedTag')), b);
        }
        box.append(one);
      }
    }
    const foot = el('div', 'vis-text-foot');
    const bind = el('button', 'vis-mini vis-bind', '⇄');
    bind.title = t('ui.vis.editBind');
    bind.onclick = () => pickLinesDialog(st, i);
    foot.append(bind);
    if (res.live.length > 1) foot.append(el('span', 'dim vis-bindn', tf('ui.vis.boundN', res.live.length)));
    box.append(foot);
    return box;
  }

  if (key === 'entities') {
    const box = el('div', 'vis-ents');
    const found = VC.entitiesIn(VC.liveText(res), names);
    if (!found.length) box.append(el('span', 'dim vis-noent', '—'));
    for (const n of found) {
      const chip = el('span', 'vis-ent', n);
      const file = smart && smart.fileOf ? smart.fileOf[n] : null;
      if (file) {
        chip.classList.add('has-wiki');
        chip.title = t('ui.vis.openWiki');
        chip.onclick = async () => { const { openEntity } = await import('../wiki-ui.js'); openEntity(file); };
      }
      box.append(chip);
    }
    return box;
  }

  if (key === 'remark') {
    const inp = el('textarea', 'vis-remark');
    inp.value = row.remark;
    inp.placeholder = t('ui.vis.remarkPh');
    inp.rows = 3;
    let timer = null;
    inp.oninput = () => {
      row.remark = inp.value;
      clearTimeout(timer);
      timer = setTimeout(() => saveRows(st, true), 400);
    };
    inp.onblur = () => { clearTimeout(timer); saveRows(st); };
    return inp;
  }

  if (key === 'comment') {
    const box = el('div', 'vis-cmts');
    const cs = VC.commentsForText(VC.liveText(res) || row.text, st.comments);
    if (!cs.length) box.append(el('span', 'dim vis-nocmt', '—'));
    for (const c of cs) {
      const chip = el('div', 'vis-cmt' + (c.resolved ? ' done' : ''));
      chip.append(el('span', 'vis-cmt-text', c.text));
      if (c.author) chip.append(el('span', 'vis-cmt-who', c.author));
      chip.title = c.text;
      box.append(chip);
    }
    return box;
  }
  return el('span');
}

// ───────── กล่องเลือกบรรทัดจากฉาก (เพิ่มแถว / แก้การผูกของแถวเดิม) ─────────
/**
 * ไม่ส่ง rowIdx = เพิ่มแถวใหม่ (ติ๊กหลายบรรทัด → หลายแถว)
 * ส่ง rowIdx    = แก้การผูกของแถวนั้น (ติ๊กหลายบรรทัด → แถวเดียวผูกหลายบรรทัด · ติ๊กออก = เลิกผูก)
 */
export function pickLinesDialog(st, rowIdx) {
  return new Promise((resolve) => {
    const edit = typeof rowIdx === 'number';
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide vis-pick');
    box.append(el('div', 'k-dlg-title', edit ? t('ui.vis.editBind') : t('ui.vis.pickLine')));
    box.append(el('div', 'dim vis-pick-hint', edit ? t('ui.vis.editBindHint') : t('ui.vis.pickLineHint')));
    const list = el('div', 'vis-pick-list');
    const usage = VC.lineUsage(st.rows, st.lines);
    const mine = new Set(edit ? VC.boundIdxs(st.rows[rowIdx], st.lines) : []);
    // แก้การผูก = เห็นทุกบรรทัด · เพิ่มแถวใหม่ = เห็นเฉพาะที่ยังไม่ถูกใช้
    const pool = edit ? st.lines : st.lines.filter((l) => !usage.has(l.i));
    const picked = new Set(mine);
    if (!st.lines.length) list.append(el('div', 'dim', t('ui.vis.noLines')));
    else if (!pool.length) list.append(el('div', 'dim', t('ui.vis.allUsed')));
    const showLn = !!(state.settings && state.settings.lineNumbers);
    for (const line of pool) {
      const r = el('label', 'vis-pick-row');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = mine.has(line.i);
      cb.dataset.line = String(line.i);
      cb.onchange = () => { if (cb.checked) picked.add(line.i); else picked.delete(line.i); };
      r.append(cb);
      if (showLn) r.append(el('span', 'vis-lineno', String(line.i + 1)));
      r.append(el('span', 'vis-pick-text', VC.displayText(line.text)));
      if (usage.has(line.i) && !mine.has(line.i))
        r.append(el('span', 'vis-tag vis-tag-used', t('ui.vis.lineUsed')));
      list.append(r);
    }
    box.append(list);
    const btns = el('div', 'k-dlg-btns');
    if (pool.length > 1) {
      const all = el('button', 'vis-selall', t('ui.vis.selectAll'));
      all.onclick = () => {
        list.querySelectorAll('input').forEach((cb, k) => { cb.checked = true; picked.add(pool[k].i); });
      };
      btns.append(all);
    }
    const ok = el('button', 'k-ok', edit ? t('ui.common.save') : t('ui.vis.addSelected'));
    const cancel = el('button', null, t('ui.common.cancel'));
    btns.append(ok, cancel);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    cancel.onclick = () => done(false);
    ov.onclick = (e) => { if (e.target === ov) done(false); };
    ok.onclick = async () => {
      const byI = new Map(st.lines.map((l) => [l.i, l]));
      const sel = [...picked].sort((a, b) => a - b);
      if (edit) {
        VC.bindRow(st.rows[rowIdx], st.lines, sel);       // ติ๊กออกจนหมด = แถวว่าง (แถวยังอยู่)
      } else {
        if (!sel.length) return done(false);
        for (const i of sel) VC.insertRow(st.rows, -1, VC.rowFromLines([byI.get(i)]));
      }
      await saveRows(st);
      done(true);
      await renderVisual(st.key);
    };
  });
}

// ───────── สร้างไฟล์ครั้งแรก ─────────
/** สร้างตารางเปล่า (ผู้ใช้เลือกบรรทัดเองทีหลัง) แล้วเปิดแท็บ */
export async function createVisual(scenePath, sceneTitle) {
  const vp = await visPathOf(scenePath);
  if (!(await kapi.exists(vp))) await kapi.writeFile(vp, VC.dumpVis([]));
  const { buildTree } = await import('../app.js');
  await buildTree();
  await openVisual(scenePath, sceneTitle);
}

/**
 * ปุ่ม/คีย์ลัด "เล่าด้วยภาพ" ของฉากที่กำลังเปิดอยู่ (ข้อ 6)
 * ไม่ได้เปิดฉากอยู่ = บอกไปตรง ๆ ไม่เดาว่าจะเอาฉากไหน
 */
export async function openVisualForActive() {
  const tab = state.active;
  const f = tab && tab.file;
  if (!f || !/\.md$/i.test(f)) { setStatus(t('ui.vis.needScene')); return false; }
  if (await hasVis(f)) await openVisual(f, tab.title);
  else await createVisual(f, tab.title);
  return true;
}
