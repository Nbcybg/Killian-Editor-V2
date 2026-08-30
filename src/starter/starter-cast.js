// starter-cast.js — ขั้นตัวละคร (สเปกข้อ 6)
//
// ขั้นนี้หนักกว่าเพื่อนเพราะทำ 4 อย่างในที่เดียว:
//   1. สร้างตัวละครเอง (เพศ · ชื่อ · รูป · คำบรรยายละเอียด — ช่องเดียวตามสเปก)
//   2. ให้ AI เขียนคำบรรยายให้ โดยดึงบริบทจากเรื่องย่อ + แท็ก + เพื่อนร่วมเรื่อง
//   3. ดึงตัวละครที่มีอยู่แล้วจาก Wiki เข้ามา
//   4. เขียนกลับลง Wiki ทันทีที่บันทึก
//
// เพิ่มได้ไม่จำกัดตามสเปก · รูปถูกก๊อปเข้าโฟลเดอร์ starter เสมอ (พกพาข้ามโปรเจกต์)

import { el, setStatus } from '../core.js';
import { t, tf } from '../i18n.js';
import { confirmBox } from '../ui.js';
import { aiBtn, askAI } from './starter-ai.js';
import { GENDERS, newChar, upsertChar, removeChar, charReady } from './starter-model.js';
import { charDescPrompt, SYS_WRITER } from './starter-prompt.js';
import { importImage, importFromGallery, imageUrl } from './starter-store.js';
import { pickWikiChar, charFromWiki, syncCastToWiki, pushCharToWiki } from './starter-wiki.js';
// [alpha.116 ข้อ 10] ชื่อที่โผล่ในเรื่องย่อ = ผู้ต้องสงสัยว่าเป็นตัวละคร (บริสุทธิ์ · เทสแยก)
import { suggestNames, starterText, sourceLabel } from './starter-names.js';

// ES module: ตัวแปรที่ reassign ข้ามไฟล์ไม่ได้ → เก็บใน object (กฎเหล็กข้อ 2 ใน AGENTS.md)
const CAST_C = { editing: '' };

