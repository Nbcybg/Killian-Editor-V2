// ai-world.js — สร้างเนื้อหาโลก (worldbuilding) ตามเทมเพลต + schema (ข้อ 76)
// spec: docs/76-ai-world.md · ผลลัพธ์เป็นข้อมูลมีโครงสร้าง → เขียนเข้า Wiki ได้ตรง ๆ
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { extractJson, validate, estimateTokens } from './ai-core.js';

const SYSTEM = tt('ui.aiWorld.youNewWorldWorldbuilder')
  + tt('ui.aiWorld.newDetailWheelHas')
  + tt('ui.aiWorld.replyJSONOutlineDefine');

// ───────── เทมเพลตต่อประเภท ─────────
// fields = ค่าเดี่ยว (ลง Wiki เป็นฟิลด์) · sections = เนื้อหายาว (ลง Wiki เป็นหัวข้อ)
export const WORLD_TEMPLATES = {
  magic: {
    label: tt('ui.aiWorld.system'), category: 'lore', icon: '✨',
    fields: [
      { key: 'name', label: tt('ui.aiWorld.nameSystem') },
      { key: 'source', label: tt('ui.aiWorld.msg10') },
      { key: 'cost', label: tt('ui.aiWorld.must') },
      { key: 'limits', label: tt('ui.aiWorld.itemRemember') },
      { key: 'whoCanUse', label: tt('ui.aiWorld.use') },
      { key: 'rarity', label: tt('ui.aiWorld.spread') },
    ],
    sections: [tt('ui.aiWorld.ruleSystem'), tt('ui.aiWorld.howto'), tt('ui.aiWorld.sideEffect'), tt('ui.aiWorld.resultNext'), tt('ui.aiWorld.knotWriteNext')],
  },
  city: {
    label: tt('ui.aiWorld.msg8'), category: 'locations', icon: '🏙',
    fields: [
      { key: 'name', label: tt('ui.aiWorld.name3') },
      { key: 'population', label: tt('ui.aiWorld.msg2') },
      { key: 'geography', label: tt('ui.aiWorld.msg4') },
      { key: 'government', label: tt('ui.aiWorld.cover') },
      { key: 'economy', label: tt('ui.aiWorld.main2') },
      { key: 'landmark', label: tt('ui.aiWorld.placeImportant') },
    ],
    sections: [tt('ui.aiWorld.overviewAmbience'), tt('ui.aiWorld.districtImportant'), tt('ui.aiWorld.hasPowerGroup'), tt('ui.aiWorld.problem'), tt('ui.aiWorld.knotWriteNext')],
  },
  culture: {
    label: tt('ui.aiWorld.msg5'), category: 'lore', icon: '🎎',
    fields: [
      { key: 'name', label: tt('ui.aiWorld.nameGroup') },
      { key: 'values', label: tt('ui.aiWorld.valueMain') },
      { key: 'language', label: tt('ui.aiWorld.lang') },
      { key: 'taboo', label: tt('ui.aiWorld.itemForbid') },
      { key: 'ritual', label: tt('ui.aiWorld.ritualImportant') },
      { key: 'hierarchy', label: tt('ui.aiWorld.orderLayer') },
    ],
    sections: [tt('ui.aiWorld.dailyLife'), tt('ui.aiWorld.customFestival'), tt('ui.aiWorld.name'), tt('ui.aiWorld.relationGroupOther'), tt('ui.aiWorld.knotWriteNext')],
  },
  economy: {
    label: tt('ui.aiWorld.msg9'), category: 'lore', icon: '💰',
    fields: [
      { key: 'name', label: tt('ui.aiWorld.nameSystem2') },
      { key: 'currency', label: tt('ui.aiWorld.center') },
      { key: 'mainTrade', label: tt('ui.aiWorld.main') },
      { key: 'scarcity', label: tt('ui.aiWorld.scarce') },
      { key: 'powerHolders', label: tt('ui.aiWorld.msg11') },
      { key: 'blackMarket', label: tt('ui.aiWorld.dark') },
    ],
    sections: [tt('ui.aiWorld.structureTrade'), tt('ui.aiWorld.classIncome'), tt('ui.aiWorld.busyItem'), tt('ui.aiWorld.knotWriteNext')],
  },
  religion: {
    label: tt('ui.aiWorld.name4'), category: 'lore', icon: '⛩',
    fields: [
      { key: 'name', label: tt('ui.aiWorld.name2') },
      { key: 'deity', label: tt('ui.aiWorld.thing2') },
      { key: 'doctrine', label: tt('ui.aiWorld.mainWord') },
      { key: 'clergy', label: tt('ui.aiWorld.msg') },
      { key: 'symbol', label: tt('ui.aiWorld.msg7') },
      { key: 'heresy', label: tt('ui.aiWorld.thing') },
    ],
    sections: [tt('ui.aiWorld.originLegend'), tt('ui.aiWorld.ritual'), tt('ui.aiWorld.power'), tt('ui.aiWorld.see'), tt('ui.aiWorld.knotWriteNext')],
  },
  faction: {
    label: tt('ui.aiWorld.group'), category: 'lore', icon: '⚔',
    fields: [
      { key: 'name', label: tt('ui.common.nameGroup') },
      { key: 'goal', label: tt('ui.common.goal') },
      { key: 'leader', label: tt('ui.aiWorld.msg3') },
      { key: 'members', label: tt('ui.aiWorld.busy') },
      { key: 'methods', label: tt('ui.aiWorld.how') },
      { key: 'enemy', label: tt('ui.aiWorld.msg6') },
    ],
    sections: [tt('ui.aiWorld.origin'), tt('ui.aiWorld.structureInner'), tt('ui.aiWorld.resourceDot'), tt('ui.aiWorld.planCurrent'), tt('ui.aiWorld.knotWriteNext')],
  },
};
export const WORLD_TYPES = Object.keys(WORLD_TEMPLATES);
export function getTemplate(type) { return WORLD_TEMPLATES[type] || null; }

