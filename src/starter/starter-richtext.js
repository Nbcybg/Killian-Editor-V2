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
const CMDS = [
  { cmd: 'bold', label: 'B', cls: 'st-rt-b', tip: () => t('ui.starter.rtBold') },
  { cmd: 'italic', label: 'I', cls: 'st-rt-i', tip: () => t('ui.starter.rtItalic') },
  { cmd: 'underline', label: 'U', cls: 'st-rt-u', tip: () => t('ui.starter.rtUnderline') },
  { sep: true },
  { cmd: 'justifyLeft', label: '⇤', tip: () => t('ui.starter.rtLeft') },
  { cmd: 'justifyCenter', label: '↔', tip: () => t('ui.starter.rtCenter') },
  { cmd: 'justifyRight', label: '⇥', tip: () => t('ui.starter.rtRight') },
  { sep: true },
  { cmd: 'insertUnorderedList', label: '•', tip: () => t('ui.starter.rtList') },
  { cmd: 'removeFormat', label: '✕', tip: () => t('ui.starter.rtClear') },
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
    for (const b of bar.querySelectorAll('button[data-cmd]')) {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch {}
      b.classList.toggle('on', !!on);
    }
  };

  for (const c of CMDS) {
    if (c.sep) { bar.append(el('span', 'st-rt-sep')); continue; }
    const b = el('button', 'st-rt-btn' + (c.cls ? ' ' + c.cls : ''), c.label);
    b.type = 'button';
    b.dataset.cmd = c.cmd;
    b.title = c.tip();
    // mousedown + preventDefault — ไม่งั้นโฟกัสหลุดจากข้อความที่เลือกไว้ก่อนคำสั่งจะทำงาน
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      area.focus();
      try { document.execCommand(c.cmd, false, null); } catch (e) { log('warn', 'starter rt: ' + c.cmd, e); }
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
