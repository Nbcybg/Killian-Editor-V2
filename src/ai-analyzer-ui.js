// ai-analyzer-ui.js — แผง "🧠 AI วิเคราะห์" (alpha.89 — เปิดใช้งานจริง · .89r เพิ่มเซสชัน/โทเคน/CSV/ตั้งค่า)
//
// เดิมไฟล์นี้เป็น **ตัวอย่างหน้าตา**: การ์ด 5 ใบ กดปุ่มแล้วขึ้นข้อความว่า "ยังไม่เปิดใช้งาน"
// ตอนนี้ต่อของจริงครบ 11 ชนิด เลือกขอบเขตได้ 4 ระดับ
// (ทั้งโปรเจกต์ · เฉพาะเล่ม · เฉพาะบท · เฉพาะฉาก)
//
// แบ่งหน้าที่ชัด: ตรรกะการวิเคราะห์/ประมาณโทเคน/เซสชัน/CSV อยู่ใน `src/ai/ai-analyze.js`
// (บริสุทธิ์ · unit test ได้) · ไฟล์นี้ทำแค่ (1) อ่านเขียนไฟล์ (2) วาดหน้าจอ (3) เรียกเอนจิน
import { t, tf } from './i18n.js';
import { el, setStatus, state, log } from './core.js';
import { iconHtml } from './icons.js';
import { ask, confirmBox } from './ui.js';
import { listEntities } from './project-scan.js';
import { getAIClient } from './ai/ai-bridge.js';
import { aiConfigured, getAISettings } from './ai-settings.js';
import { showAISettingsDialog, currentProvider } from './ai/ai-provider-ui.js';
import { openScene, safeName } from './app.js';
import {
  ANALYSES, ANALYSIS_IDS, analysisById, SCOPE_KINDS, SCOPE_LABELS,
  filterScope, describeScope, analyze, countWords,
  scopeTokens, estimateAnalysis, estimateTotal, estimateUsd, usageOfResults,
  SESSION_DIR, newAnalysisSession, migrateAnalysisSession, sessionSummary, sessionFileName,
  resultCsv, sessionCsv,
} from './ai/ai-analyze.js';

export { ANALYSES, ANALYSIS_IDS };
/** ชื่อเดิมที่ selftest/โมดูลอื่นเคยอ้าง — ตอนนี้คือทะเบียนตัวจริง ไม่ใช่ mockup แล้ว */
export const ANALYZER_CARDS = ANALYSES;

const SKIP = ['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Plugins', 'Research', 'Backups', 'Analysis'];

// ───────── สถานะของแผง (คงอยู่ระหว่างวาดใหม่) ─────────
const S = {
  root: '',
  scenes: [],            // ฉากทั้งโปรเจกต์ เรียงตามลำดับจริง
  characters: [],        // เอนทิตี้ Wiki ที่ใช้เป็น "ตัวละคร"
  scope: { kind: 'project', sectionKey: '', chapterId: '', sceneId: '' },
  useAI: true,
  results: new Map(),    // `${id}||${scopeKey}` → ผลลัพธ์ล่าสุด
  saved: new Set(),      // คีย์ผลที่ถูกบันทึกลงเซสชันแล้ว (ที่เหลือ = งานค้างตามกฎ alpha.72)
  running: new Set(),
  session: { id: '', name: '', file: '' },   // เซสชันที่เปิด/บันทึกล่าสุด
  price: { provider: '', model: '' },
  base: null,            // โทเคนของเนื้อฉากในขอบเขตปัจจุบัน (คิดครั้งเดียว)
  loaded: false,
};
const scopeKey = (sc = S.scope) => [sc.kind, sc.sectionKey, sc.chapterId, sc.sceneId].join('|');
const resultKey = (id) => id + '||' + scopeKey();

/** ผลของขอบเขตปัจจุบันในรูป { id: result } — ใช้ทั้งบันทึกเซสชัน ส่งออก และนับโทเคน */
/**
 * [alpha.124 ข้อ 8] พาสายตาไปที่การ์ดวิเคราะห์ใบหนึ่ง — ใช้ตอนเข้ามาจากเมนูที่เจาะจงเรื่อง
 * (เมนู เครื่องมือ → "ตรวจหาคำซ้ำ · สถิติการใช้คำ" ต้องลงที่การ์ด 🔁 ไม่ใช่โยนผู้ใช้ไว้กลางแผง)
 * @returns {boolean} true = เจอการ์ดจริงและเลื่อนไปแล้ว
 */
export function focusAnalysis(id) {
  const card = document.querySelector(`.aia-card[data-card="${id}"]`);
  if (!card) return false;
  card.scrollIntoView({ block: 'center' });
  card.classList.add('aia-card-focus');
  setTimeout(() => card.classList.remove('aia-card-focus'), 2000);
  return true;
}

export function currentResults() {
  const out = {};
  for (const id of ANALYSIS_IDS) {
    const r = S.results.get(resultKey(id));
    if (r) out[id] = r;
  }
  return out;
}

