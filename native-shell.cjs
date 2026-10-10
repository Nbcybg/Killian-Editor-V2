'use strict';
/**
 * native-shell.cjs — [alpha.169 · native] ตรรกะ "ผูกกับระบบปฏิบัติการ" ของ main process (บริสุทธิ์ · unit `native-shell`)
 *
 * ผู้ใช้: *"มีอะไรที่ยังดูแล้ว เหมือนห่อด้วย web · เราอยากได้ app ที่ native เลย"*
 * ของที่ทำให้รู้สึกเป็นเว็บในชั้นหน้าต่าง = ปุ่มย่อ/ขยาย/ปิดวาดเอง (ไม่มี Snap Layouts) · เมนู/กล่องไฟล์ของระบบ
 * ไม่ตามโหมดของธีม · เปิดด้วยไฟล์/ลากโฟลเดอร์ใส่ไอคอนแล้วไม่เกิดอะไร · แถบงานไม่มีรายการโปรเจกต์ล่าสุด
 *
 * ไฟล์นี้ไม่ require('electron') — main.js ส่งของที่ต้องใช้เข้ามา (fs/path) จึงเทสด้วย node ตรง ๆ ได้
 */
const path = require('path');

const HEX = /^#[0-9a-f]{6}$/i;
const PROJECT_FILE = 'project.khn.json';
/** ความสูงแถบชื่อหน้าต่าง (px ที่ --ui-scale = 1) — ต้องเท่ากับ `#titlebar{height}` ใน style.css (unit ตรวจ) */
const TITLEBAR_H = 36;
/** ปุ่มไฟจราจรของ macOS: กึ่งกลางแนวตั้งของแถบ 36px (ปุ่มสูง 12px) */
const TRAFFIC_LIGHT = { x: 13, y: 12 };

const isHex = (c) => HEX.test(String(c || ''));

/** โหมดของธีม ('dark' | 'light') จาก themes.json — หาไม่เจอ = dark (ธีมตั้งต้นของ K2 เป็นธีมมืด) */
function themeMode(themes, id) {
  const list = Array.isArray(themes) ? themes : (themes && Array.isArray(themes.themes) ? themes.themes : []);
  const hit = list.find((t) => t && t.id === id);
  return hit && hit.mode === 'light' ? 'light' : 'dark';
}

/** ดึงค่าตัวแปรสี (#rrggbb) จากข้อความ CSS ของไฟล์ธีม — ไม่เจอ/ไม่ใช่ hex = null */
function cssVarHex(css, name) {
  const m = String(css || '').match(new RegExp('--' + name + ':\\s*(#[0-9a-f]{6})\\b', 'i'));
  return m ? m[1] : null;
}

/**
 * สีของแถบปุ่มหน้าต่าง (Window Controls Overlay): พื้น = --titlebar · สัญลักษณ์ = --fg
 * renderer ส่งค่าที่ "จอใช้อยู่จริง" มาได้ (ธีมเขียนมือที่ใช้ color-mix) — ที่นี่กรองให้เหลือ hex เท่านั้น
 */
function captionColors(o = {}) {
  const mode = o.mode === 'light' ? 'light' : 'dark';
  return {
    mode,
    color: isHex(o.color) ? String(o.color) : (mode === 'light' ? '#f3f3f3' : '#191816'),
    symbolColor: isHex(o.symbol) ? String(o.symbol) : (mode === 'light' ? '#1a1917' : '#e8e6df'),
    height: Math.max(24, Math.min(96, Math.round(+o.height || TITLEBAR_H))),
  };
}

/**
 * ตัวเลือกของ BrowserWindow ตามระบบ:
 *   win32  → แถบชื่อซ่อน + ปุ่มของ Windows เอง (Snap Layouts · ไอคอนคืนขนาด · สีตอนชี้ ได้จากระบบ)
 *   darwin → hiddenInset = ปุ่มไฟจราจรของ macOS (เมนูอยู่บนแถบเมนูของระบบอยู่แล้ว)
 *   อื่น ๆ → ไร้ขอบ วาดปุ่มเองเหมือนเดิม (ตัวจัดการหน้าต่างบน Linux ไม่มีมาตรฐานเดียว)
 */
function windowChrome(platform, colors) {
  const c = captionColors(colors);
  if (platform === 'win32') {
    return { native: true, opts: { titleBarStyle: 'hidden',
      titleBarOverlay: { color: c.color, symbolColor: c.symbolColor, height: c.height } } };
  }
  if (platform === 'darwin') {
    return { native: true, opts: { titleBarStyle: 'hiddenInset', trafficLightPosition: { ...TRAFFIC_LIGHT } } };
  }
  return { native: false, opts: { frame: false } };
}

/**
 * หาโปรเจกต์จากอาร์กิวเมนต์ตอนเปิดโปรแกรม (ลากโฟลเดอร์ใส่ไอคอน · "เปิดด้วย" · รายการบนแถบงาน)
 * รับ: โฟลเดอร์โปรเจกต์ · ไฟล์ project.khn.json · ไฟล์ใด ๆ ข้างในโปรเจกต์ (ไล่ขึ้นไปหารากไม่เกิน 8 ชั้น)
 * @param {string[]} argv · @param {{exists:(p:string)=>boolean, isDir:(p:string)=>boolean, skip?:string[]}} io
 * @returns {string|null} รากโปรเจกต์ (ทางเต็ม) หรือ null
 */
function projectFromArgv(argv, io) {
  const skip = new Set((io.skip || []).map((p) => path.resolve(String(p)).toLowerCase()));
  for (const raw of (argv || []).slice(1)) {
    const a = String(raw || '');
    if (!a || a.startsWith('-')) continue;             // สวิตช์ของ Chromium/Electron
    let p;
    try { p = path.resolve(a); } catch { continue; }
    if (skip.has(p.toLowerCase())) continue;           // โฟลเดอร์ตัวโปรแกรมเอง (`electron .`)
    if (!io.exists(p)) continue;
    let dir = io.isDir(p) ? p : path.dirname(p);
    for (let i = 0; i < 8; i++) {
      if (io.exists(path.join(dir, PROJECT_FILE))) return dir;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

/**
 * รายการ "งาน" บนแถบงานของ Windows (คลิกขวาที่ไอคอน) = โปรเจกต์ล่าสุด
 * โปรแกรมแบบพกพาแตกตัวไปรันที่โฟลเดอร์ชั่วคราว → ต้องชี้ไฟล์ .exe ตัวที่ผู้ใช้เปิดจริง (`PORTABLE_EXECUTABLE_FILE`)
 */
function jumpTasks(recents, exe, o = {}) {
  if (!exe) return [];
  const max = o.max || 6;
  const out = [];
  for (const p of recents || []) {
    const s = String(p || '');
    if (!s || (o.exists && !o.exists(s))) continue;
    out.push({ program: exe, arguments: '"' + s.replace(/"/g, '') + '"',
      title: path.basename(s) || s, description: s, iconPath: exe, iconIndex: 0 });
    if (out.length >= max) break;
  }
  return out;
}

/** ค่าของ setProgressBar: 0..1 = ความคืบหน้า · 2 = กำลังทำ (ไม่รู้ปลายทาง) · -1 = ล้าง */
function progressValue(v) {
  if (v === 'busy') return 2;
  const n = +v;
  if (!Number.isFinite(n) || n < 0) return -1;
  return Math.min(1, n);
}

module.exports = { TITLEBAR_H, TRAFFIC_LIGHT, PROJECT_FILE, isHex, themeMode, cssVarHex, captionColors,
  windowChrome, projectFromArgv, jumpTasks, progressValue };
