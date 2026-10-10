// section-ops.js — จัดการเล่ม (section): เพิ่ม/แก้ชื่อ/ลบ/เรียง/สถิติ/บันทึก meta
import { buildLoglineFields } from './logline-ui.js';
import { compactLogline } from './logline.js';
import { t as tt, tf as ttf, t, tf } from './i18n.js';
import { buildTree, closeTab, guid, refreshNetwork, closeTabsUnderPath } from './app.js';
import { el, setStatus, state, log, logAction } from './core.js';
// [alpha.170] ชื่อเล่ม = ชื่อโฟลเดอร์เสมอ (disk-names.js · disk-sync.js)
import { freeBookName, sectionRenameTarget, renameSectionOnDisk } from './disk-sync.js';
import { diskBase, defaultBookName, isReservedRoot } from './disk-names.js';
/** เหตุผลที่ชื่อเล่มนี้ใช้ไม่ได้ — ชื่อสงวนของโปรแกรม (โฟลเดอร์อาจยังไม่ถูกสร้าง) บอกคนละแบบกับ "มีโฟลเดอร์ชื่อนี้แล้ว" */
const bookTakenMsg = (name) => ttf(isReservedRoot(name) ? 'ui.names.bookNameReserved' : 'ui.names.bookExists', name);
import { movePathWithTabs } from './tab-bridge.js';

// [alpha.60r3 ข้อ 3] สถานะเล่ม — ต้องตรงกับ SECTION_STATUSES ใน app.js
// (คัดลอกคู่ key/label มาไว้ที่นี่เพื่อไม่ต้อง import วนกลับไปหา app.js เพิ่มอีกตัว)
const SECTION_STATUS_OPTS = [
  ['outline', tt('ui.common.outlineStory')], ['drafting', tt('ui.common.busyWrite')], ['revising', tt('ui.common.busyEdit')],
  ['done', tt('ui.common.writeEnd')], ['published', tt('ui.common.printDone')],
];
import { ask, confirmBox, toast } from './ui.js';
import { countWords, parseMdFile } from './md.js';
import { mutateJson } from './json-store.js';   // [alpha.159 · M1]

/** ย้ายเล่ม fromFolder ไปไว้ก่อน dstFolder · [alpha.168] dstFolder = null → ท้ายสุด */
export async function reorderSections(fromFolder, dstFolder) {
  const secs = await listSections();
  const fromIdx = secs.findIndex((s) => s.folder === fromFolder);
  const dstIdx = dstFolder == null ? secs.length : secs.findIndex((s) => s.folder === dstFolder);
  if (fromIdx < 0 || dstIdx < 0) return;
  const [moved] = secs.splice(fromIdx, 1);
  const insertAt = dstFolder == null ? secs.length : secs.findIndex((s) => s.folder === dstFolder);
  secs.splice(insertAt, 0, moved);
  let order = 1;
  for (const s of secs) await saveSectionMeta(s.sf, { order: order++ });
  await buildTree(); setStatus(tt('ui.section.reorderBookNewDone'));
}

export async function listSections() {
  const out = [];
  for (const nm of await kapi.listDirs(state.root)) {
    const secPath = await kapi.join(state.root, nm);
    const sf = await kapi.join(secPath, 'section.json');
    if (!(await kapi.exists(sf))) continue;
    let meta = {}; try { meta = await kapi.readJson(sf); } catch {}
    out.push({ folder: nm, secPath, sf, meta,
               title: meta.title || nm, order: meta.order || 0 });
  }
  out.sort((a, b) => (a.order || 0) - (b.order || 0));
  return out;
}

export async function sectionStats(secPath) {
  let chapters = 0, scenes = 0, words = 0, drafts = 0;
  const sf = await kapi.join(secPath, 'section.json');
  let meta = {}; try { meta = await kapi.readJson(sf); } catch {}
  const draftRoot = await kapi.join(secPath, 'Draft');
  if (await kapi.exists(draftRoot)) {
    for (const dn of await kapi.listDirs(draftRoot)) {
      const dPath = await kapi.join(draftRoot, dn);
      const df = await kapi.join(dPath, 'draft.json');
      if (!(await kapi.exists(df))) continue;
      drafts++;
      const chs = (await kapi.readJson(df)).chapters || [];
      const scAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
      chapters += chs.length;
      for (const ch of chs) for (const sc of scAll[ch.guid] || []) {
        if (sc.type === 'memo') continue;
        scenes++;
        try { const { body } = parseMdFile(await kapi.readFile(
          await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName)));
          words += countWords(body); } catch {}
      }
    }
  }
  return { chapters, scenes, words, drafts,
           primaryDraft: (meta.primaryDraft || 'default') };
}

