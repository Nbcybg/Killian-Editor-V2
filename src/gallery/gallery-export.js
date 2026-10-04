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
export async function exportMoodBoard(root, albumId, board, { pad = 40, bg = '#1b1d21', outPath = null, bgCfg = null, portraits = null } = {}) {
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
    // [alpha.168] ฉากหลังของกระดาน (สี · รูปเบลอ · หรี่) — ไฟล์ออกมาหน้าตาเดียวกับบนจอ
    const bgN = MB.normalizeBoardBg(bgCfg);
    g.fillStyle = bgN.color || bg;
    g.fillRect(0, 0, W, H);
    if (bgN.image) {
      const im = await loadImage(await kapi.toFileURL(await kapi.join(root, AC.IMAGES_DIR, ...bgN.image.split('/'))));
      if (im) {
        const k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        g.save(); if (bgN.blur) g.filter = `blur(${bgN.blur}px)`;
        g.drawImage(im, (W - im.naturalWidth * k) / 2, (H - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
        g.restore();
        g.fillStyle = `rgba(0,0,0,${bgN.dim})`; g.fillRect(0, 0, W, H);
      }
    }
    const rel = AC.albumRel(albumId);
    for (const it of items) {
      // [alpha.167] การ์ด (ตัวละคร/ฉาก/อ้างอิง) วาดเป็นกล่องแถบสี + ชื่อ + บรรทัดรอง — หน้าตาเดียวกับบนจอ
      const ox = (it.x - b.x + pad) * scale, oy = (it.y - b.y + pad) * scale;
      if (it.kind === 'group') { drawGroup(g, it, ox, oy, scale); continue; }
      if (it.kind === 'note') { drawNote(g, it, ox, oy, scale); continue; }
      if (it.kind === 'palette') { drawPalette(g, it, ox, oy, scale); continue; }
      if (it.kind === 'entity') { await drawEntity(g, it, ox, oy, scale, root, portraits); continue; }
      if (MB.isCard(it)) { drawCard(g, it, ox, oy, scale); continue; }
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
      // รูปไม่ครอบตัด (contain) เหมือนบนจอ
      const k = Math.min((it.w * scale) / img.naturalWidth, (it.h * scale) / img.naturalHeight);
      const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      g.drawImage(img, ox + (it.w * scale - dw) / 2, oy + (it.h * scale - dh) / 2, dw, dh);
      if (it.caption) {
        g.save(); g.font = `600 ${Math.round(12 * scale)}px "Sarabun", sans-serif`;
        const tw = g.measureText(it.caption).width;
        rrect(g, ox + 8 * scale, oy + it.h * scale - 30 * scale, tw + 16 * scale, 22 * scale, 6 * scale);
        g.fillStyle = 'rgba(0,0,0,.72)'; g.fill();
        g.fillStyle = CARD_INK; g.textBaseline = 'middle'; g.fillText(it.caption, ox + 16 * scale, oy + it.h * scale - 19 * scale);
        g.restore();
      }
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


// ═══════════ [alpha.168] ชิ้นชนิดใหม่ของกระดาน (กลุ่ม · โน้ต · แถบสี · การ์ดรูปตัวละคร) ═══════════
function loadImage(src) {
  return new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im.naturalWidth ? im : null); im.onerror = () => res(null); im.src = src; });
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function drawGroup(g, it, x, y, s) {
  g.save();
  rrect(g, x, y, it.w * s, it.h * s, 14 * s);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
  g.lineWidth = Math.max(1, s); g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();
  const title = it.title || '';
  if (title) {
    g.font = `700 ${Math.round(12.5 * s)}px "Sarabun", sans-serif`;
    const tw = g.measureText(title).width;
    rrect(g, x + 10 * s, y - 11 * s, tw + 18 * s, 22 * s, 6 * s);
    g.fillStyle = 'rgba(12,12,16,.88)'; g.fill();
    g.fillStyle = CARD_INK; g.textBaseline = 'middle'; g.fillText(title, x + 19 * s, y);
  }
  g.restore();
}
function drawNote(g, it, x, y, s) {
  g.save();
  rrect(g, x, y, it.w * s, it.h * s, 8 * s);
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8 * s; g.shadowOffsetY = 3 * s;
  g.fillStyle = it.color || NOTE_BG; g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = NOTE_INK; g.textBaseline = 'top';
  g.font = `${Math.round(13 * s)}px "Sarabun", sans-serif`;
  let ly = y + 12 * s;
  if (it.title) { g.font = `700 ${Math.round(13.5 * s)}px "Sarabun", sans-serif`; g.fillText(it.title, x + 12 * s, ly); ly += 20 * s; g.font = `${Math.round(13 * s)}px "Sarabun", sans-serif`; }
  for (const para of String(it.text || '').split('\n')) {
    let line = '';
    for (const wd of para.split(/(\s+)/)) {
      const test = line + wd;
      if (g.measureText(test).width > it.w * s - 24 * s && line) { g.fillText(line, x + 12 * s, ly); ly += 18 * s; line = wd.trimStart(); }
      else line = test;
      if (ly > y + it.h * s - 18 * s) break;
    }
    if (line && ly <= y + it.h * s - 18 * s) { g.fillText(line, x + 12 * s, ly); ly += 18 * s; }
  }
  g.restore();
}
function drawPalette(g, it, x, y, s) {
  const cs = it.colors || [];
  if (!cs.length) return;
  g.save();
  rrect(g, x, y, it.w * s, it.h * s, 8 * s); g.clip();
  const w = (it.w * s) / cs.length;
  cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * w, y, w + 1, it.h * s); });
  g.restore();
}
async function drawEntity(g, it, x, y, s, root, portraits) {
  const w = it.w * s, h = it.h * s, capH = Math.min(h * 0.3, 46 * s);
  const info = portraits && portraits.get ? portraits.get(it.path) : null;
  g.save();
  rrect(g, x, y, w, h, 10 * s); g.fillStyle = CARD_BG; g.fill();
  g.save(); rrect(g, x, y, w, h, 10 * s); g.clip();
  const im = info && info.image ? await loadImage(await kapi.toFileURL(await kapi.join(root, AC.IMAGES_DIR, ...String(info.image).split('/')))) : null;
  if (im) {
    const k = Math.max(w / im.naturalWidth, (h - capH) / im.naturalHeight);
    g.drawImage(im, x + (w - im.naturalWidth * k) / 2, y + (h - capH - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
  }
  g.fillStyle = 'rgba(10,10,14,.92)'; g.fillRect(x, y + h - capH, w, capH);
  g.restore();
  g.lineWidth = Math.max(1, s); g.strokeStyle = CARD_EDGE; rrect(g, x, y, w, h, 10 * s); g.stroke();
  g.fillStyle = CARD_INK; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(12.5 * s)}px "Sarabun", sans-serif`;
  g.fillText((info && info.name) || it.title || '', x + 10 * s, y + h - capH / 2);
  g.restore();
}

// ═══════════ [alpha.167] การ์ดบนกระดาน + ส่งออก HTML ═══════════
const CARD_BG = '#262a31', CARD_EDGE = '#3a404a', CARD_INK = '#f1f1f1', CARD_DIM = '#a4a9b3', CARD_STRIPE = '#ffc55c';
const NOTE_BG = '#f2c14e', NOTE_INK = '#1d1b16';
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
export async function exportMoodBoardHtml(root, albumId, board, { pad = 40, outPath = null, bg = null, portraits = null } = {}) {
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
      if (it.kind === 'group') { parts.push(`<div class="grp" style="${pos}"><span>${escH(it.title || '')}</span></div>`); continue; }
      if (it.kind === 'note') { parts.push(`<div class="note" style="${pos};background:${safeCssColor(it.color || NOTE_BG)}">${it.title ? `<b>${escH(it.title)}</b>` : ''}${escH(it.text || '')}</div>`); continue; }
      if (it.kind === 'palette') { parts.push(`<div class="pal" style="${pos}">${(it.colors || []).map((c) => `<i style="background:${safeCssColor(c)}" title="${escH(c)}"></i>`).join('')}</div>`); continue; }
      if (MB.isCard(it)) {
        const info = it.kind === 'entity' && portraits && portraits.get ? portraits.get(it.path) : null;
        const name = (info && info.name) || it.title || it.url || '';
        const inner = `<b>${escH(name)}</b><small>${escH(cardSub(it))}</small>${it.text ? `<p>${escH(it.text)}</p>` : ''}`;
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
body{margin:0;background:${safeCssColor(MB.normalizeBoardBg(bg).color || '#1b1d21')};font-family:"Sarabun","Noto Sans Thai",sans-serif}
.grp{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);border-radius:14px}
.grp span{position:absolute;left:10px;top:-11px;background:rgba(12,12,16,.88);color:${CARD_INK};font-size:12.5px;font-weight:700;padding:2px 9px;border-radius:6px}
.note{padding:12px;border-radius:8px;color:${NOTE_INK};font-size:13px;white-space:pre-wrap;overflow:hidden;box-shadow:0 3px 8px rgba(0,0,0,.35)}
.note b{display:block;margin-bottom:4px}
.pal{display:flex;border-radius:8px;overflow:hidden}.pal i{flex:1}
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
