// planner-data.js — Data layer (บริสุทธิ์) สำหรับ Planner v4
// ไม่ import DOM, Fabric.js, หรือ core.js — ใช้แค่ num.js  (unit test ได้ตรง ๆ)
import { t as tt, t } from '../i18n.js';
import { num, numClamp, numInt } from '../num.js';

export const CARD_W = 180, CARD_H = 110;
export const STICKY_W = 160, STICKY_H = 160;
export const FRAME_W = 640, FRAME_H = 420;

// ชนิดโหนด — 5 ตัวแรกคือการ์ดผูกเนื้อเรื่อง, ที่เหลือคือเครื่องมือกระดานแบบ Miro
// [alpha.150] `image` = รูปบนกระดาน · `todo` = รายการสิ่งที่ต้องทำ (ติ๊กได้)
export const NODE_TYPES = ['scene', 'chapter', 'entity', 'note', 'sticky', 'text', 'shape', 'frame', 'comment', 'image', 'todo'];
export const CARD_TYPES = ['scene', 'chapter', 'entity', 'note'];
/**
 * ชนิดโหนด → **ชื่อไอคอนในทะเบียน** (`icons/svg/<ชื่อ>.svg` · ตัวสำรองจาก `icons/glyphs.csv`)
 *
 * [alpha.150r] เดิมตารางนี้เก็บ **ตัวอีโมจิ** ไว้ตรง ๆ ซึ่งขัดกฎ alpha.147
 * ("อย่าเขียนไอคอนลงโค้ด — เปลี่ยนไอคอน = วาง svg ชื่อเดิมลง icons/svg/")
 * ตอนนี้เก็บแค่ *ชื่อ* · ฝั่งที่วาดบน DOM ใช้ `icon(name)` (ได้ svg จริง)
 * ฝั่งที่วาดบนผืน canvas ใช้ตัวอักษรสำรองจากทะเบียนผ่าน `glyphOf()` ใน planner-render.js
 */
export const ICONS = {
  scene: 'file', chapter: 'folder', entity: 'user', note: 'note', sticky: 'pin',
  text: 'text-box', shape: 'square', frame: 'frame', comment: 'chat',
  image: 'image', todo: 'checklist',
};
export const SHAPES = ['rect', 'round', 'ellipse', 'diamond', 'triangle', 'star', 'arrow', 'cylinder'];

/**
 * [alpha.150] วิธีวางรูปในกรอบ — ใช้ทั้งโหนดรูปและพื้นหลังกระดาน (ค่าชุดเดียวกัน)
 *   full = ยืดเต็มกรอบ (บิดสัดส่วน) · fit = ย่อให้เห็นทั้งรูป · fill = ครอบเต็มแล้วเฉือนส่วนเกิน · tile = ปูซ้ำ
 */
export const IMAGE_FITS = ['full', 'fit', 'fill', 'tile'];

/**
 * ══ [alpha.151] ★ การจัดวาง **ตัวหนังสือในการ์ด** ══
 *
 * ผู้ใช้: *"ชิดขอบบน กึ่งกลางแนวตั้ง ชิดขอบล่าง ใช้ใน planner คือตัว card เวลาเราใส่ตัวหนังสือ
 *          มันจะอยู่ตรงกลาง card อย่างเดียว … เราอยากได้แบบ บาง card ตัวหนังสืออยู่ขอบบนซ้าย
 *          บางครั้งกลางกลาง — ไม่ใช่ขยับ card"*
 *
 * รอบ .150 ผมตีความผิดเป็น "ขยับการ์ดให้ชิดขอบ" ซึ่งเป็นคนละเรื่องกันเลย
 * ของจริงคือ **ข้อความข้างในการ์ด** จัดได้ทั้งแนวนอนและแนวตั้ง เหมือนช่องในตาราง
 */
export const TEXT_ALIGNS = ['left', 'center', 'right'];
export const TEXT_VALIGNS = ['top', 'middle', 'bottom'];
export function validateAlign(a) { return TEXT_ALIGNS.includes(a); }
export function validateVAlign(a) { return TEXT_VALIGNS.includes(a); }
/**
 * [alpha.150r] ช่วงการย่อ/ขยายรูปที่แทรก — ผู้ใช้: *"insert ภาพต้องปรับขนาดได้นะ"*
 * 1 = พอดีกรอบตามวิธีวางที่เลือก · มากกว่า 1 = ใหญ่กว่ากรอบ (เลื่อนดูได้ทั้งสองแกน)
 */
export const IMG_SCALE_MIN = 0.1, IMG_SCALE_MAX = 6;
export function validateFit(f) { return IMAGE_FITS.includes(f); }

/* i18n-skip: สถานะของการ์ด = ค่าที่เขียนลงไฟล์กระดานแล้วอ่านกลับด้วยค่าเดิม
   (แปลตอนวาดด้วย dataLabel() เหมือนสถานะฉาก — ห้ามแปลตรงนี้) */
export const STATUSES = ['', 'โครงร่าง', 'กำลังเขียน', 'ตรวจแล้ว', 'เสร็จแล้ว', 'พัก'];
export const STATUS_COLOR = {
  'โครงร่าง': '#6b6b6b', 'กำลังเขียน': '#d97757', 'ตรวจแล้ว': '#5f7a9f',
  'เสร็จแล้ว': '#5f8a6f', 'พัก': '#7a6f9f',
};
/* /i18n-skip */

export const EDGE_STYLES = ['solid', 'dashed', 'dotted'];
export const EDGE_ROUTINGS = ['straight', 'orthogonal', 'curved'];
export const ARROW_HEADS = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'];
export const PORT_POSITIONS = ['top', 'right', 'bottom', 'left', 'auto'];

export const GRID_STYLES = ['dots', 'lines', 'cross'];
export const DEFAULT_GRID = { show: true, size: 20, snap: false, style: 'dots', color: '#3a3936', opacity: 0.9 };
export const isThemeGridColor = (c) => !c || String(c).toLowerCase() === DEFAULT_GRID.color;
export const DEFAULT_BG = '#262624';
/**
 * [alpha.164 ข้อ A2] สีพื้น/สีกริดที่ยังเป็น "ค่าเริ่มต้น" = **ตามธีมของโปรแกรม** (`--canvas` / `--hover`)
 * ค่าเริ่มต้นเดิมถูกเขียนลงทุกกระดาน → ธีมม่วง/ธีมสว่างก็ได้พื้นเทาอุ่นตลอด · ค่าที่ผู้ใช้เลือกเองยังได้สีนั้นเป๊ะ
 */
export const isThemeBg = (c) => !c || String(c).toLowerCase() === DEFAULT_BG;
/** [alpha.150] รูปพื้นหลังกระดาน — `src` ว่าง = ไม่มีรูป (ใช้สีพื้นอย่างเดียว) */
export const DEFAULT_BG_IMAGE = { src: '', fit: 'fill', blur: 0, opacity: 1 };

