// wiki-ui.js — Wiki: หมวด (สร้าง/แก้/ลบ) + เอนทิตี้ (เพิ่ม/เปิด/ทำสำเนา)
import { T } from './i18n.js';
import { INV_C, activate, allCatKeys, applyTemplate, buildTree, catEditDialog, catIcon, catKeyFrom, catLabel, closeTab, entityCreateDialog, fieldLabels, templateOf, findEntityInScenes, guid, invertRole, markDirty, pickFromList, relationDialog, revealFile, safeName, saveProjectMeta, spellChecker, wikiRoot, refreshNetwork } from './app.js';
// บทเรียน 68: ไฟล์นี้มี `for (const t of state.tabs.values())` อยู่แล้ว → import เป็น `tr` เสมอ
import { $, BUILTIN_CATS, el, setStatus, smart, state, t as tr } from './core.js';
import { pickImage } from './gallery.js';
import { confirmBox, ask } from './ui.js';
import { iconHtml } from './icons.js';
import { CAT_TH, WikiEditor } from './wiki.js';
import { ensureAutoLink, renderBacklinksTab, rebuildAutoLink } from './world-story/auto-link-ui.js';
import { notifyEntityRenamed } from './auto-task/event-ui.js';
import { findScenePath } from './project-scan.js';
import { choicesByCharacter, renderChoicePanel } from './player-choices.js';
import { ensureSensory, renderSensoryProfile } from './sensory-profile.js';

export function wikiCats() {
  if (!state.meta) return [];
  if (!Array.isArray(state.meta.wikiCats)) state.meta.wikiCats = [];
  return state.meta.wikiCats;
}

export function applyWikiCats() { for (const c of wikiCats()) if (c.key && c.label) CAT_TH[c.key] = c.label; }

export async function newWikiCat() {
  const res = await catEditDialog({ label: '', icon: '🔖' }, T`สร้างหมวดใหม่`);
  if (!res) return null;
  const key = catKeyFrom(res.label);
  const exist = await allCatKeys();
  if (exist.includes(key)) { setStatus(T`มีหมวดชื่อนี้แล้ว`); return null; }
  wikiCats().push({ key, label: res.label, icon: res.icon || '🔖' });
  await saveProjectMeta(); applyWikiCats();
  await kapi.mkdir(await kapi.join(await wikiRoot(), key));
  await buildTree();
  setStatus(T`สร้างหมวด “` + res.label + T`” แล้ว`);
  return key;
}

export async function editWikiCat(key) {
  const cur = wikiCats().find((c) => c.key === key);
  const res = await catEditDialog({ label: catLabel(key), icon: catIcon(key) }, T`แก้ไขหมวด`);
  if (!res) return;
  if (cur) { cur.label = res.label; cur.icon = res.icon || cur.icon; }
  else wikiCats().push({ key, label: res.label, icon: res.icon || '🔖' });
  await saveProjectMeta(); applyWikiCats();
  await buildTree(); setStatus(T`แก้ไขหมวดแล้ว`);
}

export async function deleteWikiCat(key, catDir) {
  if (BUILTIN_CATS.includes(key)) { setStatus(T`หมวดหลักลบไม่ได้`); return; }
  const files = (await kapi.exists(catDir)) ? await kapi.listFiles(catDir, '.json') : [];
  if (files.length) { setStatus(T`ลบไม่ได้ — ยังมี ${files.length} รายการในหมวดนี้`); return; }
  if (!(await confirmBox(T`ลบหมวด “${catLabel(key)}” ?`, T`ลบหมวด`))) return;
  const arr = wikiCats(); const i = arr.findIndex((c) => c.key === key);
  if (i >= 0) arr.splice(i, 1);
  await saveProjectMeta();
  if (await kapi.exists(catDir)) await kapi.remove(catDir);
  await buildTree(); setStatus(T`ลบหมวดแล้ว`);
}

