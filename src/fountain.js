// ระบบ element บทภาพยนตร์
//
// ═══ [alpha.60r3a] มาตรฐานรหัสใหม่ — "นิยาย ↔ บทหนัง สลับไปมาแล้วอ่านรู้เรื่องทั้งสองฝั่ง" ═══
//
// ปัญหาเดิม: รหัสของ v1 (`.หัวฉาก` `$shot` `$sub` `$in`) **ไม่ใช่มาร์กดาวน์**
// พอสลับไฟล์เดียวกันไปโหมดนิยาย รหัสพวกนี้โผล่เป็นข้อความดิบเต็มหน้า อ่านไม่ได้เลย
//
// มาตรฐานใหม่เลือกรหัสที่ "เป็นมาร์กดาวน์อยู่แล้ว" ให้มากที่สุด (อิง kevinmcaleer/scriptmd2pdf):
//
//   หัวฉาก          `### INT. ห้องครัว - กลางวัน`   → ในนิยายเป็น **H3** (ไม่ใช่ข้อความดิบ)
//   ฉากย่อย         `#### มุมห้อง`                  → ในนิยายเป็น **H4**
//   บรรยาย          ข้อความเปล่า ๆ                   → ย่อหน้าปกติ
//   ตัวละคร         `@สมชาย`                        (ส่วนเสริมต่อท้ายได้: `@สมชาย (V.O.)`)
//   วงเล็บ          `((กระซิบ))`                     **ต้องอยู่บรรทัดใต้ตัวละครเท่านั้น**
//   บทพูด           ข้อความหลังบรรทัดตัวละคร จนถึงบรรทัดว่าง
//   ทรานซิชันออก    `>> CUT TO:`                     (ชิดขวา)
//   ทรานซิชันเข้า    `<< FADE IN:`                    (ชิดซ้าย)
//   ช็อต            `! CLOSE ON`
//   ขึ้นหน้าใหม่      `---`                            (เส้นคั่นของมาร์กดาวน์)
//   โน้ต            `/// โน้ตของผู้เขียน`
//
// **อ่านได้ทั้งของเก่าและของใหม่** — `classify()` ยังรู้จักรหัส v1 ทุกตัว (`.` `>` `$shot ` `$sub `
// `$in ` `$intercut ` `$act `) ไฟล์เดิมจึงเปิดได้เหมือนเดิม แต่ `lineFor()` **เขียนด้วยรหัสใหม่เสมอ**
// → บันทึกครั้งเดียวไฟล์ก็ย้ายมาตรฐานเอง
//
// กติกาที่ต้องระวังเพราะรหัสชนกับของเดิม:
//   · `! ` (มีวรรค) = ช็อต · `!ข้อความ` (ไม่มีวรรค) = บรรยายบังคับแบบ v1 · `![alt](src)` = รูป
//   · `((…))` ใต้บรรทัดตัวละคร = วงเล็บ · ที่อื่น = โน้ตแบบ v1 (จึงไม่ทำไฟล์เก่าพัง)
//   · `### ` เดิมคือ "โครง 3" → ตอนนี้เป็นหัวฉาก (ตรงกับที่ผู้ใช้ต้องการ: H3 ในนิยาย = หัวฉากในบท)
//     โครง 3 ย้ายไปใช้ `##### `

