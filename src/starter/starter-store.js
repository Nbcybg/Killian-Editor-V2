// starter-store.js — ชั้นไฟล์ของ Story Starter
//
// รูปแบบบนดิสก์ (สเปกข้อ 9 — โฟลเดอร์แยก ย้ายข้ามโปรเจกต์ได้):
//   <root>/Starters/<slug>/starter.json
//                         /images/<ไฟล์รูป>          ← ปกและรูปตัวละครอยู่ในตัวมันเอง
//                         /Scenarios/<id>.json       ← ตอนต่าง ๆ (สเปกข้อ 10)
//
// **ทุกอย่างที่ starter ต้องใช้อยู่ในโฟลเดอร์นี้หมด** — ไม่มีอะไรชี้ออกไปข้างนอกที่ขาดไม่ได้
// (`wikiPath` ของตัวละครชี้ออกก็จริง แต่ขาดได้ ดู starter-wiki-merge.js)
//
// เรื่องบันทึกอัตโนมัติ (สเปกข้อ 8): ทุกขั้นของ wizard เขียนไฟล์เอง ผู้ใช้ไม่ต้องกดบันทึก
// จึงต้องหน่วงรวบ ไม่งั้นพิมพ์หนึ่งตัวอักษร = เขียนดิสก์หนึ่งครั้ง

import { state, log, setStatus } from '../core.js';
import { t, tf } from '../i18n.js';
import {
  STARTER_DIR, SCENARIO_DIR, STARTER_FILE, IMAGE_DIR,
  migrateStarter, migrateScenario, newStarter, newScenario,
  scenarioFileName, uniqueSlug,
} from './starter-model.js';

// ───────────────────────── ที่อยู่ ─────────────────────────

export async function startersRoot() {
  if (!state.root) return '';
  return kapi.join(state.root, STARTER_DIR);
}
export async function starterDir(slug) {
  const base = await startersRoot();
  return base ? kapi.join(base, slug) : '';
}
export async function starterFile(slug) {
  const d = await starterDir(slug);
  return d ? kapi.join(d, STARTER_FILE) : '';
}
export async function imagesDir(slug) {
  const d = await starterDir(slug);
  return d ? kapi.join(d, IMAGE_DIR) : '';
}
export async function scenariosDir(slug) {
  const d = await starterDir(slug);
  return d ? kapi.join(d, SCENARIO_DIR) : '';
}

/** path เต็มของรูปใน starter (ไว้ยัด <img src>) — คืน '' เมื่อไม่มีรูป */
export async function imageUrl(slug, file) {
  if (!slug || !file) return '';
  const p = await kapi.join(await imagesDir(slug), file);
  if (!(await kapi.exists(p))) return '';
  return kapi.toFileURL(p);
}

// ───────────────────────── อ่าน ─────────────────────────

/**
 * starter ทั้งหมดของโปรเจกต์
 * ไฟล์พังตัวเดียวต้องไม่ทำให้ทั้งรายการหาย — จึงอ่านทีละตัวแล้วข้ามตัวที่พัง
 */
export async function listStarters() {
  const base = await startersRoot();
  if (!base || !(await kapi.exists(base))) return [];
  let dirs = [];
  try { dirs = await kapi.listDirs(base); } catch { return []; }
  const out = [];
  for (const slug of dirs) {
    try {
      const f = await kapi.join(base, slug, STARTER_FILE);
      if (!(await kapi.exists(f))) continue;
      const s = migrateStarter(await kapi.readJson(f));
      s.slug = slug;                       // ชื่อโฟลเดอร์คือความจริงเสมอ
      out.push(s);
    } catch (e) { log('warn', t('ui.starter.logReadFail') + slug, e); }
  }
  return out;
}

export async function readStarter(slug) {
  const f = await starterFile(slug);
  if (!f || !(await kapi.exists(f))) return null;
  try {
    const s = migrateStarter(await kapi.readJson(f));
    s.slug = slug;
    return s;
  } catch (e) { log('error', t('ui.starter.logReadFail') + slug, e); return null; }
}

