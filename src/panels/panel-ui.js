// panel-ui.js — Panel System แบบ Photoshop: ทุกพื้นที่ของหน้าต่างคือ "แผง" ที่ dock/tab/float ได้
// เขียนใหม่ทั้งไฟล์ (alpha.46) — แทนที่ระบบแผงลอยเดิมใน app.js (makeFloatablePanel/PANELS)
//
//   initPanelSystem()  → ลงทะเบียนแผงทั้งหมด · กู้เลย์เอาต์ · วาดลง #app-root · auto-save
//   showPanel(id) / hidePanel(id) / togglePanel(id) / resetPanels()
//   addPanelButton(id, el)  → ฝากปุ่มพิเศษไว้บนหัวแผง (โมดูลอื่นเรียก · element เดิมถูกใช้ซ้ำทุก render)
//
// เนื้อแผงคือ element เดิมใน index.html (#tree-panel, #content, …) — "ย้ายเข้า" host เท่านั้น ห้ามสร้างใหม่
// เพราะโค้ดทั้งโปรเจกต์อ้าง id เหล่านี้ ($('#panes'), $('#tabs'), $('#props-body'), …)
import { tf } from '../i18n.js';
import { commandIcon, isRegisteredCommand, gi, icon } from '../icons.js';
import { tipText } from '../tooltip.js';
import { $, el, setStatus, t, onLanguageChanged, log, state, PANEL_WIN,
         keepScroll, restoreScrollSnap, elByPath, scrollSnapshot } from '../core.js';
import { popupMenu, ask, confirmBox } from '../ui.js';
import * as PL from './panel-layout.js';
import { PanelManager } from './panel-store.js';
import { renderPanelLayout, panelWindowHead } from './panel-renderer.js';
// [alpha.162 · W2] ของกลางของเนื้อแผง — re-export ให้โมดูลแผงเรียกจากที่เดียว
export { panelHead, panelTitle, panelBar, panelEmpty } from './panel-chrome.js';
export { makePanelButton } from './panel-renderer.js';
import { buildLayoutReport, reportToJson, defaultExportName } from './panel-export.js';

const HOST_ID = 'app-root';
const SRC_ID = 'k-panel-src';                 // ที่พักของเนื้อแผงที่ยังไม่ถูกวาง (ซ่อนอยู่)

// ชื่อแผงที่โค้ด/เมนูเก่าใช้ → id ใหม่
const ALIAS = {
  'tree-panel': 'tree', explorer: 'tree',
  'props-panel': 'props', properties: 'props',
  'outline-panel': 'outline', navigation: 'outline',
  'content': 'docs', panes: 'docs',
};
export const panelId = (id) => ALIAS[id] || id;

/**
 * ══ ทะเบียนแผงทั้งหมด — **แหล่งความจริงเดียวของหน้าตาแผง** ══
 *
 * [alpha.162 · W2] ตารางนี้ถูกจัดบ้านใหม่: ฟิลด์ `title` (ข้อความที่ประเมินตอน import) ถูกถอดทิ้งทั้งตาราง
 * — มันเป็นของค้างจากยุคก่อนมีไฟล์ภาษา และสร้างบั๊กสองแบบ:
 *   · **ค้างภาษา** — ค่าถูกคิดตอนโหลดโมดูล สลับภาษาแล้วไม่เปลี่ยน (กฎ alpha.161: เรียก t() ตอนอ่าน)
 *   · **โกหก** — แผง `log` เขียนว่า `t('ui.common.save')` (= "บันทึก") และ `outline`/`kanban`
 *     ฝังอังกฤษดิบ `'Navigation'` / `'Kanban'` ทั้งที่กฎ .147/.154 ห้ามข้อความในโค้ด
 * ตอนนี้ชื่อแผงมาจากช่อง `i18n` ช่องเดียว อ่านสดทุกครั้งที่วาด (`titleOf`)
 *
 * ฟิลด์ที่รองรับ (ไม่ใส่ = ใช้ค่าเริ่มต้น):
 *   id           ชื่อแผงในระบบ — ใช้ทุกที่ (คำสั่ง `toggle-panel:<id>` · เมนู · เลย์เอาต์ที่บันทึกไว้)
 *   i18n         คีย์ชื่อแผงในไฟล์ภาษา — **บังคับ** (เทส `[162-W2]` ตรวจว่าทุกแผงมีและแปลออกจริง)
 *   adopt        ตัวเลือก CSS ของเนื้อแผงใน index.html (ระบบ "ย้ายเข้า" host — ห้ามสร้างใหม่)
 *   defaultSide  ฝั่งที่ผนึกตอนเปิดครั้งแรก ('left' เริ่มต้น)
 *   minW         ความกว้างต่ำสุดของเนื้อ (แคบกว่านี้ = แถบเลื่อนแนวนอน · เริ่มต้น 200 · กฎ alpha.73)
 *   dockW        ความกว้างตอนผนึกครั้งแรก (เริ่มต้น 300)
 *   flush        เนื้อแผงจัดการพื้นที่เอง → `.k-panel-flush` (กระดาน · กราฟ · รายการที่เลื่อนเอง)
 *   tearoff      ฉีกออกเป็นหน้าต่าง OS ได้ (เกณฑ์อยู่ที่ TEAROFF_PANELS ข้างล่าง)
 *   icon         ไอคอนของแผงที่ **ไม่ใช่คำสั่ง** เท่านั้น — แผงปกติอ่านจาก `icons/commands.csv` (กฎ .147)
 *   fixed        กินพื้นที่เท่าเนื้อหา ไม่ยืด (แถบเครื่องมือ · แถบสถานะ)
 *   noHead       ไม่มีหัวแผง · closable/floatable false = ปิด/ลอยไม่ได้ (ค่าเริ่มต้นคือทำได้ทั้งคู่)
 *
 * คำอธิบายแผง (hint) ไม่อยู่ที่นี่ → แถว `ui.tip.toggle-panel:<id>` ในไฟล์ภาษา (กฎ .154 · ดู panelDesc)
 */
export const PANEL_DEFS = [
  // ── โครงหน้าต่าง (ปิด/ลอย/ฉีกไม่ได้) ──
  { id: 'toolbar',   i18n: 'ui.panel.barTool',   icon: 'layout', adopt: '#toolbar',   fixed: true, noHead: true, closable: false, floatable: false },
  { id: 'docs',      i18n: 'ui.panel.doc',       icon: 'file',   adopt: '#content',                noHead: true, closable: false, floatable: false },
  { id: 'statusbar', i18n: 'ui.panel.barStatus', icon: 'grid',   adopt: '#statusbar', fixed: true, noHead: true, closable: false, floatable: false },

  // ── เขียน ──
  { id: 'tree',     i18n: 'panel.project',    adopt: '#tree-panel',    defaultSide: 'left',  minW: 220 },
  { id: 'outline',  i18n: 'panel.navigation', adopt: '#outline-panel', defaultSide: 'left',  minW: 220, tearoff: true },
  { id: 'props',    i18n: 'panel.properties', adopt: '#props-panel',   defaultSide: 'right', minW: 240, tearoff: true },
  { id: 'search',   i18n: 'ui.panel.search',  adopt: '#search-panel',  defaultSide: 'left',  minW: 280, dockW: 360, tearoff: true },
  { id: 'notes',    i18n: 'ui.common.notebookNoteQuick', adopt: '#notes-panel', defaultSide: 'right', minW: 220, tearoff: true },
  // [alpha.94] Story Starter — สร้างเรื่องทีละขั้น แล้วเล่นเป็นตอน ๆ กับ Game Master
  // [alpha.164 · รอบต่อ 4] minW 460 → 360: หน้าต่าง 1024 (ต้นไม้ + พื้นที่เขียนขั้นต่ำ 420) เหลือให้แผงนี้ ~390px
  //   เนื้อจึงถูกตัดขอบขวาทุกขั้น · ตรวจแล้วทุกขั้นของตัวสร้าง (พื้นฐาน/ขั้นสูง) พอดีที่ 364px
  { id: 'starter',  i18n: 'panel.starterTitle',  adopt: '#starter-panel',  defaultSide: 'left', minW: 360, dockW: 680, tearoff: true },
  // [alpha.79] บทพูดทั้งผลงาน (กวาดจากไฟล์ทั้งโปรเจกต์)
  { id: 'dialogue', i18n: 'panel.dialogueTitle', adopt: '#dialogue-panel', defaultSide: 'left', minW: 460, dockW: 620, tearoff: true },
  // [alpha.82] ห้องซ้อมบท — คนละตัวกับ "บทพูดทั้งผลงาน" ข้างบน (ตัวนั้นรวบรวมของที่เขียนไปแล้ว
  // ตัวนี้ให้ AI สวมบทตัวละครจาก Wiki คุยกันสด ๆ แล้วหยิบบรรทัดที่ชอบไปใส่บท)
  { id: 'dlgb',     i18n: 'panel.dlgbTitle',     adopt: '#dlgb-panel',     defaultSide: 'right', minW: 420, dockW: 620 },

  // ── วางแผน (บั๊ก #18: ฟีเจอร์ที่ไม่ใช่เอกสาร เป็นแผง ไม่ใช่แท็บ) ──
  { id: 'dashboard', i18n: 'panel.dashboardTitle', adopt: '#dash-panel',     defaultSide: 'left', minW: 620, dockW: 640, tearoff: true },
  { id: 'kanban',    i18n: 'panel.kanbanTitle',    adopt: '#kanban-panel',   defaultSide: 'left', minW: 800, dockW: 640, flush: true, tearoff: true, floatFrac: 0.8 },
  // [alpha.165] flush = กระดานสูงเต็มแผง → แถบเลื่อนแนวนอนของคอลัมน์อยู่ขอบล่างแผง (เดิมกระดานสูงตามเนื้อ แถบไปลอยกลางแผง)
  { id: 'books',     i18n: 'panel.booksTitle',     adopt: '#books-panel',    defaultSide: 'left', minW: 400, dockW: 640, tearoff: true },
  // [alpha.141] จัดการบท — ปกบท (รูป/ข้อความ) · ติ๊กใช้ปก · ลำดับบท · สถิติ
  { id: 'chapters',  i18n: 'ui.chapters.title',    adopt: '#chapters-panel', defaultSide: 'left', minW: 400, dockW: 640 },
  { id: 'timeline',  i18n: 'panel.timelineTitle',  adopt: '#tl-panel',       defaultSide: 'left', minW: 620, dockW: 640, tearoff: true, floatFrac: 0.8 },
  { id: 'maps',      i18n: 'panel.mapsTitle',      adopt: '#maps-panel',     defaultSide: 'left', minW: 400, dockW: 640, tearoff: true, floatFrac: 0.8 },
  // [alpha.60r1 ข้อ 21] คลังรูปภาพ — ย้ายจากแท็บเอกสารมาเป็นแผงเหมือนฟีเจอร์อื่น
  { id: 'gallery',   i18n: 'panel.galleryTitle',   adopt: '#gal-panel',      defaultSide: 'left', minW: 600, dockW: 640, tearoff: true },
  // [alpha.63r] กระดานอารมณ์ — แยกจากคลังรูปเพราะต้อง "ลากรูปมาวาง" ข้ามแผง
  { id: 'gallery-board', i18n: 'panel.galleryBoardTitle', adopt: '#galboard-panel', defaultSide: 'right', minW: 400, dockW: 640, flush: true, floatFrac: 0.8 },
  { id: 'network',   i18n: 'ui.panel.networkTitle', adopt: '#net-panel',      defaultSide: 'left', minW: 400, dockW: 640, flush: true, tearoff: true, floatFrac: 0.8 },
  { id: 'planner',   i18n: 'ui.panel.plannerTitle', adopt: '#planner-panel',  defaultSide: 'left', minW: 800, dockW: 640, flush: true, tearoff: true, floatFrac: 0.8 },
  { id: 'planner-props', i18n: 'ui.panel.propsPlanner', adopt: '#planner-props-panel', defaultSide: 'right', minW: 240 },
  { id: 'floorplan', i18n: 'ui.common.graphArea',   adopt: '#floor-panel',    defaultSide: 'left', minW: 400, dockW: 640, tearoff: true, floatFrac: 0.8 },
  // ── [alpha.66 ข้อ 1+9] เรื่องแบบแตกสาย: ผัง + โหมดทดลองเล่น ──
  { id: 'branch',    i18n: 'panel.branchTitle',     adopt: '#branch-panel',   defaultSide: 'left', minW: 700, dockW: 640, flush: true, tearoff: true, floatFrac: 0.8 },
  // [alpha.69] สารานุกรม
  { id: 'codex',     i18n: 'panel.codexTitle',      adopt: '#codex-panel',    defaultSide: 'left', minW: 320, dockW: 680, flush: true, tearoff: true },

  // ── ตรวจ ──
  { id: 'comments',  i18n: 'panel.commentsTitle',   adopt: '#comments-panel', defaultSide: 'right', minW: 240, tearoff: true },
  // [alpha.125 ข้อ G] ฉากที่กล่าวถึงเอนทิตี้ — ทั้งโปรเจกต์ในหน้าเดียว (ดัชนีตัวเดียวกับแท็บใน Wiki)
  { id: 'backlinks', i18n: 'ui.worldAutoLink.panelTitle', adopt: '#backlinks-panel', defaultSide: 'right', minW: 300, dockW: 380 },
  { id: 'player',    i18n: 'panel.playerTitle',     adopt: '#player-panel',   defaultSide: 'right', minW: 300, dockW: 440, flush: true, tearoff: true },
  { id: 'log',       i18n: 'panel.logTitle',        adopt: '#log-panel',      defaultSide: 'right', minW: 300, dockW: 420, flush: true, tearoff: true },
  // [alpha.69] ประวัติการทำงาน · บันทึกประจำวัน
  { id: 'history',   i18n: 'panel.historyTitle',    adopt: '#history-panel',  defaultSide: 'right', minW: 280, dockW: 420, flush: true, tearoff: true },
  { id: 'record',    i18n: 'panel.recordTitle',     adopt: '#record-panel',   defaultSide: 'right', minW: 280, dockW: 460, flush: true, tearoff: true },
  // [alpha.79] จัดการปลั๊กอิน
  { id: 'plugins',   i18n: 'panel.pluginsTitle',    adopt: '#plugins-panel',  defaultSide: 'right', minW: 420, dockW: 520 },

  // ── AI ──
  // [alpha.116 ข้อ 3] AI Hub — รวมทางเข้าของความสามารถ AI ทุกตัว (ตัวมันเองไม่มีตรรกะ AI เลย)
  { id: 'ai-hub',      i18n: 'panel.aiHubTitle',      adopt: '#ai-hub-panel',      defaultSide: 'right', minW: 320, dockW: 420 },
  // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI
  { id: 'ai-analyzer', i18n: 'panel.aiAnalyzerTitle', adopt: '#ai-analyzer-panel', defaultSide: 'right', minW: 400, dockW: 640, tearoff: true },
  // [alpha.61 ข้อ 2] แชทกับ AI — เซสชันเก็บใน Sessions/ ของโปรเจกต์
  { id: 'ai-chat',     i18n: 'panel.aiChatTitle',     adopt: '#ai-chat-panel',     defaultSide: 'right', minW: 320, dockW: 640, tearoff: true },
];

