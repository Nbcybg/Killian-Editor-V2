// ai-ui.js — UI ทั้งหมดของ AI features (ข้อ 72–79): assistant, plot, dialogue, character, world, chat
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { failText } from '../err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import { $, el, state, setStatus, log, t as tr } from '../core.js';   // บทเรียน 25: ในไฟล์นี้ตัวแปร t = แท็บ → i18n ใช้ชื่อ tr
import { callAI, aiConfigured } from '../ai-settings.js';
import { listScenes, listEntities } from '../project-scan.js';
import { gi } from '../icons.js';

// ══ [alpha.159 · M22] ★ สถานะของ "ช่องผล" อยู่ที่ธง ไม่ใช่ที่ตัวอักษร ══
// เดิมปุ่มแทรก/บันทึกกันข้อความ error ด้วย `r.startsWith('❌')` — ไอคอนมาจากทะเบียน (gi('fail'))
// เปลี่ยน glyph/ใส่ svg เมื่อไหร่ ด่านนี้พังเงียบแล้ว **ข้อความ error ถูกแทรกลงฉากจริง**
// ตอนนี้ทุกทางเขียนช่องผลผ่าน setResult() ซึ่งตั้ง dataset.state = busy | err | ok
function setResult(div, text, st = 'ok') { div.textContent = text; div.dataset.state = st; }
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
  setResult(div, gi('fail') + ' ' + ((res && res.error) || tr(fallbackKey)), 'err');
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
async function wikiEntityByName(name) {
  if (!name || !state.root) return null;
  try {
    const hit = (await listEntities(state.root)).find((e) => e.name === name
      || (e.aliases || []).includes(name));
    return hit ? { ...hit.entity } : null;
  } catch { return null; }
}

function showDialog(title, bodyFn, widthClass = 'k-wide') {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog ' + widthClass);
  box.append(el('div', 'k-dlg-title', title));
  bodyFn(box, ov);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  return { ov, box };
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

  showDialog(tr('ai.assistantTitle'), (box, ov) => {
    const TASK_TH = { expand: tr('ai.opExpand'), summarize: tr('ai.opSummarize'), rewrite: tr('ai.opRewrite'),
                      changeTone: tr('ai.opTone'), continue: tr('ai.opContinue') };
    const TONE_TH = { formal: tr('ai.toneFormal'), casual: tr('ai.toneCasual'), humorous: tr('ai.toneFunny'), dark: tr('ai.toneDark'),
                      romantic: tr('ai.toneRomantic'), tense: tr('ai.toneTense'), concise: tr('ai.toneConcise'), lyrical: tr('ai.toneDetailed') };
    // [alpha.147] `el()` รับแค่ (tag, cls, text) — อาร์กิวเมนต์ที่สี่ `{ value }` ถูกทิ้งเงียบ ๆ
    // → <option> ไม่มี value → select.value คืน "ข้อความไทย" แล้วส่ง task="ขยายความ" ไปให้เอนจิน
    const opt = (text, value) => { const o = el('option', '', text); o.value = value; return o; };
    const taskSel = el('select');
    Object.keys(TASK_TH).forEach((v) => taskSel.append(opt(TASK_TH[v], v)));
    const toneSel = el('select');
    toneSel.append(opt(tt('ui.ai.notChangeTone'), ''));
    Object.keys(TONE_TH).forEach((v) => toneSel.append(opt(TONE_TH[v], v)));
    const instrInput = el('textarea'); instrInput.placeholder = tr('ai.extraHint');
    instrInput.style.cssText = 'width:100%;min-height:60px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical';

    const textInput = el('textarea');
    textInput.value = sel || fullText.slice(0, 3000);
    textInput.placeholder = tr('ai.inputLabel');
    textInput.style.cssText = 'width:100%;min-height:120px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical;margin-top:8px';

    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:40vh;overflow-y:auto;white-space:pre-wrap;margin:8px 0;padding:8px;background:var(--side);border-radius:6px;min-height:60px;font-size:14px;line-height:1.8';

    const row1 = el('div', 'k-row');
    row1.append(el('label', '', tr('ai.opLabel')), taskSel);
    row1.append(el('label', '', tr('ai.toneLabel')), toneSel);
    box.append(row1);
    box.append(instrInput);
    box.append(el('label', '', tr('ai.textLabel')));
    box.append(textInput);
    box.append(el('label', '', tr('ai.resultLabel')));
    box.append(resultDiv);

    const btns = el('div', 'k-dlg-btns');
    const runBtn = el('button', 'k-ok', tt('ui.ai.result'));
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      setResult(resultDiv, tr('ai.working'), 'busy');
      const task = taskSel.value;
      const tone = toneSel.value;
      const instr = instrInput.value.trim();
      const text = textInput.value.trim() || fullText;

      // ใช้เอนจิน ai-assistant.js (prompt ต่อ task + RAG จากโปรเจกต์ + สตรีมผล)
      // [alpha.129 ข้อ 3] เดิมไม่มี try/catch: import พัง · เอนจินโยน · เครือข่ายล้ม
      // = หลุดออกไปทั้งที่ปุ่มยัง disabled และช่องผลค้างที่ "กำลังทำงาน…" ตลอดไป
      // ผู้ใช้ต้องปิดกล่องเปิดใหม่ทุกครั้ง — เป็นหนึ่งในที่มาของ "ใช้ยาก ไม่เหมือน web"
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
        runBtn.disabled = false;
      }
    };

    const insertBtn = el('button', '', tt('ui.ai.insertScene'));
    insertBtn.onclick = () => {
      const r = resultDiv.textContent;
      // [alpha.128] เดิมกัน "ข้อความระหว่างรอ" ด้วย `r.startsWith('กำลัง')` — แต่ข้อความนั้น
      // มาจากไฟล์ภาษา → หน้าจออังกฤษกันไม่ติด แล้วปุ่มแทรกจะยัด "Working…" ลงฉากจริง ๆ
      // เทียบกับข้อความตัวเดียวกันที่เพิ่งเขียนลงไปแทน
      if (!resultReady(resultDiv)) return;             // [alpha.159 · M22] ธง ไม่ใช่ตัวอักษร
      // [alpha.82] เดิมเรียก cmd('insertText') ที่ไม่มีอยู่จริง → ปุ่มนี้ก็ไม่เคยแทรกอะไรเลย
      if (t?.sp) t.sp.insertScript(r);
      else if (t?.editor) t.editor.insertLines(r);
      ov.remove();
      setStatus(tr('ai.insertedResult'));
    };
    btns.append(runBtn, insertBtn, el('button', 'k-cancel', tt('ui.common.close')));
    const closeBtn = btns.lastChild;
    closeBtn.onclick = () => ov.remove();
    box.append(btns);
  });
}

