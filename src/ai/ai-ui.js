// ai-ui.js — UI ทั้งหมดของ AI features (ข้อ 72–79): assistant, plot, dialogue, character, world, chat
//
// ══ [alpha.170] เขียนกล่องทั้งชุดใหม่หลังลองใช้บนแอปจริง ══
//   · กล่องกว้างคงที่ (.k-ai-dlg) — เดิมกว้างตามเนื้อหา ผลยาวหนึ่งบรรทัดทำกล่องกระโดดจาก 640 เป็น 1120px
//   · ปุ่มหลักอยู่ขวาสุด · ปุ่มแทรก/บันทึกกดได้เมื่อมีผลจริงเท่านั้น
//   · งานที่รอ AI มีแถบกำลังทำงาน + ปุ่มหยุด (เดิมบางกล่องไม่มีปุ่มอะไรเลยระหว่างรอ)
//   · ตรวจ Plot Hole เลือกขอบเขตและเห็นจำนวนฉาก/โทเคนก่อนส่ง (เดิมส่งทั้งเรื่องทันทีที่เปิดกล่อง)
//   · ตรวจความสม่ำเสมอเลือกตัวละครได้จากทุกแท็บ (เดิมต้องเปิดหน้า Wiki ของตัวละครก่อน ไม่งั้นขึ้นแค่ข้อความบนแถบสถานะ)
import { t as tt, tf as ttf } from '../i18n.js';
import { failText } from '../err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import { el, state, setStatus, t as tr } from '../core.js';   // บทเรียน 25: ในไฟล์นี้ตัวแปร t = แท็บ → i18n ใช้ชื่อ tr
import { aiConfigured } from '../ai-settings.js';
import { listScenes, listEntities } from '../project-scan.js';
import { liveBody, pathKey } from '../tab-bridge.js';
import { scopeScenes } from './ai-scope.js';
import { estimateTokens } from './ai-core.js';
import { aiProseText } from './ai-prose.js';   // [alpha.170 · บั๊ก 6] ร้อยแก้วจาก AI: หนึ่งบรรทัดต่อย่อหน้า
import { fmtNum } from '../locale.js';
import { gi } from '../icons.js';

// ══ [alpha.159 · M22] ★ สถานะของ "ช่องผล" อยู่ที่ธง ไม่ใช่ที่ตัวอักษร ══
// เดิมปุ่มแทรก/บันทึกกันข้อความ error ด้วย `r.startsWith('❌')` — ไอคอนมาจากทะเบียน (gi('fail'))
// เปลี่ยน glyph/ใส่ svg เมื่อไหร่ ด่านนี้พังเงียบแล้ว **ข้อความ error ถูกแทรกลงฉากจริง**
// ตอนนี้ทุกทางเขียนช่องผลผ่าน setResult() ซึ่งตั้ง dataset.state = busy | err | ok
function setResult(div, text, st = 'ok') {
  div.textContent = text; div.dataset.state = st;
  div.dispatchEvent(new CustomEvent('k2-ai-result'));
}
/** ช่องผลมี "ผลลัพธ์จริง" ให้แทรก/บันทึก (ไม่ใช่ระหว่างรอ · ไม่ใช่ error · ไม่ว่าง) */
export function resultReady(div) { return !!div && div.dataset.state === 'ok' && !!div.textContent; }
/** ผลที่พังกลางสตรีม — เก็บข้อความที่ไหลมาแล้ว (H13) ไว้ในช่องผล + บอกในแถบสถานะ */
function failOrPartial(div, res, acc, fallbackKey) {
  const kept = String(acc || (res && res.text) || '');
  if (res && res.partial !== false && kept.trim()) {
    setResult(div, kept, 'ok');
    setStatus(gi('warning') + ' ' + tr('ai.partialKept') + ' · ' + ((res && res.error) || tr(fallbackKey)));
    return;
  }
  setResult(div, gi('fail') + ' ' + errLine(res, fallbackKey), 'err');
}
/** ข้อความผิดพลาด + คำแนะนำข้อแรก (ถ้ามี) — ผู้ใช้ต้องรู้ว่าทำอะไรต่อได้ */
function errLine(res, fallbackKey) {
  const msg = (res && res.error) || tr(fallbackKey);
  const hint = res && Array.isArray(res.hints) && res.hints[0];
  return hint ? msg + '\n' + hint : msg;
}

// ───────── helper: เช็คว่า AI พร้อมหรือยัง ─────────
// [alpha.62 บั๊ก 6] ถามจุดเดียวที่ `aiConfigured()` — รู้จักทั้งทะเบียนใหม่ (alpha.61) และค่าตั้งแบบเก่า
async function aiReady() {
  if (!state.root) { setStatus(tr('ai.noProject')); return false; }
  const r = await aiConfigured();
  if (r.ok) return true;
  setStatus(gi('fail') + ' ' + (r.why || tr('ai.needSetup')));
  return false;
}

