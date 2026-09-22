// palette.js — [alpha.162 · W6 ข้อ 2] ★ สีทุกสีที่ "ไม่ใช่สีเปลือกโปรแกรม" อยู่ที่นี่ที่เดียว
//
// ══ ทำไมมีสองแบบ ══
// · สีของ **เปลือกโปรแกรม** (พื้นกระดาน · เส้นกริด · สีเลือก · ตัวหนังสือ · ขอบ) ต้องตามธีม →
//   อ่านจากตัวแปรธีมด้วย `themeColor('--x', สำรอง)` (ผืนวาด canvas/SVG อ่าน `var(--x)` เองไม่ได้)
// · สี **เนื้อหา/ความหมาย** (กระดาษโน้ตสีเหลือง · งานเสร็จสีเขียว · จานสีให้ผู้ใช้เลือกทาโหนด ·
//   ภาพที่ส่งออกไปพิมพ์บนกระดาษขาว · สีชุดข้อมูลในกราฟ) ต้อง **เหมือนกันทุกธีม** — ไม่งั้นโน้ตที่ผู้ใช้
//   ทาไว้เปลี่ยนความหมายตามธีม หรือไฟล์ที่ส่งออกออกมาเป็นพื้นดำ → เก็บเป็นค่าคงที่มีชื่อ ที่นี่ที่เดียว
// เดิมสองแบบปนกันเป็นเลข hex ตรง ๆ กระจาย 8 ไฟล์ (planner-props มีจานสีโหนดชุดเดียวกันซ้ำสองชุด)

/** จานสีโหนดของกระดานวางแผน (ช่องเลือกสี) — ลำดับ = ลำดับบนจอ */
export const PLANNER_NODE_COLORS = ['#3f3e3a', '#5f7a9f', '#7a6f9f', '#5f8a6f', '#d97757',
                                    '#f2c14e', '#c1666b', '#4a6fa5', '#e8e3d3', '#26241f'];
/** จานสีเส้นเชื่อม */
export const PLANNER_EDGE_COLORS = ['#d97757', '#faf9f5', '#5f7a9f', '#5f8a6f', '#f2c14e', '#c1666b', '#7a6f9f'];

/** สีตั้งต้นตามชนิดโหนดของกระดาน (สีความหมาย — ไม่ตามธีม) */
export const PLANNER_KIND = {
  sticky: '#f2c14e',      // กระดาษโน้ต
  note: '#4a6fa5',        // โน้ตสีฟ้า
  paper: '#e8e3d3',       // การ์ดกระดาษสว่าง
  inkOnLight: '#26241f',  // ตัวหนังสือบนพื้นสว่าง
  done: '#5f8a6f',        // งานเสร็จแล้ว
  statusUnknown: '#6b6b6b',
  onColor: '#ffffff',     // ตัวหนังสือบนป้ายสี
  handle: '#2b7bb9',      // จุดจับของตัวเลือกหลายชิ้น
  fillDefault: '#faf9f5', // สีพื้นตั้งต้นของรูปทรง (ช่องเลือกสี)
  borderDefault: '#ffffff',
};

/** สีของภาพที่ **ส่งออกไปพิมพ์** (พื้นกระดาษขาวเสมอ ไม่ตามธีม) */
export const PRINT = {
  paper: '#ffffff', ink: '#222222', inkSoft: '#57534a', inkMuted: '#8a857a', inkTitle: '#2c2a26',
  line: '#333333', rule: '#d8d3c6', panel: '#fbfaf7', accent: '#d97757', edge: '#98958b',
  accentAlt: '#9a958a', pinDefault: '#d9b757', pinPortal: '#5f9fd9', pinEntity: '#d9575e',
  label: '#1a1a1a', marker: '#c0392b',
};

/** สีชุดข้อมูลของกราฟ (แยกหมวดให้ออก ไม่ตามธีม) */
export const CHART_SERIES = ['#3b9bff', '#2ecc71', '#ffc42e', '#ff7a2f', '#a66bff', '#ff4d6d', '#1abc9c'];
/** สีของสถานะที่ยังไม่ได้ตั้ง (แดชบอร์ด · คัมบัง ใช้ตัวเดียวกัน) */
export const STATUS_UNSET = '#8f9bb3';

// ───────── สีเปลือกโปรแกรมสำหรับผืนวาด ─────────
const _cache = new Map();
/**
 * ค่าจริงของตัวแปรธีม (เช่น `--canvas`) — สำหรับ canvas/SVG ที่อ่าน `var()` เองไม่ได้
 * แคชไว้ (ตัววาดกระดานเรียกหลายร้อยครั้งต่อเฟรม) · เปลี่ยนธีมแล้วต้อง `clearThemeColorCache()`
 * @param {string} name ชื่อตัวแปร (`--x`) · @param {string} fallback ค่าเมื่ออ่านไม่ได้ (ไม่มี DOM · ไม่มีตัวแปร)
 */
export function themeColor(name, fallback) {
  if (_cache.has(name)) return _cache.get(name);
  let v = '';
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const el = document.body || document.documentElement;
      v = getComputedStyle(el).getPropertyValue(name).trim();
    }
  } catch {}
  const out = v || fallback;
  if (v) _cache.set(name, out);            // ค่าว่าง (ยังไม่โหลดธีม) ไม่แคช — อ่านใหม่รอบหน้า
  return out;
}
/** ล้างแคชสีธีม — เรียกทุกครั้งที่เปลี่ยนธีม */
export function clearThemeColorCache() { _cache.clear(); }
