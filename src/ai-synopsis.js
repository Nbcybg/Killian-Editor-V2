// ai-synopsis.js — ปุ่ม ✨ กดครั้งเดียวให้ AI เติมช่องคุณสมบัติฉาก (alpha.60r3 ข้อ 2)
//
// สองชั้นแยกกันชัด ๆ เพื่อให้เทสได้โดยไม่ต้องยิง API จริง:
//   · `synopsisPrompt()` / `fieldPrompt()` = pure — สร้างคำสั่งอย่างเดียว
//   · `generateSceneSynopsis()` / `generateSceneField()` = ยิง `callAI()` แล้วเก็บกวาดผลลัพธ์
//
// prompt ต่อยอดจาก `buildPrompt('summarize')` ใน ai/ai-assistant.js (โทน/ความยาว/บริบทเดียวกับ
// AI ผู้ช่วยเขียน) แล้วเติมข้อกำหนดเฉพาะของช่องนั้นต่อท้าย — ไม่แตกสาย prompt เป็นคนละระบบ
import { t } from './i18n.js';
import { buildPrompt } from './ai/ai-assistant.js';
import { callAI } from './ai-settings.js';
import { el, setStatus, t as tr } from './core.js';

/** ช่องที่กดปุ่ม ✨ ได้ · label = ข้อความบนสถานะ · rule = ข้อกำหนดที่ต่อท้าย prompt */
export const AI_SCENE_FIELDS = {
  synopsis: {
    label: t('ui.common.synopsis'), length: 'short',
    rule: t('ui.aiSyn.writeSynopsisSceneSentence')
        + t('ui.aiSyn.sendBackOnlyItem'),
  },
  pov: {
    label: t('ui.common.viewPOV'), length: 'short',
    rule: t('ui.aiSyn.replyNameViewMain')
        + t('ui.aiSyn.viewStoryRoundReply'),
  },
  emotion: {
    label: t('ui.common.mood'), length: 'short',
    rule: t('ui.aiSyn.replyMoodMainScene'),
  },
  conflict: {
    label: t('ui.common.conflict'), length: 'short',
    rule: t('ui.aiSyn.replyConflictMainScene'),
  },
};

export const AI_SCENE_FIELD_KEYS = Object.keys(AI_SCENE_FIELDS);

/** ตัดเนื้อฉากให้พอสำหรับ prompt (โมเดลส่วนใหญ่ไม่ต้องอ่านทั้งฉากจึงสรุปได้) */
export function trimBody(body, max = 6000) {
  const s = String(body || '').trim();
  return s.length <= max ? s : s.slice(0, max) + t('ui.aiSyn.cutFile');
}

/**
 * สร้าง prompt ของช่องหนึ่ง (pure — ไม่ยิงเน็ต)
 * @returns {{system:string, prompt:string, tokens:number}|null} null = ไม่มีเนื้อหาให้สรุป
 */
export function fieldPrompt(field, body, title = '') {
  const def = AI_SCENE_FIELDS[field];
  const text = trimBody(body);
  if (!def || !text) return null;
  const built = buildPrompt('summarize', { text, length: def.length,
                                           context: title ? { scene: { title } } : null });
  return { ...built, prompt: def.rule + '\n\n' + built.prompt };
}

/** prompt ของช่อง "เรื่องย่อ" (ทางลัดที่สเปกเรียกชื่อไว้) */
export function synopsisPrompt(body, title = '') { return fieldPrompt('synopsis', body, title); }

/** เก็บกวาดคำตอบ: ตัดเครื่องหมายคำพูดครอบ / หัวข้อนำ / บรรทัดว่าง */
export function cleanResult(text, field = 'synopsis') {
  let s = String(text || '').trim();
  if (!s) return '';
  s = s.replace(/^```[\w]*\s*|\s*```$/g, '').trim();
  s = s.replace(/^(เรื่องย่อ|สรุป|มุมมอง|POV|อารมณ์|ความขัดแย้ง)\s*[:：-]\s*/i, '');
  s = s.replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  // ช่องสั้น ๆ เอาบรรทัดแรกพอ (โมเดลชอบแถมคำอธิบายต่อท้ายแม้สั่งห้ามแล้ว)
  if (field !== 'synopsis') s = s.split(/\r?\n/)[0].trim();
  return s;
}

