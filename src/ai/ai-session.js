// ai-session.js — [alpha.61 ข้อ 2] เซสชันแชท AI แบบ opencode (โมดูลบริสุทธิ์)
//
// เซสชันเก็บเป็นไฟล์ JSON ในโฟลเดอร์ `Sessions/` **ของโปรเจกต์นั้น ๆ** เพื่อให้
//   · เปิดโปรเจกต์ไหน ก็เห็นบทสนทนาของโปรเจกต์นั้น (ไม่ปนกัน)
//   · ก๊อปโฟลเดอร์โปรเจกต์ไปเครื่องอื่น บทสนทนาไปด้วย
//   · แก้/ลบนอกโปรแกรมได้ ตามหลัก "ไฟล์แก้นอกโปรแกรมได้" ของ Killian
//
// ไฟล์นี้ไม่แตะ DOM/fs/network — เป็นแค่โครงข้อมูล + การคำนวณสถิติ → unit test ได้ตรง ๆ

import { T } from '../i18n.js';
export const SESSION_DIR = 'Sessions';
export const SESSION_VERSION = 1;

// โหมดการทำงานของผู้ช่วย (ผู้ใช้สลับได้ที่กล่องพิมพ์)
// `cap` = สิทธิ์ที่ส่งให้ ai-tools.js ตัดสินว่าคำสั่งไหนเรียกได้ ('read' | 'write' | 'full')
export const CHAT_MODES = [
  { id: 'plan',  label: T`วางแผน (อ่านอย่างเดียว)`, icon: '📖', write: false, cap: 'read',
    system: T`คุณเป็นผู้ช่วยนักเขียน โหมดนี้คือ "อ่านอย่างเดียว" — วิเคราะห์ เสนอแนะ วางแผนได้ ` +
            T`อ่านโปรเจกต์ได้ด้วยคำสั่งอ่าน แต่ห้ามแก้ไขหรือสร้างไฟล์ ` +
            T`ถ้าผู้ใช้ขอให้แก้ ให้เสนอเป็นข้อความว่าจะแก้อย่างไรแทน` },
  { id: 'write', label: T`ช่วยเขียน (สร้าง/แก้ได้)`, icon: '✍️', write: true, cap: 'write',
    system: T`คุณเป็นผู้ช่วยนักเขียน โหมดนี้สร้างและแก้ไฟล์ในโปรเจกต์ได้จริงผ่านคำสั่งด้านล่าง ` +
            T`แต่ลบของไม่ได้ เขียนต่อเนื้อเรื่องให้กลมกลืนกับสำนวนเดิม และบอกทุกครั้งว่าจะแตะไฟล์ไหน` },
  { id: 'agent', label: T`ปลดล็อกเต็มที่ (ทำได้ทุกอย่าง)`, icon: '🔓', write: true, cap: 'full',
    system: T`คุณเป็นผู้ช่วยนักเขียนที่ลงมือทำเองได้เต็มที่ — สร้าง แก้ ลบ อะไรก็ได้ในโปรเจกต์นี้ ` +
            T`ผ่านคำสั่งด้านล่าง ทำงานให้จบเป็นเรื่อง ๆ ไม่ต้องถามกลับทุกขั้น ` +
            T`แต่ก่อนลบของ ให้บอกเหตุผลสั้น ๆ เสมอ และเขียนต่อเนื้อเรื่องให้กลมกลืนกับสำนวนเดิม` },
];
export const DEFAULT_MODE = 'plan';
export function modeDef(id) { return CHAT_MODES.find((m) => m.id === id) || CHAT_MODES[0]; }
/** สิทธิ์ของโหมด — ai-tools.js ใช้ค่านี้ */
export function modeCap(id) { return modeDef(id).cap || 'read'; }

