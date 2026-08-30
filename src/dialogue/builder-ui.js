// builder-ui.js — [alpha.82] แผง 🎭 ห้องซ้อมบท
//
// 2 ชั้นในแผงเดียว (ไม่เปิดหน้าต่างใหม่ — ตามแบบแผงแชท AI):
//   A) รายการเซสชัน — ค้นหา · เซสชันล่าสุด · ปุ่มสร้างใหม่ · ปุ่มจัดการคณะนักแสดง
//   B) ตัวเซสชัน    — แถบตั้งค่า · บทสนทนา · แถบเลือกคนพูด + กล่องส่ง
//
// ตรรกะทั้งหมด (กฎเลือกคนพูด · ประกอบ prompt · อ่านคำตอบ) อยู่ที่ builder-core.js
// ไฟล์นี้ทำแค่ วาด · อ่าน/เขียนไฟล์ · ยิงคำขอ

import { t, tf } from '../i18n.js';
import { $, el, state, setStatus, log } from '../core.js';
import { ask, confirmBox, popupMenu } from '../ui.js';
import { listEntities } from '../project-scan.js';
import { currentProvider, providerById, providerList, complete, completeStream } from '../ai/ai-provider-ui.js';
import { aiConfigured } from '../ai-settings.js';
import { PARAM_DEFS } from '../ai/ai-providers.js';
import * as C from './builder-core.js';

// ────────────────────────────── สถานะของแผง ──────────────────────────────
const S = {
  host: null,
  root: null,              // โปรเจกต์ที่โหลดรายการนี้มา (เปลี่ยนโปรเจกต์ = โหลดใหม่)
  view: 'list',            // list | session
  sessions: [],            // [{ file, data }]
  presets: [],
  cur: null,               // เซสชันที่เปิดอยู่
  curFile: '',
  savedAt: 0,              // เวลาที่บันทึกครั้งล่าสุด (ใช้คู่ sessionDirty)
  query: '',
  showArchived: false,
  sending: false,
  showThinking: false,     // 💬 ปกติ / 🧠 ความคิด
  entities: null,          // แคชรายชื่อจาก Wiki
  reqId: '',               // [alpha.96] คำขอที่กำลังวิ่ง (กดหยุดได้)
  sendingSince: 0,         // เวลาเริ่มส่ง (ไว้แสดง "คิดมาแล้วกี่วินาที")
};

export function resetBuilder() {
  S.root = null; S.view = 'list'; S.sessions = []; S.presets = [];
  S.cur = null; S.curFile = ''; S.savedAt = 0; S.query = ''; S.sending = false;
  S.entities = null; S.reqId = ''; S.sendingSince = 0;
}

/** เซสชันที่เปิดอยู่และยังไม่ได้บันทึก (กฎข้อ 1 — ต้องขึ้นรายการงานค้าง) */
export function builderDirtyList() {
  return C.sessionDirty(S.cur, S.savedAt) ? [S.cur.title || t('ui.dlgb.untitledRow')] : [];
}
export async function saveBuilderDirty() {
  if (!C.sessionDirty(S.cur, S.savedAt)) return true;
  return await saveSession();
}

// ────────────────────────────── ไฟล์ ──────────────────────────────
async function dir() {
  if (!state.root) return null;
  const d = await kapi.join(state.root, C.BUILDER_DIR);
  if (!(await kapi.exists(d))) await kapi.mkdir(d);
  return d;
}

async function loadAll(force) {
  if (!state.root) { S.sessions = []; S.presets = []; S.root = null; return; }
  if (!force && S.root === state.root) return;
  S.root = state.root;
  S.sessions = []; S.presets = [];
  const d = await dir();
  if (!d) return;
  // คณะนักแสดง
  try {
    const pf = await kapi.join(d, C.PRESET_FILE);
    if (await kapi.exists(pf)) {
      const raw = await kapi.readJson(pf);
      S.presets = (raw && Array.isArray(raw.presets) ? raw.presets : []).map(C.newPreset);
    }
  } catch (e) { log('warn', t('ui.dlgb.errReadPresets'), e); }
  // เซสชัน — ไฟล์ละหนึ่งตัว
  for (const f of await kapi.listFiles(d, '.json')) {
    if (f === C.PRESET_FILE) continue;
    try {
      const raw = await kapi.readJson(await kapi.join(d, f));
      if (raw && Array.isArray(raw.turns)) S.sessions.push({ file: f, data: C.newSession(raw) });
    } catch (e) { log('warn', t('ui.dlgb.errReadSession') + f, e); }
  }
}

async function savePresets() {
  const d = await dir();
  if (!d) return false;
  await kapi.writeFile(await kapi.join(d, C.PRESET_FILE),
                       JSON.stringify({ v: C.BUILDER_VERSION, presets: S.presets }, null, 2));
  return true;
}

async function saveSession(sess, file) {
  const s = sess || S.cur;
  if (!s) return false;
  const d = await dir();
  if (!d) return false;
  s.updated = Date.now();
  if (!s.created) s.created = s.updated;
  let name = file || S.curFile;
  if (!name) {
    name = C.sessionFileName(s, S.sessions.map((r) => r.file));
    S.curFile = name;
  }
  try {
    await kapi.writeFile(await kapi.join(d, name), JSON.stringify(s, null, 2));
  } catch (e) { log('error', t('ui.dlgb.errSaveSession'), e); setStatus(t('ui.dlgb.errSaveSession')); return false; }
  const row = S.sessions.find((r) => r.file === name);
  if (row) row.data = s; else S.sessions.push({ file: name, data: s });
  if (s === S.cur) S.savedAt = s.updated;
  return true;
}

// ────────────────────────────── Wiki ──────────────────────────────
async function wikiRows(force) {
  if (S.entities && !force) return S.entities;
  try { S.entities = await listEntities(state.root); } catch { S.entities = []; }
  return S.entities;
}

