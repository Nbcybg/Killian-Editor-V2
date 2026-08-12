// ai-summary.js — สรุปเนื้อหาด้วย AI (ข้อ 77) + แนะนำชื่อเรื่อง/ชื่อบท/ชื่อฉาก (ข้อ 78)
import { t as tt, tf as ttf, t, tf } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import { callAI, aiConfigured, getAISettings } from './ai-settings.js';
import { listEntities } from './project-scan.js';

const SKIP_SECTIONS = ['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Backups', 'Plugins', 'Research'];

// [alpha.62 บั๊ก 6] ตั้งค่าครบหรือยัง — ถามจุดเดียวที่ `aiConfigured()` (รู้จักทะเบียนใหม่ของ alpha.61)
// เดิมดูแต่ `loadApiKey()` ของรูปแบบเก่า → "แนะนำชื่อด้วย AI" ถูกบล็อกทั้งที่ตั้งค่าไว้เรียบร้อยแล้ว
async function aiReady() {
  const r = await aiConfigured();
  if (r.ok) return true;
  setStatus('❌ ' + r.why);
  return false;
}

// แฮชสั้น ๆ ของเนื้อหา (djb2) — ใช้ตัดสินว่าเนื้อเรื่องเปลี่ยนไปจากตอนสรุปครั้งก่อนหรือยัง
export function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * รวบรวมเนื้อหาทั้งโปรเจกต์เป็นข้อความก้อนเดียวสำหรับป้อน AI
 * แยกออกมาเป็นฟังก์ชันของตัวเองเพื่อ (1) รายงานความคืบหน้าได้ (2) selftest เรียกตรงได้โดยไม่ต้องยิง API
 * @param {{onProgress?:(done:number,total:number,label:string)=>void, includeWiki?:boolean,
 *          perScene?:number, maxChars?:number}} opts
 * @returns {Promise<{text:string, scenes:number, entities:number}>}
 */
export async function collectProjectText(opts = {}) {
  const { onProgress = null, includeWiki = true, perScene = 2000, maxChars = 8000 } = opts;
  let text = '# ' + (state.title || tt('ui.common.project')) + '\n\n';
  let scenes = 0, entities = 0;
  if (!state.root) return { text, scenes, entities };

  // ---- รอบแรก: ไล่หาว่ามีกี่ฉาก (เพื่อให้แถบความคืบหน้าบอกสัดส่วนจริง) ----
  const jobs = [];
  try {
    for (const sec of await kapi.listDirs(state.root)) {
      if (SKIP_SECTIONS.includes(sec)) continue;
      const sp = await kapi.join(state.root, sec);
      if (!(await kapi.exists(await kapi.join(sp, 'section.json')))) continue;
      const secData = await kapi.readJson(await kapi.join(sp, 'section.json')).catch(() => ({}));
      const dr = await kapi.join(sp, 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr)) {
        const dp = await kapi.join(dr, dn);
        const dj = await kapi.join(dp, 'draft.json');
        if (!(await kapi.exists(dj))) continue;
        const draft = await kapi.readJson(dj);
        const scData = await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}));
        const chMap = scData.chapters || {};
        let first = true;
        for (const ch of (draft.chapters || [])) {
          for (const sc of (chMap[ch.guid] || [])) {
            if (sc.type === 'memo') continue;
            jobs.push({ secTitle: first ? (secData.title || sec) : '', chTitle: ch.title || '',
                        file: await kapi.join(dp, 'Chapters', ch.folderName, sc.fileName) });
            first = false;
          }
        }
      }
    }
  } catch (e) { log('error', 'ai-summary: read failed', e); }

  // ---- รอบสอง: อ่านไฟล์จริง ----
  let lastCh = '';
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    if (onProgress) onProgress(i + 1, jobs.length, j.chTitle);
    if (j.secTitle) text += '## ' + j.secTitle + '\n';
    if (j.chTitle && j.chTitle !== lastCh) { text += '### ' + j.chTitle + '\n'; lastCh = j.chTitle; }
    try {
      const raw = await kapi.readFile(j.file);
      text += raw.slice(0, perScene) + '\n\n';
      scenes++;
    } catch { /* ไฟล์หาย/อ่านไม่ได้ → ข้าม */ }
    if (text.length > maxChars) break;               // เกินโควตา context แล้ว ไม่ต้องอ่านต่อ
  }

  // ---- คลัง Wiki (ตัวละคร/สถานที่) — เดิมสรุปจากเนื้อฉากอย่างเดียว AI เลยไม่รู้จักตัวละคร ----
  if (includeWiki) {
    try {
      const ents = await listEntities(state.root);
      entities = ents.length;
      if (ents.length) {
        text += tt('ui.aiSum.libraryDataWiki');
        for (const e of ents.slice(0, 60)) {
          const secTxt = (e.entity.sections || []).map((s) => s.content || '').join(' ')
            .replace(/\s+/g, ' ').slice(0, 160);
          text += `- [${e.cat}] ${e.name}${e.aliases?.length ? ' (' + e.aliases.join(', ') + ')' : ''}` +
                  (secTxt ? ': ' + secTxt : '') + '\n';
        }
      }
    } catch (e) { log('warn', tt('ui.aiSum.aiSummaryReadWiki'), e); }
  }

  return { text: text.slice(0, maxChars + 2000), scenes, entities };
}

