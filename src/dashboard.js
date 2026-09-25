// dashboard.js — แดชบอร์ดโปรเจกต์ (สถิติ/analytics/ฉากปักหมุด/ไปต่อจากที่ค้าง)
// แยกจาก app.js — feature นี้เป็นจุดที่ feature ใหม่ (แก้แดชบอร์ด, กราฟ, theme) จะมาต่อยอด
import { t, tf } from './i18n.js';
import { CHART_SERIES, STATUS_UNSET, themeColor } from './palette.js';   // [alpha.162 · W6 ข้อ 2]
import { $, state, el, dataLabel, log } from './core.js';
import { allStatuses, statusColor } from './custom-status.js';
import { vivid, inkOn } from './color-util.js';
import { ACTIVITY_RANGES, READ_WPM, readingTime, activitySeries, milestones, nextMilestone, projectStartDay, statusBreakdown } from './dashboard-stats.js';
import { parseMdFile, countWords } from './md.js';
import { getWordHistory, calcStreak } from './word-history.js';
import { renderChoicePanel, showPlayerHistory } from './player-choices.js';
import { findScenePath } from './project-scan.js';
// ฟังก์ชันที่ยังอยู่ใน app.js (เรียกตอน runtime เท่านั้น — circular import ปลอดภัยกับ esbuild bundle)
import { loadAllEntities, catIconEl, catLabel, openScene, renderFeaturePanel } from './app.js';
import { guid } from './app.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';
import { gi } from './icons.js';
import { fmtDate, fmtNum } from './locale.js';

/**
 * บั๊ก #18: แดชบอร์ดเป็น "แผง" ไม่ใช่แท็บเอกสารอีกต่อไป
 * เดิมสร้าง .pane ใน #panes + .tab ใน #tabs ไปแย่งที่กับฉากที่กำลังเขียน
 */
export async function openDashboard() {
  showPanel('dashboard');              // hook ใน app.js เริ่มวาดให้ · await รอบเดียวกันต่อ
  return renderFeaturePanel('dashboard');
}
/** วาดใหม่ถ้าแผงเปิดค้างอยู่ (เรียกหลังบันทึกตั้งค่า/แก้ข้อมูล) */
export function refreshDashboardIfOpen() {
  if (isPanelOpen('dashboard') && $('#dash-body')) renderDashboard($('#dash-body'));
}

/**
 * ══ [alpha.100] ★★ ตัววาดที่กิน await ยาว ๆ ต้อง **ตรึงโปรเจกต์ไว้ก่อน** ══
 *
 * บั๊กที่เงียบมาหลายรุ่น: ทุกครั้งที่เปิด/สลับโปรเจกต์ log จะมี
 *   `ERROR วาดแผง dashboard ล้มเหลว | path:join ... Received null`
 * ไม่มีอาการใน UI เลย · e2e เขียวตลอด · เจอเพราะไปไล่อ่าน `<userData>/logs/app-*.log`
 *
 * ต้นตอ: แดชบอร์ดอ่านไฟล์ทั้งโปรเจกต์ = มี `await` หลายสิบจุด และมันอ่าน `state.root`
 * **ใหม่ทุกครั้ง** ระหว่างทาง · ถ้าผู้ใช้ (หรือ e2e) สลับโปรเจกต์ระหว่างที่ยังวาดไม่จบ
 * `closeProjectIfAny()` จะตั้ง `state.root = null` แล้วรอบวนถัดไปก็ระเบิด
 * ของจริงคราวนั้นตายที่ `[null , Recycle]` — คือลูปไล่โฟลเดอร์ระดับราก วนมาถึงใบที่ 9
 * (`Recycle` เป็นโฟลเดอร์มาตรฐานของทุกโปรเจกต์) พอดีกับจังหวะที่โปรเจกต์ถูกปิด
 *
 * แก้ที่หลักการ ไม่ใช่ที่จุดตาย: **ตรึง `root` ไว้ตั้งแต่ต้น** แล้วใช้ตัวนั้นตลอด ·
 * และเช็ค `stale()` ที่หัวลูป — โปรเจกต์เปลี่ยนเมื่อไหร่ก็เลิกวาดอย่างสงบ
 * (ไม่ใช่แค่กัน error — ถ้าปล่อยให้วาดต่อ ตัวเลขของโปรเจกต์เก่าจะไปโผล่ในแผงของโปรเจกต์ใหม่)
 *
 * @returns {Promise<boolean>} false = ไม่ได้วาด (ยังไม่มีโปรเจกต์ หรือโปรเจกต์เปลี่ยนกลางคัน)
 */
