// test/entity-mention.test.cjs — โค้ดสั้น `{{ชื่อ}}` + ช่อง Prompt (alpha.122 · ยกเครื่อง .123)
//
// สามเรื่องที่ "พังเงียบ" ได้ง่ายที่สุดในระบบนี้:
//   1. คลายโค้ดสั้นไม่ออก → โมเดลเห็นวงเล็บปีกกาแทนชื่อคน แล้วตอบเพี้ยนโดยไม่มีใครรู้
//   2. หาไม่เจอแล้วกลืนข้อความทิ้ง → ผู้ใช้พิมพ์ผิดหนึ่งตัวแล้วประโยคหายทั้งท่อน
//   3. ช่อง Prompt เก็บเป็นอาร์เรย์คู่ — ลำดับต้องคงที่และชื่อหัวข้อซ้ำกันได้
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(rel, out) {
  const file = path.join(os.tmpdir(), out);
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', rel)], outfile: file,
                      format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(file);
}
const E = load('src/entity-mention.js', '_ent_mention.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  x FAIL:', n, i ? ':: ' + i : ''); } };

const cast = [
  { id: 'a', name: 'ลิเลียน', shortcode: 'characterA', aliases: ['คุณหนู'] },
  { id: 'b', name: 'Kai', aliases: [] },
  { id: 'c', name: '', shortcode: '' },            // ตัวเปล่า — ต้องไม่ทำดัชนีพัง
];

// ═══════════ 1. โค้ดสั้นประจำตัว ═══════════
{
  check('ตั้งโค้ดสั้นเองแล้วใช้อันนั้น', E.shortcodeOf(cast[0]) === 'characterA');
  check('ไม่ตั้ง = ใช้ชื่อจริง', E.shortcodeOf(cast[1]) === 'Kai');
  check('ไม่มีอะไรเลย = ว่าง', E.shortcodeOf(cast[2]) === '' && E.shortcodeOf(null) === '');
  check('ห่อเป็นโทเคนได้', E.mentionToken('characterA') === '{{characterA}}');
  check('คำสงวนมีสองตัวพอดี', E.RESERVED_MENTIONS.join(',') === 'character,user');
  check('รู้จักคำสงวน (ไม่สนตัวพิมพ์/ช่องว่าง)',
        E.isReserved('character') && E.isReserved(' USER ') && !E.isReserved('ลิเลียน'));
}

// ═══════════ 1b. แปลงรูปแบบเก่าของ alpha.122 (`{[x]}` → `{{x}}`) ═══════════
{
  check('แปลงไฟล์เก่าได้', E.migrateMentions('ไป {[ลิเลียน]} สิ') === 'ไป {{ลิเลียน}} สิ');
  check('ไม่มีของเก่า = ไม่แตะ', E.migrateMentions('ไป {{ลิเลียน}} สิ') === 'ไป {{ลิเลียน}} สิ');
  check('ว่าง/นัลล์ไม่ล้ม', E.migrateMentions('') === '' && E.migrateMentions(null) === '');
}

// ═══════════ 2. อ่านโค้ดสั้นจากข้อความ ═══════════
{
  const txt = 'สวัสดี {{characterA}} วันนี้ {{Kai}} มาด้วย และ {{characterA}} ยิ้ม';
  check('อ่านครบไม่ซ้ำ', E.parseMentions(txt).join(',') === 'characterA,Kai',
        JSON.stringify(E.parseMentions(txt)));
  check('ไม่มีโค้ดสั้น = ว่าง', E.parseMentions('ข้อความธรรมดา').length === 0);
  check('วงเล็บไม่ครบไม่นับ', E.parseMentions('{{ยังไม่ปิด และ [x] และ {y}').length === 0);
  check('วงเล็บซ้อนไม่จับคร่อม', E.parseMentions('{{a{{b}}}}').join(',') === 'b',
        JSON.stringify(E.parseMentions('{{a{{b}}}}')));
}

