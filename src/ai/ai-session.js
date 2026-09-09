// ai-session.js — [alpha.61 ข้อ 2] เซสชันแชท AI แบบ opencode (โมดูลบริสุทธิ์)
//
// เซสชันเก็บเป็นไฟล์ JSON ในโฟลเดอร์ `Sessions/` **ของโปรเจกต์นั้น ๆ** เพื่อให้
//   · เปิดโปรเจกต์ไหน ก็เห็นบทสนทนาของโปรเจกต์นั้น (ไม่ปนกัน)
//   · ก๊อปโฟลเดอร์โปรเจกต์ไปเครื่องอื่น บทสนทนาไปด้วย
//   · แก้/ลบนอกโปรแกรมได้ ตามหลัก "ไฟล์แก้นอกโปรแกรมได้" ของ Killian
//
// ไฟล์นี้ไม่แตะ DOM/fs/network — เป็นแค่โครงข้อมูล + การคำนวณสถิติ → unit test ได้ตรง ๆ

import { t as tt, t, T } from '../i18n.js';
export const SESSION_DIR = 'Sessions';
export const SESSION_VERSION = 1;

// โหมดการทำงานของผู้ช่วย (ผู้ใช้สลับได้ที่กล่องพิมพ์)
// `cap` = สิทธิ์ที่ส่งให้ ai-tools.js ตัดสินว่าคำสั่งไหนเรียกได้ ('read' | 'write' | 'full')
export const CHAT_MODES = [
  { id: 'plan',  label: tt('ui.aiSession.plannerRead'), icon: '📖', write: false, cap: 'read',
    system: tt('ui.aiSession.youAssistantWriterMode') +
            tt('ui.aiSession.readProjectCmdRead') +
            tt('ui.aiSession.userEditTextEdit') },
  { id: 'write', label: tt('ui.aiSession.helpWriteNewEdit'), icon: '✍️', write: true, cap: 'write',
    system: tt('ui.aiSession.youAssistantWriterMode2') +
            tt('ui.aiSession.delCantWriteNext') },
  { id: 'agent', label: tt('ui.aiSession.unlockFullDoAll'), icon: '🔓', write: true, cap: 'full',
    system: tt('ui.aiSession.youAssistantWriterAct') +
            tt('ui.aiSession.cmdBottomRunEnd') +
            tt('ui.aiSession.beforeDelResultShort') },
];
export const DEFAULT_MODE = 'plan';
export function modeDef(id) { return CHAT_MODES.find((m) => m.id === id) || CHAT_MODES[0]; }
/** สิทธิ์ของโหมด — ai-tools.js ใช้ค่านี้ */
export function modeCap(id) { return modeDef(id).cap || 'read'; }

// มุมมอง transcript — เปลี่ยนได้ที่หัวเซสชัน มีผลกับการแสดงผลเท่านั้น (ไม่กระทบข้อมูล)
export const TRANSCRIPT_VIEWS = [
  { id: 'normal',   label: tt('ui.aiSession.normal'),       icon: '💬',
    hint: tt('ui.aiSession.onlyDialogueHideBlock') },
  { id: 'thinking', label: tt('ui.aiSession.idea'),     icon: '🧠',
    hint: tt('ui.aiSession.dialogueIdeaModelSend') },
  { id: 'verbose',  label: tt('ui.common.detailed'),     icon: '🔍',
    hint: tt('ui.aiSession.allSystemPromptContext') },
  { id: 'summary',  label: tt('ui.common.summary'),        icon: '📋',
    hint: tt('ui.aiSession.collapseLineNextText') },
];
export const DEFAULT_VIEW = 'normal';
export function viewDef(id) { return TRANSCRIPT_VIEWS.find((v) => v.id === id) || TRANSCRIPT_VIEWS[0]; }

