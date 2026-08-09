// panel-ui.js — Panel System แบบ Photoshop: ทุกพื้นที่ของหน้าต่างคือ "แผง" ที่ dock/tab/float ได้
// เขียนใหม่ทั้งไฟล์ (alpha.46) — แทนที่ระบบแผงลอยเดิมใน app.js (makeFloatablePanel/PANELS)
//
//   initPanelSystem()  → ลงทะเบียนแผงทั้งหมด · กู้เลย์เอาต์ · วาดลง #app-root · auto-save
//   showPanel(id) / hidePanel(id) / togglePanel(id) / resetPanels()
//   addPanelButton(id, el)  → ฝากปุ่มพิเศษไว้บนหัวแผง (โมดูลอื่นเรียก · element เดิมถูกใช้ซ้ำทุก render)
//
// เนื้อแผงคือ element เดิมใน index.html (#tree-panel, #content, …) — "ย้ายเข้า" host เท่านั้น ห้ามสร้างใหม่
// เพราะโค้ดทั้งโปรเจกต์อ้าง id เหล่านี้ ($('#panes'), $('#tabs'), $('#props-body'), …)
import { $, el, setStatus, t, onLanguageChanged } from '../core.js';
import { popupMenu } from '../ui.js';
import * as PL from './panel-layout.js';
import { PanelManager } from './panel-store.js';
import { renderPanelLayout } from './panel-renderer.js';

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
  { id: 'log',       title: 'บันทึก',         icon: 'history',      adopt: '#log-panel',     defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.logTitle',
    desc: 'บันทึกการทำงานของโปรแกรม — ใช้ตอนหาสาเหตุเมื่อมีอะไรไม่เป็นอย่างที่คาด' },
  { id: 'search',    title: 'ค้นหา',          icon: 'search',       adopt: '#search-panel',  defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.searchTitle',
    desc: 'ค้นข้อความทั้งโปรเจกต์ — ทุกฉาก ทุกเล่ม และหน้า Wiki · คลิกผลลัพธ์เพื่อเปิดไฟล์ที่บรรทัดนั้น' },
  { id: 'notes',     title: 'สมุดโน้ตด่วน',    icon: 'note',         adopt: '#notes-panel',   defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.notesTitle',
    desc: 'ที่จดความคิดชั่วคราวโดยไม่ปนต้นฉบับ — โน้ตผูกกับฉากที่เปิดอยู่ตอนจด' },
  { id: 'comments',  title: 'คอมเมนต์',        icon: 'chat',         adopt: '#comments-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.commentsTitle',
    desc: 'คอมเมนต์ของฉากที่เปิดอยู่ — ตอบกลับเป็นเธรด ปิดงานได้ · เก็บท้ายไฟล์ .md จึงติดไปกับไฟล์เสมอ' },
  // ── บั๊ก #18: ฟีเจอร์ที่ไม่ใช่เอกสาร เป็นแผง ไม่ใช่แท็บ ──
  { id: 'dashboard', title: 'แดชบอร์ด',        icon: 'grid',         adopt: '#dash-panel',    defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.dashboardTitle',
    desc: 'ภาพรวมความคืบหน้า — จำนวนคำเทียบเป้าหมาย · สัดส่วนฉากตามสถานะ · ความยาวของแต่ละบท' },
  { id: 'kanban',    title: 'Kanban',          icon: 'grid',         adopt: '#kanban-panel',  defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.kanbanTitle',
    desc: 'กระดานฉากเรียงตามสถานะ — ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะฉากนั้นทันที' },
  { id: 'books',     title: 'จัดการเล่ม',       icon: 'book-content', adopt: '#books-panel',   defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.booksTitle',
    desc: 'จัดการเล่มและฉบับร่าง — ปก · คำโปรย · สถานะ · สถิติรายเล่ม · ลากสลับลำดับเล่ม' },
  { id: 'timeline',  title: 'เส้นเวลา',         icon: 'history',      adopt: '#tl-panel',      defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.timelineTitle',
    desc: 'ลำดับเหตุการณ์ตาม "เวลาในเรื่อง" — สลับมุมมองการ์ด/Gantt ได้ · ฉากที่ตั้ง storyDate ไว้จะขึ้นเอง' },
  { id: 'maps',      title: 'แผนที่',           icon: 'layout',       adopt: '#maps-panel',    defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.mapsTitle',
    desc: 'แผนที่ของโลกในเรื่อง — ปักหมุดบนรูป เชื่อมหมุดเข้ากับฉาก/สถานที่ · หมุดประตูพาลงไปแผนที่ย่อยได้' },
  // [alpha.60r1 ข้อ 21] คลังรูปภาพ — ย้ายจากแท็บเอกสารมาเป็นแผงเหมือนฟีเจอร์อื่น
  { id: 'gallery',   title: 'คลังรูปภาพ',       icon: 'image',        adopt: '#gal-panel',     defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.galleryTitle',
    desc: 'รูปทั้งหมดในโฟลเดอร์ Images ของโปรเจกต์ — ลากลงเอกสารเพื่อแทรก หรือเลือกเป็นปก/รูปประจำตัวใน Wiki' },
  // [alpha.63r] กระดานอารมณ์ — แยกจากคลังรูปเพราะต้อง "ลากรูปมาวาง" ข้ามแผง
  { id: 'gallery-board', title: '🎨 กระดานอารมณ์', icon: 'layout', adopt: '#galboard-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.galleryBoardTitle',
    desc: 'ผืนผ้าใบวางรูปอ้างอิงของแต่ละอัลบั้ม — เปิดคู่กับแผงคลังรูปแล้วลากรูปมาวางได้เลย · ย้าย/ปรับขนาด/ซูมได้อิสระ · เอาออกจากกระดานไม่ลบไฟล์' },
  // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
  { id: 'ai-analyzer', title: '🧠 AI วิเคราะห์',  icon: 'brain',       adopt: '#ai-analyzer-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.aiAnalyzerTitle',
    desc: 'ชุดเครื่องมือวิเคราะห์ต้นฉบับด้วย AI — จังหวะเรื่อง · ส่วนโค้งตัวละคร · คำซ้ำ · ความขัดแย้ง · ความยาวฉาก (ยังเป็นตัวอย่างหน้าตา)' },
  // [alpha.61 ข้อ 2] แชทกับ AI แบบ opencode — เซสชันเก็บใน Sessions/ ของโปรเจกต์
  { id: 'ai-chat',   title: '💬 AI ผู้ช่วยเขียน',       icon: 'chat',        adopt: '#ai-chat-panel', defaultSide: 'right', closable: true, floatable: true, i18n: 'panel.aiChatTitle',
    desc: 'คุยกับ AI เรื่องงานเขียนของคุณ — แยกเป็นเซสชันเหมือน opencode · เลือกโหมด (วางแผน/ช่วยเขียน) · เลือกโมเดล · กำหนดได้ว่าจะให้เห็นข้อมูลระดับไหน (ทั้งโปรเจกต์/เล่ม/บท/ฉาก)' },
  // ── [alpha.62 บั๊ก 16] 3 ฟีเจอร์สุดท้ายที่ยังเป็นแท็บเอกสาร ──
  { id: 'network',   title: 'Story Network',   icon: 'grid',          adopt: '#net-panel',     defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.networkTitle',
    desc: 'ผังความสัมพันธ์ของตัวละคร/สถานที่/สิ่งของ — ลากโหนดจัดวางเอง · สีเส้นบอกประเภทความสัมพันธ์ · ดับเบิลคลิกเปิดหน้า Wiki นั้น' },
  { id: 'planner',   title: 'Planner',         icon: 'grid',         adopt: '#planner-panel', defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.plannerTitle',
    desc: 'กระดานวางแผนแบบการ์ดอิสระ — วางโน้ต รูป และลิงก์ไปฉากได้ทุกที่บนผืนผ้าใบ · ใช้ปะติดปะต่อโครงเรื่องก่อนลงมือเขียน' },
  { id: 'planner-props', title: 'คุณสมบัติ Planner', icon: 'info', adopt: '#planner-props-panel', defaultSide: 'right',
    closable: true, floatable: true, i18n: 'panel.plannerPropsTitle',
    desc: 'คุณสมบัติของการ์ดหรือเส้นเชื่อมที่เลือกบนกระดาน Planner — ชื่อ · สรุป · สี · สถานะ · แท็ก · ขนาด · สไตล์เส้น' },
  { id: 'floorplan', title: '📍 ผังพื้นที่',      icon: 'map',          adopt: '#floor-panel',   defaultSide: 'left',  closable: true, floatable: true, i18n: 'panel.floorplanTitle',
    desc: 'ฉากนี้เกิดที่ไหน — แผนที่ + หมุด "คุณอยู่ที่นี่" + เส้นเวลาของสถานที่นั้น + สิ่งที่เห็น/ได้ยิน/พบ ของฉากที่เปิดอยู่' },
];
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
export const SCROLLABLES = [
  '.pane', '#panes', '.sp-pageview', '.roster-wrap',
  '#tree', '#outline', '#props-body',
  '.k-panel-body', '.k-tab-content', '.k-float-body', '.pane-content',
  '.home-dlg-scroll',
].join(', ');
function captureScroll() {
  const out = [];
  for (const e of document.querySelectorAll(SCROLLABLES)) {
    if (e.scrollTop || e.scrollLeft) out.push([e, e.scrollTop, e.scrollLeft]);
  }
  return out;
}
/**
 * คืนตำแหน่งเลื่อนหลังวาดแผงใหม่
 *
 * ต้องทำสองอย่างที่ขัดกันเองให้ได้พร้อมกัน:
 *   (ก) ตั้งซ้ำหลายรอบ — ตอนใส่ DOM กลับ layout ยังไม่เสร็จ ค่าที่ตั้งจะถูกหนีบให้เตี้ยลง
 *       (เจอจริง: ขอ 210 ได้ 178 เพราะ scrollHeight ยังไม่โต) ต้องตั้งซ้ำจนถึงค่าที่ขอ
 *   (ข) ห้ามลากกลับ — ถ้าโปรแกรม/ผู้ใช้เลื่อนไปที่อื่นระหว่างนั้น การตั้งซ้ำจะดึงกลับมาที่เดิม
 *
 * แยกสองกรณีด้วย "ค่าที่เราเขียนไปครั้งล่าสุด": ค่าปัจจุบันยังเท่ากับของเรา (หรือ 0 = เพิ่งถูกล้าง
 * จากการย้าย DOM) → เป็นของเรา ตั้งต่อได้ · ต่างไปจากนั้น → มีเจ้าของใหม่ หยุดทันที
 */
