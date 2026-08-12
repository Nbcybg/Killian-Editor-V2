// dashboard.js — แดชบอร์ดโปรเจกต์ (สถิติ/analytics/ฉากปักหมุด/ไปต่อจากที่ค้าง)
// แยกจาก app.js — feature นี้เป็นจุดที่ feature ใหม่ (แก้แดชบอร์ด, กราฟ, theme) จะมาต่อยอด
import { T } from './i18n.js';
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

export async function renderDashboard(pane) {
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
  const vCh = card(T`บท`), vSc = card(T`ฉาก`), vW = card(T`คำทั้งหมด`), vE = card('Wiki entities');
  let nCh = 0, nSc = 0, words = 0;
  const sceneRows = [];
  const byStatus = {};            // สถานะฉาก → จำนวน
  const chapterWords = [];        // { title, words, scenes }
  for (const secName of await kapi.listDirs(state.root)) {
    const secPath = await kapi.join(state.root, secName);
    if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
    const draftRoot = await kapi.join(secPath, 'Draft');
    if (!(await kapi.exists(draftRoot))) continue;
    for (const dname of await kapi.listDirs(draftRoot)) {
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
          const st = SCENE_STATUSES.includes(sc.status) ? sc.status : T`ยังไม่ตั้งสถานะ`;
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
      T`เป้าหมาย: ${words.toLocaleString()} / ${goal.toLocaleString()} คำ (${pct}%)`));
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
      streak > 0 ? T`🔥 เขียนติดต่อกัน ${streak} วัน` : T`🔥 ยังไม่เริ่มนับวันเขียนติดต่อกัน`);
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
        bar.title = T`${d.date}: +${d.delta.toLocaleString()} คำ`;
        chart.append(bar);
      }
      box.append(chart);
      box.append(el('div', 'dim', T`คำที่เพิ่มต่อวัน · ${days.length} วันหลังสุด`));
    } else {
      box.append(el('div', 'dim', T`บันทึกงานสัก 2 วันแล้วกราฟคำรายวันจะขึ้นที่นี่`));
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
    left2.append(el('div', 'dash-apanel-title', T`📊 ความคืบหน้าตามสถานะฉาก`));
    const order = [...SCENE_STATUSES, T`ยังไม่ตั้งสถานะ`];
    left2.append(statBars(
      order.filter((s) => byStatus[s]).map((s) => ({ label: s, n: byStatus[s] })), nSc, PAL));
    grid.append(left2);

    // Wiki ตามหมวด
    if (allEnts.length) {
      const byCat = {};
      for (const e of allEnts) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
      const right2 = el('div', 'dash-apanel');
      right2.append(el('div', 'dash-apanel-title', T`🗂 Wiki ตามหมวด`));
      right2.append(statBars(
        Object.entries(byCat).sort((a, b) => b[1] - a[1])
          .map(([c, n]) => ({ label: catIconHtml(c) + ' ' + catLabel(c), n })), allEnts.length, PAL));
      grid.append(right2);
    }

    // ความยาวแต่ละบท (คำ)
    if (chapterWords.length) {
      const cpanel = el('div', 'dash-apanel dash-apanel-wide');
      cpanel.append(el('div', 'dash-apanel-title', T`📖 ความยาวแต่ละบท (คำ)`));
      const avg = Math.round(words / chapterWords.length);
      cpanel.append(statBars(
        chapterWords.map((c) => ({ label: c.title || T`(ไม่มีชื่อ)`, n: c.words })), words, PAL));
      cpanel.append(el('div', 'dash-stat-note',
        T`เฉลี่ย ${avg.toLocaleString()} คำ/บท · เวลาอ่านรวม ~${Math.max(1, Math.round(words / 250))} นาที`));
      grid.append(cpanel);
    }
  }
  // ---- [alpha.63] คลังรูป: จำนวน / ยังไม่ถูกใช้ / พื้นที่รวม ----
  try {
    const AC = await import('./gallery/album-core.js');
    const UIX = await import('./gallery/usage-index.js');
    const albums = await AC.listAlbums(kapi, state.root);
    const imgs = await AC.allImages(kapi, state.root, albums);
    if (imgs.length) {
      // ยิง stat เป็นชุด ไม่ใช่ทีละใบ — คลังรูปใหญ่ ๆ ทำให้แดชบอร์ดค้างรอเป็นสิบวินาที
      for (let i = 0; i < imgs.length; i += 32) {
        await Promise.all(imgs.slice(i, i + 32).map(async (it) => {
          try { it.size = (await kapi.stat(await kapi.join(state.root, 'Images', ...it.path.split('/')))).size; }
          catch { it.size = 0; }
        }));
      }
      const { index } = await UIX.scanUsage(kapi, state.root);
      const st = AC.galleryStats(UIX.attachUsage(imgs, index), albums);
      const gpanel = el('div', 'dash-apanel dash-apanel-wide dash-gallery');
      gpanel.append(el('div', 'dash-apanel-title', T`🖼 คลังรูป`));
      gpanel.append(statBars([
        { label: T`ใช้ในต้นฉบับแล้ว`, n: st.used },
        { label: T`ยังไม่ถูกใช้`, n: st.unused },
      ], st.total, PAL));
      gpanel.append(el('div', 'dash-stat-note',
        T`${st.total} รูป · ${st.albums} อัลบั้ม · ${st.tags} แท็ก · พื้นที่รวม ${st.bytesText}`));
      const openG = el('button', 'k-tpl-add', T`เปิดคลังรูป`);
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
        const hit = await findScenePath(state.root, sceneId);
        if (hit && (await kapi.exists(hit.path))) openScene(hit.path, hit.title);
      },
    });
    const openAll = el('button', 'k-tpl-add', T`ดูทั้งหมด / ส่งออก…`);
    openAll.onclick = () => showPlayerHistory();
    box.append(openAll);
    wrap.append(box);
  }

  const favs = sceneRows.filter((r) => r.flag);
  if (favs.length) {
    wrap.append(el('div', 'wiki-sub', T`⭐ ฉากปักหมุด (${favs.length})`));
    for (const r of favs) {
      const d = el('div', 'scene', `⭐ ${r.title} — ${r.ch}`);
      d.onclick = () => openScene(r.file, r.title);
      wrap.append(d);
    }
  }
  wrap.append(el('div', 'wiki-sub', T`ไปต่อจากที่ค้าง`));
  for (const r of sceneRows.slice(0, 8)) {
    const d = el('div', 'scene', `📄 ${r.title} — ${r.ch}`);
    d.onclick = () => openScene(r.file, r.title);
    wrap.append(d);
  }

  // ───────── [alpha.62 บั๊ก 15] ศูนย์รวมย้ายมาอยู่ในแดชบอร์ด ─────────
  // ทั้งสองหน้าตอบคำถามเดียวกัน ("ตอนนี้เรื่องเป็นยังไง") และนับสถิติจากไฟล์ชุดเดียวกัน
  // → เดิมต้องเปิดสองที่ แล้วตัวเลขไม่ตรงกันเพราะสแกนคนละรอบ · ตอนนี้ต่อท้ายในแผงเดียว
  const centHost = el('div', 'dash-cent');
  wrap.append(centHost);
  try {
    const { renderCentralize } = await import('./centralize-ui.js');
    await renderCentralize(centHost, { embedded: true });
  } catch (e) {
    centHost.append(el('div', 'dim', T`โหลดส่วนศูนย์รวมไม่สำเร็จ`));
  }
}

// ---------------- ตัวจัดการเล่ม (Book Manager) ----------------
