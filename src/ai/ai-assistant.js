// ai-assistant.js — ผู้ช่วยเขียนด้วย AI (ข้อ 72 · ส่วน API ที่ UI เรียก)
// ตรรกะสร้าง prompt แยกเป็น pure function ทั้งหมด → เทสได้ว่าคำสั่งครบโดยไม่ต้องยิง API จริง
// spec: docs/72-ai-core.md
import { t as tt, t } from '../i18n.js';
import { buildContext, estimateTokens } from './ai-core.js';

// ───────── โทนที่รองรับ (ข้อความไทยล้วน — UI เอาไปทำเมนูได้เลย) ─────────
export const TONES = {
  formal:    { label: tt('ui.aiAssistant.msg3'),        hint: tt('ui.aiAssistant.useLangImageWord') },
  casual:    { label: tt('ui.aiAssistant.msg'),         hint: tt('ui.aiAssistant.useLangSpeakStyle') },
  humorous:  { label: tt('ui.aiAssistant.msg2'),            hint: tt('ui.aiAssistant.putMoodNotDo') },
  dark:      { label: tt('ui.aiAssistant.dark'),        hint: tt('ui.aiAssistant.ambiencePressUseImage') },
  romantic:  { label: tt('ui.aiAssistant.msg5'),       hint: tt('ui.aiAssistant.betweenCharacter') },
  tense:     { label: tt('ui.aiAssistant.msg4'),          hint: tt('ui.aiAssistant.sentenceShortConcisePace') },
  concise:   { label: tt('ui.aiAssistant.concise'),         hint: tt('ui.aiAssistant.cutWordOnly') },
  lyrical:   { label: tt('ui.aiAssistant.actionDetailed'),  hint: tt('ui.aiAssistant.imageTouchSee') },
};
export const LENGTHS = { short: tt('ui.aiAssistant.shortMoreSentence'), medium: tt('ui.aiAssistant.mediumPara'), long: tt('ui.aiAssistant.longPara') };

const SYSTEM_TH = tt('ui.aiAssistant.youEditorWriterNovel')
  + tt('ui.aiAssistant.replyThaiAlwaysSend');

// ───────── สร้าง prompt (pure) ─────────
export const TASKS = ['expand', 'summarize', 'rewrite', 'changeTone', 'continue', 'custom'];

/**
 * Build the system + user prompt for a task. Pure — no network.
 * @returns {{system:string, prompt:string, tokens:number}}
 */
export function buildPrompt(task, opts = {}) {
  const {
    text = '', instruction = '', tone = '', length = 'medium',
    language = 'th', context = null, format = 'prose',
  } = opts;
  const lines = [];
  const t = TONES[tone];

  // คำสั่งหลักตามงาน — เขียนเป็นภาษาไทยทั้งหมดเพื่อให้โมเดลตอบไทยได้เสถียรกว่า
  switch (task) {
    case 'expand':
      lines.push(tt('ui.aiAssistant.expandTextDetailedView'));
      lines.push(tt('ui.aiAssistant.addDetailSceneTouch'));
      lines.push(tt('ui.aiAssistant.longGoal') + (LENGTHS[length] || LENGTHS.medium));
      break;
    case 'summarize':
      lines.push(tt('ui.aiAssistant.summaryTextInEvent'));
      lines.push(tt('ui.aiAssistant.longGoal') + (LENGTHS[length] || LENGTHS.medium));
      break;
    case 'rewrite':
      lines.push(tt('ui.aiAssistant.writeTextNewRead'));
      if (instruction) lines.push(tt('ui.aiAssistant.itemDefineAddFill') + instruction);
      break;
    case 'changeTone':
      lines.push(tt('ui.aiAssistant.changeToneTextStyle') + (t ? t.label : tone) + tt('ui.aiAssistant.bodyOrderEventPrev'));
      break;
    case 'continue':
      lines.push(tt('ui.aiAssistant.writeNextTextCont'));
      lines.push(tt('ui.aiAssistant.longGoal') + (LENGTHS[length] || LENGTHS.medium));
      break;
    default:
      lines.push(instruction || tt('ui.aiAssistant.helpAdjustText'));
  }
  if (t && task !== 'changeTone') lines.push(tt('ui.aiAssistant.toneNeed') + t.label + ' — ' + t.hint);
  if (t && task === 'changeTone') lines.push(tt('ui.aiAssistant.tone') + t.hint);
  if (format === 'screenplay') {
    lines.push(tt('ui.aiAssistant.formatResultScreenplayHead'));
  }
  if (language && language !== 'th') lines.push(tt('ui.aiAssistant.replyLang') + language);

  // บริบทจากโปรเจกต์ (RAG / วิกิ / ฉากข้างเคียง)
  const ctx = contextBlock(context);
  if (ctx) lines.push('', ctx);

  if (text) lines.push('', tt('ui.aiAssistant.textSource'), text);
  const prompt = lines.join('\n');
  return { system: SYSTEM_TH, prompt, tokens: estimateTokens(prompt) };
}

