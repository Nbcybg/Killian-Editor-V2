// ai-rewrite-ui.js — "Rewrite this": เลือกข้อความ → คลิกขวา → แถบลอยใต้ (หรือเหนือ) ข้อความที่เลือก
//
//   ช่องบน  = Agent บุคลิกการเขียน (ตั้งค่า AI → Agents) — กำหนดแนวทางการเขียน
//   ช่องล่าง = คำสั่งของผู้ใช้ (Enter = ส่ง · Shift+Enter = ขึ้นบรรทัด)
//   กด "เขียนใหม่" → AI เขียนข้อความที่เลือกใหม่ โดยอ้างอิง: บุคลิก+อ้างอิงของ agent · เนื้อหารอบข้าง
//   · Wiki ของตัวละคร/สถานที่ที่ถูกเอ่ยถึง · ข้อความที่เกี่ยวข้องจากทั้งโปรเจกต์ (RAG) · เข็มทิศเรื่อง
//   แล้ว **แทนที่ในเอกสารทันที** (Ctrl+Z / ปุ่มย้อนกลับ ได้) · ลองใหม่ได้เรื่อย ๆ จากต้นฉบับเดิม
//
// ตรรกะที่เทสได้ (สร้าง prompt · ทำความสะอาดคำตอบ · ตรวจช่วง) อยู่ใน ai-agents.js

import { t, tf } from '../i18n.js';
import { el, state, setStatus, log } from '../core.js';
import { gi } from '../icons.js';
import { TextSelection } from 'prosemirror-state';
import { listAgents, buildRewritePrompt, cleanRewriteOutput, resolveRange, AROUND_CHARS } from './ai-agents.js';

const LAST_AGENT_KEY = 'k2-rewrite-agent';
let _bar = null;           // แถบที่เปิดอยู่ (มีได้ทีละอัน)

export function closeRewriteBar() {
  if (!_bar) return;
  const b = _bar;
  _bar = null;
  b.close();
}
export function rewriteBarOpen() { return !!_bar; }

/** ป้าย/คำสั่งที่ส่งให้โมเดล (แปลตามภาษาที่ผู้ใช้เลือก) */
function promptLabels() {
  return {
    role: t('ui.aiRewrite.pRole'),
    rules: [t('ui.aiRewrite.pRule1'), t('ui.aiRewrite.pRule2'), t('ui.aiRewrite.pRule3'), t('ui.aiRewrite.pRule4')],
    persona: t('ui.aiRewrite.pPersona'),
    screenplay: t('ui.aiRewrite.pScreenplay'),
    refs: t('ui.aiRewrite.pRefs'),
    project: t('ui.aiRewrite.pProject'),
    before: t('ui.aiRewrite.pBefore'),
    after: t('ui.aiRewrite.pAfter'),
    instruction: t('ui.aiRewrite.pInstruction'),
    defaultInstruction: t('ui.aiRewrite.pDefaultInstruction'),
    source: t('ui.aiRewrite.pSource'),
    output: t('ui.aiRewrite.pOutput'),
  };
}

/** Wiki ของสิ่งที่ถูกเอ่ยชื่อในข้อความ (สูงสุด 8 รายการ · สรุปสั้น) */
async function mentionedWiki(text) {
  if (!state.root || !text) return '';
  try {
    const { listEntities } = await import('../project-scan.js');
    const hits = [];
    for (const e of await listEntities(state.root)) {
      const names = [e.name, ...(e.aliases || [])].filter((n) => n && String(n).length >= 2);
      if (!names.some((n) => text.includes(n))) continue;
      const f = e.entity.fields || {};
      const summary = Object.entries(f).filter(([, v]) => v && typeof v === 'string')
        .map(([k, v]) => k + ': ' + v).join(' · ').replace(/\s+/g, ' ');
      hits.push('- ' + e.name + (summary ? ' — ' + (summary.length > 320 ? summary.slice(0, 320) + '…' : summary) : ''));
      if (hits.length >= 8) break;
    }
    return hits.join('\n');
  } catch (e) { log('warn', 'rewrite: wiki', e); return ''; }
}

/** ข้อความที่เกี่ยวข้องจากทั้งโปรเจกต์ (ดัชนี RAG เดียวกับผู้ช่วยเขียน) — พังได้ ไม่ขวางงาน */
async function projectSnippets(query) {
  try {
    const { ragContext } = await import('./ai-bridge.js');
    const r = await ragContext(query, { k: 4, maxTokens: 900 });
    return (r && r.text) || '';
  } catch (e) { log('warn', 'rewrite: rag', e); return ''; }
}

