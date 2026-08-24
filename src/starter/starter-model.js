// starter-model.js — โครงข้อมูลของ Story Starter (โมดูลบริสุทธิ์)
//
// หลักคิด 3 ข้อที่ตกลงกันตอนออกแบบ — **อย่ารื้อ** เพราะทั้งสามข้อมีไว้เพื่อ "ต่อยอดได้":
//   1. starter หนึ่งตัว = **โฟลเดอร์หนึ่งโฟลเดอร์** ที่พกพาข้ามโปรเจกต์ได้
//      → ทุกอย่างที่จำเป็นต้องอยู่ในนั้น รวมทั้งสำเนาตัวละครและรูป (Wiki เป็นของแถม ไม่ใช่ที่พึ่ง)
//   2. ช่องข้อมูลของ "4W" เป็น **map เปิด** (`w`) ไม่ใช่ property ตายตัว — 4W วันนี้ เป็น 6W พรุ่งนี้ได้
//      โดยไม่ต้องไล่แก้โค้ดทั้งระบบ (ทะเบียนช่องอยู่ที่ starter-steps-def.js ที่เดียว)
//   3. มี `v` + `migrateStarter()` ตั้งแต่รุ่นแรก — เพิ่ม field ทีหลังแล้วไฟล์เก่าต้องเปิดได้
//      (ทำตาม ai-session.js `SESSION_VERSION` และ branch-plans.js `BRANCH_PLAN_VERSION`)
//
// ตัวละครใน starter = **ส่วนขยายของ cast ในห้องซ้อมบท** (dialogue/builder-core.js)
// จงใจใช้โครงเดียวกันเพื่อให้ยกทั้งวงไปเข้าแชท Game Master ได้โดยไม่ต้องแปลงร่าง
//
// ไม่แตะ DOM/fs/network → unit test ได้ตรง ๆ (test/starter.test.cjs)

import { t } from '../i18n.js';
import { newCastMember } from '../dialogue/builder-core.js';

export const STARTER_VERSION = 1;
export const STARTER_DIR = 'Starters';        // <root>/Starters/<slug>/
export const SCENARIO_DIR = 'Scenarios';      // <root>/Starters/<slug>/Scenarios/*.json
export const STARTER_FILE = 'starter.json';
export const IMAGE_DIR = 'images';            // รูปของ starter อยู่ในตัวมันเอง = ย้ายแล้วไม่หาย

/**
 * เพศ — **เก็บเป็นคีย์ ไม่ใช่คำแปล**
 * ค่านี้ถูกเขียนลง starter.json แล้วอ่านกลับ ถ้าเก็บคำไทยไว้ พอสลับภาษาไฟล์เก่าจะอ่านไม่ออก
 */
export const GENDERS = [
  { id: 'female', label: t('ui.starter.genderFemale'), icon: '♀' },
  { id: 'male',   label: t('ui.starter.genderMale'),   icon: '♂' },
  { id: 'other',  label: t('ui.starter.genderOther'),  icon: '⚧' },
  { id: '',       label: t('ui.starter.genderUnset'),  icon: '–' },
];
export function genderDef(id) { return GENDERS.find((g) => g.id === id) || GENDERS[3]; }
export function genderLabel(id) { return genderDef(id).label; }

// ───────────────────────── ไอดี + ชื่อโฟลเดอร์ ─────────────────────────

let _seq = 0;
/** รีเซ็ตตัวนับ (เทสเท่านั้น) */
export function _resetIds() { _seq = 0; }
function nextId(prefix) {
  _seq += 1;
  return prefix + Date.now().toString(36) + _seq.toString(36);
}
export function newStarterId() { return nextId('st'); }
export function newCharId() { return nextId('ch'); }
export function newScenarioId() { return nextId('sc'); }

/**
 * ชื่อโฟลเดอร์จากชื่อเรื่อง — ภาษาไทยใช้เป็นชื่อโฟลเดอร์ได้ทั้ง mac และ win
 * จึงไม่ทับศัพท์ แค่ตัดอักขระต้องห้ามและช่องว่างซ้อน
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  const s = String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')          // อักขระต้องห้ามของ Windows
    .replace(/[\x00-\x1f\x7f]/g, '')   // อักขระควบคุม
    .replace(/\s+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')       // ขึ้นต้นด้วยจุด = ไฟล์ซ่อนบน mac
    .slice(0, 48)
    .trim();
  return s || 'starter';
}

/** ชื่อโฟลเดอร์ที่ยังไม่ถูกใช้ (taken = รายชื่อที่มีอยู่แล้ว) */
export function uniqueSlug(name, taken = []) {
  const base = slugify(name);
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; i < 999; i++) {
    const s = base + '-' + i;
    if (!used.has(s)) return s;
  }
  return base + '-' + Date.now().toString(36);
}

