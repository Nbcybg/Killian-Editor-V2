// session-core.js — [alpha.79] "จำทุกอย่างล่าสุด" (บริสุทธิ์ 100% · มี unit test)
//
// ═══ ต้นตอที่ผู้ใช้เจอ ═══
// เลย์เอาต์แผงเก็บใน `localStorage` มาตลอด — ซึ่ง Chromium **เขียนลงดิสก์แบบหน่วงเวลา**
// ปิดโปรแกรมปกติจะทัน แต่ **force quit / โปรแกรมพัง / ไฟดับ** ไม่ทัน → กลับมาแล้วแผงหายหมด
// และ "ไฟล์ที่เปิดค้าง" ถูกบันทึกเฉพาะตอน `closeProjectIfAny()` เท่านั้น — ปิดโปรแกรมทั้งตัว
// ไม่เคยผ่านทางนั้นเลย จึงไม่เคยถูกบันทึก
//
// ═══ ทางแก้ ═══
// เก็บ "ภาพรวมสถานะทั้งหมด" ลง **ไฟล์จริง** (`<userData>/sessions/<คีย์>.json`) ผ่าน main
// แล้ว **เขียนซ้ำเป็นระยะ** (ไม่ใช่แค่ตอนปิด) → ต่อให้ถูกฆ่ากลางคัน ก็เสียแค่ไม่กี่วินาทีสุดท้าย
//
// โมดูลนี้ถือ "รูปร่างของข้อมูล" ล้วน ๆ — ไม่รู้จัก DOM/fs/kapi เลย

export const SESSION_VERSION = 2;

/** ส่วนย่อยที่รู้จัก — ใช้ทั้งตอน merge และตอนตรวจว่าเปลี่ยนไหม */
export const SESSION_PARTS = ['tabs', 'panels', 'split', 'ui', 'win'];

/** เซสชันเปล่า */
export function newSession(root = '') {
  return {
    v: SESSION_VERSION,
    root: String(root || ''),
    ts: 0,
    tabs: { open: [], active: '', scroll: {} },
    panels: { layout: null, homes: null, workspaces: null, hidden: '' },
    split: null,
    ui: {},
    win: null,
  };
}

/**
 * รับค่าอะไรมาก็ได้ → คืนเซสชันที่ใช้งานได้เสมอ (ไฟล์เสีย/รุ่นเก่า/undefined ก็ไม่พัง)
 * **ห้าม throw** — ถ้ากู้เซสชันแล้วโปรแกรมเปิดไม่ขึ้น จะแย่กว่าไม่กู้เลย
 */
export function migrateSession(raw) {
  const s = newSession();
  if (!raw || typeof raw !== 'object') return s;
  s.root = typeof raw.root === 'string' ? raw.root : '';
  s.ts = Number.isFinite(+raw.ts) ? +raw.ts : 0;

  const t = raw.tabs && typeof raw.tabs === 'object' ? raw.tabs : {};
  // รุ่น 1 เก็บแท็บเป็น array ตรง ๆ
  const open = Array.isArray(raw.tabs) ? raw.tabs : (Array.isArray(t.open) ? t.open : []);
  s.tabs.open = open.filter((x) => typeof x === 'string' && x).slice(0, 200);
  s.tabs.active = typeof t.active === 'string' ? t.active : '';
  s.tabs.scroll = (t.scroll && typeof t.scroll === 'object') ? { ...t.scroll } : {};
  // แท็บที่ active ต้องอยู่ในรายการที่เปิดด้วย (ไม่งั้นกู้แล้วชี้ไปไฟล์ที่ไม่ได้เปิด)
  if (s.tabs.active && !s.tabs.open.includes(s.tabs.active)) s.tabs.active = '';

  const p = raw.panels && typeof raw.panels === 'object' ? raw.panels : {};
  s.panels.layout = p.layout ?? null;
  s.panels.homes = p.homes ?? null;
  s.panels.workspaces = p.workspaces ?? null;
  s.panels.hidden = typeof p.hidden === 'string' ? p.hidden : '';

  s.split = raw.split ?? null;
  s.ui = (raw.ui && typeof raw.ui === 'object') ? { ...raw.ui } : {};
  s.win = normalizeWin(raw.win);
  return s;
}

