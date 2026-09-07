// starter-richtext.js — ช่องกรอกแบบเห็นผลจริงสำหรับ Story Description (alpha.96)
//
// ผู้ใช้ขอ: ตัวหนา/เอียง/ขีดเส้นใต้ · จัดหน้าซ้าย-กลาง-ขวา · แทรกรูปได้
//
// จงใจ **ไม่** ใช้ ProseMirror ที่โปรแกรมมีอยู่ — ตัวนั้นผูกกับ schema ของนิยาย/บทหนัง
// (ฉาก · mention · ตรวจคำผิด · จัดหน้ากระดาษ) ซึ่งไม่มีอันไหนเกี่ยวกับคำบรรยายเรื่องเลย
// ที่นี่ต้องการแค่ HTML ก้อนเดียว → `contenteditable` + `execCommand` พอ และเบากว่ามาก
//
// กติกาเรื่องรูป (สำคัญที่สุดในไฟล์นี้): รูปถูกก๊อปเข้า `<starter>/images/` เสมอ
// และ **เก็บลงไฟล์เป็น `images/x.png`** ไม่ใช่ที่อยู่เต็ม — ย้ายโปรเจกต์แล้วรูปไม่ตาย
// (การแปลงไป-กลับอยู่ใน starter-html.js ซึ่งเทสแยก)

import { el, setStatus, log } from '../core.js';
import { t } from '../i18n.js';
import { sanitizeHtml, htmlToStorage, htmlToDisplay } from './starter-html.js';
import { importImage, starterDir } from './starter-store.js';

// ป้ายกำกับเก็บเป็น **ฟังก์ชัน** ไม่ใช่คีย์ที่เอาไปต่อสตริง
// (`t('ui.starter.' + key)` ทำให้ตัวตรวจภาษาหาคีย์จริงไม่เจอ แล้วขึ้นเป็นคีย์กำพร้า)
// [alpha.122] ผู้ใช้ให้ *"ตรวจสอบว่า tool bar สามารถใช้ tool ได้หมดยัง"* — ผลตรวจ:
//   · ปุ่มเดิม 8 ตัวทำงานครบ **แต่** ปุ่มที่ไม่มีสถานะเปิด/ปิด (จัดหน้า/รายการ) ไม่เคยติดไฟ
//     เพราะ `syncActive` ยิง `queryCommandState` กับทุกปุ่มรวมถึงตัวที่คำสั่งไม่รองรับ
//   · `execCommand('bold')` คืนเป็น `<span style="font-weight:...">` เมื่อ styleWithCSS เปิดค้าง
//     จากตัวแก้ไขอื่นในหน้าเดียวกัน → บังคับปิดทุกครั้งก่อนสั่ง (ดู `runCmd`)
//   · ขาดของที่คนคาดหวังจริง ๆ: ขีดฆ่า · หัวข้อ · รายการมีเลข · คำพูด · ลิงก์ · เลิกทำ/ทำซ้ำ
//     → เพิ่มครบในรอบนี้ (ทุกตัวอยู่ในรายการแท็กที่ starter-html.js อนุญาตอยู่แล้ว)
const CMDS = [
  { cmd: 'undo', label: '↶', tip: () => t('ui.starter.rtUndo'), noState: true },
  { cmd: 'redo', label: '↷', tip: () => t('ui.starter.rtRedo'), noState: true },
  { sep: true },
  { cmd: 'bold', label: 'B', cls: 'st-rt-b', tip: () => t('ui.starter.rtBold') },
  { cmd: 'italic', label: 'I', cls: 'st-rt-i', tip: () => t('ui.starter.rtItalic') },
  { cmd: 'underline', label: 'U', cls: 'st-rt-u', tip: () => t('ui.starter.rtUnderline') },
  { cmd: 'strikeThrough', label: 'S', cls: 'st-rt-s', tip: () => t('ui.starter.rtStrike') },
  { sep: true },
  { cmd: 'formatBlock', arg: 'h2', label: 'H2', tip: () => t('ui.starter.rtH2'), noState: true },
  { cmd: 'formatBlock', arg: 'h3', label: 'H3', tip: () => t('ui.starter.rtH3'), noState: true },
  { cmd: 'formatBlock', arg: 'p', label: '¶', tip: () => t('ui.starter.rtPara'), noState: true },
  { cmd: 'formatBlock', arg: 'blockquote', label: '❝', tip: () => t('ui.starter.rtQuote'), noState: true },
  { sep: true },
  { cmd: 'justifyLeft', label: '⇤', tip: () => t('ui.starter.rtLeft') },
  { cmd: 'justifyCenter', label: '↔', tip: () => t('ui.starter.rtCenter') },
  { cmd: 'justifyRight', label: '⇥', tip: () => t('ui.starter.rtRight') },
  { sep: true },
  { cmd: 'insertUnorderedList', label: '•', tip: () => t('ui.starter.rtList') },
  { cmd: 'insertOrderedList', label: '1.', tip: () => t('ui.starter.rtListNum') },
  { cmd: 'insertHorizontalRule', label: '—', tip: () => t('ui.starter.rtRule'), noState: true },
  { sep: true },
  { cmd: 'removeFormat', label: '✕', tip: () => t('ui.starter.rtClear'), noState: true },
];