// ══════════════════════════════════════════════════════════════
// 2. AI Plot Hole Detector (ข้อ 73)
// ══════════════════════════════════════════════════════════════
export async function openPlotHoleDetector() {
  if (!(await aiReady())) return;
  if (!state.root) { setStatus(tr('ai.openProjectFirst')); return; }

  setStatus(tr('ai.plotWorking'));

  showDialog(tr('ai.plotTitle'), async (box, ov) => {
    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:50vh;overflow-y:auto;white-space:pre-wrap;font-size:14px;line-height:1.8;min-height:80px';
    resultDiv.textContent = tr('ai.collectingScenes');
    box.append(resultDiv);

    // รวบรวมฉากทั้งหมด (path ของบทมาจาก draft.json — ดู project-scan.js)
    let allScenes = [];
    try {
      allScenes = (await listScenes(state.root, { withText: true }))
        .map((s) => ({ id: s.id, title: s.title, chapterId: s.chapterId, text: s.body || '',   // [alpha.149] ไม่มี frontmatter
                       storyDate: s.row.storyDate || '', pov: s.row.pov || '' }));
    } catch (e) { resultDiv.textContent = failText(tr('ai.readFail'), e); return; }

    if (!allScenes.length) { resultDiv.textContent = tr('ai.noScenes'); return; }

    // ใช้เอนจิน ai-plot.js (แบ่ง batch ตามงบ token + ตรวจออฟไลน์ + แปลงคำตอบเป็นโครงสร้าง)
    resultDiv.textContent = tr('ai.sendingToAi');
    const { detectPlotHoles } = await import('./ai-plot.js');
    const { getAIClient } = await import('./ai-bridge.js');
    const res = await detectPlotHoles([], { client: getAIClient(), scenes: allScenes });

    resultDiv.textContent = '';
    if (!res.holes.length) {
      resultDiv.textContent = res.error ? gi('fail') + ' ' + res.error : tr('ai.noPlotHoles');
    } else {
      resultDiv.append(el('div', 'dim', ttf('ui.ai.foundDotCheckRound', res.holes.length, res.batches)));
      for (const h of res.holes) {
        const row = el('div');
        row.style.cssText = 'margin:8px 0;padding:8px 10px;background:var(--side);border-radius:6px;border-left:3px solid var(--accent)';
        const sev = { high: gi('dot-red'), medium: gi('dot-yellow'), low: gi('dot-white') }[h.severity] || '•';
        row.append(el('div', '', `${sev} [${h.type || tr('ai.general')}] ${h.description || ''}`));
        if (h.sceneTitle || h.sceneId) row.append(el('div', 'dim', tr('ai.sceneLabel') + (h.sceneTitle || h.sceneId)));
        if (h.evidence) row.append(el('div', 'dim', tr('ai.evidenceLabel') + h.evidence));
        if (h.suggestion) row.append(el('div', '', gi('bulb') + ' ' + h.suggestion));
        resultDiv.append(row);
      }
      if (res.failedBatches) resultDiv.append(el('div', 'dim', ttf('ui.ai.hasRoundCallAI', res.failedBatches)));
    }

    const btns = el('div', 'k-dlg-btns');
    const closeBtn = el('button', 'k-cancel', tt('ui.common.close'));
    closeBtn.onclick = () => ov.remove();
    btns.append(closeBtn);
    box.append(btns);
  });
}