/**
 * Build the worldbuilding prompt from a template. Pure.
 * @param {string} type  key of WORLD_TEMPLATES
 * @param {string} prompt  what the author wants ("เมืองท่าเรือที่ปกครองโดยสมาคมพ่อค้า")
 * @param {object} opts  { context, tone, existing, language }
 */
export function buildWorldPrompt(type, prompt, opts = {}) {
  const tpl = getTemplate(type);
  if (!tpl) return null;
  const lines = [];
  lines.push(ttf('ui.aiWorld.newWorldStoryCmd', tpl.label, prompt || tt('ui.aiWorld.authorCantSpecifyThink')));
  lines.push('');
  lines.push(tt('ui.aiWorld.itemDefine'));
  lines.push(tt('ui.aiWorld.allMustWheelWheel'));
  lines.push(tt('ui.aiWorld.writeThaiConciseUse'));
  lines.push(tt('ui.aiWorld.allHeadingMustHas'));
  lines.push(tt('ui.aiWorld.closeKnotWriteScene'));
  if (opts.tone) lines.push(tt('ui.aiWorld.toneWorld') + opts.tone);
  if (opts.existing) {
    lines.push('', tt('ui.aiWorld.prevHasForbid'), String(opts.existing).slice(0, 2000));
  }
  if (opts.context) {
    lines.push('', tt('ui.aiWorld.contextStory'), typeof opts.context === 'string' ? opts.context : JSON.stringify(opts.context));
  }
  lines.push('', tt('ui.aiWorld.formatAnswerJSON'));
  lines.push(JSON.stringify({
    name: tt('ui.common.name'),
    fields: Object.fromEntries(tpl.fields.filter((f) => f.key !== 'name').map((f) => [f.key, f.label])),
    sections: tpl.sections.map((s) => ({ title: s, body: tt('ui.aiWorld.bodySentence') })),
    tags: [tt('ui.aiWorld.wordSearch'), tt('ui.aiWorld.wordSearch2')],
  }, null, 2));
  const built = lines.join('\n');
  return { system: SYSTEM, prompt: built, tokens: estimateTokens(built), type, template: tpl };
}

/**
 * Parse + validate a model reply against the template.
 * @returns {{type, name, fields:object, sections:Array<{title,body}>, tags:Array, missing:Array}}
 */
