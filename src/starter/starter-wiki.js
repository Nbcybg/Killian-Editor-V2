// starter-wiki.js — สะพานสองทางระหว่าง Story Starter กับ Wiki (สเปกข้อ 6)
//
// สองทางจริง ๆ:
//   · **ดึงเข้ามา** — เลือกตัวละครที่มีอยู่แล้วใน Wiki มาใส่ starter (คำบรรยายถูกยุบเป็นช่องเดียว)
//   · **เขียนกลับ** — ตัวละครที่เกิดใน starter ถูกบันทึกลง Wiki ทันที
//
// และ **ตอนย้ายโปรเจกต์** — `reconcileCast()` จับคู่ชื่อให้อัตโนมัติ เหลือให้คนตัดสิน
// เฉพาะกรณีที่ชื่อชนกันหลายตัว (ตรรกะการจับคู่อยู่ใน starter-wiki-merge.js ซึ่งเทสแยก)
//
// ทำไมต้องก๊อปรูปสองที่: รูปใน Wiki ต้องอยู่ `<root>/Images/` (โปรแกรมทั้งตัวคาดหวังแบบนั้น)
// แต่รูปของ starter ต้องอยู่ในโฟลเดอร์ starter ไม่งั้นย้ายข้ามโปรเจกต์แล้วรูปหาย → เก็บทั้งคู่