// หาเอนทิตี้ Wiki จากชื่อ (ใช้เติมบุคลิกให้ตัวสร้างบทสนทนา)
async function wikiEntityByName(name, all) {
  if (!name || !state.root) return null;
  try {
    const hit = (all || await listEntities(state.root)).find((e) => e.name === name
      || (e.aliases || []).includes(name));
    return hit ? { ...hit.entity } : null;
  } catch { return null; }
}

/** หยุดคำขอ AI ที่กล่องนี้ยิงค้างอยู่ (ตัวกลาง ai-bridge จำคำขอที่กำลังวิ่งให้) */
async function stopAi() {
  try { const { getAIClient } = await import('./ai-bridge.js'); const c = getAIClient(); if (c && c.abortAll) c.abortAll(); } catch {}
}

/**
 * โครงกล่อง AI — กว้างคงที่ · มีแถบ "กำลังทำงาน" · ปิดแล้วหยุดคำขอที่ค้าง
 * @returns {{ov, box, close, running(on:boolean)}}
 */
function showDialog(title, bodyFn, cls = '') {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-ai-dlg' + (cls ? ' ' + cls : ''));
  box.append(el('div', 'k-dlg-title', title));
  const bar = el('div', 'k-ai-progress');
  bar.hidden = true;
  box.append(bar);
  let busy = false;
  const api = {
    ov, box,
    close() { if (busy) stopAi(); ov.remove(); },
    running(on) { busy = !!on; bar.hidden = !on; box.classList.toggle('k-ai-running', !!on); },
  };
  bodyFn(box, api);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) api.close(); };
  return api;
}
const resultBox = (cls = '') => { const d = el('div', 'k-ai-result k-selectable' + (cls ? ' ' + cls : '')); d.dataset.state = ''; return d; };
const fieldRow = (label, node) => { const r = el('div', 'k-ai-field'); r.append(el('label', null, label), node); return r; };
const textArea = (ph, rows = 3) => { const a = el('textarea', 'wiki-input k-ai-ta'); a.rows = rows; a.placeholder = ph; return a; };
const optionOf = (text, value) => { const o = el('option', null, text); o.value = value; return o; };

/** แถวปุ่มมาตรฐาน: ปิด (ซ้าย) · ปุ่มรอง · ปุ่มหลัก (ขวาสุด) */
function buttonRow(box, close, ...btns) {
  const row = el('div', 'k-dlg-btns');
  const closeBtn = el('button', 'k-cancel', tt('ui.common.close'));
  closeBtn.onclick = close;
  row.append(closeBtn, ...btns.filter(Boolean));
  box.append(row);
  return row;
}