// ───────────────────────── ตัวละคร ─────────────────────────

/**
 * ตัวละครของ starter = cast ของห้องซ้อมบท + เพศ + รูป
 *
 * จงใจ **ห่อ** `newCastMember` แทนการไปเพิ่ม field ในนั้น — โมดูลห้องซ้อมบทมีเทสของตัวเอง
 * และไม่ควรรู้จัก starter · ผลคือ object ของเราส่งเข้าฟังก์ชันของ builder-core ได้ทุกตัว
 *
 * `persona` = "Detailed Description" ตามสเปก (ช่องเดียว ยาวได้)
 * `wikiPath` = ทางไป Wiki ของโปรเจกต์ที่สร้าง — **อาจชี้ไปที่ไม่มีจริง** เมื่อย้ายโปรเจกต์
 *              จึงห้ามมีโค้ดไหนถือว่ามันต้องมี (starter-wiki-merge.js เป็นคนจัดการตอนย้าย)
 */
export function newChar(patch = {}) {
  const base = newCastMember({ ...patch, id: patch.id || newCharId() });
  return {
    ...base,
    gender: patch.gender || '',
    image: patch.image || '',            // ชื่อไฟล์ใน <starter>/images/ (ไม่ใช่ path เต็ม)
    fromWiki: !!patch.fromWiki,          // ดึงเข้ามาจาก Wiki (ไม่ได้เกิดที่นี่)
  };
}

export function charById(s, id) { return ((s && s.cast) || []).find((c) => c.id === id) || null; }

/** เพิ่มหรือทับตัวละคร — คืน cast ชุดใหม่เสมอ (ไม่แก้ของเดิมในที่) */
export function upsertChar(cast, ch) {
  const rows = [...(cast || [])];
  const i = rows.findIndex((c) => c.id === ch.id);
  if (i < 0) rows.push(ch); else rows[i] = { ...rows[i], ...ch };
  return rows;
}

export function removeChar(cast, id) { return (cast || []).filter((c) => c.id !== id); }

/** ตัวละครพร้อมใช้ไหม — ต้องมีชื่อเป็นอย่างน้อย */
export function charReady(c) { return !!(c && String(c.name || '').trim()); }

// ───────────────────────── แท็กแนวเรื่อง ─────────────────────────

/** ตัดซ้ำ ตัดช่องว่าง คงลำดับที่ผู้ใช้เลือก */
export function normalizeTags(list) {
  const out = [];
  const seen = new Set();
  for (const raw of (list || [])) {
    const v = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(v);
  }
  return out;
}

export function toggleTag(list, tag) {
  const cur = normalizeTags(list);
  const k = String(tag || '').trim().toLowerCase();
  if (!k) return cur;
  const hit = cur.find((x) => x.toLowerCase() === k);
  return hit ? cur.filter((x) => x.toLowerCase() !== k) : normalizeTags([...cur, tag]);
}

export function hasTag(list, tag) {
  const k = String(tag || '').trim().toLowerCase();
  return normalizeTags(list).some((x) => x.toLowerCase() === k);
}

// ───────────────────────── ตัว starter ─────────────────────────

