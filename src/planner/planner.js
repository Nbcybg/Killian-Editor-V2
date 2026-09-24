// planner.js — Orchestrator ของ Planner v4 (กระดานวางแผนแบบ Miro)
// ประกอบ data → render → interact → ui → props เข้าด้วยกัน + จัดการไฟล์กระดาน
import { tx, txf } from '../i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { failText } from '../err-text.js';   // [alpha.162 · W5] ข้อความผิดพลาดผ่านตัวแปลงกลาง
import {
  PlannerData, CARD_W, CARD_H, uid, TYPE_DEFAULTS, snapTo,
  normTodoItems, toggleTodo, todoRowAt, IMAGE_FITS, parseTodoText, todoToText,
  IMG_SCALE_MIN, IMG_SCALE_MAX,
} from './planner-data.js';
import { PlannerRenderer } from './planner-render.js';
import { PlannerInteraction } from './planner-interact.js';
import {
  createPlannerToolbar, createPlannerFilterBar, createPlannerRail,
  createPlannerStatus, createContextBar, updatePlannerCount, TOOL_LABELS, FIT_LABELS,
  createPlannerFmtBar,
} from './planner-ui.js';
import { absBox, glyphOf } from './planner-render.js';
import { setStatus, setStatusError, el, log, formatShortcut } from '../core.js';
import { popupMenu, ask, confirmBox, choose } from '../ui.js';
import { projectImageUrl } from '../file-url.js';
import { fabric } from 'fabric';
import { isPanelFocused } from '../panels/panel-focus.js';
import { fmtDate } from '../locale.js';

/** [alpha.164 · งาน 7] แผงเตี้ยกว่านี้ (แต่ยังไม่ถึงขั้น compact) = แถบกรองไปต่อท้ายแถวแถบคำสั่ง */
export const PLANNER_INLINE_FILTER_H = 460;

const COLORS = {
  scene: '#3f3e3a', chapter: '#5f7a9f', entity: '#7a6f9f', note: '#5f8a6f',
  sticky: '#f2c14e', text: 'transparent', shape: '#4a6fa5', frame: '#d97757', comment: '#e8e3d3',
};
const NEW_TITLE = {
  scene: tt('ui.planner.sceneNew'), chapter: tt('ui.planner.chapterNew'), entity: tt('ui.planner.characterNew'), note: tt('ui.planner.noteNew'),
  sticky: '', text: tt('ui.common.text'), shape: '', frame: tt('ui.planner.frameNew'), comment: '',
};

export class PlannerBoard {
  constructor(pane, projectRoot, opts = {}) {
    this.pane = pane;
    this.root = projectRoot;
    this._onOpenFile = opts.onOpenFile || null;
    this._onDirtyCB = opts.onDirty || null;
    this._onReveal = opts.onReveal || null;
    this._svc = opts.services || {};              // pickFile / listBoards / boardsDir …
    // ชื่อที่โชว์บนหัวแผง — ไอคอนมาจากทะเบียน (icons/glyphs.csv) ไม่ฮาร์ดโค้ดอีโมจิ
    this.title = _withGlyphTitle('clipboard', 'Planner');
    /** เปิดไฟล์ที่ผูกกับการ์ด (ทางเดียวกับดับเบิลคลิก) — เปิดไว้ให้ e2e/สคริปต์เรียกได้ */
    this.onOpenFile = (f) => (this._onOpenFile ? this._onOpenFile(f) : null);

    try {
      this._init(opts.path);
    } catch (e) {
      console.error('PlannerBoard init failed', e);
      // [alpha.156] ข้อความ error อาจมีชื่อไฟล์/เนื้อ JSON ของผู้ใช้ → ห้ามลง innerHTML ดิบ (กฎข้อ 11)
      const msg = String((e && e.message) || e).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      this.pane.innerHTML = `<div style="color:#e05555;padding:20px">${tx('ui.planner.plannerOpenCant2')} ` + msg + '</div>';
    }
  }

  // ═════════════════ สร้าง DOM + ต่อสาย ═════════════════
  _init(path) {
    this.data = new PlannerData(this.root, kapi, path || null);

    // ---- โครง DOM (flex column — เลิกใช้ absolute top ฮาร์ดโค้ดที่ทำให้ canvas ทับปุ่ม: บั๊ก 1) ----
    this.toolbar = createPlannerToolbar(this._toolbarCallbacks());
    this.filterBar = createPlannerFilterBar({ onFilterChange: (f) => { this._filter = f; this._applyFilter(); } });
    this.stage = el('div', 'planner-stage');
    this.statusBar = createPlannerStatus();
    this.rail = createPlannerRail({ onTool: (t, o) => this._pickTool(t, o) });
    this.canvasEl = document.createElement('canvas');
    this.ctxBar = createContextBar(this._ctxBarCallbacks());
    // [alpha.150 ข้อ 2] ชั้นรูปพื้นหลัง — ต้องอยู่ **ก่อน** canvas ใน DOM (อยู่ใต้สุด)
    this.bgLayer = el('div', 'planner-bgimg');
    this.stage.appendChild(this.bgLayer);
    this.stage.appendChild(this.canvasEl);
    this.stage.appendChild(this.rail);
    this.stage.appendChild(this.ctxBar);
    // [alpha.151 ข้อ 3] แถบรูปแบบของกระดาน — ลอยอยู่ในเวที ลากย้ายได้ จำตำแหน่งไว้
    this.fmtBar = createPlannerFmtBar(this._fmtBarCallbacks(),
                                      () => (this._svc.getFmtbarCfg ? this._svc.getFmtbarCfg() : null));
    this.stage.appendChild(this.fmtBar);
    this._makeBarDraggable(this.fmtBar);

    this.pane.appendChild(this.toolbar);
    this.pane.appendChild(this.filterBar);
    this.pane.appendChild(this.stage);
    this.pane.appendChild(this.statusBar);

    // ---- ชั้นวาด ----
    this.renderer = new PlannerRenderer(this.canvasEl, {
      gridHost: this.stage,
      bgHost: this.bgLayer,
      // path ที่เก็บในไฟล์กระดาน (`Images/x.png`) → URL ที่เปิดได้จริงจากหน้าโปรแกรม
      imageUrl: (s) => projectImageUrl(this.root, s),
      onImageReady: () => this._rerenderImages(),
      getEdge: (id) => this.data.getEdge(id),
      onViewportChange: (vp) => { this.toolbar.setZoom(vp.zoom); this.syncContextBar(); },
    });

    // ---- ชั้นโต้ตอบ ----
    this.interaction = new PlannerInteraction(this.renderer, this.data, {
      host: this.stage,
      // [alpha.150] `offsetParent` ของ element ที่ `position:fixed` เป็น null เสมอ (บทเรียนข้อ 6)
      // — ซึ่งคือกระดานตอนเต็มจอพอดี · ถ้าใช้เกณฑ์เดิมล้วน ๆ คีย์ลัดทั้งชุดจะตายทันทีที่เข้าเต็มจอ
      // (ยกเว้นเฉพาะกรณีนี้ ไม่เปลี่ยนเกณฑ์ทั้งอัน — เกณฑ์ที่กว้างกว่าทำให้คีย์ลัดของกระดาน
      //  ทำงานตอนแผงปิดอยู่ แล้วไปกินคีย์ของเทสอื่น)
      // ══ [alpha.152 ข้อ 5] ★★ "เห็นอยู่" ไม่พอ — ต้อง "ถูกเลือกอยู่" ด้วย ══
      // คีย์เครื่องมือของกระดานเป็นตัวอักษรเปล่า ๆ (V H N T S F C L I K) ไม่มี Ctrl นำหน้า
      // เกณฑ์เดิมจึงกลืนทุกตัวอักษรที่ผู้ใช้พิมพ์ที่อื่นทั้งโปรแกรมตราบใดที่กระดานเปิดค้างไว้
      // (เต็มจอ = ไม่มีแผงอื่นให้เลือกอยู่แล้ว ถือว่าถูกเลือกเสมอ)
      isActive: () => this.pane.isConnected
                      && (this.pane.classList.contains('planner-fullscreen')
                          || (this.pane.offsetParent !== null && isPanelFocused(this.panelId || 'planner'))),
      onPointer: (p) => this.statusBar.setXY(p),
      onToolChange: (t, shape) => {
        this.rail.setActive(t);
        this.rail.setShape(shape);
        this.statusBar.setTool(TOOL_LABELS[t] || t);
      },
      onCreateNode: (tool, info) => this._createFromTool(tool, info),
      onTransforming: () => this.ctxBar && this.ctxBar.hideBar(),
      onReselect: (ids) => this._selectNodes(ids),
      onConnect: (a, ap, b, bp) => this._handleConnect(a, ap, b, bp),
      onRelinkEdge: (id, end, toId, port) => this._relinkEdge(id, end, toId, port),
      onUnplugEdge: (id) => this._deleteEdge(id),
      onOrder: (mode) => this.orderSelection(mode),
      onSelectNode: (n) => this._showProps('node', n),
      onSelectMany: (ids) => this._showProps('many', ids),
      onSelectEdge: (id) => this.selectEdge(id),
      onDeselect: () => this._showProps('none', null),
      onEditCommit: (id, props) => this._commitEdit(id, props),
      onEditEdgeLabel: (id) => this._editEdgeLabel(id),
      onDblClickEmpty: (p) => this._addNode('sticky', '', COLORS.sticky, p.x - 80, p.y - 80),
      onCommit: () => { this._snapshot(); this.syncContextBar(); },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onSave: () => this.save(),
      onGroup: () => this._createGroupFromSelection(),
      onDuplicate: () => this._duplicateSelected(),
      onSelectAll: () => this._selectAll(),
      onZoomReset: () => { this.renderer.resetZoom(); this._persistViewport(); },
      onDeleteSelected: () => this._deleteSelected(),
      onDeleteEdge: (id) => this._deleteEdge(id),
      onStatus: (m) => setStatus(m),
      onOpenFile: (f) => { if (this._onOpenFile) this._onOpenFile(f); },
      onContextMenu: (kind, id, ev, pt) => this._contextMenu(kind, id, ev, pt),
      onFullscreen: (v) => this.toggleFullscreen(v),              // [alpha.150 ข้อ 4]
      isFullscreen: () => this.pane.classList.contains('planner-fullscreen'),
      onScrollNode: (id, dy, dx) => this.scrollNode(id, dy, dx),  // [alpha.150 ข้อ 5] สองแกน
      onToggleTodo: (id, i) => this.toggleTodoItem(id, i),        // [alpha.150 ข้อ 9]
      onViewportSettled: () => this._persistViewport(),
    });
    this.interaction.bindDrop(this.stage, (kind, d, ev) => this.dropPayload(kind, d, ev));
    this.interaction.bindKeyboard();

    // ---- สถานะภายใน ----
    this._history = [];
    this._histIndex = -1;
    this._maxHistory = 60;
    this._restoring = false;
    this._filter = { text: '', type: '', status: '' };
    this._propsCallback = null;
    this._selectedNodeId = null;

    // [บั๊ก 1] ResizeObserver ยิงหลายสิบครั้งต่อวินาทีตอนลากขอบแผง — รวบให้เหลือเฟรมละครั้ง
    this._resizeObserver = new ResizeObserver(() => {
      if (this._fitRaf) return;
      this._fitRaf = requestAnimationFrame(() => { this._fitRaf = null; this._fit(); });
    });
    this._resizeObserver.observe(this.pane);
    // [alpha.151 ข้อ 8] เฝ้า "เวที" ด้วย ไม่ใช่แค่แผง — _fit วัดขนาดจากเวที แต่เดิมเฝ้าแค่แผง
    // เวทีที่ยังกว้าง 0 อยู่ทั้งที่แผงมีขนาดแล้ว (แถบบนยังจัดวางไม่เสร็จ) จึงไม่มีใครปลุก _fit ซ้ำ
    this._resizeObserver.observe(this.stage);
    this._autoSaveTimer = setInterval(() => { if (this.data.isDirty()) this.save(true); }, 60000);

    this._ready = this._load().then(() => { this._snapshot(true); this._fit(); });
  }