// ───────── [alpha.67] Tear-off — แผงที่ฉีกออกเป็นหน้าต่าง OS จริงได้ ─────────
//
// เกณฑ์: แผงต้อง "วาดตัวเองได้ครบจากไฟล์โปรเจกต์" โดยไม่พึ่ง `state.active` (ฉากที่เปิดอยู่)
// และไม่พึ่งการลากของข้ามแผง — เพราะหน้าต่างลูกเป็นคนละ JS context ไม่มีแท็บเอกสารและไม่มีแผงอื่น
// [alpha.68 · เฟส 2] แผงที่ผูกกับ "ฉากที่เปิดอยู่" ฉีกได้แล้ว เพราะ `panel-sync.js` ส่ง `state.active` ข้ามหน้าต่าง
//
// ที่จงใจ **ไม่** ติดธง `tearoff`:
//   docs/toolbar/statusbar/tree — โครงหน้าต่างหลัก (แชร์ ProseMirror ข้าม context ไม่ได้)
//   gallery-board — รับรูปด้วยการลากจากแผงคลังรูป ฉีกแยกหน้าต่างแล้วขาดกัน
//   planner-props — แผงคู่ของ Planner (วาดผ่าน setPropsCallback ในหน้าต่างเดียวกัน)
//   plugins — ปลั๊กอินลงทะเบียนคำสั่งกับ context ของหน้าต่างหลัก ปุ่ม "รันคำสั่ง" ในหน้าต่างลูกจะไม่เจอ
//   chapters · dlgb · backlinks · ai-hub — ยังไม่ได้ทดสอบว่าวาดครบในหน้าต่างแยก (เปิดธงได้เมื่อตรวจแล้ว)
//
// [alpha.162 · W2] **สร้างจากตารางเดียว** — เดิมเป็น Set ที่เขียนรายชื่อซ้ำอีกชุด
// (กฎข้อ 28: ตารางที่ต้องตรงกับอีกไฟล์ ให้ derive ตอนรัน อย่าคัดลอก)
export const TEAROFF_PANELS = new Set(PANEL_DEFS.filter((d) => d.tearoff).map((d) => d.id));
/** แผงนี้ฉีกออกเป็นหน้าต่างได้ไหม (หน้าต่างลูกฉีกซ้อนไม่ได้) */
export function canTearOff(id) {
  return !PANEL_WIN && TEAROFF_PANELS.has(panelId(id)) && typeof kapiTearOff() === 'function';
}
function kapiTearOff() { try { return window.kapi && window.kapi.tearOff; } catch { return null; } }

const tornOff = new Set();                     // id ของแผงที่ตอนนี้อยู่ในหน้าต่างแยก
export function isTornOff(id) { return tornOff.has(panelId(id)); }
export function tornOffIds() { return [...tornOff]; }

/**
 * ฉีกแผงออกเป็นหน้าต่าง OS จริง
 * ปิดแผงในหน้าต่างนี้ก่อน (ผ่าน hidePanel ของโมดูลนี้ = จด "ที่เดิม" ไว้ให้อัตโนมัติ)
 * แล้วค่อยเปิดหน้าต่างลูก — ปิดหน้าต่างลูกเมื่อไหร่ แผงกลับมาที่เดิมเอง
 */
export async function tearOffPanel(id) {
  const pid = panelId(id);
  if (!canTearOff(pid)) return false;
  const d = PANEL_DEFS.find((x) => x.id === pid);
  // ขนาด/ตำแหน่งเริ่มต้นของหน้าต่าง = กล่องที่แผงกินอยู่ตอนนี้บนจอ (ผู้ใช้จะได้ไม่เสียบริบท)
  const node = document.querySelector(`.k-float-panel[data-panel-id="${pid}"]`)
            || host().querySelector(`.k-panel[data-panel-id="${pid}"]`);
  const r = node ? node.getBoundingClientRect() : null;
  const box = r && r.width > 80
    ? { x: Math.round(window.screenX + r.left), y: Math.round(window.screenY + r.top),
        w: Math.round(r.width), h: Math.round(r.height) }
    : { w: d && d.dockW ? d.dockW + 80 : 720, h: 620 };
  hidePanel(pid, true);                        // force: ข้ามกล่องยืนยันของแผง (เราไม่ได้ทิ้งงาน แค่ย้ายหน้าต่าง)
  tornOff.add(pid);
  renderPanels(true);
  let ok = false;
  try {
    // [alpha.166] ธีม + สีพื้นของหน้าต่างหลักไปกับหน้าต่างลูก — ทาตั้งแต่เฟรมแรก (เดิมแวบเป็นเทาของธีมเก่า)
    const theme = [...document.body.classList].find((c) => c.startsWith('theme-'))?.slice(6) || '';
    let bg = '';
    try { bg = getComputedStyle(document.body).getPropertyValue('--bg').trim(); } catch {}
    ok = await window.kapi.tearOff({ id: pid, title: d ? titleOf(d) : pid, root: state.root || '', theme, bg, ...box });
  } catch (e) { log('warn', t('ui.panel.panelOutWindowNot') + pid, e); }
  if (!ok) { tornOff.delete(pid); showPanel(pid); return false; }
  setStatus(tf('ui.panel.tornOffF', (d ? titleOf(d) : pid)));
  return true;
}
/** ยกหน้าต่างแผงที่เปิดอยู่แล้วขึ้นมาหน้าสุด (tearOff ตัวเดิมทำหน้าที่นี้ให้เมื่อ id ซ้ำ) */
function focusTearOff(pid) {
  try { window.kapi.tearOff({ id: pid }); } catch {}
  setStatus(t('ui.panel.tornOffFocus'));
  return true;
}
/** เรียกแผงกลับจากหน้าต่างแยก (สั่งปิดหน้าต่างลูก — ตัวจริงกลับมาตอนได้สัญญาณ tearoff-closed) */
export async function recallPanel(id) {
  const pid = panelId(id);
  if (!tornOff.has(pid)) return false;
  try { await window.kapi.tearOffClose(pid); } catch {}
  return true;
}
/** หน้าต่างลูกปิดแล้ว → คืนแผงกลับที่เดิมที่จดไว้ */
export function onTearOffClosed(id) {
  const pid = panelId(id);
  if (!tornOff.delete(pid)) return false;
  showPanel(pid);                              // showPanel ของโมดูลนี้คืน "ที่เดิม" (homes) ให้เอง
  renderPanels(true);
  if (onShowHook) { try { onShowHook(pid); } catch {} }
  return true;
}
/** ผูกสัญญาณจาก main — เรียกครั้งเดียวตอนเริ่มระบบแผงในหน้าต่างหลัก */
let _syncBound = false;
export function bindTearOffSync() {
  if (_syncBound || PANEL_WIN) return false;
  const api = window.kapi;
  if (!api || !api.onSync) return false;
  _syncBound = true;
  api.onSync((msg) => { if (msg && msg.kind === 'tearoff-closed') onTearOffClosed(msg.id); });
  // หน้าต่างลูกที่ยังเปิดค้างจากรอบก่อน (โหลดหน้าต่างหลักใหม่) — ซิงก์รายการให้ตรงความจริง
  try { api.tearOffList().then((ids) => { for (const id of ids || []) { tornOff.add(id); hidePanel(id, true); } renderPanels(true); }); } catch {}
  return true;
}

/**
 * [alpha.67] โหมดหน้าต่างแผง — วางเนื้อแผงเดียวเต็มหน้าต่าง **ไม่ผ่านระบบเลย์เอาต์เลย**
 * จงใจไม่เรียก initPanelSystem: ไม่มี dock/tab/float ให้จัดการ และที่สำคัญกว่านั้นคือ
 * ห้ามแตะ localStorage ก้อนเดียวกับหน้าต่างหลัก (origin file:// เดียวกัน)
 */
export function mountPanelWindow(id) {
  const pid = panelId(id);
  const m = getPanelManager();
  m.setReadOnly(true);                          // ตาข่ายชั้นสอง เผื่อมีทางเรียก save() ที่มองไม่เห็น
  if (!started) { started = true; registerPanels(); srcHolder(); }
  const d = PANEL_DEFS.find((x) => x.id === pid);
  document.body.classList.add('panel-window');
  const h = host();
  // ⚠ ห้าม `h.innerHTML = ''` — ตอนนี้ใน host มี **เนื้อแผงตัวจริง** วางอยู่แล้ว
  // (แถบสถานะ/แถบเครื่องมือ/พื้นที่เขียน ถูกย้ายเข้ามาก่อนหน้านี้) การล้างทิ้งคือการ **ลบทิ้งถาวร**
  // แล้วโค้ดที่อ้าง id เหล่านั้นพังทันที — `setStatus()` = `$('#status').textContent` ระเบิดเป็นตัวแรก
  // ท่าเดียวกับ renderPanels: ย้ายกลับเข้าที่พักที่ซ่อนอยู่ ของทุกชิ้นยังอยู่ใน DOM ครบ
  const holder = srcHolder();
  for (const kid of [...h.children]) holder.appendChild(kid);
  for (const [, node] of adopted) if (!holder.contains(node) && !h.contains(node)) holder.appendChild(node);
  const box = el('div', 'k-panel k-panelwin');
  box.dataset.panelId = pid;
  // [alpha.162 · W2] หัว/เนื้อของหน้าต่างที่ฉีกออกมา ใช้ตัวประกอบชุดเดียวกับหัวแผงในหน้าต่างหลัก
  // (เดิมประกอบเอง → ไอคอนหาย · ธง flush ไม่ถูกใส่ = แผงกระดาน/กราฟในหน้าต่างแยกได้ padding เกินมา)
  box.appendChild(panelWindowHead({ title: d ? titleOf(d) : pid, icon: d ? panelIcon(d) : '' }));
  const body = el('div', 'k-panel-body' + (d && d.flush ? ' k-panel-flush' : ''));
  const node = adopted.get(pid);
  if (node) body.appendChild(node);
  box.appendChild(body);
  h.appendChild(box);
  document.title = (d ? titleOf(d) : pid) + ' — ' + (state.title || 'Killian 2');
  return pid;
}

// ชื่อแผงตามภาษาที่โหลดอยู่ — เรียกใหม่ทุกครั้งที่ render
// [alpha.128] เดิมเขียน `t(d.i18n, d.title)` — **`t()` รับคีย์ตัวเดียว อาร์กิวเมนต์ที่สองถูกทิ้ง**
// จึงหลอกคนอ่านว่า "ไม่มีคีย์ก็ยังได้ title เดิม" ทั้งที่ความจริงหัวแผงจะโชว์ตัวคีย์โต้ง ๆ
// (เจอจริง 6 แผงที่ i18n ชี้ไปคีย์ที่ไม่มีอยู่: search · notes · network · planner ·
//  planner-props · floorplan → หัวแผงขึ้นว่า PANEL.PLANNERPROPSTITLE)
// [alpha.162 · W2] ไม่มีช่อง `title` ให้ตกกลับอีกแล้ว — ทุกแผงต้องมี `i18n` (เทสบังคับ)
// คีย์ที่ไม่มีในไฟล์ภาษา = ผู้ใช้เห็นตัวคีย์โต้ง ๆ บนหัวแผง ซึ่งเทส i18n-keys จับได้ก่อนถึงมือผู้ใช้
function titleOf(d) { return t(d.i18n); }
/**
 * คำอธิบายแผง
 *
 * [alpha.79 · แก้บั๊ก] เดิมเป็น `t('panel.desc_<id>', d.desc)` ซึ่งเป็นซากของระบบภาษารุ่นเก่า —
 * ตั้งแต่ .77 `t()` **ไม่รับค่าสำรอง** และไม่เคยมีคีย์ `panel.desc_*` อยู่ในไฟล์ภาษาเลย
 * ผลคือกล่อง "จัดการแผง" โชว์คำว่า `panel.desc_tree` แทนคำอธิบายจริงมาตั้งแต่รอบนั้น
 * ตอนนี้อ่านจาก `d.desc` ตรง ๆ (ซึ่งเป็นค่าที่มาจากไฟล์ภาษาอยู่แล้ว)
 */
export function panelDesc(id) {
  // [alpha.154 ข้อ 6] ★ คำอธิบายแผง = คำอธิบายของปุ่ม/คำสั่งเปิดแผงนั้น (`ui.tip.toggle-panel:<id>`)
  // ผู้ใช้: *"hint คำอธิบาย panel และคำสั่ง ... แยกออกมา เวลาเราไปแปลจะง่าย ไม่ซ้ำซ้อน"*
  // เดิมแผงมีคีย์ของตัวเองชื่อสุ่ม (`ui.panel.tocResultTaskBook`) ซ้อนกับคำอธิบายปุ่มอีกชุด
  // ตอนนี้แผงหนึ่งมีคำอธิบายแถวเดียวในไฟล์ภาษา ใช้ทั้งเมนูหัวแผงและ tooltip ของปุ่ม
  return tipText('toggle-panel:' + panelId(id));
}

let pm = null;
let started = false;
let lastSig = '';                              // ลายเซ็นเลย์เอาต์ที่วาดไปแล้ว (กัน re-render ซ้ำ)
const adopted = new Map();                     // id → element เดิมใน index.html
const extras = new Map();                      // id → [ปุ่มพิเศษบนหัวแผง]
const meta = new Map();                        // id → {title, icon, fixed, noHead}

// ───────── singleton ─────────
export function getPanelManager() {
  if (!pm) pm = new PanelManager();
  return pm;
}
export function savePanelLayout() { if (pm) pm.store.save(); }

function host() {
  return document.getElementById(HOST_ID) || document.body;
}
function srcHolder() {
  let h = document.getElementById(SRC_ID);
  if (!h) { h = el('div'); h.id = SRC_ID; h.hidden = true; document.body.appendChild(h); }
  return h;
}

// [alpha.147] ไอคอนของแผงที่เปิด/ปิดได้ = ช่อง icon ของคำสั่ง `toggle-panel:<id>` ใน icons/commands.csv
// (ว่าง = แผงนั้นไม่มีไอคอน) · แผงตายตัว (แถบเครื่องมือ · เอกสาร · แถบสถานะ) ไม่ใช่คำสั่ง จึงยังใช้ `icon` ของตัวเอง
export function panelIcon(d) {
  const cid = 'toggle-panel:' + d.id;
  return isRegisteredCommand(cid) ? commandIcon(cid) : (d.icon || '');
}

// ───────── ลงทะเบียนแผงทั้งหมด ─────────
export function registerPanels() {
  const m = getPanelManager();
  for (const d of PANEL_DEFS) {
    meta.set(d.id, { title: titleOf(d), icon: panelIcon(d), fixed: !!d.fixed, noHead: !!d.noHead, desc: panelDesc(d.id) });
    const node = d.adopt ? $(d.adopt) : null;
    if (node) adopted.set(d.id, node);
    m.registerPanel(d.id, {
      title: titleOf(d),
      icon: panelIcon(d),
      closable: d.closable !== false,
      floatable: d.floatable !== false,
      defaultSide: d.defaultSide || 'left',
      // [alpha.66r6] ขนาดตั้งต้นตอนผนึกครั้งแรก — แผงกระดาน/ผังต้องกว้างกว่าแผงข้างทั่วไปมาก
      defaultSize: { w: d.dockW || 300, h: d.dockH || 220 },
      // [alpha.66r12] ขนาดอ้างอิงตอนลอย (เลขเดียวกับ defaultFloatBox) — ใช้เป็นเพดานความสูง
      // ตอนลากแผงข้างที่สูงเต็มคอลัมน์ออกมาลอย
      floatSize: { w: d.floatW || Math.max(340, Math.round((d.dockW || 300) * 1.1)), h: d.floatH || 520 },
      render: (h) => { const n = adopted.get(d.id); if (n) h.appendChild(n); return n; },
    });
  }
  return m;
}

