// test/text-case.test.cjs — unit test การสลับรูปตัวพิมพ์ (alpha.60r2 · ข้อ 2)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-textcase-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'text-case.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const eq = (name, got, want) => check(name + ' → "' + want + '"', got === want, JSON.stringify(got));

// ── ตารางโหมด ──
check('มี 7 โหมดครบตามที่ผู้ใช้ระบุ', S.CASE_MODES.length === 7, S.CASE_MODES.join(','));
for (const m of ['SC', 'lc', 'UC', 'CC', 'aC', 'TC', 'iC']) {
  check('มีโหมด ' + m, S.CASE_MODES.includes(m) && !!S.CASE_LABELS[m] && !!S.CASE_SHORT[m]);
  check('isCaseMode("' + m + '")', S.isCaseMode(m) === true);
}
check('โหมดที่ไม่รู้จักตก', S.isCaseMode('zz') === false && S.isCaseMode('') === false);
check('nextCase วนครบวง', S.nextCase('iC') === 'SC' && S.nextCase('SC') === 'lc');
check('nextCase ค่าเพี้ยน → ตัวแรก', S.nextCase('???') === 'SC');

// ── UC / lc ──
eq('UPPER', S.applyCase('hello World', 'UC'), 'HELLO WORLD');
eq('lower', S.applyCase('HELLO World', 'lc'), 'hello world');

// ── Capitalize Case ──
eq('Capitalize ทุกคำ', S.applyCase('the quick brown fox', 'CC'), 'The Quick Brown Fox');
eq('Capitalize ล้างตัวใหญ่เดิม', S.applyCase('tHE qUICK', 'CC'), 'The Quick');
eq('Capitalize ข้ามเครื่องหมายนำหน้า', S.applyCase('"hello" world', 'CC'), '"Hello" World');

// ── Title Case ──
eq('Title: คำเชื่อมเป็นตัวเล็ก', S.applyCase('the lord of the rings', 'TC'), 'The Lord of the Rings');
eq('Title: คำสุดท้ายต้องตัวใหญ่', S.applyCase('what are you waiting for', 'TC'),
   'What Are You Waiting For');
eq('Title: คำแรกเป็นคำเชื่อมก็ต้องตัวใหญ่', S.applyCase('a tale of two cities', 'TC'),
   'A Tale of Two Cities');
eq('Title: ทำทีละบรรทัด', S.applyCase('the end\nof the road', 'TC'), 'The End\nOf the Road');

// ── Sentence case ──
eq('Sentence: ขึ้นต้นประโยคเดียว', S.applyCase('hello world', 'SC'), 'Hello world');
eq('Sentence: หลายประโยค', S.applyCase('hello world. how are you? fine!', 'SC'),
   'Hello world. How are you? Fine!');
eq('Sentence: ล้างตัวใหญ่กลางประโยค', S.applyCase('HELLO THERE. BYE NOW.', 'SC'),
   'Hello there. Bye now.');
eq('Sentence: ขึ้นบรรทัดใหม่ = ประโยคใหม่', S.applyCase('one thing\ntwo things', 'SC'),
   'One thing\nTwo things');

// ── alternate / inverse ──
eq('aLtErNaTe เริ่มตัวเล็ก', S.applyCase('abcdef', 'aC'), 'aBcDeF');
eq('aLtErNaTe ไม่นับช่องว่างเป็นรอบ', S.applyCase('ab cd', 'aC'), 'aB cD');
eq('iNVERSE สลับทั้งสองทาง', S.applyCase('Hello World', 'iC'), 'hELLO wORLD');
check('iNVERSE สองครั้ง = ของเดิม',
  S.applyCase(S.applyCase('MiXeD CaSe', 'iC'), 'iC') === 'MiXeD CaSe');

// ── ภาษาไทย: ไม่มีตัวพิมพ์ใหญ่/เล็ก ต้องไม่ถูกแตะ ──
const th = 'ทอร่าเดินเข้าห้องครัว';
for (const m of S.CASE_MODES) {
  check('ไทยไม่เปลี่ยนในโหมด ' + m, S.applyCase(th, m) === th, S.applyCase(th, m));
}
eq('ไทยปนอังกฤษ: แตะเฉพาะอังกฤษ', S.applyCase('ทอร่า says hello', 'UC'), 'ทอร่า SAYS HELLO');
eq('Capitalize คำไทยไม่ถูกดัน', S.applyCase('ทอร่า says hello', 'CC'), 'ทอร่า Says Hello');

// ── ค่าขอบ ──
eq('สตริงว่าง', S.applyCase('', 'UC'), '');
eq('null → ว่าง', S.applyCase(null, 'UC'), '');
eq('โหมดไม่รู้จัก → ข้อความเดิม', S.applyCase('Keep Me', 'zz'), 'Keep Me');
check('ตัวเลข/เครื่องหมายไม่เปลี่ยน', S.applyCase('123 !@# 456', 'UC') === '123 !@# 456');