// ══════════════════════════════════════════════════════════════
// 1. AI Assistant (ข้อ 72) — Expand / Summarize / Rewrite / Change Tone
// ══════════════════════════════════════════════════════════════
export async function openAIAssistant() {
  if (!(await aiReady())) return;

  const t = state.active;
  // [alpha.147] เดิมเรียก `getSelectedText()` ซึ่งไม่มีทั้งใน KEditor และ SPEditor → กล่องไม่เคยเปิดได้เลย
  // (log ของผู้ใช้: "t3.editor.getSelectedText is not a function") — อ่านช่วงที่เลือกจาก PM ตรง ๆ
  const ed = t?.editor || t?.sp || null;
  const sel = ed && ed.view
    ? ed.view.state.doc.textBetween(ed.view.state.selection.from, ed.view.state.selection.to, '\n')
    : '';
  const fullText = ed ? ed.getText() : '';
  const hasSel = !!sel.trim();

  showDialog(tr('ai.assistantTitle'), (box, dlg) => {
    const TASK_TH = { expand: tr('ai.opExpand'), summarize: tr('ai.opSummarize'), rewrite: tr('ai.opRewrite'),
                      changeTone: tr('ai.opTone'), continue: tr('ai.opContinue') };
    const TONE_TH = { formal: tr('ai.toneFormal'), casual: tr('ai.toneCasual'), humorous: tr('ai.toneFunny'), dark: tr('ai.toneDark'),
                      romantic: tr('ai.toneRomantic'), tense: tr('ai.toneTense'), concise: tr('ai.toneConcise'), lyrical: tr('ai.toneDetailed') };
    // [alpha.147] `el()` รับแค่ (tag, cls, text) — อาร์กิวเมนต์ที่สี่ `{ value }` ถูกทิ้งเงียบ ๆ
    // → <option> ไม่มี value → select.value คืน "ข้อความไทย" แล้วส่ง task="ขยายความ" ไปให้เอนจิน
    const taskSel = el('select', 'wiki-input k-dlg-select');
    Object.keys(TASK_TH).forEach((v) => taskSel.append(optionOf(TASK_TH[v], v)));
    const toneSel = el('select', 'wiki-input k-dlg-select');
    toneSel.append(optionOf(tt('ui.ai.notChangeTone'), ''));
    Object.keys(TONE_TH).forEach((v) => toneSel.append(optionOf(TONE_TH[v], v)));
    const instrInput = textArea(tr('ai.extraHint'), 2);
    const textInput = textArea(tr('ai.inputLabel'), 5);
    textInput.value = sel || fullText.slice(0, 3000);
    const resultDiv = resultBox();

    const row1 = el('div', 'k-ai-cols');
    row1.append(fieldRow(tr('ai.opLabel'), taskSel), fieldRow(tr('ai.toneLabel'), toneSel));
    box.append(row1, instrInput, fieldRow(tr('ai.textLabel'), textInput), fieldRow(tr('ai.resultLabel'), resultDiv));

    const runBtn = el('button', 'k-ok', tt('ui.ai.result'));
    const stopBtn = el('button', 'k-ai-stop', gi('stop') + ' ' + tt('ui.ai.stop'));
    stopBtn.hidden = true;
    stopBtn.onclick = stopAi;
    // [alpha.170] มีข้อความที่เลือกอยู่ = ผลจะ "แทนที่" ช่วงนั้น — ป้ายต้องบอกตรง ๆ (เดิมเขียน "แทรกลงฉาก" ทั้งสองกรณี)
    const insertBtn = el('button', 'k-ai-insert', tt(hasSel ? 'ui.ai.replaceSelection' : 'ui.ai.insertScene'));
    insertBtn.disabled = true;
    resultDiv.addEventListener('k2-ai-result', () => { insertBtn.disabled = !resultReady(resultDiv); });
    runBtn.onclick = async () => {
      runBtn.disabled = true; stopBtn.hidden = false; dlg.running(true);
      setResult(resultDiv, tr('ai.working'), 'busy');
      const task = taskSel.value;
      const tone = toneSel.value;
      const instr = instrInput.value.trim();
      const text = textInput.value.trim() || fullText;

      // ใช้เอนจิน ai-assistant.js (prompt ต่อ task + RAG จากโปรเจกต์ + สตรีมผล)
      // [alpha.129 ข้อ 3] เดิมไม่มี try/catch: import พัง · เอนจินโยน · เครือข่ายล้ม
      // = หลุดออกไปทั้งที่ปุ่มยัง disabled และช่องผลค้างที่ "กำลังทำงาน…" ตลอดไป
      try {
        const { aiAssistant } = await import('./ai-assistant.js');
        const { getAIClient, getRag } = await import('./ai-bridge.js');
        let rag = null;
        try { rag = await getRag(); } catch {}
        let acc = '';
        const res = await aiAssistant(instr, { text }, {
          client: getAIClient(), rag, task, tone: tone || undefined, instruction: instr, text,
          stream: true, onChunk: (c) => { acc += c; setResult(resultDiv, acc, 'busy'); },
        });
        if (res.ok) setResult(resultDiv, res.text || acc || tr('ai.noAnswer'), res.text || acc ? 'ok' : 'err');
        else failOrPartial(resultDiv, res, acc, 'ai.errorRetry');
      } catch (e) {
        setResult(resultDiv, gi('fail') + ' ' + ((e && e.message) || tr('ai.errorRetry')), 'err');
      } finally {
        runBtn.disabled = false; stopBtn.hidden = true; dlg.running(false);
      }
    };

    insertBtn.onclick = () => {
      const r = resultDiv.textContent;
      // [alpha.128] เดิมกัน "ข้อความระหว่างรอ" ด้วย `r.startsWith('กำลัง')` — แต่ข้อความนั้น
      // มาจากไฟล์ภาษา → หน้าจออังกฤษกันไม่ติด แล้วปุ่มแทรกจะยัด "Working…" ลงฉากจริง ๆ
      if (!resultReady(resultDiv)) return;             // [alpha.159 · M22] ธง ไม่ใช่ตัวอักษร
      // [alpha.82] เดิมเรียก cmd('insertText') ที่ไม่มีอยู่จริง → ปุ่มนี้ก็ไม่เคยแทรกอะไรเลย
      if (t?.sp) t.sp.insertScript(r);
      else if (t?.editor) t.editor.insertLines(aiProseText(r));
      dlg.close();
      setStatus(tr('ai.insertedResult'));
    };
    buttonRow(box, dlg.close, stopBtn, insertBtn, runBtn);
  });
}

// ══════════════════════════════════════════════════════════════
// 2. AI Plot Hole Detector (ข้อ 73)
// ══════════════════════════════════════════════════════════════

