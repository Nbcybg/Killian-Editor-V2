// epoch-guard.js — [alpha.161 · C] "ผลที่คำนวณเสร็จ ยังตรงกับข้อมูลตอนนี้ไหม" (บริสุทธิ์ 100%)
//
// ★ ต้นตอตระกูลเดียวกันสามที่ (สายหน้าของเล่ม · ดัชนี RAG ของแชท · ดัชนีค้นหาทั้งโปรเจกต์):
//   แคชมีธง `stale` ตัวเดียว — งานสร้างที่ **เริ่มก่อน** invalidate แล้ว **เสร็จทีหลัง** ตั้ง `stale=false`
//   ทับการล้างนั้น → ผลที่อ่านจากข้อมูลเก่าถูกเก็บถาวร (ค้นไม่เจอฉากใหม่ · เลขหน้าไม่ขยับ · แชทตอบจากเนื้อเก่า)
//
// กติกา: ตัวล้างแคช `bump()` · งานสร้าง "จับเลข" ก่อนเริ่มอ่าน แล้วเก็บผลเป็น "สด" ได้เฉพาะเมื่อเลขยังไม่เปลี่ยน
// `runFresh()` วัดซ้ำให้เองแบบมีเพดานรอบ (ไม่มีเพดาน = วนไม่จบเมื่อมีอะไรล้างแคชตลอดเวลา)

/** ตัวนับรุ่นของข้อมูล — `bump()` ทุกครั้งที่ข้อมูลเปลี่ยน */
export function createEpoch() {
  let n = 0;
  return {
    bump() { n++; return n; },
    snap() { return n; },
    isCurrent(s) { return s === n; },
    get value() { return n; },
  };
}

/**
 * รันงานสร้าง แล้วบอกว่าผลยัง "สด" ไหม — ถ้ามีการ bump ระหว่างรันให้รันใหม่ ไม่เกิน `maxRounds` รอบ
 * @param {{snap:()=>number, isCurrent:(s:number)=>boolean}} epoch
 * @param {(round:number)=>Promise<any>|any} fn
 * @param {{maxRounds?:number}} [opts]
 * @returns {Promise<{value:any, fresh:boolean, rounds:number}>}
 *   fresh=false = รันครบเพดานแล้วข้อมูลยังเปลี่ยนระหว่างทาง → ใช้ผลได้ชั่วคราว แต่ **ห้ามเก็บเป็นของสด**
 */
export async function runFresh(epoch, fn, { maxRounds = 3 } = {}) {
  const cap = Math.max(1, Math.floor(Number(maxRounds) || 1));
  let value, rounds = 0;
  while (rounds < cap) {
    const s = epoch.snap();
    value = await fn(rounds);
    rounds++;
    if (epoch.isCurrent(s)) return { value, fresh: true, rounds };
  }
  return { value, fresh: false, rounds };
}