/** กล่องหน้าต่าง — ตัวเลขต้องสมเหตุสมผล ไม่งั้นหน้าต่างไปโผล่นอกจอ */
export function normalizeWin(w) {
  if (!w || typeof w !== 'object') return null;
  const n = (v, min, max, def) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) && x >= min && x <= max ? x : def;
  };
  const width = n(w.w, 400, 20000, 0);
  const height = n(w.h, 300, 20000, 0);
  if (!width || !height) return null;
  return {
    x: n(w.x, -20000, 20000, 0), y: n(w.y, -20000, 20000, 0),
    w: width, h: height, max: !!w.max,
  };
}

/**
 * รวมของใหม่ทับของเดิม — ทีละส่วน (patch ที่ไม่พูดถึงส่วนไหน = ส่วนนั้นคงเดิม)
 * ใช้ตอนบันทึกทีละชิ้น เช่น "แค่ตำแหน่งหน้าต่างเปลี่ยน" ไม่ต้องส่งทุกอย่างมาใหม่
 */
export function mergeSession(prev, patch) {
  const base = migrateSession(prev);
  if (!patch || typeof patch !== 'object') return base;
  const next = { ...base };
  if (typeof patch.root === 'string' && patch.root) next.root = patch.root;
  if (Number.isFinite(+patch.ts)) next.ts = +patch.ts;
  for (const k of SESSION_PARTS) {
    if (patch[k] === undefined) continue;
    if (k === 'tabs' || k === 'panels') next[k] = { ...base[k], ...(patch[k] || {}) };
    else next[k] = patch[k];
  }
  return migrateSession(next);
}

/**
 * ชื่อไฟล์เซสชันจาก path โปรเจกต์ — ต้อง **เสถียร** (path เดิม = ชื่อเดิมเสมอ)
 * ไม่ใช้ hash ของไลบรารีเพราะโมดูลนี้ต้องรันบน node เปล่า ๆ ได้
 */
export function sessionKey(root) {
  const s = String(root || '').replace(/[\\/]+$/, '').toLowerCase();
  if (!s) return 'default';
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + s.charCodeAt(i) * (i + 1), 0x85ebca6b) >>> 0;
  }
  const tail = (s.split(/[\\/]/).pop() || '').replace(/[^\w฀-๿-]/g, '').slice(0, 24);
  return (tail ? tail + '-' : '') + h1.toString(36) + h2.toString(36);
}

/** เหมือนกันไหม (ไม่นับ ts) — ใช้ข้ามการเขียนไฟล์ที่ไม่มีอะไรเปลี่ยน */
export function sameSession(a, b) {
  const strip = (s) => { const x = { ...migrateSession(s) }; x.ts = 0; return JSON.stringify(x); };
  return strip(a) === strip(b);
}

/** เซสชันเก่าเกินไปแล้วไหม (วัน) — กันกู้แท็บจากงานเมื่อครึ่งปีก่อน */
export function isStale(s, nowMs, days = 90) {
  const ts = migrateSession(s).ts;
  if (!ts) return false;
  const n = Number(nowMs);
  if (!Number.isFinite(n) || n <= 0) return false;
  return (n - ts) > days * 86400000;
}

/** สรุปสั้น ๆ ไว้ขึ้น log — "3 แท็บ · 5 แผง · แยกจอ" */
export function sessionSummary(s) {
  const x = migrateSession(s);
  return {
    tabs: x.tabs.open.length,
    hasPanels: !!x.panels.layout,
    hasSplit: !!x.split,
    hasWin: !!x.win,
    active: x.tabs.active,
  };
}

/** แท็บที่หายไปจากดิสก์ต้องหลุดออกจากเซสชัน (ไม่งั้นกู้แล้วเจอ error ทุกครั้งที่เปิด) */
export function pruneTabs(s, existsList) {
  const x = migrateSession(s);
  const keep = new Set(Array.isArray(existsList) ? existsList : []);
  x.tabs.open = x.tabs.open.filter((f) => keep.has(f));
  const scroll = {};
  for (const f of x.tabs.open) if (x.tabs.scroll[f] != null) scroll[f] = x.tabs.scroll[f];
  x.tabs.scroll = scroll;
  if (!x.tabs.open.includes(x.tabs.active)) x.tabs.active = x.tabs.open[0] || '';
  return x;
}
