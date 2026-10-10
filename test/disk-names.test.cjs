// test/disk-names.test.cjs — [alpha.170] ชื่อบนดิสก์ของ เล่ม/บท/ฉาก + จับคู่การเปลี่ยนชื่อจากนอกโปรแกรม
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-disk-names-test.cjs');
esbuild.buildSync({ stdin: { contents: "export * from './src/disk-names.js';", resolveDir: path.join(__dirname, '..') },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const N = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 400) : '')); }
}
const J = (v) => JSON.stringify(v);

// ── diskBase ──
check('ชื่อธรรมดาไม่ถูกแตะ', N.diskBase('ตลาดเก่า') === 'ตลาดเก่า');
check('อักขระต้องห้ามกลายเป็นวรรคเดียว', N.diskBase('บทที่ 1: เริ่ม/ต้น?') === 'บทที่ 1 เริ่ม ต้น', N.diskBase('บทที่ 1: เริ่ม/ต้น?'));
check('จุด/วรรคท้ายชื่อถูกตัด (Windows ตัดเงียบ)', N.diskBase('จบ... ') === 'จบ');
check('จุดนำหน้าถูกตัด (ไม่เป็นไฟล์ซ่อน)', N.diskBase('.ลับ') === 'ลับ');
check('ชื่อที่ระบบสงวนได้ _ ต่อท้าย', N.diskBase('CON') === 'CON_' && N.diskBase('nul') === 'nul_' && N.diskBase('COM1') === 'COM1_');
check('ว่าง/มีแต่อักขระต้องห้าม = ชื่อสำรอง', N.diskBase('') === 'untitled' && N.diskBase('???') === 'untitled' && N.diskBase(null, 'x') === 'x');
check('ไม่มีเลขกำกับถูกเติมให้', !/^\d/.test(N.diskBase('บทนำ')));
check('ผู้ใช้ใส่เลขเองได้', N.diskBase('01 เปิดเรื่อง') === '01 เปิดเรื่อง');
check('ยาวเกินถูกตัดที่เพดาน', Array.from(N.diskBase('ก'.repeat(300))).length === N.DISK_NAME_MAX);
check('อักขระควบคุมถูกถอด', N.diskBase('a' + String.fromCharCode(9) + 'b') === 'a b');

// ── freeName ──
check('ชื่อว่าง = ใช้ตรง ๆ', N.freeName('ตอนเช้า', [], '.md') === 'ตอนเช้า.md');
check('ชน = ต่อ 2', N.freeName('ตอนเช้า', ['ตอนเช้า.md'], '.md') === 'ตอนเช้า 2.md');
check('ชนต่อเนื่อง = เลขถัดไป', N.freeName('A', ['A', 'A 2', 'A 3']) === 'A 4');
check('ไม่สนตัวพิมพ์ (Windows)', N.freeName('Intro', ['intro.md'], '.md') === 'Intro 2.md');
check('รับ Set ได้', N.freeName('x', new Set(['x'])) === 'x 2');

// ── nameFits ──
check('ตรงเป๊ะ', N.nameFits('ตลาดเก่า', 'ตลาดเก่า.md', '.md'));
check('ตรงแบบมีเลขกันชน', N.nameFits('ตลาดเก่า', 'ตลาดเก่า 2.md', '.md'));
check('ชื่อเรื่องมีอักขระต้องห้าม = เทียบกับชื่อที่ถอดแล้ว', N.nameFits('บทที่ 1: เริ่ม', 'บทที่ 1 เริ่ม'));
check('ของเก่า scene-01.md ไม่ตรง', !N.nameFits('ตลาดเก่า', 'scene-01.md', '.md'));
check('ของเก่า "01 - ชื่อ" ไม่ตรง', !N.nameFits('บทที่หนึ่ง', '01 - บทที่หนึ่ง'));
check('ต่อท้ายด้วยคำ (ไม่ใช่เลข) ไม่นับว่าตรง', !N.nameFits('ตลาด', 'ตลาด เก่า.md', '.md'));

