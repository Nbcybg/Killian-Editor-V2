// test/project-replace.test.cjs — [alpha.156] ค้นหา-แทนที่ทั้งโปรเจกต์ (ตรรกะล้วน)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-project-replace-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'project-replace.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const R = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

check('คำค้นว่าง = ไม่มี matcher', R.buildMatcher('') === null);
check('regex ผิดรูป = null ไม่ throw', R.buildMatcher('(', { regex: true }) === null);
check('regex ที่จับสตริงว่าง = null (กันวนไม่จบ)', R.buildMatcher('a*', { regex: true }) === null);

{
  const r = R.replaceAllInText('มานีไปตลาด มานีซื้อปลา', 'มานี', 'ปิติ');
  check('แทนที่ไทยทุกตำแหน่ง', r.text === 'ปิติไปตลาด ปิติซื้อปลา' && r.count === 2, JSON.stringify(r));
}
{
  const r = R.replaceAllInText('a.b a+b (x)', '.', '!');
  check('อักขระพิเศษของ regex เป็นตัวอักษรธรรมดา', r.text === 'a!b a+b (x)' && r.count === 1, r.text);
  const r2 = R.replaceAllInText('ราคา 10', '10', '$1');
  check('$ ในข้อความแทนที่ (โหมดธรรมดา) เป็นตัวอักษร', r2.text === 'ราคา $1', r2.text);
}
{
  const r = R.replaceAllInText('Anna anna ANNA', 'anna', 'Bea');
  check('ไม่สนตัวพิมพ์ (ค่าเริ่มต้น)', r.count === 3);
  const r2 = R.replaceAllInText('Anna anna ANNA', 'anna', 'Bea', { caseSensitive: true });
  check('สนตัวพิมพ์', r2.count === 1 && r2.text === 'Anna Bea ANNA', r2.text);
}
{
  const r = R.replaceAllInText('cat catalog bobcat cat.', 'cat', 'dog', { wholeWord: true });
  check('ทั้งคำ (ละติน)', r.text === 'dog catalog bobcat dog.' && r.count === 2, r.text);
}
{
  const r = R.replaceAllInText('2026-09-14', '(\\d+)-(\\d+)-(\\d+)', '$3/$2/$1', { regex: true });
  check('โหมด regex รองรับ $1..$n', r.text === '14/09/2026', r.text);
}
{
  const m = R.findMatches('บรรทัดหนึ่ง\nมีมานีอยู่\nมานีอีกที', 'มานี');
  check('findMatches: เจอสองที่ + เลขบรรทัด', m.length === 2 && m[0].line === 2 && m[1].line === 3, JSON.stringify(m));
  check('findMatches: บริบทไม่มีขึ้นบรรทัด', !/\n/.test(m[0].before + m[0].after));
}
{
  const plan = R.planReplace([
    { file: 'a.md', title: 'ก', body: 'มานี มานี' },
    { file: 'b.md', title: 'ข', body: 'ไม่มี' },
    { file: 'c.md', title: 'ค', body: 'มานี', locked: true },
  ], 'มานี');
  check('planReplace: เฉพาะไฟล์ที่เจอ', plan.files.length === 2 && plan.files[0].count === 2);
  check('planReplace: ฉากที่ล็อกไม่นับรวม แต่รายงานแยก', plan.total === 2 && plan.lockedSkipped === 1 && plan.files[1].locked);
}

console.log(`\nproject-replace: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
if (fail) process.exit(1);