export const SP_ELEMS = {
  scene: { th: 'หัวฉาก', prefix: '### ' },
  action: { th: 'บรรยาย', prefix: '' },         // ข้อความเปล่า — ใส่ `!` เฉพาะตอนจำเป็น (ดู lineFor)
  character: { th: 'ตัวละคร', prefix: '@' },
  parenthetical: { th: 'วงเล็บ', prefix: '((' },
  dialogue: { th: 'บทพูด', prefix: '' },
  // ทรานซิชันแยกเข้า/ออก — "เข้า" ชิดซ้าย (`<<`) · "ออก" ชิดขวา (`>>`)
  'transition-in': { th: 'ทรานซิชันเข้า (ซ้าย)', prefix: '<< ' },
  transition: { th: 'ทรานซิชันออก (ขวา)', prefix: '>> ' },
  // "ฉากย่อย" (mini-slug) — วางตัวเหมือนหัวฉากแต่ไม่มีเลขฉาก
  subheader: { th: 'ฉากย่อย', prefix: '#### ' },
  // "สลับฉาก" ไม่มีรหัสเทียบเท่าในมาร์กดาวน์ และใช้ `#### ` ร่วมกับฉากย่อยไม่ได้
  // (อ่านกลับแล้วจะกลายเป็นฉากย่อย = round-trip ไม่ปิดวง) → คงรหัส v1 ไว้
  intercut: { th: 'สลับฉาก', prefix: '$intercut ' },
  shot: { th: 'ช็อต', prefix: '! ' },
  // "ตอน" ใช้ `## ` ไม่ได้ — ชนกับ "โครง 2" (อ่านกลับได้ outline2) → คงรหัส v1 ไว้เหมือน "สลับฉาก"
  'act-break': { th: 'ตอน', prefix: '$act ' },
  'page-break': { th: 'ขึ้นหน้าใหม่', prefix: '---' },    // [alpha.60r3a] บังคับขึ้นหน้าใหม่
  summary: { th: 'สรุป', prefix: '= ' },
  outline1: { th: 'โครง 1', prefix: '# ' },
  outline2: { th: 'โครง 2', prefix: '## ' },
  outline3: { th: 'โครง 3', prefix: '##### ' },
  note: { th: 'โน้ต', prefix: '/// ' },
  image: { th: 'รูปภาพ', prefix: '' },          // ![alt](src) — แสดงเป็นรูปจริงในบทหนัง
  raw: { th: 'อื่น ๆ', prefix: '' },            // element ที่ v2 ยังไม่ทำ UI — คงบรรทัดเดิมเป๊ะ
};
export const TAB_CYCLE = ['action', 'scene', 'subheader', 'character', 'parenthetical', 'dialogue',
  'transition-in', 'transition', 'intercut', 'shot', 'act-break', 'page-break', 'note'];
export const NEXT_ELEM = { scene: 'action', action: 'action', character: 'dialogue',
  parenthetical: 'dialogue', dialogue: 'action', transition: 'scene',
  'transition-in': 'scene', subheader: 'action', intercut: 'action',
  shot: 'action', 'act-break': 'action', 'page-break': 'scene',
  summary: 'action', outline1: 'outline2', outline2: 'outline3', outline3: 'action',
  note: 'action', image: 'action', raw: 'action' };

// บรรทัดที่เป็นรูปทั้งบรรทัด ![alt](src) — ใช้ร่วมกับ md.js
export const IMG_RE = /^!\[([^\]\n]*)\]\(([^)\n]+)\)\s*$/;

/**
 * [alpha.78] **กฎการอ่านบทที่ผู้ใช้ตั้งเอง** — ไม่ใช่ค่าที่โค้ดตัดสินแทน
 *
 * มาตรฐานของงานเขียนบทคือ **Final Draft** ซึ่ง element เป็น "ก้อน" อยู่แล้ว ไม่มีความกำกวม
 * แต่ไฟล์ของเราเป็นข้อความล้วน จึงต้องมีกฎว่า "บรรทัดถัดจากบทพูดคืออะไร"
 *
 *   dialogueContinues = false (ค่าเริ่มต้น · แนว Final Draft)
 *       @สมชาย            → ตัวละคร
 *       "สวัสดีจ้า"        → บทพูด
 *       เขาเดินออกไป       → **บรรยาย** — เขียนเปล่า ๆ ได้เลย ไม่ต้องมี `!` ไม่ต้องเว้นบรรทัด
 *
 *   dialogueContinues = true (แนว fountain)
 *       บรรทัดที่ 3 ข้างบนกลายเป็น "บทพูดบรรทัดถัดไป" → บรรยายต้องเขียน `!` นำหน้า
 *       ใช้เมื่อเขียนบทพูดยาวหลายบรรทัดติดกันเป็นปกติ
 *
 * ตั้งที่ ตั้งค่า → การเขียน · แอปเรียก `setSpRules()` ตอน applySettings()
 * เป็นค่าระดับโปรแกรม (ไม่ใช่ต่อไฟล์) จึงเก็บเป็นตัวแปรโมดูล — โมดูลนี้ยังบริสุทธิ์
 * (ผลลัพธ์ขึ้นกับ input + กฎที่ตั้งไว้เท่านั้น) และเทสตั้งกฎเองได้ตรง ๆ
 */
