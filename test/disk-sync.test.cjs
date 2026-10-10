// test/disk-sync.test.cjs — [alpha.170] ชื่อบนดิสก์ ↔ ทะเบียน JSON บนระบบไฟล์จำลอง
//   · เปลี่ยนชื่อในโปรแกรม = ไฟล์/โฟลเดอร์ย้ายตาม   · เปลี่ยนชื่อจาก OS = ทะเบียนตามชื่อใหม่
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-disk-sync-test.cjs');
esbuild.buildSync({ stdin: { contents: "export * from './src/disk-sync.js'; export { parseMdFile, dumpMdFile } from './src/md.js';",
  resolveDir: path.join(__dirname, '..') }, outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const S = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 500) : '')); }
}

// ── ระบบไฟล์จำลอง (ไม่สนตัวพิมพ์แบบ Windows · จำชื่อจริงไว้) ──
function memfs() {
  const files = new Map();          // key(lower) → { path, text }
  const dirs = new Map();           // key(lower) → path
  const k = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  const mkdir = (p) => { const parts = norm(p).split('/'); for (let i = 1; i <= parts.length; i++) { const d = parts.slice(0, i).join('/'); if (d && !dirs.has(k(d))) dirs.set(k(d), d); } };
  const io = {
    join: async (...a) => a.filter((x) => x !== '').join('/'),
    exists: async (p) => files.has(k(p)) || dirs.has(k(p)),
    readFile: async (p) => { const f = files.get(k(p)); if (!f) { const e = new Error('ENOENT ' + p); e.code = 'ENOENT'; throw e; } return f.text; },
    writeFile: async (p, text) => { mkdir(norm(p).split('/').slice(0, -1).join('/')); const old = files.get(k(p)); files.set(k(p), { path: old ? old.path : norm(p), text: String(text) }); return true; },
    readJson: async (p) => JSON.parse(await io.readFile(p)),
    copyFile: async (a, b) => io.writeFile(b, await io.readFile(a)),
    mkdir: async (p) => { mkdir(p); return true; },
    listDirs: async (p) => [...dirs.values()].filter((d) => k(d).startsWith(k(p) + '/') && !norm(d).slice(norm(p).length + 1).includes('/')).map((d) => d.split('/').pop()),
    listFiles: async (p, ext) => [...files.values()].filter((f) => k(f.path).startsWith(k(p) + '/') && !f.path.slice(norm(p).length + 1).includes('/'))
      .map((f) => f.path.split('/').pop()).filter((n) => !ext || n.endsWith(ext)),
    move: async (src, dst) => {
      const s = norm(src), d = norm(dst);
      if (k(s) !== k(d) && (files.has(k(d)) || dirs.has(k(d)))) throw new Error('EEXIST ' + dst);
      mkdir(d.split('/').slice(0, -1).join('/'));
      if (files.has(k(s))) { const f = files.get(k(s)); files.delete(k(s)); files.set(k(d), { path: d, text: f.text }); return true; }
      if (!dirs.has(k(s))) throw new Error('ENOENT ' + src);
      const mvF = [...files.entries()].filter(([kk]) => kk.startsWith(k(s) + '/'));
      const mvD = [...dirs.entries()].filter(([kk]) => kk === k(s) || kk.startsWith(k(s) + '/'));
      for (const [kk] of mvF) files.delete(kk);
      for (const [kk] of mvD) dirs.delete(kk);
      for (const [, f] of mvF) { const np = d + f.path.slice(s.length); files.set(k(np), { path: np, text: f.text }); }
      for (const [, dp] of mvD) { const np = d + dp.slice(s.length); dirs.set(k(np), np); }
      return true;
    },
  };
  return { io, files, dirs, has: (p) => files.has(k(p)) || dirs.has(k(p)), text: (p) => (files.get(k(p)) || {}).text, real: (p) => (files.get(k(p)) || {}).path || dirs.get(k(p)) };
}
const md = (title, body = 'เนื้อ') => S.dumpMdFile({ title, type: 'scene', format: 'prose' }, body);
const J = (v) => JSON.stringify(v, null, 2);