/** [alpha.170] ฉากของร่างหลักแต่ละเล่ม (เล่มที่ไม่ได้ตั้งร่างหลัก = ทุกร่างตามเดิม) + เนื้อสดจากแท็บที่เปิดอยู่ */
async function scenesForAi() {
  const rows = await listScenes(state.root, { withText: true });
  const prim = new Map();
  for (const sec of new Set(rows.map((r) => r.section))) {
    let p = '';
    try {
      const j = await kapi.readJson(await kapi.join(await kapi.join(state.root, sec), 'section.json'));
      p = (j && j.primaryDraft) || '';
    } catch { p = ''; }
    prim.set(sec, p);
  }
  return rows.filter((r) => { const p = prim.get(r.section); return !p || r.draft === p; })
    .map((s) => ({ id: s.id, title: s.title, chapterId: s.chapterId, section: s.section, path: s.path,
                   // [alpha.160] งานที่ยังไม่บันทึกในแท็บชนะไฟล์บนดิสก์ (liveBody ของ tab-bridge)
                   text: liveBody(s.path, s.body || ''),
                   storyDate: s.row.storyDate || '', pov: s.row.pov || '' }));
}
// ตัวตัดฉากตามขอบเขต (`scopeScenes`) อยู่ที่ ai-scope.js (บริสุทธิ์ · unit `trial-fixes`)
export { scopeScenes };
const SCOPE_KEYS = { project: 'ui.ai.scopeProject', book: 'ui.ai.scopeBook', chapter: 'ui.ai.scopeChapter', scene: 'ui.ai.scopeScene' };

export async function openPlotHoleDetector() {
  if (!(await aiReady())) return;
  if (!state.root) { setStatus(tr('ai.openProjectFirst')); return; }

  showDialog(tr('ai.plotTitle'), async (box, dlg) => {
    const scopeSel = el('select', 'wiki-input k-dlg-select k-ai-scope');
    const info = el('div', 'dim k-ai-scope-info', tr('ai.collectingScenes'));
    const resultDiv = resultBox('k-ai-result-list');
    resultDiv.hidden = true;
    box.append(fieldRow(tt('ui.ai.scopeLabel'), scopeSel), info, resultDiv);
    const runBtn = el('button', 'k-ok', tt('ui.ai.startCheck'));
    runBtn.disabled = true;
    const stopBtn = el('button', 'k-ai-stop', gi('stop') + ' ' + tt('ui.ai.stop'));
    stopBtn.hidden = true;
    stopBtn.onclick = stopAi;
    buttonRow(box, dlg.close, stopBtn, runBtn);

    let all = [];
    try { all = await scenesForAi(); }
    catch (e) { info.textContent = failText(tr('ai.readFail'), e); return; }
    const activePath = state.active && state.active.file;
    const { currentProvider } = await import('./ai-provider-ui.js');
    const prov = await currentProvider().catch(() => null);
    const who = prov ? (prov.name + (prov.model ? ' · ' + prov.model : '')) : 'AI';
    for (const sc of ['project', 'book', 'chapter', 'scene']) {
      const n = scopeScenes(all, sc, activePath).length;
      if (sc !== 'project' && !n) continue;                 // ไม่มีฉากของแท็บนี้ = ไม่มีขอบเขตย่อยให้เลือก
      scopeSel.append(optionOf(tt(SCOPE_KEYS[sc]), sc));
    }
    let picked = [];
    const paint = () => {
      picked = scopeScenes(all, scopeSel.value, activePath);
      const tok = picked.reduce((n, s) => n + estimateTokens(s.text), 0);
      info.textContent = picked.length ? ttf('ui.ai.scopeSummary', picked.length, fmtNum(tok), who) : tt('ui.ai.scopeEmpty');
      runBtn.disabled = !picked.length;
    };
    scopeSel.onchange = paint;
    paint();

    runBtn.onclick = async () => {
      runBtn.disabled = true; scopeSel.disabled = true; stopBtn.hidden = false; dlg.running(true);
      resultDiv.hidden = false;
      setResult(resultDiv, tr('ai.sendingToAi'), 'busy');
      setStatus(tr('ai.plotWorking'));
      try {
        // ใช้เอนจิน ai-plot.js (แบ่ง batch ตามงบ token + ตรวจออฟไลน์ + แปลงคำตอบเป็นโครงสร้าง)
        const { detectPlotHoles } = await import('./ai-plot.js');
        const { getAIClient } = await import('./ai-bridge.js');
        const res = await detectPlotHoles([], { client: getAIClient(), scenes: picked });
        resultDiv.textContent = '';
        if (!res.holes.length) {
          // [alpha.170 · บั๊ก 2] "ไม่พบ" ขึ้นได้เฉพาะเมื่อ AI ตอบจริงครบทุกรอบ — มีรอบที่ล้ม = บอกว่าล้ม
          if (res.error || res.failedBatches) setResult(resultDiv, gi('fail') + ' ' + (res.error || ttf('ui.ai.hasRoundCallAI', res.failedBatches)), 'err');
          else setResult(resultDiv, tr('ai.noPlotHoles') + ' · ' + ttf('ui.ai.checkedScenes', picked.length), 'ok');
        } else {
          resultDiv.dataset.state = 'ok';
          resultDiv.append(el('div', 'dim', ttf('ui.ai.foundDotCheckRound', res.holes.length, res.batches)));
          for (const h of res.holes) {
            const row = el('div', 'k-ai-item');
            const sev = { high: gi('dot-red'), medium: gi('dot-yellow'), low: gi('dot-white') }[h.severity] || '•';
            row.append(el('div', '', `${sev} [${h.typeLabel || h.type || tr('ai.general')}] ${h.description || ''}`));
            const where = (h.location && h.location.title) || h.sceneTitle || h.sceneId;
            if (where) row.append(el('div', 'dim', tr('ai.sceneLabel') + where));
            if (h.evidence) row.append(el('div', 'dim', tr('ai.evidenceLabel') + h.evidence));
            if (h.suggestion) row.append(el('div', '', gi('bulb') + ' ' + h.suggestion));
            resultDiv.append(row);
          }
          if (res.failedBatches) resultDiv.append(el('div', 'dim', ttf('ui.ai.hasRoundCallAI', res.failedBatches)));
        }
      } catch (e) {
        setResult(resultDiv, gi('fail') + ' ' + ((e && e.message) || tr('ai.error')), 'err');
      } finally {
        runBtn.disabled = false; scopeSel.disabled = false; stopBtn.hidden = true; dlg.running(false);
        runBtn.textContent = tt('ui.ai.runAgain');
      }
    };
  });
}

