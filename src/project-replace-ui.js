// project-replace-ui.js — [alpha.156] กล่อง "ค้นหาและแทนที่ทั้งโปรเจกต์"
//
// ตรรกะอยู่ที่ project-replace.js (บริสุทธิ์) · ที่นี่: รวบรวมเอกสาร → ดูตัวอย่าง → แทนที่จริง
// กติกาเรื่องแท็บ (เหมือนสะพาน tab-bridge ของ AI):
//   · แท็บที่มีงานค้าง → แก้ในแท็บ (ยังไม่ลงไฟล์ — ผู้ใช้บันทึกเอง) · อ่านเนื้อจากแท็บ ไม่ใช่จากดิสก์
//   · แท็บที่ไม่มีงานค้าง / ไม่ได้เปิด → เขียนไฟล์ (รักษาคอมเมนต์ท้ายไฟล์) แล้วโหลดแท็บใหม่
//   · ฉากที่ล็อก (ของตัวเองหรือเล่ม/บทที่ห่อไว้) ไม่ถูกแตะ
import { t, tf } from './i18n.js';
import { el, state, setStatus, log, logAction, withBusy } from './core.js';
import { confirmBox, escClose } from './ui.js';
import { parseMdFile, dumpMdFile } from './md.js';
import { planReplace, replaceAllInText, buildMatcher } from './project-replace.js';
import { tabHandle } from './tab-bridge.js';
import { SKIP_DIRS } from './project-scan.js';

// โฟลเดอร์ที่ไม่ใช่เนื้อเรื่อง (สำเนา/ประวัติ/ถังขยะ) — แทนที่ในนั้นเท่ากับไปแก้ประวัติของตัวเอง
const SKIP = new Set([...SKIP_DIRS, '.k2history', 'Plugins', 'languages', 'Fonts', 'Wiki', 'Bible']);

/** เอกสาร .md ทั้งโปรเจกต์ที่แทนที่ได้ → [{file,title,body,locked}] */
export async function collectReplaceDocs() {
  if (!state.root) return [];
  const { containerLockOf } = await import('./tree-actions.js');
  const out = [];
  const walk = async (dir, depth) => {
    if (depth > 12) return;
    for (const name of await kapi.listDirs(dir).catch(() => [])) {
      if (SKIP.has(name) || name.startsWith('.')) continue;
      await walk(await kapi.join(dir, name), depth + 1);
    }
    for (const f of await kapi.listFiles(dir, '.md').catch(() => [])) {
      const file = await kapi.join(dir, f);
      let body = '', meta = {};
      const h = tabHandle(file);
      try {
        const parsed = parseMdFile(await kapi.readFile(file));
        meta = parsed.meta; body = parsed.body;
      } catch { continue; }
      if (h && h.dirty && (h.kind === 'prose' || h.kind === 'sp')) body = h.getText();
      let locked = meta.locked === true || meta.locked === 'true';
      if (!locked) { try { locked = !!(await containerLockOf(file)); } catch {} }
      out.push({ file, title: meta.title || f.replace(/\.md$/i, ''), body, locked });
    }
  };
  await walk(state.root, 0);
  return out;
}

/** แทนที่จริง — คืน {files, count} */
export async function runProjectReplace(query, repl, opts = {}, { docs } = {}) {
  const list = docs || await collectReplaceDocs();
  const { writeKeepingComments } = await import('./comments/comment-ui.js');
  let files = 0, count = 0;
  for (const d of list) {
    if (d.locked) continue;
    const r = replaceAllInText(d.body, query, repl, opts);
    if (!r.count) continue;
    const h = tabHandle(d.file);
    try {
      if (h && h.dirty && (h.kind === 'prose' || h.kind === 'sp')) {
        h.setText(r.text, { keepAlign: true });
      } else {
        const { meta } = parseMdFile(await kapi.readFile(d.file));
        await writeKeepingComments(d.file, dumpMdFile(meta, r.text));
        if (h) await h.reloadFromDisk();
      }
      files++; count += r.count;
    } catch (e) { log('error', t('ui.replace.fileFail') + d.file, e); }
  }
  logAction('replace', tf('ui.replace.doneLog', count, files, query, repl), { query, repl, opts });
  try { (await import('./global-search.js')).invalidateSearchIndex(); } catch {}
  try { (await import('./app.js')).buildTree(); } catch {}
  return { files, count };
}

