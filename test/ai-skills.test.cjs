// test/ai-skills.test.cjs — [alpha.145] ทักษะของผู้ช่วย AI (Skills/*.md)
// ผู้ใช้: *"ไม่มีการใส่ skill.md เลย"*
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-aiskills-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'ai', 'ai-skills.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const K = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

check('โฟลเดอร์ทักษะคือ Skills/', K.SKILL_DIR === 'Skills');
check('id ตัดนามสกุล .md ออก', K.skillId('tone.md') === 'tone' && K.skillId('A.MD') === 'A');

// ── frontmatter ──
const a = K.parseSkillFile('---\nname: โทน\ndescription: คุมโทนภาษา\n---\nเขียนสั้น ๆ\n', 'tone.md');
check('อ่านชื่อจาก frontmatter', a.name === 'โทน', a.name);
check('อ่านคำอธิบายจาก frontmatter', a.description === 'คุมโทนภาษา');
check('เนื้อทักษะไม่มี frontmatter ปน', a.body === 'เขียนสั้น ๆ', JSON.stringify(a.body));
check('id มาจากชื่อไฟล์', a.id === 'tone');
check('นับจำนวนตัวอักษรของเนื้อ', a.chars === 'เขียนสั้น ๆ'.length, a.chars);

const b = K.parseSkillFile('# ห้ามใช้คำเหล่านี้\n- คำ ก\n', 'ban.md');
check('ไม่มี frontmatter → ใช้หัวข้อ # เป็นชื่อ', b.name === 'ห้ามใช้คำเหล่านี้', b.name);
check('หัวข้อยังอยู่ในเนื้อ (โมเดลได้อ่านครบ)', b.body.startsWith('# ห้ามใช้คำเหล่านี้'));

const c = K.parseSkillFile('แค่ข้อความเปล่า ๆ', 'plain.md');
check('ไม่มีทั้ง frontmatter และหัวข้อ → ชื่อ = ชื่อไฟล์', c.name === 'plain');

check('ไฟล์ว่าง = ใช้ไม่ได้', !K.isUsableSkill(K.parseSkillFile('   \n\n', 'empty.md')));
check('ไฟล์มีเนื้อ = ใช้ได้', K.isUsableSkill(a));

// ── ประกอบ prompt ──
const none = K.buildSkillsPrompt([]);
check('ไม่มีทักษะ = ไม่ต่อบรรทัดว่างเปล่า ๆ', none.text === '' && none.chars === 0);

const built = K.buildSkillsPrompt([a, b]);
check('ประกอบ prompt ได้เนื้อของทุกทักษะ',
  built.text.includes('เขียนสั้น ๆ') && built.text.includes('คำ ก'));
check('มีหัวข้อชื่อทักษะคั่นให้โมเดลแยกออก', built.text.includes('## โทน — คุมโทนภาษา'), built.text);
check('รายงานว่าใช้ทักษะไหนบ้าง', built.used.join(',') === 'tone,ban', built.used.join(','));
check('prompt ขึ้นต้นด้วยบรรทัดว่างสองบรรทัด (ต่อท้าย system เดิมได้เลย)',
  built.text.startsWith('\n\n'));

const big = { id: 'big', name: 'ยาว', description: '', body: 'ก'.repeat(5000), chars: 5000 };
const cap = K.buildSkillsPrompt([big, big, big, a], { maxChars: 8000 });
check('★ เกินเพดานแล้วข้ามตัวที่ยัดไม่ลง (ไม่ตัดกลางทักษะ)', cap.skipped.length >= 1, JSON.stringify(cap.skipped));
check('ตัวที่ยัดลงยังอยู่ครบ', cap.used.includes('big'));
check('ความยาวรวมไม่เกินเพดาน', cap.chars <= 8000, cap.chars);
check('ทักษะที่ใช้ไม่ได้ถูกนับเป็น skipped',
  K.buildSkillsPrompt([{ id: 'x', body: '  ' }]).skipped.join(',') === 'x');

// ── ป้ายบนปุ่ม ──
check('ป้ายบอกเปิดกี่ตัวจากทั้งหมด', K.skillsLabel([a, b, c], ['tone']) === '🧩 1/3',
  K.skillsLabel([a, b, c], ['tone']));
check('ไม่ได้เปิดเลย = 0/N', K.skillsLabel([a, b], []) === '🧩 0/2');
check('id ที่ไม่มีจริงไม่ถูกนับ', K.skillsLabel([a], ['ไม่มี']) === '🧩 0/1');

// ── ไฟล์ตัวอย่าง ──
const starter = K.starterSkillMd();
check('ไฟล์ตัวอย่างมี frontmatter ครบ', /^---\n/.test(starter) && starter.includes('description:'));
const ps = K.parseSkillFile(starter, 'skill.md');
check('ไฟล์ตัวอย่างพาร์สกลับได้และใช้ได้จริง', K.isUsableSkill(ps) && !!ps.name, JSON.stringify(ps.name));

// ── ชั้นไฟล์: io ปลอม ──
(async () => {
  const files = { 'Skills': true };
  const io = {
    join: async (...p) => p.join('/'),
    exists: async (p) => p.endsWith('Skills') || p.endsWith('.md'),
    mkdir: async () => true,
    listFiles: async () => ['tone.md', 'note.txt', 'ban.md'],
    readFile: async (p) => (p.endsWith('tone.md')
      ? '---\nname: โทน\n---\nสั้น' : '# แบน\nห้าม'),
  };
  const list = await K.loadSkills('/proj', io);
  check('อ่านเฉพาะไฟล์ .md', list.length === 2, list.map((x) => x.id).join(','));
  check('เรียงตามชื่อแบบไทย', list[0].name.localeCompare(list[1].name, 'th') <= 0,
    list.map((x) => x.name).join(','));
  check('ยังไม่ได้เปิดโปรเจกต์ = คืนรายการว่าง', (await K.loadSkills('', io)).length === 0);
  check('io พัง = คืนรายการว่าง ไม่โยน',
    (await K.loadSkills('/proj', { join: async () => { throw new Error('x'); } })).length === 0);
  check('ensureSkillDir คืนเส้นทางโฟลเดอร์', (await K.ensureSkillDir('/proj', io)) === '/proj/Skills');
  check('ensureSkillDir ไม่มี root = คืนว่าง', (await K.ensureSkillDir('', io)) === '');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