export function newStarter(patch = {}) {
  return {
    v: STARTER_VERSION,
    id: patch.id || newStarterId(),
    slug: patch.slug || '',
    name: patch.name || '',
    tags: normalizeTags(patch.tags),
    // [alpha.96] ผู้แต่ง + คำโปรยหนึ่งบรรทัด — หน้าเรื่องแสดงคู่กับปกแบบการ์ดนิยายจริง
    author: patch.author || '',
    blurb: patch.blurb || '',
    // "Story Description" — เก็บเป็น **HTML** เพราะช่องกรอกเป็นตัวแก้ไขแบบเห็นผลจริง
    // (ตัวหนา/เอียง/ขีดเส้นใต้ · จัดหน้า · แทรกรูป) · ส่งเข้า prompt ต้องผ่าน `introText()` เสมอ
    intro: patch.intro || '',
    // map เปิด — คีย์มาจากทะเบียนใน starter-steps-def.js ไม่ใช่จากที่นี่
    w: { ...(patch.w || {}) },
    cover: patch.cover || '',            // ปกแนวตั้ง 3:4 — ชื่อไฟล์ใน <starter>/images/
    banner: patch.banner || '',          // แบนเนอร์กว้างเต็มหน้า — ชื่อไฟล์ใน <starter>/images/
    cast: (patch.cast || []).map(newChar),
    step: Number.isFinite(patch.step) ? patch.step : 0,
    done: !!patch.done,
    created: patch.created || 0,
    updated: patch.updated || 0,
  };
}

/**
 * เนื้อ Story Description แบบข้อความล้วน
 *
 * ช่องกรอกเก็บเป็น HTML แต่ **โมเดลไม่ควรได้ HTML ดิบ** — เปลืองโทเคนและทำให้ตอบมาเป็นแท็กด้วย
 * ทุก prompt จึงต้องผ่านตัวนี้ · ไฟล์เก่าที่เก็บเป็นข้อความล้วนอยู่แล้วจะผ่านไปเฉย ๆ
 */
export function introText(s) {
  const raw = String((s && s.intro) || '');
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw.trim();
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    // ย่อหน้าคั่นด้วยบรรทัดว่าง — โมเดลอ่านโครงเรื่องออกง่ายกว่าก้อนติดกัน
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<img[^>]*>/gi, '')          // รูปไม่มีความหมายในบริบทข้อความ
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** มีคำบรรยายจริงไหม (แท็กเปล่า ๆ ไม่นับ) */
export function hasIntro(s) { return introText(s).length > 0; }

/**
 * เปิดไฟล์เก่าให้ได้เสมอ — ไม่มี `v` = ของก่อนมีเวอร์ชัน ให้ถือเป็น v1
 * เพิ่มรุ่นทีหลัง: เติม `if (v < 2) {...}` ต่อท้ายเป็นชั้น ๆ ห้ามเขียนทับของเดิม
 */
export function migrateStarter(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const s = newStarter(src);
  s.v = STARTER_VERSION;
  return s;
}

// ───────────────────────── ความคืบหน้า + ตรวจความครบ ─────────────────────────

/**
 * ขั้นไหน "กรอกแล้ว" — ใช้ทะเบียนขั้นเป็นตัวตัดสิน ไม่ใช่ if ซ้อนกันในนี้
 * @param {object} s
 * @param {object} step   หนึ่งแถวจากทะเบียนใน starter-steps-def.js
 */
export function stepFilled(s, step) {
  if (!step || typeof step.filled !== 'function') return false;
  try { return !!step.filled(s || {}); } catch { return false; }
}

export function starterProgress(s, steps = []) {
  const need = steps.filter((x) => x.required !== false);
  const done = need.filter((x) => stepFilled(s, x)).length;
  return { done, total: need.length, pct: need.length ? Math.round((done / need.length) * 100) : 0 };
}

/** ขั้นที่ยังไม่ครบ (ไว้บอกผู้ใช้ว่าติดตรงไหน) */
export function missingSteps(s, steps = []) {
  return steps.filter((x) => x.required !== false && !stepFilled(s, x));
}

export function starterReady(s, steps = []) { return missingSteps(s, steps).length === 0; }

// ───────────────────────── รายการ starter ─────────────────────────

export function sortStarters(rows) {
  return [...(rows || [])].sort((a, b) => (b.updated || 0) - (a.updated || 0)
    || String(a.name || '').localeCompare(String(b.name || ''), 'th'));
}

/** ค้นหาจากชื่อ · แท็ก · เรื่องย่อ · ชื่อตัวละคร */
export function searchStarters(rows, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return sortStarters(rows);
  const hit = (s) => {
    const hay = [s.name, s.intro, ...(s.tags || []), ...(s.cast || []).map((c) => c.name)]
      .join(' ').toLowerCase();
    return hay.includes(q);
  };
  return sortStarters((rows || []).filter(hit));
}

