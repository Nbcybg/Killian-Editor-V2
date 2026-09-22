// i18n-classify.cjs — ตัดสินว่า "ข้อความไทยจุดนี้เป็นข้อความ UI หรือเป็นข้อมูล"
//
// **แหล่งความจริงเดียว** — ใช้ทั้งโดยเครื่องมือแปลงโค้ด (i18n-extract/i18n-rekey)
// และโดยเทสที่กวาดหาข้อความไทยตกค้าง (test/i18n-keys.test.cjs)
// ถ้าสองที่นี้ใช้กฎคนละชุด จะได้ผลไม่ตรงกันทันที (เทสแดงทั้งที่เครื่องมือบอกว่าสะอาด)

const { cookedValue } = require('./js-lex.cjs');

// ไฟล์ที่ไทยข้างในเป็น "ข้อมูลภาษา/ไวยากรณ์ของไฟล์งาน" ทั้งไฟล์ — แปลแล้วพัง
const SKIP_FILES = new Set([
  'src/i18n.js', 'src/i18n-csv.js',                 // ตัวระบบภาษาเอง
  'src/fountain.js',                                // คำนำหน้า/ทรานซิชัน = ไวยากรณ์ของไฟล์บท
  'src/md.js',                                      // โทเคนของมาร์กดาวน์
  'src/spell.js',                                   // พจนานุกรม
  'src/relationship-types.js',                      // ชนิดความสัมพันธ์ = ค่าที่เก็บใน Wiki JSON
  'src/tools/thesaurus.js',                         // คลังคำพ้อง/คำตรงข้ามไทย = ข้อมูลภาษา
  'src/theme-gen.js',                               // [alpha.159] คำอธิบายตัวแปรสำหรับนักพัฒนา (เทมเพลตธีม/ข้อความเทส) ไม่ขึ้น UI
]);

// ═══ [alpha.116 ข้อ 6] เครื่องหมายในซอร์ส — ท่าที่ควรใช้กับของใหม่ทุกครั้ง ═══
//
// SKIP_RANGES ข้างล่างอ้าง **เลขบรรทัด** ซึ่งเลื่อนทุกครั้งที่มีใครแทรกโค้ดเหนือช่วงนั้น
// (รอบ alpha.116 รอบเดียวพังสามครั้ง: builder-core · main.js · app.js) — อาการคือเทสแดง
// ด้วยข้อความ "มีข้อความไทยตกค้าง" ที่ชี้ไปบรรทัดที่ไม่เกี่ยวอะไรเลย เสียเวลาไล่ทุกครั้ง
//
// ตอนนี้เขียนกำกับในซอร์สได้ตรง ๆ แทน — ย้ายโค้ดไปไหนเครื่องหมายก็ติดไปด้วย:
//     /* i18n-skip: <เหตุผล> */   … โค้ด …   /* /i18n-skip */
// [alpha.162] เดิม `[^*]*` → เหตุผลที่มี `*` (เช่น "Branches/*.json") ทำให้ตัวเปิดไม่ถูกจับแบบเงียบ
const SKIP_OPEN = /\/\*\s*i18n-skip\b[\s\S]*?\*\//g;
const SKIP_CLOSE = /\/\*\s*\/i18n-skip\s*\*\//;

/** ช่วง [start,end) ของทุกบล็อกที่ถูกกำกับด้วยเครื่องหมายในไฟล์นี้ */
function markedRegions(src) {
  const out = [];
  SKIP_OPEN.lastIndex = 0;
  let m;
  while ((m = SKIP_OPEN.exec(src))) {
    if (SKIP_CLOSE.test(m[0])) continue;                  // ตัวปิด — ไม่ใช่ตัวเปิด
    const rest = src.slice(m.index + m[0].length);
    const c = rest.search(SKIP_CLOSE);
    const end = c < 0 ? src.length : m.index + m[0].length + c;
    out.push([m.index, end]);
    SKIP_OPEN.lastIndex = end;
  }
  return out;
}
const _markCache = new Map();
function markedFor(src) {
  if (!_markCache.has(src)) _markCache.set(src, markedRegions(src));
  return _markCache.get(src);
}

// [alpha.162] **ว่างแล้ว และต้องว่างตลอดไป** — ของเดิมทั้ง 8 ไฟล์ย้ายไปใช้ /* i18n-skip */ ในซอร์สแล้ว
// (เลขบรรทัดเลื่อนทุกครั้งที่แทรกโค้ด: รอบ W7 แทรก import บรรทัดเดียว ช่วงเลื่อน 3 ไฟล์ ด่านจับได้แค่ไฟล์เดียว
//  อีกสองไฟล์เลื่อนไปครอบบรรทัดอื่นแบบเงียบ) · ย้ายแล้วตรวจว่าโทเคนไทยทุกตัวได้กลุ่มเดิมเป๊ะ
// ตัวแปรคงไว้ให้โค้ดเดิมที่อ่านมันไม่พัง · ด่าน test/i18n-locale ห้ามเพิ่มรายการ
const SKIP_RANGES = {};

