// starter-fields.js — วิดเจ็ตที่ช่องขั้นสูงใช้ร่วมกัน (แถบโค้ดสั้น · แท็ก · ช่อง Prompt)
//
// ทั้งสามตัวโผล่ในหลายที่ (ตัวละคร · ตอน · หน้าตั้งค่า) จึงต้องอยู่ที่เดียว
// ไม่งั้นเพิ่มปุ่มทีเดียวต้องไล่แก้ 3 แห่ง แล้วลืมแห่งใดแห่งหนึ่งทุกครั้ง
//
// **ตรรกะจริงอยู่ใน entity-mention.js ซึ่งบริสุทธิ์และมีเทส** — ไฟล์นี้เป็นแค่เปลือก DOM

import { el } from '../core.js';
import { t, tf } from '../i18n.js';
import {
  mentionChips, insertAt, unknownMentions, mentionToken,
  MENTION_ANY, MENTION_USER, normalizePrompts, nextPromptKey,
} from '../entity-mention.js';
import { normalizeTags, toggleTag } from './starter-model.js';

/**
 * ป้ายของคำสงวน — ไฟล์ `entity-mention.js` บริสุทธิ์ (ไม่รู้จัก i18n) จึงต้องส่งเข้าไป
 * @returns {{any:string, user:string}}
 */
export function reservedLabels() {
  return { any: t('ui.starter.mentionAny'), user: t('ui.starter.mentionUser') };
}

/**
 * แถบชิป "แทรกชื่อตัวละคร" ใต้ช่องข้อความ
 *
 * ทำไมต้องเป็นปุ่ม ไม่ใช่แค่บอกให้พิมพ์เอง: โค้ดสั้นที่พิมพ์ผิดหนึ่งตัวอักษรคือช่องที่ตายเงียบ
 * (โมเดลจะได้ชื่อดิบแทนตัวละครจริง) · กดปุ่มแล้วไม่มีทางพิมพ์ผิด
 *
 * @param {HTMLTextAreaElement|HTMLInputElement} inp
 * @param {Array} cast
 * @param {function} onChange  เรียกหลังแทรก (คนเรียกเป็นคนบันทึก)
 * @returns {HTMLElement}
 */
export function mentionBar(inp, cast, onChange = () => {}) {
  const box = el('div', 'st-mentions');
  // ช่องแบบข้อความล้วน (textarea/input) กับช่องแบบเห็นผลจริง (contenteditable) แทรกคนละท่า
  const rich = !!(inp && inp.isContentEditable);
  const rows = mentionChips(cast, reservedLabels());
  box.append(el('span', 'st-mentions-label', t('ui.starter.mentionInsert')));
  for (const r of rows) {
    // คำสงวนหน้าตาต่างจากชื่อคนจริง — ไม่งั้นผู้ใช้นึกว่ามีตัวละครชื่อ "character"
    const b = el('button', 'st-mentionchip' + (r.kind === 'char' ? '' : ' reserved'), r.token);
    b.type = 'button';
    b.title = r.kind === 'char' ? tf('ui.starter.mentionChipHint', r.name)
      : (r.kind === 'any' ? t('ui.starter.mentionAnyHint') : t('ui.starter.mentionUserHint'));
    b.dataset.token = r.token;
    b.dataset.kind = r.kind;
    // mousedown+preventDefault — ไม่งั้นโฟกัสหลุดจากช่องแล้ว selectionStart รีเซ็ตเป็น 0
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      if (rich) {
        inp.focus();
        // แทรกเป็น **ข้อความ** ไม่ใช่ HTML — โทเคนต้องรอด sanitize และแก้ด้วยมือได้
        try { document.execCommand('insertText', false, ' ' + r.token + ' '); }
        catch { inp.append(document.createTextNode(' ' + r.token + ' ')); }
        onChange(inp.innerHTML);
        return;
      }
      const r2 = insertAt(inp.value, inp.selectionStart, inp.selectionEnd, r.token);
      inp.value = r2.text;
      inp.focus();
      try { inp.setSelectionRange(r2.caret, r2.caret); } catch { /* input บางชนิดไม่มี */ }
      onChange(r2.text);
    };
    box.append(b);
  }
  if (!(cast || []).length) box.append(el('span', 'st-dim', t('ui.starter.mentionNoCast')));
  return box;
}

/**
 * เตือนเมื่อโค้ดสั้นในช่องชี้ไปหาตัวละครที่ไม่มีอยู่จริง
 * คืนฟังก์ชัน `refresh(text)` ให้คนเรียกยิงทุกครั้งที่พิมพ์
 */
