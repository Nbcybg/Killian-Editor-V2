// test/smart-terms.test.cjs — unit test ตัวกรองคำของ SmartType (alpha.58 บั๊ก 1)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-smartterms-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'smart-terms.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── looksLikeTerm: ชื่อจริงต้องผ่าน ──
for (const w of ['ทอร่า', 'แคสซี่', 'นาซาเรน่า', 'สมชาย', 'จักรพรรดิ', 'ประเทศไทย',
                 'Nazarena', 'Frinton-Smith', "O'Brien", 'ห้องนอนชั้นสอง', 'MRS. WU']) {
  check('ชื่อจริงผ่าน: ' + w, S.looksLikeTerm(w) === true);
}
// ── looksLikeTerm: คำมั่วต้องตก ──
for (const w of ['', 'ก', '   ', '123', '!!!', '...', 'กกกกก', 'aaaaa',
                 '่วน', 'ิอะไร', '้ำ', 'ก่้อน', 'กืิด', 'qwrtpzx', 'bcdfgh', 'strng']) {
  check('คำมั่วตก: "' + w + '"', S.looksLikeTerm(w) === false);
}
check('ยาวเกิน 60 ตัว → ตก', S.looksLikeTerm('ก'.repeat(3) + 'า'.repeat(70)) === false);
check('null/undefined ไม่พัง', S.looksLikeTerm(null) === false && S.looksLikeTerm(undefined) === false);

// ── learnMin ──
check('ค่าเริ่มต้น = 2', S.DEFAULT_LEARN_MIN === 2 && S.learnMin(undefined) === 2);
check('หนีบให้อยู่ในช่วง 1–5', S.learnMin(0) === 1 && S.learnMin(99) === 5);
check('รับสตริงตัวเลขได้', S.learnMin('3') === 3);
check('ค่าเพี้ยน → ค่าเริ่มต้น', S.learnMin('abc') === 2);

// ── countTerms ──
const c = S.countTerms(['ทอร่า', 'ทอร่า', 'แคสซี่', '', '  ', 'ทอร่า']);
check('นับจำนวนครั้งถูก', c.get('ทอร่า') === 3 && c.get('แคสซี่') === 1);
check('ข้ามค่าว่าง', !c.has('') && c.size === 2);
check('ตัดช่องว่างหัวท้ายก่อนนับ', S.countTerms([' ทอร่า ', 'ทอร่า']).get('ทอร่า') === 2);

// ── learnedTerms: หัวใจของการแก้บั๊ก ──
const counts = S.countTerms(['ทอร่า', 'ทอร่า', 'แคสซี่', 'พมิมพ์']);
const got = S.learnedTerms(counts, {});
check('เจอ 2 ครั้ง → จำ', got.includes('ทอร่า'));
check('เจอครั้งเดียว → ยังไม่จำ (คำพิมพ์มั่วจึงไม่ติด)',
  !got.includes('พมิมพ์') && !got.includes('แคสซี่'), got.join(','));
check('เรียงจากเจอบ่อยไปน้อย', got[0] === 'ทอร่า');
check('ตั้งเกณฑ์เป็น 1 → จำหมด (พฤติกรรมเดิม)',
  S.learnedTerms(counts, { min: 1 }).length === 3, S.learnedTerms(counts, { min: 1 }).join(','));
check('ชื่อที่มีใน Wiki → จำทันทีแม้เจอครั้งเดียว',
  S.learnedTerms(counts, { known: ['แคสซี่'] }).includes('แคสซี่'));
check('ผู้ใช้กดจำเอง → จำทันที',
  S.learnedTerms(counts, { pinned: ['แคสซี่'] }).includes('แคสซี่'));
check('สั่งไม่จำ → ไม่จำแม้เจอซ้ำ',
  !S.learnedTerms(counts, { ignored: ['ทอร่า'] }).includes('ทอร่า'));
check('สั่งไม่จำชนะการกดจำเอง',
  !S.learnedTerms(counts, { pinned: ['ทอร่า'], ignored: ['ทอร่า'] }).includes('ทอร่า'));
check('เทียบชื่อไม่สนตัวพิมพ์เล็กใหญ่',
  !S.learnedTerms(S.countTerms(['Tora', 'Tora']), { ignored: ['tora'] }).includes('Tora'));
check('คำที่หน้าตาไม่เหมือนชื่อ ตกแม้เจอซ้ำ',
  !S.learnedTerms(S.countTerms(['่วน', '่วน', '่วน']), { min: 1 }).includes('่วน'));
check('รายการว่าง → ไม่พัง', S.learnedTerms(new Map(), {}).length === 0);
check('ส่ง null → ไม่พัง', S.learnedTerms(null, {}).length === 0);

// ── pendingTerms: คำที่รอผู้ใช้ตัดสิน ──
const wait = S.pendingTerms(counts, {});
check('คำที่เจอครั้งเดียวไปอยู่รายการรอ', wait.length === 2, JSON.stringify(wait));
check('รายการรอบอกจำนวนครั้ง', wait.every((w) => w.count === 1));
check('รายการรอบอกว่าหน้าตาเหมือนชื่อไหม', wait.every((w) => typeof w.ok === 'boolean'));
check('คำที่จำแล้วไม่อยู่ในรายการรอ', !wait.some((w) => w.word === 'ทอร่า'));
check('คำที่สั่งไม่จำ ไม่อยู่ในรายการรอ',
  !S.pendingTerms(counts, { ignored: ['แคสซี่'] }).some((w) => w.word === 'แคสซี่'));
check('คำที่กดจำเองแล้ว ไม่อยู่ในรายการรอ',
  !S.pendingTerms(counts, { pinned: ['แคสซี่'] }).some((w) => w.word === 'แคสซี่'));
check('ชื่อที่มีใน Wiki ไม่อยู่ในรายการรอ',
  !S.pendingTerms(counts, { known: ['แคสซี่'] }).some((w) => w.word === 'แคสซี่'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
