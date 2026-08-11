// panel-ui.js — Panel System แบบ Photoshop: ทุกพื้นที่ของหน้าต่างคือ "แผง" ที่ dock/tab/float ได้
// เขียนใหม่ทั้งไฟล์ (alpha.46) — แทนที่ระบบแผงลอยเดิมใน app.js (makeFloatablePanel/PANELS)
//
//   initPanelSystem()  → ลงทะเบียนแผงทั้งหมด · กู้เลย์เอาต์ · วาดลง #app-root · auto-save
//   showPanel(id) / hidePanel(id) / togglePanel(id) / resetPanels()
//   addPanelButton(id, el)  → ฝากปุ่มพิเศษไว้บนหัวแผง (โมดูลอื่นเรียก · element เดิมถูกใช้ซ้ำทุก render)
//
// เนื้อแผงคือ element เดิมใน index.html (#tree-panel, #content, …) — "ย้ายเข้า" host เท่านั้น ห้ามสร้างใหม่
// เพราะโค้ดทั้งโปรเจกต์อ้าง id เหล่านี้ ($('#panes'), $('#tabs'), $('#props-body'), …)
import { $, el, setStatus, t, onLanguageChanged, log, state, PANEL_WIN,
         keepScroll, restoreScrollSnap, elByPath } from '../core.js';
import { popupMenu, ask, confirmBox } from '../ui.js';
import * as PL from './panel-layout.js';
import { PanelManager } from './panel-store.js';
import { renderPanelLayout } from './panel-renderer.js';
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

