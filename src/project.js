// project.js — สร้างโปรเจกต์จาก template (นิยาย, บทหนัง, แฟนตาซี, สืบสวน)
import { t } from './i18n.js';
import { el, setStatus, log, DEFAULT_SETTINGS, DEFAULT_GOALS, CAT_ICON } from './core.js';

// ป้ายไทย + ไอคอนของหมวด Wiki (เดิมใส่ label เป็นคีย์อังกฤษ ผิดหลัก "ไทย 100%")
const CAT_LABEL = {
  characters: t('ui.common.character'), locations: t('ui.common.place'), items: t('ui.common.thing'),
  lore: t('ui.common.legend2'), factions: t('ui.project.group'),
};

const TEMPLATES = {
  novel: {
    name: t('ui.common.novel'),
    desc: t('ui.project.structureNovelChapterScene'),
    sections: [{ title: t('ui.common.bookOne'), chapters: [t('ui.common.chapterOne2'), t('ui.project.chapterTwo')] }],
    wikiCats: ['characters', 'locations', 'lore'],
    templates: 'default',
  },
  screenplay: {
    name: t('ui.project.screenplay'),
    desc: t('ui.project.structureChapterFilmAct'),
    sections: [{ title: t('ui.common.chapterFilm'), chapters: [t('ui.project.act'), t('ui.project.act2'), t('ui.project.act3')] }],
    wikiCats: ['characters', 'locations'],
    templates: 'screenplay',
    format: 'screenplay',
  },
  fantasy: {
    name: t('ui.project.fantasy'),
    desc: t('ui.project.novelFantasyWorldbuilding'),
    sections: [{ title: t('ui.common.bookOne'), chapters: [t('ui.project.chapter'), t('ui.common.chapterOne2')] }],
    wikiCats: ['characters', 'locations', 'items', 'lore', 'factions'],
    templates: 'fantasy',
  },
  mystery: {
    name: t('ui.project.investigateBack'),
    desc: t('ui.project.novelInvestigateCharacterSuspect'),
    sections: [{ title: t('ui.common.bookOne'), chapters: [t('ui.project.start'), t('ui.project.investigation'), t('ui.project.chapterSummary')] }],
    wikiCats: ['characters', 'locations', 'items', 'lore'],
    templates: 'mystery',
  },
};

export function getTemplates() { return TEMPLATES; }

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
    settings: { ...DEFAULT_SETTINGS },
    goals: { ...DEFAULT_GOALS },
    // หมวดที่ไม่ใช่หมวดมาตรฐานเท่านั้นที่ต้องประกาศ (BUILTIN_CATS มีอยู่แล้วในตัวโปรแกรม)
    wikiCats: tpl.wikiCats
      .filter((k) => !['characters', 'locations', 'items', 'lore'].includes(k))
      .map((k) => ({ key: k, label: CAT_LABEL[k] || k, icon: CAT_ICON[k] || '🔖' })),
  });

  // สร้างเล่มตาม template
  for (let si = 0; si < tpl.sections.length; si++) {
    const sec = tpl.sections[si];
    const secPath = await kapi.join(root, safeName(sec.title));
    await W(await kapi.join(secPath, 'section.json'), {
      guid: guid(), title: sec.title, order: si + 1,
    });
    const dr = await kapi.join(secPath, 'Draft', 'default');
    const chData = sec.chapters.map((title, ci) => ({
      guid: guid(), title, order: ci + 1,
      folderName: String(ci + 1).padStart(2, '0') + ' - ' + title,
    }));
    await W(await kapi.join(dr, 'draft.json'), { chapters: chData });

    const scenesByCh = {};
    const { dumpMdFile } = await import('./md.js');
    for (const ch of chData) {
      // เลขไฟล์เริ่มใหม่ทุกบท (แต่ละบทมีโฟลเดอร์ของตัวเอง) — เดิมเลขไหลต่อกันข้ามบท
      const sc = {
        id: guid(), title: t('ui.project.sceneFirst') + ch.title, order: 1,
        fileName: 'scene-01.md',
        chapterGuid: ch.guid,
      };
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

// Dialog เลือก template
export async function showTemplateDialog() {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', t('ui.project.newProjectTemplate')));

    const grid = el('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0';
    for (const [key, tpl] of Object.entries(TEMPLATES)) {
      const card = el('div', 'tpl-card');
      card.style.cssText = 'padding:12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color .15s';
      const cName = el('div', null, tpl.name);
      cName.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:4px';
      const cDesc = el('div', null, tpl.desc);
      cDesc.style.cssText = 'font-size:12px;color:var(--dim)';
      card.append(cName, cDesc);
      card.onclick = () => { ov.remove(); resolve(key); };
      card.onmouseenter = () => card.style.borderColor = 'var(--accent)';
      card.onmouseleave = () => card.style.borderColor = '';
      grid.append(card);
    }
    box.append(grid);

    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', null, t('ui.common.cancel'));
    cB.onclick = () => { ov.remove(); resolve(null); };
    btns.append(cB);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
  });
}
