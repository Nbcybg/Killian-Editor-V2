// books.js — ตัวจัดการเล่ม/ร่าง (Book Manager): เพิ่ม/แก้/ลบ/เรียงเล่มและร่าง
import { t, tf } from './i18n.js';
import { SECTION_STATUSES, buildTree, openCompileDialog, openFirstSceneOf, resolveImg } from './app.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { addSection, deleteSection, listSections, reorderSections, saveSectionMeta, sectionStats } from './section-ops.js';
import { $, el, setStatus, state } from './core.js';
import { pickImage } from './gallery.js';
import { popupMenu, ask } from './ui.js';
import { listDraftsForSection, createDraft, deleteDraft, renameDraft, setPrimaryDraft } from './drafts.js';
// [alpha.141] อ่านทั้งเล่ม + จัดการบท — ผู้ใช้ขอให้มีทางเข้าจากหน้าจัดการเล่มด้วย
import { openBookReader, bumpBookFlow } from './read-ui.js';
import { openChapterManager, coverHintLine } from './chapters-ui.js';

// บั๊ก #18: จัดการเล่มเป็นแผง ไม่ใช่แท็บเอกสาร
export async function openBookManager() {
  showPanel('books');
  return renderBookManager($('#books-body'));
}
export function refreshBooksIfOpen() {
  if (isPanelOpen('books') && $('#books-body')) renderBookManager($('#books-body'));
}

