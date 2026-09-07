// planner-interact.js — Interaction Layer สำหรับ Planner v4 (โหมดเครื่องมือแบบ Miro)
//
// เครื่องมือ: select(V) · hand(H) · sticky(N) · text(T) · shape(S) · frame(F) · comment(C) · connector(L)
//            + การ์ดเนื้อเรื่อง scene/chapter/entity/note
// เพิ่มจาก v3: pan ด้วย space/ล้อกลาง/มือ · ซูมเข้าหาเคอร์เซอร์ · snap กริด · รายงานพิกัด x,y (บั๊ก 8)
//            · แก้ข้อความในที่ (overlay textarea — ProseMirror/IME ไทยใช้ได้) · เมนูคลิกขวา
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { fabric } from 'fabric';
import { log } from '../core.js';
import { absBox } from './planner-render.js';

export const TOOLS = ['select', 'hand', 'sticky', 'text', 'shape', 'frame', 'comment', 'connector',
                      'scene', 'chapter', 'entity', 'note'];
const CREATE_TOOLS = new Set(['sticky', 'text', 'shape', 'frame', 'comment', 'scene', 'chapter', 'entity', 'note']);
// [บั๊ก 5] ลากกำหนดขนาดก่อนแล้วค่อยเกิดวัตถุ — ใช้ได้กับทุกเครื่องมือ ไม่ใช่แค่รูปทรง/เฟรม
// (คลิกเปล่า ๆ ยังได้ขนาดมาตรฐานเหมือนเดิม)
const DRAG_SIZED = CREATE_TOOLS;

export class PlannerInteraction {
  constructor(renderer, data, callbacks = {}) {
    this.renderer = renderer;
    this.data = data;
    this._cb = callbacks;
    this._host = callbacks.host || null;      // div ที่ใช้วาง overlay แก้ข้อความ

    this.tool = 'select';
    this._shapeKind = 'rect';
    this._sticky = false;                     // ล็อกเครื่องมือไว้ (ไม่เด้งกลับ select)

    this._dragConnect = null;
    this._previewLine = null;
    this._panning = null;
    this._spaceDown = false;
    this._creating = null;                    // {startX,startY,ghost}
    this._movingIds = null;
    this._editor = null;

    this._onKeyDownBound = this._onKeyDown.bind(this);
    this._onKeyUpBound = this._onKeyUp.bind(this);

    this._bindPointer();
    this._bindWheel();
    this._bindObjects();
    this._bindSelection();
    this._bindDblClick();
    this._bindContextMenu();
    this.setTool('select');
  }

  // ═════════ เครื่องมือ ═════════
  setTool(name, opts = {}) {
    if (!TOOLS.includes(name)) name = 'select';
    this.tool = name;
    if (opts.shape) this._shapeKind = opts.shape;
    if ('lock' in opts) this._sticky = !!opts.lock;
    const cv = this.renderer.canvas;
    const isSelect = name === 'select';
    // [บั๊ก 65r3-2] ตอนใช้เครื่องมือวาด วัตถุเดิมต้อง "ไม่รับอีเวนต์" ด้วย
    // ไม่งั้นถ้าเริ่มลากทับการ์ด/เฟรมที่มีอยู่ fabric จะไปลากการ์ดนั้นแทน → กรอบนำไม่โผล่เลย
    const interactive = isSelect || name === 'connector';
    cv.selection = isSelect;
    cv.skipTargetFind = name === 'hand';
    cv.defaultCursor = name === 'hand' ? 'grab' : CREATE_TOOLS.has(name) ? 'crosshair'
                     : name === 'connector' ? 'crosshair' : 'default';
    cv.hoverCursor = isSelect ? 'move' : cv.defaultCursor;
    for (const [, v] of this.renderer._nodeVis) {
      const locked = v._lockedByData;
      v.set({ selectable: isSelect && !locked, evented: interactive });
    }
    for (const o of this.renderer.getObjects('group')) o.set({ evented: interactive, selectable: isSelect });
    if (name !== 'connector') this._connectFrom = null;
    this.renderer.hidePorts();
    this.renderer.refresh();
    this._log(`tool=${name}${name === 'shape' ? '/' + this._shapeKind : ''} ` +
              `selection=${cv.selection} objectsEvented=${interactive}`);
    if (this._cb.onToolChange) this._cb.onToolChange(name, this._shapeKind);
    return name;
  }

  /** log สายกระดาน — เปิด/ปิดได้ที่ this.debug
   *  [alpha.128] ลดจาก info → debug: รอบไล่บั๊กจบไปตั้งแต่ alpha.75 แต่สายนี้ยังยิง INFO รัว ๆ
   *  (298 บรรทัดต่อการรันหนึ่งรอบ) ทับเหตุการณ์จริงในแผงบันทึก · ยังเขียนลงไฟล์ครบเหมือนเดิม */
  _log(msg, extra) {
    if (this.debug === false) return;
    log('debug', 'planner: ' + msg, extra);
  }