/** สรุปหนึ่งบรรทัดสำหรับการ์ดในหน้ารายการ */
export function starterSummary(s) {
  const parts = [];
  if ((s.cast || []).length) parts.push(t('ui.starter.sumCast') + (s.cast || []).length);
  if ((s.tags || []).length) parts.push((s.tags || []).slice(0, 3).join(' · '));
  return parts.join(' — ');
}

// ═══════════════════════════ Scenario ═══════════════════════════
//
// "หลักการเดียวกับ session" ตามสเปกข้อ 10 — จึงยืมแนวคิดจาก ai-session.js มาตรง ๆ
// แต่เก็บใน `<starter>/Scenarios/` ไม่ใช่ `<root>/Sessions/` เพราะต้องย้ายไปพร้อม starter
//
// ต่างจาก session ธรรมดา 2 อย่าง (สเปกข้อ 11 + 13):
//   · `prevId` — ต่อจากตอนก่อนหน้าได้ (ส่งต่อแค่บทย่อ ไม่ใช่บทเต็ม)
//   · เทิร์นของ GM พก `choices[]` มาด้วย และเทิร์นของผู้เล่นจำว่าเลือกข้อไหน

export const SCENARIO_VERSION = 1;
export const ROLE_GM = 'gm';          // ผู้กำกับ/ผู้บรรยาย
export const ROLE_PLAYER = 'player';  // ผู้เล่น (พิมพ์เอง หรือกดเลือก)

export function newTurn(patch = {}) {
  return {
    id: patch.id || nextId('tn'),
    role: patch.role === ROLE_PLAYER ? ROLE_PLAYER : ROLE_GM,
    speaker: patch.speaker || '',        // ไอดีตัวละครที่สวมบทอยู่ ('' = พูดในฐานะตัวเอง)
    text: patch.text || '',
    choices: [...(patch.choices || [])], // ทางเลือกที่ GM ยื่นให้ (เฉพาะเทิร์นของ GM)
    chosen: patch.chosen || '',          // ผู้เล่นกดข้อไหน ('' = พิมพ์เอง)
    thinking: patch.thinking || '',
    model: patch.model || '',
    provider: patch.provider || '',
    usage: patch.usage || null,
    ts: patch.ts || 0,
  };
}

export function newScenario(patch = {}) {
  return {
    v: SCENARIO_VERSION,
    id: patch.id || newScenarioId(),
    title: patch.title || '',
    synopsis: patch.synopsis || '',
    prevId: patch.prevId || '',          // เชื่อมกับตอนก่อนหน้า (สเปกข้อ 11)
    cast: [...(patch.cast || [])],       // ไอดีตัวละครที่ร่วมวง
    userChars: [...(patch.userChars || [])],  // ตัวไหนผู้เล่นเป็นคนสวมบท — GM ห้ามพูดแทน
    policy: patch.policy || 'manual',
    len: patch.len || 'medium',
    turns: (patch.turns || []).map(newTurn),
    recap: patch.recap || '',            // บทย่อหลังเล่นจบ — ตอนถัดไปใช้ต่อ
    // ประวัติการแปลงเป็นต้นฉบับ [{at, format, path}] — ต้องประกาศไว้ตรงนี้ ไม่งั้น
    // `newScenario` จะตัดทิ้งตอนอ่านไฟล์กลับ (field ที่ไม่อยู่ในโมเดล = ไม่รอด migrate)
    exports: (Array.isArray(patch.exports) ? patch.exports : [])
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({ at: x.at || 0, format: x.format || '', path: x.path || '' })),
    archived: !!patch.archived,
    created: patch.created || 0,
    updated: patch.updated || 0,
  };
}

export function migrateScenario(raw) {
  const s = newScenario((raw && typeof raw === 'object') ? raw : {});
  s.v = SCENARIO_VERSION;
  return s;
}

export function scenarioFileName(sc) { return String((sc && sc.id) || 'scenario') + '.json'; }

/** คุยกันไปแล้วจริง ๆ ไหม (ใช้ตัดสินว่าจะเตือนก่อนลบไหม) */
export function hasPlay(sc) { return ((sc && sc.turns) || []).length > 0; }

export function addTurn(sc, turn) {
  const rows = [...((sc && sc.turns) || []), newTurn(turn)];
  return { ...sc, turns: rows, updated: Date.now() };
}

