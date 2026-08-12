// roster-ui.js — [97] หน้ารายชื่อตัวละคร (Cast of Characters / dramatis personae)
//
// หน้านี้เป็น "หน้าเดี่ยว" ประจำเล่ม (section) ไม่ได้อยู่ในฉากใดเลย → เก็บที่ <Section>/roster.json
// ใช้กรอบหน้ากระดาษเดียวกับโหมดบทภาพยนตร์ (ขอบ บน1 ล่าง1 ซ้าย1.5 ขวา1 นิ้ว หรือค่าที่ผู้ใช้ตั้ง)
// แต่การจัดบล็อกต่างจากบท:
//   · "Cast of Characters" — บรรทัดแรก ขีดเส้นใต้ อยู่กลางหน้ากระดาษ
//   · รายชื่อ — ชื่อขีดเส้นใต้ตามด้วย ":" แล้ว 1 tab เป็นรายละเอียด
//     ขึ้นบรรทัดใหม่ต้องชิดคอลัมน์รายละเอียด (hanging indent) · คนถัดไปเว้น 1 บรรทัด
//   · Scene / Time — หัวข้อกลางหน้า ขีดเส้นใต้ เว้น 1 บรรทัด แล้วคำอธิบายชิดซ้าย
//     ระหว่างสองหัวข้อเว้น 2 บรรทัด · ทั้งสองหัวข้อเลือกเอา/ไม่เอาได้
//   · หน้านี้ไม่มีเลขหน้า
import { t } from './i18n.js';
import { $, el, state, setStatus, log, normalizeRoster, newRoster, rosterToText, mergeSpFormat } from './core.js';
import { activate, closeTab, pickFromList } from './app.js';
import { listSections } from './section-ops.js';

export const ROSTER_PREFIX = '::roster::';
export const rosterKey = (secPath) => ROSTER_PREFIX + secPath;

/** ที่อยู่ไฟล์ roster ของเล่มหนึ่ง */
export async function rosterPath(secPath) { return kapi.join(secPath, 'roster.json'); }

export async function loadRoster(secPath) {
  try {
    const p = await rosterPath(secPath);
    if (await kapi.exists(p)) return normalizeRoster(await kapi.readJson(p));
  } catch (e) { log('warn', t('ui.roster.readPageListCharacter'), e); }
  return newRoster();
}
export async function saveRoster(secPath, roster) {
  const p = await rosterPath(secPath);
  await kapi.writeFile(p, JSON.stringify(normalizeRoster(roster), null, 2));
  return p;
}

/** เลือกเล่ม แล้วเปิดหน้ารายชื่อตัวละครของเล่มนั้น */
export async function openRosterFlow() {
  if (!state.root) { setStatus(t('ui.common.openProjectBefore')); return; }
  const secs = await listSections();
  if (!secs.length) { setStatus(t('ui.roster.notHasBookProject')); return; }
  if (secs.length === 1) return openRoster(secs[0].secPath, secs[0].title);
  const pick = await pickFromList(t('ui.roster.pickBookOpenPage'), secs.map((s) => s.title));
  const sec = secs.find((s) => s.title === pick);
  if (sec) return openRoster(sec.secPath, sec.title);
}

export async function openRoster(secPath, secTitle) {
  const key = rosterKey(secPath);
  if (state.tabs.has(key)) { activate(key); return renderRoster(state.tabs.get(key)); }
  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const title = t('ui.roster.listCharacter') + (secTitle ? ' — ' + secTitle : '');
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', title));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file: key, title, pane, tabBtn, dirty: false, secPath,
                editor: null, plain: null, wiki: null, roster: null };
  tabBtn.onclick = (e) => { if (e.target !== x) activate(key); };
  x.onclick = () => closeTab(key);
  state.tabs.set(key, tab);
  activate(key);
  await renderRoster(tab);
}

/** ตัวละครทั้งหมดจาก Wiki หมวด characters (ไว้เติมรายชื่ออัตโนมัติ) */
async function wikiCharacters() {
  const out = [];
  const scan = async (base) => {
    const dir = await kapi.join(base, 'characters');
    if (!(await kapi.exists(dir))) return;
    for (const f of await kapi.listFiles(dir, '.json')) {
      try {
        const e = await kapi.readJson(await kapi.join(dir, f));
        if (e && e.name) out.push({ name: e.name, detail: (e.summary || e.desc || e.role || '').replace(/\s+/g, ' ').trim() });
      } catch {}
    }
  };
  await scan(await kapi.join(state.root, 'Wiki'));
  await scan(await kapi.join(state.root, 'Bible'));
  return out;
}

