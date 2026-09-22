// custom-status.js — ผู้ใช้เพิ่ม/ลบสถานะฉากเองได้ (ต่อท้ายสถานะมาตรฐาน) + กำหนดสีของแต่ละสถานะ
// เก็บใน project.khn.json:
//   meta.customStatuses      = ['รอแก้ไข', 'ส่งแล้ว']          (สถานะที่เพิ่มเอง)
//   meta.customStatusColors  = { 'รอแก้ไข': '#d9575e', … }     (สีทับได้ทั้งสถานะมาตรฐานและที่เพิ่มเอง)
import { t, tf } from './i18n.js';
import { state, setStatus, el, log, SCENE_STATUSES, STATUS_COLORS, DEFAULT_STATUS_COLOR, dataLabel } from './core.js';
import { ask, confirmBox, escClose } from './ui.js';
import { gi } from './icons.js';
import { countStatusUse } from './status-choices.js';   // [alpha.160 · P1-11]
import { vivid, inkOn } from './color-util.js';

export function getCustomStatuses() {
  if (!state.meta) return [];
  return state.meta.customStatuses || [];
}

// ══ [alpha.157] ★ กระดาน Kanban เป็น "แหล่งความจริง" ของรายการสถานะ ══
// ผู้ใช้: *"สถานะใน explorer / kanban ซ้ำซ้อน และไม่ link กัน → ต้องอิงจาก kanban เป็นหลัก"*
// เดิม Kanban เก็บคอลัมน์ที่เพิ่มเองไว้ใน localStorage (ของเครื่อง · ไม่ผูกโปรเจกต์) → Explorer ไม่เคยเห็น
// ตอนนี้คอลัมน์ = สถานะใน project.khn.json ชุดเดียว:
//   meta.statusOrder     = ลำดับคอลัมน์ (ลากสลับบนกระดาน)
//   meta.hiddenStatuses  = สถานะมาตรฐานที่ลบคอลัมน์ทิ้งแล้ว (มาตรฐานลบจริงไม่ได้ — ค่าเป็นข้อมูลของ v1)
export function getHiddenStatuses() {
  return (state.meta && Array.isArray(state.meta.hiddenStatuses)) ? state.meta.hiddenStatuses : [];
}
/** เรียงตาม order ที่ให้มา แล้วต่อท้ายด้วยตัวที่ยังไม่เคยจัดลำดับ (บริสุทธิ์) */
export function orderStatuses(list, order) {
  if (!Array.isArray(order) || !order.length) return list.slice();
  const rank = new Map(order.map((k, i) => [k, i]));
  return list.slice().sort((a, b) => (rank.has(a) ? rank.get(a) : 1e6 + list.indexOf(a))
                                   - (rank.has(b) ? rank.get(b) : 1e6 + list.indexOf(b)));
}

// สถานะทั้งหมดที่ใช้ได้จริง = มาตรฐาน (ที่ไม่ถูกซ่อน) + ที่ผู้ใช้เพิ่ม · เรียงตามคอลัมน์ของ Kanban
export function allStatuses() {
  const hidden = new Set(getHiddenStatuses());
  const list = [...SCENE_STATUSES.filter((s) => !hidden.has(s)), ...getCustomStatuses()];
  return orderStatuses(list, state.meta && state.meta.statusOrder);
}

/** แจ้งทุกหน้าจอที่แสดงสถานะ (ต้นไม้ · Kanban · แดชบอร์ด) ว่าชุดสถานะ/สีเปลี่ยน */
function announce() {
  try { window.dispatchEvent(new CustomEvent('k2-statuses-changed')); } catch {}
}

/** ลากคอลัมน์บนกระดาน → ลำดับสถานะของทั้งโปรเจกต์ */
export async function setStatusOrder(order) {
  if (!state.meta || !Array.isArray(order)) return false;
  state.meta.statusOrder = order.filter((s, i, a) => s && a.indexOf(s) === i);
  await persist();
  return true;
}

/** ลบคอลัมน์: สถานะที่เพิ่มเอง = ลบจริง · สถานะมาตรฐาน = ซ่อน (กู้คืนได้จากกล่องจัดการสถานะ) */
export async function deleteStatus(label) {
  if (!state.meta || !label) return false;
  if (SCENE_STATUSES.includes(label)) {
    state.meta.hiddenStatuses = [...new Set([...getHiddenStatuses(), label])];
    await persist();
    return true;
  }
  return removeCustomStatus(label);
}
export async function unhideStatus(label) {
  if (!state.meta) return false;
  state.meta.hiddenStatuses = getHiddenStatuses().filter((s) => s !== label);
  await persist();
  return true;
}

// ---- สี ----
export function getStatusColors() {
  if (!state.meta) return {};
  return state.meta.customStatusColors || {};
}

