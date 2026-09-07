// global-search.js — ค้นหาทั้งโปรเจกต์ (Ctrl+Shift+F)
//
// ═══ [alpha.125 ข้อ A] ★ เลิกสแกนไฟล์เอง — ใช้ `search-engine.js` ที่มีอยู่แล้ว ═══
//
// เดิมไฟล์นี้มี **ตัวค้นหาสองชุดที่เขียนแยกกันคนละก๊อป** (กล่องเต็มจอ + แผงค้นหา)
// ทั้งคู่ไล่ `listDirs` → `readFile` → `indexOf(คำ)` ทีละบรรทัดทุกครั้งที่กดค้น
// ผลคือ: ค้นทีนึงอ่านทั้งโปรเจกต์ใหม่ทั้งกอง · ค้นได้แค่ "สตริงตรงตัว" ·
// แก้บั๊กต้องแก้สองที่ · และ `search-engine.js` (inverted index + ตัดคำไทย + AND/OR/NOT +
// `title:` `tags:` `status:` · มี unit test 23 ข้อ) นอนเป็น orphan อยู่เฉย ๆ ตั้งแต่ alpha.39
//
// ตอนนี้: **ตัวค้นหาตัวเดียว** (`runProjectSearch`) ที่ต่อกับเอนจินจริง + **UI ตัวเดียว**
// (`buildSearchUI`) ที่กล่องเต็มจอกับแผงใช้ร่วมกัน · ดัชนีสร้างครั้งเดียวแล้วใช้ซ้ำ
// จนกว่าไฟล์จะเปลี่ยน (`invalidateSearchIndex()` — app.js เรียกให้ตอนบันทึก/สร้างต้นไม้ใหม่)
import { t, tf } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import { parseMdFile } from './md.js';
import { escClose } from './ui.js';
import { indexProject } from './search-engine.js';

// ───────────────────────── ดัชนี (แคชระดับโมดูล) ─────────────────────────
// ES module: ค่าที่ reassign ต้องอยู่ใน object — กฎเหล็กข้อ 2 ของ AGENTS.md
const GS = {
  index: null,        // SearchIndex ตัวปัจจุบัน
  root: '',           // โปรเจกต์ที่ดัชนีตัวนี้เป็นของ
  json: false,        // ดัชนีนี้รวมไฟล์ .json ด้วยไหม
  building: null,     // Promise ของการสร้างที่กำลังวิ่ง (กันสร้างซ้อนตอนพิมพ์รัว)
  stale: true,        // ไฟล์เปลี่ยนไปแล้วหรือยัง
};

/** ไฟล์ในโปรเจกต์เปลี่ยน → ดัชนีเก่าใช้ไม่ได้แล้ว (บันทึกฉาก · สร้างต้นไม้ใหม่ · เปลี่ยนโปรเจกต์) */
export function invalidateSearchIndex() { GS.stale = true; }

/** สถานะดัชนีสำหรับ UI/เทส — `{ ready, documents, terms, root }` */
export function searchIndexStats() {
  const s = GS.index ? GS.index.stats() : { documents: 0, terms: 0 };
  return { ready: !!GS.index && !GS.stale, root: GS.root, ...s };
}

/**
 * สร้าง/คืนดัชนีของโปรเจกต์ปัจจุบัน
 * สร้างใหม่เมื่อ: ยังไม่เคยมี · เปลี่ยนโปรเจกต์ · ขอบเขตไฟล์เปลี่ยน (.json) · ไฟล์ถูกแก้
 */
export async function ensureSearchIndex({ includeJson = false } = {}) {
  if (!state.root) return null;
  const fresh = GS.index && !GS.stale && GS.root === state.root && GS.json === includeJson;
  if (fresh) return GS.index;
  if (GS.building) return GS.building;          // มีคนสั่งสร้างอยู่แล้ว — รอตัวเดียวกัน
  const root = state.root;
  GS.building = (async () => {
    try {
      const idx = await indexProject(root, kapi, parseMdFile, { includeJson });
      // สร้างเสร็จตอนผู้ใช้เปลี่ยนโปรเจกต์ไปแล้ว = ทิ้ง ไม่เอามาใช้กับของใหม่
      if (state.root !== root) return null;
      GS.index = idx; GS.root = root; GS.json = includeJson; GS.stale = false;
      return idx;
    } catch (e) {
      log('error', t('ui.search.globalSearchSearchFail'), e);
      return null;
    } finally { GS.building = null; }
  })();
  return GS.building;
}

// ───────────────────────── ตัวค้นหา (ตัวเดียวของทั้งโปรแกรม) ─────────────────────────

/** ชนิดไฟล์จากนามสกุล — ใช้เลือกไอคอนและวิธีเปิด */
const extOf = (p) => String(p || '').split('.').pop().toLowerCase();