  getTool() { return this.tool; }
  getShapeKind() { return this._shapeKind; }

  /** เรียกหลังสร้าง/รีเฟรชโหนด เพื่อให้สถานะเลือกได้/ล็อกตรงกับเครื่องมือปัจจุบัน */
  syncNodeInteractivity() { this.setTool(this.tool, { lock: this._sticky }); }

  // ═════════ เมาส์ ═════════
  _bindPointer() {
    const cv = this.renderer.canvas;

    cv.on('mouse:down', (opt) => {
      const e = opt.e;
      const t = opt.target;
      // [บั๊ก 65r2-6] แผงถูกย้าย/เปิดใหม่แล้ว fabric ยังจำ offset เดิม → พิกัดเมาส์เพี้ยนทั้งกระดาน
      // (กรอบนำตอนลากสร้างวัตถุไปโผล่คนละที่ = เหมือน "guide หายไป")
      cv.calcOffset();
      // เลื่อนกระดาน: ล้อกลาง (บั๊ก 6) / space / เครื่องมือมือ / alt+ลาก
      if (e.button === 1 || this._spaceDown || this.tool === 'hand' || e.altKey) {
        if (e.button === 1) e.preventDefault();     // กันไอคอน autoscroll ของเบราว์เซอร์
        this._startPan(e);
        return;
      }
      if (e.button === 2) return;                       // คลิกขวา = เมนู (จัดการแยก)

      if (t && t.kind === 'port') { this._startPortDrag(t, opt); return; }
      if (t && t.kind === 'edgeend') { this._startRelink(t, opt); return; }

      if (this.tool === 'connector') { this._connectorClick(t, opt); return; }

      if (CREATE_TOOLS.has(this.tool)) { this._startCreate(opt); return; }

      // โหมดเลือก — เส้นทดสอบด้วยระยะจากตัวเส้นจริง (บั๊ก 65r3-3)
      // การ์ดชนะเส้มเสมอ ยกเว้นเฟรมซึ่งอยู่ชั้นล่างกว่าเส้น
      const overFrame = t && t.kind === 'node' && t.ntype === 'frame';
      if (!t || overFrame) {
        const eid = this.renderer.hitEdgeAt(cv.getPointer(e));
        if (eid) {
          this.renderer.discardActiveObject();
          if (this._cb.onSelectEdge) this._cb.onSelectEdge(eid);
          this.renderer.refresh();
          return;
        }
      }
      if (!t) {
        // [บั๊ก 65r2-4] ต้องเก็บจุดเชื่อมก่อนเริ่มลากคลุม ไม่งั้นมันค้างบังเส้นอยู่ข้างบน
        this.renderer.hidePorts();
        this.renderer.hideEdgeHandles();
        if (this.renderer._selectedEdgeId) {
          const prev = this.renderer._selectedEdgeId;
          this.renderer._selectedEdgeId = null;
          const ed = this.data.getEdge(prev);
          if (ed) this.renderer.renderEdge(ed);
          this.renderer.refresh();
        }
        if (this._cb.onDeselect) this._cb.onDeselect();
      } else if (t.kind === 'node') {
        this.renderer.hideEdgeHandles();
      }
    });

    cv.on('mouse:move', (opt) => {
      const e = opt.e;
      if (this._panning) { this._movePan(e); return; }
      if (this._creating) { this._moveCreate(opt); return; }
      if (this._dragConnect) { this._movePortDrag(opt); return; }
      this._reportPointer(opt);
      this._hoverPorts(opt);
      this._hoverEdge(opt);
    });

    cv.on('mouse:up', (opt) => {
      if (this._panning) { this._endPan(); return; }
      if (this._creating) { this._endCreate(opt); return; }
      if (this._dragConnect) { this._endPortDrag(opt); return; }
    });

    // ลากคลุมเลือกจบแล้ว จุดเชื่อมต้องไม่ค้างอยู่บนกระดาน (บั๊ก 65r2-4)
    cv.on('selection:created', () => { this.renderer.hidePorts(); this.renderer.hideEdgeHandles(); });
    cv.on('selection:updated', () => { this.renderer.hidePorts(); this.renderer.hideEdgeHandles(); });

    cv.on('mouse:out', () => { if (this._cb.onPointer) this._cb.onPointer(null); });
  }

  _reportPointer(opt) {
    if (!this._cb.onPointer) return;
    const p = this.renderer.canvas.getPointer(opt.e);
    this._cb.onPointer({ x: Math.round(p.x), y: Math.round(p.y) });
  }

  /** เคอร์เซอร์เป็นนิ้วชี้เมื่ออยู่บนเส้นจริง ๆ (บั๊ก 65r3-3) */
  _hoverEdge(opt) {
    if (this.tool !== 'select') return;
    const t = opt.target;
    if (t && t.kind !== 'node') return;
    if (t && t.ntype !== 'frame') { if (this._edgeHover) { this._edgeHover = null; } return; }
    const eid = this.renderer.hitEdgeAt(this.renderer.canvas.getPointer(opt.e));
    if (eid !== this._edgeHover) {
      this._edgeHover = eid;
      this.renderer.canvas.setCursor(eid ? 'pointer' : this.renderer.canvas.defaultCursor);
    }
  }