  /**
   * [alpha.151 ข้อ 3] ตัวจัดการปุ่มบนแถบของกระดาน
   * ทุกตัวเป็น "คำสั่งของกระดาน" ตรง ๆ — ไม่ผ่าน handleCommand เพราะไม่ใช่คำสั่งระดับโปรแกรม
   */
  _fmtBarCallbacks() {
    return {
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onAlignH: (d) => this.alignText('h', d),
      onAlignV: (d) => this.alignText('v', d),
      onFont: (d) => this.bumpFontSize(d),
      onColor: (kind, btn) => this._pickNodeColor(kind, btn),
      onImage: () => this.insertImage(),
      onNew: (type) => {
        const p = this._centerPoint();
        const n = this._createFromTool(type, { x: p.x, y: p.y, quiet: true });
        if (type === 'todo') this.editTodo(n);
        return n;
      },
      onTool: (t2) => this._pickTool(t2),
      onOrder: (m) => this.orderSelection(m),
      onLock: () => {
        const ids = this._selectedNodeIds();
        if (!ids.length) { setStatus(tt('ui.planner.alignPickFirst')); return; }
        const lock = !this.data.isLocked(ids[0]);
        for (const id of ids) this._commitEdit(id, { locked: lock });
      },
      onDuplicate: () => this._duplicateSelected(),
      onDelete: () => this._deleteSelected(),
      onGrid: () => this.setGrid({ show: !this.data.getGrid().show }),
      onSnap: () => this.setGrid({ snap: !this.data.getGrid().snap }),
      onFit: () => this._zoomFit(),
      onFullscreen: () => this.toggleFullscreen(),
    };
  }

  /** เปิดป๊อปอัปเลือกสีให้ช่องใดช่องหนึ่งของการ์ดที่เลือก */
  _pickNodeColor(kind, anchor) {
    const ids = this._selectedNodeIds();
    if (!ids.length) { setStatus(tt('ui.planner.alignPickFirst')); return null; }
    const key = kind === 'text' ? 'textColor' : kind === 'border' ? 'borderColor' : 'color';
    const cur = (this.data.getNode(ids[0]) || {})[key] || '';
    if (!this._svc.pickColor) {
      // ไม่มีป๊อปอัปให้ใช้ (เช่นในเทส) — ใช้ช่องสีของระบบแทน ไม่ปล่อยให้ปุ่มตาย
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#3f3e3a';
      inp.oninput = () => { for (const id of ids) this._commitEdit(id, { [key]: inp.value }); };
      inp.click();
      return inp;
    }
    return this._svc.pickColor(anchor, cur, (hex) => {
      for (const id of ids) this._commitEdit(id, { [key]: hex });
    });
  }

