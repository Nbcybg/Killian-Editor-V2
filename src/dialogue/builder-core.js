// builder-core.js — [alpha.82] เอนจิน "ห้องซ้อมบท" (บริสุทธิ์ 100% · มี unit test)
//
// โจทย์จากผู้ใช้: เวลาคิดบทพูดไม่ออก ให้ AI สวมบทตัวละครจาก Wiki แล้วคุยกันเองทีละเทิร์น
// ผู้ใช้เลือกว่าใครพูดกับใคร กดส่งแล้วดูมันคุย ชอบบรรทัดไหนก็กดแทรกลงบทตรงเคอร์เซอร์
//
// ═══ หลักคิดที่ตัดสินโครงทั้งไฟล์ ═══
//
// 1) **ตัวละครแต่ละตัวอ่านใบของตัวเองเท่านั้น** (ผู้ใช้กำหนดเอง)
//    prompt ของโทระ = ใบโทระเต็ม + "การ์ดสาธารณะ" ของคนอื่น (ชื่อ+คำโปรย+ความสัมพันธ์ที่โทระมองเขา)
//    → ความลับของตัวอื่นไม่มีทางรั่วเข้า prompt ตั้งแต่แรก ไม่ต้องมีสวิตช์ให้ผู้ใช้เลือกผิด
//
// 2) **บรรทัดของตัวเอง = assistant · ของคนอื่น = user ที่มีชื่อนำหน้า**
//    ทำให้โมเดลรู้สึกว่า "ฉันอยู่ในวงสนทนานี้" ไม่ใช่ "ฉันกำลังอ่านสคริปต์" — ต่างกันมากที่คุณภาพ
//
// 3) **session เป็นไฟล์เดียวจบในตัว** (สำเนา cast/rels ลงมาเลย ไม่อ้าง preset)
//    ก๊อป/แชร์/ลบไฟล์เดียวได้ · แก้ preset ทีหลังไม่ย้อนไปเปลี่ยนบุคลิกของ session ที่คุยจบแล้ว
//
// 4) **กฎเลือกคนพูดแยกเป็น 2 ชั้น** — คู่ที่ค้างในช่อง (ผู้ใช้กดทับได้ทุกเทิร์น)
//    กับ "โหมดคิว" ที่ตัดสินแค่ว่าหลังส่งแล้วช่องจะเด้งไปเป็นอะไร
//    A↔B ปิงปองกับวง 5 คนคนละกฎกัน — ยัดเป็นกฎเดียวไม่ได้ เคยลองแล้วมันพังที่ A→ทุกคน
//
// ไฟล์นี้ไม่แตะ DOM/fs/network — สุ่มก็ฉีดเข้ามา (`rnd`) เพื่อให้เทสได้แน่นอน

import { t, tf } from '../i18n.js';
import { estimateTokens } from '../ai/ai-session.js';

export const BUILDER_DIR = 'Dialogues';
export const PRESET_FILE = 'presets.json';
export const BUILDER_VERSION = 1;

/** จำนวนตัวละครสูงสุดต่อคณะ (ผู้ใช้กำหนด — prompt โตตามจำนวนตัว ทุกตัวเห็น transcript เดียวกัน) */
export const MAX_CAST = 5;

// ── ค่าพิเศษของช่องเลือกคน ────────────────────────────────────────
// เก็บเป็นสตริงที่ชนกับ id จริงไม่ได้ (id ของตัวละครเป็น c1/c2/…)
export const ANY_RANDOM = '__random__';    // 🎲 สุ่ม
export const ALL_LISTEN = '__all__';       // 👥 ทุกคน
export const AI_PICK = '__ai__';           // 🤖 ให้ AI เลือกคนพูด

// ── โหมดคิว: หลังกดส่งแล้ว ช่องจะเด้งไปเป็นอะไร ──────────────────
export const TURN_POLICIES = [
  { id: 'pingpong', label: t('ui.dlgBuilder.policyPingPong'), hint: t('ui.dlgBuilder.policyPingPongHint') },
  { id: 'round',    label: t('ui.dlgBuilder.policyRound'),    hint: t('ui.dlgBuilder.policyRoundHint') },
  { id: 'random',   label: t('ui.dlgBuilder.policyRandom'),   hint: t('ui.dlgBuilder.policyRandomHint') },
  { id: 'ai',       label: t('ui.dlgBuilder.policyAi'),       hint: t('ui.dlgBuilder.policyAiHint') },
  { id: 'manual',   label: t('ui.dlgBuilder.policyManual'),   hint: t('ui.dlgBuilder.policyManualHint') },
];
export const DEFAULT_POLICY = 'pingpong';
export function policyDef(id) { return TURN_POLICIES.find((p) => p.id === id) || TURN_POLICIES[0]; }

// ── โหมดยิง: ทีละคน (override รายตัวได้) vs รวดเดียว (ถูกกว่า) ──
export const SEND_MODES = [
  { id: 'each',  label: t('ui.dlgBuilder.modeEach'),  hint: t('ui.dlgBuilder.modeEachHint'),  perChar: true },
  { id: 'batch', label: t('ui.dlgBuilder.modeBatch'), hint: t('ui.dlgBuilder.modeBatchHint'), perChar: false },
];
export const DEFAULT_SEND_MODE = 'each';
export function sendModeDef(id) { return SEND_MODES.find((m) => m.id === id) || SEND_MODES[0]; }

