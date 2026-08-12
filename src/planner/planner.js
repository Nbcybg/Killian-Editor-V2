// planner.js — Orchestrator ของ Planner v4 (กระดานวางแผนแบบ Miro)
// ประกอบ data → render → interact → ui → props เข้าด้วยกัน + จัดการไฟล์กระดาน
import { T } from '../i18n.js';
import {
  PlannerData, CARD_W, CARD_H, uid, TYPE_DEFAULTS, snapTo,
} from './planner-data.js';
import { PlannerRenderer } from './planner-render.js';
import { PlannerInteraction } from './planner-interact.js';
import {
  createPlannerToolbar, createPlannerFilterBar, createPlannerRail,
  createPlannerStatus, createContextBar, updatePlannerCount, TOOL_LABELS,
} from './planner-ui.js';
import { absBox } from './planner-render.js';
import { setStatus, el, log } from '../core.js';
import { popupMenu, ask, confirmBox, choose } from '../ui.js';
import { fabric } from 'fabric';

const COLORS = {
  scene: '#3f3e3a', chapter: '#5f7a9f', entity: '#7a6f9f', note: '#5f8a6f',
  sticky: '#f2c14e', text: 'transparent', shape: '#4a6fa5', frame: '#d97757', comment: '#e8e3d3',
};
const NEW_TITLE = {
  scene: T`ฉากใหม่`, chapter: T`บทใหม่`, entity: T`ตัวละครใหม่`, note: T`โน้ตใหม่`,
  sticky: '', text: T`ข้อความ`, shape: '', frame: T`เฟรมใหม่`, comment: '',
};

