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
// (`buildSearchUI`) ในแผงค้นหา · ดัชนีสร้างครั้งเดียวแล้วใช้ซ้ำจนกว่าไฟล์จะเปลี่ยน
// (`invalidateSearchIndex()` — บันทึกแท็บ/เปลี่ยนโปรเจกต์ + [alpha.161] ทุกการเขียน/ย้าย/ลบผ่าน kapi.onLocalWrite)
// [alpha.161 · S7] กล่องเต็มจอ (`openGlobalSearch`) ถอดแล้ว — ไม่มีใครเรียกมาหลายรุ่น
import { t, tf } from './i18n.js';
import { el, state, log, withBusyTask } from './core.js';   // withBusyTask = [alpha.162 · W5 ข้อ 2]
import { parseMdFile } from './md.js';
import { indexProject, SEARCH_SKIP_DIRS, searchPathMatters, highlightTerms, splitHighlight, matchDetail, indexMatches } from './search-engine.js';
import { gi } from './icons.js';
import { isCancelled } from './cancel.js';
import { createEpoch, runFresh } from './epoch-guard.js';   // [alpha.161 · C3]
import { panelEmpty, panelTitle } from './panels/panel-chrome.js';   // [alpha.162 · W2] ของกลางของเนื้อแผง

// ───────────────────────── ดัชนี (แคชระดับโมดูล) ─────────────────────────
// ES module: ค่าที่ reassign ต้องอยู่ใน object — กฎเหล็กข้อ 2 ของ AGENTS.md
const GS = {
  index: null,        // SearchIndex ตัวปัจจุบัน
  root: '',           // โปรเจกต์ที่ดัชนีตัวนี้เป็นของ
  json: false,        // ดัชนีนี้รวมไฟล์ .json ด้วยไหม
  building: null,     // Promise ของการสร้างที่กำลังวิ่ง (กันสร้างซ้อนตอนพิมพ์รัว)
  buildFor: null,     // [alpha.162 · W1-1] งานที่วิ่งอยู่เป็นของ `{root, json}` ไหน — ไม่ตรง = ห้ามเอาผลมาใช้
  stale: true,        // ไฟล์เปลี่ยนไปแล้วหรือยัง
  epoch: createEpoch(),   // [alpha.161 · C3] รุ่นของไฟล์ — งานสร้างที่เริ่มก่อน invalidate ต้องไม่ตั้ง stale=false ทับ
};

/** ไฟล์ในโปรเจกต์เปลี่ยน → ดัชนีเก่าใช้ไม่ได้แล้ว (บันทึกฉาก · สร้างต้นไม้ใหม่ · เปลี่ยนโปรเจกต์) */
export function invalidateSearchIndex() { GS.stale = true; GS.epoch.bump(); }

/**
 * [alpha.161 · C3] ★ ดัชนีค้นหาล้างเองเมื่อ "โครงไฟล์" เปลี่ยน — เดิมล้างแค่ตอนบันทึกแท็บ/เปลี่ยนโปรเจกต์
 * → ลบ/ย้าย/ทำสำเนาฉาก · เพิ่มโน้ต · ย้าย/สร้าง Wiki entity แล้วค้นหาได้ไฟล์ผี (ไม่มีแล้ว) หรือไม่เจอไฟล์ใหม่
 * ดักที่ `kapi.onLocalWrite` (preload ยิงให้ทุก writeFile/move/remove/copy ของหน้าต่างนี้) ทีเดียวครบทุกทาง
 * รวมทางที่จะเพิ่มในอนาคต · แค่ตั้งธง (ถูกมาก) — ดัชนีสร้างใหม่ตอนค้นครั้งถัดไปเท่านั้น
 * **ไม่ได้ผูกกับ buildTree()** (วาดต้นไม้บ่อยมากโดยไฟล์ไม่เปลี่ยน) · app.js เรียกครั้งเดียวตอนเริ่ม
 */
