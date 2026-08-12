// section-ops.js — จัดการเล่ม (section): เพิ่ม/แก้ชื่อ/ลบ/เรียง/สถิติ/บันทึก meta
import { T } from './i18n.js';
import { buildTree, closeTab, guid, safeName, refreshNetwork } from './app.js';
import { el, setStatus, state } from './core.js';

// [alpha.60r3 ข้อ 3] สถานะเล่ม — ต้องตรงกับ SECTION_STATUSES ใน app.js
// (คัดลอกคู่ key/label มาไว้ที่นี่เพื่อไม่ต้อง import วนกลับไปหา app.js เพิ่มอีกตัว)
const SECTION_STATUS_OPTS = [
  ['outline', T`โครงเรื่อง`], ['drafting', T`กำลังเขียน`], ['revising', T`กำลังแก้`],
  ['done', T`เขียนจบ`], ['published', T`ตีพิมพ์แล้ว`],
];
import { ask, confirmBox } from './ui.js';
import { countWords, parseMdFile } from './md.js';

export async function reorderSections(fromFolder, dstFolder) {
  const secs = await listSections();
  const fromIdx = secs.findIndex((s) => s.folder === fromFolder);
  const dstIdx = secs.findIndex((s) => s.folder === dstFolder);
  if (fromIdx < 0 || dstIdx < 0) return;
  const [moved] = secs.splice(fromIdx, 1);
  const insertAt = secs.findIndex((s) => s.folder === dstFolder);
  secs.splice(insertAt, 0, moved);
  let order = 1;
  for (const s of secs) await saveSectionMeta(s.sf, { order: order++ });
  await buildTree(); setStatus(T`จัดลำดับเล่มใหม่แล้ว`);
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
  let d = {}; try { d = await kapi.readJson(sf); } catch {}
  Object.assign(d, patch);
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  return d;
}

export async function addSection() {
  const title = await ask(T`ชื่อเล่มใหม่`, { placeholder: T`เช่น เล่มสอง` }); if (!title) return;
  let dir = await kapi.join(state.root, safeName(title));
  if (await kapi.exists(dir)) dir += '-' + Date.now().toString(36).slice(-4);
  // ลำดับเล่มถัดจากเล่มที่มีอยู่
  let maxOrder = 0;
  for (const nm of await kapi.listDirs(state.root)) {
    const sp = await kapi.join(state.root, nm, 'section.json');
    if (await kapi.exists(sp)) maxOrder = Math.max(maxOrder, (await kapi.readJson(sp)).order || 0);
  }
  await kapi.writeFile(await kapi.join(dir, 'section.json'),
    JSON.stringify({ guid: guid(), title, order: maxOrder + 1 }, null, 2));
  const dr = await kapi.join(dir, 'Draft', 'default');
  const ch = { guid: guid(), title: T`บทที่หนึ่ง`, order: 1, status: 'Outline', act: 'I',
               date: '', isFavorite: false, folderName: T`01 - บทที่หนึ่ง` };
  await kapi.writeFile(await kapi.join(dr, 'draft.json'), JSON.stringify({ chapters: [ch] }, null, 2));
  await kapi.writeFile(await kapi.join(dr, 'scenes.json'), JSON.stringify({ chapters: { [ch.guid]: [] } }, null, 2));
  await kapi.mkdir(await kapi.join(dr, 'Chapters', ch.folderName));
  await buildTree(); setStatus(T`เพิ่มเล่ม: ` + title);
  refreshNetwork();
}

