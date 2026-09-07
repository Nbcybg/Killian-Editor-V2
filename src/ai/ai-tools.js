// ai-tools.js — [alpha.63r4] ชุดคำสั่งที่ AI สั่งให้แอป "ลงมือทำจริง" ได้
//
// ทำไมไม่ใช้ function-calling ของ API:
// ผู้ใช้ต่อ provider เองได้ทุกเจ้า (OpenAI-compatible, Ollama, LM Studio, …) ซึ่งรองรับ
// tool/function calling ไม่เท่ากันเลย บางเจ้าไม่มี บางเจ้ารูปแบบต่างกัน
// → ใช้ "โปรโตคอลข้อความ" แทน: ให้โมเดลพิมพ์บล็อก ```k2 ที่มี JSON ข้างใน
//   ซึ่งทุกโมเดลที่พิมพ์ JSON เป็นก็ใช้ได้หมด และผู้ใช้อ่านออกด้วยตาเปล่าว่า AI จะทำอะไร
//
// ไฟล์นี้ไม่แตะ DOM/fs/network — แปลงข้อความเป็นรายการคำสั่ง + ตรวจความถูกต้องเท่านั้น
// ตัวลงมือทำจริงอยู่ที่ ai-actions.js → unit test ไฟล์นี้ได้ตรง ๆ

import { t as tt, tf as ttf, t, tf } from '../i18n.js';
/** ระดับความสามารถของโหมดแชท */
export const CAP_READ = 'read';     // อ่านโปรเจกต์ได้อย่างเดียว
export const CAP_WRITE = 'write';   // สร้าง/แก้ได้ แต่ลบไม่ได้
export const CAP_FULL = 'full';     // ทำได้ทุกอย่างรวมทั้งลบ

/**
 * ทะเบียนคำสั่งทั้งหมด
 *   need  — ต้องมีอาร์กิวเมนต์เหล่านี้ครบ
 *   opt   — มีก็ได้
 *   cap   — ต้องอยู่ในโหมดที่ให้สิทธิ์ระดับนี้ขึ้นไป
 *   destructive — ทำแล้วของหาย (ย้ายไปถังขยะ) → ยืนยันก่อนเสมอถ้าผู้ใช้ไม่ได้ปิดการยืนยัน
 */
export const TOOLS = [
  // ── อ่าน ──
  { name: 'project.tree', cap: CAP_READ, need: [], opt: [],
    desc: tt('ui.aiTools.viewStructureProjectBook') },
  { name: 'scene.read', cap: CAP_READ, need: ['title'], opt: ['book', 'chapter'],
    desc: tt('ui.aiTools.readBodyScene') },
  { name: 'entity.read', cap: CAP_READ, need: ['name'], opt: [],
    desc: tt('ui.aiTools.readDataWikiCharacter') },

  // ── เอนทิตี้ใน Wiki ──
  { name: 'entity.create', cap: CAP_WRITE, need: ['cat', 'name'], opt: ['description', 'fields', 'aliases', 'sections'],
    desc: tt('ui.aiTools.newNewCatCharacters') },
  { name: 'entity.update', cap: CAP_WRITE, need: ['name'], opt: ['newName', 'description', 'fields', 'aliases', 'sections'],
    desc: tt('ui.aiTools.editHasSendOnly') },
  { name: 'entity.delete', cap: CAP_FULL, need: ['name'], opt: [], destructive: true,
    desc: tt('ui.aiTools.delMoveTrashRecover') },

  // ── เล่ม (book/section) ──
  { name: 'book.create', cap: CAP_WRITE, need: ['title'], opt: [],
    desc: tt('ui.aiTools.newBookNewHas') },
  { name: 'book.delete', cap: CAP_FULL, need: ['title'], opt: [], destructive: true,
    desc: tt('ui.aiTools.delBookBookMove') },

  // ── บท ──
  { name: 'chapter.create', cap: CAP_WRITE, need: ['title'], opt: ['book'],
    desc: tt('ui.aiTools.addChapterNewBook') },
  { name: 'chapter.rename', cap: CAP_WRITE, need: ['title', 'newTitle'], opt: ['book'],
    desc: tt('ui.aiTools.changeNameChapter') },
  { name: 'chapter.delete', cap: CAP_FULL, need: ['title'], opt: ['book'], destructive: true,
    desc: tt('ui.aiTools.delChapterChapterAll') },

  // ── ฉาก ──
  { name: 'scene.create', cap: CAP_WRITE, need: ['title'], opt: ['book', 'chapter', 'text', 'synopsis'],
    desc: tt('ui.aiTools.newSceneNewChapter') },
  { name: 'scene.write', cap: CAP_WRITE, need: ['title', 'text'], opt: ['book', 'chapter', 'mode'],
    desc: tt('ui.aiTools.writeBodySceneMode') },
  { name: 'scene.rename', cap: CAP_WRITE, need: ['title', 'newTitle'], opt: ['book', 'chapter'],
    desc: tt('ui.aiTools.changeNameScene') },
  { name: 'scene.delete', cap: CAP_FULL, need: ['title'], opt: ['book', 'chapter'], destructive: true,
    desc: tt('ui.aiTools.delSceneMoveTrash') },
];