// ระดับการเข้าถึงข้อมูลของโปรเจกต์ที่ยอมให้ AI เห็น
export const SCOPES = [
  // [alpha.125 ข้อ B] ★ "เฉพาะส่วนที่เกี่ยวข้อง" — ค้นทั้งเรื่องแล้วส่งเฉพาะท่อนที่ตรงคำถาม
  //
  // ระดับ `project` เดิมคือ "ยัดไฟล์ไปเรื่อย ๆ จนครบ 24,000 ตัวอักษรแล้วตัด" → เรื่องยาว
  // โมเดลจะเห็นแค่ไฟล์แรก ๆ ตามลำดับโฟลเดอร์ ไม่ใช่ส่วนที่เกี่ยวกับคำถามเลย
  // ระดับนี้ใช้สาย RAG ของ `ai/ai-chat.js` (สเปกข้อ 79) ซึ่งฝังเวกเตอร์ **ออฟไลน์ได้**
  // (`localEmbed` ใน ai-core.js — ไม่มีคีย์ก็ทำงาน) จึงหยิบเฉพาะท่อนที่ใกล้เคียงคำถามจริง ๆ
  { id: 'relevant', label: tt('ui.aiSession.onlyRelevant') },
  { id: 'project', label: tt('ui.aiSession.project') },
  { id: 'book',    label: tt('ui.aiSession.onlyBook') },
  { id: 'chapter', label: tt('ui.aiSession.onlyChapter') },
  { id: 'scene',   label: tt('ui.aiSession.onlyScene') },
  { id: 'none',    label: tt('ui.aiSession.notInTo') },
];
export const DEFAULT_SCOPE = 'scene';
export function scopeLabel(id) { return (SCOPES.find((s) => s.id === id) || SCOPES[0]).label; }

/**
 * ══ [alpha.145] ระดับการใช้ความคิดของโมเดล — ตั้งได้ **รายเซสชัน** ══
 *
 * ผู้ใช้: *"ไม่มีการปรับ effort level"*
 * มีอยู่แล้วใน Parameters ของผู้ให้บริการ (`reasoningEffort`) แต่ **แก้ทีเดียวมีผลทุกเซสชัน**
 * และต้องเข้าไปในกล่องตั้งค่า → แก้ผู้ให้บริการ → เลื่อนหาช่อง = ใช้จริงไม่ไหว
 * ตอนนี้อยู่ข้างกล่องพิมพ์: ถามสั้น ๆ ใช้ minimal · ให้วางโครงทั้งเล่มค่อยขึ้น high
 * ค่าว่าง `''` = ตามที่ตั้งไว้ในผู้ให้บริการ (ไม่ทับ)
 */
export const REASONING_EFFORTS = [
  { id: '',        label: T`คิด: ตามผู้ให้บริการ` },
  { id: 'minimal', label: T`คิด: น้อยสุด` },
  { id: 'low',     label: T`คิด: น้อย` },
  { id: 'medium',  label: T`คิด: กลาง` },
  { id: 'high',    label: T`คิด: มาก` },
];
export function isReasoningEffort(v) { return REASONING_EFFORTS.some((r) => r.id === String(v || '')); }
export function effortLabel(id) {
  return (REASONING_EFFORTS.find((r) => r.id === String(id || '')) || REASONING_EFFORTS[0]).label;
}

// ปุ่มส่งข้อความ — ผู้ใช้เลือกได้ในตั้งค่า (บางคนพิมพ์หลายบรรทัดเป็นหลัก)
export const SEND_KEYS = [
  { id: 'enter',       label: tt('ui.aiSession.enterSendShiftEnter') },
  { id: 'shift-enter', label: tt('ui.aiSession.shiftEnterSendEnter') },
];
export const DEFAULT_SEND_KEY = 'enter';
/** อีเวนต์นี้คือ "สั่งส่ง" ไหม ตามการตั้งค่าปุ่มส่ง */
export function isSendKey(ev, sendKey = DEFAULT_SEND_KEY) {
  if (!ev || ev.key !== 'Enter' || ev.isComposing) return false;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  return sendKey === 'shift-enter' ? ev.shiftKey === true : ev.shiftKey !== true;
}

let _seq = 0;
export function newSessionId() {
  _seq++;
  return 's' + Date.now().toString(36) + _seq.toString(36);
}

