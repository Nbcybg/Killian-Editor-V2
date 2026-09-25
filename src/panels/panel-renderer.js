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
import { tx, txf } from '../i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t, tf, shortcutText } from '../i18n.js';
import { el } from '../core.js';
import { popupMenu } from '../ui.js';        // [60r3 ข้อ 8] เมนูคลิกขวาบนหัวแผง
import { iconHtml, hasIcon, gi } from '../icons.js';
import * as PL from './panel-layout.js';
import { makePanelDraggable, makeTabDraggable, makeFloatDraggable, createDropOverlay,
         clampFloat, FLOAT_MIN_W, FLOAT_MIN_H } from './panel-drag.js';
import { applyPanelFocus } from './panel-focus.js';
import { escCancelDrag } from '../drag-cancel.js';   // [alpha.165] Esc ยกเลิกการลาก/ย่อขยาย

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
  markWorkspace(container, root, opts);
  // [alpha.152 ข้อ 5] วาดใหม่ทีไรคลาส "แผงที่เลือกอยู่" หลุดทุกที — ทาคืนทันทีในรอบเดียวกัน
  applyPanelFocus(container);
  return container;
}

// [alpha.66r3] ทำเครื่องหมาย "พื้นที่ทำงาน" = ก้อนที่ไม่รวมแถบเครื่องมือ/แถบสถานะ
// ตัวลากใช้กรอบนี้เป็นขอบสำหรับโซน "สร้าง dock ใหม่เต็มด้าน" (ไม่งั้นจะไปแทรกเหนือแถบเครื่องมือ)
export function markWorkspace(container, root, opts) {
  if (!container) return;
  container.querySelectorAll('.k-workspace').forEach((e) => e.classList.remove('k-workspace'));
  const id = PL.workspaceNodeId(root, fixedPanel(opts));
  if (!id) return;
  // [alpha.68r] `[data-tabs-id]` ไม่ผูกกับคลาส `.k-tab-group` แล้ว — กลุ่มที่เหลือแท็บเดียว
  // ถูกวาดเป็น `.k-panel` ที่ถือ id ของกลุ่มไว้ (ดู soloTab) ต้องหาเจอทางนี้ด้วย
  const el2 = container.querySelector(
    `.k-dock[data-dock-id="${id}"], [data-tabs-id="${id}"], .k-panel[data-panel-id="${id}"]`);
  if (el2) el2.classList.add('k-workspace');
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
// [alpha.66r2 ข้อ 2] "ยืดไม่ได้" = แผงตายตัว + แผงที่พับ + กลุ่มแท็บที่ย่อเป็นแถบไอคอน
// (ตรรกะจริงอยู่ใน panel-layout.nodeRigid — บริสุทธิ์ ทดสอบได้)
const fixedPanel = (opts) => (id) => !!metaOf(opts, id).fixed;
function isRigid(node, opts) { return PL.nodeRigid(node, fixedPanel(opts)); }

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
  // [alpha.66r2 ข้อ 2] เดิมหักออกจากตัวหารเฉพาะแผงตายตัว → แผงที่พับ/กลุ่มแท็บที่ย่อเป็นแถบไอคอน
  // (CSS บังคับ flex:0 0 … !important ให้อยู่แล้ว) ยังกินโควตาในตัวหารอยู่ ทำให้ผลรวม grow < 1
  // แล้วพื้นที่ที่เหลือไม่ถูกแจกให้ใคร = **ช่องว่างค้างที่ขอบขวา** ทุกครั้งที่ย่อแผงฝั่งขวา
  const shares = PL.dockShares(node, fixedPanel(opts));
  const flexIdx = PL.flexChildIndex(node);          // สายที่มีแผงเอกสาร = ตัวยืดของ dock นี้
  for (let s = 0; s < shown.length; s++) {
    const i = shown[s];
    const childEl = renderNode(kids[i], pm, opts, depth + 1);
    if (!childEl) continue;
    const sh = shares[i] || { kind: 'rigid' };
    // [alpha.66r4] โมเดลลูกผสม: สายที่มีแผงเอกสาร = ตัวยืดตัวเดียว · แผงข้าง = px คงที่
    // → ย่อ/ขยายหน้าต่างแล้วพื้นที่เขียนดูดส่วนต่างไปคนเดียว แผงข้างกว้างเท่าเดิม (แบบ Photoshop)
    if (sh.kind === 'rigid') {
      childEl.style.flex = '0 0 auto';
    } else if (sh.kind === 'flex') {
      childEl.classList.add('k-flex-child');
      childEl.style.flex = '1 1 0';
    } else if (sh.kind === 'px') {
      childEl.classList.add('k-fixed-px');
      childEl.style.flex = '0 1 ' + sh.px + 'px';         // ยอมให้หดได้เมื่อจอแคบจริง ๆ
    } else {
      // ยังไม่ถูกตรึง → สัดส่วนเหมือนเดิม · แต่ถ้าเป็นสายแผงเอกสารก็ติดป้ายไว้
      // เพื่อให้ที่จับรู้ว่า "ฝั่งไหนคือตัวยืด" ตั้งแต่การลากครั้งแรก (ครั้งแรกนี่แหละที่ตรึง px)
      if (i === flexIdx) childEl.classList.add('k-flex-child');
      childEl.style.flexGrow = String(sh.grow);
      childEl.style.flexShrink = '1';
      childEl.style.flexBasis = '0%';
    }
    box.appendChild(childEl);
    // ที่จับอยู่ระหว่างลูกสองตัวที่ "ยืดได้" ทั้งคู่ และต้องเป็นตัวที่ **เห็นอยู่** ทั้งคู่
    // (ลากปรับสัดส่วนกับแผงที่พับอยู่ไม่มีความหมาย — มันกินพื้นที่เท่าเนื้อหาเสมอ)
    const nextIdx = shown[s + 1];
    if (nextIdx !== undefined && !isRigid(kids[i], opts) && !isRigid(kids[nextIdx], opts)) {
      // ดัชนีที่ส่งให้ resizeDock ต้องเป็นดัชนี "ในต้นไม้" ไม่ใช่ลำดับที่เห็นบนจอ
      box.appendChild(createResizeHandle(node.id, i, node.dir, pm, nextIdx));
    }
  }
  return box;
}