// ────────────────────────────── ตัววาดหลัก ──────────────────────────────
export async function renderBuilderPanel(host) {
  S.host = host || $('#dlgb-body');
  if (!S.host) return;
  if (!state.root) {
    S.host.replaceChildren(el('div', 'dlgb-empty', t('ui.dlgb.openProjectFirst')));
    return;
  }
  await loadAll();
  if (S.view === 'session' && S.cur) drawSession();
  else drawList();
}

function redraw() { renderBuilderPanel(S.host); }

// ══════════════════════════════ A) รายการเซสชัน ══════════════════════════════
function drawList() {
  const wrap = el('div', 'dlgb-list');

  const bar = el('div', 'dlgb-listbar');
  const q = el('input', 'dlgb-search');
  q.placeholder = t('ui.dlgb.searchPh');
  q.value = S.query;
  q.oninput = () => { S.query = q.value; drawRows(); };
  const bNew = el('button', 'dlgb-new', t('ui.dlgb.newSession'));
  bNew.onclick = () => newSessionFlow();
  const bCast = el('button', '', t('ui.dlgb.managePresets'));
  bCast.onclick = () => presetManager();
  bar.append(q, bNew, bCast);

  const rows = el('div', 'dlgb-rows');
  wrap.append(bar, rows);

  const arch = el('div', 'dlgb-archtoggle',
                  S.showArchived ? t('ui.dlgb.hideArchived') : t('ui.dlgb.showArchived'));
  arch.onclick = () => { S.showArchived = !S.showArchived; drawList(); };
  wrap.append(arch);

  function drawRows() {
    rows.replaceChildren();
    const list = C.searchSessions(S.sessions.map((r) => r.data), S.query,
                                 { includeArchived: S.showArchived });
    if (!list.length) {
      rows.append(el('div', 'dlgb-empty', S.query ? t('ui.dlgb.noMatch') : t('ui.dlgb.noSession')));
      return;
    }
    for (const s of list) {
      const file = (S.sessions.find((r) => r.data === s) || {}).file || '';
      const row = el('div', 'dlgb-row' + (s.archived ? ' archived' : ''));
      const main = el('div', 'dlgb-row-main');
      main.append(el('div', 'dlgb-row-title', s.title || t('ui.dlgb.untitledRow')));
      const cast = (s.cast || []).map((c) => c.name).filter(Boolean).join(' · ');
      main.append(el('div', 'dlgb-row-sub', cast || t('ui.dlgb.noCast')));
      const st = C.sessionStats(s);
      const meta = el('div', 'dlgb-row-meta');
      meta.append(el('span', '', tf('ui.dlgb.nTurns', st.spoken)));
      if (st.inserted) meta.append(el('span', '', tf('ui.dlgb.nInserted', st.inserted)));
      row.append(main, meta);
      row.onclick = () => openSession(s, file);
      row.oncontextmenu = (e) => { e.preventDefault(); sessionMenu(e, s, file); };
      rows.append(row);
    }
  }
  drawRows();
  S.host.replaceChildren(wrap);
}

function sessionMenu(ev, s, file) {
  popupMenu(ev.clientX, ev.clientY, [
    { label: t('ui.dlgb.mRename'), click: async () => {
        const v = await ask(t('ui.dlgb.mRename'), { value: s.title });
        if (v == null) return;
        s.title = v.trim() || s.title;
        await saveSession(s, file); redraw();
      } },
    { label: t('ui.dlgb.mDuplicate'), click: async () => {
        const copy = C.newSession({ ...s, id: '', title: s.title + t('ui.dlgb.copySuffix'),
                                    created: 0, updated: 0 });
        const name = C.sessionFileName(copy, S.sessions.map((r) => r.file));
        await saveSession(copy, name);
        setStatus(t('ui.dlgb.duplicated')); redraw();
      } },
    { label: s.archived ? t('ui.dlgb.mUnarchive') : t('ui.dlgb.mArchive'), click: async () => {
        s.archived = !s.archived; await saveSession(s, file); redraw();
      } },
    '-',
    { label: t('ui.dlgb.mDelete'), danger: true, click: async () => {
        if (!(await confirmBox(tf('ui.dlgb.confirmDelete', s.title || t('ui.dlgb.untitledRow'))))) return;
        const d = await dir();
        try { await kapi.remove(await kapi.join(d, file)); } catch (e) { log('warn', t('ui.dlgb.errDelete'), e); }
        S.sessions = S.sessions.filter((r) => r.file !== file);
        if (S.cur === s) { S.cur = null; S.curFile = ''; S.view = 'list'; }
        redraw();
      } },
  ]);
}

function openSession(s, file) {
  S.cur = s; S.curFile = file; S.savedAt = s.updated || 0; S.view = 'session';
  if (!s.next || (!s.next.speaker && !s.next.listener)) s.next = C.nextPair(s, Math.random);
  drawSession();
}

// ── สร้างเซสชันใหม่ ──────────────────────────────────────────────
async function newSessionFlow() {
  await loadAll(true);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide');
  box.append(el('div', 'k-dlg-title', t('ui.dlgb.newSession')));

  // เลือกคณะ
  box.append(el('label', '', t('ui.dlgb.pickPreset')));
  const sel = el('select', 'dlgb-full');
  for (const p of S.presets) sel.append(el('option', '', `${p.name} (${(p.cast || []).length})`, ));
  [...sel.options].forEach((o, i) => { o.value = S.presets[i].id; });
  if (!S.presets.length) {
    const o = el('option', '', t('ui.dlgb.noPresetYet')); o.value = ''; sel.append(o);
  }
  box.append(sel);

  const bMake = el('button', '', t('ui.dlgb.makePreset'));
  bMake.onclick = async () => { ov.remove(); await presetManager(); };
  box.append(bMake);

  // สถานการณ์
  box.append(el('label', '', t('ui.dlgb.situationLabel')));
  const sit = el('textarea', 'dlgb-ta');
  sit.placeholder = t('ui.dlgb.situationPh');
  box.append(sit);

  box.append(el('label', '', t('ui.dlgb.titleLabel')));
  const title = el('input', 'dlgb-full');
  title.placeholder = t('ui.dlgb.titleAutoPh');
  box.append(title);

  const btns = el('div', 'k-dlg-btns');
  const ok = el('button', 'k-ok', t('ui.dlgb.create'));
  ok.onclick = async () => {
    const p = S.presets.find((x) => x.id === sel.value);
    if (!p) { setStatus(t('ui.dlgb.needPreset')); return; }
    const s = C.sessionFromPreset(p, {
      situation: sit.value.trim(),
      title: title.value.trim() || C.titleFromSituation(sit.value),
    });
    s.next = C.nextPair(s, Math.random);
    ov.remove();
    const name = C.sessionFileName(s, S.sessions.map((r) => r.file));
    await saveSession(s, name);
    openSession(s, name);
  };
  const cancel = el('button', 'k-cancel', t('ui.common.cancel'));
  cancel.onclick = () => ov.remove();
  btns.append(ok, cancel);
  box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  sit.focus();
}