export async function renderBookManager(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'books-wrap'); pane.append(wrap);
  const head = el('div', 'books-head');
  head.append(el('div', 'books-title', t('ui.books.bookAllProject')));
  const addBtn = el('button', 'k-ok', t('ui.books.addBook'));
  addBtn.onclick = async () => { await addSection(); renderBookManager(pane); };
  head.append(addBtn);
  const readAllBtn = el('button', 'cmp-mini', t('ui.readbook.buttonAll'));
  readAllBtn.onclick = () => openBookReader('');           // '' = ทั้งโปรเจกต์
  head.append(readAllBtn);
  wrap.append(head);

  // [alpha.142 ข้อ 3] ขนาด/อัตราส่วนรูปปกที่แนะนำ — ตามกระดาษที่ตั้งไว้จริง
  wrap.append(el('div', 'k-hint chapters-hint', coverHintLine()));

  const sections = await listSections();
  const grid = el('div', 'books-grid'); wrap.append(grid);

  const statusOf = (k) => SECTION_STATUSES.find((s) => s[0] === k) || SECTION_STATUSES[0];

  const renderDraftList = async (sec, dst) => {
    dst.innerHTML = '';
    const drafts = await listDraftsForSection(sec.secPath);
    const list = el('div', 'book-drafts');
    const hdr = el('div', 'book-drafts-head',
      t('ui.books.draft2') + (drafts.length ? ` (${drafts.length})` : ''));
    list.append(hdr);

    for (const d of drafts) {
      const row = el('div', 'book-draft-row' + (d.primary ? ' draft-primary' : ''));
      const label = el('span', 'book-draft-name',
        (d.primary ? '★ ' : '   ') + d.name);
      row.append(label);

      if (!d.primary) {
        const setBtn = el('button', 'cmp-mini', t('ui.books.setMain'));
        setBtn.onclick = async () => {
          await setPrimaryDraft(sec.secPath, d.name);
          renderDraftList(sec, dst);
          // [alpha.125 ข้อ I] ★ Explorer แสดง **เฉพาะร่างหลัก** — เปลี่ยนร่างหลักแล้วไม่วาดใหม่
          // = ผู้ใช้สลับร่างสำเร็จแต่ต้นไม้ยังเป็นของเก่า ดูเหมือนกดแล้วไม่มีอะไรเกิดขึ้น
          try { const { buildTree } = await import('./app.js'); await buildTree(); } catch {}
          setStatus(t('ui.books.setDraftMain') + d.name);
        };
        row.append(setBtn);
      }
      const renBtn = el('button', 'cmp-mini', '✎');
      renBtn.title = t('ui.books.changeNameDraft');
      renBtn.onclick = async () => {
        const n = await ask(t('ui.books.nameDraftNew'), { value: d.name });
        if (n && n !== d.name) {
          if (await renameDraft(sec.secPath, d.name, n)) {
            renderDraftList(sec, dst);
            try { const { buildTree } = await import('./app.js'); await buildTree(); } catch {}
          }
        }
      };
      row.append(renBtn);
      if (!d.primary) {
        const delBtn = el('button', 'cmp-mini k-danger', '🗑');
        delBtn.title = t('ui.books.delDraft');
        delBtn.onclick = async () => {
          if (await deleteDraft(sec.secPath, d.name)) {
            renderDraftList(sec, dst);
            try { const { buildTree } = await import('./app.js'); await buildTree(); } catch {}
          }
        };
        row.append(delBtn);
      }
      list.append(row);
    }

    const addD = el('button', 'cmp-mini', t('ui.books.newDraftNew2'));
    addD.onclick = async () => {
      const n = await ask(t('ui.books.nameDraftNew'), { placeholder: t('ui.books.egDraft') });
      if (!n) return;
      // ถ้ามีร่างอยู่แล้ว ให้เลือกสำเนาจากใคร
      const src = await ask(t('ui.books.outlineDraftEmptyNew'),
        { placeholder: drafts.length ? drafts[0].name : '' });
      try {
        await createDraft(sec.secPath, n, src || null);
        renderDraftList(sec, dst);
        setStatus(t('ui.books.newDraftNew') + n);
      } catch (e) { setStatus(e.message); }
    };
    list.append(addD);
    dst.append(list);
  };

  for (const s of sections) {
    const card = el('div', 'book-card');
    card.draggable = true;
    card.dataset.folder = s.folder;

    // ---- ปก ----
    const cover = el('div', 'book-cover');
    const applyCover = (rel) => {
      cover.innerHTML = '';
      if (rel) {
        const img = el('img'); img.src = resolveImg(s.secPath, rel);
        cover.append(img); cover.classList.remove('book-cover-empty');
      } else {
        cover.classList.add('book-cover-empty');
        cover.append(el('div', 'book-cover-ph', '📖'));
      }
    };
    applyCover(s.meta.cover);
    const coverBtns = el('div', 'book-cover-btns');
    const pickCover = el('button', 'cmp-mini', t('ui.books.pickCover'));
    pickCover.onclick = async () => {
      const it = await pickImage(state.root);
      if (!it) return;
      // เก็บ path แบบสัมพัทธ์กับโฟลเดอร์เล่ม (รูปอยู่ใน <root>/Images)
      const rel = '../Images/' + it.file;
      s.meta = await saveSectionMeta(s.sf, { cover: rel });
      applyCover(rel); setStatus(t('ui.books.setCoverBookDone'));
    };
    coverBtns.append(pickCover);
    if (s.meta.cover) {
      const clr = el('button', 'cmp-mini', '✕');
      clr.title = t('ui.books.coverOut');
      clr.onclick = async () => { s.meta = await saveSectionMeta(s.sf, { cover: '' }); applyCover(''); coverBtns.removeChild(clr); };
      coverBtns.append(clr);
    }
    cover.append(coverBtns);
    card.append(cover);

    // ---- เนื้อการ์ด ----
    const bd = el('div', 'book-body'); card.append(bd);

    const titleInp = el('input', 'book-title-inp'); titleInp.value = s.title;
    titleInp.onchange = async () => {
      const v = titleInp.value.trim(); if (!v || v === s.title) { titleInp.value = s.title; return; }
      s.meta = await saveSectionMeta(s.sf, { title: v }); s.title = v;
      await buildTree(); setStatus(t('ui.books.changeNameBookDone'));
    };
    bd.append(titleInp);

    // สถานะเล่ม
    const stRow = el('div', 'book-status-row');
    const cur = statusOf(s.meta.status);
    const pill = el('span', 'book-status-pill'); pill.textContent = cur[1];
    pill.style.background = cur[2];
    pill.onclick = (e) => {
      popupMenu(e.clientX, e.clientY, SECTION_STATUSES.map(([k, label, color]) => ({
        label: (k === (s.meta.status || 'outline') ? '● ' : '   ') + label,
        click: async () => { s.meta = await saveSectionMeta(s.sf, { status: k });
          pill.textContent = label; pill.style.background = color; },
      })));
    };
    stRow.append(pill);
    bd.append(stRow);

    // ★ [alpha.142 ข้อ 1] ใช้หน้าปกเล่ม / ใช้ภาพเต็มหน้า — ติ๊กได้จากหน้านี้เลย
    // (เดิมต้องเปิดกล่องคุณสมบัติเล่มถึงจะเจอ ทั้งที่รูปปกเลือกกันที่นี่)
    const covRow = el('div', 'book-cover-flags');
    const mkFlag = (labelKey, cur, save) => {
      const lb = el('label', 'chapter-cover-on');
      const c = el('input', null); c.type = 'checkbox'; c.checked = cur;
      c.onchange = async () => { s.meta = await saveSectionMeta(s.sf, save(c.checked)); bumpBookFlow(); };
      lb.append(c, document.createTextNode(' ' + t(labelKey)));
      covRow.append(lb); return c;
    };
    mkFlag('ui.section.useCover', s.meta.coverOn === undefined ? true : !!s.meta.coverOn,
           (v) => ({ coverOn: v }));
    mkFlag('ui.section.useCoverFull', s.meta.coverFull === undefined ? true : !!s.meta.coverFull,
           (v) => ({ coverFull: v }));
    bd.append(covRow);

    // คำโปรย
    const blurb = el('textarea', 'book-blurb'); blurb.placeholder = t('ui.books.wordSynopsisBook');
    blurb.value = s.meta.blurb || '';
    blurb.onchange = async () => { s.meta = await saveSectionMeta(s.sf, { blurb: blurb.value }); };
    bd.append(blurb);

    // สถิติ
    const stats = el('div', 'book-stats', '…'); bd.append(stats);
    // รายการร่าง
    const draftsBox = el('div', 'drafts-box'); bd.append(draftsBox);
    sectionStats(s.secPath).then((st) => {
      stats.textContent = tf('ui.books.chapterSceneWord', st.chapters, st.scenes, st.words.toLocaleString())
        + (st.drafts > 1 ? tf('ui.books.draft', st.drafts) : '');
      renderDraftList(s, draftsBox);
    });

    // ปุ่มจัดการ
    const acts = el('div', 'book-acts');
    const openB = el('button', 'cmp-mini', t('ui.books.open'));
    openB.onclick = () => openFirstSceneOf(s.secPath);
    // [alpha.141] อ่านทั้งเล่ม (หน้าปก → หน้าสุดท้าย) + จัดการบทของเล่มนี้
    const readB = el('button', 'cmp-mini book-read', t('ui.readbook.button'));
    readB.onclick = () => openBookReader(s.secPath);
    const chB = el('button', 'cmp-mini book-chapters', t('ui.chapters.title'));
    chB.onclick = () => openChapterManager(s.secPath);
    const expB = el('button', 'cmp-mini', t('ui.books.export'));
    expB.onclick = () => openCompileDialog();
    const delB = el('button', 'cmp-mini k-danger', t('ui.common.del2'));
    delB.onclick = async () => { await deleteSection(s.secPath, s.meta); renderBookManager(pane); };
    acts.append(openB, readB, chB, expB, delB);
    bd.append(acts);

    // ---- ลากสลับลำดับเล่ม ----
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/k2-book', s.folder);
      card.classList.add('book-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('book-dragging'));
    card.addEventListener('dragover', (e) => {
      if ([...e.dataTransfer.types].includes('text/k2-book')) { e.preventDefault(); card.classList.add('book-drop'); } });
    card.addEventListener('dragleave', () => card.classList.remove('book-drop'));
    card.addEventListener('drop', async (e) => {
      card.classList.remove('book-drop');
      const from = e.dataTransfer.getData('text/k2-book');
      if (!from || from === s.folder) return;
      e.preventDefault();
      await reorderSections(from, s.folder);
      renderBookManager(pane);
    });

    grid.append(card);
  }

  if (!sections.length) grid.append(el('div', 'books-empty', t('ui.books.notHasBookPress')));
}
