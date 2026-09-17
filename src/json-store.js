// json-store.js — [alpha.156] อ่าน-แก้-เขียนไฟล์ JSON ของโปรเจกต์แบบ "ไม่ทับของคนอื่น"
//
// ══ ต้นตอของบั๊กตระกูลนี้ ══
// `scenes.json` / `draft.json` ถูกแตะจากหลายสิบจุด ทุกจุดเขียนแบบ
//     const d = await kapi.readJson(f); …แก้ d… ; await kapi.writeFile(f, JSON.stringify(d))
// ปัญหามีสองแบบ:
//   1. **อ่านไว้นานแล้วค่อยเขียน** — แผงคุณสมบัติอ่าน scenes.json ตอนวาดแผง แล้วเขียน "ก้อนนั้น" กลับ
//      ทุกครั้งที่พิมพ์เรื่องย่อ · ระหว่างนั้นผู้ใช้เพิ่มฉากจากต้นไม้ = แถวของฉากใหม่หายไปจากไฟล์
//      (Kanban ก็เป็นแบบเดียวกัน: โหลดครั้งเดียว ลากการ์ด = เขียนทั้งก้อน)
//   2. **สองงานอ่าน-เขียนซ้อนกัน** — บันทึกฉาก (อัปเดตจำนวนคำ) กับคุณสมบัติที่บันทึกอัตโนมัติ
//      อ่านพร้อมกัน ต่างคนต่างเขียน → ของที่เขียนก่อนหายไป
//
// ══ ทางแก้ ══
// `mutateJson(io, file, fn)` = อ่าน **สด** → ให้ fn แก้ → เขียน · ทั้งหมดอยู่ในคิวของไฟล์นั้น
// (งานของไฟล์เดียวกันเข้าแถวทีละงาน · ไฟล์ต่างกันวิ่งพร้อมกันได้)
//
// ข้อควรระวัง: **ห้ามเรียก mutateJson ของไฟล์เดียวกันซ้อนจากใน fn** — จะรอตัวเองตลอดกาล
// โมดูลบริสุทธิ์ (ไม่แตะ DOM/kapi โดยตรง — รับ io เข้ามา) → unit test ได้ตรง ๆ

const queues = new Map();

/** กุญแจของไฟล์ — ไม่สนตัวคั่น/ตัวพิมพ์ (Windows) */
export function fileKey(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * รันงานในคิวของไฟล์นี้ (ทีละงาน) — คืนผลของ fn · งานก่อนหน้าล้มไม่ทำให้งานถัดไปล้มตาม
 * @template T
 * @param {string} file
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export function withFileLock(file, fn) {
  const k = fileKey(file);
  const prev = queues.get(k) || Promise.resolve();
  const run = prev.catch(() => {}).then(() => fn());
  const tail = run.then(() => {}, () => {});
  queues.set(k, tail);
  tail.then(() => { if (queues.get(k) === tail) queues.delete(k); });
  return run;
}

/** จำนวนไฟล์ที่ยังมีงานค้างในคิว (เทสใช้ยืนยันว่าคิวไม่รั่ว) */
export function pendingLocks() { return queues.size; }

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * อ่านสด → แก้ → เขียน (ในคิวของไฟล์)
 * @param {{readJson:Function, writeFile:Function}} io
 * @param {string} file
 * @param {(data:any) => any} fn  แก้ `data` ในที่ · คืน `false` = ไม่ต้องเขียน · คืนค่าอื่น = ส่งต่อเป็น result
 * @param {{fallback?: any}} [opts]  ไฟล์ไม่มี/อ่านไม่ได้ → ใช้ค่านี้ (ไม่ส่ง = โยน error เหมือนเดิม)
 * @returns {Promise<{data:any, changed:boolean, result:any}>}
 */
export function mutateJson(io, file, fn, opts = {}) {
  return withFileLock(file, async () => {
    let data;
    try { data = await io.readJson(file); }
    catch (e) {
      if (!('fallback' in opts)) throw e;
      data = typeof opts.fallback === 'function' ? opts.fallback() : clone(opts.fallback);
    }
    const result = await fn(data);
    if (result === false) return { data, changed: false, result };
    await io.writeFile(file, JSON.stringify(data, null, 2));
    return { data, changed: true, result };
  });
}
