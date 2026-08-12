// test/sp-validator.test.cjs — unit test ตัวตรวจข้อผิดพลาดในบท (ข้อ 54)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-spvalidator-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'sp-validator.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const V = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const B = (el, text) => ({ el, text });
const types = (errs) => errs.map((e) => e.type);
const has = (errs, t) => errs.some((e) => e.type === t);

// ── โครงสร้างพื้นฐาน ──
check('มีรหัสข้อผิดพลาดครบ 8 ชนิด', Object.keys(V.SP_ERRORS).length === 8, Object.keys(V.SP_ERRORS).length);
check('ทุกชนิดมีระดับความรุนแรงกำกับ',
  Object.values(V.SP_ERRORS).every((t) => ['error', 'warn'].includes(V.SP_SEVERITY[t])));
check('validateScreenplay รับค่าที่ไม่ใช่ array ได้โดยไม่พัง', V.validateScreenplay(null).length === 0);
check('บทว่าง = ไม่มีข้อผิดพลาด', V.validateScreenplay([]).length === 0);

// ── บทที่ถูกต้อง ต้องไม่มีข้อผิดพลาดเลย ──
const good = [
  B('scene', 'INT. ห้องครัว - กลางวัน'),
  B('action', 'ทอร่ายืนนิ่ง'),
  B('character', 'ทอร่า'),
  B('parenthetical', '(กระซิบ)'),
  B('dialogue', 'ฉันไม่ได้ตั้งใจ'),
  B('transition', 'CUT TO:'),
  B('scene', 'EXT. สวนหลังบ้าน - กลางคืน'),
  B('action', 'ลมพัดใบไม้'),
];
check('บทที่ถูกกติกา → ไม่มีข้อผิดพลาด', V.validateScreenplay(good).length === 0,
      JSON.stringify(types(V.validateScreenplay(good))));

// ── 1. element ว่าง ──
{
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', '   ')]);
  check('ตัวละครว่าง → EMPTY_ELEMENT', has(e, V.SP_ERRORS.EMPTY_ELEMENT));
  check('บรรยายว่าง (บรรทัดเว้นวรรค) ไม่นับเป็นข้อผิดพลาด',
    V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('action', '   ')]).length === 0);
  check('บรรทัด blank ถูกข้าม',
    V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('blank', '')]).length === 0);
}

// ── 2. ตัวละครกำพร้า ──
{
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'), B('action', 'เดินออกไป')]);
  check('ตัวละครไม่มีบทพูดตามหลัง → ORPHAN_CHARACTER', has(e, V.SP_ERRORS.ORPHAN_CHARACTER));
  check('ข้อความบอกชื่อตัวละครที่ผิด', e.find((x) => x.type === V.SP_ERRORS.ORPHAN_CHARACTER).msg.includes('ทอร่า'));
  const e2 = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า')]);
  check('ตัวละครเป็นบล็อกสุดท้าย → ORPHAN_CHARACTER', has(e2, V.SP_ERRORS.ORPHAN_CHARACTER));
  const e3 = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'),
                                   B('blank', ''), B('dialogue', 'สวัสดี')]);
  check('มีบรรทัดว่างคั่นตัวละครกับบทพูด → ยังถือว่าถูก', !has(e3, V.SP_ERRORS.ORPHAN_CHARACTER));
}

// ── 3. บทพูดกำพร้า ──
{
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('action', 'ประตูเปิด'), B('dialogue', 'ใครน่ะ')]);
  check('บทพูดไม่มีตัวละครนำหน้า → ORPHAN_DIALOGUE', has(e, V.SP_ERRORS.ORPHAN_DIALOGUE));
  const ok = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'),
                                   B('dialogue', 'สวัสดี'), B('dialogue', 'เป็นไงบ้าง')]);
  check('บทพูดต่อจากบทพูด = ถูกต้อง', !has(ok, V.SP_ERRORS.ORPHAN_DIALOGUE));
}

// ── 4. วงเล็บกำพร้า ──
{
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('action', 'เงียบ'), B('parenthetical', '(เบา ๆ)')]);
  check('วงเล็บหลังบรรยาย → ORPHAN_PARENTHETICAL', has(e, V.SP_ERRORS.ORPHAN_PARENTHETICAL));
  const ok = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'),
                                   B('dialogue', 'สวัสดี'), B('parenthetical', '(หยุด)'), B('dialogue', 'ไปละ')]);
  check('วงเล็บกลางบทพูด = ถูกต้อง', !has(ok, V.SP_ERRORS.ORPHAN_PARENTHETICAL));
  const un = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'), B('parenthetical', '(กระซิบ'),
                                   B('dialogue', 'สวัสดี')]);
  check('วงเล็บไม่ปิด → UNCLOSED_PARENTHETICAL', has(un, V.SP_ERRORS.UNCLOSED_PARENTHETICAL));
}

