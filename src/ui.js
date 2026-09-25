// UI ประกอบ: dialog ถามข้อความ (แทน prompt ที่ Electron ไม่รองรับ) + เมนูคลิกขวาใน tree

// allowEmpty (alpha.60r2 ข้อ 12): ปกติ "ว่าง" = ยกเลิก — แต่บางช่อง (คำบรรยายรูป) ต้องลบให้ว่างได้
// เปิดแล้ว: ตกลง → คืนสตริง (อาจว่าง) · ยกเลิก/Esc/คลิกนอกกล่อง → คืน null เหมือนเดิม
import { tx, txf } from './i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t as tt, tf as ttf, t, tf, shortcutText } from './i18n.js';
import { splitSpeech, KIND_SPEECH } from './speech-split.js';
import { gi } from './icons.js';                  // [alpha.162 · W5] ไอคอนปิดของ toast
/**
 * [alpha.124 ข้อ 15] ★ Esc ปิดกล่อง — ตัวช่วยกลางตัวเดียวของทั้งโปรแกรม
 *
 * ปัญหาเดิม: กล่องบางใบปิดด้วย Esc ได้ บางใบไม่ได้ (กวาดแล้วพบว่า **26 ไฟล์ที่สร้าง
 * `.k-overlay` ไม่มีคำว่า Escape เลยสักตัว**) ผู้ใช้จึงเดาไม่ถูกว่ากล่องไหนกดได้
 * — ความไม่สม่ำเสมอแบบนี้แพงกว่าการไม่มีฟีเจอร์เลย
 *
 * กติกาสามข้อที่ตัวช่วยนี้การันตี:
 *  1. **ปิดเฉพาะใบบนสุด** — กล่องซ้อนกันได้ (ตั้งค่า → เลือกรูป → ลบ) Esc ต้องลอกทีละใบ
 *  2. **ถอด listener ทิ้งเสมอ** เมื่อกล่องหลุด DOM ไปแล้ว (ตัวเก่าใน confirmBox ค้างสะสม)
 *  3. คืนฟังก์ชันสำหรับถอดเอง เผื่อกล่องที่ปิดด้วยทางอื่น
 *
 * @param {HTMLElement} ov ตัว `.k-overlay`
 * @param {() => void} onEsc สิ่งที่ต้องทำเมื่อกด Esc (ปกติ = ทางเดียวกับปุ่มยกเลิก)
 * @returns {() => void} ถอด listener
 */
export function escClose(ov, onEsc) {
  const off = () => document.removeEventListener('keydown', h, true);
  const h = (e) => {
    if (e.key !== 'Escape') return;
    if (!ov || !document.body.contains(ov)) { off(); return; }   // ปิดไปแล้วด้วยทางอื่น
    // [alpha.162 · W5 ข้อ 3] เมนูคลิกขวาเปิดทับกล่องอยู่ = Esc เป็นของเมนูก่อน (ปิดเมนู ไม่ใช่ปิดกล่อง)
    if (liveMenu()) return;
    const all = [...document.querySelectorAll('.k-overlay')];
    if (all[all.length - 1] !== ov) return;                      // ไม่ใช่ใบบนสุด → ไม่ใช่คิวเรา
    e.preventDefault(); e.stopPropagation();
    off();
    try { onEsc(); } catch {}
  };
  document.addEventListener('keydown', h, true);
  return off;
}

/**
 * ══ [alpha.162 · W4 ข้อ 9] ★★ มาตรฐานของ "กล่อง" ทุกใบ — ติดตั้งที่เดียว ครอบทั้งโปรแกรม ══
 *
 * กล่องในโปรแกรมถูกประกอบด้วยมือ **87 จุด** (`k-overlay` + `k-dialog`) แต่ละที่เลือกเองว่าจะใส่อะไร
 * ผลคือของที่ควรเป็นสัญชาตญาณกลับต้องเดา:
 *   · **Esc ปิดไม่ได้ 23 กล่อง** (starter · กระดานสาขา · ห้องซ้อมบท · ป้ายสี · สรุปด้วย AI …)
 *   · ไม่มี `role="dialog"` / `aria-modal` เลยสักใบ → โปรแกรมอ่านหน้าจออ่านเป็นข้อความลอย ๆ
 *   · โฟกัสไม่เข้ากล่อง (Tab แรกวิ่งไปโดนของหลังกล่อง) และวิ่งหลุดออกนอกกล่องได้
 *
 * แทนที่จะไล่แก้ 87 จุด (และลืมจุดที่ 88 ในรอบหน้า) ใช้ตัวเฝ้า DOM ตัวเดียวที่ "ยกระดับ"
 * ทุก `.k-overlay` ที่ถูกเพิ่มเข้าหน้า — กล่องที่เขียนใหม่ได้ของพวกนี้ฟรีตั้งแต่วันแรก
 *
 * **Esc ที่นี่ไม่ลบกล่องเอง** — มันเดินทางออกที่กล่องนั้นประกาศไว้เองเท่านั้น:
 *   1. ปุ่ม `.k-cancel` (ถ้ามี) → กดให้
 *   2. ไม่มี → กล่องที่ปิดได้ด้วยการคลิกฉากหลัง (`ov.onclick`) ก็ยิงคลิกฉากหลังให้
 *   3. ไม่มีทั้งคู่ = กล่องที่จงใจไม่มีทางถอย (ตัวช่วยหลายขั้น) → **ไม่ทำอะไร** งานจึงไม่หายกลางคัน
 * Enter ก็เช่นกัน: กดปุ่มหลักให้เฉพาะตอนโฟกัสยัง "ไม่อยู่ในช่องกรอกไหน" — ช่องที่จัดการ Enter
 * เองอยู่แล้ว (ask/ค้นหา/ช่องเพิ่มแถว) จึงไม่ถูกยิงซ้ำสองทาง
 */