  /** ลากย้ายแถบในเวทีกระดาน + จำตำแหน่ง (ต่อแผง ไม่ต่อกระดาน — เป็นเรื่องของหน้าจอ) */
  _makeBarDraggable(bar) {
    const KEY = 'k2-planner-fmtbar';
    const grip = bar.querySelector('.k-fmtbar-grip');
    const place = (x, y) => {
      const host = this.stage.getBoundingClientRect();
      const w = bar.offsetWidth || 300, h = bar.offsetHeight || 34;
      bar.style.left = Math.round(Math.max(4, Math.min(host.width - w - 4, x))) + 'px';
      bar.style.top = Math.round(Math.max(4, Math.min(host.height - h - 4, y))) + 'px';
    };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    // ค่าเริ่มต้น: ขอบบน กึ่งกลาง — ไม่ทับรางเครื่องมือที่อยู่ซ้ายมือ
    setTimeout(() => {
      const host = this.stage.getBoundingClientRect();
      if (saved && Number.isFinite(saved.left)) place(saved.left, saved.top);
      else place((host.width - (bar.offsetWidth || 300)) / 2, 8);
    }, 0);
    if (!grip) return bar;
    grip.onmousedown = (e) => {
      e.preventDefault();
      const host = this.stage.getBoundingClientRect();
      const dx = e.clientX - (host.left + parseInt(bar.style.left, 10) || 0);
      const dy = e.clientY - (host.top + parseInt(bar.style.top, 10) || 0);
      bar.classList.add('k-dragging');
      const move = (ev) => place(ev.clientX - host.left - dx, ev.clientY - host.top - dy);
      const up = () => {
        bar.classList.remove('k-dragging');
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        try {
          localStorage.setItem(KEY, JSON.stringify({ left: parseInt(bar.style.left, 10),
                                                     top: parseInt(bar.style.top, 10) }));
        } catch {}
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
    return bar;
  }

  /** อัปเดตสถานะปุ่มบนแถบของกระดาน (ติดไฟ/สีเทา) */
  syncFmtBar() {
    if (!this.fmtBar) return null;
    const ids = this._selectedNodeIds();
    const g = this.data.getGrid();
    this.fmtBar.applyConfig();
    this.fmtBar.syncState({
      hasSelection: ids.length > 0,
      align: this.currentTextAlign('h'),
      valign: this.currentTextAlign('v'),
      grid: g.show, snap: g.snap,
      locked: ids.length > 0 && ids.every((id) => this.data.isLocked(id)),
      fullscreen: this.pane.classList.contains('planner-fullscreen'),
    });
    return this.fmtBar;
  }

  _ctxBarCallbacks() {
    return {
      onNodeChange: (props) => {
        const ids = this._selectedNodeIds();
        if (!ids.length) return;
        for (const id of ids) this.data.updateNode(id, props);
        for (const id of ids) {
          const n = this.data.getNode(id);
          if (!n) continue;
          const v = this.renderer.rebuildNode(n);
          if (v) v._lockedByData = !!n.locked;
        }
        this.interaction.syncNodeInteractivity();
        this.renderer.updateEdgesFor(this.data.edgesTouching(ids));
        this.renderer.refresh();
        this._snapshot();
        if (ids.length === 1) { this._selectNodes(ids); this._showProps('node', this.data.getNode(ids[0])); }
        else this.syncContextBar();
      },
      onEdgeChange: (props) => {
        const id = this.renderer._selectedEdgeId;
        if (id) this._changeEdge(id, props);
      },
      onFlip: () => { if (this.renderer._selectedEdgeId) this._flipEdge(this.renderer._selectedEdgeId); },
      onOrder: (mode) => this.orderSelection(mode),
      onDuplicate: () => this._duplicateSelected(),
      onDelete: () => this._deleteSelected(),
      onDeleteEdge: () => { if (this.renderer._selectedEdgeId) this._deleteEdge(this.renderer._selectedEdgeId); },
      onMore: () => {
        const id = this.renderer._selectedEdgeId;
        if (id) this._showProps('edge', this.data.getEdge(id));
        else {
          const ids = this._selectedNodeIds();
          if (ids.length === 1) this._showProps('node', this.data.getNode(ids[0]));
          else if (ids.length > 1) this._showProps('many', ids);
        }
      },
    };
  }

  /** วางแถบคุณสมบัติลอยให้ตรงกับสิ่งที่เลือกอยู่ (เรียกซ้ำได้ตลอด) */
  syncContextBar() {
    if (!this.ctxBar) return null;
    const eid = this.renderer._selectedEdgeId;
    if (eid) {
      const e = this.data.getEdge(eid);
      const rec = this.renderer._edgeVis.get(eid);
      if (!e || !rec) { this.ctxBar.hideBar(); return null; }
      const r = rec.line.getBoundingRect();
      return this.ctxBar.showFor('edge', e, { x: r.left, y: r.top, width: r.width, height: r.height });
    }
    const act = this.renderer.getActiveObject();
    if (!act) { this.ctxBar.hideBar(); return null; }
    const ids = this._selectedNodeIds();
    if (!ids.length) { this.ctxBar.hideBar(); return null; }
    const n = this.data.getNode(ids[0]);
    if (!n) { this.ctxBar.hideBar(); return null; }
    const r = act.getBoundingRect();
    return this.ctxBar.showFor('node', n, { x: r.left, y: r.top, width: r.width, height: r.height });
  }

  _toolbarCallbacks() {
    return {
      onNew: () => this.newBoard(),
      onOpen: () => this.openBoardDialog(),
      onSave: () => this.save(),
      onSaveAs: () => this.saveAs(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onGroup: () => this._createGroupFromSelection(),
      onDuplicate: () => this._duplicateSelected(),
      onReveal: () => this._revealSelected(),
      onDelete: () => this._deleteSelected(),
      onAutoLayout: () => this._autoLayout(),
      onZoomIn: () => { this.renderer.zoom(1.2); this._persistViewport(); },
      onZoomOut: () => { this.renderer.zoom(1 / 1.2); this._persistViewport(); },
      onZoomReset: () => { this.renderer.resetZoom(); this._persistViewport(); },
      onZoomFit: () => this._zoomFit(),
      onExportPng: () => this.exportPNG(),
      onExportJson: () => this.exportJSON(),                    // [alpha.150 ข้อ 10]
      onFullscreen: () => this.toggleFullscreen(),              // [alpha.150 ข้อ 4]
      onSample: () => this.loadSample(),
      getGrid: () => this.data.getGrid(),
      getBackground: () => this.data.getSettings().background,
      getBackgroundImage: () => this.data.getBackgroundImage(), // [alpha.150 ข้อ 2]
      onGridChange: (p) => this.setGrid(p),
      onBackgroundChange: (c) => { this.data.setBackground(c); this.renderer.setBackground(c); this._markDirty(); },
      onBackgroundImageChange: (p) => this.setBoardBackground(p),
      onPickBackgroundImage: () => this.pickBoardBackground(),
      onBackgroundDialog: () => this._boardBackgroundDialog(),
    };
  }

  // ═════════════════ [alpha.150] รูป · เต็มจอ · ส่งออก JSON ═════════════════

  /** รูปโหลดเสร็จทีหลัง → วาดโหนดที่ใช้รูปใหม่รอบเดียว (รวบด้วย rAF กันรัวตอนโหลดหลายใบพร้อมกัน) */
  _rerenderImages() {
    if (this._imgRaf) return;
    this._imgRaf = requestAnimationFrame(() => {
      this._imgRaf = null;
      for (const n of this.data.getAllNodes()) if (n.src) this.renderer.rebuildNode(n);
      this.renderer.restack();
      this.renderer.refresh();
    });
  }

  /** ข้อ 4 — ดูกระดานเต็มจอ (กด Esc หรือกดปุ่มซ้ำเพื่อออก) */
  toggleFullscreen(on) {
    const v = on === undefined ? !this.pane.classList.contains('planner-fullscreen') : !!on;
    this.pane.classList.toggle('planner-fullscreen', v);
    document.body.classList.toggle('planner-fullscreen-on', v);
    if (this.toolbar.setFullscreen) this.toolbar.setFullscreen(v);
    // ขนาดพื้นที่เปลี่ยนทั้งผืน — ต้องวัดใหม่ ไม่งั้น `canvas._offset` ค้าง (บทเรียนข้อ 24)
    requestAnimationFrame(() => this._fit());
    setStatus(tt(v ? 'ui.planner.fullOn' : 'ui.planner.fullOff'));
    return v;
  }

  /** ข้อ 10 — ส่งออกกระดานเป็นไฟล์ JSON (เลือกที่เก็บเอง) */
  async exportJSON() {
    try {
      const def = _safeName(this.data.getFileBase()) + '.json';
      const target = await kapi.saveAsDialog(def, 'json');
      if (!target) return null;
      await kapi.writeFile(target, JSON.stringify(this.data.toJSON(), null, 2));
      setStatus(ttf('ui.planner.exportJsonDone', target));
      log('info', ttf('ui.planner.exportJsonDone', target), this.data.countStats());
      return target;
    } catch (e) {
      setStatusError(failText(tt('ui.planner.exportJsonFail'), e));
      return null;
    }
  }

  /** ข้อ 2 — ตั้งรูปพื้นหลังกระดาน (เลือกรูป · วิธีวาง · เบลอ · ความจาง) */
  async pickBoardBackground() {
    if (!this._svc.pickImage) { setStatus(tt('ui.planner.pickImageNot')); return null; }
    const picked = await this._svc.pickImage();
    if (!picked || !picked.file) return null;
    const bg = this.data.setBackgroundImage({ src: 'Images/' + picked.file });
    this.renderer.setBackgroundImage(bg);
    this._markDirty();
    return bg;
  }

  setBoardBackground(props) {
    const bg = this.data.setBackgroundImage(props);
    this.renderer.setBackgroundImage(bg);
    this._markDirty();
    return bg;
  }

  /**
   * ข้อ 2 — กล่อง "พื้นกระดาน": สี · รูป · วิธีวาง · เบลอ · ความจาง
   * ทุกช่องมีผลทันทีที่ขยับ (ไม่ต้องกดตกลง) — ผู้ใช้เห็นผลตอนเลือก ไม่ต้องเดา
   */
  _boardBackgroundDialog() {
    document.querySelectorAll('.planner-bg-dialog').forEach((d) => d.closest('.k-overlay')?.remove());
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog planner-bg-dialog');
    const bg = this.data.getBackgroundImage();
    box.innerHTML = ((a) => `<div class="k-dlg-title">${tx('ui.planner.bgBoard')}</div>
<div class="planner-bg-rows">
  <label><span>${tx('ui.planner.colorBg')}</span><input type="color" id="plbg-color" value="${a[0]}"></label>
  <label><span>${tx('ui.planner.imageBg')}</span><span class="planner-bg-name" id="plbg-name">${a[4]}</span></label>
  <div class="planner-bg-btns"><button id="plbg-pick">${tx('ui.planner.imgPick')}</button><button id="plbg-clear">${tx('ui.vis.clearImage')}</button></div>
  <label><span>${tx('ui.planner.howPaste')}</span><select id="plbg-fit">${a[1]}</select></label>
  <label><span>${tx('ui.planner.blur')}</span><input type="range" id="plbg-blur" min="0" max="30" step="1" value="${a[2]}"></label>
  <label><span>${tx('ui.fmtbar.menuOpacity')}</span><input type="range" id="plbg-op" min="0" max="1" step="0.05" value="${a[3]}"></label>
</div>
<div class="k-dlg-btns"><button class="k-ok" id="plbg-close">${tx('ui.planner.doneDone')}</button></div>`)([this.data.getSettings().background || '#262624', IMAGE_FITS.map((f) => `<option value="${f}"${bg.fit === f ? ' selected' : ''}>${FIT_LABELS[f] || f}</option>`).join(''), bg.blur, bg.opacity, bg.src ? _fileLabel(bg.src) : tt('ui.planner.bgNone')]);
    ov.append(box);
    document.body.append(ov);
    const q = (s) => box.querySelector(s);
    const close = () => ov.remove();
    q('#plbg-color').oninput = (e) => {
      this.data.setBackground(e.target.value); this.renderer.setBackground(e.target.value); this._markDirty();
    };
    q('#plbg-pick').onclick = async () => {
      const v = await this.pickBoardBackground();
      if (v) q('#plbg-name').textContent = _fileLabel(v.src);
    };
    q('#plbg-clear').onclick = () => {
      this.setBoardBackground({ src: '' }); q('#plbg-name').textContent = tt('ui.planner.bgNone');
    };
    q('#plbg-fit').onchange = (e) => this.setBoardBackground({ fit: e.target.value });
    q('#plbg-blur').oninput = (e) => this.setBoardBackground({ blur: parseFloat(e.target.value) });
    q('#plbg-op').oninput = (e) => this.setBoardBackground({ opacity: parseFloat(e.target.value) });
    q('#plbg-close').onclick = close;
    ov.onclick = (e) => { if (e.target === ov) close(); };
    return box;
  }

  /** ข้อ 6 — แทรกรูปเป็นการ์ดบนกระดาน */
  async insertImageNode(x, y) {
    if (!this._svc.pickImage) { setStatus(tt('ui.planner.pickImageNot')); return null; }
    const picked = await this._svc.pickImage();
    if (!picked || !picked.file) return null;
    const n = this._createFromTool('image', { quiet: true,
                                              x: x == null ? this._centerPoint().x : x,
                                              y: y == null ? this._centerPoint().y : y });
    this._commitEdit(n.id, { src: 'Images/' + picked.file, title: picked.name || picked.caption || '' });
    return n;
  }

  _centerPoint() {
    return {
      x: (this.renderer.getWidth() / 2 - this.renderer.getViewport().x) / this.renderer.getZoom(),
      y: (this.renderer.getHeight() / 2 - this.renderer.getViewport().y) / this.renderer.getZoom(),
    };
  }

  /** ข้อ 9 — แก้รายการสิ่งที่ต้องทำ (ทีละบรรทัด · `- [x] ` = ติ๊กแล้ว) */
  async editTodo(n) {
    const v = await ask(tt('ui.planner.todoEditHint'),
                        { value: todoToText(n.items), multiline: true, allowEmpty: true });
    if (v == null) return null;
    const items = parseTodoText(v);
    this._commitEdit(n.id, { items });
    return items;
  }

  /** ติ๊ก/ปลดติ๊กข้อหนึ่ง (คลิกบนการ์ด) */
  toggleTodoItem(nodeId, index) {
    const n = this.data.getNode(nodeId);
    if (!n || n.type !== 'todo') return false;
    this._commitEdit(nodeId, { items: toggleTodo(n.items, index) });
    return true;
  }

  /**
   * ══ [alpha.151 ข้อ 2] ★ จัดวาง "ตัวหนังสือในการ์ด" ไม่ใช่ขยับการ์ด ══
   *
   * ผู้ใช้: *"คือ planner ตัว card เวลาเราใส่ตัวหนังสือมันจะอยู่ตรงกลาง card อย่างเดียวไง
   *          เราอยากได้แบบ บาง card ตัวหนังสืออยู่ขอบบนซ้าย บางครั้งกลางกลาง — ไม่ใช่ขยับ card"*
   *
   * รอบ .150 ผมตีความเป็น "จัดตำแหน่งการ์ดบนกระดาน" ซึ่งผิดคนละเรื่อง
   * @param {'h'|'v'} axis  แกน · @param {string} dir left/center/right หรือ top/middle/bottom
   */
  alignText(axis, dir) {
    if (this._boardLockBlocked()) return false;
    const ids =this._selectedNodeIds().filter((id) => !this.data.isLocked(id));
    if (!ids.length) { setStatus(tt('ui.planner.alignPickFirst')); return false; }
    const key = axis === 'v' ? 'textVAlign' : 'textAlign';
    for (const id of ids) this.data.updateNode(id, { [key]: dir });
    for (const id of ids) this.renderer.rebuildNode(this.data.getNode(id));
    this.interaction.syncNodeInteractivity();
    if (ids.length > 1) this._selectNodes(ids);
    else this.renderer.setActiveObject(this.renderer._nodeVis.get(ids[0]));
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    this.syncContextBar();
    setStatus(tt('ui.planner.alignTextDone'));
    return true;
  }

  /** ค่าการจัดวางของสิ่งที่เลือกอยู่ (ปนกัน = '') — ใช้ติดไฟปุ่มบนแถบ */
  currentTextAlign(axis) {
    const key = axis === 'v' ? 'textVAlign' : 'textAlign';
    const vals = new Set(this._selectedNodeIds().map((id) => (this.data.getNode(id) || {})[key]));
    return vals.size === 1 ? [...vals][0] : '';
  }

  /**
   * [alpha.151 ข้อ 4] แทรกรูป **ลงในการ์ดที่เลือก** — ไม่มีการ์ดที่เลือก = สร้างการ์ดรูปใบใหม่
   * (ของเดิมมีแต่ทางหลัง ผู้ใช้จึงรายงานว่า "ใน card ยังแทรกรูปไม่ได้")
   */
  async insertImage() {
    const ids = this._selectedNodeIds();
    if (!ids.length) return this.insertImageNode();
    if (!this._svc.pickImage) { setStatus(tt('ui.planner.pickImageNot')); return null; }
    const picked = await this._svc.pickImage();
    if (!picked || !picked.file) return null;
    for (const id of ids) this._commitEdit(id, { src: 'Images/' + picked.file });
    setStatus(ttf('ui.planner.imgInCardDone', ids.length));
    return picked;
  }

  /** เอารูปออกจากการ์ดที่เลือก */
  clearImage() {
    const ids = this._selectedNodeIds();
    if (!ids.length) return false;
    for (const id of ids) this._commitEdit(id, { src: '' });
    return true;
  }

  /** ขนาดตัวอักษรของการ์ดที่เลือก (`delta` = บวก/ลบจากค่าเดิม) */
  bumpFontSize(delta) {
    const ids = this._selectedNodeIds();
    if (!ids.length) { setStatus(tt('ui.planner.alignPickFirst')); return false; }
    for (const id of ids) {
      const n = this.data.getNode(id);
      if (n) this.data.updateNode(id, { fontSize: (n.fontSize || 12) + delta });
    }
    for (const id of ids) this.renderer.rebuildNode(this.data.getNode(id));
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    return true;
  }

  /** ข้อ 5 — หมุนล้อบนการ์ดที่เนื้อหาล้น = เลื่อนเนื้อหาในการ์ด (ไม่ใช่ซูมกระดาน) */
  scrollNode(nodeId, dy, dx) {
    const n = this.data.getNode(nodeId);
    const vis = this.renderer._nodeVis.get(nodeId);
    if (!n || !vis) return false;
    const maxY = vis.scrollMax || 0, maxX = vis.scrollMaxX || 0;
    const nextY = Math.max(0, Math.min(maxY, (n.scrollY || 0) + (dy || 0)));
    const nextX = Math.max(0, Math.min(maxX, (n.scrollX || 0) + (dx || 0)));
    if (nextY === (n.scrollY || 0) && nextX === (n.scrollX || 0)) return false;
    this.data.updateNode(nodeId, { scrollY: nextY, scrollX: nextX });
    this.renderer.rebuildNode(this.data.getNode(nodeId));
    this.renderer.restack();
    this.renderer.refresh();
    return true;
  }

  /**
   * [alpha.150r] ย่อ/ขยายรูปที่แทรก — ผู้ใช้: *"insert ภาพต้องปรับขนาดได้นะ"*
   * `mode` = 'set' ตั้งค่าตรง ๆ · 'mul' คูณจากค่าเดิม (ปุ่ม + / −)
   * ย่อลงจนไม่ล้นแล้ว ตำแหน่งเลื่อนต้องกลับมาที่ 0 เอง ไม่งั้นรูปค้างอยู่นอกกรอบ
   */
  setImageScale(nodeId, v, mode) {
    const n = this.data.getNode(nodeId);
    if (!n || n.type !== 'image') return false;
    const cur = n.scale == null ? 1 : n.scale;
    const next = Math.max(IMG_SCALE_MIN, Math.min(IMG_SCALE_MAX, mode === 'mul' ? cur * v : v));
    this._commitEdit(nodeId, { scale: next, scrollX: 0, scrollY: 0 });
    setStatus(ttf('ui.planner.imgScaleSet', Math.round(next * 100)));
    return next;
  }

  // ══ [alpha.155] ล็อกทั้งกระดาน (เมนูคลิกขวาใน Explorer) ══
  // กระดานที่ล็อก = เลื่อน/ซูมดูได้ แต่สร้าง/แก้/ลบ/ย้อนกลับไม่ได้ · ค่าล็อกเก็บที่ Explorer (project.khn.json)
  // ไม่ใช่ในไฟล์กระดาน — ตรวจที่ทางเข้าของทุกการแก้ (_addNode · _commitEdit · _deleteSelected · …)
  setBoardLocked(v) {
    this._boardLocked = !!v;
    if (this.interaction) {
      this.interaction._boardLocked = this._boardLocked;
      this.interaction.setTool(this._boardLocked ? 'hand' : 'select');
    }
    return this._boardLocked;
  }
  isBoardLocked() { return !!this._boardLocked; }
  _boardLockBlocked() {
    if (!this._boardLocked) return false;
    setStatus(tt('ui.treeAct.boardLocked'));
    return true;
  }
  async _applyBoardLock() {
    let v = false;
    try { if (this._svc.isBoardLocked) v = !!(await this._svc.isBoardLocked(this.data.getPath())); } catch { v = false; }
    this.setBoardLocked(v);
  }

  // ═════════════════ โหลด / บันทึก / ไฟล์กระดาน (บั๊ก 5) ═════════════════
  async _load() {
    await this.data.load();
    this._applyBoardLock().catch(() => {});
    this.renderer.setGrid(this.data.getGrid());
    this.renderer.setBackground(this.data.getSettings().background);
    this.renderer.setBackgroundImage(this.data.getBackgroundImage());
    const vp = this.data.getViewport();
    if (vp.zoom !== 1 || vp.x || vp.y) this.renderer.setViewport(vp.x, vp.y, vp.zoom);
    this._renderAll();
    this.toolbar.setBoardName(this.data.getName());
    this.toolbar.setZoom(this.renderer.getZoom());
    this.statusBar.setGridInfo(this.data.getGrid());
    this._syncDirty();
    log('info', ttf('ui.planner.plannerLoadBoard', this.data.getName()), {
      path: this.data.getPath(), ...this.data.countStats(),
      grid: this.data.getGrid(), viewport: this.data.getViewport(),
    });
    this._act('board loaded', { board: this.data.getName(), path: this.data.getPath(),
                                ...this.data.countStats() });
    return true;
  }

  async save(silent) {
    this._persistViewport(true);
    const wasNew = !(await kapi.exists(await this.data._defaultPath()).catch(() => true));
    // [alpha.153 ข้อ 4] เดิมถ้า `data.save()` โยน error ออกมา ทั้งก้อนตายเงียบ — ไม่มีทั้งข้อความ
    // บนแถบสถานะและบรรทัดในบันทึก ผู้ใช้เห็นแค่ "จุดงานค้าง" ไม่หายไปเฉย ๆ
    let ok = false;
    try {
      ok = await this.data.save();
    } catch (e) {
      this._fail('save threw', e, { board: this.data.getName(), path: this.data.getPath() });
      this._syncDirty();
      setStatus(tt('ui.planner.saveBoardNotOk'));
      return false;
    }
    if (!ok) this._fail('save returned false', null, { board: this.data.getName(), path: this.data.getPath() });
    this._syncDirty();
    log('info', ttf('ui.planner.plannerSave', this.data.getName(), ok ? tt('ui.common.ok') : tt('ui.common.fail')) +
        (wasNew ? tt('ui.planner.fileNewRefreshExplorer') : ''), { path: this.data.getPath() });
    if (ok && wasNew && this._svc.onBoardsChanged) this._svc.onBoardsChanged();
    if (ok && !silent) setStatus(ttf('ui.planner.saveBoard2F', this.data.getName()));
    else if (!ok) setStatus(tt('ui.planner.saveBoardNotOk'));
    return ok;
  }

  async boardsDir() {
    return kapi.join(this.root, 'Planners');
  }

  /**
   * ถามชื่อกระดาน + กันชื่อซ้ำ (บั๊ก 65r2-7)
   * เดิมชื่อซ้ำแล้วขึ้นแค่ข้อความบนแถบสถานะ ผู้ใช้ไม่ทันเห็นว่ากระดานไม่ถูกสร้าง
   */
  async _askBoardName(title, initial, okLabel) {
    const dir = await this.boardsDir();
    let value = initial;
    for (;;) {
      const name = await ask(title, { value, okLabel: okLabel || tt('ui.common.new') });
      if (!name) return null;
      const safe = _safeName(name);
      const p = await kapi.join(dir, safe + '.json');
      if (!(await kapi.exists(p))) return { name: safe, path: p, overwrite: false };
      const act = await choose(ttf('ui.common.hasBoardNameProject', safe), [
        { label: tt('ui.common.renameNew'), value: 'again', primary: true },
        { label: tt('ui.common.overwritePrev'), value: 'over', danger: true },
        { label: tt('ui.common.cancel'), value: null }]);
      if (act === 'over') return { name: safe, path: p, overwrite: true };
      if (!act) return null;
      value = safe + ' 2';
    }
  }

  /** สร้างกระดานใหม่ — ถามชื่อ แล้วเปิดกระดานเปล่า (บั๊ก 5) */
  async newBoard() {
    if (!(await this.confirmDiscard(tt('ui.common.newBoardNew')))) return null;
    const picked = await this._askBoardName(tt('ui.common.nameBoardNew'),
      tt('ui.common.board2') + fmtDate(new Date()), tt('ui.common.new'));
    if (!picked) return null;
    const dir = await this.boardsDir();
    try { await kapi.mkdir(dir); } catch {}
    const p = picked.path;
    this.data.reset(p);
    this.renderer.clear();
    this.renderer.setGrid(this.data.getGrid());
    this.renderer.resetZoom();
    this._renderAll();
    this.toolbar.setBoardName(this.data.getName());
    this._history = []; this._histIndex = -1;
    this._snapshot(true);
    await this.data.save();
    this._syncDirty();
    if (this._svc.onBoardsChanged) this._svc.onBoardsChanged();
    setStatus(ttf('ui.common.newBoardF2', this.data.getName()));
    return p;
  }

  /** รายชื่อกระดานทั้งหมดในโปรเจกต์ */
  async listBoards() {
    const out = [];
    const legacy = await kapi.join(this.root, 'planner.json');
    if (await kapi.exists(legacy)) out.push({ path: legacy, name: tt('ui.common.boardMain') });
    const dir = await this.boardsDir();
    if (await kapi.exists(dir)) {
      for (const f of await kapi.listFiles(dir, '.json').catch(() => [])) {
        out.push({ path: await kapi.join(dir, f), name: f.replace(/\.json$/i, '') });
      }
    }
    return out;
  }

  async openBoardDialog() {
    const boards = await this.listBoards();
    if (!boards.length) { setStatus(tt('ui.planner.notHasBoardProject')); return null; }
    const pick = await boardPicker(boards, this.data.getPath());
    if (!pick || pick === this.data.getPath()) return null;
    return this.openBoard(pick);
  }

  async openBoard(path) {
    if (!path) return false;
    if (!(await this.confirmDiscard(tt('ui.planner.openBoardOther')))) return false;
    this.renderer.clear();
    await this.data.load(path);
    await this._applyBoardLock();
    this.renderer.setGrid(this.data.getGrid());
    this.renderer.setBackground(this.data.getSettings().background);
    this.renderer.setBackgroundImage(this.data.getBackgroundImage());
    const vp = this.data.getViewport();
    this.renderer.setViewport(vp.x, vp.y, vp.zoom);
    this._renderAll();
    this.toolbar.setBoardName(this.data.getName());
    this.statusBar.setGridInfo(this.data.getGrid());
    this._history = []; this._histIndex = -1;
    this._snapshot(true);
    this._syncDirty();
    this._showProps('none', null);
    setStatus(tt('ui.planner.openBoard') + this.data.getName() + '"');
    return true;
  }

  /** บันทึกเป็นไฟล์ใหม่ (บั๊ก 5) */
  async saveAs() {
    const picked = await this._askBoardName(tt('ui.planner.saveBoardName'), this.data.getName() + tt('ui.common.msg2'), tt('ui.common.save'));
    if (!picked) return false;
    const dir = await this.boardsDir();
    try { await kapi.mkdir(dir); } catch {}
    this._persistViewport(true);
    const ok = await this.data.saveAs(picked.path);
    if (ok) {
      this.toolbar.setBoardName(this.data.getName());
      this._syncDirty();
      if (this._svc.onBoardsChanged) this._svc.onBoardsChanged();
      setStatus(ttf('ui.planner.saveF', this.data.getName()));
    } else setStatus(tt('ui.planner.saveNotOk'));
    return ok;
  }

  /**
   * ถามก่อนทิ้งงานที่ยังไม่บันทึก — ใช้ตอนปิดแผง / เปลี่ยนกระดาน (บั๊ก 5)
   * @returns {Promise<boolean>} true = ไปต่อได้ · false = ผู้ใช้ยกเลิก
   */
  async confirmDiscard(what) {
    if (!this.data.isDirty()) return true;
    const act = await choose(
      ttf('ui.planner.boardCantSave', this.data.getName(), what || tt('ui.common.close')),
      [{ label: tt('ui.planner.saveBefore'), value: 'save', primary: true },
       { label: tt('ui.planner.edit'), value: 'discard', danger: true },
       { label: tt('ui.common.cancel'), value: null }]);
    if (act === 'save') { await this.save(); return true; }
    if (act === 'discard') return true;
    return false;
  }

  /** true = ปิดได้ (app.js เรียกก่อนปิดแผง Planner) */
  async requestClose() { return this.confirmDiscard(tt('ui.planner.closeBoard')); }

  /**
   * [บั๊ก 65r2-8] Explorer เคยค้างแสดง "ยังไม่บันทึก" หลังกดบันทึกไปแล้ว
   * เพราะแถวในต้นไม้วาดครั้งเดียวตอน buildTree() → ต้องบอกให้อัปเดตทุกครั้งที่สถานะเปลี่ยน
   */
  _syncDirty() {
    const d = this.data.isDirty();
    this.toolbar.setDirty(d);
    if (this._lastDirty !== d || this._lastPath !== this.data.getPath()) {
      this._lastDirty = d;
      this._lastPath = this.data.getPath();
      if (this._svc.onDirtyChanged) {
        try { this._svc.onDirtyChanged(this.data.getPath(), d); } catch {}
      }
    }
    return d;
  }

  _persistViewport(silentDirty) {
    const vp = this.renderer.getViewport();
    const cur = this.data.getViewport();
    if (Math.abs(cur.x - vp.x) < 0.5 && Math.abs(cur.y - vp.y) < 0.5 && Math.abs(cur.zoom - vp.zoom) < 0.001) return;
    this.data.setViewport(vp.x, vp.y, vp.zoom);   // ไม่ mark dirty — การเลื่อนจอไม่ใช่การแก้งาน
    if (!silentDirty) this.toolbar.setZoom(vp.zoom);
  }

  // ═════════════════ วาดใหม่ทั้งกระดาน ═════════════════
  _renderAll() {
    this.renderer.clear();
    for (const g of this.data.getAllGroups()) this.renderer.renderGroup(g);
    for (const n of this.data.getAllNodes()) {
      const v = this.renderer.renderNode(n);
      v._lockedByData = !!n.locked;
    }
    this.renderer.renderEdges(this.data.getAllEdges());
    this.renderer.setNodeOrder(this.data.getAllNodes().map((n) => n.id));
    this.interaction.syncNodeInteractivity();
    this._applyFilter();
    this.renderer.restack();
    this.renderer.refresh();
  }

  // ═════════════════ กริด (บั๊ก 6) ═════════════════
  setGrid(props) {
    const g = this.data.updateGrid(props);
    this.renderer.setGrid(g);
    this.statusBar.setGridInfo(g);
    this.renderer.refresh();
    this._markDirty();
    return g;
  }

  // ═════════════════ เครื่องมือ (บั๊ก 4) ═════════════════
  _pickTool(tool, opts) { return this.interaction.setTool(tool, opts || {}); }

  /** คลิก/ลากบนกระดานด้วยเครื่องมือสร้าง → เกิดวัตถุใหม่ */
  _createFromTool(tool, info) {
    const d = TYPE_DEFAULTS[tool] || TYPE_DEFAULTS.scene;
    const box = info.box;
    let x, y, w = d.width, h = d.height;
    if (box && box.width > 8 && box.height > 8) { x = box.x; y = box.y; w = box.width; h = box.height; }
    else { x = info.x - d.width / 2; y = info.y - d.height / 2; }
    // [alpha.150 ข้อ 3] snap ต้องมีผลกับ **ขนาด** ด้วย และต้องมีผลกับทุกทางที่สร้างวัตถุ —
    // ไม่ใช่เฉพาะตอนลากด้วยเมาส์ (เมนูคลิกขวา · ปุ่มบนราง · คำสั่ง ก็ต้องลงกริดเหมือนกัน)
    // ปัดซ้ำกับกล่องที่ปัดมาแล้วไม่มีผลข้างเคียง (snapTo เป็น idempotent)
    const snapped = this.data.snapBox({ x, y, width: w, height: h });
    x = snapped.x; y = snapped.y; w = snapped.width; h = snapped.height;
    const n = this.data.addNode(tool, NEW_TITLE[tool] != null ? NEW_TITLE[tool] : tt('ui.common.new2'), COLORS[tool], x, y,
      { width: Math.round(w), height: Math.round(h), shape: tool === 'shape' ? (info.shape || 'rect') : d.shape || 'rect' });
    const v = this.renderer.renderNode(n);
    v._lockedByData = false;
    // [alpha.152 ข้อ 1] เช่นเดียวกับ `_addNode` — ล็อกเครื่องมือไว้แล้ววาดติด ๆ กัน
    // การ์ดใบก่อนหน้าจะกลายเป็นหลุมดำที่ fabric คว้าไปลากแทนการวาดกรอบนำ
    this.interaction.syncNodeInteractivity();
    this.renderer.restack();
    this.renderer.setActiveObject(v);
    this._showProps('node', n);
    this._snapshot();
    this.renderer.refresh();
    // โพสต์อิต/ข้อความ/คอมเมนต์ = พิมพ์ต่อได้ทันที
    // [alpha.150] `info.quiet` = "สร้างเฉย ๆ อย่าเด้ง UI ขึ้นมา" — ผู้เรียกที่จัดการต่อเองอยู่แล้ว
    // (เมนูคลิกขวา · คำสั่ง · เทส) ใช้ธงนี้ ไม่งั้นกล่องพิมพ์ข้อความลอยค้างทับกระดาน
    if (!info.quiet && ['sticky', 'text', 'comment'].includes(tool)) {
      setTimeout(() => this.interaction.editText(n), 10);
    }
    // [alpha.150] วางรูปแล้วต้องได้เลือกรูปทันที · วางรายการแล้วต้องได้พิมพ์ข้อทันที
    // (ยกเว้นตอนถูกเรียกจากเมนู/คำสั่งที่จัดการเองอยู่แล้ว — ส่ง `info.quiet`)
    if (!info.quiet && tool === 'image' && !n.src && this._svc.pickImage) {
      setTimeout(async () => {
        const p = await this._svc.pickImage();
        if (p && p.file) this._commitEdit(n.id, { src: 'Images/' + p.file });
      }, 10);
    }
    if (!info.quiet && tool === 'todo') setTimeout(() => this.editTodo(this.data.getNode(n.id)), 10);
    return n;
  }

  _addNode(type, title, color, x, y) {
    if (this._boardLockBlocked()) return null;
    const cx = x != null ? x : (this.renderer.getWidth() / 2 - this.renderer.getViewport().x) / this.renderer.getZoom();
    const cy = y != null ? y : (this.renderer.getHeight() / 2 - this.renderer.getViewport().y) / this.renderer.getZoom();
    const n = this.data.addNode(type, title || NEW_TITLE[type] || tt('ui.common.new2'), color || COLORS[type], cx, cy);
    const v = this.renderer.renderNode(n);
    v._lockedByData = false;
    // ══ [alpha.152 ข้อ 1] ★★ การ์ดที่เพิ่งเกิดต้องเชื่อฟัง "เครื่องมือที่เลือกอยู่" ทันที ══
    //
    // ผู้ใช้: *"ถ้าเรา double click สร้าง card ตัวไกด์ตอนสร้าง card ครั้งถัดไปจะหาย"*
    //
    // ตอนใช้เครื่องมือวาด การ์ดทุกใบต้อง `evented:false` (ตั้งไว้ใน `setTool`) ไม่งั้น fabric
    // จะคว้าการ์ดที่อยู่ใต้เมาส์ไปลากแทนการวาดกรอบนำ — ซึ่งเป็นเหตุผลที่มีบรรทัดนั้นตั้งแต่ 65r3-2
    // แต่ `setTool` วนแค่การ์ดที่ **มีอยู่ ณ ตอนเรียก** · การ์ดที่เกิดทีหลังจึงเกิดมาพร้อม
    // ค่าปริยาย `evented:true` และกลายเป็นหลุมดำกลางกระดาน: ลากทับเมื่อไหร่ไม่มีกรอบนำ
    // (ดับเบิลคลิกที่ว่างสร้างการ์ดตรงที่เมาส์อยู่พอดี ครั้งถัดไปจึงมักเริ่มลากทับมันเต็ม ๆ)
    this.interaction.syncNodeInteractivity();
    this.renderer.restack();
    this.renderer.setActiveObject(v);
    this._showProps('node', n);
    this._snapshot();
    this.renderer.refresh();
    this._act(`create ${type}`, { id: n.id, at: `${Math.round(n.x)},${Math.round(n.y)}`,
                                 board: this.data.getName(), total: this.data.getAllNodes().length });
    return n;
  }

  _commitEdit(id, props) {
    if (this._boardLockBlocked()) return false;
    const n = this.data.getNode(id);
    if (!n) { this._fail('edit: node not found', null, { id }); return false; }
    // ช่องที่เปลี่ยนอย่างเดียว ไม่ใช่ค่าทั้งก้อน — บันทึกจะได้อ่านออกว่า "ผู้ใช้แก้อะไร"
    // ระดับ debug เพราะยิงทุก 300ms ระหว่างพิมพ์ — ไม่งั้นท่วมบันทึกจนกลบเรื่องที่สำคัญกว่า
    this._dbg('edit ' + n.type, { id, fields: Object.keys(props || {}).join(',') });
    this.data.updateNode(id, props);
    this.renderer.rebuildNode(this.data.getNode(id));
    this.renderer.updateEdgesFor(this.data.edgesTouching([id]));
    this.interaction.syncNodeInteractivity();
    this._snapshot();
    this.renderer.refresh();
    if (this._selectedNodeId === id) this._showProps('node', this.data.getNode(id));
    return true;
  }

  // ═════════════════ เส้นเชื่อม ═════════════════
  _handleConnect(fromId, fromPort, toId, toPort) {
    if (this._boardLockBlocked()) return null;
    const e = this.data.addEdge(fromId, fromPort, toId, toPort, { routing: 'curved', arrowEnd: 'arrow' });
    if (!e) { setStatus(tt('ui.planner.connectCantHasLine')); return null; }
    this.renderer.renderEdge(e);
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    setStatus(tt('ui.planner.connectDoneClickLine'));
    return e;
  }

  selectEdge(id) {
    const e = this.data.getEdge(id);
    if (!e) return null;
    const prev = this.renderer._selectedEdgeId;
    this.renderer._selectedEdgeId = id;
    if (prev && prev !== id) { const pe = this.data.getEdge(prev); if (pe) this.renderer.renderEdge(pe); }
    this.renderer.renderEdge(e);
    this.renderer.hidePorts();
    this.renderer.showEdgeHandles(e);            // มือจับปลายเส้น = ถอด/ย้ายปลั๊กได้ (บั๊ก 65r2-5)
    this.renderer.restack();
    this.renderer.refresh();
    this._showProps('edge', e);
    return e;
  }

  /** ย้ายปลายเส้นไปต่อการ์ดอื่น (บั๊ก 65r2-5) */
  _relinkEdge(id, end, toNodeId, port) {
    const e = this.data.getEdge(id);
    if (!e || !this.data.getNode(toNodeId)) return false;
    const other = end === 'from' ? e.to.nodeId : e.from.nodeId;
    if (toNodeId === other) { this._deleteEdge(id); return true; }
    if (end === 'from') e.from = { nodeId: toNodeId, port: port || 'auto' };
    else e.to = { nodeId: toNodeId, port: port || 'auto' };
    this.data.markDirty();
    this.renderer.renderEdge(e);
    this.renderer.showEdgeHandles(e);
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    this._showProps('edge', e);
    setStatus(tt('ui.planner.moveLineDone'));
    return true;
  }

  /** ลำดับซ้อนทับของสิ่งที่เลือก (บั๊ก 65r2-1) */
  orderSelection(mode) {
    const ids = this._selectedNodeIds();
    if (!ids.length) { setStatus(tt('ui.planner.pickObjectBefore')); return false; }
    if (!this.data.moveNodeZ(ids, mode)) return false;
    this.renderer.setNodeOrder(this.data.getAllNodes().map((n) => n.id));
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    setStatus({ front: tt('ui.planner.liftTop'), back: tt('ui.planner.sendBottomLast'),
                forward: tt('ui.planner.liftOneLayer'), backward: tt('ui.planner.reduceOneLayer') }[mode] || tt('ui.planner.reorderDone'));
    return true;
  }

  _deleteEdge(id) {
    if (!this.data.getEdge(id)) return false;
    this.data.removeEdge(id);
    this.renderer.removeEdge(id);
    this.renderer._selectedEdgeId = null;
    this.renderer.refresh();
    this._showProps('none', null);
    this._snapshot();
    setStatus(tt('ui.planner.delLineLinkDone'));
    return true;
  }

  _flipEdge(id) {
    const e = this.data.getEdge(id);
    if (!e) return false;
    const f = { ...e.from }, t = { ...e.to };
    e.from = t; e.to = f;
    this.data.markDirty();
    this.renderer.renderEdge(e);
    this.renderer.restack();
    this.renderer.refresh();
    this._showProps('edge', e);
    this._snapshot();
    return true;
  }

  async _editEdgeLabel(id) {
    const e = this.data.getEdge(id);
    if (!e) return false;
    const v = await ask(tt('ui.planner.badgeLineLink'), { value: e.label || '', allowEmpty: true });
    if (v == null) return false;
    this.data.updateEdge(id, { label: v });
    this.renderer.renderEdge(this.data.getEdge(id));
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    return true;
  }

  // ═════════════════ คำสั่งกับสิ่งที่เลือก ═════════════════
  _selectedNodeIds() {
    const act = this.renderer.getActiveObject();
    if (!act) return [];
    const list = act.type === 'activeSelection' ? act.getObjects() : [act];
    return list.filter((o) => o.kind === 'node').map((o) => o.nid);
  }

  _selectAll() {
    const objs = this.data.getAllNodes().filter((n) => !n.locked)
      .map((n) => this.renderer._nodeVis.get(n.id)).filter(Boolean);
    if (!objs.length) return null;
    this.renderer.discardActiveObject();
    const sel = objs.length === 1 ? objs[0] : new fabric.ActiveSelection(objs, { canvas: this.renderer.canvas });
    this.renderer.setActiveObject(sel);
    this.renderer.refresh();
    if (objs.length > 1) this._showProps('many', objs.map((o) => o.nid));
    return sel;
  }

  _deleteSelected() {
    if (this._boardLockBlocked()) return false;
    const ids = this._selectedNodeIds();
    const act = this.renderer.getActiveObject();
    const groups = act ? (act.type === 'activeSelection' ? act.getObjects() : [act]).filter((o) => o.kind === 'group') : [];
    if (!ids.length && !groups.length) {
      if (this.renderer._selectedEdgeId) return this._deleteEdge(this.renderer._selectedEdgeId);
      setStatus(tt('ui.planner.pickObjectDelBefore')); return false;
    }
    for (const id of ids) { if (this.data.isLocked(id)) continue; this.renderer.removeNode(id); this.data.removeNode(id); }
    for (const g of groups) { this.renderer.removeGroup(g.gid); this.data.removeGroup(g.gid); }
    this.renderer.discardActiveObject();
    this._renderAll();
    this._snapshot();
    this._showProps('none', null);
    setStatus(ttf('ui.planner.delItemDone', ids.length + groups.length));
    return true;
  }

  _deleteNode(id) {
    if (!this.data.getNode(id)) return false;
    this.renderer.removeNode(id);
    this.data.removeNode(id);
    this.renderer.discardActiveObject();
    this._renderAll();
    this._snapshot();
    this._showProps('none', null);
    this._act('delete node', { id, board: this.data.getName(), left: this.data.getAllNodes().length });
    setStatus(tt('ui.planner.delDone'));
    return true;
  }

  _duplicateSelected(ids) {
    if (this._boardLockBlocked()) return null;
    const src =(ids || this._selectedNodeIds()).map((i) => this.data.getNode(i)).filter(Boolean);
    if (!src.length) { setStatus(tt('ui.planner.pickObjectRepeatBefore')); return null; }
    const made = [];
    for (const n of src) {
      const copy = this.data.addNodeRaw({
        ...n, id: uid('pl-'), tags: [...(n.tags || [])],
        x: n.x + 28, y: n.y + 28,
        title: n.title ? n.title + tt('ui.common.msg') : n.title,
      });
      const v = this.renderer.renderNode(copy);
      v._lockedByData = !!copy.locked;
      made.push(copy);
    }
    this.renderer.restack();
    this.interaction.syncNodeInteractivity();
    this._applyFilter();
    this._snapshot();
    this._selectNodes(made.map((m) => m.id));
    this._act('duplicate', { count: made.length, ids: made.map((m) => m.id).join(',').slice(0, 120) });
    setStatus(ttf('ui.planner.repeatItemDone', made.length));
    return made;
  }

  _selectNodes(ids) {
    const objs = ids.map((i) => this.renderer._nodeVis.get(i)).filter(Boolean);
    if (!objs.length) return null;
    this.renderer.discardActiveObject();
    const sel = objs.length === 1 ? objs[0] : new fabric.ActiveSelection(objs, { canvas: this.renderer.canvas });
    this.renderer.setActiveObject(sel);
    this.renderer.refresh();
    return sel;
  }

  _createGroupFromSelection(name) {
    const ids = this._selectedNodeIds();
    if (!ids.length) { setStatus(tt('ui.planner.pickCardBeforeDrag')); return null; }
    const g = this.data.addGroup(name || tt('ui.planner.groupNew'), ids, '#d97757');
    this.renderer.discardActiveObject();
    this._renderAll();
    this._snapshot();
    setStatus(ttf('ui.planner.groupCard', g.name, ids.length));
    return g;
  }

  /** จัดตำแหน่ง/กระจาย สำหรับหลายชิ้น */
  _align(mode, ids) {
    const list = (ids || this._selectedNodeIds()).map((i) => this.data.getNode(i)).filter(Boolean);
    if (list.length < 2) { setStatus(tt('ui.planner.pickLessItemBefore')); return false; }
    const minX = Math.min(...list.map((n) => n.x)), maxR = Math.max(...list.map((n) => n.x + n.width));
    const minY = Math.min(...list.map((n) => n.y)), maxB = Math.max(...list.map((n) => n.y + n.height));
    if (mode === 'left') for (const n of list) n.x = minX;
    else if (mode === 'right') for (const n of list) n.x = maxR - n.width;
    else if (mode === 'hcenter') { const c = (minX + maxR) / 2; for (const n of list) n.x = c - n.width / 2; }
    else if (mode === 'top') for (const n of list) n.y = minY;
    else if (mode === 'bottom') for (const n of list) n.y = maxB - n.height;
    else if (mode === 'vcenter') { const c = (minY + maxB) / 2; for (const n of list) n.y = c - n.height / 2; }
    else if (mode === 'distH') {
      const s = list.slice().sort((a, b) => a.x - b.x);
      const gap = (maxR - minX - s.reduce((t, n) => t + n.width, 0)) / (s.length - 1);
      let x = minX;
      for (const n of s) { n.x = x; x += n.width + gap; }
    } else if (mode === 'distV') {
      const s = list.slice().sort((a, b) => a.y - b.y);
      const gap = (maxB - minY - s.reduce((t, n) => t + n.height, 0)) / (s.length - 1);
      let y = minY;
      for (const n of s) { n.y = y; y += n.height + gap; }
    }
    for (const n of list) { n.x = Math.round(n.x); n.y = Math.round(n.y); this.renderer.moveNode(n); }
    this.data.markDirty();
    this.renderer.updateEdgesFor(this.data.edgesTouching(list.map((n) => n.id)));
    this.renderer.refresh();
    this._snapshot();
    return true;
  }

  _changeMany(props, ids) {
    const list = ids || this._selectedNodeIds();
    for (const id of list) {
      this.data.updateNode(id, props);
      const n = this.data.getNode(id);
      if (n) this.renderer.rebuildNode(n);
    }
    this.interaction.syncNodeInteractivity();
    this.renderer.updateEdgesFor(this.data.edgesTouching(list));
    this.renderer.refresh();
    this._snapshot();
    return true;
  }

  _revealSelected() {
    const ids = this._selectedNodeIds();
    const n = ids.length ? this.data.getNode(ids[0]) : null;
    if (!n) { setStatus(tt('ui.planner.pickCardBefore')); return false; }
    if (!n.file) { setStatus(tt('ui.planner.cardCantBindFile2')); return false; }
    if (this._onReveal) { this._onReveal(n.file); return true; }
    return false;
  }

  // ═════════════════ เมนูคลิกขวา ═════════════════
  _contextMenu(kind, id, ev, pt) {
    const items = [];
    if (kind === 'node') {
      const n = this.data.getNode(id);
      if (!n) return;
      if (!this.renderer.getActiveObject() || this._selectedNodeIds().indexOf(id) < 0) {
        this._selectNodes([id]); this._showProps('node', n);
      }
      if (n.file) items.push({ label: tt('ui.planner.openFile'), click: () => this._onOpenFile && this._onOpenFile(n.file) },
                             { label: tt('ui.planner.pointPosExplorer'), click: () => this._onReveal && this._onReveal(n.file) });
      items.push({ label: tt('ui.planner.editText'), click: () => this.interaction.editText(n) });
      // [alpha.150] เมนูเฉพาะชนิด — รายการติ๊ก / รูป
      if (n.type === 'todo') items.push({ label: tt('ui.planner.todoEdit'), click: () => this.editTodo(n) });
      if (n.type === 'image') {
        items.push({ label: tt('ui.planner.imgPick'), click: async () => {
          if (!this._svc.pickImage) { setStatus(tt('ui.planner.pickImageNot')); return; }
          const p = await this._svc.pickImage();
          if (p && p.file) this._commitEdit(n.id, { src: 'Images/' + p.file });
        } });
        for (const f of IMAGE_FITS) {
          items.push({ label: _tick(n.fit === f) + (FIT_LABELS[f] || f),
                       click: () => this._commitEdit(n.id, { fit: f }) });
        }
        // [alpha.150r] ย่อ/ขยายรูป — เกิน 100% แล้วรูปล้นกรอบ เลื่อนดูต่อได้ (ล้อ · Shift+ล้อ)
        items.push('-');
        items.push({ label: tt('ui.planner.imgBigger'), click: () => this.setImageScale(n.id, 1.25, 'mul') });
        items.push({ label: tt('ui.planner.imgSmaller'), click: () => this.setImageScale(n.id, 1 / 1.25, 'mul') });
        items.push({ label: tt('ui.planner.imgScaleReset'), click: () => this.setImageScale(n.id, 1, 'set') });
      }
      items.push({ label: tt('ui.planner.bindFileProject'), click: () => this._pickFileFor(n.id) });
      items.push('-');
      items.push({ label: tt('ui.common.repeat'), click: () => this._duplicateSelected() });
      items.push('-');
      // [alpha.149] คีย์ลัดเฉพาะของกระดาน = คอลัมน์ชิดขวาของเมนู (เดิมฝัง <span> ไว้ในไฟล์ภาษา ติดกับข้อความ)
      items.push({ label: tt('ui.planner.liftTopCtrlShift2'), accel: formatShortcut('BracketRight', true, true), click: () => this.orderSelection('front') });
      items.push({ label: tt('ui.planner.liftOneLayerCtrl'), accel: formatShortcut('BracketRight', true, false), click: () => this.orderSelection('forward') });
      items.push({ label: tt('ui.planner.reduceOneLayerCtrl'), accel: formatShortcut('BracketLeft', true, false), click: () => this.orderSelection('backward') });
      items.push({ label: tt('ui.planner.sendBottomLastCtrl2'), accel: formatShortcut('BracketLeft', true, true), click: () => this.orderSelection('back') });
      items.push('-');
      items.push({ label: n.locked ? tt('ui.common.unlock') : tt('ui.planner.lock'), click: () => this._commitEdit(n.id, { locked: !n.locked }) });
      items.push({ label: tt('ui.planner.groupPick'), click: () => this._createGroupFromSelection() });
      items.push('-');
      items.push({ label: tt('ui.common.del2'), danger: true, click: () => this._deleteSelected() });
    } else if (kind === 'edge') {
      this.selectEdge(id);
      const e = this.data.getEdge(id);
      if (!e) return;
      items.push({ label: tt('ui.planner.editBadge'), click: () => this._editEdgeLabel(id) });
      items.push({ label: tt('ui.common.toggle'), click: () => this._flipEdge(id) });
      for (const [r, label] of [['straight', tt('ui.planner.lineAt2')], ['orthogonal', tt('ui.common.cornerScene')], ['curved', tt('ui.common.curve')]]) {
        items.push({ label: _tick(e.routing === r) + label, click: () => this._changeEdge(id, { routing: r }) });
      }
      items.push('-');
      items.push({ label: tt('ui.planner.delLine'), danger: true, click: () => this._deleteEdge(id) });
    } else if (kind === 'group') {
      items.push({ label: tt('ui.planner.changeNameGroup'), click: async () => {
        const g = this.data.getGroup(id); if (!g) return;
        const v = await ask(tt('ui.common.nameGroup'), { value: g.name });
        if (v) { g.name = v; this.data.markDirty(); this._renderAll(); this._snapshot(); }
      } });
      items.push({ label: tt('ui.planner.group2'), danger: true, click: () => {
        this.data.removeGroup(id); this.renderer.removeGroup(id); this._renderAll(); this._snapshot();
      } });
    } else {
      items.push({ label: tt('ui.planner.sticky2'), click: () => this._createFromTool('sticky', { x: pt.x, y: pt.y }) });
      items.push({ label: tt('ui.planner.text'), click: () => this._createFromTool('text', { x: pt.x, y: pt.y }) });
      items.push({ label: tt('ui.planner.shape'), click: () => this._createFromTool('shape', { x: pt.x, y: pt.y, shape: this.interaction.getShapeKind() }) });
      items.push({ label: tt('ui.planner.comment'), click: () => this._createFromTool('comment', { x: pt.x, y: pt.y }) });
      // [alpha.150 ข้อ 6+9] แทรกรูป · รายการสิ่งที่ต้องทำ — จากเมนูคลิกขวาตรงจุดที่คลิก
      items.push({ label: tt('ui.planner.insertImageHere'), click: () => this.insertImageNode(pt.x, pt.y) });
      items.push({ label: tt('ui.planner.todoHere'), click: () => {
        const n = this._createFromTool('todo', { x: pt.x, y: pt.y, quiet: true });
        this.editTodo(n);
      } });
      items.push('-');
      // [alpha.150 ข้อ 2] คลิกขวาที่ว่าง = ตั้งพื้นกระดาน (สี + รูป)
      items.push({ label: tt('ui.planner.canvasSetup'), click: () => this._boardBackgroundDialog() });
      items.push('-');
      items.push({ label: tt('ui.planner.fitScreen'), click: () => this._zoomFit() });
      items.push({ label: tt('ui.planner.fullScreen'), click: () => this.toggleFullscreen() });
      items.push({ label: this.data.getGrid().show ? tt('ui.planner.hideGrid') : tt('ui.planner.showGrid'), click: () => this.setGrid({ show: !this.data.getGrid().show }) });
      items.push({ label: this.data.getGrid().snap ? tt('ui.planner.closeSnap') : tt('ui.planner.openSnap'), click: () => this.setGrid({ snap: !this.data.getGrid().snap }) });
      items.push('-');
      items.push({ label: tt('ui.planner.exportJson'), click: () => this.exportJSON() });
      items.push({ label: tt('ui.planner.saveBoard'), click: () => this.save() });
    }
    popupMenu(ev.clientX, ev.clientY, items);
  }

  _changeEdge(id, props) {
    this.data.updateEdge(id, props);
    const e = this.data.getEdge(id);
    if (e) { this.renderer.renderEdge(e); this.renderer.restack(); this.renderer.refresh(); }
    this._snapshot();
    if (this.renderer._selectedEdgeId === id) this._showProps('edge', e);
    return true;
  }

  async _pickFileFor(nodeId) {
    if (!this._svc.pickFile) { setStatus(tt('ui.planner.pickFileProjectNot')); return null; }
    const picked = await this._svc.pickFile();
    if (!picked) return null;
    const props = { file: picked.path };
    const n = this.data.getNode(nodeId);
    if (n && (!n.title || [tt('ui.common.new2'), tt('ui.common.notSpecifyName'), tt('ui.planner.sceneNew')].includes(n.title))) props.title = picked.title;
    this._commitEdit(nodeId, props);
    return picked;
  }

  // ═════════════════ กรอง ═════════════════
  _applyFilter() {
    const f = this._filter;
    let shown = 0;
    const active = !!(f.text || f.type || f.status);
    for (const n of this.data.getAllNodes()) {
      const vis = this.renderer._nodeVis.get(n.id);
      if (!vis) continue;
      const hay = `${n.title} ${n.synopsis} ${(n.tags || []).join(' ')}`.toLowerCase();
      const ok = (!f.text || hay.includes(f.text.toLowerCase())) &&
                 (!f.type || n.type === f.type) &&
                 (!f.status || n.status === f.status);
      vis.set({ opacity: ok ? (n.opacity == null ? 1 : n.opacity) : 0.12, evented: ok, selectable: ok && !n.locked });
      if (ok) shown++;
    }
    this.renderer.syncEdgeOpacity(this.data.getAllEdges());
    updatePlannerCount(this.statusBar.querySelector('#pl-count'), this.data.countStats(),
      active ? { shown, total: this.data.getAllNodes().length } : null);
    this.renderer.refresh();
    return shown;
  }

  // ═════════════════ Undo / Redo ═════════════════
  _markDirty() { this._syncDirty(); if (this._onDirtyCB) this._onDirtyCB(); }

  /**
   * ══ [alpha.153 ข้อ 4] ★★ บันทึกของกระดานต้องลงบันทึกระบบจริง ══
   *
   * ผู้ใช้: *"planner ยังไม่มี log ใน system log เลยไม่รู้ว่ามัน error มั้ย ทำให้ละเอียดเลย"*
   *
   * ของเดิมมีอยู่ 11 บรรทัดทั้งกระดาน และเกือบทั้งหมดเป็นระดับ `debug` ซึ่งแผงบันทึกซ่อนไว้
   * ตามค่าเริ่มต้น → เปิดแผงบันทึกมาดูก็ไม่เห็นอะไรเลย ไม่รู้ว่ากระดานทำงานถึงไหนหรือพังตรงไหน
   *
   * ตอนนี้ทุกการกระทำที่เปลี่ยนงานของผู้ใช้ลง `info` พร้อมรายละเอียดที่ใช้ไล่เหตุได้จริง
   * (ชื่อกระดาน · ชนิด/ไอดีของวัตถุ · จำนวนที่โดน) ส่วนที่พังลง `warn`/`error`
   * คำนำหน้า `planner:` ทำให้แผงบันทึกจัดกลุ่มตาม "ที่มา" ได้เอง (ดู log-core splitSource)
   */
  _act(what, detail) {
    try { log('info', 'planner: ' + what, detail); } catch { /* บันทึกพังห้ามลากงานผู้ใช้ลงไปด้วย */ }
  }

  /** รายละเอียดยิบย่อยที่ยิงถี่ (พิมพ์ · ลาก · ซูม) — เปิดดูได้จากตัวกรองระดับในแผงบันทึก */
  _dbg(what, detail) {
    try { log('debug', 'planner: ' + what, detail); } catch { /* เงียบ */ }
  }

  /** บันทึกความผิดพลาดของกระดาน — ที่เดียวกัน จะได้ไม่มีทางหล่นหาย */
  _fail(what, err, detail) {
    try {
      log('error', 'planner: ' + what, { error: (err && err.message) || String(err || '?'), ...(detail || {}) });
    } catch { /* ไม่มีอะไรทำได้แล้ว */ }
  }

  _snapshot(initial) {
    if (this._restoring) return;
    const snap = JSON.stringify({
      nodes: this.data.getAllNodes(), groups: this.data.getAllGroups(),
      edges: this.data.getAllEdges(), grid: this.data.getGrid(),
    });
    if (this._history[this._histIndex] === snap) { if (!initial) this._markDirty(); return; }
    this._history = this._history.slice(0, this._histIndex + 1);
    this._history.push(snap);
    if (this._history.length > this._maxHistory) this._history.shift();
    this._histIndex = this._history.length - 1;
    if (!initial) this.data.markDirty();
    this._markDirty();
  }

  _restore(index) {
    if (index < 0 || index >= this._history.length) return false;
    this._restoring = true;
    this._histIndex = index;
    const snap = JSON.parse(this._history[index]);
    this.data._parse({
      version: '4.0', nodes: snap.nodes, groups: snap.groups, edges: snap.edges,
      settings: { ...this.data.getSettings(), grid: snap.grid || this.data.getGrid() },
    });
    this.renderer.setGrid(this.data.getGrid());
    this._renderAll();
    this._showProps('none', null);
    this._restoring = false;
    this.data.markDirty();
    this._markDirty();
    return true;
  }

  undo() {
    if (this._boardLockBlocked()) return false;
    if (this._histIndex <= 0) {
      this._dbg('undo: nothing to undo', { depth: this._history.length });
      setStatus(tt('ui.planner.undoCantDone')); return false;
    }
    const ok = this._restore(this._histIndex - 1);
    if (ok) { this._act('undo', { step: this._histIndex, depth: this._history.length }); setStatus(tt('ui.planner.undo')); }
    else this._fail('undo failed', null, { want: this._histIndex - 1 });
    return ok;
  }

  redo() {
    if (this._boardLockBlocked()) return false;
    if (this._histIndex >= this._history.length - 1) {
      this._dbg('redo: nothing to redo', { depth: this._history.length });
      setStatus(tt('ui.planner.repeatCantDone')); return false;
    }
    const ok = this._restore(this._histIndex + 1);
    if (ok) this._act('redo', { step: this._histIndex, depth: this._history.length });
    else this._fail('redo failed', null, { want: this._histIndex + 1 });
    if (ok) setStatus(tt('ui.planner.repeat'));
    return ok;
  }

  // ═════════════════ แผงคุณสมบัติ (บั๊ก 3) ═════════════════
  setPropsCallback(fn) { this._propsCallback = fn; }

  _showProps(mode, data) {
    try { this.syncFmtBar(); } catch {}
    if (mode !== 'edge') this.renderer._selectedEdgeId = null;
    this._selectedNodeId = (mode === 'node' && data) ? data.id : null;
    // แถบคุณสมบัติลอยเหนือสิ่งที่เลือก — ทำงานแม้แผงคุณสมบัติจะถูกปิดอยู่ (บั๊ก 7)
    if (this.ctxBar) { if (mode === 'none' || !data) this.ctxBar.hideBar(); else this.syncContextBar(); }
    if (!this._propsCallback) return;
    const ctx = { mode, data };

    if (mode === 'node' && data) {
      ctx.connections = this.data.edgesTouching([data.id]).map((e) => {
        const out = e.from.nodeId === data.id;
        const other = this.data.getNode(out ? e.to.nodeId : e.from.nodeId);
        return { id: e.id, dir: out ? 'out' : 'in', label: e.label, otherTitle: (other && other.title) || '?' };
      });
      ctx.onChangeNode = (props) => {
        this.data.updateNode(data.id, props);
        const n = this.data.getNode(data.id);
        this.renderer.rebuildNode(n);
        const v = this.renderer._nodeVis.get(data.id);
        if (v) v._lockedByData = !!n.locked;
        this.interaction.syncNodeInteractivity();
        this.renderer.updateEdgesFor(this.data.edgesTouching([data.id]));
        this.renderer.restack();
        this.renderer.refresh();
        this._snapshot();
      };
      ctx.onPickFile = () => (this._svc.pickFile ? this._svc.pickFile() : Promise.resolve(null));
      // [alpha.150 ข้อ 6] ปุ่ม "เลือก…" ของช่องไฟล์รูปในแผงคุณสมบัติ
      ctx.onPickImage = () => (this._svc.pickImage ? this._svc.pickImage() : Promise.resolve(null));
      ctx.onConnectFrom = () => { this._pickTool('connector'); setStatus(tt('ui.planner.toolLineLinkClick')); };
      ctx.onCenterNode = (id) => this.centerOn(id);
      ctx.onRevealFile = (file) => { if (this._onReveal && file) this._onReveal(file); else setStatus(tt('ui.planner.cardCantBindFile')); };
      ctx.onDeleteNode = (id) => this._deleteNode(id);
      ctx.onDuplicateNode = (id) => this._duplicateSelected([id]);
      ctx.onDeleteEdge = (id) => this._deleteEdge(id);
      ctx.onSelectEdgeId = (id) => this.selectEdge(id);
    } else if (mode === 'edge' && data) {
      const a = this.data.getNode(data.from.nodeId), b = this.data.getNode(data.to.nodeId);
      ctx.endpoints = { from: (a && a.title) || '?', to: (b && b.title) || '?' };
      ctx.onChangeEdge = (props) => this._changeEdge(data.id, props);
      ctx.onDeleteEdge = (id) => this._deleteEdge(id);
      ctx.onFlipEdge = (id) => this._flipEdge(id);
    } else if (mode === 'many' && data) {
      ctx.onChangeMany = (props) => this._changeMany(props, data);
      ctx.onAlign = (m) => this._align(m, data);
      ctx.onGroup = () => this._createGroupFromSelection();
      ctx.onDuplicate = () => this._duplicateSelected(data);
      ctx.onDeleteSelected = () => this._deleteSelected();
    }
    this._propsCallback(ctx);
  }

  centerOn(id) {
    const n = this.data.getNode(id);
    if (!n) return false;
    const z = this.renderer.getZoom();
    this.renderer.setViewport(
      this.renderer.getWidth() / 2 - (n.x + n.width / 2) * z,
      this.renderer.getHeight() / 2 - (n.y + n.height / 2) * z, z);
    this._persistViewport();
    return true;
  }

  // ═════════════════ ลากจาก Explorer มาวาง ═════════════════
  dropPayload(kind, d, ev) {
    const type = kind === 'text/k2-entity' ? 'entity' : kind === 'text/k2-memo' ? 'note'
               : kind === 'text/k2-chapter' ? 'chapter' : 'scene';
    let x = 60, y = 60;
    if (ev) {
      const r = this.stage.getBoundingClientRect();
      const z = this.renderer.getZoom() || 1;
      const vt = this.renderer.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      x = ((ev.clientX - r.left) - vt[4]) / z - CARD_W / 2;
      y = ((ev.clientY - r.top) - vt[5]) / z - CARD_H / 2;
    }
    const title = d.title || (d.file ? (String(d.file).split(/[\\/]/).pop() || '').replace(/\.md$/i, '') : tt('ui.common.new2'));
    const dup = d.file && this.data.getAllNodes().find((n) => n.file === d.file);
    if (dup) { this._selectNodes([dup.id]); this.centerOn(dup.id); setStatus(ttf('ui.planner.topBoardDone', title)); return dup; }
    const n = this.data.addNode(type, title, COLORS[type], x, y);
    n.file = d.file || d.path || null;
    const v = this.renderer.renderNode(n);
    v._lockedByData = false;
    this.renderer.restack();
    this.interaction.syncNodeInteractivity();
    this._applyFilter();
    this.renderer.setActiveObject(v);
    this._showProps('node', n);
    this._snapshot();
    setStatus(ttf('ui.planner.addBoardDone', title));
    this.renderer.refresh();
    return n;
  }

  // ═════════════════ อื่น ๆ ═════════════════
  loadSample() {
    const mk = (o) => this.data.addNodeRaw(o);
    this.data._nodes = []; this.data._edges = []; this.data._groups = [];
    const a = mk({ type: 'scene', title: tt('ui.planner.sceneOpenStory'), color: '#3f3e3a', x: 120, y: 140, tags: [tt('ui.planner.openStory')], synopsis: tt('ui.planner.itemFoundStoryNormal'), status: tt('ui.common.busyWrite') });
    const b = mk({ type: 'scene', title: tt('ui.planner.scene'), color: '#5f7a9f', x: 460, y: 140, tags: [tt('ui.planner.dot')], synopsis: tt('ui.planner.openLift'), status: tt('ui.planner.outlineDraft') });
    const c = mk({ type: 'entity', title: tt('ui.planner.characterMain'), color: '#7a6f9f', x: 290, y: 340 });
    mk({ type: 'sticky', title: '', synopsis: tt('ui.planner.knotStory'), color: '#f2c14e', x: 660, y: 330, width: 160, height: 160 });
    mk({ type: 'shape', shape: 'diamond', title: tt('ui.planner.decide'), color: '#4a6fa5', x: 470, y: 350, width: 170, height: 120 });
    this.data.addEdge(a.id, 'right', b.id, 'left', { label: tt('ui.planner.cont'), routing: 'curved' });
    this.data.addEdge(c.id, 'top', a.id, 'bottom', { label: tt('ui.planner.appear'), routing: 'orthogonal', arrowEnd: 'triangle' });
    this.data.markDirty();
    this._renderAll();
    this._snapshot();
    this._zoomFit();
    setStatus(tt('ui.planner.putSampleDonePress'));
  }

  _autoLayout() {
    const ns = this.data.getAllNodes().filter((n) => n.type !== 'frame');
    if (ns.length < 2) { setStatus(tt('ui.planner.mustHasLessCard')); return false; }
    const W = Math.max(600, this.renderer.getWidth()), H = Math.max(450, this.renderer.getHeight());
    const k = (Math.min(W, H) / Math.sqrt(ns.length)) * 0.8;
    for (let it = 0; it < 140; it++) {
      const F = {};
      for (const n of ns) F[n.id] = { x: 0, y: 0 };
      for (const e of this.data.getAllEdges()) {
        const a = ns.find((n) => n.id === e.from.nodeId), b = ns.find((n) => n.id === e.to.nodeId);
        if (!a || !b) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (d / k) * 0.1;
        F[a.id].x -= (dx / d) * f; F[a.id].y -= (dy / d) * f;
        F[b.id].x += (dx / d) * f; F[b.id].y += (dy / d) * f;
      }
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x, dy = ns[i].y - ns[j].y;
          const d = Math.max(1, Math.hypot(dx, dy));
          const f = ((k * k) / (d * d)) * 0.05;
          F[ns[i].id].x += (dx / d) * f; F[ns[i].id].y += (dy / d) * f;
          F[ns[j].id].x -= (dx / d) * f; F[ns[j].id].y -= (dy / d) * f;
        }
      }
      for (const n of ns) {
        n.x = Math.max(10, Math.min(W * 1.6 - n.width, n.x + F[n.id].x));
        n.y = Math.max(10, Math.min(H * 1.6 - n.height, n.y + F[n.id].y));
      }
    }
    const g = this.data.getGrid();
    if (g.snap) for (const n of ns) { n.x = snapTo(n.x, g.size); n.y = snapTo(n.y, g.size); }
    for (const gr of this.data.getAllGroups()) this.data.updateGroupBounds(gr.id);
    this.data.markDirty();
    this._renderAll();
    this._snapshot();
    this._zoomFit();
    setStatus(tt('ui.planner.arrangeAutoDone'));
    return true;
  }

  _zoomFit() {
    const z = this.renderer.zoomFit(this.data.bounds(), this.renderer.getWidth(), this.renderer.getHeight());
    this.toolbar.setZoom(z);
    this._persistViewport();
    return z;
  }

  async exportPNG() {
    try {
      const vt = this.renderer.canvas.viewportTransform.slice();
      const b = this.data.bounds();
      this.renderer.hidePorts();
      this.renderer.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const opt = { format: 'png', multiplier: 2 };
      if (b) { opt.left = b.x - 24; opt.top = b.y - 24; opt.width = b.right - b.x + 48; opt.height = b.bottom - b.y + 48; }
      const url = this.renderer.canvas.toDataURL(opt);
      this.renderer.canvas.setViewportTransform(vt);
      this.renderer.refresh();
      const name = await kapi.writeImageData(this.root, _safeName(this.data.getFileBase()) + '.png', url.split(',')[1]);
      setStatus(tt('ui.planner.saveImageBoardDone') + (typeof name === 'string' ? name : 'planner.png'));
      return true;
    } catch (e) { setStatusError(failText(tt('ui.planner.exportPNGCant'), e)); return false; }
  }

  /** [alpha.164 · งาน 7] แถบกรอง: แถวของตัวเอง (ปกติ) ↔ ต่อท้ายแถวแถบคำสั่ง (แผงเตี้ย) */
  _placeFilterBar(inline) {
    const fb = this.filterBar;
    const strip = this.toolbar && this.toolbar.querySelector('.planner-toolbar-strip');
    if (!fb || !strip) return;
    const isIn = fb.parentElement === strip;
    if (inline && !isIn) {
      strip.appendChild(fb);
      fb.classList.add('planner-filter-inline');
    } else if (!inline && isIn) {
      fb.classList.remove('planner-filter-inline');
      this.toolbar.after(fb);
    } else return;
    this.toolbar.syncArrows && this.toolbar.syncArrows();
  }

  _fit() {
    // แผงเตี้ยมาก ๆ ให้ยุบแถบรอง ๆ ทิ้งก่อน เหลือแถบเครื่องมือกับกระดาน (บั๊ก 65r5 "ย่อไม่สุด")
    const paneH = this.pane.clientHeight;
    if (paneH) {
      this.pane.classList.toggle('planner-compact', paneH < 190);
      this.pane.classList.toggle('planner-mini', paneH < 120);
      // [alpha.164 · งาน 7] แผงเตี้ยระดับกลาง: แถบคำสั่ง + แถบกรอง + แถบรูปแบบลอย กินหัวกระดาน ~120px
      // → ย้ายแถบกรองเข้าไปต่อท้ายแถวแถบคำสั่ง (แถวนั้นเลื่อนแนวนอนได้อยู่แล้ว) — กรองยังใช้ได้ ไม่หายไปไหน
      this._placeFilterBar(paneH >= 190 && paneH < PLANNER_INLINE_FILTER_H);
    }
    const r = this.stage.getBoundingClientRect();
    if (!r.width || !r.height) {
      // ══ [alpha.151 ข้อ 8] เวทียังไม่มีขนาด (แผงถูกซ่อน/กำลังวาดใหม่) ══
      //
      // ผู้ใช้เห็นบรรทัดนี้ในบันทึกแล้วสงสัยว่าเป็นต้นตอของกรอบนำที่เพี้ยน — ถูกครึ่งเดียว:
      // การข้ามไม่ใช่ปัญหา (ไม่มีขนาดก็คำนวณอะไรไม่ได้จริง ๆ) แต่ **การข้ามแล้วไม่กลับมาทำใหม่**
      // ต่างหาก เพราะรอบนั้น `calcOffset()` ไม่ได้ถูกเรียก → fabric ยังจำพิกัดเดิมของ canvas
      // ถ้าไม่มีการเปลี่ยนขนาดอีกเลยหลังแผงกลับมา ก็ไม่มีใครเรียก fit() ซ้ำ (บทเรียนข้อ 24)
      // → นัดกลับมาทำใหม่เองเมื่อเวทีมีขนาดแล้ว แทนที่จะปล่อยค้าง · และลดเป็น debug
      //   เพราะเป็นเหตุการณ์ปกติทุกครั้งที่พับ/ปิดแผง ไม่ใช่ความผิดพลาด
      log('debug', tt('ui.planner.plannerFitSkipBoard'));
      if (!this._refitTimer) {
        this._refitTimer = setInterval(() => {
          const r2 = this.stage.getBoundingClientRect();
          if (!r2.width || !r2.height) return;
          clearInterval(this._refitTimer);
          this._refitTimer = null;
          this._fit();
        }, 250);
      }
      return false;
    }
    if (this._refitTimer) { clearInterval(this._refitTimer); this._refitTimer = null; }
    const changed = this.renderer.fit(r.width, r.height);
    this.toolbar.syncArrows && this.toolbar.syncArrows();
    if (changed) {
      log('info', `planner: _fit ${Math.round(r.width)}x${Math.round(r.height)}`,
          { offset: this.renderer.canvas._offset });
    }
    return changed;
  }

  focus() {
    const w = this.renderer.canvas && this.renderer.canvas.wrapperEl;
    if (w && w.focus) w.focus();
  }

  destroy() {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
    if (this._fitRaf) cancelAnimationFrame(this._fitRaf);
    if (this.data && this.data.isDirty()) { try { this.data.save(); } catch {} }
    if (this.interaction) this.interaction.destroy();
    if (this._refitTimer) { clearInterval(this._refitTimer); this._refitTimer = null; }
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this.toolbar && this.toolbar._ro) this.toolbar._ro.disconnect();
    if (this.renderer) this.renderer.dispose();
    this.pane.innerHTML = '';
  }
}