// ══════════════════════════════ B) ตัวเซสชัน ══════════════════════════════
function drawSession() {
  const s = S.cur;
  if (!s) { S.view = 'list'; drawList(); return; }
  // ไฟล์เซสชันที่แชร์กันมาอาจไม่มีช่อง next (หรือชี้ไปตัวละครที่ถูกลบ) — เติมให้ก่อนวาดเสมอ
  if (!s.next) s.next = C.nextPair(s, Math.random);
  const wrap = el('div', 'dlgb-session');

  // ── หัว ──
  const head = el('div', 'dlgb-head');
  const back = el('button', 'dlgb-back', '←');
  back.title = t('ui.dlgb.backToList');
  back.onclick = async () => { await saveBuilderDirty(); S.view = 'list'; drawList(); };
  const title = el('div', 'dlgb-title', s.title || t('ui.dlgb.untitledRow'));
  title.title = s.situation || '';
  const st = C.sessionStats(s);
  const badge = el('button', 'dlgb-ctx', tf('ui.dlgb.badge', st.spoken, st.total));
  badge.title = tf('ui.dlgb.badgeTip', st.calls, st.input, st.output, Math.round(st.ms / 100) / 10);
  const eye = el('button', 'dlgb-eye' + (S.showThinking ? ' on' : ''), S.showThinking ? '🧠' : '💬');
  eye.title = S.showThinking ? t('ui.dlgb.viewThinking') : t('ui.dlgb.viewNormal');
  eye.onclick = () => { S.showThinking = !S.showThinking; drawSession(); };
  const more = el('button', 'dlgb-more', '⋯');
  more.onclick = (e) => sessionHeadMenu(e);
  head.append(back, title, el('div', 'dlgb-head-right'));
  head.lastChild.append(badge, eye, more);
  wrap.append(head);

  // ── แถบตั้งค่า ──
  const opts = el('div', 'dlgb-opts');
  opts.append(mkSelect(C.TURN_POLICIES, s.policy, (v) => {
    s.policy = v; s.next = C.nextPair(s, Math.random); touch(); drawSession();
  }, t('ui.dlgb.policyLabel')));
  opts.append(mkSelect(C.SEND_MODES, s.mode, (v) => { s.mode = v; touch(); drawSession(); },
                       t('ui.dlgb.modeLabel')));
  opts.append(mkSelect(C.TURN_LENGTHS, s.len, (v) => { s.len = v; touch(); }, t('ui.dlgb.lenLabel')));
  const paren = el('label', 'dlgb-check');
  const pcb = el('input'); pcb.type = 'checkbox'; pcb.checked = s.paren !== false;
  pcb.onchange = () => { s.paren = pcb.checked; touch(); };
  paren.append(pcb, document.createTextNode(t('ui.dlgb.parenLabel')));
  opts.append(paren);
  wrap.append(opts);

  // ── บทสนทนา ──
  const msgs = el('div', 'dlgb-msgs');
  if (s.situation) msgs.append(el('div', 'dlgb-situation', s.situation));
  if (!s.turns.length) msgs.append(el('div', 'dlgb-empty', t('ui.dlgb.pressSendToStart')));
  for (const tn of s.turns) msgs.append(bubble(s, tn));
  // [alpha.96] ฟอง "กำลังคิด" ระหว่างรอ — เดิมจอว่าง ผู้ใช้ไม่รู้ว่าติดต่ออยู่จริงหรือค้าง
  if (S.sending) msgs.append(pendingBubble());
  wrap.append(msgs);

  // ── แถบเลือกคนพูด + กล่องส่ง ──
  wrap.append(composer(s));

  S.host.replaceChildren(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function touch() { if (S.cur) S.cur.updated = Date.now(); }

function mkSelect(defs, value, onChange, label) {
  const w = el('label', 'dlgb-opt');
  w.append(el('span', 'dlgb-opt-label', label));
  const sel = el('select');
  for (const d of defs) {
    const o = el('option', '', d.label); o.value = d.id;
    if (d.hint || d.rule) o.title = d.hint || d.rule;
    sel.append(o);
  }
  sel.value = value;
  const def = defs.find((d) => d.id === value);
  sel.title = (def && (def.hint || def.rule)) || '';
  sel.onchange = () => onChange(sel.value);
  w.append(sel);
  return w;
}

// ── ฟองข้อความ ─────────────────────────────────────────────────
function bubble(s, tn) {
  const isDir = tn.kind === C.KIND_DIRECTOR;
  // [alpha.116 ข้อ 1] รำพึงคนเดียวต้องดูออกทันทีว่าไม่ใช่บทพูดที่คนอื่นได้ยิน
  const isMono = C.isMonologue(tn);
  const n = el('div', 'dlgb-bubble' + (isDir ? ' dlgb-director' : '')
                    + (isMono ? ' dlgb-mono' : '')
                    + (tn.kind === C.KIND_USER ? ' dlgb-usertyped' : ''));

  const head = el('div', 'dlgb-bub-head');
  if (isDir) head.append(el('span', 'dlgb-bub-name', '🎬 ' + t('ui.dlgb.director')));
  else {
    head.append(el('span', 'dlgb-bub-name',
                   (isMono ? '💭 ' : '') + (C.castName(s, tn.speaker) || t('ui.dlgb.unknown'))));
    if (isMono) head.append(el('span', 'dlgb-bub-to', t('ui.dlgb.monoTag')));
    else {
      const to = C.castName(s, tn.listener);
      if (to) head.append(el('span', 'dlgb-bub-to', tf('ui.dlgb.toWhom', to)));
    }
  }
  if (tn.inserted) {
    const chk = el('span', 'dlgb-bub-ins', '✓');
    chk.title = tf('ui.dlgb.insertedInto', tn.inserted.scene || '');
    head.append(chk);
  }
  if (tn.model) { const m = el('span', 'dlgb-bub-model', tn.model); head.append(m); }
  n.append(head);

  const body = el('div', 'dlgb-bub-body');
  if (tn.paren) body.append(el('div', 'dlgb-bub-paren', '(' + tn.paren + ')'));
  body.append(el('div', 'dlgb-bub-text', tn.text));
  n.append(body);

  // ความคิดของโมเดล — กางดูได้ (โหมด 🧠 กางไว้ให้เลย)
  if (tn.thinking) {
    const fold = el('details', 'dlgb-think');
    if (S.showThinking) fold.open = true;
    fold.append(el('summary', 'dlgb-think-sum', t('ui.dlgb.modelThinking')));
    fold.append(el('pre', 'dlgb-think-pre', tn.thinking));
    n.append(fold);
  }

  // ปุ่มในฟอง
  const acts = el('div', 'dlgb-bub-acts');
  if (!isDir) {
    acts.append(mkAct('↻', t('ui.dlgb.actReroll'), () => reroll(tn)));
  }
  acts.append(mkAct('✎', t('ui.dlgb.actEdit'), () => editTurn(tn)));
  acts.append(mkAct('⬇', t('ui.dlgb.actInsert'), () => insertTurn(tn)));
  acts.append(mkAct('🗑', t('ui.dlgb.actDelete'), async () => {
    S.cur.turns = S.cur.turns.filter((x) => x.id !== tn.id);
    touch(); await saveSession(); drawSession();
  }));
  n.append(acts);
  return n;
}
function mkAct(icon, tip, fn) {
  const b = el('button', 'dlgb-act', icon);
  b.title = tip;
  b.onclick = fn;
  return b;
}

/** ฟอง "กำลังคิด…" ระหว่างรอคำตอบ — บอกเวลาที่ผ่านไป + ปุ่มหยุด + สตรีมข้อความ/ความคิดสด */
function pendingBubble() {
  const pend = el('div', 'dlgb-bubble dlgb-pending');
  const head = el('div', 'dlgb-bub-head');
  head.append(el('span', 'dlgb-bub-name', t('ui.dlgb.thinking')));
  head.append(el('span', 'dlgb-bub-elapsed', ''));
  const stopBtn = el('button', 'dlgb-bub-stop', '⏹');
  stopBtn.type = 'button';
  stopBtn.title = t('ui.dlgb.stopHint');
  stopBtn.onclick = () => { if (kapi.httpAbort && S.reqId) kapi.httpAbort(S.reqId); };
  head.append(stopBtn);
  pend.append(head);
  const body = el('div', 'dlgb-bub-body');
  const think = el('div', 'dlgb-bub-thinklive');
  think.style.display = 'none';
  body.append(think, el('div', 'dlgb-bub-text', '…'));
  pend.append(body);
  return pend;
}

/** อัปเดตฟอง "กำลังคิด" ระหว่างสตรีม — ข้อความ/ความคิดไหลมาแบบเรียลไทม์ ไม่ต้องรอจบ */
function updatePending(c) {
  if (!S.host) return;
  const pend = S.host.querySelector('.dlgb-pending');
  if (!pend) return;
  if (typeof c.text === 'string') {
    const txt = pend.querySelector('.dlgb-bub-text');
    if (txt) txt.textContent = c.text || '…';
  }
  const th = pend.querySelector('.dlgb-bub-thinklive');
  if (th && typeof c.thinking === 'string') {
    if (c.thinking) { th.textContent = t('ui.dlgb.modelThinking') + '\n' + c.thinking; th.style.display = ''; }
    else th.style.display = 'none';
  }
}

// ── แถบส่ง ──────────────────────────────────────────────────────
function composer(s) {
  const box = el('div', 'dlgb-composer');

  const pick = el('div', 'dlgb-pick');
  const spk = el('select', 'dlgb-pick-sel');
  for (const o of C.speakerOptions(s)) { const x = el('option', '', o.label); x.value = o.id; spk.append(x); }
  spk.value = (s.next && s.next.speaker) || '';
  spk.onchange = () => { s.next.speaker = spk.value; touch(); };

  const lis = el('select', 'dlgb-pick-sel');
  for (const o of C.listenerOptions(s)) { const x = el('option', '', o.label); x.value = o.id; lis.append(x); }
  lis.value = (s.next && s.next.listener) || C.ALL_LISTEN;
  lis.onchange = () => { s.next.listener = lis.value; touch(); };

  pick.append(spk, el('span', 'dlgb-pick-mid', t('ui.dlgb.speaksTo')), lis);
  box.append(pick);

  const row = el('div', 'dlgb-sendrow');
  const inp = el('textarea', 'dlgb-input');
  inp.placeholder = t('ui.dlgb.inputPh');
  inp.rows = 2;
  inp.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp); }
  };
  const bSend = el('button', 'dlgb-send k-ok', S.sending ? t('ui.dlgb.sending') : t('ui.dlgb.send'));
  bSend.disabled = S.sending;
  bSend.onclick = () => send(inp);
  const bCont = el('button', 'dlgb-cont', t('ui.dlgb.keepTalking'));
  bCont.title = t('ui.dlgb.keepTalkingTip');
  bCont.disabled = S.sending;
  bCont.onclick = () => {
    const last = C.lastSpoken(s);
    if (last) { s.next = { speaker: last.speaker, listener: last.listener }; }
    send(inp);
  };
  // [alpha.116 ข้อ 1] 💭 รำพึงคนเดียว — ตั้งช่อง "พูดกับ" เป็นตัวเองแล้วส่งในคลิกเดียว
  const bMono = el('button', 'dlgb-mono-btn', '💭');
  bMono.title = t('ui.dlgb.monoTip');
  bMono.disabled = S.sending;
  bMono.onclick = () => {
    s.next = { speaker: (s.next && s.next.speaker) || (s.cast[0] || {}).id || '',
               listener: C.SELF_MONO };
    touch();
    send(inp);
  };
  const bDir = el('button', 'dlgb-dir', '🎬');
  bDir.title = t('ui.dlgb.directorTip');
  bDir.onclick = () => directorNote();
  row.append(inp, bSend, bCont, bMono, bDir);
  box.append(row);
  return box;
}

