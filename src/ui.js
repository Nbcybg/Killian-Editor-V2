// UI ประกอบ: dialog ถามข้อความ (แทน prompt ที่ Electron ไม่รองรับ) + เมนูคลิกขวาใน tree

// allowEmpty (alpha.60r2 ข้อ 12): ปกติ "ว่าง" = ยกเลิก — แต่บางช่อง (คำบรรยายรูป) ต้องลบให้ว่างได้
// เปิดแล้ว: ตกลง → คืนสตริง (อาจว่าง) · ยกเลิก/Esc/คลิกนอกกล่อง → คืน null เหมือนเดิม
import { tx, txf } from './i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t as tt, tf as ttf, t, tf, shortcutText } from './i18n.js';
import { splitSpeech, KIND_SPEECH } from './speech-split.js';
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
  let hoverJob = null;
  for (const it of items) {
    if (it === '-') { m.appendChild(Object.assign(document.createElement('div'), { className: 'k-menu-sep' })); continue; }
    const d = document.createElement('div');
    // disabled = แถวหัวข้อ/คำอธิบาย (ไม่มี click) — ถ้าไม่กัน onclick จะเรียก it.click() ที่ไม่มีจริงแล้ว throw
    d.className = 'k-menu-item' + (it.danger ? ' k-danger' : '') + (it.disabled ? ' k-menu-label' : '')
      + (it.sub ? ' k-menu-has-sub' : '') + (it.checked ? ' k-menu-checked' : '');
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
  if (!items || !items.length) { row.classList.remove('k-menu-open'); return; }
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
  setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
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
export function menuOpen() { return !!curMenu; }

function onDoc(e) {
  if (!curMenu) return;
  if (curMenu.contains(e.target) || curSubs.some((sm) => sm.contains(e.target))) return;
  closeMenu();
}
export function closeMenu() {
  closeSubsFrom(0);
  if (curMenu) { curMenu.remove(); curMenu = null; document.removeEventListener('mousedown', onDoc); }
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
      pt.textContent = f.file || '';
      pt.title = f.file || '';
      txt.append(nm, pt);
      row.append(cb, txt); list.append(row);
      boxes.push(cb);
    }

    const btns = document.createElement('div'); btns.className = 'k-dlg-btns';
    const bSave = document.createElement('button'); bSave.className = 'k-ok';
    const bDiscard = document.createElement('button'); bDiscard.className = 'k-ok k-danger';
    bDiscard.textContent = discardLabel;
    const bCancel = document.createElement('button'); bCancel.className = 'k-cancel';
    bCancel.textContent = cancelLabel;
    btns.append(bSave, bDiscard, bCancel);

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
