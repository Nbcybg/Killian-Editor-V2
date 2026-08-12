// test/panel-sync.test.cjs — [alpha.68] ช่องส่ง "ฉากที่เปิดอยู่" ข้ามหน้าต่าง (tear-off เฟส 2)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = (f) => path.join(os.tmpdir(), f);
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/panels/panel-sync.js')],
                    outfile: tmp('_psync.cjs'), format: 'cjs', bundle: true, logLevel: 'silent' });
const S = require(tmp('_psync.cjs'));

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

const SCENE = 'C:/proj/เล่ม1/Draft/ร่างแรก/Chapters/บท1/ฉาก1.md';
const WIKI = 'C:/proj/Wiki/characters/โทระ.json';

// ── ทะเบียนแผง ──
check('แผงที่ต้องรู้ฉาก = 5 ตัว', S.SCENE_PANELS.size === 5, [...S.SCENE_PANELS].join());
check('outline/props/comments/floorplan/ai-chat อยู่ในชุดที่ต้องรู้ฉาก',
      ['outline', 'props', 'comments', 'floorplan', 'ai-chat'].every((id) => S.needsScene(id)));
check('player/ai-analyzer ไม่ต้องรู้ฉาก (วาดจากไฟล์ล้วน ๆ)',
      !S.needsScene('player') && !S.needsScene('ai-analyzer'));
check('แผงเดิมของ .67 ไม่ต้องรู้ฉาก', !S.needsScene('timeline') && !S.needsScene('kanban'));
check('เฟส 2 เปิดเพิ่ม 7 แผง', S.PHASE2_PANELS.length === 7, String(S.PHASE2_PANELS.length));
// แผงที่เขียนไฟล์ของฉาก = ชุดที่ต้องล็อกอ่านอย่างเดียวตอนหน้าต่างหลักยังไม่บันทึก
check('แผงที่เขียนไฟล์ฉาก = props/comments/floorplan',
      ['props', 'comments', 'floorplan'].every((id) => S.writesScene(id)) && S.SCENE_WRITE_PANELS.size === 3,
      [...S.SCENE_WRITE_PANELS].join());
check('Navigation อ่านอย่างเดียว → ไม่ต้องล็อก', !S.writesScene('outline'));
check('AI ผู้ช่วยเขียนเขียนลง Sessions/ ของตัวเอง → ไม่ต้องล็อก', !S.writesScene('ai-chat'));
check('แผงที่เขียนไฟล์ฉากต้องอยู่ในชุดที่รู้จักฉากด้วยเสมอ',
      [...S.SCENE_WRITE_PANELS].every((id) => S.SCENE_PANELS.has(id)));
check('anyNeedsScene: มีแผงที่ต้องรู้ฉากถูกฉีกอยู่', S.anyNeedsScene(['timeline', 'props']) === true);
check('anyNeedsScene: ไม่มีเลย → false (ไม่ต้อง broadcast)',
      S.anyNeedsScene(['timeline', 'maps', 'player']) === false);
check('anyNeedsScene: ไม่มีหน้าต่างแผงเลย → false', S.anyNeedsScene([]) === false && S.anyNeedsScene(null) === false);

// ── isSceneFile ──
check('ไฟล์ฉากในฉบับร่าง = ใช่', S.isSceneFile(SCENE));
check('ไฟล์ฉากแบบสแลชวินโดวส์ = ใช่', S.isSceneFile('C:\\proj\\a\\Chapters\\b\\c.md'));
check('หน้า Wiki ไม่ใช่ฉาก', !S.isSceneFile(WIKI));
check('.md นอก Chapters ไม่ใช่ฉาก', !S.isSceneFile('C:/proj/Memos/บันทึก.md'));
check('แท็บพิเศษ (::dashboard::) ไม่ใช่ฉาก', !S.isSceneFile('::dashboard::'));
check('ค่าว่าง/null ไม่ใช่ฉาก', !S.isSceneFile('') && !S.isSceneFile(null) && !S.isSceneFile(undefined));

