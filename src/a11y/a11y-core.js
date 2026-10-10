// a11y-core.js — [alpha.169 · a11y] ตรรกะของ "การช่วยการเข้าถึง" (บริสุทธิ์ 100% · unit `a11y`)
//
// ผู้ใช้: *"เพิ่ม feature แบบ accessibility สำหรับผู้มีปัญหา ตั้งใน setting"*
//   1. แสดงปุ่มที่กด — ตัวอักษรใหญ่กลางจอ ชั้นบนสุด (คนที่มองแป้นพิมพ์ไม่เห็น)
//   3. แถบสีบรรทัดที่เคอร์เซอร์อยู่ (คนที่หาเคอร์เซอร์ไม่เจอ)
//
// ที่นี่มีแต่ตรรกะ: ค่าเริ่มต้น + ตัวหนีบค่า · "เหตุการณ์กดปุ่ม → ข้อความที่จะโชว์" · เรขาคณิตของแถบ
// ตัวที่แตะ DOM อยู่ใน key-echo.js / line-band.js · import ได้แค่ num.js + color-util.js
import { numClamp } from '../num.js';
import { normHex, luminance } from '../color-util.js';

/** โหมดของตัวแสดงปุ่ม: ทุกปุ่ม · เฉพาะตัวอักษรที่พิมพ์ · เฉพาะปุ่มพิเศษ/คีย์ลัด */
export const KEY_ECHO_MODES = ['all', 'typing', 'special'];
/** ตำแหน่งบนจอ */
export const KEY_ECHO_POSITIONS = ['center', 'top', 'bottom'];

/**
 * ค่าเริ่มต้นทั้งชุด — **ชื่อคีย์ตรงกับแถวใน GLOBAL_DEFAULTS ของ core.js** (unit ตรวจว่าครบทั้งสองฝั่ง)
 * ทุกตัวเป็นค่าระดับผู้ใช้: ความต้องการด้านการมองเห็น/สมาธิเป็นของ "คน" ไม่ใช่ของผลงาน
 */
export const A11Y_DEFAULTS = {
  a11yKeyEcho: false,
  a11yKeyEchoMode: 'all',
  a11yKeyEchoPos: 'center',
  a11yKeyEchoSize: 160,          // px — ความสูงตัวอักษรบนป้าย
  a11yKeyEchoMs: 900,            // ค้างบนจอนานเท่าไรหลังกดครั้งล่าสุด
  a11yLineBand: false,
  a11yLineBandColor: '#ffe066',
  a11yLineBandOpacity: 0.4,
  typewriterMode: false,         // โหมดเครื่องพิมพ์ดีด — เดิมเป็นสถานะของเซสชัน เปิดโปรแกรมใหม่แล้วหาย
};

export const KEY_ECHO_SIZE = { min: 48, max: 400 };
export const KEY_ECHO_MS = { min: 300, max: 5000 };
export const LINE_BAND_OPACITY = { min: 0.1, max: 0.9 };

/** ค่าที่ใช้ได้จริงจาก settings (ค่าเสีย/หาย = ค่าเริ่มต้น · ตัวเลขถูกหนีบเข้าช่วง) */
export function normA11y(s) {
  const o = s || {};
  const D = A11Y_DEFAULTS;
  return {
    keyEcho: o.a11yKeyEcho === true,
    keyEchoMode: KEY_ECHO_MODES.includes(o.a11yKeyEchoMode) ? o.a11yKeyEchoMode : D.a11yKeyEchoMode,
    keyEchoPos: KEY_ECHO_POSITIONS.includes(o.a11yKeyEchoPos) ? o.a11yKeyEchoPos : D.a11yKeyEchoPos,
    keyEchoSize: Math.round(numClamp(o.a11yKeyEchoSize, D.a11yKeyEchoSize, KEY_ECHO_SIZE.min, KEY_ECHO_SIZE.max)),
    keyEchoMs: Math.round(numClamp(o.a11yKeyEchoMs, D.a11yKeyEchoMs, KEY_ECHO_MS.min, KEY_ECHO_MS.max)),
    lineBand: o.a11yLineBand === true,
    lineBandColor: normHex(o.a11yLineBandColor) || D.a11yLineBandColor,
    lineBandOpacity: numClamp(o.a11yLineBandOpacity, D.a11yLineBandOpacity, LINE_BAND_OPACITY.min, LINE_BAND_OPACITY.max),
    typewriter: o.typewriterMode === true,
  };
}

