// comment-ui.js — แผงคอมเมนต์ (บั๊ก #25)
// เดิมคอมเมนต์เป็น "กล่องโต้ตอบ" ที่เก็บใน scenes.json → แบน ไม่มีสมอ ไม่มี resolve ไม่มีผู้เขียน
// ตอนนี้เป็น "แผง" (dock/tab/float ได้) ที่ใช้ comment-core.js — เธรดซ้อนได้ · ผูกกับข้อความ · ปิดเรื่องได้
// เก็บท้ายไฟล์ .md เอง (<!-- k2-comments --> ) → แก้นอกโปรแกรมได้ · v1 (Python) ยังเปิดไฟล์ได้เหมือนเดิม
import { T } from '../i18n.js';
import { $, el, state, setStatus, log, t as tr } from '../core.js';   // บทเรียน 25: ในไฟล์นี้ตัวแปร t = แท็บ → i18n ใช้ชื่อ tr
import { CommentStore, countComments, openComments, reanchorAll } from './comment-core.js';
import { setCommentAnchors, refreshCommentAnchors } from '../editor.js';
import { TextSelection } from 'prosemirror-state';

// ───────── store (ตัวเดียวทั้งแอป — io = kapi) ─────────
let _store = null;
export function commentStore() {
  if (!_store) {
    _store = new CommentStore({
      io: {
        readFile: (p) => kapi.readFile(p),
        writeFile: (p, s) => kapi.writeFile(p, s),
        exists: (p) => kapi.exists(p),
      },
      author: '',
    });
  }
  _store.author = (state.meta && state.meta.author) || '';   // ชื่อผู้เขียนอาจเปลี่ยนระหว่างใช้งาน
  return _store;
}
export function resetCommentStore() { _store = null; }

/**
 * เขียนไฟล์ .md ทับโดยรักษาบล็อกคอมเมนต์ท้ายไฟล์ไว้ (+ ผูกสมอใหม่ตามข้อความที่เพิ่งแก้)
 * ไฟล์ที่ยังไม่มีคอมเมนต์ = เขียนตรง ๆ ตัวต่อตัว — ห้ามผ่าน mergeComments เพราะมันตัด
 * ช่องว่างท้ายไฟล์ทิ้ง (ไฟล์ทุกไฟล์จะถูกแก้ท้ายไฟล์ทุกครั้งที่บันทึก แม้ไม่มีคอมเมนต์เลย)
 * @returns {Promise<boolean>} true = ไฟล์นี้มีคอมเมนต์อยู่จริง
 */
export async function writeKeepingComments(path, fullText) {
  const store = commentStore();
  const { comments } = await store.read(path);
  if (!comments.length) { await kapi.writeFile(path, fullText); return false; }
  await store.write(path, fullText, reanchorAll(fullText, comments));
  return true;
}

// ───────── ไฟล์ฉากที่กำลังโฟกัส ─────────
// คอมเมนต์ผูกกับ "ไฟล์ .md" ตรง ๆ (ไม่ใช่ sceneId) — ย้ายไฟล์ไปไหนคอมเมนต์ก็ตามไปด้วย
function activeFile() {
  const t = state.active;
  if (!t || !t.file || !/\.md$/i.test(t.file)) return null;
  return t.file;
}
function activeTitle() { return (state.active && state.active.title) || ''; }

let filterOpen = false;          // true = แสดงเฉพาะที่ยังไม่ปิดเรื่อง
let lastList = [];               // คอมเมนต์ที่วาดอยู่ (ใช้คืนไฮไลต์หลังเลิกชี้ — ห้ามอ่านกลับจาก DOM เพราะข้อความถูกตัดสั้น)

// ───────── ไฮไลต์สมอในตัวแก้ไข ─────────
function editorView() {
  const t = state.active;
  if (!t) return null;
  return (t.editor && t.editor.view) || (t.sp && t.sp.view) || null;
}
function syncAnchors(list, activeQuote) {
  const quotes = [];
  const walk = (cs) => { for (const c of cs) { if (c.anchor && c.anchor.quote && !c.resolved) quotes.push(c.anchor.quote); walk(c.replies || []); } };
  walk(list || []);
  setCommentAnchors(quotes, activeQuote);
  refreshCommentAnchors(editorView());
}
/** ล้างไฮไลต์ (เปลี่ยนแท็บ/ปิดแผง) */
export function clearCommentAnchors() { setCommentAnchors([], ''); refreshCommentAnchors(editorView()); }