/** กล่องค้นหา-แทนที่ทั้งโปรเจกต์ */
export async function openProjectReplace(initial = '') {
  if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return null; }
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-replace');
  box.append(el('div', 'k-dlg-title', t('ui.replace.title')));
  box.append(el('div', 'k-hint', t('ui.replace.hint')));
  const mkInput = (labelKey, phKey, val) => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, t(labelKey)));
    const i = el('input', 'k-dlg-input'); i.type = 'text'; i.placeholder = t(phKey); i.value = val || '';
    r.append(i); box.append(r); return i;
  };
  const iFind = mkInput('ui.replace.find', 'ui.replace.findPh', initial);
  const iWith = mkInput('ui.replace.with', 'ui.replace.withPh', '');
  const optRow = el('div', 'k-row k-replace-opts');
  const mkChk = (key) => {
    const w = el('label', null); const c = el('input'); c.type = 'checkbox';
    w.append(c, document.createTextNode(' ' + t(key))); optRow.append(w); return c;
  };
  const cCase = mkChk('ui.replace.caseSensitive');
  const cWord = mkChk('ui.replace.wholeWord');
  const cRe = mkChk('ui.replace.regex');
  box.append(optRow);
  const summary = el('div', 'k-replace-summary dim');
  const list = el('div', 'k-replace-list');
  box.append(summary, list);
  const btns = el('div', 'k-dlg-btns');
  const bPrev = el('button', null, t('ui.replace.preview'));
  const bClose = el('button', 'k-cancel', t('ui.common.close'));
  const bRun = el('button', 'k-ok', t('ui.replace.run'));
  btns.append(bPrev, bClose, bRun); box.append(btns);
  ov.append(box); document.body.append(ov);
  const close = () => ov.remove();
  bClose.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  escClose(ov, close);

  const opts = () => ({ caseSensitive: cCase.checked, wholeWord: cWord.checked, regex: cRe.checked });
  let docs = null, plan = null;
  const preview = async () => {
    list.replaceChildren();
    if (!buildMatcher(iFind.value, opts())) { summary.textContent = t('ui.replace.badQuery'); plan = null; bRun.disabled = true; return null; }
    summary.textContent = t('ui.replace.scanning');
    docs = await withBusy(t('ui.replace.scanning'), () => collectReplaceDocs());
    plan = planReplace(docs, iFind.value, opts());
    if (!plan.files.length) { summary.textContent = t('ui.replace.none'); bRun.disabled = true; return plan; }
    summary.textContent = tf('ui.replace.summary', plan.total, plan.files.filter((f) => !f.locked).length)
      + (plan.lockedSkipped ? ' · ' + tf('ui.replace.lockedSkip', plan.lockedSkipped) : '');
    for (const f of plan.files) {
      const row = el('div', 'k-replace-row' + (f.locked ? ' k-replace-locked' : ''));
      const head = el('div', 'k-replace-head');
      head.append(el('span', 'k-replace-name', f.title), el('span', 'dim', ' · ' + f.count));
      if (f.locked) head.append(el('span', 'k-replace-badge', t('ui.replace.lockedBadge')));
      row.append(head);
      for (const m of f.matches) {
        const line = el('div', 'k-replace-line');
        line.append(el('span', 'dim', m.before), el('mark', null, m.match), el('span', 'dim', m.after));
        row.append(line);
      }
      list.append(row);
    }
    bRun.disabled = !plan.total;
    return plan;
  };
  const run = async ({ ask = true } = {}) => {
    if (!plan) await preview();
    if (!plan || !plan.total) return { files: 0, count: 0 };
    const nFiles = plan.files.filter((f) => !f.locked).length;
    if (ask && !(await confirmBox(tf('ui.replace.confirm', plan.total, nFiles)))) return null;
    bRun.disabled = true;
    const res = await withBusy(t('ui.replace.scanning'), () => runProjectReplace(iFind.value, iWith.value, opts(), { docs }));
    setStatus(tf('ui.replace.done', res.count, res.files));
    plan = null;
    await preview();
    return res;
  };
  // เปลี่ยนเงื่อนไข = ตัวอย่างเก่าใช้ไม่ได้
  for (const n of [iFind, cCase, cWord, cRe]) n.addEventListener(n === iFind ? 'input' : 'change', () => { plan = null; bRun.disabled = false; });
  iFind.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); preview(); } };
  bPrev.onclick = () => preview();
  bRun.onclick = () => run();
  iFind.focus();
  if (initial) await preview();
  return { ov, close, preview, run, iFind, iWith, cCase, cWord, cRe };
}