export const SP_RULES = { dialogueContinues: false };
export function setSpRules(partial) {
  if (partial && typeof partial === 'object') {
    if ('dialogueContinues' in partial) SP_RULES.dialogueContinues = !!partial.dialogueContinues;
  }
  return SP_RULES;
}

export const SCENE_RE = /^\s*(int\.?|ext\.?|est\.?|i\/e|int\.?\/ext\.?|ฉาก)[\s.:]/i;
const TRANS_RE = /(cut to:|dissolve to:|smash cut to:|match cut to:|fade out\.?|fade to black\.?|to:)\s*$/i;
const RAW_PREFIX = /^\$(cast|seq|endact)\b/i;
export const TIMES = ['DAY', 'NIGHT', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER',
  'เช้า', 'กลางวัน', 'บ่าย', 'เย็น', 'กลางคืน', 'รุ่งสาง', 'ต่อเนื่อง'];
export const TRANSITIONS = ['CUT TO:', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:',
  'FADE OUT.', 'FADE TO BLACK.', 'FADE IN:', 'INTERCUT WITH:'];
export const SCENE_PREFIX = ['INT. ', 'EXT. ', 'INT./EXT. ', 'I/E. ', 'EST. ', 'ฉาก ', 'ฉากภายใน ', 'ฉากภายนอก '];

// วงเล็บบอกอารมณ์/การพูด (parenthetical) แบบ Final Draft — ไทย + อังกฤษ
export const PARENTHETICALS = [
  '(beat)', "(cont'd)", '(V.O.)', '(O.S.)', '(O.C.)', '(pre-lap)', '(sotto)', '(to himself)',
  '(to herself)', '(whispering)', '(shouting)', '(laughing)', '(crying)', '(sarcastic)',
  '(หยุดคิด)', '(กระซิบ)', '(ตะโกน)', '(พูดกับตัวเอง)', '(เสียงในใจ)', '(นอกจอ)', '(ต่อ)',
  '(หัวเราะ)', '(ร้องไห้)', '(ประชด)', '(จริงจัง)', '(ลังเล)',
];
// ส่วนขยายท้ายชื่อตัวละคร (Extension) — อยู่บรรทัดเดียวกับชื่อ เว้น "1 วรรค" พอดี
export const CHAR_EXTENSIONS = ["(V.O.)", "(O.S.)", "(O.C.)", "(CONT'D)", '(ต่อ)', '(เสียง)', '(นอกจอ)', '(ในใจ)'];

// ทรานซิชัน "เข้า" (ชิดซ้าย) vs "ออก" (ชิดขวา) — [alpha.57a ข้อ 2]
export const TRANSITIONS_IN = ['FADE IN:', 'FADE UP:', 'SMASH IN:', 'BACK TO SCENE:',
  'FLASHBACK TO:', 'PRELAP:', 'จางเข้า:', 'ตัดเข้า:', 'ย้อนอดีต:'];
export const INTERCUTS = ['INTERCUT WITH:', 'INTERCUT:', 'สลับฉากกับ:', 'สลับฉาก:'];

/**
 * แยกชื่อตัวละครกับส่วนเสริมออกจากกัน — "สมชาย (V.O.)" → { name:'สมชาย', ext:'(V.O.)' }
 * รับได้ทั้งกรณีไม่มีส่วนเสริม และกรณีเว้นวรรคเกิน/ขาด
 */
export function splitCharacter(text) {
  const s = String(text ?? '').trim();
  const m = /^(.*?)\s*(\([^()]*\))\s*$/.exec(s);
  if (!m) return { name: s, ext: '' };
  return { name: m[1].trim(), ext: m[2].trim() };
}

/**
 * ประกอบชื่อตัวละคร + ส่วนเสริมให้เว้น "1 วรรค" เสมอ (ต่อให้ผู้ใช้พิมพ์เว้นเกิน)
 * ext ว่าง = ถอดส่วนเสริมออก
 */
export function withExtension(text, ext) {
  const { name } = splitCharacter(text);
  const e = String(ext ?? '').trim();
  if (!e) return name;
  const wrapped = e.startsWith('(') && e.endsWith(')') ? e : '(' + e.replace(/^\(|\)$/g, '') + ')';
  return name ? name + ' ' + wrapped : wrapped;
}

/**
 * บรรทัดก่อนหน้าเป็นบล็อกที่ "วงเล็บ" ต่อท้ายได้ไหม — วงเล็บอยู่ใต้ตัวละครเท่านั้น
 * @param {string} [prevLine] บรรทัดก่อนหน้าแบบดิบ (ถ้าส่งมา)
 */
