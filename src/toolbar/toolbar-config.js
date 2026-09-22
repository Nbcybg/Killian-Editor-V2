// toolbar-config.js — [alpha.79] "เอาปุ่มเข้า-ออกจากแถบเครื่องมือ" (บริสุทธิ์ 100% · มี unit test)
//
// เดิมแถบเครื่องมือเป็น HTML ตายตัว 40 กว่าปุ่ม — ใครไม่ใช้ AI ก็ต้องมองปุ่ม AI ทุกวัน
// ตอนนี้ผู้ใช้ติ๊กเปิด-ปิดได้ทีละปุ่ม เก็บลง `settings.toolbar` (ระดับผู้ใช้ ใช้ร่วมทุกโปรเจกต์)
//
// ═══ ทำไมเป็นโมดูลบริสุทธิ์ ═══
// สิ่งที่ผิดพลาดง่ายที่สุดไม่ใช่การซ่อนปุ่ม แต่คือ **เส้นคั่น** — ซ่อนทั้งกลุ่มแล้วเหลือเส้นคั่น
// สองอันติดกันลอย ๆ · ตรรกะนั้นทดสอบได้ด้วย node ตรง ๆ จึงแยกออกมาที่นี่ทั้งหมด
//
// ═══ ป้ายชื่อปุ่มมาจากไหน ═══
// **ไม่เก็บที่นี่** — ฝั่ง UI อ่านจาก `title` ของปุ่มจริงใน DOM (ซึ่งมาจากไฟล์ภาษาอยู่แล้ว)
// จึงไม่มีทางที่ชื่อในกล่องตั้งค่ากับ tooltip จะไม่ตรงกัน

/** ปุ่มที่ผู้ใช้ซ่อนไม่ได้ — โปรแกรมเป็นคนคุมการแสดงผลตามโหมดเอกสาร (นิยาย/บทหนัง) */
export const LOCKED_BUTTONS = [
  'tb-mode', 'tb-sp-elem', 'tb-sp-ext', 'sp-view-select',
  // [alpha.137] ปุ่มโปรเจกต์ที่หัวแถบ (เดิมอยู่บน #topbar ซึ่งถูกลบทั้งแถว) —
  // เป็นทางเข้าหลักของการเปิด/บันทึก/ค้นหาทั้งผลงาน จึงซ่อนไม่ได้
  // (ปุ่มบันทึกโผล่เมื่อมีโปรเจกต์เปิดอยู่เท่านั้น — โปรแกรมคุม display เอง)
  'open-btn', 'save-all-btn', 'search-all-btn',
  // [alpha.161 · K3] ปุ่ม "»" ท้ายแถบ (ปุ่มที่ล้น/ถูกซ่อน) — โปรแกรมคุมเอง ซ่อนไม่ได้ ไม่ล้นเอง
  'tb-overflow',
];

/**
 * กลุ่มปุ่มบนแถบเครื่องมือ — เรียงตามลำดับจริงใน index.html
 * `def:false` = ซ่อนไว้เป็นค่าเริ่มต้น (ปุ่มเฉพาะทาง)
 */
