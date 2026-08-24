// starter-chat.js — แชทกับ Game Master (สเปกข้อ 12–13)
//
// จงใจ **ไม่** ใช้แผงแชท AI เดิม (ai-chat-panel.js) ด้วยเหตุผลสองข้อ:
//   1. แผงนั้นผูกกับ `Sessions/` ของโปรเจกต์ แต่ตอนของ starter ต้องย้ายไปพร้อม starter
//   2. แผงนั้นมี **tool-calling** (สร้าง/แก้/ลบไฟล์โปรเจกต์ได้) ซึ่ง GM ไม่ควรมีระหว่างเล่น
//      ผู้เล่นกำลังสมมติเรื่อง ไม่ได้สั่งงานโปรแกรม — พลาดทีเดียวไฟล์งานจริงเสียหาย
// ที่นี่จึงเป็นแชท **อ่านอย่างเดียว**: อ่านข้อมูล starter ได้ครบ แต่เขียนได้แค่ไฟล์ตอนของตัวเอง
//
// รองรับหลายผู้เล่น: ผู้ใช้สวมบทตัวละครไหนก็ได้ที่เลือกไว้ใน "ตอน" (GM ห้ามพูดแทนตัวนั้น)

import { el, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { confirmBox } from '../ui.js';
import { estimateTokens } from '../ai/ai-session.js';
import { ROLE_GM, ROLE_PLAYER, addTurn, openChoices, scenarioStats, transcriptText, charById }
  from './starter-model.js';
import { gmSystem, gmOpening, gmUserTurn, recapPrompt } from './starter-prompt.js';
import { parseChoices, stripChoices } from './starter-choices.js';
import { writeScenario, listScenarios } from './starter-store.js';
import { newReqId, stopAI, tokenBadge } from './starter-ai.js';

/** เพดานบริบทของบทสนทนา — เกินแล้วตัดหัวทิ้ง (บทเปิดฉากเก็บไว้เสมอ) */
const MAX_CTX_TOKENS = 6000;

const CHAT_C = { sending: false, speaker: '', draft: '', reqId: '' };

// ───────────────────────── ตัวช่วย ─────────────────────────

function nameOf(s, id) {
  const c = charById(s, id);
  return (c && c.name) || '';
}

/**
 * แปลงเทิร์นเป็นข้อความสำหรับส่งโมเดล + ตัดให้พอดีบริบท
 * ตัดจาก **ต้น** ไม่ใช่ท้าย — บทล่าสุดสำคัญที่สุดต่อความต่อเนื่อง
 */
function historyMessages(s, sc) {
  const rows = (sc.turns || []).map((r) => ({
    role: r.role === ROLE_GM ? 'assistant' : 'user',
    content: r.role === ROLE_GM ? r.text
      : gmUserTurn(r.text, nameOf(s, r.speaker)),
  })).filter((m) => String(m.content || '').trim());

  let total = rows.reduce((n, m) => n + estimateTokens(m.content), 0);
  let i = 0;
  while (total > MAX_CTX_TOKENS && i < rows.length - 2) {
    total -= estimateTokens(rows[i].content);
    i++;
  }
  return i ? rows.slice(i) : rows;
}

async function callGm(s, sc, extraUser, reqId) {
  const { currentProvider, complete } = await import('../ai/ai-provider-ui.js');
  const p = await currentProvider();
  if (!p) { setStatus(t('ui.aiSet.aICantPickProvider')); return null; }

  const rows = await listScenarios(s.slug);
  const prev = sc.prevId ? rows.find((r) => r.id === sc.prevId) || null : null;
  const system = gmSystem(s, sc, { prev, userChars: sc.userChars || [], len: sc.len });

  const messages = historyMessages(s, sc);
  if (extraUser) messages.push({ role: 'user', content: extraUser });

  log('info', 'starter gm: request',
      { reqId, provider: p.name, model: p.model, msgs: messages.length });
  const r = await complete(p, { system, messages, reqId, timeoutMs: 180000 });
  if (!r.ok) {
    // ผู้ใช้กดหยุดเอง = ไม่ใช่ข้อผิดพลาด · หมดเวลา/ล้มเหลว = ต้องเห็นใน log
    log(r.aborted && !r.timedOut ? 'info' : 'error',
        'starter gm: ' + (r.aborted ? (r.timedOut ? 'timeout' : 'stopped by user') : 'failed'),
        { error: r.error, status: r.status, reqId });
    setStatus((r.aborted && !r.timedOut ? '⏹ ' : '❌ ') + 'AI: ' + r.error);
    return null;
  }
  log('info', 'starter gm: reply', { reqId, chars: (r.text || '').length, usage: r.usage || null });
  return { text: (r.text || '').trim(), thinking: r.thinking || '',
           model: r.model || '', provider: r.provider || '', usage: r.usage || null };
}

// ───────────────────────── หน้าจอ ─────────────────────────

export async function renderChat(host, ctx, sc) {
  const s = ctx.starter;
  host.innerHTML = '';
  const wrap = el('div', 'st-chat');
  host.append(wrap);

  // ── หัว ──────────────────────────────────────────────────
  const head = el('div', 'st-chat-head');
  const back = el('button', 'st-back', '← ' + t('ui.starter.backToScenarios'));
  back.onclick = () => ctx.goHome();
  head.append(back);
  head.append(el('div', 'st-chat-title', sc.title || t('ui.starter.scUntitled')));
  const st = scenarioStats(sc);
  const metaEl = el('div', 'st-chat-meta', tf('ui.starter.scStats', st.turns, st.words));
  head.append(metaEl);
  const tokEl = el('span', 'st-chat-tok');
  tokEl.append(tokenBadge(st));
  head.append(tokEl);
  wrap.append(head);

  // ── บทสนทนา ──────────────────────────────────────────────
  const log2 = el('div', 'st-chat-log');
  wrap.append(log2);

  const drawLog = () => {
    log2.innerHTML = '';
    if (!(sc.turns || []).length) {
      const empty = el('div', 'st-empty');
      empty.append(el('div', null, t('ui.starter.chatEmpty')));
      const start = el('button', 'k-ok', '▶ ' + t('ui.starter.chatStart'));
      start.onclick = () => send('', { opening: true });
      empty.append(start);
      log2.append(empty);
      return;
    }
    for (const turn of sc.turns) {
      const row = el('div', 'st-turn ' + (turn.role === ROLE_GM ? 'gm' : 'player'));
      const who = turn.role === ROLE_GM
        ? '🎲 ' + t('ui.starter.gm')
        : '🙂 ' + (nameOf(s, turn.speaker) || t('ui.starter.you'));
      row.append(el('div', 'st-turn-who', who));
      const body = el('div', 'st-turn-text', turn.text);
      row.append(body);
      if (turn.chosen) row.append(el('div', 'st-turn-chosen', '↳ ' + turn.chosen));
      log2.append(row);
    }
    log2.scrollTop = log2.scrollHeight;
  };

  // ── ทางเลือก + ช่องพิมพ์ ────────────────────────────────
  const foot = el('div', 'st-chat-foot');
  wrap.append(foot);

  const drawFoot = () => {
    foot.innerHTML = '';
    if (CHAT_C.sending) {
      // [alpha.96] ต้องหยุดได้ — เดิมค้างเป็น "กำลังคิด…" แล้วทำอะไรไม่ได้เลย
      const busy = el('div', 'st-chat-busy');
      busy.append(el('span', 'st-dim', '⏳ ' + t('ui.starter.gmThinking')));
      const stop = el('button', 'st-danger st-chat-stop', '⏹ ' + t('ui.starter.aiStop'));
      stop.onclick = async () => {
        stop.disabled = true;
        stop.textContent = '⏹ ' + t('ui.starter.aiStopping');
        await stopAI(CHAT_C.reqId);
      };
      busy.append(stop);
      foot.append(busy);
      return;
    }

    // ทางเลือกที่ GM ยื่นมา (สเปกข้อ 13)
    const choices = openChoices(sc);
    if (choices.length) {
      const box = el('div', 'st-choices');
      box.append(el('div', 'st-choices-head', t('ui.starter.chooseOrType')));
      choices.forEach((c, i) => {
        const b = el('button', 'st-choice');
        b.append(el('span', 'st-choice-n', String(i + 1)));
        b.append(el('span', 'st-choice-t', c));
        b.onclick = () => send(c, { chosen: c });
        box.append(b);
      });
      foot.append(box);
    }

    // สวมบทเป็นใคร — โผล่เฉพาะตอนที่ผู้เล่นคุมมากกว่าหนึ่งตัว
    const mine = (sc.userChars || []).map((id) => charById(s, id)).filter(Boolean);
    if (mine.length > 1) {
      const asRow = el('div', 'st-as-row');
      asRow.append(el('span', 'st-dim', t('ui.starter.speakAs')));
      const sel = el('select', 'wiki-input k-dlg-select st-as');
      const me = el('option', null, t('ui.starter.you')); me.value = '';
      sel.append(me);
      for (const c of mine) { const o = el('option', null, c.name); o.value = c.id; sel.append(o); }
      sel.value = CHAT_C.speaker;
      sel.onchange = () => { CHAT_C.speaker = sel.value; };
      asRow.append(sel);
      foot.append(asRow);
    } else if (mine.length === 1) {
      CHAT_C.speaker = mine[0].id;
    }

    const row = el('div', 'st-chat-input');
    const ta = el('textarea', 'wiki-input st-chat-ta');
    ta.rows = 2;
    ta.value = CHAT_C.draft;
    ta.placeholder = t('ui.starter.chatPlaceholder');
    ta.oninput = () => { CHAT_C.draft = ta.value; };
    ta.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); }
    };
    const go = el('button', 'k-ok', t('ui.starter.chatSend'));
    const doSend = () => {
      const v = ta.value.trim();
      if (!v) return;
      CHAT_C.draft = '';
      send(v, {});
    };
    go.onclick = doSend;
    row.append(ta, go);
    foot.append(row);

    // เครื่องมือท้ายตอน
    if ((sc.turns || []).length) {
      const tools = el('div', 'st-row-btns');
      const recap = el('button', null, '📝 ' + t('ui.starter.makeRecap'));
      recap.title = t('ui.starter.makeRecapHint');
      recap.onclick = () => makeRecap();
      tools.append(recap);
      const clear = el('button', 'st-danger', t('ui.starter.chatClear'));
      clear.onclick = async () => {
        if (!(await confirmBox(t('ui.starter.chatClearAsk'), t('ui.common.del')))) return;
        sc.turns = [];
        await writeScenario(s.slug, sc);
        drawLog(); drawFoot();
      };
      tools.append(clear);
      foot.append(tools);
    }
  };

  // ── ส่ง ──────────────────────────────────────────────────
  async function send(text, { chosen = '', opening = false } = {}) {
    if (CHAT_C.sending) return;
    CHAT_C.sending = true;
    CHAT_C.reqId = newReqId();
    drawFoot();
    try {
      if (!opening) {
        const patched = addTurn(sc, { role: ROLE_PLAYER, text, chosen,
                                      speaker: CHAT_C.speaker, ts: Date.now() });
        sc.turns = patched.turns;
        // [alpha.96] เขียนลงไฟล์ **ทันที** ไม่หน่วงรวบ
        // ผู้ใช้รายงานว่า "ปิดแผงก่อนตอบ choice แล้วคำตอบหาย" — เพราะของยังค้างอยู่ในคิว
        await writeScenario(s.slug, sc);
        drawLog();
      }
      const extra = opening ? gmOpening(s, sc) : null;
      const r = await callGm(s, sc, extra, CHAT_C.reqId);
      if (!r) return;
      const choices = parseChoices(r.text);
      const prose = stripChoices(r.text);
      const patched2 = addTurn(sc, { role: ROLE_GM, text: prose, choices,
                                     thinking: r.thinking, model: r.model,
                                     provider: r.provider, usage: r.usage, ts: Date.now() });
      sc.turns = patched2.turns;
      await writeScenario(s.slug, sc);          // เทิร์นของ GM ก็ลงดิสก์ทันทีเช่นกัน
    } catch (e) {
      log('error', 'starter chat send', e);
      setStatus(t('ui.starter.chatFail'));
    } finally {
      CHAT_C.sending = false; CHAT_C.reqId = '';
      drawLog(); drawFoot();
      // สถิติ + โทเคนบนหัวเปลี่ยนทุกเทิร์น
      const st2 = scenarioStats(sc);
      metaEl.textContent = tf('ui.starter.scStats', st2.turns, st2.words);
      tokEl.innerHTML = ''; tokEl.append(tokenBadge(st2));
    }
  }

  /** บทย่อของตอนนี้ — ตอนถัดไปที่เชื่อมกับตอนนี้จะได้รับก้อนนี้ไป (ไม่ใช่บทเต็ม) */
  async function makeRecap() {
    if (CHAT_C.sending) return;
    CHAT_C.sending = true; drawFoot();
    try {
      const { askAI } = await import('./starter-ai.js');
      CHAT_C.reqId = newReqId();
      const tr = transcriptText(sc, (id) => nameOf(s, id));
      const out = await askAI('recap', recapPrompt(s, sc, tr),
                              t('ui.starter.sysWriter'), CHAT_C.reqId);
      if (!out) { setStatus(t('ui.starter.aiNoResult')); return; }
      sc.recap = out;
      if (!String(sc.synopsis || '').trim()) sc.synopsis = out;
      await writeScenario(s.slug, sc);
      setStatus(t('ui.starter.recapDone'));
    } finally { CHAT_C.sending = false; CHAT_C.reqId = ''; drawFoot(); }
  }

  drawLog();
  drawFoot();
  return true;
}

/** ล้างสถานะชั่วคราวตอนสลับตอน/สลับเรื่อง — ไม่งั้นร่างของตอนก่อนติดมา */
export function resetChatState() {
  CHAT_C.sending = false; CHAT_C.speaker = ''; CHAT_C.draft = ''; CHAT_C.reqId = '';
}
/** คำขอที่กำลังวิ่งของแชท (แผงใช้สั่งหยุดตอนปิด) */
export function chatReqId() { return CHAT_C.reqId; }