// ── sceneMsg ──
const m1 = S.sceneMsg({ file: SCENE, title: 'ฉากแรก', dirty: false });
check('sceneMsg: kind ถูก', m1.kind === 'active-scene');
check('sceneMsg: ส่งไฟล์+ชื่อ', m1.file === SCENE && m1.title === 'ฉากแรก');
check('sceneMsg: dirty=false', m1.dirty === false);
const m2 = S.sceneMsg({ file: SCENE, title: 'ฉากแรก', dirty: true, sp: {} });
check('sceneMsg: ส่ง dirty ไปด้วยเสมอ (ลูกใช้ตัดสินสิทธิ์เขียน)', m2.dirty === true);
check('sceneMsg: บทหนัง → sp=true', m2.sp === true);
const m3 = S.sceneMsg({ file: WIKI, title: 'โทระ', dirty: true });
check('sceneMsg: แท็บที่ไม่ใช่ฉาก → file ว่าง', m3.file === '' && m3.title === '');
check('sceneMsg: แท็บที่ไม่ใช่ฉาก → dirty ไม่รั่วออกไป', m3.dirty === false);
check('sceneMsg: ไม่มีแท็บเลย (null) ก็ไม่พัง', S.sceneMsg(null).file === '');
check('sceneMsg: แนบ extra ได้ (root)', S.sceneMsg(null, { root: 'C:/proj' }).root === 'C:/proj');

// ── remoteTab ──
const rt = S.remoteTab(m2);
check('remoteTab: ได้แท็บจำลองพร้อม file', rt && rt.file === SCENE);
check('remoteTab: ธง remote บอกว่าไม่ใช่เอกสารจริง', rt.remote === true);
check('remoteTab: **ไม่มี** editor/sp/plain (โค้ดที่ต้องใช้ตัวแก้ไขจริงจะตกทางที่ถูก)',
      rt.editor === undefined && rt.sp === undefined && rt.plain === undefined);
check('remoteTab: บทหนังบอกผ่าน spRemote ไม่ใช่ sp', rt.spRemote === true);
check('remoteTab: มี meta ว่างให้โค้ดที่อ่าน t.meta ไม่ระเบิด', rt.meta && typeof rt.meta === 'object');
check('remoteTab: ไม่มีฉากเปิดอยู่ → null', S.remoteTab(S.sceneMsg(null)) === null);
check('remoteTab: ข้อความเปล่า → null', S.remoteTab(null) === null);

// ── sceneChanged (กันวาดซ้ำ) ──
check('sceneChanged: ครั้งแรกเสมอ = true', S.sceneChanged(null, m1) === true);
check('sceneChanged: ข้อความเดิมเป๊ะ = false', S.sceneChanged(m1, S.sceneMsg({ file: SCENE, title: 'ฉากแรก' })) === false);
check('sceneChanged: dirty พลิก = true', S.sceneChanged(m1, m2) === true);
check('sceneChanged: เปลี่ยนฉาก = true',
      S.sceneChanged(m1, S.sceneMsg({ file: SCENE.replace('ฉาก1', 'ฉาก2'), title: 'ฉากสอง' })) === true);
check('sceneChanged: เปลี่ยนแค่ชื่อ (เปลี่ยนชื่อฉาก) = true',
      S.sceneChanged(m1, S.sceneMsg({ file: SCENE, title: 'ชื่อใหม่' })) === true);
check('sceneChanged: ข้อความว่าง = false', S.sceneChanged(m1, null) === false);

// ── canEditScene (ตาข่ายกันเขียนชนกัน) ──
check('canEditScene: หน้าต่างหลักบันทึกแล้ว → แก้ได้', S.canEditScene(m1) === true);
check('canEditScene: หน้าต่างหลักยังไม่บันทึก → อ่านอย่างเดียว', S.canEditScene(m2) === false);
check('canEditScene: ไม่มีฉากเปิดอยู่ → แก้ไม่ได้', S.canEditScene(S.sceneMsg(null)) === false);
check('canEditScene: null → แก้ไม่ได้', S.canEditScene(null) === false);