/**
 * คีย์ที่ "ไฟล์ผู้ใช้ชนะไฟล์ผลงานเสมอ" ตอนเปิดผลงาน = ทุกค่าในหน้า การช่วยการเข้าถึง + ธีม (ธีมคอนทราสต์สูง/ตาบอดสี)
 * คนที่ต้องใช้ตัวช่วยพวกนี้ต้องได้มันในทุกผลงาน ไม่ใช่เปิดใหม่ทีละผลงาน
 * ⚠ เพิ่มคีย์ที่นี่ได้เฉพาะตัวที่ **ทุกทางเขียน** เขียนไฟล์ผู้ใช้ด้วย (saveGlobalSetting / กล่องตั้งค่า) —
 *   ไม่งั้นสวิตช์ที่เขียนแค่ไฟล์ผลงานจะถูกค่าเก่าในไฟล์ผู้ใช้ดึงกลับตอนเปิดผลงานครั้งถัดไป
 */
export const A11Y_USER_KEYS = [...Object.keys(A11Y_DEFAULTS), 'theme',
                               'typeSound', 'typeSoundVolume', 'typeSoundMode', 'typeSoundAlways'];

/**
 * ตอนเปิดผลงาน: ค่าช่วยการเข้าถึงจาก **ไฟล์ผู้ใช้** ทับสำเนาที่ติดมากับไฟล์ผลงาน (แก้ `settings` ที่ส่งมาแล้วคืนตัวเดิม)
 * ไฟล์ผู้ใช้ยังไม่มีคีย์นั้น = คงค่าที่รวมมาแล้ว (ค่าจากไฟล์ผลงานของรุ่นก่อน หรือค่าเริ่มต้น)
 */
export function userA11yWins(settings, globalSettings) {
  const out = settings || {};
  const g = globalSettings || {};
  for (const k of A11Y_USER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(g, k)) out[k] = g[k];
  }
  return out;
}

// ── ชื่อปุ่มตามที่พิมพ์อยู่บนแป้น ──
// เป็น "ตัวอักษรบนฝาปุ่ม" ไม่ใช่ข้อความของโปรแกรม (ทางเดียวกับ formatShortcut ใน core.js) จึงไม่ผ่านไฟล์ภาษา
// — ผู้ใช้ต้องเห็นคำเดียวกับที่อยู่บนแป้นจริงเพื่อจับคู่ได้
const NAMED = {
  Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Escape: 'Esc', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'Page Up', PageDown: 'Page Down',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  CapsLock: 'Caps Lock', NumLock: 'Num Lock', ScrollLock: 'Scroll Lock',
  ContextMenu: 'Menu', PrintScreen: 'Print Screen', Pause: 'Pause',
};
const MOD_KEYS = { Control: 'ctrl', Shift: 'shift', Alt: 'alt', Meta: 'meta', AltGraph: 'altgr' };
/** อักขระที่ต้องเกาะตัวอื่น (สระบน/ล่าง · วรรณยุกต์ · เครื่องหมายกำกับเสียง) */
const COMBINING = /^\p{M}$/u;
/** ปุ่มที่ไม่มีอะไรให้โชว์ (กำลังประกอบอักษรผ่าน IME · ปุ่มตาย · ระบบไม่บอกว่าปุ่มอะไร) */
const SILENT = new Set(['Process', 'Dead', 'Unidentified', 'Compose']);

/** ป้ายของปุ่มปรับแต่งตามระบบ */
export function modLabel(mod, mac) {
  if (mod === 'ctrl') return mac ? 'Control' : 'Ctrl';
  if (mod === 'alt') return mac ? 'Option' : 'Alt';
  if (mod === 'meta') return mac ? 'Cmd' : 'Win';
  if (mod === 'altgr') return 'AltGr';
  return 'Shift';
}

/**
 * ป้ายของ "ปุ่มกายภาพ" จาก `event.code` — ใช้กับคีย์ลัด (Ctrl+…) เท่านั้น
 * แป้นไทยกด Ctrl+ห ระบบส่ง key = 'ห' แต่คีย์ลัดของโปรแกรมจับที่ตำแหน่งปุ่ม (KeyS) → โชว์ "Ctrl + S"
 * ให้ตรงกับที่เมนู/ทูลทิปเขียน
 */
