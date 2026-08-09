// panel-renderer.js — วาด layout tree ของ PanelManager ลง DOM จริง (Photoshop-style)
// บริสุทธิ์ในแง่ "อ่าน tree → สร้าง DOM" — ทุกการเปลี่ยนโครงสร้างสั่งผ่าน PanelManager เท่านั้น
//
//   renderPanelLayout(container, pm, opts)
//     opts = { meta:Map<id,{title,icon,fixed,noHead}>, renderPanelBody(id, host), headExtras(id)→[el] }
//
// กติกา (ข้อ 13 ของสเปก):
//   · เนื้อแผง (#tree-panel, #content, …) ถูก "ย้ายเข้า" host เท่านั้น ห้ามสร้างใหม่ → โค้ดเก่ายังอ้าง id ได้
//   · ลาก resize/float ไม่ยิง re-render ระหว่างลาก (จะทำให้ ProseMirror ถูกถอด-ใส่ 60 ครั้ง/วินาที)
//     → ปรับ style สดตอนลาก แล้ว commit ลง store ครั้งเดียวตอนปล่อย
import { el } from '../core.js';
import { popupMenu } from '../ui.js';        // [60r3 ข้อ 8] เมนูคลิกขวาบนหัวแผง
import { iconHtml, hasIcon } from '../icons.js';
import * as PL from './panel-layout.js';
import { makePanelDraggable, makeTabDraggable, makeFloatDraggable, createDropOverlay,
         clampFloat, FLOAT_MIN_W, FLOAT_MIN_H } from './panel-drag.js';

export { createDropOverlay };

// ───────── entry ─────────
export function renderPanelLayout(container, pm, opts = {}) {
  if (!container) return;
  container.innerHTML = '';
  const root = pm.store.root;
  if (root) {
    const tree = renderNode(root, pm, opts, 0);
    if (tree) { tree.classList.add('k-panel-root'); container.appendChild(tree); }
  }
  for (const f of pm.store.floats || []) renderFloatPanel(f, pm, opts, container);
  markDocsChain(container);
  return container;
}

export function renderNode(node, pm, opts, depth) {
  if (!node) return null;
  switch (node.type) {
    case 'dock':  return renderDock(node, pm, opts, depth);
    case 'tabs':  return renderTabs(node, pm, opts, depth);
    case 'panel': return renderPanel(node, pm, opts, depth);
    default:      return null;
  }
}

// meta ของแผง (title/icon/fixed/noHead) — registry ของ PanelManager เก็บแค่บางฟิลด์ จึงส่งมาทาง opts
function metaOf(opts, id) {
  const m = opts.meta;
  const v = m && (typeof m.get === 'function' ? m.get(id) : m[id]);
  return v || {};
}
// โหนดนี้กินพื้นที่คงที่ไหม (toolbar/statusbar) — dock จะไม่ยืดและไม่มีที่จับปรับขนาด
function isFixed(node, opts) {
  return node && node.type === 'panel' && !!metaOf(opts, node.id).fixed;
}

// ───────── dock: flex container + ที่จับปรับสัดส่วน ─────────
function renderDock(node, pm, opts, depth) {
  const box = el('div', 'k-dock');
  box.dataset.dockId = node.id;
  box.dataset.dir = node.dir === 'row' ? 'row' : 'col';
  const kids = node.children || [];
  // [alpha.62 บั๊ก 21] แผงที่ถูกปิดยังอยู่ในต้นไม้ (ติดธง hidden) เพื่อไม่ให้สล็อต/ขนาดหาย
  // → ตัววาดต้องข้ามมันทุกที่: ไม่วาด · ไม่นับใน growSum · ไม่มีที่จับข้าง ๆ
  //   (ถ้านับใน growSum แผงที่เหลือจะได้พื้นที่ไม่ครบ = มีช่องว่างเปล่าค้างอยู่)
  const shown = [];
  for (let i = 0; i < kids.length; i++) if (!PL.nodeHidden(kids[i])) shown.push(i);
  // ปรับ flex-grow ของลูกที่ "ยืดได้" ให้รวมกันเป็น 1 เสมอ
  // (ถ้า dock นี้มีลูกแบบ fixed ปนอยู่ ผลรวมของลูกที่ยืดได้จะ < 1
  //  แล้วพื้นที่ว่างที่เหลือจะไม่ถูกแจกให้ใคร → แผงเตี้ยผิดปกติ)
  const growSum = shown.reduce((a, i) => a + (isFixed(kids[i], opts) ? 0 : (node.sizes?.[i] ?? 1)), 0) || 1;
  for (let s = 0; s < shown.length; s++) {
    const i = shown[s];
    const childEl = renderNode(kids[i], pm, opts, depth + 1);
    if (!childEl) continue;
    if (isFixed(kids[i], opts)) {
      childEl.style.flex = '0 0 auto';
    } else {
      childEl.style.flexGrow = String((node.sizes?.[i] ?? 1) / growSum);
      childEl.style.flexShrink = '1';
      childEl.style.flexBasis = '0%';
    }
    box.appendChild(childEl);
    // ที่จับอยู่ระหว่างลูกสองตัวที่ "ยืดได้" ทั้งคู่ และต้องเป็นตัวที่ **เห็นอยู่** ทั้งคู่
    const nextIdx = shown[s + 1];
    if (nextIdx !== undefined && !isFixed(kids[i], opts) && !isFixed(kids[nextIdx], opts)) {
      // ดัชนีที่ส่งให้ resizeDock ต้องเป็นดัชนี "ในต้นไม้" ไม่ใช่ลำดับที่เห็นบนจอ
      box.appendChild(createResizeHandle(node.id, i, node.dir, pm, nextIdx));
    }
  }
  return box;
}