// ── ความยาวต่อเทิร์น — ไม่ล็อกไว้ LLM พ่นย่อหน้าละ 5 บรรทัด ใช้เป็นบทหนังไม่ได้ ──
export const TURN_LENGTHS = [
  { id: 'short',  label: t('ui.dlgBuilder.lenShort'),  rule: t('ui.dlgBuilder.lenShortRule'),  maxTokens: 200 },
  { id: 'medium', label: t('ui.dlgBuilder.lenMedium'), rule: t('ui.dlgBuilder.lenMediumRule'), maxTokens: 380 },
  { id: 'long',   label: t('ui.dlgBuilder.lenLong'),   rule: t('ui.dlgBuilder.lenLongRule'),   maxTokens: 700 },
];
export const DEFAULT_LENGTH = 'medium';
export function lengthDef(id) { return TURN_LENGTHS.find((l) => l.id === id) || TURN_LENGTHS[1]; }

// ── ชนิดของเทิร์น ────────────────────────────────────────────────
export const KIND_LINE = 'line';         // บทพูดที่ AI สวมบทให้
export const KIND_USER = 'user';         // ผู้ใช้พิมพ์แทนตัวละครเอง (ไม่ยิง API)
export const KIND_DIRECTOR = 'director'; // ผู้กำกับแทรกเหตุการณ์กลางวง

// ────────────────────────────────────────────────────────────────
// 1) โครงข้อมูล
// ────────────────────────────────────────────────────────────────

let _seq = 0;
/** ไอดีที่ไม่ต้องพึ่ง Date.now()/Math.random() — เทสจึงคาดเดาผลได้ */
function nextId(prefix) { _seq += 1; return prefix + _seq.toString(36); }
/** รีเซ็ตตัวนับ (ใช้ในเทสเท่านั้น) */
export function _resetIds() { _seq = 0; }

/** สมาชิกหนึ่งคนในคณะ */
export function newCastMember(patch = {}) {
  return {
    id: patch.id || nextId('c'),
    name: patch.name || '',
    aliases: Array.isArray(patch.aliases) ? [...patch.aliases] : [],
    wikiPath: patch.wikiPath || '',
    cat: patch.cat || 'characters',
    persona: patch.persona || '',          // ใบบทบาทของตัวเอง (เต็ม)
    blurb: patch.blurb || '',              // การ์ดสาธารณะ — คนอื่นเห็นแค่บรรทัดนี้
    selfPronoun: patch.selfPronoun || '',  // สรรพนามเรียกตัวเอง
    providerId: patch.providerId || '',    // '' = ตามโปรเจกต์
    model: patch.model || '',              // '' = ตามผู้ให้บริการ
    params: patch.params ? { ...patch.params } : {},   // ทับเฉพาะคีย์ที่ตั้งจริง
  };
}

/**
 * ความสัมพันธ์แบบ **มีทิศทาง** — A มอง B ไม่เท่ากับ B มอง A
 * `how` = ความสัมพันธ์ในซีนนี้ (ทับของ Wiki) · `callThem` = สรรพนามที่ from ใช้เรียก to
 */
export function newRel(from, to, patch = {}) {
  return { from, to, how: patch.how || '', callThem: patch.callThem || '' };
}

export function newPreset(patch = {}) {
  return {
    id: patch.id || nextId('p'),
    name: patch.name || '',
    note: patch.note || '',
    cast: (patch.cast || []).map(newCastMember),
    rels: (patch.rels || []).map((r) => newRel(r.from, r.to, r)),
  };
}

export function newSession(patch = {}) {
  return {
    v: BUILDER_VERSION,
    id: patch.id || nextId('s'),
    title: patch.title || '',
    created: patch.created || 0,
    updated: patch.updated || 0,
    presetId: patch.presetId || '',
    presetName: patch.presetName || '',
    // สำเนาเต็ม — ไม่อ้าง preset (ข้อ 3 ของหลักคิด)
    cast: (patch.cast || []).map(newCastMember),
    rels: (patch.rels || []).map((r) => newRel(r.from, r.to, r)),
    situation: patch.situation || '',
    policy: patch.policy || DEFAULT_POLICY,
    mode: patch.mode || DEFAULT_SEND_MODE,
    len: patch.len || DEFAULT_LENGTH,
    paren: patch.paren !== false,          // อนุญาตวงเล็บอารมณ์ (ยกเว้นสั่งปิด)
    next: patch.next ? { ...patch.next } : { speaker: '', listener: '' },
    turns: (patch.turns || []).map((x) => ({ ...x })),
    archived: !!patch.archived,
  };
}

export function newTurn(patch = {}) {
  return {
    id: patch.id || nextId('t'),
    kind: patch.kind || KIND_LINE,
    speaker: patch.speaker || '',
    listener: patch.listener || '',
    text: patch.text || '',
    paren: patch.paren || '',
    thinking: patch.thinking || '',        // ความคิดของโมเดล — ผู้ใช้กางดูได้
    model: patch.model || '',
    provider: patch.provider || '',
    usage: patch.usage || null,
    ms: patch.ms || 0,
    inserted: patch.inserted || null,      // {scene, at} เมื่อกดแทรกลงบทแล้ว
    ts: patch.ts || 0,
  };
}

