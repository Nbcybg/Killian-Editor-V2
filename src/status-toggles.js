// status-toggles.js — [alpha.165] ช่อง "อะไรเปิด/ปิดอยู่" บนแถบสถานะ
//
// ผู้ใช้: "status bar บางครั้งขึ้น พร้อม อย่างเดียว ไม่มีบอกสถานะอะไรเลย … ต้องแบ่ง
//          พร้อม | อะไร on/off อยู่ | progressbar | status | zoom | home button"
//
// ตาราง STATUS_TOGGLES = แหล่งเดียวของสวิตช์ที่โชว์ (ลำดับ = ลำดับบนแถบ)
//   · `cmd`   คำสั่งใน handleCommand ที่สลับค่านั้นจริง (ทางเดียวกับเมนู/คีย์ลัด — กฎ "สวิตช์หลายทางเข้า")
//             ไม่มีคำสั่งสลับ (ตั้งได้ในกล่องตั้งค่าเท่านั้น) = คลิกแล้วเปิดตั้งค่า
//   · `on()`  อ่านสภาพจริงตอนนี้ (อ่านอย่างเดียว ไม่แคช)
// ปุ่มถูกวาดครั้งเดียว · `syncStatusToggles()` แค่สลับคลาส/aria/ทูลทิป (ถูกเรียกบ่อยได้ — ไม่แตะเลย์เอาต์)
import { state, el, t, tf } from './core.js';
import { icon } from './icons.js';
import { isTypewriter } from './typewriter.js';

export const STATUS_TOGGLES = [
  { id: 'autosave',     label: 'ui.sb.autosave',    icon: 'save',    on: () => (Number(state.settings.autoSaveMinutes) || 0) > 0 },
  { id: 'spell',        label: 'ui.sb.spell',       icon: 'check',   on: () => state.settings.spellCheckDict !== false },
  { id: 'line-numbers', label: 'ui.sb.lineNumbers', icon: 'list-ol', cmd: 'line-numbers', on: () => !!state.settings.lineNumbers },
  { id: 'typewriter',   label: 'ui.sb.typewriter',  icon: 'edit',    cmd: 'typewriter', on: () => !!isTypewriter() },
  { id: 'auto-fit',     label: 'ui.sb.autoFit',     icon: 'expand',  cmd: 'auto-fit-width', on: () => !!state.settings.autoFitWidth },
  { id: 'md-codes',     label: 'ui.sb.mdCodes',     icon: 'code-alt', cmd: 'markdown-codes', on: () => state.settings.showMarkdownCodes !== false },
];

let _run = null;

/** วาดปุ่มครั้งเดียว — `run(cmd)` = handleCommand ของ app.js (ส่งเข้ามา กันวง import) */
export function installStatusToggles(run) {
  _run = run;
  const host = document.getElementById('status-toggles');
  if (!host || host.dataset.ready) return false;
  host.dataset.ready = '1';
  for (const d of STATUS_TOGGLES) {
    const b = el('button', 'k-sb-toggle');
    b.type = 'button';
    b.dataset.toggle = d.id;
    b.append(icon(d.icon, 13));
    b.onclick = () => {
      if (!_run) return;
      _run(d.cmd || 'settings');
      // คำสั่งบางตัวเปลี่ยนค่าแบบ async (บันทึกไฟล์ตั้งค่า) — อ่านสภาพใหม่อีกครั้งหลังจากนั้น
      setTimeout(syncStatusToggles, 50); setTimeout(syncStatusToggles, 400);
    };
    host.append(b);
  }
  syncStatusToggles();
  return true;
}

/** อ่านสภาพจริงแล้วอัปเดตปุ่มทุกตัว (ถูก) — เรียกจาก refreshToolbar / หลังบันทึกตั้งค่า */
export function syncStatusToggles() {
  const host = document.getElementById('status-toggles');
  if (!host) return 0;
  let n = 0;
  for (const d of STATUS_TOGGLES) {
    const b = host.querySelector(`[data-toggle="${d.id}"]`);
    if (!b) continue;
    let on = false;
    try { on = !!(state.settings && d.on()); } catch {}
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const title = tf(on ? 'ui.sb.stateOn' : 'ui.sb.stateOff', t(d.label));
    if (b.getAttribute('title') !== title) b.setAttribute('title', title);
    b.dataset.tip = d.cmd ? 'ui.sb.tipToggle' : 'ui.sb.tipSettings';
    n++;
  }
  return n;
}
