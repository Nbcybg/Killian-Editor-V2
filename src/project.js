// project.js — สร้างโปรเจกต์จาก template (นิยาย, บทหนัง, แฟนตาซี, สืบสวน)
import { t, tf } from './i18n.js';
import { el, setStatus, log, PROJECT_DEFAULTS, DEFAULT_GOALS, CAT_ICON, i18n } from './core.js';
import { gi } from './icons.js';
import { diskBase, freeName, defaultBookName } from './disk-names.js';   // [alpha.170] ชื่อบนดิสก์ = ชื่อเรื่อง

// ป้ายไทย + ไอคอนของหมวด Wiki (เดิมใส่ label เป็นคีย์อังกฤษ ผิดหลัก "ไทย 100%")
const CAT_LABEL = {
  characters: t('ui.common.character'), locations: t('ui.common.place'), items: t('ui.common.thing'),
  lore: t('ui.common.legend2'), factions: t('ui.project.group'),
};

// [alpha.170 · ข้อ 8] ชื่อ/คำอธิบายเป็น getter (อ่านตอนวาดกล่อง — ไม่ค้างภาษาตอน import) · โครงบทอ่านตอนสร้างโปรเจกต์
const TEMPLATES = {
  novel: {
    get name() { return t('ui.common.novel'); },
    get desc() { return t('ui.project.structureNovelChapterScene'); },
    sections: [{ chapters: [t('ui.common.chapterOne2'), t('ui.project.chapterTwo')] }],
    wikiCats: ['characters', 'locations', 'lore'],
    templates: 'default',
  },
  screenplay: {
    get name() { return t('ui.project.screenplay'); },
    get desc() { return t('ui.project.structureChapterFilmAct'); },
    sections: [{ title: t('ui.common.chapterFilm'), chapters: [t('ui.project.act'), t('ui.project.act2'), t('ui.project.act3')] }],
    wikiCats: ['characters', 'locations'],
    templates: 'screenplay',
    format: 'screenplay',
  },
  fantasy: {
    get name() { return t('ui.project.fantasy'); },
    get desc() { return t('ui.project.novelFantasyWorldbuilding'); },
    sections: [{ chapters: [t('ui.project.chapter'), t('ui.common.chapterOne2')] }],
    wikiCats: ['characters', 'locations', 'items', 'lore', 'factions'],
    templates: 'fantasy',
  },
  mystery: {
    get name() { return t('ui.project.investigateBack'); },
    get desc() { return t('ui.project.novelInvestigateCharacterSuspect'); },
    sections: [{ chapters: [t('ui.project.start'), t('ui.project.investigation'), t('ui.project.chapterSummary')] }],
    wikiCats: ['characters', 'locations', 'items', 'lore'],
    templates: 'mystery',
  },
  // [alpha.170 · ข้อ 8] ผลสำรวจผู้ใช้: เทมเพลตตามประเภทงาน — นิยายเว็บ (ลงทีละตอน) · นิยายภาพ (VN · มีเส้นทางแยก)
  webnovel: {
    get name() { return t('ui.project.tplWebnovel'); },
    get desc() { return t('ui.project.tplWebnovelDesc'); },
    get sections() { return [{ chapters: [1, 2, 3].map((n) => tf('ui.project.episodeF', n)) }]; },
    wikiCats: ['characters', 'locations', 'lore'],
    templates: 'default',
  },
  vn: {
    get name() { return t('ui.project.tplVn'); },
    get desc() { return t('ui.project.tplVnDesc'); },
    // เส้นทางหลัก (ทุกคนเห็น) + เส้นทางแยกของตัวละคร — เล่มละเส้นทาง · ทางเลือกต่อกันด้วยผังแตกสาย
    get sections() { return [
      { title: t('ui.project.vnCommon'), chapters: [t('ui.project.vnPrologue'), t('ui.common.chapterOne2')] },
      { title: tf('ui.project.vnRouteF', 'A'), chapters: [t('ui.common.chapterOne2')] },
    ]; },
    wikiCats: ['characters', 'locations', 'items', 'lore'],
    templates: 'default',
  },
};