const A11Y_DONE = '_k2dlg';

/** ของที่โฟกัสได้ในกล่อง เรียงตามลำดับที่ Tab จะวิ่ง (ตัวที่ซ่อนอยู่ไม่นับ) */
function dlgFocusables(box) {
  const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),'
    + ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...box.querySelectorAll(sel)].filter((n) => n.offsetParent !== null);
}

/** ยกระดับกล่องใบเดียว — เรียกซ้ำกับใบเดิมได้ (กันไว้ด้วยธงบนตัว element) */
export function upgradeDialog(ov) {
  if (!ov || ov[A11Y_DONE]) return false;
  const box = ov.querySelector(':scope > div');
  if (!box) return false;
  ov[A11Y_DONE] = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  const ttl = box.querySelector('.k-dlg-title');
  if (ttl) {
    if (!ttl.id) ttl.id = 'k-dlg-t' + (upgradeDialog._n = (upgradeDialog._n || 0) + 1);
    box.setAttribute('aria-labelledby', ttl.id);
  }

  // โฟกัสเริ่มต้น — เฉพาะตอนกล่องยังไม่จัดการเอง (ask/ค้นหา โฟกัสช่องของตัวเองไปแล้ว)
  if (!box.contains(document.activeElement)) {
    // ปุ่มอันตราย (ลบ/ทิ้ง) ไม่เคยเป็นโฟกัสเริ่มต้น — Enter/Space ตามความเคยชินต้องไม่ลบของ
    const first = box.querySelector('input:not([type="hidden"]):not([disabled]), textarea, select')
      || box.querySelector('.k-ok:not([disabled]):not(.k-danger)')
      || box.querySelector('.k-cancel:not([disabled])') || box;
    if (first === box && !box.hasAttribute('tabindex')) box.tabIndex = -1;
    try { first.focus({ preventScroll: true }); } catch {}
  }

  ov.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {                       // กักวงโฟกัสไว้ในกล่อง
      const list = dlgFocusables(box);
      if (list.length < 2) return;
      const first = list[0], last = list[list.length - 1];
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;
    const a = document.activeElement;
    if (a && a !== box && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(a.tagName)) return;  // ของเขาจัดการเอง
    const ok = box.querySelector('.k-ok:not([disabled]):not(.k-danger)');   // ปุ่มลบ/ทิ้ง = ต้องกดตรง ๆ เท่านั้น
    if (!ok) return;
    e.preventDefault();
    ok.click();
  });

  escClose(ov, () => {
    const c = box.querySelector('.k-cancel:not([disabled])');
    if (c) { c.click(); return; }
    if (typeof ov.onclick === 'function') ov.click();   // = คลิกฉากหลัง ทางถอยที่กล่องประกาศไว้เอง
  });
  return true;
}

/**
 * ══ [alpha.162 · W5 ข้อ 1] ★ toast — แจ้งผลของ "งานเบื้องหลัง" ══
 *
 * แถบสถานะเป็นของสิ่งที่ผู้ใช้เพิ่งสั่ง · งานที่โปรแกรมทำเองเงียบ ๆ (สำรองโปรเจกต์รายชั่วโมง ·
 * ส่งออกที่ใช้เวลานาน) ถ้าไปเขียนทับแถบสถานะจะไปลบข้อความของสิ่งที่ผู้ใช้กำลังทำอยู่
 * — เดิมจึงเลือกไม่บอกอะไรเลย: **สำรองรายชั่วโมงล้มก็ไม่มีใครรู้**
 * toast ซ้อนกันได้ที่มุมขวาล่าง ไม่แย่งโฟกัส ไม่บล็อกอะไร · ผิดพลาด = ค้างจนกดปิด
 * @param {string} msg ข้อความที่แปลแล้ว
 * @param {{level?:'info'|'ok'|'error', ttl?:number, action?:{label:string, onClick:Function}}} [o]
 * @returns {HTMLElement|null}
 */