export const TOOLBAR_GROUPS = [
  // [alpha.150 ข้อ 1] ย้อนกลับ/ทำซ้ำ — อยู่บนแถบรูปแบบลอย แต่ต้องมีแถวที่นี่ด้วย
  // เพราะ `isConfigurable()` ถือว่า "ปุ่มที่ตั้งค่าได้" = ปุ่มที่มีอยู่ในตารางนี้
  { key: 'edit', labelKey: 'ui.tbcfg.grpEdit', buttons: [
    { id: 'tb-undo' }, { id: 'tb-redo' },
  ] },
  { key: 'view', labelKey: 'ui.tbcfg.grpView', buttons: [
    // [alpha.138] `tb-theme` ถูกถอดออกทั้งปุ่มและคีย์ลัด — ธีมอยู่ในตั้งค่าอย่างเดียว
    { id: 'tb-read' },
    { id: 'tb-focus' }, { id: 'tb-typewriter' }, { id: 'tb-linenum' }, { id: 'tb-md-codes' },
  ] },
  { key: 'style', labelKey: 'ui.tbcfg.grpStyle', buttons: [
    { id: 'tb-style' }, { id: 'tb-case' },
    // [alpha.150 ข้อ 1] ปุ่มหัวข้อกดตรง ๆ + สีเน้นข้อความ
    { id: 'tb-h2' }, { id: 'tb-h3' }, { id: 'tb-h4' }, { id: 'tb-highlight' },
    { id: 'tb-bold' }, { id: 'tb-italic' }, { id: 'tb-underline' }, { id: 'tb-strike' },
    // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย
    { id: 'tb-sup' }, { id: 'tb-sub' },
    // [alpha.132 ข้อ 9] สีตัวอักษร (ผู้ใช้จริงขอมา)
    { id: 'tb-color' },
    { id: 'tb-ul' }, { id: 'tb-ol' }, { id: 'tb-quote' },
    // [alpha.84 ข้อ 3+4] สวิตช์ย่อหน้าอัตโนมัติ (นิยาย) · ข้อความต่อเนื่อง (บท)
    // โปรแกรมคุม `style.display` ตามโหมดเอกสารอยู่แล้ว — ตรงนี้คุมแค่ "ผู้ใช้อยากเห็นไหม"
    { id: 'tb-indent' }, { id: 'tb-sp-cont' },
  ] },
  { key: 'align', labelKey: 'ui.tbcfg.grpAlign', buttons: [
    { id: 'tb-align-left' }, { id: 'tb-align-center' },
    { id: 'tb-align-right' }, { id: 'tb-align-justify' },
  ] },
  { key: 'insert', labelKey: 'ui.tbcfg.grpInsert', buttons: [
    { id: 'tb-img' }, { id: 'tb-gallery' },
    { id: 'tb-visual' },                         // [alpha.90] เล่าด้วยภาพ (สตอรีบอร์ดของฉาก)
    { id: 'tb-source' },
  ] },
  { key: 'find', labelKey: 'ui.tbcfg.grpFind', buttons: [
    { id: 'tb-find' },                           // [alpha.150 ข้อ 1] ค้นในเอกสาร
    // [alpha.161 · K3] ★ เดิมมี 3 ปุ่มที่เปิดการค้นหาทั้งโปรเจกต์ตัวเดียวกัน (search-all-btn · tb-gsearch ·
    // tb-search-panel) → เหลือสองทางที่ชัดเจน: บนแถบหลัก = search-all-btn (หัวแถบ) · บนแถบรูปแบบลอย = หมวด find
    // (tb-find ค้นในเอกสาร + tb-gsearch ค้นในโปรเจกต์) · tb-search-panel ซ้ำกับ search-all-btn → ซ่อนเป็นค่าเริ่มต้น
    // (ผู้ใช้เปิดคืนได้ · อยู่ในเมนู "»" · คำสั่งเดิมยังอยู่ในเมนูระบบครบ)
    { id: 'tb-gsearch' }, { id: 'tb-quickopen' },
  ] },
  { key: 'tabs', labelKey: 'ui.tbcfg.grpTabs', buttons: [
    { id: 'tb-split' }, { id: 'tb-close' }, { id: 'tb-close-all' },
  ] },
  { key: 'panels', labelKey: 'ui.tbcfg.grpPanels', buttons: [
    { id: 'tb-tree-panel' }, { id: 'tb-outline-panel' }, { id: 'tb-props-panel' },
    { id: 'tb-search-panel', def: false },       // [alpha.161 · K3] ซ้ำกับ search-all-btn (ดูหมวด find)
    { id: 'tb-note' }, { id: 'tb-panels' },
    { id: 'tb-kanban' }, { id: 'tb-dashboard' },
    { id: 'tb-dialogue' },                       // [alpha.79] แผงบทพูด
    { id: 'tb-dlgb' },                           // [alpha.82] ห้องซ้อมบท
    { id: 'tb-codex' }, { id: 'tb-history' }, { id: 'tb-record' },
    // [alpha.80] แผงที่มีมานานแต่ไม่เคยมีปุ่มบนแถบ
    { id: 'tb-comments' }, { id: 'tb-notes-panel' }, { id: 'tb-log' },
  ] },
  { key: 'story', labelKey: 'ui.tbcfg.grpStory', buttons: [
    { id: 'tb-timeline' }, { id: 'tb-maps' }, { id: 'tb-books' }, { id: 'tb-chapters' },
    { id: 'tb-network' },
    { id: 'tb-planner' }, { id: 'tb-branch' }, { id: 'tb-floorplan' }, { id: 'tb-player' },
    { id: 'tb-gallery-board' }, { id: 'tb-backlinks' },
  ] },
  // [alpha.162 · W5 ข้อ 4] ★ ห้าปุ่ม AI กินที่บนแถบ (25 จาก 43 ปุ่มเป็นสวิตช์แผง) → ปุ่มเดียวเปิดเมนูของทั้งห้า
  // ตัวเดิมยังอยู่ครบ (id/คำสั่ง/สถานะเปิด-ปิดเหมือนเดิม) แค่ **ซ่อนเป็นค่าเริ่มต้น** — ใครชอบแบบเดิมเปิดคืนได้
  { key: 'ai', labelKey: 'ui.tbcfg.grpAi', buttons: [
    { id: 'tb-ai-group' },
    { id: 'tb-ai-hub', def: false },             // [alpha.116] AI Hub — ประตูเดียวของทุกความสามารถ AI
    { id: 'tb-ai', def: false }, { id: 'tb-ai-chat', def: false }, { id: 'tb-ai-analyzer', def: false },
    { id: 'tb-starter', def: false },            // [alpha.94] Story Starter
  ] },
  { key: 'ext', labelKey: 'ui.tbcfg.grpExt', buttons: [
    { id: 'tb-plugins' },                        // [alpha.79] แผงจัดการปลั๊กอิน
    { id: 'tb-settings' },                       // [alpha.162 · W5 ข้อ 4]
    { id: 'tb-plug' },                           // เมนูคำสั่งที่ปลั๊กอินลงทะเบียนไว้
  ] },
  // [alpha.157] ขวาสุด: ซ่อน/แสดงแผงทีละฝั่ง (ปิดได้ที่ ตั้งค่า → แถบเครื่องมือ เหมือนกลุ่มอื่น)
  { key: 'layout', labelKey: 'ui.tbcfg.grpLayout', buttons: [
    { id: 'tb-side-left' }, { id: 'tb-side-top' }, { id: 'tb-side-bottom' }, { id: 'tb-side-right' },
  ] },
];