// ══════════════════════════════════════════════════════════════
// 3. AI Dialogue Generator (ข้อ 74)
// ══════════════════════════════════════════════════════════════
export async function openDialogueGenerator() {
  if (!(await aiReady())) return;
  let ents = [];
  try { ents = await listEntities(state.root); } catch { ents = []; }
  const chars = ents.filter((e) => e.cat === 'characters');
  const names = (chars.length ? chars : ents).map((e) => e.name);

  showDialog(tr('ai.dialogueTitle'), (box, dlg) => {
    // [alpha.170] ช่องชื่อเสนอชื่อตัวละครจาก Wiki (เดิมต้องพิมพ์ให้ตรงเองถึงจะได้บุคลิกจาก Wiki)
    const dl = el('datalist');
    dl.id = 'k-ai-chars-' + Date.now().toString(36);
    for (const n of names) dl.append(optionOf('', n));
    box.append(dl);
    const nameInput = (ph) => { const i = el('input', 'wiki-input k-ai-name'); i.placeholder = ph; i.setAttribute('list', dl.id); return i; };
    const charA = nameInput(tt('ui.ai.nameA'));
    const charB = nameInput(tt('ui.ai.nameB'));
    const descA = textArea(tr('ai.charADesc'), 2);
    const descB = textArea(tr('ai.charBDesc'), 2);
    const noteA = el('div', 'dim k-ai-note'), noteB = el('div', 'dim k-ai-note');
    const fromWiki = (input, note) => {
      const hit = ents.find((e) => e.name === input.value.trim() || (e.aliases || []).includes(input.value.trim()));
      note.textContent = hit ? ttf('ui.ai.wikiProfileUsed', hit.name) : '';
    };
    charA.oninput = () => fromWiki(charA, noteA);
    charB.oninput = () => fromWiki(charB, noteB);
    const context = textArea(tr('ai.dialogueCtx'), 3);
    const resultDiv = resultBox();

    const fmtSel = el('select', 'wiki-input k-dlg-select');
    // [alpha.149] `el()` รับแค่ (tag, cls, text) — `{ value }` เคยถูกทิ้งเงียบ ๆ → value = ป้ายภาษาไทย
    for (const [value, label] of [['screenplay', tt('ui.common.screenplay')], ['prose', tt('ui.ai.edit')]]) {
      fmtSel.append(optionOf(label, value));
    }
    // [alpha.170] ค่าเริ่มต้นตามชนิดของเอกสารที่เปิดอยู่ (เดิมเป็นบทภาพยนตร์เสมอ แม้กำลังเขียนนิยาย)
    fmtSel.value = state.active && state.active.sp ? 'screenplay' : 'prose';

    const cols = el('div', 'k-ai-cols');
    const colA = el('div', 'k-ai-col'), colB = el('div', 'k-ai-col');
    colA.append(fieldRow(tr('ai.charA'), charA), noteA, descA);
    colB.append(fieldRow(tr('ai.charB'), charB), noteB, descB);
    cols.append(colA, colB);
    box.append(cols, fieldRow(tr('ai.ctxLabel'), context), fieldRow(tr('ai.formatLabel'), fmtSel),
               fieldRow(tr('ai.dialogueLabel'), resultDiv));

    const runBtn = el('button', 'k-ok', tt('ui.ai.new'));
    const stopBtn = el('button', 'k-ai-stop', gi('stop') + ' ' + tt('ui.ai.stop'));
    stopBtn.hidden = true;
    stopBtn.onclick = stopAi;
    const insertBtn = el('button', 'k-ai-insert', tt('ui.ai.insert'));
    insertBtn.disabled = true;
    resultDiv.addEventListener('k2-ai-result', () => { insertBtn.disabled = !resultReady(resultDiv); });
    runBtn.onclick = async () => {
      const a = charA.value.trim(), b = charB.value.trim(), ctx = context.value.trim();
      if (!a || !b) { setResult(resultDiv, tr('ai.needBothChars'), 'err'); return; }
      runBtn.disabled = true; stopBtn.hidden = false; dlg.running(true);
      setResult(resultDiv, tr('ai.dialogueWorking'), 'busy');
      // ใช้เอนจิน ai-dialogue.js — ดึงบุคลิกจาก Wiki ก่อน แล้วค่อยใช้ที่พิมพ์ในกล่อง
      try {
        const { generateDialogue } = await import('./ai-dialogue.js');
        const { getAIClient } = await import('./ai-bridge.js');
        const profA = (await wikiEntityByName(a, ents)) || { name: a };
        const profB = (await wikiEntityByName(b, ents)) || { name: b };
        if (descA.value.trim()) profA.personality = descA.value.trim();
        if (descB.value.trim()) profB.personality = descB.value.trim();
        let acc = '';
        const res = await generateDialogue(profA, profB, { situation: ctx },
          { client: getAIClient(), format: fmtSel.value, stream: true,
            onChunk: (c) => { acc += c; setResult(resultDiv, acc, 'busy'); } });
        if (res.ok) {
          setResult(resultDiv, res.text, res.text ? 'ok' : 'err');
          if (res.speakers?.length) resultDiv.title = tr('ai.speakerLabel') + res.speakers.join(', ');
        } else failOrPartial(resultDiv, res, acc, 'ai.error');
      } catch (e) {
        setResult(resultDiv, gi('fail') + ' ' + ((e && e.message) || tr('ai.error')), 'err');
      } finally {
        runBtn.disabled = false; stopBtn.hidden = true; dlg.running(false);
      }
    };
    insertBtn.onclick = () => {
      const r = resultDiv.textContent;
      if (!resultReady(resultDiv)) return;   // [alpha.128] ดูข้อ 1 · [alpha.159 · M22] อ่านธง
      // [alpha.82] เดิมเรียก cmd('insertText') ซึ่ง **ไม่มีใน switch ของ cmd()** ทั้งสองตัวแก้ไข
      const t = state.active;
      if (t?.sp) t.sp.insertScript(r);
      else if (t?.editor) t.editor.insertLines(aiProseText(r));
      dlg.close(); setStatus(tr('ai.insertedDialogue'));
    };
    buttonRow(box, dlg.close, stopBtn, insertBtn, runBtn);
  });
}

