// Wiki entity editor — โครงข้อมูลเดียวกับ v1 ทุก field (อ่าน-แก้-เขียน ไม่ทำข้อมูลส่วนอื่นหาย)
import { t as tt, tf as ttf, t, tf } from './i18n.js';
import { KEditor } from './editor.js';
import { ask, confirmBox, popupMenu } from './ui.js';
import { iconHtml, icon } from './icons.js';
import { REL_COLOR, REL_LABEL } from './relationship-types.js';
// [alpha.60r2 ข้อ 12] รูปใน entity มีเมทาดาทาแล้ว (คำบรรยาย/alt/title/ขนาด)
// โมดูลบริสุทธิ์ — แปลงรูปแบบเก่า (string[]) ให้อัตโนมัติ ไฟล์เดิมเปิดได้ทุกใบ
import { migrateImages, imageFile, imageAlt, imageLabel, setImageMeta,
         makePrimary, removeImage, addImage, needsImageMigration } from './wiki-images.js';
// [alpha.71 ข้อ 4] หัวการ์ดโปรไฟล์ = ข้อมูลจาก templates.json ล้วน ๆ (ไม่มีชื่อ field เขียนตายในโค้ด)
import { profileData, statusTone } from './wiki-profile.js';
import { CAT_ICON } from './core.js';

export const CAT_TH = { characters: tt('ui.common.character'), locations: tt('ui.common.place'),
                        items: tt('ui.common.thing'), lore: tt('ui.common.legend') };

// กล่องขยายรูป (คลิกที่ไหนก็ปิด · Esc ปิด) — ใช้ร่วมกันทั้ง Wiki และคลังรูป
export function imageLightbox(url, caption) {
  const ov = document.createElement('div'); ov.className = 'k-lightbox';
  const img = document.createElement('img'); img.src = url; img.className = 'k-lightbox-img';
  ov.appendChild(img);
  if (caption) { const c = document.createElement('div'); c.className = 'k-lightbox-cap'; c.textContent = caption; ov.appendChild(c); }
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
  function esc(e) { if (e.key === 'Escape') close(); }
  ov.onclick = close; document.addEventListener('keydown', esc);
  document.body.appendChild(ov);
}

export class WikiEditor {
  constructor(pane, file, entity, { onSaved = null, onDeleted = null,
                                    projectRoot = '', labels = {}, template = null,
                                    entityTitles = () => [], fileOfEntity = () => null,
                                    invertRole = (r) => r, pickTitle = null, pickRelation = null,
                                    onOpenEntity = null, pickFromGallery = null,
                                    getChecker = null, onRendered = null,
                                    onVersions = null, onSnapshot = null,
                                    onSwapTemplate = null, onReveal = null,
                                    onFieldAI = null,
                                    onFindInScenes = null } = {}) {
    this.onRendered = onRendered;
    this.onFindInScenes = onFindInScenes;   // [alpha.60r3 ข้อ 1] คลิกขวา → เมนูรายชื่อฉากที่กล่าวถึง
    this.onVersions = onVersions; this.onSnapshot = onSnapshot;   // ประวัติเวอร์ชันหน้า Wiki (ข้อ 10)
    this.onReveal = onReveal;                                      // [alpha.58] หาไฟล์ในดิสก์
    // [alpha.116 ข้อ 9] ปุ่ม AI คลิกเดียวข้างช่องข้อความ — ไม่ส่งมา = ไม่มีปุ่ม
    this.onFieldAI = onFieldAI;
    this.onSwapTemplate = onSwapTemplate;                          // เปลี่ยนเทมเพลต (ข้อ 18b)
    this.pane = pane; this.file = file; this.e = entity;
    this.projectRoot = projectRoot; this.labels = labels;
    // เทมเพลตของ entity นี้ — ฟังก์ชัน (อ่านสดทุกครั้ง) หรือออบเจกต์ก็ได้
    this._template = template;
    this.entityTitles = entityTitles; this.fileOfEntity = fileOfEntity;
    this.invertRole = invertRole; this.pickTitle = pickTitle; this.pickRelation = pickRelation;
    this.onOpenEntity = onOpenEntity; this.pickFromGallery = pickFromGallery;
    this.getChecker = getChecker;
    this.onSaved = onSaved; this.onDeleted = onDeleted;
    this.dirty = false;
    this.secEditors = [];
    this.render();
  }

  get title() { return this.e.name || 'entity'; }

  /** เทมเพลตปัจจุบัน — อ่านสดทุกครั้งที่วาด (เปลี่ยนเทมเพลตแล้วหัวการ์ดต้องเปลี่ยนตามทันที) */
  get template() {
    try { return typeof this._template === 'function' ? this._template(this.e) : this._template; }
    catch { return null; }
  }