/** ล้างทุกอย่างเมื่อเปลี่ยนโปรเจกต์ (เรียกจาก app.js ตอนปิดโปรเจกต์) */
export function resetAnalyzer() {
  S.root = ''; S.scenes = []; S.characters = []; S.loaded = false; S.base = null;
  S.results.clear(); S.running.clear(); S.saved.clear();
  S.session = { id: '', name: '', file: '' };
  S.scope = { kind: 'project', sectionKey: '', chapterId: '', sceneId: '' };
}

/**
 * งานค้างของแผงนี้ตามกฎ alpha.72 ข้อ 1 — **ผลที่ยิง AI ไปแล้วแต่ยังไม่ได้บันทึก**
 * (ผลที่คำนวณเองไม่นับ เพราะกดใหม่ได้ฟรีและได้ค่าเดิมเป๊ะ · ผล AI เสียเงินไปแล้ว หายแล้วหายเลย)
 */
export function analyzerDirtyList() {
  const out = [];
  for (const [key, res] of S.results) {
    if (S.saved.has(key) || !res || !res.ai || !res.ai.ok) continue;
    const def = analysisById(res.id);
    out.push({ key, title: (def ? def.title : res.id) + ' — ' + ((res.scope && res.scope.text) || ''), file: '' });
  }
  return out;
}

// ═══════════════ อ่านโปรเจกต์ ═══════════════
/**
 * ฉากทั้งโปรเจกต์ **เรียงตามลำดับจริง** (เล่มตาม order → บทตาม draft.json → ฉากตาม scenes.json)
 * ต่างจาก `listScenes()` ของ project-scan.js ตรงที่ตัวนั้นเรียงตามที่ระบบไฟล์คืนมา
 * และไม่มีชื่อเล่ม/ชื่อบทติดมาด้วย — การวิเคราะห์จังหวะเรื่องต้องใช้ลำดับที่ถูกต้อง
 * @returns {Promise<Array>} [{ id,title,path,sectionKey,sectionTitle,chapterId,chapterTitle,text,pov,storyDate,words }]
 */
export async function collectScenes(root = state.root) {
  const out = [];
  if (!root) return out;
  const secs = [];
  for (const sec of await kapi.listDirs(root).catch(() => [])) {
    if (SKIP.includes(sec)) continue;
    const sp = await kapi.join(root, sec);
    const sj = await kapi.join(sp, 'section.json');
    if (!(await kapi.exists(sj))) continue;
    const meta = await kapi.readJson(sj).catch(() => ({}));
    secs.push({ key: sec, path: sp, title: meta.title || sec, order: Number(meta.order) || 0 });
  }
  secs.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

  for (const sec of secs) {
    const dr = await kapi.join(sec.path, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    for (const dn of await kapi.listDirs(dr).catch(() => [])) {
      const dp = await kapi.join(dr, dn);
      const dj = await kapi.join(dp, 'draft.json');
      if (!(await kapi.exists(dj))) continue;
      const draft = await kapi.readJson(dj).catch(() => ({}));
      const scData = await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}));
      const chMap = scData.chapters || {};
      for (const ch of (draft.chapters || [])) {
        for (const sc of (chMap[ch.guid] || [])) {
          if (sc.type === 'memo') continue;
          const file = await kapi.join(dp, 'Chapters', ch.folderName || ch.guid, sc.fileName || (sc.id + '.md'));
          let text = '';
          try { text = (await kapi.exists(file)) ? await kapi.readFile(file) : ''; } catch { text = ''; }
          out.push({
            id: sc.id, title: sc.title || sc.fileName || '', path: file, draftPath: dp,
            sectionKey: sec.key, sectionTitle: sec.title,
            chapterId: ch.guid, chapterTitle: ch.title || ch.folderName || '',
            pov: sc.pov || '', storyDate: sc.storyDate || '', status: sc.status || '',
            text, words: countWords(text),
          });
        }
      }
    }
  }
  return out;
}

/** ตัวละครจาก Wiki — เอาหมวด characters ก่อน ถ้าไม่มีเลยค่อยใช้ทุกหมวด */
export async function collectCharacters(root = state.root) {
  const ents = await listEntities(root).catch(() => []);
  const chars = ents.filter((e) => e.cat === 'characters');
  const use = chars.length ? chars : ents;
  return use.map((e) => ({ name: e.name, aliases: e.aliases || [], cat: e.cat, file: e.path }));
}

async function ensureLoaded(force = false) {
  if (S.loaded && S.root === state.root && !force) return;
  S.root = state.root || '';
  S.results.clear(); S.saved.clear(); S.base = null;
  if (!S.root) { S.scenes = []; S.characters = []; S.loaded = true; return; }
  S.scenes = await collectScenes(S.root);
  S.characters = await collectCharacters(S.root);
  S.loaded = true;
  // ฉากที่เปิดอยู่ = ค่าเริ่มต้นของขอบเขต "เฉพาะฉาก"
  const cur = currentSceneId();
  if (cur && !S.scope.sceneId) S.scope.sceneId = cur;
}