import { el, state, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { confirmBox } from '../ui.js';
import { wikiRoot, guid, safeName, buildTree } from '../app.js';
import { normalizeImage } from '../wiki-images.js';
import { newChar, upsertChar } from './starter-model.js';
import {
  planMerge, needsAttention, mergeSummary, charPatchFromEntity, entityFromChar,
  applyCharToEntity, matchChar, matchLabel, MATCH_EXACT, MATCH_ALIAS,
  ACT_LINK, ACT_CREATE, ACT_SKIP,
} from './starter-wiki-merge.js';
import { imagesDir, importImage, writeStarter } from './starter-store.js';

const CHAR_CAT = 'characters';

// ───────────────────────── อ่านฝั่ง Wiki ─────────────────────────

/**
 * [alpha.124 ข้อ 21] แคชรายชื่อตัวละคร Wiki
 *
 * `autoLinkChar()` ถูกเรียก **ทุกครั้งที่ออกจากช่องชื่อตัวละคร** และเดิมมันอ่าน
 * `Wiki/characters/*.json` ใหม่ทั้งโฟลเดอร์ทุกครั้ง (โปรเจกต์จริงมีเป็นร้อยไฟล์)
 * → พิมพ์ชื่อแล้วกด Tab ทีไรก็หน่วงยาว และในโปรเจกต์ใหญ่จะรู้สึกเหมือนโปรแกรมค้าง
 *
 * แคชผูกกับ `state.root` และถูกล้างทุกครั้งที่ **เราเอง** เขียนอะไรลงหมวดตัวละคร
 * (ผู้ใช้ไปแก้ไฟล์นอกโปรแกรมระหว่างนั้น = กด "เชื่อมกับ Wiki" เองได้เหมือนเดิม)
 * ES module: ค่าที่ reassign ต้องอยู่ใน object — กฎเหล็กข้อ 2
 */
const WC = { root: '', rows: null };
/** ล้างแคชรายชื่อตัวละคร Wiki — เรียกทุกครั้งที่เขียนไฟล์ในหมวดนี้ */
export function invalidateWikiChars() { WC.root = ''; WC.rows = null; }

/**
 * ตัวละครทั้งหมดใน Wiki ของโปรเจกต์นี้ — รูปแบบที่ starter-wiki-merge.js ต้องการ
 * @param {{fresh?: boolean}} opts fresh = ข้ามแคช (ใช้ตอนกำลังจะเขียนกลับ)
 * @returns {Promise<Array<{file,id,name,aliases,cat}>>}
 */
export async function listWikiChars({ fresh = false } = {}) {
  if (!state.root) return [];
  if (!fresh && WC.rows && WC.root === state.root) return WC.rows;
  const out = [];
  const root = await wikiRoot();
  const catDir = await kapi.join(root, CHAR_CAT);
  if (!(await kapi.exists(catDir))) return out;
  let files = [];
  try { files = await kapi.listFiles(catDir, '.json'); } catch { return out; }
  for (const f of files) {
    try {
      const p = await kapi.join(catDir, f);
      const e = await kapi.readJson(p);
      if (!e || !e.name) continue;
      out.push({ file: p, id: e.id || '', name: e.name,
                 aliases: Array.isArray(e.aliases) ? e.aliases : [], cat: CHAR_CAT });
    } catch (e) { log('warn', t('ui.starter.logWikiReadFail') + f, e); }
  }
  WC.root = state.root; WC.rows = out;
  return out;
}

export async function readEntity(file) {
  try { return await kapi.readJson(file); } catch { return null; }
}

// ───────────────────────── ดึงเข้ามา ─────────────────────────

/**
 * ดึงตัวละครจาก Wiki เข้ามาเป็นตัวละครของ starter
 * รูปประจำตัวถูกก๊อปเข้าโฟลเดอร์ starter ด้วย — ไม่งั้น "พกพาได้" ก็ได้แค่ตัวหนังสือ
 */
export async function charFromWiki(slug, file) {
  const e = await readEntity(file);
  if (!e) return null;
  const patch = charPatchFromEntity(e, file);
  const first = normalizeImage((e.images || [])[0]);
  if (first && first.file) {
    const abs = await kapi.join(state.root, 'Images', ...String(first.file).split('/'));
    if (await kapi.exists(abs)) patch.image = await importImage(slug, abs);
  }
  return newChar(patch);
}

/**
 * [alpha.122] ชื่อที่พิมพ์ตรงกับตัวละครที่มีใน Wiki อยู่แล้ว → เสนอดึงของเดิมมาใช้
 *
 * ผู้ใช้: *"เปิดมางง ทำไมต้องใส่ซ้ำซ้อน ทำไมต้องดึงใน wiki มาแล้วยังต้องกรอก"*
 * ต้นตอ: การเชื่อมกับ Wiki เป็น **ปุ่มที่ต้องกดเอง** เท่านั้น — พิมพ์ชื่อที่มีใน Wiki เป๊ะ ๆ
 * ก็ยังได้การ์ดเปล่า แล้วต้องพิมพ์คำบรรยายใหม่ทั้งที่มีอยู่แล้วในโปรเจกต์
 *
 * ที่นี่ไม่ทำเงียบ ๆ — **ถามก่อนเสมอ** เพราะชื่อซ้ำกันโดยบังเอิญเกิดขึ้นได้
 * และเติมเฉพาะช่องที่ยังว่าง ไม่ทับสิ่งที่ผู้ใช้เพิ่งพิมพ์ไป
 *
 * @returns {Promise<boolean>} จริงเมื่อผูก+เติมข้อมูลแล้ว (คนเรียกเป็นคนบันทึก/วาดใหม่)
 */
export async function autoLinkChar(slug, ch) {
  if (!ch || ch.wikiPath || !String(ch.name || '').trim()) return false;
  const ents = await listWikiChars();
  if (!ents.length) return false;
  const m = matchChar(ch, ents);
  if (!m.hit || (m.status !== MATCH_EXACT && m.status !== MATCH_ALIAS)) return false;
  if (!(await confirmBox(tf('ui.starter.autoLinkAsk', ch.name), t('ui.starter.autoLinkGo')))) {
    return false;
  }
  const got = await charFromWiki(slug, m.hit.file);
  if (!got) { setStatus(t('ui.starter.wikiReadFail')); return false; }
  ch.wikiPath = m.hit.file;
  ch.fromWiki = true;
  // เติมเฉพาะช่องว่าง — ของที่ผู้ใช้พิมพ์ไว้เองสำคัญกว่าของใน Wiki เสมอ
  for (const k of ['persona', 'blurb', 'selfPronoun', 'image', 'shortcode', 'dialogue']) {
    if (!String(ch[k] || '').trim() && String(got[k] || '').trim()) ch[k] = got[k];
  }
  if (!((ch.aliases || []).length)) ch.aliases = [...(got.aliases || [])];
  if (!((ch.tags || []).length)) ch.tags = [...(got.tags || [])];
  if (!((ch.prompts || []).length)) ch.prompts = [...(got.prompts || [])];
  return true;
}

/** กล่องเลือกตัวละครจาก Wiki (มีช่องค้นหา เพราะโปรเจกต์จริงมีเป็นร้อย) */
export function pickWikiChar() {
  return new Promise(async (resolve) => {
    const rows = await listWikiChars();
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog st-pick');
    box.append(el('div', 'k-dlg-title', t('ui.starter.pickFromWiki')));
    const done = (v) => { ov.remove(); resolve(v); };

    if (!rows.length) {
      box.append(el('div', 'st-dim', t('ui.starter.wikiNoChar')));
    }
    const search = el('input', 'wiki-input');
    search.placeholder = t('ui.starter.searchName');
    const list = el('div', 'st-pick-list');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      const hit = rows.filter((r) => !q
        || [r.name, ...(r.aliases || [])].join(' ').toLowerCase().includes(q));
      for (const r of hit.slice(0, 200)) {
        const b = el('button', 'st-pick-item');
        b.append(el('span', 'st-pick-name', r.name));
        if ((r.aliases || []).length) b.append(el('span', 'st-dim', ' · ' + r.aliases.join(', ')));
        b.onclick = () => done(r.file);
        list.append(b);
      }
      if (!hit.length && rows.length) list.append(el('div', 'st-dim', t('ui.starter.noMatch')));
    };
    search.oninput = draw;
    box.append(search, list);
    const foot = el('div', 'k-dlg-foot');
    const cancel = el('button', null, t('ui.common.cancel'));
    cancel.onclick = () => done(null);
    foot.append(cancel);
    box.append(foot);
    ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    document.body.append(ov);
    draw();
    search.focus();
  });
}