/** สร้าง session จาก preset — จุดเดียวที่ "สำเนา" เกิดขึ้น */
export function sessionFromPreset(preset, patch = {}) {
  const p = preset || {};
  return newSession({
    presetId: p.id || '', presetName: p.name || '',
    cast: (p.cast || []).map((c) => ({ ...c })),
    rels: (p.rels || []).map((r) => ({ ...r })),
    ...patch,
  });
}

/** ค้นสมาชิกคณะจาก id (คืน null ถ้าไม่มี — ห้าม throw เพราะไฟล์ที่แชร์มาอาจอ้าง id ที่ถูกลบ) */
export function castById(session, id) {
  return ((session && session.cast) || []).find((c) => c.id === id) || null;
}
export function castName(session, id) {
  if (id === ALL_LISTEN) return t('ui.dlgBuilder.everyone');
  if (id === ANY_RANDOM) return t('ui.dlgBuilder.randomPick');
  if (id === AI_PICK) return t('ui.dlgBuilder.aiPick');
  const c = castById(session, id);
  return c ? c.name : '';
}

/** ความสัมพันธ์ที่ `from` มองเห็น `to` (ทิศทางเดียว) */
export function relOf(session, from, to) {
  return ((session && session.rels) || []).find((r) => r.from === from && r.to === to) || null;
}
/** ตั้ง/แก้ความสัมพันธ์ทิศทางเดียว — ค่าว่างทั้งคู่ = ลบทิ้ง (ไม่เก็บแถวเปล่า) */
export function setRel(session, from, to, patch = {}) {
  if (!session) return null;
  session.rels = session.rels || [];
  const i = session.rels.findIndex((r) => r.from === from && r.to === to);
  const how = (patch.how ?? (i >= 0 ? session.rels[i].how : '')) || '';
  const callThem = (patch.callThem ?? (i >= 0 ? session.rels[i].callThem : '')) || '';
  if (!how.trim() && !callThem.trim()) {
    if (i >= 0) session.rels.splice(i, 1);
    return null;
  }
  const row = newRel(from, to, { how, callThem });
  if (i >= 0) session.rels[i] = row; else session.rels.push(row);
  return row;
}

/** เพิ่มคนเข้าคณะ — เกิน MAX_CAST คืน null (ผู้ใช้กำหนดเพดานไว้ 5) */
export function addCast(holder, member) {
  if (!holder) return null;
  holder.cast = holder.cast || [];
  if (holder.cast.length >= MAX_CAST) return null;
  const m = newCastMember(member);
  holder.cast.push(m);
  return m;
}
/** ถอดคนออกจากคณะ + ล้างความสัมพันธ์ที่อ้างถึงเขา (ไม่งั้นเหลือแถวผีที่ UI วาดไม่ได้) */
export function removeCast(holder, id) {
  if (!holder || !holder.cast) return false;
  const i = holder.cast.findIndex((c) => c.id === id);
  if (i < 0) return false;
  holder.cast.splice(i, 1);
  holder.rels = (holder.rels || []).filter((r) => r.from !== id && r.to !== id);
  if (holder.next) {
    if (holder.next.speaker === id) holder.next.speaker = '';
    if (holder.next.listener === id) holder.next.listener = '';
  }
  return true;
}

// ────────────────────────────────────────────────────────────────
// 2) ใบบทบาทจาก Wiki
// ────────────────────────────────────────────────────────────────

/**
 * ฟิลด์ที่นับว่าเป็น "บุคลิก" — รับได้ทั้งคีย์ไทยและอังกฤษ เพราะเทมเพลต Wiki ผู้ใช้ตั้งชื่อเอง
 *
 * กฎข้อ 2 ของผู้ใช้ห้ามฮาร์ดโค้ดเทมเพลต — ที่นี่ไม่ได้ "กำหนดว่าเทมเพลตต้องมีอะไร"
 * แต่เป็น "ถ้าเจอชื่อนี้จะเอามาใช้" เจอไม่ครบก็ข้ามไป ไม่มีอะไรพัง
 *
 * **ชื่อฟิลด์ตรงนี้เป็นข้อมูล ไม่ใช่ข้อความ UI** — มันคือคีย์ที่อยู่ใน Wiki JSON ของผู้ใช้จริง ๆ
 * แปลตามภาษาหน้าจอเมื่อไหร่ = สลับเป็นอังกฤษแล้วหาฟิลด์ไทยไม่เจอทั้งกระดาน (ขึ้นทะเบียนไว้ที่
 * tools/i18n-classify.cjs → SKIP_RANGES) · ป้ายที่เขียนลงใบบทบาทก็ใช้ตัวเดียวกัน เพราะใบบทบาท
 * ถูกเก็บลงไฟล์เซสชันเป็นเนื้อหา ไม่ใช่ข้อความที่วาดใหม่ทุกครั้ง
 */