// ══════════════════════════════════════════════════════════════
// 4. AI Character Consistency Check (ข้อ 75)
// ══════════════════════════════════════════════════════════════
/**
 * @param {string} hintPath  ทางไฟล์ของแท็บที่เปิดอยู่ — เป็นหน้า Wiki ของเอนทิตี้ = เลือกตัวนั้นไว้ให้
 * [alpha.170 · บั๊ก 10] เดิมรับได้เฉพาะไฟล์เอนทิตี้: สั่งจากแท็บฉาก = พยายามอ่านไฟล์ .md เป็น JSON
 * แล้วขึ้นแค่ "อ่านไฟล์เอนทิตี้ไม่สำเร็จ" บนแถบสถานะ ไม่มีกล่อง ไม่มีทางไปต่อ
 */
export async function openConsistencyCheck(hintPath) {
  if (!(await aiReady())) return;
  let ents = [];
  try { ents = await listEntities(state.root); } catch { ents = []; }
  if (!ents.length) { setStatus(tt('ui.ai.noCharacters')); return; }
  const chars = ents.filter((e) => e.cat === 'characters');
  const list = chars.length ? chars : ents;
  const hinted = hintPath ? ents.find((e) => pathKey(e.path) === pathKey(hintPath)) : null;
  if (hinted && !list.includes(hinted)) list.unshift(hinted);

  showDialog(tr('ai.consistTitle').replace(/[\s—–-]+$/, ''), async (box, dlg) => {
    const pick = el('select', 'wiki-input k-dlg-select k-ai-char');
    for (const e of list) pick.append(optionOf(e.name, e.path));
    if (hinted) pick.value = hinted.path;
    const resultDiv = resultBox('k-ai-result-list');
    resultDiv.hidden = true;
    box.append(fieldRow(tt('ui.ai.pickCharacter'), pick), resultDiv);
    const runBtn = el('button', 'k-ok', tt('ui.ai.startCheck'));
    const stopBtn = el('button', 'k-ai-stop', gi('stop') + ' ' + tt('ui.ai.stop'));
    stopBtn.hidden = true;
    stopBtn.onclick = stopAi;
    buttonRow(box, dlg.close, stopBtn, runBtn);

    runBtn.onclick = async () => {
      const row = list.find((e) => e.path === pick.value);
      if (!row) return;
      runBtn.disabled = true; pick.disabled = true; stopBtn.hidden = false; dlg.running(true);
      resultDiv.hidden = false;
      setResult(resultDiv, tr('ai.collecting'), 'busy');
      setStatus(tr('ai.consistWorking'));
      try {
        // ใช้เอนจิน ai-character.js — หาฉากที่ตัวละครปรากฏเอง + ตรวจออฟไลน์ + แปลงคำตอบเป็นโครงสร้าง
        const scenes = (await scenesForAi()).map((s) => ({ id: s.id, title: s.title, text: s.text, storyDate: s.storyDate }));
        setResult(resultDiv, tr('ai.sendingToAi'), 'busy');
        const { checkConsistency } = await import('./ai-character.js');
        const { getAIClient } = await import('./ai-bridge.js');
        const res = await checkConsistency(row.path, { client: getAIClient(), entity: row.entity, scenes });
        resultDiv.textContent = '';
        if (!res.issues.length) {
          if (res.error) setResult(resultDiv, gi('fail') + ' ' + res.error, 'err');
          else setResult(resultDiv, tr('ai.noInconsist') + ' · ' + ttf('ui.ai.checkedScenes', res.appearances || 0), 'ok');
        } else {
          resultDiv.dataset.state = 'ok';
          resultDiv.append(el('div', 'dim', ttf('ui.ai.foundDotSceneAppear', res.issues.length, res.appearances || 0)));
          for (const it of res.issues) {
            const item = el('div', 'k-ai-item');
            item.append(el('div', '', `• [${it.aspect || tr('ai.general')}] ${it.issue || ''}`));
            if (it.sceneTitle || it.sceneId) item.append(el('div', 'dim', tr('ai.sceneLabel') + (it.sceneTitle || it.sceneId)));
            if (it.evidence) item.append(el('div', 'dim', tr('ai.evidenceLabel') + it.evidence));
            if (it.suggestion) item.append(el('div', '', gi('bulb') + ' ' + it.suggestion));
            resultDiv.append(item);
          }
          if (res.error) resultDiv.append(el('div', 'dim', gi('warning') + ' ' + res.error));
        }
      } catch (e) {
        setResult(resultDiv, gi('fail') + ' ' + ((e && e.message) || tr('ai.error')), 'err');
      } finally {
        runBtn.disabled = false; pick.disabled = false; stopBtn.hidden = true; dlg.running(false);
        runBtn.textContent = tt('ui.ai.runAgain');
      }
    };
  });
}