/** ค่าเริ่มต้นของแต่ละชนิดโหนด — ใช้ตอนสร้างใหม่ (เครื่องมือแบบ Miro) */
export const TYPE_DEFAULTS = {
  scene:   { width: CARD_W, height: CARD_H, color: '#3f3e3a', textColor: '#faf9f5', fontSize: 12.5 },
  chapter: { width: CARD_W, height: CARD_H, color: '#5f7a9f', textColor: '#faf9f5', fontSize: 12.5 },
  entity:  { width: CARD_W, height: CARD_H, color: '#7a6f9f', textColor: '#faf9f5', fontSize: 12.5 },
  note:    { width: CARD_W, height: CARD_H, color: '#5f8a6f', textColor: '#faf9f5', fontSize: 12.5 },
  sticky:  { width: STICKY_W, height: STICKY_H, color: '#f2c14e', textColor: '#1a1815', fontSize: 13 },
  text:    { width: 220, height: 40, color: 'transparent', textColor: '#faf9f5', fontSize: 18, borderWidth: 0 },
  shape:   { width: 180, height: 130, color: '#4a6fa5', textColor: '#faf9f5', fontSize: 13, shape: 'rect' },
  // [alpha.150 ข้อ 8] เฟรมปรับสีพื้น + ความจางได้แล้ว (เดิมพื้นเป็น rgba ตายตัวในตัววาด)
  frame:   { width: FRAME_W, height: FRAME_H, color: '#d97757', textColor: '#d97757', fontSize: 13,
             fill: '#faf9f5', fillOpacity: 0.03, borderWidth: 1.5 },
  comment: { width: 210, height: 96, color: '#e8e3d3', textColor: '#26241f', fontSize: 12 },
  image:   { width: 280, height: 200, color: 'transparent', textColor: '#faf9f5', fontSize: 11, fit: 'fit', borderWidth: 0 },
  todo:    { width: 240, height: 200, color: '#2f2e2b', textColor: '#faf9f5', fontSize: 12.5 },
};

/** ชนิดโหนดที่ถือ "รายการติ๊ก" */
export const TODO_TYPES = ['todo'];

/** ทำรายการติ๊กให้อยู่ในรูปมาตรฐาน — รับได้ทั้ง string ล้วนและ object */
export function normTodoItems(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 200).map((it) => (typeof it === 'string'
    ? { text: it, done: false }
    : { text: String((it && it.text) || ''), done: !!(it && it.done) }));
}

