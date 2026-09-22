// ai-agents-ui.js — หน้าตาของ "Agent บุคลิกการเขียน" (ตั้งค่า AI → Agents)
//
// ตรรกะ/รูปแบบข้อมูลอยู่ใน ai-agents.js (บริสุทธิ์ · มี unit test) — ไฟล์นี้วาดกล่องและแตะดิสก์เท่านั้น
// agent หนึ่งตัว = ชื่อ · บุคลิก (แนวการเขียน ธีม โทน กฎ) · อ้างอิง (พิมพ์เอง หรือไฟล์ .txt)

import { t, tf } from '../i18n.js';
import { el, state, log } from '../core.js';
import { gi } from '../icons.js';
import { fmtNum } from '../locale.js';
import { newAgent, newRef, validateAgent, safeRefFileName, agentRefText, REF_BUDGET } from './ai-agents.js';

/** โฟลเดอร์ในโปรเจกต์ที่เก็บสำเนาไฟล์อ้างอิงที่เลือกมาจากนอกโปรเจกต์ */
export const REF_DIR = 'References';
/** ไฟล์ภาษาเก็บขึ้นบรรทัดเป็น `\n` สองตัวอักษร (แถวเดียวต่อคีย์) — แปลงกลับตอนใช้ */
const nl = (s) => String(s).replace(/\\n/g, '\n');

/** อ่านไฟล์อ้างอิงทุกตัวของ agent → { path: เนื้อไฟล์ } (อ่านไม่ได้ = ไม่มีคีย์ ให้ agentRefText รายงาน missing) */
export async function readAgentFiles(agent) {
  const out = {};
  if (!state.root || !agent) return out;
  for (const r of agent.refs || []) {
    if (r.kind !== 'file' || !r.path || out[r.path] != null) continue;
    try {
      const txt = await kapi.readFile(await kapi.join(state.root, r.path));
      if (typeof txt === 'string') out[r.path] = txt;
    } catch (e) { log('warn', 'ai-agent: read reference', { path: r.path, error: String(e && e.message || e) }); }
  }
  return out;
}

/** ข้อความอ้างอิงรวมของ agent พร้อมส่งให้โมเดล */
export async function agentReferenceText(agent) {
  if (!agent) return { text: '', used: 0, truncated: false, missing: [] };
  return agentRefText(agent, await readAgentFiles(agent), REF_BUDGET);
}

/**
 * เลือกไฟล์ .txt → คืน ref ชนิด file
 * ไฟล์อยู่ในโปรเจกต์อยู่แล้ว = อ้าง path เดิม (แก้ไฟล์แล้วมีผลทันที)
 * ไฟล์อยู่นอกโปรเจกต์ = ก๊อปเข้า `References/` (โปรเจกต์ยกไปเครื่องอื่นแล้วยังครบ)
 */
export async function importRefFile() {
  if (!state.root) return null;
  const src = await kapi.openFileDialog('txt');
  if (!src) return null;
  const base = String(src).split(/[\\/]/).pop();
  let rel = '';
  try { rel = await kapi.relative(state.root, src); } catch {}
  const inside = rel && !rel.startsWith('..') && !/^([a-zA-Z]:|[\\/])/.test(rel);
  if (inside) return newRef({ kind: 'file', name: base, path: rel.replace(/\\/g, '/') });
  const text = await kapi.readFile(src);
  if (typeof text !== 'string') return null;
  const dir = await kapi.join(state.root, REF_DIR);
  await kapi.mkdir(dir);
  const name = safeRefFileName(base);
  let file = name;
  for (let i = 2; await kapi.exists(await kapi.join(dir, file)); i++) file = name.replace(/\.txt$/i, '') + '-' + i + '.txt';
  await kapi.writeFile(await kapi.join(dir, file), text);
  return newRef({ kind: 'file', name: base, path: REF_DIR + '/' + file });
}

/**
 * กล่องเพิ่ม/แก้ agent
 * @param {object|null} existing
 * @returns {Promise<object|null>} agent ที่กรอกแล้ว หรือ null เมื่อยกเลิก
 */