export function toolByName(name) { return TOOLS.find((t) => t.name === name) || null; }

const CAP_RANK = { [CAP_READ]: 0, [CAP_WRITE]: 1, [CAP_FULL]: 2 };
/** โหมดที่ให้สิทธิ์ `have` เรียกคำสั่งที่ต้องการ `need` ได้ไหม */
export function capAllows(have, need) {
  return (CAP_RANK[have] ?? -1) >= (CAP_RANK[need] ?? 99);
}
/** คำสั่งที่ใช้ได้ในโหมดนี้ */
export function toolsFor(cap) { return TOOLS.filter((t) => capAllows(cap, t.cap)); }

/** ส่วนของ system prompt ที่อธิบายโปรโตคอล — ใส่เฉพาะคำสั่งที่โหมดนั้นใช้ได้จริง */
export function toolsSystemPrompt(cap) {
  const list = toolsFor(cap);
  if (!list.length) return '';
  // ตัวอย่างต้องเป็นคำสั่งที่โหมดนั้นใช้ได้จริง — ไม่งั้นเท่ากับยั่วให้โมเดลสั่งของที่ถูกปฏิเสธ
  const example = capAllows(cap, CAP_WRITE)
    ? tt('ui.aiTools.toolSceneWriteArgs')
    : tt('ui.aiTools.toolSceneReadArgs');
  const lines = [
    tt('ui.aiTools.cmdYouCmdApp'),
    tt('ui.aiTools.needAppActPrint'),
    '',
    '```k2',
    example,
    '```',
    '',
    tt('ui.common.rule'),
    tt('ui.aiTools.oneBlockOneCmd'),
    tt('ui.aiTools.writeTextExplainUser'),
    tt('ui.aiTools.forbidPutCommentText'),
    tt('ui.aiTools.notNameBookChapter'),
    tt('ui.aiTools.resultAllCmdSend'),
    '',
    tt('ui.aiTools.cmdUseNow'),
  ];
  for (const t of list) {
    const args = [...t.need.map((a) => a), ...t.opt.map((a) => a + '?')].join(', ');
    lines.push(`- \`${t.name}\`(${args}) — ${t.desc}${t.destructive ? tt('ui.aiTools.del') : ''}`);
  }
  return lines.join('\n');
}

// ────────────────────────────── แกะคำสั่งจากคำตอบ ──────────────────────────────

// ```k2 … ``` เป็นหลัก · เผื่อโมเดลเผลอใช้ ```json ที่มี "tool" อยู่ข้างในด้วย
const FENCE_RE = /```(k2|json)\s*\n([\s\S]*?)```/g;

/**
 * แกะคำสั่งทั้งหมดจากข้อความคำตอบ
 * @returns {Array<{tool:string,args:object,raw:string,error?:string}>}
 */
export function parseToolCalls(text) {
  const out = [];
  const src = String(text || '');
  FENCE_RE.lastIndex = 0;
  let m;
  while ((m = FENCE_RE.exec(src))) {
    const lang = m[1];
    const raw = m[2].trim();
    if (!raw) continue;
    let j;
    try { j = JSON.parse(raw); } catch (e) {
      // บล็อก json ที่ไม่ใช่คำสั่ง (ตัวอย่างข้อมูล) — เมินไป ไม่ใช่ error ของผู้ใช้
      if (lang === 'k2') out.push({ tool: '', args: {}, raw, error: tt('ui.common.jSONNotValid') + (e.message || e) });
      continue;
    }
    const rows = Array.isArray(j) ? j : [j];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const name = String(r.tool || r.name || '');
      if (!name) { if (lang === 'k2') out.push({ tool: '', args: {}, raw, error: tt('ui.aiTools.notHasReduceTool') }); continue; }
      if (lang === 'json' && !toolByName(name)) continue;   // ```json ที่บังเอิญมี key ชื่อ tool
      out.push({ tool: name, args: (r.args && typeof r.args === 'object') ? r.args : {}, raw });
    }
  }
  return out;
}

