// home-ui.js — หน้า Home แสดงรายการโปรเจกต์ทั้งหมดแบบ Grid (เหมือน Notion)
import { t } from './i18n.js';
import { $, el, state, setStatus, log, t as tr } from './core.js';
import { activate, closeTab, loadProject, newProject } from './app.js';
// [alpha.60r3 ข้อ 9] ปุ่มส่งออก/นำเข้าโปรเจกต์บนหน้าแรก
import { exportProjectZip, importProjectZip } from './export-zip.js';

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

  const exportBtn = mk('home-btn-export', tr('home.export', '📤 ส่งออก'), t('ui.home.exportProjectOpenFile'));
  const importBtn = mk('home-btn-import', tr('home.import', '📥 นำเข้า'), t('ui.home.importProjectFileZip'));
  const spacer = el('div', 'home-actions-spacer');
  const newBtn = mk('k-ok home-btn-new', tr('home.newProject', '➕ สร้างโปรเจกต์ใหม่'));
  const openBtn = mk('home-btn-open', tr('home.openProject', '📂 เปิดโปรเจกต์'));
  const closeBtn = mk('home-btn-close', tr('home.close', '✕ ปิด'), t('ui.home.closePageFirst'));

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
async function loadProjects(grid) {
  grid.innerHTML = '';
  
  try {
    const recent = await kapi.listRecent().catch(() => []);
    const tasks = recent.map(async (root) => {
      try {
        const metaFile = await kapi.join(root, 'project.khn.json');
        if (!(await kapi.exists(metaFile))) return null;
        const meta = await kapi.readJson(metaFile);
        
        // นับจำนวนฉาก/บท/คำ
        let totalScenes = 0, totalChapters = 0, totalWords = 0;
        let lastModified = meta.created || '';
        
        // scan ทุกเล่ม
        const entries = await kapi.listDirs(root).catch(() => []);
        for (const secName of entries) {
          const secPath = await kapi.join(root, secName);
          const secJson = await kapi.join(secPath, 'section.json');
          if (!(await kapi.exists(secJson))) continue;
          const draftRoot = await kapi.join(secPath, 'Draft');
          if (!(await kapi.exists(draftRoot))) continue;
          const draftDirs = await kapi.listDirs(draftRoot).catch(() => []);
          for (const dn of draftDirs) {
            const dPath = await kapi.join(draftRoot, dn);
            const draftFile = await kapi.join(dPath, 'draft.json');
            if (!(await kapi.exists(draftFile))) continue;
            const draft = await kapi.readJson(draftFile).catch(() => ({}));
            const chapters = draft.chapters || [];
            totalChapters += chapters.length;
            const scenesFile = await kapi.join(dPath, 'scenes.json');
            if (await kapi.exists(scenesFile)) {
              const scData = await kapi.readJson(scenesFile).catch(() => ({}));
              const scChapters = scData.chapters || {};
              for (const ch of chapters) {
                const scenes = scChapters[ch.guid] || [];
                totalScenes += scenes.filter((s) => s.type !== 'memo').length;
                for (const sc of scenes) {
                  if (sc.type === 'memo') continue;
                  totalWords += sc.wordCount || 0;
                  if (sc.modified && sc.modified > lastModified) lastModified = sc.modified;
                }
              }
            }
          }
        }
        
        // อ่านวันที่แก้ไขล่าสุดจาก meta หรือ mtime
        const modDate = lastModified ? new Date(lastModified) : null;
        const dateStr = modDate ? modDate.toLocaleDateString('th-TH', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }) : '—';
        
        return {
          root,
          title: meta.title || root.replace(/^.*[\\/]/, ''),
          author: meta.author || '',
          cover: meta.cover || '',
          totalScenes,
          totalChapters,
          totalWords,
          dateStr,
          settings: meta.settings || {},
          goals: meta.goals || {},
        };
      } catch (e) {
        log('warn', t('ui.home.homeReadProjectFail') + root, e);
        return null;
      }
    });
    
    let projects = (await Promise.all(tasks)).filter(Boolean);
    
    if (projects.length === 0) {
      // Empty state
      const empty = el('div', 'home-empty');
      empty.innerHTML = t('ui.home.notHasProjectNew');
      grid.append(empty);
      return;
    }
    
    // เรียงตามวันที่แก้ไขล่าสุด (ใหม่สุดก่อน)
    projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    
    for (const p of projects) {
      const card = createProjectCard(p);
      grid.append(card);
    }
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
    img.src = 'file://' + project.root.replace(/\\/g, '/') + '/' + project.cover;
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
  try {
    const recent = await kapi.listRecent().catch(() => []);
    const tasks = recent.map(async (root) => {
      try {
        const metaFile = await kapi.join(root, 'project.khn.json');
        if (!(await kapi.exists(metaFile))) return null;
        const meta = await kapi.readJson(metaFile);
        let totalScenes = 0, totalChapters = 0, totalWords = 0;
        let lastModified = meta.created || '';
        const entries = await kapi.listDirs(root).catch(() => []);
        for (const secName of entries) {
          const secPath = await kapi.join(root, secName);
          const secJson = await kapi.join(secPath, 'section.json');
          if (!(await kapi.exists(secJson))) continue;
          const draftRoot = await kapi.join(secPath, 'Draft');
          if (!(await kapi.exists(draftRoot))) continue;
          const draftDirs = await kapi.listDirs(draftRoot).catch(() => []);
          for (const dn of draftDirs) {
            const dPath = await kapi.join(draftRoot, dn);
            const draftFile = await kapi.join(dPath, 'draft.json');
            if (!(await kapi.exists(draftFile))) continue;
            const draft = await kapi.readJson(draftFile).catch(() => ({}));
            const chapters = draft.chapters || [];
            totalChapters += chapters.length;
            const scenesFile = await kapi.join(dPath, 'scenes.json');
            if (await kapi.exists(scenesFile)) {
              const scData = await kapi.readJson(scenesFile).catch(() => ({}));
              const scChapters = scData.chapters || {};
              for (const ch of chapters) {
                const scenes = scChapters[ch.guid] || [];
                totalScenes += scenes.filter((s) => s.type !== 'memo').length;
                for (const sc of scenes) {
                  if (sc.type === 'memo') continue;
                  totalWords += sc.wordCount || 0;
                  if (sc.modified && sc.modified > lastModified) lastModified = sc.modified;
                }
              }
            }
          }
        }
        const modDate = lastModified ? new Date(lastModified) : null;
        const dateStr = modDate ? modDate.toLocaleDateString('th-TH', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }) : '—';
        return { root, title: meta.title || root.replace(/^.*[\\/]/, ''),
                 author: meta.author || '', cover: meta.cover || '',
                 totalScenes, totalChapters, totalWords, dateStr,
                 settings: meta.settings || {}, goals: meta.goals || {} };
      } catch (e) { return null; }
    });
    let projects = (await Promise.all(tasks)).filter(Boolean);
    if (projects.length === 0) {
      grid.append(el('div', 'home-empty', el('p', null, t('ui.home.notHasProject'))));
      return;
    }
    projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    // ใช้การ์ดชุดเดียวกับหน้า Home (.home-card) — มีสไตล์จริงและสลับมุมมองการ์ด/รายการได้
    for (const p of projects) grid.append(createProjectCard(p, onOpen));
  } catch (e) {
    log('error', t('ui.home.homePanelLoadFail'), e);
    grid.append(el('div', 'home-empty', t('ui.home.occurErrorLoadProject')));
  }
}
