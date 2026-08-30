// fab-config.js — [alpha.111] ปุ่มลอยมุมจอ (FAB): ผู้ใช้เลือกคำสั่งเองได้ **บริสุทธิ์ 100% · มี unit test**
//
// เดิม FAB มีคำสั่งตายตัว 6 อันใน index.html — ใครไม่ได้เขียนนิยายก็ต้องมองปุ่ม "สร้างฉาก" ทุกวัน
// ตอนนี้เลือกได้เองจากรายการยาว แต่ **ไม่เกิน 4 อัน** (เกินกว่านั้นเมนูวงกลมจะซ้อนกันจนกดผิด)
//
// ═══ ทำไมเป็นโมดูลบริสุทธิ์ ═══
// สองอย่างที่พลาดง่ายที่สุดคำนวณได้ล้วน ๆ ไม่ต้องมีจอ:
//   1. กฎ "ไม่เกิน 4" + ลำดับ (เพิ่ม/ถอด/สลับที่ แล้วต้องไม่มีตัวซ้ำ ไม่มีตัวหาย)
//   2. **เรขาคณิตของเมนูวงกลม** — มุม ระยะ และรัศมีที่พอดีไม่ให้ปุ่มทับกัน
// ทั้งคู่จึงอยู่ที่นี่ทั้งหมด ฝั่ง DOM แค่เอาตัวเลขไปแปะเป็น transform
//
// ═══ คำสั่งมาจากไหน ═══
// ทุกรายการชี้ไปที่ **ช่องคำสั่งเดิมของโปรแกรม** (`handleCommand(cmd, ...args)`)
// ไม่มีตรรกะซ้อนของ FAB เอง — เพิ่มคำสั่งใหม่ในตารางนี้แล้วใช้ได้ทันที

/** จำนวนคำสั่งสูงสุดบน FAB (ผู้ใช้กำหนด — เกินนี้เมนูวงกลมกดผิดง่าย) */
export const FAB_MAX = 4;

/** รูปแบบการแสดงคำสั่ง */
export const FAB_DISPLAYS = ['icon', 'iconText', 'text'];
export const FAB_DISPLAY_LABELS = {
  icon: 'ui.fab.dispIcon', iconText: 'ui.fab.dispIconText', text: 'ui.fab.dispText',
};

/**
 * คำสั่งทั้งหมดที่เอาขึ้น FAB ได้
 * `cmd`/`args` = ช่องคำสั่งของ handleCommand · `icon` = ชื่อไอคอนใน icons.js
 * `grp` = กลุ่มในกล่องตั้งค่า (create / write / view / file)
 */
export const FAB_ACTIONS = [
  { id: 'scene',     cmd: 'scene',        icon: 'file',         grp: 'create', labelKey: 'ui.fab.actScene' },
  { id: 'chapter',   cmd: 'chapter',      icon: 'folder',       grp: 'create', labelKey: 'ui.fab.actChapter' },
  { id: 'character', cmd: 'new-entity', args: ['characters'], icon: 'user',    grp: 'create', labelKey: 'ui.fab.actCharacter' },
  { id: 'location',  cmd: 'new-entity', args: ['locations'],  icon: 'map',     grp: 'create', labelKey: 'ui.fab.actLocation' },
  { id: 'item',      cmd: 'new-entity', args: ['items'],      icon: 'briefcase',    grp: 'create', labelKey: 'ui.fab.actItem' },
  { id: 'lore',      cmd: 'new-entity', args: ['lore'],       icon: 'book-content', grp: 'create', labelKey: 'ui.fab.actLore' },
  { id: 'memo',      cmd: 'memo',         icon: 'clipboard',    grp: 'create', labelKey: 'ui.fab.actMemo' },
  { id: 'template',  cmd: 'new-from-template', icon: 'star',    grp: 'create', labelKey: 'ui.fab.actTemplate' },

  { id: 'note',      cmd: 'scratchpad',   icon: 'note',         grp: 'write',  labelKey: 'ui.fab.actNote' },
  { id: 'quicknote', cmd: 'quick-note',   icon: 'edit',         grp: 'write',  labelKey: 'ui.fab.actQuickNote' },
  { id: 'search',    cmd: 'global-search', icon: 'search',      grp: 'write',  labelKey: 'ui.fab.actSearch' },
  { id: 'quickopen', cmd: 'quick-open',   icon: 'book-open',    grp: 'write',  labelKey: 'ui.fab.actQuickOpen' },
  { id: 'image',     cmd: 'insert-image', icon: 'image-add',    grp: 'write',  labelKey: 'ui.fab.actImage' },

  { id: 'dashboard', cmd: 'toggle-panel', args: ['dashboard'], icon: 'chart',  grp: 'view',   labelKey: 'ui.fab.actDashboard' },
  { id: 'timeline',  cmd: 'toggle-panel', args: ['timeline'],  icon: 'history', grp: 'view',  labelKey: 'ui.fab.actTimeline' },
  { id: 'maps',      cmd: 'toggle-panel', args: ['maps'],      icon: 'globe',  grp: 'view',   labelKey: 'ui.fab.actMaps' },
  { id: 'kanban',    cmd: 'kanban',       icon: 'grid',         grp: 'view',   labelKey: 'ui.fab.actKanban' },
  { id: 'gallery',   cmd: 'gallery',      icon: 'image',        grp: 'view',   labelKey: 'ui.fab.actGallery' },
  { id: 'focus',     cmd: 'focus-mode',   icon: 'eye',          grp: 'view',   labelKey: 'ui.fab.actFocus' },

  { id: 'saveall',   cmd: 'save-all',     icon: 'save',         grp: 'file',   labelKey: 'ui.fab.actSaveAll' },
  { id: 'snapshot',  cmd: 'backup-now',   icon: 'archive',      grp: 'file',   labelKey: 'ui.fab.actSnapshot' },
  { id: 'export',    cmd: 'export-hub',   icon: 'book-content', grp: 'file',   labelKey: 'ui.fab.actExport' },
  { id: 'settings',  cmd: 'settings',     icon: 'cog',          grp: 'file',   labelKey: 'ui.fab.actSettings' },
];