// เลย์เอาต์ตั้งต้น (Photoshop): เครื่องมือบน · ซ้าย = โปรเจกต์+Navigation เป็นแท็บ · กลาง = เอกสาร · ล่าง = สถานะ
export function defaultLayout() {
  return PL.dock('col', [
    PL.panel('toolbar', t('ui.panel.barTool')),
    PL.dock('row', [
      PL.tabs([PL.panel('tree', t('ui.common.project')), PL.panel('outline', t('ui.panel.navigation'))], 0),
      PL.panel('docs', t('ui.panel.doc')),
    ], [0.24, 0.76]),
    PL.panel('statusbar', t('ui.panel.barStatus')),
  ], [0, 1, 0]);
}

// ───────── [alpha.66r3] Workspace Presets ─────────
// สเปก: "เก็บ Layout ของ Panel ทั้งหมดเป็นเซ็ตไว้ แล้วสลับตาม workflow ได้ทันที"
// ชุดสำเร็จรูปสร้างจากต้นไม้ตรง ๆ (ไม่เก็บใน storage) — แก้ไม่ได้ ลบไม่ได้ เหมือน Essentials ของ Photoshop
// แผงที่ไม่ได้อยู่ในต้นไม้ = ปิดอยู่ · ผู้ใช้บันทึกชุดของตัวเองทับชื่อเดิมไม่ได้ (กันเผลอ)
const wsRow = (left, center, right, sizes) =>
  PL.dock('row', right ? [left, center, right] : [left, center], sizes);
const wsFrame = (mid) => PL.dock('col', [
  PL.panel('toolbar', t('ui.panel.barTool')), mid, PL.panel('statusbar', t('ui.panel.barStatus')),
], [0, 1, 0]);

// [alpha.161 · U7] ป้ายเป็น getter — คำนวณตามภาษาปัจจุบันทุกครั้งที่อ่าน (เดิมค้างภาษาตอน import)
const wsDef = (id, labelKey, build) => ({ id, labelKey, build, get label() { return t(labelKey); } });
export const BUILTIN_WORKSPACES = [
  wsDef('essentials', 'ui.panel.essentialsDefault', () => defaultLayout()),
  { id: 'writing', labelKey: 'ui.panel.writeScreenHasToc', get label() { return t(this.labelKey); },
    build: () => wsFrame(wsRow(PL.panel('tree', t('ui.common.project')), PL.panel('docs', t('ui.panel.doc')), null, [0.18, 0.82])) },
  { id: 'planning', labelKey: 'ui.panel.plannerOutlineStoryProps', get label() { return t(this.labelKey); },
    build: () => wsFrame(wsRow(
      PL.tabs([PL.panel('tree', t('ui.common.project')), PL.panel('kanban', t('ui.panel.kanbanTitle')), PL.panel('timeline', t('ui.common.lineTime'))], 0),
      PL.panel('docs', t('ui.panel.doc')),
      PL.panel('props', t('ui.common.props')), [0.26, 0.52, 0.22])) },
  { id: 'review', labelKey: 'ui.panel.checkEditCommentNote', get label() { return t(this.labelKey); },
    build: () => wsFrame(wsRow(
      PL.tabs([PL.panel('tree', t('ui.common.project')), PL.panel('outline', t('ui.panel.navigation'))], 1),
      PL.panel('docs', t('ui.panel.doc')),
      PL.tabs([PL.panel('comments', t('ui.common.comment')), PL.panel('notes', t('ui.common.notebookNoteQuick'))], 0), [0.20, 0.56, 0.24])) },
];
export function isBuiltinWorkspace(name) { return BUILTIN_WORKSPACES.some((w) => w.id === name || w.label === name); }

/** รายชื่อเวิร์กสเปซทั้งหมด — ชุดสำเร็จรูปก่อน แล้วตามด้วยของผู้ใช้ */
export function listWorkspaces() {
  const mine = getPanelManager().listWorkspaces();
  return [
    ...BUILTIN_WORKSPACES.map((w) => ({ name: w.id, label: w.label, builtIn: true })),
    ...mine.map((n) => ({ name: n, label: n, builtIn: false })),
  ];
}
/** บันทึกสภาพ UI ปัจจุบันเป็นเวิร์กสเปซชื่อ name (ทับของเดิมได้ ยกเว้นชื่อชุดสำเร็จรูป) */
export function saveWorkspace(name) {
  const n = String(name || '').trim();
  if (!n || isBuiltinWorkspace(n)) return false;
  rememberOpenPanels();                       // ให้ homes/สัดส่วนล่าสุดติดไปกับ snapshot ด้วย
  return getPanelManager().saveWorkspace(n, { homes: Object.fromEntries(homes) });
}
export function deleteWorkspace(name) {
  if (isBuiltinWorkspace(name)) return false;
  return getPanelManager().removeWorkspace(name);
}
/** สลับไปเวิร์กสเปซ — รื้อแล้วสร้างใหม่ตามพิมพ์เขียว (ทั้งต้นไม้ · แผงลอย · สัดส่วน · ที่กลับของแผงที่ปิด) */
export function applyWorkspace(name) {
  const m = getPanelManager();
  const b = BUILTIN_WORKSPACES.find((w) => w.id === name || w.label === name);
  const snap = b ? { version: 2, root: b.build(), floats: [], splitRatios: {}, homes: null }
                 : m.getWorkspace(name);
  if (!snap) return false;
  const hm = m.applySnapshot(snap);
  resetSideStash();                             // [alpha.161 · U6] เลย์เอาต์เปลี่ยนทั้งชุด — ที่พักทุกฝั่งหมดความหมาย (เดิมล้างแค่ _stash)
  homes.clear();
  if (hm) for (const k of Object.keys(hm)) homes.set(k, hm[k]);
  saveHomes();
  renderPanels(true);
  // แผงฟีเจอร์ที่โผล่มาพร้อมเวิร์กสเปซต้องถูกวาดเนื้อด้วย (ไม่ได้ผ่าน showPanel จึงไม่มีใครเรียก hook)
  if (onShowHook) for (const id of m.openIds()) { try { onShowHook(id); } catch {} }
  setStatus(t('ui.panel.wsApplied') + (b ? b.label : name));
  return true;
}

// ───────── [alpha.66r3] ระบบจัดการพื้นที่ (Space Management) ─────────
// สเปกข้อ 1–2: ซ่อนแผงทั้งหมดให้เหลือแต่ Canvas · ซ่อนเฉพาะฝั่งใดฝั่งหนึ่ง
// ทำด้วย "ธง hidden ในต้นไม้" ไม่ใช่ CSS ล้วน — เพื่อให้สัดส่วน/สล็อตอยู่ครบตอนเรียกกลับ
// (บทเรียนข้อ 21 ของ alpha.62: ตัดโหนดออกจากต้นไม้ = เสียทั้งตำแหน่งและขนาด)
// [alpha.161 · U6] ★ ระบบซ่อนเหลือชุดเดียว — เดิม `_stash` (toggleSpace) กับ `_sideStash` (toggleSide) แยกกัน
//   กดซ่อนขวาจากเมนู แล้วกดปุ่มฝั่งขวาบนแถบชื่อ = สองระบบต่างคนต่างจำ คืนแผงไม่ครบ/ปุ่มขึ้นสถานะผิด
//   ตอนนี้ทุกทาง (เมนู · ปุ่มฝั่ง · เมนูหัวแผง) ใช้ `_sideStash` ตัวเดียว · toggleSpace คงไว้เป็นชื่อเรียกเดิม
export function panelsHidden() { return SIDES_ALL.some((k) => !!_sideStash[k]); }
export function hiddenMode() { return _sideStash.all ? 'all' : (SIDES.find((k) => !!_sideStash[k]) || ''); }

/** แผงที่ "เห็นอยู่และปิดได้" ตอนนี้ — กรองตามฝั่งได้ (ใช้ตำแหน่งจริงบนจอ ไม่ใช่ defaultSide) */
function visibleClosable(side) {
  const m = getPanelManager();
  rememberSides();
  return PANEL_DEFS.filter((d) => d.closable !== false && m.isOpen(d.id)
                                  && (!side || sideOf(d) === side)).map((d) => d.id);
}
/**
 * ซ่อน/คืนแผง — mode: 'all' (เหลือแต่พื้นที่เขียน) · 'left' · 'right'
 * เรียกซ้ำด้วย mode เดิม = คืนสภาพ · เรียกด้วย mode อื่นระหว่างที่ซ่อนอยู่ = คืนก่อนแล้วค่อยซ่อนชุดใหม่
 */
export function toggleSpace(mode = 'all') {
  // [alpha.161 · U6] alias: ฝั่งเดียว = toggleSide · 'all' = ชุด "ทั้งหมด" ในที่พักตัวเดียวกัน
  if (mode !== 'all') return toggleSide(mode);
  if (_sideStash.all) {
    const ids = _sideStash.all;
    _sideStash.all = null;
    // ใช้ showPanel/hidePanel "ของโมดูลนี้" ไม่ใช่ของ manager ตรง ๆ — สองตัวนี้จำ/คืน "ที่เดิม"
    // (แผงที่ลอยอยู่ตอนถูกซ่อน ต้องกลับไปลอยที่พิกัดเดิม ไม่ใช่ถูกผนึกมั่วตามค่าเริ่มต้น)
    for (const id of ids) { try { showPanel(id); } catch {} }
    renderPanels(true);
    if (onShowHook) for (const id of ids) { try { onShowHook(id); } catch {} }
    setStatus(t('ui.panel.spaceRestored'));
    return false;
  }
  const ids = visibleClosable(null);
  if (!ids.length) { setStatus(t('ui.panel.spaceNone')); return false; }
  for (const id of ids) { try { hidePanel(id, true); } catch {} }     // force: ข้ามกล่องยืนยันของแผง
  _sideStash.all = ids;
  renderPanels(true);
  setStatus(t('ui.panel.spaceAll'));
  return true;
}

// ───────── [alpha.157] ซ่อน/แสดงแผง "ทีละฝั่ง" ซ้าย · บน · ล่าง · ขวา ─────────
// ผู้ใช้: *"ใน toolbar ด้านขวาสุด เพิ่มปุ่มซ่อน panel ด้านซ้าย-บน-ล่าง-ขวา แล้วผู้ใช้สามารถปรับแสดง/ไม่แสดงได้"*
// ต่างจาก toggleSpace (ที่เก็บได้ครั้งละชุดเดียว — กดซ่อนขวาแล้วซ่อนซ้าย = ขวากลับมาเอง)
// ตรงที่สี่ฝั่งเป็นอิสระต่อกัน · ฝั่งของแผงตัดสินจาก "ตำแหน่งจริงเทียบพื้นที่เขียน" ไม่ใช่ defaultSide
export const SIDES = ['left', 'top', 'bottom', 'right'];
const SIDES_ALL = [...SIDES, 'all'];
const _sideStash = { left: null, top: null, bottom: null, right: null, all: null };

/** ฝั่งของแผงที่ผนึกอยู่ เทียบกับกล่องพื้นที่เขียน ('' = ลอย/ซ้อนทับ/หาไม่เจอ) — บริสุทธิ์ */
export function sideOfRect(r, docs) {
  if (!r || !docs || !r.width || !r.height) return '';
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (r.right <= docs.left + 2) return 'left';
  if (r.left >= docs.right - 2) return 'right';
  if (r.bottom <= docs.top + 2 && cx > docs.left - 2 && cx < docs.right + 2) return 'top';
  if (r.top >= docs.bottom - 2 && cx > docs.left - 2 && cx < docs.right + 2) return 'bottom';
  if (cx < docs.left) return 'left';
  if (cx > docs.right) return 'right';
  return cy < docs.top ? 'top' : cy > docs.bottom ? 'bottom' : '';
}

/** แผงที่เห็นอยู่ ปิดได้ และผนึกอยู่ฝั่งนั้น */
function dockedOnSide(side) {
  const m = getPanelManager();
  const h = host();
  const docsEl = h && h.querySelector('.k-panel[data-panel-id="docs"]');
  const dr = docsEl && docsEl.getBoundingClientRect();
  if (!dr || !dr.width) return [];
  const out = [];
  for (const d of PANEL_DEFS) {
    if (d.closable === false || !m.isOpen(d.id)) continue;
    if (m.isFloating && m.isFloating(d.id)) continue;
    // แท็บที่ถูกซ่อนหลังแท็บอื่นไม่มีขนาด → ใช้กลุ่มแท็บที่ครอบแทน
    let node = h.querySelector(`.k-panel[data-panel-id="${d.id}"]`);
    if (!node) continue;
    const grp = node.closest('.k-tab-group');
    const r = (grp || node).getBoundingClientRect();
    if (sideOfRect(r, dr) === side) out.push(d.id);
  }
  return out;
}
export function sideHidden(side) { return !!_sideStash[side]; }
// [alpha.157r] ผู้ใช้: "เปิดปิดแผง บน ล่าง ใช้ไม่ได้" — เลย์เอาต์ปกติไม่มีแผงผนึกเหนือ/ใต้พื้นที่เขียนเลย
// (ด้านบนคือแถบเครื่องมือ ด้านล่างคือแถบสถานะ ซึ่งปิดไม่ได้) → กดแล้วขึ้นแค่ "ไม่มีแผง" เงียบ ๆ
// ตอนนี้ฝั่งบน/ล่างรวม "แถบ" ของฝั่งนั้นด้วย จึงมีผลเสมอ · ซ่อนด้วยคลาสบน <body> (แถบไม่ใช่แผงที่ปิดได้)
const SIDE_BAR = { top: 'k-hide-toolbar', bottom: 'k-hide-statusbar' };
/** สลับฝั่งเดียว · คืน true = ซ่อนแล้ว · false = แสดงคืน (หรือฝั่งนั้นไม่มีอะไรให้ซ่อน) */
export function toggleSide(side) {
  if (!SIDES.includes(side)) return false;
  const bar = SIDE_BAR[side];
  if (_sideStash[side]) {
    const ids = _sideStash[side];
    _sideStash[side] = null;
    if (bar) document.body.classList.remove(bar);
    for (const id of ids) { try { showPanel(id); } catch {} }
    renderPanels(true);
    if (onShowHook) for (const id of ids) { try { onShowHook(id); } catch {} }
    setStatus(t('ui.panel.sideShown'));
    return false;
  }
  const ids = dockedOnSide(side);
  if (!ids.length && !bar) { setStatus(t('ui.panel.spaceNone')); return false; }
  for (const id of ids) { try { hidePanel(id, true); } catch {} }
  if (bar) document.body.classList.add(bar);
  _sideStash[side] = ids;
  renderPanels(true);
  setStatus(t('ui.panel.sideHidden'));
  return true;
}
/** เปลี่ยนโปรเจกต์/รีเซ็ตเลย์เอาต์ = ลืมของที่พักไว้ (ไม่งั้นกดแสดงคืนแล้วเปิดแผงของเลย์เอาต์เก่า) */
export function resetSideStash() {
  for (const k of SIDES_ALL) _sideStash[k] = null;
  try { document.body.classList.remove(...Object.values(SIDE_BAR)); } catch {}
}