// ── caseTransform กับ state ปลอม (โครงเดียวกับ ProseMirror) ──
// doc จำลอง: text node เดียว "hello world" ที่ตำแหน่ง 1
function fakeState(runs, from, to) {
  const applied = [];
  let pos = 1;
  const nodes = runs.map((r) => {
    const n = { isText: true, text: r.text, marks: r.marks || [], nodeSize: r.text.length, _pos: pos };
    pos += r.text.length;
    return n;
  });
  const tr = {
    replaceWith(f, t, node) { applied.push({ from: f, to: t, text: node.text, marks: node.marks }); return tr; },
    scrollIntoView() { return tr; },
  };
  return {
    applied,
    selection: { from, to, empty: from >= to },
    doc: { nodesBetween(f, t, fn) { for (const n of nodes) fn(n, n._pos); } },
    get tr() { return tr; },
    schema: { text: (txt, marks) => ({ text: txt, marks: marks || [] }) },
  };
}

{
  const st = fakeState([{ text: 'hello world' }], 1, 12);
  const tr = S.caseTransform(st, 'UC');
  check('caseTransform: คืน transaction เมื่อมีอะไรเปลี่ยน', !!tr);
  check('caseTransform: แทนที่ช่วงที่เลือกด้วยตัวใหญ่',
    st.applied.length === 1 && st.applied[0].text === 'HELLO WORLD', JSON.stringify(st.applied));
}
{
  const st = fakeState([{ text: 'ABC' }], 1, 4);
  check('caseTransform: ไม่มีอะไรเปลี่ยน → คืน null', S.caseTransform(st, 'UC') === null);
}
{
  const st = fakeState([{ text: 'abc' }], 1, 1);
  check('caseTransform: ไม่ได้เลือกอะไร → คืน null', S.caseTransform(st, 'UC') === null);
}
{
  const st = fakeState([{ text: 'abc' }], 1, 4);
  check('caseTransform: โหมดไม่รู้จัก → คืน null', S.caseTransform(st, 'nope') === null);
}
{
  // ข้อความคร่อมสองรูปแบบ (ตัวหนา/ธรรมดา) — marks เดิมต้องอยู่ครบทุกท่อน
  const st = fakeState([{ text: 'hello ', marks: [] }, { text: 'world', marks: ['strong'] }], 1, 12);
  S.caseTransform(st, 'UC');
  check('caseTransform: แทนที่ทุกท่อนของช่วงที่เลือก', st.applied.length === 2, st.applied.length);
  const strongPiece = st.applied.find((x) => x.text === 'WORLD');
  check('caseTransform: marks เดิมไม่หาย (ตัวหนายังหนา)',
    !!strongPiece && strongPiece.marks[0] === 'strong', JSON.stringify(st.applied));
  check('caseTransform: แทนที่จากท้ายมาหน้า (ตำแหน่งไม่เลื่อน)',
    st.applied[0].from > st.applied[1].from, JSON.stringify(st.applied.map((x) => x.from)));
}
{
  // Sentence case ต้องมองข้ามรอยต่อของ mark — "hello. world" ที่ถูกตัดเป็น 2 ท่อน
  const st = fakeState([{ text: 'hello. wor' }, { text: 'ld' }], 1, 13);
  S.caseTransform(st, 'SC');
  const joined = st.applied.slice().sort((a, b) => a.from - b.from).map((x) => x.text).join('');
  // ท่อนที่ 2 ("ld") ไม่เปลี่ยน จึงไม่ถูกแทนที่ — ท่อนแรกต้องได้ทั้ง "H" ต้นประโยคและ "W" หลังจุด
  check('caseTransform: Sentence case ข้ามรอยต่อ mark ได้', joined === 'Hello. Wor', joined);
  check('caseTransform: ท่อนที่ไม่เปลี่ยนไม่ถูกแทนที่ซ้ำ', st.applied.length === 1, st.applied.length);
}
{
  const st = fakeState([{ text: 'the lord of the rings' }], 1, 22);
  S.caseTransform(st, 'TC');
  check('caseTransform: Title case ผ่าน selection', st.applied[0].text === 'The Lord of the Rings',
    st.applied[0] && st.applied[0].text);
}

// ── selectedTextRanges ──
{
  const st = fakeState([{ text: 'abcdef' }], 3, 5);
  const r = S.selectedTextRanges(st);
  check('selectedTextRanges: ตัดเฉพาะช่วงที่เลือก',
    r.length === 1 && r[0].text === 'cd', JSON.stringify(r));
  check('selectedTextRanges: ไม่ได้เลือก → ว่าง', S.selectedTextRanges(fakeState([{ text: 'a' }], 1, 1)).length === 0);
  check('selectedTextRanges: state ว่างไม่พัง', S.selectedTextRanges({}).length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