const HOOK = { on: false };
export function watchProjectWrites() {
  if (HOOK.on || typeof kapi === 'undefined' || !kapi || typeof kapi.onLocalWrite !== 'function') return false;
  HOOK.on = true;
  kapi.onLocalWrite((p) => { if (searchPathMatters(state.root, p)) invalidateSearchIndex(); });
  return true;
}

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
  const want = { root: state.root, json: includeJson };
  const held = () => ({ root: GS.root, json: GS.json, stale: GS.stale || !GS.index });
  if (indexMatches(held(), want)) return GS.index;
  // [alpha.162 · W1-1] งานสร้างที่วิ่งอยู่ — **ของคำขอเดียวกัน** เท่านั้นที่รอตัวเดียวกันได้
  // คนละโปรเจกต์/คนละขอบเขต = รอให้มันจบก่อน แล้วค่อยสร้างของเรา (เดิมคืนงานนั้นไปเลย = ได้ null/ดัชนีผิดขอบเขต)
  for (let i = 0; GS.building && i < 4; i++) {
    if (indexMatches({ ...GS.buildFor, stale: false }, want)) return GS.building;
    await GS.building.catch(() => {});
    if (indexMatches(held(), want)) return GS.index;
    if (state.root !== want.root) return null;      // เปลี่ยนโปรเจกต์อีกระหว่างรอ = คำขอนี้ตกรุ่น
  }
  const root = want.root;
  GS.buildFor = { root, json: includeJson };
  GS.building = (async () => {
    try {
      // [alpha.161 · C3] ไฟล์เปลี่ยนระหว่างสร้าง (ลบ/ย้าย/บันทึก) = สร้างใหม่ ไม่เกิน 2 รอบ
      // ครบแล้วยังเปลี่ยน → ใช้ค้นครั้งนี้ได้ แต่คง stale ไว้ (ค้นครั้งถัดไปสร้างใหม่ ไม่ชี้ไฟล์ผี)
      // [alpha.162 · W5 ข้อ 2] โปรเจกต์ใหญ่ใช้เวลาหลายวินาที → บอกจำนวนไฟล์ที่อ่านแล้ว + ยกเลิกได้
      const { value: idx, fresh } = await withBusyTask(t('ui.search.busyIndex'), ({ signal, progress }) =>
        runFresh(GS.epoch,
          () => indexProject(root, kapi, parseMdFile, { includeJson, skipDirs: SEARCH_SKIP_DIRS, signal, onProgress: progress }),
          { maxRounds: 2 }), { name: t('ui.search.indexName') });
      // สร้างเสร็จตอนผู้ใช้เปลี่ยนโปรเจกต์ไปแล้ว = ทิ้ง ไม่เอามาใช้กับของใหม่
      if (state.root !== root) return null;
      GS.index = idx; GS.root = root; GS.json = includeJson; GS.stale = !fresh;
      return idx;
    } catch (e) {
      if (isCancelled(e)) throw e;                 // ผู้ใช้ยกเลิก ≠ พัง · คนรอต้องรู้ (ไม่ใช่ "ไม่เจอผล")
      log('error', t('ui.search.globalSearchSearchFail'), e);
      return null;
    } finally { GS.building = null; GS.buildFor = null; }
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
 * @returns {Promise<Array<{file,name,type,matches:Array<{line:number,text:string,term:string,nth:number,start:number}>}>>}
 *   [alpha.161 · S5] อาร์เรย์มี `.total` = จำนวนไฟล์ที่เจอทั้งหมดก่อนตัดตาม limit (บอกผู้ใช้ว่าถูกตัด)
 */
export async function runProjectSearch(q, opts = {}) {
  const { includeJson = false, includeMd = true, nameOnly = false, limit = 60 } = opts;
  const query = String(q || '').trim();
  const done = (arr, total) => { arr.total = total; return arr; };
  if (!query || !state.root) return done([], 0);
  if (!includeMd && !includeJson) return done([], 0);   // ไม่เลือกชนิดไหนเลย = ไม่มีอะไรให้ค้น
  const wanted = (t2) => (t2 === 'md' ? includeMd : includeJson);

  // ── ค้นเฉพาะชื่อไฟล์: ไม่ต้องพึ่งดัชนีเนื้อหา (และต้องได้ผลแม้ดัชนียังสร้างไม่เสร็จ) ──
  if (nameOnly) {
    const ql = query.toLowerCase();
    const out = [];
    let total = 0;
    const skipTop = new Set(SEARCH_SKIP_DIRS.map((x) => x.toLowerCase()));   // [alpha.161 · C3]
    const walk = async (dir, depth = 0) => {
      for (const name of await kapi.listDirs(dir).catch(() => [])) {
        if (depth === 0 && skipTop.has(String(name).toLowerCase())) continue;
        await walk(await kapi.join(dir, name), depth + 1);
      }
      for (const f of await kapi.listFiles(dir, '').catch(() => [])) {
        const ext = extOf(f);
        if (!wanted(ext)) continue;
        if (!f.toLowerCase().includes(ql)) continue;
        total++;                                    // [alpha.161 · S5] นับต่อแม้เกิน limit
        if (out.length < limit) out.push({ file: await kapi.join(dir, f), name: f, type: ext,
                                           matches: [{ line: 0, text: f, term: query, nth: 0 }] });
      }
    };
    await walk(state.root);
    return done(out, total);
  }

  const idx = await ensureSearchIndex({ includeJson });
  if (!idx) return done([], 0);
  const terms = highlightTerms(query);
  // ขอผลทั้งหมดก่อนกรองชนิดไฟล์ — นับจำนวนจริงได้ และเลือกเฉพาะ .json แล้วไม่บางลงเพราะโดน limit ตัดไปก่อน
  const all = idx.search(query, { limit: Infinity })
    .filter((r) => wanted(extOf(r.path)));
  const hits = all.slice(0, limit).map((r) => {
    const body = ((idx.docs && idx.docs.get(r.id)) || {}).body || '';
    return {
      file: r.path,
      name: r.title || String(r.path).split(/[\\/]/).pop(),
      type: extOf(r.path),
      score: r.score,
      // [alpha.161 · S1] พกตำแหน่งที่เจอไปด้วย (เดิมทิ้งหมด → เปิดแล้วไปโผล่ต้นไฟล์ทุกครั้ง)
      matches: (r.matches || []).map((m) => {
        const d = matchDetail(body, m.pos, m.len, terms);
        return { line: m.line, text: m.snippet, term: d.term, nth: d.nth, start: d.start };
      }),
    };
  });
  return done(hits, all.length);
}

// ───────────────────────── UI (แผงค้นหา) ─────────────────────────

/**
 * เปิดผลลัพธ์หนึ่งรายการ แล้วกระโดดไปจุดที่เจอ — .md = เปิดเป็นฉาก · ที่เหลือ = แท็บข้อความล้วนที่บันทึกได้จริง
 * @param {object} h ผลค้นหา · @param {object} [m] จุดที่เจอ (ไม่ส่ง = จุดแรก)
 */
export async function openHit(h, m) {
  const app = await import('./app.js');
  const at = m || (h.matches || [])[0] || null;
  // [alpha.125] แท็บ JSON ใช้ `openPlainFile()` ตัวจริงของ app.js (เดิมประกอบเองสองก๊อป)
  if (h.type === 'md') await app.openScene(h.file, null);
  else await app.openPlainFile(h.file, h.name);
  const t2 = state.tabs.get(h.file);
  if (!t2 || !at || !at.term) return t2 || null;
  // openScene วาดตัวแก้ไขแบบ async — รอให้มีตัวแก้ไขจริงก่อน (แบบเดียวกับ Navigation ทั้งเล่ม)
  const ready = () => t2.editor || t2.sp || t2.plain || (t2.pane && t2.pane.querySelector('textarea.json-edit'));
  for (let i = 0; i < 25 && !ready(); i++) await new Promise((r) => setTimeout(r, 40));
  app.gotoSearchMatch(t2, at);
  return t2;
}

/** ข้อความสไนป์เพ็ตพร้อมไฮไลต์ — node ล้วน ไม่ผ่าน innerHTML (กฎข้อ 11: เป็นข้อความของผู้ใช้) */
function snippetNode(cls, text, terms) {
  const box = el('div', cls);
  for (const seg of splitHighlight(text, terms)) {
    if (seg.hl) box.append(el('mark', 'k-gsearch-hl', seg.text));
    else box.append(document.createTextNode(seg.text));
  }
  return box;
}

const SEARCH_DEBOUNCE_MS = 250;

/**
 * ประกอบหน้าจอค้นหาลง `host` — คืนตัวช่วยไว้ให้ผู้เรียก/เทสสั่งงาน
 * [alpha.161 · S] ค้นสดแบบหน่วง ~250ms (Enter = ค้นทันที/เปิดผลที่เลือก) · ↑↓ เลือกผล · Esc ล้าง
 * @param {HTMLElement} host
 * @param {{onOpen?: () => void}} opts onOpen = ทำอะไรก่อนเปิดไฟล์
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
  // [alpha.156] ค้นแล้วแทนที่ทั้งโปรเจกต์ต่อได้เลย (เดิมแทนที่ได้แค่ในฉากที่เปิดอยู่)
  const replB = el('button', 'k-gsearch-replace', t('ui.replace.openBtn'));
  replB.onclick = async () => {
    const m = await import('./project-replace-ui.js');
    m.openProjectReplace(qInput.value.trim());
  };
  typeRow.append(replB);
  host.append(searchRow, typeRow);

  // [alpha.125 ข้อ A] คำใบ้ไวยากรณ์ — ความสามารถพวกนี้มีมาตลอดในเอนจิน แต่ไม่เคยมีใครรู้
  host.append(el('div', 'k-hint k-gsearch-help', t('ui.search.syntaxHint')));

  const results = el('div', 'k-gsearch-results');
  const status = el('div', 'dim k-gsearch-status');
  host.append(results, status);

  // ── สถานะของรอบค้นหา ──
  // job = เลขรอบล่าสุดที่ "สั่ง" · shownQ = คำค้นของผลที่อยู่บนจอ (Enter เปิดผลได้เฉพาะเมื่อผลตรงคำค้นตอนนี้)
  const S = { job: 0, timer: 0, hits: [], sel: -1, shownQ: null, busy: false };
  const cards = () => [...results.querySelectorAll('.k-gsearch-hit')];
  const select = (i) => {
    const list = cards();
    if (!list.length) { S.sel = -1; return -1; }
    S.sel = Math.max(0, Math.min(i, list.length - 1));
    list.forEach((c, k) => { c.classList.toggle('on', k === S.sel); c.setAttribute('aria-selected', k === S.sel ? 'true' : 'false'); });
    try { list[S.sel].scrollIntoView({ block: 'nearest' }); } catch {}
    return S.sel;
  };
  const openAt = async (h, m) => {
    if (onOpen) onOpen();
    return openHit(h, m);
  };

  const show = (hits, terms) => {
    results.replaceChildren();
    S.hits = hits; S.sel = -1;
    if (!hits.length) { results.append(el('div', 'dim', t('ui.search.notFoundResult'))); return; }
    for (const h of hits) {
      const card = el('div', 'k-gsearch-hit');
      const head = el('div', 'k-gsearch-hit-head');
      // กฎข้อ 11: ชื่อไฟล์/ชื่อฉากเป็นข้อความของผู้ใช้ → text node เท่านั้น
      head.append(el('span', 'k-gsearch-hit-name', (h.type === 'md' ? gi('file') + ' ' : gi('clipboard') + ' ') + h.name));
      let rel = h.file;
      try { rel = kapi.relative ? kapi.relative(state.root, h.file) : h.file; } catch {}
      head.append(el('span', 'k-gsearch-hit-path', String(rel)));
      card.append(head);
      for (const m of (h.matches || []).slice(0, 3)) {
        const line = snippetNode('k-gsearch-line', m.text || '', terms);
        if (m.line) line.title = t('ui.search.lineNo') + m.line;
        // [alpha.161 · S1] คลิกบรรทัดไหน = ไปจุดนั้น (ไม่ใช่จุดแรกของไฟล์)
        line.addEventListener('click', (e) => { e.stopPropagation(); openAt(h, m); });
        card.append(line);
      }
      const openB = el('button', 'k-ok k-gsearch-open', t('ui.common.open'));
      const go = (e) => { if (e) e.stopPropagation(); return openAt(h); };
      openB.onclick = go;
      card.addEventListener('click', go);
      results.append(card);
    }
  };

  const doSearch = async (q) => {
    clearTimeout(S.timer); S.timer = 0;
    const mine = ++S.job;
    const query = String(q || '').trim();
    if (!query) { results.replaceChildren(); status.textContent = ''; S.hits = []; S.sel = -1; S.shownQ = null; S.busy = false; return []; }
    // [alpha.161 · S4] บอกว่ากำลังค้น แต่ **ไม่ล้างผลเก่าทิ้ง** ระหว่างพิมพ์ (ไม่กะพริบทุกตัวอักษร)
    S.busy = true;
    status.textContent = t('ui.search.busySearch');
    status.classList.add('is-busy');
    if (!S.hits.length) results.replaceChildren(el('div', 'dim', t('ui.search.busySearch')));
    try {
      const hits = await runProjectSearch(query, {
        includeJson: chkJson.checked, includeMd: chkMd.checked, nameOnly: chkName.checked,
      });
      if (mine !== S.job) return hits;         // มีรอบใหม่แซงแล้ว — ทิ้งผลรอบนี้ (ไม่แตะจอ/สถานะ)
      show(hits, chkName.checked ? [query] : highlightTerms(query));
      S.shownQ = query; S.busy = false;
      status.classList.remove('is-busy');
      if (hits.length) select(0);
      const total = Number.isFinite(hits.total) ? hits.total : hits.length;
      const st = searchIndexStats();
      // [alpha.161 · S5] ถูกตัดผล = บอกทั้งจำนวนที่เจอและจำนวนที่แสดง
      status.textContent = (total > hits.length ? tf('ui.search.foundShowN', total, hits.length) : tf('ui.search.foundFile', hits.length))
        + (chkName.checked ? '' : ' · ' + tf('ui.search.indexedN', st.documents));
      return hits;
    } catch (e) {
      if (mine !== S.job) return [];
      S.busy = false; status.classList.remove('is-busy');
      // [alpha.162 · W5 ข้อ 2] ยกเลิกการสร้างดัชนี = คงผลเดิมไว้ · บอกว่ายกเลิก (ไม่ใช่ "เกิดข้อผิดพลาด")
      if (isCancelled(e)) { status.textContent = t('ui.search.indexCancelled'); return []; }
      log('error', t('ui.search.globalSearchSearchFail'), e);
      results.replaceChildren(el('div', 'dim', t('ui.search.occurError')));
      status.textContent = t('ui.search.searchFail');
      return [];
    }
  };
  const schedule = () => {
    clearTimeout(S.timer);
    S.timer = setTimeout(() => { S.timer = 0; doSearch(qInput.value); }, SEARCH_DEBOUNCE_MS);
  };

  qInput.oninput = schedule;
  // [alpha.161 · S3] คีย์เดียวกับ quick-open: ↑↓ เลือก · Enter เปิดผลที่เลือก · Esc ล้าง
  qInput.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!S.hits.length) return;
      e.preventDefault();
      select(S.sel < 0 ? 0 : S.sel + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = qInput.value.trim();
      // ผลบนจอยังไม่ตรงคำค้นตอนนี้ (กำลังหน่วง/ยังไม่เคยค้น) = ค้นทันที · ตรงแล้ว = เปิดผลที่เลือก
      if (S.timer || S.busy || S.shownQ !== q || S.sel < 0 || !S.hits[S.sel]) doSearch(qInput.value);
      else openAt(S.hits[S.sel]);
    } else if (e.key === 'Escape') {
      if (!qInput.value && !S.hits.length) return;   // ว่างอยู่แล้ว = ปล่อยให้ตัวอื่นจัดการ Esc
      e.preventDefault(); e.stopPropagation();
      qInput.value = '';
      doSearch('');
    }
  };
  // [alpha.161 · C3] ขอบเขตไฟล์เปลี่ยน = ดัชนีใหม่ (ผ่านตัวล้างกลาง ให้รุ่นของดัชนีเดินด้วย)
  chkJson.onchange = () => { invalidateSearchIndex(); doSearch(qInput.value); };
  chkMd.onchange = () => doSearch(qInput.value);
  chkName.onchange = () => doSearch(qInput.value);

  return { qInput, results, status, doSearch, chkMd, chkJson, chkName,
           selected: () => S.sel, hits: () => S.hits, pending: () => !!S.timer || S.busy };
}

/** แผงค้นหา (มุมมอง → แผง → ค้นหา) — ทางเข้าเดียวของการค้นหาทั้งโปรเจกต์ (Ctrl+Shift+F) */
export async function renderSearchPanel(host) {
  if (!host) return null;
  if (!state.root) {
    host.replaceChildren(panelEmpty(t('ui.common.cantOpenProject')));
    return null;
  }
  host.replaceChildren();
  host.append(panelTitle(t('ui.search.searchProject')));   // [alpha.162 · W2] เดิมยืมหัวของ *กล่องโต้ตอบ* มาใช้
  const body = el('div', 'k-gsearch-body');
  host.append(body);
  const ui = buildSearchUI(body);
  // อุ่นดัชนีไว้เลยระหว่างผู้ใช้กำลังพิมพ์ — กดค้นครั้งแรกจะได้ไม่ต้องรอ
  ensureSearchIndex({ includeJson: false }).catch(() => {});
  return ui;
}