// ทะเบียนหน้าตาของแผง (registry ของ PanelManager เก็บแค่บางฟิลด์ จึงแยกเก็บที่นี่)
// [alpha.60r3 ข้อ 8] `desc` = คำอธิบายภาษาไทยของแผง — โผล่ในเมนูคลิกขวาบนหัวแผง ("❔ นี่คืออะไร")
// เขียนให้ตอบคำถามเดียว: "แผงนี้ใช้ทำอะไร และเปิดไว้ตอนไหน"
export const PANEL_DEFS = [
  { id: 'toolbar',   title: 'แถบเครื่องมือ', icon: 'layout',       adopt: '#toolbar',       fixed: true, noHead: true, closable: false, floatable: false,
    desc: 'ปุ่มจัดรูปแบบและสวิตช์โหมดทั้งหมด — ตัวหนา/เอียง · จัดหน้า · โหมดอ่าน/โฟกัส · เปิด-ปิดแผงอื่น' },
  { id: 'tree',      title: 'โปรเจกต์',      icon: 'book-content', adopt: '#tree-panel',    defaultSide: 'left',  i18n: 'panel.project',
    desc: 'สารบัญของผลงานทั้งเล่ม — เล่ม → บท → ฉาก พร้อม Wiki คลังรูป และถังขยะ · ลากสลับลำดับได้ · ช่องค้นหาด้านบนกรองได้ทั้งชื่อ แท็ก และสถานะ' },
  { id: 'outline',   title: 'Navigation',    icon: 'list-ul',      adopt: '#outline-panel', defaultSide: 'left',  i18n: 'panel.navigation',
    desc: 'เค้าโครงหัวข้อของ "ไฟล์ที่เปิดอยู่" — คลิกหัวข้อเพื่อกระโดดไปตำแหน่งนั้นในเอกสาร' },
  // แผงเอกสารไม่มีหัวแผง (พื้นที่ทำงานหลัก — แถบแท็บเอกสาร #tabs ทำหน้าที่นั้นอยู่แล้ว)
  { id: 'docs',      title: 'เอกสาร',         icon: 'file',         adopt: '#content',       noHead: true, closable: false, floatable: false,
    desc: 'พื้นที่เขียนหลัก — แท็บทุกใบที่เปิดอยู่ ทั้งฉาก บทภาพยนตร์ และหน้า Wiki (ปิดไม่ได้)' },
  { id: 'props',     title: 'คุณสมบัติ',      icon: 'clipboard',    adopt: '#props-panel',   defaultSide: 'right', i18n: 'panel.properties',
    desc: 'คุณสมบัติของฉากที่เลือก — เรื่องย่อ · มุมมอง · อารมณ์ · ความขัดแย้ง · สถานะ · สี · แท็ก · บันทึกอัตโนมัติขณะพิมพ์' },
  { id: 'statusbar', title: 'แถบสถานะ',      icon: 'grid',         adopt: '#statusbar',     fixed: true, noHead: true, closable: false, floatable: false,
    desc: 'ข้อมูลย่อของงานที่เปิดอยู่ — จำนวนคำ/หน้า · ข้อผิดพลาดในบท · แถบซูมหน้ากระดาษ' },
  { id: 'log', dockW: 420,       title: 'บันทึก',         icon: 'history',      adopt: '#log-panel',     defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.logTitle',
    desc: 'บันทึกการทำงานของโปรแกรม — ใช้ตอนหาสาเหตุเมื่อมีอะไรไม่เป็นอย่างที่คาด' },
  { id: 'search', dockW: 360,    title: 'ค้นหา',          icon: 'search',       adopt: '#search-panel',  defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.searchTitle',
    desc: 'ค้นข้อความทั้งโปรเจกต์ — ทุกฉาก ทุกเล่ม และหน้า Wiki · คลิกผลลัพธ์เพื่อเปิดไฟล์ที่บรรทัดนั้น' },
  { id: 'notes',     title: 'สมุดโน้ตด่วน',    icon: 'note',         adopt: '#notes-panel',   defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.notesTitle',
    desc: 'ที่จดความคิดชั่วคราวโดยไม่ปนต้นฉบับ — โน้ตผูกกับฉากที่เปิดอยู่ตอนจด' },
  { id: 'comments',  title: 'คอมเมนต์',        icon: 'chat',         adopt: '#comments-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.commentsTitle',
    desc: 'คอมเมนต์ของฉากที่เปิดอยู่ — ตอบกลับเป็นเธรด ปิดงานได้ · เก็บท้ายไฟล์ .md จึงติดไปกับไฟล์เสมอ' },
  // ── บั๊ก #18: ฟีเจอร์ที่ไม่ใช่เอกสาร เป็นแผง ไม่ใช่แท็บ ──
  { id: 'dashboard', dockW: 640, title: 'แดชบอร์ด',        icon: 'grid',         adopt: '#dash-panel',    defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.dashboardTitle',
    desc: 'ภาพรวมความคืบหน้า — จำนวนคำเทียบเป้าหมาย · สัดส่วนฉากตามสถานะ · ความยาวของแต่ละบท' },
  { id: 'kanban', dockW: 640,    title: 'Kanban',          icon: 'grid',         adopt: '#kanban-panel',  defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.kanbanTitle',
    desc: 'กระดานฉากเรียงตามสถานะ — ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะฉากนั้นทันที' },
  { id: 'books', dockW: 640,     title: 'จัดการเล่ม',       icon: 'book-content', adopt: '#books-panel',   defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.booksTitle',
    desc: 'จัดการเล่มและฉบับร่าง — ปก · คำโปรย · สถานะ · สถิติรายเล่ม · ลากสลับลำดับเล่ม' },
  { id: 'timeline', dockW: 640,  title: 'เส้นเวลา',         icon: 'history',      adopt: '#tl-panel',      defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.timelineTitle',
    desc: 'ลำดับเหตุการณ์ตาม "เวลาในเรื่อง" — สลับมุมมองการ์ด/Gantt ได้ · ฉากที่ตั้ง storyDate ไว้จะขึ้นเอง' },
  { id: 'maps', dockW: 640,      title: 'แผนที่',           icon: 'layout',       adopt: '#maps-panel',    defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.mapsTitle',
    desc: 'แผนที่ของโลกในเรื่อง — ปักหมุดบนรูป เชื่อมหมุดเข้ากับฉาก/สถานที่ · หมุดประตูพาลงไปแผนที่ย่อยได้' },
  // [alpha.60r1 ข้อ 21] คลังรูปภาพ — ย้ายจากแท็บเอกสารมาเป็นแผงเหมือนฟีเจอร์อื่น
  { id: 'gallery', dockW: 640,   title: 'คลังรูปภาพ',       icon: 'image',        adopt: '#gal-panel',     defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.galleryTitle',
    desc: 'รูปทั้งหมดในโฟลเดอร์ Images ของโปรเจกต์ — ลากลงเอกสารเพื่อแทรก หรือเลือกเป็นปก/รูปประจำตัวใน Wiki' },
  // [alpha.63r] กระดานอารมณ์ — แยกจากคลังรูปเพราะต้อง "ลากรูปมาวาง" ข้ามแผง
  { id: 'gallery-board', dockW: 640, title: '🎨 กระดานอารมณ์', icon: 'layout', adopt: '#galboard-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.galleryBoardTitle',
    desc: 'ผืนผ้าใบวางรูปอ้างอิงของแต่ละอัลบั้ม — เปิดคู่กับแผงคลังรูปแล้วลากรูปมาวางได้เลย · ย้าย/ปรับขนาด/ซูมได้อิสระ · เอาออกจากกระดานไม่ลบไฟล์' },
  // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
  { id: 'ai-analyzer', dockW: 640, title: '🧠 AI วิเคราะห์',  icon: 'brain',       adopt: '#ai-analyzer-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.aiAnalyzerTitle',
    desc: 'ชุดเครื่องมือวิเคราะห์ต้นฉบับด้วย AI — จังหวะเรื่อง · ส่วนโค้งตัวละคร · คำซ้ำ · ความขัดแย้ง · ความยาวฉาก (ยังเป็นตัวอย่างหน้าตา)' },
  // [alpha.61 ข้อ 2] แชทกับ AI แบบ opencode — เซสชันเก็บใน Sessions/ ของโปรเจกต์
  { id: 'ai-chat', dockW: 640,   title: '💬 AI ผู้ช่วยเขียน',       icon: 'chat',        adopt: '#ai-chat-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.aiChatTitle',
    desc: 'คุยกับ AI เรื่องงานเขียนของคุณ — แยกเป็นเซสชันเหมือน opencode · เลือกโหมด (วางแผน/ช่วยเขียน) · เลือกโมเดล · กำหนดได้ว่าจะให้เห็นข้อมูลระดับไหน (ทั้งโปรเจกต์/เล่ม/บท/ฉาก)' },
  // ── [alpha.62 บั๊ก 16] 3 ฟีเจอร์สุดท้ายที่ยังเป็นแท็บเอกสาร ──
  { id: 'network', dockW: 640,   title: 'Story Network',   icon: 'grid',          adopt: '#net-panel',     defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.networkTitle',
    desc: 'ผังความสัมพันธ์ของตัวละคร/สถานที่/สิ่งของ — ลากโหนดจัดวางเอง · สีเส้นบอกประเภทความสัมพันธ์ · ดับเบิลคลิกเปิดหน้า Wiki นั้น' },
  { id: 'planner', dockW: 640,   title: 'Planner',         icon: 'grid',         adopt: '#planner-panel', defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.plannerTitle',
    desc: 'กระดานวางแผนแบบการ์ดอิสระ — วางโน้ต รูป และลิงก์ไปฉากได้ทุกที่บนผืนผ้าใบ · ใช้ปะติดปะต่อโครงเรื่องก่อนลงมือเขียน' },
  { id: 'planner-props', title: 'คุณสมบัติ Planner', icon: 'info', adopt: '#planner-props-panel', defaultSide: 'right',
    closable: true, floatable: true, i18n: 'panel.plannerPropsTitle',
    desc: 'คุณสมบัติของการ์ดหรือเส้นเชื่อมที่เลือกบนกระดาน Planner — ชื่อ · สรุป · สี · สถานะ · แท็ก · ขนาด · สไตล์เส้น' },
  { id: 'floorplan', dockW: 640, title: '📍 ผังพื้นที่',      icon: 'map',          adopt: '#floor-panel',   defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.floorplanTitle',
    desc: 'ฉากนี้เกิดที่ไหน — แผนที่ + หมุด "คุณอยู่ที่นี่" + เส้นเวลาของสถานที่นั้น + สิ่งที่เห็น/ได้ยิน/พบ ของฉากที่เปิดอยู่' },
  // ── [alpha.66 ข้อ 1+9] เรื่องแบบแตกสาย: ผัง + โหมดทดลองเล่น ──
  { id: 'branch', dockW: 640,    title: '🌿 ผังแตกสาย',      icon: 'grid',          adopt: '#branch-panel',  defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.branchTitle',
    desc: 'ผังเรื่องแบบแตกสาย — กล่องฉากต่อกันด้วยเส้นทางเลือก · ลากย้ายการ์ดได้ · เลือกสีการ์ด/เส้นได้ · เตือนทางตัน วงวนซ้ำ และทางเลือกที่ยังไม่ระบุปลายทาง · ส่งออกเป็น HTML/Markdown/JSON/รูปได้' },
  { id: 'player', dockW: 440,    title: '▶️ ทดลองเล่น',       icon: 'file',          adopt: '#player-panel',  defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.playerTitle',
    desc: 'อ่านเรื่องแบบผู้เล่น — เนื้อฉากอ่านอย่างเดียว แล้วกดปุ่มทางเลือกเดินต่อไปเรื่อย ๆ · ย้อนกลับได้ · เก็บเส้นทางแต่ละรอบไว้ดูย้อนหลัง' },
];
// ───────── [alpha.67] Tear-off — แผงที่ฉีกออกเป็นหน้าต่าง OS จริงได้ ─────────
//
// เกณฑ์: แผงต้อง "วาดตัวเองได้ครบจากไฟล์โปรเจกต์" โดยไม่พึ่ง `state.active` (ฉากที่เปิดอยู่)
// และไม่พึ่งการลากของข้ามแผง — เพราะหน้าต่างลูกเป็นคนละ JS context ไม่มีแท็บเอกสารและไม่มีแผงอื่น
//
// ที่จงใจ **ไม่** ใส่ในรอบนี้:
//   docs/toolbar/statusbar/tree — เป็นโครงหน้าต่างหลัก (แชร์ ProseMirror ข้าม context ไม่ได้)
//   outline/props/comments/floorplan/player/ai-* — ผูกกับ "ฉากที่เปิดอยู่" ต้องมีช่องส่ง state ก่อน
//   gallery-board — รับรูปด้วยการลากจากแผงคลังรูป ฉีกแยกหน้าต่างแล้วขาดกัน
export const TEAROFF_PANELS = new Set([
  'timeline', 'maps', 'kanban', 'dashboard', 'books',
  'network', 'planner', 'branch', 'search', 'gallery', 'log', 'notes',
]);
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
    ok = await window.kapi.tearOff({ id: pid, title: d ? titleOf(d) : pid, root: state.root || '', ...box });
  } catch (e) { log('warn', '[แผง] ฉีกออกเป็นหน้าต่างไม่สำเร็จ: ' + pid, e); }
  if (!ok) { tornOff.delete(pid); showPanel(pid); return false; }
  setStatus(t('panel.tornOff', 'ย้าย "') + (d ? titleOf(d) : pid) + t('panel.tornOff2', '" ไปหน้าต่างแยกแล้ว — ปิดหน้าต่างนั้นเพื่อเอากลับมา'));
  return true;
}
/** ยกหน้าต่างแผงที่เปิดอยู่แล้วขึ้นมาหน้าสุด (tearOff ตัวเดิมทำหน้าที่นี้ให้เมื่อ id ซ้ำ) */
function focusTearOff(pid) {
  try { window.kapi.tearOff({ id: pid }); } catch {}
  setStatus(t('panel.tornOffFocus', 'แผงนี้อยู่ในหน้าต่างแยก — ยกหน้าต่างนั้นขึ้นมาให้แล้ว'));
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
  const head = el('div', 'k-panel-head');
  head.appendChild(el('span', 'k-panel-head-title', d ? titleOf(d) : pid));
  box.appendChild(head);
  const body = el('div', 'k-panel-body');
  const node = adopted.get(pid);
  if (node) body.appendChild(node);
  box.appendChild(body);
  h.appendChild(box);
  document.title = (d ? titleOf(d) : pid) + ' — ' + (state.title || 'Killian 2');
  return pid;
}

