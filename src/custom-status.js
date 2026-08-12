// custom-status.js — ผู้ใช้เพิ่ม/ลบสถานะฉากเองได้ (ต่อท้ายสถานะมาตรฐาน) + กำหนดสีของแต่ละสถานะ
// เก็บใน project.khn.json:
//   meta.customStatuses      = ['รอแก้ไข', 'ส่งแล้ว']          (สถานะที่เพิ่มเอง)
//   meta.customStatusColors  = { 'รอแก้ไข': '#d9575e', … }     (สีทับได้ทั้งสถานะมาตรฐานและที่เพิ่มเอง)
import { T } from './i18n.js';
import { state, setStatus, el, log, SCENE_STATUSES, STATUS_COLORS, DEFAULT_STATUS_COLOR } from './core.js';
import { ask, confirmBox } from './ui.js';

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
  setStatus(T`เพิ่มสถานะแล้ว: ` + name);
  return true;
}

export async function removeCustomStatus(label) {
  if (!state.meta) return false;
  state.meta.customStatuses = getCustomStatuses().filter((s) => s !== label);
  const colors = { ...getStatusColors() }; delete colors[label];
  state.meta.customStatusColors = colors;
  await persist();                       // เดิมลืมบันทึก → ลบแล้วกลับมาใหม่ตอนเปิดโปรเจกต์
  setStatus(T`ลบสถานะแล้ว: ` + label);
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
  setStatus(T`ส่งออกชุดสถานะแล้ว: ` + dest);
  return true;
}

async function importStatusesFile() {
  const src = await kapi.openFileDialog('json');
  if (!src) return 0;
  try {
    const n = await importStatuses(JSON.parse(await kapi.readFile(src)));
    setStatus(n ? T`นำเข้าสถานะใหม่ ${n} รายการ` : T`ไม่มีสถานะใหม่ให้เพิ่ม (ซ้ำกับของเดิมทั้งหมด)`);
    return n;
  } catch (e) {
    log('error', T`custom-status: นำเข้าล้มเหลว`, e);
    setStatus(T`นำเข้าไฟล์สถานะไม่สำเร็จ (ไฟล์ไม่ใช่ JSON ที่ถูกต้อง)`);
    return 0;
  }
}

// ---- กล่องจัดการสถานะ ----
export async function manageCustomStatuses() {
  if (!state.meta) { setStatus(T`ยังไม่ได้เปิดโปรเจกต์`); return; }
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-status-mgr');
  box.append(el('div', 'k-dlg-title', T`🏷 จัดการสถานะฉาก`));

  const list = el('div', 'k-pick-list');
  // แถวเดียวใช้ได้ทั้งสถานะมาตรฐาน (ลบไม่ได้ แต่เปลี่ยนสีได้) และที่เพิ่มเอง
  const mkRow = (s, builtIn) => {
    const row = el('div', 'k-menu-item k-status-row');
    const dot = el('span', 'k-status-dot');
    dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;background:${statusColor(s)}`;
    row.append(dot, el('span', null, s + (builtIn ? T`  (มาตรฐาน)` : '')));

    const pick = el('input', 'k-status-color');
    pick.type = 'color'; pick.value = statusColor(s);
    pick.title = T`เปลี่ยนสีของสถานะนี้`;
    pick.style.cssText = 'float:right;width:26px;height:20px;padding:0;border:none;background:none;cursor:pointer';
    pick.onchange = async () => { dot.style.background = pick.value; await setStatusColor(s, pick.value); refreshStatusChips(); };
    row.append(pick);

    if (!builtIn) {
      const del = el('span', 'k-status-del', '✕');
      del.style.cssText = 'float:right;cursor:pointer;margin-left:10px';
      del.title = T`ลบสถานะนี้`;
      del.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmBox(T`ลบสถานะ "${s}" ?`, T`ลบ`)) { await removeCustomStatus(s); render(); refreshStatusChips(); }
      };
      row.append(del);
    }
    return row;
  };
  const render = () => {
    list.innerHTML = '';
    for (const s of SCENE_STATUSES) list.append(mkRow(s, true));
    const custom = getCustomStatuses();
    if (!custom.length) list.append(el('div', 'dim', T`ยังไม่มีสถานะที่กำหนดเอง`));
    for (const s of custom) list.append(mkRow(s, false));
  };
  render();

  const btns = el('div', 'k-dlg-btns');
  const addB = el('button', 'k-ok', T`+ เพิ่มสถานะ`);
  addB.onclick = async () => {
    const name = await ask(T`ชื่อสถานะใหม่`, { placeholder: T`เช่น รอแก้ไข, ส่งแล้ว` });
    if (!name) return;
    await addCustomStatus(name);
    render(); refreshStatusChips();
  };
  const outB = el('button', null, T`📤 ส่งออก…`);
  outB.title = T`บันทึกชุดสถานะ + สี เป็นไฟล์ .json เพื่อนำไปใช้กับโปรเจกต์อื่น`;
  outB.onclick = () => exportStatusesFile();
  const inB = el('button', null, T`📥 นำเข้า…`);
  inB.title = T`อ่านชุดสถานะจากไฟล์ .json (รวมกับของเดิม ไม่ลบทิ้ง)`;
  inB.onclick = async () => { await importStatusesFile(); render(); refreshStatusChips(); };
  const closeB = el('button', null, T`ปิด`);
  closeB.onclick = () => ov.remove();
  btns.append(addB, outB, inB, closeB);
  box.append(list, btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ทาสีชิปสถานะที่วาดไว้แล้วใน Explorer/ตารางฉาก โดยไม่ต้อง build ต้นไม้ใหม่ทั้งชุด
export function refreshStatusChips(root = document) {
  for (const chip of root.querySelectorAll('.sc-status')) {
    const c = statusColor(chip.textContent.trim());
    if (c) { chip.style.color = c; chip.style.borderColor = c; }
  }
}
