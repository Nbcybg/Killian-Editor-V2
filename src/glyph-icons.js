// glyph-icons.js — [alpha.157r] อีโมจิสี → ไอคอนเส้นขาวดำชุดเดียวกันทั้งแอป (ส่วนข้อมูล · บริสุทธิ์)
//
// ผู้ใช้ (ส่งภาพแผงผังแตกสาย/คลังรูป): *"ยังไม่ polish เยอะ ยังไม่เป็นเนื้อเดียวกัน"*
// ต้นตอที่เห็นชัดที่สุด: ไอคอนในแผงมาจาก `gi()` ซึ่งคืน **อีโมจิสี** (💾 🔄 📤 🌳 📖) วางปนกับ
// ไอคอนเส้น SVG ของแถบเครื่องมือ → แต่ละแผงมีโทนสีของตัวเอง · ขนาด/น้ำหนักเส้นไม่เท่ากัน
//
// `gi()` ถูกใช้ ~220 จุดผ่าน `textContent` (ใส่ SVG ตรง ๆ ไม่ได้) → แก้ที่ "ตอนวาด" แทน:
// glyph-upgrade.js เดินหาอักขระในตารางนี้ แล้ววางไอคอนเส้นทับ (อักขระเดิมยังอยู่แบบซ่อน = textContent ไม่เปลี่ยน)
//
// ไอคอนทุกตัว: viewBox 24 · เส้น 2 · หัวมน · สีตามตัวอักษร (currentColor) — เขียนเองทั้งชุด
// `tint` = สีความหมาย (เตือน/ผิดพลาด/สำเร็จ) ที่ต้องคงไว้แม้เป็นขาวดำ