// ── outlineMsg ──
const om = S.outlineMsg(SCENE, 'ฉากแรก', [
  { kind: 'heading', label: 'บทที่ 1', lvl: 1, pos: 0 },
  { kind: 'beat', label: 'เดินเข้าห้อง', lvl: 4, line: 12 },
], { empty: '(ยังไม่มีหัวข้อ)', sp: true });
check('outlineMsg: kind ถูก', om.kind === 'outline');
check('outlineMsg: เก็บ 2 รายการ', om.items.length === 2);
check('outlineMsg: รายการที่มี pos เก็บ pos · line เป็น null',
      om.items[0].pos === 0 && om.items[0].line === null);
check('outlineMsg: รายการที่มี line เก็บ line · pos เป็น null',
      om.items[1].line === 12 && om.items[1].pos === null);
check('outlineMsg: ส่งข้อความ "ไม่มีอะไรให้แสดง" ไปด้วย', om.empty === '(ยังไม่มีหัวข้อ)');
check('outlineMsg: ธงบทหนัง', om.sp === true);
check('outlineMsg: รายการว่างก็ไม่พัง', S.outlineMsg('', '', null).items.length === 0);
check('outlineMsg: ตัด field แปลกปลอมทิ้ง (ส่งข้าม IPC = ต้อง clone ได้)',
      Object.keys(S.outlineMsg('a', 'b', [{ kind: 'h', label: 'x', lvl: 1, pos: 3, node: {} }]).items[0])
        .sort().join() === 'kind,label,line,lvl,pos');

// ── gotoMsg ──
const g1 = S.gotoMsg(SCENE, { pos: 42 });
check('gotoMsg: ส่ง pos', g1.kind === 'goto-outline' && g1.pos === 42 && g1.line === null);
check('gotoMsg: ส่ง line', S.gotoMsg(SCENE, { line: 7 }).line === 7);
check('gotoMsg: pos = 0 ต้องไม่กลายเป็น null (บล็อกแรกของเอกสาร)', S.gotoMsg(SCENE, { pos: 0 }).pos === 0);
check('gotoMsg: ไม่มีอะไรเลย → null ทั้งคู่',
      S.gotoMsg('', null).pos === null && S.gotoMsg('', null).line === null);
check('wantSceneMsg: ถามหาฉากปัจจุบันตอนบูตเสร็จ',
      S.wantSceneMsg('props').kind === 'want-scene' && S.wantSceneMsg('props').id === 'props');

// ── samePath ──
check('samePath: สแลชคนละแบบ = เดียวกัน', S.samePath('C:/a/b.md', 'C:\\a\\b.md'));
check('samePath: ตัวพิมพ์ต่างกัน = เดียวกัน', S.samePath('C:/A/B.md', 'c:/a/b.md'));
check('samePath: คนละไฟล์', !S.samePath('C:/a/b.md', 'C:/a/c.md'));
check('samePath: ค่าว่าง = ไม่ใช่', !S.samePath('', '') && !S.samePath('C:/a.md', null));

// ── tabsToReload (งานที่ยังไม่บันทึกสำคัญกว่าเสมอ) ──
const tabs = [
  { file: SCENE, dirty: false },
  { file: SCENE.replace('ฉาก1', 'ฉาก2'), dirty: false },
  { file: WIKI, dirty: true },
];
check('tabsToReload: แท็บที่ตรงกับไฟล์ที่เปลี่ยน 1 ใบ', S.tabsToReload(tabs, SCENE).length === 1);
check('tabsToReload: เทียบข้ามชนิดสแลชได้', S.tabsToReload(tabs, SCENE.replace(/\//g, '\\')).length === 1);
check('tabsToReload: แท็บที่ยังพิมพ์ค้าง (dirty) ห้ามโหลดทับ',
      S.tabsToReload([{ file: SCENE, dirty: true }], SCENE).length === 0);
check('tabsToReload: ไฟล์ที่ไม่มีใครเปิด → ไม่มีอะไรต้องทำ',
      S.tabsToReload(tabs, 'C:/proj/อื่น.md').length === 0);
check('tabsToReload: ไม่รู้ว่าไฟล์ไหนเปลี่ยน → ไม่แตะอะไรเลย', S.tabsToReload(tabs, '').length === 0);
check('tabsToReload: ไม่มีแท็บเลย', S.tabsToReload(null, SCENE).length === 0);

console.log(`panel-sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
