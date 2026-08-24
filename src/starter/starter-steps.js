// starter-steps.js — ตัววาดของแต่ละขั้น + วิดเจ็ตที่ขั้นอื่นยืมไปใช้
//
// ตาราง `STEP_RENDERERS` คือที่เดียวที่ผูก "ไอดีขั้น" เข้ากับ "ตัววาด"
// เพิ่มขั้นใหม่ = เพิ่มแถวในทะเบียน (starter-steps-def.js) + เพิ่มตัววาดที่นี่ · จบ
//
// ขั้นตัวละครหนักกว่าเพื่อนมาก จึงแยกไปอยู่ starter-cast.js แล้วดึงมาต่อในตารางนี้
// ปุ่ม AI ทุกตัวต้องผ่าน `aiBtn`/`askAI` ของ starter-ai.js เท่านั้น (กดหยุดได้ + จด log)

import { el, log, setStatus } from '../core.js';
import { t, tf } from '../i18n.js';
import { TAG_GROUPS, W_FIELDS } from './starter-steps-def.js';
import { toggleTag, hasTag, normalizeTags } from './starter-model.js';
import {
  namePrompt, introPrompt, descPrompt, blurbPrompt, wFieldPrompt, SYS_WRITER,
} from './starter-prompt.js';
import { importImage, importFromGallery, imageUrl } from './starter-store.js';
import { renderCastStep } from './starter-cast.js';
import { aiBtn, askAI } from './starter-ai.js';
import { richEditor } from './starter-richtext.js';

export { aiBtn };                      // ขั้นอื่น/กล่องอื่นเคยดึงจากที่นี่ — คงทางเดิมไว้

// ═══════════════════ วิดเจ็ตที่ใช้ร่วมกัน ═══════════════════

/** แถวช่องกรอก — label ซ้าย ช่องขวา (เข้าชุดกับ .wiki-row ของโปรแกรม) */
export function field(labelText, value, onInput,
                      { multiline = false, placeholder = '', rows = 5 } = {}) {
  const row = el('div', 'st-field');
  row.append(el('label', null, labelText));
  const inp = multiline ? el('textarea', 'wiki-input st-ta') : el('input', 'wiki-input');
  if (multiline) inp.rows = rows;
  inp.value = value || '';
  inp.placeholder = placeholder;
  inp.oninput = () => onInput(inp.value);
  row.append(inp);
  row.__input = inp;                 // ปุ่ม AI ต้องเขียนค่ากลับเข้าช่องนี้ได้
  return row;
}

/** เลือกอันหนึ่งจากรายการที่ AI เสนอมา (คำตอบมาเป็นบรรทัด ๆ) */
export function pickLine(host, text, onPick) {
  const lines = String(text || '').split(/\r?\n/)
    .map((x) => x.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s*/, '').trim())
    .filter((x) => x && x.length < 120);
  if (!lines.length) return false;
  const box = el('div', 'st-suggest');
  box.append(el('div', 'st-suggest-head', t('ui.starter.pickOne')));
  for (const ln of lines.slice(0, 8)) {
    const b = el('button', 'st-suggest-item', ln);
    b.onclick = () => { onPick(ln); box.remove(); };
    box.append(b);
  }
  const close = el('button', 'st-suggest-close', t('ui.common.cancel'));
  close.onclick = () => box.remove();
  box.append(close);
  host.append(box);
  return true;
}

/**
 * ช่องเลือกรูปแบบมาตรฐาน — ใช้ทั้งปกและแบนเนอร์
 * **รูปไม่ถูกครอบตัด** (`object-fit: contain`) ตามที่ผู้ใช้ขอ — เห็นสัดส่วนจริงเสมอ
 * @param {object} opts  ratio = คลาสกรอบ ('st-img-cover' | 'st-img-banner')
 */
