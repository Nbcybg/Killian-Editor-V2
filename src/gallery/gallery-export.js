// gallery-export.js — ส่งออกจากคลังรูป (alpha.63 · Phase 8)
//   · ส่งออกอัลบั้ม / รูปที่เลือก / เฉพาะรูปที่ถูกใช้จริง → .zip (ไบต์ดิบ ไม่ผ่าน utf-8)
//   · ส่งออกกระดานอารมณ์เป็นภาพรวมใบเดียว → .png (วาดบน canvas ตามพิกัดบนกระดาน)
import { t, tf } from '../i18n.js';
import { failText } from '../err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import JSZip from 'jszip';
import { setStatus, setStatusError, log, setBusy, clearBusy } from '../core.js';
import * as AC from './album-core.js';
import * as MB from './moodboard.js';
import { usageOf } from './usage-index.js';
import { safeCssColor } from '../palette.js';   // [alpha.167 · รอบต่อ] สีจากไฟล์ผู้ใช้ก่อนลง style

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_');

/** สรุปเป็นไฟล์ .md แนบไปในซิป — ผู้รับรู้ว่าแต่ละรูปคืออะไร ใช้ที่ไหน */
function manifest(items, usage, title) {
  const lines = [`# ${title}`, '', tf('ui.galleryExport.imageAllItem', items.length), ''];
  for (const it of items) {
    lines.push(`## ${it.file}`);
    if (it.caption) lines.push(tf('ui.galleryExport.caption', it.caption));
    lines.push(tf('ui.galleryExport.album', it.album === AC.ROOT_ALBUM ? AC.ROOT_ALBUM_NAME : it.album));
    if (it.tags && it.tags.length) lines.push(tf('ui.galleryExport.tag', it.tags.join(' ')));
    const uses = usage ? usageOf(usage, it.file) : [];
    if (uses.length) lines.push(t('ui.common.use') + [...new Set(uses.map((u) => u.title))].join(', '));
    lines.push('', `![${it.caption || ''}](${it.path})`, '');
  }
  return lines.join('\n');
}

/**
 * ส่งออกรูปเป็น .zip — คงโครงอัลบั้มไว้ (`ตัวละคร/ref.png`) + `รายการรูป.md`
 * @returns {Promise<boolean>}
 */
export async function exportImages(root, items, { name = t('ui.galleryExport.libraryImage'), usage = null } = {}) {
  const list = (items || []).filter((i) => i && i.path);
  if (!list.length) { setStatus(t('ui.galleryExport.notHasImageExport')); return false; }
  setBusy(tf('ui.galleryExport.busyCollectImageItem', list.length));
  try {
    const zip = new JSZip();
    let n = 0;
    for (const it of list) {
      const abs = await kapi.join(root, AC.IMAGES_DIR, ...it.path.split('/'));
      try {
        const bytes = await kapi.readBytes(abs);            // ไบนารีต้องผ่าน readBytes (บทเรียน 14d)
        zip.file(it.path, new Uint8Array(bytes));
        n++;
        if (n % 10 === 0) setBusy(tf('ui.galleryExport.busyCollectImage', n, list.length));
      } catch (e) { log('warn', t('ui.galleryExport.galleryExportSkipFile') + abs, e); }
    }
    zip.file(t('ui.galleryExport.listImageMd'), manifest(list, usage, name));
    clearBusy();                                            // อย่าให้สปินเนอร์ค้างตอนรอผู้ใช้ตอบ (บทเรียน 85)
    const dest = await kapi.saveAsDialog(safe(name) + '.zip');
    if (!dest) return false;
    setBusy(t('ui.galleryExport.busyWriteFile'));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await kapi.writeBytes(dest, bytes);
    setStatus(tf('ui.galleryExport.exportImageItemDone', n) + dest);
    return true;
  } catch (e) {
    log('error', 'gallery-export failed', e);
    setStatusError(failText(t('ui.galleryExport.exportImageFail'), e));
    return false;
  } finally { clearBusy(); }
}

/** ขนาดภาพที่ส่งออก — ยาวด้านละไม่เกิน MAX (กันไฟล์ใหญ่เกินจำเป็น) */
const MAX_EDGE = 4000;