// ── titleAfterRename ──
check('★ เปลี่ยนชื่อไฟล์จาก OS → ชื่อเรื่อง = ชื่อไฟล์ใหม่', N.titleAfterRename('scene', 'ตลาดใหม่', 'ตลาดเก่า') === 'ตลาดใหม่');
check('ของเก่า: scene-01 → scene-05 (เปลี่ยนแค่เลข) = ชื่อเรื่องเดิม', N.titleAfterRename('scene', 'scene-05', 'ตลาดเก่า') === 'ตลาดเก่า');
check('ของเก่า: 01 - ชื่อ → 02 - ชื่อ = ชื่อบทเดิม', N.titleAfterRename('chapter', '02 - บทที่หนึ่ง', 'บทที่หนึ่ง') === 'บทที่หนึ่ง');
check('บท: เลขนำ + ชื่ออื่น = ชื่อใหม่ทั้งก้อน (ผู้ใช้ใส่เลขเอง)', N.titleAfterRename('chapter', '02 - ชื่ออื่น', 'บทที่หนึ่ง') === '02 - ชื่ออื่น');
check('ชื่อเรื่องมีอักขระต้องห้าม แล้วดิสก์ยังเป็นรูปที่ถอดแล้ว = ไม่เปลี่ยน', N.titleAfterRename('chapter', 'บทที่ 1 เริ่ม', 'บทที่ 1: เริ่ม') === 'บทที่ 1: เริ่ม');
check('เล่ม: ชื่อใหม่ตามโฟลเดอร์', N.titleAfterRename('book', 'ภาคแรก', 'Book 1') === 'ภาคแรก');
check('ไม่มีชื่อเดิม = ใช้ชื่อบนดิสก์', N.titleAfterRename('scene', 'scene-05', '') === 'scene-05');

// ── เล่ม ──
check('ชื่อเล่มเริ่มต้นเป็นอังกฤษ', N.defaultBookName([]) === 'Book 1');
check('Book 1 มีแล้ว → Book 2', N.defaultBookName(['book 1', 'Wiki']) === 'Book 2');
check('ชนโฟลเดอร์ของโปรแกรม (แม้ยังไม่ถูกสร้าง)', N.bookNameTaken('wiki', []) && N.bookNameTaken('Images', []) && N.bookNameTaken('Recycle', []));
check('ชนเล่มอื่น (ไม่สนตัวพิมพ์)', N.bookNameTaken('book 1', ['Book 1']));
check('ชื่อของตัวเองไม่นับว่าชน', !N.bookNameTaken('Book 1', ['Book 1'], 'Book 1'));
check('★ "Planners" (โฟลเดอร์กระดานวางแผน) ใช้เป็นชื่อเล่มไม่ได้ — ทั้งตอนโฟลเดอร์มีอยู่แล้วและยังไม่ถูกสร้าง',
  N.bookNameTaken('Planners', ['Planners', 'Book 1']) && N.bookNameTaken('Planners', ['Book 1']) && N.bookNameTaken('planners', []) && N.bookNameTaken('PLANNERS', []));
check('ชื่อที่แค่คล้าย (Planner · Planners 2 · แผน Planners) ไม่ถูกกัน', !N.bookNameTaken('Planner', []) && !N.bookNameTaken('Planners 2', []) && !N.bookNameTaken('แผน Planners', []));
check('โฟลเดอร์ของโปรแกรมทุกตัวถูกกัน', ['Wiki', 'Bible', 'Images', 'Memos', 'Research', 'Snapshots', 'Plugins', 'Recycle', 'Sessions', 'Starters',
  'Planners', 'Branches', 'FloorPlans', 'OnSet', 'References', 'Models', 'Backups', 'languages', 'Analysis', 'Dialogues', 'Fonts', 'Skills']
  .every((n) => N.bookNameTaken(n, []) && N.isReservedRoot(n.toLowerCase())));
check('ชื่อใหม่ไม่ชน', !N.bookNameTaken('ภาคสอง', ['Book 1', 'Wiki']));
{
  const a = N.sectionSync({ title: 'เล่มหนึ่ง' }, 'เล่มหนึ่ง');
  check('เล่มเก่าที่ไม่เคยจดชื่อโฟลเดอร์ = จดอย่างเดียว ไม่แตะชื่อเล่ม', a.record && !a.renamed && a.title === 'เล่มหนึ่ง');
  const b = N.sectionSync({ title: 'ชื่อสวย', folderName: 'old' }, 'old');
  check('ชื่อโฟลเดอร์ตรงกับที่จด = ไม่ทำอะไร', !b.record && !b.renamed && b.title === 'ชื่อสวย');
  const c = N.sectionSync({ title: 'Book 1', folderName: 'Book 1' }, 'ภาคแรก');
  check('★ โฟลเดอร์เล่มถูกเปลี่ยนชื่อจากนอกโปรแกรม → ชื่อเล่มตามโฟลเดอร์', c.renamed && c.record && c.title === 'ภาคแรก');
  const d = N.sectionSync({ title: 'book', folderName: 'book' }, 'Book');
  check('เปลี่ยนแค่ตัวพิมพ์ก็นับ', d.renamed && d.title === 'Book');
}

