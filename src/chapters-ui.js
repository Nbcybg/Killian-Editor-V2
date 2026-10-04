// chapters-ui.js — [alpha.141] "จัดการบท" — คู่แฝดของ "จัดการเล่ม" ที่หายไปตั้งแต่ alpha.32
//
// ผู้ใช้: *"เรามีจัดการเล่ม แต่ไม่มีจัดการบท เพิ่มด้วย เหมือนเดิม มีหน้าปก จะเป็นรูปหรือเป็น text ก็ได้
//          ตอนพิมพ์หรือ export จะใส่หรือไม่ใส่ก็ได้ … ให้ติ๊กเลย ถ้ามี หน้าปกของบทต้องถูกนับเป็นหน้าด้วย"*
//
// หน้าปกบทเก็บที่ `draft.json → chapters[].cover = {on, image, text}` · การ **นับเป็นหน้า** ไม่ได้ทำที่นี่ —
// `book-flow.js` เป็นคนตัดสิน (กฎถาวรข้อ 5: ห้ามมีตัวคิดลำดับหน้าตัวที่สอง)
//
// [alpha.168] หน้าตาแบบห้องสมุดเหมือนจัดการเล่ม: ตารางปกบทซ้าย · แผงรายละเอียดขวา · ลากเรียงด้วยเมาส์ + เส้นแทรก

import { t, tf } from './i18n.js';
import { openFirstSceneOf, openScene, resolveImg, spFormat } from './app.js';
import { $, el, setStatus, state } from './core.js';
import { coverImageHint, normChapterCover } from './book-flow.js';
import { listSections } from './section-ops.js';
import { listDraftsForSection } from './drafts.js';
import { addChapter, chapterProps, chapterStats, deleteChapter, listChapters,
         moveChapterBefore, renumberChapters, saveChapterMeta, setChapterTitle } from './scene-ops.js';
import { isPanelOpen, showPanel } from './panels/panel-ui.js';
import { pickImage } from './gallery.js';
import { openBookReader, bumpBookFlow } from './read-ui.js';
import { gi } from './icons.js';
import { fmtNum, cmpText } from './locale.js';
import { libraryList, canReorder, stepTarget } from './library-view.js';
import { libShell, coverArt, libToolbar, statTiles, metaRows, bindReorder, SORT_KEYS } from './library-ui.js';

// เล่มที่กำลังดูอยู่ + สภาพหน้าจอ (ไม่เขียนลงไฟล์)
const CH_UI = { secPath: '', dPath: '', sel: '', q: '', sort: 'order', dir: 'asc', view: 'grid' };

export async function openChapterManager(secPath) {
  if (secPath) CH_UI.secPath = secPath;
  showPanel('chapters');
  return renderChapterManager($('#chapters-body'));
}
export function refreshChaptersIfOpen() {
  if (isPanelOpen('chapters') && $('#chapters-body')) renderChapterManager($('#chapters-body'));
}

/** ร่างหลักของเล่ม — จัดการบทต้องแก้บทของร่างเดียวกับที่ Explorer แสดง */
async function primaryDraft(secPath) {
  const list = await listDraftsForSection(secPath);
  if (!list.length) return '';
  return (list.find((d) => d.primary) || list[0]).dPath;
}

/** ข้อความ hint ขนาดรูปปก — สร้างจากขนาดกระดาษ/ระยะขอบที่ใช้อยู่จริง (ไม่ใช่ค่าตายตัว) */
export function coverHintLine() {
  const f = spFormat();
  const h = coverImageHint(f.paper, f.margins);
  return tf('ui.chapters.sizeHint', h.wPx, h.hPx, h.dpi, h.ratio.toFixed(2), h.wIn, h.hIn);
}