// ── 5. บรรทัดยาวเกิน ──
{
  const long = 'ก'.repeat(80);
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'), B('dialogue', long)]);
  check('บทพูดยาวเกิน 60 → OVERLONG_LINE', has(e, V.SP_ERRORS.OVERLONG_LINE));
  check('ข้อความบอกจำนวนตัวอักษรจริง',
    e.find((x) => x.type === V.SP_ERRORS.OVERLONG_LINE).msg.includes('80/60'),
    e.find((x) => x.type === V.SP_ERRORS.OVERLONG_LINE).msg);
  const e2 = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('action', 'ก'.repeat(65))]);
  check('บรรยาย 65 ตัว ยังไม่เกิน 70', !has(e2, V.SP_ERRORS.OVERLONG_LINE));
  const e3 = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('character', 'ทอร่า'), B('dialogue', long)],
                                  { limits: { dialogue: 200 } });
  check('ปรับ limits เองแล้วไม่เตือน', !has(e3, V.SP_ERRORS.OVERLONG_LINE));
}

// ── 6. หัวฉากติดกัน ──
{
  const e = V.validateScreenplay([B('scene', 'INT. ห้อง - วัน'), B('scene', 'EXT. สวน - คืน'), B('action', 'ลมพัด')]);
  check('หัวฉากติดกัน → DOUBLE_SCENE', has(e, V.SP_ERRORS.DOUBLE_SCENE));
}

// ── 7. เนื้อบทก่อนหัวฉากแรก ──
{
  const e = V.validateScreenplay([B('action', 'ยังไม่มีหัวฉาก'), B('scene', 'INT. ห้อง - วัน')]);
  check('มีบรรยายก่อนหัวฉากแรก → MISSING_SCENE_HEADING', has(e, V.SP_ERRORS.MISSING_SCENE_HEADING));
  check('เตือนครั้งเดียวไม่ซ้ำทุกบรรทัด',
    V.validateScreenplay([B('action', 'a'), B('action', 'b'), B('action', 'c')])
      .filter((x) => x.type === V.SP_ERRORS.MISSING_SCENE_HEADING).length === 1);
}

// ── ดัชนีบล็อกต้องชี้กลับ array เดิม (รวม blank) ──
{
  const arr = [B('blank', ''), B('scene', 'INT. ห้อง - วัน'), B('blank', ''), B('character', 'ทอร่า')];
  const e = V.validateScreenplay(arr);
  const oc = e.find((x) => x.type === V.SP_ERRORS.ORPHAN_CHARACTER);
  check('ดัชนี block ชี้ตำแหน่งจริงใน array (นับ blank ด้วย)', oc && oc.block === 3, oc && oc.block);
}

// ── ตัวกรองกฎ ──
{
  const arr = [B('action', 'ก่อนหัวฉาก'), B('character', 'ทอร่า')];
  const only = V.validateScreenplay(arr, { checks: [V.SP_ERRORS.ORPHAN_CHARACTER] });
  check('opts.checks จำกัดเฉพาะกฎที่เลือก',
    only.length === 1 && only[0].type === V.SP_ERRORS.ORPHAN_CHARACTER, JSON.stringify(types(only)));
}

// ── สรุป + วนหาข้อถัดไป ──
{
  const errs = [{ type: 'a', block: 5, severity: 'error' }, { type: 'b', block: 2, severity: 'warn' }];
  const s = V.errorSummary(errs);
  check('errorSummary แยก error/warn', s.total === 2 && s.errors === 1 && s.warnings === 1);
  check('summaryText บอกจำนวนทั้งสองแบบ', V.summaryText(errs).includes('1 ข้อผิดพลาด') &&
        V.summaryText(errs).includes('1 ข้อควรดู'), V.summaryText(errs));
  check('summaryText เมื่อไม่มีข้อผิดพลาด', V.summaryText([]).includes('ไม่พบข้อผิดพลาด'));
  check('nextError: จากตำแหน่ง -1 ได้ข้อแรกตามลำดับบล็อก', V.nextError(errs, -1).block === 2);
  check('nextError: จากบล็อก 2 ได้ข้อถัดไป', V.nextError(errs, 2).block === 5);
  check('nextError: หมดแล้ววนกลับข้อแรก', V.nextError(errs, 99).block === 2);
  check('nextError: ไม่มีข้อผิดพลาด → null', V.nextError([], 0) === null);
}

// ── ป้ายชื่อ element ภาษาไทย ──
check('elLabel แปลชื่อ element เป็นไทย', V.elLabel('character') === 'ตัวละคร' && V.elLabel('dialogue') === 'บทพูด');
check('elLabel ชื่อที่ไม่รู้จัก → คืนค่าเดิม', V.elLabel('zzz') === 'zzz');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
