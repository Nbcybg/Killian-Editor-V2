// core.js — รากฐานที่ทุกโมดูลใช้ร่วม: DOM helpers, state, smart, log, constants, i18n, shortcuts
// กฎ: ที่นี่มีเฉพาะสิ่งที่ "แชร์ข้ามไฟล์และไม่ reassign" เท่านั้น
//     ตัวแปร let ที่ reassign (pageScale, autosaveTimer, floatBar, …) อยู่กับฟังก์ชันที่แก้มันในไฟล์ของมันเอง
import { SmartType } from './smart.js';
import { createLogStore, formatLine } from './log-core.js';

// ---- DOM helpers ----
export const $ = (s) => document.querySelector(s);
export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// ───────── จำ/คืน "ตำแหน่งเลื่อน" เวลารื้อ DOM แล้วสร้างใหม่ [alpha.66r2 ข้อ 1] ─────────
// ปัญหาที่แก้: ทั้งโปรเจกต์มี `innerHTML=''` / `replaceChildren()` เกือบร้อยจุด — รื้อแล้วสร้างใหม่
// ทีไร กล่องที่เลื่อนอยู่ก็เด้งกลับบนสุดทุกครั้ง (ทั้งตอน "รีเฟรชแผง" และตอน "ขยับแผง")
//
// กุญแจสำคัญ: **ห้ามจำเป็น element reference อย่างเดียว** เพราะตัวที่เลื่อนอยู่มักถูกสร้างใหม่
// (เช่น `.k-panel-body` ที่ตัววาดแผงสร้างใหม่ทุกรอบ) → คืนค่าลงซากที่หลุด DOM ไปแล้ว ไม่มีผลอะไร
// จึงจำเป็น "เส้นทางดัชนีลูก" จากรากที่ยังยึดได้ แล้วไปหา **ใบใหม่ที่ตำแหน่งเดิม** ตอนคืนค่า

/** เส้นทางจาก root ลงมาถึง e เป็นดัชนีลูก (null = e ไม่ได้อยู่ใต้ root) */
export function elPath(root, e) {
  const path = [];
  let n = e;
  while (n && n !== root) {
    const p = n.parentElement;
    if (!p) return null;
    path.unshift(Array.prototype.indexOf.call(p.children, n));
    n = p;
  }
  return n === root ? path : null;
}
/** เดินตามเส้นทางดัชนีลูกจาก root (null = โครงเปลี่ยนไปจนหาไม่เจอ) */
export function elByPath(root, path) {
  let n = root;
  for (const i of path) {
    if (!n || !n.children[i]) return null;
    n = n.children[i];
  }
  return n || null;
}

/**
 * จำตำแหน่งเลื่อนของทุกกล่องใต้ `root` แล้วคืนฟังก์ชัน `restore()`
 * `root` เป็น element หรือฟังก์ชันคืน element ก็ได้ (ใช้แบบหลังเมื่อ root เองก็ถูกสร้างใหม่)
 *
 *   const back = keepScroll(box);  box.innerHTML = '';  ...สร้างใหม่...;  back();
 *
 * restore() ตั้งค่าซ้ำหลายรอบ (ทันที · rAF · 0/30/60/120/250ms) เพราะตอนใส่ DOM กลับ
 * layout ยังไม่เสร็จ เบราว์เซอร์จะหนีบค่าที่ตั้งให้เตี้ยลงตาม scrollHeight ที่ยังไม่โต
 * แต่ **หยุดทันทีที่ผู้ใช้/โปรแกรมเลื่อนไปที่อื่นเอง** (ไม่งั้นกลายเป็นล็อกจอไว้)
 */
/** อ่านตำแหน่งเลื่อนของทุกกล่องใต้ root เป็นก้อนข้อมูล (ใช้ซ้ำ/เก็บไว้ใช้ทีหลังได้) */
export function scrollSnapshot(base) {
  const snap = [];
  if (!base) return snap;
  const add = (e) => {
    const top = e.scrollTop, left = e.scrollLeft;
    if (!top && !left) return;
    const path = elPath(base, e);
    if (path) snap.push({ path, top, left });
  };
  add(base);
  for (const e of base.querySelectorAll('*')) add(e);
  return snap;
}

export function keepScroll(root) {
  const get = typeof root === 'function' ? root : () => root;
  const snap = scrollSnapshot(get());
  const fn = restoreScrollSnap(get, snap);
  fn.snap = snap;
  return fn;
}

/** คืนตำแหน่งเลื่อนจากก้อนข้อมูลที่จำไว้ (แยกจาก keepScroll เพื่อให้ "เล่นซ้ำ" ทีหลังได้) */
export function restoreScrollSnap(root, snap) {
  const get = typeof root === 'function' ? root : () => root;
  return function restore() {
    if (!snap || !snap.length) return 0;
    const jobs = snap.map((s) => ({ path: s.path, top: s.top, left: s.left,
                                    el: null, prev: '', wrote: false, lastTop: 0, lastLeft: 0, done: false }));
    const put = () => {
      const r = get();
      if (!r) return;
      for (const j of jobs) {
        if (j.done) continue;
        const e = (j.el && j.el.isConnected) ? j.el : elByPath(r, j.path);
        if (!e) continue;                                   // ยังสร้างไม่เสร็จ — รอรอบถัดไป
        if (j.el !== e) {
          j.el = e; j.wrote = false;
          // scroll-behavior:smooth ทำให้ `e.scrollTop = n` กลายเป็นอนิเมชัน แล้วอ่านกลับได้ค่ากลางทาง
          // → เงื่อนไข "มีคนอื่นเลื่อนไปแล้ว" เป็นจริงผิด ๆ ตั้งแต่รอบสอง (บทเรียน 71)
          j.prev = e.style.scrollBehavior;
          e.style.scrollBehavior = 'auto';
        }
        const ct = e.scrollTop, cl = e.scrollLeft;
        if (j.wrote && ((ct && ct !== j.lastTop) || (cl && cl !== j.lastLeft))) { j.done = true; continue; }
        if (j.top && ct !== j.top) e.scrollTop = j.top;
        if (j.left && cl !== j.left) e.scrollLeft = j.left;
        j.lastTop = e.scrollTop; j.lastLeft = e.scrollLeft; j.wrote = true;
        if ((!j.top || e.scrollTop === j.top) && (!j.left || e.scrollLeft === j.left)) j.done = true;
      }
    };
    put();
    // rAF ไม่ยิงเมื่อหน้าต่างถูกบัง (บทเรียน 14i-2) → มี timer สำรองเสมอ
    try { requestAnimationFrame(put); } catch {}
    for (const ms of [0, 30, 60, 120, 250]) setTimeout(put, ms);
    setTimeout(() => { for (const j of jobs) if (j.el) j.el.style.scrollBehavior = j.prev || ''; }, 300);
    return jobs.length;
  };
}

// ---- state กลางของทั้งแอป (object — mutate ได้ผ่าน import binding, ไม่ reassign) ----
export const state = { root: null, title: '', tabs: new Map(), active: null,
                       meta: null, settings: {}, goals: {}, compareFile: null };

// ---- [alpha.67] หน้าต่างนี้เป็น "หน้าต่างแผงที่ฉีกออกมา" หรือเปล่า ----
// ค่าเป็น id ของแผงที่หน้าต่างนี้ถือ ('' = หน้าต่างหลัก) — main ใส่มาให้ทาง query string
// ทุกที่ที่เขียนสถานะ "ระดับโปรแกรม" (เลย์เอาต์แผง · แท็บที่เปิด · autosave · สำรองไฟล์)
// ต้องเช็คค่านี้ก่อน ไม่งั้นหน้าต่างลูกจะเขียนทับของหน้าต่างหลัก (localStorage เป็น origin เดียวกัน)
export const PANEL_WIN = (() => {
  try { return new URLSearchParams(location.search).get('panelwin') || ''; } catch { return ''; }
})();
export function isPanelWindow() { return !!PANEL_WIN; }

// ---- SmartType (auto-mention / spellcheck names) ----
export const smart = new SmartType();

// ---------------- ระบบบันทึกการทำงาน (log) ----------------
// เก็บ buffer ในหน่วยความจำ (สำหรับ viewer) + append ลงไฟล์ <userData>/logs/app-<วันที่>.log
// [alpha.72 ข้อ 5] เก็บเป็น "ระเบียน" มีชั้นข้อมูลจริง (log-core.js) — แผงบันทึกจึงกรอง/ค้น/นับได้
// LOG_BUF ยังเป็น array ของสตริงเหมือนเดิม เพื่อไม่ให้โค้ดเก่าที่อ่านมันพัง
export const LOG_BUF = [];
const LOG_MAX = 2000;                                // กัน buffer โตไม่จำกัด
// เก็บ console ตัวจริงไว้ก่อนห่อ — ต้องประกาศเหนือ log() ไม่งั้นชน TDZ ถ้ามีใครเรียก log ระหว่างโหลดโมดูล
const RAW_CONSOLE = { error: console.error.bind(console), warn: console.warn.bind(console) };
export const logStore = createLogStore(LOG_MAX);
/** ผู้ฟังการเปลี่ยนแปลงของ log (แผงบันทึกใช้วาดใหม่แบบทันที ไม่ต้องรอ timer 2 วินาที) */
const logSubs = new Set();
export function onLog(fn) { logSubs.add(fn); return () => logSubs.delete(fn); }

