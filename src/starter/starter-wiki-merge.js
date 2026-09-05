// starter-wiki-merge.js — จับคู่ตัวละครของ starter กับ Wiki (โมดูลบริสุทธิ์)
//
// ปัญหาที่ไฟล์นี้แก้ — เกิดจากการที่สเปกสองข้อขัดกันโดยธรรมชาติ:
//   ข้อ 6  ตัวละครที่สร้างใน starter ต้องถูกเก็บลง Wiki
//   ข้อ 9  starter ต้องเป็นโฟลเดอร์แยกที่ **ย้ายข้ามโปรเจกต์ได้**
// พอย้ายไปโปรเจกต์ใหม่ `wikiPath` ที่ติดมากับตัวละครจะชี้ไปที่ไม่มีจริง
//
// ทางออกที่ตกลงกัน: starter พกสำเนาเต็มไปด้วยเสมอ ส่วน Wiki เป็น "ตัวจริงของโปรเจกต์นี้"
// ไฟล์นี้คือคนตัดสินว่าตัวละครแต่ละตัวควร **ผูกกับของเดิม** หรือ **สร้างใหม่** ในโปรเจกต์ปลายทาง
//
// ไม่แตะ DOM/fs → รับ entity เป็นข้อมูลดิบ `[{file,id,name,aliases}]` แล้วคืนแผน
// (คนอ่านไฟล์จริงคือ starter-wiki.js)

import { t } from '../i18n.js';
import { normalizePrompts } from '../entity-mention.js';

/**
 * หัวข้อในหน้า Wiki ที่ starter เป็นเจ้าของ
 * เก็บเป็น **section** ไม่ใช่ field ลับ ๆ เพราะผู้ใช้ต้องเห็นและแก้ได้จากหน้า Wiki ตรง ๆ
 * (ถ้าซ่อนไว้ ผู้ใช้จะเจอ "ของที่แก้ในหน้านี้ไม่ตรงกับที่ AI เห็น" ซึ่งดีบั๊กไม่ออก)
 */
export const SEC_DESC = () => t('ui.common.desc');
export const SEC_DIALOGUE = () => t('ui.starter.fDialogue');

