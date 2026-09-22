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
  // [alpha.162 · W6 ข้อ 1] ชุดที่หลุดตาข่ายเดิม (ช่วงตัวอักษรที่ regex ไม่ครอบ)
  '×': 'times',                '−': 'minus',              '⤢': 'maximize',
  '⟲': 'rotate-ccw',           '⊡': 'dock-window',        '§': 'section-mark',
  '∅': 'empty-set',            '⊞': 'split-grid',         '⠿': 'grip-dots',
  '≠': 'not-equal',            '⦿': 'node-size',          '⟳': 'sync',
  '＋': 'plus-full',           '⧉': 'duplicate',          '⋯': 'more',
  '⤓': 'download',             '⤷': 'subdirectory-right', '¶': 'pilcrow',
  '⤾': 'reset-view',
};

/**
 * [alpha.162 · W6 ข้อ 1] ★ ช่วงอักขระที่นับเป็น "ไอคอน" — **แหล่งเดียว** ของเทส ui-audit และ icon-extract
 * (เดิมเขียน regex สองชุดแยกกัน แล้วชุดของเทสไม่ครอบ × ⧉ ¶ ⋯ − ＋ ⤓ ⤢ ⤷ ⟲ ⊡ § ฯลฯ →
 *  ไอคอนฮาร์ดโค้ดหลุดด่าน 70 จุด) · ช่วงที่เพิ่ม: U+00A1–BF · U+00D7 · U+2200–22FF · U+2800–28FF (จุดอักษรเบรลล์ ⠿)
 *  · U+27C0–2AFF · U+2913/2922/2937 · U+FF0B
 * ไม่นับ: ลูกศร U+2190–21FF และเส้นตีตาราง U+2500–257F (ใช้เป็นวรรคตอนในประโยค · ดูเหตุผลที่เทส)
 */
const ICON_RANGE_SRC = '\\u{1F300}-\\u{1FAFF}\\u{1F000}-\\u{1F0FF}\\u{1F100}-\\u{1F2FF}\\u{2460}-\\u{24FF}'
  + '\\u{25A0}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{2300}-\\u{23FF}\\u{FE0F}'
  + '\\u{00A1}-\\u{00BF}\\u{00D7}\\u{2200}-\\u{22FF}\\u{2800}-\\u{28FF}\\u{27C0}-\\u{2AFF}'
  + '\\u{2913}\\u{2922}\\u{2937}\\u{FF0B}';

/**
 * สตริงที่เป็น "ตารางอักขระ" (จานแทรกอักขระพิเศษ: À Á Â … เรียงรหัสติดกันยาว ๆ) — เป็นข้อมูลให้ผู้ใช้เลือกแทรก
 * ลงเอกสาร ไม่ใช่ไอคอนที่วาดบนจอ · นิยาม: ยาว ≥ 12 ตัว ไม่มีช่องว่าง และรหัสเรียงเพิ่มทีละหนึ่งเกือบทั้งหมด
 */
function isCharTable(str) {
  const cs = [...String(str || '')];
  if (cs.length < 12 || /\s/.test(str)) return false;
  let run = 0;
  for (let i = 1; i < cs.length; i++) if (cs[i].codePointAt(0) === cs[i - 1].codePointAt(0) + 1) run++;
  return run >= (cs.length - 1) * 0.9;
}

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
  // [alpha.162 · W6 ข้อ 1] ช่วงที่ขยายเข้ามา (U+00A1–BF) มีวรรคตอน/หน่วยที่ใช้ในประโยคด้วย
  '·': 'จุดกลางคั่นข้อความในประโยค (" · ") — เป็นวรรคตอนของทั้งโปรแกรม ไม่ใช่ไอคอน',
  '°': 'หน่วยองศาในค่าที่แสดง (มุมกล้อง 3 มิติ "30°") — เป็นหน่วย ไม่ใช่ไอคอน',
  '«': 'อัญประกาศแบบฝรั่งเศส — ใช้เป็น "ข้อมูลที่ต้องจับคู่" ตอนแยกบทพูดในเนื้อหา (speech-split · dialogue-core) ไม่ใช่ไอคอน',
  '»': 'อัญประกาศปิดแบบฝรั่งเศส — เหตุผลเดียวกับ «',
};

/** ชื่อไอคอนของตัวอักษรนี้ ('' = ไม่รู้จัก · null = จงใจไม่ใช่ไอคอน) */
function iconNameOf(run) {
  if (Object.prototype.hasOwnProperty.call(NOT_ICON, run)) return null;
  if ([...run].every((c) => Object.prototype.hasOwnProperty.call(NOT_ICON, c))) return null;
  return ICON_NAMES[run] || '';
}

module.exports = { ICON_NAMES, NOT_ICON, iconNameOf, ICON_RANGE_SRC, isCharTable };
