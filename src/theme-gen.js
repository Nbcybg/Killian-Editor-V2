// theme-gen.js — [alpha.159] สร้างตัวแปรสีของธีมจาก "สีหลักไม่กี่สี" (บริสุทธิ์ 100% · มี unit test)
//
// ผู้ใช้: *"ทำ template สำหรับ dev ในการเพิ่ม theme แก้สี"*
//
// ธีมหนึ่งธีมต้องกำหนดตัวแปรราว 35 ตัว (ดู THEME_VARS) — เขียนมือทุกตัวทุกธีมแล้วพลาดง่ายมาก
// (ลืมตัวเดียว = พื้นผิวนั้นค้างสีของ base.css กลางธีมใหม่ · บทเรียน [81-5])
// ที่นี่จึงรับแค่ **สีหลัก 5 สี** (`bg` `fg` `accent` `accentHi` `link`) แล้วคำนวณที่เหลือให้ครบ
// ตามโหมด (`dark`/`light`) · สีไหนอยากคุมเองก็ใส่ทับใน `vars` ได้ทีละตัว
//
// สีที่ถูกใช้เป็น "ตัวหนังสือ" (fg · dim · accent · accent-hi · link) ถูกดันคอนทราสต์กับพื้นให้ผ่าน
// เกณฑ์ขั้นต่ำเสมอ — จานสีจาก colorhunt หลายชุดสวยแต่อ่านไม่ออกถ้าเอาไปวางตรง ๆ
//
// ผู้ใช้งานไฟล์นี้: tools/theme-build.cjs (เขียน renderer/themes/<id>.css) + test/theme.test.cjs

import { normHex, contrast, inkOn } from './color-util.js';

/** ตัวแปรที่ทุกธีมต้องกำหนดครบ (ลำดับ = ลำดับที่เขียนลงไฟล์ css) พร้อมคำอธิบายสำหรับเทมเพลต */
export const THEME_VARS = [
  ['--bg', 'พื้นหลักของพื้นที่ทำงาน'],
  ['--side', 'พื้นแผงข้าง (Explorer ฯลฯ)'],
  ['--bar', 'พื้นแถบเครื่องมือ / แถบสถานะ'],
  ['--border', 'เส้นขอบทั่วไป'],
  ['--fg', 'ตัวหนังสือหลัก'],
  ['--bright', 'ตัวหนังสือที่เด่นที่สุด (หัวข้อ)'],
  ['--dim', 'ตัวหนังสือรอง / คำอธิบาย'],
  ['--accent', 'สีเน้นหลัก (ปุ่มยืนยัน · แท็บที่เลือก)'],
  ['--accent-hi', 'สีเน้นรอง (ไฮไลต์ · ตัวคั่นหน้า)'],
  ['--link', 'ลิงก์ / ชื่อที่คลิกได้'],
  ['--sel', 'พื้นข้อความที่ถูกเลือก'],
  ['--orange', 'สีเตือนอ่อน / ป้ายสถานะ'],
  ['--curline', 'พื้นบรรทัดที่เคอร์เซอร์อยู่'],
  ['--hover', 'พื้นตอนเอาเมาส์ชี้ปุ่ม'],
  ['--hover-soft', 'พื้นตอนชี้แถวในรายการ / แท็บที่ยังไม่ถูกเลือก'],
  ['--titlebar', 'แถบชื่อหน้าต่าง (frameless)'],
  ['--sunken', 'พื้นจม — บล็อกโค้ด / กล่องผลลัพธ์ / ทูลทิป'],
  ['--chip', 'พื้นป้ายชื่อ (mention / pill)'],
  ['--danger-soft', 'พื้นปุ่มอันตรายตอนชี้'],
  ['--canvas', 'พื้นกระดานวาด (Planner)'],
  ['--void', 'พื้นหลังใต้การ์ดแผง'],
  ['--paper-surround', 'พื้นรอบกระดาษ (ตัวกระดาษเองห้ามแตะ)'],
  ['--tab-bar', 'รางแท็บ'],
  ['--tab-bg', 'แท็บที่เลือก'],
  ['--tab-border', 'ขอบแท็บ'],
  ['--tab-fg', 'ป้ายแท็บที่ไม่ได้เลือก'],
  ['--tab-fg-on', 'ป้ายแท็บที่เลือก'],
  ['--tab-hover', 'แท็บตอนชี้'],
  ['--panel-head', 'หัวแผง'],
  ['--input-bg', 'ช่องกรอก'],
  ['--muted-strong', 'ข้อความรองที่ต้องอ่านออกบนพื้นเข้ม'],
  ['--find-hit', 'ไฮไลต์ผลค้นหา'],
  ['--on-accent', 'ตัวหนังสือบนพื้น --accent'],
  ['--on-accent-hi', 'ตัวหนังสือบนพื้น --accent-hi'],
];
export const THEME_VAR_NAMES = THEME_VARS.map(([n]) => n);

