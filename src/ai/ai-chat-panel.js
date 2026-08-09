// ai-chat-panel.js — [alpha.61 ข้อ 2] แผงแชท AI แบบ opencode
//
// โครงหน้าจอ 3 ชั้น (สลับกันในแผงเดียว ไม่เปิดหน้าต่างใหม่):
//   A) รายการเซสชัน  — ช่องค้นหา · เซสชันล่าสุด · ปุ่มเพิ่มเซสชันใหม่
//   B) ตัวเซสชัน     — มุมบนซ้าย = ชื่อเซสชัน · มุมบนขวา = ป้ายบริบท (hover เห็นต้นทุน/%/token)
//                      + เมนู ⋯ (เปลี่ยนชื่อ · แชร์ · จัดเก็บ · ลบ)
//   C) รายละเอียด    — กดที่ป้ายบริบทแล้วเข้ามา · มีปุ่มปิดกลับไปเซสชัน · ปุ่มแสดงข้อความดิบ (JSON)
//
// เซสชันเก็บเป็นไฟล์ JSON ใน `<โปรเจกต์>/Sessions/` — เปลี่ยนโปรเจกต์ = เห็นคนละชุด

import { $, el, state, setStatus, log } from '../core.js';
import { ask, confirmBox, popupMenu } from '../ui.js';
import {
  SESSION_DIR, CHAT_MODES, SCOPES, DEFAULT_MODE, DEFAULT_SCOPE, DEFAULT_SEND_KEY,
  TRANSCRIPT_VIEWS, DEFAULT_VIEW, viewDef, modeCap, hasConversation,
  modeDef, scopeLabel, isSendKey, newSession, newMessage, addMessage, renameSession,
  archiveSession, clearMessages, sessionFileName, sessionStats, contextLabel, compact, usd,
  searchSessions, chatMessages, rawJson, shareMarkdown, estimateTokens,
} from './ai-session.js';
import { providerList, providerById, currentProvider, complete, aiMeta } from './ai-provider-ui.js';
import { toolsSystemPrompt, parseToolCalls, stripToolCalls, validateCall, describeCall,
         toolByName, resultsMessage } from './ai-tools.js';
import { runToolCall, touchesProject, refreshAfterActions } from './ai-actions.js';

/** จำนวนรอบสูงสุดที่ยอมให้ AI สั่งคำสั่ง → เห็นผล → สั่งต่อ ในการส่งหนึ่งครั้ง */
const MAX_TOOL_ROUNDS = 5;

// สถานะของแผง (แผงเดียวในแอป — ไม่ต้องแยกอินสแตนซ์)
const S = {
  host: null,
  view: 'list',          // list | session | detail
  sessions: [],          // เซสชันทั้งหมดของโปรเจกต์ที่เปิดอยู่
  cur: null,             // เซสชันที่กำลังเปิด
  query: '',
  showArchived: false,
  sending: false,
  root: null,            // โปรเจกต์ที่โหลดรายการนี้มา (เปลี่ยนโปรเจกต์ = โหลดใหม่)
};

// ────────────────────────────── ที่เก็บไฟล์ ──────────────────────────────
async function sessionsDir() {
  if (!state.root) return null;
  const d = await kapi.join(state.root, SESSION_DIR);
  if (!(await kapi.exists(d))) await kapi.mkdir(d);
  return d;
}
export async function loadSessions(force) {
  if (!state.root) { S.sessions = []; S.root = null; return S.sessions; }
  if (!force && S.root === state.root) return S.sessions;
  S.root = state.root;
  S.sessions = [];
  try {
    const d = await sessionsDir();
    if (!d) return S.sessions;
    for (const f of await kapi.listFiles(d)) {
      if (!/\.json$/i.test(f)) continue;
      try {
        const j = await kapi.readJson(await kapi.join(d, f));
        if (j && j.id) S.sessions.push(newSession(j));
      } catch (e) { log('warn', 'ai-chat: อ่านเซสชันไม่ได้ ' + f, e); }
    }
  } catch (e) { log('warn', 'ai-chat: อ่านโฟลเดอร์เซสชันไม่ได้', e); }
  return S.sessions;
}
/**
 * [alpha.63r4] เขียนไฟล์เซสชัน — แต่ **เฉพาะเมื่อเริ่มคุยจริงแล้ว**
 *
 * ของเดิมกดปุ่ม "เซสชันใหม่" ทีก็เขียนไฟล์ทันทีหนึ่งไฟล์ กดเล่นสิบทีได้ไฟล์เปล่าสิบไฟล์
 * ค้างอยู่ใน Sessions/ ตลอดไป → ตอนนี้เซสชันที่ยังไม่มีข้อความถือเป็น "ฉบับร่าง" อยู่ในหน่วยความจำ
 * เท่านั้น พอผู้ใช้ส่งข้อความแรกถึงจะ "เกิด" ขึ้นจริง (ตอนนั้นชื่อเซสชันถูกตั้งจากข้อความแรกแล้วด้วย)
 *
 * เซสชันที่เคยบันทึกแล้วจะไม่ย้อนกลับไปเป็นฉบับร่างอีก — กด "เริ่มใหม่" จนไม่เหลือข้อความก็ยังอยู่
 */