// ───────────────────────── เขียน ─────────────────────────

/**
 * เขียนทันที — ใช้ตอนที่ "พลาดไม่ได้" (สร้างใหม่ · ออกจากหน้า · ก่อนแปลง)
 * ปกติให้เรียก `autoSaveStarter()` แทน
 */
export async function writeStarter(s) {
  if (!s || !s.slug) return false;
  const dir = await starterDir(s.slug);
  await kapi.mkdir(dir);
  const body = { ...s, updated: Date.now() };
  delete body.slug;                        // ชื่อโฟลเดอร์ = slug อยู่แล้ว ไม่ต้องเก็บซ้ำให้ขัดกันเอง
  await kapi.writeFile(await kapi.join(dir, STARTER_FILE), JSON.stringify(body, null, 2));
  s.updated = body.updated;
  return true;
}

// ── บันทึกอัตโนมัติแบบหน่วงรวบ ──────────────────────────────
const SAVE_DELAY = 400;
const _timers = new Map();       // key → timeout id
const _pending = new Map();      // key → ตัวข้อมูลล่าสุด
const _writers = new Map();      // key → ฟังก์ชันเขียนจริง

function queueSave(key, data, writer) {
  _pending.set(key, data);
  _writers.set(key, writer);
  clearTimeout(_timers.get(key));
  _timers.set(key, setTimeout(() => { flushKey(key); }, SAVE_DELAY));
}

async function flushKey(key) {
  clearTimeout(_timers.get(key));
  _timers.delete(key);
  const data = _pending.get(key);
  const writer = _writers.get(key);
  _pending.delete(key); _writers.delete(key);
  if (!data || !writer) return false;
  try { return await writer(data); }
  catch (e) { log('error', t('ui.starter.logSaveFail') + key, e); setStatus(t('ui.starter.saveFail')); return false; }
}

/** บันทึกทุกอย่างที่ยังค้างอยู่ — เรียกก่อนปิดโปรเจกต์/ปิดโปรแกรม/ออกจากหน้า */
export async function flushStarterSaves() {
  const keys = [..._timers.keys()];
  for (const k of keys) await flushKey(k);
  return keys.length;
}

/** มีอะไรค้างยังไม่ได้เขียนไหม (เทสใช้ยืนยันว่า autosave ทำงานจริง) */
export function pendingSaves() { return _timers.size; }

export function autoSaveStarter(s) {
  if (!s || !s.slug) return false;
  queueSave('st:' + s.slug, s, writeStarter);
  return true;
}

// ───────────────────────── สร้าง / ลบ ─────────────────────────

/**
 * สร้าง starter ใหม่
 * ชื่อโฟลเดอร์ถูกล็อกตอนสร้าง — **เปลี่ยนชื่อเรื่องทีหลังไม่ย้ายโฟลเดอร์**
 * (ทำตาม `renameSection` ที่จงใจไม่ย้ายโฟลเดอร์ เพราะอาจมีแท็บ/แผงเปิดค้างอยู่)
 */
export async function createStarter(name) {
  if (!state.root) return null;
  const taken = (await listStarters()).map((x) => x.slug);
  const slug = uniqueSlug(name || t('ui.starter.untitled'), taken);
  const s = newStarter({ name: name || '', slug, created: Date.now() });
  const dir = await starterDir(slug);
  await kapi.mkdir(dir);
  await kapi.mkdir(await kapi.join(dir, IMAGE_DIR));
  await kapi.mkdir(await kapi.join(dir, SCENARIO_DIR));
  await writeStarter(s);
  return s;
}

/**
 * ลบ starter — ย้ายลงถังขยะ ไม่ลบทิ้งจริง (ทำตาม `deleteSection`)
 * ผู้ใช้อาจเสียเวลาเขียนตัวละครกับบทไปหลายชั่วโมง กดผิดทีเดียวแล้วหายเลยไม่ได้
 */