// ══════════════════════════════ ยิงคำขอ ══════════════════════════════

let _reqSeq = 0;
function newReqId() { _reqSeq += 1; return 'dlgb-' + Date.now().toString(36) + '-' + _reqSeq; }

/** อัปเดตตัวบอก "คิดมาแล้วกี่วิ" บนฟองที่กำลังรอ (ถ้ายังมีอยู่) */
function tickElapsed() {
  const el = S.host && S.host.querySelector('.dlgb-bub-elapsed');
  if (el) el.textContent = tf('ui.dlgb.elapsed', ((Date.now() - S.sendingSince) / 1000).toFixed(1));
}

/** ผู้ให้บริการที่ตัวละครตัวนี้ใช้ — ทับ model/params เฉพาะที่ตั้งไว้จริง */
async function providerFor(member) {
  const base = (member && member.providerId) ? await providerById(member.providerId) : await currentProvider();
  if (!base) return null;
  const p = { ...base };
  if (member && member.model) p.model = member.model;
  if (member && member.params && Object.keys(member.params).length) {
    p.params = { ...(base.params || {}), ...member.params };
  }
  return p;
}

async function send(inp) {
  const s = S.cur;
  if (!s || S.sending) return;
  const cfg = await aiConfigured();
  if (!cfg.ok) { setStatus(cfg.why); return; }

  const typed = inp ? inp.value.trim() : '';
  let pair = C.resolvePair(s, s.next || {}, Math.random);

  // ผู้ใช้พิมพ์เอง = บรรทัดนั้นเป็นของผู้ใช้ ไม่ยิง API (แล้วค่อยให้อีกฝ่ายสวนรอบหน้า)
  if (typed) {
    if (!pair.speaker || pair.needAi) {
      const first = (s.cast[0] || {}).id;
      pair = { speaker: pair.needAi ? first : (pair.speaker || first), listener: pair.listener };
    }
    s.turns.push(C.newTurn({ kind: C.KIND_USER, speaker: pair.speaker, listener: pair.listener,
                             text: typed, ts: Date.now() }));
    if (inp) inp.value = '';
    s.next = C.nextPair(s, Math.random);
    touch(); await saveSession(); drawSession();
    return;
  }

  S.sending = true;
  S.reqId = newReqId();
  S.sendingSince = Date.now();
  const tick = setInterval(tickElapsed, 400);
  drawSession();
  try {
    if (s.mode === 'batch') await sendBatch(s);
    else await sendOne(s, pair);
  } catch (e) {
    log('error', t('ui.dlgb.errSend'), e);
    setStatus(t('ui.dlgb.errSend'));
  } finally {
    clearInterval(tick);
    S.sending = false;
    S.reqId = '';
    s.next = C.nextPair(s, Math.random);
    touch();
    await saveSession();
    drawSession();
  }
}