// ══════════════════════════════════════════════════════════════
// 3. AI Dialogue Generator (ข้อ 74)
// ══════════════════════════════════════════════════════════════
export async function openDialogueGenerator() {
  if (!(await aiReady())) return;

  showDialog(tr('ai.dialogueTitle'), (box, ov) => {
    box.style.minWidth = '500px';
    const charA = el('input'); charA.placeholder = tt('ui.ai.nameA');
    const charB = el('input'); charB.placeholder = tt('ui.ai.nameB');
    const descA = el('textarea'); descA.placeholder = tr('ai.charADesc');
    descA.style.cssText = 'width:100%;min-height:60px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical';
    const descB = el('textarea'); descB.placeholder = tr('ai.charBDesc');
    descB.style.cssText = descA.style.cssText;
    const context = el('textarea'); context.placeholder = tr('ai.dialogueCtx');
    context.style.cssText = descA.style.cssText;
    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:35vh;overflow-y:auto;white-space:pre-wrap;margin:8px 0;padding:8px;background:var(--side);border-radius:6px;min-height:60px;font-size:14px;line-height:1.8';

    const fmtSel = el('select');
    // [alpha.149] `el()` รับแค่ (tag, cls, text) — `{ value }` เคยถูกทิ้งเงียบ ๆ → value = ป้ายภาษาไทย
    // เอนจินเช็ค `format === 'prose'` ไม่เคยตรง = เลือก "ร้อยแก้ว" แล้วยังได้บทภาพยนตร์ (บั๊กเดียวกับ alpha.147)
    for (const [value, label] of [['screenplay', tt('ui.common.screenplay')], ['prose', tt('ui.ai.edit')]]) {
      const o = el('option', '', label); o.value = value; fmtSel.append(o);
    }

    box.append(el('div', 'k-row'));
    box.querySelector('.k-row').append(el('label', '', tr('ai.charA')), charA);
    box.append(descA);
    box.append(el('label', '', tr('ai.charB')));
    box.append(charB);
    box.append(descB);
    box.append(el('label', '', tr('ai.ctxLabel')));
    box.append(context);
    const fmtRow = el('div', 'k-row');
    fmtRow.append(el('label', '', tr('ai.formatLabel')), fmtSel);
    box.append(fmtRow);
    box.append(el('label', '', tr('ai.dialogueLabel')));
    box.append(resultDiv);

    const btns = el('div', 'k-dlg-btns');
    const runBtn = el('button', 'k-ok', tt('ui.ai.new'));
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      setResult(resultDiv, tr('ai.dialogueWorking'), 'busy');
      const a = charA.value.trim(), b = charB.value.trim(), ctx = context.value.trim();
      if (!a || !b) { setResult(resultDiv, tr('ai.needBothChars'), 'err'); runBtn.disabled = false; return; }
      // ใช้เอนจิน ai-dialogue.js — ดึงบุคลิกจาก Wiki ก่อน แล้วค่อยใช้ที่พิมพ์ในกล่อง
      // [alpha.129 ข้อ 3] เดิมไม่มี try/catch: import พัง · เอนจินโยน · เครือข่ายล้ม
      // = หลุดออกไปทั้งที่ปุ่มยัง disabled และช่องผลค้างที่ "กำลังทำงาน…" ตลอดไป
      // ผู้ใช้ต้องปิดกล่องเปิดใหม่ทุกครั้ง — เป็นหนึ่งในที่มาของ "ใช้ยาก ไม่เหมือน web"
      try {
        const { generateDialogue } = await import('./ai-dialogue.js');
        const { getAIClient } = await import('./ai-bridge.js');
        const profA = (await wikiEntityByName(a)) || { name: a };
        const profB = (await wikiEntityByName(b)) || { name: b };
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
        runBtn.disabled = false;
      }
    };
    const insertBtn = el('button', '', tt('ui.ai.insert'));
    insertBtn.onclick = () => {
      const r = resultDiv.textContent;
      if (!resultReady(resultDiv)) return;   // [alpha.128] ดูข้อ 1 · [alpha.159 · M22] อ่านธง
      // [alpha.82] เดิมเรียก cmd('insertText') ซึ่ง **ไม่มีใน switch ของ cmd()** ทั้งสองตัวแก้ไข
      // → ตกไปที่ default เงียบ ๆ ปุ่มนี้จึงไม่เคยแทรกอะไรลงฉากเลยตั้งแต่วันแรก
      const t = state.active;
      if (t?.sp) t.sp.insertScript(r);
      else if (t?.editor) t.editor.insertLines(r);
      ov.remove(); setStatus(tr('ai.insertedDialogue'));
    };
    btns.append(runBtn, insertBtn, el('button', 'k-cancel', tt('ui.common.close')));
    btns.lastChild.onclick = () => ov.remove();
    box.append(btns);
  });
}

