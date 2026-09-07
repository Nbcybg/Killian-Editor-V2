// export-name-ui.js — [alpha.132 ข้อ 6] แถว "ชื่อไฟล์ส่งออก" ที่ใช้ร่วมกันทุกกล่องส่งออก
//
// ผู้ใช้: *"ทำเป็นแถวแยกมาเลย เป็น global สามารถใช้ shortcode ได้
//          และแสดงตัวอย่างว่า file ที่ save จะใช้ชื่ออะไร และเก็บ โหลด preset ได้"*
//
// **แถวเดียวกันเป๊ะทั้งสองกล่อง** (ศูนย์ส่งออก · กล่องส่งออก PDF ของบท) — เขียนที่นี่ที่เดียว
// ไม่งั้นแก้ที่หนึ่งแล้วอีกที่ค้างเวอร์ชันเก่า ซึ่งเป็นบั๊กประจำของกล่องส่งออกในรอบก่อน ๆ
//
// ตรรกะล้วน (ขยายโค้ดสั้น · กรองอักขระ · ทะเบียนพรีเซ็ต) อยู่ใน `export-name.js` ที่มี unit test
// ไฟล์นี้ทำแค่ DOM + เก็บค่าเป็น setting ระดับผู้ใช้

import { t as tt } from './i18n.js';
import { el, state } from './core.js';
import { ask, confirmBox } from './ui.js';
import { BUILTIN_NAME_PRESETS, DEFAULT_EXPORT_NAME, buildExportName,
         normalizeExportName, saveNamePreset, deleteNamePreset } from './export-name.js';

/** ค่าที่จำไว้ (ค่าขยะถูกกรองทิ้งเสมอ) */
export function exportNameStore() {
  return normalizeExportName((state.settings || {}).exportName);
}

/**
 * แถว "ชื่อไฟล์ส่งออก"
 * @param {object} o
 * @param {string} o.ext            นามสกุลปัจจุบัน (เปลี่ยนได้ทีหลังด้วย `setExt`)
 * @param {object} o.ctx            บริบทของโค้ดสั้น (ส่ง `{}` มาก่อนแล้วเติมทีหลังด้วย `setCtx`)
 * @param {Function} [o.saveGlobal] `saveGlobalSetting(key, value)` จาก app.js
 * @returns {{node:HTMLElement, template:()=>string, name:()=>string,
 *            setExt:(e:string)=>void, setCtx:(c:object)=>void}}
 */
