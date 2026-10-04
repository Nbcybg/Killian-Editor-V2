// codex-ui.js — [alpha.69] แผง "Codex" — สารานุกรมของโปรเจกต์ + ส่งออกเป็นเว็บแบบ Fandom/Wikia
//
// Codex ไม่มีข้อมูลของตัวเอง มันคืออีกมุมมองของเอนทิตี้ Wiki ที่มีอยู่แล้ว
// (แผง Wiki = แก้ทีละหน้า · Codex = เห็นทั้งเล่ม เรียกดูตามหมวด แล้วส่งออกเป็นเว็บทั้งชุด)
//
// [alpha.168] หน้าตาแบบภาพอ้างอิง 3 ของผู้ใช้ (หน้าเว็บโลกของเรื่องแบบ Plategar):
//   แถบบน = ชื่อโปรเจกต์ + หมวดเป็นปุ่มเมนู (แผนที่ · ตัวละคร · สิ่งของ · สถานที่ · ตำนาน …)
//   ซ้าย = ภาพใหญ่ของสิ่งที่เลือก (ชื่อตัวใหญ่ทับภาพ · จุดเลื่อนดูของเด่น) + ข้อมูลย่อใต้ภาพ
//   ขวา = ช่องค้นหา + ตารางการ์ดรูป (ชื่อทับล่างภาพ) · ไม่มีรูป = การ์ดสีตามหมวด
// ตัวสร้างเว็บอยู่ใน codex-build.js (บริสุทธิ์ · มี unit test) — ไฟล์นี้มีแต่เรื่องหน้าจอกับไฟล์
import { t, tf } from '../i18n.js';
import { failText } from '../err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import { $, el, state, setStatus, setStatusError, log } from '../core.js';
import { listEntities } from '../project-scan.js';
import * as CB from './codex-build.js';
import { panelEmpty } from '../panels/panel-chrome.js';   // [alpha.162 · W2] สถานะว่างของกลาง
import { cmpText } from '../locale.js';
import { entityPortrait } from '../wiki-profile.js';
import { gi } from '../icons.js';
import { popupMenu } from '../ui.js';
import { coverHue } from '../library-view.js';

const S = () => (state._codex || (state._codex = { ents: null, q: '', cat: '', sel: null, hero: 0 }));
export function resetCodex() { state._codex = null; }

/** ป้ายหมวดตามภาษาที่โหลดอยู่ (รวมหมวดที่ผู้ใช้สร้างเอง) */
function catLabels() {
  const out = {};
  for (const c of (state.settings && state.settings.wikiCats) || []) {
    if (c && c.key) out[c.key] = c.label || c.key;
  }
  return out;
}
const CAT_ICON = { characters: 'user', locations: 'map-pin', items: 'sword', lore: 'book-open' };

/** ฉากที่กล่าวถึงเอนทิตี้แต่ละตัว — ใช้ดัชนี backlinks ที่ระบบมีอยู่แล้ว (= "Appearances") */
async function collectMentions(ents) {
  const out = {};
  try {
    const { getBacklinksFor, autoLinkReady } = await import('../world-story/auto-link-ui.js');
    if (!autoLinkReady()) return out;
    for (const e of ents) {
      const links = getBacklinksFor(e.path) || [];
      const names = links.map((l) => l.title || l.name || l.scene || '').filter(Boolean);
      if (names.length) out[e.path] = names;
    }
  } catch (err) { log('warn', t('ui.codex.codexReadIndexMention'), err); }
  return out;
}

async function openWiki(e) {
  try { const { openEntity } = await import('../wiki-ui.js'); openEntity(e.path); }
  catch { setStatus(t('ui.codex.openPageWikiNot')); }
}

