// scene-props-extra.js — [alpha.157] ส่วนเสริมของคุณสมบัติฉาก ใช้ร่วม "กล่อง" และ "แผง"
//
// ผู้ใช้: *"คุณสมบัติ — เพิ่ม act / chapter ให้กรอกได้เลย"*
//        *"เพิ่ม mention ว่าฉากนี้ mention ถึงอะไรบ้าง โดยแบ่งตามหมวดใน wiki เลย"*
//
// ★ บทเรียนข้อ 12: เทสอ้าง `.wiki-input` / `.wiki-check` "ตามลำดับ" — ช่องใหม่ในไฟล์นี้จึงใช้คลาสของตัวเอง
//   (`props-act-input` · `props-chapter-select`) ห้ามใช้ `wiki-input` ไม่งั้นทุกเทสที่นับช่องเลื่อนหมด
import { t, tf } from './i18n.js';
import { gi } from './icons.js';   // [alpha.162 · W6 ข้อ 1] ไอคอนจากทะเบียน
import { el, state, smart, setStatus, log } from './core.js';
import { mutateJson } from './json-store.js';
import { parseMdFile } from './md.js';
import { sceneMentions } from './scene-mentions.js';

/**
 * แถว "องก์" (ของบทที่ฉากนี้อยู่) + "บท" (เลือกบทอื่น = ย้ายฉาก)
 * @returns {Promise<{actInput:HTMLInputElement, chapterSelect:HTMLSelectElement}>}
 */
export async function buildActChapterRows(host, { dPath, ch, sc }, opts = {}) {
  const df = await kapi.join(dPath, 'draft.json');
  let chapters = [];
  try { chapters = ((await kapi.readJson(df)).chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)); } catch {}
  const cur = chapters.find((c) => c.guid === ch.guid) || ch;
  const rowCls = opts.rowClass || 'wiki-row';

  // ── องก์ ──
  const actRow = el('div', rowCls + ' props-act-row');
  actRow.append(el('label', null, t('ui.props.act')));
  const actIn = el('input', 'props-act-input');
  actIn.value = cur.act || '';
  actIn.placeholder = t('ui.props.actHint');
  actIn.title = t('ui.props.actTip');
  const listId = 'k-acts-' + Math.random().toString(36).slice(2, 8);
  const dl = el('datalist'); dl.id = listId;
  for (const a of [...new Set(chapters.map((c) => c.act).filter(Boolean))]) { const o = el('option'); o.value = a; dl.append(o); }
  actIn.setAttribute('list', listId);
  actRow.append(actIn, dl);
  const commitAct = async () => {
    const v = actIn.value.trim();
    if (v === (cur.act || '')) return;
    await mutateJson(kapi, df, (d) => {
      const c = (d.chapters || []).find((x) => x.guid === ch.guid);
      if (!c) return false;
      if (v) c.act = v; else delete c.act;
    });
    cur.act = v;
    ch.act = v;
    setStatus(tf('ui.props.actSaved', v || '—'));
    try { const { refreshTreeQueued } = await import('./app.js'); refreshTreeQueued(); } catch {}
  };
  actIn.addEventListener('change', () => commitAct().catch((e) => log('warn', 'act', e)));
  actIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actIn.blur(); } });

  // ── บท ──
  const chRow = el('div', rowCls + ' props-chapter-row');
  chRow.append(el('label', null, t('ui.props.chapter')));
  const chSel = el('select', 'props-chapter-select k-dlg-select');
  chapters.forEach((c, i) => {
    const o = el('option'); o.value = c.guid;
    o.textContent = (i + 1) + '. ' + (c.title || t('ui.common.notNamed')) + (c.act ? '  ·  ' + c.act : '');
    if (c.guid === ch.guid) o.selected = true;
    chSel.append(o);
  });
  chSel.title = t('ui.props.chapterTip');
  chSel.addEventListener('change', async () => {
    const dst = chapters.find((c) => c.guid === chSel.value);
    if (!dst || dst.guid === ch.guid) return;
    try {
      const { moveSceneToChapter } = await import('./scene-ops.js');
      const { findScenePath } = await import('./project-scan.js');
      const wasOpen = [...state.tabs.keys()].some((k) => String(k).includes(ch.folderName) && state.tabs.get(k).meta && state.tabs.get(k).meta.id === sc.id);
      await moveSceneToChapter(dPath, ch, sc, dst);
      setStatus(tf('ui.props.movedTo', dst.title || ''));
      if (opts.onMoved) await opts.onMoved(dst);
      if (wasOpen) {
        const hit = await findScenePath(state.root, sc.id);
        if (hit) { const { openScene } = await import('./app.js'); await openScene(hit.path, hit.title); }
      }
    } catch (e) { log('warn', 'move scene from props', e); }
  });
  chRow.append(chSel);
  host.append(actRow, chRow);
  return { actInput: actIn, chapterSelect: chSel };
}

/**
 * กล่อง "ฉากนี้กล่าวถึง" แบ่งตามหมวด Wiki · คลิกชิปเปิด Wiki
 * @param {HTMLElement} host
 * @param {string} file ไฟล์ .md ของฉาก (อ่านเนื้อสด — แท็บที่ยังไม่บันทึกใช้เนื้อในหน่วยความจำ)
 */
export async function buildMentionsBox(host, file) {
  const box = el('div', 'props-mentions');
  box.append(el('div', 'props-mentions-title', t('ui.props.mentions')));
  host.append(box);
  let body = '';
  try {
    const tab = state.tabs.get(file);
    const live = tab && (tab.editor || tab.sp);
    if (live && typeof live.getMarkdown === 'function') body = live.getMarkdown();
    else body = parseMdFile(await kapi.readFile(file)).body || '';
  } catch {}
  if (!smart.byCat || !Object.keys(smart.byCat).length) {
    try { await smart.loadNames(state.root); } catch {}
  }
  let order = [];
  try { const { wikiCats } = await import('./wiki-ui.js'); const { BUILTIN_CATS } = await import('./core.js'); order = [...BUILTIN_CATS, ...wikiCats().map((c) => c.key)]; } catch {}
  const groups = sceneMentions(body, smart.byCat || {}, smart.fileOf || {}, { titles: smart.titles || [], order });
  if (!groups.length) { box.append(el('div', 'dim', t('ui.props.mentionsNone'))); return box; }
  const { catLabel, catIconHtml } = await import('./app.js');
  for (const g of groups) {
    const row = el('div', 'props-mention-group');
    const head = el('div', 'props-mention-cat');
    head.innerHTML = catIconHtml(g.cat, 14) + ' ';
    head.append(document.createTextNode(catLabel(g.cat) + ' (' + g.items.length + ')'));
    const chips = el('div', 'props-mention-chips');
    for (const it of g.items) {
      const chip = el('button', 'props-mention-chip');
      chip.type = 'button';
      chip.append(document.createTextNode(it.name));
      chip.append(el('i', null, gi('times') + it.count));
      if (it.forms.length > 1) chip.title = it.forms.join(' · ');
      if (it.file) chip.onclick = async () => { const { openEntity } = await import('./wiki-ui.js'); openEntity(it.file); };
      chips.append(chip);
    }
    row.append(head, chips);
    box.append(row);
  }
  return box;
}
