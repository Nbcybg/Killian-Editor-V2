// ai-dialogue.js — สร้างบทสนทนาจากบุคลิกตัวละครใน Wiki (ข้อ 74)
// spec: docs/74-ai-dialogue.md · รูปแบบผลลัพธ์ตรงกับ fountain ของ K2 (.หัวฉาก @ตัวละคร (วงเล็บ) บทพูด)
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { estimateTokens } from './ai-core.js';

const SYSTEM = tt('ui.aiDialogue.youWriterScreenplayThai')
  + tt('ui.aiDialogue.characterEachItemMust')
  + tt('ui.aiDialogue.sendOnlyDialogueForbid');

// ฟิลด์ใน Wiki ที่ใช้เป็นบุคลิก (ยอมรับได้ทั้งคีย์ไทยและอังกฤษ — โปรเจกต์เก่าตั้งชื่อฟิลด์เองได้)
const FIELD_ALIASES = {
  role: ['role', tt('ui.aiDialogue.chapter'), tt('ui.aiDialogue.pos')],
  age: ['age', tt('ui.aiDialogue.msg6')],
  personality: ['personality', tt('ui.aiDialogue.click'), tt('ui.aiDialogue.msg2'), 'traits'],
  speech: ['speech', 'speechStyle', tt('ui.aiDialogue.speak2'), tt('ui.aiDialogue.msg5'), tt('ui.aiDialogue.sound')],
  background: ['background', tt('ui.aiDialogue.msg3'), tt('ui.common.history'), 'bio'],
  goal: ['goal', tt('ui.common.goal'), 'motivation', tt('ui.aiDialogue.msg7')],
  fear: ['fear', tt('ui.aiDialogue.fear'), tt('ui.aiDialogue.dot'), 'weakness'],
  quirk: ['quirk', tt('ui.aiDialogue.only'), tt('ui.aiDialogue.msg')],
};

/**
 * Normalize a Wiki entity into a character profile the prompt can use.
 * @param {object} entity raw Wiki json (any field naming)
 */
