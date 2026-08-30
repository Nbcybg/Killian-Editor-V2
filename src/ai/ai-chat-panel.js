// ai-chat-panel.js — [alpha.61 ข้อ 2] แผงแชท AI แบบ opencode
//
// โครงหน้าจอ 3 ชั้น (สลับกันในแผงเดียว ไม่เปิดหน้าต่างใหม่):
//   A) รายการเซสชัน  — ช่องค้นหา · เซสชันล่าสุด · ปุ่มเพิ่มเซสชันใหม่
//   B) ตัวเซสชัน     — มุมบนซ้าย = ชื่อเซสชัน · มุมบนขวา = ป้ายบริบท (hover เห็นต้นทุน/%/token)
//                      + เมนู ⋯ (เปลี่ยนชื่อ · แชร์ · จัดเก็บ · ลบ)
//   C) รายละเอียด    — กดที่ป้ายบริบทแล้วเข้ามา · มีปุ่มปิดกลับไปเซสชัน · ปุ่มแสดงข้อความดิบ (JSON)
//
// เซสชันเก็บเป็นไฟล์ JSON ใน `<โปรเจกต์>/Sessions/` — เปลี่ยนโปรเจกต์ = เห็นคนละชุด

import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { $, el, state, setStatus, log } from '../core.js';
import { ask, confirmBox, popupMenu } from '../ui.js';
import {
  SESSION_DIR, CHAT_MODES, SCOPES, DEFAULT_MODE, DEFAULT_SCOPE, DEFAULT_SEND_KEY,
  TRANSCRIPT_VIEWS, DEFAULT_VIEW, viewDef, modeCap, hasConversation,
  modeDef, scopeLabel, isSendKey, newSession, newMessage, addMessage, renameSession,
  archiveSession, clearMessages, sessionFileName, sessionStats, contextLabel, compact, usd,
  searchSessions, chatMessages, rawJson, shareMarkdown, estimateTokens,
} from './ai-session.js';
import { providerList, providerById, currentProvider, completeStream, aiMeta } from './ai-provider-ui.js';
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
      } catch (e) { log('warn', tt('ui.aiChatPanel.aiChatReadSession') + f, e); }
    }
  } catch (e) { log('warn', tt('ui.aiChatPanel.aiChatReadFolder'), e); }
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
    if (active && active.file && !active.file.startsWith('::')) await push(active.file, active.title || tt('ui.aiChatPanel.sceneOpen'));
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
  return text.length > maxChars ? text.slice(0, maxChars) + tt('ui.aiChatPanel.cutLong') : text;
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
    S.host.append(el('div', 'ai-chat-empty dim', tt('ui.aiChatPanel.openProjectBeforeDone')));
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
  q.placeholder = tt('ui.aiChatPanel.searchSessionNameText');
  q.value = S.query;
  const addBtn = el('button', 'k-ok ai-chat-new', tt('ui.aiChatPanel.sessionNew'));
  bar.append(q, addBtn);
  wrap.append(bar);

  const rows = el('div', 'ai-chat-rows');
  wrap.append(rows);

  const arch = el('label', 'ai-chat-archtoggle');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = S.showArchived;
  arch.append(cb, document.createTextNode(tt('ui.aiChatPanel.showSessionArrangeKeep')));
  wrap.append(arch);

  function fill() {
    rows.innerHTML = '';
    const list = searchSessions(S.sessions, S.query, { includeArchived: S.showArchived });
    if (!list.length) {
      rows.append(el('div', 'ai-chat-empty dim',
        S.query ? tt('ui.aiChatPanel.notFoundSessionAt') : tt('ui.aiChatPanel.notHasSessionPress')));
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
  main.append(el('div', 'ai-chat-row-title', s.title || tt('ui.aiChatPanel.session')));
  const last = [...(s.messages || [])].reverse().find((m) => m.text);
  main.append(el('div', 'ai-chat-row-sub dim',
    last ? String(last.text).replace(/\s+/g, ' ').slice(0, 90) : tt('ui.aiChatPanel.notHasText')));
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
  back.title = tt('ui.aiChatPanel.backListSession');
  back.onclick = () => { S.view = 'list'; draw(); };
  const title = el('div', 'ai-chat-title', s.title || tt('ui.aiChatPanel.session'));
  title.title = s.title || '';
  const right = el('div', 'ai-chat-head-right');
  const st = sessionStats(s);
  const badge = el('button', 'ai-chat-ctx', contextLabel(st));
  // hover = ต้นทุน (USD) · การใช้งาน % ของเซสชัน · token ที่ใช้
  badge.title = [
    tt('ui.aiChatPanel.msg') + usd(st.usd),
    tt('ui.aiChatPanel.usage2') + (st.limit ? st.percent + '%' : tt('ui.aiChatPanel.notDashRememberModel')),
    tt('ui.aiChatPanel.use2') + st.total.toLocaleString(),
    tt('ui.aiChatPanel.clickViewDetail'),
  ].join('\n');
  badge.onclick = () => { S.view = 'detail'; draw(); };
  // [alpha.62 บั๊ก 3] เริ่มใหม่ — ล้างบทสนทนาของเซสชันนี้ (เซสชันยังอยู่ที่เดิม)
  const restart = el('button', 'ai-chat-restart', '↻');
  restart.title = tt('ui.aiChatPanel.restartClearDialogueSession');
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
  more.title = tt('ui.aiChatPanel.itemPickSession');
  more.onclick = (e) => sessionMenu(e, s);
  right.append(badge, viewSel, restart, more);
  head.append(back, title, right);
  wrap.append(head);

  // ── ข้อความ ──
  const body = el('div', 'ai-chat-msgs ai-view-' + (s.view || DEFAULT_VIEW));
  if (!(s.messages || []).length) {
    body.append(el('div', 'ai-chat-empty dim',
      tt('ui.aiChatPanel.startMode') + modeDef(s.mode).label + tt('ui.aiChatPanel.seeData') + scopeLabel(s.scope)
      + (s._draft ? tt('ui.aiChatPanel.sessionSaveSendText') : '')));
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
  if (m.toolResult) return foldBlock(tt('ui.aiChatPanel.resultCmdSendBack'), m.text, 'ai-msg-toolresult');
  if (view === 'summary') return summaryNode(m);
  const n = el('div', 'ai-msg ai-msg-' + m.role);
  const who = el('div', 'ai-msg-who dim',
    m.role === 'user' ? tt('ui.aiChatPanel.you') : m.role === 'assistant' ? (m.model ? '🤖 ' + m.model : tt('ui.aiChatPanel.assistant')) : m.role);
  // [alpha.62 บั๊ก 3] คัดลอกข้อความทีละก้อน — คำตอบของ AI ส่วนใหญ่เอาไปวางต่อในต้นฉบับ
  // (ลากคลุมเองไม่ได้เพราะแผงลอย/แผง dock กินอีเวนต์เมาส์ไปทำอย่างอื่น)
  const copy = el('button', 'ai-msg-copy', '⧉');
  copy.type = 'button';
  copy.title = tt('ui.aiChatPanel.copyText');
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

  if (view === 'verbose' && m.system) n.append(foldBlock(tt('ui.aiChatPanel.systemPromptSendRound'), m.system));
  if ((view === 'thinking' || view === 'verbose') && m.thinking) {
    n.append(foldBlock(tt('ui.aiChatPanel.ideaModel'), m.thinking, 'ai-msg-thinking'));
  }
  if (m.calls && m.calls.length && view !== 'normal') {
    n.append(callsNode(m.calls, m.results, view));
  } else if (m.calls && m.calls.length) {
    // โหมดปกติ — บอกแค่ว่าทำอะไรไปกี่อย่าง สำเร็จกี่อย่าง
    const okN = (m.results || []).filter((r) => r.ok).length;
    const line = el('div', 'ai-msg-actions dim',
      ttf('ui.aiChatPanel.actCmdOk', m.calls.length, okN, (m.results || []).length || m.calls.length));
    n.append(line);
  }
  if (view === 'verbose' && m.usage) {
    n.append(el('div', 'ai-msg-meta dim',
      ttf('ui.aiChatPanel.tokenInOut', m.usage.input || 0, m.usage.output || 0)
      + (m.usage.reasoning ? ttf('ui.aiChatPanel.think', m.usage.reasoning) : '')
      + (m.usage.cached ? ttf('ui.aiChatPanel.cache', m.usage.cached) : '')
      + (m.ms ? ttf('ui.aiChatPanel.useTime', (m.ms / 1000).toFixed(1)) : '')
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
        : String(m.text || '').replace(/\s+/g, ' ').trim() || tt('ui.common.empty'));
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
  box.append(el('div', 'ai-calls-head dim', tt('ui.aiChatPanel.cmdAct') + calls.length + ')'));
  calls.forEach((c, i) => {
    const r = (results || [])[i];
    const row = el('div', 'ai-call' + (r ? (r.ok ? ' ok' : ' bad') : ''));
    row.append(el('span', 'ai-call-icon', r ? (r.ok ? '✓' : '✕') : '·'));
    row.append(el('span', 'ai-call-desc', describeCall(c)));
    if (r && (r.message || r.error)) row.append(el('span', 'ai-call-msg dim', r.error || r.message));
    box.append(row);
    if (view === 'verbose') {
      box.append(foldBlock(tt('ui.aiChatPanel.jSONModelCmd'), JSON.stringify({ tool: c.tool, args: c.args }, null, 2)));
      if (r && r.data !== undefined && r.data !== null) {
        box.append(foldBlock(tt('ui.aiChatPanel.resultSendBackModel'),
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
  fileBtn.title = tt('ui.aiChatPanel.addFileInContext');
  const modeSel = el('select', 'ai-chat-mode');
  for (const m of CHAT_MODES) { const o = el('option', null, m.icon + ' ' + m.label); o.value = m.id; modeSel.append(o); }
  modeSel.value = s.mode || DEFAULT_MODE;
  modeSel.title = tt('ui.aiChatPanel.modeRun')
    + tt('ui.aiChatPanel.plannerReadProjectNot')
    + tt('ui.aiChatPanel.helpWriteNewEdit')
    + tt('ui.aiChatPanel.unlockFullDoAll');

  // โมเดลของเซสชัน = **override จากตั้งค่า** แยกกันเป็นอิสระ
  const modelSel = el('select', 'ai-chat-model');
  modelSel.title = tt('ui.aiChatPanel.modelSessionValueSet');
  const scopeSel = el('select', 'ai-chat-scope');
  for (const sc of SCOPES) { const o = el('option', null, sc.label); o.value = sc.id; scopeSel.append(o); }
  scopeSel.value = s.scope || DEFAULT_SCOPE;
  scopeSel.title = tt('ui.aiChatPanel.levelInToAI');
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
    ? tt('ui.aiChatPanel.printTextShiftEnter')
    : tt('ui.aiChatPanel.printTextEnterSend');
  const sendBtn = el('button', 'k-ok ai-chat-send', tt('ui.aiChatPanel.send'));
  sendBtn.title = tt('ui.aiChatPanel.btnSendSetFile');
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
    if (!p) { setStatus(tt('ui.aiChatPanel.pickFileNotOk')); return; }
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
  const dflt = el('option', null, tt('ui.aiChatPanel.settingsAI'));
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
let _reqSeq = 0;
function newReqId() { _reqSeq += 1; return 'chat-' + Date.now().toString(36) + '-' + _reqSeq; }

async function send(s, ta, body, sendBtn) {
  const text = String(ta.value || '').trim();
  if (!text || S.sending) return;
  const prov = s.providerId ? await providerById(s.providerId) : await currentProvider();
  if (!prov) {
    setStatus(tt('ui.aiChatPanel.cantSettingsProviderAI'));
    return;
  }
  S.sending = true;
  sendBtn.disabled = true;
  ta.value = '';
  const reqId = newReqId();

  const view = S.cur ? (S.cur.view || DEFAULT_VIEW) : DEFAULT_VIEW;
  const userMsg = newMessage('user', text, { files: (s.files || []).slice() });
  S.cur = addMessage(s, userMsg);
  // ข้อความแรก = เซสชันเกิดจริง (addMessage ตั้งชื่อจากข้อความนี้ให้แล้ว) → บันทึกลงไฟล์ตอนนี้
  await saveSession(S.cur);
  body.append(msgNode(userMsg, view));

  // ฟอง "กำลังคิด" แบบสด — เห็นข้อความ/ความคิดไหลมา + ใช้เวลาเท่าไร + ปุ่มหยุด
  // (เดิมมีแค่ข้อความนิ่ง ๆ "กำลังคิด…" — ผู้ใช้ไม่รู้ว่าติดต่ออยู่จริงหรือค้าง)
  const pend = el('div', 'ai-msg ai-msg-assistant ai-msg-pending');
  const pendWho = el('div', 'ai-msg-who dim');
  const whoLabel = el('span', null, tt('ui.aiChatPanel.busyThink'));
  const whoTime = el('span', 'ai-msg-elapsed');
  const stopBtn = el('button', 'ai-msg-copy', '⏹');
  stopBtn.type = 'button';
  stopBtn.title = tt('ui.aiChatPanel.stopHint');
  stopBtn.onclick = () => { if (kapi.httpAbort) kapi.httpAbort(reqId); };
  pendWho.append(whoLabel, whoTime, stopBtn);
  const pendThink = el('div', 'ai-msg-thinking-live');
  pendThink.style.display = 'none';
  const pendText = el('div', 'ai-msg-text');
  pendText.style.display = 'none';
  pend.append(pendWho, pendThink, pendText);
  body.append(pend);
  body.scrollTop = body.scrollHeight;

  let liveText = '';
  let liveThink = '';
  const startAt = Date.now();
  const tick = setInterval(() => {
    whoTime.textContent = ttf('ui.aiChatPanel.useTime', ((Date.now() - startAt) / 1000).toFixed(1));
  }, 400);
  const renderPend = () => {
    if (liveText) { pendText.textContent = liveText; pendText.style.display = ''; }
    if (liveThink) {
      pendThink.textContent = tt('ui.aiChatPanel.ideaModel') + '\n' + liveThink;
      pendThink.style.display = '';
    }
    body.scrollTop = body.scrollHeight;
  };
  const stopTick = () => clearInterval(tick);

  const md = modeDef(S.cur.mode);
  const cap = modeCap(S.cur.mode);
  let system = md.system;
  const tp = toolsSystemPrompt(cap);
  if (tp) system += '\n\n' + tp;
  try {
    const ctx = await collectScope(S.cur);
    if (ctx) system += tt('ui.aiChatPanel.dataProjectLevelIn') + scopeLabel(S.cur.scope) + '):\n' + ctx;
  } catch (e) { log('warn', tt('ui.aiChatPanel.aiChatCollectContext'), e); }

  // ── วนรอบ: ถาม → โมเดลสั่งคำสั่ง → ทำจริง → ส่งผลกลับ → ถามต่อ ──
  let res = null;
  let touched = false;
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const rt0 = Date.now();
      // สตรีมสด (transport ไม่รองรับ → ตกไป complete แล้วโผล่ทีเดียว UI ไม่ต้องแยกกรณี)
      res = await completeStream(prov, {
        system, messages: chatMessages(S.cur), model: s.model || undefined, reqId,
      }, (c) => {
        if (c.thinking) { liveThink += c.thinking; }
        if (c.delta) { liveText = c.text; }
        renderPend();
      });
      const ms = Date.now() - rt0;

      const calls = res.ok ? parseToolCalls(res.text) : [];
      const reply = res.ok
        ? newMessage('assistant', res.text, { usage: res.usage, model: res.model, provider: res.provider,
                                              thinking: res.thinking, system, ms,
                                              calls: calls.length ? calls : null })
        : newMessage('assistant', '', { error: res.error || tt('ui.aiChatPanel.callAINotOk'), system, ms });

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

      whoLabel.textContent = tt('ui.aiChatPanel.busyAct') + calls.length + tt('ui.aiChatPanel.cmd');
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
          ttf('ui.aiChatPanel.roundNotEndPrint', MAX_TOOL_ROUNDS)));
      } else {
        whoLabel.textContent = tt('ui.aiChatPanel.busyThinkNext');
      }
    }
  } finally {
    stopTick();
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
    badge.title = [tt('ui.aiChatPanel.msg') + usd(st2.usd),
                   tt('ui.aiChatPanel.usage2') + (st2.limit ? st2.percent + '%' : tt('ui.aiChatPanel.notDashRememberModel')),
                   tt('ui.aiChatPanel.use2') + st2.total.toLocaleString(),
                   tt('ui.aiChatPanel.clickViewDetail')].join('\n');
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
    if (stopped) { results.push({ tool: c.tool, ok: false, cancelled: true, error: tt('ui.aiChatPanel.cancelSet') }); continue; }
    const v = validateCall(c, cap);
    if (!v.ok) { results.push({ tool: c.tool || tt('ui.common.notSpecify'), ok: false, error: v.error }); continue; }
    const def = toolByName(c.tool);
    const needAsk = def.destructive
      ? session.confirmDestructive !== false
      : session.autoRun === false;
    if (needAsk) {
      const okGo = await confirmBox(
        (def.destructive ? tt('ui.aiChatPanel.aIDelProject') : tt('ui.aiChatPanel.aIAct')) + describeCall(c),
        def.destructive ? tt('ui.aiChatPanel.del') : tt('ui.aiChatPanel.do'));
      if (!okGo) {
        results.push({ tool: c.tool, ok: false, cancelled: true, error: tt('ui.aiChatPanel.userNotAllow') });
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
      && !(await confirmBox(ttf('ui.aiChatPanel.restartClearDialogueText', (target.messages || []).length, target.title)))) {
    return null;
  }
  S.cur = clearMessages(target);
  await saveSession(S.cur);
  S.view = 'session';
  draw();
  setStatus(tt('ui.aiChatPanel.startDialogueNewDone'));
  return S.cur;
}

// ── เมนู ⋯ ──
function sessionMenu(ev, s) {
  popupMenu(ev.clientX, ev.clientY, [
    { label: tt('ui.aiChatPanel.restartClearDialogue'), click: () => restartSession(s) },
    { label: tt('ui.aiChatPanel.copyDialogueAll'), click: async () => {
      setStatus(await copyText(shareMarkdown(s)) ? tt('ui.aiChatPanel.copyDialogueDone') : tt('ui.common.copyNotOk'));
    } },
    '-',
    // [alpha.63r4] สิทธิ์ลงมือทำของ AI — ตั้งแยกรายเซสชัน
    { label: (s.autoRun === false ? '☐' : '☑') + tt('ui.aiChatPanel.doCmdNotMust'), click: async () => {
      s.autoRun = s.autoRun === false;
      await saveSession(s);
      setStatus(s.autoRun ? tt('ui.aiChatPanel.aIActNotAsk') : tt('ui.aiChatPanel.aIAskBeforeAll'));
    } },
    { label: (s.confirmDestructive === false ? '☐' : '☑') + tt('ui.aiChatPanel.askBeforeAlwaysDel'), click: async () => {
      if (s.confirmDestructive !== false) {
        const okGo = await confirmBox(
          tt('ui.aiChatPanel.closeAskBeforeDel')
          + tt('ui.aiChatPanel.trashRecoverRestoreNot'), tt('ui.aiChatPanel.closeAsk'));
        if (!okGo) return;
      }
      s.confirmDestructive = s.confirmDestructive === false;
      await saveSession(s);
      setStatus(s.confirmDestructive ? tt('ui.aiChatPanel.askBeforeDelAlways') : tt('ui.aiChatPanel.unlockFullAIDel'));
    } },
    '-',
    { label: tt('ui.aiChatPanel.changeName'), click: async () => {
      const v = await ask(tt('ui.aiChatPanel.nameSession'), { value: s.title });
      if (v === null) return;
      S.cur = renameSession(s, v);
      await saveSession(S.cur, { force: true }); draw();
    } },
    { label: tt('ui.aiChatPanel.copyMarkdown'), click: async () => {
      setStatus(await copyText(shareMarkdown(s)) ? tt('ui.aiChatPanel.copyDialogueDone') : tt('ui.common.copyNotOk'));
    } },
    { label: s.archived ? tt('ui.aiChatPanel.exitArrangeKeep') : tt('ui.aiChatPanel.arrangeKeep'), click: async () => {
      S.cur = archiveSession(s, !s.archived);
      await saveSession(S.cur);
      S.view = 'list'; draw();
      setStatus(S.cur.archived ? tt('ui.aiChatPanel.arrangeKeepSessionDone') : tt('ui.aiChatPanel.sessionExitArrangeKeep'));
    } },
    '-',
    { label: tt('ui.aiChatPanel.delSession2'), click: async () => {
      if (!(await confirmBox(ttf('ui.aiChatPanel.delSession', s.title)))) return;
      await deleteSessionFile(s);
      S.cur = null; S.view = 'list'; draw();
      setStatus(tt('ui.aiChatPanel.delSessionDone'));
    } },
  ]);
}

// ══════════════════════════ C) รายละเอียดบริบท ══════════════════════════
function detailView() {
  const s = S.cur;
  const st = sessionStats(s);
  const wrap = el('div', 'ai-chat-detail');

  const head = el('div', 'ai-chat-head');
  head.append(el('div', 'ai-chat-title', tt('ui.aiChatPanel.detailContext')));
  const closeBtn = el('button', 'ai-chat-close', '✕');
  closeBtn.title = tt('ui.aiChatPanel.closeBackSession');
  closeBtn.onclick = () => { S.view = 'session'; draw(); };
  const hr = el('div', 'ai-chat-head-right');
  hr.append(closeBtn);
  head.append(hr);
  wrap.append(head);

  const prov = providerList().find((p) => p.id === s.providerId);
  const lastAssistant = [...(s.messages || [])].reverse().find((m) => m.role === 'assistant' && m.model);
  const rows = [
    [tt('ui.aiChatPanel.nameSession'), s.title || '—'],
    [tt('ui.aiChatPanel.textSession'), (s.messages || []).length.toLocaleString() + tt('ui.aiChatPanel.text')],
    [tt('ui.common.provider'), prov ? prov.name : (lastAssistant && lastAssistant.provider) || tt('ui.aiChatPanel.settingsAI')],
    [tt('ui.common.model'), s.model || (lastAssistant && lastAssistant.model) || tt('ui.aiChatPanel.settingsAI')],
    [tt('ui.aiChatPanel.dashRemember'), st.limit ? st.limit.toLocaleString() + ' tokens' : tt('ui.aiChatPanel.not')],
    [tt('ui.aiChatPanel.use'), st.total.toLocaleString()],
    [tt('ui.aiChatPanel.usage'), st.limit ? st.percent + '%' : '—'],
    [tt('ui.aiChatPanel.import'), st.input.toLocaleString()],
    [tt('ui.aiChatPanel.export'), st.output.toLocaleString()],
    [tt('ui.aiChatPanel.styleUseResult'), st.reasoning.toLocaleString()],
    [tt('ui.aiChatPanel.cache2'), st.cached.toLocaleString()],
    [tt('ui.aiChatPanel.countTextUser'), String(st.userMsgs)],
    [tt('ui.aiChatPanel.countTextAssistant'), String(st.agentMsgs)],
    [tt('ui.aiChatPanel.uSD'), usd(st.usd)],
    [tt('ui.aiChatPanel.dateNewSession'), fmtDate(s.created)],
    [tt('ui.aiChatPanel.useTaskLatest'), fmtDate(s.updated)],
    [tt('ui.aiChatPanel.mode'), modeDef(s.mode).label],
    [tt('ui.aiChatPanel.levelInTo'), scopeLabel(s.scope)],
  ];
  const table = el('div', 'ai-detail-grid');
  for (const [k, v] of rows) {
    table.append(el('div', 'ai-detail-k dim', k));
    table.append(el('div', 'ai-detail-v', v));
  }
  wrap.append(table);

  const rawBtn = el('button', 'ai-detail-raw', tt('ui.aiChatPanel.showTextJSON'));
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
