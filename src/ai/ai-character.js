// ai-character.js — ตรวจความสม่ำเสมอของตัวละครข้ามฉาก (ข้อ 75)
// spec: docs/75-ai-character.md
// มี 2 ชั้น: (1) ตรวจออฟไลน์จากรูปแบบภาษา (ฟรี แม่นแน่นอน) (2) ส่งให้ AI ดูเรื่องนิสัย/การกระทำ
import { T } from '../i18n.js';
import { extractJson, validate, estimateTokens, SEVERITY, SEV_RANK } from './ai-core.js';
import { characterProfile, profileBlock } from './ai-dialogue.js';

export const ASPECTS = {
  speech:      T`วิธีพูด/สำนวน`,
  personality: T`นิสัยและปฏิกิริยา`,
  knowledge:   T`สิ่งที่ตัวละครควรรู้/ไม่ควรรู้`,
  ability:     T`ความสามารถ`,
  appearance:  T`รูปลักษณ์`,
  relationship:T`ความสัมพันธ์กับตัวละครอื่น`,
};
export { SEVERITY, SEV_RANK };            // ส่งต่อจาก ai-core.js (แหล่งเดียว)

const SYSTEM = T`คุณเป็นบรรณาธิการต้นฉบับที่เชี่ยวชาญเรื่องความสม่ำเสมอของตัวละคร `
  + T`อ่านโปรไฟล์ตัวละครกับฉากที่ตัวละครนั้นปรากฏ แล้วชี้จุดที่ตัวละครทำ/พูดไม่ตรงกับตัวเองในฉากอื่นหรือไม่ตรงกับโปรไฟล์ `
  + T`รายงานเฉพาะสิ่งที่ขัดกันจริงในข้อความที่ได้รับ ตอบเป็น JSON เท่านั้น`;

/**
 * Build the consistency prompt. Pure.
 * @param {object} profile      from characterProfile()
 * @param {Array} appearances   [{ sceneId, title, text, storyDate }]
 */
export function buildConsistencyPrompt(profile, appearances = [], opts = {}) {
  const aspects = (opts.aspects && opts.aspects.length ? opts.aspects : Object.keys(ASPECTS));
  const lines = [];
  lines.push(T`ตรวจความสม่ำเสมอของตัวละคร "${profile.name}" จากฉากทั้งหมดที่ตัวละครนี้ปรากฏ`);
  lines.push('');
  lines.push(T`ประเด็นที่ต้องดู:`);
  for (const a of aspects) lines.push(`- ${a} (${ASPECTS[a] || a})`);
  lines.push('');
  lines.push(T`กติกา:`);
  lines.push(T`1. เทียบฉากกับฉาก และเทียบกับโปรไฟล์ — ระบุ sceneId ของฉากที่มีปัญหาเสมอ`);
  lines.push(T`2. อ้างข้อความสั้น ๆ จากฉากเป็นหลักฐานทุกข้อ`);
  lines.push(T`3. ให้ข้อเสนอแก้ไขที่ลงมือทำได้จริง (แก้ประโยคไหน เป็นอะไร)`);
  lines.push(T`4. ถ้าตัวละครสม่ำเสมอดีอยู่แล้ว ให้ตอบ [] — ห้ามแต่งปัญหา`);
  lines.push('');
  lines.push(T`รูปแบบคำตอบ (JSON array เท่านั้น):`);
  lines.push(T`[{"sceneId":"<id ฉาก>","aspect":"<ประเด็นจากรายการข้างบน>","severity":"critical|major|minor",`
    + T`"issue":"ปัญหาที่พบ (ภาษาไทย)","evidence":"ข้อความจากฉาก","suggestion":"ข้อเสนอวิธีแก้"}]`);
  lines.push('');
  lines.push(T`### โปรไฟล์ตัวละคร`);
  lines.push(profileBlock(profile));
  lines.push('');
  lines.push(T`### ฉากที่ตัวละครนี้ปรากฏ`);
  for (const a of appearances) {
    lines.push(`[sceneId: ${a.sceneId}] ${a.title || ''}${a.storyDate ? T` · เวลาในเรื่อง: ` + a.storyDate : ''}`);
    lines.push(String(a.text || '').trim());
    lines.push('');
  }
  const prompt = lines.join('\n');
  return { system: SYSTEM, prompt, tokens: estimateTokens(prompt), sceneIds: appearances.map((a) => a.sceneId) };
}