/** เซสชันเปล่า */
export function newSession(patch = {}) {
  const now = new Date().toISOString();
  return {
    v: SESSION_VERSION,
    id: patch.id || newSessionId(),
    title: patch.title || tt('ui.aiSession.sessionNew'),
    // [alpha.63r4] ต้องขนกลับมาด้วย — ของเดิมตกฟิลด์นี้ ทำให้ชื่อที่ผู้ใช้ตั้งเอง
    // ถูกชื่ออัตโนมัติทับทันทีที่ปิดแล้วเปิดโปรแกรมใหม่
    titleSet: !!patch.titleSet,
    created: patch.created || now,
    updated: patch.updated || now,
    archived: !!patch.archived,
    mode: patch.mode || DEFAULT_MODE,
    scope: patch.scope || DEFAULT_SCOPE,
    scopePath: patch.scopePath || '',
    view: patch.view || DEFAULT_VIEW,       // มุมมอง transcript ที่เลือกไว้ล่าสุด
    autoRun: patch.autoRun !== false,       // ทำคำสั่งเองโดยไม่ถาม (ยกเว้นคำสั่งที่ลบของ)
    confirmDestructive: patch.confirmDestructive !== false,  // ถามก่อนลบเสมอ
    providerId: patch.providerId || '',     // override จากตั้งค่า — เซสชันเลือกเจ้าของตัวเองได้
    model: patch.model || '',               // override โมเดล (อิสระจากตั้งค่ากลาง)
    contextLimit: patch.contextLimit || 0,  // 0 = ไม่รู้ (ยังไม่เคยตอบกลับมา)
    // [alpha.145] ระดับการใช้ความคิดรายเซสชัน ('' = ตามผู้ให้บริการ)
    effort: isReasoningEffort(patch.effort) ? String(patch.effort || '') : '',
    // [alpha.145] id ของไฟล์ทักษะใน `Skills/` ที่เปิดใช้กับเซสชันนี้
    skills: Array.isArray(patch.skills) ? patch.skills.map(String) : [],
    files: Array.isArray(patch.files) ? patch.files.slice() : [],
    messages: Array.isArray(patch.messages) ? patch.messages.slice() : [],
  };
}

/** เซสชันนี้ "เริ่มคุยแล้ว" หรือยัง — ใช้ตัดสินว่าถึงเวลาเขียนไฟล์หรือยัง */
export function hasConversation(s) {
  return !!(s && Array.isArray(s.messages) && s.messages.length);
}

/** ชื่อไฟล์ของเซสชัน — ปลอดภัยกับทุกระบบไฟล์ */
export function sessionFileName(s) { return String(s && s.id ? s.id : 'session') + '.json'; }

/** ข้อความหนึ่งก้อน */
export function newMessage(role, text, patch = {}) {
  return {
    id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    role, text: String(text ?? ''),
    at: patch.at || new Date().toISOString(),
    usage: patch.usage || null,
    model: patch.model || '',
    provider: patch.provider || '',
    files: patch.files || [],
    error: patch.error || '',
    // [alpha.145] คำอธิบายเต็ม + แนวทางแก้ของความผิดพลาด (ai-error.js) — เก็บลงไฟล์ด้วย
    // เพื่อให้ย้อนดูทีหลังได้ว่ารอบนั้นพังเพราะอะไร
    detail: patch.detail || '',
    // ── ของที่ transcript view ใช้แสดง (ไม่กระทบข้อความที่ส่งให้โมเดล) ──
    thinking: patch.thinking || '',   // ความคิดของโมเดล ถ้า provider ส่งกลับมา
    calls: patch.calls || null,       // คำสั่งที่โมเดลสั่งในข้อความนี้
    results: patch.results || null,   // ผลของคำสั่งเหล่านั้น
    system: patch.system || '',       // system prompt ที่ใช้จริงในรอบนี้ (โหมดละเอียด)
    ms: patch.ms || 0,                // เวลาที่ใช้รอคำตอบ (ms)
    toolResult: !!patch.toolResult,   // ข้อความนี้คือผลคำสั่งที่ป้อนกลับให้โมเดล ไม่ใช่ผู้ใช้พิมพ์เอง
  };
}