export async function saveSectionMeta(sf, patch) {
  // [alpha.159 · M1] อ่านสด-แก้-เขียนในคิวของไฟล์ (ไม่ทับค่าที่อีกทางเพิ่งเขียน เช่น ร่างหลัก)
  const r = await mutateJson(kapi, sf, (d) => { Object.assign(d, patch); }, { fallback: {} });
  return r.data;
}

/**
 * เพิ่มเล่มใหม่
 * @param {string} [preset]  ส่งชื่อมา = ข้ามกล่องถาม (ตัวแปลงอัตโนมัติใช้ทางนี้ — [alpha.95])
 *                           ไม่ส่ง = ถามผู้ใช้เหมือนเดิมทุกประการ
 * @returns {Promise<string>} path ของโฟลเดอร์เล่ม ('' = ผู้ใช้ยกเลิก)
 */
export async function addSection(preset) {
  // ══ [alpha.170] ★ ชื่อเล่ม = ชื่อโฟลเดอร์ ══
  // ชนกับโฟลเดอร์อื่น (เล่มอื่น · โฟลเดอร์ของโปรแกรมอย่าง Wiki/Images/Recycle — เทียบไม่สนตัวพิมพ์):
  //   ผู้ใช้พิมพ์เอง = บอกแล้วให้ตั้งใหม่ (ชื่อที่พิมพ์ค้างไว้ในช่อง) · ทางอัตโนมัติ (preset) = ต่อเลขให้ทั้งชื่อและโฟลเดอร์
  // เว้นว่างแล้วกดตกลง = ชื่อเริ่มต้น `Book N` ที่ยังว่าง (ชื่อโฟลเดอร์เป็นอังกฤษเสมอ ไม่ตามภาษาของหน้าจอ)
  let title = '', folder = '';
  if (preset) { const b = await freeBookName(kapi, state.root, String(preset)); title = b.title; folder = b.folder; }
  else {
    const suggest = defaultBookName(await kapi.listDirs(state.root));
    let value = suggest;
    for (;;) {
      const v = await ask(tt('ui.section.nameBookNew'), { placeholder: suggest, value });
      if (!v || !String(v).trim()) return '';
      const b = await freeBookName(kapi, state.root, String(v).trim());
      if (!b.taken) { title = b.title; folder = b.folder; break; }
      toast(bookTakenMsg(diskBase(v)), { level: 'warn' });
      value = String(v).trim();
    }
  }
  const dir = await kapi.join(state.root, folder);
  // ลำดับเล่มถัดจากเล่มที่มีอยู่
  let maxOrder = 0;
  for (const nm of await kapi.listDirs(state.root)) {
    const sp = await kapi.join(state.root, nm, 'section.json');
    if (await kapi.exists(sp)) maxOrder = Math.max(maxOrder, (await kapi.readJson(sp)).order || 0);
  }
  await kapi.writeFile(await kapi.join(dir, 'section.json'),
    JSON.stringify({ guid: guid(), title, order: maxOrder + 1, folderName: folder }, null, 2));
  const dr = await kapi.join(dir, 'Draft', 'default');
  const ch = { guid: guid(), title: tt('ui.common.chapterOne2'), order: 1, status: 'Outline', act: 'I',
               date: '', isFavorite: false, folderName: diskBase(tt('ui.common.chapterOne2'), 'chapter') };
  await kapi.writeFile(await kapi.join(dr, 'draft.json'), JSON.stringify({ chapters: [ch] }, null, 2));
  await kapi.writeFile(await kapi.join(dr, 'scenes.json'), JSON.stringify({ chapters: { [ch.guid]: [] } }, null, 2));
  await kapi.mkdir(await kapi.join(dr, 'Chapters', ch.folderName));
  await buildTree(); setStatus(tt('ui.section.addBook') + title);
  refreshNetwork();
  return dir;
}

export async function renameSection(secPath, sec) {
  const title = await ask(tt('ui.section.nameBookNew'), { value: sec.title }); if (!title || title === sec.title) return;
  const to = await setSectionTitle(secPath, title);
  if (to) setStatus(tt('ui.section.changeNameBook') + title);
  return to;
}

