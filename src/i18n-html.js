// i18n-html.js — [alpha.154] ข้อความจากไฟล์ภาษา → ลงใน HTML (ทางเดียวของทั้งโปรแกรม)
//
// ผู้ใช้: *"ย้าย HTML ที่เหลือออกจาก CSV ด้วย"* — กฎ: **ไฟล์ภาษาเก็บข้อความล้วน · โครง HTML อยู่ในโค้ด**
// เดิมกล่อง/แถบเครื่องมือหลายสิบจุดเก็บ HTML ทั้งก้อนเป็นค่าในไฟล์ภาษา คนแปลต้องแปลผ่านแท็ก
// และค่าที่แปลแล้วถูกยัดลง innerHTML ตรง ๆ (ใส่ " หรือ < ในคำแปลทีเดียว กล่องพังทั้งกล่อง)
//
// ตอนนี้โค้ดประกอบโครงเอง แล้วเอาข้อความผ่านตัวนี้:
//   tx('ui.x.y')           → ข้อความที่ escape แล้ว (ใช้ได้ทั้งในเนื้อความและในค่า attribute)
//   txf('ui.x.y', [a, b])  → เหมือน tf() แต่ escape เฉพาะส่วนที่มาจากไฟล์ภาษา
//                            ค่าที่แทรก {0},{1} ลงไป **ตามเดิมไม่ escape** — ผู้เรียกเป็นคนเตรียม
//                            (บางค่าเป็น HTML ตั้งใจ เช่นรายการ <option> หรือไอคอน)
import { t } from './i18n.js';

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** escape ข้อความให้ปลอดภัยใน HTML (เนื้อความและค่า attribute ในเครื่องหมาย ") */
export function hx(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => MAP[c]);
}

/** แทน {0},{1}… ด้วยค่าที่ส่งมา (ไม่ escape) — ส่วนที่เหลือของข้อความ escape */
export function hf(tpl, a = []) {
  // [alpha.164 · รอบต่อ 2] รู้จักรูปพหูพจน์ `{0|page|pages}` เหมือน formatMsg (คำนั้นมาจากไฟล์ภาษา → escape)
  const s = String(tpl == null ? '' : tpl);
  const re = /\{(\d+)(?:\|([^|{}]*)\|([^{}]*))?\}/g;
  let out = '', last = 0, m;
  while ((m = re.exec(s))) {
    out += hx(s.slice(last, m.index));
    const v = a[+m[1]];
    if (m[2] !== undefined) out += hx(Math.abs(Number(String(v).replace(/[^\d.-]/g, ''))) === 1 ? m[2] : m[3]);
    else out += String(v == null ? '' : v);
    last = re.lastIndex;
  }
  return out + hx(s.slice(last));
}

/** ข้อความของคีย์ (escape แล้ว) */
export function tx(key) { return hx(t(key)); }

/** ข้อความของคีย์ + ค่าแทรก (escape เฉพาะส่วนจากไฟล์ภาษา) */
export function txf(key, a) { return hf(t(key), a); }
