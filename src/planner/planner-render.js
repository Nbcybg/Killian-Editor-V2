// planner-render.js — Render Layer (Fabric.js) สำหรับ Planner v4
//
// สิ่งที่แก้จาก v3 (บั๊กที่ผู้ใช้แจ้ง):
//  · บั๊ก 2  ตัด perPixelTargetFind ทิ้ง (แพงมากตอน hit-test ทุก mousemove) → ใช้เส้นโปร่งใสหนา ๆ เป็น hit area
//            + อัปเดตเฉพาะเส้นที่เกี่ยวกับโหนดที่ขยับ (updateEdgesFor) แทนการล้างสร้างใหม่ทั้งกระดาน
//            + ใช้ port objects ซ้ำ (ไม่ add/remove ทุกครั้งที่เมาส์ผ่าน)
//  · บั๊ก 6  กริดวาดด้วย CSS บนตัวห่อ (คมชัด + ตามการเลื่อน/ซูม) ปรับขนาด/รูปแบบ/สแนปได้
//  · บั๊ก 9  port ยื่นออกนอกกรอบ transform + ปิดปุ่มปรับขนาดกลางขอบ → ไม่โดนบัง เหมือน Miro
//            เส้นเชื่อมมี 3 รูปแบบ (ตรง / หักมุมฉาก / โค้ง)
//  · บั๊ก 11 หัวลูกศรเลือกได้ทั้งสองปลาย (ไม่มี / ลูกศร / สามเหลี่ยม / วงกลม / ข้าวหลามตัด / ขีด)
import { t as tt, t } from '../i18n.js';
import { fabric } from 'fabric';
import { themeColor, PLANNER_KIND } from '../palette.js';   // [alpha.162 · W6 ข้อ 2] สีเปลือกตามธีม · สีความหมายที่เดียว
// [alpha.150r] ไอคอนของกระดานถูกวาดลงผืน canvas จึงต้องเป็น "ตัวอักษร" ไม่ใช่ svg —
// แต่ยังต้องมาจากทะเบียนเดียวกับที่อื่น (กฎ alpha.147) ไม่ใช่อีโมจิที่เขียนไว้ในโค้ด
import { ICON_GLYPH } from '../generated/commands-data.js';
import { visualTagFor } from '../visual-tags.js';
import {
  CARD_W, CARD_H, ICONS, STATUS_COLOR, TYPE_DEFAULTS,
  edgeGeometry, edgePathString, edgeMidpoint, edgeAngles, trimGeometry,
  sampleGeometry, distanceToPolyline, bendHandles,
  TODO_LAYOUT, normTodoItems, todoProgress,
  DEFAULT_BG, DEFAULT_GRID, isThemeBg, isThemeGridColor,
} from './planner-data.js';

export const PORT_GAP = 20;          // ระยะที่ port ยื่นออกนอกขอบการ์ด (บั๊ก 9) — พ้นปุ่มปรับขนาดกลางขอบ
export const EDGE_HIT_TOL = 9;       // ระยะ (พิกเซลบนจอ) ที่ถือว่าคลิกโดนเส้น (บั๊ก 10 · 65r3-3)
const FONT = '"Segoe UI", "Leelawadee UI", sans-serif, "K2 Icons"';   // [alpha.166] อักขระไอคอน (glyphOf) วาดด้วยฟอนต์ไอคอน

/** ชื่อไอคอนในทะเบียน → ตัวอักษรที่วาดลง canvas ได้ ('' = ไม่มีในทะเบียน) */
export function glyphOf(name) { return (name && ICON_GLYPH[name]) || ''; }

/** "ไอคอน + เว้นวรรค + ข้อความ" — ไม่มีไอคอนในทะเบียนก็เหลือแค่ข้อความ ไม่มีช่องว่างหลงเหลือ */
function _withGlyph(name, text) {
  const g = glyphOf(name);
  return g ? g + ' ' + text : String(text == null ? '' : text);
}

/** ลำดับชั้นการวาด — เลขน้อยอยู่ล่าง */
const LAYER = { frame: 0, group: 1, edge: 2, node: 3, overlay: 4, port: 5 };

export class PlannerRenderer {
  constructor(canvasEl, options = {}) {
    this.canvas = new fabric.Canvas(canvasEl, {
      backgroundColor: '',                       // กริดวาดด้วย CSS ใต้ canvas → พื้นต้องโปร่ง
      selection: true,
      selectionColor: 'rgba(217,119,87,0.16)',
      selectionBorderColor: themeColor('--accent-hi', '#d97757'),
      preserveObjectStacking: true,
      renderOnAddRemove: false,                  // คุมการวาดเอง = ลื่นกว่ามากตอนสร้างหลายชิ้น
      stopContextMenu: true,
      fireRightClick: true,
      fireMiddleClick: true,                     // [บั๊ก 6] ไม่เปิด = fabric ไม่ยิง mouse:down ของล้อกลางเลย
      uniformScaling: false,                     // [บั๊ก 4] ค่าเริ่มต้นของ fabric = true → มุมล็อกสัดส่วนตลอด
      enableRetinaScaling: true,
    });
    this._opts = options;
    this._gridHost = options.gridHost || null;   // div ที่รับ CSS กริด
    // [alpha.150] ชั้นรูปพื้นหลังกระดาน (div แยกใต้ canvas — เบลอ/จางได้โดยไม่โดนวัตถุบนกระดาน)
    this._bgHost = options.bgHost || null;
    /** path ในไฟล์กระดาน → URL ที่เปิดได้จริง (ผู้เรียกเป็นคนรู้จักรากโปรเจกต์) */
    this._imgUrl = options.imageUrl || ((s) => s);
    this._imgCache = new Map();                  // url → HTMLImageElement (โหลดแล้ว)
    this._imgPending = new Map();                // url → Promise (กันโหลดซ้ำ)
    this._onImageReady = options.onImageReady || null;
    this._nodeVis = new Map();
    this._groupVis = new Map();
    this._edgeVis = new Map();
    this._anchors = [];                          // port objects (ใช้ซ้ำ)
    this._selectedEdgeId = null;
    this._grid = { show: true, size: 20, snap: false, style: 'dots', color: '', opacity: 0.9 };
    this._bgRaw = options.backgroundColor || '';
    this._bg = isThemeBg(this._bgRaw) ? themeColor('--canvas', DEFAULT_BG) : this._bgRaw;
    // [alpha.164 ข้อ A2] เปลี่ยนธีมระหว่างเปิดกระดาน = พื้น/กริดที่เป็นค่าเริ่มต้นเปลี่ยนตามทันที
    this._onTheme = () => { try { this.setBackground(this._bgRaw); } catch {} };
    if (typeof window !== 'undefined') window.addEventListener('k2-theme', this._onTheme);
    this.zoomLevel = 1;
    this._makePorts();
  }

  // ═════════════════ กริด (บั๊ก 6) ═════════════════
  setGrid(grid) {
    this._grid = { ...this._grid, ...(grid || {}) };
    this.updateGridCss();
    return this._grid;
  }

  setBackground(color) {
    this._bgRaw = color || '';
    this._bg = isThemeBg(color) ? themeColor('--canvas', DEFAULT_BG) : color;
    this.updateGridCss();
  }

  /**
   * [alpha.150 ข้อ 2] รูปพื้นหลังกระดาน
   *
   * วางเป็น **div ของตัวเอง** ใต้ canvas ไม่ใช่ `canvas.backgroundImage` — เพราะ
   * ความเบลอต้องเป็นของรูปอย่างเดียว ถ้าเบลอทั้งผืน canvas การ์ดก็เบลอตามไปหมด
   * และ `filter: blur()` บน div ให้ GPU ทำ = ไม่กินเวลาวาดทุกเฟรมเหมือน fabric filter
   */
  setBackgroundImage(bg) {
    this._bgImage = bg || null;
    const host = this._bgHost;
    if (!host) return this._bgImage;
    const src = bg && bg.src ? this._imgUrl(bg.src) : '';
    if (!src) { host.style.backgroundImage = 'none'; host.style.opacity = '0'; return this._bgImage; }
    host.style.backgroundImage = `url("${String(src).replace(/"/g, '%22')}")`;
    host.style.opacity = String(bg.opacity == null ? 1 : bg.opacity);
    host.style.filter = bg.blur > 0 ? `blur(${bg.blur}px)` : '';
    // เบลอแล้วขอบจะโปร่ง → ขยายออกนอกกรอบเท่ารัศมีเบลอ ไม่ให้เห็นขอบจาง
    const out = bg.blur > 0 ? -Math.ceil(bg.blur * 2.5) : 0;
    host.style.inset = out + 'px';
    host.style.backgroundRepeat = bg.fit === 'tile' ? 'repeat' : 'no-repeat';
    host.style.backgroundPosition = 'center center';
    host.style.backgroundSize = bg.fit === 'full' ? '100% 100%'
      : bg.fit === 'fit' ? 'contain'
      : bg.fit === 'tile' ? 'auto'
      : 'cover';
    return this._bgImage;
  }

  /**
   * โหลดรูปแล้วเก็บแคช — คืน element ทันทีถ้าโหลดแล้ว, คืน null พร้อมสั่งโหลดถ้ายัง
   * (ตัววาดเป็น sync ล้วน · โหลดเสร็จค่อยเรียก `onImageReady` ให้ orchestrator วาดโหนดนั้นใหม่)
   */
  imageFor(src, nodeId) {
    const url = src ? this._imgUrl(src) : '';
    if (!url) return null;
    const hit = this._imgCache.get(url);
    if (hit) return hit;
    if (!this._imgPending.has(url)) {
      const p = new Promise((resolve) => {
        const im = new Image();
        im.onload = () => { this._imgCache.set(url, im); this._imgPending.delete(url); resolve(im); };
        im.onerror = () => { this._imgPending.delete(url); resolve(null); };
        im.src = url;
      }).then((im) => { if (im && this._onImageReady) this._onImageReady(url); return im; });
      this._imgPending.set(url, p);
    }
    return null;
  }