// ───────── วาด ─────────
function renderOpts() {
  for (const d of PANEL_DEFS) {                 // รีเฟรชชื่อตามภาษาปัจจุบัน
    const m = meta.get(d.id) || {};
    // [alpha.73 ข้อ 6] minW เดินทางไปกับ meta → ตัววาดตั้ง --panel-min-w ให้เอง (ไม่ฮาร์ดโค้ดใน CSS)
    meta.set(d.id, { ...m, title: titleOf(d), desc: panelDesc(d.id), minW: d.minW, closable: d.closable,
                     flush: !!d.flush });
  }
  return {
    meta,
    host: host(),
    headExtras: (id) => extras.get(id) || [],
    // [alpha.67] ปุ่ม 🖥 บนหัวแผง — โผล่เฉพาะแผงที่ฉีกออกเป็นหน้าต่างจริงได้
    canTearOff,
    onTearOff: (id) => tearOffPanel(id),
    // [alpha.66r3] คำสั่งจัดการพื้นที่ที่อยู่หลังปุ่ม ☰ ของทุกแผง (Progressive Disclosure)
    extraHeadMenu: (id) => {
      // [alpha.159 · M17] ต้องรู้ฝั่ง "ตอนเปิดเมนู" — เดิมเรียก sideOf() กับตารางที่ยังว่าง (ไม่เคย rememberSides)
      // และส่ง defaultSide:'left' ตายตัว → กดจากแผงฝั่งขวาก็ซ่อนฝั่งซ้ายเสมอ · ป้ายบอกฝั่งด้วย (QoL)
      const side = sideNow(id);
      return [
        { label: t('ui.panel.hidePanelAllArea'), click: () => toggleSpace('all') },
        { label: t(side === 'right' ? 'ui.menu.hidePanelSideRight' : 'ui.menu.hidePanelSideLeft'),
          click: () => toggleSpace(side) },
        { label: t('ui.panel.work'), click: () => workspaceMenu() },
      ];
    },
    renderPanelBody: (id, body) => {
      const node = adopted.get(id);
      if (node) { body.appendChild(node); return node; }
      const def = pm && pm.registry.get(id);
      if (def && def.render) return def.render(body);
      return body;
    },
  };
}

/** วาดใหม่ทั้งต้นไม้ (ข้ามถ้าเลย์เอาต์ไม่เปลี่ยน — กัน ProseMirror ถูกถอด-ใส่โดยไม่จำเป็น) */
// แผงเอกสารต้อง "เห็นเสมอ" — ถ้ามันไปอยู่ในกลุ่มแท็บแล้วไม่ใช่แท็บที่ active
// พื้นที่เขียนทั้งหมด (#tabs/#panes) จะถูกซ่อน ดูเหมือนโปรแกรมพัง (เจอตอน e2e alpha.56)
let _fixingDocs = false;
function ensureDocsVisible() {
  if (_fixingDocs || !pm || !pm.store.root) return;
  const grp = PL.tabGroupOf(pm.store.root, 'docs');
  if (!grp) return;
  const i = grp.children.findIndex((c) => c.id === 'docs');
  if (i < 0 || grp.active === i) return;
  _fixingDocs = true;
  try { pm.store.update(PL.activatePanel(pm.store.root, 'docs')); } finally { _fixingDocs = false; }
}

// 0.56a #3: วาดต้นไม้ใหม่ = ย้าย #content/#tree ออกจาก DOM แล้วใส่กลับ → ตำแหน่งเลื่อนถูกล้างเป็น 0
// ผู้ใช้เลื่อนหน้ากระดาษอยู่ดี ๆ พอขยับแผงทีก็เด้งกลับซ้ายบนทุกครั้ง
// → จำตำแหน่งเลื่อนของทุกกล่องที่เลื่อนได้ก่อนวาด แล้วคืนหลังวาด (ทั้งทันทีและหลัง layout รอบถัดไป)
// [alpha.60r2 ข้อ 7] รายการเดิมตกกล่องที่เลื่อนได้ไปหลายตัว — ที่เจ็บที่สุดคือ `.sp-pageview`
// (มุมมองเรียงหน้า/ภาพรวม) กับ `#panes` · ขยับ/ปรับขนาดแผงทีเดียวแล้วหน้ากระดาษเด้งกลับหน้าแรก
//
// [alpha.66r2 ข้อ 1] **เลิกใช้ whitelist เป็นตัวหลัก** — มันพังสองทางพร้อมกัน:
//   (1) กล่องที่เลื่อนได้อีกเป็นสิบตัวไม่เคยอยู่ในลิสต์ (#tabs, .k-logview, .branch-viewport,
//       .player-body-box, .floor-panel, .tl-line, #planner-props-body, …) โดยเฉพาะ **แนวนอน**
//   (2) `.k-panel-body` / `.k-tab-content` ถูก **สร้างใหม่ทุกรอบวาด** → คืนค่าลงซากที่หลุด DOM
//       (แผงที่ไม่มีกล่องเลื่อนของตัวเอง — แดชบอร์ด/Kanban/จัดการเล่ม/โน้ต/คอมเมนต์/ค้นหา —
//        เลื่อนอยู่บน `.k-panel-body` พอดี จึงเสียตำแหน่ง 100% ทุกครั้งที่ขยับแผง)
// ตอนนี้สแกน element จริงทั้งหมดใต้ #app-root แล้วจำเป็น "เส้นทางจากแผง" (keepScroll ใน core.js)
// เพื่อไปหา **ใบใหม่ที่ตำแหน่งเดิม** หลังวาดเสร็จ · ลิสต์ด้านล่างเหลือไว้เป็นตาข่ายกันพลาด
// สำหรับกล่องที่อยู่ *นอก* #app-root (กล่องโต้ตอบ/ที่พักเนื้อแผง) และใช้เป็นเอกสารอ้างอิงในเทส
export const SCROLLABLES = [
  '.pane', '#panes', '.sp-pageview', '.roster-wrap',
  '#tree', '#outline', '#props-body',
  '.k-panel-body', '.k-tab-content', '.k-float-body', '.pane-content',
  '.home-dlg-scroll',
].join(', ');

// รากที่ "ยึดได้ข้ามการวาด" — แผงมี data-panel-id ประจำตัว จึงหาใบใหม่เจอเสมอ
const SCROLL_ANCHOR = '.k-float-panel[data-panel-id], .k-panel[data-panel-id]';
function anchorSelector(a) {
  return a.classList.contains('k-float-panel')
    ? `.k-float-panel[data-panel-id="${a.dataset.panelId}"]`
    : `#${HOST_ID} .k-panel[data-panel-id="${a.dataset.panelId}"]`;
}
// [alpha.66r5] ความจำระยะยาวของตำแหน่งเลื่อน — **ต้องรอดข้ามสถานะที่กล่องหายไปจากจอ**
// เคสที่ระบบเดิมยังพลาด: พับแผง (เนื้อเป็น display:none → scrollTop กลายเป็น 0 กู้ไม่ได้แล้ว)
// · ลากแผงออกไปลอย · ปิดแล้วเปิดใหม่ — พอกลับมา ตำแหน่งเลื่อนเป็น 0 เพราะไม่มีใครจำค่าก่อนหน้า
// ตอนนี้จดค่าล่าสุด "ต่อแผง" ไว้เสมอ แล้วเล่นซ้ำให้ตอนแผงกลับมาเห็นอีกครั้งโดยที่ยังไม่มีใครเลื่อน
const scrollMemo = new Map();                        // panelId → snapshot
function memoKey(a) { return a && a.dataset ? (a.dataset.panelId || '') : ''; }

function captureScroll() {
  const h = host();
  if (!h) return [];
  const seen = new Set();
  const jobs = [];
  const take = (e) => {
    if (!e.scrollTop && !e.scrollLeft) return;
    const a = e.closest(SCROLL_ANCHOR);
    const key = a || h;
    if (seen.has(key)) return;                       // แผงเดียวกันเก็บครั้งเดียว (keepScroll กวาดทั้งใบ)
    seen.add(key);
    const sel = a ? anchorSelector(a) : null;
    const job = keepScroll(sel ? () => document.querySelector(sel) : h);
    const k = memoKey(a);
    if (k && job.snap && job.snap.length) scrollMemo.set(k, job.snap);
    jobs.push(job);
  };
  for (const e of h.querySelectorAll('*')) take(e);
  // ตาข่ายกันพลาด: กล่องที่รู้จักแต่ไม่ได้อยู่ใต้ #app-root (เช่นเนื้อแผงที่ปิดอยู่ใน #k-panel-src)
  try {
    for (const e of document.querySelectorAll(SCROLLABLES)) {
      if (h.contains(e) || seen.has(e)) continue;
      if (!e.scrollTop && !e.scrollLeft) continue;
      seen.add(e);
      jobs.push(keepScroll(e));
    }
  } catch {}
  return jobs;
}
/** คืนตำแหน่งเลื่อนหลังวาดแผงใหม่ (ตรรกะการตั้งซ้ำ/ยอมแพ้เมื่อมีคนอื่นเลื่อน อยู่ใน core.keepScroll) */
function restoreScroll(jobs) {
  for (const j of jobs) { try { j(); } catch {} }
  replayScrollMemo();
  // [alpha.120 ข้อ 12] เล่นซ้ำอีกครั้งหลัง layout นิ่ง — ตอนคลี่แผงกลับมา กล่องเพิ่งพ้น
  // display:none มาหมาด ๆ `scrollHeight` ยังเป็น 0 อยู่ เบราว์เซอร์จึงหนีบค่าที่เขียนให้เหลือ 0
  try { requestAnimationFrame(() => replayScrollMemo()); } catch {}
  setTimeout(replayScrollMemo, 60);
}

/**
 * เล่นซ้ำตำแหน่งเลื่อนที่จำไว้ ให้แผงที่ "เพิ่งกลับมาเห็น" (คลี่จากพับ · ผนึกกลับจากลอย · เปิดใหม่)
 * เงื่อนไขสำคัญ: ทำเฉพาะกล่องที่ตอนนี้ยังอยู่ที่ 0 — ถ้ามีค่าอยู่แล้วแปลว่าไม่ได้หาย ไม่ต้องยุ่ง
 */
function replayScrollMemo() {
  if (!scrollMemo.size) return;
  for (const [pid, snap] of scrollMemo) {
    const sel = `#${HOST_ID} .k-panel[data-panel-id="${pid}"], .k-float-panel[data-panel-id="${pid}"]`;
    const el2 = document.querySelector(sel);
    if (!el2 || !el2.getBoundingClientRect().width) continue;      // ยังไม่เห็น (ปิด/พับ/แท็บอื่น)
    if (el2.classList.contains('k-collapsed')) continue;           // พับอยู่ — คืนค่าตอนนี้ได้แค่ 0
    const target = elByPath(el2, snap[0] ? snap[0].path : null) || null;
    // [alpha.120 ข้อ 12] กล่องที่ยัง "ไม่มีความสูงให้เลื่อน" ยังคืนค่าไม่ได้ ต้องรอรอบถัดไป
    // (เดิมปล่อยผ่านแล้วถือว่าเสร็จ → คลี่แผงกลับมาได้ 0 ทุกครั้ง)
    if (target && (target.scrollTop || target.scrollLeft)) continue;   // ยังอยู่ดี ไม่ต้องแตะ
    try { restoreScrollSnap(() => document.querySelector(sel), snap)(); } catch {}
  }
}
/** ล้างความจำตำแหน่งเลื่อน (เปลี่ยนโปรเจกต์ = เนื้อคนละชุดแล้ว) */
export function resetScrollMemo() { scrollMemo.clear(); }

// ───────── [alpha.120 ข้อ 12] จำตำแหน่งเลื่อน "ตอนผู้ใช้เลื่อน" ไม่ใช่ตอนวาดแผง ─────────
//
// ★ ต้นตอที่ผู้ใช้เจอ (พับแผงโปรเจกต์แล้วคลี่กลับ → ต้นไม้เด้งกลับบนสุด):
//   ความจำเดิมถูกเก็บ **เฉพาะตอน renderPanels()** เท่านั้น และตอนพับ CSS สั่ง
//   `.k-collapsed #tree { display:none }` — กล่องที่ไม่มีกล่องเรนเดอร์จะรายงาน `scrollTop = 0`
//   เสมอ · ลำดับที่ทำให้ค่าหาย: พับ (จดได้ถูก) → มีอะไรก็ตามสั่งวาดแผงใหม่ระหว่างที่ยังพับอยู่
//   (สลับแท็บ · เปิด/ปิดแผงอื่น · ลากขอบ) → `captureScroll()` รอบนั้นอ่าน 0 จากทุกกล่อง
//   → ไม่ตรงเงื่อนไข `if (!e.scrollTop && !e.scrollLeft) return` เลยไม่ทับของเดิมก็จริง
//   **แต่ `restoreScroll()` ที่ตามมาเขียน 0 ทับลงกล่องที่ซ่อนอยู่** แล้วรอบวาดถัดไปก็ไม่มีใครจดใหม่
//   สุดท้ายตอนคลี่กลับจึงไม่มีค่าที่ถูกต้องเหลืออยู่
// ทางแก้: ดักอีเวนต์ `scroll` จริง ๆ (แบบ capture — scroll ไม่ bubble) แล้วจดทันทีที่ผู้ใช้เลื่อน
// ค่าที่จดจึงเป็น "ตำแหน่งล่าสุดที่มองเห็นจริง" เสมอ ไม่ขึ้นกับจังหวะวาดแผงอีกต่อไป
let _scrollWatch = false;
function watchScrollMemo() {
  if (_scrollWatch) return false;
  const h = host();
  if (!h) return false;
  _scrollWatch = true;
  let job = null;
  h.addEventListener('scroll', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const a = t.closest(SCROLL_ANCHOR);
    if (!a) return;
    const k = memoKey(a);
    if (!k) return;
    // รวบเป็นเฟรมเดียว — อีเวนต์ scroll ยิงถี่มากระหว่างลากแถบเลื่อน
    clearTimeout(job);
    job = setTimeout(() => {
      if (!a.isConnected) return;
      const snap = scrollSnapshot(a);
      if (snap.length) scrollMemo.set(k, snap);
    }, 90);
  }, true);
  return true;
}