export function mentionWarn(host, cast) {
  const warn = el('div', 'st-mention-warn');
  warn.style.display = 'none';
  host.append(warn);
  return (text) => {
    const bad = unknownMentions(text, cast);
    warn.style.display = bad.length ? '' : 'none';
    warn.textContent = bad.length ? tf('ui.starter.mentionUnknown', bad.join(', ')) : '';
  };
}

/**
 * ช่องข้อความหลายบรรทัดที่รับโค้ดสั้น — ช่องเดียวได้ครบ: label · placeholder · ชิป · คำเตือน
 * @returns {HTMLElement} row (มี `__input`)
 */
export function mentionField(label, value, onInput,
                             { cast = [], rows = 4, placeholder = '', hint = '' } = {}) {
  const row = el('div', 'st-field');
  row.append(el('label', null, label));
  const ta = el('textarea', 'wiki-input st-ta');
  ta.rows = rows;
  ta.value = value || '';
  ta.placeholder = placeholder;
  row.append(ta);
  if (hint) row.append(el('div', 'st-hint', hint));
  const refresh = mentionWarn(row, cast);
  ta.oninput = () => { onInput(ta.value); refresh(ta.value); };
  row.append(mentionBar(ta, cast, (v) => { onInput(v); refresh(v); }));
  refresh(ta.value);
  row.__input = ta;
  return row;
}

/**
 * ช่องแท็กแบบพิมพ์เอง (ผู้ใช้ข้อ 2.2 — *"เพิ่ม tags ของตัวละคร โดยพิมพ์ลงไป"*)
 * @param {function} get  () => string[]
 * @param {function} set  (string[]) => void
 */
export function tagInput(label, get, set, { placeholder = '' } = {}) {
  const row = el('div', 'st-field');
  row.append(el('label', null, label));
  const picked = el('div', 'st-tag-picked');
  const inp = el('input', 'wiki-input');
  inp.placeholder = placeholder || t('ui.starter.tagOwnPlaceholder');

  const redraw = () => {
    picked.innerHTML = '';
    const rows = normalizeTags(get());
    if (!rows.length) { picked.append(el('span', 'st-dim', t('ui.starter.noTagYet'))); return; }
    for (const tg of rows) {
      const c = el('span', 'st-tag on', tg);
      const x = el('span', 'st-tag-x', '×');
      x.title = t('ui.common.del');
      x.onclick = () => { set(toggleTag(get(), tg)); redraw(); };
      c.append(x);
      picked.append(c);
    }
  };
  const add = () => {
    // พิมพ์คั่นด้วยจุลภาคทีเดียวหลายอันได้ — คนก๊อปแท็กมาจากที่อื่นเป็นแถวเสมอ
    const vals = inp.value.split(',').map((x) => x.trim()).filter(Boolean);
    if (!vals.length) return;
    set(normalizeTags([...(get() || []), ...vals]));
    inp.value = '';
    redraw();
  };
  inp.onkeydown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && !e.isComposing) { e.preventDefault(); add(); }
  };
  inp.onblur = add;                       // ออกจากช่องแล้วของที่พิมพ์ค้างต้องไม่หาย
  const btn = el('button', 'k-ok', t('ui.starter.tagAdd'));
  btn.type = 'button';
  btn.onmousedown = (e) => e.preventDefault();
  btn.onclick = add;

  const own = el('div', 'st-tag-own');
  own.append(inp, btn);
  row.append(picked, own);
  redraw();
  row.__input = inp;
  row.__redraw = redraw;
  return row;
}

/**
 * ช่อง Prompt แบบเพิ่มเองได้ (ผู้ใช้ข้อ 2.4 — *"สามารถเพิ่ม field prompt ได้นะ เช่น prompt A prompt B"*)
 *
 * @param {function} get  () => [{k,v}]
 * @param {function} set  ([{k,v}]) => void
 * @param {object} opts   cast (สำหรับชิปโค้ดสั้น) · label · hint
 */
