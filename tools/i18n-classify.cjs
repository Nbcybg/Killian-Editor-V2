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
]);

// ช่วงบรรทัดที่เป็นค่าคงที่ซึ่งถูกเขียนลงไฟล์งาน (อ่านกลับด้วยค่าเดิม)
const SKIP_RANGES = {
  'src/core.js': [[368, 392]],                      // SCENE_STATUSES / SCENE_COLORS / STATUS_COLORS
  'src/planner/planner-data.js': [[14, 24]],        // PLANNER_STATUSES (เก็บใน Planners/*.json)
  'src/kanban/kanban-core.js': [[8, 20]],           // คอลัมน์ = สถานะฉากตัวเดียวกับ scenes.json
  'src/branch-plans.js': [[20, 28]],                // PLAN_STATUSES (เก็บใน Branches/*.json)
  'src/visual-tags.js': [[1, 12]],                  // แท็กมาตรฐาน = ค่าที่เก็บใน scenes.json
  'src/scene-meta.js': [[1, 40]],
  // [alpha.87] PROSE_ELEMS — ป้ายชนิดบล็อกฝั่งนิยาย คู่ขนานกับ SP_ELEMS ของ fountain.js
  // (ไฟล์นั้นถูกข้ามทั้งไฟล์ด้วยเหตุผลเดียวกัน) ใช้บอกผู้ใช้ว่า "อะไรจะกลายเป็นอะไร"
  // ตอนแปลงข้ามโหมด — เป็นคำศัพท์ของไวยากรณ์ไฟล์งาน ต้องอ่านตรงกับที่ตัวแก้ไขแสดง
  'src/convert.js': [[29, 37]],
  'src/ai/ai-character.js': [[92, 97]],             // สรรพนาม/คำลงท้ายไทย = ตัวจับรูปแบบการพูด
  // [alpha.89] คลังคำของตัววิเคราะห์ (คำหยุด/คำบอกความขัดแย้ง/คำเชิงรัก) — **ข้อมูลภาษาไทย**
  // ใช้สแกนต้นฉบับที่ผู้ใช้เขียนเป็นภาษาไทย · สลับภาษาหน้าจอเป็นอังกฤษเมื่อไหร่
  // แล้วยังต้องวิเคราะห์ไฟล์ไทยได้เหมือนเดิม (เหตุผลเดียวกับ thesaurus.js ที่ถูกข้ามทั้งไฟล์)
  'src/ai/ai-analyze.js': [[19, 42]],
  // [alpha.79] samplePluginFiles() — **เนื้อไฟล์ที่เขียนลงดิสก์** (plugin.json + main.js ของ
  // ปลั๊กอินตัวอย่าง) ไม่ใช่ข้อความบนหน้าจอของโปรแกรม · เป็นซอร์สโค้ดที่ผู้ใช้เปิดไปแก้ต่อ
  // แปลตามภาษา UI ไม่ได้ (ไฟล์บนดิสก์ต้องคงที่ ไม่งั้นสลับภาษาแล้วไฟล์ที่สร้างไว้ไม่ตรงกัน)
  'src/plugins/plugin-core.js': [[128, 163]],
  // [alpha.82] PERSONA_FIELDS — **ชื่อฟิลด์ใน Wiki JSON ของผู้ใช้** ที่ใช้ประกอบใบบทบาท
  // ไม่ใช่ข้อความบนหน้าจอ · แปลตามภาษา UI เมื่อไหร่ = สลับเป็นอังกฤษแล้วหาฟิลด์ไทยไม่เจอเลย
  // (ป้ายที่เขียนลงใบบทบาทใช้ตัวเดียวกัน เพราะใบถูกเก็บเป็นเนื้อหาในไฟล์เซสชัน)
  'src/dialogue/builder-core.js': [[239, 248]],
};

/** app.js: บล็อก selftest — ชื่อเทสเป็นของนักพัฒนา ไม่ใช่ข้อความของผู้ใช้ */
function testStart(rel, src) {
  if (rel !== 'src/app.js') return Infinity;
  const m = /\nasync function runTest\(/.exec(src);
  return m ? src.slice(0, m.index).split('\n').length : Infinity;
}

const CMP_BEFORE = /(===|!==|==|!=|\bcase)\s*$/;
const CMP_AFTER = /^\s*(===|!==|==|!=)/;
const DATA_CALL = /\.(includes|indexOf|lastIndexOf|startsWith|endsWith|split|match|matchAll|search|test|exec|localeCompare|replace|replaceAll|hasOwnProperty)\s*\([^()]*$/;
const REGEX_CALL = /(new\s+RegExp|RegExp)\s*\([^()]*$/;
const CONSOLE_CALL = /console\.\w+\s*\([^()]*$/;
const T_FALLBACK = /\b(t|tr|tKey|tm|tf)\s*\(\s*(['"])[^'"]*\2\s*,\s*$/;
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

module.exports = { classify, testStart, SKIP_FILES, SKIP_RANGES };