export function log(level, msg, extra) {
  const ts = new Date().toISOString();
  const rec = logStore.push(level, msg, extra, ts);
  const line = formatLine(rec);
  LOG_BUF.push(line);
  if (LOG_BUF.length > LOG_MAX) LOG_BUF.shift();
  try { kapi.logWrite && kapi.logWrite(line); } catch {}
  if (rec.level === 'error' || rec.level === 'warn') {
    // console เดิมถูกห่อไว้ด้านล่าง → ใช้ตัวจริงที่เก็บไว้ ไม่งั้นวนกลับเข้า log() ไม่รู้จบ
    (rec.level === 'error' ? RAW_CONSOLE.error : RAW_CONSOLE.warn)(line);
  }
  for (const fn of logSubs) { try { fn(rec); } catch {} }
  return line;
}
/** จดว่า "ผู้ใช้/โปรแกรมทำอะไร" — ใช้ไล่ย้อนได้ว่าก่อนพังมีอะไรเกิดขึ้นบ้าง */
export function logAction(source, what, detail) { return log('info', source + ': ' + what, detail); }

// ---- ดักข้อผิดพลาดทุกทางให้ลง log จริง ๆ (เดิมบางทางหายเงียบ) ----
window.addEventListener('error', (e) => {
  // benign ResizeObserver error — Chromium fires this when layout is busy, ignore
  if (e.message && e.message.includes('ResizeObserver')) return;
  log('error', 'window.onerror: ' + (e.message || ''),
      e.error || (e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined));
});
window.addEventListener('unhandledrejection', (e) => {
  log('error', 'unhandledrejection', e.reason);
});
// โหลดทรัพยากรไม่สำเร็จ (รูป/สคริปต์/สไตล์) — ไม่ยิง window.onerror แบบปกติ ต้องดักตอน capture
window.addEventListener('error', (e) => {
  const t = e.target;
  if (!t || t === window || !t.tagName) return;
  const src = t.src || t.href || '';
  if (!src) return;
  log('warn', tt('ui.core.resourceLoadNotOk2') + String(t.tagName).toLowerCase() + '>', src);
}, true);
// [alpha.72 ข้อ 5] console.error/warn ที่โมดูลอื่นเรียกตรง ๆ เคยหายไปจากแผงบันทึกทั้งหมด
// (เช่น `console.error('SN refresh error:', ...)` ใน network.js) → ห่อให้ไหลเข้า log ด้วย
for (const lv of ['error', 'warn']) {
  const raw = RAW_CONSOLE[lv];
  console[lv] = (...args) => {
    raw(...args);
    try {
      const first = args.find((a) => typeof a === 'string');
      const errArg = args.find((a) => a instanceof Error);
      const rest = args.filter((a) => a !== first);
      logStore.push(lv, 'console: ' + (first || tt('ui.core.notHasText2')),
                    errArg || (rest.length ? rest : undefined), new Date().toISOString());
      for (const fn of logSubs) { try { fn(null); } catch {} }
    } catch {}
  };
}

// ---- แถบสถานะล่าง ----
export function setStatus(s) { $('#status').textContent = s; }

// ---------------- [alpha.62 บั๊ก 9+10] ตัวบอก "กำลังทำอะไรอยู่" ที่แถบสถานะล่าง ----------------
// เดิมเป็นหน้าจอ loading เต็มจอ (#k-loader, z-index 999) — มันทับ "กล่องบันทึกก่อนปิด" (k-overlay z-index 80)
// จนคลิกปุ่มไม่ได้เลย ผู้ใช้ต้อง force quit → ตัดหน้าจอนั้นทิ้ง แล้วรายงานที่แถบสถานะแทน
// หลักการ: **ห้ามบล็อกอะไรทั้งสิ้น** — เป็นแค่ข้อความ + สปินเนอร์เล็ก ๆ มุมซ้ายล่าง
//   setBusy(msg)  — ข้อความล่าสุดชนะ (เรียกซ้อนได้ เหมือน showLoader เดิมที่เรียกหลายรอบ)
//   clearBusy()   — ล้างทั้งหมด · busyMsg() — อ่านข้อความปัจจุบัน (เทสใช้)
//   withBusy(msg, fn) — ครอบงานยาว ๆ · finally เสมอ ต่อให้ fn โยน error ก็ไม่ค้าง
let _busyMsg = '';
export function setBusy(msg) {
  _busyMsg = msg == null ? '' : String(msg);
  const wrap = $('#status-busy');
  if (!wrap) return _busyMsg;                        // หน้า HTML เก่า/เทสหน่วย → เงียบ ๆ ไม่พัง
  const txt = $('#status-busy-text');
  if (txt) txt.textContent = _busyMsg;
  wrap.style.display = _busyMsg ? 'inline-flex' : 'none';
  return _busyMsg;
}
export function clearBusy() { return setBusy(''); }
export function busyMsg() { return _busyMsg; }
export async function withBusy(msg, fn) {
  setBusy(msg);
  try { return await fn(); }
  finally { clearBusy(); }
}

// ---- ค่าตั้งต้น settings/goals (โครงเดียวกับ v1 — เก็บครบใน project.khn.json) ----
// [alpha.60 ข้อ 94] แยกเป็น 2 ระดับ:
//   global (user) — เก็บใน %APPDATA%/Killian2/settings.json · ใช้ร่วมกันทุกโปรเจกต์
//   project      — เก็บใน project.khn.json · ต่อโปรเจกต์
// ══ [alpha.137] ธีมของโปรแกรม — **แหล่งความจริงเดียว** ══
// กล่องตั้งค่า (ตั้งค่า → ทั่วไป → ธีมสี) · เมนู มุมมอง · applyTheme() อ่านจากรายการนี้ทั้งหมด
// เพิ่มธีมใหม่ = เพิ่มที่นี่ + เขียน `body.theme-<id>` ใน style.css + เพิ่มคีย์ป้ายใน CSV
// ห้ามให้ธีมแตะ --paper-* (กฎเหล็ก: ธีมเปลี่ยนเฉพาะเปลือกโปรแกรม ไม่แตะหน้ากระดาษ)
//
// [alpha.138] ผู้ใช้สั่งเลิกธีม dark/light ของเดิม — เหลือจานสีประจำโปรแกรมสองเฉด
// และ **ไม่มีปุ่มบนแถบ ไม่มีคีย์ลัด** อีกแล้ว (เลือกจาก dropdown ในตั้งค่าอย่างเดียว)
export const THEMES = ['k2', 'k2-light'];
export const THEME_LABEL_KEYS = {
  k2: 'ui.settings.themeK2', 'k2-light': 'ui.settings.themeK2Light',
};
/** ค่าเก่าที่เคยบันทึกไว้ในไฟล์โปรเจกต์/ตั้งค่าผู้ใช้ → ธีมที่ใช้แทน (ห้ามลบ ไม่งั้นของเก่าตกไปค่าเริ่มต้นเงียบ ๆ) */
export const THEME_ALIAS = { dark: 'k2', light: 'k2-light' };