// `prevBlank` สำคัญ: วงเล็บอยู่ "ติด" ใต้ชื่อตัวละครเสมอ — มีบรรทัดว่างคั่น = คนละบล็อกกันแล้ว
const CAN_TAKE_PAREN = (prevType, prevBlank) =>
  !prevBlank && (prevType === 'character' || prevType === 'parenthetical');

/**
 * เข้มกว่านั้นสำหรับ `((…))` ซึ่งเป็น **รหัสโน้ตของ v1** ด้วย:
 * ต้องอยู่ใต้ตัวละครที่เขียน `@` ไว้ชัดเจน (หรือใต้วงเล็บด้วยกัน) เท่านั้น
 *
 * เหตุผล: ตัวจับ "ชื่อตัวละครอัตโนมัติ" หลวมมาก (บรรทัดสั้น ≤25 ตัว ≤3 คำ หลังบรรทัดว่าง)
 * บรรยายสั้น ๆ อย่าง "ลมพัดผ่าน" ก็เข้าเกณฑ์ → ถ้าใช้ `prevType` เฉย ๆ
 * โน้ต `((…))` ของไฟล์ v1 ที่บังเอิญตามหลังบรรทัดแบบนั้น จะกลายเป็นวงเล็บทันที
 */
const CAN_TAKE_DOUBLE_PAREN = (prevType, prevLine, prevBlank) => {
  if (prevBlank) return false;                       // มีบรรทัดว่างคั่น = ไม่ได้อยู่ใต้ตัวละครแล้ว
  if (prevType === 'parenthetical') return true;
  if (prevType !== 'character') return false;
  // ไม่ได้ส่งบรรทัดก่อนหน้ามา = ผู้เรียกรู้ชนิดของบล็อกก่อนหน้าอยู่แล้ว (เช่น lineFor) → เชื่อ prevType
  // `parseScript` ส่ง prevLine มาเสมอ จึงเป็นที่เดียวที่ต้องแยก "ตัวละครจริง" ออกจาก "ตัวละครที่เดาเอา"
  if (prevLine === undefined) return true;
  return /^\s*@/.test(String(prevLine));
};

/**
 * @param {boolean} [nextBlank] บรรทัดถัดไปเป็นบรรทัดว่าง (หรือจบไฟล์) หรือไม่
 *   ใช้กับ "ตัวจับชื่อตัวละครอัตโนมัติ" เท่านั้น — ตัวละครต้องมีบทพูดต่อท้ายเสมอ (ดูด้านล่าง)
 *   ไม่ส่งมา = ไม่รู้ → ถือว่าไม่ว่าง (พฤติกรรมเดิม) เพื่อให้ผู้เรียกที่มีแค่บรรทัดเดียวยังทำงานได้
 */
/**
 * @param {boolean} [guessNames] เปิด "ตัวเดาชื่อตัวละครอัตโนมัติ" ไหม
 *   มาตรฐาน fountain ไม่เดาชื่อจากบรรทัดตัวพิมพ์เล็ก/ภาษาไทยเลย — ชื่อที่ไม่ใช่ ALL-CAPS
 *   **ต้องเขียน `@` บังคับ** ตัวเดานี้จึงมีไว้สำหรับ "วางสคริปต์ดิบ/นำเข้า" ที่ไม่มี `@` เท่านั้น
 *   → เอกสารที่ใช้ `@` อยู่แล้ว (ทุกไฟล์ที่ตัวแก้ไขเขียนเอง) ปิดตัวเดาทิ้ง
 *   ไม่งั้นบรรยายไทยสั้น ๆ ต้นย่อหน้าจะถูกเดาเป็นชื่อ แล้ว `lineFor` ต้องเติม `!` กันไว้ตลอด
 *   · ไม่ส่งมา = เปิด (พฤติกรรมเดิม สำหรับผู้เรียกที่ดูทีละบรรทัด)
 */
