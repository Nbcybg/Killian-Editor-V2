// support-ui.js — [alpha.170] เปิดหน้าสนับสนุนโปรเจกต์ (ทางเดียวของเมนู ช่วยเหลือ และกล่อง "เกี่ยวกับ" — คำสั่ง `support`)
// ที่อยู่อยู่ที่ app-info.js ที่เดียว · เปิดในเบราว์เซอร์ของระบบเมื่อผู้ใช้กดเท่านั้น (ไม่มีการเรียกเน็ตจากในโปรแกรม)
import { log, setStatus, setStatusError, t } from './core.js';
import { SUPPORT_URL } from './app-info.js';

// ตัวเปิดเบราว์เซอร์ — จุดเดียว (e2e สลับเป็นของปลอมด้วย setSupportIo ไม่เปิดเบราว์เซอร์จริง)
const io = { open: (url) => kapi.openExternal(url) };
/** สลับตัวเปิดเบราว์เซอร์ (เทส) — คืนฟังก์ชันคืนค่าเดิม */
export function setSupportIo(patch) {
  const old = { ...io };
  Object.assign(io, patch || {});
  return () => { Object.assign(io, old); };
}

/** @returns {Promise<boolean>} เปิดได้ไหม — main ตอบ false เมื่อไม่ยอมเปิดลิงก์ (ไม่ throw) จึงต้องบอกผู้ใช้ ไม่ใช่เงียบ */
export async function openSupportPage() {
  let ok = false;
  try { ok = (await io.open(SUPPORT_URL)) !== false; } catch (e) { log('warn', 'support: open failed', e); }
  if (ok) { log('info', 'support: page opened'); setStatus(t('ui.app.supportOpened')); }
  else setStatusError(t('ui.bug.openFail'));
  return ok;
}