  /** วาดกริดด้วย CSS บนตัวห่อ — คมทุกซูม และเลื่อนตาม viewport */
  updateGridCss() {
    const host = this._gridHost;
    if (!host) return;
    const g = this._grid;
    host.style.background = this._bg;
    if (!g.show) { host.style.backgroundImage = 'none'; return; }
    const vt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const z = vt[0] || 1;
    // ที่ซูมต่ำมากกริดจะถี่จนเป็นเทา → ทวีคูณระยะจนห่างอย่างน้อย 9px บนจอ
    let step = g.size * z;
    let mult = 1;
    while (step < 9 && mult < 64) { mult *= 2; step = g.size * mult * z; }
    const col = isThemeGridColor(g.color) ? themeColor('--hover', DEFAULT_GRID.color) : g.color;
    const a = Math.max(0, Math.min(1, g.opacity == null ? 0.9 : g.opacity));
    const c = _rgba(col, a);
    let img = '', size = `${step}px ${step}px`;
    if (g.style === 'lines') {
      img = `linear-gradient(to right, ${c} 1px, transparent 1px), linear-gradient(to bottom, ${c} 1px, transparent 1px)`;
    } else if (g.style === 'cross') {
      const arm = Math.max(2, Math.min(5, step / 8));
      img = `linear-gradient(to right, ${c} ${arm}px, transparent ${arm}px), linear-gradient(to bottom, ${c} ${arm}px, transparent ${arm}px)`;
    } else {
      const r = step > 40 ? 1.5 : 1;
      img = `radial-gradient(circle at ${r}px ${r}px, ${c} ${r}px, transparent ${r}px)`;
    }
    host.style.backgroundImage = img;
    host.style.backgroundSize = g.style === 'cross' ? `${size}, ${size}` : (g.style === 'lines' ? `${size}, ${size}` : size);
    host.style.backgroundPosition = `${vt[4]}px ${vt[5]}px`;
    host.style.backgroundRepeat = 'repeat';
  }

  // ═════════════════ โหนด ═════════════════
  /**
   * บังคับให้กรอบของ fabric.Group เท่ากับขนาดการ์ดเป๊ะ ๆ
   * ปกติ fabric คิดกรอบจาก "ขอบนอกสุดของลูกทุกตัว" → เส้นขอบ 1px ล้นออกข้างละ .5px
   * และหัวเฟรมที่จงใจวางไว้เหนือกรอบก็ถูกนับด้วย → ทุกครั้งที่ย่อ/ขยาย ขนาดจะเพี้ยนสะสม
   * (แก้ตอน alpha.65r: ผู้ใช้ขยาย 180 → ได้ 364 แทน 360)
   * ลูกเก็บพิกัดเทียบ "จุดกึ่งกลางกรอบ" → เลื่อนชดเชยครึ่งหนึ่งของส่วนต่าง ภาพจึงไม่ขยับ
   */
  _forceBox(group, W, H, minX = 0, minY = 0) {
    const bw = group.width, bh = group.height;
    if (Math.abs(bw - W) < 0.01 && Math.abs(bh - H) < 0.01 && Math.abs(minX) < 0.01 && Math.abs(minY) < 0.01) return group;
    // [alpha.154 ข้อ 2] ★ สูตรเดิม `(bw - W) / 2` ถูกเฉพาะตอนลูกซ้ายสุดอยู่ที่ x=0 พอดี
    // ลูกหลุดขอบซ้าย/บน (เส้นขอบ · ป้าย) = ทั้งการ์ดถูกเลื่อนไปขวา/ล่างครึ่งหนึ่งของส่วนเกิน
    // → ขอบขวา/ล่างตกนอกแคชของกลุ่มแล้วโดนเฉือน · ที่ถูกคือเลื่อน "จุดกึ่งกลางของลูกทั้งหมด" ไปที่ W/2
    const ddx = minX + (bw - W) / 2, ddy = minY + (bh - H) / 2;
    for (const k of group._objects) { k.left += ddx; k.top += ddy; k.setCoords(); }
    group.set({ width: W, height: H });
    group.dirty = true;
    group.setCoords();
    return group;
  }

  renderNode(n) {
    const kids = this._cardChildren(n);
    const { minX, minY } = _kidsMin(kids);
    const group = new fabric.Group(kids, {
      left: n.x, top: n.y,
      originX: 'left', originY: 'top',
      lockScalingFlip: true,                      // [alpha.154] ลากเลยจุดยึด = กลับด้านการ์ด (วาดใหม่สด ๆ ไม่ได้)
      hasControls: !n.locked, hasBorders: true,
      borderColor: themeColor('--accent-hi', '#d97757'), borderScaleFactor: 1.6,
      cornerColor: themeColor('--accent-hi', '#d97757'), cornerStrokeColor: themeColor('--input-bg', '#1a1815'),
      cornerSize: 9, transparentCorners: false, cornerStyle: 'circle',
      lockRotation: true,
      lockMovementX: !!n.locked, lockMovementY: !!n.locked,
      selectable: true, evented: true,
      opacity: n.opacity == null ? 1 : n.opacity,
      subTargetCheck: false,
      objectCaching: true,
    });
    group.kind = 'node';
    group.nid = n.id;
    group.ntype = n.type;
    // [alpha.150 ข้อ 5] เนื้อหาล้นเท่าไร — ชั้นโต้ตอบใช้ค่านี้หนีบตอนหมุนล้อบนการ์ด
    group.scrollMax = this._scrollMax || 0;
    group.scrollMaxX = this._scrollMaxX || 0;
    group.layer = n.type === 'frame' ? LAYER.frame : LAYER.node;
    // [บั๊ก 4] เปิดปุ่มปรับขนาดกลางขอบไว้ = ยืดด้านเดียวได้ (ไม่ล็อกสัดส่วน)
    // port ยื่นออกไป PORT_GAP px จึงไม่ทับกัน (บั๊ก 9) · ปิดเฉพาะปุ่มหมุนที่ไม่ใช้
    group.setControlsVisibility({ mtr: false });
    this._forceBox(group, n.width || CARD_W, n.height || CARD_H, minX, minY);
    group.set({ left: n.x, top: n.y });
    group.setCoords();
    this.canvas.add(group);
    this._nodeVis.set(n.id, group);
    return group;
  }

  /**
   * ══ [alpha.154 ข้อ 2] ★ วาดเนื้อการ์ดใหม่ตามขนาด "ระหว่างลาก" ══
   *
   * ผู้ใช้: *"เวลาขยาย card ภาพมันจะถูกยืด มัน slop ไปหน่อย"*
   *
   * ระหว่างลากมุม fabric แค่ยืด `scaleX/scaleY` ของทั้งกลุ่ม → รูป ตัวอักษร เส้นขอบ ถูกยืดตามหมด
   * แล้วค่อยวาดใหม่ตามขนาดจริงตอนปล่อยเมาส์ (เห็นภาพบิดทุกเฟรมที่ลาก)
   *
   * ตอนนี้ทุกเฟรม: ประกอบลูกชุดใหม่ตามกรอบที่ลากอยู่ (ตัววาดตัวเดียวกับตอนวางการ์ด) แล้ว **ย้ายลูกเข้า
   * กลุ่มเดิม** + คืน scale เป็น 1 — ต้องเป็นกลุ่มเดิม เพราะ fabric ถือวัตถุนี้อยู่ในการลากที่ยังไม่จบ
   * (สร้างวัตถุใหม่แทน = การลากหลุดทันที) · ตัวคุมการยืดของ fabric คิดสเกลจากขนาด *ปัจจุบัน*
   * ของวัตถุทุกเฟรมอยู่แล้ว การเปลี่ยน width + คืน scale จึงต่อเนื่องกันพอดี
   * กล่องเลือกหลายใบ = ไม่ทำ (ลูกมีพิกัดเทียบกล่องเลือก — บทเรียนข้อ 19)
   * @returns {boolean} วาดใหม่จริงไหม
   */
  reflowNode(group, n) {
    if (!group || !n || group.kind !== 'node' || group.group) return false;
    const sx = Math.abs(group.scaleX || 1), sy = Math.abs(group.scaleY || 1);
    if (Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3) return false;
    const box = absBox(group);
    const W = Math.max(16, Math.round(box.width)), H = Math.max(16, Math.round(box.height));
    const kids = this._cardChildren({ ...n, width: W, height: H });
    const { minX, minY } = _kidsMin(kids);
    const probe = new fabric.Group(kids, { originX: 'left', originY: 'top' });
    this._forceBox(probe, W, H, minX, minY);
    const objs = probe._objects.slice();
    probe._objects = [];
    for (const o of group._objects) o.group = undefined;
    group._objects = objs;
    for (const o of objs) { o.group = group; if (group.canvas) o.canvas = group.canvas; }
    group.set({ width: W, height: H, scaleX: 1, scaleY: 1, left: box.x, top: box.y });
    group.scrollMax = this._scrollMax || 0;
    group.scrollMaxX = this._scrollMaxX || 0;
    group.dirty = true;
    group.setCoords();
    return true;
  }

  rebuildNode(n) {
    if (!n) return null;
    const old = this._nodeVis.get(n.id);
    const wasActive = old && this.canvas.getActiveObject() === old;
    if (old) this.canvas.remove(old);
    const vis = this.renderNode(n);
    if (wasActive) this.canvas.setActiveObject(vis);
    this.restack();
    return vis;
  }

  removeNode(id) {
    const old = this._nodeVis.get(id);
    if (old) this.canvas.remove(old);
    this._nodeVis.delete(id);
  }

  /** ย้ายเฉย ๆ — ไม่ต้องสร้างชิ้นส่วนใหม่ (เร็วกว่ามาก) */
  moveNode(n) {
    const v = this._nodeVis.get(n.id);
    if (!v) return null;
    v.set({ left: n.x, top: n.y });
    v.setCoords();
    return v;
  }

  // ═══ [alpha.150] ขอบ · พื้น · เนื้อหาที่ยาวเกินการ์ด — กฎกลางชุดเดียวของทุกชนิดโหนด ═══

  /**
   * เส้นขอบของโหนด (ข้อ 7) — ผู้ใช้ตั้งสี/ความหนาเองได้ ไม่ตั้งก็ใช้ขอบมาตรฐานของชนิดนั้น
   * `borderWidth === 0` = ไม่มีขอบเลย (ไม่ใช่ "ใช้ค่าเริ่มต้น")
   */
  _stroke(n, defColor, defWidth) {
    const w = n.borderWidth == null ? (defWidth == null ? 1 : defWidth) : n.borderWidth;
    if (!(w > 0)) return { stroke: null, strokeWidth: 0 };
    return { stroke: n.borderColor || defColor, strokeWidth: w };
  }