export class PlannerBoard {
  constructor(pane, projectRoot, opts = {}) {
    this.pane = pane;
    this.root = projectRoot;
    this._onOpenFile = opts.onOpenFile || null;
    this._onDirtyCB = opts.onDirty || null;
    this._onReveal = opts.onReveal || null;
    this._svc = opts.services || {};              // pickFile / listBoards / boardsDir …
    this.title = '📋 Planner';
    /** เปิดไฟล์ที่ผูกกับการ์ด (ทางเดียวกับดับเบิลคลิก) — เปิดไว้ให้ e2e/สคริปต์เรียกได้ */
    this.onOpenFile = (f) => (this._onOpenFile ? this._onOpenFile(f) : null);

    try {
      this._init(opts.path);
    } catch (e) {
      console.error('PlannerBoard init failed', e);
      this.pane.innerHTML = T`<div style="color:#e05555;padding:20px">Planner เปิดไม่ได้: ` + (e.message || e) + '</div>';
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
    this.stage.appendChild(this.canvasEl);
    this.stage.appendChild(this.rail);
    this.stage.appendChild(this.ctxBar);

    this.pane.appendChild(this.toolbar);
    this.pane.appendChild(this.filterBar);
    this.pane.appendChild(this.stage);
    this.pane.appendChild(this.statusBar);

    // ---- ชั้นวาด ----
    this.renderer = new PlannerRenderer(this.canvasEl, {
      gridHost: this.stage,
      getEdge: (id) => this.data.getEdge(id),
      onViewportChange: (vp) => { this.toolbar.setZoom(vp.zoom); this.syncContextBar(); },
    });

    // ---- ชั้นโต้ตอบ ----
    this.interaction = new PlannerInteraction(this.renderer, this.data, {
      host: this.stage,
      isActive: () => this.pane.isConnected && this.pane.offsetParent !== null,
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
    this._autoSaveTimer = setInterval(() => { if (this.data.isDirty()) this.save(true); }, 60000);

    this._ready = this._load().then(() => { this._snapshot(true); this._fit(); });
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
      onSample: () => this.loadSample(),
      getGrid: () => this.data.getGrid(),
      getBackground: () => this.data.getSettings().background,
      onGridChange: (p) => this.setGrid(p),
      onBackgroundChange: (c) => { this.data.setBackground(c); this.renderer.setBackground(c); this._markDirty(); },
    };
  }

  // ═════════════════ โหลด / บันทึก / ไฟล์กระดาน (บั๊ก 5) ═════════════════
  async _load() {
    await this.data.load();
    this.renderer.setGrid(this.data.getGrid());
    this.renderer.setBackground(this.data.getSettings().background);
    const vp = this.data.getViewport();
    if (vp.zoom !== 1 || vp.x || vp.y) this.renderer.setViewport(vp.x, vp.y, vp.zoom);
    this._renderAll();
    this.toolbar.setBoardName(this.data.getName());
    this.toolbar.setZoom(this.renderer.getZoom());
    this.statusBar.setGridInfo(this.data.getGrid());
    this._syncDirty();
    log('info', T`planner: โหลดกระดาน "${this.data.getName()}"`, {
      path: this.data.getPath(), ...this.data.countStats(),
      grid: this.data.getGrid(), viewport: this.data.getViewport(),
    });
    return true;
  }

  async save(silent) {
    this._persistViewport(true);
    const wasNew = !(await kapi.exists(await this.data._defaultPath()).catch(() => true));
    const ok = await this.data.save();
    this._syncDirty();
    log('info', T`planner: บันทึก "${this.data.getName()}" ${ok ? T`สำเร็จ` : T`ล้มเหลว`}` +
        (wasNew ? T` (ไฟล์ใหม่ → รีเฟรช Explorer)` : ''), { path: this.data.getPath() });
    if (ok && wasNew && this._svc.onBoardsChanged) this._svc.onBoardsChanged();
    if (ok && !silent) setStatus(T`💾 บันทึกกระดาน "` + this.data.getName() + T`" แล้ว`);
    else if (!ok) setStatus(T`บันทึกกระดานไม่สำเร็จ`);
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
      const name = await ask(title, { value, okLabel: okLabel || T`สร้าง` });
      if (!name) return null;
      const safe = _safeName(name);
      const p = await kapi.join(dir, safe + '.json');
      if (!(await kapi.exists(p))) return { name: safe, path: p, overwrite: false };
      const act = await choose(T`มีกระดานชื่อ "${safe}" อยู่แล้วในโปรเจกต์`, [
        { label: T`✏️ ตั้งชื่อใหม่`, value: 'again', primary: true },
        { label: T`เขียนทับของเดิม`, value: 'over', danger: true },
        { label: T`ยกเลิก`, value: null }]);
      if (act === 'over') return { name: safe, path: p, overwrite: true };
      if (!act) return null;
      value = safe + ' 2';
    }
  }

  /** สร้างกระดานใหม่ — ถามชื่อ แล้วเปิดกระดานเปล่า (บั๊ก 5) */
  async newBoard() {
    if (!(await this.confirmDiscard(T`สร้างกระดานใหม่`))) return null;
    const picked = await this._askBoardName(T`ชื่อกระดานใหม่`,
      T`กระดาน ` + (new Date().toLocaleDateString('th-TH')), T`สร้าง`);
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
    setStatus(T`สร้างกระดาน "` + this.data.getName() + T`" แล้ว`);
    return p;
  }

  /** รายชื่อกระดานทั้งหมดในโปรเจกต์ */
  async listBoards() {
    const out = [];
    const legacy = await kapi.join(this.root, 'planner.json');
    if (await kapi.exists(legacy)) out.push({ path: legacy, name: T`กระดานหลัก` });
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
    if (!boards.length) { setStatus(T`ยังไม่มีกระดานในโปรเจกต์ — กด ✚ ใหม่ เพื่อสร้าง`); return null; }
    const pick = await boardPicker(boards, this.data.getPath());
    if (!pick || pick === this.data.getPath()) return null;
    return this.openBoard(pick);
  }

  async openBoard(path) {
    if (!path) return false;
    if (!(await this.confirmDiscard(T`เปิดกระดานอื่น`))) return false;
    this.renderer.clear();
    await this.data.load(path);
    this.renderer.setGrid(this.data.getGrid());
    this.renderer.setBackground(this.data.getSettings().background);
    const vp = this.data.getViewport();
    this.renderer.setViewport(vp.x, vp.y, vp.zoom);
    this._renderAll();
    this.toolbar.setBoardName(this.data.getName());
    this.statusBar.setGridInfo(this.data.getGrid());
    this._history = []; this._histIndex = -1;
    this._snapshot(true);
    this._syncDirty();
    this._showProps('none', null);
    setStatus(T`เปิดกระดาน "` + this.data.getName() + '"');
    return true;
  }

  /** บันทึกเป็นไฟล์ใหม่ (บั๊ก 5) */
  async saveAs() {
    const picked = await this._askBoardName(T`บันทึกเป็นกระดานชื่อ`, this.data.getName() + T` สำเนา`, T`บันทึก`);
    if (!picked) return false;
    const dir = await this.boardsDir();
    try { await kapi.mkdir(dir); } catch {}
    this._persistViewport(true);
    const ok = await this.data.saveAs(picked.path);
    if (ok) {
      this.toolbar.setBoardName(this.data.getName());
      this._syncDirty();
      if (this._svc.onBoardsChanged) this._svc.onBoardsChanged();
      setStatus(T`💾 บันทึกเป็น "` + this.data.getName() + T`" แล้ว`);
    } else setStatus(T`บันทึกเป็นไม่สำเร็จ`);
    return ok;
  }

  /**
   * ถามก่อนทิ้งงานที่ยังไม่บันทึก — ใช้ตอนปิดแผง / เปลี่ยนกระดาน (บั๊ก 5)
   * @returns {Promise<boolean>} true = ไปต่อได้ · false = ผู้ใช้ยกเลิก
   */
  async confirmDiscard(what) {
    if (!this.data.isDirty()) return true;
    const act = await choose(
      T`กระดาน "${this.data.getName()}" ยังไม่ได้บันทึก — ${what || T`ปิด`} เลยไหม?`,
      [{ label: T`💾 บันทึกก่อน`, value: 'save', primary: true },
       { label: T`ทิ้งการแก้ไข`, value: 'discard', danger: true },
       { label: T`ยกเลิก`, value: null }]);
    if (act === 'save') { await this.save(); return true; }
    if (act === 'discard') return true;
    return false;
  }

  /** true = ปิดได้ (app.js เรียกก่อนปิดแผง Planner) */
  async requestClose() { return this.confirmDiscard(T`ปิดกระดาน`); }

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
    const n = this.data.addNode(tool, NEW_TITLE[tool] != null ? NEW_TITLE[tool] : T`ใหม่`, COLORS[tool], x, y,
      { width: Math.round(w), height: Math.round(h), shape: tool === 'shape' ? (info.shape || 'rect') : d.shape || 'rect' });
    const v = this.renderer.renderNode(n);
    v._lockedByData = false;
    this.renderer.restack();
    this.renderer.setActiveObject(v);
    this._showProps('node', n);
    this._snapshot();
    this.renderer.refresh();
    // โพสต์อิต/ข้อความ/คอมเมนต์ = พิมพ์ต่อได้ทันที
    if (['sticky', 'text', 'comment'].includes(tool)) setTimeout(() => this.interaction.editText(n), 10);
    return n;
  }