/** โปรเจกต์รุ่นเก่า: เล่มหนึ่ง / 01 - บทที่หนึ่ง / scene-01.md (ชื่อเรื่อง "ตลาดเก่า") */
async function legacy() {
  const m = memfs(); const io = m.io;
  await io.writeFile('R/project.khn.json', J({ title: 'p' }));
  await io.writeFile('R/เล่มหนึ่ง/section.json', J({ guid: 's1', title: 'เล่มหนึ่ง', order: 1 }));
  const dr = 'R/เล่มหนึ่ง/Draft/default';
  await io.writeFile(dr + '/draft.json', J({ chapters: [{ guid: 'c1', title: 'บทที่หนึ่ง', order: 1, folderName: '01 - บทที่หนึ่ง' }] }));
  await io.writeFile(dr + '/scenes.json', J({ chapters: { c1: [
    { id: 'a', title: 'ตลาดเก่า', order: 1, fileName: 'scene-01.md' }, { id: 'b', title: 'ท่าเรือ', order: 2, fileName: 'scene-02.md' }] } }));
  await io.writeFile(dr + '/Chapters/01 - บทที่หนึ่ง/scene-01.md', md('ตลาดเก่า', 'เนื้อตลาด'));
  await io.writeFile(dr + '/Chapters/01 - บทที่หนึ่ง/scene-02.md', md('ท่าเรือ', 'เนื้อท่าเรือ'));
  await io.mkdir('R/Wiki');
  return { m, io, dr };
}
/** โปรเจกต์รุ่นใหม่: ชื่อบนดิสก์ = ชื่อเรื่อง */
async function modern() {
  const m = memfs(); const io = m.io;
  await io.writeFile('R/Book 1/section.json', J({ guid: 's1', title: 'Book 1', order: 1, folderName: 'Book 1' }));
  const dr = 'R/Book 1/Draft/default';
  await io.writeFile(dr + '/draft.json', J({ chapters: [
    { guid: 'c1', title: 'บทนำ', order: 1, folderName: 'บทนำ' }, { guid: 'c2', title: 'ภาคสอง', order: 2, folderName: 'ภาคสอง' }] }));
  await io.writeFile(dr + '/scenes.json', J({ chapters: {
    c1: [{ id: 'a', title: 'ตลาดเก่า', order: 1, fileName: 'ตลาดเก่า.md' }, { id: 'b', title: 'ท่าเรือ', order: 2, fileName: 'ท่าเรือ.md' }],
    c2: [{ id: 'c', title: 'กลับบ้าน', order: 1, fileName: 'กลับบ้าน.md' }] } }));
  await io.writeFile(dr + '/Chapters/บทนำ/ตลาดเก่า.md', md('ตลาดเก่า', 'เนื้อตลาด'));
  await io.writeFile(dr + '/Chapters/บทนำ/ตลาดเก่า_vis.csv', 'shot,desc');
  await io.writeFile(dr + '/Chapters/บทนำ/ท่าเรือ.md', md('ท่าเรือ'));
  await io.writeFile(dr + '/Chapters/ภาคสอง/กลับบ้าน.md', md('กลับบ้าน'));
  return { m, io, dr };
}
const rows = async (io, dr, g) => (await io.readJson(dr + '/scenes.json')).chapters[g];
const chs = async (io, dr) => (await io.readJson(dr + '/draft.json')).chapters;

