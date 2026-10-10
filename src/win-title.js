// win-title.js — [alpha.169] ชื่อบนแถบชื่อหน้าต่าง: แหล่งเดียว (บริสุทธิ์ + ตัวลงมือที่แตะ DOM · unit `win-title`)
//
// ผู้ใช้: *"ใน title bar ของ app ต้องกำกับเลข version ด้วย"*
// เดิมข้อความ `<ชื่อผลงาน> — Killian 2` ถูกประกอบเองสามที่ (เปิดผลงาน · กล่องตั้งค่า · เปลี่ยนชื่อผลงาน)
// และ **ไม่มีที่ไหนล้างตอนปิดผลงาน** → ปิดผลงานแล้วแถบชื่อยังค้างชื่อเรื่องเดิม
// ตอนนี้ทุกทางเรียก `applyWindowTitle()` ตัวเดียว: แถบชื่อ (#tb-title) + ชื่อหน้าต่างของระบบ (document.title)
//
// เลขรุ่นมาจาก package.json ทาง `kapi.appVersion` (main ส่งมาแบบ sync) — ไม่มีการพิมพ์เลขรุ่นในโค้ด

/** ชื่อโปรแกรม (ชื่อเฉพาะ ไม่ผ่านไฟล์ภาษา) */
export const APP_NAME = 'Killian 2';

/** `2.0.0-alpha.168` → `v2.0.0-alpha.168` · ว่าง = '' */
export function versionLabel(version) {
  const v = String(version == null ? '' : version).trim().replace(/^v/i, '');
  return v ? 'v' + v : '';
}

/**
 * ชิ้นส่วนของชื่อหน้าต่าง
 * @returns {{main:string, version:string, full:string}}
 *   main    = `<ผลงาน> — Killian 2` (ไม่มีผลงาน = `Killian 2`)
 *   version = `v2.0.0-alpha.168`
 *   full    = ชื่อหน้าต่างของระบบ (แถบงาน · Alt+Tab)
 */
export function windowTitle(project, version) {
  const p = String(project == null ? '' : project).trim();
  const main = p ? p + ' — ' + APP_NAME : APP_NAME;
  const ver = versionLabel(version);
  return { main, version: ver, full: ver ? main + ' ' + ver : main };
}

/** เลขรุ่นของโปรแกรมที่กำลังรัน */
function runningVersion() {
  try { return (typeof kapi !== 'undefined' && kapi.appVersion) || ''; } catch { return ''; }
}

/**
 * ตั้งชื่อหน้าต่าง — เรียกเมื่อ เปิด/ปิด/เปลี่ยนชื่อผลงาน และตอนบูต (ยังไม่มีผลงาน)
 * @param {string} [project] ชื่อผลงาน (ว่าง = ไม่มีผลงานเปิดอยู่)
 */
export function applyWindowTitle(project) {
  const tt = windowTitle(project, runningVersion());
  if (typeof document === 'undefined') return tt;
  document.title = tt.full;
  const host = document.getElementById('tb-title');
  if (host) {
    const name = document.createElement('span');
    name.id = 'tb-title-text';
    name.textContent = tt.main;
    const ver = document.createElement('span');
    ver.id = 'tb-ver';
    ver.textContent = tt.version;
    host.replaceChildren(name, ver);
  }
  return tt;
}
