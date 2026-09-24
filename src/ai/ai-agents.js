// ai-agents.js — System prompt ของผู้ใช้ + ทะเบียน "Agent บุคลิกการเขียน" + ตัวสร้าง prompt ของ Rewrite this
//
// โมดูลบริสุทธิ์ 100% (ไม่แตะ DOM / kapi / เน็ต) → unit test ได้ตรง ๆ (test/ai-agents.test.cjs)
// ข้อความที่ส่งให้โมเดลรับเข้ามาเป็นอาร์กิวเมนต์ `L` (ป้ายหัวข้อที่แปลแล้ว) — ไฟล์นี้จึงไม่ต้อง import i18n
//
// ที่เก็บ: `project.khn.json → ai.systemPrompt / ai.systemPromptOn / ai.agents[]`
//   agent = { id, name, persona, refs: [{ id, kind: 'text'|'file', name, text, path }] }
//   · kind 'text' = ผู้ใช้พิมพ์/วางเอง (เก็บตัวข้อความ)
//   · kind 'file' = ไฟล์ .txt ในโปรเจกต์ (เก็บ path สัมพัทธ์ · อ่านสดตอนใช้ — แก้ไฟล์นอกโปรแกรมได้)

/** เพดานความยาวอ้างอิงรวมต่อ agent ที่ส่งให้โมเดล (ตัวอักษร) — กันคำขอบวมจนเกินขีดจำกัดโมเดล */
export const REF_BUDGET = 12000;
/** เพดานบริบทรอบข้าง (ก่อน/หลังข้อความที่เลือก) ต่อฝั่ง */
export const AROUND_CHARS = 1200;

const uid = (p) => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

// ───────────────────────── System prompt ของผู้ใช้ ─────────────────────────

/** system prompt ที่ผู้ใช้ตั้งไว้และเปิดใช้อยู่ ('' = ไม่มี/ปิด) */
export function userSystemPrompt(ai) {
  const a = ai || {};
  const txt = String(a.systemPrompt || '').trim();
  if (!txt) return '';
  return a.systemPromptOn === false ? '' : txt;
}

/**
 * วาง system prompt ของผู้ใช้ **นำหน้า** system ของฟีเจอร์
 * (คำสั่งปลดตัวกรอง/กำหนดบทบาทต้องมาก่อน ไม่งั้นโมเดลยึดคำสั่งชุดแรกที่เห็น)
 * ซ้ำกันอยู่แล้ว (ผ่านมาสองชั้น) = ไม่ต่อซ้ำ
 */
export function withUserSystem(system, ai) {
  const u = userSystemPrompt(ai);
  const s = String(system || '');
  if (!u) return s;
  if (s.startsWith(u)) return s;
  return s.trim() ? u + '\n\n' + s : u;
}

// ───────────────────────── ทะเบียน Agent ─────────────────────────

export function newRef(p = {}) {
  const kind = p.kind === 'file' ? 'file' : 'text';
  return { id: p.id || uid('ref'), kind, name: String(p.name || '').trim(),
           text: kind === 'text' ? String(p.text || '') : '', path: kind === 'file' ? String(p.path || '') : '' };
}

export function newAgent(p = {}) {
  return {
    id: p.id || uid('agent'),
    name: String(p.name || '').trim(),
    persona: String(p.persona || ''),
    refs: Array.isArray(p.refs) ? p.refs.map(newRef).filter((r) => (r.kind === 'file' ? r.path : r.text.trim())) : [],
  };
}

/** @returns {string[]} รหัสปัญหา ('name') — UI แปลงเป็นข้อความเอง */
export function validateAgent(a) {
  const errs = [];
  if (!a || !String(a.name || '').trim()) errs.push('name');
  return errs;
}

export function listAgents(ai) {
  const rows = ai && Array.isArray(ai.agents) ? ai.agents : [];
  return rows.filter((a) => a && a.id).map((a) => newAgent(a));
}

export function upsertAgent(rows, agent) {
  const a = newAgent(agent);
  const list = (rows || []).slice();
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = a; else list.push(a);
  return list;
}

export function removeAgent(rows, id) {
  return (rows || []).filter((x) => x.id !== id);
}

/** ย้ายขึ้น/ลง (dir = -1 | +1) — คืนรายการใหม่ */
export function moveAgent(rows, id, dir) {
  const list = (rows || []).slice();
  const i = list.findIndex((x) => x.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  return list;
}

/** ชื่อไฟล์ที่ปลอดภัยสำหรับสำเนาอ้างอิง (ตัด path + อักขระต้องห้าม · บังคับ .txt) */
export function safeRefFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f]/g, '_').trim() || 'reference';
  return /\.txt$/i.test(base) ? base : base.replace(/\.[^.]*$/, '') + '.txt';
}

/**
 * รวมข้อความอ้างอิงของ agent ตามงบ — ตัวแรกได้ก่อน (ผู้ใช้เรียงลำดับความสำคัญเอง)
 * @param {object} agent
 * @param {Object<string,string>} fileTexts  path → เนื้อไฟล์ที่อ่านมาแล้ว (อ่านไม่ได้ = ไม่มีคีย์)
 * @param {number} budget
 * @returns {{text:string, used:number, truncated:boolean, missing:string[]}}
 */