// ───────── tab group ─────────
// วาด "ทุกแท็บ" ลง DOM เสมอ (ซ่อนตัวที่ไม่ active) — โค้ดเก่าพึ่ง element id ที่ต้องอยู่ใน DOM ตลอด
function renderTabs(node, pm, opts, depth) {
  const box = el('div', 'k-tab-group');
  box.dataset.tabsId = node.id;
  const strip = !!node.collapsed;                    // ย่อเป็นแถบไอคอน (icon strip)
  if (strip) box.classList.add('icon-strip');

  const bar = el('div', 'k-tab-bar' + (strip ? ' k-vertical' : ''));
  const kids = node.children || [];
  // [alpha.62 บั๊ก 21] แท็บที่ถูกปิดยังอยู่ในกลุ่ม (ติดธง hidden) — ไม่วาดหัวแท็บและไม่วาดเนื้อ
  // แต่ยัง "จองที่" ไว้ในลำดับเดิม → เปิดกลับแล้วอยู่ตำแหน่งเดิมในแถบแท็บ ไม่ไปต่อท้าย
  const isHid = (k) => PL.nodeHidden(k);
  // แท็บที่ active อาจเป็นตัวที่ถูกซ่อนอยู่ → เลื่อนไปตัวที่เห็นได้ตัวแรก ไม่งั้นกลุ่มนี้ว่างเปล่า
  let active = Math.max(0, Math.min(node.active | 0, kids.length - 1));
  if (kids[active] && isHid(kids[active])) {
    const firstShown = kids.findIndex((k) => !isHid(k));
    if (firstShown >= 0) active = firstShown;
  }

  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (isHid(child)) continue;
    const md = metaOf(opts, child.id);
    const tab = el('div', 'k-tab' + (i === active ? ' active' : ''));
    tab.dataset.index = String(i);
    tab.dataset.panelId = child.id;
    tab.appendChild(iconSpan(md.icon, 'k-tab-icon'));
    tab.appendChild(el('span', 'k-tab-title', md.title || child.title || child.id));
    tab.title = md.title || child.title || child.id;
    tab.onclick = () => {
      if (strip) { toggleStrip(node.id, pm, false); pm.activatePanel(child.id); return; }
      pm.activatePanel(child.id);
    };
    makeTabDraggable(tab, child.id, node.id, i, pm, { host: opts.host });
    bar.appendChild(tab);
  }
  // ปุ่มย่อกลุ่มแท็บเป็นแถบไอคอน
  const strBtn = el('span', 'k-panel-btn k-strip-btn', strip ? '»' : '«');
  strBtn.title = strip ? 'คลี่กลุ่มแท็บ' : 'ย่อเป็นแถบไอคอน';
  strBtn.onclick = (e) => { e.stopPropagation(); toggleStrip(node.id, pm, !strip); };
  bar.appendChild(strBtn);
  box.appendChild(bar);

  const body = el('div', 'k-tab-content');
  for (let i = 0; i < kids.length; i++) {
    if (isHid(kids[i])) continue;
    const panelEl = renderNode(kids[i], pm, opts, depth + 1);
    if (!panelEl) continue;
    panelEl.classList.add('k-tabbed');
    if (i !== active) panelEl.classList.add('k-tab-hidden');
    body.appendChild(panelEl);
  }
  box.appendChild(body);
  return box;
}

