// logline-ui.js — [alpha.157] ช่องกรอก Logline 6 ช่อง (โปรเจกต์ · เล่ม) + เข็มทิศเรื่องของ AI
// ตรรกะอยู่ใน logline.js (บริสุทธิ์) · ไฟล์นี้วาดช่อง + อ่านไฟล์ของเล่มที่กำลังเขียน
import { t } from './i18n.js';
import { el, state } from './core.js';
import { LOGLINE_KEYS, LOGLINE_LABEL_KEYS, LOGLINE_HINT_KEYS, normalizeLogline, compassText } from './logline.js';

/**
 * วาดชุดช่อง Logline ลง host
 * @param {HTMLElement} host
 * @param {object} value logline เดิม
 * @param {{onChange?:Function, rowClass?:string, placeholderFrom?:object}} opts
 *        placeholderFrom = logline ของโปรเจกต์ (ช่องของเล่มที่ว่างโชว์ค่าที่จะตกไปใช้เป็นตัวจาง)
 * @returns {{read:() => object, inputs:Object<string,HTMLTextAreaElement>}}
 */
export function buildLoglineFields(host, value, opts = {}) {
  const v = normalizeLogline(value);
  const fb = opts.placeholderFrom ? normalizeLogline(opts.placeholderFrom) : null;
  const box = el('div', 'k-logline');
  const head = el('div', 'k-logline-head');
  head.append(el('span', 'k-logline-title', t('ui.logline.title')), el('span', 'k-hint', t('ui.logline.why')));
  box.append(head);
  const inputs = {};
  LOGLINE_KEYS.forEach((k, i) => {
    const row = el('div', (opts.rowClass || 'k-logline-row') + ' ll-' + k);
    const lab = el('label', null);
    lab.append(el('span', 'k-logline-no', String(i + 1)), document.createTextNode(t(LOGLINE_LABEL_KEYS[k])));
    const ta = el('textarea', 'k-logline-input');
    ta.rows = k === 'logline' ? 3 : 2;
    ta.value = v[k];
    ta.dataset.ll = k;
    ta.placeholder = (fb && fb[k]) ? fb[k] : t(LOGLINE_HINT_KEYS[k]);
    if (opts.onChange) {
      ta.addEventListener('blur', () => opts.onChange(read(), k));
    }
    inputs[k] = ta;
    row.append(lab, ta);
    box.append(row);
  });
  const read = () => {
    const out = {};
    for (const k of LOGLINE_KEYS) out[k] = inputs[k].value.trim();
    return out;
  };
  host.append(box);
  return { read, inputs, box };
}

/** โฟลเดอร์เล่มของไฟล์ที่เปิดอยู่ (ชั้นแรกใต้รากโปรเจกต์) — '' ถ้าไม่ได้อยู่ในเล่ม */
async function activeSectionPath() {
  const f = state.active && (state.active.file || state.active.path);
  if (!f || !state.root) return '';
  const norm = (p) => String(p).replace(/\\/g, '/');
  const root = norm(state.root).replace(/\/+$/, '');
  const file = norm(f);
  if (!file.startsWith(root + '/')) return '';
  const first = file.slice(root.length + 1).split('/')[0];
  if (!first) return '';
  const secPath = await kapi.join(state.root, first);
  return (await kapi.exists(await kapi.join(secPath, 'section.json'))) ? secPath : '';
}

/** ข้อความเข็มทิศเรื่องของบริบทปัจจุบัน ('' = ยังไม่ได้กรอกอะไร) */
export async function currentCompass() {
  if (!state.root || !state.meta) return '';
  let book = null, bookTitle = '';
  try {
    const sp = await activeSectionPath();
    if (sp) {
      const s = await kapi.readJson(await kapi.join(sp, 'section.json'));
      book = s.logline || null;
      bookTitle = s.title || '';
    }
  } catch {}
  const labels = {};
  for (const k of LOGLINE_KEYS) labels[k] = t(LOGLINE_LABEL_KEYS[k]);
  return compassText(state.meta.logline, book, {
    head: t('ui.logline.compassHead'), rule: t('ui.logline.compassRule'), labels,
    bookTitle: book ? bookTitle : '',
  });
}