/**
 * ส่งออกกระดานอารมณ์เป็น .png ใบเดียว
 * วาดตามพิกัดจริงบนกระดาน (ไม่ขึ้นกับซูม/แพนที่ผู้ใช้ดูอยู่)
 */
export async function exportMoodBoard(root, albumId, board, { pad = 40, bg = '#1b1d21', outPath = null } = {}) {
  const items = MB.boardOrder(board);
  if (!items.length) { setStatus(t('ui.galleryExport.boardEmptyNotHas')); return false; }
  const b = MB.boardBounds(items);
  const scale = Math.min(1, MAX_EDGE / Math.max(b.w + pad * 2, b.h + pad * 2));
  const W = Math.max(1, Math.round((b.w + pad * 2) * scale));
  const H = Math.max(1, Math.round((b.h + pad * 2) * scale));
  setBusy(t('ui.galleryExport.busyDrawBoardMood'));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const rel = AC.albumRel(albumId);
    for (const it of items) {
      // [alpha.167] การ์ด (ตัวละคร/ฉาก/อ้างอิง) วาดเป็นกล่องแถบสี + ชื่อ + บรรทัดรอง — หน้าตาเดียวกับบนจอ
      if (MB.isCard(it)) { drawCard(g, it, (it.x - b.x + pad) * scale, (it.y - b.y + pad) * scale, scale); continue; }
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
    const dest = outPath || await kapi.saveAsDialog(base);
    if (!dest) return false;
    setBusy(t('ui.galleryExport.busyWriteFileImage'));
    const dataUrl = canvas.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1] || '';
    const bin = atob(b64);
    const bytes = new Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await kapi.writeBytes(dest, bytes);
    setStatus(tf('ui.galleryExport.exportBoardMoodDone', W, H) + dest);
    return true;
  } catch (e) {
    log('error', 'moodboard export failed', e);
    setStatusError(failText(t('ui.galleryExport.exportBoardFail'), e));
    return false;
  } finally { clearBusy(); }
}


// ═══════════ [alpha.167] การ์ดบนกระดาน + ส่งออก HTML ═══════════
const CARD_BG = '#262a31', CARD_EDGE = '#3a404a', CARD_INK = '#f1f1f1', CARD_DIM = '#a4a9b3', CARD_STRIPE = '#ffc55c';
const CARD_SUB = { entity: 'ui.galleryMoodboard.cardEntity', scene: 'ui.galleryMoodboard.cardScene', memo: 'ui.galleryMoodboard.cardMemo',
                   chapter: 'ui.galleryMoodboard.cardChapter', ref: 'ui.galleryMoodboard.cardRef' };
function cardSub(it) { return it.kind === 'ref' && it.url ? MB.urlHost(it.url) : t(CARD_SUB[it.kind] || CARD_SUB.ref); }
function drawCard(g, it, x, y, s) {
  const w = it.w * s, h = it.h * s, r = 10 * s;
  g.save();
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  g.fillStyle = CARD_BG; g.fill(); g.lineWidth = Math.max(1, s); g.strokeStyle = CARD_EDGE; g.stroke();
  g.fillStyle = it.color || CARD_STRIPE; g.fillRect(x + 10 * s, y + 10 * s, 4 * s, h - 20 * s);
  g.beginPath(); g.rect(x + 22 * s, y, w - 30 * s, h); g.clip();
  g.textBaseline = 'top';
  g.fillStyle = CARD_INK; g.font = `bold ${Math.round(14 * s)}px "Sarabun", sans-serif`;
  g.fillText(it.title || it.url || '', x + 24 * s, y + 14 * s);
  g.fillStyle = CARD_DIM; g.font = `${Math.round(12 * s)}px "Sarabun", sans-serif`;
  g.fillText(cardSub(it), x + 24 * s, y + 36 * s);
  if (it.text) {
    const words = String(it.text).split(/\s+/);
    let line = '', ly = y + 58 * s;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (g.measureText(test).width > w - 40 * s && line) { g.fillText(line, x + 24 * s, ly); line = wd; ly += 16 * s; if (ly > y + h - 14 * s) break; }
      else line = test;
    }
    if (line && ly <= y + h - 14 * s) g.fillText(line, x + 24 * s, ly);
  }
  g.restore();
}