/**
 * ค้นทั้งโปรเจกต์
 * @param {string} q คำค้น — รองรับ `AND` `OR` `NOT` และ `title:` `tags:` `status:`
 * @param {{includeJson?:boolean, nameOnly?:boolean, limit?:number}} opts
 * @returns {Promise<Array<{file,name,type,matches:Array<{line:number,text:string}>}>>}
 */
export async function runProjectSearch(q, opts = {}) {
  const { includeJson = false, includeMd = true, nameOnly = false, limit = 60 } = opts;
  const query = String(q || '').trim();
  if (!query || !state.root) return [];
  if (!includeMd && !includeJson) return [];        // ไม่เลือกชนิดไหนเลย = ไม่มีอะไรให้ค้น
  const wanted = (t2) => (t2 === 'md' ? includeMd : includeJson);

  // ── ค้นเฉพาะชื่อไฟล์: ไม่ต้องพึ่งดัชนีเนื้อหา (และต้องได้ผลแม้ดัชนียังสร้างไม่เสร็จ) ──
  if (nameOnly) {
    const ql = query.toLowerCase();
    const out = [];
    const walk = async (dir) => {
      for (const name of await kapi.listDirs(dir).catch(() => [])) await walk(await kapi.join(dir, name));
      for (const f of await kapi.listFiles(dir, '').catch(() => [])) {
        const ext = extOf(f);
        if (!wanted(ext)) continue;
        if (!f.toLowerCase().includes(ql)) continue;
        out.push({ file: await kapi.join(dir, f), name: f, type: ext,
                   matches: [{ line: 0, text: f }] });
        if (out.length >= limit) return;
      }
    };
    await walk(state.root);
    return out.slice(0, limit);
  }

  const idx = await ensureSearchIndex({ includeJson });
  if (!idx) return [];
  // ขอผลเผื่อไว้ก่อนกรองชนิดไฟล์ ไม่งั้นเลือกเฉพาะ .json แล้วได้ผลบางลงเพราะโดน limit ตัดไปก่อน
  return idx.search(query, { limit: limit * 3 })
    .map((r) => ({
      file: r.path,
      name: r.title || String(r.path).split(/[\\/]/).pop(),
      type: extOf(r.path),
      score: r.score,
      matches: (r.matches || []).map((m) => ({ line: m.line, text: m.snippet })),
    }))
    .filter((h) => wanted(h.type))
    .slice(0, limit);
}

// ───────────────────────── UI (กล่องเต็มจอ + แผง ใช้ตัวเดียวกัน) ─────────────────────────

/** เปิดผลลัพธ์หนึ่งรายการ — .md = เปิดเป็นฉาก · ที่เหลือ = แท็บข้อความล้วนที่บันทึกได้จริง */
async function openHit(h) {
  const app = await import('./app.js');
  if (h.type === 'md') return app.openScene(h.file, null);
  // [alpha.125] เดิมประกอบแท็บ JSON เองตรงนี้ **สองก๊อป** และก๊อปหนึ่งเรียก `require()`
  // ซึ่งไม่มีใน renderer (พังเงียบ) · ใช้ `openPlainFile()` ตัวจริงของ app.js แทน
  return app.openPlainFile(h.file, h.name);
}

/**
 * ประกอบหน้าจอค้นหาลง `host` — คืนตัวช่วยไว้ให้ผู้เรียก/เทสสั่งงาน
 * @param {HTMLElement} host
 * @param {{onOpen?: () => void}} opts onOpen = ทำอะไรก่อนเปิดไฟล์ (กล่องใช้ปิดตัวเอง)
 */
