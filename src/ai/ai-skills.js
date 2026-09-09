// ai-skills.js — [alpha.145] "ทักษะ" ของผู้ช่วย AI (ไฟล์ .md ที่ผู้ใช้เขียนเอง)
//
// ผู้ใช้: *"ไม่มีการใส่ skill.md เลย"*
//
// แนวคิดเดียวกับ SKILL.md ของ opencode/Claude Code: **คำสั่งประจำตัวที่ผู้ใช้เขียนเอง**
// แล้วเปิด/ปิดได้รายเซสชัน — เช่น "โทนการเขียนของเรื่องนี้" · "ห้ามใช้คำพวกนี้" ·
// "รูปแบบบทที่ต้องการ" · "ตัวละครหลักพูดยังไง"
//
// ที่เก็บ: `<โปรเจกต์>/Skills/*.md` — ตรงตามหลักของ Killian ทุกข้อ
//   · เป็น .md ธรรมดา แก้นอกโปรแกรมได้
//   · ก๊อปโฟลเดอร์โปรเจกต์ไปเครื่องอื่น ทักษะไปด้วย
//   · เปิดโปรเจกต์ไหน เห็นทักษะของโปรเจกต์นั้น
//
// รูปแบบไฟล์ (frontmatter ไม่บังคับ — ไม่มีก็ใช้ชื่อไฟล์เป็นชื่อทักษะ):
//   ---
//   name: โทนการเขียน
//   description: บังคับโทนภาษาของเรื่องนี้
//   ---
//   เขียนด้วยประโยคสั้น …
//
// ส่วนคำนวณทั้งหมด **บริสุทธิ์** (unit test: test/ai-skills.test.cjs)
// ส่วนที่แตะไฟล์มีแค่ listSkillFiles/loadSkills/ensureSkillDir ท้ายไฟล์
import { T, tm } from '../i18n.js';

export const SKILL_DIR = 'Skills';
/** เพดานความยาวรวมของทักษะที่แนบไปกับคำขอหนึ่งครั้ง (กันเผลอแนบทั้งนิยาย) */
export const SKILL_MAX_CHARS = 12000;

/** ชื่อไฟล์ → id ที่เก็บในเซสชัน (ตัดนามสกุลออก · ใช้เทียบตรง ๆ) */
export function skillId(fileName) {
  return String(fileName || '').replace(/\.md$/i, '');
}

/**
 * แยก frontmatter ออกจากเนื้อทักษะ — pure
 * @param {string} text  เนื้อไฟล์ทั้งไฟล์
 * @param {string} fileName
 * @returns {{id,name,description,body,chars}}
 */
export function parseSkillFile(text, fileName = '') {
  const raw = String(text ?? '').replace(/^﻿/, '');
  const id = skillId(fileName);
  let body = raw;
  const meta = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i <= 0) continue;
      const k = line.slice(0, i).trim().toLowerCase();
      const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (k) meta[k] = v;
    }
    body = raw.slice(m[0].length);
  }
  // ไม่มี frontmatter แต่ขึ้นต้นด้วยหัวข้อ `# ชื่อ` → ใช้หัวข้อนั้นเป็นชื่อ
  let name = meta.name || '';
  if (!name) {
    const h = /^\s*#\s+(.+)$/m.exec(body.split(/\r?\n/).slice(0, 3).join('\n'));
    name = (h && h[1].trim()) || id;
  }
  const trimmed = body.trim();
  return { id, name, description: meta.description || '', body: trimmed, chars: trimmed.length };
}

/** ทักษะนี้ใช้ได้จริงไหม (มีเนื้อ) */
export function isUsableSkill(s) { return !!(s && s.body && s.body.trim()); }

/**
 * ประกอบส่วนต่อท้าย system prompt จากทักษะที่เปิดอยู่ — pure
 * คืน '' เมื่อไม่มีทักษะที่ใช้ได้เลย (ผู้เรียกจะได้ไม่ต่อบรรทัดว่างเปล่า ๆ)
 * @param {Array} skills  [{id,name,description,body}]
 * @param {{maxChars?:number}} [opts]
 * @returns {{text:string, used:string[], skipped:string[], chars:number}}
 */