export async function renderDashboard(pane) {
  const root = state.root;
  if (!root) return false;                  // ยังไม่มีโปรเจกต์ = ไม่มีอะไรให้วาด (ไม่ใช่ข้อผิดพลาด)
  const stale = () => state.root !== root;  // โปรเจกต์ถูกปิด/สลับระหว่างวาด
  // [alpha.165] ★ ผู้ใช้: "เลื่อนแดชบอร์ดลงล่างสุด ปิดแผงแล้วเปิดใหม่ = เสี้ยววินาทีไปบนสุดแล้วเลื่อนลงมา"
  //   ต้นตอ: เปิดแผงทีไรวาดใหม่ โดย **ล้างเนื้อเดิมก่อน** แล้วค่อยรออ่านไฟล์ทั้งโปรเจกต์ (await หลายสิบจุด)
  //   → แผงว่างอยู่ช่วงหนึ่ง ตำแหน่งเลื่อนถูกหนีบเป็น 0 แล้วค่อยถูกคืนตอนเนื้อกลับมา (= กระโดด/ไหล)
  //   แก้: มีเนื้อเดิมอยู่แล้ว = ประกอบฉบับใหม่นอกจอ แล้วสลับทีเดียวตอนเสร็จพร้อมตำแหน่งเลื่อนเดิม
  //   (ครั้งแรกที่ยังว่าง = วางทันทีให้เห็นตัวเลขไหลเข้ามาเหมือนเดิม) · โปรเจกต์เปลี่ยนกลางทาง = ไม่แตะของเดิม
  const wrap = el('div', 'dash-wrap');
  const firstPaint = !pane.querySelector(':scope > .dash-wrap');
  if (firstPaint) { pane.innerHTML = ''; pane.append(wrap); }
  wrap.append(el('div', 'dash-title', state.title));
  const cards = el('div', 'dash-cards'); wrap.append(cards);
  const card = (label) => {
    const c = el('div', 'dash-card');
    const v = el('div', 'dash-num', '…');
    c.append(v, el('div', 'dash-label', label));
    cards.append(c); return v;
  };
  const vCh = card(t('ui.dash.statChapters')), vSc = card(t('ui.dash.statScenes')), vW = card(t('ui.dash.wordAll'));
  // [alpha.157] ผู้ใช้: "เพิ่มในสถิติ คือ เวลาอ่านรวม ลงไปในสถิติใหญ่"
  const vRead = card(t('ui.dash.readTime'));
  const vE = card(t('ui.dash.wikiEntities'));   // [alpha.164 ข้อ B4] เดิมเป็นอังกฤษฮาร์ดโค้ด
  let nCh = 0, nSc = 0, words = 0;
  const sceneRows = [];
  const sceneStatuses = [];       // สถานะของทุกฉาก (สรุปตามคอลัมน์ Kanban)
  const sceneTexts = [];          // เนื้อฉากทั้งหมด (คำที่ใช้บ่อย)
  const chapterWords = [];        // { title, words, scenes }
  for (const secName of await kapi.listDirs(root)) {
    if (stale()) return false;              // ★ จุดที่เคยตาย — โปรเจกต์ปิดไปแล้วระหว่างวนลูป
    const secPath = await kapi.join(root, secName);
    if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
    const draftRoot = await kapi.join(secPath, 'Draft');
    if (!(await kapi.exists(draftRoot))) continue;
    for (const dname of await kapi.listDirs(draftRoot)) {
      if (stale()) return false;
      const dPath = await kapi.join(draftRoot, dname);
      const df = await kapi.join(dPath, 'draft.json');
      if (!(await kapi.exists(df))) continue;
      const chapters = (await kapi.readJson(df)).chapters || [];
      const scAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
      nCh += chapters.length;
      for (const ch of chapters) {
        let cw = 0, cs = 0;
        for (const sc of scAll[ch.guid] || []) {
          nSc++; cs++;
          sceneStatuses.push(sc.status || '');
          const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
          try {
            const { body } = parseMdFile(await kapi.readFile(file));
            const w = countWords(body); words += w; cw += w;
            sceneRows.push({ title: sc.title, ch: ch.title, file, flag: sc.flag });
            sceneTexts.push({ id: sc.id, title: sc.title, text: body });
          } catch {}
        }
        chapterWords.push({ title: ch.title, words: cw, scenes: cs });
      }
    }
  }
  vCh.textContent = fmtNum(nCh);
  vSc.textContent = fmtNum(nSc);
  vW.textContent = fmtNum(words);
  {
    const rt = readingTime(words);
    vRead.textContent = rt.hours ? tf('ui.dash.readHM', rt.hours, rt.mins) : tf('ui.dash.readM', rt.minutes);
    vRead.title = tf('ui.dash.readHint', READ_WPM);
  }
  // [alpha.157] เฉพาะ entity ของ Wiki — loadAllEntities พ่วงโหนดโครงสร้าง (บท/ฉาก/เล่ม) มาให้ผังเรื่องด้วย
  // ซึ่งทำให้การ์ด "Wiki entities" นับบท/ฉากรวม และแผง "Wiki ตามหมวด" มีหมวด scene/chapter โผล่
  // [alpha.159 · QoL] อ่าน Wiki พัง (ไฟล์ JSON เสียสักไฟล์) ต้องไม่ทำให้แดชบอร์ดทั้งหน้าหยุดวาด
  let allEnts = [];
  try {
    allEnts = (await loadAllEntities()).filter((e) => /[\\/](Wiki|Bible)[\\/]/.test(String(e.file || '')));
  } catch (e) { log('warn', t('ui.dash.entitiesFail'), e); }
  vE.textContent = fmtNum(allEnts.length);
  // ความคืบหน้าเทียบเป้าหมายทั้งโปรเจกต์ (ตั้งได้ในตั้งค่าโปรเจกต์)
  const goal = parseInt(state.goals.projectWords, 10) || 0;
  if (goal > 0) {
    const pct = Math.min(100, Math.round((words / goal) * 100));
    const gwrap = el('div', 'dash-goal');
    gwrap.append(el('div', 'dash-goal-label',
      tf('ui.dash.goalWord', fmtNum(words), fmtNum(goal), pct)));
    const bar = el('div', 'dash-goal-bar');
    const fill = el('div', 'dash-goal-fill'); fill.style.width = pct + '%';
    bar.append(fill); gwrap.append(bar);
    wrap.append(gwrap);
  }

  // ---- [alpha.157] กิจกรรมการเขียน: ช่วง 7d/30d/90d/ทั้งหมด · วันเริ่มโปรเจกต์ · หลักไมล์ ----
  wrap.append(buildActivity(goal, words));

  // ---- สถิติเชิงลึก (analytics) ----
  // แถบสัดส่วน (คืน element) — ใช้ซ้ำได้ทั้งสถานะ/หมวด
  const statBars = (rows, total, palette) => {
    const box2 = el('div', 'dash-stat');
    const max = Math.max(1, ...rows.map((r) => r.n));
    rows.forEach((r, i) => {
      const line = el('div', 'dash-stat-row');
      const nameEl = el('div', 'dash-stat-name');
      // [alpha.160 · P2] `label` = ข้อความ (ชื่อบท/หมวดของผู้ใช้) → textContent เท่านั้น · ไอคอน (ของโปรแกรม) แยกเป็น node
      // เดิม `innerHTML = r.label` โดย label = ชื่อบทที่ผู้ใช้ตั้ง → ชื่อบท `<img onerror=…>` รันโค้ดในหน้าที่มี kapi ได้
      if (r.icon) nameEl.append(r.icon, document.createTextNode(' '));
      nameEl.append(document.createTextNode(String(r.label ?? '')));
      line.append(nameEl);
      const track = el('div', 'dash-stat-track');
      const fill = el('div', 'dash-stat-fill');
      fill.style.width = Math.round((r.n / max) * 100) + '%';
      fill.style.background = r.color || palette[i % palette.length];
      track.append(fill); line.append(track);
      const pct = total ? Math.round((r.n / total) * 100) : 0;
      line.append(el('div', 'dash-stat-val', `${fmtNum(r.n)} (${pct}%)`));
      box2.append(line);
    });
    return box2;
  };
  const PAL = CHART_SERIES;   // [alpha.162 · W6 ข้อ 2] palette.js

  if (nSc > 0) {
    const grid = el('div', 'dash-analytics'); wrap.append(grid);

    // [alpha.157] สถานะตามคอลัมน์ Kanban (สี/ลำดับชุดเดียวกับกระดาน) + ปุ่มเปิดกระดาน
    grid.append(buildKanbanSummary(sceneStatuses, nSc));

    // Wiki ตามหมวด
    if (allEnts.length) {
      const byCat = {};
      for (const e of allEnts) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
      const right2 = el('div', 'dash-apanel');
      right2.append(el('div', 'dash-apanel-title', t('ui.dash.wikiCat')));
      right2.append(statBars(
        Object.entries(byCat).sort((a, b) => b[1] - a[1])
          .map(([c, n]) => ({ icon: catIconEl(c), label: catLabel(c), n })), allEnts.length, PAL));
      grid.append(right2);
    }

    // [alpha.157] คำที่ใช้บ่อย (ตัดคำเชื่อม/ชื่อตัวละครออก — ตัวเดียวกับการ์ด "การใช้คำ" ของ AI วิเคราะห์)
    try {
      const { analyzeWords } = await import('./ai/ai-analyze.js');
      const chars = allEnts.filter((e) => e.cat === 'characters').map((e) => ({ name: e.name, aliases: e.aliases || [] }));
      const res = analyzeWords(sceneTexts, { top: 30, characters: chars });
      if (res.rows.length) {
        const wpanel = el('div', 'dash-apanel dash-words');
        wpanel.append(el('div', 'dash-apanel-title', t('ui.dash.topWords')));
        const cloud = el('div', 'dash-word-cloud');
        const max = res.rows[0].count || 1;
        for (const r of res.rows) {
          const chip = el('span', 'dash-word');
          chip.style.setProperty('--w', (0.35 + 0.65 * (r.count / max)).toFixed(2));
          const w = el('b'); w.textContent = r.word;
          chip.append(w, el('i', null, fmtNum(r.count)));
          chip.title = tf('ui.dash.topWordHint', r.word, r.count, r.per10k);
          cloud.append(chip);
        }
        wpanel.append(cloud);
        wpanel.append(el('div', 'dash-stat-note', tf('ui.dash.topWordsNote', fmtNum(res.total), fmtNum(res.unique))));
        grid.append(wpanel);
      }
    } catch (e) { /* ตัดคำพังต้องไม่ทำแดชบอร์ดล้ม */ }

    // ความยาวแต่ละบท (คำ)
    if (chapterWords.length) {
      const cpanel = el('div', 'dash-apanel dash-apanel-wide');
      cpanel.append(el('div', 'dash-apanel-title', t('ui.dash.longEachChapterWord')));
      const avg = Math.round(words / chapterWords.length);
      cpanel.append(statBars(
        chapterWords.map((c) => ({ label: c.title || t('ui.common.notNamed'), n: c.words })), words, PAL));
      cpanel.append(el('div', 'dash-stat-note',
        tf('ui.dash.avgWordChapterTime', fmtNum(avg), readingTime(words).minutes)));
      grid.append(cpanel);
    }
  }
  // ---- [alpha.63] คลังรูป: จำนวน / ยังไม่ถูกใช้ / พื้นที่รวม ----
  try {
    const AC = await import('./gallery/album-core.js');
    const UIX = await import('./gallery/usage-index.js');
    const albums = await AC.listAlbums(kapi, root);
    const imgs = await AC.allImages(kapi, root, albums);
    if (imgs.length) {
      // ยิง stat เป็นชุด ไม่ใช่ทีละใบ — คลังรูปใหญ่ ๆ ทำให้แดชบอร์ดค้างรอเป็นสิบวินาที
      for (let i = 0; i < imgs.length; i += 32) {
        await Promise.all(imgs.slice(i, i + 32).map(async (it) => {
          try { it.size = (await kapi.stat(await kapi.join(root, 'Images', ...it.path.split('/')))).size; }
          catch { it.size = 0; }
        }));
      }
      const { index } = await UIX.scanUsage(kapi, root);
      const st = AC.galleryStats(UIX.attachUsage(imgs, index), albums);
      const gpanel = el('div', 'dash-apanel dash-apanel-wide dash-gallery');
      gpanel.append(el('div', 'dash-apanel-title', t('ui.dash.libraryImage')));
      gpanel.append(statBars([
        { label: t('ui.dash.useSourceDone'), n: st.used },
        { label: t('ui.common.notUse'), n: st.unused },
      ], st.total, PAL));
      gpanel.append(el('div', 'dash-stat-note',
        tf('ui.dash.imageAlbumTagArea', st.total, st.albums, st.tags, st.bytesText)));
      const openG = el('button', 'k-tpl-add', t('ui.dash.openLibraryImage'));
      openG.onclick = async () => { const { galleryCommand } = await import('./app.js'); galleryCommand('gallery'); };
      gpanel.append(openG);
      wrap.append(gpanel);
    }
  } catch (e) { /* คลังรูปพังต้องไม่ทำแดชบอร์ดล้ม (บทเรียน 89 ข้อ 2) */ }

  // ---- ประวัติการตัดสินใจ (ข้อ 83) — โผล่ที่แดชบอร์ด ไม่ใช่ซ่อนอยู่ในเมนู ----
  {
    const box = el('div', 'dash-choices');
    renderChoicePanel(box, {
      limit: 6,
      onOpenScene: async (sceneId) => {
        const hit = await findScenePath(root, sceneId);
        if (hit && (await kapi.exists(hit.path))) openScene(hit.path, hit.title);
      },
    });
    const openAll = el('button', 'k-tpl-add', t('ui.dash.viewAllExport'));
    openAll.onclick = () => showPlayerHistory();
    box.append(openAll);
    wrap.append(box);
  }

  const favs = sceneRows.filter((r) => r.flag);
  if (favs.length) {
    wrap.append(el('div', 'wiki-sub', tf('ui.dash.scenePinPin', favs.length)));
    for (const r of favs) {
      const d = el('div', 'scene', gi('star') + ` ${r.title} — ${r.ch}`);
      d.onclick = () => openScene(r.file, r.title);
      wrap.append(d);
    }
  }
  wrap.append(el('div', 'wiki-sub', t('ui.dash.nextStuck')));
  for (const r of sceneRows.slice(0, 8)) {
    const d = el('div', 'scene', gi('file') + ` ${r.title} — ${r.ch}`);
    d.onclick = () => openScene(r.file, r.title);
    wrap.append(d);
  }

  // ───────── [alpha.80] "สิ่งที่ควรดู" — Backlinks + สิ่งที่ต้องอัปเดต ─────────
  // เดิมเป็นแผง "ศูนย์รวม" ที่มีสถิติ ฉาก/คำ/Wiki ซ้ำกับด้านบนของแดชบอร์ดเป๊ะ ๆ
  // (นับคนละรอบด้วย ตัวเลขจึงไม่ตรงกันเป็นประจำ) → ตัดสถิติทิ้ง เหลือเฉพาะสองส่วนที่ไม่ซ้ำใคร
  const centHost = el('div', 'dash-cent');
  wrap.append(centHost);
  if (stale()) return false;
  try {
    const { renderReview } = await import('./dash-review.js');
    await renderReview(centHost);
  } catch (e) {
    centHost.append(el('div', 'dim', t('ui.dash.loadPartHubNot')));
  }
  if (stale()) return false;
  if (!firstPaint) swapKeepScroll(pane, wrap);
  return true;
}