let _seq = 0;
export async function renderChapterManager(pane) {
  if (!pane) return;
  const seq = ++_seq;
  const sections = await listSections();
  const redraw = () => renderChapterManager(pane);
  const { root, main, detail } = libShell('chapters-lib');

  const head = el('div', 'lib-head books-head');
  head.append(el('div', 'lib-title books-title', t('ui.chapters.title')));
  const pick = el('select', 'chapters-book k-dlg-select');
  pick.title = t('ui.lib.pickBookTip');
  head.append(pick, el('span', 'lib-sp'));
  const readBtn = el('button', 'cmp-mini', gi('book-open') + ' ' + t('ui.readbook.button'));
  const numBtn = el('button', 'cmp-mini', t('ui.chapters.renumber'));
  numBtn.title = t('ui.lib.renumberTip');
  const addBtn = el('button', 'k-ok', t('ui.chapters.addChapter'));
  head.append(readBtn, numBtn, addBtn);
  main.append(head);

  if (!sections.length) { main.append(el('div', 'books-empty', t('ui.chapters.noBook'))); pane.replaceChildren(root); return; }
  if (!sections.some((s) => s.secPath === CH_UI.secPath)) CH_UI.secPath = sections[0].secPath;
  for (const s of sections) {
    const o = el('option', null, s.title || s.folder); o.value = s.secPath;
    if (s.secPath === CH_UI.secPath) o.selected = true;
    pick.append(o);
  }
  pick.onchange = () => { CH_UI.secPath = pick.value; CH_UI.sel = ''; redraw(); };

  const dPath = await primaryDraft(CH_UI.secPath);
  CH_UI.dPath = dPath;
  readBtn.onclick = () => openBookReader(CH_UI.secPath);
  addBtn.onclick = async () => { if (dPath) { await addChapter(dPath); redraw(); } };
  numBtn.onclick = async () => { if (dPath) { await renumberChapters(dPath); redraw(); } };
  if (!dPath) { main.append(el('div', 'books-empty', t('ui.chapters.noDraft'))); pane.replaceChildren(root); return; }

  const chapters = await listChapters(dPath);
  const stats = await Promise.all(chapters.map((ch) => chapterStats(dPath, ch).catch(() => ({ scenes: 0, words: 0 }))));
  let scenesAll = {};
  try { scenesAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {}; } catch {}
  if (seq !== _seq) return;
  const items = chapters.map((ch, i) => ({ id: ch.guid, title: ch.title || '', order: ch.order || i + 1, words: stats[i].words, ch, st: stats[i], cov: normChapterCover(ch) }));
  if (!items.some((x) => x.id === CH_UI.sel)) CH_UI.sel = items[0] ? items[0].id : '';

  const row2 = el('div', 'lib-row2');
  // [alpha.168] คำอธิบายหน้าปกย้ายไปอยู่ข้างช่องติ๊กหน้าปกในแผงรายละเอียด (ตรงที่ใช้จริง)
  row2.append(libToolbar(CH_UI, { sorts: ['order', 'title', 'words'], onChange: redraw, ph: t('ui.lib.searchChaptersPh') }));
  main.append(row2);
  const reorderOk = canReorder(CH_UI);
  main.append(el('div', 'lib-hint', reorderOk ? t('ui.lib.reorderHintChapters') : tf('ui.lib.reorderOffHint', t(SORT_KEYS[CH_UI.sort] || SORT_KEYS.order))));

  const shown = libraryList(items, { ...CH_UI, cmpText });
  const grid = el('div', 'lib-grid books-grid chapters-grid' + (CH_UI.view === 'list' ? ' lib-list' : ''));
  const ordIds = items.slice().sort((a, b) => a.order - b.order).map((x) => x.id);
  for (const it of shown) {
    const num = ordIds.indexOf(it.id) + 1;
    const card = el('div', 'book-card chapter-card ' + (CH_UI.view === 'list' ? 'lib-lrow' : 'lib-card') + (it.id === CH_UI.sel ? ' on' : ''));
    card.dataset.guid = it.id; card.dataset.libId = it.id;
    if (CH_UI.view === 'list') card.append(el('span', 'lib-grip', gi('grip-dots')));
    const art = coverArt({ url: it.cov.on && it.cov.image ? resolveImg(state.root, it.cov.image) : '',
      text: it.cov.on && !it.cov.image ? it.cov.text : '', title: it.title, off: !it.cov.on, num: CH_UI.view === 'list' ? '' : num });
    card.append(art);
    const cap = el('div', CH_UI.view === 'list' ? 'lib-lrow-main' : 'lib-cap');
    cap.append(el('div', 'lib-card-title', it.title || t('ui.common.notNamed')));
    cap.append(el('div', 'lib-card-sub book-stats', tf('ui.chapters.sceneWord', it.st.scenes, fmtNum(it.st.words))));
    card.append(cap);
    if (CH_UI.view !== 'list') cap.append(el('span', 'lib-chip lib-chip-soft' + (it.cov.on ? ' on' : ''), it.cov.on ? t('ui.lib.coverOn') : t('ui.lib.coverOff')));
    card.title = (it.title || '') + '\n' + t('ui.lib.cardTip');
    card.onclick = () => { if (CH_UI.sel !== it.id) { CH_UI.sel = it.id; redraw(); } };
    card.ondblclick = () => openChapterFirst(it);
    grid.append(card);
  }
  if (!items.length) grid.append(el('div', 'books-empty', t('ui.chapters.empty')));
  else if (!shown.length) grid.append(el('div', 'lib-none', t('ui.lib.noMatch')));
  main.append(grid);
  bindReorder(grid, {
    items: () => [...grid.querySelectorAll('[data-lib-id]')],
    idOf: (c) => c.dataset.libId,
    enabled: () => canReorder(CH_UI),
    onMove: async (from, before) => { await moveChapterBefore(dPath, from, before); bumpBookFlow(); redraw(); },
  });

  const cur = items.find((x) => x.id === CH_UI.sel);
  if (cur) buildChapterDetail(detail, cur, ordIds, dPath, redraw, openChapterFirst);
  else detail.append(el('div', 'lib-none', t('ui.lib.pickOne')));
  const keepGrid = pane.querySelector('.lib-grid') ? pane.querySelector('.lib-grid').scrollTop : 0;
  const keepOuter = pane.querySelector('.lib') ? pane.querySelector('.lib').scrollTop : 0;   // แผงแคบ = ทั้งก้อนเลื่อน
  pane.replaceChildren(root);
  if (keepGrid) { const g = pane.querySelector('.lib-grid'); if (g) g.scrollTop = keepGrid; }
  if (keepOuter) root.scrollTop = keepOuter;

  async function openChapterFirst(it) {
    const first = (scenesAll[it.id] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    if (!first) { await openFirstSceneOf(CH_UI.secPath); return; }
    openScene(await kapi.join(dPath, 'Chapters', it.ch.folderName, first.fileName), first.title);
  }
}

function buildChapterDetail(detail, it, ordIds, dPath, redraw, openFirst) {
  const ch = it.ch, cov = it.cov;
  detail.classList.add('chapter-detail');
  detail.dataset.guid = it.id;
  const art = coverArt({ url: cov.on && cov.image ? resolveImg(state.root, cov.image) : '', text: cov.on && !cov.image ? cov.text : '', title: it.title, off: !cov.on });
  art.classList.add('lib-dcover');
  const btns = el('div', 'book-cover-btns lib-cover-btns');
  const pickBtn = el('button', 'cmp-mini', gi('image') + ' ' + t('ui.chapters.coverPick'));
  pickBtn.onclick = async () => {
    const im = await pickImage(state.root);
    if (!im) return;
    cov.image = 'Images/' + im.file; cov.on = true;
    await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
    bumpBookFlow(); setStatus(t('ui.chapters.coverSetDone')); redraw();
  };
  const clrBtn = el('button', 'cmp-mini', gi('close'));
  clrBtn.title = t('ui.chapters.coverClear');
  clrBtn.onclick = async () => { cov.image = ''; await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } }); bumpBookFlow(); redraw(); };
  btns.append(pickBtn, clrBtn);
  art.append(btns);
  detail.append(art);

  // ชื่อบท (แก้ในที่)
  const titleInp = el('input', 'book-title-inp lib-dtitle'); titleInp.value = ch.title || '';
  titleInp.title = t('ui.lib.renameTip');
  titleInp.onchange = async () => {
    const v = titleInp.value.trim();
    if (!v || v === ch.title) { titleInp.value = ch.title || ''; return; }
    await setChapterTitle(dPath, ch, v); ch.title = v;
    bumpBookFlow(); setStatus(t('ui.chapters.renameDone')); redraw();
  };
  detail.append(titleInp);

  detail.append(statTiles([
    { label: t('ui.lib.statNo'), value: String(ordIds.indexOf(it.id) + 1) },
    { label: t('ui.lib.statScenes'), value: fmtNum(it.st.scenes) },
    { label: t('ui.lib.statWords'), value: fmtNum(it.st.words) },
  ]));

  // ★ หน้าปกบท — ติ๊กใช้ · ภาพเต็มหน้า · ข้อความบนปก
  const box = el('div', 'lib-sec');
  box.append(el('div', 'lib-sec-h', t('ui.lib.chapterCover')));
  const chkRow = el('label', 'chapter-cover-on');
  const chk = el('input', null); chk.type = 'checkbox'; chk.checked = !!cov.on;
  chk.onchange = async () => {
    cov.on = chk.checked;
    await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
    bumpBookFlow();
    setStatus(chk.checked ? t('ui.chapters.coverOnDone') : t('ui.chapters.coverOffDone'));
    redraw();
  };
  chkRow.append(chk, document.createTextNode(' ' + t('ui.chapters.useCover')));
  const fullRow = el('label', 'chapter-cover-on');
  const fullChk = el('input', null); fullChk.type = 'checkbox'; fullChk.checked = cov.full !== false;
  fullChk.title = t('ui.chapters.useFullHint');
  fullChk.onchange = async () => {
    cov.full = fullChk.checked;
    await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
    bumpBookFlow();
    setStatus(fullChk.checked ? t('ui.chapters.fullOnDone') : t('ui.chapters.fullOffDone'));
  };
  fullRow.append(fullChk, document.createTextNode(' ' + t('ui.chapters.useFull')));
  const txt = el('textarea', 'book-blurb chapter-cover-txt');
  txt.placeholder = t('ui.chapters.coverTextPh');
  txt.value = cov.text || '';
  txt.onchange = async () => { cov.text = txt.value; await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } }); bumpBookFlow(); };
  box.append(chkRow, fullRow, txt, el('div', 'k-hint chapters-hint', t('ui.chapters.coverHint')), el('div', 'k-hint', coverHintLine()));
  detail.append(box);

  // ลำดับ ขึ้น/ลง
  const ord = el('div', 'lib-order');
  ord.append(el('b', null, '#' + (ordIds.indexOf(it.id) + 1)), el('span', 'dim', ' / ' + ordIds.length));
  const mv = (dir) => async () => { const tg = stepTarget(ordIds, it.id, dir); if (!tg) return; await moveChapterBefore(dPath, it.id, tg.beforeId); bumpBookFlow(); redraw(); };
  const up = el('button', 'cmp-mini lib-up', gi('arrow-up')); up.title = t('ui.lib.moveUp'); up.disabled = ordIds.indexOf(it.id) === 0; up.onclick = mv(-1);
  const dn = el('button', 'cmp-mini lib-down', gi('arrow-down')); dn.title = t('ui.lib.moveDown'); dn.disabled = ordIds.indexOf(it.id) === ordIds.length - 1; dn.onclick = mv(1);
  ord.append(up, dn);
  detail.append(metaRows([[t('ui.lib.metaOrder'), ord], [t('ui.lib.metaFolder'), ch.folderName || '—']]));

  const acts = el('div', 'book-acts lib-acts');
  const openB = el('button', 'k-ok', gi('file') + ' ' + t('ui.chapters.open'));
  openB.onclick = () => openFirst(it);
  const propB = el('button', 'cmp-mini', t('ui.chapters.props'));
  propB.onclick = async () => { if (await chapterProps(dPath, ch)) redraw(); };
  const delB = el('button', 'cmp-mini k-danger', gi('trash') + ' ' + t('ui.common.del2'));
  delB.onclick = async () => { await deleteChapter(dPath, ch); bumpBookFlow(); redraw(); };
  acts.append(openB, propB, delB);
  detail.append(acts);
}