/** สีหลักที่สเปกต้องมี */
export const THEME_BASE_KEYS = ['bg', 'fg', 'accent', 'accentHi', 'link'];

/** คอนทราสต์ขั้นต่ำของสีที่ถูกใช้เป็นตัวหนังสือบน --bg */
export const MIN_CONTRAST = { '--fg': 7, '--dim': 3.5, '--accent': 3, '--accent-hi': 3, '--link': 3.5,
                              '--on-accent': 3, '--on-accent-hi': 3, '--tab-fg-on': 4.5 };

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** ผสมสี a กับ b — `t` = สัดส่วนของ b (0–1) */
export function mix(a, b, t) {
  const A = rgb(normHex(a) || '#000000'), B = rgb(normHex(b) || '#000000');
  return hex(A.map((v, i) => v + (B[i] - v) * t));
}

/**
 * ดันสี `c` เข้าหาขาว/ดำ (ฝั่งที่ห่างจากพื้น) ทีละนิดจนคอนทราสต์กับ `bg` ถึง `min`
 * สีที่ผ่านอยู่แล้วคืนค่าเดิมเป๊ะ
 */
export function ensureContrast(c, bg, min) {
  const col = normHex(c), base = normHex(bg);
  if (!col || !base) return col;
  if (contrast(col, base) >= min) return col;
  const toward = contrast('#ffffff', base) >= contrast('#000000', base) ? '#ffffff' : '#000000';
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const x = mix(col, toward, t);
    if (contrast(x, base) >= min) return x;
  }
  return toward;
}

/**
 * สเปก → รายการ [ชื่อตัวแปร, ค่า] ครบทุกตัวใน THEME_VARS
 * @param {{mode:'dark'|'light', colors:{bg,fg,accent,accentHi,link, side?,bar?,border?,dim?,sel?}, vars?:object}} spec
 */
