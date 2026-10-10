// key-echo.js — [alpha.169 · a11y] แสดงปุ่มที่กดเป็นตัวใหญ่บนจอ (ชั้นบนสุดของหน้าต่าง)
//
// ผู้ใช้: *"เมื่อกดปุ่ม ตัวอักษรจะ display ตัวใหญ่ ๆ กลางหน้าจอ เป็น layer บนสุด เอาไว้สำหรับผู้มองไม่เห็น keyboard"*
//
// · ตรรกะ "ปุ่ม → ข้อความ" อยู่ `a11y-core.js` (unit test) — ที่นี่แค่ฟัง keydown แล้ววาด
// · ป้ายเป็นลูกของ <body> · `position:fixed` · `pointer-events:none` → ไม่รับคลิก ไม่แย่งโฟกัส ไม่อยู่ในลำดับ Tab
// · ฟังที่ window ระยะ capture → เห็นทุกปุ่มแม้ตัวอื่นจะ stopPropagation (กล่องโต้ตอบ · เมนู · ตัวแก้ไข)
// · **ไม่ใช่คีย์ลัด** (กฎข้อ 8 ห้ามผูก keydown เองสำหรับคีย์ลัด) — ตัวนี้แค่ "ดู" ไม่ preventDefault ไม่สั่งงานอะไร
// · ช่องรหัสผ่าน/คีย์ AI ไม่ถูกโชว์ (คนข้าง ๆ อ่านจากจอได้)
import { el } from '../core.js';
import { keyEchoParts, isSecretField, normA11y, fitKeyEchoSize } from './a11y-core.js';

const HOST_ID = 'k-key-echo';
const isMac = (() => { try { return navigator.platform.toLowerCase().includes('mac'); } catch { return false; } })();

let _cfg = normA11y(null);
let _bound = false;
let _timer = 0;
let _last = null;          // ผลล่าสุดที่โชว์ (เทสอ่าน)

function hostEl(make) {
  let h = document.getElementById(HOST_ID);
  if (!h && make && document.body) {
    h = el('div', 'k-key-echo');
    h.id = HOST_ID;
    h.setAttribute('aria-hidden', 'true');      // ตัวช่วยทางสายตา — โปรแกรมอ่านจออ่านปุ่มเองอยู่แล้ว
    h.append(el('div', 'k-key-echo-cap'));
    document.body.appendChild(h);
  }
  return h || null;
}

function paint(res, cfg) {
  const h = hostEl(true);
  if (!h) return false;
  const cap = h.firstElementChild;
  cap.replaceChildren();
  res.parts.forEach((p, i) => {
    if (i) cap.append(el('span', 'k-key-echo-plus', '+'));
    cap.append(el('span', 'k-key-echo-key', p));
  });
  // ข้อความยาว (Ctrl + Shift + Backspace) ย่อตัวอักษรลงให้พอดีจอ — ตัวอักษรเดี่ยวได้ขนาดเต็มที่ตั้งไว้
  const len = res.parts.join('').length + (res.parts.length - 1) * 2;
  const scale = len <= 2 ? 1 : Math.max(0.3, Math.min(1, 5 / len));
  h.style.setProperty('--ke-size', fitKeyEchoSize(cfg.keyEchoSize * scale, len, window.innerWidth, window.innerHeight) + 'px');
  h.dataset.pos = cfg.keyEchoPos;
  h.dataset.kind = res.kind;
  h.classList.add('on');
  _last = { text: res.parts.join(' + '), kind: res.kind, at: Date.now() };
  clearTimeout(_timer);
  _timer = setTimeout(hideKeyEcho, cfg.keyEchoMs);
  return true;
}

/** ซ่อนป้ายทันที */
export function hideKeyEcho() {
  clearTimeout(_timer); _timer = 0;
  const h = hostEl(false);
  if (h) h.classList.remove('on');
}

function onKey(ev) {
  if (!_cfg.keyEcho) return;
  if (isSecretField(ev.target)) { hideKeyEcho(); return; }
  const res = keyEchoParts(ev, { mac: isMac, mode: _cfg.keyEchoMode });
  if (res) paint(res, _cfg);
}

/**
 * ใช้ค่าจาก settings — เรียกจาก applySettings() ทุกครั้งที่ค่าเปลี่ยน/เปิดโปรเจกต์
 * @returns {boolean} เปิดอยู่ไหม
 */
export function applyKeyEcho(settings) {
  _cfg = normA11y(settings);
  if (_cfg.keyEcho && !_bound) {
    window.addEventListener('keydown', onKey, true);
    _bound = true;
  }
  if (!_cfg.keyEcho) hideKeyEcho();
  return _cfg.keyEcho;
}

/**
 * โชว์ตัวอย่างด้วยค่าที่ยังไม่ได้บันทึก (ปุ่ม "ลองดู" ในกล่องตั้งค่า) — ไม่แตะสถานะเปิด/ปิดจริง
 * @param {object} settings ค่าที่อยู่ในช่องของกล่องตั้งค่า
 * @param {string[]} parts ข้อความบนป้าย
 */
export function previewKeyEcho(settings, parts) {
  const cfg = normA11y(settings);
  return paint({ parts: (parts && parts.length ? parts : ['A']).map(String), kind: 'char' }, cfg);
}

/** สภาพปัจจุบัน (เทส/แถบสถานะ) */
export function keyEchoState() {
  const h = hostEl(false);
  return { on: _cfg.keyEcho, bound: _bound, visible: !!(h && h.classList.contains('on')),
           text: _last ? _last.text : '', kind: _last ? _last.kind : '', pos: h ? h.dataset.pos || '' : '' };
}
