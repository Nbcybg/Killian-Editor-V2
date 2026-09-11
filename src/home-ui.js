// home-ui.js — หน้า Home แสดงรายการโปรเจกต์ทั้งหมดแบบ Grid (เหมือน Notion)
import { t } from './i18n.js';
import { $, el, state, setStatus, log, t as tr } from './core.js';
import { activate, closeTab, loadProject, newProject } from './app.js';
// [alpha.60r3 ข้อ 9] ปุ่มส่งออก/นำเข้าโปรเจกต์บนหน้าแรก
import { exportProjectZip, importProjectZip } from './export-zip.js';
import { initIcons } from './icons.js';
import { fileUrlFromPath } from './file-url.js';

// [alpha.61 ข้อ 1] มุมมองหน้าแรกเป็น "โหมด" ไม่ใช่สวิตช์สลับ — 2 ปุ่มแยกกัน ติดสว่างอันที่ใช้อยู่
export const HOME_VIEWS = [
  { id: 'card', icon: '▦', label: t('ui.home.card') },
  { id: 'list', icon: '☰', label: t('ui.common.list2') },
];
/** โหมดที่ผู้ใช้เลือกไว้ล่าสุด (localStorage) — ค่าที่อ่านไม่รู้จักถือเป็น 'card' */
export function homeView() {
  return localStorage.getItem('k2-home-view') === 'list' ? 'list' : 'card';
}
export function setHomeView(v) {
  const mode = v === 'list' ? 'list' : 'card';
  localStorage.setItem('k2-home-view', mode);
  return mode;
}

/**
 * [alpha.61 ข้อ 1] แถบคำสั่งของหน้าแรก — ย้ายลง "ขอบล่าง" ของกล่อง (เดิมอยู่ใต้หัวเรื่อง)
 * ใช้ร่วมกันทั้ง 3 โหมดการวาด (กล่อง overlay · แท็บหน้าแรก · แผงหน้าแรก)
 *
 * ลำดับใหม่:
 *   [▦ การ์ด] [☰ รายการ] [🔍 ค้นหา] │ [📤 ส่งออก] [📥 นำเข้า]
 *      ── ช่องว่างยืดได้ ── [➕ สร้างโปรเจกต์ใหม่] [📂 เปิดโปรเจกต์] [✕ ปิด]
 *
 * @param {{onClose?:Function, grid?:HTMLElement}} opts
 *        ไม่มี onClose = ไม่แสดงปุ่มปิด · grid = ตารางการ์ดที่ปุ่มมุมมอง/ค้นหาจะไปสั่ง
 */