  markDirty() { if (!this.dirty) { this.dirty = true; this._dirtyCb && this._dirtyCb(); } }
  onDirty(cb) { this._dirtyCb = cb; }

  render() {
    const p = this.pane; p.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'wiki-wrap';
    // คลิกขวาทั่ว wiki → เมนูบริบท
    wrap.oncontextmenu = (e) => {
      const target = e.target;
      // คลิกขวาบนลิงก์ (field pill / relationship target) → เปิดหน้า wiki นั้น
      const link = target.closest('.wiki-rel-link');
      if (link) {
        const f = this.fileOfEntity(link.textContent.trim());
        if (f && this.onOpenEntity) {
          e.preventDefault();
          popupMenu(e.clientX, e.clientY, [
            { label: iconHtml('link', 14) + tt('ui.wiki.openPageWiki'), click: () => this.onOpenEntity(f) },
          ]);
          return;
        }
      }
      // คลิกขวาบนชื่อเอนทิตี้ → ค้นหาในฉาก
      if (!target.closest('input') && !target.closest('.ProseMirror') && !target.closest('button')) {
        e.preventDefault();
        const items = [];
        if (this.onOpenEntity) {
          // [alpha.60r3 ข้อ 1] เดิมแค่ "เลื่อนจอลงไปหาแผง backlinks" — ผู้ใช้ที่แผงยังว่าง
          // (ดัชนียังไม่ทันสร้าง) เห็นเหมือนคำสั่งไม่ทำงานเลย
          // ตอนนี้เปิดเมนูรายชื่อฉากตรง ๆ แบบเดียวกับคลิกขวาใน Explorer (findEntityInScenes)
          items.push({ label: iconHtml('link', 14) + tt('ui.common.searchSceneFindOn'), click: async () => {
            if (!this.file) return;
            if (this.onFindInScenes) {
              await this.onFindInScenes(this.file, this.e.name || '', e.clientX, e.clientY);
            } else {
              const { ensureAutoLink } = await import('./world-story/auto-link-ui.js');
              await ensureAutoLink();
              if (this.onRendered) this.onRendered(wrap);
              const bl = wrap.querySelector('.wiki-backlinks');
              if (bl) bl.scrollIntoView({ behavior: 'smooth' });
            }
          }});
        }
        items.push({ label: iconHtml('edit', 14) + tt('ui.wiki.changeName'), click: async () => {
          const nv = await ask(tt('ui.wiki.nameNew'), { placeholder: this.e.name });
          if (nv && nv !== this.e.name) { this.e.name = nv; this.markDirty(); this.render(); }
        }});
        popupMenu(e.clientX, e.clientY, items);
      }
    };
    p.appendChild(wrap);
    const row = (label) => {
      const r = document.createElement('div'); r.className = 'wiki-row';
      const l = document.createElement('label'); l.textContent = label;
      r.appendChild(l); wrap.appendChild(r); return r;
    };
    const input = (val, cb) => {
      const i = document.createElement('input'); i.className = 'wiki-input'; i.value = val;
      i.addEventListener('input', () => { cb(i.value); this.markDirty(); });
      return i;
    };
    // ══ [alpha.116 ข้อ 9] ★ ปุ่ม AI คลิกเดียวข้างช่องข้อความ ══
    //
    // ผู้ใช้: *"ใน wiki ส่วน field ที่เป็น text input ให้มี one click ai ด้วย"*
    //
    // ตัวเรียก AI จริงอยู่ข้างนอก (ส่งมาทาง `onFieldAI`) — ไฟล์นี้ไม่รู้จักผู้ให้บริการเลย
    // ไม่ส่งมา = ไม่มีปุ่มโผล่ (เช่นตอนวาดในหน้าต่างแผงที่แยกออกไป)
    //
    // เขียนค่าคืนด้วยการ **ยิงอีเวนต์ input** ไม่ใช่เรียก cb เอง — ทางเดียวกับที่ผู้ใช้พิมพ์
    // จริง ๆ ทุกประการ (markDirty · ป้ายลิงก์ของ linkedField · ตัวตรวจอื่น ๆ ได้ทำงานครบ)
    const aiFill = (r, i, label) => {
      if (!this.onFieldAI) return null;
      const b = document.createElement('span');
      b.className = 'row-add wiki-ai-btn';
      b.innerHTML = iconHtml('brain', 14);
      b.title = tt('ui.wiki.aiFillTip');
      b.onclick = async (ev) => {
        ev.stopPropagation();
        if (b.classList.contains('busy')) return;      // กันกดรัวแล้วยิงซ้อน
        b.classList.add('busy');
        try {
          const v = await this.onFieldAI({ label, value: i.value, entity: this.e });
          if (v != null && String(v).trim()) {
            i.value = String(v).trim();
            i.dispatchEvent(new Event('input'));
          }
        } catch {} finally { b.classList.remove('busy'); }
      };
      r.appendChild(b);
      return b;
    };
    // ช่องข้อมูลที่ "ลิงก์ได้": ถ้าค่าตรงกับชื่อ entity ใน Wiki → แสดงป้ายคลิกได้ใต้ input
    // (พิมพ์แก้ได้ตามปกติ · รองรับหลายชื่อคั่นด้วย , · คลิกชื่อ = เปิดหน้า Wiki นั้น)
    const linkedField = (labelText, val, cb) => {
      const r = row(labelText);
      const i = input(val, (v) => { cb(v); syncLink(); });
      r.appendChild(i);
      aiFill(r, i, labelText);              // [alpha.116 ข้อ 9] ✨ คลิกเดียวให้ AI เติมช่องนี้
      const linkRow = document.createElement('div');
      linkRow.className = 'wiki-field-links';
      r.appendChild(linkRow);
      const syncLink = () => {
        const names = this.entityTitles();
        const hits = [];
        if (!names.length) { linkRow.innerHTML = ''; return; }
        // ตรวจทั้งแบบตรงทั้งหมดและแบบ substring (ค่า field อาจมีข้อความอื่นปน)
        for (const nm of names) {
          if (!nm || nm === this.e.name) continue;
          const idx = i.value.indexOf(nm);
          if (idx >= 0) hits.push([nm, idx]);
        }
        // ถ้าไม่เจอ substring → ลองเทียบแบบคำ (แยกด้วย ,，、;；\n ช่องว่าง)
        if (!hits.length) {
          const vals = i.value.split(/[,，、;；\n\s]+/).map((s) => s.trim()).filter(Boolean);
          for (const v of vals) {
            const match = names.find((n) => n === v || n.toLowerCase() === v.toLowerCase());
            if (match && !hits.some((h) => h[0] === match)) hits.push([match, i.value.indexOf(match)]);
          }
        }
        // เรียงตามตำแหน่งที่พบ
        hits.sort((a, b) => a[1] - b[1]);
        linkRow.innerHTML = '';
        if (!hits.length) return;
        for (const [nm] of hits) {
          const a = document.createElement('span');
          a.className = 'wiki-rel-link wiki-link-pill';
          a.textContent = nm;
          a.title = tt('ui.wiki.clickOpenPageWiki');
          a.onclick = () => { const f = this.fileOfEntity(nm);
            if (f && this.onOpenEntity) this.onOpenEntity(f); };
          linkRow.appendChild(a);
        }
      };
      i.addEventListener('focus', syncLink);
      i.addEventListener('input', () => setTimeout(syncLink, 100));
      syncLink();
      return r;
    };

    const head = document.createElement('div'); head.className = 'wiki-head';
    const hl = document.createElement('span');
    hl.textContent = (CAT_TH[this.e.entityTypeKey] || this.e.entityTypeKey || 'Wiki');
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = iconHtml('save', 16) + tt('ui.wiki.saveCtrlS');
    saveBtn.onclick = () => this.save().then(() => {
      saveBtn.innerHTML = iconHtml('check', 16) + tt('ui.common.saveDone');
      setTimeout(() => { saveBtn.innerHTML = iconHtml('save', 16) + tt('ui.wiki.saveCtrlS'); }, 1500);
    });
    head.append(hl);
    // ประวัติเวอร์ชันของหน้า Wiki — ระบบเดียวกับฉาก (ข้อ 10)
    if (this.onVersions) {
      const verBtn = document.createElement('button');
      verBtn.className = 'wiki-ver-btn'; verBtn.innerHTML = iconHtml('history', 14) + tt('ui.wiki.historyVersion');
      verBtn.title = tt('ui.wiki.viewRecoverRestoreVersion');
      verBtn.onclick = () => this.onVersions();
      head.append(verBtn);
      const snapBtn = document.createElement('button');
      snapBtn.className = 'wiki-ver-btn'; snapBtn.innerHTML = iconHtml('camera', 14) + tt('ui.wiki.saveVersion');
      snapBtn.title = tt('ui.wiki.saveVersionRename');
      snapBtn.onclick = () => this.onSnapshot && this.onSnapshot();
      head.append(snapBtn);
    }
    // [alpha.121] แทรกโค้ดสั้น (ค่าฟิลด์ของตัวเอง · ความสัมพันธ์ · ข้อมูลจาก Wiki อื่น ·
    // สถิติโปรเจกต์ ฯลฯ) เป็นค่าจริงทันทีลงช่องที่โฟกัสอยู่ล่าสุด — หน้า Wiki ไม่มีขั้นตอน
    // คอมไพล์ทีหลังเหมือนเอกสารนิยาย/บทหนัง จึงแทนค่าเลยแทนที่จะแทรก placeholder ค้าง
    {
      const scBtn = document.createElement('button');
      // คลาสของตัวเอง (ไม่ใช้ .wiki-ver-btn ซ้ำกับ 3 ปุ่มบน) — เทสเดิม [10] นับปุ่มกลุ่มประวัติ/
      // เวอร์ชัน/หาในดิสก์ตายตัวไว้ที่ 3 ตัว ปนกันแล้วเลขจะเพี้ยน · หน้าตายังเหมือนกันผ่าน CSS ร่วม
      scBtn.className = 'wiki-sc-btn'; scBtn.innerHTML = iconHtml('bookmark', 14) + tt('ui.wiki.insertShortcode');
      scBtn.title = tt('ui.wiki.insertShortcodeHint');
      scBtn.onclick = async (e) => {
        const { openResolvedShortcodeMenu, resolveWikiInsertTarget } = await import('./app.js');
        const target = resolveWikiInsertTarget(p);
        await openResolvedShortcodeMenu(e, target);
      };
      head.append(scBtn);
    }
    // [alpha.58] หาไฟล์ในดิสก์ — เปิดโฟลเดอร์ของ .json นี้ใน File Explorer/Finder
    if (this.onReveal) {
      const revBtn = document.createElement('button');
      revBtn.className = 'wiki-ver-btn'; revBtn.innerHTML = iconHtml('folder', 14) + tt('ui.wiki.findDisk');
      revBtn.title = tt('ui.wiki.openFolderKeepFile') + this.file + ')';
      revBtn.onclick = () => this.onReveal(this.file);
      head.append(revBtn);
    }
    // ปุ่มเปลี่ยนเทมเพลต (ข้อ 18b) — merge fields ไม่ล้างของเดิม
    if (this.onSwapTemplate) {
      const tplBtn = document.createElement('button');
      tplBtn.className = 'wiki-tpl-btn'; tplBtn.innerHTML = iconHtml('cog', 14) + tt('ui.wiki.changeTemplate');
      tplBtn.title = tt('ui.wiki.changeTemplateAddField');
      tplBtn.onclick = async () => {
        if (await this.onSwapTemplate()) { this.render(); }
      };
      head.append(tplBtn);
    }
    head.append(saveBtn);
    wrap.appendChild(head);

    // ---- Profile Header (ข้อ 55 · [alpha.71 ข้อ 4] ยกเลิกการฮาร์ดโค้ด) ----
    // เดิม: `if (entityTypeKey === 'characters')` → สถานที่/สิ่งของ/ตำนาน/หมวดที่ผู้ใช้สร้างเอง
    //       ไม่มีรูปประจำตัวเลย ทั้งที่ entity.images[] รองรับมาตลอด
    // ตอนนี้: **ทุกหมวดได้หัวการ์ดเหมือนกันหมด** · จะโชว์ field ไหนใต้ชื่อ อ่านจาก templates.json
    //         (บล็อก `profile`) ไม่ใช่ชื่อ field ที่เขียนตายในโค้ด
    {
      const tpl = this.template || null;
      const P = profileData(this.e, tpl, this.labels || {});
      const prof = document.createElement('div'); prof.className = 'wiki-prof';
      // รูปในวงกลม — images[] เก็บเป็น "ชื่อไฟล์ในโฟลเดอร์ Images" (string) ไม่ใช่ออบเจกต์ {url}
      // เดิมอ่าน images[0].url จึงได้ undefined ตลอด → เห็นแต่ไอคอน 👤 (บั๊กข้อ 2)
      const avatar = document.createElement('div'); avatar.className = 'wiki-prof-avatar';
      avatar.title = tt('ui.wiki.clickSetImagePortrait');
      // ไอคอนสำรองตามหมวด — มาจาก CAT_ICON (ตารางเดียวกับ Explorer) ไม่ใช่ 'user' ตายตัวทุกหมวด
      const fallbackIcon = () => iconHtml(CAT_ICON[this.e.entityTypeKey] || 'bookmark', 32);
      const paintAvatar = async () => {
        avatar.textContent = '';
        const first = migrateImages(this.e.images)[0];
        const name = first ? first.file : '';
        if (!name) { avatar.innerHTML = fallbackIcon(); return; }
        const url = /^(file|https?|data):/i.test(name)
          ? name
          : await kapi.toFileURL(await kapi.join(this.projectRoot, 'Images', name));
        const imgEl = document.createElement('img');
        imgEl.src = url;
        imgEl.alt = imageAlt(first);
        if (first.caption) imgEl.title = first.caption;
        imgEl.onerror = () => { avatar.innerHTML = fallbackIcon(); };
        avatar.appendChild(imgEl);
      };
      paintAvatar();
      // ตั้งรูปประจำตัว = ย้ายรูปที่เลือกไปเป็นตัวแรกของ images[] (คลังรูปยังเก็บครบเหมือนเดิม)
      const setAvatar = (name) => {
        // เพิ่มเข้ารายการก่อน (ถ้ายังไม่มี) แล้วเลื่อนขึ้นเป็นใบแรก — เมทาดาทาของใบเดิมไม่หาย
        const list = addImage(this.e.images, name);
        const i = list.findIndex((x) => x.file === imageFile(name));
        this.e.images = i > 0 ? makePrimary(list, i) : list;
        this.markDirty(); this.render();
      };
      avatar.onclick = async () => {
        const items = [];
        if (this.pickFromGallery) items.push(tt('ui.wiki.pickLibraryImageProject'));
        items.push(tt('ui.wiki.addImageFile'));
        const pick = items.length > 1 && this.pickTitle ? await this.pickTitle(items) : items[items.length - 1];
        if (!pick) return;
        if (pick.startsWith('เลือกจากคลัง')) {
          const it = await this.pickFromGallery();
          if (!it) return;
          setAvatar(it.file || it);
        } else {
          const src = await kapi.openImageDialog(); if (!src) return;
          const dir = await kapi.join(this.projectRoot, 'Images');
          setAvatar(await kapi.copyInto(src, dir));
        }
      };
      avatar.oncontextmenu = (e) => {
        e.preventDefault();
        if (!migrateImages(this.e.images).length) return;
        this.e.images = removeImage(this.e.images, 0);
        this.markDirty(); this.render();
      };
      prof.appendChild(avatar);
      // ข้อมูล — ทุกบรรทัดมาจาก profileData() ซึ่งอ่านจากเทมเพลตล้วน ๆ
      const info = document.createElement('div'); info.className = 'wiki-prof-info';
      const nameEl = document.createElement('div'); nameEl.className = 'wiki-prof-name';
      nameEl.textContent = P.name || tt('ui.common.notNamed');
      info.appendChild(nameEl);
      if (P.aliases.length) {
        const ali = document.createElement('div'); ali.className = 'wiki-prof-aliases';
        P.aliases.forEach((a) => {
          const s = document.createElement('span'); s.textContent = a; ali.appendChild(s);
        });
        info.appendChild(ali);
      }
      // บรรทัดรอง (เทมเพลตบอกว่าใช้ field ไหน — ตัวละคร=บทบาท · สถานที่/สิ่งของ=ประเภท · ตำนาน=หมวด)
      if (P.subtitle) {
        const rl = document.createElement('div'); rl.className = 'wiki-prof-role';
        rl.innerHTML = iconHtml('brain', 14) + ' ' + P.subtitle;
        rl.title = P.subtitleLabel;
        info.appendChild(rl);
      }
      // ป้ายข้อมูลย่อ (badgeFields จากเทมเพลต)
      if (P.badges.length) {
        const bw = document.createElement('div'); bw.className = 'wiki-prof-badges';
        for (const b of P.badges) {
          const s = document.createElement('span'); s.className = 'wiki-prof-badge';
          s.textContent = b.label + ': ' + b.value;
          bw.appendChild(s);
        }
        info.appendChild(bw);
      }
      // สถานะ — ทั้งชื่อ field และคำที่ใช้จัดกลุ่มสี มาจากเทมเพลต (statusField/statusWords)
      if (P.status) {
        const st = document.createElement('span'); st.className = 'wiki-prof-status';
        st.classList.add(statusTone(tpl, P.status));
        st.textContent = P.status;
        st.title = P.statusLabel;
        info.appendChild(st);
      }
      prof.appendChild(info);
      wrap.appendChild(prof);
    }

    // ชื่อ + ชื่อรอง — ช่องพื้นฐานสองช่องนี้ก็ได้ปุ่ม AI เหมือนช่องของเทมเพลต
    const rName = row(tt('ui.common.name'));
    const iName = input(this.e.name || '', (v) => { this.e.name = v; });
    rName.appendChild(iName);
    aiFill(rName, iName, tt('ui.common.name'));
    const rAlias = row(tt('ui.wiki.nameOther'));
    const iAlias = input((this.e.aliases || []).join(', '),
      (v) => { this.e.aliases = v.split(',').map((x) => x.trim()).filter(Boolean); });
    rAlias.appendChild(iAlias);
    aiFill(rAlias, iAlias, tt('ui.wiki.nameOther'));

    // fields จากเทมเพลต (label ไทย) + customProperties (เพิ่ม field เองได้)
    const fields = this.e.fields || {};
    if (Object.keys(fields).length) {
      const fh = document.createElement('div'); fh.className = 'wiki-sub';
      fh.textContent = tt('ui.wiki.dataTemplate');
      wrap.appendChild(fh);
      for (const k of Object.keys(fields)) {
        linkedField(this.labels[k] || k, String(fields[k] ?? ''), (v) => { this.e.fields[k] = v; });
      }
    }
    const ch = document.createElement('div'); ch.className = 'wiki-sub';
    ch.textContent = tt('ui.wiki.dataAdd');
    const addP = document.createElement('span'); addP.className = 'row-add';
    addP.innerHTML = iconHtml('plus', 14); addP.title = tt('ui.wiki.addFieldDataItem');
    addP.onclick = async () => {
      const k = await ask(tt('ui.wiki.nameFieldDataNew'), { placeholder: tt('ui.wiki.egPortrait') });
      if (!k) return;
      (this.e.customProperties = this.e.customProperties || {})[k] = '';
      this.markDirty(); this.render();
    };
    ch.appendChild(addP); wrap.appendChild(ch);
    for (const k of Object.keys(this.e.customProperties || {})) {
      const r = linkedField(k, String(this.e.customProperties[k] ?? ''),
                            (v) => { this.e.customProperties[k] = v; });
      const del = document.createElement('span'); del.className = 'row-add';
      del.innerHTML = iconHtml('x', 14); del.title = tt('ui.wiki.delField');
      del.onclick = () => { delete this.e.customProperties[k]; this.markDirty(); this.render(); };
      r.appendChild(del);
    }

    // คลังรูปของ entity (images[] — ชื่อไฟล์ในโฟลเดอร์ Images ของโปรเจกต์)
    const ih = document.createElement('div'); ih.className = 'wiki-sub';
    ih.textContent = tt('ui.common.image');
    // เลือกจากคลังรูปที่มีอยู่ในโปรเจกต์
    const pickImg = document.createElement('span'); pickImg.className = 'row-add';
    pickImg.innerHTML = iconHtml('image', 14); pickImg.title = tt('ui.wiki.pickLibraryImageProject');
    pickImg.onclick = async () => {
      if (!this.pickFromGallery) return;
      const it = await this.pickFromGallery();
      if (!it) return;
      this.e.images = addImage(this.e.images, it.file || it);
      this.markDirty(); this.render();
    };
    // เพิ่มรูปใหม่จากไฟล์ (คัดลอกเข้าคลัง)
    const addImg = document.createElement('span'); addImg.className = 'row-add';
    addImg.innerHTML = iconHtml('plus', 14); addImg.title = tt('ui.wiki.addImageFileCopy');
    addImg.onclick = async () => {
      const src = await kapi.openImageDialog(); if (!src) return;
      const dir = await kapi.join(this.projectRoot, 'Images');
      const name = await kapi.copyInto(src, dir);
      this.e.images = addImage(this.e.images, name);
      this.markDirty(); this.render();
    };
    ih.append(pickImg, addImg); wrap.appendChild(ih);
    const grid = document.createElement('div'); grid.className = 'wiki-imgs';
    wrap.appendChild(grid);
    // [alpha.60r2 ข้อ 12] แต่ละใบมีคำบรรยาย/ข้อความแทนรูปของตัวเอง — แก้ในที่ได้เลย
    const imgs = migrateImages(this.e.images);
    if (needsImageMigration(this.e.images)) this.e.images = imgs;   // ไฟล์เก่า (string[]) → ออบเจกต์
    imgs.forEach(async (meta, i) => {
      const name = meta.file;
      const cell = document.createElement('div'); cell.className = 'wiki-img';
      const im = document.createElement('img');
      const url = await kapi.toFileURL(await kapi.join(this.projectRoot, 'Images', name));
      im.src = url;
      im.alt = imageAlt(meta);
      im.title = (meta.title || meta.caption || '') + (meta.caption || meta.title ? ' — ' : '') + tt('ui.wiki.clickExpand2');
      im.onclick = () => imageLightbox(url, imageLabel(meta));      // คลิกขยายภาพ
      im.onerror = () => { im.replaceWith(Object.assign(document.createElement('div'),
        { className: 'wiki-img-miss', innerHTML: iconHtml('error', 14) + ' ' + name })); };
      const del = document.createElement('span'); del.className = 'row-add wiki-img-x';
      del.innerHTML = iconHtml('x', 14); del.title = tt('ui.wiki.imageOutFileLibrary');
      del.onclick = (e) => {
        e.stopPropagation();
        this.e.images = removeImage(this.e.images, i);
        this.markDirty(); this.render();
      };
      cell.append(im, del);
      // รูปแรก = รูปในวงกลมโปรไฟล์ → ให้เลือกได้ว่าจะใช้รูปไหน (ข้อ 2)
      const star = document.createElement('span'); star.className = 'row-add wiki-img-star';
      star.innerHTML = iconHtml('star', 14);
      star.title = i === 0 ? tt('ui.wiki.imagePortrait') : tt('ui.wiki.setImagePortraitCircle');
      star.classList.toggle('on', i === 0);
      star.style.opacity = i === 0 ? '1' : '0.4';
      star.onclick = (e) => {
        e.stopPropagation();
        if (i === 0) return;
        this.e.images = makePrimary(this.e.images, i);
        this.markDirty(); this.render();
      };
      cell.append(star);
      // ปุ่มแก้เมทาดาทา (คำบรรยาย · ข้อความแทนรูป · ชื่อกำกับ)
      const edit = document.createElement('span'); edit.className = 'row-add wiki-img-edit';
      edit.innerHTML = iconHtml('edit', 14);
      edit.title = tt('ui.wiki.editCaptionTextReplace');
      edit.onclick = async (e) => {
        e.stopPropagation();
        const cur = migrateImages(this.e.images)[i];
        if (!cur) return;
        const cap = await ask(tt('ui.wiki.captionUnderImageCaption'), { value: cur.caption, allowEmpty: true });
        if (cap === null || cap === undefined) return;
        const alt = await ask(tt('ui.wiki.textReplaceImageAlt'), { value: cur.alt, allowEmpty: true });
        if (alt === null || alt === undefined) return;
        this.e.images = setImageMeta(this.e.images, i, { caption: cap, alt });
        this.markDirty(); this.render();
      };
      cell.append(edit);
      // คำบรรยายใต้รูป — เห็นได้ทันทีว่ารูปนี้คืออะไร
      if (meta.caption || meta.alt) {
        const cap = document.createElement('div'); cap.className = 'wiki-img-cap';
        cap.textContent = meta.caption || meta.alt;
        cap.title = meta.caption || meta.alt;
        cell.append(cap);
      }
      grid.appendChild(cell);
    });

    // ความสัมพันธ์ (sync สองทางตอนบันทึก — เหมือน v1)
    const rh = document.createElement('div'); rh.className = 'wiki-sub';
    rh.textContent = tt('ui.wiki.relation');
    const addR = document.createElement('span'); addR.className = 'row-add';
    addR.innerHTML = iconHtml('plus', 14); addR.title = tt('ui.wiki.addRelation');
    addR.onclick = async () => {
      const others = this.entityTitles().filter((n) => n !== this.e.name);
      if (!others.length) { alert(tt('ui.wiki.notHasEntityOther')); return; }
      let target, role, type = '';
      if (this.pickRelation) {
        const res = await this.pickRelation(others, this.e.name);
        if (!res) return;
        target = res.target; role = res.role; type = res.type || '';
      } else {
        target = this.pickTitle ? await this.pickTitle(others) : null;
        if (!target) return;
        role = await ask(ttf('ui.wiki.msg', this.e.name, target),
                         { placeholder: tt('ui.wiki.eg') });
      }
      if (!target || !role) return;
      // ไม่ระบุประเภท = ไม่เก็บ field เลย (เข้ากันได้กับไฟล์เดิมที่ไม่มี type)
      (this.e.relationships = this.e.relationships || [])
        .push(type ? { targetName: target, role, type } : { targetName: target, role });
      this.markDirty();
      await this.save();          // เขียนไฟล์ + ซิงก์ฝั่งตรงข้ามทันที (v1 semantics)
      this.render();
    };
    rh.appendChild(addR); wrap.appendChild(rh);
    (this.e.relationships || []).forEach((rel, i) => {
      const r = document.createElement('div'); r.className = 'wiki-row';
      const lab = document.createElement('label');
      lab.textContent = '';
      // จุดสีบอกประเภทความสัมพันธ์ (ครอบครัว/คนรัก/ศัตรู…) — ไม่มี type = ไม่มีจุด
      if (rel.type && REL_COLOR[rel.type]) {
        const badge = document.createElement('span');
        badge.className = 'rel-type-dot';
        badge.style.background = REL_COLOR[rel.type];
        badge.title = tt('ui.wiki.type') + (REL_LABEL[rel.type] || rel.type);
        lab.appendChild(badge);
      }
      lab.appendChild(document.createTextNode(rel.role || '—'));
      const val = document.createElement('span'); val.className = 'wiki-rel-target wiki-rel-link';
      val.textContent = rel.targetName || rel.target || '?';
      val.title = tt('ui.wiki.openPageWiki2');
      val.onclick = () => {
        const f = this.fileOfEntity(rel.targetName || rel.target);
        if (f && this.onOpenEntity) this.onOpenEntity(f);
        else alert(tt('ui.wiki.notFoundPageWiki') + (rel.targetName || rel.target));
      };
      const del = document.createElement('span'); del.className = 'row-add';
      del.innerHTML = iconHtml('x', 14); del.title = tt('ui.wiki.delRelationSide');
      del.onclick = () => { this.e.relationships.splice(i, 1); this.markDirty(); this.render(); };
      r.append(lab, val, del); wrap.appendChild(r);
    });

    // sections: หัวข้อ + เนื้อหา (WYSIWYG — เก็บเป็น md ใน content เหมือน v1)
    const sh = document.createElement('div'); sh.className = 'wiki-sub';
    sh.textContent = tt('ui.common.body');
    const addSec = document.createElement('span'); addSec.className = 'row-add';     addSec.innerHTML = iconHtml('plus', 14);
    addSec.title = tt('ui.wiki.addHeading');
    addSec.onclick = async () => {
      const t = await ask(tt('ui.wiki.nameHeadingNew'), { placeholder: tt('ui.wiki.egHistory') });
      if (!t) return;
      this.e.sections = [...(this.e.sections || []), { title: t, content: '' }];
      this.markDirty(); this.render();
    };
    sh.appendChild(addSec); wrap.appendChild(sh);

    this.secEditors = [];
    (this.e.sections || []).forEach((sec, i) => {
      const box = document.createElement('div'); box.className = 'wiki-sec';
      const st = document.createElement('div'); st.className = 'wiki-sec-title';
      const ti = document.createElement('input'); ti.className = 'wiki-input'; ti.value = sec.title || '';
      ti.addEventListener('input', () => { sec.title = ti.value; this.markDirty(); });
      const del = document.createElement('span'); del.className = 'row-add';       del.innerHTML = iconHtml('x', 14);
      del.title = tt('ui.wiki.delHeading2');
      del.onclick = async () => {
        if (!(await confirmBox(ttf('ui.wiki.delHeading', sec.title)))) return;
        this.e.sections.splice(i, 1); this.markDirty(); this.render();
      };
      st.append(ti, del); box.appendChild(st);
      const ed = document.createElement('div'); ed.className = 'wiki-sec-ed';
      box.appendChild(ed);
      const k = new KEditor(ed, { markdown: sec.content || '',
        onChange: () => { this.markDirty(); },
        // ให้เนื้อหา wiki พิมพ์ @ แล้วลิงก์ไปหา entity อื่นได้ (Ctrl+คลิกเปิด) + ตรวจคำผิด
        getNames: () => this.entityTitles() || [],
        onMention: (name) => {
          const f = this.fileOfEntity && this.fileOfEntity(name);
          if (f && this.onOpenEntity) this.onOpenEntity(f);
        },
        getChecker: this.getChecker || undefined,
      });
      this.secEditors.push({ sec, k });
      wrap.appendChild(box);
    });
    // หลัง render ใหม่ แผง backlinks (wiki-ui.js เป็นคนเติม) จะหายไป → ให้เติมกลับ
    this.onRendered && this.onRendered(wrap);
  }

