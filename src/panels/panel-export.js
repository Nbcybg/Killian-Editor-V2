// panel-export.js — ประกอบ "รายงานการจัดวางแผง" สำหรับส่งออกเป็นไฟล์ JSON
// บริสุทธิ์ 100% (ไม่แตะ DOM / ไม่แตะ kapi) → ทดสอบด้วย node ได้ · ตัววัด DOM + เซฟไฟล์อยู่ที่ panel-ui.js
//
// ทำไมต้องมี: ต้นไม้เลย์เอาต์ดิบ (`k2-panel-layout`) บอกแค่ "โครง" ไม่ได้บอกว่า
//   · ค่าขนาดที่เก็บไว้ (pxW/pxH/sizes) **ถูกใช้จริงตอนวาดไหม**
//   · ตอนนั้นบนจอแต่ละแผงกว้างเท่าไหร่จริง ๆ
// รายงานนี้จึงรวม 3 ชั้นเข้าด้วยกัน: ต้นไม้ที่เก็บไว้ + ขนาดที่วัดได้จริง + ผลวินิจฉัยว่าใครไม่มีค่าเก็บ
// เอาไปใช้เป็น "เลย์เอาต์อ้างอิง" ได้ตรง ๆ (จัดวางให้พอใจ → ส่งออก → ใช้ค่าที่ได้เป็นค่าตั้งต้น)
import * as PL from './panel-layout.js';

export const EXPORT_VERSION = 1;
export const EXPORT_KIND = 'killian2-panel-layout';

/** ขนาดที่ "เก็บติดตัวโหนด" ไว้ (0 = ไม่เคยเก็บ) — ตัววาดอ่านค่าจากตรงนี้เท่านั้น */
export function storedPx(node) {
  return { w: PL.nodePx(node, true), h: PL.nodePx(node, false) };
}

/**
 * สรุป dock หนึ่งก้อน: โหมดที่ใช้วาดจริง + ลูกทุกตัวพร้อมค่าที่เก็บไว้และค่าที่วัดได้
 * mode: 'px'    = มีลูกอย่างน้อยหนึ่งตัวถูกตรึงความกว้างเป็น px (ตัวยืดดูดที่เหลือ)
 *       'ratio' = แบ่งตามสัดส่วนทั้งก้อน — **ค่า px ที่เก็บไว้ในลูกไม่มีผลใด ๆ**
 */
export function dockReport(node, isFixedPanel = () => false, measured = {}, docsId = 'docs') {
  const row = node.dir === 'row';
  const shares = PL.dockShares(node, isFixedPanel, docsId);
  const kids = node.children || [];
  const flexIdx = PL.flexChildIndex(node, docsId);
  const children = kids.map((k, i) => {
    const sh = shares[i];
    const px = storedPx(k);
    return {
      id: k.id, type: k.type,
      label: labelOf(k),
      hidden: PL.nodeHidden(k) || undefined,
      share: sh ? sh.kind : 'hidden',
      grow: sh && sh.kind === 'grow' ? +sh.grow.toFixed(4) : undefined,
      sharePx: sh && sh.kind === 'px' ? sh.px : undefined,
      storedPx: (px.w || px.h) ? px : null,
      size: node.sizes && Number.isFinite(node.sizes[i]) ? node.sizes[i] : null,
      measured: measured[k.id] || null,
    };
  });
  const mode = children.some((c) => c.share === 'px') ? 'px' : 'ratio';
  return {
    id: node.id, dir: node.dir, mode,
    flexChild: flexIdx >= 0 ? (kids[flexIdx] || {}).id || null : null,
    sizes: node.sizes || null,
    measured: measured[node.id] || null,
    children,
  };
}
function labelOf(n) { return n.title || (n.type === 'tabs' ? 'กลุ่มแท็บ' : n.type === 'dock' ? 'ช่องแบ่ง' : n.id); }

/** dock ทุกก้อนในต้นไม้ (เรียงจากนอกเข้าใน) */
export function collectDocks(root, isFixedPanel, measured, docsId = 'docs') {
  const out = [];
  if (!root) return out;
  PL.walk(root, (n) => { if (n && n.type === 'dock') out.push(dockReport(n, isFixedPanel, measured, docsId)); });
  return out;
}