/** โหมดทีละคน — 1 เทิร์น 1 คำขอ (override รายตัวใช้ได้) */
async function sendOne(s, pair) {
  let speaker = pair.speaker;

  // 🤖 ให้ AI เลือกคนพูด — ถามด้วยโมเดลของโปรเจกต์ ตอบชื่อคำเดียว (ถูกมาก)
  if (pair.needAi) {
    const pk = C.buildPickerRequest(s);
    const prov = await currentProvider();
    if (pk && prov) {
      const res = await complete(prov, { system: pk.system, messages: pk.messages, reqId: S.reqId });
      if (res.ok) speaker = C.parsePickedSpeaker(s, res.text);
    }
    if (!speaker) {
      // จับชื่อไม่ได้ → สุ่มแทน ดีกว่าค้าง
      speaker = C.resolvePair(s, { speaker: C.ANY_RANDOM, listener: pair.listener }, Math.random).speaker;
    }
  }
  if (!speaker) { setStatus(t('ui.dlgb.needSpeaker')); return; }

  const req = C.buildTurnRequest(s, speaker, pair.listener);
  if (!req) { setStatus(t('ui.dlgb.needSpeaker')); return; }
  const prov = await providerFor(req.cast);
  if (!prov) { setStatus(t('ui.dlgb.noProvider')); return; }

  const t0 = Date.now();
  // สตรีมสด — บทพูดไหลลงฟอง "กำลังคิด" ทีละก้อน ไม่ต้องรอ generate จบ
  const res = await completeStream(prov, { system: req.system, messages: req.messages, reqId: S.reqId },
    (c) => updatePending({ text: c.text, thinking: c.thinkingAll }));
  if (!res.ok) { setStatus('❌ ' + (res.error || t('ui.dlgb.errSend'))); return; }
  const parsed = C.parseSpokenLine(res.text, req.cast.name, { aliases: req.cast.aliases });
  if (!parsed.text) { setStatus(t('ui.dlgb.emptyReply')); return; }
  s.turns.push(C.newTurn({
    // [alpha.116 ข้อ 1] จดชนิดไว้ในเทิร์นเลย — ไฟล์เซสชันอ่านย้อนได้ว่าบรรทัดไหนเป็นเสียงในใจ
    kind: req.mono ? C.KIND_MONO : C.KIND_LINE,
    speaker, listener: pair.listener, text: parsed.text, paren: parsed.paren,
    thinking: res.thinking || '', model: res.model || '', provider: res.provider || '',
    usage: res.usage || null, ms: Date.now() - t0, ts: Date.now(),
  }));
}

