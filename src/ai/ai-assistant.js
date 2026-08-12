// ai-assistant.js — ผู้ช่วยเขียนด้วย AI (ข้อ 72 · ส่วน API ที่ UI เรียก)
// ตรรกะสร้าง prompt แยกเป็น pure function ทั้งหมด → เทสได้ว่าคำสั่งครบโดยไม่ต้องยิง API จริง
// spec: docs/72-ai-core.md
import { T } from '../i18n.js';
import { buildContext, estimateTokens } from './ai-core.js';

// ───────── โทนที่รองรับ (ข้อความไทยล้วน — UI เอาไปทำเมนูได้เลย) ─────────
export const TONES = {
  formal:    { label: T`ทางการ`,        hint: T`ใช้ภาษาสุภาพ เป็นทางการ หลีกเลี่ยงคำแสลง` },
  casual:    { label: T`กันเอง`,         hint: T`ใช้ภาษาพูดแบบเป็นกันเอง อ่านลื่น` },
  humorous:  { label: T`ตลก`,            hint: T`ใส่อารมณ์ขันเบา ๆ แต่ไม่ทำลายเนื้อเรื่อง` },
  dark:      { label: T`มืดหม่น`,        hint: T`บรรยากาศหม่น กดดัน ใช้ภาพพจน์หนักแน่น` },
  romantic:  { label: T`โรแมนติก`,       hint: T`อ่อนโยน เน้นความรู้สึกระหว่างตัวละคร` },
  tense:     { label: T`ระทึก`,          hint: T`ประโยคสั้น กระชับ เร่งจังหวะให้ตึงเครียด` },
  concise:   { label: T`กระชับ`,         hint: T`ตัดคำฟุ่มเฟือย เหลือเฉพาะใจความ` },
  lyrical:   { label: T`บรรยายละเอียด`,  hint: T`พรรณนาภาพและประสาทสัมผัสให้เห็นชัด` },
};
export const LENGTHS = { short: T`สั้นมาก (1-2 ประโยค)`, medium: T`ปานกลาง (1 ย่อหน้า)`, long: T`ยาว (3-5 ย่อหน้า)` };

const SYSTEM_TH = T`คุณเป็นบรรณาธิการและนักเขียนนิยาย/บทภาพยนตร์ภาษาไทยมืออาชีพ `
  + T`ตอบเป็นภาษาไทยเสมอ ส่งเฉพาะข้อความผลลัพธ์ ห้ามอธิบายสิ่งที่ทำ ห้ามใส่เครื่องหมายคำพูดครอบผลลัพธ์`;

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
      lines.push(T`ขยายความข้อความต่อไปนี้ให้ละเอียดขึ้น โดยคงใจความ มุมมอง และน้ำเสียงเดิมไว้`);
      lines.push(T`เพิ่มรายละเอียดของฉาก ประสาทสัมผัส และความรู้สึกตัวละคร ห้ามเพิ่มเหตุการณ์ใหม่ที่ขัดกับเนื้อเดิม`);
      lines.push(T`ความยาวเป้าหมาย: ` + (LENGTHS[length] || LENGTHS.medium));
      break;
    case 'summarize':
      lines.push(T`สรุปข้อความต่อไปนี้ให้เข้าใจง่าย คงเหตุการณ์สำคัญและชื่อตัวละครที่ปรากฏ`);
      lines.push(T`ความยาวเป้าหมาย: ` + (LENGTHS[length] || LENGTHS.medium));
      break;
    case 'rewrite':
      lines.push(T`เขียนข้อความต่อไปนี้ใหม่ให้อ่านลื่นและกระชับขึ้น โดยคงความหมายเดิมทุกประการ`);
      if (instruction) lines.push(T`ข้อกำหนดเพิ่มเติมจากผู้เขียน: ` + instruction);
      break;
    case 'changeTone':
      lines.push(T`เปลี่ยนโทนของข้อความต่อไปนี้ให้เป็นแบบ "` + (t ? t.label : tone) + T`" โดยคงเนื้อหาและลำดับเหตุการณ์เดิม`);
      break;
    case 'continue':
      lines.push(T`เขียนต่อจากข้อความต่อไปนี้ให้ต่อเนื่องเป็นธรรมชาติ คงสำนวนและมุมมองเดิม`);
      lines.push(T`ความยาวเป้าหมาย: ` + (LENGTHS[length] || LENGTHS.medium));
      break;
    default:
      lines.push(instruction || T`ช่วยปรับปรุงข้อความต่อไปนี้`);
  }
  if (t && task !== 'changeTone') lines.push(T`โทนที่ต้องการ: ` + t.label + ' — ' + t.hint);
  if (t && task === 'changeTone') lines.push(T`แนวทางโทน: ` + t.hint);
  if (format === 'screenplay') {
    lines.push(T`รูปแบบผลลัพธ์: บทภาพยนตร์ (หัวฉาก / ชื่อตัวละครขึ้นบรรทัดใหม่ / บทพูด) ไม่ต้องใส่คำอธิบายกำกับ`);
  }
  if (language && language !== 'th') lines.push(T`ตอบเป็นภาษา: ` + language);

  // บริบทจากโปรเจกต์ (RAG / วิกิ / ฉากข้างเคียง)
  const ctx = contextBlock(context);
  if (ctx) lines.push('', ctx);

  if (text) lines.push('', T`### ข้อความต้นฉบับ`, text);
  const prompt = lines.join('\n');
  return { system: SYSTEM_TH, prompt, tokens: estimateTokens(prompt) };
}

/** Turn a context object into a prompt block (pure). */
export function contextBlock(context) {
  if (!context) return '';
  if (typeof context === 'string') return context.trim() ? T`### บริบท\n` + context.trim() : '';
  const parts = [];
  if (context.project) parts.push(T`เรื่อง: ` + context.project);
  if (context.scene) {
    const s = context.scene;
    parts.push(T`ฉาก: ` + [s.title, s.pov && (T`มุมมอง ` + s.pov), s.status].filter(Boolean).join(' · '));
    if (s.synopsis) parts.push(T`เรื่องย่อฉาก: ` + s.synopsis);
  }
  if (context.entities && context.entities.length) {
    parts.push(T`ตัวละคร/สิ่งของที่เกี่ยวข้อง:`);
    for (const e of context.entities.slice(0, 12)) {
      parts.push('- ' + (e.name || e.id) + (e.summary ? ': ' + e.summary : ''));
    }
  }
  const head = parts.length ? T`### บริบทจากโปรเจกต์\n` + parts.join('\n') : '';
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
  if (!client) return { ok: false, text: '', error: T`ยังไม่ได้ตั้งค่า AI client`, code: 'no-client', prompt: '' };
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
/** Continue writing from where the author stopped. */
export function continueText(text, options = {}) {
  return aiAssistant('', { text }, { ...options, task: 'continue', text });
}