  /** สีพื้นของโหนด (ข้อ 8) — `fill` ทับ `color` ได้ และจางลงตาม `fillOpacity` */
  _fill(n, defColor) {
    const base = n.fill || n.color || defColor;
    if (!base || base === 'transparent') return 'rgba(0,0,0,0.001)';
    const a = n.fillOpacity == null ? 1 : n.fillOpacity;
    return _rgba(base, a);
  }

  /**
   * ══ ข้อ 5: ข้อความยาวกว่าการ์ดต้องถูก "ครอบ" ไม่ใช่ล้นออกไป ══
   *
   * ครอบด้วย clipPath ของ fabric (พิกัดของ clipPath เทียบ **จุดกึ่งกลางของวัตถุ** เสมอ —
   * จึงต้องคิดส่วนต่างระหว่างกึ่งกลางกรอบเนื้อหากับกึ่งกลางกล่องข้อความ ไม่ใช่ใส่พิกัดการ์ดตรง ๆ)
   * แล้ววาดแถบเลื่อนบอกว่ายังมีเนื้อหาอยู่ข้างล่าง/ข้างขวา
   *
   * @param kids  อาร์เรย์ลูกของการ์ด (ฟังก์ชันนี้ push แถบเลื่อนต่อท้ายให้)
   * @param obj   วัตถุที่ต้องถูกครอบ (Textbox/กลุ่มข้อความ)
   * @param box   กรอบเนื้อหาในพิกัดของการ์ด `{left, top, width, height}`
   */
  _clipInto(kids, obj, box, n, contentH, contentW) {
    const cH = contentH == null ? (obj.height || 0) : contentH;
    const cW = contentW == null ? box.width : contentW;
    const maxY = Math.max(0, Math.round(cH - box.height));
    const maxX = Math.max(0, Math.round(cW - box.width));
    const sy = Math.min(maxY, Math.max(0, Math.round((n && n.scrollY) || 0)));
    const sx = Math.min(maxX, Math.max(0, Math.round((n && n.scrollX) || 0)));
    this._scrollMax = Math.max(this._scrollMax || 0, maxY);
    this._scrollMaxX = Math.max(this._scrollMaxX || 0, maxX);
    // [alpha.151] เนื้อหาสั้นกว่ากรอบ → จัดแนวตั้งตามที่ผู้ใช้ตั้งไว้ (บน/กลาง/ล่าง)
    // เนื้อหายาวเกินกรอบ = ไม่มีที่ว่างให้จัด ใช้ตำแหน่งเลื่อนแทนเหมือนเดิม
    const slack = Math.max(0, box.height - cH);
    const va = (n && n.textVAlign) || 'top';
    const vOff = slack === 0 ? 0 : va === 'middle' ? slack / 2 : va === 'bottom' ? slack : 0;
    obj.set({ top: box.top - sy + vOff, left: obj.left - sx });
    const ocx = obj.left + (obj.width || 0) / 2, ocy = obj.top + (obj.height || 0) / 2;
    obj.clipPath = new fabric.Rect({
      left: box.left + box.width / 2 - ocx, top: box.top + box.height / 2 - ocy,
      width: box.width, height: box.height, originX: 'center', originY: 'center',
    });
    kids.push(obj);
    // แถบเลื่อนต้องอยู่ทับเนื้อหา จึง push หลังเสมอ
    kids.push(...this._scrollBars(box, { x: sx, y: sy }, { x: maxX, y: maxY }, { w: cW, h: cH }));
    return { x: maxX, y: maxY };
  }

  /**
   * แถบเลื่อนของกรอบเนื้อหาหนึ่งกรอบ — **สองแกน**
   *
   * [alpha.150r] ผู้ใช้: *"ถึงตัดคำ ยังไงก็ต้องมี ในกรณีที่ insert ภาพ"* — ถูกต้อง:
   * ข้อความตัดบรรทัดเองจึงไม่มีวันล้นด้านข้าง แต่ **รูปไม่ตัดบรรทัด** พอขยายรูปเมื่อไหร่
   * ก็ล้นแนวนอนทันที · แกนแนวนอนจึงไม่ใช่ของเผื่อไว้ แต่เป็นของที่ต้องมีจริง
   */
  _scrollBars(box, pos, max, content) {
    const out = [];
    const w = 4;
    const common = { originX: 'left', originY: 'top', selectable: false, evented: false, rx: 2, ry: 2 };
    const TRACK = 'rgba(0,0,0,0.18)', THUMB = 'rgba(255,255,255,0.38)';
    if (max.y > 0) {
      const x = box.left + box.width - w;
      const ratio = Math.max(0.12, box.height / Math.max(1, content.h));
      const thumbH = Math.max(14, box.height * ratio);
      const ty = box.top + (pos.y / max.y) * (box.height - thumbH);
      out.push(new fabric.Rect({ ...common, left: x, top: box.top, width: w, height: box.height, fill: TRACK }),
               new fabric.Rect({ ...common, left: x, top: ty, width: w, height: thumbH, fill: THUMB }));
    }
    if (max.x > 0) {
      const y = box.top + box.height - w;
      const ratio = Math.max(0.12, box.width / Math.max(1, content.w));
      const thumbW = Math.max(14, box.width * ratio);
      const tx = box.left + (pos.x / max.x) * (box.width - thumbW);
      out.push(new fabric.Rect({ ...common, left: box.left, top: y, width: box.width, height: w, fill: TRACK }),
               new fabric.Rect({ ...common, left: tx, top: y, width: thumbW, height: w, fill: THUMB }));
    }
    return out;
  }

  _cardChildren(n) {
    const W = n.width || CARD_W, H = n.height || CARD_H;
    const d = TYPE_DEFAULTS[n.type] || TYPE_DEFAULTS.scene;
    const textFill = n.textColor || d.textColor || themeColor('--bright', '#faf9f5');
    const fs = n.fontSize || d.fontSize || 12.5;
    this._scrollMax = 0;
    this._scrollMaxX = 0;
    let kids;
    switch (n.type) {
      case 'sticky':  kids = this._stickyChildren(n, W, H, textFill, fs); break;
      case 'text':    kids = this._textChildren(n, W, H, textFill, fs); break;
      case 'shape':   kids = this._shapeChildren(n, W, H, textFill, fs); break;
      case 'frame':   kids = this._frameChildren(n, W, H, textFill, fs); break;
      case 'comment': kids = this._commentChildren(n, W, H, textFill, fs); break;
      case 'image':   kids = this._imageChildren(n, W, H, textFill, fs); break;
      case 'todo':    kids = this._todoChildren(n, W, H, textFill, fs); break;
      default:        kids = this._recordChildren(n, W, H, textFill, fs);
    }
    // [alpha.154 ข้อ 2] ★ ผู้ใช้: *"card ขอบด้านขวาหาย check ทุกอันว่ามีขอบครบมั้ย"*
    // พื้นการ์ดของ **ทุกชนิด** คือลูกตัวแรก — ร่นเส้นขอบเข้าในกรอบ W×H ที่เดียวตรงนี้
    if (kids && kids[0]) _strokeInside(kids[0], W, H);
    return kids;
  }

  // ── รูปบนกระดาน (ข้อ 6) ──
  _imageChildren(n, W, H, textFill, fs) {
    const st = this._stroke(n, 'rgba(255,255,255,0.14)', 0);
    const kids = [new fabric.Rect({
      left: 0, top: 0, width: W, height: H, rx: 4, ry: 4,
      fill: this._fill(n, themeColor('--side', '#1f1e1c')), ...st, originX: 'left', originY: 'top',
    })];
    const im = this.imageFor(n.src, n.id);
    if (!im) {
      kids.push(new fabric.Text(glyphOf(n.src ? 'hourglass' : 'image'), {
        left: W / 2, top: H / 2, fontSize: Math.min(40, Math.min(W, H) * 0.35),
        fill: 'rgba(255,255,255,0.3)', fontFamily: FONT, originX: 'center', originY: 'center',
      }));
      if (!n.src) {
        kids.push(new fabric.Text(tt('ui.planner.imgPickHint'), {
          left: W / 2, top: H / 2 + 30, fontSize: Math.max(9, fs), fill: 'rgba(255,255,255,0.42)',
          fontFamily: FONT, originX: 'center', originY: 'top',
        }));
      }
      return kids;
    }
    // [alpha.150r] วางรูปแล้วรายงานกลับว่าล้นกรอบเท่าไร → แถบเลื่อนสองแกน
    const placed = _fitImage(im, n, W, H);
    kids.push(...placed.objects);
    this._scrollMax = Math.max(this._scrollMax || 0, placed.max.y);
    this._scrollMaxX = Math.max(this._scrollMaxX || 0, placed.max.x);
    if (placed.max.x > 0 || placed.max.y > 0) {
      kids.push(...this._scrollBars({ left: 0, top: 0, width: W, height: H },
                                    placed.pos, placed.max, placed.content));
    }
    if (n.title) {
      kids.push(new fabric.Text(_clip(n.title, 40), {
        left: 8, top: H - 18, fontSize: Math.max(9, fs), fill: textFill,
        backgroundColor: 'rgba(0,0,0,0.45)', fontFamily: FONT, originX: 'left', originY: 'top',
      }));
    }
    // [alpha.154 ข้อ 2] รูปวาด **ทับ** พื้นการ์ด (เต็มกรอบ) → เส้นขอบที่ผู้ใช้ตั้งถูกรูปกลบทั้งสี่ด้าน
    // วาดขอบซ้ำอีกชั้นไว้บนสุด (พื้นโปร่ง) เพื่อให้เห็นครบทุกด้านเสมอ
    if (st.strokeWidth > 0) {
      const sw = st.strokeWidth;
      kids.push(new fabric.Rect({
        left: 0, top: 0, width: Math.max(1, W - sw), height: Math.max(1, H - sw), rx: 4, ry: 4,
        fill: '', ...st, originX: 'left', originY: 'top', selectable: false, evented: false,
      }));
    }
    return kids;
  }