export function classify(line, prevBlank = true, prevType = 'action', prevLine = undefined,
                         nextBlank = false, guessNames = true) {
  const s = line.trim();
  if (s === '') return ['blank', ''];
  if (IMG_RE.test(s)) return ['image', s];           // ![alt](src) ทั้งบรรทัด = รูป
  // ── [alpha.60r3a] มาตรฐานใหม่ (มาร์กดาวน์) — ตรวจก่อนของเก่าเสมอ ──
  // `---` (สามขีดขึ้นไป) ล้วน ๆ ทั้งบรรทัด = บังคับขึ้นหน้าใหม่
  if (/^-{3,}$/.test(s)) return ['page-break', ''];
  if (s.startsWith('#### ')) return ['subheader', s.slice(5).trim()];
  if (s.startsWith('##### ')) return ['outline3', s.slice(6).trim()];
  if (s.startsWith('### ')) return ['scene', s.slice(4).trim()];       // H3 ในนิยาย = หัวฉากในบท
  if (s.startsWith('>> ') || s === '>>') return ['transition', s.slice(2).trim()];
  if (s.startsWith('<< ') || s === '<<') return ['transition-in', s.slice(2).trim()];
  if (s.startsWith('/// ') || s === '///') return ['note', s.slice(3).trim()];
  if (s.startsWith('//')) return ['note', s.replace(/^\/+\s?/, '')];   // `//` ของ scriptmd2pdf
  // ── รหัสของ v1 (ยังอ่านได้ทั้งหมด — ไฟล์เดิมเปิดได้เหมือนเดิม) ──
  if (s.startsWith('$shot ')) return ['shot', s.slice(6).trim()];
  if (s.startsWith('$act ')) return ['act-break', s.slice(5).trim()];
  if (s.startsWith('$in ')) return ['transition-in', s.slice(4).trim()];
  if (s.startsWith('$sub ')) return ['subheader', s.slice(5).trim()];
  if (s.startsWith('$intercut ')) return ['intercut', s.slice(10).trim()];
  if (RAW_PREFIX.test(s)) return ['raw', line];
  // `((…))` — ใต้บรรทัดตัวละคร = วงเล็บ (มาตรฐานใหม่) · ที่อื่น = โน้ตแบบ v1 (ไฟล์เก่าไม่พัง)
  if (s.startsWith('((') && s.endsWith('))')) {
    const inner = s.slice(2, -2).trim();
    return CAN_TAKE_DOUBLE_PAREN(prevType, prevLine, prevBlank)
      ? ['parenthetical', '(' + inner + ')'] : ['note', inner];
  }
  if (s.startsWith('## ')) return ['outline2', s.slice(3).trim()];
  if (s.startsWith('# ')) return ['outline1', s.slice(2).trim()];
  if (s.startsWith('= ')) return ['summary', s.slice(2).trim()];
  if (s.startsWith('.') && !s.startsWith('..')) return ['scene', s.slice(1).trim()];
  // `! ` (มีวรรค) = ช็อต ตามมาตรฐานใหม่ · `!ข้อความ` (ไม่มีวรรค) = บรรยายบังคับแบบ v1
  if (s.startsWith('! ')) return ['shot', s.slice(2).trim()];
  if (s.startsWith('!')) return ['action', s.slice(1).trim()];
  if (s.startsWith('@')) return ['character', s.slice(1).trim()];
  if (s.startsWith('>')) return ['transition', s.slice(1).trim()];
  if (SCENE_RE.test(s)) return ['scene', s];
  if (TRANS_RE.test(s) && s.length <= 30) return ['transition', s];
  // วงเล็บเดี่ยว `(…)` เป็น "วงเล็บ" ได้เฉพาะใต้บรรทัดตัวละคร — ที่อื่นเป็นข้อความปกติ
  // (เดิมจับทุกที่ → บทพูดที่เป็นวงเล็บทั้งประโยคกลายเป็น parenthetical กลางบทสนทนา)
  if (s.startsWith('(') && s.endsWith(')') && CAN_TAKE_PAREN(prevType, prevBlank)) return ['parenthetical', s];
  // ตรวจจับ "ชื่อตัวละคร" อัตโนมัติ (บรรทัดไม่มี prefix @) — ใช้เป็น fallback เวลานำเข้า/วางข้อความดิบ
  // (ปกติผู้ใช้สร้างบล็อกตัวละครผ่านตัวเลือก element ซึ่งเติม @ ให้อยู่แล้ว)
  // เดิมบังคับ "พิมพ์ใหญ่ล้วน" ทำให้ชื่อผสมพิมพ์เล็ก (Nazarena, Frinton-Smith) และชื่อไทยไม่ถูกจับ
  // เกณฑ์ใหม่: อยู่หลังบรรทัดว่าง + ไม่จบด้วยเครื่องหมายวรรค + ไม่ขึ้นด้วยอัญประกาศ +
  //   (เป็นตัวพิมพ์ใหญ่ล้วนแบบอังกฤษ)  หรือ  (สั้นมาก ≤ 25 ตัว และไม่เกิน 3 คำ)
  //
  // **ต้องมีบรรทัดถัดไปที่ไม่ว่างเสมอ** (ตัวละคร = บรรทัดที่มีบรรทัดว่างข้างบน
  // และ **ไม่มี**บรรทัดว่างข้างล่าง เพราะบทพูดต้องตามมาติด ๆ) — ถ้าไม่บังคับข้อนี้
  // เกณฑ์ "≤ 25 ตัว และไม่เกิน 3 คำ" จะกิน **บรรยายสั้นภาษาไทยทุกบรรทัด**: ไทยไม่เว้นวรรค
  // ทั้งบรรทัดจึงนับเป็น 1 คำเสมอ → "ฝนตก" / "ลมพัดม่านไหว" กลายเป็นชื่อตัวละคร
  // แล้ว lineFor() เขียนกลับเป็น `@ฝนตก` = บันทึกครั้งเดียวไฟล์เสียถาวร
  if (guessNames) {
    const looksLikeName = !/[.!?…,;:"]$/.test(s) && !/^["'“]/.test(s) &&
      ((/[A-Za-z]/.test(s) && s === s.toUpperCase() && s.length <= 40) ||
       (s.length <= 25 && s.split(/\s+/).length <= 3));
    if (prevBlank && !nextBlank && looksLikeName) return ['character', s];
  }
  // บทพูดต่อจากบล็อกตัวละคร **ต้องติดกัน** — บรรทัดว่างปิดบล็อกบทสนทนาเสมอ (กติกาเดียวกับ
  // CAN_TAKE_PAREN) ไม่งั้นบรรยายย่อหน้าถัดไปหลังบทพูดจะกลายเป็น "บทพูดกำพร้า" ทั้งย่อหน้า
  if (!prevBlank) {
    // บรรทัดใต้ "ชื่อตัวละคร" / "วงเล็บ" = บทพูดเสมอ (นิยามของ element ไม่ใช่ตัวเลือก)
    if (prevType === 'character' || prevType === 'parenthetical') return ['dialogue', s];
    // บรรทัดใต้ "บทพูด" — ตรงนี้เป็น **กฎที่ผู้ใช้ตั้งเอง** (ดู SP_RULES.dialogueContinues)
    if (prevType === 'dialogue' && SP_RULES.dialogueContinues) return ['dialogue', s];
  }
  return ['action', s];
}

/**
 * เอกสารนี้ใช้ `@` บังคับชื่อตัวละครอยู่แล้วหรือยัง — ถ้าใช่ ปิดตัวเดาชื่ออัตโนมัติทิ้ง
 * (ไฟล์ทุกใบที่ตัวแก้ไขเขียนเองเข้าข่ายนี้ · สคริปต์ดิบที่ผู้ใช้วางมาไม่เข้าข่าย จึงยังเดาให้)
 */
export const guessNamesFor = (md) => !/^[ \t]*@/m.test(String(md ?? ''));
/** เวอร์ชันที่รับ "ลำดับบล็อก" — ตัวเขียนไฟล์ใช้ตัวนี้ ให้ตัดสินตรงกับตอนอ่านกลับเป๊ะ */
export const guessNamesForBlocks = (blocks) =>
  !(Array.isArray(blocks) && blocks.some((b) => b && b.el === 'character'));

export function parseScript(md) {
  const out = [];
  const lines = md.split('\n');
  const guessNames = guessNamesFor(md);
  let prevBlank = true, prevType = 'action', prevLine;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ส่ง "บรรทัดก่อนหน้าแบบดิบ" ไปด้วย — `((…))` ต้องรู้ว่าตัวละครข้างบนเขียน `@` ไว้จริงไหม
    // และส่ง "บรรทัดถัดไปว่างไหม" — ตัวจับชื่อตัวละครอัตโนมัติต้องมีบทพูดตามมาติด ๆ
    const nextBlank = i + 1 >= lines.length || lines[i + 1].trim() === '';
    const [el, text] = classify(line, prevBlank, prevType, prevLine, nextBlank, guessNames);
    if (el === 'blank') { out.push({ el: 'blank', text: '' }); prevBlank = true; prevLine = line; continue; }
    out.push({ el, text });
    prevBlank = false; prevType = el; prevLine = line;
  }
  return out;
}

