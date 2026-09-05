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
import { confirmBox, setSpeechText } from '../ui.js';
import { sanitizeHtml, htmlToDisplay } from './starter-html.js';
import { estimateTokens } from '../ai/ai-session.js';
import { ROLE_GM, ROLE_PLAYER, addTurn, openChoices, scenarioStats, transcriptText, charById,
  openerText, openerHtml, hasOpener }
  from './starter-model.js';
import { gmSystem, gmOpening, gmUserTurn, recapPrompt, mentionCtx } from './starter-prompt.js';
import { parseChoices, stripChoices } from './starter-choices.js';
import { writeScenario, listScenarios, imageUrl, starterDir } from './starter-store.js';
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
  // รูปในบทเปิดเก็บเป็น `images/x.png` — ต้องคลายเป็น file:// ก่อนวาด (กติกาเดียวกับคำบรรยายเรื่อง)
  const baseUrl = s.slug ? await kapi.toFileURL(await starterDir(s.slug)) : '';
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

  /** รูปประกอบของเทิร์น — วาดทีหลังแบบ async เพราะต้องแปลง path เป็น file:// ก่อน */
  /**
   * [alpha.124 ข้อ 9] ★ รูปของเทิร์นต้องอยู่ **เหนือข้อความ** ตามที่ประกาศไว้ใน CHANGELOG
   *
   * ต้นตอ: ตัวนี้เป็น `async` (ต้อง `await imageUrl()` เพื่อแปลง path เป็น URL ที่แสดงได้)
   * แต่ผู้เรียกไม่ได้ await → `row.append(box)` ข้างในเกิด **หลัง** `row.append(body)`
   * ของผู้เรียกเสมอ · รูปเลยไปโผล่ใต้ข้อความทุกครั้ง
   *
   * แก้โดย **จองที่ไว้ก่อนแบบซิงโครนัส** แล้วค่อยเติม `src` ทีหลัง — ลำดับใน DOM
   * จึงถูกตั้งแต่วินาทีแรกโดยไม่ต้องแก้ผู้เรียกให้เป็น async ทั้งสาย (drawLog ถูกเรียกถี่มาก)
   */
  const attachImage = (row, file) => {
    if (!file) return null;
    const box = el('div', 'st-turn-img st-turn-img-loading');
    row.append(box);                       // ← จองที่ทันที (ก่อน body ถูก append)
    imageUrl(s.slug, file).then((url) => {
      if (!url || !box.isConnected) { box.remove(); return; }
      const im = el('img');
      im.src = url; im.alt = '';
      // คลิกขยาย — ใช้ตัวเดียวกับทั้งโปรแกรม ไม่ทำ lightbox ของตัวเอง
      im.onclick = async () => {
        const { imageLightbox } = await import('../wiki.js');
        imageLightbox(url, '');
      };
      box.classList.remove('st-turn-img-loading');
      box.append(im);
    }).catch(() => box.remove());
    return box;
  };

  const drawLog = () => {
    log2.innerHTML = '';
    if (!(sc.turns || []).length) {
      const empty = el('div', 'st-empty');
      empty.append(el('div', null, t('ui.starter.chatEmpty')));
      // [alpha.122] มีบทเปิดของตัวเอง = บอกให้เห็นก่อนกด ว่ากดแล้วจะได้อะไร (และไม่เสียโทเคน)
      if (hasOpener(sc)) {
        empty.append(el('div', 'st-hint', '📖 ' + t('ui.starter.chatHasOpener')));
      }
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
      if (turn.image) attachImage(row, turn.image);
      const body = el('div', 'st-turn-text');
      // [alpha.123] เทิร์นที่มาจาก "บทเปิด" เก็บ HTML ไว้ด้วย (ตัวหนา/เอียง/ขีดเส้นใต้)
      // ที่เหลือ = ข้อความล้วนจากโมเดล → ทำบทพูดเป็นตัวเอียงให้เอง
      if (turn.html) body.innerHTML = htmlToDisplay(sanitizeHtml(turn.html), baseUrl);
      else setSpeechText(body, turn.text);
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

    // ── [alpha.122] บทเปิดที่ผู้ใช้เขียนเอง = เทิร์นแรกจริง ๆ ไม่ต้องถามโมเดล ──
    //
    // ผู้ใช้: *"Story Opener = เปิดเรื่องยังไง มีให้ใส่รูป จะปรากฏในช่อง chat"*
    // "ปรากฏในช่อง chat" = ต้องเป็นบทเปิดตัวจริงตามตัวอักษร ไม่ใช่ให้โมเดลเรียบเรียงใหม่
    // ผลพลอยได้: เริ่มเล่นแล้วเห็นทันที ไม่ต้องรอ ไม่เสียโทเคน และออฟไลน์ก็ยังเริ่มได้
    if (opening && hasOpener(sc)) {
      // [alpha.124 ข้อ 10] ★ สายนี้เคยไม่ตั้ง `sending` เลย — มันไม่ต้องรอโมเดลก็จริง
      // แต่ยัง `await writeScenario()` ซึ่งกินเวลาพอให้คลิกที่สองแทรกเข้ามาได้สบาย ๆ
      // (ผู้ใช้ดับเบิลคลิกปุ่ม "เริ่มเล่น" = ได้บทเปิดซ้ำสองเทิร์นติดกัน)
      // ตั้งธงเหมือนสายปกติ แล้วปลดใน finally — `if (CHAT_C.sending) return` ข้างบนกันให้เอง
      CHAT_C.sending = true;
      drawFoot();
      const mc = mentionCtx(s, sc);
      const patched = addTurn(sc, {
        role: ROLE_GM,
        // `text` = ตัวจริงสำหรับโมเดล/นับคำ/แปลงเป็นต้นฉบับ · `html` = สิ่งที่ผู้ใช้จัดรูปแบบไว้
        text: openerText(sc, s.cast || [], mc),
        html: openerHtml(sc, s.cast || [], mc),
        image: sc.openerImage || '', ts: Date.now(),
      });
      sc.turns = patched.turns;
      try { await writeScenario(s.slug, sc); }
      finally { CHAT_C.sending = false; }
      drawLog(); drawFoot();
      return;
    }

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