export async function imagePicker(ctx, key, { ratio = 'st-img-cover', label = '' } = {}) {
  const s = ctx.starter;
  const row = el('div', 'st-field');
  if (label) row.append(el('label', null, label));
  const box = el('div', 'st-img-box ' + ratio);
  const draw = async () => {
    box.innerHTML = '';
    const url = await imageUrl(s.slug, s[key]);
    if (url) { const im = el('img'); im.src = url; box.append(im); }
    else box.append(el('div', 'st-cover-empty', t('ui.starter.noImage')));
  };
  const btns = el('div', 'st-row-btns');
  const fromFile = el('button', null, t('ui.starter.imgFromFile'));
  fromFile.onclick = async () => {
    const p = await kapi.openImageDialog();
    if (!p) return;
    const f = await importImage(s.slug, p);
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    s[key] = f; await ctx.save({ now: true }); await draw();
  };
  const fromGal = el('button', null, t('ui.starter.imgFromGallery'));
  fromGal.onclick = async () => {
    const { pickImage } = await import('../gallery.js');
    const it = await pickImage(ctx.root);
    if (!it || !it.file) return;
    const f = await importFromGallery(s.slug, it.file);
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    s[key] = f; await ctx.save({ now: true }); await draw();
  };
  const clr = el('button', null, t('ui.starter.imgClear'));
  clr.onclick = async () => { s[key] = ''; await ctx.save({ now: true }); await draw(); };
  btns.append(fromFile, fromGal, clr);
  row.append(box, btns);
  await draw();
  return row;
}

// ═══════════════════ ขั้นที่ 1: แนวเรื่อง (แท็ก) ═══════════════════

function renderTags(host, ctx) {
  const s = ctx.starter;
  const picked = el('div', 'st-tag-picked');
  const redrawPicked = () => {
    picked.innerHTML = '';
    const rows = normalizeTags(s.tags);
    if (!rows.length) { picked.append(el('div', 'st-dim', t('ui.starter.noTagYet'))); return; }
    for (const tg of rows) {
      const c = el('span', 'st-tag on', tg);
      const x = el('span', 'st-tag-x', '×');
      x.onclick = () => { s.tags = toggleTag(s.tags, tg); ctx.save(); redrawAll(); };
      c.append(x);
      picked.append(c);
    }
  };

  const groups = el('div', 'st-tag-groups');
  const redrawGroups = () => {
    groups.innerHTML = '';
    for (const g of TAG_GROUPS) {
      const box = el('div', 'st-tag-group');
      box.append(el('div', 'st-tag-group-label', g.label));
      const list = el('div', 'st-tag-list');
      for (const tg of g.tags) {
        const b = el('button', 'st-tag' + (hasTag(s.tags, tg) ? ' on' : ''), tg);
        b.onclick = () => { s.tags = toggleTag(s.tags, tg); ctx.save(); redrawAll(); };
        list.append(b);
      }
      box.append(list);
      groups.append(box);
    }
  };
  const redrawAll = () => { redrawPicked(); redrawGroups(); };

  host.append(el('div', 'st-sub', t('ui.starter.tagPicked')));
  host.append(picked);

  // ผู้ใช้พิมพ์แท็กเองได้ไม่จำกัด (สเปกข้อ 4)
  const own = el('div', 'st-tag-own');
  const inp = el('input', 'wiki-input');
  inp.placeholder = t('ui.starter.tagOwnPlaceholder');
  const add = el('button', 'k-ok', t('ui.starter.tagAdd'));
  const doAdd = () => {
    const v = inp.value.trim();
    if (!v) return;
    s.tags = normalizeTags([...(s.tags || []), v]);
    inp.value = ''; ctx.save(); redrawAll();
  };
  add.onclick = doAdd;
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doAdd(); } };
  own.append(inp, add);
  host.append(own);

  host.append(groups);
  redrawAll();
}

// ═══════════════════ ขั้นที่ 2: ชื่อเรื่อง · ผู้แต่ง · คำโปรย · คำบรรยาย ═══════════════════

