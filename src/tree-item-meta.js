// tree-item-meta.js — [alpha.155] ข้อมูลเสริมของแถวใน Explorer (ตรรกะล้วน · มี unit test)
//
// เก็บใน `project.khn.json → explorer`:
//   · `pins`  — รายการปักหมุด (ผู้ใช้: *"หมุดน่าจะต้องทำเหมือน vistule ว่ามีรายการหมุด
//               ย้ายไปด้านบนไม่ได้ เพราะลำดับฉาก หรือบท จะเปลี่ยน"*) → ของจริงอยู่ที่เดิมเสมอ
//               หมุดเป็นแค่ทางลัดในหมวด "ปักหมุด" บนสุดของต้นไม้
//   · `items` — ติดดาว/สี/สถานะ/ล็อก ของไฟล์ที่ไม่มีที่เก็บคุณสมบัติของตัวเอง (กระดาน · แผนแตกสาย · รูป)
//               คีย์ = path สัมพัทธ์กับรากโปรเจกต์ (ใช้ `/` เสมอ)
// เล่ม/บท/ฉาก/memo เก็บคุณสมบัติในไฟล์ของตัวเองอยู่แล้ว (section.json · draft.json · scenes.json · frontmatter)

export const EXPLORER_VERSION = 1;

/** แปลง path ให้เป็นคีย์เดียวกันทุก OS */
export function relKey(rel) {
  return String(rel || '').replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(/\/+$/, '');
}

/** ก้อน `explorer` ที่ถูกรูปเสมอ (ไม่แก้ของเดิม) */
export function normalizeExplorer(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pins = Array.isArray(r.pins) ? r.pins.filter((p) => p && typeof p.kind === 'string' && p.key) : [];
  const items = {};
  for (const [k, v] of Object.entries(r.items && typeof r.items === 'object' ? r.items : {})) {
    const m = cleanItemMeta(v);
    if (Object.keys(m).length) items[relKey(k)] = m;
  }
  return { version: EXPLORER_VERSION, pins, items };
}

/** เก็บเฉพาะช่องที่รู้จัก และทิ้งค่าว่าง (ไฟล์ไม่บวมด้วย false/'' ทั้งโปรเจกต์) */
export function cleanItemMeta(v) {
  const m = {};
  if (!v || typeof v !== 'object') return m;
  if (v.flag) m.flag = true;
  if (v.locked) m.locked = true;
  if (typeof v.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.color)) m.color = v.color;
  if (typeof v.status === 'string' && v.status.trim() && v.status !== 'Outline') m.status = v.status.trim();
  if (typeof v.note === 'string' && v.note.trim()) m.note = v.note;
  return m;
}

export function getItemMeta(explorer, rel) {
  return { ...(normalizeExplorer(explorer).items[relKey(rel)] || {}) };
}

/** รวมค่าเข้าไป — `null`/`''`/`false` = ลบช่องนั้น */
export function setItemMeta(explorer, rel, patch) {
  const ex = normalizeExplorer(explorer);
  const k = relKey(rel);
  const cur = { ...(ex.items[k] || {}) };
  for (const [f, v] of Object.entries(patch || {})) {
    if (v === null || v === '' || v === false || v === undefined) delete cur[f]; else cur[f] = v;
  }
  const m = cleanItemMeta(cur);
  if (Object.keys(m).length) ex.items[k] = m; else delete ex.items[k];
  return ex;
}

/** ไฟล์ถูกเปลี่ยนชื่อ/ย้าย → คุณสมบัติและหมุดต้องตามไปด้วย */
export function renameItemPath(explorer, oldRel, newRel) {
  const ex = normalizeExplorer(explorer);
  const a = relKey(oldRel), b = relKey(newRel);
  if (!a || !b || a === b) return ex;
  if (ex.items[a]) { ex.items[b] = ex.items[a]; delete ex.items[a]; }
  ex.pins = ex.pins.map((p) => (p.key === a ? { ...p, key: b } : p));
  return ex;
}

/** ไฟล์ถูกลบ → ล้างคุณสมบัติและหมุดของมัน */
export function forgetItemPath(explorer, rel) {
  const ex = normalizeExplorer(explorer);
  const k = relKey(rel);
  delete ex.items[k];
  ex.pins = ex.pins.filter((p) => p.key !== k);
  return ex;
}

// ───────── หมุด ─────────
/**
 * กุญแจของหมุดตามชนิด — ต้องไม่หลุดเมื่อของย้ายที่
 *   book    → guid ของเล่ม (โฟลเดอร์เปลี่ยนชื่อได้)
 *   chapter → guid ของบท · scene → id ของฉาก (ย้ายบทแล้ว path เปลี่ยน)
 *   memo/image/board/plan → path สัมพัทธ์ (เปลี่ยนชื่อผ่าน renameItemPath)
 */
export function pinKey(kind, ref) {
  return kind + ':' + (['memo', 'image', 'board', 'plan'].includes(kind) ? relKey(ref) : String(ref || ''));
}

export function isPinned(explorer, kind, key) {
  const k = ['memo', 'image', 'board', 'plan'].includes(kind) ? relKey(key) : String(key || '');
  return normalizeExplorer(explorer).pins.some((p) => p.kind === kind && p.key === k);
}