function restoreScroll(saved) {
  if (!saved.length) return;
  const jobs = saved.map(([e, top, left]) => ({ e, top, left, lastTop: 0, lastLeft: 0, done: false }));
  // [alpha.62 บั๊ก 7] ปิด scroll-behavior:smooth ชั่วคราวตลอดช่วงคืนค่า (บทเรียน 71)
  // ถ้าปล่อยให้เป็นอนิเมชัน `e.scrollTop = n` แล้วอ่านกลับจะได้ค่ากลางทาง →
  // เงื่อนไข "มีคนอื่นเลื่อนไปแล้ว" เป็นจริงตั้งแต่เฟรมที่สอง แล้วเลิกตามทั้งที่ยังไม่ถึงเป้า
  const prevBehavior = jobs.map((j) => j.e.style.scrollBehavior);
  for (const j of jobs) j.e.style.scrollBehavior = 'auto';
  const put = () => {
    for (const j of jobs) {
      if (j.done || !j.e.isConnected) continue;
      const curTop = j.e.scrollTop, curLeft = j.e.scrollLeft;
      if ((curTop !== 0 && curTop !== j.lastTop) || (curLeft !== 0 && curLeft !== j.lastLeft)) {
        j.done = true; continue;                    // มีคนอื่นเลื่อนไปแล้ว — ปล่อยเขาไป
      }
      if (j.top && curTop !== j.top) { j.e.scrollTop = j.top; j.lastTop = j.e.scrollTop; }
      if (j.left && curLeft !== j.left) { j.e.scrollLeft = j.left; j.lastLeft = j.e.scrollLeft; }
      if (j.e.scrollTop === j.top && j.e.scrollLeft === j.left) j.done = true;
    }
  };
  put();
  // บทเรียนข้อ 14i-2: Chromium หยุดยิง rAF เมื่อหน้าต่างถูกบัง → ต้องมี timer สำรองด้วย
  requestAnimationFrame(put);
  // เอกสารยาว ๆ (ProseMirror หลายร้อยย่อหน้า) กว่า layout จะเสร็จใช้เวลาเกิน 60ms บนบางเครื่อง
  // ระหว่างนั้นเบราว์เซอร์หนีบค่าที่ตั้งให้เตี้ยลงตาม scrollHeight ที่ยังไม่โต → ต้องตามไปตั้งอีก
  // (หยุดเองทันทีที่ถึงค่าที่ขอ หรือมีคนอื่นเลื่อนไปที่อื่น)
  for (const ms of [0, 30, 60, 120, 250]) setTimeout(put, ms);
  setTimeout(() => { jobs.forEach((j, i) => { j.e.style.scrollBehavior = prevBehavior[i] || ''; }); }, 260);
}