export function buildHomeActions(opts = {}) {
  const actions = el('div', 'home-actions');
  const mk = (cls, label, title) => {
    const b = el('button', cls, label);
    if (title) b.title = title;
    return b;
  };

  // ── มุมมอง (โหมด · ไม่ใช่สวิตช์สลับ) ──
  const viewWrap = el('div', 'home-view-modes');
  const viewBtns = {};
  for (const v of HOME_VIEWS) {
    const b = mk('home-view-mode', v.icon + ' ' + v.label, t('ui.common.view') + v.label);
    b.dataset.view = v.id;
    b.onclick = () => applyView(v.id);
    viewBtns[v.id] = b;
    viewWrap.append(b);
  }
  // ── ค้นหาโปรเจกต์ (ถัดจากปุ่มมุมมอง) ──
  const findBtn = mk('home-btn-find', t('ui.home.search'), t('ui.home.searchProjectNameAuthor'));
  const findInp = el('input', 'home-find-input');
  findInp.type = 'search';
  findInp.placeholder = t('ui.home.searchProject');
  findInp.style.display = 'none';

  const exportBtn = mk('home-btn-export', tr('home.export'), t('ui.home.exportProjectOpenFile'));
  const importBtn = mk('home-btn-import', tr('home.import'), t('ui.home.importProjectFileZip'));
  const spacer = el('div', 'home-actions-spacer');
  const newBtn = mk('k-ok home-btn-new', tr('home.newProject'));
  const openBtn = mk('home-btn-open', tr('home.openProject'));
  const closeBtn = mk('home-btn-close', tr('home.close'), t('ui.home.closePageFirst'));

  function applyView(mode) {
    const m = setHomeView(mode);
    for (const v of HOME_VIEWS) viewBtns[v.id].classList.toggle('on', v.id === m);
    opts.grid?.classList.toggle('list', m === 'list');
    return m;
  }
  /** กรองการ์ดตามคำค้น — ว่าง = แสดงทั้งหมด (ใช้ dataset.search ที่ createProjectCard ใส่ไว้) */
  function applyFind(q) {
    const key = String(q || '').trim().toLowerCase();
    const grid = opts.grid;
    if (!grid) return 0;
    let shown = 0;
    for (const c of grid.querySelectorAll('.home-card')) {
      const hit = !key || (c.dataset.search || '').includes(key);
      c.style.display = hit ? '' : 'none';
      if (hit) shown++;
    }
    grid.classList.toggle('home-grid-filtered', !!key);
    return shown;
  }
  findBtn.onclick = () => {
    const on = findInp.style.display === 'none';
    findInp.style.display = on ? '' : 'none';
    findBtn.classList.toggle('on', on);
    if (on) findInp.focus(); else { findInp.value = ''; applyFind(''); }
  };
  findInp.oninput = () => applyFind(findInp.value);
  findInp.onkeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); findBtn.onclick(); } };

  exportBtn.onclick = async () => {
    if (!state.root) { setStatus(t('ui.home.openProjectBeforeExport')); return; }
    await exportProjectZip();
  };
  importBtn.onclick = async () => {
    const dest = await importProjectZip();
    if (dest) opts.onClose?.();          // เปิดโปรเจกต์ใหม่แล้ว → ปิดหน้าแรกให้เห็นงาน
  };
  newBtn.onclick = () => { opts.onClose?.(); newProject(); };
  openBtn.onclick = async () => {
    const projectPath = await kapi.openProjectDialog?.();
    if (!projectPath) return;
    opts.onClose?.();
    await loadProject(projectPath);
  };
  closeBtn.onclick = () => opts.onClose?.();

  actions.append(viewWrap, findBtn, findInp, exportBtn, importBtn, spacer, newBtn, openBtn);
  if (opts.onClose) actions.append(closeBtn); else closeBtn.remove();
  applyView(homeView());
  return { actions, viewWrap, viewBtns, applyView, findBtn, findInp, applyFind,
           exportBtn, importBtn, spacer, newBtn, openBtn, closeBtn };
}

// เปิดหน้า Home — สร้างแท็บใหม่ หรือเปิดแท็บที่มีอยู่แล้ว
export async function openHome() {
  const key = '::home::';
  if (state.tabs.has(key)) {
    activate(key);
    return;
  }
  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', t('ui.home.pageFirst')));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file: key, title: t('ui.common.pageFirst'), pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null, gal: null, dash: true };
  tabBtn.onclick = (e) => { if (e.target !== x) activate(key); };
  x.onclick = () => closeTab(key);
  state.tabs.set(key, tab);
  activate(key);
  renderHome(pane);
}

// วาดหน้าหลัก
export async function renderHome(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'home-wrap');
  
  // หัวข้อ
  const head = el('div', 'home-head');
  head.append(el('h1', 'home-title', 'Killian 2'));
  head.append(el('p', 'home-sub', t('ui.home.appWriteNovelScreenplay')));

  // คอนเทนเนอร์การ์ด (grid)
  const grid = el('div', 'home-grid');
  grid.id = 'home-grid';

  // [alpha.61 ข้อ 1] แถวปุ่มอยู่ "ขอบล่าง" — ปิดแท็บหน้าแรกเมื่อกด ✕
  const { actions } = buildHomeActions({ onClose: () => closeTab('::home::'), grid });
  actions.classList.add('home-actions-bottom');

  wrap.append(head, grid, actions);
  pane.append(wrap);

  // --- โหลดรายการโปรเจกต์ ---
  await loadProjects(grid);

  return wrap;
}