// ย่อ/คลี่กลุ่มแท็บ — ติดธงบนโหนด tabs โดยตรง (engine clone ผ่าน JSON จึงพาฟิลด์นี้ไปด้วย)
function toggleStrip(tabsId, pm, on) {
  const root = pm.store.root;
  if (!root) return;
  const next = JSON.parse(JSON.stringify(root));
  PL.walk(next, (n) => { if (n.type === 'tabs' && n.id === tabsId) n.collapsed = !!on; });
  pm.store.update(next);
}

// ───────── panel: หัว + เนื้อ ─────────
function renderPanel(node, pm, opts, depth) {
  const md = metaOf(opts, node.id);
  const box = el('div', 'k-panel');
  box.dataset.panelId = node.id;
  if (md.cls) box.classList.add(md.cls);
  if (node.collapsed) box.classList.add('k-collapsed');
  if (md.fixed) box.classList.add('k-panel-fixed');
  if (md.noHead) box.classList.add('k-panel-nohead');
  else {
    const head = buildHead(node, pm, opts, md, false);
    box.appendChild(head);
    // ลากหัวแผง → ผนึกที่อื่น / รวมเป็นแท็บ / ลอยออกมา
    makePanelDraggable(head, node.id, pm, { host: opts.host, ghostLabel: md.title || node.title || node.id });
  }
  box.appendChild(buildBody(node, opts));
  return box;
}

function buildHead(node, pm, opts, md, floating) {
  const head = el('div', 'k-panel-head');
  head.appendChild(iconSpan(md.icon, 'k-panel-head-icon'));
  head.appendChild(el('span', 'k-panel-head-title', md.title || node.title || node.id));

  // ปุ่มเสริมที่โมดูลอื่นฝากไว้ (🔄 รีเฟรช, 🔍 ค้นหา, ¶ beats) — element เดิมถูกใช้ซ้ำทุกรอบ render
  const ctrls = el('span', 'k-panel-ctrls');
  const extras = opts.headExtras ? (opts.headExtras(node.id) || []) : [];
  for (const b of extras) ctrls.appendChild(b);
  head.appendChild(ctrls);

  const btns = el('span', 'k-panel-btns');
  const def = pm.registry.get(node.id) || {};
  for (const b of PL.PANEL_BUTTONS) {
    if (b.key === 'close' && def.closable === false) continue;
    if (b.key === 'float' && def.floatable === false) continue;
    const btn = el('span', 'k-panel-btn k-panel-btn-' + b.key,
                   b.key === 'float' && floating ? '⊡' : (b.key === 'collapse' && node.collapsed ? '▸' : b.icon));
    btn.title = b.title;
    btn.dataset.act = b.key;
    btn.onclick = (e) => {
      e.stopPropagation();
      if (b.key === 'collapse') pm.collapsePanel(node.id);
      else if (b.key === 'close') pm.hidePanel(node.id);
      else if (b.key === 'float') {
        if (floating) {                              // ผนึกกลับ: อ้าง 'docs' เป็นหลัก (ไม่งั้นไปเกาะแถบเครื่องมือ)
          const anchor = pm.isDocked(opts.dockAnchor || 'docs') ? (opts.dockAnchor || 'docs') : undefined;
          pm.dockPanel(node.id, def.defaultSide || 'left', anchor);
          return;
        }
        const host = e.target.closest('.k-panel');
        const r = host ? host.getBoundingClientRect() : { left: 90, top: 90, width: 320, height: 300 };
        pm.floatPanel(node.id, clampFloat({ x: r.left, y: r.top, w: r.width, h: r.height }));
      }
    };
    btns.appendChild(btn);
  }
  head.appendChild(btns);
  // [alpha.60r3 ข้อ 8] คลิกขวาบนหัวแผง → "❔ นี่คืออะไร" + คำสั่งของแผงนั้น
  head.oncontextmenu = (e) => {
    e.preventDefault(); e.stopPropagation();
    popupMenu(e.clientX, e.clientY, headMenuItems(node, pm, opts, md, floating));
  };
  return head;
}

/**
 * [alpha.60r3 ข้อ 8] รายการเมนูคลิกขวาของหัวแผง
 * แถวคำอธิบายเป็น `{disabled:true}` — popupMenu รองรับแถวที่กดไม่ได้อยู่แล้ว (alpha.48)
 * ตัดเป็นบรรทัดสั้น ๆ เพราะเมนู native-like ไม่ตัดคำเอง คำอธิบายยาวจะล้นออกนอกจอ
 */
