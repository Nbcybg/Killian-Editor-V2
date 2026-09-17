// test/project-doctor.test.cjs — [alpha.156] ตรวจสุขภาพโปรเจกต์ (ตัววินิจฉัยบริสุทธิ์) + กู้ frontmatter
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-project-doctor-test.cjs');
esbuild.buildSync({ stdin: { contents: "export * from './src/project-doctor.js'; export { repairFrontmatter, parseMdFile, dumpMdFile } from './src/md.js';",
  resolveDir: path.join(__dirname, '..') }, outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const D = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 400) : '')); }
}
const types = (list) => list.map((x) => x.type);

// ── repairFrontmatter ──
{
  const ok = D.dumpMdFile({ title: 'ฉาก', synopsis: 'บรรทัดแรก\nบรรทัดสอง' }, 'เนื้อ');
  check('ไฟล์ที่เขียนด้วยตัวใหม่ = ไม่ต้องกู้', D.repairFrontmatter(ok).changed === false);
  const plain = '---\ntitle: ท\ntype: scene\n---\nabc';
  const r0 = D.repairFrontmatter(plain);
  check('ไฟล์ปกติ = ข้อความเดิมทุกไบต์', r0.changed === false && r0.text === plain);
  check('ไม่มี frontmatter = ไม่แตะ', D.repairFrontmatter('เนื้อเฉย ๆ\n---\nx').changed === false);

  // อาการ 1: ค่าหลายบรรทัดจากตัวเขียนเดิม
  const broken1 = '---\ntitle: ฉาก\nsynopsis: บรรทัดแรก\nบรรทัดสอง\nบรรทัดสาม\npov: มานี\n---\nเนื้อฉาก';
  check('(ยืนยันบั๊กเดิม) parseMdFile อ่านได้แค่บรรทัดแรก', D.parseMdFile(broken1).meta.synopsis === 'บรรทัดแรก');
  const r1 = D.repairFrontmatter(broken1);
  const p1 = D.parseMdFile(r1.text);
  check('กู้ค่าหลายบรรทัดกลับมาครบ', r1.changed && p1.meta.synopsis === 'บรรทัดแรก\nบรรทัดสอง\nบรรทัดสาม', JSON.stringify(p1.meta));
  check('คีย์หลังค่าหลายบรรทัดยังอยู่', p1.meta.pov === 'มานี' && p1.body === 'เนื้อฉาก', JSON.stringify(p1));
  check('บอกว่ากู้คีย์ไหน', r1.recovered.includes('synopsis'));

  // อาการ 2: frontmatter จบก่อนเวลา (เรื่องย่อมีบรรทัด ---)
  const broken2 = '---\ntitle: ฉาก\nsynopsis: ต้น\nกลาง\n---\nnote: โน้ต\npov: มานี\n---\nเนื้อจริง\n\nย่อหน้าสอง';
  check('(ยืนยันบั๊กเดิม) คีย์ไหลลงเนื้อฉาก', D.parseMdFile(broken2).body.startsWith('note: โน้ต'));
  const p2 = D.parseMdFile(D.repairFrontmatter(broken2).text);
  check('กู้: เนื้อฉากสะอาด', p2.body === 'เนื้อจริง\n\nย่อหน้าสอง', JSON.stringify(p2.body));
  check('กู้: คีย์กลับเข้าหัวไฟล์ครบ', p2.meta.note === 'โน้ต' && p2.meta.pov === 'มานี' && p2.meta.title === 'ฉาก', JSON.stringify(p2.meta));
  check('กู้: ข้อความในเรื่องย่อไม่หาย', /ต้น/.test(p2.meta.synopsis) && /กลาง/.test(p2.meta.synopsis), JSON.stringify(p2.meta.synopsis));

  // เนื้อฉากที่ขึ้นต้นด้วย "Chapter: หนึ่ง" + มีเส้น --- ในเนื้อ = ไม่ใช่อาการ 2 (คีย์ไม่รู้จัก)
  const legit = '---\ntitle: ฉาก\n---\nChapter: One\n\n---\n\nต่อ';
  check('เนื้อที่มีเส้นคั่น + บรรทัดคล้ายคีย์ ไม่ถูกดูดเป็น frontmatter', D.repairFrontmatter(legit).changed === false);
  // คอมเมนต์ท้ายไฟล์ต้องรอด
  const withCm = broken1 + '\n\n<!-- k2-comments\n[{"id":"c1"}]\n-->\n';
  const rc = D.repairFrontmatter(withCm);
  check('กู้แล้วบล็อกคอมเมนต์ท้ายไฟล์ยังอยู่', rc.changed && rc.text.includes('<!-- k2-comments') && rc.text.includes('"c1"'), rc.text);
  check('กู้ \\r\\n ได้', D.repairFrontmatter(broken1.replace(/\n/g, '\r\n')).changed === true);
}