// ───────── ข้อความที่เลือกอยู่ในตัวแก้ไข → สมอ ─────────
/** @returns {{start,end,quote}|null} — offset คิดเทียบกับ "ไฟล์ .md" (หาโดยค้นข้อความจริง) */
export async function selectionAnchor() {
  const v = editorView();
  if (!v) return null;
  const { from, to } = v.state.selection;
  if (to <= from) return null;
  const quote = v.state.doc.textBetween(from, to, '\n').trim();
  if (quote.length < 2) return null;
  // offset จริงในไฟล์: หาข้อความนั้นในเนื้อไฟล์ (เนื้อ ProseMirror ≠ ข้อความ .md ตัวต่อตัว)
  let start = 0;
  try {
    const file = activeFile();
    if (file) {
      const { body } = await commentStore().read(file);
      const i = body.indexOf(quote);
      if (i >= 0) start = i;
    }
  } catch (e) { log('warn', T`selectionAnchor: อ่านไฟล์ไม่ได้`, e); }
  return { start, end: start + quote.length, quote };
}

// ───────── วาดแผง ─────────
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } };

/**
 * วาดแผงคอมเมนต์ลง host (`#comments-body`)
 * เรียกซ้ำได้เรื่อย ๆ — วาดใหม่ทั้งแผงทุกครั้ง (ข้อมูลน้อย ไม่ต้อง diff)
 */
export async function renderCommentPanel(host) {
  host = host || $('#comments-body');
  if (!host) return null;
  host.innerHTML = '';
  const file = activeFile();
  if (!file) {
    host.append(el('div', 'dim', tr('cmt.needScene', '(เปิดฉากก่อนจึงจะคอมเมนต์ได้)')));
    lastList = [];
    clearCommentAnchors();
    return null;
  }

  const store = commentStore();
  let all = [];
  try { all = await store.list(file); }
  catch (e) { log('error', tr('cmt.readFailLog', 'อ่านคอมเมนต์ไม่ได้'), e); host.append(el('div', 'dim', tr('cmt.readFail', '(อ่านคอมเมนต์ไม่ได้)'))); return null; }

  // หัวแผง: ชื่อฉาก + ตัวกรอง
  const head = el('div', 'k-cm-head');
  head.append(el('span', 'k-cm-scene', '💬 ' + (activeTitle() || file.split(/[\\/]/).pop())));
  const nOpen = openComments(all).length;
  head.append(el('span', 'k-cm-count', T`${countComments(all)} รายการ · ยังไม่ปิด ${nOpen}`));
  const fBtn = el('button', 'k-cm-filter' + (filterOpen ? ' on' : ''),
                  filterOpen ? tr('cmt.filterOpen', '🔽 เฉพาะที่ยังไม่ปิด') : tr('cmt.filterAll', '🔽 ทั้งหมด'));
  fBtn.title = tr('cmt.filterHint', 'สลับกรองคอมเมนต์ที่ปิดเรื่องแล้ว');
  fBtn.onclick = () => { filterOpen = !filterOpen; renderCommentPanel(host); };
  head.append(fBtn);
  host.append(head);

  const list = el('div', 'k-cm-list');
  const shown = filterOpen ? all.filter((c) => !c.resolved) : all;
  if (!shown.length) list.append(el('div', 'dim', filterOpen ? tr('cmt.emptyOpen', '(ไม่มีคอมเมนต์ที่ยังไม่ปิด)') : tr('cmt.emptyAll', '(ยังไม่มีคอมเมนต์ในฉากนี้)')));
  for (const c of shown) list.append(commentCard(c, file, host, 0));
  host.append(list);

  // กล่องเพิ่มคอมเมนต์ใหม่
  const sel = await selectionAnchor();
  const foot = el('div', 'k-cm-foot');
  if (sel) {
    const chip = el('div', 'k-cm-anchor-chip', T`📍 ผูกกับ: “` + short(sel.quote) + '”');
    chip.title = tr('cmt.anchorHint', 'คอมเมนต์ที่เพิ่มจะผูกกับข้อความที่เลือกไว้');
    foot.append(chip);
  }
  const row = el('div', 'k-cm-input-row');
  const inp = el('textarea', 'k-cm-input');
  inp.placeholder = sel ? tr('cmt.placeholderSel', 'คอมเมนต์เกี่ยวกับข้อความที่เลือก…') : tr('cmt.placeholder', 'พิมพ์คอมเมนต์…');
  inp.rows = 2;
  const addB = el('button', 'k-ok', T`💬 เพิ่ม`);
  const doAdd = async () => {
    const text = inp.value.trim();
    if (!text) return;
    addB.disabled = true;
    try {
      await store.add(file, sel, text);
      inp.value = '';
      setStatus(tr('cmt.added', 'เพิ่มคอมเมนต์แล้ว'));
      await renderCommentPanel(host);
    } catch (e) { log('error', tr('cmt.addFail', 'เพิ่มคอมเมนต์ไม่สำเร็จ'), e); setStatus(tr('cmt.addFail', 'เพิ่มคอมเมนต์ไม่สำเร็จ')); addB.disabled = false; }
  };
  addB.onclick = doAdd;
  // Enter = ส่ง · Shift+Enter = ขึ้นบรรทัดใหม่
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doAdd(); } };
  row.append(inp, addB);
  foot.append(row);
  host.append(foot);

  lastList = all;
  syncAnchors(all, '');
  return all;
}