export async function saveSession(s, { force = false } = {}) {
  if (!s) return false;
  if (s._draft && !force && !hasConversation(s)) return false;   // ยังไม่เริ่มคุย = ยังไม่เขียนไฟล์
  const d = await sessionsDir();
  if (!d) return false;
  delete s._draft;
  const { _draft, ...clean } = s;                                 // ธงภายใน ไม่ต้องลงไฟล์
  await kapi.writeFile(await kapi.join(d, sessionFileName(s)), JSON.stringify(clean, null, 2));
  const i = S.sessions.findIndex((x) => x.id === s.id);
  if (i === -1) S.sessions.push(s); else S.sessions[i] = s;
  return true;
}
/** เซสชันเปล่าที่ยังไม่ถูกเขียนลงดิสก์ */
function draftSession(patch = {}) {
  const s = newSession({ mode: DEFAULT_MODE, scope: DEFAULT_SCOPE, ...patch });
  s._draft = true;
  return s;
}
async function deleteSessionFile(s) {
  const d = await sessionsDir();
  if (!d) return false;
  try { await kapi.remove(await kapi.join(d, sessionFileName(s))); } catch {}
  S.sessions = S.sessions.filter((x) => x.id !== s.id);
  return true;
}

// ────────────────────────────── บริบทที่ AI มองเห็น (ระดับการเข้าถึง) ──────────────────────────────
/**
 * ดึงเนื้อหาของโปรเจกต์ตาม scope ที่เซสชันตั้งไว้
 * project = ทุกฉากทุกเล่ม · book/chapter = เฉพาะสาขานั้น · scene = ไฟล์ที่เปิดอยู่ · none = ไม่ให้เลย
 */
export async function collectScope(session, { maxChars = 24000 } = {}) {
  const scope = session.scope || DEFAULT_SCOPE;
  if (scope === 'none' || !state.root) return '';
  const parts = [];
  const push = async (file, label) => {
    try {
      const raw = await kapi.readFile(file);
      const { parseMdFile } = await import('../md.js');
      parts.push('### ' + label + '\n' + parseMdFile(raw).body);
    } catch {}
  };
  const active = state.active;
  if (scope === 'scene') {
    if (active && active.file && !active.file.startsWith('::')) await push(active.file, active.title || 'ฉากที่เปิดอยู่');
  } else {
    // ระดับที่กว้างกว่าฉาก — เดินโครงโปรเจกต์จริง แล้วกรองตาม "ที่อยู่" ของไฟล์ที่เปิดอยู่
    const here = (active && active.file) || '';
    const sep = here.includes('\\') ? '\\' : '/';
    const upto = (n) => here.split(sep).slice(0, -n).join(sep);
    const prefix = scope === 'project' ? state.root
                 : scope === 'chapter' ? upto(1)          // โฟลเดอร์บท
                 : upto(3);                               // .../Draft/<ฉบับร่าง>/Chapters/<บท>/x.md → เล่ม
    const files = await allMdFiles(state.root);
    for (const f of files) {
      if (prefix && !f.startsWith(prefix)) continue;
      await push(f, f.slice(state.root.length + 1));
      if (parts.join('\n').length > maxChars) break;
    }
  }
  // แนบไฟล์ที่ผู้ใช้เพิ่มเองด้วย 📎 (นอกเหนือจาก scope)
  for (const f of session.files || []) await push(f.path, '📎 ' + (f.name || f.path));
  const text = parts.join('\n\n');
  return text.length > maxChars ? text.slice(0, maxChars) + '\n…(ตัดเพราะยาวเกิน)' : text;
}
async function allMdFiles(root, depth = 0) {
  if (depth > 6) return [];
  const out = [];
  let dirs = [], files = [];
  try { dirs = await kapi.listDirs(root); } catch {}
  try { files = await kapi.listFiles(root); } catch {}
  for (const f of files) if (/\.md$/i.test(f)) out.push(await kapi.join(root, f));
  for (const d of dirs) {
    if (['Snapshots', 'Recycle', 'Images', SESSION_DIR, 'Plugins'].includes(d)) continue;
    out.push(...await allMdFiles(await kapi.join(root, d), depth + 1));
  }
  return out;
}

// ────────────────────────────── entry ──────────────────────────────
export async function renderAIChatPanel(host) {
  S.host = host || $('#ai-chat-body');
  if (!S.host) return null;
  if (!state.root) {
    S.host.innerHTML = '';
    S.host.append(el('div', 'ai-chat-empty dim', 'เปิดโปรเจกต์ก่อน แล้วเซสชันแชทจะถูกเก็บใน Sessions/ ของโปรเจกต์นั้น'));
    return S.host;
  }
  await loadSessions();
  // เซสชันฉบับร่างยังไม่อยู่ใน S.sessions — อย่าเผลอทิ้งตอนวาดแผงใหม่
  if (S.cur && !S.cur._draft) {
    const fresh = S.sessions.find((x) => x.id === S.cur.id);
    S.cur = fresh || null;
  }
  if (!S.cur && S.view !== 'list') S.view = 'list';
  draw();
  return S.host;
}
function draw() {
  const h = S.host;
  if (!h) return;
  h.innerHTML = '';
  h.classList.add('ai-chat');
  if (S.view === 'list') h.append(listView());
  else if (S.view === 'detail') h.append(detailView());
  else h.append(sessionView());
}