  // ── โชว์ port เมื่อเมาส์อยู่เหนือการ์ด (บั๊ก 9) ──
  _hoverPorts(opt) {
    if (this.tool !== 'select' && this.tool !== 'connector') return;
    const t = opt.target;
    if (t && t.kind === 'port') return;                      // อยู่บน port อยู่แล้ว — คงไว้
    if (t && t.kind === 'node' && t.opacity >= 1 && t.ntype !== 'frame') {
      if (this.renderer.portOwner() !== t.nid) { this.renderer.showPorts(t); this.renderer.refresh(); }
      return;
    }
    // ออกนอกการ์ด — เผื่อระยะให้เอื้อมไปแตะ port ที่ยื่นออกมาได้ก่อนจะซ่อน
    if (this.renderer.portOwner()) {
      const owner = this.renderer._nodeVis.get(this.renderer.portOwner());
      if (owner) {
        const p = this.renderer.canvas.getPointer(opt.e);
        const z = this.renderer.getZoom() || 1;
        const m = 26 / z;
        const b = { x: owner.left, y: owner.top, w: owner.width * (owner.scaleX || 1), h: owner.height * (owner.scaleY || 1) };
        if (p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m) return;
      }
      this.renderer.hidePorts();
      this.renderer.refresh();
    }
  }

  // ── เลื่อนกระดาน ──
  _startPan(e) {
    this._panning = { x: e.clientX, y: e.clientY };
    const cv = this.renderer.canvas;
    this._panPrevSel = cv.selection;
    cv.selection = false;
    cv.setCursor('grabbing');
    cv.defaultCursor = 'grabbing';
  }

  _movePan(e) {
    const dx = e.clientX - this._panning.x, dy = e.clientY - this._panning.y;
    this._panning = { x: e.clientX, y: e.clientY };
    this.renderer.pan(dx, dy);
  }

  _endPan() {
    this._panning = null;
    const cv = this.renderer.canvas;
    cv.selection = this._panPrevSel !== false;
    cv.defaultCursor = this.tool === 'hand' ? 'grab' : CREATE_TOOLS.has(this.tool) ? 'crosshair' : 'default';
    if (this._cb.onViewportSettled) this._cb.onViewportSettled(this.renderer.getViewport());
  }

  // ── สร้างวัตถุใหม่ตามเครื่องมือ (บั๊ก 4) ──
  _startCreate(opt) {
    const cv = this.renderer.canvas;
    const p = cv.getPointer(opt.e);
    this._creating = { x: p.x, y: p.y, ghost: null, moved: false };
    cv.selection = false;
    this._log(`create/start tool=${this.tool} board=${_r(p.x)},${_r(p.y)}`, {
      client: [opt.e.clientX, opt.e.clientY],
      canvasOffset: cv._offset,
      rect: _rectOf(cv.upperCanvasEl),
      vt: (cv.viewportTransform || []).map(_r),
      target: opt.target ? (opt.target.kind || opt.target.type) : null,
    });
  }

  _moveCreate(opt) {
    if (!DRAG_SIZED.has(this.tool)) return;
    const p = this.renderer.canvas.getPointer(opt.e);
    const c = this._creating;
    // เกณฑ์ "ขยับพอจะถือว่าลาก" คิดเป็นพิกเซลบนจอ ไม่ใช่หน่วยกระดาน
    // (ซูมเข้ามาก ๆ แล้ว 4 หน่วยกระดาน = ลากยาวหลายสิบพิกเซลกว่ากรอบนำจะโผล่)
    const minMove = 4 / (this.renderer.getZoom() || 1);
    if (Math.abs(p.x - c.x) < minMove && Math.abs(p.y - c.y) < minMove) return;
    c.moved = true;
    const box = _rectFrom(c.x, c.y, p.x, p.y);
    if (!c.ghost) {
      this._log(ttf('ui.plannerInteract.createGuideOccurFrame', _r(box.width), _r(box.height), _r(box.x), _r(box.y)),
        { objects: this.renderer.canvas.getObjects().length, zoom: _r(this.renderer.getZoom()) });
    }
    if (!c.ghost) {
      c.ghost = new fabric.Rect({
        fill: 'rgba(217,119,87,0.12)', stroke: '#d97757', strokeWidth: 1, strokeDashArray: [5, 4],
        originX: 'left', originY: 'top', selectable: false, evented: false, objectCaching: false,
      });
      c.ghost.layer = 4;
      this.renderer.canvas.add(c.ghost);
    }
    c.ghost.set({ left: box.x, top: box.y, width: box.width, height: box.height });
    this.renderer.refresh();
  }