// serialize บรรทัดเดียว: ใส่ prefix เท่าที่จำเป็นให้ classify อ่านกลับได้ element เดิม
export function lineFor(el, text, prevBlank, prevType, nextBlank = false, guessNames = true) {
  if (el === 'blank' || (el === 'action' && text.trim() === '')) return '';
  if (el === 'raw' || el === 'image') return text;   // รูปเก็บ md เดิมทั้งบรรทัด
  let s;
  switch (el) {
    // ── [alpha.60r3a] เขียนด้วยมาตรฐานใหม่เสมอ (อ่านได้ทั้งเก่า-ใหม่ แต่เขียนแบบใหม่อย่างเดียว) ──
    case 'page-break': s = '---'; break;
    case 'note': s = '/// ' + text; break;
    case 'shot': s = '! ' + text; break;
    case 'act-break': s = '$act ' + text; break;      // `## ` ชนกับโครง 2
    case 'transition-in': s = '<< ' + text; break;
    case 'subheader': s = '#### ' + text; break;
    case 'intercut': s = '$intercut ' + text; break;   // ไม่มีรหัสมาร์กดาวน์เทียบเท่า
    case 'parenthetical': {
      // เขียนเป็น `((…))` เสมอ — วงเล็บชั้นเดียวชนกับข้อความปกติที่บังเอิญอยู่ในวงเล็บ
      const inner = text.replace(/^\(+|\)+$/g, '').trim();
      s = '((' + inner + '))'; break;
    }
    case 'summary': s = '= ' + text; break;
    case 'outline1': s = '# ' + text; break;
    case 'outline2': s = '## ' + text; break;
    case 'outline3': s = '##### ' + text; break;
    case 'scene': s = '### ' + text; break;
    case 'transition': s = '>> ' + text; break;
    case 'character': s = '@' + text; break;
    default: s = text;                              // action / dialogue
  }
  const [got] = classify(s, prevBlank, prevType, undefined, nextBlank, guessNames);
  if (got !== el) {
    if (el === 'action') s = '!' + text;            // กันโดนตีเป็นอย่างอื่น (ไม่มีวรรค = บรรยายบังคับ)
    else if (el === 'character') s = '@' + text;
    else if (el === 'scene') s = '### ' + text;
  }
  return s;
}