// ───────────────────────── เขียนกลับ ─────────────────────────

/** ก๊อปรูปของ starter เข้าคลังรูปโปรเจกต์ → คืนชื่อไฟล์สัมพัทธ์กับ Images/ */
async function imageIntoProject(slug, file) {
  if (!file) return '';
  try {
    const src = await kapi.join(await imagesDir(slug), file);
    if (!(await kapi.exists(src))) return '';
    const dst = await kapi.join(state.root, 'Images');
    await kapi.mkdir(dst);
    return (await kapi.copyInto(src, dst)) || '';
  } catch (e) { log('warn', t('ui.starter.logImgFail'), e); return ''; }
}

/**
 * บันทึกตัวละครหนึ่งตัวลง Wiki — สร้างใหม่ หรืออัปเดตตัวที่ผูกไว้แล้ว
 * @returns {Promise<string>} path ของ entity ('' = ไม่สำเร็จ)
 */
export async function pushCharToWiki(slug, ch) {
  if (!ch || !String(ch.name || '').trim()) return '';
  const root = await wikiRoot();
  const catDir = await kapi.join(root, CHAR_CAT);
  await kapi.mkdir(catDir);

  const imgFile = await imageIntoProject(slug, ch.image);
  const images = imgFile ? [normalizeImage({ file: imgFile })] : [];

  // ผูกไว้แล้วและไฟล์ยังอยู่ → อัปเดต ไม่สร้างซ้ำ
  if (ch.wikiPath && await kapi.exists(ch.wikiPath)) {
    const old = await readEntity(ch.wikiPath);
    if (old) {
      const merged = applyCharToEntity(old, ch);
      if (images.length && !(old.images || []).length) merged.images = images;
      await kapi.writeFile(ch.wikiPath, JSON.stringify(merged, null, 2));
      invalidateWikiChars();                    // [alpha.124 ข้อ 21] เขียนแล้วแคชล้าสมัยทันที
      return ch.wikiPath;
    }
  }

  const e = entityFromChar(ch, { id: guid(), cat: CHAR_CAT, images });
  const file = await kapi.join(catDir,
    safeName(ch.name) + '-' + Date.now().toString(36) + '.json');
  await kapi.writeFile(file, JSON.stringify(e, null, 2));
  invalidateWikiChars();                        // [alpha.124 ข้อ 21]
  return file;
}

/**
 * บันทึกทั้งวงลง Wiki (เรียกตอนกด "เสร็จสิ้น" และตอนกดปุ่มในขั้นตัวละคร)
 * @returns {Promise<{saved:number, failed:number}>}
 */
export async function syncCastToWiki(s) {
  let saved = 0, failed = 0;
  for (const ch of (s.cast || [])) {
    try {
      const p = await pushCharToWiki(s.slug, ch);
      if (p) { ch.wikiPath = p; saved++; } else failed++;
    } catch (e) { failed++; log('error', t('ui.starter.logWikiWriteFail') + ch.name, e); }
  }
  if (saved) { await writeStarter(s); await buildTree(); }
  return { saved, failed };
}

// ───────────────────────── ย้ายโปรเจกต์: จับคู่อัตโนมัติ ─────────────────────────

/**
 * starter ตัวนี้ "มาจากโปรเจกต์อื่น" ไหม — ดูจากตัวละครที่มี wikiPath แต่ path นั้นไม่มีจริง
 * ใช้เป็นตัวจุดชนวนเสนอให้ผู้ใช้จับคู่ ไม่ใช่ทำเงียบ ๆ เอง
 */
export async function looksForeign(s) {
  for (const ch of (s.cast || [])) {
    if (ch.wikiPath && !(await kapi.exists(ch.wikiPath))) return true;
  }
  return false;
}

/**
 * จับคู่ตัวละครกับ Wiki ของโปรเจกต์ปัจจุบัน แล้วลงมือตามแผน
 * แถวที่ระบบเดาไม่ได้ (ชื่อชนกันหลายตัว) จะถูกยกให้ผู้ใช้เลือกในกล่อง
 */
