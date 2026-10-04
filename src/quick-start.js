// quick-start.js — [alpha.168 · bug hunt] กล่อง "เริ่มต้นใช้งาน" (ช่วยเหลือ → เริ่มต้นใช้งาน)
//
// ก่อนรุ่นนี้เมนูช่วยเหลือมีแค่ปุ่มลัดกับบันทึกการเปลี่ยนแปลง — ผู้ใช้ใหม่ไม่มีอะไรบอกเลยว่าโปรแกรมทำงานยังไง
// (โปรเจกต์คือโฟลเดอร์ · แผงอยู่ที่ไหน · ส่งออกจากตรงไหน) กล่องนี้เป็นภาพรวมหน้าเดียว ไม่ใช่คู่มือฉบับเต็ม
//
// เนื้อหาอยู่ในไฟล์ภาษาทั้งหมด (`ui.guide.*`) — ตารางคีย์เต็มข้างล่าง (ห้ามประกอบคีย์จากชิ้นส่วน: ตัวตรวจไฟล์ภาษามองไม่เห็น)
import { t } from './i18n.js';
import { el, state } from './core.js';
import { icon } from './icons.js';

/** ขั้นของคู่มือ: ไอคอน + คีย์หัวข้อ + คีย์เนื้อหา */
export const GUIDE_STEPS = [
  { icon: 'folder',       title: 'ui.guide.s1Title', text: 'ui.guide.s1Text' },
  { icon: 'book-content', title: 'ui.guide.s2Title', text: 'ui.guide.s2Text' },
  { icon: 'pencil',       title: 'ui.guide.s3Title', text: 'ui.guide.s3Text' },
  { icon: 'user',         title: 'ui.guide.s4Title', text: 'ui.guide.s4Text' },
  { icon: 'layout',       title: 'ui.guide.s5Title', text: 'ui.guide.s5Text' },
  { icon: 'export',       title: 'ui.guide.s6Title', text: 'ui.guide.s6Text' },
  { icon: 'keyboard',     title: 'ui.guide.s7Title', text: 'ui.guide.s7Text' },
];

/** เปิดกล่องเริ่มต้นใช้งาน → คืนตัวกล่อง (ปิดด้วยปุ่มปิด · Esc · คลิกพื้นหลัง) */
export function openQuickStart() {
  for (const old of document.querySelectorAll('.k-overlay.k-guide-ov')) old.remove();
  const ov = el('div', 'k-overlay k-guide-ov');
  const box = el('div', 'k-dialog k-wide k-guide');
  box.append(el('div', 'k-dlg-title', t('ui.guide.title')));
  box.append(el('div', 'k-guide-intro dim', t('ui.guide.intro')));
  const list = el('ol', 'k-guide-list');
  for (const s of GUIDE_STEPS) {
    const li = el('li', 'k-guide-step');
    const ic = el('span', 'k-guide-ic');
    ic.append(icon(s.icon, 20));
    const main = el('div', 'k-guide-main');
    main.append(el('div', 'k-guide-step-title', t(s.title)), el('div', 'k-guide-step-text', t(s.text)));
    li.append(ic, main);
    list.append(li);
  }
  box.append(list);
  const btns = el('div', 'k-dlg-btns');
  const close = () => ov.remove();
  const run = async (ch) => { close(); (await import('./app.js')).handleCommand(ch); };
  const keys = el('button', 'cmp-mini k-guide-keys', t('ui.guide.shortcuts'));
  keys.type = 'button';
  keys.onclick = () => run('cheatsheet');
  btns.append(keys);
  if (!state.root) {
    // ยังไม่มีโปรเจกต์: ปุ่มหลัก = สร้างโปรเจกต์ (ขวาสุด) · ปิด = ปุ่มรอง
    const c = el('button', 'k-cancel', t('ui.common.close'));
    c.type = 'button'; c.onclick = close;
    const mk = el('button', 'k-ok', t('ui.guide.newProject'));
    mk.type = 'button'; mk.onclick = () => run('new-project');
    btns.append(c, mk);
  } else {
    const c = el('button', 'k-ok k-cancel', t('ui.common.close'));      // ทางออกเดียว = Enter/Esc ปิดได้ทั้งคู่
    c.type = 'button'; c.onclick = close;
    btns.append(c);
  }
  box.append(btns);
  ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.append(ov);
  return ov;
}