  async save() {
    for (const { sec, k } of this.secEditors) sec.content = k.getMarkdown();
    await kapi.writeFile(this.file, JSON.stringify(this.e, null, 2));
    await this._syncInverse();
    this.dirty = false;
    this.onSaved && this.onSaved(this.e);
    return true;
  }

  async _syncInverse() {
    // ให้ความสัมพันธ์ปรากฏบนอีกฝั่งด้วย (v1 semantics: เพิ่มเฉพาะที่ยังไม่มี ไม่ลบของเขา)
    for (const rel of this.e.relationships || []) {
      const tf = this.fileOfEntity(rel.targetName);
      if (!tf || tf === this.file) continue;
      try {
        const te = await kapi.readJson(tf);
        te.relationships = te.relationships || [];
        const already = te.relationships.some((r) =>
          (r.targetName || r.target) === this.e.name);
        if (!already) {
          // ประเภทเป็นของคู่ความสัมพันธ์ → ฝั่งตรงข้ามได้ประเภทเดียวกัน
          const inv = { targetName: this.e.name, role: this.invertRole(rel.role || '') };
          if (rel.type) inv.type = rel.type;
          te.relationships.push(inv);
          await kapi.writeFile(tf, JSON.stringify(te, null, 2));
        }
      } catch {}
    }
  }

  focus() {}
  // โหลด entity ใหม่จากไฟล์ถ้าไม่มีการแก้ค้าง (ใช้เมื่ออีกฝั่งซิงก์ความสัมพันธ์เข้ามา)
  async reloadIfExists() {
    if (this.dirty) return;
    try {
      const fresh = await kapi.readJson(this.file);
      this.e = fresh; this.render();
    } catch {}
  }
  destroy() { for (const { k } of this.secEditors) k.destroy(); }
}