/**
 * [alpha.170] ★ ตั้งชื่อเล่ม — ทางเดียวของทุกที่ที่เปลี่ยนชื่อเล่ม (เมนู · กล่องคุณสมบัติ · จัดการเล่ม)
 *
 * เดิม "เก็บชื่อโฟลเดอร์เดิมไว้" → เปลี่ยนชื่อเล่มครั้งเดียว ชื่อเล่มกับโฟลเดอร์ไม่ตรงกันตลอดไป
 * (ผู้ใช้เปิดโฟลเดอร์งานแล้วหาเล่มไม่เจอ) · ตอนนี้ย้ายโฟลเดอร์ตาม: แท็บใต้เล่มถูกบันทึก ปิด แล้วเปิดกลับที่ทางใหม่ ·
 * ประวัติเวอร์ชันย้ายตาม · ชื่อชนกับโฟลเดอร์อื่น = ไม่ทำ (บอกผู้ใช้)
 * @returns {Promise<string|false>} ทางของโฟลเดอร์เล่มหลังเปลี่ยนชื่อ (false = ไม่ได้เปลี่ยน)
 */
export async function setSectionTitle(secPath, title) {
  title = String(title || '').trim();
  if (!title) return false;
  let res = null;
  try {
    const tg = await sectionRenameTarget(kapi, secPath, title);
    if (tg.taken) {
      toast(bookTakenMsg(tg.folder), { level: 'warn' });
      setStatus(bookTakenMsg(tg.folder));
      return false;
    }
    const run = async () => { res = await renameSectionOnDisk(kapi, secPath, title); return res.moved ? res.to : null; };
    if (tg.moves) { if (!(await movePathWithTabs(secPath, run)).ok) return false; }
    else await run();
  } catch (e) {
    log('warn', ttf('ui.names.renameFail', title), e);
    setStatus(ttf('ui.names.renameFail', title));
    return false;
  }
  if (!res || !res.ok) return false;
  if (res.moved) {
    const nm = (p) => String(p || '').split(/[\\/]/).pop() || '';
    logAction('section', ttf('ui.names.logRenamed', nm(res.from), nm(res.to)), { from: res.from, to: res.to });
    try { const { bumpBookFlow } = await import('./read-ui.js'); bumpBookFlow(); } catch {}
  }
  await buildTree(); refreshNetwork();
  return res.to;
}

/**
 * [alpha.60r3 ข้อ 3] คุณสมบัติของ "เล่ม" — ปก/คำโปรย/สถานะ เคยแก้ได้เฉพาะในหน้าจัดการเล่ม
 * (ผู้ใช้ที่ทำงานอยู่ใน Explorer ต้องเปิดหน้าใหญ่ทั้งหน้าเพื่อแก้คำโปรยบรรทัดเดียว)
 * ปกเก็บเป็น path สัมพัทธ์ `../Images/<ไฟล์>` แบบเดียวกับ Book Manager — ห้ามเก็บ path เต็ม
 * @returns {Promise<boolean>} true = บันทึกจริง
 */
