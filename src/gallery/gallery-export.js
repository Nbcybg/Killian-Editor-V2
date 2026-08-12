// gallery-export.js — ส่งออกจากคลังรูป (alpha.63 · Phase 8)
//   · ส่งออกอัลบั้ม / รูปที่เลือก / เฉพาะรูปที่ถูกใช้จริง → .zip (ไบต์ดิบ ไม่ผ่าน utf-8)
//   · ส่งออกกระดานอารมณ์เป็นภาพรวมใบเดียว → .png (วาดบน canvas ตามพิกัดบนกระดาน)
import { T } from '../i18n.js';
import JSZip from 'jszip';
import { setStatus, log, setBusy, clearBusy } from '../core.js';
import * as AC from './album-core.js';
import * as MB from './moodboard.js';
import { usageOf } from './usage-index.js';

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_');

/** สรุปเป็นไฟล์ .md แนบไปในซิป — ผู้รับรู้ว่าแต่ละรูปคืออะไร ใช้ที่ไหน */
function manifest(items, usage, title) {
  const lines = [`# ${title}`, '', T`รูปทั้งหมด ${items.length} ใบ`, ''];
  for (const it of items) {
    lines.push(`## ${it.file}`);
    if (it.caption) lines.push(T`คำบรรยาย: ${it.caption}`);
    lines.push(T`อัลบั้ม: ${it.album === AC.ROOT_ALBUM ? AC.ROOT_ALBUM_NAME : it.album}`);
    if (it.tags && it.tags.length) lines.push(T`แท็ก: ${it.tags.join(' ')}`);
    const uses = usage ? usageOf(usage, it.file) : [];
    if (uses.length) lines.push(T`ใช้ใน: ` + [...new Set(uses.map((u) => u.title))].join(', '));
    lines.push('', `![${it.caption || ''}](${it.path})`, '');
  }
  return lines.join('\n');
}

/**
 * ส่งออกรูปเป็น .zip — คงโครงอัลบั้มไว้ (`ตัวละคร/ref.png`) + `รายการรูป.md`
 * @returns {Promise<boolean>}
 */
export async function exportImages(root, items, { name = T`คลังรูป`, usage = null } = {}) {
  const list = (items || []).filter((i) => i && i.path);
  if (!list.length) { setStatus(T`ไม่มีรูปให้ส่งออก`); return false; }
  setBusy(T`กำลังรวบรวมรูป ${list.length} ใบ…`);
  try {
    const zip = new JSZip();
    let n = 0;
    for (const it of list) {
      const abs = await kapi.join(root, AC.IMAGES_DIR, ...it.path.split('/'));
      try {
        const bytes = await kapi.readBytes(abs);            // ไบนารีต้องผ่าน readBytes (บทเรียน 14d)
        zip.file(it.path, new Uint8Array(bytes));
        n++;
        if (n % 10 === 0) setBusy(T`กำลังรวบรวมรูป… (${n}/${list.length})`);
      } catch (e) { log('warn', T`gallery-export: ข้ามไฟล์ ` + abs, e); }
    }
    zip.file(T`รายการรูป.md`, manifest(list, usage, name));
    clearBusy();                                            // อย่าให้สปินเนอร์ค้างตอนรอผู้ใช้ตอบ (บทเรียน 85)
    const dest = await kapi.saveAsDialog(safe(name) + '.zip');
    if (!dest) return false;
    setBusy(T`กำลังบีบอัดและเขียนไฟล์…`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await kapi.writeBytes(dest, Array.from(bytes));
    setStatus(T`ส่งออกรูป ${n} ใบแล้ว: ` + dest);
    return true;
  } catch (e) {
    log('error', 'gallery-export failed', e);
    setStatus(T`ส่งออกรูปล้มเหลว: ` + e.message);
    return false;
  } finally { clearBusy(); }
}

/** ขนาดภาพที่ส่งออก — ยาวด้านละไม่เกิน MAX (กันไฟล์ใหญ่เกินจำเป็น) */
const MAX_EDGE = 4000;

/**
 * ส่งออกกระดานอารมณ์เป็น .png ใบเดียว
 * วาดตามพิกัดจริงบนกระดาน (ไม่ขึ้นกับซูม/แพนที่ผู้ใช้ดูอยู่)
 */
export async function exportMoodBoard(root, albumId, board, { pad = 40, bg = '#1b1d21' } = {}) {
  const items = MB.boardOrder(board);
  if (!items.length) { setStatus(T`กระดานยังว่าง — ไม่มีอะไรให้ส่งออก`); return false; }
  const b = MB.boardBounds(items);
  const scale = Math.min(1, MAX_EDGE / Math.max(b.w + pad * 2, b.h + pad * 2));
  const W = Math.max(1, Math.round((b.w + pad * 2) * scale));
  const H = Math.max(1, Math.round((b.h + pad * 2) * scale));
  setBusy(T`กำลังวาดกระดานอารมณ์…`);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const rel = AC.albumRel(albumId);
    for (const it of items) {
      // ชิ้นที่เป็น path (มี '/') = รูปข้ามอัลบั้ม — ใช้ตามที่เก็บไว้เลย
      const p = String(it.file).includes('/') ? it.file : (rel ? rel + '/' + it.file : it.file);
      const abs = await kapi.join(root, AC.IMAGES_DIR, ...p.split('/'));
      const url = await kapi.toFileURL(abs);
      const img = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = url;
      });
      if (!img) continue;
      const x = (it.x - b.x + pad) * scale;
      const y = (it.y - b.y + pad) * scale;
      g.drawImage(img, x, y, it.w * scale, it.h * scale);
    }
    clearBusy();
    const base = safe(albumId === AC.ROOT_ALBUM ? 'moodboard' : AC.albumBaseName(albumId)) + '-moodboard.png';
    const dest = await kapi.saveAsDialog(base);
    if (!dest) return false;
    setBusy(T`กำลังเขียนไฟล์ภาพ…`);
    const dataUrl = canvas.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1] || '';
    const bin = atob(b64);
    const bytes = new Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await kapi.writeBytes(dest, bytes);
    setStatus(T`ส่งออกกระดานอารมณ์แล้ว (${W}×${H}): ` + dest);
    return true;
  } catch (e) {
    log('error', 'moodboard export failed', e);
    setStatus(T`ส่งออกกระดานล้มเหลว: ` + e.message);
    return false;
  } finally { clearBusy(); }
}