/** บล็อกถัดไปนับเป็น "บรรทัดว่าง" ไหม — ใช้ร่วมกันทุกตัวเขียนไฟล์ ให้ตัดสินเหมือนกันเป๊ะ */
export const blockIsBlank = (b) =>
  !b || b.el === 'blank' || (b.el === 'action' && !String(b.text ?? '').trim());

/**
 * [alpha.60r3a] รหัสนำหน้าบรรทัดที่ "โหมดนิยายจะเห็นเป็นข้อความดิบ" — ใช้โดย markdown-code-toggle.js
 *
 * ไม่รวม `#`/`##`/`###`/`####` เพราะ md.js แปลงเป็นหัวข้อจริง (H1–H4) อยู่แล้ว ไม่มีข้อความ `#` เหลือให้ซ่อน
 * และไม่รวม `---` เพราะกลายเป็นเส้นคั่น (horizontal_rule) ซึ่งเป็นภาพแทน "ขึ้นหน้าใหม่" ที่ถูกต้องอยู่แล้ว
 *
 * **เรียงยาวก่อนสั้นเสมอ** — `>` จะกิน `>> ` และ `$in ` จะไม่มีวันถูกจับถ้าเรียงผิด
 */
export const SP_MD_PREFIXES = [
  '$intercut ', '$shot ', '$sub ', '$act ', '$in ',       // v1 (ยังเปิดไฟล์เก่าได้)
  '>> ', '<< ', '/// ', '// ', '= ', '((',                 // มาตรฐานใหม่
  '!', '@', '>', '.',                                      // ตัวอักษรเดียว — ต้องอยู่ท้ายสุด
];

