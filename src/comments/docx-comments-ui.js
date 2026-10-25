// docx-comments-ui.js — [alpha.170 · คอมเมนต์ไปกลับกับ Word] "รับคอมเมนต์จากไฟล์ Word…"
//
// ไฟล์ .docx ที่ บก. ตอบ/คอมเมนต์เพิ่ม/กด Resolve → อ่านเธรด → จับคู่กับฉากในโปรเจกต์ (ข้อความที่ผูก + บริบทย่อหน้า)
// → ดูสรุปก่อน → เขียนลงบล็อกคอมเมนต์ท้ายไฟล์ฉาก (ทาง CommentStore เดียวกับแผงคอมเมนต์ — เนื้อฉากไม่ถูกแตะ)
// ตรรกะอยู่ที่ `docx-comments.js` (บริสุทธิ์ · unit `docx-comments`)
// ★ e2e: `importDocxCommentsDialog({ path, auto })` ข้ามกล่องเลือกไฟล์ · auto = กดนำเข้าเอง

import JSZip from 'jszip';
import { state, el, t, tf, log, logAction, setStatus, setStatusError, withBusyTask } from '../core.js';
import { isCancelled, throwIfCancelled } from '../cancel.js';
import { infoBox, toast } from '../ui.js';
import { parseMdFile, inlinePlainText } from '../md.js';
import { parseComments, stripComments } from './comment-core.js';
import { readDocxComments, planCommentImport } from './docx-comments.js';
import { commentStore, renderCommentPanel } from './comment-ui.js';
import { collectPlacedScenes } from '../scene-list.js';

const short = (s, n = 60) => { const a = Array.from(String(s || '').replace(/\s+/g, ' ').trim()); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };

/** อ่านเธรดคอมเมนต์จาก .docx (ไบต์ผ่าน readBytes — กฎข้อ 10) */
async function readThreads(path) {
  const zip = await JSZip.loadAsync(new Uint8Array(await kapi.readBytes(path)));
  const part = async (p) => { const f = zip.file(p); return f ? f.async('string') : ''; };
  return readDocxComments({ document: await part('word/document.xml'), comments: await part('word/comments.xml'),
    commentsExtended: await part('word/commentsExtended.xml') });
}

/** ฉากทุกฉากของโปรเจกต์ในรูปที่ planCommentImport ต้องการ */
async function sceneTexts(signal, progress) {
  const out = [];
  const rows = await collectPlacedScenes();
  let i = 0;
  for (const r of rows) {
    throwIfCancelled(signal);
    let raw = '';
    try { raw = await kapi.readFile(r.filePath); } catch { continue; }
    const noBlock = stripComments(raw);                     // ตำแหน่งสมอนับจากนี่ (แบบเดียวกับ CommentStore)
    let body = noBlock;
    try { body = parseMdFile(noBlock).body; } catch { /* ไม่มี frontmatter */ }
    const plain = body.split('\n').map((l) => inlinePlainText(l)).join('\n');
    out.push({ key: r.filePath, raw: noBlock, plain, comments: parseComments(raw), title: r.title || '' });
    progress(++i, rows.length);
  }
  return out;
}

/**
 * @param {{path?:string, auto?:boolean}} [opts]
 * @returns {Promise<{stats:object, files:number}|null>}
 */