  _addNode(type, title, color, x, y) {
    const cx = x != null ? x : (this.renderer.getWidth() / 2 - this.renderer.getViewport().x) / this.renderer.getZoom();
    const cy = y != null ? y : (this.renderer.getHeight() / 2 - this.renderer.getViewport().y) / this.renderer.getZoom();
    const n = this.data.addNode(type, title || NEW_TITLE[type] || T`ใหม่`, color || COLORS[type], cx, cy);
    const v = this.renderer.renderNode(n);
    v._lockedByData = false;
    this.renderer.restack();
    this.renderer.setActiveObject(v);
    this._showProps('node', n);
    this._snapshot();
    this.renderer.refresh();
    return n;
  }

  _commitEdit(id, props) {
    const n = this.data.getNode(id);
    if (!n) return false;
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
    const e = this.data.addEdge(fromId, fromPort, toId, toPort, { routing: 'curved', arrowEnd: 'arrow' });
    if (!e) { setStatus(T`เชื่อมต่อไม่ได้ — มีเส้นนี้อยู่แล้ว หรือเป็นการ์ดเดียวกัน`); return null; }
    this.renderer.renderEdge(e);
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    setStatus(T`เชื่อมต่อแล้ว — คลิกที่เส้นเพื่อแก้รูปแบบ/หัวลูกศร`);
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
    setStatus(T`ย้ายปลายเส้นแล้ว`);
    return true;
  }