/** เพิ่มข้อความ (คืนเซสชันใหม่ · ไม่แก้ของเดิม) */
export function addMessage(session, msg) {
  const s = { ...session, messages: [...(session.messages || []), msg] };
  s.updated = msg.at || new Date().toISOString();
  // ชื่อเซสชันเริ่มต้น = ประโยคแรกที่ผู้ใช้พิมพ์ (แบบ opencode) จนกว่าจะเปลี่ยนชื่อเอง
  // ผลของคำสั่งที่ป้อนกลับให้โมเดลก็ role user เหมือนกัน — ห้ามเอามาตั้งเป็นชื่อเซสชัน
  if (msg.role === 'user' && !msg.toolResult && isAutoTitle(session)) s.title = titleFromText(msg.text);
  return s;
}
function isAutoTitle(s) {
  return !s.titleSet && (!s.title || s.title === t('ui.aiSession.sessionNew'));
}
/** ตัดข้อความแรกให้สั้นพอเป็นชื่อ (ไม่ตัดกลางคำอังกฤษ · ไทยตัดตรง ๆ ได้) */
export function titleFromText(text, max = 40) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return tt('ui.aiSession.sessionNew');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

/** เปลี่ยนชื่อเอง — ตั้ง titleSet ไว้ไม่ให้ถูกทับด้วยชื่ออัตโนมัติอีก */
export function renameSession(session, title) {
  return { ...session, title: String(title || '').trim() || session.title, titleSet: true,
           updated: new Date().toISOString() };
}
export function archiveSession(session, on = true) {
  return { ...session, archived: !!on, updated: new Date().toISOString() };
}

/**
 * [alpha.62 บั๊ก 3] "เริ่มใหม่" — ล้างบทสนทนาแต่เก็บเซสชันเดิมไว้
 *
 * ต่างจาก "สร้างเซสชันใหม่" ตรงที่ **ไฟล์เดิม/ที่อยู่เดิมในรายการยังอยู่**
 * จึงเหมาะกับ "คุยจนบริบทเต็ม/หลงประเด็น แล้วอยากเริ่มนับหนึ่งใหม่ในหัวข้อเดิม"
 * ค่าที่ต้องล้างไปพร้อมกัน: `contextLimit` (เดาจากยอด token ของรอบก่อน — ล้าสมัยทันทีที่ล้างประวัติ)
 * ค่าที่ต้อง **ไม่** ล้าง: โหมด · ระดับการเข้าถึง · โมเดล · ไฟล์แนบ · ชื่อที่ผู้ใช้ตั้งเอง
 * · [alpha.145] ทักษะที่เปิดไว้ (`skills`) และระดับการใช้ความคิด (`effort`)
 * ชื่อที่ระบบตั้งให้เองจากข้อความแรก → คืนเป็นค่าเริ่มต้น เพื่อให้ตั้งใหม่จากคำถามแรกของรอบใหม่ได้
 */
export function clearMessages(session) {
  const s = { ...session, messages: [], contextLimit: 0, updated: new Date().toISOString() };
  if (!session.titleSet) s.title = tt('ui.aiSession.sessionNew');
  return s;
}

// ────────────────────────────────────────────────────────────────
// สถิติของเซสชัน — ตัวเลขที่โผล่บน badge บริบท และในหน้า "รายละเอียด"
// ────────────────────────────────────────────────────────────────
const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

/**
 * รวมยอดทั้งเซสชัน
 * @returns {{input,output,reasoning,cached,total,usd,userMsgs,agentMsgs,limit,percent}}
 */
export function sessionStats(session, { prices = null } = {}) {
  const msgs = (session && session.messages) || [];
  const out = { input: 0, output: 0, reasoning: 0, cached: 0, total: 0, usd: 0,
                userMsgs: 0, agentMsgs: 0, limit: n(session && session.contextLimit), percent: 0 };
  for (const m of msgs) {
    if (m.role === 'user') out.userMsgs++;
    else if (m.role === 'assistant') out.agentMsgs++;
    const u = m.usage;
    if (!u) continue;
    out.input += n(u.input); out.output += n(u.output);
    out.reasoning += n(u.reasoning); out.cached += n(u.cached);
    out.total += n(u.total) || (n(u.input) + n(u.output));
    out.usd += n(u.usd);
  }
  if (prices) out.usd = +costOf(out, prices).toFixed(6);
  else out.usd = +out.usd.toFixed(6);
  // "บริบทที่ใช้อยู่" = token ของคำขอครั้งล่าสุด (input+output) เทียบขีดจำกัดของโมเดล
  const last = [...msgs].reverse().find((m) => m.usage);
  out.context = last ? n(last.usage.input) + n(last.usage.output) : 0;
  out.percent = out.limit > 0 ? Math.min(100, +((out.context / out.limit) * 100).toFixed(1)) : 0;
  return out;
}
/** ราคา USD ต่อ 1M tokens → ต้นทุนจริง */
export function costOf(stats, prices = { in: 0, out: 0 }) {
  return ((n(stats.input) * n(prices.in)) + (n(stats.output) * n(prices.out))) / 1e6;
}