// ══════════════════════════ A) รายการเซสชัน ══════════════════════════
function listView() {
  const wrap = el('div', 'ai-chat-list');

  const bar = el('div', 'ai-chat-listbar');
  const q = el('input', 'ai-chat-search');
  q.type = 'search';
  q.placeholder = 'ค้นหาเซสชัน (ชื่อ หรือข้อความในเซสชัน)…';
  q.value = S.query;
  const addBtn = el('button', 'k-ok ai-chat-new', '➕ เซสชันใหม่');
  bar.append(q, addBtn);
  wrap.append(bar);

  const rows = el('div', 'ai-chat-rows');
  wrap.append(rows);

  const arch = el('label', 'ai-chat-archtoggle');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = S.showArchived;
  arch.append(cb, document.createTextNode(' แสดงเซสชันที่จัดเก็บแล้ว'));
  wrap.append(arch);

  function fill() {
    rows.innerHTML = '';
    const list = searchSessions(S.sessions, S.query, { includeArchived: S.showArchived });
    if (!list.length) {
      rows.append(el('div', 'ai-chat-empty dim',
        S.query ? 'ไม่พบเซสชันที่ตรงกับคำค้น' : 'ยังไม่มีเซสชัน — กด "➕ เซสชันใหม่" เพื่อเริ่มคุย'));
      return;
    }
    for (const s of list) rows.append(sessionRow(s));
  }
  q.oninput = () => { S.query = q.value; fill(); };
  cb.onchange = () => { S.showArchived = cb.checked; fill(); };
  addBtn.onclick = () => {
    S.cur = draftSession();          // ยังไม่เขียนไฟล์ — รอข้อความแรกก่อน
    S.view = 'session';
    draw();
  };
  fill();
  return wrap;
}
function sessionRow(s) {
  const row = el('div', 'ai-chat-row');
  if (s.archived) row.classList.add('archived');
  row.dataset.session = s.id;
  const main = el('div', 'ai-chat-row-main');
  main.append(el('div', 'ai-chat-row-title', s.title || 'เซสชัน'));
  const last = [...(s.messages || [])].reverse().find((m) => m.text);
  main.append(el('div', 'ai-chat-row-sub dim',
    last ? String(last.text).replace(/\s+/g, ' ').slice(0, 90) : 'ยังไม่มีข้อความ'));
  const meta = el('div', 'ai-chat-row-meta dim');
  const st = sessionStats(s);
  meta.append(el('span', 'ai-chat-row-date', fmtDate(s.updated)));
  meta.append(el('span', 'ai-chat-row-tok', compact(st.total) + ' tok'));
  row.append(main, meta);
  row.onclick = () => { S.cur = s; S.view = 'session'; draw(); };
  return row;
}
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('th-TH',
      { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

// ══════════════════════════ B) ตัวเซสชัน ══════════════════════════
function sessionView() {
  const s = S.cur;
  const wrap = el('div', 'ai-chat-session');

  // ── หัว: ซ้าย = ชื่อเซสชัน · ขวา = ป้ายบริบท + เมนู ⋯ ──
  const head = el('div', 'ai-chat-head');
  const back = el('button', 'ai-chat-back', '←');
  back.title = 'กลับไปรายการเซสชัน';
  back.onclick = () => { S.view = 'list'; draw(); };
  const title = el('div', 'ai-chat-title', s.title || 'เซสชัน');
  title.title = s.title || '';
  const right = el('div', 'ai-chat-head-right');
  const st = sessionStats(s);
  const badge = el('button', 'ai-chat-ctx', contextLabel(st));
  // hover = ต้นทุน (USD) · การใช้งาน % ของเซสชัน · token ที่ใช้
  badge.title = [
    'ต้นทุน: ' + usd(st.usd),
    'การใช้งาน: ' + (st.limit ? st.percent + '%' : 'ไม่รู้ขีดจำกัดของโมเดล'),
    'โทเค็นที่ใช้: ' + st.total.toLocaleString(),
    '— คลิกเพื่อดูรายละเอียด —',
  ].join('\n');
  badge.onclick = () => { S.view = 'detail'; draw(); };
  // [alpha.62 บั๊ก 3] เริ่มใหม่ — ล้างบทสนทนาของเซสชันนี้ (เซสชันยังอยู่ที่เดิม)
  const restart = el('button', 'ai-chat-restart', '↻');
  restart.title = 'เริ่มใหม่ — ล้างบทสนทนาของเซสชันนี้ (เก็บโหมด/โมเดล/ไฟล์แนบไว้)';
  restart.onclick = () => restartSession(s);
  // [alpha.63r4] มุมมอง transcript — ปกติ / ความคิด / ละเอียด / สรุป
  const viewSel = el('select', 'ai-chat-viewsel');
  for (const v of TRANSCRIPT_VIEWS) {
    const o = el('option', null, v.icon + ' ' + v.label);
    o.value = v.id;
    o.title = v.hint;
    viewSel.append(o);
  }
  viewSel.value = s.view || DEFAULT_VIEW;
  viewSel.title = viewDef(s.view).hint;
  viewSel.onchange = async () => {
    s.view = viewSel.value;
    viewSel.title = viewDef(s.view).hint;
    await saveSession(s);
    draw();
  };
  const more = el('button', 'ai-chat-more', '⋯');
  more.title = 'ตัวเลือกของเซสชัน';
  more.onclick = (e) => sessionMenu(e, s);
  right.append(badge, viewSel, restart, more);
  head.append(back, title, right);
  wrap.append(head);

  // ── ข้อความ ──
  const body = el('div', 'ai-chat-msgs ai-view-' + (s.view || DEFAULT_VIEW));
  if (!(s.messages || []).length) {
    body.append(el('div', 'ai-chat-empty dim',
      'เริ่มคุยได้เลย — โหมด "' + modeDef(s.mode).label + '" · เห็นข้อมูล: ' + scopeLabel(s.scope)
      + (s._draft ? ' · เซสชันจะถูกบันทึกเมื่อส่งข้อความแรก' : '')));
  }
  for (const m of s.messages || []) body.append(msgNode(m, s.view));
  wrap.append(body);

  // ── กล่องพิมพ์ ──
  wrap.append(composer(s, body));
  setTimeout(() => { body.scrollTop = body.scrollHeight; }, 0);
  return wrap;
}
/**
 * วาดข้อความหนึ่งก้อนตามมุมมองที่เลือก
 *   normal   — ข้อความล้วน (ตัดบล็อกคำสั่งออก) + สรุปสั้นว่าทำอะไรไป
 *   thinking — เพิ่มความคิดของโมเดล + รายการคำสั่งพร้อมผล
 *   verbose  — เพิ่ม system prompt, JSON คำสั่งดิบ, ผลดิบ, token, เวลา
 *   summary  — บรรทัดเดียวต่อข้อความ
 */
function msgNode(m, view = DEFAULT_VIEW) {
  // ผลคำสั่งที่ป้อนกลับให้โมเดลไม่ใช่บทสนทนา — โผล่เฉพาะโหมดที่ขอดูเบื้องหลัง
  if (m.toolResult && view !== 'verbose' && view !== 'thinking') return el('span', 'ai-msg-hidden');
  if (m.toolResult) return foldBlock('↩ ผลคำสั่งที่ส่งกลับให้โมเดล', m.text, 'ai-msg-toolresult');
  if (view === 'summary') return summaryNode(m);
  const n = el('div', 'ai-msg ai-msg-' + m.role);
  const who = el('div', 'ai-msg-who dim',
    m.role === 'user' ? 'คุณ' : m.role === 'assistant' ? (m.model ? '🤖 ' + m.model : '🤖 ผู้ช่วย') : m.role);
  // [alpha.62 บั๊ก 3] คัดลอกข้อความทีละก้อน — คำตอบของ AI ส่วนใหญ่เอาไปวางต่อในต้นฉบับ
  // (ลากคลุมเองไม่ได้เพราะแผงลอย/แผง dock กินอีเวนต์เมาส์ไปทำอย่างอื่น)
  const copy = el('button', 'ai-msg-copy', '⧉');
  copy.type = 'button';
  copy.title = 'คัดลอกข้อความนี้';
  copy.onclick = async () => {
    const ok = await copyText(m.text || '');
    copy.textContent = ok ? '✓' : '✕';
    setTimeout(() => { copy.textContent = '⧉'; }, 1200);
  };
  who.append(copy);
  // โหมดปกติ/ความคิด: ซ่อนบล็อก ```k2 เพราะสรุปเป็นบรรทัดอ่านง่ายให้แล้วด้านล่าง
  const shown = view === 'verbose' ? m.text : (m.role === 'assistant' ? stripToolCalls(m.text) : m.text);
  const txt = el('div', 'ai-msg-text', shown);
  n.append(who, txt);
  if (!shown && m.calls && m.calls.length) txt.remove();

  if (view === 'verbose' && m.system) n.append(foldBlock('⚙ system prompt ที่ส่งไปรอบนี้', m.system));
  if ((view === 'thinking' || view === 'verbose') && m.thinking) {
    n.append(foldBlock('🧠 ความคิดของโมเดล', m.thinking, 'ai-msg-thinking'));
  }
  if (m.calls && m.calls.length && view !== 'normal') {
    n.append(callsNode(m.calls, m.results, view));
  } else if (m.calls && m.calls.length) {
    // โหมดปกติ — บอกแค่ว่าทำอะไรไปกี่อย่าง สำเร็จกี่อย่าง
    const okN = (m.results || []).filter((r) => r.ok).length;
    const line = el('div', 'ai-msg-actions dim',
      `⚡ ลงมือทำ ${m.calls.length} คำสั่ง — สำเร็จ ${okN}/${(m.results || []).length || m.calls.length}`);
    n.append(line);
  }
  if (view === 'verbose' && m.usage) {
    n.append(el('div', 'ai-msg-meta dim',
      `token: เข้า ${m.usage.input || 0} · ออก ${m.usage.output || 0}`
      + (m.usage.reasoning ? ` · คิด ${m.usage.reasoning}` : '')
      + (m.usage.cached ? ` · แคช ${m.usage.cached}` : '')
      + (m.ms ? ` · ใช้เวลา ${(m.ms / 1000).toFixed(1)} วิ` : '')
      + (m.at ? ' · ' + fmtDate(m.at) : '')));
  }
  if (m.error) n.append(el('div', 'ai-msg-err', '⚠ ' + m.error));
  if (m.files && m.files.length) {
    n.append(el('div', 'ai-msg-files dim', '📎 ' + m.files.map((f) => f.name || f.path).join(', ')));
  }
  return n;
}

/** บรรทัดเดียวต่อข้อความ — มุมมอง "สรุป" */
function summaryNode(m) {
  if (m.toolResult) return el('span', 'ai-msg-hidden');
  const n = el('div', 'ai-sum ai-sum-' + m.role);
  const icon = m.role === 'user' ? '🙋' : m.error ? '⚠' : '🤖';
  const body = m.error ? m.error
    : (m.calls && m.calls.length && !stripToolCalls(m.text)
        ? m.calls.map(describeCall).join(' · ')
        : String(m.text || '').replace(/\s+/g, ' ').trim() || '(ว่าง)');
  n.append(el('span', 'ai-sum-icon', icon));
  const t = el('span', 'ai-sum-text', body.length > 120 ? body.slice(0, 119) + '…' : body);
  t.title = m.text || m.error || '';
  n.append(t);
  if (m.calls && m.calls.length) n.append(el('span', 'ai-sum-tag dim', '⚡' + m.calls.length));
  if (m.usage && m.usage.total) n.append(el('span', 'ai-sum-tok dim', compact(m.usage.total)));
  return n;
}

/** กล่องพับได้ — ใช้กับ system prompt / ความคิด / JSON ดิบ */
function foldBlock(label, text, cls = '') {
  const box = el('details', 'ai-fold ' + cls);
  const sum = el('summary', 'ai-fold-sum dim', label);
  const pre = el('pre', 'ai-fold-pre', String(text || ''));
  box.append(sum, pre);
  return box;
}

/** รายการคำสั่งที่ AI สั่ง + ผลของแต่ละอัน */
function callsNode(calls, results, view) {
  const box = el('div', 'ai-calls');
  box.append(el('div', 'ai-calls-head dim', '⚡ คำสั่งที่ลงมือทำ (' + calls.length + ')'));
  calls.forEach((c, i) => {
    const r = (results || [])[i];
    const row = el('div', 'ai-call' + (r ? (r.ok ? ' ok' : ' bad') : ''));
    row.append(el('span', 'ai-call-icon', r ? (r.ok ? '✓' : '✕') : '·'));
    row.append(el('span', 'ai-call-desc', describeCall(c)));
    if (r && (r.message || r.error)) row.append(el('span', 'ai-call-msg dim', r.error || r.message));
    box.append(row);
    if (view === 'verbose') {
      box.append(foldBlock('JSON ที่โมเดลสั่ง', JSON.stringify({ tool: c.tool, args: c.args }, null, 2)));
      if (r && r.data !== undefined && r.data !== null) {
        box.append(foldBlock('ผลที่ส่งกลับให้โมเดล',
          typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2)));
      }
    }
  });
  return box;
}

function composer(s, body) {
  const box = el('div', 'ai-chat-composer');

  // แถวควบคุม: 📎 ไฟล์ · โหมด · โมเดล (override) · ระดับการเข้าถึง
  const ctrls = el('div', 'ai-chat-ctrls');
  const fileBtn = el('button', 'ai-chat-file', '📎');
  fileBtn.title = 'เพิ่มไฟล์เข้าบริบทของเซสชันนี้';
  const modeSel = el('select', 'ai-chat-mode');
  for (const m of CHAT_MODES) { const o = el('option', null, m.icon + ' ' + m.label); o.value = m.id; modeSel.append(o); }
  modeSel.value = s.mode || DEFAULT_MODE;
  modeSel.title = 'โหมดการทำงาน\n'
    + '📖 วางแผน — อ่านโปรเจกต์ได้ แต่ไม่แตะไฟล์\n'
    + '✍️ ช่วยเขียน — สร้าง/แก้ เล่ม บท ฉาก เอนทิตี้ ได้จริง (ลบไม่ได้)\n'
    + '🔓 ปลดล็อกเต็มที่ — ทำได้ทุกอย่างรวมทั้งลบ (ของไปถังขยะ กู้คืนได้)';

  // โมเดลของเซสชัน = **override จากตั้งค่า** แยกกันเป็นอิสระ
  const modelSel = el('select', 'ai-chat-model');
  modelSel.title = 'โมเดลของเซสชันนี้ — ทับค่าที่ตั้งไว้ในตั้งค่า AI (อิสระต่อกัน)';
  const scopeSel = el('select', 'ai-chat-scope');
  for (const sc of SCOPES) { const o = el('option', null, sc.label); o.value = sc.id; scopeSel.append(o); }
  scopeSel.value = s.scope || DEFAULT_SCOPE;
  scopeSel.title = 'ระดับการเข้าถึง — AI จะเห็นเนื้อหาแค่ระดับนี้';
  ctrls.append(fileBtn, modeSel, modelSel, scopeSel);
  box.append(ctrls);

  fillModelSelect(modelSel, s);

  const filesRow = el('div', 'ai-chat-files dim');
  const drawFiles = () => {
    filesRow.innerHTML = '';
    filesRow.style.display = (s.files || []).length ? '' : 'none';
    for (const f of s.files || []) {
      const chip = el('span', 'ai-chat-filechip', '📎 ' + (f.name || f.path));
      const x = el('span', 'ai-chat-filex', '×');
      x.onclick = async () => {
        s.files = s.files.filter((y) => y.path !== f.path);
        await saveSession(s); drawFiles();
      };
      chip.append(x);
      filesRow.append(chip);
    }
  };
  drawFiles();
  box.append(filesRow);

  // แถวพิมพ์ + ปุ่มส่ง
  const inputRow = el('div', 'ai-chat-inputrow');
  const ta = el('textarea', 'ai-chat-input');
  ta.rows = 3;
  const sendKey = aiMeta().sendKey || DEFAULT_SEND_KEY;
  ta.placeholder = sendKey === 'shift-enter'
    ? 'พิมพ์ข้อความ… (Shift+Enter = ส่ง · Enter = ขึ้นบรรทัด)'
    : 'พิมพ์ข้อความ… (Enter = ส่ง · Shift+Enter = ขึ้นบรรทัด)';
  const sendBtn = el('button', 'k-ok ai-chat-send', 'ส่ง');
  sendBtn.title = 'ปุ่มส่งตั้งได้ที่ ไฟล์ → ตั้งค่า AI';
  inputRow.append(ta, sendBtn);
  box.append(inputRow);

  modeSel.onchange = async () => { s.mode = modeSel.value; await saveSession(s); };
  scopeSel.onchange = async () => { s.scope = scopeSel.value; await saveSession(s); };
  modelSel.onchange = async () => {
    const [pid, model] = String(modelSel.value).split(' ');
    s.providerId = pid || ''; s.model = model || '';
    await saveSession(s);
  };
  fileBtn.onclick = async () => {
    const p = await (kapi.openFileDialog ? kapi.openFileDialog() : null);
    if (!p) { setStatus('เลือกไฟล์ไม่สำเร็จ'); return; }
    s.files = [...(s.files || []), { path: p, name: String(p).replace(/^.*[\\/]/, '') }];
    await saveSession(s); drawFiles();
  };

  const doSend = () => send(s, ta, body, sendBtn);
  sendBtn.onclick = doSend;
  ta.onkeydown = (e) => {
    if (!isSendKey(e, aiMeta().sendKey || DEFAULT_SEND_KEY)) return;
    e.preventDefault();
    doSend();
  };
  setTimeout(() => ta.focus(), 0);
  return box;
}

function fillModelSelect(sel, s) {
  sel.innerHTML = '';
  const provs = providerList();
  const dflt = el('option', null, '(ตามตั้งค่า AI)');
  dflt.value = '';
  sel.append(dflt);
  for (const p of provs) {
    const models = p.models && p.models.length ? p.models : (p.model ? [p.model] : []);
    if (!models.length) continue;
    const g = el('optgroup');
    g.label = p.name;
    for (const m of models) {
      const o = el('option', null, m);
      o.value = p.id + ' ' + m;
      g.append(o);
    }
    sel.append(g);
  }
  sel.value = s.providerId && s.model ? s.providerId + ' ' + s.model : '';
}

// ── ส่งข้อความ ──
async function send(s, ta, body, sendBtn) {
  const text = String(ta.value || '').trim();
  if (!text || S.sending) return;
  const prov = s.providerId ? await providerById(s.providerId) : await currentProvider();
  if (!prov) {
    setStatus('❌ ยังไม่ได้ตั้งค่าผู้ให้บริการ AI — ไฟล์ → ตั้งค่า AI');
    return;
  }
  S.sending = true;
  sendBtn.disabled = true;
  ta.value = '';

  const view = S.cur ? (S.cur.view || DEFAULT_VIEW) : DEFAULT_VIEW;
  const userMsg = newMessage('user', text, { files: (s.files || []).slice() });
  S.cur = addMessage(s, userMsg);
  // ข้อความแรก = เซสชันเกิดจริง (addMessage ตั้งชื่อจากข้อความนี้ให้แล้ว) → บันทึกลงไฟล์ตอนนี้
  await saveSession(S.cur);
  body.append(msgNode(userMsg, view));
  const pend = el('div', 'ai-msg ai-msg-assistant ai-msg-pending');
  const pendWho = el('div', 'ai-msg-who dim', '🤖 กำลังคิด…');
  pend.append(pendWho);
  body.append(pend);
  body.scrollTop = body.scrollHeight;

  const md = modeDef(S.cur.mode);
  const cap = modeCap(S.cur.mode);
  let system = md.system;
  const tp = toolsSystemPrompt(cap);
  if (tp) system += '\n\n' + tp;
  try {
    const ctx = await collectScope(S.cur);
    if (ctx) system += '\n\nข้อมูลจากโปรเจกต์ (ระดับการเข้าถึง: ' + scopeLabel(S.cur.scope) + '):\n' + ctx;
  } catch (e) { log('warn', 'ai-chat: รวบรวมบริบทไม่สำเร็จ', e); }

  // ── วนรอบ: ถาม → โมเดลสั่งคำสั่ง → ทำจริง → ส่งผลกลับ → ถามต่อ ──
  let res = null;
  let touched = false;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const t0 = Date.now();
    res = await complete(prov, { system, messages: chatMessages(S.cur), model: s.model || undefined });
    const ms = Date.now() - t0;

    const calls = res.ok ? parseToolCalls(res.text) : [];
    const reply = res.ok
      ? newMessage('assistant', res.text, { usage: res.usage, model: res.model, provider: res.provider,
                                            thinking: res.thinking, system, ms,
                                            calls: calls.length ? calls : null })
      : newMessage('assistant', '', { error: res.error || 'เรียก AI ไม่สำเร็จ', system, ms });

    if (res.ok && res.usage) {
      const used = (res.usage.input || 0) + (res.usage.output || 0);
      S.cur.contextLimit = Math.max(S.cur.contextLimit || 0, guessLimit(used));
    }
    recordUsage(res, prov, s);

    if (!calls.length) {                          // ไม่มีคำสั่ง = จบรอบ
      S.cur = addMessage(S.cur, reply);
      await saveSession(S.cur);
      pend.remove();
      body.append(msgNode(reply, view));
      break;
    }

    pendWho.textContent = '⚡ กำลังลงมือทำ ' + calls.length + ' คำสั่ง…';
    const results = await runCalls(calls, S.cur, cap);
    reply.results = results;
    touched = touched || touchesProject(results);
    S.cur = addMessage(S.cur, reply);
    // ผลของคำสั่งกลับเข้าบทสนทนาในนามผู้ใช้ — โมเดลอ่านต่อได้ในรอบถัดไป
    S.cur = addMessage(S.cur, newMessage('user', resultsMessage(results), { toolResult: true }));
    await saveSession(S.cur);
    body.append(msgNode(reply, view));
    body.scrollTop = body.scrollHeight;

    if (results.some((r) => r.cancelled)) {       // ผู้ใช้กดยกเลิก = หยุดทั้งชุด
      pend.remove();
      break;
    }
    if (round === MAX_TOOL_ROUNDS - 1) {
      pend.remove();
      body.append(el('div', 'ai-chat-empty dim',
        `หยุดที่ ${MAX_TOOL_ROUNDS} รอบเพื่อกันวนไม่จบ — พิมพ์ "ทำต่อ" ถ้ายังไม่เสร็จ`));
    } else {
      pendWho.textContent = '🤖 กำลังคิดต่อ…';
    }
  }
  if (touched) await refreshAfterActions();

  S.sending = false;
  sendBtn.disabled = false;
  body.scrollTop = body.scrollHeight;
  // ชื่อเซสชันอาจเพิ่งถูกตั้งจากข้อความแรก → วาดหัวใหม่
  const t = S.host && S.host.querySelector('.ai-chat-title');
  if (t) t.textContent = S.cur.title;
  const badge = S.host && S.host.querySelector('.ai-chat-ctx');
  if (badge) {
    const st2 = sessionStats(S.cur);
    badge.textContent = contextLabel(st2);
    badge.title = ['ต้นทุน: ' + usd(st2.usd),
                   'การใช้งาน: ' + (st2.limit ? st2.percent + '%' : 'ไม่รู้ขีดจำกัดของโมเดล'),
                   'โทเค็นที่ใช้: ' + st2.total.toLocaleString(),
                   '— คลิกเพื่อดูรายละเอียด —'].join('\n');
  }
  if (!res.ok) setStatus('❌ AI: ' + (res.error || ''));
}
/**
 * ลงมือทำคำสั่งทั้งชุดตามลำดับ
 *
 * การยืนยัน: คำสั่งที่ "ลบของ" จะถามก่อนเสมอ เว้นแต่ผู้ใช้ปิด `confirmDestructive` เอง
 * ส่วนคำสั่งสร้าง/แก้ ทำเลยเมื่อ `autoRun` เปิดอยู่ (ค่าเริ่มต้น) — ไม่งั้นถามทีละอัน
 * ผู้ใช้กดยกเลิกครั้งเดียว = หยุดทั้งชุด (ครึ่ง ๆ กลาง ๆ อันตรายกว่าไม่ทำเลย)
 */