export function themeVars(spec) {
  const s = spec || {};
  const dark = s.mode !== 'light';
  const c = s.colors || {};
  const bg = normHex(c.bg) || (dark ? '#202020' : '#fafafa');
  const fg = ensureContrast(normHex(c.fg) || (dark ? '#e8e8e8' : '#222222'), bg, MIN_CONTRAST['--fg']);
  const ink = dark ? '#000000' : fg;          // ทิศที่ "จม" ลงจากพื้น
  const lift = dark ? fg : '#ffffff';         // ทิศที่ "ยก" ขึ้นจากพื้น
  const accent = ensureContrast(normHex(c.accent) || fg, bg, MIN_CONTRAST['--accent']);
  const accentHi = ensureContrast(normHex(c.accentHi) || accent, bg, MIN_CONTRAST['--accent-hi']);
  const link = ensureContrast(normHex(c.link) || accent, bg, MIN_CONTRAST['--link']);
  const dim = ensureContrast(normHex(c.dim) || mix(fg, bg, 0.4), bg, MIN_CONTRAST['--dim']);
  const border = normHex(c.border) || mix(bg, fg, dark ? 0.2 : 0.22);
  const titlebar = dark ? mix(bg, '#000000', 0.3) : mix(bg, fg, 0.1);
  const v = {
    '--bg': bg,
    '--side': normHex(c.side) || (dark ? mix(bg, '#000000', 0.18) : mix(bg, fg, 0.05)),
    '--bar': normHex(c.bar) || (dark ? mix(bg, fg, 0.06) : mix(bg, fg, 0.08)),
    '--border': border,
    '--fg': fg,
    '--bright': dark ? mix(fg, '#ffffff', 0.6) : mix(fg, '#000000', 0.5),
    '--dim': dim,
    '--accent': accent,
    '--accent-hi': accentHi,
    '--link': link,
    '--sel': normHex(c.sel) || mix(bg, dark ? accent : accentHi, dark ? 0.35 : 0.4),
    '--orange': accentHi,
    '--curline': mix(bg, dark ? fg : ink, dark ? 0.04 : 0.035),
    '--hover': mix(bg, fg, 0.13),
    '--hover-soft': mix(bg, fg, 0.06),
    '--titlebar': titlebar,
    '--sunken': dark ? mix(bg, '#000000', 0.18) : mix(bg, fg, 0.03),
    '--chip': mix(bg, accent, dark ? 0.25 : 0.15),
    '--danger-soft': mix(bg, '#d9575e', dark ? 0.35 : 0.25),
    '--canvas': dark ? mix(bg, '#000000', 0.18) : bg,
    '--void': titlebar,
    '--paper-surround': dark ? titlebar : mix(bg, fg, 0.18),
    '--tab-bar': titlebar,
    '--tab-bg': dark ? mix(bg, lift, 0.1) : mix(bg, '#ffffff', 0.75),
    '--tab-border': dark ? mix(bg, fg, 0.22) : border,
    '--tab-fg': dim,
    '--tab-fg-on': dark ? mix(fg, '#ffffff', 0.5) : fg,
    '--tab-hover': mix(bg, fg, 0.06),
    '--panel-head': dark ? mix(bg, '#000000', 0.1) : mix(bg, fg, 0.06),
    '--input-bg': dark ? mix(bg, '#000000', 0.25) : mix(bg, '#ffffff', 0.8),
    '--muted-strong': mix(fg, bg, 0.18),
    '--find-hit': dark ? mix(accentHi, bg, 0.45) : mix(accentHi, '#ffffff', 0.45),
    '--on-accent': inkOn(accent),
    '--on-accent-hi': inkOn(accentHi),
  };
  // สีที่ผู้ใช้คุมเองทีละตัว — ชนะค่าที่คำนวณเสมอ (แต่ต้องเป็นตัวแปรที่รู้จัก)
  for (const [k, val] of Object.entries(s.vars || {})) {
    if (THEME_VAR_NAMES.includes(k) && String(val).trim()) v[k] = String(val).trim();
  }
  return THEME_VAR_NAMES.map((n) => [n, v[n]]);
}

/**
 * ตรวจธีมหนึ่งชุด — คืนรายการปัญหา (ว่าง = ผ่าน)
 * @param {Array<[string,string]>|object} vars
 */
export function checkThemeVars(vars) {
  const m = Array.isArray(vars) ? Object.fromEntries(vars) : (vars || {});
  const out = [];
  for (const n of THEME_VAR_NAMES) if (!String(m[n] || '').trim()) out.push('ขาด ' + n);
  const bg = normHex(m['--bg']);
  if (!bg) return out;
  for (const [n, min] of Object.entries(MIN_CONTRAST)) {
    const on = n === '--on-accent' ? m['--accent'] : n === '--on-accent-hi' ? m['--accent-hi']
      : n === '--tab-fg-on' ? m['--tab-bg'] : bg;
    const a = normHex(m[n]), b = normHex(on);
    if (a && b && contrast(a, b) < min - 1e-9) {
      out.push(n + ' คอนทราสต์ ' + contrast(a, b).toFixed(2) + ' < ' + min);
    }
  }
  return out;
}

/** ข้อความ css ของธีม (ใช้โดย tools/theme-build.cjs) */
export function themeCss(spec) {
  const id = String(spec.id || '');
  const lines = themeVars(spec).map(([n, val]) => '  ' + n + ':' + val + ';');
  const raw = Object.entries(spec.palette || {}).map(([k, val]) => '  --theme-' + k + ':' + normHex(val) + ';');
  return '/* renderer/themes/' + id + '.css — ⚠️ สร้างอัตโนมัติจาก renderer/themes/themes.json ด้วย tools/theme-build.cjs\n' +
    '   ห้ามแก้ไฟล์นี้ตรง ๆ (build ครั้งหน้าจะเขียนทับ) · แก้สีที่ themes.json แล้วรัน `node build.js` */\n' +
    'body.theme-' + id + ' {\n' + (raw.length ? raw.join('\n') + '\n' : '') + lines.join('\n') + '\n}\n';
}