  // ── รายการสิ่งที่ต้องทำ (ข้อ 9) ──
  _todoChildren(n, W, H, textFill, fs) {
    const L = TODO_LAYOUT;
    const items = normTodoItems(n.items);
    const prog = todoProgress(items);
    const st = this._stroke(n, 'rgba(255,255,255,0.12)', 1);
    const kids = [new fabric.Rect({
      left: 0, top: 0, width: W, height: H, rx: 8, ry: 8,
      fill: this._fill(n, themeColor('--bar', '#2f2e2b')), ...st, originX: 'left', originY: 'top',
    })];
    kids.push(new fabric.Text(_clip(_withGlyph(ICONS.todo, n.title || tt('ui.planner.todoNew')), 34), {
      left: L.padX, top: 7, fontSize: fs, fill: textFill,
      fontFamily: FONT, originX: 'left', originY: 'top',
    }));
    kids.push(new fabric.Text(`${prog.done}/${prog.total}`, {
      left: W - L.padX, top: 8, fontSize: Math.max(8, fs - 2), fill: 'rgba(255,255,255,0.45)',
      fontFamily: FONT, originX: 'right', originY: 'top',
    }));
    // แถบความคืบหน้าใต้หัว
    kids.push(new fabric.Rect({
      left: L.padX, top: L.headH - 7, width: W - L.padX * 2, height: L.progH, rx: 2, ry: 2,
      fill: 'rgba(255,255,255,0.1)', originX: 'left', originY: 'top',
    }));
    if (prog.total) {
      kids.push(new fabric.Rect({
        left: L.padX, top: L.headH - 7, width: (W - L.padX * 2) * (prog.percent / 100), height: L.progH,
        rx: 2, ry: 2, fill: PLANNER_KIND.done, originX: 'left', originY: 'top',
      }));
    }

    const box = { left: 0, top: L.headH, width: W, height: Math.max(10, H - L.headH - 4) };
    const contentH = items.length * L.rowH + 4;
    const max = Math.max(0, Math.round(contentH - box.height));
    const sy = Math.min(max, Math.max(0, Math.round(n.scrollY || 0)));
    this._scrollMax = max;

    const rows = [];
    items.forEach((it, i) => {
      const y = i * L.rowH;
      rows.push(new fabric.Rect({
        left: L.padX, top: y + 3, width: L.boxSize, height: L.boxSize, rx: 3, ry: 3,
        fill: it.done ? PLANNER_KIND.done : 'rgba(0,0,0,0.25)',
        stroke: it.done ? PLANNER_KIND.done : 'rgba(255,255,255,0.35)', strokeWidth: 1,
        originX: 'left', originY: 'top',
      }));
      if (it.done) {
        rows.push(new fabric.Text(glyphOf('checkmark'), {
          left: L.padX + L.boxSize / 2, top: y + 3 + L.boxSize / 2, fontSize: L.boxSize - 2,
          fill: PLANNER_KIND.onColor, fontFamily: FONT, originX: 'center', originY: 'center',
        }));
      }
      rows.push(new fabric.Text(_clip(it.text || '', 40), {
        left: L.padX + L.boxSize + L.boxGap, top: y + 3, fontSize: Math.max(8, fs - 1),
        fill: it.done ? 'rgba(255,255,255,0.4)' : textFill,
        linethrough: !!it.done,
        fontFamily: FONT, originX: 'left', originY: 'top',
      }));
    });
    if (!items.length) {
      rows.push(new fabric.Text(tt('ui.planner.todoEmpty'), {
        left: L.padX, top: 4, fontSize: Math.max(8, fs - 1), fill: 'rgba(255,255,255,0.35)',
        fontFamily: FONT, originX: 'left', originY: 'top',
      }));
    }
    const list = new fabric.Group(rows, {
      left: 0, top: box.top - sy, width: W, height: Math.max(1, contentH),
      originX: 'left', originY: 'top', subTargetCheck: false, objectCaching: false,
    });
    const ocx = list.left + W / 2, ocy = list.top + list.height / 2;
    list.clipPath = new fabric.Rect({
      left: box.left + box.width / 2 - ocx, top: box.top + box.height / 2 - ocy,
      width: box.width, height: box.height, originX: 'center', originY: 'center',
    });
    kids.push(list);
    if (max > 0) kids.push(...this._scrollBar({ ...box, left: 2, width: W - 4 }, sy, max, contentH));
    return kids;
  }

  // ── การ์ดผูกเนื้อเรื่อง (ฉาก/บท/Wiki/โน้ต) ──
  _recordChildren(n, W, H, textFill, fs) {
    const kids = [new fabric.Rect({
      left: 0, top: 0, width: W, height: H, rx: 8, ry: 8,
      fill: this._fill(n, themeColor('--border', '#3f3e3a')), ...this._stroke(n, 'rgba(255,255,255,0.12)', 1),
      originX: 'left', originY: 'top',
    })];

    let titleW = W - 20;
    if (n.status) {
      const c = STATUS_COLOR[n.status] || PLANNER_KIND.statusUnknown;
      const txt = new fabric.Text(n.status, {
        left: W - 10, top: 9, fontSize: 9, fill: PLANNER_KIND.onColor,
        fontFamily: FONT, originX: 'right', originY: 'top',
      });
      const pad = 6;
      kids.push(new fabric.Rect({
        left: W - 10 - (txt.width + pad * 2), top: 6, width: txt.width + pad * 2, height: 16,
        rx: 8, ry: 8, fill: c, originX: 'left', originY: 'top',
      }), txt);
      titleW = Math.max(30, W - 30 - txt.width - 12);
    }

    const ha = n.textAlign || 'left';
    kids.push(new fabric.Textbox(_clip(_withGlyph(ICONS[n.type], n.title || tt('ui.common.notSpecifyName')), 70), {
      left: 10, top: 8, width: Math.max(20, titleW), fontSize: fs, fill: textFill,
      fontFamily: FONT, originX: 'left', originY: 'top', textAlign: ha,
      editable: false, splitByGrapheme: true,
    }));

    // ══ [alpha.151 ข้อ 4] ★ รูป "ในการ์ด" ══
    // ผู้ใช้: *"ใน card ของ planner ยังแทรกรูปไม่ได้นะ"* — รอบ .150 มีแต่การ์ดที่ **เป็น** รูปทั้งใบ
    // ส่วนการ์ดฉาก/ตัวละครใส่รูปไม่ได้เลย ทั้งที่รูปตัวอย่างที่ผู้ใช้ส่งมามีรูปอยู่ในการ์ด
    let bodyTop = 44;
    if (n.src) {
      const im = this.imageFor(n.src, n.id);
      const bandH = Math.max(24, Math.round((H - 44) * (n.imageH == null ? 0.45 : n.imageH)));
      const band = { left: 10, top: bodyTop, width: W - 20, height: bandH };
      if (im) {
        for (const o of _fitImageInto(im, n, band)) kids.push(o);
      } else {
        kids.push(new fabric.Rect({
          left: band.left, top: band.top, width: band.width, height: band.height,
          rx: 4, ry: 4, fill: 'rgba(255,255,255,0.05)', originX: 'left', originY: 'top',
        }));
      }
      bodyTop += bandH + 6;
    }

    if (n.synopsis) {
      // [alpha.150 ข้อ 5] เดิมตัดข้อความทิ้งด้วยการเดาจำนวนบรรทัด (`_clip(…, lines*34)`) —
      // เนื้อหาที่เกินหายไปเฉย ๆ และตัวที่เหลือก็ยังล้นก้นการ์ดอยู่ดีเพราะการเดาไม่ตรงกับการวัดจริง
      // ตอนนี้ใส่เนื้อหาทั้งก้อนแล้ว "ครอบ" ด้วยกรอบจริง + มีแถบเลื่อน
      const room = Math.max(12, H - bodyTop - (n.tags && n.tags.length ? 28 : 0) - (n.file ? 16 : 0));
      const tb = new fabric.Textbox(String(n.synopsis), {
        left: 10, top: bodyTop, width: W - 22, fontSize: Math.max(8, fs - 3), fill: 'rgba(255,255,255,0.55)',
        fontFamily: FONT, originX: 'left', originY: 'top', textAlign: ha,
        editable: false, splitByGrapheme: true, lineHeight: 1.15,
      });
      this._clipInto(kids, tb, { left: 10, top: bodyTop, width: W - 20, height: room }, n);
    }

    if (n.tags && n.tags.length) {
      let tx = 10;
      for (const t of n.tags.slice(0, 3)) {
        const vt = visualTagFor(t);
        const label = vt ? (vt.icon || glyphOf('dot')) + ' ' + t : '#' + t;
        const txt = new fabric.Text(label, {
          left: tx, top: H - 30, fontSize: 9,
          fill: vt ? vt.color : 'rgba(255,255,255,0.4)',
          fontFamily: FONT, originX: 'left', originY: 'top',
        });
        if (tx + (txt.width || 30) > W - 10) break;
        kids.push(txt);
        tx += (txt.width || 30) + 6;
      }
    }

    if (n.file) {
      const short = String(n.file).split(/[\\/]/).pop() || n.file;
      kids.push(new fabric.Text(_clip(_withGlyph('paperclip', short), 26), {
        left: 10, top: H - 16, fontSize: 9, fill: 'rgba(255,255,255,0.35)',
        fontFamily: FONT, originX: 'left', originY: 'top',
      }));
    }
    return kids;
  }