/** สลับหมุด · `info` = ข้อมูลช่วยหาของตอนเปิด (title · dRel · chGuid ฯลฯ) */
export function togglePin(explorer, kind, key, info = {}) {
  const ex = normalizeExplorer(explorer);
  const k = ['memo', 'image', 'board', 'plan'].includes(kind) ? relKey(key) : String(key || '');
  if (!k) return ex;
  const i = ex.pins.findIndex((p) => p.kind === kind && p.key === k);
  if (i >= 0) ex.pins.splice(i, 1);
  else ex.pins.push({ kind, key: k, ...info, at: info.at || 0 });
  return ex;
}

/** อัปเดตข้อมูลช่วยหาของหมุด (ชื่อที่เปลี่ยน · path ปัจจุบัน) โดยไม่เปลี่ยนลำดับ */
export function updatePinInfo(explorer, kind, key, info) {
  const ex = normalizeExplorer(explorer);
  ex.pins = ex.pins.map((p) => (p.kind === kind && p.key === key ? { ...p, ...info, kind, key } : p));
  return ex;
}

// ───────── ล็อกซ้อนชั้น ─────────
/**
 * ล็อกจริงของฉาก = ฉากเอง หรือบท หรือเล่มที่มันอยู่ (ผู้ใช้: "ล็อกทุกฉากข้างใน")
 * @returns {''|'scene'|'chapter'|'book'} ชั้นที่ล็อก ('' = ไม่ล็อก) — บอกผู้ใช้ได้ว่าต้องไปปลดที่ไหน
 */
export function lockSource({ book, chapter, scene } = {}) {
  if (book && book.locked) return 'book';
  if (chapter && chapter.locked) return 'chapter';
  if (scene && (scene.locked === true || scene.locked === 'true')) return 'scene';
  return '';
}

// ───────── ทำสำเนาเล่ม/บท: id ใหม่ทั้งชุด ─────────
/**
 * ออก guid/id ใหม่ให้ฉบับร่างที่ถูกทำสำเนา (draft.json + scenes.json)
 * ต้องใหม่ทั้งหมด: หลายที่ในโปรแกรมผูกกับ id (สภาพพับของต้นไม้ · โน้ต · ทางเลือกแตกสาย · หมุด)
 * ถ้าซ้ำกับของต้นฉบับ แก้ฝั่งหนึ่งแล้วอีกฝั่งเปลี่ยนตาม
 * @param {object} draft  เนื้อ draft.json
 * @param {object} scenes เนื้อ scenes.json
 * @param {() => string} newId
 * @returns {{draft:object, scenes:object, chapterMap:Record<string,string>, sceneMap:Record<string,string>}}
 */
export function regenDraftIds(draft, scenes, newId) {
  const d = JSON.parse(JSON.stringify(draft || {}));
  const s = JSON.parse(JSON.stringify(scenes || {}));
  const chapterMap = {}, sceneMap = {};
  d.chapters = (d.chapters || []).map((c) => {
    const g = newId();
    chapterMap[c.guid] = g;
    return { ...c, guid: g };
  });
  const out = {};
  for (const [oldG, rows] of Object.entries(s.chapters || {})) {
    const g = chapterMap[oldG] || oldG;
    out[g] = (rows || []).map((r) => {
      const id = newId();
      sceneMap[r.id] = id;
      return { ...r, id, chapterGuid: g };
    });
  }
  s.chapters = out;
  // ทางเลือกแตกสายที่ชี้ไปฉากในชุดเดียวกัน → ชี้ไปฉากสำเนา ไม่ใช่ฉากต้นฉบับ
  for (const rows of Object.values(s.chapters)) {
    for (const r of rows) {
      if (!Array.isArray(r.choices)) continue;
      r.choices = r.choices.map((c) => (c && sceneMap[c.nextSceneId] ? { ...c, nextSceneId: sceneMap[c.nextSceneId] } : c));
    }
  }
  return { draft: d, scenes: s, chapterMap, sceneMap };
}

/** ชื่อที่ไม่ชนกับรายการเดิม: "ชื่อ (สำเนา)" → "ชื่อ (สำเนา 2)" … */
export function uniqueCopyName(base, existing, suffix) {
  const taken = new Set((existing || []).map((x) => String(x)));
  const first = base + ' ' + suffix;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n++) {
    const c = base + ' ' + suffix.replace(/\)$/, ' ' + n + ')');
    if (!taken.has(c)) return c;
  }
  return first + ' ' + Date.now().toString(36);
}

// ───────── backup รายชิ้น ─────────
/** โฟลเดอร์ชุดสำรองของชิ้นหนึ่ง (สัมพัทธ์กับรากโปรเจกต์) */
export function itemBackupDir(kind, key) {
  const safe = String(key || 'item').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  return 'Backups/Items/' + kind + '/' + safe;
}

/** ชื่อโฟลเดอร์ตามเวลา (UTC · เรียงตามชื่อได้ถูก) */
export function backupStamp(now = Date.now()) {
  return new Date(now).toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
}

/** อ่านเวลาจากชื่อโฟลเดอร์กลับเป็น ms (0 = อ่านไม่ได้) */
export function parseBackupStamp(name) {
  const m = String(name || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})$/);
  if (!m) return 0;
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isFinite(t) ? t : 0;
}

/** รายชื่อชุดสำรอง ใหม่สุดก่อน (ข้ามโฟลเดอร์ที่ชื่อไม่ใช่เวลา) */
export function sortBackups(names) {
  return (names || []).filter((n) => parseBackupStamp(n) > 0)
    .sort((a, b) => parseBackupStamp(b) - parseBackupStamp(a));
}
