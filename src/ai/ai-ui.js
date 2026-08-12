// ai-ui.js — UI ทั้งหมดของ AI features (ข้อ 72–79): assistant, plot, dialogue, character, world, chat
import { T } from '../i18n.js';
import { $, el, state, setStatus, log, t as tr } from '../core.js';   // บทเรียน 25: ในไฟล์นี้ตัวแปร t = แท็บ → i18n ใช้ชื่อ tr
import { callAI, aiConfigured } from '../ai-settings.js';
import { listScenes, listEntities } from '../project-scan.js';

// ───────── helper: เช็คว่า AI พร้อมหรือยัง ─────────
// [alpha.62 บั๊ก 6] ถามจุดเดียวที่ `aiConfigured()` — รู้จักทั้งทะเบียนใหม่ (alpha.61) และค่าตั้งแบบเก่า
async function aiReady() {
  if (!state.root) { setStatus(tr('ai.noProject', 'ยังไม่ได้เปิดโปรเจกต์')); return false; }
  const r = await aiConfigured();
  if (r.ok) return true;
  setStatus('❌ ' + (r.why || tr('ai.needSetup', 'ตั้งค่า AI ที่ ไฟล์ → ตั้งค่า AI ก่อน')));
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
  const sel = t?.editor ? t.editor.getSelectedText() : (t?.sp ? t.sp.getSelectedText() : '');
  const fullText = t?.editor ? t.editor.getText() : (t?.sp ? t.sp.getText() : '');

  showDialog(tr('ai.assistantTitle', '✨ AI ผู้ช่วยเขียน'), (box, ov) => {
    const TASK_TH = { expand: tr('ai.opExpand', 'ขยายความ'), summarize: tr('ai.opSummarize', 'สรุปความ'), rewrite: tr('ai.opRewrite', 'เขียนใหม่'),
                      changeTone: tr('ai.opTone', 'เปลี่ยนโทน'), continue: tr('ai.opContinue', 'เขียนต่อ') };
    const TONE_TH = { formal: tr('ai.toneFormal', 'ทางการ'), casual: tr('ai.toneCasual', 'กันเอง'), humorous: tr('ai.toneFunny', 'ตลก'), dark: tr('ai.toneDark', 'มืดหม่น'),
                      romantic: tr('ai.toneRomantic', 'โรแมนติก'), tense: tr('ai.toneTense', 'ระทึก'), concise: tr('ai.toneConcise', 'กระชับ'), lyrical: tr('ai.toneDetailed', 'บรรยายละเอียด') };
    const taskSel = el('select');
    Object.keys(TASK_TH).forEach((v) => taskSel.append(el('option', '', TASK_TH[v], { value: v })));
    const toneSel = el('select');
    toneSel.append(el('option', '', T`ไม่เปลี่ยนโทน`, { value: '' }));
    Object.keys(TONE_TH).forEach((v) => toneSel.append(el('option', '', TONE_TH[v], { value: v })));
    const instrInput = el('textarea'); instrInput.placeholder = tr('ai.extraHint', 'คำแนะนำเพิ่มเติม (ถ้ามี)');
    instrInput.style.cssText = 'width:100%;min-height:60px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical';

    const textInput = el('textarea');
    textInput.value = sel || fullText.slice(0, 3000);
    textInput.placeholder = tr('ai.inputLabel', 'ข้อความที่จะประมวลผล');
    textInput.style.cssText = 'width:100%;min-height:120px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical;margin-top:8px';

    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:40vh;overflow-y:auto;white-space:pre-wrap;margin:8px 0;padding:8px;background:var(--side);border-radius:6px;min-height:60px;font-size:14px;line-height:1.8';

    const row1 = el('div', 'k-row');
    row1.append(el('label', '', tr('ai.opLabel', 'คำสั่ง: ')), taskSel);
    row1.append(el('label', '', tr('ai.toneLabel', ' โทน: ')), toneSel);
    box.append(row1);
    box.append(instrInput);
    box.append(el('label', '', tr('ai.textLabel', 'ข้อความ:')));
    box.append(textInput);
    box.append(el('label', '', tr('ai.resultLabel', 'ผลลัพธ์:')));
    box.append(resultDiv);

    const btns = el('div', 'k-dlg-btns');
    const runBtn = el('button', 'k-ok', T`▶ ประมวลผล`);
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      resultDiv.textContent = tr('ai.working', 'กำลังประมวลผล…');
      const task = taskSel.value;
      const tone = toneSel.value;
      const instr = instrInput.value.trim();
      const text = textInput.value.trim() || fullText;

      // ใช้เอนจิน ai-assistant.js (prompt ต่อ task + RAG จากโปรเจกต์ + สตรีมผล)
      const { aiAssistant } = await import('./ai-assistant.js');
      const { getAIClient, getRag } = await import('./ai-bridge.js');
      let rag = null;
      try { rag = await getRag(); } catch {}
      let acc = '';
      const res = await aiAssistant(instr, { text }, {
        client: getAIClient(), rag, task, tone: tone || undefined, instruction: instr, text,
        stream: true, onChunk: (c) => { acc += c; resultDiv.textContent = acc; },
      });
      if (res.ok) resultDiv.textContent = res.text || acc || tr('ai.noAnswer', '(ไม่มีคำตอบ)');
      else resultDiv.textContent = '❌ ' + (res.error || tr('ai.errorRetry', 'เกิดข้อผิดพลาด กรุณาลองใหม่'));
      runBtn.disabled = false;
    };

    const insertBtn = el('button', '', T`📥 แทรกลงฉาก`);
    insertBtn.onclick = () => {
      const r = resultDiv.textContent;
      if (!r || r.startsWith('❌') || r.startsWith('กำลัง')) return;
      if (t?.editor) t.editor.cmd('insertText', r);
      else if (t?.sp) t.sp.cmd('insertText', r);
      ov.remove();
      setStatus(tr('ai.insertedResult', 'แทรกผลลัพธ์ AI ลงฉากแล้ว'));
    };
    btns.append(runBtn, insertBtn, el('button', 'k-cancel', T`ปิด`));
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
  if (!state.root) { setStatus(tr('ai.openProjectFirst', 'เปิดโปรเจกต์ก่อน')); return; }

  setStatus(tr('ai.plotWorking', '🔍 กำลังตรวจสอบ Plot Holes…'));

  showDialog(tr('ai.plotTitle', '🔍 ตรวจสอบ Plot Hole'), async (box, ov) => {
    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:50vh;overflow-y:auto;white-space:pre-wrap;font-size:14px;line-height:1.8;min-height:80px';
    resultDiv.textContent = tr('ai.collectingScenes', 'กำลังรวบรวมข้อมูลฉาก…');
    box.append(resultDiv);

    // รวบรวมฉากทั้งหมด (path ของบทมาจาก draft.json — ดู project-scan.js)
    let allScenes = [];
    try {
      allScenes = (await listScenes(state.root, { withText: true }))
        .map((s) => ({ id: s.id, title: s.title, chapterId: s.chapterId, text: s.text || '',
                       storyDate: s.row.storyDate || '', pov: s.row.pov || '' }));
    } catch (e) { resultDiv.textContent = tr('ai.readFail', '❌ อ่านไฟล์ไม่สำเร็จ: ') + e.message; return; }

    if (!allScenes.length) { resultDiv.textContent = tr('ai.noScenes', '(ไม่พบฉากในโปรเจกต์นี้)'); return; }

    // ใช้เอนจิน ai-plot.js (แบ่ง batch ตามงบ token + ตรวจออฟไลน์ + แปลงคำตอบเป็นโครงสร้าง)
    resultDiv.textContent = tr('ai.sendingToAi', 'กำลังส่งให้ AI วิเคราะห์…');
    const { detectPlotHoles } = await import('./ai-plot.js');
    const { getAIClient } = await import('./ai-bridge.js');
    const res = await detectPlotHoles([], { client: getAIClient(), scenes: allScenes });

    resultDiv.textContent = '';
    if (!res.holes.length) {
      resultDiv.textContent = res.error ? '❌ ' + res.error : tr('ai.noPlotHoles', '✅ ไม่พบจุดบกพร่องของพล็อต');
    } else {
      resultDiv.append(el('div', 'dim', T`พบ ${res.holes.length} จุด · ตรวจ ${res.batches} รอบ`));
      for (const h of res.holes) {
        const row = el('div');
        row.style.cssText = 'margin:8px 0;padding:8px 10px;background:var(--side);border-radius:6px;border-left:3px solid var(--accent)';
        const sev = { high: '🔴', medium: '🟡', low: '⚪' }[h.severity] || '•';
        row.append(el('div', '', `${sev} [${h.type || tr('ai.general', 'ทั่วไป')}] ${h.description || ''}`));
        if (h.sceneTitle || h.sceneId) row.append(el('div', 'dim', tr('ai.sceneLabel', 'ฉาก: ') + (h.sceneTitle || h.sceneId)));
        if (h.evidence) row.append(el('div', 'dim', tr('ai.evidenceLabel', 'หลักฐาน: ') + h.evidence));
        if (h.suggestion) row.append(el('div', '', '💡 ' + h.suggestion));
        resultDiv.append(row);
      }
      if (res.failedBatches) resultDiv.append(el('div', 'dim', T`⚠ มี ${res.failedBatches} รอบที่เรียก AI ไม่สำเร็จ`));
    }

    const btns = el('div', 'k-dlg-btns');
    const closeBtn = el('button', 'k-cancel', T`ปิด`);
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

  showDialog(tr('ai.dialogueTitle', '💬 สร้างบทสนทนา'), (box, ov) => {
    box.style.minWidth = '500px';
    const charA = el('input'); charA.placeholder = T`ชื่อตัวละคร A`;
    const charB = el('input'); charB.placeholder = T`ชื่อตัวละคร B`;
    const descA = el('textarea'); descA.placeholder = tr('ai.charADesc', 'คำอธิบายตัวละคร A (บุคลิก, พูดจา, เป้าหมาย…)');
    descA.style.cssText = 'width:100%;min-height:60px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical';
    const descB = el('textarea'); descB.placeholder = tr('ai.charBDesc', 'คำอธิบายตัวละคร B');
    descB.style.cssText = descA.style.cssText;
    const context = el('textarea'); context.placeholder = tr('ai.dialogueCtx', 'บริบทของบทสนทนา (สถานการณ์, สถานที่, เป้าหมาย…)');
    context.style.cssText = descA.style.cssText;
    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:35vh;overflow-y:auto;white-space:pre-wrap;margin:8px 0;padding:8px;background:var(--side);border-radius:6px;min-height:60px;font-size:14px;line-height:1.8';

    const fmtSel = el('select');
    fmtSel.append(el('option', '', T`บทภาพยนตร์`, { value: 'screenplay' }));
    fmtSel.append(el('option', '', T`ร้อยแก้ว`, { value: 'prose' }));

    box.append(el('div', 'k-row'));
    box.querySelector('.k-row').append(el('label', '', tr('ai.charA', 'ตัวละคร A: ')), charA);
    box.append(descA);
    box.append(el('label', '', tr('ai.charB', 'ตัวละคร B: ')));
    box.append(charB);
    box.append(descB);
    box.append(el('label', '', tr('ai.ctxLabel', 'บริบท: ')));
    box.append(context);
    const fmtRow = el('div', 'k-row');
    fmtRow.append(el('label', '', tr('ai.formatLabel', 'รูปแบบ: ')), fmtSel);
    box.append(fmtRow);
    box.append(el('label', '', tr('ai.dialogueLabel', 'บทสนทนา:')));
    box.append(resultDiv);

    const btns = el('div', 'k-dlg-btns');
    const runBtn = el('button', 'k-ok', T`▶ สร้าง`);
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      resultDiv.textContent = tr('ai.dialogueWorking', 'กำลังสร้างบทสนทนา…');
      const a = charA.value.trim(), b = charB.value.trim(), ctx = context.value.trim();
      if (!a || !b) { resultDiv.textContent = tr('ai.needBothChars', '❌ กรุณาใส่ชื่อตัวละครทั้งสอง'); runBtn.disabled = false; return; }
      // ใช้เอนจิน ai-dialogue.js — ดึงบุคลิกจาก Wiki ก่อน แล้วค่อยใช้ที่พิมพ์ในกล่อง
      const { generateDialogue } = await import('./ai-dialogue.js');
      const { getAIClient } = await import('./ai-bridge.js');
      const profA = (await wikiEntityByName(a)) || { name: a };
      const profB = (await wikiEntityByName(b)) || { name: b };
      if (descA.value.trim()) profA.personality = descA.value.trim();
      if (descB.value.trim()) profB.personality = descB.value.trim();
      let acc = '';
      const res = await generateDialogue(profA, profB, { situation: ctx },
        { client: getAIClient(), format: fmtSel.value, stream: true,
          onChunk: (c) => { acc += c; resultDiv.textContent = acc; } });
      if (res.ok) {
        resultDiv.textContent = res.text;
        if (res.speakers?.length) resultDiv.title = tr('ai.speakerLabel', 'ผู้พูด: ') + res.speakers.join(', ');
      } else resultDiv.textContent = '❌ ' + (res.error || tr('ai.error', 'เกิดข้อผิดพลาด'));
      runBtn.disabled = false;
    };
    const insertBtn = el('button', '', T`📥 แทรก`);
    insertBtn.onclick = () => {
      const r = resultDiv.textContent;
      if (!r || r.startsWith('❌') || r.startsWith('กำลัง')) return;
      const t = state.active;
      if (t?.editor) t.editor.cmd('insertText', r);
      else if (t?.sp) t.sp.cmd('insertText', r);
      ov.remove(); setStatus(tr('ai.insertedDialogue', 'แทรกบทสนทนาลงฉากแล้ว'));
    };
    btns.append(runBtn, insertBtn, el('button', 'k-cancel', T`ปิด`));
    btns.lastChild.onclick = () => ov.remove();
    box.append(btns);
  });
}

// ══════════════════════════════════════════════════════════════
// 4. AI Character Consistency Check (ข้อ 75)
// ══════════════════════════════════════════════════════════════
export async function openConsistencyCheck(entityPath) {
  if (!(await aiReady())) return;
  if (!entityPath) { setStatus(tr('ai.pickEntity', 'เลือกเอนทิตี้ (ตัวละคร) ก่อน')); return; }

  let entity;
  try { entity = await kapi.readJson(entityPath); } catch { setStatus(tr('ai.entityReadFail', 'อ่านไฟล์เอนทิตี้ไม่สำเร็จ')); return; }
  if (!entity || !entity.name) { setStatus(tr('ai.entityUnnamed', 'เอนทิตี้ไม่มีชื่อ')); return; }

  setStatus(tr('ai.consistWorking', '🎭 กำลังตรวจสอบความสม่ำเสมอ…'));
  showDialog(tr('ai.consistTitle', '🎭 ตรวจสอบความสม่ำเสมอ — ') + entity.name, async (box, ov) => {
    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:50vh;overflow-y:auto;white-space:pre-wrap;font-size:14px;line-height:1.8;min-height:80px';
    resultDiv.textContent = tr('ai.collecting', 'กำลังรวบรวมข้อมูล…');
    box.append(resultDiv);

    // ใช้เอนจิน ai-character.js — หาฉากที่ตัวละครปรากฏเอง + ตรวจออฟไลน์ + แปลงคำตอบเป็นโครงสร้าง
    const scenes = (await listScenes(state.root, { withText: true }))
      .map((s) => ({ id: s.id, title: s.title, text: s.text || '', storyDate: s.row.storyDate || '' }));
    resultDiv.textContent = tr('ai.sendingToAi', 'กำลังส่งให้ AI วิเคราะห์…');
    const { checkConsistency } = await import('./ai-character.js');
    const { getAIClient } = await import('./ai-bridge.js');
    const res = await checkConsistency(entityPath, { client: getAIClient(), entity, scenes });

    resultDiv.textContent = '';
    if (!res.issues.length) {
      resultDiv.textContent = res.error ? '❌ ' + res.error : tr('ai.noInconsist', '✅ ไม่พบความไม่สม่ำเสมอ');
    } else {
      resultDiv.append(el('div', 'dim', T`พบ ${res.issues.length} จุด จาก ${res.appearances || 0} ฉากที่ปรากฏ`));
      for (const it of res.issues) {
        const row = el('div');
        row.style.cssText = 'margin:8px 0;padding:8px 10px;background:var(--side);border-radius:6px;border-left:3px solid var(--accent)';
        row.append(el('div', '', `• [${it.aspect || tr('ai.general', 'ทั่วไป')}] ${it.issue || ''}`));
        if (it.sceneTitle || it.sceneId) row.append(el('div', 'dim', tr('ai.sceneLabel', 'ฉาก: ') + (it.sceneTitle || it.sceneId)));
        if (it.evidence) row.append(el('div', 'dim', tr('ai.evidenceLabel', 'หลักฐาน: ') + it.evidence));
        if (it.suggestion) row.append(el('div', '', '💡 ' + it.suggestion));
        resultDiv.append(row);
      }
    }

    const btns = el('div', 'k-dlg-btns');
    const closeBtn = el('button', 'k-cancel', T`ปิด`);
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

  showDialog(tr('ai.worldTitle', '🌍 สร้างโลก'), (box, ov) => {
    const typeSel = el('select');
    ['magic', 'city', 'culture', 'economy', 'religion', 'faction'].forEach((v) => {
      const labels = { magic: tr('ai.wMagic', 'ระบบเวทมนตร์'), city: tr('ai.wCity', 'เมือง'), culture: tr('ai.wCulture', 'วัฒนธรรม'), economy: tr('ai.wEconomy', 'เศรษฐกิจ'), religion: tr('ai.wReligion', 'ศาสนา'), faction: tr('ai.wFaction', 'กลุ่ม/ฝ่าย') };
      typeSel.append(el('option', '', labels[v] || v, { value: v }));
    });

    const promptInput = el('textarea');
    promptInput.placeholder = tr('ai.worldPrompt', 'อธิบายสิ่งที่ต้องการสร้าง (เช่น "ระบบเวทมนตร์ที่ใช้เลือดเป็นต้นทุน")');
    promptInput.style.cssText = 'width:100%;min-height:80px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px;font:inherit;resize:vertical';

    const resultDiv = el('div');
    resultDiv.style.cssText = 'max-height:40vh;overflow-y:auto;white-space:pre-wrap;margin:8px 0;padding:8px;background:var(--side);border-radius:6px;min-height:80px;font-size:14px;line-height:1.8';

    box.append(el('div', 'k-row'));
    box.querySelector('.k-row').append(el('label', '', tr('ai.kindLabel', 'ประเภท: ')), typeSel);
    box.append(el('label', '', tr('ai.detailLabel', 'รายละเอียด:')));
    box.append(promptInput);
    box.append(el('label', '', tr('ai.resultLabel', 'ผลลัพธ์:')));
    box.append(resultDiv);

    const btns = el('div', 'k-dlg-btns');
    const runBtn = el('button', 'k-ok', T`▶ สร้าง`);
    let lastWorld = null;                     // ผลลัพธ์ที่ผ่าน schema แล้ว (ใช้ตอนบันทึกลง Wiki)
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      resultDiv.textContent = tr('ai.generating', 'กำลังสร้าง…');
      lastWorld = null;
      // ใช้เอนจิน ai-world.js — มีเทมเพลตต่อประเภท + ตรวจว่าคำตอบครบโครง (ไม่ครบ = ลองใหม่)
      const { generateWorld, toMarkdown } = await import('./ai-world.js');
      const { getAIClient } = await import('./ai-bridge.js');
      const res = await generateWorld(typeSel.value, promptInput.value.trim() || tr('ai.freeform', 'สร้างตามจินตนาการ'),
                                      { client: getAIClient() });
      if (res.ok) { lastWorld = res.world; resultDiv.textContent = toMarkdown(res.world); }
      else resultDiv.textContent = '❌ ' + (res.error || tr('ai.error', 'เกิดข้อผิดพลาด'));
      runBtn.disabled = false;
    };
    const saveBtn = el('button', '', T`📥 บันทึกลง Wiki`);
    saveBtn.onclick = async () => {
      const r = resultDiv.textContent;
      if (!r || r.startsWith('❌') || r.startsWith('กำลัง')) return;
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
                  .concat(lastWorld ? [] : [{ title: tr('ai.description', 'คำอธิบาย'), content: r }]),
        created: new Date().toISOString(),
      };
      const catDir = await kapi.join(await kapi.join(state.root, 'Wiki'), cat);
      await kapi.mkdir(catDir);
      const name = entity.name || 'Worldbuilding';
      const file = await kapi.join(catDir, name.replace(/[\/\\:*?"<>|]/g, '_') + '.json');
      await kapi.writeFile(file, JSON.stringify(entity, null, 2));
      setStatus(tr('ai.savedToWiki', 'บันทึกลง Wiki แล้ว: ') + name);
    };
    btns.append(runBtn, saveBtn, el('button', 'k-cancel', T`ปิด`));
    btns.lastChild.onclick = () => ov.remove();
    box.append(btns);
  });
}

// ══════════════════════════════════════════════════════════════
// 6. AI Chat with Story (ข้อ 79)
// ══════════════════════════════════════════════════════════════
export async function openAIChat() {
  if (!(await aiReady())) return;

  const KEY = '::ai-chat::';
  const { activate, closeTab } = await import('../app.js');
  if (state.tabs.has(KEY)) { activate(KEY); return; }

  const pane = el('div', 'pane');
  pane.style.cssText = 'display:flex;flex-direction:column;height:100%';
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', '💬 Chat with Story'));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);

  // พื้นที่แชท
  const chatArea = el('div');
  chatArea.style.cssText = 'flex:1;overflow-y:auto;padding:12px 24px;font-size:14px;line-height:1.8';
  pane.append(chatArea);

  // แถบพิมพ์
  const inputBar = el('div');
  inputBar.style.cssText = 'display:flex;padding:8px 12px;border-top:1px solid var(--border);background:var(--side)';
  const input = el('input'); input.placeholder = tr('ai.chatPlaceholder', 'ถามเกี่ยวกับเรื่องของคุณ…');
  input.style.cssText = 'flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font:inherit;outline:none';
  const sendBtn = el('button', '', '▶');
  sendBtn.style.cssText = 'margin-left:8px;min-width:48px';
  inputBar.append(input, sendBtn);
  pane.append(inputBar);

  const history = [];

  // track=false → แสดงอย่างเดียว ไม่นับเข้าประวัติที่ส่งให้โมเดล (ใช้กับฟองรอคำตอบ)
  const addMsg = (role, text, track = true) => {
    const msg = el('div');
    msg.style.cssText = 'margin:6px 0;padding:8px 12px;border-radius:8px;white-space:pre-wrap;'
      + (role === 'user' ? 'background:var(--sel);margin-left:40px;' : 'background:var(--bar);margin-right:40px;');
    msg.textContent = text;
    chatArea.append(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
    if (track && text) history.push({ role: role === 'user' ? 'user' : 'assistant', content: text });
    return msg;
  };

  // แถวอ้างอิง (ฉาก/Wiki ที่ RAG ดึงมาใช้) — ให้ผู้ใช้ตรวจได้ว่าคำตอบมาจากไหน
  const addSources = (sources) => {
    if (!sources || !sources.length) return;
    const s = el('div', 'dim');
    s.style.cssText = 'margin:0 40px 8px 0;font-size:11px';
    s.textContent = tr('ai.sources', '📎 อ้างอิง: ') + sources.map((x) => x.label).join(' · ');
    chatArea.append(s);
  };

  sendBtn.onclick = async () => {
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    addMsg('user', q);

    const bubble = addMsg('assistant', '…', false);
    // ---- RAG: ค้นด้วย vector index แทนการยัดฉากแรก ๆ ทั้งดุ้น ----
    let ctx = { text: '', sources: [] };
    try {
      const { ragContext } = await import('./ai-bridge.js');
      bubble.textContent = tr('ai.searchingProject', 'กำลังค้นข้อมูลในโปรเจกต์…');
      ctx = await ragContext(q, { k: 6, maxTokens: 1800 });
    } catch (e) { log('warn', T`ai chat: RAG ใช้ไม่ได้ → ถามตรง ๆ`, e); }

    const system = T`คุณเป็นผู้ช่วยนักเขียน ตอบคำถามเกี่ยวกับเนื้อหานิยายของผู้ใช้ `
      + T`ใช้ข้อมูลจากบริบทที่ให้มาเป็นหลัก ถ้าไม่มีข้อมูลให้บอกว่าไม่พบ ตอบเป็นภาษาไทย`;
    const prompt = (ctx.text ? ctx.text + '\n\n' : '') + T`คำถาม: ` + q;

    bubble.textContent = '';
    let acc = '';
    try {
      const { getAIClient } = await import('./ai-bridge.js');
      const client = getAIClient();
      // ประวัติล่าสุด (ตัดคำถามปัจจุบันออก) + คำถามที่แนบบริบท RAG แล้ว
      const msgs = history.slice(-9, -1).filter((m) => m.content);
      const res = await client.stream(
        { messages: [...msgs, { role: 'user', content: prompt }], system, feature: 'chat' },
        (chunk) => { acc += chunk; bubble.textContent = acc; chatArea.scrollTop = chatArea.scrollHeight; });
      if (!res.ok) { bubble.textContent = '❌ ' + (res.error || tr('ai.callFail', 'เรียก AI ไม่สำเร็จ')); return; }
      if (!acc) { acc = res.text || ''; bubble.textContent = acc || tr('ai.noAnswer', '(ไม่มีคำตอบ)'); }
      history.push({ role: 'assistant', content: acc });
      addSources(ctx.sources);
    } catch (e) {
      // เอนจินใหม่ล้ม → กลับไปทางเดิม เพื่อไม่ให้ผู้ใช้ค้าง
      log('error', T`ai chat: stream ล้มเหลว`, e);
      const result = await callAI(prompt, system);
      bubble.textContent = result || tr('ai.errorMark', '❌ เกิดข้อผิดพลาด');
    }
  };

  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } };

  const tab = { file: KEY, title: '💬 Chat', pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null, gal: null, net: null, planner: null };
  tabBtn.onclick = (ev) => { if (ev.target !== x) activate(KEY); };
  x.onclick = () => closeTab(KEY);
  state.tabs.set(KEY, tab);
  activate(KEY);
  addMsg('assistant', tr('ai.greeting', 'สวัสดี! ถามอะไรเกี่ยวกับเรื่องของคุณได้เลย เช่น') +
    ' "' + tr('ai.sample1', 'เรื่องนี้มีตัวละครอะไรบ้าง') + '" ' +
    tr('ai.orWord', 'หรือ') + ' "' + tr('ai.sample2', 'ช่วยสรุปฉากที่มีไฟต์ให้หน่อย') + '"');
}