/** โหมดรวดเดียว — คำขอเดียวได้หลายบรรทัด (ทุกตัวใช้โมเดลของโปรเจกต์) */
async function sendBatch(s) {
  const req = C.buildBatchRequest(s, 6);
  if (!req) return;
  const prov = await currentProvider();
  if (!prov) { setStatus(t('ui.dlgb.noProvider')); return; }
  const t0 = Date.now();
  // สตรีมสดเหมือนโหมดทีละคน — บทพูดไหลลงฟอง "กำลังคิด" ทีละก้อน
  const res = await completeStream(prov, { system: req.system, messages: req.messages, reqId: S.reqId },
    (c) => updatePending({ text: c.text, thinking: c.thinkingAll }));
  if (!res.ok) { setStatus('❌ ' + (res.error || t('ui.dlgb.errSend'))); return; }
  const rows = C.parseBatch(s, res.text);
  if (!rows.length) { setStatus(t('ui.dlgb.emptyReply')); return; }
  const ms = Date.now() - t0;
  rows.forEach((r, i) => {
    s.turns.push(C.newTurn({
      speaker: r.speaker, listener: C.ALL_LISTEN, text: r.text, paren: r.paren,
      // ความคิด/ต้นทุนติดที่บรรทัดแรกก้อนเดียว — ไม่งั้นป้ายสถิตินับซ้ำ
      thinking: i === 0 ? (res.thinking || '') : '',
      model: res.model || '', usage: i === 0 ? (res.usage || null) : null,
      ms: i === 0 ? ms : 0, ts: Date.now(),
    }));
  });
}

/** สุ่มบรรทัดนั้นใหม่ — ถอดเทิร์นนั้นออกชั่วคราวแล้วยิงซ้ำด้วยคู่เดิม */
async function reroll(tn) {
  const s = S.cur;
  if (!s || S.sending) return;
  const cfg = await aiConfigured();
  if (!cfg.ok) { setStatus(cfg.why); return; }
  const i = s.turns.findIndex((x) => x.id === tn.id);
  if (i < 0) return;
  const after = s.turns.slice(i + 1);
  s.turns = s.turns.slice(0, i);
  S.sending = true; S.reqId = newReqId(); S.sendingSince = Date.now();
  const tick = setInterval(tickElapsed, 400);
  drawSession();
  try {
    await sendOne(s, { speaker: tn.speaker, listener: tn.listener, needAi: false });
  } catch (e) {
    log('error', t('ui.dlgb.errSend'), e);
    s.turns.push(tn);            // ล้มเหลว = คืนของเดิม ห้ามทำบทพูดหาย
  } finally {
    clearInterval(tick);
    s.turns.push(...after);
    S.sending = false; S.reqId = ''; touch(); await saveSession(); drawSession();
  }
}

// ══════════════════════════════ แก้ / แทรก / ผู้กำกับ ══════════════════════════════
async function editTurn(tn) {
  const cur = (tn.paren ? `(${tn.paren}) ` : '') + tn.text;
  const v = await ask(t('ui.dlgb.actEdit'), { value: cur, allowEmpty: true });
  if (v == null) return;
  const p = C.parseSpokenLine(v);
  tn.text = p.text; tn.paren = p.paren;
  touch(); await saveSession(); drawSession();
}

/** แทรกลงบทที่เคอร์เซอร์ — รูปแบบบทภาพยนตร์เสมอ ทั้งโหมดนิยายและโหมดบท */
async function insertTurn(tn) {
  const txt = C.turnToScreenplay(S.cur, tn);
  if (!txt) return;
  if (!insertToEditor(txt)) return;
  tn.inserted = { scene: (state.active && (state.active.title || state.active.file)) || '', at: Date.now() };
  touch(); await saveSession(); drawSession();
}

/**
 * แทรกบทพูดตรงเคอร์เซอร์
 * แท็บบทหนัง → `insertScript` (ได้ element ตัวละคร/บทพูดจริง)
 * แท็บนิยาย  → `insertLines` (ได้ย่อหน้าจริง — ข้อความยังเป็นรูปแบบบทหนังตามที่ผู้ใช้สั่ง)
 */
function insertToEditor(txt) {
  const tab = state.active;
  if (!tab || (!tab.editor && !tab.sp)) { setStatus(t('ui.dlgb.noEditor')); return false; }
  const ok = tab.sp ? tab.sp.insertScript(txt) : tab.editor.insertLines(txt);
  if (!ok) { setStatus(t('ui.dlgb.noEditor')); return false; }
  setStatus(t('ui.dlgb.inserted'));
  return true;
}

async function insertAll() {
  const s = S.cur;
  if (!s) return;
  const txt = C.sessionToScreenplay(s);
  if (!txt) { setStatus(t('ui.dlgb.nothingToInsert')); return; }
  if (!insertToEditor(txt)) return;
  const at = Date.now();
  const scene = (state.active && (state.active.title || state.active.file)) || '';
  for (const tn of s.turns) if (!tn.inserted) tn.inserted = { scene, at };
  touch(); await saveSession(); drawSession();
}

async function directorNote() {
  const v = await ask(t('ui.dlgb.directorTitle'), { placeholder: t('ui.dlgb.directorPh') });
  if (v == null || !v.trim()) return;
  S.cur.turns.push(C.newTurn({ kind: C.KIND_DIRECTOR, text: v.trim(), ts: Date.now() }));
  touch(); await saveSession(); drawSession();
}