export const TOAST_MAX = 4;
export function toast(msg, o = {}) {
  if (typeof document === 'undefined' || !document.body) return null;
  let host = document.getElementById('k-toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'k-toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const level = o.level || 'info';
  const card = document.createElement('div');
  card.className = 'k-toast k-toast-' + level;
  if (level === 'error') card.setAttribute('role', 'alert');
  const txt = document.createElement('span');
  txt.className = 'k-toast-msg';
  txt.textContent = String(msg == null ? '' : msg);
  card.append(txt);
  const close = () => { card.remove(); };
  if (o.action && o.action.label && typeof o.action.onClick === 'function') {
    const a = document.createElement('button');
    a.type = 'button'; a.className = 'k-toast-act'; a.textContent = o.action.label;
    a.onclick = () => { try { o.action.onClick(); } catch {} close(); };
    card.append(a);
  }
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'k-toast-x'; x.textContent = gi('close');
  x.title = tt('ui.common.close'); x.setAttribute('aria-label', tt('ui.common.close'));
  x.onclick = close;
  card.append(x);
  host.append(card);
  while (host.children.length > TOAST_MAX) host.firstElementChild.remove();   // เก่าสุดออกก่อน
  const ttl = o.ttl != null ? o.ttl : (level === 'error' ? 0 : 5000);
  if (ttl > 0) {
    let timer = setTimeout(close, ttl);
    card.onmouseenter = () => { clearTimeout(timer); };
    card.onmouseleave = () => { timer = setTimeout(close, 1500); };
  }
  return card;
}

/**
 * ══ [alpha.162 · W5 ข้อ 3] แถบเครื่องมือแบบ roving tabindex ══
 *
 * แถบหลักมีปุ่ม 43 ตัว — เดิม Tab ต้องกดผ่านทีละปุ่มกว่าจะถึงเอกสาร/แผงข้างล่าง
 * ตอนนี้ทั้งแถบเป็น "จุดหยุดเดียว" ของ Tab · ←→ Home End เดินในแถบ (ข้ามปุ่มที่ซ่อน/ปิดอยู่)
 * ช่องเลือก (select) ไม่ถูกแย่งลูกศร — ลูกศรในนั้นยังเปลี่ยนค่าตามปกติ
 * ปุ่มถูกซ่อน/เพิ่มระหว่างทาง (โหมดบท · ปุ่มล้นเข้าเมนู ») → ตัวเฝ้าหาจุดหยุดใหม่ให้เอง
 * @param {HTMLElement} bar · @param {string} label ชื่อแถบ (แปลแล้ว)
 */
export function rovingToolbar(bar, label) {
  if (!bar || bar._k2roving) return false;
  bar._k2roving = true;
  bar.setAttribute('role', 'toolbar');
  if (label) bar.setAttribute('aria-label', label);
  const ctrls = () => [...bar.querySelectorAll('button, select')]
    .filter((n) => !n.disabled && n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden');
  let cur = null;
  const settle = () => {
    const list = ctrls();
    if (!list.length) return;
    if (!cur || !list.includes(cur)) cur = list[0];
    for (const n of bar.querySelectorAll('button, select')) n.tabIndex = n === cur ? 0 : -1;
  };
  bar.addEventListener('focusin', (e) => {
    const n = e.target && e.target.closest && e.target.closest('button, select');
    if (n && bar.contains(n)) { cur = n; settle(); }
  });
  bar.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    if (!a || !bar.contains(a) || a.tagName === 'SELECT' || a.tagName === 'INPUT') return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.ctrlKey || e.altKey || e.metaKey) return;
    const list = ctrls();
    const i = list.indexOf(a);
    if (i < 0 || !list.length) return;
    e.preventDefault();
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    cur = list[j]; settle(); cur.focus();
  });
  // ★ ไม่ใช้ MutationObserver — แถบนี้สลับคลาส/สไตล์ปุ่มแทบทุกตัวอักษรที่พิมพ์ (refreshToolbar)
  // ตัวเฝ้าจึงยิงทุกเฟรม + บังคับวัดเลย์เอาต์ปุ่ม ~90 ตัวทุกครั้ง = ทั้งโปรแกรมช้าลงจนเทสที่อิงเวลาแดงสุ่ม
  // จุดหยุดของ Tab ต้องถูกต้องแค่ "ตอนกด Tab" → จัดใหม่ตอนนั้นตอนเดียว (ก่อนเบราว์เซอร์ย้ายโฟกัส)
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab') settle(); }, true);
  settle();
  return true;
}

/** เรียกครั้งเดียวตอนเปิดโปรแกรม — ยกระดับกล่องที่มีอยู่และทุกใบที่จะถูกเพิ่มต่อจากนี้ */
export function installDialogA11y() {
  if (installDialogA11y._on) return false;
  installDialogA11y._on = true;
  document.querySelectorAll('.k-overlay').forEach(upgradeDialog);
  new MutationObserver((recs) => {
    for (const r of recs) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.classList.contains('k-overlay')) upgradeDialog(n);
        else n.querySelectorAll?.('.k-overlay').forEach(upgradeDialog);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  return true;
}

/**
 * @param {object}  opts
 * @param {boolean} opts.multiline [alpha.150] ช่องกรอกเป็นหลายบรรทัด (Enter = ขึ้นบรรทัดใหม่,
 *                  Ctrl+Enter = ตกลง) — ใช้กับรายการสิ่งที่ต้องทำของกระดาน
 */
export function ask(title, { placeholder = '', value = '', okLabel = tt('ui.common.msg3'), allowEmpty = false,
                             multiline = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog';
    box.innerHTML = `<div class="k-dlg-title"></div>
      <input class="k-dlg-input">
      <div class="k-dlg-btns"><button class="k-cancel">${tx('ui.common.cancel')}</button>
      <button class="k-ok"></button></div>`;
    box.querySelector('.k-dlg-title').textContent = title;
    let inp = box.querySelector('.k-dlg-input');
    if (multiline) {
      const ta = document.createElement('textarea');
      ta.className = inp.className + ' k-dlg-multi';
      ta.rows = 10;
      inp.replaceWith(ta);
      inp = ta;
    }
    inp.placeholder = placeholder; inp.value = value;
    box.querySelector('.k-ok').textContent = okLabel;
    ov.appendChild(box); document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    box.querySelector('.k-ok').onclick = () => done(allowEmpty ? inp.value.trim() : (inp.value.trim() || null));
    box.querySelector('.k-cancel').onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    inp.onkeydown = (e) => {
      // หลายบรรทัด: Enter เปล่า ๆ ต้องขึ้นบรรทัดใหม่ ไม่ใช่ปิดกล่อง
      if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        done(allowEmpty ? inp.value.trim() : (inp.value.trim() || null));
      }
      if (e.key === 'Escape') done(null);
    };
    inp.focus(); inp.select();
  });
}