  // ── โพสต์อิต ──
  _stickyChildren(n, W, H, textFill, fs) {
    const body = n.synopsis || n.title || '';
    const kids = [new fabric.Rect({
      left: 0, top: 0, width: W, height: H, rx: 2, ry: 2,
      fill: this._fill(n, PLANNER_KIND.sticky), ...this._stroke(n, 'rgba(0,0,0,0.18)', 1),
      originX: 'left', originY: 'top',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.35)', blur: 8, offsetX: 1, offsetY: 3 }),
    })];
    const tb = new fabric.Textbox(body || tt('ui.plannerRender.clickWrite'), {
      left: 12, top: 12, width: W - 26, fontSize: fs, fill: textFill,
      fontFamily: FONT, originX: 'left', originY: 'top',
      editable: false, splitByGrapheme: true, lineHeight: 1.32,
      textAlign: n.textAlign || 'left',          // [alpha.151] จัดข้อความในการ์ดได้
    });
    this._clipInto(kids, tb, { left: 12, top: 12, width: W - 24, height: Math.max(10, H - 24) }, n);
    return kids;
  }

  // ── ข้อความลอย ──
  _textChildren(n, W, H, textFill, fs) {
    const kids = [new fabric.Rect({
      left: 0, top: 0, width: W, height: H,
      fill: this._fill(n, 'transparent'),
      ...this._stroke(n, 'rgba(255,255,255,0.18)', 0),
      originX: 'left', originY: 'top',
    })];
    const tb = new fabric.Textbox(n.title || tt('ui.common.text'), {
      left: 2, top: 2, width: Math.max(20, W - 8), fontSize: fs, fill: textFill,
      fontFamily: FONT, originX: 'left', originY: 'top', textAlign: n.textAlign || 'left',
      editable: false, splitByGrapheme: true, lineHeight: 1.25,
    });
    this._clipInto(kids, tb, { left: 2, top: 2, width: Math.max(20, W - 4), height: Math.max(10, H - 4) }, n);
    return kids;
  }

  // ── รูปทรง ──
  _shapeChildren(n, W, H, textFill, fs) {
    const fill = this._fill(n, PLANNER_KIND.note);
    const common = { left: 0, top: 0, originX: 'left', originY: 'top', fill,
                     ...this._stroke(n, 'rgba(255,255,255,0.18)', 1) };
    let shape;
    switch (n.shape) {
      case 'ellipse':
        shape = new fabric.Ellipse({ ...common, rx: W / 2, ry: H / 2 }); break;
      case 'round':
        shape = new fabric.Rect({ ...common, width: W, height: H, rx: Math.min(W, H) * 0.22, ry: Math.min(W, H) * 0.22 }); break;
      case 'diamond':
        shape = new fabric.Polygon(
          [{ x: W / 2, y: 0 }, { x: W, y: H / 2 }, { x: W / 2, y: H }, { x: 0, y: H / 2 }], common); break;
      case 'triangle':
        shape = new fabric.Polygon([{ x: W / 2, y: 0 }, { x: W, y: H }, { x: 0, y: H }], common); break;
      case 'star':
        shape = new fabric.Polygon(_starPoints(W, H), common); break;
      case 'arrow':
        shape = new fabric.Polygon([
          { x: 0, y: H * 0.3 }, { x: W * 0.62, y: H * 0.3 }, { x: W * 0.62, y: 0 },
          { x: W, y: H / 2 }, { x: W * 0.62, y: H }, { x: W * 0.62, y: H * 0.7 }, { x: 0, y: H * 0.7 },
        ], common); break;
      case 'cylinder':
        shape = new fabric.Path(_cylinderPath(W, H), { ...common }); break;
      default:
        shape = new fabric.Rect({ ...common, width: W, height: H, rx: 4, ry: 4 });
    }
    const kids = [shape];
    if (n.title) {
      const tb = new fabric.Textbox(n.title, {
        left: 8, top: 6, width: Math.max(20, W - 16), fontSize: fs, fill: textFill,
        fontFamily: FONT, originX: 'left', originY: 'top', textAlign: n.textAlign || 'center',
        editable: false, splitByGrapheme: true,
      });
      // [alpha.151] รูปทรงเคยบังคับข้อความไว้กลางใบตายตัว — ตอนนี้จัดได้ทั้งสองแกน
      this._clipInto(kids, tb, { left: 8, top: 6, width: Math.max(20, W - 16),
                                 height: Math.max(10, H - 12) },
                     { ...n, textVAlign: n.textVAlign || 'middle' });
    }
    return kids;
  }

  // ── เฟรม (กรอบจัดกลุ่มพื้นที่ แบบ Miro) ──
  /**
   * ── เฟรม (กรอบจัดกลุ่มพื้นที่ แบบ Miro) ──
   *
   * [alpha.150 ข้อ 8] **ต้นตอที่ขอบล่างของเฟรมหาย**: ป้ายชื่อเคยวางไว้ที่ `top:-22`
   * (เหนือกรอบ) → กล่องของ `fabric.Group` สูง H+22 · `_forceBox()` บังคับกลับเป็น H โดยเลื่อนลูก
   * ลงมาครึ่งหนึ่งของส่วนต่าง (11px) → ขอบล่างของสี่เหลี่ยมไปอยู่ที่ H+11 ซึ่ง **อยู่นอกแคชของกลุ่ม**
   * (`objectCaching:true` วาดลงผืนเท่ากับ width/height แล้วเฉือนส่วนเกินทิ้ง) = เห็นสามด้าน
   * → ย้ายป้ายเข้ามา **ในกรอบ** เป็นแถบหัวเรื่อง: กล่องกลุ่มเท่ากับ W×H พอดีตั้งแต่ต้น ไม่มีอะไรถูกเฉือน
   */
  _frameChildren(n, W, H, textFill, fs) {
    const col = n.color || themeColor('--accent-hi', '#d97757');
    const head = Math.min(24, Math.max(16, H * 0.08));
    return [
      new fabric.Rect({
        left: 0, top: 0, width: W, height: H, rx: 6, ry: 6,
        fill: this._fill(n, PLANNER_KIND.fillDefault), ...this._stroke(n, col, 1.5),
        originX: 'left', originY: 'top',
      }),
      new fabric.Rect({
        left: 0, top: 0, width: W, height: head,
        fill: _rgba(col, 0.16), stroke: null, originX: 'left', originY: 'top',
      }),
      new fabric.Text(_clip(_withGlyph(ICONS.frame, n.title || tt('ui.common.frame')), 34), {
        left: 8, top: head / 2, fontSize: Math.min(fs, 13), fill: col,
        fontFamily: FONT, originX: 'left', originY: 'center',
      }),
    ];
  }

  // ── คอมเมนต์ ──
  _commentChildren(n, W, H, textFill, fs) {
    const fill = this._fill(n, PLANNER_KIND.paper);
    const kids = [
      new fabric.Path(_bubblePath(W, H), {
        left: 0, top: 0, originX: 'left', originY: 'top',
        fill, ...this._stroke(n, 'rgba(0,0,0,0.25)', 1),
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 6, offsetX: 1, offsetY: 2 }),
      }),
      new fabric.Text(_withGlyph(ICONS.comment, _clip(n.title || tt('ui.common.comment'), 20)), {
        left: 10, top: 8, fontSize: Math.max(9, fs - 2), fill: 'rgba(0,0,0,0.5)',
        fontFamily: FONT, originX: 'left', originY: 'top',
      }),
    ];
    const tb = new fabric.Textbox(String(n.synopsis || ''), {
      left: 10, top: 26, width: W - 22, fontSize: fs, fill: n.textColor || PLANNER_KIND.inkOnLight,
      fontFamily: FONT, originX: 'left', originY: 'top', textAlign: n.textAlign || 'left',
      editable: false, splitByGrapheme: true, lineHeight: 1.25,
    });
    // หางฟองคำพูดกินความสูงด้านล่าง 14px — กรอบเนื้อหาต้องหยุดเหนือหาง
    this._clipInto(kids, tb, { left: 10, top: 26, width: W - 20, height: Math.max(10, H - 26 - 16) }, n);
    return kids;
  }

  // ═════════════════ เส้นเชื่อม (บั๊ก 9/10/11) ═════════════════
  /** วาดเส้นทั้งหมดใหม่ — ใช้ตอนโหลด/undo เท่านั้น */
  renderEdges(edges) {
    for (const [id] of this._edgeVis) this._removeEdgeVis(id);
    this._edgeVis.clear();
    for (const e of edges) this.renderEdge(e);
    this.restack();
  }

  /** วาด/อัปเดตเส้นเดียว */
  renderEdge(e) {
    this._removeEdgeVis(e.id);
    const a = this._nodeVis.get(e.from.nodeId), b = this._nodeVis.get(e.to.nodeId);
    if (!a || !b) return null;
    const boxA = _boxOf(a), boxB = _boxOf(b);
    const geo = edgeGeometry(boxA, boxB, e);
    const sel = this._selectedEdgeId === e.id;
    const dim = (a.opacity < 1 || b.opacity < 1) ? 0.12 : 1;
    const col = e.color || themeColor('--accent-hi', '#d97757');
    const w = e.width || 2;
    // [บั๊ก 65r2-2] เดิมบังคับ strokeDashArray=null ตอนถูกเลือก → กด "ประ/จุด" แล้วไม่เห็นอะไรเปลี่ยน
    const dash = e.style === 'dashed' ? [w * 3, w * 2] : e.style === 'dotted' ? [1, w * 2.2] : null;
    // [บั๊ก 65r2-3] มีหัวลูกศร → ร่นปลายเส้นเข้ามาหน่อย ไม่ให้เส้นทะลุออกหัว
    const trimEnd = _headInset(e.arrowEnd, w);
    const trimStart = _headInset(e.arrowStart, w);
    const d = edgePathString(trimGeometry(geo, trimStart, trimEnd));

    const line = new fabric.Path(d, {
      stroke: col, strokeWidth: sel ? w + 1.6 : w, fill: '',
      strokeDashArray: dash, opacity: dim,
      selectable: false, evented: false, objectCaching: false,
      strokeLineCap: 'round', strokeLineJoin: 'round',
      shadow: sel ? new fabric.Shadow({ color: col, blur: 8 }) : null,
    });
    line.kind = 'edge'; line.eid = e.id; line.layer = LAYER.edge;

    this.canvas.add(line);
    // เก็บรูปเส้นเป็นชุดจุดไว้ทดสอบการคลิกด้วยระยะทางจริง (บั๊ก 65r3-3)
    const rec = { line, heads: [], label: null, samples: sampleGeometry(geo, 22), dim };

    const ang = edgeAngles(geo);
    const hEnd = this._arrowHead(e.arrowEnd, geo.end, ang.end, col, w, dim);
    if (hEnd) { hEnd.eid = e.id; rec.heads.push(hEnd); this.canvas.add(hEnd); }
    const hStart = this._arrowHead(e.arrowStart, geo.start, ang.start + 180, col, w, dim);
    if (hStart) { hStart.eid = e.id; rec.heads.push(hStart); this.canvas.add(hStart); }

    if (e.label) {
      const m = edgeMidpoint(geo);
      const lb = new fabric.Text(e.label, {
        left: m.x, top: m.y - 4, fontSize: 10, opacity: dim,
        fill: sel ? themeColor('--bright', '#faf9f5') : 'rgba(255,255,255,0.62)',
        backgroundColor: 'rgba(38,38,36,0.75)',
        fontFamily: FONT, originX: 'center', originY: 'bottom',
        selectable: false, evented: false, objectCaching: false,
      });
      lb.kind = 'edge'; lb.eid = e.id; lb.layer = LAYER.edge;
      this.canvas.add(lb);
      rec.label = lb;
    }
    this._edgeVis.set(e.id, rec);
    return rec;
  }

  /** อัปเดตเฉพาะเส้นที่แตะโหนดที่กำลังลาก — หัวใจของความลื่น (บั๊ก 2) */
  updateEdgesFor(edges) {
    for (const e of edges) this.renderEdge(e);
    this.restack();
  }

  /**
   * หาเส้นที่อยู่ใต้เมาส์จริง ๆ (วัดระยะจากตัวเส้น ไม่ใช่กรอบสี่เหลี่ยม) — บั๊ก 65r3-3
   * @param {{x,y}} pt พิกัดกระดาน · @param {number} tol ระยะยอมรับ (พิกัดกระดาน)
   */
  hitEdgeAt(pt, tol) {
    const t = tol != null ? tol : EDGE_HIT_TOL / (this.canvas.getZoom() || 1);
    let bestId = null, best = Infinity;
    for (const [id, rec] of this._edgeVis) {
      if (rec.dim !== 1) continue;                 // เส้นที่ถูกกรองจางอยู่ = คลิกไม่ได้
      const d = distanceToPolyline(pt, rec.samples);
      if (d <= t && d < best) { best = d; bestId = id; }
    }
    return bestId;
  }

  _removeEdgeVis(id) {
    const v = this._edgeVis.get(id);
    if (!v) return;
    if (v.line) this.canvas.remove(v.line);
    if (v.label) this.canvas.remove(v.label);
    for (const h of v.heads || []) this.canvas.remove(h);
    this._edgeVis.delete(id);
  }

  removeEdge(id) { this._removeEdgeVis(id); }

  _arrowHead(kind, pt, angleDeg, color, w, opacity) {
    if (!kind || kind === 'none' || !pt) return null;
    const s = 7 + w * 1.6;
    const base = {
      left: pt.x, top: pt.y, originX: 'center', originY: 'center',
      fill: color, stroke: null, opacity, selectable: false, evented: false,
      angle: angleDeg + 90, objectCaching: false,
    };
    let o;
    if (kind === 'circle') {
      o = new fabric.Circle({ ...base, angle: 0, radius: s * 0.42 });
    } else if (kind === 'diamond') {
      o = new fabric.Rect({ ...base, width: s * 0.8, height: s * 0.8, angle: angleDeg + 45 });
    } else if (kind === 'bar') {
      o = new fabric.Rect({ ...base, width: Math.max(2, w), height: s * 1.4 });
    } else if (kind === 'triangle') {
      o = new fabric.Triangle({ ...base, width: s * 1.15, height: s * 1.15 });
    } else {                                     // 'arrow' — ปลายเปิดแบบลูกศรบาง
      o = new fabric.Path(`M ${-s * 0.7} ${-s * 0.9} L 0 0 L ${s * 0.7} ${-s * 0.9}`, {
        ...base, fill: '', stroke: color, strokeWidth: Math.max(1.5, w),
        strokeLineCap: 'round', strokeLineJoin: 'round',
      });
    }
    o.kind = 'edge'; o.layer = LAYER.edge;
    return o;
  }

  // ═════════════════ Port (จุดต่อเส้น) ═════════════════
  _makePorts() {
    for (const port of ['top', 'right', 'bottom', 'left']) {
      const dot = new fabric.Circle({
        left: 0, top: 0, radius: 6.5, fill: themeColor('--accent-hi', '#d97757'), stroke: themeColor('--bright', '#faf9f5'), strokeWidth: 1.6,
        originX: 'center', originY: 'center', selectable: false, evented: false,
        hoverCursor: 'crosshair', visible: false, objectCaching: false,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 4 }),
      });
      dot.kind = 'port'; dot.port = port; dot.layer = LAYER.port; dot.nid = null;
      this.canvas.add(dot);
      this._anchors.push(dot);
    }
    // มือจับปลายเส้น — ลากออกเพื่อ "ถอดปลั๊ก" หรือย้ายไปต่อการ์ดอื่น (บั๊ก 65r2-5)
    this._endHandles = [];
    for (const end of ['from', 'to']) {
      const h = new fabric.Circle({
        left: 0, top: 0, radius: 6, fill: themeColor('--input-bg', '#1a1815'), stroke: themeColor('--accent-hi', '#d97757'), strokeWidth: 2.4,
        originX: 'center', originY: 'center', selectable: false, evented: false,
        hoverCursor: 'grab', visible: false, objectCaching: false,
      });
      h.kind = 'edgeend'; h.end = end; h.layer = LAYER.port; h.eid = null;
      this.canvas.add(h);
      this._endHandles.push(h);
    }
  }

  /**
   * ══ [alpha.151 ข้อ 9] ★ มือจับ "กลางท่อน" ของเส้นหักมุมฉาก (แบบ Miro) ══
   *
   * ผู้ใช้: *"เส้น link เราอยากให้ปรับได้ โดยเฉพาะหักมุมฉาก มันควรจะมีจุดให้ปรับ"*
   * สร้างสด ๆ ทุกครั้งที่เลือกเส้น เพราะจำนวนท่อนเปลี่ยนตามตำแหน่งการ์ด (ต่างจากมือจับ
   * ปลายเส้นซึ่งมีสองจุดเสมอ จึงใช้ซ้ำได้)
   */
  showBendHandles(edge, geo) {
    this.hideBendHandles();
    if (!edge || edge.routing !== 'orthogonal') return [];
    const z = this.canvas.getZoom() || 1;
    this._bendHandles = [];
    for (const h of bendHandles(geo)) {
      const dot = new fabric.Circle({
        left: h.x, top: h.y, radius: 5.5 / z, fill: themeColor('--bright', '#faf9f5'),
        stroke: PLANNER_KIND.handle, strokeWidth: 2 / z,
        originX: 'center', originY: 'center', selectable: false, evented: true,
        hoverCursor: h.axis === 'v' ? 'ew-resize' : 'ns-resize', objectCaching: false,
      });
      dot.kind = 'bend';
      dot.eid = edge.id;
      dot.bendIndex = h.index;
      dot.bendAxis = h.axis;
      dot.layer = LAYER.port;
      this.canvas.add(dot);
      this._bendHandles.push(dot);
    }
    this.restack();
    return this._bendHandles;
  }

  hideBendHandles() {
    if (!this._bendHandles) return;
    for (const h of this._bendHandles) this.canvas.remove(h);
    this._bendHandles = null;
  }

  /** โชว์มือจับปลายเส้นที่เลือกอยู่ (บั๊ก 65r2-5) */
  showEdgeHandles(edge) {
    if (!edge || !this._endHandles) return null;
    const a = this._nodeVis.get(edge.from.nodeId), b = this._nodeVis.get(edge.to.nodeId);
    if (!a || !b) { this.hideEdgeHandles(); return null; }
    const geo = edgeGeometry(_boxOf(a), _boxOf(b), edge);
    const z = this.canvas.getZoom() || 1;
    const pos = { from: geo.start, to: geo.end };
    for (const h of this._endHandles) {
      const p = pos[h.end];
      h.set({ left: p.x, top: p.y, visible: true, evented: true, radius: 6 / z, strokeWidth: 2.4 / z });
      h.eid = edge.id;
      h.setCoords();
    }
    this._handleEdgeId = edge.id;
    this.showBendHandles(edge, geo);      // [alpha.151 ข้อ 9]
    this.restack();
    return this._endHandles;
  }

  hideEdgeHandles() {
    this.hideBendHandles();
    if (!this._endHandles) return;
    for (const h of this._endHandles) { h.set({ visible: false, evented: false }); h.eid = null; }
    this._handleEdgeId = null;
  }

  /** โชว์ port ของการ์ดนี้ — ยื่นออกนอกกรอบ transform (บั๊ก 9) */
  showPorts(nodeVis) {
    if (!nodeVis || nodeVis.opacity < 1) { this.hidePorts(); return; }
    const b = _boxOf(nodeVis);
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const z = this.canvas.getZoom() || 1;
    const gap = PORT_GAP / z;                    // ระยะคงที่บนจอไม่ว่าซูมเท่าไหร่
    const pos = {
      top: { x: cx, y: b.y - gap },
      right: { x: b.x + b.width + gap, y: cy },
      bottom: { x: cx, y: b.y + b.height + gap },
      left: { x: b.x - gap, y: cy },
    };
    for (const dot of this._anchors) {
      const p = pos[dot.port];
      // evented ต้องเดินคู่กับ visible เสมอ — จุดที่ซ่อนอยู่ห้ามดักคลิกแทนเส้นข้างใต้ (บั๊ก 65r2-4)
      dot.set({ left: p.x, top: p.y, visible: true, evented: true, radius: 6.5 / z, strokeWidth: 1.6 / z });
      dot.nid = nodeVis.nid;
      dot.setCoords();
    }
    this._portOwner = nodeVis.nid;
    this.restack();
  }

  hidePorts() {
    if (!this._portOwner && !this._anchors.some((d) => d.visible)) return;
    for (const dot of this._anchors) { dot.set({ visible: false, evented: false }); dot.nid = null; }
    this._portOwner = null;
  }

  portOwner() { return this._portOwner; }

  // ═════════════════ กลุ่ม ═════════════════
  renderGroup(g) {
    const rect = new fabric.Rect({
      left: g.x, top: g.y, width: g.width, height: g.height, rx: 12, ry: 12,
      fill: 'rgba(255,255,255,0.03)', stroke: g.color, strokeWidth: 1.5,
      strokeDashArray: [8, 5], hasControls: false, borderColor: g.color,
      originX: 'left', originY: 'top', objectCaching: false,
    });
    rect.kind = 'group'; rect.gid = g.id; rect.layer = LAYER.group;
    const label = new fabric.Text(_withGlyph('collection', g.name), {
      left: g.x + 10, top: g.y + 8, fontSize: 12, fill: g.color,
      fontFamily: FONT, selectable: false, evented: false, objectCaching: false,
    });
    label.kind = 'grouplabel'; label.gid = g.id; label.layer = LAYER.group;
    this.canvas.add(rect); this.canvas.add(label);
    this._groupVis.set(g.id, { rect, label });
    return { rect, label };
  }

  refreshGroupVisual(gid, g) {
    const v = this._groupVis.get(gid);
    if (!v) return this.renderGroup(g);
    v.rect.set({ left: g.x, top: g.y, width: g.width, height: g.height });
    v.rect.setCoords();
    v.label.set({ left: g.x + 10, top: g.y + 8 });
    v.label.setCoords();
    return v;
  }

  removeGroup(gid) {
    const v = this._groupVis.get(gid);
    if (v) {
      if (v.rect) this.canvas.remove(v.rect);
      if (v.label) this.canvas.remove(v.label);
      this._groupVis.delete(gid);
    }
  }

  /** ลำดับซ้อนของการ์ดตามลำดับใน data (บั๊ก 65r2-1) */
  setNodeOrder(ids) {
    for (let i = 0; i < ids.length; i++) {
      const v = this._nodeVis.get(ids[i]);
      if (v) v.zIndex = i;
    }
  }

  /** จัดลำดับชั้น: เฟรม → กลุ่ม → เส้น → การ์ด (ตาม zIndex) → overlay → port */
  restack() {
    const objs = this.canvas.getObjects();
    const order = objs.slice().sort((a, b) =>
      ((a.layer || 0) - (b.layer || 0)) || ((a.zIndex || 0) - (b.zIndex || 0)));
    let changed = false;
    for (let i = 0; i < order.length; i++) if (objs[i] !== order[i]) { changed = true; break; }
    if (!changed) return;
    this.canvas._objects = order;
  }

  // ═════════════════ ซูม / เลื่อน ═════════════════
  zoom(factor, point) {
    const z = Math.max(0.05, Math.min(8, (this.canvas.getZoom() || 1) * factor));
    const c = point || { x: this.canvas.getWidth() / 2, y: this.canvas.getHeight() / 2 };
    this.canvas.zoomToPoint(new fabric.Point(c.x, c.y), z);
    this.zoomLevel = z;
    this._afterViewportChange();
    return z;
  }

  zoomToLevel(level, point) {
    const z = Math.max(0.05, Math.min(8, level));
    const c = point || { x: this.canvas.getWidth() / 2, y: this.canvas.getHeight() / 2 };
    this.canvas.zoomToPoint(new fabric.Point(c.x, c.y), z);
    this.zoomLevel = z;
    this._afterViewportChange();
    return z;
  }

  zoomFit(bounds, viewW, viewH) {
    if (!bounds) { this.resetZoom(); return 1; }
    const bw = Math.max(1, bounds.right - bounds.x), bh = Math.max(1, bounds.bottom - bounds.y);
    const z = Math.max(0.05, Math.min(2, Math.min((viewW - 80) / bw, (viewH - 80) / bh)));
    this.canvas.setViewportTransform([z, 0, 0, z,
      viewW / 2 - (bounds.x + bw / 2) * z,
      viewH / 2 - (bounds.y + bh / 2) * z]);
    this.zoomLevel = z;
    this._afterViewportChange();
    return z;
  }

  pan(dx, dy) {
    const vt = this.canvas.viewportTransform.slice();
    vt[4] += dx; vt[5] += dy;
    this.canvas.setViewportTransform(vt);
    this._afterViewportChange();
  }

  resetZoom() {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.zoomLevel = 1;
    this._afterViewportChange();
    return 1;
  }

  setViewport(x, y, zoom) {
    const z = Math.max(0.05, Math.min(8, zoom || 1));
    this.canvas.setViewportTransform([z, 0, 0, z, x || 0, y || 0]);
    this.zoomLevel = z;
    this._afterViewportChange();
  }

  getViewport() {
    const vt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    return { x: vt[4], y: vt[5], zoom: vt[0] };
  }

  getZoom() { return this.canvas.getZoom() || 1; }

  _afterViewportChange() {
    this.updateGridCss();
    if (this._portOwner) {
      const v = this._nodeVis.get(this._portOwner);
      if (v) this.showPorts(v);
    }
    if (this._handleEdgeId && this._opts.getEdge) {
      const e = this._opts.getEdge(this._handleEdgeId);
      if (e) this.showEdgeHandles(e);
    }
    if (this._opts.onViewportChange) this._opts.onViewportChange(this.getViewport());
    this.refresh();
  }

  /** จอ → พิกัดกระดาน (บั๊ก 8 : แสดงค่า x y) */
  toBoard(clientX, clientY) {
    const p = this.canvas.getPointer({ clientX, clientY }, false);
    return { x: p.x, y: p.y };
  }

  // ═════════════════ จัดการ canvas ═════════════════
  /**
   * ตั้งขนาด canvas
   * [บั๊ก 1 กระพริบ] `setWidth/setHeight` เขียน attribute width/height ของ <canvas> ซึ่ง
   * **ล้างภาพทั้งผืนทันที** — ResizeObserver ยิงถี่มากตอนลากขอบแผง เลยกลายเป็นขาว-ดำกะพริบรัว
   * แก้: ข้ามถ้าขนาดเท่าเดิม + วาดกลับทันทีในเฟรมเดียวกัน (ไม่รอ requestRenderAll)
   */
  fit(w, h) {
    // พื้น 4px ไม่ใช่ 120px — canvas ต้องยอมหดตามแผง ไม่งั้นแผงย่อไม่สุด (บั๊ก 65r5)
    const W = Math.max(4, Math.round(w)), H = Math.max(4, Math.round(h));
    // [บั๊ก 65r4] ต้องคำนวณ offset ใหม่ "เสมอ" แม้ขนาดเท่าเดิม —
    // ปิดแผงแล้วเปิดใหม่ = canvas ถูกย้ายที่ใน DOM แต่ fabric ยังจำพิกัดเดิม
    // → getPointer เพี้ยนทั้งกระดาน กรอบนำตอนลากสร้างเลยไปโผล่นอกจอ (ดูเหมือน "ไม่ขึ้น")
    this.canvas.calcOffset();
    if (this._lastW === W && this._lastH === H) return false;
    this._lastW = W; this._lastH = H;
    this.canvas.setDimensions({ width: W, height: H });
    this.canvas.calcOffset();
    this.updateGridCss();
    this.canvas.renderAll();                    // วาดทับรอยล้างทันที — ไม่ทิ้งเฟรมว่างให้เห็น
    return true;
  }

  clear() {
    this.canvas.remove(...this.canvas.getObjects()
      .filter((o) => o.kind !== 'port' && o.kind !== 'edgeend'));
    this._nodeVis.clear();
    this._groupVis.clear();
    this._edgeVis.clear();
    this._selectedEdgeId = null;
    this.hidePorts();
    this.hideEdgeHandles();
  }

  refresh() { this.canvas.requestRenderAll(); }

  dispose() {
    if (typeof window !== 'undefined') window.removeEventListener('k2-theme', this._onTheme);
    this.hidePorts();
    try { this.canvas.dispose(); } catch {}
  }

  getWidth() { return this.canvas.getWidth(); }
  getHeight() { return this.canvas.getHeight(); }
  setActiveObject(obj) { if (obj) this.canvas.setActiveObject(obj); }
  getActiveObject() { return this.canvas.getActiveObject(); }
  getActiveObjects() { return this.canvas.getActiveObjects ? this.canvas.getActiveObjects() : []; }
  discardActiveObject() { this.canvas.discardActiveObject(); }
  getObjects(kind) {
    const all = this.canvas.getObjects();
    return kind ? all.filter((o) => o.kind === kind) : all;
  }

  set selectedEdgeId(id) { this._selectedEdgeId = id; }
  get selectedEdgeId() { return this._selectedEdgeId; }

  /** จางเส้นที่ปลายทางถูกกรองออก */
  syncEdgeOpacity(edges) {
    for (const e of edges) {
      const rec = this._edgeVis.get(e.id);
      if (!rec) continue;
      const a = this._nodeVis.get(e.from.nodeId), b = this._nodeVis.get(e.to.nodeId);
      const dim = (a && b && a.opacity === 1 && b.opacity === 1) ? 1 : 0.12;
      rec.dim = dim;
      for (const o of [rec.line, rec.label, ...(rec.heads || [])]) {
        if (o) o.set('opacity', dim);
      }
    }
  }
}