export function renderPanels(force) {
  if (!pm) return;
  ensureDocsVisible();
  const sig = JSON.stringify({ r: pm.store.root, f: pm.store.floats });
  if (!force && sig === lastSig) return;
  lastSig = sig;
  const saved = captureScroll();
  renderPanelLayout(host(), pm, renderOpts());
  restoreScroll(saved);
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
      if (tray.querySelector(`[data-key="${d.id}"]`)) continue;
      const chip = el('div', 'k-min-chip', '▣ ' + titleOf(d));
      chip.dataset.key = d.id;
      chip.title = t('panel.trayRestorePre', 'คลิกเพื่อเรียกแผง "') + titleOf(d) + t('panel.trayRestorePost', '" กลับมา');
      chip.onclick = () => showPanel(d.id, { side: sideOf(d) });   // กลับไปฝั่งเดิมที่เคยอยู่
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

export function showPanel(id, opts = {}) {
  const m = getPanelManager();
  const pid = panelId(id);
  const def = m.registry.get(pid) || {};
  let ok;
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
    // แผงที่เคยลอยอยู่ → กลับไปลอยที่เดิม (บั๊ก #4)
    if (!opts.side && !opts.targetId && home && home.float) {
      ok = m.floatPanel(pid, home.float);
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
      const ratio = (home && home.ratio > 0) ? home.ratio : m.savedRatio(pid);
      if (ok && ratio > 0) { try { applyRatio(pid, ratio); } catch {} }
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
  if (m.isOpen(pid)) return hidePanel(pid);
  return showPanel(pid, opts);
}
export function resetPanels() {
  const m = getPanelManager();
  resetPanelHomes();                    // รีเซ็ตทั้งหมด = ลืม "ที่เดิม" ของแผงที่เคยปิดด้วย
  m.store.reset();
  m.store.update(defaultLayout());
  renderPanels(true);
  setStatus(t('panel.layoutReset', 'รีเซ็ตการจัดวางแผงแล้ว'));
  return true;
}
/** รายการแผงสำหรับเมนู "มุมมอง → แผง" */
export function panelMenuItems() {
  const m = getPanelManager();
  return PANEL_DEFS.filter((d) => d.closable !== false).map((d) => ({
    label: (m.isOpen(d.id) ? '☑ ' : '☐ ') + titleOf(d),
    click: () => togglePanel(d.id),
  }));
}
/** สถานะเปิด/ปิดของทุกแผง (ส่งให้เมนู native ติ๊กถูก) */
export function panelToggleState() {
  const m = getPanelManager();
  const o = {};
  for (const d of PANEL_DEFS) o[d.id] = m.isOpen(d.id);
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

// ───────── กล่อง "จัดการแผง" (ปุ่ม 📐 บน toolbar / เมนู) ─────────
export async function togglePanelDialog() {
  const items = panelMenuItems();
  items.push('-');
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
export function resetPanelSystem() { lastSig = ''; resetPanelHomes(); }
/** ลืมตำแหน่งเดิมของแผงที่ถูกปิดไว้ (ทั้งในหน่วยความจำและใน localStorage) */
export function resetPanelHomes() {
  homes.clear();
  try { localStorage.removeItem(HOME_KEY); } catch {}
}