const SCHEMA = {
  sceneId: { required: true, type: 'string' },
  aspect: { type: 'string', enum: Object.keys(ASPECTS), default: 'personality' },
  severity: { type: 'string', enum: Object.keys(SEVERITY), default: 'minor' },
  issue: { required: true, type: 'string' },
  evidence: { type: 'string', default: '' },
  suggestion: { type: 'string', default: '' },
};
/** Parse a model reply → [{ sceneId, issue, suggestion, … }] (the shape the spec requires). */
export function parseConsistency(text, opts = {}) {
  const valid = opts.sceneIds ? new Set(opts.sceneIds) : null;
  const titles = opts.titles || {};
  const rows = validate(extractJson(text), SCHEMA)
    .filter((r) => !valid || valid.has(r.sceneId))
    .map((r) => ({
      ...r, source: 'ai',
      aspectLabel: ASPECTS[r.aspect] || r.aspect,
      severityLabel: SEVERITY[r.severity] || r.severity,
      sceneTitle: titles[r.sceneId] || '',
    }));
  return sortIssues(dedupe(rows));
}
export function sortIssues(rows) {
  return rows.slice().sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0)
    || String(a.sceneId).localeCompare(String(b.sceneId)));
}
function dedupe(rows) {
  const seen = new Map();
  for (const r of rows) {
    const k = `${r.sceneId}|${r.aspect}|${String(r.issue).slice(0, 40)}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

// ───────── ตรวจออฟไลน์: รูปแบบการพูด (ไทยมีสัญญาณชัด — คำลงท้าย/สรรพนาม) ─────────
export const POLITE_PARTICLES = [T`ครับ`, T`ค่ะ`, T`คะ`, T`จ้ะ`, T`จ้า`, T`ฮะ`, T`ขอรับ`, T`เจ้าค่ะ`];
export const PRONOUNS = [T`ผม`, T`ฉัน`, T`ดิฉัน`, T`กระผม`, T`หนู`, T`ข้า`, T`กู`, T`เรา`, T`ข้าพเจ้า`, T`อั๊ว`];

/** Count speech markers per scene for one character (dialogue lines only). */
export function speechStats(appearances, characterName) {
  const out = [];
  for (const a of appearances || []) {
    const said = dialogueOf(a.text, characterName);
    const particles = {}, pronouns = {};
    for (const p of POLITE_PARTICLES) { const n = countOf(said, p); if (n) particles[p] = n; }
    for (const p of PRONOUNS) { const n = countWord(said, p); if (n) pronouns[p] = n; }
    out.push({ sceneId: a.sceneId, title: a.title || '', lines: said.length, particles, pronouns });
  }
  return out;
}
// ดึงเฉพาะบทพูดของตัวละครนี้: บรรทัดหลัง @ชื่อ (บทหนัง) + ข้อความในเครื่องหมายคำพูด (ร้อยแก้ว)
function dialogueOf(text, name) {
  const src = String(text || '');
  const out = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('@') && name && l.slice(1).trim().startsWith(name)) {
      for (let j = i + 1; j < lines.length; j++) {
        const d = lines[j].trim();
        if (!d || d.startsWith('@') || d.startsWith('.') || d.startsWith('!')) break;
        if (/^\(.*\)$/.test(d)) continue;
        out.push(d);
      }
    }
  }
  for (const m of src.matchAll(/[""“]([^""“”\n]{2,200})[""”]/g)) out.push(m[1]);
  return out;
}
const countOf = (lines, needle) => lines.reduce((n, l) => n + (l.split(needle).length - 1), 0);
const countWord = (lines, w) => lines.reduce((n, l) => n + (l.split(w).length - 1), 0);

/**
 * Offline checks: flags scenes where the character's politeness particle or pronoun
 * differs from what they use everywhere else. No model, no cost.
 */
export function localConsistency(appearances, characterName, opts = {}) {
  const stats = speechStats(appearances, characterName);
  const issues = [];
  const dominant = (key) => {
    const total = {};
    for (const s of stats) for (const [k, n] of Object.entries(s[key])) total[k] = (total[k] || 0) + n;
    const sorted = Object.entries(total).sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0][0] : null;
  };
  const minScenes = opts.minScenes || 2;
  if (stats.filter((s) => Object.keys(s.particles).length).length >= minScenes) {
    const main = dominant('particles');
    for (const s of stats) {
      const used = Object.keys(s.particles);
      if (main && used.length && !used.includes(main)) {
        issues.push(mkIssue(s, 'speech', 'minor',
          T`ฉากนี้ใช้คำลงท้าย "${used.join(', ')}" ขณะที่ฉากอื่นของ ${characterName} ใช้ "${main}" เป็นหลัก`,
          T`ตรวจว่าตั้งใจเปลี่ยนน้ำเสียงตามสถานการณ์หรือไม่ ถ้าไม่ ให้แก้เป็น "${main}"`));
      }
    }
  }
  if (stats.filter((s) => Object.keys(s.pronouns).length).length >= minScenes) {
    const main = dominant('pronouns');
    for (const s of stats) {
      const used = Object.keys(s.pronouns);
      if (main && used.length && !used.includes(main)) {
        issues.push(mkIssue(s, 'speech', 'minor',
          T`ฉากนี้ ${characterName} เรียกตัวเองว่า "${used.join(', ')}" ขณะที่ฉากอื่นใช้ "${main}"`,
          T`ถ้าไม่ได้ตั้งใจให้เปลี่ยนตามคู่สนทนา ให้แก้เป็น "${main}"`));
      }
    }
  }
  return sortIssues(issues);
}
function mkIssue(s, aspect, severity, issue, suggestion) {
  return {
    sceneId: s.sceneId, sceneTitle: s.title, aspect, severity, issue, suggestion, evidence: '',
    aspectLabel: ASPECTS[aspect], severityLabel: SEVERITY[severity], source: 'local',
  };
}

/**
 * Check a character's consistency across every scene they appear in.
 * @param {string} characterId
 * @param {object} options { client, entity, scenes, sceneIds, backlinks, aspects, includeLocal, model, … }
 *        scenes = [{ id, title, text, storyDate }] · sceneIds/backlinks = จำกัดเฉพาะฉากที่ตัวละครปรากฏ
 * @returns {Promise<{ok, issues:Array<{sceneId,issue,suggestion,…}>, usage, cost, error?}>}
 */
export async function checkConsistency(characterId, options = {}) {
  const entity = options.entity;
  if (!entity) return { ok: false, issues: [], error: T`ไม่พบข้อมูลตัวละครใน Wiki`, code: 'no-entity' };
  const profile = entity.personality !== undefined ? entity : characterProfile(entity);

  const ids = options.sceneIds || (options.backlinks && options.backlinks[characterId]) || null;
  const all = options.scenes || [];
  const names = [profile.name, ...(profile.aliases || [])].filter(Boolean);
  const appearances = (ids ? all.filter((s) => ids.includes(s.id))
    : all.filter((s) => names.some((n) => String(s.text || '').includes(n))))
    .map((s) => ({ sceneId: s.id, title: s.title || '', text: s.text || '', storyDate: s.storyDate || '' }));

  if (!appearances.length) return { ok: false, issues: [], error: T`ไม่พบฉากที่มี "${profile.name}" ปรากฏ`, code: 'no-scenes' };

  const local = options.includeLocal === false ? [] : localConsistency(appearances, profile.name, options);
  const client = options.client;
  if (!client) return { ok: !!local.length, issues: local, error: T`ไม่ได้ตั้งค่า AI client`, code: 'no-client', appearances: appearances.length };

  const built = buildConsistencyPrompt(profile, appearances, options);
  const res = await client.complete({
    prompt: built.prompt, system: built.system, feature: 'character-consistency',
    model: options.model, temperature: options.temperature ?? 0.2,
    maxTokens: options.maxTokens || 1500,
  });
  if (!res.ok) return { ok: !!local.length, issues: local, error: res.error, code: res.code, appearances: appearances.length };
  const titles = Object.fromEntries(appearances.map((a) => [a.sceneId, a.title]));
  const issues = sortIssues(dedupe([...local, ...parseConsistency(res.text, { sceneIds: built.sceneIds, titles })]));
  return { ok: true, issues, usage: res.usage, cost: res.cost, appearances: appearances.length, prompt: built.prompt };
}