/** ความคืบหน้าของรายการติ๊ก — `{done, total, percent}` */
export function todoProgress(items) {
  const list = normTodoItems(items);
  const done = list.filter((i) => i.done).length;
  return { done, total: list.length, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
}

/**
 * ข้อความหลายบรรทัด → รายการติ๊ก (หนึ่งข้อต่อบรรทัด · `[x]` นำหน้า = ติ๊กแล้ว)
 * **ตัวแปลงตัวเดียว** ของทั้งกล่องแก้รายการและช่องในแผงคุณสมบัติ
 */
export function parseTodoText(text) {
  return String(text == null ? '' : text).split(/\r?\n/).map((line) => {
    const m = /^\s*(?:[-*]\s*)?\[([ xX])\]\s?(.*)$/.exec(line);
    return m ? { text: m[2].trim(), done: m[1].toLowerCase() === 'x' } : { text: line.trim(), done: false };
  }).filter((it) => it.text);
}

/** รายการติ๊ก → ข้อความหลายบรรทัด (ทางกลับของ `parseTodoText`) */
export function todoToText(items) {
  return normTodoItems(items).map((it) => (it.done ? '[x] ' : '[ ] ') + it.text).join('\n');
}

/** ติ๊ก/ปลดติ๊กข้อที่ i → คืน **array ก้อนใหม่** (ไม่แก้ของเดิม) */
export function toggleTodo(items, i) {
  const list = normTodoItems(items);
  if (i < 0 || i >= list.length) return list;
  return list.map((it, k) => (k === i ? { ...it, done: !it.done } : it));
}

/**
 * ระยะของการ์ดรายการติ๊ก — **ตัววาดกับตัวทดสอบการคลิกต้องใช้ก้อนเดียวกัน**
 * (ไม่งั้นติ๊กแล้วโดนคนละข้อกับที่เห็น — บทเรียนเดียวกับ "ข้อมูลที่ทั้งจอและไฟล์ใช้ต้องเกิดที่เดียว")
 */
export const TODO_LAYOUT = { headH: 30, rowH: 22, padX: 10, boxSize: 13, boxGap: 8, progH: 4 };

/**
 * คลิกที่พิกัดในการ์ด (พิกัดภายในการ์ด 0..width, 0..height) ตรงกับข้อไหน
 * @returns {{index:number, onBox:boolean}} index = -1 คือไม่โดนข้อไหนเลย
 */
export function todoRowAt(n, lx, ly) {
  const L = TODO_LAYOUT;
  const items = normTodoItems(n && n.items);
  const y = ly - L.headH + num(n && n.scrollY, 0);
  if (y < 0) return { index: -1, onBox: false };
  const i = Math.floor(y / L.rowH);
  if (i < 0 || i >= items.length) return { index: -1, onBox: false };
  const onBox = lx >= L.padX - 3 && lx <= L.padX + L.boxSize + 3;
  return { index: i, onBox };
}

/** ความสูงที่เนื้อหาของการ์ดรายการต้องใช้จริง (ไว้คิดแถบเลื่อน) */
export function todoContentHeight(n) {
  return TODO_LAYOUT.headH + normTodoItems(n && n.items).length * TODO_LAYOUT.rowH + 6;
}

let _uidSeq = 0;
export function uid(prefix) {
  _uidSeq = (_uidSeq + 1) % 46656;
  return prefix + Date.now().toString(36) + _uidSeq.toString(36) + Math.random().toString(36).slice(2, 5);
}

/** [alpha.150] รูปพื้นหลังกระดานให้อยู่ในรูปมาตรฐาน (บริสุทธิ์ — เทสได้ตรง ๆ) */
export function _normBgImage(v) {
  const o = v && typeof v === 'object' ? v : {};
  return {
    src: String(o.src || ''),
    fit: validateFit(o.fit) ? o.fit : DEFAULT_BG_IMAGE.fit,
    blur: numClamp(o.blur, 0, 0, 30),
    opacity: numClamp(o.opacity, 1, 0, 1),
  };
}

export function validatePort(port) { return PORT_POSITIONS.includes(port); }
export function validateEdgeStyle(style) { return EDGE_STYLES.includes(style); }
export function validateRouting(r) { return EDGE_ROUTINGS.includes(r); }
export function validateArrow(a) { return ARROW_HEADS.includes(a); }
export function validateShape(s) { return SHAPES.includes(s); }

/** ปัดพิกัดเข้าเส้นกริด — ใช้ตอน snap เปิด (บั๊ก 6) */
export function snapTo(v, size) {
  const s = num(size, 0);
  if (!(s > 0)) return v;
  return Math.round(num(v, 0) / s) * s;
}

export function createDefaultNode(type, title, color, x, y, extra) {
  const t = NODE_TYPES.includes(type) ? type : 'scene';
  const d = TYPE_DEFAULTS[t] || TYPE_DEFAULTS.scene;
  return {
    id: uid('pl-'),
    type: t,
    title: title != null ? title : tt('ui.common.new2'),
    color: color || d.color,
    textColor: d.textColor,
    fontSize: d.fontSize,
    shape: d.shape || 'rect',
    x: num(x, 0), y: num(y, 0),
    width: d.width, height: d.height,
    file: null,
    tags: [],
    synopsis: '',
    status: '',
    locked: false,
    opacity: 1,
    // [alpha.150 ข้อ 7] ขอบการ์ดปรับได้ — `borderColor` ว่าง = ใช้ขอบมาตรฐานของชนิดนั้น
    borderColor: d.borderColor || '',
    borderWidth: d.borderWidth == null ? 1 : d.borderWidth,
    // [alpha.150 ข้อ 8] พื้นของเฟรม/รูปทรง — แยกจาก `color` (ซึ่งเป็นสีเส้นขอบของเฟรม)
    fill: d.fill || '',
    fillOpacity: d.fillOpacity == null ? 1 : d.fillOpacity,
    // [alpha.150 ข้อ 6] รูป — ชนิด `image` ใช้เป็นตัวการ์ดเอง · ชนิดอื่นใช้เป็นรูปในการ์ด (.151)
    // [alpha.152 ข้อ 2] การ์ดทั่วไปที่แทรกรูป = **ครอบเต็มแถบ** (ผู้ใช้: "รูปไม่เต็มกรอบเลย")
    // ส่วนการ์ดที่เป็นรูปทั้งใบประกาศ fit:'fit' ของตัวเองไว้ — เห็นทั้งรูปสำคัญกว่าเต็มกรอบ
    src: '', fit: d.fit || 'fill', blur: 0, scale: 1,
    // [alpha.151] สัดส่วนความสูงที่รูปในการ์ดกินไป (0 = ไม่มีรูป · .45 = ครึ่งกว่า ๆ)
    imageH: d.imageH == null ? 0.45 : d.imageH,
    // [alpha.151] การจัดวางตัวหนังสือ **ในการ์ด** (คนละเรื่องกับตำแหน่งของการ์ดบนกระดาน)
    textAlign: d.textAlign || 'left',
    textVAlign: d.textVAlign || 'top',
    // [alpha.150 ข้อ 9] รายการสิ่งที่ต้องทำ (มีเฉพาะชนิด todo — ไม่ไปบวมในโหนดอื่น)
    ...(t === 'todo' ? { items: [] } : {}),
    // [alpha.150 ข้อ 5] ตำแหน่งเลื่อนของเนื้อหาที่ล้นการ์ด — **สองแกน** (เก็บลงไฟล์ จะได้กลับมาที่เดิม)
    // แนวนอนจำเป็นเพราะ "รูป" ไม่ตัดบรรทัดเหมือนข้อความ ขยายรูปเมื่อไหร่ก็ล้นด้านข้างทันที
    scrollY: 0, scrollX: 0,
    ...(extra || {}),
  };
}

export function createDefaultEdge(fromNodeId, fromPort, toNodeId, toPort, opts) {
  const o = opts || {};
  return {
    id: uid('ed-'),
    from: { nodeId: fromNodeId, port: validatePort(fromPort) ? fromPort : 'auto' },
    to: { nodeId: toNodeId, port: validatePort(toPort) ? toPort : 'auto' },
    label: o.label || '',
    color: o.color || '#d97757',
    width: numClamp(o.width, 2, 1, 8),
    style: validateEdgeStyle(o.style) ? o.style : 'solid',
    routing: validateRouting(o.routing) ? o.routing : 'curved',
    arrowStart: validateArrow(o.arrowStart) ? o.arrowStart : 'none',
    arrowEnd: validateArrow(o.arrowEnd) ? o.arrowEnd : 'arrow',
    // [alpha.151 ข้อ 9] ระยะที่ผู้ใช้ลากแต่ละท่อนของเส้นหักมุมฉากออกจากทางเดิม
    bends: normBends(o.bends),
  };
}

/** ค่าการดัดเส้นให้อยู่ในรูปมาตรฐาน — ตัวเลขล้วน ไม่เกิน 40 ท่อน */
export function normBends(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).map((x) => numClamp(x, 0, -20000, 20000));
}

export class PlannerData {
  /**
   * @param {string} root  โฟลเดอร์โปรเจกต์
   * @param {object} io    kapi adapter (รับเข้ามาเพื่อ unit test)
   * @param {string} path  path ไฟล์กระดาน (ไม่ใส่ = <root>/planner.json)
   */
  constructor(root, io, path) {
    this._root = root;
    this._io = io;
    this._path = path || null;
    this._nodes = [];
    this._edges = [];
    this._groups = [];
    this._settings = { grid: { ...DEFAULT_GRID }, background: DEFAULT_BG,
                       backgroundImage: { ...DEFAULT_BG_IMAGE }, viewport: { x: 0, y: 0, zoom: 1 } };
    this._dirty = false;
  }

  getPath() { return this._path; }
  setPath(p) { this._path = p; }
  /** ชื่อไฟล์ (ไม่มีนามสกุล) — ใช้ตั้งชื่อไฟล์ที่ส่งออก */
  getFileBase() {
    if (!this._path) return 'planner';
    return (String(this._path).split(/[\\/]/).pop() || 'planner').replace(/\.json$/i, '') || 'planner';
  }

  /** ชื่อกระดานที่เอาไว้โชว์บนหัวแผง (planner.json เดิม = "กระดานหลัก") */
  getName() {
    const base = this.getFileBase();
    return base === 'planner' ? tt('ui.common.boardMain') : base;
  }

  async _defaultPath() {
    if (this._path) return this._path;
    this._path = await this._io.join(this._root, 'planner.json');
    return this._path;
  }

  async load(path) {
    if (path) this._path = path;
    const p = await this._defaultPath();
    try {
      if (await this._io.exists(p)) {
        const raw = await this._io.readJson(p);
        this._parse(raw);
      } else {
        this._parse({});
      }
    } catch (e) {
      this._parse({});
    }
    this._dirty = false;
    return true;
  }

  async save(path) {
    try {
      if (path) this._path = path;
      const p = await this._defaultPath();
      const dir = p.replace(/[\\/][^\\/]*$/, '');
      if (dir && dir !== p && this._io.mkdir) { try { await this._io.mkdir(dir); } catch {} }
      await this._io.writeFile(p, JSON.stringify(this._exportData(), null, 2));
      this._dirty = false;
      return true;
    } catch (e) {
      return false;
    }
  }