/**
 * สร้างตัวแก้ไข
 * @param {object} opts
 *   - slug      ไอดีโฟลเดอร์ของ starter (ใช้หาที่เก็บรูป)
 *   - value     HTML ที่เก็บไว้ (รูปเป็น `images/x.png`)
 *   - onChange  (htmlForStorage) => void  — ได้ HTML ที่พร้อมเขียนลงไฟล์แล้ว
 * @returns {Promise<HTMLElement>}
 */
export async function richEditor({ slug, value = '', onChange = () => {}, minHeight = 180 }) {
  const wrap = el('div', 'st-rt');
  const baseUrl = slug ? await kapi.toFileURL(await starterDir(slug)) : '';

  // ── แถบเครื่องมือ ──
  const bar = el('div', 'st-rt-bar');
  const area = el('div', 'st-rt-area');
  area.contentEditable = 'true';
  area.spellcheck = false;
  area.style.minHeight = minHeight + 'px';
  area.innerHTML = htmlToDisplay(sanitizeHtml(value), baseUrl);

  const emit = () => {
    // เก็บ = กรองแล้ว + ที่อยู่รูปย่อกลับเป็นแบบสัมพัทธ์เสมอ
    onChange(htmlToStorage(sanitizeHtml(area.innerHTML)));
  };

  const syncActive = () => {
    // เฉพาะปุ่มที่คำสั่งมี "สถานะ" จริง — undo/formatBlock/hr ไม่มี queryCommandState ที่ใช้ได้
    for (const b of bar.querySelectorAll('button[data-cmd]:not([data-nostate])')) {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch {}
      b.classList.toggle('on', !!on);
    }
  };

  /**
   * สั่ง execCommand ให้ได้ผลเหมือนกันทุกครั้ง
   * `styleWithCSS` เป็นสถานะระดับ **เอกสาร** — ตัวแก้ไขอื่นในหน้าเดียวกันเปิดค้างไว้ได้
   * แล้วปุ่มตัวหนาของเราจะคืน `<span style>` แทน `<b>` (ผ่าน sanitize แต่ผลลัพธ์ไม่เหมือนเดิม)
   */
  const runCmd = (cmd, arg = null) => {
    area.focus();
    try { document.execCommand('styleWithCSS', false, false); } catch { /* บางเบราว์เซอร์ไม่มี */ }
    try { document.execCommand(cmd, false, arg); }
    catch (e) { log('warn', 'starter rt: ' + cmd, e); }
  };

  for (const c of CMDS) {
    if (c.sep) { bar.append(el('span', 'st-rt-sep')); continue; }
    const b = el('button', 'st-rt-btn' + (c.cls ? ' ' + c.cls : ''), c.label);
    b.type = 'button';
    b.dataset.cmd = c.cmd;
    if (c.arg) b.dataset.arg = c.arg;
    if (c.noState) b.dataset.nostate = '1';
    b.title = c.tip();
    // mousedown + preventDefault — ไม่งั้นโฟกัสหลุดจากข้อความที่เลือกไว้ก่อนคำสั่งจะทำงาน
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      // formatBlock ต้องส่งชื่อแท็กเป็นวงเล็บมุมบน Firefox/รุ่นเก่า — Chromium รับทั้งสองแบบ
      runCmd(c.cmd, c.cmd === 'formatBlock' ? '<' + c.arg + '>' : (c.arg || null));
      syncActive(); emit();
    };
    bar.append(b);
  }

  // ── แทรกรูป ──
  bar.append(el('span', 'st-rt-sep'));
  const imgBtn = el('button', 'st-rt-btn', '🖼');
  imgBtn.type = 'button';
  imgBtn.title = t('ui.starter.rtImage');
  imgBtn.onmousedown = (e) => e.preventDefault();
  imgBtn.onclick = async () => {
    const p = await kapi.openImageDialog();
    if (!p) return;
    const f = await importImage(slug, p);         // ก๊อปเข้าโฟลเดอร์ starter ก่อนเสมอ
    if (!f) { setStatus(t('ui.starter.imgCopyFail')); return; }
    const url = baseUrl + '/images/' + encodeURIComponent(f);
    area.focus();
    try {
      document.execCommand('insertHTML', false,
        '<img src="' + url + '" style="max-width: 100%" />');
    } catch (e) {
      log('warn', 'starter rt: insert image', e);
      area.append(Object.assign(document.createElement('img'), { src: url }));
    }
    emit();
  };
  bar.append(imgBtn);

  // ── ลิงก์ ──
  // ต้องมีข้อความที่เลือกไว้ก่อน (execCommand createLink ไม่สร้างข้อความให้เอง)
  const linkBtn = el('button', 'st-rt-btn', '🔗');
  linkBtn.type = 'button';
  linkBtn.title = t('ui.starter.rtLink');
  linkBtn.onmousedown = (e) => e.preventDefault();
  linkBtn.onclick = async () => {
    const sel = String(window.getSelection() || '');
    if (!sel.trim()) { setStatus(t('ui.starter.rtLinkNeedSel')); return; }
    const { ask } = await import('../ui.js');
    const url = await ask(t('ui.starter.rtLinkAsk'), { placeholder: 'https://' });
    if (!url) return;
    runCmd('createLink', url);
    emit();
  };
  bar.append(linkBtn);

  // ── เหตุการณ์ของพื้นที่พิมพ์ ──
  area.oninput = emit;
  area.onkeyup = syncActive;
  area.onmouseup = syncActive;
  // วางทับ: บังคับเป็นข้อความล้วนเสมอ — HTML จากเว็บพาสไตล์/สคริปต์เข้ามาทั้งก้อน
  area.onpaste = (e) => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    try { document.execCommand('insertText', false, txt); } catch { area.textContent += txt; }
    emit();
  };

  wrap.append(bar, area);
  wrap.__area = area;
  wrap.__setHtml = (v) => { area.innerHTML = htmlToDisplay(sanitizeHtml(v), baseUrl); };
  return wrap;
}

/** วาดคำบรรยายแบบอ่านอย่างเดียว (หน้าเรื่อง/การ์ด) */
export async function renderRichView(slug, html) {
  const box = el('div', 'st-rt-view');
  const baseUrl = slug ? await kapi.toFileURL(await starterDir(slug)) : '';
  box.innerHTML = htmlToDisplay(sanitizeHtml(html || ''), baseUrl);
  return box;
}