// ───────── [alpha.66r5] ตาข่ายกัน "ช่องว่างค้าง" + ตัววินิจฉัย ─────────
// ผู้ใช้เจอช่องว่างฝั่งขวาหลังลากปรับขนาด แต่ **ทำซ้ำในเครื่องเทสไม่ได้** จึงยังไม่ฟันธงต้นตอ
// ตรงนี้ทำสองอย่าง: (1) ปิดรูให้ทันทีโดยยกส่วนที่เหลือให้ลูกที่ยืดได้ตัวสุดท้าย
// (2) log โครงสร้างของ dock ที่เกิดปัญหาไว้ครบ (id · ทิศ · ลูกทุกตัวพร้อม flex/ขนาด)
// → ถ้าเจออีก เปิดแผง "บันทึก" แล้วส่ง log ช่วงนั้นมา จะรู้ทันทีว่าใครไม่ยอมยืด
const GAP_TOL = 4;
let _gapLogged = new Set();
export function auditPanelGaps(opts = {}) {
  const h = host();
  if (!h) return [];
  const found = [];
  for (const dockEl of h.querySelectorAll('.k-dock[data-dock-id]')) {
    const row = dockEl.dataset.dir === 'row';
    const kids = [...dockEl.children];
    if (!kids.length) continue;
    const total = row ? dockEl.clientWidth : dockEl.clientHeight;
    if (!total) continue;
    // [alpha.146] ★ ต้องนับ `margin` ของลูกด้วย — `getBoundingClientRect()` ไม่รวมมัน
    // ตั้งแต่เปลือกเป็นการ์ด แผงที่ปรับขนาดไม่ได้ (แถบเครื่องมือ/แถบสถานะ) เว้นระยะจาก
    // เพื่อนบ้านด้วย margin `--shell-gap` → ถ้าไม่นับ ตัวตรวจจะเห็นเป็น "ช่องว่างค้าง" 10px
    // ทุก dock แนวตั้ง แล้ว **ลงมือยืดแผงกลางเพื่อปิดรูที่ตั้งใจให้มี** (ดูขั้นตอน (1) ข้างล่าง)
    // = สัดส่วนที่ผู้ใช้ลากไว้ถูกเขียนทับทุกครั้งที่เปิด/ปิดแผง + log ท่วม
    // (margin ติดลบก็บวกตามจริง — พื้นที่ที่ "มีเจ้าของ" คือกล่องบวก margin ของมันเสมอ)
    const used = kids.reduce((a, e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const mg = row ? (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)
                     : (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      return a + (row ? r.width : r.height) + mg;
    }, 0);
    const gap = total - used;
    if (gap <= GAP_TOL) continue;
    found.push({ dock: dockEl.dataset.dockId, dir: dockEl.dataset.dir, gap: Math.round(gap), total: Math.round(total) });
    // (1) ปิดรู: ลูกที่ยืดได้ตัวสุดท้ายรับส่วนที่เหลือไป
    const growable = kids.filter((e) => !e.classList.contains('k-resize-handle')
                                     && getComputedStyle(e).display !== 'none'
                                     && !e.classList.contains('k-panel-fixed')
                                     && !e.classList.contains('k-collapsed'));
    const taker = growable.find((e) => e.classList.contains('k-flex-child')) || growable[growable.length - 1];
    if (taker) { taker.style.flexGrow = '1'; taker.style.flexBasis = '0%'; taker.style.flexShrink = '1'; }
    // (2) จดไว้ครั้งเดียวต่อ dock ต่อรอบโปรแกรม — กัน log ท่วมตอนลาก
    const key = dockEl.dataset.dockId + ':' + Math.round(gap / 10);
    if (!_gapLogged.has(key) || opts.force) {
      _gapLogged.add(key);
      const detail = kids.map((e) => ({
        id: e.dataset.panelId || e.dataset.dockId || e.dataset.tabsId || e.className,
        cls: e.className,
        flex: e.style.flex || `${e.style.flexGrow}/${e.style.flexShrink}/${e.style.flexBasis}`,
        size: Math.round(row ? e.getBoundingClientRect().width : e.getBoundingClientRect().height),
      }));
      log('warn', tf('ui.panel.panelFoundFieldEmpty', Math.round(gap), dockEl.dataset.dockId, dockEl.dataset.dir), detail);
    }
  }
  return found;
}

// [alpha.66r7 บั๊ก 1] แผงเปล่าที่มีชื่อเป็น id ของ dock (เช่น `dmso3uwd41`) โผล่หลัง undock
// ต้นตอยังหาไม่เจอ (เอนจินล้วนทดสอบ 8 เส้นทางแล้วไม่เกิด → เกิดที่ชั้น UI) แต่ตรวจจับง่ายมาก:
// **โหนดชนิด panel ที่ไม่มีในทะเบียนแผง = ของปลอมเสมอ** → กวาดทิ้งทันทีแล้วจด log ไว้ให้ไล่ต่อ
function pruneGhostPanels() {
  if (!pm || !pm.root) return false;
  const ghosts = PL.panelIds(pm.root).filter((id) => !pm.registry.has(id));
  if (!ghosts.length) return false;
  let r = pm.root;
  for (const id of ghosts) r = PL.removePanel(r, id);
  pm.store.root = r;                       // ไม่ผ่าน update() — เรากำลังจะวาดอยู่แล้ว
  pm.store.save();
  log('warn', t('ui.panel.panelFoundPanelNot'), ghosts);
  return true;
}

export function renderPanels(force) {
  if (!pm) return;
  pruneGhostPanels();
  ensureDocsVisible();
  const sig = JSON.stringify({ r: pm.store.root, f: pm.store.floats });
  if (!force && sig === lastSig) return;
  lastSig = sig;
  const saved = captureScroll();
  renderPanelLayout(host(), pm, renderOpts());
  trackClosedPanels();                  // [alpha.161 · U4] จด "แผงที่เพิ่งปิด" แล้ววาดชิปทางกลับ
  renderHiddenChips();
  watchScrollMemo();                    // [alpha.120 ข้อ 12] ผูกตัวจดตำแหน่งเลื่อน (ครั้งเดียว)
  restoreScroll(saved);
  // ตรวจ "ช่องว่างค้าง" หลัง layout เสร็จจริง (rAF) แล้วปิดรูให้ทันทีถ้าเจอ
  try { requestAnimationFrame(() => auditPanelGaps()); } catch {}
  // เนื้อแผงที่ไม่ได้ถูกวาง → เก็บกลับที่พัก (ต้องอยู่ใน DOM เสมอ ไม่งั้น $('#props-body') คืน null)
  const h = host(), holder = srcHolder();
  for (const [, node] of adopted) if (!h.contains(node)) holder.appendChild(node);
  scheduleRemember();                  // [ข้อ 8] จดตำแหน่ง+สัดส่วนล่าสุดของแผงที่เปิดอยู่
  if (_onLayoutChange) _onLayoutChange();
}

// ───────── [alpha.161 · U4] ★ ทางกลับของแผงที่ปิด/ซ่อน/ฉีก — ชิปเล็กมุมล่างขวาของพื้นที่เขียน ─────────
// เดิมปิดแผงแล้วทางเดียวที่จะเอาคืนคือไปไล่หาในเมนู มุมมอง → แผง (หรือจำคีย์ลัด) · แผงที่ถูกซ่อนทีละฝั่ง
// หรือฉีกไปหน้าต่างอื่นก็ไม่มีอะไรบนจอบอกว่ามันยังอยู่ · ชิปไม่ใช่ปุ่มของแถบเครื่องมือ (กฎ alpha.137)
// "เพิ่งปิด" = เคยเปิดอยู่ในรอบวาดก่อนแล้วหายไป (ไม่นับที่ถูกซ่อนด้วยที่พัก — ชุดนั้นมีชิปของมันเอง)
const HIDDEN_CHIPS_MAX = 6;
const _recentClosed = [];               // id ล่าสุดอยู่หน้า
let _lastOpen = null;
function stashedIds() {
  const s = new Set();
  for (const k of SIDES_ALL) for (const id of _sideStash[k] || []) s.add(id);
  return s;
}
function trackClosedPanels() {
  const m = getPanelManager();
  const openNow = new Set(PANEL_DEFS.filter((d) => d.closable !== false && m.isOpen(d.id)).map((d) => d.id));
  const stash = stashedIds();
  // [alpha.165] ผู้ใช้: "log ต้องบอกว่าเปิดตัวไหน" — ตรงนี้เห็นทุกทางที่แผงเปิด/ปิด (ปุ่ม · เมนู · คีย์ลัด · เวิร์กสเปซ · AI)
  //   รอบวาดแรกหลังบูตไม่จด (ไม่ใช่การกระทำ แค่กู้เลย์เอาต์)
  if (_lastOpen) {
    for (const id of openNow) if (!_lastOpen.has(id)) log('info', 'panel: open ' + id);
    for (const id of _lastOpen) if (!openNow.has(id)) log('info', 'panel: close ' + id + (tornOff.has(id) ? ' (tear-off)' : stash.has(id) ? ' (hidden side)' : ''));
  }
  if (_lastOpen) {
    for (const id of _lastOpen) {
      if (openNow.has(id) || stash.has(id) || tornOff.has(id)) continue;
      const i = _recentClosed.indexOf(id);
      if (i >= 0) _recentClosed.splice(i, 1);
      _recentClosed.unshift(id);
    }
  }
  for (let i = _recentClosed.length - 1; i >= 0; i--) if (openNow.has(_recentClosed[i])) _recentClosed.splice(i, 1);
  if (_recentClosed.length > HIDDEN_CHIPS_MAX) _recentClosed.length = HIDDEN_CHIPS_MAX;
  _lastOpen = openNow;
}
/** รายการชิป (ลำดับ: ฉีกไปหน้าต่างอื่น → ซ่อนไว้ชั่วคราว → เพิ่งปิด) — {id, kind:'torn'|'stash'|'closed'} */
export function hiddenPanelChips() {
  const out = [], seen = new Set();
  const push = (id, kind) => { if (!seen.has(id) && PANEL_DEFS.some((d) => d.id === id)) { seen.add(id); out.push({ id, kind }); } };
  for (const id of tornOff) push(id, 'torn');
  for (const id of stashedIds()) push(id, 'stash');
  for (const id of _recentClosed) push(id, 'closed');
  return out.slice(0, HIDDEN_CHIPS_MAX + 4);
}
/** คืนแผงจากชิป — ฉีก = เรียกกลับจากหน้าต่างแยก · ซ่อนไว้ = คืนทั้งชุดของที่พักนั้น · ปิด = เปิดที่เดิม */
export function restoreHiddenPanel(id) {
  const pid = panelId(id);
  if (tornOff.has(pid)) { recallPanel(pid); return true; }
  for (const k of SIDES_ALL) {
    if ((_sideStash[k] || []).includes(pid)) { if (k === 'all') toggleSpace('all'); else toggleSide(k); return true; }
  }
  const i = _recentClosed.indexOf(pid);
  if (i >= 0) _recentClosed.splice(i, 1);
  showPanel(pid);
  renderPanels(true);
  if (onShowHook) { try { onShowHook(pid); } catch {} }
  return true;
}
// [alpha.165] ★ ผู้ใช้สั่งเอาออก (ซ้ำรอบสอง — alpha.50 เคยเลิก chip มุมจอไปแล้ว แล้ว .161 นำกลับมาเอง)
//   "ปิด panel แล้วมีแถบเล็ก ๆ มุมขวาล่าง บอกแล้วให้เอาออก" · ทางกลับของแผงคือปุ่มบนแถบ · เมนู มุมมอง → แผง · คีย์ลัด
//   ห้ามวาดอะไรลอยทับพื้นที่เขียนเพื่อบอกแผงที่ปิดอีก · ตัวรายการ (hiddenPanelChips) ยังอยู่ให้เมนู/เทสอ่าน
const HIDDEN_CHIPS_ON = false;
function renderHiddenChips() {
  const h = host();
  if (!HIDDEN_CHIPS_ON) { document.querySelectorAll('.k-hidden-chips').forEach((n) => n.remove()); return; }
  if (!h || PANEL_WIN) return;
  // วางใน #content (พื้นที่เขียน · position:relative อยู่แล้ว) — ลอยมุมล่างขวา ไม่กินความสูงของเอกสาร
  const docs = document.getElementById('content');
  document.querySelectorAll('.k-hidden-chips').forEach((n) => { if (n.parentNode !== docs) n.remove(); });
  if (!docs) return;
  let bar = docs.querySelector(':scope > .k-hidden-chips');
  const chips = hiddenPanelChips();
  if (!chips.length) { if (bar) bar.remove(); return; }
  if (!bar) { bar = el('div', 'k-hidden-chips'); docs.appendChild(bar); }
  bar.replaceChildren();
  bar.title = t('ui.panel.hiddenChipsHint');
  for (const c of chips) {
    const d = PANEL_DEFS.find((x) => x.id === c.id);
    const b = el('button', 'k-hidden-chip k-hidden-' + c.kind);
    b.type = 'button';
    b.dataset.panelId = c.id;
    b.dataset.kind = c.kind;
    // ไอคอนเป็น node + ชื่อเป็น text node (กฎข้อ 11 · ไม่ผ่าน innerHTML)
    const ic = d ? panelIcon(d) : "";
    if (ic) b.append(icon(ic, 13));
    b.append(document.createTextNode(d ? titleOf(d) : c.id));
    b.title = tf(c.kind === 'torn' ? 'ui.panel.chipTorn' : c.kind === 'stash' ? 'ui.panel.chipStash' : 'ui.panel.chipClosed',
                 d ? titleOf(d) : c.id);
    b.dataset.tip = 'ui.panelTip.hiddenChip';
    b.onclick = (e) => { e.stopPropagation(); restoreHiddenPanel(c.id); };
    bar.append(b);
  }
  dodgeHiddenChips(bar);            // วัดทันที (getBoundingClientRect บังคับ layout เอง · rAF หยุดตอนหน้าต่างถูกบัง)
}

/**
 * ชิปอยู่มุมล่างขวาของพื้นที่เขียน — ที่เดียวกับแถบจัดรูปแบบลอย (ค่าเริ่มต้น) และปุ่ม FAB
 * เดิมวาดทับทั้งสองอย่างจนกดปุ่มจัดรูปแบบแถวล่างไม่ได้ · ตอนนี้ซ้อนกันเมื่อไหร่ = ยกแถวชิปขึ้นเหนือสิ่งที่ขวาง
 */
export function dodgeHiddenChips(bar = document.querySelector('#content > .k-hidden-chips')) {
  if (!bar || !bar.isConnected) return 0;
  bar.style.bottom = '';
  const docs = bar.parentElement.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const blockers = [...document.querySelectorAll('#content .k-fmtbar:not(.planner-fmtbar), #k-fab')]
    .filter((n) => n.offsetParent !== null || getComputedStyle(n).position === 'fixed')
    .map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  let lift = 0;
  for (let i = 0; i < 3; i++) {                     // ยกแล้วอาจไปชนอีกตัว — วนไม่เกินจำนวนสิ่งกีดขวาง
    const r = bar.getBoundingClientRect();
    const b = blockers.filter((x) => hit(r, x));
    if (!b.length) break;
    lift = Math.max(lift, docs.bottom - Math.min(...b.map((x) => x.top)) + 6);
    bar.style.bottom = lift + 'px';
  }
  return lift;
}

// [alpha.60r2 ข้อ 8] เดิมจดตำแหน่งเดิมของแผง ("home") เฉพาะตอน "ปิดแผง"
// → ย้าย/ปรับขนาดแผงแล้วปิดโปรแกรม รอบหน้าได้ตำแหน่งเก่าที่ค้างจากการปิดครั้งก่อนโน้น
// ตอนนี้จดหลังวาดทุกครั้ง (หน่วงไว้กันจดถี่ระหว่างลาก) — ทั้ง home และสัดส่วนใน dock
let _rememberJob = null;
function scheduleRemember() {
  clearTimeout(_rememberJob);
  _rememberJob = setTimeout(rememberOpenPanels, 250);
}
function rememberOpenPanels() {
  if (!pm) return;
  let dirty = false;
  for (const d of PANEL_DEFS) {
    if (d.closable === false) continue;
    if (!pm.isOpen(d.id)) continue;
    try {
      rememberHome(d.id);                                     // ตำแหน่ง/เพื่อนบ้าน/กล่องลอย
      if (pm.rememberRatio(d.id, currentRatio(d.id))) dirty = true;   // สัดส่วนใน dock แม่
    } catch {}
  }
  return dirty;
}

// alpha.50: เลิก chip ▣ มุมจอ → ปุ่ม .tb-toggle บน toolbar แทน
// hook นี้ให้ app.js สั่ง refreshToolbar() ทุกครั้งที่เลย์เอาต์แผงเปลี่ยน (ปุ่มจะได้ sync เอง)
let _onLayoutChange = null;
export function onPanelLayoutChange(fn) { _onLayoutChange = fn; }

// ───────── ถาดแผงที่ปิดไว้ — ปิดแผงแล้วต้อง "เห็นทางกลับ" เสมอ (บทเรียนข้อ 20) ─────────
// บั๊ก #17: มีถาดเดียวปักซ้ายตายตัว → ปิดแผงฝั่งขวา (คุณสมบัติ) แล้ว chip ไปโผล่มุมซ้ายล่าง
// ตอนนี้แยกซ้าย/ขวา แล้วเลือกถาดจาก "ฝั่งที่แผงอยู่ตอนถูกปิดจริง" (ไม่ใช่ defaultSide อย่างเดียว)
const lastSide = new Map();                    // id → 'left' | 'right' (จำจากตำแหน่งจริงบนจอ)

/** จดฝั่งของแผงที่ยังเปิดอยู่ — เรียกทุกครั้งหลังวาด ก่อนที่แผงจะถูกปิดแล้วหาตำแหน่งไม่ได้ */
function rememberSides() {
  const h = host();
  const hr = h.getBoundingClientRect();
  if (!hr.width) return;
  for (const d of PANEL_DEFS) {
    if (d.closable === false) continue;
    const node = h.querySelector(`.k-panel[data-panel-id="${d.id}"]`)
      || document.querySelector(`.k-float-panel[data-panel-id="${d.id}"]`);
    if (!node) continue;
    const r = node.getBoundingClientRect();
    if (!r.width) continue;                    // ซ่อนอยู่หลังแท็บอื่น → เก็บค่าเดิมไว้
    lastSide.set(d.id, r.left + r.width / 2 < hr.left + hr.width / 2 ? 'left' : 'right');
  }
}
function sideOf(d) { return lastSide.get(d.id) || d.defaultSide || 'left'; }
/**
 * [alpha.159 · M17] ฝั่งของแผงนี้ "ตอนนี้" — วัดจากจอจริงก่อน (รวมแผงที่ปิดไม่ได้ ซึ่ง rememberSides ข้าม)
 * วัดไม่ได้ (ซ่อนหลังแท็บอื่น) = ฝั่งที่จำไว้ล่าสุด → ค่าเริ่มต้นของแผง
 */
export function sideNow(id) {
  rememberSides();
  const h = host();
  const hr = h && h.getBoundingClientRect();
  const node = h && (h.querySelector(`.k-panel[data-panel-id="${id}"]`)
    || document.querySelector(`.k-float-panel[data-panel-id="${id}"]`));
  if (node && hr && hr.width) {
    const r = node.getBoundingClientRect();
    if (r.width) return r.left + r.width / 2 < hr.left + hr.width / 2 ? 'left' : 'right';
  }
  const def = PANEL_DEFS.find((d) => d.id === id) || { id, defaultSide: 'left' };
  return sideOf(def);
}

// [alpha.124 ข้อ 39] ★ ถาดแผงที่ย่อไว้ (`#k-min-tray-*`) ถูกลบทิ้งแล้ว
//
// รายงานบั๊กเข้ามาว่า "ปุ่มลอย (FAB) ทับชิปกู้คืนแผงฝั่งขวา จนกดไม่โดน" — พอไล่ดูจริง ๆ
// พบว่า **ชิปพวกนั้นไม่เคยถูกวาดเลยตั้งแต่ alpha.50**: `syncMinTray()` ไม่มีใครเรียกอีกแล้ว
// (ทางกลับที่ผู้ใช้เห็นจริงคือ เมนู มุมมอง → แผง · ปุ่มบนแถบเครื่องมือ · และคีย์ลัด Ctrl+Alt+ตัวอักษร)
// เก็บโค้ดตายไว้ = คนอ่านโค้ดเชื่อว่าถาดมีอยู่จริงแล้วไปแก้ z-index ให้มันเปล่า ๆ (ซึ่งเกิดขึ้นแล้ว)
// `rememberSides()` / `sideOf()` ยังอยู่ — คำสั่ง "ซ่อนแผงฝั่งนี้" ใช้อยู่จริง

// ───────── เริ่มระบบ ─────────
export function initPanelSystem(opts = {}) {
  const m = getPanelManager();
  if (started) {
    // [alpha.154 ข้อ 1] เปิดโปรเจกต์แล้วเซสชันกู้เลย์เอาต์ลง localStorage → โหลดเข้าหน่วยความจำจริง
    if (opts.reload) {
      homes.clear(); loadHomes();
      if (m.load() && m.store.root && !PL.hasPanel(m.store.root, 'docs')) {
        const anchor = PL.panelIds(m.store.root)[0];
        m.store.update(PL.dockPanel(m.store.root, anchor, 'right', PL.panel('docs', t('ui.panel.doc'))));
      }
      lastSig = '';
    }
    renderPanels(true); return m;
  }
  started = true;
  registerPanels();
  srcHolder();
  loadHomes();                                  // บั๊ก #4: ตำแหน่งเดิมของแผงที่ปิดไว้ (ข้ามการเปิด-ปิดโปรแกรม)
  m.load();                                     // กู้เลย์เอาต์ + ตัดแผงที่ไม่รู้จักทิ้ง
  // บั๊ก #19: เดิม "ไม่มี docs" → ล้างทั้งต้นไม้เป็นค่าตั้งต้น = แผงที่ผู้ใช้ปิดไว้โผล่กลับมาทั้งชุด
  // ตอนนี้เสียบแผงเอกสารคืนเข้าเลย์เอาต์เดิมแทน · รีเซ็ตจริงเฉพาะตอนไม่มีเลย์เอาต์เลย (เปิดครั้งแรก)
  if (!m.store.root) m.store.update(defaultLayout());
  else if (!PL.hasPanel(m.store.root, 'docs')) {
    const anchor = PL.panelIds(m.store.root)[0];
    m.store.update(PL.dockPanel(m.store.root, anchor, 'right', PL.panel('docs', t('ui.panel.doc'))));
  }
  m.store.onChange(() => { savePanelLayout(); renderPanels(); });
  // [alpha.154 ข้อ 1] ★ ก่อนโครงเปลี่ยนทุกครั้ง (เปิด/ปิด/ย้าย/ลอย/ผนึก) ตรึงขนาดที่ผู้ใช้เห็นอยู่
  // ให้แผงที่ยังไม่มีขนาดของตัวเอง — ไม่งั้นมันเป็น "ส่วนแบ่งของที่ว่าง" แล้วหด/ขยายตามแผงอื่น
  // (ตรรกะตัดสินอยู่ที่ PL.pinDockSizes · ที่นี่ทำแค่วัด DOM)
  m.store.beforeUpdate = (next) => PL.pinDockSizes(next, measureDockedNodes(), (id) => !!(meta.get(id) || {}).fixed);
  onLanguageChanged(() => renderPanels(true));  // เปลี่ยนภาษา → ชื่อแผงเปลี่ยนตาม
  bindTearOffSync();                            // [alpha.67] ปิดหน้าต่างแผง → เอาแผงกลับที่เดิม
  renderPanels(true);
  return m;
}

/**
 * [alpha.154 ข้อ 1] ขนาดบนจอของทุกโหนดที่ผนึกอยู่ (dock · กลุ่มแท็บ · แผง) → { id: {w,h} }
 * เฉพาะ `.k-panel`/`.k-dock`/`.k-tab-group` — หัวแท็บ (`.k-tab`) ก็มี data-panel-id แต่เป็นขนาดของปุ่ม
 * โหนดที่ไม่มีขนาด (ซ่อนหลังแท็บ · ยังไม่วาด · หน้าต่างย่อ) ไม่ถูกเก็บ = ไม่ถูกตรึง
 */
function measureDockedNodes() {
  const out = {};
  const h = document.getElementById(HOST_ID);
  if (!h) return out;
  for (const e of h.querySelectorAll('.k-panel[data-panel-id], .k-panel[data-tabs-id], .k-dock[data-dock-id], .k-tab-group[data-tabs-id]')) {
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    for (const id of [e.dataset.panelId, e.dataset.dockId, e.dataset.tabsId]) {
      if (id && !out[id]) out[id] = { w: r.width, h: r.height };
    }
  }
  return out;
}

// ───────── คำสั่งที่ app.js/เมนูเรียก ─────────
export function isPanelOpen(id) { return !!pm && pm.isOpen(panelId(id)); }

// บั๊ก #18: แผงฟีเจอร์ (แดชบอร์ด/Kanban/…) ต้องวาดเนื้อหาทุกครั้งที่ถูกเปิด
// app.js ฝากฟังก์ชันวาดไว้ที่นี่ → ครอบคลุมทุกทางเข้า (เมนู · ถาดแผงที่ปิดไว้ · คำสั่ง)
let onShowHook = null;
export function setPanelShowHook(fn) { onShowHook = fn; }

// บั๊ก #4: ปิดแผงแล้วเปิดกลับต้องได้ "ที่เดิม" — จำบริบทตอนปิด (ผนึกข้างไหนของแผงไหน / ลอยอยู่ที่พิกัดใด)
// เก็บลง localStorage ด้วย เพื่อให้ข้ามการเปิด-ปิดโปรแกรมได้เหมือน layout tree
const HOME_KEY = 'k2-panel-home';
const homes = new Map();                       // id → {side,targetId} | {float:{x,y,w,h}}
function loadHomes() {
  try {
    const o = JSON.parse(localStorage.getItem(HOME_KEY) || '{}');
    for (const k of Object.keys(o)) homes.set(k, o[k]);
  } catch {}
}
function saveHomes() {
  try {
    const str = JSON.stringify(Object.fromEntries(homes));
    const prev = localStorage.getItem(HOME_KEY);
    localStorage.setItem(HOME_KEY, str);
    // [alpha.154 ข้อ 1] ให้ด่านกู้เซสชันรู้ว่าใหม่กว่า — เฉพาะตอนเปลี่ยนจริง (ตัวนี้ถูกเรียกหลังวาดทุกครั้ง)
    if (prev !== str) localStorage.setItem('k2-ls-ts', String(Date.now()));
  } catch {}
}
/** จดตำแหน่งปัจจุบันของแผงไว้ก่อนปิด */
function rememberHome(pid) {
  const m = getPanelManager();
  const f = (m.floats || []).find((x) => x.panel.id === pid);
  if (f) { homes.set(pid, { float: { x: f.x, y: f.y, w: f.w, h: f.h } }); saveHomes(); return; }
  // [alpha.66r11 บั๊ก B] **แผงที่อยู่ใน "กลุ่มลอย" ไม่เคยถูกจดที่อยู่เลย**
  // (ตัวค้นด้านบนหาจาก `f.panel.id` ซึ่งเป็น id ของกลุ่ม ไม่ใช่ของแผง แล้วก็ตกไป `!isDocked` → return)
  // ผลคือปิดแล้วเปิดใหม่ ไปโผล่กลางจอเป็นแผงลอยเดี่ยว ไม่กลับเข้ากลุ่มเดิม
  // จดสองอย่างตามที่ผู้ใช้กำหนด: (1) เพื่อนร่วมกลุ่ม = ตัวชี้ว่า "กลุ่มไหน" (id ของกลุ่มเปลี่ยนทุกครั้งที่สร้างใหม่)
  //                              (2) กล่องล่าสุดของกลุ่ม — ไว้ใช้เมื่อกลุ่มนั้นไม่เหลือแล้ว
  const gf = (m.floats || []).find((x) => x.panel.type === 'tabs'
    && (x.panel.children || []).some((c) => c.id === pid));
  if (gf) {
    homes.set(pid, { floatWith: gf.panel.children.filter((c) => c.id !== pid).map((c) => c.id),
                     float: { x: gf.x, y: gf.y, w: gf.w, h: gf.h } });
    saveHomes(); return;
  }
  if (!m.isDocked(pid)) return;
  // อยู่ในกลุ่มแท็บ → จำว่า "เป็นแท็บร่วมกับใคร" เพื่อกลับเข้ากลุ่มเดิม ไม่ใช่แยกออกมาเป็นช่องใหม่
  const grp = PL.tabGroupOf(m.root, pid);
  if (grp && (grp.children || []).length > 1) {
    const other = grp.children.find((c) => c.id !== pid);
    if (other) { homes.set(pid, { targetId: other.id, side: 'center' }); saveHomes(); return; }
  }
  // แถบเครื่องมือ/แถบสถานะกินเต็มความกว้าง → ใช้เป็นจุดอ้างอิงไม่ได้ (ตัดออกก่อน)
  const sib = PL.panelIds(m.root).filter((x) => x !== pid && !(meta.get(x) || {}).fixed);
  const node = document.querySelector(`#${HOST_ID} .k-panel[data-panel-id="${pid}"]`);
  const r = node && node.getBoundingClientRect();
  // เพื่อนบ้านที่ใกล้ที่สุด = จุดยึดตอนเรียกกลับ
  let best = null;
  if (r && r.width) {
    for (const s of sib) {
      const n2 = document.querySelector(`#${HOST_ID} .k-panel[data-panel-id="${s}"]`);
      const r2 = n2 && n2.getBoundingClientRect();
      if (!r2 || !r2.width) continue;
      const d = Math.hypot(r2.left - r.left, r2.top - r.top);
      if (!best || d < best.d) best = { d, id: s, side: sideBetween(r, r2) };
    }
  }
  homes.set(pid, { targetId: best ? best.id : 'docs', side: best ? best.side : sideOf({ id: pid }),
                   ratio: currentRatio(pid) });
  saveHomes();
}

/**
 * [alpha.62 บั๊ก 13] แผงเราอยู่ "ฝั่งไหน" ของเพื่อนบ้าน — ต้องตอบได้ทั้ง 4 ทิศ
 *
 * ของเดิมเขียนไว้ว่า `r2.left < r.left ? 'right' : 'left'` = **คิดแค่แกนนอน**
 * แผงที่ผู้ใช้ผนึกไว้ **แนวตั้ง** (บน/ล่างของกัน — dock dir='col') มี left เท่ากันเป๊ะ
 * → ตกเข้าเงื่อนไข else ได้ 'left' เสมอ · ปิดแล้วเปิดกลับ แผงจึงเด้งไปอยู่ "ซ้ายของเพื่อนบ้าน"
 * แทนที่จะกลับไปอยู่ข้างบน/ข้างล่างเหมือนเดิม (ตำแหน่งหาย + สัดส่วนเลยเพี้ยนตาม)
 * ตอนนี้เทียบว่าจุดศูนย์กลางห่างกันทางไหนมากกว่า แล้วค่อยเลือกแกน
 */
function sideBetween(r, r2) {
  const dx = (r.left + r.width / 2) - (r2.left + r2.width / 2);
  const dy = (r.top + r.height / 2) - (r2.top + r2.height / 2);
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 'bottom' : 'top';   // เราอยู่ล่าง/บนของเขา
  return dx > 0 ? 'right' : 'left';                                     // เราอยู่ขวา/ซ้ายของเขา
}

// ───────── [alpha.60r1 · ข้อ 22] จำ "สัดส่วน" ของแผง ไม่ใช่แค่ตำแหน่ง ─────────
// เลย์เอาต์ที่ผนึกอยู่เก็บ sizes ไว้ในต้นไม้แล้ว (serializeLayout เก็บทั้ง root)
// แต่แผงที่ "ปิดแล้วเปิดใหม่" จะถูกยัดกลับเข้า dock ด้วยสัดส่วนเฉลี่ยเสมอ
// → ผู้ใช้ที่ย่อแผงโปรเจกต์ให้แคบไว้ ต้องมาลากใหม่ทุกครั้งที่ปิด-เปิด

/**
 * สัดส่วนของแผงเทียบพี่น้องใน dock เดียวกัน (0 = หาไม่ได้)
 *
 * [alpha.62 บั๊ก 12] **ต้องอ่านจาก layout tree ไม่ใช่วัดจาก DOM**
 * ของเดิมวัด `node.width / dock.width` ซึ่งรวม **ที่จับปรับขนาด** (`.k-resize-handle`) ที่คั่นอยู่
 * ไว้ในตัวหารด้วย → ค่าที่วัดได้เตี้ยกว่าสัดส่วนจริงในต้นไม้เสมอ (เช่น .200 → .196)
 * แล้ว `rememberOpenPanels()` ก็เอาค่าเตี้ยนั้นไปทับของเดิมทุก 250ms หลังวาด
 * ปิด-เปิดแผงทีหนึ่ง `applyRatio` จึงหดลงอีกนิด — **ทุกครั้ง สะสมไปเรื่อย ๆ**
 * ผลที่ผู้ใช้เห็น: "แผงไม่ถูกล็อก กดเปิดปิดทีไรขนาดขยับตลอด"
 * ต้นไม้เป็นแหล่งความจริง (คนลากที่จับ commit ลงต้นไม้อยู่แล้วผ่าน `pm.resize`)
 * → อ่านจากต้นไม้ = ค่าคงที่เป๊ะ ไม่ดริฟต์ · ถอยไปวัด DOM เฉพาะตอนหาในต้นไม้ไม่เจอ
 */
function treeRatio(pid) {
  const m = getPanelManager();
  if (!m.root) return 0;
  let hit = null;
  PL.walk(m.root, (n) => {
    if (hit || n.type !== 'dock') return;
    const i = (n.children || []).findIndex((c) => c.type === 'panel' && c.id === pid);
    if (i >= 0 && n.children.length > 1) hit = { node: n, index: i };
  });
  if (!hit) return 0;
  const { node, index } = hit;
  const n = node.children.length;
  const sizes = PL.normalizeSizes(
    node.sizes && node.sizes.length === n ? node.sizes : new Array(n).fill(1 / n));
  const v = sizes[index];
  return Number.isFinite(v) && v > 0 ? Math.max(0.05, Math.min(0.95, v)) : 0;
}
/** สำรอง: วัดจาก DOM (ใช้เมื่อแผงอยู่ในกลุ่มแท็บ/ลอย จึงไม่มีสัดส่วนในต้นไม้) */
function domRatio(pid) {
  const node = document.querySelector(`#${HOST_ID} .k-panel[data-panel-id="${pid}"]`);
  const dockEl = node && node.closest('.k-dock');
  if (!node || !dockEl) return 0;
  const row = dockEl.dataset.dir === 'row';
  const r = node.getBoundingClientRect(), dr = dockEl.getBoundingClientRect();
  const total = row ? dr.width : dr.height;
  const mine = row ? r.width : r.height;
  if (!(total > 0) || !(mine > 0)) return 0;
  return Math.max(0.05, Math.min(0.95, mine / total));
}
function currentRatio(pid) { return treeRatio(pid) || domRatio(pid); }

/** ตั้งสัดส่วนของแผงใน dock แม่ให้เท่ากับ ratio (พี่น้องแบ่งส่วนที่เหลือตามอัตราเดิม) */
function applyRatio(pid, ratio) {
  const m = getPanelManager();
  if (!m.root || !(ratio > 0) || !(ratio < 1)) return false;
  const next = JSON.parse(JSON.stringify(m.root));
  let hit = null;
  PL.walk(next, (n) => {
    if (hit || n.type !== 'dock') return;
    const i = (n.children || []).findIndex((c) => c.type === 'panel' && c.id === pid);
    if (i >= 0 && n.children.length > 1) hit = { node: n, index: i };
  });
  if (!hit) return false;
  const { node, index } = hit;
  const n = node.children.length;
  const sizes = PL.normalizeSizes(
    node.sizes && node.sizes.length === n ? node.sizes : new Array(n).fill(1 / n));
  const restOld = sizes.reduce((a, v, i) => (i === index ? a : a + v), 0);
  const rest = 1 - ratio;
  node.sizes = sizes.map((v, i) => (i === index ? ratio : (restOld > 0 ? v / restOld * rest : rest / (n - 1))));
  m.store.update(next);
  return true;
}

/** กล่องลอยตั้งต้นของแผงนี้ — กลางจอ ขนาดตามที่ทะเบียนของแผงนั้นกำหนดไว้เอง (ไม่ใช่เลขรวม) */
export function defaultFloatBox(pid) {
  const d = PANEL_DEFS.find((x) => x.id === pid) || {};
  const W = window.innerWidth || 1200, H = window.innerHeight || 800;
  // [alpha.164 ข้อ F1] แผงผืนวาด (กระดาน · ผัง · แผนที่ · เส้นเวลา …) ประกาศ `floatFrac` = สัดส่วนของหน้าต่าง
  // เดิมทุกแผงได้ dockW×1.1 × 520px (~700×520) — กระดานวางแผนลอยมาแคบกว่า minW ของตัวเองด้วยซ้ำ
  // และทุกแผงเปิดตรงกลางจอพอดี = ซ้อนทับกันเป๊ะ มองไม่ออกว่ามีกี่ใบ
  const frac = Number(d.floatFrac) > 0 ? Math.min(0.9, Number(d.floatFrac)) : 0;
  let w = d.floatW || (frac ? Math.round(W * frac) : Math.max(340, Math.round((d.dockW || 300) * 1.1)));
  let h = d.floatH || (frac ? Math.round(H * frac) : 520);
  w = Math.min(Math.max(w, d.minW || 0), Math.round(W * 0.9));
  h = Math.min(h, Math.round(H * (frac ? 0.9 : 0.8)));
  // เยื้องตามจำนวนแผงลอยที่เปิดอยู่แล้ว (ขั้นละ 28px · วนทุก 6 ใบ) — ใบใหม่ไม่ทับใบเดิมมิด
  let n = 0;
  try { n = document.querySelectorAll('.k-float-panel').length % 6; } catch {}
  const off = n * 28;
  const x = Math.max(8, Math.min(W - w - 8, Math.round((W - w) / 2) + off));
  const y = Math.max(8, Math.min(H - h - 8, Math.round((H - h) / 2) + off));
  return { x, y, w, h };
}

/**
 * [alpha.66r11 บั๊ก B] เรียกแผงที่ "เคยลอย" กลับมา
 * ลำดับตามที่ผู้ใช้กำหนด: กลับเข้ากลุ่มเดิมก่อน → ถ้ากลุ่มนั้นไม่เหลือแล้ว
 * ใช้ **ตำแหน่ง/ขนาดล่าสุดของกลุ่มที่เคยอยู่** → ไม่มีอะไรเลยค่อยลอยกลางจอ
 */
function reopenFloat(m, pid, home) {
  for (const mate of (home && home.floatWith) || []) {
    const fid = m.floatIdOf(mate);
    if (fid && m.groupIntoFloat(pid, fid)) return true;
  }
  return m.floatPanel(pid, (home && home.float) || defaultFloatBox(pid));
}

/**
 * แผงที่ไม่มีในทะเบียน = ห้ามเปิด — เดิมคำสั่ง `toggle-panel`/`show-panel` ที่ไม่ส่งชื่อมา
 * (อยู่ในทะเบียนคำสั่ง: ผูกคีย์ลัดเองได้ · ปลั๊กอินเรียกได้) สร้าง **แผงลอยผีชื่อ "undefined"**
 * ไม่มีหัว ไม่มีเนื้อ ค้างกลางจอ
 */
function unknownPanel(m, pid) {
  if (pid && m.registry.has(pid)) return false;
  if (pid && !m.registry.size) return false;       // ทะเบียนยังไม่ถูกเติม (ช่วงบูต) — อย่าขวาง
  log('warn', 'panel: unknown panel id', { id: pid });
  return true;
}

export function showPanel(id, opts = {}) {
  const m = getPanelManager();
  const pid = panelId(id);
  if (unknownPanel(m, pid)) return false;
  // [alpha.67] แผงนี้ถูกฉีกไปอยู่หน้าต่างแยกแล้ว — "เปิดแผง" ต้องแปลว่า **ยกหน้าต่างนั้นขึ้นมา**
  // ไม่ใช่วาดใบที่สองในหน้าต่างนี้ (จะได้แผงเดียวกันสองใบที่ไม่รู้จักกัน)
  // ยกเว้นตอนคืนแผงกลับจริง ๆ (onTearOffClosed) ซึ่งลบออกจาก tornOff ไปก่อนแล้ว
  if (tornOff.has(pid)) { focusTearOff(pid); return true; }
  const def = m.registry.get(pid) || {};
  let ok;
  // [alpha.66r7 กฎข้อ 2 ของผู้ใช้] **เปิดแผงครั้งแรก (หรือหลังรีเซ็ต) = ลอยกลางจอ ไม่ใช่ผนึก**
  // เหตุผล: การผนึกอัตโนมัติไปเบียดพื้นที่ของแผงที่ผู้ใช้จัดไว้แล้วเสมอ
  // (เปิดแผง C แล้วแผง A ที่ตั้งไว้ 450px หดลง — ผู้ใช้รายงานเข้ามา)
  // ลอยกลางจอ = ไม่แตะเลย์เอาต์ที่ผู้ใช้จัดไว้เลย แล้วผู้ใช้ค่อยลากไปผนึกเองถ้าต้องการ
  if (opts.prefer === 'float' && !m.isDocked(pid) && !m.isFloating(pid) && !opts.side && !opts.targetId) {
    ok = reopenFloat(m, pid, homes.get(pid));
    if (ok && onShowHook) { try { onShowHook(pid); } catch {} }
    return ok;
  }
  // [alpha.62 บั๊ก 21] **มีสล็อตในต้นไม้อยู่แล้ว → ถอดธงแล้วจบ**
  // ไม่แตะ homes ไม่ dock ใหม่ ไม่ applyRatio — ตำแหน่ง ทิศ ลำดับ และ sizes อยู่ครบเหมือนตอนปิด
  // (เงื่อนไขนี้ต้องมาก่อน เพราะ opts.side/targetId ที่ผู้เรียกใส่มาเป็นแค่ "ค่าเริ่มต้นตอนยังไม่มีที่อยู่")
  if (m.isDocked(pid) && opts.forceMove && (opts.targetId || opts.side)) {
    // สั่งย้ายจริง (ลากวาง / เทส) — ต้องถอดออกแล้วผนึกใหม่ ไม่ใช่แค่ถอดธง
    ok = m.dockPanel(pid, opts.side || def.defaultSide || 'left', opts.targetId);
  }
  else if (m.isDocked(pid)) {
    ok = m.showPanel(pid);
  }
  else if (m.isCollapsed(pid)) { m.collapsePanel(pid, false); ok = true; }
  else {
    const home = homes.get(pid);
    // แผงที่เคยลอยอยู่ → กลับไปลอยที่เดิม (บั๊ก #4) · เคยอยู่ในกลุ่มลอย → กลับเข้ากลุ่มเดิม (66r11)
    if (!opts.side && !opts.targetId && home && (home.float || home.floatWith)) {
      ok = reopenFloat(m, pid, home);
    } else {
      // เป้าหมายผนึกเริ่มต้น = ที่เดิมที่จดไว้ · ไม่มีก็ยึดแผงเอกสาร
      // (ไม่งั้น _target() หยิบ panel ตัวแรก = แถบเครื่องมือ)
      const o = { ...opts };
      if (!o.targetId) o.targetId = (home && home.targetId) || 'docs';
      if (!o.side && home && home.side) o.side = home.side;
      if (!m.isDocked(o.targetId)) o.targetId = m.isDocked('docs') ? 'docs' : undefined;
      // ห้ามรวมแผงอื่นเป็นแท็บเดียวกับ "แผงเอกสาร" — จะบังพื้นที่เขียนทั้งหมด
      if (o.side === 'center' && o.targetId === 'docs') o.side = def.defaultSide || 'right';
      // ผนึกซ้าย/ขวาเทียบแผงที่อยู่ในกลุ่มแท็บ = ยัด dock ซ้อนในกลุ่มแท็บ (โครงเพี้ยน) → ยึดแผงเอกสารแทน
      if (o.side !== 'center' && PL.tabGroupOf(m.root, o.targetId) && m.isDocked('docs')) o.targetId = 'docs';
      ok = m.showPanel(pid, o);
      // [ข้อ 22 · ขยายใน 60r2 ข้อ 8] คืนสัดส่วนที่ผู้ใช้เคยลากไว้ ไม่ใช่แบ่งเท่ากันใหม่ทุกครั้ง
      // ลำดับ: สัดส่วนที่จดตอนปิด → สัดส่วนที่จดไว้ใน layout store (รอดข้ามการเปิด-ปิดโปรแกรม)
      // [alpha.66r4] แผงที่เคยวัด px ไว้แล้ว **ไม่ต้องคืนสัดส่วน** — ค่า px ติดอยู่กับโหนด
      // และเดินทางมากับมันตอนถอด-ผนึกใหม่อยู่แล้ว (แม่นกว่าสัดส่วน และไม่ดริฟต์)
      const node = PL.findPanel(m.root, pid);
      const hasPx = !!(node && (node.pxW > 0 || node.pxH > 0));
      const ratio = (home && home.ratio > 0) ? home.ratio : m.savedRatio(pid);
      if (ok && !hasPx && ratio > 0) { try { applyRatio(pid, ratio); } catch {} }
    }
  }
  if (ok && onShowHook) { try { onShowHook(pid); } catch {} }
  return ok;
}
export function hidePanel(id, force) {
  const pid = panelId(id);
  rememberHome(pid);
  return getPanelManager().hidePanel(pid, force);
}
/** ยามก่อนปิดแผง — ใช้เตือน "ยังไม่ได้บันทึก" (Planner) · fn(proceed) คืน false = หน่วงไว้ก่อน */
export function setPanelCloseGuard(id, fn) {
  return getPanelManager().setCloseGuard(panelId(id), fn);
}
// บั๊ก #2 + #10: ปุ่มสวิตช์บนแถบเครื่องมือต้อง "ปิดแผง" ไม่ใช่ "พับ/ย่อ"
// (เดิม togglePanel เรียก collapsePanel → กด Kanban ซ้ำแล้วเหลือแถบหัวแผงเปล่า ๆ ดูเหมือนปิดไม่ได้)
// การพับยังใช้ได้ที่ปุ่ม ▾ บนหัวแผงเหมือนเดิม
export function togglePanel(id, opts) {
  const m = getPanelManager();
  const pid = panelId(id);
  if (unknownPanel(m, pid)) return false;
  // [alpha.67] อยู่ในหน้าต่างแยก = เปิดอยู่ → กดสวิตช์ซ้ำ แปลว่า "เอากลับมา/ปิดหน้าต่างนั้น"
  if (tornOff.has(pid)) { recallPanel(pid); return true; }
  if (m.isOpen(pid)) return hidePanel(pid);
  // ทางเข้าฝั่งผู้ใช้ (เมนู · ปุ่มบนแถบเครื่องมือ · ถาดแผงที่ปิดไว้) = เปิดเป็นแผงลอยกลางจอ
  return showPanel(pid, { prefer: 'float', ...(opts || {}) });
}
/**
 * [alpha.66r8] ประทับ "ค่าอ้างอิงตั้งต้น" ของแต่ละแผงลงในต้นไม้
 * ผู้ใช้ระบุว่า: ค่า default ต้องเป็น **ค่าอ้างอิง** — กดรีเซ็ตแล้วเอาค่านี้ไปแทนของเดิม
 * ไม่ใช่ "ลบค่าทิ้งให้ว่าง" · เพราะแผงที่ไม่มีขนาดของตัวเองจะไปเปลี่ยนขนาดตอนถูก dock ทีหลัง
 */
function stampDefaultSizes(root) {
  if (!root) return root;
  const next = JSON.parse(JSON.stringify(root));
  PL.walk(next, (n) => {
    if (!n || n.type !== 'panel') return;
    const d = PANEL_DEFS.find((x) => x.id === n.id);
    if (!d) return;
    // แผงเอกสาร/แถบเครื่องมือ/แถบสถานะ **ห้ามตรึงขนาด** — เอกสารต้องเป็นตัวยืดเสมอ
    // ส่วนสองแถบนั้นกินพื้นที่เท่าเนื้อหาอยู่แล้ว (ถ้าตรึงจะไปแย่งพื้นที่พื้นที่เขียน)
    if (d.fixed || d.closable === false) return;
    n.pxW = d.dockW || 300;
    n.pxH = d.dockH || 220;
    delete n.fW; delete n.fH;           // ขนาดโหมดลอยกลับไปใช้ค่าอ้างอิงเช่นกัน
    delete n.fX; delete n.fY;           // [alpha.165] ตำแหน่งโหมดลอยด้วย
  });
  return next;
}

// ───────── ส่งออก "การจัดวางแผง" เป็นไฟล์ JSON ─────────
// ใช้ 2 ทาง: (1) จัดวางจนพอใจแล้วส่งออกไว้เป็น **เลย์เอาต์อ้างอิง**
//            (2) แนบไฟล์นี้ตอนรายงานบั๊กเรื่องแผง — มีทั้งค่าที่เก็บไว้ ขนาดจริงบนจอ และผลวินิจฉัย
// ตรรกะประกอบรายงานอยู่ที่ panel-export.js (บริสุทธิ์ · มี unit test) — ที่นี่ทำแค่ "วัด DOM + เซฟไฟล์"

/** ขนาด/ตำแหน่งจริงบนจอของทุกโหนด (dock · กลุ่มแท็บ · แผง · แผงลอย) → { id: {...} } */
export function measurePanelGeometry() {
  const out = {};
  const h = host();
  const take = (e, kind, id) => {
    if (!id || out[id]) return;
    const r = e.getBoundingClientRect();
    out[id] = {
      kind, x: Math.round(r.left), y: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height),
      flex: e.style.flex || [e.style.flexGrow, e.style.flexShrink, e.style.flexBasis].filter(Boolean).join(' ') || '',
      cls: e.className || '',
    };
  };
  if (h) {
    for (const e of h.querySelectorAll('.k-dock[data-dock-id]')) take(e, 'dock', e.dataset.dockId);
    for (const e of h.querySelectorAll('.k-tab-group[data-tabs-id]')) take(e, 'tabs', e.dataset.tabsId);
    for (const e of h.querySelectorAll('.k-panel[data-panel-id]')) take(e, 'panel', e.dataset.panelId);
  }
  for (const e of document.querySelectorAll('.k-float-panel[data-panel-id]')) take(e, 'float', e.dataset.panelId);
  return out;
}

