'use strict';
/**
 * a11y-shell.cjs — [alpha.169 · a11y] แป้นพิมพ์บนจอของระบบปฏิบัติการ (บริสุทธิ์ · unit `a11y`)
 *
 * ผู้ใช้: *"Virtual keyboard จะเปิดของ os นั้น ๆ"*
 * โปรแกรมไม่วาดแป้นพิมพ์เอง — แป้นของระบบรู้จักภาษา/เลย์เอาต์ที่ผู้ใช้ตั้งไว้ และใช้ได้กับทุกโปรแกรม
 *
 * ไฟล์นี้ไม่ require('electron') — คืน "แผน" (ลำดับของสิ่งที่จะลอง) ให้ main.js ลงมือ จึงเทสด้วย node ตรง ๆ ได้
 *   kind 'open'  = เปิดด้วยเชลล์ของระบบ (shell.openPath)   — Windows ต้องทางนี้เท่านั้น ดูหมายเหตุ
 *   kind 'spawn' = รันคำสั่ง (child_process.spawn · detached)
 *   kind 'url'   = เปิดหน้าตั้งค่าของระบบ (shell.openExternal) — ทางสุดท้ายเมื่อเปิดแป้นตรง ๆ ไม่ได้
 */
const path = require('path');

/**
 * @param {string} platform process.platform
 * @param {object} [env] process.env
 * @returns {Array<{kind:'open'|'spawn'|'url', target:string, args?:string[], settings?:boolean}>}
 */
function oskPlan(platform, env = {}) {
  if (platform === 'win32') {
    // ⚠ osk.exe ประกาศ uiAccess — สร้างโปรเซสตรง ๆ (CreateProcess/spawn) ได้ ERROR_ELEVATION_REQUIRED (740)
    // ต้องเปิดผ่านเชลล์ (ShellExecute) ซึ่ง shell.openPath ของ Electron ใช้อยู่
    // SystemRoot มาจากตัวแปรของระบบ ไม่ใช่ข้อมูลจากผู้ใช้/หน้าจอ — ไม่มีส่วนไหนของทางนี้ที่ renderer กำหนดได้
    const root = env.SystemRoot || env.windir || 'C:\\Windows';
    return [
      { kind: 'open', target: path.win32.join(root, 'System32', 'osk.exe') },
      { kind: 'url', target: 'ms-settings:easeofaccess-keyboard', settings: true },
    ];
  }
  if (platform === 'darwin') {
    // macOS ไม่มีคำสั่งเปิด "แป้นพิมพ์ช่วยการเข้าถึง" โดยตรงที่ใช้ได้ทุกรุ่น — ลองตัวแสดงแป้นก่อน
    // ไม่ได้ก็พาไปหน้า การช่วยการเข้าถึง → แป้นพิมพ์ ให้ผู้ใช้เปิดสวิตช์เอง (ครั้งเดียว)
    return [
      { kind: 'spawn', target: '/usr/bin/open', args: ['-b', 'com.apple.inputmethod.AssistiveControl'] },
      { kind: 'spawn', target: '/usr/bin/open', args: ['-b', 'com.apple.KeyboardViewer'] },
      { kind: 'url', target: 'x-apple.systempreferences:com.apple.preference.universalaccess?Keyboard', settings: true },
    ];
  }
  // Linux/BSD: ไม่มีมาตรฐานเดียว — ลองตัวที่พบบ่อยตามลำดับ (ตัวแรกที่รันได้ชนะ)
  return [
    { kind: 'spawn', target: 'onboard', args: [] },
    { kind: 'spawn', target: 'florence', args: [] },
    { kind: 'spawn', target: 'matchbox-keyboard', args: [] },
    { kind: 'spawn', target: 'kvkbd', args: [] },
    { kind: 'spawn', target: 'gsettings',
      args: ['set', 'org.gnome.desktop.a11y.applications', 'screen-keyboard-enabled', 'true'] },
  ];
}

/**
 * เดินตามแผนจนกว่าจะมีขั้นที่สำเร็จ
 * @param {Array} plan ผลของ oskPlan()
 * @param {{open:Function, spawn:Function, url:Function}} run ตัวลงมือของแต่ละชนิด — คืน true/Promise<true> เมื่อสำเร็จ
 * @returns {Promise<{ok:boolean, step?:object, settings?:boolean, tried:number}>}
 *   `settings:true` = เปิดแป้นตรง ๆ ไม่ได้ พาไปหน้าตั้งค่าของระบบแทน (ผู้เรียกบอกผู้ใช้ต่างกัน)
 */
async function runOskPlan(plan, run) {
  let tried = 0;
  for (const step of Array.isArray(plan) ? plan : []) {
    const fn = run && run[step.kind];
    if (typeof fn !== 'function') continue;
    tried++;
    let ok = false;
    try { ok = !!(await fn(step)); } catch { ok = false; }
    if (ok) return { ok: true, step, settings: !!step.settings, tried };
  }
  return { ok: false, tried };
}

module.exports = { oskPlan, runOskPlan };