/**
 * ความยาวของรหัสนำหน้าในข้อความหนึ่งบรรทัด (pure)
 *
 * [alpha.81r ข้อ 4] ย้ายมาจาก `markdown-code-toggle.js` เพราะตอนนี้มีผู้ใช้สองราย:
 * ตัวซ่อนรหัสบนจอ **และ** ตัวส่งออก (`stripFountainCodes`) — กติกาต้องเป็นชุดเดียวกันเป๊ะ
 * ไม่งั้นบนจอซ่อนอย่างหนึ่ง ไฟล์ที่ได้ตัดอีกอย่าง (`markdown-code-toggle.js` re-export ตัวนี้ต่อ)
 *
 * กติกาที่ต้องระวัง — ไม่งั้นตัดผิดจนอ่านไม่รู้เรื่อง:
 *   · ต้องมี "เนื้อหา" ตามหลังเสมอ — บรรทัดที่มีแต่ `.` หรือ `@` คือข้อความจริงของผู้ใช้
 *   · `.` ห้ามตัดถ้าตามด้วยตัวเลข/จุด/ช่องว่าง (`...` `1.5`) — นั่นคือประโยคปกติ
 *   · `!` ตัดเฉพาะกรณีไม่ใช่รูป `![alt](src)`
 *   · `((` ตัดหัวอย่างเดียว วงเล็บปิดท้ายบรรทัดจัดการด้วย `suffixLen`
 * @param {string} text
 * @returns {number} 0 = ไม่มีรหัสนำหน้า
 */
export function prefixLen(text) {
  const s = String(text || '');
  if (!s) return 0;
  for (const p of SP_MD_PREFIXES) {
    if (!s.startsWith(p)) continue;
    const rest = s.slice(p.length);
    if (!rest.trim()) return 0;                       // มีแต่รหัส ไม่มีเนื้อ → เป็นข้อความจริง
    if (p === '.') {
      // `.` ของ fountain ติดกับชื่อฉากเสมอ (`.INT. บ้าน`) — จุดของประโยคไม่เป็นแบบนี้
      if (/^[\s.\d]/.test(rest)) return 0;
      return 1;
    }
    if (p === '!') {
      if (/^\[[^\]\n]*\]\(/.test(rest)) return 0;     // ![alt](src) = รูปจริง ห้ามตัด
      return 1;                                       // `!ข้อความ` = บรรยายบังคับแบบ v1
    }
    // `@` / `>` เดี่ยว ๆ ต้องติดกับเนื้อหา — เว้นวรรคแปลว่าเป็นข้อความปกติ
    // (`>> ` / `<< ` ที่มีวรรคถูกจับไปแล้วข้างบน เพราะเรียงยาวก่อนสั้น)
    if ((p === '@' || p === '>') && /^\s/.test(rest)) return 0;
    return p.length;
  }
  return 0;
}

/** ความยาวของวงเล็บปิดท้ายโน้ต `((…))` (pure) — 0 = ไม่มี */
export function suffixLen(text) {
  const s = String(text || '');
  return (s.startsWith('((') && s.endsWith('))') && s.length > 4) ? 2 : 0;
}

/**
 * [alpha.81r ข้อ 4] ตัดรหัสของ fountain ออกจากข้อความทั้งก้อน — "ส่งออกต้องไม่มี `@` โผล่มา"
 *
 * รหัสพวกนี้ (`@ชื่อ` `.หัวฉาก` `>ทรานซิชัน` `((โน้ต))` …) เป็น **ไวยากรณ์ของไฟล์**
 * ไม่ใช่เนื้อเรื่อง — บนจอถูกซ่อนอยู่แล้ว แต่ตอนส่งออกทางที่ผ่าน Markdown ล้วน ๆ
 * (md / txt / html / PDF ของนิยาย) ไม่เคยมีใครตัดให้ จึงติดไปในไฟล์ที่ส่งให้คนอ่าน
 * ทางที่ผ่าน `parseScript` (PDF บทหนัง / rtf / fdx) ไม่ต้องใช้ตัวนี้ — พาร์เซอร์กินรหัสไปแล้ว
 */
export function stripFountainCodes(text) {
  return String(text == null ? '' : text).split('\n').map((line) => {
    const n = prefixLen(line);
    if (!n) return line;
    const body = line.slice(n);
    const cut = suffixLen(line);                       // `((โน้ต))` → เอาวงเล็บปิดออกด้วย
    return cut ? body.slice(0, body.length - cut) : body;
  }).join('\n');
}
