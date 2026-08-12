// ai-world.js — สร้างเนื้อหาโลก (worldbuilding) ตามเทมเพลต + schema (ข้อ 76)
// spec: docs/76-ai-world.md · ผลลัพธ์เป็นข้อมูลมีโครงสร้าง → เขียนเข้า Wiki ได้ตรง ๆ
import { T } from '../i18n.js';
import { extractJson, validate, estimateTokens } from './ai-core.js';

const SYSTEM = T`คุณเป็นนักสร้างโลก (worldbuilder) สำหรับนิยาย/บทภาพยนตร์ภาษาไทย `
  + T`สร้างรายละเอียดที่สอดคล้องกันเอง มีเหตุผลภายในโลก และใช้เขียนเรื่องต่อได้จริง `
  + T`ตอบเป็น JSON ตามโครงที่กำหนดเท่านั้น ห้ามมีข้อความอื่นนอก JSON`;

// ───────── เทมเพลตต่อประเภท ─────────
// fields = ค่าเดี่ยว (ลง Wiki เป็นฟิลด์) · sections = เนื้อหายาว (ลง Wiki เป็นหัวข้อ)
export const WORLD_TEMPLATES = {
  magic: {
    label: T`ระบบเวทมนตร์`, category: 'lore', icon: '✨',
    fields: [
      { key: 'name', label: T`ชื่อระบบ` },
      { key: 'source', label: T`แหล่งพลัง` },
      { key: 'cost', label: T`ราคาที่ต้องจ่าย` },
      { key: 'limits', label: T`ข้อจำกัด` },
      { key: 'whoCanUse', label: T`ใครใช้ได้` },
      { key: 'rarity', label: T`ความแพร่หลาย` },
    ],
    sections: [T`กฎของระบบ`, T`วิธีใช้งานจริง`, T`ผลข้างเคียงและอันตราย`, T`ผลกระทบต่อสังคม`, T`ปมที่เอาไปเขียนต่อได้`],
  },
  city: {
    label: T`เมือง`, category: 'locations', icon: '🏙',
    fields: [
      { key: 'name', label: T`ชื่อเมือง` },
      { key: 'population', label: T`ประชากร` },
      { key: 'geography', label: T`ภูมิประเทศ` },
      { key: 'government', label: T`การปกครอง` },
      { key: 'economy', label: T`เศรษฐกิจหลัก` },
      { key: 'landmark', label: T`สถานที่สำคัญ` },
    ],
    sections: [T`ภาพรวมและบรรยากาศ`, T`ย่านสำคัญ`, T`ผู้มีอำนาจและกลุ่มอิทธิพล`, T`ปัญหาที่เมืองนี้เผชิญ`, T`ปมที่เอาไปเขียนต่อได้`],
  },
  culture: {
    label: T`วัฒนธรรม`, category: 'lore', icon: '🎎',
    fields: [
      { key: 'name', label: T`ชื่อกลุ่ม/วัฒนธรรม` },
      { key: 'values', label: T`ค่านิยมหลัก` },
      { key: 'language', label: T`ภาษา/สำเนียง` },
      { key: 'taboo', label: T`ข้อห้าม` },
      { key: 'ritual', label: T`พิธีกรรมสำคัญ` },
      { key: 'hierarchy', label: T`ลำดับชั้นทางสังคม` },
    ],
    sections: [T`ชีวิตประจำวัน`, T`ประเพณีและเทศกาล`, T`ความเชื่อ`, T`ความสัมพันธ์กับกลุ่มอื่น`, T`ปมที่เอาไปเขียนต่อได้`],
  },
  economy: {
    label: T`เศรษฐกิจ`, category: 'lore', icon: '💰',
    fields: [
      { key: 'name', label: T`ชื่อระบบเศรษฐกิจ` },
      { key: 'currency', label: T`สกุลเงิน/สื่อกลาง` },
      { key: 'mainTrade', label: T`สินค้าหลัก` },
      { key: 'scarcity', label: T`ของที่ขาดแคลน` },
      { key: 'powerHolders', label: T`ใครคุมความมั่งคั่ง` },
      { key: 'blackMarket', label: T`ตลาดมืด` },
    ],
    sections: [T`โครงสร้างการค้า`, T`ชนชั้นและรายได้`, T`วิกฤตที่กำลังก่อตัว`, T`ปมที่เอาไปเขียนต่อได้`],
  },
  religion: {
    label: T`ศาสนา/ความเชื่อ`, category: 'lore', icon: '⛩',
    fields: [
      { key: 'name', label: T`ชื่อศาสนา/ลัทธิ` },
      { key: 'deity', label: T`สิ่งที่นับถือ` },
      { key: 'doctrine', label: T`หลักคำสอน` },
      { key: 'clergy', label: T`นักบวช/ผู้นำ` },
      { key: 'symbol', label: T`สัญลักษณ์` },
      { key: 'heresy', label: T`สิ่งที่ถือว่านอกรีต` },
    ],
    sections: [T`กำเนิดและตำนาน`, T`พิธีกรรม`, T`อำนาจทางการเมือง`, T`ผู้เห็นต่าง`, T`ปมที่เอาไปเขียนต่อได้`],
  },
  faction: {
    label: T`กลุ่ม/องค์กร`, category: 'lore', icon: '⚔',
    fields: [
      { key: 'name', label: T`ชื่อกลุ่ม` },
      { key: 'goal', label: T`เป้าหมาย` },
      { key: 'leader', label: T`ผู้นำ` },
      { key: 'members', label: T`สมาชิก/กำลังพล` },
      { key: 'methods', label: T`วิธีการ` },
      { key: 'enemy', label: T`ศัตรู` },
    ],
    sections: [T`ความเป็นมา`, T`โครงสร้างภายใน`, T`ทรัพยากรและจุดอ่อน`, T`แผนการปัจจุบัน`, T`ปมที่เอาไปเขียนต่อได้`],
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
  lines.push(T`สร้าง "${tpl.label}" สำหรับโลกของเรื่องนี้ ตามคำสั่งของผู้เขียน: ${prompt || T`(ผู้เขียนไม่ได้ระบุ — คิดให้เหมาะกับบริบท)`}`);
  lines.push('');
  lines.push(T`ข้อกำหนด:`);
  lines.push(T`1. ทุกอย่างต้องสอดคล้องกันเอง และสอดคล้องกับบริบทของเรื่องที่ให้มา (ถ้ามี)`);
  lines.push(T`2. เขียนเป็นภาษาไทย กระชับ ใช้ได้จริง ไม่ใช่คำสวยลอย ๆ`);
  lines.push(T`3. ทุกหัวข้อต้องมีเนื้อหาอย่างน้อย 2-4 ประโยค`);
  lines.push(T`4. ปิดท้ายด้วยปมที่เอาไปเขียนเป็นฉากต่อได้จริง`);
  if (opts.tone) lines.push(T`5. โทน/แนวของโลก: ` + opts.tone);
  if (opts.existing) {
    lines.push('', T`### ของเดิมที่มีอยู่แล้ว (ห้ามขัดกัน)`, String(opts.existing).slice(0, 2000));
  }
  if (opts.context) {
    lines.push('', T`### บริบทของเรื่อง`, typeof opts.context === 'string' ? opts.context : JSON.stringify(opts.context));
  }
  lines.push('', T`### รูปแบบคำตอบ (JSON เท่านั้น)`);
  lines.push(JSON.stringify({
    name: T`ชื่อ`,
    fields: Object.fromEntries(tpl.fields.filter((f) => f.key !== 'name').map((f) => [f.key, f.label])),
    sections: tpl.sections.map((s) => ({ title: s, body: T`เนื้อหา 2-4 ประโยค` })),
    tags: [T`คำค้น1`, T`คำค้น2`],
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
    name: world.name || opts.name || T`ไม่มีชื่อ`,
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
  const out = [`# ${world.name || T`(ไม่มีชื่อ)`}`, ''];
  const labels = Object.fromEntries(((tpl && tpl.fields) || []).map((f) => [f.key, f.label]));
  for (const [k, v] of Object.entries(world.fields || {})) if (v) out.push(`- **${labels[k] || k}:** ${v}`);
  out.push('');
  for (const s of world.sections || []) out.push(`## ${s.title}`, s.body, '');
  if (world.tags && world.tags.length) out.push(T`แท็ก: ` + world.tags.map((t) => '#' + t).join(' '));
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
  if (!built) return { ok: false, error: T`ไม่รู้จักประเภท: ` + type, code: 'bad-type', types: WORLD_TYPES };
  const client = options.client;
  if (!client) return { ok: false, prompt: built.prompt, error: T`ไม่ได้ตั้งค่า AI client`, code: 'no-client' };

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
  if (!world.ok) return { ok: false, world, prompt: built.prompt, error: T`AI ตอบไม่ตรงโครงที่กำหนด`, code: 'bad-shape', usage: res.usage };
  return { ok: true, world, prompt: built.prompt, usage: res.usage, cost: res.cost, raw: res.text };
}
