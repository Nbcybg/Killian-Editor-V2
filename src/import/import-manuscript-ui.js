// import-manuscript-ui.js — [alpha.170 · นำเข้าต้นฉบับ] กล่อง "นำเข้าต้นฉบับ (Word · Markdown · ข้อความ)"
//
// เลือกไฟล์หลายไฟล์ / ทั้งโฟลเดอร์ / วางข้อความ → ดูโครงบท-ฉากที่จะได้ก่อน → เขียนเป็น "เล่มใหม่" ในโปรเจกต์ที่เปิดอยู่
// ตรรกะทั้งหมดอยู่ที่ `import-manuscript.js` (บริสุทธิ์ · unit `import-manuscript`) — ไฟล์นี้แค่อ่านไฟล์/แตก .docx/วาด/เขียน
// ★ ไม่แตะไฟล์ของผู้ใช้เลยสักไฟล์ (ต้นฉบับ · เล่มเดิม) — สร้างโฟลเดอร์เล่มใหม่อย่างเดียว ไม่มีแท็บไหนต้องปิด/บันทึก
// ★ e2e: `importManuscriptDialog({ paths, text, auto })` ข้ามกล่องเลือกไฟล์ของระบบ · `auto:true` = กดนำเข้าเอง

import JSZip from 'jszip';
import { state, el, t, tf, log, logAction, setStatus, setStatusError, withBusyTask } from '../core.js';
import { isCancelled, throwIfCancelled } from '../cancel.js';
import { toast } from '../ui.js';
import { freeBookName } from '../disk-sync.js';
import * as IM from './import-manuscript.js';

const EXT_DOCX = /\.docx$/i;
const EXT_MD = /\.(md|markdown|mdown|mkd)$/i;
const EXT_TXT = /\.(txt|text)$/i;
const supported = (p) => EXT_DOCX.test(p) || EXT_MD.test(p) || EXT_TXT.test(p);
const baseName = (p) => String(p || '').split(/[\\/]/).pop();

const MODE_KEYS = {
  'auto': 'ui.manuscript.modeAuto',
  'file-chapter': 'ui.manuscript.modeFileChapter',
  'headings': 'ui.manuscript.modeHeadings',
  'file-scene': 'ui.manuscript.modeFileScene',
};

/**
 * อ่านต้นฉบับหนึ่งไฟล์ → { name, title, content, images:[{key, path, alt, zip}], warn? }
 * .docx แตกด้วย JSZip (ไบต์ผ่าน `kapi.readBytes` — กฎข้อ 10) · .md / .txt อ่านเป็นข้อความ
 */
async function readSource(path, idx) {
  const name = baseName(path);
  if (/\.doc$/i.test(path)) return { name, warn: { code: 'oldDoc', name } };
  if (!supported(path)) return { name, warn: { code: 'unsupported', name } };
  try {
    if (EXT_DOCX.test(path)) {
      const zip = await JSZip.loadAsync(new Uint8Array(await kapi.readBytes(path)));
      const part = async (p) => { const f = zip.file(p); return f ? f.async('string') : ''; };
      const document = await part('word/document.xml');
      if (!document) return { name, warn: { code: 'readFail', name } };
      const r = IM.docxToDoc({ document, styles: await part('word/styles.xml'), numbering: await part('word/numbering.xml'),
        rels: await part('word/_rels/document.xml.rels') }, { keyPrefix: `k2img:${idx}:` });
      let title = '';
      try { title = ((await part('docProps/core.xml')).match(/<dc:title>([^<]*)<\/dc:title>/) || [])[1] || ''; } catch { /* ไม่มีก็ได้ */ }
      return { name, title: title.trim(), content: r.content, images: r.images.map((im) => ({ ...im, zip })) };
    }
    const text = await kapi.readFile(path);
    const r = EXT_MD.test(path) ? IM.mdToImportDoc(text) : IM.textToImportDoc(text);
    return { name, title: r.title || '', content: r.content, images: [] };
  } catch (e) {
    log('warn', 'manuscript: read failed', { path, err: e });
    return { name, warn: { code: 'readFail', name } };
  }
}

/** ข้อความคำเตือนจากรหัส (ตารางคีย์เต็ม — ห้ามประกอบคีย์) */
const WARN_KEYS = {
  empty: 'ui.manuscript.warnEmpty',
  noHeadings: 'ui.manuscript.warnNoHeadings',
  unsupported: 'ui.manuscript.warnUnsupported',
  oldDoc: 'ui.manuscript.warnOldDoc',
  readFail: 'ui.manuscript.warnReadFail',
  badImages: 'ui.manuscript.warnImagesSkipped',
};
const warnText = (w) => tf(WARN_KEYS[w.code] || 'ui.manuscript.warnReadFail', w.name ?? w.n ?? '');