const P = (d) => `<path d="${d}"/>`;
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const R = (x, y, w, h, rx = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

const I = {
  file: P('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z') + P('M14 3v5h5'),
  note: P('M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z') + P('M13.5 6.5l4 4'),
  book: P('M3 5.5C5.5 4 9 4 12 6c3-2 6.5-2 9-.5V19c-2.5-1.5-6-1.5-9 .5-3-2-6.5-2-9-.5z') + P('M12 6v13.5'),
  books: P('M4 19V6a2 2 0 0 1 2-2h5v15') + P('M4 19a2 2 0 0 0 2 2h5v-2') + P('M13 4h5a2 2 0 0 1 2 2v13h-7zM13 19v2h5a2 2 0 0 0 2-2') + P('M7 8h2M16 8h2'),
  film: R(3, 4, 18, 16) + P('M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4'),
  clapper: P('M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z') + P('M4 10l-.6-3.6 15.8-2.7.6 3.6zM8 5.6l2 3.7M13 4.8l2 3.7'),
  star: P('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'),
  trash: P('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'),
  pin: P('M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z') + C(12, 10, 2.2),
  pushpin: P('M9 3h6l-1 6 3 3H7l3-3zM12 12v9'),
  clipboard: R(5, 4, 14, 17) + R(9, 2.5, 6, 3, 1) + P('M9 11h6M9 15h4'),
  lock: R(5, 11, 14, 10) + P('M8 11V7a4 4 0 0 1 8 0v4'),
  unlock: R(5, 11, 14, 10) + P('M8 11V7a4 4 0 0 1 7.6-1.7'),
  bookmark: P('M6 3h12v18l-6-4.5L6 21z'),
  target: C(12, 12, 9) + C(12, 12, 5) + C(12, 12, 1.2),
  image: R(3, 4, 18, 16) + C(9, 9.5, 1.8) + P('M21 16l-5-5L6 20'),
  clip: P('M20 11.5l-8 8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8'),
  chat: P('M4 5h16v11H9l-5 4z'),
  refresh: P('M20 11a8 8 0 0 0-14.3-4.3L4 9M4 4v5h5M4 13a8 8 0 0 0 14.3 4.3L20 15M20 20v-5h-5'),
  repeat: P('M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4'),
  check: P('M4 12.5l5 5L20 6.5'),
  checkCircle: C(12, 12, 9) + P('M8 12.5l3 3 5-6'),
  checkbox: R(4, 4, 16, 16, 3) + P('M8 12l3 3 5-6'),
  box: R(4, 4, 16, 16, 3),
  x: P('M6 6l12 12M18 6L6 18'),
  xCircle: C(12, 12, 9) + P('M9 9l6 6M15 9l-6 6'),
  warn: P('M12 3l10 18H2z') + P('M12 10v4.5M12 17.6v.1'),
  link: P('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1') + P('M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'),
  user: C(12, 8, 4) + P('M4 21a8 8 0 0 1 16 0'),
  users: C(9, 8, 3.5) + P('M2.5 20a6.5 6.5 0 0 1 13 0') + P('M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6.5 6.5 0 0 1 3.5 6'),
  map: P('M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z') + P('M9 4v14M15 6v14'),
  search: C(11, 11, 7) + P('M20 20l-4-4'),
  searchPlus: C(11, 11, 7) + P('M20 20l-4-4M11 8v6M8 11h6'),
  sparkles: P('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z') + P('M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z'),
  save: P('M5 3h11l4 4v14H4V4a1 1 0 0 1 1-1z') + P('M8 3v6h8V3M8 21v-7h8v7'),
  pencil: P('M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z'),
  compass: C(12, 12, 9) + P('M15.5 8.5l-2 5-5 2 2-5z'),
  menu: P('M4 6h16M4 12h16M4 18h16'),
  branch: C(6, 5, 2) + C(6, 19, 2) + C(18, 7, 2) + P('M6 7v10M18 9c0 5-12 3-12 8'),
  tree: C(6, 5, 2) + C(18, 5, 2) + C(12, 19, 2) + P('M6 7c0 5 6 5 6 10M18 7c0 5-6 5-6 10'),
  gear: C(12, 12, 3) + P('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1'),
  puzzle: P('M5 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v4H5v-4a2 2 0 1 0 0-4z'),
  tag: P('M3 12V4h8l10 10-8 8z') + C(7.5, 8.5, 1.3),
  plus: P('M12 5v14M5 12h14'),
  minus: P('M5 12h14'),
  palette: P('M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-1.4-1.2-1.7-1.2-3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z') + C(7.5, 11, 1) + C(10, 7, 1) + C(15, 7.5, 1),
  folderOpen: P('M3 7V5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v2') + P('M3 19l2.5-9h17L20 19z'),
  folder: P('M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'),
  download: P('M12 4v11M7 10l5 5 5-5M4 20h16'),
  upload: P('M12 16V5M7 10l5-5 5 5M4 20h16'),
  monitor: R(3, 4, 18, 12) + P('M8 20h8M12 16v4'),
  brain: P('M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1z') + P('M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1'),
  cog: C(12, 12, 3.2) + P('M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.3-2.4a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.3l2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 3h4l.3 2.4a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z'),
  heartBroken: P('M12 20S3 14.5 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 14.5 12 20 12 20z') + P('M12 6l-2 5 3 2-2 4'),
  heart: P('M12 20S3 14.5 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 14.5 12 20 12 20z'),
  ban: C(12, 12, 9) + P('M5.6 5.6l12.8 12.8'),
  thought: P('M6 14a4 4 0 0 1 1-7.9 5 5 0 0 1 9.5-.5A4 4 0 0 1 18 14z') + C(8, 18, 1.5) + C(5, 21, 1),
  door: P('M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18') + C(14.5, 12, .8),
  package: P('M12 3l8 4.5v9L12 21l-8-4.5v-9z') + P('M4 7.5l8 4.5 8-4.5M12 12v9'),
  globe: C(12, 12, 9) + P('M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z'),
  eye: P('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z') + C(12, 12, 3),
  bulb: P('M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z'),
  bot: R(4, 8, 16, 12, 3) + P('M12 4v4M9 13v2M15 13v2') + C(12, 3.5, 1),
  chart: P('M4 20V4M4 20h16') + R(7, 11, 3, 6, .5) + R(12, 7, 3, 10, .5) + R(17, 13, 3, 4, .5),
  play: P('M7 4.5v15l12-7.5z'),
  camera: P('M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z') + C(12, 13.5, 3.5),
  ruler: P('M3 17L17 3l4 4L7 21z') + P('M7 13l2 2M10 10l2 2M13 7l2 2'),
  hourglass: P('M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9'),
  flag: P('M5 21V4M5 4h13l-3 4.5 3 4.5H5'),
  bell: P('M6 16V11a6 6 0 0 1 12 0v5l2 2H4z') + P('M10 21h4'),
  question: C(12, 12, 9) + P('M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5M12 17v.1'),
  swords: P('M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M7 17l-3 3M17 17l3 3M9 14l-4 4M15 14l4 4'),
  broom: P('M18 3l-6.5 8.5') + P('M11.5 11.5l3 2.5L10 21c-3-1-5.5-3.5-7-6.5z'),
  rewind: P('M11 6L4 12l7 6zM20 6l-7 6 7 6z'),
  forward: P('M13 6l7 6-7 6zM4 6l7 6-7 6z'),
  skipPrev: P('M19 5L9 12l10 7zM5 5v14'),
  skipNext: P('M5 5l10 7-10 7zM19 5v14'),
  recycle: P('M7 19H4l3.5-6M13.5 5l1.5 2.6M17 19h3l-1.6-2.8M9 7l3-5 3 5M8 19l-1.5-3M16.5 13L20 19') ,
  key: C(8, 15, 4) + P('M11 12l9-9M17 6l3 3M14 9l2 2'),
  dice: R(4, 4, 16, 16, 3) + C(8.5, 8.5, .9) + C(15.5, 15.5, .9) + C(12, 12, .9),
  mask: P('M4 5c3 1.5 13 1.5 16 0v7a8 8 0 0 1-16 0z') + P('M8.5 10.5h2M13.5 10.5h2M9 15c1.8 1.3 4.2 1.3 6 0'),
  font: P('M5 20L11 4h2l6 16M7.5 14h9'),
  smile: C(12, 12, 9) + P('M8.5 14.5c2 2 5 2 7 0M9 9.5v.1M15 9.5v.1'),
  party: P('M4 20l4-12 8 8zM14 4v2M19 5l-1.5 1.5M20 10h-2M11 7l1 1'),
  crystal: C(12, 10, 6) + P('M7 20h10l-1.5-3.5h-7z'),
  command: P('M9 6V18M15 6V18M6 9h12M6 15h12'),
  alt: P('M4 6h5l6 12h5M14 6h6'),
  dotRed: C(12, 12, 6),
  hand: P('M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 5-3 8-6.5 8S5 18.5 4 15l-1-4a1.5 1.5 0 0 1 2.8-1L8 13'),
};

/**
 * อักขระ → { icon, tint? }
 * ★ ห้ามใส่อักขระที่เป็น "ข้อความ" ของผู้ใช้/ของโค้ด (★ ☆ • → ← ▸ ▼ ⌘ …) — แทนแล้วความหมายเพี้ยน
 */
export const GLYPH_ICON = {
  '📄': { icon: 'file' }, '📝': { icon: 'note' }, '✎': { icon: 'pencil' }, '✏️': { icon: 'pencil' }, '✏': { icon: 'pencil' },
  '✍️': { icon: 'pencil' }, '📖': { icon: 'book' }, '📚': { icon: 'books' }, '🎬': { icon: 'clapper' }, '📕': { icon: 'book' },
  '⭐': { icon: 'star', tint: 'gold' }, '🗑': { icon: 'trash' }, '🗑️': { icon: 'trash' }, '📍': { icon: 'pin' }, '📌': { icon: 'pushpin' },
  '📋': { icon: 'clipboard' }, '🔒': { icon: 'lock' }, '🔓': { icon: 'unlock' }, '🔖': { icon: 'bookmark' }, '🎯': { icon: 'target' },
  '🖼': { icon: 'image' }, '🖼️': { icon: 'image' }, '📎': { icon: 'clip' }, '💬': { icon: 'chat' }, '🔄': { icon: 'refresh' },
  '🔁': { icon: 'repeat' }, '♻': { icon: 'recycle' }, '♻️': { icon: 'recycle' }, '✅': { icon: 'checkCircle', tint: 'ok' },
  '✔': { icon: 'check', tint: 'ok' }, '☑': { icon: 'checkbox' }, '☐': { icon: 'box' }, '⬜': { icon: 'box' },
  '❌': { icon: 'xCircle', tint: 'bad' }, '✕': { icon: 'x' }, '⚠': { icon: 'warn', tint: 'warn' }, '⚠️': { icon: 'warn', tint: 'warn' },
  '⛔': { icon: 'ban', tint: 'bad' }, '🚫': { icon: 'ban', tint: 'bad' }, '🔗': { icon: 'link' }, '👤': { icon: 'user' }, '👥': { icon: 'users' },
  '🗺': { icon: 'map' }, '🗺️': { icon: 'map' }, '🔍': { icon: 'search' }, '🔎': { icon: 'searchPlus' }, '✨': { icon: 'sparkles', tint: 'gold' },
  '💾': { icon: 'save' }, '🧭': { icon: 'compass' }, '☰': { icon: 'menu' }, '🌿': { icon: 'branch' }, '🌱': { icon: 'branch' }, '🌳': { icon: 'tree' },
  '⚙': { icon: 'cog' }, '⚙️': { icon: 'cog' }, '🧩': { icon: 'puzzle' }, '🏷': { icon: 'tag' }, '🏷️': { icon: 'tag' },
  '➕': { icon: 'plus' }, '✚': { icon: 'plus' }, '➖': { icon: 'minus' }, '🎨': { icon: 'palette' }, '📂': { icon: 'folderOpen' }, '📁': { icon: 'folder' },
  '📥': { icon: 'download' }, '📤': { icon: 'upload' }, '⬇': { icon: 'download' }, '🖥': { icon: 'monitor' }, '🖥️': { icon: 'monitor' },
  '🧠': { icon: 'brain' }, '💭': { icon: 'thought' }, '💔': { icon: 'heartBroken' }, '💞': { icon: 'heart' }, '🚪': { icon: 'door' },
  '📦': { icon: 'package' }, '🌐': { icon: 'globe' }, '👁': { icon: 'eye' }, '👁️': { icon: 'eye' }, '💡': { icon: 'bulb', tint: 'gold' },
  '🤖': { icon: 'bot' }, '📊': { icon: 'chart' }, '▶️': { icon: 'play' }, '📷': { icon: 'camera' }, '📏': { icon: 'ruler' }, '📐': { icon: 'ruler' },
  '⏳': { icon: 'hourglass' }, '⏱️': { icon: 'hourglass' }, '🏁': { icon: 'flag' }, '❓': { icon: 'question' }, '❔': { icon: 'question' },
  '⚔': { icon: 'swords' }, '⚔️': { icon: 'swords' }, '🧹': { icon: 'broom' }, '⏪': { icon: 'rewind' }, '⏩': { icon: 'forward' },
  '⏮': { icon: 'skipPrev' }, '⏭': { icon: 'skipNext' }, '🔑': { icon: 'key' }, '🎲': { icon: 'dice' }, '🎭': { icon: 'mask' }, '🎎': { icon: 'mask' },
  '🔤': { icon: 'font' }, '🔠': { icon: 'font' }, '🙂': { icon: 'smile' }, '😄': { icon: 'smile' }, '🎉': { icon: 'party' }, '🔮': { icon: 'crystal' },
  '🔴': { icon: 'dotRed', tint: 'bad' }, '👆': { icon: 'hand' }, '🙋': { icon: 'hand' },
};

/** ชุดอักขระเรียงยาวก่อนสั้น (อีโมจิที่มี U+FE0F ต้องจับก่อนตัวที่ไม่มี) */
export const GLYPH_KEYS = Object.keys(GLYPH_ICON).sort((a, b) => b.length - a.length);
export const GLYPH_RE = new RegExp('(' + GLYPH_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'u');

/** SVG ของอักขระหนึ่งตัว ('' = ไม่มีในตาราง) */
export function glyphSvg(ch) {
  const hit = GLYPH_ICON[ch];
  if (!hit || !I[hit.icon]) return '';
  const fill = hit.icon === 'dotRed' ? 'currentColor' : 'none';
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[hit.icon]}</svg>`;
}

/** แยกข้อความเป็นชิ้น [{text}|{glyph}] — บริสุทธิ์ (unit test) */
export function splitGlyphs(text) {
  const s = String(text || '');
  if (!GLYPH_RE.test(s)) return null;
  const out = [];
  let rest = s;
  const re = new RegExp(GLYPH_RE.source, 'u');
  for (let m = re.exec(rest); m; m = re.exec(rest)) {
    if (m.index) out.push({ text: rest.slice(0, m.index) });
    out.push({ glyph: m[0], tint: GLYPH_ICON[m[0]].tint || '' });
    rest = rest.slice(m.index + m[0].length);
    // U+FE0F ที่ค้างหลังอักขระที่ไม่มีรูปมีตัวแปร — กลืนทิ้งไปกับไอคอน
    if (rest[0] === '\uFE0F') { out[out.length - 1].glyph += '\uFE0F'; rest = rest.slice(1); }
  }
  if (rest) out.push({ text: rest });
  return out;
}
export const ICON_NAMES = Object.keys(I);