  _endCreate(opt) {
    const c = this._creating;
    this._creating = null;
    if (c.ghost) this.renderer.canvas.remove(c.ghost);
    const p = this.renderer.canvas.getPointer(opt.e);
    const box = c.moved ? _rectFrom(c.x, c.y, p.x, p.y) : null;
    this._log(`create/end tool=${this.tool} ${box ? tt('ui.plannerInteract.dragDefineSize') : tt('ui.plannerInteract.clickSizeDefault')}`,
      box ? { w: _r(box.width), h: _r(box.height) } : undefined);
    this.renderer.canvas.selection = this.tool === 'select';
    if (this._cb.onCreateNode) {
      this._cb.onCreateNode(this.tool, { x: c.x, y: c.y, box, shape: this._shapeKind });
    }
    if (!this._sticky) this.setTool('select');
  }

  // ── เครื่องมือเส้นเชื่อม: คลิกการ์ดต้นทาง แล้วคลิกปลายทาง ──
  _connectorClick(t, opt) {
    let node = t && t.kind === 'node' ? t : (t && t.kind === 'port' ? this.renderer._nodeVis.get(t.nid) : null);
    if (!node) {
      this._connectFrom = null;
      if (this._cb.onStatus) this._cb.onStatus(tt('ui.plannerInteract.clickCardFromDone'));
      return;
    }
    const port = t && t.kind === 'port' ? t.port : 'auto';
    if (!this._connectFrom) {
      this._connectFrom = { nid: node.nid, port };
      if (this._cb.onStatus) this._cb.onStatus(tt('ui.plannerInteract.pickCardTo'));
      return;
    }
    if (this._connectFrom.nid !== node.nid && this._cb.onConnect) {
      this._cb.onConnect(this._connectFrom.nid, this._connectFrom.port, node.nid, port);
    }
    this._connectFrom = null;
    if (!this._sticky) this.setTool('select');
  }

  // ── ลากปลายเส้นที่ต่ออยู่: ย้ายไปการ์ดอื่น หรือปล่อยที่ว่าง = ถอดปลั๊ก (บั๊ก 65r2-5) ──
  _startRelink(t, opt) {
    const e = this.data.getEdge(t.eid);
    if (!e) return;
    const cv = this.renderer.canvas;
    const anchorId = t.end === 'from' ? e.to.nodeId : e.from.nodeId;
    this._dragConnect = {
      fromNodeId: anchorId,
      fromPort: t.end === 'from' ? e.to.port : e.from.port,
      relink: { eid: e.id, end: t.end },
    };
    const p = cv.getPointer(opt.e);
    this._dragStartPt = { x: p.x, y: p.y };
    const anchor = this.renderer._nodeVis.get(anchorId);
    if (anchor) {
      const b = absBox(anchor);
      this._dragStartPt = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
    this._previewLine = null;
    this.renderer.hideEdgeHandles();
    cv.selection = false;
    this._movePortDrag(opt);
    if (this._cb.onStatus) this._cb.onStatus(tt('ui.plannerInteract.dragCardOtherMove'));
  }

  // ── ลากจาก port ──
  _startPortDrag(t, opt) {
    const cv = this.renderer.canvas;
    this._dragConnect = { fromNodeId: t.nid, fromPort: t.port };
    const p = cv.getPointer(opt.e);
    this._previewLine = new fabric.Path(`M ${p.x} ${p.y} L ${p.x} ${p.y}`, {
      stroke: '#d97757', strokeWidth: 2, strokeDashArray: [6, 4], fill: '',
      selectable: false, evented: false, objectCaching: false,
    });
    this._previewLine.layer = 4;
    cv.add(this._previewLine);
    cv.selection = false;
    this._dragStartPt = { x: p.x, y: p.y };
    if (this._cb.onStatus) this._cb.onStatus(tt('ui.plannerInteract.dragTopCardTo'));
  }

  _movePortDrag(opt) {
    const cv = this.renderer.canvas;
    const p = cv.getPointer(opt.e);
    const s = this._dragStartPt;
    if (this._previewLine) cv.remove(this._previewLine);
    this._previewLine = new fabric.Path(`M ${s.x} ${s.y} L ${p.x} ${p.y}`, {
      stroke: '#d97757', strokeWidth: 2, strokeDashArray: [6, 4], fill: '',
      selectable: false, evented: false, objectCaching: false,
    });
    this._previewLine.layer = 4;
    cv.add(this._previewLine);
    // ไฮไลต์การ์ดปลายทาง
    const t = cv.findTarget(opt.e, false);
    const hoverId = t && (t.kind === 'node' ? t.nid : t.kind === 'port' ? t.nid : null);
    if (hoverId && hoverId !== this._hoverTargetId) {
      this._hoverTargetId = hoverId;
      const v = this.renderer._nodeVis.get(hoverId);
      if (v) this.renderer.showPorts(v);
    }
    this.renderer.refresh();
  }

  _endPortDrag(opt) {
    const cv = this.renderer.canvas;
    const from = this._dragConnect;
    const t = cv.findTarget(opt.e, false) || opt.target;
    let toId = null, toPort = 'auto';
    if (t && t.kind === 'port') { toId = t.nid; toPort = t.port; }
    else if (t && t.kind === 'node') { toId = t.nid; toPort = 'auto'; }
    const relink = from && from.relink;
    this._cleanupDragConnect();
    if (relink) {
      // ย้ายปลายเส้นเดิม — ปล่อยที่ว่าง หรือปล่อยทับการ์ดอีกฝั่ง = ถอดออก
      if (toId && toId !== from.fromNodeId && this._cb.onRelinkEdge) {
        this._cb.onRelinkEdge(relink.eid, relink.end, toId, toPort);
      } else if (this._cb.onUnplugEdge) {
        this._cb.onUnplugEdge(relink.eid);
      }
      return;
    }
    if (toId && from && toId !== from.fromNodeId && this._cb.onConnect) {
      this._cb.onConnect(from.fromNodeId, from.fromPort, toId, toPort);
    } else if (from && this._cb.onStatus) {
      this._cb.onStatus(tt('ui.plannerInteract.cancelLinkMustTop'));
    }
  }

  _cleanupDragConnect() {
    if (this._previewLine) this.renderer.canvas.remove(this._previewLine);
    this._previewLine = null;
    this._dragConnect = null;
    this._hoverTargetId = null;
    this.renderer.canvas.selection = this.tool === 'select';
    this.renderer.hidePorts();
    this.renderer.refresh();
  }

  cancelDragConnect() {
    if (this._creating && this._creating.ghost) this.renderer.canvas.remove(this._creating.ghost);
    this._creating = null;
    this._connectFrom = null;
    this._cleanupDragConnect();
  }

  // ═════════ ล้อเมาส์ ═════════
  _bindWheel() {
    this.renderer.canvas.on('mouse:wheel', (opt) => {
      const e = opt.e;
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey && !e.ctrlKey) { this.renderer.pan(-e.deltaY, 0); return; }
      const factor = Math.pow(0.999, e.deltaY);
      this.renderer.zoom(factor, { x: e.offsetX, y: e.offsetY });
      if (this._cb.onViewportSettled) this._cb.onViewportSettled(this.renderer.getViewport());
    });
  }

