// panel-chrome.js — [alpha.162 · W2] ★ ของกลางของ "หน้าตาในเนื้อแผง"
//
// ══ ที่มา ══
// แผง 32 ตัวต่างคนต่างสร้างหัวข้อ/แถบเครื่องมือ/สถานะว่างของตัวเอง สะสมมาตั้งแต่ตอนที่หลายตัว
// ยังเป็น "แท็บเอกสาร" (หน้าเต็มจอ) — ผลคือ **หัวข้อในแผงมีหกขนาด** (26 · 22 · 20 · 19 · 16 · 12.5px)
// และ **สถานะว่างมีสิบคลาส** ที่หน้าตาไม่เหมือนกันเลย ทั้งที่พูดเรื่องเดียวกัน
// ตอนนี้ทุกแผงเรียกสามฟังก์ชันนี้ แล้วขนาด/ระยะมาจากตัวแปร CSS ชุดเดียว (`--pan-*`)
//
// กติกา:
//   · ข้อความทุกชิ้นมาจากไฟล์ภาษา (ผู้เรียกส่งข้อความที่แปลแล้วเข้ามา) — ที่นี่ไม่มีสตริงของตัวเอง
//   · node ล้วน ไม่มี innerHTML (ข้อความของผู้ใช้ผ่านตรงนี้ได้ — กฎเหล็กข้อ 11)
//   · ไม่ import app.js/panel-ui.js (แผงไหนก็เรียกได้โดยไม่เกิดวงของ import)
import { el } from '../core.js';
import { icon as iconNode, hasIcon } from '../icons.js';

/**
 * หัวข้อของ "หน้า" ในเนื้อแผง (จัดการเล่ม · เส้นเวลา · แผนที่ · แดชบอร์ด …)
 * @param {string} title ข้อความที่แปลแล้ว
 * @param {{sub?:string, icon?:string, cls?:string, right?:Node|Node[]}} o
 *   `sub` = คำอธิบายบรรทัดเดียวข้างชื่อ · `right` = ของที่ต้องอยู่ชิดขวา (ปุ่ม/ชิป)
 * @returns {HTMLElement} `.k-pan-head` (มี `.k-pan-title` อยู่ข้างใน)
 */
export function panelHead(title, o = {}) {
  const head = el('div', 'k-pan-head' + (o.cls ? ' ' + o.cls : ''));
  if (o.icon && hasIcon(o.icon)) {
    const ic = el('span', 'k-pan-head-icon');
    ic.append(iconNode(o.icon, 16));
    head.append(ic);
  }
  head.append(panelTitle(title));
  if (o.sub) head.append(el('span', 'k-pan-sub', o.sub));
  if (o.right) {
    const r = el('span', 'k-pan-head-right');
    for (const n of [].concat(o.right)) if (n) r.append(n);
    head.append(r);
  }
  return head;
}

/** ชื่อหัวข้อเดี่ยว ๆ (ใช้เมื่อแผงประกอบหัวเองแต่ต้องการขนาดกลาง) */
export function panelTitle(text, cls = '') {
  return el('div', 'k-pan-title' + (cls ? ' ' + cls : ''), String(text ?? ''));
}

/**
 * แถบเครื่องมือของแผง — แถวเดียว ห่อบรรทัดได้ ไม่ยืด (เนื้อข้างล่างได้ที่เหลือทั้งหมด)
 * @param {Array<Node|null>} items · @param {string} cls คลาสเดิมของแผง (คงไว้ให้ CSS/เทสเดิมทำงานต่อ)
 */
export function panelBar(items = [], cls = '') {
  const bar = el('div', 'k-pan-bar' + (cls ? ' ' + cls : ''));
  for (const n of items) if (n) bar.append(n);
  return bar;
}

/**
 * สถานะว่างของแผง — **บอกว่าต้องทำอะไรต่อ** ไม่ใช่กล่องเปล่า (บทเรียน alpha.124 ข้อ 44)
 * @param {string} text ข้อความหลัก (แปลแล้ว)
 * @param {{hint?:string, action?:string, onAction?:Function, icon?:string, cls?:string}} o
 * @returns {HTMLElement} `.k-pan-empty`
 */
export function panelEmpty(text, o = {}) {
  const box = el('div', 'k-pan-empty' + (o.cls ? ' ' + o.cls : ''));
  if (o.icon && hasIcon(o.icon)) {
    const ic = el('div', 'k-pan-empty-icon');
    ic.append(iconNode(o.icon, 22));
    box.append(ic);
  }
  box.append(el('div', 'k-pan-empty-text', String(text ?? '')));
  if (o.hint) box.append(el('div', 'k-pan-empty-hint', o.hint));
  if (o.action && typeof o.onAction === 'function') {
    const b = el('button', 'k-ok k-pan-empty-btn', o.action);
    b.type = 'button';
    b.onclick = o.onAction;
    box.append(b);
  }
  return box;
}
