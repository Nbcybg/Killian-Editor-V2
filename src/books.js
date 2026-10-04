// books.js — ตัวจัดการเล่ม/ร่าง (Book Manager): เพิ่ม/แก้/ลบ/เรียงเล่มและร่าง
// [alpha.168] หน้าตาแบบห้องสมุด (ภาพอ้างอิง 1 ของผู้ใช้): ตารางปก/รายการซ้าย · แผงรายละเอียดของเล่มที่เลือกขวา
//   ค้นหา · กรองสถานะ · เรียง (ลำดับเรื่อง/ชื่อ/คำ/สถานะ/แก้ล่าสุด) · ลากเรียงด้วยเมาส์ + เส้นแทรก · ปุ่มขึ้น/ลง
//   ผู้ใช้: "ดูโบราณมาก ๆ · การเรียงลำดับยังติด ๆ ขัด ๆ มั่ว ๆ · อาจเพราะไม่มี info หรือ ui ที่บอกอะไรเลย"
import { vivid, inkOn } from './color-util.js';
import { errText } from './err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import { t, tf } from './i18n.js';
import { SECTION_STATUSES, buildTree, openCompileDialog, openFirstSceneOf, resolveImg } from './app.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { addSection, deleteSection, listSections, reorderSections, saveSectionMeta, sectionStats } from './section-ops.js';
import { $, el, setStatus, setStatusError, state } from './core.js';
import { pickImage } from './gallery.js';
import { popupMenu, ask } from './ui.js';
import { listDraftsForSection, createDraft, deleteDraft, renameDraft, setPrimaryDraft } from './drafts.js';
// [alpha.141] อ่านทั้งเล่ม + จัดการบท — ผู้ใช้ขอให้มีทางเข้าจากหน้าจัดการเล่มด้วย
import { openBookReader, bumpBookFlow } from './read-ui.js';
import { openChapterManager, coverHintLine } from './chapters-ui.js';
import { gi } from './icons.js';
import { panelEmpty } from './panels/panel-chrome.js';   // [alpha.162 · W2] สถานะว่างของกลาง
import { fmtNum, fmtDateTime, cmpText } from './locale.js';
import { libraryList, canReorder, stepTarget } from './library-view.js';
import { libShell, coverArt, pills, libToolbar, statTiles, metaRows, bindReorder, SORT_KEYS } from './library-ui.js';

// สถานะหน้าจอ (ไม่บันทึกลงไฟล์)
const BK = { sel: '', q: '', sort: 'order', dir: 'asc', status: 'all', view: 'grid' };

// บั๊ก #18: จัดการเล่มเป็นแผง ไม่ใช่แท็บเอกสาร
export async function openBookManager() {
  showPanel('books');
  return renderBookManager($('#books-body'));
}
export function refreshBooksIfOpen() {
  if (isPanelOpen('books') && $('#books-body')) renderBookManager($('#books-body'));
}

const statusOf = (k) => SECTION_STATUSES.find((s) => s[0] === k) || SECTION_STATUSES[0];
const statusRank = (k) => Math.max(0, SECTION_STATUSES.findIndex((s) => s[0] === (k || 'outline')));
function statusChip(key) {
  const [, label, color] = statusOf(key);
  const v = vivid(color) || color;
  const chip = el('span', 'book-status-pill lib-chip', label);
  chip.style.background = v; chip.style.color = inkOn(v);
  return chip;
}