// [alpha.126] `getTemplates()` ถูกถอด — ไม่มีใครเรียก · เทมเพลตอ่านผ่าน `state.templates`
export async function createProjectFromTemplate(parentDir, projectName, tplKey) {
  const tpl = TEMPLATES[tplKey];
  if (!tpl) return false;

  const { safeName, guid } = await import('./app.js');
  const root = await kapi.join(parentDir, safeName(projectName));
  if (await kapi.exists(await kapi.join(root, 'project.khn.json'))) {
    setStatus(t('ui.project.hasProject'));
    return false;
  }

  const W = (p, d) => kapi.writeFile(p, JSON.stringify(d, null, 2));
  const format = tpl.format || 'prose';

  // project.khn.json — ต้องมี settings/goals ครบเหมือนโปรเจกต์ปกติ ไม่งั้นค่าตั้งต้นหาย
  await W(await kapi.join(root, 'project.khn.json'), {
    title: projectName, type: 'killian-project', version: '2.0',
    created: new Date().toISOString(),
    template: tplKey,
    // [trial 2026-10-25 ข้อ 8] เฉพาะค่าของ "ผลงาน" — ค่าระดับผู้ใช้ (ซูมพอดีความกว้าง ฯลฯ) มาจากไฟล์ผู้ใช้ตอนเปิด
    // (เดิมสำเนา DEFAULT_SETTINGS ทั้งก้อน → ไฟล์ผลงานชนะ แล้วค่าที่ผู้ใช้เปิดไว้ถูกปิดในทุกโปรเจกต์ใหม่)
    // [trial 2026-10-25 ข้อ 18] นิยายในหน้าจอภาษาไทย = กระดาษ A4 (บทภาพยนตร์คง Letter ตามมาตรฐานบท)
    settings: { ...PROJECT_DEFAULTS, ...(format !== 'screenplay' && i18n.lang === 'th' ? { paperSize: 'a4' } : {}) },
    goals: { ...DEFAULT_GOALS },
    // หมวดที่ไม่ใช่หมวดมาตรฐานเท่านั้นที่ต้องประกาศ (BUILTIN_CATS มีอยู่แล้วในตัวโปรแกรม)
    wikiCats: tpl.wikiCats
      .filter((k) => !['characters', 'locations', 'items', 'lore'].includes(k))
      .map((k) => ({ key: k, label: CAT_LABEL[k] || k, icon: CAT_ICON[k] || gi('bookmark') })),
  });

  // สร้างเล่มตาม template
  // [alpha.170] เล่ม: ไม่ระบุชื่อ = `Book N` (อังกฤษเสมอ) · ชื่อเล่ม = ชื่อโฟลเดอร์ · บท/ฉาก: ชื่อเรื่องเป็นชื่อบนดิสก์ ไม่มีเลขกำกับ
  const usedBooks = [];
  for (let si = 0; si < tpl.sections.length; si++) {
    const sec = tpl.sections[si];
    const secTitle = sec.title || defaultBookName(usedBooks);
    const secFolder = freeName(diskBase(secTitle, 'Book'), usedBooks);
    usedBooks.push(secFolder);
    const secPath = await kapi.join(root, secFolder);
    await W(await kapi.join(secPath, 'section.json'), {
      guid: guid(), title: secFolder === diskBase(secTitle, 'Book') ? secTitle : secFolder, order: si + 1, folderName: secFolder,
    });
    const dr = await kapi.join(secPath, 'Draft', 'default');
    const usedCh = [];
    const chData = sec.chapters.map((title, ci) => {
      const folderName = freeName(diskBase(title, 'chapter'), usedCh);
      usedCh.push(folderName);
      return { guid: guid(), title, order: ci + 1, folderName };
    });
    await W(await kapi.join(dr, 'draft.json'), { chapters: chData });

    const scenesByCh = {};
    const { dumpMdFile } = await import('./md.js');
    for (const ch of chData) {
      // เลขไฟล์เริ่มใหม่ทุกบท (แต่ละบทมีโฟลเดอร์ของตัวเอง) — เดิมเลขไหลต่อกันข้ามบท
      const sc = {
        id: guid(), title: t('ui.project.sceneFirst') + ch.title, order: 1,
        chapterGuid: ch.guid,
      };
      sc.fileName = diskBase(sc.title, 'scene') + '.md';
      scenesByCh[ch.guid] = [sc];
      await kapi.writeFile(
        await kapi.join(dr, 'Chapters', ch.folderName, sc.fileName),
        dumpMdFile({ title: sc.title, type: 'scene', format }, ''),
      );
    }
    await W(await kapi.join(dr, 'scenes.json'), { chapters: scenesByCh });
  }

  // โฟลเดอร์พื้นฐาน
  for (const d of ['Images', 'Memos', 'Recycle', 'Research']) {
    await kapi.mkdir(await kapi.join(root, d));
  }
  await W(await kapi.join(root, 'Images', 'images.json'), { images: [] });

  // Wiki ตาม template
  const wikiRoot = await kapi.join(root, 'Wiki');
  for (const cat of tpl.wikiCats) {
    await kapi.mkdir(await kapi.join(wikiRoot, cat));
  }

  setStatus(t('ui.project.newProjectTemplateDone') + projectName);
  log('info', 'project: created from template ' + tplKey);
  return root;
}

/** [alpha.162 · W4 ข้อ 12] ค่าที่กล่องเลือกเทมเพลตคืนเมื่อเลือก "โปรเจกต์ว่าง" (ต่างจาก null = ยกเลิก) */
export const BLANK_TEMPLATE = '__blank__';

// Dialog เลือก template
// [alpha.162 · W4 ข้อ 12] `allowBlank` = มีการ์ด "โปรเจกต์ว่าง" เป็นตัวแรก (ทางของปุ่มโปรเจกต์ใหม่/Ctrl+N
// — เดิมได้โปรเจกต์ว่างเงียบ ๆ โดยไม่รู้เลยว่ามีเทมเพลตให้เลือก)
export async function showTemplateDialog({ allowBlank = false } = {}) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', t('ui.project.newProjectPick')));

    const grid = el('div', 'k-newproj-grid');   // [alpha.169] คลาสของตัวเอง (เดิมยืม .tpl-card ของตัวจัดการเทมเพลต → ชื่อ/คำอธิบายวางคนละฝั่ง)
    const entries = Object.entries(TEMPLATES);
    if (allowBlank) entries.unshift([BLANK_TEMPLATE, { name: t('ui.project.blankName'), desc: t('ui.project.blankDesc') }]);
    for (const [key, tpl] of entries) {
      const card = el('div', 'k-newproj-card');
      card.setAttribute('role', 'button');
      const cName = el('div', 'k-newproj-name', tpl.name);
      const cDesc = el('div', 'k-newproj-desc', tpl.desc);
      card.append(cName, cDesc);
      card.dataset.tpl = key;
      card.tabIndex = 0;                               // เลือกด้วยคีย์บอร์ดได้ (Tab ไปการ์ด · Enter)
      card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } };
      card.onclick = () => { ov.remove(); resolve(key); };
      grid.append(card);
    }
    box.append(grid);

    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', 'k-cancel', t('ui.common.cancel'));   // [162-W4] Esc เดินทางนี้
    cB.onclick = () => { ov.remove(); resolve(null); };
    btns.append(cB);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
  });
}
