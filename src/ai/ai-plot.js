// ai-plot.js — ตรวจหาช่องโหว่ของเนื้อเรื่อง (ข้อ 73)
// สร้าง prompt (pure) → เรียก AI → แปลงคำตอบเป็นโครงสร้าง (pure) + ตรวจแบบออฟไลน์ที่ทำได้เองก่อน
// spec: docs/73-ai-plot.md
import { T } from '../i18n.js';
import { extractJson, validate, estimateTokens, chunkText, SEVERITY, SEV_RANK } from './ai-core.js';

// ───────── ชนิดปัญหา + ระดับความรุนแรง ─────────
export const HOLE_TYPES = {
  'character-continuity': T`ความต่อเนื่องของตัวละคร`,
  'timeline-conflict':    T`เวลาขัดกัน`,
  'motivation-gap':       T`แรงจูงใจขาดหาย`,
  'world-rule':           T`กฎของโลกขัดกัน`,
  'plot-thread':          T`ปมที่ทิ้งค้าง`,
  'pacing':               T`จังหวะการเล่าเรื่อง`,
};
export { SEVERITY, SEV_RANK };            // ส่งต่อจาก ai-core.js (แหล่งเดียว)

const SYSTEM = T`คุณเป็นบรรณาธิการต้นฉบับ (story editor) มืออาชีพ อ่านนิยาย/บทภาพยนตร์ภาษาไทยแล้วชี้จุดที่ขัดกันเอง `
  + T`คุณเข้มงวดแต่ยุติธรรม: รายงานเฉพาะสิ่งที่ขัดกันจริงในเนื้อหาที่ได้รับ ห้ามเดาสิ่งที่ไม่ได้เขียนไว้ `
  + T`ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON`;

/**
 * Build the plot-hole prompt. Pure — no network.
 * @param {Array} scenes [{ id, title, chapterId, storyDate, pov, characters, text }]
 * @param {object} opts  { types, focus, language }
 */
export function buildPlotPrompt(scenes, opts = {}) {
  const types = (opts.types && opts.types.length ? opts.types : Object.keys(HOLE_TYPES));
  const lines = [];
  lines.push(T`อ่านฉากทั้งหมดต่อไปนี้ตามลำดับ แล้วหา "ช่องโหว่ของเนื้อเรื่อง" ที่เกิดจากเนื้อหาขัดกันเอง`);
  lines.push('');
  lines.push(T`ชนิดที่ต้องตรวจ:`);
  for (const t of types) lines.push(`- ${t} (${HOLE_TYPES[t] || t})`);
  lines.push('');
  lines.push(T`กติกาสำคัญ:`);
  lines.push(T`1. อ้างอิงเฉพาะข้อเท็จจริงที่ปรากฏในฉากที่ให้มา — ห้ามสมมติเหตุการณ์นอกเหนือจากนี้`);
  lines.push(T`2. ทุกข้อต้องระบุ sceneId ของฉากที่พบปัญหา และ (ถ้ามี) sceneId ของฉากที่ขัดกัน`);
  lines.push(T`3. อธิบายเป็นภาษาไทย สั้น ตรงประเด็น พร้อมยกข้อความสั้น ๆ ที่เป็นหลักฐาน`);
  lines.push(T`4. ถ้าไม่พบปัญหาจริง ให้ตอบ []  — ห้ามแต่งปัญหาขึ้นมาให้ครบจำนวน`);
  if (opts.focus) lines.push(T`5. ให้ความสำคัญเป็นพิเศษกับ: ` + opts.focus);
  lines.push('');
  lines.push(T`รูปแบบคำตอบ (JSON array เท่านั้น):`);
  lines.push(T`[{"type":"<ชนิดจากรายการข้างบน>","severity":"critical|major|minor",`
    + T`"description":"อธิบายปัญหาเป็นภาษาไทย","sceneId":"<id ของฉาก>","relatedSceneId":"<id ฉากที่ขัดกัน หรือ \\"\\">",`
    + T`"evidence":"ข้อความสั้น ๆ ที่เป็นหลักฐาน","suggestion":"ข้อเสนอวิธีแก้"}]`);
  lines.push('');
  lines.push(T`### ฉากทั้งหมด`);
  for (const s of scenes) lines.push(sceneBlock(s));
  const prompt = lines.join('\n');
  return { system: SYSTEM, prompt, tokens: estimateTokens(prompt), sceneIds: scenes.map((s) => s.id) };
}
function sceneBlock(s) {
  const head = [`[sceneId: ${s.id}]`, s.title || T`(ไม่มีชื่อ)`];
  if (s.chapterTitle) head.push(T`บท: ` + s.chapterTitle);
  if (s.storyDate) head.push(T`เวลาในเรื่อง: ` + s.storyDate);
  if (s.pov) head.push(T`มุมมอง: ` + s.pov);
  if (s.characters && s.characters.length) head.push(T`ตัวละคร: ` + s.characters.join(', '));
  return head.join(' · ') + '\n' + String(s.text || '').trim() + '\n';
}