export function confirmBox(title, okLabel = tt('ui.common.del')) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog';
    box.innerHTML = `<div class="k-dlg-title"></div>
      <div class="k-dlg-btns"><button class="k-cancel">${tx('ui.common.cancel')}</button>
      <button class="k-ok k-danger"></button></div>`;
    box.querySelector('.k-dlg-title').textContent = title;
    box.querySelector('.k-ok').textContent = okLabel;
    ov.appendChild(box); document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    box.querySelector('.k-ok').onclick = () => done(true);
    box.querySelector('.k-cancel').onclick = () => done(false);
    ov.onclick = (e) => { if (e.target === ov) done(false); };
    escClose(ov, () => done(false));          // [alpha.124 ข้อ 15] เดิม listener ค้างทุกครั้งที่กดปุ่มปิด
  });
}

/**
 * ══ [alpha.162 · W4] กล่องบอกข้อความของโปรแกรมเอง — แทน `alert()` ของเบราว์เซอร์ ══
 *
 * `alert()` มีปัญหาสามอย่างในแอปจริง: หน้าตาเป็นกล่องของ OS (คนละภาษา คนละธีม) ·
 * **บล็อกทั้ง renderer** (ตัวจับเวลา/งานเบื้องหลังค้างหมดจนกว่าจะกดตกลง) · และกดด้วยคีย์บอร์ด
 * ตามมาตรฐานของกล่องอื่นในโปรแกรมไม่ได้ (Esc ปิด · Enter ยืนยัน · โฟกัสเริ่มต้น)
 * @param {string} title ข้อความ (แปลแล้ว) · @param {{okLabel?:string, detail?:string}} o
 */
export function infoBox(title, o = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog';
    box.innerHTML = `<div class="k-dlg-title"></div><div class="k-hint k-info-detail"></div>
      <div class="k-dlg-btns"><button class="k-ok"></button></div>`;
    box.querySelector('.k-dlg-title').textContent = title;
    const det = box.querySelector('.k-info-detail');
    if (o.detail) det.textContent = o.detail; else det.remove();
    const ok = box.querySelector('.k-ok');
    ok.textContent = o.okLabel || tt('ui.dialogs.ok');
    ov.appendChild(box); document.body.appendChild(ov);
    const done = () => { ov.remove(); resolve(true); };
    ok.onclick = done;
    ov.onclick = (e) => { if (e.target === ov) done(); };
    escClose(ov, done);
    try { ok.focus(); } catch {}
  });
}

let curMenu = null;
// ══ [alpha.157] เมนูย่อยเปิดด้วย hover · ช่องสีสี่เหลี่ยม ══
// ผู้ใช้: *"right click menu ตัวไหนมีต่อ ให้แค่ hover ก็เปิดเลย ไม่ต้องกด click"*
//        *"ตัวที่เป็นสี จะต้องมีสีกำกับก่อนตัวหนังสือ เป็นช่องสี่เหลี่ยม (ของเก่าเป็นแค่ bullet)"*
//
//   `sub`    = ฟังก์ชันคืนรายการ (หรือ Promise ของรายการ) — วาดเป็นเมนูลูกข้างแถวตอนชี้ค้าง
//   `swatch` = สี '#rrggbb' → ช่องสี่เหลี่ยมหน้าข้อความ · `checked` = เครื่องหมายถูกท้ายแถว
//
// เมนูลูกเป็น `.k-menu` ใบที่สองที่ผูกกับใบแม่ (`curSubs`) — ปิดแม่ = ปิดลูกทั้งหมด
// คลิกนอกทุกใบ = ปิดทั้งชุด · ชี้แถวอื่นของแม่ = ปิดลูกที่ค้างอยู่
let curSubs = [];
const SUB_DELAY = 140;