/** [alpha.162 · W5 ข้อ 4] ปุ่มที่รวมอยู่ในเมนูของปุ่ม AI (ลำดับ = ลำดับในเมนู) */
export const AI_GROUP_IDS = ['tb-ai-hub', 'tb-ai', 'tb-ai-chat', 'tb-ai-analyzer', 'tb-starter'];

/** id ของทุกปุ่มที่ตั้งค่าได้ (เรียงตามลำดับบนแถบ) */
export function allButtonIds() {
  return TOOLBAR_GROUPS.flatMap((g) => g.buttons.map((b) => b.id));
}

/** ปุ่มนี้ตั้งค่าได้ไหม (ปุ่มที่โปรแกรมคุมเอง = ไม่ได้) */
export function isConfigurable(id) {
  return !LOCKED_BUTTONS.includes(id) && allButtonIds().includes(id);
}

/** ปุ่มนี้เปิดไว้เป็นค่าเริ่มต้นไหม */
export function defaultVisible(id) {
  for (const g of TOOLBAR_GROUPS) {
    for (const b of g.buttons) if (b.id === id) return b.def !== false;
  }
  return true;
}

/** กลุ่มที่ปุ่มนี้สังกัด ('' = ไม่รู้จัก) */
export function groupOf(id) {
  for (const g of TOOLBAR_GROUPS) if (g.buttons.some((b) => b.id === id)) return g.key;
  return '';
}

/**
 * ทำค่าที่อ่านมาจาก settings ให้อยู่ในรูปมาตรฐาน
 * รูปแบบที่เก็บ: `{ hidden: { 'tb-ai': true } }` — **เก็บเฉพาะตัวที่ต่างจากค่าเริ่มต้น**
 * (ปุ่มใหม่ที่เพิ่มในรุ่นถัดไปจึงโผล่ให้เห็นเองโดยไม่ต้องย้ายข้อมูล)
 */
export function normalizeToolbar(cfg) {
  const hidden = {};
  const src = (cfg && typeof cfg === 'object' && cfg.hidden && typeof cfg.hidden === 'object')
    ? cfg.hidden : {};
  const known = new Set(allButtonIds());
  for (const id of Object.keys(src)) {
    if (src[id] && known.has(id)) hidden[id] = true;
  }
  // ปุ่มที่ค่าเริ่มต้นคือ "ซ่อน" และผู้ใช้ยังไม่เคยแตะ → ถือว่าซ่อน
  for (const id of known) {
    if (!defaultVisible(id) && !(cfg && cfg.shown && cfg.shown[id])) hidden[id] = true;
  }
  const shown = {};
  const s = (cfg && cfg.shown && typeof cfg.shown === 'object') ? cfg.shown : {};
  for (const id of Object.keys(s)) if (s[id] && known.has(id)) { shown[id] = true; delete hidden[id]; }
  return { hidden, shown };
}

/** ปุ่มนี้ควรโผล่บนแถบไหม */
export function isButtonVisible(cfg, id) {
  if (!isConfigurable(id)) return true;
  return !normalizeToolbar(cfg).hidden[id];
}

/** เปิด/ปิดปุ่มหนึ่งตัว → คืน cfg ก้อนใหม่ (ไม่แก้ของเดิม) */
export function setButtonVisible(cfg, id, on) {
  const next = normalizeToolbar(cfg);
  if (!isConfigurable(id)) return next;
  if (on) { delete next.hidden[id]; if (!defaultVisible(id)) next.shown[id] = true; }
  else { next.hidden[id] = true; delete next.shown[id]; }
  return next;
}

/** เปิด/ปิดทั้งกลุ่ม */
export function setGroupVisible(cfg, groupKey, on) {
  let next = cfg;
  const g = TOOLBAR_GROUPS.find((x) => x.key === groupKey);
  if (!g) return normalizeToolbar(cfg);
  for (const b of g.buttons) next = setButtonVisible(next, b.id, on);
  return normalizeToolbar(next);
}

/** คืนค่าเริ่มต้นทั้งแถบ */
export function resetToolbarConfig() { return { hidden: {}, shown: {} }; }

/** จำนวนปุ่มที่เปิดอยู่ / ทั้งหมด — ใช้โชว์บนหัวกล่องตั้งค่า */
export function toolbarCounts(cfg) {
  const ids = allButtonIds();
  const n = normalizeToolbar(cfg);
  return { total: ids.length, on: ids.filter((id) => !n.hidden[id]).length };
}

/**
 * **หัวใจของโมดูลนี้** — เส้นคั่นไหนควรโผล่
 *
 * รับลำดับจริงของลูกในแถบ (id ของปุ่ม หรือ `'sep'` สำหรับ `<span class="sep">`)
 * แล้วคืน array ของ boolean ยาวเท่ากัน: `true` = แสดง
 *
 * กฎ: เส้นคั่นแสดงก็ต่อเมื่อ **มีปุ่มที่มองเห็นทั้งก่อนและหลัง** และ
 * ไม่มีเส้นคั่นอื่นที่มองเห็นคั่นกลางระหว่างมันกับปุ่มก่อนหน้า (กันเส้นซ้อนสองอัน)
 *
 * @param {string[]} seq เช่น ['tb-paper','sep','tb-bold','sep']
 * @param {(id:string)=>boolean} visible ปุ่มนี้มองเห็นไหม
 */
