#!/usr/bin/env node
// tools/demo-project.cjs — โปรเจกต์ตัวอย่างที่ "มีของ" พอให้ดูหน้าตาแผง (ผังความสัมพันธ์ · Kanban · ผังแตกสาย)
// ไม่ใช่ fixture ของ e2e (test/fixture.js ต้องเล็กและคงที่) — ใช้คู่กับ tools/shot.cjs
//   node tools/demo-project.cjs /tmp/k2demo
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '/tmp/k2demo';
fs.rmSync(root, { recursive: true, force: true });
const w = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof d === 'string' ? d : JSON.stringify(d, null, 2)); };

/* i18n-skip: ข้อมูลตัวอย่างของโปรเจกต์ ไม่ใช่ข้อความ UI */
w(path.join(root, 'project.khn.json'), { title: 'ปีศาจแห่งบางกอก', type: 'killian-project' });
const sec = path.join(root, 'เล่มหนึ่ง');
w(path.join(sec, 'section.json'), { guid: 's1', title: 'เล่มหนึ่ง', order: 1 });
const dr = path.join(sec, 'Draft', 'default');

const chars = ['โทระ', 'แคสซี่', 'ไคลี่', 'ลูน่า', 'นาซาเรนา', 'ยัยแมวเก้าชีวิต', 'ท่านเจ้าคุณ', 'หมอผีดำ',
  'ป้าแม้น', 'เจ้าสัวเฮง', 'สารวัตรเก่ง', 'เด็กหญิงแพรว'];
const locs = ['ตลาดเก่า', 'วัดร้าง', 'ท่าน้ำ', 'ร้านขนมปัง', 'คฤหาสน์ริมคลอง'];
const items = ['กุญแจทองเหลือง', 'ตะเกียงวิญญาณ', 'สมุดสูตรลับ'];
const lore = ['คำสาปเก้าชีวิต', 'พิธีเดือนดับ'];
const rels = [
  ['โทระ', 'แคสซี่', 'คนรัก', 'lover'], ['โทระ', 'ไคลี่', 'เพื่อนสนิท', 'friend'],
  ['โทระ', 'หมอผีดำ', 'ศัตรู', 'enemy'], ['แคสซี่', 'ป้าแม้น', 'หลาน', 'family'],
  ['ลูน่า', 'นาซาเรนา', 'พี่น้อง', 'family'], ['ลูน่า', 'โทระ', 'คู่แข่ง', 'rival'],
  ['ท่านเจ้าคุณ', 'เจ้าสัวเฮง', 'หุ้นส่วน', 'ally'], ['หมอผีดำ', 'ท่านเจ้าคุณ', 'ลูกน้อง', 'ally'],
  ['สารวัตรเก่ง', 'หมอผีดำ', 'ไล่ล่า', 'enemy'], ['เด็กหญิงแพรว', 'ยัยแมวเก้าชีวิต', 'เจ้าของ', 'friend'],
  ['ไคลี่', 'สารวัตรเก่ง', 'ลูกศิษย์', 'mentor'], ['นาซาเรนา', 'แคสซี่', 'เพื่อน', 'friend'],
  ['เจ้าสัวเฮง', 'ป้าแม้น', 'เจ้าหนี้', 'rival'], ['ยัยแมวเก้าชีวิต', 'โทระ', 'ผู้พิทักษ์', 'ally'],
];
for (const n of chars) {
  const r = rels.filter((x) => x[0] === n).map((x) => ({ targetName: x[1], role: x[2], type: x[3] }));
  w(path.join(root, 'Wiki', 'characters', n + '.json'), { name: n, entityTypeKey: 'characters', relationships: r, tags: [] });
}
for (const n of locs) w(path.join(root, 'Wiki', 'locations', n + '.json'), { name: n, entityTypeKey: 'locations', relationships: [] });
for (const n of items) w(path.join(root, 'Wiki', 'items', n + '.json'), { name: n, entityTypeKey: 'items', relationships: [] });
for (const n of lore) w(path.join(root, 'Wiki', 'lore', n + '.json'), { name: n, entityTypeKey: 'lore', relationships: [] });