async function runCalls(calls, session, cap) {
  const results = [];
  let stopped = false;
  for (const c of calls) {
    if (stopped) { results.push({ tool: c.tool, ok: false, cancelled: true, error: 'ยกเลิกทั้งชุด' }); continue; }
    const v = validateCall(c, cap);
    if (!v.ok) { results.push({ tool: c.tool || '(ไม่ระบุ)', ok: false, error: v.error }); continue; }
    const def = toolByName(c.tool);
    const needAsk = def.destructive
      ? session.confirmDestructive !== false
      : session.autoRun === false;
    if (needAsk) {
      const okGo = await confirmBox(
        (def.destructive ? '⚠ AI ขอลบของในโปรเจกต์:\n\n' : 'AI ขอลงมือทำ:\n\n') + describeCall(c),
        def.destructive ? 'ลบเลย' : 'ทำเลย');
      if (!okGo) {
        results.push({ tool: c.tool, ok: false, cancelled: true, error: 'ผู้ใช้ไม่อนุญาต' });
        stopped = true;
        continue;
      }
    }
    results.push(await runToolCall(c));
  }
  return results;
}

/** ขีดจำกัดที่พบบ่อย — เลือกอันเล็กสุดที่ยังใหญ่กว่ายอดที่ใช้จริง */
function guessLimit(used) {
  for (const L of [8192, 16384, 32768, 65536, 128000, 200000, 1000000]) if (used <= L) return L;
  return used;
}
function recordUsage(res, prov, s) {
  if (!state.meta || !res.ok || !res.usage) return;
  const ai = aiMeta();
  const list = ai.usage || [];
  list.push({ date: new Date().toISOString(), tokens: res.usage.total || 0,
              in: res.usage.input || 0, out: res.usage.output || 0,
              provider: prov.name, model: res.model, feature: 'chat', session: s.id });
  if (list.length > 500) list.splice(0, list.length - 500);
  ai.usage = list;
}