// ══════════════════════════════════════════════════════════════
// 4. AI Character Consistency Check (ข้อ 75)
// ══════════════════════════════════════════════════════════════
export async function openConsistencyCheck(entityPath) {
  if (!(await aiReady())) return;
  if (!entityPath) { setStatus(tr('ai.pickEntity')); return; }

  let entity;
  try { entity = await kapi.readJson(entityPath); } catch { setStatus(tr('ai.entityReadFail')); return; }
  if (!entity || !entity.name) { setStatus(tr('ai.entityUnnamed')); return; }

  setStatus(tr('ai.consistWorking'));
  showDialog(tr('ai.consistTitle') + entity.name, async (box, ov) => {
    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:50vh;overflow-y:auto;white-space:pre-wrap;font-size:14px;line-height:1.8;min-height:80px';
    resultDiv.textContent = tr('ai.collecting');
    box.append(resultDiv);

    // ใช้เอนจิน ai-character.js — หาฉากที่ตัวละครปรากฏเอง + ตรวจออฟไลน์ + แปลงคำตอบเป็นโครงสร้าง
    const scenes = (await listScenes(state.root, { withText: true }))
      .map((s) => ({ id: s.id, title: s.title, text: s.body || '', storyDate: s.row.storyDate || '' }));
    resultDiv.textContent = tr('ai.sendingToAi');
    const { checkConsistency } = await import('./ai-character.js');
    const { getAIClient } = await import('./ai-bridge.js');
    const res = await checkConsistency(entityPath, { client: getAIClient(), entity, scenes });

    resultDiv.textContent = '';
    if (!res.issues.length) {
      resultDiv.textContent = res.error ? gi('fail') + ' ' + res.error : tr('ai.noInconsist');
    } else {
      resultDiv.append(el('div', 'dim', ttf('ui.ai.foundDotSceneAppear', res.issues.length, res.appearances || 0)));
      for (const it of res.issues) {
        const row = el('div');
        row.style.cssText = 'margin:8px 0;padding:8px 10px;background:var(--side);border-radius:6px;border-left:3px solid var(--accent)';
        row.append(el('div', '', `• [${it.aspect || tr('ai.general')}] ${it.issue || ''}`));
        if (it.sceneTitle || it.sceneId) row.append(el('div', 'dim', tr('ai.sceneLabel') + (it.sceneTitle || it.sceneId)));
        if (it.evidence) row.append(el('div', 'dim', tr('ai.evidenceLabel') + it.evidence));
        if (it.suggestion) row.append(el('div', '', gi('bulb') + ' ' + it.suggestion));
        resultDiv.append(row);
      }
    }

    const btns = el('div', 'k-dlg-btns');
    const closeBtn = el('button', 'k-cancel', tt('ui.common.close'));
    closeBtn.onclick = () => ov.remove();
    btns.append(closeBtn);
    box.append(btns);
  });
}

