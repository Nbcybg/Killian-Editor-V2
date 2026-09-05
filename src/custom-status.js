// custom-status.js — ผู้ใช้เพิ่ม/ลบสถานะฉากเองได้ (ต่อท้ายสถานะมาตรฐาน) + กำหนดสีของแต่ละสถานะ
// เก็บใน project.khn.json:
//   meta.customStatuses      = ['รอแก้ไข', 'ส่งแล้ว']          (สถานะที่เพิ่มเอง)
//   meta.customStatusColors  = { 'รอแก้ไข': '#d9575e', … }     (สีทับได้ทั้งสถานะมาตรฐานและที่เพิ่มเอง)
import { t, tf } from './i18n.js';
import { state, setStatus, el, log, SCENE_STATUSES, STATUS_COLORS, DEFAULT_STATUS_COLOR } from './core.js';
import { ask, confirmBox, escClose } from './ui.js';

export function getCustomStatuses() {
  if (!state.meta) return [];
  return state.meta.customStatuses || [];
}

// สถานะทั้งหมดที่ใช้ได้จริง = มาตรฐาน + ที่ผู้ใช้เพิ่ม (เมนูสถานะฉากเรียกตัวนี้)
export function allStatuses() {
  return [...SCENE_STATUSES, ...getCustomStatuses()];
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
    row.append(dot, el('span', null, s + (builtIn ? t('ui.status.default') : '')));

    const pick = el('input', 'k-status-color');
    pick.type = 'color'; pick.value = statusColor(s);
    pick.title = t('ui.status.recolorStatus');
    pick.style.cssText = 'float:right;width:26px;height:20px;padding:0;border:none;background:none;cursor:pointer';
    pick.onchange = async () => { dot.style.background = pick.value; await setStatusColor(s, pick.value); refreshStatusChips(); };
    row.append(pick);

    if (!builtIn) {
      const del = el('span', 'k-status-del', '✕');
      del.style.cssText = 'float:right;cursor:pointer;margin-left:10px';
      del.title = t('ui.status.delStatus2');
      del.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmBox(tf('ui.status.delStatus', s), t('ui.common.del'))) { await removeCustomStatus(s); render(); refreshStatusChips(); }
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
  const closeB = el('button', null, t('ui.common.close'));
  closeB.onclick = () => ov.remove();
  btns.append(addB, outB, inB, closeB);
  box.append(list, btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  escClose(ov, () => ov.remove());            // [alpha.124 ข้อ 15]
}

// ทาสีชิปสถานะที่วาดไว้แล้วใน Explorer/ตารางฉาก โดยไม่ต้อง build ต้นไม้ใหม่ทั้งชุด
export function refreshStatusChips(root = document) {
  for (const chip of root.querySelectorAll('.sc-status')) {
    const c = statusColor(chip.textContent.trim());
    if (c) { chip.style.color = c; chip.style.borderColor = c; }
  }
}
