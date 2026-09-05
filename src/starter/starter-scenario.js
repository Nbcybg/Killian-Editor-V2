// starter-scenario.js — หน้าของเรื่องหนึ่งเรื่อง + รายการตอน (สเปกข้อ 10–11)
//
// "จริง ๆ มันหลักการเดียวกับ session" — ใช่ และตั้งใจให้เป็นแบบนั้น
// จึงยืมโครงข้อมูลแนวเดียวกับ ai-session.js มา แต่เก็บใน `<starter>/Scenarios/`
// เพราะตอนต้องย้ายไปพร้อม starter (ข้อ 9) ไม่ใช่ค้างอยู่กับโปรเจกต์
//
// สิ่งที่ session ธรรมดาไม่มี: **เชื่อมกับตอนก่อนหน้า** (ข้อ 11)
// ตอนถัดไปได้รับเฉพาะ "บทย่อ" ของตอนก่อน ไม่ใช่บทสนทนาเต็ม — ไม่งั้นพอถึงตอนที่ 3
// บริบทจะบวมจนยิงไม่ผ่าน และค่าใช้จ่ายพุ่งโดยไม่ได้อะไรเพิ่ม

import { el, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { confirmBox } from '../ui.js';

import {
  searchScenarios, selectablePrev, scenarioStats, hasPlay, chainOf,
  sumTokens, lastUpdated, hasIntro, isAdv, scenarioAdvFilled,
} from './starter-model.js';
import {
  synopsisPrompt, scenarioNamePrompt, openerPrompt, goalPrompt, conditionsPrompt, moodPrompt,
  SYS_WRITER,
} from './starter-prompt.js';
import {
  listScenarios, createScenario, writeScenario, deleteScenario,
  nextScenarioTitle, imageUrl, importImage, importFromGallery,
} from './starter-store.js';
import { pickLine } from './starter-steps.js';
import { mentionField, richMentionField } from './starter-fields.js';
import { mentionToken, MENTION_ANY, MENTION_USER } from '../entity-mention.js';
import { modeSwitch } from './starter-wizard.js';
import { aiBtn, askAI, tokenBadge } from './starter-ai.js';
import { renderRichView } from './starter-richtext.js';
import { convertDialog } from './starter-export.js';
import { bridgeDialog, canPush } from './starter-bridge.js';

// โทเคนตัวอย่างที่ยัดเข้า placeholder — **ห้ามเขียน `{{…}}` ตรง ๆ ในไฟล์ภาษา**
// เพราะ `t()` คลาย `{{`→`{` (ดู formatMsg ใน i18n.js) · ต้องส่งผ่าน `tf(key, TOK_…)` เสมอ
const TOK_ANY = mentionToken(MENTION_ANY);
const TOK_USER = mentionToken(MENTION_USER);

const SC_C = { query: '', descOpen: false };

/** ห่อปุ่ม AI หนึ่งตัวให้เป็นแถว (ช่องขั้นสูงของตอนใช้ซ้ำหลายที่) */
function aiRow(btn) {
  const row = el('div', 'st-row-btns');
  row.append(btn);
  return row;
}

/**
 * ช่องเลือกรูปที่เก็บค่าไว้ใน **ตัวแปรร่าง** ไม่ใช่ในตัวข้อมูล
 *
 * ต่างจาก `imagePicker` ของ starter-steps.js ตรงนี้จงใจ: ในกล่องตั้งค่าตอน กด "ยกเลิก"
 * แล้วต้องไม่มีอะไรเปลี่ยน — ถ้าเขียนลง `sc` ทันทีที่เลือกรูป การยกเลิกจะไม่ยกเลิกจริง
 *
 * [alpha.123] ผู้ใช้: *"รูปประกอบบทเปิด แสดงภาพให้ด้วย และเลือกจากคลังได้"*
 * → ทั้งรูปย่อและรูปบทเปิดใช้ตัวนี้ตัวเดียวกัน มีทั้งพรีวิวและปุ่มคลังรูปเท่ากัน
 *
 * @param {object} o  slug · root · get() · set(file) · ratio · label · hint
 * @returns {HTMLElement}
 */
function draftImagePicker({ slug, root, get, set, ratio = 'st-img-thumb', label = '', hint = '' }) {
  const row = el('div', 'st-field st-img-field');
  if (label) row.append(el('label', null, label));
  const box = el('div', 'st-img-box ' + ratio);
  const draw = async () => {
    box.replaceChildren();
    const url = await imageUrl(slug, get());
    if (url) {
      const im = el('img');
      im.src = url; im.alt = '';
      im.title = t('ui.wiki.clickExpand2');
      im.onclick = async () => {
        const { imageLightbox } = await import('../wiki.js');
        imageLightbox(url, '');
      };
      box.append(im);
    } else box.append(el('div', 'st-cover-empty', t('ui.starter.noImage')));
  };
  const btns = el('div', 'st-row-btns');
  const fromFile = el('button', null, t('ui.starter.imgFromFile'));
  fromFile.type = 'button';
  fromFile.onclick = async () => {
    const p = await kapi.openImageDialog();
    if (!p) return;
    const f = await importImage(slug, p);
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    set(f); await draw();
  };
  const fromGal = el('button', null, t('ui.starter.imgFromGallery'));
  fromGal.type = 'button';
  fromGal.onclick = async () => {
    const { pickImage } = await import('../gallery.js');
    const it = await pickImage(root);
    if (!it || !it.file) return;
    const f = await importFromGallery(slug, it.file);
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    set(f); await draw();
  };
  const clr = el('button', null, t('ui.starter.imgClear'));
  clr.type = 'button';
  clr.onclick = async () => { set(''); await draw(); };
  btns.append(fromFile, fromGal, clr);
  row.append(box, btns);
  if (hint) row.append(el('div', 'st-hint', hint));
  draw();
  row.__redraw = draw;
  return row;
}

/**
 * หน้าของเรื่องหนึ่งเรื่อง — ผังตามที่ผู้ใช้กำหนดไว้ (alpha.96):
 *   แถว 1  สองคอลัมน์: ปกแนวตั้ง | ชื่อเรื่อง · ผู้แต่ง · แท็ก · คำโปรยหนึ่งบรรทัด
 *   แถว 2  แบนเนอร์กว้างเต็มหน้า
 *   แถว 3  คำบรรยายเรื่อง — พับเก็บ/กางได้
 *   แถว 4  รายการตอน
 *   แถว 5  แก้ไขล่าสุดเมื่อไหร่
 */
export async function renderStarterHome(host, ctx) {
  const s = ctx.starter;
  host.innerHTML = '';
  const wrap = el('div', 'st-home');
  host.append(wrap);

  const head = el('div', 'st-home-head');
  const back = el('button', 'st-back', '← ' + t('ui.starter.backToList'));
  back.onclick = () => ctx.goList();
  head.append(back);
  wrap.append(head);

  const rows = await listScenarios(s.slug);

  // ── แถว 1: ปก | ข้อมูลเรื่อง ─────────────────────────────
  const hero = el('div', 'st-hero');
  const coverBox = el('div', 'st-img-box st-img-cover st-hero-cover');
  const coverUrl = await imageUrl(s.slug, s.cover);
  if (coverUrl) { const im = el('img'); im.src = coverUrl; im.alt = s.name || ''; coverBox.append(im); }
  else coverBox.append(el('div', 'st-cover-empty', t('ui.starter.noCover')));
  hero.append(coverBox);

  const heroInfo = el('div', 'st-hero-info');
  heroInfo.append(el('div', 'st-hero-title', s.name || t('ui.starter.untitled')));
  heroInfo.append(el('div', 'st-hero-author',
    s.author ? t('ui.starter.byAuthor') + s.author : t('ui.starter.noAuthor')));
  if ((s.tags || []).length) {
    const tags = el('div', 'st-hero-tags');
    for (const tg of s.tags) tags.append(el('span', 'st-tag on', tg));
    heroInfo.append(tags);
  }
  // คำโปรย **บรรทัดเดียว** ตามสเปก — ยาวเกินตัดด้วย ellipsis ที่ CSS ไม่ใช่ตัดข้อความทิ้ง
  heroInfo.append(el('div', 'st-hero-blurb', s.blurb || t('ui.starter.noBlurb')));

  const heroBtns = el('div', 'st-row-btns');
  const edit = el('button', null, '✏️ ' + t('ui.starter.editStarter'));
  edit.onclick = () => ctx.goWizard();
  heroBtns.append(edit);
  // สลับโหมดได้จากหน้าเรื่องด้วย — ช่องขั้นสูงของ **ตอน** อยู่ที่นี่ ไม่ได้อยู่ใน wizard
  heroBtns.append(modeSwitch({ ...ctx, rerender: () => renderStarterHome(host, ctx) }));
  if (rows.some((r) => (r.turns || []).length)) {
    const cv = el('button', 'k-ok', '📝 ' + t('ui.starter.cvBtn'));
    cv.title = t('ui.starter.cvBtnHint');
    cv.onclick = async () => {
      const made = await convertDialog(s, rows);
      if (made && made.length) renderStarterHome(host, ctx);
    };
    heroBtns.append(cv);
  }
  if (canPush(s, rows)) {
    const br = el('button', null, '🧭 ' + t('ui.starter.brBtn'));
    br.title = t('ui.starter.brBtnHint');
    br.onclick = () => bridgeDialog(s, rows);
    heroBtns.append(br);
  }
  heroInfo.append(heroBtns);
  hero.append(heroInfo);
  wrap.append(hero);

  // ── แถว 2: แบนเนอร์เต็มความกว้าง ─────────────────────────
  const bannerUrl = await imageUrl(s.slug, s.banner);
  if (bannerUrl) {
    const bn = el('div', 'st-banner');
    const im = el('img'); im.src = bannerUrl; im.alt = '';
    bn.append(im);
    wrap.append(bn);
  }

  // ── แถว 3: คำบรรยายเรื่อง (พับได้) ───────────────────────
  if (hasIntro(s)) {
    const acc = el('details', 'st-acc');
    acc.open = SC_C.descOpen;
    acc.ontoggle = () => { SC_C.descOpen = acc.open; };
    acc.append(el('summary', 'st-acc-head', t('ui.starter.descHead')));
    acc.append(await renderRichView(s.slug, s.intro));
    wrap.append(acc);
  }

  // ── แถว 4: รายการตอน ─────────────────────────────────────
  const bar = el('div', 'st-row-btns st-sc-bar');
  const add = el('button', 'k-ok', '+ ' + t('ui.starter.scAdd'));
  add.onclick = async () => {
    const sc = await createScenario(s.slug, { title: nextScenarioTitle(rows) });
    const ok = await scenarioDialog(ctx, sc, rows);
    if (!ok) { await deleteScenario(s.slug, sc.id); renderStarterHome(host, ctx); return; }
    await writeScenario(s.slug, sc);
    ctx.openChat(sc);
  };
  bar.append(add);
  const search = el('input', 'wiki-input st-sc-search');
  search.placeholder = t('ui.starter.scSearch');
  search.value = SC_C.query;
  search.oninput = () => { SC_C.query = search.value; drawList(); };
  bar.append(search);
  // [alpha.96] ป้ายโทเคนรวมของทั้งเรื่อง — ค่าใช้จ่ายจริงอยู่ตรงนี้ ไม่ใช่ที่จำนวนคำ
  bar.append(tokenBadge(sumTokens(rows)));
  wrap.append(bar);

  const list = el('div', 'st-sc-list');
  wrap.append(list);

  const drawList = async () => {
    list.innerHTML = '';
    const hit = searchScenarios(rows, SC_C.query);
    if (!hit.length) {
      list.append(el('div', 'st-empty',
        rows.length ? t('ui.starter.scNoMatch') : t('ui.starter.scEmpty')));
      return;
    }
    for (const sc of hit) {
      const card = el('div', 'st-sc-card');
      // รูปย่อของตอน — โผล่เฉพาะตอนที่ตั้งไว้จริง ไม่งั้นการ์ดจะมีช่องว่างเปล่า ๆ ทุกใบ
      const thUrl = await imageUrl(s.slug, sc.thumb);
      if (thUrl) {
        const th = el('div', 'st-img-box st-img-thumb st-sc-thumb');
        const im = el('img'); im.src = thUrl; im.alt = sc.title || '';
        th.append(im);
        card.append(th);
      }
      const main = el('div', 'st-sc-main');
      main.append(el('div', 'st-sc-title', sc.title || t('ui.starter.scUntitled')));

      if (sc.prevId) {
        const chain = chainOf(rows, sc.id);
        const prev = chain[chain.length - 2];
        main.append(el('div', 'st-sc-prev', '↳ ' + t('ui.starter.scAfter')
          + (prev ? (prev.title || t('ui.starter.scUntitled')) : t('ui.starter.scPrevMissing'))));
      }
      if (String(sc.synopsis || '').trim()) {
        main.append(el('div', 'st-sc-syn', sc.synopsis.slice(0, 160)
          + (sc.synopsis.length > 160 ? '…' : '')));
      }
      const st = scenarioStats(sc);
      const meta = el('div', 'st-sc-meta');
      meta.append(el('span', null, st.turns
        ? tf('ui.starter.scStats', st.turns, st.words)
        : t('ui.starter.scNotPlayed')));
      if (st.inTok || st.outTok) meta.append(tokenBadge(st));
      if ((sc.exports || []).length) {
        meta.append(el('span', 'st-sc-exported', tf('ui.starter.scExported', sc.exports.length)));
      }
      // ป้ายบอกว่าตอนนี้ตั้งค่าขั้นสูงไว้ — ไม่งั้นเปิดกล่องเข้าไปดูทีละตอนถึงจะรู้
      const nAdv = scenarioAdvFilled(sc);
      if (nAdv) meta.append(el('span', 'st-sc-adv', '⚙️ ' + tf('ui.starter.scAdvBadge', nAdv)));
      main.append(meta);
      card.append(main);

      const btns = el('div', 'st-sc-btns');
      const open = el('button', 'k-ok', st.turns ? t('ui.starter.scContinue') : t('ui.starter.scStart'));
      open.onclick = () => ctx.openChat(sc);
      btns.append(open);
      if ((sc.turns || []).length) {
        const cv1 = el('button', null, '📝');
        cv1.title = t('ui.starter.cvOne');
        cv1.onclick = async () => {
          const made = await convertDialog(s, rows, sc);
          if (made && made.length) renderStarterHome(host, ctx);
        };
        btns.append(cv1);
      }
      const ed = el('button', null, t('ui.common.edit'));
      ed.onclick = async () => {
        if (await scenarioDialog(ctx, sc, rows)) { await writeScenario(s.slug, sc); renderStarterHome(host, ctx); }
      };
      const del = el('button', 'st-danger', t('ui.common.del'));
      del.onclick = async () => {
        const msg = hasPlay(sc) ? tf('ui.starter.scDelPlayedAsk', sc.title, scenarioStats(sc).turns)
                                : tf('ui.starter.scDelAsk', sc.title);
        if (!(await confirmBox(msg, t('ui.common.del')))) return;
        await deleteScenario(s.slug, sc.id);
        renderStarterHome(host, ctx);
      };
      btns.append(ed, del);
      card.append(btns);
      list.append(card);
    }
  };
  await drawList();

  // ── แถว 5: แก้ไขล่าสุด ───────────────────────────────────
  const up = lastUpdated(s, rows);
  wrap.append(el('div', 'st-updated',
    up ? t('ui.starter.lastUpdate') + fmtWhen(up) : t('ui.starter.neverUpdated')));
  return true;
}

/** วันเวลาแบบอ่านง่าย — วันนี้/เมื่อวานบอกเป็นเวลา ที่เหลือบอกเป็นวันที่ */
export function fmtWhen(ms) {
  const d = new Date(Number(ms) || 0);
  if (!ms || Number.isNaN(d.getTime())) return '-';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return t('ui.starter.today') + ' ' + hh;
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return t('ui.starter.yesterday') + ' ' + hh;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0') + ' ' + hh;
}

// ───────────────────────── กล่องตั้งค่าตอน ─────────────────────────

/**
 * ตั้งชื่อ + เรื่องย่อ + เลือกตอนก่อนหน้า + เลือกว่าผู้เล่นสวมบทใคร
 * แก้ `sc` ในที่แล้วคืน true เมื่อกดตกลง
 */
export function scenarioDialog(ctx, sc, rows) {
  const s = ctx.starter;
  const adv = isAdv(s);
  const cast = (s.cast || []).filter((c) => String(c.name || '').trim());
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide st-sc-dlg');
    box.append(el('div', 'k-dlg-title', t('ui.starter.scDlgTitle')
      + (adv ? ' · ⚙️ ' + t('ui.starter.modeAdv') : '')));
    const done = (v) => { ov.remove(); resolve(v); };

    // ── รูปย่อของตอน (ผู้ใช้ข้อ 2.3) ────────────────────────
    // ร่างค้างไว้ใน `thumb` แล้วค่อยยัดกลับตอนกดตกลง — กดยกเลิกต้องไม่เปลี่ยนอะไรเลย
    let thumb = sc.thumb || '';
    box.append(draftImagePicker({
      slug: s.slug, root: ctx.root,
      get: () => thumb, set: (v) => { thumb = v; },
      ratio: 'st-img-thumb', label: t('ui.starter.scThumb'), hint: t('ui.starter.scThumbHint'),
    }));

    // ชื่อตอน
    const nameRow = el('div', 'st-field');
    nameRow.append(el('label', null, t('ui.starter.scName')));
    const nameInp = el('input', 'wiki-input');
    nameInp.value = sc.title || '';
    nameRow.append(nameInp);
    const nameBtns = el('div', 'st-row-btns');
    nameBtns.append(aiBtn(t('ui.starter.aiSuggestName'), async (reqId) => {
      const out = await askAI('scenario-name',
        scenarioNamePrompt(s, { ...sc, synopsis: synInp.value }), SYS_WRITER(), reqId);
      if (!out || !pickLine(nameBtns, out, (v) => { nameInp.value = v; })) {
        setStatus(t('ui.starter.aiNoResult'));
      }
    }));
    nameRow.append(nameBtns);
    box.append(nameRow);

    // ตอนก่อนหน้า (สเปกข้อ 11) — กันเลือกลูกหลานตัวเอง ไม่งั้นสายจะวนกัน
    const prevRow = el('div', 'st-field');
    prevRow.append(el('label', null, t('ui.starter.scPrev')));
    const prevSel = el('select', 'wiki-input k-dlg-select');
    const none = el('option', null, t('ui.starter.scPrevNone')); none.value = '';
    prevSel.append(none);
    for (const r of selectablePrev(rows, sc.id)) {
      const o = el('option', null, r.title || t('ui.starter.scUntitled'));
      o.value = r.id; prevSel.append(o);
    }
    prevSel.value = sc.prevId || '';
    prevRow.append(prevSel);
    prevRow.append(el('div', 'st-hint', t('ui.starter.scPrevHint')));
    box.append(prevRow);

    // เรื่องย่อ
    const synRow = el('div', 'st-field');
    synRow.append(el('label', null, t('ui.starter.scSynopsis')));
    const synInp = el('textarea', 'wiki-input st-ta');
    synInp.rows = 6;
    synInp.value = sc.synopsis || '';
    synInp.placeholder = t('ui.starter.scSynopsisPlaceholder');
    synRow.append(synInp);
    const synBtns = el('div', 'st-row-btns');
    synBtns.append(aiBtn(t('ui.starter.aiWriteSynopsis'), async (reqId) => {
      const prev = rows.find((r) => r.id === prevSel.value) || null;
      const out = await askAI('scenario-synopsis',
        synopsisPrompt(s, { ...sc, title: nameInp.value }, prev), SYS_WRITER(), reqId);
      if (out) synInp.value = out; else setStatus(t('ui.starter.aiNoResult'));
    }));
    synRow.append(synBtns);
    box.append(synRow);

    // ผู้เล่นสวมบทใคร — ตัวที่เลือก GM ห้ามพูดแทน
    const castRow = el('div', 'st-field');
    castRow.append(el('label', null, t('ui.starter.scMyChars')));
    const castBox = el('div', 'st-tag-list');
    const mine = new Set(sc.userChars || []);
    const ready = (s.cast || []).filter((c) => String(c.name || '').trim());
    if (!ready.length) castBox.append(el('div', 'st-dim', t('ui.starter.scNoCast')));
    for (const c of ready) {
      const b = el('button', 'st-tag' + (mine.has(c.id) ? ' on' : ''), c.name);
      b.onclick = () => {
        if (mine.has(c.id)) mine.delete(c.id); else mine.add(c.id);
        b.classList.toggle('on');
      };
      castBox.append(b);
    }
    castRow.append(castBox);
    castRow.append(el('div', 'st-hint', t('ui.starter.scMyCharsHint')));
    box.append(castRow);

    // ══ ช่องขั้นสูงของตอน (ผู้ใช้ข้อ 2.4) ═══════════════════
    //
    // สี่ช่องนี้ตอบคนละคำถามกัน จงใจไม่ยุบรวม:
    //   คำบรรยาย = โลกและฉากเป็นยังไง · บทเปิด = เริ่มต้นยังไง
    //   เป้าหมาย = เล่นไปเพื่ออะไร   · เงื่อนไขจบ = รู้ได้ยังไงว่าสำเร็จแล้ว
    // GM ได้ทั้งสี่ก้อนใน system prompt (starter-prompt.js) แต่ **บทเปิดถูกใช้เป็นเทิร์นแรกจริง**
    // ไม่ได้ให้โมเดลแต่งเอง — ผู้ใช้เขียนไว้ยังไงก็ได้อย่างนั้นเป๊ะ
    let openerImage = sc.openerImage || '';
    let descRow = null, openRow = null, goalRow = null, condRow = null, moodRow = null;
    if (adv) {
      const advBox = el('div', 'st-adv-box');
      advBox.append(el('div', 'st-sub', '⚙️ ' + t('ui.starter.scAdvHead')));
      advBox.append(el('div', 'st-hint', tf('ui.starter.scAdvHint', TOK_ANY, TOK_USER)));

      descRow = mentionField(t('ui.starter.scDesc'), sc.desc, () => {},
        { cast, rows: 5, placeholder: tf('ui.starter.scDescPlaceholder', TOK_ANY) });
      advBox.append(descRow);

      // [alpha.123] อารมณ์และโทน — ผู้ใช้: *"ในตอนเพิ่ม field คือ mood and tone เรื่อง ให้หน่อย"*
      // แยกจาก "คำอธิบาย" เพราะโมเดลปฏิบัติกับสองอย่างนี้ต่างกัน: คำอธิบาย = ข้อเท็จจริงของฉาก
      // (ทำอะไรได้/มีอะไรอยู่) · โทน = สำนวนและจังหวะการเล่า (เขียนออกมาให้รู้สึกยังไง)
      moodRow = mentionField(t('ui.starter.scMood'), sc.mood, () => {},
        { cast, rows: 2, placeholder: t('ui.starter.scMoodPlaceholder'),
          hint: t('ui.starter.scMoodHint') });
      moodRow.append(aiRow(aiBtn(t('ui.starter.aiHelp'), async (reqId) => {
        const out = await askAI('scenario-mood',
          moodPrompt(s, { ...sc, title: nameInp.value, synopsis: synInp.value }), SYS_WRITER(), reqId);
        if (out) moodRow.__input.value = out; else setStatus(t('ui.starter.aiNoResult'));
      })));
      advBox.append(moodRow);

      // ── บทเปิด: ตัวแก้ไขแบบเห็นผลจริง (ผู้ใช้ขอ b/i/u) ──
      // `richMentionField` เป็น async แต่กล่องนี้สร้างแบบซิงก์ → จองที่ไว้ก่อน แล้วเติมทีหลัง
      // (ถ้ารอ await ทั้งกล่อง ผู้ใช้จะเห็นจอว่างวูบหนึ่งทุกครั้งที่เปิดกล่อง)
      const openSlot = el('div', 'st-open-slot');
      advBox.append(openSlot);
      richMentionField(t('ui.starter.scOpener'), sc.opener, {
        slug: s.slug, cast, minHeight: 150,
        placeholder: tf('ui.starter.scOpenerPlaceholder', TOK_ANY),
        hint: t('ui.starter.scOpenerHint'),
      }).then((row) => {
        openRow = row;
        const opBtns = el('div', 'st-row-btns');
        opBtns.append(aiBtn(t('ui.starter.aiWriteOpener'), async (reqId) => {
          const out = await askAI('scenario-opener',
            openerPrompt(s, { ...sc, title: nameInp.value, synopsis: synInp.value }),
            SYS_WRITER(), reqId);
          if (out) openRow.__setHtml(out); else setStatus(t('ui.starter.aiNoResult'));
        }));
        row.append(opBtns);
        // รูปประกอบบทเปิด — *"แสดงภาพให้ด้วย และเลือกจากคลังได้"*
        row.append(draftImagePicker({
          slug: s.slug, root: ctx.root,
          get: () => openerImage, set: (v) => { openerImage = v; },
          ratio: 'st-img-thumb', label: t('ui.starter.scOpenerImage'),
          hint: t('ui.starter.scOpenerImageHint'),
        }));
        openSlot.replaceChildren(row);
      }).catch((e) => {
        log('error', 'starter: opener editor', e);
        openSlot.append(el('div', 'st-err', t('ui.starter.stepDrawFail')));
      });

      goalRow = mentionField(t('ui.starter.scGoal'), sc.goal, () => {},
        { cast, rows: 3, placeholder: tf('ui.starter.scGoalPlaceholder', TOK_ANY) });
      goalRow.append(aiRow(aiBtn(t('ui.starter.aiHelp'), async (reqId) => {
        const out = await askAI('scenario-goal',
          goalPrompt(s, { ...sc, title: nameInp.value, synopsis: synInp.value }), SYS_WRITER(), reqId);
        if (out) goalRow.__input.value = out; else setStatus(t('ui.starter.aiNoResult'));
      })));
      advBox.append(goalRow);

      condRow = mentionField(t('ui.starter.scCond'), sc.conditions, () => {},
        { cast, rows: 4,
          placeholder: tf('ui.starter.scCondPlaceholder', TOK_ANY, TOK_USER),
          hint: t('ui.starter.scCondHint') });
      condRow.append(aiRow(aiBtn(t('ui.starter.aiHelp'), async (reqId) => {
        const out = await askAI('scenario-cond',
          conditionsPrompt(s, { ...sc, title: nameInp.value, synopsis: synInp.value,
                                goal: goalRow.__input.value }), SYS_WRITER(), reqId);
        if (out) condRow.__input.value = out; else setStatus(t('ui.starter.aiNoResult'));
      })));
      advBox.append(condRow);
      box.append(advBox);
    }

    const foot = el('div', 'k-dlg-foot');
    const cancel = el('button', null, t('ui.common.cancel'));
    cancel.onclick = () => done(false);
    const ok = el('button', 'k-ok', t('ui.common.msg3'));
    ok.onclick = () => {
      sc.title = nameInp.value.trim() || sc.title || t('ui.starter.scUntitled');
      sc.synopsis = synInp.value;
      sc.thumb = thumb;
      sc.prevId = prevSel.value;
      sc.userChars = [...mine];
      // ช่องขั้นสูงเก็บเมื่ออยู่โหมดขั้นสูงเท่านั้น — โหมดพื้นฐานไม่ได้วาดช่องพวกนี้
      // จึงไม่มีค่าให้อ่าน และต้อง **ไม่ล้างของเดิมทิ้ง** (โหมดคุมการมองเห็น ไม่ใช่การมีอยู่)
      if (adv) {
        sc.desc = descRow.__input.value;
        sc.mood = moodRow.__input.value;
        // ตัวแก้ไขบทเปิดโหลดแบบ async — ยังไม่ทันเสร็จก็อย่าไปล้างของเดิมทิ้ง
        if (openRow) sc.opener = openRow.__getHtml();
        sc.openerImage = openerImage;
        sc.goal = goalRow.__input.value;
        sc.conditions = condRow.__input.value;
      }
      // ตัวละครที่ร่วมวง = ทุกตัวที่มีชื่อ (ตัดตัวที่ยังไม่ได้ตั้งชื่อออก)
      sc.cast = ready.map((c) => c.id);
      done(true);
    };
    foot.append(cancel, ok);
    box.append(foot);
    ov.append(box);
    document.body.append(ov);
    nameInp.focus();
  });
}