function short(s, n = 40) { s = String(s || '').replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n) + '…' : s; }

// การ์ดคอมเมนต์ 1 อัน (+ เธรดตอบกลับซ้อนได้ไม่จำกัดชั้น)
function commentCard(c, file, host, depth) {
  const store = commentStore();
  const card = el('div', 'k-cm-card' + (c.resolved ? ' resolved' : '') + (depth ? ' reply' : ''));
  card.dataset.cid = c.id;
  if (depth) card.style.marginInlineStart = Math.min(depth, 4) * 14 + 'px';

  const top = el('div', 'k-cm-top');
  top.append(el('span', 'k-cm-author', '👤 ' + (c.author || T`ไม่ระบุชื่อ`)));
  top.append(el('span', 'k-cm-when', fmtWhen(c.timestamp) + (c.editedAt ? tr('cmt.edited', ' (แก้ไขแล้ว)') : '')));
  const acts = el('span', 'k-cm-acts');

  const mk = (label, title, fn, cls) => { const b = el('span', 'k-cm-act' + (cls ? ' ' + cls : ''), label); b.title = title; b.onclick = fn; return b; };
  if (!depth) acts.append(mk(c.resolved ? '↩' : '✓', c.resolved ? tr('cmt.reopen', 'เปิดเรื่องนี้อีกครั้ง') : tr('cmt.resolve', 'ปิดเรื่องนี้ (resolve)'),
    async () => { await store.resolve(file, c.id, !c.resolved); setStatus(c.resolved ? tr('cmt.reopened', 'เปิดคอมเมนต์อีกครั้ง') : tr('cmt.resolved', 'ปิดเรื่องคอมเมนต์แล้ว')); renderCommentPanel(host); }));
  acts.append(mk('✏️', tr('cmt.edit', 'แก้ไขข้อความ'), () => startEdit()));
  acts.append(mk('↩💬', tr('cmt.reply', 'ตอบกลับ'), () => startReply()));
  acts.append(mk('🗑', tr('cmt.deleteHint', 'ลบคอมเมนต์นี้ (พร้อมเธรดตอบกลับ)'), async () => {
    const { confirmBox } = await import('../ui.js');
    if (!(await confirmBox(tr('cmt.deleteConfirm', 'ลบคอมเมนต์นี้ (พร้อมเธรดตอบกลับทั้งหมด) ?'), tr('cmt.delete', 'ลบคอมเมนต์')))) return;
    await store.remove(file, c.id); setStatus(tr('cmt.deleted', 'ลบคอมเมนต์แล้ว')); renderCommentPanel(host);
  }, 'k-danger'));
  top.append(acts);
  card.append(top);

  // textContent เท่านั้น — ข้อความผู้ใช้ห้ามลง innerHTML
  const body = el('div', 'k-cm-text', c.text);
  card.append(body);

  if (c.anchor && c.anchor.quote) {
    const q = el('div', 'k-cm-quote' + (c.anchor.lost ? ' lost' : ''),
                 (c.anchor.lost ? tr('cmt.anchorLost', '📍✕ (ข้อความถูกลบไปแล้ว) ') : '📍 ') + '“' + short(c.anchor.quote, 60) + '”');
    q.title = c.anchor.lost ? tr('cmt.anchorLostHint', 'ไม่พบข้อความที่คอมเมนต์นี้ผูกไว้แล้ว') : tr('cmt.anchorOkHint', 'ชี้เพื่อไฮไลต์ในฉาก · คลิกเพื่อเลื่อนไปหา');
    if (!c.anchor.lost) {
      // ชี้ = เน้นอันนี้อันเดียว · เลิกชี้ = กลับไปไฮไลต์ทุกสมอตามข้อมูลจริง (ไม่ใช่ข้อความในหน้าจอที่ถูกตัดสั้น)
      q.onmouseenter = () => { setCommentAnchors([c.anchor.quote], c.anchor.quote); refreshCommentAnchors(editorView()); };
      q.onmouseleave = () => syncAnchors(lastList, '');
      q.onclick = () => scrollToAnchor(c.anchor.quote);
    }
    card.append(q);
  }

  // ---- แก้ไขในที่ ----
  function startEdit() {
    if (card.querySelector('.k-cm-edit')) return;
    const ta = el('textarea', 'k-cm-edit'); ta.value = c.text; ta.rows = 2;
    const ok = el('button', 'k-ok', T`บันทึก`);
    const no = el('button', null, tr('cmt.cancel', 'ยกเลิก'));
    const box = el('div', 'k-cm-editbox'); box.append(ta, ok, no);
    body.after(box); body.hidden = true; ta.focus();
    const close = () => { box.remove(); body.hidden = false; };
    no.onclick = close;
    ok.onclick = async () => {
      const v = ta.value.trim();
      if (!v) { close(); return; }
      await store.edit(file, c.id, v); setStatus(tr('cmt.editedDone', 'แก้ไขคอมเมนต์แล้ว')); renderCommentPanel(host);
    };
  }
  // ---- ตอบกลับ ----
  function startReply() {
    if (card.querySelector('.k-cm-reply')) return;
    const ta = el('textarea', 'k-cm-reply'); ta.placeholder = tr('cmt.replyPlaceholder', 'ตอบกลับ…'); ta.rows = 2;
    const ok = el('button', 'k-ok', T`ตอบ`);
    const no = el('button', null, tr('cmt.cancel', 'ยกเลิก'));
    const box = el('div', 'k-cm-editbox'); box.append(ta, ok, no);
    card.append(box); ta.focus();
    no.onclick = () => box.remove();
    const send = async () => {
      const v = ta.value.trim();
      if (!v) { box.remove(); return; }
      await store.reply(file, c.id, v); setStatus(tr('cmt.replied', 'ตอบกลับแล้ว')); renderCommentPanel(host);
    };
    ok.onclick = send;
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  }

  // ---- เธรดตอบกลับ ----
  if ((c.replies || []).length) {
    const rs = el('div', 'k-cm-replies');
    rs.append(el('div', 'k-cm-replies-head', T`↳ ${c.replies.length} การตอบกลับ`));
    for (const r of c.replies) rs.append(commentCard(r, file, host, depth + 1));
    card.append(rs);
  }
  return card;
}