/** รายงานฉบับเต็ม (object) — e2e/เทสเรียกตัวนี้ได้โดยไม่ต้องเปิดกล่องบันทึกไฟล์ */
export function panelLayoutReport() {
  const m = getPanelManager();
  rememberSides();
  const open = m.openIds();
  return buildLayoutReport({
    layout: { ...m.layout(), version: 2 },
    app: { name: 'Killian 2', platform: (navigator && navigator.platform) || '', project: state.title || '' },
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    defs: PANEL_DEFS.map((d) => ({
      id: d.id, title: titleOf(d), defaultSide: d.defaultSide || 'left',
      dockW: d.dockW || 300, dockH: d.dockH || 220,
      fixed: !!d.fixed, closable: d.closable !== false, floatable: d.floatable !== false,
    })),
    state: {
      open,
      hidden: PANEL_DEFS.filter((d) => m.isHidden(d.id)).map((d) => d.id),
      floating: (m.floats || []).flatMap((f) => (f.panel.type === 'tabs'
        ? (f.panel.children || []).map((c) => c.id) : [f.panel.id])),
    },
    measured: measurePanelGeometry(),
    homes: Object.fromEntries(homes),
    workspaces: m.store.workspaces(),
    gaps: auditPanelGaps(),
  });
}

/** ส่งออกเป็นไฟล์ (เมนู 📐 จัดการแผง → ส่งออก) — คืน path ที่บันทึก หรือ null ถ้ายกเลิก */
export async function exportPanelLayout() {
  const report = panelLayoutReport();
  const json = reportToJson(report);
  const name = defaultExportName(state.title || '');
  try {
    const dest = await kapi.saveAsDialog(name, 'json');
    if (!dest) return null;
    await kapi.writeFile(dest, json);
    log('info', t('ui.panel.panelExportLayoutPanel2'), { dest, warnings: report.diagnostics.warnings.length });
    setStatus(t('ui.panel.exported') + dest);
    return dest;
  } catch (e) {
    // ไม่มีกล่องบันทึกไฟล์ (เทส/เบราว์เซอร์) → อย่างน้อยให้ค่าไปทางคลิปบอร์ด
    try { await kapi.clipboardWrite(json); setStatus(t('ui.panel.exportClip')); return 'clipboard'; } catch {}
    log('error', t('ui.panel.panelExportLayoutPanel'), e);
    setStatus(t('ui.panel.exportFail'));
    return null;
  }
}