  /** ลำดับซ้อนทับของสิ่งที่เลือก (บั๊ก 65r2-1) */
  orderSelection(mode) {
    const ids = this._selectedNodeIds();
    if (!ids.length) { setStatus(T`เลือกวัตถุก่อน`); return false; }
    if (!this.data.moveNodeZ(ids, mode)) return false;
    this.renderer.setNodeOrder(this.data.getAllNodes().map((n) => n.id));
    this.renderer.restack();
    this.renderer.refresh();
    this._snapshot();
    setStatus({ front: T`⬆ ยกไปบนสุด`, back: T`⬇ ส่งไปล่างสุด`,
                forward: T`↑ ยกขึ้นหนึ่งชั้น`, backward: T`↓ ลดลงหนึ่งชั้น` }[mode] || T`จัดลำดับแล้ว`);
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
    setStatus(T`ลบเส้นเชื่อมแล้ว`);
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
    const v = await ask(T`ป้ายกำกับเส้นเชื่อม`, { value: e.label || '', allowEmpty: true });
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
    const ids = this._selectedNodeIds();
    const act = this.renderer.getActiveObject();
    const groups = act ? (act.type === 'activeSelection' ? act.getObjects() : [act]).filter((o) => o.kind === 'group') : [];
    if (!ids.length && !groups.length) {
      if (this.renderer._selectedEdgeId) return this._deleteEdge(this.renderer._selectedEdgeId);
      setStatus(T`เลือกวัตถุที่จะลบก่อน`); return false;
    }
    for (const id of ids) { if (this.data.isLocked(id)) continue; this.renderer.removeNode(id); this.data.removeNode(id); }
    for (const g of groups) { this.renderer.removeGroup(g.gid); this.data.removeGroup(g.gid); }
    this.renderer.discardActiveObject();
    this._renderAll();
    this._snapshot();
    this._showProps('none', null);
    setStatus(T`ลบ ${ids.length + groups.length} ชิ้นแล้ว`);
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
    setStatus(T`ลบแล้ว`);
    return true;
  }

