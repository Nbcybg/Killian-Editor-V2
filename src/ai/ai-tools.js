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
    desc: 'ดูโครงสร้างทั้งโปรเจกต์ (เล่ม → บท → ฉาก) และรายชื่อเอนทิตี้ใน Wiki' },
  { name: 'scene.read', cap: CAP_READ, need: ['title'], opt: ['book', 'chapter'],
    desc: 'อ่านเนื้อหาฉาก' },
  { name: 'entity.read', cap: CAP_READ, need: ['name'], opt: [],
    desc: 'อ่านข้อมูลเอนทิตี้ใน Wiki (ตัวละคร/สถานที่/ไอเทม/ตำนาน)' },

  // ── เอนทิตี้ใน Wiki ──
  { name: 'entity.create', cap: CAP_WRITE, need: ['cat', 'name'], opt: ['description', 'fields', 'aliases', 'sections'],
    desc: 'สร้างเอนทิตี้ใหม่ — cat = characters | locations | items | lore (หรือหมวดที่ผู้ใช้สร้างเอง)' },
  { name: 'entity.update', cap: CAP_WRITE, need: ['name'], opt: ['newName', 'description', 'fields', 'aliases', 'sections'],
    desc: 'แก้ไขเอนทิตี้ที่มีอยู่ (ส่งเฉพาะฟิลด์ที่จะแก้)' },
  { name: 'entity.delete', cap: CAP_FULL, need: ['name'], opt: [], destructive: true,
    desc: 'ลบเอนทิตี้ (ย้ายไปถังขยะ กู้คืนได้)' },

  // ── เล่ม (book/section) ──
  { name: 'book.create', cap: CAP_WRITE, need: ['title'], opt: [],
    desc: 'สร้างเล่มใหม่ (มีบทแรกให้อัตโนมัติ)' },
  { name: 'book.delete', cap: CAP_FULL, need: ['title'], opt: [], destructive: true,
    desc: 'ลบเล่มทั้งเล่ม (ย้ายไปถังขยะ)' },

  // ── บท ──
  { name: 'chapter.create', cap: CAP_WRITE, need: ['title'], opt: ['book'],
    desc: 'เพิ่มบทใหม่ในเล่ม (ไม่ระบุ book = เล่มแรก)' },
  { name: 'chapter.rename', cap: CAP_WRITE, need: ['title', 'newTitle'], opt: ['book'],
    desc: 'เปลี่ยนชื่อบท' },
  { name: 'chapter.delete', cap: CAP_FULL, need: ['title'], opt: ['book'], destructive: true,
    desc: 'ลบบททั้งบท (ทุกฉากย้ายไปถังขยะ)' },

  // ── ฉาก ──
  { name: 'scene.create', cap: CAP_WRITE, need: ['title'], opt: ['book', 'chapter', 'text', 'synopsis'],
    desc: 'สร้างฉากใหม่ในบท พร้อมเนื้อหาเริ่มต้นได้เลย' },
  { name: 'scene.write', cap: CAP_WRITE, need: ['title', 'text'], opt: ['book', 'chapter', 'mode'],
    desc: 'เขียนเนื้อหาฉาก — mode = append (เขียนต่อท้าย, ค่าเริ่มต้น) | replace (เขียนทับ) | prepend (แทรกหน้า)' },
  { name: 'scene.rename', cap: CAP_WRITE, need: ['title', 'newTitle'], opt: ['book', 'chapter'],
    desc: 'เปลี่ยนชื่อฉาก' },
  { name: 'scene.delete', cap: CAP_FULL, need: ['title'], opt: ['book', 'chapter'], destructive: true,
    desc: 'ลบฉาก (ย้ายไปถังขยะ)' },
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
    ? '{"tool":"scene.write","args":{"title":"ฉากแรก","mode":"append","text":"เนื้อหาที่จะเขียนต่อ…"}}'
    : '{"tool":"scene.read","args":{"title":"ฉากแรก"}}';
  const lines = [
    '## คำสั่งที่คุณสั่งให้โปรแกรมทำได้',
    'เมื่อต้องการให้โปรแกรมลงมือทำจริง ให้พิมพ์บล็อกโค้ดภาษา `k2` ที่มี JSON ข้างใน แบบนี้:',
    '',
    '```k2',
    example,
    '```',
    '',
    'กติกา:',
    '- หนึ่งบล็อก = หนึ่งคำสั่ง สั่งหลายอย่างได้โดยใส่หลายบล็อก โปรแกรมจะทำตามลำดับบนลงล่าง',
    '- เขียนข้อความอธิบายให้ผู้ใช้อ่านนอกบล็อกได้ตามปกติ',
    '- ห้ามใส่คอมเมนต์หรือข้อความอื่นในบล็อก `k2` — ต้องเป็น JSON ล้วน',
    '- ถ้าไม่รู้ชื่อเล่ม/บท/ฉาก ให้เรียก `project.tree` ก่อน อย่าเดา',
    '- ผลของทุกคำสั่งจะถูกส่งกลับมาให้คุณในข้อความถัดไป ทำงานต่อจากผลนั้นได้เลย',
    '',
    'คำสั่งที่ใช้ได้ตอนนี้:',
  ];
  for (const t of list) {
    const args = [...t.need.map((a) => a), ...t.opt.map((a) => a + '?')].join(', ');
    lines.push(`- \`${t.name}\`(${args}) — ${t.desc}${t.destructive ? ' ⚠ ลบของ' : ''}`);
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
      if (lang === 'k2') out.push({ tool: '', args: {}, raw, error: 'JSON ไม่ถูกต้อง: ' + (e.message || e) });
      continue;
    }
    const rows = Array.isArray(j) ? j : [j];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const name = String(r.tool || r.name || '');
      if (!name) { if (lang === 'k2') out.push({ tool: '', args: {}, raw, error: 'ไม่มีฟิลด์ tool' }); continue; }
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
  if (!call) return { ok: false, error: 'คำสั่งว่าง' };
  if (call.error) return { ok: false, error: call.error };
  const def = toolByName(call.tool);
  if (!def) return { ok: false, error: 'ไม่รู้จักคำสั่ง "' + call.tool + '"' };
  if (!capAllows(cap, def.cap)) {
    return { ok: false, error: 'โหมดปัจจุบันไม่อนุญาตให้ใช้ "' + call.tool + '" — สลับโหมดที่กล่องพิมพ์ก่อน' };
  }
  const miss = def.need.filter((k) => {
    const v = call.args[k];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (miss.length) return { ok: false, error: 'ขาดอาร์กิวเมนต์: ' + miss.join(', ') };
  return { ok: true, def };
}

/** บรรทัดเดียวที่มนุษย์อ่านรู้เรื่อง — ใช้ทั้งในกล่องยืนยันและใน transcript */
export function describeCall(call) {
  const a = (call && call.args) || {};
  const where = [a.book, a.chapter].filter(Boolean).join(' › ');
  const at = where ? ` (${where})` : '';
  switch (call && call.tool) {
    case 'project.tree':    return 'ดูโครงสร้างโปรเจกต์';
    case 'scene.read':      return `อ่านฉาก "${a.title}"${at}`;
    case 'entity.read':     return `อ่านข้อมูล "${a.name}"`;
    case 'entity.create':   return `สร้าง${catLabel(a.cat)} "${a.name}"`;
    case 'entity.update':   return `แก้ข้อมูล "${a.name}"` + (a.newName ? ` → "${a.newName}"` : '');
    case 'entity.delete':   return `ลบ "${a.name}" ไปถังขยะ`;
    case 'book.create':     return `สร้างเล่ม "${a.title}"`;
    case 'book.delete':     return `ลบเล่ม "${a.title}" ไปถังขยะ`;
    case 'chapter.create':  return `เพิ่มบท "${a.title}"${at}`;
    case 'chapter.rename':  return `เปลี่ยนชื่อบท "${a.title}" → "${a.newTitle}"`;
    case 'chapter.delete':  return `ลบบท "${a.title}" ทั้งบท`;
    case 'scene.create':    return `สร้างฉาก "${a.title}"${at}`;
    case 'scene.write':     return `${writeVerb(a.mode)}ฉาก "${a.title}"${at} (${String(a.text || '').length} ตัวอักษร)`;
    case 'scene.rename':    return `เปลี่ยนชื่อฉาก "${a.title}" → "${a.newTitle}"`;
    case 'scene.delete':    return `ลบฉาก "${a.title}"${at} ไปถังขยะ`;
    default:                return call && call.tool ? call.tool : 'คำสั่งไม่ถูกต้อง';
  }
}
function writeVerb(mode) {
  return mode === 'replace' ? 'เขียนทับ' : mode === 'prepend' ? 'แทรกหน้า' : 'เขียนต่อท้าย';
}
function catLabel(cat) {
  return { characters: 'ตัวละคร', locations: 'สถานที่', items: 'ไอเทม', lore: 'ตำนาน' }[cat] || 'เอนทิตี้';
}

/** คำสั่งชุดนี้มีอันที่ลบของไหม (ใช้ตัดสินว่าต้องถามก่อนไหม) */
export function hasDestructive(calls) {
  return (calls || []).some((c) => { const d = toolByName(c.tool); return d && d.destructive; });
}

/** ผลของคำสั่งที่จะส่งกลับให้โมเดลอ่านต่อ */
export function resultsMessage(results) {
  const lines = ['ผลของคำสั่งที่สั่งไป:'];
  for (const r of results || []) {
    lines.push(`- ${r.tool}: ${r.ok ? 'สำเร็จ' : 'ล้มเหลว'}${r.message ? ' — ' + r.message : ''}${r.error ? ' — ' + r.error : ''}`);
    if (r.ok && r.data !== undefined && r.data !== null) {
      const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
      lines.push('```', body.length > 8000 ? body.slice(0, 8000) + '\n…(ตัดให้สั้น)' : body, '```');
    }
  }
  return lines.join('\n');
}
