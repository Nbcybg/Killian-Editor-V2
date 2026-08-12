// codex-ui.js — [alpha.69] แผง "Codex" — สารานุกรมของโปรเจกต์ + ส่งออกเป็นเว็บแบบ Fandom/Wikia
//
// Codex ไม่มีข้อมูลของตัวเอง มันคืออีกมุมมองของเอนทิตี้ Wiki ที่มีอยู่แล้ว
// (แผง Wiki = แก้ทีละหน้า · Codex = เห็นทั้งเล่ม เรียกดูตามหมวด แล้วส่งออกเป็นเว็บทั้งชุด)
//
// ตัวสร้างเว็บอยู่ใน codex-build.js (บริสุทธิ์ · มี unit test) — ไฟล์นี้มีแต่เรื่องหน้าจอกับไฟล์
import { T } from '../i18n.js';
import { $, el, state, setStatus, log } from '../core.js';
import { listEntities } from '../project-scan.js';
import * as CB from './codex-build.js';

const S = () => (state._codex || (state._codex = { ents: null, q: '', cat: '', sel: null }));
export function resetCodex() { state._codex = null; }

/** ป้ายหมวดตามภาษาที่โหลดอยู่ (รวมหมวดที่ผู้ใช้สร้างเอง) */
function catLabels() {
  const out = {};
  for (const c of (state.settings && state.settings.wikiCats) || []) {
    if (c && c.key) out[c.key] = c.label || c.key;
  }
  return out;
}

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
  } catch (err) { log('warn', T`codex: อ่านดัชนีการกล่าวถึงไม่ได้`, err); }
  return out;
}