  // ═════════ ลาก/ปรับขนาดวัตถุ ═════════
  _bindObjects() {
    const cv = this.renderer.canvas;

    cv.on('object:moving', (opt) => {
      const t = opt.target;
      if (!t) return;
      this.renderer.hidePorts();
      if (this._cb.onTransforming) this._cb.onTransforming();
      const g = this.data.getGrid();
      if (g.snap && g.size > 0) {
        t.set({ left: Math.round(t.left / g.size) * g.size, top: Math.round(t.top / g.size) * g.size });
      }
      this._syncMovingToData(t);
      this._liveEdges(t);
    });

    // [บั๊ก 3] ย่อ/ขยายการ์ดแล้วเส้นเชื่อมต้องขยับตามทันที (ทั้งใบเดียวและหลายใบ)
    cv.on('object:scaling', (opt) => {
      const t = opt.target;
      if (!t) return;
      this.renderer.hidePorts();
      if (this._cb.onTransforming) this._cb.onTransforming();
      this._liveEdges(t);
    });
    cv.on('object:resizing', (opt) => { if (opt.target) this._liveEdges(opt.target); });

    cv.on('object:modified', (opt) => {
      const t = opt.target;
      if (!t) return;
      this._commitTransform(t);
      if (this._cb.onCommit) this._cb.onCommit();
    });
  }

  /** ระหว่างลาก — อัปเดตข้อมูลพิกัดให้ตรง เพื่อคำนวณเส้นได้ */
  _syncMovingToData(t) {
    const list = t.type === 'activeSelection' ? t.getObjects() : [t];
    for (const o of list) {
      if (o.kind === 'node') {
        const n = this.data.getNode(o.nid);
        if (!n) continue;
        const pos = absBox(o);
        n.x = pos.x; n.y = pos.y;
      } else if (o.kind === 'group') {
        const g = this.data.getGroup(o.gid);
        if (!g) continue;
        const dx = t.left - g.x, dy = t.top - g.y;
        for (const id of g.childrenIds) {
          const cn = this.data.getNode(id);
          const cv2 = this.renderer._nodeVis.get(id);
          if (!cn || !cv2) continue;
          cn.x += dx; cn.y += dy;
          cv2.set({ left: cn.x, top: cn.y }); cv2.setCoords();
        }
        g.x = t.left; g.y = t.top;
        this.renderer.refreshGroupVisual(g.id, g);
      }
    }
  }

  /** วาดเส้นตามการ์ดที่ขยับ — เฉพาะเส้นที่เกี่ยวข้อง (บั๊ก 2) */
  _liveEdges(t) {
    const list = t.type === 'activeSelection' ? t.getObjects() : [t];
    const ids = [];
    for (const o of list) {
      if (o.kind === 'node') ids.push(o.nid);
      else if (o.kind === 'group') {
        const g = this.data.getGroup(o.gid);
        if (g) ids.push(...g.childrenIds);
      }
    }
    if (!ids.length) return;
    if (this._edgeRaf) return;
    this._edgeRaf = requestAnimationFrame(() => {
      this._edgeRaf = null;
      this.renderer.updateEdgesFor(this.data.edgesTouching(ids));
      this.renderer.refresh();
    });
  }