export async function importDocxCommentsDialog(opts = {}) {
  if (!state.root) { setStatus(t('ui.dxc.needProject')); return null; }
  const path = opts.path || await kapi.openFileDialog('docx');
  if (!path) return null;
  let threads, scenes, plan;
  try {
    ({ threads, scenes, plan } = await withBusyTask(t('ui.dxc.reading'), async ({ signal, progress }) => {
      const th = await readThreads(path);
      if (!th.length) return { threads: th, scenes: [], plan: null };
      const sc = await sceneTexts(signal, progress);
      return { threads: th, scenes: sc, plan: planCommentImport(th, sc) };
    }, { name: t('ui.dxc.taskName') }));
  } catch (e) {
    if (isCancelled(e)) return null;
    log('warn', 'docx-comments: read failed', { path, err: e });
    setStatusError(tf('ui.dxc.readFailF', path.split(/[\\/]/).pop()));
    return null;
  }
  if (!threads.length) { await (opts.auto ? Promise.resolve() : infoBox(t('ui.dxc.none'))); return { stats: null, files: 0 }; }

  const st = plan.stats;
  const titleOf = new Map(scenes.map((s) => [s.key, s.title]));
  // บรรทัดที่เป็นศูนย์ไม่ต้องโชว์ ("ปิด 0 เธรด" = เสียงรบกวน) · คอมเมนต์ใหม่โชว์เสมอ
  const lines = [tf('ui.dxc.sumNewF', st.added)];
  if (st.replies) lines.push(tf('ui.dxc.sumRepliesF', st.replies));
  if (st.resolved) lines.push(tf('ui.dxc.sumResolvedF', st.resolved));
  if (st.same) lines.push(tf('ui.dxc.sumSameF', st.same));
  if (st.unmatched) lines.push(tf('ui.dxc.sumUnmatchedF', st.unmatched));
  const go = plan.updates.size > 0 && (opts.auto ? true : await confirmImport(lines, plan, titleOf));
  if (!go) {
    if (!plan.updates.size && !opts.auto) await infoBox(t('ui.dxc.nothingNew'), { detail: unmatchedDetail(plan) || '' });
    return plan.updates.size ? null : { stats: st, files: 0 };
  }
  const store = commentStore();
  let files = 0;
  try {
    for (const [file, comments] of plan.updates) {
      const { body } = await store.read(file);
      await store.write(file, body, comments);
      files++;
    }
  } catch (e) {
    log('error', 'docx-comments: write failed', e);
    setStatusError(tf('ui.dxc.writeFailF', String(e && e.message || e)));
    return null;
  }
  logAction('comments', 'import from docx', { path, ...st, files });
  const msg = tf('ui.dxc.doneF', st.added + st.replies, files);
  setStatus(msg);
  toast(msg, { level: 'ok' });
  try { await renderCommentPanel(); } catch { /* แผงไม่ได้เปิด */ }
  if (st.unmatched && !opts.auto) await infoBox(tf('ui.dxc.unmatchedTitleF', st.unmatched), { detail: unmatchedDetail(plan) });
  return { stats: st, files };
}

function unmatchedDetail(plan) {
  return plan.unmatched.slice(0, 20).map((u) => (u.quote ? '“' + short(u.quote, 30) + '” — ' : '') + (u.author ? u.author + ': ' : '') + short(u.text)).join('\n');
}

/** กล่องสรุปก่อนนำเข้า — รายชื่อฉากที่จะได้คอมเมนต์ */
function confirmImport(lines, plan, titleOf) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-dxc');
    box.append(el('div', 'k-dlg-title', t('ui.dxc.title')));
    box.append(el('div', 'k-hint', t('ui.dxc.intro')));
    const ul = el('ul', 'k-dxc-sum');
    for (const l of lines) ul.append(el('li', null, l));
    box.append(ul);
    const sc = el('div', 'k-dxc-scenes k-selectable');
    sc.append(el('div', 'cmp-sub', tf('ui.dxc.scenesF', plan.updates.size)));
    for (const k of [...plan.updates.keys()].slice(0, 30)) sc.append(el('div', null, titleOf.get(k) || k.split(/[\\/]/).pop()));
    box.append(sc);
    const btns = el('div', 'k-dlg-btns');
    const no = el('button', 'k-cancel', t('ui.common.cancel'));
    const ok = el('button', 'k-ok', t('ui.dxc.apply'));
    btns.append(no, ok);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    no.onclick = () => done(false);
    ok.onclick = () => done(true);
  });
}
