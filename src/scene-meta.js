// scene-meta.js — แหล่งความจริงเดียวของ "คุณสมบัติฉาก" (alpha.60r2 · ข้อ 13)
//
// เดิม scenes.json เก็บทุกอย่าง — ทั้งดัชนี (ชื่อ/ลำดับ/ไฟล์) และเนื้อคุณสมบัติหนัก ๆ
// (เรื่องย่อ · POV · อารมณ์ · ความขัดแย้ง · โน้ต · แท็ก · ป้ายย้อนอดีต)
// ผลคือแก้ไฟล์ .md นอกโปรแกรมแล้วข้อมูลไม่ตรงกัน และ scenes.json บวมจนอ่านด้วยตาไม่ไหว
//
// ตอนนี้:
//   scenes.json = **ดัชนีเบา** (id · title · order · fileName · chapterGuid · status · color · flag · wordCount · startPage · pageFlow)
//   .md frontmatter = **คุณสมบัติจริง** (เรื่องย่อ · POV · อารมณ์ · … ) — แก้นอกโปรแกรมได้ตรง ๆ
//
// ทุกทางอ่าน/เขียนคุณสมบัติฉากต้องผ่าน readSceneMeta/writeSceneMeta ไฟล์นี้เท่านั้น
// ส่วนบนของไฟล์เป็นฟังก์ชันบริสุทธิ์ (มี unit test แยก) · ส่วนล่างแตะ kapi/ดิสก์

import { dumpMdFile, parseMdFile } from './md.js';

// ───────── ตารางฟิลด์ ─────────
/** คุณสมบัติที่ย้ายไป frontmatter ของ .md (แหล่งความจริง) */
export const SCENE_HEAVY_KEYS = [
  'synopsis', 'pov', 'emotion', 'conflict', 'note', 'futureNote',
  'tags', 'storyDate', 'isFlashback', 'isFlashforward',
];
/** คุณสมบัติที่ scenes.json ยังเก็บไว้เป็นดัชนี (explorer/ตารางฉาก/ค้นหาใช้ตรง ๆ) */
export const SCENE_INDEX_KEYS = [
  'id', 'title', 'order', 'fileName', 'chapterGuid',
  'status', 'color', 'flag', 'isFavorite', 'wordCount', 'startPage', 'date',
  // [alpha.141] 'continue' = ไล่เลขหน้าต่อจากฉาก/บทก่อนหน้าในเล่มเดียวกัน (ดู book-flow.js)
  'pageFlow',
];
const HEAVY = new Set(SCENE_HEAVY_KEYS);
const BOOL_KEYS = new Set(['isFlashback', 'isFlashforward']);
const LIST_KEYS = new Set(['tags']);

// ───────── ส่วนบริสุทธิ์ ─────────
/** frontmatter ไม่มีชนิดข้อมูล (บทเรียนข้อ 26) — คืนค่าเป็น boolean จริง */
export function asBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}
/** แท็กอาจมาเป็น array (json) หรือสตริงคั่นด้วย , (frontmatter) */
export function asList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (v == null || v === '') return [];
  return String(v).split(',').map((x) => x.trim()).filter(Boolean);
}

/** แปลงค่าดิบให้เป็นชนิดที่ UI คาดหวัง (bool/list/string) */
export function coerceSceneMeta(o) {
  const out = {};
  for (const k of SCENE_HEAVY_KEYS) {
    if (!(k in (o || {}))) continue;
    const v = o[k];
    out[k] = BOOL_KEYS.has(k) ? asBool(v) : LIST_KEYS.has(k) ? asList(v) : (v == null ? '' : String(v));
  }
  return out;
}

/**
 * รวมคุณสมบัติ: frontmatter ชนะ scenes.json เสมอ (frontmatter = แหล่งความจริง)
 * ค่าที่ frontmatter ไม่มีเลย → ตกไปใช้ค่าใน scenes.json (ไฟล์เก่าที่ยังไม่ย้าย)
 */
export function mergeSceneMeta(row, fm) {
  const fromRow = coerceSceneMeta(row || {});
  const fromFm = coerceSceneMeta(fm || {});
  const out = { ...fromRow };
  for (const k of Object.keys(fromFm)) {
    const v = fromFm[k];
    const empty = v === '' || (Array.isArray(v) && !v.length) || v === false;
    if (!empty || !(k in fromRow)) out[k] = v;
  }
  // เติมคีย์ที่ไม่มีทั้งสองฝั่งให้ครบ เพื่อให้ผู้เรียกไม่ต้องเช็ค undefined
  for (const k of SCENE_HEAVY_KEYS) {
    if (k in out) continue;
    out[k] = BOOL_KEYS.has(k) ? false : LIST_KEYS.has(k) ? [] : '';
  }
  return out;
}

/** ถอดคุณสมบัติหนักออกจากแถว scenes.json (ทำให้ดัชนีเบาลง) — คืนแถวใหม่ ไม่แก้ของเดิม */
export function stripHeavyFromRow(row) {
  const out = {};
  for (const k of Object.keys(row || {})) if (!HEAVY.has(k)) out[k] = row[k];
  return out;
}

/**
 * ยัดคุณสมบัติลง meta ของ .md — ค่าเท็จ/ว่างถูก `delete` ทิ้ง
 * (บทเรียนข้อ 26: อย่าเขียน `isFlashback: false` รกทุกไฟล์)
 * @returns meta ตัวเดิมที่ถูกแก้แล้ว (เพื่อให้ต่อ dumpMdFile ได้ทันที)
 */
export function applySceneMetaToFrontmatter(meta, props) {
  const m = meta || {};
  const p = props || {};
  for (const k of SCENE_HEAVY_KEYS) {
    if (!(k in p)) continue;
    const v = p[k];
    if (BOOL_KEYS.has(k)) { if (asBool(v)) m[k] = true; else delete m[k]; continue; }
    if (LIST_KEYS.has(k)) { const l = asList(v); if (l.length) m[k] = l; else delete m[k]; continue; }
    const s = v == null ? '' : String(v);
    if (s) m[k] = s; else delete m[k];
  }
  return m;
}

/** คุณสมบัติฉากเปล่า (ครบทุกคีย์) */
export function emptySceneMeta() { return mergeSceneMeta(null, null); }

// ───────── ส่วนที่แตะดิสก์ (kapi เป็น global ที่ preload ยัดให้) ─────────
/**
 * อ่านคุณสมบัติฉากจากไฟล์ .md (frontmatter) รวมกับแถวใน scenes.json
 * @param {string} file  พาธเต็มของไฟล์ฉาก
 * @param {object} [row] แถวใน scenes.json (ถ้ามี — ใช้เป็นค่าสำรองของไฟล์เก่า)
 */
export async function readSceneMeta(file, row) {
  let fm = null;
  try { fm = parseMdFile(await kapi.readFile(file)).meta; } catch { fm = null; }
  return mergeSceneMeta(row, fm);
}

/**
 * เขียนคุณสมบัติฉากลง frontmatter ของ .md (เนื้อหาไม่ถูกแตะ)
 * @returns {Promise<boolean>} true เมื่อเขียนสำเร็จ
 */
export async function writeSceneMeta(file, props) {
  try {
    const { meta, body } = parseMdFile(await kapi.readFile(file));
    applySceneMetaToFrontmatter(meta, props);
    await kapi.writeFile(file, dumpMdFile(meta, body));
    return true;
  } catch { return false; }
}