  _duplicateSelected(ids) {
    const src = (ids || this._selectedNodeIds()).map((i) => this.data.getNode(i)).filter(Boolean);
    if (!src.length) { setStatus(T`เลือกวัตถุที่จะทำซ้ำก่อน`); return null; }
    const made = [];
    for (const n of src) {
      const copy = this.data.addNodeRaw({
        ...n, id: uid('pl-'), tags: [...(n.tags || [])],
        x: n.x + 28, y: n.y + 28,
        title: n.title ? n.title + T` (สำเนา)` : n.title,
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
    setStatus(T`ทำซ้ำ ${made.length} ชิ้นแล้ว`);
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
    if (!ids.length) { setStatus(T`เลือกการ์ดก่อน (ลากคลุม / Shift+คลิก) แล้วกด 🗂 จัดกลุ่ม`); return null; }
    const g = this.data.addGroup(name || T`กลุ่มใหม่`, ids, '#d97757');
    this.renderer.discardActiveObject();
    this._renderAll();
    this._snapshot();
    setStatus(T`จัดกลุ่ม "${g.name}" (${ids.length} การ์ด)`);
    return g;
  }

  /** จัดตำแหน่ง/กระจาย สำหรับหลายชิ้น */
  _align(mode, ids) {
    const list = (ids || this._selectedNodeIds()).map((i) => this.data.getNode(i)).filter(Boolean);
    if (list.length < 2) { setStatus(T`เลือกอย่างน้อย 2 ชิ้นก่อน`); return false; }
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
    if (!n) { setStatus(T`เลือกการ์ดก่อน`); return false; }
    if (!n.file) { setStatus(T`การ์ดนี้ยังไม่ได้ผูกไฟล์ — กด "📁 เลือกจากโปรเจกต์" ในแผงคุณสมบัติ`); return false; }
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
      if (n.file) items.push({ label: T`📖 เปิดไฟล์`, click: () => this._onOpenFile && this._onOpenFile(n.file) },
                             { label: T`📂 ชี้ตำแหน่งใน Explorer`, click: () => this._onReveal && this._onReveal(n.file) });
      items.push({ label: T`✏️ แก้ข้อความ`, click: () => this.interaction.editText(n) });
      items.push({ label: T`📁 ผูกไฟล์จากโปรเจกต์…`, click: () => this._pickFileFor(n.id) });
      items.push('-');
      items.push({ label: T`⧉ ทำซ้ำ`, click: () => this._duplicateSelected() });
      items.push('-');
      items.push({ label: T`⬆ ยกไปบนสุด <span style="opacity:.55">Ctrl+Shift+]</span>`, click: () => this.orderSelection('front') });
      items.push({ label: T`↑ ยกขึ้นหนึ่งชั้น <span style="opacity:.55">Ctrl+]</span>`, click: () => this.orderSelection('forward') });
      items.push({ label: T`↓ ลดลงหนึ่งชั้น <span style="opacity:.55">Ctrl+[</span>`, click: () => this.orderSelection('backward') });
      items.push({ label: T`⬇ ส่งไปล่างสุด <span style="opacity:.55">Ctrl+Shift+[</span>`, click: () => this.orderSelection('back') });
      items.push('-');
      items.push({ label: n.locked ? T`🔓 ปลดล็อก` : T`🔒 ล็อก`, click: () => this._commitEdit(n.id, { locked: !n.locked }) });
      items.push({ label: T`🗂 จัดกลุ่มที่เลือก`, click: () => this._createGroupFromSelection() });
      items.push('-');
      items.push({ label: T`🗑 ลบ`, danger: true, click: () => this._deleteSelected() });
    } else if (kind === 'edge') {
      this.selectEdge(id);
      const e = this.data.getEdge(id);
      if (!e) return;
      items.push({ label: T`🏷 แก้ป้ายกำกับ…`, click: () => this._editEdgeLabel(id) });
      items.push({ label: T`⇄ สลับทิศ`, click: () => this._flipEdge(id) });
      for (const [r, label] of [['straight', T`╱ เส้นตรง`], ['orthogonal', T`⌐ หักมุมฉาก`], ['curved', T`⌒ โค้ง`]]) {
        items.push({ label: (e.routing === r ? '● ' : '　') + label, click: () => this._changeEdge(id, { routing: r }) });
      }
      items.push('-');
      items.push({ label: T`🗑 ลบเส้น`, danger: true, click: () => this._deleteEdge(id) });
    } else if (kind === 'group') {
      items.push({ label: T`✏️ เปลี่ยนชื่อกลุ่ม…`, click: async () => {
        const g = this.data.getGroup(id); if (!g) return;
        const v = await ask(T`ชื่อกลุ่ม`, { value: g.name });
        if (v) { g.name = v; this.data.markDirty(); this._renderAll(); this._snapshot(); }
      } });
      items.push({ label: T`🗑 ยุบกลุ่ม`, danger: true, click: () => {
        this.data.removeGroup(id); this.renderer.removeGroup(id); this._renderAll(); this._snapshot();
      } });
    } else {
      items.push({ label: T`📌 โพสต์อิตตรงนี้`, click: () => this._createFromTool('sticky', { x: pt.x, y: pt.y }) });
      items.push({ label: T`🅃 ข้อความตรงนี้`, click: () => this._createFromTool('text', { x: pt.x, y: pt.y }) });
      items.push({ label: T`⬛ รูปทรงตรงนี้`, click: () => this._createFromTool('shape', { x: pt.x, y: pt.y, shape: this.interaction.getShapeKind() }) });
      items.push({ label: T`💬 คอมเมนต์ตรงนี้`, click: () => this._createFromTool('comment', { x: pt.x, y: pt.y }) });
      items.push('-');
      items.push({ label: T`⊡ พอดีจอ`, click: () => this._zoomFit() });
      items.push({ label: this.data.getGrid().show ? T`▦ ซ่อนกริด` : T`▦ แสดงกริด`, click: () => this.setGrid({ show: !this.data.getGrid().show }) });
      items.push({ label: this.data.getGrid().snap ? T`⌗ ปิด snap` : T`⌗ เปิด snap`, click: () => this.setGrid({ snap: !this.data.getGrid().snap }) });
      items.push('-');
      items.push({ label: T`💾 บันทึกกระดาน`, click: () => this.save() });
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
    if (!this._svc.pickFile) { setStatus(T`เลือกไฟล์จากโปรเจกต์ยังไม่พร้อมใช้งาน`); return null; }
    const picked = await this._svc.pickFile();
    if (!picked) return null;
    const props = { file: picked.path };
    const n = this.data.getNode(nodeId);
    if (n && (!n.title || [T`ใหม่`, T`ไม่ระบุชื่อ`, T`ฉากใหม่`].includes(n.title))) props.title = picked.title;
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
    if (this._histIndex <= 0) { setStatus(T`ย้อนกลับไม่ได้แล้ว`); return false; }
    const ok = this._restore(this._histIndex - 1);
    if (ok) setStatus(T`↶ ย้อนกลับ`);
    return ok;
  }

  redo() {
    if (this._histIndex >= this._history.length - 1) { setStatus(T`ทำซ้ำไม่ได้แล้ว`); return false; }
    const ok = this._restore(this._histIndex + 1);
    if (ok) setStatus(T`↷ ทำซ้ำ`);
    return ok;
  }

  // ═════════════════ แผงคุณสมบัติ (บั๊ก 3) ═════════════════
  setPropsCallback(fn) { this._propsCallback = fn; }

  _showProps(mode, data) {
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
      ctx.onConnectFrom = () => { this._pickTool('connector'); setStatus(T`เครื่องมือเส้นเชื่อม: คลิกการ์ดปลายทาง (หรือลากจากจุดสีส้ม)`); };
      ctx.onCenterNode = (id) => this.centerOn(id);
      ctx.onRevealFile = (file) => { if (this._onReveal && file) this._onReveal(file); else setStatus(T`การ์ดนี้ยังไม่ได้ผูกไฟล์`); };
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
    const title = d.title || (d.file ? (String(d.file).split(/[\\/]/).pop() || '').replace(/\.md$/i, '') : T`ใหม่`);
    const dup = d.file && this.data.getAllNodes().find((n) => n.file === d.file);
    if (dup) { this._selectNodes([dup.id]); this.centerOn(dup.id); setStatus(T`"${title}" อยู่บนกระดานแล้ว`); return dup; }
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
    setStatus(T`เพิ่ม "${title}" ลงกระดานแล้ว`);
    this.renderer.refresh();
    return n;
  }

  // ═════════════════ อื่น ๆ ═════════════════
  loadSample() {
    const mk = (o) => this.data.addNodeRaw(o);
    this.data._nodes = []; this.data._edges = []; this.data._groups = [];
    const a = mk({ type: 'scene', title: T`ฉากเปิดเรื่อง`, color: '#3f3e3a', x: 120, y: 140, tags: [T`เปิดเรื่อง`], synopsis: T`ตัวเอกตื่นมาเจอเรื่องผิดปกติ`, status: T`กำลังเขียน` });
    const b = mk({ type: 'scene', title: T`ฉากปะทะ`, color: '#5f7a9f', x: 460, y: 140, tags: [T`จุดหักเห`], synopsis: T`ความจริงถูกเปิดเผยกลางวงสนทนา`, status: T`โครงร่าง` });
    const c = mk({ type: 'entity', title: T`ตัวละครหลัก`, color: '#7a6f9f', x: 290, y: 340 });
    mk({ type: 'sticky', title: '', synopsis: T`อย่าลืมปมเรื่องกุญแจ`, color: '#f2c14e', x: 660, y: 330, width: 160, height: 160 });
    mk({ type: 'shape', shape: 'diamond', title: T`ตัดสินใจ`, color: '#4a6fa5', x: 470, y: 350, width: 170, height: 120 });
    this.data.addEdge(a.id, 'right', b.id, 'left', { label: T`ต่อเนื่อง`, routing: 'curved' });
    this.data.addEdge(c.id, 'top', a.id, 'bottom', { label: T`ปรากฏใน`, routing: 'orthogonal', arrowEnd: 'triangle' });
    this.data.markDirty();
    this._renderAll();
    this._snapshot();
    this._zoomFit();
    setStatus(T`ใส่ตัวอย่างแล้ว — กด 💾 ถ้าจะเก็บไว้`);
  }

  _autoLayout() {
    const ns = this.data.getAllNodes().filter((n) => n.type !== 'frame');
    if (ns.length < 2) { setStatus(T`ต้องมีอย่างน้อย 2 การ์ด`); return false; }
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
    setStatus(T`จัดเรียงอัตโนมัติแล้ว`);
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
      setStatus(T`🖼 บันทึกรูปกระดานแล้ว: ` + (typeof name === 'string' ? name : 'planner.png'));
      return true;
    } catch (e) { setStatus(T`ส่งออก PNG ไม่ได้: ` + e.message); return false; }
  }

  _fit() {
    // แผงเตี้ยมาก ๆ ให้ยุบแถบรอง ๆ ทิ้งก่อน เหลือแถบเครื่องมือกับกระดาน (บั๊ก 65r5 "ย่อไม่สุด")
    const paneH = this.pane.clientHeight;
    if (paneH) {
      this.pane.classList.toggle('planner-compact', paneH < 190);
      this.pane.classList.toggle('planner-mini', paneH < 120);
    }
    const r = this.stage.getBoundingClientRect();
    if (!r.width || !r.height) {
      log('warn', T`planner: _fit ข้าม — เวทีกระดานยังไม่มีขนาด (แผงถูกซ่อนอยู่?)`);
      return false;
    }
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
    const t = el('div', 'k-dlg-title', T`📋 เปิดกระดานวางแผน`);
    const list = el('div', 'planner-board-list');
    for (const b of boards) {
      const row = el('div', 'planner-board-row' + (b.path === currentPath ? ' current' : ''));
      row.append(el('span', 'planner-board-ic', b.path === currentPath ? '●' : '📋'),
                 el('span', 'planner-board-nm', b.name));
      row.onclick = () => { ov.remove(); resolve(b.path); };
      row.ondblclick = row.onclick;
      list.appendChild(row);
    }
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', 'k-cancel', T`ยกเลิก`);
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
  return String(s || T`กระดาน`).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || T`กระดาน`;
}