  /**
   * ปล่อยเมาส์ — เขียนค่าจริงกลับ data + แปลง scale เป็นขนาดจริง
   *
   * [บั๊ก 2] ห้ามยุ่งกับ left/top ของการ์ดที่ยังอยู่ใน activeSelection เด็ดขาด
   * ค่าพวกนั้นเป็นพิกัดเทียบกล่องเลือก — เขียนพิกัดกระดานลงไปตรง ๆ = การ์ดกระเด็นมั่วทันที
   * ที่ถูกคือ: อ่านพิกัดจริงด้วย absBox() เก็บลง data เฉย ๆ แล้วปล่อยให้ fabric จัดการต่อ
   * ถ้าต้องเปลี่ยน "ขนาด" จริง ๆ ให้ยุบกล่องเลือกก่อน แล้วค่อยสร้างใหม่ + เลือกกลับให้
   */
  _commitTransform(t) {
    const g = this.data.getGrid();
    const isMulti = t.type === 'activeSelection';
    const list = isMulti ? t.getObjects() : [t];
    const touched = [];
    const needRebuild = [];

    for (const o of list) {
      if (o.kind !== 'node') continue;
      const n = this.data.getNode(o.nid);
      if (!n) continue;
      const box = absBox(o);
      n.x = g.snap ? Math.round(box.x / g.size) * g.size : Math.round(box.x);
      n.y = g.snap ? Math.round(box.y / g.size) * g.size : Math.round(box.y);
      const newW = Math.max(16, Math.round(box.width));
      const newH = Math.max(16, Math.round(box.height));
      if (Math.abs(newW - n.width) > 0.5 || Math.abs(newH - n.height) > 0.5) {
        n.width = newW; n.height = newH;
        needRebuild.push(n.id);
      }
      touched.push(n.id);
    }

    if (needRebuild.length) {
      // ต้องสร้างชิ้นส่วนใหม่ตามขนาดจริง → ยุบกล่องเลือกก่อนแล้วเลือกกลับ
      const keep = isMulti ? list.filter((o) => o.kind === 'node').map((o) => o.nid) : null;
      this.renderer.discardActiveObject();
      for (const id of needRebuild) this.renderer.rebuildNode(this.data.getNode(id));
      for (const id of touched) if (!needRebuild.includes(id)) this.renderer.moveNode(this.data.getNode(id));
      if (keep && keep.length > 1 && this._cb.onReselect) this._cb.onReselect(keep);
      else if (keep && keep.length === 1) this.renderer.setActiveObject(this.renderer._nodeVis.get(keep[0]));
      else if (!isMulti && touched.length === 1) this.renderer.setActiveObject(this.renderer._nodeVis.get(touched[0]));
    } else if (!isMulti) {
      for (const id of touched) this.renderer.moveNode(this.data.getNode(id));
    }
    // isMulti && !needRebuild → ไม่แตะ vis เลย: fabric คืนพิกัดจริงให้เองตอนยุบกล่องเลือก

    for (const gg of this.data.getAllGroups()) if (gg.childrenIds.length) this.data.updateGroupBounds(gg.id);
    for (const [gid] of this.renderer._groupVis) {
      const gg = this.data.getGroup(gid);
      if (gg) this.renderer.refreshGroupVisual(gid, gg);
    }
    if (touched.length) this.renderer.updateEdgesFor(this.data.edgesTouching(touched));
    this.data.markDirty();
    this.renderer.refresh();
  }

  // ═════════ การเลือก ═════════
  _bindSelection() {
    const cv = this.renderer.canvas;
    const handle = (o) => {
      const sel = cv.getActiveObjects ? cv.getActiveObjects() : [];
      if (sel.length > 1) { if (this._cb.onSelectMany) this._cb.onSelectMany(sel.filter((x) => x.kind === 'node').map((x) => x.nid)); return; }
      const one = sel[0] || (o.selected && o.selected[0]);
      if (one && one.kind === 'node') {
        const n = this.data.getNode(one.nid);
        if (n && this._cb.onSelectNode) this._cb.onSelectNode(n);
      }
    };
    cv.on('selection:created', handle);
    cv.on('selection:updated', handle);
    cv.on('selection:cleared', () => {
      if (this._creating || this._panning || this._dragConnect) return;
      if (this._cb.onDeselect) this._cb.onDeselect();
    });
  }