export async function renderRoster(tab) {
  const pane = tab.pane;
  pane.innerHTML = '';
  const r = tab.roster || (tab.roster = await loadRoster(tab.secPath));
  const fmt = mergeSpFormat(spFormatFromSettings());

  const dirty = () => {
    if (!tab.dirty) { tab.dirty = true; tab.tabBtn.querySelector('.tab-title').textContent = '● ' + tab.title; }
  };
  const clean = () => { tab.dirty = false; tab.tabBtn.querySelector('.tab-title').textContent = tab.title; };

  // ---- แถบเครื่องมือ ----
  const bar = el('div', 'roster-bar');
  const bAdd = el('button', null, t('ui.roster.addCharacter'));
  const bWiki = el('button', null, t('ui.roster.fetchWiki'));
  const bSave = el('button', 'k-ok', t('ui.common.save'));
  const bCopy = el('button', null, t('ui.common.copyText'));
  const mkChk = (label, key, tip) => {
    const w = el('label', 'roster-chk');
    const c = el('input'); c.type = 'checkbox'; c.checked = r[key] !== false;
    c.onchange = () => { r[key] = c.checked; dirty(); paint(); };
    w.append(c, document.createTextNode(' ' + label));
    if (tip) w.title = tip;
    return w;
  };
  bar.append(bAdd, bWiki,
    mkChk(t('ui.roster.showHeadingScene'), 'showScene'),
    mkChk(t('ui.roster.showHeadingTime'), 'showTime'),
    mkChk(t('ui.roster.putActPrintExport'), 'includeInExport', t('ui.roster.closeSkipPageAct')),
    bCopy, bSave);

  // ---- ตัวหน้ากระดาษ ----
  const ws = el('div', 'workspace');
  const page = el('div', 'roster-page');
  ws.append(page);

  const wrap = el('div', 'roster-wrap');
  wrap.append(bar, ws);
  pane.append(wrap);

  function ce(cls, text, onInput) {
    const d = el('div', cls, text);
    d.contentEditable = 'true';
    d.spellcheck = false;
    d.addEventListener('input', () => { onInput(d.textContent); dirty(); });
    return d;
  }

  function paint() {
    page.innerHTML = '';
    // หัวเรื่อง — กลางหน้า ขีดเส้นใต้
    page.append(ce('roster-title', r.title, (v) => { r.title = v; }));
    // รายชื่อตัวละคร
    const cast = el('div', 'roster-cast');
    r.characters.forEach((c, i) => {
      const row = el('div', 'roster-row');
      const name = ce('roster-name', c.name, (v) => { c.name = v.replace(/:$/, ''); });
      const detail = ce('roster-detail', c.detail, (v) => { c.detail = v; });
      const del = el('span', 'roster-del', '✕');
      del.title = t('ui.roster.delCharacterExitPage');
      del.onclick = () => { r.characters.splice(i, 1); dirty(); paint(); };
      row.append(name, el('span', 'roster-colon', ':'), detail, del);
      cast.append(row);
    });
    if (!r.characters.length) cast.append(el('div', 'roster-empty', t('ui.roster.notHasListPress')));
    page.append(cast);
    // Scene / Time — หัวข้อกลางหน้า ขีดเส้นใต้ · เนื้อชิดซ้าย
    const sec = (key, headText) => {
      const box = el('div', 'roster-sec');
      box.dataset.k = key;
      box.append(el('div', 'roster-sec-head', headText));
      box.append(ce('roster-sec-body', r[key], (v) => { r[key] = v; }));
      return box;
    };
    if (r.showScene !== false) page.append(sec('scene', fmt.strings.sceneTitle));
    if (r.showTime !== false) page.append(sec('time', fmt.strings.timeTitle));
  }
  paint();

  bAdd.onclick = () => { r.characters.push({ name: '', detail: '' }); dirty(); paint(); };
  bWiki.onclick = async () => {
    const chars = await wikiCharacters();
    if (!chars.length) { setStatus(t('ui.roster.notFoundCharacterWiki')); return; }
    const have = new Set(r.characters.map((c) => c.name.trim()));
    let added = 0;
    for (const c of chars) if (c.name && !have.has(c.name.trim())) { r.characters.push(c); added++; }
    dirty(); paint();
    setStatus(added ? t('ui.roster.addCharacterWiki') + added + t('ui.roster.person') : t('ui.roster.characterWikiCompleteDone'));
  };
  bCopy.onclick = () => {
    const txt = rosterToText(r, fmt);
    navigator.clipboard.writeText(txt).then(() => setStatus(t('ui.roster.copyPageListCharacter')));
  };
  bSave.onclick = async () => { await saveRosterTab(tab); };
  return wrap;
}

/** บันทึกแท็บรายชื่อตัวละคร (app.js เรียกตอน Ctrl+S / บันทึกทั้งหมด) */
export async function saveRosterTab(tab) {
  if (!tab || !tab.secPath || !tab.roster) return false;
  await saveRoster(tab.secPath, tab.roster);
  tab.dirty = false;
  const ttl = tab.tabBtn && tab.tabBtn.querySelector('.tab-title');
  if (ttl) ttl.textContent = tab.title;
  setStatus(t('ui.roster.savePageListCharacter'));
  return true;
}

export const isRosterTab = (tab) => !!(tab && typeof tab.file === 'string' && tab.file.startsWith(ROSTER_PREFIX));

/** ค่าตั้งรูปแบบบทหนังจาก settings (ใช้ร่วมกับ app.js — เก็บที่นี่ไว้เลี่ยง circular import ตอน top-level) */
export function spFormatFromSettings(s) {
  const st = s || state.settings || {};
  return {
    paperSize: st.paperSize, paper: st.customPaper, margins: st.pageMargins,
    elements: st.spElements, styles: st.spStyles, rules: st.spPageRules, strings: st.spStrings,
  };
}

/** ข้อความหน้ารายชื่อของทุกเล่ม (ใช้ตอนส่งออก/compile) — ข้ามเล่มที่ปิด includeInExport */
export async function rosterTextFor(secPath) {
  const r = await loadRoster(secPath);
  if (r.includeInExport === false) return '';
  if (!r.characters.length && !r.scene && !r.time) return '';
  return rosterToText(r, mergeSpFormat(spFormatFromSettings()));
}