// สีของสถานะหนึ่ง ๆ: ที่ผู้ใช้ตั้งเอง → สีมาตรฐาน → สีกลาง (ไม่คืนค่าว่าง เพื่อให้ชิปมีสีเสมอ)
export function statusColor(label) {
  if (!label) return '';
  return getStatusColors()[label] || STATUS_COLORS[label] || DEFAULT_STATUS_COLOR;
}

async function persist() {
  const { saveProjectMeta } = await import('./app.js');
  await saveProjectMeta();
  announce();
}

export async function setStatusColor(label, hex) {
  if (!state.meta || !label) return false;
  state.meta.customStatusColors = { ...getStatusColors(), [label]: hex };
  await persist();
  return true;
}

export async function addCustomStatus(label, color) {
  if (!state.meta || !label) return false;
  const name = String(label).trim();
  if (!name || allStatuses().includes(name)) return false;
  state.meta.customStatuses = [...getCustomStatuses(), name];
  if (color) state.meta.customStatusColors = { ...getStatusColors(), [name]: color };
  await persist();
  setStatus(t('ui.status.addStatusDone') + name);
  return true;
}

export async function removeCustomStatus(label) {
  if (!state.meta) return false;
  state.meta.customStatuses = getCustomStatuses().filter((s) => s !== label);
  const colors = { ...getStatusColors() }; delete colors[label];
  state.meta.customStatusColors = colors;
  await persist();                       // เดิมลืมบันทึก → ลบแล้วกลับมาใหม่ตอนเปิดโปรเจกต์
  setStatus(t('ui.status.delStatusDone') + label);
  return true;
}

// ---- นำเข้า/ส่งออกชุดสถานะ (ย้ายข้ามโปรเจกต์) ----
export function statusesToJson() {
  return { kind: 'killian-statuses', version: 1,
           statuses: getCustomStatuses(), colors: getStatusColors() };
}

// รวมกับของเดิม (ไม่ลบของที่มีอยู่) — คืนจำนวนสถานะที่เพิ่มใหม่จริง
export async function importStatuses(data) {
  if (!state.meta || !data) return 0;
  const incoming = Array.isArray(data) ? data : (data.statuses || []);
  const have = allStatuses();
  const fresh = incoming.map((s) => String(s).trim())
    .filter((s) => s && !have.includes(s))
    .filter((s, i, a) => a.indexOf(s) === i);
  state.meta.customStatuses = [...getCustomStatuses(), ...fresh];
  if (data.colors && typeof data.colors === 'object')
    state.meta.customStatusColors = { ...getStatusColors(), ...data.colors };
  await persist();
  return fresh.length;
}

async function exportStatusesFile() {
  const dest = await kapi.saveAsDialog((state.title || 'project') + '-statuses.json', 'json');
  if (!dest) return false;
  await kapi.writeFile(dest, JSON.stringify(statusesToJson(), null, 2));
  setStatus(t('ui.status.exportSetStatusDone') + dest);
  return true;
}

async function importStatusesFile() {
  const src = await kapi.openFileDialog('json');
  if (!src) return 0;
  try {
    const n = await importStatuses(JSON.parse(await kapi.readFile(src)));
    setStatus(n ? tf('ui.status.importStatusNewList', n) : t('ui.status.notHasStatusNew'));
    return n;
  } catch (e) {
    log('error', t('ui.status.customStatusImportFail'), e);
    setStatus(t('ui.status.importFileStatusNot'));
    return 0;
  }
}