const escH = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
/**
 * ส่งออกกระดานเป็นหน้า HTML ไฟล์เดียว — รูปฝังเป็น data URL (ส่งต่อได้โดยไม่ต้องแนบโฟลเดอร์รูป)
 * การ์ดลิงก์เป็น <a> กดได้จริง · ข้อความผู้ใช้ผ่าน escape ทุกตัว
 */
export async function exportMoodBoardHtml(root, albumId, board, { pad = 40, outPath = null } = {}) {
  const items = MB.boardOrder(board);
  if (!items.length) { setStatus(t('ui.galleryExport.boardEmptyNotHas')); return false; }
  const b = MB.boardBounds(items);
  const W = Math.round(b.w + pad * 2), H = Math.round(b.h + pad * 2);
  setBusy(t('ui.galleryExport.busyDrawBoardMood'));
  try {
    const rel = AC.albumRel(albumId);
    const parts = [];
    for (const it of items) {
      const pos = `left:${Math.round(it.x - b.x + pad)}px;top:${Math.round(it.y - b.y + pad)}px;width:${Math.round(it.w)}px;height:${Math.round(it.h)}px;z-index:${100 + (it.z | 0)}`;
      if (MB.isCard(it)) {
        const inner = `<b>${escH(it.title || it.url || '')}</b><small>${escH(cardSub(it))}</small>${it.text ? `<p>${escH(it.text)}</p>` : ''}`;
        const style = pos + (it.color ? `;--c:${safeCssColor(it.color)}` : '');
        parts.push(it.url && /^https?:\/\//i.test(it.url)
          ? `<a class="card" href="${escH(it.url)}" style="${style}">${inner}</a>`
          : `<div class="card" style="${style}">${inner}</div>`);
        continue;
      }
      const p = String(it.file).includes('/') ? it.file : (rel ? rel + '/' + it.file : it.file);
      const abs = await kapi.join(root, AC.IMAGES_DIR, ...p.split('/'));
      let src = '';
      try {
        const bytes = await kapi.readBytes(abs);
        let bin = '';
        const u8 = new Uint8Array(bytes);
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        src = `data:${MIME[p.split('.').pop().toLowerCase()] || 'image/png'};base64,${btoa(bin)}`;
      } catch (e) { log('warn', 'moodboard html: skip image ' + p, e); continue; }
      parts.push(`<img alt="${escH(it.file)}" src="${src}" style="${pos}">`);
    }
    const title = AC.albumBaseName(albumId) || 'moodboard';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title><style>
body{margin:0;background:#1b1d21;font-family:"Sarabun","Noto Sans Thai",sans-serif}
.board{position:relative;width:${W}px;height:${H}px;margin:24px auto}
.board>*{position:absolute;box-sizing:border-box}
img{object-fit:contain}
.card{display:block;background:${CARD_BG};border:1px solid ${CARD_EDGE};border-radius:10px;padding:12px 12px 12px 26px;color:${CARD_INK};text-decoration:none;overflow:hidden}
.card::before{content:'';position:absolute;left:10px;top:10px;bottom:10px;width:4px;border-radius:3px;background:var(--c,${CARD_STRIPE})}
.card b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card small{display:block;color:${CARD_DIM};font-size:12px;margin-top:4px}
.card p{margin:8px 0 0;font-size:12px;color:${CARD_INK};line-height:1.4}
a.card:hover{border-color:${CARD_STRIPE}}
</style></head><body><div class="board">${parts.join('')}</div></body></html>`;
    clearBusy();
    const dest = outPath || await kapi.saveAsDialog(safe(albumId === AC.ROOT_ALBUM ? 'moodboard' : AC.albumBaseName(albumId)) + '-moodboard.html', 'html');
    if (!dest) return false;
    await kapi.writeFile(dest, html);
    setStatus(tf('ui.galleryExport.exportBoardHtmlDone', String(dest).split(/[\\/]/).pop()));
    return true;
  } catch (e) {
    log('error', 'moodboard html export failed', e);
    setStatusError(failText(t('ui.galleryExport.exportBoardFail'), e));
    return false;
  } finally { clearBusy(); }
}
