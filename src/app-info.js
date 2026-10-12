// app-info.js — [alpha.170] ข้อมูลของ "เจ้าของโปรแกรม" ที่โชว์ในโปรแกรม (ที่เดียว · บริสุทธิ์ · unit `docs-view`)
//
// ผู้ใช้: *"ตรง copyright … ถ้าใส่ เขียนว่า Noobcyborg Studio"* · *"ใส่ link สนับสนุน ที่ readme และใน app ด้วย"*
// เป็นชื่อเฉพาะ/ที่อยู่ของผู้ดูแล ไม่ใช่ข้อความของหน้าจอ — ไม่ผ่านไฟล์ภาษา (เหมือน BUG_CONTACT ของ bug-config.js)

/** ผู้ถือลิขสิทธิ์ — ต้องตรงกับไฟล์ LICENSE · README · package.json (unit เทียบ) */
export const COPYRIGHT_HOLDER = 'Noobcyborg Studio';
/** ปีที่เผยแพร่ครั้งแรก */
export const COPYRIGHT_SINCE = 2026;
/** บรรทัดลิขสิทธิ์ — ปีเดียว หรือช่วงปีเมื่อข้ามปีแล้ว */
export function copyrightLine(year = new Date().getFullYear()) {
  const y = Number.isInteger(year) && year > COPYRIGHT_SINCE ? COPYRIGHT_SINCE + '–' + year : String(COPYRIGHT_SINCE);
  return String.fromCharCode(0xA9) + ' ' + y + ' ' + COPYRIGHT_HOLDER;
}

/** หน้าสนับสนุนโปรเจกต์ — เปิดในเบราว์เซอร์ของระบบเมื่อผู้ใช้กดเท่านั้น (https เสมอ · unit ตรวจ) */
export const SUPPORT_URL = 'https://buymeacoffee.com/noobcyborg';
