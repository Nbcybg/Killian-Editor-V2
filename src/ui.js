// UI ประกอบ: dialog ถามข้อความ (แทน prompt ที่ Electron ไม่รองรับ) + เมนูคลิกขวาใน tree

// allowEmpty (alpha.60r2 ข้อ 12): ปกติ "ว่าง" = ยกเลิก — แต่บางช่อง (คำบรรยายรูป) ต้องลบให้ว่างได้
// เปิดแล้ว: ตกลง → คืนสตริง (อาจว่าง) · ยกเลิก/Esc/คลิกนอกกล่อง → คืน null เหมือนเดิม
import { t as tt, tf as ttf, t, tf } from './i18n.js';
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
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); done(false); }
    });
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
    d.innerHTML = it.label;
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