/**
 * กล่องนำเข้าต้นฉบับ
 * @param {{paths?:string[], text?:string, mode?:string, book?:string, auto?:boolean}} [opts] สำหรับ e2e/ทางลัด
 * @returns {Promise<{book:string, chapters:number, scenes:number, firstScene:string}|null>}
 */
export async function importManuscriptDialog(opts = {}) {
  if (!state.root) {
    toast(t('ui.manuscript.needProject'), { level: 'warn', action: { label: t('ui.manuscript.newProject'),
      onClick: async () => { const { handleCommand } = await import('../app.js'); handleCommand('new-project'); } } });
    return null;
  }
  return new Promise((resolve) => {
    const S = { paths: [], text: '', pasting: false, sources: [], book: '', bookTouched: false, mode: opts.mode || 'auto', detect: true, split: null, srcWarn: [] };

    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide k-msimp');
    box.append(el('div', 'k-dlg-title', t('ui.manuscript.title')));
    box.append(el('div', 'k-hint', t('ui.manuscript.intro')));

    // ── แหล่ง ──
    const srcRow = el('div', 'k-msimp-src');
    const bFiles = el('button', 'cmp-mini', t('ui.manuscript.pickFiles'));
    const bDir = el('button', 'cmp-mini', t('ui.manuscript.pickFolder'));
    const bPaste = el('button', 'cmp-mini', t('ui.manuscript.pasteText'));
    srcRow.append(bFiles, bDir, bPaste);
    const srcInfo = el('div', 'k-msimp-files');
    const ta = el('textarea', 'k-dlg-input k-dlg-multi k-msimp-paste');
    ta.rows = 8; ta.placeholder = t('ui.manuscript.pastePh'); ta.hidden = true;
    box.append(srcRow, srcInfo, ta);

    // ── ตัวเลือก ──
    const optRow = el('div', 'k-row k-msimp-opts');
    const lBook = el('label', 'k-msimp-lbl', t('ui.manuscript.bookName'));
    const inBook = el('input', 'k-dlg-input k-msimp-book');
    inBook.placeholder = t('ui.manuscript.bookPh');
    const lMode = el('label', 'k-msimp-lbl', t('ui.manuscript.splitLabel'));
    const selMode = el('select', 'k-dlg-select k-msimp-mode');
    for (const m of IM.SPLIT_MODES) { const o = el('option', null, t(MODE_KEYS[m])); o.value = m; selMode.append(o); }
    selMode.value = S.mode;
    optRow.append(lBook, inBook, lMode, selMode);
    const detRow = el('label', 'k-msimp-det');
    const cbDetect = el('input'); cbDetect.type = 'checkbox'; cbDetect.checked = true;
    detRow.append(cbDetect, el('span', null, t('ui.manuscript.detect')));
    box.append(optRow, detRow);

    // ── ตัวอย่าง ──
    const prev = el('div', 'k-msimp-preview k-selectable');
    box.append(prev);

    const btns = el('div', 'k-dlg-btns');
    const bCancel = el('button', 'k-cancel', t('ui.common.cancel'));
    const bOk = el('button', 'k-ok', t('ui.common.importBtn'));
    btns.append(bCancel, bOk);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);

    let closed = false;
    const done = (v) => { if (closed) return; closed = true; ov.remove(); resolve(v); };
    bCancel.onclick = () => done(null);

    const docsForSplit = () => {
      if (S.pasting) {
        const r = IM.textToImportDoc(S.text);
        return [{ name: t('ui.manuscript.pasteSource'), title: inBook.value.trim() || t('ui.manuscript.pasteSource'), content: r.content }];
      }
      return S.sources.filter((s) => s.content).map((s) => ({ name: s.name, title: s.title || '', content: s.content }));
    };

    const render = () => {
      const docs = docsForSplit();
      S.split = docs.length ? IM.splitManuscript(docs, { mode: S.mode, detect: S.detect, chapterTitle: t('ui.common.chapterOne2') }) : null;
      // ชื่อไฟล์ที่เลือก
      srcInfo.replaceChildren();
      if (!S.pasting) {
        if (!S.paths.length) srcInfo.append(el('div', 'k-hint', t('ui.manuscript.noSource')));
        else {
          srcInfo.append(el('div', 'k-msimp-count', tf('ui.manuscript.filesF', S.paths.length)));
          const ol = el('ol', 'k-msimp-list');
          for (const p of S.paths.slice(0, 50)) ol.append(el('li', null, baseName(p)));
          if (S.paths.length > 50) ol.append(el('li', 'k-hint', tf('ui.manuscript.moreF', S.paths.length - 50)));
          srcInfo.append(ol);
        }
      }
      prev.replaceChildren();
      const sp = S.split;
      const warns = [...S.srcWarn, ...(sp ? sp.warnings : [])];
      const badImg = S.sources.reduce((n, s) => n + (s.images || []).filter((im) => !IM.imageExtOf(im.path)).length, 0);
      if (badImg) warns.push({ code: 'badImages', n: badImg });
      if (sp && sp.counts.scenes) {
        prev.append(el('div', 'k-msimp-sum', tf('ui.manuscript.summaryF', sp.counts.chapters, sp.counts.scenes, sp.counts.words)
          + (sp.counts.images ? ' · ' + tf('ui.manuscript.imagesF', sp.counts.images) : '')));
        const ul = el('ul', 'k-msimp-tree');
        sp.chapters.slice(0, 200).forEach((c, i) => {
          const li = el('li');
          li.append(el('span', 'k-msimp-ch', c.title || tf('ui.manuscript.chapterF', i + 1)));
          li.append(el('span', 'k-msimp-sc', ' — ' + (c.scenes.length === 1 && c.scenes[0].title === c.title
            ? tf('ui.manuscript.sceneCountF', 1)
            : c.scenes.map((s) => s.title).slice(0, 6).join(' · ') + (c.scenes.length > 6 ? ' · ' + tf('ui.manuscript.sceneMoreF', c.scenes.length - 6) : ''))));
          ul.append(li);
        });
        if (sp.chapters.length > 200) ul.append(el('li', 'k-hint', tf('ui.manuscript.moreChF', sp.chapters.length - 200)));
        prev.append(ul);
      } else if (S.paths.length || S.text.trim()) {
        prev.append(el('div', 'k-hint', t('ui.manuscript.nothing')));
      }
      for (const w of warns) prev.append(el('div', 'k-hint k-msimp-warn', warnText(w)));
      bOk.disabled = !(sp && sp.counts.scenes);
    };

    const suggestBook = (title) => {
      if (S.bookTouched) return;
      inBook.value = title || '';
    };

    const loadPaths = async (paths, folderTitle) => {
      S.pasting = false; ta.hidden = true;
      S.paths = [...paths].sort(IM.naturalCompare);
      S.sources = []; S.srcWarn = [];
      render();
      try {
        await withBusyTask(t('ui.manuscript.reading'), async ({ signal, progress }) => {
          for (let i = 0; i < S.paths.length; i++) {
            throwIfCancelled(signal);
            const r = await readSource(S.paths[i], i);
            if (r.warn) S.srcWarn.push(r.warn); else S.sources.push(r);
            progress(i + 1, S.paths.length);
          }
        }, { name: t('ui.manuscript.taskName') });
      } catch (e) { if (!isCancelled(e)) setStatusError(String(e && e.message || e)); }
      if (closed) return;
      const one = S.sources.length === 1 ? (S.sources[0].title || IM.titleFromFileName(S.sources[0].name)) : '';
      suggestBook(folderTitle || one);
      render();
    };

    bFiles.onclick = async () => {
      const ps = await kapi.openManuscriptFiles();
      if (ps && ps.length) await loadPaths(ps, '');
    };
    bDir.onclick = async () => {
      const dir = await kapi.openDirDialog();
      if (!dir) return;
      let files = [];
      try { files = await kapi.listFiles(dir); } catch { files = []; }
      const sep = dir.includes('\\') ? '\\' : '/';
      const ps = files.filter((f) => supported(f) || /\.doc$/i.test(f)).filter((f) => !/^[~.]/.test(f)).map((f) => dir.replace(/[\\/]+$/, '') + sep + f);
      await loadPaths(ps, baseName(dir));
      if (!ps.length) { S.srcWarn = [{ code: 'unsupported', name: baseName(dir) }]; render(); }
    };
    bPaste.onclick = () => {
      S.pasting = true; S.paths = []; S.sources = []; S.srcWarn = [];
      ta.hidden = false; ta.focus();
      render();
    };
    let tmr = 0;
    ta.oninput = () => { S.text = ta.value; clearTimeout(tmr); tmr = setTimeout(render, 250); };
    inBook.oninput = () => { S.bookTouched = !!inBook.value.trim(); S.book = inBook.value.trim(); };
    selMode.onchange = () => { S.mode = selMode.value; render(); };
    cbDetect.onchange = () => { S.detect = cbDetect.checked; render(); };

    bOk.onclick = async () => {
      if (bOk.disabled) return;
      bOk.disabled = true;
      const res = await writeBook(S, inBook.value.trim());
      if (res) done(res); else { bOk.disabled = false; render(); }
    };

    render();
    // ทางลัดของ e2e / ผู้เรียก: ข้ามกล่องเลือกไฟล์ของระบบ
    (async () => {
      if (opts.book) { inBook.value = opts.book; S.bookTouched = true; }
      if (opts.text != null) { bPaste.onclick(); ta.value = opts.text; S.text = opts.text; render(); }
      else if (opts.paths && opts.paths.length) await loadPaths(opts.paths, opts.folderTitle || '');
      if (opts.auto && !closed) bOk.onclick();
    })();
  });
}