// มุมมอง transcript — เปลี่ยนได้ที่หัวเซสชัน มีผลกับการแสดงผลเท่านั้น (ไม่กระทบข้อมูล)
export const TRANSCRIPT_VIEWS = [
  { id: 'normal',   label: T`ปกติ`,       icon: '💬',
    hint: T`เฉพาะบทสนทนา — ซ่อนบล็อกคำสั่งและเบื้องหลังทั้งหมด` },
  { id: 'thinking', label: T`ความคิด`,     icon: '🧠',
    hint: T`บทสนทนา + ความคิดของโมเดล (ถ้าเจ้านั้นส่งกลับมา) + คำสั่งที่สั่งทำ` },
  { id: 'verbose',  label: T`ละเอียด`,     icon: '🔍',
    hint: T`ทุกอย่าง — system prompt, บริบทที่ส่งไป, คำสั่งดิบ, ผลลัพธ์, token, เวลา` },
  { id: 'summary',  label: T`สรุป`,        icon: '📋',
    hint: T`ย่อเหลือบรรทัดเดียวต่อข้อความ — ไล่ดูบทสนทนายาว ๆ ได้เร็ว` },
];
export const DEFAULT_VIEW = 'normal';
export function viewDef(id) { return TRANSCRIPT_VIEWS.find((v) => v.id === id) || TRANSCRIPT_VIEWS[0]; }

// ระดับการเข้าถึงข้อมูลของโปรเจกต์ที่ยอมให้ AI เห็น
export const SCOPES = [
  { id: 'project', label: T`ทั้งโปรเจกต์` },
  { id: 'book',    label: T`เฉพาะเล่มนี้` },
  { id: 'chapter', label: T`เฉพาะบทนี้` },
  { id: 'scene',   label: T`เฉพาะฉากนี้` },
  { id: 'none',    label: T`ไม่ให้เข้าถึงเลย` },
];
export const DEFAULT_SCOPE = 'scene';
export function scopeLabel(id) { return (SCOPES.find((s) => s.id === id) || SCOPES[0]).label; }

// ปุ่มส่งข้อความ — ผู้ใช้เลือกได้ในตั้งค่า (บางคนพิมพ์หลายบรรทัดเป็นหลัก)
export const SEND_KEYS = [
  { id: 'enter',       label: T`Enter = ส่ง · Shift+Enter = ขึ้นบรรทัด` },
  { id: 'shift-enter', label: T`Shift+Enter = ส่ง · Enter = ขึ้นบรรทัด` },
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
    title: patch.title || T`เซสชันใหม่`,
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
  return !s.titleSet && (!s.title || s.title === 'เซสชันใหม่');
}
/** ตัดข้อความแรกให้สั้นพอเป็นชื่อ (ไม่ตัดกลางคำอังกฤษ · ไทยตัดตรง ๆ ได้) */
export function titleFromText(text, max = 40) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return T`เซสชันใหม่`;
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
 * ชื่อที่ระบบตั้งให้เองจากข้อความแรก → คืนเป็นค่าเริ่มต้น เพื่อให้ตั้งใหม่จากคำถามแรกของรอบใหม่ได้
 */
export function clearMessages(session) {
  const s = { ...session, messages: [], contextLimit: 0, updated: new Date().toISOString() };
  if (!session.titleSet) s.title = T`เซสชันใหม่`;
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

/**
 * ข้อความที่จะส่งให้โมเดล — ตัดประวัติเก่าทิ้งเมื่อยาวเกินงบ token
 * เก็บ "คู่ล่าสุด" ไว้เสมอ (ตัดจากหัว) เพราะบทสนทนาต่อเนื่องอยู่ท้ายสุด
 */
export function chatMessages(session, { maxTokens = 6000, estimate = estimateTokens } = {}) {
  const msgs = (session.messages || []).filter((m) => m.role === 'user' || m.role === 'assistant');
  const out = [];
  let budget = maxTokens;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const cost = estimate(msgs[i].text);
    if (out.length && budget - cost < 0) break;
    budget -= cost;
    out.unshift({ role: msgs[i].role, content: msgs[i].text });
  }
  return out;
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
  const lines = ['# ' + (session.title || T`เซสชัน AI`), ''];
  for (const m of session.messages || []) {
    if (m.role === 'user') lines.push(T`**คุณ:** ` + m.text, '');
    else if (m.role === 'assistant') lines.push(T`**ผู้ช่วย:** ` + m.text, '');
  }
  return lines.join('\n').trim() + '\n';
}
