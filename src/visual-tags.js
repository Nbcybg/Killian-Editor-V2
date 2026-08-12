// visual-tags.js — Visual Tagging System — แท็กมีสี/ไอคอน/รูปทรง (ข้อ 84)
import { T } from './i18n.js';
import { state, setStatus, el } from './core.js';

const DEFAULT_VISUAL_TAGS = [
  { name: 'ต่อสู้', color: '#d9575e', icon: '⚔', shape: 'circle' },
  { name: 'พูดคุย', color: '#5f9fd9', icon: '💬', shape: 'tag' },
  { name: 'สำรวจ', color: '#6fae6f', icon: '🔍', shape: 'square' },
  { name: 'ความลับ', color: '#a97fd0', icon: '🔮', shape: 'circle' },
  { name: 'ย้อนอดีต', color: '#d9b757', icon: '⏪', shape: 'tag' },
];

export function getVisualTags() {
  if (!state.meta) return DEFAULT_VISUAL_TAGS;
  return state.meta.visualTags || DEFAULT_VISUAL_TAGS;
}

export async function addVisualTag(tag) {
  if (!state.meta) return false;
  state.meta.visualTags = state.meta.visualTags || [...DEFAULT_VISUAL_TAGS];
  if (state.meta.visualTags.some((t) => t.name === tag.name)) return false;
  state.meta.visualTags.push(tag);
  const { saveProjectMeta } = await import('./app.js');
  await saveProjectMeta();
  return true;
}

export async function removeVisualTag(name) {
  if (!state.meta) return false;
  const cur = state.meta.visualTags || [...DEFAULT_VISUAL_TAGS];
  state.meta.visualTags = cur.filter((t) => t.name !== name);
  const { saveProjectMeta } = await import('./app.js');
  await saveProjectMeta();
  return true;
}

/** หาแท็กภาพจากชื่อ — คืน null ถ้าแท็กนี้ยังไม่ได้ตั้งสี/ไอคอน */
export function visualTagFor(name) {
  return getVisualTags().find((v) => v.name === name) || null;
}

/** รูปทรงของชิป → border-radius (circle=กลม · square=เหลี่ยม · tag=ป้ายห้อย) */
export function tagRadius(shape) {
  if (shape === 'circle') return '999px';
  if (shape === 'square') return '3px';
  return '3px 999px 999px 3px';
}

/**
 * ทาสี/ไอคอน/รูปทรงให้ element ที่มีอยู่แล้ว — ใช้ได้กับชิปทุกที่
 * (Explorer, แถบตัวกรอง, ตารางฉาก) โดยไม่ต้องเปลี่ยนโครง DOM ของที่นั้น
 * @returns {boolean} true ถ้าแท็กนี้มีการตั้งค่าภาพไว้
 */
export function applyVisualTagStyle(node, name, { withIcon = true } = {}) {
  const vt = visualTagFor(name);
  if (!vt || !node) return false;
  node.style.background = vt.color + '22';
  node.style.border = '1px solid ' + vt.color + '55';
  node.style.color = vt.color;
  node.style.borderRadius = tagRadius(vt.shape);
  if (withIcon && vt.icon && !node.textContent.startsWith(vt.icon)) {
    node.textContent = vt.icon + ' ' + node.textContent;
  }
  node.title = (node.title ? node.title + '\n' : '') + T`แท็ก: ${vt.name} (${vt.shape || 'tag'})`;
  return true;
}

/** ชิปเดี่ยว — ใช้ตอนอยากได้ element ใหม่ (เช่นในต้นไม้ explorer) */
export function visualTagChip(name, { count = 0, onClick = null } = {}) {
  const vt = visualTagFor(name);
  const chip = el('span', 'vt-chip' + (vt ? '' : ' vt-chip-plain'));
  chip.textContent = (vt ? '' : '#') + name + (count ? ' (' + count + ')' : '');
  if (vt) applyVisualTagStyle(chip, name);
  if (onClick) { chip.style.cursor = 'pointer'; chip.onclick = onClick; }
  return chip;
}

// Render visual tag chips for Explorer / Planner
export function renderVisualTagChips(tags, onClick) {
  const wrap = el('span', 'vt-chips');
  for (const t of (tags || [])) {
    if (!visualTagFor(t)) continue;
    wrap.append(visualTagChip(t, { onClick: onClick ? () => onClick(t) : null }));
  }
  return wrap;
}

/**
 * ชิปแท็กทั้งหมดของฉาก/เอนทิตี้ — แท็กที่ตั้งสีไว้ได้ชิปสี · ที่เหลือได้ #ข้อความธรรมดา
 * ใช้ใน Explorer เพื่อไม่ให้แท็กที่ยังไม่ได้ตั้งสีหายไปเฉย ๆ
 */
export function renderAllTagChips(tags, onClick) {
  const wrap = el('span', 'vt-chips');
  for (const t of (tags || [])) {
    if (!t) continue;
    wrap.append(visualTagChip(t, { onClick: onClick ? () => onClick(t) : null }));
  }
  return wrap;
}

// Dialog จัดการ visual tags
export async function manageVisualTags() {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', T`🏷 จัดการ Visual Tags`));

  const tags = getVisualTags();
  const grid = el('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(150px,1fr));gap:8px;margin:10px 0';
  const renderGrid = () => {
    grid.innerHTML = '';
    for (const t of getVisualTags()) {
      const card = el('div', 'vt-card');
      card.style.cssText = `padding:10px;background:${t.color}18;border:1px solid ${t.color}40;border-radius:8px;font-size:13px;position:relative`;
      // ชื่อแท็กมาจากผู้ใช้ → textContent เท่านั้น
      card.append(el('div', null, (t.icon || '🔖') + ' ' + t.name));
      const sub = el('small', null, t.shape || 'tag');
      sub.style.color = 'var(--dim)';
      card.append(sub);
      const del = el('span', 'vt-del', '✕');
      del.style.cssText = 'position:absolute;top:6px;right:8px;cursor:pointer;opacity:.55';
      del.title = T`ลบแท็กนี้`;
      del.onclick = async () => { await removeVisualTag(t.name); renderGrid(); };
      card.append(del);
      grid.append(card);
    }
  };
  renderGrid();
  box.append(grid);

  const addRow = el('div', 'k-row'); addRow.style.cssText = 'gap:6px';
  const nameInp = el('input', 'k-dlg-input'); nameInp.placeholder = T`ชื่อแท็ก`; nameInp.style.flex = '1';
  const iconInp = el('input', 'k-dlg-input'); iconInp.placeholder = '⚔'; iconInp.style.width = '48px';
  const colorInp = el('input', 'k-dlg-input'); colorInp.type = 'color'; colorInp.style.width = '40px';
  const shapeSel = el('select', 'k-dlg-select');
  ['circle', 'square', 'tag'].forEach((s) => { const o = el('option', null, s); o.value = s; shapeSel.append(o); });
  addRow.append(nameInp, iconInp, colorInp, shapeSel);
  box.append(addRow);

  const btns = el('div', 'k-dlg-btns');
  const addB = el('button', 'k-ok', T`+ เพิ่ม`);
  addB.onclick = async () => {
    const name = nameInp.value.trim();
    if (!name) return;
    await addVisualTag({ name, icon: iconInp.value || '🔖', color: colorInp.value || '#d97757', shape: shapeSel.value || 'tag' });
    nameInp.value = ''; renderGrid();
  };
  const closeB = el('button', null, T`ปิด`);
  closeB.onclick = () => ov.remove();
  btns.append(addB, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}