export function layoutToolbar(seq, visible) {
  const list = Array.isArray(seq) ? seq : [];
  const isSep = (x) => x === 'sep';
  const out = list.map((x) => (isSep(x) ? false : !!visible(x)));
  let seenButton = false;        // มีปุ่มที่มองเห็นแล้วก่อนตำแหน่งนี้ไหม
  let pendingSep = -1;           // ดัชนีเส้นคั่นที่รออนุมัติ
  for (let i = 0; i < list.length; i++) {
    if (isSep(list[i])) { if (seenButton) pendingSep = i; continue; }
    if (!out[i]) continue;
    if (pendingSep >= 0) { out[pendingSep] = true; pendingSep = -1; }
    seenButton = true;
  }
  return out;
}

/**
 * [alpha.161 · K3] ★ แถบเครื่องมือล้นหน้าต่าง — ปุ่มไหนต้องย้ายเข้าเมนู "»"
 * เดิมแถบเลื่อนแนวนอนได้ (overflow-x) แต่ไม่มีอะไรบอกว่ามีปุ่มอยู่เลยขอบขวา · ตอนนี้ตัดจาก **ท้ายแถบ**
 * ทีละปุ่มจนพอดี · ปุ่มที่โปรแกรมคุม (locked: ปุ่มโปรเจกต์ · โหมดเอกสาร) ไม่ถูกย้ายเด็ดขาด
 * @param {Array<{id:string, w:number, locked?:boolean}>} items ลูกของแถบที่มองเห็นอยู่ (ตามลำดับ)
 * @param {number} avail ความกว้างที่ใช้ได้ (หักปุ่ม "»" แล้ว)
 * @returns {string[]} id ที่ต้องย้ายเข้าเมนู (เรียงตามลำดับบนแถบ)
 */
export function overflowPlan(items, avail) {
  const list = Array.isArray(items) ? items : [];
  let total = list.reduce((s, x) => s + Math.max(0, Number(x && x.w) || 0), 0);
  const lim = Math.max(0, Number(avail) || 0);
  const out = [];
  for (let i = list.length - 1; i >= 0 && total > lim; i--) {
    const x = list[i];
    if (!x || x.locked || !x.id) continue;
    out.unshift(x.id);
    total -= Math.max(0, Number(x.w) || 0);
  }
  return out;
}

// ══════════════ [alpha.111] แถบรูปแบบลอย: ตั้งค่าแยก "นิยาย" กับ "บทภาพยนตร์" ══════════════
//
// ผู้ใช้: *"format bar คลิกขวาแล้วปรับแต่งได้ ถอดปุ่มออกได้ ที่ตั้งค่า — แบ่งเป็นนิยายกับหนัง"*
//
// ทำไมต้องแยกจาก `settings.toolbar`: ปุ่มชุดเดียวกันมี **ความหมายต่างกันตามโหมด** —
// คนเขียนบทไม่ต้องการช่องหัวข้อ/ยกคำพูด ส่วนคนเขียนนิยายไม่ต้องการสวิตช์ "ต่อเนื่อง"
// ถ้าใช้ก้อนเดียวกัน ผู้ใช้จะต้องมานั่งติ๊กกลับไปกลับมาทุกครั้งที่สลับโหมด
//
// **กติกาสำคัญ**: ปุ่มที่อยู่บนแถบลอย (`FMTBAR_IDS`) ถูกคุมด้วยก้อนนี้เท่านั้น
// `settings.toolbar` เลิกยุ่งกับมันแล้ว — ไม่งั้นมีสวิตช์สองที่คุมปุ่มเดียวกัน แล้วเถียงกันเอง

/** โหมดเอกสารที่แถบลอยรองรับ */
/**
 * ══ [alpha.151 ข้อ 1] ★ สี่โหมด ไม่ใช่สองโหมด ══
 *
 * ผู้ใช้: *"float bar ต้องแยกเป็น 4 mode คือ นิยาย หนัง planner (เราเรียกว่า all app ดีกว่า)
 *          ซึ่งใน editor จะได้ 2 mode เท่านั้น ส่วนใน planner หรือส่วนอื่น ๆ เช่น wiki จะใช้ all app"*
 *
 *   prose · screenplay  = แถบของ **ตัวแก้ไข** (สลับตามชนิดเอกสารที่เปิดอยู่)
 *   all                 = แถบของตัวแก้ไขเมื่ออยู่ที่อื่น (Wiki · แดชบอร์ด · หน้าแรก)
 *   planner             = แถบ **ของกระดานเอง** ซึ่งเป็นคนละอันในหน้าจอ (ดู PLANNER_BAR_GROUPS)
 */
export const FMT_MODES = ['prose', 'screenplay', 'all', 'planner'];

/** โหมดที่ใช้กับ "แถบของตัวแก้ไข" (กระดานมีแถบของตัวเองแยกต่างหาก) */
export const EDITOR_FMT_MODES = ['prose', 'screenplay', 'all'];

/**
 * ปุ่มบนแถบรูปแบบลอย **เรียงตามลำดับจริง** — ต้องตรงกับรายการใน `setupFloatingFormatBar()`
 * (ตัวที่ไม่ได้อยู่ใน TOOLBAR_GROUPS เช่น `tb-fmt-here` ถือว่าเป็นของแถบ คุมไม่ได้)
 */