export async function renderCastStep(host, ctx) {
  const s = ctx.starter;
  s.cast = s.cast || [];
  host.innerHTML = '';

  if (CAST_C.editing) {
    const ch = (s.cast || []).find((c) => c.id === CAST_C.editing);
    if (ch) return renderEditor(host, ctx, ch);
    CAST_C.editing = '';
  }

  // ── แถบเครื่องมือ ────────────────────────────────────────
  const bar = el('div', 'st-row-btns');
  const add = el('button', 'k-ok', '+ ' + t('ui.starter.castAdd'));
  add.onclick = async () => {
    const ch = newChar({});
    s.cast = upsertChar(s.cast, ch);
    CAST_C.editing = ch.id;
    await ctx.save({ now: true });
    renderCastStep(host, ctx);
  };
  const fromWiki = el('button', null, t('ui.starter.castFromWiki'));
  fromWiki.onclick = async () => {
    const file = await pickWikiChar();
    if (!file) return;
    const ch = await charFromWiki(s.slug, file);
    if (!ch) { setStatus(t('ui.starter.wikiReadFail')); return; }
    s.cast = upsertChar(s.cast, ch);
    await ctx.save({ now: true });
    renderCastStep(host, ctx);
  };
  const push = el('button', null, t('ui.starter.castPushAll'));
  push.title = t('ui.starter.castPushAllHint');
  push.onclick = async () => {
    const r = await syncCastToWiki(s);
    setStatus(tf('ui.starter.castPushed', r.saved) + (r.failed ? tf('ui.starter.castPushFail', r.failed) : ''));
    renderCastStep(host, ctx);
  };
  bar.append(add, fromWiki, push);
  host.append(bar);

  // ══ [alpha.116 ข้อ 10] ★ ชื่อที่เรื่องย่อตั้งไว้แล้ว ══
  //
  // ผู้ใช้: *"ในการสร้างเรื่องย่อ มักจะถูกกำหนดชื่อตัวละคร ดังนั้นเมื่อเข้าหน้าตัวละคร
  //         ควรมี suggestion"*
  //
  // ที่ผ่านมาคนเขียนต้องอ่านเรื่องย่อของตัวเองแล้วพิมพ์ชื่อซ้ำเข้าไปทีละตัว — ทั้งที่ชื่อ
  // มันอยู่ในข้อความอยู่แล้ว · ชิปที่นี่กดครั้งเดียวได้ตัวละครใหม่พร้อมชื่อ
  // (ตัวที่มีในคณะแล้วถูกกรองออกให้ ไม่มีทางแนะนำซ้ำ)
  renderNameHints(host, ctx);

  if (!s.cast.length) {
    host.append(el('div', 'st-empty', t('ui.starter.castEmpty')));
    return true;                              // ชิปแนะนำชื่อวาดไปแล้วข้างบน (สำคัญที่สุดตอนยังไม่มีใครเลย)
  }

  // ── การ์ดตัวละคร ─────────────────────────────────────────
  const grid = el('div', 'st-cast-grid');
  host.append(grid);
  for (const ch of s.cast) {
    const card = el('div', 'st-cast-card' + (charReady(ch) ? '' : ' todo'));
    // [alpha.96] รูปตัวละคร **ห้ามถูกครอบตัด** — เห็นสัดส่วนจริงเสมอ (`object-fit: contain`)
    // การ์ดจึงเป็นสองคอลัมน์: รูปเต็มใบทางซ้าย · ข้อมูลทางขวา
    const pic = el('div', 'st-cast-pic');
    const url = await imageUrl(s.slug, ch.image);
    if (url) { const im = el('img'); im.src = url; im.alt = ch.name || ''; pic.append(im); }
    else pic.append(el('span', 'st-cast-noimg', '👤'));
    card.append(pic);

    const info = el('div', 'st-cast-info');
    info.append(el('div', 'st-cast-name', ch.name || t('ui.starter.castNoName')));
    const meta = [];
    if (ch.gender) meta.push((GENDERS.find((g) => g.id === ch.gender) || {}).label || '');
    if (ch.wikiPath) meta.push('📚 ' + t('ui.starter.inWiki'));
    if (meta.length) info.append(el('div', 'st-cast-meta', meta.join(' · ')));
    const desc = String(ch.persona || '').trim();
    info.append(el('div', 'st-cast-desc',
      desc ? desc.slice(0, 120) + (desc.length > 120 ? '…' : '') : t('ui.starter.castNoDesc')));
    card.append(info);

    const btns = el('div', 'st-cast-btns');
    const edit = el('button', null, t('ui.common.edit'));
    edit.onclick = () => { CAST_C.editing = ch.id; renderCastStep(host, ctx); };
    const del = el('button', 'st-danger', t('ui.common.del'));
    del.onclick = async () => {
      if (!(await confirmBox(tf('ui.starter.castDelAsk', ch.name || t('ui.starter.castNoName')),
                             t('ui.common.del')))) return;
      s.cast = removeChar(s.cast, ch.id);
      await ctx.save({ now: true });
      renderCastStep(host, ctx);
    };
    btns.append(edit, del);
    card.append(btns);
    grid.append(card);
  }
  // ลบใน starter ไม่ตามไปลบใน Wiki โดยตั้งใจ — ของใน Wiki อาจถูกใช้ที่อื่นในเรื่องแล้ว
  host.append(el('div', 'st-hint', t('ui.starter.castDelNote')));
  return true;
}

/**
 * แถบชิป "ชื่อที่เจอในเรื่องย่อ" — ไม่มีชื่อให้แนะนำก็ไม่วาดอะไรเลย
 * @returns {number} จำนวนชิปที่วาด (ให้ selftest ยืนยันได้)
 */