// ---- กล่อง "กำลังทำงาน" ที่อัปเดตข้อความได้ (เดิมไม่มีอะไรบอกเลยระหว่างรอ AI) ----
function busyBox(title) {
  const ov = el('div', 'k-overlay k-busy');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', title));
  const msg = el('div', 'k-busy-msg', tt('ui.aiSum.busyStart'));
  msg.style.cssText = 'padding:8px 0;font-size:13px';
  const bar = el('div', 'k-busy-bar');
  bar.style.cssText = 'height:6px;border-radius:3px;background:var(--border);overflow:hidden';
  const fill = el('div', 'k-busy-fill');
  fill.style.cssText = 'height:100%;width:0;background:var(--accent,#d97757);transition:width .2s';
  bar.append(fill);
  box.append(msg, bar);
  ov.append(box);
  document.body.append(ov);
  return {
    set(textMsg, pct) { msg.textContent = textMsg; if (pct != null) fill.style.width = Math.round(pct * 100) + '%'; },
    close() { ov.remove(); },
  };
}

// ---- แคชผลสรุป (กดซ้ำโดยเนื้อเรื่องไม่เปลี่ยน = ไม่เสีย token ใหม่) ----
function readCache() { return (getAISettings().summaryCache) || null; }

// สถานะแคชเทียบกับเนื้อหาปัจจุบัน: 'fresh' = ใช้ซ้ำได้ · 'stale' = เนื้อหาเปลี่ยนแล้ว · 'none' = ยังไม่เคยสรุป
export function summaryCacheState(text) {
  const c = readCache();
  if (!c || !c.text) return 'none';
  return c.hash === hashText(text) ? 'fresh' : 'stale';
}
function writeCache(hash, textVal) {
  if (!state.meta) return;
  state.meta.ai = state.meta.ai || {};
  state.meta.ai.summaryCache = { hash, text: textVal, date: new Date().toISOString() };
}