/**
 * โหนดที่ "เป็นลูกของ dock แต่ไม่มีขนาดให้ใช้เลย" — ทั้งของตัวเองและของลูกข้างใน
 *
 * ลูกของ dock เป็น `tabs`/`dock` ได้ (เลย์เอาต์ตั้งต้นฝั่งซ้ายเป็นกลุ่มแท็บ) แต่ระบบเก็บขนาดไว้ที่
 * โหนดชนิด `panel` เป็นหลัก · ตั้งแต่ alpha.66r9 ตัววาดอ่านแบบมองทะลุคอนเทนเนอร์แล้ว
 * (`nodePxDeep`) รายการนี้จึงเหลือเฉพาะก้อนที่ **ไม่มีค่าให้ใช้จริง ๆ** = ยังต้องแบ่งตามสัดส่วน
 * `ownPx` บอกว่าค่ามาจากตัวเองหรือถูกดึงมาจากลูก — ใช้ตรวจว่าค่าที่ตั้งไว้ไปอยู่ถูกที่ไหม
 */
export function unsizedDockChildren(root, isFixedPanel = () => false) {
  const out = [];
  if (!root) return out;
  PL.walk(root, (n) => {
    if (!n || n.type !== 'dock') return;
    const row = n.dir === 'row';
    const flexIdx = PL.flexChildIndex(n);
    (n.children || []).forEach((k, i) => {
      if (i === flexIdx || PL.nodeHidden(k)) return;                 // ตัวยืดไม่ต้องมีขนาดของตัวเอง
      if (k.type === 'panel' && isFixedPanel(k.id)) return;          // แถบเครื่องมือ/แถบสถานะ
      if (PL.nodePxDeep(k, row) > 0) return;
      out.push({ dock: n.id, dir: n.dir, id: k.id, type: k.type, ownPx: PL.nodePx(k, row) });
    });
  });
  return out;
}

/** ลูกของ dock ที่ขนาด "ถูกดึงมาจากลูกข้างใน" (ตัวมันเองยังไม่มีค่า) — ไว้ดูว่าค่าไปอยู่ที่ไหน */
export function derivedSizeNodes(root) {
  const out = [];
  if (!root) return out;
  PL.walk(root, (n) => {
    if (!n || n.type !== 'dock') return;
    const row = n.dir === 'row';
    (n.children || []).forEach((k) => {
      if (k.type === 'panel' || PL.nodeHidden(k)) return;
      if (PL.nodePx(k, row) > 0) return;
      const deep = PL.nodePxDeep(k, row);
      if (deep > 0) out.push({ dock: n.id, id: k.id, type: k.type, derivedPx: deep,
        from: PL.panelIds(k).filter((id) => PL.nodePx(PL.findPanel(k, id), row) > 0) });
    });
  });
  return out;
}

/** คำเตือนที่อ่านแล้วรู้เลยว่า "ทำไมเลย์เอาต์ถึงเพี้ยน" */
export function diagnose(root, docks, unsized, measured = {}, docsId = 'docs') {
  const warn = [];
  for (const d of docks) {
    const holdsDocs = !!d.flexChild;
    // เตือนเฉพาะ dock ที่ **มีเพื่อนบ้านของพื้นที่เขียน** แต่ยังแบ่งตามสัดส่วน
    // (dock ที่มีลูกยืดได้ตัวเดียว เช่นแถวกลางระหว่างแถบเครื่องมือ/แถบสถานะ เป็นสัดส่วนอยู่แล้วโดยธรรมชาติ)
    // [alpha.66r11] ลูกที่ถูกซ่อนอยู่ไม่ถูกวาด จึงไม่มีทางแย่งพื้นที่กับใคร — ต้องไม่นับ
    // (เลย์เอาต์จริงของผู้ใช้โดนเตือน 50/50 ทั้งที่กลุ่มนั้นปิดอยู่ และมี pxH เก็บไว้เรียบร้อยแล้ว)
    const live = d.children.filter((c) => c.share !== 'hidden' && !c.hidden);
    const hasRatioNeighbour = live.some((c) => c.share === 'grow' && c.id !== d.flexChild);
    if (holdsDocs && d.mode === 'ratio' && hasRatioNeighbour) {
      warn.push(`dock ${d.id} (${d.dir}) อยู่ในโหมดสัดส่วน ทั้งที่มีพื้นที่เขียนอยู่ข้างใน — `
        + 'ค่าขนาดที่เก็บไว้ในลูกยังไม่ถูกใช้ · แผงข้างจะถูกเกลี่ยใหม่ทุกครั้งที่เปิด/ผนึกแผงอื่น');
    }
    if (holdsDocs && hasRatioNeighbour && Array.isArray(d.sizes) && d.sizes.length === 2
        && Math.abs(d.sizes[0] - 0.5) < 0.001 && Math.abs(d.sizes[1] - 0.5) < 0.001) {
      warn.push(`dock ${d.id} แบ่ง 50/50 กับพื้นที่เขียน — แผงที่เพิ่งผนึกกินครึ่งหน้าต่าง`);
    }
  }
  for (const u of unsized) {
    if (u.type === 'panel') continue;                       // แผงเดี่ยวที่ยังไม่เคยลาก = ปกติ
    warn.push(`${u.type === 'tabs' ? 'กลุ่มแท็บ' : 'ช่องแบ่ง'} ${u.id} ใน dock ${u.dock} `
      + 'ไม่มีขนาดให้ใช้เลย (ทั้งของตัวเองและของแผงข้างใน) — ก้อนนี้จะถูกเกลี่ยตามสัดส่วนใหม่ทุกครั้งที่โครงเปลี่ยน');
  }
  for (const [id, m] of Object.entries(measured)) {
    if (!m || !m.w) continue;
    if (id === docsId && m.w < PL.MIN_CANVAS_PX) warn.push(`พื้นที่เขียนกว้างแค่ ${m.w}px (ขั้นต่ำที่ตั้งไว้ ${PL.MIN_CANVAS_PX}px)`);
    else if (m.kind === 'panel' && id !== docsId && m.w < PL.MIN_PANEL_PX) warn.push(`แผง ${id} กว้างแค่ ${m.w}px (ขั้นต่ำ ${PL.MIN_PANEL_PX}px) — เนื้อแผงถูกบีบจนแทบไม่เหลือที่`);
  }
  return warn;
}

