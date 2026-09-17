// color-util.js — [alpha.157] สีสำหรับ "แถบสีเต็มแถบ" (บริสุทธิ์ 100% · มี unit test)
//
// ผู้ใช้: *"อะไรที่เป็นแถบสี เช่น card kanban ให้ใช้สีเต็มแถบ สีควรเป็น colorful"*
//        *"check ว่ามีสีตัวหนังสือจมมั้ย"*
//
// ค่าสีที่เก็บในไฟล์งาน (`row.color` = '#d9575e' ฯลฯ) **ห้ามเปลี่ยน** — เป็นข้อมูลของ v1
// และเมนูสีเทียบค่ากันตรง ๆ · ที่นี่จึงแปลง "ตอนวาด" เท่านั้น: สีหม่นของจานเดิม → เฉดสด
// และเลือกสีตัวอักษรบนพื้นสีให้อ่านออกเสมอ (ไม่ใช่ขาวตายตัวที่จมบนเหลือง)

/** จานเดิม (ค่าในไฟล์) → เฉดที่ใช้วาดจริง */
export const VIVID = {
  '#d9575e': '#ff4d6d',   // แดง
  '#d97757': '#ff7a2f',   // ส้ม
  '#d9b757': '#ffc42e',   // เหลือง
  '#6fae6f': '#2ecc71',   // เขียว
  '#5f9fd9': '#3b9bff',   // ฟ้า
  '#a97fd0': '#a66bff',   // ม่วง
  '#8a8f98': '#8f9bb3',   // เทากลาง (สถานะที่ไม่มีสีของตัวเอง)
};

/** '#abc' / '#aabbcc' / 'aabbcc' → '#aabbcc' · ค่าที่ไม่ใช่สีคืน '' */
export function normHex(v) {
  let s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
  return /^#[0-9a-f]{6}$/.test(s) ? s : '';
}

/** สีที่ใช้วาดแถบ — สีของจานเดิมถูกยกเป็นเฉดสด สีที่ผู้ใช้เลือกเองคงเดิม */
export function vivid(v) {
  const h = normHex(v);
  return h ? (VIVID[h] || h) : '';
}

/** ความสว่างสัมพัทธ์ตาม WCAG (0–1) */
export function luminance(v) {
  const h = normHex(v);
  if (!h) return 0;
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** อัตราส่วนคอนทราสต์ WCAG ระหว่างสองสี (1–21) */
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** สีตัวอักษรบนพื้นสีนี้ — เลือกขาวหรือเกือบดำตัวที่คอนทราสต์สูงกว่า */
export function inkOn(bg) {
  const h = normHex(bg);
  if (!h) return '';
  return contrast(h, '#ffffff') >= contrast(h, '#1a1426') ? '#ffffff' : '#1a1426';
}

/** สีโปร่ง (พื้นอ่อนของการ์ด) — '#rrggbb' + alpha 0–1 → 'rgba(…)' */
export function tint(v, alpha = 0.16) {
  const h = normHex(v);
  if (!h) return '';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** จานสีสดสำหรับสถานะใหม่ที่ยังไม่ได้เลือกสี — วนตามจำนวนที่มีอยู่ */
export const STATUS_PALETTE = ['#ff4d6d', '#ff7a2f', '#ffc42e', '#2ecc71', '#1abc9c', '#3b9bff', '#a66bff', '#ff5fb8'];
export function nextStatusColor(used = []) {
  const taken = new Set(used.map(normHex));
  return STATUS_PALETTE.find((c) => !taken.has(c)) || STATUS_PALETTE[used.length % STATUS_PALETTE.length];
}