export async function renderCodexPanel(host) {
  const h = host || $('#codex-body');
  if (!h) return false;
  const s = S();
  h.replaceChildren();
  h.classList.add('k-codex');

  if (!state.root) {
    h.append(el('div', 'dim k-codex-empty', T`เปิดโปรเจกต์ก่อนจึงจะมีสารานุกรม`));
    return true;
  }
  h.append(el('div', 'dim k-codex-empty', T`กำลังอ่านเอนทิตี้…`));
  const ents = await listEntities(state.root);
  s.ents = ents;
  h.replaceChildren();

  const labels = catLabels();
  const stats = CB.codexStats(ents);
  const cats = [...new Set(ents.map((e) => e.cat))].sort();

  // ── แถบเครื่องมือ ──
  const bar = el('div', 'k-codex-bar');
  const q = el('input', 'k-codex-q'); q.type = 'search';
  q.placeholder = T`ค้นในสารานุกรม… (${stats.total} รายการ)`;
  q.value = s.q;
  q.oninput = () => { s.q = q.value; draw(); };
  const catSel = el('select', 'k-codex-cat');
  const all = el('option', null, T`ทุกหมวด`); all.value = ''; catSel.append(all);
  for (const c of cats) {
    const o = el('option', null, CB.catLabel(c, labels) + ` (${stats.byCat[c]})`); o.value = c; catSel.append(o);
  }
  catSel.value = s.cat;
  catSel.onchange = () => { s.cat = catSel.value; draw(); };
  const expBtn = el('button', 'k-codex-exp', T`🌐 ส่งออกเป็นเว็บ`);
  expBtn.title = T`สร้างเว็บสารานุกรมแบบ Fandom/Wikia (เปิดออฟไลน์ได้ ไม่ต้องต่อเน็ต)`;
  expBtn.onclick = exportSite;
  bar.append(q, catSel, expBtn);
  h.append(bar);

  const body = el('div', 'k-codex-main');
  const grid = el('div', 'k-codex-grid');
  const prev = el('div', 'k-codex-prev');
  body.append(grid, prev);
  h.append(body);

  function draw() {
    const needle = s.q.trim().toLowerCase();
    const rows = ents.filter((e) => {
      if (s.cat && e.cat !== s.cat) return false;
      if (!needle) return true;
      return (e.name + ' ' + (e.aliases || []).join(' ')).toLowerCase().includes(needle);
    }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));
    grid.replaceChildren();
    if (!rows.length) {
      grid.append(el('div', 'dim k-codex-empty',
        ents.length ? T`(ไม่พบรายการที่ตรงกับที่ค้น)` : T`(ยังไม่มีเอนทิตี้ใน Wiki — สร้างจากแผงโปรเจกต์)`));
      return;
    }
    for (const e of rows) {
      const c = el('div', 'k-codex-card');
      if (s.sel === e.path) c.classList.add('on');
      c.append(el('div', 'k-codex-name', e.name));
      c.append(el('div', 'k-codex-cat-pill', CB.catLabel(e.cat, labels)));
      if ((e.aliases || []).length) c.append(el('div', 'k-codex-aka', (e.aliases || []).join(' · ')));
      c.onclick = () => { s.sel = e.path; draw(); showPreview(e); };
      c.ondblclick = async () => {
        try { const { openEntity } = await import('../wiki-ui.js'); openEntity(e.path); }
        catch { setStatus(T`เปิดหน้า Wiki ไม่สำเร็จ`); }
      };
      grid.append(c);
    }
    if (s.sel) { const hit = rows.find((e) => e.path === s.sel); if (hit) showPreview(hit); }
  }
  function showPreview(e) {
    prev.replaceChildren();
    const ent = e.entity || {};
    prev.append(el('div', 'k-codex-prev-name', e.name));
    prev.append(el('div', 'k-codex-cat-pill', CB.catLabel(e.cat, labels)));
    const rows = CB.infoRows(ent);
    if (rows.length) {
      const tb = el('table', 'k-codex-info');
      for (const [k, v] of rows) {
        const tr = el('tr'); tr.append(el('th', null, k), el('td', null, v)); tb.append(tr);
      }
      prev.append(tb);
    }
    const bodyText = ent.body || ent.description || ent.desc || '';
    prev.append(el('div', 'k-codex-prev-body', bodyText || T`(ยังไม่มีคำอธิบาย)`));
    const open = el('button', null, T`📖 เปิดหน้า Wiki`);
    open.onclick = async () => {
      try { const { openEntity } = await import('../wiki-ui.js'); openEntity(e.path); }
      catch { setStatus(T`เปิดหน้า Wiki ไม่สำเร็จ`); }
    };
    prev.append(open);
  }

  async function exportSite() {
    if (!ents.length) { setStatus(T`ยังไม่มีเอนทิตี้ให้ส่งออก`); return; }
    const dir = await kapi.openDirDialog();
    if (!dir) return;
    setStatus(T`กำลังสร้างเว็บสารานุกรม…`);
    try {
      const mentions = await collectMentions(ents);
      const files = CB.buildCodexSite(ents, { siteTitle: state.title || 'Codex', labels, mentions });
      const out = await kapi.join(dir, 'codex');
      await kapi.mkdir(out);
      for (const f of files) await kapi.writeFile(await kapi.join(out, f.name), f.text);
      setStatus(T`ส่งออกเว็บสารานุกรมแล้ว ${files.length} หน้า → ${out}`);
      log('info', T`codex: ส่งออกเว็บ ` + files.length + T` หน้า → ` + out);
      try { await kapi.revealInOS(await kapi.join(out, 'index.html')); } catch {}
    } catch (e) {
      log('error', T`codex: ส่งออกไม่สำเร็จ`, e);
      setStatus(T`ส่งออกไม่สำเร็จ: ` + (e && e.message ? e.message : e));
    }
  }

  draw();
  return true;
}

export async function openCodex() {
  const { showPanel } = await import('../panels/panel-ui.js');
  const { renderFeaturePanel } = await import('../app.js');
  showPanel('codex');
  await renderFeaturePanel('codex');
}