// ═══════════ 3. คลายเป็นชื่อจริง ═══════════
{
  check('คลายด้วยโค้ดสั้น',
        E.expandMentions('ไป {{characterA}} สิ', cast) === 'ไป ลิเลียน สิ');
  check('คลายด้วยชื่อจริง', E.expandMentions('{{Kai}}', cast) === 'Kai');
  check('คลายด้วยชื่อรอง', E.expandMentions('{{คุณหนู}}', cast) === 'ลิเลียน');
  check('ไม่สนช่องว่าง/ตัวพิมพ์', E.expandMentions('{{ CHARACTERA }}', cast) === 'ลิเลียน');
  // กติกาข้อ 3: หาไม่เจอ = คงข้อความไว้ ห้ามกลืนหาย
  check('หาไม่เจอ = เหลือข้อความดิบ',
        E.expandMentions('ใคร {{ไม่มีคนนี้}} นะ', cast) === 'ใคร ไม่มีคนนี้ นะ');
  check('ข้อความว่าง/นัลล์ไม่ล้ม',
        E.expandMentions('', cast) === '' && E.expandMentions(null, cast) === '');
  check('ไม่มี cast ก็ยังคืนข้อความอ่านได้',
        E.expandMentions('{{x}}', []) === 'x');
}

// ═══════════ 4. เตือนโค้ดสั้นที่ชี้ไปที่ไม่มี ═══════════
{
  const bad = E.unknownMentions('{{characterA}} กับ {{ผี}}', cast);
  check('รู้ว่าตัวไหนไม่มีอยู่จริง', bad.length === 1 && bad[0] === 'ผี', JSON.stringify(bad));
  check('ครบทุกตัว = ไม่เตือน', E.unknownMentions('{{Kai}}', cast).length === 0);
  const who = E.mentionedChars('{{คุณหนู}} และ {{characterA}}', cast);
  check('ตัวเดียวกันนับครั้งเดียว', who.length === 1 && who[0].id === 'a');
}

// ═══════════ 5. ชิป + แทรกที่เคอร์เซอร์ ═══════════
{
  const chips = E.mentionChips(cast);
  // 2 คำสงวน + 2 ตัวละครที่มีชื่อ (ตัวเปล่าไม่นับ)
  check('ตัวไม่มีชื่อไม่ขึ้นชิป', chips.length === 4, JSON.stringify(chips.map((x) => x.name)));
  check('คำสงวนมาก่อนเสมอ',
        chips[0].kind === 'any' && chips[1].kind === 'user'
        && chips[0].token === '{{character}}' && chips[1].token === '{{user}}');
  check('ชิปตัวละครพกโทเคนพร้อมแทรก',
        chips[2].kind === 'char' && chips[2].token === '{{characterA}}');
  check('ป้ายคำสงวนรับคำแปลจากคนเรียกได้',
        E.mentionChips([], { any: 'ใครก็ได้', user: 'ผู้เล่น' })[0].name === 'ใครก็ได้');

  const r1 = E.insertAt('เขาบอกว่า', 9, 9, '{{A}}');
  check('เว้นวรรคหน้าให้เอง', r1.text === 'เขาบอกว่า {{A}}', JSON.stringify(r1.text));
  check('เคอร์เซอร์ไปท้ายโทเคน', r1.caret === r1.text.length);
  const r2 = E.insertAt('ก ข', 2, 2, '{{A}}');
  check('เว้นวรรคหลังให้เอง เมื่อมีข้อความตาม', r2.text === 'ก {{A}} ข', JSON.stringify(r2.text));
  const r3 = E.insertAt('', 0, 0, '{{A}}');
  check('ช่องว่างเปล่าไม่เติมช่องว่างเกิน', r3.text === '{{A}}', JSON.stringify(r3.text));
  const r4 = E.insertAt('abcdef', 1, 4, '{{A}}');
  check('แทนที่ช่วงที่เลือก', r4.text === 'a {{A}} ef', JSON.stringify(r4.text));
  const r5 = E.insertAt('abc', 99, 99, '{{A}}');
  check('ตำแหน่งเกินขอบไม่ล้ม', r5.text === 'abc {{A}}', JSON.stringify(r5.text));
}