export function buildSearchUI(host, { onOpen } = {}) {
  host.replaceChildren();

  const searchRow = el('div', 'k-row k-gsearch-row');
  const qInput = el('input', 'k-dlg-input k-gsearch-input');
  qInput.type = 'text';
  qInput.placeholder = t('ui.search.searchAllFileMd');
  searchRow.append(qInput);

  const typeRow = el('div', 'k-row k-gsearch-types');
  const mkChk = (label, def) => {
    const w = el('label', null);
    const c = el('input'); c.type = 'checkbox'; c.checked = def;
    w.append(c, document.createTextNode(' ' + label));
    typeRow.append(w);
    return c;
  };
  // [alpha.125] คงตัวเลือกชนิดไฟล์ครบสามช่องเหมือนเดิม — "ค้นเฉพาะ .json" เป็นงานจริง
  // (ไล่ดูโครง scenes.json / เอนทิตี้ Wiki) ที่ทำไม่ได้เลยถ้าไม่มีช่องปิด .md
  const chkMd = mkChk(t('ui.search.mdSceneNoteMemo'), true);
  const chkJson = mkChk('.json (Wiki/scenes/section)', false);
  const chkName = mkChk(t('ui.search.searchOnlyNameFile'), false);
  host.append(searchRow, typeRow);

  // [alpha.125 ข้อ A] คำใบ้ไวยากรณ์ — ความสามารถพวกนี้มีมาตลอดในเอนจิน แต่ไม่เคยมีใครรู้
  host.append(el('div', 'k-hint k-gsearch-help', t('ui.search.syntaxHint')));

  const results = el('div', 'k-gsearch-results');
  const status = el('div', 'dim k-gsearch-status');
  host.append(results, status);

  let job = 0;
  const show = (hits) => {
    results.replaceChildren();
    if (!hits.length) { results.append(el('div', 'dim', t('ui.search.notFoundResult'))); return; }
    for (const h of hits) {
      const card = el('div', 'k-gsearch-hit');
      const head = el('div', 'k-gsearch-hit-head');
      // กฎข้อ 11: ชื่อไฟล์/ชื่อฉากเป็นข้อความของผู้ใช้ → el(tag, cls, text) เท่านั้น
      head.append(el('span', 'k-gsearch-hit-name', (h.type === 'md' ? '📄 ' : '📋 ') + h.name));
      let rel = h.file;
      try { rel = kapi.relative ? kapi.relative(state.root, h.file) : h.file; } catch {}
      head.append(el('span', 'k-gsearch-hit-path', String(rel)));
      card.append(head);
      for (const m of (h.matches || []).slice(0, 3)) {
        const line = el('div', 'k-gsearch-line', m.text || '');
        if (m.line) line.title = t('ui.search.lineNo') + m.line;
        card.append(line);
      }
      const openB = el('button', 'k-ok k-gsearch-open', t('ui.common.open'));
      const go = async (e) => {
        if (e) e.stopPropagation();
        if (onOpen) onOpen();
        await openHit(h);
      };
      openB.onclick = go;
      card.addEventListener('click', go);
      results.append(card);
    }
  };

  const doSearch = async (q) => {
    const mine = ++job;
    if (!String(q || '').trim()) { results.replaceChildren(); status.textContent = ''; return []; }
    status.textContent = t('ui.search.busySearch');
    results.replaceChildren(el('div', 'dim', t('ui.search.busySearch')));
    try {
      const hits = await runProjectSearch(q, {
        includeJson: chkJson.checked, includeMd: chkMd.checked, nameOnly: chkName.checked,
      });
      if (mine !== job) return hits;          // มีรอบใหม่แซงแล้ว — ทิ้งผลรอบนี้
      show(hits);
      const st = searchIndexStats();
      status.textContent = tf('ui.search.foundFile', hits.length)
        + (chkName.checked ? '' : ' · ' + tf('ui.search.indexedN', st.documents));
      return hits;
    } catch (e) {
      if (mine !== job) return [];
      log('error', t('ui.search.globalSearchSearchFail'), e);
      results.replaceChildren(el('div', 'dim', t('ui.search.occurError')));
      status.textContent = t('ui.search.searchFail');
      return [];
    }
  };

  qInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(qInput.value); } };
  chkJson.onchange = () => { GS.stale = true; doSearch(qInput.value); };
  chkMd.onchange = () => doSearch(qInput.value);
  chkName.onchange = () => doSearch(qInput.value);

  return { qInput, results, status, doSearch, chkMd, chkJson, chkName };
}

/** กล่องค้นหาเต็มจอ (Ctrl+Shift+F) */
export async function openGlobalSearch() {
  if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return null; }
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-gsearch');
  box.append(el('div', 'k-dlg-title', t('ui.search.searchProject')));
  const body = el('div', 'k-gsearch-body');
  box.append(body);

  const btns = el('div', 'k-dlg-btns');
  const closeB = el('button', 'k-ok', t('ui.common.close'));
  btns.append(closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);

  const close = () => ov.remove();
  closeB.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  escClose(ov, close);

  const ui = buildSearchUI(body, { onOpen: close });
  ui.qInput.focus();
  // อุ่นดัชนีไว้เลยระหว่างผู้ใช้กำลังพิมพ์ — กดค้นครั้งแรกจะได้ไม่ต้องรอ
  ensureSearchIndex({ includeJson: false }).catch(() => {});
  return ov;
}

/** แผงค้นหา (มุมมอง → แผง → ค้นหา) — เนื้อเดียวกับกล่อง ต่างแค่ที่อยู่ */
export async function renderSearchPanel(host) {
  if (!host) return null;
  if (!state.root) {
    host.replaceChildren(el('div', 'k-panel-empty', t('ui.common.cantOpenProject')));
    return null;
  }
  host.replaceChildren();
  host.append(el('div', 'k-dlg-title', t('ui.search.searchProject')));
  const body = el('div', 'k-gsearch-body');
  host.append(body);
  const ui = buildSearchUI(body);
  ensureSearchIndex({ includeJson: false }).catch(() => {});
  return ui;
}
