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
import { T } from '../i18n.js';
import { fabric } from 'fabric';
import { visualTagFor } from '../visual-tags.js';
import {
  CARD_W, CARD_H, ICONS, STATUS_COLOR, TYPE_DEFAULTS,
  edgeGeometry, edgePathString, edgeMidpoint, edgeAngles, trimGeometry,
  sampleGeometry, distanceToPolyline,
} from './planner-data.js';

export const PORT_GAP = 20;          // ระยะที่ port ยื่นออกนอกขอบการ์ด (บั๊ก 9) — พ้นปุ่มปรับขนาดกลางขอบ
export const EDGE_HIT_TOL = 9;       // ระยะ (พิกเซลบนจอ) ที่ถือว่าคลิกโดนเส้น (บั๊ก 10 · 65r3-3)
const FONT = '"Segoe UI", "Leelawadee UI", sans-serif';

/** ลำดับชั้นการวาด — เลขน้อยอยู่ล่าง */
const LAYER = { frame: 0, group: 1, edge: 2, node: 3, overlay: 4, port: 5 };

export class PlannerRenderer {
  constructor(canvasEl, options = {}) {
    this.canvas = new fabric.Canvas(canvasEl, {
      backgroundColor: '',                       // กริดวาดด้วย CSS ใต้ canvas → พื้นต้องโปร่ง
      selection: true,
      selectionColor: 'rgba(217,119,87,0.16)',
      selectionBorderColor: '#d97757',
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
    this._nodeVis = new Map();
    this._groupVis = new Map();
    this._edgeVis = new Map();
    this._anchors = [];                          // port objects (ใช้ซ้ำ)
    this._selectedEdgeId = null;
    this._grid = { show: true, size: 20, snap: false, style: 'dots', color: '#3a3936', opacity: 0.9 };
    this._bg = options.backgroundColor || '#262624';
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
    this._bg = color || '#262624';
    this.updateGridCss();
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
    const col = g.color || '#3a3936';
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
  _forceBox(group, W, H) {
    const bw = group.width, bh = group.height;
    if (Math.abs(bw - W) < 0.01 && Math.abs(bh - H) < 0.01) return group;
    const ddx = (bw - W) / 2, ddy = (bh - H) / 2;
    for (const k of group._objects) { k.left += ddx; k.top += ddy; k.setCoords(); }
    group.set({ width: W, height: H });
    group.dirty = true;
    group.setCoords();
    return group;
  }

  renderNode(n) {
    const group = new fabric.Group(this._cardChildren(n), {
      left: n.x, top: n.y,
      originX: 'left', originY: 'top',
      hasControls: !n.locked, hasBorders: true,
      borderColor: '#d97757', borderScaleFactor: 1.6,
      cornerColor: '#d97757', cornerStrokeColor: '#1a1815',
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
    group.layer = n.type === 'frame' ? LAYER.frame : LAYER.node;
    // [บั๊ก 4] เปิดปุ่มปรับขนาดกลางขอบไว้ = ยืดด้านเดียวได้ (ไม่ล็อกสัดส่วน)
    // port ยื่นออกไป PORT_GAP px จึงไม่ทับกัน (บั๊ก 9) · ปิดเฉพาะปุ่มหมุนที่ไม่ใช้
    group.setControlsVisibility({ mtr: false });
    this._forceBox(group, n.width || CARD_W, n.height || CARD_H);
    group.set({ left: n.x, top: n.y });
    group.setCoords();
    this.canvas.add(group);
    this._nodeVis.set(n.id, group);
    return group;
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

  _cardChildren(n) {
    const W = n.width || CARD_W, H = n.height || CARD_H;
    const d = TYPE_DEFAULTS[n.type] || TYPE_DEFAULTS.scene;
    const textFill = n.textColor || d.textColor || '#faf9f5';
    const fs = n.fontSize || d.fontSize || 12.5;
    switch (n.type) {
      case 'sticky':  return this._stickyChildren(n, W, H, textFill, fs);
      case 'text':    return this._textChildren(n, W, H, textFill, fs);
      case 'shape':   return this._shapeChildren(n, W, H, textFill, fs);
      case 'frame':   return this._frameChildren(n, W, H, textFill, fs);
      case 'comment': return this._commentChildren(n, W, H, textFill, fs);
      default:        return this._recordChildren(n, W, H, textFill, fs);
    }
  }

  // ── การ์ดผูกเนื้อเรื่อง (ฉาก/บท/Wiki/โน้ต) ──
  _recordChildren(n, W, H, textFill, fs) {
    const kids = [new fabric.Rect({
      left: 0, top: 0, width: W, height: H, rx: 8, ry: 8,
      fill: n.color || '#3f3e3a', stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1,
      originX: 'left', originY: 'top',
    })];

    let titleW = W - 20;
    if (n.status) {
      const c = STATUS_COLOR[n.status] || '#6b6b6b';
      const txt = new fabric.Text(n.status, {
        left: W - 10, top: 9, fontSize: 9, fill: '#fff',
        fontFamily: FONT, originX: 'right', originY: 'top',
      });
      const pad = 6;
      kids.push(new fabric.Rect({
        left: W - 10 - (txt.width + pad * 2), top: 6, width: txt.width + pad * 2, height: 16,
        rx: 8, ry: 8, fill: c, originX: 'left', originY: 'top',
      }), txt);
      titleW = Math.max(30, W - 30 - txt.width - 12);
    }

    kids.push(new fabric.Textbox(_clip((ICONS[n.type] || '📄') + ' ' + (n.title || T`ไม่ระบุชื่อ`), 70), {
      left: 10, top: 8, width: Math.max(20, titleW), fontSize: fs, fill: textFill,
      fontFamily: FONT, originX: 'left', originY: 'top',
      editable: false, splitByGrapheme: true,
    }));

    if (n.synopsis) {
      const room = Math.max(0, H - 44 - (n.tags && n.tags.length ? 28 : 0) - (n.file ? 16 : 0));
      const lines = Math.max(1, Math.floor(room / 12));
      kids.push(new fabric.Textbox(_clip(n.synopsis, lines * 34), {
        left: 10, top: 44, width: W - 20, fontSize: Math.max(8, fs - 3), fill: 'rgba(255,255,255,0.55)',
        fontFamily: FONT, originX: 'left', originY: 'top',
        editable: false, splitByGrapheme: true, lineHeight: 1.15,
      }));
    }

    if (n.tags && n.tags.length) {
      let tx = 10;
      for (const t of n.tags.slice(0, 3)) {
        const vt = visualTagFor(t);
        const label = vt ? (vt.icon || '●') + ' ' + t : '#' + t;
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
      kids.push(new fabric.Text(_clip('📎 ' + short, 26), {
        left: 10, top: H - 16, fontSize: 9, fill: 'rgba(255,255,255,0.35)',
        fontFamily: FONT, originX: 'left', originY: 'top',
      }));
    }
    return kids;
  }

  // ── โพสต์อิต ──
  _stickyChildren(n, W, H, textFill, fs) {
    const body = n.synopsis || n.title || '';
    return [
      new fabric.Rect({
        left: 0, top: 0, width: W, height: H, rx: 2, ry: 2,
        fill: n.color || '#f2c14e', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 1,
        originX: 'left', originY: 'top',
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.35)', blur: 8, offsetX: 1, offsetY: 3 }),
      }),
      new fabric.Textbox(body || T`ดับเบิลคลิกเพื่อเขียน`, {
        left: 12, top: 12, width: W - 24, fontSize: fs, fill: textFill,
        fontFamily: FONT, originX: 'left', originY: 'top',
        editable: false, splitByGrapheme: true, lineHeight: 1.32,
        textAlign: 'left',
      }),
    ];
  }

  // ── ข้อความลอย ──
  _textChildren(n, W, H, textFill, fs) {
    return [
      new fabric.Rect({
        left: 0, top: 0, width: W, height: H,
        fill: n.color && n.color !== 'transparent' ? n.color : 'rgba(0,0,0,0.001)',
        stroke: null, originX: 'left', originY: 'top',
      }),
      new fabric.Textbox(n.title || T`ข้อความ`, {
        left: 2, top: 2, width: Math.max(20, W - 4), fontSize: fs, fill: textFill,
        fontFamily: FONT, originX: 'left', originY: 'top',
        editable: false, splitByGrapheme: true, lineHeight: 1.25,
      }),
    ];
  }

  // ── รูปทรง ──
  _shapeChildren(n, W, H, textFill, fs) {
    const fill = n.color || '#4a6fa5';
    const common = { left: 0, top: 0, originX: 'left', originY: 'top', fill, stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 };
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
      kids.push(new fabric.Textbox(n.title, {
        left: 8, top: Math.max(4, H / 2 - fs), width: Math.max(20, W - 16), fontSize: fs, fill: textFill,
        fontFamily: FONT, originX: 'left', originY: 'top', textAlign: 'center',
        editable: false, splitByGrapheme: true,
      }));
    }
    return kids;
  }

  // ── เฟรม (กรอบจัดกลุ่มพื้นที่ แบบ Miro) ──
  _frameChildren(n, W, H, textFill, fs) {
    const col = n.color || '#d97757';
    return [
      new fabric.Rect({
        left: 0, top: 0, width: W, height: H, rx: 6, ry: 6,
        fill: 'rgba(255,255,255,0.025)', stroke: col, strokeWidth: 1.5,
        originX: 'left', originY: 'top',
      }),
      new fabric.Rect({
        left: 0, top: -22, width: Math.min(W, 260), height: 20, rx: 4, ry: 4,
        fill: 'rgba(0,0,0,0.35)', stroke: null, originX: 'left', originY: 'top',
      }),
      new fabric.Text(_clip('🖼 ' + (n.title || T`เฟรม`), 34), {
        left: 6, top: -20, fontSize: Math.min(fs, 13), fill: col,
        fontFamily: FONT, originX: 'left', originY: 'top',
      }),
    ];
  }

  // ── คอมเมนต์ ──
  _commentChildren(n, W, H, textFill, fs) {
    const fill = n.color || '#e8e3d3';
    return [
      new fabric.Path(_bubblePath(W, H), {
        left: 0, top: 0, originX: 'left', originY: 'top',
        fill, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 1,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 6, offsetX: 1, offsetY: 2 }),
      }),
      new fabric.Text('💬 ' + _clip(n.title || T`คอมเมนต์`, 20), {
        left: 10, top: 8, fontSize: Math.max(9, fs - 2), fill: 'rgba(0,0,0,0.5)',
        fontFamily: FONT, originX: 'left', originY: 'top',
      }),
      new fabric.Textbox(_clip(n.synopsis || '', 220), {
        left: 10, top: 26, width: W - 20, fontSize: fs, fill: n.textColor || '#26241f',
        fontFamily: FONT, originX: 'left', originY: 'top',
        editable: false, splitByGrapheme: true, lineHeight: 1.25,
      }),
    ];
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
    const col = e.color || '#d97757';
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
        fill: sel ? '#faf9f5' : 'rgba(255,255,255,0.62)',
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
        left: 0, top: 0, radius: 6.5, fill: '#d97757', stroke: '#faf9f5', strokeWidth: 1.6,
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
        left: 0, top: 0, radius: 6, fill: '#1a1815', stroke: '#d97757', strokeWidth: 2.4,
        originX: 'center', originY: 'center', selectable: false, evented: false,
        hoverCursor: 'grab', visible: false, objectCaching: false,
      });
      h.kind = 'edgeend'; h.end = end; h.layer = LAYER.port; h.eid = null;
      this.canvas.add(h);
      this._endHandles.push(h);
    }
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
    this.restack();
    return this._endHandles;
  }

  hideEdgeHandles() {
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
    const label = new fabric.Text('🗂 ' + g.name, {
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