/**
 * ══ [alpha.150 ข้อ 1] หมวดของแถบรูปแบบลอย — **ลำดับที่ผู้ใช้สั่งมาเอง** ══
 *
 * ผู้ใช้: *"เรียงอย่างงี้ดีกว่า ทุกหมวดเลยนะ [undo][redo] | [mode][มุมมองหน้ากระดาษ] | …"*
 *
 * ตารางนี้เป็น **แหล่งความจริงเดียว** ของสามอย่างพร้อมกัน:
 *   1. ลำดับปุ่มจริงบนแถบ (`setupFloatingFormatBar()` อ่านจาก `FMTBAR_IDS` ที่ได้จากตารางนี้)
 *   2. เส้นคั่น — หนึ่งเส้นระหว่างหมวด (ไม่ต้องเขียนมือ = ไม่มีทางลืมเวลาเพิ่มปุ่ม)
 *   3. หมวดในหน้าตั้งค่า (`fmtbarGroups()`)
 * เดิมสามอย่างนี้เขียนแยกกันสามที่ แล้วต้องมีเทสคอยกวาดว่าตรงกันไหม
 */
export const FMTBAR_GROUPS = [
  { key: 'history', labelKey: 'ui.fmtcfg.grpHistory', buttons: ['tb-undo', 'tb-redo'] },
  { key: 'doc',     labelKey: 'ui.fmtcfg.grpDoc',     buttons: ['tb-mode', 'sp-view-select'] },
  { key: 'block',   labelKey: 'ui.fmtcfg.grpBlock',
    buttons: ['tb-sp-elem', 'tb-sp-ext', 'tb-style', 'tb-h2', 'tb-h3', 'tb-h4', 'tb-case'] },
  { key: 'font',    labelKey: 'ui.fmtcfg.grpFont',
    buttons: ['tb-bold', 'tb-italic', 'tb-underline', 'tb-strike', 'tb-sub', 'tb-sup'] },
  { key: 'color',   labelKey: 'ui.fmtcfg.grpColor',
    buttons: ['tb-highlight', 'tb-color', 'tb-note'] },
  { key: 'list',    labelKey: 'ui.fmtcfg.grpList', buttons: ['tb-ul', 'tb-ol', 'tb-quote'] },
  { key: 'align',   labelKey: 'ui.fmtcfg.grpAlign',
    // [alpha.151 ข้อ 1+3] จัดแนวตั้งย้ายไปอยู่บน **แถบของกระดาน** แล้ว (`pb-valign-*`)
    // — มันจัด "ข้อความในการ์ด" ซึ่งเป็นเรื่องของกระดานล้วน ๆ ไม่ใช่ของเอกสาร
    buttons: ['tb-align-left', 'tb-align-center', 'tb-align-right', 'tb-align-justify'] },
  { key: 'insert',  labelKey: 'ui.fmtcfg.grpInsert',
    buttons: ['tb-img', 'tb-sp-cont', 'tb-indent', 'tb-comments'] },
  { key: 'view',    labelKey: 'ui.fmtcfg.grpView',
    buttons: ['tb-read', 'tb-typewriter', 'tb-md-codes', 'tb-source'] },
  { key: 'find',    labelKey: 'ui.fmtcfg.grpFind', buttons: ['tb-find', 'tb-gsearch'] },
];

/**
 * ปุ่มบนแถบรูปแบบลอย **เรียงตามลำดับจริง** — สร้างจาก `FMTBAR_GROUPS` เสมอ
 * (`setupFloatingFormatBar()` ใช้ตัวนี้ตรง ๆ จึงไม่มีทางเรียงไม่ตรงกับหน้าตั้งค่า)
 */
export const FMTBAR_IDS = FMTBAR_GROUPS.flatMap((g) => g.buttons);

/** ลำดับจริงของลูกในแถบ รวมเส้นคั่นระหว่างหมวด — ใช้ประกอบแถบและคำนวณเส้นคั่น */
export function fmtbarSequence() {
  const out = [];
  FMTBAR_GROUPS.forEach((g, i) => {
    if (i) out.push('sep');
    out.push(...g.buttons);
  });
  return out;
}

/**
 * [alpha.151] `PLANNER_ONLY` ถูกถอดออก — กระดานมี **แถบของตัวเอง** (ข้างล่าง) แล้ว
 * ปุ่มจัดแนวตั้งจึงไม่ต้องไปยืนเป็นสีเทาอยู่บนแถบของตัวแก้ไขอีก
 */

/**
 * ══ [alpha.151 ข้อ 3] ★ แถบรูปแบบ **ของกระดาน** — คนละอันกับของตัวแก้ไข ══
 *
 * ผู้ใช้: *"float bar จะต้องไม่มีที่เดียวไง ตอนนี้มีที่เดียว planner เลยใช้ยาก
 *          ต้องแยกส่วน คือ editor กับ planner"*
 *
 * ปุ่มของกระดานเป็นคนละชุดกับของเอกสารโดยธรรมชาติ (จัดข้อความ *ในการ์ด* · สีพื้นการ์ด ·
 * ลำดับซ้อน · กริด) จึงมีตารางของตัวเอง แต่ **ผ่านระบบซ่อน/แสดงตัวเดียวกัน**
 * โดยใช้โหมด `planner` ใน `settings.fmtbar`
 */