function buildMenuEl(items, depth) {
  const m = document.createElement('div'); m.className = 'k-menu' + (depth ? ' k-submenu' : '');
  m.dataset.depth = String(depth);
  m.setAttribute('role', 'menu');                    // [alpha.162 · W5 ข้อ 3]
  m.tabIndex = -1;
  let hoverJob = null;
  for (const it of items) {
    if (it === '-') {
      const sep = Object.assign(document.createElement('div'), { className: 'k-menu-sep' });
      sep.setAttribute('role', 'separator');
      m.appendChild(sep); continue;
    }
    const d = document.createElement('div');
    // disabled = แถวหัวข้อ/คำอธิบาย (ไม่มี click) — ถ้าไม่กัน onclick จะเรียก it.click() ที่ไม่มีจริงแล้ว throw
    // [alpha.165] รายการคำสั่งที่ "ตอนนี้กดไม่ได้" (มี click แต่ disabled — ตัด/วาง ตอนไม่ได้เลือก · ฉากล็อก) ≠ แถวหัวข้อ
    //   ยังเป็น k-menu-label (กดไม่ได้ · เทสเดิมอ้าง) + k-menu-disabled = ตัวเท่าเดิม สีจาง แบบเมนูของระบบ
    d.className = 'k-menu-item' + (it.danger ? ' k-danger' : '') + (it.disabled ? ' k-menu-label' : '')
      + (it.disabled && it.click ? ' k-menu-disabled' : '')
      + (it.sub ? ' k-menu-has-sub' : '') + (it.checked ? ' k-menu-checked' : '');
    // [alpha.162 · W5 ข้อ 3] ความหมายของแถวสำหรับโปรแกรมอ่านหน้าจอ + โฟกัสได้ด้วยคีย์บอร์ด (tabindex -1 = ลูกศรเท่านั้น)
    d.setAttribute('role', it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem');
    if (it.checked !== undefined) d.setAttribute('aria-checked', it.checked ? 'true' : 'false');
    if (it.disabled) d.setAttribute('aria-disabled', 'true');
    if (it.sub) d.setAttribute('aria-haspopup', 'menu');
    d.tabIndex = -1;
    // [alpha.124 ข้อ 20] `label` เป็น HTML (หลายรายการฝังไอคอน SVG) — รายการที่ข้อความ
    // มาจากผู้ใช้ (คำในเอกสาร · ชื่อไฟล์) ต้องส่งมาทาง `text` เพื่อลง textContent เท่านั้น
    // [alpha.149] คีย์ลัดเป็น **คอลัมน์ชิดขวา** (แบบเมนูเบราว์เซอร์) — ห้ามต่อ "(Ctrl+…)" ท้ายป้ายอีก
    const accel = it.accel || (it.cmd ? shortcutText(it.cmd) : '');
    let host = d;
    if (accel || it.sub || it.swatch !== undefined) {
      d.classList.add('k-menu-has-accel');
      if (it.swatch !== undefined) {
        const sw = document.createElement('span');
        sw.className = 'k-menu-swatch' + (it.swatch ? '' : ' k-menu-swatch-none');
        if (it.swatch) sw.style.background = it.swatch;
        d.appendChild(sw);
      }
      host = document.createElement('span');
      host.className = 'k-menu-text';
      d.appendChild(host);
    }
    if (it.text !== undefined) host.textContent = it.text;
    else host.innerHTML = it.label;
    if (accel) {
      const k = document.createElement('span');
      k.className = 'k-menu-accel';
      k.textContent = accel;
      d.appendChild(k);
    }
    if (it.sub) {
      const arrow = document.createElement('span');
      arrow.className = 'k-menu-arrow';
      d.appendChild(arrow);
    }
    if (it.sub) {
      const open = () => openSub(d, it, depth);
      d.addEventListener('mouseenter', () => { clearTimeout(hoverJob); hoverJob = setTimeout(open, SUB_DELAY); });
      d.addEventListener('mouseleave', () => clearTimeout(hoverJob));
      d.onclick = (e) => { e.stopPropagation(); clearTimeout(hoverJob); open(); };
    } else {
      // ชี้แถวธรรมดา = ปิดเมนูลูกที่ค้างจากแถวอื่น
      d.addEventListener('mouseenter', () => { clearTimeout(hoverJob); hoverJob = setTimeout(() => closeSubsFrom(depth + 1), SUB_DELAY); });
      if (!it.disabled) d.onclick = () => { closeMenu(); it.click(); };
    }
    m.appendChild(d);
  }
  return m;
}

function placeMenu(m, x, y) {
  // [alpha.161 · P5] สูงไม่เกินจอ (เลื่อนในเมนูได้) — กำหนดก่อนวัด ตำแหน่งที่หนีบจะได้คิดจากความสูงจริง
  m.style.maxHeight = Math.max(120, window.innerHeight - 16) + 'px';
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
}

function closeSubsFrom(depth) {
  const keep = [];
  for (const sm of curSubs) {
    if (+sm.dataset.depth >= depth) { sm.remove(); if (sm._owner) sm._owner.classList.remove('k-menu-open'); }
    else keep.push(sm);
  }
  curSubs = keep;
}

async function openSub(row, it, depth) {
  if (row.classList.contains('k-menu-open') && curSubs.some((sm) => sm._owner === row)) return;
  closeSubsFrom(depth + 1);
  row.classList.add('k-menu-open');
  const token = {};
  row._subToken = token;
  let items = null;
  try { items = await it.sub(); } catch { items = null; }
  // ระหว่างรอ ผู้ใช้อาจย้ายไปชี้แถวอื่น/ปิดเมนูไปแล้ว
  if (row._subToken !== token || !row.isConnected || !row.classList.contains('k-menu-open')) return;
  // [alpha.164 · รอบต่อ 3] เมนูลูกที่ไม่มีรายการ (ยังไม่มีสำรอง · ไม่มีปลายทางให้ย้าย) เคย "เงียบ" —
  // กดแล้วไม่มีอะไรเกิดขึ้นจนดูเหมือนเมนูพัง → โชว์แถวเทา "(ว่าง)" แทน
  if (!items || !items.length) items = [{ text: tt('ui.common.empty'), disabled: true, click: () => {} }];
  const sm = buildMenuEl(items, depth + 1);
  sm._owner = row;
  document.body.appendChild(sm);
  const rr = row.getBoundingClientRect();
  const sr = sm.getBoundingClientRect();
  // ขวาของแถวก่อน · ชนขอบจอ = พลิกไปซ้าย
  let x = rr.right + 2;
  if (x + sr.width > window.innerWidth - 8) x = Math.max(4, rr.left - sr.width - 2);
  sm.style.left = x + 'px';
  sm.style.top = Math.max(4, Math.min(rr.top - 5, window.innerHeight - sr.height - 8)) + 'px';
  curSubs.push(sm);
  if (_mk.focusSub) { _mk.focusSub = false; const first = menuActionable(sm)[0]; if (first) first.focus(); }
}

export function popupMenu(x, y, items) {
  // [alpha.157] ตัวเก็บรายการของเมนูย่อย — ฟังก์ชันเดิมที่ "เปิดเมนูที่ตำแหน่งคลิก" ใช้ซ้ำเป็นเมนูลูกได้
  if (_capture) { const c = _capture; _capture = null; c(items); return; }
  closeMenu();
  hideHoverTip();
  const m = buildMenuEl(items, 0);
  document.body.appendChild(m);
  placeMenu(m, x, y);
  curMenu = m;
  // [alpha.162 · W5 ข้อ 3] ไม่ดึงโฟกัสตอนเปิด (คลิกขวาในเอกสารแล้วตัวแก้ไขต้องไม่เสียโฟกัสเปล่า ๆ)
  // ลูกศรตัวแรกค่อยพาโฟกัสเข้าเมนู · ปิดเมนูแล้วคืนโฟกัสที่เดิม
  _mk.prevFocus = document.activeElement;
  document.addEventListener('keydown', onMenuKey, true);
  setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
}

// ══ [alpha.162 · W5 ข้อ 3] ★ เมนูคลิกขวาใช้ด้วยคีย์บอร์ดได้ ══
// เดิม: เปิดเมนูแล้ว Esc ก็ปิดไม่ได้ · ลูกศรไปขยับเคอร์เซอร์ในเอกสารข้างหลังแทน · Enter พิมพ์ขึ้นบรรทัดใหม่
// ตอนนี้ระหว่างที่เมนูเปิด ลูกศร/Enter/Esc/Tab เป็นของเมนู (ดักระยะ capture — ไม่หลุดไปถึงเอกสาร)
//   ↑↓ Home End = เลื่อนแถว (ข้ามแถวหัวข้อ) · → / Enter บนแถวที่มีต่อ = เปิดเมนูลูก
//   ← / Esc ในเมนูลูก = ปิดชั้นนั้นกลับแถวแม่ · Esc ชั้นนอกสุด / Tab = ปิดเมนูทั้งชุด
const _mk = { prevFocus: null, focusSub: false };
function menuActionable(m) {
  return m ? [...m.querySelectorAll(':scope > .k-menu-item:not(.k-menu-label)')] : [];
}
function menuStack() {
  const subs = curSubs.slice().sort((a, b) => (+a.dataset.depth) - (+b.dataset.depth));
  return [curMenu, ...subs].filter(Boolean);
}
function closeSubLevel(top) {
  const owner = top && top._owner;
  closeSubsFrom(+top.dataset.depth);
  if (owner) owner.focus();
}
function onMenuKey(e) {
  if (!liveMenu()) return;
  const stack = menuStack();
  const top = stack[stack.length - 1];
  const items = menuActionable(top);
  const cur = items.indexOf(document.activeElement);
  const eat = () => { e.preventDefault(); e.stopPropagation(); };
  const k = e.key;
  if (k === 'Escape') {
    eat();
    if (stack.length > 1) closeSubLevel(top); else closeMenu();
    return;
  }
  if (k === 'Tab') { eat(); closeMenu(); return; }
  if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') {
    eat();
    if (!items.length) return;
    let j;
    if (k === 'Home') j = 0;
    else if (k === 'End') j = items.length - 1;
    else if (cur < 0) j = k === 'ArrowDown' ? 0 : items.length - 1;
    else j = (cur + (k === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[j].focus();
    return;
  }
  if (k === 'ArrowLeft') { if (stack.length > 1) { eat(); closeSubLevel(top); } return; }
  const row = cur >= 0 ? items[cur] : null;
  if (!row) return;
  if (k === 'ArrowRight' || k === 'Enter' || k === ' ') {
    if (k === 'ArrowRight' && !row.classList.contains('k-menu-has-sub')) return;
    eat();
    if (row.classList.contains('k-menu-has-sub')) _mk.focusSub = true;
    row.click();
  }
}

// ══ [alpha.157] ใช้ฟังก์ชันที่ "เปิดเมนูเอง" เป็นเมนูย่อย ══
// เมนูสี/สถานะ/ย้ายไป/กู้คืน ของ Explorer ถูกเขียนเป็น `popupMenu(e.clientX, e.clientY, …)` ทั้งหมด
// (มีทั้งแบบ sync และแบบ await ไฟล์ก่อน) — แทนที่จะแยกทุกตัวเป็นสองร่าง ใช้ตัวดักตัวเดียว:
// ระหว่างที่ `fn` ทำงาน การเรียก popupMenu **ครั้งแรก** จะคืนรายการมาแทนการเปิดเมนู
// fn ไม่เรียก popupMenu เลย (เช่น "ไม่มีเล่มอื่นให้ย้าย" แล้วขึ้นแถบสถานะ) = ไม่มีเมนูลูก
let _capture = null;
let _captureChain = Promise.resolve();
export function menuItemsOf(fn) {
  const run = () => new Promise((resolve) => {
    let done = false;
    const finish = (items) => { if (done) return; done = true; if (_capture === finish) _capture = null; resolve(items || null); };
    _capture = finish;
    Promise.resolve().then(fn).then(() => finish(null), () => finish(null));
  });
  const p = _captureChain.then(run, run);
  _captureChain = p.then(() => {}, () => {});
  return p;
}

// [alpha.157] ทูลทิปต้องไม่ขึ้นทับเมนูคลิกขวา — ตัวซ่อนอยู่ใน app.js (ลงทะเบียนตอนบูต)
let _hideTip = null;
export function setHoverTipHider(fn) { _hideTip = fn; }
function hideHoverTip() { try { if (_hideTip) _hideTip(); } catch {} }
/** มีเมนูคลิกขวาเปิดอยู่ไหม (ตัวดัก tooltip ถามตัวนี้) */
export function menuOpen() { return !!liveMenu(); }
/**
 * [alpha.162 · W5 ข้อ 3] เมนูที่ "ยังอยู่บนหน้าจริง" — ถูกถอดออกด้วยทางอื่น (โค้ดที่ลบ `.k-menu` ตรง ๆ
 * โดยไม่ผ่าน closeMenu) = ถือว่าปิดแล้ว และเก็บกวาดตัวดักคีย์ให้เลย
 * ★ ไม่งั้นตัวดักลูกศรของเมนูค้างอยู่ **กินลูกศรทั้งโปรแกรม** (Explorer เดินด้วยลูกศรไม่ได้ ·
 *   e2e [161-K1] จับได้) · Esc ของกล่องถูกบล็อก · ทูลทิปไม่ขึ้นอีกเลย
 */
function liveMenu() {
  if (curMenu && !curMenu.isConnected) closeMenu();
  return curMenu;
}

function onDoc(e) {
  if (!liveMenu()) return;
  if (curMenu.contains(e.target) || curSubs.some((sm) => sm.contains(e.target))) return;
  closeMenu();
}
export function closeMenu() {
  // โฟกัสอยู่ในเมนู/เมนูลูก (ผู้ใช้เดินด้วยลูกศร) → คืนที่เดิมหลังลบเมนูทิ้ง ไม่งั้นโฟกัสหล่นไปที่ <body>
  // (ต้องวัดก่อน closeSubsFrom — ลบเมนูลูกแล้วโฟกัสที่อยู่ในนั้นหายไปก่อน)
  const ae = document.activeElement;
  const inMenu = !!curMenu && (curMenu.contains(ae) || curSubs.some((sm) => sm.contains(ae)));
  closeSubsFrom(0);
  if (curMenu) {
    curMenu.remove(); curMenu = null;
    document.removeEventListener('mousedown', onDoc);
    document.removeEventListener('keydown', onMenuKey, true);
    const back = _mk.prevFocus;
    _mk.prevFocus = null; _mk.focusSub = false;
    if (inMenu && back && back.isConnected && typeof back.focus === 'function') { try { back.focus({ preventScroll: true }); } catch {} }
  }
}

export function choose(title, options) {
  // options: [{label, value, danger?, primary?}]
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog';
    const t = document.createElement('div'); t.className = 'k-dlg-title'; t.textContent = title;
    const btns = document.createElement('div'); btns.className = 'k-dlg-btns';
    box.append(t, btns); ov.appendChild(box); document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    for (const op of options) {
      const b = document.createElement('button');
      b.textContent = op.label;
      if (op.primary) b.className = 'k-ok';
      if (op.danger) b.className = 'k-ok k-danger';
      b.onclick = () => done(op.value);
      btns.appendChild(b);
    }
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    escClose(ov, () => done(null));            // [alpha.124 ข้อ 15]
  });
}