export function resetPanels() {
  const m = getPanelManager();
  // ลืมรายการ "แผงที่ซ่อนไว้ชั่วคราว" ด้วย (เลย์เอาต์ใหม่หมดแล้ว)
  // [alpha.161 · U6] ★ เดิมล้างแค่ `_stash` — ที่พักทีละฝั่งค้าง: ซ่อนฝั่งบนแล้วรีเซ็ตเลย์เอาต์
  //   แถบเครื่องมือยังหายอยู่ (คลาส k-hide-toolbar ค้างบน body) จนต้องไปหาปุ่มฝั่งบนกดคืนเอง
  resetSideStash();
  _recentClosed.length = 0;
  resetPanelHomes();                    // รีเซ็ตทั้งหมด = ลืม "ที่เดิม" ของแผงที่เคยปิดด้วย
  m.store.reset();
  m.store.update(stampDefaultSizes(defaultLayout()));
  renderPanels(true);
  setStatus(t('ui.panel.layoutReset'));
  return true;
}
/** รายการแผงสำหรับเมนู "มุมมอง → แผง" */
export function panelMenuItems() {
  const m = getPanelManager();
  return PANEL_DEFS.filter((d) => d.closable !== false).map((d) => {
    // [alpha.67] แผงที่อยู่หน้าต่างแยกต้องอ่านออกทันทีว่า "เปิดอยู่ แต่ไม่ได้อยู่ที่นี่"
    // ไม่งั้นผู้ใช้กดแล้วงงว่าทำไมไม่มีอะไรโผล่ในหน้าต่างนี้ (togglePanel เรียกมันกลับมาให้)
    const away = tornOff.has(d.id);
    return {
      label: (away ? gi('desktop') + ' ' : m.isOpen(d.id) ? gi('checkbox-checked') + ' ' : gi('checkbox') + ' ') + titleOf(d)
             + (away ? t('ui.panel.menuAway') : ''),
      click: () => togglePanel(d.id),
    };
  });
}
/** สถานะเปิด/ปิดของทุกแผง (ส่งให้เมนู native ติ๊กถูก) */
export function panelToggleState() {
  const m = getPanelManager();
  const o = {};
  // [alpha.67] แผงที่อยู่ในหน้าต่างแยกยังนับว่า "เปิดอยู่" — ปุ่มบนแถบเครื่องมือต้องติดไฟค้างไว้
  // ไม่งั้นดูเหมือนแผงถูกปิดไปแล้วทั้งที่ผู้ใช้เห็นมันอยู่บนอีกจอ
  for (const d of PANEL_DEFS) o[d.id] = m.isOpen(d.id) || tornOff.has(d.id);
  return o;
}