/** ข้อความสั้นบน badge — "12.3k / 200k" หรือ "12.3k" เมื่อยังไม่รู้ขีดจำกัด */
export function contextLabel(stats) {
  const c = compact(stats.context);
  return stats.limit > 0 ? `${c} / ${compact(stats.limit)}` : c;
}
export function compact(v) {
  const x = n(v);
  if (x >= 1e6) return +(x / 1e6).toFixed(1) + 'M';
  if (x >= 1000) return +(x / 1000).toFixed(1) + 'k';
  return String(Math.round(x));
}
export function usd(v) { return '$' + n(v).toFixed(n(v) < 1 ? 4 : 2); }

// ────────────────────────────────────────────────────────────────
// รายการเซสชัน: เรียง · ค้นหา
// ────────────────────────────────────────────────────────────────
/** ใหม่สุดก่อน (ใช้ `updated` เป็นหลัก) */
export function sortSessions(rows) {
  return (rows || []).slice().sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
}
/**
 * ค้นหาเซสชัน — ชื่อ + เนื้อความทุกข้อความ (ตัดคำไม่จำเป็น: ไทยไม่มีช่องว่าง จึงใช้ substring)
 * `includeArchived=false` = ซ่อนอันที่จัดเก็บแล้ว (ยังค้นเจอได้ถ้าเปิดสวิตช์)
 */
export function searchSessions(rows, query, { includeArchived = false } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const base = (rows || []).filter((s) => includeArchived || !s.archived);
  if (!q) return sortSessions(base);
  const hit = base.filter((s) => {
    if (String(s.title || '').toLowerCase().includes(q)) return true;
    return (s.messages || []).some((m) => String(m.text || '').toLowerCase().includes(q));
  });
  return sortSessions(hit);
}

// ────────────────────────────────────────────────────────────────
// ประวัติที่ส่งให้โมเดล
//
// [alpha.129 ข้อ 1] ★ "AI ไม่อ่านแชทเลย มั่วตลอด"
//
// งบเดิมตายตัวที่ 6,000 token ≈ ภาษาไทยแค่ ~18,000 ตัวอักษร — คุยจริงไม่กี่รอบก็เต็ม
// แล้วประวัติต้นบทสนทนาถูกตัดทิ้งเงียบ ๆ โดยผู้ใช้ไม่รู้ตัว (โมเดลสมัยนี้รับ 128k–1M)
// ตอนนี้งบมาจาก `historyBudget()`: ตั้งเองในตั้งค่า > เดาจากขีดจำกัดของโมเดลที่เคยตอบกลับมา
// > ค่าเริ่มต้น 32,000 — และเมื่อยังต้องตัด ต้อง **บอกผู้ใช้** (ดู `buildChatMessages().dropped`)
// ────────────────────────────────────────────────────────────────

/** งบ token เริ่มต้นของประวัติ เมื่อยังไม่รู้ขีดจำกัดของโมเดลและผู้ใช้ไม่ได้ตั้งเอง */
export const DEFAULT_HISTORY_TOKENS = 32000;
/** เก็บข้อความท้ายสุดไว้เท่านี้เสมอ แม้งบไม่พอ (ไม่งั้นโมเดลตอบโดยไม่เห็นคำถามก่อนหน้า) */
export const HISTORY_KEEP_LAST = 4;

/**
 * งบ token สำหรับประวัติของเซสชันนี้
 * @param {object} session เซสชัน (ใช้ `contextLimit` ที่เดาได้จากรอบก่อน)
 * @param {object} meta    `state.meta.ai` — `historyTokens` = ผู้ใช้ตั้งเอง (0/ว่าง = อัตโนมัติ)
 */
