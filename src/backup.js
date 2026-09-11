// backup.js — สำรองโปรเจกต์อัตโนมัติวันละครั้ง เก็บใน Backups/<YYYY-MM-DD>/
// บทเรียน: ห้ามก๊อปไฟล์ด้วย readFile+writeFile (utf-8) — รูปภาพจะเสีย → ใช้ kapi.copyFile
import { t, tf } from './i18n.js';
import { state, setStatus, log } from './core.js';
import { localDay } from './local-date.js';

const SKIP_DIRS = ['Recycle', 'Snapshots', '.k2history', 'Backups', 'Research'];
// [alpha.148] คีย์ AI เป็นของเครื่องนี้ ไม่ใช่ของผลงาน — ห้ามติดไปกับชุดสำรอง (ซึ่งมักถูกก๊อปไปแชร์ต่อ)
const SKIP_ROOT_FILES = ['ai-key.json'];
const MAX_KEEP = 7;
// [alpha.148] ป้าย "สำรองวันนี้ครบแล้ว" อยู่ **ในโฟลเดอร์สำรองของโปรเจกต์นั้นเอง**
// เดิมจำไว้ใน localStorage คีย์เดียวใช้ร่วมทุกโปรเจกต์ → เปิดโปรเจกต์ A (สำรองแล้ว) แล้วเปิด B
// ในวันเดียวกัน = B ถูกข้ามทั้งวัน · ป้ายเขียนตอนจบ → สำรองที่ล้มกลางทางจะถูกทำใหม่รอบถัดไป
export const BACKUP_DONE_MARK = '.k2backup-done.json';

/** วันนี้ของเครื่องผู้ใช้ (เดิม UTC → ตีหนึ่งถึงหกโมงเช้าเวลาไทยได้ชื่อโฟลเดอร์ของเมื่อวาน) */
function today() { return localDay(); }

export async function autoBackupNow(silent = false) {
  if (!state.root) { if (!silent) setStatus(t('ui.common.cantOpenProject')); return false; }
  try {
    const backupDir = await kapi.join(state.root, 'Backups');
    const ts = today();
    const dest = await kapi.join(backupDir, ts);
    if (await kapi.exists(dest)) await kapi.remove(dest);      // ทับรุ่นของวันเดียวกัน
    await kapi.mkdir(dest);

    // รวบรวมไฟล์ทั้งหมด (ยกเว้นโฟลเดอร์ที่ไม่ต้องสำรอง)
    const files = [];
    const scan = async (dir, rel) => {
      for (const name of await kapi.listFiles(dir, '').catch(() => [])) {
        if (!rel && SKIP_ROOT_FILES.includes(name)) continue;
        files.push({ src: await kapi.join(dir, name), rel: rel ? rel + '/' + name : name });
      }
      for (const name of await kapi.listDirs(dir).catch(() => [])) {
        if (SKIP_DIRS.includes(name)) continue;
        await scan(await kapi.join(dir, name), rel ? rel + '/' + name : name);
      }
    };
    await scan(state.root, '');

    let n = 0;
    for (const f of files) {
      try { await kapi.copyFile(f.src, await kapi.join(dest, ...f.rel.split('/'))); n++; }
      catch (e) { log('warn', t('ui.backup.backupSkipFile') + f.src, e); }
    }
    await kapi.writeFile(await kapi.join(dest, BACKUP_DONE_MARK),
                         JSON.stringify({ at: new Date().toISOString(), files: n }));

    // เก็บสูงสุด MAX_KEEP รุ่น (เรียงตามชื่อ = เรียงตามวันที่)
    const dirs = (await kapi.listDirs(backupDir).catch(() => [])).sort();
    while (dirs.length > MAX_KEEP) await kapi.remove(await kapi.join(backupDir, dirs.shift()));

    if (!silent) setStatus(tf('ui.backup.projectDoneFile', ts, n));
    log('info', `backup: saved ${ts} (${n} files)`);
    return true;
  } catch (e) {
    log('error', 'backup failed', e);
    if (!silent) setStatus(t('ui.backup.projectFail'));
    return false;
  }
}

// สำรองถ้ายังไม่ได้สำรองวันนี้ — เรียกตอนเปิดโปรเจกต์ + ทุก ๆ ชั่วโมง
// (setInterval 24 ชม. อย่างเดียวใช้ไม่ได้: โปรแกรมพกพาแทบไม่เคยเปิดค้างครบวัน)
export async function backupIfDue() {
  if (!state.root) return false;
  try {
    if (await kapi.exists(await kapi.join(state.root, 'Backups', today(), BACKUP_DONE_MARK))) return false;
  } catch {}
  return autoBackupNow(true);
}

let backupTimer = null;
export function startAutoBackup() {
  if (backupTimer) return;
  backupIfDue().catch(() => {});                                  // เช็คทันทีตอนเริ่ม
  backupTimer = setInterval(() => { backupIfDue().catch(() => {}); }, 60 * 60 * 1000);
}
