// test/tree-menu.test.cjs — [alpha.155] เมนูคลิกขวาของ Explorer + ข้อมูลเสริมของแถว
//
// ประตูกันพลาดข้อหลัก: **ลำดับเมนูต้องตรงกับรายการที่ผู้ใช้ส่งมาเป๊ะ** (ดู tree-menu-spec.js)
// ถ้าใครสลับ/ตัดรายการในโค้ด เทสนี้แดงทันที
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');
const { lexCsv } = require('../tools/csv-lite.cjs');

const ROOT = path.join(__dirname, '..');
const load = (rel, name) => {
  const out = path.join(os.tmpdir(), name);
  esbuild.buildSync({ entryPoints: [path.join(ROOT, rel)], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const S = load('src/tree-menu-spec.js', '_tms155.cjs');
const M = load('src/tree-item-meta.js', '_tim155.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ───────── ลำดับตามรายการของผู้ใช้ (เขียนซ้ำตรงนี้ด้วยมือ = สัญญาที่ต้องรักษา) ─────────
const USER_LIST = {
  project: 'addBook renameProject | quickOpen searchProject dashboard kanban journal | play playerHistory | branchPanel | projectSettings aiSettings reveal',
  book: 'addBook rename reorder | addChapter duplicate star | manageBooks manageChapters searchIn readBook | castOfCharacters titlePage | quickNote viewQuickNotes | propsPopup propsPanel reveal | color status pin | lock backup restore | delete',
  chapter: 'addChapter bookFromChapter visual rename reorder | addScene copy paste duplicate move star | manageChapters manageScenes searchIn readChapter readBook | propsPopup propsPanel reveal | color status pin | lock backup restore | delete',
  scene: 'open addScene addChapter chapterFromScenes rename reorder switchFormat | copy paste duplicate moveUp moveDown move star | quickNote comment readScene | propsPopup propsPanel reveal | color status pin | saveVersion versionHistory compareVersion | splitView toMemo | lock backup restore | delete',
  memoHead: 'open addMemo | reveal',
  memo: 'open addMemo sceneFromMemo rename | copy paste duplicate moveUp moveDown move star | quickNote comment | propsPopup propsPanel reveal | color status pin | saveVersion versionHistory compareVersion | splitView | lock backup restore | delete',
  galleryHead: 'openGallery addAlbum importImage moodBoard | reveal',
  image: 'view insert rename | copy paste duplicate | propsPopup propsPanel reveal | delete',
  plannerHead: 'addBoard openPlannerPanel | reveal',
  board: 'open addBoard rename | copy paste duplicate star | propsPopup propsPanel reveal | color status pin | lock | delete',
  branchHead: 'openBranchPanel addPlan | reveal',
  plan: 'open addPlan rename | copy paste duplicate star | propsPopup propsPanel reveal | color status pin | compare lock | delete',
};
for (const [kind, want] of Object.entries(USER_LIST)) {
  const got = S.TREE_MENU_SPEC[kind].map((x) => (x === '-' ? '|' : x)).join(' ');
  check(`★ ลำดับเมนู ${kind} ตรงกับรายการของผู้ใช้`, got === want, got);
}
check('ไม่มีชนิดแถวเกินจากรายการของผู้ใช้', eq(Object.keys(S.TREE_MENU_SPEC).sort(), Object.keys(USER_LIST).sort()));
check('★ ทุกเมนูมี "หาใน disk" (กฎ [120-7])', Object.values(S.TREE_MENU_SPEC).every((l) => l.includes('reveal')));

// ───────── ป้ายชื่อมีในไฟล์ภาษาทุกไฟล์ ─────────
const keys = S.allMenuLabelKeys();
check('มีคีย์ป้ายชื่อครบทุกรายการ (รวมป้ายตอนเปิดอยู่ของรายการสลับ)', keys.length >= 60, keys.length);
for (const f of fs.readdirSync(path.join(ROOT, 'languages')).filter((x) => /^k2_.+\.csv$/.test(x))) {
  const tbl = lexCsv(fs.readFileSync(path.join(ROOT, 'languages', f), 'utf8'));
  const miss = keys.filter((k) => !tbl[k]);
  check(`★ ${f}: ป้ายเมนูครบทุกคีย์`, miss.length === 0, miss.slice(0, 6).join(' · '));
}

// ───────── buildMenuItems ─────────
{
  const all = S.buildMenuItems('board', (id) => ({ label: id, click() {} }));
  check('ประกอบครบทุกรายการ + เส้นคั่นตามตาราง', all.map((x) => (x === '-' ? '|' : x.id)).join(' ') === USER_LIST.board);
  check('รายการลบเป็นสีอันตรายเสมอ', all.find((x) => x.id === 'delete').danger === true);
  const some = S.buildMenuItems('board', (id) => (['lock', 'color', 'status', 'pin'].includes(id) ? null : { label: id, click() {} }));
  const txt = some.map((x) => (x === '-' ? '|' : x.id)).join(' ');
  check('ข้ามรายการที่ไม่แสดง แล้วยุบเส้นคั่นซ้อน', !txt.includes('| |') && txt.includes('reveal | delete'), txt);
  const none = S.buildMenuItems('memoHead', (id) => (id === 'reveal' ? { label: id, click() {} } : null));
  check('ไม่มีเส้นคั่นนำหน้า/ต่อท้าย', none.length === 1 && none[0].id === 'reveal', JSON.stringify(none));
  check('ชนิดที่ไม่รู้จัก = เมนูว่าง', S.buildMenuItems('nope', () => ({})).length === 0);
  check('คีย์ป้ายของรายการสลับ', S.menuLabelKey('star', true) === 'ui.treeMenu.starOff' && S.menuLabelKey('rename', true) === 'ui.treeMenu.rename');
}

// ───────── ย้ายลำดับ ─────────
check('ย้ายไปตำแหน่งที่ 1', eq(S.moveToPosition(['a', 'b', 'c'], 2, 1), ['c', 'a', 'b']));
check('ตำแหน่งเกินช่วงถูกหนีบ', eq(S.moveToPosition(['a', 'b', 'c'], 0, 99), ['b', 'c', 'a']));
check('ของเดิมไม่ถูกแก้', (() => { const a = ['a', 'b']; S.moveToPosition(a, 0, 2); return eq(a, ['a', 'b']); })());
check('เลื่อนขึ้นจากบนสุดไม่ได้', S.stepIndex(3, 0, -1) === -1 && S.stepIndex(3, 2, 1) === -1 && S.stepIndex(3, 1, 1) === 2);

// ───────── explorer meta ─────────
{
  let ex = M.normalizeExplorer(null);
  check('explorer เปล่าถูกรูป', eq(ex, { version: 1, pins: [], items: {} }));
  ex = M.setItemMeta(ex, 'Planners\\ก.json', { flag: true, color: '#d9575e', status: 'กำลังเขียน', locked: false });
  check('path แบบ Windows กลายเป็นคีย์ /', !!ex.items['Planners/ก.json'] && !('locked' in ex.items['Planners/ก.json']));
  check('อ่านคืนได้', M.getItemMeta(ex, 'Planners/ก.json').flag === true);
  ex = M.setItemMeta(ex, 'Planners/ก.json', { color: '', status: null });
  check('ค่าว่าง = ลบช่องนั้น', !('color' in ex.items['Planners/ก.json']) && !('status' in ex.items['Planners/ก.json']));
  check('สีที่ไม่ใช่ hex ถูกทิ้ง', !(M.setItemMeta(ex, 'x', { color: 'red' }).items.x || {}).color);
  ex = M.setItemMeta(ex, 'Planners/ก.json', { flag: false });
  check('ไม่เหลือช่องไหน = ลบทั้งแถว (ไฟล์ไม่บวม)', !ex.items['Planners/ก.json']);

  ex = M.setItemMeta(M.normalizeExplorer(null), 'Branches/ข.json', { locked: true });
  ex = M.togglePin(ex, 'plan', 'Branches/ข.json', { title: 'ข' });
  ex = M.renameItemPath(ex, 'Branches/ข.json', 'Branches/ค.json');
  check('★ เปลี่ยนชื่อไฟล์ → คุณสมบัติตามไป', ex.items['Branches/ค.json']?.locked === true && !ex.items['Branches/ข.json']);
  check('★ เปลี่ยนชื่อไฟล์ → หมุดตามไป', M.isPinned(ex, 'plan', 'Branches/ค.json') && !M.isPinned(ex, 'plan', 'Branches/ข.json'));
  ex = M.forgetItemPath(ex, 'Branches/ค.json');
  check('ลบไฟล์ → ล้างทั้งคุณสมบัติและหมุด', !ex.items['Branches/ค.json'] && ex.pins.length === 0);

  let p = M.togglePin(null, 'scene', 'k2-abc', { title: 'ฉาก', dRel: 'เล่ม/Draft/default' });
  check('ปักหมุดฉากด้วย id', M.isPinned(p, 'scene', 'k2-abc') && p.pins[0].dRel === 'เล่ม/Draft/default');
  p = M.togglePin(p, 'chapter', 'g1');
  check('หมุดเรียงตามลำดับที่ปัก (ไม่ย้ายของจริง)', p.pins.map((x) => x.kind).join() === 'scene,chapter');
  p = M.togglePin(p, 'scene', 'k2-abc');
  check('กดซ้ำ = เอาหมุดออก', !M.isPinned(p, 'scene', 'k2-abc') && p.pins.length === 1);
  p = M.updatePinInfo(p, 'chapter', 'g1', { title: 'ชื่อใหม่' });
  check('อัปเดตชื่อหมุดได้โดยลำดับไม่เปลี่ยน', p.pins[0].title === 'ชื่อใหม่' && p.pins[0].key === 'g1');
  check('pinKey แยกชนิด', M.pinKey('image', 'Images\\a.png') === 'image:Images/a.png' && M.pinKey('book', 'g') === 'book:g');
}

// ───────── ล็อกซ้อนชั้น ─────────
check('★ เล่มล็อก = ฉากข้างในล็อก', M.lockSource({ book: { locked: true }, chapter: {}, scene: {} }) === 'book');
check('★ บทล็อก = ฉากข้างในล็อก', M.lockSource({ book: {}, chapter: { locked: true }, scene: {} }) === 'chapter');
check('ฉากล็อกเอง (frontmatter เป็นข้อความ)', M.lockSource({ scene: { locked: 'true' } }) === 'scene');
check('ไม่มีใครล็อก', M.lockSource({ book: {}, chapter: {}, scene: { locked: false } }) === '');

// ───────── id ใหม่ตอนทำสำเนาเล่ม ─────────
{
  let n = 0;
  const newId = () => 'new' + (++n);
  const draft = { chapters: [{ guid: 'c1', title: 'บท 1' }, { guid: 'c2', title: 'บท 2' }] };
  const scenes = { chapters: { c1: [{ id: 's1', chapterGuid: 'c1', choices: [{ text: 'ไป', nextSceneId: 's2' }, { text: 'นอก', nextSceneId: 'zz' }] }],
                               c2: [{ id: 's2', chapterGuid: 'c2' }] } };
  const r = M.regenDraftIds(draft, scenes, newId);
  const oldIds = new Set(['c1', 'c2', 's1', 's2']);
  const allNew = [...r.draft.chapters.map((c) => c.guid),
                  ...Object.keys(r.scenes.chapters), ...Object.values(r.scenes.chapters).flat().map((s) => s.id)];
  check('★ ทุก guid/id เป็นของใหม่', allNew.every((x) => !oldIds.has(x)), allNew.join());
  check('scenes.json ผูกกับ guid ใหม่ของบท', Object.keys(r.scenes.chapters).every((g) => r.draft.chapters.some((c) => c.guid === g)));
  check('chapterGuid ในแถวฉากตรงกับบทใหม่',
        Object.entries(r.scenes.chapters).every(([g, rows]) => rows.every((s) => s.chapterGuid === g)));
  const s1 = r.scenes.chapters[r.chapterMap.c1][0];
  check('★ ทางเลือกแตกสายชี้ไปฉากสำเนา', s1.choices[0].nextSceneId === r.sceneMap.s2);
  check('ทางเลือกที่ชี้ออกนอกเล่มคงเดิม', s1.choices[1].nextSceneId === 'zz');
  check('ต้นฉบับไม่ถูกแก้', draft.chapters[0].guid === 'c1' && scenes.chapters.c1[0].id === 's1');
}
check('ชื่อสำเนาไม่ชน', M.uniqueCopyName('เล่ม', ['เล่ม (สำเนา)'], '(สำเนา)') === 'เล่ม (สำเนา 2)');
check('ชื่อสำเนาแรก', M.uniqueCopyName('เล่ม', [], '(สำเนา)') === 'เล่ม (สำเนา)');

// ───────── backup รายชิ้น ─────────
{
  const st = M.backupStamp(Date.UTC(2026, 8, 13, 10, 20, 30, 456));
  check('ชื่อชุดสำรองตามเวลา', st === '2026-09-13T10-20-30-456', st);
  check('อ่านเวลาคืนได้', M.parseBackupStamp(st) === Date.UTC(2026, 8, 13, 10, 20, 30, 456));
  check('ชื่อแปลก = 0', M.parseBackupStamp('abc') === 0);
  const sorted = M.sortBackups(['2026-01-01T00-00-00-000', 'junk', '2026-09-01T00-00-00-000']);
  check('ใหม่สุดก่อน + ข้ามชื่อแปลก', sorted.join() === '2026-09-01T00-00-00-000,2026-01-01T00-00-00-000');
  check('โฟลเดอร์ชุดสำรองปลอดภัยต่อชื่อไฟล์', M.itemBackupDir('memo', 'a/b:c') === 'Backups/Items/memo/a_b_c');
}

console.log(`\ntree-menu: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