// ══════════════════════════════════════════════════════════════
// 5. AI Worldbuilding Generator (ข้อ 76)
// ══════════════════════════════════════════════════════════════
export async function openWorldGenerator() {
  if (!(await aiReady())) return;

  showDialog(tr('ai.worldTitle'), (box, ov) => {
    const typeSel = el('select');
    ['magic', 'city', 'culture', 'economy', 'religion', 'faction'].forEach((v) => {
      const labels = { magic: tr('ai.wMagic'), city: tr('ai.wCity'), culture: tr('ai.wCulture'), economy: tr('ai.wEconomy'), religion: tr('ai.wReligion'), faction: tr('ai.wFaction') };
      { const o = el('option', '', labels[v] || v); o.value = v; typeSel.append(o); }   // [alpha.147] el() ไม่รับ {value}
    });

    const promptInput = el('textarea');
    promptInput.placeholder = tr('ai.worldPrompt');
    promptInput.style.cssText = 'width:100%;min-height:80px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical';

    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:40vh;overflow-y:auto;white-space:pre-wrap;margin:8px 0;padding:8px;background:var(--side);border-radius:6px;min-height:80px;font-size:14px;line-height:1.8';

    box.append(el('div', 'k-row'));
    box.querySelector('.k-row').append(el('label', '', tr('ai.kindLabel')), typeSel);
    box.append(el('label', '', tr('ai.detailLabel')));
    box.append(promptInput);
    box.append(el('label', '', tr('ai.resultLabel')));
    box.append(resultDiv);

    const btns = el('div', 'k-dlg-btns');
    const runBtn = el('button', 'k-ok', tt('ui.ai.new'));
    let lastWorld = null;                     // ผลลัพธ์ที่ผ่าน schema แล้ว (ใช้ตอนบันทึกลง Wiki)
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      setResult(resultDiv, tr('ai.generating'), 'busy');
      lastWorld = null;
      // ใช้เอนจิน ai-world.js — มีเทมเพลตต่อประเภท + ตรวจว่าคำตอบครบโครง (ไม่ครบ = ลองใหม่)
      // [alpha.129 ข้อ 3] เดิมไม่มี try/catch: import พัง · เอนจินโยน · เครือข่ายล้ม
      // = หลุดออกไปทั้งที่ปุ่มยัง disabled และช่องผลค้างที่ "กำลังทำงาน…" ตลอดไป
      // ผู้ใช้ต้องปิดกล่องเปิดใหม่ทุกครั้ง — เป็นหนึ่งในที่มาของ "ใช้ยาก ไม่เหมือน web"
      try {
        const { generateWorld, toMarkdown } = await import('./ai-world.js');
        const { getAIClient } = await import('./ai-bridge.js');
        const res = await generateWorld(typeSel.value, promptInput.value.trim() || tr('ai.freeform'),
                                        { client: getAIClient() });
        if (res.ok) { lastWorld = res.world; setResult(resultDiv, toMarkdown(res.world), 'ok'); }
        else setResult(resultDiv, gi('fail') + ' ' + (res.error || tr('ai.error')), 'err');
      } catch (e) {
        setResult(resultDiv, gi('fail') + ' ' + ((e && e.message) || tr('ai.error')), 'err');
      } finally {
        runBtn.disabled = false;
      }
    };
    const saveBtn = el('button', '', tt('ui.ai.saveWiki'));
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
      setStatus(tr('ai.savedToWiki') + name);
    };
    btns.append(runBtn, saveBtn, el('button', 'k-cancel', tt('ui.common.close')));
    btns.lastChild.onclick = () => ov.remove();
    box.append(btns);
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
