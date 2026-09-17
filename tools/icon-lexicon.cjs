// icon-lexicon.cjs — [alpha.150r2] ตัวอักษรไอคอน → **ชื่อในทะเบียน** (`icons/`)
//
// ใช้โดย `tools/icon-extract.cjs` ตอนยกไอคอนที่ฮาร์ดโค้ดในซอร์สออกมาไว้ใน `icons/glyphs.csv`
// (ทางเดียวกับที่ `tools/th-en-lexicon.cjs` ใช้ตั้งชื่อคีย์ภาษาตอนยกข้อความออกจากโค้ด)
//
// ═══ กติกาการตั้งชื่อ ═══
// · ชื่อบอก **สิ่งที่มันเป็น** ไม่ใช่สิ่งที่มันถูกใช้ทำ (`folder` ไม่ใช่ `open-chapter`)
//   เพราะไอคอนหนึ่งตัวถูกใช้หลายที่ — ชื่อผูกกับงานเมื่อไหร่ก็ย้ายไปใช้ที่อื่นไม่ได้
// · ตัวที่มี `U+FE0F` ต่อท้าย (ขอให้แสดงเป็นอีโมจิสี) ได้ชื่อลงท้าย `-e` แยกจากตัวไม่มี
//   — ถ้ายุบรวมกัน หน้าตาบนจอจะเปลี่ยนจากที่ผู้ใช้เห็นอยู่ทันที

/** ตัวอักษร (หรือชุดตัวอักษร) → ชื่อไอคอน */
const ICON_NAMES = {
  '❌': 'fail',                '→': 'arrow-right',        '⚠': 'warning',
  '⚠️': 'warning-e',           '📖': 'book-open',         '🎬': 'film',
  '🔖': 'bookmark',            '▼': 'triangle-down',      '📍': 'map-pin',
  '▲': 'triangle-up',          '🔗': 'link',              '💾': 'save',
  '🔍': 'search',              '⚙': 'cog',                '⚙️': 'cog-e',
  '📚': 'books',               '🗺': 'map',               '★': 'star-filled',
  '✎': 'pencil-thin',          '✏': 'pencil',            '✏️': 'pencil-e',
  '⭐': 'star',                '↻': 'refresh-thin',            '🧩': 'puzzle',
  '🧠': 'brain',               '➕': 'plus-thick',         '➖': 'minus-thick',
  '📊': 'chart',               '🤖': 'bot',               '⛔': 'forbidden',
  '▾': 'caret-down',           '⇋': 'compare',            '🌐': 'globe',
  '📷': 'camera',              '👁': 'eye',               '⇄': 'swap-lr',
  '🙋': 'raise-hand',          '🔴': 'dot-red',           '🟡': 'dot-yellow',
  '⚪': 'dot-white',           '⇦': 'arrow-left-wide',    '🕘': 'clock-9',
  '🕓': 'clock-4',             '🔎': 'search-plus',       '➜': 'arrow-right-thick',
  '↳': 'arrow-branch',         '↩💬': 'reply-comment',     '⬇': 'arrow-down-thick',
  '📏': 'ruler-straight',               '┅': 'line-dash',          '○': 'circle-open',
  '⬤': 'circle-solid',        '▸': 'triangle-right-sm',  '❝': 'quote-open',
  '❓': 'question',            '♀': 'gender-female',      '♂': 'gender-male',
  '⚧': 'gender-other',         '⚔️': 'sword-e',           '⏱️': 'timer-e',
  '🕳️': 'hole-e',              '✍️': 'write-e',           '▶️': 'play-e',
};

/**
 * ตัวอักษรที่ **ไม่ใช่ไอคอน** — ห้ามยกเข้าทะเบียน (พร้อมเหตุผล)
 * เป็นแหล่งความจริงเดียวร่วมกับเทสที่กวาดหาไอคอนฮาร์ดโค้ด
 */
const NOT_ICON = {
  '⌘': 'สัญลักษณ์ปุ่ม Command ของ macOS — เป็น "ชื่อปุ่ม" ในคีย์ลัด ไม่ใช่ไอคอน',
  '⌥': 'สัญลักษณ์ปุ่ม Option ของ macOS — เหตุผลเดียวกับ ⌘',
  '⇧': 'สัญลักษณ์ปุ่ม Shift — เหตุผลเดียวกับ ⌘',
  '└': 'เส้นต้นไม้ในข้อความที่ส่งออก (โครงเรื่องแบบผัง) — เป็นโครงเอกสาร ไม่ใช่ไอคอน',
  '├': 'เส้นต้นไม้ในข้อความที่ส่งออก — เหตุผลเดียวกับ └',
  '│': 'เส้นต้นไม้ในข้อความที่ส่งออก — เหตุผลเดียวกับ └',
  '─': 'เส้นแนวนอนของต้นไม้ในข้อความที่ส่งออก — เหตุผลเดียวกับ └',
};

/** ชื่อไอคอนของตัวอักษรนี้ ('' = ไม่รู้จัก · null = จงใจไม่ใช่ไอคอน) */
function iconNameOf(run) {
  if (Object.prototype.hasOwnProperty.call(NOT_ICON, run)) return null;
  if ([...run].every((c) => Object.prototype.hasOwnProperty.call(NOT_ICON, c))) return null;
  return ICON_NAMES[run] || '';
}

module.exports = { ICON_NAMES, NOT_ICON, iconNameOf };