// โหลดโปรเจกต์ทั้งหมด: จาก recent.json + scan โฟลเดอร์ที่ผู้ใช้เก็บ
// ═══════════ [alpha.124 ข้อ 19 · ข้อ 43] โปรเจกต์ที่ "หาย" ต้องไม่หายเงียบ ═══════════
//
// เดิมทั้งสองตัวโหลด (หน้าแรกเต็มจอ + แผงหน้าแรก) ทำเหมือนกันคือ:
//   `if (!exists(project.khn.json)) return null;`  แล้ว `.filter(Boolean)`
// → โปรเจกต์ที่ถูกย้าย/เปลี่ยนชื่อ/อยู่บนไดรฟ์ที่ยังไม่ได้เสียบ **หายไปจากหน้าจอเฉย ๆ**
//   ไม่มีอะไรบอกว่าเคยมี ไม่มีทางรู้ว่าทำไมหาย และไม่มีทางเอาออกจากรายการล่าสุดด้วย
//
// ตอนนี้: คืน `{ broken: true, reason }` แทน null แล้ววาดเป็นการ์ด "หาไม่เจอ" ที่บอกที่อยู่เต็ม
// พร้อมปุ่ม **ลบออกจากรายการ** · ยังไม่ลบให้เองอัตโนมัติ (ไดรฟ์ภายนอกที่ยังไม่เสียบ = ยังอยู่ดี)

/** อ่านโปรเจกต์หนึ่งรายการจากรายการล่าสุด → การ์ดปกติ หรือการ์ด "หาไม่เจอ" */
async function readRecentProject(root) {
  try {
    const metaFile = await kapi.join(root, 'project.khn.json');
    if (!(await kapi.exists(metaFile)))
      return { root, broken: true, reason: t('ui.home.brokenNoMeta') };
    const meta = await kapi.readJson(metaFile);
    let totalScenes = 0, totalChapters = 0, totalWords = 0;
    let lastModified = meta.created || '';
    for (const secName of await kapi.listDirs(root).catch(() => [])) {
      const secPath = await kapi.join(root, secName);
      if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
      const draftRoot = await kapi.join(secPath, 'Draft');
      if (!(await kapi.exists(draftRoot))) continue;
      for (const dn of await kapi.listDirs(draftRoot).catch(() => [])) {
        const dPath = await kapi.join(draftRoot, dn);
        const draftFile = await kapi.join(dPath, 'draft.json');
        if (!(await kapi.exists(draftFile))) continue;
        const chapters = (await kapi.readJson(draftFile).catch(() => ({}))).chapters || [];
        totalChapters += chapters.length;
        const scenesFile = await kapi.join(dPath, 'scenes.json');
        if (!(await kapi.exists(scenesFile))) continue;
        const scChapters = (await kapi.readJson(scenesFile).catch(() => ({}))).chapters || {};
        for (const ch of chapters) {
          for (const sc of (scChapters[ch.guid] || [])) {
            if (sc.type === 'memo') continue;
            totalScenes++;
            totalWords += sc.wordCount || 0;
            if (sc.modified && sc.modified > lastModified) lastModified = sc.modified;
          }
        }
      }
    }
    const modDate = lastModified ? new Date(lastModified) : null;
    const dateStr = modDate ? modDate.toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    return { root, title: meta.title || root.replace(/^.*[\\/]/, ''),
             author: meta.author || '', cover: meta.cover || '',
             totalScenes, totalChapters, totalWords, dateStr, lastModified,
             settings: meta.settings || {}, goals: meta.goals || {} };
  } catch (e) {
    log('warn', t('ui.home.homeReadProjectFail') + root, e);
    return { root, broken: true, reason: t('ui.home.brokenUnreadable') };
  }
}