// ---- กล่องจัดการสถานะ ----
export async function manageCustomStatuses() {
  if (!state.meta) { setStatus(t('ui.common.cantOpenProject')); return; }
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-status-mgr');
  box.append(el('div', 'k-dlg-title', t('ui.status.manageStatusScene')));

  const list = el('div', 'k-pick-list');
  // แถวเดียวใช้ได้ทั้งสถานะมาตรฐาน (ลบไม่ได้ แต่เปลี่ยนสีได้) และที่เพิ่มเอง
  const mkRow = (s, builtIn) => {
    const row = el('div', 'k-menu-item k-status-row');
    const dot = el('span', 'k-status-dot');
    dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;background:${statusColor(s)}`;
    const hiddenNow = builtIn && getHiddenStatuses().includes(s);
    row.append(dot, el('span', null, s + (builtIn ? t('ui.status.default') : '') + (hiddenNow ? t('ui.kanban.hiddenBuiltin') : '')));
    if (hiddenNow) {
      row.classList.add('k-status-hidden');
      const back = el('button', 'k-status-unhide', t('ui.kanban.restoreStatus'));
      back.style.cssText = 'float:right;margin-left:10px';
      back.onclick = async (e) => { e.stopPropagation(); await unhideStatus(s); render(); refreshStatusChips(); };
      row.append(back);
    }

    const pick = el('input', 'k-status-color');
    pick.type = 'color'; pick.value = statusColor(s);
    pick.title = t('ui.status.recolorStatus');
    pick.style.cssText = 'float:right;width:26px;height:20px;padding:0;border:none;background:none;cursor:pointer';
    pick.onchange = async () => { dot.style.background = pick.value; await setStatusColor(s, pick.value); refreshStatusChips(); };
    row.append(pick);

    if (!builtIn) {
      const del = el('span', 'k-status-del', gi('close'));
      del.style.cssText = 'float:right;cursor:pointer;margin-left:10px';
      del.title = t('ui.status.delStatus2');
      del.onclick = async (e) => {
        e.stopPropagation();
        // [alpha.160 · P1-11] บอกจำนวนฉากที่ยังใช้สถานะนี้ — ฉากพวกนั้นเก็บค่าเดิมไว้ (แผงคุณสมบัติไม่เขียนทับแล้ว)
        let inUse = 0;
        try { const { listScenes } = await import('./project-scan.js'); inUse = countStatusUse(await listScenes(state.root), s); } catch {}
        const q = inUse ? tf('ui.status.delStatusInUse', s, inUse) : tf('ui.status.delStatus', s);
        if (await confirmBox(q, t('ui.common.del'))) { await removeCustomStatus(s); render(); refreshStatusChips(); }
      };
      row.append(del);
    }
    return row;
  };
  const render = () => {
    list.innerHTML = '';
    for (const s of SCENE_STATUSES) list.append(mkRow(s, true));
    const custom = getCustomStatuses();
    if (!custom.length) list.append(el('div', 'dim', t('ui.status.notHasStatusDefine')));
    for (const s of custom) list.append(mkRow(s, false));
  };
  render();

  const btns = el('div', 'k-dlg-btns');
  const addB = el('button', 'k-ok', t('ui.status.addStatus'));
  addB.onclick = async () => {
    const name = await ask(t('ui.status.nameStatusNew'), { placeholder: t('ui.status.egEditSendDone') });
    if (!name) return;
    await addCustomStatus(name);
    render(); refreshStatusChips();
  };
  const outB = el('button', null, t('ui.status.export'));
  outB.title = t('ui.status.saveSetStatusColor');
  outB.onclick = () => exportStatusesFile();
  const inB = el('button', null, t('ui.status.import'));
  inB.title = t('ui.status.readSetStatusFile');
  inB.onclick = async () => { await importStatusesFile(); render(); refreshStatusChips(); };
  const closeB = el('button', 'k-cancel', t('ui.common.close'));
  closeB.onclick = () => ov.remove();
  // [alpha.162 · W4 ข้อ 9] ปุ่มหลักขวาสุด · ปุ่มเครื่องมือซ้าย (`k-cancel` = ทางที่ Esc เดินด้วย)
  btns.append(outB, inB, closeB, addB);
  box.append(list, btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  escClose(ov, () => ov.remove());            // [alpha.124 ข้อ 15]
}

// ทาสีชิปสถานะที่วาดไว้แล้วใน Explorer/ตารางฉาก โดยไม่ต้อง build ต้นไม้ใหม่ทั้งชุด
export function refreshStatusChips(root = document) {
  // [alpha.159 · M16] ค่าจริงอยู่ที่ `dataset.status` — `textContent` เป็นป้ายที่ **แปลแล้ว**
  // (หน้าจออังกฤษ "Writing" ไม่มีในตารางสีที่เก็บเป็นค่าไทย → ชิปทุกตัวกลายเป็นสีเทาตั้งต้น)
  // ชิปที่ไม่มี dataset.status (สถานะเล่ม — คนละชุดสี) ไม่แตะ
  for (const chip of root.querySelectorAll('.sc-status[data-status]')) {
    const c = statusColor(chip.dataset.status);
    if (c) paintStatusChip(chip, c);
  }
}

/**
 * [alpha.159 · M16] ชิปสถานะฉาก/บท/ไฟล์ — **ทางสร้างเดียว**: ป้ายตามภาษา · ค่าจริงใน dataset · สีประจำสถานะ
 * @param {string} value ค่าที่เก็บในไฟล์งาน (ไทย)
 */
export function statusChip(value) {
  const chip = el('span', 'sc-status', dataLabel(value));
  chip.dataset.status = String(value || '');
  const c = statusColor(value);
  if (c) paintStatusChip(chip, c);
  return chip;
}

/** [alpha.157] ชิปสถานะ = พื้นสีเต็ม (เฉดสด) + ตัวอักษรที่อ่านออกบนพื้นนั้น (ผู้ใช้: "สีเต็มแถบ · colorful") */
export function paintStatusChip(chip, hex) {
  const v = vivid(hex) || hex;
  if (!chip || !v) return;
  chip.classList.add('sc-status-filled');
  chip.style.background = v;
  chip.style.borderColor = v;
  chip.style.color = inkOn(v) || '';
}