  // ═════════ ดับเบิลคลิก = แก้ข้อความในที่ ═════════
  _bindDblClick() {
    this.renderer.canvas.on('mouse:dblclick', (opt) => {
      const t = opt.target;
      if (!t) {
        const eid = this.renderer.hitEdgeAt(this.renderer.canvas.getPointer(opt.e));
        if (eid) { if (this._cb.onEditEdgeLabel) this._cb.onEditEdgeLabel(eid); return; }
        if (this._cb.onDblClickEmpty) this._cb.onDblClickEmpty(this.renderer.canvas.getPointer(opt.e));
        return;
      }
      if (t.kind !== 'node') return;
      if (t.ntype === 'frame') {
        const eid = this.renderer.hitEdgeAt(this.renderer.canvas.getPointer(opt.e));
        if (eid && this._cb.onEditEdgeLabel) { this._cb.onEditEdgeLabel(eid); return; }
      }
      const n = this.data.getNode(t.nid);
      if (!n) return;
      // การ์ดที่ผูกไฟล์ = เปิดไฟล์, ที่เหลือ = แก้ข้อความในที่
      if (n.file && this._cb.onOpenFile) { this._cb.onOpenFile(n.file); return; }
      this.editText(n);
    });
  }

  /** overlay textarea ทับการ์ด — พิมพ์ไทยได้เต็มที่ (fabric IText มีปัญหากับ IME) */
  editText(n) {
    if (!this._host || !n) { if (this._cb.onSelectNode) this._cb.onSelectNode(n); return null; }
    this.closeEditor();
    const vis = this.renderer._nodeVis.get(n.id);
    if (!vis) return null;
    const useSynopsis = n.type === 'sticky' || n.type === 'comment';
    const zoom = this.renderer.getZoom();
    const vt = this.renderer.canvas.viewportTransform;
    const left = n.x * zoom + vt[4], top = n.y * zoom + vt[5];
    const ta = document.createElement('textarea');
    ta.className = 'planner-inline-edit';
    ta.value = useSynopsis ? (n.synopsis || '') : (n.title || '');
    ta.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(60, n.width * zoom)}px;` +
                       `height:${Math.max(28, n.height * zoom)}px;font-size:${Math.max(9, (n.fontSize || 13) * zoom)}px;` +
                       `color:${n.textColor || '#faf9f5'};`;
    this._host.appendChild(ta);
    ta.focus(); ta.select();
    const commit = (save) => {
      if (this._editor !== ta) return;
      this._editor = null;
      const val = ta.value;
      ta.remove();
      if (save && this._cb.onEditCommit) this._cb.onEditCommit(n.id, useSynopsis ? { synopsis: val } : { title: val });
    };
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(true); }
      else if (e.key === 'Enter' && !e.shiftKey && n.type === 'text') { e.preventDefault(); commit(true); }
    });
    ta.addEventListener('blur', () => commit(true));
    this._editor = ta;
    return ta;
  }

  closeEditor() {
    if (this._editor) { const t = this._editor; this._editor = null; try { t.remove(); } catch {} }
  }

  isEditing() { return !!this._editor; }

  // ═════════ คลิกขวา ═════════
  _bindContextMenu() {
    this.renderer.canvas.on('mouse:down', (opt) => {
      if (opt.e.button !== 2) return;
      opt.e.preventDefault();
      const t = opt.target;
      const p = this.renderer.canvas.getPointer(opt.e);
      if (!this._cb.onContextMenu) return;
      const eid = (!t || (t.kind === 'node' && t.ntype === 'frame')) ? this.renderer.hitEdgeAt(p) : null;
      if (eid) this._cb.onContextMenu('edge', eid, opt.e, p);
      else if (t && t.kind === 'node') this._cb.onContextMenu('node', t.nid, opt.e, p);
      else if (t && t.kind === 'group') this._cb.onContextMenu('group', t.gid, opt.e, p);
      else this._cb.onContextMenu('canvas', null, opt.e, p);
    });
  }

  // ═════════ คีย์บอร์ด ═════════
  _onKeyDown(e) {
    if (this._editor) return;                                  // กำลังพิมพ์ในการ์ด
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (this._cb.isActive && !this._cb.isActive()) return;     // แผงไม่ได้อยู่หน้า → ไม่กิน key

    if (e.code === 'Space' && !this._spaceDown) {
      this._spaceDown = true;
      this.renderer.canvas.defaultCursor = 'grab';
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') { this.cancelDragConnect(); if (this._cb.onDeselect) this._cb.onDeselect(); return; }

    const mod = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();

    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) this._cb.onRedo && this._cb.onRedo(); else this._cb.onUndo && this._cb.onUndo(); return; }
    if (mod && k === 'y') { e.preventDefault(); this._cb.onRedo && this._cb.onRedo(); return; }
    if (mod && k === 'd') { e.preventDefault(); this._cb.onDuplicate && this._cb.onDuplicate(); return; }
    if (mod && k === 'a') { e.preventDefault(); this._cb.onSelectAll && this._cb.onSelectAll(); return; }
    if (mod && k === 's') { e.preventDefault(); this._cb.onSave && this._cb.onSave(); return; }
    if (mod && k === 'g') { e.preventDefault(); this._cb.onGroup && this._cb.onGroup(); return; }
    if (mod && (k === '0')) { e.preventDefault(); this._cb.onZoomReset && this._cb.onZoomReset(); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); this.renderer.zoom(1.2); return; }
    if (mod && k === '-') { e.preventDefault(); this.renderer.zoom(1 / 1.2); return; }
    // ลำดับซ้อนทับ (บั๊ก 65r2-1) — Ctrl+] / Ctrl+[ · เติม Shift = สุดขอบ
    if (mod && e.code === 'BracketRight') {
      e.preventDefault(); this._cb.onOrder && this._cb.onOrder(e.shiftKey ? 'front' : 'forward'); return;
    }
    if (mod && e.code === 'BracketLeft') {
      e.preventDefault(); this._cb.onOrder && this._cb.onOrder(e.shiftKey ? 'back' : 'backward'); return;
    }
    if (mod) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (this.renderer._selectedEdgeId) this._cb.onDeleteEdge && this._cb.onDeleteEdge(this.renderer._selectedEdgeId);
      else this._cb.onDeleteSelected && this._cb.onDeleteSelected();
      return;
    }
    if (e.key === 'Enter') {
      const a = this.renderer.getActiveObject();
      if (a && a.kind === 'node') { e.preventDefault(); const n = this.data.getNode(a.nid); if (n) this.editText(n); }
      return;
    }
    // ลูกศร = ขยับการ์ดทีละกริด
    if (e.key.startsWith('Arrow')) {
      const a = this.renderer.getActiveObject();
      if (!a) return;
      e.preventDefault();
      const g = this.data.getGrid();
      const step = e.shiftKey ? (g.size || 20) * 5 : (g.snap ? g.size : 1);
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      a.set({ left: a.left + dx, top: a.top + dy }); a.setCoords();
      this._syncMovingToData(a);
      this._commitTransform(a);
      this._cb.onCommit && this._cb.onCommit();
      return;
    }
    // ปุ่มลัดเครื่องมือแบบ Miro (จับด้วย e.code = ปุ่มกายภาพ → ใช้ได้ทุกผังแป้นพิมพ์)
    const TOOL_KEYS = { KeyV: 'select', KeyH: 'hand', KeyN: 'sticky', KeyT: 'text', KeyS: 'shape',
                        KeyF: 'frame', KeyC: 'comment', KeyL: 'connector' };
    if (TOOL_KEYS[e.code]) { e.preventDefault(); this.setTool(TOOL_KEYS[e.code]); }
  }

  _onKeyUp(e) {
    if (e.code === 'Space') {
      this._spaceDown = false;
      this.renderer.canvas.defaultCursor = this.tool === 'hand' ? 'grab' : CREATE_TOOLS.has(this.tool) ? 'crosshair' : 'default';
    }
  }

  bindKeyboard() {
    document.addEventListener('keydown', this._onKeyDownBound);
    document.addEventListener('keyup', this._onKeyUpBound);
  }

  unbindKeyboard() {
    document.removeEventListener('keydown', this._onKeyDownBound);
    document.removeEventListener('keyup', this._onKeyUpBound);
  }

  // ═════════ ลากจาก Explorer มาวาง ═════════
  bindDrop(canvasWrap, onDrop) {
    const TYPES = ['text/k2-scene', 'text/k2-entity', 'text/k2-memo', 'text/k2-chapter'];
    const dragover = (e) => {
      if ([...e.dataTransfer.types].some((t) => TYPES.includes(t))) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
        canvasWrap.classList.add('planner-drop-on');
      }
    };
    const dragleave = () => canvasWrap.classList.remove('planner-drop-on');
    const drop = (e) => {
      canvasWrap.classList.remove('planner-drop-on');
      const kind = TYPES.find((t) => [...e.dataTransfer.types].includes(t));
      if (!kind) return;
      e.preventDefault();
      let d; try { d = JSON.parse(e.dataTransfer.getData(kind)); } catch { return; }
      if (d && onDrop) onDrop(kind, d, e);
    };
    canvasWrap.addEventListener('dragover', dragover);
    canvasWrap.addEventListener('dragleave', dragleave);
    canvasWrap.addEventListener('drop', drop);
    this._dropCleanup = () => {
      canvasWrap.removeEventListener('dragover', dragover);
      canvasWrap.removeEventListener('dragleave', dragleave);
      canvasWrap.removeEventListener('drop', drop);
    };
  }

  destroy() {
    this.closeEditor();
    this.unbindKeyboard();
    if (this._edgeRaf) cancelAnimationFrame(this._edgeRaf);
    if (this._dropCleanup) this._dropCleanup();
  }
}

// ───────── helper ─────────
function _rectFrom(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function _r(v) { return Math.round(Number(v) || 0); }
function _rectOf(elm) {
  if (!elm || !elm.getBoundingClientRect) return null;
  const r = elm.getBoundingClientRect();
  return [_r(r.left), _r(r.top), _r(r.width), _r(r.height)];
}
