// test/import-fountain.test.cjs — [alpha.169 · bug hunt] Fountain มาตรฐาน → ไวยากรณ์ของ Killian
// ที่มา: นำเข้าไฟล์ .fountain ตามสเปกบนแอปจริงแล้วอ่านพรีวิว — โน้ต `[[…]]` กลายเป็นลิงก์ Wiki ·
// boneyard กลับมาเป็นบรรยาย · `> กึ่งกลาง <` มี `<` ค้าง · `ชื่อ ^` นับเป็นตัวละครอีกคน
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name + '-impf-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const IF = load('import-fountain');
const F = load('fountain');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const SRC = [
  'INT. BAKERY - NIGHT',
  '',
  'TORA walks in. [[writer note]] He looks around.',
  '',
  'TORA',
  '(whispering)',
  'Is anyone here?',
  '',
  '/* this block',
  'is boneyard */',
  '',
  '> THE END <',
  '',
  '~Willy Wonka!',
  '',
  '===',
  '',
  'STEEL ^',
  'dual line',
  '',
  '[[a note',
  'over two lines]]',
  '',
  'x^2^ stays',
].join('\r\n');

const out = IF.fountainToK2(SRC, { notes: true });
const L = out.split('\n');
check('boneyard หายทั้งบล็อก (หลายบรรทัด)', !/boneyard|this block/.test(out), out);
check('★ โน้ตกลางบรรทัด → ถอดออกจากบรรยาย แล้วเป็นบรรทัดโน้ตของโปรแกรม',
      L.includes('TORA walks in. He looks around.') && L.includes('/// writer note'), out);
check('โน้ตคร่อมสองบรรทัด → โน้ตบรรทัดเดียว', L.includes('/// a note over two lines'), out);
check('★ กึ่งกลาง `> x <` → บรรยาย (ไม่มี > < ค้าง)', L.includes('!THE END') && !/>\s*THE END|THE END\s*</.test(out), out);
check('เนื้อเพลง `~x` → ตัวเอียง', L.includes('!*Willy Wonka!*'), out);
check('ขึ้นหน้าใหม่ `===` → `---`', L.includes('---') && !L.includes('==='), out);
check('★ บทพูดคู่: ชื่อไม่มี ^ ค้าง', L.includes('STEEL') && !L.includes('STEEL ^'), out);
check('ตัวยก `x^2^` ไม่ถูกแตะ', L.includes('x^2^ stays'), out);
check('ไม่มี \\r ค้าง', !out.includes('\r'));
check('รอยตัด boneyard ไม่ทิ้งบรรทัดว่างซ้อน', !/\n\n\n/.test(out), JSON.stringify(out));
check('boneyard กลางบรรทัด: ข้อความรอบ ๆ ยังอยู่', IF.fountainToK2('ก /* ตัด */ ข') === 'ก  ข');
check('ไม่ส่ง notes = `[[…]]` คงเดิม (ไฟล์ .txt ของโปรแกรมเอง = ลิงก์เอนทิตี้)',
      IF.fountainToK2('พบ [[โทระ]] ที่ตลาด', {}) === 'พบ [[โทระ]] ที่ตลาด');
check('ค่าว่าง/null ไม่พัง', IF.fountainToK2('') === '' && IF.fountainToK2(null) === '');

// เดินต่อเข้าตัวอ่านบทตัวจริง — ผลที่ผู้ใช้เห็นในกล่องพรีวิว
const els = F.parseScript(out).filter((b) => b.el !== 'blank');
const by = (el) => els.filter((b) => b.el === el).map((b) => b.text);
check('★ ตัวละครมีสองคน (TORA · STEEL) — ไม่มี "STEEL ^"', JSON.stringify(by('character')) === JSON.stringify(['TORA', 'STEEL']), JSON.stringify(by('character')));
check('★ โน้ตเป็นธาตุ note สองใบ', by('note').length === 2 && by('note')[0] === 'writer note', JSON.stringify(by('note')));
check('วงเล็บมาตรฐาน `(whispering)` ใต้ชื่อ = วงเล็บ', by('parenthetical')[0] === '(whispering)', JSON.stringify(by('parenthetical')));
check('กึ่งกลาง/เนื้อเพลง เป็นบรรยาย', by('action').includes('THE END') && by('action').includes('*Willy Wonka!*'), JSON.stringify(by('action')));
check('มีธาตุขึ้นหน้าใหม่หนึ่งใบ', by('page-break').length === 1);
check('ไม่มีธาตุไหนมีข้อความ boneyard', !els.some((b) => /boneyard/.test(b.text)));
check('หัวฉากยังเป็นหัวฉาก', by('scene')[0] === 'INT. BAKERY - NIGHT', JSON.stringify(by('scene')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