/**
 * [alpha.162 · W5 ข้อ 3] แถบแท็บของกลุ่มแผงเป็น `div` ที่คลิกได้อย่างเดียว — คีย์บอร์ดเข้าไม่ถึง ·
 * โปรแกรมอ่านหน้าจอไม่รู้ว่าเป็นแท็บ · ตัวนี้ใส่ความหมายมาตรฐาน (tablist/tab/aria-selected) +
 * roving tabindex (Tab เข้า-ออกแถบทีเดียว) + ←→/↑↓ · Home/End ย้ายโฟกัส · Enter/Space เปิดแท็บ
 * ใช้ร่วมกันทั้งกลุ่มที่ผนึกและกลุ่มลอย — แท็บใหม่ไม่ต้องจำใส่เอง
 */
export function a11yTabBar(bar, label) {
  if (!bar) return bar;
  bar.setAttribute('role', 'tablist');
  if (label) bar.setAttribute('aria-label', label);
  const vertical = bar.classList.contains('k-vertical');
  if (vertical) bar.setAttribute('aria-orientation', 'vertical');
  const tabs = [...bar.querySelectorAll(':scope > .k-tab')];
  const cur = tabs.find((x) => x.classList.contains('active')) || tabs[0];
  for (const x of tabs) {
    const on = x.classList.contains('active');
    x.setAttribute('role', 'tab');
    x.setAttribute('aria-selected', on ? 'true' : 'false');
    if (x.title) x.setAttribute('aria-label', x.title);
    x.tabIndex = x === cur ? 0 : -1;
  }
  bar.addEventListener('keydown', (e) => {
    const list = [...bar.querySelectorAll(':scope > .k-tab')];
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const prevK = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextK = vertical ? 'ArrowDown' : 'ArrowRight';
    let j = -1;
    if (e.key === nextK) j = (i + 1) % list.length;
    else if (e.key === prevK) j = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); list[i].click(); return; }
    if (j < 0) return;
    e.preventDefault();
    list[i].tabIndex = -1;
    list[j].tabIndex = 0;
    list[j].focus();
  });
  return bar;
}

// ───────── tab group ─────────
// วาด "ทุกแท็บ" ลง DOM เสมอ (ซ่อนตัวที่ไม่ active) — โค้ดเก่าพึ่ง element id ที่ต้องอยู่ใน DOM ตลอด
function renderTabs(node, pm, opts, depth) {
  // [alpha.68r] เหลือแท็บที่เห็นได้ใบเดียว → **ไม่ใช่กลุ่มแล้ว** วาดเป็นแผงเดี่ยว ไม่มีแถบแท็บ
  // (ต้นไม้ยังเก็บแท็บที่ปิดไว้ที่เดิม — เปิดกลับเมื่อไหร่กลุ่มก็คืนมาเองพร้อมลำดับเดิม)
  const solo = PL.soloTab(node);
  if (solo) {
    const only = renderNode(solo, pm, opts, depth);
    if (only) {
      // ยังเป็น "ก้อนเดียวกัน" ในสายตาของ dock แม่และตัวชี้พื้นที่ทำงาน — id ของกลุ่มต้องติดไปด้วย
      only.dataset.tabsId = node.id;
      only.classList.add('k-solo-tab');
    }
    return only;
  }
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
    if (!strip) addTabClose(tab, child.id, md, pm);
    tab.title = (md.title || child.title || child.id) + (md.desc ? '\n' + md.desc : '');
    tab.onclick = () => {
      if (strip) { toggleStrip(node.id, pm, false); pm.activatePanel(child.id); return; }
      pm.activatePanel(child.id);
    };
    makeTabDraggable(tab, child.id, node.id, i, pm, { host: opts.host, isFixedPanel: fixedPanel(opts) });
    bar.appendChild(tab);
  }
  // ปุ่มย่อกลุ่มแท็บเป็นแถบไอคอน
  const strBtn = makePanelButton({ glyph: strip ? gi('strip-expand') : gi('strip-collapse'), cls: 'k-strip-btn',
    title: strip ? t('ui.panelRenderer.groupTab') : t('ui.panelRenderer.collapseBarIcon'),
    tip: 'ui.panelTip.strip', onPress: () => toggleStrip(node.id, pm, !strip) });
  bar.appendChild(strBtn);
  a11yTabBar(bar, t('ui.panelRenderer.tabsLabel'));   // [alpha.162 · W5 ข้อ 3]
  box.appendChild(bar);

  const body = el('div', 'k-tab-content');
  const gOpts = { ...opts, inGroup: true };          // [alpha.161 · U3] หัวแผงในกลุ่ม = เมนู/ย่อ เท่านั้น
  for (let i = 0; i < kids.length; i++) {
    if (isHid(kids[i])) continue;
    const panelEl = renderNode(kids[i], pm, gOpts, depth + 1);
    if (!panelEl) continue;
    panelEl.classList.add('k-tabbed');
    if (i !== active) panelEl.classList.add('k-tab-hidden');
    body.appendChild(panelEl);
  }
  box.appendChild(body);
  return box;
}