/** กลุ่มในกล่องตั้งค่า (เรียงตามลำดับที่จะโชว์) */
export const FAB_GROUPS = [
  { key: 'create', labelKey: 'ui.fab.grpCreate' },
  { key: 'write',  labelKey: 'ui.fab.grpWrite' },
  { key: 'view',   labelKey: 'ui.fab.grpView' },
  { key: 'file',   labelKey: 'ui.fab.grpFile' },
];

/** ค่าเริ่มต้น = ชุดเดิมที่เคยฝังไว้ใน index.html (ตัดให้เหลือ 4 ตามกฎใหม่) */
export const DEFAULT_FAB_ACTIONS = ['scene', 'chapter', 'character', 'location'];

/** id ทั้งหมดที่มีให้เลือก */
export function allFabIds() { return FAB_ACTIONS.map((a) => a.id); }

/** นิยามของคำสั่งหนึ่งตัว (ไม่มีคืน null) */
export function fabAction(id) { return FAB_ACTIONS.find((a) => a.id === id) || null; }

/** คำสั่งในกลุ่มนี้ */
export function fabGroupActions(key) { return FAB_ACTIONS.filter((a) => a.grp === key); }

/**
 * ทำค่าที่อ่านมาจาก settings ให้อยู่ในรูปมาตรฐาน
 * รูปแบบที่เก็บ: `{ actions:['scene','memo'], display:'icon' }`
 * — ทิ้ง id ที่ไม่รู้จัก · ทิ้งตัวซ้ำ · ตัดที่ FAB_MAX · ว่างเปล่า = ใช้ค่าเริ่มต้น
 */
export function normalizeFab(cfg) {
  const src = (cfg && typeof cfg === 'object') ? cfg : {};
  const known = new Set(allFabIds());
  const seen = new Set();
  const actions = [];
  for (const id of (Array.isArray(src.actions) ? src.actions : [])) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id); actions.push(id);
    if (actions.length >= FAB_MAX) break;
  }
  // ไม่เคยตั้ง = ชุดเริ่มต้น · ตั้งแล้วถอดออกหมด = ว่างจริง ๆ (เคารพเจตนาผู้ใช้)
  const list = Array.isArray(src.actions) ? actions : DEFAULT_FAB_ACTIONS.slice();
  const display = FAB_DISPLAYS.includes(src.display) ? src.display : 'icon';
  return { actions: list, display };
}

/** คำสั่งนี้อยู่บน FAB อยู่ไหม */
export function hasFabAction(cfg, id) { return normalizeFab(cfg).actions.includes(id); }

/** ยังเพิ่มได้อีกไหม */
export function canAddFab(cfg) { return normalizeFab(cfg).actions.length < FAB_MAX; }