export async function deleteStarter(slug) {
  const dir = await starterDir(slug);
  if (!dir || !(await kapi.exists(dir))) return false;
  await flushStarterSaves();
  const dst = await kapi.join(state.root, 'Recycle',
    Date.now().toString(36) + '-' + slug);
  await kapi.move(dir, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'starter', root: state.root, folderName: slug }, null, 2));
  return true;
}

// ───────────────────────── รูป ─────────────────────────

/**
 * ก๊อปรูปเข้ามาอยู่ใน starter — **จุดนี้คือสิ่งที่ทำให้ starter พกพาได้จริง**
 * ถ้าเก็บแค่ path ไปที่ `<root>/Images/` พอย้ายโฟลเดอร์ไปโปรเจกต์อื่นรูปจะหายหมด
 * @param {string} slug
 * @param {string} srcAbs  path เต็มของไฟล์ต้นทาง
 * @returns {Promise<string>} ชื่อไฟล์ในโฟลเดอร์ images/ ('' = ไม่สำเร็จ)
 */
export async function importImage(slug, srcAbs) {
  if (!slug || !srcAbs) return '';
  try {
    const dir = await imagesDir(slug);
    await kapi.mkdir(dir);
    return (await kapi.copyInto(srcAbs, dir)) || '';
  } catch (e) { log('error', t('ui.starter.logImgFail'), e); return ''; }
}

/** ก๊อปรูปจากคลังรูปของโปรเจกต์ (ผลของ pickImage = {file} สัมพัทธ์กับ Images/) */
export async function importFromGallery(slug, rel) {
  if (!rel) return '';
  const abs = await kapi.join(state.root, 'Images', ...String(rel).split('/'));
  if (!(await kapi.exists(abs))) return '';
  return importImage(slug, abs);
}

// ───────────────────────── Scenario ─────────────────────────

export async function listScenarios(slug) {
  const dir = await scenariosDir(slug);
  if (!dir || !(await kapi.exists(dir))) return [];
  let files = [];
  try { files = await kapi.listFiles(dir, '.json'); } catch { return []; }
  const out = [];
  for (const f of files) {
    try { out.push(migrateScenario(await kapi.readJson(await kapi.join(dir, f)))); }
    catch (e) { log('warn', t('ui.starter.logScReadFail') + f, e); }
  }
  return out;
}

export async function readScenario(slug, id) {
  const dir = await scenariosDir(slug);
  const f = await kapi.join(dir, id + '.json');
  if (!(await kapi.exists(f))) return null;
  try { return migrateScenario(await kapi.readJson(f)); }
  catch (e) { log('error', t('ui.starter.logScReadFail') + id, e); return null; }
}

export async function writeScenario(slug, sc) {
  if (!slug || !sc || !sc.id) return false;
  const dir = await scenariosDir(slug);
  await kapi.mkdir(dir);
  const body = { ...sc, updated: Date.now() };
  await kapi.writeFile(await kapi.join(dir, scenarioFileName(sc)), JSON.stringify(body, null, 2));
  sc.updated = body.updated;
  return true;
}

export async function createScenario(slug, patch = {}) {
  const sc = newScenario({ ...patch, created: Date.now() });
  await writeScenario(slug, sc);
  return sc;
}

export async function deleteScenario(slug, id) {
  const dir = await scenariosDir(slug);
  const f = await kapi.join(dir, id + '.json');
  if (!(await kapi.exists(f))) return false;
  await flushStarterSaves();
  await kapi.remove(f);
  return true;
}

/** ชื่อตอนถัดไปแบบไม่ต้องคิดเอง — "ตอนที่ N" ตามจำนวนที่มีอยู่ */
export function nextScenarioTitle(rows) {
  return tf('ui.starter.scDefaultTitle', ((rows || []).length + 1));
}
