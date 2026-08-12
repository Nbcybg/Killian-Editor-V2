// import-ui.js — UI นำเข้าโปรเจกต์ Scrivener (ข้อ 63)
// เลือกโฟลเดอร์ .scriv → ดูตัวอย่างโครงที่จะได้ (dryRun) → เลือกปลายทาง → เขียนจริง → เปิดโปรเจกต์
import { tf } from '../i18n.js';
import { setStatus, log, t, setBusy, clearBusy } from '../core.js';
import { importScrivener } from './import-scrivener.js';
import { confirmBox } from '../ui.js';
import { syncIo } from '../project-scan.js';

// io adapter ให้เอนจิน (join ต้องเป็น sync — ดู syncIo ใน project-scan.js)
const makeIo = () => syncIo();

export async function importScrivenerDialog(onOpenProject) {
  const src = await kapi.openProjectDialog();
  if (!src) return null;

  // [alpha.62 บั๊ก 10] บอกที่แถบล่างว่ากำลังอ่าน · เคลียร์ก่อนเด้ง confirmBox ทุกครั้ง
  setBusy(t('ui.impOrt.busyReadProjectScrivener'));
  const io = makeIo();
  let preview;
  try { preview = await importScrivener(src, { io, dryRun: true }); }
  finally { clearBusy(); }
  if (!preview.ok) { setStatus(t('ui.imp.failed') + preview.error); return null; }

  const c = preview.counts || {};
  const lines = [
    t('ui.imp.projectName') + (preview.title || t('ui.imp.untitled')),
    t('ui.imp.chapters') + (c.chapters ?? 0) + t('ui.impOrt.scene') + (c.scenes ?? 0),
    t('ui.imp.filesToCreate') + (preview.plan?.count ?? 0),
  ];
  if (preview.warnings?.length) lines.push(t('ui.imp.warnPrefix') + preview.warnings.length + t('ui.imp.warnSuffix'));
  if (preview.warnings?.length) log('warn', t('ui.impOrt.scrivenerImportHasWord'), preview.warnings);

  if (!(await confirmBox(lines.join('\n') + t('ui.impOrt.pickFolderToDone')))) return null;

  const dest = await kapi.openProjectDialog();
  if (!dest) return null;
  if (await kapi.exists(io.join(dest, 'project.khn.json'))) {
    if (!(await confirmBox(t('ui.imp.overwrite')))) return null;
  }

  setBusy(t('ui.imp.working'));
  let res;
  try {
    res = await importScrivener(src, { io, dest, title: preview.title,
      now: new Date().toISOString(),
      onProgress: (n, total) => { if (n % 10 === 0) setBusy(tf('ui.impOrt.importFile', n, total)); } });
  } finally { clearBusy(); }
  if (!res.ok) { setStatus(t('ui.imp.failed') + res.error); return null; }

  setStatus(tf('ui.impOrt.importDoneFile', res.written, dest));
  log('info', t('ui.impOrt.scrivenerImportOk'), { src, dest, written: res.written });
  if (onOpenProject) await onOpenProject(dest);
  return res;
}

// ดูตัวอย่างอย่างเดียว (ใช้ใน selftest — ไม่เปิด dialog)
export function scrivenerIo() { return makeIo(); }