/** เลื่อนตัวแก้ไขไปยังข้อความที่คอมเมนต์ผูกไว้ */
export function scrollToAnchor(quote) {
  const v = editorView();
  if (!v || !quote) return false;
  let hit = null;
  v.state.doc.descendants((node, pos) => {
    if (hit || !node.isText || !node.text) return;
    const i = node.text.indexOf(quote);
    if (i >= 0) hit = pos + i;
  });
  if (hit == null) { setStatus(tr('cmt.anchorMissing', 'ไม่พบข้อความที่คอมเมนต์ผูกไว้ (อาจถูกแก้/ลบไปแล้ว)')); return false; }
  try {
    const to = Math.min(hit + quote.length, v.state.doc.content.size);
    v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, hit, to)).scrollIntoView());
  } catch (e) { log('warn', T`scrollToAnchor: เลือกช่วงไม่ได้`, e); v.dispatch(v.state.tr.scrollIntoView()); }
  v.focus();
  return true;
}

// ───────── ย้ายของเก่า: คอมเมนต์ที่เคยอยู่ใน scenes.json ─────────
/**
 * ย้ายคอมเมนต์เดิม (scenes.json → row.comments[]) ไปไว้ท้ายไฟล์ .md แล้วล้างของเดิมทิ้ง
 * ทำครั้งเดียวต่อฉบับร่าง (ทำซ้ำก็ไม่พัง — ของเดิมถูกล้างแล้วจะไม่มีอะไรให้ย้าย)
 * @returns {Promise<number>} จำนวนคอมเมนต์ที่ย้าย
 */
export async function migrateSceneComments(dPath) {
  if (!dPath) return 0;
  const { fromScenesJson } = await import('./comment-core.js');
  const { chapterFolders, scenePath } = await import('../project-scan.js');
  const sf = await kapi.join(dPath, 'scenes.json');
  if (!(await kapi.exists(sf))) return 0;
  let d;
  try { d = await kapi.readJson(sf); } catch { return 0; }
  const bySceneId = fromScenesJson(d);
  const ids = Object.keys(bySceneId);
  if (!ids.length) return 0;
  const folders = await chapterFolders(dPath);
  const store = commentStore();
  let n = 0;
  for (const chId of Object.keys(d.chapters || {})) {
    for (const row of (d.chapters[chId] || [])) {
      const olds = bySceneId[row.id];
      if (!olds || !olds.length) continue;
      const p = await scenePath(dPath, chId, row, folders);
      if (!(await kapi.exists(p))) continue;
      const { body, comments } = await store.read(p);
      // กันย้ายซ้ำ: ข้ามตัวที่ id ตรงกับที่มีอยู่แล้วในไฟล์
      const have = new Set(comments.map((c) => c.id));
      const add = olds.filter((c) => !have.has(c.id));
      if (add.length) { await store.write(p, body, [...comments, ...add]); n += add.length; }
      delete row.comments;                        // ล้างของเดิมใน scenes.json
    }
  }
  if (n) await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  log('info', T`ย้ายคอมเมนต์เดิมจาก scenes.json → .md แล้ว ${n} รายการ`);
  return n;
}