/**
 * เพิ่ม/ถอดคำสั่ง — คืน cfg ก้อนใหม่เสมอ (ไม่แก้ของเดิม)
 * เพิ่มตอนเต็มแล้ว = **ไม่เปลี่ยนอะไรเลย** (ฝั่ง UI เป็นคนบอกผู้ใช้ว่าเต็ม)
 */
export function toggleFabAction(cfg, id, on) {
  const next = normalizeFab(cfg);
  if (!fabAction(id)) return next;
  const at = next.actions.indexOf(id);
  if (on) {
    if (at >= 0 || next.actions.length >= FAB_MAX) return next;
    return { ...next, actions: [...next.actions, id] };
  }
  if (at < 0) return next;
  return { ...next, actions: next.actions.filter((x) => x !== id) };
}

/** สลับลำดับขึ้น/ลง (`dir` = -1 ขึ้น · +1 ลง) */
export function moveFabAction(cfg, id, dir) {
  const next = normalizeFab(cfg);
  const at = next.actions.indexOf(id);
  const to = at + (dir < 0 ? -1 : 1);
  if (at < 0 || to < 0 || to >= next.actions.length) return next;
  const arr = next.actions.slice();
  arr.splice(to, 0, arr.splice(at, 1)[0]);
  return { ...next, actions: arr };
}

/** เปลี่ยนรูปแบบการแสดง */
export function setFabDisplay(cfg, display) {
  const next = normalizeFab(cfg);
  return { ...next, display: FAB_DISPLAYS.includes(display) ? display : next.display };
}

/** คืนค่าเริ่มต้นทั้งชุด */
export function resetFabConfig() { return { actions: DEFAULT_FAB_ACTIONS.slice(), display: 'icon' }; }

/** รายการคำสั่งพร้อมนิยาม เรียงตามที่ผู้ใช้จัดไว้ — ฝั่ง UI วนตัวนี้ตัวเดียว */
export function fabMenuItems(cfg) {
  return normalizeFab(cfg).actions.map((id) => fabAction(id)).filter(Boolean);
}

// ═══════════════ เรขาคณิตของเมนูวงกลม (radial FAB menu) ═══════════════
//
// อ้างอิงหน้าตาจาก Material radial FAB menu: ปุ่มลูกกางออกเป็นเสี้ยววงกลมรอบปุ่มแม่
// พร้อมหน่วงเวลาไล่กันทีละตัว · ตอนปิดไล่กลับทางตรงข้าม
//
// พิกัดที่คืนเป็น **ค่าชดเชยจากจุดกึ่งกลางปุ่มแม่** (หน่วย px · พิกัดหน้าจอ: x ชี้ขวา · y ชี้ลง)
// `dirX/dirY` = ทิศที่กาง (+1 ขวา/ลง · -1 ซ้าย/ขึ้น) ตรงกับที่ `fabOpenDir()` คืนมา

const DEG = Math.PI / 180;

/** ทิศที่เมนูควรกาง เมื่อรู้ว่าปุ่มแม่อยู่ตรงไหนของจอ */
export function fabOpenDir(cx, cy, vw, vh) {
  return { dirX: cx > vw / 2 ? -1 : 1, dirY: cy > vh / 2 ? -1 : 1 };
}

/**
 * รัศมีที่เล็กที่สุดที่ปุ่มลูกยังไม่ทับกัน
 * ระยะห่างตามส่วนโค้งระหว่างสองตัวติดกัน = r · Δมุม → r ≥ (ขนาด+ช่องไฟ) / Δมุม
 * @param {number} n จำนวนปุ่ม
 * @param {number} item ขนาดปุ่มลูก (ด้านที่ยาวที่สุด)
 * @param {number} gap ช่องไฟที่ต้องการ
 * @param {number} spread ความกว้างของเสี้ยว (องศา)
 * @param {number} min รัศมีขั้นต่ำ (ให้พ้นตัวปุ่มแม่)
 */
export function fabRadius(n, item, gap = 12, spread = 90, min = 84) {
  if (!(n > 1)) return min;
  const step = (spread / (n - 1)) * DEG;
  if (!(step > 0)) return min;
  return Math.max(min, (item + gap) / step);
}

/**
 * ตำแหน่งปุ่มลูกทุกตัว
 * @param {number} n จำนวนปุ่ม
 * @param {object} [o] `{radius, dirX, dirY, spread, start, stagger, closing}`
 *   · `start` = มุมของตัวแรก (0 = ออกด้านข้าง · 90 = ตรงขึ้น/ลง)
 *   · `stagger` = หน่วงต่อตัว (ms) · `closing` = ไล่กลับทาง
 * @returns {{x:number,y:number,angle:number,delay:number}[]}
 */