/** [alpha.165] แทนเนื้อทั้งก้อนโดยคงตำแหน่งเลื่อนของทุกกล่องเหนือ pane (ถึงตัวแผง) ไว้ในเฟรมเดียวกัน */
function swapKeepScroll(pane, fresh) {
  const keep = [];
  for (let e = pane; e && e !== document.body; e = e.parentElement) {
    if (e.scrollTop || e.scrollLeft) keep.push([e, e.scrollTop, e.scrollLeft]);
    if (e.classList && (e.classList.contains('k-panel') || e.classList.contains('k-float-panel'))) break;
  }
  pane.replaceChildren(fresh);
  for (const [e, top, left] of keep) {
    const sb = e.style.scrollBehavior;
    e.style.scrollBehavior = 'auto';
    e.scrollTop = top; e.scrollLeft = left;
    e.style.scrollBehavior = sb;
  }
}


// ═════════ [alpha.157] กิจกรรมการเขียน ═════════
const ACT_KEY = 'k2-dash-activity-range';
function activityRange() {
  try { const v = localStorage.getItem(ACT_KEY); return ACTIVITY_RANGES.includes(v) ? v : '30d'; } catch { return '30d'; }
}
const fmtDay = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return d || '';
  return fmtDate(new Date(+m[1], +m[2] - 1, +m[3]), { day: 'numeric', month: 'short', year: 'numeric' }) || d;
};