// ── pairSceneRenames ──
{
  const rows = [{ id: 'a', title: 'ตลาดเก่า', fileName: 'ตลาดเก่า.md' }, { id: 'b', title: 'ท่าเรือ', fileName: 'ท่าเรือ.md' }];
  const none = N.pairSceneRenames(rows, ['ตลาดเก่า.md', 'ท่าเรือ.md']);
  check('ไฟล์อยู่ครบ = ไม่มีอะไรต้องทำ', !none.pairs.length && !none.missing.length && !none.orphans.length);

  const meta = { 'ตลาดใหม่.md': { title: 'ตลาดเก่า' } };
  const r1 = N.pairSceneRenames(rows, ['ตลาดใหม่.md', 'ท่าเรือ.md'], (f) => meta[f]);
  check('★ เปลี่ยนชื่อไฟล์หนึ่งไฟล์ → จับคู่ด้วยชื่อใน frontmatter', J(r1.pairs) === J([{ id: 'a', from: 'ตลาดเก่า.md', to: 'ตลาดใหม่.md', by: 'title' }]), J(r1));

  const meta2 = { 'x.md': { title: 'ท่าเรือ' }, 'y.md': { title: 'ตลาดเก่า' } };
  const r2 = N.pairSceneRenames(rows, ['x.md', 'y.md'], (f) => meta2[f]);
  check('★ เปลี่ยนสองไฟล์พร้อมกัน → จับคู่ถูกตัว', r2.pairs.length === 2
    && r2.pairs.find((p) => p.id === 'a').to === 'y.md' && r2.pairs.find((p) => p.id === 'b').to === 'x.md', J(r2));

  const r3 = N.pairSceneRenames(rows, ['ไม่มีหัว.md', 'ท่าเรือ.md'], () => null);
  check('ไม่มี frontmatter แต่เหลือฝั่งละหนึ่ง → จับคู่', r3.pairs.length === 1 && r3.pairs[0].by === 'single' && r3.pairs[0].to === 'ไม่มีหัว.md');

  const r4 = N.pairSceneRenames(rows, ['p.md', 'q.md'], () => null);
  check('★ กำกวม (หายสอง โผล่สอง ไม่มีหลักฐาน) = ไม่เดา', !r4.pairs.length && r4.missing.length === 2 && r4.orphans.length === 2);

  const r5 = N.pairSceneRenames(rows, ['ตลาดเก่า.md', 'ท่าเรือ.md', 'ของใหม่.md'], () => ({ title: 'ตลาดเก่า' }));
  check('ไฟล์ใหม่ที่โผล่มาเฉย ๆ (ไม่มีแถวไหนหาย) = ไม่ใช่การเปลี่ยนชื่อ', !r5.pairs.length && J(r5.orphans) === J(['ของใหม่.md']));

  const r6 = N.pairSceneRenames(rows, ['ท่าเรือ.md']);
  check('ไฟล์หายเฉย ๆ = รายงานว่าหาย ไม่จับคู่', !r6.pairs.length && r6.missing.length === 1 && r6.missing[0].id === 'a');

  const dup = [{ id: 'a', title: 'ซ้ำ', fileName: 'ซ้ำ.md' }, { id: 'b', title: 'ซ้ำ', fileName: 'ซ้ำ 2.md' }];
  const r7 = N.pairSceneRenames(dup, ['m.md', 'n.md'], () => ({ title: 'ซ้ำ' }));
  check('ชื่อเรื่องซ้ำกันสองแถว = ไม่จับคู่ด้วยชื่อ', !r7.pairs.length);

  const r8 = N.pairSceneRenames([{ id: 'a', title: 'x', fileName: 'intro.md' }], ['Intro.md']);
  check('เปลี่ยนแค่ตัวพิมพ์ → ตามชื่อจริงบนดิสก์', J(r8.pairs) === J([{ id: 'a', from: 'intro.md', to: 'Intro.md', by: 'case' }]));

  const legacy = [{ id: 'a', title: 'ตลาดเก่า', fileName: 'scene-01.md' }];
  const r9 = N.pairSceneRenames(legacy, ['scene-01.md']);
  check('★ ของเก่า scene-01.md ที่ชื่อเรื่องไม่ตรง = ไม่ถือว่าถูกเปลี่ยนชื่อ', !r9.pairs.length && !r9.missing.length);
}

