// json-guard.js — [alpha.168 · bug hunt] อ่านไฟล์ JSON ของโปรเจกต์แบบ "ไฟล์เสีย ≠ ไฟล์ว่าง"
//
// ══ ต้นตอ ══
// `loadMaps()` / `loadTimeline()` เดิมเขียนว่า
//     try { data = await kapi.readJson(p); } catch { return { maps: [] }; }
// อ่านไม่ออก (ซิงก์มาครึ่งไฟล์ · แก้มือแล้วลูกน้ำเกิน · บันทึกเป็น UTF-8 with BOM) = ได้ "ของว่าง" เงียบ ๆ
// แผงโชว์ว่ายังไม่มีอะไร แล้วการแก้ครั้งถัดไป **เขียนของว่างนั้นทับไฟล์เดิมทั้งไฟล์** — แผนที่/เหตุการณ์ทั้งหมดหาย
//
// ══ ทางแก้ ══
// อ่านไม่ออก → **เก็บสำเนาของไฟล์เดิมไว้ข้าง ๆ ก่อน** (`maps.unreadable-<เวลา>.json`) แล้วค่อยคืนค่าว่างให้ทำงานต่อ
// สำเนาเก็บไม่ได้ = บอกผู้เรียกว่า "ห้ามเขียน" (`writable:false`) · ผู้เรียกแจ้งผู้ใช้เอง (โมดูลนี้ไม่แตะ DOM)
// ไฟล์เดิมที่เสียถูกสำรองครั้งเดียวต่อเนื้อเดิม (แผงที่โหลดใหม่ทุกครั้งที่วาดต้องไม่ปั๊มสำเนาเป็นร้อยไฟล์)
//
// โมดูลบริสุทธิ์ (รับ io เข้ามา) → unit test ได้ตรง ๆ

const done = new Map();                       // กุญแจไฟล์ → { sig, backup }

const keyOf = (p) => String(p || '').split('\\').join('/').replace(/\/+$/, '').toLowerCase();
const pad = (n) => String(n).padStart(2, '0');

/** ชื่อไฟล์สำรองของไฟล์ที่อ่านไม่ออก — อยู่โฟลเดอร์เดียวกัน · `maps.json` → `maps.unreadable-20261004-011500.json` */
export function brokenBackupName(file, date = new Date()) {
  const s = String(file || '');
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  const dir = s.slice(0, cut + 1), base = s.slice(cut + 1);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
  const stamp = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate())
    + '-' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
  return dir + stem + '.unreadable-' + stamp + ext;
}

/**
 * อ่านไฟล์ JSON อย่างปลอดภัย
 * @param {{exists:Function, readJson:Function, copyFile:Function, mtime?:Function}} io
 * @param {string} file
 * @param {() => any} fallback  ค่าที่คืนเมื่อไฟล์ไม่มี/อ่านไม่ออก
 * @param {{now?: Date}} [o]
 * @returns {Promise<{data:any, state:'ok'|'missing'|'broken', backup:string, writable:boolean, fresh:boolean, error?:any}>}
 *   state 'broken' = ไฟล์มีแต่อ่านไม่ออก · backup = ทางของสำเนา ('' = เก็บไม่ได้) · writable = เขียนทับไฟล์นี้ได้อย่างปลอดภัยไหม
 *   fresh = เพิ่งพบความเสียหายรอบนี้ (ผู้เรียกแจ้งผู้ใช้เฉพาะตอน fresh — ไม่ขึ้นซ้ำทุกครั้งที่วาดแผง)
 */
export async function readJsonGuarded(io, file, fallback, o = {}) {
  const k = keyOf(file);
  let has = false;
  try { has = !!(await io.exists(file)); } catch { has = false; }
  if (!has) { done.delete(k); return { data: fallback(), state: 'missing', backup: '', writable: true, fresh: false }; }
  try {
    const data = await io.readJson(file);
    if (data === null || typeof data !== 'object') throw new Error('not an object');
    done.delete(k);
    return { data, state: 'ok', backup: '', writable: true, fresh: false };
  } catch (error) {
    let sig = '';
    try { sig = io.mtime ? String(await io.mtime(file)) : ''; } catch { sig = ''; }
    const was = done.get(k);
    if (was && was.sig === sig && was.backup) {
      return { data: fallback(), state: 'broken', backup: was.backup, writable: true, fresh: false, error };
    }
    let backup = '';
    try {
      const dst = brokenBackupName(file, o.now || new Date());
      await io.copyFile(file, dst);
      backup = dst;
    } catch { backup = ''; }
    done.set(k, { sig, backup });
    return { data: fallback(), state: 'broken', backup, writable: !!backup, fresh: true, error };
  }
}

/** ล้างความจำ (เปลี่ยนโปรเจกต์ · เทส) */
export function resetJsonGuard() { done.clear(); }