function sessionHeadMenu(ev) {
  const s = S.cur;
  popupMenu(ev.clientX, ev.clientY, [
    { label: t('ui.dlgb.mEditCast'), click: () => castEditor(s, async () => {
        touch(); await saveSession(); drawSession();
      }) },
    { label: t('ui.dlgb.mEditSituation'), click: async () => {
        const v = await ask(t('ui.dlgb.situationLabel'), { value: s.situation, allowEmpty: true });
        if (v == null) return;
        s.situation = v; touch(); await saveSession(); drawSession();
      } },
    { label: t('ui.dlgb.mRename'), click: async () => {
        const v = await ask(t('ui.dlgb.mRename'), { value: s.title });
        if (v == null || !v.trim()) return;
        s.title = v.trim(); touch(); await saveSession(); drawSession();
      } },
    '-',
    { label: t('ui.dlgb.mInsertAll'), click: () => insertAll() },
    { label: t('ui.dlgb.mSaveAsPreset'), click: async () => {
        const v = await ask(t('ui.dlgb.mSaveAsPreset'), { value: s.presetName || s.title });
        if (v == null || !v.trim()) return;
        const p = C.newPreset({ name: v.trim(), cast: s.cast, rels: s.rels });
        S.presets.push(p);
        await savePresets();
        setStatus(t('ui.dlgb.presetSaved'));
      } },
    '-',
    { label: t('ui.dlgb.mClearTurns'), danger: true, click: async () => {
        if (!(await confirmBox(t('ui.dlgb.confirmClear')))) return;
        s.turns = []; s.next = C.nextPair(s, Math.random);
        touch(); await saveSession(); drawSession();
      } },
  ]);
}

// ══════════════════════════════ จัดการคณะนักแสดง ══════════════════════════════
async function presetManager() {
  await loadAll(true);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide');
  box.append(el('div', 'k-dlg-title', t('ui.dlgb.managePresets')));
  const list = el('div', 'dlgb-preset-list');
  box.append(list);

  function draw() {
    list.replaceChildren();
    if (!S.presets.length) list.append(el('div', 'dlgb-empty', t('ui.dlgb.noPresetYet')));
    for (const p of S.presets) {
      const row = el('div', 'dlgb-preset-row');
      const main = el('div', 'dlgb-preset-main');
      main.append(el('div', 'dlgb-row-title', p.name));
      main.append(el('div', 'dlgb-row-sub',
                     (p.cast || []).map((c) => c.name).join(' · ') || t('ui.dlgb.noCast')));
      const bEdit = el('button', '', t('ui.dlgb.edit'));
      bEdit.onclick = () => castEditor(p, async () => { await savePresets(); draw(); });
      const bDel = el('button', 'k-danger', t('ui.dlgb.delete'));
      bDel.onclick = async () => {
        if (!(await confirmBox(tf('ui.dlgb.confirmDeletePreset', p.name)))) return;
        S.presets = S.presets.filter((x) => x !== p);
        await savePresets(); draw();
      };
      row.append(main, bEdit, bDel);
      list.append(row);
    }
  }
  draw();

  const btns = el('div', 'k-dlg-btns');
  const bAdd = el('button', 'k-ok', t('ui.dlgb.addPreset'));
  bAdd.onclick = async () => {
    const v = await ask(t('ui.dlgb.presetNameAsk'));
    if (v == null || !v.trim()) return;
    const p = C.newPreset({ name: v.trim() });
    S.presets.push(p);
    await savePresets();
    castEditor(p, async () => { await savePresets(); draw(); });
  };
  const bClose = el('button', 'k-cancel', t('ui.common.close'));
  bClose.onclick = () => { ov.remove(); redraw(); };
  btns.append(bAdd, bClose);
  box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) { ov.remove(); redraw(); } };
}

/**
 * ตัวแก้คณะ — ใช้ได้ทั้งกับ preset และกับ session ที่เปิดอยู่ (โครงข้อมูลเดียวกัน)
 * @param {object} holder  preset หรือ session
 * @param {function} onSave เรียกทุกครั้งที่มีการเปลี่ยน
 */