let _seq = 0;
export async function renderBookManager(pane) {
  if (!pane) return;
  const seq = ++_seq;
  const sections = await listSections();
  const stats = await Promise.all(sections.map((s) => sectionStats(s.secPath).catch(() => ({ chapters: 0, scenes: 0, words: 0, drafts: 0 }))));
  const mt = await Promise.all(sections.map((s) => kapi.mtime(s.sf).catch(() => 0)));
  if (seq !== _seq) return;                                   // มีรอบใหม่แซง — ทิ้งรอบนี้
  const items = sections.map((s, i) => ({ id: s.folder, title: s.title, order: s.order, words: stats[i].words,
    status: s.meta.status || 'outline', updated: +mt[i] || 0, blurb: s.meta.blurb || '', folder: s.folder, s, st: stats[i] }));
  if (!items.some((x) => x.id === BK.sel)) BK.sel = items[0] ? items[0].id : '';
  const redraw = () => renderBookManager(pane);

  const keepScroll = pane.querySelector('.lib-grid') ? pane.querySelector('.lib-grid').scrollTop : 0;
  const keepOuter = pane.querySelector('.lib') ? pane.querySelector('.lib').scrollTop : 0;   // แผงแคบ = ทั้งก้อนเลื่อน
  const { root, main, detail } = libShell('books-lib');

  // ── หัว: ชื่อหน้า + จำนวน + ปุ่มหลัก ──
  const head = el('div', 'lib-head books-head');
  const tt = el('div', 'lib-title books-title', t('ui.books.bookAllProject'));
  tt.append(el('span', 'lib-count', String(items.length)));
  head.append(tt, el('span', 'lib-sp'));
  const readAllBtn = el('button', 'cmp-mini', gi('book-open') + ' ' + t('ui.readbook.buttonAll'));
  readAllBtn.onclick = () => openBookReader('');           // '' = ทั้งโปรเจกต์
  const addBtn = el('button', 'k-ok', t('ui.books.addBook'));
  addBtn.onclick = async () => { await addSection(); redraw(); };
  head.append(readAllBtn, addBtn);
  main.append(head);

  // ── สถานะ (กรอง) + เครื่องมือ ──
  const counts = new Map();
  for (const it of items) counts.set(it.status, (counts.get(it.status) || 0) + 1);
  const pl = [{ value: 'all', label: t('ui.common.all'), count: items.length },
    ...SECTION_STATUSES.filter(([k]) => counts.get(k)).map(([k, label, color]) => ({ value: k, label, count: counts.get(k), swatch: vivid(color) || color }))];
  const row2 = el('div', 'lib-row2');
  row2.append(pills(pl, BK.status, (v) => { BK.status = v; redraw(); }),
    libToolbar(BK, { sorts: ['order', 'title', 'words', 'status', 'updated'], onChange: redraw, ph: t('ui.lib.searchBooksPh') }));
  main.append(row2);
  const reorderOk = canReorder(BK);
  main.append(el('div', 'lib-hint', reorderOk ? t('ui.lib.reorderHintBooks') : tf('ui.lib.reorderOffHint', t(SORT_KEYS[BK.sort] || SORT_KEYS.order))));

  const shown = libraryList(items, { ...BK, statusRank, cmpText });
  const grid = el('div', 'lib-grid books-grid' + (BK.view === 'list' ? ' lib-list' : ''));
  for (const it of shown) grid.append(BK.view === 'list' ? bookRow(it) : bookCard(it));
  if (!items.length) grid.append(panelEmpty(t('ui.books.notHasBookPress'), { cls: 'books-empty' }));
  else if (!shown.length) grid.append(el('div', 'lib-none', t('ui.lib.noMatch')));
  main.append(grid);
  bindReorder(grid, {
    items: () => [...grid.querySelectorAll('[data-lib-id]')],
    idOf: (c) => c.dataset.libId,
    enabled: () => canReorder(BK),
    onMove: async (from, before) => { await reorderSections(from, before); redraw(); },
  });

  // ── แผงรายละเอียด ──
  const cur = items.find((x) => x.id === BK.sel);
  // [alpha.168] รอรายการร่างให้ครบก่อนสลับเข้าจอ — เติมทีหลังทำให้เนื้อสั้นลงชั่วครู่ ตำแหน่งเลื่อนถูกหนีบ (แผงแคบเลื่อนทั้งก้อน)
  if (cur) await buildBookDetail(detail, cur, items, redraw);
  else detail.append(el('div', 'lib-none', t('ui.lib.pickOne')));
  if (seq !== _seq) return;

  pane.replaceChildren(root);
  if (keepScroll) { const g = pane.querySelector('.lib-grid'); if (g) g.scrollTop = keepScroll; }
  if (keepOuter) root.scrollTop = keepOuter;

  function select(id) { if (BK.sel === id) return; BK.sel = id; redraw(); }
  function bookCard(it) {
    const s = it.s;
    const card = el('div', 'book-card lib-card' + (it.id === BK.sel ? ' on' : ''));
    card.dataset.folder = s.folder; card.dataset.libId = it.id;
    card.append(coverArt({ url: s.meta.cover ? resolveImg(s.secPath, s.meta.cover) : '', title: it.title, num: '#' + (s.order || items.indexOf(it) + 1) }));
    const cap = el('div', 'lib-cap');
    cap.append(el('div', 'lib-card-title', it.title));
    cap.append(el('div', 'lib-card-sub book-stats', tf('ui.books.chapterSceneWord', it.st.chapters, it.st.scenes, fmtNum(it.st.words))));
    cap.append(statusChip(it.status));
    card.append(cap);
    card.title = it.title + '\n' + t('ui.lib.cardTip');
    card.onclick = () => select(it.id);
    card.ondblclick = () => openFirstSceneOf(s.secPath);
    return card;
  }
  function bookRow(it) {
    const s = it.s;
    const row = el('div', 'book-card lib-lrow' + (it.id === BK.sel ? ' on' : ''));
    row.dataset.folder = s.folder; row.dataset.libId = it.id;
    row.append(el('span', 'lib-grip', gi('grip-dots')));
    row.append(coverArt({ url: s.meta.cover ? resolveImg(s.secPath, s.meta.cover) : '', title: it.title }));
    const nm = el('div', 'lib-lrow-main');
    nm.append(el('div', 'lib-card-title', it.title), el('div', 'lib-card-sub', it.blurb || '—'));
    row.append(nm, statusChip(it.status));
    row.append(el('span', 'lib-lrow-n book-stats', tf('ui.books.chapterSceneWord', it.st.chapters, it.st.scenes, fmtNum(it.st.words))));
    row.onclick = () => select(it.id);
    row.ondblclick = () => openFirstSceneOf(s.secPath);
    return row;
  }
}