export function agentDialog(existing) {
  return new Promise((resolve) => {
    const A = newAgent(existing ? JSON.parse(JSON.stringify(existing)) : {});
    const ov = el('div', 'k-overlay k-ai-agent-ov');
    ov.style.zIndex = '120';
    const box = el('div', 'k-dialog k-ai-agent');
    box.append(el('div', 'k-dlg-title', existing ? t('ui.aiAgent.editTitle') : t('ui.aiAgent.addTitle')));

    const field = (label, node, hint) => {
      const r = el('div', 'ai-field');
      r.append(el('label', null, label), node);
      if (hint) r.append(el('div', 'ai-hint dim', hint));
      box.append(r);
      return node;
    };
    // 1. ชื่อ
    const nameInp = field('1. ' + t('ui.aiAgent.name'), el('input', 'wiki-input ai-agent-name'));
    nameInp.value = A.name;
    nameInp.placeholder = t('ui.aiAgent.namePh');
    // 2. บุคลิก
    const persona = field('2. ' + t('ui.aiAgent.persona'), el('textarea', 'wiki-input ai-agent-persona'),
                          t('ui.aiAgent.personaHint'));
    persona.rows = 8;
    persona.value = A.persona;
    persona.placeholder = nl(t('ui.aiAgent.personaPh'));
    // แม่แบบหัวข้อ (สไตล์ · ธีม · โทน · แหล่งอ้างอิง · กฎ) — เติมท้ายของเดิม ไม่ทับ
    const tplBtn = el('button', 'ai-agent-tpl', t('ui.aiAgent.insertTemplate'));
    tplBtn.onclick = () => {
      const tpl = nl(t('ui.aiAgent.template'));
      persona.value = persona.value.trim() ? persona.value.replace(/\s+$/, '') + '\n\n' + tpl : tpl;
      persona.focus();
    };
    persona.parentNode.insertBefore(tplBtn, persona.nextSibling);

    // 3. อ้างอิง
    const refWrap = el('div', 'ai-field');
    refWrap.append(el('label', null, '3. ' + t('ui.aiAgent.refs')));
    const refList = el('div', 'ai-agent-refs');
    const refBtns = el('div', 'ai-agent-ref-btns');
    const addText = el('button', 'ai-agent-add-text', gi('plus-thick') + ' ' + t('ui.aiAgent.addTextRef'));
    const addFile = el('button', 'ai-agent-add-file', gi('file') + ' ' + t('ui.aiAgent.addFileRef'));
    const refMsg = el('span', 'dim ai-agent-ref-msg');
    refBtns.append(addText, addFile, refMsg);
    refWrap.append(refList, refBtns, el('div', 'ai-hint dim', tf('ui.aiAgent.refsHint', fmtNum(REF_BUDGET))));
    box.append(refWrap);

    let refs = A.refs.slice();
    function drawRefs() {
      refList.replaceChildren();
      if (!refs.length) refList.append(el('div', 'dim ai-agent-ref-empty', t('ui.aiAgent.noRefs')));
      refs.forEach((r, i) => {
        const row = el('div', 'ai-agent-ref');
        row.dataset.kind = r.kind;
        const head = el('div', 'ai-agent-ref-head');
        const nm = el('input', 'wiki-input ai-agent-ref-name');
        nm.value = r.name;
        nm.placeholder = r.kind === 'file' ? r.path : t('ui.aiAgent.refNamePh');
        nm.oninput = () => { refs[i] = { ...refs[i], name: nm.value }; };
        const kind = el('span', 'dim ai-agent-ref-kind',
          r.kind === 'file' ? gi('file') + ' ' + r.path : gi('pen') + ' ' + t('ui.aiAgent.kindText'));
        const del = el('button', 'ai-agent-ref-del', gi('trash'));
        del.title = t('ui.aiAgent.removeRef');
        del.onclick = () => { refs.splice(i, 1); drawRefs(); };
        head.append(nm, kind, del);
        row.append(head);
        if (r.kind === 'text') {
          const ta = el('textarea', 'wiki-input ai-agent-ref-text');
          ta.rows = 4;
          ta.value = r.text;
          ta.placeholder = t('ui.aiAgent.refTextPh');
          ta.oninput = () => { refs[i] = { ...refs[i], text: ta.value }; };
          row.append(ta);
        }
        refList.append(row);
      });
    }
    drawRefs();
    addText.onclick = () => {
      refs.push({ ...newRef({ kind: 'text', text: ' ' }), text: '' });
      drawRefs();
      const last = refList.querySelector('.ai-agent-ref:last-child .ai-agent-ref-text');
      if (last) last.focus();
    };
    addFile.onclick = async () => {
      refMsg.textContent = '';
      try {
        const r = await importRefFile();
        if (r) { refs.push(r); drawRefs(); }
      } catch (e) {
        refMsg.textContent = gi('fail') + ' ' + String((e && e.message) || e);
      }
    };

    const errBox = el('div', 'ai-prov-err');
    box.append(errBox);
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', 'k-cancel', t('ui.common.cancel'));
    const ok = el('button', 'k-ok ai-agent-ok', t('ui.common.save'));
    btns.append(cancel, ok);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    nameInp.focus();

    const done = (v) => { ov.remove(); document.removeEventListener('keydown', esc, true); resolve(v); };
    function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); done(null); } }
    document.addEventListener('keydown', esc, true);
    cancel.onclick = () => done(null);
    ok.onclick = () => {
      const out = newAgent({ id: A.id, name: nameInp.value, persona: persona.value, refs });
      if (validateAgent(out).length) { errBox.textContent = gi('warning') + ' ' + t('ui.aiAgent.needName'); nameInp.focus(); return; }
      done(out);
    };
  });
}