/** เขียนเล่มใหม่จากผลแบ่งบท/ฉาก — คืน null เมื่อล้ม (บอกผู้ใช้แล้ว) */
async function writeBook(S, wantTitle) {
  const sp = S.split;
  if (!sp || !sp.counts.scenes) return null;
  const root = state.root;
  try {
    return await withBusyTask(t('ui.manuscript.writing'), async ({ signal, progress }) => {
      // ชื่อเล่ม = ชื่อโฟลเดอร์ (กฎ alpha.170) · ว่าง = `Book N` · ชนกับโฟลเดอร์อื่น/ชื่อสงวน = ต่อเลขให้ (ทางอัตโนมัติ)
      const b = await freeBookName(kapi, root, wantTitle || '');
      let maxOrder = 0;
      for (const nm of await kapi.listDirs(root)) {
        const sf = await kapi.join(root, nm, 'section.json');
        if (await kapi.exists(sf)) { try { maxOrder = Math.max(maxOrder, (await kapi.readJson(sf)).order || 0); } catch { /* เล่มที่ทะเบียนเสีย ไม่นับ */ } }
      }
      // รูปที่ใช้ได้เท่านั้น (emf/wmf ของ Word แสดงบนเว็บไม่ได้)
      const imgSrc = new Map();
      const images = new Map();
      for (const s of S.sources) for (const im of s.images || []) {
        const ext = IM.imageExtOf(im.path);
        if (!ext || !im.zip.file(im.path)) continue;
        imgSrc.set(im.key, im);
        images.set(im.key, { ext, name: im.alt || baseName(im.path).replace(/\.[^.]+$/, '') });
      }
      const plan = IM.buildBookPlan(sp, {
        bookTitle: b.title, bookFolder: b.folder, order: maxOrder + 1, images,
        guid: () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
        now: new Date().toISOString(), source: S.pasting ? 'paste' : 'manuscript',
        chapterFallback: (i) => tf('ui.manuscript.chapterF', i + 1),
      });
      let n = 0;
      let first = '';
      for (const f of plan.files) {
        throwIfCancelled(signal);
        const full = await kapi.join(root, ...f.path);
        if (f.image) {
          const im = imgSrc.get(f.image);
          await kapi.mkdir(await kapi.join(root, ...f.path.slice(0, -1)));
          await kapi.writeBytes(full, Array.from(await im.zip.file(im.path).async('uint8array')));
        } else {
          await kapi.writeFile(full, f.content);
          if (!first && /\.md$/i.test(full)) first = full;
        }
        progress(++n, plan.files.length);
      }
      if (images.size) {
        try { const AC = await import('../gallery/album-core.js'); await AC.syncFlatIndex(kapi, root); } catch { /* คลังรูปซิงก์เองตอนเปิดคลัง */ }
      }
      logAction('import', 'manuscript → ' + plan.book, { chapters: plan.chapters, scenes: plan.scenes, files: plan.files.length });
      const { buildTree, refreshNetwork, openScene } = await import('../app.js');
      await buildTree();
      try { refreshNetwork(); } catch { /* ผังยังไม่เปิด */ }
      const msg = tf('ui.manuscript.doneF', b.title, plan.chapters, plan.scenes);
      setStatus(msg);
      toast(msg, { level: 'ok' });
      if (first) openScene(first, '');
      return { book: plan.book, chapters: plan.chapters, scenes: plan.scenes, firstScene: first };
    }, { name: t('ui.manuscript.taskName') });
  } catch (e) {
    if (!isCancelled(e)) {
      log('error', 'manuscript: write failed', e);
      setStatusError(tf('ui.manuscript.writeFailF', String(e && e.message || e)));
    }
    return null;
  }
}