/** id ของฉากที่เปิดอยู่ในแท็บปัจจุบัน (เทียบจาก path ของแท็บ — ไม่ต้อง import app.js ตอนโหลด) */
export function currentSceneId() {
  const f = state.active && state.active.file;
  if (!f) return '';
  const hit = S.scenes.find((s) => s.path === f);
  return hit ? hit.id : '';
}

/** ตัวเลขจริงที่อ่านได้จากดัชนีในเครื่อง (ไม่ยิง AI) — คงชื่อเดิมไว้ให้ selftest เก่าเรียกได้ */
export async function analyzerStats(root = state.root) {
  const out = { scenes: 0, chapters: 0, sections: 0, words: 0, entities: 0 };
  if (!root) return out;
  const scenes = (S.loaded && S.root === root) ? S.scenes : await collectScenes(root);
  out.scenes = scenes.length;
  out.chapters = new Set(scenes.map((s) => s.chapterId)).size;
  out.sections = new Set(scenes.map((s) => s.sectionKey)).size;
  out.words = scenes.reduce((a, s) => a + (s.words || 0), 0);
  out.entities = (await listEntities(root).catch(() => [])).length;
  return out;
}

// ═══════════════ ราคา/โทเคน ═══════════════
/** ผู้ให้บริการ+โมเดลที่จะถูกใช้จริง (ไว้คิดราคาโดยประมาณ) */
async function refreshPrice() {
  try {
    const p = await currentProvider();
    if (p) { S.price = { provider: p.provider || p.kind || 'openai', model: p.model || '' }; return S.price; }
  } catch { /* ยังไม่ได้ตั้งทะเบียนใหม่ → ตกไปใช้ค่าตั้งแบบเก่า */ }
  const ai = getAISettings();
  S.price = { provider: ai.provider || 'openai', model: ai.model || '' };
  return S.price;
}
/** โทเคนของเนื้อฉากในขอบเขตปัจจุบัน — คิดครั้งเดียวต่อขอบเขต ไม่ใช่ 11 รอบ */
function base() {
  if (!S.base || S.base.key !== scopeKey()) {
    S.base = { key: scopeKey(), ...scopeTokens(S.scenes, S.scope) };
  }
  return S.base;
}
const fmtTok = (n) => Number(n || 0).toLocaleString();
const fmtUsd = (n) => '$' + Number(n || 0).toFixed(4);

// ═══════════════ ตัวช่วยวาด ═══════════════
function statsBar(stats) {
  const bar = el('div', 'aia-stats');
  for (const s of (stats || [])) {
    const b = el('div', 'aia-stat');
    b.append(el('div', 'aia-stat-val', String(s.value)), el('div', 'aia-stat-label', s.label));
    bar.append(b);
  }
  return bar;
}

/** แถบสัดส่วน — items: [{label, value, sub, sceneId, tone}] */
function barList(items, opts = {}) {
  const wrap = el('div', 'aia-bars');
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  for (const it of items.slice(0, opts.limit || 40)) {
    const row = el('div', 'aia-bar-row');
    if (it.sceneId) { row.classList.add('is-link'); row.onclick = () => jumpToScene(it.sceneId); }
    const head = el('div', 'aia-bar-head');
    head.append(el('span', 'aia-bar-label', it.label));
    head.append(el('span', 'aia-bar-val', String(it.display != null ? it.display : it.value)));
    const track = el('div', 'aia-bar-track');
    const fill = el('div', 'aia-bar-fill' + (it.tone ? ' tone-' + it.tone : ''));
    fill.style.width = Math.round(100 * (Number(it.value) || 0) / max) + '%';
    track.append(fill);
    row.append(head, track);
    if (it.sub) row.append(el('div', 'aia-bar-sub', it.sub));
    wrap.append(row);
  }
  return wrap;
}

function chipList(items) {
  const wrap = el('div', 'aia-chips');
  for (const it of items) {
    const c = el('span', 'aia-chip' + (it.cls ? ' ' + it.cls : ''), it.label);
    if (it.title) c.title = it.title;
    wrap.append(c);
  }
  return wrap;
}

function noteList(items) {
  const ul = el('ul', 'aia-notes');
  for (const it of items) {
    const li = el('li', null);
    li.append(el('span', 'aia-note-title', it.title));
    if (it.note) li.append(el('span', 'aia-note-body', ' — ' + it.note));
    if (it.sceneId) { li.classList.add('is-link'); li.onclick = () => jumpToScene(it.sceneId); }
    ul.append(li);
  }
  return ul;
}

function miniBtn(label, title, onClick, cls) {
  const b = el('button', 'aia-mini' + (cls ? ' ' + cls : ''), label);
  b.type = 'button';
  if (title) b.title = title;
  b.onclick = onClick;
  return b;
}

