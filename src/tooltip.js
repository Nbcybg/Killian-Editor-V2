// tooltip.js — [alpha.150] คำอธิบายใต้ชื่อปุ่ม (ตรรกะล้วน · ไม่แตะ DOM · มี unit test)
//
// ผู้ใช้: *"ตอนนี้เรายังขาดคือ hover tooltip ที่ไม่มีคำอธิบาย เช่น
//          align left (ctrl + l) | Align your content with the left margin.
//          Left alignment is commonly used for body text, makes the document easier to read"*
//
// ═══ ของเดิมมีอะไรอยู่แล้ว ═══
// โปรแกรมมีระบบคำแนะนำของตัวเองอยู่แล้ว (`setupHoverTips()` ใน app.js) ที่ถอด `title`
// ของเบราว์เซอร์ออกแล้ววาดกล่องเอง — **ห้ามสร้างระบบที่สอง** (กฎเดียวกับ "ตัวแปลงมาร์กดาวน์
// ต้องมีตัวเดียว") ไฟล์นี้จึงทำแค่ส่วนที่ยังขาด: *ตัดสินว่าปุ่มนี้มีคำอธิบายว่าอะไร*
// แล้ว app.js เอาไปต่อเป็นบรรทัดที่สองในกล่องเดิม
//
// ═══ คำอธิบายอยู่ที่ไหน ═══
// ไฟล์ภาษาเท่านั้น คีย์ `ui.tip.<คำสั่ง>` เช่น `ui.tip.fmt:align:left`
// (รูปคีย์ `ui.<module>.<name>` ยอมให้มี `:` ใน name อยู่แล้ว — เทส i18n-keys ตรวจข้อนี้)
//
// **ข้อยกเว้นของกฎ "ไม่มี fallback"**: ปุ่มที่ยังไม่มีคำอธิบายต้องได้ `''` ไม่ใช่ตัวคีย์
// เพราะ "ยังไม่มีคำอธิบาย" เป็นสภาพปกติที่ยอมรับได้ (กล่องแสดงแค่ชื่อ+คีย์ลัดเหมือนเดิม)
// ไม่ใช่คีย์ขาดแบบที่ต้องให้ผู้ใช้เห็นเพื่อจะได้แจ้ง — จึงใช้ `lookup()` ไม่ใช่ `t()`

import { lookup } from './i18n.js';

/** คำนำหน้าคีย์คำอธิบายทั้งหมด */
export const TIP_PREFIX = 'ui.tip.';

/**
 * คีย์คำอธิบายจากคำสั่งของปุ่ม
 * @param {string} cmd      ค่าใน `data-command` (เช่น `fmt:align:left`)
 * @param {string} [explicit] ค่าใน `data-tip` — เขียนทับได้ สำหรับปุ่มที่ไม่มีคำสั่งเป็นของตัวเอง
 * @returns {string} '' = ปุ่มนี้ไม่มีทางมีคำอธิบาย (ไม่ผูกคำสั่ง และไม่ได้ระบุคีย์เอง)
 */
export function tipKey(cmd, explicit) {
  if (explicit) return String(explicit);
  return cmd ? TIP_PREFIX + cmd : '';
}

/** คำอธิบายของคำสั่งหนึ่ง ('' = ยังไม่มี) */
export function tipText(cmd, explicit) {
  const key = tipKey(cmd, explicit);
  if (!key) return '';
  const v = lookup(key);
  return typeof v === 'string' ? v : '';
}

/**
 * ประกอบเนื้อกล่องคำแนะนำ — หัวเรื่อง (ชื่อ + คีย์ลัด ซึ่งมาจาก `title` ของปุ่มจริง)
 * กับคำอธิบาย · คืน `null` เมื่อไม่มีอะไรจะแสดงเลย
 * @returns {{head:string, desc:string}|null}
 */
export function tipContent(title, cmd, explicit) {
  const head = String(title == null ? '' : title).trim();
  const desc = tipText(cmd, explicit);
  if (!head && !desc) return null;
  return { head, desc };
}