/**
 * บั๊ก #3: กล่อง "บันทึกทั้งหมด" ที่บอกด้วยว่าไฟล์ไหนบ้างค้างอยู่
 * เดิมใช้ choose() บอกแค่จำนวนแท็บ → ผู้ใช้ต้องเดาว่ากำลังจะทิ้งงานอะไร
 *
 * @param {Array<{key:string,title:string,file:string}>} files รายการไฟล์ที่ยังไม่บันทึก
 * @returns {Promise<{action:'save'|'discard'|null, keys:string[]}>} keys = เฉพาะที่ติ๊กไว้
 */
export function saveAllDialog(files, {
  title = '', saveLabel = tt('ui.common.saveAll'),
  discardLabel = tt('ui.ui.notSave'), cancelLabel = tt('ui.common.cancel'),
} = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog k-saveall';
    const head = document.createElement('div');
    head.className = 'k-dlg-title';
    head.textContent = title || ttf('ui.ui.hasFileCantSave', files.length);

    const list = document.createElement('div'); list.className = 'k-saveall-list';
    const boxes = [];
    for (const f of files) {
      const row = document.createElement('label'); row.className = 'k-saveall-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true; cb.dataset.key = f.key;
      const txt = document.createElement('div'); txt.className = 'k-saveall-txt';
      const nm = document.createElement('div'); nm.className = 'k-saveall-name';
      nm.textContent = f.title || f.key;
      const pt = document.createElement('div'); pt.className = 'k-saveall-path';
      // [alpha.164 · รอบต่อ 3] isolate LTR — กล rtl (ตัดหัว) เคยย้าย "/" นำหน้าไปไว้ท้ายทาง
      const bdi = document.createElement('bdi'); bdi.dir = 'ltr'; bdi.textContent = f.file || '';
      pt.append(bdi);
      pt.title = f.file || '';
      txt.append(nm, pt);
      row.append(cb, txt); list.append(row);
      boxes.push(cb);
    }

    const btns = document.createElement('div'); btns.className = 'k-dlg-btns';
    const bSave = document.createElement('button'); bSave.className = 'k-ok';
    // [alpha.162 · W4 ข้อ 9] "ไม่บันทึก" **ไม่ใช่ปุ่มหลัก** → ไม่ติด `k-ok` (สีแดงจาก k-danger อย่างเดียว)
    // ทั้งโปรแกรม (และเทส) ถือว่า `.k-ok` ตัวแรกของกล่อง = ทางหลัก — พอปุ่มหลักย้ายไปขวาสุด
    // ปุ่มทิ้งงานที่ติด k-ok ด้วยจะกลายเป็น "ตัวแรก" แทนปุ่มบันทึก (e2e จับได้ตอนสลับด้าน)
    const bDiscard = document.createElement('button'); bDiscard.className = 'k-danger k-discard';
    bDiscard.textContent = discardLabel;
    const bCancel = document.createElement('button'); bCancel.className = 'k-cancel';
    bCancel.textContent = cancelLabel;
    // [alpha.162 · W4 ข้อ 9] ปุ่มหลักอยู่ขวาสุดเหมือนกล่องอื่นทั้งโปรแกรม (เดิมบันทึกอยู่ซ้ายสุด
    // — กล่องนี้เป็นกล่องเดียวที่สลับด้าน ผู้ใช้ที่เล็งปุ่มขวาโดยไม่อ่านจึง **ทิ้งงานทั้งกอง**)
    btns.append(bCancel, bDiscard, bSave);

    // ป้ายปุ่มบันทึกสะท้อนจำนวนที่ติ๊กไว้จริง (ติ๊กครบ = "บันทึกทั้งหมด" ตามเดิม)
    const sel = () => boxes.filter((c) => c.checked).map((c) => c.dataset.key);
    const sync = () => {
      const n = sel().length;
      bSave.textContent = n === boxes.length ? saveLabel : ttf('ui.ui.savePick', n);
      bSave.disabled = n === 0;
    };
    boxes.forEach((c) => { c.onchange = sync; });
    sync();

    box.append(head, list, btns); ov.appendChild(box); document.body.appendChild(ov);
    const done = (action) => { ov.remove(); resolve({ action, keys: action === 'save' ? sel() : [] }); };
    bSave.onclick = () => done('save');
    bDiscard.onclick = () => done('discard');
    bCancel.onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); });
    bSave.focus();
  });
}