export const PERSONA_FIELDS = [
  { key: 'role',        label: 'บทบาท',        names: ['role', 'บทบาท'] },
  { key: 'age',         label: 'อายุ',          names: ['age', 'อายุ'] },
  { key: 'personality', label: 'บุคลิก',        names: ['personality', 'traits', 'บุคลิก', 'นิสัย'] },
  { key: 'speech',      label: 'วิธีพูด',       names: ['speech', 'speechStyle', 'วิธีพูด', 'การพูด'] },
  { key: 'background',  label: 'ภูมิหลัง',      names: ['background', 'bio', 'ภูมิหลัง', 'ประวัติ'] },
  { key: 'goal',        label: 'เป้าหมาย',      names: ['goal', 'motivation', 'เป้าหมาย'] },
  { key: 'fear',        label: 'สิ่งที่กลัว',    names: ['fear', 'weakness', 'สิ่งที่กลัว', 'จุดอ่อน'] },
  { key: 'quirk',       label: 'นิสัยเฉพาะตัว', names: ['quirk', 'นิสัยเฉพาะตัว'] },
];

function pickField(src, names) {
  for (const n of names) {
    const v = src[n];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * แปลง Wiki entity → ข้อความใบบทบาท (persona)
 * ตั้งใจให้ออกมาเป็น "ภาษาคน" ไม่ใช่ JSON — โมเดลสวมบทได้ดีกว่ามาก
 * ผู้ใช้แก้ทับได้ทั้งก้อน (นี่คือเหตุผลที่ persona เป็นข้อความ ไม่ใช่ฟิลด์แยก)
 */
export function personaFromEntity(entity, name) {
  const e = entity || {};
  const src = { ...(e.fields || {}), ...e };
  const nm = name || e.name || e.title || '';
  const rows = [tf('ui.dlgBuilder.personaYouAre', nm)];
  for (const f of PERSONA_FIELDS) {
    const v = pickField(src, f.names);
    if (v) rows.push(`${f.label}: ${v}`);
  }
  const extra = e.desc || e.synopsis || e.notes || e.summary || '';
  if (extra) rows.push(String(extra).trim());
  return rows.join('\n');
}

/** คำโปรยหนึ่งบรรทัด (การ์ดสาธารณะ) — คนอื่นเห็นแค่นี้ */
export function blurbFromEntity(entity) {
  const e = entity || {};
  const src = { ...(e.fields || {}), ...e };
  const one = String(e.desc || e.synopsis || '').split(/\r?\n/)[0]
           || pickField(src, PERSONA_FIELDS[0].names) || '';
  return one.trim().slice(0, 80);
}

/**
 * ความสัมพันธ์ตั้งต้นจาก Wiki — ใช้เติมให้ครั้งแรก ผู้ใช้ทับได้ทีหลัง
 * Wiki เก็บเป็น relationships[] ของแต่ละคน ({target/targetName, role})
 */
export function relsFromEntities(cast, entityByName) {
  const out = [];
  for (const c of cast || []) {
    const e = (entityByName && entityByName[c.name]) || null;
    for (const r of (e && e.relationships) || []) {
      const target = r.targetName || r.target || '';
      const to = (cast || []).find((x) => x.name === target);
      if (!to || to.id === c.id) continue;
      if (!String(r.role || '').trim()) continue;
      out.push(newRel(c.id, to.id, { how: String(r.role).trim() }));
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// 3) กฎเลือกคนพูด
// ────────────────────────────────────────────────────────────────

/** เทิร์นล่าสุดที่เป็นบทพูดจริง (ข้ามคำสั่งผู้กำกับ — ผู้กำกับไม่ใช่คนในวง) */
export function lastSpoken(session) {
  const turns = (session && session.turns) || [];
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].kind !== KIND_DIRECTOR && turns[i].speaker) return turns[i];
  }
  return null;
}

/**
 * คู่ถัดไปหลังกดส่ง — **ตัดสินจากโหมดคิว + เทิร์นล่าสุดเท่านั้น**
 * @param {object} session
 * @param {function} rnd  คืน 0..1 (ฉีดเข้ามาเพื่อให้เทสแน่นอน)
 * @returns {{speaker:string, listener:string}}
 */
export function nextPair(session, rnd = () => 0) {
  const cast = (session && session.cast) || [];
  if (!cast.length) return { speaker: '', listener: '' };
  const last = lastSpoken(session);
  const policy = (session && session.policy) || DEFAULT_POLICY;
  const ids = cast.map((c) => c.id);

  if (policy === 'manual') return { ...(session.next || { speaker: '', listener: '' }) };
  if (!last) return { speaker: ids[0], listener: ids[1] || ALL_LISTEN };

  if (policy === 'ai') return { speaker: AI_PICK, listener: last.speaker || ALL_LISTEN };

  if (policy === 'random') {
    return { speaker: ANY_RANDOM, listener: last.speaker || ALL_LISTEN };
  }

  if (policy === 'round') {
    const i = ids.indexOf(last.speaker);          // -1 = คนพูดล่าสุดถูกถอดออกจากคณะไปแล้ว
    return { speaker: ids[(i + 1) % ids.length], listener: ALL_LISTEN };
  }

  // pingpong — สลับคู่ของเทิร์นล่าสุด
  // เคสที่พังถ้าไม่ดัก: เทิร์นล่าสุดเป็น A→ทุกคน แล้วใครสวน? ปิงปองไม่มีคำตอบ
  // → ตกไปที่ "ให้ AI เลือก" เพราะมันเลือกคนที่ *มีเหตุผลจะสวน* ดีกว่าสุ่มมั่ว
  if (!last.listener || last.listener === ALL_LISTEN) {
    return { speaker: cast.length > 2 ? AI_PICK : (ids.find((x) => x !== last.speaker) || ids[0]),
             listener: last.speaker };
  }
  return { speaker: last.listener, listener: last.speaker };
}

/**
 * แปลงค่าพิเศษในช่องเป็น id จริง ณ ตอนกดส่ง
 * ค่าที่สุ่มได้จะถูก "ล็อกลงเทิร์น" โดยผู้เรียก — ย้อนอ่านประวัติแล้วรู้ว่าใครพูดจริง
 * @returns {{speaker:string, listener:string, needAi:boolean}}
 */
export function resolvePair(session, pair, rnd = () => 0) {
  const cast = (session && session.cast) || [];
  const ids = cast.map((c) => c.id);
  const last = lastSpoken(session);
  let speaker = (pair && pair.speaker) || '';
  let listener = (pair && pair.listener) || '';

  if (speaker === ANY_RANDOM) {
    // ไม่สุ่มซ้ำคนที่เพิ่งพูด (ถ้ายังมีตัวเลือกอื่น) — ไม่งั้นได้ "A พูดคนเดียวสามเทิร์นติด"
    const pool = ids.filter((x) => x !== (last && last.speaker));
    const use = pool.length ? pool : ids;
    speaker = use[Math.min(use.length - 1, Math.floor(rnd() * use.length))] || '';
  }
  if (listener === ANY_RANDOM) {
    const pool = ids.filter((x) => x !== speaker);
    const use = pool.length ? pool : ids;
    listener = use[Math.min(use.length - 1, Math.floor(rnd() * use.length))] || '';
  }
  return { speaker, listener, needAi: speaker === AI_PICK };
}

/** ตัวเลือกในช่อง "คนพูด" (ไม่รวมทุกคน — คนพูดต้องเป็นตัวเดียว) */
export function speakerOptions(session) {
  const cast = (session && session.cast) || [];
  const rows = cast.map((c) => ({ id: c.id, label: c.name }));
  rows.push({ id: ANY_RANDOM, label: t('ui.dlgBuilder.randomPick') });
  // "ให้ AI เลือก" มีความหมายเฉพาะตอนมีตัวเลือกจริง — 2 คนมันรู้อยู่แล้วว่าใครสวน
  if (cast.length > 2) rows.push({ id: AI_PICK, label: t('ui.dlgBuilder.aiPick') });
  return rows;
}
/** ตัวเลือกในช่อง "พูดกับ" */
export function listenerOptions(session) {
  const rows = ((session && session.cast) || []).map((c) => ({ id: c.id, label: c.name }));
  rows.push({ id: ALL_LISTEN, label: t('ui.dlgBuilder.everyone') });
  rows.push({ id: ANY_RANDOM, label: t('ui.dlgBuilder.randomPick') });
  return rows;
}

// ────────────────────────────────────────────────────────────────
// 4) ประกอบ prompt
// ────────────────────────────────────────────────────────────────

/**
 * system prompt ของตัวละครหนึ่งตัว
 * โครง: ใบตัวเอง → สรรพนาม → การ์ดสาธารณะของคนอื่น → สถานการณ์ → กติกาการตอบ
 */
export function buildSystem(session, charId) {
  const me = castById(session, charId);
  if (!me) return '';
  const rows = [];
  rows.push(me.persona || tf('ui.dlgBuilder.personaYouAre', me.name));

  // สรรพนาม — LLM ไทยมั่วสรรพนามตลอด ล็อกตรงนี้ทีเดียวคุมทั้ง session
  const pron = [];
  if (me.selfPronoun) pron.push(tf('ui.dlgBuilder.pronSelf', me.selfPronoun));
  for (const other of (session.cast || [])) {
    if (other.id === charId) continue;
    const r = relOf(session, charId, other.id);
    if (r && r.callThem) pron.push(tf('ui.dlgBuilder.pronOther', other.name, r.callThem));
  }
  if (pron.length) rows.push('', t('ui.dlgBuilder.headPronoun'), ...pron);

  // การ์ดสาธารณะของคนอื่น — ชื่อ + คำโปรย + ความสัมพันธ์ที่ "ฉัน" มองเขา
  const others = (session.cast || []).filter((c) => c.id !== charId);
  if (others.length) {
    rows.push('', t('ui.dlgBuilder.headOthers'));
    for (const o of others) {
      const r = relOf(session, charId, o.id);
      const bits = [o.name];
      if (o.blurb) bits.push(o.blurb);
      if (r && r.how) bits.push(r.how);
      rows.push('- ' + bits.join(' · '));
    }
  }

  if (session.situation) rows.push('', t('ui.dlgBuilder.headSituation'), session.situation);

  rows.push('', t('ui.dlgBuilder.headRules'));
  rows.push(tf('ui.dlgBuilder.ruleOnlyMe', me.name));
  rows.push(lengthDef(session.len).rule);
  rows.push(session.paren !== false ? t('ui.dlgBuilder.ruleParenOn') : t('ui.dlgBuilder.ruleParenOff'));
  rows.push(t('ui.dlgBuilder.ruleNoName'));
  rows.push(t('ui.dlgBuilder.ruleNoNarrate'));
  return rows.join('\n');
}

/** ข้อความหนึ่งเทิร์นเมื่อมองจากสายตาคนอื่น (มีชื่อนำหน้าเสมอ) */
export function turnAsHeard(session, turn) {
  if (!turn) return '';
  if (turn.kind === KIND_DIRECTOR) return tf('ui.dlgBuilder.heardDirector', turn.text);
  const nm = castName(session, turn.speaker) || t('ui.dlgBuilder.unknownName');
  const paren = turn.paren ? `(${turn.paren}) ` : '';
  return `${nm}: ${paren}${turn.text}`;
}

/**
 * transcript จากมุมของตัวละครหนึ่งตัว
 * บรรทัดของตัวเอง = assistant · ของคนอื่น = user ที่มีชื่อนำหน้า (ข้อ 2 ของหลักคิด)
 * เทิร์นติดกันที่เป็นของคนอื่นถูกรวมเป็นข้อความ user ก้อนเดียว — ผู้ให้บริการหลายเจ้าไม่รับ user ติดกัน
 */
export function buildMessages(session, charId, { maxTokens = 6000 } = {}) {
  const turns = (session && session.turns) || [];
  const rows = [];
  for (const tn of turns) {
    if (!tn.text && tn.kind !== KIND_DIRECTOR) continue;
    if (tn.kind !== KIND_DIRECTOR && tn.speaker === charId) {
      const paren = tn.paren ? `(${tn.paren}) ` : '';
      rows.push({ role: 'assistant', content: paren + tn.text });
    } else {
      const line = turnAsHeard(session, tn);
      const prev = rows[rows.length - 1];
      if (prev && prev.role === 'user') prev.content += '\n' + line;
      else rows.push({ role: 'user', content: line });
    }
  }
  // ตัดจากท้าย (เทิร์นใหม่สำคัญกว่า) แล้วคืนลำดับเดิม
  const out = [];
  let used = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const cost = estimateTokens(rows[i].content);
    if (used + cost > maxTokens && out.length) break;
    used += cost;
    out.unshift(rows[i]);
  }
  // ข้อความแรกต้องเป็น user เสมอ (assistant นำหน้า = หลายเจ้าปฏิเสธคำขอ)
  // **ห้ามทิ้งบรรทัดนั้น** — เซสชันที่ตัวละครตัวนี้เป็นคนเปิดฉากจะเสียบทพูดแรกไปเลย
  // ใส่ "ฉากเปิด" เป็น user นำหน้าแทน ได้จุดยึดให้โมเดลด้วย
  if (out.length && out[0].role === 'assistant') {
    out.unshift({ role: 'user',
                  content: (session && session.situation)
                    ? tf('ui.dlgBuilder.sceneOpen', session.situation) : t('ui.dlgBuilder.sceneOpenBare') });
  }
  return out;
}

/** คำสั่งท้ายสุดที่บอกว่า "ตาคุณพูดแล้ว พูดกับใคร" */
export function turnCue(session, speaker, listener) {
  const to = listener === ALL_LISTEN || !listener
    ? t('ui.dlgBuilder.everyone') : castName(session, listener);
  return tf('ui.dlgBuilder.cueYourTurn', to);
}

/**
 * ก้อนคำขอครบชุดของ "ให้ตัวละคร X พูดหนึ่งเทิร์น"
 * @returns {{system, messages, maxTokens, cast}}
 */
export function buildTurnRequest(session, speaker, listener, opts = {}) {
  const me = castById(session, speaker);
  if (!me) return null;
  const messages = buildMessages(session, speaker, opts);
  messages.push({ role: 'user', content: turnCue(session, speaker, listener) });
  return { system: buildSystem(session, speaker), messages,
           maxTokens: lengthDef(session.len).maxTokens, cast: me };
}

/**
 * โหมด "รวดเดียว" — ยิงครั้งเดียวได้หลายบรรทัด ใช้โมเดลเดียวทั้งวง
 * ผู้ใช้รู้ตัวว่าแลก override รายตัวไปแล้ว (เลือกเองที่หัวเซสชัน)
 */
export function buildBatchRequest(session, lines = 6, opts = {}) {
  const cast = (session && session.cast) || [];
  if (!cast.length) return null;
  const rows = [tf('ui.dlgBuilder.batchWrite', lines)];
  rows.push('', t('ui.dlgBuilder.headCast'));
  for (const c of cast) {
    rows.push(`- ${c.name}${c.blurb ? ' · ' + c.blurb : ''}${c.selfPronoun ? ' · ' + tf('ui.dlgBuilder.pronSelf', c.selfPronoun) : ''}`);
    if (c.persona) rows.push('  ' + c.persona.replace(/\n/g, '\n  '));
  }
  const rels = (session.rels || []).filter((r) => r.how || r.callThem);
  if (rels.length) {
    rows.push('', t('ui.dlgBuilder.headRels'));
    for (const r of rels) {
      const bits = [`${castName(session, r.from)} → ${castName(session, r.to)}`];
      if (r.how) bits.push(r.how);
      if (r.callThem) bits.push(tf('ui.dlgBuilder.pronOther', castName(session, r.to), r.callThem));
      rows.push('- ' + bits.join(' · '));
    }
  }
  if (session.situation) rows.push('', t('ui.dlgBuilder.headSituation'), session.situation);
  rows.push('', t('ui.dlgBuilder.headRules'));
  rows.push(lengthDef(session.len).rule);
  rows.push(session.paren !== false ? t('ui.dlgBuilder.ruleParenOn') : t('ui.dlgBuilder.ruleParenOff'));
  rows.push(t('ui.dlgBuilder.batchFormat'));
  const messages = buildMessages(session, '__none__', opts);
  messages.push({ role: 'user', content: rows.join('\n') });
  return { system: t('ui.dlgBuilder.batchSystem'), messages,
           maxTokens: lengthDef(session.len).maxTokens * lines };
}

/** prompt สั้นมากสำหรับ "ใครควรพูดต่อ" — ตอบชื่อคำเดียว ใช้โมเดลถูก ๆ ของโปรเจกต์ */
export function buildPickerRequest(session) {
  const cast = (session && session.cast) || [];
  if (cast.length < 2) return null;
  const rows = [t('ui.dlgBuilder.pickAsk')];
  rows.push(cast.map((c) => c.name).join(' / '));
  if (session.situation) rows.push('', t('ui.dlgBuilder.headSituation'), session.situation);
  const recent = (session.turns || []).slice(-6).map((tn) => turnAsHeard(session, tn));
  if (recent.length) rows.push('', t('ui.dlgBuilder.headRecent'), ...recent);
  rows.push('', t('ui.dlgBuilder.pickAnswerOnlyName'));
  return { system: t('ui.dlgBuilder.pickSystem'), messages: [{ role: 'user', content: rows.join('\n') }],
           maxTokens: 24 };
}

/** อ่านชื่อที่ AI เลือกกลับมาเป็น id — จับไม่ได้คืน '' (ผู้เรียกตกไปสุ่มเอง) */
export function parsePickedSpeaker(session, raw) {
  const txt = String(raw || '').trim();
  if (!txt) return '';
  const cast = (session && session.cast) || [];
  // ชื่อยาวชนะ — กัน "สม" ไปแย่งแมตช์ใน "สมชาย" (ไทยไม่มีช่องว่างคั่น)
  const sorted = [...cast].sort((a, b) => (b.name || '').length - (a.name || '').length);
  for (const c of sorted) if (c.name && txt.includes(c.name)) return c.id;
  return '';
}

// ────────────────────────────────────────────────────────────────
// 5) อ่านคำตอบ
// ────────────────────────────────────────────────────────────────

const FENCE = /```[a-z]*\n?/gi;

/**
 * ล้างคำตอบให้เหลือบทพูดล้วน
 * โมเดลชอบแถม "ชื่อ:" นำหน้าทั้งที่สั่งห้าม · ชอบครอบเครื่องหมายคำพูด · ชอบใส่ @ แบบ fountain
 */
export function parseSpokenLine(raw, name = '', opts = {}) {
  let txt = String(raw || '').replace(FENCE, '').trim();
  let paren = '';
  if (!txt) return { text: '', paren: '' };

  // ตัด @ชื่อ / ชื่อ: ที่นำหน้า (วนเผื่อโมเดลใส่ทั้งสองแบบ)
  //
  // **ตัดเฉพาะชื่อที่รู้จักเท่านั้น** — เคยคิดจะตัด "อะไรก็ได้ที่ตามด้วย : " แต่นั่นกินบทพูดจริง
  // ("ฟังนะ: ฉันไม่ไป" → เหลือ "ฉันไม่ไป") · บทพูดที่หายไปเงียบ ๆ แย่กว่าชื่อที่ติดมาแล้วเห็นได้
  const aliases = [name, ...(Array.isArray(opts.aliases) ? opts.aliases : [])].filter(Boolean);
  for (let i = 0; i < 3; i++) {
    const before = txt;
    txt = txt.replace(/^@[^\n]{1,40}\n+/, '');
    for (const a of aliases) {
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      txt = txt.replace(new RegExp('^\\s*' + esc + '\\s*[:：]\\s*'), '');
    }
    if (txt === before) break;
    txt = txt.trim();
  }

  // วงเล็บอารมณ์ที่อยู่หน้าสุด → แยกออกเป็นฟิลด์ paren
  const pm = txt.match(/^\(([^)]{1,60})\)\s*/);
  if (pm) { paren = pm[1].trim(); txt = txt.slice(pm[0].length).trim(); }

  // เครื่องหมายคำพูดครอบทั้งก้อน — เอาออก (เราเก็บบทพูดดิบ ใส่รูปแบบตอนแทรก)
  const q = txt.match(/^["“”「『«](.+)["“”」』»]$/s);
  if (q && !/["“”]/.test(q[1])) txt = q[1].trim();

  return { text: txt, paren };
}

/** อ่านคำตอบโหมด "รวดเดียว" เป็นหลายเทิร์น */
export function parseBatch(session, raw) {
  const txt = String(raw || '').replace(FENCE, '').trim();
  const out = [];
  let cur = null;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('@')) {
      const id = parsePickedSpeaker(session, line.slice(1));
      cur = { speaker: id, text: '', paren: '' };
      out.push(cur);
      continue;
    }
    const colon = line.match(/^([^:：]{1,30})[:：]\s*(.*)$/);
    if (colon) {
      const id = parsePickedSpeaker(session, colon[1]);
      if (id) {
        const p = parseSpokenLine(colon[2]);
        cur = { speaker: id, text: p.text, paren: p.paren };
        out.push(cur);
        continue;
      }
    }
    if (/^\(.*\)$/.test(line)) { if (cur) cur.paren = line.slice(1, -1).trim(); continue; }
    if (cur) cur.text = cur.text ? cur.text + ' ' + line : line;
  }
  return out.filter((r) => r.speaker && r.text);
}

// ────────────────────────────────────────────────────────────────
// 6) แทรกลงบท
// ────────────────────────────────────────────────────────────────

/**
 * บทพูดหนึ่งเทิร์นในรูปแบบบทภาพยนตร์ของ K2
 * ผู้ใช้สั่ง: **แทรกเป็นบทหนังเสมอ ทั้งโหมดนิยายและโหมดบท**
 * (คนเขียนนิยายไปแก้เอง คนเขียนบทไม่ต้องแก้อะไรเลย)
 */
export function turnToScreenplay(session, turn) {
  if (!turn || !turn.text) return '';
  if (turn.kind === KIND_DIRECTOR) return turn.text;
  const nm = castName(session, turn.speaker);
  const rows = [];
  if (nm) rows.push('@' + nm);
  if (turn.paren) rows.push('(' + turn.paren + ')');
  rows.push(turn.text);
  return rows.join('\n');
}

/** ทั้งเซสชันเป็นบทภาพยนตร์ (เว้นบรรทัดคั่นระหว่างเทิร์น) */
export function sessionToScreenplay(session, turns) {
  const rows = (turns || (session && session.turns) || [])
    .map((tn) => turnToScreenplay(session, tn)).filter(Boolean);
  return rows.join('\n\n');
}

// ────────────────────────────────────────────────────────────────
// 7) เบ็ดเตล็ด
// ────────────────────────────────────────────────────────────────

/** ชื่อเซสชันจากสถานการณ์ — ค่าเริ่มต้นที่ได้ทันทีโดยไม่ต้องยิง API */
export function titleFromSituation(text, max = 40) {
  const one = String(text || '').replace(/\s+/g, ' ').trim();
  if (!one) return t('ui.dlgBuilder.untitled');
  if (one.length <= max) return one;
  return one.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/** ชื่อไฟล์ที่ปลอดภัยบนทุกระบบ + ไม่ชนกับ presets.json */
export function sessionFileName(session, taken = []) {
  const base = String((session && session.title) || t('ui.dlgBuilder.untitled'))
    .replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60)
    || t('ui.dlgBuilder.untitled');
  const reserved = base.toLowerCase() === 'presets' ? base + '_' : base;
  let name = reserved + '.json';
  let i = 2;
  const used = new Set((taken || []).map((x) => String(x).toLowerCase()));
  while (used.has(name.toLowerCase())) { name = `${reserved} (${i}).json`; i++; }
  return name;
}

/** สถิติของเซสชัน (โชว์ป้ายต้นทุนที่หัวแผง) */
export function sessionStats(session) {
  const turns = (session && session.turns) || [];
  let input = 0, output = 0, calls = 0, ms = 0;
  for (const tn of turns) {
    if (!tn.usage) continue;
    calls++;
    input += tn.usage.input || 0;
    output += tn.usage.output || 0;
    ms += tn.ms || 0;
  }
  const spoken = turns.filter((x) => x.kind !== KIND_DIRECTOR).length;
  return { turns: turns.length, spoken, calls, input, output, total: input + output, ms,
           inserted: turns.filter((x) => x.inserted).length };
}

/** เซสชันที่ยังไม่ได้บันทึก (กฎข้อ 1 ของผู้ใช้ — ต้องขึ้นรายการงานค้าง) */
export function sessionDirty(session, savedAt) {
  if (!session) return false;
  return (session.updated || 0) > (savedAt || 0);
}

export function sortSessions(rows) {
  return [...(rows || [])].sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export function searchSessions(rows, query, { includeArchived = false } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return sortSessions((rows || []).filter((s) => {
    if (!includeArchived && s.archived) return false;
    if (!q) return true;
    const hay = [s.title, s.situation, s.presetName,
                 ...(s.cast || []).map((c) => c.name)].join(' ').toLowerCase();
    return hay.includes(q);
  }));
}

export { estimateTokens };