  /** บันทึกเป็นไฟล์ใหม่ แล้วให้กระดานปัจจุบันชี้ไปที่ไฟล์นั้น (บั๊ก 5) */
  async saveAs(path) {
    if (!path) return false;
    return this.save(path);
  }

  /** ล้างกระดานเป็นแผ่นเปล่า (สร้างกระดานใหม่ — บั๊ก 5) */
  reset(path) {
    this._parse({});
    if (path !== undefined) this._path = path;
    this._dirty = false;
    return true;
  }

  _parse(data) {
    data = data || {};
    const mig = this.needsMigration(data);
    if (mig === '1.0') data = this.migrateV1toV3(data);
    else if (mig === '2.0') data = this.migrateV2toV3(data);
    if (mig) data = this.migrateV3toV4(data);

    this._nodes = (data.nodes || []).map((n) => this._normNode(n));
    const ids = new Set(this._nodes.map((n) => n.id));
    this._edges = (data.edges || [])
      .filter((e) => {
        const fid = e && typeof e.from === 'object' ? e.from.nodeId : e && e.from;
        const tid = e && typeof e.to === 'object' ? e.to.nodeId : e && e.to;
        return ids.has(fid) && ids.has(tid);
      })
      .map((e) => this._normEdge(e));
    this._groups = (data.groups || []).map((g) => ({
      id: g.id || uid('gp-'),
      name: g.name || tt('ui.planner.group'),
      color: g.color || '#d97757',
      x: num(g.x, 0), y: num(g.y, 0),
      width: num(g.width, 260), height: num(g.height, 200),
      childrenIds: Array.isArray(g.childrenIds) ? g.childrenIds.filter((c) => ids.has(c)) : [],
    }));
    const s = data.settings || {};
    const gr = s.grid || {};
    this._settings = {
      grid: {
        show: gr.show !== false,
        size: numClamp(gr.size, DEFAULT_GRID.size, 4, 400),
        snap: !!gr.snap,
        style: GRID_STYLES.includes(gr.style) ? gr.style : DEFAULT_GRID.style,
        color: gr.color || DEFAULT_GRID.color,
        opacity: numClamp(gr.opacity, DEFAULT_GRID.opacity, 0, 1),
      },
      background: s.background || DEFAULT_BG,
      backgroundImage: _normBgImage(s.backgroundImage),
      viewport: {
        x: num(s.viewport && s.viewport.x, 0),
        y: num(s.viewport && s.viewport.y, 0),
        zoom: numClamp(s.viewport && s.viewport.zoom, 1, 0.05, 8),
      },
    };
  }

  _normNode(n) {
    n = n || {};
    const type = NODE_TYPES.includes(n.type) ? n.type : 'scene';
    const d = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.scene;
    return {
      id: n.id || uid('pl-'),
      type,
      title: n.title != null ? n.title : tt('ui.common.notSpecifyName'),
      color: n.color || d.color,
      textColor: n.textColor || d.textColor,
      fontSize: numClamp(n.fontSize, d.fontSize, 6, 120),
      shape: validateShape(n.shape) ? n.shape : (d.shape || 'rect'),
      x: num(n.x, 0), y: num(n.y, 0),
      width: numClamp(n.width, d.width, 12, 20000),
      height: numClamp(n.height, d.height, 12, 20000),
      file: n.file || null,
      tags: Array.isArray(n.tags) ? n.tags : [],
      synopsis: n.synopsis || '',
      status: n.status || '',
      locked: !!n.locked,
      opacity: numClamp(n.opacity, 1, 0.05, 1),
      // ── [alpha.150] ขอบ · พื้น · รูป · รายการติ๊ก · ตำแหน่งเลื่อน ──
      borderColor: n.borderColor || d.borderColor || '',
      borderWidth: numClamp(n.borderWidth, d.borderWidth == null ? 1 : d.borderWidth, 0, 12),
      fill: n.fill || d.fill || '',
      fillOpacity: numClamp(n.fillOpacity, d.fillOpacity == null ? 1 : d.fillOpacity, 0, 1),
      src: n.src || '',
      fit: validateFit(n.fit) ? n.fit : (d.fit || 'fill'),
      blur: numClamp(n.blur, 0, 0, 30),
      scale: numClamp(n.scale, 1, IMG_SCALE_MIN, IMG_SCALE_MAX),
      imageH: numClamp(n.imageH, d.imageH == null ? 0.45 : d.imageH, 0.05, 1),
      textAlign: validateAlign(n.textAlign) ? n.textAlign : (d.textAlign || 'left'),
      textVAlign: validateVAlign(n.textVAlign) ? n.textVAlign : (d.textVAlign || 'top'),
      scrollY: numClamp(n.scrollY, 0, 0, 100000),
      scrollX: numClamp(n.scrollX, 0, 0, 100000),
      ...(type === 'todo' ? { items: normTodoItems(n.items) } : {}),
    };
  }

  _normEdge(e) {
    e = e || {};
    const from = typeof e.from === 'object' && e.from ? e.from : { nodeId: e.from, port: 'right' };
    const to = typeof e.to === 'object' && e.to ? e.to : { nodeId: e.to, port: 'left' };
    return {
      id: e.id || uid('ed-'),
      from: { nodeId: from.nodeId, port: validatePort(from.port) ? from.port : 'right' },
      to: { nodeId: to.nodeId, port: validatePort(to.port) ? to.port : 'left' },
      label: e.label || '',
      color: e.color || '#d97757',
      width: numClamp(e.width, 2, 1, 8),
      style: validateEdgeStyle(e.style) ? e.style : 'solid',
      routing: validateRouting(e.routing) ? e.routing : 'straight',
      arrowStart: validateArrow(e.arrowStart) ? e.arrowStart : 'none',
      arrowEnd: validateArrow(e.arrowEnd) ? e.arrowEnd : 'arrow',
      bends: normBends(e.bends),
    };
  }

