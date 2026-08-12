// gallery-ai.js — AI ช่วยงานคลังรูป (alpha.63 · Phase 9)
//   · ตั้งคำบรรยายให้รูป   (aiCaptionImages)
//   · แนะนำแท็กให้รูป      (aiTagImages)
//
// **สองทาง แล้วเลือกอัตโนมัติ**
//   1. โมเดลที่ดูรูปได้ (vision) — ส่งภาพย่อเป็น data URL ไปพร้อมคำสั่ง (สำนวน OpenAI)
//   2. โมเดลข้อความล้วน — ตกไปใช้ "บริบทที่เรารู้จริง" แทน: ชื่อไฟล์ · อัลบั้ม · ฉากที่รูปนี้ถูกใช้
//      (ไม่แต่งเรื่องจากภาพที่โมเดลไม่ได้เห็น)
//
// ทุกคำขอไปทาง `sendRequest()` ของ ai-provider-ui เสมอ = ผ่านการตรวจ Allowed Domains จุดเดียว
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { setStatus, setBusy, clearBusy, log } from '../core.js';
import { aiConfigured, callAI } from '../ai-settings.js';
import * as AC from './album-core.js';
import * as TG from './album-tags.js';
import { usageOf } from './usage-index.js';

/** ขนาดด้านยาวสุดของภาพที่ส่งให้ AI — ใหญ่กว่านี้เปลือง token โดยไม่ได้อะไรเพิ่ม */
const VISION_EDGE = 768;

/** ย่อรูปเป็น data URL (jpeg) เพื่อส่งให้โมเดลที่ดูภาพได้ */
async function thumbDataUrl(root, relPath) {
  const abs = await kapi.join(root, AC.IMAGES_DIR, ...relPath.split('/'));
  const url = await kapi.toFileURL(abs);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const s = Math.min(1, VISION_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * s));
        c.height = Math.max(1, Math.round(im.naturalHeight * s));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      } catch { resolve(''); }
    };
    im.onerror = () => resolve('');
    im.src = url;
  });
}

/** บริบทที่เรารู้จริงเกี่ยวกับรูปใบนี้ (ใช้ทั้งสองทาง) */
function contextOf(it, usage) {
  const lines = [ttf('ui.galleryAi.nameFile', it.file)];
  if (it.album && it.album !== AC.ROOT_ALBUM) lines.push(ttf('ui.galleryAi.album', it.album));
  if (it.caption) lines.push(ttf('ui.galleryAi.captionCurrent', it.caption));
  if (it.tags && it.tags.length) lines.push(ttf('ui.galleryAi.tagCurrent', it.tags.join(' ')));
  const uses = usage ? usageOf(usage, it.file) : [];
  if (uses.length) lines.push(tt('ui.galleryAi.useScene') + [...new Set(uses.map((u) => u.title))].slice(0, 8).join(', '));
  return lines.join('\n');
}

/** ส่งคำขอที่มีภาพแนบ — คืน '' เมื่อผู้ให้บริการทำไม่ได้ (ผู้เรียกตกไปทางข้อความ) */
async function visionAsk(prompt, system, dataUrl) {
  if (!dataUrl) return '';
  try {
    const { currentProvider, complete } = await import('../ai/ai-provider-ui.js');
    const p = await currentProvider();
    if (!p) return '';
    const r = await complete(p, {
      system,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ] }],
    });
    if (!r.ok) { log('warn', tt('ui.galleryAi.galleryAiVisionUse'), r.error); return ''; }
    return (r.text || '').trim();
  } catch (e) {
    log('warn', tt('ui.galleryAi.galleryAiVisionFail'), e);
    return '';
  }
}

/** เก็บกวาดคำตอบ: ตัดเครื่องหมายคำพูด/บุลเล็ต/คำนำ */
export function cleanLine(s) {
  return String(s || '')
    .split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
}