// ───────── helper ─────────
/**
 * กรอบ "พิกัดจริงบนกระดาน" ของออบเจกต์
 * [บั๊ก 2+3] เดิมอ่าน vis.left/top ตรง ๆ — ใช้ไม่ได้เมื่อการ์ดอยู่ใน activeSelection
 * (ตอนนั้น left/top เป็นพิกัด **เทียบจุดกึ่งกลางของกล่องเลือก** ไม่ใช่ของกระดาน)
 * → ลากหลายใบพร้อมกันแล้วการ์ดกระเด็นมั่ว และเส้นเชื่อมไม่ตามตอนย่อ/ขยาย
 * getBoundingRect(absolute=true, calculate=true) คิด matrix ของกลุ่ม + scale ให้ครบ
 */
export function absBox(vis) {
  // ระวัง: getBoundingRect(true)/aCoords ของ fabric **ไม่รวม matrix ของกลุ่ม**
  // (คำนวณจาก left/top ของตัวเองล้วน ๆ) → ใช้กับลูกใน activeSelection ไม่ได้
  // calcTransformMatrix() ต่างหากที่คูณ matrix ของกลุ่มมาให้แล้ว
  const t = fabric.util.qrDecompose(vis.calcTransformMatrix());
  const w = (vis.width || CARD_W) * Math.abs(t.scaleX);
  const h = (vis.height || CARD_H) * Math.abs(t.scaleY);
  return { x: t.translateX - w / 2, y: t.translateY - h / 2, width: w, height: h };
}
function _boxOf(vis) { return absBox(vis); }