export function historyBudget(session, meta = {}) {
  const manual = Number(meta && meta.historyTokens) || 0;
  if (manual > 0) return manual;
  // `contextLimit` เป็นแค่ **ขั้นต่ำที่รู้แน่ว่าโมเดลรับไหว** — มันถูกเดาจากยอด token ที่เคยใช้จริง
  // (`guessLimit`) แล้วขยับขึ้นอย่างเดียว ไม่ใช่ขีดจำกัดจริงของโมเดล
  // → ใช้ "ขยาย" งบได้ แต่ห้ามใช้ **หด**: คุยรอบแรกสั้น ๆ จะเดาเป็น 8,192 → งบ 4,915
  //   ซึ่งแย่กว่า 6,000 ของเดิมเสียอีก = บั๊กเดิมกลับมาในคราบใหม่
  // เหลือที่ให้ system prompt + บริบทโปรเจกต์ + คำตอบ → ใช้ราว 60% ของขีดจำกัดที่รู้
  const lim = Number(session && session.contextLimit) || 0;
  return Math.max(DEFAULT_HISTORY_TOKENS, Math.floor(lim * 0.6));
}

/**
 * ข้อความที่จะส่งให้โมเดล + จำนวนที่ต้องตัดทิ้ง
 * เก็บ "ท้ายสุด" ไว้เสมอ (ตัดจากหัว) เพราะบทสนทนาต่อเนื่องอยู่ท้ายสุด
 * @returns {{messages: Array<{role,content}>, dropped: number, tokens: number}}
 */
export function buildChatMessages(session, opts = {}) {
  const { maxTokens = DEFAULT_HISTORY_TOKENS, estimate = estimateTokens,
          keepLast = HISTORY_KEEP_LAST } = opts;
  const msgs = ((session && session.messages) || []).filter((m) => m.role === 'user' || m.role === 'assistant');
  const out = [];
  let budget = maxTokens;
  let tokens = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const cost = estimate(msgs[i].text);
    // ท้ายสุด `keepLast` ข้อความติดไปเสมอ ต่อให้กินงบเกิน — ขาดแล้วบทสนทนาไม่ต่อเนื่อง
    if (out.length >= Math.max(1, keepLast) && budget - cost < 0) break;
    budget -= cost;
    tokens += cost;
    out.unshift({ role: msgs[i].role, content: msgs[i].text });
  }
  return { messages: out, dropped: msgs.length - out.length, tokens };
}

/** เหมือน `buildChatMessages` แต่คืนเฉพาะรายการข้อความ (ของเดิม · ยังมีที่เรียกอยู่) */
export function chatMessages(session, opts = {}) {
  return buildChatMessages(session, opts).messages;
}
/** ประมาณ token (ไทยกินตัวอักษรต่อ token น้อยกว่าอังกฤษ ~3 vs ~4) */
export function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  const thai = (s.match(/[฀-๿]/g) || []).length;
  return Math.max(1, Math.ceil(thai / 3 + (s.length - thai) / 4));
}

/** JSON ดิบสำหรับปุ่ม "แสดงข้อความดิบ" ในหน้ารายละเอียด */
export function rawJson(session) { return JSON.stringify(session, null, 2); }

/** ข้อความที่เอาไปแชร์ (คัดลอกเป็น Markdown อ่านง่าย) */
export function shareMarkdown(session) {
  const lines = ['# ' + (session.title || tt('ui.aiSession.sessionAI')), ''];
  for (const m of session.messages || []) {
    if (m.role === 'user') lines.push(tt('ui.aiSession.you') + m.text, '');
    else if (m.role === 'assistant') lines.push(tt('ui.aiSession.assistant') + m.text, '');
  }
  return lines.join('\n').trim() + '\n';
}