export async function sectionProps(secPath, sec) {
  const sf = await kapi.join(secPath, 'section.json');
  let d = {};
  try { d = await kapi.readJson(sf); } catch { setStatus(tt('ui.section.readSectionJsonCant')); return false; }

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-section-props');
  box.append(el('div', 'k-dlg-title', tt('ui.section.propsBook') + (d.title || sec?.title || '')));
  const mk = (label, val, tag = 'input') => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const i = el(tag, 'wiki-input'); i.value = val == null ? '' : String(val);
    r.append(i); box.append(r); return { row: r, input: i };
  };
  const iTitle = mk(tt('ui.section.nameBook'), d.title || sec?.title || '').input;
  const rStatus = el('div', 'wiki-row'); rStatus.append(el('label', null, tt('ui.common.status')));
  const iStatus = el('select', 'wiki-input k-dlg-select');
  for (const [k, label] of SECTION_STATUS_OPTS) {
    const o = el('option', null, label); o.value = k;
    if (k === (d.status || 'outline')) o.selected = true;
    iStatus.append(o);
  }
  rStatus.append(iStatus); box.append(rStatus);
  const iBlurb = mk(tt('ui.section.wordBlurb'), d.blurb || '', 'textarea').input;
  iBlurb.placeholder = tt('ui.section.textShortUseSuggest');
  const iOrder = mk(tt('ui.section.orderBook'), d.order || '').input;
  iOrder.type = 'number'; iOrder.min = '1';

  // ---- ปก ----
  const coverRow = el('div', 'wiki-row');
  coverRow.append(el('label', null, tt('ui.section.cover')));
  const coverName = el('span', 'k-sec-cover-name', d.cover || tt('ui.section.notHasCover'));
  const pickBtn = el('button', null, tt('ui.section.pickImage')); pickBtn.type = 'button';
  const clrBtn = el('button', null, tt('ui.section.coverOut')); clrBtn.type = 'button';
  coverRow.append(coverName, pickBtn, clrBtn); box.append(coverRow);
  let cover = d.cover || '';
  pickBtn.onclick = async () => {
    const { pickImage } = await import('./gallery.js');
    const f = await pickImage(state.root);
    if (!f) return;
    // [alpha.63] pickImage คืน `{file}` = path สัมพัทธ์กับ Images/ (อัลบั้มย่อยรวมอยู่ในนี้)
    // ของเดิมเขียน `String(f).split(...)` ซึ่งได้ "[object Object]" — ปกไม่เคยขึ้นเลย
    cover = '../Images/' + f.file;
    coverName.textContent = cover;
  };
  clrBtn.onclick = () => { cover = ''; coverName.textContent = tt('ui.section.notHasCover'); };

  // ══ [alpha.141] ★ "ใช้หน้าปกเล่ม" + "อ่านทั้งเล่ม" ══
  // ผู้ใช้: *"ให้เพิ่ม อ่านทั้งเล่ม ลงไปใน properties ของเล่มใน explorer และในจัดการเล่มด้วย"*
  // หน้าปกเล่มเปิดเป็นค่าเริ่มต้น (โหมดอ่านต้องเริ่มที่หน้าปกเสมอ) — ปิดได้ถ้าไม่อยากให้นับเป็นหน้า
  const onRow = el('div', 'wiki-row');
  onRow.append(el('label', null, tt('ui.section.useCover')));
  const iCoverOn = el('input', 'wiki-flowchk');
  iCoverOn.type = 'checkbox';
  iCoverOn.checked = d.coverOn === undefined ? true : !!d.coverOn;
  onRow.append(iCoverOn); box.append(onRow);

  // ★ [alpha.142 ข้อ 1] "ใช้ภาพเต็มหน้า" + hint ขนาดรูปที่แนะนำตามกระดาษที่เลือกอยู่
  const fullRow = el('div', 'wiki-row');
  fullRow.append(el('label', null, tt('ui.section.useCoverFull')));
  const iCoverFull = el('input', 'wiki-flowchk');
  iCoverFull.type = 'checkbox';
  iCoverFull.checked = d.coverFull === undefined ? true : !!d.coverFull;
  fullRow.append(iCoverFull); box.append(fullRow);
  {
    const { coverHintLine } = await import('./chapters-ui.js');
    box.append(el('div', 'k-hint k-sec-covhint', coverHintLine()));
  }

  // [alpha.157] Logline ของเล่ม — ช่องที่เว้นว่างใช้ของโปรเจกต์ (ตัวจางในช่องคือค่าที่จะตกไปใช้)
  const loglineUi = buildLoglineFields(box, d.logline, { placeholderFrom: state.meta && state.meta.logline });

  const readRow = el('div', 'wiki-row k-sec-readrow');
  readRow.append(el('label', null, tt('ui.readbook.label')));
  const readBtn = el('button', 'k-sec-read', tt('ui.readbook.button'));
  readBtn.type = 'button';
  readBtn.onclick = async () => {
    const { openBookReader } = await import('./read-ui.js');
    openBookReader(secPath);
  };
  readRow.append(readBtn); box.append(readRow);

  return new Promise((resolve) => {
    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', 'k-cancel', tt('ui.common.cancel'));
    const okB = el('button', 'k-ok', tt('ui.common.save'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    const close = (v) => { ov.remove(); resolve(v); };
    cB.onclick = () => close(false);
    ov.onclick = (e) => { if (e.target === ov) close(false); };
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    okB.onclick = async () => {
      // [alpha.170] ชื่อเล่มเขียนผ่าน setSectionTitle (ย้ายโฟลเดอร์ให้ตรงชื่อ) — ไม่สำเร็จ = ไม่ปิดกล่อง ยังไม่เขียนค่าอื่น
      const title = iTitle.value.trim();
      let sfNow = sf;
      if (title && title !== (d.title || '')) {
        const to = await setSectionTitle(secPath, title);
        if (!to) return;
        sfNow = await kapi.join(to, 'section.json');
        d.title = title;
      }
      d.status = iStatus.value;
      const blurb = iBlurb.value.trim();
      if (blurb) d.blurb = blurb; else delete d.blurb;
      if (cover) d.cover = cover; else delete d.cover;
      // ค่าเริ่มต้น (เปิด) ไม่ต้องเขียนลงไฟล์ — กันคีย์รกในโปรเจกต์ที่ไม่เคยแตะเรื่องนี้
      if (iCoverOn.checked) delete d.coverOn; else d.coverOn = false;
      if (iCoverFull.checked) delete d.coverFull; else d.coverFull = false;
      const ord = parseInt(iOrder.value, 10);
      if (Number.isFinite(ord) && ord > 0) d.order = ord;
      { const ll = compactLogline(loglineUi.read()); if (ll) d.logline = ll; else delete d.logline; }
      // [alpha.159 · M1] เขียนเฉพาะช่องของกล่องนี้ลงของสดในไฟล์ — `d` ถูกอ่านไว้ตอนเปิดกล่อง
      // (ระหว่างนั้นเปลี่ยนร่างหลัก/ลากลำดับเล่ม = เดิมโดนก้อนเก่าเขียนทับ)
      const OWN = ['status', 'blurb', 'cover', 'coverOn', 'coverFull', 'order', 'logline'];
      await mutateJson(kapi, sfNow, (fresh) => {
        for (const k of OWN) { if (k in d) fresh[k] = d[k]; else delete fresh[k]; }
      }, { fallback: {} });
      // ปก/สถานะของเล่มเปลี่ยน = ลำดับหน้าของทั้งเล่มเปลี่ยน → ทิ้งแคชสายหน้า
      try { const { bumpBookFlow } = await import('./read-ui.js'); bumpBookFlow(); } catch {}
      await buildTree();
      setStatus(tt('ui.section.savePropsBookDone') + (d.title || ''));
      close(true);
    };
  });
}

export async function deleteSection(secPath, sec) {
  // นับเล่มทั้งหมด — กันลบเล่มสุดท้าย (โปรเจกต์ต้องมีอย่างน้อย 1 เล่ม)
  let nSec = 0;
  for (const nm of await kapi.listDirs(state.root))
    if (await kapi.exists(await kapi.join(state.root, nm, 'section.json'))) nSec++;
  if (nSec <= 1) { setStatus(tt('ui.section.delCantMustLess')); return; }
  if (!(await confirmBox(ttf('ui.section.delBookBookAll', sec.title), tt('ui.section.delBook')))) return;
  // ปิดแท็บที่เปิดไฟล์อยู่ในเล่มนี้ก่อน
  // [alpha.156] ★ ต้อง **รอ** ให้บันทึก+ปิดจบก่อนย้ายโฟลเดอร์ — เดิม closeTab() ไม่ await ของแท็บที่ค้าง
  // การบันทึกจึงแข่งกับการย้าย แล้วเขียนไฟล์กลับที่เดิม (โฟลเดอร์ผีไม่มี section.json) ·
  // และ `startsWith(secPath)` ไม่มีตัวคั่น → ลบ "เล่ม1" ไปปิดแท็บของ "เล่ม10" ด้วย
  // [alpha.160 · P0-3] แท็บที่บันทึกไม่ผ่านยังค้าง = ห้ามย้ายเล่ม
  if (!(await closeTabsUnderPath(secPath, { save: true })).ok) { setStatus(tf('ui.app.moveCancelledUnsaved', sec.title)); return; }
  const dst = await kapi.join(state.root, 'Recycle',
    Date.now().toString(36) + '-' + (secPath.split(/[\\/]/).pop()));
  await kapi.move(secPath, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'section', root: state.root, folderName: secPath.split(/[\\/]/).pop() }, null, 2));
  logAction('section', tt('ui.section.delBookDone') + sec.title, { from: secPath, trash: dst });
  await buildTree(); setStatus(tt('ui.section.delBookDone') + sec.title);
  refreshNetwork();
}