/** ฝากปุ่มพิเศษไว้บนหัวแผง — element เดิมถูกนำกลับมาใช้ทุกรอบ render (onclick จึงไม่หาย) */
export function addPanelButton(id, node) {
  const pid = panelId(id);
  const list = extras.get(pid) || [];
  if (!list.includes(node)) list.push(node);
  extras.set(pid, list);
  renderPanels(true);
  return node;
}

// ───────── [alpha.66r3] เมนูเวิร์กสเปซ ─────────
/** รายการเมนู "เวิร์กสเปซ" — ใช้ทั้งในเมนูมุมมอง กล่องจัดการแผง และเมนู ☰ ของทุกแผง */
export function workspaceMenuItems() {
  const items = [{ label: t('ui.panel.wsPick'), disabled: true }];
  for (const w of listWorkspaces()) {
    items.push({ text: (w.builtIn ? gi('window-restore') + ' ' : gi('window-max') + ' ') + w.label, click: () => applyWorkspace(w.name) });
  }
  items.push('-');
  items.push({ label: t('ui.panel.wsSave'),
    click: async () => {
      const name = await ask(t('ui.panel.wsName'),
                             { placeholder: t('ui.panel.wsNameHint'), okLabel: t('ui.common.save') });
      if (!name) return;
      if (isBuiltinWorkspace(name)) { setStatus(t('ui.panel.wsBuiltin')); return; }
      if (saveWorkspace(name)) setStatus(t('ui.panel.wsSaved') + name);
    } });
  const mine = listWorkspaces().filter((w) => !w.builtIn);
  if (mine.length) {
    items.push({ label: t('ui.panel.wsDelete'),
      click: () => {
        const r = $('#tb-panels') ? $('#tb-panels').getBoundingClientRect() : { left: 40, bottom: 60 };
        popupMenu(r.left, r.bottom + 4, mine.map((w) => ({
          text: gi('trash') + ' ' + w.label,   // [alpha.167 · บั๊ก] ชื่อที่ผู้ใช้ตั้ง = ข้อความ (label ของ popupMenu เป็น HTML)
          click: async () => {
            if (!(await confirmBox(t('ui.panel.wsDelAsk') + w.label + '” ?'))) return;
            deleteWorkspace(w.name);
            setStatus(t('ui.panel.wsDeleted') + w.label);
          },
        })));
      } });
  }
  return items;
}
export function workspaceMenu(x, y) {
  const btn = $('#tb-panels');
  const r = btn ? btn.getBoundingClientRect() : { left: 40, bottom: 60 };
  popupMenu(x ?? r.left, y ?? (r.bottom + 4), workspaceMenuItems());
}

// ───────── กล่อง "จัดการแผง" (ปุ่ม 📐 บน toolbar / เมนู) ─────────
export async function togglePanelDialog() {
  const items = panelMenuItems();
  items.push('-');
  // [alpha.66r3] จัดการพื้นที่ + เวิร์กสเปซ อยู่ในกล่องเดียวกับรายการแผง
  items.push({ label: panelsHidden() ? t('ui.panel.spaceShow')
                                     : t('ui.panel.spaceHideAll'),
               click: () => toggleSpace('all') });
  items.push({ label: t('ui.panel.spaceHideRight'), click: () => toggleSpace('right') });
  items.push({ label: t('ui.panel.spaceHideLeft'), click: () => toggleSpace('left') });
  items.push('-');
  items.push({ label: t('ui.panel.wsMenu'), click: () => workspaceMenu() });
  items.push('-');
  items.push({ label: t('ui.panel.exportLayout'), click: () => exportPanelLayout() });
  items.push({ label: t('ui.panel.resetAll'), click: () => resetPanels() });
  try {
    // popupMenu อยู่ที่ ui.js — app.js แค่ import มาใช้ ไม่ได้ export ต่อ
    // (เดิม `import('../app.js')` จึงได้ undefined ทุกครั้ง → ตกไป fallback ตลอดกาล)
    const btn = $('#tb-panels');
    const r = btn ? btn.getBoundingClientRect() : { left: 40, bottom: 60 };
    if (typeof popupMenu !== 'function') throw new Error('no popupMenu');
    popupMenu(r.left, r.bottom + 4, items);
  } catch {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', t('ui.panel.manage')));
    for (const it of items) {
      if (it === '-') { box.append(el('hr')); continue; }
      const row = el('div', 'k-menu-item', it.label);
      row.onclick = () => { it.click(); ov.remove(); };
      box.append(row);
    }
    const closeBtn = el('button', 'k-cancel', t('ui.common.close'));
    closeBtn.onclick = () => ov.remove();
    const btns = el('div', 'k-dlg-btns'); btns.append(closeBtn);
    box.append(btns); ov.append(box); document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  }
}

// ───────── cleanup (เปลี่ยนโปรเจกต์) ─────────
export function resetPanelSystem() { lastSig = ''; resetPanelHomes(); resetScrollMemo(); resetSideStash(); }
/** ลืมตำแหน่งเดิมของแผงที่ถูกปิดไว้ (ทั้งในหน่วยความจำและใน localStorage) */
export function resetPanelHomes() {
  homes.clear();
  try { localStorage.removeItem(HOME_KEY); } catch {}
}