export function agentRefText(agent, fileTexts = {}, budget = REF_BUDGET) {
  const parts = [];
  const missing = [];
  let left = Math.max(0, budget);
  let truncated = false;
  for (const r of (agent && agent.refs) || []) {
    if (left <= 0) { truncated = true; break; }
    let body = r.kind === 'file' ? fileTexts[r.path] : r.text;
    if (body == null) { missing.push(r.name || r.path); continue; }
    body = String(body).replace(/\r\n?/g, '\n').trim();
    if (!body) continue;
    if (body.length > left) { body = body.slice(0, left); truncated = true; }
    left -= body.length;
    parts.push('### ' + (r.name || r.path || '—') + '\n' + body);
  }
  const text = parts.join('\n\n');
  return { text, used: text.length, truncated, missing };
}

// ───────────────────────── Rewrite this ─────────────────────────

/**
 * สร้างคำขอ "เขียนใหม่" ของข้อความที่เลือก
 * @param {object} o
 *   text        ข้อความที่เลือก (ต้นฉบับ)
 *   instruction คำสั่งของผู้ใช้ ('' = ปรับให้ดีขึ้นตามแนว agent)
 *   agent       agent ที่เลือก (null = ไม่ใช้)
 *   refText     ข้อความอ้างอิงของ agent ที่รวมแล้ว (จาก agentRefText)
 *   before/after  เนื้อหารอบข้างในฉากเดียวกัน
 *   project     บริบทจากโปรเจกต์ (RAG · wiki · เรื่องย่อฉาก) เป็นข้อความก้อนเดียว
 *   format      'prose' | 'screenplay'
 * @param {object} L  ป้าย/คำสั่งที่แปลแล้ว — { role, rules[], persona, refs, project, before, after,
 *                    source, instruction, defaultInstruction, screenplay, output }
 * @returns {{system:string, prompt:string}}
 */
export function buildRewritePrompt(o = {}, L = {}) {
  const sys = [L.role || ''];
  if (o.agent) {
    sys.push('', (L.persona || '') + (o.agent.name ? ' — ' + o.agent.name : ''));
    if (String(o.agent.persona || '').trim()) sys.push(String(o.agent.persona).trim());
  }
  for (const r of L.rules || []) sys.push('- ' + r);
  if (o.format === 'screenplay' && L.screenplay) sys.push('- ' + L.screenplay);

  const p = [];
  const block = (head, body) => { if (String(body || '').trim()) p.push('## ' + head, String(body).trim(), ''); };
  block(L.refs || 'References', o.refText);
  block(L.project || 'Project context', o.project);
  block(L.before || 'Before', o.before ? clipTail(o.before, AROUND_CHARS) : '');
  block(L.after || 'After', o.after ? clipHead(o.after, AROUND_CHARS) : '');
  p.push('## ' + (L.instruction || 'Instruction'),
         String(o.instruction || '').trim() || (L.defaultInstruction || ''), '');
  p.push('## ' + (L.source || 'Text to rewrite'), '<<<', String(o.text || ''), '>>>', '');
  if (L.output) p.push(L.output);
  return { system: sys.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim(),
           prompt: p.join('\n').trim() };
}

function clipTail(s, n) { s = String(s); return s.length > n ? '…' + s.slice(s.length - n) : s; }
function clipHead(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }

/**
 * ทำความสะอาดคำตอบของโมเดลให้เหลือ "ข้อความที่จะแทนที่" ล้วน ๆ
 * ตัด code fence · ตัวคั่น <<< >>> · เครื่องหมายคำพูดที่ครอบทั้งก้อน (เมื่อต้นฉบับไม่ได้ครอบ)
 */
export function cleanRewriteOutput(out, original = '') {
  let s = String(out || '').replace(/\r\n?/g, '\n').trim();
  const fence = s.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  if (fence) s = fence[1].trim();
  s = s.replace(/^<<<\s*\n?/, '').replace(/\n?\s*>>>$/, '').trim();
  const o = String(original || '').trim();
  const pairs = [['"', '"'], ['“', '”'], ['「', '」'], ["'", "'"]];
  for (const [a, b] of pairs) {
    if (s.length > 1 && s.startsWith(a) && s.endsWith(b) && !(o.startsWith(a) && o.endsWith(b))
        && s.slice(1, -1).indexOf(b) < 0) { s = s.slice(1, -1).trim(); break; }
  }
  return s;
}

/**
 * หาช่วงที่จะแทนที่ในเอกสาร **ตอนคำตอบกลับมา** (ผู้ใช้อาจพิมพ์ต่อระหว่างรอ)
 * @param {(from:number,to:number)=>string} textAt  อ่านข้อความช่วงหนึ่งจากเอกสารปัจจุบัน
 * @param {number} from @param {number} to  ช่วงเดิมตอนสั่ง (map ผ่านการแก้แล้ว)
 * @param {string} original
 * @returns {{from:number,to:number}|null} null = ต้นฉบับเปลี่ยนไปแล้ว ห้ามทับ
 */
export function resolveRange(textAt, from, to, original) {
  if (!(from < to)) return null;
  let cur = '';
  try { cur = textAt(from, to); } catch { return null; }
  return cur === original ? { from, to } : null;
}
