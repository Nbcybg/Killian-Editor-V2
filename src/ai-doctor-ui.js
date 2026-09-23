// ai-doctor-ui.js — วาดผลชั้นคำนวณเองของ "🩺 ตรวจบท" 5 หัวข้อ (alpha.164)
//
// แยกจาก ai-analyzer-ui.js เพื่อไม่ให้ไฟล์นั้นบวม · ตัวช่วยวาด (แถบ/รายการ/กระโดดไปฉาก)
// ส่งเข้ามาทาง `h` จึงหน้าตาเหมือนการ์ดเดิมทุกใบ และไม่ต้อง import วนกลับไปหา ai-analyzer-ui
import { t, tf } from './i18n.js';
import { el } from './core.js';
import { gi } from './icons.js';
import { TONE_LABELS, ADJUST_LABELS, DRAG_FLAG, reasonText } from './ai/ai-doctor.js';


/** ประโยคต้นฉบับที่ยกมาเป็นหลักฐาน (คลิกได้ = ไปที่ฉาก) */
function quoteRow(h, { title, meta, quote, sceneId, cls }) {
  const row = el('div', 'aia-doc-row' + (cls ? ' ' + cls : ''));
  const head = el('div', 'aia-doc-head');
  head.append(el('span', 'aia-doc-title', title || ''));
  if (meta) head.append(el('span', 'aia-doc-meta', meta));
  row.append(head);
  if (quote) row.append(el('div', 'aia-doc-quote', quote));
  if (sceneId) { row.classList.add('is-link'); row.onclick = () => h.jumpToScene(sceneId); }
  return row;
}
function list(rows, limit = 30) {
  const wrap = el('div', 'aia-doc-list');
  wrap.append(...rows.slice(0, limit));
  return wrap;
}
const empty = () => el('div', 'aia-hint', t('ui.aia.noSignal'));

/**
 * @param {string} id  dialog | drag | logic | ooc | tone
 * @param {object} L   ผลชั้นคำนวณเอง
 * @param {{barList:Function, jumpToScene:Function}} h
 */
export function renderDoctorLocal(id, L, h) {
  const box = el('div', 'aia-doc');
  if (id === 'dialog') {
    if (!L.flagged || !L.flagged.length) { box.append(empty()); return box; }
    box.append(list(L.flagged.map((f) => quoteRow(h, {
      title: f.title, meta: (f.speaker ? f.speaker + ' · ' : '') + reasonText(f.reasons),
      quote: f.quote, sceneId: f.sceneId }))));
  } else if (id === 'drag') {
    box.append(h.barList(L.rows.map((r) => ({
      label: r.title || r.id, value: r.drag, display: r.drag, sceneId: r.id,
      sub: r.reasons.length ? reasonText(r.reasons, 'drag') : '',
      tone: r.drag >= DRAG_FLAG ? 'slow' : '',
    }))));
    for (const g of (L.runs || [])) {
      box.append(quoteRow(h, { title: t('ui.aia.slowRun'), meta: tf('ui.aia.runRange', g.from, g.to, g.count),
                               sceneId: g.sceneId, cls: 'aia-doc-warn' }));
    }
  } else if (id === 'logic') {
    if (!L.rows || !L.rows.length) { box.append(empty()); return box; }
    box.append(list(L.rows.map((r) => quoteRow(h, {
      title: r.title || r.id, meta: r.words.join(', ') + (r.late ? ' · ' + t('ui.aia.stLogicLate') : ''),
      quote: r.quote, sceneId: r.id, cls: r.late ? 'aia-doc-warn' : '' }))));
  } else if (id === 'ooc') {
    if (!L.rows || !L.rows.length) { box.append(empty()); return box; }
    const chips = el('div', 'aia-chips');
    for (const r of L.rows) {
      const c = el('span', 'aia-chip' + (r.outliers ? ' aia-chip-warn' : ''),
        r.name + ' · ' + tf('ui.aia.oocHabit', r.pronoun || '—', r.particle || '—')
        + (r.profile ? '' : ' · ' + t('ui.aia.oocNoProfile')));
      chips.append(c);
    }
    box.append(chips);
    if (L.outliers && L.outliers.length) {
      box.append(list(L.outliers.map((o) => quoteRow(h, {
        title: o.name + ' — ' + o.title, meta: tf('ui.aia.oocShift', o.form, o.expected),
        quote: o.quote, sceneId: o.sceneId, cls: 'aia-doc-warn' }))));
    }
  } else if (id === 'tone') {
    const wrap = el('div', 'aia-tone');
    for (const r of L.rows) {
      const row = el('div', 'aia-tone-row' + (r.adjust ? ' is-off' : '') + (r.whiplash ? ' is-whip' : ''));
      row.append(el('div', 'aia-tone-name', r.title || r.id));
      // แถบสองฝั่ง: ตลกไปทางซ้าย ดราม่าไปทางขวา (ความยาวตามความหนาแน่นต่อ 1,000 คำ · เพดาน 10)
      const bar = el('div', 'aia-tone-bar');
      const c = el('div', 'aia-tone-c'); c.style.width = Math.min(50, r.comedy * 5) + '%';
      const d = el('div', 'aia-tone-d'); d.style.width = Math.min(50, r.drama * 5) + '%';
      bar.title = TONE_LABELS.comedy + ' ' + r.comedy + ' · ' + TONE_LABELS.drama + ' ' + r.drama;
      bar.append(c, el('div', 'aia-tone-mid'), d);
      row.append(bar);
      row.append(el('div', 'aia-tone-tag', (TONE_LABELS[r.tone] || r.tone)
        + (r.adjust ? ' ' + gi('arrow-right') + ' ' + ADJUST_LABELS[r.adjust] : '')
        + (r.whiplash ? ' · ' + t('ui.aia.toneWhip') : '')));
      if (r.id) { row.classList.add('aia-jump'); row.onclick = () => h.jumpToScene(r.id); }
      wrap.append(row);
    }
    box.append(wrap);
  }
  return box;
}

/** ส่วนเสริมของการ์ด AI สำหรับตรวจบท: ตัวละคร · ทิศที่ควรปรับโทน · ประโยคต้นฉบับ */
export function doctorFindingExtras(r) {
  const out = [];
  const chips = el('div', 'aia-chips');
  if (r.character) chips.append(el('span', 'aia-chip', gi('user') + ' ' + r.character));
  if (r.adjust && ADJUST_LABELS[r.adjust]) chips.append(el('span', 'aia-chip aia-chip-adj adj-' + r.adjust, ADJUST_LABELS[r.adjust]));
  if (chips.childElementCount) out.push(chips);
  if (r.quote) out.push(el('div', 'aia-doc-quote', r.quote));
  return out;
}