(async () => {
  // ══ ชื่อที่ว่างจริง ══
  {
    const { io, dr } = await modern();
    check('ชื่อไฟล์ฉากใหม่ = ชื่อฉาก', (await S.freeSceneFile(io, dr, 'บทนำ', 'ฉากใหม่')) === 'ฉากใหม่.md');
    check('ชนไฟล์บนดิสก์ → ต่อ 2', (await S.freeSceneFile(io, dr, 'บทนำ', 'ตลาดเก่า')) === 'ตลาดเก่า 2.md');
    check('ชนชื่อที่แถวจองไว้ (ไฟล์หาย) → ต่อ 2', (await S.freeSceneFile(io, dr, 'บทนำ', 'ผี', ['ผี.md'])) === 'ผี 2.md');
    check('ชื่อของตัวเองไม่นับว่าชน', (await S.freeSceneFile(io, dr, 'บทนำ', 'ตลาดเก่า', [], 'ตลาดเก่า.md')) === 'ตลาดเก่า.md');
    check('โฟลเดอร์บทใหม่ = ชื่อบท ไม่มีเลขนำ', (await S.freeChapterFolder(io, dr, 'บทส่งท้าย')) === 'บทส่งท้าย');
    check('โฟลเดอร์บทชน → ต่อ 2', (await S.freeChapterFolder(io, dr, 'บทนำ')) === 'บทนำ 2');
    const b0 = await S.freeBookName(io, 'R');
    check('★ ชื่อเล่มเริ่มต้นถัดไป = Book 2 (อังกฤษ · ตรงกับโฟลเดอร์)', b0.title === 'Book 2' && b0.folder === 'Book 2', JSON.stringify(b0));
    const b1 = await S.freeBookName(io, 'R', 'ภาคพิเศษ');
    check('ชื่อเล่มที่ไม่ชน = ชื่อเรื่องตรงกับโฟลเดอร์', b1.title === 'ภาคพิเศษ' && b1.folder === 'ภาคพิเศษ' && !b1.taken);
    const b2 = await S.freeBookName(io, 'R', 'book 1');
    check('★ ชื่อเล่มชน (ไม่สนตัวพิมพ์) → ต่อเลขทั้งชื่อเรื่องและโฟลเดอร์', b2.taken && b2.folder === 'book 1 2' && b2.title === 'book 1 2', JSON.stringify(b2));
    const bp = await S.freeBookName(io, 'R', 'Planners');
    check('★ ตั้งชื่อเล่มว่า "Planners" (ยังไม่มีโฟลเดอร์นั้น) → ถือว่าชน · ทางอัตโนมัติได้ "Planners 2" ทั้งชื่อและโฟลเดอร์', bp.taken && bp.folder === 'Planners 2' && bp.title === 'Planners 2', JSON.stringify(bp));
    const b3 = await S.freeBookName(io, 'R', 'Wiki');
    check('★ ชื่อเล่มชนโฟลเดอร์ของโปรแกรม (Wiki) → ไม่ยึด', b3.taken && b3.folder === 'Wiki 2');
  }

  // ══ เปลี่ยนชื่อในโปรแกรม: ฉาก ══
  {
    const { m, io, dr } = await modern();
    const ch = { guid: 'c1', folderName: 'บทนำ' };
    check('ต้องย้ายไฟล์ไหม: ชื่อใหม่ → ใช่', (await S.sceneRenameTarget(io, dr, ch, 'a', 'ตลาดใหม่')) === 'ตลาดใหม่.md');
    check('ต้องย้ายไฟล์ไหม: ชื่อเดิม → ไม่', (await S.sceneRenameTarget(io, dr, ch, 'a', 'ตลาดเก่า')) === '');
    const r = await S.renameSceneOnDisk(io, dr, ch, 'a', 'ตลาดใหม่');
    check('★ เปลี่ยนชื่อฉาก → ไฟล์ย้ายตามชื่อ', r.ok && r.moved && m.has(dr + '/Chapters/บทนำ/ตลาดใหม่.md') && !m.has(dr + '/Chapters/บทนำ/ตลาดเก่า.md'), JSON.stringify(r));
    const row = (await rows(io, dr, 'c1')).find((x) => x.id === 'a');
    check('★ ทะเบียนได้ทั้งชื่อเรื่องและชื่อไฟล์ใหม่ · ลำดับเดิม', row.title === 'ตลาดใหม่' && row.fileName === 'ตลาดใหม่.md' && row.order === 1);
    check('frontmatter ได้ชื่อใหม่ · เนื้อเดิม', S.parseMdFile(m.text(dr + '/Chapters/บทนำ/ตลาดใหม่.md')).meta.title === 'ตลาดใหม่'
      && S.parseMdFile(m.text(dr + '/Chapters/บทนำ/ตลาดใหม่.md')).body.includes('เนื้อตลาด'));
    check('★ ตารางเล่าด้วยภาพย้ายตามไฟล์ฉาก', m.has(dr + '/Chapters/บทนำ/ตลาดใหม่_vis.csv') && !m.has(dr + '/Chapters/บทนำ/ตลาดเก่า_vis.csv'));

    const r2 = await S.renameSceneOnDisk(io, dr, ch, 'a', 'ท่าเรือ');
    check('★ ชื่อชนกับฉากอื่นในบท → ไฟล์ได้เลขกันชน ชื่อเรื่องตามที่พิมพ์', r2.ok && r2.fileName === 'ท่าเรือ 2.md'
      && (await rows(io, dr, 'c1')).find((x) => x.id === 'a').title === 'ท่าเรือ' && m.text(dr + '/Chapters/บทนำ/ท่าเรือ.md').includes('ท่าเรือ'));

    const r3 = await S.renameSceneOnDisk(io, dr, ch, 'a', 'บทที่ 1: เริ่ม?');
    check('ชื่อมีอักขระต้องห้าม → ชื่อเรื่องครบ · ชื่อไฟล์ถอดแล้ว', r3.fileName === 'บทที่ 1 เริ่ม.md'
      && (await rows(io, dr, 'c1')).find((x) => x.id === 'a').title === 'บทที่ 1: เริ่ม?');
    const r3b = await S.renameSceneOnDisk(io, dr, ch, 'a', 'บทที่ 1: เริ่ม?');
    check('ตั้งชื่อเดิมซ้ำ = ไม่ย้ายไฟล์', r3b.ok && !r3b.moved);

    const before = JSON.stringify(await rows(io, dr, 'c2'));
    await io.move(dr + '/Chapters/ภาคสอง/กลับบ้าน.md', dr + '/Chapters/ภาคสอง/x.tmp');
    const r4 = await S.renameSceneOnDisk(io, dr, { guid: 'c2', folderName: 'ภาคสอง' }, 'c', 'ชื่อใหม่');
    check('★ ไฟล์ฉากหาย → ไม่แตะทะเบียน (ชื่อในทะเบียนกับในไฟล์ไม่แยกทาง)', !r4.ok && JSON.stringify(await rows(io, dr, 'c2')) === before);
  }
  {
    const { m, io, dr } = await legacy();
    const ch = { guid: 'c1', folderName: '01 - บทที่หนึ่ง' };
    const r = await S.renameSceneOnDisk(io, dr, ch, 'a', 'ตลาดเช้า');
    check('★ ฉากรุ่นเก่า (scene-01.md) เปลี่ยนชื่อ → ไฟล์ได้ชื่อจริง', r.moved && m.has(dr + '/Chapters/01 - บทที่หนึ่ง/ตลาดเช้า.md'));
  }

  // ══ เปลี่ยนชื่อในโปรแกรม: บท ══
  {
    const { m, io, dr } = await modern();
    const r = await S.renameChapterOnDisk(io, dr, 'c1', 'อารัมภบท');
    check('★ เปลี่ยนชื่อบท → โฟลเดอร์ย้าย ไฟล์ข้างในตามไป', r.ok && r.moved && m.has(dr + '/Chapters/อารัมภบท/ตลาดเก่า.md') && !m.has(dr + '/Chapters/บทนำ'));
    const c = (await chs(io, dr)).find((x) => x.guid === 'c1');
    check('★ draft.json ได้ชื่อบท + โฟลเดอร์ใหม่ · ลำดับเดิม', c.title === 'อารัมภบท' && c.folderName === 'อารัมภบท' && c.order === 1);
    const r2 = await S.renameChapterOnDisk(io, dr, 'c1', 'ภาคสอง');
    check('ชื่อบทชนกับบทอื่น → โฟลเดอร์ได้เลขกันชน', r2.folderName === 'ภาคสอง 2' && m.has(dr + '/Chapters/ภาคสอง 2/ตลาดเก่า.md') && m.has(dr + '/Chapters/ภาคสอง/กลับบ้าน.md'));
    check('ไม่เจอบท = ไม่ทำอะไร', !(await S.renameChapterOnDisk(io, dr, 'nope', 'x')).ok);
  }

  // ══ เปลี่ยนชื่อในโปรแกรม: เล่ม ══
  {
    const { m, io } = await modern();
    await io.writeFile('R/Book 2/section.json', J({ guid: 's2', title: 'Book 2', order: 2, folderName: 'Book 2' }));
    const tk = await S.renameSectionOnDisk(io, 'R/Book 1', 'book 2');
    check('★ ชื่อเล่มชนกับโฟลเดอร์เล่มอื่น → ไม่ย้าย ไม่เขียน', tk.taken && !tk.ok && m.has('R/Book 1/section.json')
      && (await io.readJson('R/Book 1/section.json')).title === 'Book 1');
    await io.writeFile('R/Planners/กระดานหลัก.json', '{"nodes":[]}');
    const tp = await S.renameSectionOnDisk(io, 'R/Book 1', 'planners');
    check('★ เปลี่ยนชื่อเล่มเป็น "planners" ขณะมีโฟลเดอร์ Planners ของกระดาน → ปฏิเสธ · เล่มอยู่ที่เดิม · กระดานไม่ถูกแตะ',
      tp.taken && !tp.ok && !tp.moved && m.has('R/Book 1/section.json') && m.text('R/Planners/กระดานหลัก.json') === '{"nodes":[]}'
      && !m.has('R/Planners/section.json') && (await io.readJson('R/Book 1/section.json')).title === 'Book 1');
    const r = await S.renameSectionOnDisk(io, 'R/Book 1', 'ภาคแรก');
    check('★ เปลี่ยนชื่อเล่ม → โฟลเดอร์ = ชื่อเล่ม ของข้างในตามไปทั้งหมด', r.ok && r.moved && r.to === 'R/ภาคแรก'
      && m.has('R/ภาคแรก/Draft/default/Chapters/บทนำ/ตลาดเก่า.md') && !m.has('R/Book 1'));
    const s = await io.readJson('R/ภาคแรก/section.json');
    check('section.json จดชื่อเล่ม + ชื่อโฟลเดอร์', s.title === 'ภาคแรก' && s.folderName === 'ภาคแรก' && s.guid === 's1');
    const cs = await S.renameSectionOnDisk(io, 'R/ภาคแรก', 'ภาคแรก');
    check('ชื่อเดิม = ไม่ย้าย', cs.ok && !cs.moved);
  }

  // ══ เปลี่ยนชื่อจาก OS ══
  {
    const { io, dr } = await legacy();
    const c0 = await S.reconcileNames(io, 'R');
    check('★ โปรเจกต์รุ่นเก่า (scene-01.md · "01 - บท") = ไม่ถือว่าถูกเปลี่ยนชื่อ', c0.length === 0, JSON.stringify(c0));
    check('เปิดครั้งแรก: จดชื่อโฟลเดอร์เล่มลง section.json (ไม่แตะชื่อเล่ม)', (await io.readJson('R/เล่มหนึ่ง/section.json')).folderName === 'เล่มหนึ่ง'
      && (await io.readJson('R/เล่มหนึ่ง/section.json')).title === 'เล่มหนึ่ง');
    check('ทะเบียนฉาก/บทไม่ถูกแตะ', (await rows(io, dr, 'c1'))[0].fileName === 'scene-01.md' && (await chs(io, dr))[0].folderName === '01 - บทที่หนึ่ง');
    check('รอบสอง = ไม่มีอะไรเปลี่ยน', (await S.reconcileNames(io, 'R')).length === 0);
  }
  {
    const { m, io, dr } = await modern();
    await io.move(dr + '/Chapters/บทนำ/ตลาดเก่า.md', dr + '/Chapters/บทนำ/ตลาดเช้า.md');     // ผู้ใช้เปลี่ยนชื่อใน Explorer
    const c = await S.reconcileNames(io, 'R');
    check('★★ เปลี่ยนชื่อไฟล์ฉากจาก OS → ตรวจเจอ 1 รายการ', c.length === 1 && c[0].kind === 'scene' && c[0].to.endsWith('ตลาดเช้า.md') && c[0].from.endsWith('ตลาดเก่า.md'), JSON.stringify(c));
    const row = (await rows(io, dr, 'c1')).find((x) => x.id === 'a');
    check('★★ ทะเบียน: ชื่อไฟล์ใหม่ + ชื่อเรื่องตามชื่อไฟล์ · id/ลำดับเดิม', row.fileName === 'ตลาดเช้า.md' && row.title === 'ตลาดเช้า' && row.order === 1);
    check('frontmatter ของไฟล์ได้ชื่อเรื่องใหม่', S.parseMdFile(m.text(dr + '/Chapters/บทนำ/ตลาดเช้า.md')).meta.title === 'ตลาดเช้า');
    check('★ ตารางเล่าด้วยภาพตามไปชื่อใหม่', m.has(dr + '/Chapters/บทนำ/ตลาดเช้า_vis.csv'));
    check('ฉากอื่นไม่ถูกแตะ', (await rows(io, dr, 'c1')).find((x) => x.id === 'b').fileName === 'ท่าเรือ.md');
    check('รอบสอง = นิ่ง', (await S.reconcileNames(io, 'R')).length === 0);
  }
  {
    const { m, io, dr } = await modern();
    await io.move(dr + '/Chapters/บทนำ', dr + '/Chapters/Prologue');
    const c = await S.reconcileNames(io, 'R');
    check('★★ เปลี่ยนชื่อโฟลเดอร์บทจาก OS → ตรวจเจอ', c.length === 1 && c[0].kind === 'chapter' && c[0].to.endsWith('/Prologue'), JSON.stringify(c));
    const ch = (await chs(io, dr)).find((x) => x.guid === 'c1');
    check('★★ draft.json: โฟลเดอร์ใหม่ + ชื่อบทตามโฟลเดอร์ · ลำดับเดิม', ch.folderName === 'Prologue' && ch.title === 'Prologue' && ch.order === 1);
    check('ฉากในบทยังชี้ไฟล์เดิมได้', m.has(dr + '/Chapters/Prologue/' + (await rows(io, dr, 'c1'))[0].fileName));
  }
  {
    const { io, dr } = await modern();
    await io.move(dr + '/Chapters/บทนำ', dr + '/Chapters/Prologue');
    await io.move(dr + '/Chapters/Prologue/ท่าเรือ.md', dr + '/Chapters/Prologue/Harbor.md');
    const c = await S.reconcileNames(io, 'R');
    check('★ เปลี่ยนทั้งโฟลเดอร์บทและไฟล์ฉากข้างในพร้อมกัน → ตามได้ทั้งคู่', c.length === 2 && c[0].kind === 'chapter' && c[1].kind === 'scene', JSON.stringify(c));
    check('ฉากได้ชื่อใหม่ในโฟลเดอร์ใหม่', (await rows(io, dr, 'c1')).find((x) => x.id === 'b').fileName === 'Harbor.md' && c[1].to.includes('/Prologue/'));
  }
  {
    const { m, io } = await modern();
    await io.move('R/Book 1', 'R/นิยายเล่มแรก');
    const c = await S.reconcileNames(io, 'R');
    check('★★ เปลี่ยนชื่อโฟลเดอร์เล่มจาก OS → ชื่อเล่มตามโฟลเดอร์', c.length === 1 && c[0].kind === 'book' && !c[0].copied
      && (await io.readJson('R/นิยายเล่มแรก/section.json')).title === 'นิยายเล่มแรก', JSON.stringify(c));
    check('guid ของเล่มเดิม (ตัวตนไม่เปลี่ยน)', (await io.readJson('R/นิยายเล่มแรก/section.json')).guid === 's1');
    check('ของข้างในยังอยู่ครบ', m.has('R/นิยายเล่มแรก/Draft/default/Chapters/บทนำ/ตลาดเก่า.md'));
  }
  {
    const { io } = await modern();
    for (const f of ['section.json', 'Draft/default/draft.json', 'Draft/default/scenes.json'])
      await io.writeFile('R/Book 1 - Copy/' + f, await io.readFile('R/Book 1/' + f));
    const c = await S.reconcileNames(io, 'R');
    const cp = await io.readJson('R/Book 1 - Copy/section.json');
    check('★ ก๊อปโฟลเดอร์เล่มใน OS = สำเนา: ชื่อของตัวเอง + guid ใหม่ · ไม่ย้ายแท็บของต้นฉบับ', c.length === 1 && c[0].copied === true
      && cp.title === 'Book 1 - Copy' && cp.guid !== 's1' && (await io.readJson('R/Book 1/section.json')).title === 'Book 1', JSON.stringify(c));
  }
  {
    const { io, dr } = await modern();
    await io.move(dr + '/Chapters/บทนำ/ท่าเรือ.md', dr + '/Chapters/ภาคสอง/ท่าเรือ.md');   // ลากไฟล์ไปโฟลเดอร์บทอื่น
    const c = await S.reconcileNames(io, 'R');
    const d = (await io.readJson(dr + '/scenes.json')).chapters;
    check('★ ลากไฟล์ฉากไปโฟลเดอร์บทอื่นจาก OS → แถวย้ายบทตาม ต่อท้าย', c.length === 1 && c[0].moved && !d.c1.some((x) => x.id === 'b')
      && d.c2.some((x) => x.id === 'b' && x.chapterGuid === 'c2' && x.order === 2), JSON.stringify(c));
  }
  {
    const { io, dr } = await modern();
    await io.writeFile(dr + '/Chapters/บทนำ/ตลาดเก่า.md', 'ไม่มีหัวไฟล์');
    await io.writeFile(dr + '/Chapters/บทนำ/ท่าเรือ.md', 'ไม่มีหัวไฟล์');
    await io.move(dr + '/Chapters/บทนำ/ตลาดเก่า.md', dr + '/Chapters/บทนำ/p.md');
    await io.move(dr + '/Chapters/บทนำ/ท่าเรือ.md', dr + '/Chapters/บทนำ/q.md');
    const before = JSON.stringify(await rows(io, dr, 'c1'));
    const c = await S.reconcileNames(io, 'R');
    check('★ กำกวม (หายสอง โผล่สอง ไม่มีหลักฐาน) = ไม่เดา ทะเบียนไม่ถูกแตะ', c.length === 0 && JSON.stringify(await rows(io, dr, 'c1')) === before);
  }
  {
    const { io, dr } = await modern();
    await io.writeFile(dr + '/Chapters/บทนำ/โน้ตใหม่.md', md('โน้ตใหม่'));
    check('ไฟล์ใหม่ที่วางเข้ามาเฉย ๆ = ไม่ใช่การเปลี่ยนชื่อ (ให้ตัวตรวจสุขภาพรายงาน)', (await S.reconcileNames(io, 'R')).length === 0);
  }
  {
    const { io, dr } = await legacy();
    await io.move(dr + '/Chapters/01 - บทที่หนึ่ง', dr + '/Chapters/02 - บทที่หนึ่ง');
    await io.move(dr + '/Chapters/02 - บทที่หนึ่ง/scene-01.md', dr + '/Chapters/02 - บทที่หนึ่ง/scene-09.md');
    const c = await S.reconcileNames(io, 'R');
    check('ของเก่า: เปลี่ยนแค่เลขนำ/เลขไฟล์จาก OS → ทะเบียนตาม แต่ชื่อเรื่องคงเดิม', c.length === 2
      && (await chs(io, dr))[0].title === 'บทที่หนึ่ง' && (await chs(io, dr))[0].folderName === '02 - บทที่หนึ่ง'
      && (await rows(io, dr, 'c1'))[0].title === 'ตลาดเก่า' && (await rows(io, dr, 'c1'))[0].fileName === 'scene-09.md', JSON.stringify(c));
  }

  {
    const { io } = await modern();
    await io.move('R/Book 1', 'R/Planners');                    // ผู้ใช้เปลี่ยนชื่อโฟลเดอร์เล่มจาก OS ไปชนชื่อสงวน
    const c = await S.reconcileNames(io, 'R');
    check('★ เปลี่ยนชื่อโฟลเดอร์เล่มจาก OS เป็นชื่อสงวน (Planners) → รายงานเป็นคำเตือน ไม่ย้ายให้เอง',
      c.some((x) => x.kind === 'book' && x.reserved && x.to === 'R/Planners') && await io.exists('R/Planners/section.json'), JSON.stringify(c));
  }

  // ══ ชื่อที่ยังไม่ตรงกับชื่อเรื่อง (ของรุ่นเก่า) ══
  {
    const { m, io, dr } = await legacy();
    const mm = await S.listNameMismatches(io, 'R');
    check('โปรเจกต์รุ่นเก่า: บท 1 + ฉาก 2 ยังไม่ตรงชื่อ (เล่มตรงอยู่แล้ว)', mm.length === 3 && mm.filter((x) => x.kind === 'scene').length === 2
      && mm.filter((x) => x.kind === 'chapter').length === 1, JSON.stringify(mm.map((x) => x.kind + ':' + x.disk)));
    for (const it of mm.filter((x) => x.kind === 'scene')) await S.renameSceneOnDisk(io, it.dPath, it.ch, it.id, it.title);
    for (const it of mm.filter((x) => x.kind === 'chapter')) await S.renameChapterOnDisk(io, it.dPath, it.ch.guid, it.title);
    check('★ ปรับแล้ว: ชื่อบนดิสก์ = ชื่อเรื่อง ไม่มีเลขกำกับ', m.has(dr + '/Chapters/บทที่หนึ่ง/ตลาดเก่า.md') && m.has(dr + '/Chapters/บทที่หนึ่ง/ท่าเรือ.md'));
    check('ลำดับยังอยู่ใน JSON ตามเดิม', (await rows(io, dr, 'c1')).map((x) => x.order).join() === '1,2');
    check('★ ตรวจซ้ำ = ไม่เหลือรายการ', (await S.listNameMismatches(io, 'R')).length === 0);
    check('และไม่ถูกมองเป็นการเปลี่ยนชื่อจากภายนอก', (await S.reconcileNames(io, 'R')).length === 0);
  }
  {
    const { io } = await modern();
    check('โปรเจกต์รุ่นใหม่ = ไม่มีชื่อที่ไม่ตรง', (await S.listNameMismatches(io, 'R')).length === 0);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
