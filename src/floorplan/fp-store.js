// fp-store.js — ไฟล์ของผังพื้นที่: `<โปรเจกต์>/FloorPlans/<id>.json` + ดัชนี `FloorPlans/index.json`
//
// ผังพื้นที่มีได้เยอะมาก (ฉากละหลายผัง) → **ห้ามอ่านทุกไฟล์ทุกครั้งที่แผงเปิด**
//   · รายการผัง / หาผังของฉาก = อ่านดัชนีไฟล์เดียว (`index.json` · ข้อมูลแค่ชื่อ/ฉาก/จำนวน)
//   · ดัชนีซ่อมตัวเอง: เทียบกับ "รายชื่อไฟล์" (ไม่อ่านเนื้อ) · อ่านเฉพาะไฟล์ที่ดัชนียังไม่รู้จัก
//     (ผู้ใช้ก๊อปผังมาวางเอง · ซิงก์มาจากเครื่องอื่น) · ไฟล์ที่หายไปแล้วถูกถอดออกจากดัชนี
//   · เนื้อเต็มอ่านเฉพาะผังที่เปิดอยู่ (แคชไว้หนึ่งใบ) · บันทึกแบบหน่วงรวบหลายการแก้เป็นครั้งเดียว
//   · ดัชนีแก้ผ่านคิวของไฟล์ (`mutateJson` — กฎ alpha.156) ไม่ใช่เขียนก้อนเก่าทับ
import { state, log, logAction } from '../core.js';
import { mutateJson } from '../json-store.js';
import { trashPathFor } from '../trash-path.js';
import { FP_DIR, FP_INDEX, normalizePlan, normalizeIndex, reconcileIndex, indexEntry, planFileName, idFromFile, newPlan } from './fp-data.js';

/** หน่วงบันทึก (ms) — ลาก/พิมพ์ติดกันหลายครั้งเขียนดิสก์ครั้งเดียว */
export const FP_SAVE_DELAY = 600;

const C = {
  root: '',
  index: null,          // ดัชนีที่อ่านแล้ว (ของ root นี้)
  plan: null,           // ผังที่เปิดอยู่ (เนื้อเต็ม)
  dirty: false,
  stuck: false,         // การสลับ/สร้างผังถูกระงับ (ผังที่ค้างเขียนไม่ผ่าน)
  timer: 0,
  saving: null,
};

async function dirOf(root = state.root) { return kapi.join(root, FP_DIR); }
async function fileOf(id, root = state.root) { return kapi.join(await dirOf(root), planFileName(id)); }
async function indexFile(root = state.root) { return kapi.join(await dirOf(root), FP_INDEX); }
function sameRoot() {
  if (C.root === state.root) return;
  // ผังที่ค้างของโปรเจกต์เดิม: เขียนลงโปรเจกต์เดิมก่อนทิ้ง (ปกติกล่องปิดโปรเจกต์บันทึกให้แล้ว — นี่คือตาข่าย)
  if (C.plan && C.dirty && C.root) { const keep = { ...C }; flushPlanOf(keep).catch(() => {}); }
  C.root = state.root || ''; C.index = null; C.plan = null; C.dirty = false; clearTimeout(C.timer);
}
async function flushPlanOf(k) {
  k.plan.updated = new Date().toISOString();
  await kapi.writeFile(await fileOf(k.plan.id, k.root), JSON.stringify(k.plan, null, 2));
  await writeIndex((d) => { d.plans[k.plan.id] = indexEntry(k.plan); }, k.root);
}

/**
 * ดัชนีของผังทั้งหมด (ซ่อมตัวเองเทียบกับไฟล์จริง) — เรียกบ่อยได้ · อ่านเนื้อเฉพาะไฟล์ใหม่
 * @param {{fresh?: boolean}} o fresh = ตรวจกับดิสก์ใหม่ (ไม่ใช้ที่แคชไว้)
 */
export async function loadIndex(o = {}) {
  sameRoot();
  if (!state.root) return normalizeIndex(null);
  if (C.index && !o.fresh) return C.index;
  const dir = await dirOf();
  if (!(await kapi.exists(dir))) { C.index = normalizeIndex(null); return C.index; }
  let idx;
  try { idx = normalizeIndex(await kapi.readJson(await indexFile())); } catch { idx = normalizeIndex(null); }
  const ids = (await kapi.listFiles(dir, '.json').catch(() => [])).map(idFromFile).filter(Boolean);
  const { missing, stale } = reconcileIndex(idx, ids);
  if (missing.length || stale.length) {
    for (const id of stale) delete idx.plans[id];
    for (const id of missing) {
      try { idx.plans[id] = indexEntry(normalizePlan(await kapi.readJson(await fileOf(id)))); }
      catch (e) { log('warn', 'floorplan: index read failed', e); }
    }
    await writeIndex((d) => { d.plans = idx.plans; });
    log('info', 'floorplan: index repaired', { added: missing.length, removed: stale.length });
  }
  C.index = idx;
  return idx;
}

