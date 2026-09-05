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
    { id: 'tb-theme' }, { id: 'tb-read' },
    { id: 'tb-focus' }, { id: 'tb-typewriter' }, { id: 'tb-linenum' }, { id: 'tb-md-codes' },
  ] },
  { key: 'style', labelKey: 'ui.tbcfg.grpStyle', buttons: [
    { id: 'tb-style' }, { id: 'tb-case' },
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
    { id: 'tb-dlgb' },                           // [alpha.82] ห้องซ้อมบท
    { id: 'tb-codex' }, { id: 'tb-history' }, { id: 'tb-record' },
    // [alpha.80] แผงที่มีมานานแต่ไม่เคยมีปุ่มบนแถบ
    { id: 'tb-comments' }, { id: 'tb-notes-panel' }, { id: 'tb-log' },
  ] },
  { key: 'story', labelKey: 'ui.tbcfg.grpStory', buttons: [
    { id: 'tb-timeline' }, { id: 'tb-maps' }, { id: 'tb-books' }, { id: 'tb-network' },
    { id: 'tb-planner' }, { id: 'tb-branch' }, { id: 'tb-floorplan' }, { id: 'tb-player' },
    { id: 'tb-gallery-board' }, { id: 'tb-backlinks' },
  ] },
  { key: 'ai', labelKey: 'ui.tbcfg.grpAi', buttons: [
    { id: 'tb-ai-hub' },                         // [alpha.116] AI Hub — ประตูเดียวของทุกความสามารถ AI
    { id: 'tb-ai' }, { id: 'tb-ai-chat' }, { id: 'tb-ai-analyzer' },
    { id: 'tb-starter' },                        // [alpha.94] Story Starter
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
export const FMT_MODES = ['prose', 'screenplay'];

/**
 * ปุ่มบนแถบรูปแบบลอย **เรียงตามลำดับจริง** — ต้องตรงกับรายการใน `setupFloatingFormatBar()`
 * (ตัวที่ไม่ได้อยู่ใน TOOLBAR_GROUPS เช่น `tb-fmt-here` ถือว่าเป็นของแถบ คุมไม่ได้)
 */
export const FMTBAR_IDS = [
  'tb-sp-elem', 'sp-view-select', 'tb-mode', 'tb-style', 'tb-case',
  'tb-bold', 'tb-italic', 'tb-underline', 'tb-strike', 'tb-sup', 'tb-sub',
  'tb-color',
  'tb-ul', 'tb-ol', 'tb-quote',
  'tb-align-left', 'tb-align-center', 'tb-align-right', 'tb-align-justify',
  'tb-indent', 'tb-sp-cont',
  'tb-img', 'tb-source', 'tb-read', 'tb-gsearch',
];

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
  prose: ['tb-sp-elem', 'tb-sp-cont'],   // (`tb-sp-ext` อยู่บนแถบหลัก ไม่ใช่แถบลอย)
};

/** โหมดนี้ใช้ปุ่มนี้ได้ไหม */
export function fmtSupported(mode, id) {
  const list = FMT_UNSUPPORTED[mode];
  return !(list && list.includes(id));
}

/** โหมดเอกสารมาตรฐาน (อะไรที่ไม่ใช่ 'screenplay' ถือเป็น 'prose' — wiki ใช้เอนจินเดียวกับนิยาย) */
export function fmtMode(mode) { return mode === 'screenplay' ? 'screenplay' : 'prose'; }

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
  return TOOLBAR_GROUPS
    .map((g) => ({ ...g, buttons: g.buttons.filter((b) => isFmtbarButton(b.id) && isConfigurable(b.id)) }))
    .filter((g) => g.buttons.length);
}

/**
 * ทำค่าที่อ่านมาให้อยู่ในรูปมาตรฐาน: `{ prose:{hidden:{}}, screenplay:{hidden:{}} }`
 *
 * `legacy` = `settings.toolbar` ก้อนเก่า — ถ้ายังไม่เคยตั้งค่าแถบลอยเลย ให้ **สืบทอด**
 * ตัวที่เคยซ่อนไว้มาใส่ทั้งสองโหมด ผู้ใช้จะได้ไม่เจอปุ่มที่เคยเอาออกแล้วโผล่กลับมาเอง
 */
export function normalizeFmtbar(cfg, legacy) {
  const known = new Set(fmtbarConfigurableIds());
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
    out[m] = { hidden };
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
  if (!fmtbarConfigurableIds().includes(id)) return next;
  const m = fmtMode(mode);
  const hidden = { ...next[m].hidden };
  if (on) delete hidden[id]; else hidden[id] = true;
  return { ...next, [m]: { hidden } };
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
  return { ...next, [fmtMode(mode)]: { hidden: {} } };
}

/** คืนค่าเริ่มต้น (ทุกโหมดเปิดหมด) */
export function resetFmtbarConfig() {
  const out = {};
  for (const m of FMT_MODES) out[m] = { hidden: {} };
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
  const vis = (id) => !fmtbarHidden(cfg, m, id);
  const show = layoutToolbar(list.map((x) => (x == null ? ' keep' : x)),
                             (x) => (x === ' keep' ? true : vis(x)));
  const grey = list.map((x) => (x && x !== 'sep' ? !fmtSupported(m, x) : false));
  return { show, grey };
}