// ═══════════ 5b. คำสงวน `{{character}}` / `{{user}}` ═══════════
{
  // `{{character}}` = ใครก็ได้ → ให้โมเดลเห็นทั้ง pool จะได้เลือกอย่างมีข้อมูล
  const any = E.expandMentions('แต่งงานกับ {{character}}', cast, { anyLabel: 'ใครก็ได้' });
  check('{{character}} คลายเป็นรายชื่อทั้งวง',
        any === 'แต่งงานกับ ใครก็ได้ (ลิเลียน / Kai)', JSON.stringify(any));
  check('ไม่มี cast = ใช้คำสำรอง',
        E.expandMentions('{{character}}', [], { anyLabel: 'ใครก็ได้' }) === 'ใครก็ได้');

  // `{{user}}` = ตัวที่ผู้เล่นสวมบท
  check('{{user}} คลายเป็นชื่อที่ส่งเข้ามา',
        E.expandMentions('{{user}} เดินเข้ามา', cast, { user: 'ลิเลียน' }) === 'ลิเลียน เดินเข้ามา');
  check('ไม่ได้สวมบทใคร = คำสำรอง',
        E.expandMentions('{{user}}', cast, { userLabel: 'ผู้เล่น' }) === 'ผู้เล่น');

  // คำสงวนต้องไม่ถูกนับว่า "หาไม่เจอ" ไม่งั้นขึ้นเตือนสีส้มทั้งที่ถูกต้อง
  check('คำสงวนไม่ขึ้นคำเตือน',
        E.unknownMentions('{{character}} กับ {{user}}', cast).length === 0);
  check('คำสงวนไม่นับเป็นตัวละครที่ถูกอ้างถึง',
        E.mentionedChars('{{user}} {{characterA}}', cast).length === 1);

  // คำสงวนชนะแม้มีตัวละครชื่อเดียวกัน — กติกาที่ UI เตือนให้ผู้ใช้รู้ตัว
  const clash = [{ id: 'z', name: 'ตัวปลอม', shortcode: 'user' }];
  check('คำสงวนชนะตัวละครที่ตั้งชื่อชน',
        E.expandMentions('{{user}}', clash, { user: 'ของจริง' }) === 'ของจริง');
}

// ═══════════ 6. ช่อง Prompt ═══════════
{
  check('อาร์เรย์คู่ผ่านตรง ๆ',
        E.normalizePrompts([{ k: 'Prompt A', v: 'x' }]).length === 1);
  check('object แบบเก่าแปลงได้',
        E.normalizePrompts({ 'Prompt A': 'x' })[0].v === 'x');
  check('ของพัง/นัลล์ = ว่าง',
        E.normalizePrompts(null).length === 0 && E.normalizePrompts([null, 0]).length === 0);
  check('แถวว่างสนิทถูกตัด', E.normalizePrompts([{ k: '', v: '  ' }]).length === 0);
  check('ชื่อหัวข้อซ้ำกันได้ (ไม่ใช่ object)',
        E.normalizePrompts([{ k: 'A', v: '1' }, { k: 'A', v: '2' }]).length === 2);
  check('ลำดับคงเดิม',
        E.normalizePrompts([{ k: 'B', v: '1' }, { k: 'A', v: '2' }]).map((x) => x.k).join('') === 'BA');

  check('ชื่อถัดไปไล่ตัวอักษร', E.nextPromptKey([]) === 'Prompt A');
  check('ชื่อถัดไปนับต่อ', E.nextPromptKey([{ k: 'x', v: 'y' }]) === 'Prompt B');
  check('เกิน Z ใช้ตัวเลข',
        E.nextPromptKey(new Array(26).fill({ k: 'x', v: 'y' })) === 'Prompt 27');

  check('รวมเป็นข้อความ + คลายโค้ดสั้น',
        E.promptsText([{ k: 'A', v: 'ชอบ {{characterA}}' }], cast) === 'A: ชอบ ลิเลียน');
  check('ช่องว่างไม่ถูกส่งเข้าโมเดล',
        E.promptsText([{ k: 'A', v: '' }, { k: 'B', v: 'x' }], cast) === 'B: x');
  check('ไม่มีชื่อหัวข้อ = ส่งแต่เนื้อ',
        E.promptsText([{ k: '', v: 'x' }], cast) === 'x');
}

// ═══════════ 7. ต้องแปลงรูปแบบเก่าไหม ═══════════
{
  check('ไม่มีเลย = ไม่ต้องแปลง', E.needsPromptMigration(undefined) === false
        && E.needsPromptMigration(null) === false);
  check('object แบบเก่า = ต้องแปลง', E.needsPromptMigration({ A: 'x' }) === true);
  check('อาร์เรย์คู่ครบ = ไม่ต้องแปลง',
        E.needsPromptMigration([{ k: 'A', v: 'x' }]) === false);
  check('อาร์เรย์ที่มีของแปลกปน = ต้องแปลง',
        E.needsPromptMigration([{ k: 'A', v: 'x' }, 'ขยะ']) === true);
}

console.log(fail ? `FAIL ${fail} / PASS ${pass}` : `ALL OK (${pass})`);
process.exit(fail ? 1 : 0);