export function buildSkillsPrompt(skills = [], opts = {}) {
  const max = opts.maxChars || SKILL_MAX_CHARS;
  const used = [];
  const skipped = [];
  const parts = [];
  let chars = 0;
  for (const s of skills) {
    if (!isUsableSkill(s)) { if (s && s.id) skipped.push(s.id); continue; }
    const head = '## ' + (s.name || s.id) + (s.description ? ' — ' + s.description : '');
    const block = head + '\n' + s.body.trim();
    if (chars + block.length > max) { skipped.push(s.id); continue; }
    chars += block.length;
    parts.push(block);
    used.push(s.id);
  }
  if (!parts.length) return { text: '', used, skipped, chars: 0 };
  const header = T`ทักษะที่ผู้เขียนกำหนดให้คุณ (ทำตามอย่างเคร่งครัด · สำคัญกว่าคำแนะนำทั่วไปข้างบน):`;
  return { text: '\n\n' + header + '\n\n' + parts.join('\n\n'), used, skipped, chars };
}

/** ป้ายสั้น ๆ บนปุ่ม 🧩 — "ทักษะ 2/5" */
export function skillsLabel(all = [], onIds = []) {
  const on = (all || []).filter((s) => (onIds || []).includes(s.id)).length;
  return tm('🧩 {0}/{1}', String(on), String((all || []).length));
}

/** เนื้อไฟล์ตัวอย่าง — สร้างให้ครั้งแรกที่ผู้ใช้เปิดเมนูทักษะแล้วยังไม่มีอะไรเลย */
export function starterSkillMd() {
  return [
    '---',
    'name: ' + T`โทนการเขียนของเรื่องนี้`,
    'description: ' + T`ตัวอย่าง — แก้ไฟล์นี้ได้เลย หรือสร้างไฟล์ .md ใหม่ในโฟลเดอร์นี้`,
    '---',
    '',
    T`เขียนด้วยประโยคสั้น กระชับ ไม่ใช้คำฟุ่มเฟือย`,
    T`ใช้คำสรรพนามตามที่ตัวละครใช้จริงในเรื่อง ห้ามเปลี่ยนเอง`,
    T`ห้ามสรุปตอนจบให้ ถ้าผู้เขียนไม่ได้ขอ`,
    '',
  ].join('\n');
}

// ───────── ส่วนที่แตะไฟล์ (kapi) ─────────
/** โฟลเดอร์ทักษะของโปรเจกต์ (สร้างให้ถ้ายังไม่มี) — คืน '' เมื่อยังไม่ได้เปิดโปรเจกต์ */
export async function ensureSkillDir(root, io = (typeof kapi !== 'undefined' ? kapi : null)) {
  if (!root || !io) return '';
  const d = await io.join(root, SKILL_DIR);
  if (!(await io.exists(d))) await io.mkdir(d);
  return d;
}

/**
 * อ่านทักษะทั้งหมดของโปรเจกต์ (ไม่สร้างโฟลเดอร์ให้ — ใช้ตอนวาดเมนู/ประกอบ prompt)
 * @returns {Promise<Array>} [{id,name,description,body,chars,file}]
 */
export async function loadSkills(root, io = (typeof kapi !== 'undefined' ? kapi : null)) {
  if (!root || !io) return [];
  try {
    const d = await io.join(root, SKILL_DIR);
    if (!(await io.exists(d))) return [];
    const out = [];
    for (const f of await io.listFiles(d)) {
      if (!/\.md$/i.test(f)) continue;
      try {
        const p = await io.join(d, f);
        const s = parseSkillFile(await io.readFile(p), f);
        s.file = p;
        out.push(s);
      } catch { /* ไฟล์เดียวพัง ไม่ควรทำให้ทั้งรายการหาย */ }
    }
    return out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));
  } catch { return []; }
}