/** รายการล่าสุดทั้งหมด แยกเป็น "เปิดได้" กับ "หาไม่เจอ" (เรียงใหม่สุดก่อน) */
export async function scanRecentProjects() {
  const recent = await kapi.listRecent().catch(() => []);
  const rows = await Promise.all(recent.map(readRecentProject));
  const ok = rows.filter((r) => r && !r.broken);
  ok.sort((a, b) => String(b.lastModified || '').localeCompare(String(a.lastModified || '')));
  return { ok, broken: rows.filter((r) => r && r.broken) };
}

/** การ์ด "หาโปรเจกต์นี้ไม่เจอ" — บอกที่อยู่เต็ม + ปุ่มลบออกจากรายการ */
export function createBrokenCard(row, onChanged) {
  const card = el('div', 'home-card home-card-broken');
  card.dataset.search = String(row.root || '').toLowerCase();
  card.append(el('div', 'home-card-title', '⚠ ' + t('ui.home.brokenTitle')));
  const pathEl = el('div', 'home-broken-path', row.root);
  pathEl.title = row.root;
  card.append(pathEl);
  card.append(el('div', 'home-broken-why', row.reason || ''));
  const btns = el('div', 'home-broken-btns');
  const rm = el('button', 'k-danger', t('ui.home.brokenRemove'));
  rm.onclick = async (e) => {
    e.stopPropagation();
    await kapi.removeRecent(row.root);
    setStatus(t('ui.app.recentBrokenRemoved'));
    if (onChanged) onChanged();
  };
  btns.append(rm);
  card.append(btns);
  return card;
}

/** วาดหน้าแรก/แผงหน้าแรกใหม่ทุกใบที่เปิดค้างอยู่ (ใช้หลังลบรายการที่พัง) */
export function refreshHomePanels() {
  for (const grid of document.querySelectorAll('.home-grid')) {
    if (grid.dataset.homePanel === '1') loadPanelProjects(grid, grid._onOpen);
    else loadProjects(grid);
  }
}

async function loadProjects(grid) {
  grid.innerHTML = '';
  try {
    const { ok, broken } = await scanRecentProjects();
    if (!ok.length && !broken.length) {
      const empty = el('div', 'home-empty');
      // [alpha.147] ค่าในไฟล์ภาษาเป็น HTML (<h2>…<p>…) มาตั้งแต่ยกข้อความออกจากโค้ด — textContent
      // โชว์แท็กดิบ ๆ บนหน้าแรก · ไฟล์ภาษาเป็นของโปรแกรมเอง (เหมือนเทมเพลตกล่องตั้งค่า) จึงใส่เป็น HTML ได้
      empty.innerHTML = t('ui.home.notHasProjectNew');
      initIcons(empty);
      grid.append(empty);
      return;
    }
    for (const p of ok) grid.append(createProjectCard(p));
    // [alpha.124 ข้อ 19] รายการที่เปิดไม่ได้ต่อท้าย — เห็นว่ามีอยู่ และเอาออกได้
    for (const b of broken) grid.append(createBrokenCard(b, refreshHomePanels));
  } catch (e) {
    log('error', t('ui.home.homeLoadProjectFail'), e);
    grid.append(el('div', 'home-empty', t('ui.home.occurErrorLoadProject')));
  }
}