export async function addEntity(catDir, cat) {
  const tps = state.templates.filter((t) => t.entityTypeKey === cat);
  const res = await entityCreateDialog(cat, tps);
  if (!res) return;
  await kapi.mkdir(catDir);
  const tp = tps.find((t) => t.id === res.templateId) || null;
  const e = { id: guid(), entityTypeKey: cat, name: res.name, aliases: [], fields: {},
              customProperties: {}, images: [], sections: [],
              relationships: [], chapterOverrides: [], templateId: '',
              created: new Date().toISOString() };
  if (tp) applyTemplate(e, tp);
  ensureSensory(e);                     // สถานที่เกิดใหม่มีช่องบรรยากาศรับรู้ตั้งแต่ต้น
  if (!(e.sections || []).length) e.sections = [{ title: T`คำอธิบาย`, content: '' }];
  const file = await kapi.join(catDir, safeName(res.name) + '-' + Date.now().toString(36) + '.json');
  await kapi.writeFile(file, JSON.stringify(e, null, 2));
  await buildTree(); await smart.loadNames(state.root);
  refreshNetwork();
  openEntity(file);
}

export async function openEntity(file) {
  if (state.tabs.has(file)) return activate(file);
  // โหลดชื่อ entity ทั้งหมดก่อนวาด wiki (ถ้ายังไม่เคยโหลด)
  if (!smart.titles || !smart.titles.length) await smart.loadNames(state.root);
  const entity = await kapi.readJson(file);
  ensureSensory(entity);                       // สถานที่ → เตรียมช่อง "บรรยากาศรับรู้"
  const pane = el('div', 'pane wiki-pane');    // wiki-pane = กัน paper-mode ทับ field เนื้อหา
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', entity.name || 'entity'));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file, title: entity.name || 'entity', pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null };
  tab.wiki = new WikiEditor(pane, file, entity, {
    projectRoot: state.root,
    labels: fieldLabels(entity.templateId),
    // [alpha.71 ข้อ 4] หัวการ์ดอ่านจากเทมเพลต — ส่งเป็นฟังก์ชันเพื่อให้เปลี่ยนเทมเพลตแล้วเห็นผลทันที
    template: (e) => templateOf(e && e.templateId),
    entityTitles: () => smart.titles || [],
    fileOfEntity: (n) => smart.fileOf[n] || null,
    invertRole: (r) => (INV_C.m && INV_C.m[r]) || r,
    pickTitle: (items) => pickFromList(T`ผูกความสัมพันธ์กับใคร`, items),
    pickRelation: (items, fromName) => relationDialog(items, fromName),
    onOpenEntity: (f) => openEntity(f),
    pickFromGallery: () => pickImage(state.root),
    getChecker: spellChecker,          // เนื้อหา wiki ตรวจคำผิดได้เหมือน editor นิยาย
    // ---- ประวัติเวอร์ชันของหน้า Wiki (ข้อ 10) — ใช้ระบบ Snapshots เดียวกับฉาก ----
    onVersions: async () => {
      const { fileVersionDialog } = await import('./dialogs.js');
      await fileVersionDialog(file, tab.title, {
        onRestored: async () => {
          // Wiki เป็น JSON → ต้องอ่านใหม่แล้ววาดใหม่ ไม่ใช่ openScene แบบฉาก
          const fresh = await kapi.readJson(file);
          tab.wiki.e = fresh; tab.wiki.dirty = false;
          tab.title = fresh.name || tab.title;
          tab.tabBtn.querySelector('.tab-title').textContent = tab.title;
          tab.wiki.render();
          await buildTree();
        },
      });
    },
    // [alpha.58] หาไฟล์ในดิสก์ — เอนทิตี้เป็นไฟล์ .json แก้นอกโปรแกรมได้ ต้องเปิดโฟลเดอร์เจอ
    onReveal: (f) => revealFile(f),
    // [alpha.60r3 ข้อ 1] คลิกขวาในหน้า Wiki → เมนูรายชื่อฉาก (ทางเดียวกับ Explorer)
    onFindInScenes: (f, name, x, y) => findEntityInScenes(f, name || tab.title, x, y),
    onSnapshot: async () => {
      const { snapshotFile } = await import('./app.js');
      if (tab.wiki.dirty) await tab.wiki.save();
      const label = await ask(T`ตั้งชื่อเวอร์ชัน (เว้นว่างได้)`, { placeholder: T`เช่น ก่อนแก้ประวัติ`, okLabel: T`บันทึกเวอร์ชัน` });
      if (label === null) return;
      await snapshotFile(file, label || T`เวอร์ชัน`);
      setStatus(T`บันทึกเวอร์ชันหน้า Wiki แล้ว`);
    },
    // ---- เปลี่ยนเทมเพลต (ข้อ 18b) — merge fields ไม่ล้างของเดิม ----
    onSwapTemplate: async () => {
      const cat = entity.entityTypeKey || '';
      const tps = state.templates.filter((t) => t.entityTypeKey === cat);
      if (tps.length <= 1) {
        setStatus(T`ไม่มีเทมเพลตอื่นสำหรับหมวดนี้`);
        return false;
      }
      const curId = entity.templateId || '';
      // ใช้ dropdown แทนการกรอกหมายเลข
      const pick = await new Promise((resolve) => {
        const ov = el('div', 'k-overlay');
        const box = el('div', 'k-dialog');
        const opts = tps.map((t) =>
          `<option value="${t.id}"${t.id === curId ? ' selected' : ''}>${t.name || t.id}${t.id === curId ? T` (ปัจจุบัน)` : ''}</option>`
        ).join('');
        box.innerHTML = T`<div class="k-dlg-title">เปลี่ยนเทมเพลต</div>
          <div class="k-hint" style="margin:8px 0">ข้อมูลเดิมจะถูกรักษาไว้ เพิ่มเฉพาะช่องที่ขาดจากเทมเพลตใหม่</div>
          <select id="tp-select" class="k-dlg-select" style="width:100%">${opts}</select>
          <div class="k-dlg-btns"><button class="k-cancel">ยกเลิก</button><button class="k-ok">เปลี่ยนเทมเพลต</button></div>`;
        ov.appendChild(box); document.body.appendChild(ov);
        box.querySelector('.k-cancel').onclick = () => { ov.remove(); resolve(null); };
        ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
        box.querySelector('.k-ok').onclick = () => { const v = box.querySelector('#tp-select').value; ov.remove(); resolve(v); };
        box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { ov.remove(); resolve(null); } });
      });
      if (!pick) return false;
      const newTp = tps.find((t) => t.id === pick);
      if (!newTp) return false;
      applyTemplate(entity, newTp);
      tab.wiki.labels = fieldLabels(entity.templateId);
      tab.wiki.markDirty();
      setStatus(T`เปลี่ยนเทมเพลตเป็น "` + (newTp.name || newTp.id) + T`" แล้ว (ข้อมูลเดิมยังอยู่)`);
      return true;
    },
    onSaved: (e2) => {
      // สำรองอัตโนมัติเหมือนฉาก (ข้าม/ตัดของเก่าตามตั้งค่า autoBackup/maxBackups)
      if (state.settings?.autoBackup !== false) {
        import('./app.js').then(({ snapshotFile }) => snapshotFile(file).catch(() => {}));
      }
      // ชื่อเปลี่ยน → แจ้ง auto-task ให้ไล่แก้ทุกไฟล์ (ทำงานเมื่อเปิด auto-sync)
      if (tab.title && e2.name && tab.title !== e2.name) notifyEntityRenamed(file, tab.title, e2.name);
      tab.title = e2.name;
      tab.tabBtn.querySelector('.tab-title').textContent = e2.name;
      smart.loadNames(state.root); buildTree();
      // [alpha.62 บั๊ก 16] Story Network เป็นแผงแล้ว ไม่ใช่แท็บ
      import('./app.js').then((m) => m.netInst?.refresh()).catch(() => {});
      // [alpha.71 ข้อ 2] เปลี่ยนรูปประจำตัวแล้ว หมุดเอนทิตี้บนแผนที่ต้องเปลี่ยนตามด้วย
      import('./maps-ui.js').then((m) => m.refreshMapsIfOpen()).catch(() => {});
      // ถ้าฝั่งตรงข้ามเปิดอยู่เป็นแท็บ → รีเฟรชให้เห็นความสัมพันธ์ที่เพิ่งซิงก์
      for (const t of state.tabs.values())
        if (t.wiki && t.wiki !== tab.wiki) t.wiki.reloadIfExists?.();
    },
    // WikiEditor.render() ล้าง pane ทุกครั้ง → ต้องเติมแผง backlinks + บรรยากาศรับรู้ กลับหลัง render
    // (attachBacklinks หา .wiki-wrap เองอยู่แล้ว — ส่วน sensory ใช้ wrap ที่ render ส่งมา)
    onRendered: (wrap) => {
      attachBacklinks();
      const w = wrap || pane.querySelector('.wiki-wrap');
      const ent = (tab.wiki && tab.wiki.e) || entity;
      renderSensoryProfile(w, ent, () => tab.wiki && tab.wiki.markDirty());
      attachTaggedImages(w, ent);
    },
  });
  tab.wiki.onDirty(() => markDirty(tab));
  // ---- Backlinks (ข้อ 86): ฉากที่กล่าวถึงเอนทิตี้นี้ ----
  // [alpha.60r3 ข้อ 1] หัวข้อมีปุ่ม 🔄 บังคับสร้างดัชนีใหม่ทั้งชุด
  // (ดัชนีอัปเดตเองทุกครั้งที่บันทึกฉากแล้ว — ปุ่มนี้ไว้ใช้ตอนแก้ไฟล์ .md นอกโปรแกรม)
  function attachBacklinks() { ensureAutoLink().then(() => {
    const wrap = pane.querySelector('.wiki-wrap');
    if (!wrap) return;
    let blSec = wrap.querySelector('.wiki-backlinks');
    if (!blSec) {
      blSec = el('div', 'wiki-backlinks');
      blSec.style.cssText = 'margin-top:24px;padding-top:16px;border-top:1px solid var(--border)';
      const blHead = el('div', 'wiki-bl-head');
      blHead.style.cssText = 'font-weight:600;color:var(--dim);margin-bottom:8px;display:flex;align-items:center;gap:6px';
      const blTitle = el('span');
      blTitle.innerHTML = iconHtml('link', 14) + ' ' + tr('wiki.backlinksTitle', 'ฉากที่กล่าวถึง');
      const reBtn = el('button', 'wiki-bl-refresh', '🔄');
      reBtn.type = 'button';
      reBtn.title = tr('wiki.backlinksRefresh', 'สร้างดัชนีเชื่อมโยงใหม่ทั้งโปรเจกต์');
      reBtn.onclick = async () => {
        reBtn.disabled = true;
        setStatus(tr('wiki.backlinksScanning', 'กำลังสแกนฉากทั้งโปรเจกต์…'));
        try { await rebuildAutoLink(); } finally { reBtn.disabled = false; }
        attachBacklinks();
        setStatus(tr('wiki.backlinksDone', 'อัปเดตดัชนี “ฉากที่กล่าวถึง” แล้ว'));
      };
      blHead.append(blTitle, reBtn);
      blSec.append(blHead);
      const blBody = el('div', 'wiki-bl-body');
      blSec.append(blBody);
      wrap.append(blSec);
    }
    const blBody = blSec.querySelector('.wiki-bl-body');
    renderBacklinksTab(blBody, file, openSceneById);
    attachChoiceHistory(wrap);
  }); }

  /**
   * [alpha.63] รูปในคลังที่ติดแท็ก `@ชื่อเอนทิตี้` → โผล่ในหน้า Wiki อัตโนมัติ
   * (ต่างจาก `entity.images` ที่ผู้ใช้ผูกกับหน้านี้เอง — อันนี้มาจากการติดแท็กในคลังรูป)
   */
  async function attachTaggedImages(wrap, ent) {
    if (!wrap || !ent || !ent.name) return;
    try {
      const AC = await import('./gallery/album-core.js');
      const TG = await import('./gallery/album-tags.js');
      const { imageLightbox } = await import('./wiki.js');
      const all = await AC.allImages(kapi, state.root);
      const hits = TG.imagesForEntity(all, ent.name);
      let sec = wrap.querySelector('.wiki-tagged-imgs');
      if (!hits.length) { if (sec) sec.remove(); return; }
      if (!sec) { sec = el('div', 'wiki-tagged-imgs'); wrap.append(sec); }
      sec.innerHTML = '';
      const head = el('div', 'wiki-bl-head');
      head.innerHTML = iconHtml('image', 14) + T` รูปในคลังที่ติดแท็ก @` + ent.name + ` (${hits.length})`;
      sec.append(head);
      const row = el('div', 'wiki-tagged-row');
      for (const it of hits) {
        const im = el('img', 'wiki-tagged-img');
        im.src = await kapi.toFileURL(await kapi.join(state.root, 'Images', ...it.path.split('/')));
        im.title = (it.caption || it.file) + T`\nคลิกเพื่อขยาย`;
        im.onclick = () => imageLightbox(im.src, it.caption || it.file);
        row.append(im);
      }
      sec.append(row);
    } catch (e) { /* คลังรูปพังต้องไม่ทำหน้า Wiki ล้ม (บทเรียน 89) */ }
  }

  // ไปยังฉากจาก sceneId (ใช้ทั้ง backlinks และประวัติการตัดสินใจ)
  async function openSceneById(sceneId) {
    const { openScene } = await import('./app.js');
    const hit = await findScenePath(state.root, sceneId);
    if (hit && await kapi.exists(hit.path)) openScene(hit.path, hit.title);
    else setStatus(T`ไม่พบไฟล์ฉาก`);
  }

  // ---- ประวัติการตัดสินใจที่เกี่ยวกับตัวละครนี้ (ข้อ 83) ----
  function attachChoiceHistory(wrap) {
    const name = (tab.wiki && tab.wiki.e && tab.wiki.e.name) || tab.title || '';
    if (!name) return;
    if (!choicesByCharacter(name).length) return;      // ไม่มีข้อมูล = ไม่ต้องเพิ่มหัวข้อว่าง
    let sec = wrap.querySelector('.wiki-choices');
    if (!sec) { sec = el('div', 'wiki-choices'); wrap.append(sec); }
    renderChoicePanel(sec, {
      limit: 8, character: name,
      title: T`🎮 การตัดสินใจที่เกี่ยวกับ ` + name,
      onOpenScene: openSceneById,
    });
  }
  attachBacklinks();
  // [alpha.60r3 ข้อ 1] app.js เรียกตัวนี้หลังบันทึกฉาก → รายการ "ฉากที่กล่าวถึง" สดเสมอ
  tab.refreshBacklinks = attachBacklinks;
  tabBtn.onclick = (e) => { if (e.target !== x) activate(file); };
  x.onclick = () => closeTab(file);
  state.tabs.set(file, tab);
  activate(file);
}

export async function duplicateEntity(file) {
  const e = await kapi.readJson(file);
  const dir = file.replace(/[\\/][^\\/]*$/, '');
  const copy = { ...e, id: guid(), name: (e.name || 'entity') + T` (สำเนา)`, created: new Date().toISOString() };
  const nf = await kapi.join(dir, safeName(copy.name) + '-' + Date.now().toString(36) + '.json');
  await kapi.writeFile(nf, JSON.stringify(copy, null, 2));
  await buildTree(); await smart.loadNames(state.root);
  refreshNetwork();
  openEntity(nf);
}