/** แก้ดัชนีในคิวของไฟล์ (อ่านสด → แก้ → เขียน) แล้วเก็บผลเป็นแคช · root = โปรเจกต์ของผัง (ไม่ใช่ที่เปิดอยู่ตอนนี้) */
async function writeIndex(fn, root = state.root) {
  await kapi.mkdir(await dirOf(root));
  const r = await mutateJson(kapi, await indexFile(root), (d) => {
    const n = normalizeIndex(d);
    d.version = n.version; d.plans = n.plans;
    return fn(d);
  }, { fallback: () => ({ version: 1, plans: {} }) });
  const idx = normalizeIndex(r.data);
  if (root === C.root) C.index = idx;
  return idx;
}

/** เปิดผัง (เนื้อเต็ม) — ใบเดิมที่ค้างบันทึกถูกเขียนก่อน */
export async function openPlan(id) {
  sameRoot();
  if (C.plan && C.plan.id === id) return C.plan;
  // [alpha.168 · bug hunt] ใบเดิมเขียนไม่ผ่าน = ยังอยู่ที่ใบเดิม (เดิมทิ้งผล flush แล้วแทนที่ = งานที่ค้างหาย)
  if (!(await flushPlan())) { C.stuck = true; return C.plan; }
  C.stuck = false;
  try {
    const p = normalizePlan(await kapi.readJson(await fileOf(id)));
    p.id = id;                                    // ชื่อไฟล์คือ id จริง (ไฟล์ที่ก๊อปมาอาจมี id ข้างในซ้ำกับใบอื่น)
    C.plan = p; C.dirty = false;
    return p;
  } catch (e) {
    log('warn', 'floorplan: open failed', e);
    return null;
  }
}
export function currentPlan() { sameRoot(); return C.plan; }
/** การสลับ/สร้างผังครั้งล่าสุดถูกระงับเพราะผังที่ค้างเขียนไม่ผ่าน (แผงใช้บอกผู้ใช้) — อ่านแล้วล้าง */
export function takeStuck() { const v = !!C.stuck; C.stuck = false; return v; }
export function isPlanDirty() { return !!(C.plan && C.dirty); }

/** สร้างผังใหม่ (เขียนไฟล์ทันที + ขึ้นดัชนี) → คืนผัง */
export async function createPlan(name, scene = null, seed = null) {
  sameRoot();
  if (!(await flushPlan())) { C.stuck = true; return null; }      // ผังที่ค้างเขียนไม่ผ่าน = ไม่สร้างใบใหม่ทับ
  const p = seed ? normalizePlan({ ...seed, id: undefined }) : newPlan(name, scene);
  if (seed) { p.name = name || p.name; p.scene = scene === undefined ? p.scene : normalizePlan({ scene }).scene; }
  p.updated = new Date().toISOString();
  await kapi.mkdir(await dirOf());
  await kapi.writeFile(await fileOf(p.id), JSON.stringify(p, null, 2));
  await writeIndex((d) => { d.plans[p.id] = indexEntry(p); });
  C.plan = p; C.dirty = false;
  logAction('floorplan', 'create', { id: p.id, name: p.name, scene: p.scene && p.scene.id });
  return p;
}

/** ผังที่เปิดอยู่ถูกแก้ → บันทึกแบบหน่วง (หลายการแก้ติดกัน = เขียนครั้งเดียว) */
export function markPlanDirty() {
  if (!C.plan) return;
  C.dirty = true;
  clearTimeout(C.timer);
  C.timer = setTimeout(() => { flushPlan().catch((e) => log('warn', 'floorplan: save failed', e)); }, FP_SAVE_DELAY);
}