export const GLOBAL_DEFAULTS = {
  autoSaveMinutes: 5, maxBackups: 10, autoBackup: true, lineNumbers: false,
  // [alpha.60r2 ข้อ 9] ปุ่มลอยมุมขวาล่าง — ปิดได้ (บางคนบอกว่ามันบังงาน)
  fabEnabled: true,
  // [alpha.111] คำสั่งบนปุ่มลอย (สูงสุด 4) + รูปแบบการแสดง · null = ใช้ชุดเริ่มต้นใน fab-config.js
  fab: null,
  // [alpha.111] ปุ่มที่ถูกถอดออกจากแถบรูปแบบลอย แยกตามโหมด { prose:{hidden:{}}, screenplay:{hidden:{}} }
  fmtbar: null,
  // [alpha.60r2 ข้อ 10] ธีมของโปรแกรม — Ctrl+Shift+P วนธีม (ดู THEMES ด้านล่าง)
  // (คนละเรื่องกับ paperMode ซึ่งเป็น "หน้าตาของกระดาษ" ไม่ใช่ของ UI)
  // [alpha.137] ค่าเริ่มต้น = 'k2' — จานสีประจำโปรแกรมที่ผู้ใช้กำหนด
  theme: 'k2',
  uiFontSize: 0, uiScale: 1, spellCheck: true, spellCheckDict: true, autoMention: true, recycleDays: 30,
  paperMode: true, fontFamily: '', language: 'th', spFontFamily: '',
  // [alpha.100 ข้อ 4] สีกระดาษ — เลือกเองได้ (พรีเซ็ต/สีใดก็ได้) · '' = ค่าเริ่มต้น (ขาว)
  // เก็บระดับผู้ใช้เพราะเป็นความสบายตาของคนอ่านจอ ไม่ใช่รูปแบบของผลงาน
  // (ตอนพิมพ์/ส่งออก PDF ยังขาวเสมอ — ดู @media print และ pdf-generator.js)
  paperColor: '',
  // [alpha.100 ข้อ 2] เส้นประบอกระยะขอบกระดาษในมุมมองจัดหน้า — ครบสี่ด้านทุกแผ่น · เริ่มต้นปิด
  pageGuides: false,
  autoSync: false, thesaurus: false, focusDim: 0.3,
  // [alpha.132 ข้อ 9] จานสีตัวอักษรของผู้ใช้ — { saved:[รหัสสี], recent:[รหัสสี] } (ค่า global)
  textColors: { saved: [], recent: [] },
  // [alpha.60r2 ข้อ 4] เสียงพิมพ์ดีด — เดิมต้องเปิดสองสวิตช์ (typeSound + typeSoundAlways)
  // ผู้ใช้เปิด "เสียงพิมพ์ดีด" แล้วเงียบสนิท เพราะ typeSoundAlways ค่าเริ่มต้นเป็น false
  // ตอนนี้เป็นสวิตช์เดียว + โหมด: 'always' = ดังตลอด (ค่าเริ่มต้น) · 'typewriter' = เฉพาะโหมดเครื่องพิมพ์ดีด
  typeSound: false, typeSoundVolume: 0.5, typeSoundMode: 'always',
  typeSoundAlways: true,           // (เก่า — เก็บไว้ให้โปรเจกต์รุ่นก่อนอ่านได้ ค่าใหม่อยู่ที่ typeSoundMode)
  homeThumb: 190, smartLearnMin: 2, heavyDocBlocks: 400, mdAlignStyle: 'frontmatter',
  // ปุ่มลัดตั้งเอง — อยู่กับผู้ใช้
  shortcuts: {},
  // [alpha.61 ข้อ 1] ลำดับเปิดโปรแกรม: หน้าต่างรอโหลด → เข้าโปรแกรม → (เปิดโปรเจกต์ล่าสุด | หน้าแรก)
  //   openLastProject = true  → เปิดโปรเจกต์ล่าสุดทันที "ข้ามหน้าแรก" (สลับที่ เมนูไฟล์)
  //   showHomeOnStartup = true → บังคับให้เห็นหน้าแรกเสมอ แม้เปิดโปรเจกต์ล่าสุดไว้ (สลับที่ เมนูมุมมอง)
  //   ทั้งคู่ปิด (ค่าเริ่มต้น) → เข้าหน้าแรกก่อน แล้วผู้ใช้เลือกโปรเจกต์เอง
  openLastProject: false,
  showHomeOnStartup: false,
  // [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (. @ > $shot # …) ในตัวแก้ไขนิยาย — เปิดไว้เป็นค่าเริ่มต้น
  showMarkdownCodes: true,
  // [alpha.135] อัปเดตโปรแกรม (ระดับผู้ใช้ — ไม่ผูกกับผลงานชิ้นไหน)
  //   updateCheck   = ตรวจให้อัตโนมัติ "ก่อนเข้าโปรแกรม" (ปิดได้ในตั้งค่า → อัตโนมัติ)
  //   updateSkip    = รุ่นที่ผู้ใช้กด "ข้ามรุ่นนี้" ไว้ — จะไม่ถามซ้ำจนกว่าจะมีรุ่นใหม่กว่านั้น
  //   updateLast    = เวลาที่ตรวจสำเร็จครั้งล่าสุด (ms) · updateLastVersion = รุ่นที่เจอครั้งนั้น
  updateCheck: true, updateSkip: '', updateLast: 0, updateLastVersion: '',
};
export const PROJECT_DEFAULTS = {
  // หน้ากระดาษ
  paperSize: 'letter', customPaper: { width: 8.5, height: 11 },
  pageMargins: { top: 1, bottom: 1, left: 1.5, right: 1 },
  // ขนาดฟอนต์เอกสาร (pt)
  edFontPt: 12, spFontPt: 12,
  // รูปแบบบทภาพยนตร์
  spElements: null, spStyles: null, spPageRules: null, spStrings: null,
  spCycle: null, spCycleKeys: null, spCycleEnabled: true,
  // [alpha.78] บรรทัดถัดจาก "บทพูด" โดยไม่มีบรรทัดว่างคั่น = อะไร
  //   false (ค่าเริ่มต้น · แนว Final Draft) = บรรยาย — เขียนเปล่า ๆ ได้เลย ไม่ต้องมี `!` นำหน้า
  //   true  (แนว fountain) = บทพูดบรรทัดถัดไป — บรรยายต้องเขียน `!` บังคับ
  // เป็นกฎที่ผู้ใช้ตั้งเอง (ตั้งค่า → การเขียน) ไม่ใช่ค่าที่โค้ดเดาแทน
  spDialogueContinues: false,
  // [alpha.61 ข้อ 4] "ให้อิสระเรื่องตัวพิมพ์" — ทั้งสามตัวนี้คือจุดที่บทหนังเคยบังคับ case
  //   spForceCase      = บังคับ ALL-CAPS ตามรูปแบบบทมาตรฐาน (หัวฉาก · ชื่อตัวละคร · ทรานซิชัน)
  //   spAutoCapitalize = แก้ตัวแรกของประโยคเป็นตัวใหญ่ให้อัตโนมัติขณะพิมพ์
  //   spAutoCorrectI   = แก้ i เดี่ยว ๆ เป็น I ให้อัตโนมัติ
  // ค่าเริ่มต้นยังเป็นธรรมเนียมเดิม แต่ตอนนี้ปิดได้ครบทั้งสามตัวจากหน้าตั้งค่า/เมนู "บท"
  spForceCase: true,
  spAutoCapitalize: true, spAutoCorrectI: true,
  spShowFormat: false, spCheckBeforeExport: true, spLineLimits: null,
  // [alpha.127] เส้นขอบเหลือง/แดงบนบล็อกที่ตัวตรวจบทแจ้ง — เปิดเป็นค่าเริ่มต้น (พฤติกรรมเดิม .124)
  spErrorMarks: true,
  spSceneNumbers: null, spPageNumbers: null,
  spContinued: null, spLineHeight: 1, spPageGap: 28,
  // รูปแบบนิยาย (prose)
  prose: null,
  // ฟอนต์ตามภาษา
  langFonts: null,
  // [alpha.60 ข้อ 96] ปรับหน้าใหม่อัตโนมัติ (debounce)
  spAutoPaginate: false,
  spPaginateInterval: 30,   // วินาที (1-60)
  // [alpha.60r ข้อ 2] จำแท็บที่เปิดค้างไว้ — restore ตอนเปิดโปรเจกต์ครั้งต่อไป
  openTabs: null,           // [filePath, ...] — null = ยังไม่เคยบันทึก
  // Story Network — สีที่ผู้ใช้ปรับเองได้
  netColors: null,          // [alpha.73] { '<คีย์จาก NET_COLOR_DEFS>': '#xxxxxx' } (รับรูปแบบเก่า cats/edges ได้)
  netControls: null,        // { orbitButton:'middle'|'right'|'left', panButton:… } — ห้ามฮาร์ดโค้ดปุ่มเมาส์
  // [alpha.69] ประวัติการทำงาน — เก็บย้อนหลังกี่ครั้ง (ยิ่งมาก ยิ่งกินที่ใน .k2history/)
  // ค่าเริ่มต้น 32 ตามที่ผู้ใช้กำหนด · หนีบช่วง 4–500 ที่ history-data.clampLimit
  historyLimit: 32,
  historyOff: false,        // true = ปิดการจดประวัติทั้งโปรเจกต์
  // [alpha.140] แผง Navigation — ผู้ใช้เลือกได้ว่าจะเลื่อนยาวหรือแบ่งหน้า และหน้าละกี่แถว
  //   'scroll' = รายการเดียวเลื่อนยาว (ค่าเริ่มต้น · พฤติกรรมเดิม)
  //   'page'   = แบ่งหน้า มีปุ่มหน้าก่อน/ถัดไปที่ท้ายแผง
  navMode: 'scroll',
  navPerPage: 50,           // หนีบช่วง 5–500 ที่ nav-model.clampPerPage
};
// รวมเป็น DEFAULT_SETTINGS — ให้โค้ดที่ใช้อยู่ไม่พัง (ยังอ้าง key ชื่อเดิมทุกตัว)
export const DEFAULT_SETTINGS = { ...GLOBAL_DEFAULTS, ...PROJECT_DEFAULTS };
export const DEFAULT_GOALS = { dailyWords: 500, projectWords: 50000 };
// ตารางควบคุม Tab/Enter/Shift+Tab ในบทหนัง — ผู้ใช้ปรับได้ในตั้งค่า
export const DEFAULT_SP_CYCLE = {
  scene:         { enter: 'action',    tab: 'action',    shiftTab: 'transition' },
  action:        { enter: 'scene',     tab: 'character', shiftTab: 'scene' },
  character:     { enter: 'dialogue',  tab: 'parenthetical', shiftTab: 'action' },
  parenthetical: { enter: 'dialogue',  tab: 'dialogue',  shiftTab: 'character' },
  dialogue:      { enter: 'character', tab: 'parenthetical', shiftTab: 'parenthetical' },
  transition:    { enter: 'scene',     tab: 'scene',     shiftTab: 'dialogue' },
  'transition-in': { enter: 'scene',   tab: 'scene',     shiftTab: 'action' },
  subheader:     { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  intercut:      { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  shot:          { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  'act-break':   { enter: 'action',    tab: 'action',    shiftTab: 'transition' },
  note:          { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  summary:       { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  outline1:      { enter: 'outline2',  tab: 'action',    shiftTab: 'scene' },
  outline2:      { enter: 'outline3',  tab: 'action',    shiftTab: 'scene' },
  outline3:      { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  image:         { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
  raw:           { enter: 'action',    tab: 'action',    shiftTab: 'scene' },
};

// [แก้ไข feature 1] ปุ่มที่ใช้สลับ element ในบทหนัง — ผู้ใช้เปลี่ยนได้ ไม่ผูกกับ Tab/Enter/Shift+Tab
// เก็บเป็น e.code (ปุ่มกายภาพ) ตามหลัก "คีย์ลัดทำงานทุกแป้นพิมพ์"
//
// [alpha.61 ข้อ 3] ค่าเริ่มต้นของ "เลือกหมวด" ย้ายจาก Tab → **Ctrl+Tab / Ctrl+Shift+Tab**
// เหตุผล: Tab เปล่าเป็นปุ่มพื้นฐานของตัวแก้ไข (เยื้องข้อความ) การยึดไว้ทำให้บทหนัง
// "ไม่มี Tab" ทั้งโหมด — และการสลับ element ยังกดได้อีกทางที่ Ctrl+↑/↓ อยู่แล้ว
// ผู้ใช้ที่ชินแบบ Final Draft ตั้งกลับเป็น Tab เปล่าได้ที่ ตั้งค่า → การเขียน
export const DEFAULT_SP_CYCLE_KEYS = {
  enter:    { code: 'Enter', shift: false, ctrl: false, alt: false },
  tab:      { code: 'Tab',   shift: false, ctrl: true,  alt: false },
  shiftTab: { code: 'Tab',   shift: true,  ctrl: true,  alt: false },
};
/** ปุ่มที่ใช้จริง = ค่าเริ่มต้น merge กับที่ผู้ใช้ตั้ง */
export function spCycleKeys(settings) {
  const u = (settings || state.settings || {}).spCycleKeys || {};
  const out = {};
  for (const k of ['enter', 'tab', 'shiftTab']) out[k] = { ...DEFAULT_SP_CYCLE_KEYS[k], ...(u[k] || {}) };
  return out;
}
/** อีเวนต์คีย์บอร์ดตรงกับปุ่มที่ผูกไว้ไหม */
export function spKeyMatch(b, ev) {
  if (!b || !ev) return false;
  return ev.code === b.code && !!ev.shiftKey === !!b.shift &&
         !!(ev.ctrlKey || ev.metaKey) === !!b.ctrl && !!ev.altKey === !!b.alt;
}
/** ข้อความแสดงปุ่ม — "Shift+Tab", "Ctrl+Enter" */
export function spKeyLabel(b) {
  if (!b || !b.code) return '—';
  const p = [];
  if (b.ctrl) p.push('Ctrl');
  if (b.alt) p.push('Alt');
  if (b.shift) p.push('Shift');
  p.push(String(b.code).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num'));
  return p.join('+');
}
// 1pt = 4/3 px (CSS) — บทภาพยนตร์/ต้นฉบับนิยายใช้ 12pt เป็นมาตรฐานทุกภาษา
export const PT_PX = 4 / 3;
export const ptToPx = (pt) => +(((parseFloat(pt) || 12) * PT_PX).toFixed(2));
export const BASE_ED_FS = ptToPx(12); // 16px = 12pt (ตรงกับ .ProseMirror ใน style.css)
export const BASE_SP_FS = ptToPx(12); // 16px = 12pt (ตรงกับ .sp ใน style.css)
// ฟอนต์มาตรฐานของเนื้อเรื่อง — Courier Final Draft ทุกภาษา (มี fallback ให้เครื่องที่ยังไม่ลงฟอนต์)
// Courier Prime มาก่อน — ฝังมากับโปรแกรมแล้ว (renderer/assets/fonts) จึงได้หน้าตาเดียวกันทุกเครื่อง
// "Courier Final Draft" ไว้ให้เครื่องที่ลงฟอนต์นั้นเองใช้ · ไทยตกไป TH Sarabun New/Sarabun
//
// [alpha.60r3a] เดิมสรุปว่า **Ayuthaya วางมาร์กถูก** จึงเอาไว้ต้นลูกโซ่
//
// ══ [alpha.144] ★ กลับด้าน — **Ayuthaya คือตัวที่ทำให้วรรณยุกต์ลอย** ══
// วัดจริงบนเครื่อง (แคนวาส 80px · ระยะท้องวรรณยุกต์ถึงหัวพยัญชนะของ `ท` + `่`):
//   CourierThaiMono 3 · Tahoma 2 · TH Sarabun New 6 · Thonburi 7 · Sarabun 8 · **Ayuthaya 28**
// บทเรียน 48 ที่โทษ CourierThaiMono ก็ผิด — มันแน่นที่สุดในกลุ่ม
// → **Thonburi นำ** (ฟอนต์ระบบ macOS เหมือนกัน) · Windows ตกไป Leelawadee UI ตามเดิม
export const THAI_FONT_STACK = '"Thonburi", "Leelawadee UI", "TH Sarabun New", "Sarabun"';
export const DEFAULT_SCRIPT_FONT =
  '"Courier Prime", "Courier Final Draft", "Courier New", ' + THAI_FONT_STACK + ', monospace';
// ซูมหน้ากระดาษ = ย่อ/ขยาย "ทั้งหน้า" ด้วย CSS zoom (ฟอนต์+ระยะขอบ+ความกว้าง ไปพร้อมกัน)
export const SCALE_MIN = 0.5, SCALE_MAX = 2.5;
// ขนาด UI (แถบเครื่องมือ/แผง/กล่อง) — คนละตัวกับซูมหน้ากระดาษ
export const UI_SCALE_MIN = 0.75, UI_SCALE_MAX = 2.0;

// ---- ค่าคงที่ที่หลายโมดูลใช้ร่วม (pure — ไม่มี dependency) ----
/* i18n-skip: ค่าที่เขียนลง scenes.json แล้วอ่านกลับด้วยค่าเดิม — แปลตอนวาดด้วย dataLabel()
   [alpha.132] ย้ายจากช่วงเลขบรรทัดใน i18n-classify.cjs มาเป็นเครื่องหมายในซอร์ส (กฎ alpha.116
   ข้อ 6) — ของเดิมพังทันทีที่มีใครแทรกบรรทัดเหนือขึ้นไป ซึ่งเกิดขึ้นจริงในรอบนี้ */
export const SCENE_STATUSES = ['โครงร่าง', 'กำลังเขียน', 'เขียนเสร็จ', 'ตรวจแล้ว', 'เก็บถาวร'];
export const SCENE_COLORS = [
  ['แดง', '#d9575e'], ['ส้ม', '#d97757'], ['เหลือง', '#d9b757'],
  ['เขียว', '#6fae6f'], ['ฟ้า', '#5f9fd9'], ['ม่วง', '#a97fd0'],
];
// สีประจำสถานะมาตรฐาน (สถานะที่ผู้ใช้เพิ่มเองเก็บสีไว้ที่ meta.customStatusColors — ดู custom-status.js)
export const STATUS_COLORS = {
  'โครงร่าง': '#8a8f98', 'กำลังเขียน': '#d97757', 'เขียนเสร็จ': '#5f9fd9',
  'ตรวจแล้ว': '#6fae6f', 'เก็บถาวร': '#a97fd0',
};
/* /i18n-skip */
export const DEFAULT_STATUS_COLOR = '#8a8f98';
/**
 * ป้ายสำหรับ "ค่าที่เก็บในไฟล์งาน" (สถานะฉาก · ชื่อสี) — [alpha.76 · ปรับคีย์ .77]
 *
 * ค่าพวกนี้แปลตรง ๆ ไม่ได้ เพราะถูกเขียนลง scenes.json แล้วอ่านกลับด้วยค่าเดิม
 * **เก็บเป็นภาษาไทยเสมอ แปลเฉพาะตอนวาดบนจอ** ผ่านตารางจับคู่ค่า→คีย์ข้างล่างนี้
 * ค่าที่ผู้ใช้ตั้งเอง (custom-status) ไม่อยู่ในตาราง = โชว์ตามที่ผู้ใช้พิมพ์ ซึ่งถูกแล้ว
 */
const DATA_KEYS = {
  'โครงร่าง': 'ui.data.stOutline', 'กำลังเขียน': 'ui.data.stWriting', 'เขียนเสร็จ': 'ui.data.stDone',
  'ตรวจแล้ว': 'ui.data.stChecked', 'เก็บถาวร': 'ui.data.stArchived',
  'แดง': 'ui.data.cRed', 'ส้ม': 'ui.data.cOrange', 'เหลือง': 'ui.data.cYellow',
  'เขียว': 'ui.data.cGreen', 'ฟ้า': 'ui.data.cBlue', 'ม่วง': 'ui.data.cPurple',
};
export function dataLabel(v) {
  if (v == null || v === '') return '';
  const k = DATA_KEYS[v];
  return k ? t(k) : String(v);
}
export const BUILTIN_CATS = ['characters', 'locations', 'items', 'lore'];
export const CAT_ICON = { characters: 'user', locations: 'map', items: 'briefcase', lore: 'bookmark' };
// ตัวแปลงตัวเลขที่ปลอดภัยกับค่า 0 (กฎ 20) — แหล่งความจริงเดียวของทั้งโปรเจกต์
// โมดูลบริสุทธิ์ import จาก './num.js' ตรง ๆ (core.js แตะ DOM จึง import กลับมาไม่ได้)
export { num, numClamp, numInt } from './num.js';
// ประเภทความสัมพันธ์ (ครอบครัว/คนรัก/ศัตรู…) — โมดูลบริสุทธิ์ ส่งต่อจาก relationship-types.js
// เพื่อให้ feature module ดึงจาก core.js ที่เดียวเหมือนค่าคงที่ตัวอื่น
export { REL_TYPES, REL_COLOR, REL_ICON, REL_LABEL, categorizeRole, categorizeWith } from './relationship-types.js';
// รูปแบบบทภาพยนตร์ระดับใช้งานจริง (ข้อ 81–85, 92, 97) — โมดูลบริสุทธิ์ ส่งต่อจาก sp-format.js
export { PAPER_SIZES, MARGIN_DEFAULTS, SP_ELEMENT_CONFIG, SP_ELEMENT_STYLES, SP_ELEMENT_KEYS,
         PAGE_BREAK_RULES, SP_STRINGS, DEFAULT_SP_FORMAT, mergeSpFormat, pageCssVars, spCss,
         linesPerPage, formatLines, lineHeightIn, clampLineHeight,
         textWidth, wrapLines, paginate, pageCount, splitText, annotateContinued,
         // [alpha.104r] ความกว้างที่ element ถูกวาดจริง (หนีบไม่ให้ล้นพื้นที่พิมพ์)
         elementWidthIn, displayText,
         newRoster, normalizeRoster, rosterToText, ROSTER_VERSION,
         SCENE_NUMBER_DEFAULTS, PAGE_NUMBER_DEFAULTS, CONTINUED_DEFAULTS, sceneNumberOffsets, pageNumberLabel,
         // [alpha.62 บั๊ก 11] ตัวพิมพ์ใหญ่รายชนิด element
         CAPS_ELEMENTS, elementCaps, setElementCaps } from './sp-format.js';
// ฟอนต์ตามภาษา (alpha.57a ข้อ 5) — โมดูลบริสุทธิ์ ส่งต่อจาก lang-fonts.js
export { LANG_FAMILY, SCRIPT_PRESETS, BUILTIN_FONT_FILES, SYSTEM_THAI_FONTS, defaultLangFonts, normalizeLangFonts,
         normalizeRange, cssFamilyName, isUsable as isLangFontUsable, buildLangFontCss,
         withLangFamily, applyLangFonts,
         // [alpha.84 ข้อ 1] ตัวปรับสัดส่วนฟอนต์ไทยของบทภาพยนตร์
         SP_FAMILY, FONT_TARGETS, rowTarget, rowAppliesTo, familyList, withFamily,
         withSpFamily, usableCounts, migrateSpThai,
         // [alpha.144] ตาข่ายรองอักษรไทยท้ายสแตก (กันวรรณยุกต์ลอยเมื่อฟอนต์ที่เลือกไม่มีไทย)
         THAI_SAFE_FALLBACKS, withThaiFallback,
         SP_THAI_RANGE, SP_THAI_FALLBACKS, SP_THAI_FALLBACKS_LEGACY,
         SP_THAI_SIZE } from './lang-fonts.js';

// ---- ระบบภาษา (i18n) ----
// เอนจินจริงอยู่ `src/i18n.js` (บริสุทธิ์ · โมดูลที่ import core ไม่ได้ก็ใช้ได้) — ตรงนี้เหลือแค่
// ส่วนที่ต้องแตะ DOM/kapi: โหลดไฟล์, applyDataI18n, ฮุกอัปเดต UI
import { t as tt, T, t, tf, tm, tKey, lookup as i18nLookup, setTable, fillTable, csvToTable, tableToCsv,
         langInfo, langCatalog, setCatalog, langCodeFromFile, langFileName, fallbackLangName,
         getTable, formatMsg, makeMsgid, LANG_LS_KEY } from './i18n.js';
import { unflatten } from './i18n-csv.js';
export { T, t, tf, tm, tKey, tableToCsv, csvToTable, langInfo, langCodeFromFile, langFileName, fallbackLangName,
         formatMsg, makeMsgid, LANG_LS_KEY };
/** รายชื่อภาษาที่สแกนเจอ (อ่านจาก **ชื่อไฟล์** k2_*.csv) */
export function languageCatalog() { return langCatalog; }

export const i18n = { lang: 'en', strings: {}, fallback: null, available: ['en'] };
// ตาราง CSV ถูกโหลดไปแล้วแบบ sync ตอน import src/i18n.js — เก็บผลนั้นเข้า i18n ให้โค้ดเดิมเห็นตรงกัน
if (langInfo.code) {
  i18n.lang = langInfo.code;
  i18n.available = langCatalog.length ? langCatalog.map((l) => l.code) : [langInfo.code];
  syncNestedStrings();
}

// ฮุก: หลังจากเปลี่ยนภาษาเสร็จ → ให้โมดูลอื่นลงทะเบียน callback (ex. applyToolbarShortcutTitles)
const langHooks = [];
export function onLanguageChanged(fn) { langHooks.push(fn); }

// [alpha.77] ไม่มีตาราง EN ฝังในโค้ดอีกแล้ว และ **ไม่มีการตกกลับข้ามภาษา**
// ไฟล์ภาษาต้องครบทุกแถว (เทส test/i18n-keys.test.cjs เป็นคนบังคับ) · คีย์ไหนขาด = โชว์คีย์ให้เห็น
// t/tf ตัวจริงอยู่ src/i18n.js — ที่นี่แค่ re-export ให้โค้ดเดิมที่ import จาก core.js ใช้ได้เหมือนเดิม

// ลำดับที่ค้นหาไฟล์ภาษาแบบเก่า (.json) — เก็บไว้อ่านโปรเจกต์เดิมที่ผู้ใช้เคยแปลไว้เอง
async function langCandidates(lang, root) {
  const out = [];
  if (typeof kapi === 'undefined') return out;
  if (root) out.push(await kapi.join(root, 'languages', lang + '.json'));
  let appDir = '';
  try { appDir = await kapi.appDir(); } catch {}
  if (appDir) {
    out.push(await kapi.join(appDir, 'languages', lang + '.json'));
    out.push(await kapi.join(appDir, 'renderer', 'languages', lang + '.json'));
  }
  return out;
}

/**
 * อัปเดต i18n.strings (รูปซ้อนแบบเดิม) ให้โค้ดเก่าที่อ่านตรง ๆ ยังใช้ได้
 * เอาเฉพาะคีย์ที่เป็น dot-path จริง ๆ — คีย์แบบ msgid (ประโยคไทย) ไม่ต้องแตกเป็นต้นไม้
 */
function syncNestedStrings() {
  try {
    const flat = getTable(), pick = {};
    for (const k of Object.keys(flat)) if (/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(k)) pick[k] = flat[k];
    i18n.strings = unflatten(pick);
  } catch { i18n.strings = {}; }
}

/** สแกนภาษาที่มีในเครื่อง (อ่านรหัสจากชื่อไฟล์ k2_*.csv) แล้วอัปเดตทะเบียน */
export async function scanLanguages(root) {
  try {
    if (typeof kapi !== 'undefined' && kapi.langList) {
      const list = await kapi.langList(root || '');
      if (Array.isArray(list) && list.length) {
        setCatalog(list);
        i18n.available = list.map((l) => l.code);
        return list;
      }
    }
  } catch {}
  return langCatalog;
}

// โหลดไฟล์ภาษา: CSV (k2_<code>.csv ทุกชั้น) → ถ้าไม่มีเลยลอง .json แบบเก่า → ท้ายสุด built-in EN
export async function loadLanguage(lang, root) {
  i18n.lang = lang || 'en';
  let ok = false;
  try {
    if (typeof kapi !== 'undefined' && kapi.langRead) {
      const csv = await kapi.langRead(i18n.lang, root || '');
      if (csv && csv.trim()) { setTable(csvToTable(csv), i18n.lang); ok = true; }
    }
  } catch {}
  // ---- ของเดิม: ไฟล์ .json (โปรเจกต์เก่า) — เอามาเติมคีย์ที่ CSV ไม่มี ----
  try {
    for (const langPath of await langCandidates(i18n.lang, root)) {
      if (await kapi.exists(langPath)) {
        const json = await kapi.readJson(langPath);
        const flat = {};
        (function walk(o, p) {
          for (const k of Object.keys(o || {})) {
            const v = o[k], key = p ? p + '.' + k : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key);
            else if (typeof v === 'string') flat[key] = v;
          }
        })(json, '');
        if (ok) fillTable(flat); else { setTable(flat, i18n.lang); ok = true; }
        break;
      }
    }
  } catch {}
  if (!ok) {
    // ไม่มีไฟล์ภาษาเลย — เตือนแล้วปล่อยให้ t() คืนตัวคีย์ (เห็นชัดว่าไฟล์ภาษาหาย)
    if (i18n.lang !== 'en') setStatus(tm(tt('ui.core.notFoundLangUse2'), i18n.lang));
    setTable({}, 'en');
    i18n.lang = 'en';
  }
  try { await scanLanguages(root); } catch {}
  if (!i18n.available.length) i18n.available = [i18n.lang];
  try { globalThis.localStorage?.setItem(LANG_LS_KEY, i18n.lang); } catch {}
  syncNestedStrings();
  applyDataI18n();
  for (const fn of langHooks) fn();
  return true;
}

// แทนข้อความ data-i18n ทั้งเอกสาร
//
// [alpha.116 ข้อ 6] เพิ่ม `data-i18n-title` — **คีย์แยกสำหรับ tooltip**
// เดิมมีแต่ `data-i18n` + `data-i18n-attr` ซึ่งเลือกได้อย่างเดียวว่าจะแปล "ข้อความ" หรือ
// "attribute หนึ่งตัว" · ปุ่มบนแถบเครื่องมือส่วนใหญ่ต้องการทั้งคู่ (บางตัวมีข้อความด้วย)
// ผลคือ tooltip ไทยกว่า 70 จุดใน index.html ไม่เคยผ่านระบบภาษาเลยมาตลอด
export function applyDataI18n() {
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    const text = t(key);
    if (text != null) el.setAttribute('title', text);
  });
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      let text = t(key);
      if (text == null) { el.removeAttribute('data-i18n-applied'); return; }
      // ถ้ามี data-i18n-attr → ใส่ลง attribute นั้นแทน textContent
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) { el.setAttribute(attr, text); }
      else if (el.querySelector('*')) {
        // มี element ลูกอยู่ (ex. ปุ่มควบคุมบนหัวแผง) — แทนเฉพาะ text node ห้ามล้างลูก
        const texts = [...el.childNodes].filter((n) => n.nodeType === 3);
        if (texts.length) { texts[0].nodeValue = text; for (let i = 1; i < texts.length; i++) texts[i].nodeValue = ''; }
        else el.insertBefore(document.createTextNode(text), el.firstChild);
      }
      else { el.textContent = text; }
      el.setAttribute('data-i18n-applied', '1');
    }
  });
}

// ---- คีย์ลัด (ย้ายจาก app.js → core.js) ----
//
// [alpha.79] **ช่องที่สองรับ Alt ได้แล้ว** — เดิมเป็น boolean ล้วน (`true` = ต้องกด Ctrl)
// ตอนนี้ใส่ `'ctrl+alt'` ได้ด้วย ทำให้มีพื้นที่ว่างอีกชุดใหญ่สำหรับ "สวิตช์แผง"
// (Ctrl / Ctrl+Shift เต็มไปด้วยคำสั่งจัดรูปแบบจนไม่เหลือที่แล้ว)
//   · รูปเดิม `true` / `false` ยังใช้ได้ทุกประการ — `!!needCtrl` ยังเป็น true สำหรับสตริง
//   · `shortcutId()` ยังตัดจากดัชนี 3 เหมือนเดิม → ปุ่มลัดที่ผู้ใช้ตั้งเองไม่กระทบ
//
// **หมายเหตุแป้นพิมพ์**: บนแป้นพิมพ์ยุโรปบางแบบ AltGr = Ctrl+Alt — ถ้าใครใช้แป้นแบบนั้น
// ให้ตั้งใหม่ได้ที่ ตั้งค่า → ปุ่มลัด (ทุกรายการในตารางนี้ตั้งเองได้หมด)
export const SHORTCUTS = [
  // [code, needCtrl, needShift, channel, ...args]   · needCtrl: true | false | 'ctrl+alt'
  ['KeyS', true, false, 'save'],
  ['KeyS', true, true, 'save-as'],
  ['KeyN', true, false, 'new-project'],
  ['KeyO', true, false, 'open-project'],
  ['KeyP', true, false, 'print'],
  ['KeyW', true, false, 'close-tab'],
  ['KeyW', true, true, 'close-all-tabs'],
  ['KeyF', true, false, 'find'],
  ['Comma', true, false, 'settings'],
  // [alpha.81 ข้อ 9] Ctrl+Shift+E = "ศูนย์รวมการส่งออก" (เดิมเปิดกล่องเวิร์กโฟลว์ตรง ๆ)
  // กล่องเวิร์กโฟลว์ยังอยู่ — เข้าจากปุ่ม "ปรับขั้นตอน…" ในศูนย์รวม
  ['KeyE', true, true, 'export-hub'],
  ['KeyZ', true, false, 'editor-undo'],
  ['KeyZ', true, true, 'editor-redo'],
  ['KeyY', true, false, 'editor-redo'],
  ['KeyB', true, false, 'fmt', 'bold'],
  ['KeyI', true, false, 'fmt', 'italic'],
  ['KeyU', true, false, 'fmt', 'underline'],
  ['KeyX', true, true, 'fmt', 'strike'],
  // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — เลียนแบบ Word (Ctrl+Shift+= / Ctrl+=) แต่ต้องเติม Alt
  // เพราะตัวดักซูมหน้ากระดาษกิน Ctrl+= / Ctrl+- ไปแล้วโดยไม่ดูปุ่ม Shift (มันเช็คแค่ Alt)
  ['Equal', 'ctrl+alt', false, 'fmt', 'sup'],
  ['Minus', 'ctrl+alt', false, 'fmt', 'sub'],
  ['Digit1', true, false, 'fmt', 'heading', 1],
  ['Digit2', true, false, 'fmt', 'heading', 2],
  ['Digit3', true, false, 'fmt', 'heading', 3],
  ['Digit0', true, false, 'fmt', 'paragraph'],
  ['Digit8', true, true, 'fmt', 'ul'],
  ['Digit7', true, true, 'fmt', 'ol'],
  ['Space', true, false, 'fmt', 'clear'],
  ['KeyL', true, true, 'fmt', 'align', 'left'],
  ['KeyK', true, true, 'fmt', 'align', 'center'],
  ['KeyR', true, true, 'fmt', 'align', 'right'],
  ['KeyJ', true, true, 'fmt', 'align', 'justify'],
  ['KeyM', true, true, 'toggle-format'],
  // [alpha.138] Ctrl+Shift+P (สลับธีม) ถูกถอดตามคำสั่งผู้ใช้ — ธีมย้ายไปอยู่ในตั้งค่าอย่างเดียว
  ['KeyF', true, true, 'global-search'],
  ['KeyD', true, true, 'focus-mode'],
  ['KeyO', true, true, 'quick-open'],
  ['KeyT', true, true, 'typewriter'],
  ['KeyB', true, true, 'export-blog'],
  ['Backslash', true, true, 'split-view'],
  ['KeyK', true, false, 'kanban'],
  // [alpha.61 ข้อ 3] ลบทั้งบรรทัด — Ctrl+Shift+K ไม่ว่าง (จัดกึ่งกลาง) จึงใช้ Ctrl+Shift+Delete
  ['Delete', true, true, 'delete-line'],
  ['KeyG', true, true, 'gallery'],
  // [95] Per-element shortcuts — Ctrl+4..9 (Ctrl+1/2/3 จัดการใน handleCommand)
  ['Digit4', true, false, 'sp-element', 'parenthetical'],
  ['Digit5', true, false, 'sp-element', 'dialogue'],
  ['Digit6', true, false, 'sp-element', 'transition'],
  ['Digit7', true, false, 'sp-element', 'shot'],
  ['Digit8', true, false, 'sp-element', 'act-break'],
  ['Digit9', true, false, 'sp-element', 'note'],
  // [79] เลือกทั้งฉาก
  ['KeyA', true, true, 'select-scene'],
  // [77] Non-breaking space
  ['Space', true, true, 'nbsp'],
  // [78] ไปที่หน้า/ฉาก · [54] ตรวจหาข้อผิดพลาดถัดไป (alpha.57)
  ['KeyG', true, false, 'goto'],
  ['KeyU', true, true, 'sp-find-error'],
  // [alpha.58r ข้อ 4] คอนโซลนักพัฒนา — Ctrl+Shift+` (ไม่ชนกับ DevTools ของ Chromium)
  ['Backquote', true, true, 'dev-console'],
  // [alpha.66r3] จัดการพื้นที่แบบ Photoshop — Tab/Shift+Tab ใช้ไม่ได้ (Tab สงวนให้ SmartType)
  // Ctrl+\ = ซ่อนแผงทั้งหมด (Ctrl+Shift+\ ไม่ว่าง — เป็นแยกจอ)
  // [alpha.124 ข้อ 6] **สลับให้ตรงทิศ**: `[` ชี้ซ้าย = ซ่อนฝั่งซ้าย · `]` ชี้ขวา = ซ่อนฝั่งขวา
  // เดิมกลับด้านกันมาตั้งแต่ .66r3 (เลือกตามคีย์ที่ว่าง ไม่ได้เลือกตามความหมาย) — ผู้ใช้กดผิดทุกครั้ง
  ['Backslash', true, false, 'panels-hide-all'],
  ['BracketLeft', true, true, 'panels-hide-left'],
  // เวิร์กสเปซ — Ctrl+Shift+Y (ว่าง)
  ['KeyY', true, true, 'workspace-menu'],

  // ═══════════ [alpha.79] ชุดใหญ่ที่ขาดไป ═══════════
  // ── คำสั่งเอกสาร (Ctrl+Shift) ──
  ['KeyI', true, true, 'insert-image'],
  ['KeyQ', true, true, 'quick-note'],
  ['KeyH', true, true, 'reading-mode'],
  ['KeyN', true, true, 'new-from-template'],
  ['Period', true, true, 'goto-page'],
  ['Comma', true, true, 'goto-scene'],
  ['BracketRight', true, true, 'panels-hide-right'],  // คู่กับ Ctrl+Shift+[ (ซ่อนฝั่งซ้าย)
  ['KeyR', 'ctrl+alt', false, 'line-numbers'],
  // ── สร้างของใหม่ (Ctrl+Alt+ตัวเลข) ──
  ['Digit1', 'ctrl+alt', false, 'chapter'],
  ['Digit2', 'ctrl+alt', false, 'scene'],
  ['Digit3', 'ctrl+alt', false, 'character'],
  ['Digit4', 'ctrl+alt', false, 'location'],
  ['Digit5', 'ctrl+alt', false, 'memo'],
  // [alpha.111] เรียกแถบรูปแบบลอยมาที่เคอร์เซอร์ (Ctrl+Shift+/)
  ['Slash', true, true, 'fmtbar-here'],
  // [alpha.117] สภาพของแถบรูปแบบลอย — วางไว้ติดกันบนแป้นพิมพ์กับ Ctrl+Shift+/ ให้จำเป็นชุด
  ['Quote', true, true, 'fmtbar-opacity'],
  ['Semicolon', true, true, 'fmtbar-align'],
  ['Equal', true, true, 'fmtbar-lock'],
  // ── บันทึกทั้งหมด — เดิมเป็นตัวดักคีย์แยกที่ตั้งใหม่ไม่ได้ ตอนนี้อยู่ในตารางแล้ว ──
  ['KeyS', 'ctrl+alt', false, 'save-all'],
  // [alpha.124 ข้อ 7] "ปรับขั้นตอนส่งออก" มีชื่อใน SHORTCUT_LABELS มาตลอด แต่ไม่เคยมีแถวในตาราง
  // → หน้า ตั้งค่า → ปุ่มลัด ไม่เคยแสดงรายการนี้เลย และตั้งเองก็ไม่ได้
  ['KeyX', 'ctrl+alt', false, 'compile'],
  // [alpha.124 ข้อ 3] ตารางคีย์ลัด (Cheatsheet) — เดิมผูก listener เองที่ Ctrl+Shift+/
  // ซึ่ง **ชนกับ `fmtbar-here`** แล้วยิงทั้งคู่ · `?` เปล่า ๆ ยังเปิดได้เหมือนเดิม
  ['Slash', 'ctrl+alt', false, 'cheatsheet'],
  // [alpha.124 ข้อ 36] หมุนรูปตัวพิมพ์ของช่วงที่เลือก (Sentence → lower → UPPER → …)
  ['KeyU', 'ctrl+alt', false, 'text-case-cycle'],
  // ══ [alpha.125 ข้อ G · ข้อ H] Ctrl+Alt+Shift — ชั้นที่ยังว่างทั้งชั้น ══
  //
  // Ctrl+Alt+<ตัวอักษร> ถูกใช้ครบทั้ง 26 ตัวแล้วตั้งแต่ alpha.124 (แผงมี 29 ตัว)
  // ชั้นถัดไปที่ยังว่างสนิทคือเติม Shift เข้าไป — ตัวจับคีย์รองรับอยู่แล้ว
  // (`needsAlt(needCtrl) === e.altKey` + เทียบ `needShift` แยก) และ `formatShortcut`
  // ก็แสดงเป็น `Ctrl+Alt+Shift+B` ได้ถูกต้องอยู่แล้ว
  ['KeyB', 'ctrl+alt', true, 'toggle-panel', 'backlinks'],
  ['KeyT', 'ctrl+alt', true, 'thesaurus'],
  ['KeyI', 'ctrl+alt', true, 'import-scrivener'],
  // [alpha.141] จัดการบท (คู่กับ Ctrl+Alt+K = จัดการเล่ม) · อ่านทั้งเล่ม
  ['KeyK', 'ctrl+alt', true, 'toggle-panel', 'chapters'],
  ['KeyR', 'ctrl+alt', true, 'read-book'],
  // ── สวิตช์แผง (Ctrl+Alt+ตัวอักษร) — กดซ้ำ = ปิด ──
  ['KeyD', 'ctrl+alt', false, 'toggle-panel', 'dashboard'],
  ['KeyT', 'ctrl+alt', false, 'toggle-panel', 'timeline'],
  ['KeyM', 'ctrl+alt', false, 'toggle-panel', 'maps'],
  ['KeyN', 'ctrl+alt', false, 'toggle-panel', 'network'],
  ['KeyP', 'ctrl+alt', false, 'toggle-panel', 'planner'],
  ['KeyB', 'ctrl+alt', false, 'toggle-panel', 'branch'],
  ['KeyK', 'ctrl+alt', false, 'toggle-panel', 'books'],
  ['KeyC', 'ctrl+alt', false, 'toggle-panel', 'codex'],
  ['KeyH', 'ctrl+alt', false, 'toggle-panel', 'history'],
  ['KeyJ', 'ctrl+alt', false, 'toggle-panel', 'record'],
  ['KeyG', 'ctrl+alt', false, 'toggle-panel', 'gallery-board'],
  ['KeyF', 'ctrl+alt', false, 'toggle-panel', 'floorplan'],
  ['KeyY', 'ctrl+alt', false, 'toggle-panel', 'player'],
  ['KeyA', 'ctrl+alt', false, 'toggle-panel', 'ai-analyzer'],
  ['KeyO', 'ctrl+alt', false, 'toggle-panel', 'comments'],
  ['KeyI', 'ctrl+alt', false, 'toggle-panel', 'props'],
  // [alpha.79] แผงใหม่สองตัวของรอบนี้
  ['KeyL', 'ctrl+alt', false, 'toggle-panel', 'dialogue'],
  ['KeyE', 'ctrl+alt', false, 'toggle-panel', 'plugins'],
  // ══ [alpha.116 ข้อ 7] ★ ปิดช่องว่างของตารางคีย์ลัด ══
  //
  // ผู้ใช้: *"เช็ค shortcut มีครบมั้ย"* — กวาดแล้วพบว่า **9 แผงไม่มีคีย์ลัดเลย**
  // ทั้งที่แผงอื่นมีครบ (แผงที่มาทีหลังทุกตัวถูกลืม: ห้องซ้อมบท · Story Starter · แชท AI
  //  และแผงพื้นฐานที่มีมาแต่ต้นอย่าง โครงเรื่อง/สารบัญ/บันทึก/ประวัติการบันทึก/ค้นหา)
  //
  // ประตูกันพลาดอยู่ที่ `test/shortcuts.test.cjs` — แผงที่ปิดได้ทุกตัวต้องมีคีย์ลัด
  // หรือไม่ก็ต้องประกาศเหตุผลไว้ใน SHORTCUT_PANEL_SKIP ลืมเมื่อไหร่เทสแดงตั้งแต่ build
  ['KeyQ', 'ctrl+alt', false, 'toggle-panel', 'ai-hub'],
  ['KeyW', 'ctrl+alt', false, 'toggle-panel', 'ai-chat'],
  ['KeyV', 'ctrl+alt', false, 'toggle-panel', 'dlgb'],
  ['KeyZ', 'ctrl+alt', false, 'toggle-panel', 'starter'],
  ['Digit6', 'ctrl+alt', false, 'toggle-panel', 'tree'],
  ['Digit7', 'ctrl+alt', false, 'toggle-panel', 'outline'],
  ['Digit8', 'ctrl+alt', false, 'toggle-panel', 'notes'],
  ['Digit9', 'ctrl+alt', false, 'toggle-panel', 'log'],
  ['Digit0', 'ctrl+alt', false, 'toggle-panel', 'search'],
];

/**
 * [alpha.116 ข้อ 7] แผงที่ **จงใจ** ไม่มีคีย์ลัดของตัวเอง — ต้องมีเหตุผลกำกับเสมอ
 * (เดียวกับ `MENU_PANELS_SKIP` ใน main.js — ไม่ปล่อยให้อะไรหายเงียบ ๆ)
 */
export const SHORTCUT_PANEL_SKIP = {
  // เหตุผลเป็นข้อความของนักพัฒนา (โผล่ในผลเทสเท่านั้น ไม่ขึ้นหน้าจอ) จึงไม่ผ่านระบบภาษา
  'planner-props': 'companion panel of Planner — opened by Planner itself',
  kanban: 'has its own command shortcut (Ctrl+K)',
  gallery: 'has its own command shortcut (Ctrl+Shift+G)',
};

export const shortcutId = (s) => s.slice(3).join(':');

export const SHORTCUT_LABELS = {
  'save': 'shortcuts.save', 'save-as': 'shortcuts.saveAs', 'new-project': 'shortcuts.newProject',
  'open-project': 'shortcuts.openProject', 'print': 'shortcuts.print', 'close-tab': 'shortcuts.closeTab',
  'find': 'shortcuts.find', 'settings': 'shortcuts.settings', 'editor-undo': 'shortcuts.undo', 'editor-redo': 'shortcuts.redo',
  'fmt:bold': 'shortcuts.bold', 'fmt:italic': 'shortcuts.italic', 'fmt:underline': 'shortcuts.underline', 'fmt:strike': 'shortcuts.strikethrough',
  'fmt:sup': 'shortcuts.superscript', 'fmt:sub': 'shortcuts.subscript',
  'fmt:heading:1': 'shortcuts.heading1', 'fmt:heading:2': 'shortcuts.heading2', 'fmt:heading:3': 'shortcuts.heading3',
  'fmt:paragraph': 'shortcuts.bodyText', 'fmt:ul': 'shortcuts.bulletList', 'fmt:ol': 'shortcuts.numberedList',
  'fmt:clear': 'shortcuts.clearFormatting', 'toggle-format': 'shortcuts.toggleFormat', 'focus-mode': 'shortcuts.focusMode',
  'global-search': 'shortcuts.globalSearch',
  'quick-open': 'shortcuts.quickOpen', 'typewriter': 'shortcuts.typewriter',
  'fmt:align:left': 'shortcuts.alignLeft', 'fmt:align:center': 'shortcuts.alignCenter',
  'fmt:align:right': 'shortcuts.alignRight', 'fmt:align:justify': 'shortcuts.justify',
  'export-hub': 'shortcuts.exportHub', 'compile': 'shortcuts.compile', 'save-all': 'shortcuts.saveAll',
  'split-view': 'shortcuts.splitView', 'kanban': 'shortcuts.kanban',
  'export-blog': 'shortcuts.exportBlog', 'close-all-tabs': 'shortcuts.closeAllTabs',
  'line-numbers': 'shortcuts.lineNumbers',
  'delete-line': 'ui.shortcuts.deleteLine',
  'gallery': 'shortcuts.gallery',
  'cheatsheet': 'ui.shortcuts.cheatsheet',
  'text-case-cycle': 'ui.shortcuts.textCaseCycle',
  'toggle-panel:backlinks': 'ui.shortcuts.panelBacklinks',
  'thesaurus': 'ui.shortcuts.thesaurus',
  'import-scrivener': 'ui.shortcuts.importScrivener',
  'sp-element:parenthetical': 'shortcuts.spParenthetical', 'sp-element:dialogue': 'shortcuts.spDialogue',
  'sp-element:transition': 'shortcuts.spTransition', 'sp-element:shot': 'shortcuts.spShot',
  'sp-element:act-break': 'shortcuts.spActBreak', 'sp-element:note': 'shortcuts.spNote',
  'select-scene': 'shortcuts.selectScene', 'nbsp': 'shortcuts.nbsp',
  'goto': 'shortcuts.goto', 'sp-find-error': 'shortcuts.findError',
  'dev-console': 'shortcuts.devConsole',
  // [alpha.66r3] ระบบจัดการพื้นที่ + เวิร์กสเปซ
  'panels-hide-all': 'shortcuts.panelsHideAll', 'panels-hide-right': 'shortcuts.panelsHideRight',
  'panels-hide-left': 'shortcuts.panelsHideLeft', 'workspace-menu': 'shortcuts.workspaceMenu',
  // ── [alpha.79] ชุดใหม่ ──
  'fmtbar-here': 'ui.shortcuts.fmtbarHere',
  'fmtbar-opacity': 'ui.shortcuts.fmtbarOpacity',
  'fmtbar-align': 'ui.shortcuts.fmtbarAlign',
  'fmtbar-lock': 'ui.shortcuts.fmtbarLock',
  'insert-image': 'ui.shortcuts.insertImage', 'quick-note': 'ui.shortcuts.quickNote',
  'reading-mode': 'ui.shortcuts.readingMode', 'new-from-template': 'ui.shortcuts.newFromTemplate',
  'goto-page': 'ui.shortcuts.gotoPage', 'goto-scene': 'ui.shortcuts.gotoScene',
  'chapter': 'ui.shortcuts.newChapter', 'scene': 'ui.shortcuts.newScene',
  'character': 'ui.shortcuts.newCharacter', 'location': 'ui.shortcuts.newLocation',
  'memo': 'ui.shortcuts.newMemo',
  'toggle-panel:dashboard': 'ui.shortcuts.panelDashboard',
  'toggle-panel:timeline': 'ui.shortcuts.panelTimeline',
  'toggle-panel:maps': 'ui.shortcuts.panelMaps',
  'toggle-panel:network': 'ui.shortcuts.panelNetwork',
  'toggle-panel:planner': 'ui.shortcuts.panelPlanner',
  'toggle-panel:branch': 'ui.shortcuts.panelBranch',
  'toggle-panel:books': 'ui.shortcuts.panelBooks',
  'toggle-panel:chapters': 'ui.chapters.title',
  'read-book': 'ui.readbook.title',
  'toggle-panel:codex': 'ui.shortcuts.panelCodex',
  'toggle-panel:history': 'ui.shortcuts.panelHistory',
  'toggle-panel:record': 'ui.shortcuts.panelRecord',
  'toggle-panel:gallery-board': 'ui.shortcuts.panelGalleryBoard',
  'toggle-panel:floorplan': 'ui.shortcuts.panelFloorplan',
  'toggle-panel:player': 'ui.shortcuts.panelPlayer',
  'toggle-panel:ai-analyzer': 'ui.shortcuts.panelAiAnalyzer',
  'toggle-panel:comments': 'ui.shortcuts.panelComments',
  'toggle-panel:props': 'ui.shortcuts.panelProps',
  'toggle-panel:dialogue': 'ui.shortcuts.panelDialogue',
  'toggle-panel:plugins': 'ui.shortcuts.panelPlugins',
  // [alpha.116 ข้อ 7] เก้าตัวที่เคยตกหล่น
  'toggle-panel:ai-hub': 'ui.shortcuts.panelAiHub',
  'toggle-panel:ai-chat': 'ui.shortcuts.panelAiChat',
  'toggle-panel:dlgb': 'ui.shortcuts.panelDlgb',
  'toggle-panel:starter': 'ui.shortcuts.panelStarter',
  'toggle-panel:tree': 'ui.shortcuts.panelTree',
  'toggle-panel:outline': 'ui.shortcuts.panelOutline',
  'toggle-panel:notes': 'ui.shortcuts.panelNotes',
  'toggle-panel:log': 'ui.shortcuts.panelLog',
  'toggle-panel:search': 'ui.shortcuts.panelSearch',
};

/**
 * [alpha.79] หมวดของคีย์ลัด — ใช้จัดกลุ่มในหน้า ตั้งค่า → ปุ่มลัด
 * แถวไหนไม่อยู่ในตารางนี้ตกไปหมวด "อื่น ๆ" (ไม่หายไปเงียบ ๆ)
 */
export const SHORTCUT_CATS = [
  { key: 'file', labelKey: 'ui.shortcuts.catFile',
    ids: ['save', 'save-as', 'save-all', 'new-project', 'open-project', 'print', 'export-hub',
          'export-blog', 'close-tab', 'close-all-tabs', 'new-from-template', 'compile',
          'import-scrivener'] },
  { key: 'edit', labelKey: 'ui.shortcuts.catEdit',
    ids: ['editor-undo', 'editor-redo', 'find', 'global-search', 'quick-open', 'goto',
          'goto-page', 'goto-scene', 'select-scene', 'delete-line', 'nbsp', 'insert-image',
          'thesaurus'] },
  { key: 'format', labelKey: 'ui.shortcuts.catFormat',
    ids: ['fmt:bold', 'fmt:italic', 'fmt:underline', 'fmt:strike', 'fmt:heading:1', 'fmt:heading:2',
          'fmt:heading:3', 'fmt:paragraph', 'fmt:ul', 'fmt:ol', 'fmt:clear',
          'fmt:align:left', 'fmt:align:center', 'fmt:align:right', 'fmt:align:justify',
          'text-case-cycle'] },
  { key: 'script', labelKey: 'ui.shortcuts.catScript',
    ids: ['toggle-format', 'sp-element:parenthetical', 'sp-element:dialogue', 'sp-element:transition',
          'sp-element:shot', 'sp-element:act-break', 'sp-element:note', 'sp-find-error'] },
  { key: 'view', labelKey: 'ui.shortcuts.catView',
    ids: ['focus-mode', 'typewriter', 'reading-mode', 'read-book', 'line-numbers',
          'split-view', 'panels-hide-all', 'panels-hide-right', 'panels-hide-left', 'workspace-menu',
          'fmtbar-here', 'fmtbar-opacity', 'fmtbar-align', 'fmtbar-lock'] },
  { key: 'create', labelKey: 'ui.shortcuts.catCreate',
    ids: ['chapter', 'scene', 'character', 'location', 'memo', 'quick-note'] },
  { key: 'panels', labelKey: 'ui.shortcuts.catPanels',
    ids: ['kanban', 'gallery', 'toggle-panel:dashboard', 'toggle-panel:timeline', 'toggle-panel:maps',
          'toggle-panel:network', 'toggle-panel:planner', 'toggle-panel:branch', 'toggle-panel:books',
          'toggle-panel:codex', 'toggle-panel:history', 'toggle-panel:record',
          'toggle-panel:gallery-board', 'toggle-panel:floorplan', 'toggle-panel:player',
          'toggle-panel:ai-analyzer', 'toggle-panel:comments', 'toggle-panel:props',
          'toggle-panel:dialogue', 'toggle-panel:plugins',
          // [alpha.116 ข้อ 7] เก้าตัวที่เคยตกหล่น
          'toggle-panel:ai-hub', 'toggle-panel:ai-chat', 'toggle-panel:dlgb',
          'toggle-panel:starter', 'toggle-panel:tree', 'toggle-panel:outline',
          'toggle-panel:notes', 'toggle-panel:log', 'toggle-panel:search',
          // [alpha.125 ข้อ G]
          'toggle-panel:backlinks',
          // [alpha.141] จัดการบท
          'toggle-panel:chapters'] },
  { key: 'other', labelKey: 'ui.shortcuts.catOther', ids: ['settings', 'dev-console', 'cheatsheet'] },
];

/** หมวดของคีย์ลัดหนึ่งรายการ — ไม่รู้จัก = 'other' */
export function shortcutCat(id) {
  for (const c of SHORTCUT_CATS) if (c.ids.includes(id)) return c.key;
  return 'other';
}

const isMac = (() => { try { return navigator.platform.toLowerCase().includes('mac'); } catch { return false; } })();

// แปลง code/ctrl/shift เป็นข้อความ (ใช้ใน title/tooltip/ปุ่มลัด)
// [alpha.79] `ctrl` เป็น `'ctrl+alt'` ได้ → แสดง Ctrl+Alt (⌥ บน mac)
export function formatShortcut(code, ctrl, shift, alt) {
  const parts = [];
  const withAlt = alt || String(ctrl).includes('alt');
  if (ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (withAlt) parts.push(isMac ? '⌥' : 'Alt');
  if (shift) parts.push(isMac ? '⇧' : 'Shift');
  let key = String(code || '').replace(/^Key/, '').replace(/^Digit/, '');
  if (code === 'Comma') key = ','; else if (code === 'Space') key = 'Space';
  else if (code === 'Period') key = '.'; else if (code === 'Slash') key = '/';
  else if (code === 'Backslash') key = '\\'; else if (code === 'Backquote') key = '`';
  else if (code === 'BracketLeft') key = '['; else if (code === 'BracketRight') key = ']';
  else if (code === 'Semicolon') key = ';'; else if (code === 'Quote') key = "'";
  else if (code === 'Minus') key = '-'; else if (code === 'Equal') key = '=';
  parts.push(key);
  return parts.join(isMac ? '' : '+');
}

/** ต้องกด Alt ด้วยไหม (ช่องที่สองของตาราง SHORTCUTS) */
export function needsAlt(needCtrl) { return String(needCtrl).includes('alt'); }

// ชื่อเก่า (he กัน break import ใน dialogs.js)
export const accelText = formatShortcut;

// ตัวช่วย: แทรก shortcut ลงใน title string — "ข้อความ (Ctrl+B)"
export function withShortcut(labelKey, code, ctrl, shift) {
  const label = t(labelKey, labelKey);
  const sc = formatShortcut(code, ctrl, shift);
  return label + ' (' + sc + ')';
}
