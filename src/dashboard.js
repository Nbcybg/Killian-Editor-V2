// dashboard.js — แดชบอร์ดโปรเจกต์ (สถิติ/analytics/ฉากปักหมุด/ไปต่อจากที่ค้าง)
// แยกจาก app.js — feature นี้เป็นจุดที่ feature ใหม่ (แก้แดชบอร์ด, กราฟ, theme) จะมาต่อยอด
import { t, tf } from './i18n.js';
import { $, state, el, SCENE_STATUSES } from './core.js';
import { parseMdFile, countWords } from './md.js';
import { getWordHistory, calcStreak } from './word-history.js';
import { renderChoicePanel, showPlayerHistory } from './player-choices.js';
import { findScenePath } from './project-scan.js';
// ฟังก์ชันที่ยังอยู่ใน app.js (เรียกตอน runtime เท่านั้น — circular import ปลอดภัยกับ esbuild bundle)
import { loadAllEntities, catIconHtml, catLabel, openScene, renderFeaturePanel } from './app.js';
import { guid } from './app.js';
import { showPanel, isPanelOpen } from './panels/panel-ui.js';

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
  pane.innerHTML = '';
  const wrap = el('div', 'dash-wrap');
  pane.append(wrap);
  wrap.append(el('div', 'dash-title', state.title));
  const cards = el('div', 'dash-cards'); wrap.append(cards);
  const card = (label) => {
    const c = el('div', 'dash-card');
    const v = el('div', 'dash-num', '…');
    c.append(v, el('div', 'dash-label', label));
    cards.append(c); return v;
  };
  const vCh = card(t('ui.common.chapter')), vSc = card(t('ui.common.scene2')), vW = card(t('ui.dash.wordAll')), vE = card('Wiki entities');
  let nCh = 0, nSc = 0, words = 0;
  const sceneRows = [];
  const byStatus = {};            // สถานะฉาก → จำนวน
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
          const st = SCENE_STATUSES.includes(sc.status) ? sc.status : t('ui.dash.notSetStatus');
          byStatus[st] = (byStatus[st] || 0) + 1;
          const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
          try {
            const { body } = parseMdFile(await kapi.readFile(file));
            const w = countWords(body); words += w; cw += w;
            sceneRows.push({ title: sc.title, ch: ch.title, file, flag: sc.flag });
          } catch {}
        }
        chapterWords.push({ title: ch.title, words: cw, scenes: cs });
      }
    }
  }
  vCh.textContent = nCh.toLocaleString();
  vSc.textContent = nSc.toLocaleString();
  vW.textContent = words.toLocaleString();
  const allEnts = await loadAllEntities();
  vE.textContent = allEnts.length.toLocaleString();
  // ความคืบหน้าเทียบเป้าหมายทั้งโปรเจกต์ (ตั้งได้ในตั้งค่าโปรเจกต์)
  const goal = parseInt(state.goals.projectWords, 10) || 0;
  if (goal > 0) {
    const pct = Math.min(100, Math.round((words / goal) * 100));
    const gwrap = el('div', 'dash-goal');
    gwrap.append(el('div', 'dash-goal-label',
      tf('ui.dash.goalWord', words.toLocaleString(), goal.toLocaleString(), pct)));
    const bar = el('div', 'dash-goal-bar');
    const fill = el('div', 'dash-goal-fill'); fill.style.width = pct + '%';
    bar.append(fill); gwrap.append(bar);
    wrap.append(gwrap);
  }

  // ---- สถิติการเขียนรายวัน + วันเขียนติดต่อกัน (word-history.js) ----
  {
    const hist = getWordHistory();
    const streak = calcStreak(hist);
    const box = el('div', 'dash-streak');
    const head = el('div', 'dash-goal-label',
      streak > 0 ? tf('ui.dash.writeNext', streak) : t('ui.dash.notStartWriteNext'));
    box.append(head);
    if (hist.length >= 2) {
      // แท่งคำที่เขียนต่อวัน 14 วันหลังสุด (ผลต่างของยอดรวมสะสม)
      const last = hist.slice(-15);
      const days = [];
      for (let i = 1; i < last.length; i++) {
        days.push({ date: last[i].date, delta: Math.max(0, (last[i].words || 0) - (last[i - 1].words || 0)) });
      }
      const max = Math.max(1, ...days.map((d) => d.delta));
      const chart = el('div', 'dash-days');
      chart.style.cssText = 'display:flex;align-items:flex-end;gap:3px;height:60px;margin:8px 0';
      for (const d of days) {
        const bar = el('div', 'dash-day-bar');
        bar.style.cssText = `flex:1;min-width:6px;border-radius:2px 2px 0 0;background:${d.delta ? '#6fae6f' : 'var(--border)'};height:${Math.max(3, Math.round((d.delta / max) * 100))}%`;
        bar.title = tf('ui.dash.word', d.date, d.delta.toLocaleString());
        chart.append(bar);
      }
      box.append(chart);
      box.append(el('div', 'dim', tf('ui.dash.wordAddNextLast', days.length)));
    } else {
      box.append(el('div', 'dim', t('ui.dash.saveTaskDoneGraph')));
    }
    wrap.append(box);
  }

  // ---- สถิติเชิงลึก (analytics) ----
  // แถบสัดส่วน (คืน element) — ใช้ซ้ำได้ทั้งสถานะ/หมวด
  const statBars = (rows, total, palette) => {
    const box2 = el('div', 'dash-stat');
    const max = Math.max(1, ...rows.map((r) => r.n));
    rows.forEach((r, i) => {
      const line = el('div', 'dash-stat-row');
      const nameEl = el('div', 'dash-stat-name');
      nameEl.innerHTML = r.label;
      line.append(nameEl);
      const track = el('div', 'dash-stat-track');
      const fill = el('div', 'dash-stat-fill');
      fill.style.width = Math.round((r.n / max) * 100) + '%';
      fill.style.background = palette[i % palette.length];
      track.append(fill); line.append(track);
      const pct = total ? Math.round((r.n / total) * 100) : 0;
      line.append(el('div', 'dash-stat-val', `${r.n.toLocaleString()} (${pct}%)`));
      box2.append(line);
    });
    return box2;
  };
  const PAL = ['#5f9fd9', '#6fae6f', '#d9b757', '#d97757', '#a97fd0', '#d9575e', '#7fb8b0'];

  if (nSc > 0) {
    const grid = el('div', 'dash-analytics'); wrap.append(grid);

    // ความคืบหน้าตามสถานะฉาก
    const left2 = el('div', 'dash-apanel');
    left2.append(el('div', 'dash-apanel-title', t('ui.dash.pageStatusScene')));
    const order = [...SCENE_STATUSES, t('ui.dash.notSetStatus')];
    left2.append(statBars(
      order.filter((s) => byStatus[s]).map((s) => ({ label: s, n: byStatus[s] })), nSc, PAL));
    grid.append(left2);

    // Wiki ตามหมวด
    if (allEnts.length) {
      const byCat = {};
      for (const e of allEnts) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
      const right2 = el('div', 'dash-apanel');
      right2.append(el('div', 'dash-apanel-title', t('ui.dash.wikiCat')));
      right2.append(statBars(
        Object.entries(byCat).sort((a, b) => b[1] - a[1])
          .map(([c, n]) => ({ label: catIconHtml(c) + ' ' + catLabel(c), n })), allEnts.length, PAL));
      grid.append(right2);
    }

    // ความยาวแต่ละบท (คำ)
    if (chapterWords.length) {
      const cpanel = el('div', 'dash-apanel dash-apanel-wide');
      cpanel.append(el('div', 'dash-apanel-title', t('ui.dash.longEachChapterWord')));
      const avg = Math.round(words / chapterWords.length);
      cpanel.append(statBars(
        chapterWords.map((c) => ({ label: c.title || t('ui.common.notNamed'), n: c.words })), words, PAL));
      cpanel.append(el('div', 'dash-stat-note',
        tf('ui.dash.avgWordChapterTime', avg.toLocaleString(), Math.max(1, Math.round(words / 250)))));
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
      const d = el('div', 'scene', `⭐ ${r.title} — ${r.ch}`);
      d.onclick = () => openScene(r.file, r.title);
      wrap.append(d);
    }
  }
  wrap.append(el('div', 'wiki-sub', t('ui.dash.nextStuck')));
  for (const r of sceneRows.slice(0, 8)) {
    const d = el('div', 'scene', `📄 ${r.title} — ${r.ch}`);
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
  return true;
}

// ---------------- ตัวจัดการเล่ม (Book Manager) ----------------