/** Turn a context object into a prompt block (pure). */
export function contextBlock(context) {
  if (!context) return '';
  if (typeof context === 'string') return context.trim() ? tt('ui.aiAssistant.context') + context.trim() : '';
  const parts = [];
  if (context.project) parts.push(tt('ui.aiAssistant.story') + context.project);
  if (context.scene) {
    const s = context.scene;
    parts.push(tt('ui.common.scene3') + [s.title, s.pov && (tt('ui.aiAssistant.view') + s.pov), s.status].filter(Boolean).join(' · '));
    if (s.synopsis) parts.push(tt('ui.aiAssistant.synopsisScene') + s.synopsis);
  }
  if (context.entities && context.entities.length) {
    parts.push(tt('ui.aiAssistant.characterThingItem'));
    for (const e of context.entities.slice(0, 12)) {
      parts.push('- ' + (e.name || e.id) + (e.summary ? ': ' + e.summary : ''));
    }
  }
  const head = parts.length ? tt('ui.aiAssistant.contextProject') + parts.join('\n') : '';
  const retrieved = context.retrieved && context.retrieved.length
    ? buildContext(context.retrieved, { maxTokens: context.maxContextTokens || 1200 }).text : '';
  return [head, retrieved].filter(Boolean).join('\n\n');
}

// ───────── API หลัก ─────────
/**
 * Main entry point required by the spec.
 * @param {string} prompt   what the writer wants (or the source text for a preset task)
 * @param {object} context  { text, scene, entities, retrieved, project }
 * @param {object} options  { task, tone, length, language, format, model, temperature, maxTokens,
 *                            stream, onChunk, client, rag, feature }
 * @returns {Promise<{ok:boolean, text:string, usage:object, cost:object, prompt:string, error?:string}>}
 */
export async function aiAssistant(prompt, context = null, options = {}) {
  const client = options.client;
  if (!client) return { ok: false, text: '', error: tt('ui.aiAssistant.cantSettingsAIClient'), code: 'no-client', prompt: '' };
  const task = options.task || 'custom';
  const source = options.text != null ? options.text : (context && context.text) || '';

  // RAG: ถ้าส่ง pipeline มา ให้ดึงบริบทที่เกี่ยวข้องก่อนสร้าง prompt
  // ดูจากความสามารถ ไม่ใช่ instanceof — bundle คนละก้อนทำให้คลาสไม่ใช่ตัวเดียวกัน
  // และเปิดทางให้ส่ง retriever ของตัวเองเข้ามาได้ด้วย
  let ctx = context;
  if (options.rag && typeof options.rag.retrieve === 'function') {
    const hits = await options.rag.retrieve(prompt || source, options.k || 5);
    ctx = { ...(context || {}), retrieved: hits };
  }

  const built = buildPrompt(task, {
    text: source,
    instruction: task === 'custom' ? prompt : (options.instruction || (task === 'rewrite' ? prompt : '')),
    tone: options.tone, length: options.length, language: options.language,
    format: options.format, context: ctx,
  });

  const req = {
    prompt: built.prompt, system: options.system || built.system,
    model: options.model, temperature: options.temperature, maxTokens: options.maxTokens,
    feature: options.feature || ('assistant:' + task),
  };
  const res = options.stream && typeof options.onChunk === 'function'
    ? await client.stream(req, options.onChunk)
    : await client.complete(req);
  return { ...res, prompt: built.prompt, task, sources: (ctx && ctx.retrieved) ? ctx.retrieved.map((h) => h.id) : [] };
}

// ───────── ทางลัดตามข้อกำหนด ─────────
/** Expand a passage with more detail (same meaning, same voice). */
export function expand(text, options = {}) {
  return aiAssistant('', { text }, { ...options, task: 'expand', text });
}
/** Summarize a passage. options.length = 'short'|'medium'|'long' */
export function summarize(text, options = {}) {
  return aiAssistant('', { text }, { ...options, task: 'summarize', text });
}
/** Rewrite a passage. options.instruction (or the 2nd arg) says what to change. */
export function rewrite(text, options = {}) {
  return aiAssistant(options.instruction || '', { text }, { ...options, task: 'rewrite', text });
}
/** Change the tone of a passage. tone = key of TONES */
export function changeTone(text, tone, options = {}) {
  return aiAssistant('', { text }, { ...options, task: 'changeTone', tone, text });
}
// [alpha.126] `continueText()` ถูกถอด — ไม่มีใครเรียกเลย
// (ปุ่ม "เขียนต่อ" ในแผงผู้ช่วยเรียก `aiAssistant()` พร้อม task:'continue' ตรง ๆ)
