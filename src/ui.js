// UI ประกอบ: dialog ถามข้อความ (แทน prompt ที่ Electron ไม่รองรับ) + เมนูคลิกขวาใน tree

// allowEmpty (alpha.60r2 ข้อ 12): ปกติ "ว่าง" = ยกเลิก — แต่บางช่อง (คำบรรยายรูป) ต้องลบให้ว่างได้
// เปิดแล้ว: ตกลง → คืนสตริง (อาจว่าง) · ยกเลิก/Esc/คลิกนอกกล่อง → คืน null เหมือนเดิม
import { t as tt, tf as ttf, t, tf } from './i18n.js';
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

export function ask(title, { placeholder = '', value = '', okLabel = tt('ui.common.msg3'), allowEmpty = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog';
    box.innerHTML = tt('ui.ui.cancel2');
    box.querySelector('.k-dlg-title').textContent = title;
    const inp = box.querySelector('.k-dlg-input');
    inp.placeholder = placeholder; inp.value = value;
    box.querySelector('.k-ok').textContent = okLabel;
    ov.appendChild(box); document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    box.querySelector('.k-ok').onclick = () => done(allowEmpty ? inp.value.trim() : (inp.value.trim() || null));
    box.querySelector('.k-cancel').onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') done(allowEmpty ? inp.value.trim() : (inp.value.trim() || null));
      if (e.key === 'Escape') done(null);
    };
    inp.focus(); inp.select();
  });
}

export function confirmBox(title, okLabel = tt('ui.common.del')) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'k-overlay';
    const box = document.createElement('div'); box.className = 'k-dialog';
    box.innerHTML = tt('ui.ui.cancel');
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
export function popupMenu(x, y, items) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'k-menu';
  for (const it of items) {
    if (it === '-') { m.appendChild(Object.assign(document.createElement('div'), { className: 'k-menu-sep' })); continue; }
    const d = document.createElement('div');
    // disabled = แถวหัวข้อ/คำอธิบาย (ไม่มี click) — ถ้าไม่กัน onclick จะเรียก it.click() ที่ไม่มีจริงแล้ว throw
    d.className = 'k-menu-item' + (it.danger ? ' k-danger' : '') + (it.disabled ? ' k-menu-label' : '');
    // [alpha.124 ข้อ 20] `label` เป็น HTML (หลายรายการฝังไอคอน SVG) — รายการที่ข้อความ
    // มาจากผู้ใช้ (คำในเอกสาร · ชื่อไฟล์) ต้องส่งมาทาง `text` เพื่อลง textContent เท่านั้น
    if (it.text !== undefined) d.textContent = it.text;
    else d.innerHTML = it.label;
    if (!it.disabled) d.onclick = () => { closeMenu(); it.click(); };
    m.appendChild(d);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  curMenu = m;
  setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
}
function onDoc(e) { if (curMenu && !curMenu.contains(e.target)) closeMenu(); }
export function closeMenu() {
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