// ══════════ [alpha.123] วาดข้อความที่มีบทพูดเป็นตัวเอียง ══════════
//
// ผู้ใช้: *"ในการเล่น หรือซ้อมบท AI เราจะให้คำพูดเป็นตัวเอียงได้มั้ย เกิดเราจะต่อยอด ใส่เสียงลงไป"*
//
// ใช้ร่วมกันสองที่: แชท Game Master (Story Starter) · ห้องซ้อมบท
// ตรรกะการแยกอยู่ใน `speech-split.js` ซึ่งบริสุทธิ์และมีเทส — ที่นี่แค่แปลงเป็นโหนด
// (**ห้ามใช้ innerHTML** — ข้อความมาจากโมเดล อาจมี `<` `&` ปนมาได้ทุกเมื่อ)

/** @returns {DocumentFragment} */
export function speechNodes(text) {
  const frag = document.createDocumentFragment();
  for (const p of splitSpeech(text)) {
    if (p.kind === KIND_SPEECH) {
      const i = document.createElement('i');
      i.className = 'k-speech';
      i.textContent = p.text;
      frag.append(i);
    } else {
      frag.append(document.createTextNode(p.text));
    }
  }
  return frag;
}

/** ยัดข้อความลงกล่องเดิมโดยทำบทพูดเป็นตัวเอียง (ล้างของเก่าก่อนเสมอ) */
export function setSpeechText(node, text) {
  if (!node) return node;
  node.replaceChildren(speechNodes(text));
  return node;
}