/** app.js: บล็อก selftest — ชื่อเทสเป็นของนักพัฒนา ไม่ใช่ข้อความของผู้ใช้ */
function testStart(rel, src) {
  if (rel === 'src/selftest.js') return 1;      // [alpha.160] selftest แยกไฟล์แล้ว — ทั้งไฟล์คือบล็อกเทส
  if (rel !== 'src/app.js') return Infinity;
  const m = /\nasync function runTest\(/.exec(src);
  return m ? src.slice(0, m.index).split('\n').length : Infinity;
}

const CMP_BEFORE = /(===|!==|==|!=|\bcase)\s*$/;
const CMP_AFTER = /^\s*(===|!==|==|!=)/;
const DATA_CALL = /\.(includes|indexOf|lastIndexOf|startsWith|endsWith|split|match|matchAll|search|test|exec|localeCompare|replace|replaceAll|hasOwnProperty)\s*\([^()]*$/;
const REGEX_CALL = /(new\s+RegExp|RegExp)\s*\([^()]*$/;
const CONSOLE_CALL = /console\.\w+\s*\([^()]*$/;
// [alpha.128] เดิมรวม `t` / `tr` ไว้ด้วย → `t('ui.x.y', 'ค่าสำรองไทย')` ถูกนับเป็น 'already'
// ทั้งที่ **กฎถาวร alpha.77 ห้ามมีค่าสำรอง** (`t()` รับคีย์ตัวเดียว อาร์กิวเมนต์ที่สองถูกทิ้ง
// เฉย ๆ อยู่แล้ว) — ช่องโหว่นี้ปล่อยให้ไทยฮาร์ดโค้ด 143 จุดนั่งอยู่ในซอร์สโดยเทสไม่ฟ้อง
// เหลือเฉพาะตัวที่ **ใช้ค่าสำรอง/ค่าแทรกจริง**: tKey(key, fallback) · tm(msgid, ...) · tf(key, ...vals)
const T_FALLBACK = /\b(tKey|tm|tf)\s*\(\s*(['"])[^'"]*\2\s*,\s*$/;
const OBJ_KEY_BEFORE = /[{,]\s*$/;
const PROP_BEFORE = /[A-Za-z0-9_$)\]]\s*\[\s*$/, PROP_AFTER = /^\s*\]/;
const KEYWORD_BEFORE = /(^|[^A-Za-z0-9_$.])(return|typeof|instanceof|case|else|do|new|delete|void|in|of|await|yield|throw)\s*$/;
const KEY_AFTER = /^\s*:/;
const ALREADY = /(^|[^A-Za-z0-9_$.])(T|tm)\s*$/;
const SYMBOL_ONLY = /^[\s\-–—·:|/\\]*$/;

/**
 * @returns {'ui'|'test'|'data-range'|'skip-file'|'already'|'compare'|'data-call'|'console'|'obj-key'|'prop'|'tagged'|'symbol'}
 *   'ui' = ต้องแปล · อย่างอื่น = ปล่อยเป็นไทยไว้อย่างนั้น
 */
function classify(src, tok, rel, tstart) {
  if (SKIP_FILES.has(rel)) return 'skip-file';
  if (tok.line >= (tstart === undefined ? testStart(rel, src) : tstart)) return 'test';
  for (const [a, b] of (SKIP_RANGES[rel] || [])) if (tok.line >= a && tok.line <= b) return 'data-range';
  for (const [a, b] of markedFor(src)) if (tok.start >= a && tok.end <= b) return 'data-range';
  const before = src.slice(Math.max(0, tok.start - 120), tok.start);
  const after = src.slice(tok.end, tok.end + 24);
  if (ALREADY.test(before)) return 'already';
  if (T_FALLBACK.test(before)) return 'already';
  if (CMP_BEFORE.test(before) || CMP_AFTER.test(after)) return 'compare';
  if (DATA_CALL.test(before) || REGEX_CALL.test(before)) return 'data-call';
  if (CONSOLE_CALL.test(before)) return 'console';
  if (KEY_AFTER.test(after) && OBJ_KEY_BEFORE.test(before)) return 'obj-key';
  if (PROP_BEFORE.test(before) && PROP_AFTER.test(after)) return 'prop';
  if (tok.type === 'tpl' && /[A-Za-z0-9_$)\]]\s*$/.test(before) && !KEYWORD_BEFORE.test(before)) return 'tagged';
  if (SYMBOL_ONLY.test(cookedValue(tok))) return 'symbol';
  return 'ui';
}

module.exports = { classify, testStart, SKIP_FILES, SKIP_RANGES, markedRegions };
