// ai-scope.js — [alpha.160 · P1-2] "ที่อยู่" ของระดับการเข้าถึงในแชท AI (บริสุทธิ์ 100%)
//
// ★ ต้นตอ: scope "เฉพาะบท/เฉพาะเล่ม" เดิมคำนวณ prefix จากไฟล์ที่เปิดอยู่ตรง ๆ — ไม่มีแท็บเปิด
//   (หรือเปิดหน้า Wiki/แท็บพิเศษ) → prefix = '' → เงื่อนไข `if (prefix && …)` เป็นเท็จ
//   → ส่ง **ทุกไฟล์ .md ของโปรเจกต์** ให้ผู้ให้บริการ AI ทั้งที่ผู้ใช้เลือกให้เห็นแค่บท/เล่มเดียว
//   ยิ่งถ้าเปิด `Wiki/characters/x.json` อยู่ — `upto(3)` ได้ **โฟลเดอร์แม่ของโปรเจกต์** = ครอบทุกอย่างเช่นกัน
//
// กติกา: book/chapter ต้อง resolve ได้จาก **ไฟล์ฉากในโปรเจกต์** เท่านั้น
//   (<root>/<เล่ม>/Draft/<ร่าง>/Chapters/<บท>/<ไฟล์>.md) · resolve ไม่ได้ = null = ไม่ส่งเนื้อหาโปรเจกต์เลย

const norm = (x) => String(x || '').replace(/\\/g, '/').replace(/\/+$/, '');

/**
 * @param {'project'|'book'|'chapter'} scope
 * @param {string} activeFile  ไฟล์ของแท็บที่เปิดอยู่ ('' = ไม่มี)
 * @param {string} root        รากโปรเจกต์
 * @returns {string|null} prefix (สแลชหน้า) · null = resolve ไม่ได้ → ห้ามส่งไฟล์ของโปรเจกต์
 */
export function scopePrefix(scope, activeFile, root) {
  const r = norm(root);
  if (!r) return null;
  if (scope === 'project') return r;
  const here = norm(activeFile);
  if (!here || here.startsWith('::') || !here.toLowerCase().startsWith(r.toLowerCase() + '/')) return null;
  const parts = here.slice(r.length + 1).split('/');
  // <เล่ม>/Draft/<ร่าง>/Chapters/<บท>/<ไฟล์>
  if (parts.length < 6 || parts[1] !== 'Draft' || parts[3] !== 'Chapters') return null;
  if (scope === 'chapter') return r + '/' + parts.slice(0, 5).join('/');
  if (scope === 'book') return r + '/' + parts[0];
  return null;
}

/** ไฟล์นี้อยู่ใต้ prefix ไหม (เทียบแบบมีตัวคั่น — "บท1" ต้องไม่จับ "บท10") */
export function underPrefix(file, prefix) {
  const f = norm(file).toLowerCase(), p = norm(prefix).toLowerCase();
  return !!p && (f === p || f.startsWith(p + '/'));
}