async function renderIntro(host, ctx) {
  const s = ctx.starter;

  // ── ชื่อเรื่อง ──
  const nameRow = field(t('ui.starter.fName'), s.name,
    (v) => { s.name = v; ctx.save(); },
    { placeholder: t('ui.starter.fNamePlaceholder') });
  const nameBtns = el('div', 'st-row-btns');
  nameBtns.append(aiBtn(t('ui.starter.aiSuggestName'), async (reqId) => {
    const out = await askAI('story-name', namePrompt(s), SYS_WRITER(), reqId);
    if (!out) return;
    if (!pickLine(nameBtns, out, (v) => {
      s.name = v; nameRow.__input.value = v; ctx.save();
    })) setStatus(t('ui.starter.aiNoResult'));
  }));
  nameRow.append(nameBtns);
  host.append(nameRow);

  // เปลี่ยนชื่อเรื่องแล้ว **ชื่อโฟลเดอร์ไม่ตาม** โดยตั้งใจ (ทำตาม renameSection)
  host.append(el('div', 'st-hint', tf('ui.starter.folderFixed', s.slug)));

  // ── ผู้แต่ง ──
  host.append(field(t('ui.starter.fAuthor'), s.author,
    (v) => { s.author = v; ctx.save(); },
    { placeholder: t('ui.starter.fAuthorPlaceholder') }));

  // ── คำโปรยหนึ่งบรรทัด (โผล่บนการ์ดข้างปก) ──
  const blurbRow = field(t('ui.starter.fStoryBlurb'), s.blurb,
    (v) => { s.blurb = v; ctx.save(); },
    { placeholder: t('ui.starter.fStoryBlurbPlaceholder') });
  const blurbBtns = el('div', 'st-row-btns');
  blurbBtns.append(aiBtn(t('ui.starter.aiWriteBlurb'), async (reqId) => {
    const out = await askAI('blurb', blurbPrompt(s), SYS_WRITER(), reqId);
    if (!out) { setStatus(t('ui.starter.aiNoResult')); return; }
    const one = out.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)[0] || out;
    s.blurb = one; blurbRow.__input.value = one; ctx.save();
  }));
  blurbRow.append(blurbBtns);
  host.append(blurbRow);

  // ── Story Description (ตัวแก้ไขแบบเห็นผลจริง) ──
  const descRow = el('div', 'st-field');
  descRow.append(el('label', null, t('ui.starter.fDescription')));
  const rt = await richEditor({
    slug: s.slug,
    value: s.intro,
    onChange: (html) => { s.intro = html; ctx.save(); },
  });
  descRow.append(rt);
  const descBtns = el('div', 'st-row-btns');
  descBtns.append(aiBtn(t('ui.starter.aiWriteIntro'), async (reqId) => {
    const out = await askAI('description', descPrompt(s), SYS_WRITER(), reqId);
    if (!out) { setStatus(t('ui.starter.aiNoResult')); return; }
    s.intro = out; rt.__setHtml(out); ctx.save();
  }));
  descBtns.append(aiBtn(t('ui.starter.aiWriteIntroShort'), async (reqId) => {
    const out = await askAI('intro-short', introPrompt(s), SYS_WRITER(), reqId);
    if (!out) { setStatus(t('ui.starter.aiNoResult')); return; }
    s.intro = out; rt.__setHtml(out); ctx.save();
  }));
  if (!((s.tags || []).length)) descBtns.append(el('span', 'st-dim', t('ui.starter.aiBetterWithTags')));
  descRow.append(descBtns);
  host.append(descRow);
}

// ═══════════════════ ขั้นที่ 4: 4W ═══════════════════

function renderW(host, ctx) {
  const s = ctx.starter;
  s.w = s.w || {};
  host.append(el('div', 'st-hint', t('ui.starter.wAllOptional')));
  for (const f of W_FIELDS) {
    const row = field(f.icon + ' ' + f.label, s.w[f.key] || '',
      (v) => { s.w[f.key] = v; ctx.save(); },
      { multiline: true, rows: 3, placeholder: f.hint });
    // [alpha.96] ผู้ใช้ขอปุ่ม AI ในขั้นนี้ด้วย — ช่วยทีละช่อง โดยเห็นช่องอื่นเป็นบริบท
    const btns = el('div', 'st-row-btns');
    btns.append(aiBtn(t('ui.starter.aiHelp'), async (reqId) => {
      const out = await askAI('4w:' + f.key, wFieldPrompt(s, f), SYS_WRITER(), reqId);
      if (!out) { setStatus(t('ui.starter.aiNoResult')); return; }
      s.w[f.key] = out; row.__input.value = out; ctx.save();
    }));
    row.append(btns);
    host.append(row);
  }
}

// ═══════════════════ ขั้นที่ 5: ปก + แบนเนอร์ ═══════════════════

async function renderCover(host, ctx) {
  // ปก = แนวตั้ง 3:4 กว้าง 375 (ขนาดการ์ดนิยายจริง) · แบนเนอร์ = กว้างเต็มหน้า
  host.append(await imagePicker(ctx, 'cover',
    { ratio: 'st-img-cover', label: t('ui.starter.fCover') }));
  host.append(el('div', 'st-hint', t('ui.starter.coverSizeHint')));
  host.append(await imagePicker(ctx, 'banner',
    { ratio: 'st-img-banner', label: t('ui.starter.fBanner') }));
  host.append(el('div', 'st-hint', t('ui.starter.bannerSizeHint')));
  host.append(el('div', 'st-hint', t('ui.starter.coverPortable')));
}

// ═══════════════════ ตารางตัววาด ═══════════════════

export const STEP_RENDERERS = {
  tags: renderTags,
  intro: renderIntro,
  cast: renderCastStep,
  w: renderW,
  cover: renderCover,
};
