// panel-exports.js — [alpha.167] ทางกลางของ "ส่งออกจากแผง" (เมนูระบบ ส่งออก → <แผง> → <รูปแบบ>)
//
// ผู้ใช้: "panel บางตัว ต้องมีการ export ได้แล้ว และ จะต้องมีใน menu ทำเป็น export หัวข้อ ไปเลย"
// → ตาราง `PANEL_EXPORTS` = แหล่งความจริงเดียวว่าแผงไหนส่งออกอะไรได้ (main.js สร้างเมนูจากรายการชุดเดียวกัน
//   ผ่านคำสั่ง `export-panel:<แผง>:<รูปแบบ>`) · ตัวลงมือจริงของแต่ละแผงอยู่ในโมดูลของแผงนั้นเอง
//   ที่นี่แค่เปิดแผงให้พร้อม แล้วเรียกตัวส่งออกตัวเดียวกับปุ่มบนแผง (ไม่มีสายส่งออกเส้นที่สอง)
import { t, tf } from './i18n.js';
import { state, setStatus, setStatusError, log } from './core.js';
import { failText } from './err-text.js';

/** แผง → รูปแบบที่ส่งออกได้ (ลำดับ = ลำดับในเมนู) — main.js มีสำเนาเป็นข้อมูล (ตรวจตรงกันด้วย unit test) */
export const PANEL_EXPORTS = [
  { panel: 'timeline',      fmts: ['png', 'html', 'md', 'csv'] },
  { panel: 'maps',          fmts: ['png', 'geojson', 'print'] },
  { panel: 'gallery-board', fmts: ['png', 'html'] },
  { panel: 'network',       fmts: ['png'] },
  { panel: 'planner',       fmts: ['png'] },
  { panel: 'branch',        fmts: ['html', 'md', 'json', 'svg', 'png'] },
  { panel: 'kanban',        fmts: ['csv'] },
  { panel: 'gallery',       fmts: ['zip'] },
  { panel: 'ai-analyzer',   fmts: ['csv'] },
];
export function canExport(panel, fmt) {
  const e = PANEL_EXPORTS.find((x) => x.panel === panel);
  return !!(e && e.fmts.includes(fmt));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await wait(60); }
  return false;
}
const safe = (s) => String(s || 'export').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 60) || 'export';
const projName = () => safe((state.meta && state.meta.title) || state.title || 'project');

async function canvasToFile(cv, defName, outPath) {
  const dest = outPath || await kapi.saveAsDialog(defName, 'png');
  if (!dest) return null;
  const bin = atob(cv.toDataURL('image/png').split(',')[1] || '');
  const bytes = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  await kapi.writeBytes(dest, bytes);
  return dest;
}
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/**
 * ส่งออกจากแผง — คืนค่าที่ตัวส่งออกของแผงคืน (ทางไฟล์/true) หรือ null/false เมื่อยกเลิก/ทำไม่ได้
 * @param outPath ใช้ในเทส (ไม่เปิดกล่องบันทึก) — แผงที่ตัวส่งออกเดิมไม่รับทางไฟล์จะไม่สนค่านี้
 */