export const PLANNER_BAR_GROUPS = [
  { key: 'history', labelKey: 'ui.fmtcfg.grpHistory', buttons: ['pb-undo', 'pb-redo'] },
  { key: 'align', labelKey: 'ui.plannerBar.grpAlign',
    buttons: ['pb-align-left', 'pb-align-center', 'pb-align-right',
              'pb-valign-top', 'pb-valign-middle', 'pb-valign-bottom'] },
  { key: 'font', labelKey: 'ui.fmtcfg.grpFont', buttons: ['pb-font-smaller', 'pb-font-bigger'] },
  { key: 'color', labelKey: 'ui.plannerBar.grpColor',
    buttons: ['pb-fill', 'pb-textcolor', 'pb-border'] },
  { key: 'insert', labelKey: 'ui.fmtcfg.grpInsert',
    buttons: ['pb-image', 'pb-sticky', 'pb-todo', 'pb-frame', 'pb-connector'] },
  { key: 'order', labelKey: 'ui.plannerBar.grpOrder',
    buttons: ['pb-front', 'pb-back', 'pb-lock', 'pb-duplicate', 'pb-delete'] },
  { key: 'view', labelKey: 'ui.fmtcfg.grpView',
    buttons: ['pb-grid', 'pb-snap', 'pb-fit', 'pb-fullscreen'] },
];

/** id ปุ่มของแถบกระดาน เรียงตามลำดับจริง */
export const PLANNER_BAR_IDS = PLANNER_BAR_GROUPS.flatMap((g) => g.buttons);

/** ลำดับจริงของลูกในแถบกระดาน รวมเส้นคั่นระหว่างหมวด */
export function plannerBarSequence() {
  const out = [];
  PLANNER_BAR_GROUPS.forEach((g, i) => {
    if (i) out.push('sep');
    out.push(...g.buttons);
  });
  return out;
}

/** ปุ่มนี้อยู่บนแถบกระดานไหม */
export function isPlannerBarButton(id) { return PLANNER_BAR_IDS.includes(id); }

/** หมวดของแถบกระดานสำหรับหน้าตั้งค่า */
export function plannerBarGroups() {
  return PLANNER_BAR_GROUPS.map((g) => ({ ...g, buttons: g.buttons.map((id) => ({ id })) }));
}

/** ปุ่มของแถบกระดานถูกซ่อนไว้ไหม */
export function plannerBarHidden(cfg, id) {
  if (!PLANNER_BAR_IDS.includes(id)) return false;
  const m = normalizeFmtbar(cfg).planner;
  return !!(m && m.hidden[id]);
}

/** แผนการแสดงผลของแถบกระดาน — ปุ่มที่ถูกซ่อนจะไม่ถูกวาดเลย (ข้อ 6) */
export function layoutPlannerBar(cfg) {
  const seq = plannerBarSequence();
  return { seq, show: layoutToolbar(seq, (id) => !plannerBarHidden(cfg, id)) };
}


/** ปุ่มนี้อยู่บนแถบลอย (ไม่ใช่บนแถบเครื่องมือหลัก) ไหม */
export function isFmtbarButton(id) { return FMTBAR_IDS.includes(id); }

/**
 * ปุ่มที่ **โหมดนั้นใช้ไม่ได้จริง ๆ** → ฝั่ง UI ทำเป็นสีเทา (ไม่ใช่ซ่อน — ผู้ใช้ต้องเห็นว่ามีอยู่)
 *
 * เกณฑ์เดียว: `KEditor._cmd` / `SPEditor._cmd` **ไม่มีคำสั่งนั้น** ก็คือใช้ไม่ได้
 *   · บท: ไม่มี heading/paragraph/quote (fountain ไม่มีชนิดบล็อกพวกนี้) · ไม่มี sup/sub
 *   · นิยาย: ปุ่มเฉพาะบท (element/ต่อเนื่อง) — โปรแกรมซ่อนให้อยู่แล้ว ใส่ไว้กันหลุด
 *
 * หมายเหตุ: **หัวข้อย่อย/ตัวเลข (`tb-ul`/`tb-ol`) ใช้ได้ในบท** ตั้งแต่ alpha.98 —
 * ทำเป็นคำนำหน้าในข้อความ (`• ` / `1. `) จึงไม่อยู่ในรายการนี้
 */
export const FMT_UNSUPPORTED = {
  // [alpha.132 ข้อ 9] สีตัวอักษรเป็นของนิยายเท่านั้น — บทเก็บเป็น fountain ล้วน
  // ใส่สีลงไปจะพังการอ่านกลับ (กฎเดียวกับที่ align ของบทเป็น session-only)
  screenplay: ['tb-style', 'tb-sup', 'tb-sub', 'tb-quote', 'tb-color'],
  // `tb-sp-ext` ไม่ต้องใส่: โปรแกรมซ่อนมันเองเมื่อไม่ใช่บท (refreshToolbar) จึงไม่มีอะไรให้ทำเป็นสีเทา
  prose: ['tb-sp-elem', 'tb-sp-cont'],
  // [alpha.151] `all` = Wiki / แดชบอร์ด / หน้าแรก — ใช้เอนจินเดียวกับนิยาย
  // ตัดเฉพาะปุ่มของบทภาพยนตร์ออก ที่เหลือใช้ได้จริงทุกตัว (Wiki ก็เป็น ProseMirror)
  all: ['tb-sp-elem', 'tb-sp-cont'],
  planner: [],
};