// สร้างการ์ดโปรเจกต์หนึ่งใบ · onOpen = เรียกก่อนโหลด (กล่อง Home ใช้ปิด overlay ตัวเอง)
export function createProjectCard(project, onOpen) {
  const card = el('div', 'home-card');
  // [alpha.61 ข้อ 1] ปุ่มค้นหาโปรเจกต์กรองจากคีย์นี้ (ชื่อ · ผู้เขียน · ที่อยู่ไฟล์)
  card.dataset.search = [project.title, project.author, project.root]
    .filter(Boolean).join(' ').toLowerCase();

  // ส่วนปก (แสดง cover หรือ placeholder)
  const cover = el('div', 'home-card-cover');
  if (project.cover) {
    const img = el('img', 'home-card-img');
    // [alpha.148] เดิมต่อ 'file://' เอง → โฟลเดอร์ชื่อมี # ? % (เช่น "นิยาย #2") รูปไม่ขึ้น · Windows ได้ URL ผิดรูป
    img.src = fileUrlFromPath(String(project.root).replace(/[\\/]+$/, '') + '/' + project.cover);
    img.onerror = () => { cover.innerHTML = '<div class="home-card-cover-ph">📖</div>'; };
    cover.append(img);
  } else {
    cover.append(el('div', 'home-card-cover-ph', '📖'));
  }
  
  // เนื้อหาการ์ด
  const body = el('div', 'home-card-body');
  
  // ชื่อโปรเจกต์
  const title = el('div', 'home-card-title', project.title);
  if (project.author) {
    title.append(el('span', 'home-card-author', t('ui.home.msg') + project.author));
  }
  body.append(title);
  
  // สถิติ
  const stats = el('div', 'home-card-stats');
  const statItems = [
    { icon: '📄', label: t('ui.common.scene2'), val: project.totalScenes },
    { icon: '📁', label: t('ui.common.chapter'), val: project.totalChapters },
    { icon: '📝', label: t('ui.common.word2'), val: project.totalWords.toLocaleString() },
  ];
  for (const s of statItems) {
    const si = el('span', 'home-stat');
    si.textContent = s.icon + ' ' + s.label + ': ' + s.val;
    stats.append(si);
  }
  body.append(stats);
  
  // วันที่แก้ไขล่าสุด
  const date = el('div', 'home-card-date', t('ui.home.editLatest') + project.dateStr);
  body.append(date);

  // ══ [alpha.123] ที่อยู่ของโปรเจกต์บนดิสก์ ══
  //
  // ผู้ใช้: *"ในหน้า home เราอยากให้มีระบุตำแหน่งของ project ใน disk ได้มั้ย"*
  //
  // จำเป็นจริงเมื่อมีโปรเจกต์ชื่อคล้ายกันหลายอัน (สำเนาสำรอง · เวอร์ชันทดลอง) — ชื่อบนการ์ด
  // แยกไม่ออกว่าอันไหนคืออันที่กำลังเขียนอยู่ · ที่อยู่เต็มอยู่ใน `title` (hover เห็นครบ)
  // ส่วนบนการ์ดตัดหัวด้วย CSS `direction:rtl` ให้เห็น **ท้ายทาง** ซึ่งเป็นส่วนที่ต่างกัน
  const pathRow = el('div', 'home-card-path');
  const pathTxt = el('span', 'home-card-pathtxt', project.root);
  pathTxt.title = project.root;
  pathRow.append(pathTxt);
  const reveal = el('button', 'home-card-pathbtn', '📂');
  reveal.title = t('ui.home.revealInOS');
  reveal.onclick = (e) => { e.stopPropagation(); kapi.revealInOS(project.root).catch(() => {}); };
  const copy = el('button', 'home-card-pathbtn', '⧉');
  copy.title = t('ui.home.copyPath');
  copy.onclick = async (e) => {
    e.stopPropagation();
    await kapi.clipboardWrite(project.root).catch(() => {});
    setStatus(t('ui.home.pathCopied'));
  };
  pathRow.append(reveal, copy);
  body.append(pathRow);
  
  // ปุ่มเปิด
  const openBtn = el('button', 'k-ok home-card-open', t('ui.common.openProject'));
  openBtn.onclick = async (e) => {
    e.stopPropagation();
    await kapi.pushRecent(project.root).catch(() => {});
    onOpen?.();
    await loadProject(project.root);
  };
  body.append(openBtn);
  
  card.append(cover, body);
  
  // คลิกที่การ์ด = เปิด
  card.addEventListener('click', () => openBtn.click());

  return card;
}

