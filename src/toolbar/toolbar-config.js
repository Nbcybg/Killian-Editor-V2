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
];

/**
 * กลุ่มปุ่มบนแถบเครื่องมือ — เรียงตามลำดับจริงใน index.html
 * `def:false` = ซ่อนไว้เป็นค่าเริ่มต้น (ปุ่มเฉพาะทาง)
 */
export const TOOLBAR_GROUPS = [
  { key: 'view', labelKey: 'ui.tbcfg.grpView', buttons: [
    { id: 'tb-paper' }, { id: 'tb-theme' }, { id: 'tb-read' },
    { id: 'tb-focus' }, { id: 'tb-typewriter' }, { id: 'tb-linenum' }, { id: 'tb-md-codes' },
  ] },
  { key: 'style', labelKey: 'ui.tbcfg.grpStyle', buttons: [
    { id: 'tb-style' }, { id: 'tb-case' },
    { id: 'tb-bold' }, { id: 'tb-italic' }, { id: 'tb-underline' }, { id: 'tb-strike' },
    { id: 'tb-ul' }, { id: 'tb-ol' }, { id: 'tb-quote' },
  ] },
  { key: 'align', labelKey: 'ui.tbcfg.grpAlign', buttons: [
    { id: 'tb-align-left' }, { id: 'tb-align-center' },
    { id: 'tb-align-right' }, { id: 'tb-align-justify' },
  ] },
  { key: 'insert', labelKey: 'ui.tbcfg.grpInsert', buttons: [
    { id: 'tb-img' }, { id: 'tb-gallery' }, { id: 'tb-source' },
  ] },
  { key: 'find', labelKey: 'ui.tbcfg.grpFind', buttons: [
    { id: 'tb-gsearch' }, { id: 'tb-quickopen' },
  ] },
  { key: 'tabs', labelKey: 'ui.tbcfg.grpTabs', buttons: [
    { id: 'tb-split' }, { id: 'tb-close' }, { id: 'tb-close-all' },
  ] },
  { key: 'panels', labelKey: 'ui.tbcfg.grpPanels', buttons: [
    { id: 'tb-tree-panel' }, { id: 'tb-outline-panel' }, { id: 'tb-props-panel' },
    { id: 'tb-search-panel' }, { id: 'tb-note' }, { id: 'tb-panels' },
    { id: 'tb-kanban' }, { id: 'tb-dashboard' },
    { id: 'tb-dialogue' },                       // [alpha.79] แผงบทพูด
    { id: 'tb-codex' }, { id: 'tb-history' }, { id: 'tb-record' },
    // [alpha.80] แผงที่มีมานานแต่ไม่เคยมีปุ่มบนแถบ
    { id: 'tb-comments' }, { id: 'tb-notes-panel' }, { id: 'tb-log' },
  ] },
  { key: 'story', labelKey: 'ui.tbcfg.grpStory', buttons: [
    { id: 'tb-timeline' }, { id: 'tb-maps' }, { id: 'tb-books' }, { id: 'tb-network' },
    { id: 'tb-planner' }, { id: 'tb-branch' }, { id: 'tb-floorplan' }, { id: 'tb-player' },
    { id: 'tb-gallery-board' },
  ] },
  { key: 'ai', labelKey: 'ui.tbcfg.grpAi', buttons: [
    { id: 'tb-ai' }, { id: 'tb-ai-chat' }, { id: 'tb-ai-analyzer' },
  ] },
  { key: 'ext', labelKey: 'ui.tbcfg.grpExt', buttons: [
    { id: 'tb-plugins' },                        // [alpha.79] แผงจัดการปลั๊กอิน
    { id: 'tb-plug' },                           // เมนูคำสั่งที่ปลั๊กอินลงทะเบียนไว้
  ] },
];

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