export function promptFields(get, set, { cast = [], label = '', hint = '' } = {}) {
  const wrap = el('div', 'st-prompts');
  const head = el('div', 'st-sub', label || t('ui.starter.fPrompts'));
  const add = el('button', 'k-ok st-prompt-add', '+ ' + t('ui.starter.promptAdd'));
  add.type = 'button';
  add.onclick = () => {
    const rows = normalizePrompts(get());
    set([...rows, { k: nextPromptKey(rows), v: '' }]);
    redraw();
  };
  head.append(add);
  wrap.append(head);
  if (hint) wrap.append(el('div', 'st-hint', hint));
  const list = el('div', 'st-prompt-list');
  wrap.append(list);

  function redraw() {
    list.innerHTML = '';
    const rows = normalizePrompts(get());
    if (!rows.length) { list.append(el('div', 'st-dim', t('ui.starter.promptEmpty'))); return; }
    rows.forEach((r, i) => {
      const box = el('div', 'st-prompt-row');
      const key = el('input', 'wiki-input st-prompt-key');
      key.value = r.k;
      key.placeholder = t('ui.starter.promptKeyPlaceholder');
      key.oninput = () => {
        const cur = normalizePrompts(get());
        // อ่านค่าปัจจุบันใหม่ทุกครั้งแทนที่จะปิดทับ `rows` — ช่องอื่นอาจถูกแก้ไปแล้วระหว่างนี้
        if (cur[i]) { cur[i] = { ...cur[i], k: key.value }; set(cur); }
      };
      const val = el('textarea', 'wiki-input st-ta st-prompt-val');
      val.rows = 3;
      val.value = r.v;
      val.placeholder = t('ui.starter.promptValPlaceholder');
      val.oninput = () => {
        const cur = normalizePrompts(get());
        if (cur[i]) { cur[i] = { ...cur[i], v: val.value }; set(cur); }
      };
      const del = el('button', 'st-danger st-prompt-del', '×');
      del.type = 'button';
      del.title = t('ui.starter.promptDel');
      del.onclick = () => {
        const cur = normalizePrompts(get());
        cur.splice(i, 1);
        set(cur);
        redraw();
      };
      const top = el('div', 'st-prompt-top');
      top.append(key, del);
      box.append(top, val);
      if (cast.length) box.append(mentionBar(val, cast, (v) => {
        const cur = normalizePrompts(get());
        if (cur[i]) { cur[i] = { ...cur[i], v }; set(cur); }
      }));
      list.append(box);
    });
  }
  redraw();
  wrap.__redraw = redraw;
  return wrap;
}

/** ป้ายบอกว่าช่องนี้รับโค้ดสั้น — ใช้เป็น hint ใต้ช่องที่ไม่มีชิป */
export function mentionHint() {
  return tf('ui.starter.mentionHint', mentionToken(MENTION_ANY), mentionToken(MENTION_USER));
}

/**
 * ช่องแบบ **เห็นผลจริง** ที่รับโค้ดสั้น — ใช้กับ Story Opener (ผู้ใช้ขอ b/i/u)
 *
 * ใช้ `richEditor` ตัวเดียวกับคำบรรยายเรื่อง เพื่อให้แถบเครื่องมือ/กติกาเรื่องรูปเหมือนกันหมด
 * (นำเข้าแบบ dynamic กัน import วน: starter-richtext → starter-store → …)
 *
 * @returns {Promise<HTMLElement>} row · `row.__getHtml()` อ่านค่าปัจจุบัน
 */
export async function richMentionField(label, value, {
  slug = '', cast = [], placeholder = '', hint = '', minHeight = 150,
} = {}) {
  const { richEditor } = await import('./starter-richtext.js');
  const row = el('div', 'st-field');
  row.append(el('label', null, label));
  let cur = String(value || '');
  // ประกาศก่อนสร้างตัวแก้ไข — `onChange` อ้างถึงมัน และ TDZ ของ `const` จะระเบิด
  // ถ้าวันหน้ามีใครทำให้ richEditor ยิง onChange ตั้งแต่ตอนสร้าง
  let refresh = () => {};
  const rt = await richEditor({
    slug, value: cur, minHeight,
    onChange: (html) => { cur = html; refresh(cur); },
  });
  // contenteditable ไม่มี placeholder ในตัว — ใช้ ::before ของ CSS อ่านจาก data-ph
  if (placeholder) rt.__area.dataset.ph = placeholder;
  row.append(rt);
  if (hint) row.append(el('div', 'st-hint', hint));
  refresh = mentionWarn(row, cast);
  row.append(mentionBar(rt.__area, cast, (html) => { cur = html; refresh(cur); }));
  refresh(cur);
  row.__getHtml = () => cur;
  row.__setHtml = (v) => { cur = String(v || ''); rt.__setHtml(cur); refresh(cur); };
  row.__area = rt.__area;
  return row;
}