export function renderNameHints(host, ctx) {
  const s = ctx.starter;
  const taken = [];
  for (const c of s.cast || []) { if (c.name) taken.push(c.name); }
  const rows = suggestNames(starterText(s), { exclude: taken, limit: 8 });
  if (!rows.length) return 0;

  const box = el('div', 'st-namehints');
  box.append(el('span', 'st-namehints-label', t('ui.starter.nameHintLabel')));
  for (const r of rows) {
    const chip = el('button', 'st-namechip', '+ ' + r.name);
    chip.dataset.name = r.name;
    chip.title = sourceLabel(r.source) + (r.hits > 1 ? tf('ui.starter.nameHintHits', r.hits) : '');
    chip.onclick = async () => {
      const ch = newChar({ name: r.name });
      s.cast = upsertChar(s.cast, ch);
      CAST_C.editing = ch.id;                 // เปิดตัวแก้ไขต่อทันที — กดชิปแล้วได้เขียนต่อเลย
      await ctx.save({ now: true });
      renderCastStep(host, ctx);
    };
    box.append(chip);
  }
  host.append(box);
  return rows.length;
}

// ───────────────────────── ตัวแก้ไขตัวละคร ─────────────────────────

async function renderEditor(host, ctx, ch) {
  const s = ctx.starter;
  host.innerHTML = '';
  const save = () => { s.cast = upsertChar(s.cast, ch); ctx.save(); };

  const head = el('div', 'st-row-btns');
  const back = el('button', 'st-back', '← ' + t('ui.starter.castBackToList'));
  back.onclick = async () => { CAST_C.editing = ''; await ctx.save({ now: true }); renderCastStep(host, ctx); };
  head.append(back);
  host.append(head);

  // ── รูป ──────────────────────────────────────────────────
  const picRow = el('div', 'st-field');
  picRow.append(el('label', null, t('ui.starter.fImage')));
  const picBox = el('div', 'st-edit-pic st-img-box st-img-portrait');
  const drawPic = async () => {
    picBox.innerHTML = '';
    const url = await imageUrl(s.slug, ch.image);
    if (url) { const im = el('img'); im.src = url; picBox.append(im); }
    else picBox.append(el('div', 'st-cover-empty', t('ui.starter.noImage')));
  };
  const picBtns = el('div', 'st-row-btns');
  const fromFile = el('button', null, t('ui.starter.imgFromFile'));
  fromFile.onclick = async () => {
    const p = await kapi.openImageDialog();
    if (!p) return;
    const f = await importImage(s.slug, p);
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    ch.image = f; save(); await drawPic();
  };
  const fromGal = el('button', null, t('ui.starter.imgFromGallery'));
  fromGal.onclick = async () => {
    const { pickImage } = await import('../gallery.js');
    const it = await pickImage(ctx.root);
    if (!it || !it.file) return;
    const f = await importFromGallery(s.slug, it.file);
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    ch.image = f; save(); await drawPic();
  };
  const clr = el('button', null, t('ui.starter.imgClear'));
  clr.onclick = async () => { ch.image = ''; save(); await drawPic(); };
  picBtns.append(fromFile, fromGal, clr);
  picRow.append(picBox, picBtns);
  host.append(picRow);
  await drawPic();

  // ── ชื่อ ─────────────────────────────────────────────────
  const nameRow = el('div', 'st-field');
  nameRow.append(el('label', null, t('ui.starter.fCharName')));
  const nameInp = el('input', 'wiki-input');
  nameInp.value = ch.name || '';
  nameInp.placeholder = t('ui.starter.fCharNamePlaceholder');
  nameInp.oninput = () => { ch.name = nameInp.value; save(); };
  nameRow.append(nameInp);
  host.append(nameRow);

  // ── เพศ ──────────────────────────────────────────────────
  const genRow = el('div', 'st-field');
  genRow.append(el('label', null, t('ui.starter.fGender')));
  const gen = el('div', 'st-gender');
  for (const g of GENDERS) {
    const b = el('button', 'st-gender-btn' + (ch.gender === g.id ? ' on' : ''), g.icon + ' ' + g.label);
    b.onclick = () => { ch.gender = g.id; save(); renderEditor(host, ctx, ch); };
    gen.append(b);
  }
  genRow.append(gen);
  host.append(genRow);

  // ── คำบรรยายละเอียด (ช่องเดียวตามสเปก) ───────────────────
  const descRow = el('div', 'st-field');
  descRow.append(el('label', null, t('ui.starter.fDesc')));
  const ta = el('textarea', 'wiki-input st-ta');
  ta.rows = 10;
  ta.value = ch.persona || '';
  ta.placeholder = t('ui.starter.fDescPlaceholder');
  ta.oninput = () => { ch.persona = ta.value; save(); };
  descRow.append(ta);

  const descBtns = el('div', 'st-row-btns');
  descBtns.append(aiBtn(t('ui.starter.aiWriteChar'), async (reqId) => {
    if (!String(ch.name || '').trim()) { setStatus(t('ui.starter.needCharName')); return; }
    const out = await askAI('char-desc', charDescPrompt(s, ch), SYS_WRITER(), reqId);
    if (out) { ch.persona = out; ta.value = out; save(); }
    else setStatus(t('ui.starter.aiNoResult'));
  }));
  if (!String(s.intro || '').trim()) descBtns.append(el('span', 'st-dim', t('ui.starter.aiBetterWithIntro')));
  descRow.append(descBtns);
  host.append(descRow);

  // ── เพิ่มเติม: ชื่อรอง · สรรพนาม · การ์ดสาธารณะ ──────────
  const more = el('details', 'st-more');
  more.append(el('summary', null, t('ui.starter.moreFields')));

  const aliasRow = el('div', 'st-field');
  aliasRow.append(el('label', null, t('ui.starter.fAliases')));
  const aliasInp = el('input', 'wiki-input');
  aliasInp.value = (ch.aliases || []).join(', ');
  aliasInp.placeholder = t('ui.starter.fAliasesPlaceholder');
  aliasInp.oninput = () => {
    ch.aliases = aliasInp.value.split(',').map((x) => x.trim()).filter(Boolean);
    save();
  };
  aliasRow.append(aliasInp);
  more.append(aliasRow);

  const pronRow = el('div', 'st-field');
  pronRow.append(el('label', null, t('ui.starter.fPronoun')));
  const pronInp = el('input', 'wiki-input');
  pronInp.value = ch.selfPronoun || '';
  pronInp.placeholder = t('ui.starter.fPronounPlaceholder');
  pronInp.oninput = () => { ch.selfPronoun = pronInp.value; save(); };
  pronRow.append(pronInp);
  more.append(pronRow);

  const blurbRow = el('div', 'st-field');
  blurbRow.append(el('label', null, t('ui.starter.fBlurb')));
  const blurbInp = el('input', 'wiki-input');
  blurbInp.value = ch.blurb || '';
  blurbInp.placeholder = t('ui.starter.fBlurbPlaceholder');
  blurbInp.oninput = () => { ch.blurb = blurbInp.value; save(); };
  blurbRow.append(blurbInp);
  more.append(blurbRow);
  host.append(more);

  // ── บันทึกลง Wiki ────────────────────────────────────────
  const foot = el('div', 'st-row-btns');
  const toWiki = el('button', 'k-ok', ch.wikiPath ? t('ui.starter.charUpdateWiki') : t('ui.starter.charToWiki'));
  toWiki.onclick = async () => {
    if (!charReady(ch)) { setStatus(t('ui.starter.needCharName')); return; }
    const p = await pushCharToWiki(s.slug, ch);
    if (!p) { setStatus(t('ui.starter.wikiWriteFail')); return; }
    ch.wikiPath = p; save();
    await ctx.save({ now: true });
    setStatus(t('ui.starter.charSavedWiki'));
    renderEditor(host, ctx, ch);
  };
  foot.append(toWiki);
  if (ch.wikiPath) foot.append(el('span', 'st-dim', t('ui.starter.linkedWiki')));
  host.append(foot);
  return true;
}
