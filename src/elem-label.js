// elem-label.js — ป้ายชนิด element บนจอ (บทภาพยนตร์ + นิยาย) — [alpha.164 ข้อ B5]
//
// `SP_ELEMS[k].th` (fountain.js) และ `PROSE_ELEMS[k].th` (convert.js) เป็น **คำศัพท์ของไวยากรณ์ไฟล์งาน**
// เก็บเป็นไทยเสมอ (ข้ามด่าน i18n ทั้งไฟล์) — แต่เดิมถูกหยิบไปโชว์บนจอตรง ๆ 12 จุด
// (เมนูชนิด element · ตารางรูปแบบบท · ตัวเลือก PDF · กล่องลบ element · แถบสถานะ)
// → ตั้ง UI เป็นอังกฤษแล้วชื่อชนิดยังเป็นไทยทั้งหมด
//
// คีย์เขียนเป็นตารางตัวอักษรตรง ๆ (ไม่ประกอบสตริงตอนรัน) เพื่อให้ด่าน test/i18n-keys กวาดเจอทุกตัว
import { t } from './i18n.js';

const ELEM_KEYS = {
  // บทภาพยนตร์ (SP_ELEMS)
  scene: 'ui.elem.scene', action: 'ui.elem.action', character: 'ui.elem.character',
  parenthetical: 'ui.elem.parenthetical', dialogue: 'ui.elem.dialogue',
  'transition-in': 'ui.elem.transitionIn', transition: 'ui.elem.transition',
  subheader: 'ui.elem.subheader', intercut: 'ui.elem.intercut', shot: 'ui.elem.shot',
  'act-break': 'ui.elem.actBreak', 'page-break': 'ui.elem.pageBreak', summary: 'ui.elem.summary',
  outline1: 'ui.elem.outline1', outline2: 'ui.elem.outline2', outline3: 'ui.elem.outline3',
  note: 'ui.elem.note', 'cont-left': 'ui.elem.contLeft', 'cont-right': 'ui.elem.contRight',
  image: 'ui.elem.image', raw: 'ui.elem.raw',
  // นิยาย (PROSE_ELEMS)
  h1: 'ui.elem.h1', h2: 'ui.elem.h2', h3: 'ui.elem.h3', h4: 'ui.elem.h4', h5: 'ui.elem.h5', h6: 'ui.elem.h6',
  p: 'ui.elem.p', pbold: 'ui.elem.pBold', pitalic: 'ui.elem.pItalic', pright: 'ui.elem.pRight',
  quote: 'ui.elem.quote', ul: 'ui.elem.ul', ol: 'ui.elem.ol', hr: 'ui.elem.hr', code: 'ui.elem.code',
  img: 'ui.elem.img', pagebreak: 'ui.elem.pagebreakProse', blank: 'ui.elem.blank',
};

/** ชื่อชนิด element ตามภาษาของ UI · ไม่รู้จัก = คืนรหัสเดิม */
export function elemLabel(k) {
  const key = ELEM_KEYS[k];
  return key ? t(key) : String(k == null ? '' : k);
}

/** รายชื่อชนิดทั้งหมดที่มีป้าย (ใช้ในเทส) */
export const ELEM_LABEL_IDS = Object.keys(ELEM_KEYS);
