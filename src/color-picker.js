// color-picker.js — [alpha.132 ข้อ 9] ป๊อปอัปเลือก "สีตัวอักษร"
//
// ผู้ใช้จริงขอมา: *"เพิ่มเปลี่ยนสีตัวอักษรให้หน่อย มี preset และ color wheel
//                  และมี save color switch และ recent used ให้ด้วยนะ"*
//
// ชั้นนี้แตะ DOM อย่างเดียว — ตรรกะทั้งหมด (ตรวจค่าสี · จานสี · รายการที่บันทึก/ใช้ล่าสุด)
// อยู่ใน `text-color.js` ซึ่งบริสุทธิ์และมี unit test แยก
//
// **ที่เก็บข้อมูล**: `settings.textColors = { saved:[], recent:[] }` — เก็บเป็นค่า **global**
// (`userData/settings.json` ผ่าน `saveGlobalSetting`) เพราะจานสีของนักเขียนคนหนึ่งควรตามไป
// ทุกโปรเจกต์ เหมือนสีกระดาษ/ฟอนต์ · ไม่ใช้ localStorage ซึ่งหายเมื่อย้ายเครื่อง

import { t as tt } from './i18n.js';
import { el, state } from './core.js';
import { COLOR_PRESETS, presetLabelKey, normColor, pushRecent, toggleSaved,
         normalizeColorStore } from './text-color.js';

let curPop = null;

/** ปิดป๊อปอัปสีที่เปิดค้างอยู่ (ถ้ามี) */
export function closeColorPicker() {
  if (curPop) { curPop.remove(); curPop = null; document.removeEventListener('mousedown', onDoc); }
}
function onDoc(e) {
  // คลิกนอกป๊อปอัป = ปิด · แต่ตัว `<input type="color">` เปิดหน้าต่างเลือกสีของระบบ
  // ซึ่งอยู่นอก DOM ของเรา — ต้องไม่ให้การคลิกในนั้นมาปิดป๊อปอัปทิ้ง
  if (curPop && !curPop.contains(e.target)) closeColorPicker();
}

/** ค่าสีที่บันทึกไว้/ใช้ล่าสุด — อ่านจากการตั้งค่าเสมอ (ค่าขยะถูกกรองทิ้ง) */
export function colorStore() {
  return normalizeColorStore((state.settings || {}).textColors);
}

/**
 * เขียนค่ากลับลงการตั้งค่าระดับผู้ใช้
 * @param {{saved:string[], recent:string[]}} next
 * @param {(key:string,value:any)=>Promise} [saveGlobal] ตัวบันทึก global (ส่งมาจาก app.js)
 */
export async function saveColorStore(next, saveGlobal) {
  if (!state.settings) return false;
  const v = normalizeColorStore(next);
  state.settings.textColors = v;
  if (typeof saveGlobal === 'function') await saveGlobal('textColors', v);
  return true;
}

/** ปุ่มสี่เหลี่ยมสีหนึ่งช่อง (ช่องที่ตรงกับสีปัจจุบันมีขอบเน้น) */
function swatch(hex, { current = '', title = '', onPick } = {}) {
  const b = el('button', 'k-sw' + (current && normColor(hex) === normColor(current) ? ' on' : ''));
  b.type = 'button';
  b.style.background = hex;
  b.title = title || hex;
  b.dataset.color = hex;
  b.onclick = () => onPick(hex);
  return b;
}

/**
 * เปิดป๊อปอัปเลือกสีใต้ปุ่มที่กด
 * @param {HTMLElement} anchor  ปุ่มที่เป็นจุดยึด (ไม่มี = กลางจอ)
 * @param {string} current      สีปัจจุบันของช่วงที่เลือก ('' = ไม่มีสี)
 * @param {(hex:string)=>void} apply  เรียกเมื่อผู้ใช้เลือกสี ('' = ล้างสี)
 * @param {Function} [saveGlobal]     ตัวบันทึกการตั้งค่าระดับผู้ใช้ (ส่งมาจาก app.js)
 */
export function openColorPicker(anchor, current, apply, saveGlobal) {
  closeColorPicker();
  const store = colorStore();
  const pop = el('div', 'k-menu k-colorpop');
  curPop = pop;

  const use = async (hex) => {
    const c = normColor(hex);
    apply(c);
    if (c) await saveColorStore({ ...colorStore(), recent: pushRecent(colorStore().recent, c) },
                                saveGlobal);
    closeColorPicker();
  };

  const section = (labelKey, list) => {
    const wrap = el('div', 'k-colorsec');
    wrap.append(el('div', 'k-colorsec-lbl', tt(labelKey)));
    const row = el('div', 'k-colorrow');
    if (!list.length) row.append(el('span', 'dim k-colorempty', tt('ui.color.none')));
    for (const hex of list) {
      const key = presetLabelKey(hex);
      row.append(swatch(hex, { current, title: key ? tt(key) : hex, onPick: use }));
    }
    wrap.append(row);
    return wrap;
  };

  pop.append(section('ui.color.presets', COLOR_PRESETS.map((p) => p.hex)));
  let secSaved = section('ui.color.saved', store.saved);
  secSaved.classList.add('k-colorsec-saved');
  pop.append(secSaved);
  pop.append(section('ui.color.recent', store.recent));

  // ── color wheel ของระบบ + ช่องพิมพ์รหัสสีเอง ──
  const wheelRow = el('div', 'k-colorrow k-colorwheel');
  const inp = el('input', 'k-color-input');
  inp.type = 'color';
  inp.value = normColor(current) || '#b03030';
  const hex = el('input', 'k-dlg-input k-color-hex');
  hex.value = inp.value;
  hex.spellcheck = false;
  inp.oninput = () => { hex.value = inp.value; };
  hex.oninput = () => { const c = normColor(hex.value); if (c) inp.value = c; };
  const bUse = el('button', 'k-ok k-color-use', tt('ui.color.use'));
  bUse.type = 'button';
  bUse.onclick = () => use(normColor(hex.value) || inp.value);
  const bSave = el('button', 'k-color-save', tt('ui.color.save'));
  bSave.type = 'button';
  bSave.title = tt('ui.color.saveHint');
  bSave.onclick = async () => {
    const c = normColor(hex.value) || normColor(inp.value);
    if (!c) return;
    const st = colorStore();
    await saveColorStore({ ...st, saved: toggleSaved(st.saved, c) }, saveGlobal);
    // วาดแถว "บันทึกไว้" ใหม่ทันที โดยไม่ปิดป๊อปอัป (ผู้ใช้มักบันทึกหลายสีติดกัน)
    const fresh = section('ui.color.saved', colorStore().saved);
    fresh.classList.add('k-colorsec-saved');
    secSaved.replaceWith(fresh);
    secSaved = fresh;
  };
  wheelRow.append(inp, hex, bUse, bSave);
  pop.append(el('div', 'k-colorsec-lbl', tt('ui.color.wheel')), wheelRow);

  const bClear = el('button', 'k-color-clear', tt('ui.color.clear'));
  bClear.type = 'button';
  bClear.onclick = () => use('');
  pop.append(bClear);

  document.body.append(pop);
  const r = pop.getBoundingClientRect();
  const a = anchor ? anchor.getBoundingClientRect()
                   : { left: innerWidth / 2, bottom: innerHeight / 2 };
  pop.style.left = Math.max(8, Math.min(a.left, innerWidth - r.width - 8)) + 'px';
  pop.style.top = Math.max(8, Math.min(a.bottom + 4, innerHeight - r.height - 8)) + 'px';
  setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
  return pop;
}