export async function showAISummary({ force = false } = {}) {
  if (!state.root) { setStatus(tt('ui.common.cantOpenProject')); return; }
  if (!(await aiReady())) return;

  const busy = busyBox(tt('ui.aiSum.aISummaryBody'));
  let result = null, cached = false, cacheDate = '';
  try {
    busy.set(tt('ui.aiSum.busyReadBodyProject'), 0);
    const { text, scenes, entities } = await collectProjectText({
      onProgress: (done, total, label) =>
        busy.set(ttf('ui.aiSum.readScene', done, total, label ? ' — ' + label : ''), total ? done / total * 0.6 : 0),
    });
    const h = hashText(text);
    const cache = readCache();
    if (!force && cache && cache.hash === h && cache.text) {
      result = cache.text; cached = true; cacheDate = cache.date;
      busy.set(tt('ui.aiSum.useResultSummarySave'), 1);
    } else {
      busy.set(ttf('ui.aiSum.busySendAISummary', scenes, entities), 0.7);
      const prompt = ttf('ui.aiSum.summaryBodyNovelScreenplay', text);
      result = await callAI(prompt, tt('ui.aiSum.youWriterHelpSummary'));
      if (result) { writeCache(h, result); try { const { saveProjectMeta } = await import('./app.js'); await saveProjectMeta(); } catch {} }
      busy.set(tt('ui.aiSum.doneDone'), 1);
    }
  } finally { busy.close(); }
  if (!result) return;

  // แสดงใน dialog
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-ai-summary');
  box.append(el('div', 'k-dlg-title', tt('ui.aiSum.aISummaryBody2') + state.title));
  if (cached) {
    const note = el('div', 'dim', tt('ui.aiSum.resultSave') + new Date(cacheDate).toLocaleString('th-TH') +
                                  tt('ui.aiSum.bodyNotChangePress'));
    note.style.cssText = 'font-size:11px;margin:-4px 0 6px';
    box.append(note);
  }

  const content = el('div', 'k-ai-summary-body');
  content.style.cssText = 'max-height:55vh;overflow-y:auto;white-space:pre-wrap;font-size:14px;line-height:1.8;padding:8px 0';
  content.textContent = result;
  box.append(content);

  const btns = el('div', 'k-dlg-btns');
  const againB = el('button', null, tt('ui.aiSum.summaryNew'));
  againB.title = tt('ui.aiSum.callAINewUse');
  againB.onclick = () => { ov.remove(); showAISummary({ force: true }); };
  const exportB = el('button', null, tt('ui.common.exportMd'));
  exportB.onclick = async () => {
    const dest = await kapi.saveAsDialog(state.title + '-summary.md', 'md');
    if (!dest) return;
    await kapi.writeFile(dest, '# ' + state.title + tt('ui.aiSum.summary') + result);
    setStatus(tt('ui.aiSum.exportSummaryDone'));
  };
  const closeB = el('button', 'k-ok', tt('ui.common.close'));
  closeB.onclick = () => ov.remove();
  btns.append(againB, exportB, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ---------------- แนะนำชื่อด้วย AI (ข้อ 78) ----------------
// ใช้ได้ทั้งชื่อโปรเจกต์ · ชื่อบท · ชื่อฉาก — ผู้เรียกส่ง callback มาจัดการเปลี่ยนชื่อเอง

export function titleHistory() {
  return (getAISettings().titleHistory) || [];
}

export function rememberTitles(kind, base, titles) {
  if (!state.meta) return;
  state.meta.ai = state.meta.ai || {};
  const hist = state.meta.ai.titleHistory || [];
  hist.push({ date: new Date().toISOString(), kind, base, titles });
  if (hist.length > 50) hist.splice(0, hist.length - 50);
  state.meta.ai.titleHistory = hist;
}

// ชื่อที่เคยแนะนำสำหรับหัวข้อเดียวกัน (ไม่ซ้ำ) — โชว์ไว้ให้เลือกซ้ำได้โดยไม่ต้องยิง API
export function pastTitlesFor(base) {
  const out = [];
  for (const h of titleHistory()) {
    if (base && h.base !== base) continue;
    for (const t of (h.titles || [])) if (!out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * @param {string} currentTitle ชื่อปัจจุบัน (ใช้เป็นบริบทให้ AI)
 * @param {(title:string)=>void} callback เรียกเมื่อผู้ใช้เลือกชื่อ
 * @param {{kind?:'project'|'chapter'|'scene', context?:string}} opts
 */
export async function showAITitleSuggestions(currentTitle, callback, opts = {}) {
  const kind = opts.kind || 'project';
  const KIND_TH = { project: tt('ui.common.story'), chapter: tt('ui.common.chapter'), scene: tt('ui.common.scene2') };
  if (!(await aiReady())) return;
  setStatus(tt('ui.aiSum.aIBusyThinkName'));

  const busy = busyBox(ttf('ui.aiSum.suggestName', KIND_TH[kind]));
  busy.set(tt('ui.aiSum.busySendAIThink'), 0.5);
  let result = null;
  try {
    const prompt = ttf('ui.aiSum.suggestNameThaiNovel', KIND_TH[kind]) +
      ttf('ui.aiSum.nameCurrent', currentTitle) +
      (opts.context ? ttf('ui.aiSum.contextBodyCollapse', String(opts.context).slice(0, 1500)) : '') +
      tt('ui.aiSum.sendListLineName');
    result = await callAI(prompt, tt('ui.aiSum.youWriterChapterHelp'));
  } finally { busy.close(); }

  if (!result) return;

  const titles = result.split('\n').map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean).slice(0, 10);
  rememberTitles(kind, currentTitle, titles);
  try { const { saveProjectMeta } = await import('./app.js'); await saveProjectMeta(); } catch {}

  // แสดง popup
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-ai-titles');
  box.append(el('div', 'k-dlg-title', ttf('ui.aiSum.suggestName2', KIND_TH[kind], currentTitle)));

  const list = el('div', 'k-pick-list');
  for (const tt of titles) {
    const row = el('div', 'k-menu-item', '📖 ' + tt);
    row.onclick = () => { ov.remove(); callback(tt); };
    list.append(row);
  }
  box.append(list);

  // ชื่อที่เคยแนะนำมาก่อน (ไม่รวมรอบนี้) — เลือกซ้ำได้ฟรี
  const past = pastTitlesFor(currentTitle).filter((p) => !titles.includes(p));
  if (past.length) {
    const h = el('div', 'dim', tt('ui.aiSum.suggestBeforePage'));
    h.style.cssText = 'margin:8px 0 2px;font-size:11px';
    box.append(h);
    const pl = el('div', 'k-pick-list k-ai-past');
    pl.style.cssText = 'max-height:120px;overflow-y:auto';
    for (const tt of past.slice(-10).reverse()) {
      const row = el('div', 'k-menu-item dim', '· ' + tt);
      row.onclick = () => { ov.remove(); callback(tt); };
      pl.append(row);
    }
    box.append(pl);
  }

  const btns = el('div', 'k-dlg-btns');
  const retryB = el('button', null, tt('ui.aiSum.tryNew'));
  retryB.onclick = () => { ov.remove(); showAITitleSuggestions(currentTitle, callback, opts); };
  const closeB = el('button', null, tt('ui.common.cancel'));
  closeB.onclick = () => ov.remove();
  btns.append(retryB, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}