/** โหมดนี้ใช้ปุ่มนี้ได้ไหม */
export function fmtSupported(mode, id) {
  const list = FMT_UNSUPPORTED[mode];
  return !(list && list.includes(id));
}

/**
 * โหมดมาตรฐาน — [alpha.151] ไม่ยุบทุกอย่างเป็น 'prose' อีกแล้ว
 * ที่ที่ไม่ใช่ตัวแก้ไขนิยาย/บท (Wiki · แดชบอร์ด · หน้าแรก) ได้ชุดปุ่มของตัวเอง = `all`
 */
export function fmtMode(mode) {
  return FMT_MODES.includes(mode) ? mode : 'prose';
}

/** ปุ่มบนแถบลอยที่ผู้ใช้ตั้งค่าได้ (ตัดตัวที่โปรแกรมคุมเองออก) */
export function fmtbarConfigurableIds() {
  return FMTBAR_IDS.filter((id) => !LOCKED_BUTTONS.includes(id));
}

/**
 * กลุ่มปุ่มสำหรับหน้าตั้งค่า **แถบเครื่องมือหลัก** — ตัดตัวที่ย้ายไปอยู่บนแถบลอยออก
 * (ไม่งั้นจะมีสวิตช์สองที่คุมปุ่มเดียวกัน แล้วผู้ใช้ติ๊กที่หนึ่งแต่ไปเปลี่ยนอีกที่)
 */
export function mainbarGroups() {
  return TOOLBAR_GROUPS
    .map((g) => ({ ...g, buttons: g.buttons.filter((b) => !isFmtbarButton(b.id)) }))
    .filter((g) => g.buttons.length);
}

/** จำนวนปุ่มที่เปิดอยู่ / ทั้งหมด **เฉพาะแถบเครื่องมือหลัก** */
export function mainbarCounts(cfg) {
  const ids = mainbarGroups().flatMap((g) => g.buttons.map((b) => b.id))
    .filter((id) => isConfigurable(id));
  const n = normalizeToolbar(cfg);
  return { total: ids.length, on: ids.filter((id) => !n.hidden[id]).length };
}

/**
 * กลุ่มปุ่มสำหรับหน้าตั้งค่าแถบลอย — ใช้กลุ่มเดียวกับแถบเครื่องมือ แต่กรองเหลือเฉพาะตัวที่อยู่บนแถบลอย
 * (จึงไม่มีทางที่ชื่อกลุ่มสองที่จะไม่ตรงกัน)
 */
export function fmtbarGroups() {
  return FMTBAR_GROUPS
    .map((g) => ({ ...g, buttons: g.buttons.filter((id) => isConfigurable(id)).map((id) => ({ id })) }))
    .filter((g) => g.buttons.length);
}

/**
 * ทำค่าที่อ่านมาให้อยู่ในรูปมาตรฐาน: `{ prose:{hidden:{}}, screenplay:{hidden:{}} }`
 *
 * `legacy` = `settings.toolbar` ก้อนเก่า — ถ้ายังไม่เคยตั้งค่าแถบลอยเลย ให้ **สืบทอด**
 * ตัวที่เคยซ่อนไว้มาใส่ทั้งสองโหมด ผู้ใช้จะได้ไม่เจอปุ่มที่เคยเอาออกแล้วโผล่กลับมาเอง
 */
export function normalizeFmtbar(cfg, legacy) {
  // [alpha.151] โหมด `planner` คุมปุ่มคนละชุด (แถบของกระดาน) จึงต้องรู้จักทั้งสองชุด
  const known = new Set([...fmtbarConfigurableIds(), ...PLANNER_BAR_IDS]);
  const out = {};
  const src = (cfg && typeof cfg === 'object') ? cfg : null;
  let inherit = null;
  if (!src && legacy) {
    const old = normalizeToolbar(legacy);
    inherit = Object.keys(old.hidden).filter((id) => known.has(id));
  }
  for (const m of FMT_MODES) {
    const hidden = {};
    const raw = (src && src[m] && typeof src[m].hidden === 'object') ? src[m].hidden : null;
    if (raw) { for (const id of Object.keys(raw)) if (raw[id] && known.has(id)) hidden[id] = true; }
    else if (inherit) { for (const id of inherit) hidden[id] = true; }
    // [alpha.151 ข้อ 6] `shown` = "ขอเห็นปุ่มนี้แม้โหมดนี้จะใช้มันไม่ได้"
    const shown = {};
    const rs = (src && src[m] && typeof src[m].shown === 'object') ? src[m].shown : null;
    if (rs) { for (const id of Object.keys(rs)) if (rs[id] && known.has(id)) shown[id] = true; }
    out[m] = { hidden, shown };
  }
  return out;
}

/** ปุ่มนี้ถูกซ่อนในโหมดนี้ไหม */
export function fmtbarHidden(cfg, mode, id) {
  if (!fmtbarConfigurableIds().includes(id)) return false;      // ตัวที่โปรแกรมคุมเอง = ไม่แตะ
  return !!normalizeFmtbar(cfg)[fmtMode(mode)].hidden[id];
}