  _exportData() {
    return {
      version: '4.0',
      settings: {
        grid: { ...this._settings.grid },
        background: this._settings.background,
        backgroundImage: { ...this._settings.backgroundImage },
        viewport: { ...this._settings.viewport },
      },
      nodes: this._nodes.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y) })),
      edges: this._edges.map((e) => ({ ...e, from: { ...e.from }, to: { ...e.to } })),
      groups: this._groups.map((g) => ({ ...g, x: Math.round(g.x), y: Math.round(g.y) })),
      updated: new Date().toISOString(),
    };
  }

  /** ใช้กับ undo/redo ด้วย — snapshot ทั้งกระดาน */
  toJSON() { return this._exportData(); }

  needsMigration(data) {
    const v = data && data.version;
    if (!v || v === '1.0') return '1.0';
    if (v === '2.0') return '2.0';
    if (v === '3.0') return '3.0';
    return null;                                     // v4.0 ขึ้นไป ไม่ต้อง migrate
  }

  migrateV1toV3(data) {
    return {
      ...data, version: '3.0',
      nodes: (data.nodes || []).map((n) => ({
        ...n,
        width: num(n.width, CARD_W), height: num(n.height, CARD_H),
        synopsis: n.synopsis || '', status: n.status || '',
        tags: Array.isArray(n.tags) ? n.tags : [], file: n.file || null,
      })),
    };
  }

  migrateV2toV3(data) {
    return {
      ...data, version: '3.0',
      edges: (data.edges || []).map((e) => ({
        ...e,
        from: typeof e.from === 'object' ? { nodeId: e.from.nodeId || e.from, port: validatePort(e.from.port) ? e.from.port : 'right' } : { nodeId: e.from, port: 'right' },
        to: typeof e.to === 'object' ? { nodeId: e.to.nodeId || e.to, port: validatePort(e.to.port) ? e.to.port : 'left' } : { nodeId: e.to, port: 'left' },
        width: numClamp(e.width, 2, 1, 5),
        style: validateEdgeStyle(e.style) ? e.style : 'solid',
      })),
    };
  }

  /** v3 → v4: เติม settings/grid, สีตัวอักษร, หัวลูกศร, routing */
  migrateV3toV4(data) {
    return {
      ...data, version: '4.0',
      settings: data.settings || { grid: { ...DEFAULT_GRID }, background: DEFAULT_BG,
                                  backgroundImage: { ...DEFAULT_BG_IMAGE }, viewport: { x: 0, y: 0, zoom: 1 } },
      nodes: (data.nodes || []).map((n) => {
        const d = TYPE_DEFAULTS[n.type] || TYPE_DEFAULTS.scene;
        return { ...n, textColor: n.textColor || d.textColor, fontSize: num(n.fontSize, d.fontSize), shape: n.shape || d.shape || 'rect', locked: !!n.locked };
      }),
      edges: (data.edges || []).map((e) => ({
        ...e,
        routing: validateRouting(e.routing) ? e.routing : 'straight',
        arrowStart: validateArrow(e.arrowStart) ? e.arrowStart : 'none',
        arrowEnd: validateArrow(e.arrowEnd) ? e.arrowEnd : 'arrow',
      })),
    };
  }

  // ───── Settings ─────
  getSettings() { return this._settings; }
  getGrid() { return this._settings.grid; }
  updateGrid(props) {
    const g = this._settings.grid;
    if ('show' in props) g.show = !!props.show;
    if ('snap' in props) g.snap = !!props.snap;
    if ('size' in props) g.size = numClamp(props.size, g.size, 4, 400);
    if ('style' in props && GRID_STYLES.includes(props.style)) g.style = props.style;
    if ('color' in props && props.color) g.color = props.color;
    if ('opacity' in props) g.opacity = numClamp(props.opacity, g.opacity, 0, 1);
    this._dirty = true;
    return g;
  }
  setViewport(x, y, zoom) {
    this._settings.viewport = { x: num(x, 0), y: num(y, 0), zoom: numClamp(zoom, 1, 0.05, 8) };
    return this._settings.viewport;
  }
  getViewport() { return this._settings.viewport; }
  setBackground(c) { if (c) { this._settings.background = c; this._dirty = true; } return this._settings.background; }

  /** [alpha.150 ข้อ 2] รูปพื้นหลังกระดาน — ส่ง `{src:''}` = เอารูปออก */
  getBackgroundImage() { return this._settings.backgroundImage; }
  setBackgroundImage(props) {
    const cur = this._settings.backgroundImage || { ...DEFAULT_BG_IMAGE };
    this._settings.backgroundImage = _normBgImage({ ...cur, ...(props || {}) });
    this._dirty = true;
    return this._settings.backgroundImage;
  }

  /** ปัดค่าเข้ากริดถ้าเปิด snap ไว้ */
  snapValue(v) {
    const g = this._settings.grid;
    return g.snap ? snapTo(v, g.size) : v;
  }

  /**
   * [alpha.150 ข้อ 3] ปัด **ขนาด** เข้ากริด — ใช้ตอนลากวาดและตอนยืดขอบ
   * ต่างจาก `snapValue` ตรงที่ขนาดห้ามเป็น 0 (ปัดลงไปติดกริดช่องเดียวเป็นอย่างน้อย)
   */
  snapSize(v) {
    const g = this._settings.grid;
    if (!g.snap || !(g.size > 0)) return v;
    return Math.max(g.size, snapTo(v, g.size));
  }

  /** กล่องที่ปัดเข้ากริดแล้วทั้งตำแหน่งและขนาด (ตัวเดียวที่ฝั่งลากวาดต้องเรียก) */
  snapBox(box) {
    if (!box) return box;
    return {
      x: this.snapValue(box.x), y: this.snapValue(box.y),
      width: this.snapSize(box.width), height: this.snapSize(box.height),
    };
  }

  // ───── Node CRUD ─────
  addNode(type, title, color, x, y, extra) {
    const n = createDefaultNode(type, title, color, this.snapValue(x), this.snapValue(y), extra);
    this._nodes.push(n);
    this._dirty = true;
    return n;
  }

  addNodeRaw(n) {
    const norm = this._normNode(n);
    this._nodes.push(norm);
    this._dirty = true;
    return norm;
  }

  removeNode(id) {
    const idx = this._nodes.findIndex((n) => n.id === id);
    if (idx < 0) return false;
    this._nodes.splice(idx, 1);
    this._edges = this._edges.filter((e) => e.from.nodeId !== id && e.to.nodeId !== id);
    for (const g of this._groups) g.childrenIds = g.childrenIds.filter((c) => c !== id);
    this._dirty = true;
    return true;
  }

  updateNode(id, props) {
    const n = this._nodes.find((x) => x.id === id);
    if (!n) return false;
    // `items` อาจยังไม่มีในโหนด (เพิ่งเปลี่ยนชนิดเป็น todo) → รับก่อนด่าน `k in n`
    if ('items' in props) n.items = normTodoItems(props.items);
    for (const k of Object.keys(props)) {
      if (!(k in n)) continue;
      if (k === 'type') { if (NODE_TYPES.includes(props[k])) n.type = props[k]; continue; }
      if (k === 'shape') { if (validateShape(props[k])) n.shape = props[k]; continue; }
      if (k === 'fontSize') { n.fontSize = numClamp(props[k], n.fontSize, 6, 120); continue; }
      if (k === 'width') { n.width = numClamp(props[k], n.width, 12, 20000); continue; }
      if (k === 'height') { n.height = numClamp(props[k], n.height, 12, 20000); continue; }
      if (k === 'opacity') { n.opacity = numClamp(props[k], n.opacity, 0.05, 1); continue; }
      if (k === 'locked') { n.locked = !!props[k]; continue; }
      if (k === 'tags') { n.tags = Array.isArray(props[k]) ? props[k] : n.tags; continue; }
      // [alpha.150] ช่องใหม่ทั้งหมดผ่านตัวหนีบเดียวกับตอนโหลด — ค่ามั่วจากแผงคุณสมบัติจึงเข้าไม่ได้
      if (k === 'borderWidth') { n.borderWidth = numClamp(props[k], n.borderWidth, 0, 12); continue; }
      if (k === 'fillOpacity') { n.fillOpacity = numClamp(props[k], n.fillOpacity, 0, 1); continue; }
      if (k === 'blur') { n.blur = numClamp(props[k], n.blur, 0, 30); continue; }
      if (k === 'scrollY') { n.scrollY = numClamp(props[k], n.scrollY, 0, 100000); continue; }
      if (k === 'scrollX') { n.scrollX = numClamp(props[k], n.scrollX, 0, 100000); continue; }
      if (k === 'scale') { n.scale = numClamp(props[k], n.scale, IMG_SCALE_MIN, IMG_SCALE_MAX); continue; }
      if (k === 'fit') { if (validateFit(props[k])) n.fit = props[k]; continue; }
      if (k === 'imageH') { n.imageH = numClamp(props[k], n.imageH, 0.05, 1); continue; }
      if (k === 'textAlign') { if (validateAlign(props[k])) n.textAlign = props[k]; continue; }
      if (k === 'textVAlign') { if (validateVAlign(props[k])) n.textVAlign = props[k]; continue; }
      if (k === 'items') { n.items = normTodoItems(props[k]); continue; }
      n[k] = props[k];
    }
    this._dirty = true;
    return true;
  }

  getNode(id) { return this._nodes.find((n) => n.id === id) || null; }

  /**
   * ลำดับการซ้อนทับ — ลำดับใน `_nodes` คือลำดับวาด (ท้ายสุด = อยู่บนสุด)
   * mode: front | back | forward | backward   (บั๊ก 65r2-1)
   */
  moveNodeZ(ids, mode) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    const picked = this._nodes.filter((n) => set.has(n.id));
    if (!picked.length) return false;
    const rest = this._nodes.filter((n) => !set.has(n.id));
    if (mode === 'front') {
      this._nodes = rest.concat(picked);
    } else if (mode === 'back') {
      this._nodes = picked.concat(rest);
    } else if (mode === 'forward' || mode === 'backward') {
      const dir = mode === 'forward' ? 1 : -1;
      const arr = this._nodes.slice();
      const order = dir > 0
        ? arr.map((n, i) => i).reverse()          // เลื่อนขึ้น: ไล่จากท้ายมาหน้า กันชนกันเอง
        : arr.map((n, i) => i);
      for (const i of order) {
        if (!set.has(arr[i].id)) continue;
        const j = i + dir;
        if (j < 0 || j >= arr.length) continue;
        if (set.has(arr[j].id)) continue;         // ชิดพวกเดียวกันแล้ว ไม่ต้องสลับ
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      this._nodes = arr;
    } else return false;
    this._dirty = true;
    return true;
  }

  /** ลำดับที่ (0 = ล่างสุด) — ใช้เทียบใน unit test / ให้ renderer จัดชั้น */
  nodeZ(id) { return this._nodes.findIndex((n) => n.id === id); }

  /** โหนดที่ล็อกไว้ห้ามลาก/ลบ (บั๊ก 10 ฝั่งการ์ด) */
  isLocked(id) { const n = this.getNode(id); return !!(n && n.locked); }

  // ───── Edge CRUD ─────
  addEdge(fromNodeId, fromPort, toNodeId, toPort, opts) {
    if (!fromNodeId || !toNodeId) return null;
    if (fromNodeId === toNodeId) return null;
    if (!this.getNode(fromNodeId) || !this.getNode(toNodeId)) return null;
    if (!validatePort(fromPort) || !validatePort(toPort)) return null;
    const dup = this._edges.some(
      (e) => e.from.nodeId === fromNodeId && e.from.port === fromPort &&
             e.to.nodeId === toNodeId && e.to.port === toPort
    );
    if (dup) return null;
    const e = createDefaultEdge(fromNodeId, fromPort, toNodeId, toPort, opts);
    this._edges.push(e);
    this._dirty = true;
    return e;
  }

  removeEdge(id) {
    const idx = this._edges.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    this._edges.splice(idx, 1);
    this._dirty = true;
    return true;
  }

  updateEdge(id, props) {
    const e = this._edges.find((x) => x.id === id);
    if (!e) return false;
    if ('label' in props) e.label = props.label;
    if ('color' in props && props.color) e.color = props.color;
    if ('width' in props) e.width = numClamp(props.width, e.width, 1, 8);
    if ('style' in props && validateEdgeStyle(props.style)) e.style = props.style;
    if ('routing' in props && validateRouting(props.routing)) e.routing = props.routing;
    if ('arrowStart' in props && validateArrow(props.arrowStart)) e.arrowStart = props.arrowStart;
    if ('arrowEnd' in props && validateArrow(props.arrowEnd)) e.arrowEnd = props.arrowEnd;
    if ('bends' in props) e.bends = normBends(props.bends);
    if ('fromPort' in props && validatePort(props.fromPort)) e.from.port = props.fromPort;
    if ('toPort' in props && validatePort(props.toPort)) e.to.port = props.toPort;
    this._dirty = true;
    return true;
  }

  getEdge(id) { return this._edges.find((e) => e.id === id) || null; }

  /** เส้นทุกเส้นที่แตะโหนดชุดนี้ — ใช้อัปเดตเฉพาะที่ต้องอัปเดตตอนลาก (บั๊ก 2 ประสิทธิภาพ) */
  edgesTouching(nodeIds) {
    const set = new Set(Array.isArray(nodeIds) ? nodeIds : [nodeIds]);
    return this._edges.filter((e) => set.has(e.from.nodeId) || set.has(e.to.nodeId));
  }

  findEdge(fromNodeId, fromPort, toNodeId, toPort) {
    return this._edges.find(
      (e) => e.from.nodeId === fromNodeId && e.from.port === fromPort &&
             e.to.nodeId === toNodeId && e.to.port === toPort
    ) || null;
  }

  // ───── Group CRUD ─────
  addGroup(name, childrenIds, color) {
    const g = {
      id: uid('gp-'), name: name || tt('ui.planner.group'), color: color || '#d97757',
      x: 0, y: 0, width: 260, height: 200,
      childrenIds: childrenIds || [],
    };
    this._groups.push(g);
    if (g.childrenIds.length) this.updateGroupBounds(g.id);
    this._dirty = true;
    return g;
  }

  removeGroup(id) {
    const idx = this._groups.findIndex((g) => g.id === id);
    if (idx < 0) return false;
    this._groups.splice(idx, 1);
    this._dirty = true;
    return true;
  }

  updateGroupBounds(id) {
    const g = this._groups.find((x) => x.id === id);
    if (!g) return false;
    const nodes = this._nodes.filter((n) => g.childrenIds.includes(n.id));
    if (!nodes.length) return false;
    const pad = 22;
    g.x = Math.min(...nodes.map((n) => n.x)) - pad;
    g.y = Math.min(...nodes.map((n) => n.y)) - pad - 12;
    g.width = Math.max(...nodes.map((n) => n.x + n.width)) + pad - g.x;
    g.height = Math.max(...nodes.map((n) => n.y + n.height)) + pad - g.y;
    this._dirty = true;
    return true;
  }

  getGroup(id) { return this._groups.find((g) => g.id === id) || null; }

  // ───── Accessors ─────
  getAllNodes() { return this._nodes.slice(); }
  getAllEdges() { return this._edges.slice(); }
  getAllGroups() { return this._groups.slice(); }

  markDirty() { this._dirty = true; }
  isDirty() { return this._dirty; }
  isEmpty() { return !this._nodes.length && !this._edges.length && !this._groups.length; }

  countStats() {
    return { nodes: this._nodes.length, edges: this._edges.length, groups: this._groups.length };
  }

  filterNodes({ text, type, status }) {
    const q = (text || '').trim().toLowerCase();
    return this._nodes.filter((n) => {
      const hay = `${n.title} ${n.synopsis} ${(n.tags || []).join(' ')}`.toLowerCase();
      return (!q || hay.includes(q)) &&
             (!type || n.type === type) &&
             (!status || n.status === status);
    });
  }

  /** กรอบรวมของทุกโหนด — ใช้ zoom-to-fit */
  bounds() {
    const all = this._nodes.concat(this._groups);
    if (!all.length) return null;
    return {
      x: Math.min(...all.map((n) => n.x)),
      y: Math.min(...all.map((n) => n.y)),
      right: Math.max(...all.map((n) => n.x + n.width)),
      bottom: Math.max(...all.map((n) => n.y + n.height)),
    };
  }
}

