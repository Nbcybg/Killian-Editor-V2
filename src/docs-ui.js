// docs-ui.js — [alpha.170] ตัวอ่านคู่มือในโปรแกรม (คู่มือผู้ใช้ · คู่มือส่วนขยาย)
//
// ทางเข้า: คำสั่ง `user-manual` / `extension-guide` ใน handleCommand — เมนู ช่วยเหลือ · กล่อง "เกี่ยวกับ" · แผงปลั๊กอิน
// ตรรกะ (ภาษา · ลิงก์ · สารบัญ · สมอ) อยู่ docs-view.js (บริสุทธิ์ · unit `docs-view`) — ไฟล์นี้มีแค่ อ่านไฟล์ + วาด
//   · ไฟล์คู่มือมากับตัวโปรแกรม (docs/manual · docs/extension ใน build.files) — อ่านได้โดยไม่ต้องต่อเน็ต
//   · วาดด้วย textContent ล้วน (ไม่มี innerHTML) · ลิงก์ออกนอกโปรแกรมเปิดในเบราว์เซอร์ของระบบ
//   · ภาษาตั้งต้น = อังกฤษ (หน้าจอไทย = ไทย) · ผู้ใช้สลับภาษาในตัวอ่านได้ และถูกจำไว้
import { el, log, t, tf } from './core.js';
import { langInfo } from './i18n.js';
import { escClose } from './ui.js';
import { icon } from './icons.js';
import { UPDATE_HOME_URL } from './update/update-check.js';
import {
  DOC_BOOKS, DOC_LANGS, DOC_LANG_NAMES, docBlocks, docHome, docInfo, docInLang, docInlineParts, docLang, docReadPaths, docToc,
  resolveDocImage, resolveDocLink,
} from './docs-view.js';

const LANG_KEY = 'k2-docs-lang';
// หน้าของโปรแกรมอยู่ที่ renderer/index.html — คู่มืออยู่ข้างนอกหนึ่งชั้น (รากของตัวโปรแกรม)
const urlOf = (path) => '../' + String(path).split('/').map(encodeURIComponent).join('/');

// ───────── อ่านไฟล์/เปิดเบราว์เซอร์ — จุดเดียว (e2e สลับเป็นของปลอมด้วย setDocsIo) ─────────
const io = {
  read: async (path) => {
    const r = await fetch(urlOf(path));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  },
  open: (url) => kapi.openExternal(url),
};
/** สลับตัวอ่านไฟล์/ตัวเปิดเบราว์เซอร์ (เทส) — คืนฟังก์ชันคืนค่าเดิม */
export function setDocsIo(patch) {
  const old = { ...io };
  Object.assign(io, patch || {});
  return () => { Object.assign(io, old); };
}

function pickedLang() { try { return localStorage.getItem(LANG_KEY) || ''; } catch { return ''; } }
function rememberLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch {} }

/**
 * เปิดตัวอ่านคู่มือ
 * @param {'manual'|'extension'} [book]
 * @param {{path?:string, hash?:string}} [opts] path = เปิดที่หน้านี้ (ทางจากรากของตัวโปรแกรม) แทนหน้าแรกของเล่ม
 * @returns {HTMLElement} ตัว overlay (มี `.k2ready` = Promise ที่จบเมื่อหน้าแรกวาดเสร็จ — เทสใช้รอ)
 */