export function characterProfile(entity) {
  if (!entity) return null;
  const src = { ...(entity.fields || {}), ...entity };
  const pick = (keys) => {
    for (const k of keys) {
      const v = src[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  const out = { id: entity.id || '', name: entity.name || entity.title || tt('ui.aiDialogue.notName'), aliases: entity.aliases || [] };
  for (const [key, keys] of Object.entries(FIELD_ALIASES)) out[key] = pick(keys);
  out.relationships = (entity.relationships || []).map((r) => ({
    target: r.targetName || r.target || '', role: r.role || '',
  })).filter((r) => r.target);
  out.notes = entity.notes || entity.summary || '';
  return out;
}
/** Render a profile as prompt text (pure). */
export function profileBlock(p) {
  if (!p) return '';
  const rows = [ttf('ui.aiDialogue.name2', p.name) + (p.aliases && p.aliases.length ? ttf('ui.aiDialogue.call', p.aliases.join(', ')) : '')];
  const add = (label, v) => { if (v) rows.push(`${label}: ${v}`); };
  add(tt('ui.aiDialogue.chapter'), p.role); add(tt('ui.aiDialogue.msg6'), p.age); add(tt('ui.aiDialogue.click'), p.personality);
  add(tt('ui.common.howSpeak'), p.speech); add(tt('ui.aiDialogue.msg3'), p.background);
  add(tt('ui.common.goal'), p.goal); add(tt('ui.aiDialogue.fearDot'), p.fear); add(tt('ui.aiDialogue.msg'), p.quirk);
  if (p.relationships && p.relationships.length) {
    rows.push(tt('ui.aiDialogue.relation') + p.relationships.map((r) => `${r.target}${r.role ? ' (' + r.role + ')' : ''}`).join(', '));
  }
  add(tt('ui.common.other'), p.notes);
  return rows.join('\n');
}

export const DIALOGUE_FORMATS = { screenplay: tt('ui.common.screenplay'), prose: tt('ui.aiDialogue.editHasAction') };

/**
 * Build the dialogue prompt. Pure.
 * @param {object} a,b   profiles (from characterProfile)
 * @param {object|string} context  { situation, place, time, goal, conflict, mood, before }
 * @param {object} opts  { format, lines, language, tone }
 */
export function buildDialoguePrompt(a, b, context = {}, opts = {}) {
  const format = opts.format === 'prose' ? 'prose' : 'screenplay';
  const lines = [];
  const exchanges = opts.lines || 8;
  lines.push(ttf('ui.aiDialogue.writeDialogueBetweenCharacter', exchanges));
  lines.push(tt('ui.aiDialogue.eachPersonSpeakClick'));
  if (opts.tone) lines.push(tt('ui.aiDialogue.toneMerge') + opts.tone);
  lines.push('');
  lines.push(tt('ui.aiDialogue.character'));
  lines.push(profileBlock(a));
  lines.push('');
  lines.push(tt('ui.aiDialogue.character2'));
  lines.push(profileBlock(b));

  const ctx = typeof context === 'string' ? { situation: context } : (context || {});
  const cRows = [];
  if (ctx.situation) cRows.push(tt('ui.aiDialogue.msg4') + ctx.situation);
  if (ctx.place) cRows.push(tt('ui.aiDialogue.place') + ctx.place);
  if (ctx.time) cRows.push(tt('ui.aiDialogue.time') + ctx.time);
  if (ctx.goal) cRows.push(tt('ui.aiDialogue.thingEachNeedDialogue') + ctx.goal);
  if (ctx.conflict) cRows.push(tt('ui.common.conflict2') + ctx.conflict);
  if (ctx.mood) cRows.push(tt('ui.aiDialogue.moodScene') + ctx.mood);
  if (cRows.length) { lines.push('', tt('ui.aiDialogue.contextScene'), ...cRows); }
  if (ctx.before) { lines.push('', tt('ui.aiDialogue.textBeforePageWrite'), String(ctx.before).slice(0, 1500)); }

  lines.push('', tt('ui.aiDialogue.formatResult'));
  if (format === 'screenplay') {
    lines.push(tt('ui.aiDialogue.useFormatScreenplayStyle'));
    lines.push(tt('ui.aiDialogue.name'));
    lines.push(tt('ui.aiDialogue.moodDoShortRemember'));
    lines.push(tt('ui.common.dialogue'));
    lines.push(tt('ui.aiDialogue.forbidPutHeadScene'));
  } else {
    lines.push(tt('ui.aiDialogue.writeEditDialogueWord'));
  }
  const prompt = lines.join('\n');
  return { system: SYSTEM, prompt, tokens: estimateTokens(prompt), format };
}

/**
 * Parse generated dialogue into structured lines.
 * @returns {{format, lines:Array<{speaker,paren,text}>, text:string}}
 */
export function parseDialogue(raw, opts = {}) {
  const format = opts.format === 'prose' ? 'prose' : 'screenplay';
  const text = String(raw || '').replace(/```[a-z]*\n?/gi, '').trim();
  const out = [];
  if (format === 'screenplay') {
    let cur = null;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('@')) {                                  // รูปแบบที่สั่งไป
        cur = { speaker: line.slice(1).trim(), paren: '', text: '' };
        out.push(cur);
        continue;
      }
      const colon = line.match(/^([^:：]{1,30})[:：]\s*(.+)$/);   // โมเดลชอบตอบ "ชื่อ: บทพูด"
      if (colon && !line.startsWith('(')) {
        cur = { speaker: colon[1].replace(/^@/, '').trim(), paren: '', text: colon[2].trim() };
        out.push(cur);
        continue;
      }
      if (/^\(.*\)$/.test(line)) { if (cur) cur.paren = line.slice(1, -1).trim(); continue; }
      if (cur) cur.text = cur.text ? cur.text + ' ' + line : line;
    }
  } else {
    for (const para of text.split(/\n{2,}/)) {
      const t = para.trim();
      if (!t) continue;
      const m = t.match(/^([^"“”]{0,40}?)\s*[""“](.+)[""”]/);
      out.push({ speaker: (m && m[1].trim()) || '', paren: '', text: t });
    }
  }
  return { format, lines: out.filter((l) => l.text || l.speaker), text: format === 'screenplay' ? toScreenplay(out) : text };
}

/** Render structured lines as K2 fountain (@character / (paren) / dialogue). */
export function toScreenplay(lines) {
  const out = [];
  for (const l of lines || []) {
    if (!l || (!l.speaker && !l.text)) continue;
    if (l.speaker) out.push('@' + l.speaker);
    if (l.paren) out.push('(' + l.paren + ')');
    if (l.text) out.push(l.text);
    out.push('');
  }
  return out.join('\n').trim();
}
/** Render structured lines as prose paragraphs. */
export function toProse(lines) {
  return (lines || []).filter((l) => l && l.text).map((l) => {
    if (!l.speaker) return l.text;
    const paren = l.paren ? `${l.paren} ` : '';
    return ttf('ui.aiDialogue.speak', l.speaker, paren ? ' ' + paren : '', l.text).replace(/\s+/g, ' ');
  }).join('\n\n');
}

/**
 * Generate dialogue between two characters.
 * @param {object} characterA raw Wiki entity or profile
 * @param {object} characterB raw Wiki entity or profile
 * @param {object} context    { situation, place, time, goal, conflict, mood, before }
 * @param {object} options    { client, format, lines, tone, model, temperature, maxTokens, stream, onChunk }
 * @returns {Promise<{ok, text, lines, format, prompt, usage, cost, error?}>}
 */
export async function generateDialogue(characterA, characterB, context = {}, options = {}) {
  const client = options.client;
  const a = characterA && characterA.personality !== undefined ? characterA : characterProfile(characterA);
  const b = characterB && characterB.personality !== undefined ? characterB : characterProfile(characterB);
  if (!a || !b) return { ok: false, text: '', lines: [], error: tt('ui.aiDialogue.mustHasCharacterItem'), code: 'no-characters' };
  const built = buildDialoguePrompt(a, b, context, options);
  if (!client) return { ok: false, text: '', lines: [], prompt: built.prompt, error: tt('ui.common.cantSettingsAIClient'), code: 'no-client' };

  const req = {
    prompt: built.prompt, system: built.system, feature: 'dialogue',
    model: options.model, temperature: options.temperature ?? 0.85,   // งานสร้างสรรค์ → สูงหน่อย
    maxTokens: options.maxTokens || 1200,
  };
  const res = options.stream && typeof options.onChunk === 'function'
    ? await client.stream(req, options.onChunk) : await client.complete(req);
  if (!res.ok) return { ...res, lines: [], prompt: built.prompt };
  const parsed = parseDialogue(res.text, { format: built.format });
  return { ...res, text: parsed.text, lines: parsed.lines, format: parsed.format, prompt: built.prompt,
           speakers: [...new Set(parsed.lines.map((l) => l.speaker).filter(Boolean))] };
}