// ────────────────────────────────────────────────────────────────
// [alpha.129 ข้อ 4] พาร์ส Markdown ของคำตอบโมเดล — "ทำไมไม่เหมือน web ui"
//
// แผงแชทเดิมวางคำตอบเป็น `textContent` ล้วน: หัวข้อเป็น `##` ดิบ ๆ · รายการเป็น `-` ·
// โค้ดปนกับเนื้อความ · **ตัวหนา** โผล่เป็นดอกจัน — โมเดลตอบมาเป็น Markdown เสมอ
// แต่จอไม่แปลให้ ทุกคำตอบเลยอ่านยากกว่าเว็บของเจ้าเดียวกันมาก
//
// ทำไมพาร์สเองแทนที่จะใช้ `mdToHtmlBody` ของ compile.js:
//   คำตอบของโมเดลคือ **ข้อมูลจากภายนอก** ที่เชื่อไม่ได้ ส่วน `inline()` ของ compile.js
//   ประกอบ `<img alt="…" src="…">` โดยไม่ escape เครื่องหมายคำพูด → ยัด onerror= เข้ามาได้
//   ตัวนี้จึงคืน **โครงข้อมูล** ล้วน ๆ ให้ฝั่ง UI สร้าง DOM node เอง (ไม่มี innerHTML เลย)
//   = ปลอดภัยโดยโครงสร้าง และเทสได้ตรง ๆ บน node
// ────────────────────────────────────────────────────────────────

/**
 * แยกข้อความหนึ่งท่อนเป็นชิ้นตัวอักษร (ตัวหนา/เอียง/ขีดฆ่า/โค้ดในบรรทัด)
 * @returns {Array<{t:'text'|'code'|'b'|'i'|'s', v:string}>}
 */
export function parseInlineMd(text) {
  const src = String(text ?? '');
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  // `โค้ด` มาก่อนทุกอย่าง — ข้างในห้ามตีความเป็นตัวหนา/เอียง
  const re = /`([^`\n]+)`|(\*\*|__)(.+?)\2|~~(.+?)~~|(?<![*\w])\*(?!\s)([^*\n]+?)\*(?!\*)|(?<![_\w])_(?!\s)([^_\n]+?)_(?!\w)/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    buf += src.slice(last, m.index);
    flush();
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[3] !== undefined) out.push({ t: 'b', v: m[3] });
    else if (m[4] !== undefined) out.push({ t: 's', v: m[4] });
    else out.push({ t: 'i', v: m[5] !== undefined ? m[5] : m[6] });
    last = m.index + m[0].length;
  }
  buf += src.slice(last);
  flush();
  return out.length ? out : [{ t: 'text', v: '' }];
}

/**
 * แยกคำตอบเป็นบล็อก — หัวข้อ · ย่อหน้า · รายการ · คำพูดยกมา · โค้ด
 * @returns {Array<object>} `{type:'h',level,parts}` · `{type:'p'|'quote',parts}`
 *                          · `{type:'ul'|'ol',items:[parts]}` · `{type:'code',lang,text}`
 *                          · `{type:'hr'}`
 */
export function parseChatMarkdown(text) {
  const lines = String(text ?? '').split('\n');
  const out = [];
  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    out.push({ type: 'p', parts: parseInlineMd(para.join('\n')) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    // ── โค้ดบล็อก: กินไปจนเจอรั้วปิด (ไม่เจอ = กินจนจบข้อความ ไม่ทิ้งเนื้อหา) ──
    const fence = /^\s*(?:```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      flushPara();
      const body = [];
      i++;
      for (; i < lines.length && !/^\s*(?:```|~~~)\s*$/.test(lines[i]); i++) body.push(lines[i]);
      out.push({ type: 'code', lang: fence[1] || '', text: body.join('\n') });
      continue;
    }
    if (!line.trim()) { flushPara(); continue; }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); out.push({ type: 'hr' }); continue; }
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) { flushPara(); out.push({ type: 'h', level: h[1].length, parts: parseInlineMd(h[2].trim()) }); continue; }
    const bq = /^\s*>\s?(.*)$/.exec(line);
    if (bq) { flushPara(); out.push({ type: 'quote', parts: parseInlineMd(bq[1]) }); continue; }
    const ul = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      const prev = out[out.length - 1];
      const item = parseInlineMd((ul || ol)[1]);
      if (prev && prev.type === want) prev.items.push(item);
      else out.push({ type: want, items: [item] });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return out;
}