/** กล่อง Activity — วาดใหม่เฉพาะตัวเองตอนสลับช่วง (ไม่อ่านทั้งโปรเจกต์ใหม่) */
export function buildActivity(goal = 0, words = 0) {
  const box = el('div', 'dash-streak dash-activity');
  const draw = () => {
    box.replaceChildren();
    const hist = getWordHistory();
    const range = activityRange();
    const start = projectStartDay(state.meta || {}, hist);
    const head = el('div', 'dash-act-head');
    head.append(el('div', 'dash-apanel-title', t('ui.dash.activity')));
    const seg = el('div', 'dash-act-ranges');
    for (const r of ACTIVITY_RANGES) {
      const b = el('button', 'dash-act-range' + (r === range ? ' on' : ''), r === 'all' ? t('ui.dash.rangeAll') : r);
      b.dataset.range = r;
      b.onclick = () => { try { localStorage.setItem(ACT_KEY, r); } catch {} draw(); };
      seg.append(b);
    }
    head.append(seg);
    box.append(head);

    const streak = calcStreak(hist);
    const info = el('div', 'dash-act-info');
    info.append(el('span', 'dash-act-chip', streak > 0 ? tf('ui.dash.writeNext', streak) : t('ui.dash.notStartWriteNext')));
    if (start) info.append(el('span', 'dash-act-chip', tf('ui.dash.projectStart', fmtDay(start))));
    box.append(info);

    const ser = activitySeries(hist, range, { start });
    const ms = milestones(hist, goal);
    const msByDay = new Map();
    for (const m of ms) msByDay.set(m.date, [...(msByDay.get(m.date) || []), m]);
    if (hist.length >= 1) {
      const max = Math.max(1, ...ser.days.map((d) => d.delta));
      const chart = el('div', 'dash-days');
      chart.dataset.range = range;
      for (const d of ser.days) {
        const col = el('div', 'dash-day');
        const bar = el('div', 'dash-day-bar' + (d.delta ? ' on' : ''));
        bar.style.height = Math.max(3, Math.round((d.delta / max) * 100)) + '%';
        const hits = msByDay.get(d.date);
        col.title = tf('ui.dash.word', fmtDay(d.date), fmtNum(d.delta))
          + (hits ? '\n' + hits.map((m) => tf('ui.dash.milestoneHit', fmtNum(m.words))).join('\n') : '');
        if (hits) { col.classList.add('dash-day-ms'); col.append(el('span', 'dash-day-flag', gi('flag-checkered'))); }
        if (d.date === start) col.classList.add('dash-day-start');
        col.append(bar);
        chart.append(col);
      }
      box.append(chart);
      const foot = el('div', 'dash-act-foot');
      foot.append(el('span', null, fmtDay(ser.from)), el('span', null, fmtDay(ser.to)));
      box.append(foot);
      box.append(el('div', 'dim', tf('ui.dash.actSummary', fmtNum(ser.sum), ser.active, ser.days.length,
        ser.best && ser.best.delta ? fmtDay(ser.best.date) + ' (+' + fmtNum(ser.best.delta) + ')' : '—')));
    } else {
      box.append(el('div', 'dim', t('ui.dash.saveTaskDoneGraph')));
    }

    // หลักไมล์
    const msBox = el('div', 'dash-milestones');
    msBox.append(el('div', 'dash-ms-title', gi('flag-checkered') + ' ' + t('ui.dash.milestones')));
    const list = el('div', 'dash-ms-list');
    if (start) {
      const row = el('div', 'dash-ms dash-ms-start');
      row.append(el('span', 'dash-ms-dot'), el('b', null, t('ui.dash.msStart')), el('span', 'dim', fmtDay(start)));
      list.append(row);
    }
    for (const m of ms) {
      const row = el('div', 'dash-ms' + (m.goal ? ' dash-ms-goal' : ''));
      row.append(el('span', 'dash-ms-dot'),
        el('b', null, (m.goal ? t('ui.dash.msGoal') + ' · ' : '') + tf('ui.dash.msWords', fmtNum(m.words))),
        el('span', 'dim', fmtDay(m.date)));
      list.append(row);
    }
    const nx = nextMilestone(words, goal);
    if (nx) {
      const row = el('div', 'dash-ms dash-ms-next');
      row.append(el('span', 'dash-ms-dot'), el('b', null, tf('ui.dash.msWords', fmtNum(nx.words))),
        el('span', 'dim', tf('ui.dash.msLeft', fmtNum(nx.left))));
      list.append(row);
    }
    msBox.append(list);
    box.append(msBox);
  };
  draw();
  return box;
}