export function exportNameRow({ ext = 'pdf', ctx = {}, saveGlobal = null } = {}) {
  let curExt = ext;
  let curCtx = ctx || {};
  const store = exportNameStore();

  const node = el('div', 'k-xname');
  node.append(el('div', 'k-xname-lbl', tt('ui.xname.label')));

  const inp = el('input', 'k-dlg-input k-xname-input');
  inp.value = store.template;
  inp.spellcheck = false;
  inp.placeholder = DEFAULT_EXPORT_NAME;
  inp.title = tt('ui.xname.hint');

  const sel = el('select', 'k-dlg-select k-xname-preset');
  const bSave = el('button', 'k-xname-save', tt('ui.xname.savePreset'));
  bSave.type = 'button';
  bSave.title = tt('ui.xname.savePresetHint');
  const bDel = el('button', 'k-xname-del', tt('ui.xname.delPreset'));
  bDel.type = 'button';

  const prev = el('div', 'dim k-xname-preview');
  const hint = el('div', 'k-hint k-xname-hint', tt('ui.xname.hint'));

  // ══ [alpha.132r3 ข้อ 2] ★ "เปิดไฟล์เมื่อส่งออกเสร็จ" ══
  // ผู้ใช้: *"มีช่องให้ติ๊กว่า เปิดไฟล์ export เมื่อ export เสร็จ"*
  // อยู่ในแถวเดียวกับชื่อไฟล์ เพราะทั้งคู่เป็นเรื่องของ "ไฟล์ที่จะได้" ไม่ใช่ของรูปแบบใดรูปแบบหนึ่ง
  const openWrap = el('label', 'k-xname-open');
  const openChk = el('input');
  openChk.type = 'checkbox';
  openChk.checked = store.openAfter === true;
  openWrap.append(openChk, el('span', null, tt('ui.xname.openAfter')));
  openChk.onchange = async () => {
    if (!state.settings) return;
    const next = normalizeExportName({ ...exportNameStore(), openAfter: openChk.checked });
    state.settings.exportName = next;
    if (typeof saveGlobal === 'function') await saveGlobal('exportName', next);
  };

  /** ชื่อไฟล์จริงที่จะถูกเสนอในกล่องบันทึก */
  const fileName = () => buildExportName(inp.value, curCtx, curExt);
  const refresh = () => { prev.textContent = tt('ui.xname.preview') + fileName(); };

  const fillPresets = () => {
    const s = exportNameStore();
    sel.textContent = '';
    const head = el('option', null, tt('ui.xname.presetPick'));
    head.value = '';
    sel.append(head);
    for (const p of BUILTIN_NAME_PRESETS) {
      const o = el('option', null, tt(p.labelKey));
      o.value = 'b:' + p.id;
      sel.append(o);
    }
    for (const p of s.presets) {
      const o = el('option', null, p.name);
      o.value = 'u:' + p.name;
      sel.append(o);
    }
    sel.value = '';
    bDel.disabled = true;
  };
  fillPresets();

  const persist = async () => {
    if (!state.settings) return;
    // อ่านของเดิมมาทั้งก้อนก่อนเสมอ — ไม่งั้นบันทึกเทมเพลตแล้วค่า `openAfter` หายไปด้วย
    const next = normalizeExportName({ ...exportNameStore(), template: inp.value });
    state.settings.exportName = next;
    if (typeof saveGlobal === 'function') await saveGlobal('exportName', next);
  };

  inp.oninput = refresh;
  inp.onchange = () => { refresh(); persist(); };

  sel.onchange = () => {
    const v = sel.value;
    bDel.disabled = !v.startsWith('u:');
    if (!v) return;
    const s = exportNameStore();
    const found = v.startsWith('b:')
      ? (BUILTIN_NAME_PRESETS.find((p) => p.id === v.slice(2)) || {}).template
      : (s.presets.find((p) => p.name === v.slice(2)) || {}).template;
    if (!found) return;
    inp.value = found;
    refresh();
    persist();
  };

  bSave.onclick = async () => {
    const tpl = String(inp.value || '').trim();
    if (!tpl) return;
    const name = await ask(tt('ui.xname.askPresetName'), { value: '' });
    if (!name) return;
    const s = exportNameStore();
    state.settings.exportName = normalizeExportName(
      { ...s, presets: saveNamePreset(s.presets, name, tpl) });
    if (typeof saveGlobal === 'function') await saveGlobal('exportName', state.settings.exportName);
    fillPresets();
    sel.value = 'u:' + String(name).trim();
    bDel.disabled = false;
  };

  bDel.onclick = async () => {
    const v = sel.value;
    if (!v.startsWith('u:')) return;
    const name = v.slice(2);
    if (!(await confirmBox(tt('ui.xname.delPresetAsk') + name, tt('ui.common.del')))) return;
    const s = exportNameStore();
    state.settings.exportName = normalizeExportName(
      { ...s, presets: deleteNamePreset(s.presets, name) });
    if (typeof saveGlobal === 'function') await saveGlobal('exportName', state.settings.exportName);
    fillPresets();
  };

  const ctrls = el('div', 'k-xname-ctrls');
  ctrls.append(inp, sel, bSave, bDel);
  node.append(ctrls, prev, hint, openWrap);
  refresh();

  return {
    node,
    template: () => String(inp.value || '').trim() || DEFAULT_EXPORT_NAME,
    name: fileName,
    /** ผู้ใช้ติ๊ก "เปิดไฟล์เมื่อเสร็จ" ไว้ไหม */
    openAfter: () => openChk.checked,
    setExt: (e) => { curExt = String(e || '').replace(/^\./, ''); refresh(); },
    setCtx: (c) => { curCtx = c || {}; refresh(); },
  };
}
