// text-color.js — [alpha.132 ข้อ 9] สีตัวอักษร: ตัวตรวจค่าสี · จานสีสำเร็จ · ชุดที่บันทึก · ใช้ล่าสุด
//
// ผู้ใช้จริงขอมา: *"อยากเพิ่มเปลี่ยนสีตัวอักษร มี preset และ color wheel
//                  และมี save color switch และ recent used ให้ด้วย"*
//
// ไฟล์นี้ **บริสุทธิ์ 100%** (ไม่แตะ DOM/kapi/เวลา) และเป็น **CommonJS** เหมือน `md.js`
// (กฎ AGENTS.md ข้อ 3 — md.js ต้อง `require` ตัวนี้ได้ตรง ๆ ส่วนไฟล์อื่น `import` ได้ตามปกติ) — ทั้ง ProseMirror (มาร์ก `color`),
// ตัวเขียน .md, ป๊อปอัปเลือกสี และตัวส่งออก HTML อ่านค่าจากที่นี่ที่เดียว
//
// ═══ ทำไมต้องมีตัวตรวจค่าสีของตัวเอง ═══
// ค่าสีเดินทางเข้ามาได้สามทางที่เชื่อไม่ได้เลยสักทาง: ผู้ใช้พิมพ์เอง · วางจากโปรแกรมอื่น
// (`rgb(17, 17, 17)`) · และ **ไฟล์ .md ที่แก้นอกโปรแกรมได้** ตามกฎของโปรเจกต์
// ค่าที่ผ่านไปถึง `style="color:…"` จึงต้องถูกกรองให้เหลือรูปเดียวเสมอ ไม่งั้นสตริงแปลก ๆ
// หลุดเข้าไปอยู่ในแอตทริบิวต์ HTML ได้ (`red"><script>` เป็นต้น)
// กติกา: **ไม่ผ่าน = ไม่มีสี** (คืน '') ไม่ใช่เดาให้ — เดียวกับกฎ "ไม่มี fallback" ของระบบภาษา