/** ระยะที่ต้องร่นปลายเส้นเข้ามาให้พ้นหัวลูกศรแต่ละแบบ (บั๊ก 65r2-3) */
function _headInset(kind, w) {
  if (!kind || kind === 'none') return 0;
  const s = 7 + w * 1.6;
  if (kind === 'circle') return s * 0.42;
  if (kind === 'bar') return Math.max(1, w) * 0.6;
  if (kind === 'diamond') return s * 0.56;
  if (kind === 'triangle') return s * 0.9;
  return s * 0.62;                                   // 'arrow' ปลายเปิด
}

/**
 * [alpha.150 ข้อ 2+6] วาง `<img>` ที่โหลดแล้วลงกรอบ W×H ตามวิธีวางที่เลือก
 * คืนอาร์เรย์ชิ้นส่วน fabric (ครอบด้วย clipPath เองเรียบร้อย — ไม่มีทางล้นออกนอกการ์ด)
 */
function _fitImage(im, n, W, H) {
  const iw = im.naturalWidth || im.width || 1, ih = im.naturalHeight || im.height || 1;
  const fit = n.fit || 'fit';
  const blur = Math.max(0, Math.min(30, n.blur || 0));
  const zoom = Math.max(0.1, Math.min(6, n.scale == null ? 1 : n.scale));
  const none = { max: { x: 0, y: 0 }, pos: { x: 0, y: 0 }, content: { w: W, h: H } };

  if (fit === 'tile') {
    // ปูซ้ำเต็มกรอบเสมอ — ไม่มีอะไรล้น (ขนาดลายปรับด้วย `scale`)
    const pat = new fabric.Pattern({ source: im, repeat: 'repeat' });
    if (zoom !== 1 && fabric.util && fabric.util.qrDecompose) {
      try { pat.patternTransform = [zoom, 0, 0, zoom, 0, 0]; } catch {}
    }
    return { objects: [new fabric.Rect({
      left: 0, top: 0, width: W, height: H, originX: 'left', originY: 'top',
      fill: pat, selectable: false, evented: false,
    })], ...none };
  }

  const sx = W / iw, sy = H / ih;
  let scaleX = sx, scaleY = sy;
  if (fit === 'fit') { const s2 = Math.min(sx, sy); scaleX = scaleY = s2; }
  else if (fit === 'fill') { const s2 = Math.max(sx, sy); scaleX = scaleY = s2; }
  scaleX *= zoom; scaleY *= zoom;

  // ══ [alpha.150r] รูปไม่ตัดบรรทัด — ขยายเมื่อไหร่ก็ล้นกรอบทั้งสองแกนทันที ══
  // จึงต้องรู้ว่าล้นเท่าไร แล้ว **เลื่อนดูส่วนที่เหลือได้** ไม่ใช่เฉือนทิ้งเงียบ ๆ
  const cw = iw * scaleX, ch = ih * scaleY;
  const maxX = Math.max(0, Math.round(cw - W)), maxY = Math.max(0, Math.round(ch - H));
  const px = Math.min(maxX, Math.max(0, Math.round(n.scrollX || 0)));
  const py = Math.min(maxY, Math.max(0, Math.round(n.scrollY || 0)));
  // ไม่ล้น = วางกึ่งกลางกรอบ · ล้น = ยึดมุมซ้ายบนแล้วเลื่อนตามตำแหน่งที่ผู้ใช้เลื่อนไว้
  const left = maxX > 0 ? -px : (W - cw) / 2;
  const top = maxY > 0 ? -py : (H - ch) / 2;

  const img = new fabric.Image(im, {
    left, top, originX: 'left', originY: 'top',
    scaleX, scaleY, selectable: false, evented: false, objectCaching: false,
  });
  if (blur > 0 && fabric.Image.filters && fabric.Image.filters.Blur) {
    try {
      img.filters = [new fabric.Image.filters.Blur({ blur: blur / 30 })];
      img.applyFilters();
    } catch {}
  }
  // ══ [alpha.152 ข้อ 2] ★★ clipPath อยู่ในระบบพิกัด **ก่อนสเกล** ของวัตถุ ══
  //
  // ผู้ใช้: *"รูปไม่เต็มกรอบเลย มัน crop มาเลย"*
  //
  // fabric วาด clipPath **หลัง** ใส่ transform ของวัตถุแล้ว (`transform()` → `_drawClipPath()`)
  // กรอบครอบจึงถูกคูณด้วย scaleX/scaleY ของรูปไปด้วย · รูปใหญ่ที่ถูกย่อลงมาพอดีการ์ด
  // มี scale ราว 0.1 → กรอบครอบกว้าง 200 หน่วยเหลือ 20 หน่วยจริง = เห็นรูปแค่เศษเสี้ยวตรงกลาง
  // (เทสรอบก่อนวัดแต่ "ค่าที่ตั้งไว้" จึงเขียวทั้งที่ตาเห็นว่าผิด — ตอนนี้วัดขนาดที่วาดจริง)
  //
  // → หารด้วยสเกลกลับ ทั้งขนาดและระยะเยื้อง เพื่อให้ผลลัพธ์บนจอเท่ากับกรอบที่ขอไว้เป๊ะ
  img.clipPath = new fabric.Rect({
    left: (W / 2 - (left + cw / 2)) / scaleX, top: (H / 2 - (top + ch / 2)) / scaleY,
    width: W / scaleX, height: H / scaleY, originX: 'center', originY: 'center',
  });
  return { objects: [img], max: { x: maxX, y: maxY }, pos: { x: px, y: py },
           content: { w: Math.round(cw), h: Math.round(ch) } };
}