/**
 * [alpha.62 บั๊ก 3] คัดลอกข้อความลงคลิปบอร์ด
 * `navigator.clipboard` ใน Electron ต้องการหน้าต่างที่โฟกัสอยู่ — แผงลอยที่เพิ่งถูกคลิก
 * บางจังหวะยังไม่ได้โฟกัส แล้วเมท็อดนี้ reject เงียบ ๆ → มีทางสำรองด้วย textarea + execCommand
 */
export async function copyText(text) {
  const s = String(text ?? '');
  if (!s) return false;
  // main process ก่อน — ไม่ต้องพึ่งโฟกัสของหน้าต่าง
  try { if (kapi.clipboardWrite && await kapi.clipboardWrite(s)) return true; } catch {}
  try { await navigator.clipboard.writeText(s); return true; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/** [alpha.62 บั๊ก 3] เริ่มใหม่ — ถามก่อนแล้วล้างบทสนทนา (เซสชันยังอยู่ที่เดิม) */
export async function restartSession(s, { confirm = true } = {}) {
  const target = s || S.cur;
  if (!target) return null;
  if (confirm && (target.messages || []).length
      && !(await confirmBox(`เริ่มใหม่ — ล้างบทสนทนา ${(target.messages || []).length} ข้อความของ "${target.title}" ?`))) {
    return null;
  }
  S.cur = clearMessages(target);
  await saveSession(S.cur);
  S.view = 'session';
  draw();
  setStatus('เริ่มบทสนทนาใหม่แล้ว (เก็บโหมด/โมเดล/ไฟล์แนบไว้)');
  return S.cur;
}

// ── เมนู ⋯ ──
function sessionMenu(ev, s) {
  popupMenu(ev.clientX, ev.clientY, [
    { label: '↻ เริ่มใหม่ (ล้างบทสนทนา)', click: () => restartSession(s) },
    { label: '⧉ คัดลอกบทสนทนาทั้งหมด', click: async () => {
      setStatus(await copyText(shareMarkdown(s)) ? 'คัดลอกบทสนทนาแล้ว' : 'คัดลอกไม่สำเร็จ');
    } },
    '-',
    // [alpha.63r4] สิทธิ์ลงมือทำของ AI — ตั้งแยกรายเซสชัน
    { label: (s.autoRun === false ? '☐' : '☑') + ' ทำคำสั่งเองโดยไม่ต้องถาม', click: async () => {
      s.autoRun = s.autoRun === false;
      await saveSession(s);
      setStatus(s.autoRun ? 'AI จะลงมือทำเองโดยไม่ถาม (ยกเว้นคำสั่งลบ)' : 'AI จะถามก่อนทุกคำสั่ง');
    } },
    { label: (s.confirmDestructive === false ? '☐' : '☑') + ' ถามก่อนเสมอเมื่อจะลบของ', click: async () => {
      if (s.confirmDestructive !== false) {
        const okGo = await confirmBox(
          'ปิดการถามก่อนลบ?\n\nAI จะลบเล่ม/บท/ฉาก/เอนทิตี้ได้เองทันทีโดยไม่ถามคุณอีก\n'
          + '(ของยังไปถังขยะ กู้คืนได้ แต่จะไม่มีจังหวะให้ทัดทาน)', 'ปิดการถาม');
        if (!okGo) return;
      }
      s.confirmDestructive = s.confirmDestructive === false;
      await saveSession(s);
      setStatus(s.confirmDestructive ? 'จะถามก่อนลบเสมอ' : '⚠ ปลดล็อกเต็มที่ — AI ลบของได้เองโดยไม่ถาม');
    } },
    '-',
    { label: '✎ เปลี่ยนชื่อ', click: async () => {
      const v = await ask('ชื่อเซสชัน', { value: s.title });
      if (v === null) return;
      S.cur = renameSession(s, v);
      await saveSession(S.cur, { force: true }); draw();
    } },
    { label: '↗ แชร์ (คัดลอกเป็น Markdown)', click: async () => {
      setStatus(await copyText(shareMarkdown(s)) ? 'คัดลอกบทสนทนาแล้ว' : 'คัดลอกไม่สำเร็จ');
    } },
    { label: s.archived ? '📤 เอาออกจากที่จัดเก็บ' : '📥 จัดเก็บ', click: async () => {
      S.cur = archiveSession(s, !s.archived);
      await saveSession(S.cur);
      S.view = 'list'; draw();
      setStatus(S.cur.archived ? 'จัดเก็บเซสชันแล้ว' : 'เอาเซสชันออกจากที่จัดเก็บแล้ว');
    } },
    '-',
    { label: '🗑 ลบเซสชันนี้', click: async () => {
      if (!(await confirmBox(`ลบเซสชัน "${s.title}" ?`))) return;
      await deleteSessionFile(s);
      S.cur = null; S.view = 'list'; draw();
      setStatus('ลบเซสชันแล้ว');
    } },
  ]);
}

// ══════════════════════════ C) รายละเอียดบริบท ══════════════════════════
function detailView() {
  const s = S.cur;
  const st = sessionStats(s);
  const wrap = el('div', 'ai-chat-detail');

  const head = el('div', 'ai-chat-head');
  head.append(el('div', 'ai-chat-title', 'รายละเอียดบริบท'));
  const closeBtn = el('button', 'ai-chat-close', '✕');
  closeBtn.title = 'ปิด — กลับไปที่เซสชัน';
  closeBtn.onclick = () => { S.view = 'session'; draw(); };
  const hr = el('div', 'ai-chat-head-right');
  hr.append(closeBtn);
  head.append(hr);
  wrap.append(head);

  const prov = providerList().find((p) => p.id === s.providerId);
  const lastAssistant = [...(s.messages || [])].reverse().find((m) => m.role === 'assistant' && m.model);
  const rows = [
    ['ชื่อเซสชัน', s.title || '—'],
    ['ข้อความในเซสชัน', (s.messages || []).length.toLocaleString() + ' ข้อความ'],
    ['ผู้ให้บริการ', prov ? prov.name : (lastAssistant && lastAssistant.provider) || '(ตามตั้งค่า AI)'],
    ['โมเดล', s.model || (lastAssistant && lastAssistant.model) || '(ตามตั้งค่า AI)'],
    ['ขีดจำกัด', st.limit ? st.limit.toLocaleString() + ' tokens' : 'ไม่ทราบ'],
    ['โทเค็นที่ใช้', st.total.toLocaleString()],
    ['การใช้งาน', st.limit ? st.percent + '%' : '—'],
    ['โทเค็นนำเข้า', st.input.toLocaleString()],
    ['โทเค็นส่งออก', st.output.toLocaleString()],
    ['โทเค็นแบบใช้เหตุผล', st.reasoning.toLocaleString()],
    ['โทเค็นแคช', st.cached.toLocaleString()],
    ['จำนวนข้อความผู้ใช้', String(st.userMsgs)],
    ['จำนวนข้อความผู้ช่วย', String(st.agentMsgs)],
    ['ต้นทุน (USD)', usd(st.usd)],
    ['วันที่สร้างเซสชัน', fmtDate(s.created)],
    ['ใช้งานล่าสุด', fmtDate(s.updated)],
    ['โหมด', modeDef(s.mode).label],
    ['ระดับการเข้าถึง', scopeLabel(s.scope)],
  ];
  const table = el('div', 'ai-detail-grid');
  for (const [k, v] of rows) {
    table.append(el('div', 'ai-detail-k dim', k));
    table.append(el('div', 'ai-detail-v', v));
  }
  wrap.append(table);

  const rawBtn = el('button', 'ai-detail-raw', '{ } แสดงข้อความดิบ (JSON)');
  const pre = el('pre', 'ai-detail-json');
  pre.style.display = 'none';
  pre.textContent = rawJson(s);
  rawBtn.onclick = () => {
    const on = pre.style.display === 'none';
    pre.style.display = on ? '' : 'none';
    rawBtn.classList.toggle('on', on);
  };
  wrap.append(rawBtn, pre);
  return wrap;
}

// ────────────────────────────── ทางเข้าจากภายนอก ──────────────────────────────
/** เปิดแผงแล้วเริ่มเซสชันใหม่ทันที (เมนู AI → แชท) */
export async function newChatSession() {
  await loadSessions(true);
  const s = draftSession();          // ยังไม่เขียนไฟล์ — เกิดจริงตอนส่งข้อความแรก
  S.cur = s; S.view = 'session';
  draw();
  return s;
}
/** สำหรับ selftest — เข้าถึงสถานะภายในโดยไม่ต้องผ่าน DOM */
export function _chatState() { return S; }
export { estimateTokens };