/** เปิด/ปิดปุ่มหนึ่งตัวในโหมดหนึ่ง → คืน cfg ก้อนใหม่ */
export function setFmtbarVisible(cfg, mode, id, on) {
  const next = normalizeFmtbar(cfg);
  // [alpha.151] โหมด `planner` คุมปุ่มของแถบกระดาน ซึ่งเป็นคนละชุดกับของตัวแก้ไข
  const ok = fmtMode(mode) === 'planner'
    ? PLANNER_BAR_IDS.includes(id)
    : fmtbarConfigurableIds().includes(id);
  if (!ok) return next;
  const m = fmtMode(mode);
  const hidden = { ...next[m].hidden };
  if (on) delete hidden[id]; else hidden[id] = true;
  return { ...next, [m]: { ...next[m], hidden } };
}

/** เปิด/ปิดทั้งกลุ่มในโหมดหนึ่ง */
export function setFmtbarGroupVisible(cfg, mode, groupKey, on) {
  let next = cfg;
  const g = fmtbarGroups().find((x) => x.key === groupKey);
  if (!g) return normalizeFmtbar(cfg);
  for (const b of g.buttons) next = setFmtbarVisible(next, mode, b.id, on);
  return normalizeFmtbar(next);
}

/** เปิดปุ่มทั้งหมดของโหมดหนึ่ง (อีกโหมดไม่กระทบ) */
export function setFmtbarGroupVisibleAll(cfg, mode) {
  const next = normalizeFmtbar(cfg);
  return { ...next, [fmtMode(mode)]: { hidden: {}, shown: next[fmtMode(mode)].shown || {} } };
}

/** คืนค่าเริ่มต้น (ทุกโหมดเปิดหมด) */
export function resetFmtbarConfig() {
  const out = {};
  for (const m of FMT_MODES) out[m] = { hidden: {}, shown: {} };
  return out;
}

/** จำนวนปุ่มที่เปิดอยู่ / ทั้งหมด ของโหมดหนึ่ง */
export function fmtbarCounts(cfg, mode) {
  const ids = fmtbarConfigurableIds();
  const n = normalizeFmtbar(cfg)[fmtMode(mode)];
  return { total: ids.length, on: ids.filter((id) => !n.hidden[id]).length };
}

/**
 * แผนการแสดงผลของแถบลอยทั้งแถบ — ตัวเดียวที่ฝั่ง DOM ต้องเรียก
 * @param {string[]} seq ลำดับจริงของลูกในแถบ (`id` · `'sep'` · `null` = ของแถบเอง)
 * @returns {{show:boolean[], grey:boolean[]}} `grey` = เห็นอยู่แต่ใช้ไม่ได้ในโหมดนี้
 */
export function layoutFmtbar(seq, cfg, mode) {
  const list = Array.isArray(seq) ? seq : [];
  const m = fmtMode(mode);
  // ══ [alpha.151 ข้อ 6] ★ "สีเทา" ถูกถอดทิ้ง — ใช้ไม่ได้ในโหมดนี้ = **ไม่โผล่เลย** ══
  //
  // ผู้ใช้: *"ตอนนี้ float bar ยาวมาก … ส่วนที่เป็น grey out จะไม่ให้ปรากฏมาเลย
  //          จนกว่าผู้ใช้จะติ๊กให้แสดงใน setting"*
  //
  // เดิมปุ่มที่โหมดนี้ใช้ไม่ได้ยังกินที่บนแถบอยู่ (แค่จางลง) — แถบจึงยาวเกินจอทั้งที่
  // ครึ่งหนึ่งกดไม่ได้ · ตอนนี้ตัดออกจากแถบไปเลย แล้วให้ผู้ใช้ติ๊กกลับมาเองได้ที่หน้าตั้งค่า
  // (`shown` = "ขอเห็นแม้โหมดนี้จะใช้ไม่ได้" — เก็บแยกจาก `hidden` เพื่อไม่ให้สองความหมายปนกัน)
  const forced = forcedShown(cfg, m);
  const vis = (id) => {
    if (fmtbarHidden(cfg, m, id)) return false;
    if (!fmtSupported(m, id) && !forced.has(id)) return false;
    return true;
  };
  const show = layoutToolbar(list.map((x) => (x == null ? ' keep' : x)),
                             (x) => (x === ' keep' ? true : vis(x)));
  // ตัวที่ผู้ใช้สั่งให้โผล่ทั้งที่โหมดนี้ใช้ไม่ได้ — ยังทำเป็นสีเทาไว้ให้เห็นว่ากดไม่ได้
  const grey = list.map((x) => (x && x !== 'sep' ? !fmtSupported(m, x) : false));
  return { show, grey };
}

/** ปุ่มที่ผู้ใช้สั่งให้ "โผล่แม้โหมดนี้จะใช้ไม่ได้" */
export function forcedShown(cfg, mode) {
  const m = fmtMode(mode);
  const raw = cfg && cfg[m] && cfg[m].shown;
  return new Set(raw && typeof raw === 'object' ? Object.keys(raw).filter((k) => raw[k]) : []);
}

/** สั่งให้ปุ่มที่โหมดนี้ใช้ไม่ได้ โผล่/ไม่โผล่ (ค่าเริ่มต้น = ไม่โผล่) */
export function setFmtbarForceShown(cfg, mode, id, on) {
  const next = normalizeFmtbar(cfg);
  const m = fmtMode(mode);
  const shown = { ...(next[m].shown || {}) };
  if (on) shown[id] = true; else delete shown[id];
  return { ...next, [m]: { ...next[m], shown } };
}

