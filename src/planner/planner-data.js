// planner-data.js — Data layer (บริสุทธิ์) สำหรับ Planner v4
// ไม่ import DOM, Fabric.js, หรือ core.js — ใช้แค่ num.js  (unit test ได้ตรง ๆ)
import { T } from '../i18n.js';
import { num, numClamp, numInt } from '../num.js';

export const CARD_W = 180, CARD_H = 110;
export const STICKY_W = 160, STICKY_H = 160;
export const FRAME_W = 640, FRAME_H = 420;

// ชนิดโหนด — 5 ตัวแรกคือการ์ดผูกเนื้อเรื่อง, ที่เหลือคือเครื่องมือกระดานแบบ Miro
export const NODE_TYPES = ['scene', 'chapter', 'entity', 'note', 'sticky', 'text', 'shape', 'frame', 'comment'];
export const CARD_TYPES = ['scene', 'chapter', 'entity', 'note'];
export const ICONS = {
  scene: '📄', chapter: '📁', entity: '👤', note: '📝', sticky: '📌',
  text: '🆃', shape: '⬛', frame: '🖼', comment: '💬',
};
export const SHAPES = ['rect', 'round', 'ellipse', 'diamond', 'triangle', 'star', 'arrow', 'cylinder'];

export const STATUSES = ['', 'โครงร่าง', 'กำลังเขียน', 'ตรวจแล้ว', 'เสร็จแล้ว', 'พัก'];
export const STATUS_COLOR = {
  'โครงร่าง': '#6b6b6b', 'กำลังเขียน': '#d97757', 'ตรวจแล้ว': '#5f7a9f',
  'เสร็จแล้ว': '#5f8a6f', 'พัก': '#7a6f9f',
};

export const EDGE_STYLES = ['solid', 'dashed', 'dotted'];
export const EDGE_ROUTINGS = ['straight', 'orthogonal', 'curved'];
export const ARROW_HEADS = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'];
export const PORT_POSITIONS = ['top', 'right', 'bottom', 'left', 'auto'];

export const GRID_STYLES = ['dots', 'lines', 'cross'];
export const DEFAULT_GRID = { show: true, size: 20, snap: false, style: 'dots', color: '#3a3936', opacity: 0.9 };
export const DEFAULT_BG = '#262624';

/** ค่าเริ่มต้นของแต่ละชนิดโหนด — ใช้ตอนสร้างใหม่ (เครื่องมือแบบ Miro) */
export const TYPE_DEFAULTS = {
  scene:   { width: CARD_W, height: CARD_H, color: '#3f3e3a', textColor: '#faf9f5', fontSize: 12.5 },
  chapter: { width: CARD_W, height: CARD_H, color: '#5f7a9f', textColor: '#faf9f5', fontSize: 12.5 },
  entity:  { width: CARD_W, height: CARD_H, color: '#7a6f9f', textColor: '#faf9f5', fontSize: 12.5 },
  note:    { width: CARD_W, height: CARD_H, color: '#5f8a6f', textColor: '#faf9f5', fontSize: 12.5 },
  sticky:  { width: STICKY_W, height: STICKY_H, color: '#f2c14e', textColor: '#1a1815', fontSize: 13 },
  text:    { width: 220, height: 40, color: 'transparent', textColor: '#faf9f5', fontSize: 18 },
  shape:   { width: 180, height: 130, color: '#4a6fa5', textColor: '#faf9f5', fontSize: 13, shape: 'rect' },
  frame:   { width: FRAME_W, height: FRAME_H, color: '#d97757', textColor: '#d97757', fontSize: 13 },
  comment: { width: 210, height: 96, color: '#e8e3d3', textColor: '#26241f', fontSize: 12 },
};

let _uidSeq = 0;
export function uid(prefix) {
  _uidSeq = (_uidSeq + 1) % 46656;
  return prefix + Date.now().toString(36) + _uidSeq.toString(36) + Math.random().toString(36).slice(2, 5);
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
    title: title != null ? title : T`ใหม่`,
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
  };
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
    this._settings = { grid: { ...DEFAULT_GRID }, background: DEFAULT_BG, viewport: { x: 0, y: 0, zoom: 1 } };
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
    return base === 'planner' ? T`กระดานหลัก` : base;
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
      name: g.name || T`กลุ่ม`,
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
      title: n.title != null ? n.title : T`ไม่ระบุชื่อ`,
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
    };
  }

  _exportData() {
    return {
      version: '4.0',
      settings: {
        grid: { ...this._settings.grid },
        background: this._settings.background,
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
      settings: data.settings || { grid: { ...DEFAULT_GRID }, background: DEFAULT_BG, viewport: { x: 0, y: 0, zoom: 1 } },
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

  /** ปัดค่าเข้ากริดถ้าเปิด snap ไว้ */
  snapValue(v) {
    const g = this._settings.grid;
    return g.snap ? snapTo(v, g.size) : v;
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
      id: uid('gp-'), name: name || T`กลุ่ม`, color: color || '#d97757',
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
    return { kind: 'line', points: dedupePoints(pts), start: a, end: b };
  }
  return { kind: 'line', points: [a, b], start: a, end: b };
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