// ───────────── เรขาคณิตของเส้นเชื่อม (บริสุทธิ์ — เทสได้) ─────────────

/** จุดเชื่อมบนขอบกล่อง (พร้อมทิศทางออก) — port 'auto' เลือกด้านที่ใกล้เป้าหมายที่สุด */
export function portPoint(box, port, towards) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  let p = port;
  if (p === 'auto' || !PORT_POSITIONS.includes(p)) {
    const t = towards || { x: cx + 1, y: cy };
    const dx = t.x - cx, dy = t.y - cy;
    const rx = box.width / 2 || 1, ry = box.height / 2 || 1;
    p = Math.abs(dy / ry) > Math.abs(dx / rx) ? (dy > 0 ? 'bottom' : 'top') : (dx > 0 ? 'right' : 'left');
  }
  switch (p) {
    case 'top':    return { x: cx, y: box.y, dir: { x: 0, y: -1 }, port: 'top' };
    case 'bottom': return { x: cx, y: box.y + box.height, dir: { x: 0, y: 1 }, port: 'bottom' };
    case 'left':   return { x: box.x, y: cy, dir: { x: -1, y: 0 }, port: 'left' };
    default:       return { x: box.x + box.width, y: cy, dir: { x: 1, y: 0 }, port: 'right' };
  }
}