/** เรียก fn เมื่อ overlay ตัวนั้นหลุดจาก DOM (กล่องที่ไม่คืน promise ตอนปิด) */
function afterClosed(ov, fn) {
  if (!ov || !ov.isConnected) { fn(); return; }
  const obs = new MutationObserver(() => {
    if (!ov.isConnected) { obs.disconnect(); fn(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

async function jumpToScene(sceneId) {
  const sc = S.scenes.find((s) => s.id === sceneId);
  if (!sc) return;
  try { await openScene(sc.path, sc.title); }
  catch (e) { log('warn', t('ui.aia.errOpenScene'), e); }
}

// ═══════════════ วาดผลลัพธ์ของแต่ละชนิด ═══════════════
function renderLocal(id, local) {
  const box = el('div', 'aia-result-local');
  box.append(statsBar(local.stats));
  const L = local;
  if (id === 'pacing') {
    box.append(barList(L.rows.map((r) => ({
      label: r.title || r.id, value: r.tempo, display: r.tempo,
      sub: tf('ui.aia.rowPacing', r.words, r.dialogue, r.avgSentence), sceneId: r.id,
      tone: r.tempo < L.avg - L.sd * 0.5 ? 'slow' : r.tempo > L.avg + L.sd * 0.5 ? 'fast' : '',
    }))));
    if (L.slowRuns.length) box.append(noteList(L.slowRuns.map((g) => ({
      title: t('ui.aia.slowRun'), note: tf('ui.aia.runRange', g.from, g.to, g.count), sceneId: g.sceneId }))));
    if (L.fastRuns.length) box.append(noteList(L.fastRuns.map((g) => ({
      title: t('ui.aia.fastRun'), note: tf('ui.aia.runRange', g.from, g.to, g.count), sceneId: g.sceneId }))));
  } else if (id === 'arc') {
    for (const c of L.chars.slice(0, 8)) {
      box.append(el('div', 'aia-sub-head', tf('ui.aia.arcHead', c.name, c.total, c.scenes)));
      box.append(barList(c.perChapter.map((ch) => ({ label: ch.chapterTitle, value: ch.count, display: ch.count }))));
      if (c.gaps.length) box.append(noteList(c.gaps.map((g) => ({
        title: t('ui.aia.arcGap'), note: tf('ui.aia.runRange', g.from, g.to, g.count) }))));
    }
  } else if (id === 'words') {
    box.append(barList(L.rows.map((r) => ({ label: r.word, value: r.count,
      display: r.count + ' (' + r.per10k + ')' })), { limit: 40 }));
  } else if (id === 'conflict') {
    box.append(barList(L.rows.map((r) => ({ label: r.title || r.id, value: r.score, display: r.score,
      sub: r.hits.map((h) => h.word + '×' + h.count).join(' · ') || t('ui.aia.noMarker'),
      sceneId: r.id, tone: r.score === 0 ? 'slow' : '' }))));
  } else if (id === 'length') {
    box.append(barList(L.rows.map((r) => ({ label: r.title || r.id, value: r.words,
      display: tf('ui.aia.rowLength', r.words, r.minutes), sceneId: r.id,
      tone: L.long.includes(r) ? 'fast' : L.short.includes(r) ? 'slow' : '' }))));
  } else if (id === 'repeat') {
    box.append(barList(L.rows.map((r) => ({ label: r.word, value: r.count,
      display: r.count + '×', sub: tf('ui.aia.rowRepeat', r.title || r.id, r.closest), sceneId: r.id })),
      { limit: 40 }));
  } else if (id === 'shipping') {
    box.append(barList(L.rows.map((r) => ({ label: r.a + ' × ' + r.b, value: r.score, display: r.score,
      sub: tf('ui.aia.rowShip', r.scenes, r.mentions), sceneId: r.sceneIds[0] }))));
  } else if (id === 'screentime') {
    box.append(barList(L.rows.map((r) => ({ label: r.name, value: r.words, display: r.share + '%',
      sub: tf('ui.aia.rowScreentime', r.scenes, r.mentions), sceneId: r.sceneIds[0] }))));
  } else if (id === 'score') {
    box.append(scoreBox(L.criteria, L.total, t('ui.aia.scoreLocalHead')));
  } else if (L.rows && L.rows.length) {
    box.append(noteList(L.rows.map((r) => ({ title: r.title, note: r.note, sceneId: r.id }))));
  }
  return box;
}

function scoreBox(criteria, total, head) {
  const wrap = el('div', 'aia-score');
  wrap.append(el('div', 'aia-score-total', (head ? head + ' ' : '') + total + '/10'));
  wrap.append(barList((criteria || []).map((c) => ({ label: c.label, value: c.score, display: c.score + '/10', sub: c.note }))));
  return wrap;
}

function renderAI(id, ai) {
  const box = el('div', 'aia-result-ai');
  box.append(el('div', 'aia-sub-head', t('ui.aia.aiHead')));
  if (!ai.ok) { box.append(el('div', 'aia-err', '❌ ' + (ai.error || t('ui.aia.errAiFail')))); return box; }
  if (ai.kind === 'score') {
    box.append(scoreBox(ai.rows, ai.total, t('ui.aia.scoreAiHead')));
    if (ai.summary) box.append(el('div', 'aia-ai-text', ai.summary));
  } else if (ai.rows && ai.rows.length) {
    const ul = el('ul', 'aia-findings');
    for (const r of ai.rows) {
      const li = el('li', 'aia-finding sev-' + r.severity);
      li.append(el('span', 'aia-sev', r.severityLabel));
      li.append(el('span', 'aia-find-title', r.title));
      if (r.detail) li.append(el('div', 'aia-find-detail', r.detail));
      if (r.suggestion) li.append(el('div', 'aia-find-fix', '→ ' + r.suggestion));
      if (r.sceneId) { li.classList.add('is-link'); li.onclick = () => jumpToScene(r.sceneId); }
      ul.append(li);
    }
    box.append(ul);
  } else {
    box.append(el('div', 'aia-ai-text', (ai.raw || '').trim() || t('ui.aia.aiNoFinding')));
  }
  // "หลังใช้งาน" — โทเคนที่ใช้จริงของรอบนี้
  if (ai.usage) box.append(el('div', 'aia-cost',
    tf('ui.aia.usage', fmtTok(ai.usage.total || 0), ((ai.cost && ai.cost.usd) || 0).toFixed(4))));
  return box;
}

// ═══════════════ สั่งวิเคราะห์ ═══════════════
export async function runAnalysis(id, host) {
  const def = analysisById(id);
  if (!def) return null;
  await ensureLoaded();
  const key = resultKey(id);
  if (S.running.has(key)) return null;
  S.running.add(key);
  const slot = host || document.querySelector(`.aia-card[data-card="${id}"] .aia-result`);
  if (slot) { slot.replaceChildren(el('div', 'aia-busy', t('ui.aia.busy'))); }
  let useAI = S.useAI;
  if (useAI) {
    const cfg = await aiConfigured();
    if (!cfg.ok) { useAI = false; }
  }
  let res;
  try {
    res = await analyze(id, {
      scenes: S.scenes, characters: S.characters, scope: S.scope,
      client: useAI ? getAIClient() : null, useAI,
    });
  } catch (e) {
    log('error', t('ui.aia.errRun'), e);
    res = { id, error: String(e && e.message || e), local: { stats: [] }, ai: null };
  }
  S.running.delete(key);
  S.results.set(key, res);
  S.saved.delete(key);                    // ผลใหม่ = ยังไม่ได้บันทึก (กฎงานค้าง alpha.72)
  if (slot) paintResult(slot, res);
  syncUsageLine();
  setStatus('🧠 ' + def.title + ' — ' + (res.error ? res.error : t('ui.aia.done')));
  return res;
}

function paintResult(slot, res) {
  slot.replaceChildren();
  if (!res) return;
  if (res.error) { slot.append(el('div', 'aia-err', '⚠ ' + res.error)); return; }
  if (res.scope) slot.append(el('div', 'aia-scope-line', res.scope.text));
  slot.append(renderLocal(res.id, res.local || {}));
  if (res.truncated) slot.append(el('div', 'aia-warn', t('ui.aia.truncated')));
  if (res.ai) slot.append(renderAI(res.id, res.ai));
  else slot.append(el('div', 'aia-hint', t('ui.aia.aiOffHint')));
}

/** วิเคราะห์ทุกชนิดตามลำดับ (ทีละตัว — ไม่ยิง API พร้อมกันจนโดน rate limit) */
export async function runAll() {
  for (const a of ANALYSES) await runAnalysis(a.id);
}

// ═══════════════ เซสชัน — เก็บไว้ในโปรเจกต์ ═══════════════
async function sessionDir(create = false) {
  if (!state.root) return '';
  const d = await kapi.join(state.root, SESSION_DIR);
  if (create && !(await kapi.exists(d))) await kapi.mkdir(d);
  return d;
}

/** เซสชันทั้งหมดในโปรเจกต์ (ใหม่สุดขึ้นก่อน) */
export async function listSessions() {
  const d = await sessionDir();
  if (!d || !(await kapi.exists(d))) return [];
  const out = [];
  for (const f of await kapi.listFiles(d, '.json').catch(() => [])) {
    const p = await kapi.join(d, f);
    try {
      const s = migrateAnalysisSession(await kapi.readJson(p));
      out.push({ file: p, fileName: f, session: s, ...sessionSummary(s) });
    } catch (e) { log('warn', t('ui.aia.errSessionRead') + f, e); }
  }
  out.sort((a, b) => String(b.created).localeCompare(String(a.created)));
  return out;
}

/** บันทึกผลของขอบเขตปัจจุบันเป็นเซสชันในโปรเจกต์ */
export async function saveSession(name) {
  if (!state.root) { setStatus(t('ui.aia.noProject')); return null; }
  const results = currentResults();
  if (!Object.keys(results).length) { setStatus(t('ui.aia.errNothingToSave')); return null; }
  const nm = String(name || S.session.name || '').trim()
    || tf('ui.aia.sessionAuto', describeScope(S.scope, S.scenes).name || t('ui.aia.scopeProject'));
  const sess = newAnalysisSession({
    id: S.session.id || undefined, name: nm, project: state.title || '',
    scope: S.scope, scopeText: describeScope(S.scope, S.scenes).text,
    useAI: S.useAI, results,
  });
  const dir = await sessionDir(true);
  const file = await kapi.join(dir, safeName(sessionFileName(sess)));
  try {
    await kapi.writeFile(file, JSON.stringify(sess, null, 2));
  } catch (e) {
    log('error', t('ui.aia.errSessionSave'), e);
    setStatus('❌ ' + t('ui.aia.errSessionSave'));
    return null;
  }
  S.session = { id: sess.id, name: sess.name, file };
  for (const id of Object.keys(results)) S.saved.add(resultKey(id));
  setStatus('💾 ' + tf('ui.aia.sessionSaved', sess.name));
  return { file, session: sess };
}

/** เปิดเซสชันที่บันทึกไว้ — คืนขอบเขตและผลทั้งหมดกลับมาโดยไม่ต้องวิเคราะห์ใหม่ */
export async function openSession(row) {
  if (!row || !row.session) return false;
  await ensureLoaded();
  const s = row.session;
  S.scope = { kind: 'project', sectionKey: '', chapterId: '', sceneId: '', ...(s.scope || {}) };
  S.useAI = s.useAI !== false;
  S.base = null;
  for (const [id, res] of Object.entries(s.results || {})) {
    const key = id + '||' + scopeKey();
    S.results.set(key, res);
    S.saved.add(key);
  }
  S.session = { id: s.id, name: s.name, file: row.file };
  setStatus('📂 ' + tf('ui.aia.sessionOpened', s.name || s.id));
  return true;
}

export async function deleteSession(row) {
  if (!row || !row.file) return false;
  if (!(await confirmBox(tf('ui.aia.confirmDelSession', row.name || row.fileName)))) return false;
  try { await kapi.remove(row.file); }
  catch (e) { log('error', t('ui.aia.errSessionDel'), e); return false; }
  if (S.session.file === row.file) S.session = { id: '', name: '', file: '' };
  setStatus('🗑 ' + tf('ui.aia.sessionDeleted', row.name || row.fileName));
  return true;
}

/** กล่องรายชื่อเซสชัน — เปิด / ส่งออก CSV / ลบ */
async function sessionDialog(host) {
  const rows = await listSessions();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog aia-sess-dlg');
  box.append(el('div', 'k-dlg-title', t('ui.aia.sessionTitle')));
  const close = () => ov.remove();
  if (!rows.length) box.append(el('div', 'aia-hint', t('ui.aia.sessionEmpty')));
  const list = el('div', 'aia-sess-list');
  for (const r of rows) {
    const item = el('div', 'aia-sess-item');
    const info = el('div', 'aia-sess-info');
    info.append(el('div', 'aia-sess-name', r.name));
    info.append(el('div', 'aia-sess-meta',
      [r.created.replace('T', ' ').slice(0, 16), r.scopeText,
       tf('ui.aia.sessionKinds', r.kinds), tf('ui.aia.sessionCost', fmtTok(r.tokens), r.usd.toFixed(4))]
        .filter(Boolean).join(' · ')));
    item.append(info);
    const acts = el('div', 'aia-sess-acts');
    acts.append(miniBtn(t('ui.aia.sessionOpen'), '', async () => {
      close(); await openSession(r); renderAIAnalyzerPanel(host);
    }));
    acts.append(miniBtn(t('ui.aia.exportCsv'), '', () => exportSessionCsv(r.session)));
    acts.append(miniBtn(t('ui.common.del'), '', async () => {
      if (await deleteSession(r)) { close(); sessionDialog(host); }
    }, 'k-danger'));
    item.append(acts);
    list.append(item);
  }
  box.append(list);
  const btns = el('div', 'k-dlg-btns');
  const closeBtn = el('button', 'k-ok', t('ui.common.close'));
  closeBtn.onclick = close;
  btns.append(closeBtn);
  box.append(btns);
  ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.append(ov);
  return ov;
}

// ═══════════════ ส่งออก CSV ═══════════════
// outPath = ข้ามกล่องเลือกไฟล์ (selftest ใช้ — กล่องเลือกไฟล์ของระบบเป็นจุดบอดของ e2e)
async function writeCsv(defName, text, outPath) {
  const p = outPath || await kapi.saveAsDialog(defName, 'csv');
  if (!p) return null;
  try { await kapi.writeFile(p, text); }
  catch (e) { log('error', t('ui.aia.errCsv'), e); setStatus('❌ ' + t('ui.aia.errCsv')); return null; }
  setStatus('⤓ ' + tf('ui.aia.csvSaved', p));
  return p;
}

/** ส่งออกผลของชนิดเดียว */
export async function exportResultCsv(id, outPath) {
  const res = S.results.get(resultKey(id));
  if (!res) { setStatus(t('ui.aia.errNothingToExport')); return null; }
  const def = analysisById(id);
  return writeCsv(safeName((def ? def.title : id) + '.csv'), '﻿' + resultCsv(id, res), outPath);
}

/** ส่งออกทุกชนิดที่วิเคราะห์ไว้ในขอบเขตปัจจุบัน */
export async function exportAllCsv(outPath) {
  const results = currentResults();
  if (!Object.keys(results).length) { setStatus(t('ui.aia.errNothingToExport')); return null; }
  const sess = newAnalysisSession({
    name: S.session.name || t('ui.common.aIAnalyze'), project: state.title || '',
    scope: S.scope, scopeText: describeScope(S.scope, S.scenes).text, useAI: S.useAI, results,
  });
  return exportSessionCsv(sess, outPath);
}

export async function exportSessionCsv(sess, outPath) {
  if (!sess) return null;
  return writeCsv(safeName((sess.name || 'analysis') + '.csv'), sessionCsv(sess), outPath);
}

// ═══════════════ วาดแผง ═══════════════
export async function renderAIAnalyzerPanel(host) {
  const h = host || document.getElementById('ai-analyzer-body');
  if (!h) return null;
  h.replaceChildren();
  const wrap = el('div', 'aia-wrap');

  const head = el('div', 'aia-head');
  const title = el('div', 'aia-title');
  title.innerHTML = iconHtml('brain', 18) + ' ' + t('panel.aiAnalyzerTitle');
  head.append(title);
  head.append(miniBtn(t('ui.aia.reload'), '', async () => { await ensureLoaded(true); renderAIAnalyzerPanel(h); }));
  wrap.append(head);
  h.append(wrap);

  await ensureLoaded();
  if (!S.root) { wrap.append(el('div', 'aia-lead', t('ui.aia.noProject'))); return wrap; }
  await refreshPrice();

  wrap.append(el('div', 'aia-lead', t('ui.aia.lead')));

  // ---- แถบเครื่องมือ: ตั้งค่า AI · เซสชัน · ส่งออก ----
  const tools = el('div', 'aia-tools');
  // กล่องตั้งค่า AI คืน overlay ทันที (ไม่รอผู้ใช้กดปิด) → ต้องเฝ้าดูตอนมันหลุดจาก DOM
  // ไม่งั้นราคาต่อโทเคนบนแผงจะเป็นของผู้ให้บริการเจ้าเดิมทั้งที่ผู้ใช้เพิ่งเปลี่ยนไปแล้ว
  const setBtn = miniBtn('⚙ ' + t('ui.aia.aiSettings'), t('ui.aia.aiSettingsTip'), async () => {
    const ov = await showAISettingsDialog();
    if (!ov) return;
    afterClosed(ov, async () => { await refreshPrice(); renderAIAnalyzerPanel(h); });
  });
  setBtn.id = 'aia-ai-settings';
  tools.append(setBtn);
  const saveBtn = miniBtn('💾 ' + t('ui.aia.sessionSave'), t('ui.aia.sessionSaveTip'), async () => {
    const nm = await ask(t('ui.aia.sessionSaveTitle'), {
      value: S.session.name || describeScope(S.scope, S.scenes).text, allowEmpty: true });
    if (nm === null) return;
    await saveSession(nm);
    renderAIAnalyzerPanel(h);
  });
  saveBtn.id = 'aia-save-session';
  tools.append(saveBtn);
  const listBtn = miniBtn('📂 ' + t('ui.aia.sessionList'), t('ui.aia.sessionListTip'), () => sessionDialog(h));
  listBtn.id = 'aia-open-session';
  tools.append(listBtn);
  const csvBtn = miniBtn('⤓ ' + t('ui.aia.exportCsv'), t('ui.aia.exportCsvTip'), () => exportAllCsv());
  csvBtn.id = 'aia-export-csv';
  tools.append(csvBtn);
  wrap.append(tools);
  if (S.session.name) wrap.append(el('div', 'aia-scope-line', tf('ui.aia.sessionCurrent', S.session.name)));

  // ---- แถบขอบเขต ----
  wrap.append(scopeBar(h));

  // ---- สถิติของขอบเขตที่เลือก ----
  const picked = filterScope(S.scenes, S.scope);
  wrap.append(statsBar([
    { label: t('ui.common.book'), value: new Set(picked.map((s) => s.sectionKey)).size },
    { label: t('ui.common.chapter'), value: new Set(picked.map((s) => s.chapterId)).size },
    { label: t('ui.common.scene2'), value: picked.length },
    { label: t('ui.common.word2'), value: picked.reduce((a, s) => a + s.words, 0).toLocaleString() },
    { label: t('ui.aia.wiki'), value: S.characters.length },
  ]));

  // ---- ตัวเลือกการใช้ AI + วิเคราะห์ทั้งหมด ----
  const opts = el('div', 'aia-opts');
  const lbl = el('label', 'aia-check');
  const cb = el('input');
  cb.type = 'checkbox'; cb.checked = S.useAI; cb.id = 'aia-use-ai';
  cb.onchange = () => { S.useAI = cb.checked; renderAIAnalyzerPanel(h); };
  lbl.append(cb, el('span', null, t('ui.aia.useAI')));
  opts.append(lbl);
  const all = el('button', 'aia-run aia-run-all', t('ui.aia.runAll'));
  all.type = 'button';
  all.onclick = async () => { all.disabled = true; try { await runAll(); } finally { all.disabled = false; } };
  opts.append(all);
  wrap.append(opts);

  // ---- โทเคน: ก่อนใช้ (ประมาณ) + หลังใช้ (จริง) ----
  wrap.append(usageLine());

  // ---- การ์ดทั้ง 11 ใบ ----
  const b = base();
  const grid = el('div', 'aia-grid');
  for (const c of ANALYSES) {
    const card = el('div', 'aia-card');
    card.dataset.card = c.id;
    card.append(el('div', 'aia-card-head', c.icon + ' ' + c.title));
    card.append(el('div', 'aia-card-desc', c.desc));
    const chips = [];
    if (c.ai === 'core') chips.push({ label: t('ui.aia.tagNeedAI') });
    if (S.useAI) {
      const e = estimateAnalysis(c.id, b);
      chips.push({ cls: 'aia-chip-est', label: tf('ui.aia.estTokens', fmtTok(e.total),
        fmtUsd(estimateUsd(S.price.provider, S.price.model, e))), title: t('ui.aia.estTip') });
    }
    if (chips.length) card.append(chipList(chips));
    const row = el('div', 'aia-card-btns');
    const btn = el('button', 'aia-run', t('ui.aia.run'));
    btn.type = 'button';
    btn.onclick = () => runAnalysis(c.id);
    row.append(btn);
    row.append(miniBtn('⤓', t('ui.aia.exportCsvOne'), () => exportResultCsv(c.id)));
    card.append(row);
    const slot = el('div', 'aia-result');
    const prev = S.results.get(resultKey(c.id));
    if (prev) paintResult(slot, prev);
    card.append(slot);
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

/** บรรทัด "ก่อนใช้ / หลังใช้" ของโทเคน — id คงที่เพื่ออัปเดตได้โดยไม่ต้องวาดแผงใหม่ */
function usageLine() {
  const line = el('div', 'aia-usage');
  line.id = 'aia-usage';
  paintUsage(line);
  return line;
}
function paintUsage(line) {
  line.replaceChildren();
  const b = base();
  const used = usageOfResults(currentResults());
  if (S.useAI) {
    const tot = estimateTotal(ANALYSIS_IDS, b);
    line.append(el('span', 'aia-usage-before',
      tf('ui.aia.estAll', fmtTok(tot.total), fmtUsd(estimateUsd(S.price.provider, S.price.model, tot)))));
  } else {
    line.append(el('span', 'aia-usage-before', t('ui.aia.estOff')));
  }
  line.append(el('span', 'aia-usage-after',
    used.calls ? tf('ui.aia.usedSoFar', used.calls, fmtTok(used.tokens), fmtUsd(used.usd))
               : t('ui.aia.usedNone')));
}
function syncUsageLine() {
  const line = document.getElementById('aia-usage');
  if (line) paintUsage(line);
}

function scopeBar(h) {
  const bar = el('div', 'aia-scope');
  const btns = el('div', 'aia-scope-btns');
  for (const kind of SCOPE_KINDS) {
    const b = el('button', 'aia-scope-btn' + (S.scope.kind === kind ? ' on' : ''), SCOPE_LABELS[kind]);
    b.type = 'button';
    b.dataset.scope = kind;
    b.onclick = () => {
      S.scope.kind = kind;
      if (kind === 'scene' && !S.scope.sceneId) S.scope.sceneId = currentSceneId() || (S.scenes[0] && S.scenes[0].id) || '';
      if (kind === 'book' && !S.scope.sectionKey) S.scope.sectionKey = (S.scenes[0] && S.scenes[0].sectionKey) || '';
      if (kind === 'chapter' && !S.scope.chapterId) S.scope.chapterId = (S.scenes[0] && S.scenes[0].chapterId) || '';
      renderAIAnalyzerPanel(h);
    };
    btns.append(b);
  }
  bar.append(btns);

  if (S.scope.kind !== 'project') {
    const sel = el('select', 'aia-scope-sel');
    const seen = new Set();
    for (const s of S.scenes) {
      let val = '', label = '';
      if (S.scope.kind === 'book') { val = s.sectionKey; label = s.sectionTitle; }
      else if (S.scope.kind === 'chapter') { val = s.chapterId; label = (s.sectionTitle ? s.sectionTitle + ' · ' : '') + s.chapterTitle; }
      else { val = s.id; label = (s.chapterTitle ? s.chapterTitle + ' · ' : '') + (s.title || s.id); }
      if (!val || seen.has(val)) continue;
      seen.add(val);
      const o = el('option', null, label);
      o.value = val;
      sel.append(o);
    }
    const field = S.scope.kind === 'book' ? 'sectionKey' : S.scope.kind === 'chapter' ? 'chapterId' : 'sceneId';
    if (S.scope[field]) sel.value = S.scope[field];
    if (!sel.value && sel.options.length) sel.value = sel.options[0].value;
    S.scope[field] = sel.value;
    sel.onchange = () => { S.scope[field] = sel.value; renderAIAnalyzerPanel(h); };
    bar.append(sel);
  }
  bar.append(el('div', 'aia-scope-line', describeScope(S.scope, S.scenes).text));
  return bar;
}
