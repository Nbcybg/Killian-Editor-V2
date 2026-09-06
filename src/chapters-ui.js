// chapters-ui.js — [alpha.141] "จัดการบท" — คู่แฝดของ "จัดการเล่ม" ที่หายไปตั้งแต่ alpha.32
//
// ผู้ใช้: *"เรามีจัดการเล่ม แต่ไม่มีจัดการบท เพิ่มด้วย เหมือนเดิม มีหน้าปก จะเป็นรูปหรือเป็น text ก็ได้
//          ตอนพิมพ์หรือ export จะใส่หรือไม่ใส่ก็ได้ … ให้ติ๊กเลย ถ้ามี หน้าปกของบทต้องถูกนับเป็นหน้าด้วย"*
//
// หน้าปกบทเก็บที่ `draft.json → chapters[].cover = {on, image, text}` (รูปแบบเดียวกับ
// `section.json → cover` ของเล่ม แต่แยกช่อง on/text ออกมาเพราะผู้ใช้ขอ "ติ๊กเปิด/ปิด" ตรง ๆ)
// การ **นับเป็นหน้า** ไม่ได้ทำที่นี่ — `book-flow.js` เป็นคนตัดสิน แล้วโหมดอ่าน/ตัวไล่เลขหน้า
// ใช้คำตอบเดียวกัน (กฎถาวรข้อ 5: ห้ามมีตัวคิดลำดับหน้าตัวที่สอง)

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

// เล่มที่กำลังดูอยู่ (จำข้ามการวาดใหม่ — ไม่เขียนลงไฟล์ เป็นสถานะของหน้าจอล้วน)
const CH_UI = { secPath: '', dPath: '' };

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