// [alpha.157] แท็บทรงเม็ดมีปุ่มปิดในตัว (ภาพอ้างอิงของผู้ใช้) — แผงที่ปิดไม่ได้ (เอกสาร ฯลฯ) ไม่มีปุ่ม
function addTabClose(tab, id, md, pm) {
  if (md.closable === false) return;
  const x = el('span', 'k-tab-x', gi('close'));
  // [alpha.161 · U3] ชื่อบอกชัดว่าปิด "แผงนี้" (ต่างจากปุ่มปิดทั้งกลุ่มบนแถบกลุ่มลอย)
  x.title = tf('ui.panelRenderer.closeThisPanel', md.title || id);
  x.dataset.tip = 'ui.panelTip.tabClose';
  // กันตัวลากแท็บจับ mousedown ของปุ่มปิด (ไม่งั้นกดปิดแล้วกลายเป็นเริ่มลาก)
  x.addEventListener('mousedown', (e) => e.stopPropagation());
  x.onclick = (e) => { e.stopPropagation(); pm.hidePanel(id); };
  tab.appendChild(x);
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
  if (node.collapsed) box.classList.add('k-collapsed');
  if (md.fixed) box.classList.add('k-panel-fixed');
  if (md.noHead) box.classList.add('k-panel-nohead');
  else {
    const head = buildHead(node, pm, opts, md, false);
    box.appendChild(head);
    // ลากหัวแผง → ผนึกที่อื่น / รวมเป็นแท็บ / ลอยออกมา
    makePanelDraggable(head, node.id, pm,
      { host: opts.host, isFixedPanel: fixedPanel(opts), ghostLabel: md.title || node.title || node.id });
  }
  box.appendChild(buildBody(node, opts));
  return box;
}

/**
 * [alpha.161 · U2] ★ ปุ่มควบคุมของระบบแผง — คอมโพเนนต์เดียว (หัวแผง · แถบกลุ่มลอย · ย่อกลุ่มแท็บ)
 * สร้างด้วย node ล้วน (ไม่ innerHTML) · `title` = ชื่อ (+ คีย์ลัดจริงถ้ามี) · `data-tip` = คำอธิบายบรรทัดสอง
 * (ระบบทูลทิปตัวเดียวกับแถบเครื่องมือ — setupHoverTips อ่าน data-tip) · กดด้วยคีย์บอร์ดได้
 * (tabindex=0 + Enter/Space · วงโฟกัสใน CSS `:focus-visible`) · คลาส `k-panel-btn-<act>` / `data-act` คงเดิม
 * @param {{act?:string, glyph:string, title:string, tip?:string, sc?:string, cls?:string, onPress:(e:Event)=>void}} o
 */
export function makePanelButton(o) {
  const b = el('span', 'k-panel-btn' + (o.act ? ' k-panel-btn-' + o.act : '') + (o.cls ? ' ' + o.cls : ''), o.glyph || '');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  if (o.act) b.dataset.act = o.act;
  if (o.tip) b.dataset.tip = o.tip;
  // [alpha.164 · รอบต่อ 2] `titleKey` = แปลใหม่ทุกครั้งที่หัวแผงถูกวาด — ปุ่มที่โมดูลอื่นฝากไว้ถูกสร้าง
  // ตอนบูต (ก่อนไฟล์ภาษาโหลดเสร็จ) แล้ว element เดิมถูกใช้ซ้ำทุกรอบ render → `title: t(…)` ค้างเป็นไทยในโหมดอังกฤษ
  b._k2title = () => {
    const sc = o.sc ? shortcutText(o.sc) : '';
    const title = String(o.titleKey ? t(o.titleKey) : (o.title || '')) + (sc ? ' (' + sc + ')' : '');
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
  };
  b._k2title();
  b.onclick = (e) => { e.stopPropagation(); o.onPress(e); };
  b.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); e.stopPropagation(); o.onPress(e);
  };
  // [alpha.162 · W2] บอก buildHead ว่าปุ่มนี้มีคีย์บอร์ดของตัวเองแล้ว — ไม่งั้นตัวปะของปุ่มที่โมดูลอื่น
  // ฝากไว้ (ซึ่งเรียก ) จะทำงานซ้อนอีกชั้น = กด Enter หนึ่งครั้งได้ผลสองครั้ง (สวิตช์กลับที่เดิม)
  b._k2kbd = true;
  return b;
}

/**
 * [alpha.162 · W2] หัวแผงของ "หน้าต่างที่ฉีกออกมา" — ไม่มีปุ่มควบคุม (หน้าต่างนั้นมีแผงเดียว)
 * แต่ต้องเป็นโครงเดียวกับหัวแผงปกติ: ไอคอน + ชื่อ ในคลาสชุดเดียวกัน
 */
export function panelWindowHead({ title, icon: ic }) {
  const head = el('div', 'k-panel-head k-panel-head-win');
  head.appendChild(iconSpan(ic, 'k-panel-head-icon'));
  head.appendChild(el('span', 'k-panel-head-title', title || ''));
  return head;
}