// ชื่อแผงตามภาษาที่โหลดอยู่ (fallback = ชื่อไทยในตาราง) — เรียกใหม่ทุกครั้งที่ render
function titleOf(d) { return d.i18n ? t(d.i18n, d.title) : d.title; }
// [alpha.60r3 ข้อ 8] คำอธิบายแผง — i18n key `panel.desc_<id>` (fallback = ข้อความไทยในตาราง)
export function panelDesc(id) {
  const d = PANEL_DEFS.find((x) => x.id === panelId(id));
  if (!d) return '';
  return t('panel.desc_' + d.id.replace(/-/g, '_'), d.desc || '');
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
export function loadPanelLayout() { return getPanelManager().load(); }
export function savePanelLayout() { if (pm) pm.store.save(); }

function host() {
  return document.getElementById(HOST_ID) || document.body;
}
function srcHolder() {
  let h = document.getElementById(SRC_ID);
  if (!h) { h = el('div'); h.id = SRC_ID; h.hidden = true; document.body.appendChild(h); }
  return h;
}

// ───────── ลงทะเบียนแผงทั้งหมด ─────────
export function registerPanels() {
  const m = getPanelManager();
  for (const d of PANEL_DEFS) {
    meta.set(d.id, { title: d.title, icon: d.icon, fixed: !!d.fixed, noHead: !!d.noHead, desc: d.desc || '' });
    const node = d.adopt ? $(d.adopt) : null;
    if (node) adopted.set(d.id, node);
    m.registerPanel(d.id, {
      title: d.title,
      icon: d.icon,
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
    PL.panel('toolbar', 'แถบเครื่องมือ'),
    PL.dock('row', [
      PL.tabs([PL.panel('tree', 'โปรเจกต์'), PL.panel('outline', 'Navigation')], 0),
      PL.panel('docs', 'เอกสาร'),
    ], [0.24, 0.76]),
    PL.panel('statusbar', 'แถบสถานะ'),
  ], [0, 1, 0]);
}

// ───────── [alpha.66r3] Workspace Presets ─────────
// สเปก: "เก็บ Layout ของ Panel ทั้งหมดเป็นเซ็ตไว้ แล้วสลับตาม workflow ได้ทันที"
// ชุดสำเร็จรูปสร้างจากต้นไม้ตรง ๆ (ไม่เก็บใน storage) — แก้ไม่ได้ ลบไม่ได้ เหมือน Essentials ของ Photoshop
// แผงที่ไม่ได้อยู่ในต้นไม้ = ปิดอยู่ · ผู้ใช้บันทึกชุดของตัวเองทับชื่อเดิมไม่ได้ (กันเผลอ)
const wsRow = (left, center, right, sizes) =>
  PL.dock('row', right ? [left, center, right] : [left, center], sizes);
const wsFrame = (mid) => PL.dock('col', [
  PL.panel('toolbar', 'แถบเครื่องมือ'), mid, PL.panel('statusbar', 'แถบสถานะ'),
], [0, 1, 0]);

export const BUILTIN_WORKSPACES = [
  { id: 'essentials', label: 'Essentials (ค่าเริ่มต้น)',
    build: () => defaultLayout() },
  { id: 'writing', label: 'เขียน — จอโล่ง มีแค่สารบัญ',
    build: () => wsFrame(wsRow(PL.panel('tree', 'โปรเจกต์'), PL.panel('docs', 'เอกสาร'), null, [0.18, 0.82])) },
  { id: 'planning', label: 'วางแผน — โครงเรื่อง + คุณสมบัติฉาก',
    build: () => wsFrame(wsRow(
      PL.tabs([PL.panel('tree', 'โปรเจกต์'), PL.panel('kanban', 'Kanban'), PL.panel('timeline', 'เส้นเวลา')], 0),
      PL.panel('docs', 'เอกสาร'),
      PL.panel('props', 'คุณสมบัติ'), [0.26, 0.52, 0.22])) },
  { id: 'review', label: 'ตรวจแก้ — คอมเมนต์ + โน้ต',
    build: () => wsFrame(wsRow(
      PL.tabs([PL.panel('tree', 'โปรเจกต์'), PL.panel('outline', 'Navigation')], 1),
      PL.panel('docs', 'เอกสาร'),
      PL.tabs([PL.panel('comments', 'คอมเมนต์'), PL.panel('notes', 'สมุดโน้ตด่วน')], 0), [0.20, 0.56, 0.24])) },
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
  _stash = null;                                // เลย์เอาต์เปลี่ยนทั้งชุด — รายการ "แผงที่ซ่อนไว้" เดิมหมดความหมาย
  homes.clear();
  if (hm) for (const k of Object.keys(hm)) homes.set(k, hm[k]);
  saveHomes();
  renderPanels(true);
  // แผงฟีเจอร์ที่โผล่มาพร้อมเวิร์กสเปซต้องถูกวาดเนื้อด้วย (ไม่ได้ผ่าน showPanel จึงไม่มีใครเรียก hook)
  if (onShowHook) for (const id of m.openIds()) { try { onShowHook(id); } catch {} }
  setStatus(t('panel.wsApplied', 'สลับเวิร์กสเปซ: ') + (b ? b.label : name));
  return true;
}

// ───────── [alpha.66r3] ระบบจัดการพื้นที่ (Space Management) ─────────
// สเปกข้อ 1–2: ซ่อนแผงทั้งหมดให้เหลือแต่ Canvas · ซ่อนเฉพาะฝั่งใดฝั่งหนึ่ง
// ทำด้วย "ธง hidden ในต้นไม้" ไม่ใช่ CSS ล้วน — เพื่อให้สัดส่วน/สล็อตอยู่ครบตอนเรียกกลับ
// (บทเรียนข้อ 21 ของ alpha.62: ตัดโหนดออกจากต้นไม้ = เสียทั้งตำแหน่งและขนาด)
let _stash = null;                             // { ids:[], mode:'all'|'left'|'right' }
export function panelsHidden() { return !!_stash; }
export function hiddenMode() { return _stash ? _stash.mode : ''; }

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
  if (_stash) {
    const was = _stash;
    const ids = was.ids;
    _stash = null;
    // ใช้ showPanel/hidePanel "ของโมดูลนี้" ไม่ใช่ของ manager ตรง ๆ — สองตัวนี้จำ/คืน "ที่เดิม"
    // (แผงที่ลอยอยู่ตอนถูกซ่อน ต้องกลับไปลอยที่พิกัดเดิม ไม่ใช่ถูกผนึกมั่วตามค่าเริ่มต้น)
    for (const id of ids) { try { showPanel(id); } catch {} }
    renderPanels(true);
    if (onShowHook) for (const id of ids) { try { onShowHook(id); } catch {} }
    setStatus(t('panel.spaceRestored', 'คืนแผงที่ซ่อนไว้แล้ว'));
    if (was.mode === mode) return false;                    // กดปุ่มเดิมซ้ำ = แค่คืนสภาพ
  }
  const ids = visibleClosable(mode === 'all' ? null : mode);
  if (!ids.length) { setStatus(t('panel.spaceNone', 'ไม่มีแผงให้ซ่อนแล้ว')); return false; }
  for (const id of ids) { try { hidePanel(id, true); } catch {} }     // force: ข้ามกล่องยืนยันของแผง
  _stash = { ids, mode };
  renderPanels(true);
  setStatus(mode === 'all' ? t('panel.spaceAll', 'ซ่อนแผงทั้งหมด — เหลือแต่พื้นที่เขียน (กดซ้ำเพื่อเรียกกลับ)')
                           : t('panel.spaceSide', 'ซ่อนแผงฝั่ง') + (mode === 'right' ? 'ขวา' : 'ซ้าย'));
  return true;
}

// ───────── วาด ─────────
function renderOpts() {
  for (const d of PANEL_DEFS) {                 // รีเฟรชชื่อตามภาษาปัจจุบัน
    const m = meta.get(d.id) || {};
    meta.set(d.id, { ...m, title: titleOf(d), desc: panelDesc(d.id) });
  }
  return {
    meta,
    host: host(),
    headExtras: (id) => extras.get(id) || [],
    // [alpha.67] ปุ่ม 🖥 บนหัวแผง — โผล่เฉพาะแผงที่ฉีกออกเป็นหน้าต่างจริงได้
    canTearOff,
    onTearOff: (id) => tearOffPanel(id),
    // [alpha.66r3] คำสั่งจัดการพื้นที่ที่อยู่หลังปุ่ม ☰ ของทุกแผง (Progressive Disclosure)
    extraHeadMenu: (id) => [
      { label: '⬒ ซ่อนแผงทั้งหมด (เหลือแต่พื้นที่เขียน)', click: () => toggleSpace('all') },
      { label: '⬓ ซ่อนแผงฝั่งนี้', click: () => toggleSpace(sideOf({ id, defaultSide: 'left' })) },
      { label: '🗂 เวิร์กสเปซ…', click: () => workspaceMenu() },
    ],
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
    const target = elByPath(el2, snap[0] ? snap[0].path : null) || null;
    if (target && (target.scrollTop || target.scrollLeft)) continue;   // ยังอยู่ดี ไม่ต้องแตะ
    try { restoreScrollSnap(() => document.querySelector(sel), snap)(); } catch {}
  }
}
/** ล้างความจำตำแหน่งเลื่อน (เปลี่ยนโปรเจกต์ = เนื้อคนละชุดแล้ว) */
export function resetScrollMemo() { scrollMemo.clear(); }

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
    const used = kids.reduce((a, e) => {
      const r = e.getBoundingClientRect();
      return a + (row ? r.width : r.height);
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
      log('warn', `[แผง] พบช่องว่างค้าง ${Math.round(gap)}px ใน dock ${dockEl.dataset.dockId} (${dockEl.dataset.dir}) — ปิดรูให้แล้ว`, detail);
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
  log('warn', '[แผง] พบแผงปลอมในเลย์เอาต์ (ไม่มีในทะเบียน) — เก็บกวาดให้แล้ว', ghosts);
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
  restoreScroll(saved);
  // ตรวจ "ช่องว่างค้าง" หลัง layout เสร็จจริง (rAF) แล้วปิดรูให้ทันทีถ้าเจอ
  try { requestAnimationFrame(() => auditPanelGaps()); } catch {}
  // เนื้อแผงที่ไม่ได้ถูกวาง → เก็บกลับที่พัก (ต้องอยู่ใน DOM เสมอ ไม่งั้น $('#props-body') คืน null)
  const h = host(), holder = srcHolder();
  for (const [, node] of adopted) if (!h.contains(node)) holder.appendChild(node);
  scheduleRemember();                  // [ข้อ 8] จดตำแหน่ง+สัดส่วนล่าสุดของแผงที่เปิดอยู่
  if (_onLayoutChange) _onLayoutChange();
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

function trayEl(side) {
  const id = side === 'right' ? 'k-min-tray-r' : 'k-min-tray-l';
  let tray = document.getElementById(id);
  if (!tray) { tray = el('div', 'k-min-tray'); tray.id = id; document.body.appendChild(tray); }
  return tray;
}

function syncMinTray() {
  rememberSides();
  const closed = PANEL_DEFS.filter((d) => d.closable !== false && !pm.isOpen(d.id));
  const want = new Map(closed.map((d) => [d.id, sideOf(d)]));
  for (const side of ['left', 'right']) {
    const tray = trayEl(side);
    // chip ที่ไม่ควรอยู่ถาดนี้แล้ว (เปิดแผงกลับ หรือย้ายไปอีกฝั่ง) → เอาออก
    for (const chip of [...tray.children]) if (want.get(chip.dataset.key) !== side) chip.remove();
    for (const d of closed) {
      if (want.get(d.id) !== side) continue;
      const old = tray.querySelector(`[data-key="${d.id}"]`);
      // [alpha.67] แผงที่ถูกฉีกไปหน้าต่างแยกก็ "ปิด" ในสายตาของ manager เหมือนกัน
      // แต่ต้องไม่ให้เปิดซ้ำในหน้าต่างนี้ — chip เปลี่ยนเป็นปุ่ม "เรียกกลับจากหน้าต่างแยก" แทน
      const away = tornOff.has(d.id);
      if (old) { if (!!old.dataset.away === away) continue; old.remove(); }
      const chip = el('div', 'k-min-chip' + (away ? ' k-min-chip-away' : ''),
                      (away ? '🖥 ' : '▣ ') + titleOf(d));
      chip.dataset.key = d.id;
      if (away) {
        chip.dataset.away = '1';
        chip.title = t('panel.trayRecall', 'อยู่ในหน้าต่างแยก — คลิกเพื่อเรียกกลับเข้าหน้าต่างนี้');
        chip.onclick = () => recallPanel(d.id);
      } else {
        chip.title = t('panel.trayRestorePre', 'คลิกเพื่อเรียกแผง "') + titleOf(d) + t('panel.trayRestorePost', '" กลับมา');
        // กลับไป "ที่เดิม" ที่จดไว้ — ถ้ายังไม่เคยมีที่อยู่เลยก็ลอยกลางจอ (ไม่ไปเบียดใคร)
        // [alpha.66r11] แผงที่ที่เดิมเป็น "แผงลอย/กลุ่มลอย" ต้องไม่ถูกยัด `side` — ไม่งั้น showPanel
        // ตกไปสายผนึกทันที (อาการ: แผงที่เคยลอย พอเรียกกลับจากถาด กลายเป็นผนึกข้างจอ)
        chip.onclick = () => {
          const h = homes.get(d.id);
          showPanel(d.id, (h && !h.float && !h.floatWith) ? { side: sideOf(d) } : { prefer: 'float' });
        };
      }
      tray.appendChild(chip);
    }
    tray.classList.toggle('on', !!tray.children.length);
  }
}

// ───────── เริ่มระบบ ─────────
export function initPanelSystem() {
  const m = getPanelManager();
  if (started) { renderPanels(true); return m; }
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
    m.store.update(PL.dockPanel(m.store.root, anchor, 'right', PL.panel('docs', 'เอกสาร')));
  }
  m.store.onChange(() => { savePanelLayout(); renderPanels(); });
  onLanguageChanged(() => renderPanels(true));  // เปลี่ยนภาษา → ชื่อแผงเปลี่ยนตาม
  bindTearOffSync();                            // [alpha.67] ปิดหน้าต่างแผง → เอาแผงกลับที่เดิม
  renderPanels(true);
  return m;
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
  try { localStorage.setItem(HOME_KEY, JSON.stringify(Object.fromEntries(homes))); } catch {}
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
  const w = Math.min(d.floatW || Math.max(340, Math.round((d.dockW || 300) * 1.1)), Math.round(W * 0.8));
  const h = Math.min(d.floatH || 520, Math.round(H * 0.8));
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
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

export function showPanel(id, opts = {}) {
  const m = getPanelManager();
  const pid = panelId(id);
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
    log('info', '[แผง] ส่งออกการจัดวางแผงแล้ว', { dest, warnings: report.diagnostics.warnings.length });
    setStatus(t('panel.exported', 'ส่งออกการจัดวางแผงแล้ว: ') + dest);
    return dest;
  } catch (e) {
    // ไม่มีกล่องบันทึกไฟล์ (เทส/เบราว์เซอร์) → อย่างน้อยให้ค่าไปทางคลิปบอร์ด
    try { await kapi.clipboardWrite(json); setStatus(t('panel.exportClip', 'คัดลอกการจัดวางแผงไปคลิปบอร์ดแล้ว')); return 'clipboard'; } catch {}
    log('error', '[แผง] ส่งออกการจัดวางแผงล้มเหลว', e);
    setStatus(t('panel.exportFail', 'ส่งออกการจัดวางแผงไม่สำเร็จ'));
    return null;
  }
}

export function resetPanels() {
  const m = getPanelManager();
  _stash = null;                        // ลืมรายการ "แผงที่ซ่อนไว้ชั่วคราว" ด้วย (เลย์เอาต์ใหม่หมดแล้ว)
  resetPanelHomes();                    // รีเซ็ตทั้งหมด = ลืม "ที่เดิม" ของแผงที่เคยปิดด้วย
  m.store.reset();
  m.store.update(stampDefaultSizes(defaultLayout()));
  renderPanels(true);
  setStatus(t('panel.layoutReset', 'รีเซ็ตการจัดวางแผงแล้ว'));
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
      label: (away ? '🖥 ' : m.isOpen(d.id) ? '☑ ' : '☐ ') + titleOf(d)
             + (away ? t('panel.menuAway', ' (หน้าต่างแยก)') : ''),
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
  const items = [{ label: t('panel.wsPick', '🗂 เวิร์กสเปซ — สลับชุดการจัดวางแผง'), disabled: true }];
  for (const w of listWorkspaces()) {
    items.push({ label: (w.builtIn ? '◻ ' : '▣ ') + w.label, click: () => applyWorkspace(w.name) });
  }
  items.push('-');
  items.push({ label: t('panel.wsSave', '＋ บันทึกการจัดวางตอนนี้เป็นเวิร์กสเปซ…'),
    click: async () => {
      const name = await ask(t('panel.wsName', 'ตั้งชื่อเวิร์กสเปซ'),
                             { placeholder: t('panel.wsNameHint', 'เช่น เขียนตอนเช้า / ตรวจงาน'), okLabel: t('common.save', 'บันทึก') });
      if (!name) return;
      if (isBuiltinWorkspace(name)) { setStatus(t('panel.wsBuiltin', 'ชื่อนี้เป็นชุดสำเร็จรูป ตั้งซ้ำไม่ได้')); return; }
      if (saveWorkspace(name)) setStatus(t('panel.wsSaved', 'บันทึกเวิร์กสเปซแล้ว: ') + name);
    } });
  const mine = listWorkspaces().filter((w) => !w.builtIn);
  if (mine.length) {
    items.push({ label: t('panel.wsDelete', '🗑 ลบเวิร์กสเปซ…'),
      click: () => {
        const r = $('#tb-panels') ? $('#tb-panels').getBoundingClientRect() : { left: 40, bottom: 60 };
        popupMenu(r.left, r.bottom + 4, mine.map((w) => ({
          label: '🗑 ' + w.label,
          click: async () => {
            if (!(await confirmBox(t('panel.wsDelAsk', 'ลบเวิร์กสเปซ “') + w.label + '” ?'))) return;
            deleteWorkspace(w.name);
            setStatus(t('panel.wsDeleted', 'ลบเวิร์กสเปซแล้ว: ') + w.label);
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
  items.push({ label: panelsHidden() ? t('panel.spaceShow', '⬒ คืนแผงที่ซ่อนไว้')
                                     : t('panel.spaceHideAll', '⬒ ซ่อนแผงทั้งหมด (เหลือแต่พื้นที่เขียน)'),
               click: () => toggleSpace('all') });
  items.push({ label: t('panel.spaceHideRight', '⬓ ซ่อนแผงฝั่งขวา'), click: () => toggleSpace('right') });
  items.push({ label: t('panel.spaceHideLeft', '◨ ซ่อนแผงฝั่งซ้าย'), click: () => toggleSpace('left') });
  items.push('-');
  items.push({ label: t('panel.wsMenu', '🗂 เวิร์กสเปซ…'), click: () => workspaceMenu() });
  items.push('-');
  items.push({ label: t('panel.exportLayout', '📤 ส่งออกการจัดวางแผงเป็นไฟล์ JSON…'), click: () => exportPanelLayout() });
  items.push({ label: t('panel.resetAll', '⟲ รีเซ็ตการจัดวางแผงทั้งหมด'), click: () => resetPanels() });
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
    box.append(el('div', 'k-dlg-title', t('panel.manage', '📐 จัดการแผง')));
    for (const it of items) {
      if (it === '-') { box.append(el('hr')); continue; }
      const row = el('div', 'k-menu-item', it.label);
      row.onclick = () => { it.click(); ov.remove(); };
      box.append(row);
    }
    const closeBtn = el('button', 'k-cancel', 'ปิด');
    closeBtn.onclick = () => ov.remove();
    const btns = el('div', 'k-dlg-btns'); btns.append(closeBtn);
    box.append(btns); ov.append(box); document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  }
}

// ───────── cleanup (เปลี่ยนโปรเจกต์) ─────────
export function resetPanelSystem() { lastSig = ''; resetPanelHomes(); resetScrollMemo(); }
/** ลืมตำแหน่งเดิมของแผงที่ถูกปิดไว้ (ทั้งในหน่วยความจำและใน localStorage) */
export function resetPanelHomes() {
  homes.clear();
  try { localStorage.removeItem(HOME_KEY); } catch {}
}
