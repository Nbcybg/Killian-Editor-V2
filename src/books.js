// books.js — ตัวจัดการเล่ม/ร่าง (Book Manager): เพิ่ม/แก้/ลบ/เรียงเล่มและร่าง
import { T } from './i18n.js';
import { SECTION_STATUSES, buildTree, openCompileDialog, openFirstSceneOf, resolveImg } from './app.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { addSection, deleteSection, listSections, reorderSections, saveSectionMeta, sectionStats } from './section-ops.js';
import { $, el, setStatus, state } from './core.js';
import { pickImage } from './gallery.js';
import { popupMenu, ask } from './ui.js';
import { listDraftsForSection, createDraft, deleteDraft, renameDraft, setPrimaryDraft } from './drafts.js';

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
  head.append(el('div', 'books-title', T`📚 เล่มทั้งหมดในโปรเจกต์`));
  const addBtn = el('button', 'k-ok', T`＋ เพิ่มเล่ม`);
  addBtn.onclick = async () => { await addSection(); renderBookManager(pane); };
  head.append(addBtn);
  wrap.append(head);

  const sections = await listSections();
  const grid = el('div', 'books-grid'); wrap.append(grid);

  const statusOf = (k) => SECTION_STATUSES.find((s) => s[0] === k) || SECTION_STATUSES[0];

  const renderDraftList = async (sec, dst) => {
    dst.innerHTML = '';
    const drafts = await listDraftsForSection(sec.secPath);
    const list = el('div', 'book-drafts');
    const hdr = el('div', 'book-drafts-head',
      T`📝 ฉบับร่าง` + (drafts.length ? ` (${drafts.length})` : ''));
    list.append(hdr);

    for (const d of drafts) {
      const row = el('div', 'book-draft-row' + (d.primary ? ' draft-primary' : ''));
      const label = el('span', 'book-draft-name',
        (d.primary ? '★ ' : '   ') + d.name);
      row.append(label);

      if (!d.primary) {
        const setBtn = el('button', 'cmp-mini', T`ตั้งหลัก`);
        setBtn.onclick = async () => {
          await setPrimaryDraft(sec.secPath, d.name);
          renderDraftList(sec, dst);
          setStatus(T`ตั้งร่างหลักเป็น: ` + d.name);
        };
        row.append(setBtn);
      }
      const renBtn = el('button', 'cmp-mini', '✎');
      renBtn.title = T`เปลี่ยนชื่อร่าง`;
      renBtn.onclick = async () => {
        const n = await ask(T`ชื่อร่างใหม่`, { value: d.name });
        if (n && n !== d.name) {
          if (await renameDraft(sec.secPath, d.name, n))
            renderDraftList(sec, dst);
        }
      };
      row.append(renBtn);
      if (!d.primary) {
        const delBtn = el('button', 'cmp-mini k-danger', '🗑');
        delBtn.title = T`ลบร่างนี้`;
        delBtn.onclick = async () => {
          if (await deleteDraft(sec.secPath, d.name))
            renderDraftList(sec, dst);
        };
        row.append(delBtn);
      }
      list.append(row);
    }

    const addD = el('button', 'cmp-mini', T`＋ สร้างร่างใหม่`);
    addD.onclick = async () => {
      const n = await ask(T`ชื่อร่างใหม่`, { placeholder: T`เช่น draft-2` });
      if (!n) return;
      // ถ้ามีร่างอยู่แล้ว ให้เลือกสำเนาจากใคร
      const src = await ask(T`ก๊อบโครงจากร่างไหน ? (ว่าง = สร้างเปล่า)`,
        { placeholder: drafts.length ? drafts[0].name : '' });
      try {
        await createDraft(sec.secPath, n, src || null);
        renderDraftList(sec, dst);
        setStatus(T`สร้างร่างใหม่: ` + n);
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
    const pickCover = el('button', 'cmp-mini', T`🖼 เลือกปก`);
    pickCover.onclick = async () => {
      const it = await pickImage(state.root);
      if (!it) return;
      // เก็บ path แบบสัมพัทธ์กับโฟลเดอร์เล่ม (รูปอยู่ใน <root>/Images)
      const rel = '../Images/' + it.file;
      s.meta = await saveSectionMeta(s.sf, { cover: rel });
      applyCover(rel); setStatus(T`ตั้งปกเล่มแล้ว`);
    };
    coverBtns.append(pickCover);
    if (s.meta.cover) {
      const clr = el('button', 'cmp-mini', '✕');
      clr.title = T`เอาปกออก`;
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
      await buildTree(); setStatus(T`เปลี่ยนชื่อเล่มแล้ว`);
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

    // คำโปรย
    const blurb = el('textarea', 'book-blurb'); blurb.placeholder = T`คำโปรย / เรื่องย่อของเล่มนี้…`;
    blurb.value = s.meta.blurb || '';
    blurb.onchange = async () => { s.meta = await saveSectionMeta(s.sf, { blurb: blurb.value }); };
    bd.append(blurb);

    // สถิติ
    const stats = el('div', 'book-stats', '…'); bd.append(stats);
    // รายการร่าง
    const draftsBox = el('div', 'drafts-box'); bd.append(draftsBox);
    sectionStats(s.secPath).then((st) => {
      stats.textContent = T`${st.chapters} บท · ${st.scenes} ฉาก · ${st.words.toLocaleString()} คำ`
        + (st.drafts > 1 ? T` · ${st.drafts} ฉบับร่าง` : '');
      renderDraftList(s, draftsBox);
    });

    // ปุ่มจัดการ
    const acts = el('div', 'book-acts');
    const openB = el('button', 'cmp-mini', T`📂 เปิด`);
    openB.onclick = () => openFirstSceneOf(s.secPath);
    const expB = el('button', 'cmp-mini', T`📤 ส่งออก`);
    expB.onclick = () => openCompileDialog();
    const delB = el('button', 'cmp-mini k-danger', T`🗑 ลบ`);
    delB.onclick = async () => { await deleteSection(s.secPath, s.meta); renderBookManager(pane); };
    acts.append(openB, expB, delB);
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

  if (!sections.length) grid.append(el('div', 'books-empty', T`ยังไม่มีเล่ม — กด "＋ เพิ่มเล่ม"`));
}