export function fabRadialPositions(n, o = {}) {
  const count = Math.max(0, Math.floor(n));
  if (!count) return [];
  const radius = o.radius > 0 ? o.radius : 96;
  const dirX = o.dirX < 0 ? -1 : 1;
  const dirY = o.dirY < 0 ? -1 : 1;
  const spread = Number.isFinite(o.spread) ? o.spread : 90;
  const start = Number.isFinite(o.start) ? o.start : 0;
  const stagger = Number.isFinite(o.stagger) ? o.stagger : 45;
  const out = [];
  for (let i = 0; i < count; i++) {
    // ตัวเดียว = วางกลางเสี้ยว (ไม่งั้นหารศูนย์)
    const angle = count === 1 ? start + spread / 2 : start + (spread * i) / (count - 1);
    const rad = angle * DEG;
    out.push({
      angle,
      x: dirX * radius * Math.cos(rad),
      // ทั้งสองแกนใช้พิกัดหน้าจอตรง ๆ (y ชี้ลง) → dirY=-1 = กางขึ้น · +1 = กางลง
      y: dirY * radius * Math.sin(rad),
      delay: (o.closing ? (count - 1 - i) : i) * stagger,
    });
  }
  return out;
}

/**
 * ═══ ปุ่มที่ "มีข้อความ" ต้องเรียงเป็นแถวตั้ง ไม่ใช่วงกลม ═══
 *
 * บนส่วนโค้ง ระยะห่าง **แนวตั้ง** ระหว่างสองตัวที่ติดกันจะแคบลงเรื่อย ๆ เมื่อเข้าใกล้ยอด
 * (sin เกือบราบตรงนั้น) — ปุ่มไอคอนกลม ๆ ไม่เป็นไรเพราะมันขยับออกทางแนวนอนแทน
 * แต่ **ป้ายยาว ๆ ทับกันในแนวนอนอยู่แล้วทุกตัว** เหลือแค่แนวตั้งที่กันไม่ให้ทับ → ตัวบน ๆ ซ้อนกัน
 * (เห็นกับตาในสกรีนช็อตรอบแรก: "สร้าง Memo" ทับ "สร้างตัวละคร")
 *
 * Material เองก็แยกสองแบบนี้: speed dial **แบบมีป้าย = แถวตั้ง** · แบบไอคอนล้วน = วงกลม
 *
 * @param {number} n จำนวนปุ่ม
 * @param {object} [o] `{item, gap, offset, dirY, stagger, closing}`
 * @returns {{x:number,y:number,delay:number}[]}
 */
export function fabStackPositions(n, o = {}) {
  const count = Math.max(0, Math.floor(n));
  if (!count) return [];
  const item = o.item > 0 ? o.item : 42;
  const gap = Number.isFinite(o.gap) ? o.gap : 10;
  const offset = Number.isFinite(o.offset) ? o.offset : 62;
  const dirY = o.dirY < 0 ? -1 : 1;
  const stagger = Number.isFinite(o.stagger) ? o.stagger : 45;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: 0,
      y: dirY * (offset + i * (item + gap)),
      delay: (o.closing ? (count - 1 - i) : i) * stagger,
    });
  }
  return out;
}

/** เวลารวมของแอนิเมชัน (ใช้ตั้ง timer ซ่อนเมนูหลังปิดสนิท) */
export function fabAnimMs(n, stagger = 45, dur = 220) {
  return Math.max(0, (Math.max(0, n - 1)) * stagger) + dur;
}

// ═══════════════ ตำแหน่งปุ่มแม่ (ลากย้ายด้วยคลิกขวา) ═══════════════

/**
 * หนีบตำแหน่ง FAB ให้อยู่ในจอเสมอ — ใช้ทั้งตอนลากและตอนโหลดค่าที่จำไว้
 * (จอที่เล็กลงกว่าตอนบันทึกไม่ควรทำให้ปุ่มหายออกนอกขอบ)
 */
export function clampFabPos(pos, size, vw, vh, pad = 6) {
  const w = size && size.width > 0 ? size.width : 52;
  const h = size && size.height > 0 ? size.height : 52;
  const maxL = Math.max(pad, vw - w - pad);
  const maxT = Math.max(pad, vh - h - pad);
  return {
    left: Math.min(Math.max(pad, Math.round(pos && pos.left || 0)), maxL),
    top: Math.min(Math.max(pad, Math.round(pos && pos.top || 0)), maxT),
  };
}
