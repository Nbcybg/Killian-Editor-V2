// import-ui.js — UI นำเข้าโปรเจกต์ Scrivener (ข้อ 63)
// เลือกโฟลเดอร์ .scriv → ดูตัวอย่างโครงที่จะได้ (dryRun) → เลือกปลายทาง → เขียนจริง → เปิดโปรเจกต์
import { T } from '../i18n.js';
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
  setBusy(T`กำลังอ่านโปรเจกต์ Scrivener…`);
  const io = makeIo();
  let preview;
  try { preview = await importScrivener(src, { io, dryRun: true }); }
  finally { clearBusy(); }
  if (!preview.ok) { setStatus(t('imp.failed', 'นำเข้าไม่สำเร็จ: ') + preview.error); return null; }

  const c = preview.counts || {};
  const lines = [
    t('imp.projectName', 'ชื่อโปรเจกต์: ') + (preview.title || t('imp.untitled', '(ไม่มีชื่อ)')),
    t('imp.chapters', 'บท: ') + (c.chapters ?? 0) + T`  ·  ฉาก: ` + (c.scenes ?? 0),
    t('imp.filesToCreate', 'ไฟล์ที่จะสร้าง: ') + (preview.plan?.count ?? 0),
  ];
  if (preview.warnings?.length) lines.push(t('imp.warnPrefix', '⚠ คำเตือน ') + preview.warnings.length + t('imp.warnSuffix', ' รายการ (ดูใน Log)'));
  if (preview.warnings?.length) log('warn', T`scrivener import: มีคำเตือน`, preview.warnings);

  if (!(await confirmBox(lines.join('\n') + T`\n\nเลือกโฟลเดอร์ปลายทางแล้วนำเข้าเลยไหม?`))) return null;

  const dest = await kapi.openProjectDialog();
  if (!dest) return null;
  if (await kapi.exists(io.join(dest, 'project.khn.json'))) {
    if (!(await confirmBox(t('imp.overwrite', 'โฟลเดอร์ปลายทางมีโปรเจกต์อยู่แล้ว — เขียนทับไหม?')))) return null;
  }

  setBusy(t('imp.working', 'กำลังนำเข้า…'));
  let res;
  try {
    res = await importScrivener(src, { io, dest, title: preview.title,
      now: new Date().toISOString(),
      onProgress: (n, total) => { if (n % 10 === 0) setBusy(T`นำเข้า ${n}/${total} ไฟล์…`); } });
  } finally { clearBusy(); }
  if (!res.ok) { setStatus(t('imp.failed', 'นำเข้าไม่สำเร็จ: ') + res.error); return null; }

  setStatus(T`นำเข้าเสร็จ ${res.written} ไฟล์ → ${dest}`);
  log('info', T`scrivener import สำเร็จ`, { src, dest, written: res.written });
  if (onOpenProject) await onOpenProject(dest);
  return res;
}

// ดูตัวอย่างอย่างเดียว (ใช้ใน selftest — ไม่เปิด dialog)
export function scrivenerIo() { return makeIo(); }