export function parseWorld(type, text) {
  const tpl = getTemplate(type);
  const data = extractJson(text) || {};
  const obj = Array.isArray(data) ? (data[0] || {}) : data;
  const fields = { ...(obj.fields || {}) };
  for (const [k, v] of Object.entries(obj)) {                 // โมเดลชอบวางฟิลด์ไว้ระดับบนสุด
    if (['fields', 'sections', 'tags', 'name'].includes(k)) continue;
    if (typeof v === 'string' && !(k in fields)) fields[k] = v;
  }
  const keys = tpl ? tpl.fields.map((f) => f.key).filter((k) => k !== 'name') : Object.keys(fields);
  const clean = {};
  for (const k of keys) clean[k] = str(fields[k]);
  const sections = validate(obj.sections, {
    title: { required: true, type: 'string' }, body: { required: true, type: 'string' },
  });
  const missing = [
    ...keys.filter((k) => !clean[k]),
    ...((tpl ? tpl.sections : []).filter((s) => !sections.some((x) => x.title.includes(s) || s.includes(x.title)))),
  ];
  return {
    type, template: tpl ? tpl.label : type,
    name: str(obj.name) || str(fields.name) || '',
    fields: clean,
    sections,
    tags: (Array.isArray(obj.tags) ? obj.tags : []).map(str).filter(Boolean),
    missing,
    ok: !!(str(obj.name) || sections.length),
  };
}
const str = (v) => (v == null ? '' : (typeof v === 'string' ? v.trim() : (typeof v === 'object' ? JSON.stringify(v) : String(v))));

/** Convert generated world data into a Wiki entity ready to be written as JSON. */
export function toWikiEntity(world, opts = {}) {
  const tpl = getTemplate(world.type);
  const cat = opts.category || (tpl && tpl.category) || 'lore';
  const notes = (world.sections || []).map((s) => `## ${s.title}\n${s.body}`).join('\n\n');
  return {
    name: world.name || opts.name || tt('ui.common.notNamed2'),
    entityTypeKey: cat,
    aliases: [],
    tags: world.tags || [],
    fields: { ...world.fields, worldType: world.type },
    notes,
    createdBy: 'ai-world',
  };
}
/** Markdown preview (for the dialog / for pasting into a scene). */
export function toMarkdown(world) {
  const tpl = getTemplate(world.type);
  const out = [`# ${world.name || tt('ui.common.notNamed')}`, ''];
  const labels = Object.fromEntries(((tpl && tpl.fields) || []).map((f) => [f.key, f.label]));
  for (const [k, v] of Object.entries(world.fields || {})) if (v) out.push(`- **${labels[k] || k}:** ${v}`);
  out.push('');
  for (const s of world.sections || []) out.push(`## ${s.title}`, s.body, '');
  if (world.tags && world.tags.length) out.push(tt('ui.common.tag3') + world.tags.map((t) => '#' + t).join(' '));
  return out.join('\n').trim();
}

/**
 * Generate structured world content.
 * @param {string} type    'magic'|'city'|'culture'|'economy'|'religion'|'faction'
 * @param {string} prompt  free-form request from the author
 * @param {object} options { client, context, existing, tone, model, temperature, maxTokens, retryOnMissing }
 * @returns {Promise<{ok, world, prompt, usage, cost, error?}>}
 */
export async function generateWorld(type, prompt, options = {}) {
  const built = buildWorldPrompt(type, prompt, options);
  if (!built) return { ok: false, error: tt('ui.aiWorld.notKnownType') + type, code: 'bad-type', types: WORLD_TYPES };
  const client = options.client;
  if (!client) return { ok: false, prompt: built.prompt, error: tt('ui.common.cantSettingsAIClient'), code: 'no-client' };

  const call = () => client.complete({
    prompt: built.prompt, system: built.system, feature: 'worldbuilding:' + type,
    model: options.model, temperature: options.temperature ?? 0.9,   // สร้างโลก = ต้องการความหลากหลาย
    maxTokens: options.maxTokens || 1800,
  });
  let res = await call();
  if (!res.ok) return { ...res, prompt: built.prompt };
  let world = parseWorld(type, res.text);
  // ตอบไม่ครบโครง → ลองอีกรอบเดียว (โมเดลเล็กมักตกหัวข้อ)
  if (!world.ok && options.retryOnMissing !== false) {
    res = await call();
    if (res.ok) world = parseWorld(type, res.text);
  }
  if (!world.ok) return { ok: false, world, prompt: built.prompt, error: tt('ui.aiWorld.aIReplyNotAt'), code: 'bad-shape', usage: res.usage };
  return { ok: true, world, prompt: built.prompt, usage: res.usage, cost: res.cost, raw: res.text };
}