/** ชื่อสำหรับเทียบ — ไทยไม่มีช่องว่างระหว่างคำ จึงตัดช่องว่างทิ้งทั้งหมด ไม่ใช่แค่ trim */
export function normName(s) {
  return String(s || '')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')  // zero-width ที่ติดมากับการก๊อป
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** ชื่อทั้งหมดที่ entity ตอบสนอง (ชื่อจริง + ชื่อรอง) */
export function entityNames(e) {
  return [e && e.name, ...(((e && e.aliases) || []))]
    .map(normName).filter(Boolean);
}

export const MATCH_EXACT = 'exact';       // ชื่อตรงกัน
export const MATCH_ALIAS = 'alias';       // ตรงกับชื่อรอง
export const MATCH_AMBIGUOUS = 'many';    // ชนกันหลายตัว — ต้องให้คนตัดสิน
export const MATCH_NONE = 'none';         // ไม่มีในโปรเจกต์นี้

export const ACT_LINK = 'link';           // ผูกกับ entity เดิม
export const ACT_CREATE = 'create';       // สร้างใหม่ใน Wiki
export const ACT_SKIP = 'skip';           // ไม่ยุ่ง (เก็บไว้ใน starter อย่างเดียว)

export function matchLabel(m) {
  return { exact: t('ui.starter.mgExact'), alias: t('ui.starter.mgAlias'),
           many: t('ui.starter.mgMany'), none: t('ui.starter.mgNone') }[m] || m;
}

/**
 * หา entity ที่น่าจะเป็นตัวเดียวกัน
 * @param {object} ch        ตัวละครใน starter
 * @param {Array} entities   [{file,id,name,aliases}]
 */
export function matchChar(ch, entities = []) {
  const want = normName(ch && ch.name);
  if (!want) return { status: MATCH_NONE, hit: null, candidates: [] };

  // 1) ชี้ตรงด้วย path เดิม และ path นั้นยังมีอยู่จริง = ตัวเดียวกันแน่นอน
  if (ch.wikiPath) {
    const byPath = entities.find((e) => e.file === ch.wikiPath);
    if (byPath) return { status: MATCH_EXACT, hit: byPath, candidates: [byPath] };
  }

  const exact = entities.filter((e) => normName(e.name) === want);
  if (exact.length === 1) return { status: MATCH_EXACT, hit: exact[0], candidates: exact };
  if (exact.length > 1) return { status: MATCH_AMBIGUOUS, hit: null, candidates: exact };

  const alias = entities.filter((e) => entityNames(e).includes(want));
  if (alias.length === 1) return { status: MATCH_ALIAS, hit: alias[0], candidates: alias };
  if (alias.length > 1) return { status: MATCH_AMBIGUOUS, hit: null, candidates: alias };

  return { status: MATCH_NONE, hit: null, candidates: [] };
}

/** การกระทำที่ควรตั้งไว้ให้เป็นค่าเริ่มต้นตามผลจับคู่ */
export function defaultAction(status) {
  if (status === MATCH_EXACT || status === MATCH_ALIAS) return ACT_LINK;
  if (status === MATCH_NONE) return ACT_CREATE;
  return ACT_SKIP;                       // ชนกันหลายตัว = อย่าเดา ให้คนเลือกเอง
}

/**
 * แผนทั้งชุด — หนึ่งแถวต่อหนึ่งตัวละคร
 * @returns {Array<{char, status, hit, candidates, action, needsUser}>}
 */
export function planMerge(cast = [], entities = []) {
  return (cast || []).filter((c) => c && String(c.name || '').trim()).map((c) => {
    const m = matchChar(c, entities);
    return {
      char: c,
      status: m.status,
      hit: m.hit,
      candidates: m.candidates,
      action: defaultAction(m.status),
      // จริงเฉพาะตอนที่ระบบเดาแทนไม่ได้ — UI ไฮไลต์เฉพาะแถวพวกนี้
      needsUser: m.status === MATCH_AMBIGUOUS,
    };
  });
}

export function mergeSummary(rows = []) {
  const c = { link: 0, create: 0, skip: 0, ask: 0 };
  for (const r of rows) {
    if (r.needsUser) c.ask++;
    c[r.action] = (c[r.action] || 0) + 1;
  }
  return c;
}

/** มีอะไรให้คนตัดสินไหม — ถ้าไม่มี UI จะข้ามกล่องยืนยันไปเลย */
export function needsAttention(rows = []) { return rows.some((r) => r.needsUser); }

// ───────────────────────── แปลงร่างระหว่าง starter ↔ Wiki ─────────────────────────

/**
 * รวมเนื้อหาทุกส่วนของ entity เป็น **ช่องเดียว** ตามสเปกข้อ 6
 * ("Detailed Description จะเรียงเป็น field เดียว")
 */
export function flattenEntityText(e) {
  const out = [];
  const fields = (e && e.fields) || {};
  const props = (e && e.customProperties) || {};
  for (const [k, v] of [...Object.entries(fields), ...Object.entries(props)]) {
    const val = String(v == null ? '' : v).trim();
    if (val) out.push(k + ': ' + val);
  }
  const skip = normName(SEC_DIALOGUE());
  const own = normName(SEC_DESC());
  for (const sec of ((e && e.sections) || [])) {
    const body = String((sec && sec.content) || '').trim();
    if (!body) continue;
    const title = String((sec && sec.title) || '').trim();
    // ตัวอย่างคำพูดมีช่องของตัวเองแล้ว — ยัดซ้ำลงคำบรรยายด้วยคือของซ้ำสองที่
    if (normName(title) === skip) continue;
    // [alpha.122] หัวข้อ "คำอธิบาย" คือช่องคำบรรยายเอง — ใส่ชื่อหัวข้อนำหน้าด้วยไม่ได้
    // ไม่งั้นเขียนกลับ→ดึงเข้า→เขียนกลับ จะได้ "คำอธิบาย\nคำอธิบาย\n…" งอกทุกรอบ
    out.push(title && normName(title) !== own ? title + '\n' + body : body);
  }
  return out.join('\n\n').trim();
}

/** เนื้อของ section ที่ชื่อตรงกับที่ระบุ ('' = ไม่มี) */
export function sectionText(e, title) {
  const want = normName(title);
  const hit = ((e && e.sections) || [])
    .find((x) => normName((x && x.title) || '') === want);
  return String((hit && hit.content) || '').trim();
}

/** entity ใน Wiki → ตัวละครของ starter (ยังไม่ผ่าน newChar — คนเรียกเป็นคนห่อ) */
export function charPatchFromEntity(e, file = '') {
  return {
    name: (e && e.name) || '',
    aliases: [...(((e && e.aliases) || []))],
    persona: flattenEntityText(e),
    wikiPath: file || '',
    cat: (e && e.entityTypeKey) || 'characters',
    fromWiki: true,
    // [alpha.122] ช่องขั้นสูงเดินทางสองทางเต็มรูปแบบ — ดึงเข้ามาแล้วเขียนกลับได้ไม่ตกหล่น
    shortcode: (e && e.shortcode) || '',
    tags: Array.isArray(e && e.tags) ? [...e.tags] : [],
    prompts: normalizePrompts(e && e.prompts),
    dialogue: sectionText(e, SEC_DIALOGUE()),
  };
}

/**
 * ตัวละครของ starter → entity ของ Wiki
 *
 * จงใจใส่คำบรรยายเป็น **ส่วนเดียว** ไม่กระจายลง fields/customProperties เพราะ
 *   · สเปกกำหนดว่าเป็นช่องเดียว
 *   · คีย์ของ customProperties จะถูกเขียนลงไฟล์ ถ้าใช้คำแปลจะได้คีย์คนละตัวเมื่อสลับภาษา
 *
 * @param {object} ch
 * @param {object} opts  id (จาก guid()) · cat · images (แปลง path แล้วโดยคนเรียก)
 */
export function entityFromChar(ch, { id = '', cat = 'characters', images = [] } = {}) {
  const secs = [{ title: SEC_DESC(), content: (ch && ch.persona) || '' }];
  if (String((ch && ch.dialogue) || '').trim()) {
    secs.push({ title: SEC_DIALOGUE(), content: ch.dialogue });
  }
  return {
    id,
    entityTypeKey: cat,
    name: (ch && ch.name) || '',
    aliases: [...(((ch && ch.aliases) || []))],
    // [alpha.122] ช่องใหม่ของ entity — ทุกหมวดมีเหมือนกัน ไม่ใช่เฉพาะตัวละคร
    shortcode: (ch && ch.shortcode) || '',
    tags: [...(((ch && ch.tags) || []))],
    prompts: normalizePrompts(ch && ch.prompts),
    fields: {},
    customProperties: {},
    images: [...images],
    sections: secs,
    relationships: [],
    chapterOverrides: [],
    templateId: '',
    created: new Date().toISOString(),
  };
}

/** เขียนทับ section ชื่อหนึ่งโดยไม่แตะหัวข้ออื่น (เนื้อว่าง = ไม่ทำอะไร ไม่ลบของเดิม) */
function putSection(secs, title, body, { first = false } = {}) {
  const rows = [...(secs || [])];
  if (!String(body || '').trim()) return rows;
  const i = rows.findIndex((x) => normName((x && x.title) || '') === normName(title));
  if (i < 0) { if (first) rows.unshift({ title, content: body }); else rows.push({ title, content: body }); }
  else rows[i] = { ...rows[i], content: body };
  return rows;
}

/**
 * อัปเดต entity เดิมด้วยข้อมูลจาก starter — **ไม่ทับของที่ผู้ใช้เขียนเพิ่มใน Wiki**
 * เขียนทับเฉพาะส่วนที่ starter เป็นเจ้าของ และเติมของที่ยังไม่มี
 */
export function applyCharToEntity(e, ch) {
  const out = { ...e };
  let secs = [...((e && e.sections) || [])];
  secs = putSection(secs, SEC_DESC(), (ch && ch.persona) || '', { first: true });
  secs = putSection(secs, SEC_DIALOGUE(), (ch && ch.dialogue) || '');
  out.sections = secs;

  const have = new Set(((e && e.aliases) || []).map(normName));
  const add = (((ch && ch.aliases) || [])).filter((a) => a && !have.has(normName(a)));
  out.aliases = [...(((e && e.aliases) || [])), ...add];

  // โค้ดสั้น: ฝั่ง Wiki เป็นเจ้าของถ้าตั้งไว้แล้ว — starter เติมได้เฉพาะตอนที่ยังว่าง
  if (!String(out.shortcode || '').trim() && String((ch && ch.shortcode) || '').trim()) {
    out.shortcode = ch.shortcode;
  }
  // แท็ก: รวมกัน ไม่ทับ (คนละที่อาจติดแท็กคนละมุมของตัวละครเดียวกัน)
  const tagHave = new Set(((e && e.tags) || []).map(normName));
  out.tags = [...(((e && e.tags) || [])),
              ...(((ch && ch.tags) || [])).filter((x) => x && !tagHave.has(normName(x)))];
  // Prompt: หัวข้อชื่อเดียวกันถือเป็นอันเดียวกัน — ของ starter ทับ ที่เหลือคงไว้
  const mine = normalizePrompts(ch && ch.prompts);
  const merged = normalizePrompts(e && e.prompts);
  for (const p of mine) {
    const i = merged.findIndex((x) => normName(x.k) === normName(p.k));
    if (i < 0) merged.push(p); else merged[i] = p;
  }
  out.prompts = merged;
  return out;
}