/** จำนวนสีที่จำว่า "ใช้ล่าสุด" — พอให้หยิบซ้ำได้เร็ว แต่ไม่ล้นแถว */
const RECENT_MAX = 12;
/** จำนวนสีที่บันทึกเก็บไว้เองได้สูงสุด */
const SAVED_MAX = 24;

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#[0-9a-f]{6}$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i;
const p2 = (n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');

/**
 * ทำค่าสีให้เป็นรูปเดียว `#rrggbb` (ตัวพิมพ์เล็ก) — ไม่รู้จัก = คืน `''`
 * รับ: `#abc` · `#aabbcc` · `rgb(r,g,b)` · `rgba(r,g,b,a)` (ทิ้งค่าอัลฟา)
 * **ไม่รับชื่อสีภาษาอังกฤษ** — เพราะรายชื่อจริงมี 148 คำ ตรวจไม่ครบก็เท่ากับเปิดช่องให้สตริงอื่นหลุด
 */
function normColor(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return '';
  const m3 = HEX3.exec(s);
  if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  if (HEX6.test(s)) return s;
  const rm = RGB.exec(s);
  if (rm) {
    const [r, g, b] = [+rm[1], +rm[2], +rm[3]];
    if (r > 255 || g > 255 || b > 255) return '';
    return '#' + p2(r) + p2(g) + p2(b);
  }
  return '';
}

/**
 * จานสีสำเร็จ — **แหล่งความจริงเดียว** ของทั้งป๊อปอัปเลือกสีและเทส
 * เรียงเป็นสองแถว: แถวกลาง ๆ ที่ใช้บ่อยในต้นฉบับ แล้วตามด้วยสีสด
 * (ป้ายชื่ออ่านจากไฟล์ภาษา — ค่าที่เก็บลงไฟล์งานเป็นรหัสสี ไม่ใช่ชื่อ จึงไม่ถูกแปล)
 */
const COLOR_PRESETS = [
  { hex: '#111111', key: 'ui.color.ink' },
  { hex: '#5b6472', key: 'ui.color.gray' },
  { hex: '#8a6b3d', key: 'ui.color.brown' },
  { hex: '#b03030', key: 'ui.color.red' },
  { hex: '#d97757', key: 'ui.color.orange' },
  { hex: '#b58900', key: 'ui.color.gold' },
  { hex: '#2f7d4f', key: 'ui.color.green' },
  { hex: '#2b7bb9', key: 'ui.color.blue' },
  { hex: '#5b4bb8', key: 'ui.color.purple' },
  { hex: '#b5468a', key: 'ui.color.pink' },
];

/** คีย์ป้ายชื่อของสีสำเร็จ (ไม่มีในทะเบียน = คืน '' ให้ผู้เรียกใช้รหัสสีแทน)
    — ไฟล์นี้ **ไม่ import i18n** เพราะ `md.js` ต้องเป็นโมดูลไม่มีลูกโซ่ (เทสด้วย node ล้วน ๆ) */
function presetLabelKey(hex) {
  const c = normColor(hex);
  const d = COLOR_PRESETS.find((x) => x.hex === c);
  return d ? d.key : '';
}

/** กรองรายการสีให้เหลือค่าที่ใช้ได้จริง ไม่ซ้ำ และไม่เกิน `max` */
function cleanColorList(list, max) {
  const out = [];
  for (const v of Array.isArray(list) ? list : []) {
    const c = normColor(v);
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** เติมสีที่เพิ่งใช้ขึ้นหัวรายการ (ซ้ำ = เลื่อนขึ้นหัว ไม่ใช่เพิ่มซ้ำ) */
function pushRecent(list, color, max = RECENT_MAX) {
  const c = normColor(color);
  if (!c) return cleanColorList(list, max);
  return cleanColorList([c, ...(Array.isArray(list) ? list : [])], max);
}

/** สลับสถานะ "บันทึกไว้" ของสีหนึ่งค่า — มีอยู่แล้ว = เอาออก · ยังไม่มี = เพิ่มท้าย */
function toggleSaved(list, color, max = SAVED_MAX) {
  const c = normColor(color);
  if (!c) return cleanColorList(list, max);
  const cur = cleanColorList(list, max);
  return cur.includes(c) ? cur.filter((x) => x !== c) : cleanColorList([...cur, c], max);
}

/** ค่าที่จำไว้ในการตั้งค่า → รูปที่ใช้งานได้เสมอ (ค่าขยะถูกโยนทิ้ง ไม่ทำให้ป๊อปอัปพัง) */
function normalizeColorStore(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    saved: cleanColorList(s.saved, SAVED_MAX),
    recent: cleanColorList(s.recent, RECENT_MAX),
  };
}

// ═══════════════ ทางเดินของสีในไฟล์ .md ═══════════════
//
// เก็บเป็น **HTML inline span** ซึ่งเป็นท่ามาตรฐานของ Markdown สำหรับสิ่งที่ไวยากรณ์ไม่มีให้:
//     <span style="color:#b03030">ข้อความ</span>
// เหตุผลที่ไม่คิดเครื่องหมายใหม่ (`{#hex|…}`): ไฟล์ต้องแก้นอกโปรแกรมได้และเปิดในตัวอ่าน
// Markdown ตัวอื่นแล้วยังอ่านรู้เรื่อง — ท่านี้ทุกตัวรู้จัก ส่วน v1 เห็นเป็นข้อความธรรมดา
// (ข้อมูลไม่หาย ตรงกับกฎ "ไฟล์เข้ากันได้")

/** regex ของสแปนสีในไฟล์ .md — กลุ่ม 1 = ค่าสี · กลุ่ม 2 = เนื้อใน */
const COLOR_SPAN_RE = /<span style="color:([^"<>]{1,32})">([\s\S]*?)<\/span>/;

/** ประกอบสแปนสีสำหรับเขียนลงไฟล์ (ค่าสีถูกกรองแล้วเสมอ) */
function colorSpanMd(color, inner) {
  const c = normColor(color);
  return c ? `<span style="color:${c}">${inner}</span>` : String(inner == null ? '' : inner);
}

module.exports = { RECENT_MAX, SAVED_MAX, normColor, COLOR_PRESETS, presetLabelKey,
                   cleanColorList, pushRecent, toggleSaved, normalizeColorStore,
                   COLOR_SPAN_RE, colorSpanMd };