/**
 * [alpha.151] วางรูปลง **กรอบย่อยในการ์ด** (ต่างจาก `_fitImage` ที่กินทั้งใบ)
 * ครอบด้วย clipPath เสมอ — รูปจึงไม่มีทางล้นออกไปทับส่วนอื่นของการ์ด
 */
function _fitImageInto(im, n, box) {
  const iw = im.naturalWidth || im.width || 1, ih = im.naturalHeight || im.height || 1;
  const fit = n.fit || 'fill';
  const sx = box.width / iw, sy = box.height / ih;
  let scaleX = sx, scaleY = sy;
  if (fit === 'fit') { const s = Math.min(sx, sy); scaleX = scaleY = s; }
  else if (fit !== 'full') { const s = Math.max(sx, sy); scaleX = scaleY = s; }   // fill/tile
  const cw = iw * scaleX, ch = ih * scaleY;
  const left = box.left + (box.width - cw) / 2;
  const top = box.top + (box.height - ch) / 2;
  const img = new fabric.Image(im, {
    left, top, originX: 'left', originY: 'top', scaleX, scaleY,
    selectable: false, evented: false, objectCaching: false,
  });
  // [alpha.152 ข้อ 2] หารด้วยสเกลกลับ — clipPath ถูกคูณด้วย transform ของรูป (ดู `_fitImage`)
  img.clipPath = new fabric.Rect({
    left: (box.left + box.width / 2 - (left + cw / 2)) / scaleX,
    top: (box.top + box.height / 2 - (top + ch / 2)) / scaleY,
    width: box.width / scaleX, height: box.height / scaleY,
    originX: 'center', originY: 'center',
  });
  return [img];
}

/**
 * [alpha.154 ข้อ 2] ร่นเส้นขอบของพื้นการ์ดเข้า **ในกรอบ W×H**
 *
 * fabric คิดกรอบของวัตถุที่มีเส้นขอบเป็น `width + strokeWidth` (ไม่ใช่ width) — พื้นการ์ดที่เขียนว่า
 * `left:0, width:W` จึงกินพื้นที่ 0…W+sw · กลุ่มถูกบังคับกว้าง W (`_forceBox`) และวาดผ่านแคช
 * เท่ากับ W → ส่วนเกินฝั่งขวา/ล่างถูกเฉือน = ขอบขวาหาย (ฝั่งซ้ายยังเห็นเพราะอยู่ในกรอบ)
 * Rect/Ellipse ลดขนาดตรง ๆ · รูปทรงจากจุด (Polygon/Path) ย่อด้วย scale + `strokeUniform`
 * (ความหนาเส้นไม่ถูกย่อตาม)
 */
function _strokeInside(o, W, H) {
  const sw = o && o.stroke ? Number(o.strokeWidth) || 0 : 0;
  if (!(sw > 0) || (o.left || 0) !== 0 || (o.top || 0) !== 0) return o;
  if (o.type === 'rect') o.set({ width: Math.max(1, W - sw), height: Math.max(1, H - sw) });
  else if (o.type === 'ellipse') o.set({ rx: Math.max(0.5, (W - sw) / 2), ry: Math.max(0.5, (H - sw) / 2) });
  else if (o.width > 0 && o.height > 0) {
    o.set({ strokeUniform: true, scaleX: Math.max(0.01, (W - sw) / o.width), scaleY: Math.max(0.01, (H - sw) / o.height) });
  }
  o.setCoords();
  return o;
}

/** จุดซ้ายสุด/บนสุดของลูกทั้งหมด (พิกัดการ์ด · รวมเส้นขอบ) — ให้ `_forceBox` วางกลับที่เดิมเป๊ะ */
function _kidsMin(kids) {
  let minX = Infinity, minY = Infinity;
  for (const k of kids || []) {
    if (!k || typeof k.getBoundingRect !== 'function') continue;
    const r = k.getBoundingRect(true, true);
    if (r.left < minX) minX = r.left;
    if (r.top < minY) minY = r.top;
  }
  return { minX: Number.isFinite(minX) ? minX : 0, minY: Number.isFinite(minY) ? minY : 0 };
}

function _clip(s, max) {
  s = String(s == null ? '' : s);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function _rgba(hex, a) {
  if (a >= 1) return hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

function _starPoints(W, H) {
  const pts = [];
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2, r = R * 0.42;
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r : R;
    pts.push({ x: cx + Math.cos(rad) * rr * (W / Math.min(W, H)), y: cy + Math.sin(rad) * rr * (H / Math.min(W, H)) });
  }
  return pts;
}

function _cylinderPath(W, H) {
  const e = Math.min(H * 0.16, 22);
  return `M 0 ${e} A ${W / 2} ${e} 0 0 1 ${W} ${e} L ${W} ${H - e} A ${W / 2} ${e} 0 0 1 0 ${H - e} Z`;
}

function _bubblePath(W, H) {
  const r = 10, tail = 14;
  const h = H - tail;
  return `M ${r} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} L ${W} ${h - r} Q ${W} ${h} ${W - r} ${h} ` +
         `L ${r + tail + 6} ${h} L ${r + 6} ${H} L ${r + 8} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}