export function openDocs(book = 'manual', opts = {}) {
  document.querySelectorAll('.k-overlay.k-docs-ov').forEach((o) => o.remove());
  const S = { book: DOC_BOOKS[book] ? book : 'manual', lang: docLang(langInfo.code, pickedLang()), path: '', toc: [], tocKey: '', back: [], round: 0 };

  const ov = el('div', 'k-overlay k-docs-ov');
  const box = el('div', 'k-dialog k-wide k-docs-dlg');
  const ttl = el('div', 'k-dlg-title', t(DOC_BOOKS[S.book].titleKey));

  // ── แถบนำทาง: ย้อนกลับ · บท · ก่อนหน้า/ถัดไป · ภาษา ──
  const bar = el('div', 'k-changelog-bar k-docs-bar');
  const mkBtn = (cls, ic, labelKey) => {
    const b = el('button', 'cmp-mini ' + cls);
    b.type = 'button';
    b.append(icon(ic, 14));
    b.title = t(labelKey);
    b.setAttribute('aria-label', t(labelKey));
    return b;
  };
  const bBack = mkBtn('k-docs-back', 'arrow-left', 'ui.docs.back');
  const sel = el('select', 'k-dlg-select k-changelog-sel k-docs-sel');
  sel.title = t('ui.docs.chapter');
  sel.setAttribute('aria-label', t('ui.docs.chapter'));
  const bPrev = mkBtn('k-docs-prev', 'chevron-left', 'ui.docs.prev');
  const bNext = mkBtn('k-docs-next', 'chevron-right', 'ui.docs.next');
  const selLang = el('select', 'k-dlg-select k-docs-lang');
  selLang.title = t('ui.docs.language');
  selLang.setAttribute('aria-label', t('ui.docs.language'));
  for (const l of DOC_LANGS) { const o = el('option', null, DOC_LANG_NAMES[l]); o.value = l; selLang.append(o); }
  bar.append(bBack, sel, bPrev, bNext, selLang);

  const body = el('div', 'k-changelog k-changelog-rich k-docs-body k-selectable');
  body.tabIndex = 0;
  const btns = el('div', 'k-dlg-btns');
  const bClose = el('button', 'k-ok k-cancel', t('ui.common.close'));
  const close = () => ov.remove();
  bClose.onclick = close;
  btns.append(bClose);
  box.append(ttl, bar, body, btns);
  ov.append(box);

  // ───────── วาด ─────────
  const follow = (r) => {
    if (r.kind === 'doc' || r.kind === 'file') go(r.path, { hash: r.hash || '', push: true });
    else if (r.kind === 'hash') scrollToAnchor(r.hash);
    else if (r.kind === 'web') { try { Promise.resolve(io.open(r.url)).catch((e) => log('warn', 'docs: open link failed', e)); } catch (e) { log('warn', 'docs: open link failed', e); } }
  };
  const inlineInto = (host, text) => {
    for (const p of docInlineParts(text)) {
      if (p.image) {
        const src = resolveDocImage(S.path, p.src);
        if (!src) { host.append(el('span', 'k-cl-i', p.alt || '')); continue; }
        const img = el('img', 'k-doc-img');
        img.alt = p.alt || '';
        img.loading = 'lazy';
        img.draggable = false;
        img.src = urlOf(src);
        host.append(img);
        continue;
      }
      const cls = [p.bold ? 'k-cl-b' : '', p.em ? 'k-cl-i' : '', p.strike ? 'k-cl-s' : ''].filter(Boolean).join(' ') || null;
      if (!p.href) { host.append(el(p.code ? 'code' : 'span', cls, p.text)); continue; }
      const r = resolveDocLink(S.path, p.href, UPDATE_HOME_URL);
      // ลิงก์ที่ไปไหนไม่ได้ (ไฟล์นอกคู่มือที่ไม่มีหน้าบนรีโป · scheme แปลก) = ข้อความธรรมดา ไม่ทำหน้าเป็นลิงก์
      if (r.kind === 'none') { host.append(el(p.code ? 'code' : 'span', cls, p.text)); continue; }
      const a = el('span', 'k-doc-link' + (cls ? ' ' + cls : ''));
      a.append(p.code ? el('code', null, p.text) : document.createTextNode(p.text));
      a.tabIndex = 0;
      a.setAttribute('role', 'link');
      a.dataset.kind = r.kind;
      if (r.kind === 'web') { a.title = r.url; a.append(icon('link-external', 11)); }
      a.onclick = () => follow(r);
      a.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); follow(r); } };
      host.append(a);
    }
    return host;
  };
  const nodesOf = (md) => {
    const out = [];
    for (const b of docBlocks(md).blocks) {
      if (b.kind === 'h') {
        const h = inlineInto(el('div', b.level === 1 ? 'k-cl-title' : 'k-cl-h k-cl-h' + Math.min(6, b.level)), b.text);
        h.setAttribute('role', 'heading');
        h.setAttribute('aria-level', String(b.level));
        h.dataset.anchor = b.id;            // ★ ไม่ตั้ง id จริง — หัวข้อชื่อ "status"/"toolbar" จะชนกับ id ของเปลือกโปรแกรม
        out.push(h);
      } else if (b.kind === 'hr') out.push(el('hr', 'k-cl-hr'));
      else if (b.kind === 'code') out.push(el('pre', 'k-cl-code', b.text));
      else if (b.kind === 'quote') out.push(inlineInto(el('blockquote', 'k-cl-quote'), b.text));
      else if (b.kind === 'li') {
        const row = el('div', 'k-cl-li');
        row.style.marginInlineStart = (b.depth * 1.4) + 'em';
        row.append(el('span', 'k-cl-mark', b.ordered ? b.mark : '•'), inlineInto(el('span', 'k-cl-litext'), b.text));
        out.push(row);
      } else if (b.kind === 'table') {
        const wrap = el('div', 'k-cl-tablewrap'), tb = el('table', 'k-cl-table k-doc-table');
        const hr = el('tr');
        for (const c of b.head) hr.append(inlineInto(el('th'), c));
        tb.append(hr);
        for (const r of b.rows) { const tr = el('tr'); for (const c of r) tr.append(inlineInto(el('td'), c)); tb.append(tr); }
        wrap.append(tb); out.push(wrap);
      } else out.push(inlineInto(el('p', 'k-cl-p'), b.text));
    }
    return out;
  };
  function scrollToAnchor(hash) {
    const want = String(hash || '').toLowerCase();
    const target = want && [...body.querySelectorAll('[data-anchor]')].find((n) => n.dataset.anchor === want);
    if (!target) return false;
    body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 4;
    return true;
  }

  // ───────── สารบัญ + แถบ ─────────
  async function loadToc() {
    const key = S.book + '/' + S.lang;
    if (S.tocKey === key) return;
    const home = docHome(S.book, S.lang);
    let toc = [];
    try { toc = docToc(home, await io.read(home)); } catch (e) { log('warn', 'docs: contents not readable', e); toc = []; }
    S.toc = toc; S.tocKey = key;
  }
  function syncBar(pageTitle) {
    ttl.textContent = t(DOC_BOOKS[S.book].titleKey);
    sel.replaceChildren();
    S.toc.forEach((row, i) => { const o = el('option', null, row.title); o.value = String(i); sel.append(o); });
    const at = S.toc.findIndex((row) => row.path === S.path);
    if (at < 0) {
      // หน้าที่ไม่อยู่ในสารบัญ (ตัวอย่างปลั๊กอิน · ไฟล์ชนิดข้อมูล) — โชว์ชื่อของมันเป็นตัวเลือกชั่วคราว
      const o = el('option', null, pageTitle || S.path.split('/').pop());
      o.value = '-1';
      sel.append(o);
    }
    sel.value = String(at);
    bPrev.disabled = at <= 0;
    bNext.disabled = at < 0 || at >= S.toc.length - 1;
    bBack.disabled = !S.back.length;
    selLang.value = S.lang;
  }

  /** ไปหน้าหนึ่ง — push = จำหน้าปัจจุบันไว้ให้ปุ่มย้อนกลับ */
  async function go(path, { hash = '', push = false, top = 0 } = {}) {
    const my = ++S.round;
    const info = docInfo(path);
    if (!info) return;
    let text = null, failed = true, why = '';
    // ไฟล์จริงก่อน แล้วสำเนาที่มากับตัวแพ็ก (ไฟล์ .d.ts ถูกตัวแพ็กตัดทิ้ง — ดู DOC_PACKED_COPIES)
    for (const p of docReadPaths(path)) {
      try { text = await io.read(p); failed = false; break; } catch (e) { why = String((e && e.message) || e); }
    }
    if (failed) log('warn', 'docs: page not readable', { path, error: why });
    if (my !== S.round || !ov.isConnected) return;
    if (push && S.path && S.path !== path) S.back.push({ path: S.path, top: body.scrollTop });
    S.path = path;
    S.book = info.book;
    if (info.lang) S.lang = info.lang;
    await loadToc();
    if (my !== S.round || !ov.isConnected) return;
    box.dataset.book = S.book;
    box.dataset.path = path;
    let title = '';
    if (failed) {
      body.replaceChildren(el('div', 'k-docs-missing', tf('ui.docs.notFound', path)));
    } else if (/\.md$/i.test(path)) {
      title = docBlocks(text).title;
      body.replaceChildren(...nodesOf(text));
    } else {
      // ไฟล์ข้อความที่ไม่ใช่มาร์กดาวน์ (k2.d.ts · plugin.json ของตัวอย่าง) = โค้ดทั้งไฟล์
      title = path.split('/').pop();
      body.replaceChildren(el('div', 'k-cl-title', title), el('pre', 'k-cl-code', text));
    }
    syncBar(title);
    body.scrollTop = top;
    if (hash) scrollToAnchor(hash);
    log('info', 'docs: page shown', { book: S.book, lang: S.lang, page: path.split('/').pop() });
  }

  bBack.onclick = () => { const b = S.back.pop(); if (b) go(b.path, { top: b.top }); };
  sel.onchange = () => { const row = S.toc[+sel.value]; if (row) go(row.path, { push: true }); };
  const step = (d) => { const at = S.toc.findIndex((row) => row.path === S.path); const row = S.toc[at + d]; if (at >= 0 && row) go(row.path, { push: true }); };
  bPrev.onclick = () => step(-1);
  bNext.onclick = () => step(1);
  selLang.onchange = () => {
    rememberLang(selLang.value);
    S.lang = selLang.value;
    go(docInLang(S.path, selLang.value), { push: false });
  };

  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  escClose(ov, close);
  document.body.append(ov);
  ov.k2ready = go(opts.path && docInfo(opts.path) ? opts.path : docHome(S.book, S.lang), { hash: opts.hash || '' });
  setTimeout(() => { try { body.focus(); } catch {} }, 0);
  return ov;
}