export function headMenuItems(node, pm, opts, md, floating) {
  const def = pm.registry.get(node.id) || {};
  const title = md.title || node.title || node.id;
  const items = [{ label: '❔ นี่คืออะไร — <b>' + escapeHtml(title) + '</b>', disabled: true }];
  for (const line of wrapDesc(md.desc || '')) items.push({ label: '<span class="dim">' + escapeHtml(line) + '</span>', disabled: true });
  items.push('-');
  if (def.closable !== false) {
    items.push({ label: (node.collapsed ? '▸ คลี่แผง' : '▾ พับแผง'), click: () => pm.collapsePanel(node.id) });
  }
  if (def.floatable !== false) {
    items.push({ label: floating ? '⊡ ผนึกกลับเข้าหน้าต่าง' : '⧉ ลอยแผงออกมา',
      click: () => {
        if (floating) { const a = pm.isDocked('docs') ? 'docs' : undefined; pm.dockPanel(node.id, def.defaultSide || 'left', a); return; }
        pm.floatPanel(node.id, clampFloat({ x: 90, y: 90, w: 340, h: 320 }));
      } });
  }
  if (def.closable !== false) {
    items.push('-');
    items.push({ label: '✕ ปิดแผง (เปิดกลับที่ มุมมอง → แผง)', click: () => pm.hidePanel(node.id) });
  }
  return items;
}