/**
 * จุดของเส้นเชื่อมตาม routing
 * @returns {{points:Array<{x,y}>, kind:'line'|'bezier', c1?:{x,y}, c2?:{x,y}}}
 */
export function edgeGeometry(fromBox, toBox, edge) {
  const e = edge || {};
  const fc = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
  const tc = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };
  const a = portPoint(fromBox, (e.from && e.from.port) || 'auto', tc);
  const b = portPoint(toBox, (e.to && e.to.port) || 'auto', fc);
  const routing = validateRouting(e.routing) ? e.routing : 'straight';

  if (routing === 'curved') {
    const d = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
    const c1 = { x: a.x + a.dir.x * d, y: a.y + a.dir.y * d };
    const c2 = { x: b.x + b.dir.x * d, y: b.y + b.dir.y * d };
    return { kind: 'bezier', points: [a, b], c1, c2, start: a, end: b };
  }
  if (routing === 'orthogonal') {
    const gap = 24;
    const s = { x: a.x + a.dir.x * gap, y: a.y + a.dir.y * gap };
    const t = { x: b.x + b.dir.x * gap, y: b.y + b.dir.y * gap };
    const pts = [a, s];
    const horizStart = a.dir.x !== 0;
    if (horizStart) { pts.push({ x: s.x, y: t.y }); }
    else { pts.push({ x: t.x, y: s.y }); }
    // เก็บมุมฉากไว้เสมอ: ถ้าจุดกลางไม่ตรงกับ t ให้แทรกอีกหนึ่งหัก
    const mid = pts[pts.length - 1];
    if (mid.x !== t.x && mid.y !== t.y) pts.push({ x: t.x, y: mid.y });
    pts.push(t, b);
    // [alpha.151 ข้อ 9] ใส่ค่าที่ผู้ใช้ลากไว้ลงไปบนเส้นทางมาตรฐาน
    return { kind: 'line', points: applyBends(dedupePoints(pts), e.bends),
             start: a, end: b };
  }
  return { kind: 'line', points: [a, b], start: a, end: b };
}

/**
 * ══ [alpha.151 ข้อ 9] ★ ลากท่อนของเส้นหักมุมฉากได้ (แบบ Miro) ══
 *
 * ผู้ใช้: *"เส้น link เราอยากให้ปรับได้ โดยเฉพาะหักมุมฉาก มันควรจะมีจุดให้ปรับ แบบในรูป เหมือน miro"*
 *
 * ค่าที่เก็บคือ **ระยะตั้งฉากจากทางเดิน** ของแต่ละท่อน ไม่ใช่พิกัดสัมบูรณ์ —
 * การ์ดขยับเมื่อไหร่เส้นก็ยังเกาะตามไปเอง โดยยังคงรูปทรงที่ผู้ใช้ดัดไว้
 * (ถ้าเก็บเป็นพิกัด เส้นจะค้างอยู่ที่เดิมทั้งที่การ์ดย้ายไปแล้ว)
 *
 * ท่อนแรกกับท่อนสุดท้ายแตะพอร์ตอยู่ — ขยับไม่ได้ ไม่งั้นเส้นหลุดออกจากขอบการ์ด
 */
export function applyBends(points, bends) {
  if (!Array.isArray(bends) || !bends.length || points.length < 4) return points;
  const pts = points.map((p) => ({ ...p }));
  for (let i = 1; i < pts.length - 2; i++) {
    const d = +bends[i] || 0;
    if (!d) continue;
    const p1 = pts[i], p2 = pts[i + 1];
    if (Math.abs(p1.x - p2.x) < 0.01) { p1.x += d; p2.x += d; }        // ท่อนตั้ง → ดันแนวนอน
    else if (Math.abs(p1.y - p2.y) < 0.01) { p1.y += d; p2.y += d; }   // ท่อนนอน → ดันแนวตั้ง
  }
  return pts;
}