export function codeLabel(code) {
  const c = String(code || '');
  let m = /^Key([A-Z])$/.exec(c); if (m) return m[1];
  m = /^Digit(\d)$/.exec(c); if (m) return m[1];
  m = /^Numpad(\d)$/.exec(c); if (m) return m[1];
  m = /^F(\d{1,2})$/.exec(c); if (m) return 'F' + m[1];
  const P = { Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`', BracketLeft: '[',
              BracketRight: ']', Semicolon: ';', Quote: "'", Minus: '-', Equal: '=', Space: 'Space',
              NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/',
              NumpadDecimal: '.', NumpadEnter: 'Enter' };
  return P[c] || '';
}

/**
 * เหตุการณ์กดปุ่ม → สิ่งที่จะโชว์
 * @param {{key?:string, code?:string, ctrlKey?:boolean, altKey?:boolean, shiftKey?:boolean, metaKey?:boolean,
 *          isComposing?:boolean, getModifierState?:Function}} ev
 * @param {{mac?:boolean, mode?:string}} [opts]
 * @returns {{parts:string[], kind:'char'|'key'|'combo'|'mod'}|null} `null` = ไม่โชว์
 *   · `char`  ตัวอักษรที่พิมพ์ออกมาจริง (ไทย/อังกฤษ/สัญลักษณ์ — ตามแป้นที่ผู้ใช้ตั้งอยู่)
 *   · `key`   ปุ่มที่มีชื่อ (Enter · Backspace · ลูกศร · F5)
 *   · `combo` กดร่วมกับปุ่มปรับแต่ง (Ctrl + S)
 *   · `mod`   ปุ่มปรับแต่งล้วน ๆ (Shift)
 */
export function keyEchoParts(ev, opts = {}) {
  if (!ev) return null;
  const key = typeof ev.key === 'string' ? ev.key : '';
  if (!key || ev.isComposing || SILENT.has(key)) return null;
  const mac = !!opts.mac;
  const mode = KEY_ECHO_MODES.includes(opts.mode) ? opts.mode : 'all';
  const done = (parts, kind) => {
    if (mode === 'typing' && kind !== 'char') return null;
    if (mode === 'special' && kind === 'char') return null;
    return { parts, kind };
  };

  // ปุ่มปรับแต่งล้วน ๆ
  if (MOD_KEYS[key]) return done([modLabel(MOD_KEYS[key], mac)], 'mod');

  // AltGr บน Windows มาเป็น Ctrl+Alt พร้อมกัน — เป็นการพิมพ์ตัวอักษร ไม่ใช่คีย์ลัด
  const altGr = !!(ev.getModifierState && ev.getModifierState('AltGraph'));
  const ctrl = !!ev.ctrlKey && !altGr, alt = !!ev.altKey && !altGr, meta = !!ev.metaKey;
  const mods = [];
  if (ctrl) mods.push(modLabel('ctrl', mac));
  if (alt) mods.push(modLabel('alt', mac));
  if (meta) mods.push(modLabel('meta', mac));

  const named = NAMED[key] || (/^F\d{1,2}$/.test(key) ? key : '');
  const isSpace = key === ' ' || key === 'Spacebar';
  const printable = !named && !isSpace && [...key].length === 1;

  // คีย์ลัด: มี Ctrl/Alt/Cmd → โชว์ตำแหน่งปุ่ม (ไม่ใช่อักษรของแป้นภาษาที่เปิดอยู่)
  if (mods.length) {
    if (ev.shiftKey) mods.push('Shift');
    const base = named || (isSpace ? 'Space' : '') || codeLabel(ev.code) || (printable ? key.toUpperCase() : key);
    return done([...mods, base], 'combo');
  }
  if (isSpace) return done(ev.shiftKey ? ['Shift', 'Space'] : ['Space'], ev.shiftKey ? 'combo' : 'key');
  if (named) return done(ev.shiftKey ? ['Shift', named] : [named], ev.shiftKey ? 'combo' : 'key');
  // ตัวอักษรที่พิมพ์ออกมา — Shift รวมอยู่ในผลแล้ว (ก ↔ ฏ · a ↔ A) ไม่ต้องบอกซ้ำ
  // สระบน/ล่างและวรรณยุกต์ (ไม้เอก · สระอิ …) เป็นอักขระที่ต้อง "เกาะ" ตัวอื่น — กดเดี่ยว ๆ แล้วลอยอยู่บนที่ว่าง มองไม่ออก
  // → วางบนวงกลมประ ซึ่งเป็นฐานมาตรฐานของ Unicode สำหรับแสดงอักขระพวกนี้
  if (printable) return done([COMBINING.test(key) ? '◌' + key : key], 'char');
  // ปุ่มสื่อ/ปุ่มพิเศษของผู้ผลิต (AudioVolumeUp ฯลฯ) — ชื่อยาวเป็นคำอังกฤษติดกัน โชว์ตามนั้น
  return done([key], 'key');
}

/**
 * ขนาดตัวอักษรของป้าย (px) ที่ไม่ล้นหน้าต่าง — ผู้ใช้ตั้งได้ถึง 400px แต่หน้าต่างอาจเล็ก/ชื่อปุ่มอาจยาว (Backspace)
 * ประมาณความกว้างตัวอักษรตัวหนา ≈ 0.62em · ป้ายสูง ≈ 1.5em + ขอบ → กินได้ไม่เกิน 86% ของกว้าง และ 70% ของสูง
 * @param {number} px ขนาดที่อยากได้ · @param {number} len จำนวนตัวอักษรบนป้าย · @param {number} vw · @param {number} vh ขนาดหน้าต่าง
 */
export function fitKeyEchoSize(px, len, vw, vh) {
  let v = Number.isFinite(+px) && +px > 0 ? +px : A11Y_DEFAULTS.a11yKeyEchoSize;
  const n = Math.max(1, Math.round(+len) || 1);
  if (Number.isFinite(+vw) && +vw > 0) v = Math.min(v, (+vw * 0.86) / (n * 0.62 + 0.8));
  if (Number.isFinite(+vh) && +vh > 0) v = Math.min(v, (+vh * 0.7) / 1.75);
  return Math.max(16, Math.round(v));
}

/** ช่องที่ห้ามโชว์สิ่งที่พิมพ์ (รหัสผ่าน · คีย์ AI) — คนข้าง ๆ อ่านจากจอได้ */
export function isSecretField(target) {
  if (!target || typeof target !== 'object') return false;
  const type = String(target.type || '').toLowerCase();
  if (type === 'password') return true;
  const ds = target.dataset || {};
  return ds.secret === '1' || ds.secret === 'true';
}

/**
 * กล่องของแถบสีบรรทัดเคอร์เซอร์ ในพิกัดของ "กล่องที่เลื่อน" (แผ่นทับเป็นลูกของกล่องนั้น)
 * @param {{caret:{top:number,bottom:number}, paper:{left:number,width:number},
 *          host:{left:number,top:number}, scrollLeft?:number, scrollTop?:number, pad?:number}} g
 *   ทุก rect เป็นพิกัดหน้าต่าง (getBoundingClientRect / coordsAtPos)
 * @returns {{top:number,left:number,width:number,height:number}|null} `null` = ไม่มีอะไรให้วาด
 */
export function bandBox(g) {
  if (!g || !g.caret || !g.paper || !g.host) return null;
  const top = +g.caret.top, bottom = +g.caret.bottom;
  const w = +g.paper.width;
  if (![top, bottom, w, +g.paper.left, +g.host.left, +g.host.top].every(Number.isFinite)) return null;
  const h = bottom - top;
  if (h < 2 || w < 2) return null;                       // ตัวแก้ไขถูกซ่อนอยู่ (มุมมองหน้ากระดาษ ฯลฯ)
  const pad = Number.isFinite(+g.pad) ? Math.max(0, +g.pad) : Math.max(1, Math.round(h * 0.08));
  return {
    top: Math.round(top - g.host.top + (+g.scrollTop || 0) - pad),
    left: Math.round(g.paper.left - g.host.left + (+g.scrollLeft || 0)),
    width: Math.round(w),
    height: Math.round(h + pad * 2),
  };
}

/** สีแบบที่ getComputedStyle คืน ('rgb(26, 26, 26)' · 'rgba(…)') หรือ #hex → '#rrggbb' · อ่านไม่ออก = '' */
export function cssColorHex(v) {
  const s = String(v || '').trim();
  const m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i.exec(s);
  if (!m) return normHex(s);
  return '#' + [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Math.round(+x))).toString(16).padStart(2, '0')).join('');
}

/**
 * วิธีผสมสีของแถบกับพื้นหลังของตัวแก้ไข — ตัดสินจาก **สีตัวหนังสือที่จอใช้อยู่จริง** (computed color ของตัวแก้ไข)
 *   ตัวหนังสือเข้ม (พื้นสว่าง · มุมมองจัดหน้า/กระดาษขาว) = multiply — เหมือนปากกาเน้นข้อความ ตัวหนังสือยังดำสนิท
 *   ตัวหนังสือสว่าง (พื้นมืด · มุมมองปกติของธีมมืด)      = screen   — multiply บนพื้นมืดมองไม่เห็นเลย
 * ไม่ดูตัวแปร --paper: มุมมองปกติไม่วาดกระดาษ (พื้นเป็นของธีม) และแผ่นกระดาษของมุมมองจัดหน้าไม่ใช่บรรพบุรุษของข้อความ
 * — สีตัวหนังสือเป็นสิ่งเดียวที่ตรงข้ามกับพื้นจริงเสมอทุกมุมมอง
 */
export function bandBlend(inkColor) {
  const hex = cssColorHex(inkColor);
  if (!hex) return 'multiply';
  return luminance(hex) > 0.4 ? 'screen' : 'multiply';
}