const SCHEMA = {
  type: { required: true, type: 'string', enum: Object.keys(HOLE_TYPES), default: 'plot-thread' },
  severity: { required: true, type: 'string', enum: Object.keys(SEVERITY), default: 'minor' },
  description: { required: true, type: 'string' },
  sceneId: { type: 'string', default: '' },
  relatedSceneId: { type: 'string', default: '' },
  evidence: { type: 'string', default: '' },
  suggestion: { type: 'string', default: '' },
};

/**
 * Parse a model reply into plot holes.
 * @returns {Array<{type,severity,description,location,sceneId,...}>} sorted by severity
 */
export function parsePlotHoles(text, opts = {}) {
  const valid = opts.sceneIds ? new Set(opts.sceneIds) : null;
  const titles = opts.titles || {};
  const rows = validate(extractJson(text), SCHEMA)
    // ตัดข้อที่อ้าง sceneId ที่ไม่ได้ส่งไปให้ (โมเดลชอบแต่ง id เอง)
    .filter((r) => !valid || !r.sceneId || valid.has(r.sceneId))
    .map((r) => ({
      ...r,
      typeLabel: HOLE_TYPES[r.type] || r.type,
      severityLabel: SEVERITY[r.severity] || r.severity,
      location: r.sceneId ? { sceneId: r.sceneId, title: titles[r.sceneId] || '', relatedSceneId: r.relatedSceneId || '' } : null,
      source: 'ai',
    }));
  return sortHoles(dedupeHoles(rows));
}
export function sortHoles(rows) {
  return rows.slice().sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0)
    || String(a.sceneId).localeCompare(String(b.sceneId)));
}
// รวมข้อซ้ำ (ชนิด+ฉากเดียวกัน คำอธิบายขึ้นต้นเหมือนกัน) — เกิดบ่อยเวลาแบ่งเนื้อหาเป็นหลายรอบ
export function dedupeHoles(rows) {
  const seen = new Map();
  for (const r of rows) {
    const k = `${r.type}|${r.sceneId}|${String(r.description).slice(0, 40)}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

// ───────── ตรวจที่ทำได้เองโดยไม่ต้องใช้ AI (ฟรี + เร็ว + แม่นแน่นอน) ─────────
/**
 * Deterministic checks that need no model: story-date ordering and dangling POV/character data.
 * @returns {Array} same row shape as parsePlotHoles (source:'local')
 */
export function localChecks(scenes = []) {
  const out = [];
  const withDate = scenes.map((s, i) => ({ ...s, _i: i })).filter((s) => s.storyDate && numDate(s.storyDate) != null);
  for (let i = 1; i < withDate.length; i++) {
    const prev = withDate[i - 1], cur = withDate[i];
    if (numDate(cur.storyDate) < numDate(prev.storyDate)) {
      out.push({
        type: 'timeline-conflict', severity: 'major', source: 'local',
        typeLabel: HOLE_TYPES['timeline-conflict'], severityLabel: SEVERITY.major,
        description: T`ฉาก "${cur.title || cur.id}" มีเวลาในเรื่อง (${cur.storyDate}) ย้อนกลับไปก่อนฉากก่อนหน้า "${prev.title || prev.id}" (${prev.storyDate}) ทั้งที่วางไว้หลังกัน`,
        sceneId: cur.id, relatedSceneId: prev.id, evidence: `${prev.storyDate} → ${cur.storyDate}`,
        suggestion: T`ถ้าตั้งใจให้เป็นฉากย้อนอดีต ให้ระบุไว้ในเนื้อฉาก/เรื่องย่อ ไม่งั้นสลับลำดับฉากหรือแก้ค่าเวลาในเรื่อง`,
        location: { sceneId: cur.id, title: cur.title || '', relatedSceneId: prev.id },
      });
    }
  }
  for (const s of scenes) {
    if (s.pov && s.text && s.characters && s.characters.length && !s.characters.includes(s.pov)) {
      out.push({
        type: 'character-continuity', severity: 'minor', source: 'local',
        typeLabel: HOLE_TYPES['character-continuity'], severityLabel: SEVERITY.minor,
        description: T`ฉาก "${s.title || s.id}" ตั้งมุมมองเป็น "${s.pov}" แต่ไม่พบตัวละครนี้ในเนื้อฉาก`,
        sceneId: s.id, relatedSceneId: '', evidence: 'pov = ' + s.pov,
        suggestion: T`ตรวจว่าตั้งมุมมองถูกฉากหรือไม่ หรือเพิ่มการปรากฏตัวของตัวละครในฉาก`,
        location: { sceneId: s.id, title: s.title || '', relatedSceneId: '' },
      });
    }
  }
  return out;
}
// ถอดตัวเลขจากข้อความเวลาไทย ("ปีที่ 1,024" → 1024) — ตรรกะเดียวกับ timeline.js
function numDate(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// ───────── API หลัก ─────────
/**
 * Detect plot holes across scenes.
 * @param {Array<string>} sceneIds  ids to analyse (empty = every scene in `scenes`)
 * @param {object} options { client, scenes, types, focus, maxTokensPerBatch, includeLocal, model, temperature }
 * @returns {Promise<{ok, holes:Array, batches:number, usage, cost, error?}>}
 */
export async function detectPlotHoles(sceneIds = [], options = {}) {
  const all = options.scenes || [];
  const picked = sceneIds && sceneIds.length ? all.filter((s) => sceneIds.includes(s.id)) : all;
  if (!picked.length) return { ok: false, holes: [], error: T`ไม่พบฉากที่จะตรวจ`, code: 'no-scenes', batches: 0 };

  const local = options.includeLocal === false ? [] : localChecks(picked);
  const client = options.client;
  if (!client) return { ok: !!local.length, holes: sortHoles(local), batches: 0, error: client ? undefined : T`ไม่ได้ตั้งค่า AI client`, code: 'no-client' };

  const titles = Object.fromEntries(picked.map((s) => [s.id, s.title || '']));
  const batches = batchScenes(picked, options.maxTokensPerBatch || 6000);
  const holes = [...local];
  const usage = { input: 0, output: 0, total: 0 };
  let cost = 0, failed = 0, lastError = '';
  for (const group of batches) {
    const built = buildPlotPrompt(group, options);
    const res = await client.complete({
      prompt: built.prompt, system: built.system, feature: 'plot-holes',
      model: options.model, temperature: options.temperature ?? 0.2,   // งานตรวจสอบ → ความสร้างสรรค์ต่ำ
      maxTokens: options.maxTokens || 1500,
    });
    if (!res.ok) { failed++; lastError = res.error; continue; }        // batch เดียวพังต้องไม่ล้มทั้งชุด
    holes.push(...parsePlotHoles(res.text, { sceneIds: built.sceneIds, titles }));
    if (res.usage) { usage.input += res.usage.input || 0; usage.output += res.usage.output || 0; }
    cost += (res.cost && res.cost.usd) || 0;
  }
  usage.total = usage.input + usage.output;
  const ok = failed < batches.length || holes.length > 0;
  return {
    ok, holes: sortHoles(dedupeHoles(holes)), batches: batches.length, failedBatches: failed,
    usage, cost: { usd: +cost.toFixed(6) }, error: ok ? undefined : lastError,
  };
}

/** Split scenes into prompt-sized groups (a scene longer than the budget is truncated, never dropped). */
export function batchScenes(scenes, maxTokens = 6000) {
  const out = [];
  let cur = [], size = 0;
  for (const s of scenes) {
    let text = String(s.text || '');
    let cost = estimateTokens(text) + 60;
    if (cost > maxTokens) {                       // ฉากเดียวยาวเกินงบ → ตัดหัวเรื่องมาให้พอ (ยังคงมีฉากนี้ในผล)
      text = chunkText(text, { maxTokens: maxTokens - 100 })[0] || text.slice(0, maxTokens * 3);
      cost = estimateTokens(text) + 60;
    }
    if (size + cost > maxTokens && cur.length) { out.push(cur); cur = []; size = 0; }
    cur.push({ ...s, text });
    size += cost;
  }
  if (cur.length) out.push(cur);
  return out;
}