/** ทางเลือกที่ค้างอยู่ตอนนี้ — เทิร์นสุดท้ายต้องเป็นของ GM เท่านั้น */
export function openChoices(sc) {
  const rows = (sc && sc.turns) || [];
  const last = rows[rows.length - 1];
  return (last && last.role === ROLE_GM) ? [...(last.choices || [])] : [];
}

export function scenarioStats(sc) {
  const rows = (sc && sc.turns) || [];
  let inTok = 0, outTok = 0;
  for (const r of rows) {
    inTok += (r.usage && (r.usage.in || r.usage.prompt_tokens)) || 0;
    outTok += (r.usage && (r.usage.out || r.usage.completion_tokens)) || 0;
  }
  return {
    turns: rows.length,
    gm: rows.filter((r) => r.role === ROLE_GM).length,
    player: rows.filter((r) => r.role === ROLE_PLAYER).length,
    words: rows.reduce((n, r) => n + String(r.text || '').trim().split(/\s+/).filter(Boolean).length, 0),
    inTok, outTok,
  };
}

export function sortScenarios(rows) {
  return [...(rows || [])].sort((a, b) => (a.created || 0) - (b.created || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), 'th'));
}

export function searchScenarios(rows, query, { includeArchived = false } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const base = (rows || []).filter((r) => includeArchived || !r.archived);
  if (!q) return sortScenarios(base);
  return sortScenarios(base.filter((r) =>
    [r.title, r.synopsis, r.recap].join(' ').toLowerCase().includes(q)));
}

/**
 * สายของ scenario ที่ต่อกันมา — จากตอนแรกสุดถึงตอนที่ระบุ
 * กันวนซ้ำด้วย `seen` เพราะไฟล์ถูกแก้นอกโปรแกรมได้ ผู้ใช้อาจตั้ง prevId ชี้กลับหากันเอง
 */
export function chainOf(rows, id) {
  const byId = new Map((rows || []).map((r) => [r.id, r]));
  const out = [];
  const seen = new Set();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.prevId ? byId.get(cur.prevId) : null;
  }
  return out;
}

/** ตอนก่อนหน้าที่เลือกได้ — ห้ามเลือกตัวเอง และห้ามเลือกลูกหลานของตัวเอง (กันวง) */
export function selectablePrev(rows, id) {
  const kids = new Set();
  const walk = (pid) => {
    for (const r of (rows || [])) {
      if (r.prevId === pid && !kids.has(r.id)) { kids.add(r.id); walk(r.id); }
    }
  };
  if (id) walk(id);
  return sortScenarios((rows || []).filter((r) => r.id !== id && !kids.has(r.id)));
}

/**
 * บทสนทนาเป็นข้อความล้วน — ใช้ทั้งตอนขอบทย่อ และตอนแปลงเป็นนิยาย (เฟส 4)
 * @param {object} sc
 * @param {function} nameOf  ไอดีตัวละคร → ชื่อ
 */
export function transcriptText(sc, nameOf = () => '') {
  const rows = (sc && sc.turns) || [];
  return rows.map((r) => {
    const who = r.role === ROLE_GM
      ? t('ui.starter.trGm')
      : (nameOf(r.speaker) || t('ui.starter.trPlayer'));
    return who + ': ' + String(r.text || '').trim();
  }).filter((x) => x.trim().length > 2).join('\n\n');
}

/**
 * รวมโทเคนของทุกตอนในเรื่องหนึ่ง (สำหรับป้ายบนหน้าเรื่อง)
 * [alpha.96] ผู้ใช้ขอให้ "ระบุ token ด้วย" — ค่าใช้จ่ายจริงอยู่ที่นี่ ไม่ใช่ที่จำนวนคำ
 */
export function sumTokens(rows) {
  let inTok = 0, outTok = 0, turns = 0;
  for (const sc of (rows || [])) {
    const st = scenarioStats(sc);
    inTok += st.inTok; outTok += st.outTok; turns += st.turns;
  }
  return { inTok, outTok, total: inTok + outTok, turns };
}

/** เวลาแก้ล่าสุดของทั้งเรื่อง — เอาตัวที่ใหม่สุดระหว่างตัว starter เองกับตอนทุกตอน */
export function lastUpdated(s, rows) {
  let t = (s && s.updated) || 0;
  for (const sc of (rows || [])) t = Math.max(t, sc.updated || 0, sc.created || 0);
  return t;
}