/**
 * ยิง AI แล้วส่งผลลัพธ์กลับทาง callback (สเปกข้อ 2)
 * @param {string} body     เนื้อฉาก (markdown)
 * @param {string} title    ชื่อฉาก (บริบท)
 * @param {(text:string)=>void} onResult เรียกเมื่อได้ผลลัพธ์ที่ไม่ว่าง
 * @returns {Promise<string>} ข้อความที่ได้ (ว่าง = ล้มเหลว/ไม่มีเนื้อหา)
 */
export function generateSceneSynopsis(body, title, onResult) {
  return generateSceneField('synopsis', body, title, onResult);
}

/**
 * ปุ่ม ✨ ข้างช่องกรอก — ใช้ร่วมกันทั้ง **กล่อง** (scene-props.js) และ **แผง** (app.js)
 * (บทเรียน 50: คุณสมบัติฉากมีสองที่เสมอ — เขียนตัวช่วยไว้ที่เดียวจะได้ไม่หลุดที่ใดที่หนึ่ง)
 *
 * @param {HTMLElement} row   แถว `.wiki-row` ที่จะเอาปุ่มไปแปะ
 * @param {HTMLElement} input ช่องที่จะถูกเติมค่า
 * @param {string} field      คีย์ใน AI_SCENE_FIELDS
 * @param {() => Promise<{body:string,title:string}>} ctx  ผู้เรียกบอกว่าเนื้อฉากอยู่ไหน
 * @param {() => void} [onFilled] เรียกหลังเติมค่า (ให้แผงบันทึกอัตโนมัติได้)
 */
export function attachAiFieldButton(row, input, field, ctx, onFilled) {
  const def = AI_SCENE_FIELDS[field];
  if (!row || !input || !def) return null;
  const b = el('button', 'k-ai-fill', '✨');
  b.type = 'button';
  b.dataset.field = field;
  b.title = tr('ai.genSynopsis', 'ให้ AI เขียนให้') + ' — ' + def.label;
  b.onclick = async () => {
    if (b.disabled) return;
    b.disabled = true; b.classList.add('busy');
    const prev = b.textContent;
    b.textContent = '⏳';
    try {
      const c = (await ctx()) || {};
      await generateSceneField(field, c.body || '', c.title || '', (val) => {
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (onFilled) onFilled();
      });
    } catch (e) {
      setStatus(tr('ai.errorRetry', 'เกิดข้อผิดพลาด กรุณาลองใหม่'));
    } finally {
      b.disabled = false; b.classList.remove('busy'); b.textContent = prev;
    }
  };
  row.append(b);
  return b;
}

/** ตัวเดียวกันแต่เลือกช่องได้ (POV / อารมณ์ / ความขัดแย้ง) */
export async function generateSceneField(field, body, title, onResult) {
  const def = AI_SCENE_FIELDS[field];
  if (!def) return '';
  const p = fieldPrompt(field, body, title);
  if (!p) { setStatus(t('ui.aiSyn.sceneNotHasBody')); return ''; }
  setStatus(t('ui.aiSyn.busyAIWrite') + def.label + '…');
  const raw = await callAI(p.prompt, p.system);
  // [alpha.62 บั๊ก 5] `callAI` คืน null = ล้มเหลว และ **ตั้งข้อความบอกสาเหตุจริงไว้แล้ว**
  // (คีย์ผิด · ยังไม่เลือกโมเดล · โดเมนไม่อยู่ในรายการ) — เขียนทับด้วยข้อความรวม ๆ ไม่ได้
  // ไม่งั้นผู้ใช้เห็นแค่ "ไม่ขึ้นข้อความ" แล้วไม่รู้จะไปแก้ตรงไหน
  if (raw === null) return '';
  const out = cleanResult(raw, field);
  if (!out) { setStatus(t('ui.aiSyn.aICantSend') + def.label + t('ui.aiSyn.back')); return ''; }
  if (onResult) onResult(out);
  setStatus(t('ui.aiSyn.fill') + def.label + t('ui.aiSyn.aIDone'));
  return out;
}