async function castEditor(holder, onSave) {
  const rows = await wikiRows();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide dlgb-cast-dlg');
  box.append(el('div', 'k-dlg-title', tf('ui.dlgb.castTitle', holder.name || holder.title || '')));

  const body = el('div', 'dlgb-cast-body');
  box.append(body);

  function draw() {
    body.replaceChildren();

    // ── รายชื่อในคณะ ──
    body.append(el('div', 'dlgb-sec', tf('ui.dlgb.castCount', (holder.cast || []).length, C.MAX_CAST)));
    for (const c of holder.cast || []) body.append(castCard(c));

    if ((holder.cast || []).length < C.MAX_CAST) {
      const add = el('div', 'dlgb-add');
      const sel = el('select', 'dlgb-full');
      const o0 = el('option', '', t('ui.dlgb.pickFromWiki')); o0.value = ''; sel.append(o0);
      for (const r of rows) {
        if ((holder.cast || []).some((c) => c.name === r.name)) continue;
        const o = el('option', '', `${r.name} · ${r.cat}`); o.value = r.path; sel.append(o);
      }
      const bAdd = el('button', '', t('ui.dlgb.addToCast'));
      bAdd.onclick = () => {
        const r = rows.find((x) => x.path === sel.value);
        if (!r) return;
        const m = C.addCast(holder, {
          name: r.name, aliases: r.aliases || [], wikiPath: r.path, cat: r.cat,
          persona: C.personaFromEntity(r.entity, r.name),
          blurb: C.blurbFromEntity(r.entity),
        });
        if (!m) { setStatus(tf('ui.dlgb.castFull', C.MAX_CAST)); return; }
        // ความสัมพันธ์ตั้งต้นจาก Wiki (ผู้ใช้ทับได้ทีหลัง)
        const byName = {};
        for (const x of rows) byName[x.name] = x.entity;
        for (const rel of C.relsFromEntities(holder.cast, byName)) {
          if (!C.relOf(holder, rel.from, rel.to)) {
            holder.rels = holder.rels || [];
            holder.rels.push(rel);
          }
        }
        onSave(); draw();
      };
      add.append(sel, bAdd);
      body.append(add);
      if (!rows.length) body.append(el('div', 'dlgb-hint', t('ui.dlgb.noWikiChars')));
    }

    // ── ความสัมพันธ์เฉพาะซีนนี้ ──
    const cast = holder.cast || [];
    if (cast.length >= 2) {
      body.append(el('div', 'dlgb-sec', t('ui.dlgb.relSection')));
      body.append(el('div', 'dlgb-hint', t('ui.dlgb.relHint')));
      for (const a of cast) for (const b of cast) {
        if (a.id === b.id) continue;
        const r = C.relOf(holder, a.id, b.id) || { how: '', callThem: '' };
        const card = el('div', 'dlgb-rel');
        card.append(el('div', 'dlgb-rel-head', tf('ui.dlgb.relPair', a.name, b.name)));
        const how = el('input', 'dlgb-full');
        how.placeholder = t('ui.dlgb.relHowPh'); how.value = r.how;
        const call = el('input', 'dlgb-pron');
        call.placeholder = t('ui.dlgb.relCallPh'); call.value = r.callThem;
        const apply = () => { C.setRel(holder, a.id, b.id, { how: how.value, callThem: call.value }); onSave(); };
        how.onchange = apply; call.onchange = apply;
        card.append(how, call);
        body.append(card);
      }
    }
  }

  function castCard(c) {
    const card = el('div', 'dlgb-cast-card');
    const head = el('div', 'dlgb-cast-head');
    head.append(el('span', 'dlgb-cast-name', c.name));
    const pron = el('input', 'dlgb-pron');
    pron.placeholder = t('ui.dlgb.selfPronPh');
    pron.value = c.selfPronoun;
    pron.title = t('ui.dlgb.selfPronTip');
    pron.onchange = () => { c.selfPronoun = pron.value.trim(); onSave(); };
    const bDel = el('button', 'k-danger dlgb-cast-del', '✕');
    bDel.title = t('ui.dlgb.removeFromCast');
    bDel.onclick = () => { C.removeCast(holder, c.id); onSave(); draw(); };
    head.append(pron, bDel);
    card.append(head);

    const blurb = el('input', 'dlgb-full');
    blurb.placeholder = t('ui.dlgb.blurbPh');
    blurb.value = c.blurb;
    blurb.title = t('ui.dlgb.blurbTip');
    blurb.onchange = () => { c.blurb = blurb.value.trim(); onSave(); };
    card.append(blurb);

    const per = el('textarea', 'dlgb-ta');
    per.placeholder = t('ui.dlgb.personaPh');
    per.value = c.persona;
    per.onchange = () => { c.persona = per.value; onSave(); };
    card.append(per);

    const bGen = el('button', 'dlgb-mini', t('ui.dlgb.genFromWiki'));
    bGen.onclick = async () => {
      const r = (await wikiRows()).find((x) => x.path === c.wikiPath || x.name === c.name);
      if (!r) { setStatus(t('ui.dlgb.wikiNotFound')); return; }
      c.persona = C.personaFromEntity(r.entity, c.name);
      if (!c.blurb) c.blurb = C.blurbFromEntity(r.entity);
      onSave(); draw();
    };
    card.append(bGen);

    // ── override โมเดล/พารามิเตอร์รายตัว ──
    const fold = el('details', 'dlgb-override');
    fold.append(el('summary', 'dlgb-think-sum', t('ui.dlgb.overrideTitle')));
    const grid = el('div', 'dlgb-override-grid');

    const pv = el('select');
    const pv0 = el('option', '', t('ui.dlgb.useProjectProvider')); pv0.value = ''; pv.append(pv0);
    for (const p of providerList()) { const o = el('option', '', p.name); o.value = p.id; pv.append(o); }
    pv.value = c.providerId || '';
    pv.onchange = () => { c.providerId = pv.value; onSave(); };
    grid.append(mkField(t('ui.dlgb.providerLabel'), pv));

    const md = el('input');
    md.placeholder = t('ui.dlgb.useProviderModel');
    md.value = c.model || '';
    md.onchange = () => { c.model = md.value.trim(); onSave(); };
    grid.append(mkField(t('ui.dlgb.modelLabel'), md));

    // พารามิเตอร์ — ใช้ตารางเดียวกับกล่องตั้งค่าผู้ให้บริการ (กฎ: นิยามที่เดียว)
    for (const def of PARAM_DEFS) {
      if (def.type === 'kv') continue;                       // custom headers ไม่ควรทับรายตัว
      let inp;
      if (def.type === 'select') {
        inp = el('select');
        const o0 = el('option', '', t('ui.dlgb.useProviderValue')); o0.value = ''; inp.append(o0);
        for (const v of def.options) { if (v === '') continue; const o = el('option', '', v); o.value = v; inp.append(o); }
      } else {
        inp = el('input'); inp.type = 'number';
        if (def.min != null) inp.min = def.min;
        if (def.max != null) inp.max = def.max;
        if (def.step != null) inp.step = def.step;
        inp.placeholder = t('ui.dlgb.useProviderValue');
      }
      const cv = c.params ? c.params[def.key] : undefined;
      inp.value = cv == null ? '' : String(cv);
      inp.onchange = () => {
        c.params = c.params || {};
        const raw = inp.value.trim();
        if (raw === '') delete c.params[def.key];
        else c.params[def.key] = def.type === 'select' ? raw : Number(raw);
        onSave();
      };
      grid.append(mkField(def.label, inp, def.th));
    }
    fold.append(grid);
    card.append(fold);
    return card;
  }

  function mkField(label, inp, tip) {
    const w = el('div', 'dlgb-field');
    const l = el('label', '', label);
    if (tip) l.title = tip;
    w.append(l, inp);
    return w;
  }

  draw();
  const btns = el('div', 'k-dlg-btns');
  const bClose = el('button', 'k-ok', t('ui.common.close'));
  bClose.onclick = () => { ov.remove(); if (S.view === 'session') drawSession(); };
  btns.append(bClose);
  box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) { ov.remove(); if (S.view === 'session') drawSession(); } };
}

// เปิดจากคำสั่ง/เมนู — ให้ app.js เรียกได้ตรง ๆ
export function builderState() { return S; }
