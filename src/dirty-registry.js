// dirty-registry.js — ทะเบียน "งานที่ยังไม่ได้บันทึก" ของทั้งโปรแกรม (alpha.72 · ข้อ 4)
// โมดูลบริสุทธิ์ ไม่แตะ DOM/kapi — unit test แยกที่ test/dirty-registry.test.cjs
//
// ═══ กฎที่ผู้ใช้กำหนด (alpha.72) ═══
//   « อะไรที่มีการทิ้งเมื่อปิด หรือ update ตอนปิดโปรแกรม ต้องขึ้น list ทุกครั้ง »
//
// ปัญหาเดิม: กล่อง "บันทึกก่อนปิด" อ่านจาก `state.tabs` อย่างเดียว → ของที่ไม่ได้อยู่ในรูปแท็บ
// (กระดานวางแผน) หายเงียบ ๆ ตอนปิดโปรแกรม เพราะไม่เคยถูกเอ่ยถึงในรายการเลย
//
// วิธีใหม่: ทุกระบบที่ถือ "งานค้างที่หายได้" ต้อง **ลงทะเบียน** ที่นี่ที่เดียว
//   registerDirtySource('planner', { label, list, save })
// แล้วกล่องบันทึกทั้งหมด (ปิดโปรแกรม · บันทึกทั้งหมด) จะเห็นเองอัตโนมัติ
//
// provider = {
//   label : ชื่อกลุ่มที่โชว์ในรายการ เช่น 'กระดานวางแผน'
//   list  : () => [{ key, title, file? }]   งานค้างตอนนี้ (คืน [] ถ้าไม่มี)
//   save  : async (key) => boolean          บันทึกรายการนั้น
// }

import { T } from './i18n.js';
/** สร้างทะเบียนใหม่ (โปรแกรมจริงใช้ตัวเดียวที่ export ไว้ท้ายไฟล์ · เทสสร้างของตัวเองได้) */
export function createDirtyRegistry() {
  const providers = new Map();

  const register = (id, p) => {
    if (!id || !p || typeof p.list !== 'function') throw new Error(T`dirty-registry: provider ต้องมี list()`);
    providers.set(id, { label: p.label || id, list: p.list, save: p.save || null });
    return () => providers.delete(id);
  };

  /** งานค้างทั้งหมดจากทุกแหล่ง — provider ที่ throw ถูกข้าม ไม่ให้ลากกล่องบันทึกล้มทั้งอัน */
  const collect = () => {
    const out = [];
    for (const [id, p] of providers) {
      let items = [];
      try { items = p.list() || []; } catch { items = []; }
      for (const it of items) {
        if (!it || !it.key) continue;
        out.push({ key: String(it.key), title: it.title || String(it.key),
                   file: it.file || '', source: id, sourceLabel: p.label });
      }
    }
    return out;
  };

  /**
   * บันทึกตามคีย์ที่เลือก — คืน { saved, failed:[{key,error}] }
   * ไม่ throw ออกไป: รายการหนึ่งพังต้องไม่ทำให้ที่เหลือไม่ถูกบันทึก (ของเดิมเคยหลุดทั้งลูป)
   */
  const saveKeys = async (keys) => {
    const want = new Set((keys || []).map(String));
    const items = collect().filter((x) => want.has(x.key));
    const failed = [];
    let saved = 0;
    for (const it of items) {
      const p = providers.get(it.source);
      if (!p || !p.save) { failed.push({ key: it.key, error: T`ไม่มีตัวบันทึก` }); continue; }
      try {
        const ok = await p.save(it.key);
        if (ok === false) failed.push({ key: it.key, error: T`บันทึกไม่สำเร็จ` });
        else saved++;
      } catch (e) { failed.push({ key: it.key, error: (e && e.message) || String(e) }); }
    }
    return { saved, failed };
  };

  return {
    register,
    unregister: (id) => providers.delete(id),
    has: (id) => providers.has(id),
    ids: () => [...providers.keys()],
    collect,
    count: () => collect().length,
    saveKeys,
    clear: () => providers.clear(),
  };
}

/** ทะเบียนกลางของโปรแกรม */
export const dirtyRegistry = createDirtyRegistry();
export const registerDirtySource = (id, p) => dirtyRegistry.register(id, p);
export const collectDirty = () => dirtyRegistry.collect();