/** กล่องเลือกกระดาน — รายการยาวได้ (choose() ของ ui.js เรียงปุ่มแนวนอน ใช้กับรายการไม่ไหว) */
export function boardPicker(boards, currentPath) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    const t = el('div', 'k-dlg-title', tt('ui.planner.openBoardPlanner'));
    const list = el('div', 'planner-board-list');
    for (const b of boards) {
      const row = el('div', 'planner-board-row' + (b.path === currentPath ? ' current' : ''));
      row.append(el('span', 'planner-board-ic', glyphOf(b.path === currentPath ? 'dot' : 'clipboard')),
                 el('span', 'planner-board-nm', b.name));
      row.onclick = () => { ov.remove(); resolve(b.path); };
      row.ondblclick = row.onclick;
      list.appendChild(row);
    }
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', 'k-cancel', tt('ui.common.cancel'));
    cancel.onclick = () => { ov.remove(); resolve(null); };
    btns.appendChild(cancel);
    box.append(t, list, btns);
    ov.appendChild(box);
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
  });
}

/** ชื่อไฟล์ที่ปลอดภัยกับ Windows/macOS */
function _safeName(s) {
  return String(s || tt('ui.common.board')).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || tt('ui.common.board');
}

/** เครื่องหมาย "ข้อนี้เลือกอยู่" ในเมนู — ไอคอนมาจากทะเบียน ไม่ฮาร์ดโค้ด */
function _tick(on) { return on ? glyphOf('dot') + ' ' : '　'; }

/** "ไอคอนจากทะเบียน + ข้อความ" สำหรับที่ที่รับได้แค่สตริง (ชื่อแผง) */
function _withGlyphTitle(iconName, text) {
  const g = glyphOf(iconName);
  return g ? g + ' ' + text : text;
}

/** ชื่อไฟล์สั้น ๆ จาก path (โชว์ในกล่องพื้นกระดาน) */
function _fileLabel(p) {
  return String(p || '').split(/[\\/]/).pop() || String(p || '');
}