export async function renderCodexPanel(host) {
  const h = host || $('#codex-body');
  if (!h) return false;
  const s = S();
  h.replaceChildren();
  h.classList.add('k-codex', 'k-codex2');

  if (!state.root) {
    h.append(panelEmpty(t('ui.codex.openProjectBeforeHas'), { icon: 'book-open' }));
    return true;
  }
  h.append(panelEmpty(t('ui.codex.busyRead')));
  const ents = (await listEntities(state.root)).sort((a, b) => cmpText(String(a.name), String(b.name)));
  s.ents = ents;
  const { resolveImg } = await import('../app.js');
  const imgOf = (e) => { const p = entityPortrait(e.entity); return p && p.file ? resolveImg(state.root, 'Images/' + p.file) : ''; };
  let maps = [];
  try { const { loadMaps } = await import('../app.js'); maps = ((await loadMaps()).maps || []); } catch {}
  h.replaceChildren();

  const labels = catLabels();
  const stats = CB.codexStats(ents);
  const cats = [...new Set(ents.map((e) => e.cat))].sort();

  // ── แถบบน: ชื่อโปรเจกต์ · หมวด (คลิก = กรอง · ▾ = รายชื่อ) · แผนที่ · ส่งออก ──
  const nav = el('div', 'k-codex-nav');
  const brand = el('div', 'k-codex-brand', gi('book-open') + ' ' + (state.title || 'Codex'));
  brand.title = tf('ui.codex.searchCodexList', stats.total);
  brand.onclick = () => { s.cat = ''; s.q = ''; q.value = ''; draw(); };
  nav.append(brand);
  const catBar = el('div', 'k-codex-cat');
  const catBtn = (label, icon, onClick, onMenu, on) => {
    const b = el('div', 'k-codex-navbtn' + (on ? ' on' : ''));
    const main = el('button', 'k-codex-navmain', gi(icon) + ' ' + label);
    main.onclick = onClick;
    b.append(main);
    if (onMenu) {
      const dd = el('button', 'k-codex-navdd', gi('chevron-down'));
      dd.title = t('ui.codex.navListTip');
      dd.onclick = (ev) => { const r = b.getBoundingClientRect(); popupMenu(r.left, r.bottom + 4, onMenu()); ev.stopPropagation(); };
      b.append(dd);
    }
    return b;
  };
  if (maps.length) {
    catBar.append(catBtn(t('ui.codex.navMaps'), 'map', async () => { const { openMaps } = await import('../maps-ui.js'); openMaps(); },
      () => maps.map((m) => ({ text: m.name || '', click: async () => { const { openMapById } = await import('../maps-ui.js'); openMapById(m.id); } })), false));
  }
  for (const c of cats) {
    const list = ents.filter((e) => e.cat === c);
    catBar.append(catBtn(CB.catLabel(c, labels) + ' · ' + list.length, CAT_ICON[c] || 'folder',
      () => { s.cat = s.cat === c ? '' : c; draw(); },
      () => list.map((e) => ({ text: e.name, click: () => { s.sel = e.path; draw(); } })), s.cat === c));
  }
  nav.append(catBar, el('span', 'k-codex-sp'));
  const expBtn = el('button', 'cmp-mini k-codex-exp', gi('export') + ' ' + t('ui.codex.exportWeb'));
  expBtn.title = t('ui.codex.newWebCodexStyle');
  expBtn.onclick = exportSite;
  nav.append(expBtn);
  h.append(nav);

  const body = el('div', 'k-codex-main');
  const left = el('div', 'k-codex-left');
  const hero = el('div', 'k-codex-hero');
  const prev = el('div', 'k-codex-prev');
  left.append(hero, prev);
  const right = el('div', 'k-codex-right');
  const q = el('input', 'k-codex-q'); q.type = 'search';
  q.placeholder = tf('ui.codex.searchIn', state.title || 'Codex');
  q.value = s.q;
  let tm = 0;
  q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { s.q = q.value; draw(); }, 90); };
  const grid = el('div', 'k-codex-grid');
  right.append(q, grid);
  body.append(left, right);
  h.append(body);

  // ของเด่นบนภาพใหญ่ = เอนทิตี้ที่มีรูป (ไม่มีเลย = ทุกตัว)
  const featured = () => { const w = ents.filter((e) => imgOf(e)); return (w.length ? w : ents).slice(0, 10); };

  function tileBg(node, e) {
    const u = imgOf(e);
    if (u) { node.style.backgroundImage = `url("${String(u).replace(/"/g, '%22')}")`; node.classList.add('has-img'); }
    else { node.style.setProperty('--h', String(coverHue(e.cat + e.name))); node.append(el('span', 'k-codex-tile-ic', gi(CAT_ICON[e.cat] || 'folder'))); }
  }

  function draw() {
    for (const b of catBar.querySelectorAll('.k-codex-navbtn')) b.classList.remove('on');
    [...catBar.children].forEach((b) => { if (b._cat && b._cat === s.cat) b.classList.add('on'); });
    const needle = s.q.trim().toLowerCase();
    const rows = ents.filter((e) => {
      if (s.cat && e.cat !== s.cat) return false;
      if (!needle) return true;
      return (e.name + ' ' + (e.aliases || []).join(' ')).toLowerCase().includes(needle);
    });
    grid.replaceChildren();
    if (!rows.length) grid.append(panelEmpty(ents.length ? t('ui.codex.notFoundListAt') : t('ui.codex.notHasWikiNew')));
    for (const e of rows) {
      const c = el('div', 'k-codex-card');
      if (s.sel === e.path) c.classList.add('on');
      tileBg(c, e);
      const cap = el('div', 'k-codex-cap');
      cap.append(el('div', 'k-codex-name', e.name), el('div', 'k-codex-cat-pill', CB.catLabel(e.cat, labels)));
      c.append(cap);
      c.title = e.name + ((e.aliases || []).length ? ' · ' + e.aliases.join(' · ') : '') + '\n' + t('ui.codex.tileTip');
      c.onclick = () => { s.sel = e.path; draw(); };
      c.ondblclick = () => openWiki(e);
      grid.append(c);
    }
    const sel = ents.find((e) => e.path === s.sel);
    showHero(sel || featured()[Math.min(s.hero, featured().length - 1)] || null, !sel);
  }

  function showHero(e, carousel) {
    hero.replaceChildren(); prev.replaceChildren();
    if (!e) { hero.append(panelEmpty(t('ui.codex.notHasWikiNew'))); return; }
    const bg = el('div', 'k-codex-hero-bg');
    tileBg(bg, e);
    hero.append(bg);
    const ov = el('div', 'k-codex-hero-ov');
    ov.append(el('div', 'k-codex-cat-pill', CB.catLabel(e.cat, labels)), el('div', 'k-codex-hero-name k-codex-prev-name', e.name));
    if ((e.aliases || []).length) ov.append(el('div', 'k-codex-aka', (e.aliases || []).join(' · ')));
    hero.append(ov);
    hero.onclick = () => openWiki(e);
    hero.title = t('ui.codex.openPageWiki');
    if (carousel) {
      const f = featured();
      if (f.length > 1) {
        const dots = el('div', 'k-codex-dots');
        f.forEach((x, i) => {
          const d = el('button', 'k-codex-dot' + (x === e ? ' on' : ''));
          d.title = x.name; d.setAttribute('aria-label', x.name);
          d.onclick = (ev) => { ev.stopPropagation(); s.hero = i; draw(); };
          dots.append(d);
        });
        hero.append(dots);
      }
    }
    // ข้อมูลย่อใต้ภาพ: กล่องข้อมูล + คำอธิบาย + ปุ่มเปิดหน้า Wiki
    const ent = e.entity || {};
    const rows = CB.infoRows(ent);
    if (rows.length) {
      const tb = el('table', 'k-codex-info');
      for (const [k, v] of rows) { const tr = el('tr'); tr.append(el('th', null, k), el('td', null, v)); tb.append(tr); }
      prev.append(tb);
    }
    const bodyText = ent.body || ent.description || ent.desc || '';
    prev.append(el('div', 'k-codex-prev-body', bodyText || t('ui.codex.notHasDesc')));
    const open = el('button', 'k-ok', gi('file') + ' ' + t('ui.codex.openPageWiki'));
    open.onclick = () => openWiki(e);
    prev.append(open);
  }

  async function exportSite() {
    if (!ents.length) { setStatus(t('ui.codex.notHasExport')); return; }
    const dir = await kapi.openDirDialog();
    if (!dir) return;
    setStatus(t('ui.codex.busyNewWebCodex'));
    try {
      const mentions = await collectMentions(ents);
      const files = CB.buildCodexSite(ents, { siteTitle: state.title || 'Codex', labels, mentions });
      const out = await kapi.join(dir, 'codex');
      await kapi.mkdir(out);
      for (const f of files) await kapi.writeFile(await kapi.join(out, f.name), f.text);
      setStatus(tf('ui.codex.exportWebCodexDone', files.length, out));
      log('info', tf('ui.codex.codexExportWebF', files.length, out));
      try { await kapi.revealInOS(await kapi.join(out, 'index.html')); } catch {}
    } catch (e) {
      log('error', t('ui.codex.codexExportNotOk'), e);
      setStatusError(failText(t('ui.codex.exportNotOk'), e));
    }
  }

  // ปุ่มหมวดจำว่าเป็นหมวดไหน (ไฮไลต์ตัวที่กรองอยู่)
  [...catBar.children].forEach((b, i) => { const c = maps.length ? cats[i - 1] : cats[i]; if (c) b._cat = c; });
  draw();
  return true;
}

// [alpha.126] `openCodex()` ถูกลบ — เป็นแค่ตัวห่อ
// `showPanel(id)` + `renderFeaturePanel(id)` ซึ่ง `togglePanel()` ของระบบแผงทำให้อยู่แล้ว
// (เมนู มุมมอง → แผง · ปุ่มบนแถบ · คีย์ลัด Ctrl+Alt+ตัวอักษร เดินทางนั้นทั้งหมด)