/**
 * มือจับของเส้นหักมุมฉาก — หนึ่งจุดต่อหนึ่งท่อนที่ลากได้
 * @returns {Array<{index:number, x:number, y:number, axis:'h'|'v'}>}
 *   `axis` = แนวของ **ท่อน** (h = ท่อนนอน ลากขึ้น-ลง · v = ท่อนตั้ง ลากซ้าย-ขวา)
 */
export function bendHandles(geo) {
  const out = [];
  if (!geo || geo.kind !== 'line' || !geo.points || geo.points.length < 4) return out;
  const pts = geo.points;
  for (let i = 1; i < pts.length - 2; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y);
    if (dx < 0.01 && dy < 8) continue;                 // ท่อนสั้นจนจับไม่ได้
    if (dy < 0.01 && dx < 8) continue;
    if (dx < 0.01) out.push({ index: i, x: p1.x, y: (p1.y + p2.y) / 2, axis: 'v' });
    else if (dy < 0.01) out.push({ index: i, x: (p1.x + p2.x) / 2, y: p1.y, axis: 'h' });
  }
  return out;
}

/** ตั้งค่าดัดของท่อนหนึ่ง → คืน array ก้อนใหม่ (ยาวพอที่จะเก็บดัชนีนั้น) */
export function setBend(bends, index, value) {
  const out = normBends(bends).slice();
  while (out.length <= index) out.push(0);
  out[index] = numClamp(value, 0, -20000, 20000);
  return out;
}

function dedupePoints(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    out.push({ x: p.x, y: p.y, dir: p.dir });
  }
  return out;
}

/**
 * ร่นปลายเส้นเข้ามาข้างละกี่พิกเซล — ใช้เว้นที่ให้หัวลูกศรไม่ให้เส้นทะลุออกมา (บั๊ก 65r2-3)
 * คืนรูปทรงชุดใหม่ (ไม่แก้ของเดิม) ส่วน start/end ยังเป็นจุดจริงไว้วางหัวลูกศร
 */
export function trimGeometry(geo, startInset, endInset) {
  const si = num(startInset, 0), ei = num(endInset, 0);
  if (si <= 0 && ei <= 0) return geo;
  if (geo.kind === 'bezier') {
    const [a, b] = geo.points;
    const a2 = _towards(a, geo.c1, si);
    const b2 = _towards(b, geo.c2, ei);
    return { ...geo, points: [a2, b2] };
  }
  const pts = geo.points.map((p) => ({ x: p.x, y: p.y, dir: p.dir }));
  if (si > 0 && pts.length > 1) pts[0] = _towards(pts[0], pts[1], si);
  if (ei > 0 && pts.length > 1) pts[pts.length - 1] = _towards(pts[pts.length - 1], pts[pts.length - 2], ei);
  return { ...geo, points: pts };
}

function _towards(from, to, dist) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!len || dist >= len) return { x: from.x, y: from.y, dir: from.dir };
  return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist, dir: from.dir };
}

/**
 * แปลงรูปทรงเส้นเป็นชุดจุดต่อกัน — ใช้ทดสอบว่าเมาส์อยู่ "บนเส้น" จริงไหม
 * [บั๊ก 65r3-3] fabric ทดสอบการชนด้วย **กรอบสี่เหลี่ยม** ของวัตถุ เส้นทแยง/เส้นโค้งเลยกินพื้นที่
 * ทั้งผืนระหว่างการ์ดสองใบ → คลิกการ์ดข้าง ๆ ทีไรโดนเส้นแทน ต้องวัดระยะจากเส้นจริงเอง
 */
export function sampleGeometry(geo, steps) {
  if (!geo) return [];
  if (geo.kind !== 'bezier') return geo.points.map((p) => ({ x: p.x, y: p.y }));
  const n = Math.max(6, numInt(steps, 20));
  const [a, b] = geo.points, c1 = geo.c1, c2 = geo.c2;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    out.push({
      x: mt * mt * mt * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * b.x,
      y: mt * mt * mt * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * b.y,
    });
  }
  return out;
}

/** ระยะจากจุดถึงเส้นหลายท่อน (คืน Infinity ถ้าไม่มีท่อนเลย) */
export function distanceToPolyline(pt, pts) {
  if (!pts || pts.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = _distToSegment(pt, pts[i - 1], pts[i]);
    if (d < best) best = d;
  }
  return best;
}

function _distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** จุดกึ่งกลางของเส้น (ไว้วางป้ายกำกับ) */
export function edgeMidpoint(geo) {
  if (geo.kind === 'bezier') {
    const [a, b] = geo.points;
    const t = 0.5, mt = 1 - t;
    return {
      x: mt * mt * mt * a.x + 3 * mt * mt * t * geo.c1.x + 3 * mt * t * t * geo.c2.x + t * t * t * b.x,
      y: mt * mt * mt * a.y + 3 * mt * mt * t * geo.c1.y + 3 * mt * t * t * geo.c2.y + t * t * t * b.y,
    };
  }
  const pts = geo.points;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let want = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (want <= seg || i === pts.length - 1) {
      const r = seg ? want / seg : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * r, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * r };
    }
    want -= seg;
  }
  return pts[0];
}

/** มุมของหัวลูกศรที่ปลายทั้งสองข้าง (องศา) */
export function edgeAngles(geo) {
  let sa, ea;
  if (geo.kind === 'bezier') {
    const [a, b] = geo.points;
    sa = Math.atan2(geo.c1.y - a.y, geo.c1.x - a.x);
    ea = Math.atan2(b.y - geo.c2.y, b.x - geo.c2.x);
  } else {
    const p = geo.points;
    sa = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
    ea = Math.atan2(p[p.length - 1].y - p[p.length - 2].y, p[p.length - 1].x - p[p.length - 2].x);
  }
  return { start: (sa * 180) / Math.PI, end: (ea * 180) / Math.PI };
}

/** SVG path string ของเส้น — ใช้กับ fabric.Path */
export function edgePathString(geo) {
  if (geo.kind === 'bezier') {
    const [a, b] = geo.points;
    return `M ${r2(a.x)} ${r2(a.y)} C ${r2(geo.c1.x)} ${r2(geo.c1.y)}, ${r2(geo.c2.x)} ${r2(geo.c2.y)}, ${r2(b.x)} ${r2(b.y)}`;
  }
  const p = geo.points;
  return 'M ' + p.map((q, i) => (i ? 'L ' : '') + r2(q.x) + ' ' + r2(q.y)).join(' ');
}

function r2(v) { return Math.round(v * 100) / 100; }