function buildHead(node, pm, opts, md, floating) {
  const head = el('div', 'k-panel-head');
  head.appendChild(iconSpan(md.icon, 'k-panel-head-icon'));
  const ttl = el('span', 'k-panel-head-title', md.title || node.title || node.id);
  // [alpha.167] ผู้ใช้: "ทุก panel ต้องมี hover tooltip" — ชี้ชื่อแผง = บอกว่าแผงนี้ทำอะไร (คำอธิบายแถวเดียวกับปุ่มเปิดแผง)
  if (md.desc) ttl.title = md.desc;
  head.appendChild(ttl);

  // ปุ่มเสริมที่โมดูลอื่นฝากไว้ (🔄 รีเฟรช, 🔍 ค้นหา, ¶ beats) — element เดิมถูกใช้ซ้ำทุกรอบ render
  const ctrls = el('span', 'k-panel-ctrls');
  const extras = opts.headExtras ? (opts.headExtras(node.id) || []) : [];
  for (const b of extras) {
    // [alpha.161 · U2] ปุ่มเสริมที่โมดูลอื่นฝากไว้ ต้องกดด้วยคีย์บอร์ดได้เหมือนปุ่มของระบบแผง
    if (b && b.nodeType === 1 && b.classList.contains('k-panel-btn') && !b._k2kbd) {
      b._k2kbd = true;
      b.setAttribute('role', 'button');
      if (b.tabIndex < 0) b.tabIndex = 0;
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); e.stopPropagation(); b.click();
      });
    }
    if (b && typeof b._k2title === 'function') b._k2title();
    ctrls.appendChild(b);
  }
  head.appendChild(ctrls);

  const btns = el('span', 'k-panel-btns');
  const def = pm.registry.get(node.id) || {};
  // [alpha.161 · U3] ★ แผงที่อยู่ "ในกลุ่มแท็บ" — แถบแท็บของกลุ่มมีปุ่มปิด (✕ บนแท็บ) และปุ่มของกลุ่มแล้ว
  // เดิมหัวแผงข้างในโชว์ ปิด/ลอย/ฉีก ซ้ำอีกชุด (กลุ่มลอยมีปุ่มปิดสามตัวที่ทำคนละอย่าง) → เหลือแค่ เมนู/ย่อ
  // คำสั่งลอย/ฉีก/ปิดของแผงเดี่ยวยังอยู่ครบในเมนู ☰ (headMenuItems)
  const inGroup = !!opts.inGroup;
  // [alpha.67] 🖥 ฉีกแผงออกเป็นหน้าต่าง OS จริง — วางไว้ก่อน ⧉ (ลอย) เพราะเป็นการ "ออกไปไกลกว่า"
  if (!inGroup && opts.canTearOff && opts.canTearOff(node.id)) {
    btns.appendChild(makePanelButton({ act: 'tearoff', glyph: gi('desktop'), title: t('ui.panelRenderer.moveWindowSplitDrag'),
      tip: 'ui.panelTip.tearoff', onPress: () => opts.onTearOff(node.id) }));
  }
  for (const b of PL.PANEL_BUTTONS) {
    if (b.key === 'close' && def.closable === false) continue;
    if (b.key === 'float' && def.floatable === false) continue;
    if (inGroup && !b.group) continue;
    const glyph = b.key === 'float' && floating ? gi('dock-window') : (b.key === 'collapse' && node.collapsed ? gi('triangle-right-sm') : b.icon);
    const btn = makePanelButton({ act: b.key, glyph, title: b.title, tip: b.tip,
      sc: b.key === 'close' ? 'toggle-panel:' + node.id : '', onPress: (e) => press(b, btn, e) });
    const press = (b2, btn2, e) => {
      if (b.key === 'menu') {
        const r = btn2.getBoundingClientRect();
        popupMenu(Math.max(8, r.right - 240), r.bottom + 3, headMenuItems(node, pm, opts, md, floating));
      }
      else if (b.key === 'collapse') pm.collapsePanel(node.id);
      else if (b.key === 'close') pm.hidePanel(node.id);
      else if (b.key === 'float') {
        if (floating) {                              // ผนึกกลับ: อ้าง 'docs' เป็นหลัก (ไม่งั้นไปเกาะแถบเครื่องมือ)
          const anchor = pm.isDocked(opts.dockAnchor || 'docs') ? (opts.dockAnchor || 'docs') : undefined;
          pm.dockPanel(node.id, def.defaultSide || 'left', anchor);
          return;
        }
        const host = e.target.closest('.k-panel');
        const r = host ? host.getBoundingClientRect() : { left: 90, top: 90, width: 320, height: 300 };
        // [66r12] กล่องนี้คือ "ขนาดตอนผนึก" — ความสูงของแผงข้างคือเต็มคอลัมน์ ต้องให้ store หนีบให้
        // [alpha.165] recall = กลับไปที่ที่ลอยอยู่ครั้งล่าสุด (ผนึก → ลอยอีกครั้ง ไม่กระโดดไปที่ช่องผนึก)
        pm.floatPanel(node.id, clampFloat({ x: r.left, y: r.top, w: r.width, h: r.height }),
                      { fromDock: true, recall: true, clamp: (b) => clampFloat(b) });
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
  const items = [{ label: `${tx('ui.panelRenderer.whatIsThis2')} <b>` + escapeHtml(title) + '</b>', disabled: true }];
  for (const line of wrapDesc(md.desc || '')) items.push({ label: '<span class="dim">' + escapeHtml(line) + '</span>', disabled: true });
  items.push('-');
  if (def.closable !== false) {
    items.push({ label: (node.collapsed ? t('ui.panelRenderer.panel') : t('ui.panelRenderer.panel2')), click: () => pm.collapsePanel(node.id) });
  }
  if (def.floatable !== false) {
    items.push({ label: floating ? t('ui.panelRenderer.backInWindow') : t('ui.panelRenderer.floatPanelOut'),
      click: () => {
        if (floating) { const a = pm.isDocked('docs') ? 'docs' : undefined; pm.dockPanel(node.id, def.defaultSide || 'left', a); return; }
        pm.floatPanel(node.id, clampFloat({ x: 90, y: 90, w: 340, h: 320 }),
                      { recall: true, clamp: (b) => clampFloat(b) });
      } });
  }
  // [alpha.67] ทางเข้าที่สองของ tear-off (ปุ่ม 🖥 อาจถูกบีบหายเมื่อหัวแผงแคบ)
  if (opts.canTearOff && opts.canTearOff(node.id)) {
    items.push({ label: t('ui.panelRenderer.moveWindowSplitDrag2'), click: () => opts.onTearOff(node.id) });
  }
  // [alpha.66r3] คำสั่งลึกที่ UI ฝากมา (จัดการพื้นที่ · เวิร์กสเปซ) — Progressive Disclosure ตามสเปก
  const extra = opts.extraHeadMenu ? (opts.extraHeadMenu(node.id, floating) || []) : [];
  if (extra.length) { items.push('-'); for (const it of extra) items.push(it); }
  if (def.closable !== false) {
    items.push('-');
    items.push({ label: t('ui.panelRenderer.closePanelOpenBack'), click: () => pm.hidePanel(node.id) });
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

/**
 * [alpha.73 ข้อ 6] ความกว้างต่ำสุดของเนื้อแผง — บีบแคบกว่านี้ให้มีแถบเลื่อนแนวนอนแทนการยุบเนื้อหา
 * ค่ามาจาก `minW` ใน PANEL_DEFS (ผ่าน metaOf) **ไม่ฮาร์ดโค้ดที่นี่** — ค่าเริ่มต้น 200px
 */
export const PANEL_MIN_W_DEFAULT = 200;
export function panelMinW(md) {
  const n = Number(md && md.minW);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : PANEL_MIN_W_DEFAULT;
}

function buildBody(node, opts) {
  const md = metaOf(opts, node.id);
  const body = el('div', 'k-panel-body');
  // [alpha.162 · W2] แผงที่เนื้อข้างในจัดการพื้นที่เอง (ธง `flush` ใน PANEL_DEFS)
  // เดิมเป็นกฎ CSS `:has(#xxx-body)` สิบกฎกระจายทั้งไฟล์ — เพิ่มแผงใหม่ทีไรต้องไปเขียนกฎเพิ่มเอง
  if (md.flush) body.classList.add('k-panel-flush');
  body.style.setProperty('--panel-min-w', panelMinW(md) + 'px');
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
  // [alpha.66r7] แผงลอยจับกลุ่มกันได้เหมือน dock — f.panel เป็นโหนด `tabs` ได้แล้ว
  if (f.panel && f.panel.type === 'tabs') return renderFloatGroup(f, pm, opts, container);
  const p = f.panel;
  const md = metaOf(opts, p.id);
  const pop = el('div', 'k-float-panel');
  pop.dataset.panelId = p.id;
  pop.dataset.floatId = f.id;
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

  makeFloatDraggable(head, pop, p.id, pm, { host: opts.host, isFixedPanel: fixedPanel(opts), floatId: f.id });
  // ยกขึ้นบนสุดด้วยการย้าย DOM ไม่ใช่ re-render — re-render ระหว่าง mousedown จะถอด pop
  // ที่ drag/resize กำลังอ้างถึงออกจากหน้า แล้ว offsetLeft/Width กลายเป็น 0 ตอนปล่อยเมาส์
  pop.addEventListener('mousedown', () => {
    raiseFloat(pop);
    if (typeof pm._toFront === 'function') pm._toFront(p.id);
  }, true);
  (container || document.body).appendChild(pop);
  return pop;
}


// ───────── [alpha.167 · บั๊ก Explorer เด้งขึ้นบนสุด] ยกแผงลอยขึ้นบนด้วย z-index ไม่ใช่ย้าย DOM ─────────
// เดิมย้ายโหนดไปท้ายพี่น้อง (`insertBefore`) — การถอดโหนดออกจากหน้าแล้วใส่คืน **ล้างตำแหน่งเลื่อน
// ของทุกกล่องข้างใน** (scrollTop กลายเป็น 0) · อาการที่ผู้ใช้เจอ: Explorer ลอย → ไปคลิกแผงอื่น →
// กลับมาคลิก Explorer = ต้นไม้เด้งไปบรรทัดบนสุด (และโฟกัสในช่องกรอกของแผงหลุดด้วย)
// ช่วง z ต้องอยู่ใต้ FAB (76) กับกล่องโต้ตอบ (80) เสมอ — ใช้ 66..75 · เกินสิบใบ = ใบล่าง ๆ เสมอกัน
// (ลำดับ DOM ตัดสินต่อ ซึ่งยังถูกต้องเพราะตอนวาดใหม่ระบบต่อท้ายตามลำดับ z ของสโตร์)
export const FLOAT_Z_BASE = 66, FLOAT_Z_TOP = 75;
/** ลำดับจากล่างขึ้นบนของแผงลอยใน container เดียวกัน (z ที่ตั้งไว้ก่อน แล้วลำดับ DOM) */
export function floatStack(par) {
  const list = [...(par ? par.children : [])].filter((n) => n.classList && n.classList.contains('k-float-panel'));
  return list.map((n, i) => ({ n, i, z: +n.style.zIndex || FLOAT_Z_BASE }))
    .sort((a, b) => (a.z - b.z) || (a.i - b.i)).map((x) => x.n);
}
export function raiseFloat(pop) {
  const par = pop && pop.parentNode;
  if (!par) return false;
  const stack = floatStack(par).filter((n) => n !== pop);
  stack.push(pop);
  const span = FLOAT_Z_TOP - FLOAT_Z_BASE;
  stack.forEach((n, i) => {
    const z = Math.max(FLOAT_Z_BASE, FLOAT_Z_TOP - (stack.length - 1 - i));
    n.style.zIndex = String(Math.min(FLOAT_Z_BASE + span, z));
  });
  return true;
}

/** [alpha.66r7] กล่องลอยที่มีหลายแผงเป็นแท็บ — ลากทั้งกล่องไปผนึกได้ · ลากแท็บออกได้ทีละใบ */
function renderFloatGroup(f, pm, opts, container) {
  const g = f.panel;
  const pop = el('div', 'k-float-panel k-float-group');
  pop.dataset.floatId = f.id;
  const box = clampFloat({ x: f.x ?? 80, y: f.y ?? 80, w: f.w ?? 420, h: f.h ?? 320 });
  pop.style.left = box.x + 'px'; pop.style.top = box.y + 'px';
  pop.style.width = box.w + 'px'; pop.style.height = box.h + 'px';

  const kids = (g.children || []).filter((c) => !PL.nodeHidden(c));
  let active = Math.max(0, Math.min(g.active | 0, kids.length - 1));
  const bar = el('div', 'k-tab-bar k-float-tabbar');
  kids.forEach((child, i) => {
    const md = metaOf(opts, child.id);
    const tab = el('div', 'k-tab' + (i === active ? ' active' : ''));
    tab.dataset.index = String(i);
    tab.dataset.panelId = child.id;
    tab.appendChild(iconSpan(md.icon, 'k-tab-icon'));
    tab.appendChild(el('span', 'k-tab-title', md.title || child.title || child.id));
    addTabClose(tab, child.id, md, pm);
    tab.title = (md.title || child.title || child.id) + (md.desc ? '\n' + md.desc : '');
    tab.onclick = () => {
      const next = pm.floats.map((x) => (x.id === f.id
        ? { ...x, panel: { ...x.panel, active: i } } : x));
      pm.store.setFloats(next);
    };
    // ลากแท็บออกจากกลุ่มลอย → แยกเป็นกล่องของตัวเอง หรือไปผนึกที่อื่น
    makeTabDraggable(tab, child.id, g.id, i, pm, { host: opts.host, isFixedPanel: fixedPanel(opts) });
    bar.appendChild(tab);
  });
  a11yTabBar(bar, t('ui.panelRenderer.tabsLabel'));   // [alpha.162 · W5 ข้อ 3]
  // [alpha.161 · U3] หัวกลุ่มควบคุม "ทั้งกลุ่ม" — ✕ บนแท็บปิดทีละแผง · ปุ่มนี้ปิดทั้งกลุ่ม
  // (เดิมปุ่มนี้ปิดแค่แท็บที่เปิดอยู่ = ซ้ำกับ ✕ บนแท็บ และหัวแผงข้างในยังมีปุ่มปิดอีกตัว = สามปุ่ม)
  const closeBtn = makePanelButton({ act: 'close', cls: 'k-group-close', glyph: gi('close'),
    title: tf('ui.panelRenderer.closeGroupN', kids.length), tip: 'ui.panelTip.groupClose',
    onPress: () => { for (const c of kids.slice()) pm.hidePanel(c.id); } });
  const dockBtn = makePanelButton({ act: 'float', glyph: gi('dock-window'), title: t('ui.panelRenderer.groupBackInWindow'),
    tip: 'ui.panelTip.groupDock',
    onPress: () => pm.dockFloatGroup(f.id, 'left', pm.isDocked('docs') ? 'docs' : undefined) });
  const btns = el('span', 'k-panel-btns');
  // [alpha.67] ฉีก "แท็บที่เปิดอยู่" ของกลุ่มลอยออกไปเป็นหน้าต่างแยก — แถบแท็บอยู่บนสุด ผู้ใช้เอื้อมถึงก่อน
  // ([alpha.161] หัวแผงข้างในกลุ่มไม่มีปุ่มนี้ซ้ำแล้ว — ยังอยู่ในเมนู ☰ ของแผง)
  const actId = (kids[active] || {}).id;
  if (actId && opts.canTearOff && opts.canTearOff(actId)) {
    btns.appendChild(makePanelButton({ act: 'tearoff', glyph: gi('desktop'), title: t('ui.panelRenderer.moveTabWindowSplit'),
      tip: 'ui.panelTip.tearoff', onPress: () => opts.onTearOff(actId) }));
  }
  btns.append(dockBtn, closeBtn);
  bar.appendChild(btns);
  pop.appendChild(bar);

  const body = el('div', 'k-tab-content');
  const gOpts = { ...opts, inGroup: true };          // [alpha.161 · U3]
  kids.forEach((child, i) => {
    const panelEl = renderNode(child, pm, gOpts, 1);
    if (!panelEl) return;
    panelEl.classList.add('k-tabbed');
    if (i !== active) panelEl.classList.add('k-tab-hidden');
    body.appendChild(panelEl);
  });
  pop.appendChild(body);

  const grip = el('div', 'k-panel-resize');
  makeResizable(pop, grip, (w, h, x, y) => pm.moveFloatBox(f.id, { w, h, x, y }));
  pop.appendChild(grip);
  // ลากแถบแท็บ (ที่ว่าง ๆ) = ย้าย/ผนึกทั้งกลุ่ม
  makeFloatDraggable(bar, pop, g.id, pm, { host: opts.host, isFixedPanel: fixedPanel(opts), floatId: f.id });
  // [alpha.66r10] กลุ่มลอยไม่เคยมีตัวยกขึ้นบนสุด — คลิกแล้วมันจมอยู่ใต้กล่องลอยใบอื่นตลอด
  // (ย้าย DOM เอง ไม่ re-render — re-render กลาง mousedown จะทำให้ตัวที่กำลังลากหลุดหน้า)
  pop.addEventListener('mousedown', () => {
    raiseFloat(pop);
    if (typeof pm._toFront === 'function') pm._toFront(f.id);
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
  h.title = t('ui.panelRenderer.dragAdjustRatioClick');
  // [alpha.66r4] ลากที่จับใน dock ที่มี "ตัวยืด" = **ตรึงความกว้างฝั่งที่ไม่ใช่ตัวยืดเป็น px**
  // (การลากคือเจตนาชัดเจนของผู้ใช้ว่า "ขอกว้างเท่านี้" — ตั้งแต่ครั้งแรก ไม่ต้องรอให้เป็น px ก่อน)
  // dock ที่ไม่มีตัวยืดเลย (ไม่มีแผงเอกสารอยู่ข้างใน) → ใช้สัดส่วนเหมือนเดิมทุกประการ
  const hasFlex = () => !!(h.parentElement && h.parentElement.querySelector(':scope > .k-flex-child'));
  const isPx = (n) => !!(n && hasFlex() && !n.classList.contains('k-flex-child'));
  h.addEventListener('dblclick', () => {
    const prev = h.previousElementSibling, next = h.nextElementSibling;
    if (!prev || !next) return;
    if (!isPx(prev) && !isPx(next)) { pm.resize(dockId, index, 0.5, nextIndex); return; }
    // โหมด px: "แบ่งครึ่ง" = ให้คู่นี้กว้างเท่ากัน (ตัวยืดไม่ต้องแตะ เดี๋ยวมันดูดที่เหลือเอง)
    const pr = prev.getBoundingClientRect(), nr = next.getBoundingClientRect();
    const half = ((row ? pr.width + nr.width : pr.height + nr.height)) / 2;
    const up2 = {};
    if (isPx(prev)) up2[index] = half;
    if (isPx(next)) up2[nextIndex ?? index + 1] = half;
    pm.resizePx(dockId, up2, row);
  });
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
    const baseNext = row ? nr.width : nr.height;
    const pxMode = isPx(prev) || isPx(next);
    const growSum = (parseFloat(prev.style.flexGrow) || 1) + (parseFloat(next.style.flexGrow) || 1);
    let ratio = base / total;
    let pxPrev = base, pxNext = baseNext;
    // [alpha.165] Esc = ยกเลิกการลากเส้นแบ่ง คืน flex ของสองฝั่งตามก่อนลาก (store ยังไม่ถูกแตะ)
    const flex0 = [prev.style.flex, prev.style.flexGrow, next.style.flex, next.style.flexGrow];
    const offEsc = escCancelDrag(() => {
      document.body.classList.remove('k-resizing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      prev.style.flex = flex0[0]; if (!flex0[0]) prev.style.flexGrow = flex0[1];
      next.style.flex = flex0[2]; if (!flex0[2]) next.style.flexGrow = flex0[3];
    });
    document.body.classList.add('k-resizing');
    // [alpha.66r5] พื้นที่ที่ "ตัวยืด" มีอยู่ตอนเริ่มลาก — ใช้คำนวณเพดานการลาก
    // กฎ: ผู้ที่ยอมเสียพื้นที่ให้การลากมีแค่ตัวยืดตรงกลางเท่านั้น · แผงอีกฝั่งห้ามถูกเบียดเด็ดขาด
    // (ปล่อยให้ flexbox บีบเอง = ลากขอบขวาแล้วแผงซ้ายหดตาม ซึ่งผู้ใช้บอกว่าไม่ควรเกิด)
    const flexEl = h.parentElement && h.parentElement.querySelector(':scope > .k-flex-child');
    const flexR = flexEl ? flexEl.getBoundingClientRect() : null;
    const flexSize = flexR ? (row ? flexR.width : flexR.height) : 0;
    const slack = Math.max(0, flexSize - PL.MIN_CANVAS_PX);   // ตัวยืดยอมหดได้อีกเท่านี้
    const move = (ev) => {
      const d = (row ? ev.clientX : ev.clientY) - start;
      if (pxMode) {
        // [alpha.66r4] ลากในโหมด px: เขียนความกว้างจริงเป็น px ให้ฝั่งที่เป็น px
        // ฝั่งที่เป็น "ตัวยืด" ไม่ต้องแตะเลย — มันดูดส่วนต่างเองอัตโนมัติ
        const lim = PL.MIN_PANEL_PX;
        let dd = d;
        if (isPx(prev)) dd = Math.max(lim - base, dd);
        if (isPx(next)) dd = Math.min(baseNext - lim, dd);
        // เพดานจากพื้นที่ทำงาน: ฝั่งไหนโตขึ้น ตัวยืดก็เล็กลงเท่านั้น — ห้ามเกิน slack
        if (isPx(prev) && !isPx(next)) dd = Math.min(dd, slack);     // ลากขวา = prev โต
        if (isPx(next) && !isPx(prev)) dd = Math.max(dd, -slack);    // ลากซ้าย = next โต
        pxPrev = base + dd; pxNext = baseNext - dd;
        if (isPx(prev)) prev.style.flex = '0 1 ' + Math.round(pxPrev) + 'px';
        if (isPx(next)) next.style.flex = '0 1 ' + Math.round(pxNext) + 'px';
        return;
      }
      ratio = Math.max(0.05, Math.min(0.95, (base + d) / total));
      prev.style.flexGrow = String(growSum * ratio);
      next.style.flexGrow = String(growSum * (1 - ratio));
    };
    const up = () => {
      offEsc();
      document.body.classList.remove('k-resizing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      // ═══ [alpha.126] ★ ปิดช่องว่างท้ายการลากเสมอ ═══
      //
      // บั๊กค้างจาก alpha.66r5: "ลากปรับขนาดแล้วเหลือช่องว่างฝั่งขวา" — **ทำซ้ำในเทสไม่ได้**
      // เพราะเทสปรับขนาดผ่าน store (→ `renderPanels()` → ตรวจช่องว่างบน rAF) ส่วนผู้ใช้ **ลากที่จับ**
      // ซึ่งเขียน `style.flex` ลง DOM ตรง ๆ ระหว่างลาก แล้วค่อย commit ตอนปล่อย
      // ถ้า commit ได้สถานะที่ JSON เท่าเดิม (ปัดเป็น px ลงตัวเท่าเดิม) `renderPanels()`
      // จะ **early-return ที่ `sig === lastSig`** → ไม่วาดใหม่ → ตัวตรวจช่องว่างไม่เคยได้ทำงาน
      // แล้ว inline flex ที่ค้างอยู่ก็ไม่มีใครมาปิดรูให้
      //
      // ตรงนี้เรียกตัวปิดรูตรง ๆ หลังปล่อยเมาส์ ไม่ผ่านเส้นทางวาดใหม่ — ได้ผลทั้งสองกรณี
      try {
        requestAnimationFrame(() => {
          import('./panel-ui.js').then((m) => m.auditPanelGaps && m.auditPanelGaps()).catch(() => {});
        });
      } catch {}
      if (pxMode) {                                   // commit → re-render ครั้งเดียว
        const upd = {};
        if (isPx(prev)) upd[index] = pxPrev;
        if (isPx(next)) upd[nextIndex ?? index + 1] = pxNext;
        // [alpha.66r5] **ตรึงพี่น้องที่ยังไม่เคยถูกตรึงไปพร้อมกัน** ด้วยขนาดที่มันมีอยู่ตอนนี้
        // ไม่งั้นแผงอีกฝั่งที่ยังเป็น "สัดส่วน" จะไปแย่งพื้นที่ที่เหลือกับตัวยืด แล้วหดตามทุกครั้งที่ลาก
        // (อาการที่ผู้ใช้เจอ: dock/undock ฝั่งซ้าย แล้วลากฝั่งขวา ฝั่งซ้ายถูกบีบ)
        // ตรงนี้ปลอดภัยที่จะ "วัดแล้วตรึง" เพราะเป็นจังหวะที่ผู้ใช้ลงมือเอง = เลย์เอาต์นิ่งและเห็นอยู่กับตา
        try {
          const dockEl = h.parentElement;
          const kids = (PL.nodeById(pm.root, dockId) || {}).children || [];
          for (let i = 0; i < kids.length; i++) {
            const kid = kids[i];
            if (!kid || upd[i] !== undefined || PL.nodePx(kid, row) > 0) continue;
            const kel = dockEl.querySelector(
              `:scope > [data-panel-id="${kid.id}"], :scope > [data-dock-id="${kid.id}"], :scope > [data-tabs-id="${kid.id}"]`);
            if (!kel) continue;
            if (kel.classList.contains('k-flex-child') || kel.classList.contains('k-collapsed')
                || kel.classList.contains('k-panel-fixed') || kel.classList.contains('icon-strip')) continue;
            const r = kel.getBoundingClientRect();
            const v = Math.round(row ? r.width : r.height);
            if (v >= PL.MIN_PANEL_PX) upd[i] = v;
          }
        } catch {}
        pm.resizePx(dockId, upd, row);
        return;
      }
      pm.resize(dockId, index, ratio, nextIndex);
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
    const sw0 = box.style.width, sh0 = box.style.height;
    const move = (ev) => {
      const c = clampFloat({ x: box.offsetLeft, y: box.offsetTop,
                             w: w0 + ev.clientX - x0, h: h0 + ev.clientY - y0 });
      box.style.width = Math.max(FLOAT_MIN_W, Math.min(c.w, window.innerWidth - box.offsetLeft)) + 'px';
      box.style.height = Math.max(FLOAT_MIN_H, Math.min(c.h, window.innerHeight - box.offsetTop)) + 'px';
    };
    const stop = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      offEsc();
    };
    // [alpha.165] Esc = ยกเลิกการย่อ/ขยาย คืนขนาดเดิม
    const offEsc = escCancelDrag(() => { stop(); box.style.width = sw0; box.style.height = sh0; });
    const up = () => {
      stop();
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