export async function renderChapterManager(pane) {
  if (!pane) return;
  pane.innerHTML = '';
  const wrap = el('div', 'books-wrap chapters-wrap'); pane.append(wrap);

  const head = el('div', 'books-head');
  head.append(el('div', 'books-title', t('ui.chapters.title')));
  const pick = el('select', 'chapters-book k-dlg-select'); head.append(pick);
  const addBtn = el('button', 'k-ok', t('ui.chapters.addChapter'));
  const readBtn = el('button', 'cmp-mini', t('ui.readbook.button'));
  const numBtn = el('button', 'cmp-mini', t('ui.chapters.renumber'));
  head.append(addBtn, readBtn, numBtn);
  wrap.append(head);

  const sections = await listSections();
  if (!sections.length) { wrap.append(el('div', 'books-empty', t('ui.chapters.noBook'))); return; }
  if (!sections.some((s) => s.secPath === CH_UI.secPath)) CH_UI.secPath = sections[0].secPath;
  for (const s of sections) {
    const o = el('option', null, s.title || s.folder); o.value = s.secPath;
    if (s.secPath === CH_UI.secPath) o.selected = true;
    pick.append(o);
  }
  pick.onchange = () => { CH_UI.secPath = pick.value; renderChapterManager(pane); };

  const dPath = await primaryDraft(CH_UI.secPath);
  CH_UI.dPath = dPath;
  readBtn.onclick = () => openBookReader(CH_UI.secPath);
  addBtn.onclick = async () => { if (dPath) { await addChapter(dPath); renderChapterManager(pane); } };
  numBtn.onclick = async () => { if (dPath) { await renumberChapters(dPath); renderChapterManager(pane); } };
  if (!dPath) { wrap.append(el('div', 'books-empty', t('ui.chapters.noDraft'))); return; }

  wrap.append(el('div', 'k-hint chapters-hint', t('ui.chapters.coverHint')));
  // [alpha.142 ข้อ 3] ขนาด/อัตราส่วนรูปปกที่แนะนำ — คิดจากกระดาษที่ตั้งไว้จริงในโปรเจกต์
  wrap.append(el('div', 'k-hint chapters-hint', coverHintLine()));

  const grid = el('div', 'books-grid chapters-grid'); wrap.append(grid);
  const chapters = await listChapters(dPath);
  let scenesAll = {};
  try { scenesAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {}; } catch {}

  for (const ch of chapters) {
    const cov = normChapterCover(ch);
    const card = el('div', 'book-card chapter-card');
    card.draggable = true;
    card.dataset.guid = ch.guid;

    // ---- ปกบท ----
    const cover = el('div', 'book-cover');
    const applyCover = (c) => {
      cover.replaceChildren();
      cover.classList.toggle('cover-off', !c.on);
      if (c.on && c.image) {
        const img = el('img'); img.src = resolveImg(state.root, c.image);
        cover.append(img); cover.classList.remove('book-cover-empty');
      } else if (c.on && c.text) {
        cover.classList.remove('book-cover-empty');
        cover.append(el('div', 'chapter-cover-text', c.text));
      } else {
        cover.classList.add('book-cover-empty');
        cover.append(el('div', 'book-cover-ph', c.on ? '📄' : '—'));
      }
    };
    applyCover(cov);

    const btns = el('div', 'book-cover-btns');
    const pickBtn = el('button', 'cmp-mini', t('ui.chapters.coverPick'));
    pickBtn.onclick = async () => {
      const it = await pickImage(state.root);
      if (!it) return;
      cov.image = 'Images/' + it.file; cov.on = true;
      await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
      bumpBookFlow(); applyCover(cov); chk.checked = true;
      setStatus(t('ui.chapters.coverSetDone'));
    };
    const clrBtn = el('button', 'cmp-mini', '✕');
    clrBtn.title = t('ui.chapters.coverClear');
    clrBtn.onclick = async () => {
      cov.image = '';
      await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
      bumpBookFlow(); applyCover(cov);
    };
    btns.append(pickBtn, clrBtn);
    cover.append(btns);
    card.append(cover);

    const bd = el('div', 'book-body'); card.append(bd);

    // ชื่อบท (แก้ในที่)
    const titleInp = el('input', 'book-title-inp'); titleInp.value = ch.title || '';
    titleInp.onchange = async () => {
      const v = titleInp.value.trim();
      if (!v || v === ch.title) { titleInp.value = ch.title || ''; return; }
      await setChapterTitle(dPath, ch, v); ch.title = v;
      bumpBookFlow(); setStatus(t('ui.chapters.renameDone'));
    };
    bd.append(titleInp);

    // ★ ติ๊ก "ใช้หน้าปกบท" — ตัวที่ผู้ใช้ขอตรง ๆ
    const chkRow = el('label', 'chapter-cover-on');
    const chk = el('input', null); chk.type = 'checkbox'; chk.checked = !!cov.on;
    chk.onchange = async () => {
      cov.on = chk.checked;
      await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
      bumpBookFlow(); applyCover(cov);
      setStatus(chk.checked ? t('ui.chapters.coverOnDone') : t('ui.chapters.coverOffDone'));
    };
    chkRow.append(chk, document.createTextNode(' ' + t('ui.chapters.useCover')));
    bd.append(chkRow);

    // ★ [alpha.142 ข้อ 1] "ใช้ภาพเต็มหน้า" — เปิดเป็นค่าเริ่มต้น (ปกที่มีรูปควรเต็มหน้า)
    const fullRow = el('label', 'chapter-cover-on');
    const fullChk = el('input', null); fullChk.type = 'checkbox'; fullChk.checked = cov.full !== false;
    fullChk.title = t('ui.chapters.useFullHint');
    fullChk.onchange = async () => {
      cov.full = fullChk.checked;
      await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
      bumpBookFlow(); applyCover(cov);
      setStatus(fullChk.checked ? t('ui.chapters.fullOnDone') : t('ui.chapters.fullOffDone'));
    };
    fullRow.append(fullChk, document.createTextNode(' ' + t('ui.chapters.useFull')));
    bd.append(fullRow);

    // ข้อความบนปก (ใช้แทนรูป หรือใช้คู่กับรูปก็ได้)
    const txt = el('textarea', 'book-blurb chapter-cover-txt');
    txt.placeholder = t('ui.chapters.coverTextPh');
    txt.value = cov.text || '';
    txt.onchange = async () => {
      cov.text = txt.value;
      await saveChapterMeta(dPath, ch.guid, { cover: { ...cov } });
      bumpBookFlow(); applyCover(cov);
    };
    bd.append(txt);

    // สถิติ
    const stats = el('div', 'book-stats', '…'); bd.append(stats);
    chapterStats(dPath, ch).then((st) => {
      stats.textContent = tf('ui.chapters.sceneWord', st.scenes, st.words.toLocaleString());
    });

    // ปุ่มจัดการ
    const acts = el('div', 'book-acts');
    const openB = el('button', 'cmp-mini', t('ui.chapters.open'));
    openB.onclick = async () => {
      const first = (scenesAll[ch.guid] || []).slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))[0];
      if (!first) { await openFirstSceneOf(CH_UI.secPath); return; }
      openScene(await kapi.join(dPath, 'Chapters', ch.folderName, first.fileName), first.title);
    };
    const propB = el('button', 'cmp-mini', t('ui.chapters.props'));
    propB.onclick = async () => { if (await chapterProps(dPath, ch)) renderChapterManager(pane); };
    const delB = el('button', 'cmp-mini k-danger', t('ui.common.del2'));
    delB.onclick = async () => { await deleteChapter(dPath, ch); bumpBookFlow(); renderChapterManager(pane); };
    acts.append(openB, propB, delB);
    bd.append(acts);

    // ---- ลากสลับลำดับบท (ทางเดียวกับการ์ดเล่ม) ----
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/k2-chapter', ch.guid);
      card.classList.add('book-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('book-dragging'));
    card.addEventListener('dragover', (e) => {
      if ([...e.dataTransfer.types].includes('text/k2-chapter')) { e.preventDefault(); card.classList.add('book-drop'); } });
    card.addEventListener('dragleave', () => card.classList.remove('book-drop'));
    card.addEventListener('drop', async (e) => {
      card.classList.remove('book-drop');
      const from = e.dataTransfer.getData('text/k2-chapter');
      if (!from || from === ch.guid) return;
      e.preventDefault();
      await moveChapterBefore(dPath, from, ch.guid);
      bumpBookFlow();
      renderChapterManager(pane);
    });

    grid.append(card);
  }

  if (!chapters.length) grid.append(el('div', 'books-empty', t('ui.chapters.empty')));
}