export async function exportPanel(panel, fmt, outPath) {
  if (!state.root) { setStatus(t('ui.common.openProjectBefore')); return null; }
  if (!canExport(panel, fmt)) return null;
  const { showPanel } = await import('./panels/panel-ui.js');
  try {
    switch (panel) {
      case 'timeline': {
        const { exportTimeline } = await import('./timeline-ui.js');
        return exportTimeline(fmt, outPath);
      }
      case 'maps': {
        const M = await import('./maps-ui.js');
        const { mapsState_C, loadMaps } = await import('./app.js');
        const { findMap, sortMaps } = await import('./maps.js');
        const data = (mapsState_C.s && mapsState_C.s.data) || await loadMaps();
        const cur = (mapsState_C.s && findMap(data.maps, mapsState_C.s.currentId)) || sortMaps(data.maps)[0];
        if (!cur) { setStatus(t('ui.panelExport.noMap')); return null; }
        if (fmt === 'png') return M.exportMapPng(cur);
        if (fmt === 'geojson') return M.exportMapGeoJson(cur, outPath);
        return M.printMap(cur);
      }
      case 'gallery-board': {
        showPanel('gallery-board');
        const { moodBoardInstance } = await import('./gallery/moodboard-ui.js');
        await until(() => moodBoardInstance());
        const mb = moodBoardInstance();
        if (!mb) return null;
        return fmt === 'html' ? mb.exportHtml(outPath) : mb.exportBoard(outPath);
      }
      case 'network': {
        showPanel('network');
        const app = await import('./app.js');
        await until(() => app.netInst && app.netInst.canvas);
        const net = app.netInst;
        if (!net) return null;
        try { net.draw(); } catch {}
        const dest = await canvasToFile(net.canvas, projName() + '-story-network.png', outPath);
        if (dest) setStatus(tf('ui.panelExport.done', String(dest).split(/[\\/]/).pop()));
        return dest;
      }
      case 'planner': {
        showPanel('planner');
        const { activePlanner } = await import('./app.js');
        await until(() => activePlanner());
        const p = activePlanner();
        const pb = p && (typeof p.exportPNG === 'function' ? p : p.pb);
        if (!pb || typeof pb.exportPNG !== 'function') { setStatus(t('ui.panelExport.needPlanner')); return null; }
        return pb.exportPNG();
      }
      case 'branch': {
        // ผังแตกสายมีเมนูส่งออกของตัวเองที่ต้องใช้ผังที่วาดอยู่ (SVG/PNG) — เปิดแผงแล้วเปิดเมนูนั้น
        showPanel('branch');
        await until(() => document.querySelector('#branch-body .branch-export'));
        const b = document.querySelector('#branch-body .branch-export');
        if (!b) { setStatus(t('ui.panelExport.needBranch')); return null; }
        b.click();
        return true;
      }
      case 'kanban': return exportKanbanCsv(outPath);
      case 'gallery': {
        const { handleCommand } = await import('./app.js');
        await handleCommand('gallery-export-used');
        return true;
      }
      case 'ai-analyzer': {
        showPanel('ai-analyzer');
        const { exportAllCsv } = await import('./ai-analyzer-ui.js');
        return exportAllCsv(outPath);
      }
      default: return null;
    }
  } catch (e) {
    log('error', 'panel export failed: ' + panel + ':' + fmt, e);
    setStatusError(failText(t('ui.panelExport.fail'), e));
    return null;
  }
}

/** Kanban = ตารางฉากตามสถานะ (เล่ม · บท · ฉาก · สถานะ · เวลาในเรื่อง · จำนวนคำ) */
export async function exportKanbanCsv(outPath) {
  const rows = [[t('ui.panelExport.colBook'), t('ui.panelExport.colChapter'), t('ui.panelExport.colScene'),
                 t('ui.panelExport.colStatus'), t('ui.panelExport.colStoryDate'), t('ui.panelExport.colWords')]];
  const skip = new Set(['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Backups', 'Plugins', 'Research']);
  const { dataLabel } = await import('./core.js');
  for (const sec of await kapi.listDirs(state.root).catch(() => [])) {
    if (skip.has(sec)) continue;
    const sp = await kapi.join(state.root, sec);
    const sj = await kapi.join(sp, 'section.json');
    if (!(await kapi.exists(sj))) continue;
    let secTitle = sec; try { secTitle = (await kapi.readJson(sj)).title || sec; } catch {}
    const dr = await kapi.join(sp, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    for (const dn of await kapi.listDirs(dr).catch(() => [])) {
      const dp = await kapi.join(dr, dn);
      let draft = {}, sc = {};
      try { draft = await kapi.readJson(await kapi.join(dp, 'draft.json')); } catch { continue; }
      try { sc = (await kapi.readJson(await kapi.join(dp, 'scenes.json'))).chapters || {}; } catch {}
      for (const ch of (draft.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))) {
        for (const r of (sc[ch.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))) {
          if (r.type === 'memo') continue;
          rows.push([secTitle, ch.title || '', r.title || '', r.status ? dataLabel(r.status) : '', r.storyDate || '', r.words || r.wordCount || '']);
        }
      }
    }
  }
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const dest = outPath || await kapi.saveAsDialog(projName() + '-kanban.csv', 'csv');
  if (!dest) return null;
  await kapi.writeFile(dest, text);
  setStatus(tf('ui.panelExport.done', String(dest).split(/[\\/]/).pop()));
  return dest;
}