export async function reconcileCast(s, { silent = false } = {}) {
  const ents = await listWikiChars();
  const rows = planMerge(s.cast || [], ents);
  if (!rows.length) return { link: 0, create: 0, skip: 0 };

  let plan = rows;
  if (!silent && (needsAttention(rows) || rows.some((r) => r.action === ACT_CREATE))) {
    plan = await reconcileDialog(rows);
    if (!plan) return null;                     // ผู้ใช้ยกเลิก
  }

  for (const r of plan) {
    if (r.action === ACT_LINK && r.hit) {
      r.char.wikiPath = r.hit.file;
      // ดึงคำบรรยายจากฝั่ง Wiki มาเติมเฉพาะตอนที่ฝั่ง starter ว่าง — ไม่ทับของที่มีอยู่
      if (!String(r.char.persona || '').trim()) {
        const e = await readEntity(r.hit.file);
        if (e) r.char.persona = charPatchFromEntity(e, r.hit.file).persona;
      }
      s.cast = upsertChar(s.cast, r.char);
    } else if (r.action === ACT_CREATE) {
      const p = await pushCharToWiki(s.slug, r.char);
      if (p) { r.char.wikiPath = p; s.cast = upsertChar(s.cast, r.char); }
    }
    // ACT_SKIP = ไม่ยุ่ง เก็บไว้ใน starter อย่างเดียว (ยังเล่นได้ครบ)
  }
  await writeStarter(s);
  await buildTree();
  const sum = mergeSummary(plan);
  setStatus(tf('ui.starter.reconcileDone', sum.link, sum.create));
  return sum;
}

/** กล่องให้ผู้ใช้ตรวจแผนก่อนลงมือ — หนึ่งแถวต่อหนึ่งตัวละคร */
function reconcileDialog(rows) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide st-merge');
    box.append(el('div', 'k-dlg-title', t('ui.starter.reconcileTitle')));
    box.append(el('div', 'st-hint', t('ui.starter.reconcileHint')));
    const done = (v) => { ov.remove(); resolve(v); };

    for (const r of rows) {
      const line = el('div', 'st-merge-row' + (r.needsUser ? ' warn' : ''));
      line.append(el('span', 'st-merge-name', r.char.name));
      line.append(el('span', 'st-merge-status', matchLabel(r.status)));

      const sel = el('select', 'wiki-input k-dlg-select');
      const opts = [[ACT_LINK, t('ui.starter.mgLink')],
                    [ACT_CREATE, t('ui.starter.mgCreate')],
                    [ACT_SKIP, t('ui.starter.mgSkip')]];
      for (const [v, label] of opts) {
        // "ผูกกับของเดิม" เลือกได้ต่อเมื่อมีตัวให้ผูกจริง
        if (v === ACT_LINK && !r.candidates.length) continue;
        const o = el('option', null, label); o.value = v; sel.append(o);
      }
      sel.value = r.action;
      sel.onchange = () => { r.action = sel.value; syncTarget(); };
      line.append(sel);

      // ชนกันหลายตัว → ต้องเลือกด้วยว่าผูกกับตัวไหน
      const target = el('select', 'wiki-input k-dlg-select st-merge-target');
      for (const c of r.candidates) {
        const o = el('option', null, c.name + (c.aliases && c.aliases.length ? ' (' + c.aliases.join(',') + ')' : ''));
        o.value = c.file; target.append(o);
      }
      if (r.hit) target.value = r.hit.file;
      target.onchange = () => { r.hit = r.candidates.find((c) => c.file === target.value) || null; };
      const syncTarget = () => {
        target.style.display = (r.action === ACT_LINK && r.candidates.length > 1) ? '' : 'none';
        if (r.action === ACT_LINK && !r.hit) r.hit = r.candidates[0] || null;
      };
      line.append(target);
      syncTarget();
      box.append(line);
    }

    const foot = el('div', 'k-dlg-foot');
    const cancel = el('button', null, t('ui.common.cancel'));
    cancel.onclick = () => done(null);
    const ok = el('button', 'k-ok', t('ui.starter.reconcileGo'));
    ok.onclick = () => done(rows);
    foot.append(cancel, ok);
    box.append(foot);
    ov.append(box);
    document.body.append(ov);
  });
}

/** เสนอจับคู่เมื่อเปิด starter ที่ย้ายมาจากโปรเจกต์อื่น */
export async function offerReconcile(s) {
  if (!(await looksForeign(s))) return false;
  const yes = await confirmBox(tf('ui.starter.foreignAsk', s.name || s.slug),
                               t('ui.starter.reconcileGo'));
  if (!yes) return false;
  await reconcileCast(s);
  return true;
}