// เปิด Home เป็น overlay dialog (แทน panel)
export async function showHomeDialog() {
  const ov = el('div', 'k-overlay');
  ov.style.zIndex = '90';
  // 0.56a #1: กล่องหน้าแรกต้อง "ขนาดเท่าเดิมเสมอ" ไม่ว่าจะมุมมองการ์ดหรือรายการ
  // (เดิมกล่องหดตามเนื้อใน → สลับมุมมองทีกล่องกระตุกทั้งใบ · แบบ DaVinci Resolve คือกรอบนิ่ง เนื้อในเลื่อน)
  const box = el('div', 'k-dialog k-home-dlg');
  const head = el('div', 'home-head');
  // [alpha.61 ข้อ 1] เอาปุ่ม ✕ มุมขวาบนออก — ปิดได้ที่ปุ่ม "✕ ปิด" ในแถบล่าง (หรือ Esc)
  head.append(el('h2', 'home-title', 'Killian 2'));
  const grid = el('div', 'home-grid');
  const scroll = el('div', 'home-dlg-scroll');   // กรอบคงที่ · เลื่อนเฉพาะรายการข้างใน
  scroll.append(grid);
  // [alpha.61 ข้อ 1] แถบคำสั่ง (มุมมอง · ค้นหา · ส่งออก/นำเข้า · สร้าง/เปิด/ปิด) อยู่ขอบล่างของกล่อง
  const { actions } = buildHomeActions({ onClose: () => ov.remove(), grid });
  actions.classList.add('home-actions-bottom');
  box.append(head, scroll, actions);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } });

  // บั๊ก #12: ขนาดต้อง "นิ่ง" — มุมมองที่เลือกไว้ถูกคืนสถานะโดย buildHomeActions แล้ว
  const thumb = Math.max(120, Math.min(400, parseInt(state.settings?.homeThumb, 10) || 190));
  box.style.setProperty('--home-thumb', thumb + 'px');
  await loadPanelProjects(grid, () => ov.remove());   // เปิดโปรเจกต์แล้วต้องปิดกล่อง ไม่งั้นค้างทับหน้าจอ
  return ov;
}

export async function renderHomePanel(host) {
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';
  const wrap = el('div', 'home-wrap');
  const head = el('div', 'home-head');
  head.append(el('h2', 'home-title', 'Killian 2'));
  const list = el('div', 'home-grid');
  // แผงหน้าแรกปิดด้วยปุ่ม ✕ บนหัวแผงอยู่แล้ว → ไม่ต้องมีปุ่มปิดซ้ำในแถวคำสั่ง
  const { actions } = buildHomeActions({ grid: list });
  actions.classList.add('home-actions-bottom');
  wrap.append(head, list, actions);
  host.append(wrap);

  await loadPanelProjects(list);
  return wrap;
}

async function loadPanelProjects(grid, onOpen) {
  grid.innerHTML = '';
  grid.dataset.homePanel = '1';
  grid._onOpen = onOpen;
  try {
    const { ok, broken } = await scanRecentProjects();
    if (!ok.length && !broken.length) {
      grid.append(el('div', 'home-empty', el('p', null, t('ui.home.notHasProject'))));
      return;
    }
    // ใช้การ์ดชุดเดียวกับหน้า Home (.home-card) — มีสไตล์จริงและสลับมุมมองการ์ด/รายการได้
    for (const p of ok) grid.append(createProjectCard(p, onOpen));
    for (const b of broken) grid.append(createBrokenCard(b, refreshHomePanels));
  } catch (e) {
    log('error', t('ui.home.homePanelLoadFail'), e);
    grid.append(el('div', 'home-empty', t('ui.home.occurErrorLoadProject')));
  }
}