export async function renameSection(secPath, sec) {
  const title = await ask(T`ชื่อเล่มใหม่`, { value: sec.title }); if (!title || title === sec.title) return;
  // อัปเดตชื่อใน section.json (เก็บชื่อโฟลเดอร์เดิมไว้ — เลี่ยงย้ายโฟลเดอร์ที่อาจมีแท็บเปิดค้าง)
  const sf = await kapi.join(secPath, 'section.json');
  const d = await kapi.readJson(sf); d.title = title;
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  await buildTree(); setStatus(T`เปลี่ยนชื่อเล่มเป็น: ` + title);
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
  try { d = await kapi.readJson(sf); } catch { setStatus(T`อ่าน section.json ไม่ได้`); return false; }

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-section-props');
  box.append(el('div', 'k-dlg-title', T`คุณสมบัติเล่ม — ` + (d.title || sec?.title || '')));
  const mk = (label, val, tag = 'input') => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const i = el(tag, 'wiki-input'); i.value = val == null ? '' : String(val);
    r.append(i); box.append(r); return { row: r, input: i };
  };
  const iTitle = mk(T`ชื่อเล่ม`, d.title || sec?.title || '').input;
  const rStatus = el('div', 'wiki-row'); rStatus.append(el('label', null, T`สถานะ`));
  const iStatus = el('select', 'wiki-input k-dlg-select');
  for (const [k, label] of SECTION_STATUS_OPTS) {
    const o = el('option', null, label); o.value = k;
    if (k === (d.status || 'outline')) o.selected = true;
    iStatus.append(o);
  }
  rStatus.append(iStatus); box.append(rStatus);
  const iBlurb = mk(T`คำโปรย (Blurb)`, d.blurb || '', 'textarea').input;
  iBlurb.placeholder = T`ข้อความสั้น ๆ ที่ใช้แนะนำเล่มนี้`;
  const iOrder = mk(T`ลำดับเล่ม`, d.order || '').input;
  iOrder.type = 'number'; iOrder.min = '1';

  // ---- ปก ----
  const coverRow = el('div', 'wiki-row');
  coverRow.append(el('label', null, T`ปก`));
  const coverName = el('span', 'k-sec-cover-name', d.cover || T`(ยังไม่มีปก)`);
  const pickBtn = el('button', null, T`🖼 เลือกรูป…`); pickBtn.type = 'button';
  const clrBtn = el('button', null, T`✕ เอาปกออก`); clrBtn.type = 'button';
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
  clrBtn.onclick = () => { cover = ''; coverName.textContent = T`(ยังไม่มีปก)`; };

  return new Promise((resolve) => {
    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', null, T`ยกเลิก`);
    const okB = el('button', 'k-ok', T`บันทึก`);
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    const close = (v) => { ov.remove(); resolve(v); };
    cB.onclick = () => close(false);
    ov.onclick = (e) => { if (e.target === ov) close(false); };
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    okB.onclick = async () => {
      const title = iTitle.value.trim();
      if (title) d.title = title;
      d.status = iStatus.value;
      const blurb = iBlurb.value.trim();
      if (blurb) d.blurb = blurb; else delete d.blurb;
      if (cover) d.cover = cover; else delete d.cover;
      const ord = parseInt(iOrder.value, 10);
      if (Number.isFinite(ord) && ord > 0) d.order = ord;
      await kapi.writeFile(sf, JSON.stringify(d, null, 2));
      await buildTree();
      setStatus(T`บันทึกคุณสมบัติเล่มแล้ว: ` + (d.title || ''));
      close(true);
    };
  });
}

export async function deleteSection(secPath, sec) {
  // นับเล่มทั้งหมด — กันลบเล่มสุดท้าย (โปรเจกต์ต้องมีอย่างน้อย 1 เล่ม)
  let nSec = 0;
  for (const nm of await kapi.listDirs(state.root))
    if (await kapi.exists(await kapi.join(state.root, nm, 'section.json'))) nSec++;
  if (nSec <= 1) { setStatus(T`ลบไม่ได้ — ต้องเหลืออย่างน้อย 1 เล่ม`); return; }
  if (!(await confirmBox(T`ลบเล่ม “${sec.title}” ทั้งเล่ม ? (ทุกบท/ฉากในเล่มจะย้ายไปถังขยะ)`, T`ลบเล่ม`))) return;
  // ปิดแท็บที่เปิดไฟล์อยู่ในเล่มนี้ก่อน
  for (const t of [...state.tabs.keys()]) if (typeof t === 'string' && t.startsWith(secPath)) closeTab(t);
  const dst = await kapi.join(state.root, 'Recycle',
    Date.now().toString(36) + '-' + (secPath.split(/[\\/]/).pop()));
  await kapi.move(secPath, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'section', root: state.root, folderName: secPath.split(/[\\/]/).pop() }, null, 2));
  await buildTree(); setStatus(T`ลบเล่มแล้ว: ` + sec.title);
  refreshNetwork();
}