/** ข้อความที่เอาบล็อกคำสั่งออกแล้ว — ใช้แสดงในแชทโหมดปกติ */
export function stripToolCalls(text) {
  const src = String(text || '');
  return src.replace(/```k2\s*\n[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** ตรวจว่าคำสั่งนี้เรียกได้ไหมในโหมดปัจจุบัน */
export function validateCall(call, cap) {
  if (!call) return { ok: false, error: tt('ui.aiTools.cmdEmpty') };
  if (call.error) return { ok: false, error: call.error };
  const def = toolByName(call.tool);
  if (!def) return { ok: false, error: tt('ui.aiTools.notKnownCmd') + call.tool + '"' };
  if (!capAllows(cap, def.cap)) {
    return { ok: false, error: tt('ui.aiTools.modeCurrentNotAllow') + call.tool + tt('ui.aiTools.toggleModeDialogPrint') };
  }
  const miss = def.need.filter((k) => {
    const v = call.args[k];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (miss.length) return { ok: false, error: tt('ui.aiTools.missingArg') + miss.join(', ') };
  return { ok: true, def };
}

/** บรรทัดเดียวที่มนุษย์อ่านรู้เรื่อง — ใช้ทั้งในกล่องยืนยันและใน transcript */
export function describeCall(call) {
  const a = (call && call.args) || {};
  const where = [a.book, a.chapter].filter(Boolean).join(' › ');
  const at = where ? ` (${where})` : '';
  switch (call && call.tool) {
    case 'project.tree':    return tt('ui.aiTools.viewStructureProject');
    case 'scene.read':      return ttf('ui.aiTools.readScene', a.title, at);
    case 'entity.read':     return ttf('ui.aiTools.readData', a.name);
    case 'entity.create':   return ttf('ui.aiTools.new', catLabel(a.cat), a.name);
    case 'entity.update':   return ttf('ui.aiTools.editData', a.name) + (a.newName ? ` → "${a.newName}"` : '');
    case 'entity.delete':   return ttf('ui.aiTools.delTrash', a.name);
    case 'book.create':     return ttf('ui.aiTools.newBook', a.title);
    case 'book.delete':     return ttf('ui.aiTools.delBookTrash', a.title);
    case 'chapter.create':  return ttf('ui.aiTools.addChapter', a.title, at);
    case 'chapter.rename':  return ttf('ui.aiTools.changeNameChapter2', a.title, a.newTitle);
    case 'chapter.delete':  return ttf('ui.aiTools.delChapterChapter', a.title);
    case 'scene.create':    return ttf('ui.aiTools.newScene', a.title, at);
    case 'scene.write':     return ttf('ui.aiTools.sceneChar', writeVerb(a.mode), a.title, at, String(a.text || '').length);
    case 'scene.rename':    return ttf('ui.aiTools.changeNameScene2', a.title, a.newTitle);
    case 'scene.delete':    return ttf('ui.aiTools.delSceneTrash', a.title, at);
    default:                return call && call.tool ? call.tool : tt('ui.aiTools.cmdNotValid');
  }
}
function writeVerb(mode) {
  return mode === 'replace' ? tt('ui.common.overwrite') : mode === 'prepend' ? tt('ui.common.insertPage') : tt('ui.aiTools.writeNext');
}
function catLabel(cat) {
  return { characters: tt('ui.common.character'), locations: tt('ui.common.place'), items: tt('ui.aiTools.msg'), lore: tt('ui.common.legend') }[cat] || tt('ui.common.msg7');
}

/** คำสั่งชุดนี้มีอันที่ลบของไหม (ใช้ตัดสินว่าต้องถามก่อนไหม) */
export function hasDestructive(calls) {
  return (calls || []).some((c) => { const d = toolByName(c.tool); return d && d.destructive; });
}

/** ผลของคำสั่งที่จะส่งกลับให้โมเดลอ่านต่อ */
export function resultsMessage(results) {
  const lines = [tt('ui.aiTools.resultCmdCmd')];
  for (const r of results || []) {
    lines.push(`- ${r.tool}: ${r.ok ? tt('ui.common.ok') : tt('ui.common.fail')}${r.message ? ' — ' + r.message : ''}${r.error ? ' — ' + r.error : ''}`);
    if (r.ok && r.data !== undefined && r.data !== null) {
      const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
      lines.push('```', body.length > 8000 ? body.slice(0, 8000) + tt('ui.aiTools.cutShort') : body, '```');
    }
  }
  return lines.join('\n');
}