/**
 * เปิดแถบ Rewrite this ของข้อความที่เลือกอยู่ในแท็บ
 * @param {object} tab  แท็บที่มี `.editor` (นิยาย) หรือ `.sp` (บทหนัง)
 * @returns {boolean} true = เปิดแถบแล้ว
 */
export function openRewriteBar(tab) {
  const ed = tab && (tab.editor || tab.sp);
  const view = ed && ed.view;
  if (!view) return false;
  const { from, to } = view.state.selection;
  if (from >= to) { setStatus(t('ui.aiRewrite.needSelection')); return false; }
  if (view.editable === false) { setStatus(gi('warning') + ' ' + t('ui.aiRewrite.locked')); return false; }
  closeRewriteBar();

  const isSp = !!tab.sp && !tab.editor;
  const original = view.state.doc.textBetween(from, to, '\n');
  // ช่วงปัจจุบันของข้อความ "ของเรา" ในเอกสาร — ตอนแรก = ต้นฉบับ · แทนที่แล้ว = ผลล่าสุด
  const cur = { from, to, text: original, replaced: false };

  const bar = el('div', 'k-rewrite-bar');
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', t('ui.aiRewrite.title'));
  const head = el('div', 'k-rewrite-head');
  head.append(el('span', 'k-rewrite-title', gi('pen') + ' ' + t('ui.aiRewrite.title')));
  const preview = el('span', 'k-rewrite-src dim', original.replace(/\s+/g, ' ').slice(0, 80) + (original.length > 80 ? '…' : ''));
  preview.title = original;
  const xBtn = el('button', 'k-rewrite-x', gi('close'));
  xBtn.title = t('ui.common.close');
  head.append(preview, xBtn);

  // ช่องบน: agent
  const agRow = el('div', 'k-rewrite-row');
  agRow.append(el('label', 'k-rewrite-lbl', t('ui.aiRewrite.agent')));
  const agSel = el('select', 'wiki-input k-dlg-select k-rewrite-agent');
  agRow.append(agSel);
  const agents = listAgents((state.meta && state.meta.ai) || {});
  const opt = (text, value) => { const o = el('option', null, text); o.value = value; agSel.append(o); };
  opt(t('ui.aiRewrite.noAgent'), '');
  for (const a of agents) opt(a.name, a.id);
  opt(gi('cog') + ' ' + t('ui.aiRewrite.manageAgents'), '::manage');
  let lastAgent = '';
  try { lastAgent = localStorage.getItem(LAST_AGENT_KEY) || ''; } catch {}
  agSel.value = agents.some((a) => a.id === lastAgent) ? lastAgent : '';
  let prevAgent = agSel.value;
  agSel.onchange = async () => {
    if (agSel.value === '::manage') {
      agSel.value = prevAgent;
      closeRewriteBar();
      const { showAISettingsDialog } = await import('./ai-provider-ui.js');
      showAISettingsDialog();
      return;
    }
    prevAgent = agSel.value;
    try { localStorage.setItem(LAST_AGENT_KEY, agSel.value); } catch {}
  };

  // ช่องล่าง: คำสั่ง
  const inp = el('textarea', 'wiki-input k-rewrite-input');
  inp.rows = 2;
  inp.placeholder = t('ui.aiRewrite.promptPh');

  const out = el('div', 'k-rewrite-out');
  out.hidden = true;
  const msg = el('div', 'k-rewrite-msg dim');

  const btns = el('div', 'k-rewrite-btns');
  const runB = el('button', 'k-ok k-rewrite-run', t('ui.aiRewrite.run'));
  const stopB = el('button', 'k-rewrite-stop', gi('stop') + ' ' + t('ui.aiRewrite.stop'));
  const undoB = el('button', 'k-rewrite-undo', gi('undo') + ' ' + t('ui.aiRewrite.undo'));
  const copyB = el('button', 'k-rewrite-copy', t('ui.common.copy'));
  const doneB = el('button', 'k-rewrite-done', t('ui.aiRewrite.done'));
  stopB.hidden = undoB.hidden = copyB.hidden = doneB.hidden = true;
  btns.append(msg, stopB, undoB, copyB, runB, doneB);

  bar.append(head, agRow, inp, out, btns);
  document.body.append(bar);

  // ไฮไลต์ข้อความที่กำลังจะถูกเขียนใหม่ — โฟกัสย้ายมาที่แถบแล้ว selection ของตัวแก้ไขจะไม่ถูกวาด
  // ผู้ใช้จึงไม่เห็นว่าช่วงไหนจะถูกแทนที่ (วาดเป็นกล่องลอย ไม่แตะเอกสาร · ตัดขอบตามช่องตัวแก้ไข)
  const hl = el('div', 'k-rewrite-hls');
  document.body.append(hl);
  const paneOf = () => view.dom.closest('.pane') || view.dom.parentElement;
  function drawHl() {
    hl.replaceChildren();
    const pr = paneOf().getBoundingClientRect();
    Object.assign(hl.style, { left: pr.left + 'px', top: pr.top + 'px', width: pr.width + 'px', height: pr.height + 'px' });
    try {
      const a = view.domAtPos(cur.from), b = view.domAtPos(cur.to);
      const rg = document.createRange();
      rg.setStart(a.node, a.offset); rg.setEnd(b.node, b.offset);
      for (const rc of rg.getClientRects()) {
        if (rc.width < 1 || rc.height < 1) continue;
        const d = el('div', 'k-rewrite-hl');
        Object.assign(d.style, { left: (rc.left - pr.left) + 'px', top: (rc.top - pr.top) + 'px',
                                 width: rc.width + 'px', height: rc.height + 'px' });
        hl.append(d);
      }
    } catch {}
  }

  // ── ตำแหน่ง: ใต้ข้อความที่เลือก · ล้นจอ = เหนือข้อความ · อยู่ในช่องตัวแก้ไข (ช่องแคบมาก = ในจอ) ──
  function place() {
    if (!bar.isConnected) return;
    if (view.isDestroyed) { closeRewriteBar(); return; }
    let a, b;
    try { a = view.coordsAtPos(Math.min(cur.from, view.state.doc.content.size));
          b = view.coordsAtPos(Math.min(cur.to, view.state.doc.content.size)); } catch { return; }
    const W = window.innerWidth, H = window.innerHeight, M = 8;
    const pr = paneOf().getBoundingClientRect();
    const inPane = pr.width >= 380;
    bar.style.width = inPane ? Math.min(560, pr.width - 2 * M) + 'px' : '';
    const r = bar.getBoundingClientRect();
    let top = b.bottom + M;
    if (top + r.height > H - M) top = Math.max(M, a.top - r.height - M);
    const lo = inPane ? pr.left + M : M;
    const hi = inPane ? pr.right - r.width - M : W - r.width - M;
    const left = Math.max(lo, Math.min(Math.min(a.left, b.left), hi));
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(top) + 'px';
    drawHl();
  }
  place();
  setTimeout(() => inp.focus(), 0);

  let reqId = '';
  let busy = false;
  const onScroll = () => place();
  const onResize = () => place();
  // scroll ไม่ bubble แต่ดักระยะ capture ที่ window ได้ทุกกล่องที่เลื่อน
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);
  function onKey(e) {
    if (e.key === 'Escape' && _bar === ctl) { e.stopPropagation(); e.preventDefault(); closeRewriteBar(); }
  }
  document.addEventListener('keydown', onKey, true);

  const ctl = {
    close() {
      if (busy && reqId && kapi.httpAbort) { try { kapi.httpAbort(reqId); } catch {} }
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey, true);
      bar.remove();
      hl.remove();
      try { if (!view.isDestroyed) view.focus(); } catch {}
    },
  };
  _bar = ctl;
  xBtn.onclick = () => closeRewriteBar();
  doneB.onclick = () => closeRewriteBar();
  inp.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) run(); }
  };
  runB.onclick = () => { if (!busy) run(); };
  stopB.onclick = () => { if (reqId && kapi.httpAbort) kapi.httpAbort(reqId); };
  copyB.onclick = () => { navigator.clipboard.writeText(out.textContent || '').then(() => setStatus(t('ui.aiRewrite.copied'))); };
  undoB.onclick = () => {
    if (!cur.replaced) return;
    if (replaceRange(cur.text, original)) {
      cur.replaced = false;
      undoB.hidden = true;
      msg.textContent = t('ui.aiRewrite.restored');
    } else msg.textContent = gi('warning') + ' ' + t('ui.aiRewrite.changed');
  };

  function textAt(a, b) { return view.state.doc.textBetween(a, b, '\n'); }

  /** แทนที่ช่วง cur (ต้องยังเป็น `expect`) ด้วย `text` · คืน false เมื่อเอกสารเปลี่ยนไปแล้ว */
  function replaceRange(expect, text) {
    if (view.isDestroyed) return false;
    const rg = resolveRange(textAt, cur.from, cur.to, expect);
    if (!rg) return false;
    const before = view.state.doc.content.size;
    const multi = text.includes('\n');
    if (!multi) {
      view.dispatch(view.state.tr.insertText(text, rg.from, rg.to).scrollIntoView());
    } else {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, rg.from, rg.to)));
      const ok = isSp ? tab.sp.insertScript(text) : tab.editor.insertLines(text);
      if (!ok) return false;
    }
    const after = view.state.doc.content.size;
    cur.to = rg.to + (after - before);
    cur.text = textAt(cur.from, cur.to);
    // เลือกข้อความใหม่ไว้ ให้เห็นว่าอะไรถูกเปลี่ยน (และสั่ง Rewrite ซ้ำได้ทันที)
    try { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cur.from, cur.to))); } catch {}
    place();
    return true;
  }

  async function run() {
    const { aiConfigured } = await import('../ai-settings.js');
    const ready = await aiConfigured();
    if (!ready.ok) { msg.textContent = gi('fail') + ' ' + (ready.why || t('ui.aiRewrite.needSetup')); return; }
    busy = true;
    runB.disabled = true; agSel.disabled = true;
    stopB.hidden = false; undoB.hidden = copyB.hidden = doneB.hidden = true;
    out.hidden = false; out.textContent = ''; out.dataset.state = 'busy';
    msg.textContent = t('ui.aiRewrite.gathering');
    place();
    reqId = 'rewrite-' + Date.now().toString(36);
    try {
      const agent = agents.find((a) => a.id === agSel.value) || null;
      const doc = view.state.doc;
      const beforeTxt = doc.textBetween(Math.max(0, cur.from - AROUND_CHARS * 3), cur.from, '\n');
      const afterTxt = doc.textBetween(cur.to, Math.min(doc.content.size, cur.to + AROUND_CHARS * 3), '\n');
      const instruction = inp.value.trim();
      let refText = '';
      if (agent) {
        const { agentReferenceText } = await import('./ai-agents-ui.js');
        const r = await agentReferenceText(agent);
        refText = r.text;
        if (r.missing.length) log('warn', 'rewrite: missing references', r.missing);
      }
      const wiki = await mentionedWiki(beforeTxt.slice(-AROUND_CHARS) + '\n' + original + '\n' + afterTxt.slice(0, AROUND_CHARS));
      const rag = await projectSnippets(original + (instruction ? '\n' + instruction : ''));
      const project = [wiki && (t('ui.aiRewrite.pWiki') + '\n' + wiki), rag].filter(Boolean).join('\n\n');
      const built = buildRewritePrompt({ text: original, instruction, agent, refText, project,
                                         before: beforeTxt, after: afterTxt, format: isSp ? 'screenplay' : 'prose' },
                                       promptLabels());
      msg.textContent = t('ui.aiRewrite.working');
      const { getAIClient } = await import('./ai-bridge.js');
      let acc = '';
      const res = await getAIClient().stream({ system: built.system, prompt: built.prompt, feature: 'rewrite', reqId },
        (delta) => { acc += delta || ''; out.textContent = acc; place(); });
      const got = cleanRewriteOutput((res && res.ok ? res.text : '') || '', original);
      if (!res || !res.ok || !got) {
        out.dataset.state = 'err';
        const why = (res && res.aborted && !res.timedOut) ? t('ui.aiRewrite.stopped') : ((res && res.error) || t('ui.aiRewrite.empty'));
        msg.textContent = gi('fail') + ' ' + why;
        if (acc.trim()) { out.textContent = acc; copyB.hidden = false; }
        return;
      }
      out.textContent = got;
      out.dataset.state = 'ok';
      const expect = cur.replaced ? cur.text : original;
      if (replaceRange(expect, got)) {
        cur.replaced = true;
        undoB.hidden = false;
        msg.textContent = gi('check-circle') + ' ' + t('ui.aiRewrite.replaced');
        setStatus(t('ui.aiRewrite.replaced'));
      } else {
        copyB.hidden = false;
        msg.textContent = gi('warning') + ' ' + t('ui.aiRewrite.changed');
      }
      runB.textContent = t('ui.aiRewrite.again');
      doneB.hidden = false;
    } catch (e) {
      out.dataset.state = 'err';
      msg.textContent = gi('fail') + ' ' + String((e && e.message) || e);
      log('error', 'rewrite failed', e);
    } finally {
      busy = false;
      runB.disabled = false; agSel.disabled = false;
      stopB.hidden = true;
      place();
    }
  }
  return true;
}