/**
 * ประกอบรายงานฉบับเต็ม
 * @param {object} input
 *   layout    {root, floats, splitRatios}  — จาก PanelManager.layout()
 *   defs      [{id,title,defaultSide,dockW,dockH,fixed,closable,floatable}] — ทะเบียนแผง
 *   state     {open:[], hidden:[], floating:[]}
 *   measured  { <nodeId>: {kind,w,h,x,y,flex,cls} } — ขนาดจริงบนจอ (panel-ui วัดให้)
 *   homes / workspaces / gaps / viewport / app
 */
export function buildLayoutReport(input = {}) {
  const layout = input.layout || {};
  const root = layout.root || null;
  const defs = input.defs || [];
  const fixedIds = new Set(defs.filter((d) => d.fixed).map((d) => d.id));
  const isFixedPanel = (id) => fixedIds.has(id);
  const measured = input.measured || {};
  const docks = collectDocks(root, isFixedPanel, measured);
  const unsized = unsizedDockChildren(root, isFixedPanel);
  return {
    kind: EXPORT_KIND,
    exportVersion: EXPORT_VERSION,
    savedAt: input.savedAt || new Date().toISOString(),
    app: input.app || null,
    viewport: input.viewport || null,
    layout: {
      version: layout.version ?? null,
      root,
      floats: layout.floats || [],
      splitRatios: layout.splitRatios || {},
    },
    homes: input.homes || {},
    workspaces: input.workspaces || {},
    panels: defs.map((d) => ({
      id: d.id, title: d.title, defaultSide: d.defaultSide || 'left',
      dockW: d.dockW || null, dockH: d.dockH || null,
      fixed: !!d.fixed, closable: d.closable !== false, floatable: d.floatable !== false,
      open: !!(input.state && (input.state.open || []).includes(d.id)),
      hidden: !!(input.state && (input.state.hidden || []).includes(d.id)),
      floating: !!(input.state && (input.state.floating || []).includes(d.id)),
      measured: measured[d.id] || null,
    })),
    diagnostics: {
      docks,
      unsizedDockChildren: unsized,
      derivedSizes: derivedSizeNodes(root),
      gaps: input.gaps || [],
      warnings: diagnose(root, docks, unsized, measured),
    },
  };
}

/** ข้อความไฟล์ที่จะเขียนลงดิสก์ */
export function reportToJson(report) { return JSON.stringify(report, null, 2); }

/** ชื่อไฟล์ตั้งต้น — มีเวลาในชื่อ จะได้ส่งออกหลายครั้งโดยไม่ทับกัน */
export function defaultExportName(title = '') {
  const ts = new Date();
  const p = (v) => String(v).padStart(2, '0');
  const stamp = `${ts.getFullYear()}${p(ts.getMonth() + 1)}${p(ts.getDate())}-${p(ts.getHours())}${p(ts.getMinutes())}`;
  const safe = String(title || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  return `${safe ? safe + '-' : ''}panel-layout-${stamp}.json`;
}