const S = ['โครงร่าง', 'กำลังเขียน', 'เขียนเสร็จ', 'ตรวจแล้ว'];
const scenes = [
  ['ตลาดเก่ายามค่ำ', 'โทระ', 'โทระเจอแมวดำที่ตลาดเก่า และได้ยินเสียงเรียกชื่อตัวเองจากตรอกมืด', 3, ['เปิดเรื่อง'], 1800],
  ['ร้านขนมปังของป้าแม้น', 'แคสซี่', 'แคสซี่รับสูตรขนมลับ ป้าแม้นเตือนเรื่องพิธีเดือนดับ', 3, ['ปม'], 2400],
  ['ท่าน้ำตอนตีสาม', 'โทระ', 'โทระกับไคลี่แอบตามหมอผีดำไปท่าน้ำ', 2, ['สืบสวน'], 1500],
  ['วัดร้าง', 'ไคลี่', 'ไคลี่เลือกว่าจะเข้าวัดคนเดียวหรือรอสารวัตร', 2, ['ทางแยก'], 1200],
  ['ไคลี่เข้าวัดคนเดียว', 'ไคลี่', 'เจอตะเกียงวิญญาณ แต่ถูกขังไว้ในศาลา', 1, ['ทางแยก'], 700],
  ['รอสารวัตรเก่ง', 'ไคลี่', 'สารวัตรมาช้า หมอผีหนีไปได้', 1, [], 400],
  ['คฤหาสน์ริมคลอง', 'ลูน่า', 'ลูน่ากับนาซาเรนาลอบเข้างานเลี้ยงของท่านเจ้าคุณ', 0, ['ปม'], 0],
  ['คืนเดือนดับ', 'โทระ', 'พิธีเริ่มขึ้น ทุกคนต้องเลือกข้าง', 0, ['ไคลแมกซ์'], 0],
  ['ตอนจบ: รุ่งเช้า', 'แคสซี่', 'ร้านขนมเปิดอีกครั้ง', 0, ['ตอนจบ'], 0],
  ['ตอนจบ: เงาในคลอง', 'โทระ', 'คำสาปยังไม่จบ', 0, ['ตอนจบ'], 0],
  ['บันทึกของแพรว', 'เด็กหญิงแพรว', '', -1, [], 300],
];
const choices = {
  sc4: [{ text: 'เข้าไปคนเดียว', nextSceneId: 'sc5', color: '#e0b04a' }, { text: 'รอสารวัตร', nextSceneId: 'sc6' }],
  sc5: [{ text: 'จุดตะเกียง', nextSceneId: 'sc8' }], sc6: [{ text: 'ตามไปคฤหาสน์', nextSceneId: 'sc7' }],
  sc7: [{ text: 'เข้าร่วมพิธี', nextSceneId: 'sc8' }],
  sc8: [{ text: 'ทำลายตะเกียง', nextSceneId: 'sc9' }, { text: 'ปล่อยวิญญาณ', nextSceneId: 'sc10' }],
  sc3: [{ text: 'ไปวัดร้าง', nextSceneId: 'sc4' }], sc1: [{ text: 'ตามแมวไป', nextSceneId: 'sc3' }, { text: 'กลับร้าน', nextSceneId: 'sc2' }],
  sc2: [{ text: 'ออกไปตามหาโทระ', nextSceneId: 'sc3' }],
};
const chs = [{ guid: 'c1', title: 'ตลาดยามค่ำ', order: 1, folderName: '01 - ตลาดยามค่ำ' },
  { guid: 'c2', title: 'คืนเดือนดับ', order: 2, folderName: '02 - คืนเดือนดับ' }];
w(path.join(dr, 'draft.json'), { chapters: chs });
const rows = { c1: [], c2: [] };
scenes.forEach(([title, pov, syn, st, tags, words], i) => {
  const id = 'sc' + (i + 1), ch = i < 6 ? 'c1' : 'c2';
  const fileName = 'scene-' + String(i + 1).padStart(2, '0') + '.md';
  rows[ch].push({ id, title, order: rows[ch].length + 1, fileName, status: st >= 0 ? S[st] : '', pov, synopsis: syn,
    tags, wordCount: words, choices: choices[id] || [] });
  const body = 'ค่ำคืนนั้น ' + pov + ' ยืนอยู่ที่' + title + ' ' + (syn || '') + '\n\n' +
    (choices[id] || []).map((c) => '[' + c.text + ']').join(' ');
  w(path.join(dr, 'Chapters', chs.find((c) => c.guid === ch).folderName, fileName),
    `---\ntitle: ${title}\ntype: scene\nformat: prose\npov: ${pov}\nsynopsis: ${syn}\ntags: [${tags.join(', ')}]\n---\n\n${body}\n`);
});
w(path.join(dr, 'scenes.json'), { chapters: rows });
w(path.join(root, 'Memos', 'note-1.md'), '---\ntitle: ไอเดียตอนจบ\ntype: memo\n---\n\nจดไว้ก่อน');
/* /i18n-skip */
console.log('demo OK →', root);