// ── pairSceneMoves ──
{
  const mv = N.pairSceneMoves([{ chGuid: 'c1', row: { id: 'a', title: 'ตลาดเก่า', fileName: 'ตลาดเก่า.md' } }],
    [{ chGuid: 'c2', file: 'ตลาดเก่า.md', title: 'ตลาดเก่า' }]);
  check('★ ลากไฟล์ฉากไปโฟลเดอร์บทอื่นจาก OS → ย้ายแถวตาม', J(mv) === J([{ id: 'a', fromCh: 'c1', toCh: 'c2', from: 'ตลาดเก่า.md', to: 'ตลาดเก่า.md' }]), J(mv));
  const amb = N.pairSceneMoves([{ chGuid: 'c1', row: { id: 'a', title: 'ฉากแรก', fileName: 'a.md' } }],
    [{ chGuid: 'c2', file: 'b.md', title: 'ฉากแรก' }, { chGuid: 'c3', file: 'c.md', title: 'ฉากแรก' }]);
  check('ชื่อซ้ำหลายที่ = ไม่เดา', !amb.length);
  check('ไม่มีชื่อใน frontmatter = ไม่ย้ายข้ามบท', !N.pairSceneMoves([{ chGuid: 'c1', row: { id: 'a', title: 'x', fileName: 'a.md' } }],
    [{ chGuid: 'c2', file: 'b.md', title: '' }]).length);
}

// ── pairChapterRenames ──
{
  const chs = [{ guid: 'c1', title: 'บทนำ', folderName: 'บทนำ' }, { guid: 'c2', title: 'ภาคสอง', folderName: 'ภาคสอง' }];
  const rowsBy = { c1: [{ id: 'a', title: 'เปิด', fileName: 'เปิด.md' }], c2: [{ id: 'b', title: 'ต่อ', fileName: 'ต่อ.md' }] };
  const disk = { 'Prologue': ['เปิด.md'], 'ภาคสอง': ['ต่อ.md'] };
  const r1 = N.pairChapterRenames(chs, Object.keys(disk), rowsBy, (f) => disk[f]);
  check('★ เปลี่ยนชื่อโฟลเดอร์บทจาก OS → จับคู่จากไฟล์ฉากข้างใน', J(r1.pairs) === J([{ guid: 'c1', from: 'บทนำ', to: 'Prologue', by: 'content' }]), J(r1));

  const disk2 = { 'A': ['ต่อ.md'], 'B': ['เปิด.md'] };
  const r2 = N.pairChapterRenames(chs, Object.keys(disk2), rowsBy, (f) => disk2[f]);
  check('★ เปลี่ยนสองโฟลเดอร์พร้อมกัน → จับคู่ถูกบท', r2.pairs.length === 2
    && r2.pairs.find((p) => p.guid === 'c1').to === 'B' && r2.pairs.find((p) => p.guid === 'c2').to === 'A', J(r2));

  const empty = [{ guid: 'e1', title: 'ว่าง', folderName: 'ว่าง' }];
  const r3 = N.pairChapterRenames(empty, ['ชื่อใหม่'], {}, () => []);
  check('บทว่างเปลี่ยนชื่อโฟลเดอร์ (เหลือฝั่งละหนึ่ง) → จับคู่', r3.pairs.length === 1 && r3.pairs[0].by === 'single');

  const r4 = N.pairChapterRenames([{ guid: 'e1', folderName: 'ก' }, { guid: 'e2', folderName: 'ข' }], ['x', 'y'], {}, () => []);
  check('★ บทว่างสองบท หายสองโผล่สอง = ไม่เดา', !r4.pairs.length && r4.missing.length === 2);

  const disk5 = { 'New': ['อื่น.md'] };
  const r5 = N.pairChapterRenames([chs[0]], ['New'], rowsBy, (f) => disk5[f], () => ({ title: 'ไม่เกี่ยว' }));
  check('★ เหลือฝั่งละหนึ่งแต่เนื้อในไม่เกี่ยวกันเลย = ไม่จับคู่ (บทถูกลบ + โฟลเดอร์ใหม่)', !r5.pairs.length, J(r5));

  const disk6 = { 'New': ['เปลี่ยนด้วย.md'] };
  const r6 = N.pairChapterRenames([chs[0]], ['New'], rowsBy, (f) => disk6[f], () => ({ title: 'เปิด' }));
  check('เปลี่ยนทั้งชื่อโฟลเดอร์และชื่อไฟล์ → จับคู่จากชื่อใน frontmatter', r6.pairs.length === 1 && r6.pairs[0].to === 'New');

  const r7 = N.pairChapterRenames([{ guid: 'c', folderName: 'intro' }], ['Intro'], {}, () => []);
  check('โฟลเดอร์เปลี่ยนแค่ตัวพิมพ์', J(r7.pairs) === J([{ guid: 'c', from: 'intro', to: 'Intro', by: 'case' }]));

  const leg = N.pairChapterRenames([{ guid: 'c1', title: 'บทที่หนึ่ง', folderName: '01 - บทที่หนึ่ง' }], ['01 - บทที่หนึ่ง'], {}, () => []);
  check('★ ของเก่า "01 - ชื่อ" = ไม่ถือว่าถูกเปลี่ยนชื่อ', !leg.pairs.length && !leg.missing.length);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