// ══════════════════════════════════════════════════════════════
// 5. AI Worldbuilding Generator (ข้อ 76)
// ══════════════════════════════════════════════════════════════
export async function openWorldGenerator() {
  if (!(await aiReady())) return;

  showDialog(tr('ai.worldTitle'), (box, dlg) => {
    const typeSel = el('select', 'wiki-input k-dlg-select');
    const labels = { magic: tr('ai.wMagic'), city: tr('ai.wCity'), culture: tr('ai.wCulture'), economy: tr('ai.wEconomy'), religion: tr('ai.wReligion'), faction: tr('ai.wFaction') };
    ['magic', 'city', 'culture', 'economy', 'religion', 'faction'].forEach((v) => typeSel.append(optionOf(labels[v] || v, v)));   // [alpha.147] el() ไม่รับ {value}
    const promptInput = textArea(tr('ai.worldPrompt'), 3);
    const resultDiv = resultBox();
    box.append(fieldRow(tr('ai.kindLabel'), typeSel), fieldRow(tr('ai.detailLabel'), promptInput), fieldRow(tr('ai.resultLabel'), resultDiv));

    const runBtn = el('button', 'k-ok', tt('ui.ai.new'));
    const stopBtn = el('button', 'k-ai-stop', gi('stop') + ' ' + tt('ui.ai.stop'));
    stopBtn.hidden = true;
    stopBtn.onclick = stopAi;
    let lastWorld = null;                     // ผลลัพธ์ที่ผ่าน schema แล้ว (ใช้ตอนบันทึกลง Wiki)
    runBtn.onclick = async () => {
      runBtn.disabled = true; stopBtn.hidden = false; dlg.running(true);
      setResult(resultDiv, tr('ai.generating'), 'busy');
      lastWorld = null;
      // ใช้เอนจิน ai-world.js — มีเทมเพลตต่อประเภท + ตรวจว่าคำตอบครบโครง (ไม่ครบ = ลองใหม่)
      try {
        const { generateWorld, toMarkdown } = await import('./ai-world.js');
        const { getAIClient } = await import('./ai-bridge.js');
        const res = await generateWorld(typeSel.value, promptInput.value.trim() || tr('ai.freeform'),
                                        { client: getAIClient() });
        if (res.ok) { lastWorld = res.world; setResult(resultDiv, toMarkdown(res.world), 'ok'); }
        else setResult(resultDiv, gi('fail') + ' ' + errLine(res, 'ai.error'), 'err');
      } catch (e) {
        setResult(resultDiv, gi('fail') + ' ' + ((e && e.message) || tr('ai.error')), 'err');
      } finally {
        runBtn.disabled = false; stopBtn.hidden = true; dlg.running(false);
      }
    };
    const saveBtn = el('button', 'k-ai-insert', tt('ui.ai.saveWiki'));
    saveBtn.disabled = true;
    resultDiv.addEventListener('k2-ai-result', () => { saveBtn.disabled = !resultReady(resultDiv); });
    saveBtn.onclick = async () => {
      const r = resultDiv.textContent;
      if (!resultReady(resultDiv)) return;        // [alpha.128] ดูข้อ 1 · [alpha.159 · M22] อ่านธง
      const { toWikiEntity } = await import('./ai-world.js');
      const cats = { magic: 'lore', city: 'locations', culture: 'lore', economy: 'lore', religion: 'lore', faction: 'lore' };
      const cat = cats[typeSel.value] || 'lore';
      const base = lastWorld
        ? toWikiEntity(lastWorld, { category: cat })
        : { name: promptInput.value.trim().slice(0, 60) || 'Worldbuilding',
            entityTypeKey: cat, aliases: [], fields: { description: r } };
      // เติมช่องที่ WikiEditor คาดหวังให้ครบ
      const entity = {
        id: Date.now().toString(36), aliases: [], fields: {}, customProperties: {},
        images: [], relationships: [], chapterOverrides: [], ...base,
        sections: (lastWorld?.sections || []).map((s) => ({ title: s.title, content: s.body }))
                  .concat(lastWorld ? [] : [{ title: tr('ai.description'), content: r }]),
        created: new Date().toISOString(),
      };
      // [alpha.149] โปรเจกต์รุ่นเก่าใช้โฟลเดอร์ Bible/ · ชื่อไฟล์ต้องไม่ชนของเดิม
      // (เดิม `ชื่อ.json` ตายตัว → สร้างโลกชื่อซ้ำ = เขียนทับอันก่อนเงียบ ๆ)
      const wikiName = (await kapi.exists(await kapi.join(state.root, 'Wiki')))
        || !(await kapi.exists(await kapi.join(state.root, 'Bible'))) ? 'Wiki' : 'Bible';
      const catDir = await kapi.join(await kapi.join(state.root, wikiName), cat);
      await kapi.mkdir(catDir);
      const name = entity.name || 'Worldbuilding';
      const file = await kapi.join(catDir, name.replace(/[\/\\:*?"<>|]/g, '_') + '-' + Date.now().toString(36) + '.json');
      await kapi.writeFile(file, JSON.stringify(entity, null, 2));
      // [alpha.170] รายชื่อ Wiki เปลี่ยน = ต้นไม้ + ไฮไลต์ชื่อ + "ฉากที่กล่าวถึง" ต้องตามทันที (กฎ bug hunt 5)
      try { const app = await import('../app.js'); await app.buildTree(); await app.reloadWikiNames(); } catch {}
      saveBtn.disabled = true;
      setStatus(tr('ai.savedToWiki') + name);
    };
    buttonRow(box, dlg.close, stopBtn, saveBtn, runBtn);
  });
}

// ══════════════════════════════════════════════════════════════
// 6. AI Chat with Story (ข้อ 79)
// ══════════════════════════════════════════════════════════════
// [alpha.160 · P3] ★ แชทรุ่นเก่า (แท็บ `::ai-chat::` · ข้อความอังกฤษฝังโค้ด "Chat with Story") **เลิกใช้**
// ซ้ำกับแผงแชท (alpha.61) และไม่มีฟีเจอร์ใดของแผงเลย (เซสชัน · ระดับการเข้าถึง · RAG · ไฟล์แนบ · สั่งงาน)
// คง export ไว้ให้คำสั่ง/คีย์ลัดเดิม `ai-chat-dialog` ไม่พัง — ส่งต่อไปเปิดแผงใหม่
export async function openAIChat() {
  const [{ showPanel }, { renderFeaturePanel }] = await Promise.all([import('../panels/panel-ui.js'), import('../app.js')]);
  showPanel('ai-chat');
  await renderFeaturePanel('ai-chat');
}