/** สรุปจำนวนฉากต่อคอลัมน์ Kanban + แถบสัดส่วนสีเต็มแถบ + ปุ่มเปิดกระดาน */
export function buildKanbanSummary(sceneStatuses, total) {
  const panel = el('div', 'dash-apanel dash-kanban');
  const head = el('div', 'dash-act-head');
  head.append(el('div', 'dash-apanel-title', t('ui.dash.kanbanStatus')));
  const open = el('button', 'k-tpl-add dash-kb-open', gi('clipboard') + ' ' + t('ui.dash.openKanban'));
  open.onclick = async () => { const { openKanban } = await import('./kanban/kanban-ui.js'); openKanban(); };
  head.append(open);
  panel.append(head);
  const rows = statusBreakdown(sceneStatuses, allStatuses(), '');
  // [alpha.165] "ยังไม่กำหนด" ไม่ใช่สถานะ (ไม่มีสีของผู้ใช้) → ใช้สีจางของธีม · เดิมเทาอมฟ้าตายตัวทุกธีม (ผู้ใช้: เทาของธีมเก่ายังอยู่)
  const colorOf = (r) => (r.unset ? themeColor('--dim', STATUS_UNSET) : vivid(statusColor(r.key)));
  const labelOf = (r) => (r.unset ? t('ui.kanban.unset') : dataLabel(r.key));
  const strip = el('div', 'dash-kb-strip');
  for (const r of rows) {
    if (!r.n) continue;
    const seg = el('div', 'dash-kb-seg');
    seg.style.flexGrow = String(r.n);
    seg.style.background = colorOf(r);
    seg.title = labelOf(r) + ': ' + r.n;
    strip.append(seg);
  }
  panel.append(strip);
  const cols = el('div', 'dash-kb-cols');
  for (const r of rows) {
    const c = el('div', 'dash-kb-col' + (r.n ? '' : ' empty'));
    const hex = colorOf(r);
    c.style.setProperty('--kb-col', hex);
    const top = el('div', 'dash-kb-col-head');
    top.style.background = hex; top.style.color = inkOn(hex);
    top.textContent = labelOf(r);
    const n = el('div', 'dash-kb-n', fmtNum(r.n));
    const pct = el('div', 'dim', (total ? Math.round(100 * r.n / total) : 0) + '%');
    c.append(top, n, pct);
    cols.append(c);
  }
  panel.append(cols);
  return panel;
}

// ---------------- ตัวจัดการเล่ม (Book Manager) ----------------