export function cleanCaption(s) {
  let t = cleanLine(s).replace(/^[-*•\d.)\s]+/, '').replace(/^["'“”„]|["'“”„]$/g, '').trim();
  t = t.replace(/^(คำบรรยาย|caption)\s*[:：]\s*/i, '');
  return t.slice(0, 120);
}

const SYS_CAP = tt('ui.galleryAi.youHelpSetCaption') +
  tt('ui.galleryAi.replyThaiShortNot');

const SYS_TAG = tt('ui.galleryAi.youHelpSetTag') +
  tt('ui.galleryAi.notTagUsePage') +
  tt('ui.galleryAi.forbidExplainAddReply');

/**
 * ตั้งคำบรรยายให้รูปที่เลือก → จำนวนใบที่เขียนจริง
 * ไม่เขียนทับใบที่ผู้ใช้ตั้งคำบรรยายเองแล้ว เว้นแต่ `overwrite: true`
 */
export async function aiCaptionImages(root, items, { usage = null, overwrite = false } = {}) {
  const cfg = await aiConfigured();
  if (!cfg.ok) { setStatus('❌ AI: ' + cfg.why); return 0; }
  const list = (items || []).filter((i) => overwrite || !i.caption ||
    i.caption === i.file.replace(/\.[^.]+$/, ''));
  if (!list.length) { setStatus(tt('ui.galleryAi.imagePickHasCaption')); return 0; }
  let n = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      setBusy(ttf('ui.galleryAi.aIBusySetCaption', i + 1, list.length, it.file));
      const ctx = contextOf(it, usage);
      const prompt = ttf('ui.galleryAi.setCaptionShortImage', ctx);
      let text = await visionAsk(prompt, SYS_CAP, await thumbDataUrl(root, it.path));
      if (!text) {
        text = await callAI(
          ttf('ui.galleryAi.setCaptionShortImage2', ctx),
          SYS_CAP) || '';
      }
      const cap = cleanCaption(text);
      if (!cap) continue;
      await AC.updateImage(kapi, root, it.album, it.file, { caption: cap });
      n++;
    }
    await AC.syncFlatIndex(kapi, root);
    setStatus(n ? ttf('ui.galleryAi.aISetCaptionImage', n) : tt('ui.galleryAi.aICantSendCaption'));
  } catch (e) {
    log('error', 'aiCaptionImages failed', e);
    setStatus(tt('ui.galleryAi.aISetCaptionFail') + e.message);
  } finally { clearBusy(); }
  return n;
}

/** แปลงคำตอบเป็นรายการแท็กมาตรฐาน */
export function parseTagAnswer(text, { entities = [] } = {}) {
  const line = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean).join(' ');
  const tags = TG.parseTags(line).slice(0, 6);
  // ชื่อที่ตรงกับเอนทิตี้ใน Wiki จริง ๆ → ยกระดับเป็นแท็ก @ ให้เอง
  const names = new Set((entities || []).map((s) => String(s)));
  return tags.map((t) => (TG.tagKind(t) === 'plain' && names.has(TG.tagName(t))
    ? TG.normalizeTag(TG.tagName(t), '@') : t));
}

/** แนะนำแท็กให้รูปที่เลือก (เพิ่มทับของเดิม ไม่ลบแท็กที่ผู้ใช้ตั้งเอง) → จำนวนใบที่เปลี่ยน */
export async function aiTagImages(root, items, { usage = null, entities = [] } = {}) {
  const cfg = await aiConfigured();
  if (!cfg.ok) { setStatus('❌ AI: ' + cfg.why); return 0; }
  const list = items || [];
  if (!list.length) return 0;
  let n = 0;
  try {
    const hint = entities.length ? ttf('ui.galleryAi.nameHasCodexStory', entities.slice(0, 60).join(', ')) : '';
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      setBusy(ttf('ui.galleryAi.aIBusySuggestTag', i + 1, list.length, it.file));
      const ctx = contextOf(it, usage);
      const prompt = ttf('ui.galleryAi.setTagImage', ctx, hint);
      let text = await visionAsk(prompt, SYS_TAG, await thumbDataUrl(root, it.path));
      if (!text) text = await callAI(prompt, SYS_TAG) || '';
      const tags = parseTagAnswer(text, { entities });
      if (!tags.length) continue;
      let doc = await AC.readAlbumDoc(kapi, root, it.album);
      for (const t of tags) doc = TG.addTag(doc, it.file, t);
      await AC.writeAlbumDoc(kapi, root, it.album, doc);
      n++;
    }
    await AC.syncFlatIndex(kapi, root);
    setStatus(n ? ttf('ui.galleryAi.aISuggestTagImage', n) : tt('ui.galleryAi.aICantSendTag'));
  } catch (e) {
    log('error', 'aiTagImages failed', e);
    setStatus(tt('ui.galleryAi.aISuggestTagFail') + e.message);
  } finally { clearBusy(); }
  return n;
}