// ── diagnoseDraft ──
const base = () => ({
  dPath: 'D', label: 'เล่ม / ร่าง',
  draft: { chapters: [
    { guid: 'c1', title: 'บท 1', order: 1, folderName: '01 - บท 1' },
    { guid: 'c2', title: 'บท 2', order: 2, folderName: '02 - บท 2' },
  ] },
  scenes: { chapters: {
    c1: [{ id: 's1', title: 'หนึ่ง', fileName: 'scene-01.md' }, { id: 's2', title: 'สอง', fileName: 'scene-02.md' }],
    c2: [{ id: 's3', title: 'สาม', fileName: 'scene-01.md' }],
  } },
  folders: ['01 - บท 1', '02 - บท 2'],
  files: { '01 - บท 1': ['scene-01.md', 'scene-02.md'], '02 - บท 2': ['scene-01.md'] },
  texts: {
    '01 - บท 1/scene-01.md': '---\ntitle: หนึ่ง\n---\nx',
    '01 - บท 1/scene-02.md': '---\ntitle: สอง\n---\nx',
    '02 - บท 2/scene-01.md': '---\ntitle: สาม\n---\nx',
  },
});
{
  check('โปรเจกต์สุขภาพดี = ไม่มีปัญหา', D.diagnoseDraft(base()).length === 0, JSON.stringify(D.diagnoseDraft(base())));
  check('ชื่อไฟล์เดียวกันคนละบท ไม่ใช่ปัญหา', !types(D.diagnoseDraft(base())).includes('duplicate-ref'));
}
{
  const s = base();
  s.scenes.chapters.c1.push({ id: 's9', title: 'ฉากใหม่ที่ทับ', fileName: 'scene-02.md' });
  const is = D.diagnoseDraft(s);
  const dup = is.find((x) => x.type === 'duplicate-ref');
  check('สองแถวชี้ไฟล์เดียวกัน = duplicate-ref ของแถวหลัง', dup && dup.rowId === 's9' && dup.other === 'สอง' && dup.fix.kind === 'split-copy', JSON.stringify(is));
}
{
  const s = base();
  s.files['01 - บท 1'] = ['scene-01.md', 'scene-02.md', 'scene-03.md'];
  s.texts['01 - บท 1/scene-03.md'] = '---\ntitle: ฉากกำพร้า\n---\nเนื้อ';
  const o = D.diagnoseDraft(s).find((x) => x.type === 'orphan-file');
  check('ไฟล์ไม่มีแถวอ้าง = orphan-file + ชื่อจาก frontmatter', o && o.file === 'scene-03.md' && o.title === 'ฉากกำพร้า' && o.chGuid === 'c1' && o.fix.kind === 'attach-row', JSON.stringify(o));
}
{
  const s = base();
  s.files['01 - บท 1'] = ['scene-01.md'];
  delete s.texts['01 - บท 1/scene-02.md'];
  const m = D.diagnoseDraft(s).find((x) => x.type === 'missing-file');
  check('แถวที่ไฟล์หาย = missing-file', m && m.rowId === 's2' && m.fix.kind === 'create-file', JSON.stringify(m));
}
{
  const s = base();
  s.folders.push('03 - บทที่ถูกลบ');
  s.files['03 - บทที่ถูกลบ'] = ['scene-01.md'];
  const g = D.diagnoseDraft(s).find((x) => x.type === 'ghost-folder');
  check('โฟลเดอร์ไม่อยู่ในทะเบียน = ghost-folder', g && g.folder === '03 - บทที่ถูกลบ' && g.fix.title === 'บทที่ถูกลบ' && !g.chGuid, JSON.stringify(g));
}
{
  // บทหลุดจากทะเบียน แต่แถวของมันยังอยู่ และโฟลเดอร์ก็ยังอยู่ → ผูกกลับด้วย guid เดิม
  const s = base();
  s.draft.chapters = s.draft.chapters.filter((c) => c.guid !== 'c2');
  const is = D.diagnoseDraft(s);
  const g = is.find((x) => x.type === 'ghost-folder');
  check('โฟลเดอร์ผีที่มีไฟล์ของแถวค้างครบ → ผูกกลับ guid เดิม', g && g.fix.chGuid === 'c2', JSON.stringify(is));
  check('และไม่รายงาน rows-without-chapter ซ้ำ', !types(is).includes('rows-without-chapter'));
}
{
  const s = base();
  s.scenes.chapters.zz = [{ id: 'x', fileName: 'หาย.md' }];
  const r = D.diagnoseDraft(s).find((x) => x.type === 'rows-without-chapter');
  check('แถวของบทที่ไม่มีทั้งทะเบียนและโฟลเดอร์ = รายงานอย่างเดียว', r && r.fix === null && r.count === 1);
}
{
  const s = base();
  s.folders = ['01 - บท 1'];
  delete s.files['02 - บท 2'];
  const is = D.diagnoseDraft(s);
  check('บทที่โฟลเดอร์หาย = missing-folder + missing-file ของแถว', types(is).includes('missing-folder') && types(is).includes('missing-file'), types(is).join(','));
}
{
  const s = base();
  s.texts['01 - บท 1/scene-01.md'] = '---\ntitle: หนึ่ง\nsynopsis: ก\nข\n---\nx';
  const f = D.diagnoseDraft(s).find((x) => x.type === 'frontmatter');
  check('frontmatter พัง = frontmatter + ชี้ไฟล์ถูก', f && f.folder === '01 - บท 1' && f.file === 'scene-01.md' && f.keys.includes('synopsis'), JSON.stringify(f));
}
{
  const s = base(); s.scenes = null;
  const is = D.diagnoseDraft(s);
  check('scenes.json อ่านไม่ได้ = bad-json มาก่อนสุด', is[0].type === 'bad-json' && is[0].file === 'scenes.json' && is[0].fix === null);
  const s2 = base();
  s2.scenes.chapters.c1.push({ id: 's9', fileName: 'scene-02.md' });
  s2.files['01 - บท 1'].push('ร้าง.md');
  s2.folders.push('99 - ผี');
  const order = types(D.diagnoseDraft(s2));
  check('เรียงตามความรุนแรง', order.indexOf('duplicate-ref') < order.indexOf('ghost-folder') && order.indexOf('ghost-folder') < order.indexOf('orphan-file'), order.join(','));
  check('summarize นับตามชนิด', D.summarize(D.diagnoseDraft(s2))['orphan-file'] === 1);
}
{
  const r = D.newSceneRow({ id: 'n1', title: '', fileName: 'scene-07.md', chGuid: 'c1', order: 4 });
  check('newSceneRow โครงเดียวกับ addScene', r.title === 'scene-07' && r.order === 4 && r.chapterGuid === 'c1' && r.wordCount === 0);
  const c = D.newChapterEntry({ guid: 'g', title: 'x', folderName: '05 - x', order: 5 });
  check('newChapterEntry โครงเดียวกับ addChapter', c.status === 'Outline' && c.act === 'I' && c.folderName === '05 - x');
}

console.log(`\nproject-doctor: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
if (fail) process.exit(1);