/** ตัดคำอธิบายเป็นบรรทัดละไม่เกิน ~52 ตัวอักษร โดยไม่ตัดกลางคำอังกฤษ */
export function wrapDesc(desc, width = 52) {
  const s = String(desc || '').trim();
  if (!s) return [];
  const out = [];
  let line = '';
  for (const w of s.split(' ')) {
    if (!line) { line = w; continue; }
    if ((line + ' ' + w).length > width) { out.push(line); line = w; } else line += ' ' + w;
  }
  if (line) out.push(line);
  return out.slice(0, 6);                    // ยาวเกินนี้เมนูจะสูงเกินจอ
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildBody(node, opts) {
  const body = el('div', 'k-panel-body');
  if (opts.renderPanelBody) {
    const content = opts.renderPanelBody(node.id, body);
    if (content && content !== body && content.parentNode !== body) body.appendChild(content);
  }
  return body;
}

function iconSpan(name, cls) {
  const s = el('span', cls);
  if (name && hasIcon(name)) s.innerHTML = iconHtml(name, 14);
  else if (name) s.textContent = name;               // อีโมจิ/ตัวอักษรก็ใช้ได้
  return s;
}

// ───────── floating panel ─────────
export function renderFloatPanel(f, pm, opts, container) {
  const p = f.panel;
  const md = metaOf(opts, p.id);
  const pop = el('div', 'k-float-panel');
  pop.dataset.panelId = p.id;
  // 0.56a #7: เลย์เอาต์ที่บันทึกไว้อาจอยู่นอกจอ (ย่อหน้าต่าง/ย้ายจอ) → หนีบทุกครั้งที่วาด
  const box = clampFloat({ x: f.x ?? 80, y: f.y ?? 80, w: f.w ?? 360, h: f.h ?? 260 });
  pop.style.left = box.x + 'px';
  pop.style.top = box.y + 'px';
  pop.style.width = box.w + 'px';
  pop.style.height = box.h + 'px';
  if (p.collapsed) pop.classList.add('k-collapsed');

  const head = buildHead(p, pm, opts, md, true);
  pop.appendChild(head);
  pop.appendChild(buildBody(p, opts));

  const grip = el('div', 'k-panel-resize');
  makeResizable(pop, grip, (w, h, x, y) => pm.moveFloat(p.id, { w, h, x, y }));
  pop.appendChild(grip);

  makeFloatDraggable(head, pop, p.id, pm, { host: opts.host });
  // ยกขึ้นบนสุดด้วยการย้าย DOM ไม่ใช่ re-render — re-render ระหว่าง mousedown จะถอด pop
  // ที่ drag/resize กำลังอ้างถึงออกจากหน้า แล้ว offsetLeft/Width กลายเป็น 0 ตอนปล่อยเมาส์
  pop.addEventListener('mousedown', () => {
    const par = pop.parentNode;
    if (par) {
      // ยกเหนือ "แผงลอยตัวอื่น" เท่านั้น — ไม่แซง dialog/เมนูที่ต่อท้ายอยู่ใน container เดียวกัน
      let sib = pop.nextElementSibling, lastFloat = null;
      while (sib) {
        if (sib.classList && sib.classList.contains('k-float-panel')) lastFloat = sib;
        sib = sib.nextElementSibling;
      }
      if (lastFloat) par.insertBefore(pop, lastFloat.nextSibling);
    }
    if (typeof pm._toFront === 'function') pm._toFront(p.id);
  }, true);
  (container || document.body).appendChild(pop);
  return pop;
}

// ───────── resize handle ของ dock ─────────
// ลากแล้วปรับ flex สดบน DOM (ไม่ re-render) → commit ลง store ตอนปล่อยครั้งเดียว
export function createResizeHandle(dockId, index, dir, pm, nextIndex) {
  const row = dir === 'row';
  const h = el('div', 'k-resize-handle ' + (row ? 'k-rh-col' : 'k-rh-row'));
  h.dataset.dockId = dockId;
  h.dataset.index = String(index);
  h.title = 'ลากเพื่อปรับสัดส่วน (ดับเบิลคลิก = 50%)';
  h.addEventListener('dblclick', () => pm.resize(dockId, index, 0.5, nextIndex));
  h.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const prev = h.previousElementSibling, next = h.nextElementSibling;
    if (!prev || !next) return;
    const pr = prev.getBoundingClientRect(), nr = next.getBoundingClientRect();
    const total = row ? pr.width + nr.width : pr.height + nr.height;
    if (total <= 0) return;
    const start = row ? e.clientX : e.clientY;
    const base = row ? pr.width : pr.height;
    const growSum = (parseFloat(prev.style.flexGrow) || 1) + (parseFloat(next.style.flexGrow) || 1);
    let ratio = base / total;
    document.body.classList.add('k-resizing');
    const move = (ev) => {
      const d = (row ? ev.clientX : ev.clientY) - start;
      ratio = Math.max(0.05, Math.min(0.95, (base + d) / total));
      prev.style.flexGrow = String(growSum * ratio);
      next.style.flexGrow = String(growSum * (1 - ratio));
    };
    const up = () => {
      document.body.classList.remove('k-resizing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      pm.resize(dockId, index, ratio, nextIndex);    // commit → re-render ครั้งเดียว
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  return h;
}

// ปรับขนาดแผงลอยด้วยมุมขวาล่าง (สดตอนลาก → commit ตอนปล่อย)
// 0.56a #7: เดิมลากเกินขอบจอได้ไม่จำกัด → แผงหลุดจอแล้วเรียกกลับไม่ได้เลย
// ตอนนี้หนีบทั้งตอนลากและตอนปล่อย ให้แผงอยู่ในจอและใหญ่พอจับได้เสมอ
export function makeResizable(box, grip, onEnd) {
  grip.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const w0 = box.offsetWidth, h0 = box.offsetHeight, x0 = e.clientX, y0 = e.clientY;
    const move = (ev) => {
      const c = clampFloat({ x: box.offsetLeft, y: box.offsetTop,
                             w: w0 + ev.clientX - x0, h: h0 + ev.clientY - y0 });
      box.style.width = Math.max(FLOAT_MIN_W, Math.min(c.w, window.innerWidth - box.offsetLeft)) + 'px';
      box.style.height = Math.max(FLOAT_MIN_H, Math.min(c.h, window.innerHeight - box.offsetTop)) + 'px';
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (!box.isConnected) return;      // ถูก re-render ถอดออกกลางคัน → offset* = 0 อย่าบันทึกทับ
      const c = clampFloat({ x: box.offsetLeft, y: box.offsetTop,
                             w: box.offsetWidth, h: box.offsetHeight });
      box.style.left = c.x + 'px'; box.style.top = c.y + 'px';
      box.style.width = c.w + 'px'; box.style.height = c.h + 'px';
      onEnd(c.w, c.h, c.x, c.y);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

// ───────── โหมดอ่าน: ทำเครื่องหมายสายที่มีแผงเอกสาร (docs) ─────────
// CSS ซ่อนพี่น้องที่ไม่ได้ถือ docs → เหลือแต่หน้ากระดาษเต็มจอ (แทนการซ่อน #sidebar แบบเดิม)
export function markDocsChain(container, docsId = 'docs') {
  if (!container) return;
  container.querySelectorAll('.k-holds-docs').forEach((e) => e.classList.remove('k-holds-docs'));
  let n = container.querySelector(`.k-panel[data-panel-id="${docsId}"]`);
  while (n && n !== container) { n.classList.add('k-holds-docs'); n = n.parentElement; }
}