/** แผงขวา: ปกใหญ่ · สถานะ · ชื่อ · คำโปรย · สถิติ · ข้อมูล · ร่าง · ปุ่ม */
async function buildBookDetail(detail, it, items, redraw) {
  const s = it.s;
  detail.dataset.folder = s.folder;
  const cov = coverArt({ url: s.meta.cover ? resolveImg(s.secPath, s.meta.cover) : '', title: it.title });
  cov.classList.add('lib-dcover');
  const cb = el('div', 'book-cover-btns lib-cover-btns');
  const pickCover = el('button', 'cmp-mini', gi('image') + ' ' + t('ui.books.pickCover'));
  pickCover.onclick = async () => {
    const im = await pickImage(state.root);
    if (!im) return;
    // เก็บ path แบบสัมพัทธ์กับโฟลเดอร์เล่ม (รูปอยู่ใน <root>/Images)
    s.meta = await saveSectionMeta(s.sf, { cover: '../Images/' + im.file });
    setStatus(t('ui.books.setCoverBookDone')); bumpBookFlow(); redraw();
  };
  cb.append(pickCover);
  if (s.meta.cover) {
    const clr = el('button', 'cmp-mini', gi('close'));
    clr.title = t('ui.books.coverOut');
    clr.onclick = async () => { s.meta = await saveSectionMeta(s.sf, { cover: '' }); bumpBookFlow(); redraw(); };
    cb.append(clr);
  }
  cov.append(cb);
  detail.append(cov);

  // สถานะ (คลิกเปลี่ยน)
  const chip = statusChip(it.status);
  chip.classList.add('lib-chip-btn');
  chip.title = t('ui.lib.statusTip');
  chip.onclick = (e) => {
    popupMenu(e.clientX, e.clientY, SECTION_STATUSES.map(([k, label, color]) => ({
      text: label, swatch: vivid(color) || color, checked: k === (s.meta.status || 'outline'),
      click: async () => { s.meta = await saveSectionMeta(s.sf, { status: k }); redraw(); },
    })));
  };
  detail.append(chip);

  const titleInp = el('input', 'book-title-inp lib-dtitle'); titleInp.value = s.title;
  titleInp.title = t('ui.lib.renameTip');
  titleInp.onchange = async () => {
    const v = titleInp.value.trim(); if (!v || v === s.title) { titleInp.value = s.title; return; }
    s.meta = await saveSectionMeta(s.sf, { title: v }); s.title = v;
    await buildTree(); setStatus(t('ui.books.changeNameBookDone')); redraw();
  };
  detail.append(titleInp);
  const blurb = el('textarea', 'book-blurb lib-blurb'); blurb.placeholder = t('ui.books.wordSynopsisBook');
  blurb.value = s.meta.blurb || '';
  blurb.onchange = async () => { s.meta = await saveSectionMeta(s.sf, { blurb: blurb.value }); };
  detail.append(blurb);

  detail.append(statTiles([
    { label: t('ui.lib.statChapters'), value: fmtNum(it.st.chapters) },
    { label: t('ui.lib.statScenes'), value: fmtNum(it.st.scenes) },
    { label: t('ui.lib.statWords'), value: fmtNum(it.st.words) },
  ]));

  // ลำดับ: ขึ้น/ลง (ทางที่ไม่ต้องลาก)
  const ids = items.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((x) => x.id);
  const ord = el('div', 'lib-order');
  ord.append(el('b', null, '#' + (ids.indexOf(it.id) + 1)), el('span', 'dim', ' / ' + ids.length));
  const mv = (dir) => async () => { const tg = stepTarget(ids, it.id, dir); if (!tg) return; await reorderSections(it.id, tg.beforeId); redraw(); };
  const up = el('button', 'cmp-mini lib-up', gi('arrow-up')); up.title = t('ui.lib.moveUp'); up.disabled = ids.indexOf(it.id) === 0; up.onclick = mv(-1);
  const dn = el('button', 'cmp-mini lib-down', gi('arrow-down')); dn.title = t('ui.lib.moveDown'); dn.disabled = ids.indexOf(it.id) === ids.length - 1; dn.onclick = mv(1);
  ord.append(up, dn);

  // ธงหน้าปกเล่ม (ใช้หน้าปก · เต็มหน้า)
  const flags = el('div', 'book-cover-flags');
  const mkFlag = (labelKey, curV, save) => {
    const lb = el('label', 'chapter-cover-on');
    const c = el('input', null); c.type = 'checkbox'; c.checked = curV;
    c.onchange = async () => { s.meta = await saveSectionMeta(s.sf, save(c.checked)); bumpBookFlow(); };
    lb.append(c, document.createTextNode(' ' + t(labelKey)));
    flags.append(lb);
  };
  mkFlag('ui.section.useCover', s.meta.coverOn === undefined ? true : !!s.meta.coverOn, (v) => ({ coverOn: v }));
  mkFlag('ui.section.useCoverFull', s.meta.coverFull === undefined ? true : !!s.meta.coverFull, (v) => ({ coverFull: v }));

  detail.append(metaRows([
    [t('ui.lib.metaOrder'), ord],
    [t('ui.lib.metaFolder'), s.folder],
    [t('ui.lib.metaUpdated'), it.updated ? fmtDateTime(it.updated) : '—'],
    [t('ui.lib.metaCover'), flags],
  ]));
  detail.append(el('div', 'k-hint lib-cover-hint', coverHintLine()));

  const draftsBox = el('div', 'drafts-box');
  detail.append(draftsBox);
  await renderDraftList(s, draftsBox).catch(() => {});

  // ปุ่มจัดการ
  const acts = el('div', 'book-acts lib-acts');
  const openB = el('button', 'k-ok', gi('file') + ' ' + t('ui.books.open'));
  openB.onclick = () => openFirstSceneOf(s.secPath);
  // [alpha.141] อ่านทั้งเล่ม (หน้าปก → หน้าสุดท้าย) + จัดการบทของเล่มนี้
  const readB = el('button', 'cmp-mini book-read', gi('book-open') + ' ' + t('ui.readbook.button'));
  readB.onclick = () => openBookReader(s.secPath);
  const chB = el('button', 'cmp-mini book-chapters', t('ui.chapters.title'));
  chB.onclick = () => openChapterManager(s.secPath);
  // [alpha.159] รายชื่อตัวละคร (ของเล่มนี้) + หน้าปก — เดิมเข้าได้จากเมนูบทภาพยนตร์ทางเดียว
  const castB = el('button', 'cmp-mini book-cast', t('ui.treeMenu.castOfCharacters'));
  castB.onclick = async () => { const { openRoster } = await import('./roster-ui.js'); openRoster(s.secPath, s.title); };
  const tpB = el('button', 'cmp-mini book-titlepage', t('ui.treeMenu.titlePage'));
  tpB.onclick = async () => { const { openTitlePageDialog } = await import('./pdf-ui.js'); openTitlePageDialog(); };
  const expB = el('button', 'cmp-mini', t('ui.books.export'));
  expB.onclick = () => openCompileDialog();
  const delB = el('button', 'cmp-mini k-danger', gi('trash') + ' ' + t('ui.common.del2'));
  delB.onclick = async () => { await deleteSection(s.secPath, s.meta); redraw(); };
  acts.append(openB, readB, chB, castB, tpB, expB, delB);
  detail.append(acts);
}