/** เขียนผังที่ค้างลงดิสก์เดี๋ยวนี้ (ปิดโปรแกรม · เปลี่ยนผัง · บันทึกทั้งหมด) → true = ไม่มีอะไรค้าง */
export async function flushPlan() {
  clearTimeout(C.timer);
  if (C.saving) { try { await C.saving; } catch { /* รอบก่อนล้ม — รอบนี้ลองเอง */ } }
  const p = C.plan;
  // ★ เขียนลงโปรเจกต์ของผังเสมอ (C.root) — ตัวหน่วงอาจยิงหลังผู้ใช้สลับโปรเจกต์ไปแล้ว
  const root = C.root;
  if (!p || !C.dirty || !root) return true;
  C.dirty = false;
  const job = (async () => {
    p.updated = new Date().toISOString();
    const text = JSON.stringify(p, null, 2);
    await kapi.writeFile(await fileOf(p.id, root), text);
    const e = indexEntry(p);
    const was = C.index && C.index.plans[p.id];
    if (!was || JSON.stringify({ ...was, updated: '' }) !== JSON.stringify({ ...e, updated: '' })) {
      await writeIndex((d) => { d.plans[p.id] = e; }, root);
    } else if (C.index) C.index.plans[p.id] = e;    // เปลี่ยนแค่เวลา — ไม่ต้องเขียนดัชนีทุกครั้งที่ลาก
  })();
  C.saving = job;
  try { await job; return true; }
  catch (e) { C.dirty = true; log('warn', 'floorplan: write failed', e); return false; }
  finally { C.saving = null; }
}

/** เปลี่ยนชื่อ/ผูกฉาก ของผังที่เปิดอยู่ (บันทึกทันที — ดัชนีต้องตรง) */
export async function updatePlanMeta(patch) {
  if (!C.plan) return false;
  if (patch.name != null) C.plan.name = String(patch.name);
  if (patch.scene !== undefined) C.plan.scene = normalizePlan({ scene: patch.scene }).scene;
  C.dirty = true;
  return flushPlan();
}

/** ย้ายผังลงถังขยะ (กู้คืนได้ — ใบกู้คืนบอกว่ากลับไป FloorPlans) */
export async function trashPlan(id) {
  sameRoot();
  // รอการเขียนที่กำลังวิ่งให้จบก่อนย้ายไฟล์ (ไม่งั้นไฟล์ถูกเขียนกลับมาหลังย้ายลงถัง = ผังผี)
  if (C.saving) { try { await C.saving; } catch { /* ignore */ } }
  if (C.plan && C.plan.id === id) { clearTimeout(C.timer); C.plan = null; C.dirty = false; }
  const file = await fileOf(id);
  if (!(await kapi.exists(file))) { await writeIndex((d) => { delete d.plans[id]; }); return null; }
  const dst = await trashPathFor(file);
  await kapi.move(file, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify({ kind: 'floorplan', id, fileName: planFileName(id) }, null, 2));
  await writeIndex((d) => { delete d.plans[id]; });
  logAction('floorplan', 'trash', { from: file, to: dst });
  return dst;
}

/** คืนผังจากถังขยะ (recycle.js เรียกเมื่อใบกู้คืนเป็นชนิด floorplan) → ชื่อไฟล์ที่ได้ */
export async function restorePlanFile(trashFile, info) {
  const dir = await dirOf();
  await kapi.mkdir(dir);
  let name = planFileName(info && info.id ? info.id : 'fp-' + Date.now().toString(36));
  if (await kapi.exists(await kapi.join(dir, name))) name = planFileName('fp-' + Date.now().toString(36));
  await kapi.move(trashFile, await kapi.join(dir, name));
  C.index = null;                                  // ให้ loadIndex ซ่อม (ไฟล์ใหม่ = อ่านเข้าดัชนี)
  return name;
}

/** ทำสำเนาผัง (ตำแหน่ง/จังหวะครบ) */
export async function duplicatePlan(id, name) {
  if (!(await flushPlan())) { C.stuck = true; return null; }
  let src;
  try { src = await kapi.readJson(await fileOf(id)); } catch { return null; }
  const p = await createPlan(name || src.name, undefined, src);
  return p;
}

/** ล้างแคช (เปลี่ยนโปรเจกต์ · เทส) */
export function resetFpStore() { clearTimeout(C.timer); C.root = ''; C.index = null; C.plan = null; C.dirty = false; C.stuck = false; }
/** รายการงานค้างสำหรับทะเบียน (กฎ alpha.72) */
export function fpDirtyList() {
  if (!C.plan || !C.dirty) return [];
  return [{ key: '::floorplan::' + C.plan.id, title: C.plan.name || C.plan.id, file: '' }];
}