/** รายการร่างของเล่ม (ในแผงรายละเอียด) */
async function renderDraftList(sec, dst) {
  dst.innerHTML = '';
  const drafts = await listDraftsForSection(sec.secPath);
  const list = el('div', 'book-drafts');
  list.append(el('div', 'book-drafts-head', t('ui.books.draft2') + (drafts.length ? ` (${drafts.length})` : '')));
  for (const d of drafts) {
    const row = el('div', 'book-draft-row' + (d.primary ? ' draft-primary' : ''));
    row.append(el('span', 'book-draft-name', (d.primary ? gi('star-filled') + ' ' : '   ') + d.name));
    if (!d.primary) {
      const setBtn = el('button', 'cmp-mini', t('ui.books.setMain'));
      setBtn.onclick = async () => {
        await setPrimaryDraft(sec.secPath, d.name);
        renderDraftList(sec, dst);
        // [alpha.125 ข้อ I] ★ Explorer แสดง **เฉพาะร่างหลัก** — เปลี่ยนร่างหลักแล้วต้องวาดต้นไม้ใหม่
        try { await buildTree(); } catch {}
        setStatus(t('ui.books.setDraftMain') + d.name);
      };
      row.append(setBtn);
    }
    const renBtn = el('button', 'cmp-mini', gi('pencil-thin'));
    renBtn.title = t('ui.books.changeNameDraft');
    renBtn.onclick = async () => {
      const n = await ask(t('ui.books.nameDraftNew'), { value: d.name });
      if (n && n !== d.name && await renameDraft(sec.secPath, d.name, n)) {
        renderDraftList(sec, dst);
        try { await buildTree(); } catch {}
      }
    };
    row.append(renBtn);
    if (!d.primary) {
      const delBtn = el('button', 'cmp-mini k-danger', gi('trash'));
      delBtn.title = t('ui.books.delDraft');
      delBtn.onclick = async () => {
        if (await deleteDraft(sec.secPath, d.name)) { renderDraftList(sec, dst); try { await buildTree(); } catch {} }
      };
      row.append(delBtn);
    }
    list.append(row);
  }
  const addD = el('button', 'cmp-mini', t('ui.books.newDraftNew2'));
  addD.onclick = async () => {
    const n = await ask(t('ui.books.nameDraftNew'), { placeholder: t('ui.books.egDraft') });
    if (!n) return;
    const src = await ask(t('ui.books.outlineDraftEmptyNew'), { placeholder: drafts.length ? drafts[0].name : '' });
    try {
      await createDraft(sec.secPath, n, src || null);
      renderDraftList(sec, dst);
      setStatus(t('ui.books.newDraftNew') + n);
    } catch (e) { setStatusError(errText(e)); }
  };
  list.append(addD);
  dst.append(list);
}
